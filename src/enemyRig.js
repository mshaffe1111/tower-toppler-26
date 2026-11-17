import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLS } from './levels.js';

/**
 * TOWER TOPPLER '26 — Next-Gen 3D Creature & Combat VFX Pool (`src/enemyRig.js`)
 *
 * Combines headless-Blender 5.3.0 `.glb` creature sculpts (`assets/models/enemy_*.glb`)
 * with multi-part procedural sub-assemblies, custom PBR textures, articulated gait/gaze
 * kinematics, jagged 3D Cryo-Ice Crystal Block encasement, and pooled dynamic lighting:
 *
 *   0: `eye`      — Abyssal Tendril-Eyeball Monster (wet capillary-veined sclera, luminous
 *                   cyan-emerald iris & dilating pupil tracking Pogo, riveted optic collar,
 *                   6 spider-stepping & writhing crimson tendrils)
 *   1: `molecule` — Amethyst Crystal Cluster (`bonker`: translucent deep-violet faceted
 *                   shards orbiting/pulsing around a blinding magenta-white core + purple
 *                   PointLight bounce onto wet stone bricks)
 *   2: `roller`   — Riveted Cast-Iron & Brass Spiked Furnace Sphere (`roll`: physical tread
 *                   rolling, glowing orange interior vents, gyro trunnion yoke, encased in
 *                   jagged 3D Cryo-Ice Crystal Block when `en.stunTimer > 0`)
 *   3: `bouncer`  — Bioluminescent Spore-Jelly / Armored Spring-Orb (`bounce` / `park`:
 *                   translucent toxic-lime spore sac, floating bio-nucleus, helical spring
 *                   compression, squash-stretch jiggle & Cryo-Ice encasement when stunned)
 *   4: `robot`    — Brass-and-Iron Clockwork Sentinel Droid (`robotH` / `robotV` / `hpat` /
 *                   `vpat`: counter-rotating coaxial brass turbine rotors, sweeping crimson
 *                   visor eye locking onto Pogo, cyan plasma thruster plume & Cryo-Ice stun)
 *
 * Dual-Era Support:
 *   - `era === 'reboot'`  : Dark-cinematic wet-stone, organic clearcoat, tarnished brass & amethyst PBR
 *   - `era === 'original'`: Vibrant 2007–2010 XBLA HD mirror-chrome & candy-enamel arcade models
 *                           with classic 1987/7800 2-row proportions
 *
 * Strict Mobile 60fps Guarantee:
 *   - Zero per-frame heap/GC allocations (integer bucket indexing, scratch scalars, WeakMap state)
 *   - Fixed 2-PointLight pool (always `visible = true`, parked at intensity 0 when idle -> 0 shader recompiles)
 */

const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / (COLS || 16);

const FAM_EYE = 0;
const FAM_MOLECULE = 1;
const FAM_ROLLER = 2;
const FAM_BOUNCER = 3;
const FAM_ROBOT = 4;
const FAMILY_COUNT = 5;

const GLB_URLS = [
  'assets/models/enemy_eye.glb',
  'assets/models/enemy_molecule.glb',
  'assets/models/enemy_roller.glb',
  'assets/models/enemy_bouncer.glb',
  'assets/models/enemy_robot.glb',
];

const DEATH_BURST_SLOTS = 6;
const DYNAMIC_LIGHT_SLOTS = 2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur, dst, lambda, dt) => cur + (dst - cur) * (1 - Math.exp(-lambda * dt));

function wrapAngle(a) {
  let r = a % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  if (r < -Math.PI) r += TWO_PI;
  return r;
}

function colDelta(fromCol, toCol, cols) {
  const c = cols || COLS || 16;
  const wA = ((fromCol % c) + c) % c;
  const wB = ((toCol % c) + c) % c;
  let d = wB - wA;
  if (d > c * 0.5) d -= c;
  if (d < -c * 0.5) d += c;
  return d;
}

function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Resolves any game enemy object (`type` / `kind`) into one of the 5 canonical family IDs.
 * @param {object} en
 * @returns {number} 0..4 (`FAM_EYE`..`FAM_ROBOT`)
 */
export function resolveEnemyFamilyId(en) {
  if (!en) return FAM_BOUNCER;
  const t = en.type;
  const k = en.kind;
  if (t === 'eye') return FAM_EYE;
  if (t === 'molecule' || k === 'bonker') return FAM_MOLECULE;
  if (t === 'roller' || k === 'roll') return FAM_ROLLER;
  if (t === 'bouncer' || k === 'bounce' || k === 'park') return FAM_BOUNCER;
  if (
    t === 'robotH' ||
    t === 'robotV' ||
    t === 'robot' ||
    t === 'chaser' ||
    k === 'hpat' ||
    k === 'vpat'
  ) {
    return FAM_ROBOT;
  }
  return FAM_BOUNCER;
}

// ============================================================================
// Shared Static Caches (Geometries, Procedural PBR Maps, Materials & GLBs)
// ============================================================================
const _cache = new Map();
function cached(key, builder) {
  let val = _cache.get(key);
  if (val === undefined) {
    val = builder();
    _cache.set(key, val);
  }
  return val;
}

function makeCanvasTex(w, h, drawFn, { srgb = true, repeat = false } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const data = new Uint8Array([255, 255, 255, 255]);
    const dt = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    if (srgb) dt.colorSpace = THREE.SRGBColorSpace;
    dt.needsUpdate = true;
    return dt;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

function getSoftGlowTex() {
  return cached('tex:softGlow', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.5);
      g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
      g.addColorStop(0.18, 'rgba(255,255,255,0.86)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.32)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.07)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    })
  );
}

function getShockRingTex() {
  return cached('tex:shockRing', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const g = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.49);
      g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.82, 'rgba(255,255,255,0.95)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TWO_PI + 0.18;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
        ctx.lineTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
        ctx.stroke();
      }
    })
  );
}

/**
 * 512x256 Wet Capillary-Veined Sclera Albedo + Bump Maps (Reference Photo Upper-Left).
 * UV center (0.5, 0.5) faces +Z when sphere is rotated -PI/2 around Y.
 */
function getWetScleraMaps() {
  return cached('tex:wetScleraMaps', () => {
    const W = 512;
    const H = 256;
    const cx = W * 0.5;
    const cy = H * 0.5;

    const bumpData = [];
    const rand = seededRng(7741);

    // Pre-generate organic branching arterial & venous capillary paths
    const segments = [];
    const traceVein = (x0, y0, ang, steps, width, depth, crimsonTone) => {
      let px = x0;
      let py = y0;
      let a = ang;
      for (let s = 0; s < steps; s++) {
        const dx = cx - px;
        const dy = cy - py;
        const dist = Math.hypot(dx, dy);
        if (dist < 62) break;
        a += (Math.atan2(dy, dx) - a) * 0.11 + (rand() - 0.5) * 0.62;
        const nx = px + Math.cos(a) * 6.5;
        const ny = py + Math.sin(a) * 5.2;
        const w = Math.max(0.55, width * (1 - s / (steps * 1.08)));
        segments.push({ x0: px, y0: py, x1: nx, y1: ny, w, crimsonTone });
        px = nx;
        py = ny;
        if (depth < 2 && rand() < 0.18) {
          traceVein(
            px,
            py,
            a + (rand() < 0.5 ? -1 : 1) * (0.55 + rand() * 0.65),
            Math.floor(steps * 0.52),
            w * 0.65,
            depth + 1,
            crimsonTone
          );
        }
      }
    };

    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TWO_PI + rand() * 0.25;
      const startR = 135 + rand() * 95;
      traceVein(
        cx + Math.cos(a) * startR * 1.25,
        cy + Math.sin(a) * startR * 0.68,
        a + Math.PI,
        28,
        3.4,
        0,
        i % 3 === 0 ? 'rgba(108, 14, 32, 0.88)' : 'rgba(152, 20, 44, 0.78)'
      );
    }
    bumpData.push(...segments);

    const map = makeCanvasTex(W, H, (ctx) => {
      const g = ctx.createRadialGradient(cx, cy, 42, cx, cy, W * 0.52);
      g.addColorStop(0.0, '#12222c'); // Dark limbal pocket under iris
      g.addColorStop(0.22, '#ece6dc'); // Matte-wet warm bone-ivory front sclera
      g.addColorStop(0.56, '#d4ccc2'); // Shaded damp ivory mid sclera
      g.addColorStop(0.84, '#946d74'); // Vascularized equatorial socket transition
      g.addColorStop(1.0, '#4a0e1e'); // Deep crimson optic-nerve rear pole
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Subtle mottled organic wet tissue variation
      for (let i = 0; i < 42; i++) {
        const mx = (i * 73) % W;
        const my = (i * 47) % H;
        const mg = ctx.createRadialGradient(mx, my, 2, mx, my, 36);
        mg.addColorStop(0, 'rgba(148, 163, 184, 0.10)');
        mg.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = mg;
        ctx.fillRect(mx - 36, my - 36, 72, 72);
      }

      ctx.lineCap = 'round';
      for (let i = 0; i < bumpData.length; i++) {
        const sg = bumpData[i];
        ctx.strokeStyle = sg.crimsonTone;
        ctx.lineWidth = sg.w;
        ctx.beginPath();
        ctx.moveTo(sg.x0, sg.y0);
        ctx.lineTo(sg.x1, sg.y1);
        ctx.stroke();
      }
    });

    const bumpMap = makeCanvasTex(
      W,
      H,
      (ctx) => {
        ctx.fillStyle = '#787878';
        ctx.fillRect(0, 0, W, H);
        ctx.lineCap = 'round';
        for (let i = 0; i < bumpData.length; i++) {
          const sg = bumpData[i];
          ctx.strokeStyle = '#d8d8d8';
          ctx.lineWidth = sg.w * 1.15;
          ctx.beginPath();
          ctx.moveTo(sg.x0, sg.y0);
          ctx.lineTo(sg.x1, sg.y1);
          ctx.stroke();
        }
      },
      { srgb: false }
    );

    return { map, bumpMap };
  });
}

/**
 * Striated Luminous Cyan-Emerald Iris Map matching Reference Photo Upper-Left!
 */
function getStriatedIrisTex(isOrig = false) {
  return cached('tex:iris:' + (isOrig ? 'orig' : 'reboot'), () =>
    makeCanvasTex(256, 256, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const r = w * 0.48;

      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(cx, cy, r * 0.14, cx, cy, r);
      if (isOrig) {
        g.addColorStop(0.0, '#ffffff');
        g.addColorStop(0.28, '#67e8f9');
        g.addColorStop(0.68, '#0284c7');
        g.addColorStop(0.92, '#1e3a8a');
        g.addColorStop(1.0, '#020617');
      } else {
        g.addColorStop(0.0, '#ccfbf1'); // Hot inner cyan-mint sphincter ring
        g.addColorStop(0.26, '#2dd4bf'); // Luminous emerald-cyan inner iris
        g.addColorStop(0.58, '#06b6d4'); // Rich abyssal cyan mid stroma
        g.addColorStop(0.84, '#0e4f5c'); // Dark teal outer iris crypts
        g.addColorStop(1.0, '#04131a'); // Sharp dark limbal border
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TWO_PI);
      ctx.fill();

      // Radial iris muscle striations
      const rand = seededRng(isOrig ? 303 : 909);
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * TWO_PI + (rand() - 0.5) * 0.05;
        const r0 = r * (0.22 + rand() * 0.1);
        const r1 = r * (0.82 + rand() * 0.12);
        ctx.strokeStyle =
          i % 2 === 0 ? 'rgba(165, 255, 245, 0.42)' : 'rgba(4, 28, 36, 0.48)';
        ctx.lineWidth = 1.4 + rand() * 1.6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a + 0.03) * r1, cy + Math.sin(a + 0.03) * r1);
        ctx.stroke();
      }

      // Bright inner collarette ring
      ctx.strokeStyle = isOrig ? 'rgba(224,242,254,0.75)' : 'rgba(153,246,228,0.72)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.44, 0, TWO_PI);
      ctx.stroke();
    })
  );
}

/**
 * 256x256 Frosted Cryo-Ice Facet Texture (intact vs stress-fractured thaw state).
 */
function getCryoFrostTex(cracked = false) {
  return cached('tex:cryoFrost:' + (cracked ? 'crack' : 'intact'), () =>
    makeCanvasTex(256, 256, (ctx, W, H) => {
      const img = ctx.createImageData(W, H);
      const rand = seededRng(cracked ? 419 : 113);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const ex = Math.min(x, W - 1 - x) / (W * 0.5);
          const ey = Math.min(y, H - 1 - y) / (H * 0.5);
          const edge = Math.min(ex, ey);
          const rime = Math.pow(1 - smooth(0.0, 0.36, edge), 1.55);
          const n = rand();
          const alpha = 0.22 + rime * 0.58 + (n - 0.5) * 0.07;
          const idx = (y * W + x) * 4;
          img.data[idx] = clamp(195 + rime * 52 + n * 8, 0, 255);
          img.data[idx + 1] = clamp(232 + rime * 22, 0, 255);
          img.data[idx + 2] = 255;
          img.data[idx + 3] = clamp(alpha, 0, 1) * 255;
        }
      }
      ctx.putImageData(img, 0, 0);

      // Internal cleavage planes & frozen micro-bubbles
      ctx.strokeStyle = 'rgba(224, 247, 255, 0.42)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        let px = rand() * W;
        let py = rand() * H;
        ctx.moveTo(px, py);
        for (let s = 0; s < 4; s++) {
          px += (rand() - 0.5) * 95;
          py += (rand() - 0.5) * 95;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      for (let i = 0; i < 24; i++) {
        ctx.beginPath();
        ctx.arc(24 + rand() * (W - 48), 24 + rand() * (H - 48), 1 + rand() * 2.8, 0, TWO_PI);
        ctx.fill();
      }

      if (cracked) {
        ctx.lineCap = 'round';
        const drawCrack = (x0, y0, ang, steps, width) => {
          let x = x0;
          let y = y0;
          let a = ang;
          for (let s = 0; s < steps; s++) {
            const nx = x + Math.cos(a) * 9.5;
            const ny = y + Math.sin(a) * 9.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            x = nx;
            y = ny;
            a += (rand() - 0.5) * 0.85;
            if (rand() < 0.2 && width > 1.2) {
              drawCrack(x, y, a + (rand() - 0.5) * 1.9, Math.floor(steps * 0.45), width * 0.62);
            }
          }
        };
        for (let i = 0; i < 6; i++) {
          drawCrack(
            W * 0.5 + (rand() - 0.5) * 44,
            H * 0.5 + (rand() - 0.5) * 44,
            (i / 6) * TWO_PI + rand() * 0.4,
            15,
            3.4
          );
        }
      }
    })
  );
}

function stripPosNormal(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (geo.index) geo.dispose();
  const keys = Object.keys(g.attributes);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

function mergePartsClean(parts, recomputeFlatNormals = false) {
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) {
    parts[i].dispose();
  }
  if (merged && recomputeFlatNormals) merged.computeVertexNormals();
  return merged;
}

function extractGlbGeosByMat(rootNode, matNames) {
  const out = [];
  if (!rootNode) return out;
  const matchSet = Array.isArray(matNames) ? matNames : [matNames];
  rootNode.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(rootNode.matrixWorld).invert();
  const relMat = new THREE.Matrix4();
  rootNode.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    const m = obj.material;
    const nm = Array.isArray(m) ? m[0]?.name : m?.name;
    if (!matchSet.includes(nm)) return;
    relMat.multiplyMatrices(invRoot, obj.matrixWorld);
    const g = stripPosNormal(obj.geometry.clone());
    g.applyMatrix4(relMat);
    out.push(g);
  });
  return out;
}

/**
 * Jagged Translucent 3D Cryo-Ice Crystal Block Geometry:
 * Chiseled glacial polyhedron merged with 9 asymmetric erupting cryo-crystal shards.
 */
function getCryoIceGeometry() {
  return cached('geo:cryoIceBlock', () => {
    const W = 0.31;
    const D = 0.30;
    const top = 0.36;
    const bot = -0.26;
    const bev = 0.085;
    const rand = seededRng(53);
    const pts = [
      // Crown & base apex points so silhouette is chiseled crystal, never a flat box
      new THREE.Vector3(0.02, top + 0.07, 0.01),
      new THREE.Vector3(-0.12, top + 0.04, 0.08),
      new THREE.Vector3(0.13, top + 0.03, -0.07),
      new THREE.Vector3(0, bot - 0.03, 0),
    ];

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const [y, sy] of [
          [top, 1],
          [bot, -1],
        ]) {
          const j = () => (rand() - 0.5) * 0.032;
          const taper = sy > 0 ? 0.86 : 0.94;
          pts.push(new THREE.Vector3(sx * (W - bev) * taper + j(), y, sz * (D - bev) * taper + j()));
          pts.push(new THREE.Vector3(sx * W * taper + j(), y - sy * bev, sz * (D - bev) + j()));
          pts.push(new THREE.Vector3(sx * (W - bev) + j(), y - sy * bev, sz * D * taper + j()));
        }
      }
    }

    // Asymmetric jagged glacial side facets
    const midY = (top + bot) * 0.5;
    for (const [nx, nz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      for (let k = 0; k < 3; k++) {
        const u = (rand() - 0.5) * 0.34;
        const y = midY + (rand() - 0.5) * 0.34;
        const bulge = 0.024 + rand() * 0.035;
        if (nx !== 0) pts.push(new THREE.Vector3(nx * (W + bulge), y, u));
        else pts.push(new THREE.Vector3(u, y, nz * (D + bulge)));
      }
    }

    const hull = stripPosNormal(new ConvexGeometry(pts));

    // Add 9 jutting chiseled cryo-crystal spires around base, flanks & crown!
    const spireSpecs = [
      [-0.24, -0.06, 0.19, -0.46, 0.24, 0.28, 0.092, 0.32],
      [0.25, -0.08, 0.18, 0.44, 0.2, -0.26, 0.088, 0.3],
      [-0.25, -0.1, -0.16, -0.38, -0.22, 0.24, 0.084, 0.28],
      [0.24, -0.05, -0.18, 0.36, -0.25, -0.24, 0.086, 0.29],
      [-0.16, 0.22, 0.16, 0.28, 0.32, 0.24, 0.082, 0.26],
      [0.17, 0.21, -0.14, -0.25, -0.28, -0.22, 0.08, 0.27],
      [0.02, 0.26, 0.12, 0.18, 0.1, -0.08, 0.074, 0.24],
      [-0.26, 0.08, 0.02, 0.08, 0.15, 0.48, 0.072, 0.24],
      [0.26, 0.09, -0.02, -0.08, -0.15, -0.46, 0.072, 0.24],
    ];
    const parts = [hull];
    for (let i = 0; i < spireSpecs.length; i++) {
      const [px, py, pz, rx, ry, rz, rad, len] = spireSpecs[i];
      const cone = stripPosNormal(new THREE.ConeGeometry(rad, len, 5));
      cone.translate(0, len * 0.38, 0);
      cone.rotateX(rx);
      cone.rotateY(ry);
      cone.rotateZ(rz);
      cone.translate(px, py, pz);
      parts.push(cone);
    }

    const merged = mergePartsClean(parts, true);

    // Planar per-triangle UVs so rime frost hugs facet edges cleanly
    const pos = merged.attributes.position;
    const nrm = merged.attributes.normal;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 3) {
      const ax = Math.abs(nrm.getX(i));
      const ay = Math.abs(nrm.getY(i));
      const az = Math.abs(nrm.getZ(i));
      for (let k = 0; k < 3; k++) {
        const x = pos.getX(i + k);
        const y = pos.getY(i + k);
        const z = pos.getZ(i + k);
        let u = 0.5;
        let v = 0.5;
        if (ay >= ax && ay >= az) {
          u = clamp((x + W) / (2 * W), 0, 1);
          v = clamp((z + D) / (2 * D), 0, 1);
        } else if (ax >= az) {
          u = clamp((z + D) / (2 * D), 0, 1);
          v = clamp((y - bot) / (top - bot), 0, 1);
        } else {
          u = clamp((x + W) / (2 * W), 0, 1);
          v = clamp((y - bot) / (top - bot), 0, 1);
        }
        uvs[(i + k) * 2] = u;
        uvs[(i + k) * 2 + 1] = v;
      }
    }
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return merged;
  });
}

function getCryoIceMaterials(cracked = false, chromeEnv = null) {
  return cached('mat:cryoIce:' + (cracked ? 'crack' : 'intact'), () => {
    const tex = getCryoFrostTex(cracked);
    const back = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: cracked ? 0.52 : 0.36,
      roughness: 0.16,
      metalness: 0.05,
      transparent: true,
      opacity: 0.34,
      side: THREE.BackSide,
      depthWrite: false,
      flatShading: true,
    });
    const front = new THREE.MeshPhysicalMaterial({
      color: '#e0f7ff',
      map: tex,
      emissive: cracked ? '#bae6fd' : '#38bdf8',
      emissiveMap: tex,
      emissiveIntensity: cracked ? 0.48 : 0.28,
      roughness: 0.05,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 0.38,
      iridescenceIOR: 1.31,
      transparent: true,
      opacity: cracked ? 0.82 : 0.72,
      depthWrite: false,
      flatShading: true,
      envMap: chromeEnv || null,
      envMapIntensity: 1.35,
    });
    return { back, front };
  });
}

function buildCryoIceNode(chromeEnv) {
  const g = new THREE.Group();
  const geo = getCryoIceGeometry();
  const mats = getCryoIceMaterials(false, chromeEnv);

  const backMesh = new THREE.Mesh(geo, mats.back);
  backMesh.renderOrder = 3;
  const frontMesh = new THREE.Mesh(geo, mats.front);
  frontMesh.renderOrder = 4;

  const mistHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getSoftGlowTex(),
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  mistHalo.scale.set(0.95, 0.85, 1);
  mistHalo.position.set(0, 0.04, 0.08);

  g.add(backMesh, frontMesh, mistHalo);
  g.visible = false;
  g.userData = { backMesh, frontMesh, mistHalo, isCracked: false };
  return g;
}

// ============================================================================
// Shared Asynchronous `.glb` Loader & PBR Material Enhancer
// ============================================================================
const _glbTemplates = [null, null, null, null, null];
let _glbLoadStarted = false;
let _glbReadyMask = 0;

function upgradeLoadedGlbTemplate(famId, rootScene, chromeEnv) {
  const scleraMaps = famId === FAM_EYE ? getWetScleraMaps() : null;
  const irisTex = famId === FAM_EYE ? getStriatedIrisTex(false) : null;

  rootScene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const applyMat = (m) => {
      if (!m) return m;
      const nm = m.name || '';
      if (chromeEnv && !m.envMap) {
        m.envMap = chromeEnv;
        m.envMapIntensity = 1.1;
      }
      let next = m;
      if (famId === FAM_EYE) {
        if (nm === 'mat_sclera' && scleraMaps) {
          next = new THREE.MeshPhysicalMaterial({
            color: '#e5dfd5',
            map: m.map || scleraMaps.map,
            normalMap: m.normalMap || null,
            normalScale: new THREE.Vector2(0.75, 0.75),
            bumpMap: m.normalMap ? null : scleraMaps.bumpMap,
            bumpScale: 0.018,
            roughness: 0.17,
            metalness: 0.02,
            clearcoat: 0.78,
            clearcoatRoughness: 0.1,
            envMap: chromeEnv || null,
            envMapIntensity: 0.92,
          });
        } else if (nm === 'mat_iris' && irisTex) {
          // Always project planar `+Z` circular UVs onto `iris` so 360-degree radial striations wrap symmetrically!
          if (obj.geometry && obj.geometry.attributes.position) {
            const pos = obj.geometry.attributes.position;
            let maxR = 0.001;
            for (let vi = 0; vi < pos.count; vi++) {
              const rxy = Math.hypot(pos.getX(vi), pos.getY(vi));
              if (rxy > maxR) maxR = rxy;
            }
            const uvs = new Float32Array(pos.count * 2);
            const invSpan = 0.46 / maxR;
            for (let vi = 0; vi < pos.count; vi++) {
              uvs[vi * 2] = 0.5 + pos.getX(vi) * invSpan;
              uvs[vi * 2 + 1] = 0.5 + pos.getY(vi) * invSpan;
            }
            obj.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          }
          next = new THREE.MeshPhysicalMaterial({
            color: '#45f7e8',
            map: irisTex,
            emissive: new THREE.Color('#14e8d8'),
            emissiveMap: irisTex,
            emissiveIntensity: 1.48,
            roughness: 0.06,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
          });
        } else if (nm === 'mat_pupil') {
          next = new THREE.MeshBasicMaterial({ color: '#020409' });
        } else if (nm === 'mat_tendril') {
          next = new THREE.MeshPhysicalMaterial({
            color: '#630d1e',
            emissive: new THREE.Color('#1d0308'),
            emissiveIntensity: 0.16,
            roughness: 0.28,
            metalness: 0.03,
            clearcoat: 0.85,
            clearcoatRoughness: 0.11,
            envMap: chromeEnv || null,
            envMapIntensity: 0.85,
          });
        } else if (
          nm === 'mat_metal' ||
          nm === 'mat_bronze' ||
          nm === 'mat_brass' ||
          nm === 'mat_bezel'
        ) {
          next = new THREE.MeshStandardMaterial({
            color: '#946f3e',
            metalness: 0.84,
            roughness: 0.28,
            envMap: chromeEnv || null,
            envMapIntensity: 1.25,
          });
        }
      } else if (famId === FAM_MOLECULE) {
        if (nm === 'mat_crystal') {
          next = new THREE.MeshPhysicalMaterial({
            color: '#2d0c5e',
            emissive: new THREE.Color('#5b21b6'),
            emissiveIntensity: 0.28,
            roughness: 0.16,
            metalness: 0.16,
            clearcoat: 0.96,
            clearcoatRoughness: 0.04,
            iridescence: 0.72,
            iridescenceIOR: 1.5,
            transparent: true,
            opacity: 0.95,
            flatShading: true,
            envMap: chromeEnv || null,
            envMapIntensity: 1.4,
          });
        } else if (nm === 'mat_core') {
          next = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.35, 2.6) });
        }
      } else if (famId === FAM_ROLLER) {
        if (nm === 'mat_furnace') {
          next = new THREE.MeshStandardMaterial({
            color: '#ff4d00',
            emissive: new THREE.Color('#ff3d00'),
            emissiveIntensity: 1.65,
            roughness: 0.2,
          });
        }
      } else if (famId === FAM_BOUNCER) {
        if (nm === 'mat_spore') {
          next = new THREE.MeshPhysicalMaterial({
            color: '#84cc16',
            emissive: new THREE.Color('#4d7c0f'),
            emissiveIntensity: 0.78,
            roughness: 0.14,
            metalness: 0.02,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            transparent: true,
            opacity: 0.86,
            envMap: chromeEnv || null,
          });
        }
      }
      if (next !== m) next.name = nm;
      return next;
    };

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(applyMat);
    } else {
      obj.material = applyMat(obj.material);
    }
  });
}

function ensureEnemyGlbsLoading(chromeEnv = null) {
  if (_glbLoadStarted) return;
  _glbLoadStarted = true;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  try {
    const loader = new GLTFLoader();
    for (let famId = 0; famId < FAMILY_COUNT; famId++) {
      loader.load(
        GLB_URLS[famId],
        (gltf) => {
          if (gltf && gltf.scene) {
            upgradeLoadedGlbTemplate(famId, gltf.scene, chromeEnv);
            _glbTemplates[famId] = gltf.scene;
            _glbReadyMask |= 1 << famId;
          }
        },
        undefined,
        () => {}
      );
    }
  } catch {
    // Graceful fallback to procedural rigs in restricted/headless contexts
  }
}

// ============================================================================
// Shared Procedural Sub-Assembly Builders (Merged 1-Draw-Call Parts!)
// ============================================================================

function getTendrilDistalGeo() {
  return cached('geo:tendrilDistal', () => {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.075, -0.028),
      new THREE.Vector3(0, -0.145, 0.012),
      new THREE.Vector3(0, -0.195, 0.048),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 8, 0.019, 6, false);
    const pos = tube.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = clamp(-y / 0.195, 0, 1);
      const tap = 1 - t * 0.72;
      pos.setX(i, pos.getX(i) * tap);
      pos.setZ(i, pos.getZ(i) * mix(1, 0.65, t) + t * t * 0.018);
    }
    tube.computeVertexNormals();
    return tube;
  });
}

function getTendrilProximalGeo() {
  return cached('geo:tendrilProximal', () => {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -0.055, -0.045),
      new THREE.Vector3(0, -0.125, -0.065),
    ];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 7, 0.031, 6, false);
    const pos = tube.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = clamp(-pos.getY(i) / 0.125, 0, 1);
      const tap = 1 - t * 0.35;
      pos.setX(i, pos.getX(i) * tap);
    }
    tube.computeVertexNormals();
    return tube;
  });
}

function getMoleculeDualHaloTex() {
  return cached('tex:moleculeDualHalo', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
      g.addColorStop(0.0, 'rgba(255, 250, 255, 1.0)');
      g.addColorStop(0.16, 'rgba(250, 212, 255, 0.92)');
      g.addColorStop(0.32, 'rgba(217, 70, 239, 0.58)');
      g.addColorStop(0.62, 'rgba(147, 51, 234, 0.24)');
      g.addColorStop(1.0, 'rgba(88, 28, 135, 0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    })
  );
}

function getEyeCollarArmorGeo() {
  return cached('geo:eyeCollarArmor', () => {
    const parts = [];
    // Front sculpted antique tarnished-bronze iris bezel + inner beveled lens flange + 6 micro-rivets
    const frontBezel = stripPosNormal(new THREE.TorusGeometry(0.141, 0.016, 8, 24));
    frontBezel.translate(0, 0, 0.214);
    parts.push(frontBezel);

    const innerLip = stripPosNormal(new THREE.TorusGeometry(0.129, 0.0085, 6, 24));
    innerLip.translate(0, 0, 0.222);
    parts.push(innerLip);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TWO_PI + 0.52;
      const friv = stripPosNormal(new THREE.SphereGeometry(0.01, 6, 4));
      friv.translate(Math.cos(a) * 0.151, Math.sin(a) * 0.151, 0.217);
      parts.push(friv);
    }

    // Snug rear riveted bronze optic harness & cup (preserves organic ivory sclera silhouette!)
    const mainBand = stripPosNormal(new THREE.TorusGeometry(0.236, 0.024, 8, 24));
    mainBand.translate(0, 0, -0.115);
    parts.push(mainBand);

    const rearCup = stripPosNormal(new THREE.CylinderGeometry(0.205, 0.14, 0.12, 16, 1, false));
    rearCup.rotateX(Math.PI * 0.5);
    rearCup.translate(0, 0, -0.175);
    parts.push(rearCup);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TWO_PI + 0.2;
      const riv = stripPosNormal(new THREE.SphereGeometry(0.016, 6, 5));
      riv.translate(Math.cos(a) * 0.252, Math.sin(a) * 0.252, -0.11);
      parts.push(riv);
    }
    return mergePartsClean(parts);
  });
}

function getAmethystClusterFallbackGeo() {
  return cached('geo:amethystClusterFallback', () => {
    const dirs = [
      [0.0, 1.0, 0.08, 0.31, 0.095],
      [0.0, -1.0, -0.06, 0.3, 0.092],
      [-0.96, 0.14, 0.22, 0.29, 0.088],
      [0.96, -0.16, 0.2, 0.3, 0.088],
      [-0.55, 0.62, -0.45, 0.26, 0.08],
      [0.58, 0.58, -0.42, 0.26, 0.08],
      [-0.56, -0.58, 0.44, 0.25, 0.076],
      [0.58, -0.56, -0.44, 0.25, 0.076],
      [-0.38, 0.22, 0.78, 0.2, 0.064],
      [0.4, -0.24, 0.76, 0.2, 0.064],
    ];
    const parts = [];
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (let i = 0; i < dirs.length; i++) {
      const [dx, dy, dz, len, rad] = dirs[i];
      dir.set(dx, dy, dz).normalize();
      const prism = stripPosNormal(new THREE.ConeGeometry(rad, len, 6));
      prism.translate(0, 0.065 + len * 0.5, 0);
      q.setFromUnitVectors(up, dir);
      prism.applyQuaternion(q);
      parts.push(prism);
    }
    return mergePartsClean(parts);
  });
}

function getCrystalShardGeo() {
  return cached('geo:crystalShardSingle', () => {
    const top = stripPosNormal(new THREE.ConeGeometry(0.068, 0.165, 6));
    top.translate(0, 0.0825, 0);
    const bot = stripPosNormal(new THREE.ConeGeometry(0.068, 0.075, 6));
    bot.rotateX(Math.PI);
    bot.translate(0, -0.0375, 0);
    return mergePartsClean([top, bot]);
  });
}

function getRollerArmorSpikesGeo() {
  return cached('geo:rollerArmorSpikes', () => {
    const parts = [];
    for (const zOff of [-0.095, 0.095]) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI + (zOff > 0 ? Math.PI / 8 : 0);
        const cone = stripPosNormal(new THREE.ConeGeometry(0.034, 0.086, 6));
        cone.translate(0, 0.258 + 0.035, 0);
        cone.rotateZ(-a);
        cone.translate(0, 0, zOff);
        parts.push(cone);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TWO_PI;
      const bar = stripPosNormal(new THREE.BoxGeometry(0.024, 0.052, 0.082));
      bar.translate(0, 0.252, 0);
      bar.rotateZ(-a);
      parts.push(bar);
    }
    return mergePartsClean(parts);
  });
}

function getRollerYokeGeo() {
  return cached('geo:rollerYoke', () => {
    const parts = [];
    for (const sz of [-1, 1]) {
      const hub = stripPosNormal(new THREE.CylinderGeometry(0.076, 0.088, 0.044, 10));
      hub.rotateX(Math.PI * 0.5);
      hub.translate(0, 0, sz * 0.276);
      parts.push(hub);
    }
    const arch = stripPosNormal(new THREE.TorusGeometry(0.292, 0.024, 6, 18, Math.PI * 0.72));
    arch.rotateZ(Math.PI * 0.14);
    parts.push(arch);
    return mergePartsClean(parts);
  });
}

function getRobotTurbineBladesGeo(radius = 0.21, bladeCount = 4, pitch = 0.34) {
  return cached(`geo:robotBlades:${radius}:${bladeCount}:${pitch}`, () => {
    const parts = [];
    const hub = stripPosNormal(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.036, 10));
    parts.push(hub);
    const outerRing = stripPosNormal(new THREE.TorusGeometry(radius, 0.014, 6, 20));
    outerRing.rotateX(Math.PI * 0.5);
    parts.push(outerRing);

    for (let i = 0; i < bladeCount; i++) {
      const a = (i / bladeCount) * TWO_PI;
      const blade = stripPosNormal(new THREE.BoxGeometry(radius * 0.78, 0.012, 0.046));
      blade.rotateX(pitch);
      blade.translate(radius * 0.54, 0, 0);
      blade.rotateY(a);
      parts.push(blade);
    }
    return mergePartsClean(parts);
  });
}

// ============================================================================
// Creature Rig Builders (`reboot` & `original`)
// ============================================================================

const TENDRIL_ANCHORS = [
  [-0.22, -0.1, -0.06, -1, -0.68],
  [-0.25, 0.05, -0.05, -1, -1.12],
  [-0.16, 0.2, -0.08, -1, -1.58],
  [0.22, -0.1, -0.06, 1, 0.68],
  [0.25, 0.05, -0.05, 1, 1.12],
  [0.14, -0.2, -0.05, 1, 0.35],
];

function buildEyeRig(isOrig, chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const glowTex = getSoftGlowTex();
  const ud = {
    family: FAM_EYE,
    isOrig,
    body,
    gazePivot: null,
    pupil: null,
    tripodA: null,
    tripodB: null,
    halo: null,
    cryoIce: buildCryoIceNode(chromeEnv),
    glbMaskBit: isOrig ? 0 : _glbReadyMask & (1 << FAM_EYE),
  };
  root.add(ud.cryoIce);

  const mergedOrigGlintsGeo = cached('geo:eyeMergedGlints', () => {
    const g1 = stripPosNormal(new THREE.SphereGeometry(0.025, 8, 6));
    g1.scale(0.9, 0.9, 0.45);
    g1.translate(-0.048, 0.052, 0.288);
    const g2 = stripPosNormal(new THREE.SphereGeometry(0.012, 8, 6));
    g2.translate(0.04, -0.036, 0.292);
    return mergePartsClean([g1, g2]);
  });
  const glintMat = cached('mat:glintWhite', () => new THREE.MeshBasicMaterial({ color: '#ffffff' }));

  if (isOrig) {
    // 2007–2010 XBLA HD Classic Arcade Eye (5 draw calls total!)
    const scleraMat = cached(
      'mat:origEyeSclera',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          roughness: 0.06,
          metalness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          envMap: chromeEnv || null,
          envMapIntensity: 1.35,
        })
    );
    const chromeMat = cached(
      'mat:origChrome',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#e2e8f0',
          metalness: 0.94,
          roughness: 0.08,
          clearcoat: 1.0,
          envMap: chromeEnv || null,
          envMapIntensity: 1.5,
        })
    );
    const irisTex = getStriatedIrisTex(true);
    const irisMat = cached(
      'mat:origEyeIris',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          map: irisTex,
          emissive: new THREE.Color('#00d8ff'),
          emissiveMap: irisTex,
          emissiveIntensity: 1.25,
          roughness: 0.05,
          clearcoat: 1.0,
        })
    );
    const pupilMat = cached('mat:origPupil', () => new THREE.MeshBasicMaterial({ color: '#020617' }));

    const sclera = new THREE.Mesh(
      cached('geo:origEyeSphere', () => new THREE.SphereGeometry(0.285, 24, 18)),
      scleraMat
    );
    const collar = new THREE.Mesh(
      cached('geo:origEyeRim', () => new THREE.TorusGeometry(0.275, 0.032, 8, 24)),
      chromeMat
    );
    collar.position.z = -0.05;
    body.add(sclera, collar);

    const gazePivot = new THREE.Group();
    body.add(gazePivot);
    const iris = new THREE.Mesh(
      cached('geo:origIrisCap', () => {
        const s = new THREE.SphereGeometry(0.155, 18, 12);
        s.scale(1, 1, 0.45);
        return s;
      }),
      irisMat
    );
    iris.position.z = 0.232;

    const pupil = new THREE.Mesh(
      cached('geo:origPupilCap', () => {
        const s = new THREE.SphereGeometry(0.078, 14, 10);
        s.scale(1, 1, 0.4);
        return s;
      }),
      pupilMat
    );
    pupil.position.z = 0.282;

    gazePivot.add(iris, pupil, new THREE.Mesh(mergedOrigGlintsGeo, glintMat));

    ud.gazePivot = gazePivot;
    ud.pupil = pupil;
    root.userData = ud;
    return root;
  }

  // REBOOT (`era === 'reboot'`): Heroic ~1.4x Tendril-Eyeball Monster (`media_1794884512715_2296550d.jpg` — 6 draw calls total!)
  const scleraMaps = getWetScleraMaps();
  const irisTex = getStriatedIrisTex(false);
  const tendrilMat = cached(
    'mat:rebootTendril',
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#630d1e',
        emissive: new THREE.Color('#1d0308'),
        emissiveIntensity: 0.16,
        roughness: 0.28,
        metalness: 0.03,
        clearcoat: 0.85,
        clearcoatRoughness: 0.11,
        envMap: chromeEnv || null,
        envMapIntensity: 0.85,
      })
  );
  const collarArmorMat = cached(
    'mat:rebootEyeCollar',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#946f3e',
        metalness: 0.84,
        roughness: 0.28,
        envMap: chromeEnv || null,
        envMapIntensity: 1.25,
      })
  );

  const gazePivot = new THREE.Group();
  body.add(gazePivot);

  const glbTemplate = _glbTemplates[FAM_EYE];
  let glbUnitScale = 1.0;
  if (glbTemplate) {
    // Measure `sclera` LOCAL mesh geometry span (ignoring `EnemyEyeRoot.scale = 1.38`) so child clones stay 1:1!
    const scMeasure = glbTemplate.getObjectByName('sclera');
    if (scMeasure) {
      let localSpanY = 0;
      scMeasure.traverse((o) => {
        if (o.isMesh && o.geometry) {
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          if (bb) localSpanY = Math.max(localSpanY, (bb.max.y - bb.min.y) * o.scale.y);
        }
      });
      if (localSpanY > 0.15) glbUnitScale = 0.53 / localSpanY;
    }
  }

  const buildMergedTripod = (parity, withGlb) =>
    cached(`geo:eyeTripod:${parity}:${withGlb ? 1 : 0}`, () => {
      const parts = [];
      const proxSrc = stripPosNormal(getTendrilProximalGeo());
      const distSrc = stripPosNormal(getTendrilDistalGeo());

      if (withGlb && glbTemplate && parity === 0) {
        const scleraNode = glbTemplate.getObjectByName('sclera');
        const scVeins = extractGlbGeosByMat(scleraNode, 'mat_tendril');
        for (let k = 0; k < scVeins.length; k++) {
          scVeins[k].scale(glbUnitScale, glbUnitScale, glbUnitScale);
          if (scleraNode) {
            scVeins[k].translate(
              scleraNode.position.x * glbUnitScale,
              scleraNode.position.y * glbUnitScale,
              scleraNode.position.z * glbUnitScale
            );
          }
          parts.push(scVeins[k]);
        }
      }

      for (let i = parity; i < 6; i += 2) {
        const anchor = TENDRIL_ANCHORS[i];
        if (withGlb && glbTemplate) {
          const tdNode = glbTemplate.getObjectByName(`tendril_${i + 1}`);
          const glbParts = extractGlbGeosByMat(tdNode, 'mat_tendril');
          const tx = tdNode ? tdNode.position.x * glbUnitScale : anchor[0];
          const ty = tdNode ? tdNode.position.y * glbUnitScale : anchor[1];
          const tz = tdNode ? tdNode.position.z * glbUnitScale : anchor[2];
          for (let k = 0; k < glbParts.length; k++) {
            const gs = glbUnitScale * 1.15;
            glbParts[k].scale(gs, gs, gs);
            glbParts[k].translate(tx, ty, tz);
            parts.push(glbParts[k]);
          }
        }
        const limb = mergeGeometries(
          [
            (() => {
              const s = proxSrc.clone();
              s.scale(1.15, 1.35, 1.15);
              return s;
            })(),
            (() => {
              const d = distSrc.clone();
              d.scale(1.2, 1.45, 1.2);
              d.rotateZ(anchor[3] * -0.25);
              d.rotateX(0.28);
              d.translate(anchor[3] * 0.04, -0.14, -0.06);
              return d;
            })(),
          ],
          false
        );
        limb.rotateZ(anchor[4] * 1.15);
        limb.rotateY(anchor[3] * 0.22);
        limb.translate(anchor[0] * 1.08, anchor[1] * 1.05, anchor[2]);
        parts.push(limb);
      }
      proxSrc.dispose();
      distSrc.dispose();
      return mergePartsClean(parts, false);
    });

  if (glbTemplate) {
    // 1. Matte-wet capillary-veined ivory sclera (`mat_sclera` mesh only; raised veins merged into tripodA!)
    const scleraClone = glbTemplate.getObjectByName('sclera')?.clone(true);
    if (scleraClone) {
      const toRemove = [];
      scleraClone.traverse((o) => {
        if (o.isMesh) {
          const nm = Array.isArray(o.material) ? o.material[0]?.name : o.material?.name;
          if (nm === 'mat_tendril') toRemove.push(o);
        }
      });
      for (let r = 0; r < toRemove.length; r++) toRemove[r].parent?.remove(toRemove[r]);
      scleraClone.scale.multiplyScalar(glbUnitScale);
      scleraClone.position.multiplyScalar(glbUnitScale);
      body.add(scleraClone);
    }

    // 2. Luminous Turquoise-Cyan Iris & Dilating Pupil inside `gazePivot`
    const glbIris = glbTemplate.getObjectByName('iris')?.clone(true);
    const glbPupil = glbTemplate.getObjectByName('pupil')?.clone(true);
    if (glbIris) {
      glbIris.scale.multiplyScalar(glbUnitScale);
      glbIris.position.multiplyScalar(glbUnitScale);
      gazePivot.add(glbIris);
    }
    if (glbPupil) {
      glbPupil.scale.multiplyScalar(glbUnitScale);
      glbPupil.position.multiplyScalar(glbUnitScale);
      gazePivot.add(glbPupil);
      ud.pupil = glbPupil;
    }

    // 3. Merged Tarnished-Bronze Optic Bezel & Rear Harness (1 draw call!)
    // Note: `extractGlbGeosByMat(hNode, ...)` is in `hNode` local space, so transform by `hNode.position * glbUnitScale`
    const mergedCollarGeo = cached('geo:eyeCollarMergedGlb', () => {
      const hNode = glbTemplate.getObjectByName('harness_ring');
      const hParts = extractGlbGeosByMat(hNode, [
        'mat_metal',
        'mat_bronze',
        'mat_brass',
        'mat_bezel',
      ]);
      // If `.glb` `harness_ring` already includes the front iris bezel (`#218`), merge rear riveted socket + `.glb` harness!
      const parts = [];
      if (hParts.length > 0) {
        for (let k = 0; k < hParts.length; k++) {
          hParts[k].scale(glbUnitScale, glbUnitScale, glbUnitScale);
          if (hNode) {
            hParts[k].translate(
              hNode.position.x * glbUnitScale,
              hNode.position.y * glbUnitScale,
              hNode.position.z * glbUnitScale
            );
          }
          parts.push(hParts[k]);
        }
        parts.push(getEyeCollarArmorGeo().clone());
      } else {
        parts.push(getEyeCollarArmorGeo().clone());
      }
      return mergePartsClean(parts);
    });
    body.add(new THREE.Mesh(mergedCollarGeo, collarArmorMat));

    // 4. Dual Alternating Spider-Gait Tripod Tendril Meshes (2 draw calls!)
    const tripodA = new THREE.Mesh(buildMergedTripod(0, true), tendrilMat);
    const tripodB = new THREE.Mesh(buildMergedTripod(1, true), tendrilMat);
    body.add(tripodA, tripodB);
    ud.tripodA = tripodA;
    ud.tripodB = tripodB;
  } else {
    const scleraMat = cached(
      'mat:rebootScleraFallback',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#e5dfd5',
          map: scleraMaps.map,
          bumpMap: scleraMaps.bumpMap,
          bumpScale: 0.018,
          roughness: 0.17,
          clearcoat: 0.78,
          clearcoatRoughness: 0.1,
          envMap: chromeEnv || null,
          envMapIntensity: 0.92,
        })
    );
    const scleraGeo = cached('geo:rebootScleraSphere', () => {
      const s = new THREE.SphereGeometry(0.264, 28, 20);
      s.rotateY(-Math.PI * 0.5);
      return s;
    });
    body.add(new THREE.Mesh(scleraGeo, scleraMat));
    body.add(new THREE.Mesh(getEyeCollarArmorGeo(), collarArmorMat));

    const irisMat = cached(
      'mat:rebootIrisFallback',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#3cf5e4',
          map: irisTex,
          emissive: new THREE.Color('#14e8d8'),
          emissiveMap: irisTex,
          emissiveIntensity: 1.42,
          roughness: 0.06,
          clearcoat: 1.0,
        })
    );
    const irisMesh = new THREE.Mesh(
      cached('geo:rebootIrisDisc', () => {
        const s = new THREE.SphereGeometry(0.146, 20, 12);
        s.scale(1, 1, 0.56);
        return s;
      }),
      irisMat
    );
    irisMesh.position.z = 0.19;

    const pupilMesh = new THREE.Mesh(
      cached('geo:rebootPupilDisc', () => {
        const s = new THREE.SphereGeometry(0.076, 16, 10);
        s.scale(1, 1, 0.5);
        return s;
      }),
      cached('mat:origPupil', () => new THREE.MeshBasicMaterial({ color: '#020409' }))
    );
    pupilMesh.position.z = 0.236;
    gazePivot.add(irisMesh, pupilMesh);
    ud.pupil = pupilMesh;

    const tripodA = new THREE.Mesh(buildMergedTripod(0, false), tendrilMat);
    const tripodB = new THREE.Mesh(buildMergedTripod(1, false), tendrilMat);
    body.add(tripodA, tripodB);
    ud.tripodA = tripodA;
    ud.tripodB = tripodB;
  }

  gazePivot.add(new THREE.Mesh(mergedOrigGlintsGeo, glintMat));
  ud.calibScale = 1.42;
  body.scale.setScalar(ud.calibScale);

  ud.gazePivot = gazePivot;
  root.userData = ud;
  return root;
}

function buildMoleculeRig(isOrig, chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const glowTex = getSoftGlowTex();
  const ud = {
    family: FAM_MOLECULE,
    isOrig,
    body,
    coreMesh: null,
    innerCluster: null,
    orbitRingA: null,
    orbitRingB: null,
    origAtoms: [],
    haloTight: null,
    cryoIce: buildCryoIceNode(chromeEnv),
    glbMaskBit: isOrig ? 0 : _glbReadyMask & (1 << FAM_MOLECULE),
  };
  root.add(ud.cryoIce);

  if (isOrig) {
    // 2007–2010 XBLA HD Classic Atomic Bonker Molecule (6 draw calls total!)
    const coreMesh = new THREE.Mesh(
      cached('geo:origMolCore', () => new THREE.SphereGeometry(0.135, 20, 16)),
      cached('mat:origMolCore', () => new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    );
    body.add(coreMesh);

    const mergedRingsGeo = cached('geo:origMolMergedRings', () => {
      const parts = [];
      const m = new THREE.Matrix4();
      const e = new THREE.Euler();
      for (let i = 0; i < 3; i++) {
        const t = stripPosNormal(new THREE.TorusGeometry(0.255, 0.009, 6, 36));
        e.set(1.08, 0, (i * TWO_PI) / 3, 'ZXY');
        m.makeRotationFromEuler(e);
        t.applyMatrix4(m);
        parts.push(t);
      }
      return mergePartsClean(parts);
    });
    const ringMat = cached(
      'mat:origMolRing',
      () =>
        new THREE.MeshBasicMaterial({
          color: '#e9d5ff',
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
    );
    const ringsSpin = new THREE.Mesh(mergedRingsGeo, ringMat);
    body.add(ringsSpin);
    ud.innerCluster = ringsSpin;

    const atomHexes = ['#ff2277', '#00e5ff', '#ffcc00'];
    const atomSphereGeo = cached('geo:origMolAtom', () => new THREE.SphereGeometry(0.095, 18, 14));

    for (let i = 0; i < 3; i++) {
      const plane = new THREE.Group();
      plane.rotation.set(1.08, 0, (i * TWO_PI) / 3, 'ZXY');
      const aMat = cached(
        'mat:origAtom:' + i,
        () =>
          new THREE.MeshPhysicalMaterial({
            color: atomHexes[i],
            emissive: new THREE.Color(atomHexes[i]),
            emissiveIntensity: 0.68,
            roughness: 0.08,
            metalness: 0.15,
            clearcoat: 1.0,
            envMap: chromeEnv || null,
          })
      );
      const atom = new THREE.Mesh(atomSphereGeo, aMat);
      plane.add(atom);
      body.add(plane);
      ud.origAtoms.push({ plane, atom, phase: (i * TWO_PI) / 3, speed: 1 + i * 0.16 });
    }

    const haloTight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#f472b6',
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    haloTight.scale.set(0.95, 0.95, 1);
    body.add(haloTight);

    ud.coreMesh = coreMesh;
    ud.haloTight = haloTight;
    root.userData = ud;
    return root;
  }

  // REBOOT (`era === 'reboot'`): Tight Faceted Dark-Violet Amethyst Cluster (`media_1794884512715_2296550d.jpg` — 5 draw calls total!)
  const crystalMat = cached(
    'mat:rebootAmethystShard',
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#2d0c5e',
        emissive: new THREE.Color('#5b21b6'),
        emissiveIntensity: 0.28,
        roughness: 0.16,
        metalness: 0.16,
        clearcoat: 0.96,
        clearcoatRoughness: 0.04,
        iridescence: 0.72,
        iridescenceIOR: 1.5,
        transparent: true,
        opacity: 0.95,
        flatShading: true,
        envMap: chromeEnv || null,
        envMapIntensity: 1.4,
      })
  );

  const innerCluster = new THREE.Group();
  body.add(innerCluster);

  const glbTemplate = _glbTemplates[FAM_MOLECULE];
  if (glbTemplate) {
    const clone = glbTemplate.clone(true);
    const molRoot = clone.getObjectByName('MoleculeRoot');
    if (molRoot) molRoot.scale.set(1, 1, 1);
    const clMeasure = clone.getObjectByName('crystal_cluster');
    let localSpanY = 0;
    if (clMeasure) {
      clMeasure.traverse((o) => {
        if (o.isMesh && o.geometry) {
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          if (bb) localSpanY = Math.max(localSpanY, (bb.max.y - bb.min.y) * o.scale.y);
        }
      });
    }
    const glbUnitScale = localSpanY > 0.2 ? 0.71 / localSpanY : 1.0;

    const glbCore = clone.getObjectByName('core');
    if (glbCore) {
      glbCore.scale.setScalar(0.76 * glbUnitScale);
      glbCore.position.multiplyScalar(glbUnitScale);
      body.add(glbCore);
      ud.coreMesh = glbCore;
    }
    clone.scale.setScalar(glbUnitScale);
    innerCluster.add(clone);
  } else {
    const coreMesh = new THREE.Mesh(
      cached('geo:rebootMolCore', () => new THREE.SphereGeometry(0.098, 18, 14)),
      cached(
        'mat:rebootMolCoreHdr',
        () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.55, 1.85, 2.8) })
      )
    );
    body.add(coreMesh);
    ud.coreMesh = coreMesh;

    const clusterMesh = new THREE.Mesh(getAmethystClusterFallbackGeo(), crystalMat);
    innerCluster.add(clusterMesh);
  }

  const ringShardGeo = cached('geo:rebootMolSatelliteTriad', () => {
    const baseShard = getCrystalShardGeo();
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * TWO_PI) / 3;
      const s = baseShard.clone();
      s.scale(0.84, 0.92, 0.84);
      s.rotateZ(a - Math.PI * 0.5);
      s.translate(Math.cos(a) * 0.245, Math.sin(a) * 0.245, 0);
      parts.push(s);
    }
    return mergePartsClean(parts);
  });

  const orbitRingA = new THREE.Mesh(ringShardGeo, crystalMat);
  orbitRingA.rotation.x = 0.62;
  const orbitRingB = new THREE.Mesh(ringShardGeo, crystalMat);
  orbitRingB.rotation.set(-0.68, 0.52, 0);
  body.add(orbitRingA, orbitRingB);

  // Compact incandescent white-magenta core star sprite (keeps outer dark-violet shards crisp & un-washed!)
  const haloTight = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getMoleculeDualHaloTex(),
      color: new THREE.Color(1.45, 0.52, 1.85),
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  haloTight.scale.set(0.68, 0.68, 1);
  haloTight.position.z = 0.15;
  body.add(haloTight);

  ud.calibScale = 1.12;
  body.scale.setScalar(ud.calibScale);

  ud.innerCluster = innerCluster;
  ud.orbitRingA = orbitRingA;
  ud.orbitRingB = orbitRingB;
  ud.haloTight = haloTight;
  root.userData = ud;
  return root;
}

function buildRollerRig(isOrig, chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const glowTex = getSoftGlowTex();
  const wheelSpin = new THREE.Group();
  const yokeGroup = new THREE.Group();
  body.add(wheelSpin, yokeGroup);

  const ud = {
    family: FAM_ROLLER,
    isOrig,
    body,
    wheelSpin,
    yokeGroup,
    furnaceVent: null,
    halo: null,
    cryoIce: buildCryoIceNode(chromeEnv),
    glbMaskBit: isOrig ? 0 : _glbReadyMask & (1 << FAM_ROLLER),
  };
  root.add(ud.cryoIce);

  if (isOrig) {
    // 2007–2010 XBLA HD Mirror-Chrome & Candy-Gold Pinball Roller (4 draw calls total!)
    const chromeShell = new THREE.Mesh(
      cached('geo:origRollerSphere', () => new THREE.SphereGeometry(0.265, 22, 16)),
      cached(
        'mat:origRollerChrome',
        () =>
          new THREE.MeshPhysicalMaterial({
            color: '#f1f5f9',
            metalness: 0.92,
            roughness: 0.08,
            clearcoat: 1.0,
            envMap: chromeEnv || null,
            envMapIntensity: 1.55,
          })
      )
    );
    const candySpikes = new THREE.Mesh(
      getRollerArmorSpikesGeo(),
      cached(
        'mat:origRollerGold',
        () =>
          new THREE.MeshPhysicalMaterial({
            color: '#f59e0b',
            emissive: new THREE.Color('#b45309'),
            emissiveIntensity: 0.25,
            metalness: 0.85,
            roughness: 0.14,
            clearcoat: 1.0,
            envMap: chromeEnv || null,
          })
      )
    );
    const ventRing = new THREE.Mesh(
      cached('geo:origRollerBand', () => new THREE.TorusGeometry(0.266, 0.028, 8, 28)),
      new THREE.MeshBasicMaterial({ color: '#ff3b30' })
    );
    wheelSpin.add(chromeShell, candySpikes, ventRing);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#fb923c',
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.set(0.82, 0.82, 1);
    body.add(halo);

    ud.furnaceVent = ventRing;
    ud.halo = halo;
    root.userData = ud;
    return root;
  }

  // REBOOT (`era === 'reboot'`): Merged 5-Draw-Call Spiked Furnace Sphere!
  const brassMat = cached(
    'mat:rebootBrass',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c89238',
        metalness: 0.88,
        roughness: 0.26,
        envMap: chromeEnv || null,
      })
  );
  const ironMat = cached(
    'mat:rebootCastIron',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2e3545',
        metalness: 0.86,
        roughness: 0.34,
        envMap: chromeEnv || null,
      })
  );
  const furnaceMat = cached(
    'mat:rebootFurnaceMat',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ff4d00',
        emissive: new THREE.Color('#ff3d00'),
        emissiveIntensity: 1.65,
        roughness: 0.2,
      })
  );

  const glbTemplate = _glbTemplates[FAM_ROLLER];
  const hasGlb = Boolean(glbTemplate);

  const mergedIronGeo = cached(`geo:rollerIronMerged:${hasGlb ? 1 : 0}`, () => {
    const parts = [
      stripPosNormal(new THREE.TorusGeometry(0.262, 0.022, 6, 24)),
    ];
    const r2 = stripPosNormal(new THREE.TorusGeometry(0.262, 0.022, 6, 24));
    r2.rotateX(Math.PI * 0.5);
    const r3 = stripPosNormal(new THREE.TorusGeometry(0.262, 0.022, 6, 24));
    r3.rotateY(Math.PI * 0.5);
    parts.push(r2, r3);

    if (hasGlb) {
      parts.push(...extractGlbGeosByMat(glbTemplate, 'mat_iron'));
    } else {
      const hT = stripPosNormal(
        new THREE.SphereGeometry(0.268, 20, 10, 0, TWO_PI, 0, Math.PI * 0.41)
      );
      hT.rotateX(Math.PI * 0.5);
      const hB = stripPosNormal(
        new THREE.SphereGeometry(0.268, 20, 10, 0, TWO_PI, 0, Math.PI * 0.41)
      );
      hB.rotateX(-Math.PI * 0.5);
      parts.push(hT, hB);
    }
    return mergePartsClean(parts);
  });

  const mergedBrassGeo = cached(`geo:rollerBrassMerged:${hasGlb ? 1 : 0}`, () => {
    const parts = [getRollerArmorSpikesGeo().clone()];
    if (hasGlb) {
      parts.push(...extractGlbGeosByMat(glbTemplate, 'mat_brass'));
    }
    return mergePartsClean(parts);
  });

  const mergedFurnaceGeo = cached(`geo:rollerFurnaceMerged:${hasGlb ? 1 : 0}`, () => {
    const parts = [stripPosNormal(new THREE.TorusGeometry(0.242, 0.026, 8, 24))];
    if (hasGlb) {
      parts.push(...extractGlbGeosByMat(glbTemplate, 'mat_furnace'));
    } else {
      parts.push(stripPosNormal(new THREE.SphereGeometry(0.232, 18, 14)));
    }
    return mergePartsClean(parts);
  });

  wheelSpin.add(
    new THREE.Mesh(mergedIronGeo, ironMat),
    new THREE.Mesh(mergedBrassGeo, brassMat),
    new THREE.Mesh(mergedFurnaceGeo, furnaceMat)
  );
  yokeGroup.add(new THREE.Mesh(getRollerYokeGeo(), ironMat));

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ff7b00',
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.set(0.95, 0.95, 1);
  body.add(halo);

  ud.halo = halo;
  root.userData = ud;
  return root;
}

function buildBouncerRig(isOrig, chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const glowTex = getSoftGlowTex();
  const contactPivot = new THREE.Group();
  contactPivot.position.y = -0.26;
  body.add(contactPivot);

  const springBase = new THREE.Group();
  springBase.position.y = 0.26;
  const sacGroup = new THREE.Group();
  sacGroup.position.y = 0.26;
  contactPivot.add(springBase, sacGroup);

  const ud = {
    family: FAM_BOUNCER,
    isOrig,
    body,
    contactPivot,
    springBase,
    sacGroup,
    bioNucleus: null,
    halo: null,
    cryoIce: buildCryoIceNode(chromeEnv),
    glbMaskBit: isOrig ? 0 : _glbReadyMask & (1 << FAM_BOUNCER),
  };
  root.add(ud.cryoIce);

  if (isOrig) {
    // 2007–2010 XBLA HD Candy-Magenta Arcade Spring-Orb (6 draw calls total!)
    const candyMat = cached(
      'mat:origBouncerCandy',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#e11d48',
          emissive: new THREE.Color('#881337'),
          emissiveIntensity: 0.35,
          roughness: 0.08,
          metalness: 0.08,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          envMap: chromeEnv || null,
          envMapIntensity: 1.4,
        })
    );
    const stripeMat = cached(
      'mat:origBouncerStripe',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#facc15',
          roughness: 0.12,
          clearcoat: 1.0,
        })
    );
    const chromeMat = cached(
      'mat:origChrome',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#e2e8f0',
          metalness: 0.94,
          roughness: 0.08,
          clearcoat: 1.0,
          envMap: chromeEnv || null,
        })
    );

    const orb = new THREE.Mesh(
      cached('geo:origBouncerOrb', () => new THREE.SphereGeometry(0.245, 22, 16)),
      candyMat
    );
    orb.position.y = 0.03;
    const stripe = new THREE.Mesh(
      cached('geo:origBouncerBelt', () => new THREE.TorusGeometry(0.238, 0.024, 8, 28)),
      stripeMat
    );
    stripe.rotation.x = Math.PI * 0.42;
    stripe.position.y = 0.03;

    const mergedEyeWhite = new THREE.Mesh(
      cached('geo:origBncEyeW2', () => {
        const l = stripPosNormal(new THREE.SphereGeometry(0.052, 12, 10));
        l.translate(-0.078, 0.068, 0.205);
        const r = stripPosNormal(new THREE.SphereGeometry(0.052, 12, 10));
        r.translate(0.078, 0.068, 0.205);
        return mergePartsClean([l, r]);
      }),
      cached('mat:glintWhite', () => new THREE.MeshBasicMaterial({ color: '#ffffff' }))
    );
    const mergedEyePupil = new THREE.Mesh(
      cached('geo:origBncEyeP2', () => {
        const l = stripPosNormal(new THREE.SphereGeometry(0.026, 10, 8));
        l.translate(-0.078, 0.068, 0.248);
        const r = stripPosNormal(new THREE.SphereGeometry(0.026, 10, 8));
        r.translate(0.078, 0.068, 0.248);
        return mergePartsClean([l, r]);
      }),
      cached('mat:origPupil', () => new THREE.MeshBasicMaterial({ color: '#020617' }))
    );
    sacGroup.add(orb, stripe, mergedEyeWhite, mergedEyePupil);

    const springCoil = new THREE.Mesh(
      cached('geo:origBouncerSpring', () => new THREE.CylinderGeometry(0.14, 0.18, 0.14, 14)),
      chromeMat
    );
    springCoil.position.y = -0.19;
    springBase.add(springCoil);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#fb7185',
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.set(0.85, 0.85, 1);
    body.add(halo);

    ud.halo = halo;
    root.userData = ud;
    return root;
  }

  // REBOOT (`era === 'reboot'`): Bioluminescent Spore-Jelly / Armored Spring-Orb (6 draw calls total!)
  const glbTemplate = _glbTemplates[FAM_BOUNCER];
  const hasGlb = Boolean(glbTemplate);
  const sporeCoreMat = cached(
    'mat:rebootSporeCoreMerged',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ecfccb',
        emissive: new THREE.Color('#bef264'),
        emissiveIntensity: 1.35,
        roughness: 0.12,
      })
  );

  if (hasGlb) {
    const clone = glbTemplate.clone(true);
    const glbSac = clone.getObjectByName('spore_sac');
    const glbBase = clone.getObjectByName('base_claws');
    if (glbSac) {
      // Remove unmerged `mat_core` child and merge it with internal `bioNucleus`!
      const toRem = [];
      glbSac.traverse((o) => {
        if (o.isMesh && (o.material?.name === 'mat_core')) toRem.push(o);
      });
      for (let r = 0; r < toRem.length; r++) toRem[r].parent?.remove(toRem[r]);
      sacGroup.add(glbSac);
    }
    if (glbBase) springBase.add(glbBase);
  } else {
    const sporeMat = cached(
      'mat:rebootSporeFallback',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#84cc16',
          emissive: new THREE.Color('#4d7c0f'),
          emissiveIntensity: 0.78,
          roughness: 0.14,
          clearcoat: 1.0,
          transparent: true,
          opacity: 0.84,
          envMap: chromeEnv || null,
        })
    );
    const sacMesh = new THREE.Mesh(
      cached('geo:rebootSporeDome', () => {
        const s = new THREE.SphereGeometry(0.245, 20, 14);
        s.scale(1, 0.88, 1);
        return s;
      }),
      sporeMat
    );
    sacMesh.position.y = 0.045;
    sacGroup.add(sacMesh);

    const clawBaseGeo = cached('geo:rebootClawBaseFallback', () => {
      const parts = [];
      const collar = stripPosNormal(new THREE.CylinderGeometry(0.225, 0.205, 0.075, 14));
      collar.translate(0, -0.06, 0);
      parts.push(collar);
      const coil = stripPosNormal(new THREE.TorusGeometry(0.135, 0.026, 6, 16));
      coil.rotateX(Math.PI * 0.5);
      coil.translate(0, -0.15, 0);
      parts.push(coil);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TWO_PI + 0.78;
        const claw = stripPosNormal(new THREE.ConeGeometry(0.032, 0.18, 5));
        claw.rotateX(Math.PI);
        claw.rotateZ(0.28);
        claw.translate(0.2, -0.16, 0);
        claw.rotateY(a);
        parts.push(claw);
      }
      return mergePartsClean(parts);
    });
    springBase.add(
      new THREE.Mesh(
        clawBaseGeo,
        cached(
          'mat:rebootCastIron',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#2e3545',
              metalness: 0.86,
              roughness: 0.34,
              envMap: chromeEnv || null,
            })
        )
      )
    );
  }

  const bioNucleus = new THREE.Mesh(
    cached(`geo:bouncerCoreMerged:${hasGlb ? 1 : 0}`, () => {
      const nuc = stripPosNormal(new THREE.IcosahedronGeometry(0.105, 1));
      nuc.translate(0, 0.065, 0.01);
      const parts = [nuc];
      if (hasGlb) {
        const sacNode = glbTemplate.getObjectByName('spore_sac');
        parts.push(...extractGlbGeosByMat(sacNode, 'mat_core'));
      }
      return mergePartsClean(parts);
    }),
    sporeCoreMat
  );
  sacGroup.add(bioNucleus);

  const predatorEyes = new THREE.Mesh(
    cached('geo:rebootBouncerEyes', () => {
      const eL = stripPosNormal(new THREE.SphereGeometry(0.032, 10, 8));
      eL.scale(1.25, 0.85, 0.7);
      eL.translate(-0.078, -0.035, 0.218);
      const eR = stripPosNormal(new THREE.SphereGeometry(0.032, 10, 8));
      eR.scale(1.25, 0.85, 0.7);
      eR.translate(0.078, -0.035, 0.218);
      return mergePartsClean([eL, eR]);
    }),
    cached('mat:rebootBouncerEyeGlow', () => new THREE.MeshBasicMaterial({ color: '#fde047' }))
  );
  springBase.add(predatorEyes);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#a3e635',
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.set(0.95, 0.95, 1);
  halo.position.y = 0.04;
  body.add(halo);

  body.scale.setScalar(1.06);

  ud.bioNucleus = bioNucleus;
  ud.halo = halo;
  root.userData = ud;
  return root;
}

function buildRobotRig(isOrig, chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const rotorTopGroup = new THREE.Group();
  rotorTopGroup.position.y = 0.275;
  const rotorBotGroup = new THREE.Group();
  rotorBotGroup.position.y = -0.21;
  body.add(rotorTopGroup, rotorBotGroup);

  const ud = {
    family: FAM_ROBOT,
    isOrig,
    body,
    rotorTopGroup,
    rotorBotGroup,
    visorEye: null,
    thrusterPlume: null,
    shortSpark: null,
    cryoIce: buildCryoIceNode(chromeEnv),
    glbMaskBit: isOrig ? 0 : _glbReadyMask & (1 << FAM_ROBOT),
  };
  root.add(ud.cryoIce);

  const mergedPlumeGeo = cached('geo:robotMergedPlume', () => {
    const c = stripPosNormal(new THREE.ConeGeometry(0.078, 0.24, 10));
    c.rotateX(Math.PI);
    c.translate(0, -0.12, 0);
    const r = stripPosNormal(new THREE.TorusGeometry(0.068, 0.014, 6, 16));
    r.rotateX(Math.PI * 0.5);
    r.translate(0, -0.055, 0);
    return mergePartsClean([c, r]);
  });

  if (isOrig) {
    // 2007–2010 XBLA HD Mirror-Chrome & Cobalt-Blue Sentinel Droid (6 draw calls total!)
    const chromeMat = cached(
      'mat:origChrome',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#e2e8f0',
          metalness: 0.94,
          roughness: 0.08,
          clearcoat: 1.0,
          envMap: chromeEnv || null,
          envMapIntensity: 1.5,
        })
    );
    const cobaltMat = cached(
      'mat:origRobotCobalt',
      () =>
        new THREE.MeshPhysicalMaterial({
          color: '#2563eb',
          metalness: 0.45,
          roughness: 0.14,
          clearcoat: 1.0,
          envMap: chromeEnv || null,
        })
    );

    const chassis = new THREE.Mesh(
      cached('geo:origRobotChassisMerged', () => {
        const cap = stripPosNormal(new THREE.CapsuleGeometry(0.195, 0.16, 10, 18));
        const eL = stripPosNormal(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 12));
        eL.rotateZ(Math.PI * 0.5);
        eL.translate(-0.205, 0.05, 0);
        const eR = stripPosNormal(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 12));
        eR.rotateZ(Math.PI * 0.5);
        eR.translate(0.205, 0.05, 0);
        return mergePartsClean([cap, eL, eR]);
      }),
      chromeMat
    );
    const belt = new THREE.Mesh(
      cached('geo:origRobotBelt', () => new THREE.CylinderGeometry(0.208, 0.208, 0.1, 18)),
      cobaltMat
    );
    const visorBand = new THREE.Mesh(
      cached('geo:origRobotVisor', () =>
        new THREE.CylinderGeometry(0.206, 0.206, 0.062, 16, 1, false, -0.75, 1.5)
      ),
      cached('mat:origPupil', () => new THREE.MeshBasicMaterial({ color: '#090d16' }))
    );
    visorBand.position.y = 0.07;
    body.add(chassis, belt, visorBand);

    rotorTopGroup.add(new THREE.Mesh(getRobotTurbineBladesGeo(0.18, 4, 0.32), chromeMat));
    rotorBotGroup.add(new THREE.Mesh(getRobotTurbineBladesGeo(0.15, 4, -0.32), chromeMat));

    const visorEye = new THREE.Mesh(
      cached('geo:robotScannerBead', () => new THREE.SphereGeometry(0.036, 10, 8)),
      new THREE.MeshBasicMaterial({ color: '#00f0ff' })
    );
    visorEye.position.set(0, 0.07, 0.208);
    body.add(visorEye);

    const thrusterPlume = new THREE.Mesh(
      mergedPlumeGeo,
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    thrusterPlume.position.y = -0.24;
    body.add(thrusterPlume);

    ud.visorEye = visorEye;
    ud.thrusterPlume = thrusterPlume;
    root.userData = ud;
    return root;
  }

  // REBOOT (`era === 'reboot'`): Merged 7-Draw-Call Brass-and-Iron Clockwork Sentinel!
  const brassMat = cached(
    'mat:rebootBrass',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c89238',
        metalness: 0.88,
        roughness: 0.26,
        envMap: chromeEnv || null,
      })
  );
  const ironMat = cached(
    'mat:rebootCastIron',
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2e3545',
        metalness: 0.86,
        roughness: 0.34,
        envMap: chromeEnv || null,
      })
  );

  const glbTemplate = _glbTemplates[FAM_ROBOT];
  const hasGlb = Boolean(glbTemplate);

  if (hasGlb) {
    const bodyClone = glbTemplate.getObjectByName('body')?.clone(true);
    const visorClone = glbTemplate.getObjectByName('visor')?.clone(true);
    if (bodyClone) body.add(bodyClone);
    if (visorClone) body.add(visorClone);
  } else {
    const hull = new THREE.Mesh(
      cached('geo:rebootRobotHullFallback', () => {
        const top = stripPosNormal(new THREE.CylinderGeometry(0.16, 0.23, 0.22, 14));
        top.translate(0, 0.12, 0);
        const bot = stripPosNormal(new THREE.CylinderGeometry(0.23, 0.14, 0.2, 14));
        bot.translate(0, -0.09, 0);
        return mergePartsClean([top, bot]);
      }),
      brassMat
    );
    const armorBand = new THREE.Mesh(
      cached('geo:rebootRobotBandFallback', () => new THREE.CylinderGeometry(0.236, 0.236, 0.11, 14)),
      ironMat
    );
    armorBand.position.y = 0.07;
    const visorSlot = new THREE.Mesh(
      cached('geo:rebootRobotVisorSlot', () =>
        new THREE.CylinderGeometry(0.242, 0.242, 0.052, 14, 1, false, -0.7, 1.4)
      ),
      cached('mat:rebootVisorTrack', () => new THREE.MeshBasicMaterial({ color: '#4c0519' }))
    );
    visorSlot.position.y = 0.08;
    body.add(hull, armorBand, visorSlot);
  }

  const topRotorGeo = cached(`geo:robotRotorTopMerged:${hasGlb ? 1 : 0}`, () => {
    const parts = [getRobotTurbineBladesGeo(0.225, 4, 0.36).clone()];
    if (hasGlb) {
      const rTop = glbTemplate.getObjectByName('rotor_top');
      const glbParts = extractGlbGeosByMat(rTop, 'mat_brass');
      for (let i = 0; i < glbParts.length; i++) {
        glbParts[i].translate(0, -0.275, 0);
        parts.push(glbParts[i]);
      }
    }
    return mergePartsClean(parts);
  });

  const botRotorGeo = cached(`geo:robotRotorBotMerged:${hasGlb ? 1 : 0}`, () => {
    const parts = [getRobotTurbineBladesGeo(0.185, 4, -0.36).clone()];
    if (hasGlb) {
      const rBot = glbTemplate.getObjectByName('rotor_bot');
      const glbParts = extractGlbGeosByMat(rBot, 'mat_iron');
      for (let i = 0; i < glbParts.length; i++) {
        glbParts[i].translate(0, 0.21, 0);
        parts.push(glbParts[i]);
      }
    }
    return mergePartsClean(parts);
  });

  rotorTopGroup.add(new THREE.Mesh(topRotorGeo, brassMat));
  rotorBotGroup.add(new THREE.Mesh(botRotorGeo, ironMat));

  const visorEye = new THREE.Mesh(
    cached('geo:robotScannerBead', () => new THREE.SphereGeometry(0.036, 10, 8)),
    new THREE.MeshBasicMaterial({ color: '#ff3b5c' })
  );
  visorEye.position.set(0, 0.08, 0.246);
  body.add(visorEye);

  const thrusterPlume = new THREE.Mesh(
    mergedPlumeGeo,
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  thrusterPlume.position.y = -0.255;
  body.add(thrusterPlume);

  const shortSpark = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getShockRingTex(),
      color: '#fde047',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  shortSpark.scale.set(0.62, 0.62, 1);
  shortSpark.visible = false;
  body.add(shortSpark);

  body.scale.setScalar(1.06);

  ud.visorEye = visorEye;
  ud.thrusterPlume = thrusterPlume;
  ud.shortSpark = shortSpark;
  root.userData = ud;
  return root;
}

function applyCreatureShadowFlags(rig) {
  const ud = rig.userData;
  if (!ud || !ud.body) return;
  const skipGaze = ud.family === FAM_EYE ? ud.gazePivot : null;
  const skipNuc = ud.family === FAM_BOUNCER ? ud.bioNucleus : null;

  ud.body.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const m = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (!m || m.isMeshBasicMaterial) return;
    if (m.depthWrite === false || m.blending === THREE.AdditiveBlending) return;

    let insideSkip = obj === skipNuc;
    if (!insideSkip && skipGaze) {
      let p = obj.parent;
      while (p) {
        if (p === skipGaze) {
          insideSkip = true;
          break;
        }
        p = p.parent;
      }
    }
    if (insideSkip) return;

    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

function createRigByBucket(famId, isOrig, chromeEnv) {
  let rig;
  switch (famId) {
    case FAM_EYE:
      rig = buildEyeRig(isOrig, chromeEnv);
      break;
    case FAM_MOLECULE:
      rig = buildMoleculeRig(isOrig, chromeEnv);
      break;
    case FAM_ROLLER:
      rig = buildRollerRig(isOrig, chromeEnv);
      break;
    case FAM_BOUNCER:
      rig = buildBouncerRig(isOrig, chromeEnv);
      break;
    case FAM_ROBOT:
    default:
      rig = buildRobotRig(isOrig, chromeEnv);
      break;
  }
  applyCreatureShadowFlags(rig);
  return rig;
}

// ============================================================================
// Public Class: `EnemyVisualPool`
// ============================================================================

export class EnemyVisualPool {
  /**
   * @param {THREE.Scene | THREE.Object3D} scene
   * @param {{ chromeEnv?: THREE.Texture | null }} [opts]
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.chromeEnv = opts.chromeEnv || null;
    this.era = 'reboot';

    this.root = new THREE.Group();
    this.root.name = 'EnemyVisualPoolRoot';
    if (this.scene) this.scene.add(this.root);

    ensureEnemyGlbsLoading(this.chromeEnv);

    // 10 type-buckets: [0..4] = reboot families, [5..9] = original families
    this._buckets = Array.from({ length: FAMILY_COUNT * 2 }, () => []);
    this._cursors = new Int32Array(FAMILY_COUNT * 2);

    // Per-enemy-object animation continuity state (allocated once per spawned enemy)
    this._animStates = new WeakMap();

    // Fixed 2-PointLight pool: ALWAYS `visible = true` -> ZERO Three.js shader recompilations!
    this._dynLights = [];
    for (let i = 0; i < DYNAMIC_LIGHT_SLOTS; i++) {
      const pl = new THREE.PointLight('#c026ff', 0, 5.8, 1.6);
      pl.position.set(0, -9999, 0);
      this.root.add(pl);
      this._dynLights.push(pl);
    }

    // Pooled shatter / pop shockwave sprites for crisp enemy kills
    this._deathBursts = [];
    const shockTex = getShockRingTex();
    for (let i = 0; i < DEATH_BURST_SLOTS; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: shockTex,
          color: '#7dd3fc',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sp.visible = false;
      this.root.add(sp);
      this._deathBursts.push({ sprite: sp, timer: 0, duration: 0.28, x: 0, y: 0, z: 0 });
    }
    this._burstCursor = 0;
    this._lastTime = null;
    this._inReflection = false;
  }

  /**
   * Switches between `'reboot'` (2026 dark-cinematic PBR + `.glb` creature rigs)
   * and `'original'` (2007–2010 XBLA glossy chrome/candy arcade rigs & classic 7800 proportions).
   * @param {string} era
   */
  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    if (this.era === next) return;
    this.era = next;
  }

  /**
   * Toggles enemy visibility during planar ocean reflection passes (`0` reflection draw calls).
   * @param {boolean} isRefl
   */
  setReflectionPass(isRefl) {
    this._inReflection = Boolean(isRefl);
    if (this.root) this.root.visible = !this._inReflection;
  }

  _getEnemyState(en, idx) {
    let st = this._animStates.get(en);
    if (!st) {
      const seed = (((idx + 1) * 2654435761) >>> 0) / 4294967296;
      st = {
        seed,
        prevCol: en.col ?? 0,
        prevFloor: en.floor ?? 0,
        rollAngle: seed * TWO_PI,
        stepPhase: seed * TWO_PI,
        vy: 0,
        lookYaw: 0,
        lookPitch: 0,
        blinkTimer: 1.2 + seed * 2.8,
        blinkClock: 0,
        wasStunned: false,
        icePopT: 0,
        landed: false,
        wobbleT: 9,
        wasAlive: !en.dead,
        deathMax: 0,
        lastX: 0,
        lastY: 0,
        lastZ: 0,
      };
      this._animStates.set(en, st);
    }
    return st;
  }

  _acquireSlot(famId, isOrig) {
    const bIdx = (isOrig ? FAMILY_COUNT : 0) + famId;
    const bucket = this._buckets[bIdx];
    const cur = this._cursors[bIdx];
    this._cursors[bIdx] = cur + 1;

    const wantMask = isOrig ? 0 : _glbReadyMask & (1 << famId);
    if (cur < bucket.length) {
      let node = bucket[cur];
      // Seamless one-time hot-upgrade when async Blender `.glb` finishes loading!
      if (!isOrig && node.userData.glbMaskBit !== wantMask) {
        this.root.remove(node);
        node = createRigByBucket(famId, false, this.chromeEnv);
        this.root.add(node);
        bucket[cur] = node;
      }
      return node;
    }

    const node = createRigByBucket(famId, isOrig, this.chromeEnv);
    this.root.add(node);
    bucket.push(node);
    return node;
  }

  _spawnDeathBurst(x, y, z, hexColor) {
    const b = this._deathBursts[this._burstCursor];
    this._burstCursor = (this._burstCursor + 1) % DEATH_BURST_SLOTS;
    b.timer = b.duration;
    b.x = x;
    b.y = y;
    b.z = z;
    b.sprite.material.color.set(hexColor);
    b.sprite.position.set(x, y, z);
    b.sprite.scale.setScalar(0.28);
    b.sprite.material.opacity = 0.95;
    b.sprite.visible = true;
  }

  /**
   * Updates and poses all active enemies for the current frame with zero GC allocations.
   *
   * @param {Array<object>} enemies
   * @param {number} camCol
   * @param {number} fh
   * @param {number} towerRadius
   * @param {number} time
   * @param {number} [toppleDropY=0]
   */
  syncEnemies(enemies, camCol, fh, towerRadius, time, toppleDropY = 0) {
    const t = Number(time) || 0;
    let dt = this._lastTime !== null ? t - this._lastTime : 1 / 60;
    this._lastTime = t;
    if (!(dt > 0) || dt > 0.1) dt = 1 / 60;

    const isOrig = this.era === 'original';
    const isClassic7800Grid = isOrig && fh < 0.7;
    const baseRadius = Number(towerRadius) || 2.55;
    const floorH = Number(fh) || 1.0;
    const refCamCol = Number(camCol) || 0;
    // Immune to sign convention: tower toppling always drops enemies downward (-Y)
    const dropY = -Math.abs(Number(toppleDropY) || 0);

    this._cursors.fill(0);

    // Track top-2 front-facing glow casters for the 2-PointLight pool (0 allocations!)
    let bestScore0 = -1;
    let bestX0 = 0;
    let bestY0 = -9999;
    let bestZ0 = 0;
    let bestHex0 = 0xb833ff;
    let bestInt0 = 0;

    let bestScore1 = -1;
    let bestX1 = 0;
    let bestY1 = -9999;
    let bestZ1 = 0;
    let bestHex1 = 0x22f0e0;
    let bestInt1 = 0;

    const list = enemies || [];
    const count = list.length;

    for (let i = 0; i < count; i++) {
      const en = list[i];
      if (!en) continue;

      const famId = resolveEnemyFamilyId(en);
      const st = this._getEnemyState(en, i);
      const eTheta = wrapAngle((en.col - refCamCol) * COL_ANGLE);
      const radialOff = famId === FAM_MOLECULE && !isOrig ? 0.44 : 0.38;
      const er = baseRadius + radialOff;

      // Exact era-aware vertical ground/hover placement
      let yLocalOff = 0.3;
      if (isClassic7800Grid) {
        yLocalOff = floorH * 0.9;
      } else if (famId === FAM_ROLLER || famId === FAM_BOUNCER) {
        yLocalOff = 0.275;
      } else if (famId === FAM_EYE) {
        yLocalOff = isOrig ? 0.33 : 0.43;
      } else if (famId === FAM_MOLECULE) {
        yLocalOff = isOrig ? 0.35 : 0.38;
      } else {
        yLocalOff = 0.32;
      }

      const wx = er * Math.sin(eTheta);
      const wy = en.floor * floorH + yLocalOff + dropY;
      const wz = er * Math.cos(eTheta);
      st.lastX = wx;
      st.lastY = wy;
      st.lastZ = wz;

      // Handle enemy death swell/pop or instant kill burst
      if (en.dead) {
        if (st.wasAlive) {
          st.wasAlive = false;
          if (Math.abs(eTheta) <= 1.62) {
            this._spawnDeathBurst(
              wx,
              wy,
              wz,
              famId === FAM_ROLLER ? '#fbbf24' : '#7dd3fc'
            );
          }
        }
        if (!(en.deathTimer > 0)) continue;
      } else {
        st.wasAlive = true;
      }

      // Movement deltas along tower circumference & height (updated even when occluded!)
      const dCol = colDelta(st.prevCol, en.col, COLS);
      const dFloor = en.floor - st.prevFloor;
      st.prevCol = en.col;
      st.prevFloor = en.floor;

      const stunRem = en.stunTimer || 0;
      const isStunned = stunRem > 0;
      if (!isStunned) {
        st.vy = damp(st.vy, dFloor / dt, 16, dt);
      }

      // Back-cylinder horizon culling: enemies behind the opaque `r = 2.55` stone cylinder cost 0 draw calls!
      if (Math.abs(eTheta) > 1.62) {
        if (!isStunned) {
          if (famId === FAM_ROLLER) {
            const arcDist = dCol * COL_ANGLE * (baseRadius + 0.38);
            st.rollAngle -= arcDist / 0.27;
          } else if (famId === FAM_EYE) {
            st.stepPhase += (dCol / dt) * 7.0 * dt;
          }
        }
        continue;
      }

      const rig = this._acquireSlot(famId, isOrig);
      const ud = rig.userData;
      rig.visible = true;

      rig.position.set(wx, wy, wz);
      rig.rotation.set(0, eTheta, 0);

      // Classic 7800 2-row chunky arcade scale vs Reboot heroic scale
      const eraScale = isClassic7800Grid
        ? famId === FAM_MOLECULE
          ? 1.18
          : 1.12
        : 1.0;
      rig.scale.setScalar(eraScale);

      // If in short `deathTimer` swell-and-shatter animation
      if (en.dead && en.deathTimer > 0) {
        st.deathMax = Math.max(st.deathMax || 0.25, en.deathTimer);
        const k = clamp(1 - en.deathTimer / st.deathMax, 0, 1);
        const swell = k < 0.38 ? 1 + 0.45 * (k / 0.38) : 1.45 * (1 - (k - 0.38) / 0.62);
        ud.body.scale.setScalar(Math.max(0.01, swell));
        ud.cryoIce.visible = false;
        continue;
      }
      st.deathMax = 0;

      // Update Jagged 3D Cryo-Ice Crystal Block Encasement (`en.stunTimer > 0`)
      this._updateCryoEncasement(ud, st, stunRem, isStunned, t, dt);

      // Per-Creature Articulated Animation
      if (famId === FAM_EYE) {
        this._animateEye(ud, st, en, eTheta, dCol, isStunned, t, dt);
      } else if (famId === FAM_MOLECULE) {
        this._animateMolecule(ud, st, en, isStunned, t, dt);
      } else if (famId === FAM_ROLLER) {
        this._animateRoller(ud, st, en, eTheta, dCol, baseRadius, isStunned, t, dt);
      } else if (famId === FAM_BOUNCER) {
        this._animateBouncer(ud, st, en, isStunned, t, dt);
      } else {
        this._animateRobot(ud, st, en, eTheta, isStunned, t, dt);
      }

      // Candidate evaluation for dynamic wall-illumination PointLights (Reboot front hemisphere)
      if (!isOrig && Math.abs(eTheta) < 1.42) {
        const frontWeight = Math.cos(eTheta);
        let candHex = 0;
        let candInt = 0;
        let candPriority = 0;
        let candLX = wx * 0.94;
        let candLY = wy;
        let candLZ = wz * 0.94;

        if (famId === FAM_MOLECULE) {
          // Reference Photo Lower-Right: vivid magenta-violet spill onto wet masonry & corbels!
          candHex = 0xc026ff;
          candInt = 3.85 + 0.45 * Math.sin(t * 6.2 + st.seed * 6);
          candPriority = 10 + frontWeight * 4;
          candLX = wx * 0.92;
          candLY = wy + 0.04;
          candLZ = wz * 0.92;
        } else if (famId === FAM_EYE) {
          // Reference Photo Upper-Left: turquoise-cyan iris bounce onto base ledge & overhanging stone ceiling!
          candHex = 0x2fffe8;
          candInt = 2.65 + 0.3 * Math.sin(t * 4.1 + st.seed * 5);
          candPriority = 6 + frontWeight * 3;
          candLX = wx * 1.01;
          candLY = wy + 0.28;
          candLZ = wz * 1.01;
        } else if (famId === FAM_ROLLER && !isStunned) {
          candHex = 0xff6a14;
          candInt = 1.85;
          candPriority = 3 + frontWeight * 2;
          candLX = wx * 0.94;
          candLY = wy + 0.05;
          candLZ = wz * 0.94;
        } else if (isStunned) {
          candHex = 0x38bdf8;
          candInt = 2.05;
          candPriority = 4 + frontWeight * 2;
          candLX = wx * 0.95;
          candLY = wy + 0.08;
          candLZ = wz * 0.95;
        }

        if (candPriority > bestScore0) {
          bestScore1 = bestScore0;
          bestX1 = bestX0;
          bestY1 = bestY0;
          bestZ1 = bestZ0;
          bestHex1 = bestHex0;
          bestInt1 = bestInt0;

          bestScore0 = candPriority;
          bestX0 = candLX;
          bestY0 = candLY;
          bestZ0 = candLZ;
          bestHex0 = candHex;
          bestInt0 = candInt;
        } else if (candPriority > bestScore1) {
          bestScore1 = candPriority;
          bestX1 = candLX;
          bestY1 = candLY;
          bestZ1 = candLZ;
          bestHex1 = candHex;
          bestInt1 = candInt;
        }
      }
    }

    // Hide any unused pooled enemy rigs across all 10 buckets
    for (let b = 0; b < this._buckets.length; b++) {
      const bucket = this._buckets[b];
      for (let j = this._cursors[b]; j < bucket.length; j++) {
        if (bucket[j].visible) bucket[j].visible = false;
      }
    }

    // Drive the 2 permanent pooled PointLights (zero shader recompile!)
    const pl0 = this._dynLights[0];
    if (bestScore0 > 0) {
      pl0.color.setHex(bestHex0);
      pl0.intensity = bestInt0;
      pl0.position.set(bestX0, bestY0, bestZ0);
    } else {
      pl0.intensity = 0;
      pl0.position.set(0, -9999, 0);
    }

    const pl1 = this._dynLights[1];
    if (bestScore1 > 0) {
      pl1.color.setHex(bestHex1);
      pl1.intensity = bestInt1;
      pl1.position.set(bestX1, bestY1, bestZ1);
    } else {
      pl1.intensity = 0;
      pl1.position.set(0, -9999, 0);
    }

    // Advance pooled kill-shatter shockwave rings
    for (let i = 0; i < DEATH_BURST_SLOTS; i++) {
      const b = this._deathBursts[i];
      if (b.timer <= 0) continue;
      b.timer = Math.max(0, b.timer - dt);
      if (b.timer <= 0) {
        b.sprite.visible = false;
      } else {
        const p = 1 - b.timer / b.duration;
        b.sprite.position.set(b.x, b.y + dropY * 0.02, b.z);
        b.sprite.scale.setScalar(0.28 + p * 1.15);
        b.sprite.material.opacity = (1 - p) * 0.92;
      }
    }
  }

  _updateCryoEncasement(ud, st, stunRem, isStunned, t, dt) {
    const ice = ud.cryoIce;
    if (!isStunned) {
      if (ice.visible) ice.visible = false;
      st.wasStunned = false;
      st.icePopT = 0;
      return;
    }

    if (!st.wasStunned) {
      st.wasStunned = true;
      st.icePopT = 0;
    }
    st.icePopT += dt;
    ice.visible = true;

    // Snappy 0.16s elastic freeze-encase pop + urgent last-0.95s thaw shudder & white stress cracks
    const popK = clamp(st.icePopT / 0.16, 0, 1);
    const famIceScale =
      !ud.isOrig && ud.family === FAM_EYE
        ? 1.32
        : !ud.isOrig && ud.family === FAM_MOLECULE
          ? 1.14
          : 1.0;
    const popScale =
      (popK < 1 ? 0.68 + 0.32 * popK + Math.sin(popK * Math.PI) * 0.14 : 1.0) * famIceScale;
    const thawing = stunRem < 0.95;
    const jitter = thawing ? (1 - stunRem / 0.95) * 0.024 : 0;

    ice.scale.set(popScale, popScale, popScale);
    ice.position.set(
      Math.sin(t * 62 + st.seed * 10) * jitter,
      0.02,
      Math.cos(t * 51 + st.seed * 7) * jitter * 0.65
    );
    ice.rotation.y = thawing ? Math.sin(t * 44) * jitter * 2.2 : 0;

    const iUd = ice.userData;
    if (iUd.isCracked !== thawing) {
      iUd.isCracked = thawing;
      const mats = getCryoIceMaterials(thawing, this.chromeEnv);
      iUd.backMesh.material = mats.back;
      iUd.frontMesh.material = mats.front;
    }
    iUd.mistHalo.material.opacity = thawing ? 0.48 + 0.18 * Math.sin(t * 24) : 0.34;
  }

  _animateEye(ud, st, en, eTheta, dCol, isStunned, t, dt) {
    const baseScale = ud.isOrig ? 1.0 : ud.calibScale || 1.42;
    ud.body.scale.setScalar(baseScale);

    // Inward Pogo-facing orientation: on left flank (`eTheta < 0`), turn bronze-bezeled turquoise iris
    // inward-right toward Pogo & camera while 6 crimson tendrils trail outward-left onto stone (`media_1794884512715_2296550d.jpg`)!
    const flankBias = eTheta < -0.06 ? 0.32 : eTheta > 0.06 ? -0.32 : -(en.dir || 1) * 0.22;
    const bodyTargetYaw = ud.isOrig
      ? clamp((en.dir || 1) * 0.09, -0.12, 0.12)
      : clamp(-eTheta * 0.92 + flankBias, -1.08, 1.08);
    const bodyTargetPitch = ud.isOrig
      ? 0
      : clamp(0.08 + Math.sin(t * 1.9 + st.seed * 6) * 0.05, -0.1, 0.2);

    // Subtle fine corneal gaze inside the front bronze bezel (`isOrig` has no front bezel so wider tracking)
    const irisMaxYaw = ud.isOrig ? 0.56 : 0.11;
    const targetYaw = ud.isOrig
      ? clamp(-eTheta * 0.82 + (en.dir || 1) * 0.14, -irisMaxYaw, irisMaxYaw)
      : clamp(-eTheta * 0.14 + Math.sin(t * 2.3 + st.seed * 5) * 0.04, -irisMaxYaw, irisMaxYaw);
    const targetPitch = ud.isOrig
      ? clamp(Math.sin(t * 1.9 + st.seed * 6) * 0.14 - 0.05, -0.35, 0.35)
      : clamp(Math.sin(t * 2.1 + st.seed * 6) * 0.06 - 0.02, -0.1, 0.1);

    if (!isStunned) {
      st.lookYaw = damp(st.lookYaw, targetYaw, 8.5, dt);
      st.lookPitch = damp(st.lookPitch, targetPitch, 7.0, dt);
      ud.body.position.y = Math.sin(t * 3.6 + st.seed * TWO_PI) * 0.022;
      ud.body.rotation.set(
        damp(ud.body.rotation.x, bodyTargetPitch, 6.5, dt),
        damp(ud.body.rotation.y, bodyTargetYaw, 7.5, dt),
        Math.sin(t * 2.4 + st.seed * 5) * 0.045,
        'YXZ'
      );
    }

    if (ud.gazePivot) {
      const saccade = !isStunned ? Math.sin(t * 17.3 + st.seed * 19) * 0.012 : 0;
      ud.gazePivot.rotation.set(-st.lookPitch, st.lookYaw + saccade, 0, 'YXZ');
    }

    // Predator pupil dilation: contracts sharply when locking onto Pogo near center screen!
    if (ud.pupil) {
      const proximity = smooth(0.95, 0.15, Math.abs(eTheta));
      const dilate = isStunned
        ? 0.75
        : mix(1.18, 0.74, proximity) + Math.sin(t * 3.8 + st.seed * 8) * 0.055;
      ud.pupil.scale.set(dilate, dilate * 1.06, 1);
    }

    if (ud.irisCorona) {
      ud.irisCorona.rotation.z = t * 0.45;
      ud.irisCorona.material.opacity = isStunned
        ? 0.35
        : 0.72 + 0.18 * Math.sin(t * 5.2 + st.seed * 6);
    }

    // Periodic wet organic nictitating blink + menacing glare squint
    if (ud.lidUpper && ud.lidLower) {
      if (!isStunned) {
        st.blinkTimer -= dt;
        if (st.blinkTimer <= 0) {
          st.blinkClock = 0.15;
          st.blinkTimer = 2.1 + st.seed * 2.9;
        }
        st.blinkClock = Math.max(0, st.blinkClock - dt);
      }
      const blink = st.blinkClock > 0 ? Math.sin((st.blinkClock / 0.15) * Math.PI) : 0;
      const glare = smooth(0.85, 0.2, Math.abs(eTheta)) * 0.22;
      const shut = Math.max(blink, glare);
      ud.lidUpper.rotation.x = mix(-1.08, 0.12, shut);
      ud.lidLower.rotation.x = mix(1.08, -0.1, shut);
    }

    // Dual Merged Alternating-Tripod Spider Gait + Sinuous Writhe (2 draw calls total!)
    if (ud.tripodA && ud.tripodB && !isStunned) {
      const travelRate = Math.abs(dCol) > 0.0001 ? (dCol / dt) * 3.2 : (en.dir || 1) * 3.6;
      st.stepPhase += travelRate * dt * 2.2;
      const gA = st.stepPhase;
      const gB = st.stepPhase + Math.PI;
      const writhe = Math.sin(t * 5.6 + st.seed * 6);

      ud.tripodA.position.set(
        Math.sin(gA) * 0.028,
        Math.max(0, Math.cos(gA)) * 0.024 - 0.008,
        Math.cos(gA) * 0.016
      );
      ud.tripodA.rotation.set(
        Math.cos(gA) * 0.13 + writhe * 0.055,
        Math.sin(gA) * 0.11,
        Math.sin(gA) * 0.14 + writhe * 0.07
      );

      ud.tripodB.position.set(
        Math.sin(gB) * 0.028,
        Math.max(0, Math.cos(gB)) * 0.024 - 0.008,
        Math.cos(gB) * 0.016
      );
      ud.tripodB.rotation.set(
        Math.cos(gB) * 0.13 - writhe * 0.055,
        Math.sin(gB) * 0.11,
        Math.sin(gB) * 0.14 - writhe * 0.07
      );
    }
  }

  _animateMolecule(ud, st, en, isStunned, t, dt) {
    const dir = en.dir < 0 ? -1 : 1;
    const baseScale = ud.isOrig ? 1.0 : ud.calibScale || 1.12;
    const pulse = isStunned ? 1.0 : 1.0 + 0.05 * Math.sin(t * 5.4 + st.seed * TWO_PI);
    ud.body.scale.setScalar(baseScale * pulse);

    if (ud.isOrig) {
      for (let i = 0; i < ud.origAtoms.length; i++) {
        const a = ud.origAtoms[i];
        const ang = a.phase + t * 4.2 * a.speed * dir;
        a.atom.position.set(Math.cos(ang) * 0.255, Math.sin(ang) * 0.255, 0);
        a.plane.rotation.y = Math.sin(t * 1.4 + i) * 0.28;
      }
      if (ud.haloTight) {
        ud.haloTight.material.opacity = 0.42 + 0.12 * Math.sin(t * 7.0);
      }
      return;
    }

    if (!isStunned) {
      if (ud.innerCluster) {
        ud.innerCluster.rotation.y = t * 1.45 * dir + st.seed * TWO_PI;
        ud.innerCluster.rotation.x = Math.sin(t * 1.25 + st.seed * 4) * 0.3;
        ud.innerCluster.rotation.z = Math.cos(t * 1.05 + st.seed * 3) * 0.22;
      }

      const breatheA = 1.0 + 0.075 * Math.sin(t * 4.2 + st.seed * 6);
      const breatheB = 1.0 + 0.075 * Math.cos(t * 4.6 + st.seed * 5);
      if (ud.orbitRingA) {
        ud.orbitRingA.rotation.z = t * 2.1 * dir + st.seed * TWO_PI;
        ud.orbitRingA.rotation.x = 0.62 + Math.sin(t * 1.6) * 0.18;
        ud.orbitRingA.scale.setScalar(breatheA);
      }
      if (ud.orbitRingB) {
        ud.orbitRingB.rotation.z = -t * 2.45 * dir - st.seed * TWO_PI;
        ud.orbitRingB.rotation.y = 0.52 + Math.cos(t * 1.4) * 0.2;
        ud.orbitRingB.scale.setScalar(breatheB);
      }
    }

    if (ud.coreMesh && !isStunned) {
      const coreBeat = 0.76 + 0.09 * Math.sin(t * 9.5 + st.seed * 5);
      ud.coreMesh.scale.setScalar(coreBeat);
    }
    if (ud.haloTight) {
      ud.haloTight.material.opacity = isStunned
        ? 0.28
        : 0.84 + 0.14 * Math.sin(t * 8.4 + st.seed * 7);
    }
  }

  _animateRoller(ud, st, en, eTheta, dCol, towerRadius, isStunned, t, dt) {
    ud.body.scale.setScalar(1.0);

    // Physical circumference tread roll: `arcLength = dCol * COL_ANGLE * (towerRadius + 0.38)`
    if (!isStunned) {
      const arcDist =
        Math.abs(dCol) > 0.00005
          ? dCol * COL_ANGLE * (towerRadius + 0.38)
          : (en.dir || 1) * (en.speed || 1.8) * COL_ANGLE * (towerRadius + 0.38) * dt;
      st.rollAngle -= arcDist / 0.27;
      ud.wheelSpin.rotation.z = st.rollAngle;

      // Heavy cast-iron tread rumble & gyro trunnion counter-rock
      const rumble = Math.abs(Math.sin(st.rollAngle * 4));
      ud.body.position.y = rumble * 0.012;
      ud.yokeGroup.rotation.z = clamp(-(en.dir || 1) * 0.16 + Math.sin(t * 11) * 0.03, -0.26, 0.26);
      ud.yokeGroup.rotation.y = clamp(-eTheta * 0.25, -0.25, 0.25);
    }

    if (ud.furnaceVent) {
      if (isStunned) {
        ud.furnaceVent.material.color.setHex(0x38bdf8);
      } else {
        const heat = 0.85 + 0.15 * Math.sin(t * 14 + st.seed * 9);
        ud.furnaceVent.material.color.setRGB(1.0, 0.48 * heat, 0.08);
      }
    }
    if (ud.halo) {
      ud.halo.material.color.setHex(isStunned ? 0x38bdf8 : 0xff7b00);
      ud.halo.material.opacity = isStunned ? 0.18 : 0.34 + 0.1 * Math.sin(t * 12 + st.seed * 6);
    }
  }

  _animateBouncer(ud, st, en, isStunned, t, dt) {
    const baseScale = ud.isOrig ? 1.0 : 1.06;
    ud.body.scale.setScalar(baseScale);

    const floorBase = Math.round(en.baseFloor ?? en.floor);
    const heightAboveLedge = Math.max(0, en.floor - floorBase);
    const isParked = en.kind === 'park';

    if (!isStunned) {
      const contact = isParked ? 0.65 : smooth(0.15, 0.0, heightAboveLedge);
      if (contact > 0.55 && !st.landed) {
        st.landed = true;
        st.wobbleT = 0;
      } else if (contact < 0.2) {
        st.landed = false;
      }
      st.wobbleT = Math.min(10, st.wobbleT + dt);

      const jiggle = isParked
        ? Math.sin(t * 3.8 + st.seed * 6) * 0.04
        : Math.exp(-st.wobbleT * 5.2) * Math.sin(st.wobbleT * 28.0) * 0.14;
      const airStretch = isParked
        ? 0
        : clamp(Math.abs(st.vy) * 0.045, 0, 0.22) * smooth(0.08, 0.35, heightAboveLedge);
      const comp = contact * 0.28;

      const sy = clamp(1.0 - comp + airStretch + jiggle, 0.64, 1.32);
      const sxz = clamp(1.0 + comp * 0.78 - airStretch * 0.42 - jiggle * 0.5, 0.78, 1.34);

      ud.contactPivot.scale.set(sxz, sy, sxz);
      ud.springBase.scale.y = clamp(1.0 - contact * 0.34, 0.58, 1.08);
      ud.body.rotation.z = isParked
        ? 0
        : clamp(-(en.dir || 1) * smooth(0.08, 0.45, heightAboveLedge) * 0.14, -0.2, 0.2);
    }

    if (ud.bioNucleus) {
      const beat = isStunned ? 0.9 : 1.0 + 0.14 * Math.sin(t * 6.5 + st.seed * 8);
      ud.bioNucleus.scale.setScalar(beat);
      ud.bioNucleus.rotation.y = t * 1.8;
    }

    if (ud.halo) {
      ud.halo.material.opacity = isStunned
        ? 0.12
        : (isParked ? 0.22 : 0.36) + 0.1 * Math.sin(t * 5.5 + st.seed * 4);
    }
  }

  _animateRobot(ud, st, en, eTheta, isStunned, t, dt) {
    const baseScale = ud.isOrig ? 1.0 : 1.06;
    ud.body.scale.setScalar(baseScale);

    const isVert = en.type === 'robotV' || en.kind === 'vpat';
    const dir = en.dir < 0 ? -1 : 1;

    if (!isStunned) {
      // Counter-rotating coaxial brass & iron turbine rotors
      const spinMult = isVert ? 1.28 : 1.0;
      ud.rotorTopGroup.rotation.y = t * 11.5 * spinMult + st.seed * TWO_PI;
      ud.rotorBotGroup.rotation.y = -t * 14.5 * spinMult - st.seed * TWO_PI;

      // Bank chassis into horizontal patrol or vertical shaft climb
      const bankZ = isVert ? Math.sin(t * 3.2) * 0.04 : -dir * 0.12;
      ud.body.rotation.z = damp(ud.body.rotation.z, bankZ, 8, dt);
      ud.body.position.y = isVert ? 0 : Math.sin(t * 5.2 + st.seed * 6) * 0.022;

      // Cylon optical scanner eye sweeps visor & locks onto Pogo when in sight!
      if (ud.visorEye) {
        const alertLock = smooth(0.95, 0.22, Math.abs(eTheta));
        const patrolSweep = Math.sin(t * 4.4 + st.seed * 7) * 0.135;
        const pogoTrack = clamp(-eTheta * 0.22, -0.145, 0.145);
        const scanX = mix(patrolSweep, pogoTrack, alertLock);
        const vz = (ud.isOrig ? 0.208 : 0.246) - scanX * scanX * 1.4;
        ud.visorEye.position.set(scanX, ud.isOrig ? 0.07 : 0.08, vz);
        ud.visorEye.scale.setScalar(1.0 + alertLock * 0.35);
      }

      // Dynamic plasma thruster exhaust glow
      if (ud.thrusterPlume) {
        const thrustBoost = isVert ? 1.15 + clamp(st.vy * 0.12, -0.25, 0.45) : 0.92;
        const flicker = thrustBoost + Math.sin(t * 34 + st.seed * 13) * 0.14;
        ud.thrusterPlume.visible = true;
        ud.thrusterPlume.scale.set(1, Math.max(0.45, flicker), 1);
        ud.thrusterPlume.material.opacity = 0.72 + Math.sin(t * 28) * 0.14;
      }
      if (ud.thrusterRing) {
        ud.thrusterRing.visible = true;
        const pulse = (t * 6 + st.seed) % 1;
        ud.thrusterRing.position.y = -0.27 - pulse * 0.14;
        ud.thrusterRing.scale.setScalar(1.0 - pulse * 0.45);
        ud.thrusterRing.material.opacity = (1 - pulse) * 0.78;
      }
      if (ud.shortSpark) ud.shortSpark.visible = false;
    } else {
      // Stunned inside Cryo-Ice: turbines stalled, thruster sputtering, electric short-circuit arcs!
      if (ud.thrusterPlume) ud.thrusterPlume.visible = false;
      if (ud.thrusterRing) ud.thrusterRing.visible = false;
      if (ud.shortSpark) {
        const sparkOn = Math.sin(t * 43) * Math.cos(t * 19) > 0.25;
        ud.shortSpark.visible = sparkOn;
        if (sparkOn) {
          ud.shortSpark.material.rotation = t * 17;
          ud.shortSpark.material.opacity = 0.75;
        }
      }
    }

    if (ud.halo) {
      ud.halo.material.opacity = isStunned ? 0.1 : 0.28 + 0.08 * Math.sin(t * 8.0 + st.seed * 5);
    }
  }

  /**
   * Cleanly removes pooled scene objects and releases per-pool resources.
   */
  dispose() {
    if (this.root && this.root.parent) {
      this.root.parent.remove(this.root);
    }
    for (let i = 0; i < this._deathBursts.length; i++) {
      this._deathBursts[i].sprite.material.dispose();
    }
    for (let b = 0; b < this._buckets.length; b++) {
      const bucket = this._buckets[b];
      for (let i = 0; i < bucket.length; i++) {
        bucket[i].traverse((obj) => {
          if (obj.isSprite && obj.material) {
            obj.material.dispose();
          }
        });
      }
      bucket.length = 0;
    }
    this._dynLights.length = 0;
    this._deathBursts.length = 0;
  }
}
