// TOWERING WATERS: GATEWAY'S DESCENT — CANYON UPDRAFT FRILL-GLIDE 3D RENDERER (`src/glideRenderer.js`)
//
// Zero-Hang-Glider, 100% Gateway-Centric Aerial Frill-Glide Engine:
//   - Gateway launches off the Spire's summit crown and soars directly on her flared, iridescent
//     webbed neck & rib frills (`FrillGlide` pose — ZERO metal/canvas hang-glider frames!), with
//     twin translucent bioluminescent **Water-Wing Ribbons** streaming from her frills and S-curved
//     lizard tail!
//   - Breathtaking 5-Biome Daylight / Alpenglow / Sunset / Lagoon / Aurora skies, multi-layered 3D
//     red-rock canyon gorges & snow peaks, animated waterfalls crowned by **Prismatic Rainbow Mist
//     Arcs**, Golden Thermal Updraft Rings, shimmering Water-Dew streams, soaring canyon swallows,
//     and sunlit rushing waters below.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 50;
const CAM_Z = 16;

const MAX_DEW = 80;
const MAX_GATES = 10;
const MAX_THERMALS = 8;
const MAX_CLOUDS = 10;
const MAX_BIRDS = 64;
const MAX_CANYON_PILLARS = 14;
const MAX_RAINBOWS = 4;
const MAX_RINGS = 24;
const MAX_PARTICLES = 280;
const MAX_POPUPS = 16;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const GLIDE_BIOME_PALETTES = {
  canyon_river: {
    skyTop: '#1d70b8',
    skyHor: '#fde68a',
    fog: '#bae6fd',
    sun: '#fffbeb',
    cliff: '#b4533c',
    cliffFar: '#d97757',
    cap: '#15803d',
    water: '#0d9488',
    thermal: '#fde047',
  },
  alpine_lake: {
    skyTop: '#1e5aa8',
    skyHor: '#fbcfe8',
    fog: '#dbeafe',
    sun: '#fff1f2',
    cliff: '#64748b',
    cliffFar: '#94a3b8',
    cap: '#f8fafc',
    water: '#0284c7',
    thermal: '#7dd3fc',
  },
  mist_bayou: {
    skyTop: '#4c1d95',
    skyHor: '#fb923c',
    fog: '#fed7aa',
    sun: '#ffedd5',
    cliff: '#3f5242',
    cliffFar: '#6b7280',
    cap: '#166534',
    water: '#0f766e',
    thermal: '#34d399',
  },
  coral_sea: {
    skyTop: '#0284c7',
    skyHor: '#cffafe',
    fog: '#a5f3fc',
    sun: '#ffffff',
    cliff: '#d6c39c',
    cliffFar: '#7dd3fc',
    cap: '#16a34a',
    water: '#06b6d4',
    thermal: '#fde047',
  },
  storm_ocean: {
    skyTop: '#0f2942',
    skyHor: '#2dd4bf',
    fog: '#164e63',
    sun: '#a5f3fc',
    cliff: '#334155',
    cliffFar: '#1e3a5f',
    cap: '#bae6fd',
    water: '#0369a1',
    thermal: '#5efce8',
  },
};

const SKIN_PALETTES = {
  sea_glass_guardian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', ribbon: '#5efce8' },
  coral_reef_empress: { scale: '#fb7185', belly: '#ffe4e6', frill: '#2dd4bf', ribbon: '#f472b6' },
  canyon_rapids_ranger: { scale: '#0d9488', belly: '#fef3c7', frill: '#f59e0b', ribbon: '#fde047' },
  alpine_glacier_mystic: { scale: '#38bdf8', belly: '#f0f9ff', frill: '#a5f3fc', ribbon: '#bae6fd' },
  bayou_biolume: { scale: '#10b981', belly: '#d1fae5', frill: '#eab308', ribbon: '#6ee7b7' },
  abyssal_leviathan: { scale: '#1d4ed8', belly: '#93c5fd', frill: '#c084fc', ribbon: '#67e8f9' },
  solar_oasis: { scale: '#f59e0b', belly: '#fef9c3', frill: '#22d3ee', ribbon: '#fde047' },
  sovereign_starlight: { scale: '#eab308', belly: '#fefce8', frill: '#a855f7', ribbon: '#f5d0fe' },
  default_amphibian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', ribbon: '#5efce8' },
};

let _gatewayModPromise = null;
function loadGatewayMod() {
  if (!_gatewayModPromise) _gatewayModPromise = import('./gateway.js').catch(() => null);
  return _gatewayModPromise;
}

/**
 * Gateway Frill-Glider Rig:
 * Displays `GatewayRig` from `./gateway.js` (with instant sculpted Hydro-Lizard fallback)
 * PLUS expansive, iridescent webbed lizard neck/rib frill membranes & streaming bioluminescent
 * Water-Wing Ribbons — ZERO metal or canvas hang-glider contraptions!
 */
class AdaptiveFrillGliderHero {
  constructor(skinId = 'sea_glass_guardian') {
    this.skinId = skinId;
    this.group = new THREE.Group();
    this.liveRig = null;

    const pal = SKIN_PALETTES[skinId] || SKIN_PALETTES.sea_glass_guardian;
    this.frillWingMat = new THREE.MeshStandardMaterial({
      color: pal.frill,
      emissive: pal.ribbon,
      emissiveIntensity: 0.72,
      roughness: 0.16,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
    });
    this.ribbonMat = new THREE.MeshBasicMaterial({
      color: pal.ribbon,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Organic Scalloped Iridescent Lizard Rib/Neck Frill Membranes + Streaming Water-Wing Ribbons!
    this.frillWingsGroup = new THREE.Group();
    this.wingL = this._buildWebbedFrillMembrane(-1);
    this.wingR = this._buildWebbedFrillMembrane(1);
    this.frillWingsGroup.add(this.wingL, this.wingR);

    this.ribbons = [];
    for (const sz of [-1, 1]) {
      const ribGeo = new THREE.PlaneGeometry(2.35, 0.22, 16, 1);
      ribGeo.translate(-1.18, 0, 0);
      const rib = new THREE.Mesh(ribGeo, this.ribbonMat);
      rib.position.set(-0.08, 0.08, sz * 0.68);
      rib.rotation.x = Math.PI * 0.35 * sz;
      this.frillWingsGroup.add(rib);
      this.ribbons.push({ mesh: rib, basePos: ribGeo.attributes.position.array.slice(), side: sz });
    }
    this.group.add(this.frillWingsGroup);

    // Hero Body Carrier (`YXZ`: +90 deg Y faces right along +X; +1.28 rad X pitches Gateway
    // into a sleek ~73-deg aerodynamic canyon glide!)
    this.bodyCarrier = new THREE.Group();
    this.liveRig = new GatewayRig(this.skinId);
    this._liveMount = new THREE.Group();
    this._liveMount.rotation.order = 'YXZ';
    this._liveMount.rotation.set(1.28, Math.PI * 0.5, 0);
    this._liveMount.scale.setScalar(1.76);
    this._liveMount.position.set(-0.88, -0.18, 0);
    this._liveMount.add(this.liveRig.group);
    this.bodyCarrier.add(this._liveMount);
    this.fallback = this._buildSculptedFallback(pal);
    this.group.add(this.bodyCarrier);
  }

  _buildWebbedFrillMembrane(side) {
    const piv = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0.28, 0);
    shape.quadraticCurveTo(0.38, side * 0.55, 0.02, side * 0.92);
    shape.quadraticCurveTo(-0.26, side * 0.72, -0.45, side * 0.48);
    shape.quadraticCurveTo(-0.58, side * 0.22, -0.42, 0);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape, 10);
    geo.rotateX(-Math.PI * 0.5);
    const m = new THREE.Mesh(geo, this.frillWingMat);
    piv.add(m);
    return piv;
  }

  _buildSculptedFallback(pal) {
    const root = new THREE.Group();
    const matScale = new THREE.MeshStandardMaterial({ color: pal.scale, roughness: 0.3, metalness: 0.14 });
    const matBelly = new THREE.MeshStandardMaterial({ color: pal.belly, roughness: 0.45 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 8, 14), matScale);
    torso.rotation.z = Math.PI * 0.5;
    root.add(torso);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.36, 6, 10), matBelly);
    belly.rotation.z = Math.PI * 0.5;
    belly.position.y = -0.04;
    root.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), matScale);
    head.scale.set(1.3, 0.85, 0.9);
    head.position.set(0.36, 0.05, 0);
    root.add(head);

    const tail = new THREE.Group();
    let p = root;
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Group();
      sp.position.set(i === 0 ? -0.26 : -0.17, 0, 0);
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(lerp(0.085, 0.016, i / 5), 0.14, 6, 10),
        i >= 4 ? this.frillWingMat : matScale
      );
      m.rotation.z = Math.PI * 0.5;
      m.position.x = -0.08;
      sp.add(m);
      p.add(sp);
      p = sp;
      segs.push(sp);
    }
    void tail;
    return { root, segs, mats: { matScale, matBelly } };
  }

  setSkin(skinId) {
    this.skinId = skinId || 'sea_glass_guardian';
    this.liveRig?.setSkin?.(this.skinId);
    const pal = SKIN_PALETTES[this.skinId] || SKIN_PALETTES.sea_glass_guardian;
    this.frillWingMat.color.set(pal.frill);
    this.frillWingMat.emissive.set(pal.ribbon);
    this.ribbonMat.color.set(pal.ribbon);
    this.fallback.mats.matScale.color.set(pal.scale);
    this.fallback.mats.matBelly.color.set(pal.belly);
  }

  update(dt, time, gliderState = {}) {
    const landed = (gliderState.landed || 0) > 0.05;
    const flapPulse = gliderState.flapT < 0.42 ? Math.sin((gliderState.flapT / 0.42) * Math.PI) : 0;
    const dihedral = 0.12 + flapPulse * 0.52 - (gliderState.dive || 0) * 0.22;

    this.frillWingsGroup.visible = !landed;
    this.wingL.rotation.x = -dihedral;
    this.wingR.rotation.x = dihedral;

    for (const r of this.ribbons) {
      const pos = r.mesh.geometry.attributes.position;
      const base = r.basePos;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const u = clamp(-bx / 2.35, 0, 1);
        pos.setY(i, by + Math.sin(time * 11 - u * 5.2 + r.side) * u * 0.22);
        pos.setZ(i, Math.cos(time * 8.5 - u * 4.0) * u * 0.12);
      }
      pos.needsUpdate = true;
    }

    if (this.liveRig?.update) {
      if (this._liveMount) {
        this._liveMount.rotation.set(
          landed ? 0 : 1.28 - (gliderState.flare || 0) * 0.42,
          Math.PI * 0.5,
          0
        );
      }
      try {
        this.liveRig.update(dt, {
          time,
          vx: landed ? gliderState.vx * 0.02 : 2.8,
          vy: -(gliderState.vy || 0) * 0.01,
          facing: 1,
          onGround: landed,
          gliding: !landed,
          anim: landed ? 'Celebrate' : 'FrillGlide',
          frillFlare: landed ? 0.2 : 1.0,
        });
        return;
      } catch {
        // Fallback
      }
    }

    for (let i = 0; i < this.fallback.segs.length; i++) {
      this.fallback.segs[i].rotation.y = Math.sin(time * 7.5 - i * 0.55) * 0.16;
      this.fallback.segs[i].rotation.z = Math.cos(time * 5.5 - i * 0.45) * 0.08;
    }
  }

  dispose() {
    this._disposed = true;
    this.liveRig?.dispose?.();
    this.frillWingMat.dispose();
    this.ribbonMat.dispose();
  }
}

function hash2DGlide(ix, iy) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) ^ 0x165667b1;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noiseTileGlide(u, v, period) {
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
    lerp(hash2DGlide(ix0, iy0), hash2DGlide(ix1, iy0), sx),
    lerp(hash2DGlide(ix0, iy1), hash2DGlide(ix1, iy1), sx),
    sy
  );
}

function createAtmosphericSkyTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([42, 132, 208, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#134e9b');
  g.addColorStop(0.22, '#2282cc');
  g.addColorStop(0.46, '#67c8f5');
  g.addColorStop(0.66, '#fef3c7');
  g.addColorStop(0.84, '#fed7aa');
  g.addColorStop(1.0, '#fde68a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  // Lush sunlit cumulus cloud decks floating across the upper & mid canyon sky!
  for (let i = 0; i < 42; i++) {
    const cx = (i * 59 + 24) % 512;
    const cy = 34 + ((i * 31) % 108);
    const rx = 34 + (i % 5) * 18;
    const ry = 12 + (i % 3) * 6;
    const cg = ctx.createRadialGradient(cx, cy - 3, 2, cx, cy, rx);
    cg.addColorStop(0, 'rgba(255, 253, 246, 0.78)');
    cg.addColorStop(0.55, 'rgba(240, 249, 255, 0.38)');
    cg.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Distant atmospheric blue-violet mountain range right above the canyon water horizon
  ctx.fillStyle = 'rgba(84, 134, 182, 0.52)';
  ctx.beginPath();
  ctx.moveTo(0, 256);
  for (let x = 0; x <= 512; x += 14) {
    const ridgeY = 148 - Math.sin(x * 0.025) * 20 - Math.abs(Math.cos(x * 0.058)) * 18;
    ctx.lineTo(x, ridgeY);
  }
  ctx.lineTo(512, 256);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMesaStrataTexture(size = 256) {
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
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Domain-warped Zion Sandstone FBM (zero straight stripes, zero plaid!)
      const wU = u + (noiseTileGlide(u, v, 4) - 0.5) * 0.28;
      const wV = v + (noiseTileGlide(u + 0.33, v + 0.21, 4) - 0.5) * 0.18;
      const grain =
        noiseTileGlide(wU, wV, 8) * 0.50 +
        noiseTileGlide(wU, wV, 18) * 0.32 +
        noiseTileGlide(u, v, 36) * 0.18;
      const bedding = 0.5 + 0.5 * Math.sin((wV * 5.0 + grain * 0.65) * TAU);
      const tBand = clamp(grain * 0.62 + bedding * 0.38, 0, 1);
      const p = (y * size + x) * 4;
      data[p] = clamp(Math.round(lerp(148, 236, tBand)), 0, 255);
      data[p + 1] = clamp(Math.round(lerp(72, 152, tBand)), 0, 255);
      data[p + 2] = clamp(Math.round(lerp(48, 102, tBand)), 0, 255);
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

function createLagoonRippleTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([20, 184, 166, 255]);
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
  ctx.fillStyle = '#0d9488';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 96; i++) {
    const x = (i * 53) % size;
    const y = (i * 89) % size;
    const w = 18 + (i % 28);
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, 'rgba(165, 243, 252, 0)');
    g.addColorStop(0.5, 'rgba(207, 250, 254, 0.45)');
    g.addColorStop(1, 'rgba(165, 243, 252, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, 3 + (i % 3));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFeatheredCascadeTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([235, 250, 255, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.ClampToEdgeWrapping;
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
    const vFade = Math.sin(Math.min(1, v * 5.2) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - v) * 3.2) * Math.PI * 0.5);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127) * 2 - 1;
      const edgeFade = Math.exp(-u * u * 4.2);
      const streak = 0.58 + 0.42 * Math.sin(u * 21.0 + Math.cos(v * 20.0) * 1.3);
      const a = clamp(vFade * edgeFade * streak, 0, 1);
      const p = (y * 128 + x) * 4;
      data[p] = 232;
      data[p + 1] = 251;
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

function buildCraggyMesaGeo(w, h, seed) {
  const parts = [];
  // Flat-topped terraced canyon mesa with craggy vertical facets (ZERO cylinder+cone look!)
  const core = new THREE.CylinderGeometry(w * 0.82, w * 1.28, h, 11, 8);
  const pos = core.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + h * 0.5) / h;
    const step = 1.0 + 0.14 * Math.sin(yn * 16.0 + seed) + 0.10 * Math.cos(Math.atan2(z, x) * 5 + seed * 1.7);
    x *= step;
    z *= step * 0.82;
    if (yn > 0.94) {
      y += Math.sin(x * 1.8 + seed) * 0.18;
    }
    pos.setXYZ(i, x, y, z);
  }
  core.computeVertexNormals();
  parts.push(core);

  // Side sandstone talus buttresses for natural geological silhouette
  for (const dir of [-1, 1]) {
    const buttress = new THREE.DodecahedronGeometry(w * 0.58, 1);
    buttress.scale(1.15, 1.35, 0.78);
    buttress.translate(dir * w * 0.78, -h * 0.24, 0.15 * dir);
    parts.push(buttress);
  }

  if (BufferGeometryUtils && typeof BufferGeometryUtils.mergeGeometries === 'function') {
    const normalized = parts.map((g) => {
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
  return core;
}

function buildGlideEnvMap(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const s = new THREE.Scene();
    s.background = new THREE.Color('#56bdf0');
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fffbeb', side: THREE.BackSide })
    );
    sun.position.set(10, 14, 8);
    s.add(sun);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: '#14b8a6', side: THREE.DoubleSide })
    );
    water.rotation.x = -Math.PI * 0.5;
    water.position.y = -5;
    s.add(water);
    const rt = pmrem.fromScene(s, 0.04);
    pmrem.dispose();
    return rt.texture;
  } catch {
    return null;
  }
}

function createPopupTex(text, color) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '800 24px Outfit, Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(8, 20, 36, 0.9)';
  ctx.strokeText(text, 160, 32);
  ctx.fillStyle = color || '#fde047';
  ctx.fillText(text, 160, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GlideRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.dpr = opts.dpr || 1;
    this.skinId = opts.skinId || 'sea_glass_guardian';
    this._disposed = false;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this.skyTex = createAtmosphericSkyTexture();
    this.mesaTex = createMesaStrataTexture(256);
    this.mesaTex.repeat.set(2, 2);
    this.cascadeTex = createFeatheredCascadeTexture();
    this.waterRippleTex = createLagoonRippleTex(256);
    this.waterRippleTex.repeat.set(10, 4);
    this.envTex = buildGlideEnvMap(webgl);

    this._initScene();
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.hero?.setSkin(skinId);
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

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#2578c4');
    this.scene.fog = new THREE.Fog('#bae6fd', 42, 165);
    if (this.envTex) this.scene.environment = this.envTex;

    this.camera = new THREE.PerspectiveCamera(FOV, this.width / Math.max(1, this.height), 0.2, 240);
    this.camera.position.set(0, 0, CAM_Z);

    this.hemiLight = new THREE.HemisphereLight('#fffbeb', '#0d9488', 1.35);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff7ed', 2.45);
    this.sunLight.position.set(12, 22, 10);
    this.scene.add(this.sunLight);

    // Multi-Band Atmospheric Sky Cyclorama + Soft Sun Halo Backdrop
    this.skyBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 108),
      new THREE.MeshBasicMaterial({ map: this.skyTex, fog: false, depthWrite: false })
    );
    this.skyBackdrop.position.set(0, 6.5, -78);
    this.scene.add(this.skyBackdrop);

    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 28),
      new THREE.MeshBasicMaterial({ color: '#fffbeb', fog: false, depthWrite: false })
    );
    this.sunDisc.position.set(11, 8.2, -72);
    this.scene.add(this.sunDisc);

    // Parallax 3D Stratified Canyon Mesas / Snow-Capped Buttes + Feathered Waterfalls + Mist!
    this.canyonGroup = new THREE.Group();
    this.cliffMat = new THREE.MeshStandardMaterial({
      color: '#d98a6c',
      map: this.mesaTex,
      bumpMap: this.mesaTex,
      bumpScale: 0.26,
      roughness: 0.80,
      metalness: 0.04,
    });
    this.capMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.68 });
    this.fallsMat = new THREE.MeshBasicMaterial({
      map: this.cascadeTex,
      color: '#f0fdfa',
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const mistPlumeMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.canyonPillars = [];
    for (let i = 0; i < MAX_CANYON_PILLARS; i++) {
      const p = new THREE.Group();
      const h = 8.2 + (i % 4) * 2.9;
      const w = 2.9 + (i % 3) * 1.05;
      const mesaGeo = buildCraggyMesaGeo(w, h, 300 + i * 29);
      const mesa = new THREE.Mesh(mesaGeo, this.cliffMat);
      mesa.position.y = h * 0.5 - 8.5;
      p.add(mesa);

      // Organic multi-cluster rim vegetation / snow-shelf cushions (ZERO cones!)
      for (let c = 0; c < 4; c++) {
        const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(w * (0.34 - c * 0.04), 1), this.capMat);
        shrub.scale.set(1.35, 0.52, 1.05);
        shrub.position.set((c - 1.5) * w * 0.38, h - 8.45 + (c % 2) * 0.18, (c % 2 - 0.5) * 0.45);
        p.add(shrub);
      }

      if (i % 3 === 0) {
        const wf = new THREE.Mesh(new THREE.PlaneGeometry(1.85, h * 0.92), this.fallsMat);
        wf.position.set(0.15, h * 0.44 - 8.5, w * 0.92);
        const mist = new THREE.Mesh(new THREE.SphereGeometry(w * 0.65, 12, 8), mistPlumeMat);
        mist.scale.set(1.4, 0.55, 0.85);
        mist.position.set(0.15, -7.8, w * 1.05);
        p.add(wf, mist);
      }
      this.canyonGroup.add(p);
      this.canyonPillars.push(p);
    }
    this.scene.add(this.canyonGroup);

    // Prismatic Rainbow Mist Arcs hovering in the canyon waterfall spray!
    this.rainbows = [];
    const rainbowCols = ['#fb7185', '#fde047', '#4ade80', '#38bdf8', '#c084fc'];
    for (let r = 0; r < MAX_RAINBOWS; r++) {
      const rg = new THREE.Group();
      for (let b = 0; b < rainbowCols.length; b++) {
        const band = new THREE.Mesh(
          new THREE.RingGeometry(3.4 + b * 0.18, 3.58 + b * 0.18, 28, 1, 0, Math.PI),
          new THREE.MeshBasicMaterial({
            color: rainbowCols[b],
            transparent: true,
            opacity: 0.24,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        rg.add(band);
      }
      this.scene.add(rg);
      this.rainbows.push(rg);
    }

    // Sparkling Canyon River / Coral Lagoon Water Surface below (`seaY`)
    this.waterMat = new THREE.MeshStandardMaterial({
      color: '#14b8a6',
      map: this.waterRippleTex,
      bumpMap: this.waterRippleTex,
      bumpScale: 0.10,
      emissive: '#0d9488',
      emissiveMap: this.waterRippleTex,
      emissiveIntensity: 0.32,
      roughness: 0.12,
      metalness: 0.22,
    });
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 48, 48, 12), this.waterMat);
    this.waterMesh.rotation.x = -Math.PI * 0.48;
    this.waterMesh.position.set(0, -6.2, -8);
    this.scene.add(this.waterMesh);

    // Departure Spire Crown (`summit`) & Arrival Spire + Sunlit Shore (`tower`)
    const spireMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.55, metalness: 0.18 });
    this.summitGroup = new THREE.Group();
    const sumCol = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.3, 14, 16), spireMat);
    sumCol.position.y = -7.0;
    this.summitGroup.add(sumCol);
    this.scene.add(this.summitGroup);

    this.destTowerGroup = new THREE.Group();
    const destCol = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, 22, 18), spireMat);
    destCol.position.y = 2.0;
    const shore = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 5.8, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: '#e7d4b5', roughness: 0.75 })
    );
    shore.position.set(-2.6, -0.4, 0.5);
    this.destTowerGroup.add(destCol, shore);
    this.scene.add(this.destTowerGroup);

    // Gateway Frill-Glider Hero
    this.hero = new AdaptiveFrillGliderHero(this.skinId);
    this.scene.add(this.hero.group);

    // Golden Thermal Ring Gates
    this.gateSlots = [];
    for (let i = 0; i < MAX_GATES; i++) {
      const g = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.09, 10, 28),
        new THREE.MeshStandardMaterial({
          color: '#fde047',
          emissive: '#f59e0b',
          emissiveIntensity: 0.85,
          metalness: 0.78,
          roughness: 0.2,
        })
      );
      const aura = new THREE.Mesh(
        new THREE.RingGeometry(0.82, 0.98, 24),
        new THREE.MeshBasicMaterial({
          color: '#5efce8',
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      torus.rotation.y = Math.PI * 0.32;
      aura.rotation.y = Math.PI * 0.32;
      g.add(torus, aura);
      g.visible = false;
      this.scene.add(g);
      this.gateSlots.push(g);
    }

    // Rising Sunlit Updraft Thermal Columns
    this.thermalMeshes = [];
    const thermGeo = new THREE.CylinderGeometry(1, 1.25, 16, 14, 1, true);
    for (let i = 0; i < MAX_THERMALS; i++) {
      const tm = new THREE.Mesh(
        thermGeo,
        new THREE.MeshBasicMaterial({
          color: '#fde047',
          transparent: true,
          opacity: 0.14,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      tm.visible = false;
      this.scene.add(tm);
      this.thermalMeshes.push(tm);
    }

    // Water-Dew Orbs, Dragonfly Kites & Golden Harmonic Seeds (`stage.lanterns`)
    this.dewInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.24, 1),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#38bdf8',
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
      MAX_DEW
    );
    this.dewInst.frustumCulled = false;
    this.scene.add(this.dewInst);

    // Squall Clouds & Lightning Strikes (`stage.clouds`)
    this.cloudSlots = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.85 });
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const cg = new THREE.Group();
      for (const [ox, oy, sc] of [
        [0, 0.08, 1.0],
        [-0.65, -0.05, 0.78],
        [0.65, -0.04, 0.82],
      ]) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.75 * sc, 12, 10), cloudMat.clone());
        puff.scale.set(1.3, 0.75, 0.85);
        puff.position.set(ox, oy, 0);
        cg.add(puff);
      }
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.05, 12, 6),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      bolt.position.y = -6.0;
      bolt.visible = false;
      cg.add(bolt);
      cg.userData = { bolt };
      cg.visible = false;
      this.scene.add(cg);
      this.cloudSlots.push(cg);
    }

    // Canyon Swallows / Seabirds (`stage.gulls`)
    const birdGeo = new THREE.ConeGeometry(0.16, 0.52, 5);
    birdGeo.rotateZ(Math.PI * 0.5);
    this.birdInst = new THREE.InstancedMesh(
      birdGeo,
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45 }),
      MAX_BIRDS
    );
    this.birdInst.frustumCulled = false;
    this.scene.add(this.birdInst);

    // Rings, Particles & Popups
    this.ringInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_RINGS
    );
    this.partInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_PARTICLES
    );
    this.ringInst.frustumCulled = false;
    this.partInst.frustumCulled = false;
    this.scene.add(this.ringInst, this.partInst);

    this.popupPool = [];
    for (let i = 0; i < MAX_POPUPS; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sp.visible = false;
      this.scene.add(sp);
      this.popupPool.push({ sprite: sp, key: '' });
    }
  }

  render(stage, opts = {}) {
    if (this._disposed || !this.webgl || !stage) return;
    const time = Number(opts.time ?? stage.t) || 0;
    const dt = clamp(Number(opts.dt) || 0.016, 0.001, 0.05);

    if (opts.skinId && opts.skinId !== this.skinId) {
      this.setSkin(opts.skinId);
    }

    const rawKey = String(stage.themeKey || stage.theme?.key || 'canyon_river').toLowerCase();
    const bKey = rawKey.includes('alpine') || rawKey.includes('snow')
      ? 'alpine_lake'
      : rawKey.includes('bayou') || rawKey.includes('sunset')
      ? 'mist_bayou'
      : rawKey.includes('coral') || rawKey.includes('day')
      ? 'coral_sea'
      : rawKey.includes('storm') || rawKey.includes('aurora')
      ? 'storm_ocean'
      : 'canyon_river';
    const pal = GLIDE_BIOME_PALETTES[bKey] || GLIDE_BIOME_PALETTES.canyon_river;

    this.scene.background.set(pal.skyTop);
    this.scene.fog.color.set(pal.fog);
    this.sunLight.color.set(pal.sun);
    this.cliffMat.color.set(pal.cliff);
    this.capMat.color.set(pal.cap);
    this.waterMat.color.set(pal.water);

    const scroll = Number(stage.scroll) || time * 110;
    this.cascadeTex.offset.set(0, -(time * 1.35) % 1);
    this.waterRippleTex.offset.set((scroll * 0.0025) % 1, Math.sin(time * 0.4) * 0.05);
    const seaY = stage.seaY ?? this.height * 0.905;
    const seaW = this._screenToWorld(this.width * 0.5, seaY, 0);
    this.waterMesh.position.y = seaW.y - 0.15;

    // Scroll Parallax 3D Canyon Pillars, Waterfalls & Prismatic Rainbow Mist Arcs
    for (let i = 0; i < MAX_CANYON_PILLARS; i++) {
      const p = this.canyonPillars[i];
      const z = -12 - (i % 3) * 8;
      const px = (((i * 9.5 - scroll * (0.016 - (i % 3) * 0.003)) % 112) + 112) % 112 - 56;
      p.position.set(px, seaW.y, z);
    }
    for (let r = 0; r < MAX_RAINBOWS; r++) {
      const rg = this.rainbows[r];
      const rx = (((r * 24 - scroll * 0.014) % 96) + 96) % 96 - 48;
      rg.position.set(rx, seaW.y + 0.6, -13.5);
    }

    // Summit Departure Spire & Arrival Spire
    if (stage.summit && stage.summit.x > -180) {
      const swp = this._screenToWorld(stage.summit.x, stage.summit.y, -1.2);
      this.summitGroup.visible = true;
      this.summitGroup.position.set(swp.x, swp.y, -1.2);
    } else {
      this.summitGroup.visible = false;
    }

    if (stage.tower?.active && (stage.tower.depth || 0) > 0.08) {
      const depthZ = lerp(-48, -2.5, stage.tower.depth || 0);
      const twp = this._screenToWorld(stage.tower.x, seaY, depthZ);
      this.destTowerGroup.visible = true;
      this.destTowerGroup.position.set(twp.x, seaW.y, depthZ);
    } else {
      this.destTowerGroup.visible = false;
    }

    // Update Gateway Frill-Glider Hero!
    const gl = stage.glider || { x: this.width * 0.28, y: this.height * 0.48, vx: 0, vy: 0 };
    const hwp = this._screenToWorld(gl.x, gl.y, 0.3);
    const pitch = clamp(Math.atan2(-(gl.vy || 0), 260), -0.62, 0.55) + (gl.flare || 0) * 0.35;
    const roll = clamp(-(gl.vy || 0) * 0.0014, -0.36, 0.36) + (gl.spin || 0);
    this.hero.group.position.set(hwp.x, hwp.y, 0.3);
    this.hero.group.rotation.set(roll, 0, pitch);
    this.hero.update(dt, time, gl);

    // Thermal Ring Gates
    const gates = stage.gates || [];
    for (let i = 0; i < MAX_GATES; i++) {
      const slot = this.gateSlots[i];
      if (i >= gates.length) {
        slot.visible = false;
        continue;
      }
      const gt = gates[i];
      const wp = this._screenToWorld(gt.x, gt.y, 0);
      const rad = Math.max(0.45, this._pxScale(gt.r || 34, 0));
      slot.visible = true;
      slot.position.set(wp.x, wp.y, 0);
      slot.scale.setScalar(rad * (gt.state === 'passed' ? 1 + (gt.t || 0) * 0.55 : 1));
      slot.rotation.z = time * 1.2 + i;
    }

    // Sunlit Updraft Thermals
    const thermals = stage.thermals || [];
    for (let i = 0; i < MAX_THERMALS; i++) {
      const tm = this.thermalMeshes[i];
      if (i >= thermals.length) {
        tm.visible = false;
        continue;
      }
      const th = thermals[i];
      const wp = this._screenToWorld(th.x, this.height * 0.55, -0.5);
      tm.visible = true;
      tm.position.set(wp.x, wp.y, -0.5);
      tm.scale.set(Math.max(0.4, this._pxScale(th.w || 48, -0.5)), 1, 1);
      tm.material.color.set(pal.thermal);
      tm.material.opacity = 0.13 * (th.fade ?? 1);
      tm.rotation.y = time * 2.2 + i;
    }

    // Water-Dew Streams, Kites & Golden Harmonic Seeds (`stage.lanterns`)
    const dm = this._dummy;
    const lanterns = stage.lanterns || [];
    let dCnt = 0;
    const dewColors = ['#5efce8', '#fde047', '#7dd3fc', '#f9a8d4'];
    for (let i = 0; i < lanterns.length && dCnt < MAX_DEW; i++) {
      const l = lanterns[i];
      const wp = this._screenToWorld(l.x, l.y, 0.15);
      const sc = l.type === 'gold' ? 1.45 : l.type === 'kite' ? 1.35 : 0.92;
      dm.position.set(wp.x, wp.y, 0.15);
      dm.rotation.set(time * 2.2 + i, time * 3.4 + i, 0);
      dm.scale.setScalar(sc);
      dm.updateMatrix();
      this._col.set(l.type === 'gold' ? '#fde047' : l.type === 'kite' ? '#f472b6' : dewColors[(l.hue || i) % 4]);
      this.dewInst.setColorAt(dCnt, this._col);
      this.dewInst.setMatrixAt(dCnt++, dm.matrix);
    }
    this.dewInst.count = dCnt;
    if (dCnt > 0) {
      this.dewInst.instanceMatrix.needsUpdate = true;
      if (this.dewInst.instanceColor) this.dewInst.instanceColor.needsUpdate = true;
    }

    // Clouds & Telegraph Bolts
    const clouds = stage.clouds || [];
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const slot = this.cloudSlots[i];
      if (i >= clouds.length) {
        slot.visible = false;
        continue;
      }
      const c = clouds[i];
      const wp = this._screenToWorld(c.x, c.y, -0.2);
      const rx = Math.max(0.6, this._pxScale(c.rx || 56, -0.2));
      slot.visible = true;
      slot.position.set(wp.x, wp.y, -0.2);
      slot.scale.setScalar(rx * 0.72);
      const isCharge = c.state === 'charge';
      const isStrike = c.state === 'strike';
      for (let k = 0; k < 3; k++) {
        const puff = slot.children[k];
        if (puff?.material) {
          puff.material.color.set(isStrike ? '#fef08a' : isCharge ? '#cbd5e1' : '#f8fafc');
        }
      }
      slot.userData.bolt.visible = isStrike;
    }

    // Soaring Canyon Swallows / Seabirds
    const gulls = stage.gulls || [];
    let bCnt = 0;
    for (let i = 0; i < gulls.length && bCnt < MAX_BIRDS; i++) {
      const b = gulls[i];
      const wp = this._screenToWorld(b.x, b.y, 0.1);
      dm.position.set(wp.x, wp.y, 0.1);
      dm.rotation.set(Math.sin(b.phase || time * 8) * 0.45, 0, 0);
      dm.scale.setScalar(0.95);
      dm.updateMatrix();
      this.birdInst.setMatrixAt(bCnt++, dm.matrix);
    }
    this.birdInst.count = bCnt;
    if (bCnt > 0) this.birdInst.instanceMatrix.needsUpdate = true;

    // Rings, Sparkles & Popups
    const rings = stage.rings || [];
    let rCnt = 0;
    for (let i = 0; i < rings.length && rCnt < MAX_RINGS; i++) {
      const r = rings[i];
      const u = 1 - clamp(r.life / Math.max(0.01, r.maxLife || 0.5), 0, 1);
      const wp = this._screenToWorld(r.x, r.y, 0.25);
      dm.position.set(wp.x, wp.y, 0.25);
      dm.rotation.set(r.flat ? Math.PI * 0.45 : 0, 0, 0);
      dm.scale.setScalar(Math.max(0.15, this._pxScale(lerp(r.r0 || 8, r.r1 || 64, u), 0.25)));
      dm.updateMatrix();
      this._col.set(r.color || '#fde047');
      this.ringInst.setColorAt(rCnt, this._col);
      this.ringInst.setMatrixAt(rCnt++, dm.matrix);
    }
    this.ringInst.count = rCnt;
    if (rCnt > 0) {
      this.ringInst.instanceMatrix.needsUpdate = true;
      if (this.ringInst.instanceColor) this.ringInst.instanceColor.needsUpdate = true;
    }

    const extParts = opts.particles || [];
    let ptCnt = 0;
    for (let i = 0; i < 36 && ptCnt < MAX_PARTICLES; i++) {
      const age = (time * 2.6 + i * 0.13) % 1;
      dm.position.set(hwp.x - 0.9 - age * 3.8, hwp.y + Math.sin(time * 8 + i) * 0.16, 0.35);
      dm.scale.setScalar((1 - age) * 0.75);
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#5efce8' : '#fde047');
      this.partInst.setColorAt(ptCnt, this._col);
      this.partInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    for (let i = 0; i < extParts.length && ptCnt < MAX_PARTICLES; i++) {
      const p = extParts[i];
      if (p.x == null || p.y == null) continue;
      const wp = this._screenToWorld(p.x, p.y, 0.35);
      dm.position.set(wp.x, wp.y, 0.35);
      dm.scale.setScalar(clamp(p.life / Math.max(0.01, p.maxLife || 1), 0, 1));
      dm.updateMatrix();
      this._col.set(p.color || '#ffffff');
      this.partInst.setColorAt(ptCnt, this._col);
      this.partInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    this.partInst.count = ptCnt;
    this.partInst.instanceMatrix.needsUpdate = true;
    if (this.partInst.instanceColor) this.partInst.instanceColor.needsUpdate = true;

    const popups = opts.popups || [];
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
        slot.sprite.material.map = createPopupTex(p.text || '', p.color || '#fde047');
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

    const sh = Number(opts.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 71) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 61) * sh * 0.02 : 0;
    this.camera.position.set(sx, sy, CAM_Z);
    this.camera.lookAt(sx, sy, 0);

    this.webgl.setRenderTarget(null);
    this.webgl.render(this.scene, this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.hero?.dispose();
    this.skyTex?.dispose();
    this.mesaTex?.dispose();
    this.cascadeTex?.dispose();
    this.waterRippleTex?.dispose();
    this.envTex?.dispose();
    for (const p of this.popupPool) {
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
  }
}

export { GlideRenderer as FrillGlideRenderer };
export default GlideRenderer;
