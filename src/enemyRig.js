import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLS } from './levels.js';

/**
 * TOWERING WATERS: GATEWAY'S DESCENT — AAA 3D Creature & Mecha Enemy Pool (`src/enemyRig.js`)
 *
 * Loads headless-Blender 5.3 `.glb` articulated creature & siphon-mecha models
 * (`assets/models/enemy_*.glb`) with embedded PBR Albedo/Normal/ORM/Emissive textures,
 * paired with multi-limb kinematics, telegraph VFX, upside-down carapace springboards,
 * inflating glass water tanks, 8-segment cylindrical S-wave slithering, and translucent
 * swirling Hydro-Bubble / Sea-Glass Prism stun cages:
 *
 *   0: `snap_crab`       — Snap-Claw Dredger (6-leg crustacean gait, electric pincer snap,
 *                          flips upside-down onto curved carapace as a Hydro-Bounce springboard!)
 *   1: `gulp_hopper`     — Gulp-Hopper Drone (inhales glowing water into inflating glass belly
 *                          tank before elastic frog-hops + water-ring landing splashes!)
 *   2: `volt_eel`        — Conduit Volt-Eel (8-segment bio-mechanical moray eel slithering in a
 *                          true cylindrical S-wave with crackling arc antennae!)
 *   3: `rail_skater`     — Riptide Rail-Skater (manta water-strider hydro-drone with twin
 *                          counter-rotating brass impellers, articulated skids & aqua jet trails!)
 *   4: `barnacle_mortar` — Barnacle Geyser-Mortar (clustered reef-and-iron spire turret; 5 shell
 *                          petals peel open with orange-cyan pressure buildup before bubble pop!)
 *   5: `vent_stalker`    — Thermal Vent-Stalker (4-legged cryo/steam salamander crawler with
 *                          glowing dorsal vents emitting rising frost/steam plumes!)
 *   6: `siphon_warden`   — Siphon Warden Leviathan-Mech (Act Boss: rotating gimbal siphon core,
 *                          4 orbiting Aegis shield plates, and 4 sweeping kraken-mech tentacles!)
 */

const TWO_PI = Math.PI * 2;

export const FAM_SNAP_CRAB = 0;
export const FAM_GULP_HOPPER = 1;
export const FAM_VOLT_EEL = 2;
export const FAM_RAIL_SKATER = 3;
export const FAM_BARNACLE_MORTAR = 4;
export const FAM_VENT_STALKER = 5;
export const FAM_SIPHON_WARDEN = 6;
export const FAMILY_COUNT = 7;

export const ENEMY_FAMILIES = [
  'snap_crab',
  'gulp_hopper',
  'volt_eel',
  'rail_skater',
  'barnacle_mortar',
  'vent_stalker',
  'siphon_warden',
];

// Calibrated readable world-space scales for up-close 9.85m camera (1.42x–1.55x standard, ~1.55x hero height Boss!)
const FAMILY_WORLD_SCALES = [
  1.50, // 0: snap_crab — chunky waist-to-chest height armored dredger
  1.42, // 1: gulp_hopper — bold glass-belly amphibian mech (clears 1.50m ceiling cleanly!)
  1.52, // 2: volt_eel — thick crackling 8-segment conduit moray eel
  1.48, // 3: rail_skater — sleek manta hydro-strider drone
  1.44, // 4: barnacle_mortar — formidable 5-petal reef mortar turret
  1.55, // 5: vent_stalker — prowling dorsal-vent cryo/steam salamander
  1.02, // 6: siphon_warden — imposing ~1.55x Gateway height Leviathan Act Boss (clears top HUD cleanly!)
];

// Primary hull mesh substrings allowed to cast shadows (keeps shadow pass < 2ms at 60fps!)
const PRIMARY_SHADOW_HULL_KEYS = [
  ['carapace', 'fbcrab'], // snap_crab
  ['hopper_torso', 'fbhopper'], // gulp_hopper
  ['eel_skull', 'seg_3'], // volt_eel
  ['manta_hull', 'fbskater'], // rail_skater
  ['reef_base', 'fbmortar'], // barnacle_mortar
  ['stalker_torso', 'fbstalker'], // vent_stalker
  ['warden_mantle', 'fbwarden'], // siphon_warden
];

export const ENEMY_BESTIARY_META = {
  snap_crab: {
    name: 'Snap-Claw Dredger',
    biome: 'Redwood Canyon Rivers',
    counterplay: 'Tail-Whip flips it upside-down into a Hydro-Bounce springboard!',
    cameraDist: 1.55,
    lookY: 0.32,
    showcaseScale: 1.15,
    accentHex: '#22f0e8',
  },
  gulp_hopper: {
    name: 'Gulp-Hopper Drone',
    biome: 'Redwood Canyon Rivers & Alpine Lakes',
    counterplay: 'Strike while its glass belly inflates with stolen water before leaping.',
    cameraDist: 1.62,
    lookY: 0.36,
    showcaseScale: 1.12,
    accentHex: '#38bdf8',
  },
  volt_eel: {
    name: 'Conduit Volt-Eel',
    biome: 'Crystal Alpine Lakes & Mist Bayous',
    counterplay: 'Watch its crackling Tesla antennae telegraph before dashing past.',
    cameraDist: 1.95,
    lookY: 0.44,
    showcaseScale: 1.05,
    accentHex: '#00f5ff',
  },
  rail_skater: {
    name: 'Riptide Rail-Skater',
    biome: 'Crystal Alpine Lakes & Coral Seas',
    counterplay: 'Trap it in a Sea-Glass Prism bubble with Hydro-Pulse mid-patrol.',
    cameraDist: 1.72,
    lookY: 0.38,
    showcaseScale: 1.10,
    accentHex: '#5efce8',
  },
  barnacle_mortar: {
    name: 'Barnacle Geyser-Mortar',
    biome: 'Emerald Mist Bayous & Coral Seas',
    counterplay: 'Tail-Whip its popped geyser bubbles right back when its 5 shell valves peel open!',
    cameraDist: 1.68,
    lookY: 0.44,
    showcaseScale: 1.08,
    accentHex: '#f97316',
  },
  vent_stalker: {
    name: 'Thermal Vent-Stalker',
    biome: 'Emerald Mist Bayous & Tempest Oceans',
    counterplay: 'Leap over its dorsal frost/steam plumes and stun with Hydro-Pulse.',
    cameraDist: 1.66,
    lookY: 0.30,
    showcaseScale: 1.12,
    accentHex: '#fb923c',
  },
  siphon_warden: {
    name: 'Siphon Warden Leviathan',
    biome: 'Watershed Act Guardian',
    counterplay: 'Dodge Hydro-Beam & Tentacle Slams, then strike when its Core Exposure reticle flares!',
    cameraDist: 2.75,
    lookY: 0.86,
    showcaseScale: 0.96,
    accentHex: '#e879f9',
  },
};

const GLB_URLS = [
  'assets/models/enemy_snap_crab.glb',
  'assets/models/enemy_gulp_hopper.glb',
  'assets/models/enemy_volt_eel.glb',
  'assets/models/enemy_rail_skater.glb',
  'assets/models/enemy_barnacle_mortar.glb',
  'assets/models/enemy_vent_stalker.glb',
  'assets/models/enemy_siphon_warden.glb',
];

const DEATH_BURST_SLOTS = 8;
const SPLASH_RING_SLOTS = 8;
const PROJECTILE_SLOTS = 12;
const DYNAMIC_LIGHT_SLOTS = 2;

// Pre-allocated scratch math objects (0 per-frame heap/GC allocations)
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vUp = new THREE.Vector3();
const _mBasis = new THREE.Matrix4();
const _qSeg = new THREE.Quaternion();

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
  const c = cols || COLS || 20;
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
 * Maps all canonical enemy names (`snap_crab`..`siphon_warden`) AND any legacy
 * `type` / `kind` strings cleanly onto the 7 articulated 3D enemy families.
 * @param {object|string} en
 * @returns {number} 0..6
 */
export function resolveEnemyFamilyId(en) {
  if (!en) return FAM_SNAP_CRAB;
  const rawType = typeof en === 'string' ? en : en.type || en.enemyType || '';
  const rawKind = typeof en === 'object' ? en.kind || '' : '';
  const t = String(rawType).trim();
  const tl = t.toLowerCase();
  const kl = String(rawKind).trim().toLowerCase();

  if (
    tl === 'snap_crab' ||
    tl === 'snapcrab' ||
    tl === 'crab' ||
    tl === 'dredger' ||
    tl === 'roller' ||
    tl === 'roll' ||
    kl === 'roll'
  ) {
    return FAM_SNAP_CRAB;
  }
  if (
    tl === 'gulp_hopper' ||
    tl === 'gulphopper' ||
    tl === 'hopper' ||
    tl === 'frog' ||
    tl === 'bouncer' ||
    tl === 'bounce' ||
    kl === 'bounce' ||
    kl === 'park'
  ) {
    return FAM_GULP_HOPPER;
  }
  if (
    tl === 'volt_eel' ||
    tl === 'volteel' ||
    tl === 'eel' ||
    tl === 'conduit_eel' ||
    tl === 'chaser' ||
    kl === 'eel'
  ) {
    return FAM_VOLT_EEL;
  }
  if (
    tl === 'rail_skater' ||
    tl === 'railskater' ||
    tl === 'skater' ||
    tl === 'strider' ||
    tl === 'roboth' ||
    tl === 'robotv' ||
    tl === 'robot' ||
    kl === 'hpat' ||
    kl === 'vpat'
  ) {
    return FAM_RAIL_SKATER;
  }
  if (
    tl === 'barnacle_mortar' ||
    tl === 'barnacle' ||
    tl === 'mortar' ||
    tl === 'turret' ||
    tl === 'geyser_mortar' ||
    tl === 'tide_weaver' ||
    tl === 'tideweaver' ||
    kl === 'mortar'
  ) {
    return FAM_BARNACLE_MORTAR;
  }
  if (
    tl === 'vent_stalker' ||
    tl === 'ventstalker' ||
    tl === 'stalker' ||
    tl === 'salamander' ||
    tl === 'crawler' ||
    tl === 'eye' ||
    kl === 'stalker'
  ) {
    return FAM_VENT_STALKER;
  }
  if (
    tl === 'siphon_warden' ||
    tl === 'siphonwarden' ||
    tl === 'warden' ||
    tl === 'lock_keeper' ||
    tl === 'lockkeeper' ||
    tl === 'leviathan' ||
    tl === 'boss' ||
    tl === 'act_boss' ||
    tl === 'molecule' ||
    tl === 'bonker' ||
    kl === 'bonker' ||
    Boolean(typeof en === 'object' && (en.isBoss || en.isLockKeeper))
  ) {
    return FAM_SIPHON_WARDEN;
  }
  return FAM_SNAP_CRAB;
}

export function resolveEnemyFamilyKey(en) {
  return ENEMY_FAMILIES[resolveEnemyFamilyId(en)] || 'snap_crab';
}

// ============================================================================
// Shared Static Caches (Textures, Materials, Geometries & Loaded `.glb` Scenes)
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
      g.addColorStop(0.2, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
      g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    })
  );
}

/**
 * Dark ambient-occlusion ground contact shadow blob (100% flush under grounded enemies!).
 */
function getContactShadowTex() {
  return cached('tex:contactShadowAO', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(cx, cy, w * 0.04, cx, cy, w * 0.49);
      g.addColorStop(0.0, 'rgba(5, 10, 18, 0.82)');
      g.addColorStop(0.42, 'rgba(7, 14, 26, 0.62)');
      g.addColorStop(0.75, 'rgba(10, 18, 32, 0.24)');
      g.addColorStop(1.0, 'rgba(10, 18, 32, 0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    })
  );
}

function getContactShadowGeo() {
  return cached('geo:contactShadowDisc', () => {
    const p = new THREE.PlaneGeometry(1, 1);
    p.rotateX(-Math.PI * 0.5);
    return p;
  });
}

function getContactShadowMat() {
  return cached(
    'mat:contactShadowAO',
    () =>
      new THREE.MeshBasicMaterial({
        map: getContactShadowTex(),
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
  );
}

function buildContactShadowNode(width, depth, yOff = 0.008) {
  const m = new THREE.Mesh(getContactShadowGeo(), getContactShadowMat());
  m.name = 'enemy_contact_ao';
  m.position.set(0, yOff, 0);
  m.scale.set(width, 1, depth);
  m.castShadow = false;
  m.receiveShadow = false;
  m.renderOrder = 1;
  return m;
}

/**
 * Etched Pelagian Warning Rune Ring Texture (feathered transparent center + crisp dual outer
 * warning arcs & carved directional chevrons so stone decks remain 100% legible underneath!).
 */
function getTelegraphRuneTex() {
  return cached('tex:pelagianTelegraphRune', () =>
    makeCanvasTex(256, 256, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      ctx.clearRect(0, 0, w, h);

      // Subtle feathered outer perimeter band only (center r < 0.28 is 100% clear!)
      const rimGrad = ctx.createRadialGradient(cx, cy, w * 0.26, cx, cy, w * 0.49);
      rimGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
      rimGrad.addColorStop(0.48, 'rgba(255, 255, 255, 0.06)');
      rimGrad.addColorStop(0.76, 'rgba(255, 255, 255, 0.24)');
      rimGrad.addColorStop(0.89, 'rgba(255, 255, 255, 0.14)');
      rimGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, 0, w, h);

      // Dark bronze-slate etched contrast backing under outer ring (keeps crisp against sunlit stone!)
      ctx.strokeStyle = 'rgba(20, 10, 8, 0.58)';
      ctx.lineWidth = 9.0;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.435, 0, TWO_PI);
      ctx.stroke();

      // Crisp etched outer Pelagian warning ring
      ctx.strokeStyle = 'rgba(255, 244, 224, 0.98)';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.435, 0, TWO_PI);
      ctx.stroke();

      // Inner segmented Pelagian conduit arc (8 carved arcs with clean gaps)
      ctx.strokeStyle = 'rgba(20, 12, 10, 0.46)';
      ctx.lineWidth = 6.2;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * TWO_PI + 0.09;
        const a1 = ((i + 1) / 8) * TWO_PI - 0.09;
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.368, a0, a1);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 248, 232, 0.88)';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * TWO_PI + 0.09;
        const a1 = ((i + 1) / 8) * TWO_PI - 0.09;
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.368, a0, a1);
        ctx.stroke();
      }

      // 8 Etched Pelagian compass diamond/chevron runes between inner & outer rings
      ctx.fillStyle = 'rgba(255, 248, 236, 0.92)';
      ctx.strokeStyle = 'rgba(18, 12, 10, 0.45)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI;
        const rMid = w * 0.402;
        const rx = cx + Math.cos(a) * rMid;
        const ry = cy + Math.sin(a) * rMid;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(6.5, 0);
        ctx.lineTo(0, 3.8);
        ctx.lineTo(-5.5, 0);
        ctx.lineTo(0, -3.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 24 Fine astrolabe graduation ticks along outer bevel
      ctx.strokeStyle = 'rgba(255, 245, 228, 0.68)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 24; i++) {
        if (i % 3 === 0) continue;
        const a = (i / 24) * TWO_PI;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * w * 0.414, cy + Math.sin(a) * w * 0.414);
        ctx.lineTo(cx + Math.cos(a) * w * 0.452, cy + Math.sin(a) * w * 0.452);
        ctx.stroke();
      }
    })
  );
}

/**
 * Swirling Pressurized Pelagian Hydro-Orb Texture (rich depth, spiral caustic currents,
 * specular foam filaments — eliminates flat matte sticker balls on projectiles & water cores!).
 */
function getPressurizedOrbTex() {
  return cached('tex:pressurizedHydroOrb', () =>
    makeCanvasTex(
      256,
      256,
      (ctx, W, H) => {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0.0, '#0c4a6e');
        bg.addColorStop(0.28, '#0284c7');
        bg.addColorStop(0.55, '#0891b2');
        bg.addColorStop(0.82, '#0369a1');
        bg.addColorStop(1.0, '#082f49');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Deep swirling hydrodynamic pressure ribbons
        const rand = seededRng(541);
        for (let i = 0; i < 12; i++) {
          const y0 = (i / 12) * H;
          ctx.strokeStyle =
            i % 3 === 0 ? 'rgba(186, 230, 253, 0.72)' : i % 3 === 1 ? 'rgba(56, 189, 248, 0.56)' : 'rgba(6, 78, 114, 0.55)';
          ctx.lineWidth = i % 3 === 2 ? 7.0 : 3.2;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const u = x / W;
            const y = (y0 + u * 86 + Math.sin(u * TWO_PI * 2 + i * 1.1) * 14) % H;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Crisp sparkling micro-bubbles & caustic foam pearls
        for (let i = 0; i < 42; i++) {
          const bx = rand() * W;
          const by = rand() * H;
          const br = 1.8 + rand() * 4.6;
          ctx.fillStyle = 'rgba(224, 247, 255, 0.35)';
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, TWO_PI);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
          ctx.lineWidth = 1.1;
          ctx.stroke();
        }
      },
      { repeat: true }
    )
  );
}

/**
 * Molten Hydrothermal Amber-Copper Swirl Texture for `barnacle_mortar` pressurized magma-geyser core.
 */
function getMoltenCoreTex() {
  return cached('tex:moltenPressureCore', () =>
    makeCanvasTex(
      128,
      128,
      (ctx, W, H) => {
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0.0, '#7c2d12');
        bg.addColorStop(0.32, '#ea580c');
        bg.addColorStop(0.58, '#f59e0b');
        bg.addColorStop(0.85, '#c2410c');
        bg.addColorStop(1.0, '#431407');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < 8; i++) {
          const y0 = (i / 8) * H;
          ctx.strokeStyle = i % 2 === 0 ? 'rgba(254, 243, 199, 0.72)' : 'rgba(251, 146, 60, 0.62)';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 6) {
            const u = x / W;
            const y = (y0 + u * 44 + Math.sin(u * TWO_PI * 2 + i) * 9) % H;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      },
      { repeat: true }
    )
  );
}

/**
 * Soft curling hydrothermal steam / cryo-frost wisp texture for `vent_stalker` dorsal vents.
 */
function getSteamWispTex() {
  return cached('tex:steamWisp', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const puffs = [
        [0.50, 0.50, 0.42, 0.62],
        [0.38, 0.44, 0.28, 0.48],
        [0.62, 0.46, 0.26, 0.46],
        [0.48, 0.34, 0.24, 0.44],
      ];
      for (const [px, py, pr, a] of puffs) {
        const g = ctx.createRadialGradient(w * px, h * py, 0, w * px, h * py, w * pr);
        g.addColorStop(0.0, `rgba(240, 250, 255, ${a})`);
        g.addColorStop(0.55, `rgba(186, 230, 253, ${a * 0.42})`);
        g.addColorStop(1.0, 'rgba(186, 230, 253, 0.0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    })
  );
}

function getTelegraphRingGeo() {
  return cached('geo:enemyTelegraphRunePlane', () => {
    const g = new THREE.PlaneGeometry(1.18, 1.18);
    g.rotateX(-Math.PI * 0.5);
    return g;
  });
}

function buildTelegraphRingNode(colorHex = '#e85d22', yOff = 0.015, baseScale = 1.0) {
  const mat = new THREE.MeshBasicMaterial({
    map: getTelegraphRuneTex(),
    color: colorHex,
    transparent: true,
    opacity: 0,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const ring = new THREE.Mesh(getTelegraphRingGeo(), mat);
  ring.name = 'enemy_telegraph_ring';
  ring.position.set(0, yOff, 0);
  ring.scale.setScalar(baseScale);
  ring.castShadow = false;
  ring.receiveShadow = false;
  ring.visible = false;
  ring.renderOrder = 4;
  return ring;
}

function getWaterRippleRingTex() {
  return cached('tex:waterRippleRing', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(cx, cy, w * 0.14, cx, cy, w * 0.49);
      g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
      g.addColorStop(0.45, 'rgba(94,252,232,0.25)');
      g.addColorStop(0.72, 'rgba(224,242,254,0.95)');
      g.addColorStop(0.88, 'rgba(56,189,248,0.55)');
      g.addColorStop(1.0, 'rgba(56,189,248,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.36, 0, TWO_PI);
      ctx.stroke();
    })
  );
}

function getElectricSparkTex() {
  return cached('tex:electricSpark', () =>
    makeCanvasTex(128, 128, (ctx, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.48);
      g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
      g.addColorStop(0.25, 'rgba(125,211,252,0.85)');
      g.addColorStop(1.0, 'rgba(56,189,248,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const rand = seededRng(901);
      ctx.strokeStyle = 'rgba(240,249,255,0.96)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI + rand() * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
        const mx = cx + Math.cos(a + 0.18) * 28;
        const my = cy + Math.sin(a - 0.18) * 28;
        ctx.lineTo(mx, my);
        ctx.lineTo(cx + Math.cos(a) * 54, cy + Math.sin(a) * 54);
        ctx.stroke();
      }
    })
  );
}

/**
 * Swirling Hydro-Bubble & Sea-Glass Caustics Texture for Stun Cages (`en.stunTimer > 0`).
 */
function getHydroSwirlTex(agitated = false) {
  return cached('tex:hydroSwirl:' + (agitated ? 'pop' : 'calm'), () =>
    makeCanvasTex(
      256,
      256,
      (ctx, W, H) => {
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0.0, 'rgba(224, 247, 255, 0.52)');
        g.addColorStop(0.35, 'rgba(56, 189, 248, 0.24)');
        g.addColorStop(0.72, 'rgba(20, 241, 217, 0.30)');
        g.addColorStop(1.0, 'rgba(186, 230, 253, 0.56)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Swirling helical water current ribbons
        const rand = seededRng(agitated ? 773 : 311);
        for (let b = 0; b < 9; b++) {
          const yBase = (b / 9) * H;
          ctx.strokeStyle =
            b % 2 === 0 ? 'rgba(240, 253, 250, 0.68)' : 'rgba(94, 252, 232, 0.52)';
          ctx.lineWidth = agitated ? 4.2 : 3.0;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const u = x / W;
            const y =
              (yBase + u * 64 + Math.sin(u * TWO_PI * 2 + b * 0.9) * (agitated ? 14 : 9)) % H;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        // Suspended sparkling oxygen micro-bubbles
        for (let i = 0; i < (agitated ? 54 : 34); i++) {
          const bx = rand() * W;
          const by = rand() * H;
          const br = 1.6 + rand() * (agitated ? 5.2 : 3.8);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, TWO_PI);
          ctx.stroke();
        }
      },
      { repeat: true }
    )
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

function mergePartsClean(parts, recomputeNormals = false) {
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) {
    parts[i].dispose();
  }
  if (merged && recomputeNormals) merged.computeVertexNormals();
  return merged;
}

// ============================================================================
// Translucent Swirling Hydro-Bubble / Sea-Glass Prism Stun Cage
// ============================================================================

function getSeaGlassPrismGeo() {
  return cached('geo:seaGlassPrismShell', () => {
    const g = new THREE.IcosahedronGeometry(0.48, 1);
    g.scale(1.04, 1.12, 1.04);
    return g;
  });
}

function getHydroBubbleSphereGeo() {
  return cached('geo:hydroBubbleCore', () => new THREE.SphereGeometry(0.41, 24, 18));
}

function getHydroOrbitRingGeo() {
  return cached('geo:hydroOrbitRing', () => new THREE.TorusGeometry(0.51, 0.016, 8, 32));
}

function getHydroPrismMaterials(agitated = false, chromeEnv = null) {
  return cached('mat:hydroPrism:' + (agitated ? 'pop' : 'calm'), () => {
    const swirlTex = getHydroSwirlTex(agitated);
    const prismOuter = new THREE.MeshStandardMaterial({
      color: agitated ? '#7dd3fc' : '#2dd4bf',
      map: swirlTex,
      emissive: new THREE.Color(agitated ? '#0284c7' : '#0d9488'),
      emissiveIntensity: agitated ? 0.52 : 0.30,
      roughness: 0.08,
      metalness: 0.08,
      transparent: true,
      opacity: agitated ? 0.50 : 0.38,
      depthWrite: false,
      flatShading: true,
      envMap: chromeEnv || null,
      envMapIntensity: 1.35,
    });
    const bubbleInner = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      map: swirlTex,
      emissive: new THREE.Color('#0891b2'),
      emissiveMap: swirlTex,
      emissiveIntensity: agitated ? 0.45 : 0.28,
      roughness: 0.06,
      metalness: 0.05,
      transparent: true,
      opacity: 0.34,
      side: THREE.BackSide,
      depthWrite: false,
      envMap: chromeEnv || null,
      envMapIntensity: 1.2,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: agitated ? '#bae6fd' : '#06b6d4',
      transparent: true,
      opacity: agitated ? 0.72 : 0.52,
      depthWrite: false,
    });
    return { prismOuter, bubbleInner, ringMat };
  });
}

function buildHydroPrismCageNode(chromeEnv) {
  const g = new THREE.Group();
  g.position.y = 0.34;
  const mats = getHydroPrismMaterials(false, chromeEnv);

  const bubbleMesh = new THREE.Mesh(getHydroBubbleSphereGeo(), mats.bubbleInner);
  bubbleMesh.renderOrder = 3;

  const prismMesh = new THREE.Mesh(getSeaGlassPrismGeo(), mats.prismOuter);
  prismMesh.renderOrder = 4;

  const ringA = new THREE.Mesh(getHydroOrbitRingGeo(), mats.ringMat);
  ringA.rotation.x = 1.12;
  ringA.renderOrder = 5;

  const ringB = new THREE.Mesh(getHydroOrbitRingGeo(), mats.ringMat);
  ringB.rotation.set(-0.92, 0.55, 0);
  ringB.scale.setScalar(0.9);
  ringB.renderOrder = 5;

  const mistHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getSoftGlowTex(),
      color: '#5efce8',
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  mistHalo.scale.set(1.18, 1.18, 1);

  g.add(bubbleMesh, prismMesh, ringA, ringB, mistHalo);
  g.visible = false;
  g.userData = { bubbleMesh, prismMesh, ringA, ringB, mistHalo, isAgitated: false };
  return g;
}

// ============================================================================
// Asynchronous Blender 5.3 `.glb` Loader & PBR Material Enhancer
// ============================================================================
const _glbTemplates = new Array(FAMILY_COUNT).fill(null);
let _glbLoadStarted = false;
let _glbReadyMask = 0;
let _glbReadyPromise = null;

function upgradeLoadedGlbTemplate(famId, rootScene, chromeEnv) {
  const orbTex = getPressurizedOrbTex();
  const moltenTex = getMoltenCoreTex();
  const swirlTex = getHydroSwirlTex(false);
  rootScene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const objName = (obj.name || '').toLowerCase();
    const enhanceMat = (m) => {
      if (!m) return m;
      const nm = (m.name || '').toLowerCase();
      if (nm.includes('glass')) {
        const gMat = new THREE.MeshStandardMaterial({
          name: m.name || nm,
          color: '#bae6fd',
          roughness: 0.06,
          metalness: 0.14,
          transparent: true,
          opacity: 0.30,
          depthWrite: false,
          envMap: chromeEnv || null,
          envMapIntensity: 1.55,
        });
        if (m.dispose) m.dispose();
        return gMat;
      }
      // Convert KHR_materials_clearcoat MeshPhysicalMaterial -> fast MeshStandardMaterial
      // to eliminate 400-600ms lazy ANGLE D3D11 physical HLSL shader compiles mid-climb!
      let out = m;
      if (m.isMeshPhysicalMaterial) {
        out = new THREE.MeshStandardMaterial({
          name: m.name || nm,
          color: m.color ? m.color.clone() : new THREE.Color('#ffffff'),
          map: m.map || null,
          normalMap: m.normalMap || null,
          normalScale: m.normalScale ? m.normalScale.clone() : new THREE.Vector2(1, 1),
          roughnessMap: m.roughnessMap || null,
          metalnessMap: m.metalnessMap || null,
          aoMap: m.aoMap || m.roughnessMap || null,
          aoMapIntensity: m.aoMap ? m.aoMapIntensity : 0.88,
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color('#000000'),
          emissiveMap: m.emissiveMap || null,
          emissiveIntensity: m.emissiveIntensity ?? 1.0,
          roughness: typeof m.roughness === 'number' ? m.roughness : 0.35,
          metalness: typeof m.metalness === 'number' ? m.metalness : 0.2,
          transparent: Boolean(m.transparent || nm.includes('water') || nm.includes('bubble') || nm.includes('shield')),
          opacity: typeof m.opacity === 'number' ? m.opacity : 1.0,
          depthWrite: !(nm.includes('water') || nm.includes('bubble') || nm.includes('shield')),
          side: m.side,
          envMap: chromeEnv || m.envMap || null,
          envMapIntensity: 0.95,
        });
        m.dispose();
      } else {
        if (chromeEnv && !out.envMap) {
          out.envMap = chromeEnv;
          out.envMapIntensity = 0.92;
        }
        if (out.roughnessMap && !out.aoMap) {
          out.aoMap = out.roughnessMap;
          out.aoMapIntensity = 0.88;
        }
        if (nm.includes('water') || nm.includes('bubble') || nm.includes('shield')) {
          out.transparent = true;
          out.depthWrite = false;
        }
      }

      // Per-family 200%-zoom close-up PBR refinements (eliminating flat plastic sub-meshes & white blowouts!)
      if (famId === FAM_SNAP_CRAB && (nm.includes('spark') || objName.includes('claw_spark'))) {
        out.color.set('#0ea5e9');
        out.emissive.set('#06b6d4');
        out.emissiveIntensity = 0.72;
        out.roughness = 0.14;
        out.metalness = 0.24;
      } else if (famId === FAM_GULP_HOPPER && (nm.includes('water') || nm.includes('foam') || objName.includes('water_core'))) {
        out.color.set('#38bdf8');
        out.map = orbTex;
        out.emissive.set('#0891b2');
        out.emissiveMap = orbTex;
        out.emissiveIntensity = 0.56;
        out.roughness = 0.12;
        out.metalness = 0.14;
        out.transparent = true;
        out.opacity = 0.90;
        out.depthWrite = true;
        out.envMapIntensity = 1.45;
      } else if (famId === FAM_VOLT_EEL && (nm.includes('fin') || nm.includes('arc') || nm.includes('volt') || objName.includes('fin') || objName.includes('arc'))) {
        out.color.set('#0284c7');
        out.map = swirlTex;
        out.emissive.set('#06b6d4');
        out.emissiveIntensity = 0.62;
        out.roughness = 0.16;
        out.metalness = 0.28;
        out.envMapIntensity = 1.45;
      } else if (famId === FAM_BARNACLE_MORTAR) {
        if (nm.includes('bubble') || objName.includes('mortar_bubble')) {
          out.color.set('#38bdf8');
          out.map = orbTex;
          out.emissive.set('#0891b2');
          out.emissiveMap = orbTex;
          out.emissiveIntensity = 0.50;
          out.roughness = 0.10;
          out.metalness = 0.20;
          out.transparent = true;
          out.opacity = 0.88;
          out.depthWrite = true;
          out.envMapIntensity = 1.55;
        } else if (nm.includes('core') || nm.includes('glow') || nm.includes('pressure') || objName.includes('pressure_core')) {
          out.color.set('#f97316');
          out.map = moltenTex;
          out.emissive.set('#fb923c');
          out.emissiveMap = moltenTex;
          out.emissiveIntensity = 0.85;
          out.roughness = 0.22;
          out.metalness = 0.24;
          out.envMapIntensity = 1.25;
        }
      } else if (famId === FAM_SIPHON_WARDEN) {
        if (nm.includes('singularity') || objName.includes('singularity')) {
          out.color.set('#9333ea');
          out.map = orbTex;
          out.emissive.set('#c026d3');
          out.emissiveMap = orbTex;
          out.emissiveIntensity = 0.84;
          out.roughness = 0.12;
          out.metalness = 0.28;
          out.envMapIntensity = 1.45;
        } else if (nm.includes('lance')) {
          // Replace flat unshaded white paper finger-claws with gleaming forged sapphire-crystal talons!
          out.color.set('#38bdf8');
          out.map = swirlTex;
          out.emissive.set('#0284c7');
          out.emissiveIntensity = 0.35;
          out.metalness = 0.55;
          out.roughness = 0.20;
          out.transparent = false;
          out.opacity = 1.0;
          out.depthWrite = true;
          out.envMapIntensity = 1.55;
        } else if (
          nm.includes('shield') ||
          nm.includes('blade') ||
          nm.includes('crystal') ||
          nm.includes('energy')
        ) {
          out.color.set('#0284c7');
          out.map = swirlTex;
          out.emissive.set('#0891b2');
          out.emissiveIntensity = 0.36;
          out.roughness = 0.14;
          out.metalness = 0.38;
          out.transparent = true;
          out.opacity = 0.90;
          out.depthWrite = true;
          out.envMapIntensity = 1.55;
        }
      }

      out.needsUpdate = true;
      return out;
    };
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(enhanceMat);
    } else {
      obj.material = enhanceMat(obj.material);
    }
  });
}

function ensureEnemyGlbsLoading(chromeEnv = null) {
  if (_glbLoadStarted) return _glbReadyPromise || Promise.resolve();
  _glbLoadStarted = true;
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    _glbReadyPromise = Promise.resolve();
    return _glbReadyPromise;
  }

  _glbReadyPromise = new Promise((resolve) => {
    try {
      const loader = new GLTFLoader();
      let settled = 0;
      const doneOne = () => {
        settled++;
        if (settled >= FAMILY_COUNT) resolve();
      };
      for (let famId = 0; famId < FAMILY_COUNT; famId++) {
        loader.load(
          GLB_URLS[famId],
          (gltf) => {
            if (gltf && gltf.scene) {
              upgradeLoadedGlbTemplate(famId, gltf.scene, chromeEnv);
              _glbTemplates[famId] = gltf.scene;
              _glbReadyMask |= 1 << famId;
            }
            doneOne();
          },
          undefined,
          () => doneOne()
        );
      }
    } catch {
      resolve();
    }
  });
  return _glbReadyPromise;
}

// ============================================================================
// Shared Procedural Fallback Materials (Pre-GLB Load Frame-0 Readiness)
// ============================================================================
function getSharedPbrMat(key, opts, chromeEnv) {
  return cached('mat:shared:' + key, () => {
    const { clearcoat: _c, clearcoatRoughness: _cr, iridescence: _i, iridescenceIOR: _io, ...stdOpts } = opts;
    const m = new THREE.MeshStandardMaterial({
      ...stdOpts,
      envMap: chromeEnv || null,
      envMapIntensity: opts.envMapIntensity ?? 1.2,
    });
    return m;
  });
}

// ============================================================================
// 7 Articulated Creature & Mecha Rig Builders (GLB + Seamless Frame-0 Fallback)
// ============================================================================

function buildSnapCrabRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  // Pivot around center of domed carapace (`y = 0.28`) so 180-deg flip lands squarely on shell!
  const flipPivot = new THREE.Group();
  flipPivot.position.y = 0.28;
  const localFrame = new THREE.Group();
  localFrame.position.y = -0.28;
  flipPivot.add(localFrame);
  body.add(flipPivot);
  root.add(body);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  const contactShadow = buildContactShadowNode(1.06, 0.90, 0.007);
  const telegraphRing = buildTelegraphRingNode('#e85d22', 0.015, 1.04);
  root.add(contactShadow, telegraphRing, hydroCage);

  // Holographic Hydro-Bounce Springboard Ring (visible above upturned belly when flipped!)
  const bounceRing = new THREE.Mesh(
    cached('geo:crabBounceRing', () => {
      const g = new THREE.PlaneGeometry(0.86, 0.86);
      g.rotateX(-Math.PI * 0.5);
      return g;
    }),
    cached(
      'mat:crabBounceRing',
      () =>
        new THREE.MeshBasicMaterial({
          map: getTelegraphRuneTex(),
          color: '#14f1d9',
          transparent: true,
          opacity: 0.62,
          blending: THREE.NormalBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
    )
  );
  bounceRing.position.y = 0.56;
  bounceRing.visible = false;
  body.add(bounceRing);

  const sparkSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getElectricSparkTex(),
      color: '#38bdf8',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sparkSprite.position.set(0, 0.24, 0.52);
  sparkSprite.scale.set(0.32, 0.32, 1);
  sparkSprite.visible = false;
  localFrame.add(sparkSprite);

  const ud = {
    family: 'snap_crab',
    familyId: FAM_SNAP_CRAB,
    v3Calibrated: true,
    body,
    flipPivot,
    localFrame,
    contactShadow,
    telegraphRing,
    hydroCage,
    cryoIce: hydroCage,
    bounceRing,
    sparkSprite,
    armL: null,
    armR: null,
    pincerUpL: null,
    pincerLoL: null,
    pincerUpR: null,
    pincerLoR: null,
    eyeL: null,
    eyeR: null,
    clawSparkMesh: null,
    legs: [],
    glbMaskBit: _glbReadyMask & (1 << FAM_SNAP_CRAB),
  };

  const tpl = _glbTemplates[FAM_SNAP_CRAB];
  if (tpl) {
    const clone = tpl.clone(true);
    localFrame.add(clone);
    ud.armL = clone.getObjectByName('arm_L');
    ud.armR = clone.getObjectByName('arm_R');
    ud.pincerUpL = clone.getObjectByName('pincer_upper_L');
    ud.pincerLoL = clone.getObjectByName('pincer_lower_L');
    ud.pincerUpR = clone.getObjectByName('pincer_upper_R');
    ud.pincerLoR = clone.getObjectByName('pincer_lower_R');
    ud.eyeL = clone.getObjectByName('eye_stalk_L');
    ud.eyeR = clone.getObjectByName('eye_stalk_R');
    ud.clawSparkMesh = clone.getObjectByName('claw_spark');
    for (const nm of ['leg_L1', 'leg_L2', 'leg_L3', 'leg_R1', 'leg_R2', 'leg_R3']) {
      const ln = clone.getObjectByName(nm);
      if (ln) ud.legs.push(ln);
    }
  } else {
    const copperMat = getSharedPbrMat(
      'crabCopper',
      { color: '#c2623a', roughness: 0.32, metalness: 0.75, clearcoat: 0.4 },
      chromeEnv
    );
    const aquaMat = getSharedPbrMat(
      'crabAqua',
      { color: '#22f0e8', emissive: new THREE.Color('#14f1d9'), emissiveIntensity: 1.8, roughness: 0.12 },
      chromeEnv
    );
    const shell = new THREE.Mesh(
      cached('geo:fbCrabShell', () => {
        const s = new THREE.SphereGeometry(0.34, 18, 12);
        s.scale(1.12, 0.58, 0.88);
        return s;
      }),
      copperMat
    );
    shell.position.y = 0.28;
    const belly = new THREE.Mesh(
      cached('geo:fbCrabBelly', () => new THREE.CylinderGeometry(0.24, 0.22, 0.05, 16)),
      aquaMat
    );
    belly.position.y = 0.16;
    localFrame.add(shell, belly);

    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.27, 0.23, 0.15);
      const claw = new THREE.Mesh(
        cached('geo:fbCrabClaw', () => new THREE.CapsuleGeometry(0.068, 0.18, 6, 10)),
        copperMat
      );
      claw.rotation.x = Math.PI * 0.45;
      claw.position.set(sx * 0.08, 0, 0.16);
      arm.add(claw);
      localFrame.add(arm);
      if (sx < 0) ud.armL = arm;
      else ud.armR = arm;
    }

    const legGeo = cached('geo:fbCrabLeg', () => {
      const c = new THREE.CylinderGeometry(0.028, 0.012, 0.28, 7);
      c.translate(0, -0.14, 0);
      return c;
    });
    for (let i = 0; i < 3; i++) {
      for (const sx of [-1, 1]) {
        const lg = new THREE.Group();
        lg.position.set(sx * 0.26, 0.19, (1 - i) * 0.11);
        const lm = new THREE.Mesh(legGeo, copperMat);
        lm.rotation.z = sx * 0.65;
        lg.add(lm);
        localFrame.add(lg);
        ud.legs.push(lg);
      }
    }
  }

  ud.baseLegsRot = ud.legs.map((l) => ({ x: l.rotation.x, y: l.rotation.y, z: l.rotation.z }));
  root.userData = ud;
  return root;
}

function buildGulpHopperRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const squashPivot = new THREE.Group();
  body.add(squashPivot);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  const contactShadow = buildContactShadowNode(0.88, 0.76, 0.007);
  const telegraphRing = buildTelegraphRingNode('#0ea5e9', 0.015, 0.92);
  root.add(contactShadow, telegraphRing, hydroCage);

  // Soft etched aqua intake suction vortex outside mouth during inhale telegraph!
  const inhaleRing = new THREE.Mesh(
    cached('geo:hopperInhalePlane', () => new THREE.PlaneGeometry(0.38, 0.38)),
    cached(
      'mat:hopperInhaleRing',
      () =>
        new THREE.MeshBasicMaterial({
          map: getWaterRippleRingTex(),
          color: '#38bdf8',
          transparent: true,
          opacity: 0,
          blending: THREE.NormalBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
    )
  );
  inhaleRing.position.set(0, 0.35, 0.36);
  inhaleRing.visible = false;
  squashPivot.add(inhaleRing);

  const ud = {
    family: 'gulp_hopper',
    familyId: FAM_GULP_HOPPER,
    v3Calibrated: true,
    body,
    squashPivot,
    contactShadow,
    telegraphRing,
    hydroCage,
    cryoIce: hydroCage,
    inhaleRing,
    hopperBody: null,
    jaw: null,
    glassTank: null,
    waterCore: null,
    hindL: null,
    hindR: null,
    foreL: null,
    foreR: null,
    eyeL: null,
    eyeR: null,
    glbMaskBit: _glbReadyMask & (1 << FAM_GULP_HOPPER),
  };

  const tpl = _glbTemplates[FAM_GULP_HOPPER];
  if (tpl) {
    const clone = tpl.clone(true);
    squashPivot.add(clone);
    ud.hopperBody = clone.getObjectByName('hopper_body');
    ud.jaw = clone.getObjectByName('gulper_jaw');
    ud.glassTank = clone.getObjectByName('glass_belly_tank');
    ud.waterCore = clone.getObjectByName('stolen_water_core');
    ud.hindL = clone.getObjectByName('hind_leg_L');
    ud.hindR = clone.getObjectByName('hind_leg_R');
    ud.foreL = clone.getObjectByName('fore_leg_L');
    ud.foreR = clone.getObjectByName('fore_leg_R');
    ud.eyeL = clone.getObjectByName('eye_L');
    ud.eyeR = clone.getObjectByName('eye_R');
    if (ud.waterCore && ud.waterCore.isMesh && ud.waterCore.material) {
      ud.waterCore.material = ud.waterCore.material.clone();
      ud.waterCoreMat = ud.waterCore.material;
    }
  } else {
    const shellMat = getSharedPbrMat(
      'hopperShell',
      { color: '#166984', roughness: 0.22, metalness: 0.45, clearcoat: 0.85 },
      chromeEnv
    );
    const glassMat = getSharedPbrMat(
      'hopperGlass',
      { color: '#bae6fd', roughness: 0.04, clearcoat: 1.0, transparent: true, opacity: 0.36 },
      chromeEnv
    );
    const waterMat = getSharedPbrMat(
      'hopperWater',
      { color: '#22f0e8', emissive: new THREE.Color('#00f2fe'), emissiveIntensity: 1.2, roughness: 0.08 },
      chromeEnv
    ).clone();

    const cowl = new THREE.Mesh(
      cached('geo:fbHopperCowl', () => new THREE.SphereGeometry(0.24, 16, 12)),
      shellMat
    );
    cowl.position.set(0, 0.42, -0.02);
    const tank = new THREE.Mesh(
      cached('geo:fbHopperTank', () => new THREE.SphereGeometry(0.23, 18, 14)),
      glassMat
    );
    tank.position.set(0, 0.24, 0.06);
    const water = new THREE.Mesh(
      cached('geo:fbHopperWater', () => new THREE.SphereGeometry(0.18, 14, 12)),
      waterMat
    );
    water.position.set(0, 0.23, 0.06);
    squashPivot.add(cowl, tank, water);
    ud.glassTank = tank;
    ud.waterCore = water;
    ud.waterCoreMat = waterMat;

    const legGeo = cached('geo:fbHopperLeg', () => {
      const g = new THREE.CapsuleGeometry(0.048, 0.18, 6, 10);
      g.translate(0, -0.11, 0.04);
      return g;
    });
    const hl = new THREE.Mesh(legGeo, shellMat);
    hl.position.set(-0.22, 0.24, -0.04);
    const hr = new THREE.Mesh(legGeo, shellMat);
    hr.position.set(0.22, 0.24, -0.04);
    squashPivot.add(hl, hr);
    ud.hindL = hl;
    ud.hindR = hr;
  }

  root.userData = ud;
  return root;
}

function buildVoltEelRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  hydroCage.scale.set(1.35, 1.0, 1.15);
  const telegraphRing = buildTelegraphRingNode('#0ea5e9', 0.0, 0.56);
  telegraphRing.rotation.x = Math.PI * 0.5;
  root.add(telegraphRing, hydroCage);

  const arcFlash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getElectricSparkTex(),
      color: '#38bdf8',
      transparent: true,
      opacity: 0.58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  arcFlash.scale.set(0.36, 0.36, 1);

  const ud = {
    family: 'volt_eel',
    familyId: FAM_VOLT_EEL,
    v3Calibrated: true,
    body,
    telegraphRing,
    hydroCage,
    cryoIce: hydroCage,
    arcFlash,
    segs: [],
    jaw: null,
    arcBridge: null,
    antennaL: null,
    antennaR: null,
    eelEmissiveMats: [],
    glbMaskBit: _glbReadyMask & (1 << FAM_VOLT_EEL),
  };

  const tpl = _glbTemplates[FAM_VOLT_EEL];
  if (tpl) {
    const clone = tpl.clone(true);
    const clonedMatMap = new Map();
    clone.traverse((o) => {
      if (o.isMesh && o.material && !Array.isArray(o.material) && o.material.emissive) {
        let cm = clonedMatMap.get(o.material);
        if (!cm) {
          cm = o.material.clone();
          cm.userData = { baseEmissiveHex: cm.emissive.getHex(), baseIntensity: cm.emissiveIntensity ?? 0.62 };
          clonedMatMap.set(o.material, cm);
          ud.eelEmissiveMats.push(cm);
        }
        o.material = cm;
      }
    });
    body.add(clone);
    for (let k = 0; k < 8; k++) {
      const s = clone.getObjectByName(`seg_${k}`);
      if (s) ud.segs.push(s);
    }
    ud.jaw = clone.getObjectByName('eel_jaw');
    ud.arcBridge = clone.getObjectByName('arc_bridge');
    ud.antennaL = clone.getObjectByName('arc_antenna_L');
    ud.antennaR = clone.getObjectByName('arc_antenna_R');
    if (ud.segs[0]) {
      arcFlash.position.set(0, 0.28, 0.04);
      ud.segs[0].add(arcFlash);
    }
  } else {
    const eelMat = getSharedPbrMat(
      'eelBody',
      { color: '#1b2854', emissive: new THREE.Color('#00f5ff'), emissiveIntensity: 0.55, roughness: 0.24, metalness: 0.6 },
      chromeEnv
    ).clone();
    eelMat.userData = { baseEmissiveHex: 0x00f5ff, baseIntensity: 0.55 };
    const finMat = getSharedPbrMat(
      'eelFin',
      { color: '#22f0e8', emissive: new THREE.Color('#00f5ff'), emissiveIntensity: 1.35, transparent: true, opacity: 0.8 },
      chromeEnv
    ).clone();
    finMat.userData = { baseEmissiveHex: 0x00f5ff, baseIntensity: 1.35 };
    ud.eelEmissiveMats.push(eelMat, finMat);
    for (let k = 0; k < 8; k++) {
      const g = new THREE.Group();
      const r = mix(0.125, 0.042, k / 7);
      const segMesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.12, 6, 10), eelMat);
      segMesh.rotation.x = Math.PI * 0.5;
      const finMesh = new THREE.Mesh(new THREE.BoxGeometry(0.015, r * 2.2, 0.2), finMat);
      g.add(segMesh, finMesh);
      if (k === 0) {
        arcFlash.position.set(0, 0.22, 0.05);
        g.add(arcFlash);
      }
      body.add(g);
      ud.segs.push(g);
    }
  }

  root.userData = ud;
  return root;
}

function buildRailSkaterRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  // Projected onto stone terrace directly below skimming hover height (`-0.06 / 1.48`)
  const contactShadow = buildContactShadowNode(1.04, 0.78, -0.036);
  const telegraphRing = buildTelegraphRingNode('#e11d48', -0.028, 0.98);
  root.add(contactShadow, telegraphRing, hydroCage);

  const wakeTrail = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getWaterRippleRingTex(),
      color: '#5efce8',
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  wakeTrail.scale.set(0.85, 0.42, 1);
  wakeTrail.position.set(0, 0.06, 0);
  body.add(wakeTrail);

  const ud = {
    family: 'rail_skater',
    familyId: FAM_RAIL_SKATER,
    v3Calibrated: true,
    body,
    contactShadow,
    telegraphRing,
    hydroCage,
    cryoIce: hydroCage,
    wakeTrail,
    chassis: null,
    impellerL: null,
    impellerR: null,
    jetL: null,
    jetR: null,
    scannerEye: null,
    skids: [],
    glbMaskBit: _glbReadyMask & (1 << FAM_RAIL_SKATER),
  };

  const tpl = _glbTemplates[FAM_RAIL_SKATER];
  if (tpl) {
    const clone = tpl.clone(true);
    body.add(clone);
    ud.chassis = clone.getObjectByName('manta_chassis');
    ud.impellerL = clone.getObjectByName('impeller_L');
    ud.impellerR = clone.getObjectByName('impeller_R');
    ud.jetL = clone.getObjectByName('jet_plume_L');
    ud.jetR = clone.getObjectByName('jet_plume_R');
    ud.scannerEye = clone.getObjectByName('scanner_eye');
    for (const nm of ['skid_FL', 'skid_FR', 'skid_BL', 'skid_BR']) {
      const sk = clone.getObjectByName(nm);
      if (sk) ud.skids.push(sk);
    }
  } else {
    const hullMat = getSharedPbrMat(
      'skaterHull',
      { color: '#0e7490', roughness: 0.22, metalness: 0.76, clearcoat: 0.8 },
      chromeEnv
    );
    const brassMat = getSharedPbrMat(
      'skaterBrass',
      { color: '#d99b38', roughness: 0.22, metalness: 0.92 },
      chromeEnv
    );
    const chassis = new THREE.Group();
    chassis.position.y = 0.34;
    const manta = new THREE.Mesh(
      cached('geo:fbSkaterHull', () => {
        const s = new THREE.ConeGeometry(0.36, 0.56, 6);
        s.scale(1.3, 0.38, 1.0);
        s.rotateX(Math.PI * 0.5);
        return s;
      }),
      hullMat
    );
    chassis.add(manta);

    const bladeGeo = cached('geo:fbSkaterImp', () => new THREE.TorusGeometry(0.11, 0.022, 6, 14));
    const iL = new THREE.Mesh(bladeGeo, brassMat);
    iL.position.set(-0.34, 0, -0.02);
    const iR = new THREE.Mesh(bladeGeo, brassMat);
    iR.position.set(0.34, 0, -0.02);
    chassis.add(iL, iR);
    body.add(chassis);
    ud.chassis = chassis;
    ud.impellerL = iL;
    ud.impellerR = iR;
  }

  // Forged antique-brass dorsal clockwork wind-up key (1 merged mesh = 1 draw call, spins on `windup`!)
  const keyGeo = cached('geo:skaterClockworkKey', () => {
    const parts = [];
    const shaft = new THREE.CylinderGeometry(0.018, 0.022, 0.14, 8);
    shaft.translate(0, 0.07, 0);
    parts.push(stripPosNormal(shaft));
    const bowL = new THREE.TorusGeometry(0.052, 0.014, 6, 14);
    bowL.translate(-0.048, 0.16, 0);
    parts.push(stripPosNormal(bowL));
    const bowR = new THREE.TorusGeometry(0.052, 0.014, 6, 14);
    bowR.translate(0.048, 0.16, 0);
    parts.push(stripPosNormal(bowR));
    return mergePartsClean(parts, false);
  });
  const keyMat = getSharedPbrMat(
    'skaterBrassKey',
    { color: '#e0a63a', roughness: 0.22, metalness: 0.90 },
    chromeEnv
  );
  const keyMesh = new THREE.Mesh(keyGeo, keyMat);
  keyMesh.name = 'clockwork_key';
  keyMesh.castShadow = false;
  keyMesh.receiveShadow = false;
  if (ud.chassis) {
    keyMesh.position.set(0, 0.11, -0.04);
    ud.chassis.add(keyMesh);
  } else {
    keyMesh.position.set(0, 0.44, -0.04);
    body.add(keyMesh);
  }
  ud.clockworkKey = keyMesh;

  root.userData = ud;
  return root;
}

function buildBarnacleMortarRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  const contactShadow = buildContactShadowNode(1.04, 1.04, 0.007);
  const telegraphRing = buildTelegraphRingNode('#dc4a1a', 0.015, 1.02);
  root.add(contactShadow, telegraphRing, hydroCage);

  const pressureHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getSoftGlowTex(),
      color: '#f97316',
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  pressureHalo.position.set(0, 0.52, 0.10);
  pressureHalo.scale.set(0.62, 0.62, 1);
  body.add(pressureHalo);

  const ud = {
    family: 'barnacle_mortar',
    familyId: FAM_BARNACLE_MORTAR,
    v3Calibrated: true,
    body,
    contactShadow,
    telegraphRing,
    hydroCage,
    cryoIce: hydroCage,
    pressureHalo,
    turret: null,
    petals: [],
    pressureCore: null,
    mortarBubble: null,
    glbMaskBit: _glbReadyMask & (1 << FAM_BARNACLE_MORTAR),
  };

  const tpl = _glbTemplates[FAM_BARNACLE_MORTAR];
  if (tpl) {
    const clone = tpl.clone(true);
    body.add(clone);
    ud.turret = clone.getObjectByName('mortar_turret');
    for (let i = 0; i < 5; i++) {
      const p = clone.getObjectByName(`petal_pivot_${i}`);
      if (p) ud.petals.push(p);
    }
    ud.pressureCore = clone.getObjectByName('pressure_core');
    ud.mortarBubble = clone.getObjectByName('mortar_bubble');
  } else {
    const reefMat = getSharedPbrMat(
      'mortarReef',
      { color: '#524a5c', roughness: 0.68, metalness: 0.14 },
      chromeEnv
    );
    const bubbleMat = getSharedPbrMat(
      'mortarBub',
      { color: '#38bdf8', emissive: new THREE.Color('#22f0e8'), emissiveIntensity: 2.0, transparent: true, opacity: 0.82 },
      chromeEnv
    );
    const base = new THREE.Mesh(
      cached('geo:fbMortarBase', () => new THREE.CylinderGeometry(0.24, 0.39, 0.44, 12)),
      reefMat
    );
    base.position.y = 0.22;
    body.add(base);

    const petalGeo = cached('geo:fbMortarPetal', () => {
      const c = new THREE.ConeGeometry(0.11, 0.3, 5);
      c.translate(0, 0.15, -0.06);
      return c;
    });
    for (let i = 0; i < 5; i++) {
      const yaw = (i * TWO_PI) / 5;
      const piv = new THREE.Group();
      piv.position.set(Math.sin(yaw) * 0.21, 0.42, Math.cos(yaw) * 0.21);
      piv.rotation.y = yaw;
      piv.add(new THREE.Mesh(petalGeo, reefMat));
      body.add(piv);
      ud.petals.push(piv);
    }
    const bub = new THREE.Mesh(
      cached('geo:fbMortarBub', () => new THREE.SphereGeometry(0.16, 14, 12)),
      bubbleMat
    );
    bub.position.set(0, 0.52, 0);
    body.add(bub);
    ud.mortarBubble = bub;
  }

  // Swiveling brass submarine periscope (tracks Gateway during `watch`, retracts on `shell_hide`!)
  const periGeo = cached('geo:mortarPeriscope', () => {
    const parts = [];
    const stalk = new THREE.CylinderGeometry(0.022, 0.026, 0.22, 8);
    stalk.translate(0, 0.11, 0);
    parts.push(stripPosNormal(stalk));
    const hood = new THREE.CylinderGeometry(0.036, 0.032, 0.09, 10);
    hood.rotateX(Math.PI * 0.5);
    hood.translate(0, 0.22, 0.035);
    parts.push(stripPosNormal(hood));
    return mergePartsClean(parts, false);
  });
  const periMat = getSharedPbrMat(
    'mortarBrassPeri',
    { color: '#c88d32', roughness: 0.26, metalness: 0.88 },
    chromeEnv
  );
  const periscope = new THREE.Mesh(periGeo, periMat);
  periscope.name = 'mortar_periscope';
  periscope.castShadow = false;
  periscope.receiveShadow = false;
  periscope.position.set(0, 0.42, 0.0);
  (ud.turret || body).add(periscope);
  ud.periscope = periscope;

  root.userData = ud;
  return root;
}

function buildVentStalkerRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  const contactShadow = buildContactShadowNode(0.86, 1.24, 0.007);
  const telegraphRing = buildTelegraphRingNode('#ea580c', 0.015, 0.96);
  root.add(contactShadow, telegraphRing, hydroCage);

  // 3 Rising Cryo-Frost / Thermal Steam Plume Puffs above dorsal chimneys!
  const plumes = [];
  const wispTex = getSteamWispTex();
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: wispTex,
        color: i % 2 === 0 ? '#a5f3fc' : '#fed7aa',
        transparent: true,
        opacity: 0.52,
        blending: THREE.NormalBlending,
        depthWrite: false,
      })
    );
    sp.scale.set(0.32, 0.32, 1);
    body.add(sp);
    plumes.push(sp);
  }

  const ud = {
    family: 'vent_stalker',
    familyId: FAM_VENT_STALKER,
    v3Calibrated: true,
    body,
    contactShadow,
    telegraphRing,
    hydroCage,
    cryoIce: hydroCage,
    plumes,
    stalkerBody: null,
    head: null,
    tail1: null,
    tail2: null,
    legFL: null,
    legFR: null,
    legBL: null,
    legBR: null,
    glbMaskBit: _glbReadyMask & (1 << FAM_VENT_STALKER),
  };

  const tpl = _glbTemplates[FAM_VENT_STALKER];
  if (tpl) {
    const clone = tpl.clone(true);
    body.add(clone);
    ud.stalkerBody = clone.getObjectByName('stalker_body');
    ud.head = clone.getObjectByName('stalker_head');
    ud.tail1 = clone.getObjectByName('tail_1');
    ud.tail2 = clone.getObjectByName('tail_2');
    ud.legFL = clone.getObjectByName('leg_FL');
    ud.legFR = clone.getObjectByName('leg_FR');
    ud.legBL = clone.getObjectByName('leg_BL');
    ud.legBR = clone.getObjectByName('leg_BR');
    ud.dorsalVents = clone.getObjectByName('dorsal_vents');
    if (ud.dorsalVents && ud.dorsalVents.isMesh && ud.dorsalVents.material) {
      ud.dorsalVents.material = ud.dorsalVents.material.clone();
      ud.ventMat = ud.dorsalVents.material;
    }
  } else {
    const skinMat = getSharedPbrMat(
      'stalkerSkin',
      { color: '#222f42', roughness: 0.38, metalness: 0.35, clearcoat: 0.65 },
      chromeEnv
    );
    const cryMat = getSharedPbrMat(
      'stalkerCry',
      { color: '#67e8f9', emissive: new THREE.Color('#22d3ee'), emissiveIntensity: 1.2 },
      chromeEnv
    ).clone();
    const torso = new THREE.Mesh(
      cached('geo:fbStalkerTorso', () => {
        const g = new THREE.CapsuleGeometry(0.13, 0.34, 6, 12);
        g.rotateX(Math.PI * 0.5);
        return g;
      }),
      skinMat
    );
    torso.position.y = 0.21;
    const vents = new THREE.Mesh(
      cached('geo:fbStalkerVents', () => new THREE.ConeGeometry(0.06, 0.22, 6)),
      cryMat
    );
    vents.position.set(0, 0.36, 0);
    body.add(torso, vents);
    ud.stalkerBody = torso;
    ud.dorsalVents = vents;
    ud.ventMat = cryMat;
  }

  // 3 Hinged Brass Chimney Damper Caps (`chimneyCaps` — rattle violently in `hiss_tell`, flip open in `erupt`!)
  const capGeo = cached('geo:stalkerChimneyCap', () => {
    const c = new THREE.CylinderGeometry(0.042, 0.048, 0.016, 8);
    c.translate(0.036, 0, 0);
    return c;
  });
  const capMat = getSharedPbrMat(
    'stalkerBrassCap',
    { color: '#c88d32', roughness: 0.28, metalness: 0.86 },
    chromeEnv
  );
  ud.chimneyCaps = [];
  for (let i = 0; i < 3; i++) {
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.castShadow = false;
    cap.receiveShadow = false;
    cap.position.set(-0.036, 0.42 - Math.abs(i - 1) * 0.025, (i - 1) * 0.11);
    (ud.stalkerBody || body).add(cap);
    ud.chimneyCaps.push(cap);
  }

  root.userData = ud;
  return root;
}

function buildSiphonWardenRig(chromeEnv) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hydroCage = buildHydroPrismCageNode(chromeEnv);
  hydroCage.scale.setScalar(1.75);
  const contactShadow = buildContactShadowNode(1.32, 1.12, -0.66);
  root.add(contactShadow, hydroCage);

  const coreHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getSoftGlowTex(),
      color: '#c026d3',
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  coreHalo.position.set(0, 0.12, 0.24);
  coreHalo.scale.set(0.84, 0.84, 1);
  body.add(coreHalo);

  // Wave 4: Weak-Point Core Exposure Target Reticle (`en.coreExposed`)
  const exposedRingOuter = new THREE.Mesh(
    cached('geo:wardenExposedOuter', () => new THREE.TorusGeometry(0.38, 0.018, 8, 32)),
    new THREE.MeshBasicMaterial({
      color: '#14f1d9',
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })
  );
  exposedRingOuter.position.set(0, 0.10, 0.30);
  exposedRingOuter.visible = false;

  const exposedRingInner = new THREE.Mesh(
    cached('geo:wardenExposedInner', () => new THREE.TorusGeometry(0.24, 0.015, 6, 24)),
    new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
    })
  );
  exposedRingInner.position.set(0, 0.10, 0.32);
  exposedRingInner.visible = false;

  // Wave 4: Hydro-Beam Swirling Vortex Charge Emitter + Phase 2/3 Overdrive Arc Flare
  const beamChargeOrb = new THREE.Mesh(
    cached('geo:wardenBeamOrb', () => new THREE.IcosahedronGeometry(0.16, 2)),
    new THREE.MeshStandardMaterial({
      map: getPressurizedOrbTex(),
      color: '#d946ef',
      emissive: new THREE.Color('#c026d3'),
      emissiveMap: getPressurizedOrbTex(),
      emissiveIntensity: 0.85,
      roughness: 0.14,
      metalness: 0.22,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      envMap: chromeEnv || null,
      envMapIntensity: 1.4,
    })
  );
  beamChargeOrb.position.set(0, 0.10, 0.34);
  beamChargeOrb.visible = false;

  const bossArcSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getElectricSparkTex(),
      color: '#ff5c93',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  bossArcSprite.position.set(0, 0.16, 0.38);
  bossArcSprite.scale.set(1.15, 1.15, 1);
  bossArcSprite.visible = false;

  body.add(exposedRingOuter, exposedRingInner, beamChargeOrb, bossArcSprite);

  const ud = {
    family: 'siphon_warden',
    familyId: FAM_SIPHON_WARDEN,
    v3Calibrated: true,
    body,
    contactShadow,
    hydroCage,
    cryoIce: hydroCage,
    coreHalo,
    exposedRingOuter,
    exposedRingInner,
    beamChargeOrb,
    bossArcSprite,
    wardenBody: null,
    coreOuter: null,
    coreInner: null,
    singularity: null,
    shieldOrbit: null,
    shields: [],
    tentacles: [],
    tentacleTips: [],
    glbMaskBit: _glbReadyMask & (1 << FAM_SIPHON_WARDEN),
  };

  const tpl = _glbTemplates[FAM_SIPHON_WARDEN];
  if (tpl) {
    const clone = tpl.clone(true);
    body.add(clone);
    ud.wardenBody = clone.getObjectByName('warden_body');
    ud.coreOuter = clone.getObjectByName('siphon_core_outer');
    ud.coreInner = clone.getObjectByName('siphon_core_inner');
    ud.singularity = clone.getObjectByName('siphon_singularity');
    ud.shieldOrbit = clone.getObjectByName('shield_orbit');
    for (let i = 0; i < 4; i++) {
      const sh = clone.getObjectByName(`shield_${i}`);
      if (sh) ud.shields.push(sh);
      const tn = clone.getObjectByName(`tentacle_${i}`);
      if (tn) {
        // Tuck upper & especially lower tentacle roots deep into the tapered V-hull (ZERO floating air gap!)
        const sx = i % 2 === 0 ? -1 : 1;
        if (i < 2) {
          tn.position.set(sx * 0.34, 0.22, -0.04);
        } else {
          tn.position.set(sx * 0.14, -0.18, -0.04);
        }
        ud.tentacles.push(tn);
      }
      const tp = clone.getObjectByName(`tentacle_tip_${i}`);
      if (tp) ud.tentacleTips.push(tp);
    }
    // Single merged forged antique-bronze shoulder socket collar mesh (1 draw call!) anchoring all 4 arm joints into the hull
    const socketGeo = cached('geo:wardenArmSocketCollars', () => {
      const parts = [];
      const sockets = [
        [-0.35, 0.22, -0.02, -0.45],
        [0.35, 0.22, -0.02, 0.45],
        [-0.17, -0.18, -0.02, -0.58],
        [0.17, -0.18, -0.02, 0.58],
      ];
      for (const [x, y, z, rz] of sockets) {
        const cyl = new THREE.CylinderGeometry(0.095, 0.118, 0.14, 12);
        cyl.rotateZ(Math.PI * 0.5 + rz);
        cyl.translate(x, y, z);
        parts.push(stripPosNormal(cyl));
        const rim = new THREE.TorusGeometry(0.098, 0.022, 8, 16);
        rim.rotateY(Math.PI * 0.5);
        rim.rotateZ(rz);
        rim.translate(x + (x < 0 ? -0.04 : 0.04), y, z);
        parts.push(stripPosNormal(rim));
      }
      return mergePartsClean(parts, false);
    });
    const socketMat = getSharedPbrMat(
      'wardenSocketBronze',
      { color: '#b58432', roughness: 0.30, metalness: 0.88, envMapIntensity: 1.2 },
      chromeEnv
    );
    const socketMesh = new THREE.Mesh(socketGeo, socketMat);
    socketMesh.name = 'warden_shoulder_sockets';
    (ud.wardenBody || clone).add(socketMesh);
  } else {
    const armorMat = getSharedPbrMat(
      'wardenArmor',
      { color: '#182342', roughness: 0.22, metalness: 0.85, clearcoat: 0.75 },
      chromeEnv
    );
    const goldMat = getSharedPbrMat(
      'wardenGold',
      { color: '#f5b83d', roughness: 0.18, metalness: 0.94 },
      chromeEnv
    );
    const hood = new THREE.Mesh(
      cached('geo:fbWardenHood', () => {
        const c = new THREE.ConeGeometry(0.52, 1.35, 8);
        c.scale(1.15, 1.0, 0.65);
        return c;
      }),
      armorMat
    );
    hood.position.y = 0.22;
    const ring = new THREE.Mesh(
      cached('geo:fbWardenRing', () => new THREE.TorusGeometry(0.28, 0.03, 8, 24)),
      goldMat
    );
    ring.position.set(0, 0.12, 0.2);
    body.add(hood, ring);
    ud.coreOuter = ring;
  }

  root.userData = ud;
  return root;
}

function applyCreatureShadowFlags(rig) {
  const ud = rig.userData;
  if (!ud || !ud.body) return;
  const hullKeys = PRIMARY_SHADOW_HULL_KEYS[ud.familyId] || [];
  let assignedCast = false;
  let firstOpaqueMesh = null;

  ud.body.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const m = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (!m || m.isMeshBasicMaterial || m.transparent || m.depthWrite === false) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      return;
    }
    if (!firstOpaqueMesh) firstOpaqueMesh = obj;
    const nm = (obj.name || '').toLowerCase();
    let isPrimaryHull = false;
    for (let i = 0; i < hullKeys.length; i++) {
      if (nm.includes(hullKeys[i])) {
        isPrimaryHull = true;
        break;
      }
    }
    // Lean 60 FPS shadow budget: ONLY primary hull casts shadow (< 2ms shadow pass!)
    obj.castShadow = isPrimaryHull;
    obj.receiveShadow = isPrimaryHull;
    if (isPrimaryHull) assignedCast = true;
  });

  // Ensure procedural fallback meshes still get 1 clean primary shadow caster
  if (!assignedCast && firstOpaqueMesh) {
    firstOpaqueMesh.castShadow = true;
    firstOpaqueMesh.receiveShadow = true;
  }
}

function createRigByFamily(famId, chromeEnv) {
  let rig;
  switch (famId) {
    case FAM_SNAP_CRAB:
      rig = buildSnapCrabRig(chromeEnv);
      break;
    case FAM_GULP_HOPPER:
      rig = buildGulpHopperRig(chromeEnv);
      break;
    case FAM_VOLT_EEL:
      rig = buildVoltEelRig(chromeEnv);
      break;
    case FAM_RAIL_SKATER:
      rig = buildRailSkaterRig(chromeEnv);
      break;
    case FAM_BARNACLE_MORTAR:
      rig = buildBarnacleMortarRig(chromeEnv);
      break;
    case FAM_VENT_STALKER:
      rig = buildVentStalkerRig(chromeEnv);
      break;
    case FAM_SIPHON_WARDEN:
    default:
      rig = buildSiphonWardenRig(chromeEnv);
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
   * @param {{ chromeEnv?: THREE.Texture | null, envMap?: THREE.Texture | null }} [opts]
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.chromeEnv = opts.chromeEnv || opts.envMap || null;
    this.theme = 'canyon_river';

    this.root = new THREE.Group();
    this.root.name = 'EnemyVisualPoolRoot';
    this.group = this.root;
    if (this.scene) this.scene.add(this.root);

    ensureEnemyGlbsLoading(this.chromeEnv);

    this._buckets = Array.from({ length: FAMILY_COUNT }, () => []);
    this._cursors = new Int32Array(FAMILY_COUNT);
    this._animStates = new WeakMap();

    // Fixed 2-PointLight pool (always `visible = true` -> zero WebGL shader recompilations!)
    this._dynLights = [];
    for (let i = 0; i < DYNAMIC_LIGHT_SLOTS; i++) {
      const pl = new THREE.PointLight('#22f0e8', 0, 7.5, 1.5);
      pl.position.set(0, -9999, 0);
      this.root.add(pl);
      this._dynLights.push(pl);
    }

    // Pooled Enemy Death Shatter Bursts
    this._deathBursts = [];
    const rippleTex = getWaterRippleRingTex();
    for (let i = 0; i < DEATH_BURST_SLOTS; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: rippleTex,
          color: '#5efce8',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sp.visible = false;
      this.root.add(sp);
      this._deathBursts.push({ sprite: sp, timer: 0, duration: 0.34, x: 0, y: 0, z: 0 });
    }
    this._burstCursor = 0;

    // Pooled Horizontal Water-Ring Landing Splashes (`gulp_hopper`, `snap_crab`, `barnacle_mortar`)
    this._splashRings = [];
    const ringPlaneGeo = cached('geo:splashRingPlane', () => {
      const p = new THREE.PlaneGeometry(1, 1);
      p.rotateX(-Math.PI * 0.5);
      return p;
    });
    for (let i = 0; i < SPLASH_RING_SLOTS; i++) {
      const mesh = new THREE.Mesh(
        ringPlaneGeo,
        new THREE.MeshBasicMaterial({
          map: rippleTex,
          color: '#5efce8',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.visible = false;
      this.root.add(mesh);
      this._splashRings.push({ mesh, timer: 0, duration: 0.42, x: 0, y: 0, z: 0 });
    }
    this._splashCursor = 0;

    // Pooled 3D Deflectable Barnacle Mortar Pressurized Hydro-Orbs (`state.enemyProjectiles`)
    this._projectileMeshes = [];
    const projGeo = cached('geo:mortarProjBubble', () => new THREE.SphereGeometry(0.21, 20, 14));
    const projOrbTex = getPressurizedOrbTex();
    const projMat = cached(
      'mat:mortarProjBubble',
      () =>
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          map: projOrbTex,
          emissive: new THREE.Color('#0891b2'),
          emissiveMap: projOrbTex,
          emissiveIntensity: 0.62,
          roughness: 0.10,
          metalness: 0.22,
          transparent: true,
          opacity: 0.92,
          depthWrite: true,
          envMap: this.chromeEnv || null,
          envMapIntensity: 1.65,
        })
    );
    for (let i = 0; i < PROJECTILE_SLOTS; i++) {
      const pm = new THREE.Mesh(projGeo, projMat);
      pm.visible = false;
      this.root.add(pm);
      this._projectileMeshes.push(pm);
    }

    this._lastTime = null;
    this._bestiaryLastTime = null;
    this._inReflection = false;
    this._heroAnchor = null;

    // Wave 4: Dedicated 3D Bestiary Showcase Turntable (`setBestiaryShowcase`)
    this._bestiary = {
      active: false,
      familyId: FAM_SNAP_CRAB,
      familyKey: 'snap_crab',
      yaw: 0,
      pitch: 0,
      zoom: 1,
      x: 0,
      y: 0,
      z: 4.21,
      scale: 1,
      flourishTimer: 0,
      flourishKind: 'taunt',
      autoClock: 0,
    };
    this._showcaseGroup = new THREE.Group();
    this._showcaseGroup.name = 'EnemyBestiaryShowcase';
    this._showcaseGroup.visible = false;
    const runeTex = getTelegraphRuneTex();
    const plinthRing = new THREE.Mesh(
      cached('geo:bestiaryPlinthRune', () => {
        const g = new THREE.PlaneGeometry(1.52, 1.52);
        g.rotateX(-Math.PI * 0.5);
        return g;
      }),
      new THREE.MeshBasicMaterial({
        map: runeTex,
        color: '#22f0e8',
        transparent: true,
        opacity: 0.46,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    plinthRing.position.y = 0.018;
    const plinthDisc = new THREE.Mesh(
      cached('geo:bestiaryDisc', () => {
        const g = new THREE.CircleGeometry(0.68, 36);
        g.rotateX(-Math.PI * 0.5);
        return g;
      }),
      new THREE.MeshBasicMaterial({
        map: getContactShadowTex(),
        color: '#0f172a',
        transparent: true,
        opacity: 0.55,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    plinthDisc.position.y = 0.012;
    this._showcasePlinthRing = plinthRing;
    this._showcasePlinthDisc = plinthDisc;
    this._showcaseRigHolder = new THREE.Group();
    this._showcaseGroup.add(plinthRing, plinthDisc, this._showcaseRigHolder);
    this.root.add(this._showcaseGroup);
    this._showcaseRigs = new Array(FAMILY_COUNT).fill(null);
    this._showcaseProxy = {
      type: 'snap_crab',
      col: 0,
      floor: 0,
      baseFloor: 0,
      dir: 1,
      isBoss: true,
      hp: 6,
      maxHp: 6,
      bossPhase: 1,
      telegraph: 0,
      coreExposed: false,
      tentacleSlam: 0,
      beamCharge: 0,
      flipped: false,
      inflatePhase: 0.4,
      slitherPhase: 0,
      openAmount: 0.2,
      stunTimer: 0,
    };
    this._showcaseAnimState = {
      seed: 0.37,
      prevCol: 0,
      prevFloor: 0,
      prevHp: 6,
      gaitPhase: 0,
      slitherPhase: 0,
      vy: 0,
      vx: 1.8,
      flipProgress: 0,
      inflateSmooth: 0.4,
      yawSmooth: 0,
      hitFlashT: 0,
      wasStunned: false,
      cagePopT: 0,
      landed: true,
      wobbleT: 9,
      mortarOpenPrev: 0,
      slamTriggered: false,
      wasAlive: true,
      deathMax: 0,
      coilSmooth: 0,
      brakeSmooth: 0,
      hideSmooth: 0,
      chargeSmooth: 0,
      recoilT: 9,
      windupSpin: 0,
    };
  }

  /** No-op compatibility hook for callers still invoking `setEra`. */
  setEra(_mode) {}

  whenReady() {
    return ensureEnemyGlbsLoading(this.chromeEnv);
  }

  /**
   * Ensures at least 1 pooled rig exists for every enemy family so startup `webgl.compile()`
   * pre-compiles all enemy shaders under the fade veil (zero mid-climb ANGLE D3D11 stalls!).
   */
  prewarmAllRigs() {
    getTelegraphRuneTex();
    getPressurizedOrbTex();
    getMoltenCoreTex();
    getSteamWispTex();
    for (let f = 0; f < FAMILY_COUNT; f++) {
      const bucket = this._buckets[f];
      const wantMask = _glbReadyMask & (1 << f);
      if (bucket.length === 0) {
        const node = createRigByFamily(f, this.chromeEnv);
        node.visible = false;
        this.root.add(node);
        bucket.push(node);
      } else if (bucket[0].userData.glbMaskBit !== wantMask) {
        this.root.remove(bucket[0]);
        const node = createRigByFamily(f, this.chromeEnv);
        node.visible = false;
        this.root.add(node);
        bucket[0] = node;
      }
    }
  }

  isReady() {
    return _glbReadyMask === (1 << FAMILY_COUNT) - 1;
  }

  setTheme(theme) {
    if (theme) this.theme = String(theme);
  }

  setEnvironment(envTex) {
    this.chromeEnv = envTex || null;
    if (!this.chromeEnv) return;
    for (let f = 0; f < FAMILY_COUNT; f++) {
      if (_glbTemplates[f]) {
        _glbTemplates[f].traverse((o) => {
          if (o.isMesh && o.material && !Array.isArray(o.material)) {
            o.material.envMap = this.chromeEnv;
          }
        });
      }
      const bucket = this._buckets[f];
      for (let i = 0; i < bucket.length; i++) {
        bucket[i].traverse((o) => {
          if (o.isMesh && o.material && !Array.isArray(o.material) && !o.material.isMeshBasicMaterial) {
            o.material.envMap = this.chromeEnv;
          }
        });
      }
    }
  }

  setReflectionPass(isRefl) {
    this._inReflection = Boolean(isRefl);
    if (this.root) this.root.visible = !this._inReflection;
  }

  /**
   * Activates, updates, or deactivates the interactive 3D Bestiary Turntable Showcase.
   * Accepts `{ active, family, yaw, pitch, zoom, taunt, flourish, x, y, z, scale }` or `null`.
   */
  setBestiaryShowcase(opts = null) {
    const b = this._bestiary;
    if (!opts || opts.active === false) {
      b.active = false;
      this._bestiaryLastTime = null;
      this._showcaseGroup.visible = false;
      return;
    }
    const nextFamId =
      typeof opts.family === 'number'
        ? clamp(Math.floor(opts.family), 0, FAMILY_COUNT - 1)
        : resolveEnemyFamilyId(opts.family || b.familyKey);
    const changedFamily = !b.active || nextFamId !== b.familyId;
    b.active = true;
    b.familyId = nextFamId;
    b.familyKey = ENEMY_FAMILIES[nextFamId] || 'snap_crab';
    if (typeof opts.yaw === 'number') b.yaw = opts.yaw;
    if (typeof opts.pitch === 'number') b.pitch = clamp(opts.pitch, -0.45, 0.45);
    if (typeof opts.zoom === 'number') b.zoom = clamp(opts.zoom, 0.55, 2.2);
    if (typeof opts.x === 'number') b.x = opts.x;
    // Align with renderer.js Bestiary camera (`(hero?.floor || 2) * fh` = 3.0m when hero is on Floor 0!)
    if (typeof opts.y === 'number') b.y = opts.y === 0 ? 3.0 : opts.y;
    if (typeof opts.z === 'number') b.z = opts.z;
    if (typeof opts.scale === 'number') b.scale = clamp(opts.scale, 0.4, 2.5);
    if (changedFamily) {
      b.autoClock = 0;
      b.flourishTimer = 1.65;
      b.flourishKind = opts.flourish || opts.anim || 'taunt';
      this._showcaseAnimState.flipProgress = 0;
      this._showcaseAnimState.slamTriggered = false;
    }
    if (opts.taunt || opts.flourish || (opts.anim && opts.anim !== b.flourishKind)) {
      this.triggerBestiaryFlourish(opts.flourish || opts.anim || 'taunt');
    }

    // Hide live tower enemy buckets & projectiles while Bestiary Turntable is active
    for (let i = 0; i < FAMILY_COUNT; i++) {
      const bucket = this._buckets[i];
      for (let j = 0; j < bucket.length; j++) {
        if (bucket[j].visible) bucket[j].visible = false;
      }
    }
    for (let j = 0; j < PROJECTILE_SLOTS; j++) {
      if (this._projectileMeshes[j].visible) this._projectileMeshes[j].visible = false;
    }

    // Drive turntable rig directly (renderer.js calls setBestiaryShowcase each frame without syncEnemies!)
    const t = typeof opts.time === 'number' ? opts.time : this._lastTime || 0;
    let dt = this._bestiaryLastTime !== null ? t - this._bestiaryLastTime : 1 / 60;
    this._bestiaryLastTime = t;
    if (!(dt > 0) || dt > 0.1) dt = 1 / 60;
    this.updateBestiaryShowcase(t, dt);
  }

  /** Triggers an immediate expressive taunt / signature combat flourish on the Bestiary Turntable. */
  triggerBestiaryFlourish(kind = 'taunt') {
    this._bestiary.flourishTimer = 2.15;
    this._bestiary.flourishKind = String(kind || 'taunt');
  }

  _acquireShowcaseRig(famId) {
    const wantMask = _glbReadyMask & (1 << famId);
    let rig = this._showcaseRigs[famId];
    if (rig && rig.userData.glbMaskBit !== wantMask) {
      this._showcaseRigHolder.remove(rig);
      rig = null;
    }
    if (!rig) {
      rig = createRigByFamily(famId, this.chromeEnv);
      this._showcaseRigHolder.add(rig);
      this._showcaseRigs[famId] = rig;
    }
    for (let i = 0; i < FAMILY_COUNT; i++) {
      if (this._showcaseRigs[i]) {
        this._showcaseRigs[i].visible = i === famId;
      }
    }
    return rig;
  }

  /** Steps expressive idle & taunt flourishes on the active 3D Bestiary Showcase Turntable. */
  updateBestiaryShowcase(time, dt = 1 / 60) {
    const b = this._bestiary;
    if (!b.active) {
      if (this._showcaseGroup.visible) this._showcaseGroup.visible = false;
      return;
    }
    const t = Number(time) || 0;
    const stepDt = dt > 0 && dt <= 0.1 ? dt : 1 / 60;
    const famId = b.familyId;
    const meta = ENEMY_BESTIARY_META[b.familyKey] || ENEMY_BESTIARY_META.snap_crab;

    this._showcaseGroup.visible = true;
    this._showcaseGroup.position.set(b.x, b.y, b.z);
    this._showcaseGroup.rotation.set(b.pitch, b.yaw, 0);
    // Keep scale cohesive with renderer.js Bestiary camera zoom (avoid double-scaling when camera also zooms!)
    const totalScale = (meta.showcaseScale || 1.0) * b.scale;
    this._showcaseGroup.scale.setScalar(totalScale);

    // Subtle rotating etched Pelagian turntable rune ring
    const ringPulse = 1 + 0.03 * Math.sin(t * 2.8);
    this._showcasePlinthRing.scale.setScalar(famId === FAM_SIPHON_WARDEN ? 1.48 * ringPulse : ringPulse);
    this._showcasePlinthRing.rotation.y = t * 0.35;
    this._showcasePlinthDisc.scale.setScalar(famId === FAM_SIPHON_WARDEN ? 1.48 : 1.0);
    this._showcasePlinthRing.material.color.set(meta.accentHex || '#22f0e8');

    b.autoClock += stepDt;
    if (b.flourishTimer > 0) {
      b.flourishTimer = Math.max(0, b.flourishTimer - stepDt);
    } else if (b.autoClock > 4.2) {
      b.autoClock = 0;
      b.flourishTimer = 2.0;
      b.flourishKind = 'taunt';
    }

    const rig = this._acquireShowcaseRig(famId);
    const ud = rig.userData;
    rig.position.set(0, famId === FAM_SIPHON_WARDEN ? 0.92 : famId === FAM_VOLT_EEL ? 0.50 : famId === FAM_RAIL_SKATER ? 0.14 : 0.01, 0);
    rig.rotation.set(0, 0, 0);
    rig.scale.setScalar(1);
    ud.body.scale.setScalar(1);
    ud.hydroCage.visible = false;

    const flK = b.flourishTimer > 0 ? Math.sin(clamp(1 - b.flourishTimer / 2.15, 0, 1) * Math.PI) : 0;
    const en = this._showcaseProxy;
    const st = this._showcaseAnimState;
    en.type = b.familyKey;
    en.dir = 1;
    en.stunTimer = 0;
    en.flipped = famId === FAM_SNAP_CRAB && b.flourishKind === 'flip' && b.flourishTimer > 0.2;
    en.aiState =
      flK > 0.35
        ? famId === FAM_SNAP_CRAB
          ? en.flipped
            ? 'flipped'
            : flK > 0.72
              ? 'charge'
              : 'aggro_tell'
          : famId === FAM_GULP_HOPPER
            ? b.flourishTimer < 0.72
              ? 'leap'
              : 'inflate'
            : famId === FAM_VOLT_EEL
              ? flK > 0.7
                ? 'discharge'
                : 'coil_tell'
              : famId === FAM_RAIL_SKATER
                ? flK > 0.7
                  ? 'windup'
                  : 'spark_brake'
                : famId === FAM_BARNACLE_MORTAR
                  ? b.flourishKind === 'hide'
                    ? 'shell_hide'
                    : 'swell_tell'
                  : famId === FAM_VENT_STALKER
                    ? flK > 0.68
                      ? 'erupt'
                      : 'hiss_tell'
                    : en.coreExposed
                      ? 'vulnerable'
                      : 'telegraph'
        : 'patrol';
    en.chargeBlend = famId === FAM_SNAP_CRAB && en.aiState === 'charge' ? 1 : 0;
    en.coilBlend = famId === FAM_VOLT_EEL && flK > 0.35 ? flK : 0;
    en.shockActive = famId === FAM_VOLT_EEL && en.aiState === 'discharge';
    en.brakeBlend = famId === FAM_RAIL_SKATER && en.aiState === 'spark_brake' ? flK : 0;
    en.shellHide = famId === FAM_BARNACLE_MORTAR && en.aiState === 'shell_hide' ? 1 : 0;
    en.venting = famId === FAM_VENT_STALKER && en.aiState === 'erupt';
    en.telegraph = famId === FAM_SNAP_CRAB ? flK * 0.65 : famId === FAM_SIPHON_WARDEN ? flK * 0.55 : flK * 0.5;
    en.inflatePhase = famId === FAM_GULP_HOPPER ? clamp(0.15 + flK * 0.85, 0, 1) : 0.35;
    en.floor = famId === FAM_GULP_HOPPER && b.flourishTimer > 0 && b.flourishTimer < 0.72 ? Math.sin((b.flourishTimer / 0.72) * Math.PI) * 0.48 : 0;
    en.baseFloor = 0;
    en.slitherPhase = t * 5.8;
    en.openAmount = famId === FAM_BARNACLE_MORTAR ? clamp(0.14 + flK * 0.84, 0, 1) : 0;
    en.bossPhase = famId === FAM_SIPHON_WARDEN ? (1 + (Math.floor(t * 0.25) % 3)) : 1;
    en.coreExposed = famId === FAM_SIPHON_WARDEN && ((b.flourishKind === 'exposed' && b.flourishTimer > 0) || (t % 7.5 > 4.8));
    en.tentacleSlam = famId === FAM_SIPHON_WARDEN && b.flourishKind === 'slam' ? flK : (famId === FAM_SIPHON_WARDEN && flK > 0.35 && !en.coreExposed ? flK : 0);
    en.beamCharge = famId === FAM_SIPHON_WARDEN && !en.coreExposed ? flK * 0.85 : 0;
    en.velCol = famId === FAM_GULP_HOPPER && en.floor <= 0.05 ? 0 : 1.4 + flK * 1.2;
    en.velFloor = famId === FAM_GULP_HOPPER && en.floor > 0.05 ? 2.4 : famId === FAM_VENT_STALKER && flK <= 0.35 ? 0.78 : 0;
    st.vx = en.velCol;
    st.vy = en.velFloor;

    if (famId === FAM_SNAP_CRAB) {
      this._animateSnapCrab(ud, st, en, 0, en.flipped, b.x, b.y, b.z, t, stepDt);
    } else if (famId === FAM_GULP_HOPPER) {
      rig.position.y = 0.02 + en.floor * 0.85;
      this._animateGulpHopper(ud, st, en, 0, false, b.x, b.y, b.z, t, stepDt);
    } else if (famId === FAM_VOLT_EEL) {
      this._animateVoltEel(ud, st, en, 0, 3.8, false, t, stepDt);
    } else if (famId === FAM_RAIL_SKATER) {
      this._animateRailSkater(ud, st, en, 0, false, t, stepDt);
      ud.body.rotation.y += Math.sin(t * 1.8) * 0.18 + flK * 0.32;
    } else if (famId === FAM_BARNACLE_MORTAR) {
      this._animateBarnacleMortar(ud, st, en, false, b.x, b.y, b.z, t, stepDt);
    } else if (famId === FAM_VENT_STALKER) {
      this._animateVentStalker(ud, st, en, 0, false, t, stepDt);
      if (ud.head) ud.head.rotation.x -= flK * 0.25;
    } else {
      this._animateSiphonWarden(ud, st, en, 0, false, b.x, b.y, b.z, t, stepDt);
    }

    // Focus 1 dynamic rim light cleanly onto the Bestiary Turntable subject
    const pl0 = this._dynLights[0];
    pl0.color.set(meta.accentHex || '#22f0e8');
    pl0.intensity = 3.1 + flK * 1.2;
    pl0.position.set(b.x + 0.45, b.y + 0.85, b.z + 0.95);
    this._dynLights[1].intensity = 0;
    this._dynLights[1].position.set(0, -9999, 0);
  }

  /**
   * Flexible `update` entrypoint preserving compatibility with both `(state, dt)`
   * and `(enemies, camCol, fh, towerRadius, time, toppleDropY)` call conventions.
   */
  update(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
    if (Array.isArray(arg0)) {
      this.syncEnemies(arg0, arg1, arg2, arg3, arg4, arg5, arg6);
      return;
    }
    if (arg0 && typeof arg0 === 'object') {
      const st = arg0;
      const fh = Number(st.floorHeight) || 1.5;
      const tr = Number(st.towerRadius) || 3.75;
      const t = Number(st.time) || (this._lastTime || 0) + (Number(arg1) || 1 / 60);
      this.syncEnemies(st.enemies || [], st.camCol || 0, fh, tr, t, st.toppleDropY || 0, st);
    }
  }

  _getEnemyState(en, idx) {
    let st = this._animStates.get(en);
    if (!st) {
      const seed = (((idx + 1) * 2654435761) >>> 0) / 4294967296;
      st = {
        seed,
        prevCol: en.col ?? 0,
        prevFloor: en.floor ?? 0,
        prevHp: en.hp ?? 1,
        gaitPhase: seed * TWO_PI,
        slitherPhase: seed * TWO_PI,
        vy: 0,
        vx: 0,
        flipProgress: 0,
        inflateSmooth: 0.35,
        yawSmooth: 0,
        hitFlashT: 0,
        wasStunned: false,
        cagePopT: 0,
        landed: true,
        wobbleT: 9,
        mortarOpenPrev: 0,
        wasAlive: !en.dead,
        deathMax: 0,
        coilSmooth: 0,
        brakeSmooth: 0,
        hideSmooth: 0,
        chargeSmooth: 0,
        recoilT: 9,
        windupSpin: 0,
      };
      this._animStates.set(en, st);
    }
    return st;
  }

  _acquireSlot(famId) {
    const bucket = this._buckets[famId];
    const cur = this._cursors[famId];
    this._cursors[famId] = cur + 1;

    const wantMask = _glbReadyMask & (1 << famId);
    if (cur < bucket.length) {
      let node = bucket[cur];
      if (node.userData.glbMaskBit !== wantMask) {
        this.root.remove(node);
        node = createRigByFamily(famId, this.chromeEnv);
        this.root.add(node);
        bucket[cur] = node;
      }
      return node;
    }

    const node = createRigByFamily(famId, this.chromeEnv);
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
    b.sprite.scale.setScalar(0.36);
    b.sprite.material.opacity = 0.96;
    b.sprite.visible = true;
  }

  _spawnSplashRing(x, y, z, hexColor = '#5efce8') {
    const s = this._splashRings[this._splashCursor];
    this._splashCursor = (this._splashCursor + 1) % SPLASH_RING_SLOTS;
    s.timer = s.duration;
    s.x = x;
    s.y = y;
    s.z = z;
    s.mesh.material.color.set(hexColor);
    s.mesh.position.set(x, y + 0.03, z);
    s.mesh.scale.setScalar(0.26);
    s.mesh.material.opacity = 0.92;
    s.mesh.visible = true;
  }

  /**
   * Updates and poses all active enemies for the current frame with zero GC allocations.
   */
  syncEnemies(enemies, camCol, fh, towerRadius, time, toppleDropY = 0, extraState = null) {
    const t = Number(time) || 0;
    let dt = this._lastTime !== null ? t - this._lastTime : 1 / 60;
    this._lastTime = t;
    if (!(dt > 0) || dt > 0.1) dt = 1 / 60;

    // Optional Bestiary Turntable override (`extraState.bestiaryPreview` or `setBestiaryShowcase`)
    if (extraState && extraState.bestiaryPreview !== undefined) {
      this.setBestiaryShowcase(extraState.bestiaryPreview);
    }
    if (this._bestiary.active) {
      for (let b = 0; b < FAMILY_COUNT; b++) {
        const bucket = this._buckets[b];
        for (let j = 0; j < bucket.length; j++) {
          if (bucket[j].visible) bucket[j].visible = false;
        }
      }
      for (let j = 0; j < PROJECTILE_SLOTS; j++) {
        if (this._projectileMeshes[j].visible) this._projectileMeshes[j].visible = false;
      }
      this.updateBestiaryShowcase(t, dt);
      return;
    }
    if (this._showcaseGroup.visible) this._showcaseGroup.visible = false;

    const cols = Math.max(8, Number(extraState?.cols) || Number(COLS) || 20);
    const colAngle = TWO_PI / cols;
    const baseRadius = Number(towerRadius) || 3.75;
    const floorH = Number(fh) || 1.5;
    const worldScale = clamp(floorH / 1.5, 0.64, 1.35);
    const radialScale = baseRadius / 3.75;
    const refCamCol = Number(camCol) || 0;
    const dropY = -Math.abs(Number(toppleDropY) || 0);

    // Resolve active camera/hero floor for strict vertical culling (prevents off-screen floors burning draw calls!)
    let refCamFloor = null;
    if (extraState && Number.isFinite(Number(extraState.camFloor))) {
      refCamFloor = Number(extraState.camFloor);
    } else if (extraState && Number.isFinite(Number(extraState.heroFloor))) {
      refCamFloor = Number(extraState.heroFloor);
    } else if (extraState && extraState.player && Number.isFinite(Number(extraState.player.floor))) {
      refCamFloor = Number(extraState.player.floor);
    } else if (this.scene) {
      if (!this._heroAnchor || this._heroAnchor.parent !== this.scene) {
        this._heroAnchor = this.scene.getObjectByName('GatewayRig') || null;
      }
      if (this._heroAnchor && floorH > 0.1) {
        refCamFloor = (this._heroAnchor.position.y - dropY) / floorH;
      }
    }

    this._cursors.fill(0);

    let bestScore0 = -1;
    let bestX0 = 0;
    let bestY0 = -9999;
    let bestZ0 = 0;
    let bestHex0 = 0x22f0e8;
    let bestInt0 = 0;

    let bestScore1 = -1;
    let bestX1 = 0;
    let bestY1 = -9999;
    let bestZ1 = 0;
    let bestHex1 = 0xe879f9;
    let bestInt1 = 0;

    const list = enemies || [];
    const count = list.length;

    for (let i = 0; i < count; i++) {
      const en = list[i];
      if (!en) continue;

      const famId = resolveEnemyFamilyId(en);
      const st = this._getEnemyState(en, i);
      const eTheta = wrapAngle((en.col - refCamCol) * colAngle);

      const isTrueBoss =
        famId === FAM_SIPHON_WARDEN &&
        (en.type === 'siphon_warden' ||
          en.type === 'boss' ||
          en.type === 'act_boss' ||
          Boolean(en.isBoss) ||
          (Number(en.maxHp) || 0) >= 3);

      // Calibrated readable world-space scale (1.42x–1.55x standard enemies, ~1.55x hero height Boss!)
      const famMul =
        famId === FAM_SIPHON_WARDEN
          ? isTrueBoss
            ? FAMILY_WORLD_SCALES[FAM_SIPHON_WARDEN]
            : 0.90
          : FAMILY_WORLD_SCALES[famId] || 1.48;
      const famScale = worldScale * famMul;

      // Family-calibrated radial placement curving cleanly along `towerRadius + 0.46` terraces!
      let baseRadOff = 0.46;
      if (famId === FAM_VOLT_EEL) baseRadOff = 0.48;
      else if (famId === FAM_RAIL_SKATER) baseRadOff = 0.50;
      else if (famId === FAM_SIPHON_WARDEN) baseRadOff = isTrueBoss ? 0.62 : 0.56;
      const er = baseRadius + baseRadOff * radialScale;

      // 100% FLUSH stone grounding (`0.00m` air-gap for all grounded enemies!)
      let yLocalOff = 0.0;
      if (famId === FAM_VOLT_EEL) yLocalOff = 0.48 * worldScale;
      else if (famId === FAM_RAIL_SKATER) yLocalOff = 0.06 * worldScale;
      else if (famId === FAM_SIPHON_WARDEN) yLocalOff = (isTrueBoss ? 0.78 : 0.68) * worldScale;

      const wx = er * Math.sin(eTheta);
      const wy = en.floor * floorH + yLocalOff + dropY;
      const wz = er * Math.cos(eTheta);

      if (en.dead) {
        if (st.wasAlive) {
          st.wasAlive = false;
          if (Math.abs(eTheta) <= 1.65) {
            this._spawnDeathBurst(
              wx,
              wy + 0.55 * worldScale,
              wz,
              famId === FAM_SIPHON_WARDEN ? '#f0abfc' : '#5efce8'
            );
          }
        }
        if (!(en.deathTimer > 0)) continue;
      } else {
        st.wasAlive = true;
      }

      const dCol = colDelta(st.prevCol, en.col, cols);
      const dFloor = en.floor - st.prevFloor;
      st.prevCol = en.col;
      st.prevFloor = en.floor;

      if (typeof en.hp === 'number' && en.hp < st.prevHp) {
        st.hitFlashT = 0.26;
      }
      if (typeof en.hp === 'number') st.prevHp = en.hp;
      if (st.hitFlashT > 0) st.hitFlashT = Math.max(0, st.hitFlashT - dt);

      const stunRem = Number(en.stunTimer) || 0;
      const isFlippedCrab =
        famId === FAM_SNAP_CRAB &&
        Boolean(en.flipped || en.isFlipped || en.flippedTimer > 0 || stunRem > 0);
      const isCagedStun = famId !== FAM_SNAP_CRAB && stunRem > 0;

      if (!isCagedStun) {
        const targetVx = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : dCol / dt;
        const targetVy = Number.isFinite(Number(en.velFloor)) ? Number(en.velFloor) : dFloor / dt;
        st.vx = damp(st.vx, targetVx, 16, dt);
        st.vy = damp(st.vy, targetVy, 16, dt);
      }

      // Strict vertical + front-arc culling (close-up 9.85m camera frames ~3.8 floors; cull unseen enemies!)
      const maxFloorDiff = famId === FAM_SIPHON_WARDEN ? 4.4 : 3.8;
      const minCosTheta = famId === FAM_VOLT_EEL || famId === FAM_SIPHON_WARDEN ? -0.25 : -0.15;
      const outOfVertBand = refCamFloor !== null && Math.abs(en.floor - refCamFloor) > maxFloorDiff;
      if (outOfVertBand || Math.cos(eTheta) < minCosTheta) {
        if (!isCagedStun) {
          st.gaitPhase += (Math.abs(st.vx) * 2.8 + 2.2) * dt;
          st.slitherPhase += 5.4 * dt;
        }
        continue;
      }

      const rig = this._acquireSlot(famId);
      const ud = rig.userData;
      rig.visible = true;
      rig.position.set(wx, wy, wz);
      rig.rotation.set(0, eTheta, 0);
      rig.scale.setScalar(famScale);

      if (en.dead && en.deathTimer > 0) {
        st.deathMax = Math.max(st.deathMax || 0.26, en.deathTimer);
        const k = clamp(1 - en.deathTimer / st.deathMax, 0, 1);
        const swell = k < 0.36 ? 1 + 0.42 * (k / 0.36) : 1.42 * (1 - (k - 0.36) / 0.64);
        ud.body.scale.setScalar(Math.max(0.01, swell));
        ud.hydroCage.visible = false;
        if (ud.telegraphRing) ud.telegraphRing.visible = false;
        if (ud.contactShadow) ud.contactShadow.visible = false;
        continue;
      }
      st.deathMax = 0;
      ud.body.scale.setScalar(1);
      if (ud.contactShadow) ud.contactShadow.visible = true;

      // Update Translucent Swirling Hydro-Bubble / Sea-Glass Prism Stun Cage
      this._updateHydroPrismCage(ud, st, stunRem, isCagedStun, t, dt);

      // Per-Family Articulated Kinematics & Combat Telegraphs
      if (famId === FAM_SNAP_CRAB) {
        this._animateSnapCrab(ud, st, en, eTheta, isFlippedCrab, wx, wy, wz, t, dt);
      } else if (famId === FAM_GULP_HOPPER) {
        this._animateGulpHopper(ud, st, en, eTheta, isCagedStun, wx, wy, wz, t, dt);
      } else if (famId === FAM_VOLT_EEL) {
        // Divide by `famScale` so 8-segment eel hugs exact `er` tower curvature at 2.18x world scale!
        this._animateVoltEel(ud, st, en, eTheta, er / Math.max(0.5, famScale), isCagedStun, t, dt);
      } else if (famId === FAM_RAIL_SKATER) {
        this._animateRailSkater(ud, st, en, eTheta, isCagedStun, t, dt);
      } else if (famId === FAM_BARNACLE_MORTAR) {
        this._animateBarnacleMortar(ud, st, en, isCagedStun, wx, wy, wz, t, dt);
      } else if (famId === FAM_VENT_STALKER) {
        this._animateVentStalker(ud, st, en, eTheta, isCagedStun, t, dt);
      } else {
        this._animateSiphonWarden(ud, st, en, eTheta, isCagedStun, wx, wy, wz, t, dt);
      }

      // Dynamic 2-PointLight Pool Priority Selection
      if (Math.abs(eTheta) < 1.45) {
        const frontWeight = Math.cos(eTheta);
        let candHex = 0;
        let candInt = 0;
        let candPri = 0;

        if (famId === FAM_SIPHON_WARDEN) {
          const bPhase = Math.max(1, Number(en.bossPhase) || 1);
          const exposed = Boolean(en.coreExposed || en.exposedTimer > 0 || en.vulnerable);
          candHex = exposed ? 0x22f0e8 : bPhase >= 3 ? 0xff2a5f : bPhase === 2 ? 0xf59e0b : 0xe879f9;
          candInt = (exposed ? 5.2 : 4.2 + (bPhase - 1) * 0.7) + 0.6 * Math.sin(t * (6.5 + bPhase * 2));
          candPri = 14 + frontWeight * 4;
        } else if (isFlippedCrab) {
          candHex = 0x14f1d9;
          candInt = 3.2;
          candPri = 10 + frontWeight * 3;
        } else if (famId === FAM_VOLT_EEL) {
          candHex = 0x00f5ff;
          candInt = 2.9 + 0.4 * Math.sin(t * 11.0 + st.seed * 6);
          candPri = 8 + frontWeight * 3;
        } else if (famId === FAM_BARNACLE_MORTAR) {
          candHex = 0xff7b00;
          candInt = 2.6;
          candPri = 7 + frontWeight * 2;
        } else if (isCagedStun) {
          candHex = 0x38bdf8;
          candInt = 2.4;
          candPri = 6 + frontWeight * 2;
        }

        if (candPri > bestScore0) {
          bestScore1 = bestScore0;
          bestX1 = bestX0;
          bestY1 = bestY0;
          bestZ1 = bestZ0;
          bestHex1 = bestHex0;
          bestInt1 = bestInt0;

          bestScore0 = candPri;
          bestX0 = wx * 0.95;
          bestY0 = wy + 0.35 * worldScale;
          bestZ0 = wz * 0.95;
          bestHex0 = candHex;
          bestInt0 = candInt;
        } else if (candPri > bestScore1) {
          bestScore1 = candPri;
          bestX1 = wx * 0.95;
          bestY1 = wy + 0.35 * worldScale;
          bestZ1 = wz * 0.95;
          bestHex1 = candHex;
          bestInt1 = candInt;
        }
      }
    }

    // Hide unused pooled rigs across all 7 families
    for (let b = 0; b < FAMILY_COUNT; b++) {
      const bucket = this._buckets[b];
      for (let j = this._cursors[b]; j < bucket.length; j++) {
        if (bucket[j].visible) bucket[j].visible = false;
      }
    }

    // Sync optional deflectable Barnacle Mortar bubbles (`extraState.enemyProjectiles`)
    const projs = extraState?.enemyProjectiles || enemies?.enemyProjectiles || null;
    this.syncProjectiles(
      projs,
      refCamCol,
      colAngle,
      baseRadius,
      floorH,
      radialScale,
      worldScale,
      t,
      dropY,
      refCamFloor
    );

    // Update 2 permanent dynamic PointLights
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

    // Advance death bursts
    for (let i = 0; i < DEATH_BURST_SLOTS; i++) {
      const b = this._deathBursts[i];
      if (b.timer <= 0) continue;
      b.timer = Math.max(0, b.timer - dt);
      if (b.timer <= 0) {
        b.sprite.visible = false;
      } else {
        const p = 1 - b.timer / b.duration;
        b.sprite.position.set(b.x, b.y, b.z);
        b.sprite.scale.setScalar(0.55 + p * 2.35);
        b.sprite.material.opacity = (1 - p) * 0.94;
      }
    }

    // Advance horizontal water-ring splashes
    for (let i = 0; i < SPLASH_RING_SLOTS; i++) {
      const s = this._splashRings[i];
      if (s.timer <= 0) continue;
      s.timer = Math.max(0, s.timer - dt);
      if (s.timer <= 0) {
        s.mesh.visible = false;
      } else {
        const p = 1 - s.timer / s.duration;
        s.mesh.position.set(s.x, s.y + 0.03, s.z);
        s.mesh.scale.setScalar(0.48 + p * 2.15);
        s.mesh.material.opacity = (1 - p) * 0.88;
      }
    }
  }

  syncProjectiles(
    projs,
    refCamCol,
    colAngle,
    baseRadius,
    floorH,
    radialScale,
    worldScale,
    t,
    dropY,
    refCamFloor = null
  ) {
    let used = 0;
    if (Array.isArray(projs)) {
      for (let i = 0; i < projs.length && used < PROJECTILE_SLOTS; i++) {
        const pr = projs[i];
        if (!pr || pr.dead) continue;
        if (refCamFloor !== null && Math.abs(pr.floor - refCamFloor) > 4.0) continue;
        const th = wrapAngle((pr.col - refCamCol) * colAngle);
        if (Math.cos(th) < -0.15) continue;
        const r = baseRadius + 0.56 * radialScale;
        const pm = this._projectileMeshes[used++];
        pm.visible = true;
        pm.position.set(
          r * Math.sin(th),
          pr.floor * floorH + 0.68 * worldScale + dropY,
          r * Math.cos(th)
        );
        const projScale = worldScale * 1.25;
        const wob = 1 + 0.14 * Math.sin(t * 14 + i * 2.1);
        pm.scale.set(projScale * wob, projScale * (2 - wob), projScale * wob);
        pm.rotation.set(t * 2.4, th + t * 3.1, 0);
      }
    }
    for (let j = used; j < PROJECTILE_SLOTS; j++) {
      if (this._projectileMeshes[j].visible) this._projectileMeshes[j].visible = false;
    }
  }

  _updateHydroPrismCage(ud, st, stunRem, isStunned, t, dt) {
    const cage = ud.hydroCage;
    if (!isStunned) {
      if (cage.visible) cage.visible = false;
      st.wasStunned = false;
      st.cagePopT = 0;
      return;
    }

    if (!st.wasStunned) {
      st.wasStunned = true;
      st.cagePopT = 0;
    }
    st.cagePopT += dt;
    cage.visible = true;

    const popK = clamp(st.cagePopT / 0.18, 0, 1);
    const baseMul = ud.familyId === FAM_SIPHON_WARDEN ? 1.65 : ud.familyId === FAM_VOLT_EEL ? 1.24 : 1.05;
    const popScale =
      (popK < 1 ? 0.65 + 0.35 * popK + Math.sin(popK * Math.PI) * 0.16 : 1.0) * baseMul;
    const agitated = stunRem < 0.95;
    const wobble = agitated ? (1 - stunRem / 0.95) * 0.045 : 0.015;

    cage.scale.set(
      popScale * (1 + Math.sin(t * 9 + st.seed * 6) * wobble),
      popScale * (1 - Math.sin(t * 9 + st.seed * 6) * wobble),
      popScale * (1 + Math.cos(t * 8 + st.seed * 4) * wobble)
    );

    const cUd = cage.userData;
    if (cUd.isAgitated !== agitated) {
      cUd.isAgitated = agitated;
      const mats = getHydroPrismMaterials(agitated, this.chromeEnv);
      cUd.prismMesh.material = mats.prismOuter;
      cUd.bubbleMesh.material = mats.bubbleInner;
      cUd.ringA.material = mats.ringMat;
      cUd.ringB.material = mats.ringMat;
    }

    // Continuous swirling sea-glass prism & orbiting water rings
    const spinRate = agitated ? 3.8 : 1.55;
    cUd.prismMesh.rotation.set(Math.sin(t * 1.7) * 0.22, t * spinRate + st.seed * 5, Math.cos(t * 1.3) * 0.18);
    cUd.bubbleMesh.rotation.y = -t * spinRate * 1.4;
    cUd.ringA.rotation.z = t * 4.2;
    cUd.ringB.rotation.z = -t * 4.8;
    cUd.mistHalo.material.opacity = agitated ? 0.5 + 0.22 * Math.sin(t * 28) : 0.34;
  }

  // --------------------------------------------------------------------------
  // 1. `snap_crab` — Grumpy Territorial Brawler (`patrol`, `edge_look`, `aggro_tell`, `charge`, `huff`, `flipped`)!
  // --------------------------------------------------------------------------
  _animateSnapCrab(ud, st, en, eTheta, isFlipped, wx, wy, wz, t, dt) {
    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const velCol = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : st.vx;
    const absVel = Math.abs(velCol);
    const chargeTarget = clamp(Number(en.chargeBlend) || (aiState === 'charge' ? 1 : 0), 0, 1);
    st.chargeSmooth = damp(st.chargeSmooth || 0, isFlipped ? 0 : chargeTarget, 14, dt);

    const prevFlip = st.flipProgress;
    const flippedNow = Boolean(isFlipped || aiState === 'flipped');
    st.flipProgress = damp(st.flipProgress, flippedNow ? 1.0 : 0.0, 12, dt);
    if (prevFlip < 0.25 && st.flipProgress >= 0.25) {
      this._spawnSplashRing(wx, wy, wz, '#22f0e8');
    }

    const dir = en.dir < 0 ? -1 : 1;
    const isEdgeLook = !flippedNow && aiState === 'edge_look';
    const isAggroTell = !flippedNow && aiState === 'aggro_tell';
    const isHuff = !flippedNow && aiState === 'huff';

    // 180-deg barrel flip onto curved copper carapace + rocking turtle wobble!
    const flipAng = st.flipProgress * Math.PI;
    const rockZ = flippedNow ? Math.sin(t * 9.5 + st.seed * 6) * 0.14 : 0;
    const bounceSquash = Number(en.bounceCompress) || 0;
    const huffHeave = isHuff ? Math.sin(t * 12.5) * 0.065 : 0;
    ud.flipPivot.rotation.set(0, 0, flipAng + rockZ);
    ud.flipPivot.scale.set(
      1 + bounceSquash * 0.28 + huffHeave * 0.5,
      Math.max(0.65, 1 - bounceSquash * 0.32 - huffHeave * 0.65),
      1 + bounceSquash * 0.28 + huffHeave * 0.5
    );

    // Body posture: edge-look turn, aggro squat, furious low-slung charge lean, or winded huff!
    const edgePeekYaw = isEdgeLook ? dir * 0.36 + Math.sin(t * 8.5) * 0.18 : 0;
    const targetYaw = flippedNow ? 0 : clamp(dir * 0.28 - eTheta * 0.35 + edgePeekYaw, -0.82, 0.82);
    st.yawSmooth = damp(st.yawSmooth, targetYaw, 9, dt);
    ud.body.rotation.y = st.yawSmooth;
    ud.body.position.y = 0;

    const rawTele =
      typeof en.telegraph === 'number'
        ? clamp(en.telegraph, 0, 1)
        : isAggroTell
          ? 0.85
          : smooth(0.55, 0.12, Math.abs(eTheta)) * (0.5 + 0.5 * Math.sin(t * 5.2 + st.seed * 6));
    const aggroK = flippedNow ? 0 : isAggroTell ? Math.max(0.45, rawTele) : 0;
    const squatDrop = -aggroK * 0.065 - st.chargeSmooth * 0.048 + huffHeave * 0.35;
    const chargePitch = st.chargeSmooth * 0.20 - aggroK * 0.22 + (isHuff ? 0.12 : 0);
    const chargeBank = -dir * st.chargeSmooth * 0.24;
    ud.localFrame.position.y = damp(ud.localFrame.position.y, -0.28 + squatDrop, 14, dt);
    ud.localFrame.rotation.set(
      damp(ud.localFrame.rotation.x, chargePitch, 14, dt),
      0,
      damp(ud.localFrame.rotation.z, chargeBank, 14, dt)
    );

    // Glowing Hydro-Bounce Springboard Ring above upturned belly!
    ud.bounceRing.visible = st.flipProgress > 0.55;
    if (ud.bounceRing.visible) {
      const pulse = (t * 2.0 + st.seed) % 1;
      ud.bounceRing.position.y = 0.44 + pulse * 0.20;
      ud.bounceRing.rotation.y = t * 1.8;
      ud.bounceRing.scale.setScalar(0.84 + pulse * 0.30);
      ud.bounceRing.material.opacity = (1 - pulse) * 0.58;
    }

    // Heavy alternating 6-leg sideways gait strictly scaled by `|velCol|` (0 leg skate when paused!)
    const gaitRate = flippedNow ? 18.0 : absVel > 0.04 ? absVel * (5.6 + st.chargeSmooth * 1.8) : 0;
    st.gaitPhase += gaitRate * dt;
    const moveAmp = flippedNow ? 1.0 : clamp(absVel / 0.85, 0, 1.35);
    for (let i = 0; i < ud.legs.length; i++) {
      const leg = ud.legs[i];
      const base = ud.baseLegsRot[i];
      const isLeft = i < 3;
      const tripodPhase = st.gaitPhase + ((i % 2 === 0) !== isLeft ? 0 : Math.PI) + i * 0.35;
      if (flippedNow) {
        // Frantic upside-down kicking legs!
        leg.rotation.z = base.z + Math.sin(tripodPhase * 1.4 + i) * 0.58;
        leg.rotation.y = base.y + Math.cos(tripodPhase * 1.15) * 0.34;
      } else {
        const splay = aggroK * 0.22 + st.chargeSmooth * 0.14;
        const lift = Math.max(0, Math.sin(tripodPhase)) * 0.36 * moveAmp;
        const sweep = Math.cos(tripodPhase) * 0.28 * dir * moveAmp;
        leg.rotation.z = base.z + (isLeft ? -(lift + splay) : lift + splay);
        leg.rotation.y = base.y + sweep;
      }
    }

    // Eye-stalk tracking (peering down at edge during `edge_look`)
    if (ud.eyeL && ud.eyeR) {
      const lookY = clamp(-eTheta * 0.45 + (isEdgeLook ? dir * 0.25 : 0), -0.5, 0.5);
      const lookX = isEdgeLook ? 0.24 : isHuff ? 0.18 : -aggroK * 0.16;
      ud.eyeL.rotation.set(lookX, lookY, 0);
      ud.eyeR.rotation.set(lookX, lookY, 0);
    }

    // Pincer choreography: double pincer-click on `edge_look`, raised snapping claws on `aggro_tell`,
    // forward battering ram on `charge`, drooping panting claws on `huff`!
    const snapCycle = flippedNow ? 0 : clamp(rawTele, 0, 1);
    let openClaw = snapCycle < 0.78 ? (snapCycle / 0.78) * 0.52 : -0.14;
    let armRaiseX = -snapCycle * 0.22;
    let armSpreadY = openClaw * 0.65;
    if (isEdgeLook) {
      // Crisp double pincer-click at terrace edge!
      const click = Math.pow(Math.max(0, Math.sin(t * 20.0)), 2);
      openClaw = click * 0.48;
      armRaiseX = -0.18 - click * 0.12;
      armSpreadY = 0.26;
    } else if (isAggroTell) {
      const snapOsc = 0.5 + 0.5 * Math.sin(t * 28.0);
      openClaw = 0.20 + snapOsc * 0.48;
      armRaiseX = -0.68 * aggroK;
      armSpreadY = 0.52 * aggroK;
    } else if (st.chargeSmooth > 0.1) {
      openClaw = 0.34 + 0.24 * Math.sin(t * 32.0);
      armRaiseX = -0.32 * st.chargeSmooth;
      armSpreadY = 0.22;
    } else if (isHuff) {
      openClaw = 0.08 + Math.max(0, huffHeave) * 0.8;
      armRaiseX = 0.26;
      armSpreadY = 0.12;
    }

    if (ud.armL && ud.armR) {
      ud.armL.rotation.y = -armSpreadY;
      ud.armR.rotation.y = armSpreadY;
      ud.armL.rotation.x = armRaiseX;
      ud.armR.rotation.x = armRaiseX;
    }
    if (ud.pincerUpL && ud.pincerLoL) {
      ud.pincerUpL.rotation.x = -openClaw;
      ud.pincerLoL.rotation.x = openClaw * 0.8;
    }
    if (ud.pincerUpR && ud.pincerLoR) {
      ud.pincerUpR.rotation.x = -openClaw;
      ud.pincerLoR.rotation.x = openClaw * 0.8;
    }

    const sparkActive = !flippedNow && (snapCycle > 0.48 || isAggroTell || st.chargeSmooth > 0.4);
    ud.sparkSprite.visible = sparkActive;
    if (ud.clawSparkMesh) ud.clawSparkMesh.visible = sparkActive;
    if (sparkActive) {
      ud.sparkSprite.material.opacity = 0.38 + 0.28 * Math.sin(t * 38);
      ud.sparkSprite.material.rotation = t * 14;
      const sc = 0.24 + Math.max(snapCycle, st.chargeSmooth) * 0.24;
      ud.sparkSprite.scale.set(sc, sc, 1);
    }

    if (ud.telegraphRing) {
      const teleAmt = Math.max(snapCycle, st.chargeSmooth * 0.85);
      const showTele = !flippedNow && teleAmt > 0.32;
      ud.telegraphRing.visible = showTele;
      if (showTele) {
        const k = clamp((teleAmt - 0.32) / 0.68, 0, 1);
        const pulse = 0.96 + k * 0.22 + Math.sin(t * 16) * 0.03;
        ud.telegraphRing.scale.setScalar(pulse);
        ud.telegraphRing.rotation.y = t * (0.95 + k * 0.85);
        ud.telegraphRing.material.color.setRGB(
          mix(0.92, 0.10, smooth(0.68, 0.96, teleAmt)),
          mix(0.32, 0.80, smooth(0.68, 0.96, teleAmt)),
          mix(0.14, 0.78, smooth(0.68, 0.96, teleAmt))
        );
        ud.telegraphRing.material.opacity = clamp(0.24 + k * 0.32, 0, 0.56);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. `gulp_hopper` — Gluttonous Ambush Bullfrog (`sit_watch`, `inflate` 1.45x, `leap`, `land_recover`)!
  // --------------------------------------------------------------------------
  _animateGulpHopper(ud, st, en, eTheta, isStunned, wx, wy, wz, t, dt) {
    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const velCol = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : st.vx;
    const velFloor = Number.isFinite(Number(en.velFloor)) ? Number(en.velFloor) : st.vy;
    const dir = en.dir < 0 ? -1 : 1;
    const floorBase = Math.round(en.baseFloor ?? en.floor);
    const heightAboveLedge = Math.max(0, en.floor - floorBase);
    const airborne = aiState === 'leap' || heightAboveLedge > 0.08 || Math.abs(velFloor) > 0.55;
    const isLandRecover = !airborne && aiState === 'land_recover';

    if (!airborne && !st.landed) {
      st.landed = true;
      st.wobbleT = 0;
      this._spawnSplashRing(wx, wy, wz, '#38bdf8');
    } else if (airborne && (heightAboveLedge > 0.10 || aiState === 'leap')) {
      st.landed = false;
    }
    st.wobbleT = Math.min(10, st.wobbleT + dt);

    // Dramatic 1.45x glowing turquoise belly/throat sac expansion during `inflate`!
    const autoInhale = airborne ? 0.12 : aiState === 'sit_watch' || isLandRecover ? 0.08 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 4.2 + st.seed * TWO_PI));
    const targetInflate =
      typeof en.inflatePhase === 'number' ? clamp(en.inflatePhase, 0, 1) : autoInhale;
    if (!isStunned) {
      st.inflateSmooth = damp(st.inflateSmooth, targetInflate, 12, dt);
    }

    const croakVib = !isStunned && !airborne && st.inflateSmooth > 0.18 ? Math.sin(t * 48.0) * 0.022 * st.inflateSmooth : 0;

    if (ud.waterCore) {
      const wScale = 0.38 + st.inflateSmooth * 1.07; // swells up to 1.45x!
      ud.waterCore.scale.set(
        wScale * (1 + Math.sin(t * 14) * 0.05 + croakVib),
        wScale * (1 - Math.sin(t * 14) * 0.05 - croakVib),
        wScale * (1 + st.inflateSmooth * 0.08)
      );
      ud.waterCore.rotation.y = t * (2.0 + st.inflateSmooth * 3.2);
    }
    if (ud.waterCoreMat) {
      ud.waterCoreMat.emissiveIntensity = 0.42 + st.inflateSmooth * 0.85;
    }
    if (ud.glassTank) {
      // Dramatic 1.45x glowing glass belly/throat sac expansion!
      const tScale = 0.92 + st.inflateSmooth * 0.53; // 0.92 -> 1.45x!
      ud.glassTank.scale.set(tScale * (1 + croakVib), tScale * (1 - croakVib * 0.5), tScale * (1 + st.inflateSmooth * 0.06));
    }
    if (ud.hopperBody) {
      ud.hopperBody.position.x = croakVib * 0.45;
    }

    // Gulper jaw croak flutter & suction vortex ring while inhaling!
    const inhaling = !isStunned && !airborne && (aiState === 'inflate' || st.inflateSmooth > 0.42);
    if (ud.jaw) {
      const targetJaw = inhaling ? 0.36 + st.inflateSmooth * 0.24 + Math.sin(t * 36) * 0.07 : 0.04;
      ud.jaw.rotation.x = damp(ud.jaw.rotation.x, targetJaw, 14, dt);
    }
    ud.inhaleRing.visible = inhaling;
    if (inhaling) {
      const suck = 1 - ((t * 3.4 + st.seed) % 1);
      ud.inhaleRing.position.z = 0.28 + suck * 0.22;
      ud.inhaleRing.rotation.z = t * 3.2;
      ud.inhaleRing.scale.setScalar(0.55 + suck * 0.72);
      ud.inhaleRing.material.opacity = (1 - suck) * 0.48;
    }

    if (!isStunned) {
      const jiggle = Math.exp(-st.wobbleT * 5.2) * Math.sin(st.wobbleT * 25.0) * 0.18;
      const recoverSquash = isLandRecover ? 0.22 * Math.exp(-st.wobbleT * 2.4) : 0;
      const crouch = !airborne ? st.inflateSmooth * 0.15 + recoverSquash : 0;
      const airStretch = airborne ? clamp(Math.abs(velFloor) * 0.05 + 0.22, 0, 0.32) : 0;

      const sy = clamp(1.0 - crouch + airStretch + jiggle, 0.66, 1.36);
      const sxz = clamp(1.0 + crouch * 0.78 - airStretch * 0.32 - jiggle * 0.48, 0.74, 1.36);
      ud.squashPivot.scale.set(sxz, sy, sxz);

      // Planted stationary crouch (`0` leg slide when `|velCol| < 0.05`) vs full stretched frog hind-leg leap!
      const legKick = airborne ? 1.18 : -0.12 - crouch * 0.48;
      const foreReach = airborne ? -0.58 : 0.0;
      if (ud.hindL) ud.hindL.rotation.x = damp(ud.hindL.rotation.x, legKick, 16, dt);
      if (ud.hindR) ud.hindR.rotation.x = damp(ud.hindR.rotation.x, legKick, 16, dt);
      if (ud.foreL) ud.foreL.rotation.x = damp(ud.foreL.rotation.x, foreReach, 14, dt);
      if (ud.foreR) ud.foreR.rotation.x = damp(ud.foreR.rotation.x, foreReach, 14, dt);

      // Head/body tracks Gateway cleanly while sitting!
      const targetYaw = clamp(dir * 0.48 - eTheta * 0.55, -0.95, 0.95);
      const leapPitch = airborne ? clamp(-velFloor * 0.042, -0.36, 0.36) : 0;
      const leapBank = airborne ? clamp(-velCol * 0.10, -0.26, 0.26) : 0;
      ud.body.rotation.x = damp(ud.body.rotation.x, leapPitch, 12, dt);
      ud.body.rotation.y = damp(ud.body.rotation.y, targetYaw, 10, dt);
      ud.body.rotation.z = damp(ud.body.rotation.z, leapBank, 12, dt);
      if (ud.eyeL && ud.eyeR) {
        const eyeTrack = clamp(-eTheta * 0.4, -0.35, 0.35);
        ud.eyeL.rotation.y = eyeTrack;
        ud.eyeR.rotation.y = eyeTrack;
      }
    }

    if (ud.contactShadow) {
      const hopShrink = airborne ? clamp(1 - heightAboveLedge * 0.45, 0.40, 0.90) : 1.0 + st.inflateSmooth * 0.22;
      ud.contactShadow.scale.set(0.88 * hopShrink, 1, 0.76 * hopShrink);
    }

    if (ud.telegraphRing) {
      const showTele = !isStunned && !airborne && st.inflateSmooth > 0.46;
      ud.telegraphRing.visible = showTele;
      if (showTele) {
        const k = clamp((st.inflateSmooth - 0.46) / 0.54, 0, 1);
        ud.telegraphRing.scale.setScalar(0.86 + k * 0.30 + Math.sin(t * 16) * 0.03);
        ud.telegraphRing.rotation.y = -t * (0.9 + k * 0.8);
        ud.telegraphRing.material.color.setHex(k > 0.65 ? 0xea7a1a : 0x0ea5e9);
        ud.telegraphRing.material.opacity = clamp(0.22 + k * 0.32, 0, 0.54);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. `volt_eel` — Speed-Matched S-Wave, Helical Ring Coil (`coil_tell`/`discharge`) & Dimmed `exhausted`!
  // --------------------------------------------------------------------------
  _animateVoltEel(ud, st, en, eTheta, cylRadius, isStunned, t, dt) {
    const segs = ud.segs;
    const n = segs.length;
    if (n === 0) return;

    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const velCol = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : st.vx;
    const velFloor = Number.isFinite(Number(en.velFloor)) ? Number(en.velFloor) : st.vy;
    const travelSpeed = Math.hypot(velCol, velFloor);
    const shockActive = !isStunned && Boolean(en.shockActive || aiState === 'discharge');
    const isExhausted = !isStunned && aiState === 'exhausted';
    const rawCoil =
      typeof en.coilBlend === 'number'
        ? clamp(en.coilBlend, 0, 1)
        : shockActive
          ? 1.0
          : aiState === 'coil_tell'
            ? clamp(Number(en.telegraph) || 0.75, 0.25, 1.0)
            : 0.0;
    st.coilSmooth = damp(st.coilSmooth || 0, isStunned || isExhausted ? 0 : rawCoil, 12, dt);

    const dir = en.dir < 0 ? -1 : 1;
    const isVert = Math.abs(velFloor) > Math.abs(velCol) * 1.4 && Math.abs(velFloor) > 0.35;

    if (!isStunned) {
      if (typeof en.slitherPhase === 'number') {
        st.slitherPhase = en.slitherPhase;
      } else {
        // Speed-matched travelling S-wave along spine segments!
        const rate = isExhausted ? 2.1 + travelSpeed * 2.2 : 2.2 + travelSpeed * 5.2 + (shockActive ? 12.0 : 0);
        st.slitherPhase += rate * dt;
      }
    }

    const segSpacing = 0.148;
    const waveAmp = isStunned ? 0.025 : isExhausted ? 0.055 : 0.14;
    const waveFreq = 0.84;
    const coilK = st.coilSmooth;
    const coilSpin = t * (shockActive ? 10.5 : 3.6);
    const coilRad = 0.23 - (shockActive ? 0.015 * Math.sin(t * 42) : 0);

    for (let k = 0; k < n; k++) {
      const sAlong = (2.15 - k) * segSpacing;
      const w0 = Math.sin(st.slitherPhase - k * waveFreq) * waveAmp;
      const w1 = Math.sin(st.slitherPhase - (k - 0.65) * waveFreq) * waveAmp;
      const sNext = sAlong + segSpacing * 0.65;

      // Exhausted drooped posture sags middle/tail segments downward!
      const droopY = isExhausted ? -(0.06 + Math.sin((k / 7) * Math.PI) * 0.085) : 0;

      let arc0;
      let y0;
      let arc1;
      let y1;
      if (isVert) {
        const vSign = velFloor >= 0 ? 1 : -1;
        arc0 = w0;
        y0 = sAlong * vSign;
        arc1 = w1;
        y1 = sNext * vSign;
      } else {
        arc0 = sAlong * dir;
        y0 = w0 + droopY;
        arc1 = sNext * dir;
        y1 = w1 + droopY;
      }

      const dTheta0 = arc0 / cylRadius;
      const dTheta1 = arc1 / cylRadius;
      const rOut = 0.03 * Math.cos(st.slitherPhase - k * waveFreq);

      _vA.set(
        (cylRadius + rOut) * Math.sin(dTheta0),
        y0,
        (cylRadius + rOut) * Math.cos(dTheta0) - cylRadius
      );
      _vB.set(
        (cylRadius + rOut) * Math.sin(dTheta1),
        y1,
        (cylRadius + rOut) * Math.cos(dTheta1) - cylRadius
      );

      if (coilK > 0.005) {
        // Morph smoothly into a tight crackling helical ring (`coil_tell` / `discharge`)!
        const ang0 = coilSpin - k * 0.76 * dir;
        const ang1 = coilSpin - (k - 0.65) * 0.76 * dir;
        const jitter = shockActive ? Math.sin(t * 64 + k * 3.1) * 0.016 : 0;
        const hx0 = Math.cos(ang0) * (coilRad + jitter);
        const hy0 = Math.sin(ang0) * (coilRad + jitter);
        const hz0 = (3.5 - k) * 0.024;
        const hx1 = Math.cos(ang1) * coilRad;
        const hy1 = Math.sin(ang1) * coilRad;
        const hz1 = (3.5 - (k - 0.65)) * 0.024;
        _vA.set(mix(_vA.x, hx0, coilK), mix(_vA.y, hy0, coilK), mix(_vA.z, hz0, coilK));
        _vB.set(mix(_vB.x, hx1, coilK), mix(_vB.y, hy1, coilK), mix(_vB.z, hz1, coilK));
      }

      const seg = segs[k];
      seg.position.copy(_vA);

      _vC.subVectors(_vB, _vA);
      if (_vC.lengthSq() < 1e-8) _vC.set(dir, 0, 0);
      _vC.normalize();
      _vUp.set(0, isVert && coilK < 0.5 ? 0 : 1, isVert && coilK < 0.5 ? 1 : 0.35 + coilK * 0.65).normalize();
      _vA.crossVectors(_vUp, _vC).normalize();
      _vUp.crossVectors(_vC, _vA).normalize();
      _mBasis.makeBasis(_vA, _vUp, _vC);
      _qSeg.setFromRotationMatrix(_mBasis);
      seg.quaternion.copy(_qSeg);
    }

    // Per-state emissive copper/cyan spine nodes (`discharge` blazing vs `exhausted` dimmed copper!)
    for (let mIdx = 0; mIdx < ud.eelEmissiveMats.length; mIdx++) {
      const em = ud.eelEmissiveMats[mIdx];
      const baseInt = em.userData?.baseIntensity ?? 0.62;
      if (isExhausted) {
        em.emissive.setHex(0x7c4a24); // dimmed warm copper recovery!
        em.emissiveIntensity = 0.14;
      } else if (shockActive) {
        em.emissive.setHex(0x38f9ff);
        em.emissiveIntensity = baseInt * 2.15 + 0.35 * Math.sin(t * 48);
      } else if (coilK > 0.15) {
        em.emissive.setHex(0x00f5ff);
        em.emissiveIntensity = baseInt * (1.0 + coilK * 0.95);
      } else {
        em.emissive.setHex(em.userData?.baseEmissiveHex ?? 0x06b6d4);
        em.emissiveIntensity = baseInt;
      }
    }

    if (ud.antennaL && ud.antennaR) {
      const antVib = shockActive ? Math.sin(t * 55) * 0.28 : isExhausted ? 0.35 : Math.sin(t * 14) * 0.08;
      ud.antennaL.rotation.x = antVib;
      ud.antennaR.rotation.x = -antVib;
    }

    if (ud.jaw && !isStunned) {
      const alert = shockActive ? 0.55 : isExhausted ? 0.32 : smooth(0.85, 0.18, Math.abs(eTheta)) * 0.30;
      ud.jaw.rotation.x = 0.12 + alert + (isExhausted ? 0.06 * Math.sin(t * 4.0) : 0.12 * Math.sin(t * 9.5 + st.seed * 5));
    }
    if (ud.arcFlash) {
      const crackle = !isStunned && !isExhausted && (shockActive || coilK > 0.25 || Math.sin(t * 37 + st.seed * 11) > -0.15);
      ud.arcFlash.visible = crackle;
      if (crackle) {
        const fSc = shockActive ? 0.72 + 0.18 * Math.sin(t * 50) : 0.36 + coilK * 0.26;
        ud.arcFlash.scale.set(fSc, fSc, 1);
        ud.arcFlash.material.rotation = t * (shockActive ? 32 : 19);
        ud.arcFlash.material.opacity = shockActive ? 0.95 : 0.58 + 0.34 * Math.sin(t * 45);
      }
    }

    if (ud.telegraphRing) {
      const prox = smooth(0.85, 0.16, Math.abs(eTheta));
      const rawTele = Math.max(coilK, shockActive ? 1.0 : 0, typeof en.telegraph === 'number' ? en.telegraph : isExhausted ? 0 : prox * 0.6);
      const showTele = !isStunned && !isExhausted && rawTele > 0.32;
      ud.telegraphRing.visible = showTele;
      if (showTele && segs[0]) {
        ud.telegraphRing.position.set(coilK > 0.4 ? 0 : segs[0].position.x, coilK > 0.4 ? 0 : segs[0].position.y, -0.06);
        const k = clamp((rawTele - 0.32) / 0.68, 0, 1);
        const pulse = (shockActive ? 0.72 : 0.46 + k * 0.22) + Math.sin(t * 24) * 0.04;
        ud.telegraphRing.scale.setScalar(pulse);
        ud.telegraphRing.rotation.set(Math.PI * 0.5, 0, t * (shockActive ? 3.8 : 1.4));
        ud.telegraphRing.material.color.setHex(shockActive || rawTele > 0.72 ? 0x22f0e8 : 0x0284c7);
        ud.telegraphRing.material.opacity = clamp(0.24 + k * 0.32, 0, 0.58);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. `rail_skater` — Hyperactive Clockwork Strider (`sprint`, `spark_brake`, `windup` key spin)!
  // --------------------------------------------------------------------------
  _animateRailSkater(ud, st, en, eTheta, isStunned, t, dt) {
    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const velCol = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : st.vx;
    const velFloor = Number.isFinite(Number(en.velFloor)) ? Number(en.velFloor) : st.vy;
    const dir = en.dir < 0 ? -1 : 1;
    const isVert = en.type === 'robotV' || en.kind === 'vpat' || Boolean(en.vertical);
    const isWindup = !isStunned && aiState === 'windup';
    const rawBrake = clamp(Number(en.brakeBlend) || (aiState === 'spark_brake' ? 1 : 0), 0, 1);
    st.brakeSmooth = damp(st.brakeSmooth || 0, isStunned ? 0 : rawBrake, 16, dt);

    if (!isStunned) {
      const brk = st.brakeSmooth;
      const rpm = isWindup ? -14.0 : brk > 0.2 ? 4.0 : isVert ? 22.0 : 20.0 + Math.abs(velCol) * 3.5;
      if (ud.impellerL) ud.impellerL.rotation.z += rpm * dt;
      if (ud.impellerR) ud.impellerR.rotation.z -= rpm * dt;

      // Dorsal clockwork key spins rapidly on `windup`, ticks steadily during `sprint`!
      if (ud.clockworkKey) {
        const keyRate = isWindup ? 26.0 : brk > 0.2 ? 0.5 : 3.6;
        ud.clockworkKey.rotation.y += keyRate * dt;
      }

      // High-frequency chassis friction tremble & drop during `spark_brake`!
      const brakeJitterX = brk > 0.08 ? Math.sin(t * 64) * 0.022 * brk : 0;
      const brakeJitterY = brk > 0.08 ? Math.cos(t * 58) * 0.014 * brk : 0;
      const hoverBob = Math.sin(t * 6.8 + st.seed * TWO_PI) * 0.032 * (1 - brk * 0.8);
      ud.body.position.set(brakeJitterX, hoverBob - brk * 0.036 + brakeJitterY, 0);

      // Sharp forward sprint bank vs pitched-back two-skate heel lock (`spark_brake`) & crisp 180° `windup` snap!
      const targetYaw = isVert ? 0 : clamp(dir * (isWindup ? 0.72 : 0.52) - eTheta * 0.20, -0.85, 0.85);
      const sprintBank = -dir * clamp(0.18 + Math.abs(velCol) * 0.08, 0.18, 0.38);
      const brakeHeelBank = dir * 0.40 * brk;
      const targetBank = isVert ? Math.sin(t * 4.2) * 0.08 : mix(sprintBank, brakeHeelBank, brk);
      const targetPitch = isVert
        ? clamp(-velFloor * 0.08, -0.28, 0.28)
        : isWindup
          ? -0.14 + Math.sin(t * 36) * 0.06
          : mix(0.20, -0.36, brk);

      const yawLambda = isWindup ? 26 : 11; // crisp 180° mechanical escapement snap!
      ud.body.rotation.set(
        damp(ud.body.rotation.x, targetPitch, 14, dt),
        damp(ud.body.rotation.y, targetYaw, yawLambda, dt),
        damp(ud.body.rotation.z, targetBank, 14, dt)
      );

      // Articulated skates: front skids lift & rear heels lock into stone during `spark_brake`!
      for (let i = 0; i < ud.skids.length; i++) {
        const sk = ud.skids[i];
        const side = i % 2 === 0 ? -1 : 1;
        const isFront = i < 2;
        const heelLockPitch = brk * (isFront ? -0.34 : 0.32);
        sk.rotation.z = side * (0.08 + brk * 0.16 + Math.sin(t * 7.5 + i * 1.4) * 0.09 * (1 - brk));
        sk.rotation.x = heelLockPitch + Math.cos(t * 6.4 + i) * 0.06 * (1 - brk);
      }

      if (ud.scannerEye) {
        const lock = smooth(0.9, 0.2, Math.abs(eTheta));
        const sweep = Math.sin(t * 4.8 + st.seed * 7) * 0.1;
        const track = clamp(-eTheta * 0.18, -0.11, 0.11);
        ud.scannerEye.position.x = mix(sweep, track, lock);
      }

      const jetActive = brk < 0.65 && !isWindup;
      const jetPulse = (0.92 + Math.abs(velCol) * 0.14) + 0.30 * Math.sin(t * 34 + st.seed * 9);
      if (ud.jetL) {
        ud.jetL.visible = jetActive;
        if (jetActive) ud.jetL.scale.set(1, 1, jetPulse);
      }
      if (ud.jetR) {
        ud.jetR.visible = jetActive;
        if (jetActive) ud.jetR.scale.set(1, 1, jetPulse);
      }
      ud.wakeTrail.visible = true;
      ud.wakeTrail.material.color.setHex(brk > 0.25 ? 0xf97316 : 0x5efce8);
      ud.wakeTrail.scale.set(0.82 + brk * 0.35 + Math.sin(t * 16) * 0.14, 0.38 + brk * 0.18, 1);

      if (ud.telegraphRing) {
        const tele = Math.max(brk, isWindup ? 0.75 : 0, typeof en.telegraph === 'number' ? en.telegraph : 0);
        const showTele = tele > 0.32;
        ud.telegraphRing.visible = showTele;
        if (showTele) {
          const k = clamp((tele - 0.32) / 0.68, 0, 1);
          ud.telegraphRing.scale.setScalar(0.92 + k * 0.24 + Math.sin(t * 16) * 0.03);
          ud.telegraphRing.rotation.y = t * (1.1 + k * 0.9);
          ud.telegraphRing.material.color.setHex(brk > 0.3 ? 0xf97316 : tele > 0.7 ? 0xdc2646 : 0x0ea5e9);
          ud.telegraphRing.material.opacity = clamp(0.22 + k * 0.30, 0, 0.52);
        }
      }
    } else {
      if (ud.jetL) ud.jetL.visible = false;
      if (ud.jetR) ud.jetR.visible = false;
      ud.wakeTrail.visible = false;
      if (ud.telegraphRing) ud.telegraphRing.visible = false;
    }
  }

  // --------------------------------------------------------------------------
  // 5. `barnacle_mortar` — Paranoid Siege Hermit (`watch` periscope, `swell_tell`, `lob_recoil`, `shell_hide` dome)!
  // --------------------------------------------------------------------------
  _animateBarnacleMortar(ud, st, en, isStunned, wx, wy, wz, t, dt) {
    const stepDt = dt > 0 && dt <= 0.1 ? dt : 1 / 60;
    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const rawHide = clamp(Number(en.shellHide) || (aiState === 'shell_hide' ? 1 : 0), 0, 1);
    st.hideSmooth = damp(st.hideSmooth || 0, isStunned ? 0 : rawHide, 16, stepDt);
    const hideK = st.hideSmooth;

    let openAmt;
    if (hideK > 0.05) {
      openAmt = 0;
    } else if (typeof en.openAmount === 'number') {
      openAmt = clamp(en.openAmount, 0, 1);
    } else if (aiState === 'swell_tell') {
      openAmt = clamp(typeof en.telegraph === 'number' ? Math.max(0.35, en.telegraph) : 0.85, 0, 1);
    } else if (aiState === 'lob_recoil') {
      openAmt = 0.22;
    } else if (aiState === 'watch') {
      openAmt = 0.08;
    } else if (typeof en.telegraph === 'number') {
      openAmt = clamp(en.telegraph, 0, 1);
    } else {
      const cyc = (t * 0.42 + st.seed) % 1;
      openAmt =
        cyc < 0.45
          ? 0.08
          : cyc < 0.84
            ? smooth(0.45, 0.84, cyc)
            : 1.0 - smooth(0.84, 0.96, cyc);
    }
    if (isStunned) openAmt *= 0.25;

    // Detect `lob_recoil` or sharp bubble-pop release -> upward mortar kickback squash + splash ring!
    if ((aiState === 'lob_recoil' && st.recoilT > 0.35) || (st.mortarOpenPrev > 0.72 && openAmt < 0.42 && hideK < 0.1)) {
      st.recoilT = 0;
      this._spawnSplashRing(wx, wy + 0.55, wz, '#38bdf8');
    }
    st.mortarOpenPrev = openAmt;
    st.recoilT = Math.min(10, (st.recoilT ?? 9) + stepDt);

    const recoilKick = Math.exp(-st.recoilT * 6.5) * Math.sin(st.recoilT * 24.0) * 0.24;

    // Swiveling brass periscope tracking yaw (`watch`), retracting inside dome during `shell_hide`!
    const dir = en.dir < 0 ? -1 : 1;
    const trackYaw = dir * 0.45 + Math.sin(t * 1.9 + st.seed * 5) * 0.28;
    if (ud.turret) {
      ud.turret.rotation.y = damp(ud.turret.rotation.y, trackYaw * (1 - hideK), 8, stepDt);
    }
    if (ud.periscope) {
      ud.periscope.visible = hideK < 0.88;
      ud.periscope.position.y = 0.42 - hideK * 0.24 + Math.sin(t * 3.2) * 0.015 * (1 - hideK);
      ud.periscope.rotation.y = trackYaw * 1.35 + Math.sin(t * 2.8) * 0.22;
    }

    // Pressure shudder during `swell_tell` OR clamped-shell panic tremor on `shell_hide`
    const shudder = !isStunned ? (openAmt > 0.42 ? (openAmt - 0.42) * 0.034 : hideK > 0.5 ? 0.008 : 0) : 0;
    ud.body.position.set(
      Math.sin(t * 54 + st.seed * 8) * shudder,
      0,
      Math.cos(t * 47 + st.seed * 5) * shudder
    );
    const bodySy = clamp(1.0 - recoilKick - hideK * 0.12, 0.72, 1.26);
    const bodySxz = clamp(1.0 + recoilKick * 0.65 + hideK * 0.07, 0.84, 1.24);
    ud.body.scale.set(bodySxz, bodySy, bodySxz);

    // 5 armored petals: peel wide open (`-1.18 rad`) on `swell_tell`, OR clamp tightly shut (`+0.42 rad`) into an impenetrable dome on `shell_hide`!
    const targetPetalX = hideK > 0.02 ? mix(-0.06, 0.42, hideK) : -(0.06 + openAmt * 1.12 + Math.max(0, recoilKick) * 0.45);
    for (let i = 0; i < ud.petals.length; i++) {
      const flutter = !isStunned && hideK < 0.1 ? Math.sin(t * 13 + i * 1.25) * 0.038 * openAmt : 0;
      ud.petals[i].rotation.x = damp(ud.petals[i].rotation.x, targetPetalX - flutter, 16, stepDt);
    }

    // Glowing amber sac / bubble swell!
    if (ud.mortarBubble) {
      const bubVis = openAmt > 0.14 && hideK < 0.2 && !isStunned;
      ud.mortarBubble.visible = bubVis;
      if (bubVis) {
        const bSc = 0.28 + openAmt * 1.02;
        const wob = 1 + Math.sin(t * 18) * 0.08 * openAmt;
        ud.mortarBubble.scale.set(bSc * wob, bSc * (2 - wob), bSc * wob);
        ud.mortarBubble.position.y = 0.44 + openAmt * 0.22;
        ud.mortarBubble.rotation.set(t * 1.6, t * 2.4, 0);
      }
    }
    if (ud.pressureCore) {
      ud.pressureCore.visible = hideK < 0.75;
      ud.pressureCore.scale.setScalar(0.84 + openAmt * 0.44);
      ud.pressureCore.rotation.y = t * (1.6 + openAmt * 3.0);
    }

    ud.pressureHalo.visible = hideK < 0.5;
    ud.pressureHalo.material.color.setRGB(
      mix(0.95, 0.12, openAmt * 0.7),
      mix(0.45, 0.78, openAmt),
      mix(0.10, 0.82, openAmt)
    );
    ud.pressureHalo.material.opacity = isStunned ? 0.06 : (0.12 + openAmt * 0.28) * (1 - hideK);
    const hSc = 0.52 + openAmt * 0.34;
    ud.pressureHalo.scale.set(hSc, hSc, 1);

    if (ud.telegraphRing) {
      const showTele = !isStunned && hideK < 0.2 && openAmt > 0.26;
      ud.telegraphRing.visible = showTele;
      if (showTele) {
        const k = clamp((openAmt - 0.26) / 0.74, 0, 1);
        ud.telegraphRing.scale.setScalar(0.95 + k * 0.28 + Math.sin(t * 16) * 0.03);
        ud.telegraphRing.rotation.y = t * (0.8 + k * 0.9);
        ud.telegraphRing.material.color.setRGB(
          mix(0.92, 0.08, k),
          mix(0.36, 0.76, k),
          mix(0.12, 0.74, k)
        );
        ud.telegraphRing.material.opacity = clamp(0.22 + k * 0.33, 0, 0.55);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 6. `vent_stalker` — Brooding Thermal Salamander (`stalk`, `sniff`, `hiss_tell` cap rattle, `erupt`, `cooldown`)!
  // --------------------------------------------------------------------------
  _animateVentStalker(ud, st, en, eTheta, isStunned, t, dt) {
    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const velCol = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : st.vx;
    const velFloor = Number.isFinite(Number(en.velFloor)) ? Number(en.velFloor) : st.vy;
    const moveMag = Math.hypot(velCol, velFloor);
    const dir = en.dir < 0 ? -1 : 1;
    const isHissTell = !isStunned && aiState === 'hiss_tell';
    const isErupt = !isStunned && Boolean(en.venting || aiState === 'erupt');
    const isCooldown = !isStunned && aiState === 'cooldown';
    const isSniff = !isStunned && (aiState === 'sniff' || (!isHissTell && !isErupt && !isCooldown && moveMag < 0.05));

    if (!isStunned) {
      // Heavy 4-limb salamander crawl strictly synced to vertical & horizontal movement!
      const gaitSpeed = isHissTell || isErupt ? 0 : moveMag > 0.04 ? moveMag * 5.8 : 0;
      st.gaitPhase += gaitSpeed * dt;

      const isClimbingVert = Math.abs(velFloor) > Math.abs(velCol) * 1.15 && Math.abs(velFloor) > 0.12;
      const targetYaw = isClimbingVert ? clamp(-eTheta * 0.35, -0.55, 0.55) : clamp(dir * 1.08 - eTheta * 0.22, -1.32, 1.32);
      const climbPitch = isClimbingVert ? clamp(-velFloor * 0.22, -0.34, 0.34) : 0;
      ud.body.rotation.y = damp(ud.body.rotation.y, targetYaw, 9, dt);
      ud.body.rotation.x = damp(ud.body.rotation.x, climbPitch, 9, dt);

      const moveBlend = clamp(moveMag / 0.65, 0, 1.2);
      const sway = Math.sin(st.gaitPhase) * 0.14 * moveBlend;
      const archY = isHissTell ? 0.048 + Math.sin(t * 48) * 0.008 : isErupt ? 0.032 : isCooldown ? -0.022 + Math.sin(t * 3.4) * 0.010 : 0;
      const archPitch = isHissTell ? 0.22 : isErupt ? -0.14 : isCooldown ? 0.08 : 0;

      if (ud.stalkerBody) {
        ud.stalkerBody.position.y = damp(ud.stalkerBody.position.y || 0, archY, 14, dt);
        ud.stalkerBody.rotation.x = damp(ud.stalkerBody.rotation.x || 0, archPitch, 14, dt);
        ud.stalkerBody.rotation.y = sway * 0.48;
      }
      if (ud.head) {
        const sniffYaw = isSniff ? Math.sin(t * 7.2) * 0.32 : 0;
        const sniffPitch = isSniff ? -0.18 + Math.sin(t * 11.0) * 0.09 : isHissTell ? -0.26 : isErupt ? -0.34 : isCooldown ? 0.18 : 0;
        ud.head.rotation.y = clamp(-eTheta * 0.35 - sway * 0.6 + sniffYaw, -0.62, 0.62);
        ud.head.rotation.x = damp(ud.head.rotation.x, sniffPitch, 12, dt);
      }
      if (ud.tail1) ud.tail1.rotation.y = -sway * 1.65 + (isHissTell ? Math.sin(t * 36) * 0.12 : 0);
      if (ud.tail2) ud.tail2.rotation.y = Math.sin(st.gaitPhase - 1.1) * 0.36 * moveBlend;

      // Planted braced claws during `hiss_tell`/`erupt` vs heavy diagonal reptile crawl!
      const brace = isHissTell || isErupt ? 0.28 : 0;
      const strideA = Math.sin(st.gaitPhase) * 0.42 * moveBlend;
      const strideB = Math.sin(st.gaitPhase + Math.PI) * 0.42 * moveBlend;
      if (ud.legFL) {
        ud.legFL.rotation.x = strideA - brace;
        ud.legFL.rotation.z = -brace * 0.6;
      }
      if (ud.legBR) {
        ud.legBR.rotation.x = strideA + brace;
        ud.legBR.rotation.z = brace * 0.6;
      }
      if (ud.legFR) {
        ud.legFR.rotation.x = strideB - brace;
        ud.legFR.rotation.z = brace * 0.6;
      }
      if (ud.legBL) {
        ud.legBL.rotation.x = strideB + brace;
        ud.legBL.rotation.z = -brace * 0.6;
      }
    }

    // 3 Hinged Brass Chimney Caps: rapid rattle on `hiss_tell`, wide-open `1.28 rad` on `erupt`, relaxed on `cooldown`!
    if (ud.chimneyCaps) {
      for (let i = 0; i < ud.chimneyCaps.length; i++) {
        const cap = ud.chimneyCaps[i];
        let capAng = 0.12 + Math.sin(t * 3.5 + i) * 0.05;
        if (isHissTell) {
          capAng = 0.28 + Math.abs(Math.sin(t * 58.0 + i * 2.1)) * 0.48;
        } else if (isErupt) {
          capAng = 1.28 + Math.sin(t * 24.0 + i) * 0.08;
        } else if (isCooldown) {
          capAng = 0.04;
        }
        cap.rotation.z = capAng;
      }
    }

    // Dorsal chimney glow: blazing orange-cyan on `erupt`, pulsing amber on `hiss_tell`, dimmed on `cooldown`!
    if (ud.ventMat) {
      if (isErupt) {
        ud.ventMat.emissive.setHex(0xff7b24);
        ud.ventMat.emissiveIntensity = 2.45 + 0.35 * Math.sin(t * 34);
      } else if (isHissTell) {
        ud.ventMat.emissive.setHex(0xf97316);
        ud.ventMat.emissiveIntensity = 1.55 + 0.45 * Math.sin(t * 42);
      } else if (isCooldown) {
        ud.ventMat.emissive.setHex(0x1e3a4c);
        ud.ventMat.emissiveIntensity = 0.16;
      } else {
        ud.ventMat.emissive.setHex(0x22d3ee);
        ud.ventMat.emissiveIntensity = 0.95;
      }
    }

    // Steam/plume sprites scaled cleanly by state (`erupt` vertical scalding plume vs `cooldown` faint wisp!)
    for (let i = 0; i < ud.plumes.length; i++) {
      const sp = ud.plumes[i];
      if (isStunned) {
        sp.visible = false;
        continue;
      }
      sp.visible = true;
      const rate = isErupt ? 2.6 : isHissTell ? 1.8 : isCooldown ? 0.45 : 0.95;
      const life = (t * rate + st.seed + i / 3) % 1;
      const maxRise = isErupt ? 1.28 : isHissTell ? 0.58 : isCooldown ? 0.24 : 0.46;
      sp.position.set(
        Math.sin(t * (isErupt ? 9.5 : 3.5) + i * 2.1) * (isErupt ? 0.05 : 0.08),
        0.44 + life * maxRise,
        (i - 1) * 0.11
      );
      const pSc = (isErupt ? 0.34 + life * 0.58 : isCooldown ? 0.14 + life * 0.16 : 0.20 + life * 0.32);
      sp.scale.set(pSc, isErupt ? pSc * 1.35 : pSc, 1);
      sp.material.color.setHex(isErupt ? (i % 2 === 0 ? 0xfed7aa : 0xe0f2fe) : isHissTell ? 0xfdba74 : 0xa5f3fc);
      sp.material.rotation = life * 1.4 + i;
      sp.material.opacity = Math.sin(life * Math.PI) * (isErupt ? 0.88 : isHissTell ? 0.72 : isCooldown ? 0.22 : 0.52);
    }

    if (ud.telegraphRing) {
      const surge = isErupt ? 1.0 : isHissTell ? Math.max(0.55, Number(en.telegraph) || 0.75) : isCooldown ? 0 : Number(en.telegraph) || 0;
      const showTele = !isStunned && surge > 0.32;
      ud.telegraphRing.visible = showTele;
      if (showTele) {
        const k = clamp((surge - 0.32) / 0.68, 0, 1);
        ud.telegraphRing.scale.setScalar(0.92 + k * 0.26 + Math.sin(t * 18) * 0.03);
        ud.telegraphRing.rotation.y = -t * (0.9 + k * 0.9);
        ud.telegraphRing.material.color.setHex(isErupt ? 0xf97316 : 0xea580c);
        ud.telegraphRing.material.opacity = clamp(0.24 + k * 0.32, 0, 0.56);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7. `siphon_warden` — 5-Act Sovereign Bosses (`patrol`, Act-Signature `telegraph`, `vulnerable` open core)!
  // --------------------------------------------------------------------------
  _animateSiphonWarden(ud, st, en, eTheta, isStunned, wx, wy, wz, t, dt) {
    const aiState = typeof en.aiState === 'string' ? en.aiState : '';
    const velCol = Number.isFinite(Number(en.velCol)) ? Number(en.velCol) : st.vx;
    const dir = en.dir < 0 ? -1 : 1;

    // Resolve 3-Phase Boss Escalation + 5-Act Signature (`actSignature`: 1..5 or string)
    let phase = Number(en.bossPhase) || 0;
    if (!(phase >= 1)) {
      const hpRatio = en.maxHp > 0 ? (Number(en.hp) || 0) / Number(en.maxHp) : 1;
      phase = hpRatio <= 0.34 ? 3 : hpRatio <= 0.67 ? 2 : 1;
    }
    phase = clamp(Math.round(phase), 1, 3);
    const phaseBoost = phase === 3 ? 2.05 : phase === 2 ? 1.45 : 1.0;

    const rawSig = en.actSignature ?? en.act ?? 1;
    const sigStr = String(rawSig).toLowerCase();
    const actNum =
      typeof rawSig === 'number'
        ? clamp(Math.round(rawSig), 1, 5)
        : sigStr.includes('2') || sigStr.includes('beam') || sigStr.includes('cryo')
          ? 2
          : sigStr.includes('3') || sigStr.includes('slam') || sigStr.includes('tentacle')
            ? 3
            : sigStr.includes('4') || sigStr.includes('shield') || sigStr.includes('aegis')
              ? 4
              : sigStr.includes('5') || sigStr.includes('leviathan')
                ? 5
                : 1;

    const coreExposed = Boolean(en.coreExposed || en.exposedTimer > 0 || en.vulnerable || aiState === 'vulnerable');
    const rawTele = coreExposed
      ? 0
      : typeof en.telegraph === 'number'
        ? clamp(en.telegraph, 0, 1)
        : aiState === 'telegraph'
          ? 0.78
          : 0;
    const chargeAmt = coreExposed
      ? 0
      : clamp(Math.max(Number(en.chargeBlend) || 0, actNum === 1 && rawTele > 0.1 ? rawTele : 0), 0, 1);
    const beamAmt = coreExposed
      ? 0
      : clamp(
          Math.max(
            Number(en.beamCharge) || 0,
            en.beamActive ? 1.0 : 0,
            en.attackType === 'hydro_beam' || actNum === 2 || actNum === 5 ? rawTele : 0
          ),
          0,
          1
        );
    const slamAmt = coreExposed
      ? 0
      : clamp(
          Math.max(
            Number(en.tentacleSlam) || 0,
            Number(en.slamPhase) || 0,
            en.attackType === 'tentacle_slam' || actNum === 3 || actNum === 5 ? rawTele : 0
          ),
          0,
          1
        );
    const isShielded = !coreExposed && Boolean(en.shielded || (actNum === 4 && rawTele > 0.2));
    const hitJolt = st.hitFlashT > 0 ? Math.sin((st.hitFlashT / 0.26) * Math.PI) : 0;

    if (slamAmt > 0.82 && !st.slamTriggered) {
      st.slamTriggered = true;
      this._spawnSplashRing(wx, wy - 0.55, wz, phase >= 3 ? '#ff4d8d' : '#22f0e8');
    } else if (slamAmt < 0.35) {
      st.slamTriggered = false;
    }

    if (!isStunned) {
      const phaseJitter = phase >= 3 && !coreExposed ? Math.sin(t * 46) * 0.024 : phase === 2 && !coreExposed ? Math.sin(t * 28) * 0.01 : 0;
      const slamDip = slamAmt > 0.65 ? -((slamAmt - 0.65) / 0.35) * 0.22 : slamAmt * 0.14;
      const vulnSlumpY = coreExposed ? -0.14 + Math.sin(t * 3.2) * 0.025 : 0;
      ud.body.position.set(
        phaseJitter,
        (coreExposed ? vulnSlumpY : Math.sin(t * 2.4 * phaseBoost + st.seed * TWO_PI) * 0.08 + slamDip - chargeAmt * 0.08),
        -hitJolt * 0.16 + beamAmt * 0.12 + chargeAmt * 0.14
      );

      // Distinct body language: bulldozer charge lean (Act 1), beam lock (Act 2), slam rear-back (Act 3), sagging slump (`vulnerable`)!
      const targetYaw = clamp(-eTheta * 0.55 + chargeAmt * dir * 0.32, -0.78, 0.78);
      const slamPitch = slamAmt < 0.62 ? -slamAmt * 0.44 : ((slamAmt - 0.62) / 0.38) * 0.50;
      const bulldozerPitch = chargeAmt * 0.36;
      const vulnPitch = coreExposed ? 0.18 : 0;
      const prowlBank = coreExposed ? 0 : -velCol * 0.06 - dir * chargeAmt * 0.26 + Math.sin(t * 1.6 * phaseBoost + st.seed * 4) * 0.05;
      ud.body.rotation.set(
        damp(ud.body.rotation.x, vulnPitch + bulldozerPitch + rawTele * 0.12 + slamPitch - hitJolt * 0.24, 10, dt),
        damp(ud.body.rotation.y, targetYaw, 6, dt),
        damp(ud.body.rotation.z, clamp(prowlBank, -0.38, 0.38), 10, dt)
      );

      const coreSpin = coreExposed ? 0.8 : (2.4 + rawTele * 5.2 + beamAmt * 7.0 + chargeAmt * 4.0) * phaseBoost;
      if (ud.coreOuter) {
        ud.coreOuter.rotation.z += coreSpin * dt;
        ud.coreOuter.rotation.y = coreExposed ? 0.08 * Math.sin(t * 6) : Math.sin(t * 1.8 * phaseBoost) * 0.36;
      }
      if (ud.coreInner) {
        ud.coreInner.rotation.x = coreExposed ? 0.12 * Math.cos(t * 6) : ud.coreInner.rotation.x - coreSpin * 1.35 * dt;
        ud.coreInner.rotation.z = t * (coreExposed ? 0.6 : 1.9 * phaseBoost);
      }
      if (ud.singularity) {
        const beat =
          (coreExposed ? 1.46 : 1.0) +
          0.18 * Math.sin(t * (9.5 + phase * 3.0)) +
          Math.max(rawTele, beamAmt) * 0.34;
        ud.singularity.scale.setScalar(beat);
      }

      // 4 Orbiting Aegis Shields: wide-open peeled core plates on `vulnerable`, tight phalanx on Act 4 / `isShielded`, battering prow on `chargeAmt`!
      if (ud.shieldOrbit) {
        const orbitRate = coreExposed ? 0.35 : isShielded ? 3.4 * phaseBoost : 1.35 * phaseBoost;
        ud.shieldOrbit.rotation.z += orbitRate * dt;
      }
      for (let i = 0; i < ud.shields.length; i++) {
        const sh = ud.shields[i];
        const sa = (i * TWO_PI) / 4 + Math.PI * 0.25;
        const rad = coreExposed
          ? 0.92 + Math.sin(t * 5 + i) * 0.03
          : isShielded
            ? 0.30
            : chargeAmt > 0.2
              ? 0.44
              : 0.58 + rawTele * 0.18 + (phase - 1) * 0.04 + Math.sin(t * 3.2 + i) * 0.04;
        sh.position.set(
          Math.cos(sa) * rad,
          Math.sin(sa) * rad,
          coreExposed ? -0.20 : isShielded || chargeAmt > 0.2 ? 0.18 : 0.02
        );
        sh.rotation.y = coreExposed ? 1.24 : chargeAmt > 0.2 ? -0.35 : rawTele * 0.55 + (phase >= 2 ? 0.22 : 0);
      }

      // 4 Segmented Kraken-Mech Tentacles: patrol sweep, overhead slam raise, beam tuning-fork array, bulldozer sweep-back, OR heavy sagging `vulnerable`!
      for (let i = 0; i < ud.tentacles.length; i++) {
        const tn = ud.tentacles[i];
        const sx = i % 2 === 0 ? -1 : 1;
        const wave = Math.sin(t * 3.4 * phaseBoost + i * 1.35);
        let pitchX = rawTele * 0.45 + wave * (0.16 + (phase - 1) * 0.06);
        let spreadY = sx * (-rawTele * 0.35 + Math.cos(t * 2.6 * phaseBoost + i) * 0.18);
        let tipCurl = rawTele * 0.48 + Math.cos(t * 4.8 * phaseBoost + i) * 0.28;

        if (coreExposed) {
          // Limp, heavy sagging tentacles exposing the glowing core!
          pitchX = 0.62 + Math.sin(t * 2.2 + i) * 0.07;
          spreadY = sx * 0.64;
          tipCurl = 0.48;
        } else if (slamAmt > 0.04) {
          pitchX = slamAmt < 0.6 ? mix(wave * 0.15, -1.04, slamAmt / 0.6) : mix(-1.04, 1.15, (slamAmt - 0.6) / 0.4);
          spreadY = sx * (slamAmt < 0.6 ? 0.38 : -0.56);
          tipCurl = slamAmt > 0.6 ? 0.98 : -0.45 * slamAmt;
        } else if (beamAmt > 0.12) {
          // Cryo/Hydro-Beam 4-point tuning-fork channeling array!
          pitchX = 0.28 * beamAmt + wave * 0.06;
          spreadY = sx * (0.66 * beamAmt);
          tipCurl = -0.38 * beamAmt;
        } else if (chargeAmt > 0.12) {
          // Bulldozer ram jet-swept tentacles!
          pitchX = -0.48 * chargeAmt + wave * 0.08;
          spreadY = sx * 0.24;
          tipCurl = 0.32;
        } else if (actNum === 4 && rawTele > 0.15) {
          // Aegis summon upward gesture!
          pitchX = i < 2 ? -0.85 * rawTele : 0.22;
          spreadY = sx * 0.48;
        }

        tn.rotation.set(
          damp(tn.rotation.x, pitchX, 12, dt),
          damp(tn.rotation.y, spreadY, 12, dt),
          sx * wave * (coreExposed ? 0.06 : 0.22 + (phase - 1) * 0.07)
        );
        if (ud.tentacleTips[i]) {
          ud.tentacleTips[i].rotation.x = damp(ud.tentacleTips[i].rotation.x, tipCurl, 14, dt);
        }
      }
    }

    if (ud.exposedRingOuter && ud.exposedRingInner) {
      const showExp = coreExposed && !isStunned;
      ud.exposedRingOuter.visible = showExp;
      ud.exposedRingInner.visible = showExp;
      if (showExp) {
        const pulse = 1.0 + 0.14 * Math.sin(t * 14);
        ud.exposedRingOuter.scale.setScalar(pulse);
        ud.exposedRingOuter.rotation.z = t * 3.2;
        ud.exposedRingOuter.material.opacity = 0.72 + 0.25 * Math.sin(t * 14);
        ud.exposedRingInner.scale.setScalar(1.16 - 0.12 * Math.sin(t * 14));
        ud.exposedRingInner.rotation.z = -t * 5.2;
        ud.exposedRingInner.material.opacity = 0.85;
      }
    }

    if (ud.beamChargeOrb) {
      const showBeam = (beamAmt > 0.08 || (rawTele > 0.35 && !coreExposed)) && !isStunned;
      ud.beamChargeOrb.visible = showBeam;
      if (showBeam) {
        const bMag = Math.max(beamAmt, rawTele);
        const bSc = 0.42 + bMag * 0.68 + Math.sin(t * 24) * 0.06;
        ud.beamChargeOrb.scale.setScalar(bSc);
        ud.beamChargeOrb.rotation.set(t * 5, t * 7, 0);
        const orbHex = actNum === 2 ? 0x38bdf8 : phase >= 3 ? 0xe11d48 : phase === 2 ? 0xd946ef : 0x0ea5e9;
        ud.beamChargeOrb.material.color.setHex(orbHex);
        ud.beamChargeOrb.material.emissive.setHex(orbHex);
        ud.beamChargeOrb.material.opacity = clamp(0.28 + bMag * 0.36, 0, 0.64);
      }
    }

    if (ud.bossArcSprite) {
      const showArc = !isStunned && !coreExposed && (phase >= 2 || rawTele > 0.4 || slamAmt > 0.4 || chargeAmt > 0.4);
      const flicker = showArc && Math.sin(t * (28 + phase * 11) + st.seed * 7) > (phase >= 3 ? -0.45 : 0.15);
      ud.bossArcSprite.visible = flicker;
      if (flicker) {
        ud.bossArcSprite.material.color.setHex(phase >= 3 ? 0xff3b6b : phase === 2 ? 0xf59e0b : 0x38bdf8);
        ud.bossArcSprite.material.rotation = t * 18;
        ud.bossArcSprite.material.opacity = 0.38 + 0.22 * Math.sin(t * 42);
        const aSc = 0.72 + phase * 0.14;
        ud.bossArcSprite.scale.set(aSc, aSc, 1);
      }
    }

    if (hitJolt > 0.05) {
      ud.coreHalo.material.color.setHex(0xffe4e6);
    } else if (coreExposed) {
      ud.coreHalo.material.color.setHex(0x14f1d9);
    } else if (phase >= 3 || beamAmt > 0.45) {
      ud.coreHalo.material.color.setHex(0xe11d48);
    } else if (phase === 2 || rawTele > 0.35) {
      ud.coreHalo.material.color.setHex(0xd946ef);
    } else {
      ud.coreHalo.material.color.setHex(0xa855f7);
    }
    ud.coreHalo.material.opacity = isStunned
      ? 0.12
      : clamp((coreExposed ? 0.44 : 0.26) + 0.10 * Math.sin(t * (8.5 + phase * 2)) + rawTele * 0.10, 0, 0.48);
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
    for (let i = 0; i < this._splashRings.length; i++) {
      this._splashRings[i].mesh.material.dispose();
    }
    for (let b = 0; b < this._buckets.length; b++) {
      const bucket = this._buckets[b];
      for (let i = 0; i < bucket.length; i++) {
        bucket[i].traverse((obj) => {
          if (obj.isSprite && obj.material) {
            obj.material.dispose();
          } else if (obj.name === 'enemy_telegraph_ring' && obj.material) {
            obj.material.dispose();
          }
        });
      }
      bucket.length = 0;
    }
    for (let i = 0; i < this._showcaseRigs.length; i++) {
      if (this._showcaseRigs[i]) {
        this._showcaseRigs[i].traverse((obj) => {
          if (obj.isSprite && obj.material) obj.material.dispose();
          else if (obj.name === 'enemy_telegraph_ring' && obj.material) obj.material.dispose();
        });
      }
    }
    this._showcasePlinthRing?.material?.dispose();
    this._showcasePlinthDisc?.material?.dispose();
    this._showcaseRigs.fill(null);
    this._dynLights.length = 0;
    this._deathBursts.length = 0;
    this._splashRings.length = 0;
    this._projectileMeshes.length = 0;
  }
}
