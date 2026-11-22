// TOWERING WATERS: GATEWAY'S DESCENT — COASTAL UPDRAFT FRILL-GLIDE 3D RENDERER (`src/glideRenderer.js`)
//
// AAA Gateway-Centric Aerial Frill-Glide Engine:
//   - Gateway launches off the Spire's summit crown and soars directly on her flared, iridescent
//     webbed neck & rib frills (`FrillGlide` pose), streaming **soft feathered radial-alpha
//     slipstream mist ribbons** and **soft radial-alpha glowing spray/mist sprites** (zero opaque
//     flat stripes, zero hard hexagon particles!).
//   - Three distinct instanced sculpted coastal formations scrolling in parallax:
//       (a) Tall jagged coastal sea-stack pillars with stratified ledges (`mg_pbr_sedona_strata_albedo/normal`)
//       (b) Stepped flat-topped Sedona mesa crags with waterfalls & 3D sculpted conifer crowns (ZERO 2D cardboard stickers!)
//       (c) Weathered Pelagian sandstone aqueduct sea-arch ruin spans (`arch_canyon_sandstone` + `arch_antique_bronze` rings)
//   - Real animated GLSL multi-wave Fresnel specular ocean shader (deep sun-dappled turquoise-to-cerulean
//     coastal depth gradient, Schlick Fresnel sky reflections, crisp sparkling sunlit speculars,
//     soft feathered shore foam, and horizon mist blending seamlessly into `mg_bg_frill_glide.webp` —
//     ZERO glaring Voronoi/hexagonal caustic grids!).

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 48;
const CAM_Z = 10.4;

const MAX_DEW = 80;
const MAX_GATES = 10;
const MAX_THERMALS = 8;
const MAX_CLOUDS = 10;
const MAX_BIRDS = 64;
const NUM_SEA_STACKS = 5;
const NUM_MESA_CRAGS = 5;
const NUM_SEA_ARCHES = 4;
const TOTAL_FORMATIONS = NUM_SEA_STACKS + NUM_MESA_CRAGS + NUM_SEA_ARCHES;
const MAX_RAINBOWS = 4;
const MAX_RINGS = 24;
const MAX_PARTICLES = 280;
const MAX_POPUPS = 16;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const GLIDE_BIOME_PALETTES = {
  canyon_river: {
    skyTop: '#1d70b8',
    skyHor: '#f7d699',
    fog: '#a5d7ed',
    sun: '#fff1d6',
    hemiSky: '#7cc8f0',
    hemiGnd: '#28455c',
    cliff: '#ffffff',
    waterDeep: '#064778',
    waterShallow: '#0f98ab',
    waterSky: '#b7e2f5',
    thermal: '#fde047',
  },
  alpine_lake: {
    skyTop: '#1e5aa8',
    skyHor: '#fbcfe8',
    fog: '#c9e2f8',
    sun: '#fff5ed',
    hemiSky: '#98d6fa',
    hemiGnd: '#2c4a63',
    cliff: '#cbd5e1',
    waterDeep: '#074074',
    waterShallow: '#148ec4',
    waterSky: '#d4ecff',
    thermal: '#7dd3fc',
  },
  mist_bayou: {
    skyTop: '#4c1d95',
    skyHor: '#fb923c',
    fog: '#dfc4ac',
    sun: '#ffebd0',
    hemiSky: '#8bc4db',
    hemiGnd: '#24453c',
    cliff: '#d5ddd0',
    waterDeep: '#0a4448',
    waterShallow: '#148782',
    waterSky: '#f0cca8',
    thermal: '#34d399',
  },
  coral_sea: {
    skyTop: '#0284c7',
    skyHor: '#cffafe',
    fog: '#9de5f5',
    sun: '#fff6e0',
    hemiSky: '#82d8f7',
    hemiGnd: '#1e5266',
    cliff: '#f7ece0',
    waterDeep: '#065682',
    waterShallow: '#14b4c6',
    waterSky: '#c7f4ff',
    thermal: '#fde047',
  },
  storm_ocean: {
    skyTop: '#0f2942',
    skyHor: '#2dd4bf',
    fog: '#29576e',
    sun: '#d6ecff',
    hemiSky: '#63a8cf',
    hemiGnd: '#183042',
    cliff: '#94a3b8',
    waterDeep: '#062642',
    waterShallow: '#106e96',
    waterSky: '#5ca3c4',
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

// --- ANIMATED GLSL MULTI-WAVE FRESNEL SPECULAR COASTAL OCEAN SHADER ---
const GLIDE_OCEAN_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying vec3 vWorldPos;
  varying float vWaveH;
  varying float vFarT;
  varying float vCamDist;

  void main() {
    vec3 pos = position;
    vFarT = clamp((position.y + 24.0) / 48.0, 0.0, 1.0);
    float sx = position.x + uScroll * 0.024;
    float sy = position.y;

    // Non-orthogonal multi-directional coastal ocean swells (zero regular horizontal bars!)
    float h =
      sin(sx * 0.24 + sy * 0.19 + uTime * 1.35) * 0.11 +
      cos(sx * 0.41 - sy * 0.37 + uTime * 1.08) * 0.08 +
      sin(sx * 0.68 + sy * 0.62 - uTime * 1.85) * 0.04;

    pos.z += h * (1.0 - vFarT * 0.65);
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vWaveH = h;
    vec4 mvPos = viewMatrix * worldPos;
    vCamDist = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const GLIDE_OCEAN_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  varying vec3 vWorldPos;
  varying float vWaveH;
  varying float vFarT;
  varying float vCamDist;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    mat2 m = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = m * p * 2.03;
      a *= 0.5;
    }
    return s;
  }

  float oceanHeight(vec2 p, float t) {
    float w1 = fbm(p * vec2(0.24, 0.34) + vec2(t * 0.18, -t * 0.11));
    float w2 = fbm(p * vec2(0.56, 0.72) + vec2(-t * 0.24, t * 0.19) + vec2(w1 * 1.4));
    float rip = sin(p.x * 0.62 + p.y * 0.48 + t * 1.6 + w1 * 3.5) * 0.12;
    return (w1 * 0.52 + w2 * 0.36) + rip;
  }

  void main() {
    vec2 op = vec2(vWorldPos.x + uScroll * 0.024, vWorldPos.z);
    float eps = 0.22;
    float hc = oceanHeight(op, uTime);
    float hx = oceanHeight(op + vec2(eps, 0.0), uTime);
    float hz = oceanHeight(op + vec2(0.0, eps), uTime);
    vec3 N = normalize(vec3((hc - hx) * 1.15, 1.0, (hc - hz) * 1.15));

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Rich deep sun-dappled turquoise-to-cerulean coastal gradient
    float dapple = fbm(op * vec2(0.16, 0.22) + vec2(uTime * 0.07, 0.0));
    vec3 baseCol = mix(uShallowColor, uDeepColor, clamp(0.28 + vFarT * 0.64 + (0.52 - dapple) * 0.45, 0.0, 1.0));

    // Subsurface turquoise sunlight transmission through wave crests
    float sss = pow(clamp(dot(V, normalize(-L + N * 0.48)), 0.0, 1.0), 3.0) * (0.42 + max(0.0, vWaveH) * 2.6);
    baseCol += vec3(0.08, 0.42, 0.46) * sss * (1.0 - vFarT * 0.45);

    // Schlick Fresnel sunlit coastal sky reflection
    float ndotv = max(dot(N, V), 0.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - ndotv, 4.2);
    vec3 reflSky = mix(uSkyColor, uSunColor, 0.28 + 0.26 * vFarT);
    vec3 col = mix(baseCol, reflSky, fresnel * 0.66);

    // Subtle soft sparkling sunlight reflections on gentle ripples (ZERO harsh Voronoi lines!)
    vec3 H = normalize(L + V);
    float sparkle = pow(max(dot(N, H), 0.0), 130.0);
    float sheen = pow(max(dot(N, H), 0.0), 24.0);
    col += uSunColor * (sparkle * 1.18 + sheen * 0.16);

    // Exponential atmospheric fog + smooth far-horizon alpha feather blending seamlessly into mg_bg_frill_glide.webp!
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
    col = mix(col, uFogColor, clamp(fogFactor * 0.85 + smoothstep(0.55, 0.96, vFarT) * 0.55, 0.0, 1.0));
    float alpha = 1.0 - smoothstep(0.68, 0.99, vFarT);

    gl_FragColor = vec4(col, alpha);
  }
`;

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

function safeMergeGeos(list, keepColor = false) {
  const normalized = list
    .filter(Boolean)
    .map((g) => {
      const ng = g.index ? g.toNonIndexed() : g.clone();
      if (!ng.attributes.normal) ng.computeVertexNormals();
      if (!ng.attributes.uv) {
        const cnt = ng.attributes.position.count;
        ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
      }
      for (const key of Object.keys(ng.attributes)) {
        if (key !== 'position' && key !== 'normal' && key !== 'uv' && !(keepColor && key === 'color')) {
          ng.deleteAttribute(key);
        }
      }
      return ng;
    });
  if (normalized.length === 0) return null;
  if (normalized.length === 1) return normalized[0];
  if (BufferGeometryUtils && typeof BufferGeometryUtils.mergeGeometries === 'function') {
    const merged = BufferGeometryUtils.mergeGeometries(normalized, false);
    if (merged) {
      for (const g of normalized) g.dispose();
      return merged;
    }
  }
  return normalized[0];
}

function paintVertexColor(geo, hex) {
  const col = new THREE.Color(hex);
  const cnt = geo.attributes.position.count;
  const arr = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/**
 * Soft feathered radial-alpha slipstream mist ribbon texture for Gateway's wingtips & tail.
 */
function createSlipstreamRibbonTexture(w = 256, h = 64) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([190, 252, 255, 160]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1)) * 2 - 1;
    const edgeFade = Math.exp(-v * v * 4.8) * Math.max(0, 1 - v * v);
    const coreGlow = Math.exp(-v * v * 14.0);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const tailFade = Math.pow(u, 1.55);
      const tipSoft = Math.sin(Math.min(1, (1 - u) * 7.0) * Math.PI * 0.5);
      const wisp =
        0.65 +
        0.35 * noiseTileGlide(u * 2.5, y / h, 8) * (0.7 + 0.3 * Math.sin(u * 14.0 + v * 3.0));
      const a = clamp(tailFade * tipSoft * edgeFade * wisp, 0, 1);
      const p = (y * w + x) * 4;
      data[p] = Math.round(lerp(178, 255, coreGlow));
      data[p + 1] = Math.round(lerp(244, 255, coreGlow));
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 225);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft radial-alpha glowing spray/mist sprite texture (ZERO hard hexagons or polygons!).
 */
function createSoftGlowSpriteTexture(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([235, 252, 255, 200]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
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
    const dy = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1;
      const r2 = dx * dx + dy * dy;
      const mask = Math.max(0, 1 - r2);
      const halo = Math.exp(-r2 * 4.2) * mask;
      const core = Math.exp(-r2 * 16.0);
      const a = clamp(halo * 0.85 + core * 0.45, 0, 1);
      const p = (y * size + x) * 4;
      data[p] = Math.round(lerp(214, 255, core));
      data[p + 1] = Math.round(lerp(248, 255, core));
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 245);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftShoreFoamTexture(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([228, 252, 255, 140]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
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
    const dy = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ringDist = (r - 0.62) / 0.24;
      const ringBand = Math.exp(-ringDist * ringDist * 2.2) * (r < 0.98 ? 1 : 0);
      const wisp = noiseTileGlide(x / size, y / size, 10) * 0.65 + noiseTileGlide(x / size, y / size, 20) * 0.35;
      const a = clamp(ringBand * (0.35 + wisp * 0.85), 0, 1);
      const p = (y * size + x) * 4;
      data[p] = 232;
      data[p + 1] = 251;
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 165);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftRainbowArcTexture(w = 256, h = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([255, 240, 220, 60]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const stops = [
    [251, 113, 133],
    [253, 186, 116],
    [253, 224, 71],
    [74, 222, 128],
    [56, 189, 248],
    [192, 132, 252],
  ];
  for (let y = 0; y < h; y++) {
    const ny = 1 - y / (h - 1);
    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1)) * 2 - 1;
      const r = Math.sqrt(nx * nx + ny * ny);
      const bandU = (r - 0.62) / 0.28;
      let a = 0;
      let rr = 255;
      let gg = 255;
      let bb = 255;
      if (bandU > 0 && bandU < 1 && ny > 0.02) {
        const radialFade = Math.sin(bandU * Math.PI);
        const footFade = Math.sin(Math.min(1, ny * 2.8) * Math.PI * 0.5);
        a = radialFade * radialFade * footFade * 0.42;
        const pos = (1 - bandU) * (stops.length - 1);
        const idx = Math.min(stops.length - 2, Math.floor(pos));
        const f = pos - idx;
        rr = lerp(stops[idx][0], stops[idx + 1][0], f);
        gg = lerp(stops[idx][1], stops[idx + 1][1], f);
        bb = lerp(stops[idx][2], stops[idx + 1][2], f);
      }
      const p = (y * w + x) * 4;
      data[p] = Math.round(rr);
      data[p + 1] = Math.round(gg);
      data[p + 2] = Math.round(bb);
      data[p + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHorizonMistTexture(w = 64, h = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([186, 232, 248, 120]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, 'rgba(182, 230, 248, 0.0)');
  g.addColorStop(0.45, 'rgba(205, 238, 250, 0.52)');
  g.addColorStop(0.72, 'rgba(232, 246, 252, 0.68)');
  g.addColorStop(1.0, 'rgba(120, 198, 224, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class AdaptiveFrillGliderHero {
  constructor(skinId = 'sea_glass_guardian') {
    this.skinId = skinId;
    this.group = new THREE.Group();
    this.liveRig = null;

    const pal = SKIN_PALETTES[skinId] || SKIN_PALETTES.sea_glass_guardian;
    this.slipstreamTex = createSlipstreamRibbonTexture(256, 64);

    this.frillWingMat = new THREE.MeshStandardMaterial({
      color: pal.frill,
      emissive: pal.ribbon,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
    });
    this.ribbonMat = new THREE.MeshBasicMaterial({
      map: this.slipstreamTex,
      color: pal.ribbon,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.frillWingsGroup = new THREE.Group();
    // GatewayRig already renders her sculpted iridescent frills — keep zero flat cyan paddles!
    this.wingL = new THREE.Group();
    this.wingR = new THREE.Group();
    this.frillWingsGroup.add(this.wingL, this.wingR);

    // Soft Feathered Radial-Alpha Slipstream Mist Ribbons trailing gracefully from Gateway's shoulders & tail
    this.ribbons = [];
    for (const sz of [-1, 1]) {
      const ribGeo = new THREE.PlaneGeometry(2.6, 0.36, 18, 1);
      ribGeo.translate(-1.3, 0, 0);
      const rib = new THREE.Mesh(ribGeo, this.ribbonMat);
      rib.position.set(0.05, 0.08, sz * 0.42);
      rib.rotation.x = Math.PI * 0.16 * sz;
      this.frillWingsGroup.add(rib);
      this.ribbons.push({ mesh: rib, basePos: ribGeo.attributes.position.array.slice(), side: sz, len: 2.6 });
    }
    const tailRibGeo = new THREE.PlaneGeometry(2.1, 0.28, 14, 1);
    tailRibGeo.translate(-1.05, 0, 0);
    const tailRib = new THREE.Mesh(tailRibGeo, this.ribbonMat);
    tailRib.position.set(-0.38, 0.02, 0);
    this.frillWingsGroup.add(tailRib);
    this.ribbons.push({ mesh: tailRib, basePos: tailRibGeo.attributes.position.array.slice(), side: 0, len: 2.1 });

    this.group.add(this.frillWingsGroup);

    this.bodyCarrier = new THREE.Group();
    this.liveRig = new GatewayRig(this.skinId);
    this._liveMount = new THREE.Group();
    this._liveMount.rotation.order = 'YXZ';
    // Sleek aerodynamic horizontal soaring pose (`FrillGlide` pelvis + 0.94 rad X tilt aligns Gateway
    // horizontally nose-forward +X with flared frills, tucked legs & tail streaming horizontally -X!)
    this._liveMount.rotation.set(0.94, Math.PI * 0.5, 0);
    this._liveMount.scale.setScalar(1.22);
    this._liveMount.position.set(-0.08, -0.26, 0);
    this.frillWingsGroup.scale.setScalar(1.18);
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
    const buffet = clamp(gliderState.buffet || 0, 0, 1);
    const liftVal = clamp(gliderState.lift || 0, 0, 1.5);
    const airspeed = clamp(gliderState.airspeed ?? gliderState.speed ?? 1, 0.65, 1.8);
    const diveVal = clamp(gliderState.dive || 0, 0, 1);
    const buffetFlutter = (buffet * 0.28 + liftVal * 0.16) * Math.sin(time * 22.0);
    const dihedral = 0.12 + flapPulse * 0.52 + liftVal * 0.34 + buffet * 0.22 + buffetFlutter - diveVal * 0.22;

    this.frillWingsGroup.visible = !landed;
    this.wingL.rotation.x = -dihedral;
    this.wingR.rotation.x = dihedral;
    // Expressive wing-frill upward flex & slipstream rush intensity
    const ribSpeedScale = clamp(0.85 + (airspeed - 0.85) * 0.85 + diveVal * 0.35, 0.75, 1.75);
    this.ribbonMat.opacity = clamp(0.56 + diveVal * 0.24 + Math.max(0, airspeed - 1) * 0.28 + buffet * 0.14, 0.45, 0.94);

    for (const r of this.ribbons) {
      const pos = r.mesh.geometry.attributes.position;
      const base = r.basePos;
      r.mesh.scale.x = ribSpeedScale;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const u = clamp(-bx / r.len, 0, 1);
        const plumeScale = 0.65 + u * 0.95;
        const liftUp = (liftVal * 0.24 + buffet * 0.18) * u;
        const amp = 0.22 + buffet * 0.16 + diveVal * 0.08;
        pos.setY(i, by * plumeScale + liftUp + Math.sin(time * (9.5 + airspeed * 3.5) - u * 4.8 + r.side) * u * amp);
        pos.setZ(i, Math.cos(time * 7.8 - u * 3.8 + r.side * 0.7) * u * (0.14 + buffet * 0.10));
      }
      pos.needsUpdate = true;
    }

    if (this.liveRig?.update) {
      if (this._liveMount) {
        const diveLean = diveVal * 0.22;
        this._liveMount.rotation.set(
          landed ? 0 : 0.94 + diveLean - (gliderState.flare || 0) * 0.22 - liftVal * 0.12 + buffetFlutter * 0.12,
          Math.PI * 0.5,
          landed ? 0 : buffetFlutter * 0.14
        );
      }
      try {
        this.liveRig.update(dt, {
          time,
          vx: landed ? gliderState.vx * 0.02 : 2.6 + airspeed * 0.9,
          vy: -(gliderState.vy || 0) * 0.01,
          facing: 1,
          onGround: landed,
          gliding: !landed,
          isGliding: !landed,
          anim: landed ? 'HeroCelebrate' : 'FrillGlide',
          mood:
            (gliderState.stun || 0) > 0
              ? 'hurt'
              : landed || liftVal > 0.25 || (gliderState.flare || 0) > 0.35
              ? 'joyful'
              : diveVal > 0.35
              ? 'determined'
              : 'happy',
          frillFlare: landed ? 0.25 : clamp(0.96 + liftVal * 0.32 + buffet * 0.25, 0.65, 1.45),
        });
        // Stream Gateway 2.0's tail smoothly aft along her horizontal slipstream (eliminates vertical scorpion curl!)
        if (!landed && this.liveRig.bones) {
          const b = this.liveRig.bones;
          const flutter = Math.sin(time * 9.0) * 0.06;
          if (b.Tail1) b.Tail1.rotateX(-0.92 + flutter * 0.6);
          if (b.Tail2) b.Tail2.rotateX(-0.28 + Math.sin(time * 9.0 - 0.7) * 0.06);
          if (b.Tail3) b.Tail3.rotateX(-0.18 + Math.sin(time * 9.0 - 1.4) * 0.05);
          if (b.Tail4) b.Tail4.rotateX(-0.08 + Math.sin(time * 9.0 - 2.1) * 0.05);
          if (b.Head) b.Head.rotateX(-0.34); // Lift adorable chin slightly forward to gaze ahead down the canyon!
        }
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
    this.slipstreamTex?.dispose();
    this.frillWingMat.dispose();
    this.ribbonMat.dispose();
  }
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
  g.addColorStop(0.24, '#2282cc');
  g.addColorStop(0.50, '#67c8f5');
  g.addColorStop(0.72, '#fef3c7');
  g.addColorStop(0.90, '#fed7aa');
  g.addColorStop(1.0, '#fde68a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);
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
      const wU = u + (noiseTileGlide(u, v, 4) - 0.5) * 0.24;
      const wV = v + (noiseTileGlide(u + 0.33, v + 0.21, 4) - 0.5) * 0.14;
      const grain =
        noiseTileGlide(wU, wV, 8) * 0.48 +
        noiseTileGlide(wU, wV, 18) * 0.34 +
        noiseTileGlide(u, v, 36) * 0.18;
      const bedding = 0.5 + 0.5 * Math.sin((wV * 7.0 + grain * 0.55) * TAU);
      const tBand = clamp(grain * 0.56 + bedding * 0.44, 0, 1);
      const p = (y * size + x) * 4;
      data[p] = clamp(Math.round(lerp(140, 228, tBand)), 0, 255);
      data[p + 1] = clamp(Math.round(lerp(68, 144, tBand)), 0, 255);
      data[p + 2] = clamp(Math.round(lerp(44, 96, tBand)), 0, 255);
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

function createFeatheredCascadeTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([235, 250, 255, 220]);
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
    const vFade =
      Math.sin(Math.min(1, v * 5.2) * Math.PI * 0.5) *
      Math.sin(Math.min(1, (1 - v) * 3.2) * Math.PI * 0.5);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127) * 2 - 1;
      const edgeFade = Math.exp(-u * u * 4.4);
      const wisp = noiseTileGlide(x / 128, v * 2.5, 8) * 0.55 + noiseTileGlide(x / 128, v * 4.5, 16) * 0.45;
      const a = clamp(vFade * edgeFade * (0.48 + 0.52 * wisp), 0, 1);
      const p = (y * 128 + x) * 4;
      data[p] = 232;
      data[p + 1] = 251;
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 212);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft feathered rising golden updraft wind-wisp texture (fades cleanly to 0 on ALL 4 borders —
 * ZERO hard vertical cylinder silhouette line!).
 */
function createSoftUpdraftTexture(w = 128, h = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([253, 224, 71, 80]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const vFade = Math.sin(v * Math.PI);
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const edgeFade = Math.exp(-u * u * 5.2) * Math.max(0, 1 - u * u);
      const ribbon1 = Math.exp(-Math.pow(u - Math.sin(v * TAU * 2.0) * 0.32, 2) * 18.0);
      const ribbon2 = Math.exp(-Math.pow(u + Math.cos(v * TAU * 1.5) * 0.28, 2) * 22.0);
      const mist = noiseTileGlide(x / w, v * 2.0, 6);
      const a = clamp(vFade * edgeFade * (0.28 + (ribbon1 + ribbon2) * 0.65) * (0.65 + 0.35 * mist), 0, 1);
      const p = (y * w + x) * 4;
      data[p] = 255;
      data[p + 1] = 244;
      data[p + 2] = 186;
      data[p + 3] = Math.round(a * 175);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Sleek faceted crystalline water-dew gem (replaces bulky low-poly faceted soccer balls!).
 */
function buildWaterDewCrystalGeo() {
  const parts = [];
  const top = new THREE.ConeGeometry(0.13, 0.28, 6);
  top.translate(0, 0.14, 0);
  parts.push(top);
  const bot = new THREE.ConeGeometry(0.13, 0.18, 6);
  bot.rotateX(Math.PI);
  bot.translate(0, -0.09, 0);
  parts.push(bot);
  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Sculpted 3D Coastal Gull / Canyon Swallow (tapered swept arched wings via ExtrudeGeometry +
 * streamlined body + golden beak — ZERO rectangular box wings or grey plastic cones!).
 */
function buildCoastalGullGeo() {
  const parts = [];
  const body = paintVertexColor(new THREE.SphereGeometry(0.085, 10, 8), '#f8fafc');
  body.scale(2.5, 0.72, 0.85);
  parts.push(body);

  const head = paintVertexColor(new THREE.SphereGeometry(0.065, 8, 6), '#ffffff');
  head.translate(-0.20, 0.03, 0);
  parts.push(head);

  const beak = paintVertexColor(new THREE.ConeGeometry(0.022, 0.09, 5), '#f59e0b');
  beak.rotateZ(Math.PI * 0.5);
  beak.translate(-0.28, 0.02, 0);
  parts.push(beak);

  const tail = paintVertexColor(new THREE.ConeGeometry(0.065, 0.24, 4), '#cbd5e1');
  tail.rotateZ(-Math.PI * 0.5);
  tail.scale(1.0, 0.22, 1.35);
  tail.translate(0.26, 0.01, 0);
  parts.push(tail);

  // Tapered curved gull wings (organic feathered crescent silhouette, zero flat rectangles!)
  for (const sz of [-1, 1]) {
    const wShape = new THREE.Shape();
    wShape.moveTo(-0.08, 0.02);
    wShape.quadraticCurveTo(-0.04, sz * 0.34, 0.08, sz * 0.68);
    wShape.quadraticCurveTo(0.16, sz * 0.54, 0.14, sz * 0.26);
    wShape.quadraticCurveTo(0.11, sz * 0.08, 0.08, 0.0);
    wShape.closePath();
    const wing = new THREE.ExtrudeGeometry(wShape, { depth: 0.018, bevelEnabled: false, curveSegments: 8 });
    wing.rotateX(-Math.PI * 0.5);
    const wp = wing.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const wz = wp.getZ(i);
      const span = Math.abs(wz) / 0.68;
      // Natural arched gull dihedral (rises at elbow, gently droops at dark wingtip)
      const archY = Math.sin(span * Math.PI * 0.85) * 0.11 - Math.pow(span, 2.2) * 0.06;
      wp.setY(i, wp.getY(i) + archY + 0.02);
    }
    wing.computeVertexNormals();
    paintVertexColor(wing, '#e2e8f0');
    parts.push(wing);
  }
  const merged = safeMergeGeos(parts, true);
  for (const g of parts) g.dispose();
  return merged;
}

// --- 3 DISTINCT SCULPTED COASTAL ROCK & PELAGIAN RUIN FORMATIONS ---

/**
 * Formation A: Tall Jagged Coastal Sea-Stack Pillar with deep submerged root base,
 * wave-cut notch, stratified ledges, natural summit pinnacle, and companion needle stack.
 */
function buildSeaStackPillarGeo(seed = 17) {
  const parts = [];
  // Extended deep base (height 16.5, bottom plunges well below ocean plane!)
  const mainSpire = new THREE.CylinderGeometry(0.42, 2.65, 16.5, 14, 14);
  const pos = mainSpire.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + 8.25) / 16.5;
    const ang = Math.atan2(z, x);
    const undercut = 1.0 - 0.20 * Math.exp(-Math.pow((yn - 0.32) / 0.09, 2));
    const strataLedge = 1.0 + 0.16 * Math.sin(yn * 24.0 + seed) + 0.14 * Math.cos(ang * 3 + seed);
    const lean = Math.sin(yn * Math.PI * 0.78) * 0.45;
    const capTaper = yn > 0.86 ? lerp(1.0, 0.28, (yn - 0.86) / 0.14) : 1.0;
    x = x * undercut * strataLedge * capTaper + lean;
    z = z * undercut * strataLedge * capTaper * 0.84;
    pos.setXYZ(i, x, y + 3.2, z);
  }
  mainSpire.computeVertexNormals();
  parts.push(mainSpire);

  const needle = new THREE.CylinderGeometry(0.24, 1.65, 11.4, 10, 8);
  const np = needle.attributes.position;
  for (let i = 0; i < np.count; i++) {
    let x = np.getX(i);
    let y = np.getY(i);
    let z = np.getZ(i);
    const yn = (y + 5.7) / 11.4;
    const ang = Math.atan2(z, x);
    const jag = 1.0 + 0.14 * Math.sin(yn * 16.0 + seed + 2.1) + 0.12 * Math.cos(ang * 3 - 1.1);
    x *= jag;
    z *= jag * 0.85;
    np.setXYZ(i, x + 2.15, y + 1.2, z - 0.45);
  }
  needle.computeVertexNormals();
  parts.push(needle);

  const merged = safeMergeGeos(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/**
 * Formation B: Broad Stepped Flat-Topped Sedona Mesa Crag with deep submerged skirt & flat plateau crown.
 */
function buildSteppedMesaCragGeo(seed = 329) {
  const parts = [];
  const baseMesa = new THREE.CylinderGeometry(3.25, 5.15, 12.6, 16, 12);
  const pos = baseMesa.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + 6.3) / 12.6;
    const ang = Math.atan2(z, x);
    const terrace = yn > 0.82 ? 0.84 : yn > 0.56 ? 0.96 : 1.12;
    const crag = 1.0 + 0.12 * Math.cos(ang * 4 + seed) + 0.08 * Math.sin(ang * 7 - yn * 6.0);
    x *= terrace * crag * 1.15;
    z *= terrace * crag * 0.78;
    pos.setXYZ(i, x, y + 1.8, z);
  }
  baseMesa.computeVertexNormals();
  parts.push(baseMesa);

  const shoulder = new THREE.CylinderGeometry(1.75, 3.05, 8.8, 10, 6);
  const sp = shoulder.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    const y = sp.getY(i);
    const z = sp.getZ(i);
    const ang = Math.atan2(z, x);
    const f = 1.0 + 0.14 * Math.sin(ang * 3 + seed);
    sp.setXYZ(i, x * f - 2.95, y + 0.3, z * f * 0.8 + 0.55);
  }
  shoulder.computeVertexNormals();
  parts.push(shoulder);

  const merged = safeMergeGeos(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/**
 * Formation C: Weathered Pelagian Sandstone Aqueduct Sea-Arch / Stone Ruin Span
 * (with deep submerged pier foundations plunging cleanly beneath the ocean plane!).
 */
function buildAqueductSeaArchParts() {
  const stoneParts = [];
  const bronzeParts = [];

  for (const sx of [-1, 1]) {
    const px = sx * 3.1;
    // Deep submerged stepped stone foundation plinth plunging down to y=-4.2
    const plinth = new THREE.BoxGeometry(2.45, 6.8, 2.25);
    plinth.translate(px, -0.8, 0);
    stoneParts.push(plinth);

    const shaft = new THREE.BoxGeometry(1.78, 6.2, 1.72);
    shaft.translate(px, 4.9, 0);
    stoneParts.push(shaft);

    const cap = new THREE.BoxGeometry(2.18, 0.65, 2.08);
    cap.translate(px, 8.15, 0);
    stoneParts.push(cap);

    const ruinBlock = new THREE.BoxGeometry(1.35, sx > 0 ? 1.55 : 0.95, 1.42);
    ruinBlock.translate(px, 9.0 + (sx > 0 ? 0.25 : 0), 0);
    stoneParts.push(ruinBlock);

    for (const ry of [3.2, 6.6, 8.15]) {
      const collar = new THREE.TorusGeometry(1.26, 0.14, 8, 18);
      collar.rotateX(Math.PI * 0.5);
      collar.scale(1.02, 1.0, 0.96);
      collar.translate(px, ry, 0);
      bronzeParts.push(collar);
    }
  }

  const archSegments = 12;
  const archRadius = 3.1;
  const archCenterY = 5.45;
  for (let i = 0; i < archSegments; i++) {
    const a = ((i + 0.5) / archSegments) * Math.PI;
    const vx = Math.cos(a) * archRadius;
    const vy = archCenterY + Math.sin(a) * archRadius;
    const isKeystone = i === 5 || i === 6;
    const block = new THREE.BoxGeometry(
      isKeystone ? 1.05 : 0.94,
      isKeystone ? 1.38 : 1.08,
      isKeystone ? 1.92 : 1.66
    );
    block.rotateZ(a - Math.PI * 0.5);
    block.translate(vx, vy, 0);
    stoneParts.push(block);
  }

  const lintel = new THREE.BoxGeometry(8.2, 0.82, 1.78);
  lintel.translate(0, 8.92, 0);
  stoneParts.push(lintel);

  const archBronzeRing = new THREE.TorusGeometry(2.58, 0.16, 10, 26, Math.PI);
  archBronzeRing.translate(0, archCenterY, 0.0);
  bronzeParts.push(archBronzeRing);

  const crownMedallion = new THREE.CylinderGeometry(0.68, 0.68, 1.88, 14);
  crownMedallion.rotateX(Math.PI * 0.5);
  crownMedallion.translate(0, 9.25, 0);
  bronzeParts.push(crownMedallion);

  const stoneGeo = safeMergeGeos(stoneParts);
  const bronzeGeo = safeMergeGeos(bronzeParts);
  for (const g of stoneParts) g.dispose();
  for (const g of bronzeParts) g.dispose();
  return { stoneGeo, bronzeGeo };
}

/**
 * Layered 3D crossed dark pine-bough cluster for `biome_foliage_redwood.webp` (`alphaTest: 0.50`,
 * `transparent: false` — crisp forest pine crowns with ZERO Play-Doh clay & ZERO bright halo!).
 */
function buildRedwoodBoughClusterGeo() {
  const planes = [];
  const specs = [
    { rotY: 0.0, y: 2.0, w: 3.4, h: 4.3, tilt: 0.04 },
    { rotY: Math.PI / 3, y: 2.1, w: 3.3, h: 4.2, tilt: -0.04 },
    { rotY: (2 * Math.PI) / 3, y: 1.9, w: 3.2, h: 4.1, tilt: 0.05 },
    { rotY: Math.PI * 0.5, y: 2.9, w: 2.4, h: 3.1, tilt: -0.04 },
  ];
  for (const sp of specs) {
    const p = new THREE.PlaneGeometry(sp.w, sp.h, 2, 2);
    const pos = p.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      const vn = (py + sp.h * 0.5) / sp.h;
      pos.setZ(i, Math.sin(vn * Math.PI * 0.85) * 0.24);
    }
    p.rotateX(sp.tilt);
    p.rotateY(sp.rotY);
    p.translate(0, sp.y, 0);
    p.computeVertexNormals();
    planes.push(p);
  }
  const merged = safeMergeGeos(planes);
  for (const g of planes) g.dispose();
  return merged;
}

/**
 * Rich 7-lobe sunlit billowy cumulus cloud geometry with warm cream tops & cool undersides
 * (1 draw call per cloud!).
 */
function buildMergedCloudGeo() {
  const puffs = [];
  const specs = [
    { x: 0.0, y: 0.24, z: 0.0, rx: 0.92, ry: 0.64, rz: 0.72, col: '#fffdf7' },
    { x: -0.62, y: 0.08, z: 0.10, rx: 0.74, ry: 0.52, rz: 0.62, col: '#f8fafc' },
    { x: 0.64, y: 0.10, z: -0.06, rx: 0.78, ry: 0.54, rz: 0.64, col: '#f8fafc' },
    { x: -1.12, y: -0.10, z: -0.04, rx: 0.56, ry: 0.36, rz: 0.48, col: '#dce6f2' },
    { x: 1.14, y: -0.10, z: 0.06, rx: 0.58, ry: 0.36, rz: 0.50, col: '#dce6f2' },
    { x: -0.28, y: -0.18, z: 0.16, rx: 0.82, ry: 0.34, rz: 0.58, col: '#cbd8e8' },
    { x: 0.34, y: -0.18, z: -0.12, rx: 0.80, ry: 0.34, rz: 0.58, col: '#cbd8e8' },
  ];
  for (let s = 0; s < specs.length; s++) {
    const sp = specs[s];
    const g = new THREE.SphereGeometry(1.0, 9, 7);
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const vx = gp.getX(i);
      const vy = gp.getY(i);
      const vz = gp.getZ(i);
      const n = 1.0 + 0.08 * Math.sin(vx * 4.5 + s) * Math.cos(vz * 4.2);
      gp.setXYZ(i, vx * sp.rx * n + sp.x, vy * sp.ry * n + sp.y, vz * sp.rz * n + sp.z);
    }
    g.computeVertexNormals();
    paintVertexColor(g, sp.col);
    puffs.push(g);
  }
  const merged = safeMergeGeos(puffs, true);
  for (const g of puffs) g.dispose();
  return merged;
}

function loadGlideWebp(url, isSrgb = true, rx = 1, ry = 1, onReady = null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const loader = new THREE.TextureLoader();
    return loader.load(
      url,
      (t) => {
        t.wrapS = rx !== 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.wrapT = ry !== 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        if (rx !== 1 || ry !== 1) t.repeat.set(rx, ry);
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

/**
 * Twin-helix swirling golden thermal updraft ribbon geometry (unmistakable from 80u away!).
 */
function buildThermalHelixGeo() {
  const parts = [];
  for (let strand = 0; strand < 2; strand++) {
    const pts = [];
    const phaseOff = strand * Math.PI;
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = t * TAU * 2.5 + phaseOff;
      const rad = 0.72 + Math.sin(t * Math.PI) * 0.34;
      pts.push(new THREE.Vector3(Math.cos(ang) * rad, (t - 0.5) * 12.6, Math.sin(ang) * rad));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    parts.push(new THREE.TubeGeometry(curve, 32, 0.068, 6, false));
  }
  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Multi-segment jagged forked lightning bolt geometry (kills bare yellow cylinder!).
 */
function buildForkedLightningGeo() {
  const parts = [];
  const mainPts = [
    new THREE.Vector3(0.0, 0.0, 0),
    new THREE.Vector3(0.28, -1.8, 0.06),
    new THREE.Vector3(-0.24, -3.7, -0.05),
    new THREE.Vector3(0.32, -5.8, 0.04),
    new THREE.Vector3(-0.20, -8.2, -0.04),
    new THREE.Vector3(0.18, -10.5, 0.02),
    new THREE.Vector3(-0.08, -12.6, 0),
  ];
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mainPts), 20, 0.085, 6, false));
  const fork1 = [
    new THREE.Vector3(-0.24, -3.7, -0.05),
    new THREE.Vector3(-0.82, -5.2, 0.08),
    new THREE.Vector3(-1.18, -6.9, 0.0),
  ];
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fork1), 10, 0.048, 5, false));
  const fork2 = [
    new THREE.Vector3(0.32, -5.8, 0.04),
    new THREE.Vector3(0.92, -7.4, -0.06),
    new THREE.Vector3(1.22, -9.0, 0.02),
  ];
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fork2), 10, 0.044, 5, false));
  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Rich billowing storm-cloud thunderhead geometry with dark indigo-violet underside & rim-lit crown!
 */
function buildStormThunderheadGeo() {
  const puffs = [];
  const specs = [
    { x: 0.0, y: 0.36, z: 0.0, rx: 1.05, ry: 0.72, rz: 0.78, col: '#94a3b8' },
    { x: -0.78, y: 0.14, z: 0.12, rx: 0.82, ry: 0.56, rz: 0.66, col: '#64748b' },
    { x: 0.80, y: 0.16, z: -0.08, rx: 0.86, ry: 0.58, rz: 0.68, col: '#64748b' },
    { x: -1.32, y: -0.10, z: -0.05, rx: 0.62, ry: 0.38, rz: 0.52, col: '#475569' },
    { x: 1.34, y: -0.10, z: 0.06, rx: 0.64, ry: 0.38, rz: 0.54, col: '#475569' },
    { x: -0.34, y: -0.24, z: 0.16, rx: 0.92, ry: 0.36, rz: 0.62, col: '#312e59' },
    { x: 0.38, y: -0.24, z: -0.12, rx: 0.90, ry: 0.36, rz: 0.62, col: '#312e59' },
  ];
  for (let s = 0; s < specs.length; s++) {
    const sp = specs[s];
    const g = new THREE.SphereGeometry(1.0, 10, 8);
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const vx = gp.getX(i);
      const vy = gp.getY(i);
      const vz = gp.getZ(i);
      const n = 1.0 + 0.09 * Math.sin(vx * 4.5 + s) * Math.cos(vz * 4.2);
      gp.setXYZ(i, vx * sp.rx * n + sp.x, vy * sp.ry * n + sp.y, vz * sp.rz * n + sp.z);
    }
    g.computeVertexNormals();
    paintVertexColor(g, sp.col);
    puffs.push(g);
  }
  const merged = safeMergeGeos(puffs, true);
  for (const g of puffs) g.dispose();
  return merged;
}

function buildGlideEnvMap(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#f7d699');
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.BackSide })
    );
    envScene.add(dome);
    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fff7d6' })
    );
    sunOrb.position.set(8, 12, 10);
    envScene.add(sunOrb);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: '#0f766e', side: THREE.DoubleSide })
    );
    sea.rotation.x = -Math.PI * 0.5;
    sea.position.y = -6;
    envScene.add(sea);
    const rt = pmrem.fromScene(envScene, 0.04);
    dome.geometry.dispose();
    dome.material.dispose();
    sunOrb.geometry.dispose();
    sunOrb.material.dispose();
    sea.geometry.dispose();
    sea.material.dispose();
    pmrem.dispose();
    return { rt, texture: rt.texture };
  } catch {
    return null;
  }
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
    this._wp = { x: 0, y: 0, halfW: 5, halfH: 4 };
    this._glideFov = FOV;
    this._glideCamZ = CAM_Z;
    this.postfxActive = false;
    const envBuilt = opts.envMap ? null : buildGlideEnvMap(webgl);
    this._ownEnvRt = envBuilt?.rt || null;
    this.envMap = opts.envMap || envBuilt?.texture || null;

    this.skyTex = createAtmosphericSkyTexture();
    this.mesaTex = createMesaStrataTexture(256);
    this.mesaTex.repeat.set(2, 2);
    this.cascadeTex = createFeatheredCascadeTexture();

    this.glowSpriteTex = createSoftGlowSpriteTexture(128);
    this.shoreFoamTex = createSoftShoreFoamTexture(128);
    this.rainbowArcTex = createSoftRainbowArcTexture(256, 128);
    this.horizonMistTex = createHorizonMistTexture(64, 128);
    this.updraftTex = createSoftUpdraftTexture(128, 256);

    this._initScene();
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.hero?.setSkin(skinId);
  }

  prewarm() {
    if (this._disposed || !this.webgl || !this.scene || !this.camera) return;
    const saved = [];
    const savedCounts = [];
    const prevRt = this.webgl.getRenderTarget();
    const prevTone = this.webgl.toneMapping;
    const prevScissorTest = this.webgl.getScissorTest();
    const prevViewport = new THREE.Vector4();
    const prevScissor = new THREE.Vector4();
    this.webgl.getViewport(prevViewport);
    this.webgl.getScissor(prevScissor);
    try {
      this.scene.traverse((o) => {
        saved.push(o, o.visible, o.frustumCulled);
        o.visible = true;
        o.frustumCulled = false;
        if (o.isInstancedMesh && o.count === 0) {
          savedCounts.push(o, o.count);
          o.count = 1;
        }
      });
      this.webgl.setRenderTarget(null);
      this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
      this.webgl.setScissorTest(true);
      this.webgl.setScissor(0, 0, 16, 16);
      this.webgl.setViewport(0, 0, 16, 16);
      this.webgl.render(this.scene, this.camera);
    } catch {
      // Ignore
    } finally {
      for (let i = 0; i < saved.length; i += 3) {
        saved[i].visible = saved[i + 1];
        saved[i].frustumCulled = saved[i + 2];
      }
      for (let i = 0; i < savedCounts.length; i += 2) {
        savedCounts[i].count = savedCounts[i + 1];
      }
      this.webgl.toneMapping = prevTone;
      this.webgl.setViewport(prevViewport);
      this.webgl.setScissor(prevScissor);
      this.webgl.setScissorTest(prevScissorTest);
      this.webgl.setRenderTarget(prevRt);
    }
  }

  _updateGlideCamMetrics(fovAdd = 0) {
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    this._glideFov = portrait ? 50 : 46;
    this._glideCamZ = portrait ? 11.2 : 9.4;
    const targetFov = this._glideFov + clamp(fovAdd, 0, 8.5);
    if (this.camera) {
      const aspectChanged = Math.abs(this.camera.aspect - aspect) > 1e-4;
      const fovChanged = Math.abs(this.camera.fov - targetFov) > 0.02;
      if (aspectChanged || fovChanged) {
        this.camera.aspect = aspect;
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  resize(width, height, dpr = this.dpr) {
    this.width = Math.max(1, width || 390);
    this.height = Math.max(1, height || 620);
    this.dpr = dpr;
    this._updateGlideCamMetrics();
  }

  _screenToWorld(sx, sy, z = 0, out = this._wp) {
    const dist = this._glideCamZ - z;
    const halfH = Math.tan((this._glideFov * 0.5) * DEG) * dist;
    const halfW = halfH * (this.width / Math.max(1, this.height));
    out.x = ((sx / Math.max(1, this.width)) * 2 - 1) * halfW;
    out.y = (1 - (sy / Math.max(1, this.height)) * 2) * halfH;
    out.halfW = halfW;
    out.halfH = halfH;
    return out;
  }

  _pxScale(px, z = 0) {
    const dist = this._glideCamZ - z;
    const halfH = Math.tan((this._glideFov * 0.5) * DEG) * dist;
    return (px / Math.max(1, this.height)) * (2 * halfH);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1d70b8');
    this.scene.fog = new THREE.FogExp2('#a5d7ed', 0.0074);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.88;
    }

    this.camera = new THREE.PerspectiveCamera(FOV, this.width / Math.max(1, this.height), 0.2, 240);
    this._updateGlideCamMetrics();
    this.camera.position.set(0, 0, this._glideCamZ);

    // Unified Main-Game Lighting: warm golden directional key w/ hero contact shadow + cool azure hemisphere bounce + warm rim
    this.hemiLight = new THREE.HemisphereLight('#7cc8f0', '#28455c', 1.42);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff1d6', 2.40);
    this.sunLight.position.set(14, 24, 18);
    if (this.webgl?.shadowMap?.enabled) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 2;
      this.sunLight.shadow.camera.far = 75;
      this.sunLight.shadow.camera.left = -14;
      this.sunLight.shadow.camera.right = 14;
      this.sunLight.shadow.camera.top = 14;
      this.sunLight.shadow.camera.bottom = -14;
      this.sunLight.shadow.bias = -0.0006;
      this.sunLight.shadow.normalBias = 0.024;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#fde6b8', 1.05);
    this.rimLight.position.set(-14, 12, 10);
    this.scene.add(this.rimLight);

    // Volumetric Drifting 3D Cumulus Cloud Banks across 3 parallax sky-canyon depth layers!
    const cumulusGeo = buildMergedCloudGeo();
    this.ambientCloudMat = new THREE.MeshStandardMaterial({
      color: '#fff8ec',
      vertexColors: true,
      emissive: '#f5d4aa',
      emissiveIntensity: 0.24,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.ambientCloudInst = new THREE.InstancedMesh(cumulusGeo, this.ambientCloudMat, 16);
    this.ambientCloudInst.frustumCulled = false;
    this.scene.add(this.ambientCloudInst);

    // Studio-Painted Coastal Arch & Rainbow Waterfall Panorama (`assets/textures/mg_bg_frill_glide.webp`)
    this.skyBackdropMat = new THREE.MeshBasicMaterial({ map: this.skyTex, fog: false, depthWrite: false });
    this.skyBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.skyBackdropMat);
    this.skyBackdrop.position.set(0, 0, -56);
    this.scene.add(this.skyBackdrop);

    // 3 DISTINCT SCULPTED COASTAL ROCK & RUIN FORMATIONS (Instanced!)
    this.canyonGroup = new THREE.Group();

    this.seaStackMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.mesaTex,
      roughness: 0.78,
      metalness: 0.04,
    });
    this.cliffMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.mesaTex,
      roughness: 0.74,
      metalness: 0.04,
    });
    this.archStoneMat = new THREE.MeshStandardMaterial({
      color: '#f2dec8',
      map: this.mesaTex,
      roughness: 0.64,
      metalness: 0.08,
    });
    this.archBronzeMat = new THREE.MeshStandardMaterial({
      color: '#e5be7e',
      roughness: 0.28,
      metalness: 0.84,
    });
    this.coniferMat = new THREE.MeshStandardMaterial({
      color: '#436946',
      roughness: 0.78,
      metalness: 0.02,
      alphaTest: 0.50,
      side: THREE.DoubleSide,
      transparent: false,
    });
    this.fallsMat = new THREE.MeshBasicMaterial({
      map: this.cascadeTex,
      color: '#f0fdfa',
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.shoreFoamMat = new THREE.MeshBasicMaterial({
      map: this.shoreFoamTex,
      color: '#e6fcff',
      transparent: true,
      opacity: 0.76,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const seaStackGeo = buildSeaStackPillarGeo(17);
    const mesaCragGeo = buildSteppedMesaCragGeo(329);
    const seaArchParts = buildAqueductSeaArchParts();
    const foamQuadGeo = new THREE.PlaneGeometry(10.8, 10.8);
    foamQuadGeo.rotateX(-Math.PI * 0.49);
    const treeCrownGeo = buildRedwoodBoughClusterGeo();
    const fallsCardGeo = new THREE.PlaneGeometry(1.9, 8.2);

    this.seaStackInst = new THREE.InstancedMesh(seaStackGeo, this.seaStackMat, NUM_SEA_STACKS);
    this.mesaCragInst = new THREE.InstancedMesh(mesaCragGeo, this.cliffMat, NUM_MESA_CRAGS);
    this.seaArchStoneInst = new THREE.InstancedMesh(seaArchParts.stoneGeo, this.archStoneMat, NUM_SEA_ARCHES);
    this.seaArchBronzeInst = new THREE.InstancedMesh(seaArchParts.bronzeGeo, this.archBronzeMat, NUM_SEA_ARCHES);
    this.mesaFoamInst = new THREE.InstancedMesh(foamQuadGeo, this.shoreFoamMat, TOTAL_FORMATIONS + NUM_SEA_ARCHES);
    this.mesaFoamInst.renderOrder = 3;
    this.mesaTreeInst = new THREE.InstancedMesh(treeCrownGeo, this.coniferMat, NUM_MESA_CRAGS * 3);
    this.mesaFallsInst = new THREE.InstancedMesh(fallsCardGeo, this.fallsMat, NUM_MESA_CRAGS);

    for (const im of [
      this.seaStackInst,
      this.mesaCragInst,
      this.seaArchStoneInst,
      this.seaArchBronzeInst,
      this.mesaFoamInst,
      this.mesaTreeInst,
      this.mesaFallsInst,
    ]) {
      im.frustumCulled = false;
      this.canyonGroup.add(im);
    }
    this.scene.add(this.canyonGroup);

    // Soft Feathered Prismatic Rainbow Mist Arcs (1 draw call each instead of 5 hard RingGeometry bands!)
    this.rainbows = [];
    this.rainbowMat = new THREE.MeshBasicMaterial({
      map: this.rainbowArcTex,
      color: '#ffffff',
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rainbowGeo = new THREE.PlaneGeometry(11.6, 5.8);
    for (let r = 0; r < MAX_RAINBOWS; r++) {
      const rm = new THREE.Mesh(rainbowGeo, this.rainbowMat);
      this.scene.add(rm);
      this.rainbows.push(rm);
    }

    // Real Animated GLSL Multi-Wave Fresnel Specular Coastal Ocean (ZERO Voronoi hexagon grid, seamless alpha horizon!)
    this.waterGeo = new THREE.PlaneGeometry(118, 48, 48, 18);
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: GLIDE_OCEAN_VERT,
      fragmentShader: GLIDE_OCEAN_FRAG,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uDeepColor: { value: new THREE.Color('#064778') },
        uShallowColor: { value: new THREE.Color('#0f98ab') },
        uSkyColor: { value: new THREE.Color('#b7e2f5') },
        uSunColor: { value: new THREE.Color('#fff1d6') },
        uSunDir: { value: new THREE.Vector3(14, 24, 18).normalize() },
        uFogColor: { value: new THREE.Color('#a5d7ed') },
        uFogDensity: { value: 0.0078 },
      },
    });
    this.waterMesh = new THREE.Mesh(this.waterGeo, this.waterMat);
    this.waterMesh.rotation.x = -Math.PI * 0.49;
    this.waterMesh.position.set(0, -4.2, -11.5);
    this.scene.add(this.waterMesh);

    // Soft Sunlit Horizon Mist Veil seamlessly blending the 3D ocean into `mg_bg_frill_glide.webp`
    this.horizonMistMat = new THREE.MeshBasicMaterial({
      map: this.horizonMistTex,
      color: '#eef8ff',
      transparent: true,
      opacity: 0.68,
      fog: false,
      depthWrite: false,
    });
    this.horizonMistMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 9.5), this.horizonMistMat);
    this.horizonMistMesh.position.set(0, -1.8, -36);
    this.scene.add(this.horizonMistMesh);

    // Departure Spire Crown (`summitGroup` — hidden when phase !== 'intro') & Arrival Spire (`destTowerGroup`)
    this.spireMat = new THREE.MeshStandardMaterial({
      color: '#e8d0b5',
      map: this.mesaTex,
      roughness: 0.62,
      metalness: 0.12,
    });

    // Mount Studio-Painted Coastal Arch Backdrop & 1K Local PBR WebP Textures
    loadGlideWebp('assets/textures/mg_bg_frill_glide.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.skyBgWebp = t;
      this.skyBackdropMat.map = t;
      this.skyBackdropMat.needsUpdate = true;
    });
    // Brand-new Studio PBR Stratified Sedona Sandstone Strata (`mg_pbr_sedona_strata`, ZERO Voronoi cracks!)
    loadGlideWebp('assets/textures/mg_pbr_sedona_strata_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.seaStackMat.map = t;
      this.seaStackMat.needsUpdate = true;
      this.cliffMat.map = t;
      this.cliffMat.needsUpdate = true;
    });
    loadGlideWebp('assets/textures/mg_pbr_sedona_strata_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.seaStackMat.normalMap = t;
      this.seaStackMat.normalScale.set(1.35, 1.35);
      this.seaStackMat.needsUpdate = true;
      this.cliffMat.normalMap = t;
      this.cliffMat.normalScale.set(1.35, 1.35);
      this.cliffMat.needsUpdate = true;
    });
    loadGlideWebp('assets/textures/arch_canyon_sandstone_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.archStoneMat.map = t;
      this.archStoneMat.needsUpdate = true;
      this.spireMat.map = t;
      this.spireMat.needsUpdate = true;
    });
    loadGlideWebp('assets/textures/arch_canyon_sandstone_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.archStoneMat.normalMap = t;
      this.archStoneMat.normalScale.set(1.15, 1.15);
      this.archStoneMat.needsUpdate = true;
      this.spireMat.normalMap = t;
      this.spireMat.normalScale.set(1.15, 1.15);
      this.spireMat.needsUpdate = true;
    });
    loadGlideWebp('assets/textures/arch_canyon_sandstone_orm.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.archStoneMat.roughnessMap = t;
      this.archStoneMat.needsUpdate = true;
    });
    loadGlideWebp('assets/textures/arch_antique_bronze_albedo.webp', true, 2, 1, (t) => {
      if (this._disposed) return;
      this.archBronzeMat.map = t;
      this.archBronzeMat.needsUpdate = true;
      if (this.gateTorusMat) {
        this.gateTorusMat.map = t;
        this.gateTorusMat.needsUpdate = true;
      }
    });
    loadGlideWebp('assets/textures/arch_antique_bronze_normal.webp', false, 2, 1, (t) => {
      if (this._disposed) return;
      this.archBronzeMat.normalMap = t;
      this.archBronzeMat.normalScale.set(1.0, 1.0);
      this.archBronzeMat.needsUpdate = true;
      if (this.gateTorusMat) {
        this.gateTorusMat.normalMap = t;
        this.gateTorusMat.normalScale.set(1.0, 1.0);
        this.gateTorusMat.needsUpdate = true;
      }
    });
    loadGlideWebp('assets/textures/arch_antique_bronze_orm.webp', false, 2, 1, (t) => {
      if (this._disposed) return;
      this.archBronzeMat.roughnessMap = t;
      this.archBronzeMat.metalnessMap = t;
      this.archBronzeMat.needsUpdate = true;
    });
    loadGlideWebp('assets/textures/biome_foliage_redwood.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.coniferMat.map = t;
      this.coniferMat.needsUpdate = true;
    });

    this.summitGroup = new THREE.Group();
    const sumCol = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.25, 14, 18), this.spireMat);
    sumCol.position.y = -7.0;
    const sumCap = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.14, 8, 22), this.archBronzeMat);
    sumCap.rotation.x = Math.PI * 0.5;
    sumCap.position.y = -0.1;
    this.summitGroup.add(sumCol, sumCap);
    this.summitGroup.visible = false;
    this.scene.add(this.summitGroup);

    this.destTowerGroup = new THREE.Group();
    const destCol = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, 22, 18), this.spireMat);
    destCol.position.y = 2.0;
    const shore = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 5.8, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: '#e7d4b5', roughness: 0.75 })
    );
    shore.position.set(-2.6, -0.4, 0.5);
    this.destTowerGroup.add(destCol, shore);
    this.destTowerGroup.visible = false;
    this.scene.add(this.destTowerGroup);

    // Gateway Frill-Glider Hero
    this.hero = new AdaptiveFrillGliderHero(this.skinId);
    this.scene.add(this.hero.group);

    // Gilded Antique-Bronze Thermal Ring Gates
    this.gateSlots = [];
    const gateTorusGeo = new THREE.TorusGeometry(1, 0.10, 12, 30);
    const gateAuraGeo = new THREE.PlaneGeometry(2.05, 2.05);
    this.gateTorusMat = new THREE.MeshStandardMaterial({
      color: '#f7d47c',
      emissive: '#b45309',
      emissiveIntensity: 0.42,
      metalness: 0.84,
      roughness: 0.26,
    });
    const gateAuraMat = new THREE.MeshBasicMaterial({
      map: this.shoreFoamTex,
      color: '#67e8f9',
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < MAX_GATES; i++) {
      const g = new THREE.Group();
      const torus = new THREE.Mesh(gateTorusGeo, this.gateTorusMat);
      const aura = new THREE.Mesh(gateAuraGeo, gateAuraMat);
      torus.rotation.y = Math.PI * 0.32;
      aura.rotation.y = Math.PI * 0.32;
      g.add(torus, aura);
      g.visible = false;
      this.scene.add(g);
      this.gateSlots.push(g);
    }

    // Swirling Golden Thermal Updraft Columns + Twin-Helix 3D Updraft Ribbons!
    this.thermalMeshes = [];
    const thermGeo = new THREE.PlaneGeometry(2.9, 13.8);
    const helixGeo = buildThermalHelixGeo();
    for (let i = 0; i < MAX_THERMALS; i++) {
      const grp = new THREE.Group();
      const sheetMat = new THREE.MeshBasicMaterial({
        map: this.updraftTex,
        color: '#fde047',
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const sheet = new THREE.Mesh(thermGeo, sheetMat);
      const helixMat = new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const helix = new THREE.Mesh(helixGeo, helixMat);
      grp.add(sheet, helix);
      grp.userData = { sheet, sheetMat, helix, helixMat };
      grp.visible = false;
      this.scene.add(grp);
      this.thermalMeshes.push(grp);
    }

    // Sleek Faceted Crystalline Water-Dew Gems & Golden Harmonic Seeds (`stage.lanterns`)
    this.dewInst = new THREE.InstancedMesh(
      buildWaterDewCrystalGeo(),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#38bdf8',
        emissiveIntensity: 1.05,
        metalness: 0.45,
        roughness: 0.12,
      }),
      MAX_DEW
    );
    this.dewInst.frustumCulled = false;
    this.scene.add(this.dewInst);

    // Dramatic Volumetric 3D Storm Thunderhead Clouds + Internal Crackling Amber Core + Jagged Forked Lightning!
    this.cloudSlots = [];
    const stormCloudGeo = buildStormThunderheadGeo();
    const boltGeo = buildForkedLightningGeo();
    const boltMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const boltGlowMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const chargeCoreGeo = new THREE.SphereGeometry(0.45, 10, 8);
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const cg = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({
        color: '#94a3b8',
        vertexColors: true,
        emissive: '#1e1b4b',
        emissiveIntensity: 0.35,
        roughness: 0.90,
      });
      const body = new THREE.Mesh(stormCloudGeo, bodyMat);
      cg.add(body);

      const chargeMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const chargeCore = new THREE.Mesh(chargeCoreGeo, chargeMat);
      chargeCore.position.set(0, -0.18, 0.22);
      cg.add(chargeCore);

      const boltGroup = new THREE.Group();
      const boltCore = new THREE.Mesh(boltGeo, boltMat);
      const boltHalo = new THREE.Mesh(boltGeo, boltGlowMat);
      boltHalo.scale.set(2.1, 1.0, 2.1);
      boltGroup.add(boltCore, boltHalo);
      boltGroup.position.y = -0.35;
      boltGroup.visible = false;
      cg.add(boltGroup);

      cg.userData = { body, bodyMat, chargeCore, chargeMat, bolt: boltGroup };
      cg.visible = false;
      this.scene.add(cg);
      this.cloudSlots.push(cg);
    }

    // Sculpted 3D Coastal Gulls / Canyon Swallows (`stage.gulls`, ZERO plastic cones!)
    this.birdInst = new THREE.InstancedMesh(
      buildCoastalGullGeo(),
      new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.45 }),
      MAX_BIRDS
    );
    this.birdInst.frustumCulled = false;
    this.scene.add(this.birdInst);

    // Rings, Soft Radial-Alpha Glowing Spray/Mist Sprites (ZERO hard hexagons!) & Popups
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
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({
        map: this.glowSpriteTex,
        color: '#ffffff',
        transparent: true,
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      MAX_PARTICLES
    );
    this.ringInst.frustumCulled = false;
    this.partInst.frustumCulled = false;
    this.scene.add(this.ringInst, this.partInst);

    // Pooled Aerodynamic Wind-Streamline Streaks (1 instanced draw call; scales with airspeed/dive)
    this.windStreakMat = new THREE.MeshBasicMaterial({
      map: this.glowSpriteTex,
      color: '#e0f7ff',
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.windStreakInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.35, 0.055), this.windStreakMat, 36);
    this.windStreakInst.frustumCulled = false;
    this.windStreakInst.count = 0;
    this.scene.add(this.windStreakInst);

    // Pooled Rising Thermal Updraft Mist Spirals (1 instanced draw call)
    this.thermalSpiralInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.62, 0.24),
      new THREE.MeshBasicMaterial({
        map: this.glowSpriteTex,
        color: '#fef08a',
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      48
    );
    this.thermalSpiralInst.frustumCulled = false;
    this.thermalSpiralInst.count = 0;
    this.scene.add(this.thermalSpiralInst);
    this._fovSwellDeg = 0;
    this._glidePitchSmooth = 0;
    this._whiteCol = new THREE.Color('#ffffff');
    this._mistCol = new THREE.Color('#e0f7ff');

    // Pre-allocate `instanceColor` & slot 0 upfront on all colored InstancedMeshes to prevent mid-flight D3D11 stalls!
    this._dummy.position.set(0, 0, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(1);
    this._dummy.updateMatrix();
    for (const im of [this.thermalSpiralInst, this.dewInst, this.ringInst, this.partInst]) {
      if (!im) continue;
      im.setMatrixAt(0, this._dummy.matrix);
      im.setColorAt(0, this._whiteCol);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this.windStreakInst.setMatrixAt(0, this._dummy.matrix);
    this.windStreakInst.instanceMatrix.needsUpdate = true;

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
    if (opts?.envMap && this.scene.environment !== opts.envMap) {
      this.scene.environment = opts.envMap;
      this.scene.environmentIntensity = 0.90;
    }

    const rawKey = String(opts?.biomeKey || opts?.biome || stage.themeKey || stage.theme?.key || 'canyon_river').toLowerCase();
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
    this.hemiLight.color.set(pal.hemiSky);
    this.hemiLight.groundColor.set(pal.hemiGnd);
    this.cliffMat.color.set(pal.cliff);
    this.seaStackMat.color.set(pal.cliff);

    const scroll = Number(stage.scroll) || time * 110;
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const targetFovSwell = clamp(Number(stage.fovKick) || 0, 0, 1) * 7.5;
    this._fovSwellDeg += (targetFovSwell - this._fovSwellDeg) * (1 - Math.exp(-6.5 * dt));
    this._updateGlideCamMetrics(this._fovSwellDeg);

    // Aspect-cover studio-painted coastal arch & rainbow waterfall panorama
    const bgDist = this._glideCamZ + 56;
    const bgH = 2 * Math.tan((this._glideFov * 0.5) * DEG) * bgDist * 1.08;
    const bgW = bgH * aspect * 1.08;
    this.skyBackdrop.scale.set(bgW, bgH, 1);
    this.skyBackdrop.position.set(0, 0, -56);
    if (this.skyBgWebp) {
      const imgAspect = 1376 / 768;
      const quadAspect = bgW / Math.max(0.01, bgH);
      if (quadAspect < imgAspect) {
        const repX = clamp(quadAspect / imgAspect, 0.30, 1);
        const drift = (Math.sin(scroll * 0.00045) * 0.5 + 0.5) * (1 - repX);
        this.skyBgWebp.repeat.set(repX, 1);
        this.skyBgWebp.offset.set(drift, 0);
      } else {
        const repY = clamp(imgAspect / quadAspect, 0.48, 1);
        this.skyBgWebp.repeat.set(1, repY);
        this.skyBgWebp.offset.set(0, (1 - repY) * 0.5);
      }
    }

    this.cascadeTex.offset.set(0, -(time * 1.28) % 1);
    this.updraftTex.offset.set(0, -(time * 0.92) % 1);

    // Update GPU GLSL Fresnel Specular Ocean Shader uniforms (0 CPU vertex loops!)
    const ou = this.waterMat.uniforms;
    ou.uTime.value = time;
    ou.uScroll.value = scroll;
    ou.uDeepColor.value.set(pal.waterDeep);
    ou.uShallowColor.value.set(pal.waterShallow);
    ou.uSkyColor.value.set(pal.waterSky);
    ou.uSunColor.value.set(pal.sun);
    ou.uFogColor.value.set(pal.fog);

    const seaY = stage.seaY ?? this.height * 0.89;
    const seaW = this._screenToWorld(this.width * 0.5, seaY, 0);
    const seaWorldY = seaW.y;
    this.waterMesh.position.y = seaWorldY - 0.18;
    this.horizonMistMesh.position.y = seaWorldY + 1.35;
    this.horizonMistMat.color.set(pal.fog);

    // Scroll Parallax 3 Distinct Sculpted Coastal Formations (Sea-Stacks, Sedona Mesas & Sandstone Aqueduct Sea-Arches)
    const dm = this._dummy;
    const baseScale = portrait ? 0.68 : 0.80;
    let foamIdx = 0;
    let mTree = 0;
    let mFalls = 0;

    // (a) Tall Jagged Coastal Sea-Stack Pillars (`mg_pbr_sedona_strata`, seated deeply into ocean!)
    for (let i = 0; i < NUM_SEA_STACKS; i++) {
      const z = -16.5 - (i % 2) * 8.5;
      const speed = 0.013 - (i % 2) * 0.0025;
      const px = ((((i * 23.4 + 6.0) - scroll * speed) % 116) + 116) % 116 - 58;
      const sc = baseScale * (0.86 + (i % 3) * 0.14);

      dm.position.set(px, seaWorldY - 2.35, z);
      dm.rotation.set(0, i * 1.15, 0);
      dm.scale.set(sc, sc * (0.94 + (i % 3) * 0.12), sc);
      dm.updateMatrix();
      this.seaStackInst.setMatrixAt(i, dm.matrix);

      // Feathered sunlit surf foam collar riding on top of the GLSL ocean waterline
      const wlY = seaWorldY + 0.16 + (z + 11.5) * -0.031;
      dm.position.set(px + 0.3 * sc, wlY, z);
      dm.rotation.set(0, time * 0.12 + i, 0);
      dm.scale.set(sc * 0.96, 1, sc * 0.96);
      dm.updateMatrix();
      this.mesaFoamInst.setMatrixAt(foamIdx++, dm.matrix);
    }

    // (b) Stepped Flat-Topped Sedona Mesa Crags + Waterfalls + Dark Pine Crowns (`mg_pbr_sedona_strata`)
    for (let i = 0; i < NUM_MESA_CRAGS; i++) {
      const z = -22.5 - (i % 2) * 6.5;
      const speed = 0.010 - (i % 2) * 0.0018;
      const px = ((((i * 24.8 + 14.5) - scroll * speed) % 122) + 122) % 122 - 61;
      const sc = baseScale * (0.92 + (i % 3) * 0.15);
      const sy = sc * (0.90 + (i % 3) * 0.12);

      dm.position.set(px, seaWorldY - 2.45, z);
      dm.rotation.set(0, i * 0.85, 0);
      dm.scale.set(sc, sy, sc);
      dm.updateMatrix();
      this.mesaCragInst.setMatrixAt(i, dm.matrix);

      const wlY = seaWorldY + 0.18 + (z + 11.5) * -0.031;
      dm.position.set(px, wlY, z);
      dm.rotation.set(0, -time * 0.08 + i, 0);
      dm.scale.set(sc * 1.18, 1, sc * 1.18);
      dm.updateMatrix();
      this.mesaFoamInst.setMatrixAt(foamIdx++, dm.matrix);

      // Dark Redwood Pine Bough Crown atop flat mesa plateau
      const topY = seaWorldY - 2.45 + 7.95 * sy;
      for (const [ox, oz, ts] of [
        [-1.65, 0.25, 0.92],
        [0.15, -0.35, 1.08],
        [1.75, 0.30, 0.86],
      ]) {
        dm.position.set(px + ox * sc, topY, z + oz * sc);
        dm.rotation.set(0, ox + i, 0);
        dm.scale.setScalar(sc * ts);
        dm.updateMatrix();
        this.mesaTreeInst.setMatrixAt(mTree++, dm.matrix);
      }

      // Cascading feathered waterfall plunging down sunlit mesa face
      dm.position.set(px + 0.35 * sc, seaWorldY - 1.15 + 3.4 * sy, z + 2.75 * sc);
      dm.rotation.set(0, 0, 0);
      dm.scale.set(sc, sy, 1);
      dm.updateMatrix();
      this.mesaFallsInst.setMatrixAt(mFalls++, dm.matrix);
    }

    // (c) Weathered Sandstone Aqueduct Sea-Arch / Stone Ruin Spans (`arch_canyon_sandstone` + `arch_antique_bronze`)
    for (let i = 0; i < NUM_SEA_ARCHES; i++) {
      const isNear = i % 2 === 0;
      const z = isNear ? -10.8 : -19.2;
      const speed = isNear ? 0.0175 : 0.012;
      const px = ((((i * 31.0 + 22.0) - scroll * speed) % 124) + 124) % 124 - 62;
      const sc = baseScale * (isNear ? 0.88 : 1.06);

      dm.position.set(px, seaWorldY - 2.45, z);
      dm.rotation.set(0, isNear ? 0.14 : -0.18, 0);
      dm.scale.setScalar(sc);
      dm.updateMatrix();
      this.seaArchStoneInst.setMatrixAt(i, dm.matrix);
      this.seaArchBronzeInst.setMatrixAt(i, dm.matrix);

      const wlY = seaWorldY + 0.15 + (z + 11.5) * -0.031;
      for (const sx of [-1, 1]) {
        dm.position.set(px + sx * 3.1 * sc, wlY, z);
        dm.rotation.set(0, time * 0.1 + i * sx, 0);
        dm.scale.set(sc * 0.72, 1, sc * 0.72);
        dm.updateMatrix();
        this.mesaFoamInst.setMatrixAt(foamIdx++, dm.matrix);
      }
    }

    this.seaStackInst.count = NUM_SEA_STACKS;
    this.mesaCragInst.count = NUM_MESA_CRAGS;
    this.seaArchStoneInst.count = NUM_SEA_ARCHES;
    this.seaArchBronzeInst.count = NUM_SEA_ARCHES;
    this.mesaFoamInst.count = foamIdx;
    this.mesaTreeInst.count = mTree;
    this.mesaFallsInst.count = mFalls;
    this.seaStackInst.instanceMatrix.needsUpdate = true;
    this.mesaCragInst.instanceMatrix.needsUpdate = true;
    this.seaArchStoneInst.instanceMatrix.needsUpdate = true;
    this.seaArchBronzeInst.instanceMatrix.needsUpdate = true;
    this.mesaFoamInst.instanceMatrix.needsUpdate = true;
    this.mesaTreeInst.instanceMatrix.needsUpdate = true;
    this.mesaFallsInst.instanceMatrix.needsUpdate = true;

    for (let r = 0; r < MAX_RAINBOWS; r++) {
      const rm = this.rainbows[r];
      const rx = (((r * 24 - scroll * 0.0115) % 96) + 96) % 96 - 48;
      rm.position.set(rx, seaWorldY + 2.75, -15.5);
    }

    // Summit Departure Spire (STRICTLY hidden during flight: visible ONLY when phase === 'intro')
    if (stage.phase === 'intro' && stage.summit && stage.summit.x > -140) {
      const swp = this._screenToWorld(stage.summit.x, stage.summit.y, -2.4);
      this.summitGroup.visible = true;
      this.summitGroup.position.set(swp.x, swp.y, -2.4);
    } else {
      this.summitGroup.visible = false;
    }

    if (stage.tower?.active && (stage.tower.depth || 0) > 0.08) {
      const depthZ = lerp(-48, -2.5, stage.tower.depth || 0);
      const twp = this._screenToWorld(stage.tower.x, seaY, depthZ);
      this.destTowerGroup.visible = true;
      this.destTowerGroup.position.set(twp.x, seaWorldY, depthZ);
    } else {
      this.destTowerGroup.visible = false;
    }

    // Update Gateway Frill-Glider Hero — 100% Portrait (412x915) & Desktop (1920x1080) Aspect-Safe!
    const gl = stage.glider || { x: this.width * (portrait ? 0.36 : 0.28), y: this.height * 0.46, vx: 0, vy: 0 };
    const hwp = this._screenToWorld(gl.x, gl.y, 0.3);
    const safeHalfW = hwp.halfW * (portrait ? 0.52 : 0.72);
    const safeHalfH = hwp.halfH * (portrait ? 0.48 : 0.62);
    const heroX = clamp(hwp.x, -safeHalfW, safeHalfW);
    const heroY = clamp(hwp.y, -safeHalfH, safeHalfH);
    this.hero.group.scale.setScalar(portrait ? 0.90 : 1.04);

    // Nose Gateway/glider down/up directly by aerodynamic `gl.pitch` (+ = nose-down in screen Y-down; Three.js +Z = nose-up)
    const rawPitch =
      gl.pitch != null
        ? -clamp(gl.pitch, -0.62, 0.62) + (gl.flare || 0) * 0.24
        : clamp(Math.atan2(-(gl.vy || 0), 240), -0.62, 0.55) + (gl.flare || 0) * 0.32;
    this._glidePitchSmooth += (rawPitch - this._glidePitchSmooth) * (1 - Math.exp(-12 * dt));
    const buffetRoll = (gl.buffet || 0) * Math.sin(time * 20.0) * 0.10;
    const roll = clamp(-(gl.vy || 0) * 0.0014, -0.34, 0.34) + buffetRoll + (gl.spin || 0);
    this.hero.group.position.set(heroX, heroY, 0.3);
    this.hero.group.rotation.set(roll, 0, this._glidePitchSmooth);
    this.hero.update(dt, time, gl);

    // Aerodynamic Wind-Streamline Streaks (length & opacity scale smoothly with airspeed & dive rush!)
    const airspeed = clamp(gl.airspeed ?? gl.speed ?? 1, 0.7, 1.75);
    const diveRush = clamp((airspeed - 0.92) / 0.72 + (gl.dive || 0) * 0.55, 0, 1.25);
    this.windStreakMat.opacity = clamp(0.10 + diveRush * 0.34, 0.08, 0.48);
    let wsCnt = 0;
    const wsActive = Math.min(36, Math.round(14 + diveRush * 20));
    const wsSpeed = 4.2 + airspeed * 6.4;
    for (let i = 0; i < wsActive; i++) {
      const spanW = hwp.halfW * 2.4;
      const wx = hwp.halfW * 1.2 - (((time * wsSpeed * (0.82 + (i % 4) * 0.14) + i * 2.13) % spanW) + spanW) % spanW;
      const wy = (((i * 1.73) % 2) - 1) * hwp.halfH * 0.84;
      const wz = -0.2 - (i % 4) * 0.45;
      const lenScale = (0.62 + diveRush * 1.15) * (0.8 + (i % 3) * 0.18);
      dm.position.set(wx, wy, wz);
      dm.rotation.set(0, 0, this._glidePitchSmooth * 0.25);
      dm.scale.set(lenScale, 0.75 + diveRush * 0.35, 1);
      dm.updateMatrix();
      this.windStreakInst.setMatrixAt(wsCnt++, dm.matrix);
    }
    this.windStreakInst.count = wsCnt;
    if (wsCnt > 0) this.windStreakInst.instanceMatrix.needsUpdate = true;

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

    // Drifting Volumetric 3D Cumulus Cloud Banks across 3 Parallax Sky Layers!
    if (this.ambientCloudInst) {
      this.ambientCloudMat.emissive.set(pal.skyHor);
      for (let i = 0; i < 16; i++) {
        const layer = i % 3;
        const cz = layer === 0 ? -8.5 : layer === 1 ? -16.5 : -26.5;
        const spd = layer === 0 ? 0.022 : layer === 1 ? 0.014 : 0.009;
        const span = layer === 0 ? 74 : layer === 1 ? 96 : 122;
        const cx = ((((i * 15.7 + 7.2) - scroll * spd) % span) + span) % span - span * 0.5;
        const cy = (layer === 0 ? 2.4 : layer === 1 ? 3.8 : 5.4) + Math.sin(i * 2.1 + time * 0.25) * 0.85;
        const sc = (layer === 0 ? 1.15 : layer === 1 ? 1.65 : 2.35) * (0.85 + (i % 4) * 0.14);
        dm.position.set(cx, cy, cz);
        dm.rotation.set(0, (i % 2 === 0 ? 0.12 : -0.14), 0);
        dm.scale.set(sc * 1.32, sc * 0.86, sc);
        dm.updateMatrix();
        this.ambientCloudInst.setMatrixAt(i, dm.matrix);
      }
      this.ambientCloudInst.count = 16;
      this.ambientCloudInst.instanceMatrix.needsUpdate = true;
    }

    // Track directional hero shadow frustum tightly around Gateway
    if (this.sunLight.castShadow) {
      this.sunLight.position.set(heroX + 10, heroY + 18, 14);
      this.sunLight.target.position.set(heroX, heroY - 1, 0);
      this.sunLight.target.updateMatrixWorld();
    }

    // Swirling Golden Thermal Updraft Columns + Twin-Helix 3D Updraft Ribbons + Rising Sparkle Trails!
    const thermals = stage.thermals || [];
    let tsCnt = 0;
    for (let i = 0; i < MAX_THERMALS; i++) {
      const tm = this.thermalMeshes[i];
      if (i >= thermals.length) {
        tm.visible = false;
        continue;
      }
      const th = thermals[i];
      const wp = this._screenToWorld(th.x, this.height * 0.55, -0.5);
      const colRad = Math.max(0.55, this._pxScale(th.w || 48, -0.5) * 0.56);
      const fade = th.fade ?? 1;
      tm.visible = true;
      tm.position.set(wp.x, wp.y, -0.5);
      tm.scale.set(Math.max(0.62, this._pxScale(th.w || 48, -0.5) * 0.92), 1, 1);
      if (tm.userData?.sheetMat) {
        tm.userData.sheetMat.color.set(pal.thermal);
        tm.userData.sheetMat.opacity = 0.54 * fade;
      }
      if (tm.userData?.helix) {
        tm.userData.helix.rotation.y = time * 3.8 + i * 1.4;
        tm.userData.helixMat.color.set(pal.thermal);
        tm.userData.helixMat.opacity = (0.68 + Math.sin(time * 5.2 + i) * 0.14) * fade;
      }

      // 6 rising swirling golden sparkle bands per active thermal column
      for (let k = 0; k < 6 && tsCnt < 48; k++) {
        const u = (time * 0.65 + k / 6 + i * 0.19) % 1;
        const ang = u * TAU * 2.4 + time * 3.4 + k;
        const sx = wp.x + Math.cos(ang) * colRad * (0.75 + u * 0.35);
        const sy = seaWorldY + 0.35 + u * 8.6;
        const sz = -0.30 + Math.sin(ang) * 0.48;
        const sfade = Math.sin(u * Math.PI) * fade;
        dm.position.set(sx, sy, sz);
        dm.rotation.set(0, 0, Math.cos(ang) * 0.35 + 0.18);
        dm.scale.set((0.95 + u * 0.72) * sfade, (0.85 + sfade * 0.52) * sfade, 1);
        dm.updateMatrix();
        this._col.set(pal.thermal).lerp(this._whiteCol, 0.45);
        this.thermalSpiralInst.setColorAt(tsCnt, this._col);
        this.thermalSpiralInst.setMatrixAt(tsCnt++, dm.matrix);
      }
    }
    const stageSpirals = stage.thermalSpirals || [];
    for (let i = 0; i < stageSpirals.length && tsCnt < 48; i++) {
      const sp = stageSpirals[i];
      const u = 1 - clamp((sp.life || 0) / Math.max(0.01, sp.maxLife || 1.85), 0, 1);
      const rad = this._pxScale(sp.w || 48, -0.3) * 0.42;
      const wp = this._screenToWorld(sp.x, sp.y, -0.3);
      const ang = sp.phase || time * 4.5 + i;
      const fade = Math.sin(u * Math.PI);
      dm.position.set(wp.x + Math.cos(ang) * rad, wp.y, -0.25 + Math.sin(ang) * 0.35);
      dm.rotation.set(0, 0, Math.cos(ang) * 0.32);
      dm.scale.set((0.75 + u * 0.6) * fade, (0.7 + fade * 0.4) * fade, 1);
      dm.updateMatrix();
      this._col.set(pal.thermal).lerp(this._mistCol, 0.5);
      this.thermalSpiralInst.setColorAt(tsCnt, this._col);
      this.thermalSpiralInst.setMatrixAt(tsCnt++, dm.matrix);
    }
    this.thermalSpiralInst.count = tsCnt;
    if (tsCnt > 0) {
      this.thermalSpiralInst.instanceMatrix.needsUpdate = true;
      if (this.thermalSpiralInst.instanceColor) this.thermalSpiralInst.instanceColor.needsUpdate = true;
    }

    // Water-Dew Streams, Kites & Golden Harmonic Seeds (`stage.lanterns`)
    const lanterns = stage.lanterns || [];
    let dCnt = 0;
    const dewColors = ['#5efce8', '#fde047', '#7dd3fc', '#f9a8d4'];
    for (let i = 0; i < lanterns.length && dCnt < MAX_DEW; i++) {
      const l = lanterns[i];
      const wp = this._screenToWorld(l.x, l.y, 0.15);
      const sc = l.type === 'gold' ? 1.15 : l.type === 'kite' ? 1.08 : 0.86;
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

    // Volumetric 3D Storm Thunderhead Clouds (`body.visible = true`!) + Telegraph Charge Core + Forked Lightning!
    const clouds = stage.clouds || [];
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const slot = this.cloudSlots[i];
      if (i >= clouds.length) {
        slot.visible = false;
        continue;
      }
      const c = clouds[i];
      const isCharge = c.state === 'charge';
      const isStrike = c.state === 'strike';
      const wp = this._screenToWorld(c.x, c.y, -0.2);
      const radScale = clamp(this._pxScale(c.rx || 58, -0.2) * 0.86, 0.72, 1.45);
      slot.visible = true;
      slot.position.set(wp.x, wp.y, -0.2);
      slot.scale.setScalar(radScale);
      if (slot.userData.body) {
        slot.userData.body.visible = true;
        slot.userData.body.scale.set(1.0 + (isCharge ? Math.sin(time * 24) * 0.05 : 0), 1.0, 1.0);
        if (slot.userData.bodyMat) {
          slot.userData.bodyMat.emissive.set(isStrike ? '#fbbf24' : isCharge ? '#92400e' : '#1e1b4b');
          slot.userData.bodyMat.emissiveIntensity = isStrike ? 0.95 : isCharge ? 0.55 + Math.sin(time * 22) * 0.25 : 0.32;
        }
      }
      if (slot.userData.chargeCore) {
        slot.userData.chargeCore.visible = isCharge || isStrike;
        slot.userData.chargeMat.opacity = isStrike ? 0.92 : isCharge ? 0.45 + Math.sin(time * 26) * 0.35 : 0;
        slot.userData.chargeCore.scale.setScalar(isStrike ? 1.55 : 0.9 + Math.sin(time * 20) * 0.25);
      }
      if (slot.userData.bolt) {
        slot.userData.bolt.visible = isStrike;
        if (isStrike) {
          const strikeOffX = this._pxScale(c.strikeX || 0, -0.2) / Math.max(0.2, radScale);
          slot.userData.bolt.position.x = strikeOffX;
          slot.userData.bolt.rotation.y = (time * 32 + i) % TAU;
        }
      }
    }

    // Graceful Distant High-Altitude Coastal Seabirds (sleek 0.38x distant silhouettes, ZERO blocky foreground gulls!)
    const gulls = stage.gulls || [];
    let bCnt = 0;
    for (let i = 0; i < gulls.length && bCnt < MAX_BIRDS; i++) {
      const b = gulls[i];
      const wp = this._screenToWorld(b.x, b.y, -3.2);
      dm.position.set(wp.x, wp.y + 1.35, -3.2);
      dm.rotation.set(Math.sin(b.phase || time * 7) * 0.38, 0.15, 0);
      dm.scale.setScalar(0.38);
      dm.updateMatrix();
      this.birdInst.setMatrixAt(bCnt++, dm.matrix);
    }
    this.birdInst.count = bCnt;
    if (bCnt > 0) this.birdInst.instanceMatrix.needsUpdate = true;

    // Rings & Soft Radial-Alpha Glowing Spray/Mist Sprites (ZERO hard hexagons!)
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
      const age = (time * 2.2 + i * 0.13) % 1;
      const spreadY = Math.sin(time * 6.5 + i * 1.4) * (0.12 + age * 0.34);
      dm.position.set(heroX - 0.68 - age * 3.8, heroY + spreadY, 0.35);
      dm.rotation.set(0, 0, time * 0.8 + i);
      dm.scale.setScalar(Math.sin(age * Math.PI) * (0.55 + age * 0.65));
      dm.updateMatrix();
      this._col.set(i % 3 === 0 ? '#fde68a' : i % 2 === 0 ? '#7df9ff' : '#d6fbff');
      this.partInst.setColorAt(ptCnt, this._col);
      this.partInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    for (let i = 0; i < extParts.length && ptCnt < MAX_PARTICLES; i++) {
      const p = extParts[i];
      if (p.x == null || p.y == null) continue;
      const wp = this._screenToWorld(p.x, p.y, 0.35);
      const lifeRatio = clamp(p.life / Math.max(0.01, p.maxLife || 1), 0, 1);
      dm.position.set(wp.x, wp.y, 0.35);
      dm.rotation.set(0, 0, i * 0.9);
      dm.scale.setScalar(0.55 + lifeRatio * 0.75);
      dm.updateMatrix();
      this._col.set(p.color || '#e8fcff');
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
    this.camera.position.set(sx, sy, this._glideCamZ);
    this.camera.lookAt(sx, sy, 0);

    // Route cleanly through main GameRenderer's CinematicPostFX when provided, with ACES standalone fallback!
    const postfx = opts?.postfx;
    if (postfx && postfx.enabled && !postfx._disposed && typeof postfx.render === 'function') {
      this.postfxActive = true;
      postfx.render(this.scene, this.camera, {
        biome: bKey,
        exposure: 1.07,
        bloomThreshold: 0.80,
        bloomStrength: 0.34,
        bloomRadius: 0.42,
      });
    } else {
      this.postfxActive = false;
      const prevTone = this.webgl.toneMapping;
      const prevExp = this.webgl.toneMappingExposure;
      try {
        this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
        this.webgl.toneMappingExposure = 1.07;
        this.webgl.setRenderTarget(null);
        this.webgl.render(this.scene, this.camera);
      } finally {
        this.webgl.toneMapping = prevTone;
        this.webgl.toneMappingExposure = prevExp;
      }
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.hero?.dispose();
    this._ownEnvRt?.dispose();
    this.skyTex?.dispose();
    this.mesaTex?.dispose();
    this.cascadeTex?.dispose();
    this.glowSpriteTex?.dispose();
    this.shoreFoamTex?.dispose();
    this.rainbowArcTex?.dispose();
    this.horizonMistTex?.dispose();
    this.updraftTex?.dispose();
    for (const p of this.popupPool) {
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
  }
}

export { GlideRenderer as FrillGlideRenderer };
export default GlideRenderer;
