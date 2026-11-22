// TOWERING WATERS: GATEWAY'S DESCENT — SKY CANYON FRILL-GLIDE 3D RENDERER (`src/glideRenderer.js`)
//
// Blender-First Stylized Aerial Sky-Canyon Engine (`assets/models/env_sky_canyon.glb`):
//   - ZERO flat 2D backdrop posters (`mg_bg_frill_glide.webp` deleted!), ZERO stretched
//     ConeGeometry rock spikes, ZERO flat pancake sphere clouds, ZERO cardboard pine cutouts!
//   - Real sculpted Blender 5.3 sky-canyon kit:
//       * `SeaStack_Mesa_A` (terraced Sedona sandstone sea-stack mesa w/ rounded Pixar 3D trees)
//       * `SeaStack_Spire_B` (sculpted coastal twin-pillar sea-window sandstone arch-stack)
//       * `Viaduct_SkyBridge` (ruined 3-arch stone Pelagian viaduct sky-bridge w/ antique bronze)
//       * `Cumulus_Cloud_A` & `Cumulus_Cloud_B` (voxel-remeshed asymmetrical wind-swept cumulus banks
//         shaded with warm golden-cream sunlit tops & luminous sky-periwinkle undersides!)
//       * `ThermalRing_Bronze` (chunky 3D antique-bronze & golden-aqua crystal thermal updraft rings)
//       * `StormCloud_Sculpted` (sculpted wind-swept anvil thunderhead w/ amber charge & lightning)
//       * `LaunchSanctuary_Deck` & `ArrivalSpire_Distant`
//   - Smooth reflective turquoise GLSL sunlit ocean below + seamless 3D golden-hour sky-dome
//     (`biome_skybox_*.webp`) blending cleanly into aerial-perspective horizon fog!
//   - Gateway 2.0 in a sleek horizontal aerodynamic frill-spread soaring pose (head forward,
//     flared coral frills, streaming coral scarf, tail trailing horizontally behind!).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 46;
const CAM_Z = 10.6;

const MAX_DEW = 80;
const MAX_GATES = 10;
const MAX_THERMALS = 8;
const MAX_CLOUDS = 10;
const MAX_BIRDS = 64;
const MAX_RAINBOWS = 3;
const MAX_RINGS = 24;
const MAX_PARTICLES = 240;
const MAX_POPUPS = 16;

const NUM_MESAS = 4;
const NUM_SPIRES = 4;
const NUM_VIADUCTS = 4;
const NUM_CUMULUS_A = 8;
const NUM_CUMULUS_B = 8;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const GLIDE_BIOME_PALETTES = {
  canyon_river: {
    skybox: 'assets/textures/biome_skybox_canyon_river.webp',
    skyTop: '#1c6ab8',
    skyHor: '#fae0a8',
    fog: '#d8e9f2',
    sun: '#fff2d1',
    hemiSky: '#8cd4f8',
    hemiGnd: '#2e5266',
    waterDeep: '#085680',
    waterShallow: '#14b4c4',
    waterSky: '#cdebfb',
    thermal: '#fde047',
    cloudWarm: '#fff7e6',
    cloudUnder: '#9ec2ea',
  },
  alpine_lake: {
    skybox: 'assets/textures/biome_skybox_alpine_lake.webp',
    skyTop: '#1a5eb2',
    skyHor: '#e8f4fe',
    fog: '#cee7fa',
    sun: '#fff6ee',
    hemiSky: '#98d8fb',
    hemiGnd: '#2c4c66',
    waterDeep: '#07457a',
    waterShallow: '#169cd0',
    waterSky: '#daf0ff',
    thermal: '#7dd3fc',
    cloudWarm: '#fffaf4',
    cloudUnder: '#a4c8f0',
  },
  mist_bayou: {
    skybox: 'assets/textures/biome_skybox_mist_bayou.webp',
    skyTop: '#442b8e',
    skyHor: '#f8bd86',
    fog: '#e4cbb2',
    sun: '#ffebd0',
    hemiSky: '#94c6de',
    hemiGnd: '#26483e',
    waterDeep: '#0a484c',
    waterShallow: '#16928c',
    waterSky: '#f4d2b2',
    thermal: '#34d399',
    cloudWarm: '#ffebd6',
    cloudUnder: '#989ec8',
  },
  coral_sea: {
    skybox: 'assets/textures/biome_skybox_coral_sea.webp',
    skyTop: '#0684c8',
    skyHor: '#d2f8fc',
    fog: '#b2ebf7',
    sun: '#fff6de',
    hemiSky: '#8ce0fa',
    hemiGnd: '#1e586e',
    waterDeep: '#075c88',
    waterShallow: '#16c8d8',
    waterSky: '#d4f6ff',
    thermal: '#fde047',
    cloudWarm: '#fffcf2',
    cloudUnder: '#9ed2f2',
  },
  storm_ocean: {
    skybox: 'assets/textures/biome_skybox_storm_ocean.webp',
    skyTop: '#102e4c',
    skyHor: '#3ba2c8',
    fog: '#32647e',
    sun: '#daf0ff',
    hemiSky: '#68aed6',
    hemiGnd: '#1a364c',
    waterDeep: '#062c4c',
    waterShallow: '#127ba4',
    waterSky: '#6cb4d4',
    thermal: '#5efce8',
    cloudWarm: '#d8e8f8',
    cloudUnder: '#4c6d92',
  },
};

// --- SEAMLESS 3D GOLDEN-HOUR SKY-DOME SHADER (ZERO FLAT 2D POSTER!) ---
const GLIDE_SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLIDE_SKY_FRAG = /* glsl */ `
  uniform sampler2D uSkyTex;
  uniform float uHasTex;
  uniform float uScroll;
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uFogColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;

  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float elev = clamp(dir.y, -1.0, 1.0);

    vec3 grad = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.56, max(0.0, elev)));
    vec3 col = grad;
    if (uHasTex > 0.5) {
      float u = fract(atan(dir.x, -dir.z) / 6.2831853 + 0.5 + uScroll * 0.00008);
      float v = clamp(0.48 + elev * 0.64, 0.06, 0.98);
      vec3 texCol = texture2D(uSkyTex, vec2(u, v)).rgb;
      // Keep the painted sky soft and aerial-perspective washed so real 3D sea-stacks & clouds pop!
      float skyMask = smoothstep(-0.04, 0.14, elev);
      col = mix(grad, mix(texCol, grad, 0.35), skyMask * 0.72);
    }

    // Golden-hour sun disc & soft warm atmospheric bloom
    float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sunCos, 90.0) * 0.90 + pow(sunCos, 8.0) * 0.26);

    // Seamless blend into aerial-perspective horizon fog where sea meets sky
    float horBand = 1.0 - smoothstep(-0.04, 0.16, elev);
    col = mix(col, uFogColor, horBand);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- SMOOTH REFLECTIVE TURQUOISE GLSL SUNLIT OCEAN SHADER ---
const GLIDE_OCEAN_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying vec3 vWorldPos;
  varying float vWaveH;
  varying float vFarT;
  varying float vCamDist;

  void main() {
    vec3 pos = position;
    vFarT = clamp((position.y + 60.0) / 120.0, 0.0, 1.0);
    float sx = position.x + uScroll * 0.022;
    float sy = position.y;
    float h =
      sin(sx * 0.22 + sy * 0.18 + uTime * 1.35) * 0.12 +
      cos(sx * 0.38 - sy * 0.34 + uTime * 1.08) * 0.08 +
      sin(sx * 0.64 + sy * 0.58 - uTime * 1.75) * 0.04;
    pos.z += h * (1.0 - vFarT * 0.65);
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    vWaveH = h;
    vec4 mv = viewMatrix * wp;
    vCamDist = -mv.z;
    gl_Position = projectionMatrix * mv;
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
    for (int i = 0; i < 3; i++) {
      s += a * vnoise(p);
      p = m * p * 2.04;
      a *= 0.5;
    }
    return s;
  }

  float oceanHeight(vec2 p, float t) {
    float w1 = fbm(p * vec2(0.22, 0.30) + vec2(t * 0.16, -t * 0.10));
    float w2 = fbm(p * vec2(0.52, 0.68) + vec2(-t * 0.22, t * 0.18) + vec2(w1 * 1.35));
    float rip = sin(p.x * 0.58 + p.y * 0.44 + t * 1.5 + w1 * 3.2) * 0.12;
    return w1 * 0.54 + w2 * 0.36 + rip;
  }

  void main() {
    vec2 op = vec2(vWorldPos.x + uScroll * 0.022, vWorldPos.z);
    float eps = 0.22;
    float hc = oceanHeight(op, uTime);
    float hx = oceanHeight(op + vec2(eps, 0.0), uTime);
    float hz = oceanHeight(op + vec2(0.0, eps), uTime);
    vec3 N = normalize(vec3((hc - hx) * 1.15, 1.0, (hc - hz) * 1.15));

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    float dapple = fbm(op * vec2(0.14, 0.20) + vec2(uTime * 0.06, 0.0));
    vec3 baseCol = mix(uShallowColor, uDeepColor, clamp(0.24 + vFarT * 0.58 + (0.52 - dapple) * 0.42, 0.0, 1.0));

    // Subsurface turquoise sunlight glow through rolling swells
    float sss = pow(clamp(dot(V, normalize(-L + N * 0.48)), 0.0, 1.0), 2.8) * (0.48 + max(0.0, vWaveH) * 2.8);
    baseCol += vec3(0.08, 0.48, 0.50) * sss * (1.0 - vFarT * 0.45);

    // Schlick Fresnel golden sky reflection
    float ndotv = max(dot(N, V), 0.0);
    float fresnel = 0.05 + 0.95 * pow(1.0 - ndotv, 4.0);
    vec3 reflSky = mix(uSkyColor, uSunColor, 0.30 + 0.26 * vFarT);
    vec3 col = mix(baseCol, reflSky, fresnel * 0.68);

    // Sparkling sunlit ocean path
    vec3 H = normalize(L + V);
    float sparkle = pow(max(dot(N, H), 0.0), 135.0);
    float sheen = pow(max(dot(N, H), 0.0), 22.0);
    col += uSunColor * (sparkle * 1.55 + sheen * 0.22);

    // Seamless aerial-perspective horizon fog blend matching sky-dome!
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
    col = mix(col, uFogColor, clamp(fogFactor * 0.95 + smoothstep(0.58, 0.98, vFarT) * 0.62, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- SHARED GLB & TEXTURE LOADERS ---
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
        (gltf) => resolve(gltf?.scene || null),
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

const _texCache = new Map();
function loadCachedTex(url, isSrgb = true, onReady = null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const cached = _texCache.get(url);
  if (cached) {
    if (cached.image) onReady?.(cached);
    return cached;
  }
  try {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(
      url,
      (t) => {
        t.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.needsUpdate = true;
        onReady?.(t);
      },
      undefined,
      () => {}
    );
    _texCache.set(url, tex);
    return tex;
  } catch {
    return null;
  }
}

function normalizeGlbMaterial(mat, opts = {}) {
  if (!mat) return mat;
  let out = mat;
  if (mat.isMeshPhysicalMaterial) {
    out = new THREE.MeshStandardMaterial({
      name: mat.name || '',
      color: mat.color ? mat.color.clone() : new THREE.Color('#ffffff'),
      map: mat.map || null,
      normalMap: mat.normalMap || null,
      normalScale: mat.normalScale ? mat.normalScale.clone() : new THREE.Vector2(1, 1),
      roughnessMap: mat.roughnessMap || null,
      metalnessMap: mat.metalnessMap || null,
      aoMap: mat.aoMap || mat.roughnessMap || null,
      aoMapIntensity: 0.72,
      emissive: mat.emissive ? mat.emissive.clone() : new THREE.Color('#000000'),
      emissiveMap: mat.emissiveMap || null,
      emissiveIntensity: Math.min(1.55, mat.emissiveIntensity ?? 1.0),
      roughness: typeof mat.roughness === 'number' ? mat.roughness : 0.62,
      metalness: typeof mat.metalness === 'number' ? mat.metalness : 0.04,
      vertexColors: Boolean(mat.vertexColors),
      side: mat.side,
    });
  } else {
    out = mat.clone();
    if (!out.aoMap && out.roughnessMap) {
      out.aoMap = out.roughnessMap;
      out.aoMapIntensity = 0.72;
    }
    if (typeof out.emissiveIntensity === 'number' && out.emissiveIntensity > 1.55) {
      out.emissiveIntensity = 1.55;
    }
  }
  if (opts.cloudSoft) {
    // Soft luminous Ghibli/Pixar cloud shading: warm ambient sky bounce eliminates dark matte clay shadows!
    out.roughness = 0.94;
    out.metalness = 0.0;
    out.emissive = new THREE.Color('#b8cef0');
    out.emissiveIntensity = 0.32;
    out.transparent = true;
    out.opacity = 0.94;
  }
  return out;
}

class GlbInstancedAsset {
  constructor(scene, nodeObj, maxCount, matOpts = {}) {
    this.meshes = [];
    this.maxCount = maxCount;
    this._localMats = [];
    this._tmpMat = new THREE.Matrix4();
    if (!nodeObj) return;

    nodeObj.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(nodeObj.matrixWorld).invert();
    nodeObj.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const geo = child.geometry;
      const rawMat = Array.isArray(child.material) ? child.material[0] : child.material;
      const mat = normalizeGlbMaterial(rawMat, matOpts);
      if (geo.attributes.color) mat.vertexColors = true;
      const localM = new THREE.Matrix4().multiplyMatrices(invRoot, child.matrixWorld);
      const im = new THREE.InstancedMesh(geo, mat, maxCount);
      im.frustumCulled = false;
      im.count = 0;
      scene.add(im);
      this.meshes.push(im);
      this._localMats.push(localM);
    });
  }

  setMatrixAt(index, worldMatrix) {
    if (index < 0 || index >= this.maxCount) return;
    for (let i = 0; i < this.meshes.length; i++) {
      this._tmpMat.multiplyMatrices(worldMatrix, this._localMats[i]);
      this.meshes[i].setMatrixAt(index, this._tmpMat);
    }
  }

  commit(count) {
    const c = Math.min(this.maxCount, Math.max(0, count));
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].count = c;
      if (c > 0) this.meshes[i].instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const im of this.meshes) {
      im.parent?.remove(im);
      im.material?.dispose?.();
    }
    this.meshes.length = 0;
  }
}

// --- PROCEDURAL SOFT SPRITE & RIBBON TEXTURES ---
function createSoftGlowSpriteTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([235, 252, 255, 200]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size * 0.5, size * 0.5, 2, size * 0.5, size * 0.5, size * 0.48);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
  g.addColorStop(0.38, 'rgba(218, 250, 255, 0.58)');
  g.addColorStop(0.75, 'rgba(170, 240, 255, 0.14)');
  g.addColorStop(1.0, 'rgba(170, 240, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSlipstreamRibbonTex(w = 256, h = 64) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([190, 252, 255, 160]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = (y / (h - 1)) * 2 - 1;
    const edgeFade = Math.exp(-v * v * 4.8) * Math.max(0, 1 - v * v);
    const core = Math.exp(-v * v * 14.0);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const tailFade = Math.pow(u, 1.55);
      const tipSoft = Math.sin(Math.min(1, (1 - u) * 7.0) * Math.PI * 0.5);
      const a = clamp(tailFade * tipSoft * edgeFade, 0, 1);
      const p = (y * w + x) * 4;
      d[p] = Math.round(lerp(182, 255, core));
      d[p + 1] = Math.round(lerp(245, 255, core));
      d[p + 2] = 255;
      d[p + 3] = Math.round(a * 220);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createShoreFoamTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([232, 252, 255, 150]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    const dy = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1;
      const r = Math.hypot(dx, dy);
      const ring = Math.exp(-Math.pow((r - 0.64) / 0.22, 2.0)) * (r < 0.98 ? 1 : 0);
      const p = (y * size + x) * 4;
      d[p] = 236;
      d[p + 1] = 252;
      d[p + 2] = 255;
      d[p + 3] = Math.round(clamp(ring * 0.85, 0, 1) * 185);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createThermalUpdraftTex(w = 128, h = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([255, 236, 140, 140]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const vFade = Math.sin(v * Math.PI);
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const hFade = Math.exp(-u * u * 3.8);
      const streak = 0.55 + 0.45 * Math.sin(u * 10.0 + v * TAU * 3.0);
      const a = clamp(vFade * hFade * streak, 0, 1);
      const p = (y * w + x) * 4;
      d[p] = 255;
      d[p + 1] = 240;
      d[p + 2] = 156;
      d[p + 3] = Math.round(a * 170);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRainbowArcTex(w = 256, h = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([255, 240, 220, 60]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const stops = [
    [251, 113, 133], [253, 186, 116], [253, 224, 71],
    [74, 222, 128], [56, 189, 248], [192, 132, 252],
  ];
  for (let y = 0; y < h; y++) {
    const ny = 1 - y / (h - 1);
    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1)) * 2 - 1;
      const r = Math.hypot(nx, ny);
      const band = (r - 0.64) / 0.26;
      let a = 0, rr = 255, gg = 255, bb = 255;
      if (band > 0 && band < 1 && ny > 0.02) {
        a = Math.pow(Math.sin(band * Math.PI), 2) * Math.sin(Math.min(1, ny * 2.8) * Math.PI * 0.5) * 0.34;
        const pos = (1 - band) * (stops.length - 1);
        const idx = Math.min(stops.length - 2, Math.floor(pos));
        const f = pos - idx;
        rr = lerp(stops[idx][0], stops[idx + 1][0], f);
        gg = lerp(stops[idx][1], stops[idx + 1][1], f);
        bb = lerp(stops[idx][2], stops[idx + 1][2], f);
      }
      const p = (y * w + x) * 4;
      d[p] = Math.round(rr);
      d[p + 1] = Math.round(gg);
      d[p + 2] = Math.round(bb);
      d[p + 3] = Math.round(clamp(a, 0, 1) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
  ctx.strokeStyle = 'rgba(4, 24, 38, 0.92)';
  ctx.strokeText(text, 160, 32);
  ctx.fillStyle = color || '#fde047';
  ctx.fillText(text, 160, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildForkedLightningGeo() {
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.18, -1.2, 0.05),
    new THREE.Vector3(-0.22, -2.5, -0.04),
    new THREE.Vector3(0.24, -3.9, 0.06),
    new THREE.Vector3(-0.14, -5.4, 0),
    new THREE.Vector3(0.08, -7.2, 0),
  ];
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.075, 5, false);
}

function buildThermalHelixGeo() {
  const pts = [];
  for (let i = 0; i <= 42; i++) {
    const t = i / 42;
    const a = t * TAU * 2.5;
    const r = 0.58 + t * 0.36;
    pts.push(new THREE.Vector3(Math.cos(a) * r, (t - 0.5) * 12.5, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 44, 0.034, 6, false);
}

function buildCoastalGullGeo() {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    0.0, 0.0, 0.38,   -0.85, 0.22, -0.08,   0.0, 0.05, -0.30,
    0.0, 0.0, 0.38,    0.0, 0.05, -0.30,    0.85, 0.22, -0.08,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildProceduralEnvMap(webgl, topHex = '#2a85d4', horHex = '#fae0a8', gndHex = '#0c5a74') {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const s = new THREE.Scene();
    s.background = new THREE.Color(horHex);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: topHex, side: THREE.BackSide })
    );
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#fff8db' })
    );
    sun.position.set(10, 12, -10);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: gndHex, side: THREE.DoubleSide })
    );
    sea.rotation.x = -Math.PI * 0.5;
    sea.position.y = -6;
    s.add(dome, sun, sea);
    const rt = pmrem.fromScene(s, 0.04);
    dome.geometry.dispose();
    dome.material.dispose();
    sun.geometry.dispose();
    sun.material.dispose();
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
    this.envMap = opts.envMap || null;
    this._ownEnvRt = null;
    this._disposed = false;
    this.postfxActive = false;
    this._activeBiome = '';

    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._whiteCol = new THREE.Color('#ffffff');
    this._mistCol = new THREE.Color('#e0f7ff');
    this._wp = { x: 0, y: 0, halfW: 5, halfH: 4 };
    this._glideFov = FOV;
    this._glideCamZ = CAM_Z;
    this._fovSwellDeg = 0;
    this._glidePitchSmooth = 0;

    this.glowSpriteTex = createSoftGlowSpriteTex(128);
    this.slipstreamTex = createSlipstreamRibbonTex(256, 64);
    this.shoreFoamTex = createShoreFoamTex(128);
    this.updraftTex = createThermalUpdraftTex(128, 256);
    this.rainbowArcTex = createRainbowArcTex(256, 128);

    this._glbPools = {};
    this._stormCloudTemplate = null;
    this._initScene();
    this._readyPromise = this._loadGlbKit();
  }

  whenReady() {
    return this._readyPromise;
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.gatewayRig?.setSkin?.(skinId);
  }

  _updateGlideCamMetrics(fovSwellDeg = 0) {
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    this._glideFov = (portrait ? 52 : 46) + fovSwellDeg;
    this._glideCamZ = portrait ? 11.4 : 10.2;
    if (this.camera) {
      this.camera.aspect = aspect;
      this.camera.fov = this._glideFov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(width, height, dpr = this.dpr) {
    this.width = Math.max(1, width || 390);
    this.height = Math.max(1, height || 620);
    this.dpr = dpr;
    this._updateGlideCamMetrics(this._fovSwellDeg);
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
      // Ignore driver fallback
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

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1c6ab8');
    this.scene.fog = new THREE.FogExp2('#d8e9f2', 0.0068);

    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.90;
    } else {
      const env = buildProceduralEnvMap(this.webgl);
      if (env) {
        this._ownEnvRt = env.rt;
        this.envMap = env.texture;
        this.scene.environment = env.texture;
        this.scene.environmentIntensity = 0.90;
      }
    }

    this.camera = new THREE.PerspectiveCamera(FOV, this.width / Math.max(1, this.height), 0.2, 260);
    this._updateGlideCamMetrics(0);
    this.camera.position.set(0, 0, this._glideCamZ);

    // Golden-Hour Aerial Sunlit Lighting Rig (zero extra PointLight overhead for locked 60fps!)
    this.hemiLight = new THREE.HemisphereLight('#96dafc', '#365e74', 1.62);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff3d4', 2.55);
    this.sunLight.position.set(18, 26, 16);
    this.sunLight.castShadow = false;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight('#ffe4b8', 1.32);
    this.rimLight.position.set(-16, 14, 14);
    this.scene.add(this.rimLight);

    // Adaptive 60fps PostFX guard (matches `src/postfx.js` automatic bypass guarantee on iGPUs!)
    this._frameMsEma = 14.0;
    this._lastFrameTs = 0;
    this._bypassPostFx = false;

    // 1. Seamless 3D Golden-Hour Sky-Dome (ZERO flat 2D backdrop plane!)
    this.skyDomeMat = new THREE.ShaderMaterial({
      vertexShader: GLIDE_SKY_VERT,
      fragmentShader: GLIDE_SKY_FRAG,
      uniforms: {
        uSkyTex: { value: null },
        uHasTex: { value: 0.0 },
        uScroll: { value: 0.0 },
        uTopColor: { value: new THREE.Color('#1c6ab8') },
        uHorizonColor: { value: new THREE.Color('#fae0a8') },
        uFogColor: { value: new THREE.Color('#d8e9f2') },
        uSunColor: { value: new THREE.Color('#fff2d1') },
        uSunDir: { value: new THREE.Vector3(0.45, 0.36, -0.82).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(205, 28, 18), this.skyDomeMat);
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    // 2. Smooth Reflective Turquoise GLSL Sunlit Ocean Below
    const oceanGeo = new THREE.PlaneGeometry(240, 128, 28, 18);
    oceanGeo.rotateX(-Math.PI * 0.5);
    oceanGeo.translate(0, 0, -48);
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: GLIDE_OCEAN_VERT,
      fragmentShader: GLIDE_OCEAN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uDeepColor: { value: new THREE.Color('#085680') },
        uShallowColor: { value: new THREE.Color('#14b4c4') },
        uSkyColor: { value: new THREE.Color('#cdebfb') },
        uSunColor: { value: new THREE.Color('#fff2d1') },
        uSunDir: { value: new THREE.Vector3(0.45, 0.36, -0.82).normalize() },
        uFogColor: { value: new THREE.Color('#d8e9f2') },
        uFogDensity: { value: 0.0068 },
      },
      side: THREE.FrontSide,
    });
    this.waterMesh = new THREE.Mesh(oceanGeo, this.waterMat);
    this.waterMesh.frustumCulled = false;
    this.scene.add(this.waterMesh);

    // Feathered coastal surf foam collars hugging sea-stack & viaduct waterlines
    const foamGeo = new THREE.PlaneGeometry(11.5, 11.5);
    foamGeo.rotateX(-Math.PI * 0.495);
    this.mesaFoamInst = new THREE.InstancedMesh(
      foamGeo,
      new THREE.MeshBasicMaterial({
        map: this.shoreFoamTex,
        color: '#ebfcff',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      NUM_MESAS + NUM_SPIRES + NUM_VIADUCTS * 2
    );
    this.mesaFoamInst.frustumCulled = false;
    this.mesaFoamInst.renderOrder = 2;
    this.scene.add(this.mesaFoamInst);

    // Soft distant rainbow mist arcs drifting between sea-stacks
    this.rainbows = [];
    const rbMat = new THREE.MeshBasicMaterial({
      map: this.rainbowArcTex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rbGeo = new THREE.PlaneGeometry(18, 9);
    for (let i = 0; i < MAX_RAINBOWS; i++) {
      const m = new THREE.Mesh(rbGeo, rbMat);
      this.scene.add(m);
      this.rainbows.push(m);
    }

    // 3. Gateway 2.0 Sleek Horizontal Aerodynamic Frill-Spread Soaring Hero!
    this.heroGroup = new THREE.Group();
    this.gatewayMount = new THREE.Group();
    this.gatewayMount.rotation.order = 'YXZ';
    // Horizontal aerodynamic glide facing +X with flared frills & straight horizontal tail!
    this.gatewayMount.rotation.set(0.92, Math.PI * 0.5, 0);
    this.gatewayMount.position.set(-0.08, -0.24, 0);
    this.gatewayRig = new GatewayRig(this.skinId);
    this.gatewayMount.add(this.gatewayRig.group);
    this.heroGroup.add(this.gatewayMount);

    // Soft feathered slipstream mist ribbons trailing off Gateway's shoulders & tail
    this.ribbonMat = new THREE.MeshBasicMaterial({
      map: this.slipstreamTex,
      color: '#7df9ff',
      transparent: true,
      opacity: 0.66,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ribbonsGroup = new THREE.Group();
    this.ribbons = [];
    for (const sz of [-1, 1]) {
      const g = new THREE.PlaneGeometry(2.6, 0.34, 16, 1);
      g.translate(-1.3, 0, 0);
      const m = new THREE.Mesh(g, this.ribbonMat);
      m.position.set(0.05, 0.08, sz * 0.42);
      m.rotation.x = Math.PI * 0.16 * sz;
      this.ribbonsGroup.add(m);
      this.ribbons.push({ mesh: m, basePos: g.attributes.position.array.slice(), side: sz, len: 2.6 });
    }
    const tGeo = new THREE.PlaneGeometry(2.1, 0.26, 12, 1);
    tGeo.translate(-1.05, 0, 0);
    const tMesh = new THREE.Mesh(tGeo, this.ribbonMat);
    tMesh.position.set(-0.42, 0.02, 0);
    this.ribbonsGroup.add(tMesh);
    this.ribbons.push({ mesh: tMesh, basePos: tGeo.attributes.position.array.slice(), side: 0, len: 2.1 });
    this.heroGroup.add(this.ribbonsGroup);
    this.scene.add(this.heroGroup);

    // Launch Sanctuary & Arrival Spire Holders (populated cleanly from `env_sky_canyon.glb`!)
    this.summitGroup = new THREE.Group();
    this.summitGroup.visible = false;
    this.scene.add(this.summitGroup);

    this.destTowerGroup = new THREE.Group();
    this.destTowerGroup.visible = false;
    this.scene.add(this.destTowerGroup);

    // 4. Swirling Golden Thermal Updraft Columns + Rising Sparkle Trails (`stage.thermals`)
    this.thermalMeshes = [];
    const thermGeo = new THREE.PlaneGeometry(3.0, 14.2);
    const helixGeo = buildThermalHelixGeo();
    for (let i = 0; i < MAX_THERMALS; i++) {
      const grp = new THREE.Group();
      const sheetMat = new THREE.MeshBasicMaterial({
        map: this.updraftTex,
        color: '#fde047',
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const helixMat = new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sheet = new THREE.Mesh(thermGeo, sheetMat);
      const helix = new THREE.Mesh(helixGeo, helixMat);
      grp.add(sheet, helix);
      grp.userData = { sheet, sheetMat, helix, helixMat };
      grp.visible = false;
      this.scene.add(grp);
      this.thermalMeshes.push(grp);
    }

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
    this.scene.add(this.thermalSpiralInst);

    // 5. Storm Cloud Hazard Slots (`StormCloud_Sculpted` mounted once GLB loads + crackling lightning!)
    this.cloudSlots = [];
    const boltGeo = buildForkedLightningGeo();
    const boltMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
    const boltGlowMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const chargeCoreGeo = new THREE.SphereGeometry(0.45, 10, 8);
    const telegraphGeo = new THREE.PlaneGeometry(0.28, 9.5);
    telegraphGeo.translate(0, -4.8, 0);
    for (let i = 0; i < MAX_CLOUDS; i++) {
      const cg = new THREE.Group();
      const bodyHolder = new THREE.Group();
      cg.add(bodyHolder);
      const chargeMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const chargeCore = new THREE.Mesh(chargeCoreGeo, chargeMat);
      chargeCore.position.set(0, -0.15, 0.25);
      cg.add(chargeCore);

      const teleMat = new THREE.MeshBasicMaterial({
        map: this.updraftTex,
        color: '#fde047',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const strikeTelegraph = new THREE.Mesh(telegraphGeo, teleMat);
      strikeTelegraph.position.set(0, -0.25, 0.18);
      strikeTelegraph.visible = false;
      cg.add(strikeTelegraph);

      const boltGroup = new THREE.Group();
      const boltCore = new THREE.Mesh(boltGeo, boltMat);
      const boltHalo = new THREE.Mesh(boltGeo, boltGlowMat);
      boltHalo.scale.set(2.1, 1.0, 2.1);
      boltGroup.add(boltCore, boltHalo);
      boltGroup.position.y = -0.35;
      boltGroup.visible = false;
      cg.add(boltGroup);

      cg.userData = { bodyHolder, chargeCore, chargeMat, strikeTelegraph, teleMat, bolt: boltGroup };
      cg.visible = false;
      this.scene.add(cg);
      this.cloudSlots.push(cg);
    }

    // 6. Sculpted Luminous Sky-Pearl Lanterns (`stage.lanterns` — ZERO chunky blocky octahedra!), Seabirds & Wind
    const dewGeo = new THREE.IcosahedronGeometry(0.19, 1);
    dewGeo.scale(0.90, 1.18, 0.90);
    this.dewInst = new THREE.InstancedMesh(
      dewGeo,
      new THREE.MeshStandardMaterial({
        color: '#fffef2',
        emissive: '#fbbf24',
        emissiveIntensity: 0.78,
        metalness: 0.28,
        roughness: 0.10,
      }),
      MAX_DEW
    );
    this.dewInst.frustumCulled = false;
    this.scene.add(this.dewInst);

    this.birdInst = new THREE.InstancedMesh(
      buildCoastalGullGeo(),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45, side: THREE.DoubleSide }),
      MAX_BIRDS
    );
    this.birdInst.frustumCulled = false;
    this.scene.add(this.birdInst);

    this.windStreakMat = new THREE.MeshBasicMaterial({
      map: this.glowSpriteTex,
      color: '#e0f7ff',
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.windStreakInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, 0.055), this.windStreakMat, 36);
    this.windStreakInst.frustumCulled = false;
    this.scene.add(this.windStreakInst);

    this.ringInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1.0, 0.05, 8, 24),
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

    this.popupPool = [];
    for (let i = 0; i < MAX_POPUPS; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sp.visible = false;
      this.scene.add(sp);
      this.popupPool.push({ sprite: sp, key: '' });
    }

    // Pre-allocate `instanceColor` upfront on colored InstancedMeshes!
    this._dummy.position.set(0, 0, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(1);
    this._dummy.updateMatrix();
    for (const im of [this.thermalSpiralInst, this.dewInst, this.ringInst, this.partInst]) {
      im.setMatrixAt(0, this._dummy.matrix);
      im.setColorAt(0, this._whiteCol);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  async _loadGlbKit() {
    const kit = await loadCachedGlb('assets/models/env_sky_canyon.glb');
    if (this._disposed || !kit) return;

    const getNode = (n) => kit.getObjectByName(n) || null;
    this._glbPools.mesa = new GlbInstancedAsset(this.scene, getNode('SeaStack_Mesa_A'), NUM_MESAS);
    this._glbPools.spire = new GlbInstancedAsset(this.scene, getNode('SeaStack_Spire_B'), NUM_SPIRES);
    this._glbPools.viaduct = new GlbInstancedAsset(this.scene, getNode('Viaduct_SkyBridge'), NUM_VIADUCTS);
    this._glbPools.cumulusA = new GlbInstancedAsset(this.scene, getNode('Cumulus_Cloud_A'), NUM_CUMULUS_A, { cloudSoft: true });
    this._glbPools.cumulusB = new GlbInstancedAsset(this.scene, getNode('Cumulus_Cloud_B'), NUM_CUMULUS_B, { cloudSoft: true });
    this._glbPools.thermalRing = new GlbInstancedAsset(this.scene, getNode('ThermalRing_Bronze'), MAX_GATES);

    const stormNode = getNode('StormCloud_Sculpted');
    if (stormNode) {
      for (const slot of this.cloudSlots) {
        const cl = stormNode.clone(true);
        cl.traverse((o) => {
          if (o.isMesh && o.material) {
            const m = normalizeGlbMaterial(Array.isArray(o.material) ? o.material[0] : o.material);
            if (o.geometry?.attributes?.color) m.vertexColors = true;
            m.roughness = 0.88;
            m.emissive = new THREE.Color('#2a3250');
            m.emissiveIntensity = 0.25;
            o.material = m;
            slot.userData.bodyMat = m;
          }
        });
        cl.scale.setScalar(0.82);
        slot.userData.bodyHolder.add(cl);
      }
    }

    const launchNode = getNode('LaunchSanctuary_Deck');
    if (launchNode) {
      const cl = launchNode.clone(true);
      cl.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = normalizeGlbMaterial(Array.isArray(o.material) ? o.material[0] : o.material);
          if (o.geometry?.attributes?.color) o.material.vertexColors = true;
        }
      });
      this.summitGroup.add(cl);
    }

    const arrNode = getNode('ArrivalSpire_Distant');
    if (arrNode) {
      const cl = arrNode.clone(true);
      cl.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material = normalizeGlbMaterial(Array.isArray(o.material) ? o.material[0] : o.material);
          if (o.geometry?.attributes?.color) o.material.vertexColors = true;
        }
      });
      this.destTowerGroup.add(cl);
    }

    this.prewarm();
  }

  _applyBiomeTheme(bKey) {
    const pal = GLIDE_BIOME_PALETTES[bKey] || GLIDE_BIOME_PALETTES.canyon_river;
    this.scene.background.set(pal.skyTop);
    this.scene.fog.color.set(pal.fog);
    this.sunLight.color.set(pal.sun);
    this.hemiLight.color.set(pal.hemiSky);
    this.hemiLight.groundColor.set(pal.hemiGnd);

    const su = this.skyDomeMat.uniforms;
    su.uTopColor.value.set(pal.skyTop);
    su.uHorizonColor.value.set(pal.skyHor);
    su.uFogColor.value.set(pal.fog);
    su.uSunColor.value.set(pal.sun);

    const ou = this.waterMat.uniforms;
    ou.uDeepColor.value.set(pal.waterDeep);
    ou.uShallowColor.value.set(pal.waterShallow);
    ou.uSkyColor.value.set(pal.waterSky);
    ou.uSunColor.value.set(pal.sun);
    ou.uFogColor.value.set(pal.fog);

    // Keep cumulus cloud bounce light matched warmly to the active sky palette!
    for (const pool of [this._glbPools.cumulusA, this._glbPools.cumulusB]) {
      if (!pool) continue;
      for (const im of pool.meshes) {
        if (im.material?.emissive) im.material.emissive.set(pal.cloudUnder);
      }
    }

    if (this._activeBiome !== bKey) {
      this._activeBiome = bKey;
      loadCachedTex(pal.skybox, true, (tex) => {
        if (this._disposed || this._activeBiome !== bKey) return;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        this.skyDomeMat.uniforms.uSkyTex.value = tex;
        this.skyDomeMat.uniforms.uHasTex.value = 1.0;
      });
    }
    return pal;
  }

  render(stage, opts = {}) {
    if (this._disposed || !this.webgl || !stage) return;
    const time = Number(opts.time ?? stage.t) || 0;
    const dt = clamp(Number(opts.dt) || 0.016, 0.001, 0.05);

    if (opts.skinId && opts.skinId !== this.skinId) this.setSkin(opts.skinId);
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
    const pal = this._applyBiomeTheme(bKey);

    const scroll = Number(stage.scroll) || time * 110;
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const targetFovSwell = clamp(Number(stage.fovKick) || 0, 0, 1) * 7.0;
    this._fovSwellDeg += (targetFovSwell - this._fovSwellDeg) * (1 - Math.exp(-6.5 * dt));
    this._updateGlideCamMetrics(this._fovSwellDeg);

    this.updraftTex.offset.set(0, -(time * 0.92) % 1);
    this.skyDomeMat.uniforms.uScroll.value = scroll;
    this.waterMat.uniforms.uTime.value = time;
    this.waterMat.uniforms.uScroll.value = scroll;

    const seaY = stage.seaY ?? this.height * 0.88;
    const seaWorldY = this._screenToWorld(this.width * 0.5, seaY, 0).y;
    this.waterMesh.position.y = seaWorldY - 0.16;

    const dm = this._dummy;
    const baseSc = portrait ? 0.72 : 0.88;
    let foamIdx = 0;

    // 1. Majestic Terraced Sandstone Sea-Stack Mesas w/ Rounded Pixar 3D Trees (`SeaStack_Mesa_A`)
    if (this._glbPools.mesa) {
      for (let i = 0; i < NUM_MESAS; i++) {
        const z = -22.0 - (i % 2) * 8.5;
        const speed = 0.011 - (i % 2) * 0.002;
        const px = ((((i * 31.0 + 10.0) - scroll * speed) % 124) + 124) % 124 - 62;
        const sc = baseSc * (0.94 + (i % 3) * 0.14);
        dm.position.set(px, seaWorldY - 0.95, z);
        dm.rotation.set(0, i * 0.95, 0);
        dm.scale.set(sc, sc * (0.92 + (i % 2) * 0.14), sc);
        dm.updateMatrix();
        this._glbPools.mesa.setMatrixAt(i, dm.matrix);

        dm.position.set(px, seaWorldY + 0.04, z);
        dm.rotation.set(0, time * 0.08 + i, 0);
        dm.scale.set(sc * 1.25, 1, sc * 1.15);
        dm.updateMatrix();
        this.mesaFoamInst.setMatrixAt(foamIdx++, dm.matrix);
      }
      this._glbPools.mesa.commit(NUM_MESAS);
    }

    // 2. Sculpted Twin-Pillar Coastal Sandstone Arch-Stacks (`SeaStack_Spire_B` — ZERO cone spikes!)
    if (this._glbPools.spire) {
      for (let i = 0; i < NUM_SPIRES; i++) {
        const z = -15.5 - (i % 2) * 9.5;
        const speed = 0.0145 - (i % 2) * 0.0025;
        const px = ((((i * 30.0 + 24.0) - scroll * speed) % 120) + 120) % 120 - 60;
        const sc = baseSc * (0.86 + (i % 3) * 0.14);
        dm.position.set(px, seaWorldY - 0.90, z);
        dm.rotation.set(0, i * 1.25, 0);
        dm.scale.set(sc, sc * (0.94 + (i % 3) * 0.10), sc);
        dm.updateMatrix();
        this._glbPools.spire.setMatrixAt(i, dm.matrix);

        dm.position.set(px, seaWorldY + 0.04, z);
        dm.rotation.set(0, -time * 0.09 + i, 0);
        dm.scale.set(sc * 1.15, 1, sc * 1.05);
        dm.updateMatrix();
        this.mesaFoamInst.setMatrixAt(foamIdx++, dm.matrix);
      }
      this._glbPools.spire.commit(NUM_SPIRES);
    }

    // 3. Ruined 3-Arch Stone Pelagian Viaduct Sky-Bridges (`Viaduct_SkyBridge` — piers seated deep in ocean!)
    if (this._glbPools.viaduct) {
      for (let i = 0; i < NUM_VIADUCTS; i++) {
        const isNear = i % 2 === 0;
        const z = isNear ? -12.5 : -24.5;
        const speed = isNear ? 0.017 : 0.0115;
        const px = ((((i * 34.0 + 18.0) - scroll * speed) % 136) + 136) % 136 - 68;
        const sc = baseSc * (isNear ? 0.88 : 1.12);
        dm.position.set(px, seaWorldY - 0.90, z);
        dm.rotation.set(0, isNear ? 0.12 : -0.16, 0);
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._glbPools.viaduct.setMatrixAt(i, dm.matrix);

        for (const ox of [-5.2, 5.2]) {
          dm.position.set(px + ox * sc, seaWorldY + 0.04, z);
          dm.rotation.set(0, time * 0.10 + i, 0);
          dm.scale.set(sc * 0.72, 1, sc * 0.72);
          dm.updateMatrix();
          this.mesaFoamInst.setMatrixAt(foamIdx++, dm.matrix);
        }
      }
      this._glbPools.viaduct.commit(NUM_VIADUCTS);
    }
    this.mesaFoamInst.count = foamIdx;
    if (foamIdx > 0) this.mesaFoamInst.instanceMatrix.needsUpdate = true;

    // 4. Drifting Asymmetrical Volumetric 3D Cumulus Cloud Banks (lifted high & clear of viaduct arches!)
    if (this._glbPools.cumulusA && this._glbPools.cumulusB) {
      for (let i = 0; i < NUM_CUMULUS_A; i++) {
        const layer = i % 3;
        const cz = layer === 0 ? -17.5 : layer === 1 ? -26.5 : -38.0;
        const spd = layer === 0 ? 0.018 : layer === 1 ? 0.012 : 0.0075;
        const span = layer === 0 ? 96 : layer === 1 ? 118 : 148;
        const cx = ((((i * 22.3 + 7.0) - scroll * spd) % span) + span) % span - span * 0.5;
        const cy = (layer === 0 ? 4.9 : layer === 1 ? 6.6 : 8.8) + Math.sin(i * 2.1 + time * 0.22) * 0.55;
        const sc = (layer === 0 ? 1.15 : layer === 1 ? 1.65 : 2.35) * (0.86 + (i % 3) * 0.12);
        dm.position.set(cx, cy, cz);
        dm.rotation.set(0, (i % 2 === 0 ? 0.12 : -0.14), 0);
        dm.scale.set(sc * 1.12, sc * 0.94, sc);
        dm.updateMatrix();
        this._glbPools.cumulusA.setMatrixAt(i, dm.matrix);

        const cxB = ((((i * 24.7 + 19.0) - scroll * (spd * 0.92)) % span) + span) % span - span * 0.5;
        const cyB = (layer === 0 ? 4.4 : layer === 1 ? 5.9 : 7.9) + Math.cos(i * 1.7 + time * 0.20) * 0.48;
        dm.position.set(cxB, cyB, cz - 2.6);
        dm.rotation.set(0, (i % 2 === 0 ? -0.15 : 0.16), 0);
        dm.scale.set(sc * 1.06, sc * 0.90, sc);
        dm.updateMatrix();
        this._glbPools.cumulusB.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.cumulusA.commit(NUM_CUMULUS_A);
      this._glbPools.cumulusB.commit(NUM_CUMULUS_B);
    }

    for (let r = 0; r < MAX_RAINBOWS; r++) {
      const rx = ((((r * 32 - scroll * 0.0115) % 96) + 96) % 96) - 48;
      this.rainbows[r].position.set(rx, seaWorldY + 3.1, -17.5);
    }

    // Launch Sanctuary (ONLY during intro, cleanly beneath Gateway) & Distant Arrival Spire
    if (stage.phase === 'intro' && stage.summit && stage.summit.x > -140) {
      const swp = this._screenToWorld(stage.summit.x, stage.summit.y, -2.4);
      this.summitGroup.visible = true;
      this.summitGroup.position.set(swp.x, swp.y - 0.55, -2.4);
    } else {
      this.summitGroup.visible = false;
    }

    if (stage.tower?.active && (stage.tower.depth || 0) > 0.08) {
      const depthZ = lerp(-50, -4.0, stage.tower.depth || 0);
      const twp = this._screenToWorld(stage.tower.x, seaY, depthZ);
      this.destTowerGroup.visible = true;
      this.destTowerGroup.position.set(twp.x, seaWorldY - 0.5, depthZ);
    } else {
      this.destTowerGroup.visible = false;
    }

    // 5. Gateway 2.0 Sleek Horizontal Aerodynamic Frill-Spread Soaring Pose — 1:1 Exact Hitbox Alignment!
    const gl = stage.glider || { x: this.width * (portrait ? 0.34 : 0.26), y: this.height * 0.44, vx: 0, vy: 0 };
    const hwp = this._screenToWorld(gl.x, gl.y, 0.45);
    const heroX = hwp.x;
    const heroY = hwp.y;
    this.heroGroup.scale.setScalar(portrait ? 1.06 : 1.22);

    const rawPitch =
      gl.pitch != null
        ? -clamp(gl.pitch, -0.55, 0.55) + (gl.flare || 0) * 0.22
        : clamp(Math.atan2(-(gl.vy || 0), 240), -0.55, 0.50) + (gl.flare || 0) * 0.28;
    this._glidePitchSmooth += (rawPitch - this._glidePitchSmooth) * (1 - Math.exp(-12 * dt));

    const landed = (gl.landed || 0) > 0.05;
    const buffet = clamp(gl.buffet || 0, 0, 1);
    const liftVal = clamp(gl.lift || 0, 0, 1.5);
    const airspeed = clamp(gl.airspeed ?? gl.speed ?? 1, 0.65, 1.8);
    const diveVal = clamp(gl.dive || 0, 0, 1);
    const buffetFlutter = (buffet * 0.24 + liftVal * 0.14) * Math.sin(time * 20.0);
    const roll = clamp(-(gl.vy || 0) * 0.0014, -0.32, 0.32) + buffet * Math.sin(time * 20) * 0.09 + (gl.spin || 0);

    this.heroGroup.position.set(heroX, heroY, 0.45);
    this.heroGroup.rotation.set(roll, 0, this._glidePitchSmooth);

    // Slipstream ribbons streaming gracefully behind Gateway's shoulders & tail
    this.ribbonsGroup.visible = !landed;
    const ribSpeedScale = clamp(0.85 + (airspeed - 0.85) * 0.85 + diveVal * 0.35, 0.75, 1.75);
    this.ribbonMat.opacity = clamp(0.52 + diveVal * 0.24 + Math.max(0, airspeed - 1) * 0.28, 0.42, 0.88);
    for (const r of this.ribbons) {
      const pos = r.mesh.geometry.attributes.position;
      const base = r.basePos;
      r.mesh.scale.x = ribSpeedScale;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const u = clamp(-bx / r.len, 0, 1);
        pos.setY(i, by * (0.65 + u * 0.90) + liftVal * 0.22 * u + Math.sin(time * (9.5 + airspeed * 3.2) - u * 4.6 + r.side) * u * (0.20 + buffet * 0.14));
        pos.setZ(i, Math.cos(time * 7.6 - u * 3.6 + r.side * 0.7) * u * 0.14);
      }
      pos.needsUpdate = true;
    }

    this.gatewayMount.rotation.set(
      landed ? 0 : 0.92 + diveVal * 0.18 - (gl.flare || 0) * 0.20 - liftVal * 0.10 + buffetFlutter * 0.10,
      Math.PI * 0.5,
      landed ? 0 : buffetFlutter * 0.12
    );
    this.gatewayRig.update(dt, {
      time,
      vx: landed ? gl.vx * 0.02 : 2.6 + airspeed * 0.9,
      vy: -(gl.vy || 0) * 0.01,
      facing: 1,
      onGround: landed,
      gliding: !landed,
      isGliding: !landed,
      anim: landed ? 'HeroCelebrate' : 'FrillGlide',
      mood: (gl.stun || 0) > 0 ? 'hurt' : landed || liftVal > 0.25 ? 'joyful' : diveVal > 0.35 ? 'determined' : 'happy',
      frillFlare: landed ? 0.25 : clamp(1.0 + liftVal * 0.32 + buffet * 0.24, 0.70, 1.45),
    });
    // POSITIVE X bends Gateway's tail DOWNWARD into sleek horizontal trailing flight (ZERO scorpion curl!)
    if (!landed && this.gatewayRig.bones) {
      const b = this.gatewayRig.bones;
      const flutter = Math.sin(time * 9.0) * 0.06;
      if (b.Tail1) b.Tail1.rotateX(0.92 + flutter * 0.6);
      if (b.Tail2) b.Tail2.rotateX(0.26 + Math.sin(time * 9.0 - 0.7) * 0.06);
      if (b.Tail3) b.Tail3.rotateX(0.14 + Math.sin(time * 9.0 - 1.4) * 0.05);
      if (b.Tail4) b.Tail4.rotateX(0.06 + Math.sin(time * 9.0 - 2.1) * 0.05);
      if (b.Head) b.Head.rotateX(-0.28);
    }

    // 6. Chunky 3D Antique-Bronze & Crystal `ThermalRing_Bronze` (`stage.gates`)
    // Angle open 3/4 facing camera (-0.36 rad Y) so golden-bronze ring opening is clearly readable across viewport!
    const gates = stage.gates || [];
    let gCnt = 0;
    for (let i = 0; i < gates.length && gCnt < MAX_GATES; i++) {
      const gt = gates[i];
      const wp = this._screenToWorld(gt.x, gt.y, 0.05);
      const rad = Math.max(0.64, this._pxScale(gt.r || 36, 0.05) * 1.02);
      const pop = gt.state === 'passed' ? 1 + (gt.t || 0) * 0.55 : 1 + Math.sin(time * 3.2 + i) * 0.04;
      dm.position.set(wp.x, wp.y, 0.05);
      dm.rotation.set(0, -0.36, time * 0.85 + i);
      dm.scale.setScalar(rad * pop);
      dm.updateMatrix();
      this._glbPools.thermalRing?.setMatrixAt(gCnt++, dm.matrix);
    }
    this._glbPools.thermalRing?.commit(gCnt);

    // 7. Golden Thermal Updraft Columns & Rising Sparkles (`stage.thermals`)
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
      tm.userData.sheetMat.color.set(pal.thermal);
      tm.userData.sheetMat.opacity = 0.48 * fade;
      tm.userData.helix.rotation.y = time * 3.8 + i * 1.4;
      tm.userData.helixMat.color.set(pal.thermal);
      tm.userData.helixMat.opacity = (0.34 + Math.sin(time * 5.2 + i) * 0.08) * fade;

      for (let k = 0; k < 6 && tsCnt < 48; k++) {
        const u = (time * 0.65 + k / 6 + i * 0.19) % 1;
        const ang = u * TAU * 2.4 + time * 3.4 + k;
        const sfade = Math.sin(u * Math.PI) * fade;
        dm.position.set(wp.x + Math.cos(ang) * colRad * (0.75 + u * 0.35), seaWorldY + 0.35 + u * 8.6, -0.30 + Math.sin(ang) * 0.48);
        dm.rotation.set(0, 0, Math.cos(ang) * 0.35 + 0.18);
        dm.scale.set((0.92 + u * 0.68) * sfade, (0.82 + sfade * 0.50) * sfade, 1);
        dm.updateMatrix();
        this._col.set(pal.thermal).lerp(this._whiteCol, 0.45);
        this.thermalSpiralInst.setColorAt(tsCnt, this._col);
        this.thermalSpiralInst.setMatrixAt(tsCnt++, dm.matrix);
      }
    }
    this.thermalSpiralInst.count = tsCnt;
    if (tsCnt > 0) {
      this.thermalSpiralInst.instanceMatrix.needsUpdate = true;
      if (this.thermalSpiralInst.instanceColor) this.thermalSpiralInst.instanceColor.needsUpdate = true;
    }

    // 8. Sculpted 3D Thunderhead Storm Clouds (`stage.clouds`)
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
      if (slot.userData.bodyMat) {
        slot.userData.bodyMat.emissive.set(isStrike ? '#fbbf24' : isCharge ? '#92400e' : '#2a3250');
        slot.userData.bodyMat.emissiveIntensity = isStrike ? 0.90 : isCharge ? 0.55 + Math.sin(time * 22) * 0.25 : 0.25;
      }
      const localStrikeX = this._pxScale(c.strikeX || 0, -0.2) / Math.max(0.2, radScale);
      slot.userData.chargeCore.visible = isCharge || isStrike;
      slot.userData.chargeCore.position.x = localStrikeX;
      slot.userData.chargeMat.opacity = isStrike ? 0.90 : isCharge ? 0.45 + Math.sin(time * 24) * 0.32 : 0;
      if (slot.userData.strikeTelegraph) {
        slot.userData.strikeTelegraph.visible = isCharge;
        slot.userData.strikeTelegraph.position.x = localStrikeX;
        slot.userData.teleMat.opacity = isCharge ? 0.32 + Math.sin(time * 26) * 0.22 : 0;
      }
      slot.userData.bolt.visible = isStrike;
      if (isStrike) {
        slot.userData.bolt.position.x = localStrikeX;
        slot.userData.bolt.rotation.y = (time * 32 + i) % TAU;
      }
    }

    // 9. Luminous Sky-Pearl Lanterns, Exact-Hitbox Seabirds, Wind Gusts, Warnings, Rings & Popups
    const lanterns = stage.lanterns || [];
    let dCnt = 0;
    const dewColors = ['#5efce8', '#fde047', '#7dd3fc', '#f9a8d4'];
    for (let i = 0; i < lanterns.length && dCnt < MAX_DEW; i++) {
      const l = lanterns[i];
      const wp = this._screenToWorld(l.x, l.y, 0.20);
      dm.position.set(wp.x, wp.y, 0.20);
      dm.rotation.set(time * 1.8 + i, time * 2.8 + i, 0);
      dm.scale.setScalar(l.type === 'gold' ? 1.02 : l.type === 'kite' ? 0.96 : 0.78);
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

    // Render active gameplay gulls 1:1 on the exact gameplay plane (wp.x, wp.y, 0.10) — ZERO phantom hits!
    const gulls = stage.gulls || [];
    let bCnt = 0;
    for (let i = 0; i < gulls.length && bCnt < MAX_BIRDS; i++) {
      const b = gulls[i];
      const wp = this._screenToWorld(b.x, b.y, 0.10);
      dm.position.set(wp.x, wp.y, 0.10);
      dm.rotation.set(Math.sin(b.phase || time * 7) * 0.38, 0.15, 0);
      dm.scale.setScalar(0.62);
      dm.updateMatrix();
      this.birdInst.setMatrixAt(bCnt++, dm.matrix);
    }
    this.birdInst.count = bCnt;
    if (bCnt > 0) this.birdInst.instanceMatrix.needsUpdate = true;

    const diveRush = clamp((airspeed - 0.92) / 0.72 + diveVal * 0.55, 0, 1.25);
    this.windStreakMat.opacity = clamp(0.14 + diveRush * 0.30, 0.12, 0.48);
    const gusts = stage.gusts || [];
    let wsIdx = 0;
    // Render active wind shear gust corridors (`stage.gusts`) as unmistakable angled wind ribbons!
    for (let gi = 0; gi < gusts.length && wsIdx < 24; gi++) {
      const gu = gusts[gi];
      const gwp = this._screenToWorld(gu.x, gu.y, 0.0);
      const gw = Math.max(1.2, this._pxScale(gu.w || 180, 0.0));
      const gh = Math.max(0.8, this._pxScale(gu.h || 100, 0.0));
      const tilt = gu.dir > 0 ? -0.45 : 0.45;
      for (let k = 0; k < 6 && wsIdx < 24; k++) {
        const u = (time * 1.3 + k * 0.17 + gi * 0.3) % 1;
        dm.position.set(gwp.x + (0.5 - u) * gw, gwp.y + ((k / 5) - 0.5) * gh, 0.02);
        dm.rotation.set(0, 0, tilt);
        dm.scale.set(1.25, 1.35, 1);
        dm.updateMatrix();
        this.windStreakInst.setMatrixAt(wsIdx++, dm.matrix);
      }
    }
    const wsActive = Math.min(36, wsIdx + Math.round(12 + diveRush * 14));
    const wsSpeed = 4.2 + airspeed * 6.2;
    const spanW = hwp.halfW * 2.4;
    for (let i = wsIdx; i < wsActive; i++) {
      const wx = hwp.halfW * 1.2 - (((time * wsSpeed * (0.82 + (i % 4) * 0.14) + i * 2.13) % spanW) + spanW) % spanW;
      const wy = (((i * 1.73) % 2) - 1) * hwp.halfH * 0.82;
      dm.position.set(wx, wy, -0.2 - (i % 4) * 0.45);
      dm.rotation.set(0, 0, this._glidePitchSmooth * 0.25);
      dm.scale.set((0.62 + diveRush * 1.1) * (0.8 + (i % 3) * 0.18), 0.75 + diveRush * 0.32, 1);
      dm.updateMatrix();
      this.windStreakInst.setMatrixAt(i, dm.matrix);
    }
    this.windStreakInst.count = wsActive;
    if (wsActive > 0) this.windStreakInst.instanceMatrix.needsUpdate = true;

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
    // Soft feathered glowing right-edge telegraph beacons for incoming `stage.warnings` (zero hard wireframe rings!)
    const warnings = stage.warnings || [];
    for (let i = 0; i < warnings.length && ptCnt < MAX_PARTICLES; i++) {
      const w = warnings[i];
      const wp = this._screenToWorld(this.width * 0.94, w.y, 0.35);
      const pulse = 1.6 + Math.abs(Math.sin(time * 10 + i)) * 0.9;
      dm.position.set(wp.x, wp.y, 0.35);
      dm.rotation.set(0, 0, time * 1.4 + i);
      dm.scale.setScalar(pulse);
      dm.updateMatrix();
      this._col.set(w.kind === 'gull' ? '#fb7185' : '#fde047');
      this.partInst.setColorAt(ptCnt, this._col);
      this.partInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    for (let i = 0; i < 32 && ptCnt < MAX_PARTICLES; i++) {
      const age = (time * 2.2 + i * 0.13) % 1;
      dm.position.set(heroX - 0.72 - age * 3.8, heroY + Math.sin(time * 6.5 + i * 1.4) * (0.12 + age * 0.32), 0.45);
      dm.rotation.set(0, 0, time * 0.8 + i);
      dm.scale.setScalar(Math.sin(age * Math.PI) * (0.52 + age * 0.60));
      dm.updateMatrix();
      this._col.set(i % 3 === 0 ? '#fde68a' : i % 2 === 0 ? '#7df9ff' : '#d6fbff');
      this.partInst.setColorAt(ptCnt, this._col);
      this.partInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    for (let i = 0; i < extParts.length && ptCnt < MAX_PARTICLES; i++) {
      const p = extParts[i];
      if (p.x == null || p.y == null) continue;
      const wp = this._screenToWorld(p.x, p.y, 0.45);
      const lifeRatio = clamp(p.life / Math.max(0.01, p.maxLife || 1), 0, 1);
      dm.position.set(wp.x, wp.y, 0.45);
      dm.rotation.set(0, 0, i * 0.9);
      dm.scale.setScalar(0.55 + lifeRatio * 0.70);
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
    this.skyDome.position.copy(this.camera.position);

    // Adaptive 60fps PostFX guard (matches `src/postfx.js` automatic bypass guarantee!)
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : 0;
    if (this._lastFrameTs > 0 && nowPerf > this._lastFrameTs) {
      const fms = clamp(nowPerf - this._lastFrameTs, 4, 80);
      this._frameMsEma = this._frameMsEma * 0.88 + fms * 0.12;
      if (this._frameMsEma > 19.5) this._bypassPostFx = true;
      else if (this._frameMsEma < 11.5) this._bypassPostFx = false;
    }
    this._lastFrameTs = nowPerf;

    const postfx = !this._bypassPostFx ? opts?.postfx : null;
    if (postfx && postfx.enabled && !postfx._disposed && typeof postfx.render === 'function') {
      this.postfxActive = true;
      postfx.render(this.scene, this.camera, {
        biome: bKey,
        exposure: 1.07,
        bloomThreshold: 0.80,
        bloomStrength: 0.30,
        bloomRadius: 0.40,
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
    this.gatewayRig?.dispose?.();
    this._ownEnvRt?.dispose();
    this.glowSpriteTex?.dispose();
    this.slipstreamTex?.dispose();
    this.shoreFoamTex?.dispose();
    this.updraftTex?.dispose();
    this.rainbowArcTex?.dispose();
    for (const pool of Object.values(this._glbPools)) pool?.dispose?.();
    this._glbPools = {};
    for (const p of this.popupPool) {
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
  }
}

export { GlideRenderer as FrillGlideRenderer };
export default GlideRenderer;
