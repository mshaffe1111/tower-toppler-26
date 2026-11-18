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
const MAX_AMB = 96;
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
  // UV-clean CylinderGeometry + SphereGeometry coral-limestone arch/ridge (continuous 0..1 UVs!)
  const main = new THREE.CylinderGeometry(radius * 0.45, radius * 1.18, height, 16, 8);
  const pos = main.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + height * 0.5) / height;
    const strata = 1.0 + 0.16 * Math.sin(yn * 16.0 + seed) + (rng() - 0.5) * 0.18;
    x *= strata;
    z *= strata * 0.78;
    if (yn > 0.88) {
      y -= (rng() * 0.25 + 0.08) * radius;
    }
    pos.setXYZ(i, x, y, z);
  }
  main.computeVertexNormals();
  parts.push(main);

  for (let s = 0; s < 2; s++) {
    const dir = s === 0 ? -1 : 1;
    const shelf = new THREE.SphereGeometry(radius * (0.56 + s * 0.12), 14, 10);
    shelf.scale(1.25, 0.68, 0.85);
    shelf.translate(dir * radius * 0.64, -height * (0.18 - s * 0.22), 0.25);
    parts.push(shelf);
  }
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

function buildBranchingCoralGeo() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.09, 0.16, 0.62, 7);
  trunk.translate(0, 0.28, 0);
  parts.push(trunk);
  const branches = [
    [0.22, 0.52, 0.08, 0.48, 0, -0.52],
    [-0.24, 0.48, -0.06, -0.44, 0.2, 0.56],
    [0.06, 0.58, 0.22, 0.52, 0.4, 0.14],
    [-0.08, 0.54, -0.22, -0.48, -0.3, -0.18],
    [0.34, 0.78, 0.12, 0.32, 0, -0.78],
    [-0.36, 0.74, -0.10, -0.30, 0, 0.82],
  ];
  for (const [tx, ty, tz, rx, ry, rz] of branches) {
    const b = new THREE.CapsuleGeometry(0.068, 0.36, 5, 7);
    b.rotateZ(rz);
    b.rotateX(rx);
    b.rotateY(ry);
    b.translate(tx, ty, tz);
    parts.push(b);
  }
  return mergeBufferGeos(parts);
}

function buildRibbonKelpGeo() {
  const parts = [];
  // Undulating central kelp stipe + 5 organic leaf blades
  const segs = 7;
  for (let s = 0; s < segs; s++) {
    const y0 = s * 0.46;
    const xOff = Math.sin(s * 0.85) * 0.14;
    const stipe = new THREE.CylinderGeometry(0.032, 0.044, 0.50, 5);
    stipe.rotateZ(Math.cos(s * 0.85) * 0.22);
    stipe.translate(xOff, y0 + 0.24, 0);
    parts.push(stipe);
    if (s >= 1) {
      const side = s % 2 === 0 ? 1 : -1;
      const blade = new THREE.SphereGeometry(0.22, 7, 5);
      blade.scale(1.65, 0.34, 0.18);
      blade.rotateZ(side * 0.42);
      blade.translate(xOff + side * 0.26, y0 + 0.28, (s % 3 - 1) * 0.05);
      parts.push(blade);
    }
  }
  return mergeBufferGeos(parts);
}

function buildUnderwaterEnvTexture(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#0c698a');
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(18, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#7dd3fc', side: THREE.BackSide })
    );
    sky.scale.set(1, 0.5, 1);
    sky.position.y = 8;
    envScene.add(sky);
    const warmBounce = new THREE.Mesh(
      new THREE.SphereGeometry(10, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fbbf24', side: THREE.BackSide })
    );
    warmBounce.position.set(6, 10, 6);
    envScene.add(warmBounce);
    const aquaFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: '#2dd4bf', side: THREE.DoubleSide })
    );
    aquaFloor.rotation.x = -Math.PI * 0.5;
    aquaFloor.position.y = -6;
    envScene.add(aquaFloor);
    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt.texture;
  } catch {
    return null;
  }
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
    this.backdropTex = createDeepWaterBackdropTexture();
    this.reefStoneTex = createStratifiedReefStoneTexture(256);
    this.barkTex = createRedwoodBarkTexture(128);
    this.envTex = buildUnderwaterEnvTexture(webgl);
    this._disposed = false;
    this._lastTime = 0;

    // Scratch zero-GC objects
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._shake = { x: 0, y: 0 };

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

  resize(width, height) {
    this.width = Math.max(1, width || 390);
    this.height = Math.max(1, height || 620);
    const aspect = this.width / this.height;
    if (this.reefCam) {
      this.reefCam.aspect = aspect;
      this.reefCam.updateProjectionMatrix();
    }
    if (this.coreCam) {
      this.coreCam.aspect = aspect;
      this.coreCam.updateProjectionMatrix();
    }
  }

  _screenToWorld(sx, sy, z = 0) {
    const dist = CAM_Z - z;
    const halfH = Math.tan((FOV * 0.5) * DEG) * dist;
    const halfW = halfH * (this.width / Math.max(1, this.height));
    return {
      x: ((sx / Math.max(1, this.width)) * 2 - 1) * halfW,
      y: (1 - (sy / Math.max(1, this.height)) * 2) * halfH,
      halfW,
      halfH,
    };
  }

  _pxScale(px, z = 0) {
    const dist = CAM_Z - z;
    const halfH = Math.tan((FOV * 0.5) * DEG) * dist;
    return (px / Math.max(1, this.height)) * (2 * halfH);
  }

  // ============================================================================
  // 1. REEF & LAKEBED FREE-SWIM SCENE (`reef_swim`)
  // ============================================================================

  _initReefScene() {
    this.reefScene = new THREE.Scene();
    this.reefScene.background = new THREE.Color('#0688ad');
    this.reefScene.fog = new THREE.FogExp2('#086c96', 0.015);
    if (this.envTex) this.reefScene.environment = this.envTex;

    this.reefCam = new THREE.PerspectiveCamera(FOV, this.width / Math.max(1, this.height), 0.2, 180);
    this.reefCam.position.set(0, 0, CAM_Z);

    this.reefHemi = new THREE.HemisphereLight('#a5f3fc', '#1e3a5f', 1.35);
    this.reefScene.add(this.reefHemi);

    this.reefSun = new THREE.DirectionalLight('#fffbeb', 2.35);
    this.reefSun.position.set(5, 16, 9);
    this.reefScene.add(this.reefSun);

    this.reefFill = new THREE.DirectionalLight('#2dd4bf', 0.95);
    this.reefFill.position.set(-8, -4, 7);
    this.reefScene.add(this.reefFill);

    // Seamless deep-water vertical gradient cyclorama (eliminates any horizon seam!)
    const backdropMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 62),
      new THREE.MeshBasicMaterial({
        map: this.backdropTex,
        fog: false,
        depthWrite: false,
      })
    );
    backdropMesh.position.set(0, 1.0, -26);
    this.reefScene.add(backdropMesh);

    // Sunlit shimmering undulating water surface canopy high overhead (no hard mid-screen edge)
    this.surfaceMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      map: this.causticTex,
      emissive: '#38bdf8',
      emissiveMap: this.causticTex,
      emissiveIntensity: 0.72,
      roughness: 0.14,
      metalness: 0.08,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const surfGeo = new THREE.PlaneGeometry(96, 26, 42, 8);
    const sPos = surfGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const sx = sPos.getX(i);
      const sy = sPos.getY(i);
      sPos.setZ(i, Math.sin(sx * 0.45) * 0.22 + Math.cos(sy * 0.55) * 0.18);
    }
    surfGeo.computeVertexNormals();
    this.surfaceMesh = new THREE.Mesh(surfGeo, this.surfaceMat);
    this.surfaceMesh.rotation.x = Math.PI * 0.5;
    this.surfaceMesh.position.set(0, 10.8, -6.5);
    this.surfaceMesh.visible = false; // Seamless cyclorama + volumetric rays handle upper shimmer without hard plane edge
    this.reefScene.add(this.surfaceMesh);

    // Soft Gaussian-feathered sunlit volumetric caustic god-ray shafts filling the upper reef!
    this.rayGroup = new THREE.Group();
    this.rayMeshes = [];
    const rayGeo = new THREE.PlaneGeometry(3.8, 18);
    for (let i = 0; i < MAX_RAYS; i++) {
      const rm = new THREE.MeshBasicMaterial({
        map: this.godRayTex,
        color: '#e0f7ff',
        transparent: true,
        opacity: 0.34,
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

    // Rippled Sunlit Coral-Sand Floor with Animated Voronoi Caustic Networks (`mg_coral_sand_albedo.webp` + `normal`)
    this.seabedMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.causticTex,
      emissive: '#38bdf8',
      emissiveMap: this.causticTex,
      emissiveIntensity: 0.32,
      roughness: 0.72,
      metalness: 0.04,
    });
    this.causticTex.repeat.set(6, 2);
    const bedGeo = new THREE.PlaneGeometry(72, 26, 64, 16);
    const bPos = bedGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const bx = bPos.getX(i);
      const by = bPos.getY(i);
      bPos.setZ(i, Math.sin(bx * 0.42) * 0.28 + Math.cos(by * 0.52 + bx * 0.24) * 0.20);
    }
    bedGeo.computeVertexNormals();
    this.seabedMesh = new THREE.Mesh(bedGeo, this.seabedMat);
    this.seabedMesh.rotation.x = -Math.PI * 0.48;
    this.seabedMesh.position.set(0, -4.2, -2.5);
    this.reefScene.add(this.seabedMesh);

    // Warm Sunlit Reef-Limestone Ridges (`arch_coral_travertine_*`) & Warm Redwood Logs (`arch_redwood_timber_*`)
    this.ridgeGroup = new THREE.Group();
    this.reefStoneTex.repeat.set(2, 2);
    this.ridgeMat = new THREE.MeshStandardMaterial({
      color: '#f5efe2',
      map: this.reefStoneTex,
      roughness: 0.68,
      metalness: 0.05,
    });
    this.barkTex.repeat.set(3, 1);
    this.logMat = new THREE.MeshStandardMaterial({
      color: '#e5a982',
      map: this.barkTex,
      roughness: 0.76,
    });
    for (let i = 0; i < 9; i++) {
      const ridgeGeo = buildCraggyReefRidgeGeo(1.75 + (i % 3) * 0.55, 4.4 + (i % 4) * 1.1, 1000 + i * 37);
      const spire = new THREE.Mesh(ridgeGeo, this.ridgeMat);
      spire.position.set((i - 4.0) * 6.8, -2.4, -9.2 - (i % 3) * 2.8);
      spire.rotation.y = (i * 0.85) % TAU;
      this.ridgeGroup.add(spire);
      if (i % 3 === 0) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 5.2, 14), this.logMat);
        log.rotation.set(0.14, 0.38, 1.42);
        log.position.set((i - 3.6) * 5.6, -3.75, -3.4);
        this.ridgeGroup.add(log);
      }
    }
    this.reefScene.add(this.ridgeGroup);

    // Swaying Multi-Frond Ribbon Kelp, 3D Staghorn Corals & Alpha-Cutout Sea-Fan / Brain Coral Gardens!
    const kelpGeo = buildRibbonKelpGeo();
    kelpGeo.scale(1.35, 1.05, 1.35);
    this.kelpMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#047857',
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.06,
    });
    this.kelpInst = new THREE.InstancedMesh(kelpGeo, this.kelpMat, MAX_KELP);
    this.kelpInst.frustumCulled = false;
    this.reefScene.add(this.kelpInst);

    const coralGeo = buildBranchingCoralGeo();
    coralGeo.scale(1.45, 1.45, 1.45);
    this.coralMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.38,
      metalness: 0.06,
    });
    this.coralInst = new THREE.InstancedMesh(coralGeo, this.coralMat, MAX_CORAL);
    this.coralInst.frustumCulled = false;
    const coralPalette = ['#fb7185', '#2dd4bf', '#fbbf24', '#e879f9', '#38bdf8', '#fb923c'];
    for (let i = 0; i < MAX_CORAL; i++) {
      this._col.set(coralPalette[i % coralPalette.length]);
      this.coralInst.setColorAt(i, this._col);
    }
    this.reefScene.add(this.coralInst);

    // Alpha-cutout Reef Sea-Fan, Brain-Coral & Fern Cards (`assets/textures/biome_foliage_coral.webp`)
    this.seaFanMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.48,
      alphaTest: 0.25,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const fanCardGeo = new THREE.PlaneGeometry(1.75, 1.75);
    fanCardGeo.translate(0, 0.82, 0);
    this.seaFanInst = new THREE.InstancedMesh(fanCardGeo, this.seaFanMat, 36);
    this.seaFanInst.frustumCulled = false;
    this.reefScene.add(this.seaFanInst);

    // Mount 1K Seamless PBR WebP Reef Textures
    loadSubWebp('assets/textures/mg_coral_sand_albedo.webp', true, 6, 2, (t) => {
      if (this._disposed) return;
      this.coralSandWebp = t;
      this.seabedMat.map = t;
      this.seabedMat.emissiveMap = t;
      this.seabedMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/mg_coral_sand_normal.webp', false, 6, 2, (t) => {
      if (this._disposed) return;
      this.seabedMat.normalMap = t;
      this.seabedMat.normalScale.set(1.15, 1.15);
      this.seabedMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_coral_travertine_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.ridgeMat.map = t;
      this.ridgeMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_coral_travertine_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.ridgeMat.normalMap = t;
      this.ridgeMat.normalScale.set(1.1, 1.1);
      this.ridgeMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/arch_redwood_timber_albedo.webp', true, 3, 1, (t) => {
      if (this._disposed) return;
      this.logMat.map = t;
      this.logMat.needsUpdate = true;
    });
    loadSubWebp('assets/textures/biome_foliage_coral.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.seaFanMat.map = t;
      this.seaFanMat.needsUpdate = true;
    });

    // Gateway Direct Free-Swimmer Rig (`CAM_Z = 10.4` + `scale = 2.08` -> heroically large & readable!)
    this.heroSwimAnchor = new THREE.Group();
    this.reefHero = new GatewayRig(this.skinId);
    this.reefHeroInner = new THREE.Group();
    this.reefHeroInner.rotation.order = 'YXZ';
    this.reefHeroInner.rotation.set(1.30, Math.PI * 0.5, 0);
    this.reefHeroInner.scale.setScalar(2.08);
    this.reefHeroInner.position.set(-1.02, -0.14, 0);
    this.reefHeroInner.add(this.reefHero.group);
    this.heroSwimAnchor.add(this.reefHeroInner);

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

    this.heroGlowLight = new THREE.PointLight('#5efce8', 1.25, 8.5);
    this.heroSwimAnchor.add(this.heroGlowLight);
    this.reefScene.add(this.heroSwimAnchor);

    // Dynamic Gameplay Pools (Fish, Ambient Shoals, Caged Sea Turtles & River Otters, Mines, Jellies, Vents, Grotto, Spire)
    this.fishGroup = new THREE.Group();
    this.cagePool = [];
    this.reefScene.add(this.fishGroup);

    const fishFallbackGeo1 = new THREE.ConeGeometry(0.22, 0.68, 8);
    fishFallbackGeo1.rotateZ(-Math.PI * 0.5);
    const fishFallbackGeo2 = new THREE.OctahedronGeometry(0.32, 1);
    fishFallbackGeo2.scale(1.4, 0.35, 1.3);
    this.fishMat1 = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.28, metalness: 0.1 });
    this.fishMat2 = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.1 });
    this.fishInst1 = new THREE.InstancedMesh(fishFallbackGeo1, this.fishMat1, MAX_FISH);
    this.fishInst2 = new THREE.InstancedMesh(fishFallbackGeo2, this.fishMat2, MAX_FISH);
    this.ambFishInst = new THREE.InstancedMesh(fishFallbackGeo1.clone(), this.fishMat1, MAX_AMB);
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

    // Translucent Bioluminescent Jellyfish
    const jellyGeo = new THREE.SphereGeometry(0.42, 14, 10, 0, TAU, 0, Math.PI * 0.62);
    this.jellyInst = new THREE.InstancedMesh(
      jellyGeo,
      new THREE.MeshStandardMaterial({
        color: '#f0abfc',
        emissive: '#c084fc',
        emissiveIntensity: 0.85,
        roughness: 0.15,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
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

    this.ventInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.32, 0.58, 0.65, 10),
      new THREE.MeshStandardMaterial({
        color: '#334155',
        emissive: '#22d3ee',
        emissiveIntensity: 0.45,
        roughness: 0.65,
      }),
      MAX_VENTS
    );
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
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.82,
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
    this.coreScene.background = new THREE.Color('#053b54');
    this.coreScene.fog = new THREE.FogExp2('#074d6c', 0.018);
    if (this.envTex) this.coreScene.environment = this.envTex;

    this.coreCam = new THREE.PerspectiveCamera(58, this.width / Math.max(1, this.height), 0.2, 140);

    const hemi = new THREE.HemisphereLight('#a5f3fc', '#164e63', 1.65);
    this.coreScene.add(hemi);

    const shaftLight = new THREE.DirectionalLight('#fffbeb', 2.45);
    shaftLight.position.set(4, 18, 8);
    this.coreScene.add(shaftLight);

    const warmRim = new THREE.DirectionalLight('#fbbf24', 1.35);
    warmRim.position.set(-6, -8, 6);
    this.coreScene.add(warmRim);

    this.coreHeroLight = new THREE.PointLight('#5efce8', 2.6, 18);
    this.coreScene.add(this.coreHeroLight);

    // Looping 360° Glass-and-Bronze Flooded Reactor Conduit Shaft (`radius = 3.45`)
    this.shaftRings = [];
    this.causticTex.repeat.set(6, 2);
    const glassWallGeo = new THREE.CylinderGeometry(3.48, 3.48, 5.8, 28, 1, true);
    const glassWallMat = new THREE.MeshStandardMaterial({
      color: '#0e7490',
      map: this.causticTex,
      emissive: '#06b6d4',
      emissiveMap: this.causticTex,
      emissiveIntensity: 0.48,
      roughness: 0.16,
      metalness: 0.18,
      side: THREE.BackSide,
    });
    const bronzeRingGeo = new THREE.TorusGeometry(3.40, 0.15, 10, 32);
    bronzeRingGeo.rotateX(Math.PI * 0.5);
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#e09f48',
      emissive: '#452306',
      emissiveIntensity: 0.28,
      roughness: 0.24,
      metalness: 0.78,
    });
    const conduitGlowGeo = new THREE.TorusGeometry(3.28, 0.05, 8, 32);
    conduitGlowGeo.rotateX(Math.PI * 0.5);
    const conduitGlowMat = new THREE.MeshBasicMaterial({ color: '#5efce8' });

    for (let i = 0; i < MAX_CORE_RINGS; i++) {
      const seg = new THREE.Group();
      seg.add(new THREE.Mesh(glassWallGeo, glassWallMat));
      seg.add(new THREE.Mesh(bronzeRingGeo, bronzeMat));
      const glow = new THREE.Mesh(conduitGlowGeo, conduitGlowMat);
      glow.position.y = 0.24;
      seg.add(glow);
      this.coreScene.add(seg);
      this.shaftRings.push(seg);
    }

    // 8 continuous vertical bronze structural ribs + glowing cyan light-channels lining the shaft
    const ribGeo = new THREE.BoxGeometry(0.20, 140, 0.24);
    const lightStripGeo = new THREE.BoxGeometry(0.06, 140, 0.08);
    const lightStripMat = new THREE.MeshBasicMaterial({ color: '#67e8f9' });
    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * TAU;
      const rib = new THREE.Mesh(ribGeo, bronzeMat);
      rib.position.set(Math.cos(ang) * 3.38, -45, Math.sin(ang) * 3.38);
      rib.rotation.y = -ang;
      this.coreScene.add(rib);
      if (r % 2 === 0) {
        const strip = new THREE.Mesh(lightStripGeo, lightStripMat);
        strip.position.set(Math.cos(ang + 0.39) * 3.36, -45, Math.sin(ang + 0.39) * 3.36);
        strip.rotation.y = -(ang + 0.39);
        this.coreScene.add(strip);
      }
    }

    // Gateway Headfirst Plunge Rig (`CoreDive` clip pitches Pelvis +1.38 rad toward +Z;
    // +0.19 rad X tilt completes the 90 deg plunge straight down -Y with dorsal scales facing camera!)
    this.coreHeroAnchor = new THREE.Group();
    this.coreHero = new GatewayRig(this.skinId);
    this.coreHeroInner = new THREE.Group();
    this.coreHeroInner.rotation.set(0.19, 0, 0);
    this.coreHeroInner.scale.setScalar(1.48);
    this.coreHeroInner.position.set(0, 0.35, -0.45);
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

    // Spinning Hydro-Turbine Rotors (`reactor_turbine`)
    this.turbineSlots = [];
    for (let i = 0; i < MAX_CORE_TURBINES; i++) {
      const g = new THREE.Group();
      // Procedural 5 evenly-spaced blade fallback (`b = 0..4`, `(b / 5) * TAU`) matching `game.js` `bladeCount: 5`
      const fb = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), bronzeMat);
      hub.rotation.x = Math.PI * 0.5;
      fb.add(hub);
      for (let b = 0; b < 5; b++) {
        const ba = (b / 5) * TAU;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.40, 0.10),
          new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.32 })
        );
        blade.position.set(Math.cos(ba) * 1.45, Math.sin(ba) * 1.45, 0);
        blade.rotation.set(0.25, 0, ba);
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

    // Rushing Bioluminescent Water Bubble Streaks + Hydro-Speed Boost Rings + Dive Pulses
    this.streakInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.065, 6, 6),
      new THREE.MeshBasicMaterial({
        color: '#a5f3fc',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_CORE_STREAKS
    );
    this.streakInst.frustumCulled = false;
    this.coreScene.add(this.streakInst);

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

  async _loadGlbProps() {
    const [fish1, fish2, mine, grotto, turtle, otter, cage, coreProps] = await Promise.all([
      loadCachedGlb('assets/models/alien_fish_1.glb'),
      loadCachedGlb('assets/models/alien_fish_2.glb'),
      loadCachedGlb('assets/models/sea_mine.glb'),
      loadCachedGlb('assets/models/warp_cavern.glb'),
      loadCachedGlb('assets/models/sea_turtle.glb'),
      loadCachedGlb('assets/models/river_otter.glb'),
      loadCachedGlb('assets/models/siphon_cage.glb'),
      loadCachedGlb('assets/models/core_reactor_props.glb'),
    ]);
    if (this._disposed) return;

    const extractFirstMesh = (scene) => {
      let found = null;
      scene?.traverse((o) => {
        if (!found && o.isMesh && o.geometry) found = o;
      });
      return found;
    };

    const m1 = extractFirstMesh(fish1);
    if (m1) {
      this.fishInst1.geometry.dispose();
      this.fishInst1.geometry = m1.geometry.clone();
      this.ambFishInst.geometry.dispose();
      this.ambFishInst.geometry = m1.geometry.clone();
      if (m1.material?.map) {
        this.fishMat1.map = m1.material.map;
        this.fishMat1.needsUpdate = true;
      }
    }

    const m2 = extractFirstMesh(fish2);
    if (m2) {
      this.fishInst2.geometry.dispose();
      this.fishInst2.geometry = m2.geometry.clone();
      if (m2.material?.map) {
        this.fishMat2.map = m2.material.map;
        this.fishMat2.needsUpdate = true;
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
    for (const slot of this.cagePool) {
      if (cage) {
        slot.cageGroup.clear();
        const cgClone = cage.clone(true);
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
    this.reefSun.color.set(pal.sun);
    this.seabedMat.color.set('#ffffff');
    this.kelpMat.color.set(pal.kelp);

    const scroll = Number(stage.scroll ?? time * 96) || 0;
    this.causticTex.offset.set((scroll * 0.0022) % 1, Math.sin(time * 0.35) * 0.08);
    if (this.coralSandWebp) {
      this.coralSandWebp.offset.set((scroll * 0.0022) % 1, Math.sin(time * 0.35) * 0.05);
    }

    const surfaceY = stage.surfaceY != null ? Math.min(stage.surfaceY, this.height * 0.14) : this.height * 0.105;
    const seabedY = stage.seabedY != null ? Math.max(stage.seabedY, this.height * 0.84) : this.height * 0.895;
    const surfW = this._screenToWorld(this.width * 0.5, surfaceY, 0);
    const bedW = this._screenToWorld(this.width * 0.5, seabedY, 0);
    this.surfaceMesh.position.y = surfW.y + 1.35;
    this.seabedMesh.position.y = bedW.y - 0.35;

    // Animate sunlit caustic god-ray shafts across the upper reef water column
    for (let i = 0; i < MAX_RAYS; i++) {
      const m = this.rayMeshes[i];
      const rx = (((i * 3.2 - scroll * 0.011) % 36) + 36) % 36 - 18;
      m.position.set(rx, surfW.y - 1.6, -2.5 - (i % 3) * 1.4);
      m.material.color.set(pal.ray);
      m.material.opacity = 0.28 + 0.12 * Math.sin(time * 1.5 + i * 1.2);
    }

    // Swaying Kelp Forest, Staghorn Corals & Sea-Fan Gardens along seabed
    const dm = this._dummy;
    for (let i = 0; i < MAX_KELP; i++) {
      const kx = (((i * 1.15 - scroll * 0.022) % 38) + 38) % 38 - 19;
      const kz = -1.4 - (i % 5) * 0.9;
      dm.position.set(kx, bedW.y - 0.30, kz);
      dm.rotation.set(0, i * 0.7, Math.sin(time * 1.8 + i * 0.6) * 0.18 - 0.08);
      dm.scale.set(0.85 + (i % 3) * 0.25, 0.65 + (i % 4) * 0.32, 0.85);
      dm.updateMatrix();
      this.kelpInst.setMatrixAt(i, dm.matrix);
    }
    this.kelpInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < MAX_CORAL; i++) {
      const cx = (((i * 1.28 - scroll * 0.022) % 40) + 40) % 40 - 20;
      const cz = -1.0 - (i % 4) * 1.05;
      dm.position.set(cx, bedW.y - 0.10, cz);
      dm.rotation.set(i * 0.2, i * 1.1, 0);
      dm.scale.set(0.85 + (i % 3) * 0.35, 0.65 + (i % 4) * 0.28, 0.85 + (i % 2) * 0.3);
      dm.updateMatrix();
      this.coralInst.setMatrixAt(i, dm.matrix);
    }
    this.coralInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < 36; i++) {
      const fx = (((i * 1.45 - scroll * 0.022) % 38) + 38) % 38 - 19;
      const fz = -1.6 - (i % 4) * 1.15;
      dm.position.set(fx, bedW.y - 0.18, fz);
      dm.rotation.set(0, Math.sin(i * 1.3) * 0.35, Math.sin(time * 1.6 + i) * 0.09);
      dm.scale.setScalar(0.85 + (i % 3) * 0.32);
      dm.updateMatrix();
      this.seaFanInst.setMatrixAt(i, dm.matrix);
    }
    this.seaFanInst.instanceMatrix.needsUpdate = true;

    // Position & Animate Gateway Swimming Directly Underwater!
    const heroSc = this._screenToWorld(sw.x ?? this.width * 0.26, sw.y ?? this.height * 0.48, 0);
    const vx = sw.vx || 0;
    const vy = sw.vy || 0;
    const pitch = clamp(Math.atan2(-vy, 280), -0.58, 0.58);
    const roll = clamp(-vy * 0.0012, -0.32, 0.32) + (sw.spin || 0);
    const swimPhase = sw.swimCycle ?? time * 8.2;

    this.heroSwimAnchor.position.set(heroSc.x, heroSc.y, 0.4);
    this.heroSwimAnchor.rotation.set(roll * 0.35, Math.sin(swimPhase) * 0.08, pitch);
    this.reefHero.update(dt, {
      time,
      vx: 2.8 + Math.max(0, vx * 0.01),
      vy: -vy * 0.01,
      facing: 1,
      onGround: false,
      isSwimming: true,
      anim: (sw.whipTimer || 0) > 0.02 ? 'TailWhip' : 'FreeSwim',
      swimPhase,
      tailWhip: sw.whipTimer || 0,
      frillFlare: 0.45 + (stage.ventBoostTimer > 0 ? 0.45 : 0),
    });

    // Expanding 3D Harmonic Echo Sonar Sphere
    const sonarP = stage.sonarPulse || 0;
    if (sonarP > 0.01) {
      const origin = this._screenToWorld(stage.sonarOriginX ?? sw.x, stage.sonarOriginY ?? sw.y, 0);
      const prog = 1 - sonarP;
      this.echoSphere.visible = true;
      this.echoSphere.position.set(origin.x, origin.y, 0);
      this.echoSphere.scale.setScalar(0.8 + prog * 8.5);
      this.echoSphere.material.opacity = sonarP * 0.45;
      this.echoSphere.rotation.y = time * 2.2;
    } else {
      this.echoSphere.visible = false;
    }

    // Update Rescued Sea Turtles & River Otters (`stage.cages`, plus graceful ambient guardians if empty)
    const cages = stage.cages || [];
    let cageVis = 0;
    if (cages.length > 0) {
      for (let i = 0; i < cages.length && cageVis < MAX_CAGES; i++) {
        const cg = cages[i];
        const slot = this.cagePool[cageVis++];
        const wp = this._screenToWorld(cg.x, cg.y, 0);
        slot.root.visible = true;
        slot.root.position.set(wp.x, wp.y, 0.1);
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
    } else {
      // Ambient companion Sea Turtle & River Otter swimming in the reef when driven by minimal state
      for (let k = 0; k < 2; k++) {
        const slot = this.cagePool[cageVis++];
        const ax = (((18 - time * (2.2 + k * 0.5) + k * 14) % 32) + 32) % 32 - 16;
        const ay = (k === 0 ? 1.4 : -1.2) + Math.sin(time * 1.8 + k * 2) * 0.55;
        slot.root.visible = true;
        slot.root.position.set(ax, ay, -1.4 - k * 0.8);
        slot.cageGroup.visible = false;
        slot.turtleGroup.visible = k === 0;
        slot.otterGroup.visible = k === 1;
        slot.turtleGroup.rotation.set(0, Math.PI, Math.sin(time * 4) * 0.1);
        slot.otterGroup.rotation.set(0, Math.PI, Math.sin(time * 5.5) * 0.14);
        if (slot.flipperL) slot.flipperL.rotation.x = Math.sin(time * 6.5) * 0.42;
        if (slot.flipperR) slot.flipperR.rotation.x = -Math.sin(time * 6.5) * 0.42;
        if (slot.otterTail) slot.otterTail.rotation.y = Math.sin(time * 8.0) * 0.35;
      }
    }
    for (let i = cageVis; i < MAX_CAGES; i++) {
      this.cagePool[i].root.visible = false;
    }

    // Update Gameplay Reef Fish, Harmonic Seed Bubbles & Iridescent Shells
    const fishList = stage.fish || [];
    let c1 = 0;
    let c2 = 0;
    let cShell = 0;
    let cSeed = 0;
    const fishTints = ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa'];

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
        const sc = f.type === 'big' ? 1.45 : f.type === 'gold' ? 1.25 : 0.82;
        dm.position.set(wp.x, wp.y, 0);
        dm.rotation.set(0, Math.PI + Math.sin(time * 9 + i) * 0.16, clamp((f.vy || 0) * 0.002, -0.35, 0.35));
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._col.set(f.type === 'gold' ? '#fde047' : fishTints[(f.color || i) % fishTints.length]);
        this.fishInst1.setColorAt(c1, this._col);
        this.fishInst1.setMatrixAt(c1++, dm.matrix);
      } else if (c2 < MAX_FISH) {
        const sc = f.type === 'big' ? 1.55 : 0.95;
        dm.position.set(wp.x, wp.y, 0);
        dm.rotation.set(Math.sin(time * 6 + i) * 0.18, Math.PI, clamp((f.vy || 0) * 0.002, -0.3, 0.3));
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._col.set(f.type === 'gold' ? '#fde047' : fishTints[(f.color || i) % fishTints.length]);
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

    // Background 96-Boid Sunlit Reef Shoal parting gracefully around Gateway
    for (let i = 0; i < MAX_AMB; i++) {
      const bx = (((i * 1.1 - time * (1.8 + (i % 4) * 0.35)) % 44) + 44) % 44 - 22;
      let by = Math.sin(i * 2.1 + time * 1.2) * 3.8;
      const bz = -3.2 - (i % 5) * 1.4;
      const dx = bx - heroSc.x;
      const dy = by - heroSc.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 6.5) {
        by += (dy >= 0 ? 1 : -1) * (1 - d2 / 6.5) * 1.2;
      }
      dm.position.set(bx, by, bz);
      dm.rotation.set(0, Math.PI + Math.sin(time * 7 + i) * 0.15, 0);
      dm.scale.setScalar(0.45 + (i % 3) * 0.12);
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
        const span = Math.max(0, wp.y - (bedW.y - 0.2));
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
      slot.root.position.set(wp.x, bedW.y - 0.08, 0.1);
      slot.topPiv.rotation.x = -(c.open || 0) * 0.95;
      slot.pearl.visible = Boolean(c.hasPearl);
    }

    const vents = stage.vents || [];
    let vCount = 0;
    for (let i = 0; i < vents.length && vCount < MAX_VENTS; i++) {
      const v = vents[i];
      const wp = this._screenToWorld(v.x, seabedY, 0);
      dm.position.set(wp.x, bedW.y - 0.05, 0);
      dm.rotation.set(0, i * 1.1, 0);
      dm.scale.setScalar(1.1);
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

    // Trailing Lizard Swim Bubbles + Ambient Plankton + Stage Particles
    let ptCount = 0;
    for (let i = 0; i < 42 && ptCount < MAX_PARTICLES; i++) {
      const age = (time * 2.4 + i * 0.17) % 1;
      const bx = heroSc.x - 0.85 - age * 3.6;
      const by = heroSc.y + Math.sin(time * 9 + i * 1.7) * (0.12 + age * 0.28) + age * 0.45;
      dm.position.set(bx, by, 0.35);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar((1 - age) * 0.85);
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#a5f3fc' : '#5efce8');
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

    // Camera subtle surge & shake
    const sh = Number(opts.shake ?? stageOrSubOrState.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 67) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 59) * sh * 0.02 : 0;
    this.reefCam.position.set(sx, sy, CAM_Z);
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

    // Loop the 18 glass-and-bronze shaft ring segments smoothly around `diveY`
    const spacing = 5.6;
    const baseIdx = Math.floor(-diveY / spacing);
    for (let i = 0; i < MAX_CORE_RINGS; i++) {
      const ringIdx = baseIdx - 3 + i;
      const seg = this.shaftRings[i];
      seg.position.set(0, -ringIdx * spacing, 0);
      seg.rotation.y = ringIdx * 0.26;
    }

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
        if (Math.abs(ty - diveY) > 48) {
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
        slot.group.visible = Math.abs(ty - diveY) < 46;
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
        slot.group.visible = Math.abs(ly - diveY) < 46;
        slot.group.position.set((lk.x || 0) * 2.15, ly, (lk.y ?? 0) * 2.15);
        slot.group.rotation.set(time * 1.4 + i, time * 2.2 + i, 0);
      } else if (i < 3) {
        const lp = 0.24 + i * 0.24;
        const ly = -lp * worldSpan;
        slot.group.visible = progress < lp + 0.02 && Math.abs(ly - diveY) < 46;
        const ang = i * 2.1 + time * 0.6;
        slot.group.position.set(Math.cos(ang) * 1.35, ly, Math.sin(ang) * 1.35);
        slot.group.rotation.set(time * 1.5, time * 2.4, 0);
      } else {
        slot.group.visible = false;
      }
    }

    // Bioluminescent Hydro-Speed Boost Rings (`cd.rings`) & Downward Hydro-Pulses (`cd.pulses`)
    const dm = this._dummy;
    const boostRings = cd.rings || cd.pickups || [];
    let brCnt = 0;
    for (let i = 0; i < boostRings.length && brCnt < 16; i++) {
      const rg = boostRings[i];
      if (rg.collected) continue;
      const rp = rg.progress ?? (rg.depth != null ? rg.depth / totalDepthMeters : (i + 1) * 0.09);
      const ry = -rp * worldSpan;
      if (Math.abs(ry - diveY) > 46) continue;
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
        this.coreScene.background.set('#085a78');
      } else {
        beam.material.opacity = 0.08;
        this.coreScene.background.set('#042f44');
      }
    } else {
      this.seedAnchorGroup.visible = false;
    }

    // Upward-Rushing Bioluminescent Dive Bubble Streaks
    for (let i = 0; i < MAX_CORE_STREAKS; i++) {
      const ang = i * 2.39996;
      const rad = 0.45 + (i % 9) * 0.32;
      const relY = (((i * 0.42 + time * 18) % 36) + 36) % 36 - 26;
      dm.position.set(Math.cos(ang) * rad, diveY + relY, Math.sin(ang) * rad);
      dm.rotation.set(0, 0, 0);
      dm.scale.set(0.8, 2.4, 0.8);
      dm.updateMatrix();
      this.streakInst.setMatrixAt(i, dm.matrix);
    }
    this.streakInst.count = MAX_CORE_STREAKS;
    this.streakInst.instanceMatrix.needsUpdate = true;

    // Exhilarating 360° Chase Camera Above Gateway Looking Down the Flooded Tube
    const boostFov = cd.boostTimer > 0 ? 66 : 58;
    if (Math.abs(this.coreCam.fov - boostFov) > 0.1) {
      this.coreCam.fov = lerp(this.coreCam.fov, boostFov, 0.15);
      this.coreCam.updateProjectionMatrix();
    }
    const sh = Number(opts.shake ?? state.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 71) * sh * 0.025 : 0;
    const sz = sh > 0.01 ? Math.cos(time * 63) * sh * 0.025 : 0;

    if (seedPlanted) {
      // Dramatic orbit pull-back as the Harmonic Water Seed erupts up the reactor shaft!
      const orbitA = time * 0.9;
      this.coreCam.position.set(Math.cos(orbitA) * 2.5, anchorY + 6.2, Math.sin(orbitA) * 2.5);
      this.coreCam.up.set(0, 1, 0);
      this.coreCam.lookAt(0, anchorY + 1.2, 0);
    } else {
      // Heroic three-quarter overhead plunge camera: shows Gateway's outstretched limbs, dorsal
      // scales & streaming tail bubbles against the curving glass-and-bronze shaft & spinning turbines!
      this.coreCam.position.set(hx * 0.52 + sx, diveY + 4.85, hz * 0.52 + 1.45 + sz);
      this.coreCam.up.set(0, 0, -1);
      this.coreCam.lookAt(hx * 0.85, diveY - 7.8, hz * 0.85 - 0.15);
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
