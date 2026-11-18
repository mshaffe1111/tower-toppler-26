// TOWERING WATERS: GATEWAY'S DESCENT — WHITEWATER RAPIDS TAIL-SURF 3D RENDERER (`src/skimmerRenderer.js`)
//
// Zero-Boat, 100% Gateway-Centric Whitewater Canyon & Reef Channel Tail-Surf Engine:
//   - Gateway carves rushing emerald-turquoise canyon river rapids & sunlit reef channels standing
//     athletically atop a living, curling bioluminescent **Hydro-Wake** (ZERO metal skimmer craft!).
//   - Banks dynamically into turns (`RapidsSurf` pose), whipping her S-curved lizard tail through the
//     crest to spray 180-particle crystalline water arcs & V-shaped whitewater foam wakes.
//   - Enclosing 3D sunlit red-rock sandstone canyon cliffs, redwood forest ridges, animated cliffside
//     waterfalls with rainbow mist halos, sculpted aqueduct boost arches (`1X..4X`), curling wave-ramps,
//     river boulders, Siphon Surge Nodes (`assets/models/sea_mine.glb`), and leaping River Otters
//     (`assets/models/river_otter.glb`).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const MAX_GATES = 12;
const MAX_RAMPS = 12;
const MAX_HAZARDS = 24;
const MAX_SEEDS = 40;
const MAX_BOLTS = 24;
const MAX_SPRAY = 180;
const MAX_GORGE_SEGS = 10;
const GORGE_SPAN_Z = 100;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const BOOST_TIER_COLORS = [
  { rim: '#38bdf8', curtain: '#5efce8' }, // 1X
  { rim: '#34d399', curtain: '#6ee7b7' }, // 2X
  { rim: '#f59e0b', curtain: '#fde047' }, // 3X
  { rim: '#e879f9', curtain: '#f5d0fe' }, // 4X
];

const BIOME_RAPIDS_THEMES = {
  canyon_river: {
    skyTop: '#1d74b8',
    skyHor: '#fde68a',
    fog: '#9dd6e8',
    sun: '#fff7ed',
    water: '#0d9488',
    waterEmissive: '#0f766e',
    cliff: '#b4533c',
    cliffCap: '#166534',
  },
  alpine_lake: {
    skyTop: '#1e64b4',
    skyHor: '#e0f2fe',
    fog: '#bae6fd',
    sun: '#ffffff',
    water: '#0284c7',
    waterEmissive: '#0369a1',
    cliff: '#64748b',
    cliffCap: '#f1f5f9',
  },
  mist_bayou: {
    skyTop: '#4338ca',
    skyHor: '#fdba74',
    fog: '#fed7aa',
    sun: '#ffedd5',
    water: '#0f766e',
    waterEmissive: '#115e59',
    cliff: '#4d5e47',
    cliffCap: '#15803d',
  },
  coral_sea: {
    skyTop: '#0284c7',
    skyHor: '#cffafe',
    fog: '#a5f3fc',
    sun: '#fffbeb',
    water: '#06b6d4',
    waterEmissive: '#0891b2',
    cliff: '#d6c3a5',
    cliffCap: '#16a34a',
  },
  storm_ocean: {
    skyTop: '#0f2942',
    skyHor: '#38bdf8',
    fog: '#1e4e68',
    sun: '#bae6fd',
    water: '#0369a1',
    waterEmissive: '#075985',
    cliff: '#334155',
    cliffCap: '#7dd3fc',
  },
};

const SKIN_PALETTES = {
  sea_glass_guardian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', glow: '#5efce8' },
  coral_reef_empress: { scale: '#fb7185', belly: '#ffe4e6', frill: '#2dd4bf', glow: '#f472b6' },
  canyon_rapids_ranger: { scale: '#0d9488', belly: '#fef3c7', frill: '#f59e0b', glow: '#38bdf8' },
  alpine_glacier_mystic: { scale: '#38bdf8', belly: '#f0f9ff', frill: '#a5f3fc', glow: '#7dd3fc' },
  bayou_biolume: { scale: '#10b981', belly: '#d1fae5', frill: '#eab308', glow: '#34d399' },
  abyssal_leviathan: { scale: '#1d4ed8', belly: '#93c5fd', frill: '#c084fc', glow: '#67e8f9' },
  solar_oasis: { scale: '#f59e0b', belly: '#fef9c3', frill: '#22d3ee', glow: '#fde047' },
  sovereign_starlight: { scale: '#eab308', belly: '#fefce8', frill: '#a855f7', glow: '#5efce8' },
  default_amphibian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', glow: '#5efce8' },
};

let _gatewayPromise = null;
function loadGatewayMod() {
  if (!_gatewayPromise) _gatewayPromise = import('./gateway.js').catch(() => null);
  return _gatewayPromise;
}

class AdaptiveSurfHero {
  constructor(skinId = 'sea_glass_guardian') {
    this.skinId = skinId;
    this.group = new THREE.Group();
    this.liveRig = new GatewayRig(skinId);
    this.fallback = this._buildFallback(skinId);
    this.group.add(this.liveRig.group);
  }

  _buildFallback(skinId) {
    const pal = SKIN_PALETTES[skinId] || SKIN_PALETTES.sea_glass_guardian;
    const root = new THREE.Group();
    const matScale = new THREE.MeshStandardMaterial({ color: pal.scale, roughness: 0.32, metalness: 0.12 });
    const matBelly = new THREE.MeshStandardMaterial({ color: pal.belly, roughness: 0.45 });
    const matFrill = new THREE.MeshStandardMaterial({
      color: pal.frill,
      emissive: pal.glow,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });

    const body = new THREE.Group();
    body.position.set(0, 0.56, 0);
    root.add(body);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.30, 8, 14), matScale);
    body.add(torso);
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.25, 6, 10), matBelly);
    belly.position.set(0, -0.01, -0.04);
    body.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), matScale);
    head.scale.set(0.9, 0.85, 1.25);
    head.position.set(0, 0.31, -0.05);
    body.add(head);

    for (const sx of [-1, 1]) {
      const frill = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), matFrill);
      frill.position.set(sx * 0.10, 0.34, 0.06);
      frill.rotation.set(0.85, 0, -sx * 0.65);
      body.add(frill);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.30, 6, 10), matScale);
      leg.position.set(sx * 0.14, -0.32, sx * 0.06);
      leg.rotation.z = sx * 0.14;
      body.add(leg);

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.24, 6, 10), matScale);
      arm.position.set(sx * 0.22, 0.08, 0);
      arm.rotation.z = sx * 0.85;
      body.add(arm);
    }

    // S-curving surf counter-balance lizard tail (+Z behind Gateway as she surfs toward -Z!)
    const tailSegs = [];
    let p = body;
    for (let i = 0; i < 6; i++) {
      const piv = new THREE.Group();
      piv.position.set(0, i === 0 ? -0.14 : 0, i === 0 ? 0.08 : 0.16);
      const seg = new THREE.Mesh(
        new THREE.CapsuleGeometry(lerp(0.085, 0.018, i / 5), 0.13, 6, 10),
        i >= 4 ? matFrill : matScale
      );
      seg.rotation.x = Math.PI * 0.5;
      seg.position.z = 0.075;
      piv.add(seg);
      p.add(piv);
      p = piv;
      tailSegs.push(piv);
    }

    return { root, body, tailSegs, mats: { matScale, matBelly, matFrill } };
  }

  setSkin(skinId) {
    this.skinId = skinId || 'sea_glass_guardian';
    this.liveRig?.setSkin?.(this.skinId);
    const pal = SKIN_PALETTES[this.skinId] || SKIN_PALETTES.sea_glass_guardian;
    this.fallback.mats.matScale.color.set(pal.scale);
    this.fallback.mats.matBelly.color.set(pal.belly);
    this.fallback.mats.matFrill.color.set(pal.frill);
    this.fallback.mats.matFrill.emissive.set(pal.glow);
  }

  update(dt, pose = {}) {
    if (this.liveRig?.update) {
      try {
        // Orient GatewayRig (+Z forward) toward -Z river course
        this.liveRig.group.rotation.y = Math.PI + (pose.surfBank || 0) * 0.25;
        this.liveRig.update(dt, pose);
        return;
      } catch {
        // Fallback
      }
    }
    const t = pose.time || 0;
    const bank = pose.surfBank || 0;
    this.fallback.body.rotation.z = -bank * 0.35;
    this.fallback.body.rotation.y = bank * 0.22;
    for (let i = 0; i < this.fallback.tailSegs.length; i++) {
      this.fallback.tailSegs[i].rotation.y = Math.sin(t * 9.5 - i * 0.65) * 0.28 - bank * 0.18;
      this.fallback.tailSegs[i].rotation.x = -0.06 + Math.cos(t * 7 - i * 0.5) * 0.05;
    }
  }

  dispose() {
    this._disposed = true;
    this.liveRig?.dispose?.();
  }
}

function hash2DRapids(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) ^ 0x27d4eb2f;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noiseTileRapids(u, v, period) {
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
  return lerp(
    lerp(hash2DRapids(ix0, iy0), hash2DRapids(ix1, iy0), sx),
    lerp(hash2DRapids(ix0, iy1), hash2DRapids(ix1, iy1), sx),
    sy
  );
}

function createSandstoneStrataTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([196, 108, 76, 255]);
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

  // Domain-warped Zion Navajo Sandstone FBM (zero straight plaid lines, natural wavy bedding!)
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wU = u + (noiseTileRapids(u, v, 4) - 0.5) * 0.28;
      const wV = v + (noiseTileRapids(u + 0.41, v + 0.17, 4) - 0.5) * 0.18;
      const grain =
        noiseTileRapids(wU, wV, 8) * 0.50 +
        noiseTileRapids(wU, wV, 18) * 0.32 +
        noiseTileRapids(u, v, 36) * 0.18;
      const bedding = 0.5 + 0.5 * Math.sin((wV * 5.0 + grain * 0.65) * TAU);
      const tBand = clamp(grain * 0.62 + bedding * 0.38, 0, 1);

      let r = lerp(142, 232, tBand);
      let g = lerp(68, 146, tBand);
      let b = lerp(46, 98, tBand);

      // Subtle wet river-moss near bottom edge of UV
      if (v > 0.82) {
        const moss = ((v - 0.82) / 0.18) * noiseTileRapids(u, v, 10);
        r = lerp(r, 42, moss * 0.55);
        g = lerp(g, 96, moss * 0.55);
        b = lerp(b, 58, moss * 0.55);
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

function createFeatheredWaterfallTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([235, 250, 255, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
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
    const vFade = Math.sin(Math.min(1, v * 5.0) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - v) * 3.5) * Math.PI * 0.5);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127) * 2 - 1;
      const edgeFade = Math.exp(-u * u * 3.8);
      const streak = 0.62 + 0.38 * Math.sin(u * 19.0 + Math.sin(v * 22.0) * 1.4);
      const foam = 0.75 + 0.25 * Math.cos(v * 34.0 + u * 7.0);
      const a = clamp(vFade * edgeFade * streak * foam, 0, 1);
      const p = (y * 128 + x) * 4;
      data[p] = 228;
      data[p + 1] = 250;
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 245);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHorizonSkyTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([56, 189, 248, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#1d63b8');
  g.addColorStop(0.42, '#38bdf8');
  g.addColorStop(0.76, '#bae6fd');
  g.addColorStop(0.92, '#fef3c7');
  g.addColorStop(1.0, '#fde68a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSteppedCliffGeo(seed = 1) {
  const geo = new THREE.CylinderGeometry(3.4, 5.2, 13.5, 10, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + 6.75) / 13.5;
    // Terraced sedimentary cliff ledges + irregular craggy facets
    const terrace = 1.0 - yn * 0.22 + 0.14 * Math.sin(yn * 16.0 + seed) + 0.09 * Math.cos(Math.atan2(z, x) * 4 + seed);
    x *= terrace;
    z *= terrace * 1.15;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildRapidsEnvMap(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const s = new THREE.Scene();
    s.background = new THREE.Color('#7dd3fc');
    const sunPatch = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fffbeb', side: THREE.BackSide })
    );
    sunPatch.position.set(10, 14, -12);
    s.add(sunPatch);
    const riverBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: '#14b8a6', side: THREE.DoubleSide })
    );
    riverBounce.rotation.x = -Math.PI * 0.5;
    riverBounce.position.y = -4;
    s.add(riverBounce);
    const rt = pmrem.fromScene(s, 0.04);
    pmrem.dispose();
    return rt.texture;
  } catch {
    return null;
  }
}

function createRapidsFoamTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([30, 180, 195, 255]);
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
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(0, 0, size, size);

  // Whitewater rapids streaks & turquoise currents
  for (let i = 0; i < 120; i++) {
    const x = ((i * 53) % size);
    const y = ((i * 97) % size);
    const w = 6 + (i % 14);
    const h = 28 + (i % 46);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(224, 242, 254, 0)');
    g.addColorStop(0.5, i % 3 === 0 ? 'rgba(240, 253, 250, 0.55)' : 'rgba(94, 252, 232, 0.32)');
    g.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    if (y + h > size) ctx.fillRect(x, y - size, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SkimmerRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.dpr = opts.dpr || 1;
    this.skinId = opts.skinId || 'sea_glass_guardian';
    this.blasterFxId = opts.blasterFxId || 'standard_cryo';
    this.envMap = opts.envMap || null;
    this._disposed = false;
    this._lastTime = 0;

    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this.rapidsTex = createRapidsFoamTexture(256);
    this.rapidsTex.repeat.set(3, 14);
    this.sandstoneTex = createSandstoneStrataTexture(256);
    this.sandstoneTex.repeat.set(2, 2);
    this.waterfallTex = createFeatheredWaterfallTexture();
    this.skyBackdropTex = createHorizonSkyTexture();
    this.ownEnvMap = this.envMap ? null : buildRapidsEnvMap(webgl);
    if (!this.envMap && this.ownEnvMap) this.envMap = this.ownEnvMap;

    this._initScene();
    this._loadGlbs();
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.surfHero?.setSkin(skinId);
  }

  setBlasterFx(fxId) {
    this.blasterFxId = fxId || 'standard_cryo';
  }

  prewarm() {
    try {
      this.webgl?.compile?.(this.scene, this.camera);
    } catch {
      // Ignore
    }
  }

  resize(width, height, dpr = this.dpr) {
    this.width = Math.max(1, width || 390);
    this.height = Math.max(1, height || 620);
    this.dpr = dpr;
    if (this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#38bdf8');
    this.scene.fog = new THREE.Fog('#bae6fd', 28, 108);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.55;
    }

    this.camera = new THREE.PerspectiveCamera(56, this.width / Math.max(1, this.height), 0.2, 180);

    // Radiant Golden Morning Sun + Turquoise River Bounce Lighting
    this.hemiLight = new THREE.HemisphereLight('#e0f2fe', '#0d9488', 1.15);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff7ed', 2.45);
    this.sunLight.position.set(14, 24, -18);
    this.scene.add(this.sunLight);

    this.wakeLight = new THREE.PointLight('#5efce8', 1.6, 9);
    this.scene.add(this.wakeLight);

    // Sunlit Atmospheric Horizon Backdrop + Golden Sun Disc & Distant Canyon Mesa Silhouettes
    const skyBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 75),
      new THREE.MeshBasicMaterial({ map: this.skyBackdropTex, fog: false, depthWrite: false })
    );
    skyBackdrop.position.set(0, 22, -102);
    this.scene.add(skyBackdrop);

    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(6.2, 28),
      new THREE.MeshBasicMaterial({ color: '#fffbeb', fog: false })
    );
    sunDisc.position.set(8, 20, -98);
    this.scene.add(sunDisc);

    // Rushing Whitewater Canyon River Surface
    const riverGeo = new THREE.PlaneGeometry(30, 130, 36, 64);
    riverGeo.rotateX(-Math.PI * 0.5);
    this.riverGeo = riverGeo;
    this._riverBaseY = new Float32Array(riverGeo.attributes.position.count);
    this.riverMat = new THREE.MeshStandardMaterial({
      color: '#14b8a6',
      map: this.rapidsTex,
      bumpMap: this.rapidsTex,
      bumpScale: 0.14,
      emissive: '#0d9488',
      emissiveIntensity: 0.30,
      roughness: 0.12,
      metalness: 0.22,
    });
    this.riverMesh = new THREE.Mesh(riverGeo, this.riverMat);
    this.riverMesh.position.set(0, 0, -42);
    this.scene.add(this.riverMesh);

    // Enclosing 3D Stratified Sandstone Canyon Gorge Walls, Clustered Pines & Feathered Waterfalls
    this.gorgeSegments = [];
    this.cliffMat = new THREE.MeshStandardMaterial({
      color: '#d98a6c',
      map: this.sandstoneTex,
      bumpMap: this.sandstoneTex,
      bumpScale: 0.28,
      roughness: 0.80,
      metalness: 0.04,
    });
    this.foliageMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.68 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c3317', roughness: 0.85 });
    this.waterfallMat = new THREE.MeshBasicMaterial({
      map: this.waterfallTex,
      color: '#f0fdfa',
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mistRingGeo = new THREE.CircleGeometry(2.1, 18);
    mistRingGeo.rotateX(-Math.PI * 0.5);
    const mistRingMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    for (let i = 0; i < MAX_GORGE_SEGS; i++) {
      const seg = new THREE.Group();
      for (const side of [-1, 1]) {
        const cliffGeo = buildSteppedCliffGeo(i * 19 + (side > 0 ? 7 : 0));
        const cliff = new THREE.Mesh(cliffGeo, this.cliffMat);
        cliff.scale.set(1.15, 1.0 + (i % 3) * 0.18, 1.18);
        cliff.position.set(side * (11.2 + (i % 2) * 0.85), 5.6, 0);
        cliff.rotation.y = i * 0.65 + (side > 0 ? 1.2 : 0);
        seg.add(cliff);

        // Wet river-bank sandstone shelf ledge
        const bankShelf = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 1), this.cliffMat);
        bankShelf.scale.set(1.2, 0.55, 1.6);
        bankShelf.position.set(side * (7.3 + (i % 2) * 0.5), 0.45, 1.2);
        seg.add(bankShelf);

        // Multi-cluster organic redwood/pine canopy crowning canyon rims
        const tx = side * 9.8;
        const ty = 11.4 + (i % 3) * 0.9;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.30, 2.2, 7), trunkMat);
        trunk.position.set(tx, ty, 0.5);
        seg.add(trunk);
        for (let c = 0; c < 3; c++) {
          const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35 - c * 0.22, 1), this.foliageMat);
          puff.scale.set(1.15, 0.85, 1.15);
          puff.position.set(tx + (c - 1) * 0.38, ty + 1.3 + c * 0.85, 0.5 + (c % 2) * 0.25);
          seg.add(puff);
        }

        // Alpha-feathered Cliffside Waterfall + Plunge-Pool Foam Ring (zero hard box quads!)
        if ((i + (side > 0 ? 1 : 0)) % 3 === 0) {
          const falls = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 11.2), this.waterfallMat);
          falls.position.set(side * 7.6, 5.2, 0);
          falls.rotation.y = -side * 0.48;
          const plungeFoam = new THREE.Mesh(mistRingGeo, mistRingMat);
          plungeFoam.position.set(side * 6.9, 0.14, 0);
          seg.add(falls, plungeFoam);
        }
      }
      this.scene.add(seg);
      this.gorgeSegments.push(seg);
    }

    // Gateway + Living Bioluminescent Hydro-Wake Crest (ZERO METAL BOAT!)
    this.heroRoot = new THREE.Group();

    // Sculpted Curling Translucent Turquoise Wave-Crest & Feathered Whitewater Wake Ribbons
    this.hydroWakeGroup = new THREE.Group();
    const curlGeo = new THREE.PlaneGeometry(1.75, 2.35, 18, 18);
    curlGeo.rotateX(-Math.PI * 0.5);
    const cPos = curlGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const cx = cPos.getX(i);
      const cz = cPos.getZ(i);
      const u = Math.abs(cx) / 0.875;
      const v = (cz + 1.175) / 2.35; // 0 = bow (-Z), 1 = stern (+Z)
      const bowTaper = 0.28 + 0.72 * Math.pow(v, 0.65);
      const nx = cx * bowTaper;
      // Curling wave swell rising under Gateway's feet and flaring into twin stern wakes!
      const swell = Math.sin(v * Math.PI) * (1 - u * u * 0.65) * 0.24 + Math.pow(u, 1.8) * v * 0.18;
      cPos.setXYZ(i, nx, swell, cz);
    }
    curlGeo.computeVertexNormals();
    const wakeCrestMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      map: this.rapidsTex,
      emissive: '#06b6d4',
      emissiveIntensity: 0.62,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
    });
    const wakeCrest = new THREE.Mesh(curlGeo, wakeCrestMat);
    wakeCrest.position.set(0, 0.04, 0.42);
    this.hydroWakeGroup.add(wakeCrest);

    // Feathered V-wake whitewater spray ribbons (alpha-textured, zero hard rectangle edges!)
    const vWingMat = new THREE.MeshBasicMaterial({
      map: this.waterfallTex,
      color: '#f0fdfa',
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 3.2), vWingMat);
      wing.rotation.x = -Math.PI * 0.47;
      wing.rotation.z = sx * 0.36;
      wing.position.set(sx * 0.62, 0.07, 1.38);
      this.hydroWakeGroup.add(wing);
    }
    this.heroRoot.add(this.hydroWakeGroup);

    this.surfHero = new AdaptiveSurfHero(this.skinId);
    this.surfHero.group.scale.setScalar(1.48);
    this.surfHero.group.position.set(0, 0.14, 0);
    this.heroRoot.add(this.surfHero.group);
    this.scene.add(this.heroRoot);

    // Aqueduct Boost Gates (`1X..4X`), Wave Ramps, River Hazards, Harmonic Seeds & Hydro-Bolts
    this.gateSlots = [];
    const gateStoneMat = new THREE.MeshStandardMaterial({ color: '#c8bea8', roughness: 0.55 });
    for (let i = 0; i < MAX_GATES; i++) {
      const g = new THREE.Group();
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.16, 10, 24, Math.PI), gateStoneMat);
      const curtain = new THREE.Mesh(
        new THREE.CircleGeometry(1.36, 20, 0, Math.PI),
        new THREE.MeshBasicMaterial({
          color: '#5efce8',
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      g.add(arch, curtain);
      g.userData = { arch, curtain };
      g.visible = false;
      this.scene.add(g);
      this.gateSlots.push(g);
    }

    // Curling Translucent Whitewater Surge Ramps
    const rampGeo = new THREE.BoxGeometry(1.85, 0.55, 2.4);
    const rampMat = new THREE.MeshStandardMaterial({
      color: '#7dd3fc',
      emissive: '#38bdf8',
      emissiveIntensity: 0.45,
      roughness: 0.12,
      transparent: true,
      opacity: 0.84,
    });
    this.rampInst = new THREE.InstancedMesh(rampGeo, rampMat, MAX_RAMPS);
    this.rampInst.frustumCulled = false;
    this.scene.add(this.rampInst);

    // Hazards (Wet Textured River Boulders, Driftwood/Siphon Crates, Siphon Surge Mines)
    const boulderGeo = new THREE.DodecahedronGeometry(0.72, 1);
    boulderGeo.scale(1.18, 0.78, 1.05);
    this.boulderInst = new THREE.InstancedMesh(
      boulderGeo,
      new THREE.MeshStandardMaterial({
        color: '#8c7a6b',
        map: this.sandstoneTex,
        bumpMap: this.sandstoneTex,
        bumpScale: 0.18,
        roughness: 0.38,
        metalness: 0.08,
      }),
      MAX_HAZARDS
    );
    this.crateInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.95, 0.85, 0.95),
      new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.65, metalness: 0.25 }),
      MAX_HAZARDS
    );
    this.mineGeo = new THREE.IcosahedronGeometry(0.62, 1);
    this.mineMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      emissive: '#f97316',
      emissiveIntensity: 0.5,
      metalness: 0.82,
      roughness: 0.32,
    });
    this.mineInst = new THREE.InstancedMesh(this.mineGeo, this.mineMat, MAX_HAZARDS);
    for (const im of [this.boulderInst, this.crateInst, this.mineInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Harmonic Water Seeds & Hydro-Pulse Bolts
    this.seedInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.5,
      }),
      MAX_SEEDS
    );
    this.boltInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#38bdf8',
        emissiveIntensity: 1.5,
        roughness: 0.1,
      }),
      MAX_BOLTS
    );
    this.sprayInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({
        color: '#f0fdfa',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_SPRAY
    );
    for (const im of [this.seedInst, this.boltInst, this.sprayInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Playful River Otter Escort leaping beside Gateway!
    this.otterEscort = new THREE.Group();
    this.otterEscort.visible = false;
    this.scene.add(this.otterEscort);
  }

  _loadGlbs() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    try {
      const loader = new GLTFLoader();
      loader.load(
        'assets/models/sea_mine.glb',
        (gltf) => {
          if (this._disposed || !gltf?.scene) return;
          let found = null;
          gltf.scene.traverse((o) => {
            if (!found && o.isMesh && o.geometry) found = o;
          });
          if (found) {
            this.mineInst.geometry.dispose();
            const g = found.geometry.clone();
            g.scale(0.68, 0.68, 0.68);
            this.mineInst.geometry = g;
          }
        },
        undefined,
        () => {}
      );
      loader.load(
        'assets/models/river_otter.glb',
        (gltf) => {
          if (this._disposed || !gltf?.scene) return;
          const cl = gltf.scene.clone(true);
          cl.rotation.y = Math.PI * 0.5;
          cl.scale.setScalar(0.95);
          this.otterEscort.add(cl);
          this.otterEscort.visible = true;
        },
        undefined,
        () => {}
      );
    } catch {
      // Ignore offline fallback
    }
  }

  render(state, opts = {}) {
    if (this._disposed || !this.webgl || !state) return;
    const sk = state.rapidsSurf || state.rapids || state.skimmer;
    if (!sk) return;

    const time = Number(state.time ?? sk.timer) || 0;
    const dt = clamp(time - this._lastTime || 0.016, 0.001, 0.05);
    this._lastTime = time;

    const skin = state.gateway?.skinId || state.player?.skinId || state.skinId || this.skinId;
    if (skin && skin !== this.skinId) this.setSkin(skin);

    const rawTheme = sk.biome || state.tower?.theme || 'canyon_river';
    const bKey = String(rawTheme).includes('coral')
      ? 'coral_sea'
      : String(rawTheme).includes('alpine') || String(rawTheme).includes('lake')
      ? 'alpine_lake'
      : String(rawTheme).includes('bayou')
      ? 'mist_bayou'
      : String(rawTheme).includes('storm') || String(rawTheme).includes('ocean')
      ? 'storm_ocean'
      : 'canyon_river';
    const th = BIOME_RAPIDS_THEMES[bKey] || BIOME_RAPIDS_THEMES.canyon_river;

    this.scene.background.set(th.skyTop);
    this.scene.fog.color.set(th.fog);
    this.sunLight.color.set(th.sun);
    this.riverMat.color.set(th.water);
    this.riverMat.emissive.set(th.waterEmissive);
    this.cliffMat.color.set(th.cliff);
    this.foliageMat.color.set(th.cliffCap);

    const dist = Number(sk.distance) || time * 18;
    const boostMult = Math.max(1, Number(sk.boostMult) || 1);
    this.rapidsTex.offset.set(Math.sin(time * 0.5) * 0.04, -(dist * 0.065) % 1);
    this.waterfallTex.offset.set(0, -(time * 1.45) % 1);

    // Animate 3D Standing Whitewater Swells on River Mesh
    const rPos = this.riverGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i);
      const rz = rPos.getZ(i);
      const wave =
        Math.sin((rz - dist) * 0.45 + rx * 0.5) * 0.11 +
        Math.cos((rz - dist) * 0.9 - rx * 0.8 + time * 4.0) * 0.06;
      rPos.setY(i, wave);
    }
    rPos.needsUpdate = true;

    // Loop Canyon Gorge Cliffs, Redwoods & Waterfalls seamlessly
    const gorgeStep = GORGE_SPAN_Z / MAX_GORGE_SEGS;
    for (let i = 0; i < MAX_GORGE_SEGS; i++) {
      const seg = this.gorgeSegments[i];
      const wrappedZ = (((i * gorgeStep + dist) % GORGE_SPAN_Z) + GORGE_SPAN_Z) % GORGE_SPAN_Z;
      seg.position.z = 8 - wrappedZ;
    }

    // Update Gateway Tail-Surfing on her Living Hydro-Wake!
    const laneX = Number(sk.laneX) || 0;
    const heroY = Math.max(0, Number(sk.y) || 0) + Math.sin(time * 8.5) * 0.04;
    const bank = clamp((Number(sk.vx) || 0) / 9.0, -1, 1);

    this.heroRoot.position.set(laneX, heroY, 0);
    this.heroRoot.rotation.set(clamp((sk.vy || 0) * 0.04, -0.28, 0.35), -bank * 0.18, -bank * 0.28);
    this.hydroWakeGroup.visible = heroY < 0.35;
    this.hydroWakeGroup.scale.set(1 + Math.abs(bank) * 0.2, 1, 1 + (boostMult - 1) * 0.16);
    this.wakeLight.position.set(laneX, heroY + 0.9, 0.8);

    this.surfHero.update(dt, {
      time,
      vx: sk.vx || 0,
      vy: sk.vy || 0,
      onGround: Boolean(sk.onWater),
      anim: !sk.onWater ? 'AirRise' : 'RapidsSurf',
      surfBank: bank,
      frillFlare: 0.35 + (boostMult - 1) * 0.2,
    });

    // Playful River Otter leaping along the starboard whitewater channel!
    if (this.otterEscort.visible) {
      const leapPhase = (time * 1.9) % TAU;
      const oy = Math.max(-0.25, Math.sin(leapPhase) * 0.85);
      this.otterEscort.position.set(4.1 + Math.sin(time * 0.7) * 0.35, oy, -4.5 + Math.cos(time * 0.9) * 1.2);
      this.otterEscort.rotation.x = Math.cos(leapPhase) * 0.45;
    }

    // Boost Gates
    const gates = sk.gates || [];
    const tierCol = BOOST_TIER_COLORS[Math.min(3, boostMult - 1)];
    for (let i = 0; i < MAX_GATES; i++) {
      const g = this.gateSlots[i];
      if (i >= gates.length || gates[i].hit) {
        g.visible = false;
        continue;
      }
      const gt = gates[i];
      const wz = -(gt.z - dist);
      if (wz > 6 || wz < -95) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      g.position.set(gt.laneX || 0, 0.05, wz);
      g.userData.curtain.material.color.set(tierCol.curtain);
    }

    // Wave Ramps
    const dm = this._dummy;
    const ramps = sk.ramps || [];
    let rCount = 0;
    for (let i = 0; i < ramps.length && rCount < MAX_RAMPS; i++) {
      const rp = ramps[i];
      const wz = -(rp.z - dist);
      if (wz > 6 || wz < -95) continue;
      dm.position.set(rp.laneX || 0, 0.18, wz);
      dm.rotation.set(0.32, 0, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.rampInst.setMatrixAt(rCount++, dm.matrix);
    }
    this.rampInst.count = rCount;
    if (rCount > 0) this.rampInst.instanceMatrix.needsUpdate = true;

    // Hazards (Boulders, Crates, Siphon Surge Mines)
    const hazards = sk.hazards || [];
    let bCnt = 0;
    let cCnt = 0;
    let mCnt = 0;
    for (let i = 0; i < hazards.length; i++) {
      const hz = hazards[i];
      const wz = -(hz.z - dist);
      if (wz > 6 || wz < -95) continue;
      dm.position.set(hz.laneX || 0, 0.35 + Math.sin(time * 3 + i) * 0.06, wz);
      dm.rotation.set(0, time * 0.5 + i, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      if (hz.type === 'mine' && mCnt < MAX_HAZARDS) {
        this.mineInst.setMatrixAt(mCnt++, dm.matrix);
      } else if (hz.type === 'crate' && cCnt < MAX_HAZARDS) {
        this.crateInst.setMatrixAt(cCnt++, dm.matrix);
      } else if (bCnt < MAX_HAZARDS) {
        this.boulderInst.setMatrixAt(bCnt++, dm.matrix);
      }
    }
    this.boulderInst.count = bCnt;
    this.crateInst.count = cCnt;
    this.mineInst.count = mCnt;
    if (bCnt > 0) this.boulderInst.instanceMatrix.needsUpdate = true;
    if (cCnt > 0) this.crateInst.instanceMatrix.needsUpdate = true;
    if (mCnt > 0) this.mineInst.instanceMatrix.needsUpdate = true;

    // Harmonic Water Seeds (`sk.gears`) & Hydro-Pulse Bolts (`sk.bolts`)
    const seeds = sk.gears || [];
    let sCnt = 0;
    for (let i = 0; i < seeds.length && sCnt < MAX_SEEDS; i++) {
      const g = seeds[i];
      if (g.collected) continue;
      const wz = -(g.z - dist);
      if (wz > 6 || wz < -95) continue;
      dm.position.set(g.laneX || 0, (g.y ?? 0.45) + Math.sin(time * 4 + i) * 0.08, wz);
      dm.rotation.set(0, time * 3.2 + i, 0.35);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.seedInst.setMatrixAt(sCnt++, dm.matrix);
    }
    this.seedInst.count = sCnt;
    if (sCnt > 0) this.seedInst.instanceMatrix.needsUpdate = true;

    const bolts = sk.bolts || [];
    let bltCnt = 0;
    for (let i = 0; i < bolts.length && bltCnt < MAX_BOLTS; i++) {
      const b = bolts[i];
      const wz = -(b.z - dist);
      if (wz > 6 || wz < -95) continue;
      dm.position.set(b.laneX || 0, 0.55, wz);
      dm.rotation.set(time * 8, time * 10, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.boltInst.setMatrixAt(bltCnt++, dm.matrix);
    }
    this.boltInst.count = bltCnt;
    if (bltCnt > 0) this.boltInst.instanceMatrix.needsUpdate = true;

    // Crystalline Tail-Spray Water Arcs behind Gateway!
    let spCnt = 0;
    for (let i = 0; i < MAX_SPRAY; i++) {
      const age = ((time * (2.6 + boostMult * 0.4) + i * 0.053) % 1);
      const side = i % 2 === 0 ? -1 : 1;
      const arcSpread = (side * (0.45 + Math.abs(bank) * 0.65) - bank * 0.55) * age * 2.4;
      const sy = heroY + 0.15 + Math.sin(age * Math.PI) * (0.55 + Math.abs(bank) * 0.45);
      const sz = 0.55 + age * 4.8;
      dm.position.set(laneX + arcSpread, sy, sz);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar((1 - age * 0.75) * (heroY < 0.4 ? 1.15 : 0.45));
      dm.updateMatrix();
      this.sprayInst.setMatrixAt(spCnt++, dm.matrix);
    }
    this.sprayInst.count = spCnt;
    this.sprayInst.instanceMatrix.needsUpdate = true;

    // Dynamic Heroic Chase Camera: frames Gateway + curling Hydro-Wake + S-curved tail clearly in lower-center!
    const aspect = this.width / Math.max(1, this.height);
    const wantFov = (aspect < 0.85 ? 60 : 50) + (boostMult - 1) * 2.8;
    if (Math.abs(this.camera.fov - wantFov) > 0.1) {
      this.camera.fov = lerp(this.camera.fov, wantFov, 0.12);
      this.camera.updateProjectionMatrix();
    }
    const sh = Number(state.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 69) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 57) * sh * 0.02 : 0;
    const camZ = aspect < 0.85 ? 5.3 : 4.45;
    const camY = (aspect < 0.85 ? 2.55 : 2.15) + heroY * 0.42;
    this.camera.position.set(laneX * 0.62 + sx, camY + sy, camZ);
    this.camera.lookAt(laneX * 0.86, 0.98 + heroY * 0.35, -4.6);

    if (opts.postfx) {
      opts.postfx.render(this.scene, this.camera, { biome: bKey });
    } else {
      this.webgl.setRenderTarget(null);
      this.webgl.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.surfHero?.dispose();
    this.rapidsTex?.dispose();
    this.sandstoneTex?.dispose();
    this.waterfallTex?.dispose();
    this.skyBackdropTex?.dispose();
    this.ownEnvMap?.dispose();
  }
}

export { SkimmerRenderer as RapidsSurfRenderer };
export default SkimmerRenderer;
