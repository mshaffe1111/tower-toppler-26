// TOWERING WATERS: GATEWAY'S DESCENT — WHITEWATER RAPIDS SURF 3D RENDERER (`src/skimmerRenderer.js`)
//
// Blender-First Stylized 3D Rapids Engine (`assets/models/env_rapids_gorge.glb`):
//   - Wide unobstructed sunlit Sedona canyon river (`width >= 22m`, stepped cliffs strictly
//     outside `|x| >= 11.4m` following `gorgeCurveX(z)`, ZERO cliffs blocking camera or Gateway!).
//   - Real sculpted Blender 5.3 modular kit:
//       * `CliffBank_Left` / `CliffBank_Right` (terraced Sedona sandstone bluffs + 3D Pixar trees)
//       * `AqueductBridge_High` (carved Pelagian stone aqueduct arches soaring HIGH `y >= 9.2m`)
//       * `TimberPier` (weathered redwood riverbank piers with glowing aqua harbor lanterns)
//       * `RiverBoulder_A` / `RiverBoulder_B` (sculpted mossy river boulders)
//       * `SlalomGate_Arch` (carved bronze-and-sandstone slalom gates with twin aqua lanterns)
//       * `SlalomRing_Bronze` (chunky 3D antique-bronze & sea-glass crystal slalom rings)
//       * `HydroBoard_Hero` (carved redwood-and-bronze Pelagian Hydro-Board for Gateway 2.0)
//       * `SupplyBuoy_Pelagian` (chunky bronze-and-crystal smashable supply buoy)
//   - Custom reflective turquoise GLSL whitewater rapids shader (multi-wave sunlit speculars,
//     Fresnel sky reflection, foaming shoreline rapids, dynamic carved V-wake behind Gateway!).
//   - Seamless 3D sky-dome (`biome_skybox_*.webp`) blending cleanly into warm golden `FogExp2`
//     (ZERO flat 2D backdrop posters, ZERO cardboard cutouts, ZERO wireframe hoops!).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const MAX_GATES = 12;
const MAX_RAMPS = 12;
const MAX_HAZARDS = 24;
const MAX_SEEDS = 40;
const MAX_BOLTS = 24;
const MAX_SPRAY = 96;
const MAX_BANK_SEGS = 8;
const MAX_AQUEDUCTS = 4;
const MAX_PIERS = 6;
const MAX_SHORE_BOULDERS = 16;
const MAX_SUNBEAMS = 5;
const MAX_POPUPS = 6;
const BANK_STEP_Z = 17.5;
const BANK_SPAN_Z = MAX_BANK_SEGS * BANK_STEP_Z; // 140m seamless canyon!

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Smooth unobstructed S-gorge canyon spline: strictly 0 near camera & Gateway (wz >= -4)
// so foreground sightlines remain 100% clear, then winds gracefully ahead downriver!
function gorgeCurveX(wz, dist) {
  const dAhead = wz < -4.0 ? -(wz + 4.0) : 0;
  if (dAhead <= 0.001) return 0;
  const f = dAhead < 20.0 ? dAhead / 20.0 : 1.0;
  const f2 = f * f * (3.0 - 2.0 * f);
  return (Math.sin(dAhead * 0.036 + dist * 0.022) * 2.8 + Math.cos(dAhead * 0.020 - dist * 0.014) * 0.95) * f2;
}

function gorgeCurveYaw(wz, dist) {
  const x0 = gorgeCurveX(wz, dist);
  const x1 = gorgeCurveX(wz - 1.8, dist);
  // +1.8 forward denominator so straight river => 0 rad (NEVER Math.PI!) and curves gently lean into bends
  return Math.atan2(x0 - x1, 1.8) * 0.60;
}

function resolveItemWorldZ(itemZ, dist) {
  const relZ = itemZ > 68 && dist > 60 ? itemZ - dist : itemZ;
  return -relZ;
}

const BOOST_TIER_COLORS = [
  { rim: '#38bdf8', curtain: '#5efce8' },
  { rim: '#34d399', curtain: '#6ee7b7' },
  { rim: '#f59e0b', curtain: '#fde047' },
  { rim: '#e879f9', curtain: '#f5d0fe' },
];

const BIOME_RAPIDS_THEMES = {
  canyon_river: {
    skybox: 'assets/textures/biome_skybox_canyon_river.webp',
    skyTop: '#1f70ba',
    skyHor: '#f7d59c',
    fog: '#e6c99b',
    sun: '#fff1d1',
    hemiSky: '#8cd2f7',
    hemiGnd: '#36586e',
    waterDeep: '#096d82',
    waterShallow: '#18c8ce',
    waterSky: '#e8f4fa',
  },
  alpine_lake: {
    skybox: 'assets/textures/biome_skybox_alpine_lake.webp',
    skyTop: '#1b64b8',
    skyHor: '#dff2fe',
    fog: '#c4e3f6',
    sun: '#fff6eb',
    hemiSky: '#98d8fb',
    hemiGnd: '#2c4a63',
    waterDeep: '#08487a',
    waterShallow: '#18a8d8',
    waterSky: '#e6f4ff',
  },
  mist_bayou: {
    skybox: 'assets/textures/biome_skybox_mist_bayou.webp',
    skyTop: '#423f9a',
    skyHor: '#f7ba82',
    fog: '#dfc0a4',
    sun: '#ffebd0',
    hemiSky: '#8ec4de',
    hemiGnd: '#26483e',
    waterDeep: '#0a4c48',
    waterShallow: '#18968a',
    waterSky: '#f5d4b4',
  },
  coral_sea: {
    skybox: 'assets/textures/biome_skybox_coral_sea.webp',
    skyTop: '#0888cc',
    skyHor: '#ccf6fc',
    fog: '#a8e8f4',
    sun: '#fff6de',
    hemiSky: '#8ce0fa',
    hemiGnd: '#1e586e',
    waterDeep: '#075f82',
    waterShallow: '#16c8d4',
    waterSky: '#dcf8ff',
  },
  storm_ocean: {
    skybox: 'assets/textures/biome_skybox_storm_ocean.webp',
    skyTop: '#123152',
    skyHor: '#45a6d1',
    fog: '#326480',
    sun: '#e0f0ff',
    hemiSky: '#6eb2d8',
    hemiGnd: '#1c384d',
    waterDeep: '#072d4c',
    waterShallow: '#147ea8',
    waterSky: '#7cc0de',
  },
};

// --- SEAMLESS 3D SKY DOME SHADER (NO HARD HORIZON SEAM, NO 2D WALLPAPER!) ---
const SKY_DOME_VERT = /* glsl */ `
  varying vec3 vDir;
  varying vec2 vUv;
  void main() {
    vDir = normalize(position);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_DOME_FRAG = /* glsl */ `
  uniform sampler2D uSkyTex;
  uniform float uHasTex;
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uFogColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;

  varying vec3 vDir;
  varying vec2 vUv;

  void main() {
    vec3 dir = normalize(vDir);
    float elev = clamp(dir.y, -1.0, 1.0);

    // Smooth atmospheric gradient fallback
    vec3 grad = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.58, max(0.0, elev)));

    vec3 col = grad;
    if (uHasTex > 0.5) {
      // Map upper hemisphere smoothly onto skybox panorama upper portion so horizon aligns naturally
      float u = fract(atan(dir.x, -dir.z) / 6.2831853 + 0.5);
      float v = clamp(0.46 + elev * 0.62, 0.04, 0.98);
      vec3 texCol = texture2D(uSkyTex, vec2(u, v)).rgb;
      float zenithBlend = smoothstep(0.42, 0.85, elev);
      col = mix(texCol, uTopColor, zenithBlend * 0.65);
    }

    // Golden-hour sun disc & atmospheric corona
    float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(sunCos, 96.0) * 0.85 + pow(sunCos, 10.0) * 0.24);

    // Seamless blend into exponential horizon fog below horizon so water & sky merge invisibly!
    float fogBand = 1.0 - smoothstep(-0.04, 0.16, elev);
    col = mix(col, uFogColor, fogBand);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- ANIMATED REFLECTIVE TURQUOISE GLSL WHITEWATER RAPIDS SHADER ---
const RAPIDS_WATER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uDist;
  varying vec3 vWorldPos;
  varying float vLocalX;
  varying float vWaveH;
  varying float vCamDist;

  float gorgeCurveX(float wz, float dist) {
    float dAhead = max(0.0, -(wz + 4.0));
    float f = smoothstep(0.0, 20.0, dAhead);
    return (sin(dAhead * 0.036 + dist * 0.022) * 2.8 + cos(dAhead * 0.020 - dist * 0.014) * 0.95) * f;
  }

  void main() {
    vec3 pos = position;
    vec4 baseWorld = modelMatrix * vec4(pos, 1.0);
    float localX = baseWorld.x;
    pos.x += gorgeCurveX(baseWorld.z, uDist);

    float zFlow = baseWorld.z - uDist;
    float w1 = sin(zFlow * 0.42 + localX * 0.36 + uTime * 2.3) * 0.10;
    float w2 = cos(zFlow * 0.84 - localX * 0.62 + uTime * 3.2) * 0.06;
    float w3 = sin(zFlow * 1.44 + localX * 1.08 - uTime * 4.1) * 0.032;
    float w4 = cos((localX * 0.82 - zFlow * 0.54) + uTime * 2.6) * 0.026;
    float h = w1 + w2 + w3 + w4;

    pos.y += h;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    vLocalX = localX;
    vWaveH = h;
    vec4 mvPos = viewMatrix * worldPos;
    vCamDist = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const RAPIDS_WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uDist;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec2 uHeroXZ;

  varying vec3 vWorldPos;
  varying float vLocalX;
  varying float vWaveH;
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

  float fbm2(vec2 p) {
    float s = 0.62 * vnoise(p);
    p = mat2(0.82, 0.57, -0.57, 0.82) * p * 2.08;
    s += 0.38 * vnoise(p);
    return s;
  }

  void main() {
    vec2 rp = vec2(vLocalX, vWorldPos.z - uDist * 0.96);

    // Analytical multi-wave normal (5x faster on iGPU than 3x finite-difference FBM, ultra crisp glints!)
    float a1 = rp.y * 0.78 + rp.x * 0.48 + uTime * 2.3;
    float a2 = rp.y * 1.54 - rp.x * 1.12 + uTime * 3.4;
    float a3 = rp.y * 2.75 + rp.x * 2.15 - uTime * 4.2;
    float dhdx = cos(a1) * 0.14 + sin(a2) * 0.16 + cos(a3) * 0.14;
    float dhdz = cos(a1) * 0.22 - sin(a2) * 0.20 + cos(a3) * 0.18;
    vec2 fUv = vec2(rp.x * 0.52, rp.y * 0.18);
    float cur = fbm2(fUv * vec2(1.85, 1.25) + vec2(sin(rp.y * 0.14 + uTime * 0.5) * 0.65, -uTime * 0.75));
    vec3 N = normalize(vec3(-(dhdx + (cur - 0.5) * 0.32), 1.0, -(dhdz + (cur - 0.5) * 0.24)));

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Sunlit turquoise-emerald river gradient shallowing toward canyon banks (|x| ~ 11.4m)
    float bankT = smoothstep(3.2, 10.6, abs(vLocalX));
    vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(0.42 + bankT * 0.52 + vWaveH * 1.65, 0.0, 1.0));

    // Luminous subsurface turquoise wave-crest glow (matching Main Spire water richness!)
    float sss = pow(clamp(dot(V, normalize(-L + N * 0.50)), 0.0, 1.0), 2.4) * (0.65 + max(0.0, vWaveH) * 3.6);
    baseWater += vec3(0.08, 0.58, 0.56) * sss;

    // Crisp Schlick Fresnel golden sky reflection
    float ndotv = max(dot(N, V), 0.0);
    float fresnel = 0.06 + 0.94 * pow(1.0 - ndotv, 3.8);
    vec3 reflSky = mix(uSkyColor, uSunColor, 0.34 + 0.26 * clamp(N.x * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(baseWater, reflSky, fresnel * 0.58);

    // Sparkling sunlit river specular glint + broad sheen
    vec3 H = normalize(L + V);
    float specSharp = pow(max(dot(N, H), 0.0), 120.0);
    float specBroad = pow(max(dot(N, H), 0.0), 22.0);
    col += uSunColor * (specSharp * 2.10 + specBroad * 0.32);

    // Organic rushing whitewater current ribbons & canyon shoreline foam (|x| >= 9.6m)
    float crestFoam = smoothstep(0.60, 0.82, cur + vWaveH * 1.20) * 0.46;
    float bankFoam = smoothstep(8.8, 11.4, abs(vLocalX) + (cur - 0.5) * 1.85) * 0.88;

    // Carved V-shaped foaming wake & rooster-tail trench directly behind Gateway's Hydro-Board!
    vec2 toHero = vec2(vLocalX - uHeroXZ.x, vWorldPos.z - uHeroXZ.y);
    float wakeV = exp(-pow(abs(toHero.x) - max(0.0, toHero.y) * 0.36, 2.0) * 5.0) *
                  smoothstep(-0.20, 0.40, toHero.y) * smoothstep(6.8, 0.6, toHero.y);
    float wakeCore = exp(-toHero.x * toHero.x * 6.0) * smoothstep(0.0, 0.45, toHero.y) * smoothstep(4.6, 0.5, toHero.y);
    float wakeFoam = (wakeV * 0.90 + wakeCore * 0.62) * (0.65 + cur * 0.52);

    float totalFoam = clamp(crestFoam + bankFoam + wakeFoam, 0.0, 0.95);
    vec3 foamCol = mix(vec3(0.92, 0.99, 1.0), uSunColor, 0.12);
    col = mix(col, foamCol, totalFoam);

    // Exponential atmospheric fog seamlessly matching scene FogExp2 & sky-dome horizon!
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- TRANSLUCENT TURQUOISE-JADE CURLING WAVE-CREST RAMP SHADER (ZERO OPAQUE WHITE BLOB!) ---
const RAPIDS_RAMP_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vec4 wp = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    wp = modelMatrix * wp;
    vWorldPos = wp.xyz;
    vec3 wn = normal;
    #ifdef USE_INSTANCING
      wn = mat3(instanceMatrix) * wn;
    #endif
    vWorldNormal = normalize(mat3(modelMatrix) * wn);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RAPIDS_RAMP_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    // vUv.y runs 0 (rear base) -> 1 (curling launch lip); vUv.x runs 0..1 across width
    float uLat = abs(vUv.x - 0.5) * 2.0;
    float vRun = vUv.y;

    // Smooth edge feathering so the wave melts seamlessly into the turquoise river on ALL sides!
    float edgeAlpha = smoothstep(1.0, 0.56, uLat) * smoothstep(0.0, 0.24, vRun) * smoothstep(1.0, 0.86, vRun);
    if (edgeAlpha < 0.01) discard;

    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Rich sunlit emerald-turquoise liquid body (deep jade at trough -> glowing aqua-teal rising crest)
    float flow = sin(vUv.x * 16.0 + vRun * 14.0 - uTime * 7.5) * 0.5 + 0.5;
    float streak = sin(vUv.x * 28.0 - vRun * 18.0 + uTime * 9.0) * 0.5 + 0.5;
    float rip = flow * 0.6 + streak * 0.4;

    vec3 bodyCol = mix(uDeepColor, uShallowColor, smoothstep(0.08, 0.78, vRun) * 0.85 + rip * 0.15);
    // Crisp sunlight specular sparkle + subtle translucent turquoise rim
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.8);
    bodyCol += uSunColor * spec * 0.85 + vec3(0.18, 0.78, 0.84) * fres * 0.35;

    // Lacy breaking whitewater foam ONLY along the curled crest lip (vRun > 0.72) — NEVER a milky blob!
    float crestBand = smoothstep(0.66, 0.90, vRun + (rip - 0.5) * 0.16);
    float laceNoise = smoothstep(0.32, 0.78, rip);
    float foamMask = crestBand * (0.45 + 0.55 * laceNoise) * smoothstep(0.95, 0.35, uLat);
    vec3 col = mix(bodyCol, vec3(0.94, 0.99, 1.0), foamMask * 0.82);

    float alpha = edgeAlpha * clamp(0.42 + vRun * 0.32 + foamMask * 0.24, 0.0, 0.84);
    gl_FragColor = vec4(col, alpha);
  }
`;

// --- SHARED GLB CACHE & MULTI-PRIMITIVE INSTANCED POOL (60FPS D3D11) ---
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

function normalizeGlbMaterial(mat) {
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
      roughness: typeof mat.roughness === 'number' ? mat.roughness : 0.6,
      metalness: typeof mat.metalness === 'number' ? mat.metalness : 0.05,
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
  if (String(out.name || '').toLowerCase().includes('foliage')) {
    // Soften cliff ledge moss pads to warm earthy canyon-sage so they nestle organically into red Sedona rock!
    out.color.multiply(new THREE.Color('#96a07c'));
    out.roughness = 0.88;
  }
  return out;
}

class GlbInstancedAsset {
  constructor(scene, nodeObj, maxCount) {
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
      const mat = normalizeGlbMaterial(rawMat);
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

// --- PROCEDURAL SOFT SPRITE & WAVE-RAMP TEXTURES (ZERO HARD POLYGONS!) ---
function createSoftRadialMistTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([232, 252, 255, 190]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size * 0.5, size * 0.5, 2, size * 0.5, size * 0.5, size * 0.48);
  g.addColorStop(0.0, 'rgba(244, 254, 255, 0.92)');
  g.addColorStop(0.42, 'rgba(205, 248, 255, 0.52)');
  g.addColorStop(0.78, 'rgba(155, 236, 250, 0.14)');
  g.addColorStop(1.0, 'rgba(155, 236, 250, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVolumetricSunbeamTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([255, 242, 200, 96]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const hg = ctx.createLinearGradient(0, 0, size, 0);
  hg.addColorStop(0.0, 'rgba(255,244,205,0)');
  hg.addColorStop(0.32, 'rgba(255,244,205,0.42)');
  hg.addColorStop(0.50, 'rgba(255,250,226,0.88)');
  hg.addColorStop(0.68, 'rgba(255,244,205,0.42)');
  hg.addColorStop(1.0, 'rgba(255,244,205,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-in';
  const vg = ctx.createLinearGradient(0, 0, 0, size);
  vg.addColorStop(0.0, 'rgba(255,255,255,0)');
  vg.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  vg.addColorStop(0.80, 'rgba(255,255,255,0.35)');
  vg.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildWaveCrestRampGeo() {
  const w = 3.1;
  const len = 3.85;
  const geo = new THREE.PlaneGeometry(w, len, 18, 18);
  geo.rotateX(-Math.PI * 0.5);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cDeep = new THREE.Color('#0c6e82');
  const cMid = new THREE.Color('#28cbd6');
  const cFoam = new THREE.Color('#f4ffff');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const rx = pos.getX(i);
    let rz = pos.getZ(i);
    const u = clamp(Math.abs(rx) / (w * 0.5), 0, 1);
    const v = clamp((len * 0.5 - rz) / len, 0, 1);
    const lat = Math.pow(Math.max(0, 1 - Math.pow(u, 4.0)), 0.58);
    let y = -0.10;
    if (v < 0.84) {
      const t = v / 0.84;
      y = lerp(-0.10, 0.52, Math.pow(t, 1.32)) * lat - (1 - lat) * 0.08;
    } else {
      const t = (v - 0.84) / 0.16;
      y = lerp(0.52, -0.10, t * t) * lat - (1 - lat) * 0.08;
      rz -= Math.sin(t * Math.PI) * 0.18 * lat;
    }
    pos.setXYZ(i, rx, y, rz);
    if (v < 0.38) {
      tmp.copy(cDeep).lerp(cMid, clamp((v / 0.38) * lat, 0, 1));
    } else {
      const f = clamp((v - 0.38) / 0.34, 0, 1);
      tmp.copy(cMid).lerp(cFoam, Math.pow(f, 0.72) * (0.65 + 0.35 * lat));
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildProceduralEnvMap(webgl, topHex = '#38bdf8', horHex = '#f7d59c', gndHex = '#124e62') {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(horHex);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: topHex, side: THREE.BackSide })
    );
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#fff7d6' })
    );
    sun.position.set(10, 12, -10);
    const gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: gndHex, side: THREE.DoubleSide })
    );
    gnd.rotation.x = -Math.PI * 0.5;
    gnd.position.y = -6;
    envScene.add(dome, sun, gnd);
    const rt = pmrem.fromScene(envScene, 0.04);
    dome.geometry.dispose();
    dome.material.dispose();
    sun.geometry.dispose();
    sun.material.dispose();
    gnd.geometry.dispose();
    gnd.material.dispose();
    pmrem.dispose();
    return { rt, texture: rt.texture };
  } catch {
    return null;
  }
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
    this._ownEnvRt = null;
    this._disposed = false;
    this._lastTime = 0;
    this.postfxActive = false;

    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._bankSmooth = 0;
    this._pitchSmooth = 0;
    this._prevOnWater = true;
    this._prevVy = 0;
    this._landCompress = 0;
    this._landSplashT = 0;
    this._landSplashX = 0;
    this._trickPhase = 0;
    this._trickActive = false;
    this._camXSwing = 0;
    this._activeBiome = '';

    this.mistTex = createSoftRadialMistTex(128);
    this.sunbeamTex = createVolumetricSunbeamTex(128);
    this._glbPools = {};
    this._boardGlbMounted = false;

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

  setBlasterFx(fxId) {
    this.blasterFxId = fxId || 'standard_cryo';
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
    this.scene.background = new THREE.Color('#2474b5');
    this.scene.fog = new THREE.FogExp2('#e6c99b', 0.0078);

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

    this.camera = new THREE.PerspectiveCamera(50, this.width / Math.max(1, this.height), 0.2, 260);

    // Warm Golden-Hour Sunlit Canyon Lighting Rig (zero extra PointLight overhead for locked 60fps!)
    this.hemiLight = new THREE.HemisphereLight('#92d8fa', '#46687c', 1.56);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff2d4', 2.55);
    this.sunLight.position.set(22, 28, 12);
    this.sunLight.castShadow = false; // 60fps locked on D3D11
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight('#ffe0a8', 1.32);
    this.rimLight.position.set(-18, 14, 16);
    this.scene.add(this.rimLight);

    // Adaptive 60fps PostFX guard (gracefully bypasses multi-pass bloom on iGPUs if frame time > 16ms)
    this._frameMsEma = 14.0;
    this._lastFrameTs = 0;
    this._bypassPostFx = false;

    // Seamless 3D Sunlit Canyon Sky-Dome (fades smoothly into horizon fog — ZERO flat poster!)
    this.skyDomeMat = new THREE.ShaderMaterial({
      vertexShader: SKY_DOME_VERT,
      fragmentShader: SKY_DOME_FRAG,
      uniforms: {
        uSkyTex: { value: null },
        uHasTex: { value: 0.0 },
        uTopColor: { value: new THREE.Color('#1f70ba') },
        uHorizonColor: { value: new THREE.Color('#f7d59c') },
        uFogColor: { value: new THREE.Color('#e6c99b') },
        uSunColor: { value: new THREE.Color('#fff1d1') },
        uSunDir: { value: new THREE.Vector3(0.32, 0.34, -0.88).normalize() },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(185, 28, 18), this.skyDomeMat);
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    // Wide Reflective Turquoise GLSL Whitewater Canyon River (width 34m, length 152m)
    const riverGeo = new THREE.PlaneGeometry(34, 152, 28, 48);
    riverGeo.rotateX(-Math.PI * 0.5);
    riverGeo.translate(0, 0, -64);
    this.riverMat = new THREE.ShaderMaterial({
      vertexShader: RAPIDS_WATER_VERT,
      fragmentShader: RAPIDS_WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDist: { value: 0 },
        uDeepColor: { value: new THREE.Color('#096d82') },
        uShallowColor: { value: new THREE.Color('#18c8ce') },
        uSkyColor: { value: new THREE.Color('#e8f4fa') },
        uSunColor: { value: new THREE.Color('#fff1d1') },
        uSunDir: { value: new THREE.Vector3(0.38, 0.42, -0.82).normalize() },
        uFogColor: { value: new THREE.Color('#e6c99b') },
        uFogDensity: { value: 0.0078 },
        uHeroXZ: { value: new THREE.Vector2(0, 0) },
      },
      side: THREE.FrontSide,
    });
    this.riverMesh = new THREE.Mesh(riverGeo, this.riverMat);
    this.riverMesh.frustumCulled = false;
    this.scene.add(this.riverMesh);

    // Hero Root (Gateway 2.0 + Sculpted Blender `HydroBoard_Hero`)
    this.heroRoot = new THREE.Group();
    this.hydroBoardHolder = new THREE.Group();
    this.hydroBoardHolder.position.set(0, 0.06, 0.06);
    this.hydroBoardHolder.scale.setScalar(1.16);
    // Minimal temporary placeholder hidden the instant `HydroBoard_Hero` from GLB mounts (~15ms)
    this._boardPlaceholder = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.08, 1.85),
      new THREE.MeshStandardMaterial({ color: '#6b3a1e', roughness: 0.42, metalness: 0.12 })
    );
    this.hydroBoardHolder.add(this._boardPlaceholder);
    this.heroRoot.add(this.hydroBoardHolder);

    this.gatewayMount = new THREE.Group();
    this.gatewayMount.position.set(0, 0.14, 0.04);
    this.gatewayRig = new GatewayRig(this.skinId);
    this.gatewayMount.add(this.gatewayRig.group);
    this.heroRoot.add(this.gatewayMount);

    // Subtle aerial trick halo ring (visible only on big ramp jumps)
    this.trickHaloMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.trickHaloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 8, 28), this.trickHaloMat);
    this.trickHaloMesh.position.set(0, 0.85, 0);
    this.trickHaloMesh.visible = false;
    this.heroRoot.add(this.trickHaloMesh);
    this.scene.add(this.heroRoot);

    // Sculpted Translucent Turquoise-Jade GLSL Curling Wave-Crest Ramps (`sk.ramps`) — ZERO milky-white blobs!
    this.rampMat = new THREE.ShaderMaterial({
      vertexShader: RAPIDS_RAMP_VERT,
      fragmentShader: RAPIDS_RAMP_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color('#07697e') },
        uShallowColor: { value: new THREE.Color('#18cad0') },
        uSunColor: { value: new THREE.Color('#fff2d4') },
        uSunDir: { value: new THREE.Vector3(0.38, 0.42, -0.82).normalize() },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rampInst = new THREE.InstancedMesh(buildWaveCrestRampGeo(), this.rampMat, MAX_RAMPS);
    this.rampInst.frustumCulled = false;
    this.rampInst.renderOrder = 2;
    this.scene.add(this.rampInst);

    // Soft Glowing Boost Gate Shimmer Curtains (paired with Blender `SlalomGate_Arch`)
    this.gateCurtainMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const gateCurtainGeo = new THREE.PlaneGeometry(2.85, 2.75);
    gateCurtainGeo.translate(0, 1.95, 0);
    this.gateCurtainInst = new THREE.InstancedMesh(gateCurtainGeo, this.gateCurtainMat, MAX_GATES);
    this.gateCurtainInst.frustumCulled = false;
    this.scene.add(this.gateCurtainInst);

    // Sparkling Smooth Sea-Glass Water-Pearl Gems suspended inside `SlalomRing_Bronze` (`sk.gears`)
    const seedGeo = new THREE.IcosahedronGeometry(0.24, 1);
    seedGeo.scale(0.92, 1.15, 0.92);
    this.seedInst = new THREE.InstancedMesh(
      seedGeo,
      new THREE.MeshStandardMaterial({
        color: '#e0fcff',
        emissive: '#38bdf8',
        emissiveIntensity: 1.15,
        roughness: 0.10,
        metalness: 0.28,
      }),
      MAX_SEEDS
    );
    this.seedInst.frustumCulled = false;
    this.scene.add(this.seedInst);

    // Hydro-Pulse Bolts fired by Gateway (`sk.bolts`)
    this.boltInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.24, 1),
      new THREE.MeshStandardMaterial({
        color: '#e0fcff',
        emissive: '#22d3ee',
        emissiveIntensity: 1.65,
        roughness: 0.10,
      }),
      MAX_BOLTS
    );
    this.boltInst.frustumCulled = false;
    this.scene.add(this.boltInst);

    // Feathered Whitewater Foam Collars around boulders, gate piers & ramps
    const foamGeo = new THREE.PlaneGeometry(2.15, 2.65);
    foamGeo.rotateX(-Math.PI * 0.5);
    this.pierFoamMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#ecfeff',
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pierFoamInst = new THREE.InstancedMesh(foamGeo, this.pierFoamMat, MAX_GATES * 2 + MAX_HAZARDS + MAX_RAMPS);
    this.pierFoamInst.frustumCulled = false;
    this.scene.add(this.pierFoamInst);

    // Soft Radial-Alpha Whitewater Wake Spray Droplets (`MAX_SPRAY`)
    this.sprayMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#ecfeff',
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sprayInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.32, 0.32), this.sprayMat, MAX_SPRAY);
    this.sprayInst.frustumCulled = false;
    this.scene.add(this.sprayInst);

    // Lightweight 3D World-Space Popup Sprites for Wave Flip & Spire Perk feedback (`opts.popups`)
    this.popupPool = [];
    for (let i = 0; i < MAX_POPUPS; i++) {
      const hasDoc = typeof document !== 'undefined' && typeof document.createElement === 'function';
      const canvas = hasDoc ? document.createElement('canvas') : null;
      if (canvas) {
        canvas.width = 384;
        canvas.height = 64;
      }
      const tex = canvas
        ? new THREE.CanvasTexture(canvas)
        : new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1, THREE.RGBAFormat);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      sp.renderOrder = 25;
      this.scene.add(sp);
      this.popupPool.push({ sp, mat, tex, canvas, ctx: canvas ? canvas.getContext('2d') : null, key: '' });
    }

    // Soft Slanted Golden Sunbeam Shafts through the canyon gorge
    this.sunbeamMat = new THREE.MeshBasicMaterial({
      map: this.sunbeamTex,
      color: '#fff1cc',
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sunbeamInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(6.5, 22.0), this.sunbeamMat, MAX_SUNBEAMS);
    this.sunbeamInst.frustumCulled = false;
    this.scene.add(this.sunbeamInst);

    // Pre-allocate `instanceColor` upfront on `seedInst` to avoid D3D11 mid-run shader recompile
    this._dummy.position.set(0, 0, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(1);
    this._dummy.updateMatrix();
    this._col.set('#5efce8');
    this.seedInst.setMatrixAt(0, this._dummy.matrix);
    this.seedInst.setColorAt(0, this._col);
    this.seedInst.instanceMatrix.needsUpdate = true;
    if (this.seedInst.instanceColor) this.seedInst.instanceColor.needsUpdate = true;
  }

  async _loadGlbKit() {
    const [kitScene, mineScene] = await Promise.all([
      loadCachedGlb('assets/models/env_rapids_gorge.glb'),
      loadCachedGlb('assets/models/sea_mine.glb'),
    ]);
    if (this._disposed) return;

    if (kitScene) {
      const getNode = (name) => kitScene.getObjectByName(name) || null;

      this._glbPools.cliffLeft = new GlbInstancedAsset(this.scene, getNode('CliffBank_Left'), MAX_BANK_SEGS);
      this._glbPools.cliffRight = new GlbInstancedAsset(this.scene, getNode('CliffBank_Right'), MAX_BANK_SEGS);
      this._glbPools.aqueduct = new GlbInstancedAsset(this.scene, getNode('AqueductBridge_High'), MAX_AQUEDUCTS);
      this._glbPools.pier = new GlbInstancedAsset(this.scene, getNode('TimberPier'), MAX_PIERS);
      this._glbPools.boulderA = new GlbInstancedAsset(this.scene, getNode('RiverBoulder_A'), MAX_HAZARDS + MAX_SHORE_BOULDERS);
      this._glbPools.boulderB = new GlbInstancedAsset(this.scene, getNode('RiverBoulder_B'), MAX_HAZARDS + MAX_SHORE_BOULDERS);
      this._glbPools.slalomGate = new GlbInstancedAsset(this.scene, getNode('SlalomGate_Arch'), MAX_GATES);
      this._glbPools.slalomRing = new GlbInstancedAsset(this.scene, getNode('SlalomRing_Bronze'), MAX_SEEDS);
      this._glbPools.supplyBuoy = new GlbInstancedAsset(this.scene, getNode('SupplyBuoy_Pelagian'), MAX_HAZARDS);

      const boardNode = getNode('HydroBoard_Hero');
      if (boardNode && !this._boardGlbMounted) {
        const clone = boardNode.clone(true);
        clone.traverse((o) => {
          if (o.isMesh && o.material) {
            o.material = normalizeGlbMaterial(Array.isArray(o.material) ? o.material[0] : o.material);
            if (o.geometry?.attributes?.color) o.material.vertexColors = true;
          }
        });
        this._boardPlaceholder.visible = false;
        this.hydroBoardHolder.add(clone);
        this._boardGlbMounted = true;
      }
    }

    if (mineScene) {
      this._glbPools.mine = new GlbInstancedAsset(this.scene, mineScene, MAX_HAZARDS);
    }

    this.prewarm();
  }

  _applyBiomeTheme(bKey) {
    const th = BIOME_RAPIDS_THEMES[bKey] || BIOME_RAPIDS_THEMES.canyon_river;
    this.scene.background.set(th.skyTop);
    this.scene.fog.color.set(th.fog);
    this.sunLight.color.set(th.sun);
    this.hemiLight.color.set(th.hemiSky);
    this.hemiLight.groundColor.set(th.hemiGnd);
    this.sunbeamMat.color.set(th.sun);

    const su = this.skyDomeMat.uniforms;
    su.uTopColor.value.set(th.skyTop);
    su.uHorizonColor.value.set(th.skyHor);
    su.uFogColor.value.set(th.fog);
    su.uSunColor.value.set(th.sun);

    const wu = this.riverMat.uniforms;
    wu.uDeepColor.value.set(th.waterDeep);
    wu.uShallowColor.value.set(th.waterShallow);
    wu.uSkyColor.value.set(th.waterSky);
    wu.uSunColor.value.set(th.sun);
    wu.uFogColor.value.set(th.fog);

    if (this._activeBiome !== bKey) {
      this._activeBiome = bKey;
      loadCachedTex(th.skybox, true, (tex) => {
        if (this._disposed || this._activeBiome !== bKey) return;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        this.skyDomeMat.uniforms.uSkyTex.value = tex;
        this.skyDomeMat.uniforms.uHasTex.value = 1.0;
      });
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

    if (opts?.envMap && this.scene.environment !== opts.envMap) {
      this.scene.environment = opts.envMap;
      this.scene.environmentIntensity = 0.90;
    }

    const rawTheme = String(opts?.biomeKey || opts?.biome || sk.biome || state.tower?.theme || 'canyon_river').toLowerCase();
    const bKey = rawTheme.includes('coral')
      ? 'coral_sea'
      : rawTheme.includes('alpine') || rawTheme.includes('lake')
      ? 'alpine_lake'
      : rawTheme.includes('bayou')
      ? 'mist_bayou'
      : rawTheme.includes('storm') || rawTheme.includes('ocean')
      ? 'storm_ocean'
      : 'canyon_river';
    this._applyBiomeTheme(bKey);

    const dist = Number(sk.distance) || time * 18;
    const boostMult = Math.max(1, Number(sk.boostMult) || 1);
    const laneX = Number(sk.laneX) || 0;
    const rawY = Math.max(0, Number(sk.y) || 0);
    const onWater = Boolean(sk.onWater ?? rawY < 0.25);

    // Exact wave height matching RAPIDS_WATER_VERT
    const zFlow = -dist;
    const w1 = zFlow * 0.42 + laneX * 0.36 + time * 2.3;
    const w2 = zFlow * 0.84 - laneX * 0.62 + time * 3.2;
    const w3 = zFlow * 1.44 + laneX * 1.08 - time * 4.1;
    const w4 = laneX * 0.82 - zFlow * 0.54 + time * 2.6;
    const waveH = Math.sin(w1) * 0.10 + Math.cos(w2) * 0.06 + Math.sin(w3) * 0.032 + Math.cos(w4) * 0.026;
    const dhDz = Math.cos(w1) * 0.042 - Math.sin(w2) * 0.050 + Math.cos(w3) * 0.046 + Math.sin(w4) * 0.014;
    const dhDx = Math.cos(w1) * 0.036 + Math.sin(w2) * 0.037 + Math.cos(w3) * 0.035 - Math.sin(w4) * 0.021;

    // Drive 360° trick-flip & halo strictly from `sk.trickFlipTimer` (NOT plain hops!) + clean landing splash
    const flipTimer = Math.max(0, Number(sk.trickFlipTimer) || 0);
    if (flipTimer > 0.01) {
      this._trickActive = true;
      this._trickPhase = clamp(1.0 - flipTimer / 0.65, 0, 1);
    } else {
      this._trickActive = false;
      this._trickPhase = 0;
    }
    if (!this._prevOnWater && onWater) {
      const impact = clamp(0.45 + Math.abs(this._prevVy) * 0.08, 0.45, 0.95);
      this._landCompress = Math.max(this._landCompress, impact);
      this._landSplashT = 1.0;
      this._landSplashX = laneX;
    }
    this._prevOnWater = onWater;
    this._prevVy = Number(sk.vy) || 0;
    this._landCompress *= Math.exp(-8.2 * dt);
    if (this._landCompress < 0.004) this._landCompress = 0;
    if (this._landSplashT > 0) this._landSplashT = Math.max(0, this._landSplashT - dt * 1.75);

    const waveRideY = onWater ? waveH * 0.55 - this._landCompress * 0.12 : 0;
    const heroY = rawY + waveRideY + Math.sin(time * 8.0) * 0.02;
    const rawBank = clamp((Number(sk.vx) || 0) / 8.0, -1, 1);
    this._bankSmooth += (rawBank - this._bankSmooth) * (1 - Math.exp(-11.0 * dt));
    const bank = this._bankSmooth;

    const wantPitch = onWater
      ? clamp(-dhDz * 1.15, -0.18, 0.18) + Math.abs(bank) * 0.06
      : clamp((sk.vy || 0) * 0.045, -0.24, 0.28);
    this._pitchSmooth += (wantPitch - this._pitchSmooth) * (1 - Math.exp(-10.5 * dt));

    // Update GLSL reflective whitewater rapids & translucent wave-ramp uniforms
    const wu = this.riverMat.uniforms;
    wu.uTime.value = time;
    wu.uDist.value = dist;
    wu.uHeroXZ.value.set(laneX, 0);
    if (this.rampMat?.uniforms) {
      this.rampMat.uniforms.uTime.value = time;
      this.rampMat.uniforms.uDeepColor.value.copy(wu.uDeepColor.value);
      this.rampMat.uniforms.uShallowColor.value.copy(wu.uShallowColor.value);
      this.rampMat.uniforms.uSunColor.value.copy(wu.uSunColor.value);
    }

    const dm = this._dummy;

    // 1. Modular Stepped Sedona Cliff Banks strictly outside |x| >= 11.8m (wide >= 23.6m sunlit river!)
    if (this._glbPools.cliffLeft && this._glbPools.cliffRight) {
      for (let i = 0; i < MAX_BANK_SEGS; i++) {
        const wrappedZ = (((i * BANK_STEP_Z + dist) % BANK_SPAN_Z) + BANK_SPAN_Z) % BANK_SPAN_Z;
        const segZ = 9.0 - wrappedZ;
        const cx = gorgeCurveX(segZ, dist);
        const cyaw = gorgeCurveYaw(segZ, dist);
        const yScale = 0.94 + (i % 3) * 0.10;

        // Positive scale ONLY (never negative Z scale, which flips normals inside-out!)
        dm.position.set(cx - 12.2 - (i % 3) * 0.28, 0.0, segZ);
        dm.rotation.set(0, cyaw, 0);
        dm.scale.set(1.0, yScale, 1.0);
        dm.updateMatrix();
        this._glbPools.cliffLeft.setMatrixAt(i, dm.matrix);

        dm.position.set(cx + 12.2 + ((i + 1) % 3) * 0.28, 0.0, segZ);
        dm.rotation.set(0, cyaw, 0);
        dm.scale.set(1.0, 0.96 + ((i + 1) % 3) * 0.09, 1.0);
        dm.updateMatrix();
        this._glbPools.cliffRight.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.cliffLeft.commit(MAX_BANK_SEGS);
      this._glbPools.cliffRight.commit(MAX_BANK_SEGS);
    }

    // 2. High Overhanging Pelagian Stone Aqueduct Bridges (clear underside y >= 9.2m!)
    if (this._glbPools.aqueduct) {
      const aqSpan = 144.0;
      const aqStep = aqSpan / MAX_AQUEDUCTS;
      for (let i = 0; i < MAX_AQUEDUCTS; i++) {
        const wrappedZ = (((i * aqStep + dist + 14.0) % aqSpan) + aqSpan) % aqSpan;
        const az = -6.0 - wrappedZ;
        const ax = gorgeCurveX(az, dist);
        const ayaw = gorgeCurveYaw(az, dist);
        dm.position.set(ax, 0.0, az);
        dm.rotation.set(0, ayaw, 0);
        dm.scale.set(1.04, 1.0, 1.0);
        dm.updateMatrix();
        this._glbPools.aqueduct.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.aqueduct.commit(MAX_AQUEDUCTS);
    }

    // 3. Weathered Redwood Timber Riverbank Piers (`|x| = 10.6m` safely outside all gameplay lanes)
    if (this._glbPools.pier) {
      const pSpan = 132.0;
      const pStep = pSpan / MAX_PIERS;
      for (let i = 0; i < MAX_PIERS; i++) {
        const wrappedZ = (((i * pStep + dist + 6.0) % pSpan) + pSpan) % pSpan;
        const pz = -3.0 - wrappedZ;
        const side = i % 2 === 0 ? -1 : 1;
        const px = gorgeCurveX(pz, dist) + side * 10.6;
        const pyaw = gorgeCurveYaw(pz, dist) + (side > 0 ? Math.PI : 0);
        dm.position.set(px, 0.0, pz);
        dm.rotation.set(0, pyaw, 0);
        dm.scale.setScalar(1.05);
        dm.updateMatrix();
        this._glbPools.pier.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.pier.commit(MAX_PIERS);
    }

    // 4. Volumetric Slanted Golden Canyon Sunbeams
    const beamSpan = 108.0;
    const beamStep = beamSpan / MAX_SUNBEAMS;
    for (let i = 0; i < MAX_SUNBEAMS; i++) {
      const wrappedZ = (((i * beamStep + dist * 0.85) % beamSpan) + beamSpan) % beamSpan;
      const bz = -10.0 - wrappedZ;
      const bx = gorgeCurveX(bz, dist) + (i % 2 === 0 ? -3.4 : 3.6);
      dm.position.set(bx, 9.2, bz);
      dm.rotation.set(0, 0.06, -0.34);
      dm.scale.set(1.0 + (i % 3) * 0.22, 1.0, 1.0);
      dm.updateMatrix();
      this.sunbeamInst.setMatrixAt(i, dm.matrix);
    }
    this.sunbeamInst.count = MAX_SUNBEAMS;
    this.sunbeamInst.instanceMatrix.needsUpdate = true;

    // 5. Gateway 2.0 Heroic Upright Carving Pose atop `HydroBoard_Hero`
    const trickSpin = this._trickActive ? Math.sin(this._trickPhase * Math.PI * 0.5) * TAU : 0;
    const airGrab = this._trickActive ? Math.sin(this._trickPhase * Math.PI) : 0;
    this.heroRoot.position.set(laneX, heroY, 0);
    this.heroRoot.rotation.set(this._pitchSmooth, -bank * 0.22, -bank * 0.34 + clamp(-dhDx * 0.65, -0.14, 0.14));
    this.hydroBoardHolder.rotation.set(airGrab * 0.18, trickSpin * 0.5, 0);

    // Gateway stands upright facing downriver (-Z) in athletic 3/4 surfer stance (NEVER face-planted!)
    this.gatewayMount.rotation.order = 'YXZ';
    this.gatewayMount.rotation.set(-0.04, Math.PI + 0.42 + bank * 0.26 + trickSpin, -bank * 0.14);
    this.gatewayRig.update(dt, {
      time,
      vx: sk.vx || 0,
      vy: sk.vy || 0,
      onGround: onWater,
      surfing: onWater,
      rapidsSurf: onWater,
      anim: !onWater ? 'AirRise' : 'RapidsSurf',
      mood: this._trickActive || boostMult >= 3 ? 'joyful' : 'happy',
      surfBank: bank * 0.75,
      landSquash: onWater ? clamp(0.18 + this._landCompress * 0.35, 0, 0.65) : 0.0,
      frillFlare: 0.42 + (boostMult - 1) * 0.18 + Math.abs(bank) * 0.18 + airGrab * 0.35,
    });

    this.trickHaloMesh.visible = airGrab > 0.05;
    if (this.trickHaloMesh.visible) {
      this.trickHaloMat.opacity = airGrab * 0.82;
      this.trickHaloMesh.scale.setScalar(0.85 + airGrab * 0.65);
      this.trickHaloMesh.rotation.set(Math.PI * 0.44, trickSpin, time * 5.0);
    }

    // 6. Carved Bronze-and-Sandstone Pelagian Slalom Boost Gates (`sk.gates`) + Waterline Foam
    // Keep stone/bronze arches visible as Gateway surfs THROUGH them (wz <= 4.2); only dissipate shimmer curtain on hit!
    const gates = sk.gates || [];
    const tierCol = BOOST_TIER_COLORS[Math.min(3, boostMult - 1)];
    this.gateCurtainMat.color.set(tierCol.curtain);
    let gCnt = 0;
    let gcCnt = 0;
    let pfCnt = 0;
    const pfMax = this.pierFoamInst.instanceMatrix.count;
    for (let i = 0; i < gates.length && gCnt < MAX_GATES; i++) {
      const gt = gates[i];
      const wz = resolveItemWorldZ(gt.z, dist);
      if (wz > 4.2 || wz < -118) continue;
      const gx = (gt.laneX || 0) + gorgeCurveX(wz, dist);
      const gyaw = gorgeCurveYaw(wz, dist);
      dm.position.set(gx, 0.0, wz);
      dm.rotation.set(0, gyaw, 0);
      dm.scale.setScalar(1.0);
      dm.updateMatrix();
      this._glbPools.slalomGate?.setMatrixAt(gCnt++, dm.matrix);
      if (!gt.hit && gcCnt < MAX_GATES) {
        this.gateCurtainInst.setMatrixAt(gcCnt++, dm.matrix);
      }

      for (const side of [-1.82, 1.82]) {
        if (pfCnt < pfMax) {
          const pulse = 0.94 + Math.sin(time * 4.5 + i + side) * 0.08;
          dm.position.set(gx + side, 0.05, wz + 0.35);
          dm.rotation.set(0, 0, 0);
          dm.scale.set(0.95 * pulse, 1, 1.15 * pulse);
          dm.updateMatrix();
          this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
        }
      }
    }
    this._glbPools.slalomGate?.commit(gCnt);
    this.gateCurtainInst.count = gcCnt;
    if (gcCnt > 0) this.gateCurtainInst.instanceMatrix.needsUpdate = true;

    // 7. Sculpted Translucent Foaming River Wave-Crest Ramps (`sk.ramps`)
    const ramps = sk.ramps || [];
    let rCnt = 0;
    for (let i = 0; i < ramps.length && rCnt < MAX_RAMPS; i++) {
      const rp = ramps[i];
      const wz = resolveItemWorldZ(rp.z, dist);
      if (wz > 1.8 || wz < -118) continue;
      const rx = (rp.laneX || 0) + gorgeCurveX(wz, dist);
      const ryaw = gorgeCurveYaw(wz, dist);
      const surge = 1.0 + Math.sin(time * 4.2 + i) * 0.04;
      dm.position.set(rx, 0.04, wz);
      dm.rotation.set(0, ryaw, 0);
      dm.scale.set(1.0, surge, 1.0);
      dm.updateMatrix();
      this.rampInst.setMatrixAt(rCnt++, dm.matrix);
      if (pfCnt < pfMax) {
        dm.position.set(rx, 0.05, wz + 0.45);
        dm.rotation.set(0, 0, 0);
        dm.scale.set(1.85, 1, 1.65);
        dm.updateMatrix();
        this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
      }
    }
    this.rampInst.count = rCnt;
    if (rCnt > 0) this.rampInst.instanceMatrix.needsUpdate = true;

    // 8. Gameplay Hazards (Mossy Boulders, Sculpted Supply Buoys, Siphon Mines) + Shoreline Boulders
    const hazards = sk.hazards || [];
    let bACnt = 0;
    let bBCnt = 0;
    let cCnt = 0;
    let mCnt = 0;
    for (let i = 0; i < hazards.length; i++) {
      const hz = hazards[i];
      const wz = resolveItemWorldZ(hz.z, dist);
      if (wz > 1.6 || wz < -118) continue;
      const hx = (hz.laneX || 0) + gorgeCurveX(wz, dist);
      if (hz.type === 'mine' && mCnt < MAX_HAZARDS) {
        dm.position.set(hx, 0.44 + Math.sin(time * 3.4 + i) * 0.09, wz);
        dm.rotation.set(Math.sin(time * 2.0 + i) * 0.12, time * 0.8 + i, Math.cos(time * 1.8 + i) * 0.12);
        dm.scale.setScalar(0.62);
        dm.updateMatrix();
        this._glbPools.mine?.setMatrixAt(mCnt++, dm.matrix);
      } else if (hz.type === 'crate' && cCnt < MAX_HAZARDS) {
        dm.position.set(hx, 0.22 + Math.sin(time * 3.2 + i) * 0.08, wz);
        dm.rotation.set(Math.sin(time * 2.2 + i) * 0.07, time * 0.75 + i, Math.cos(time * 2.0 + i) * 0.07);
        dm.scale.setScalar(1.05);
        dm.updateMatrix();
        this._glbPools.supplyBuoy?.setMatrixAt(cCnt++, dm.matrix);
      } else {
        dm.position.set(hx, 0.02, wz);
        dm.rotation.set(0, i * 1.7, 0);
        dm.scale.setScalar(0.92);
        dm.updateMatrix();
        if (i % 2 === 0 && bACnt < MAX_HAZARDS) {
          this._glbPools.boulderA?.setMatrixAt(bACnt++, dm.matrix);
        } else if (bBCnt < MAX_HAZARDS) {
          this._glbPools.boulderB?.setMatrixAt(bBCnt++, dm.matrix);
        }
        if (pfCnt < pfMax) {
          const bp = 0.92 + Math.sin(time * 4.8 + i) * 0.08;
          dm.position.set(hx, 0.05, wz + 0.35);
          dm.rotation.set(0, 0, 0);
          dm.scale.set(1.25 * bp, 1, 1.38 * bp);
          dm.updateMatrix();
          this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
        }
      }
    }

    // Add scenic mossy shoreline boulders hugging the canyon cliff base (`|x| ~ 9.8..10.8m`)
    const sbStep = BANK_SPAN_Z / MAX_SHORE_BOULDERS;
    for (let i = 0; i < MAX_SHORE_BOULDERS; i++) {
      const wrappedZ = (((i * sbStep + dist + 3.0) % BANK_SPAN_Z) + BANK_SPAN_Z) % BANK_SPAN_Z;
      const bz = 4.0 - wrappedZ;
      const side = i % 2 === 0 ? -1 : 1;
      const bx = gorgeCurveX(bz, dist) + side * (9.9 + (i % 3) * 0.45);
      dm.position.set(bx, -0.05, bz);
      dm.rotation.set(0, i * 1.23, 0);
      dm.scale.setScalar(1.15 + (i % 3) * 0.25);
      dm.updateMatrix();
      if (i % 2 === 0) this._glbPools.boulderA?.setMatrixAt(bACnt++, dm.matrix);
      else this._glbPools.boulderB?.setMatrixAt(bBCnt++, dm.matrix);
    }
    this._glbPools.boulderA?.commit(bACnt);
    this._glbPools.boulderB?.commit(bBCnt);
    this._glbPools.supplyBuoy?.commit(cCnt);
    this._glbPools.mine?.commit(mCnt);

    this.pierFoamInst.count = pfCnt;
    if (pfCnt > 0) this.pierFoamInst.instanceMatrix.needsUpdate = true;

    // 9. Chunky 3D Antique-Bronze & Crystal `SlalomRing_Bronze` + Center Gem (`sk.gears`)
    const seeds = sk.gears || [];
    let sCnt = 0;
    for (let i = 0; i < seeds.length && sCnt < MAX_SEEDS; i++) {
      const g = seeds[i];
      if (g.collected) continue;
      const wz = resolveItemWorldZ(g.z, dist);
      if (wz > -0.55 || wz < -116) continue;
      const nearFade = wz > -1.35 ? clamp((-0.55 - wz) / 0.80, 0.08, 1.0) : 1.0;
      const gx = (g.laneX || 0) + gorgeCurveX(wz, dist);
      const gyaw = gorgeCurveYaw(wz, dist);
      const gy = Math.max(1.08, (g.y ?? 0.65) + 0.55) + Math.sin(time * 4.0 + i) * 0.08;

      dm.position.set(gx, gy, wz);
      dm.rotation.set(0, gyaw, time * 1.2 + i);
      dm.scale.setScalar(1.05 * nearFade);
      dm.updateMatrix();
      this._glbPools.slalomRing?.setMatrixAt(sCnt, dm.matrix);

      dm.position.set(gx, gy, wz);
      dm.rotation.set(0.2, time * 3.0 + i, 0.15);
      dm.scale.setScalar(0.95 * nearFade);
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#5efce8' : '#fde047');
      this.seedInst.setColorAt(sCnt, this._col);
      this.seedInst.setMatrixAt(sCnt++, dm.matrix);
    }
    this._glbPools.slalomRing?.commit(sCnt);
    this.seedInst.count = sCnt;
    if (sCnt > 0) {
      this.seedInst.instanceMatrix.needsUpdate = true;
      if (this.seedInst.instanceColor) this.seedInst.instanceColor.needsUpdate = true;
    }

    // 10. Hydro-Pulse Bolts (`sk.bolts`)
    const bolts = sk.bolts || [];
    let bltCnt = 0;
    for (let i = 0; i < bolts.length && bltCnt < MAX_BOLTS; i++) {
      const b = bolts[i];
      const wz = resolveItemWorldZ(b.z, dist);
      if (wz > -0.35 || wz < -116) continue;
      const bx = (b.laneX || 0) + gorgeCurveX(wz, dist);
      dm.position.set(bx, (b.y ?? 0.55) + 0.30, wz);
      dm.rotation.set(time * 8, time * 10, 0);
      dm.scale.setScalar(1.0);
      dm.updateMatrix();
      this.boltInst.setMatrixAt(bltCnt++, dm.matrix);
    }
    this.boltInst.count = bltCnt;
    if (bltCnt > 0) this.boltInst.instanceMatrix.needsUpdate = true;

    // 11. Sleek Rooster-Tail Spray Mist & Landing Splash Crown
    let spCnt = 0;
    const absBank = Math.abs(bank);
    const carveRail = bank >= 0 ? 1 : -1;
    const wakeQuota = this._landSplashT > 0.02 ? 68 : MAX_SPRAY;
    for (let i = 0; i < wakeQuota && spCnt < MAX_SPRAY; i++) {
      const age = (time * (3.1 + boostMult * 0.4 + absBank * 0.5) + i * 0.071) % 1;
      const isCarve = absBank > 0.06 && i % 4 !== 0;
      const side = isCarve ? carveRail : i % 2 === 0 ? -1 : 1;
      const spread = 0.18 + age * (0.58 + absBank * 0.85);
      const arcX = (side * spread - bank * 0.40 * age) * (0.78 + (i % 5) * 0.09);
      const lift = isCarve ? 0.34 + absBank * 0.65 : 0.24;
      const sy = heroY + 0.06 + Math.sin(age * Math.PI) * lift * (0.76 + (i % 3) * 0.14);
      const sz = (isCarve ? 0.62 : 0.96) + age * (3.2 + absBank * 0.9);
      const puff = Math.sin(age * Math.PI) * (0.42 + age * 0.58) * (rawY < 0.4 ? 1.0 : 0.18);
      dm.position.set(laneX + arcX, sy, sz);
      dm.rotation.set(0, 0, i * 0.7 + time * 1.5 * side);
      dm.scale.setScalar(Math.max(0.001, puff));
      dm.updateMatrix();
      this.sprayInst.setMatrixAt(spCnt++, dm.matrix);
    }
    if (this._landSplashT > 0.02) {
      const spProg = 1 - this._landSplashT;
      const splashN = MAX_SPRAY - spCnt;
      for (let i = 0; i < splashN; i++) {
        const ang = (i / Math.max(1, splashN)) * TAU;
        const rad = 0.42 + spProg * 1.8;
        dm.position.set(
          this._landSplashX + Math.cos(ang) * rad,
          0.12 + Math.sin(spProg * Math.PI) * 0.85,
          0.25 + Math.sin(ang) * rad + spProg * 1.4
        );
        dm.rotation.set(0, 0, ang + time * 2.2);
        dm.scale.setScalar(Math.max(0.001, Math.sin(spProg * Math.PI) * 0.82));
        dm.updateMatrix();
        this.sprayInst.setMatrixAt(spCnt++, dm.matrix);
      }
    }
    this.sprayInst.count = spCnt;
    this.sprayInst.instanceMatrix.needsUpdate = true;

    // 11b. World-Space Popups (`opts.popups || state.popups`) for Wave Flip & Spire Perks
    const popups = opts?.popups || state?.popups || [];
    for (let i = 0; i < this.popupPool.length; i++) {
      const slot = this.popupPool[i];
      const p = popups[i];
      if (!p || !p.text || !slot.ctx) {
        slot.sp.visible = false;
        continue;
      }
      const col = p.color || '#fde047';
      const key = `${p.text}|${col}`;
      if (slot.key !== key) {
        slot.key = key;
        const ctx = slot.ctx;
        const label = String(p.text);
        const fontSize = label.length > 22 ? 20 : 25;
        ctx.clearRect(0, 0, 384, 64);
        ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(4, 24, 38, 0.90)';
        ctx.strokeText(label, 192, 32, 360);
        ctx.fillStyle = col;
        ctx.fillText(label, 192, 32, 360);
        slot.tex.needsUpdate = true;
      }
      const lifeRatio = clamp((p.life ?? 0.6) / Math.max(0.01, p.maxLife ?? 0.9), 0, 1);
      const isPort = this.width / Math.max(1, this.height) < 0.85;
      const spW = isPort ? 2.25 : 3.4;
      slot.sp.visible = lifeRatio > 0.02;
      slot.sp.position.set(clamp(laneX, -1.6, 1.6), heroY + 2.15 + (1 - lifeRatio) * 1.15 + i * 0.45, -0.4);
      slot.sp.scale.set(spW, spW * 0.167, 1);
      slot.mat.opacity = Math.min(1, lifeRatio * 1.8);
    }

    // 12. Heroic Unobstructed Chase Camera Following `gorgeCurveX(camZ)` (Gateway large at lower-center!)
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const wantFov = (portrait ? 56 : 48) + (boostMult - 1) * 2.5 + (this._trickActive ? 3.5 : 0);
    if (Math.abs(this.camera.fov - wantFov) > 0.1) {
      this.camera.fov = lerp(this.camera.fov, wantFov, 0.12);
      this.camera.updateProjectionMatrix();
    }
    this.gatewayMount.scale.setScalar(portrait ? 1.32 : 1.24);

    const sh = Number(state.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 69) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 57) * sh * 0.02 : 0;
    const wantSwing = -bank * (portrait ? 0.36 : 0.48);
    this._camXSwing += (wantSwing - this._camXSwing) * (1 - Math.exp(-5.5 * dt));

    const camZ = portrait ? 6.65 : 6.45;
    const camY = (portrait ? 3.18 : 2.94) + heroY * 0.40;
    const camX = gorgeCurveX(camZ, dist) + laneX * (portrait ? 0.68 : 0.58) + this._camXSwing;
    this.camera.position.set(camX + sx, camY + sy, camZ);
    const lookCurve = gorgeCurveX(-20.0, dist) * 0.40;
    this.camera.lookAt(laneX * (portrait ? 0.78 : 0.72) + lookCurve, 1.18 + heroY * 0.28, -16.0);

    // Keep 3D sky-dome centered on camera
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
        exposure: 1.06,
        bloomThreshold: 0.82,
        bloomStrength: 0.28,
        bloomRadius: 0.38,
      });
    } else {
      this.postfxActive = false;
      const prevTone = this.webgl.toneMapping;
      const prevExp = this.webgl.toneMappingExposure;
      try {
        this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
        this.webgl.toneMappingExposure = 1.06;
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
    this.mistTex?.dispose();
    this.sunbeamTex?.dispose();
    for (const pool of Object.values(this._glbPools)) {
      pool?.dispose?.();
    }
    this._glbPools = {};
    for (const slot of this.popupPool || []) {
      slot.tex?.dispose?.();
      slot.mat?.dispose?.();
    }
    this.popupPool = [];
  }
}

export { SkimmerRenderer as RapidsSurfRenderer };
export default SkimmerRenderer;
