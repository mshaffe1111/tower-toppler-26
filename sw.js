/* Tower Toppler '26 service worker: offline play.
 *
 * Install: precaches the app shell, then CRAWLS it. It reads index.html (script/link tags and the
 * importmap), follows every static `import`/`export ... from` / dynamic `import('...')` in the JS
 * modules, and caches each same-origin file plus the three.js modules on jsDelivr they pull in.
 * New src/*.js files and three/addons imports are therefore picked up without editing this file.
 *
 * Fetch strategies
 *  - Navigations:                      network-first -> cached page -> cached index.html -> offline page
 *  - Same-origin code (js/css/json/…): network-first -> cache (exact URL, then ignoring ?v=N)
 *      Network-first keeps all modules on the same version when online (a mix of cached and fresh
 *      modules could fail to link) and never serves stale code during development.
 *      Offline, fetch fails immediately and the cached copy is used.
 *  - Same-origin images/icons:         cache-first -> network
 *  - three.js on jsDelivr (pinned) + Google Fonts: stale-while-revalidate in runtime caches
 *  - Anything else (other origins, non-GET, Range requests): not intercepted
 *
 * Bump VERSION to force a fresh precache. Old "tt26-" caches are deleted on activate.
 */
const VERSION = 'v11';
const PREFIX = 'tt26-';
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
// three.js is pinned to 0.170.0, so its cache can outlive shell versions.
const CDN_CACHE = `${PREFIX}cdn-three-0.170.0`;
const FONT_CACHE = `${PREFIX}fonts-v1`;
const KEEP = new Set([SHELL_CACHE, CDN_CACHE, FONT_CACHE]);

const THREE_BASE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const MAX_CRAWL = 250;

// Files that the crawler can't find from index.html / imports. Missing entries are skipped.
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './styles-landscape.css',
  './manifest.webmanifest',
  './src/main.js',
  './src/pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-monochrome-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-64.png',
];
// Must succeed for the install to count; everything else is best-effort.
const CRITICAL = new Set(['./index.html']);

const FONT_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700;800;900&family=Rajdhani:wght@500;600;700&display=swap',
];

// ---------------------------------------------------------------- install / activate

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      const results = await Promise.allSettled(SHELL.map((p) => fetchAndCache(shell, p)));
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          if (CRITICAL.has(SHELL[i])) throw r.reason;
          console.warn('[sw] precache skipped', SHELL[i], r.reason && r.reason.message);
        }
      });
      try {
        await crawlApp(shell);
      } catch (err) {
        console.warn('[sw] crawl incomplete', err);
      }
      await precacheFonts().catch(() => {});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && !KEEP.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------------------------------------------------------------- precache helpers

async function fetchAndCache(cache, url, init) {
  const res = await fetch(new Request(url, { cache: 'reload', ...init }));
  if (!isCacheable(res)) throw new Error(`${url}: HTTP ${res.status}`);
  await cache.put(url, res.clone());
  return res;
}

async function precacheFonts() {
  const cache = await caches.open(FONT_CACHE);
  await Promise.allSettled(
    FONT_PRECACHE.map(async (url) => {
      if (!(await cache.match(url, { ignoreVary: true }))) await fetchAndCache(cache, url, { mode: 'no-cors', cache: 'default' });
    })
  );
}

// Walk index.html + the ES module graph and cache every reachable same-origin file and three.js module.
async function crawlApp(shell) {
  const indexUrl = new URL('./index.html', self.registration.scope).href;
  const indexRes = await shell.match('./index.html');
  if (!indexRes) return;
  const html = await indexRes.text();

  let imports = {};
  const mapMatch = html.match(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
  if (mapMatch) {
    try {
      imports = JSON.parse(mapMatch[1]).imports || {};
    } catch (_) {}
  }

  const cdn = await caches.open(CDN_CACHE);
  const seen = new Set();
  let queue = [];
  const enqueue = (url) => {
    if (!url || seen.has(url) || seen.size >= MAX_CRAWL) return;
    seen.add(url);
    queue.push(url);
  };

  for (const m of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    const tag = m[0];
    if (/rel=["']?(?:preconnect|dns-prefetch)/i.test(tag)) continue;
    const url = safeUrl(m[1], indexUrl);
    if (url && isCrawlable(url)) enqueue(url);
  }

  while (queue.length) {
    const batch = queue;
    queue = [];
    await Promise.allSettled(
      batch.map(async (url) => {
        const sameOrigin = new URL(url).origin === self.location.origin;
        const cache = sameOrigin ? shell : cdn;
        let res = sameOrigin ? null : await cdn.match(url);
        if (!res) res = await fetchAndCache(cache, url, sameOrigin ? undefined : { mode: 'cors', credentials: 'omit', cache: 'default' });
        if (!/\.m?js(?:$|\?)/.test(new URL(url).pathname + new URL(url).search)) return;
        const src = await res.clone().text();
        for (const spec of findImports(src)) {
          const dep = resolveSpecifier(spec, url, imports);
          if (dep && isCrawlable(dep)) enqueue(dep);
        }
      })
    );
  }
}

function findImports(src) {
  const out = new Set();
  const patterns = [
    /\bimport\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"'\n]+)["']/g,
    /\bexport\s*(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"'\n]+)["']/g,
    /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) out.add(m[1]);
  return out;
}

function resolveSpecifier(spec, parentUrl, imports) {
  if (/^(?:\.{0,2}\/|https?:)/.test(spec)) return safeUrl(spec, parentUrl);
  if (imports[spec]) return safeUrl(imports[spec], parentUrl);
  let best = '';
  for (const key of Object.keys(imports)) {
    if (key.endsWith('/') && spec.startsWith(key) && key.length > best.length) best = key;
  }
  return best ? safeUrl(imports[best] + spec.slice(best.length), parentUrl) : null;
}

function isCrawlable(url) {
  return new URL(url).origin === self.location.origin ? !url.endsWith('/sw.js') : url.startsWith(THREE_BASE);
}

function safeUrl(spec, base) {
  try {
    const u = new URL(spec, base);
    u.hash = '';
    return u.href;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------- fetch routing

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    const isImage = req.destination === 'image' || /\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/i.test(url.pathname);
    event.respondWith(isImage ? cacheFirst(event, req, SHELL_CACHE) : networkFirst(event, req, SHELL_CACHE));
    return;
  }
  if (req.url.startsWith(THREE_BASE)) {
    event.respondWith(staleWhileRevalidate(event, req, CDN_CACHE));
    return;
  }
  if (FONT_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, FONT_CACHE));
  }
});

async function handleNavigation(event) {
  const req = event.request;
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(cache.put(stripSearch(req.url), copy).catch(() => {}));
    }
    return res;
  } catch (err) {
    const cached =
      (await cache.match(req, { ignoreSearch: true })) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./'));
    return cached || offlineResponse();
  }
}

async function networkFirst(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(
        cache
          .put(req, copy)
          .then(() => pruneOldVersions(cache, req.url))
          .catch(() => {})
      );
    }
    return res;
  } catch (err) {
    const cached = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    event.waitUntil(cache.put(req, copy).catch(() => {}));
  }
  return res;
}

async function staleWhileRevalidate(event, req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreVary: true });
  const network = fetch(req).then(async (res) => {
    if (isCacheable(res)) await cache.put(req, res.clone()).catch(() => {});
    return res;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

// When a ?v=N copy of a file is stored, drop older ?v= copies of the same path (unversioned copies stay).
async function pruneOldVersions(cache, urlStr) {
  const url = new URL(urlStr);
  if (!url.search) return;
  const keys = await cache.keys(urlStr, { ignoreSearch: true });
  await Promise.all(
    keys
      .filter((k) => {
        const u = new URL(k.url);
        return u.pathname === url.pathname && u.search && u.search !== url.search;
      })
      .map((k) => cache.delete(k))
  );
}

// ---------------------------------------------------------------- helpers

function isCacheable(res) {
  // Opaque (status 0) responses only come from no-cors requests, e.g. the Google Fonts <link> stylesheet.
  return !!res && (res.ok || res.type === 'opaque');
}

function stripSearch(urlStr) {
  const u = new URL(urlStr);
  u.search = '';
  u.hash = '';
  return u.href;
}

function offlineResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>Tower Toppler '26: offline</title>" +
      '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#050814;color:#bff;font:600 16px system-ui;text-align:center">' +
      '<div>You are offline and the game is not cached yet.<br>Reconnect and reload to play.</div></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
