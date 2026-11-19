// TOWERING WATERS: GATEWAY'S DESCENT — REEF FREE-SWIM & REACTOR CORE DESCENT 3D RENDERER (`src/subRenderer.js`)
//
// Zero-Submarine, 100% Gateway-Centric Underwater & Reactor Dive 3D Engine:
//   1. `render(stageOrSubOrState, opts)` -> **`reef_swim` (Coral Reef & Lakebed Free-Swim):**
//      - Gateway swims directly underwater (undulating marine-lizard spine, frills & 7-segment tail,
//        ZERO metal submarines!) through sunlit turquoise caustic god-rays, swaying 3D kelp forests,
//        sunken canyon redwoods, and porous staghorn/brain coral gardens.
//      - Frees trapped Sea Turtles (`assets/models/sea_turtle.glb` w/ flapping flippers) and River
//        Otters (`assets/models/river_otter.glb` w/ undulating rudder tail) from Siphon Containment
//        Cages (`assets/models/siphon_cage.glb`).
//      - Instanced Reef Angelfish (`alien_fish_1.glb`), Spotted Eagle-Rays (`alien_fish_2.glb`),
//        Siphon Surge Nodes (`sea_mine.glb`), Reef Grotto Sanctuary (`warp_cavern.glb`), Geyser Vents,
//        Tidal Pearl Clams, and expanding 3D Harmonic Echo Shockwaves.
//   2. `renderCoreDescent(state, opts)` -> **`core_descent` (360° Flooded Reactor Shaft Plunge):**
//      - High-speed vertical 360° camera plunging down the Spire's flooded glass-and-bronze Central
//        Reactor Shaft! Gateway dives headfirst (`CoreDive` pose with streaming bubble spirals),
//        threading giant spinning 5-blade Hydro-Turbines (`core_reactor_props.glb`), shattering
//        glowing Siphon Crystal Locks, and planting the Harmonic Water Seed into the Bedrock Lotus!

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 48;
const CAM_Z = 10.4;

const MAX_FISH = 72;
const MAX_AMB = 24;
const MAX_BUBBLE_SHELLS = 72;
const MAX_PULSES = 18;
const MAX_JELLY = 16;
const MAX_MINES = 16;
const MAX_CHAINS = 160;
const MAX_CLAMS = 8;
const MAX_VENTS = 8;
const MAX_CAGES = 8;
const MAX_KELP = 64;
const MAX_CORAL = 56;
const MAX_RAYS = 14;
const MAX_RINGS = 28;
const MAX_PARTICLES = 320;
const MAX_POPUPS = 16;

const MAX_CORE_RINGS = 18;
const MAX_CORE_TURBINES = 10;
const MAX_CORE_LOCKS = 8;
const MAX_CORE_STREAKS = 140;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN_PALETTES = {
  sea_glass_guardian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', glow: '#5efce8', eye: '#f59e0b' },
  coral_reef_empress: { scale: '#fb7185', belly: '#ffe4e6', frill: '#2dd4bf', glow: '#f472b6', eye: '#fde047' },
  canyon_rapids_ranger: { scale: '#0d9488', belly: '#fef3c7', frill: '#f59e0b', glow: '#38bdf8', eye: '#fbbf24' },
  alpine_glacier_mystic: { scale: '#38bdf8', belly: '#f0f9ff', frill: '#a5f3fc', glow: '#7dd3fc', eye: '#fde047' },
  bayou_biolume: { scale: '#10b981', belly: '#d1fae5', frill: '#eab308', glow: '#34d399', eye: '#fb923c' },
  abyssal_leviathan: { scale: '#1d4ed8', belly: '#93c5fd', frill: '#c084fc', glow: '#67e8f9', eye: '#5efce8' },
  solar_oasis: { scale: '#f59e0b', belly: '#fef9c3', frill: '#22d3ee', glow: '#fde047', eye: '#10b981' },
  sovereign_starlight: { scale: '#eab308', belly: '#fefce8', frill: '#a855f7', glow: '#5efce8', eye: '#e879f9' },
  default_amphibian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', glow: '#5efce8', eye: '#f59e0b' },
};

const BIOME_UNDERWATER_PALETTES = {
  canyon_river: {
    bgTop: '#0f766e',
    bgDeep: '#063f46',
    fog: '#0b555c',
    sun: '#fef08a',
    ray: '#99f6e4',
    sand: '#926344',
    rock: '#7c3f2c',
    kelp: '#15803d',
  },
  alpine_lake: {
    bgTop: '#0284c7',
    bgDeep: '#083b66',
    fog: '#0a558c',
    sun: '#e0f2fe',
    ray: '#bae6fd',
    sand: '#64748b',
    rock: '#475569',
    kelp: '#0d9488',
  },
  mist_bayou: {
    bgTop: '#0d7a68',
    bgDeep: '#063733',
    fog: '#0a5249',
    sun: '#fde68a',
    ray: '#6ee7b7',
    sand: '#57534e',
    rock: '#3f4a3c',
    kelp: '#16a34a',
  },
  coral_sea: {
    bgTop: '#0694b8',
    bgDeep: '#074e78',
    fog: '#086c96',
    sun: '#fffbeb',
    ray: '#7dd3fc',
    sand: '#d6c39c',
    rock: '#4b6b7a',
    kelp: '#14b8a6',
  },
  storm_ocean: {
    bgTop: '#0369a1',
    bgDeep: '#082f49',
    fog: '#074973',
    sun: '#bae6fd',
    ray: '#5efce8',
    sand: '#334155',
    rock: '#1e293b',
    kelp: '#0891b2',
  },
};

const _glbCache = new Map();
function loadCachedGlb(url) {
  if (_glbCache.has(url)) return _glbCache.get(url);
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    const p = Promise.resolve(null);
    _glbCache.set(url, p);
    return p;
  }
  const p = new Promise((resolve) => {
    try {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => resolve(gltf && gltf.scene ? gltf.scene : null),
        undefined,
        () => resolve(null)
      );
    } catch {
      resolve(null);
    }
  });
  _glbCache.set(url, p);
  return p;
}

let _gatewayModPromise = null;
function loadGatewayModule() {
  if (_gatewayModPromise) return _gatewayModPromise;
  _gatewayModPromise = import('./gateway.js').catch(() => null);
  return _gatewayModPromise;
}

/**
 * Adaptive Hero Rig wrapper:
 * Uses `GatewayRig` from `./gateway.js` immediately once available while providing a
 * sleek Frame-0 articulated Female Alien Hydro-Lizard fallback (with 7-segment undulating
 * tail, flaring aquatic head-frills, digitigrade limbs, and Harmonic Seed harness) so
 * zero frames ever appear empty or fall back to primitives.
 */
class AdaptiveGatewaySwimmer {
  constructor(skinId = 'sea_glass_guardian') {
    this.skinId = skinId;
    this.group = new THREE.Group();
    this.liveRig = null;
    this.fallback = this._buildSculptedLizardFallback(skinId);
    this.group.add(this.fallback.root);

    loadGatewayModule().then((mod) => {
      const RigClass = mod?.GatewayRig;
      if (!RigClass || this._disposed) return;
      try {
        const rig = new RigClass(this.skinId);
        if (rig && rig.group) {
          this.liveRig = rig;
          this.group.remove(this.fallback.root);
          this.group.add(rig.group);
        }
      } catch {
        // Keep sculpted hydro-lizard fallback if external rig throws
      }
    });
  }

  _buildSculptedLizardFallback(skinId) {
    const pal = SKIN_PALETTES[skinId] || SKIN_PALETTES.sea_glass_guardian;
    const root = new THREE.Group();

    const matScale = new THREE.MeshStandardMaterial({
      color: pal.scale,
      roughness: 0.32,
      metalness: 0.14,
    });
    const matBelly = new THREE.MeshStandardMaterial({
      color: pal.belly,
      roughness: 0.44,
      metalness: 0.05,
    });
    const matFrill = new THREE.MeshStandardMaterial({
      color: pal.frill,
      emissive: pal.glow,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const matGlow = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: pal.glow,
      emissiveIntensity: 1.45,
      roughness: 0.1,
    });
    const matEye = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: pal.eye,
      emissiveIntensity: 0.65,
      roughness: 0.08,
    });

    // Sleek feminine lizard torso + chest + neck + head facing +Z in local rig space
    const spine = new THREE.Group();
    spine.position.set(0, 0.54, 0);
    root.add(spine);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.30, 8, 16), matScale);
    torso.scale.set(0.92, 1.0, 0.82);
    spine.add(torso);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.26, 6, 12), matBelly);
    belly.position.set(0, -0.01, 0.045);
    spine.add(belly);

    const seedCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 1), matGlow);
    seedCore.position.set(0, 0.08, -0.105);
    spine.add(seedCore);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.28, 0.03);
    spine.add(headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), matScale);
    head.scale.set(0.88, 0.84, 1.24);
    head.position.set(0, 0.04, 0.05);
    headPivot.add(head);

    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), matEye);
      eye.position.set(sx * 0.072, 0.062, 0.125);
      headPivot.add(eye);

      const frill = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.28, 5), matFrill);
      frill.scale.set(0.28, 1.0, 0.9);
      frill.position.set(sx * 0.095, 0.08, -0.04);
      frill.rotation.set(-0.95, sx * 0.42, -sx * 0.55);
      headPivot.add(frill);
      if (sx < 0) headPivot.userData.frillL = frill;
      else headPivot.userData.frillR = frill;
    }

    // 7-segment articulated lizard tail extending -Z / downward
    const tailBones = [];
    let parentNode = spine;
    for (let i = 0; i < 7; i++) {
      const segPivot = new THREE.Group();
      segPivot.position.set(0, i === 0 ? -0.16 : 0, i === 0 ? -0.07 : -0.135);
      const r = lerp(0.082, 0.014, i / 6);
      const segMesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.11, 6, 10), i >= 5 ? matFrill : matScale);
      segMesh.rotation.x = Math.PI * 0.5;
      segMesh.position.z = -0.065;
      segPivot.add(segMesh);
      parentNode.add(segPivot);
      parentNode = segPivot;
      tailBones.push(segPivot);
    }

    // Sleek limbs
    const limbs = {};
    for (const [key, sx, sy, isArm] of [
      ['armL', -0.145, 0.14, true],
      ['armR', 0.145, 0.14, true],
      ['legL', -0.115, -0.16, false],
      ['legR', 0.115, -0.16, false],
    ]) {
      const piv = new THREE.Group();
      piv.position.set(sx, sy, 0);
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(isArm ? 0.036 : 0.048, isArm ? 0.22 : 0.28, 6, 10),
        matScale
      );
      m.position.y = isArm ? -0.12 : -0.16;
      piv.add(m);
      spine.add(piv);
      limbs[key] = piv;
    }

    return { root, spine, headPivot, tailBones, limbs, mats: { matScale, matBelly, matFrill, matGlow, matEye } };
  }

  setSkin(skinId) {
    this.skinId = skinId || 'sea_glass_guardian';
    if (this.liveRig?.setSkin) {
      this.liveRig.setSkin(this.skinId);
    }
    const pal = SKIN_PALETTES[this.skinId] || SKIN_PALETTES.sea_glass_guardian;
    const m = this.fallback.mats;
    m.matScale.color.set(pal.scale);
    m.matBelly.color.set(pal.belly);
    m.matFrill.color.set(pal.frill);
    m.matFrill.emissive.set(pal.glow);
    m.matGlow.emissive.set(pal.glow);
    m.matEye.emissive.set(pal.eye);
  }

  update(dt, pose = {}) {
    if (this.liveRig?.update) {
      try {
        this.liveRig.update(dt, pose);
        return;
      } catch {
        // Fallback if signature differs
      }
    }
    const t = pose.time || 0;
    const swim = pose.swimPhase ?? t * 7.0;
    const f = this.fallback;
    f.spine.rotation.y = Math.sin(swim) * 0.22;
    f.headPivot.rotation.y = -Math.sin(swim) * 0.14;
    const flare = pose.frillFlare || 0.35;
    if (f.headPivot.userData.frillL) {
      f.headPivot.userData.frillL.rotation.z = 0.55 + flare * 0.45;
      f.headPivot.userData.frillR.rotation.z = -0.55 - flare * 0.45;
    }
    for (let i = 0; i < f.tailBones.length; i++) {
      const tb = f.tailBones[i];
      tb.rotation.y = Math.sin(swim - i * 0.62) * (0.24 + i * 0.045);
      tb.rotation.x = Math.cos(swim * 0.5 - i * 0.4) * 0.06;
    }
    f.limbs.armL.rotation.x = 0.95 + Math.sin(swim) * 0.18;
    f.limbs.armR.rotation.x = 0.95 - Math.sin(swim) * 0.18;
    f.limbs.legL.rotation.x = 0.72 + Math.sin(swim + 1.2) * 0.28;
    f.limbs.legR.rotation.x = 0.72 - Math.sin(swim + 1.2) * 0.28;
  }

  dispose() {
    this._disposed = true;
    this.liveRig?.dispose?.();
    this.fallback.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.fallback.mats)) m.dispose();
  }
}

function mergeBufferGeos(geos) {
  if (BufferGeometryUtils && typeof BufferGeometryUtils.mergeGeometries === 'function') {
    const normalized = geos.map((g) => {
      const ng = g.index ? g.toNonIndexed() : g;
      if (!ng.attributes.uv) {
        const cnt = ng.attributes.position.count;
        ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
      }
      return ng;
    });
    const merged = BufferGeometryUtils.mergeGeometries(normalized, false);
    if (merged) return merged;
  }
  return geos[0];
}

function createGodRayTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 256);
  const data = img.data;
  for (let y = 0; y < 256; y++) {
    const v = y / 255;
    // Soft fade in from top canopy and long Gaussian fade toward seabed
    const vFade = Math.sin(Math.min(1, v * 3.2) * Math.PI * 0.5) * Math.pow(1 - v, 1.45);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127) * 2 - 1;
      const streak = 0.72 + 0.28 * Math.cos(u * 9.5);
      const hFade = Math.exp(-u * u * 4.2) * streak;
      const a = clamp(vFade * hFade, 0, 1);
      const idx = (y * 128 + x) * 4;
      data[idx] = 215;
      data[idx + 1] = 250;
      data[idx + 2] = 255;
      data[idx + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDeepWaterBackdropTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([12, 128, 162, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#38bdf8');
  g.addColorStop(0.16, '#0ea5e9');
  g.addColorStop(0.45, '#087f9c');
  g.addColorStop(0.78, '#07526e');
  g.addColorStop(1.0, '#05354c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hash2D(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoiseTile(u, v, period) {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const ix0 = ((x0 % period) + period) % period;
  const ix1 = (ix0 + 1) % period;
  const iy0 = ((y0 % period) + period) % period;
  const iy1 = (iy0 + 1) % period;
  const n00 = hash2D(ix0, iy0);
  const n10 = hash2D(ix1, iy0);
  const n01 = hash2D(ix0, iy1);
  const n11 = hash2D(ix1, iy1);
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

function createStratifiedReefStoneTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([92, 132, 148, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Domain-warped organic coralline limestone + porous reef pockets (zero grid lines!)
      const warpU = u + (valueNoiseTile(u, v, 4) - 0.5) * 0.24;
      const warpV = v + (valueNoiseTile(u + 0.37, v + 0.19, 4) - 0.5) * 0.22;
      const fbm =
        valueNoiseTile(warpU, warpV, 6) * 0.52 +
        valueNoiseTile(warpU, warpV, 14) * 0.30 +
        valueNoiseTile(u, v, 28) * 0.18;
      const wave = 0.5 + 0.5 * Math.sin((warpV * 4.0 + fbm * 0.85) * TAU);
      const algae = valueNoiseTile(u + 0.51, v + 0.23, 8);
      let r = lerp(52, 128, fbm * 0.72 + wave * 0.28);
      let g = lerp(84, 158, fbm * 0.68 + wave * 0.32);
      let b = lerp(104, 174, fbm * 0.65 + wave * 0.35);
      if (algae > 0.66) {
        const k = (algae - 0.66) * 1.6;
        r = lerp(r, 214, k * 0.45);
        g = lerp(g, 118, k * 0.35);
        b = lerp(b, 162, k * 0.40);
      }
      const p = (y * size + x) * 4;
      data[p] = clamp(Math.round(r), 0, 255);
      data[p + 1] = clamp(Math.round(g), 0, 255);
      data[p + 2] = clamp(Math.round(b), 0, 255);
      data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRedwoodBarkTexture(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([108, 66, 42, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c3622';
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(71821);
  for (let x = 0; x < size; x += 3) {
    const shade = 68 + (rng() - 0.5) * 34;
    ctx.fillStyle = `rgb(${Math.round(shade * 1.18)}, ${Math.round(shade * 0.72)}, ${Math.round(shade * 0.46)})`;
    ctx.fillRect(x, 0, 2, size);
  }
  for (let i = 0; i < 48; i++) {
    ctx.fillStyle = 'rgba(20, 148, 112, 0.24)';
    ctx.fillRect(rng() * size, rng() * size, 6 + rng() * 14, 4 + rng() * 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildCraggyReefRidgeGeo(radius, height, seed) {
  const rng = mulberry32(seed);
  const parts = [];
  // Low, natural sculpted limestone seabed outcrop (ZERO giant eggs or tall brick towers!)
  const main = new THREE.SphereGeometry(radius, 14, 10);
  const pos = main.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n =
      1.0 +
      0.18 * Math.sin(x * 2.4 + seed) * Math.cos(z * 2.1 - seed) +
      0.12 * Math.cos(y * 3.8 + x * 1.9) +
      (rng() - 0.5) * 0.08;
    x *= n * 1.45;
    y = Math.max(-height * 0.35, y * n * (height / (radius * 2.1)));
    z *= n * 0.88;
    pos.setXYZ(i, x, y, z);
  }
  main.computeVertexNormals();
  parts.push(main);

  const shelf = new THREE.SphereGeometry(radius * 0.62, 12, 8);
  shelf.scale(1.55, 0.52, 0.92);
  shelf.translate(radius * 0.85, -height * 0.18, 0.2);
  parts.push(shelf);
  return mergeBufferGeos(parts);
}

function loadSubWebp(url, isSrgb = true, rx = 1, ry = 1, onReady = null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const loader = new THREE.TextureLoader();
    return loader.load(
      url,
      (t) => {
        t.wrapS = rx > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.wrapT = ry > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        if (rx > 1 || ry > 1) t.repeat.set(rx, ry);
        t.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.needsUpdate = true;
        onReady?.(t);
      },
      undefined,
      () => {}
    );
  } catch {
    return null;
  }
}

function buildCrossedSeaFanGeo(w = 1.85, h = 1.95) {
  // Intersecting botanical alpha-cutout planes anchored cleanly at y = 0 (ZERO cylinder sticks!)
  const p1 = new THREE.PlaneGeometry(w, h);
  p1.translate(0, h * 0.48, 0);
  p1.rotateY(0.32);
  const p2 = new THREE.PlaneGeometry(w * 0.88, h * 0.92);
  p2.translate(0, h * 0.45, 0);
  p2.rotateY(-0.58);
  return mergeBufferGeos([p1, p2]);
}

function buildCurvedHydrofoilBladeGeo() {
  // Sculpted curved, tapered bronze-and-copper hydrofoil fallback blade (ZERO flat black rectangles!)
  const shape = new THREE.Shape();
  shape.moveTo(0.54, -0.14);
  shape.quadraticCurveTo(1.25, -0.28, 2.28, -0.11);
  shape.quadraticCurveTo(2.38, 0.0, 2.28, 0.14);
  shape.quadraticCurveTo(1.32, 0.30, 0.54, 0.16);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.032,
    bevelSize: 0.028,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geo.translate(0, 0, -0.055);
  return geo;
}

function buildUnderwaterEnvTexture(_webgl) {
  // Zero-stall 60fps direct WebGL2 pipeline (eliminates PMREMGenerator 35-pass cubemap hitch!)
  return null;
}

function createSoftDotTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([255, 255, 255, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(205,252,255,0.82)');
  g.addColorStop(0.7, 'rgba(94,252,232,0.22)');
  g.addColorStop(1, 'rgba(94,252,232,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCausticFloorTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([180, 230, 245, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a89f8d';
  ctx.fillRect(0, 0, size, size);
  const rng = mulberry32(99173);
  for (let i = 0; i < 95; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 12 + rng() * 34;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(186, 248, 255, 0.36)');
    g.addColorStop(0.65, 'rgba(56, 189, 248, 0.14)');
    g.addColorStop(1, 'rgba(14, 116, 144, 0)');
    ctx.fillStyle = g;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, TAU);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftBeamTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  // Cone UV: v=1 at apex (sub nose), v=0 at far open mouth; fade smoothly along length & softly at edges
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0.0, 'rgba(130, 245, 240, 0.72)');
  grad.addColorStop(0.22, 'rgba(94, 240, 232, 0.40)');
  grad.addColorStop(0.62, 'rgba(56, 189, 248, 0.14)');
  grad.addColorStop(1.0, 'rgba(14, 116, 144, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createKelpFrondTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  // 7 graceful curved sunlit sea-kelp / ribbon-grass blades fanning from bottom center (ZERO black trunk stump!)
  const blades = [
    { x0: 0.44, cx: 0.20, x1: 0.14, h: 0.72, w: 0.085, c0: '#0d5e52', c1: '#2dd4bf' },
    { x0: 0.47, cx: 0.30, x1: 0.26, h: 0.88, w: 0.095, c0: '#0f6e5c', c1: '#34d399' },
    { x0: 0.49, cx: 0.42, x1: 0.39, h: 0.96, w: 0.100, c0: '#127a66', c1: '#5eead4' },
    { x0: 0.51, cx: 0.54, x1: 0.53, h: 0.94, w: 0.105, c0: '#0f6e5c', c1: '#34d399' },
    { x0: 0.53, cx: 0.66, x1: 0.68, h: 0.86, w: 0.095, c0: '#127a66', c1: '#5eead4' },
    { x0: 0.56, cx: 0.78, x1: 0.84, h: 0.74, w: 0.085, c0: '#0d5e52', c1: '#2dd4bf' },
    { x0: 0.50, cx: 0.48, x1: 0.46, h: 0.64, w: 0.080, c0: '#0a5248', c1: '#2dd4bf' },
  ];
  for (const b of blades) {
    const g = ctx.createLinearGradient(0, size, 0, size * (1 - b.h));
    g.addColorStop(0.0, b.c0);
    g.addColorStop(0.55, b.c1);
    g.addColorStop(1.0, '#99f6e4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo((b.x0 - b.w * 0.55) * size, size);
    ctx.quadraticCurveTo((b.cx - b.w * 0.45) * size, size * (1 - b.h * 0.52), b.x1 * size, size * (1 - b.h));
    ctx.quadraticCurveTo((b.cx + b.w * 0.45) * size, size * (1 - b.h * 0.52), (b.x0 + b.w * 0.55) * size, size);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGlassyBubbleTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  // Translucent hollow glass bubble with delicate rim & upper-left specular glint
  const g = ctx.createRadialGradient(32, 32, 8, 32, 32, 29);
  g.addColorStop(0.0, 'rgba(186, 245, 255, 0.04)');
  g.addColorStop(0.62, 'rgba(140, 238, 255, 0.14)');
  g.addColorStop(0.84, 'rgba(224, 250, 255, 0.62)');
  g.addColorStop(0.95, 'rgba(186, 245, 255, 0.25)');
  g.addColorStop(1.0, 'rgba(186, 245, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, TAU);
  ctx.fill();
  // Crisp tiny crescent specular catchlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(22, 21, 5.2, 3.0, -0.65, 0, TAU);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildFacetedCrystalShardGeo() {
  // Elongated double-terminated hexagonal quartz crystal shard (true 3D faceted gem, zero flat squares!)
  const topCone = new THREE.ConeGeometry(0.068, 0.19, 5);
  topCone.translate(0, 0.095, 0);
  const botCone = new THREE.ConeGeometry(0.068, 0.12, 5);
  botCone.rotateX(Math.PI);
  botCone.translate(0, -0.06, 0);
  const geo = mergeBufferGeos([topCone, botCone]);
  geo.computeVertexNormals();
  return geo;
}

function reefSeabedHeight(wx, wz) {
  return (
    Math.sin(wx * 0.24) * 0.42 +
    Math.cos(wz * 0.36 + wx * 0.14) * 0.34 +
    Math.sin(wx * 0.58 - wz * 0.48) * 0.16 +
    Math.max(0, (-wz - 4.0) * 0.14)
  );
}

function createPopupSpriteTex(text, color) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '800 24px Outfit, Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(4, 18, 32, 0.92)';
  ctx.strokeText(text, 160, 32);
  ctx.fillStyle = color || '#fde047';
  ctx.fillText(text, 160, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SubRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.skinId = opts.skinId || 'sea_glass_guardian';
    this.blasterFxId = opts.blasterFxId || 'standard_cryo';
    this.showHud = Boolean(opts.showHud);
    this._ownDotTex = !opts.softDotTex;
    this.softDotTex = opts.softDotTex || createSoftDotTexture();
    this.causticTex = createCausticFloorTexture(256);
    this.godRayTex = createGodRayTexture();
    this.beamGradTex = createSoftBeamTexture();
    this.bubbleRimTex = createGlassyBubbleTexture();
    this.backdropTex = createDeepWaterBackdropTexture();
    this.reefStoneTex = createStratifiedReefStoneTexture(256);
    this.barkTex = createRedwoodBarkTexture(128);
    this.envTex = buildUnderwaterEnvTexture(webgl);
    this.subHullAlbedo = null;
    this.subHullNormal = null;
    this._subEnamelMat = null;
    this._disposed = false;
    this._lastTime = 0;

    // Scratch zero-GC objects
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._shake = { x: 0, y: 0 };
    this._wp = { x: 0, y: 0, halfW: 5, halfH: 4 };
    this._reefFov = FOV;
    this._reefCamZ = CAM_Z;

    this._initReefScene();
    this._initCoreDescentScene();
    this._readyPromise = this._loadGlbProps();
  }

  whenReady() {
    return this._readyPromise;
  }

  setEra(_era) {
    // Unified console AAA sunlit water pipeline
  }

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.reefHero?.setSkin(skinId);
    this.coreHero?.setSkin(skinId);
  }

  setBlasterFx(fxId) {
    this.blasterFxId = fxId || 'standard_cryo';
  }

  _updateReefCamMetrics() {
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    this._reefFov = portrait ? 50 : 46;
    this._reefCamZ = portrait ? 11.2 : 9.4;
    if (this.reefCam) {
      this.reefCam.aspect = aspect;
      this.reefCam.fov = this._reefFov;
      this.reefCam.updateProjectionMatrix();
    }
  }

  resize(width, height) {
    this.width = Math.max(1, width || 390);
    this.height = Math.max(1, height || 620);
    const aspect = this.width / this.height;
    this._updateReefCamMetrics();
    if (this.coreCam) {
      this.coreCam.aspect = aspect;
      this.coreCam.updateProjectionMatrix();
    }
  }

  _screenToWorld(sx, sy, z = 0, out = this._wp) {
    const dist = this._reefCamZ - z;
    const halfH = Math.tan((this._reefFov * 0.5) * DEG) * dist;
    const halfW = halfH * (this.width / Math.max(1, this.height));
    out.x = ((sx / Math.max(1, this.width)) * 2 - 1) * halfW;
    out.y = (1 - (sy / Math.max(1, this.height)) * 2) * halfH;
    out.halfW = halfW;
    out.halfH = halfH;
    return out;
  }

  _pxScale(px, z = 0) {
    const dist = this._reefCamZ - z;
    const halfH = Math.tan((this._reefFov * 0.5) * DEG) * dist;
    return (px / Math.max(1, this.height)) * (2 * halfH);
  }

  // ============================================================================
  // 1. REEF & LAKEBED FREE-SWIM SCENE (`reef_swim`)
  // ============================================================================

  _initReefScene() {
    this.reefScene = new THREE.Scene();
    this.reefScene.background = new THREE.Color('#095c7c');
    this.reefScene.fog = new THREE.FogExp2('#0b5b7a', 0.024);
    if (this.envTex) this.reefScene.environment = this.envTex;

    this.reefCam = new THREE.PerspectiveCamera(FOV, this.width / Math.max(1, this.height), 0.2, 180);
    this._updateReefCamMetrics();
    this.reefCam.position.set(0, 0, this._reefCamZ);

    // Unified main-game AAA lighting rig: golden sun key + cool azure hemisphere bounce + soft aquatic rim
    this.reefHemi = new THREE.HemisphereLight('#7cc8f0', '#164558', 1.08);
    this.reefScene.add(this.reefHemi);

    this.reefSun = new THREE.DirectionalLight('#fff1d6', 2.25);
    this.reefSun.position.set(6, 16, 11);
    this.reefScene.add(this.reefSun);

    this.reefFill = new THREE.DirectionalLight('#2dd4bf', 0.68);
    this.reefFill.position.set(-8, -3, 7);
    this.reefScene.add(this.reefFill);

    // Studio-Painted Neural Deep Reef Panorama Backdrop (`assets/textures/mg_bg_reef_swim.webp`)
    this.reefBackdropMat = new THREE.MeshBasicMaterial({
      map: this.backdropTex,
      fog: false,
      depthWrite: false,
    });
    this.reefBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.reefBackdropMat);
    this.reefBackdrop.position.set(0, 0, -24);
    this.reefScene.add(this.reefBackdrop);

    // Soft Gaussian-feathered sunlit volumetric caustic god-ray shafts filling the upper reef!
    this.rayGroup = new THREE.Group();
    this.rayMeshes = [];
    const rayGeo = new THREE.PlaneGeometry(3.8, 17);
    for (let i = 0; i < MAX_RAYS; i++) {
      const rm = new THREE.MeshBasicMaterial({
        map: this.godRayTex,
        color: '#e0f7ff',
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(rayGeo, rm);
      m.rotation.z = -0.22 + (i % 4) * 0.045;
      this.rayGroup.add(m);
      this.rayMeshes.push(m);
    }
    this.reefScene.add(this.rayGroup);

    // Undulating Sculpted Sandy-Reef Canyon Seabed (`mg_pbr_reef_seabed_{albedo,normal}.webp` — ZERO Voronoi grid!)
    this.seabedMat = new THREE.MeshStandardMaterial({
      color: '#cfe2e0',
      map: this.causticTex,
      roughness: 0.84,
      metalness: 0.03,
    });
    const bedGeo = new THREE.PlaneGeometry(76, 26, 68, 22);
    bedGeo.rotateX(-Math.PI * 0.5);
    const bPos = bedGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const bx = bPos.getX(i);
      const bz = bPos.getZ(i);
      bPos.setY(i, reefSeabedHeight(bx, bz));
    }
    bedGeo.computeVertexNormals();
    this.seabedMesh = new THREE.Mesh(bedGeo, this.seabedMat);
    this.seabedMesh.position.set(0, -4.4, -3.5);
    this.reefScene.add(this.seabedMesh);

    // Large Sculpted Organic Limestone Reef Canyon Outcrops framing the midground & floor margins
    this.ridgeGroup = new THREE.Group();
    this.reefStoneTex.repeat.set(2, 2);
    this.ridgeMat = new THREE.MeshStandardMaterial({
      color: '#a9b8b4',
      map: this.reefStoneTex,
      roughness: 0.82,
      metalness: 0.04,
    });
    this.ridgeMeshes = [];
    for (let i = 0; i < 8; i++) {
      const ridgeGeo = buildCraggyReefRidgeGeo(1.45 + (i % 3) * 0.42, 1.55 + (i % 2) * 0.58, 1000 + i * 37);
      const outcrop = new THREE.Mesh(ridgeGeo, this.ridgeMat);
      outcrop.position.set((i - 3.5) * 6.8, -4.5, -6.2 - (i % 3) * 2.4);
      outcrop.rotation.y = (i * 0.95) % TAU;
      this.ridgeGroup.add(outcrop);
      this.ridgeMeshes.push(outcrop);
    }
    this.reefScene.add(this.ridgeGroup);

    // Sculpted PBR Coral-Encrusted Limestone Reef Boulders + Ridged Brain-Coral Domes + Dark-Edged Swaying Kelp Fronds
    // (ZERO Play-Doh straight sticks on orange balls, ZERO flat stacked green discs, ZERO white-fringed stickers!)
    const coralBoulderGeo = buildCraggyReefRidgeGeo(0.76, 0.54, 7121);
    const brainCoralGeo = new THREE.SphereGeometry(0.56, 18, 12, 0, TAU, 0, Math.PI * 0.58);
    const bcPos = brainCoralGeo.attributes.position;
    for (let i = 0; i < bcPos.count; i++) {
      const vx = bcPos.getX(i), vy = bcPos.getY(i), vz = bcPos.getZ(i);
      const ang = Math.atan2(vz, vx);
      const groove = 1.0 + 0.09 * Math.sin(ang * 9 + vy * 14) + 0.06 * Math.cos(vx * 11 - vz * 10);
      bcPos.setXYZ(i, vx * groove * 1.15, vy * groove * 0.72, vz * groove * 1.15);
    }
    brainCoralGeo.computeVertexNormals();
    // Curved crossed kelp/sea-fan bough cluster (`alphaTest: 0.58, transparent: false` — crisp dark edge, ZERO white halo!)
    const kelpPlanes = [];
    for (let p = 0; p < 3; p++) {
      const kp = new THREE.PlaneGeometry(1.15, 1.48, 2, 4);
      const kPos = kp.attributes.position;
      for (let j = 0; j < kPos.count; j++) {
        const ky = Math.max(0, kPos.getY(j) + 0.74);
        const bend = Math.pow(ky / 1.48, 1.8) * 0.24 * (p % 2 === 0 ? 1 : -1);
        kPos.setY(j, ky);
        kPos.setZ(j, kPos.getZ(j) + bend);
      }
      kp.rotateY((p * Math.PI) / 3);
      kp.computeVertexNormals();
      kelpPlanes.push(kp);
    }
    const kelpClusterGeo = mergeBufferGeos(kelpPlanes);

    this.staghornMat = new THREE.MeshStandardMaterial({
      color: '#c4b8a8',
      map: this.reefStoneTex,
      roughness: 0.80,
      metalness: 0.05,
    });
    this.tableCoralMat = new THREE.MeshStandardMaterial({
      color: '#c8a690',
      map: this.reefStoneTex,
      roughness: 0.72,
      metalness: 0.06,
    });
    this.kelpFoliageTex = createKelpFrondTex(128);
    this.tubeSpongeMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.kelpFoliageTex,
      emissive: '#0d5e54',
      emissiveIntensity: 0.28,
      roughness: 0.56,
      metalness: 0.04,
      alphaTest: 0.45,
      transparent: false,
      side: THREE.DoubleSide,
    });
    this.staghornInst = new THREE.InstancedMesh(coralBoulderGeo, this.staghornMat, 18);
    this.tableCoralInst = new THREE.InstancedMesh(brainCoralGeo, this.tableCoralMat, 16);
    this.tubeSpongeInst = new THREE.InstancedMesh(kelpClusterGeo, this.tubeSpongeMat, 18);
    const stagTints = ['#9faea6', '#b5a898', '#96a8aa', '#ab9c8e', '#8fa5a0'];
    const tableTints = ['#b87e6e', '#a98a64', '#869c92', '#b07b7e', '#949878'];
    const spongeTints = ['#5eead4', '#34d399', '#6ee7b7', '#2dd4bf', '#86efac'];
    for (let i = 0; i < 18; i++) {
      this._col.set(stagTints[i % stagTints.length]);
      this.staghornInst.setColorAt(i, this._col);
    }
    for (let i = 0; i < 16; i++) {
      this._col.set(tableTints[i % tableTints.length]);
      this.tableCoralInst.setColorAt(i, this._col);
    }
    for (let i = 0; i < 18; i++) {
      this._col.set(spongeTints[i % spongeTints.length]);
      this.tubeSpongeInst.setColorAt(i, this._col);
    }
    for (const im of [this.staghornInst, this.tableCoralInst, this.tubeSpongeInst]) {
      im.frustumCulled = false;
      this.reefScene.add(im);
    }

    // Graceful Mid-Distance Sculpted 3D Reef Manta Ray (replaces stiff close-up plastic foreground turtle!)
    this.mantaGroup = new THREE.Group();
    this.mantaGroup.visible = false;
    this.reefScene.add(this.mantaGroup);

    // Mount Studio-Painted Reef Backdrop & 1K Studio PBR Seabed / Sub-Hull / Limestone WebP Textures
    this.limestoneAlbedo = null;
    this.limestoneNormal = null;
    loadSubWebp('assets/textures/mg_bg_reef_swim.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.reefBgWebp = t;
      this.reefBackdropMat.map = t;
      this.reefBackdropMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/mg_pbr_reef_seabed_albedo.webp', true, 5, 2.2, (t) => {
      if (this._disposed) return;
      this.coralSandWebp = t;
      this.seabedMat.map = t;
      this.seabedMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/mg_pbr_reef_seabed_normal.webp', false, 5, 2.2, (t) => {
      if (this._disposed) return;
      this.seabedMat.normalMap = t;
      this.seabedMat.normalScale.set(1.15, 1.15);
      this.seabedMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/mg_pbr_sub_hull_albedo.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.subHullAlbedo = t;
      this._applySubHullPbr();
    });
    loadSubWebp('assets/textures/mg_pbr_sub_hull_normal.webp', false, 1, 1, (t) => {
      if (this._disposed) return;
      this.subHullNormal = t;
      this._applySubHullPbr();
    });
    loadSubWebp('assets/textures/biome_rock_limestone_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.limestoneAlbedo = t;
      this.ridgeMat.map = t;
      this.ridgeMat.needsUpdate = true;
      if (this.ventMat) {
        this.ventMat.map = t;
        this.ventMat.color.set('#b8c4bc');
        this.ventMat.needsUpdate = true;
      }
      this._applyCoralPbr();
    });
    loadSubWebp('assets/textures/biome_rock_limestone_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.limestoneNormal = t;
      this.ridgeMat.normalMap = t;
      this.ridgeMat.normalScale.set(1.2, 1.2);
      this.ridgeMat.needsUpdate = true;
      if (this.ventMat) {
        this.ventMat.normalMap = t;
        this.ventMat.normalScale.set(1.2, 1.2);
        this.ventMat.needsUpdate = true;
      }
      this._applyCoralPbr();
    });

    // Pelagian Sea-Glass Bio-Submersible (`assets/models/pelagian_sub.glb`) with Gateway visibly piloting inside!
    this.heroSwimAnchor = new THREE.Group();
    this.subVesselGroup = new THREE.Group();
    this.subFallback = new THREE.Group();
    const fbSubHull = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 1.15, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#137e8f', roughness: 0.34, metalness: 0.52 })
    );
    fbSubHull.rotation.z = Math.PI * 0.5;
    fbSubHull.position.y = -0.14;
    const fbSubDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 16, 12, 0, TAU, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({
        color: '#d8f8ff',
        emissive: '#38bdf8',
        emissiveIntensity: 0.2,
        roughness: 0.06,
        transparent: true,
        opacity: 0.32,
      })
    );
    fbSubDome.position.set(0.10, 0.04, 0);
    this.subFallback.add(fbSubHull, fbSubDome);
    this.subVesselGroup.add(this.subFallback);

    // Soft Feathered Multi-Layer Volumetric Headlamp Cone (fades smoothly to 0 at edges & far end — ZERO hard triangle!)
    const beamGeo = new THREE.ConeGeometry(0.95, 4.0, 20, 1, true);
    beamGeo.rotateZ(Math.PI * 0.5);
    beamGeo.translate(3.08, -0.02, 0);
    this.subSonarBeam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        map: this.beamGradTex,
        color: '#a5f3fc',
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    this.subVesselGroup.add(this.subSonarBeam);
    this.subFinL = null;
    this.subFinR = null;
    this.subPropeller = null;

    // Gateway seated visibly piloting inside the translucent sea-glass bubble canopy!
    this.reefHero = new GatewayRig(this.skinId);
    this.reefHeroInner = new THREE.Group();
    this.reefHeroInner.rotation.order = 'YXZ';
    this.reefHeroInner.rotation.set(0.12, Math.PI * 0.5, 0);
    this.reefHeroInner.scale.setScalar(0.76);
    this.reefHeroInner.position.set(0.08, -0.22, 0);
    this.reefHeroInner.add(this.reefHero.group);
    this.subVesselGroup.add(this.reefHeroInner);
    this.heroSwimAnchor.add(this.subVesselGroup);

    // Streaming bioluminescent hydro-slipstream & Harmonic Echo Sphere on Gateway
    this.echoSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 24, 18),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.echoSphere.visible = false;
    this.reefScene.add(this.echoSphere);

    this.heroGlowLight = new THREE.PointLight('#fbbf24', 0.85, 6.5);
    this.heroGlowLight.position.set(0.2, 0.2, 1.4);
    this.heroSwimAnchor.add(this.heroGlowLight);
    this.reefScene.add(this.heroSwimAnchor);

    // Dynamic Gameplay Pools (Real Blender Tropical Angelfish & Wrasse, Caged Rescue Critters, Mines, Jellies, Boulders)
    this.fishGroup = new THREE.Group();
    this.cagePool = [];
    this.reefScene.add(this.fishGroup);

    // Fallback fish silhouette until `pelagian_sub.glb` (`reef_angelfish` & `reef_wrasse`) finishes loading
    const fishBody = new THREE.SphereGeometry(0.18, 10, 8);
    fishBody.scale(1.65, 1.05, 0.42);
    const fishTail = new THREE.ConeGeometry(0.18, 0.28, 4);
    fishTail.rotateZ(-Math.PI * 0.5);
    fishTail.translate(-0.36, 0, 0);
    const fishFallbackGeo1 = mergeBufferGeos([fishBody, fishTail]);
    this.fishMat1 = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.26,
      metalness: 0.18,
    });
    this.fishMat2 = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.26,
      metalness: 0.18,
    });
    this.fishInst1 = new THREE.InstancedMesh(fishFallbackGeo1, this.fishMat1, MAX_FISH);
    this.fishInst2 = new THREE.InstancedMesh(fishFallbackGeo1.clone(), this.fishMat2, MAX_FISH);
    this.ambFishInst = new THREE.InstancedMesh(fishFallbackGeo1.clone(), this.fishMat2, MAX_AMB);
    for (const im of [this.fishInst1, this.fishInst2, this.ambFishInst]) {
      im.frustumCulled = false;
      this.reefScene.add(im);
    }

    // Iridescent Bubble Shells around bubbled fish & Harmonic Seeds
    this.bubbleShellInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        emissive: '#38bdf8',
        emissiveIntensity: 0.5,
        roughness: 0.06,
        transparent: true,
        opacity: 0.42,
      }),
      MAX_BUBBLE_SHELLS
    );
    this.bubbleShellInst.frustumCulled = false;
    this.reefScene.add(this.bubbleShellInst);

    this.seedGemInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.55,
      }),
      24
    );
    this.seedGemInst.frustumCulled = false;
    this.reefScene.add(this.seedGemInst);

    // Gateway's Hydro-Pulse Shots
    this.pulseInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.24, 1),
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#22d3ee',
        emissiveIntensity: 1.5,
        roughness: 0.1,
      }),
      MAX_PULSES
    );
    this.pulseInst.frustumCulled = false;
    this.reefScene.add(this.pulseInst);

    // Sculpted Translucent Ribbed Bioluminescent Medusa Jellyfish (Lathe umbrella bell + 6 trailing tentacles — ZERO opaque pink gumballs!)
    const bellPts = [
      new THREE.Vector2(0.001, 0.34),
      new THREE.Vector2(0.14, 0.32),
      new THREE.Vector2(0.28, 0.24),
      new THREE.Vector2(0.36, 0.10),
      new THREE.Vector2(0.38, -0.02),
      new THREE.Vector2(0.31, -0.06),
      new THREE.Vector2(0.20, 0.02),
    ];
    const bellGeo = new THREE.LatheGeometry(bellPts, 18);
    const jbPos = bellGeo.attributes.position;
    for (let i = 0; i < jbPos.count; i++) {
      const vx = jbPos.getX(i), vy = jbPos.getY(i), vz = jbPos.getZ(i);
      const ang = Math.atan2(vz, vx);
      const rib = 1.0 + 0.09 * Math.sin(ang * 9);
      jbPos.setXYZ(i, vx * rib, vy, vz * rib);
    }
    bellGeo.computeVertexNormals();
    const jellyParts = [bellGeo];
    for (let t = 0; t < 6; t++) {
      const ta = (t / 6) * TAU;
      const tr = 0.14 + (t % 2) * 0.08;
      const tent = new THREE.CylinderGeometry(0.018, 0.004, 0.58 + (t % 3) * 0.14, 5, 4);
      const tp = tent.attributes.position;
      for (let k = 0; k < tp.count; k++) {
        const ty = tp.getY(k);
        tp.setX(k, tp.getX(k) + Math.sin(ty * 9 + t) * 0.045);
        tp.setZ(k, tp.getZ(k) + Math.cos(ty * 8 + t) * 0.045);
      }
      tent.translate(Math.cos(ta) * tr, -0.30, Math.sin(ta) * tr);
      tent.computeVertexNormals();
      jellyParts.push(tent);
    }
    const jellyGeo = mergeBufferGeos(jellyParts);
    this.jellyInst = new THREE.InstancedMesh(
      jellyGeo,
      new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        emissive: '#4f46e5',
        emissiveIntensity: 0.65,
        roughness: 0.08,
        metalness: 0.12,
        transparent: true,
        opacity: 0.54,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      MAX_JELLY
    );
    this.jellyInst.frustumCulled = false;
    this.reefScene.add(this.jellyInst);

    // Siphon Surge Mines + Anchor Chains
    this.minePool = [];
    this.mineFallbackGeo = new THREE.IcosahedronGeometry(0.42, 1);
    this.mineFallbackMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      emissive: '#f97316',
      emissiveIntensity: 0.35,
      metalness: 0.8,
      roughness: 0.35,
    });
    for (let i = 0; i < MAX_MINES; i++) {
      const g = new THREE.Group();
      const fb = new THREE.Mesh(this.mineFallbackGeo, this.mineFallbackMat);
      g.add(fb);
      g.visible = false;
      this.reefScene.add(g);
      this.minePool.push({ group: g, fallback: fb, glbLoaded: false });
    }

    this.chainInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6),
      new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.4 }),
      MAX_CHAINS
    );
    this.chainInst.frustumCulled = false;
    this.reefScene.add(this.chainInst);

    // Wildlife Rescue Cages (`sea_turtle.glb` & `river_otter.glb` inside `siphon_cage.glb`)
    for (let i = 0; i < MAX_CAGES; i++) {
      const slot = this._createCageSlot();
      slot.root.visible = false;
      this.reefScene.add(slot.root);
      this.cagePool.push(slot);
    }

    // Tidal Pearl Clams & Geyser Bubble Vents
    this.clamGroup = new THREE.Group();
    this.clamSlots = [];
    const shellMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.42, metalness: 0.15 });
    const pearlMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#f9a8d4',
      emissiveIntensity: 0.9,
      roughness: 0.08,
    });
    for (let i = 0; i < MAX_CLAMS; i++) {
      const root = new THREE.Group();
      const bot = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, TAU, Math.PI * 0.5, Math.PI * 0.5), shellMat);
      const topPiv = new THREE.Group();
      topPiv.position.set(0, 0.02, -0.25);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, TAU, 0, Math.PI * 0.5), shellMat);
      top.position.set(0, 0, 0.25);
      topPiv.add(top);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), pearlMat);
      pearl.position.y = 0.08;
      root.add(bot, topPiv, pearl);
      root.visible = false;
      this.clamGroup.add(root);
      this.clamSlots.push({ root, topPiv, pearl });
    }
    this.reefScene.add(this.clamGroup);

    this.ventMat = new THREE.MeshStandardMaterial({
      color: '#a8b8b2',
      map: this.reefStoneTex,
      emissive: '#0c4a6e',
      emissiveIntensity: 0.14,
      roughness: 0.84,
      metalness: 0.04,
    });
    // Sculpted organic multi-lobe limestone coral boulder cluster (ZERO 6-sided grey pyramid cones!)
    const ventGeo = buildCraggyReefRidgeGeo(0.72, 0.54, 4219);
    this.ventInst = new THREE.InstancedMesh(ventGeo, this.ventMat, MAX_VENTS);
    this.ventInst.frustumCulled = false;
    this.reefScene.add(this.ventInst);

    // Coral Sanctuary Grotto Arch (`warp_cavern.glb`) & Next Spire Column
    this.grottoGroup = new THREE.Group();
    const grottoPortal = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 24),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const grottoRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.18, 10, 24),
      new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.65 })
    );
    this.grottoGroup.add(grottoPortal, grottoRim);
    this.grottoGroup.userData = { grottoPortal, grottoRim };
    this.grottoGroup.visible = false;
    this.reefScene.add(this.grottoGroup);

    this.arrivalSpire = new THREE.Group();
    const spireCol = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.7, 22, 20),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.52, metalness: 0.22 })
    );
    const spireVein = new THREE.Mesh(
      new THREE.CylinderGeometry(2.44, 2.74, 22, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', wireframe: true, transparent: true, opacity: 0.35 })
    );
    this.arrivalSpire.add(spireCol, spireVein);
    this.arrivalSpire.visible = false;
    this.reefScene.add(this.arrivalSpire);

    // Shockwave Rings, Underwater Bubbles/Sparkles & Score Popups
    this.ringInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1, 0.045, 8, 28),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_RINGS
    );
    this.ringInst.frustumCulled = false;
    this.reefScene.add(this.ringInst);

    this.particleInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({
        map: this.bubbleRimTex,
        color: '#dff8ff',
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_PARTICLES
    );
    this.particleInst.frustumCulled = false;
    this.reefScene.add(this.particleInst);

    this.popupPool = [];
    for (let i = 0; i < MAX_POPUPS; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sp.visible = false;
      this.reefScene.add(sp);
      this.popupPool.push({ sprite: sp, key: '' });
    }
  }

  _createCageSlot() {
    const root = new THREE.Group();
    const cageGroup = new THREE.Group();
    const fbCage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 1.0, 6, 1, true),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.85, roughness: 0.3, wireframe: true })
    );
    const fbLock = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.045, 6, 12),
      new THREE.MeshStandardMaterial({ color: '#fb7185', emissive: '#f43f5e', emissiveIntensity: 1.5 })
    );
    fbLock.rotation.x = Math.PI * 0.5;
    cageGroup.add(fbCage, fbLock);

    const turtleGroup = new THREE.Group();
    const fbTurtle = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#2a8a78', roughness: 0.38 })
    );
    fbTurtle.scale.set(1.2, 0.45, 0.95);
    turtleGroup.add(fbTurtle);

    const otterGroup = new THREE.Group();
    const fbOtter = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 0.52, 6, 10),
      new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.58 })
    );
    fbOtter.rotation.z = Math.PI * 0.5;
    otterGroup.add(fbOtter);

    root.add(cageGroup, turtleGroup, otterGroup);
    return {
      root,
      cageGroup,
      turtleGroup,
      otterGroup,
      flipperL: null,
      flipperR: null,
      otterTail: null,
    };
  }

  // ============================================================================
  // 2. REACTOR CORE DESCENT 3D SCENE (`core_descent`)
  // ============================================================================

  _initCoreDescentScene() {
    this.coreScene = new THREE.Scene();
    this.coreScene.background = new THREE.Color('#041120');
    this.coreScene.fog = new THREE.FogExp2('#05172b', 0.036);
    if (this.envTex) this.coreScene.environment = this.envTex;

    this.coreCam = new THREE.PerspectiveCamera(56, this.width / Math.max(1, this.height), 0.2, 140);

    // Balanced moody deep-abyss sapphire lighting: crisp figure-ground contrast on Gateway's emerald scales
    // & coral frills (ZERO blown-out white wash!) + warm golden metallic rim highlights on bronze turbines below!
    const hemi = new THREE.HemisphereLight('#60a5fa', '#0d2b44', 0.85);
    this.coreScene.add(hemi);

    const shaftLight = new THREE.DirectionalLight('#fff1d6', 1.45);
    shaftLight.position.set(6, 12, 8);
    this.coreScene.add(shaftLight);

    const warmRim = new THREE.DirectionalLight('#fbbf24', 1.15);
    warmRim.position.set(-7, -4, 6);
    this.coreScene.add(warmRim);

    this.coreHeroLight = new THREE.PointLight('#38bdf8', 0.85, 10);
    this.coreScene.add(this.coreHeroLight);

    // Studio-Painted Underwater Reactor Chamber Abyss Backdrop (`assets/textures/mg_bg_core_reactor.webp`)
    this.coreAbyssMat = new THREE.MeshBasicMaterial({
      color: '#a8d8e8',
      map: this.backdropTex,
      fog: false,
      depthWrite: false,
    });
    this.coreAbyssBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(24, 15), this.coreAbyssMat);
    this.coreAbyssBackdrop.rotation.x = -Math.PI * 0.5;
    this.coreAbyssBackdrop.position.set(0, -44, 0);
    this.coreScene.add(this.coreAbyssBackdrop);

    // Looping 360° Dark Basalt & Riveted Antique-Bronze Flooded Reactor Shaft (`radius = 3.48`, instanced!)
    this.shaftRings = [];
    const glassWallGeo = new THREE.CylinderGeometry(3.48, 3.48, 5.8, 24, 1, true);
    this.coreWallMat = new THREE.MeshStandardMaterial({
      color: '#124a5e',
      map: this.causticTex,
      emissive: '#042a3a',
      emissiveMap: this.causticTex,
      emissiveIntensity: 0.28,
      roughness: 0.52,
      metalness: 0.22,
      side: THREE.BackSide,
    });
    const bronzeRingGeo = new THREE.TorusGeometry(3.40, 0.19, 10, 32);
    bronzeRingGeo.rotateX(Math.PI * 0.5);
    this.coreBronzeMat = new THREE.MeshStandardMaterial({
      color: '#9c6e38',
      emissive: '#261404',
      emissiveIntensity: 0.16,
      roughness: 0.34,
      metalness: 0.86,
    });
    this.coreCopperMat = new THREE.MeshStandardMaterial({
      color: '#b05d30',
      emissive: '#281004',
      emissiveIntensity: 0.16,
      roughness: 0.32,
      metalness: 0.84,
    });
    // Thin, recessed soft-glowing cyan plasma conduit strip (ZERO blinding solid-white hula-hoops!)
    const conduitGlowGeo = new THREE.TorusGeometry(3.32, 0.022, 8, 32);
    conduitGlowGeo.rotateX(Math.PI * 0.5);
    const conduitGlowMat = new THREE.MeshStandardMaterial({
      color: '#0e586e',
      emissive: '#0891b2',
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.35,
    });

    // Instanced Shaft Wall, Dark Riveted Bronze Bulkheads & Recessed Thin Plasma Strips (3 draw calls total!)
    this.shaftWallInst = new THREE.InstancedMesh(glassWallGeo, this.coreWallMat, MAX_CORE_RINGS);
    this.shaftRingInst = new THREE.InstancedMesh(bronzeRingGeo, this.coreBronzeMat, MAX_CORE_RINGS);
    this.shaftGlowInst = new THREE.InstancedMesh(conduitGlowGeo, conduitGlowMat, MAX_CORE_RINGS);
    for (const im of [this.shaftWallInst, this.shaftRingInst, this.shaftGlowInst]) {
      im.frustumCulled = false;
      this.coreScene.add(im);
    }

    // 8 continuous dark riveted bronze structural tunnel ribs + 4 thin recessed plasma strips (2 draw calls total!)
    const ribGeo = new THREE.CylinderGeometry(0.14, 0.14, 145, 6);
    const ribInst = new THREE.InstancedMesh(ribGeo, this.coreBronzeMat, 8);
    const stripGeo = new THREE.BoxGeometry(0.026, 145, 0.036);
    const stripInst = new THREE.InstancedMesh(stripGeo, conduitGlowMat, 4);
    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * TAU;
      this._dummy.position.set(Math.cos(ang) * 3.40, -45, Math.sin(ang) * 3.40);
      this._dummy.rotation.set(0, -ang, 0);
      this._dummy.scale.setScalar(1);
      this._dummy.updateMatrix();
      ribInst.setMatrixAt(r, this._dummy.matrix);
      if (r % 2 === 0) {
        const a2 = ang + 0.39;
        this._dummy.position.set(Math.cos(a2) * 3.44, -45, Math.sin(a2) * 3.44);
        this._dummy.rotation.set(0, -a2, 0);
        this._dummy.updateMatrix();
        stripInst.setMatrixAt(r >> 1, this._dummy.matrix);
      }
    }
    ribInst.instanceMatrix.needsUpdate = true;
    stripInst.instanceMatrix.needsUpdate = true;
    this.coreScene.add(ribInst, stripInst);

    // Load studio reactor backdrop + sculpted stone & bronze PBR maps for the shaft
    loadSubWebp('assets/textures/mg_bg_core_reactor.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.coreBgWebp = t;
      this.coreAbyssMat.map = t;
      this.coreAbyssMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_storm_basalt_albedo.webp', true, 4, 2, (t) => {
      if (this._disposed) return;
      this.coreWallMat.map = t;
      this.coreWallMat.color.set('#225c72');
      this.coreWallMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_storm_basalt_normal.webp', false, 4, 2, (t) => {
      if (this._disposed) return;
      this.coreWallMat.normalMap = t;
      this.coreWallMat.normalScale.set(1.35, 1.35);
      this.coreWallMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_antique_bronze_albedo.webp', true, 3, 1, (t) => {
      if (this._disposed) return;
      this.coreBronzeMat.map = t;
      this.coreBronzeMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_antique_bronze_normal.webp', false, 3, 1, (t) => {
      if (this._disposed) return;
      this.coreBronzeMat.normalMap = t;
      this.coreBronzeMat.normalScale.set(1.25, 1.25);
      this.coreBronzeMat.needsUpdate = true;
    });

    // Gateway Headfirst Plunge Rig (`CoreDive` clip pitches Pelvis +1.38 rad toward +Z;
    // +0.19 rad X tilt completes the 90 deg plunge straight down -Y with dorsal scales facing camera!)
    this.coreHeroAnchor = new THREE.Group();
    this.coreHero = new GatewayRig(this.skinId);
    this.coreHeroInner = new THREE.Group();
    this.coreHeroInner.rotation.set(0.19, 0, 0);
    this.coreHeroInner.scale.setScalar(1.42);
    this.coreHeroInner.position.set(0, 0.25, -0.35);
    this.coreHeroInner.add(this.coreHero.group);
    this.coreHeroAnchor.add(this.coreHeroInner);

    this.coreWhipRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.coreWhipRing.rotation.x = Math.PI * 0.5;
    this.coreHeroAnchor.add(this.coreWhipRing);
    this.coreScene.add(this.coreHeroAnchor);

    // Spinning Hydro-Turbine Rotors (`reactor_turbine`) — sculpted curved bronze/copper hydrofoil fallback too!
    this.turbineSlots = [];
    const curvedBladeGeo = buildCurvedHydrofoilBladeGeo();
    const fbHubGeo = new THREE.CylinderGeometry(0.46, 0.62, 0.44, 16);
    fbHubGeo.rotateX(Math.PI * 0.5);
    const fbStatorGeo = new THREE.TorusGeometry(0.64, 0.07, 8, 20);
    const fbShroudGeo = new THREE.TorusGeometry(2.44, 0.14, 8, 28);
    for (let i = 0; i < MAX_CORE_TURBINES; i++) {
      const g = new THREE.Group();
      const fb = new THREE.Group();
      fb.add(new THREE.Mesh(fbHubGeo, this.coreBronzeMat));
      fb.add(new THREE.Mesh(fbStatorGeo, conduitGlowMat));
      fb.add(new THREE.Mesh(fbShroudGeo, this.coreBronzeMat));
      for (let b = 0; b < 5; b++) {
        const ba = (b / 5) * TAU;
        const blade = new THREE.Mesh(curvedBladeGeo, b % 2 === 0 ? this.coreBronzeMat : this.coreCopperMat);
        blade.rotation.set(0.30 * Math.cos(ba), 0.30 * Math.sin(ba), ba);
        fb.add(blade);
      }
      fb.rotation.x = Math.PI * 0.5;
      g.add(fb);
      g.visible = false;
      this.coreScene.add(g);
      this.turbineSlots.push({ group: g, fallback: fb });
    }

    // Siphon Crystal Core Locks (`siphon_crystal_lock`)
    this.lockSlots = [];
    const lockCrystalMat = new THREE.MeshStandardMaterial({
      color: '#fb7185',
      emissive: '#f43f5e',
      emissiveIntensity: 1.65,
      roughness: 0.12,
    });
    for (let i = 0; i < MAX_CORE_LOCKS; i++) {
      const g = new THREE.Group();
      const fb = new THREE.Mesh(new THREE.OctahedronGeometry(0.58, 0), lockCrystalMat);
      g.add(fb);
      g.visible = false;
      this.coreScene.add(g);
      this.lockSlots.push({ group: g, fallback: fb });
    }

    // Bedrock Harmonic Seed Lotus Anchor (`harmonic_seed_anchor`) + Purification Eruption Beam
    this.seedAnchorGroup = new THREE.Group();
    const fbLotus = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.9, 0.45, 16),
      new THREE.MeshStandardMaterial({ color: '#e6f7f5', roughness: 0.22, metalness: 0.3 })
    );
    const eruptionBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.65, 45, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    eruptionBeam.position.y = 22.5;
    this.seedAnchorGroup.add(fbLotus, eruptionBeam);
    this.seedAnchorGroup.userData = { fbLotus, eruptionBeam };
    this.seedAnchorGroup.visible = false;
    this.coreScene.add(this.seedAnchorGroup);

    // Hair-thin low-opacity peripheral air-rush streaks (STRICTLY near outer shaft wall — ZERO thick center beams/planks!)
    this.streakInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.005, 0.013, 1.55, 5),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_CORE_STREAKS
    );
    this.streakInst.frustumCulled = false;
    this.coreScene.add(this.streakInst);

    // Faceted 3D double-ended rose-quartz crystal shards (14 pieces max flying outward — ZERO flat solid-pink confetti!)
    this.coreShardInst = new THREE.InstancedMesh(
      buildFacetedCrystalShardGeo(),
      new THREE.MeshStandardMaterial({
        color: '#e11d48',
        emissive: '#881337',
        emissiveIntensity: 0.45,
        roughness: 0.08,
        metalness: 0.35,
        flatShading: true,
        transparent: true,
        opacity: 0.88,
      }),
      16
    );
    this.coreShardInst.frustumCulled = false;
    this.coreShardInst.count = 0;
    this.coreScene.add(this.coreShardInst);
    this._lastCoreSmashed = 0;
    this._shardBurstT = 0;
    this._shardOrigin = { x: 0, y: 0, z: 0 };

    this.coreBoostRingInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.62, 0.055, 8, 24),
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#5efce8',
        emissiveIntensity: 1.25,
        roughness: 0.15,
        metalness: 0.65,
      }),
      16
    );
    this.coreBoostRingInst.frustumCulled = false;
    this.coreScene.add(this.coreBoostRingInst);

    this.coreDivePulseInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.24, 1),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#38bdf8',
        emissiveIntensity: 1.75,
        roughness: 0.08,
      }),
      16
    );
    this.coreDivePulseInst.frustumCulled = false;
    this.coreScene.add(this.coreDivePulseInst);
  }

  _applySubHullPbr() {
    if (!this._subEnamelMat) return;
    if (this.subHullAlbedo) {
      this._subEnamelMat.map = this.subHullAlbedo;
      this._subEnamelMat.color.set('#e8f6f8');
    }
    if (this.subHullNormal) {
      this._subEnamelMat.normalMap = this.subHullNormal;
      this._subEnamelMat.normalScale.set(1.25, 1.25);
    }
    this._subEnamelMat.emissive = new THREE.Color('#0c3b46');
    this._subEnamelMat.emissiveIntensity = 0.30;
    this._subEnamelMat.metalness = 0.38;
    this._subEnamelMat.roughness = 0.34;
    this._subEnamelMat.needsUpdate = true;
  }

  _applyCoralPbr() {
    for (const m of [this.staghornMat, this.tableCoralMat]) {
      if (!m) continue;
      if (this.limestoneAlbedo) m.map = this.limestoneAlbedo;
      if (this.limestoneNormal) {
        m.normalMap = this.limestoneNormal;
        m.normalScale.set(1.35, 1.35);
      }
      m.roughness = 0.78;
      m.metalness = 0.05;
      m.needsUpdate = true;
    }
  }

  async _loadGlbProps() {
    const [mine, grotto, turtle, otter, cage, coreProps, pelagianSub] = await Promise.all([
      loadCachedGlb('assets/models/sea_mine.glb'),
      loadCachedGlb('assets/models/warp_cavern.glb'),
      loadCachedGlb('assets/models/sea_turtle.glb'),
      loadCachedGlb('assets/models/river_otter.glb'),
      loadCachedGlb('assets/models/siphon_cage.glb'),
      loadCachedGlb('assets/models/core_reactor_props.glb'),
      loadCachedGlb('assets/models/pelagian_sub.glb'),
    ]);
    if (this._disposed) return;

    if (pelagianSub) {
      const subRoot = pelagianSub.getObjectByName('PelagianSubRoot');
      if (subRoot) {
        this.subFallback.visible = false;
        const cl = subRoot.clone(true);
        cl.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const cloned = mats.map((m) => {
            const cm = m.clone();
            if (o.name === 'sub_canopy' && cm.name === 'mat_sub_canopy') {
              cm.transparent = true;
              cm.opacity = 0.28;
              cm.depthWrite = false;
            } else if (cm.name === 'mat_sub_enamel') {
              this._subEnamelMat = cm;
            }
            return cm;
          });
          o.material = Array.isArray(o.material) ? cloned : cloned[0];
        });
        this._applySubHullPbr();
        this.subFinL = cl.getObjectByName('sub_fin_L') || null;
        this.subFinR = cl.getObjectByName('sub_fin_R') || null;
        this.subPropeller = cl.getObjectByName('sub_propeller') || null;
        this.subVesselGroup.add(cl);
      }

      // Extract REAL Blender 5.3 sculpted banded tropical reef fish (`reef_angelfish` & `reef_wrasse` — ZERO plastic ovals!)
      const extractNamedMesh = (name) => {
        const node = pelagianSub.getObjectByName(name);
        if (!node) return null;
        if (node.isMesh && node.geometry) return node;
        let found = null;
        node.traverse((o) => {
          if (!found && o.isMesh && o.geometry) found = o;
        });
        return found;
      };

      const angelMesh = extractNamedMesh('reef_angelfish');
      if (angelMesh) {
        this.fishInst1.geometry.dispose();
        this.fishInst1.geometry = angelMesh.geometry.clone();
        if (angelMesh.material) {
          const am = angelMesh.material.clone();
          am.emissive = new THREE.Color('#2a1d06');
          am.emissiveIntensity = 0.22;
          this.fishInst1.material = am;
          this.fishMat1 = am;
        }
      }

      const wrasseMesh = extractNamedMesh('reef_wrasse');
      if (wrasseMesh) {
        this.fishInst2.geometry.dispose();
        this.fishInst2.geometry = wrasseMesh.geometry.clone();
        this.ambFishInst.geometry.dispose();
        this.ambFishInst.geometry = wrasseMesh.geometry.clone();
        if (wrasseMesh.material) {
          const wm = wrasseMesh.material.clone();
          wm.emissive = new THREE.Color('#1c1208');
          wm.emissiveIntensity = 0.20;
          this.fishInst2.material = wm;
          this.ambFishInst.material = wm;
          this.fishMat2 = wm;
        }
      }

      // Keep our sculpted craggy PBR limestone boulders, ridged brain-coral domes & curved dark-edged kelp fronds!
      this._applyCoralPbr();

      // Extract graceful sculpted 3D Reef Manta Ray for upper mid-distance reef ambience
      const mantaNode = pelagianSub.getObjectByName('reef_manta');
      if (mantaNode) {
        const mc = mantaNode.clone(true);
        mc.position.set(0, 0, 0);
        this.mantaGroup.add(mc);
        this.mantaGroup.visible = true;
      }
    }

    if (mine) {
      for (const slot of this.minePool) {
        slot.fallback.visible = false;
        const cl = mine.clone(true);
        cl.scale.setScalar(0.52);
        slot.group.add(cl);
      }
    }

    if (grotto) {
      this.grottoGroup.userData.grottoRim.visible = false;
      const cl = grotto.clone(true);
      cl.scale.setScalar(1.15);
      this.grottoGroup.add(cl);
    }

    // Bind Sea Turtle, River Otter & Siphon Cage GLBs into rescue pool
    // Replace flat neon-pink cage ring with riveted antique-bronze lock band + small faceted glowing sapphire lock-gem!
    const cageLockGemGeo = new THREE.OctahedronGeometry(0.11, 0);
    cageLockGemGeo.scale(0.85, 1.25, 0.72);
    const cageLockGemMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0284c7',
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.36,
      flatShading: true,
    });
    for (const slot of this.cagePool) {
      if (cage) {
        slot.cageGroup.clear();
        const cgClone = cage.clone(true);
        cgClone.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          const replaced = mats.map((m) => {
            const cm = m.clone();
            const nm = String(cm.name || '').toLowerCase();
            const isPinkRing =
              nm.includes('lock') ||
              nm.includes('crystal') ||
              nm.includes('glow') ||
              nm.includes('energy') ||
              (cm.color && cm.color.r > 0.75 && cm.color.g < 0.65 && cm.color.b > 0.55) ||
              (cm.emissive && cm.emissive.r > 0.5);
            if (isPinkRing) {
              cm.color.set('#a87938');
              cm.emissive.set('#261504');
              cm.emissiveIntensity = 0.16;
              cm.metalness = 0.86;
              cm.roughness = 0.28;
            }
            return cm;
          });
          o.material = Array.isArray(o.material) ? replaced : replaced[0];
        });
        const lockGem = new THREE.Mesh(cageLockGemGeo, cageLockGemMat);
        lockGem.position.set(0, 0.0, 0.56);
        cgClone.add(lockGem);
        slot.cageGroup.add(cgClone);
      }
      if (turtle) {
        slot.turtleGroup.clear();
        const tClone = turtle.clone(true);
        tClone.scale.setScalar(0.92);
        slot.flipperL = tClone.getObjectByName('flipper_L') || null;
        slot.flipperR = tClone.getObjectByName('flipper_R') || null;
        slot.turtleGroup.add(tClone);
      }
      if (otter) {
        slot.otterGroup.clear();
        const oClone = otter.clone(true);
        oClone.scale.setScalar(0.95);
        slot.otterTail = oClone.getObjectByName('otter_tail') || null;
        slot.otterGroup.add(oClone);
      }
    }

    // Bind `core_reactor_props.glb` (`reactor_turbine`, `siphon_crystal_lock`, `harmonic_seed_anchor`)
    if (coreProps) {
      const turbSrc = coreProps.getObjectByName('reactor_turbine');
      const lockSrc = coreProps.getObjectByName('siphon_crystal_lock');
      const ancSrc = coreProps.getObjectByName('harmonic_seed_anchor');

      if (turbSrc) {
        for (const slot of this.turbineSlots) {
          slot.fallback.visible = false;
          const cl = turbSrc.clone(true);
          cl.position.set(0, 0, 0);
          cl.rotation.x = Math.PI * 0.5;
          slot.group.add(cl);
        }
      }
      if (lockSrc) {
        for (const slot of this.lockSlots) {
          slot.fallback.visible = false;
          const cl = lockSrc.clone(true);
          cl.position.set(0, 0, 0);
          slot.group.add(cl);
        }
      }
      if (ancSrc) {
        this.seedAnchorGroup.userData.fbLotus.visible = false;
        const cl = ancSrc.clone(true);
        cl.position.set(0, 0, 0);
        this.seedAnchorGroup.add(cl);
      }
    }
  }

  // ============================================================================
  // 3. RENDER `reef_swim` (GATEWAY CORAL REEF & LAKEBED FREE-SWIM)
  // ============================================================================

  render(stageOrSubOrState, opts = {}) {
    if (this._disposed || !this.webgl || !stageOrSubOrState) return;
    const isCore = stageOrSubOrState.mode
      ? stageOrSubOrState.mode === 'core_descent'
      : Boolean(stageOrSubOrState.coreDescent?.active);
    if (isCore) {
      this.renderCoreDescent(stageOrSubOrState, opts);
      return;
    }

    const stage =
      stageOrSubOrState.reefSwim ||
      stageOrSubOrState.subStage ||
      stageOrSubOrState.sub ||
      stageOrSubOrState;

    const sw = stage.swimmer || stage.sub || stage;
    const time = Number(opts.time ?? stage.t ?? stage.timer ?? stageOrSubOrState.time) || 0;
    const dt = clamp(time - this._lastTime || 0.016, 0.001, 0.05);
    this._lastTime = time;

    if (opts.skinId && opts.skinId !== this.skinId) {
      this.setSkin(opts.skinId);
    }

    const rawBiome = stage.biome || stageOrSubOrState.tower?.theme || 'coral_sea';
    const bKey = String(rawBiome).includes('canyon') || String(rawBiome).includes('river')
      ? 'canyon_river'
      : String(rawBiome).includes('alpine') || String(rawBiome).includes('lake')
      ? 'alpine_lake'
      : String(rawBiome).includes('bayou')
      ? 'mist_bayou'
      : String(rawBiome).includes('storm') || String(rawBiome).includes('ocean')
      ? 'storm_ocean'
      : 'coral_sea';
    const pal = BIOME_UNDERWATER_PALETTES[bKey] || BIOME_UNDERWATER_PALETTES.coral_sea;

    this.reefScene.background.set(pal.bgTop);
    this.reefScene.fog.color.set(pal.fog);
    this.reefSun.color.set('#fff1d6');
    this.seabedMat.color.set('#c4dcd8');

    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    this._updateReefCamMetrics();

    const scroll = Number(stage.scroll ?? time * 96) || 0;
    this.causticTex.offset.set((scroll * 0.0022) % 1, Math.sin(time * 0.35) * 0.06);
    if (this.coralSandWebp) {
      this.coralSandWebp.offset.set((scroll * 0.0022) % 1, 0);
    }

    // Aspect-cover studio-painted deep reef panorama backdrop (zero stretching on 412x915 portrait or 1920x1080 desktop!)
    const bgDist = this._reefCamZ + 24;
    const bgH = 2 * Math.tan((this._reefFov * 0.5) * DEG) * bgDist * 1.06;
    const bgW = bgH * aspect * 1.06;
    const imgAspect = 1376 / 768;
    const quadAspect = bgW / Math.max(0.01, bgH);
    this.reefBackdrop.scale.set(bgW, bgH, 1);
    this.reefBackdrop.position.set(0, 0, -24);
    if (this.reefBgWebp) {
      if (quadAspect < imgAspect) {
        const repX = clamp(quadAspect / imgAspect, 0.28, 1);
        const drift = (Math.sin(scroll * 0.00055) * 0.5 + 0.5) * (1 - repX);
        this.reefBgWebp.repeat.set(repX, 1);
        this.reefBgWebp.offset.set(drift, 0);
      } else {
        const repY = clamp(imgAspect / quadAspect, 0.45, 1);
        this.reefBgWebp.repeat.set(1, repY);
        this.reefBgWebp.offset.set(0, (1 - repY) * 0.5);
      }
    }

    const surfaceY = stage.surfaceY != null ? Math.min(stage.surfaceY, this.height * 0.16) : this.height * 0.12;
    const seabedY = stage.seabedY != null ? Math.max(stage.seabedY, this.height * 0.82) : this.height * 0.875;
    const surfW = this._screenToWorld(this.width * 0.5, surfaceY, 0);
    const surfWorldY = surfW.y;
    const bedW = this._screenToWorld(this.width * 0.5, seabedY, 0);
    const bedWorldY = bedW.y;
    const playHalfW = bedW.halfW;
    const playHalfH = bedW.halfH;
    this.seabedMesh.position.y = bedWorldY - 0.55;

    // Anchor large sculpted limestone reef outcrops naturally into the undulating seabed canyon
    for (let i = 0; i < this.ridgeMeshes.length; i++) {
      const m = this.ridgeMeshes[i];
      const ox = (((i * 6.8 - scroll * 0.012) % 52) + 52) % 52 - 26;
      const oz = -6.2 - (i % 3) * 2.4;
      m.position.set(ox, bedWorldY - 0.85 + reefSeabedHeight(ox, oz) * 0.45, oz);
    }

    // Animate sunlit caustic god-ray shafts across the upper reef water column
    for (let i = 0; i < MAX_RAYS; i++) {
      const m = this.rayMeshes[i];
      const rx = (((i * 3.2 - scroll * 0.011) % 36) + 36) % 36 - 18;
      m.position.set(rx, surfWorldY - 1.4, -2.5 - (i % 3) * 1.4);
      m.material.color.set(pal.ray);
      m.material.opacity = 0.18 + 0.08 * Math.sin(time * 1.5 + i * 1.2);
    }

    // REAL 3D Sculpted Blender Coral Reef Formations rooted solidly into the undulating sandy seabed!
    // ZERO 2D cardboard cutouts, ZERO white cutout edges!
    const dm = this._dummy;
    const coralBaseScale = portrait ? 0.92 : 1.08;
    for (let i = 0; i < 18; i++) {
      const cx = (((i * 2.45 - scroll * 0.022) % 44) + 44) % 44 - 22;
      const cz = -1.2 - (i % 5) * 1.25;
      const cy = bedWorldY - 0.62 + reefSeabedHeight(cx, cz + 3.5);
      const sc = (0.85 + (i % 4) * 0.24) * coralBaseScale;
      dm.position.set(cx, cy, cz);
      dm.rotation.set(0, i * 1.37, Math.sin(time * 1.2 + i) * 0.03);
      dm.scale.set(sc, sc * (0.9 + (i % 3) * 0.15), sc);
      dm.updateMatrix();
      this.staghornInst.setMatrixAt(i, dm.matrix);
    }
    this.staghornInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 16; i++) {
      const cx = (((i * 2.75 + 1.1 - scroll * 0.021) % 44) + 44) % 44 - 22;
      const cz = -1.8 - ((i + 2) % 4) * 1.45;
      const cy = bedWorldY - 0.64 + reefSeabedHeight(cx, cz + 3.5);
      const sc = (0.92 + (i % 3) * 0.28) * coralBaseScale;
      dm.position.set(cx, cy, cz);
      dm.rotation.set(0, i * 1.92, 0);
      dm.scale.set(sc, sc * 0.95, sc);
      dm.updateMatrix();
      this.tableCoralInst.setMatrixAt(i, dm.matrix);
    }
    this.tableCoralInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 18; i++) {
      const cx = (((i * 2.45 + 1.8 - scroll * 0.022) % 44) + 44) % 44 - 22;
      const cz = -1.0 - ((i + 1) % 5) * 1.25;
      const sc = (0.82 + (i % 3) * 0.20) * coralBaseScale;
      const cy = bedWorldY - 0.74 + reefSeabedHeight(cx, cz + 3.5);
      dm.position.set(cx, cy, cz);
      dm.rotation.set(0, i * 1.85, Math.sin(time * 1.45 + i * 0.9) * 0.085);
      dm.scale.set(sc, sc * (0.95 + (i % 3) * 0.16), sc);
      dm.updateMatrix();
      this.tubeSpongeInst.setMatrixAt(i, dm.matrix);
    }
    this.tubeSpongeInst.instanceMatrix.needsUpdate = true;

    // Graceful Mid-Distance Sculpted 3D Reef Manta Ray gliding smoothly through the upper sunlit water column
    if (this.mantaGroup.visible) {
      const mx = (((16 - time * 1.45) % 34) + 34) % 34 - 17;
      const my = 2.75 + Math.sin(time * 1.15) * 0.42;
      this.mantaGroup.position.set(mx, my, -5.8);
      this.mantaGroup.rotation.set(Math.sin(time * 1.6) * 0.14, Math.PI, Math.sin(time * 1.15) * 0.08);
      const mWing = 1 + Math.sin(time * 2.4) * 0.14;
      this.mantaGroup.scale.set(1.05, 0.98 * mWing, 1.05);
    }

    // Position & Animate Pelagian Sea-Glass Bio-Submersible with Gateway visibly piloting inside!
    const rawSwX = sw.x ?? this.width * (portrait ? 0.38 : 0.28);
    const rawSwY = sw.y ?? this.height * 0.48;
    const heroRaw = this._screenToWorld(rawSwX, rawSwY, 0.4);
    // Guarantee entire Pelagian Bio-Submersible + bow nose stays 100% inside the middle 75% horizontal safe-zone!
    const safeHalfW = heroRaw.halfW * (portrait ? 0.46 : 0.72);
    const safeHalfH = heroRaw.halfH * (portrait ? 0.50 : 0.62);
    const heroX = clamp(heroRaw.x, -safeHalfW, safeHalfW);
    const heroY = clamp(heroRaw.y, -safeHalfH, safeHalfH);
    const vesselScale = portrait ? 1.12 : 1.44;
    this.subVesselGroup.scale.setScalar(vesselScale);

    const vx = sw.vx || 0;
    const vy = sw.vy || 0;
    const pitch = clamp(Math.atan2(-vy, 300), -0.45, 0.45);
    const roll = clamp(-vy * 0.0012, -0.26, 0.26) + (sw.spin || 0);
    const swimPhase = sw.swimCycle ?? time * 8.2;
    const sonarP = stage.sonarPulse || 0;

    this.heroSwimAnchor.position.set(heroX, heroY, 0.4);
    this.heroSwimAnchor.rotation.set(roll * 0.35, Math.sin(time * 2.4) * 0.06, pitch);
    if (this.subFinL) this.subFinL.rotation.x = Math.sin(swimPhase * 0.75) * 0.26 + pitch * 0.45;
    if (this.subFinR) this.subFinR.rotation.x = -Math.sin(swimPhase * 0.75) * 0.26 - pitch * 0.45;
    if (this.subPropeller) this.subPropeller.rotation.x = time * (14 + (sw.prop || 1) * 10);
    if (this.subSonarBeam) {
      this.subSonarBeam.material.opacity = 0.22 + sonarP * 0.26 + Math.sin(time * 4.2) * 0.03;
      this.subSonarBeam.scale.set(1 + sonarP * 0.25, 1 + sonarP * 0.3, 1 + sonarP * 0.3);
    }

    this.reefHero.update(dt, {
      time,
      vx: 0.4,
      vy: 0,
      facing: 1,
      onGround: true,
      isSwimming: false,
      anim: (sw.whipTimer || 0) > 0.02 ? 'Celebrate' : 'IdleBreathe',
      frillFlare: 0.38 + sonarP * 0.45 + (stage.ventBoostTimer > 0 ? 0.35 : 0),
    });

    // Expanding 3D Harmonic Echo Sonar Sphere
    if (sonarP > 0.01) {
      const origin = this._screenToWorld(stage.sonarOriginX ?? rawSwX, stage.sonarOriginY ?? rawSwY, 0);
      const prog = 1 - sonarP;
      this.echoSphere.visible = true;
      this.echoSphere.position.set(clamp(origin.x, -safeHalfW, safeHalfW), origin.y, 0);
      this.echoSphere.scale.setScalar(0.8 + prog * 8.5);
      this.echoSphere.material.opacity = sonarP * 0.45;
      this.echoSphere.rotation.y = time * 2.2;
    } else {
      this.echoSphere.visible = false;
    }

    // Update Rescued Sea Turtles & River Otters ONLY when real `stage.cages` gameplay rescues exist
    const cages = stage.cages || [];
    let cageVis = 0;
    void playHalfW;
    void playHalfH;
    for (let i = 0; i < cages.length && cageVis < MAX_CAGES; i++) {
      const cg = cages[i];
      const slot = this.cagePool[cageVis++];
      const wp = this._screenToWorld(cg.x, cg.y, 0);
      slot.root.visible = true;
      slot.root.position.set(wp.x, clamp(wp.y, bedWorldY + 0.8, surfWorldY - 0.5), 0.1);
      slot.root.scale.setScalar(portrait ? 0.82 : 1.0);
      const isFreed = cg.state === 'freed';
      slot.cageGroup.visible = !isFreed;
      slot.cageGroup.rotation.y = time * 0.85 + i;
      const isTurtle = cg.animal !== 'otter';
      slot.turtleGroup.visible = isTurtle;
      slot.otterGroup.visible = !isTurtle;
      const animDir = isFreed ? 0 : Math.PI;
      slot.turtleGroup.rotation.set(0, animDir, isFreed ? Math.sin(time * 5 + i) * 0.14 : 0);
      slot.otterGroup.rotation.set(0, animDir, isFreed ? Math.sin(time * 6.5 + i) * 0.18 : 0);
      if (slot.flipperL) slot.flipperL.rotation.x = Math.sin(time * (isFreed ? 8.5 : 3.2) + i) * 0.45;
      if (slot.flipperR) slot.flipperR.rotation.x = -Math.sin(time * (isFreed ? 8.5 : 3.2) + i) * 0.45;
      if (slot.otterTail) slot.otterTail.rotation.y = Math.sin(time * (isFreed ? 10 : 4) + i) * 0.38;
    }
    for (let i = cageVis; i < MAX_CAGES; i++) {
      this.cagePool[i].root.visible = false;
    }

    // Update Gameplay Banded Tropical Reef Fish (`reef_angelfish` & `reef_wrasse`), Harmonic Seeds & Shells
    const fishList = stage.fish || [];
    let c1 = 0;
    let c2 = 0;
    let cShell = 0;
    let cSeed = 0;
    // Gentle sunlit multiplier tints preserving the hand-painted royal-cobalt/golden/coral tropical stripes!
    const fishTints = ['#ffffff', '#fff8dc', '#e6f7ff', '#ffedd5', '#f0fdfa'];

    for (let i = 0; i < fishList.length; i++) {
      const f = fishList[i];
      if (f.caught) continue;
      const wp = this._screenToWorld(f.x, f.y, 0);
      const isBubbled = Boolean(f.bubbled || (f.state === 'bubbled' && (f.bubbleT ?? 1) >= 0));

      if (f.isGear) {
        if (cSeed < 24) {
          dm.position.set(wp.x, wp.y, 0.1);
          dm.rotation.set(time * 2.2 + i, time * 3.1 + i, 0);
          dm.scale.setScalar(1.0);
          dm.updateMatrix();
          this.seedGemInst.setMatrixAt(cSeed++, dm.matrix);
        }
      } else if ((f.species ?? i % 2) === 0 && c1 < MAX_FISH) {
        // Realistic anthias/chromis reef fish scale (`0.48x`) + push clear of Gateway's glass canopy silhouette!
        const sc = f.type === 'big' ? 0.72 : f.type === 'gold' ? 0.62 : 0.48;
        const nearCanopy = Math.abs(wp.x - heroX) < 1.9 && Math.abs(wp.y - heroY) < 1.15;
        dm.position.set(wp.x, wp.y, nearCanopy ? -2.2 : -0.35);
        dm.rotation.set(0, Math.PI + Math.sin(time * 8 + i) * 0.14, clamp((f.vy || 0) * 0.002, -0.32, 0.32));
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._col.set(f.type === 'gold' ? '#fef08a' : fishTints[(f.color || i) % fishTints.length]);
        this.fishInst1.setColorAt(c1, this._col);
        this.fishInst1.setMatrixAt(c1++, dm.matrix);
      } else if (c2 < MAX_FISH) {
        const sc = f.type === 'big' ? 0.68 : 0.48;
        const nearCanopy = Math.abs(wp.x - heroX) < 1.9 && Math.abs(wp.y - heroY) < 1.15;
        dm.position.set(wp.x, wp.y, nearCanopy ? -2.2 : -0.35);
        dm.rotation.set(0, Math.PI + Math.sin(time * 7.5 + i) * 0.15, clamp((f.vy || 0) * 0.002, -0.32, 0.32));
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._col.set(f.type === 'gold' ? '#fef08a' : fishTints[(f.color || i + 1) % fishTints.length]);
        this.fishInst2.setColorAt(c2, this._col);
        this.fishInst2.setMatrixAt(c2++, dm.matrix);
      }

      if (isBubbled && cShell < MAX_BUBBLE_SHELLS) {
        const br = this._pxScale(f.bubbleR || 20, 0);
        dm.position.set(wp.x, wp.y, 0.15);
        dm.rotation.set(0, time * 1.5, 0);
        dm.scale.setScalar(Math.max(0.32, br));
        dm.updateMatrix();
        this.bubbleShellInst.setMatrixAt(cShell++, dm.matrix);
      }
    }
    this.fishInst1.count = c1;
    this.fishInst2.count = c2;
    this.bubbleShellInst.count = cShell;
    this.seedGemInst.count = cSeed;
    if (c1 > 0) {
      this.fishInst1.instanceMatrix.needsUpdate = true;
      if (this.fishInst1.instanceColor) this.fishInst1.instanceColor.needsUpdate = true;
    }
    if (c2 > 0) {
      this.fishInst2.instanceMatrix.needsUpdate = true;
      if (this.fishInst2.instanceColor) this.fishInst2.instanceColor.needsUpdate = true;
    }
    if (cShell > 0) this.bubbleShellInst.instanceMatrix.needsUpdate = true;
    if (cSeed > 0) this.seedGemInst.instanceMatrix.needsUpdate = true;

    // Background Sunlit Reef Shoal parting gracefully around Gateway (deep mid-distance lanes, realistic 0.36x scale!)
    for (let i = 0; i < MAX_AMB; i++) {
      const bx = (((i * 1.9 - time * (1.8 + (i % 4) * 0.35)) % 44) + 44) % 44 - 22;
      let by = Math.sin(i * 2.1 + time * 1.2) * 3.6;
      const bz = -3.8 - (i % 5) * 1.2;
      const dx = bx - heroX;
      const dy = by - heroY;
      const d2 = dx * dx + dy * dy;
      if (d2 < 8.0) {
        by += (dy >= 0 ? 1 : -1) * (1 - d2 / 8.0) * 1.45;
      }
      dm.position.set(bx, by, bz);
      dm.rotation.set(0, Math.PI + Math.sin(time * 7 + i) * 0.15, 0);
      dm.scale.setScalar(0.32 + (i % 3) * 0.08);
      dm.updateMatrix();
      this._col.set(fishTints[i % fishTints.length]);
      this.ambFishInst.setColorAt(i, this._col);
      this.ambFishInst.setMatrixAt(i, dm.matrix);
    }
    this.ambFishInst.count = MAX_AMB;
    this.ambFishInst.instanceMatrix.needsUpdate = true;
    if (this.ambFishInst.instanceColor) this.ambFishInst.instanceColor.needsUpdate = true;

    // Gateway's Hydro-Pulse Projectiles
    const shots = stage.bubbles || [];
    let pCount = 0;
    for (let i = 0; i < shots.length && pCount < MAX_PULSES; i++) {
      const b = shots[i];
      const wp = this._screenToWorld(b.x, b.y, 0);
      dm.position.set(wp.x, wp.y, 0.25);
      dm.rotation.set(time * 6 + i, time * 8, 0);
      dm.scale.setScalar(1.05);
      dm.updateMatrix();
      this.pulseInst.setMatrixAt(pCount++, dm.matrix);
    }
    this.pulseInst.count = pCount;
    if (pCount > 0) this.pulseInst.instanceMatrix.needsUpdate = true;

    // Jellyfish
    const jellies = stage.jellies || [];
    let jCount = 0;
    for (let i = 0; i < jellies.length && jCount < MAX_JELLY; i++) {
      const j = jellies[i];
      const wp = this._screenToWorld(j.x, j.y, 0);
      const sq = 1 + Math.sin(j.pulse || time * 3) * 0.16;
      dm.position.set(wp.x, wp.y, 0.05);
      dm.rotation.set(0, time * 0.6 + i, Math.sin(time + i) * 0.1);
      dm.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      dm.updateMatrix();
      this.jellyInst.setMatrixAt(jCount++, dm.matrix);
    }
    this.jellyInst.count = jCount;
    if (jCount > 0) this.jellyInst.instanceMatrix.needsUpdate = true;

    // Siphon Surge Mines & Swaying Chains
    const mines = stage.mines || [];
    let chCount = 0;
    for (let i = 0; i < MAX_MINES; i++) {
      const slot = this.minePool[i];
      if (i >= mines.length) {
        slot.group.visible = false;
        continue;
      }
      const m = mines[i];
      const wp = this._screenToWorld(m.x, m.y, 0);
      slot.group.visible = true;
      slot.group.position.set(wp.x, wp.y, 0);
      slot.group.rotation.set(time * 0.4 + i, m.spin || time * 0.6, 0);
      if (m.kind !== 'float') {
        const span = Math.max(0, wp.y - (bedWorldY - 0.2));
        const links = Math.min(12, Math.floor(span / 0.35));
        for (let k = 0; k < links && chCount < MAX_CHAINS; k++) {
          const ly = wp.y - 0.45 - k * 0.35;
          dm.position.set(wp.x + Math.sin(time * 2 + k * 0.5) * 0.05, ly, -0.05);
          dm.rotation.set(0, (k % 2) * 1.57, 0);
          dm.scale.setScalar(1);
          dm.updateMatrix();
          this.chainInst.setMatrixAt(chCount++, dm.matrix);
        }
      }
    }
    // Hang vertical dark iron anchor chains from active (non-freed) wildlife cages straight into the seabed!
    for (let i = 0; i < cages.length && i < MAX_CAGES; i++) {
      const cg = cages[i];
      if (cg.state === 'freed') continue;
      const slot = this.cagePool[i];
      if (!slot.root.visible) continue;
      const cx = slot.root.position.x;
      const cy = slot.root.position.y;
      const cz = slot.root.position.z;
      const span = Math.max(0, cy - 0.55 - (bedWorldY - 0.75));
      const links = Math.min(20, Math.ceil(span / 0.24));
      for (let k = 0; k < links && chCount < MAX_CHAINS; k++) {
        const ly = cy - 0.58 - k * 0.24;
        dm.position.set(cx + Math.sin(time * 1.6 + k * 0.4) * 0.025, ly, cz);
        dm.rotation.set(0, (k % 2) * 1.57, 0);
        dm.scale.set(1.15, 1.0, 1.15);
        dm.updateMatrix();
        this.chainInst.setMatrixAt(chCount++, dm.matrix);
      }
    }
    this.chainInst.count = chCount;
    if (chCount > 0) this.chainInst.instanceMatrix.needsUpdate = true;

    // Tidal Pearl Clams & Geyser Vents
    const clams = stage.clams || [];
    for (let i = 0; i < MAX_CLAMS; i++) {
      const slot = this.clamSlots[i];
      if (i >= clams.length) {
        slot.root.visible = false;
        continue;
      }
      const c = clams[i];
      const wp = this._screenToWorld(c.x, c.y, 0);
      slot.root.visible = true;
      slot.root.position.set(wp.x, bedWorldY - 0.08, 0.1);
      slot.topPiv.rotation.x = -(c.open || 0) * 0.95;
      slot.pearl.visible = Boolean(c.hasPearl);
    }

    const vents = stage.vents || [];
    let vCount = 0;
    for (let i = 0; i < vents.length && vCount < MAX_VENTS; i++) {
      const v = vents[i];
      const wp = this._screenToWorld(v.x, seabedY, 0);
      const vyBed = bedWorldY - 0.62 + reefSeabedHeight(wp.x, 3.0);
      dm.position.set(wp.x, vyBed, -0.5);
      dm.rotation.set(0, i * 1.4, 0);
      dm.scale.set(0.95, 0.78, 0.92);
      dm.updateMatrix();
      this.ventInst.setMatrixAt(vCount++, dm.matrix);
    }
    this.ventInst.count = vCount;
    if (vCount > 0) this.ventInst.instanceMatrix.needsUpdate = true;

    // Coral Sanctuary Grotto Arch (`warpCave`) & Arrival Spire
    const wc = stage.warpCave;
    if (wc && wc.active && !wc.entered && wc.x < this.width + 180) {
      const wp = this._screenToWorld(wc.x, wc.y, 0);
      this.grottoGroup.visible = true;
      this.grottoGroup.position.set(wp.x, wp.y, -0.4);
      this.grottoGroup.userData.grottoPortal.rotation.z = time * 1.6;
    } else {
      this.grottoGroup.visible = false;
    }

    if (stage.tower?.active) {
      const twp = this._screenToWorld(stage.tower.x, this.height * 0.5, -4.5);
      this.arrivalSpire.visible = true;
      this.arrivalSpire.position.set(twp.x, 0, -4.5);
      this.arrivalSpire.rotation.y = time * 0.25;
    } else {
      this.arrivalSpire.visible = false;
    }

    // Shockwave Rings, Underwater Bubbles & Popups
    const rings = stage.rings || stage.shockwaves || [];
    let rCount = 0;
    for (let i = 0; i < rings.length && rCount < MAX_RINGS; i++) {
      const r = rings[i];
      const u = 1 - clamp(r.life / Math.max(0.01, r.maxLife || 0.5), 0, 1);
      const radPx = lerp(r.r0 ?? 10, r.r1 ?? r.maxR ?? 85, u);
      const wp = this._screenToWorld(r.x, r.y, 0);
      dm.position.set(wp.x, wp.y, 0.3);
      dm.rotation.set(r.flat ? Math.PI * 0.46 : 0, 0, 0);
      dm.scale.setScalar(Math.max(0.15, this._pxScale(radPx, 0)));
      dm.updateMatrix();
      this._col.set(r.color || '#5efce8');
      this.ringInst.setColorAt(rCount, this._col);
      this.ringInst.setMatrixAt(rCount++, dm.matrix);
    }
    this.ringInst.count = rCount;
    if (rCount > 0) {
      this.ringInst.instanceMatrix.needsUpdate = true;
      if (this.ringInst.instanceColor) this.ringInst.instanceColor.needsUpdate = true;
    }

    // Delicate Translucent Rising Glassy Micro-Bubbles from Stern Propeller + Stage Particles
    let ptCount = 0;
    const propOriginX = heroX - 1.32 * vesselScale;
    for (let i = 0; i < 34 && ptCount < MAX_PARTICLES; i++) {
      const age = (time * 1.45 + i * 0.21) % 1;
      const bx = propOriginX - age * 2.85 - Math.sin(i * 3.1) * 0.14;
      const by = heroY - 0.04 + Math.sin(time * 5.2 + i * 1.9) * (0.08 + age * 0.22) + age * 0.88;
      const bSize = (0.36 + (i % 5) * 0.14) * (1 - age * 0.55);
      dm.position.set(bx, by, 0.25 + (i % 3) * 0.06);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar(bSize);
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#e0f7ff' : '#bae6fd');
      this.particleInst.setColorAt(ptCount, this._col);
      this.particleInst.setMatrixAt(ptCount++, dm.matrix);
    }
    const extParts = opts.particles || stageOrSubOrState.particles || [];
    for (let i = 0; i < extParts.length && ptCount < MAX_PARTICLES; i++) {
      const p = extParts[i];
      if (p.x == null || p.y == null) continue;
      const wp = this._screenToWorld(p.x, p.y, 0);
      const a = clamp(p.life / Math.max(0.01, p.maxLife || 1), 0, 1);
      dm.position.set(wp.x, wp.y, 0.4);
      dm.scale.setScalar(a * 1.15);
      dm.updateMatrix();
      this._col.set(p.color || '#ffffff');
      this.particleInst.setColorAt(ptCount, this._col);
      this.particleInst.setMatrixAt(ptCount++, dm.matrix);
    }
    this.particleInst.count = ptCount;
    this.particleInst.instanceMatrix.needsUpdate = true;
    if (this.particleInst.instanceColor) this.particleInst.instanceColor.needsUpdate = true;

    this._syncPopups(opts.popups || stageOrSubOrState.popups || []);

    // Camera subtle surge & shake (direct single-pass WebGL2 60fps!)
    const sh = Number(opts.shake ?? stageOrSubOrState.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 67) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 59) * sh * 0.02 : 0;
    this.reefCam.position.set(sx, sy, this._reefCamZ);
    this.reefCam.lookAt(sx, sy, 0);

    const prevTarget = this.webgl.getRenderTarget();
    this.webgl.setRenderTarget(null);
    this.webgl.render(this.reefScene, this.reefCam);
    this.webgl.setRenderTarget(prevTarget);
  }

  // ============================================================================
  // 4. RENDER `core_descent` (360° FLOODED CENTRAL REACTOR SHAFT DIVE!)
  // ============================================================================

  renderCoreDescent(state, opts = {}) {
    if (this._disposed || !this.webgl || !state) return;
    const cd = state.coreDescent || state.descent || state.core || {};
    const time = Number(opts.time ?? state.time ?? cd.timer) || 0;
    const dt = clamp(time - this._lastTime || 0.016, 0.001, 0.05);
    this._lastTime = time;

    const skin = state.gateway?.skinId || state.player?.skinId || opts.skinId || this.skinId;
    if (skin && skin !== this.skinId) this.setSkin(skin);

    const totalDepthMeters = Math.max(10, Number(cd.totalDepth) || 420);
    const progress = clamp(
      cd.progress ?? (cd.depth != null ? cd.depth / totalDepthMeters : cd.duration > 0 ? (cd.timer || 0) / cd.duration : (time % 21) / 21),
      0,
      1
    );
    const worldSpan = 165;
    const diveY = -progress * worldSpan;

    // Normalized steering coordinates inside the `R = 3.45` reactor shaft (`-1..+1` -> `-2.15..+2.15u`)
    const rawX = clamp(Number(cd.x ?? cd.playerX ?? state.gateway?.vx * 0.12) || 0, -1, 1);
    const rawZ = clamp(Number(cd.y ?? cd.z ?? cd.playerZ ?? 0) || 0, -1, 1);
    const radLen = Math.hypot(rawX, rawZ);
    const clampedScale = radLen > 1 ? 1 / radLen : 1;
    const hx = rawX * clampedScale * 2.05;
    const hz = rawZ * clampedScale * 2.05;

    const whipT = Number(cd.whipTimer ?? cd.spinTimer ?? state.gateway?.tailWhipTimer) || 0;
    const seedPlanted = Boolean(cd.seedPlanted || cd.phase === 'purify' || progress >= 0.96);

    // Loop the 18 instanced stone-and-bronze shaft ring segments smoothly around `diveY`
    const spacing = 5.6;
    const baseIdx = Math.floor(-diveY / spacing);
    const dm = this._dummy;
    for (let i = 0; i < MAX_CORE_RINGS; i++) {
      const ringIdx = baseIdx - 3 + i;
      const ry = -ringIdx * spacing;
      const rotY = ringIdx * 0.26;
      dm.position.set(0, ry, 0);
      dm.rotation.set(0, rotY, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.shaftWallInst.setMatrixAt(i, dm.matrix);
      this.shaftRingInst.setMatrixAt(i, dm.matrix);
      dm.position.set(0, ry + 0.24, 0);
      dm.updateMatrix();
      this.shaftGlowInst.setMatrixAt(i, dm.matrix);
    }
    this.shaftWallInst.instanceMatrix.needsUpdate = true;
    this.shaftRingInst.instanceMatrix.needsUpdate = true;
    this.shaftGlowInst.instanceMatrix.needsUpdate = true;

    // Position the studio-painted domed hydro-reactor abyss backdrop down-shaft
    this.coreAbyssBackdrop.position.set(0, diveY - 40, 0);
    this.coreAbyssBackdrop.rotation.z = time * 0.04;

    // Update Gateway Headfirst Dive Pose
    this.coreHeroAnchor.position.set(hx, diveY, hz);
    this.coreHeroAnchor.rotation.set(
      clamp((cd.vy ?? cd.vz ?? 0) * 0.12, -0.35, 0.35),
      whipT > 0.01 ? time * 18 : Math.atan2(hx, hz + 0.001) * 0.15,
      clamp(-(cd.vx ?? 0) * 0.14, -0.42, 0.42)
    );
    this.coreHero.update(dt, {
      time,
      vx: 3.5,
      vy: -6.0,
      onGround: false,
      isSwimming: true,
      coreDive: true,
      anim: seedPlanted ? 'Celebrate' : whipT > 0.01 ? 'TailWhip' : 'CoreDive',
      swimPhase: time * 11.5,
      frillFlare: 0.72,
    });
    this.coreHeroLight.position.set(hx, diveY + 1.2, hz);

    if (whipT > 0.01) {
      this.coreWhipRing.material.opacity = clamp(whipT * 2.4, 0, 0.88);
      this.coreWhipRing.scale.setScalar(1.0 + (1 - clamp(whipT * 2.5, 0, 1)) * 0.85);
    } else {
      this.coreWhipRing.material.opacity = 0;
    }

    // Spinning Hydro-Turbine Obstacles (1:1 with `game.js` `cd.turbines`: `depth`, `rotAngle`, `rotSpeed`)
    // Hide any turbine once it passes Gateway's depth plane (`ty > diveY - 0.85`) so it NEVER passes between `coreCam` and Gateway!
    const turbines = cd.turbines || cd.obstacles || null;
    for (let i = 0; i < MAX_CORE_TURBINES; i++) {
      const slot = this.turbineSlots[i];
      if (turbines && turbines.length > 0) {
        if (i >= turbines.length) {
          slot.group.visible = false;
          continue;
        }
        const tb = turbines[i];
        const tp = tb.progress ?? (tb.depth != null ? tb.depth / totalDepthMeters : (i + 1) / (turbines.length + 1));
        const ty = -tp * worldSpan;
        if (ty > diveY - 0.85 || diveY - ty > 48) {
          slot.group.visible = false;
          continue;
        }
        slot.group.visible = true;
        slot.group.position.set(0, ty, 0);
        const rotA = tb.rotAngle ?? tb.angle ?? tb.gapAngle ?? time * (tb.rotSpeed || tb.speed || 1.35) * (i % 2 ? 1 : -1);
        // `-rotA` around `+Y` maps blade angles `(X, Z)` to `ba + rotA`, matching `game.js` `atan2(y, x) - tb.rotAngle` 1:1!
        slot.group.rotation.set(0, -rotA, 0);
      } else {
        const tp = 0.14 + i * 0.085;
        if (tp > 0.88) {
          slot.group.visible = false;
          continue;
        }
        const ty = -tp * worldSpan;
        slot.group.visible = ty <= diveY - 0.85 && (diveY - ty) < 46;
        slot.group.position.set(0, ty, 0);
        slot.group.rotation.set(0, -time * (1.2 + (i % 3) * 0.25) * (i % 2 === 0 ? 1 : -1) - i * 1.1, 0);
      }
    }

    // Glowing Siphon Crystal Locks (1:1 with `game.js` `cd.crystalLocks`: `shattered`, `depth`, `x`, `y`)
    const locks = cd.crystalLocks || cd.cores || cd.locks || null;
    for (let i = 0; i < MAX_CORE_LOCKS; i++) {
      const slot = this.lockSlots[i];
      if (locks && locks.length > 0) {
        if (i >= locks.length || locks[i].shattered || locks[i].smashed || locks[i].destroyed) {
          slot.group.visible = false;
          continue;
        }
        const lk = locks[i];
        const lp = lk.progress ?? (lk.depth != null ? lk.depth / totalDepthMeters : (i + 1) * 0.22);
        const ly = -lp * worldSpan;
        slot.group.visible = ly <= diveY - 0.65 && (diveY - ly) < 46;
        slot.group.position.set((lk.x || 0) * 2.15, ly, (lk.y ?? 0) * 2.15);
        slot.group.rotation.set(time * 1.4 + i, time * 2.2 + i, 0);
      } else if (i < 3) {
        const lp = 0.24 + i * 0.24;
        const ly = -lp * worldSpan;
        slot.group.visible = progress < lp + 0.02 && ly <= diveY - 0.65 && (diveY - ly) < 46;
        const ang = i * 2.1 + time * 0.6;
        slot.group.position.set(Math.cos(ang) * 1.35, ly, Math.sin(ang) * 1.35);
        slot.group.rotation.set(time * 1.5, time * 2.4, 0);
      } else {
        slot.group.visible = false;
      }
    }

    // Bioluminescent Hydro-Speed Boost Rings (`cd.rings`) & Downward Hydro-Pulses (`cd.pulses`)
    const boostRings = cd.rings || cd.pickups || [];
    let brCnt = 0;
    for (let i = 0; i < boostRings.length && brCnt < 16; i++) {
      const rg = boostRings[i];
      if (rg.collected) continue;
      const rp = rg.progress ?? (rg.depth != null ? rg.depth / totalDepthMeters : (i + 1) * 0.09);
      const ry = -rp * worldSpan;
      if (ry > diveY - 0.45 || diveY - ry > 46) continue;
      dm.position.set((rg.x || 0) * 2.15, ry, (rg.y || 0) * 2.15);
      dm.rotation.set(Math.PI * 0.5, 0, time * 2.2 + i);
      dm.scale.setScalar(1.0);
      dm.updateMatrix();
      this.coreBoostRingInst.setMatrixAt(brCnt++, dm.matrix);
    }
    this.coreBoostRingInst.count = brCnt;
    if (brCnt > 0) this.coreBoostRingInst.instanceMatrix.needsUpdate = true;

    const divePulses = cd.pulses || [];
    let dpCnt = 0;
    for (let i = 0; i < divePulses.length && dpCnt < 16; i++) {
      const pl = divePulses[i];
      const pp = pl.depth != null ? pl.depth / totalDepthMeters : progress + 0.02;
      const py = -pp * worldSpan;
      if (Math.abs(py - diveY) > 46) continue;
      dm.position.set((pl.x || 0) * 2.15, py, (pl.y || 0) * 2.15);
      dm.rotation.set(time * 9, time * 11, 0);
      dm.scale.setScalar(1.1);
      dm.updateMatrix();
      this.coreDivePulseInst.setMatrixAt(dpCnt++, dm.matrix);
    }
    this.coreDivePulseInst.count = dpCnt;
    if (dpCnt > 0) this.coreDivePulseInst.instanceMatrix.needsUpdate = true;

    // Bedrock Harmonic Seed Lotus Anchor (`y = -worldSpan - 3.2`)
    const anchorY = -worldSpan - 3.2;
    if (Math.abs(anchorY - diveY) < 55) {
      this.seedAnchorGroup.visible = true;
      this.seedAnchorGroup.position.set(0, anchorY, 0);
      this.seedAnchorGroup.rotation.y = time * 0.65;
      const beam = this.seedAnchorGroup.userData.eruptionBeam;
      if (seedPlanted) {
        beam.material.opacity = 0.52 + Math.sin(time * 14) * 0.12;
        this.coreScene.background.set('#083b54');
      } else {
        beam.material.opacity = 0.08;
        this.coreScene.background.set('#041120');
      }
    } else {
      this.seedAnchorGroup.visible = false;
    }

    // Subtle Hair-Thin Peripheral Air-Rush Streaks ONLY near outer shaft wall & strictly below Gateway!
    // (ZERO thick beams or foreground camera-clipping planks!)
    for (let i = 0; i < MAX_CORE_STREAKS; i++) {
      const ang = i * 2.39996;
      const rad = 2.88 + (i % 5) * 0.095;
      const relY = -1.8 - ((((i * 0.48 + time * 19) % 26) + 26) % 26);
      dm.position.set(Math.cos(ang) * rad, diveY + relY, Math.sin(ang) * rad);
      dm.rotation.set(0, 0, 0);
      dm.scale.set(0.68, 0.95 + (cd.boostTimer > 0 ? 0.35 : 0), 0.68);
      dm.updateMatrix();
      this.streakInst.setMatrixAt(i, dm.matrix);
    }
    this.streakInst.count = MAX_CORE_STREAKS;
    this.streakInst.instanceMatrix.needsUpdate = true;

    // 14 Faceted 3D Rose-Quartz Crystal Shards flying radially OUTWARD away from Gateway (ZERO flat pink confetti!)
    const curSmashed = Number(cd.crystalsSmashed ?? cd.coresSmashed) || 0;
    if (curSmashed > this._lastCoreSmashed) {
      this._shardBurstT = 1.0;
      this._shardOrigin.x = hx;
      this._shardOrigin.y = diveY - 3.6;
      this._shardOrigin.z = hz;
    }
    this._lastCoreSmashed = curSmashed;
    if (this._shardBurstT > 0.01) {
      this._shardBurstT = Math.max(0, this._shardBurstT - dt * 1.45);
      const p = 1 - this._shardBurstT;
      const SHARD_CNT = 14;
      for (let i = 0; i < SHARD_CNT; i++) {
        const a1 = (i / SHARD_CNT) * TAU + 0.35;
        const a2 = ((i * 5) % 9) * 0.18 - 0.8;
        const sp = 1.35 + p * (2.6 + (i % 4) * 0.45);
        dm.position.set(
          this._shardOrigin.x + Math.cos(a1) * sp,
          this._shardOrigin.y + Math.sin(a2) * sp * 0.8 - p * 1.8,
          this._shardOrigin.z + Math.sin(a1) * sp
        );
        dm.rotation.set(time * 7 + i * 1.3, time * 9 - i, i * 0.8);
        const sBase = this._shardBurstT * (0.65 + (i % 3) * 0.25);
        dm.scale.set(sBase * 0.72, sBase * 1.45, sBase * 0.72);
        dm.updateMatrix();
        this.coreShardInst.setMatrixAt(i, dm.matrix);
      }
      this.coreShardInst.count = SHARD_CNT;
      this.coreShardInst.instanceMatrix.needsUpdate = true;
    } else {
      this.coreShardInst.count = 0;
    }

    // Exhilarating 360° Chase Camera Above Gateway Looking Down the Flooded Reactor Shaft
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const baseFov = portrait ? 56 : 54;
    const boostFov = cd.boostTimer > 0 ? baseFov + 7 : baseFov;
    if (Math.abs(this.coreCam.fov - boostFov) > 0.1) {
      this.coreCam.fov = lerp(this.coreCam.fov, boostFov, 0.15);
      this.coreCam.updateProjectionMatrix();
    }
    this.coreHeroInner.scale.setScalar(portrait ? 1.28 : 1.32);
    const sh = Number(opts.shake ?? state.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 71) * sh * 0.025 : 0;
    const sz = sh > 0.01 ? Math.cos(time * 63) * sh * 0.025 : 0;

    if (seedPlanted) {
      // Dramatic orbit pull-back as the Harmonic Water Seed erupts up the reactor shaft!
      const orbitA = time * 0.9;
      this.coreCam.position.set(Math.cos(orbitA) * 2.5, anchorY + 6.2, Math.sin(orbitA) * 2.5);
      this.coreCam.up.set(0, 1, 0);
      this.coreCam.lookAt(0, anchorY + 1.2, 0);
    } else if (portrait) {
      // Portrait 412x915 safe-zone framing: keeps Gateway ~44% Y (100% below top HUD) with spinning turbines below!
      this.coreCam.position.set(hx * 0.44 + sx, diveY + 5.85, hz * 0.44 + 1.25 + sz);
      this.coreCam.up.set(0, 0, -1);
      this.coreCam.lookAt(hx * 0.76, diveY - 6.0, hz * 0.76 - 0.60);
    } else {
      // Desktop 1920x1080 heroic overhead plunge camera: keeps Gateway ~47% Y (100% clear of top SIPHON CORE HUD)!
      this.coreCam.position.set(hx * 0.46 + sx, diveY + 5.55, hz * 0.46 + 1.05 + sz);
      this.coreCam.up.set(0, 0, -1);
      this.coreCam.lookAt(hx * 0.80, diveY - 6.0, hz * 0.80 - 0.85);
    }

    const prevTarget = this.webgl.getRenderTarget();
    this.webgl.setRenderTarget(null);
    this.webgl.render(this.coreScene, this.coreCam);
    this.webgl.setRenderTarget(prevTarget);
  }

  _syncPopups(popups) {
    for (let i = 0; i < MAX_POPUPS; i++) {
      const slot = this.popupPool[i];
      if (i >= popups.length || popups[i].x == null || popups[i].y == null) {
        slot.sprite.visible = false;
        continue;
      }
      const p = popups[i];
      const key = `${p.text}_${p.color}`;
      if (slot.key !== key) {
        slot.sprite.material.map?.dispose();
        slot.sprite.material.map = createPopupSpriteTex(p.text || '', p.color || '#fde047');
        slot.sprite.material.needsUpdate = true;
        slot.key = key;
      }
      const wp = this._screenToWorld(p.x, p.y, 0.8);
      const t = 1 - clamp(p.life / Math.max(0.01, p.maxLife || 1), 0, 1);
      slot.sprite.visible = true;
      slot.sprite.position.set(wp.x, wp.y + t * 0.45, 0.8);
      slot.sprite.scale.set(2.2, 0.44, 1);
      slot.sprite.material.opacity = Math.max(0, 1 - t * t);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.reefHero?.dispose();
    this.coreHero?.dispose();
    if (this._ownDotTex) this.softDotTex?.dispose();
    this.causticTex?.dispose();
    this.godRayTex?.dispose();
    this.backdropTex?.dispose();
    this.reefStoneTex?.dispose();
    this.barkTex?.dispose();
    this.envTex?.dispose();
    for (const p of this.popupPool) {
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
  }
}

export { SubRenderer as ReefSwimRenderer };
export default SubRenderer;
