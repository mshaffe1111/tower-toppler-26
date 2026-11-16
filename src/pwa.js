// PWA helpers: service-worker registration, install prompt / iOS hint, and fullscreen-on-first-tap.
// Everything here is defensive: unsupported browsers simply get a no-op.

function mq(query) {
  try {
    return window.matchMedia(query).matches;
  } catch (_) {
    return false;
  }
}

/** True when launched from the home screen / as an installed app (not a regular browser tab). */
export const isStandalone =
  mq('(display-mode: standalone)') ||
  mq('(display-mode: fullscreen)') ||
  mq('(display-mode: minimal-ui)') ||
  window.navigator.standalone === true;

const UA = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// Capture beforeinstallprompt as soon as this module is evaluated, so the event isn't lost if it fires
// before setupInstallPrompt() is called. An inline <head> script may also have stashed it on
// window.__deferredInstallPrompt (see README snippet) for pages that load this module late.
let earlyPrompt = window.__deferredInstallPrompt || null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  earlyPrompt = e;
});

function lsGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}
function lsSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_) {}
}

/**
 * Register ./sw.js (https or localhost only).
 * onUpdateReady({ registration, reload }) fires when a NEW worker takes over a page that was already
 * controlled by an older one (i.e. an update was installed, not the very first install). The new
 * worker activates immediately (skipWaiting), so calling reload() picks up the fresh files.
 * Returns a Promise of the ServiceWorkerRegistration, or null when not registered.
 */
export function registerPWA({ onUpdateReady } = {}) {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (location.protocol !== 'https:' && !LOCAL_HOSTS.has(location.hostname)) return Promise.resolve(null);

  const hadController = !!navigator.serviceWorker.controller;
  let registrationRef = null;
  let notified = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || notified) return;
    notified = true;
    if (typeof onUpdateReady === 'function') {
      try {
        onUpdateReady({
          registration: registrationRef,
          reload: () => window.location.reload(),
        });
      } catch (err) {
        console.warn('[pwa] onUpdateReady failed', err);
      }
    }
  });

  const register = () =>
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        registrationRef = reg;
        // Installed apps can stay open for days: look for a new version when brought back to the front.
        let lastCheck = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - lastCheck < 30 * 60 * 1000) return;
          lastCheck = Date.now();
          reg.update().catch(() => {});
        });
        return reg;
      })
      .catch((err) => {
        console.warn('[pwa] service worker registration failed', err);
        return null;
      });

  // Register after load so the worker's precache doesn't compete with the game's own boot downloads.
  if (document.readyState === 'complete') return register();
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(register()), { once: true });
  });
}

/**
 * Wire an "Install" button. The button should start with the `hidden` class.
 *  - Chromium (beforeinstallprompt): shows the button while the app is installable; click opens the prompt.
 *  - iOS (no beforeinstallprompt, not standalone): shows a one-time hint "Share ▸ Add to Home Screen"
 *    that hides on tap or after ~9 s.
 */
export function setupInstallPrompt(buttonEl) {
  if (!buttonEl || isStandalone) return;
  let deferred = null;
  let iosHint = false;

  const show = () => buttonEl.classList.remove('hidden');
  const hide = () => buttonEl.classList.add('hidden');

  const offer = (e) => {
    deferred = e;
    iosHint = false;
    buttonEl.classList.remove('ios-hint');
    show();
  };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer(e);
  });
  if (earlyPrompt) offer(earlyPrompt);

  window.addEventListener('appinstalled', () => {
    deferred = null;
    earlyPrompt = null;
    hide();
  });

  buttonEl.addEventListener('click', async () => {
    if (iosHint) {
      hide();
      return;
    }
    if (!deferred) return;
    const evt = deferred;
    deferred = null;
    earlyPrompt = null;
    try {
      await evt.prompt();
      await evt.userChoice;
      // The event can't be reused; Chrome fires a fresh beforeinstallprompt later if still installable.
      hide();
    } catch (err) {
      console.warn('[pwa] install prompt failed', err);
      hide();
    }
  });

  const HINT_KEY = 'tt26.iosInstallHintShown';
  if (isIOS && !('onbeforeinstallprompt' in window) && !lsGet(HINT_KEY)) {
    lsSet(HINT_KEY, '1');
    iosHint = true;
    buttonEl.textContent = 'Share ▸ Add to Home Screen';
    buttonEl.setAttribute('aria-label', 'To install: tap Share, then Add to Home Screen');
    buttonEl.classList.add('ios-hint');
    show();
    setTimeout(() => {
      if (iosHint) hide();
    }, 9000);
  }
}
