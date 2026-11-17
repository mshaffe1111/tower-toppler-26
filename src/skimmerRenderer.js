// TOWER TOPPLER '26 — NEXT-GEN HYDRO-SKIMMER 3D RENDERER (src/skimmerRenderer.js)
//
// Shares `GameRenderer.webgl` with strict WebGL state save/restore (`setRenderTarget`,
// `autoClear`, `toneMapping`, `toneMappingExposure`, `clearColor`, `xr`, `shadowMap`)
// and zero per-frame allocations.
//
// Visual Architecture (Moonlit Storm PBR Parity with Explorer Pogo V2):
// 1. Real-time planar-reflection GLSL Fresnel Storm Ocean (`WebGLRenderTarget` with oblique
//    clip plane, 4-layer scrolling periodic wave normal map, Gerstner 3D swells, subsurface
//    turquoise crest glow, silver moon glitter path, and dynamic V-keel frothy wake).
// 2. Custom GLSL Moonlit Storm Sky Dome, cratered full storm moon with silver-blue corona,
//    drifting backlit rim-lit storm clouds, and distant beacon monolith silhouette.
// 3. 8 looping monumental 3D coastal setpieces: wet normal-mapped hexagonal basalt sea-stack
//    arches (with amethyst/cyan crystal veins & hanging crags) and ancient ruined indigo-slate
//    lighthouse pillars (with flanged iron pipes & warm `#ffaa33` hanging cage lanterns).
// 4. `assets/models/hydro_skimmer.glb` piloted by our 33-bone `PogoRig` (`./pogo.js` Explorer
//    Pogo V2) gripping twin brass helm handlebars, banking into turns with frothy bow-wake
//    ribbons, sculpted rooster-tail spray, and 220-particle GPU water-mist spray.
// 5. Ornate brass & obsidian planetary-geared Boost Gate rings (`1X..4X` holographic curtains),
//    sculpted curling translucent wave-ramps, `assets/models/sea_mine.glb` naval mines,
//    iron-strapped salvage crates, faceted Golden Gears, and 6-style Cryo-Blaster bolts.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries as rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PogoRig } from './pogo.js';

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

const MAX_GATES = 12;
const MAX_RAMPS = 12;
const MAX_HAZARDS = 22;
const MAX_GEARS = 36;
const MAX_BOLTS = 24;
const MAX_SPRAY = 220;
const MAX_SCREEN_PART = 260;
const MAX_POP = 14;
const ARCH_COUNT = 8;
const ARCH_SPAN_Z = 96.0;

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

const BLASTER_FX_STYLES = {
  standard_cryo: { core: '#e0f2fe', emissive: '#38bdf8', ring: '#7dd3fc', halo: '#bae6fd' },
  emerald_plasma: { core: '#ecfdf5', emissive: '#10b981', ring: '#5efce8', halo: '#6ee7b7' },
  solar_ember: { core: '#fef9c3', emissive: '#f97316', ring: '#fde047', halo: '#fdba74' },
  amethyst_void: { core: '#fae8ff', emissive: '#a855f7', ring: '#c084fc', halo: '#e879f9' },
  retro_voxel: { core: '#ffffff', emissive: '#22d3ee', ring: '#fde047', halo: '#67e8f9', voxel: true },
  diamond_prism: { core: '#ffffff', emissive: '#67e8f9', ring: '#fde047', halo: '#f0abfc', prismatic: true },
};

const BOOST_TIER_HEX = [
  { rim: '#38bdf8', glow: '#0ea5e9', jet: '#5efce8' }, // 1X
  { rim: '#34d399', glow: '#10b981', jet: '#6ee7b7' }, // 2X
  { rim: '#c084fc', glow: '#9333ea', jet: '#e879f9' }, // 3X
  { rim: '#fde047', glow: '#f59e0b', jet: '#fef08a' }, // 4X
];

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

// ----------------------------------------------------------------------------------
// Procedural PBR Texture & Normal-Map Generators (executed once on construction)
// ----------------------------------------------------------------------------------

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

// Tileable periodic multi-wave ocean normal map (adapted from origin/main:src/water.js)
function createWaterNormalTexture(size = 256) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(128, 128, 255, 255, false);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const waves = [];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 28; i++) {
    const kx = Math.round((rand() - 0.5) * (6 + i * 1.65));
    const ky = Math.round((rand() - 0.5) * (6 + i * 1.65));
    if (kx === 0 && ky === 0) continue;
    const k = Math.hypot(kx, ky);
    waves.push({ kx, ky, amp: 1 / Math.pow(k, 1.22), ph: rand() * TAU });
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let dx = 0;
      let dy = 0;
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        const a = TAU * (w.kx * u + w.ky * v) + w.ph;
        const cs = Math.cos(a) * w.amp;
        dx += cs * w.kx;
        dy += cs * w.ky;
      }
      const s = 0.095;
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
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function heightCanvasToNormalTex(heightCanvas, strength = 1.65) {
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
      // Smooth 3x3 Sobel filter prevents sub-pixel specular moire aliasing!
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

// Wet Indigo-Slate & Volcanic Basalt PBR Albedo + Tangent Normal + Roughness Maps
function createWetStoneMaps(size = 512) {
  const colC = makeCanvas(size, size);
  const hgtC = makeCanvas(size, size);
  const rghC = makeCanvas(size, size);
  if (!colC || !hgtC || !rghC) {
    return {
      map: createFallbackDataTex(56, 66, 104, 255, true),
      normalMap: createFallbackDataTex(128, 128, 255, 255, false),
      roughnessMap: createFallbackDataTex(130, 130, 130, 255, false),
    };
  }
  const ctx = colC.getContext('2d');
  const hCtx = hgtC.getContext('2d');
  const rCtx = rghC.getContext('2d');
  const rng = mulberry32(49217);

  ctx.fillStyle = '#14192e';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#383838';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#d2d2d2';
  rCtx.fillRect(0, 0, size, size);

  const rows = 7;
  const cols = 4;
  const bh = size / rows;
  const bw = size / cols;

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const jitterW = (rng() - 0.5) * bw * 0.08;
      const x = c * bw + off + 4.0;
      const y = r * bh + 3.5;
      const w = bw + jitterW - 8.0;
      const h = bh - 7.0;

      const v = rng();
      const baseR = Math.round(52 + v * 24);
      const baseG = Math.round(60 + v * 28);
      const baseB = Math.round(98 + v * 38);

      const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
      g.addColorStop(0, `rgb(${baseR + 18},${baseG + 20},${baseB + 26})`);
      g.addColorStop(0.55, `rgb(${baseR},${baseG},${baseB})`);
      g.addColorStop(1, `rgb(${Math.max(20, baseR - 14)},${Math.max(24, baseG - 14)},${Math.max(42, baseB - 16)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      // Soft pillowed stone face height (smooth bevels, zero single-pixel harsh ridges)
      const hv = Math.round(160 + v * 48);
      const hg = hCtx.createLinearGradient(x, y, x, y + h);
      hg.addColorStop(0, `rgb(${hv + 18},${hv + 18},${hv + 18})`);
      hg.addColorStop(0.15, `rgb(${hv},${hv},${hv})`);
      hg.addColorStop(0.85, `rgb(${hv - 8},${hv - 8},${hv - 8})`);
      hg.addColorStop(1, `rgb(${hv - 28},${hv - 28},${hv - 28})`);
      hCtx.fillStyle = hg;
      hCtx.fillRect(x + 3, y + 3, Math.max(2, w - 6), Math.max(2, h - 6));

      // Wet specular sheen variations across stones
      const rv = Math.round(88 + rng() * 64);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, w, h);

      // Chiseled fracture lines & micro-pitting
      for (let k = 0; k < 5; k++) {
        const px = x + rng() * w;
        const py = y + rng() * h;
        const pr = 1.5 + rng() * 4.5;
        ctx.fillStyle = rng() < 0.5 ? 'rgba(12,16,32,0.34)' : 'rgba(148,176,225,0.14)';
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
        hCtx.fillStyle = rng() < 0.6 ? 'rgba(40,40,40,0.45)' : 'rgba(245,245,245,0.35)';
        hCtx.beginPath();
        hCtx.arc(px, py, pr, 0, TAU);
        hCtx.fill();
      }

      // Creeping damp olive moss in mortar corners (matches reference photo!)
      if (rng() < 0.28) {
        const mx = x + (rng() < 0.5 ? 4 : w - 10);
        const my = y + h - 5;
        ctx.fillStyle = 'rgba(54, 98, 48, 0.62)';
        ctx.beginPath();
        ctx.ellipse(mx, my, 8 + rng() * 9, 3.5 + rng() * 4, 0, 0, TAU);
        ctx.fill();
        rCtx.fillStyle = '#d8d8d8';
        rCtx.beginPath();
        rCtx.ellipse(mx, my, 8, 4, 0, 0, TAU);
        rCtx.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const normalMap = heightCanvasToNormalTex(hgtC, 3.85);

  const roughnessMap = new THREE.CanvasTexture(rghC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 4;

  return { map, normalMap, roughnessMap };
}

function createRivetedPlatingMaps(size = 512) {
  const colC = makeCanvas(size, size);
  const hgtC = makeCanvas(size, size);
  const rghC = makeCanvas(size, size);
  if (!colC || !hgtC || !rghC) {
    return {
      map: createFallbackDataTex(58, 74, 96, 255, true),
      normalMap: createFallbackDataTex(128, 128, 255, 255, false),
      roughnessMap: createFallbackDataTex(72, 72, 72, 255, false),
    };
  }
  const ctx = colC.getContext('2d');
  const hCtx = hgtC.getContext('2d');
  const rCtx = rghC.getContext('2d');
  const rng = mulberry32(44921);

  // Deep recessed panel seam base
  ctx.fillStyle = '#0d1320';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#1e1e1e';
  hCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#b0b0b0';
  rCtx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const pw = size / cols;
  const ph = size / rows;

  for (let r = 0; r < rows; r++) {
    const stagger = (r % 2) * (pw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * pw + stagger + 3;
      const y = r * ph + 3;
      const w = pw - 6;
      const h = ph - 6;
      const v = rng();

      // Brushed dark gunmetal steel plate with subtle warm brass edge wear
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      const bR = Math.round(52 + v * 16);
      const bG = Math.round(66 + v * 18);
      const bB = Math.round(88 + v * 22);
      g.addColorStop(0, `rgb(${bR + 18},${bG + 20},${bB + 22})`);
      g.addColorStop(0.5, `rgb(${bR},${bG},${bB})`);
      g.addColorStop(1, `rgb(${bR - 14},${bG - 14},${bB - 12})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      // Subtle burnished-brass edge bevel highlight
      ctx.strokeStyle = 'rgba(214, 158, 66, 0.36)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Raised beveled plate height
      hCtx.fillStyle = '#bcbcbc';
      hCtx.fillRect(x + 2, y + 2, w - 4, h - 4);
      rCtx.fillStyle = `rgb(${Math.round(56 + rng() * 34)},${Math.round(56 + rng() * 34)},${Math.round(56 + rng() * 34)})`;
      rCtx.fillRect(x + 2, y + 2, w - 4, h - 4);

      // Brushed metal micro-scratches
      for (let s = 0; s < 14; s++) {
        const sy = y + 4 + rng() * (h - 8);
        ctx.strokeStyle = rng() < 0.5 ? 'rgba(180,205,235,0.09)' : 'rgba(12,18,30,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, sy);
        ctx.lineTo(x + w - 4, sy + (rng() - 0.5) * 2);
        ctx.stroke();
      }

      // Perimeter forged brass & steel rivets!
      const rivStep = 18;
      const drawRivet = (rx, ry) => {
        ctx.fillStyle = '#d99e3e';
        ctx.beginPath();
        ctx.arc(rx, ry, 2.4, 0, TAU);
        ctx.fill();
        hCtx.fillStyle = '#ffffff';
        hCtx.beginPath();
        hCtx.arc(rx, ry, 2.8, 0, TAU);
        hCtx.fill();
        rCtx.fillStyle = '#242424';
        rCtx.beginPath();
        rCtx.arc(rx, ry, 2.8, 0, TAU);
        rCtx.fill();
      };
      for (let rx = x + 9; rx <= x + w - 9; rx += rivStep) {
        drawRivet(rx, y + 7);
        drawRivet(rx, y + h - 7);
      }
      for (let ry = y + 24; ry <= y + h - 24; ry += rivStep) {
        drawRivet(x + 7, ry);
        drawRivet(x + w - 7, ry);
      }
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;

  const normalMap = heightCanvasToNormalTex(hgtC, 3.4);

  const roughnessMap = new THREE.CanvasTexture(rghC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 4;

  return { map, normalMap, roughnessMap };
}

function createWoodPlankMaps(size = 256) {
  const colC = makeCanvas(size, size);
  const hgtC = makeCanvas(size, size);
  if (!colC || !hgtC) {
    return {
      map: createFallbackDataTex(88, 52, 28, 255, true),
      normalMap: createFallbackDataTex(128, 128, 255, 255, false),
    };
  }
  const ctx = colC.getContext('2d');
  const hCtx = hgtC.getContext('2d');
  const rng = mulberry32(8813);

  ctx.fillStyle = '#1c0f08';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#181818';
  hCtx.fillRect(0, 0, size, size);

  const planks = 6;
  const ph = size / planks;
  for (let p = 0; p < planks; p++) {
    const y = p * ph + 2;
    const h = ph - 4;
    const shade = 0.82 + rng() * 0.32;
    ctx.fillStyle = `rgb(${Math.round(92 * shade)},${Math.round(54 * shade)},${Math.round(28 * shade)})`;
    ctx.fillRect(0, y, size, h);
    hCtx.fillStyle = '#c8c8c8';
    hCtx.fillRect(0, y + 1, size, h - 2);

    for (let g = 0; g < 18; g++) {
      const gy = y + 2 + rng() * (h - 4);
      ctx.strokeStyle = rng() < 0.5 ? 'rgba(28,14,6,0.38)' : 'rgba(156,104,58,0.22)';
      ctx.lineWidth = 1 + rng() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(size * 0.33, gy + (rng() - 0.5) * 4, size * 0.66, gy + (rng() - 0.5) * 4, size, gy);
      ctx.stroke();

      hCtx.strokeStyle = 'rgba(90,90,90,0.4)';
      hCtx.lineWidth = 1;
      hCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = heightCanvasToNormalTex(hgtC, 2.1);
  return { map, normalMap };
}

function makeSoftGlowTex(size = 128) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(255, 255, 255, 255, true);
  const ctx = c.getContext('2d');
  const half = size * 0.5;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.24, 'rgba(235,248,255,0.82)');
  g.addColorStop(0.58, 'rgba(180,228,255,0.24)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeMoonDiscTex(size = 512) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(235, 245, 255, 255, true);
  const ctx = c.getContext('2d');
  const rng = mulberry32(202607);
  const cx = size * 0.5;
  const cy = size * 0.5;
  const R = size * 0.435;

  // Tight crisp silver-blue limb halo
  const halo = ctx.createRadialGradient(cx, cy, R * 0.94, cx, cy, size * 0.5);
  halo.addColorStop(0, 'rgba(225,240,255,0.88)');
  halo.addColorStop(0.45, 'rgba(150,196,248,0.22)');
  halo.addColorStop(1, 'rgba(120,170,235,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  // Pixel-baked 512x512 high-contrast Lunar Highlands & organic FBM-warped basaltic Lunar Maria (matches reference_highres_bar.jpg!)
  const tmpC = makeCanvas(size, size);
  if (tmpC) {
    const tCtx = tmpC.getContext('2d');
    const img = tCtx.createImageData(size, size);
    const d = img.data;
    const h2 = (ix, iy) => {
      const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const vn = (x, y) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(h2(ix, iy), h2(ix + 1, iy), ux), lerp(h2(ix, iy + 1), h2(ix + 1, iy + 1), ux), uy);
    };
    const fbm = (x, y) =>
      vn(x, y) * 0.50 +
      vn(x * 2.13 + 5.7, y * 2.13 - 3.1) * 0.27 +
      vn(x * 4.41 - 9.2, y * 4.41 + 2.4) * 0.14 +
      vn(x * 9.3 + 4.1, y * 9.3 - 6.8) * 0.06 +
      vn(x * 19.7, y * 19.7) * 0.03;

    const half = size * 0.5;
    const rLim = size * 0.435;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const dx = (px - half) / rLim;
        const dy = (py - half) / rLim;
        const rr = dx * dx + dy * dy;
        const idx = (py * size + px) * 4;
        if (rr > 1.02) {
          d[idx + 3] = 0;
          continue;
        }
        const nz = Math.sqrt(Math.max(0.01, 1 - Math.min(1, rr)));
        // Domain-warped organic Lunar Maria continents (Mare Imbrium, Serenitatis, Tranquillitatis, Procellarum)
        const wx = dx + (fbm(dx * 3.1 + 1.7, dy * 3.1 + 2.3) - 0.5) * 0.34;
        const wy = dy + (fbm(dx * 3.1 + 6.4, dy * 3.1 - 1.9) - 0.5) * 0.34;
        const mareMask =
          smooth01((0.50 - Math.hypot(wx + 0.26, wy + 0.18)) / 0.38) * 0.90 +
          smooth01((0.42 - Math.hypot(wx - 0.16, wy + 0.24)) / 0.32) * 0.80 +
          smooth01((0.38 - Math.hypot(wx - 0.28, wy - 0.06)) / 0.30) * 0.72 +
          smooth01((0.40 - Math.hypot(wx + 0.22, wy - 0.20)) / 0.34) * 0.65;
        const nMare = fbm((wx + 1.8) * 4.8, (wy + 1.8) * 4.8);
        const micro = fbm((dx + 2.3) * 16.0, (dy + 2.3) * 16.0);
        // Subtle natural ridged crater-rim micro-relief (zero artificial dark polka-dots!)
        const ridge = 1.0 - Math.abs(vn((dx + 3.1) * 11.5, (dy - 1.7) * 11.5) * 2.0 - 1.0);
        const mare = clamp(mareMask * (0.42 + nMare * 0.92) - 0.14, 0, 1);

        // Luminous silver-ivory highlands vs authentic slate-blue lunar maria
        const limb = 0.76 + 0.24 * Math.pow(nz, 0.45);
        const sunGrad = 0.90 + 0.12 * (-dx * 0.40 - dy * 0.40);
        const highlandDetail = 0.88 + micro * 0.18 + Math.pow(ridge, 4.0) * 0.10 * (1.0 - mare * 0.7);
        const lum = lerp(0.98, 0.44, mare) * highlandDetail * limb * sunGrad;

        d[idx] = clamp(Math.round(lum * 238), 0, 255);
        d[idx + 1] = clamp(Math.round(lum * 246 + (1 - lum) * 14), 0, 255);
        d[idx + 2] = clamp(Math.round(Math.min(255, lum * 255 + 22)), 0, 255);
        d[idx + 3] = Math.round(smooth01((1.015 - Math.sqrt(rr)) / 0.025) * 255);
      }
    }
    tCtx.putImageData(img, 0, 0);
    ctx.drawImage(tmpC, 0, 0);
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();

  // Subtle luminous Tycho ejecta rays in lower-left highland quadrant
  const tx = cx - R * 0.12;
  const ty = cy + R * 0.42;
  const craterGlow = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.12);
  craterGlow.addColorStop(0, 'rgba(255,255,255,0.65)');
  craterGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = craterGlow;
  ctx.fillRect(tx - R * 0.14, ty - R * 0.14, R * 0.28, R * 0.28);
  for (let r = 0; r < 12; r++) {
    const ra = (r / 12) * TAU + rng() * 0.22;
    const rLen = R * (0.30 + rng() * 0.55);
    const rg = ctx.createLinearGradient(tx, ty, tx + Math.cos(ra) * rLen, ty + Math.sin(ra) * rLen);
    rg.addColorStop(0, 'rgba(255,255,255,0.28)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = rg;
    ctx.lineWidth = 1.4 + rng() * 1.6;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + Math.cos(ra) * rLen, ty + Math.sin(ra) * rLen);
    ctx.stroke();
  }
  ctx.restore();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeStormCloudTex(w = 1024, h = 512) {
  // Seamless 1024x512 High-Contrast Multi-Octave Ridged/Billow Cumulonimbus Storm Panorama!
  // Zero blurry radial gradient circles: features towering moonlit silver-rimmed storm anvils
  // & brooding charcoal-indigo cloud bellies matching reference_highres_bar.jpg!
  const c = makeCanvas(w, h);
  if (!c) return createFallbackDataTex(24, 38, 66, 200, true);
  const ctx = c.getContext('2d');

  // Synthesize seamless X-periodic 6-octave billow + ridged cumulonimbus field at 512x256 -> crisp 1024x512!
  const bw = 512;
  const bh = 256;
  const bakeC = makeCanvas(bw, bh);
  if (bakeC) {
    const bCtx = bakeC.getContext('2d');
    const img = bCtx.createImageData(bw, bh);
    const d = img.data;
    const hPer = (ix, iy, perX) => {
      const wx = ((ix % perX) + perX) % perX;
      const s = Math.sin(wx * 127.1 + iy * 311.7 + 19.19) * 43758.5453;
      return s - Math.floor(s);
    };
    const vPer = (x, y, perX) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      return lerp(
        lerp(hPer(ix, iy, perX), hPer(ix + 1, iy, perX), ux),
        lerp(hPer(ix, iy + 1, perX), hPer(ix + 1, iy + 1, perX), ux),
        uy
      );
    };
    const fbmBillow = (u, v) => {
      let sum = 0;
      let amp = 0.52;
      let freqX = 6;
      let freqY = 3;
      for (let o = 0; o < 5; o++) {
        const n = vPer(u * freqX + o * 3.7, v * freqY + o * 2.3, freqX);
        // Billow lobe shaping: crisp cauliflower cumulonimbus tops!
        const billow = 1.0 - Math.abs(n * 2.0 - 1.0) * 0.72;
        sum += (n * 0.58 + billow * 0.42) * amp;
        freqX *= 2;
        freqY *= 2;
        amp *= 0.5;
      }
      return sum;
    };

    for (let py = 0; py < bh; py++) {
      const v = py / (bh - 1); // 0 = upper zenith, 1 = sea horizon
      // Cumulonimbus vertical profile: open starry gaps at top, towering anvil bank across v = 0.22..0.88
      const env = smooth01((v - 0.05) / 0.26) * smooth01((0.99 - v) / 0.14);
      for (let px = 0; px < bw; px++) {
        const u = px / bw;
        const warp = (vPer(u * 4 + 1.3, v * 3 + 4.1, 4) - 0.5) * 0.11;
        const n0 = fbmBillow(u + warp, v);
        // Vertical finite-difference for crisp top-down silver moonlit cloud rim lighting!
        const nAbove = fbmBillow(u + warp - 0.008, Math.max(0, v - 0.022));
        const density = clamp((n0 * env - 0.23) * 2.35, 0, 1);
        const idx = (py * bw + px) * 4;
        if (density <= 0.004) {
          d[idx + 3] = 0;
          continue;
        }
        // Top-edge transmittance -> razor-crisp silver-blue moonlit cloud crest!
        const topRim = clamp((n0 - nAbove) * 4.8 + (1.0 - density) * (1.0 - v) * 0.55, 0, 1);
        // Proximity to moon azimuth (u ~ 0.62) boosts silver-ivory forward scatter!
        const duMoon = Math.min(Math.abs(u - 0.60), 1 - Math.abs(u - 0.60));
        const moonProx = Math.exp(-duMoon * duMoon * 18.0);
        const rimPow = Math.pow(topRim, 1.45) * (0.55 + moonProx * 0.75) * smooth01((0.88 - v) / 0.55);

        // Deep charcoal-slate storm belly (#070d1b..#122038) -> silver-blue rim (#c8e2ff)
        const bellyDark = 1.0 - smooth01((v - 0.42) / 0.48) * 0.55;
        let r = lerp(9, 26, n0 * bellyDark) + rimPow * 195;
        let g = lerp(16, 42, n0 * bellyDark) + rimPow * 218;
        let b = lerp(31, 70, n0 * bellyDark) + rimPow * 245;

        d[idx] = clamp(Math.round(r), 0, 255);
        d[idx + 1] = clamp(Math.round(g), 0, 255);
        d[idx + 2] = clamp(Math.round(b), 0, 255);
        d[idx + 3] = clamp(Math.round(Math.pow(density, 0.78) * 246), 0, 255);
      }
    }
    bCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bakeC, 0, 0, w, h);
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function makeSeafoamRingTex(size = 256) {
  const c = makeCanvas(size, size);
  if (!c) return createFallbackDataTex(220, 240, 255, 180, true);
  const ctx = c.getContext('2d');
  const rng = mulberry32(9912);
  const cx = size * 0.5;
  const cy = size * 0.5;

  const base = ctx.createRadialGradient(cx, cy, size * 0.14, cx, cy, size * 0.49);
  base.addColorStop(0, 'rgba(220,242,255,0)');
  base.addColorStop(0.32, 'rgba(225,244,255,0.78)');
  base.addColorStop(0.62, 'rgba(186,230,253,0.42)');
  base.addColorStop(1, 'rgba(186,230,253,0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Lacy foam bubbles around collar
  for (let i = 0; i < 90; i++) {
    const a = rng() * TAU;
    const r = size * (0.20 + rng() * 0.24);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const br = 2 + rng() * 6.5;
    ctx.fillStyle = `rgba(240, 250, 255, ${0.25 + rng() * 0.5})`;
    ctx.beginPath();
    ctx.arc(x, y, br, 0, TAU);
    ctx.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBoostBadgeTex(mult) {
  const c = makeCanvas(128, 64);
  if (!c) return createFallbackDataTex(94, 252, 232, 255, true);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);

  const label = `${mult}X`;
  const col = mult >= 4 ? '#fde047' : mult === 3 ? '#e879f9' : mult === 2 ? '#5efce8' : '#7dd3fc';

  ctx.fillStyle = 'rgba(6, 14, 28, 0.78)';
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(10, 8, 108, 48, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = '900 30px Orbitron, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = col;
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, 64, 33);
  ctx.shadowBlur = 0;

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createMoonlitStormEnvMap(webgl) {
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#091428');

    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      new THREE.MeshBasicMaterial({ color: '#162c52', side: THREE.BackSide })
    );
    envScene.add(skyDome);

    // Bright silver-blue moon key patch
    const moonCard = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#e8f4ff' })
    );
    moonCard.position.set(8, 11, -10);
    envScene.add(moonCard);

    // Cyan storm sea bounce below + warm amber lighthouse fill
    const cyanBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshBasicMaterial({ color: '#155e75', side: THREE.DoubleSide })
    );
    cyanBounce.rotation.x = -Math.PI * 0.5;
    cyanBounce.position.y = -5;
    envScene.add(cyanBounce);

    const warmFill = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffaa33' })
    );
    warmFill.position.set(-10, 3, 6);
    envScene.add(warmFill);

    const rt = pmrem.fromScene(envScene, 0.04);
    skyDome.geometry.dispose();
    skyDome.material.dispose();
    moonCard.geometry.dispose();
    moonCard.material.dispose();
    cyanBounce.geometry.dispose();
    cyanBounce.material.dispose();
    warmFill.geometry.dispose();
    warmFill.material.dispose();
    pmrem.dispose();
    return rt;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------------
// Sculpted Multi-Part 3D Geometry Builders (ZERO cheap untextured primitives!)
// ----------------------------------------------------------------------------------

function buildSculptedGearGeometry(teeth = 10, outerR = 0.42, innerR = 0.31, holeR = 0.14, depth = 0.12) {
  const shape = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.78;
    const p0x = Math.cos(a0) * innerR;
    const p0y = Math.sin(a0) * innerR;
    if (i === 0) shape.moveTo(p0x, p0y);
    else shape.lineTo(p0x, p0y);
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
    bevelThickness: 0.024,
    bevelSize: 0.02,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.center();
  return geo;
}

function buildCurlingWaveRampGeometry(width = 2.45) {
  // Sculpted 3D ocean swell ramp: front, back & lateral skirts sink -0.50m underwater so it rises
  // seamlessly out of the rolling storm sea; lower 75% is deep #07192e..#0e3a5c storm-indigo with
  // lacy seafoam strictly on the curling top crest lip (t > 0.78)!
  const segX = 22;
  const segT = 28;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const cDeep = new THREE.Color('#07192e');
  const cMid = new THREE.Color('#0e3a5c');
  const cFoam = new THREE.Color('#9ecfe6');
  const cTmp = new THREE.Color();
  const skirtY = -0.52;

  for (let j = 0; j <= segT; j++) {
    const t = j / segT; // 0 = submerged front skirt (+Z), 0.82 = curling crest lip, 1.0 = submerged back slope (-Z)
    let z;
    let ySpine;
    if (t <= 0.84) {
      const tr = t / 0.84;
      z = lerp(1.72, -0.82, Math.pow(tr, 0.88)) + (tr > 0.76 ? (tr - 0.76) * 0.55 : 0);
      ySpine = lerp(skirtY, 1.14, Math.pow(tr, 1.45));
    } else {
      const tb = (t - 0.84) / 0.16;
      z = lerp(-0.69, -1.62, tb);
      ySpine = lerp(1.14, skirtY, Math.pow(tb, 1.15));
    }

    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const nx = (u - 0.5) * 2; // -1..1
      const bellX = Math.pow(Math.max(0, 1 - nx * nx), 1.32);
      const x = nx * width * 0.5;
      const y = skirtY + (ySpine - skirtY) * bellX;

      positions.push(x, y, z);
      uvs.push(u, t);

      const hNorm = clamp((y - skirtY) / (1.14 - skirtY), 0, 1);
      const bodyMix = smooth01(hNorm / 0.78);
      cTmp.copy(cDeep).lerp(cMid, bodyMix);

      // Curling top lip foam strictly on upper crest (t > 0.78 and central crest ridge)
      if (t > 0.76 && t < 0.94 && bellX > 0.25) {
        const crestWindow = smooth01((t - 0.78) / 0.08) * (1 - smooth01((t - 0.88) / 0.06));
        const lace = 0.75 + 0.25 * Math.sin(nx * 13.0) * Math.cos(t * 28.0);
        const lipFoam = clamp(crestWindow * smooth01((bellX - 0.25) / 0.45) * lace, 0, 1);
        cTmp.lerp(cFoam, lipFoam * 0.92);
      }
      colors.push(cTmp.r, cTmp.g, cTmp.b);
    }
  }

  const row = segX + 1;
  for (let j = 0; j < segT; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildRoosterTailGeometry() {
  // Multi-lobed 3D churning rooster-tail spray plume (+Z = +0.82 .. +3.65): towering central fin + twin flanking spray curtains!
  const lobes = [
    { ox: 0.0, ang: 0.0, hMul: 1.38, lenMul: 1.08 },
    { ox: -0.22, ang: -0.18, hMul: 0.86, lenMul: 0.88 },
    { ox: 0.22, ang: 0.18, hMul: 0.86, lenMul: 0.88 },
  ];
  const parts = [];
  const segU = 18;
  const segV = 8;
  for (const lb of lobes) {
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      for (let i = 0; i <= segU; i++) {
        const u = i / segU;
        const z = 0.82 + u * 2.75 * lb.lenMul;
        const arcH = (Math.sin(u * Math.PI * 0.88) * 1.28 + u * 0.30) * lb.hMul;
        const y = -0.08 + arcH * (0.18 + 0.82 * v);
        const spreadX = lb.ox + Math.sin(lb.ang) * u * 1.35 + (v - 0.35) * (0.10 + u * 0.48);
        pos.push(spreadX, y, z);
        uv.push(u, v);
      }
    }
    const row = segU + 1;
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

function buildDisplacedBasaltColumn(radiusTop, radiusBot, height, sides, seed) {
  const rng = mulberry32(seed);
  const radSegs = Math.max(14, sides * 2);
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBot, height, radSegs, 10, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + height * 0.5) / Math.max(0.01, height);
    const ang = Math.atan2(z, x);
    // Smooth columnar basalt fluting + organic cliff strata (no origami flat-shaded facets!)
    const flute = 1 + 0.11 * Math.cos(ang * sides + yn * 1.6) + 0.06 * Math.sin(ang * (sides - 2) - seed);
    const strata = 0.88 + 0.22 * Math.sin(yn * 9.5 + seed) + 0.07 * Math.cos(yn * 21.0 + ang * 2.0);
    const taper = 1 - yn * 0.16;
    x *= flute * strata * taper;
    z *= flute * strata * taper;
    if (yn > 0.92) {
      y += Math.sin(ang * 3 + seed) * 0.18 + (rng() - 0.5) * 0.06;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildSeamlessNaturalSeaArch(spanX, archRise, baseSpringY, seed) {
  // Seamless 44x18 continuous sculpted volcanic cliff arch with shared smooth vertex normals!
  const segU = 44;
  const segV = 18;
  const positions = [];
  const uvs = [];
  const indices = [];
  const pCurr = new THREE.Vector3();
  const pNext = new THREE.Vector3();
  const tang = new THREE.Vector3();
  const norm = new THREE.Vector3();
  const binorm = new THREE.Vector3(0, 0, 1);

  const evalSpine = (u, out) => {
    // u = 0..1 arches continuously from left sea-stack base (-spanX) over crown (+archRise) to right base (+spanX)
    if (u < 0.22) {
      const t = u / 0.22;
      out.set(-spanX * lerp(1.06, 1.0, t), lerp(-0.75, baseSpringY, t), 0);
    } else if (u <= 0.78) {
      const t = (u - 0.22) / 0.56;
      const a = Math.PI * (1 - t);
      out.set(Math.cos(a) * spanX, baseSpringY + Math.sin(a) * archRise, Math.sin(t * Math.PI) * 0.18);
    } else {
      const t = (u - 0.78) / 0.22;
      out.set(spanX * lerp(1.0, 1.06, t), lerp(baseSpringY, -0.75, t), 0);
    }
  };

  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    evalSpine(u, pCurr);
    evalSpine(Math.min(1, u + 0.01), pNext);
    if (i === segU) {
      evalSpine(u - 0.01, pNext);
      tang.subVectors(pCurr, pNext).normalize();
    } else {
      tang.subVectors(pNext, pCurr).normalize();
    }
    norm.set(-tang.y, tang.x, 0).normalize();

    const crownDist = Math.abs(u - 0.5) * 2; // 0 at crown, 1 at bases
    const baseR = lerp(0.84, 1.58, Math.pow(crownDist, 1.35));

    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const phi = v * TAU;
      const flute = 1 + 0.12 * Math.cos(phi * 7 + u * 8.0) + 0.08 * Math.sin(u * 24.0 + phi * 3.0 + seed);
      const rCross = baseR * flute;
      const rZ = baseR * 0.92 * (1 + 0.10 * Math.sin(phi * 5 - u * 12.0));

      const cx = pCurr.x + norm.x * Math.cos(phi) * rCross;
      const cy = pCurr.y + norm.y * Math.cos(phi) * rCross;
      const cz = pCurr.z + binorm.z * Math.sin(phi) * rZ;

      positions.push(cx, cy, cz);
      uvs.push(u * 6.0, v * 2.0);
    }
  }

  const row = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCoastalArchSetpiece(index, mats, sharedGeos) {
  const grp = new THREE.Group();
  const rng = mulberry32(7700 + index * 131);
  const isArchBridge = index % 2 === 0;
  const isLighthouse = index % 2 === 1;
  const spanX = 5.45 + (index % 3) * 0.52;

  const stoneGeos = [];
  const ironGeos = [];
  const crystalCyanGeos = [];
  const crystalAmethystGeos = [];

  for (const sx of [-1, 1]) {
    const baseX = sx * spanX;
    const hMain = isLighthouse ? 8.6 + (index % 2) * 1.6 : 7.8 + ((index + (sx > 0 ? 1 : 0)) % 3) * 1.3;

    if (isLighthouse && sx === (index % 4 === 1 ? -1 : 1)) {
      // Ancient Ruined Indigo-Slate Watchtower / Lighthouse Pillar (matches reference tower masonry!)
      const towerCyl = new THREE.CylinderGeometry(1.18, 1.52, hMain, 12, 5);
      // Crumbled slanted ruin top
      const tp = towerCyl.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const y = tp.getY(i);
        const x = tp.getX(i);
        if (y > hMain * 0.32) {
          tp.setY(i, y - Math.max(0, x * sx * 0.65) - (rng() * 0.35));
        }
      }
      towerCyl.computeVertexNormals();
      towerCyl.translate(baseX, hMain * 0.44 - 0.6, 0);
      stoneGeos.push(towerCyl);

      // Corbel stone cornice band + broken spiral stair blocks wrapping the base
      const cornice = new THREE.CylinderGeometry(1.42, 1.32, 0.38, 12);
      cornice.translate(baseX, 2.85, 0);
      stoneGeos.push(cornice);

      for (let st = 0; st < 5; st++) {
        const sa = -sx * (0.4 + st * 0.34);
        const stepBlk = new THREE.BoxGeometry(0.62, 0.24, 0.44);
        stepBlk.rotateY(sa);
        stepBlk.translate(
          baseX + Math.sin(sa) * 1.62,
          0.25 + st * 0.42,
          Math.cos(sa) * 1.62
        );
        stoneGeos.push(stepBlk);
      }

      // Rusted flanged wrought-iron vertical pipe bolted to the lighthouse flank
      const pipeX = baseX - sx * 1.32;
      const pipe = new THREE.CylinderGeometry(0.09, 0.09, 5.2, 8);
      pipe.translate(pipeX, 2.4, 0.42);
      ironGeos.push(pipe);
      for (let fl = 0; fl < 4; fl++) {
        const flange = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8);
        flange.translate(pipeX, 0.7 + fl * 1.35, 0.42);
        ironGeos.push(flange);
      }

      // Cantilevered wrought-iron davit arm + warm `#ffaa33` hanging cage lantern facing the corridor!
      const armX = baseX - sx * 1.75;
      const arm = new THREE.BoxGeometry(1.35, 0.1, 0.1);
      arm.translate(baseX - sx * 1.15, 4.15, 0.2);
      ironGeos.push(arm);
      const brace = new THREE.BoxGeometry(0.95, 0.08, 0.08);
      brace.rotateZ(sx * 0.65);
      brace.translate(baseX - sx * 1.05, 3.82, 0.2);
      ironGeos.push(brace);
      const chain = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6);
      chain.translate(armX, 3.82, 0.2);
      ironGeos.push(chain);
      const cage = new THREE.CylinderGeometry(0.22, 0.18, 0.44, 6);
      cage.translate(armX, 3.36, 0.2);
      ironGeos.push(cage);

      const lanternHalo = new THREE.Sprite(mats.amberHaloSprite);
      lanternHalo.scale.set(2.5, 2.5, 1);
      lanternHalo.position.set(armX, 3.36, 0.2);
      grp.add(lanternHalo);
    } else {
      // Clustered Hexagonal Volcanic Basalt Sea-Stack Buttress
      const colMain = buildDisplacedBasaltColumn(0.92, 1.65, hMain, 7, 100 + index * 19 + (sx > 0 ? 7 : 0));
      colMain.translate(baseX, hMain * 0.42 - 0.6, 0);
      stoneGeos.push(colMain);

      for (let sub = 0; sub < 3; sub++) {
        const subH = 2.4 + sub * 1.35 + rng() * 0.9;
        const ang = (sub - 1) * 0.85 + (sx > 0 ? Math.PI : 0);
        const dist = 0.95 + rng() * 0.45;
        const subCol = buildDisplacedBasaltColumn(0.48, 0.82, subH, 6, 300 + index * 31 + sub * 11 + sx);
        subCol.translate(baseX + Math.cos(ang) * dist, subH * 0.42 - 0.5, Math.sin(ang) * dist);
        stoneGeos.push(subCol);
      }
    }

    // Glowing Amethyst / Cyan Crystal Cluster protruding from wet cliff face (1 merged crystal mesh per arch!)
    const useAmethyst = index % 2 === 1;
    const cTarget = useAmethyst ? crystalAmethystGeos : crystalCyanGeos;
    const cx = baseX - sx * 1.18;
    const cy = 1.65 + (index % 3) * 0.55;
    for (let sh = 0; sh < 3; sh++) {
      const shard = new THREE.OctahedronGeometry(0.20 - sh * 0.03, 0);
      shard.scale(0.58, 1.95 - sh * 0.22, 0.58);
      shard.rotateZ(sx * (-0.42 - sh * 0.22));
      shard.rotateX((sh - 1) * 0.28);
      shard.translate(cx + sx * sh * 0.12, cy + sh * 0.18, 0.36 + (sh - 1) * 0.16);
      cTarget.push(shard);
    }
  }

  const detailGrp = new THREE.Group();
  grp.userData.detailGrp = detailGrp;

  // Merged whitewater surf collars hugging both sea-stack bases (1 draw call instead of 2!)
  const archFoams = [];
  for (const sx of [-1, 1]) {
    const fg = sharedGeos.archFoamPlane.clone();
    fg.rotateX(-Math.PI * 0.5);
    fg.translate(sx * spanX - sx * 0.15, 0.06, 0);
    archFoams.push(fg);
  }
  const mArchFoam = mergeGeometries(archFoams, false);
  for (const g of archFoams) g.dispose();
  detailGrp.add(new THREE.Mesh(mArchFoam, mats.archFoam));

  // Grand Seamless Natural Volcanic Stone Sea-Arch spanning high above the sprint corridor!
  if (isArchBridge) {
    const archRise = 4.2 + (index % 3) * 0.45;
    const baseSpringY = 4.35;
    stoneGeos.push(buildSeamlessNaturalSeaArch(spanX, archRise, baseSpringY, 910 + index * 37));

    for (const kt of [0.34, 0.5, 0.66]) {
      const a = Math.PI * (1 - kt);
      const x = Math.cos(a) * spanX;
      const y = baseSpringY + Math.sin(a) * archRise;
      const stalH = kt === 0.5 ? 1.45 : 0.95;
      const stal = buildDisplacedBasaltColumn(0.04, 0.28, stalH, 6, 1200 + index * 17 + Math.round(kt * 10));
      stal.rotateX(Math.PI);
      stal.translate(x, y - stalH * 0.58, 0);
      stoneGeos.push(stal);
    }
  }

  if (stoneGeos.length) {
    const mergedStone = mergeGeometries(stoneGeos, false);
    for (const g of stoneGeos) g.dispose();
    grp.add(new THREE.Mesh(mergedStone, mats.wetBasalt));
  }
  if (ironGeos.length) {
    const mergedIron = mergeGeometries(ironGeos, false);
    for (const g of ironGeos) g.dispose();
    detailGrp.add(new THREE.Mesh(mergedIron, mats.rustedIron));
  }
  if (crystalCyanGeos.length) {
    const mc = mergeGeometries(crystalCyanGeos, false);
    for (const g of crystalCyanGeos) g.dispose();
    detailGrp.add(new THREE.Mesh(mc, mats.cyanCrystal));
  }
  if (crystalAmethystGeos.length) {
    const ma = mergeGeometries(crystalAmethystGeos, false);
    for (const g of crystalAmethystGeos) g.dispose();
    detailGrp.add(new THREE.Mesh(ma, mats.amethystCrystal));
  }

  grp.add(detailGrp);
  return grp;
}

function buildProceduralSkimmerHull(mats) {
  const g = new THREE.Group();
  // Lofted needle-nose hull matching hydro_skimmer.glb proportions (-Z bow, +Z stern)
  const hullProfile = [
    new THREE.Vector2(0.01, -1.02),
    new THREE.Vector2(0.18, -0.68),
    new THREE.Vector2(0.31, -0.24),
    new THREE.Vector2(0.33, 0.24),
    new THREE.Vector2(0.29, 0.65),
    new THREE.Vector2(0.19, 0.88),
    new THREE.Vector2(0.01, 0.92),
  ];
  const lathe = new THREE.LatheGeometry(hullProfile, 16);
  lathe.rotateX(Math.PI * 0.5);
  lathe.scale(1.0, 0.36, 1.0);
  lathe.translate(0, 0.05, 0);
  g.add(new THREE.Mesh(lathe, mats.skimmerHull));

  // Swept outrigger hydro-sponsons + brass blaster cannons
  for (const sx of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.045, 0.16), mats.skimmerTrim);
    strut.position.set(sx * 0.42, 0.02, 0.12);
    strut.rotation.z = sx * -0.18;

    const sponson = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.068, 0.96, 10), mats.skimmerTrim);
    sponson.rotation.x = Math.PI * 0.5;
    sponson.position.set(sx * 0.58, -0.04, 0.12);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.76), mats.cyanGlow);
    rail.position.set(sx * 0.63, -0.03, 0.12);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.44, 8), mats.tarnishedBrass);
    barrel.rotation.x = Math.PI * 0.5;
    barrel.position.set(sx * 0.18, 0.09, -0.70);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.108, 0.26, 12), mats.tarnishedBrass);
    nozzle.rotation.x = Math.PI * 0.5;
    nozzle.position.set(sx * 0.15, 0.09, 0.80);

    g.add(strut, sponson, rail, barrel, nozzle);
  }

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.36), mats.canopyGlass);
  windshield.position.set(0, 0.19, -0.34);
  windshield.rotation.x = -0.52;
  windshield.renderOrder = 5;
  g.add(windshield);

  return g;
}

// ----------------------------------------------------------------------------------
// Main Export: SkimmerRenderer
// ----------------------------------------------------------------------------------

export class SkimmerRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 844;
    this.dpr = opts.dpr || 1;
    this.era = opts.era === 'original' ? 'original' : 'reboot';
    this.skinId = opts.skinId || 'default_amphibian';
    this.blasterFxId = opts.blasterFxId || 'standard_cryo';
    this.exposure = this.era === 'original' ? 1.06 : 1.0;
    this._disposed = false;
    this._lastTime = 0;

    // Pre-allocated zero-GC math scratchpad
    this._shake = { x: 0, y: 0 };
    this._camRoll = 0;
    this._camX = 0;
    this._camY = 2.7;
    this._prevClearColor = new THREE.Color();
    this._tmpColor = new THREE.Color();
    this._prismColor = new THREE.Color();
    this._v3a = new THREE.Vector3();
    this._v3b = new THREE.Vector3();
    this._ndcVec = new THREE.Vector3();
    this._rayDir = new THREE.Vector3();

    // Planar reflection camera & oblique clip plane state (origin/main:src/water.js pattern)
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

    // Pre-parsed color caches
    this._fxColors = {};
    for (const [k, v] of Object.entries(BLASTER_FX_STYLES)) {
      this._fxColors[k] = {
        core: new THREE.Color(v.core),
        emissive: new THREE.Color(v.emissive),
        ring: new THREE.Color(v.ring),
        halo: new THREE.Color(v.halo),
      };
    }
    this._boostColors = BOOST_TIER_HEX.map((b) => ({
      rim: new THREE.Color(b.rim),
      glow: new THREE.Color(b.glow),
      jet: new THREE.Color(b.jet),
    }));
    this._gateHitColor = new THREE.Color('#fde047');
    this._colorStrCache = new Map();
    this._rgbScratch = [1, 1, 1];

    // Scene & Cameras
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#040812');
    this.scene.fog = new THREE.FogExp2('#081122', 0.0155);

    this.camera = new THREE.PerspectiveCamera(52, Math.max(0.4, this.width / Math.max(1, this.height)), 0.15, 160);
    this.camera.position.set(0, 2.75, 7.1);

    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, this.width, 0, -this.height, -10, 10);

    // Environment IBL for gleaming wet stone, brass, and clearcoat hull
    this._ownEnvRT = null;
    if (opts.envMap) {
      this.scene.environment = opts.envMap;
    } else if (webgl) {
      this._ownEnvRT = createMoonlitStormEnvMap(webgl);
      if (this._ownEnvRT) this.scene.environment = this._ownEnvRT.texture;
    }
    this.scene.environmentIntensity = this.era === 'original' ? 0.65 : 0.52;

    this._initTextures(opts.softDotTex);
    this._initMaterials();
    this._initLights();
    this._initSkyAndHorizon();
    this._initReflectiveStormOcean();
    this._initCoastalCorridor();
    this._initHeroCraftAndPogo();
    this._initSprayAndSpeedVfx();
    this._initGameplayPools();
    this._initOverlayHudAndPopups();
    this._loadGlbAssets();

    this.resize(this.width, this.height, this.dpr);
    this.setEra(this.era);
    this.setSkin(this.skinId);
    this.setBlasterFx(this.blasterFxId);
  }

  _initTextures(sharedSoftDot) {
    this._ownSoftDot = !sharedSoftDot;
    this.softDotTex = sharedSoftDot || makeSoftGlowTex(128);
    this.waterNormalTex = createWaterNormalTexture(256);
    this.stoneMaps = createWetStoneMaps(512);
    this.platingMaps = createRivetedPlatingMaps(512);
    this.woodMaps = createWoodPlankMaps(256);
    this.moonTex = makeMoonDiscTex(512);
    this.cloudTex = makeStormCloudTex(1024, 512);
    this.foamRingTex = makeSeafoamRingTex(256);
    this.boostBadgeTex = [1, 2, 3, 4].map((m) => makeBoostBadgeTex(m));
  }

  _initMaterials() {
    const sm = this.stoneMaps;
    sm.map.repeat.set(1, 2);
    sm.normalMap.repeat.set(1, 2);
    sm.roughnessMap.repeat.set(1, 2);
    const pm = this.platingMaps;
    pm.map.repeat.set(2, 2);
    pm.normalMap.repeat.set(2, 2);
    pm.roughnessMap.repeat.set(2, 2);

    this.mats = {
      wetBasalt: new THREE.MeshStandardMaterial({
        color: '#9db0dc',
        map: sm.map,
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(1.38, 1.38),
        roughnessMap: sm.roughnessMap,
        roughness: 0.30,
        metalness: 0.16,
      }),
      rustedIron: new THREE.MeshStandardMaterial({
        color: '#252d3d',
        normalMap: pm.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.38,
        metalness: 0.86,
      }),
      tarnishedBrass: new THREE.MeshStandardMaterial({
        color: '#d99e3e',
        normalMap: pm.normalMap,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughness: 0.19,
        metalness: 0.92,
      }),
      burnishedGold: new THREE.MeshStandardMaterial({
        color: '#facc15',
        emissive: '#b45309',
        emissiveIntensity: 0.38,
        roughness: 0.16,
        metalness: 0.92,
      }),
      carvedObsidian: new THREE.MeshStandardMaterial({
        color: '#131629',
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.18,
        metalness: 0.45,
      }),
      crateWood: new THREE.MeshStandardMaterial({
        color: '#46372d',
        map: this.woodMaps.map,
        normalMap: this.woodMaps.normalMap,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughness: 0.44,
        metalness: 0.26,
      }),
      barnacleShell: new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        normalMap: sm.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughness: 0.68,
        metalness: 0.08,
      }),
      cyanCrystal: new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        emissive: '#06b6d4',
        emissiveIntensity: 1.45,
        roughness: 0.12,
        metalness: 0.25,
      }),
      amethystCrystal: new THREE.MeshStandardMaterial({
        color: '#d8b4fe',
        emissive: '#9333ea',
        emissiveIntensity: 1.45,
        roughness: 0.12,
        metalness: 0.25,
      }),
      amberGlow: new THREE.MeshStandardMaterial({
        color: '#fef08a',
        emissive: '#ff9500',
        emissiveIntensity: 1.85,
        roughness: 0.1,
      }),
      cyanGlow: new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        emissive: '#0ea5e9',
        emissiveIntensity: 1.65,
        roughness: 0.12,
      }),
      redMineEye: new THREE.MeshBasicMaterial({ color: '#ff3b5c' }),
      skimmerHull: new THREE.MeshPhysicalMaterial({
        color: '#7c93b4',
        map: pm.map,
        normalMap: pm.normalMap,
        normalScale: new THREE.Vector2(1.15, 1.15),
        roughnessMap: pm.roughnessMap,
        metalness: 0.88,
        roughness: 0.24,
        clearcoat: 0.62,
        clearcoatRoughness: 0.14,
      }),
      skimmerTrim: new THREE.MeshStandardMaterial({
        color: '#24344d',
        normalMap: pm.normalMap,
        normalScale: new THREE.Vector2(0.85, 0.85),
        metalness: 0.86,
        roughness: 0.26,
      }),
      canopyGlass: new THREE.MeshPhysicalMaterial({
        color: '#67e8f9',
        transparent: true,
        opacity: 0.34,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
        depthWrite: false,
      }),
      waveRamp: new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        emissive: '#041626',
        emissiveIntensity: 0.04,
        normalMap: this.waterNormalTex,
        normalScale: new THREE.Vector2(0.65, 0.65),
        roughness: 0.14,
        metalness: 0.14,
        clearcoat: 0.88,
        clearcoatRoughness: 0.08,
        side: THREE.DoubleSide,
      }),
      archFoam: new THREE.MeshBasicMaterial({
        map: this.foamRingTex,
        color: '#dceefa',
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
      }),
      amberHaloSprite: new THREE.SpriteMaterial({
        map: this.softDotTex,
        color: '#ffaa33',
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      redMineHaloSprite: new THREE.SpriteMaterial({
        map: this.softDotTex,
        color: '#fb7185',
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      gearHaloSprite: new THREE.SpriteMaterial({
        map: this.softDotTex,
        color: '#fde047',
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      boltCore: new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#38bdf8',
        emissiveIntensity: 1.55,
        roughness: 0.1,
        metalness: 0.2,
      }),
      boltRing: new THREE.MeshBasicMaterial({
        color: '#7dd3fc',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      boltHaloSprite: new THREE.SpriteMaterial({
        map: this.softDotTex,
        color: '#bae6fd',
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    };

    this.sharedGeos = {
      lanternCore: new THREE.OctahedronGeometry(0.14, 0),
      archFoamPlane: new THREE.PlaneGeometry(4.4, 4.4),
      gearSculpt: buildSculptedGearGeometry(10, 0.42, 0.31, 0.13, 0.11),
      pinionGear: buildSculptedGearGeometry(8, 0.17, 0.115, 0.045, 0.07),
      gearJewel: new THREE.OctahedronGeometry(0.11, 0),
      waveRamp: buildCurlingWaveRampGeometry(2.45),
      boltPrism: new THREE.OctahedronGeometry(0.19, 0),
      boltVoxel: new THREE.BoxGeometry(0.22, 0.22, 0.22),
      boltRing: new THREE.TorusGeometry(0.24, 0.022, 6, 20),
    };
  }

  _initLights() {
    this.hemiLight = new THREE.HemisphereLight('#8cb8eb', '#0c1b33', 1.45);
    this.moonLight = new THREE.DirectionalLight('#dbeeff', 2.15);
    this.moonLight.position.set(11.5, 17.5, -24);

    // Warm rim bounce evoking distant lighthouse / helm instrument glow
    this.warmRimLight = new THREE.DirectionalLight('#ffaa44', 0.58);
    this.warmRimLight.position.set(-9, 4.5, 8);

    // Subtle cyan water bounce under the craft & Pogo V2
    this.craftLight = new THREE.PointLight('#38bdf8', 1.25, 7.5);
    this.craftLight.position.set(0, 0.85, -0.2);

    this.scene.add(this.hemiLight, this.moonLight, this.warmRimLight, this.craftLight);
  }

  _initSkyAndHorizon() {
    this.skyUniforms = {
      uTime: { value: 0 },
      uTopCol: { value: new THREE.Color('#02050e') },
      uMidCol: { value: new THREE.Color('#071022') },
      uHorCol: { value: new THREE.Color('#0f1f3a') },
      uMoonDir: { value: new THREE.Vector3(0.135, 0.205, -0.969).normalize() },
      uMoonCol: { value: new THREE.Color('#c8e2ff') },
      uCloudPanorama: { value: this.cloudTex },
      uLightning: { value: 0 },
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uTopCol;
        uniform vec3 uMidCol;
        uniform vec3 uHorCol;
        uniform vec3 uMoonDir;
        uniform vec3 uMoonCol;
        uniform sampler2D uCloudPanorama;
        uniform float uLightning;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float snoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorCol, uMidCol, smoothstep(0.0, 0.26, h));
          col = mix(col, uTopCol, smoothstep(0.22, 0.78, h));

          // Crisp circular pinpoint night stars in clear upper zenith gaps!
          vec2 sGrid = vec2(atan(d.x, -d.z) * 48.0, d.y * 82.0);
          vec2 sId = floor(sGrid);
          float sr = hash21(sId);
          float starLum = 0.0;
          if (sr > 0.962 && h > 0.08) {
            vec2 sOff = vec2(hash21(sId + 7.1), hash21(sId + 19.3)) * 0.6 - 0.3;
            float sDist = length(fract(sGrid) - 0.5 - sOff);
            float pinpoint = smoothstep(0.11, 0.015, sDist);
            float tw = 0.55 + 0.45 * sin(uTime * 3.2 + sr * 90.0);
            starLum = pinpoint * tw * smoothstep(0.08, 0.38, h);
          }

          // High-Contrast 1024x512 Cumulonimbus Panorama + Per-Pixel Ridged FBM Cloud Anvils all the way into upper sky!
          float az = atan(d.x, -d.z) / 3.14159265; // -1..1 centered on -Z sprint corridor!
          float mDot = max(dot(d, normalize(uMoonDir)), 0.0);
          if (h < 0.88 && d.z < 0.45) {
            float vCloud = 1.0 - clamp(h / 0.82, 0.0, 1.0);
            vec4 cPano = texture2D(uCloudPanorama, vec2(az * 0.85 + 0.50 + uTime * 0.005, clamp(vCloud * 1.15 - 0.08, 0.0, 1.0)));

            // Per-pixel Retina 4-octave domain-warped cumulonimbus billow detail (zero blurry low-res smear!)
            vec2 cp = vec2(az * 7.5 + uTime * 0.032, h * 9.5 - uTime * 0.015);
            float n1 = snoise2(cp);
            float n2 = snoise2(cp * 2.15 + vec2(n1 * 0.85, -uTime * 0.025));
            float n3 = snoise2(cp * 4.6 - vec2(uTime * 0.04, n2 * 0.65));
            float n4 = snoise2(cp * 9.8 + vec2(3.1, -1.7));
            float billow = n1 * 0.46 + (1.0 - abs(n2 * 2.0 - 1.0)) * 0.28 + n3 * 0.17 + n4 * 0.09;

            // Part clouds slightly around the moon & create dramatic dark-indigo sky rifts overhead!
            float moonPart = 1.0 - smoothstep(0.986, 0.999, mDot) * 0.55;
            float altEnv = smoothstep(0.0, 0.08, h) * smoothstep(0.86, 0.34, h);
            float rawDens = (cPano.a * 0.52 + billow * 0.72) * altEnv * moonPart;
            float cloudMask = smoothstep(0.34, 0.72, rawDens);
            starLum *= (1.0 - smoothstep(0.12, 0.48, cloudMask));

            // Crisp silver-blue moonlit upper cloud rims vs brooding dark-charcoal storm bellies!
            float nUp = snoise2(cp + vec2(-0.06, 0.14)) * 0.6 + snoise2((cp + vec2(-0.06, 0.14)) * 2.15) * 0.4;
            float topRim = clamp((nUp - rawDens * 0.78) * 3.4 + 0.38, 0.0, 1.0);
            float moonProx = 0.35 + 0.65 * pow(mDot, 5.0);
            vec3 bellyCol = vec3(0.028, 0.052, 0.105);
            vec3 midCloud = vec3(0.11, 0.19, 0.33);
            vec3 silverRim = vec3(0.62, 0.79, 0.98) * moonProx + vec3(0.18, 0.29, 0.46);
            vec3 cloudCol = mix(bellyCol, midCloud, smoothstep(0.35, 0.68, billow));
            cloudCol = mix(cloudCol, silverRim, pow(topRim, 1.8) * smoothstep(0.38, 0.80, rawDens));

            col = mix(col, cloudCol, cloudMask * 0.94);

            // Internal sheet-lightning illumination inside cumulonimbus anvils!
            col += vec3(0.55, 0.80, 1.0) * uLightning * cloudMask * topRim * 0.62;
          }
          col += vec3(0.84, 0.93, 1.0) * starLum;

          // Tight silver-blue atmospheric moon limb glow (never washes out the sky!)
          col += uMoonCol * (pow(mDot, 160.0) * 0.20 + pow(mDot, 48.0) * 0.016);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(135, 40, 24), skyMat);
    this.scene.add(this.skyDome);

    // Crisp 512x512 Cratered Full Moon (placed IN FRONT of distant cloud dome so it is NEVER washed out in grey mud!)
    // + Delicate Feathery Wispy Cloud Filaments & Jagged 3D Archipelago Cliff/Sea-Stack Horizon!
    this.horizonGroup = new THREE.Group();
    const moonCorona = new THREE.Mesh(
      new THREE.PlaneGeometry(14.0, 14.0),
      new THREE.MeshBasicMaterial({
        map: this.softDotTex,
        color: '#9bc6ff',
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    moonCorona.position.set(11.8, 17.6, -84.2);
    this.moonCorona = moonCorona;

    this.moonDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(10.4, 10.4),
      new THREE.MeshBasicMaterial({
        map: this.moonTex,
        transparent: true,
        opacity: 0.99,
        depthWrite: false,
        fog: false,
      })
    );
    this.moonDisc.position.set(11.8, 17.6, -83.8);
    this.horizonGroup.add(moonCorona, this.moonDisc);

    // Dramatic Dark-Indigo Silver-Rimmed Cloud Finger grazing lower-right edge of moon (matches reference_highres_bar.jpg!)
    this.stormClouds = [];
    this.wispUniforms = {
      uTime: { value: 0 },
      uTex: { value: this.cloudTex },
    };
    const wispMat = new THREE.ShaderMaterial({
      uniforms: this.wispUniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uTex;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(uTex, vec2(vUv.x * 1.35 + uTime * 0.010, vUv.y * 0.78 + 0.12));
          float boxFade = smoothstep(0.0, 0.24, vUv.x) * smoothstep(1.0, 0.76, vUv.x)
                        * smoothstep(0.0, 0.26, vUv.y) * smoothstep(1.0, 0.70, vUv.y);
          float wispA = smoothstep(0.38, 0.86, c.a) * boxFade * 0.62;
          // Dark brooding storm-cloud silhouette backlit with a crisp silver upper edge!
          vec3 darkCloud = vec3(0.04, 0.08, 0.16);
          vec3 silverEdge = vec3(0.72, 0.86, 1.0);
          float rim = smoothstep(0.52, 0.88, vUv.y) * (1.0 - smoothstep(0.65, 0.92, c.a));
          vec3 col = mix(darkCloud, silverEdge, clamp(rim * 1.35, 0.0, 0.85));
          gl_FragColor = vec4(col, wispA);
        }
      `,
    });
    const wispVeil = new THREE.Mesh(new THREE.PlaneGeometry(24, 5.2), wispMat);
    wispVeil.position.set(14.8, 14.6, -83.2);
    wispVeil.userData = { baseX: 14.8, spd: 0.16 };
    this.horizonGroup.add(wispVeil);
    this.stormClouds.push(wispVeil);

    // Jagged 3D Coastal Archipelago Sea-Stacks, Cliff Headlands & Sister Watchtowers on Horizon (2 merged meshes!)
    const nearCliffParts = [];
    const farPeakParts = [];
    const nearSpecs = [
      { x: -38, z: -70, rT: 2.2, rB: 5.8, h: 16.5, s: 8, seed: 301 },
      { x: -29, z: -68, rT: 1.4, rB: 4.2, h: 12.8, s: 7, seed: 302 },
      { x: -19.5, z: -72, rT: 0.8, rB: 2.9, h: 14.2, s: 7, seed: 303 },
      { x: -12.8, z: -74, rT: 0.55, rB: 2.2, h: 10.6, s: 6, seed: 304 },
      { x: -1.6, z: -76, rT: 0.42, rB: 1.85, h: 8.8, s: 6, seed: 309 },
      { x: 6.4, z: -75, rT: 0.50, rB: 2.15, h: 10.8, s: 7, seed: 310 },
      { x: 10.2, z: -73, rT: 0.72, rB: 2.6, h: 12.2, s: 7, seed: 305 },
      { x: 18.2, z: -70, rT: 1.5, rB: 4.4, h: 15.6, s: 8, seed: 306 },
      { x: 28.5, z: -69, rT: 2.4, rB: 6.2, h: 17.8, s: 8, seed: 307 },
      { x: 39.0, z: -72, rT: 2.8, rB: 6.8, h: 19.2, s: 8, seed: 308 },
    ];
    for (const ns of nearSpecs) {
      const col = buildDisplacedBasaltColumn(ns.rT, ns.rB, ns.h, ns.s, ns.seed);
      col.translate(ns.x, ns.h * 0.42 - 1.2, ns.z);
      nearCliffParts.push(col);
    }
    // Distant weathered stone sea-arch bridging between right horizon sea-stacks (`x = 14.0, z = -71.5`)
    const distArch = buildSeamlessNaturalSeaArch(4.2, 3.6, 3.4, 1441);
    distArch.scale(0.85, 0.85, 0.85);
    distArch.translate(14.0, 0.4, -71.5);
    nearCliffParts.push(distArch);

    const farSpecs = [
      { x: -46, z: -90, rT: 3.5, rB: 9.5, h: 24.0, s: 8, seed: 401 },
      { x: -24, z: -92, rT: 2.2, rB: 7.4, h: 20.5, s: 8, seed: 402 },
      { x: 2.5, z: -93, rT: 1.2, rB: 4.8, h: 13.5, s: 7, seed: 403 },
      { x: 23.5, z: -91, rT: 2.0, rB: 7.2, h: 21.0, s: 8, seed: 404 },
      { x: 45.0, z: -89, rT: 3.6, rB: 9.8, h: 25.5, s: 8, seed: 405 },
    ];
    for (const fs of farSpecs) {
      const col = buildDisplacedBasaltColumn(fs.rT, fs.rB, fs.h, fs.s, fs.seed);
      col.translate(fs.x, fs.h * 0.40 - 1.5, fs.z);
      farPeakParts.push(col);
    }
    // 2 Distant Sister Watchtower Silhouettes perched on far archipelago headlands!
    for (const [tx, ty, tz] of [[-24.0, 12.5, -91.5], [23.5, 13.0, -90.5]]) {
      const spire = new THREE.CylinderGeometry(0.95, 1.45, 11.5, 10);
      spire.translate(tx, ty, tz);
      const crown = new THREE.CylinderGeometry(1.22, 1.02, 1.1, 10);
      crown.translate(tx, ty + 6.1, tz);
      farPeakParts.push(spire, crown);
    }

    const mNearCliffs = mergeGeometries(nearCliffParts, false);
    for (const g of nearCliffParts) g.dispose();
    const mFarPeaks = mergeGeometries(farPeakParts, false);
    for (const g of farPeakParts) g.dispose();

    const nearCliffMat = new THREE.MeshStandardMaterial({
      color: '#3a4c73',
      map: this.stoneMaps.map,
      normalMap: this.stoneMaps.normalMap,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughness: 0.36,
      metalness: 0.14,
      emissive: '#081122',
      emissiveIntensity: 0.38,
      fog: false,
    });
    const farPeakMat = new THREE.MeshBasicMaterial({
      color: '#0c182e',
      fog: false,
    });
    this.horizonGroup.add(
      new THREE.Mesh(mFarPeaks, farPeakMat),
      new THREE.Mesh(mNearCliffs, nearCliffMat)
    );

    // Rolling Volumetric Horizon Storm-Fog & Sea-Mist Bank (erases any hard 1px CG horizon seam!)
    this.horizonMistUniforms = {
      uTime: { value: 0 },
      uLightning: { value: 0 },
    };
    const mistGeos = [];
    for (const [mz, my, mw, mh] of [[-62.0, 1.8, 108, 7.6], [-79.0, 2.8, 128, 10.5]]) {
      const mg = new THREE.PlaneGeometry(mw, mh);
      mg.translate(0, my, mz);
      mistGeos.push(mg);
    }
    const mMist = mergeGeometries(mistGeos, false);
    for (const g of mistGeos) g.dispose();
    const horizonMistMat = new THREE.ShaderMaterial({
      uniforms: this.horizonMistUniforms,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uLightning;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        void main() {
          float n1 = vnoise(vec2(vUv.x * 9.0 + uTime * 0.16, vUv.y * 3.5 - uTime * 0.08));
          float n2 = vnoise(vec2(vUv.x * 21.0 - uTime * 0.24, vUv.y * 7.0 + n1 * 1.2));
          float billow = n1 * 0.62 + n2 * 0.38;
          // Smoothly grounded at sea level and feathered to strictly 0.0 at top & side borders!
          float vertEnv = smoothstep(0.0, 0.28, vUv.y) * pow(1.0 - smoothstep(0.22, 1.0, vUv.y), 1.5);
          float sideEnv = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          float alpha = smoothstep(0.20, 0.85, billow) * vertEnv * sideEnv * 0.62;
          vec3 fogCol = mix(vec3(0.06, 0.12, 0.22), vec3(0.28, 0.44, 0.66), billow * vUv.y);
          fogCol += vec3(0.48, 0.72, 0.98) * uLightning * 0.38;
          gl_FragColor = vec4(fogCol, alpha);
        }
      `,
    });
    this.horizonMistMesh = new THREE.Mesh(mMist, horizonMistMat);
    this.horizonGroup.add(this.horizonMistMesh);

    // Colossal 3D Normal-Mapped Storm-Lashed Beacon Watchtower on Horizon (`z = -78`, replaces flat black silhouette!)
    const destMonolith = new THREE.Group();
    destMonolith.position.set(-5.2, -1.6, -78);

    const watchtowerStoneMat = new THREE.MeshStandardMaterial({
      color: '#6b82ad',
      map: this.stoneMaps.map,
      normalMap: this.stoneMaps.normalMap,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughnessMap: this.stoneMaps.roughnessMap,
      roughness: 0.28,
      metalness: 0.18,
      emissive: '#0c162b',
      emissiveIntensity: 0.35,
      fog: false,
    });
    watchtowerStoneMat.map.repeat.set(3, 6);
    this._watchtowerStoneMat = watchtowerStoneMat;

    const wtStoneParts = [];
    // Craggy sea-stack reef island base
    const reefBase = buildDisplacedBasaltColumn(4.2, 6.4, 4.6, 10, 991);
    reefBase.translate(0, 1.4, 0);
    wtStoneParts.push(reefBase);
    for (let rk = 0; rk < 5; rk++) {
      const a = (rk / 5) * TAU + 0.3;
      const fang = buildDisplacedBasaltColumn(0.9, 1.8, 3.6 + (rk % 2) * 1.4, 7, 1010 + rk);
      fang.translate(Math.cos(a) * 4.4, 1.2, Math.sin(a) * 3.8);
      wtStoneParts.push(fang);
    }
    // Tapered masonry Watchtower shaft + stepped Romanesque corbel gallery + battlements
    const wtShaft = new THREE.CylinderGeometry(2.45, 3.55, 20.5, 18, 4);
    wtShaft.translate(0, 11.4, 0);
    wtStoneParts.push(wtShaft);
    for (const ringY of [6.8, 12.6, 18.2]) {
      const belt = new THREE.CylinderGeometry(3.25 - ringY * 0.035, 3.05 - ringY * 0.035, 0.55, 18);
      belt.translate(0, ringY, 0);
      wtStoneParts.push(belt);
    }
    const crownGallery = new THREE.CylinderGeometry(3.15, 2.55, 1.8, 18);
    crownGallery.translate(0, 21.8, 0);
    wtStoneParts.push(crownGallery);
    for (let m = 0; m < 10; m++) {
      const ma = (m / 10) * TAU;
      const merlon = new THREE.BoxGeometry(0.68, 0.95, 0.68);
      merlon.rotateY(-ma);
      merlon.translate(Math.cos(ma) * 2.88, 23.0, Math.sin(ma) * 2.88);
      wtStoneParts.push(merlon);
    }
    const pharosCupola = new THREE.CylinderGeometry(1.45, 1.75, 3.2, 12);
    pharosCupola.translate(0, 24.1, 0);
    const pharosDome = new THREE.ConeGeometry(1.85, 1.9, 12);
    pharosDome.translate(0, 26.4, 0);
    wtStoneParts.push(pharosCupola, pharosDome);

    const mWatchtower = mergeGeometries(wtStoneParts, false);
    for (const g of wtStoneParts) g.dispose();
    destMonolith.add(new THREE.Mesh(mWatchtower, watchtowerStoneMat));

    // Glowing Golden Pharos Lantern House + Warm Gallery Windows + Surf Collar
    const beaconParts = [];
    for (let w = 0; w < 5; w++) {
      const wy = 5.8 + w * 3.4;
      const wa = (w % 2 === 0 ? 0.22 : -0.28) + w * 0.08;
      const rAtY = 3.35 - (wy / 21.0) * 0.85;
      const wg = new THREE.PlaneGeometry(1.55, 1.85);
      wg.rotateY(wa);
      wg.translate(Math.sin(wa) * (rAtY + 0.15), wy, Math.cos(wa) * (rAtY + 0.15));
      beaconParts.push(wg);
    }
    const pharosCore = new THREE.PlaneGeometry(5.6, 5.6);
    pharosCore.translate(0, 24.2, 1.8);
    beaconParts.push(pharosCore);
    const mBeacon = mergeGeometries(beaconParts, false);
    for (const g of beaconParts) g.dispose();
    this._destMonolithSprites = new THREE.Mesh(
      mBeacon,
      new THREE.MeshBasicMaterial({
        map: this.softDotTex,
        color: '#ffbe44',
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    destMonolith.add(this._destMonolithSprites);

    // Sweeping Volumetric Searchlight God-Ray Beam cutting through storm rain & sea!
    this.searchlightPivot = new THREE.Group();
    this.searchlightPivot.position.set(0, 24.2, 0.4);
    this.searchlightUniforms = {
      uTime: { value: 0 },
      uCol: { value: new THREE.Color('#ffe49e') },
    };
    const beamConeGeo = new THREE.ConeGeometry(5.2, 62, 24, 1, true);
    beamConeGeo.translate(0, -31, 0);
    beamConeGeo.rotateX(-Math.PI * 0.5); // Apex at origin, opens toward +Z
    const searchlightMat = new THREE.ShaderMaterial({
      uniforms: this.searchlightUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormalV = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCol;
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        void main() {
          // ConeGeometry UV.y: 1.0 at apex (pharos lantern), 0.0 at wide base!
          float distFade = pow(clamp(vUv.y, 0.0, 1.0), 1.25) * smoothstep(0.0, 0.18, vUv.y);
          float edgeSoft = pow(abs(dot(vNormalV, vViewDir)), 1.45);
          float rainShafts = 0.68 + 0.32 * vnoise(vec2(vUv.x * 20.0 + uTime * 1.1, vUv.y * 8.0 - uTime * 3.8));
          float alpha = distFade * edgeSoft * rainShafts * 0.44;
          vec3 col = mix(vec3(0.58, 0.86, 1.0), uCol, smoothstep(0.20, 0.92, vUv.y));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.searchlightMesh = new THREE.Mesh(beamConeGeo, searchlightMat);
    this.searchlightPivot.add(this.searchlightMesh);
    destMonolith.add(this.searchlightPivot);

    // Jagged Forked Storm-Cloud Lightning Bolt behind the Watchtower (flashes on storm strikes!)
    const boltSegs = [];
    const mainSpine = [
      [14.0, 34.0, -8.0], [11.8, 28.5, -8.0], [13.2, 23.8, -8.0],
      [9.6, 18.2, -8.0], [10.8, 12.6, -8.0], [7.8, 5.5, -8.0],
    ];
    const forkA = [[11.8, 28.5, -8.0], [7.4, 24.0, -8.0], [5.2, 19.5, -8.0]];
    const forkB = [[9.6, 18.2, -8.0], [13.8, 14.2, -8.0], [15.4, 9.8, -8.0]];
    for (const chain of [mainSpine, forkA, forkB]) {
      const isMain = chain === mainSpine;
      for (let s = 0; s < chain.length - 1; s++) {
        const [x0, y0, z0] = chain[s];
        const [x1, y1, z1] = chain[s + 1];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        const sg = new THREE.PlaneGeometry(isMain ? 0.42 : 0.22, len + 0.25);
        sg.rotateZ(Math.atan2(dy, dx) - Math.PI * 0.5);
        sg.translate((x0 + x1) * 0.5, (y0 + y1) * 0.5, z0);
        boltSegs.push(sg);
      }
    }
    const mLightning = mergeGeometries(boltSegs, false);
    for (const g of boltSegs) g.dispose();
    this.lightningBoltMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.lightningBoltMesh = new THREE.Mesh(mLightning, this.lightningBoltMat);
    this.lightningBoltMesh.visible = false;
    destMonolith.add(this.lightningBoltMesh);

    this.destMonolith = destMonolith;
    this.horizonGroup.add(destMonolith);
    this.scene.add(this.horizonGroup);
  }

  _initReflectiveStormOcean() {
    this.reflRT = new THREE.WebGLRenderTarget(256, 256, {
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
    });
    this.reflRT.texture.generateMipmaps = false;

    const oceanGeo = new THREE.PlaneGeometry(96, 124, 60, 80);
    oceanGeo.rotateX(-Math.PI * 0.5);

    this.oceanUniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uCraftX: { value: 0 },
        uOnWater: { value: 1 },
        uBoostNorm: { value: 0 },
        normalMap: { value: null },
        reflectionMap: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        useReflection: { value: 1 },
        deepColor: { value: new THREE.Color('#031525') },
        shallowColor: { value: new THREE.Color('#0c6980') },
        skyColor: { value: new THREE.Color('#0d1d38') },
        moonColor: { value: new THREE.Color('#dcebff') },
        moonDir: { value: new THREE.Vector3(0.14, 0.24, -0.96).normalize() },
        foamColor: { value: new THREE.Color('#e2f1fc') },
      },
    ]);
    this.oceanUniforms.normalMap.value = this.waterNormalTex;
    this.oceanUniforms.reflectionMap.value = this.reflRT.texture;
    this.oceanUniforms.textureMatrix.value = this._texMatrix;

    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      fog: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uScroll;
        uniform mat4 textureMatrix;
        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying float vCorridorMix;
        varying vec4 vReflCoord;
        #include <fog_pars_vertex>

        vec3 stormWaves(vec2 p, float t) {
          float h = 0.0;
          float dx = 0.0;
          float dz = 0.0;

          vec2 d0 = normalize(vec2(0.28, 1.0));
          vec2 d1 = normalize(vec2(-0.42, 0.91));
          vec2 d2 = normalize(vec2(0.76, 0.65));
          vec2 d3 = normalize(vec2(-0.82, 0.57));

          float ph0 = dot(d0, p) * 0.34 + t * 1.6;
          h += sin(ph0) * 0.28;
          float c0 = cos(ph0) * 0.28 * 0.34;
          dx += c0 * d0.x; dz += c0 * d0.y;

          float ph1 = dot(d1, p) * 0.58 + t * 2.1;
          h += sin(ph1) * 0.16;
          float c1 = cos(ph1) * 0.16 * 0.58;
          dx += c1 * d1.x; dz += c1 * d1.y;

          float ph2 = dot(d2, p) * 1.05 + t * 2.8;
          h += sin(ph2) * 0.085;
          float c2 = cos(ph2) * 0.085 * 1.05;
          dx += c2 * d2.x; dz += c2 * d2.y;

          float ph3 = dot(d3, p) * 1.75 + t * 3.4;
          h += sin(ph3) * 0.045;
          float c3 = cos(ph3) * 0.045 * 1.75;
          dx += c3 * d3.x; dz += c3 * d3.y;

          return vec3(h, dx, dz);
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          // Huge dramatic 3D storm swells outside the lanes; crisp playable chop inside [-3.6, +3.6]
          float flank = mix(0.30, 1.28, smoothstep(3.2, 8.2, abs(wp.x)));
          vCorridorMix = flank;
          vec2 samplePos = vec2(wp.x, wp.z - uScroll);
          vec3 w = stormWaves(samplePos, uTime) * flank;
          wp.y += w.x;
          vHeight = w.x;
          vSwellN = normalize(vec3(-w.y, 1.0, -w.z));
          vWorld = wp.xyz;
          vReflCoord = textureMatrix * vec4(position, 1.0);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uScroll;
        uniform float uCraftX;
        uniform float uOnWater;
        uniform float uBoostNorm;
        uniform sampler2D normalMap;
        uniform sampler2D reflectionMap;
        uniform float useReflection;
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 skyColor;
        uniform vec3 moonColor;
        uniform vec3 moonDir;
        uniform vec3 foamColor;
        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying float vCorridorMix;
        varying vec4 vReflCoord;
        #include <fog_pars_fragment>

        vec3 sampleN(vec2 uv) { return texture2D(normalMap, uv).xyz * 2.0 - 1.0; }

        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec2 sp = vec2(vWorld.x, vWorld.z - uScroll);

          // 4-octave scrolling wave normal layers
          vec3 n1 = sampleN(sp * 0.11 + vec2(uTime * 0.03, uTime * 0.02));
          vec3 n2 = sampleN(sp * 0.24 + vec2(-uTime * 0.025, uTime * 0.035));
          vec3 n3 = sampleN(sp * 0.52 + vec2(uTime * 0.045, -uTime * 0.03));
          vec3 n4 = sampleN(sp * 1.05 + vec2(-uTime * 0.06, -uTime * 0.05));
          vec3 rip = n1 + n2 * 0.82 + n3 * 0.58 + n4 * 0.35;

          vec3 viewVec = cameraPosition - vWorld;
          float dist = length(viewVec);
          vec3 v = viewVec / max(dist, 1e-4);
          float detail = mix(1.0, 0.24, smoothstep(14.0, 82.0, dist));

          // Dynamic V-shaped Kelvin bow-wake carved behind the Hydro-Skimmer at (uCraftX, 0)
          float dzWake = vWorld.z + 0.35;
          float wakeFoam = 0.0;
          vec2 wakeN = vec2(0.0);
          if (dzWake > 0.0 && dzWake < 11.5) {
            float halfSpread = 0.28 + dzWake * (0.24 + uBoostNorm * 0.06);
            float ax = abs(vWorld.x - uCraftX);
            float armDist = abs(ax - halfSpread);
            float env = exp(-dzWake * 0.26) * uOnWater;
            float armBand = exp(-armDist * armDist * 14.0) * env;
            float centerWash = exp(-ax * ax * 3.8) * exp(-dzWake * 0.32) * env;
            float turb = vnoise(vec2(vWorld.x * 5.5, (vWorld.z - uScroll * 1.4) * 3.2));
            wakeFoam = clamp((armBand * 0.95 + centerWash * 0.65) * (0.55 + turb * 0.75), 0.0, 1.0);
            wakeN.x = sign(vWorld.x - uCraftX) * armBand * 0.65;
          }

          vec3 n = normalize(vSwellN + vec3(rip.x * 0.22 * detail + wakeN.x, 0.0, rip.y * 0.22 * detail));

          // Schlick Fresnel (water F0 = 0.02)
          float cosT = clamp(dot(n, v), 0.0, 1.0);
          float fres = clamp(0.02 + 0.98 * pow(1.0 - cosT, 5.0), 0.0, 0.92);

          vec3 refl = skyColor * 1.15;
          if (useReflection > 0.5 && vReflCoord.w > 0.0) {
            vec2 rc = vReflCoord.xy / vReflCoord.w;
            rc += n.xz * 0.048 * detail;
            rc = clamp(rc, vec2(0.002), vec2(0.998));
            refl = texture2D(reflectionMap, rc).rgb;
            refl = (refl / (1.0 + refl * 0.65)) * 0.65;
          }

          // Deep storm body + turquoise subsurface scattering through lifted wave crests
          float crest = clamp(vHeight * 2.4 + 0.42, 0.0, 1.0);
          vec3 body = mix(deepColor, shallowColor, crest * 0.58);
          float sss = pow(clamp(dot(v, -moonDir) * 0.5 + 0.5, 0.0, 1.0), 3.0) * crest;
          body += shallowColor * sss * 0.65;

          vec3 col = mix(body, refl, fres);

          // Silver-blue moon glitter path dancing across wave facets (HDR-bloom-safe razor glints!)
          vec3 hVec = normalize(moonDir + v);
          float spec = pow(max(dot(n, hVec), 0.0), 380.0) * 1.45 + pow(max(dot(n, hVec), 0.0), 95.0) * 0.075;
          col += moonColor * spec;

          // White-capped storm swell foam + speed wake lace
          float nFoam = vnoise(sp * 1.85 + vec2(uTime * 0.35, -uTime * 0.25)) * 0.65
                      + vnoise(sp * 4.4 - vec2(uTime * 0.5, 0.0)) * 0.35;
          float whitecap = smoothstep(0.11, 0.32, vHeight) * smoothstep(0.44, 0.76, nFoam);
          float streakFoam = smoothstep(0.74, 0.92, vnoise(vec2(sp.x * 2.8, sp.y * 0.45))) * 0.22 * vCorridorMix;
          float totalFoam = clamp(whitecap * 0.88 + streakFoam + wakeFoam, 0.0, 1.0);
          col = mix(col, foamColor, totalFoam * 0.82);

          // Blend far ocean horizon smoothly into moonlit sea-mist bank so zero 1px CG seam exists
          col = mix(col, skyColor * 1.18, smoothstep(64.0, 96.0, dist));

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.oceanMesh.position.set(0, -0.04, -44);
    this.scene.add(this.oceanMesh);
  }

  _updatePlanarReflection() {
    const r = this.webgl;
    if (!r) return;
    const useRefl = this.dpr >= 1.0 ? 1 : 0;
    this.oceanUniforms.useReflection.value = useRefl;
    if (!useRefl) return;

    const mesh = this.oceanMesh;
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

    // Reflect ONLY sky + moon + primary cloud bank + nearest coastal sea-stack stone arches (#183: ~6 reflection calls!)
    mesh.visible = false;
    const prevCraftVis = this.craftGroup ? this.craftGroup.visible : false;
    const prevSprayVis = this.sprayPoints ? this.sprayPoints.visible : false;
    const prevSpeedVis = this.speedLineInst ? this.speedLineInst.visible : false;
    if (this.craftGroup) this.craftGroup.visible = false;
    if (this.sprayPoints) this.sprayPoints.visible = false;
    if (this.speedLineInst) this.speedLineInst.visible = false;
    if (this.rainMesh) this.rainMesh.visible = false;
    if (this.moonCorona) this.moonCorona.visible = false;
    if (this.horizonMistMesh) this.horizonMistMesh.visible = false;
    if (this.stormClouds[0]) this.stormClouds[0].visible = false;
    if (this.destMonolith) this.destMonolith.visible = false;
    if (this.gearGroup) this.gearGroup.visible = false;
    if (this.boltGroup) this.boltGroup.visible = false;
    if (this.gateInstGroup) this.gateInstGroup.visible = false;
    if (this.gameplayInstGroup) this.gameplayInstGroup.visible = false;
    for (let i = 0; i < this.gatePool.length; i++) this.gatePool[i].userData._rVis = this.gatePool[i].visible, (this.gatePool[i].visible = false);
    for (let i = 0; i < this.seaArches.length; i++) {
      const ag = this.seaArches[i].group;
      ag.userData._rVis = ag.visible;
      if (ag.userData.detailGrp) {
        ag.userData._rDetVis = ag.userData.detailGrp.visible;
        ag.userData.detailGrp.visible = false;
      }
      if (ag.visible && (ag.position.z < -36 || ag.position.z > 2)) ag.visible = false;
    }

    r.setRenderTarget(this.reflRT);
    r.state.buffers.depth.setMask(true);
    r.clear(true, true, false);
    r.render(this.scene, vc);

    mesh.visible = true;
    if (this.craftGroup) this.craftGroup.visible = prevCraftVis;
    if (this.sprayPoints) this.sprayPoints.visible = prevSprayVis;
    if (this.speedLineInst) this.speedLineInst.visible = prevSpeedVis;
    if (this.rainMesh) this.rainMesh.visible = this.era === 'reboot';
    if (this.moonCorona) this.moonCorona.visible = true;
    if (this.horizonMistMesh) this.horizonMistMesh.visible = true;
    if (this.stormClouds[0]) this.stormClouds[0].visible = true;
    if (this.destMonolith) this.destMonolith.visible = true;
    if (this.gearGroup) this.gearGroup.visible = true;
    if (this.boltGroup) this.boltGroup.visible = true;
    if (this.gateInstGroup) this.gateInstGroup.visible = true;
    if (this.gameplayInstGroup) this.gameplayInstGroup.visible = true;
    for (let i = 0; i < this.gatePool.length; i++) this.gatePool[i].visible = Boolean(this.gatePool[i].userData._rVis);
    for (let i = 0; i < this.seaArches.length; i++) {
      const ag = this.seaArches[i].group;
      ag.visible = Boolean(ag.userData._rVis);
      if (ag.userData.detailGrp) ag.userData.detailGrp.visible = Boolean(ag.userData._rDetVis);
    }
  }

  _initCoastalCorridor() {
    this.seaArches = [];
    const spacing = ARCH_SPAN_Z / ARCH_COUNT;
    for (let i = 0; i < ARCH_COUNT; i++) {
      const grp = buildCoastalArchSetpiece(i, this.mats, this.sharedGeos);
      this.scene.add(grp);
      this.seaArches.push({ group: grp, seedZ: i * spacing });
    }
  }

  _initHeroCraftAndPogo() {
    this.craftGroup = new THREE.Group();
    this.hullMount = new THREE.Group();

    this.procHull = buildProceduralSkimmerHull(this.mats);
    this.hullMount.add(this.procHull);
    this.craftGroup.add(this.hullMount);

    // Sculpted Cockpit Twin-Yoke Brass Helm Handlebar & Glowing Holographic Dash Console (merged to 2 draw calls!)
    const helmGroup = new THREE.Group();
    const helmBrassGeos = [];
    const stem = new THREE.CylinderGeometry(0.022, 0.028, 0.24, 8);
    stem.rotateX(0.38);
    stem.translate(0, 0.08, -0.18);
    const crossBar = new THREE.CylinderGeometry(0.016, 0.016, 0.34, 8);
    crossBar.rotateZ(Math.PI * 0.5);
    crossBar.translate(0, 0.17, -0.13);
    helmBrassGeos.push(stem, crossBar);
    for (const gx of [-0.16, 0.16]) {
      const grip = new THREE.CylinderGeometry(0.022, 0.022, 0.08, 8);
      grip.rotateZ(Math.PI * 0.5);
      grip.translate(gx, 0.17, -0.13);
      helmBrassGeos.push(grip);
    }
    const mHelm = mergeGeometries(helmBrassGeos, false);
    for (const g of helmBrassGeos) g.dispose();
    const holoScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.10),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      })
    );
    holoScreen.position.set(0, 0.145, -0.22);
    holoScreen.rotation.x = -0.55;
    helmGroup.add(new THREE.Mesh(mHelm, this.mats.tarnishedBrass), holoScreen);
    this.helmYoke = helmGroup;
    this.craftGroup.add(helmGroup);

    // Real 33-Bone `PogoRig` Explorer Pogo V3 seated heroically in the open cockpit!
    this.pogoSeat = new THREE.Group();
    this.pogoSeat.position.set(0, -0.11, 0.08);
    this.pogoSeat.rotation.y = Math.PI; // Faces -Z (forward down the storm corridor!)
    this.pogoRig = new PogoRig(this.skinId);
    this.pogoRig.group.scale.setScalar(0.84);
    this.pogoSeat.add(this.pogoRig.group);
    this.craftGroup.add(this.pogoSeat);
    this.craftGroup.scale.setScalar(1.08);

    // Twin Stern Volumetric Plasma-Cyan Afterburners + Supersonic Mach Shock-Diamond Rings!
    this.jetGroup = new THREE.Group();
    this.jetUniforms = {
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uCol: { value: new THREE.Color('#22d3ee') },
    };
    this.jetOuterMat = new THREE.ShaderMaterial({
      uniforms: this.jetUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormalV = normalize(normalMatrix * normal);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uBoost;
        uniform vec3 uCol;
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        void main() {
          // vUv.y: 1.0 at nozzle throat, 0.0 at trailing plume tip
          float axial = clamp(vUv.y, 0.0, 1.0);
          float fres = pow(abs(dot(vNormalV, vViewDir)), 1.35);
          float turb = vnoise(vec2(vUv.x * 8.0, axial * 12.0 + uTime * 24.0)) * 0.65
                     + vnoise(vec2(vUv.x * 16.0, axial * 24.0 + uTime * 38.0)) * 0.35;
          // Supersonic Mach shock-diamond standing nodes along the plasma jet!
          float machWave = pow(max(0.0, sin((1.0 - axial) * 24.0 - uTime * 28.0)), 6.0) * smoothstep(0.12, 0.92, axial);
          float throat = smoothstep(0.55, 1.0, axial);
          float tailFade = pow(axial, 0.85) * smoothstep(0.0, 0.14, axial);
          float intensity = (0.48 + turb * 0.55 + machWave * (0.85 + uBoost * 0.55)) * tailFade * (0.35 + 0.65 * fres);
          vec3 plasmaCol = mix(vec3(0.08, 0.45, 0.95), uCol, smoothstep(0.15, 0.72, axial));
          plasmaCol = mix(plasmaCol, vec3(0.88, 0.98, 1.0), clamp(throat * 0.72 + machWave * 0.78, 0.0, 0.92));
          gl_FragColor = vec4(plasmaCol, clamp(intensity * (0.82 + uBoost * 0.25), 0.0, 0.95));
        }
      `,
    });

    const plumeGeos = [];
    const machRingGeos = [];
    for (const tx of [-0.15, 0.15]) {
      // Multi-layered tapered volumetric plasma shell + tight core cylinder (zero hard flat cone triangles!)
      const outerShroud = new THREE.CylinderGeometry(0.016, 0.098, 1.42, 16, 10, true);
      outerShroud.rotateX(Math.PI * 0.5);
      outerShroud.translate(tx, 0, 0.71);
      plumeGeos.push(outerShroud);

      const innerCore = new THREE.CylinderGeometry(0.008, 0.054, 0.92, 12, 6, true);
      innerCore.rotateX(Math.PI * 0.5);
      innerCore.translate(tx, 0, 0.46);
      plumeGeos.push(innerCore);

      // 3 stepped 3D Supersonic Mach Shock-Rings per thruster!
      for (let mr = 0; mr < 3; mr++) {
        const rad = 0.086 - mr * 0.016;
        const ringG = new THREE.TorusGeometry(rad, 0.011 - mr * 0.002, 6, 18);
        ringG.translate(tx, 0, 0.14 + mr * 0.26);
        machRingGeos.push(ringG);
      }
    }
    const mJetPlume = mergeGeometries(plumeGeos, false);
    for (const g of plumeGeos) g.dispose();
    const mMachRings = mergeGeometries(machRingGeos, false);
    for (const g of machRingGeos) g.dispose();

    this.machRingMat = new THREE.MeshBasicMaterial({
      color: '#a5f3fc',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.machRingsMesh = new THREE.Mesh(mMachRings, this.machRingMat);
    this.jetGroup.position.set(0, 0.09, 0.88);
    this.jetGroup.add(
      new THREE.Mesh(mJetPlume, this.jetOuterMat),
      this.machRingsMesh
    );
    this.jetPlumes = [this.jetGroup];
    this.craftGroup.add(this.jetGroup);

    // Custom GLSL Churning Frothy Bow-Wake Wings & Multi-Lobed 3D Rooster-Tail Spray Plume!
    this.wakeUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.88 },
      uBoost: { value: 0 },
    };
    const wakeShaderMat = new THREE.ShaderMaterial({
      uniforms: this.wakeUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uBoost;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          float scroll = uTime * (5.8 + uBoost * 3.2);
          float n1 = vnoise(vec2(vUv.x * 8.0 - scroll, vUv.y * 6.0));
          float n2 = vnoise(vec2(vUv.x * 18.0 - scroll * 1.7, vUv.y * 12.0 + n1 * 1.4));
          float n3 = vnoise(vec2(vUv.x * 32.0 - scroll * 2.3, vUv.y * 20.0));
          float lace = smoothstep(0.24, 0.84, n1 * 0.50 + n2 * 0.34 + n3 * 0.16);
          float fadeAlong = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265);
          float fadeAcross = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);
          float alpha = lace * fadeAlong * fadeAcross * uOpacity;
          // Plasma-cyan afterburner backlight near stern nozzle blending into silver-white seafoam spray!
          float nozzleGlow = exp(-vUv.x * 3.6);
          vec3 col = mix(vec3(0.42, 0.78, 0.96), vec3(0.84, 0.94, 1.0), lace);
          col += vec3(0.12, 0.72, 0.92) * nozzleGlow * (0.45 + uBoost * 0.45);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.wakeGroup = new THREE.Group();
    const ribGeos = [];
    for (const sx of [-1, 1]) {
      const rg = new THREE.PlaneGeometry(2.8, 0.56, 10, 2);
      rg.rotateY(Math.PI * 0.5);
      rg.rotateX(-Math.PI * 0.5);
      rg.rotateY(sx * -0.26);
      rg.translate(sx * 0.72, -0.14, 1.25);
      ribGeos.push(rg);
    }
    const mRibbons = mergeGeometries(ribGeos, false);
    for (const g of ribGeos) g.dispose();
    this.wakeGroup.add(new THREE.Mesh(mRibbons, wakeShaderMat));

    this.roosterTail = new THREE.Mesh(buildRoosterTailGeometry(), wakeShaderMat);
    this.wakeGroup.add(this.roosterTail);
    this.craftGroup.add(this.wakeGroup);

    this.scene.add(this.craftGroup);
  }

  _initSprayAndSpeedVfx() {
    // 220-particle 3D Frothy Water Spray & Mist Points Pool (zero GC!)
    this._sprayData = Array.from({ length: MAX_SPRAY }, () => ({
      x: 0,
      y: -10,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      size: 0.2,
    }));
    this._sprayCursor = 0;
    this._sprayEmitAcc = 0;
    this._wasOnWater = true;

    const sGeo = new THREE.BufferGeometry();
    this._sprayPos = new Float32Array(MAX_SPRAY * 3);
    this._sprayAlpha = new Float32Array(MAX_SPRAY);
    this._spraySize = new Float32Array(MAX_SPRAY);
    sGeo.setAttribute('position', new THREE.BufferAttribute(this._sprayPos, 3));
    sGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this._sprayAlpha, 1));
    sGeo.setAttribute('aSize', new THREE.BufferAttribute(this._spraySize, 1));

    this.sprayMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: this.softDotTex },
        uPR: { value: this.dpr },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        uniform float uPR;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPR * (210.0 / max(0.5, -mv.z)), 1.0, 64.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.84, 0.95, 1.0) * t.rgb, t.a * vAlpha);
        }
      `,
    });
    this.sprayPoints = new THREE.Points(sGeo, this.sprayMat);
    this.sprayPoints.frustumCulled = false;
    this.scene.add(this.sprayPoints);

    // Peripheral High-Speed Boost Wind Streaks (`InstancedMesh` -> 1 single draw call!)
    const streakCount = 24;
    this.speedLineMat = new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedLineInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.026, 0.026, 3.2),
      this.speedLineMat,
      streakCount
    );
    this.speedLineInst.frustumCulled = false;
    this._speedLineSeeds = Array.from({ length: streakCount }, (_, i) => ({
      baseX: (i % 2 === 0 ? -1 : 1) * (2.8 + ((i * 17) % 9) * 0.34),
      baseY: 0.45 + ((i * 23) % 8) * 0.45,
      seedZ: (i / streakCount) * 46,
    }));
    this._dummyMat = new THREE.Matrix4();
    this.scene.add(this.speedLineInst);

    // Driving Diagonal 3D Storm Rain Streaks (280 wind-lashed rain ribbons in 1 single GPU draw call!)
    const rainCount = 280;
    const rngRain = mulberry32(71829);
    const rPos = new Float32Array(rainCount * 4 * 3);
    const rSeed = new Float32Array(rainCount * 4 * 3);
    const rUv = new Float32Array(rainCount * 4 * 2);
    const rIdx = [];
    for (let i = 0; i < rainCount; i++) {
      const sx = (rngRain() - 0.5) * 32.0;
      const sy = rngRain() * 24.0;
      const sz = -rngRain() * 52.0 + 4.0;
      const len = 1.15 + rngRain() * 0.85;
      const hw = 0.013;
      const slantX = -0.34 * len; // Wind-lashed diagonal storm angle!
      const vBase = i * 4;
      const corners = [
        [-hw, 0, 0, 0],
        [hw, 0, 0, 0],
        [hw + slantX, -len, 0.35, 1],
        [-hw + slantX, -len, 0.35, 1],
      ];
      for (let c = 0; c < 4; c++) {
        const vi = (vBase + c) * 3;
        rPos[vi] = corners[c][0];
        rPos[vi + 1] = corners[c][1];
        rPos[vi + 2] = corners[c][2];
        rSeed[vi] = sx;
        rSeed[vi + 1] = sy;
        rSeed[vi + 2] = sz;
        rUv[(vBase + c) * 2] = c === 1 || c === 2 ? 1 : 0;
        rUv[(vBase + c) * 2 + 1] = corners[c][3];
      }
      rIdx.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(rSeed, 3));
    rainGeo.setAttribute('uv', new THREE.BufferAttribute(rUv, 2));
    rainGeo.setIndex(rIdx);

    this.rainUniforms = {
      uTime: { value: 0 },
      uCamX: { value: 0 },
      uLightning: { value: 0 },
    };
    const rainMat = new THREE.ShaderMaterial({
      uniforms: this.rainUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uCamX;
        varying vec2 vUv;
        varying float vDepthFade;
        void main() {
          vUv = uv;
          float fall = mod(aSeed.y - uTime * 26.0, 24.0) - 2.0;
          float driftX = mod(aSeed.x - uTime * 7.8 + 16.0, 32.0) - 16.0 + uCamX;
          float rushZ = mod(aSeed.z + uTime * 22.0 + 48.0, 52.0) - 46.0;
          vec3 wp = vec3(driftX, fall, rushZ) + position;
          vec4 mv = modelViewMatrix * vec4(wp, 1.0);
          vDepthFade = smoothstep(-48.0, -8.0, mv.z) * smoothstep(-1.2, -4.5, mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uLightning;
        varying vec2 vUv;
        varying float vDepthFade;
        void main() {
          float tip = sin(clamp(vUv.y, 0.0, 1.0) * 3.14159265);
          float alpha = tip * vDepthFade * (0.24 + uLightning * 0.35);
          vec3 col = mix(vec3(0.56, 0.76, 0.96), vec3(0.92, 0.97, 1.0), uLightning);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.rainMesh = new THREE.Mesh(rainGeo, rainMat);
    this.rainMesh.frustumCulled = false;
    this.scene.add(this.rainMesh);
  }

  _spawnSprayDroplet(x, y, z, vx, vy, vz, size, maxLife) {
    const p = this._sprayData[this._sprayCursor];
    this._sprayCursor = (this._sprayCursor + 1) % MAX_SPRAY;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.maxLife = maxLife;
    p.life = maxLife;
  }

  _buildSharedGateStaticGeos() {
    const staticBrass = [];
    const staticObsidian = [];

    const outerArch = new THREE.TorusGeometry(1.42, 0.095, 10, 32, Math.PI);
    outerArch.translate(0, 0.18, 0);
    staticBrass.push(outerArch);

    const innerObs = new THREE.TorusGeometry(1.29, 0.065, 8, 28, Math.PI);
    innerObs.translate(0, 0.18, 0);
    staticObsidian.push(innerObs);

    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI;
      const clampBlk = new THREE.BoxGeometry(0.12, 0.24, 0.24);
      clampBlk.rotateZ(a - Math.PI * 0.5);
      clampBlk.translate(Math.cos(a) * 1.42, 0.18 + Math.sin(a) * 1.42, 0);
      staticBrass.push(clampBlk);
    }
    for (const sx of [-1.42, 1.42]) {
      const buoy = new THREE.CylinderGeometry(0.24, 0.30, 0.42, 10);
      buoy.translate(sx, 0.02, 0);
      staticObsidian.push(buoy);
      const collar = new THREE.CylinderGeometry(0.31, 0.31, 0.09, 10);
      collar.translate(sx, 0.16, 0);
      staticBrass.push(collar);
    }
    for (const ga of [0.22 * Math.PI, 0.39 * Math.PI, 0.61 * Math.PI, 0.78 * Math.PI]) {
      const cogG = this.sharedGeos.pinionGear.clone();
      cogG.translate(Math.cos(ga) * 1.54, 0.18 + Math.sin(ga) * 1.54, 0.06);
      staticBrass.push(cogG);
    }

    const mBrass = mergeGeometries(staticBrass, false);
    for (const g of staticBrass) g.dispose();
    const mObs = mergeGeometries(staticObsidian, false);
    for (const g of staticObsidian) g.dispose();

    const foamGeos = [];
    for (const sx of [-1.42, 1.42]) {
      const fg = new THREE.PlaneGeometry(1.25, 1.25);
      fg.rotateX(-Math.PI * 0.5);
      fg.translate(sx, -0.02, 0);
      foamGeos.push(fg);
    }
    const mGateFoam = mergeGeometries(foamGeos, false);
    for (const g of foamGeos) g.dispose();

    return { mBrass, mObs, mGateFoam };
  }

  _buildBoostGateSlot() {
    const grp = new THREE.Group();
    const cogs = [];

    // Custom GLSL Holographic Speed-Chevron Forcefield Curtain + Crisp Neon Inner Rim Tube (1 draw call!)
    const curtainUniforms = {
      uTime: { value: 0 },
      uCol: { value: new THREE.Color('#38bdf8') },
      uHit: { value: 0 },
    };
    const curtainMat = new THREE.ShaderMaterial({
      uniforms: curtainUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uCol;
        uniform float uHit;
        varying vec2 vPos;
        void main() {
          float r = length(vPos) / 1.22;
          if (r > 1.0 || vPos.y < -0.02) discard;
          float neonTube = smoothstep(0.92, 0.968, r) * (1.0 - smoothstep(0.985, 1.0, r));
          float edge = smoothstep(0.66, 0.96, r);
          float chev = 0.5 + 0.5 * sin((vPos.y * 9.0 - abs(vPos.x) * 5.5 - uTime * 7.5));
          chev = smoothstep(0.55, 0.95, chev) * (1.0 - smoothstep(0.93, 0.97, r));
          float alpha = clamp(neonTube * 0.95 + (edge * 0.48 + chev * 0.24) * (1.0 - uHit * 0.72), 0.0, 1.0);
          vec3 col = mix(uCol, vec3(1.0, 0.95, 0.6), uHit);
          col = mix(col, vec3(1.0), neonTube * 0.45);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const curtain = new THREE.Mesh(new THREE.CircleGeometry(1.22, 28, 0, Math.PI), curtainMat);
    curtain.position.y = 0.18;
    grp.add(curtain);

    // Crown Holographic Multiplier Badge (`2X`..`4X`)
    const badgeMat = new THREE.MeshBasicMaterial({
      map: this.boostBadgeTex[1],
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.46), badgeMat);
    badge.position.set(0, 1.88, 0.08);
    grp.add(badge);

    grp.visible = false;
    grp.userData = { curtainUniforms, badgeMat, cogs, tierIdx: -1 };
    return grp;
  }

  _initGameplayPools() {
    this.gameplayInstGroup = new THREE.Group();
    this.scene.add(this.gameplayInstGroup);
    this._foamDummy = new THREE.Object3D();

    const makeInst = (geo, mat, maxCount) => {
      const inst = new THREE.InstancedMesh(geo, mat, maxCount);
      inst.count = 0;
      inst.visible = false;
      inst.frustumCulled = false;
      this.gameplayInstGroup.add(inst);
      return inst;
    };

    // 1. Boost Gate static brass/obsidian/foam instancing + per-gate holographic curtain/badge
    const gateGeos = this._buildSharedGateStaticGeos();
    this.gateInstGroup = this.gameplayInstGroup;
    this.gateBrassInst = makeInst(gateGeos.mBrass, this.mats.tarnishedBrass, MAX_GATES);
    this.gateObsInst = makeInst(gateGeos.mObs, this.mats.carvedObsidian, MAX_GATES);
    this.gateFoamInst = makeInst(gateGeos.mGateFoam, this.mats.archFoam, MAX_GATES);

    this.gatePool = Array.from({ length: MAX_GATES }, () => {
      const g = this._buildBoostGateSlot();
      this.scene.add(g);
      return g;
    });

    // 2. O(1) Instanced Curling Wave-Ramps + Launch Chevrons
    const chevParts = [];
    for (let c = 0; c < 3; c++) {
      const cg = new THREE.RingGeometry(0.19, 0.26, 3);
      cg.rotateZ(Math.PI * 0.5);
      cg.rotateX(-Math.PI * 0.34);
      cg.translate(0, 0.24 + c * 0.34, 0.48 - c * 0.50);
      chevParts.push(cg);
    }
    const mChev = mergeGeometries(chevParts, false);
    for (const g of chevParts) g.dispose();
    this.rampChevMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.rampWaveInst = makeInst(this.sharedGeos.waveRamp, this.mats.waveRamp, MAX_RAMPS);
    this.rampChevInst = makeInst(mChev, this.rampChevMat, MAX_RAMPS);
    this.rampPool = [];

    // 3. O(1) Instanced Hazards: Naval Mines (`sea_mine.glb` + procedural fallback), Salvage Crates, Basalt Rocks & Surf Foam
    const mSphere = new THREE.IcosahedronGeometry(0.35, 2);
    const mBrassParts = [];
    const mEyeParts = [];
    const collar = new THREE.TorusGeometry(0.355, 0.028, 6, 20);
    collar.rotateX(Math.PI * 0.5);
    mBrassParts.push(collar);
    const up = new THREE.Vector3(0, 1, 0);
    const qTmp = new THREE.Quaternion();
    const m4Tmp = new THREE.Matrix4();
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
      [0.68, 0.58, 0.44], [-0.68, 0.58, 0.44], [0.68, 0.58, -0.44], [-0.68, 0.58, -0.44],
      [0, 0.32, 0.94], [0, 0.32, -0.94],
    ];
    for (const [dx, dy, dz] of dirs) {
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      qTmp.setFromUnitVectors(up, dir);
      m4Tmp.compose(dir.clone().multiplyScalar(0.38), qTmp, new THREE.Vector3(1, 1, 1));
      const sg = new THREE.CylinderGeometry(0.018, 0.045, 0.19, 6);
      sg.applyMatrix4(m4Tmp);
      mBrassParts.push(sg);
      const cg = new THREE.SphereGeometry(0.028, 6, 6);
      cg.translate(0, 0.1, 0);
      cg.applyMatrix4(m4Tmp);
      mEyeParts.push(cg);
    }
    const mMineBrass = mergeGeometries(mBrassParts, false);
    for (const g of mBrassParts) g.dispose();
    const mMineEyes = mergeGeometries(mEyeParts, false);
    for (const g of mEyeParts) g.dispose();
    this.procMineInsts = [
      makeInst(mSphere, this.mats.rustedIron, MAX_HAZARDS),
      makeInst(mMineBrass, this.mats.tarnishedBrass, MAX_HAZARDS),
      makeInst(mMineEyes, this.mats.redMineEye, MAX_HAZARDS),
    ];
    this.glbMineInsts = null;

    // Iron-Bound Barnacle Cryo-Casks / Salvage Barrels (replaces brown PS1 stripe boxes!)
    const caskProfile = [
      new THREE.Vector2(0.01, -0.48),
      new THREE.Vector2(0.31, -0.46),
      new THREE.Vector2(0.41, -0.26),
      new THREE.Vector2(0.45, 0.0),
      new THREE.Vector2(0.41, 0.26),
      new THREE.Vector2(0.31, 0.46),
      new THREE.Vector2(0.01, 0.48),
    ];
    const caskBodyGeo = new THREE.LatheGeometry(caskProfile, 14);
    caskBodyGeo.rotateZ(0.28); // Tilted heavy ocean-drifting salvage cask!

    const caskIronParts = [];
    const caskGlowParts = [];
    const tiltM = new THREE.Matrix4().makeRotationZ(0.28);
    // 4 heavy riveted wrought-iron barrel hoops + top/bottom chine rings
    for (const [hy, hr] of [[-0.41, 0.35], [-0.18, 0.445], [0.18, 0.445], [0.41, 0.35]]) {
      const hoop = new THREE.TorusGeometry(hr, 0.028, 7, 18);
      hoop.rotateX(Math.PI * 0.5);
      hoop.translate(0, hy, 0);
      hoop.applyMatrix4(tiltM);
      caskIronParts.push(hoop);
    }
    // 4 longitudinal iron cage straps + lifting padeye ring + encrusted coastal barnacles + glowing cryo-amber portholes!
    for (let st = 0; st < 4; st++) {
      const a = (st / 4) * TAU + 0.35;
      const strap = new THREE.BoxGeometry(0.055, 0.88, 0.045);
      strap.rotateY(-a);
      strap.translate(Math.cos(a) * 0.43, 0, Math.sin(a) * 0.43);
      strap.applyMatrix4(tiltM);
      caskIronParts.push(strap);

      // Recessed glowing salvage containment core viewport between iron ribs!
      const portA = a + Math.PI * 0.25;
      const port = new THREE.OctahedronGeometry(0.095, 0);
      port.scale(0.85, 1.35, 0.55);
      port.rotateY(-portA);
      port.translate(Math.cos(portA) * 0.41, (st % 2 === 0 ? 0.03 : -0.03), Math.sin(portA) * 0.41);
      port.applyMatrix4(tiltM);
      caskGlowParts.push(port);

      const bezel = new THREE.TorusGeometry(0.095, 0.02, 6, 12);
      bezel.rotateY(-portA + Math.PI * 0.5);
      bezel.translate(Math.cos(portA) * 0.43, (st % 2 === 0 ? 0.03 : -0.03), Math.sin(portA) * 0.43);
      bezel.applyMatrix4(tiltM);
      caskIronParts.push(bezel);
    }
    // Top forged-iron mooring shackle + calcified barnacle clusters around waterline
    const shackle = new THREE.TorusGeometry(0.11, 0.024, 6, 14);
    shackle.translate(0, 0.52, 0);
    shackle.applyMatrix4(tiltM);
    caskIronParts.push(shackle);
    for (let bn = 0; bn < 9; bn++) {
      const ba = bn * 1.95;
      const by = -0.34 + (bn % 3) * 0.14;
      const bCone = new THREE.ConeGeometry(0.058, 0.075, 6, 1, true);
      bCone.rotateZ(-Math.PI * 0.5);
      bCone.rotateY(-ba);
      bCone.translate(Math.cos(ba) * 0.44, by, Math.sin(ba) * 0.44);
      bCone.applyMatrix4(tiltM);
      caskIronParts.push(bCone);
    }
    const mCaskIron = mergeGeometries(caskIronParts, false);
    for (const g of caskIronParts) g.dispose();
    const mCaskGlow = mergeGeometries(caskGlowParts, false);
    for (const g of caskGlowParts) g.dispose();

    this.crateWoodInst = makeInst(caskBodyGeo, this.mats.crateWood, MAX_HAZARDS);
    this.crateAmberInst = makeInst(mCaskGlow, this.mats.amberGlow, MAX_HAZARDS);
    this.crateIronInst = makeInst(mCaskIron, this.mats.rustedIron, MAX_HAZARDS);

    // Basalt Sea-Tooth Rock instanced parts
    const mainTooth = buildDisplacedBasaltColumn(0.18, 0.72, 2.25, 7, 501);
    mainTooth.translate(0, 0.68, 0);
    const leftTooth = buildDisplacedBasaltColumn(0.14, 0.48, 1.38, 6, 502);
    leftTooth.rotateZ(0.24);
    leftTooth.translate(-0.42, 0.25, 0.18);
    const rightTooth = buildDisplacedBasaltColumn(0.14, 0.44, 1.22, 6, 503);
    rightTooth.rotateZ(-0.28);
    rightTooth.translate(0.40, 0.18, -0.15);
    const mRock = mergeGeometries([mainTooth, leftTooth, rightTooth], false);
    mainTooth.dispose();
    leftTooth.dispose();
    rightTooth.dispose();
    const rockCrysGeo = new THREE.OctahedronGeometry(0.18, 0);
    rockCrysGeo.scale(0.62, 1.85, 0.62);
    rockCrysGeo.rotateZ(-0.32);
    rockCrysGeo.translate(0.18, 0.85, 0.34);
    this.rockStoneInst = makeInst(mRock, this.mats.wetBasalt, MAX_HAZARDS);
    this.rockCrystalInst = makeInst(rockCrysGeo, this.mats.cyanCrystal, MAX_HAZARDS);

    const hFoamGeo = new THREE.PlaneGeometry(1.75, 1.75);
    hFoamGeo.rotateX(-Math.PI * 0.5);
    this.hazardFoamInst = makeInst(hFoamGeo, this.mats.archFoam, MAX_HAZARDS);
    this.hazardPool = [];

    // 4. Instanced Golden Gears -> 2 draw calls total regardless of how many gears are airborne!
    this.gearGroup = this.gameplayInstGroup;
    this.gearBodyInst = makeInst(this.sharedGeos.gearSculpt, this.mats.burnishedGold, MAX_GEARS);
    this.gearJewelInst = makeInst(this.sharedGeos.gearJewel, this.mats.cyanCrystal, MAX_GEARS);
    this._gearDummy = new THREE.Object3D();

    // 5. Instanced Blaster Bolts -> 2 draw calls total regardless of fire cadence!
    this.boltGroup = this.gameplayInstGroup;
    this.boltCoreInst = makeInst(this.sharedGeos.boltPrism, this.mats.boltCore, MAX_BOLTS);
    this.boltRingInst = makeInst(this.sharedGeos.boltRing, this.mats.boltRing, MAX_BOLTS);
    this.boltPool = [];
  }

  _initOverlayHudAndPopups() {
    // Non-overlapping compact telemetry bar positioned cleanly below `#hud` (y >= 98px)
    this.hudGroup = new THREE.Group();
    this._hudCanvas = makeCanvas(512, 76);
    this._hudTex = this._hudCanvas
      ? new THREE.CanvasTexture(this._hudCanvas)
      : createFallbackDataTex(0, 0, 0, 0, true);
    if (this._hudCanvas) this._hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this._hudTex, transparent: true, depthTest: false, depthWrite: false })
    );
    this.hudGroup.add(this.hudMesh);
    this.overlay.add(this.hudGroup);
    this._hudLastKey = '';

    // Screen-space 2D particle bridge (for any `state.particles` emitted by game.js)
    const pGeo = new THREE.BufferGeometry();
    this._pPos = new Float32Array(MAX_SCREEN_PART * 3);
    this._pCol = new Float32Array(MAX_SCREEN_PART * 3);
    this._pSize = new Float32Array(MAX_SCREEN_PART);
    this._pAlpha = new Float32Array(MAX_SCREEN_PART);
    pGeo.setAttribute('position', new THREE.BufferAttribute(this._pPos, 3));
    pGeo.setAttribute('aColor', new THREE.BufferAttribute(this._pCol, 3));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(this._pSize, 1));
    pGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this._pAlpha, 1));
    pGeo.setDrawRange(0, 0);

    this.partMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.softDotTex }, uPR: { value: this.dpr } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        uniform float uPR;
        varying vec3 vCol;
        varying float vAlpha;
        void main() {
          vCol = aColor;
          vAlpha = aAlpha;
          gl_PointSize = aSize * uPR;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
    this.partPoints = new THREE.Points(pGeo, this.partMat);
    this.partPoints.frustumCulled = false;
    this.overlay.add(this.partPoints);

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

  _loadGlbAssets() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    let loader;
    try {
      loader = new GLTFLoader();
    } catch {
      return;
    }

    // 1. Load `assets/models/hydro_skimmer.glb` -> Upgrade to Riveted Gunmetal & Burnished-Brass PBR Plating!
    loader.load(
      resolveAssetUrl('assets/models/hydro_skimmer.glb'),
      (gltf) => {
        if (this._disposed || !gltf?.scene) return;
        const model = gltf.scene.clone(true);
        model.traverse((obj) => {
          if (!obj.isMesh || !obj.material) return;
          obj.frustumCulled = false;
          // Project crisp cylindrical/planar UVs onto glb hull primitives so riveted gunmetal seams & rivets wrap cleanly!
          if (obj.geometry?.attributes?.position) {
            const g = obj.geometry.clone();
            const pos = g.attributes.position;
            const uvs = new Float32Array(pos.count * 2);
            for (let vi = 0; vi < pos.count; vi++) {
              const px = pos.getX(vi);
              const py = pos.getY(vi);
              const pz = pos.getZ(vi);
              uvs[vi * 2] = Math.atan2(px, py + 0.05) / TAU + px * 0.85;
              uvs[vi * 2 + 1] = pz * 1.15;
            }
            g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            obj.geometry = g;
          }
          const nm = (obj.material.name || '').toLowerCase();
          const on = (obj.name || '').toLowerCase();
          if (obj.material.transparent || nm.includes('glass') || on.includes('cockpit')) {
            obj.material = this.mats.canopyGlass;
            obj.renderOrder = 5;
          } else if (nm.includes('brass')) {
            obj.material = this.mats.tarnishedBrass;
          } else if (nm.includes('glow')) {
            obj.material = this.mats.cyanGlow;
          } else if (nm.includes('trim')) {
            obj.material = this.mats.skimmerTrim;
          } else if (nm.includes('hull')) {
            obj.material = this.mats.skimmerHull;
          }
        });

        // Bolt sculpted Burnished-Brass Cowling Strakes, Cockpit Coaming Rim & Flared Brass Afterburner Shrouds onto `model`!
        const brassAddons = [];
        const trimAddons = [];
        const coaming = new THREE.TorusGeometry(0.25, 0.024, 7, 20);
        coaming.rotateX(Math.PI * 0.48);
        coaming.scale(1.05, 1.35, 1.0);
        coaming.translate(0, 0.13, 0.06);
        brassAddons.push(coaming);

        const prowSpine = new THREE.BoxGeometry(0.048, 0.032, 0.62);
        prowSpine.translate(0, 0.135, -0.62);
        brassAddons.push(prowSpine);

        for (const sx of [-1, 1]) {
          // Swept brass stern deck ribs flanking cockpit
          const rib = new THREE.BoxGeometry(0.042, 0.035, 0.56);
          rib.rotateY(sx * -0.14);
          rib.translate(sx * 0.21, 0.125, 0.46);
          brassAddons.push(rib);

          // Flared riveted brass exhaust nozzle collars + gunmetal intake cowls
          const shroud = new THREE.TorusGeometry(0.112, 0.022, 8, 18);
          shroud.translate(sx * 0.15, 0.09, 0.92);
          brassAddons.push(shroud);

          const intake = new THREE.CylinderGeometry(0.055, 0.072, 0.34, 10);
          intake.rotateX(Math.PI * 0.5);
          intake.translate(sx * 0.26, 0.08, 0.36);
          trimAddons.push(intake);
        }
        const mBrassAdd = mergeGeometries(brassAddons, false);
        for (const g of brassAddons) g.dispose();
        const mTrimAdd = mergeGeometries(trimAddons, false);
        for (const g of trimAddons) g.dispose();
        model.add(
          new THREE.Mesh(mBrassAdd, this.mats.tarnishedBrass),
          new THREE.Mesh(mTrimAdd, this.mats.skimmerTrim)
        );

        // Align merged thruster plume group directly to `thrusterL`/`thrusterR` Y/Z before batching static hull
        const thrL = model.getObjectByName('thrusterL');
        if (thrL && this.jetGroup) {
          this.jetGroup.position.set(0, thrL.position.y, thrL.position.z + 0.12);
        }
        batchStaticMeshesByMaterial(model);
        this.procHull.visible = false;
        this.hullMount.add(model);
      },
      undefined,
      () => {}
    );

    // 2. Load `assets/models/sea_mine.glb` (#131 & #289: 0.66m hurt core parity -> O(1) InstancedMesh!)
    loader.load(
      resolveAssetUrl('assets/models/sea_mine.glb'),
      (gltf) => {
        if (this._disposed || !gltf?.scene) return;
        const tpl = gltf.scene.clone(true);
        tpl.scale.setScalar(1.04);
        tpl.traverse((obj) => {
          if (!obj.isMesh || !obj.material) return;
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m && typeof m.emissiveIntensity === 'number' && m.emissiveIntensity > 1.85) {
              m.emissiveIntensity = 1.85;
            }
          }
        });
        batchStaticMeshesByMaterial(tpl);
        const glbInsts = [];
        tpl.traverse((obj) => {
          if (!obj.isMesh || !obj.geometry || !obj.material) return;
          const inst = new THREE.InstancedMesh(obj.geometry, obj.material, MAX_HAZARDS);
          inst.count = 0;
          inst.visible = false;
          inst.frustumCulled = false;
          this.gameplayInstGroup.add(inst);
          glbInsts.push(inst);
        });
        if (glbInsts.length > 0) {
          for (const pm of this.procMineInsts) pm.visible = false;
          this.glbMineInsts = glbInsts;
        }
      },
      undefined,
      () => {}
    );
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

    this.sprayMat.uniforms.uPR.value = this.dpr;
    this.partMat.uniforms.uPR.value = this.dpr;
    this._hudLastKey = '';
  }

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.pogoRig?.setSkin?.(skinId);
  }

  setBlasterFx(fxId) {
    this.blasterFxId = BLASTER_FX_STYLES[fxId] ? fxId : 'standard_cryo';
  }

  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    this.era = next;
    const isOrig = next === 'original';
    this.exposure = isOrig ? 1.08 : 1.0;
    this.scene.environmentIntensity = isOrig ? 0.68 : 0.52;
    this.pogoRig?.setEraStyle?.(next);

    if (isOrig) {
      this.skyUniforms.uTopCol.value.set('#050c28');
      this.skyUniforms.uMidCol.value.set('#0c245c');
      this.skyUniforms.uHorCol.value.set('#18488c');
      this.oceanUniforms.deepColor.value.set('#042862');
      this.oceanUniforms.shallowColor.value.set('#0ea5e9');
      this.oceanUniforms.skyColor.value.set('#153e7e');
      this.scene.fog.color.set('#0f2c64');
    } else {
      this.skyUniforms.uTopCol.value.set('#030610');
      this.skyUniforms.uMidCol.value.set('#091224');
      this.skyUniforms.uHorCol.value.set('#13223d');
      this.oceanUniforms.deepColor.value.set('#031324');
      this.oceanUniforms.shallowColor.value.set('#0a586e');
      this.oceanUniforms.skyColor.value.set('#091428');
      this.scene.fog.color.set('#081122');
    }
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

  _syncBlasterMaterials(time) {
    const style = BLASTER_FX_STYLES[this.blasterFxId] || BLASTER_FX_STYLES.standard_cryo;
    if (style.prismatic) {
      const hue = (time * 0.45) % 1;
      this._prismColor.setHSL(hue, 0.92, 0.66);
      this.mats.boltCore.color.setRGB(1, 1, 1);
      this.mats.boltCore.emissive.copy(this._prismColor);
      this.mats.boltRing.color.setHSL((hue + 0.35) % 1, 0.95, 0.68);
      this.mats.boltHaloSprite.color.copy(this._prismColor);
    } else {
      const fc = this._fxColors[this.blasterFxId] || this._fxColors.standard_cryo;
      this.mats.boltCore.color.copy(fc.core);
      this.mats.boltCore.emissive.copy(fc.emissive);
      this.mats.boltRing.color.copy(fc.ring);
      this.mats.boltHaloSprite.color.copy(fc.halo);
    }
    return style;
  }

  _updateOverlayHud(skimmer) {
    if (!this._hudCanvas) return;
    const boost = Math.max(1, Math.min(4, Math.round(skimmer.boostMult || 1)));
    const dur = Math.max(1, skimmer.duration || 18);
    const progPct = clamp((skimmer.timer || 0) / dur, 0, 1);
    const progStep = Math.round(progPct * 120);
    const boostStep = Math.round(clamp((skimmer.boostTimer || 0) / 5.8, 0, 1) * 40);
    const isLand = this.width > this.height * 1.05;
    const hudW = isLand
      ? clamp(Math.round(this.width * 0.28), 204, 272)
      : clamp(Math.floor(this.width - 28), 224, 352);
    const hudH = Math.round(hudW * (76 / 512));
    const topOff = isLand
      ? (this.height <= 450 ? 48 : 56)
      : (this.width <= 405 ? 78 : HUD_TOP_OFFSET - 6);
    const key = `${hudW}|${progStep}|${boost}|${boostStep}`;

    if (key !== this._hudLastKey) {
      this._hudLastKey = key;
      const ctx = this._hudCanvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 76);

      // Sleek dark-cinematic glass pill
      ctx.fillStyle = 'rgba(6, 12, 26, 0.74)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(8, 8, 496, 60, 16);
      ctx.fill();
      ctx.stroke();

      // Sprint route label & progress bar
      ctx.font = '800 15px Orbitron, "Segoe UI", sans-serif';
      ctx.fillStyle = '#93c5fd';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('STORM SPRINT', 26, 27);

      ctx.fillStyle = 'rgba(30, 48, 78, 0.85)';
      ctx.beginPath();
      ctx.roundRect(26, 42, 336, 12, 6);
      ctx.fill();

      const fillW = Math.max(10, Math.round(336 * progPct));
      const barGrad = ctx.createLinearGradient(26, 0, 362, 0);
      barGrad.addColorStop(0, '#0ea5e9');
      barGrad.addColorStop(1, '#5efce8');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(26, 42, fillW, 12, 6);
      ctx.fill();

      // Right-hand Boost Multiplier Pill (`1X`..`4X`)
      const bCol = boost >= 4 ? '#fde047' : boost === 3 ? '#e879f9' : boost === 2 ? '#34d399' : '#38bdf8';
      ctx.fillStyle = 'rgba(12, 24, 46, 0.92)';
      ctx.strokeStyle = bCol;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(380, 15, 110, 46, 12);
      ctx.fill();
      ctx.stroke();

      ctx.font = '900 22px Orbitron, "Segoe UI", sans-serif';
      ctx.fillStyle = bCol;
      ctx.textAlign = 'center';
      ctx.fillText(`${boost}X`, 435, 34);

      if (boost > 1) {
        const bFrac = clamp((skimmer.boostTimer || 0) / 5.8, 0, 1);
        ctx.fillStyle = bCol;
        ctx.fillRect(394, 51, Math.round(82 * bFrac), 4);
      } else {
        ctx.font = '700 10px Orbitron, "Segoe UI", sans-serif';
        ctx.fillStyle = 'rgba(186, 230, 253, 0.72)';
        ctx.fillText('BOOST', 435, 52);
      }

      this._hudTex.needsUpdate = true;
    }

    this.hudMesh.scale.set(hudW, hudH, 1);
    this.hudMesh.position.set(this.width * 0.5, -(topOff + hudH * 0.5), 0);
    this._hudBottomPx = topOff + hudH;
  }

  _parseHexRgb(str, out) {
    let cached = this._colorStrCache.get(str);
    if (!cached) {
      this._tmpColor.set(str || '#ffffff');
      cached = [this._tmpColor.r, this._tmpColor.g, this._tmpColor.b];
      if (this._colorStrCache.size > 64) this._colorStrCache.clear();
      this._colorStrCache.set(str, cached);
    }
    out[0] = cached[0];
    out[1] = cached[1];
    out[2] = cached[2];
  }

  _popupTex(text, color) {
    const key = `${text}|${color}`;
    let e = this._popCache.get(key);
    if (e) {
      e.used = this._popFrame;
      return e;
    }
    const c = makeCanvas(256, 64);
    if (!c) {
      const fallback = { tex: this.softDotTex, aspect: 3, used: this._popFrame, text, color };
      return fallback;
    }
    const ctx = c.getContext('2d');
    const fs = 38;
    const font = `900 ${fs}px Orbitron, "Segoe UI", sans-serif`;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    c.width = Math.max(96, tw + 34);
    c.height = 60;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(4, 8, 20, 0.92)';
    ctx.strokeText(text, c.width * 0.5, 30);
    ctx.fillStyle = color || '#fde047';
    ctx.fillText(text, c.width * 0.5, 30);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    e = { tex, aspect: c.width / c.height, used: this._popFrame, text, color };
    this._popCache.set(key, e);
    if (this._popCache.size > 36) {
      for (const [k, v] of this._popCache) {
        if (v.used < this._popFrame - 2) {
          v.tex.dispose();
          v.dead = true;
          this._popCache.delete(k);
          if (this._popCache.size <= 28) break;
        }
      }
    }
    return e;
  }

  _syncOverlayParticlesAndPopups(particles, popups) {
    const g = this.partPoints.geometry;
    const n = Array.isArray(particles) ? Math.min(particles.length, MAX_SCREEN_PART) : 0;
    const rgb = this._rgbScratch;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      this._pPos[i * 3] = p.x || 0;
      this._pPos[i * 3 + 1] = -(p.y || 0);
      this._pPos[i * 3 + 2] = 0;
      this._parseHexRgb(p.color || '#ffffff', rgb);
      this._pCol[i * 3] = rgb[0];
      this._pCol[i * 3 + 1] = rgb[1];
      this._pCol[i * 3 + 2] = rgb[2];
      this._pSize[i] = (p.size || 4) * 2.5;
      this._pAlpha[i] = clamp((p.life || 0) / Math.max(0.001, p.maxLife || 1), 0, 1);
    }
    g.setDrawRange(0, n);
    this.partPoints.visible = n > 0;
    if (n > 0) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
    }

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
      let e = pop.__skimTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#fde047')) {
        e = this._popupTex(pop.text, pop.color || '#fde047');
        pop.__skimTex = e;
      } else {
        e.used = this._popFrame;
      }
      if (m.material.map !== e.tex) {
        m.material.map = e.tex;
        m.material.needsUpdate = true;
      }
      const t = 1 - clamp((pop.life || 0) / Math.max(0.001, pop.maxLife || 1), 0, 1);
      const scalePop = t < 0.16 ? easeOutBack(t / 0.16) * 1.12 : 1.12 - Math.min(0.12, (t - 0.16) * 0.9);
      const baseH = this.height <= 450 ? 18 : 22;
      const hgt = baseH * Math.max(0.1, scalePop);
      const wid = hgt * e.aspect;
      const px = clamp(pop.x, wid * 0.5 + 8, this.width - wid * 0.5 - 8);
      const minTopY = (this._hudBottomPx || 96) + hgt * 0.5 + 8;
      const maxBotY = Math.max(minTopY + 12, this.height * 0.50);
      const py = -clamp(pop.y - t * 26, minTopY, maxBotY);
      m.scale.set(wid, hgt, 1);
      m.position.set(px, py, 1);
      m.material.opacity = clamp(1 - t * t, 0, 1);
      m.visible = true;
    }
  }

  render(stateOrSkimmer, ctx = {}) {
    const gl = this.webgl;
    if (!gl || !stateOrSkimmer) return;

    const hasOuter = Boolean(stateOrSkimmer.skimmer);
    const skimmer = hasOuter ? stateOrSkimmer.skimmer : stateOrSkimmer;
    const outer = hasOuter ? stateOrSkimmer : ctx;
    if (!skimmer) return;

    const reqEra = outer.era || ctx.era;
    if (reqEra && reqEra !== this.era) this.setEra(reqEra);
    const reqSkin = outer.player?.skinId || outer.skinId || ctx.skinId;
    if (reqSkin && reqSkin !== this.skinId) this.setSkin(reqSkin);
    const reqFx = outer.player?.blasterFxId || outer.blasterFxId || ctx.blasterFxId;
    if (reqFx && reqFx !== this.blasterFxId) this.setBlasterFx(reqFx);

    const time = Number(outer.time ?? ctx.time ?? skimmer.timer ?? 0);
    const rawDt = ctx.dt ?? (this._lastTime > 0 ? time - this._lastTime : 0.016);
    const dt = clamp(rawDt > 0 ? rawDt : 0.016, 0.001, 0.05);
    this._lastTime = time;

    const fxStyle = this._syncBlasterMaterials(time);
    const shake = getShakeXY(outer.shake ?? ctx.shake, time, this._shake);

    const lx = skimmer.laneX || 0;
    const vx = skimmer.vx || 0;
    const sy = skimmer.y || 0;
    const vy = skimmer.vy || 0;
    const onWater = Boolean(skimmer.onWater);
    const boostMult = Math.max(1, Math.min(4, Math.round(skimmer.boostMult || 1)));
    const boostNorm = clamp((boostMult - 1) / 3, 0, 1);
    const distScroll = skimmer.distance ?? time * 18;
    const speed = skimmer.speed || 18;

    // 1. Dynamic Chase Camera: Narrow-Portrait Full ±2.4 Lane Visibility + Chunky Close-Up Landscape Framing!
    const asp = this.camera.aspect;
    const isPortrait = asp < 0.92;
    const isWideLand = asp >= 1.52;
    const portT = clamp((asp - 0.45) / 0.47, 0, 1);
    const baseFov = isPortrait
      ? lerp(60.0, 52.0, portT)
      : isWideLand
      ? 43.5
      : asp >= 1.15
      ? 46.5
      : 51.0;
    const boostFovKick = (isPortrait ? 7.5 : 11.5) * boostNorm;
    const targetFov = baseFov + boostFovKick + (onWater ? 0 : 3.0);
    if (Math.abs(this.camera.fov - targetFov) > 0.04) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8.0);
      this.camera.updateProjectionMatrix();
    }

    // Keep camera centered enough over the ±2.4 wave corridor on narrow portrait so opposite outer lanes NEVER clip,
    // while tracking smoothly when Pogo carves out toward ±3.5!
    const wantCamX = isPortrait
      ? lx * 0.42 + Math.sign(lx) * Math.max(0, Math.abs(lx) - 2.0) * 0.38
      : lx * 0.54;
    const baseCamY = isPortrait ? 2.66 : isWideLand ? 2.18 : asp >= 1.15 ? 2.38 : 2.58;
    const baseCamZ = isPortrait
      ? lerp(8.26, 6.82, portT)
      : isWideLand
      ? 5.62
      : asp >= 1.15
      ? 6.12
      : 6.75;
    this._camX += (wantCamX - this._camX) * Math.min(1, dt * 11.0);
    this._camY += (baseCamY - boostNorm * 0.20 + sy * 0.42 - this._camY) * Math.min(1, dt * 9.5);
    const camZ = baseCamZ - boostNorm * (isWideLand ? 0.42 : 0.54);

    const lookX = lx * (isPortrait ? 0.16 : 0.36);
    const lookY = (isPortrait ? 0.50 : 0.58) + sy * 0.25;
    this.camera.position.set(this._camX + shake.x, this._camY + shake.y, camZ);
    this.camera.lookAt(lookX, lookY, -14.5);

    const targetRoll = clamp(-vx * 0.025, -0.155, 0.155);
    this._camRoll += (targetRoll - this._camRoll) * Math.min(1, dt * 10.5);
    this.camera.rotation.z += this._camRoll;

    // Keep sky & distant horizon locked horizontally/axially to camera depth
    this.skyDome.position.copy(this.camera.position);
    this.skyUniforms.uTime.value = time;

    // Dramatic Storm-Front Double-Flash Lightning + Sweeping Watchtower Volumetric Searchlight!
    const lWave = Math.sin(time * 1.15) * Math.sin(time * 2.95 + 0.7);
    const lPulse =
      this.era === 'reboot'
        ? clamp(Math.pow(Math.max(0, lWave), 10.0) * 1.65, 0, 1)
        : 0;
    this.skyUniforms.uLightning.value = lPulse;
    this.moonLight.intensity = (this.era === 'original' ? 2.2 : 2.15) + lPulse * 2.4;
    if (this._watchtowerStoneMat) {
      this._watchtowerStoneMat.emissiveIntensity = 0.32 + lPulse * 0.95;
    }
    if (this.lightningBoltMesh) {
      this.lightningBoltMesh.visible = lPulse > 0.18;
      this.lightningBoltMat.opacity = clamp((lPulse - 0.18) * 1.25, 0, 0.95);
    }
    if (this.searchlightPivot) {
      this.searchlightUniforms.uTime.value = time;
      // Sweep wide laterally across the storm sky & sea so the long volumetric god-ray cone is clearly visible!
      this.searchlightPivot.rotation.y = 0.68 + Math.sin(time * 0.85) * 0.58;
      this.searchlightPivot.rotation.x = 0.22 + Math.cos(time * 0.62) * 0.08;
      this.searchlightPivot.visible = this.era === 'reboot';
    }
    if (this.rainMesh) {
      this.rainMesh.visible = this.era === 'reboot';
      this.rainUniforms.uTime.value = time;
      this.rainUniforms.uCamX.value = this._camX;
      this.rainUniforms.uLightning.value = lPulse;
    }

    if (this.wispUniforms) this.wispUniforms.uTime.value = time;
    if (this.horizonMistUniforms) {
      this.horizonMistUniforms.uTime.value = time;
      this.horizonMistUniforms.uLightning.value = lPulse;
    }
    for (let i = 0; i < this.stormClouds.length; i++) {
      const sc = this.stormClouds[i];
      sc.position.x = sc.userData.baseX + Math.sin(time * sc.userData.spd) * 6.5;
    }

    // 2. Update Ocean Shader Uniforms & Looping Coastal Sea-Stack Arches / Lighthouses
    this.oceanUniforms.uTime.value = time;
    this.oceanUniforms.uScroll.value = distScroll * 0.85;
    this.oceanUniforms.uCraftX.value = lx;
    this.oceanUniforms.uOnWater.value = onWater ? 1.0 : clamp(1.0 - sy * 0.85, 0, 1);
    this.oceanUniforms.uBoostNorm.value = boostNorm;

    const spacing = ARCH_SPAN_Z / ARCH_COUNT;
    for (let i = 0; i < this.seaArches.length; i++) {
      const sa = this.seaArches[i];
      const wz = (((sa.seedZ + distScroll) % ARCH_SPAN_Z) + ARCH_SPAN_Z) % ARCH_SPAN_Z - (ARCH_SPAN_Z - spacing);
      sa.group.position.z = wz;
      sa.group.visible = wz > -50 && wz < 7.0;
      if (sa.group.userData.detailGrp) {
        sa.group.userData.detailGrp.visible = wz > -32;
      }
    }

    // 3. Hydro-Skimmer Craft Banking, Pitch, Wake, Rooster-Tail & Seated 33-Bone PogoRig!
    const bankZ = clamp(-vx * 0.066, -0.46, 0.46);
    const waveHeave = onWater ? Math.sin(time * 6.5 + lx * 0.8) * 0.038 : 0;
    const pitchX = onWater
      ? 0.035 + boostNorm * 0.045 + Math.cos(time * 5.2) * 0.02
      : clamp(vy * 0.042, -0.34, 0.38);

    this.craftGroup.position.set(lx, 0.21 + sy + waveHeave, 0);
    this.craftGroup.rotation.set(pitchX, -vx * 0.018, bankZ);
    this.craftLight.position.set(lx, 0.9 + sy, -0.2);

    const bTier = this._boostColors[boostMult - 1];
    this.craftLight.color.copy(bTier.rim);
    this.jetUniforms.uTime.value = time;
    this.jetUniforms.uBoost.value = boostNorm;
    this.jetUniforms.uCol.value.copy(bTier.jet);
    if (this.machRingMat) {
      this.machRingMat.color.copy(bTier.rim);
      this.machRingMat.opacity = 0.55 + boostNorm * 0.35 + Math.sin(time * 42) * 0.12;
    }
    const jetLen = ((skimmer.boostTimer || 0) > 0 ? 1.28 + boostNorm * 0.68 : 0.90) + Math.sin(time * 38) * 0.08;
    for (let j = 0; j < this.jetPlumes.length; j++) {
      this.jetPlumes[j].scale.set(1 + boostNorm * 0.24, 1 + boostNorm * 0.24, jetLen);
    }

    // Bow-wake & Rooster-tail visibility scales cleanly with water contact & boost
    const waterContact = onWater ? 1.0 : clamp(1.0 - sy * 1.4, 0, 1);
    this.wakeUniforms.uTime.value = time;
    this.wakeUniforms.uBoost.value = boostNorm;
    this.wakeUniforms.uOpacity.value = 0.82 * waterContact;
    this.wakeGroup.visible = waterContact > 0.03;
    this.roosterTail.scale.set(1 + Math.abs(vx) * 0.06, 0.78 + boostNorm * 0.65, 0.85 + boostNorm * 0.42);
    this.roosterTail.rotation.y = clamp(-vx * 0.05, -0.28, 0.28);

    // Steering handlebar yoke & 33-bone PogoRig pilot kinematics
    this.helmYoke.rotation.y = clamp(-vx * 0.055, -0.32, 0.32);
    this.pogoRig.update(dt, {
      time,
      vx: vx * 0.22,
      vy,
      facing: 1,
      onGround: onWater,
      muzzleFlash: 0,
      squashX: 1,
      squashY: 1,
    });
    const b = this.pogoRig.bones;
    if (b) {
      // Seated athletic pilot stance: knees bent into footwell, hands gripping twin brass helm bars, leaning into carve!
      const leanRoll = bankZ * 0.48;
      const lookYaw = clamp(-vx * 0.055, -0.34, 0.34);
      const airLift = onWater ? 0 : clamp(vy * 0.03, -0.18, 0.22);
      b.pelvis.position.set(0, 0.24, 0.02);
      b.pelvis.rotation.set(-0.12, 0, leanRoll * 0.35);
      b.spine.rotation.set(0.18 - airLift * 0.4, lookYaw * 0.35, leanRoll * 0.45);
      b.chest.rotation.set(0.16 - airLift * 0.4, lookYaw * 0.45, leanRoll * 0.55);
      b.head.rotation.set(-0.16 + airLift * 0.3, lookYaw * 0.75, leanRoll * 0.35);
      b.crest.rotation.x = 0.22 + boostNorm * 0.18 + Math.sin(time * 18) * 0.05;

      // Lower legs, holstered sidearm (+ muzzle PointLight) & forward-facing facial micro-meshes face -Z away from the +Z chase camera -> skip unseen bone subtrees for locked mobile 60fps!
      b.thighL.visible = false;
      b.thighR.visible = false;
      if (b.blaster) b.blaster.visible = false;
      if (b.muzzleLight) b.muzzleLight.visible = false;
      if (b.eyeL) b.eyeL.visible = false;
      if (b.eyeR) b.eyeR.visible = false;
      if (b.eyelidL) b.eyelidL.visible = false;
      if (b.eyelidR) b.eyelidR.visible = false;
      if (b.browL) b.browL.visible = false;
      if (b.browR) b.browR.visible = false;
      if (b.jaw) b.jaw.visible = false;

      // One-time 5-group kinematic mesh batching once `pogo.glb` attaches (preserves 100% of torso lean, arm steering, head yaw, crest flutter, skins & eras!)
      if (this.pogoRig._glbApplied && !this._pogoBatched) {
        this._pogoBatched = true;
        b.pelvis.position.set(0, 0.24, 0.02);
        b.pelvis.rotation.set(-0.12, 0, 0);
        b.spine.rotation.set(0.18, 0, 0);
        b.chest.rotation.set(0.16, 0, 0);
        if (b.backpack) b.backpack.rotation.set(0, 0, 0);
        b.head.rotation.set(-0.16, 0, 0);
        b.crest.rotation.set(0.22, 0, 0);
        b.shoulderL.rotation.set(0, 0, 0);
        b.upperArmL.rotation.set(-0.96, 0.16, 0.18);
        b.forearmL.rotation.set(-0.48, 0, 0);
        b.handL.rotation.set(0.25, 0, 0);
        b.shoulderR.rotation.set(0, 0, 0);
        b.upperArmR.rotation.set(-0.96, -0.16, -0.18);
        b.forearmR.rotation.set(-0.48, 0, 0);
        b.handR.rotation.set(0.25, 0, 0);
        this.pogoRig.group.updateMatrixWorld(true);

        const boneSet = new Set(Object.values(b));
        const specialSet = new Set([
          this.pogoRig._divingCollar,
          this.pogoRig._visorPips,
          this.pogoRig._starMotesGroup,
        ]);
        for (const ch of b.pelvis.children) {
          if (!boneSet.has(ch)) ch.visible = false;
        }
        const mergeGroups = [
          { host: b.chest, donors: [b.spine, b.harness, b.backpack, b.neck] },
          { host: b.upperArmL, donors: [b.shoulderL, b.forearmL, b.handL] },
          { host: b.upperArmR, donors: [b.shoulderR, b.forearmR, b.handR] },
          { host: b.head, donors: [] },
          { host: b.crest, donors: [] },
        ];
        for (const mg of mergeGroups) {
          if (!mg.host) continue;
          const wrap = new THREE.Group();
          mg.host.add(wrap);
          wrap.updateMatrixWorld(true);
          const sources = [mg.host, ...mg.donors];
          for (const src of sources) {
            if (!src) continue;
            const kids = [...src.children];
            for (const ch of kids) {
              if (ch === wrap || boneSet.has(ch) || specialSet.has(ch) || !ch.visible) continue;
              wrap.attach(ch);
            }
          }
          batchStaticMeshesByMaterial(wrap);
        }

        b.pelvis.rotation.set(-0.12, 0, leanRoll * 0.35);
        b.spine.rotation.set(0.18 - airLift * 0.4, lookYaw * 0.35, leanRoll * 0.45);
        b.chest.rotation.set(0.16 - airLift * 0.4, lookYaw * 0.45, leanRoll * 0.55);
        b.head.rotation.set(-0.16 + airLift * 0.3, lookYaw * 0.75, leanRoll * 0.35);
        b.crest.rotation.x = 0.22 + boostNorm * 0.18 + Math.sin(time * 18) * 0.05;
      }

      b.shoulderL.rotation.set(0, 0, 0);
      b.upperArmL.rotation.set(-0.96 + lookYaw * 0.22, 0.16, 0.18);
      b.forearmL.rotation.set(-0.48, 0, 0);
      b.handL.rotation.set(0.25, 0, 0);

      b.shoulderR.rotation.set(0, 0, 0);
      b.upperArmR.rotation.set(-0.96 - lookYaw * 0.22, -0.16, -0.18);
      b.forearmR.rotation.set(-0.48, 0, 0);
      b.handR.rotation.set(0.25, 0, 0);
    }

    // 4. Emit & Update 3D Frothy Spray Droplets (bow carve, stern jet mist, splashdown burst!)
    if (onWater && !this._wasOnWater) {
      for (let k = 0; k < 22; k++) {
        const ang = (k / 22) * TAU;
        this._spawnSprayDroplet(
          lx + Math.cos(ang) * 0.55,
          0.08,
          Math.sin(ang) * 0.65,
          Math.cos(ang) * (2.4 + (k % 3) * 0.8),
          2.2 + (k % 4) * 0.75,
          3.5 + Math.sin(ang) * 1.8,
          0.34,
          0.52
        );
      }
    }
    this._wasOnWater = onWater;

    if (onWater) {
      const rate = 52 + Math.abs(vx) * 9 + boostNorm * 45;
      this._sprayEmitAcc += dt * rate;
      let guard = 0;
      while (this._sprayEmitAcc >= 1 && guard < 8) {
        this._sprayEmitAcc -= 1;
        guard++;
        const side = (this._sprayCursor % 2 === 0 ? -1 : 1);
        const jitter = ((this._sprayCursor * 37) % 100) * 0.01;
        this._spawnSprayDroplet(
          lx + side * (0.56 + jitter * 0.14),
          0.05,
          0.35 + jitter * 0.65,
          side * (1.35 + Math.abs(vx) * 0.26 + jitter * 0.8) - vx * 0.18,
          1.45 + boostNorm * 1.15 + jitter * 0.9,
          speed * 0.42 + 2.5,
          0.22 + jitter * 0.14,
          0.44 + jitter * 0.18
        );
      }
    }

    for (let i = 0; i < MAX_SPRAY; i++) {
      const sp = this._sprayData[i];
      const o = i * 3;
      if (sp.life > 0) {
        sp.life -= dt;
        sp.vy -= 9.4 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.z += sp.vz * dt;
        const frac = clamp(sp.life / sp.maxLife, 0, 1);
        this._sprayPos[o] = sp.x;
        this._sprayPos[o + 1] = sp.y;
        this._sprayPos[o + 2] = sp.z;
        this._sprayAlpha[i] = Math.sin(frac * Math.PI) * 0.72;
        this._spraySize[i] = sp.size * (1 + (1 - frac) * 1.35);
      } else {
        this._sprayPos[o + 1] = -20;
        this._sprayAlpha[i] = 0;
        this._spraySize[i] = 0;
      }
    }
    const sGeo = this.sprayPoints.geometry;
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.aAlpha.needsUpdate = true;
    sGeo.attributes.aSize.needsUpdate = true;

    // Speed-streak lines during boost / ramp air
    const wantStreak = boostMult >= 2 || !onWater ? Math.min(0.58, 0.20 + boostNorm * 0.38) : 0;
    this.speedLineMat.opacity += (wantStreak - this.speedLineMat.opacity) * Math.min(1, dt * 9);
    const streakVis = this.speedLineMat.opacity > 0.015;
    this.speedLineInst.visible = streakVis;
    if (streakVis) {
      for (let i = 0; i < this._speedLineSeeds.length; i++) {
        const sd = this._speedLineSeeds[i];
        const sz = (((sd.seedZ + distScroll * 1.5) % 46) + 46) % 46 - 40;
        this._dummyMat.makeTranslation(sd.baseX + lx * 0.3, sd.baseY, sz);
        this.speedLineInst.setMatrixAt(i, this._dummyMat);
      }
      this.speedLineInst.instanceMatrix.needsUpdate = true;
    }

    // 5. Sync Boost Gates, Wave Ramps, Hazards, Golden Gears & Bolts
    const gates = skimmer.gates || [];
    const nextTierIdx = Math.min(3, boostMult); // Upcoming gate awards min(4, boostMult + 1) -> index 1..3
    const gd = this._gearDummy;
    let gateInstCount = 0;
    for (let i = 0; i < MAX_GATES; i++) {
      const slot = this.gatePool[i];
      const g = gates[i];
      if (!g || g.z < -5) {
        slot.visible = false;
        continue;
      }
      slot.visible = true;
      const gx = g.laneX || 0;
      const gy = Math.sin(time * 3.2 + i) * 0.04;
      const gz = -g.z;
      const gateScale = 0.90 * clamp((g.width || 1.58) / 1.58, 0.82, 1.25);
      slot.position.set(gx, gy, gz);
      slot.scale.setScalar(gateScale);
      gd.position.set(gx, gy, gz);
      gd.rotation.set(0, 0, 0);
      gd.scale.setScalar(gateScale);
      gd.updateMatrix();
      this.gateBrassInst.setMatrixAt(gateInstCount, gd.matrix);
      this.gateObsInst.setMatrixAt(gateInstCount, gd.matrix);
      this.gateFoamInst.setMatrixAt(gateInstCount, gd.matrix);
      gateInstCount++;

      const ud = slot.userData;
      const tc = g.hit ? this._boostColors[3] : this._boostColors[nextTierIdx];
      ud.curtainUniforms.uTime.value = time;
      ud.curtainUniforms.uCol.value.copy(g.hit ? this._gateHitColor : tc.rim);
      ud.curtainUniforms.uHit.value = g.hit ? 1.0 : 0.0;
      const wantBadgeIdx = g.hit ? Math.min(3, boostMult - 1) : nextTierIdx;
      if (ud.tierIdx !== wantBadgeIdx) {
        ud.tierIdx = wantBadgeIdx;
        ud.badgeMat.map = this.boostBadgeTex[wantBadgeIdx];
        ud.badgeMat.needsUpdate = true;
      }
    }
    this.gateBrassInst.count = gateInstCount;
    this.gateObsInst.count = gateInstCount;
    this.gateFoamInst.count = gateInstCount;
    this.gateBrassInst.visible = gateInstCount > 0;
    this.gateObsInst.visible = gateInstCount > 0;
    this.gateFoamInst.visible = gateInstCount > 0;
    if (gateInstCount > 0) {
      this.gateBrassInst.instanceMatrix.needsUpdate = true;
      this.gateObsInst.instanceMatrix.needsUpdate = true;
      this.gateFoamInst.instanceMatrix.needsUpdate = true;
    }

    const ramps = skimmer.ramps || [];
    let rampCount = 0;
    let rampChevCount = 0;
    for (let i = 0; i < ramps.length && rampCount < MAX_RAMPS; i++) {
      const r = ramps[i];
      if (!r || r.z < -5) continue;
      gd.position.set(r.laneX || 0, Math.sin(time * 4.2 + i) * 0.03, -r.z);
      gd.rotation.set(0, 0, 0);
      gd.scale.setScalar(1);
      gd.updateMatrix();
      this.rampWaveInst.setMatrixAt(rampCount++, gd.matrix);
      if (!r.used) {
        this.rampChevInst.setMatrixAt(rampChevCount++, gd.matrix);
      }
    }
    this.rampWaveInst.count = rampCount;
    this.rampWaveInst.visible = rampCount > 0;
    if (rampCount > 0) this.rampWaveInst.instanceMatrix.needsUpdate = true;
    this.rampChevInst.count = rampChevCount;
    this.rampChevInst.visible = rampChevCount > 0;
    if (rampChevCount > 0) {
      this.rampChevMat.opacity = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 9))) * 0.46;
      this.rampChevInst.instanceMatrix.needsUpdate = true;
    }

    const hazards = skimmer.hazards || [];
    const activeMineInsts = this.glbMineInsts || this.procMineInsts;
    let mineCount = 0;
    let crateCount = 0;
    let rockCount = 0;
    let hFoamCount = 0;
    const fd = this._foamDummy;
    for (let i = 0; i < hazards.length && i < MAX_HAZARDS; i++) {
      const hz = hazards[i];
      if (!hz || hz.hp <= 0 || hz.z < -5) continue;
      const hx = hz.laneX || 0;
      const hzZ = -hz.z;
      const bob = Math.sin(time * 3.8 + i * 1.7) * 0.07;
      if (hz.type === 'mine') {
        gd.position.set(hx, 0.38 + bob, hzZ);
        gd.rotation.set(0, time * 1.45 + i, Math.sin(time * 2.6 + i) * 0.12);
        gd.scale.setScalar(1);
        gd.updateMatrix();
        for (let m = 0; m < activeMineInsts.length; m++) {
          activeMineInsts[m].setMatrixAt(mineCount, gd.matrix);
        }
        mineCount++;
        if (hFoamCount < MAX_HAZARDS) {
          fd.position.set(hx, 0.05, hzZ);
          fd.rotation.set(0, 0, 0);
          fd.scale.setScalar(0.86);
          fd.updateMatrix();
          this.hazardFoamInst.setMatrixAt(hFoamCount++, fd.matrix);
        }
      } else if (hz.type === 'crate') {
        gd.position.set(hx, 0.24 + bob * 1.15, hzZ);
        gd.rotation.set(0.14 * Math.sin(time * 2.4 + i), time * 0.55 + i * 1.1, 0.18 * Math.cos(time * 2.9 + i));
        gd.scale.setScalar(1);
        gd.updateMatrix();
        this.crateWoodInst.setMatrixAt(crateCount, gd.matrix);
        this.crateAmberInst.setMatrixAt(crateCount, gd.matrix);
        this.crateIronInst.setMatrixAt(crateCount, gd.matrix);
        crateCount++;
        if (hFoamCount < MAX_HAZARDS) {
          fd.position.set(hx, 0.04, hzZ);
          fd.rotation.set(0, -time * 0.8 + i, 0);
          fd.scale.setScalar(1.05);
          fd.updateMatrix();
          this.hazardFoamInst.setMatrixAt(hFoamCount++, fd.matrix);
        }
      } else if (hz.type === 'rock') {
        gd.position.set(hx, 0.38, hzZ);
        gd.rotation.set(0, 0, 0);
        gd.scale.setScalar(1);
        gd.updateMatrix();
        this.rockStoneInst.setMatrixAt(rockCount, gd.matrix);
        this.rockCrystalInst.setMatrixAt(rockCount, gd.matrix);
        rockCount++;
        if (hFoamCount < MAX_HAZARDS) {
          fd.position.set(hx, 0.04, hzZ);
          fd.rotation.set(0, 0, 0);
          fd.scale.setScalar(1.2);
          fd.updateMatrix();
          this.hazardFoamInst.setMatrixAt(hFoamCount++, fd.matrix);
        }
      }
    }
    for (let m = 0; m < activeMineInsts.length; m++) {
      activeMineInsts[m].count = mineCount;
      activeMineInsts[m].visible = mineCount > 0;
      if (mineCount > 0) activeMineInsts[m].instanceMatrix.needsUpdate = true;
    }
    this.crateWoodInst.count = crateCount;
    this.crateAmberInst.count = crateCount;
    this.crateIronInst.count = crateCount;
    this.crateWoodInst.visible = crateCount > 0;
    this.crateAmberInst.visible = crateCount > 0;
    this.crateIronInst.visible = crateCount > 0;
    if (crateCount > 0) {
      this.crateWoodInst.instanceMatrix.needsUpdate = true;
      this.crateAmberInst.instanceMatrix.needsUpdate = true;
      this.crateIronInst.instanceMatrix.needsUpdate = true;
    }
    this.rockStoneInst.count = rockCount;
    this.rockCrystalInst.count = rockCount;
    this.rockStoneInst.visible = rockCount > 0;
    this.rockCrystalInst.visible = rockCount > 0;
    if (rockCount > 0) {
      this.rockStoneInst.instanceMatrix.needsUpdate = true;
      this.rockCrystalInst.instanceMatrix.needsUpdate = true;
    }
    this.hazardFoamInst.count = hFoamCount;
    this.hazardFoamInst.visible = hFoamCount > 0;
    if (hFoamCount > 0) this.hazardFoamInst.instanceMatrix.needsUpdate = true;

    const gears = skimmer.gears || [];
    let gearActiveCount = 0;
    for (let i = 0; i < gears.length && gearActiveCount < MAX_GEARS; i++) {
      const g = gears[i];
      if (!g || g.collected || g.z < -5) continue;
      gd.position.set(g.laneX || 0, (g.y || 0) + 0.56 + Math.sin(time * 4.5 + i) * 0.05, -g.z);
      gd.rotation.set(0, time * 3.6 + i * 0.7, 0);
      gd.scale.setScalar(1);
      gd.updateMatrix();
      this.gearBodyInst.setMatrixAt(gearActiveCount, gd.matrix);
      this.gearJewelInst.setMatrixAt(gearActiveCount, gd.matrix);
      gearActiveCount++;
    }
    this.gearBodyInst.count = gearActiveCount;
    this.gearJewelInst.count = gearActiveCount;
    this.gearBodyInst.visible = gearActiveCount > 0;
    this.gearJewelInst.visible = gearActiveCount > 0;
    if (gearActiveCount > 0) {
      this.gearBodyInst.instanceMatrix.needsUpdate = true;
      this.gearJewelInst.instanceMatrix.needsUpdate = true;
    }

    const bolts = skimmer.bolts || [];
    const useVoxel = Boolean(fxStyle.voxel);
    const wantCoreGeo = useVoxel ? this.sharedGeos.boltVoxel : this.sharedGeos.boltPrism;
    if (this.boltCoreInst.geometry !== wantCoreGeo) {
      this.boltCoreInst.geometry = wantCoreGeo;
    }
    let boltActiveCount = 0;
    for (let i = 0; i < bolts.length && boltActiveCount < MAX_BOLTS; i++) {
      const bObj = bolts[i];
      if (!bObj) continue;
      gd.position.set(bObj.laneX || 0, (bObj.y || 0) + 0.28, -bObj.z);
      if (useVoxel) {
        gd.rotation.set(time * 12, time * 15, 0);
        gd.scale.setScalar(1);
      } else {
        gd.rotation.set(0, 0, time * 18 + i);
        gd.scale.set(0.85, 0.85, 1.45);
      }
      gd.updateMatrix();
      this.boltCoreInst.setMatrixAt(boltActiveCount, gd.matrix);
      gd.rotation.set(0, 0, -time * 14);
      gd.scale.setScalar(1);
      gd.updateMatrix();
      this.boltRingInst.setMatrixAt(boltActiveCount, gd.matrix);
      boltActiveCount++;
    }
    this.boltCoreInst.count = boltActiveCount;
    this.boltRingInst.count = boltActiveCount;
    this.boltCoreInst.visible = boltActiveCount > 0;
    this.boltRingInst.visible = boltActiveCount > 0;
    if (boltActiveCount > 0) {
      this.boltCoreInst.instanceMatrix.needsUpdate = true;
      this.boltRingInst.instanceMatrix.needsUpdate = true;
    }

    this._updateOverlayHud(skimmer);
    this._syncOverlayParticlesAndPopups(outer.particles ?? ctx.particles, outer.popups ?? ctx.popups);

    // 6. Strict WebGL State Save -> Planar Reflection Pass -> Main Scene -> Overlay -> Restore!
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
    this.pogoRig?.dispose?.();
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
    for (const t of this.boostBadgeTex) t.dispose();
    this.waterNormalTex?.dispose();
    this.platingMaps?.map?.dispose();
    this.platingMaps?.normalMap?.dispose();
    this.platingMaps?.roughnessMap?.dispose();
    this.moonTex?.dispose();
    this.cloudTex?.dispose();
    this.foamRingTex?.dispose();
    if (this._ownSoftDot) this.softDotTex?.dispose();
  }
}
