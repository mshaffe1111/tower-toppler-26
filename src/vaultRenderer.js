// TOWER TOPPLER '26 — ANCIENT FLOODED ASTROLABE VAULT 3D RENDERER (src/vaultRenderer.js)
//
// Shares `GameRenderer.webgl` with strict WebGL state save/restore (`setRenderTarget`,
// `autoClear`, `toneMapping`, `toneMappingExposure`, `clearColor`, `xr`, `shadowMap`)
// and zero per-frame allocations.
//
// Visual Architecture (Moonlit Sanctum & Tarnished-Brass PBR Parity with Explorer Pogo V2):
// 1. Sculpted 3D Ancient Flooded Vault Chamber: individually beveled wet indigo-slate ashlar
//    masonry blocks in a concave barrel-vaulted alcove, carved relief pilasters, rusted flanged
//    iron pipes, creeping damp moss, and slanting silver-blue moonbeam from an upper oculus.
// 2. Real-time planar-reflection GLSL Fresnel subterranean water pool (`y = -2.92`) reflecting
//    the glowing astrolabe rings, molten-gold conduits, and flickering `#ffaa33` fire braziers,
//    with expanding concentric water ripples triggered on every ring lock & strike.
// 3. Loads `assets/models/puzzle_props.glb` (`sanctum_brazier` dragon-scroll wrought-iron fire
//    sconces) with Frame-0 sculpted procedural braziers, 3D flickering flame tongues, rising
//    ember motes, and twin live flickering `#ffaa33` PointLights.
// 4. 3 concentric multi-bevel 3D Tarnished-Brass & Carved-Obsidian Astrolabe Rings (`LatheGeometry`
//    machined watchmaker profiles), studded with 12 kinematically meshing 3D planetary gears,
//    engraved glowing Nebulus rune bands, faceted Amethyst/Cyan locking calipers, and sliding
//    brass deadbolt plungers.
// 5. Molten-gold energy conduits igniting radially inward (`0 -> 1 -> 2`), a multi-faceted
//    crystalline Star Core inside a tri-axis spinning armillary gimbal cage, and aspect-safe
//    dramatic camera push-in (`0 -> 1 -> 2 -> won`).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries as rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mergeGeometries(geos, useGroups = false) {
  const normalized = [];
  for (let i = 0; i < geos.length; i++) {
    const src = geos[i];
    if (!src) continue;
    const g = src.index ? src.toNonIndexed() : src.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const cnt = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
    }
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') {
        g.deleteAttribute(k);
      }
    }
    normalized.push(g);
  }
  const merged = rawMergeGeometries(normalized, useGroups);
  for (let i = 0; i < normalized.length; i++) normalized[i].dispose();
  return merged;
}

function batchStaticMeshesByMaterial(root) {
  if (!root) return;
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const toRemove = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.visible || !obj.geometry || !obj.material || Array.isArray(obj.material)) return;
    if (obj.isInstancedMesh || obj.isSkinnedMesh) return;
    const mat = obj.material;
    if (mat.transparent || mat.vertexColors) return;
    const relMat = new THREE.Matrix4().multiplyMatrices(invRoot, obj.matrixWorld);
    const clonedGeo = obj.geometry.clone();
    clonedGeo.applyMatrix4(relMat);
    let list = buckets.get(mat);
    if (!list) {
      list = [];
      buckets.set(mat, list);
    }
    list.push(clonedGeo);
    toRemove.push(obj);
  });
  if (toRemove.length <= buckets.size) {
    for (const list of buckets.values()) {
      for (const g of list) g.dispose();
    }
    return;
  }
  for (const obj of toRemove) {
    if (obj.parent) obj.parent.remove(obj);
  }
  for (const [mat, geos] of buckets.entries()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) {
      for (const g of geos) g.dispose();
    }
    if (merged) {
      const m = new THREE.Mesh(merged, mat);
      m.frustumCulled = false;
      root.add(m);
    }
  }
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const HUD_TOP_OFFSET = 98;
const WATER_Y = -2.92;

const MAX_STRIKE_GEMS = 5;
const MAX_MOTES = 180;
const MAX_SPARKS = 160;
const MAX_POP = 12;

const RING_RADII = [2.22, 1.64, 1.08];
const RING_Z = [0.06, 0.14, 0.22];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const easeOutBack = (t) => {
  const c = 1.70158;
  const x = clamp(t, 0, 1) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

function wrapAngle(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
}

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

function resolveAssetUrl(relPath) {
  try {
    return new URL(`../${relPath}`, import.meta.url).href;
  } catch {
    return relPath;
  }
}

function getShakeXY(shake, time, out) {
  if (!shake) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  if (typeof shake === 'object') {
    out.x = (shake.x || 0) * 0.022;
    out.y = (shake.y || 0) * 0.022;
    return out;
  }
  const mag = (Number(shake) || 0) * 0.022;
  if (mag <= 0.0005) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  out.x = Math.sin(time * 73.7) * mag;
  out.y = Math.cos(time * 61.3) * mag * 0.85;
  return out;
}

function makeCanvas(w, h) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function createFallbackDataTex(r, g, b, a = 255, srgb = false) {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ----------------------------------------------------------------------------------
// Procedural PBR Maps (Wet Indigo-Slate Masonry, Brushed Brass, Engraved Runes, Water)
// ----------------------------------------------------------------------------------

function heightCanvasToNormalTex(heightCanvas, strength = 1.55) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const outCanvas = makeCanvas(w, h);
  const ctx = outCanvas.getContext('2d');
  const out = ctx.createImageData(w, h);
  const d = out.data;
  const H = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Smooth 3x3 Sobel kernel eliminates sub-pixel normal sparkle on 3D stone blocks!
      const dx =
        (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) -
          (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1))) *
        0.25 *
        strength;
      const dy =
        (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) -
          (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1))) *
        0.25 *
        strength;
      const nx = -dx;
      const ny = dy;
      const nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const i4 = (y * w + x) * 4;
      d[i4] = (nx * inv * 0.5 + 0.5) * 255;
      d[i4 + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d[i4 + 2] = (nz * inv * 0.5 + 0.5) * 255;
      d[i4 + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(outCanvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function createWaterNormalTexture(size = 256) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(128, 128, 255, 255, false);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const waves = [];
  let seed = 19;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 24; i++) {
    const kx = Math.round((rand() - 0.5) * (6 + i * 1.5));
    const ky = Math.round((rand() - 0.5) * (6 + i * 1.5));
    if (kx === 0 && ky === 0) continue;
    const k = Math.hypot(kx, ky);
    waves.push({ kx, ky, amp: 1 / Math.pow(k, 1.25), ph: rand() * TAU });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const a = TAU * (w.kx * u + w.ky * v) + w.ph;
        const cs = Math.cos(a) * w.amp;
        dx += cs * w.kx;
        dy += cs * w.ky;
      }
      const s = 0.085;
      const nx = -dx * s;
      const ny = -dy * s;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i4 = (y * size + x) * 4;
      img.data[i4] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i4 + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function createVaultStoneMaps(size = 512) {
  const colC = makeCanvas(size, size);
  const hgtC = makeCanvas(size, size);
  const rghC = makeCanvas(size, size);
  if (!colC || !hgtC || !rghC) {
    return {
      map: createFallbackDataTex(52, 58, 96, 255, true),
      normalMap: createFallbackDataTex(128, 128, 255, 255, false),
      roughnessMap: createFallbackDataTex(130, 130, 130, 255, false),
    };
  }
  const ctx = colC.getContext('2d');
  const hCtx = hgtC.getContext('2d');
  const rCtx = rghC.getContext('2d');
  const rng = mulberry32(314159);

  // Deeply chiseled weathered dark wet basalt & indigo-slate stone blocks with deep #040712 mortar joints & wet sheen!
  const baseGrad = ctx.createLinearGradient(0, 0, size * 0.35, size);
  baseGrad.addColorStop(0, '#465282');
  baseGrad.addColorStop(0.5, '#2e365c');
  baseGrad.addColorStop(1, '#181e3b');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Deep recessed chiseled stone edge bevel
  ctx.strokeStyle = '#050814';
  ctx.lineWidth = 22;
  ctx.strokeRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(148, 174, 230, 0.24)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, size - 28, size - 28);

  hCtx.fillStyle = '#141414';
  hCtx.fillRect(0, 0, size, size);
  const hPillow = hCtx.createRadialGradient(size * 0.5, size * 0.48, size * 0.08, size * 0.5, size * 0.5, size * 0.52);
  hPillow.addColorStop(0, '#f0f0f0');
  hPillow.addColorStop(0.74, '#c4c4c4');
  hPillow.addColorStop(1, '#242424');
  hCtx.fillStyle = hPillow;
  hCtx.fillRect(12, 12, size - 24, size - 24);

  rCtx.fillStyle = '#525252';
  rCtx.fillRect(0, 0, size, size);

  // Chiseled fracture fissures + rock-split facets
  for (let f = 0; f < 16; f++) {
    const fx0 = 24 + rng() * (size - 48);
    const fy0 = 24 + rng() * (size - 48);
    const fx1 = fx0 + (rng() - 0.5) * 140;
    const fy1 = fy0 + (rng() - 0.5) * 90;
    ctx.strokeStyle = 'rgba(8, 12, 26, 0.42)';
    ctx.lineWidth = 1.6 + rng() * 2.2;
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.quadraticCurveTo((fx0 + fx1) * 0.5 + (rng() - 0.5) * 24, (fy0 + fy1) * 0.5 + (rng() - 0.5) * 24, fx1, fy1);
    ctx.stroke();

    hCtx.strokeStyle = 'rgba(30, 30, 30, 0.65)';
    hCtx.lineWidth = 2.5;
    hCtx.stroke();
  }

  // Organic weathered rock blotches, damp patches & chiseled mineral veins
  for (let i = 0; i < 160; i++) {
    const px = rng() * size;
    const py = rng() * size;
    const pr = 10 + rng() * 38;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    if (rng() < 0.52) {
      g.addColorStop(0, 'rgba(20, 24, 48, 0.24)');
      g.addColorStop(1, 'rgba(20, 24, 48, 0)');
    } else {
      g.addColorStop(0, 'rgba(116, 134, 192, 0.18)');
      g.addColorStop(1, 'rgba(116, 134, 192, 0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();

    const hg = hCtx.createRadialGradient(px, py, 0, px, py, pr * 0.8);
    hg.addColorStop(0, rng() < 0.5 ? 'rgba(90,90,90,0.22)' : 'rgba(225,225,225,0.20)');
    hg.addColorStop(1, 'rgba(160,160,160,0)');
    hCtx.fillStyle = hg;
    ctx.beginPath();
    hCtx.arc(px, py, pr * 0.8, 0, TAU);
    hCtx.fill();

    const rg = rCtx.createRadialGradient(px, py, 0, px, py, pr);
    const rv = Math.round(72 + rng() * 90);
    rg.addColorStop(0, `rgba(${rv},${rv},${rv},0.35)`);
    rg.addColorStop(1, 'rgba(150,150,150,0)');
    rCtx.fillStyle = rg;
    rCtx.beginPath();
    rCtx.arc(px, py, pr, 0, TAU);
    rCtx.fill();
  }

  // Subtle damp moss along bottom stone seam
  for (let m = 0; m < 10; m++) {
    const mx = 30 + rng() * (size - 60);
    const my = size - 16 - rng() * 14;
    ctx.fillStyle = 'rgba(54, 98, 48, 0.42)';
    ctx.beginPath();
    ctx.ellipse(mx, my, 18 + rng() * 22, 8 + rng() * 7, 0, 0, TAU);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const normalMap = heightCanvasToNormalTex(hgtC, 4.35);

  const roughnessMap = new THREE.CanvasTexture(rghC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 4;

  return { map, normalMap, roughnessMap };
}

function createBrushedBrassMaps(size = 512) {
  const hgtC = makeCanvas(size, size);
  const rghC = makeCanvas(size, size);
  if (!hgtC || !rghC) {
    return {
      normalMap: createFallbackDataTex(128, 128, 255, 255, false),
      roughnessMap: createFallbackDataTex(38, 38, 38, 255, false),
    };
  }
  const hCtx = hgtC.getContext('2d');
  const rCtx = rghC.getContext('2d');
  const rng = mulberry32(7171);

  hCtx.fillStyle = '#888888';
  hCtx.fillRect(0, 0, size, size);
  // Mirror-polished burnished gold base roughness
  rCtx.fillStyle = '#262626';
  rCtx.fillRect(0, 0, size, size);

  // Engraved celestial astrolabe filigree grooves & precision watchmaker graduations
  for (const bandY of [0.18, 0.34, 0.66, 0.82]) {
    hCtx.fillStyle = '#2c2c2c';
    hCtx.fillRect(0, Math.round(bandY * size) - 2, size, 4);
    hCtx.fillStyle = '#e8e8e8';
    hCtx.fillRect(0, Math.round(bandY * size) + 2, size, 2);
  }
  for (let t = 0; t < 32; t++) {
    const tx = (t / 32) * size;
    hCtx.fillStyle = t % 4 === 0 ? '#242424' : '#4a4a4a';
    hCtx.fillRect(tx - 1.5, size * 0.36, 3, size * 0.28);
  }

  for (let i = 0; i < 180; i++) {
    const y = rng() * size;
    hCtx.strokeStyle = rng() < 0.5 ? 'rgba(230,230,230,0.25)' : 'rgba(40,40,40,0.25)';
    hCtx.lineWidth = 0.8 + rng() * 1.3;
    hCtx.beginPath();
    hCtx.moveTo(0, y);
    hCtx.lineTo(size, y);
    hCtx.stroke();
  }
  for (let p = 0; p < 28; p++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 8 + rng() * 22;
    const g = rCtx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(92,92,92,0.48)');
    g.addColorStop(1, 'rgba(38,38,38,0)');
    rCtx.fillStyle = g;
    rCtx.beginPath();
    rCtx.arc(x, y, rad, 0, TAU);
    rCtx.fill();
  }

  const normalMap = heightCanvasToNormalTex(hgtC, 2.75);
  const roughnessMap = new THREE.CanvasTexture(rghC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  return { normalMap, roughnessMap };
}

function createAstrolabeSigilTex(size = 512) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(94, 252, 232, 128, true);
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const cy = size * 0.5;
  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';

  // Concentric astrolabe degree circles & ticks
  for (const rFrac of [0.94, 0.86, 0.68, 0.50, 0.31]) {
    ctx.lineWidth = rFrac > 0.8 ? 2.4 : 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, cx * rFrac, 0, TAU);
    ctx.stroke();
  }

  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const r0 = cx * (i % 6 === 0 ? 0.81 : 0.84);
    const r1 = cx * 0.86;
    ctx.lineWidth = i % 6 === 0 ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  // 8-point celestial octagram + arcane Nebulus rune glyphs around outer ring
  ctx.lineWidth = 1.8;
  for (let sq = 0; sq < 2; sq++) {
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) {
      const a = (k / 4) * TAU + sq * (Math.PI * 0.25);
      const x = cx + Math.cos(a) * cx * 0.68;
      const y = cy + Math.sin(a) * cx * 0.68;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const rng = mulberry32(2026);
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6;
  for (let g = 0; g < 16; g++) {
    const a = (g / 16) * TAU + Math.PI / 16;
    const gx = cx + Math.cos(a) * cx * 0.765;
    const gy = cy + Math.sin(a) * cx * 0.765;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(a + Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.moveTo(-6, -4 + rng() * 4);
    ctx.lineTo(6, 3 - rng() * 4);
    if (g % 2 === 0) {
      ctx.moveTo(-5, 6);
      ctx.lineTo(0, 0);
      ctx.lineTo(5, 6);
    }
    ctx.stroke();
    ctx.restore();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSoftGlowTex(size = 128) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(255, 255, 255, 255, true);
  const ctx = c.getContext('2d');
  const half = size * 0.5;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.26, 'rgba(255,248,235,0.82)');
  g.addColorStop(0.62, 'rgba(255,210,150,0.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeMoonShaftTex(w = 128, h = 256) {
  const c = makeCanvas(w, h);
  if (!c) return createFallbackDataTex(180, 220, 255, 64, true);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    // Smooth fade at top & bottom (zero hard edges!)
    const envY = Math.sin(Math.pow(v, 0.75) * Math.PI) * (1 - v * 0.45);
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const gaussX = Math.exp(-u * u * 3.8);
      const a = clamp(envY * gaussX, 0, 1);
      const i4 = (y * w + x) * 4;
      d[i4] = 195;
      d[i4 + 1] = 228;
      d[i4 + 2] = 255;
      d[i4 + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createVaultSanctumEnvMap(webgl) {
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#090d1c');

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(18, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#171f3c', side: THREE.BackSide })
    );
    envScene.add(dome);

    // Overhead cool silver-blue moon oculus reflection patch
    const moonPatch = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#dceeff' })
    );
    moonPatch.position.set(1.5, 11, 6);
    envScene.add(moonPatch);

    // Twin warm `#ffaa33` fire-sconce reflection patches on left & right so brass rings gleam!
    const sconceGeo = new THREE.SphereGeometry(2.2, 10, 10);
    const sconceMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
    const leftFire = new THREE.Mesh(sconceGeo, sconceMat);
    leftFire.position.set(-8, -1, 5);
    const rightFire = new THREE.Mesh(sconceGeo, sconceMat);
    rightFire.position.set(8, -1, 5);
    envScene.add(leftFire, rightFire);

    // Cyan-gold core reflection
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#5efce8' })
    );
    coreGlow.position.set(0, -6, 4);
    envScene.add(coreGlow);

    const rt = pmrem.fromScene(envScene, 0.04);
    dome.geometry.dispose();
    dome.material.dispose();
    moonPatch.geometry.dispose();
    moonPatch.material.dispose();
    sconceGeo.dispose();
    sconceMat.dispose();
    coreGlow.geometry.dispose();
    coreGlow.material.dispose();
    pmrem.dispose();
    return rt;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------------
// High-Craft 3D Watchmaker Astrolabe & Sanctum Geometry Builders
// ----------------------------------------------------------------------------------

/**
 * Builds a 3D multi-chamfered watchmaker's astrolabe ring in the XY plane (`+Z` front face)
 * with a deep recessed central channel for the carved-obsidian rune inlay!
 */
function buildBeveledAstrolabeChassisGeo(radius, halfWidth = 0.175, depth = 0.16, segs = 88) {
  const rIn = radius - halfWidth;
  const rOut = radius + halfWidth;
  const gIn = radius - halfWidth * 0.54;
  const gOut = radius + halfWidth * 0.54;
  const zBack = -depth * 0.5;
  const zFront = depth * 0.5;
  const zGroove = zFront - depth * 0.34;
  const bev = 0.024;

  // Profile in (R, Y_lathe); after rotateX(PI/2), Y_lathe -> +Z (towards camera) or -Z!
  // Note: rotateX(+PI/2) maps (x, y, z) -> (x, -z, y), so Lathe Y becomes +Z? Wait:
  // Rx(+90°): y' = -z, z' = +y! Yes! Positive Lathe Y maps directly to +Z!
  const pts = [
    new THREE.Vector2(rIn + bev, zBack),
    new THREE.Vector2(rOut - bev, zBack),
    new THREE.Vector2(rOut, zBack + bev),
    new THREE.Vector2(rOut, zFront - bev),
    new THREE.Vector2(rOut - bev, zFront),
    new THREE.Vector2(gOut + 0.012, zFront),
    new THREE.Vector2(gOut, zGroove),
    new THREE.Vector2(gIn, zGroove),
    new THREE.Vector2(gIn - 0.012, zFront),
    new THREE.Vector2(rIn + bev, zFront),
    new THREE.Vector2(rIn, zFront - bev),
    new THREE.Vector2(rIn, zBack + bev),
    new THREE.Vector2(rIn + bev, zBack),
  ];
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the recessed Carved-Obsidian inlay band seated flush inside the astrolabe ring groove.
 */
function buildObsidianInlayBandGeo(radius, halfGroove = 0.092, zFront = 0.055, segs = 88) {
  const rIn = radius - halfGroove;
  const rOut = radius + halfGroove;
  const pts = [
    new THREE.Vector2(rIn, zFront - 0.03),
    new THREE.Vector2(rOut, zFront - 0.03),
    new THREE.Vector2(rOut - 0.008, zFront),
    new THREE.Vector2(rIn + 0.008, zFront),
    new THREE.Vector2(rIn, zFront - 0.03),
  ];
  const geo = new THREE.LatheGeometry(pts, segs);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a beveled 3D Resonance Sweet-Spot Arc centered at 12 o'clock (`+Y`) spanning exact `arcSpan` radians!
 */
function buildBeveledNotchArcGeo(radius, halfWidth = 0.135, zFront = 0.105, arcSpan = 0.72) {
  const rIn = radius - halfWidth;
  const rOut = radius + halfWidth;
  const bev = 0.022;
  const pts = [
    new THREE.Vector2(rIn, 0.01),
    new THREE.Vector2(rOut, 0.01),
    new THREE.Vector2(rOut, zFront - bev),
    new THREE.Vector2(rOut - bev, zFront),
    new THREE.Vector2(rIn + bev, zFront),
    new THREE.Vector2(rIn, zFront - bev),
    new THREE.Vector2(rIn, 0.01),
  ];
  // In LatheGeometry (x = r*sin(phi), y = profileY, z = r*cos(phi)):
  // After rotateX(+PI/2): x' = r*sin(phi), y' = -r*cos(phi), z' = profileY!
  // Wait: at phi = PI, sin(PI) = 0, -cos(PI) = +1 -> 12 o'clock (+Y)!
  // Let's verify: at phi = PI, x' = r * sin(PI) = 0, y' = -r * cos(PI) = +r! Exact 12 o'clock (+Y)!
  const geo = new THREE.LatheGeometry(pts, 26, Math.PI - arcSpan * 0.5, arcSpan);
  geo.rotateX(Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function buildPlanetaryGearGeo(teeth = 12, outerR = 0.21, innerR = 0.155, holeR = 0.055, depth = 0.075) {
  const shape = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.20;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.80;
    const x0 = Math.cos(a0) * innerR;
    const y0 = Math.sin(a0) * innerR;
    if (i === 0) shape.moveTo(x0, y0);
    else shape.lineTo(x0, y0);
    shape.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    shape.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, TAU, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.center();
  return geo;
}

/**
 * Builds a colossal hollow spoked abyssal reactor turbine cogwheel with beveled outer gear teeth,
 * inner splined hub ring, pitched radial I-beam turbine blades, and rim gusset rivets in 1 BufferGeometry!
 */
function buildSpokedTurbineWheelGeo(
  teeth = 20,
  outerR = 2.1,
  rimInnerR = 1.56,
  hubOuterR = 0.44,
  hubHoleR = 0.18,
  spokes = 6,
  depth = 0.18
) {
  const parts = [];
  const toothRootR = outerR - Math.min(0.18, (outerR - rimInnerR) * 0.38);

  // 1. Hollow outer toothed turbine rim
  const outerRim = buildPlanetaryGearGeo(teeth, outerR, toothRootR, rimInnerR, depth);
  parts.push(outerRim);

  // 2. Hollow central boss hub
  const hubGeo = buildPlanetaryGearGeo(Math.max(8, spokes * 2), hubOuterR, hubOuterR * 0.90, hubHoleR, depth * 1.38);
  parts.push(hubGeo);

  // 3. Pitched radial I-beam spokes / turbine vanes (open windows between spokes reveal deeper cogs!)
  const spokeLen = Math.max(0.2, rimInnerR - hubOuterR + 0.08);
  const spokeMidR = (rimInnerR + hubOuterR) * 0.5;
  const spokeW = clamp(outerR * 0.072, 0.11, 0.21);
  for (let s = 0; s < spokes; s++) {
    const a = (s / spokes) * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);

    const blade = new THREE.BoxGeometry(spokeW, spokeLen, depth * 0.78);
    blade.rotateY(0.32); // Pitched turbine blade catches specular rim light as it turns!
    blade.rotateZ(a - Math.PI * 0.5);
    blade.translate(ca * spokeMidR, sa * spokeMidR, 0);
    parts.push(blade);

    const webFlange = new THREE.BoxGeometry(spokeW * 0.46, spokeLen * 0.94, depth * 1.12);
    webFlange.rotateZ(a - Math.PI * 0.5);
    webFlange.translate(ca * spokeMidR, sa * spokeMidR, 0);
    parts.push(webFlange);

    const rivet = new THREE.CylinderGeometry(0.048, 0.048, depth * 1.28, 6);
    rivet.rotateX(Math.PI * 0.5);
    const rr = (toothRootR + rimInnerR) * 0.5;
    rivet.translate(ca * rr, sa * rr, 0);
    parts.push(rivet);
  }

  // 4. Concentric mid-span stiffener ring on larger reactor turbines
  if (outerR > 2.2) {
    const midR = (rimInnerR + hubOuterR) * 0.54;
    const stiffener = new THREE.TorusGeometry(midR, 0.048, 8, 40);
    parts.push(stiffener);
  }

  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

function buildProceduralDragonBrazier(mats) {
  // Sculpted Frame-0 Wrought-Iron Tripod Brazier matching `puzzle_props.glb` (`sanctum_brazier`, y = 0..1.16)
  const grp = new THREE.Group();
  const ironGeos = [];
  const bronzeGeos = [];

  const basePlinth = new THREE.CylinderGeometry(0.24, 0.29, 0.11, 10);
  basePlinth.translate(0, 0.055, 0);
  ironGeos.push(basePlinth);

  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU;
    const leg = new THREE.CylinderGeometry(0.026, 0.032, 0.78, 6);
    leg.rotateZ(0.12);
    leg.translate(0.19, 0.44, 0);
    leg.rotateY(a);
    ironGeos.push(leg);

    const scrollFin = new THREE.BoxGeometry(0.08, 0.14, 0.04);
    scrollFin.translate(0.28, 0.82, 0);
    scrollFin.rotateY(a);
    bronzeGeos.push(scrollFin);
  }

  const bowl = new THREE.CylinderGeometry(0.29, 0.12, 0.22, 12);
  bowl.translate(0, 0.75, 0);
  ironGeos.push(bowl);

  const rim = new THREE.TorusGeometry(0.295, 0.024, 8, 20);
  rim.rotateX(Math.PI * 0.5);
  rim.translate(0, 0.85, 0);
  bronzeGeos.push(rim);

  const mIron = mergeGeometries(ironGeos, false);
  for (const g of ironGeos) g.dispose();
  const mBronze = mergeGeometries(bronzeGeos, false);
  for (const g of bronzeGeos) g.dispose();

  const coals = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mats.emberCoals);
  coals.scale.set(1, 0.32, 1);
  coals.position.y = 0.84;

  grp.add(new THREE.Mesh(mIron, mats.wroughtIron), new THREE.Mesh(mBronze, mats.tarnishedBrass), coals);
  return grp;
}

// ----------------------------------------------------------------------------------
// Main Export: VaultRenderer
// ----------------------------------------------------------------------------------

export class VaultRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 844;
    this.dpr = opts.dpr || 1;
    this.era = opts.era === 'original' ? 'original' : 'reboot';
    this.skinId = opts.skinId || 'default_amphibian';
    this.exposure = this.era === 'original' ? 1.06 : 1.02;
    this._disposed = false;
    this._lastTime = 0;

    // Zero-GC scratch state
    this._shake = { x: 0, y: 0 };
    this._camZ = 14.5;
    this._camY = 0.0;
    this._lastLockedCount = 0;
    this._lastStrikes = 0;
    this._strikeFlash = 0;
    this._lockBoltExtend = [0, 0, 0];
    this._conduitGlow = [0, 0, 0];
    this._prevClearColor = new THREE.Color();
    this._tmpColor = new THREE.Color();
    this._colorStrCache = new Map();
    this._rgbScratch = [1, 1, 1];

    // Planar water reflection state
    this._virtualCam = new THREE.PerspectiveCamera();
    this._reflPlane = new THREE.Plane();
    this._reflNormal = new THREE.Vector3(0, 1, 0);
    this._reflWorld = new THREE.Vector3();
    this._camWorld = new THREE.Vector3();
    this._rotMat = new THREE.Matrix4();
    this._lookAt = new THREE.Vector3();
    this._clipVec = new THREE.Vector4();
    this._viewVec = new THREE.Vector3();
    this._targetVec = new THREE.Vector3();
    this._qVec = new THREE.Vector4();
    this._texMatrix = new THREE.Matrix4();

    // Pre-allocated state colors: Gleaming Specular Burnished-Gold & Faceted Amethyst PBR!
    this._colBrassDormant = new THREE.Color('#c08c2e');
    this._colBrassActive = new THREE.Color('#fbbf24');
    this._colBrassLocked = new THREE.Color('#fde047');
    this._colBrassFailed = new THREE.Color('#991b1b');

    this._colNotchDormant = new THREE.Color('#7c3aed');
    this._colEmDormant = new THREE.Color('#4c1d95');
    this._colNotchActive = new THREE.Color('#fde047');
    this._colEmActive = new THREE.Color('#f59e0b');
    this._colNotchSweet = new THREE.Color('#a5f3fc');
    this._colEmSweet = new THREE.Color('#06b6d4');
    this._colNotchLocked = new THREE.Color('#fef08a');
    this._colEmLocked = new THREE.Color('#eab308');
    this._colNotchFailed = new THREE.Color('#f87171');
    this._colEmFailed = new THREE.Color('#dc2626');

    this._colAmethyst = new THREE.Color('#c084fc');
    this._colAmethystEm = new THREE.Color('#9333ea');
    this._colCyan = new THREE.Color('#5efce8');
    this._colCyanEm = new THREE.Color('#0891b2');
    this._colGold = new THREE.Color('#fef08a');
    this._colGoldEm = new THREE.Color('#f59e0b');
    this._colCrimson = new THREE.Color('#ef4444');
    this._colCrimsonEm = new THREE.Color('#991b1b');
    this._colConduitOff = new THREE.Color('#182036');
    this._colConduitOffEm = new THREE.Color('#0b1020');

    // Scene & Cameras
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050813');
    this.scene.fog = new THREE.FogExp2('#060b1a', 0.024);

    this.camera = new THREE.PerspectiveCamera(45, Math.max(0.38, this.width / Math.max(1, this.height)), 0.2, 65);
    this.camera.position.set(0, 0, 14.5);

    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, this.width, 0, -this.height, -10, 10);

    this._ownEnvRT = null;
    if (opts.envMap) {
      this.scene.environment = opts.envMap;
    } else if (webgl) {
      this._ownEnvRT = createVaultSanctumEnvMap(webgl);
      if (this._ownEnvRT) this.scene.environment = this._ownEnvRT.texture;
    }
    this.scene.environmentIntensity = 1.05;

    this._initTextures(opts.softDotTex);
    this._initMaterials();
    this._initLights();
    this._initFloodedChamberArchitecture();
    this._initSubterraneanWater();
    this._initSconceBraziers();
    this._initAstrolabeMechanism();
    this._initAtmosphericMotesAndSparks();
    this._initStrikeCrystalsAndOverlay();
    this._loadPuzzlePropsGlb();

    this.resize(this.width, this.height, this.dpr);
    this.setEra(this.era);
  }

  _initTextures(sharedSoftDot) {
    this._ownSoftDot = !sharedSoftDot;
    this.softDotTex = sharedSoftDot || makeSoftGlowTex(128);
    this.stoneMaps = createVaultStoneMaps(512);
    this.brassMaps = createBrushedBrassMaps(256);
    this.waterNormalTex = createWaterNormalTexture(256);
    this.sigilTex = createAstrolabeSigilTex(512);
    this.moonShaftTex = makeMoonShaftTex(128, 256);
  }

  _initMaterials() {
    const sm = this.stoneMaps;
    sm.map.repeat.set(1, 1);
    sm.normalMap.repeat.set(1, 1);
    sm.roughnessMap.repeat.set(1, 1);

    this.mats = {
      wetSlate: new THREE.MeshStandardMaterial({
        color: '#9eb0e0',
        map: sm.map,
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(1.55, 1.55),
        roughnessMap: sm.roughnessMap,
        roughness: 0.25,
        metalness: 0.18,
      }),
      darkRecessSlate: new THREE.MeshStandardMaterial({
        color: '#5b6898',
        map: sm.map,
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(1.42, 1.42),
        roughnessMap: sm.roughnessMap,
        roughness: 0.30,
        metalness: 0.20,
      }),
      wroughtIron: new THREE.MeshStandardMaterial({
        color: '#252b3b',
        normalMap: this.brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughness: 0.34,
        metalness: 0.88,
      }),
      turbineIron: new THREE.MeshStandardMaterial({
        color: '#526894',
        normalMap: this.brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.95, 0.95),
        roughnessMap: this.brassMaps.roughnessMap,
        roughness: 0.22,
        metalness: 0.90,
        emissive: '#091529',
        emissiveIntensity: 0.30,
      }),
      turbineBronze: new THREE.MeshStandardMaterial({
        color: '#9e7240',
        normalMap: this.brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.90, 0.90),
        roughnessMap: this.brassMaps.roughnessMap,
        roughness: 0.24,
        metalness: 0.88,
        emissive: '#1e1206',
        emissiveIntensity: 0.26,
      }),
      abyssShadow: new THREE.MeshStandardMaterial({
        color: '#080c18',
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughness: 0.72,
        metalness: 0.18,
      }),
      abyssRune: new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 1.05,
        roughness: 0.22,
        metalness: 0.45,
      }),
      tarnishedBrass: new THREE.MeshPhysicalMaterial({
        color: '#f5b841',
        normalMap: this.brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: this.brassMaps.roughnessMap,
        roughness: 0.15,
        metalness: 0.94,
        clearcoat: 0.42,
        clearcoatRoughness: 0.12,
      }),
      pinionBronze: new THREE.MeshPhysicalMaterial({
        color: '#df9d34',
        normalMap: this.brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.75, 0.75),
        roughnessMap: this.brassMaps.roughnessMap,
        roughness: 0.17,
        metalness: 0.93,
        clearcoat: 0.38,
        clearcoatRoughness: 0.14,
      }),
      carvedObsidian: new THREE.MeshPhysicalMaterial({
        color: '#121528',
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.14,
        metalness: 0.42,
        clearcoat: 0.75,
        clearcoatRoughness: 0.12,
      }),
      mossTuft: new THREE.MeshStandardMaterial({
        color: '#355e30',
        roughness: 0.88,
        metalness: 0.02,
      }),
      emberCoals: new THREE.MeshStandardMaterial({
        color: '#ffd166',
        emissive: '#ff5500',
        emissiveIntensity: 2.35,
        roughness: 0.25,
      }),
      amethystGem: new THREE.MeshPhysicalMaterial({
        color: '#e9d5ff',
        emissive: '#9333ea',
        emissiveIntensity: 1.55,
        roughness: 0.06,
        metalness: 0.18,
        clearcoat: 1.0,
        flatShading: true,
      }),
      cyanGem: new THREE.MeshPhysicalMaterial({
        color: '#cffafe',
        emissive: '#06b6d4',
        emissiveIntensity: 1.65,
        roughness: 0.06,
        metalness: 0.18,
        clearcoat: 1.0,
        flatShading: true,
      }),
      fireHaloSprite: new THREE.SpriteMaterial({
        map: this.softDotTex,
        color: '#ffaa33',
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      coreHaloSprite: new THREE.SpriteMaterial({
        map: this.softDotTex,
        color: '#fde047',
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    };
  }

  _initLights() {
    // Cool moonlit chamber ambient + overhead silver-blue oculus directional key
    this.hemiLight = new THREE.HemisphereLight('#8cb4e8', '#141a36', 1.15);
    this.moonKeyLight = new THREE.DirectionalLight('#dbeeff', 1.65);
    this.moonKeyLight.position.set(1.8, 7.5, 9.0);

    // Twin warm `#ffaa33` flickering fire-brazier PointLights tucked in the lower spandrel pockets!
    this.sconceLightL = new THREE.PointLight('#ffaa33', 2.8, 12.0, 1.45);
    this.sconceLightL.position.set(-2.22, -1.38, 1.42);
    this.sconceLightR = new THREE.PointLight('#ffaa33', 2.8, 12.0, 1.45);
    this.sconceLightR.position.set(2.22, -1.38, 1.42);

    // Central Star Core & Resonance Caliper dynamic PointLight
    this.coreLight = new THREE.PointLight('#5efce8', 1.4, 7.5, 1.4);
    this.coreLight.position.set(0, 0.1, 1.15);

    // Deep Abyssal Reactor Shaft Backlight (recessed to z = -5.6 so it ONLY rim-lights background turbines, never foreground brass!)
    this.abyssDepthLight = new THREE.PointLight('#22d3ee', 2.2, 6.4, 1.4);
    this.abyssDepthLight.position.set(0, 0.15, -5.65);

    // Overhead Cool Clerestory Oculus Fill (soft wide grazing fill on the Gothic groin-vault ceiling ribs, zero point-hotspot!)
    this.moonOculusLight = new THREE.PointLight('#93c5fd', 0.72, 10.5, 1.25);
    this.moonOculusLight.position.set(0.0, 4.85, 3.95);

    this.scene.add(
      this.hemiLight,
      this.moonKeyLight,
      this.sconceLightL,
      this.sconceLightR,
      this.coreLight,
      this.abyssDepthLight,
      this.moonOculusLight
    );
  }

  _initFloodedChamberArchitecture() {
    // Build a rich 3D concave vaulted indigo-slate ashlar chamber + flanking corbel pilasters +
    // stepped flooded stairs + flanged wrought-iron pipes, merged into minimal static draw calls!
    const stoneGeos = [];
    const darkStoneGeos = [];
    const ironGeos = [];
    const mossGeos = [];
    const rng = mulberry32(8421);

    // 1. Deep 3D Recessed Abyssal Reactor Shaft (`z = -0.45 .. -8.2`, replaces flat shallow backDisc!)
    const abyssWallGeos = [];
    const shaftWall = new THREE.CylinderGeometry(3.18, 2.72, 7.8, 36, 4, true);
    shaftWall.scale(-1, 1, 1);
    shaftWall.rotateX(Math.PI * 0.5);
    shaftWall.translate(0, 0, -4.35);
    abyssWallGeos.push(shaftWall);

    // Distant recessed Abyssal Reactor End-Cap Bulkhead deep at `z = -8.25` (deep obsidian shadow behind turbines!)
    const backDisc = new THREE.CylinderGeometry(2.85, 2.85, 0.28, 36);
    backDisc.rotateX(Math.PI * 0.5);
    backDisc.translate(0, 0, -8.25);
    abyssWallGeos.push(backDisc);

    // 5 Stepped Circular Basalt & Wrought-Iron Tunnel Bulkhead Rings receding into the abyss (`z = -0.95 .. -6.85`)
    const bulkheadSpecs = [
      { z: -0.95, r: 2.94, tube: 0.16, iron: true },
      { z: -2.10, r: 2.78, tube: 0.17, iron: false },
      { z: -3.45, r: 2.58, tube: 0.16, iron: true },
      { z: -5.05, r: 2.34, tube: 0.15, iron: false },
      { z: -6.75, r: 2.02, tube: 0.15, iron: true },
    ];
    for (const bh of bulkheadSpecs) {
      const bRing = new THREE.TorusGeometry(bh.r, bh.tube, 10, 44);
      bRing.translate(0, 0, bh.z);
      (bh.iron ? ironGeos : stoneGeos).push(bRing);
    }

    // 12 Converging Longitudinal Bolted Iron Reactor Shaft Ribs (`z = -0.55 .. -7.95`)
    for (let sr = 0; sr < 12; sr++) {
      const a = (sr / 12) * TAU + Math.PI / 12;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const shaftRib = new THREE.BoxGeometry(0.15, 0.22, 7.4);
      shaftRib.rotateZ(a);
      // Slight inward taper toward z = -8.25
      shaftRib.translate(ca * 2.78, sa * 2.78, -4.25);
      ironGeos.push(shaftRib);
    }

    // Heavy Crossed Reactor Support Struts & Central Core Stator Housing deep at `z = -6.95`
    for (let cr = 0; cr < 4; cr++) {
      const a = (cr / 4) * Math.PI + Math.PI * 0.25;
      const strut = new THREE.BoxGeometry(0.18, 4.1, 0.22);
      strut.rotateZ(a);
      strut.translate(0, 0, -6.95);
      ironGeos.push(strut);
    }
    const deepCoreHub = new THREE.TorusGeometry(0.92, 0.16, 10, 32);
    deepCoreHub.translate(0, 0, -6.88);
    ironGeos.push(deepCoreHub);

    // Stepped Keyed Romanesque Basalt Arch Voussoirs + Molded Outer Drip-Hood Framing Astrolabe (`r = 2.92..3.68`)
    for (let v = 0; v < 32; v++) {
      const a = (v / 32) * TAU;
      const isKeyed = v % 2 === 0;
      const vH = isKeyed ? 0.62 : 0.48;
      const vD = isKeyed ? 0.54 : 0.42;
      const vR = isKeyed ? 3.25 : 3.19;
      const voussoir = new THREE.BoxGeometry(0.64, vH, vD);
      voussoir.rotateZ(a + Math.PI * 0.5);
      voussoir.translate(Math.cos(a) * vR, Math.sin(a) * vR, -0.18 + (isKeyed ? 0.04 : 0));
      stoneGeos.push(voussoir);

      // Molded outer drip-hood arch stones across the upper vault hemisphere
      if (Math.sin(a) > -0.25) {
        const hood = new THREE.BoxGeometry(0.72, 0.22, 0.58);
        hood.rotateZ(a + Math.PI * 0.5);
        hood.translate(Math.cos(a) * 3.60, Math.sin(a) * 3.60, -0.12);
        darkStoneGeos.push(hood);
      }
    }

    // 2. Concave Curved Ashlar Chamber Masonry Courses (`z = -1.65 .. -0.35`, `y = -3.2 .. +6.8`)
    const wallRadius = 6.2;
    for (let row = 0; row < 15; row++) {
      const y = -2.95 + row * 0.68;
      const segs = 13;
      const rowOffset = (row % 2) * 0.08;
      for (let s = 0; s < segs; s++) {
        const frac = (s + 0.5) / segs - 0.5; // -0.5 .. +0.5
        const theta = frac * 2.05 + rowOffset; // Concave arc wrapping behind & beside the vault
        const bx = Math.sin(theta) * wallRadius;
        const bz = -Math.cos(theta) * wallRadius + 4.95;
        // Skip central disc area already occupied by the astrolabe niche
        if (bz < -0.55 && Math.hypot(bx, y) < 2.95) continue;

        const jitterZ = (rng() - 0.5) * 0.09;
        const blk = new THREE.BoxGeometry(0.98, 0.63, 0.48);
        blk.rotateY(-theta);
        blk.translate(bx, y, bz + jitterZ);
        stoneGeos.push(blk);

        // Creeping damp moss tufts tucked onto select wet stone seams
        if (rng() < 0.16 && y < 2.6) {
          const moss = new THREE.DodecahedronGeometry(0.11 + rng() * 0.06, 0);
          moss.scale(1.5, 0.45, 0.9);
          moss.rotateY(-theta);
          moss.translate(bx * 0.96, y - 0.28, bz + 0.22);
          mossGeos.push(moss);
        }
      }
    }

    // 3. Deeper Multi-Bay Gothic/Romanesque Groin-Vaulted Ribbed Stone Ceiling Overhead (`y = 2.45 .. 5.65`, framed clearly!)
    const ceilingArchZs = [-2.95, -1.75, -0.55, 0.65, 1.85, 2.95];
    for (let azIdx = 0; azIdx < ceilingArchZs.length; azIdx++) {
      const archZ = ceilingArchZs[azIdx];
      for (let k = 0; k < 13; k++) {
        const a = Math.PI * (0.10 + (k / 12) * 0.80);
        const rx = Math.cos(a) * 4.45;
        const ry = 2.48 + Math.sin(a) * 3.05;
        const isKey = k % 2 === 0;
        const rib = new THREE.BoxGeometry(0.88, isKey ? 0.52 : 0.42, isKey ? 0.46 : 0.38);
        rib.rotateZ(a - Math.PI * 0.5);
        rib.translate(rx, ry, archZ);
        (isKey ? stoneGeos : darkStoneGeos).push(rib);
      }
      // Carved octagonal boss keystone at crown of each transverse vault rib (`y = 5.52`)
      const boss = new THREE.CylinderGeometry(0.34, 0.28, 0.30, 8);
      boss.translate(0, 5.52, archZ);
      stoneGeos.push(boss);
    }

    // Diagonal Crossed Groin-Vault Stone X-Ribs & Ridge Spine spanning bays overhead!
    const ridgeSpine = new THREE.BoxGeometry(0.36, 0.30, 6.4);
    ridgeSpine.translate(0, 5.56, 0.0);
    stoneGeos.push(ridgeSpine);

    for (const bayCenterZ of [-1.15, 1.25]) {
      for (const diagSign of [-1, 1]) {
        for (let k = 0; k < 11; k++) {
          const t = k / 10;
          const a = Math.PI * (0.14 + t * 0.72);
          const rx = Math.cos(a) * 4.38;
          const ry = 2.52 + Math.sin(a) * 2.98;
          const rz = bayCenterZ + (t - 0.5) * 2.35 * diagSign;
          const gRib = new THREE.BoxGeometry(0.84, 0.34, 0.32);
          gRib.rotateY(diagSign * 0.46);
          gRib.rotateZ(a - Math.PI * 0.5);
          gRib.translate(rx, ry, rz);
          stoneGeos.push(gRib);
        }
      }
    }

    // Recessed Upper Clerestory Iron Oculus Grate (`(0.55, 5.38, 0.55)`) + Heavy Hanging Vault Pulley Chains
    const oculusRing = new THREE.TorusGeometry(0.88, 0.11, 8, 24);
    oculusRing.rotateX(Math.PI * 0.48);
    oculusRing.translate(0.55, 5.38, 0.55);
    ironGeos.push(oculusRing);
    for (let bar = -2; bar <= 2; bar++) {
      const gBar = new THREE.CylinderGeometry(0.028, 0.028, 1.68, 6);
      gBar.translate(0.55 + bar * 0.30, 5.38, 0.55);
      ironGeos.push(gBar);
    }
    for (const sx of [-1, 1]) {
      const pulleyWheel = new THREE.TorusGeometry(0.24, 0.045, 8, 16);
      pulleyWheel.translate(sx * 1.92, 4.68, 0.35);
      ironGeos.push(pulleyWheel);
      for (let ch = 0; ch < 10; ch++) {
        const cLink = new THREE.TorusGeometry(0.062, 0.018, 6, 10);
        if (ch % 2 === 1) cLink.rotateY(Math.PI * 0.5);
        cLink.translate(sx * 1.92, 3.42 + ch * 0.125, 0.35);
        ironGeos.push(cLink);
      }
    }

    // 4. Twin Coursed Rusticated Basalt Pilasters + Romanesque Capitals Supporting `sanctum_brazier` Sconces!
    for (const sx of [-1, 1]) {
      const pilX = sx * 2.88;
      // 11 stacked chiseled ashlar quoin blocks per pilaster (replaces flat stretched 5.8m box!)
      for (let pr = 0; pr < 11; pr++) {
        const py = -2.85 + pr * 0.54;
        const isQuoin = pr % 2 === 0;
        const pw = isQuoin ? 0.78 : 0.70;
        const pd = isQuoin ? 0.72 : 0.64;
        const qBlk = new THREE.BoxGeometry(pw, 0.50, pd);
        qBlk.translate(pilX - sx * (isQuoin ? 0.03 : 0), py, 0.10 + (isQuoin ? 0.03 : 0));
        (isQuoin ? stoneGeos : darkStoneGeos).push(qBlk);
      }
      // Carved stepped Romanesque impost capital at top of pilaster (`y = 3.05`)
      for (let cp = 0; cp < 3; cp++) {
        const capBlk = new THREE.BoxGeometry(0.82 + cp * 0.10, 0.16, 0.74 + cp * 0.08);
        capBlk.translate(pilX - sx * cp * 0.04, 2.98 + cp * 0.16, 0.14 + cp * 0.03);
        stoneGeos.push(capBlk);
      }

      // Curved S-scroll stone corbel ribs + stepped pedestal tucked into lower spandrel pocket `(±2.22, -2.35, 0.68)`!
      const pedX = sx * 2.22;
      for (let st = 0; st < 4; st++) {
        const w = 0.76 - st * 0.11;
        const d = 0.76 - st * 0.11;
        const corb = new THREE.BoxGeometry(w, 0.17, d);
        corb.translate(pedX, -2.43 - st * 0.17, 0.68 - st * 0.07);
        stoneGeos.push(corb);
      }

      // Rusted Flanged Wrought-Iron Vertical Conduit Pipes + Chains (Reference Photo!)
      const pipeX = sx * 3.12;
      const pipe = new THREE.CylinderGeometry(0.085, 0.085, 6.8, 10);
      pipe.translate(pipeX, 0.2, 0.24);
      ironGeos.push(pipe);
      for (let fl = 0; fl < 5; fl++) {
        const flange = new THREE.CylinderGeometry(0.145, 0.145, 0.09, 10);
        flange.translate(pipeX, -2.2 + fl * 1.35, 0.24);
        ironGeos.push(flange);
      }
      for (let ch = 0; ch < 6; ch++) {
        const link = new THREE.TorusGeometry(0.065, 0.018, 6, 10);
        if (ch % 2 === 1) link.rotateY(Math.PI * 0.5);
        link.translate(sx * 2.15, 3.35 + ch * 0.11, 0.52);
        ironGeos.push(link);
      }
    }

    // 5. Carved Wet Stone Steps Descending into the Rippling Dark Water Pool (`y = -2.35 .. -3.10`)
    for (let st = 0; st < 3; st++) {
      const stepY = -2.42 - st * 0.24;
      const stepZ = 0.15 + st * 0.52;
      const stepW = 5.6 + st * 0.45;
      const slab = new THREE.BoxGeometry(stepW, 0.24, 0.56);
      slab.translate(0, stepY, stepZ);
      stoneGeos.push(slab);
    }

    const mStone = mergeGeometries(stoneGeos, false);
    for (const g of stoneGeos) g.dispose();
    const mDark = mergeGeometries(darkStoneGeos, false);
    for (const g of darkStoneGeos) g.dispose();
    const mAbyssWall = mergeGeometries(abyssWallGeos, false);
    for (const g of abyssWallGeos) g.dispose();
    const mIron = mergeGeometries(ironGeos, false);
    for (const g of ironGeos) g.dispose();

    this.chamberGroup = new THREE.Group();
    this._chamberDetailGrp = new THREE.Group();
    this.chamberGroup.add(new THREE.Mesh(mStone, this.mats.wetSlate));
    this._chamberDetailGrp.add(
      new THREE.Mesh(mDark, this.mats.darkRecessSlate),
      new THREE.Mesh(mAbyssWall, this.mats.abyssShadow),
      new THREE.Mesh(mIron, this.mats.wroughtIron)
    );
    if (mossGeos.length) {
      const mMoss = mergeGeometries(mossGeos, false);
      for (const g of mossGeos) g.dispose();
      this._chamberDetailGrp.add(new THREE.Mesh(mMoss, this.mats.mossTuft));
    }
    this.chamberGroup.add(this._chamberDetailGrp);

    // Merged Slanting Volumetric Silver-Blue Moonbeam Shaft from Upper Vault Oculus (1 draw call!)
    const moonBeamMat = new THREE.MeshBasicMaterial({
      map: this.moonShaftTex,
      color: '#bae6fd',
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mbG1 = new THREE.PlaneGeometry(3.4, 9.6);
    mbG1.rotateZ(-0.22);
    mbG1.translate(0.55, 1.85, 0.45);
    const mbG2 = new THREE.PlaneGeometry(2.2, 9.2);
    mbG2.rotateY(Math.PI * 0.35);
    mbG2.rotateZ(-0.22);
    mbG2.translate(0.35, 1.85, 0.55);
    const mMoonBeam = mergeGeometries([mbG1, mbG2], false);
    mbG1.dispose();
    mbG2.dispose();
    this.moonBeamA = new THREE.Mesh(mMoonBeam, moonBeamMat);
    this.moonBeamB = null;
    this.chamberGroup.add(this.moonBeamA);

    this.scene.add(this.chamberGroup);
  }

  _initSubterraneanWater() {
    this.reflRT = new THREE.WebGLRenderTarget(256, 256, {
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
    });
    this.reflRT.texture.generateMipmaps = false;

    const waterGeo = new THREE.PlaneGeometry(18, 16, 40, 40);
    waterGeo.rotateX(-Math.PI * 0.5);

    this._ripples = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -100, 0));
    this._rippleCursor = 0;

    this.waterUniforms = {
      uTime: { value: 0 },
      normalMap: { value: this.waterNormalTex },
      reflectionMap: { value: this.reflRT.texture },
      textureMatrix: { value: this._texMatrix },
      useReflection: { value: 1 },
      deepColor: { value: new THREE.Color('#040c1a') },
      shallowColor: { value: new THREE.Color('#0c3b54') },
      ripples: { value: this._ripples },
    };

    this.waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform mat4 textureMatrix;
        varying vec3 vWorld;
        varying vec4 vReflCoord;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float swell = sin(wp.x * 1.4 + uTime * 1.8) * 0.022 + cos(wp.z * 1.7 - uTime * 1.5) * 0.018;
          wp.y += swell;
          vWorld = wp.xyz;
          vReflCoord = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D normalMap;
        uniform sampler2D reflectionMap;
        uniform float useReflection;
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec4 ripples[6];
        varying vec3 vWorld;
        varying vec4 vReflCoord;

        vec3 sampleN(vec2 uv) { return texture2D(normalMap, uv).xyz * 2.0 - 1.0; }

        void main() {
          vec2 p = vWorld.xz;
          vec3 n1 = sampleN(p * 0.28 + vec2(uTime * 0.022, uTime * 0.016));
          vec3 n2 = sampleN(p * 0.62 + vec2(-uTime * 0.019, uTime * 0.028));
          vec3 n3 = sampleN(p * 1.25 + vec2(uTime * 0.035, -uTime * 0.024));
          vec3 rip = n1 + n2 * 0.75 + n3 * 0.45;

          vec2 ringN = vec2(0.0);
          float ringGlow = 0.0;
          for (int i = 0; i < 6; i++) {
            vec4 R = ripples[i];
            float age = uTime - R.z;
            if (age < 0.0 || age > 3.5) continue;
            vec2 dv = p - R.xy;
            float d = length(dv) + 1e-4;
            float c = age * 2.2;
            float env = R.w * exp(-age * 1.1) * exp(-pow((d - c) / (0.28 + age * 0.2), 2.0));
            float ph = (d - c) * 14.0;
            ringN += (dv / d) * cos(ph) * env * 0.85;
            ringGlow += max(0.0, sin(ph)) * env * 0.35;
          }

          vec3 v = normalize(cameraPosition - vWorld);
          vec3 n = normalize(vec3(rip.x * 0.18 + ringN.x, 1.0, rip.y * 0.18 + ringN.y));
          float cosT = clamp(dot(n, v), 0.0, 1.0);
          float fres = clamp(0.04 + 0.94 * pow(1.0 - cosT, 4.2), 0.0, 0.92);

          vec3 refl = vec3(0.06, 0.11, 0.22);
          if (useReflection > 0.5 && vReflCoord.w > 0.0) {
            vec2 rc = vReflCoord.xy / vReflCoord.w + n.xz * 0.042;
            rc = clamp(rc, vec2(0.002), vec2(0.998));
            refl = texture2D(reflectionMap, rc).rgb;
          }

          vec3 body = mix(deepColor, shallowColor, 0.35);
          vec3 col = mix(body, refl * 1.18, fres);
          col += vec3(0.35, 0.85, 0.95) * ringGlow;

          // Subtle edge vignette into dark flooded chamber corners
          float edgeFade = smoothstep(8.2, 3.2, length(p - vec2(0.0, 2.2)));
          col *= mix(0.25, 1.0, edgeFade);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    this.waterMesh.position.set(0, WATER_Y, 2.6);
    this.scene.add(this.waterMesh);
  }

  _addWaterRipple(x, z, strength, time) {
    this._ripples[this._rippleCursor].set(x, z, time, strength);
    this._rippleCursor = (this._rippleCursor + 1) % this._ripples.length;
  }

  _updatePlanarReflection() {
    const r = this.webgl;
    if (!r) return;
    const useRefl = this.dpr >= 1.0 ? 1 : 0;
    this.waterUniforms.useReflection.value = useRefl;
    if (!useRefl) return;

    const mesh = this.waterMesh;
    const camera = this.camera;
    mesh.updateMatrixWorld();
    camera.updateMatrixWorld();

    this._reflWorld.setFromMatrixPosition(mesh.matrixWorld);
    this._camWorld.setFromMatrixPosition(camera.matrixWorld);
    this._reflNormal.set(0, 1, 0);
    this._viewVec.subVectors(this._reflWorld, this._camWorld);
    if (this._viewVec.dot(this._reflNormal) > 0) return;

    this._viewVec.reflect(this._reflNormal).negate().add(this._reflWorld);
    this._rotMat.extractRotation(camera.matrixWorld);
    this._lookAt.set(0, 0, -1).applyMatrix4(this._rotMat).add(this._camWorld);
    this._targetVec.subVectors(this._reflWorld, this._lookAt).reflect(this._reflNormal).negate().add(this._reflWorld);

    const vc = this._virtualCam;
    vc.position.copy(this._viewVec);
    vc.up.set(0, 1, 0).applyMatrix4(this._rotMat).reflect(this._reflNormal);
    vc.lookAt(this._targetVec);
    vc.far = camera.far;
    vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this._texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this._texMatrix.multiply(vc.projectionMatrix);
    this._texMatrix.multiply(vc.matrixWorldInverse);
    this._texMatrix.multiply(mesh.matrixWorld);

    this._reflPlane.setFromNormalAndCoplanarPoint(this._reflNormal, this._reflWorld);
    this._reflPlane.applyMatrix4(vc.matrixWorldInverse);
    this._clipVec.set(
      this._reflPlane.normal.x,
      this._reflPlane.normal.y,
      this._reflPlane.normal.z,
      this._reflPlane.constant
    );
    const pm = vc.projectionMatrix.elements;
    this._qVec.x = (Math.sign(this._clipVec.x) + pm[8]) / pm[0];
    this._qVec.y = (Math.sign(this._clipVec.y) + pm[9]) / pm[5];
    this._qVec.z = -1.0;
    this._qVec.w = (1.0 + pm[10]) / pm[14];
    this._clipVec.multiplyScalar(2.0 / this._clipVec.dot(this._qVec));
    pm[2] = this._clipVec.x;
    pm[6] = this._clipVec.y;
    pm[10] = this._clipVec.z + 1.0 - 0.003;
    pm[14] = this._clipVec.w;

    mesh.visible = false;
    const prevMotes = this.motePoints ? this.motePoints.visible : false;
    const prevSparks = this.sparkPoints ? this.sparkPoints.visible : false;
    // Reflect ONLY chamber stone walls + glowing astrolabe rings/core + brazier fire (#183: 53 -> ~12 reflection calls!)
    if (this.motePoints) this.motePoints.visible = false;
    if (this.sparkPoints) this.sparkPoints.visible = false;
    if (this.sigilDisc) this.sigilDisc.visible = false;
    if (this.moonBeamA) this.moonBeamA.visible = false;
    if (this.moonBeamB) this.moonBeamB.visible = false;
    if (this.planetaryGearInst) this.planetaryGearInst.visible = false;
    if (this.masterBridge) this.masterBridge.visible = false;
    if (this._nonReflGroup) this._nonReflGroup.visible = false;
    if (this._chamberDetailGrp) this._chamberDetailGrp.visible = false;
    if (this.brazierStaticGroup) this.brazierStaticGroup.visible = false;
    const scUd = this.starCoreGroup?.userData;
    if (scUd) {
      scUd.gimbalOuter.visible = false;
      scUd.gimbalMid.visible = false;
      scUd.gimbalInner.visible = false;
      if (scUd.crystalShell) scUd.crystalShell.visible = false;
    }
    for (let i = 0; i < this.brazierSlots.length; i++) {
      const bs = this.brazierSlots[i];
      bs._rProc = bs.procBrazier.visible;
      bs._rGlb = bs.glbMount.visible;
      bs.procBrazier.visible = false;
      bs.glbMount.visible = false;
      if (bs.fCore) bs.fCore.visible = false;
    }
    for (let i = 0; i < this.ringObjs.length; i++) {
      const ru = this.ringObjs[i].userData;
      if (ru.obsidianMesh) ru.obsidianMesh.visible = false;
      if (ru.calGemMesh) ru.calGemMesh.visible = false;
    }
    for (let i = 0; i < this.strikeGems.length; i++) this.strikeGems[i].userData._rVis = this.strikeGems[i].visible, (this.strikeGems[i].visible = false);
    if (this.strikeBezelInst) this.strikeBezelInst.visible = false;

    r.setRenderTarget(this.reflRT);
    r.state.buffers.depth.setMask(true);
    r.clear(true, true, false);
    r.render(this.scene, vc);

    mesh.visible = true;
    if (this.motePoints) this.motePoints.visible = prevMotes;
    if (this.sparkPoints) this.sparkPoints.visible = prevSparks;
    if (this.sigilDisc) this.sigilDisc.visible = true;
    if (this.moonBeamA) this.moonBeamA.visible = this.era !== 'original';
    if (this.moonBeamB) this.moonBeamB.visible = this.era !== 'original';
    if (this.planetaryGearInst) this.planetaryGearInst.visible = true;
    if (this.masterBridge) this.masterBridge.visible = true;
    if (this._nonReflGroup) this._nonReflGroup.visible = true;
    if (this._chamberDetailGrp) this._chamberDetailGrp.visible = true;
    if (this.brazierStaticGroup) this.brazierStaticGroup.visible = true;
    if (scUd) {
      scUd.gimbalOuter.visible = true;
      scUd.gimbalMid.visible = true;
      scUd.gimbalInner.visible = true;
      if (scUd.crystalShell) scUd.crystalShell.visible = true;
    }
    for (let i = 0; i < this.brazierSlots.length; i++) {
      const bs = this.brazierSlots[i];
      bs.procBrazier.visible = Boolean(bs._rProc);
      bs.glbMount.visible = Boolean(bs._rGlb);
      if (bs.fCore) bs.fCore.visible = true;
    }
    for (let i = 0; i < this.ringObjs.length; i++) {
      const ru = this.ringObjs[i].userData;
      if (ru.obsidianMesh) ru.obsidianMesh.visible = true;
      if (ru.calGemMesh) ru.calGemMesh.visible = true;
    }
    for (let i = 0; i < this.strikeGems.length; i++) this.strikeGems[i].visible = Boolean(this.strikeGems[i].userData._rVis);
    if (this.strikeBezelInst) this.strikeBezelInst.visible = true;
  }

  _initSconceBraziers() {
    // Twin Flanking `sanctum_brazier` Iron Fire Sconces with Molten Coal Beds & Multi-Layered Volumetric Fire Shader!
    this.brazierSlots = [];
    this.fireUniforms = {
      uTime: { value: 0 },
    };

    // Build 4 crossed curved flame sheets per sconce (replaces flat yellow ConeGeometry completely!)
    const sheetGeos = [];
    const sheetSpecs = [
      { rotY: 0.0, w: 0.56, h: 0.88, ox: 0.0, oy: 0.42 },
      { rotY: 0.82, w: 0.50, h: 0.82, ox: -0.03, oy: 0.39 },
      { rotY: -0.82, w: 0.50, h: 0.82, ox: 0.03, oy: 0.39 },
      { rotY: Math.PI * 0.5, w: 0.44, h: 0.72, ox: 0.0, oy: 0.34 },
    ];
    for (const sp of sheetSpecs) {
      const pg = new THREE.PlaneGeometry(sp.w, sp.h, 6, 12);
      pg.rotateY(sp.rotY);
      pg.translate(sp.ox, sp.oy, 0);
      sheetGeos.push(pg);
    }
    const volumetricFlameGeo = mergeGeometries(sheetGeos, false);
    for (const g of sheetGeos) g.dispose();

    const coalParts = [];
    for (let c = 0; c < 7; c++) {
      const a = (c / 7) * TAU;
      const r = c === 0 ? 0 : 0.12 + (c % 2) * 0.05;
      const cg = new THREE.DodecahedronGeometry(0.068 + (c % 3) * 0.015, 0);
      cg.scale(1.15, 0.55, 1.15);
      cg.translate(Math.cos(a) * r, 0.02, Math.sin(a) * r);
      coalParts.push(cg);
    }
    const coalBedGeo = mergeGeometries(coalParts, false);
    for (const g of coalParts) g.dispose();

    const makeFlameMat = (phaseOffset) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.fireUniforms.uTime,
          uPhase: { value: phaseOffset },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          uniform float uTime;
          uniform float uPhase;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float h = clamp(uv.y, 0.0, 1.0);
            p.x += sin(uTime * 8.5 + h * 4.5 + uPhase) * 0.065 * h * h;
            p.z += cos(uTime * 7.2 + h * 3.8 + uPhase) * 0.045 * h * h;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uPhase;
          varying vec2 vUv;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
          float vnoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
          }
          float fbm(vec2 p) {
            return vnoise(p) * 0.55 + vnoise(p * 2.15 + 7.3) * 0.30 + vnoise(p * 4.4 - 3.1) * 0.15;
          }
          void main() {
            float x = (vUv.x - 0.5) * 2.0;
            float y = clamp(vUv.y, 0.0, 1.0);
            float t = uTime * 3.8 + uPhase;

            // Domain-warped upward-licking turbulent fire tongues & detached wisps!
            float warp = (fbm(vec2(x * 2.2, y * 2.8 - t * 1.15)) - 0.5) * (0.45 + 0.65 * y);
            float wx = x + warp;
            float taper = mix(0.76, 0.06, pow(y, 1.25));
            float radial = 1.0 - smoothstep(taper * 0.25, taper, abs(wx));

            float nTongues = fbm(vec2(wx * 3.6, y * 4.8 - t * 1.65));
            float erosion = mix(0.10, 0.78, pow(y, 1.35));
            float flame = smoothstep(erosion, erosion + 0.28, radial * 0.72 + nTongues * 0.52);
            flame *= smoothstep(0.0, 0.10, y) * (1.0 - smoothstep(0.84, 1.0, y));

            // Hot white-gold core -> vivid amber-orange body -> deep crimson-ember tips
            float core = smoothstep(0.58, 0.96, radial * (1.0 - y * 0.72) + nTongues * 0.25);
            vec3 col = mix(vec3(0.95, 0.18, 0.02), vec3(1.0, 0.58, 0.08), smoothstep(0.15, 0.68, flame + (1.0 - y) * 0.35));
            col = mix(col, vec3(1.0, 0.96, 0.76), core * 0.88);

            gl_FragColor = vec4(col, flame * 0.78);
          }
        `,
      });

    for (const sx of [-1, 1]) {
      const root = new THREE.Group();
      root.position.set(sx * 2.22, -2.35, 0.68);
      root.scale.setScalar(0.92);

      const procBrazier = buildProceduralDragonBrazier(this.mats);
      const glbMount = new THREE.Group();

      const flameRig = new THREE.Group();
      flameRig.position.set(0, 0.82, 0);
      const phase = sx > 0 ? 2.15 : 0.0;
      const fMain = new THREE.Mesh(volumetricFlameGeo, makeFlameMat(phase));
      const fCore = new THREE.Mesh(coalBedGeo, this.mats.emberCoals);

      const halo = new THREE.Sprite(this.mats.fireHaloSprite);
      halo.scale.set(1.95, 1.95, 1);
      halo.position.set(0, 0.28, 0);
      flameRig.add(fMain, fCore, halo);

      root.add(procBrazier, glbMount, flameRig);
      this.scene.add(root);
      this.brazierSlots.push({ root, procBrazier, glbMount, flameRig, fMain, fCore, halo, phase });
    }
    this.brazierStaticGroup = new THREE.Group();
    this.scene.add(this.brazierStaticGroup);
  }

  _loadPuzzlePropsGlb() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    let loader;
    try {
      loader = new GLTFLoader();
    } catch {
      return;
    }

    loader.load(
      resolveAssetUrl('assets/models/puzzle_props.glb'),
      (gltf) => {
        if (this._disposed || !gltf?.scene) return;
        const tplBrazier = gltf.scene.getObjectByName('sanctum_brazier');
        if (!tplBrazier) return;

        for (const slot of this.brazierSlots) {
          const clone = tplBrazier.clone(true);
          clone.position.copy(slot.root.position);
          clone.scale.copy(slot.root.scale);
          clone.traverse((o) => {
            if (!o.isMesh || !o.material) return;
            o.frustumCulled = false;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (m && typeof m.emissiveIntensity === 'number' && m.emissiveIntensity > 1.85) {
                m.emissiveIntensity = 1.85;
              }
            }
          });
          slot.procBrazier.visible = false;
          this.brazierStaticGroup.add(clone);
        }
        batchStaticMeshesByMaterial(this.brazierStaticGroup);
      },
      undefined,
      () => {}
    );
  }

  _initAstrolabeMechanism() {
    this.astrolabeRoot = new THREE.Group();

    // 1. Engraved Glowing Astrolabe Sigil Halo & 3-Stage Molten-Gold Energy Conduits (`0 -> 1 -> 2`)
    this.sigilMat = new THREE.MeshBasicMaterial({
      map: this.sigilTex,
      color: '#38bdf8',
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sigilDisc = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), this.sigilMat);
    this.sigilDisc.position.z = -0.28;
    this.astrolabeRoot.add(this.sigilDisc);

    // 3 Concentric Stage Conduit Materials (Stage 0 = Outer -> Stage 1 = Mid -> Stage 2 = Inner Molten Gold!)
    this.conduitMats = [0, 1, 2].map(
      () =>
        new THREE.MeshStandardMaterial({
          color: '#182036',
          emissive: '#0b1020',
          emissiveIntensity: 0.25,
          roughness: 0.2,
          metalness: 0.5,
        })
    );

    const radialIronGeos = [];
    const stageConduitGeos = [[], [], []];
    const conduitSpecs = [
      { midR: 2.48, len: 0.50, stage: 0 },
      { midR: 1.93, len: 0.48, stage: 1 },
      { midR: 1.18, len: 0.80, stage: 2 },
    ];
    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * TAU + Math.PI / 8;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);

      const rib = new THREE.BoxGeometry(0.16, 2.88, 0.10);
      rib.rotateZ(ang + Math.PI * 0.5);
      rib.translate(ca * 1.95, sa * 1.95, -0.24);
      radialIronGeos.push(rib);

      for (const sp of conduitSpecs) {
        const ch = new THREE.BoxGeometry(0.068, sp.len, 0.055);
        ch.rotateZ(ang + Math.PI * 0.5);
        ch.translate(ca * sp.midR, sa * sp.midR, -0.17);
        stageConduitGeos[sp.stage].push(ch);
      }
    }
    const mRibs = mergeGeometries(radialIronGeos, false);
    for (const g of radialIronGeos) g.dispose();
    this._nonReflGroup = new THREE.Group();
    this._nonReflGroup.add(new THREE.Mesh(mRibs, this.mats.wroughtIron));

    // 1B. Deep 3D Abyssal Reactor Background Turbine Cogs, Recessed Rune Conduits & Rising Cavern Mist!
    this.bgTurbines = [];
    const turbineSpecs = [
      { teeth: 20, outerR: 1.98, rimIn: 1.48, hubR: 0.42, holeR: 0.16, spokes: 6, depth: 0.18, x: -1.06, y: 0.62, z: -1.28, spd: 0.21, bronze: false },
      { teeth: 18, outerR: 1.88, rimIn: 1.40, hubR: 0.38, holeR: 0.15, spokes: 6, depth: 0.17, x: 1.12, y: -0.58, z: -2.28, spd: -0.26, bronze: true },
      { teeth: 28, outerR: 2.68, rimIn: 2.08, hubR: 0.66, holeR: 0.28, spokes: 8, depth: 0.22, x: 0.0, y: 0.16, z: -3.58, spd: 0.14, bronze: false },
      { teeth: 22, outerR: 2.12, rimIn: 1.60, hubR: 0.46, holeR: 0.18, spokes: 6, depth: 0.18, x: -0.34, y: -0.26, z: -5.15, spd: -0.18, bronze: true },
    ];
    for (const ts of turbineSpecs) {
      const tGeo = buildSpokedTurbineWheelGeo(ts.teeth, ts.outerR, ts.rimIn, ts.hubR, ts.holeR, ts.spokes, ts.depth);
      const tMesh = new THREE.Mesh(tGeo, ts.bronze ? this.mats.turbineBronze : this.mats.turbineIron);
      tMesh.position.set(ts.x, ts.y, ts.z);
      tMesh.userData.spd = ts.spd;
      this._nonReflGroup.add(tMesh);
      this.bgTurbines.push(tMesh);
    }

    // Recessed Glowing Abyssal Rune Conduits & Stator Rings lining the 7.5m Reactor Tunnel (1 merged draw call!)
    const abyssRuneGeos = [];
    for (const [rz, rr, rt] of [
      [-1.02, 2.82, 0.036],
      [-2.18, 2.64, 0.036],
      [-3.52, 2.44, 0.038],
      [-5.12, 2.18, 0.038],
      [-6.82, 1.86, 0.042],
      [-6.86, 0.74, 0.048],
    ]) {
      const rTorus = new THREE.TorusGeometry(rr, rt, 8, 48);
      rTorus.translate(0, 0, rz);
      abyssRuneGeos.push(rTorus);
    }
    for (let b = 0; b < 12; b++) {
      const a = (b / 12) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Axial recessed glowing rune busbar converging down the reactor shaft
      const busbar = new THREE.BoxGeometry(0.052, 0.052, 6.2);
      busbar.rotateZ(a);
      busbar.translate(ca * 2.56, sa * 2.56, -3.95);
      abyssRuneGeos.push(busbar);

      // Engraved geometric rune-chevron nodes along the recessed tunnel walls
      for (const nz of [-1.62, -2.88, -4.32, -5.95]) {
        const rNode = 2.68 + nz * 0.11;
        const rTablet = new THREE.BoxGeometry(0.18, 0.06, 0.28);
        rTablet.rotateZ(a + Math.PI * 0.5);
        rTablet.translate(ca * rNode, sa * rNode, nz);
        abyssRuneGeos.push(rTablet);
      }
    }
    const mAbyssRunes = mergeGeometries(abyssRuneGeos, false);
    for (const g of abyssRuneGeos) g.dispose();
    this.abyssRuneMesh = new THREE.Mesh(mAbyssRunes, this.mats.abyssRune);
    this._nonReflGroup.add(this.abyssRuneMesh);

    // Rising Volumetric Subterranean Cavern Mist drifting off Flooded Steps & Deep Shaft (NormalBlending, never washes out cogs!)
    this.cavernMistUniforms = {
      uTime: { value: 0 },
      uGlow: { value: 0 },
    };
    const mistSheets = [];
    const mistLayers = [
      { w: 7.6, h: 2.5, x: 0.0, y: -1.95, z: 0.42, layer: 2.0 },
      { w: 3.4, h: 4.4, x: -1.88, y: -0.55, z: -2.65, layer: 0.0 },
      { w: 3.4, h: 4.4, x: 1.88, y: -0.45, z: -2.65, layer: 1.0 },
      { w: 4.8, h: 4.2, x: 0.0, y: -0.25, z: -4.55, layer: 1.5 },
    ];
    for (const ml of mistLayers) {
      const pg = new THREE.PlaneGeometry(ml.w, ml.h);
      pg.translate(ml.x, ml.y, ml.z);
      const count = pg.attributes.position.count;
      const layerArr = new Float32Array(count);
      layerArr.fill(ml.layer);
      pg.setAttribute('aLayer', new THREE.BufferAttribute(layerArr, 1));
      mistSheets.push(pg);
    }
    const mCavernMist = mergeGeometries(mistSheets, false);
    for (const g of mistSheets) g.dispose();
    const cavernMistMat = new THREE.ShaderMaterial({
      uniforms: this.cavernMistUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aLayer;
        varying vec2 vUv;
        varying float vLayer;
        void main() {
          vUv = uv;
          vLayer = aLayer;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uGlow;
        varying vec2 vUv;
        varying float vLayer;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          float phase = vLayer * 3.17;
          vec2 p = vec2(vUv.x * 4.2 + sin(uTime * 0.22 + phase) * 0.45, vUv.y * 3.4 - uTime * (0.20 + vLayer * 0.04));
          float n1 = vnoise(p);
          float n2 = vnoise(p * 2.3 + vec2(-uTime * 0.14, n1 * 1.15));
          float n3 = vnoise(p * 4.7 + vec2(n2 * 0.9, -uTime * 0.28));
          float vapor = n1 * 0.50 + n2 * 0.34 + n3 * 0.16;

          // Zero hard borders: smoothly feathered to 0.0 at all edges
          float edgeEnv = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x)
                        * smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
          float wisp = smoothstep(0.42, 0.88, vapor) * edgeEnv;

          vec3 mistCol = mix(vec3(0.08, 0.18, 0.32), vec3(0.28, 0.62, 0.84), vapor);
          mistCol = mix(mistCol, vec3(0.75, 0.60, 0.32), uGlow * 0.32);
          float alpha = wisp * (vLayer > 1.8 ? 0.30 : 0.24);
          gl_FragColor = vec4(mistCol, alpha);
        }
      `,
    });
    this.cavernMistMesh = new THREE.Mesh(mCavernMist, cavernMistMat);
    this._nonReflGroup.add(this.cavernMistMesh);

    const stageRingRadii = [2.48, 1.93, 0.82];
    for (let s = 0; s < 3; s++) {
      const cRing = new THREE.TorusGeometry(stageRingRadii[s], 0.032, 8, 64);
      cRing.translate(0, 0, -0.16);
      stageConduitGeos[s].push(cRing);
      const mCond = mergeGeometries(stageConduitGeos[s], false);
      for (const g of stageConduitGeos[s]) g.dispose();
      this._nonReflGroup.add(new THREE.Mesh(mCond, this.conduitMats[s]));
    }

    // 2. Stationary Beveled Outer Astrolabe Housing (`r = 2.74`) + Merged Brass Clamps & Perimeter Keystones
    const outerHousingGeo = buildBeveledAstrolabeChassisGeo(2.74, 0.16, 0.22, 80);
    const outerHousing = new THREE.Mesh(outerHousingGeo, this.mats.wroughtIron);
    outerHousing.position.z = 0.02;
    this._nonReflGroup.add(outerHousing);

    const staticBrassAccents = [];
    const amethystKeyGeos = [];
    const cyanKeyGeos = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + Math.PI / 8;
      const clampBracket = new THREE.BoxGeometry(0.18, 0.30, 0.28);
      clampBracket.rotateZ(a + Math.PI * 0.5);
      clampBracket.translate(Math.cos(a) * 2.74, Math.sin(a) * 2.74, 0.06);
      staticBrassAccents.push(clampBracket);

      const gem = new THREE.OctahedronGeometry(0.115, 0);
      gem.scale(0.75, 1.25, 0.75);
      gem.rotateZ(a + Math.PI * 0.5);
      gem.translate(Math.cos(a) * 2.74, Math.sin(a) * 2.74, 0.22);
      if (k % 2 === 0) amethystKeyGeos.push(gem);
      else cyanKeyGeos.push(gem);
    }

    // 3. 12 Meshing 3D Toothed Planetary Pinion Gears Between Rings (1 single InstancedMesh -> 1 draw call!)
    this.planetaryGears = [];
    this._gearDummy = new THREE.Object3D();
    const pGearSharedGeo = buildPlanetaryGearGeo(12, 0.21, 0.155, 0.052, 0.08);
    this.planetaryGearInst = new THREE.InstancedMesh(pGearSharedGeo, this.mats.pinionBronze, 12);
    this.planetaryGearInst.frustumCulled = false;
    const gearAngles = [0.22 * Math.PI, 0.78 * Math.PI, 1.22 * Math.PI, 1.78 * Math.PI];

    const carrierBands = [
      { r: 2.48, z: 0.05, scale: 1.0, ringRef: 0, ratio: -2.22 / 0.20 },
      { r: 1.93, z: 0.10, scale: 1.0, ringRef: 1, ratio: -1.64 / 0.20 },
      { r: 1.36, z: 0.18, scale: 0.86, ringRef: 2, ratio: -1.08 / 0.17 },
    ];
    for (const band of carrierBands) {
      for (let gi = 0; gi < gearAngles.length; gi++) {
        const ga = gearAngles[gi] + (band.ringRef * 0.24);
        const gx = Math.cos(ga) * band.r;
        const gy = Math.sin(ga) * band.r;

        const axleCap = new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8);
        axleCap.rotateX(Math.PI * 0.5);
        axleCap.translate(gx, gy, band.z + 0.02);
        staticBrassAccents.push(axleCap);

        this.planetaryGears.push({ x: gx, y: gy, z: band.z, scale: band.scale, ringIdx: band.ringRef, ratio: band.ratio });
      }
    }
    this.astrolabeRoot.add(this.planetaryGearInst);

    const mBrassAccents = mergeGeometries(staticBrassAccents, false);
    for (const g of staticBrassAccents) g.dispose();
    const mAmKeys = mergeGeometries(amethystKeyGeos, false);
    for (const g of amethystKeyGeos) g.dispose();
    const mCyKeys = mergeGeometries(cyanKeyGeos, false);
    for (const g of cyanKeyGeos) g.dispose();
    this._nonReflGroup.add(
      new THREE.Mesh(mBrassAccents, this.mats.tarnishedBrass),
      new THREE.Mesh(mAmKeys, this.mats.amethystGem),
      new THREE.Mesh(mCyKeys, this.mats.cyanGem)
    );
    this.astrolabeRoot.add(this._nonReflGroup);

    // 4. Master 12 O'Clock Locking Caliper Spine, Alignment Laser & 3 Sliding Brass Deadbolts!
    const masterBridge = new THREE.Group();
    this.masterBridge = masterBridge;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.56, 0.34), this.mats.tarnishedBrass);
    spine.position.set(0, 2.78, 0.18);
    this.masterCrystalMat = new THREE.MeshPhysicalMaterial({
      color: '#a5f3fc',
      emissive: '#06b6d4',
      emissiveIntensity: 1.65,
      roughness: 0.08,
      clearcoat: 1.0,
    });
    this.masterCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.21, 0), this.masterCrystalMat);
    this.masterCrystal.scale.set(0.75, 1.35, 0.65);
    this.masterCrystal.position.set(0, 2.74, 0.36);

    // Alignment Laser Hairline spanning across all 3 rings at 12 o'clock (`x = 0, y = 0.88..2.62`)
    this.alignLaserMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.alignLaser = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 1.82), this.alignLaserMat);
    this.alignLaser.position.set(0, 1.78, 0.30);
    masterBridge.add(spine, this.masterCrystal, this.alignLaser);

    // Instanced 3D Sliding Brass Locking Plunger Bolts (2 draw calls total instead of 6!)
    this.lockBoltShaftInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.11, 0.32, 0.12),
      this.mats.tarnishedBrass,
      3
    );
    const tipGemGeo = new THREE.OctahedronGeometry(0.065, 0);
    tipGemGeo.translate(0, -0.15, 0.05);
    this.lockBoltGemInst = new THREE.InstancedMesh(tipGemGeo, this.mats.cyanGem, 3);
    this.lockBoltShaftInst.frustumCulled = false;
    this.lockBoltGemInst.frustumCulled = false;
    this.lockBolts = RING_RADII.map((rad, idx) => ({
      restY: rad + 0.28,
      lockY: rad + 0.03,
      z: RING_Z[idx] + 0.12,
    }));
    masterBridge.add(this.lockBoltShaftInst, this.lockBoltGemInst);
    this.astrolabeRoot.add(masterBridge);

    // 5. The 3 Concentric 3D Gleaming Burnished-Gold & Faceted-Amethyst Astrolabe Tumbler Rings!
    const defaultTols = [0.38, 0.35, 0.32];
    const tickGeo = new THREE.BoxGeometry(0.042, 0.12, 0.052);
    const caliperJawGeo = new THREE.BoxGeometry(0.095, 0.30, 0.26);
    const caliperGemGeo = new THREE.OctahedronGeometry(0.105, 0);

    this.ringObjs = RING_RADII.map((rad, rIdx) => {
      const rg = new THREE.Group();
      rg.position.z = RING_Z[rIdx];

      const chassisMat = new THREE.MeshPhysicalMaterial({
        color: '#fbbf24',
        normalMap: this.brassMaps.normalMap,
        normalScale: new THREE.Vector2(0.92, 0.92),
        roughnessMap: this.brassMaps.roughnessMap,
        roughness: 0.14,
        metalness: 0.95,
        clearcoat: 0.45,
        clearcoatRoughness: 0.12,
      });

      const runeGlowMat = new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        emissive: '#0284c7',
        emissiveIntensity: 1.05,
        roughness: 0.15,
      });

      const notchMat = new THREE.MeshPhysicalMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 1.55,
        roughness: 0.08,
        metalness: 0.25,
        clearcoat: 1.0,
      });

      // Multi-chamfered 3D burnished-gold chassis + ticks + caliper jaws merged into 1 single mesh per ring!
      const chassisParts = [buildBeveledAstrolabeChassisGeo(rad, 0.18, 0.17, 84 - rIdx * 12)];
      const obsidianMesh = new THREE.Mesh(
        buildObsidianInlayBandGeo(rad, 0.092, 0.056, 84 - rIdx * 12),
        this.mats.carvedObsidian
      );
      rg.add(obsidianMesh);

      const tickCount = 28 - rIdx * 4;
      const notchSpan = defaultTols[rIdx] * 2;
      const runeStudGeos = [];
      const calGems = [];

      for (let t = 0; t < tickCount; t++) {
        const a = (t / tickCount) * TAU;
        if (Math.abs(wrapAngle(a - Math.PI * 0.5)) < notchSpan * 0.58) continue;

        const tk = tickGeo.clone();
        tk.rotateZ(a + Math.PI * 0.5);
        tk.translate(Math.cos(a) * (rad + 0.135), Math.sin(a) * (rad + 0.135), 0.08);
        chassisParts.push(tk);

        // Crown faceted Amethyst PBR cabochons at cardinal/ordinal nodes around every gold ring!
        if (t % 4 === 0) {
          const studGem = new THREE.OctahedronGeometry(0.068, 0);
          studGem.scale(0.85, 1.18, 0.68);
          studGem.rotateZ(a + Math.PI * 0.5);
          studGem.translate(Math.cos(a) * (rad + 0.01), Math.sin(a) * (rad + 0.01), 0.095);
          calGems.push(studGem);
        } else if (t % 2 === 0) {
          const rBar = new THREE.BoxGeometry(0.048, 0.095, 0.024);
          rBar.rotateZ(a + Math.PI * 0.25);
          rBar.translate(Math.cos(a) * rad, Math.sin(a) * rad, 0.062);
          runeStudGeos.push(rBar);
        }
      }
      const notchMesh = new THREE.Mesh(
        buildBeveledNotchArcGeo(rad, 0.138, 0.11, notchSpan),
        notchMat
      );
      rg.add(notchMesh);

      for (const endSign of [-1, 1]) {
        const ca = Math.PI * 0.5 + endSign * (notchSpan * 0.5);
        const cx = Math.cos(ca) * rad;
        const cy = Math.sin(ca) * rad;

        const jawG = caliperJawGeo.clone();
        jawG.rotateZ(ca + Math.PI * 0.5);
        jawG.translate(cx, cy, 0.065);
        chassisParts.push(jawG);

        const cGemG = caliperGemGeo.clone();
        cGemG.scale(0.82, 1.28, 0.78);
        cGemG.rotateZ(ca + Math.PI * 0.5);
        cGemG.translate(cx, cy, 0.20);
        calGems.push(cGemG);
      }
      const mChassis = mergeGeometries(chassisParts, false);
      for (const g of chassisParts) g.dispose();
      rg.add(new THREE.Mesh(mChassis, chassisMat));

      if (runeStudGeos.length) {
        const mr = mergeGeometries(runeStudGeos, false);
        for (const g of runeStudGeos) g.dispose();
        rg.add(new THREE.Mesh(mr, runeGlowMat));
      }
      let calGemMesh = null;
      if (calGems.length) {
        const mg = mergeGeometries(calGems, false);
        for (const g of calGems) g.dispose();
        calGemMesh = new THREE.Mesh(mg, this.mats.amethystGem);
        rg.add(calGemMesh);
      }

      rg.userData = { chassisMat, runeGlowMat, notchMat, rad, obsidianMesh, calGemMesh };
      this.astrolabeRoot.add(rg);
      return rg;
    });

    // 6. Multi-Faceted Pulsing Star Core Inside a Tri-Axis Spinning Gimbal Cage (`r < 0.80`)!
    this.starCoreGroup = new THREE.Group();
    this.starCoreGroup.position.z = 0.24;

    this.starInnerMat = new THREE.MeshPhysicalMaterial({
      color: '#fde047',
      emissive: '#d97706',
      emissiveIntensity: 0.96,
      roughness: 0.08,
      metalness: 0.35,
      clearcoat: 1.0,
      flatShading: true,
    });
    this.starShellMat = new THREE.MeshPhysicalMaterial({
      color: '#67e8f9',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.42,
      roughness: 0.05,
      clearcoat: 1.0,
      depthWrite: false,
    });

    // 8-pointed compound crystalline Star Core (merged octahedra + refractive shell -> 2 draw calls!)
    const starCrystalGrp = new THREE.Group();
    const octG1 = new THREE.OctahedronGeometry(0.32, 0);
    const octG2 = new THREE.OctahedronGeometry(0.30, 0);
    octG2.rotateX(Math.PI * 0.25);
    octG2.rotateY(Math.PI * 0.25);
    const mStarOct = mergeGeometries([octG1, octG2], false);
    octG1.dispose();
    octG2.dispose();
    const starOctMesh = new THREE.Mesh(mStarOct, this.starInnerMat);
    const crystalShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), this.starShellMat);
    const coreHalo = new THREE.Sprite(this.mats.coreHaloSprite);
    coreHalo.scale.set(1.55, 1.55, 1);
    starCrystalGrp.add(starOctMesh, crystalShell, coreHalo);

    // 3 Concentric Beveled Armillary Gimbal Rings
    const gimbalOuter = new THREE.Mesh(
      buildBeveledAstrolabeChassisGeo(0.72, 0.042, 0.065, 48),
      this.mats.tarnishedBrass
    );
    const gimbalMid = new THREE.Mesh(
      buildBeveledAstrolabeChassisGeo(0.58, 0.036, 0.055, 44),
      this.mats.pinionBronze
    );
    const gimbalInner = new THREE.Mesh(
      new THREE.TorusGeometry(0.47, 0.022, 8, 36),
      this.mats.amethystGem
    );

    this.starCoreGroup.add(starCrystalGrp, gimbalOuter, gimbalMid, gimbalInner);
    this.starCoreGroup.userData = { starCrystalGrp, crystalShell, coreHalo, gimbalOuter, gimbalMid, gimbalInner };
    this.astrolabeRoot.add(this.starCoreGroup);

    // 7. Crackling Volumetric Cyan & Molten-Gold Arcane Energy Arcs Locking into the Star Core (1 single draw call!)
    const arcGeos = [];
    // 8 radial plasma lightning ribbons spanning from outer ring (`r = 2.28`) straight into the Star Core (`r = 0.36`)!
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + (k % 2 === 0 ? 0.0 : 0.14);
      const rg = new THREE.PlaneGeometry(0.32, 1.96, 1, 20);
      // Shift UV.y = 0 at core (r = 0.34), UV.y = 1 at outer ring (r = 2.30)
      rg.translate(0, 1.32, 0.24);
      rg.rotateZ(a - Math.PI * 0.5);
      arcGeos.push(rg);
    }
    // 3 concentric arcane corona ribbon rings around Star Core & inner tumblers (`r = 0.84, 1.36, 1.93` with proper radial strip UVs!)
    for (const cr of [0.84, 1.36, 1.93]) {
      const rIn = cr - 0.10;
      const rOut = cr + 0.10;
      const ringBand = new THREE.RingGeometry(rIn, rOut, 56, 1);
      const posAttr = ringBand.attributes.position;
      const uvAttr = ringBand.attributes.uv;
      for (let vi = 0; vi < posAttr.count; vi++) {
        const vx = posAttr.getX(vi);
        const vy = posAttr.getY(vi);
        const vr = Math.hypot(vx, vy);
        const va = (Math.atan2(vy, vx) + Math.PI) / TAU;
        uvAttr.setXY(vi, clamp((vr - rIn) / (rOut - rIn), 0, 1), va * 4.0);
      }
      ringBand.translate(0, 0, 0.21);
      arcGeos.push(ringBand);
    }
    const mArcaneWeb = mergeGeometries(arcGeos, false);
    for (const g of arcGeos) g.dispose();

    this.arcaneUniforms = {
      uTime: { value: 0 },
      uLocked: { value: 0 },
      uActiveRad: { value: 2.22 },
      uSweet: { value: 0 },
      uWon: { value: 0 },
      uFailed: { value: 0 },
    };
    const arcaneMat = new THREE.ShaderMaterial({
      uniforms: this.arcaneUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vLocalPos;
        void main() {
          vUv = uv;
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uLocked;
        uniform float uActiveRad;
        uniform float uSweet;
        uniform float uWon;
        uniform float uFailed;
        varying vec2 vUv;
        varying vec3 vLocalPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          float r = length(vLocalPos.xy);
          float ang = atan(vLocalPos.y, vLocalPos.x);
          float t = uTime * 9.5;

          // Jagged high-voltage Tesla arc displacement across ribbon width (vUv.x = 0..1)
          float jitter1 = (vnoise(vec2(r * 7.5 - t * 1.4, ang * 4.0 + floor(uTime * 16.0))) - 0.5) * 0.62;
          float jitter2 = (vnoise(vec2(r * 19.0 + t * 2.2, ang * 9.0 - t * 0.7)) - 0.5) * 0.32;
          float centerDist = abs((vUv.x - 0.5) * 2.0 + jitter1 + jitter2);

          float boltCore = exp(-centerDist * centerDist * 54.0);
          float boltHalo = exp(-centerDist * centerDist * 10.0) * 0.22;
          float flicker = 0.55 + 0.45 * sin(uTime * 29.0 + r * 6.0 + ang * 3.0);

          // Radial energy reach: Core corona always crackles (r < 1.05); locked stages ignite inward (2.28 -> 1.64 -> 1.08 -> Core)!
          float coreReach = smoothstep(1.25, 0.46, r) * 0.65;
          float lockOuter = step(0.5, uLocked) * smoothstep(2.35, 1.55, r) * smoothstep(0.38, 0.56, r);
          float lockMid = step(1.5, uLocked) * smoothstep(1.75, 0.95, r) * smoothstep(0.38, 0.56, r);
          float activeRingHalo = exp(-pow((r - uActiveRad) * 4.6, 2.0)) * (0.45 + uSweet * 0.50);
          float energize = clamp(coreReach + lockOuter * 0.80 + lockMid * 0.85 + activeRingHalo + uWon * 0.62, 0.0, 1.12);

          float endFade = smoothstep(0.36, 0.50, r) * smoothstep(2.34, 2.12, r);
          float alpha = clamp((boltCore + boltHalo) * flicker * energize * endFade, 0.0, 0.92);

          // Color: electric cryo-cyan around active ring & core -> blazing molten-gold along locked conduits!
          float goldMix = clamp(step(0.5, uLocked) * smoothstep(1.45, 2.25, r) + step(1.5, uLocked) * smoothstep(0.85, 1.65, r) + uWon, 0.0, 1.0);
          vec3 col = mix(vec3(0.22, 0.92, 1.0), vec3(1.0, 0.84, 0.25), goldMix);
          col = mix(col, vec3(1.0, 0.22, 0.28), uFailed);
          col = mix(col, vec3(1.0, 0.99, 0.92), boltCore * 0.65);

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.arcaneArcsMesh = new THREE.Mesh(mArcaneWeb, arcaneMat);
    this.astrolabeRoot.add(this.arcaneArcsMesh);

    this.scene.add(this.astrolabeRoot);
  }

  _initAtmosphericMotesAndSparks() {
    // 140 Ambient Bioluminescent Sanctum Motes & Rising Brazier Embers (zero per-frame alloc!)
    const rng = mulberry32(99103);
    const mGeo = new THREE.BufferGeometry();
    this._motePos = new Float32Array(MAX_MOTES * 3);
    this._moteCol = new Float32Array(MAX_MOTES * 3);
    this._moteSize = new Float32Array(MAX_MOTES);
    this._moteSeeds = Array.from({ length: MAX_MOTES }, (_, i) => {
      const isEmber = i < 92;
      const side = i % 2 === 0 ? -1 : 1;
      return {
        isEmber,
        baseX: isEmber ? side * 2.22 + (rng() - 0.5) * 0.30 : (rng() - 0.5) * 6.4,
        baseY: isEmber ? -1.52 : -2.4 + rng() * 6.8,
        baseZ: isEmber ? 0.68 + (rng() - 0.5) * 0.26 : -0.4 + rng() * 2.8,
        phase: rng() * TAU,
        spd: isEmber ? 0.55 + rng() * 0.85 : 0.35 + rng() * 0.65,
        size: isEmber ? 0.08 + rng() * 0.10 : 0.08 + rng() * 0.11,
      };
    });
    for (let i = 0; i < MAX_MOTES; i++) {
      const s = this._moteSeeds[i];
      if (s.isEmber) {
        const hot = i % 3 === 0;
        this._moteCol[i * 3] = 1.0;
        this._moteCol[i * 3 + 1] = hot ? 0.84 : 0.52;
        this._moteCol[i * 3 + 2] = hot ? 0.38 : 0.10;
      } else if (i % 3 === 0) {
        this._moteCol[i * 3] = 0.37;
        this._moteCol[i * 3 + 1] = 0.98;
        this._moteCol[i * 3 + 2] = 0.91;
      } else {
        this._moteCol[i * 3] = 0.78;
        this._moteCol[i * 3 + 1] = 0.88;
        this._moteCol[i * 3 + 2] = 1.0;
      }
      this._moteSize[i] = s.size;
    }
    mGeo.setAttribute('position', new THREE.BufferAttribute(this._motePos, 3));
    mGeo.setAttribute('aColor', new THREE.BufferAttribute(this._moteCol, 3));
    mGeo.setAttribute('aSize', new THREE.BufferAttribute(this._moteSize, 1));

    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.softDotTex }, uPR: { value: this.dpr } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        uniform float uPR;
        varying vec3 vCol;
        void main() {
          vCol = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPR * (240.0 / max(0.5, -mv.z)), 1.0, 48.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vCol;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vCol * t.rgb, t.a * 0.72);
        }
      `,
    });
    this.motePoints = new THREE.Points(mGeo, this.moteMat);
    this.motePoints.frustumCulled = false;
    this.scene.add(this.motePoints);

    // 160-Spark Burst Pool (fires molten-gold sparks when a ring locks or crimson sparks on strike!)
    this._sparkData = Array.from({ length: MAX_SPARKS }, () => ({
      x: 0, y: -20, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 0.8, b: 0.3, life: 0, maxLife: 1,
    }));
    this._sparkCursor = 0;
    const spGeo = new THREE.BufferGeometry();
    this._spPos = new Float32Array(MAX_SPARKS * 3);
    this._spCol = new Float32Array(MAX_SPARKS * 3);
    this._spAlpha = new Float32Array(MAX_SPARKS);
    spGeo.setAttribute('position', new THREE.BufferAttribute(this._spPos, 3));
    spGeo.setAttribute('aColor', new THREE.BufferAttribute(this._spCol, 3));
    spGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this._spAlpha, 1));

    this.sparkMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.softDotTex }, uPR: { value: this.dpr } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aAlpha;
        uniform float uPR;
        varying vec3 vCol;
        varying float vAlpha;
        void main() {
          vCol = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(0.16 * uPR * (250.0 / max(0.5, -mv.z)), 1.0, 52.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vCol;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vCol * t.rgb, t.a * vAlpha);
        }
      `,
    });
    this.sparkPoints = new THREE.Points(spGeo, this.sparkMat);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);
  }

  _emitVaultBurst(radius, rCol, gCol, bCol, count = 28) {
    for (let i = 0; i < count; i++) {
      const s = this._sparkData[this._sparkCursor];
      this._sparkCursor = (this._sparkCursor + 1) % MAX_SPARKS;
      const a = Math.PI * 0.5 + (((i * 29) % 100) / 100 - 0.5) * 1.1;
      const spd = 1.6 + ((i * 17) % 10) * 0.34;
      s.x = Math.cos(a) * radius;
      s.y = Math.sin(a) * radius;
      s.z = 0.28;
      s.vx = Math.cos(a) * spd + (((i * 43) % 10) - 5) * 0.22;
      s.vy = Math.sin(a) * spd * 0.8 + 0.8;
      s.vz = 0.8 + ((i * 13) % 10) * 0.18;
      s.r = rCol;
      s.g = gCol;
      s.b = bCol;
      s.maxLife = 0.55 + ((i * 19) % 10) * 0.04;
      s.life = s.maxLife;
    }
  }

  _initStrikeCrystalsAndOverlay() {
    // Up to 5 Faceted 3D Strike Resonator Crystals dynamically anchored above `#action-prompt`
    this.strikeBezelInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.165, 0.02, 6, 20),
      this.mats.tarnishedBrass,
      MAX_STRIKE_GEMS
    );
    this.strikeBezelInst.frustumCulled = false;
    this.strikeBezelInst.count = 0;
    this.scene.add(this.strikeBezelInst);

    this.strikeGems = Array.from({ length: MAX_STRIKE_GEMS }, () => {
      const grp = new THREE.Group();
      const mat = new THREE.MeshPhysicalMaterial({
        color: '#5efce8',
        emissive: '#0891b2',
        emissiveIntensity: 1.15,
        roughness: 0.1,
        metalness: 0.2,
        clearcoat: 1.0,
      });
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.145, 0), mat);
      crystal.scale.set(0.78, 1.28, 0.78);
      grp.add(crystal);
      grp.userData = { mat, crystal };
      this.scene.add(grp);
      return grp;
    });

    // Non-Overlapping Vault Status Header Card below `#hud` (`y >= 98px`, zero emojis!)
    this._hudCanvas = makeCanvas(512, 72);
    this._hudTex = this._hudCanvas
      ? new THREE.CanvasTexture(this._hudCanvas)
      : createFallbackDataTex(0, 0, 0, 0, true);
    if (this._hudCanvas) this._hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this._hudTex, transparent: true, depthTest: false, depthWrite: false })
    );
    this.overlay.add(this.hudMesh);
    this._hudLastKey = '';

    // Cached Popup Pool
    this._popCache = new Map();
    this._popFrame = 0;
    const popGeo = new THREE.PlaneGeometry(1, 1);
    this.popPool = Array.from({ length: MAX_POP }, () => {
      const m = new THREE.Mesh(
        popGeo,
        new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false })
      );
      m.visible = false;
      this.overlay.add(m);
      return m;
    });
  }

  // ----------------------------------------------------------------------------------
  // Public Lifecycle & Configuration Methods
  // ----------------------------------------------------------------------------------

  resize(w, h, dpr = 1) {
    if (!w || !h) return;
    this.width = w;
    this.height = h;
    this.dpr = clamp(Number(dpr) || 1, 1, 2);

    this.camera.aspect = Math.max(0.35, w / h);
    this.camera.updateProjectionMatrix();

    this.oCam.left = 0;
    this.oCam.right = w;
    this.oCam.top = 0;
    this.oCam.bottom = -h;
    this.oCam.updateProjectionMatrix();

    const reflScale = 0.28;
    const rw = Math.min(224, Math.max(64, Math.floor(w * this.dpr * reflScale)));
    const rh = Math.min(224, Math.max(64, Math.floor(h * this.dpr * reflScale)));
    this.reflRT.setSize(rw, rh);

    this.moteMat.uniforms.uPR.value = this.dpr;
    this.sparkMat.uniforms.uPR.value = this.dpr;
    this._hudLastKey = '';
  }

  setSkin(skinId) {
    if (skinId) this.skinId = skinId;
  }

  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    this.era = next;
    const isOrig = next === 'original';
    this.exposure = isOrig ? 1.08 : 1.02;
    this.scene.environmentIntensity = isOrig ? 0.78 : 0.68;
    if (this.moonBeamA) this.moonBeamA.visible = !isOrig;
    if (this.moonBeamB) this.moonBeamB.visible = !isOrig;
    this.scene.background.set(isOrig ? '#060d26' : '#060914');
    this.scene.fog.color.set(isOrig ? '#081232' : '#070b18');
  }

  prewarm() {
    if (!this.webgl) return;
    try {
      this.webgl.compile(this.scene, this.camera);
    } catch {
      // Ignore headless compile quirks
    }
  }

  // ----------------------------------------------------------------------------------
  // Per-Frame Update & Render (ZERO per-frame allocations!)
  // ----------------------------------------------------------------------------------

  _updateOverlayHud(vault, lockedCount, inSweetSpot) {
    if (!this._hudCanvas) return;
    const totalRings = Math.max(1, vault.rings?.length || 3);
    const status = vault.status || 'playing';
    const remSec = Math.max(0, vault.timer || 0);
    const secTenths = Math.ceil(remSec * 10);
    const hudW = Math.min(352, Math.max(236, Math.floor(this.width - 28)));
    const hudH = Math.round(hudW * (72 / 512));
    const sweetFlag = inSweetSpot && status === 'playing' ? 1 : 0;
    const key = `${hudW}|${lockedCount}|${status}|${secTenths}|${sweetFlag}`;

    if (key !== this._hudLastKey) {
      this._hudLastKey = key;
      const ctx = this._hudCanvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 72);

      const borderCol =
        status === 'won'
          ? 'rgba(250, 204, 21, 0.85)'
          : status === 'failed'
          ? 'rgba(239, 68, 68, 0.85)'
          : sweetFlag
          ? 'rgba(94, 252, 232, 0.9)'
          : 'rgba(198, 143, 57, 0.45)';

      ctx.fillStyle = 'rgba(7, 11, 24, 0.78)';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(8, 6, 496, 60, 15);
      ctx.fill();
      ctx.stroke();

      ctx.font = '800 15px Orbitron, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = status === 'won' ? '#fde047' : status === 'failed' ? '#f87171' : '#e2e8f0';
      const title =
        status === 'won'
          ? 'STAR CORE UNLOCKED'
          : status === 'failed'
          ? 'ASTROLABE SEALED'
          : sweetFlag
          ? 'ALIGNED - LOCK NOW'
          : `ASTROLABE RING ${Math.min(totalRings, lockedCount + 1)}/${totalRings}`;
      ctx.fillText(title, 26, 26);

      // 3 Ring Lock Pip Diamonds + Timer Bar
      for (let i = 0; i < totalRings; i++) {
        const px = 34 + i * 26;
        const py = 49;
        const locked = i < lockedCount || status === 'won';
        ctx.fillStyle = locked ? '#5efce8' : i === lockedCount && status === 'playing' ? '#fde047' : 'rgba(148,163,184,0.3)';
        ctx.beginPath();
        ctx.moveTo(px, py - 7);
        ctx.lineTo(px + 7, py);
        ctx.lineTo(px, py + 7);
        ctx.lineTo(px - 7, py);
        ctx.closePath();
        ctx.fill();
      }

      const dur = Math.max(1, vault.duration || 12);
      const frac = clamp(remSec / dur, 0, 1);
      ctx.fillStyle = 'rgba(30, 41, 68, 0.88)';
      ctx.beginPath();
      ctx.roundRect(122, 44, 268, 10, 5);
      ctx.fill();

      ctx.fillStyle = remSec < 3.0 && status === 'playing' ? '#ef4444' : '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(122, 44, Math.max(8, Math.round(268 * frac)), 10, 5);
      ctx.fill();

      ctx.font = '900 20px Orbitron, "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = remSec < 3.0 && status === 'playing' ? '#f87171' : '#fef08a';
      ctx.fillText(`${remSec.toFixed(1)}s`, 486, 37);

      this._hudTex.needsUpdate = true;
    }

    this.hudMesh.scale.set(hudW, hudH, 1);
    this.hudMesh.position.set(this.width * 0.5, -(HUD_TOP_OFFSET + hudH * 0.5), 0);
  }

  _popupTex(text, color) {
    const key = `${text}|${color}`;
    let e = this._popCache.get(key);
    if (e) {
      e.used = this._popFrame;
      return e;
    }
    const c = makeCanvas(256, 60);
    if (!c) return { tex: this.softDotTex, aspect: 3, used: this._popFrame, text, color };
    const ctx = c.getContext('2d');
    const font = '900 36px Orbitron, "Segoe UI", sans-serif';
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    c.width = Math.max(96, tw + 34);
    c.height = 58;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(4, 8, 20, 0.92)';
    ctx.strokeText(text, c.width * 0.5, 29);
    ctx.fillStyle = color || '#fde047';
    ctx.fillText(text, c.width * 0.5, 29);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    e = { tex, aspect: c.width / c.height, used: this._popFrame, text, color };
    this._popCache.set(key, e);
    if (this._popCache.size > 32) {
      for (const [k, v] of this._popCache) {
        if (v.used < this._popFrame - 2) {
          v.tex.dispose();
          v.dead = true;
          this._popCache.delete(k);
          if (this._popCache.size <= 24) break;
        }
      }
    }
    return e;
  }

  _syncPopups(popups) {
    this._popFrame++;
    const pn = Array.isArray(popups) ? Math.min(popups.length, MAX_POP) : 0;
    for (let i = 0; i < MAX_POP; i++) {
      const m = this.popPool[i];
      if (i >= pn) {
        m.visible = false;
        continue;
      }
      const pop = popups[i];
      if (pop.x == null || pop.y == null || !pop.text) {
        m.visible = false;
        continue;
      }
      let e = pop.__vaultTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#fde047')) {
        e = this._popupTex(pop.text, pop.color || '#fde047');
        pop.__vaultTex = e;
      } else {
        e.used = this._popFrame;
      }
      if (m.material.map !== e.tex) {
        m.material.map = e.tex;
        m.material.needsUpdate = true;
      }
      const t = 1 - clamp((pop.life || 0) / Math.max(0.001, pop.maxLife || 1), 0, 1);
      const scalePop = t < 0.16 ? easeOutBack(t / 0.16) * 1.12 : 1.12 - Math.min(0.12, (t - 0.16) * 0.9);
      const hgt = 22 * Math.max(0.1, scalePop);
      const wid = hgt * e.aspect;
      const px = clamp(pop.x, wid * 0.5 + 6, this.width - wid * 0.5 - 6);
      const py = -(pop.y - t * 26);
      m.scale.set(wid, hgt, 1);
      m.position.set(px, py, 1);
      m.material.opacity = clamp(1 - t * t, 0, 1);
      m.visible = true;
    }
  }

  render(stateOrVault, ctx = {}) {
    const gl = this.webgl;
    if (!gl || !stateOrVault) return;

    const hasOuter = Boolean(stateOrVault.vault);
    const vault = hasOuter ? stateOrVault.vault : stateOrVault;
    const outer = hasOuter ? stateOrVault : ctx;
    if (!vault) return;

    const reqEra = outer.era || ctx.era;
    if (reqEra && reqEra !== this.era) this.setEra(reqEra);

    const time = Number(outer.time ?? ctx.time ?? 0);
    const rawDt = ctx.dt ?? (this._lastTime > 0 ? time - this._lastTime : 0.016);
    const dt = clamp(rawDt > 0 ? rawDt : 0.016, 0.001, 0.05);
    this._lastTime = time;

    const shake = getShakeXY(outer.shake ?? ctx.shake, time, this._shake);

    const rings = vault.rings || [];
    let lockedCount = 0;
    for (let i = 0; i < rings.length; i++) {
      if (rings[i]?.locked) lockedCount++;
    }
    const strikes = vault.strikes || 0;
    const maxStrikes = clamp(vault.maxStrikes || 3, 1, MAX_STRIKE_GEMS);
    const status = vault.status || 'playing';

    // Reset state trackers cleanly when a new vault session starts
    if (lockedCount < this._lastLockedCount && lockedCount === 0) {
      this._lastLockedCount = 0;
      this._lastStrikes = 0;
    }

    // Trigger molten-gold spark bursts + expanding subterranean water ripples on ring lock or strike!
    if (lockedCount > this._lastLockedCount) {
      const justIdx = Math.min(2, lockedCount - 1);
      this._emitVaultBurst(RING_RADII[justIdx], 1.0, 0.85, 0.32, status === 'won' ? 48 : 28);
      this._addWaterRipple(0, 1.2, status === 'won' ? 1.5 : 1.0, time);
      this._lastLockedCount = lockedCount;
    }
    if (strikes > this._lastStrikes) {
      const actIdx = clamp(vault.activeRing || 0, 0, 2);
      this._emitVaultBurst(RING_RADII[actIdx], 1.0, 0.25, 0.3, 24);
      this._addWaterRipple(0, 1.4, 0.9, time);
      this._strikeFlash = 1.0;
      this._lastStrikes = strikes;
    } else if (strikes === 0) {
      this._lastStrikes = 0;
    }
    this._strikeFlash = Math.max(0, this._strikeFlash - dt * 3.8);

    // 1. Aspect-Safe Dramatic Camera Push-In (`0 -> 1 -> 2 -> won`) + Subtle Orbital Parallax!
    // Ensures 100% horizontal visibility of the outer housing + twin fire braziers on 430x932 portrait
    // AND rich vertical framing including the rippling subterranean water pool!
    const tanHalf = Math.tan(this.camera.fov * 0.5 * DEG);
    const aspect = Math.max(0.38, this.camera.aspect);
    const reqHalfW =
      status === 'won'
        ? 1.98
        : lockedCount === 0
        ? 3.24
        : lockedCount === 1
        ? 2.86
        : 2.34;
    const reqHalfH =
      status === 'won'
        ? 2.28
        : lockedCount === 0
        ? 3.65
        : lockedCount === 1
        ? 3.18
        : 2.70;
    const targetZ = Math.max(reqHalfH / tanHalf, reqHalfW / (tanHalf * aspect));
    const targetY = status === 'won' ? 0.12 : -0.18 + lockedCount * 0.16;

    if (!this._camInitDone) {
      this._camZ = targetZ;
      this._camY = targetY;
      this._camInitDone = true;
    } else {
      this._camZ += (targetZ - this._camZ) * Math.min(1, dt * 6.2);
      this._camY += (targetY - this._camY) * Math.min(1, dt * 6.2);
    }

    const orbitX = Math.sin(time * 0.72) * (0.14 + lockedCount * 0.06);
    const breatheY = Math.cos(time * 0.58) * 0.05;
    this.camera.position.set(orbitX + shake.x, this._camY + breatheY + shake.y, this._camZ);
    this.camera.lookAt(0, this._camY * 0.35 - 0.12, 0);
    this.camera.updateMatrixWorld();

    // 2. Animate Flickering `#ffaa33` Volumetric Fire Sconces (`sanctum_brazier`) & Water Uniforms
    const flickL = 0.88 + 0.12 * Math.sin(time * 13.7) + 0.07 * Math.cos(time * 23.1);
    const flickR = 0.88 + 0.12 * Math.sin(time * 14.9 + 1.7) + 0.07 * Math.cos(time * 21.3 + 0.8);
    this.sconceLightL.intensity = 2.85 * flickL;
    this.sconceLightR.intensity = 2.85 * flickR;
    if (this.fireUniforms) this.fireUniforms.uTime.value = time;

    for (let i = 0; i < this.brazierSlots.length; i++) {
      const sl = this.brazierSlots[i];
      const fl = i === 0 ? flickL : flickR;
      sl.fMain.scale.set(0.96 + (fl - 0.88) * 0.45, 0.92 + fl * 0.18, 0.96);
      sl.halo.scale.setScalar(1.80 + fl * 0.28);
    }

    this.waterUniforms.uTime.value = time;

    // 3. Sync 3 Concentric Astrolabe Rings, Meshing Planetary Gears & Sliding Brass Deadbolts!
    let activeInSweetSpot = false;
    for (let i = 0; i < this.ringObjs.length; i++) {
      const ro = this.ringObjs[i];
      const rState = rings[i];
      if (!rState) continue;

      const delta = wrapAngle((rState.angle || 0) - (rState.targetAngle || 0));
      ro.rotation.z = delta;

      const tol = rState.tolerance || 0.35;
      const isActive = i === vault.activeRing && status === 'playing';
      const inZone = Math.abs(delta) <= tol;
      if (isActive && inZone) activeInSweetSpot = true;

      const ud = ro.userData;
      if (status === 'failed') {
        ud.chassisMat.color.copy(this._colBrassFailed);
        ud.notchMat.color.copy(this._colNotchFailed);
        ud.notchMat.emissive.copy(this._colEmFailed);
        ud.notchMat.emissiveIntensity = 1.25;
        ud.runeGlowMat.color.copy(this._colNotchFailed);
        ud.runeGlowMat.emissive.copy(this._colEmFailed);
        ud.runeGlowMat.emissiveIntensity = 0.9;
      } else if (rState.locked || status === 'won') {
        ud.chassisMat.color.copy(this._colBrassLocked);
        ud.notchMat.color.copy(this._colNotchLocked);
        ud.notchMat.emissive.copy(this._colEmLocked);
        ud.notchMat.emissiveIntensity = 1.08;
        ud.runeGlowMat.color.copy(this._colGold);
        ud.runeGlowMat.emissive.copy(this._colGoldEm);
        ud.runeGlowMat.emissiveIntensity = 0.82 + 0.15 * Math.sin(time * 6 - i);
      } else if (isActive) {
        ud.chassisMat.color.copy(this._colBrassActive);
        if (inZone) {
          ud.notchMat.color.copy(this._colNotchSweet);
          ud.notchMat.emissive.copy(this._colEmSweet);
          ud.notchMat.emissiveIntensity = 1.45;
          ud.runeGlowMat.color.copy(this._colCyan);
          ud.runeGlowMat.emissive.copy(this._colCyanEm);
          ud.runeGlowMat.emissiveIntensity = 0.98;
        } else {
          ud.notchMat.color.copy(this._colNotchActive);
          ud.notchMat.emissive.copy(this._colEmActive);
          ud.notchMat.emissiveIntensity = 1.05;
          ud.runeGlowMat.color.copy(this._colAmethyst);
          ud.runeGlowMat.emissive.copy(this._colAmethystEm);
          ud.runeGlowMat.emissiveIntensity = 0.68;
        }
      } else {
        ud.chassisMat.color.copy(this._colBrassDormant);
        ud.notchMat.color.copy(this._colNotchDormant);
        ud.notchMat.emissive.copy(this._colEmDormant);
        ud.notchMat.emissiveIntensity = 0.35;
        ud.runeGlowMat.color.copy(this._colAmethyst);
        ud.runeGlowMat.emissive.copy(this._colAmethystEm);
        ud.runeGlowMat.emissiveIntensity = 0.38;
      }

      // Animate mechanical brass deadbolt plunger clamping onto locked rings!
      const bolt = this.lockBolts[i];
      const wantBolt = rState.locked || status === 'won' ? 1 : 0;
      this._lockBoltExtend[i] += (wantBolt - this._lockBoltExtend[i]) * Math.min(1, dt * 14);
      const by = lerp(bolt.restY, bolt.lockY, this._lockBoltExtend[i]);
      this._gearDummy.position.set(0, by, bolt.z);
      this._gearDummy.rotation.set(0, 0, 0);
      this._gearDummy.scale.setScalar(1);
      this._gearDummy.updateMatrix();
      this.lockBoltShaftInst.setMatrixAt(i, this._gearDummy.matrix);
      this.lockBoltGemInst.setMatrixAt(i, this._gearDummy.matrix);
    }
    this.lockBoltShaftInst.instanceMatrix.needsUpdate = true;
    this.lockBoltGemInst.instanceMatrix.needsUpdate = true;

    // Kinematically mesh all 12 planetary pinion gears via 1 single InstancedMesh!
    const gd = this._gearDummy;
    for (let g = 0; g < this.planetaryGears.length; g++) {
      const pg = this.planetaryGears[g];
      const ringRot = this.ringObjs[pg.ringIdx]?.rotation.z || 0;
      gd.position.set(pg.x, pg.y, pg.z);
      gd.rotation.set(0, 0, ringRot * pg.ratio);
      gd.scale.setScalar(pg.scale);
      gd.updateMatrix();
      this.planetaryGearInst.setMatrixAt(g, gd.matrix);
    }
    this.planetaryGearInst.instanceMatrix.needsUpdate = true;

    // Master 12 o'clock Caliper Crystal & Alignment Laser feedback
    if (status === 'failed' || this._strikeFlash > 0.25) {
      this.masterCrystalMat.color.copy(this._colNotchFailed);
      this.masterCrystalMat.emissive.copy(this._colEmFailed);
      this.alignLaserMat.color.copy(this._colCrimson);
      this.alignLaserMat.opacity = 0.55;
    } else if (status === 'won') {
      this.masterCrystalMat.color.copy(this._colGold);
      this.masterCrystalMat.emissive.copy(this._colGoldEm);
      this.alignLaserMat.color.copy(this._colGold);
      this.alignLaserMat.opacity = 0.72;
    } else if (activeInSweetSpot) {
      this.masterCrystalMat.color.copy(this._colNotchSweet);
      this.masterCrystalMat.emissive.copy(this._colEmSweet);
      this.alignLaserMat.color.copy(this._colCyan);
      this.alignLaserMat.opacity = 0.82;
    } else {
      this.masterCrystalMat.color.copy(this._colAmethyst);
      this.masterCrystalMat.emissive.copy(this._colAmethystEm);
      this.alignLaserMat.color.copy(this._colCyan);
      this.alignLaserMat.opacity = 0.32;
    }
    this.masterCrystal.rotation.y = time * 2.2;

    // 4. Molten-Gold Energy Conduits Igniting Radially Inward (`0 -> 1 -> 2`)!
    for (let s = 0; s < 3; s++) {
      const cMat = this.conduitMats[s];
      const lit = status === 'won' || s < lockedCount ? 1 : 0;
      this._conduitGlow[s] += (lit - this._conduitGlow[s]) * Math.min(1, dt * 8.5);
      if (status === 'failed') {
        cMat.color.copy(this._colCrimson);
        cMat.emissive.copy(this._colCrimsonEm);
        cMat.emissiveIntensity = 1.15;
      } else if (this._conduitGlow[s] > 0.02) {
        cMat.color.copy(this._colGold);
        cMat.emissive.copy(this._colGoldEm);
        cMat.emissiveIntensity = this._conduitGlow[s] * (0.95 + 0.18 * Math.sin(time * 6.5 - s * 1.2));
      } else {
        cMat.color.copy(this._colConduitOff);
        cMat.emissive.copy(this._colConduitOffEm);
        cMat.emissiveIntensity = 0.16;
      }
    }

    this.sigilDisc.rotation.z = time * (0.14 + lockedCount * 0.14);
    this.sigilMat.opacity = status === 'won' ? 0.18 : 0.07 + lockedCount * 0.03;
    this.sigilMat.color.copy(
      status === 'failed' ? this._colCrimson : status === 'won' ? this._colGold : this._colCyan
    );

    // Animate Deep 3D Abyssal Background Turbine Cogs, Recessed Rune Conduits & Rising Cavern Mist!
    const turbineBoost = 1.0 + lockedCount * 0.38 + (status === 'won' ? 0.85 : 0);
    if (this.bgTurbines) {
      for (let t = 0; t < this.bgTurbines.length; t++) {
        const tb = this.bgTurbines[t];
        tb.rotation.z = time * tb.userData.spd * turbineBoost;
      }
    }
    if (this.mats.abyssRune) {
      if (status === 'failed') {
        this.mats.abyssRune.color.copy(this._colCrimson);
        this.mats.abyssRune.emissive.copy(this._colCrimsonEm);
        this.mats.abyssRune.emissiveIntensity = 1.05;
      } else if (status === 'won') {
        this.mats.abyssRune.color.copy(this._colGold);
        this.mats.abyssRune.emissive.copy(this._colGoldEm);
        this.mats.abyssRune.emissiveIntensity = 1.18 + 0.18 * Math.sin(time * 8.0);
      } else {
        this.mats.abyssRune.color.copy(this._colCyan);
        this.mats.abyssRune.emissive.copy(this._colCyanEm);
        this.mats.abyssRune.emissiveIntensity = 0.98 + lockedCount * 0.16 + 0.15 * Math.sin(time * 3.8);
      }
    }
    if (this.abyssDepthLight) {
      this.abyssDepthLight.color.copy(
        status === 'failed' ? this._colCrimson : status === 'won' ? this._colGold : this._colCyan
      );
      this.abyssDepthLight.intensity = (status === 'won' ? 2.6 : 1.95 + lockedCount * 0.32) + 0.22 * Math.sin(time * 3.2);
    }
    if (this.cavernMistUniforms) {
      this.cavernMistUniforms.uTime.value = time;
      this.cavernMistUniforms.uGlow.value = status === 'won' ? 1.0 : lockedCount * 0.28;
    }

    if (this.arcaneUniforms) {
      const actIdx = clamp(vault.activeRing || 0, 0, 2);
      this.arcaneUniforms.uTime.value = time;
      this.arcaneUniforms.uLocked.value = lockedCount;
      this.arcaneUniforms.uActiveRad.value = RING_RADII[actIdx] || 2.22;
      this.arcaneUniforms.uSweet.value = activeInSweetSpot ? 1.0 : 0.0;
      this.arcaneUniforms.uWon.value = status === 'won' ? 0.52 : 0.0;
      this.arcaneUniforms.uFailed.value = status === 'failed' ? 1.0 : 0.0;
    }

    // 5. Multi-Faceted Pulsing Star Core & Tri-Axis Gimbal Cage Animation
    const scUd = this.starCoreGroup.userData;
    const spinBoost = 1 + lockedCount * 0.55 + (status === 'won' ? 0.9 : 0);
    scUd.starCrystalGrp.rotation.y = time * 2.3 * spinBoost;
    scUd.starCrystalGrp.rotation.x = Math.sin(time * 1.6) * 0.32;
    scUd.gimbalOuter.rotation.y = time * 1.25 * spinBoost;
    scUd.gimbalOuter.rotation.x = Math.sin(time * 0.9) * 0.35;
    scUd.gimbalMid.rotation.x = time * -1.65 * spinBoost;
    scUd.gimbalMid.rotation.z = Math.cos(time * 1.1) * 0.42;
    scUd.gimbalInner.rotation.y = time * -2.2 * spinBoost;
    scUd.gimbalInner.rotation.z = time * 1.45;

    const coreScale =
      status === 'won'
        ? 1.38 + Math.sin(time * 12) * 0.08
        : 1.0 + lockedCount * 0.08 + Math.sin(time * 4.5) * 0.03;
    this.starCoreGroup.scale.setScalar(coreScale);
    scUd.coreHalo.scale.setScalar(status === 'won' ? 1.65 : 1.18 + lockedCount * 0.14);

    this.starInnerMat.emissive.copy(status === 'failed' ? this._colCrimsonEm : this._colGoldEm);
    this.coreLight.color.copy(
      status === 'failed' ? this._colCrimson : status === 'won' ? this._colGold : this._colCyan
    );
    this.coreLight.intensity = status === 'won' ? 1.75 : 0.95 + lockedCount * 0.35;

    // 6. Update Ambient Dust/Ember Motes & Lock/Strike Spark Bursts
    for (let i = 0; i < MAX_MOTES; i++) {
      const m = this._moteSeeds[i];
      const o = i * 3;
      if (m.isEmber) {
        const rise = (time * m.spd * 1.45 + m.phase) % 3.6;
        const spread = 0.06 + rise * 0.09;
        this._motePos[o] = m.baseX + Math.sin(time * 3.8 + m.phase) * spread;
        this._motePos[o + 1] = m.baseY + rise;
        this._motePos[o + 2] = m.baseZ + Math.cos(time * 3.1 + m.phase) * spread;
      } else {
        this._motePos[o] = m.baseX + Math.sin(time * m.spd + m.phase) * 0.35;
        this._motePos[o + 1] = m.baseY + Math.cos(time * m.spd * 0.8 + m.phase) * 0.28;
        this._motePos[o + 2] = m.baseZ + Math.sin(time * 0.6 + m.phase) * 0.22;
      }
    }
    this.motePoints.geometry.attributes.position.needsUpdate = true;

    let anySparkAlive = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const sp = this._sparkData[i];
      const o = i * 3;
      if (sp.life > 0) {
        anySparkAlive = true;
        sp.life -= dt;
        sp.vy -= 5.8 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        this._spPos[o] = sp.x;
        this._spPos[o + 1] = sp.y;
        this._spPos[o + 2] = sp.z;
        this._spCol[o] = sp.r;
        this._spCol[o + 1] = sp.g;
        this._spCol[o + 2] = sp.b;
        this._spAlpha[i] = clamp(sp.life / sp.maxLife, 0, 1);
      } else {
        this._spPos[o + 1] = -25;
        this._spAlpha[i] = 0;
      }
    }
    this.sparkPoints.visible = anySparkAlive;
    if (anySparkAlive) {
      const spG = this.sparkPoints.geometry;
      spG.attributes.position.needsUpdate = true;
      spG.attributes.aColor.needsUpdate = true;
      spG.attributes.aAlpha.needsUpdate = true;
    }

    // 7. Frustum-Safe 3D Strike Resonator Crystals (anchored cleanly in front of stone steps at z = 1.48!)
    const distAtGemPlane = Math.max(3.5, this._camZ - 1.48);
    const halfHPlane = tanHalf * distAtGemPlane;
    const gemScale = clamp(distAtGemPlane / 11.2, 0.58, 1.02);
    const gemY = clamp(this._camY * 0.45 - halfHPlane * 0.48, -2.38, -1.55);
    const spacing = maxStrikes > 3 ? 0.44 : 0.56;

    let bezelCount = 0;
    for (let s = 0; s < MAX_STRIKE_GEMS; s++) {
      const gem = this.strikeGems[s];
      if (s >= maxStrikes) {
        gem.visible = false;
        continue;
      }
      gem.visible = true;
      const struck = s < strikes;
      const offset = (s - (maxStrikes - 1) * 0.5) * spacing * gemScale;
      gem.position.set(offset, gemY, 1.48);
      gem.scale.setScalar(gemScale);
      gem.userData.crystal.rotation.y = time * 2.1 + s * 0.8;
      gem.userData.mat.color.copy(struck ? this._colCrimson : this._colCyan);
      gem.userData.mat.emissive.copy(struck ? this._colCrimsonEm : this._colCyanEm);
      this._gearDummy.position.set(offset, gemY, 1.48);
      this._gearDummy.rotation.set(0, 0, 0);
      this._gearDummy.scale.setScalar(gemScale);
      this._gearDummy.updateMatrix();
      this.strikeBezelInst.setMatrixAt(bezelCount++, this._gearDummy.matrix);
    }
    this.strikeBezelInst.count = bezelCount;
    if (bezelCount > 0) this.strikeBezelInst.instanceMatrix.needsUpdate = true;

    this._updateOverlayHud(vault, lockedCount, activeInSweetSpot);
    this._syncPopups(outer.popups ?? ctx.popups);

    // 8. Strict WebGL State Save -> Planar Water Reflection -> Main Vault Scene -> Overlay -> Restore!
    const prevTarget = gl.getRenderTarget ? gl.getRenderTarget() : null;
    const prevAutoClear = gl.autoClear;
    const prevToneMapping = gl.toneMapping;
    const prevExposure = gl.toneMappingExposure;
    const prevXr = gl.xr ? gl.xr.enabled : false;
    const prevShadowAuto = gl.shadowMap ? gl.shadowMap.autoUpdate : true;
    gl.getClearColor(this._prevClearColor);
    const prevClearAlpha = gl.getClearAlpha();

    try {
      if (gl.xr) gl.xr.enabled = false;
      if (gl.shadowMap) gl.shadowMap.autoUpdate = false;
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = this.exposure;

      this._updatePlanarReflection();

      gl.setRenderTarget(prevTarget);
      if (ctx.postfx && typeof ctx.postfx.render === 'function') {
        ctx.postfx.render(this.scene, this.camera, ctx.postfxOpts);
      } else {
        gl.autoClear = true;
        gl.render(this.scene, this.camera);
      }

      gl.setRenderTarget(prevTarget);
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(this.overlay, this.oCam);
    } finally {
      gl.setRenderTarget(prevTarget);
      gl.autoClear = prevAutoClear;
      gl.toneMapping = prevToneMapping;
      gl.toneMappingExposure = prevExposure;
      if (gl.xr) gl.xr.enabled = prevXr;
      if (gl.shadowMap) gl.shadowMap.autoUpdate = prevShadowAuto;
      gl.setClearColor(this._prevClearColor, prevClearAlpha);
      gl.state?.buffers?.depth?.setMask?.(true);
    }
  }

  dispose() {
    this._disposed = true;
    this.reflRT?.dispose?.();
    this._ownEnvRT?.dispose?.();

    const seen = new Set();
    const kill = (o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) {
          const t = m[k];
          if (t && t !== this.softDotTex && !seen.has(t)) {
            seen.add(t);
            t.dispose();
          }
        }
        m.dispose();
      }
    };
    this.scene.traverse(kill);
    this.overlay.traverse(kill);

    for (const e of this._popCache.values()) e.tex.dispose();
    this._popCache.clear();
    this.waterNormalTex?.dispose();
    this.sigilTex?.dispose();
    this.moonShaftTex?.dispose();
    if (this._ownSoftDot) this.softDotTex?.dispose();
  }
}
