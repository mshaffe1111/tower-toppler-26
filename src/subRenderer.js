// TOWERING WATERS: GATEWAY'S DESCENT — REEF FREE-SWIM 3D RENDERER (`src/subRenderer.js`)
//
// Blender-First Stylized Underwater Pelagian Reef Grotto (`assets/models/env_reef_grotto.glb`):
//   - 100% SUBMARINE-FREE: Gateway 2.0 swims large & expressive in left-center foreground
//     with sleek horizontal dolphin-kick undulation & streaming tail (ZERO scorpion curl!).
//   - ZERO flat 2D aquarium poster (`mg_bg_reef_swim.webp` deleted!), ZERO horizontal cut seam,
//     ZERO flat cardboard coral/kelp cutouts, ZERO wireframe hoops!
//   - Seamless deep-turquoise underwater 3D depth-gradient sphere matching `THREE.FogExp2`,
//     overhead animated GLSL sunlit Snell's-window water surface ceiling + 12 slanted golden-aqua
//     volumetric god-rays, AND live world-space animated GLSL sunlit caustics projected across
//     the 3D sandy seabed dunes & sunken Pelagian limestone ruins!
//   - Crisp translucent iridescent Fresnel rescue bubbles around `sea_turtle.glb` & `river_otter.glb`,
//     chunky 3D antique-bronze & aqua crystal `HydroRing_Reef` boost rings, real 3D sculpted coral
//     gardens (`Coral_Staghorn`, `Coral_Table`, `Coral_BrainDome`, `Coral_Anemone`), swaying 3D
//     `Kelp_Cluster` fronds, `SunkenAmphora`, `SunkenColumn_A/B`, and vaulted `GrottoArch_Vault`!

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GatewayRig } from './gateway.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 46;
const CAM_Z = 9.6;

const MAX_FISH = 72;
const MAX_AMB = 24;
const MAX_BUBBLE_SHELLS = 72;
const MAX_PULSES = 18;
const MAX_JELLY = 16;
const MAX_MINES = 16;
const MAX_CHAINS = 140;
const MAX_CLAMS = 8;
const MAX_VENTS = 8;
const MAX_CAGES = 8;
const MAX_RAYS = 7;
const MAX_RINGS = 24;
const MAX_PARTICLES = 240;
const MAX_POPUPS = 16;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

const BIOME_UNDERWATER_PALETTES = {
  coral_sea: {
    zenith: '#52e4f0',
    horizon: '#0a7496',
    abyss: '#043652',
    fog: '#0a7496',
    sun: '#fff4d4',
    ray: '#aef8ff',
    caustic: '#7af4f8',
  },
  canyon_river: {
    zenith: '#4cdcc8',
    horizon: '#0c6870',
    abyss: '#05333d',
    fog: '#0c6870',
    sun: '#fff0c8',
    ray: '#a8f8e8',
    caustic: '#88f4dc',
  },
  alpine_lake: {
    zenith: '#5cd4ff',
    horizon: '#09649c',
    abyss: '#052f58',
    fog: '#09649c',
    sun: '#f0f8ff',
    ray: '#c0ebff',
    caustic: '#90e4ff',
  },
  mist_bayou: {
    zenith: '#4cd4a8',
    horizon: '#0b6058',
    abyss: '#042d2d',
    fog: '#0b6058',
    sun: '#ffe8b8',
    ray: '#90f4d4',
    caustic: '#7cf0c4',
  },
  storm_ocean: {
    zenith: '#3abce0',
    horizon: '#074e78',
    abyss: '#03233c',
    fog: '#074e78',
    sun: '#d4f2ff',
    ray: '#82ebff',
    caustic: '#64e6f8',
  },
};

// --- SEAMLESS 3D UNDERWATER DEPTH-GRADIENT SPHERE (ZERO HORIZONTAL SEAM, ZERO 2D POSTER!) ---
const UNDERWATER_DOME_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const UNDERWATER_DOME_FRAG = /* glsl */ `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uAbyssColor;
  uniform vec3 uSunColor;
  uniform float uTime;
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 col = y >= 0.0
      ? mix(uHorizonColor, uZenithColor, pow(clamp(y, 0.0, 1.0), 0.72))
      : mix(uHorizonColor, uAbyssColor, pow(clamp(-y, 0.0, 1.0), 0.78));

    // Soft overhead Snell's-window sunlit glow blooming into the upper water column
    float zenithGlow = pow(max(0.0, y), 3.2);
    float shimmer = 0.92 + 0.08 * sin(d.x * 14.0 + uTime * 1.4) * cos(d.z * 12.0 - uTime * 1.1);
    col += uSunColor * zenithGlow * 0.36 * shimmer;

    // Horizon seamlessly locks to uHorizonColor === scene.fog.color so distant arches dissolve cleanly!
    float horLock = exp(-y * y * 18.0);
    col = mix(col, uHorizonColor, horLock * 0.55);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- ANIMATED OVERHEAD SHIMMERING SUNLIT WATER SURFACE CEILING (SNELL'S WINDOW SHADER!) ---
const WATER_CEILING_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(p.x * 0.35 + uTime * 1.8) * 0.24 + cos(p.y * 0.42 - uTime * 1.4) * 0.18;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WATER_CEILING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uSunColor;
  uniform vec3 uZenithColor;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  float causticPattern(vec2 p, float t) {
    vec2 a = p * 0.55 + vec2(t * 0.28, -t * 0.19);
    vec2 b = p * 0.72 + vec2(-t * 0.24, t * 0.31);
    float w1 = sin(a.x + sin(a.y * 1.3 + t)) * cos(a.y + cos(a.x * 1.2 - t * 0.8));
    float w2 = sin(b.x * 1.4 - b.y + t * 1.1) * cos(b.y * 1.3 + b.x - t * 0.9);
    float c = abs(w1 + w2) * 0.5;
    return pow(clamp(1.0 - c * 1.35, 0.0, 1.0), 2.4);
  }

  void main() {
    vec2 uvCentered = vUv * 2.0 - 1.0;
    // Soft radial & border fade to 0.0 alpha -> GUARANTEES ZERO hard edge or horizontal seam!
    float edgeFade = smoothstep(1.0, 0.28, abs(uvCentered.x)) * smoothstep(1.0, 0.24, abs(uvCentered.y));
    if (edgeFade <= 0.002) discard;

    vec2 wp = vec2(vWorldPos.x + uScroll * 0.025, vWorldPos.z);
    float rip = causticPattern(wp * 0.55, uTime);
    float rip2 = causticPattern(wp * 0.95 + vec2(3.1, 1.7), -uTime * 0.85);
    float glow = clamp(rip * 0.72 + rip2 * 0.55, 0.0, 1.0);

    vec3 col = mix(uZenithColor, uSunColor, glow * 0.72);
    float alpha = edgeFade * (0.20 + glow * 0.56);
    gl_FragColor = vec4(col, alpha);
  }
`;

// --- CRISP TRANSLUCENT IRIDESCENT FRESNEL RESCUE BUBBLE SHADER (ZERO WIREFRAME HOOPS!) ---
const RESCUE_BUBBLE_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec3 p = position;
    float wob = sin(p.y * 5.0 + uTime * 3.8) * cos(p.x * 4.5 - uTime * 3.1) * 0.022;
    p += normal * wob;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RESCUE_BUBBLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uRimColorA;
  uniform vec3 uRimColorB;
  varying vec3 vNormalW;
  varying vec3 vViewDir;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewDir);
    float ndotv = abs(dot(N, V));
    float fresnel = pow(1.0 - ndotv, 2.35);

    // Subtle soap-bubble iridescence shifting between luminous aqua & warm sunlit gold-pearl
    float irid = 0.5 + 0.5 * sin(ndotv * 7.5 + N.y * 3.2 + uTime * 2.2);
    vec3 rimCol = mix(uRimColorA, uRimColorB, irid * 0.55);

    // Dual crisp sunlit catchlights on upper-right & lower-left bubble skin
    vec3 L1 = normalize(vec3(0.42, 0.78, 0.55));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), 64.0) * 1.45;
    vec3 L2 = normalize(vec3(-0.55, -0.35, 0.65));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(dot(N, H2), 0.0), 28.0) * 0.40;

    vec3 col = rimCol * (0.45 + fresnel * 1.35) + vec3(1.0, 0.99, 0.95) * (spec1 + spec2);
    // Crystal-clear center (alpha ~ 0.09) so the cute turtle/otter shines cleanly inside, crisp rim (alpha ~ 0.85)!
    float alpha = clamp(0.08 + fresnel * 0.78 + spec1 * 0.65, 0.0, 0.94);
    gl_FragColor = vec4(col, alpha);
  }
`;

// --- SHARED GLB LOADER & WORLD-SPACE CAUSTICS MATERIAL INJECTION ---
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

function injectUnderwaterCaustics(mat, causticUniforms, strength = 0.62) {
  if (!mat || mat.userData._causticsInjected) return mat;
  mat.userData._causticsInjected = true;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCausticTime = causticUniforms.uTime;
    shader.uniforms.uCausticScroll = causticUniforms.uScroll;
    shader.uniforms.uCausticColor = causticUniforms.uColor;
    shader.uniforms.uCausticStrength = { value: strength };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vCausticWorldPos;
         varying vec3 vCausticWorldNormal;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vec4 cWp = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           cWp = instanceMatrix * cWp;
         #endif
         cWp = modelMatrix * cWp;
         vCausticWorldPos = cWp.xyz;
         vec3 cWn = objectNormal;
         #ifdef USE_INSTANCING
           cWn = mat3(instanceMatrix) * cWn;
         #endif
         vCausticWorldNormal = normalize(mat3(modelMatrix) * cWn);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uCausticTime;
         uniform float uCausticScroll;
         uniform vec3 uCausticColor;
         uniform float uCausticStrength;
         varying vec3 vCausticWorldPos;
         varying vec3 vCausticWorldNormal;

         float reefCausticWeb(vec2 p, float t) {
           vec2 a = p * 0.85 + vec2(t * 0.42, -t * 0.28);
           vec2 b = p * 1.18 + vec2(-t * 0.34, t * 0.38);
           float w1 = sin(a.x + cos(a.y * 1.15 + t * 0.9)) * cos(a.y - sin(a.x * 1.10 - t * 0.8));
           float w2 = sin(b.x * 1.2 - b.y + t) * cos(b.y * 1.25 + b.x - t * 0.95);
           float web = 1.0 - clamp(abs(w1 + w2) * 0.72, 0.0, 1.0);
           return web * web * web;
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `float upMask = smoothstep(0.08, 0.78, vCausticWorldNormal.y);
         float distFade = exp(-max(0.0, -vCausticWorldPos.z - 2.0) * 0.055);
         vec2 cp = vec2(vCausticWorldPos.x + uCausticScroll * 0.022, vCausticWorldPos.z) + vCausticWorldPos.y * vec2(0.18, 0.12);
         float cVal = clamp(reefCausticWeb(cp, uCausticTime) * 1.22, 0.0, 1.20) * upMask * distFade * uCausticStrength;
         gl_FragColor.rgb += uCausticColor * cVal;
         #include <dithering_fragment>`
      );
  };
  mat.customProgramCacheKey = () => `reef_caustics_${strength.toFixed(2)}`;
  return mat;
}

function normalizeGlbMaterial(mat, causticUniforms = null, causticStrength = 0.0) {
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
  if (causticUniforms && causticStrength > 0.001) {
    injectUnderwaterCaustics(out, causticUniforms, causticStrength);
  }
  return out;
}

class GlbInstancedAsset {
  constructor(scene, nodeObj, maxCount, causticUniforms = null, causticStrength = 0.0) {
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
      const isGlow = String(rawMat?.name || '').toLowerCase().includes('crystal') || (rawMat?.emissiveIntensity || 0) > 0.8;
      const mat = normalizeGlbMaterial(rawMat, causticUniforms, isGlow ? 0.0 : causticStrength);
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

// --- SOFT PROCEDURAL SPRITE TEXTURES ---
function createGodRayTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([220, 252, 255, 160]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 256);
  const d = img.data;
  for (let y = 0; y < 256; y++) {
    const v = y / 255;
    const vFade = Math.sin(Math.min(1, v * 3.0) * Math.PI * 0.5) * Math.pow(1 - v, 1.38);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127) * 2 - 1;
      const streak = 0.72 + 0.28 * Math.cos(u * 8.5);
      const hFade = Math.exp(-u * u * 3.8) * streak;
      const a = clamp(vFade * hFade, 0, 1);
      const p = (y * 128 + x) * 4;
      d[p] = 224;
      d[p + 1] = 252;
      d[p + 2] = 255;
      d[p + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGlassyBubbleTex(size = 64) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([220, 250, 255, 190]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const r = size * 0.44;
  const grad = ctx.createRadialGradient(cx, cx, r * 0.15, cx, cx, r);
  grad.addColorStop(0.0, 'rgba(220, 252, 255, 0.10)');
  grad.addColorStop(0.68, 'rgba(170, 245, 255, 0.26)');
  grad.addColorStop(0.90, 'rgba(230, 254, 255, 0.88)');
  grad.addColorStop(1.0, 'rgba(160, 240, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, TAU);
  ctx.fill();
  // Specular glint dot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.34, cx - r * 0.34, r * 0.16, 0, TAU);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftBeamTex(w = 128, h = 64) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const t = new THREE.DataTexture(new Uint8Array([180, 248, 255, 140]), 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 2, w * 0.5, h * 0.5, w * 0.48);
  g.addColorStop(0.0, 'rgba(215, 252, 255, 0.85)');
  g.addColorStop(0.55, 'rgba(120, 238, 255, 0.35)');
  g.addColorStop(1.0, 'rgba(80, 220, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
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
  ctx.strokeStyle = 'rgba(4, 24, 38, 0.92)';
  ctx.strokeText(text, 160, 32);
  ctx.fillStyle = color || '#fde047';
  ctx.fillText(text, 160, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function reefDuneHeightApprox(wx, wz) {
  const ux = (wx / 24.0) * TAU;
  return (
    Math.sin(ux + wz * 0.22) * 0.42 +
    Math.cos(ux * 2.0 - wz * 0.35) * 0.24 +
    Math.max(0, (-wz - 2.0) * 0.12)
  );
}

function buildUnderwaterEnvTexture(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const s = new THREE.Scene();
    s.background = new THREE.Color('#0c7a9c');
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({ color: '#7ef8ff', side: THREE.DoubleSide })
    );
    top.rotation.x = Math.PI * 0.5;
    top.position.y = 10;
    const bot = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshBasicMaterial({ color: '#074056', side: THREE.DoubleSide })
    );
    bot.rotation.x = -Math.PI * 0.5;
    bot.position.y = -8;
    s.add(top, bot);
    const rt = pmrem.fromScene(s, 0.04);
    top.geometry.dispose();
    top.material.dispose();
    bot.geometry.dispose();
    bot.material.dispose();
    pmrem.dispose();
    return { rt, texture: rt.texture };
  } catch {
    return null;
  }
}

function buildFallbackFishGeo() {
  const geo = new THREE.SphereGeometry(0.28, 10, 8);
  geo.scale(1.45, 0.72, 0.42);
  return geo;
}

export class SubRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.skinId = opts.skinId || 'sea_glass_guardian';
    this.blasterFxId = opts.blasterFxId || 'standard_cryo';
    this.showHud = Boolean(opts.showHud);
    this._disposed = false;
    this._lastTime = 0;
    this.postfxActive = false;

    const envBuilt = opts.envMap ? null : buildUnderwaterEnvTexture(webgl);
    this._ownEnvRt = envBuilt?.rt || null;
    this.envTex = opts.envMap || envBuilt?.texture || null;

    this.godRayTex = createGodRayTexture();
    this.bubbleTex = createGlassyBubbleTex(64);
    this.beamTex = createSoftBeamTex(128, 64);

    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._wp = { x: 0, y: 0, halfW: 5, halfH: 4 };
    this._reefFov = FOV;
    this._reefCamZ = CAM_Z;
    this._subPitchSmooth = 0;
    this._subBankSmooth = 0;

    // Shared GPU uniforms for live animated world-space sunlit caustics across seabed & ruins!
    this._causticUniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColor: { value: new THREE.Color('#7af4f8') },
    };

    this._glbPools = {};
    this._initReefScene();
    this._readyPromise = this._loadGlbAssets();
  }

  whenReady() {
    return this._readyPromise;
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.reefHero?.setSkin?.(skinId);
  }

  setBlasterFx(fxId) {
    this.blasterFxId = fxId || 'standard_cryo';
  }

  _updateReefCamMetrics() {
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    this._reefFov = portrait ? 50 : 45;
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
    this._updateReefCamMetrics();
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

  prewarm() {
    if (this._disposed || !this.webgl || !this.reefScene || !this.reefCam) return;
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
      this.reefScene.traverse((o) => {
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
      this.webgl.render(this.reefScene, this.reefCam);
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

  _initReefScene() {
    this.reefScene = new THREE.Scene();
    // Alias `.scene` so main GameRenderer's `if (sr.scene && envMap)` binds PMREM cleanly!
    this.scene = this.reefScene;
    this.reefScene.background = new THREE.Color('#0a7496');
    this.reefScene.fog = new THREE.FogExp2('#0a7496', 0.029);
    if (this.envTex) {
      this.reefScene.environment = this.envTex;
      this.reefScene.environmentIntensity = 0.92;
    }

    this.reefCam = new THREE.PerspectiveCamera(FOV, this.width / Math.max(1, this.height), 0.2, 200);
    this._updateReefCamMetrics();
    this.reefCam.position.set(0, 0, this._reefCamZ);

    // Rich Underwater Sunlit Lighting Rig (zero extra PointLight overhead for locked 60fps!)
    this.reefHemi = new THREE.HemisphereLight('#94f0ff', '#14586e', 1.56);
    this.reefScene.add(this.reefHemi);

    this.reefSun = new THREE.DirectionalLight('#fff5d8', 2.60);
    this.reefSun.position.set(6, 18, 10);
    this.reefScene.add(this.reefSun);

    this.reefWarmFill = new THREE.DirectionalLight('#ffe0be', 1.15);
    this.reefWarmFill.position.set(-8, 3, 14);
    this.reefScene.add(this.reefWarmFill);

    // Adaptive 60fps PostFX guard (matches `src/postfx.js` automatic bypass guarantee on iGPUs!)
    this._frameMsEma = 14.0;
    this._lastFrameTs = 0;
    this._bypassPostFx = false;

    // 1. Seamless 3D Underwater Depth-Gradient Sphere (ZERO 2D aquarium poster, ZERO horizontal cut seam!)
    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: UNDERWATER_DOME_VERT,
      fragmentShader: UNDERWATER_DOME_FRAG,
      uniforms: {
        uZenithColor: { value: new THREE.Color('#52e4f0') },
        uHorizonColor: { value: new THREE.Color('#0a7496') },
        uAbyssColor: { value: new THREE.Color('#043652') },
        uSunColor: { value: new THREE.Color('#fff4d4') },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.underwaterDome = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 16), this.domeMat);
    this.underwaterDome.frustumCulled = false;
    this.reefScene.add(this.underwaterDome);

    // 2. Overhead Shimmering Sunlit Water-Surface Ceiling (GLSL Snell's Window with soft edge feather!)
    this.waterCeilingMat = new THREE.ShaderMaterial({
      vertexShader: WATER_CEILING_VERT,
      fragmentShader: WATER_CEILING_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uSunColor: { value: new THREE.Color('#fff6d6') },
        uZenithColor: { value: new THREE.Color('#64f2ff') },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ceilGeo = new THREE.PlaneGeometry(84, 34, 20, 8);
    ceilGeo.rotateX(Math.PI * 0.5);
    this.waterCeilingMesh = new THREE.Mesh(ceilGeo, this.waterCeilingMat);
    this.waterCeilingMesh.position.set(0, 4.8, -8.0);
    this.reefScene.add(this.waterCeilingMesh);

    // 3. Soft Slanted Volumetric Sunlit God-Ray Shafts (`MAX_RAYS`)
    this.rayMat = new THREE.MeshBasicMaterial({
      map: this.godRayTex,
      color: '#c8fbff',
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rayInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(6.2, 19.5), this.rayMat, MAX_RAYS);
    this.rayInst.frustumCulled = false;
    this.reefScene.add(this.rayInst);

    // 4. 100% SUBMARINE-FREE GATEWAY 2.0 FREE-SWIM HERO (large & expressive in left-center foreground!)
    this.heroSwimAnchor = new THREE.Group();
    this.reefHero = new GatewayRig(this.skinId);
    this.reefHeroInner = new THREE.Group();
    this.reefHeroInner.rotation.order = 'YXZ';
    // Horizontal free-swimming posture facing +X (`FreeSwim` pitches Pelvis +1.04 rad; +0.20 rad finishes sleek horizontal glide!)
    this.reefHeroInner.rotation.set(0.20, Math.PI * 0.5, 0);
    this.reefHeroInner.position.set(0, -0.30, 0);
    this.reefHeroInner.add(this.reefHero.group);
    this.heroSwimAnchor.add(this.reefHeroInner);

    // Shimmering Aqua Vortex Cone for Agile Barrel-Roll Dash
    const dashGeo = new THREE.ConeGeometry(0.76, 2.35, 16, 1, true);
    dashGeo.rotateZ(-Math.PI * 0.5);
    dashGeo.translate(-0.18, 0, 0);
    this.dashVortexMat = new THREE.MeshBasicMaterial({
      map: this.beamTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.dashVortexMesh = new THREE.Mesh(dashGeo, this.dashVortexMat);
    this.dashVortexMesh.visible = false;
    this.heroSwimAnchor.add(this.dashVortexMesh);
    this.reefScene.add(this.heroSwimAnchor);

    // Expanding 3D Harmonic Bio-Sonar Pulse Ring (ZERO ugly wireframe spheres!)
    this.sonarRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.065, 10, 44),
      new THREE.MeshBasicMaterial({
        color: '#67f3ff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sonarRingMesh.visible = false;
    this.reefScene.add(this.sonarRingMesh);

    // Cross-current drift streaks & slipstream speed halos
    this.currentStreakInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.05, 0.11),
      new THREE.MeshBasicMaterial({
        map: this.beamTex,
        color: '#99f6e4',
        transparent: true,
        opacity: 0.30,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      42
    );
    this.currentStreakInst.frustumCulled = false;
    this.reefScene.add(this.currentStreakInst);

    this.slipRingInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.46, 0.032, 6, 22),
      new THREE.MeshBasicMaterial({
        color: '#a5f3fc',
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      14
    );
    this.slipRingInst.frustumCulled = false;
    this.reefScene.add(this.slipRingInst);

    // 5. Crisp Translucent Iridescent Fresnel Rescue Bubbles (`stage.cages` + freed `escorts`)
    this.rescueBubbleMat = new THREE.ShaderMaterial({
      vertexShader: RESCUE_BUBBLE_VERT,
      fragmentShader: RESCUE_BUBBLE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uRimColorA: { value: new THREE.Color('#67f6ff') },
        uRimColorB: { value: new THREE.Color('#ffe08a') },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const bubbleSphereGeo = new THREE.SphereGeometry(0.92, 24, 18);
    const fbTurtleGeo = new THREE.SphereGeometry(0.38, 12, 10);
    const fbTurtleMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.45 });
    const fbOtterMat = new THREE.MeshStandardMaterial({ color: '#b47848', roughness: 0.52 });

    const makeCritterSlot = (withBubble) => {
      const root = new THREE.Group();
      const bubbleMesh = withBubble ? new THREE.Mesh(bubbleSphereGeo, this.rescueBubbleMat) : null;
      if (bubbleMesh) {
        bubbleMesh.renderOrder = 4;
        root.add(bubbleMesh);
      }
      const turtleGroup = new THREE.Group();
      const fbT = new THREE.Mesh(fbTurtleGeo, fbTurtleMat);
      fbT.scale.set(1.2, 0.65, 0.9);
      turtleGroup.add(fbT);
      const otterGroup = new THREE.Group();
      const fbO = new THREE.Mesh(fbTurtleGeo, fbOtterMat);
      fbO.scale.set(1.3, 0.6, 0.7);
      otterGroup.add(fbO);
      otterGroup.visible = false;
      root.add(turtleGroup, otterGroup);
      root.visible = false;
      this.reefScene.add(root);
      return { root, bubbleMesh, turtleGroup, otterGroup, flipperL: null, flipperR: null, otterTail: null };
    };

    this.cagePool = [];
    for (let i = 0; i < MAX_CAGES; i++) this.cagePool.push(makeCritterSlot(true));
    this.escortPool = [];
    for (let i = 0; i < 6; i++) this.escortPool.push(makeCritterSlot(false));

    // 6. Tropical Fish Schools, Bubbled Fish Shells, Water Seeds, Hydro-Pulses, Jellies, Mines, Clams, Vents
    const fbFishGeo = buildFallbackFishGeo();
    this.fishMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.34, metalness: 0.10 });
    this.fishInst1 = new THREE.InstancedMesh(fbFishGeo, this.fishMat, MAX_FISH);
    this.fishInst2 = new THREE.InstancedMesh(fbFishGeo, this.fishMat, MAX_FISH);
    this.ambFishInst = new THREE.InstancedMesh(fbFishGeo, this.fishMat, MAX_AMB);
    this.fishInst1.frustumCulled = false;
    this.fishInst2.frustumCulled = false;
    this.ambFishInst.frustumCulled = false;
    this.reefScene.add(this.fishInst1, this.fishInst2, this.ambFishInst);

    this.bubbleShellInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.0, 14, 12),
      this.rescueBubbleMat,
      MAX_BUBBLE_SHELLS
    );
    this.bubbleShellInst.frustumCulled = false;
    this.bubbleShellInst.renderOrder = 3;
    this.reefScene.add(this.bubbleShellInst);

    this.seedGemInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fbbf24', emissiveIntensity: 1.35, roughness: 0.14 }),
      24
    );
    this.seedGemInst.frustumCulled = false;
    this.reefScene.add(this.seedGemInst);

    this.pulseInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.24, 1),
      new THREE.MeshStandardMaterial({ color: '#e0fcff', emissive: '#22d3ee', emissiveIntensity: 1.65, roughness: 0.10 }),
      MAX_PULSES
    );
    this.pulseInst.frustumCulled = false;
    this.reefScene.add(this.pulseInst);

    // Sculpted Fluted Translucent Bioluminescent Jellyfish Bell + Graceful Oral Tentacle Skirt
    const jellyProfile = [
      new THREE.Vector2(0.0, 0.36),
      new THREE.Vector2(0.20, 0.34),
      new THREE.Vector2(0.36, 0.24),
      new THREE.Vector2(0.42, 0.08),
      new THREE.Vector2(0.38, -0.02),
      new THREE.Vector2(0.26, 0.04),
      new THREE.Vector2(0.18, -0.14),
      new THREE.Vector2(0.14, -0.34),
      new THREE.Vector2(0.06, -0.44),
      new THREE.Vector2(0.0, -0.32),
    ];
    const jellyGeo = new THREE.LatheGeometry(jellyProfile, 16);
    const jPos = jellyGeo.attributes.position;
    for (let i = 0; i < jPos.count; i++) {
      const x = jPos.getX(i), y = jPos.getY(i), z = jPos.getZ(i);
      const ang = Math.atan2(z, x);
      const rad = Math.hypot(x, z);
      const flute = y < 0.16 && rad > 0.08 ? 1.0 + Math.sin(ang * 8.0) * (y < -0.05 ? 0.24 : 0.09) : 1.0;
      jPos.setXYZ(i, x * flute, y, z * flute);
    }
    jellyGeo.computeVertexNormals();
    this.jellyInst = new THREE.InstancedMesh(
      jellyGeo,
      new THREE.MeshStandardMaterial({
        color: '#fbcfe8',
        emissive: '#d946ef',
        emissiveIntensity: 0.72,
        roughness: 0.14,
        transparent: true,
        opacity: 0.56,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      MAX_JELLY
    );
    this.jellyInst.frustumCulled = false;
    this.reefScene.add(this.jellyInst);

    // Mines & Anchor Chains
    const fbMineGeo = new THREE.DodecahedronGeometry(0.46, 0);
    const fbMineMat = new THREE.MeshStandardMaterial({ color: '#5c4036', emissive: '#b91c1c', emissiveIntensity: 0.35, roughness: 0.38, metalness: 0.78 });
    this.minePool = [];
    for (let i = 0; i < MAX_MINES; i++) {
      const g = new THREE.Group();
      const fb = new THREE.Mesh(fbMineGeo, fbMineMat);
      g.add(fb);
      g.visible = false;
      this.reefScene.add(g);
      this.minePool.push({ group: g, fallback: fb });
    }
    this.chainInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.08, 0.025, 5, 10),
      new THREE.MeshStandardMaterial({ color: '#645448', roughness: 0.55, metalness: 0.75 }),
      MAX_CHAINS
    );
    this.chainInst.frustumCulled = false;
    this.reefScene.add(this.chainInst);

    // Sculpted Fluted Giant Pearl Clams (double-sided ribbed valves cleanly joined at hinge!)
    this.clamSlots = [];
    const shellGeo = new THREE.SphereGeometry(0.46, 16, 10, 0, TAU, 0, Math.PI * 0.44);
    const sPos = shellGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const x = sPos.getX(i), y = sPos.getY(i), z = sPos.getZ(i);
      const ang = Math.atan2(z, x);
      const rib = 1.0 + Math.sin(ang * 9.0) * 0.08;
      sPos.setXYZ(i, x * 1.15 * rib, y * 0.68, z * rib);
    }
    shellGeo.computeVertexNormals();
    const shellMat = new THREE.MeshStandardMaterial({
      color: '#f2d9c6',
      emissive: '#382436',
      emissiveIntensity: 0.16,
      roughness: 0.42,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    const pearlMat = new THREE.MeshStandardMaterial({ color: '#fffbeb', emissive: '#fde047', emissiveIntensity: 1.30, roughness: 0.08 });
    for (let i = 0; i < MAX_CLAMS; i++) {
      const root = new THREE.Group();
      const bot = new THREE.Mesh(shellGeo, shellMat);
      bot.rotation.x = Math.PI;
      bot.position.y = 0.02;
      const topPiv = new THREE.Group();
      topPiv.position.set(0, 0.02, -0.32);
      const top = new THREE.Mesh(shellGeo, shellMat);
      top.position.set(0, 0, 0.32);
      topPiv.add(top);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), pearlMat);
      pearl.position.set(0, 0.08, 0.04);
      root.add(bot, topPiv, pearl);
      root.visible = false;
      this.reefScene.add(root);
      this.clamSlots.push({ root, topPiv, pearl });
    }

    // Sculpted Organic Limestone Hydrothermal Geyser Chimney (ZERO flat cylinder primitive!)
    const ventProfile = [
      new THREE.Vector2(0.88, -0.58),
      new THREE.Vector2(0.82, -0.25),
      new THREE.Vector2(0.68, 0.08),
      new THREE.Vector2(0.56, 0.38),
      new THREE.Vector2(0.46, 0.54),
      new THREE.Vector2(0.30, 0.44),
      new THREE.Vector2(0.24, 0.18),
    ];
    const ventGeo = new THREE.LatheGeometry(ventProfile, 14);
    const vPos = ventGeo.attributes.position;
    for (let i = 0; i < vPos.count; i++) {
      const x = vPos.getX(i), y = vPos.getY(i), z = vPos.getZ(i);
      const ang = Math.atan2(z, x);
      const crag = 1.0 + Math.sin(ang * 5.0 + y * 3.8) * 0.12 + Math.cos(ang * 3.0 - y * 5.2) * 0.08;
      vPos.setXYZ(i, x * crag, y, z * crag);
    }
    ventGeo.computeVertexNormals();
    this.ventInst = new THREE.InstancedMesh(
      ventGeo,
      new THREE.MeshStandardMaterial({ color: '#2b5254', emissive: '#0d9488', emissiveIntensity: 0.18, roughness: 0.86 }),
      MAX_VENTS
    );
    this.ventInst.frustumCulled = false;
    this.reefScene.add(this.ventInst);

    // Coral Sanctuary Grotto Portal (`warpCave`) & Arrival Spire
    this.grottoGroup = new THREE.Group();
    const grottoRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.24, 10, 24),
      new THREE.MeshStandardMaterial({ color: '#d6a45c', roughness: 0.35, metalness: 0.78 })
    );
    const grottoPortal = new THREE.Mesh(
      new THREE.CircleGeometry(1.22, 24),
      new THREE.MeshBasicMaterial({ color: '#5efce8', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    this.grottoGroup.add(grottoRim, grottoPortal);
    this.grottoGroup.userData = { grottoRim, grottoPortal };
    this.grottoGroup.visible = false;
    this.reefScene.add(this.grottoGroup);

    this.arrivalSpire = new THREE.Group();
    const arrCol = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2.3, 14, 16),
      new THREE.MeshStandardMaterial({ color: '#c4b89c', roughness: 0.70, metalness: 0.10 })
    );
    this.arrivalSpire.add(arrCol);
    this.arrivalSpire.visible = false;
    this.reefScene.add(this.arrivalSpire);

    // Shockwave Rings, Rising Glassy Micro-Bubbles & Popups
    this.ringInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1.0, 0.055, 8, 28),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_RINGS
    );
    this.particleInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.32, 0.32),
      new THREE.MeshBasicMaterial({ map: this.bubbleTex, color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
      MAX_PARTICLES
    );
    this.ringInst.frustumCulled = false;
    this.particleInst.frustumCulled = false;
    this.reefScene.add(this.ringInst, this.particleInst);

    this.popupPool = [];
    for (let i = 0; i < MAX_POPUPS; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sp.visible = false;
      this.reefScene.add(sp);
      this.popupPool.push({ sprite: sp, key: '' });
    }

    // Pre-allocate `instanceColor` upfront on colored InstancedMeshes to avoid D3D11 stalls!
    this._dummy.position.set(0, 0, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(1);
    this._dummy.updateMatrix();
    this._col.set('#ffffff');
    for (const im of [
      this.rayInst,
      this.currentStreakInst,
      this.slipRingInst,
      this.fishInst1,
      this.fishInst2,
      this.ambFishInst,
      this.ringInst,
      this.particleInst,
    ]) {
      im.setMatrixAt(0, this._dummy.matrix);
      im.setColorAt(0, this._col);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  async _loadGlbAssets() {
    // Zero legacy `warp_cavern.glb` reference: Crystal Grotto portal uses sculpted `GrottoArch_Vault` from `env_reef_grotto.glb`!
    const [kit, mine, turtle, otter, fish1, fish2] = await Promise.all([
      loadCachedGlb('assets/models/env_reef_grotto.glb'),
      loadCachedGlb('assets/models/sea_mine.glb'),
      loadCachedGlb('assets/models/sea_turtle.glb'),
      loadCachedGlb('assets/models/river_otter.glb'),
      loadCachedGlb('assets/models/alien_fish_1.glb'),
      loadCachedGlb('assets/models/alien_fish_2.glb'),
    ]);
    if (this._disposed) return;

    if (kit) {
      const getNode = (n) => kit.getObjectByName(n) || null;
      const cu = this._causticUniforms;
      // Seabed, vaulted limestone arches, sunken columns & reef outcrops receive LIVE GLSL CAUSTICS!
      this._glbPools.seabed = new GlbInstancedAsset(this.reefScene, getNode('SeabedDune_Tile'), 4, cu, 0.72);
      this._glbPools.grottoArch = new GlbInstancedAsset(this.reefScene, getNode('GrottoArch_Vault'), 8, cu, 0.52);
      this._glbPools.columnA = new GlbInstancedAsset(this.reefScene, getNode('SunkenColumn_A'), 8, cu, 0.50);
      this._glbPools.columnB = new GlbInstancedAsset(this.reefScene, getNode('SunkenColumn_B'), 8, cu, 0.50);
      this._glbPools.outcrop = new GlbInstancedAsset(this.reefScene, getNode('ReefOutcrop_Rock'), 14, cu, 0.58);
      this._glbPools.amphora = new GlbInstancedAsset(this.reefScene, getNode('SunkenAmphora'), 8, null, 0.0);

      // Upgrade hydrothermal vent chimneys with real sculpted limestone PBR grain from `ReefOutcrop_Rock`!
      const outcropMat = this._glbPools.outcrop?.meshes?.[0]?.material;
      if (outcropMat && this.ventInst) {
        const ventPbr = outcropMat.clone();
        ventPbr.vertexColors = false;
        ventPbr.color = new THREE.Color('#6ca29e');
        ventPbr.emissive = new THREE.Color('#0d9488');
        ventPbr.emissiveIntensity = 0.16;
        this.ventInst.material?.dispose?.();
        this.ventInst.material = ventPbr;
      }

      // Chunky real 3D sculpted corals & swaying ribbon kelp (fast PBR shading -> locked 60fps D3D11!)
      this._glbPools.coralStaghorn = new GlbInstancedAsset(this.reefScene, getNode('Coral_Staghorn'), 14, null, 0.0);
      this._glbPools.coralTable = new GlbInstancedAsset(this.reefScene, getNode('Coral_Table'), 14, null, 0.0);
      this._glbPools.coralBrain = new GlbInstancedAsset(this.reefScene, getNode('Coral_BrainDome'), 14, null, 0.0);
      this._glbPools.coralAnemone = new GlbInstancedAsset(this.reefScene, getNode('Coral_Anemone'), 14, null, 0.0);
      this._glbPools.kelp = new GlbInstancedAsset(this.reefScene, getNode('Kelp_Cluster'), 18, null, 0.0);

      // Chunky 3D antique-bronze & crystal glowing hydro-rings (replaces wireframe hoops!)
      this._glbPools.hydroRing = new GlbInstancedAsset(this.reefScene, getNode('HydroRing_Reef'), 14, null, 0.0);

      // Mount sculpted Pelagian `HydroRing_Reef` onto the Crystal Grotto Warp Portal (zero legacy warp_cavern.glb!)
      const grottoRing = getNode('HydroRing_Reef');
      if (grottoRing && this.grottoGroup?.userData?.grottoRim) {
        this.grottoGroup.userData.grottoRim.visible = false;
        const cl = grottoRing.clone(true);
        cl.scale.setScalar(1.32);
        this.grottoGroup.add(cl);
      }
    }

    // Upgrade tropical fish instanced meshes from real GLBs if available
    const extractFirstGeo = (sceneObj) => {
      let found = null;
      sceneObj?.traverse((o) => {
        if (!found && o.isMesh && o.geometry) found = o.geometry;
      });
      return found;
    };
    const f1Geo = extractFirstGeo(fish1);
    if (f1Geo) {
      this.fishInst1.geometry = f1Geo;
      this.ambFishInst.geometry = f1Geo;
    }
    const f2Geo = extractFirstGeo(fish2);
    if (f2Geo) this.fishInst2.geometry = f2Geo;

    if (mine) {
      for (const slot of this.minePool) {
        slot.fallback.visible = false;
        const cl = mine.clone(true);
        cl.scale.setScalar(0.54);
        slot.group.add(cl);
      }
    }

    // Brightly lit Sea Turtles & River Otters inside translucent Fresnel rescue bubbles & escorts!
    const brightenCritter = (root, tintHex) => {
      root.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const cloned = mats.map((m) => {
          const cm = m.clone();
          if (cm.emissive) {
            cm.emissive.set(tintHex);
            cm.emissiveIntensity = 0.28;
          }
          return cm;
        });
        o.material = Array.isArray(o.material) ? cloned : cloned[0];
      });
    };
    const allSlots = [...this.cagePool, ...this.escortPool];
    for (const slot of allSlots) {
      if (turtle) {
        slot.turtleGroup.clear();
        const cl = turtle.clone(true);
        cl.scale.setScalar(1.16);
        brightenCritter(cl, '#155e58');
        slot.flipperL = cl.getObjectByName('flipper_L') || null;
        slot.flipperR = cl.getObjectByName('flipper_R') || null;
        slot.turtleGroup.add(cl);
      }
      if (otter) {
        slot.otterGroup.clear();
        const cl = otter.clone(true);
        cl.scale.setScalar(1.16);
        brightenCritter(cl, '#4d2208');
        slot.otterTail = cl.getObjectByName('otter_tail') || null;
        slot.otterGroup.add(cl);
      }
    }

    this.prewarm();
  }

  renderCoreDescent(state, opts = {}) {
    // Compatibility fallback if invoked directly (Main GameRenderer handles Core Descent in renderer.js)
    this.render(state, opts);
  }

  render(stageOrSubOrState, opts = {}) {
    if (this._disposed || !this.webgl || !stageOrSubOrState) return;
    const stage =
      stageOrSubOrState.reefSwim ||
      stageOrSubOrState.subStage ||
      stageOrSubOrState.sub ||
      stageOrSubOrState;

    const sw = stage.swimmer || stage.sub || stage;
    const time = Number(opts.time ?? stage.t ?? stage.timer ?? stageOrSubOrState.time) || 0;
    const dt = clamp(time - this._lastTime || 0.016, 0.001, 0.05);
    this._lastTime = time;

    if (opts.skinId && opts.skinId !== this.skinId) this.setSkin(opts.skinId);
    if (opts?.envMap && this.reefScene.environment !== opts.envMap) {
      this.reefScene.environment = opts.envMap;
      this.reefScene.environmentIntensity = 0.92;
    }

    const rawBiome = String(opts?.biomeKey || opts?.biome || stage.biome || stageOrSubOrState.tower?.theme || 'coral_sea').toLowerCase();
    const bKey = rawBiome.includes('canyon') || rawBiome.includes('river')
      ? 'canyon_river'
      : rawBiome.includes('alpine') || rawBiome.includes('lake')
      ? 'alpine_lake'
      : rawBiome.includes('bayou')
      ? 'mist_bayou'
      : rawBiome.includes('storm') || rawBiome.includes('ocean')
      ? 'storm_ocean'
      : 'coral_sea';
    const pal = BIOME_UNDERWATER_PALETTES[bKey] || BIOME_UNDERWATER_PALETTES.coral_sea;

    this.reefScene.background.set(pal.horizon);
    this.reefScene.fog.color.set(pal.fog);
    this.reefSun.color.set(pal.sun);

    this.domeMat.uniforms.uZenithColor.value.set(pal.zenith);
    this.domeMat.uniforms.uHorizonColor.value.set(pal.horizon);
    this.domeMat.uniforms.uAbyssColor.value.set(pal.abyss);
    this.domeMat.uniforms.uSunColor.value.set(pal.sun);
    this.domeMat.uniforms.uTime.value = time;

    const scroll = Number(stage.scroll ?? time * 96) || 0;
    this._causticUniforms.uTime.value = time;
    this._causticUniforms.uScroll.value = scroll;
    this._causticUniforms.uColor.value.set(pal.caustic);

    this.waterCeilingMat.uniforms.uTime.value = time;
    this.waterCeilingMat.uniforms.uScroll.value = scroll;
    this.waterCeilingMat.uniforms.uSunColor.value.set(pal.sun);
    this.waterCeilingMat.uniforms.uZenithColor.value.set(pal.zenith);
    this.rescueBubbleMat.uniforms.uTime.value = time;

    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    this._updateReefCamMetrics();

    const surfaceY = stage.surfaceY != null ? Math.min(stage.surfaceY, this.height * 0.14) : this.height * 0.10;
    const seabedY = stage.seabedY != null ? Math.max(stage.seabedY, this.height * 0.84) : this.height * 0.88;
    const surfWorldY = this._screenToWorld(this.width * 0.5, surfaceY, 0).y;
    const bedWorldY = this._screenToWorld(this.width * 0.5, seabedY, 0).y;

    this.waterCeilingMesh.position.set(0, surfWorldY + 1.85, -8.5);
    const dm = this._dummy;

    // 1. Seamlessly Tiled 3D Sandy Seabed Dunes (`SeabedDune_Tile`, 24m tiles with live GLSL caustics!)
    if (this._glbPools.seabed) {
      const tileW = 24.0;
      const bedShift = ((scroll * 0.022) % tileW + tileW) % tileW;
      for (let i = 0; i < 4; i++) {
        dm.position.set((i - 1.5) * tileW - bedShift + tileW * 0.5, bedWorldY - 0.55, -4.5);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1.0);
        dm.updateMatrix();
        this._glbPools.seabed.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.seabed.commit(4);
    }

    // 2. Layered 3D Vaulted Underwater Pelagian Limestone Arches & Fluted Sunken Columns!
    if (this._glbPools.grottoArch) {
      let aIdx = 0;
      // Midground arches (`z = -7.5..-9.5`)
      for (let i = 0; i < 4; i++) {
        const ax = ((((i * 15.5 + 3.0) - scroll * 0.013) % 62) + 62) % 62 - 31;
        const az = -7.8 - (i % 2) * 1.8;
        dm.position.set(ax, bedWorldY - 0.55, az);
        dm.rotation.set(0, (i % 2 === 0 ? 0.16 : -0.18), 0);
        dm.scale.setScalar(1.02 + (i % 2) * 0.10);
        dm.updateMatrix();
        this._glbPools.grottoArch.setMatrixAt(aIdx++, dm.matrix);
      }
      // Deep atmospheric background cathedral arches (`z = -16..-21`) dissolving into turquoise FogExp2!
      for (let i = 0; i < 4; i++) {
        const ax = ((((i * 19.0 + 10.0) - scroll * 0.008) % 76) + 76) % 76 - 38;
        const az = -16.5 - (i % 2) * 3.8;
        dm.position.set(ax, bedWorldY - 0.2, az);
        dm.rotation.set(0, (i % 2 === 0 ? -0.24 : 0.22), 0);
        dm.scale.setScalar(1.32 + (i % 2) * 0.16);
        dm.updateMatrix();
        this._glbPools.grottoArch.setMatrixAt(aIdx++, dm.matrix);
      }
      this._glbPools.grottoArch.commit(aIdx);
    }

    if (this._glbPools.columnA && this._glbPools.columnB) {
      for (let i = 0; i < 6; i++) {
        const cx = ((((i * 10.2 + 2.5) - scroll * 0.016) % 61.2) + 61.2) % 61.2 - 30.6;
        const cz = -5.2 - (i % 3) * 1.6;
        dm.position.set(cx, bedWorldY - 0.55, cz);
        dm.rotation.set(0, i * 0.9, 0);
        dm.scale.setScalar(0.95 + (i % 2) * 0.14);
        dm.updateMatrix();
        this._glbPools.columnA.setMatrixAt(i, dm.matrix);

        const bx = ((((i * 10.2 + 7.6) - scroll * 0.018) % 61.2) + 61.2) % 61.2 - 30.6;
        const bz = -3.8 - (i % 2) * 1.4;
        dm.position.set(bx, bedWorldY - 0.55, bz);
        dm.rotation.set(0, i * 1.4, 0);
        dm.scale.setScalar(0.96 + (i % 3) * 0.10);
        dm.updateMatrix();
        this._glbPools.columnB.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.columnA.commit(6);
      this._glbPools.columnB.commit(6);
    }

    // 3. Lush 100% Real 3D Sculpted Coral Reef Gardens, Ribbon Kelp & Sunken Amphorae!
    const gardenSpan = 46.0;
    const coralBase = portrait ? 0.88 : 1.04;
    if (this._glbPools.outcrop) {
      let nOut = 0, nStag = 0, nTab = 0, nBrain = 0, nAnem = 0, nAmp = 0;
      for (let i = 0; i < 9; i++) {
        const gx = ((((i * 5.1) - scroll * 0.022) % gardenSpan) + gardenSpan) % gardenSpan - gardenSpan * 0.5;
        const gz = -1.45 - (i % 4) * 1.05;
        const gy = bedWorldY - 0.55 + reefDuneHeightApprox(gx, gz);
        const sc = (0.85 + (i % 3) * 0.16) * coralBase;

        dm.position.set(gx, gy - 0.28, gz);
        dm.rotation.set(0, i * 1.25, 0);
        dm.scale.set(sc * 1.05, sc * 0.85, sc);
        dm.updateMatrix();
        this._glbPools.outcrop.setMatrixAt(nOut++, dm.matrix);

        // Staghorn coral cluster on crest
        dm.position.set(gx - 0.55 * sc, gy + 0.26 * sc, gz + 0.18 * sc);
        dm.rotation.set(0, i * 1.7, Math.sin(time * 0.85 + i) * 0.02);
        dm.scale.setScalar(sc * 1.05);
        dm.updateMatrix();
        this._glbPools.coralStaghorn?.setMatrixAt(nStag++, dm.matrix);

        // Scalloped table coral tier on opposite shoulder
        dm.position.set(gx + 0.65 * sc, gy + 0.18 * sc, gz - 0.12 * sc);
        dm.rotation.set(0, i * 2.1, 0);
        dm.scale.setScalar(sc * 0.96);
        dm.updateMatrix();
        this._glbPools.coralTable?.setMatrixAt(nTab++, dm.matrix);

        // Deeply-carved meandering brain-coral domes (seated firmly into sand/rock, ZERO floating!)
        dm.position.set(gx + (i % 2 === 0 ? 0.12 : -0.18) * sc, gy - 0.04 * sc, gz + 0.42 * sc);
        dm.rotation.set(0, i * 1.45, 0);
        dm.scale.setScalar(sc * 0.88);
        dm.updateMatrix();
        this._glbPools.coralBrain?.setMatrixAt(nBrain++, dm.matrix);

        // Glowing coral-peach & aqua anemone cluster
        dm.position.set(gx + (i % 2 === 0 ? -0.82 : 0.88) * sc, gy + 0.08 * sc, gz + 0.36 * sc);
        dm.rotation.set(0, i * 1.9, Math.sin(time * 1.6 + i) * 0.04);
        dm.scale.setScalar(sc * 0.92);
        dm.updateMatrix();
        this._glbPools.coralAnemone?.setMatrixAt(nAnem++, dm.matrix);

        // Sunken antique-bronze treasure amphorae nestled beside alternate outcrops
        if (i % 2 === 0 && nAmp < 8) {
          dm.position.set(gx + 1.25 * sc, gy + 0.04, gz + 0.22);
          dm.rotation.set(0, i * 0.85, 0);
          dm.scale.setScalar(sc * 0.82);
          dm.updateMatrix();
          this._glbPools.amphora?.setMatrixAt(nAmp++, dm.matrix);
        }
      }
      this._glbPools.outcrop.commit(nOut);
      this._glbPools.coralStaghorn?.commit(nStag);
      this._glbPools.coralTable?.commit(nTab);
      this._glbPools.coralBrain?.commit(nBrain);
      this._glbPools.coralAnemone?.commit(nAnem);
      this._glbPools.amphora?.commit(nAmp);
    }

    // Gently swaying 3D undulating ribbon kelp forests
    if (this._glbPools.kelp) {
      for (let i = 0; i < 16; i++) {
        const kx = ((((i * 3.0 + 1.4) - scroll * 0.022) % gardenSpan) + gardenSpan) % gardenSpan - gardenSpan * 0.5;
        const kz = -2.2 - (i % 4) * 1.35;
        const ky = bedWorldY - 0.55 + reefDuneHeightApprox(kx, kz);
        const kSc = (0.85 + (i % 3) * 0.22) * coralBase;
        dm.position.set(kx, ky - 0.12, kz);
        dm.rotation.set(Math.cos(time * 1.15 + i * 0.7) * 0.05, i * 1.65, Math.sin(time * 1.45 + i * 0.95) * 0.11);
        dm.scale.set(kSc, kSc * (0.95 + (i % 3) * 0.16), kSc);
        dm.updateMatrix();
        this._glbPools.kelp.setMatrixAt(i, dm.matrix);
      }
      this._glbPools.kelp.commit(16);
    }

    // 4. Sunlit Volumetric God-Ray Shafts slicing down through the water column!
    for (let i = 0; i < MAX_RAYS; i++) {
      const rx = ((((i * 6.4) - scroll * 0.010) % 44.8) + 44.8) % 44.8 - 22.4;
      dm.position.set(rx, surfWorldY - 1.8, -3.2 - (i % 3) * 2.2);
      dm.rotation.set(0, 0, -0.22 + (i % 4) * 0.045);
      dm.scale.setScalar(1.0);
      dm.updateMatrix();
      this.rayInst.setMatrixAt(i, dm.matrix);
      const bright = 0.62 + 0.34 * Math.sin(time * 1.45 + i * 1.15);
      this._col.set(pal.ray).multiplyScalar(bright);
      this.rayInst.setColorAt(i, this._col);
    }
    this.rayInst.count = MAX_RAYS;
    this.rayInst.instanceMatrix.needsUpdate = true;
    if (this.rayInst.instanceColor) this.rayInst.instanceColor.needsUpdate = true;

    // 5. Gateway 2.0 Free-Swim Hero — 1:1 Exact Hitbox Alignment (ZERO visual-vs-physics clamp desync!)
    const rawSwX = sw.x ?? this.width * (portrait ? 0.36 : 0.26);
    const rawSwY = sw.y ?? this.height * 0.46;
    const heroRaw = this._screenToWorld(rawSwX, rawSwY, 0.55);
    const safeHalfW = heroRaw.halfW * 0.94;
    const heroX = heroRaw.x;
    const heroY = heroRaw.y;
    const heroScale = portrait ? 1.24 : 1.38;
    this.reefHeroInner.scale.setScalar(heroScale);

    const vx = sw.vx || 0;
    const vy = sw.vy || 0;
    const rawPitch = sw.pitch != null ? -clamp(sw.pitch, -0.42, 0.42) : clamp(Math.atan2(-vy, 280), -0.42, 0.42);
    const rawBank = sw.bank != null ? clamp(sw.bank, -0.48, 0.48) : clamp(-vy * 0.0014, -0.32, 0.32);
    const smoothK = 1 - Math.exp(-12 * dt);
    this._subPitchSmooth += (rawPitch - this._subPitchSmooth) * smoothK;
    this._subBankSmooth += (rawBank - this._subBankSmooth) * smoothK;
    const dashActive = (sw.dashTimer || 0) > 0.01;
    const swimPhase = sw.swimCycle ?? time * 8.0;
    const sonarP = stage.sonarPulse || 0;

    this.heroSwimAnchor.position.set(heroX, heroY + Math.sin(swimPhase) * 0.055, 0.55);
    this.heroSwimAnchor.rotation.set(
      this._subBankSmooth + (sw.spin || 0),
      Math.sin(swimPhase * 0.5) * 0.08 - this._subBankSmooth * 0.12,
      this._subPitchSmooth + Math.sin(swimPhase) * 0.09
    );

    if (this.dashVortexMesh) {
      this.dashVortexMesh.visible = dashActive;
      if (dashActive) {
        const dp = clamp((sw.dashTimer || 0) / 0.4, 0, 1);
        this.dashVortexMat.opacity = 0.25 + dp * 0.52;
        this.dashVortexMesh.rotation.x = time * 26;
      }
    }

    this.reefHero.update(dt, {
      time,
      vx: Math.max(1.8, Math.abs(vx) * 0.025 + 2.2),
      vy: vy * 0.01,
      facing: 1,
      onGround: false,
      isSwimming: true,
      freeSwim: true,
      swimPhase,
      anim: dashActive ? 'TailWhip' : (sw.whipTimer || 0) > 0.02 ? 'HeroCelebrate' : 'FreeSwim',
      mood: (sw.stun || 0) > 0 ? 'hurt' : dashActive || sonarP > 0.3 ? 'joyful' : 'happy',
      frillFlare: 0.46 + sonarP * 0.50 + (dashActive ? 0.42 : 0),
    });
    // `FreeSwim` already aligns Pelvis horizontally (+1.04 rad) & curves Tail1 upward; counter-pitch Tail1 aft into a sleek horizontal dolphin kick!
    const sb = this.reefHero.bones;
    if (sb) {
      if (sb.Tail1) sb.Tail1.rotateX(-0.42 + Math.sin(swimPhase) * 0.14);
      if (sb.Tail2) sb.Tail2.rotateX(-0.18 + Math.sin(swimPhase - 0.65) * 0.12);
      if (sb.Tail3) sb.Tail3.rotateX(-0.08 + Math.sin(swimPhase - 1.3) * 0.10);
      if (sb.Tail4) sb.Tail4.rotateX(Math.sin(swimPhase - 1.9) * 0.08);
    }

    // 6. Chunky 3D Antique-Bronze & Aqua Crystal `HydroRing_Reef` (`stage.boostRings`)
    // Angle open 3/4 facing camera (-0.36 rad Y) so golden-bronze ring opening is unmistakably readable across viewport!
    const bRings = stage.boostRings || [];
    let brCnt = 0;
    for (let i = 0; i < bRings.length && brCnt < 14; i++) {
      const br = bRings[i];
      const wp = this._screenToWorld(br.x, br.y, 0.10);
      const rad = Math.max(0.68, this._pxScale(br.r || 36, 0.10) * 1.02);
      const pop = br.passed ? 1.0 + (br.passT || 0) * 1.1 : 1.0 + Math.sin(time * 3.4 + i) * 0.05;
      dm.position.set(wp.x, wp.y, 0.10);
      dm.rotation.set(Math.sin(time * 2.0 + i) * 0.10, -0.36, time * 0.85 + i);
      dm.scale.setScalar(rad * pop);
      dm.updateMatrix();
      this._glbPools.hydroRing?.setMatrixAt(brCnt++, dm.matrix);
    }
    this._glbPools.hydroRing?.commit(brCnt);

    // 7. Bio-Sonar Shockwave Ring
    if (sonarP > 0.01) {
      const origin = this._screenToWorld(stage.sonarOriginX ?? rawSwX, stage.sonarOriginY ?? rawSwY, 0.45);
      const prog = 1 - sonarP;
      this.sonarRingMesh.visible = true;
      this.sonarRingMesh.position.set(clamp(origin.x, -safeHalfW, safeHalfW), origin.y, 0.45);
      this.sonarRingMesh.scale.setScalar(0.65 + prog * 9.0);
      this.sonarRingMesh.material.opacity = clamp(sonarP * 0.85, 0, 0.90);
    } else {
      this.sonarRingMesh.visible = false;
    }

    // 8. Cross-Current Drift Streaks & Slipstream Speed Rings
    const currents = stage.currents || [];
    let csCnt = 0;
    for (let ci = 0; ci < currents.length && csCnt < 42; ci++) {
      const cur = currents[ci];
      const cw = this._pxScale(cur.w || 150, -0.4);
      const ch = this._pxScale(cur.h || 100, -0.4);
      const cwp = this._screenToWorld(cur.x, cur.y, -0.4);
      const cAng = Math.atan2(-(cur.vy || 0), (cur.vx || 1) - (stage.scrollSpeed || 96) * 0.35);
      for (let k = 0; k < 14 && csCnt < 42; k++) {
        const u = (time * (0.65 + (k % 3) * 0.18) + k * 0.17 + (cur.phase || 0)) % 1;
        const lane = (k + 0.5) / 14 - 0.5;
        const fade = Math.sin(u * Math.PI);
        dm.position.set(cwp.x + (u - 0.5) * cw * (cur.vx >= 0 ? 1 : -1), cwp.y + lane * ch, -0.4 + (k % 3) * 0.08);
        dm.rotation.set(0, 0, cAng);
        dm.scale.set(0.75 + fade * 0.65, 0.55 + fade * 0.55, 1);
        dm.updateMatrix();
        this._col.set(cur.vx >= 0 ? '#67e8f9' : '#99f6e4').multiplyScalar(0.55 + fade * 0.45);
        this.currentStreakInst.setColorAt(csCnt, this._col);
        this.currentStreakInst.setMatrixAt(csCnt++, dm.matrix);
      }
    }
    this.currentStreakInst.count = csCnt;
    if (csCnt > 0) {
      this.currentStreakInst.instanceMatrix.needsUpdate = true;
      if (this.currentStreakInst.instanceColor) this.currentStreakInst.instanceColor.needsUpdate = true;
    }

    const slipRings = stage.slipRings || [];
    let slCnt = 0;
    for (let i = 0; i < slipRings.length && slCnt < 14; i++) {
      const sr = slipRings[i];
      const lifeU = clamp((sr.life || 0) / Math.max(0.01, sr.maxLife || 0.46), 0, 1);
      const wp = this._screenToWorld(sr.x, sr.y, 0.35);
      dm.position.set(wp.x, wp.y, 0.35);
      dm.rotation.set(0, Math.PI * 0.48, -(sr.pitch || 0));
      dm.scale.setScalar((0.70 + (1 - lifeU) * 0.85) * (sr.boost ? 1.22 : 1.0));
      dm.updateMatrix();
      this._col.set(sr.boost ? '#5efce8' : '#bae6fd').multiplyScalar(lifeU);
      this.slipRingInst.setColorAt(slCnt, this._col);
      this.slipRingInst.setMatrixAt(slCnt++, dm.matrix);
    }
    this.slipRingInst.count = slCnt;
    if (slCnt > 0) {
      this.slipRingInst.instanceMatrix.needsUpdate = true;
      if (this.slipRingInst.instanceColor) this.slipRingInst.instanceColor.needsUpdate = true;
    }

    // 9. Crisp Translucent Iridescent Rescue Bubbles & Freed Turtle/Otter Escorts (`stage.cages` + `stage.escorts`)
    const cages = stage.cages || [];
    for (let i = 0; i < MAX_CAGES; i++) {
      const slot = this.cagePool[i];
      if (i >= cages.length) {
        slot.root.visible = false;
        continue;
      }
      const cg = cages[i];
      const wp = this._screenToWorld(cg.x, cg.y, 0.18);
      const isFreed = cg.state === 'freed';
      slot.root.visible = true;
      slot.root.position.set(wp.x, clamp(wp.y, bedWorldY + 0.9, surfWorldY - 0.55) + Math.sin(time * 2.6 + i) * 0.08, 0.18);
      slot.root.scale.setScalar(portrait ? 0.96 : 1.12);
      if (slot.bubbleMesh) {
        slot.bubbleMesh.visible = !isFreed;
        slot.bubbleMesh.rotation.y = time * 0.65 + i;
      }
      const isTurtle = cg.animal !== 'otter';
      slot.turtleGroup.visible = isTurtle;
      slot.otterGroup.visible = !isTurtle;
      const animDir = isFreed ? 0 : Math.PI * 0.85;
      slot.turtleGroup.rotation.set(0, animDir, Math.sin(time * (isFreed ? 6.5 : 4.0) + i) * 0.14);
      slot.otterGroup.rotation.set(0, animDir, Math.sin(time * (isFreed ? 7.2 : 4.4) + i) * 0.16);
      if (slot.flipperL) slot.flipperL.rotation.x = Math.sin(time * (isFreed ? 9.5 : 5.0) + i) * 0.52;
      if (slot.flipperR) slot.flipperR.rotation.x = -Math.sin(time * (isFreed ? 9.5 : 5.0) + i) * 0.52;
      if (slot.otterTail) slot.otterTail.rotation.y = Math.sin(time * (isFreed ? 11 : 5.5) + i) * 0.42;
    }

    const escorts = stage.escorts || [];
    for (let i = 0; i < this.escortPool.length; i++) {
      const slot = this.escortPool[i];
      if (i >= escorts.length) {
        slot.root.visible = false;
        continue;
      }
      const es = escorts[i];
      const wp = this._screenToWorld(es.x, es.y, 0.30);
      slot.root.visible = true;
      slot.root.position.set(wp.x, clamp(wp.y, bedWorldY + 0.6, surfWorldY - 0.4), 0.30);
      slot.root.scale.setScalar(portrait ? 0.68 : 0.80);
      const isTurtle = es.animal !== 'otter';
      slot.turtleGroup.visible = isTurtle;
      slot.otterGroup.visible = !isTurtle;
      slot.turtleGroup.rotation.set(0, 0, Math.sin(time * 6.5 + i) * 0.14);
      slot.otterGroup.rotation.set(0, 0, Math.sin(time * 7.2 + i) * 0.16);
      if (slot.flipperL) slot.flipperL.rotation.x = Math.sin(time * 9.0 + i) * 0.48;
      if (slot.flipperR) slot.flipperR.rotation.x = -Math.sin(time * 9.0 + i) * 0.48;
      if (slot.otterTail) slot.otterTail.rotation.y = Math.sin(time * 10.5 + i) * 0.42;
    }

    // 10. Tropical Reef Fish Schools, Bubbled Fish Shells & Water Seeds
    const fishList = stage.fish || [];
    let c1 = 0, c2 = 0, cShell = 0, cSeed = 0;
    const fishTints = ['#fde047', '#38bdf8', '#fb7185', '#34d399', '#fbbf24'];
    for (let i = 0; i < fishList.length; i++) {
      const f = fishList[i];
      if (f.caught) continue;
      const wp = this._screenToWorld(f.x, f.y, 0);
      const isBubbled = Boolean(f.bubbled || (f.state === 'bubbled' && (f.bubbleT ?? 1) >= 0));
      if (f.isGear) {
        if (cSeed < 24) {
          dm.position.set(wp.x, wp.y, 0.15);
          dm.rotation.set(time * 2.2 + i, time * 3.1 + i, 0);
          dm.scale.setScalar(1.0);
          dm.updateMatrix();
          this.seedGemInst.setMatrixAt(cSeed++, dm.matrix);
        }
      } else if ((f.species ?? i % 2) === 0 && c1 < MAX_FISH) {
        const sc = f.type === 'big' ? 0.72 : f.type === 'gold' ? 0.62 : 0.48;
        dm.position.set(wp.x, wp.y, -0.35);
        dm.rotation.set(0, Math.PI + Math.sin(time * 8 + i) * 0.14, clamp((f.vy || 0) * 0.002, -0.30, 0.30));
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._col.set(f.type === 'gold' ? '#fef08a' : fishTints[(f.color || i) % fishTints.length]);
        this.fishInst1.setColorAt(c1, this._col);
        this.fishInst1.setMatrixAt(c1++, dm.matrix);
      } else if (c2 < MAX_FISH) {
        const sc = f.type === 'big' ? 0.68 : 0.48;
        dm.position.set(wp.x, wp.y, -0.35);
        dm.rotation.set(0, Math.PI + Math.sin(time * 7.5 + i) * 0.15, clamp((f.vy || 0) * 0.002, -0.30, 0.30));
        dm.scale.setScalar(sc);
        dm.updateMatrix();
        this._col.set(f.type === 'gold' ? '#fef08a' : fishTints[(f.color || i + 1) % fishTints.length]);
        this.fishInst2.setColorAt(c2, this._col);
        this.fishInst2.setMatrixAt(c2++, dm.matrix);
      }
      if (isBubbled && cShell < MAX_BUBBLE_SHELLS) {
        const br = Math.max(0.36, this._pxScale(f.bubbleR || 20, 0));
        dm.position.set(wp.x, wp.y, 0.15);
        dm.rotation.set(0, time * 1.4, 0);
        dm.scale.setScalar(br);
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

    // Ambient distant tropical fish shoal swimming gracefully through the Pelagian arches
    for (let i = 0; i < MAX_AMB; i++) {
      const bx = ((((i * 1.9 - time * (1.8 + (i % 4) * 0.35)) % 44) + 44) % 44) - 22;
      const by = Math.sin(i * 2.1 + time * 1.2) * 2.8 + 0.4;
      const bz = -3.8 - (i % 5) * 1.4;
      dm.position.set(bx, by, bz);
      dm.rotation.set(0, Math.PI + Math.sin(time * 7 + i) * 0.14, 0);
      dm.scale.setScalar(0.32 + (i % 3) * 0.08);
      dm.updateMatrix();
      this._col.set(fishTints[i % fishTints.length]);
      this.ambFishInst.setColorAt(i, this._col);
      this.ambFishInst.setMatrixAt(i, dm.matrix);
    }
    this.ambFishInst.count = MAX_AMB;
    this.ambFishInst.instanceMatrix.needsUpdate = true;
    if (this.ambFishInst.instanceColor) this.ambFishInst.instanceColor.needsUpdate = true;

    // Hydro-Pulses, Jellyfish, Mines + Chains, Clams, Vents, Grotto Sanctuary & Arrival Spire
    const shots = stage.bubbles || [];
    let pCnt = 0;
    for (let i = 0; i < shots.length && pCnt < MAX_PULSES; i++) {
      const wp = this._screenToWorld(shots[i].x, shots[i].y, 0.25);
      dm.position.set(wp.x, wp.y, 0.25);
      dm.rotation.set(time * 6 + i, time * 8, 0);
      dm.scale.setScalar(1.05);
      dm.updateMatrix();
      this.pulseInst.setMatrixAt(pCnt++, dm.matrix);
    }
    this.pulseInst.count = pCnt;
    if (pCnt > 0) this.pulseInst.instanceMatrix.needsUpdate = true;

    const jellies = stage.jellies || [];
    let jCnt = 0;
    for (let i = 0; i < jellies.length && jCnt < MAX_JELLY; i++) {
      const j = jellies[i];
      const wp = this._screenToWorld(j.x, j.y, 0.05);
      const sq = 1 + Math.sin(j.pulse || time * 3) * 0.15;
      dm.position.set(wp.x, wp.y, 0.05);
      dm.rotation.set(0, time * 0.6 + i, Math.sin(time + i) * 0.1);
      dm.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      dm.updateMatrix();
      this.jellyInst.setMatrixAt(jCnt++, dm.matrix);
    }
    this.jellyInst.count = jCnt;
    if (jCnt > 0) this.jellyInst.instanceMatrix.needsUpdate = true;

    const mines = stage.mines || [];
    let chCnt = 0;
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
        const links = Math.min(11, Math.floor(span / 0.36));
        for (let k = 0; k < links && chCnt < MAX_CHAINS; k++) {
          dm.position.set(wp.x + Math.sin(time * 2 + k * 0.5) * 0.05, wp.y - 0.45 - k * 0.36, -0.05);
          dm.rotation.set(0, (k % 2) * 1.57, 0);
          dm.scale.setScalar(1);
          dm.updateMatrix();
          this.chainInst.setMatrixAt(chCnt++, dm.matrix);
        }
      }
    }
    this.chainInst.count = chCnt;
    if (chCnt > 0) this.chainInst.instanceMatrix.needsUpdate = true;

    const clams = stage.clams || [];
    for (let i = 0; i < MAX_CLAMS; i++) {
      const slot = this.clamSlots[i];
      if (i >= clams.length) {
        slot.root.visible = false;
        continue;
      }
      const c = clams[i];
      const wp = this._screenToWorld(c.x, c.y, 0.1);
      slot.root.visible = true;
      slot.root.position.set(wp.x, bedWorldY - 0.24, 0.1);
      slot.topPiv.rotation.x = -(c.open || 0) * 0.62;
      slot.pearl.visible = Boolean(c.hasPearl);
    }

    const vents = stage.vents || [];
    let vCnt = 0;
    for (let i = 0; i < vents.length && vCnt < MAX_VENTS; i++) {
      const wp = this._screenToWorld(vents[i].x, seabedY, -0.4);
      dm.position.set(wp.x, bedWorldY - 0.48, -0.4);
      dm.rotation.set(0, i * 1.4, 0);
      dm.scale.set(0.95, 0.80, 0.92);
      dm.updateMatrix();
      this.ventInst.setMatrixAt(vCnt++, dm.matrix);
    }
    this.ventInst.count = vCnt;
    if (vCnt > 0) this.ventInst.instanceMatrix.needsUpdate = true;

    const wc = stage.warpCave;
    if (wc && wc.active && !wc.entered && wc.x < this.width + 180) {
      const wp = this._screenToWorld(wc.x, wc.y, -0.35);
      this.grottoGroup.visible = true;
      this.grottoGroup.position.set(wp.x, wp.y, -0.35);
      this.grottoGroup.userData.grottoPortal.rotation.z = time * 1.6;
    } else {
      this.grottoGroup.visible = false;
    }

    if (stage.tower?.active) {
      const twp = this._screenToWorld(stage.tower.x, this.height * 0.5, -5.0);
      this.arrivalSpire.visible = true;
      this.arrivalSpire.position.set(twp.x, 0, -5.0);
      this.arrivalSpire.rotation.y = time * 0.25;
    } else {
      this.arrivalSpire.visible = false;
    }

    // Shockwave Rings & Rising Glassy Underwater Bubbles (tail stream + ambient + stage particles!)
    const rings = stage.rings || stage.shockwaves || [];
    let rCnt = 0;
    for (let i = 0; i < rings.length && rCnt < MAX_RINGS; i++) {
      const r = rings[i];
      const u = 1 - clamp(r.life / Math.max(0.01, r.maxLife || 0.5), 0, 1);
      const wp = this._screenToWorld(r.x, r.y, 0.3);
      dm.position.set(wp.x, wp.y, 0.3);
      dm.rotation.set(r.flat ? Math.PI * 0.46 : 0, 0, 0);
      dm.scale.setScalar(Math.max(0.15, this._pxScale(lerp(r.r0 ?? 10, r.r1 ?? r.maxR ?? 85, u), 0.3)));
      dm.updateMatrix();
      this._col.set(r.color || '#5efce8');
      this.ringInst.setColorAt(rCnt, this._col);
      this.ringInst.setMatrixAt(rCnt++, dm.matrix);
    }
    this.ringInst.count = rCnt;
    if (rCnt > 0) {
      this.ringInst.instanceMatrix.needsUpdate = true;
      if (this.ringInst.instanceColor) this.ringInst.instanceColor.needsUpdate = true;
    }

    let ptCnt = 0;
    // Streaming glassy bubbles off Gateway's tail-fin
    for (let i = 0; i < 32 && ptCnt < MAX_PARTICLES; i++) {
      const age = (time * 1.45 + i * 0.19) % 1;
      dm.position.set(
        heroX - 0.95 - age * 2.8,
        heroY + Math.sin(time * 5.2 + i * 1.9) * (0.08 + age * 0.22) + age * 0.95,
        0.35 + (i % 3) * 0.06
      );
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar((0.32 + (i % 4) * 0.12) * (1 - age * 0.5));
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#e6fcff' : '#99f6e4');
      this.particleInst.setColorAt(ptCnt, this._col);
      this.particleInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    // Ambient drifting underwater bubble columns rising gently across the reef grotto
    for (let i = 0; i < 40 && ptCnt < MAX_PARTICLES; i++) {
      const age = (time * (0.32 + (i % 4) * 0.08) + i * 0.17) % 1;
      const bx = ((((i * 1.8 - scroll * 0.015) % 26) + 26) % 26) - 13;
      const by = lerp(bedWorldY, surfWorldY + 0.6, age);
      dm.position.set(bx + Math.sin(time * 2.2 + i) * 0.18, by, -1.2 - (i % 5) * 1.1);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar((0.26 + (i % 4) * 0.14) * Math.sin(age * Math.PI));
      dm.updateMatrix();
      this._col.set('#d8faff');
      this.particleInst.setColorAt(ptCnt, this._col);
      this.particleInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    const extParts = opts.particles || stageOrSubOrState.particles || [];
    for (let i = 0; i < extParts.length && ptCnt < MAX_PARTICLES; i++) {
      const p = extParts[i];
      if (p.x == null || p.y == null) continue;
      const wp = this._screenToWorld(p.x, p.y, 0.4);
      const a = clamp(p.life / Math.max(0.01, p.maxLife || 1), 0, 1);
      dm.position.set(wp.x, wp.y, 0.4);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar(a * 1.05);
      dm.updateMatrix();
      this._col.set(p.color || '#ffffff');
      this.particleInst.setColorAt(ptCnt, this._col);
      this.particleInst.setMatrixAt(ptCnt++, dm.matrix);
    }
    this.particleInst.count = ptCnt;
    this.particleInst.instanceMatrix.needsUpdate = true;
    if (this.particleInst.instanceColor) this.particleInst.instanceColor.needsUpdate = true;

    this._syncPopups(opts.popups || stageOrSubOrState.popups || [], heroX, heroY, heroScale, surfWorldY, portrait);

    const sh = Number(opts.shake ?? stageOrSubOrState.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 67) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 59) * sh * 0.02 : 0;
    this.reefCam.position.set(sx, sy, this._reefCamZ);
    this.reefCam.lookAt(sx, sy, 0);
    this.underwaterDome.position.copy(this.reefCam.position);

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
      postfx.render(this.reefScene, this.reefCam, {
        biome: bKey,
        exposure: 1.08,
        bloomThreshold: 0.78,
        bloomStrength: 0.32,
        bloomRadius: 0.42,
      });
    } else {
      this.postfxActive = false;
      const prevTone = this.webgl.toneMapping;
      const prevExp = this.webgl.toneMappingExposure;
      try {
        this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
        this.webgl.toneMappingExposure = 1.08;
        this.webgl.setRenderTarget(null);
        this.webgl.render(this.reefScene, this.reefCam);
      } finally {
        this.webgl.toneMapping = prevTone;
        this.webgl.toneMappingExposure = prevExp;
      }
    }
  }

  _syncPopups(popups, heroX, heroY, heroScale, surfWorldY, portrait) {
    const minAbove = heroY + 0.62 * heroScale + 0.78;
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
      const safeX = clamp(wp.x, -wp.halfW * 0.68, wp.halfW * 0.68);
      let py = wp.y + 0.25 + t * 0.45;
      if (Math.abs(safeX - heroX) < 1.8 * heroScale && py > heroY - 0.8 * heroScale && py < minAbove) {
        py = minAbove + t * 0.35;
      }
      py = Math.min(py, Math.min(surfWorldY + 0.15, wp.halfH * 0.66));
      slot.sprite.visible = true;
      slot.sprite.position.set(safeX, py, 0.8);
      slot.sprite.scale.set(portrait ? 1.85 : 2.2, portrait ? 0.37 : 0.44, 1);
      slot.sprite.material.opacity = Math.max(0, 1 - t * t);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.reefHero?.dispose?.();
    this._ownEnvRt?.dispose();
    this.godRayTex?.dispose();
    this.bubbleTex?.dispose();
    this.beamTex?.dispose();
    for (const pool of Object.values(this._glbPools)) pool?.dispose?.();
    this._glbPools = {};
    for (const p of this.popupPool) {
      p.sprite.material.map?.dispose();
      p.sprite.material.dispose();
    }
  }
}

export { SubRenderer as ReefSwimRenderer };
export default SubRenderer;
