// TOWERING WATERS: GATEWAY'S DESCENT — WHITEWATER RAPIDS HYDRO-SKIMMER 3D RENDERER (`src/skimmerRenderer.js`)
//
// AAA Pelagian Hydro-Skimmer Canyon Rapids Engine:
//   - Gateway carves rushing emerald-turquoise canyon river rapids in a dynamic crouched surfer lean
//     stance atop a sculpted **Carved-Wood & Inlaid-Bronze Pelagian Hydro-Skimmer Board**
//     (`mg_pbr_skimmer_wood_albedo/normal` + `arch_antique_bronze_albedo/normal` rails/prow/fins,
//     subtle glowing cyan hydro-rune sigil, and soft radial-alpha whitewater wake spray mist).
//   - Real animated GLSL multi-wave Fresnel specular whitewater rapids shader (multi-octave scrolling
//     directional waves, deep emerald-to-cerulean subsurface glow, Schlick Fresnel golden sky
//     reflections, sparkling sunlight speculars, organic shoreline & current foam — ZERO Voronoi grid!).
//   - Enclosing 3D sunlit Sedona stratified sandstone canyon cliffs (`mg_pbr_sedona_strata_albedo/normal`),
//     sculpted 3D redwood conifer crowns & mossy rock ledges (ZERO 2D cardboard stickers, ZERO otter blob!),
//     soft drifting alpha waterfall mist curtains, carved bronze-and-sandstone Pelagian river boost gates,
//     sculpted translucent foaming river wave-crest ramps, and faceted sapphire/amber boost crystals.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
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
    skyTop: '#2474b5',
    skyHor: '#f6d196',
    fog: '#d4bd9c',
    sun: '#fff1d6',
    hemiSky: '#7cc8f0',
    hemiGnd: '#28455c',
    waterDeep: '#09647a',
    waterShallow: '#16b5be',
    waterSky: '#e8e2c4',
    cliff: '#ffffff',
  },
  alpine_lake: {
    skyTop: '#1e64b4',
    skyHor: '#e0f2fe',
    fog: '#b6dbf2',
    sun: '#fff7ed',
    hemiSky: '#93d5fa',
    hemiGnd: '#2c4a63',
    waterDeep: '#084170',
    waterShallow: '#1492c4',
    waterSky: '#dceeff',
    cliff: '#cbd5e1',
  },
  mist_bayou: {
    skyTop: '#3e3d96',
    skyHor: '#f7ba82',
    fog: '#d8b498',
    sun: '#ffebd0',
    hemiSky: '#88c0d8',
    hemiGnd: '#24453c',
    waterDeep: '#0a4440',
    waterShallow: '#16877a',
    waterSky: '#f2caa6',
    cliff: '#d7ddd2',
  },
  coral_sea: {
    skyTop: '#0682c4',
    skyHor: '#cbf5fc',
    fog: '#9de4f2',
    sun: '#fff4dc',
    hemiSky: '#82d8f7',
    hemiGnd: '#1e5266',
    waterDeep: '#075878',
    waterShallow: '#14b4c4',
    waterSky: '#d4f6ff',
    cliff: '#f7ece0',
  },
  storm_ocean: {
    skyTop: '#102b47',
    skyHor: '#389dc9',
    fog: '#295670',
    sun: '#dbeeff',
    hemiSky: '#63a8cf',
    hemiGnd: '#1a3245',
    waterDeep: '#062640',
    waterShallow: '#116d96',
    waterSky: '#6fb4d4',
    cliff: '#94a3b8',
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

// --- ANIMATED GLSL MULTI-WAVE FRESNEL SPECULAR CANYON RAPIDS WATER SHADER ---
const RAPIDS_WATER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uDist;
  varying vec3 vWorldPos;
  varying float vWaveH;
  varying float vCamDist;

  void main() {
    vec3 pos = position;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    float zFlow = worldPos.z - uDist;

    // 4 layered directional whitewater canyon swells
    float w1 = sin(zFlow * 0.44 + worldPos.x * 0.42 + uTime * 2.2) * 0.11;
    float w2 = cos(zFlow * 0.86 - worldPos.x * 0.68 + uTime * 3.4) * 0.065;
    float w3 = sin(zFlow * 1.48 + worldPos.x * 1.15 - uTime * 4.2) * 0.035;
    float w4 = cos((worldPos.x * 0.92 - zFlow * 0.58) + uTime * 2.7) * 0.03;
    float h = w1 + w2 + w3 + w4;

    pos.y += h;
    worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
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

  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    mat2 m = mat2(0.82, 0.57, -0.57, 0.82);
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = m * p * 2.04;
      a *= 0.5;
    }
    return s;
  }

  float waveHeight(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.y * 0.85 + p.x * 0.52 + t * 2.4) * 0.24;
    h += cos(p.y * 1.62 - p.x * 1.18 + t * 3.5) * 0.14;
    h += sin(p.y * 2.95 + p.x * 2.35 - t * 4.4) * 0.075;
    h += (fbm(p * vec2(0.55, 0.26) + vec2(0.0, t * 0.45)) - 0.5) * 0.32;
    return h;
  }

  void main() {
    // River coordinate rushing toward camera (+Z relative to world scroll uDist)
    vec2 rp = vec2(vWorldPos.x, vWorldPos.z - uDist * 0.92);
    float eps = 0.14;
    float hc = waveHeight(rp, uTime);
    float hx = waveHeight(rp + vec2(eps, 0.0), uTime);
    float hz = waveHeight(rp + vec2(0.0, eps), uTime);
    vec3 N = normalize(vec3((hc - hx) * 1.45, 1.0, (hc - hz) * 1.45));

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Bank shallowness & depth gradient (vibrant emerald-turquoise sunlit channel)
    float bankT = smoothstep(2.0, 7.6, abs(vWorldPos.x));
    vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(0.42 + bankT * 0.48 + vWaveH * 1.6, 0.0, 1.0));

    // Subsurface turquoise sunlight transmission through wave crests
    float sss = pow(clamp(dot(V, normalize(-L + N * 0.48)), 0.0, 1.0), 2.8) * (0.55 + max(0.0, vWaveH) * 3.4);
    baseWater += vec3(0.09, 0.48, 0.46) * sss;

    // Schlick Fresnel sky & sunlit canyon reflection
    float ndotv = max(dot(N, V), 0.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - ndotv, 4.4);
    vec3 reflSky = mix(uSkyColor, uSunColor, 0.34 + 0.28 * clamp(N.x * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(baseWater, reflSky, fresnel * 0.52);

    // Crisp sunlight specular sparkle + broad water sheen
    vec3 H = normalize(L + V);
    float specSharp = pow(max(dot(N, H), 0.0), 96.0);
    float specBroad = pow(max(dot(N, H), 0.0), 20.0);
    col += uSunColor * (specSharp * 1.45 + specBroad * 0.22);

    // Domain-warped organic whitewater rushing current foam & canyon shoreline rapids (ZERO Voronoi grid!)
    vec2 fUv = vec2(rp.x * 0.68, rp.y * 0.20);
    float warp = fbm(fUv + vec2(0.0, uTime * 0.38));
    float currentNoise = fbm(fUv * vec2(2.1, 1.3) + vec2(warp * 1.45, -uTime * 0.58));
    float crestFoam = smoothstep(0.58, 0.80, currentNoise + vWaveH * 1.05);
    float bankFoam = smoothstep(5.2, 8.1, abs(vWorldPos.x) + (currentNoise - 0.5) * 1.7);

    // Subtle aerated wake trail around Gateway's hydro-skimmer position
    vec2 toHero = vWorldPos.xz - uHeroXZ;
    float wakeBand = exp(-pow(abs(toHero.x) - max(0.0, toHero.y) * 0.30, 2.0) * 4.8) *
                     smoothstep(-0.3, 0.4, toHero.y) * smoothstep(5.5, 0.8, toHero.y);
    float totalFoam = clamp(crestFoam * 0.56 + bankFoam * 0.84 + wakeBand * currentNoise * 0.62, 0.0, 0.94);
    vec3 foamCol = mix(vec3(0.88, 0.98, 1.0), uSunColor, 0.16);
    col = mix(col, foamCol, totalFoam);

    // Exponential atmospheric fog seamlessly matching scene FogExp2
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vCamDist * vCamDist);
    col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

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
    body.position.set(0, 0.46, 0);
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
      leg.position.set(sx * 0.16, -0.28, sx * 0.08);
      leg.rotation.z = sx * 0.24;
      body.add(leg);

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.24, 6, 10), matScale);
      arm.position.set(sx * 0.24, 0.08, 0);
      arm.rotation.z = sx * 1.05;
      body.add(arm);
    }

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
    const bank = pose.surfBank || 0;
    if (this.liveRig?.update) {
      try {
        // Athletic crouched sideways-carving surfer stance (not standing stiffly upright!)
        this.liveRig.group.rotation.order = 'YXZ';
        this.liveRig.group.rotation.y = Math.PI + 0.36 + bank * 0.28;
        this.liveRig.group.rotation.x = -0.16 - Math.abs(bank) * 0.08;
        this.liveRig.group.rotation.z = -bank * 0.18;
        this.liveRig.update(dt, pose);
        return;
      } catch {
        // Fallback
      }
    }
    const t = pose.time || 0;
    this.fallback.body.rotation.x = -0.22;
    this.fallback.body.rotation.z = -bank * 0.35;
    this.fallback.body.rotation.y = 0.34 + bank * 0.22;
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
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wU = u + (noiseTileRapids(u, v, 4) - 0.5) * 0.24;
      const wV = v + (noiseTileRapids(u + 0.41, v + 0.17, 4) - 0.5) * 0.12;
      const grain =
        noiseTileRapids(wU, wV, 8) * 0.48 +
        noiseTileRapids(wU, wV, 18) * 0.34 +
        noiseTileRapids(u, v, 36) * 0.18;
      const bedding = 0.5 + 0.5 * Math.sin((wV * 7.0 + grain * 0.55) * TAU);
      const tBand = clamp(grain * 0.56 + bedding * 0.44, 0, 1);
      const p = (y * size + x) * 4;
      data[p] = clamp(Math.round(lerp(136, 224, tBand)), 0, 255);
      data[p + 1] = clamp(Math.round(lerp(64, 140, tBand)), 0, 255);
      data[p + 2] = clamp(Math.round(lerp(42, 92, tBand)), 0, 255);
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

function createRedwoodFallbackTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([102, 46, 24, 255]);
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
      const warp = (noiseTileRapids(u * 0.5, v, 6) - 0.5) * 0.22;
      const ring = 0.5 + 0.5 * Math.sin((v * 14.0 + warp * 8.0) * TAU);
      const fine = noiseTileRapids(u * 0.5, v * 2.0, 24);
      const t = clamp(ring * 0.65 + fine * 0.35, 0, 1);
      const p = (y * size + x) * 4;
      data[p] = clamp(Math.round(lerp(72, 148, t)), 0, 255);
      data[p + 1] = clamp(Math.round(lerp(28, 68, t)), 0, 255);
      data[p + 2] = clamp(Math.round(lerp(16, 36, t)), 0, 255);
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

/**
 * Refined glowing cyan Pelagian hydro-rune inlay overlay for the carved-wood hydro-skimmer deck.
 * Delicate recessed filigree sigils — ZERO thick MS-Paint white V-stripes!
 */
function createHydroRuneOverlayTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([94, 252, 232, 0]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size * 2;
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawRunes = (strokeStyle, width, blur) => {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = width;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = blur;

    // Fine central hydro-channel hairline running bow to swallowtail
    ctx.beginPath();
    ctx.moveTo(W * 0.5, H * 0.10);
    ctx.lineTo(W * 0.5, H * 0.85);
    ctx.stroke();

    // Delicate forward & aft Pelagian chevron filigree accents
    for (const yFrac of [0.22, 0.30, 0.72]) {
      const y = H * yFrac;
      const span = yFrac > 0.5 ? W * 0.13 : W * 0.14;
      ctx.beginPath();
      ctx.moveTo(W * 0.5 - span, y + H * 0.028);
      ctx.lineTo(W * 0.5, y);
      ctx.lineTo(W * 0.5 + span, y + H * 0.028);
      ctx.stroke();
    }

    // Central Pelagian diamond hydro-medallion
    const cy = H * 0.48;
    ctx.beginPath();
    ctx.moveTo(W * 0.5, cy - H * 0.055);
    ctx.lineTo(W * 0.5 + W * 0.095, cy);
    ctx.lineTo(W * 0.5, cy + H * 0.055);
    ctx.lineTo(W * 0.5 - W * 0.095, cy);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W * 0.5, cy, W * 0.042, 0, TAU);
    ctx.stroke();
  };

  drawRunes('rgba(56, 189, 248, 0.38)', 6.0, 8);
  drawRunes('rgba(165, 243, 252, 0.90)', 1.9, 2);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftRadialMistTexture(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([232, 252, 255, 180]);
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
      const r = Math.sqrt(r2);
      const edgeMask = clamp((0.88 - r) / 0.34, 0, 1);
      const smoothMask = edgeMask * edgeMask * (3 - 2 * edgeMask);
      const gauss = Math.exp(-r2 * 4.4) * smoothMask;
      const wisp = 0.78 + 0.22 * noiseTileRapids(x / size, y / size, 6);
      const a = clamp(gauss * wisp, 0, 1);
      const p = (y * size + x) * 4;
      data[p] = 232;
      data[p + 1] = 252;
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 215);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftWakeRibbonTexture(w = 128, h = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([224, 250, 255, 128]);
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
    const v = y / (h - 1);
    const lenFade = Math.sin(Math.min(1, v * 5.0) * Math.PI * 0.5) * Math.pow(1 - v, 1.5);
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const edgeFade = Math.exp(-u * u * 4.6) * Math.max(0, 1 - u * u);
      const foamNoise =
        noiseTileRapids(x / w, v * 2.5, 8) * 0.55 +
        noiseTileRapids(x / w + 0.3, v * 4.0, 16) * 0.45;
      const a = clamp(lenFade * edgeFade * (0.45 + foamNoise * 0.72), 0, 1);
      const p = (y * w + x) * 4;
      data[p] = Math.round(lerp(182, 244, foamNoise));
      data[p + 1] = Math.round(lerp(242, 254, foamNoise));
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 195);
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
 * Translucent deep-turquoise-to-foam wave-crest ramp albedo + normal map (ZERO flat boxes/stripes!).
 */
function createWaveRampTextures(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([32, 198, 210, 220]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    const nd = new Uint8Array([128, 128, 255, 255]);
    const nt = new THREE.DataTexture(nd, 1, 1, THREE.RGBAFormat);
    nt.needsUpdate = true;
    return { albedoTex: t, normalTex: nt };
  }

  const heights = new Float32Array(size * size);
  const ca = document.createElement('canvas');
  ca.width = size;
  ca.height = size;
  const ctxA = ca.getContext('2d');
  const imgA = ctxA.createImageData(size, size);
  const dA = imgA.data;

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    const crestFactor = Math.pow(clamp(1 - v, 0, 1), 1.6);
    const tailFade = Math.sin(clamp((1 - v) * 3.8, 0, 1) * Math.PI * 0.5);
    const frontFade = Math.sin(clamp(v * 6.5, 0, 1) * Math.PI * 0.5);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const uC = u * 2 - 1;
      const sideFade = Math.pow(Math.max(0, 1 - uC * uC), 0.72);

      const warpU = u + (noiseTileRapids(u, v, 5) - 0.5) * 0.16;
      const streak =
        noiseTileRapids(warpU * 3.0, v * 1.4, 8) * 0.58 +
        noiseTileRapids(warpU * 5.0, v * 2.2, 16) * 0.42;
      heights[y * size + x] = streak;

      // Wide foaming river-rapid hydraulic ledge: deep rushing aqua base -> bright frothy aerated whitewater foam crest & streaks!
      const foamStrength = clamp((crestFactor * 1.15 + streak * 0.62 - 0.36) * 2.1, 0, 1);
      const foam = foamStrength * foamStrength * (3 - 2 * foamStrength);

      let r = lerp(12, 42, clamp(crestFactor * 0.55 + streak * 0.45, 0, 1));
      let g = lerp(124, 198, clamp(crestFactor * 0.62 + streak * 0.38, 0, 1));
      let b = lerp(142, 206, clamp(crestFactor * 0.65 + streak * 0.35, 0, 1));

      r = lerp(r, 242, foam * 0.94);
      g = lerp(g, 253, foam * 0.96);
      b = lerp(b, 255, foam * 0.98);

      const alpha = clamp(sideFade * tailFade * frontFade * lerp(0.72, 0.98, foam), 0, 1);
      const p = (y * size + x) * 4;
      dA[p] = clamp(Math.round(r), 0, 255);
      dA[p + 1] = clamp(Math.round(g), 0, 255);
      dA[p + 2] = clamp(Math.round(b), 0, 255);
      dA[p + 3] = Math.round(alpha * 255);
    }
  }
  ctxA.putImageData(imgA, 0, 0);

  const cn = document.createElement('canvas');
  cn.width = size;
  cn.height = size;
  const ctxN = cn.getContext('2d');
  const imgN = ctxN.createImageData(size, size);
  const dN = imgN.data;
  const strength = 3.4;
  for (let y = 0; y < size; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(size - 1, y + 1);
    for (let x = 0; x < size; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(size - 1, x + 1);
      const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const p = (y * size + x) * 4;
      dN[p] = clamp(Math.round((-dx * invLen * 0.5 + 0.5) * 255), 0, 255);
      dN[p + 1] = clamp(Math.round((-dy * invLen * 0.5 + 0.5) * 255), 0, 255);
      dN[p + 2] = clamp(Math.round((invLen * 0.5 + 0.5) * 255), 0, 255);
      dN[p + 3] = 255;
    }
  }
  ctxN.putImageData(imgN, 0, 0);

  const albedoTex = new THREE.CanvasTexture(ca);
  albedoTex.wrapS = THREE.ClampToEdgeWrapping;
  albedoTex.wrapT = THREE.ClampToEdgeWrapping;
  albedoTex.colorSpace = THREE.SRGBColorSpace;

  const normalTex = new THREE.CanvasTexture(cn);
  normalTex.wrapS = THREE.ClampToEdgeWrapping;
  normalTex.wrapT = THREE.ClampToEdgeWrapping;
  normalTex.colorSpace = THREE.NoColorSpace;

  return { albedoTex, normalTex };
}

function createFeatheredWaterfallTexture() {
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
      Math.sin(Math.min(1, v * 4.5) * Math.PI * 0.5) *
      Math.sin(Math.min(1, (1 - v) * 3.0) * Math.PI * 0.5);
    for (let x = 0; x < 128; x++) {
      const u = (x / 127) * 2 - 1;
      const edgeFade = Math.exp(-u * u * 4.4);
      const wisp = noiseTileRapids(x / 128, v * 2.0, 8) * 0.55 + noiseTileRapids(x / 128, v * 4.0, 16) * 0.45;
      const streak = 0.46 + 0.54 * wisp;
      const a = clamp(vFade * edgeFade * streak, 0, 1);
      const p = (y * 128 + x) * 4;
      data[p] = 228;
      data[p + 1] = 250;
      data[p + 2] = 255;
      data[p + 3] = Math.round(a * 205);
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
 * High-detail dappled pine-needle & mossy fern foliage albedo + normal map
 * (eliminates smooth Play-Doh clay look on 3D conifers & canyon shrubs!).
 */
function createFoliageDetailTextures(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([210, 232, 200, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    const nd = new Uint8Array([128, 128, 255, 255]);
    const nt = new THREE.DataTexture(nd, 1, 1, THREE.RGBAFormat);
    nt.wrapS = THREE.RepeatWrapping;
    nt.wrapT = THREE.RepeatWrapping;
    nt.needsUpdate = true;
    return { albedoTex: t, normalTex: nt };
  }
  const heights = new Float32Array(size * size);
  const ca = document.createElement('canvas');
  ca.width = size;
  ca.height = size;
  const ctxA = ca.getContext('2d');
  const imgA = ctxA.createImageData(size, size);
  const dA = imgA.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const cluster = noiseTileRapids(u, v, 8) * 0.45 + noiseTileRapids(u, v, 18) * 0.35 + noiseTileRapids(u, v, 40) * 0.20;
      const needle = 0.5 + 0.5 * Math.sin((u * 26.0 + cluster * 4.5) * TAU) * Math.cos((v * 20.0 - cluster * 3.5) * TAU);
      const h = clamp(cluster * 0.68 + needle * 0.32, 0, 1);
      heights[y * size + x] = h;
      const lum = lerp(0.54, 1.18, h);
      const p = (y * size + x) * 4;
      dA[p] = clamp(Math.round(220 * lum), 0, 255);
      dA[p + 1] = clamp(Math.round(242 * lum), 0, 255);
      dA[p + 2] = clamp(Math.round(206 * lum), 0, 255);
      dA[p + 3] = 255;
    }
  }
  ctxA.putImageData(imgA, 0, 0);

  const cn = document.createElement('canvas');
  cn.width = size;
  cn.height = size;
  const ctxN = cn.getContext('2d');
  const imgN = ctxN.createImageData(size, size);
  const dN = imgN.data;
  const strength = 3.8;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const p = (y * size + x) * 4;
      dN[p] = clamp(Math.round((-dx * inv * 0.5 + 0.5) * 255), 0, 255);
      dN[p + 1] = clamp(Math.round((-dy * inv * 0.5 + 0.5) * 255), 0, 255);
      dN[p + 2] = clamp(Math.round((inv * 0.5 + 0.5) * 255), 0, 255);
      dN[p + 3] = 255;
    }
  }
  ctxN.putImageData(imgN, 0, 0);

  const albedoTex = new THREE.CanvasTexture(ca);
  albedoTex.wrapS = THREE.RepeatWrapping;
  albedoTex.wrapT = THREE.RepeatWrapping;
  albedoTex.repeat.set(2, 2);
  albedoTex.colorSpace = THREE.SRGBColorSpace;

  const normalTex = new THREE.CanvasTexture(cn);
  normalTex.wrapS = THREE.RepeatWrapping;
  normalTex.wrapT = THREE.RepeatWrapping;
  normalTex.repeat.set(2, 2);
  normalTex.colorSpace = THREE.NoColorSpace;

  return { albedoTex, normalTex };
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
  g.addColorStop(0.42, '#4ea9de');
  g.addColorStop(0.74, '#d9d8c7');
  g.addColorStop(0.92, '#f8d398');
  g.addColorStop(1.0, '#f0b86e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- SCULPTED PELAGIAN CARVED-WOOD & INLAID-BRONZE HYDRO-SKIMMER BOARD ---

function skimmerRockerY(z) {
  const bow = Math.pow(clamp((-z - 0.24) / 1.02, 0, 1), 2.15) * 0.22;
  const tail = Math.pow(clamp((z - 0.62) / 0.54, 0, 1), 2.0) * 0.05;
  return bow + tail;
}

function skimmerHalfWidth(z) {
  const t = clamp((z + 1.22) / 2.32, 0, 1);
  if (t < 0.38) {
    const u = t / 0.38;
    return 0.42 * Math.pow(Math.sin(u * Math.PI * 0.5), 0.72);
  }
  const u = (t - 0.38) / 0.62;
  return lerp(0.42, 0.245, Math.pow(u, 1.35));
}

function buildHydroSkimmerBoardParts() {
  // Sleek low-profile carved-wood surfboard silhouette with upturned nose rocker & tapered swallowtail
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.22);
  shape.bezierCurveTo(0.22, 1.04, 0.42, 0.56, 0.42, 0.20);
  shape.bezierCurveTo(0.42, -0.24, 0.36, -0.76, 0.245, -1.10);
  shape.quadraticCurveTo(0.10, -0.96, 0, -0.82);
  shape.quadraticCurveTo(-0.10, -0.96, -0.245, -1.10);
  shape.bezierCurveTo(-0.36, -0.76, -0.42, -0.24, -0.42, 0.20);
  shape.bezierCurveTo(-0.42, 0.56, -0.22, 1.04, 0, 1.22);

  const hullGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.056,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.030,
    bevelSegments: 4,
    curveSegments: 22,
  });
  hullGeo.rotateX(-Math.PI * 0.5);

  const hPos = hullGeo.attributes.position;
  const hUv = hullGeo.attributes.uv;
  for (let i = 0; i < hPos.count; i++) {
    const x = hPos.getX(i);
    let y = hPos.getY(i);
    const z = hPos.getZ(i);
    const hw = Math.max(0.08, skimmerHalfWidth(z));
    const uLat = clamp(Math.abs(x) / hw, 0, 1);
    const crown = (1 - uLat * uLat) * 0.018;
    y += skimmerRockerY(z) + crown;
    hPos.setXYZ(i, x, y, z);
    // Rotate UVs 90 deg so `mg_pbr_skimmer_wood` carved planks & verdigris bronze scroll inlays run LENGTHWISE down the board!
    hUv.setXY(i, (z + 1.25) * 0.46, (x + 0.46) * 1.12);
  }
  hullGeo.computeVertexNormals();

  // Beveled Antique-Bronze Rails, Prow Finial & Twin Hydro-Fins (1 merged draw call)
  const bronzeParts = [];
  for (const sx of [-1, 1]) {
    const railPts = [];
    const segs = 26;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const z = lerp(-1.20, 1.09, t);
      const w = skimmerHalfWidth(z) + 0.024;
      const y = skimmerRockerY(z) + 0.036;
      railPts.push(new THREE.Vector3(sx * w, y, z));
    }
    bronzeParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 28, 0.020, 7, false));

    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.34, 0);
    finShape.quadraticCurveTo(0.40, -0.13, 0.32, -0.20);
    finShape.quadraticCurveTo(0.13, -0.13, 0, 0);
    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 2,
    });
    finGeo.rotateY(Math.PI * 0.5);
    finGeo.translate(sx * 0.19 - 0.007, skimmerRockerY(0.82) - 0.004, 0.62);
    bronzeParts.push(finGeo);

    const tipCap = new THREE.ConeGeometry(0.028, 0.13, 6);
    tipCap.rotateX(Math.PI * 0.5);
    tipCap.translate(sx * 0.245, skimmerRockerY(1.10) + 0.034, 1.12);
    bronzeParts.push(tipCap);
  }

  const prowGeo = new THREE.ConeGeometry(0.048, 0.24, 6);
  prowGeo.rotateX(-Math.PI * 0.5 + 0.22);
  prowGeo.scale(1.12, 0.56, 1.0);
  prowGeo.translate(0, skimmerRockerY(-1.22) + 0.052, -1.24);
  bronzeParts.push(prowGeo);

  const bronzeGeo = safeMergeGeos(bronzeParts);
  for (const bp of bronzeParts) bp.dispose();

  // Delicate Glowing Cyan Hydro-Rune Deck Inlay
  const runeGeo = new THREE.PlaneGeometry(0.76, 1.98, 12, 24);
  runeGeo.rotateX(-Math.PI * 0.5);
  const rPos = runeGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    let x = rPos.getX(i);
    const z = rPos.getZ(i) - 0.12;
    const hw = Math.max(0.04, skimmerHalfWidth(z) - 0.04);
    const xNorm = clamp(x / 0.38, -1, 1);
    x = xNorm * hw;
    const uLat = Math.abs(xNorm);
    const y = skimmerRockerY(z) + 0.088 + (1 - uLat * uLat) * 0.018;
    rPos.setXYZ(i, x, y, z);
  }
  runeGeo.computeVertexNormals();

  return { hullGeo, bronzeGeo, runeGeo };
}

/**
 * Carved Bronze-and-Sandstone Pelagian River Gate Parts (kills untextured grey macaroni torus!).
 * Returns `{ stoneGeo, bronzeGeo }` for clean 2-material carved stone + antique-bronze boost gates.
 */
function buildPelagianRiverGateParts() {
  const stoneParts = [];
  const bronzeParts = [];

  for (const sx of [-1, 1]) {
    const px = sx * 1.56;
    // Chamfered sandstone river pier plinth & fluted column shaft
    const plinth = new THREE.BoxGeometry(0.58, 0.72, 0.58);
    plinth.translate(px, 0.28, 0);
    stoneParts.push(plinth);

    const shaft = new THREE.CylinderGeometry(0.21, 0.26, 1.48, 8);
    shaft.translate(px, 1.22, 0);
    stoneParts.push(shaft);

    const cap = new THREE.BoxGeometry(0.54, 0.24, 0.54);
    cap.translate(px, 2.02, 0);
    stoneParts.push(cap);

    // Ornate antique-bronze structural collars & finial lanterns atop piers
    for (const ry of [0.68, 1.88]) {
      const collar = new THREE.TorusGeometry(0.28, 0.045, 7, 16);
      collar.rotateX(Math.PI * 0.5);
      collar.translate(px, ry, 0);
      bronzeParts.push(collar);
    }
    const finial = new THREE.OctahedronGeometry(0.16, 0);
    finial.scale(0.85, 1.4, 0.85);
    finial.translate(px, 2.30, 0);
    bronzeParts.push(finial);
  }

  // Carved sandstone voussoir arch blocks spanning between piers
  const segs = 11;
  const rad = 1.56;
  const cy = 1.98;
  for (let i = 0; i < segs; i++) {
    const a = ((i + 0.5) / segs) * Math.PI;
    const vx = Math.cos(a) * rad;
    const vy = cy + Math.sin(a) * rad;
    const isKey = i === 5;
    const blk = new THREE.BoxGeometry(isKey ? 0.50 : 0.42, isKey ? 0.54 : 0.38, isKey ? 0.52 : 0.42);
    blk.rotateZ(a - Math.PI * 0.5);
    blk.translate(vx, vy, 0);
    stoneParts.push(blk);
  }

  // Inlaid antique-bronze inner arch rim & sculpted nested keystone relief medallion
  const innerRim = new THREE.TorusGeometry(1.36, 0.055, 8, 26, Math.PI);
  innerRim.translate(0, cy, 0);
  bronzeParts.push(innerRim);

  const outerTrim = new THREE.TorusGeometry(1.76, 0.042, 7, 26, Math.PI);
  outerTrim.translate(0, cy, 0);
  bronzeParts.push(outerTrim);

  const crestMedallion = new THREE.CylinderGeometry(0.24, 0.24, 0.56, 12);
  crestMedallion.rotateX(Math.PI * 0.5);
  crestMedallion.translate(0, cy + rad + 0.04, 0);
  bronzeParts.push(crestMedallion);

  const stoneGeo = safeMergeGeos(stoneParts);
  const bronzeGeo = safeMergeGeos(bronzeParts);
  for (const g of stoneParts) g.dispose();
  for (const g of bronzeParts) g.dispose();
  return { stoneGeo, bronzeGeo };
}

/**
 * Faceted double-terminated Pelagian sapphire/amber boost crystal (kills crude yellow octahedron!).
 */
function buildBoostCrystalGeo() {
  const parts = [];
  const prism = new THREE.CylinderGeometry(0.16, 0.16, 0.44, 6);
  parts.push(prism);
  const topTip = new THREE.ConeGeometry(0.16, 0.28, 6);
  topTip.translate(0, 0.36, 0);
  parts.push(topTip);
  const botTip = new THREE.ConeGeometry(0.16, 0.28, 6);
  botTip.rotateX(Math.PI);
  botTip.translate(0, -0.36, 0);
  parts.push(botTip);
  const orbitRing = new THREE.TorusGeometry(0.32, 0.028, 6, 18);
  orbitRing.rotateX(Math.PI * 0.38);
  orbitRing.rotateY(0.45);
  parts.push(orbitRing);
  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Sculpted translucent curling foaming river wave-crest ramp (ZERO flat boxes!).
 */
function buildWaveCrestRampGeo() {
  // Wide, low, sloped foaming river-rapid hydraulic launch ledge (ZERO round blue jelly domes!)
  const w = 3.15;
  const len = 3.90;
  const geo = new THREE.PlaneGeometry(w, len, 20, 20);
  geo.rotateX(-Math.PI * 0.5);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const colDeep = new THREE.Color('#0c5e72');
  const colMid = new THREE.Color('#38c5d0');
  const colFoam = new THREE.Color('#f4ffff');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const rx = pos.getX(i);
    let rz = pos.getZ(i);
    const u = clamp(Math.abs(rx) / (w * 0.5), 0, 1);
    const v = clamp((len * 0.5 - rz) / len, 0, 1);
    // Broad flat-shouldered hydraulic chute tapering cleanly into the water at the outer edges
    const latProfile = Math.pow(Math.max(0, 1 - Math.pow(u, 4.2)), 0.58);

    let y = -0.10;
    if (v < 0.84) {
      // Sleek low-angle planar surging launch ramp rising cleanly to a foaming crest lip
      const t = v / 0.84;
      y = lerp(-0.10, 0.48, Math.pow(t, 1.35)) * latProfile - (1 - latProfile) * 0.08;
    } else {
      // Crisp drop-off behind breaking whitewater lip
      const t = (v - 0.84) / 0.16;
      y = lerp(0.48, -0.10, t * t) * latProfile - (1 - latProfile) * 0.08;
      rz -= Math.sin(t * Math.PI) * 0.18 * latProfile;
    }

    y += Math.sin(rx * 4.2 + v * 6.0) * 0.018 * latProfile * v;
    pos.setXYZ(i, rx, y, rz);

    if (v < 0.36) {
      tmp.copy(colDeep).lerp(colMid, clamp((v / 0.36) * latProfile, 0, 1));
    } else {
      // Rich bright whitewater foaming hydraulic crest across upper ramp & lip
      const f = clamp((v - 0.36) / 0.34, 0, 1);
      tmp.copy(colMid).lerp(colFoam, Math.pow(f, 0.72) * (0.65 + 0.35 * latProfile));
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Layered 3D crossed pine-bough cluster for `biome_foliage_redwood.webp` (`alphaTest: 0.50`,
 * `transparent: false` — crisp dark redwood pine silhouette with ZERO Play-Doh clay & ZERO white halo!).
 */
function buildRedwoodBoughClusterGeo() {
  const planes = [];
  const specs = [
    { rotY: 0.0, y: 2.3, w: 3.9, h: 4.9, tilt: 0.04 },
    { rotY: Math.PI / 3, y: 2.4, w: 3.8, h: 4.8, tilt: -0.05 },
    { rotY: (2 * Math.PI) / 3, y: 2.2, w: 3.7, h: 4.7, tilt: 0.05 },
    { rotY: Math.PI * 0.5, y: 3.3, w: 2.7, h: 3.5, tilt: -0.04 },
  ];
  for (const sp of specs) {
    const p = new THREE.PlaneGeometry(sp.w, sp.h, 2, 2);
    const pos = p.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      const vn = (py + sp.h * 0.5) / sp.h;
      pos.setZ(i, Math.sin(vn * Math.PI * 0.85) * 0.28);
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
 * Rugged craggy mossy canyon rock cluster for `biome_rock_limestone_{albedo,normal}.webp`
 * tinted `#5d7856` (replaces smooth green Play-Doh shelf blobs & otter blob!).
 */
function buildCraggyMossyRockGeo() {
  const parts = [];
  const specs = [
    { x: 0.0, y: 0.34, z: 0.0, rx: 0.92, ry: 0.52, rz: 0.84, seed: 3.1 },
    { x: -0.68, y: 0.26, z: 0.34, rx: 0.66, ry: 0.42, rz: 0.62, seed: 7.4 },
    { x: 0.62, y: 0.30, z: -0.28, rx: 0.70, ry: 0.46, rz: 0.64, seed: 11.9 },
  ];
  for (const sp of specs) {
    const g = new THREE.SphereGeometry(1.0, 10, 7);
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const vx = gp.getX(i);
      const vy = gp.getY(i);
      const vz = gp.getZ(i);
      const crag =
        1.0 +
        0.22 * Math.sin(vx * 3.8 + sp.seed) * Math.cos(vz * 4.1 - sp.seed) +
        0.14 * Math.cos(vy * 5.2 + vx * 2.9);
      const flatBase = vy < -0.35 ? 0.55 : 1.0;
      gp.setXYZ(i, vx * sp.rx * crag + sp.x, vy * sp.ry * crag * flatBase + sp.y, vz * sp.rz * crag + sp.z);
    }
    g.computeVertexNormals();
    parts.push(g);
  }
  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Spiked weathered antique-bronze/iron Pelagian Siphon Mine hazard
 * (replaces smooth orange ping-pong ball!).
 */
function buildSpikedSiphonMineGeo() {
  const parts = [];
  // Riveted iron-bronze sphere body
  const hull = new THREE.SphereGeometry(0.52, 14, 10);
  parts.push(hull);

  // Heavy beveled equatorial bronze armor flange ring
  const flange = new THREE.TorusGeometry(0.54, 0.075, 7, 18);
  flange.rotateX(Math.PI * 0.5);
  parts.push(flange);

  const vertFlange = new THREE.TorusGeometry(0.53, 0.055, 6, 16);
  parts.push(vertFlange);

  // 14 heavy conical bronze detonator horns radiating in 3D
  const dirs = [
    [0, 1, 0], [0, -1, 0],
    [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    [0.7, 0.7, 0.7], [-0.7, 0.7, 0.7], [0.7, 0.7, -0.7], [-0.7, 0.7, -0.7],
    [0.7, -0.7, 0.7], [-0.7, -0.7, 0.7], [0.7, -0.7, -0.7], [-0.7, -0.7, -0.7],
  ];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (const [dx, dy, dz] of dirs) {
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const spike = new THREE.ConeGeometry(0.095, 0.34, 6);
    spike.translate(0, 0.64, 0);
    q.setFromUnitVectors(up, dir);
    spike.applyQuaternion(q);
    parts.push(spike);

    const collar = new THREE.CylinderGeometry(0.115, 0.13, 0.07, 6);
    collar.translate(0, 0.49, 0);
    collar.applyQuaternion(q);
    parts.push(collar);
  }

  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

function buildSteppedCliffGeo(seed = 1) {
  const geo = new THREE.CylinderGeometry(3.4, 5.2, 13.5, 12, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + 6.75) / 13.5;
    const terrace =
      1.0 -
      yn * 0.22 +
      0.14 * Math.sin(yn * 16.0 + seed) +
      0.09 * Math.cos(Math.atan2(z, x) * 4 + seed);
    x *= terrace;
    z *= terrace * 1.15;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildStratifiedLedgeGeo(seed = 77) {
  const geo = new THREE.CylinderGeometry(2.15, 2.75, 2.2, 10, 5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const yn = (y + 1.1) / 2.2;
    const ang = Math.atan2(z, x);
    const step = 1.0 + 0.14 * Math.cos(ang * 3 + seed) + 0.08 * Math.sin(yn * 9.0 + seed);
    x *= step * 1.08;
    z *= step * 1.38;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildRockBoulderGeo(radius = 0.78, seed = 11) {
  const geo = new THREE.SphereGeometry(radius, 18, 14);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const n =
      1.0 +
      0.16 * Math.sin(x * 4.2 + seed) * Math.cos(z * 3.8 - seed) +
      0.10 * Math.cos(y * 5.5 + x * 3.1);
    x *= n * 1.22;
    y *= n * 0.76;
    z *= n * 1.08;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function loadLocalWebpTex(url, isSrgb = true, repeatX = 1, repeatY = 1, onReady = null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(
      url,
      (t) => {
        t.wrapS = repeatX !== 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        t.wrapT = repeatY !== 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        if (repeatX !== 1 || repeatY !== 1) t.repeat.set(repeatX, repeatY);
        t.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.needsUpdate = true;
        onReady?.(t);
      },
      undefined,
      () => {}
    );
    return tex;
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
    this._disposed = false;
    this._lastTime = 0;

    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();

    const rampTexs = createWaveRampTextures(256);
    this.rampAlbedoTex = rampTexs.albedoTex;
    this.rampNormalTex = rampTexs.normalTex;

    const foliageTexs = createFoliageDetailTextures(256);
    this.foliageAlbedoTex = foliageTexs.albedoTex;
    this.foliageNormalTex = foliageTexs.normalTex;

    this.sandstoneTex = createSandstoneStrataTexture(256);
    this.sandstoneTex.repeat.set(2, 2);
    this.redwoodFallbackTex = createRedwoodFallbackTexture(256);
    this.hydroRuneTex = createHydroRuneOverlayTexture(256);
    this.mistTex = createSoftRadialMistTexture(128);
    this.wakeRibbonTex = createSoftWakeRibbonTexture(128, 256);
    this.waterfallTex = createFeatheredWaterfallTexture();
    this.skyBackdropTex = createHorizonSkyTexture();

    this._initScene();
    this._loadAssets();
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
      const savedVis = [];
      this.scene.traverse((o) => {
        if (!o.visible) {
          savedVis.push(o);
          o.visible = true;
        }
      });
      this.webgl?.compile?.(this.scene, this.camera);
      for (const o of savedVis) o.visible = false;
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
    this.scene.background = new THREE.Color('#2474b5');
    this.scene.fog = new THREE.FogExp2('#c9b498', 0.0108);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.52;
    }

    this.camera = new THREE.PerspectiveCamera(56, this.width / Math.max(1, this.height), 0.2, 180);

    // Unified Main-Game Lighting: warm golden directional key + cool azure hemisphere bounce + warm rim
    this.hemiLight = new THREE.HemisphereLight('#7cc8f0', '#28455c', 1.38);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff1d6', 2.25);
    this.sunLight.position.set(16, 26, 20);
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight('#fcd39d', 0.95);
    this.rimLight.position.set(-16, 14, 10);
    this.scene.add(this.rimLight);

    this.wakeLight = new THREE.PointLight('#5efce8', 1.25, 8.0);
    this.scene.add(this.wakeLight);

    // Sunlit Canyon Gorge Studio-Painted Panorama (`assets/textures/mg_bg_rapids_surf.webp`)
    this.skyBackdropMat = new THREE.MeshBasicMaterial({
      map: this.skyBackdropTex,
      fog: false,
      depthWrite: false,
    });
    this.skyBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.skyBackdropMat);
    this.skyBackdrop.position.set(0, 14, -104);
    this.scene.add(this.skyBackdrop);

    // Real Animated GLSL Multi-Wave Fresnel Specular Whitewater Canyon River (ZERO Voronoi grid!)
    const riverGeo = new THREE.PlaneGeometry(34, 134, 34, 56);
    riverGeo.rotateX(-Math.PI * 0.5);
    this.riverGeo = riverGeo;
    this.riverMat = new THREE.ShaderMaterial({
      vertexShader: RAPIDS_WATER_VERT,
      fragmentShader: RAPIDS_WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDist: { value: 0 },
        uDeepColor: { value: new THREE.Color('#07485c') },
        uShallowColor: { value: new THREE.Color('#0e9aa4') },
        uSkyColor: { value: new THREE.Color('#f4d9a8') },
        uSunColor: { value: new THREE.Color('#fff1d6') },
        uSunDir: { value: new THREE.Vector3(16, 26, 20).normalize() },
        uFogColor: { value: new THREE.Color('#c9b498') },
        uFogDensity: { value: 0.0108 },
        uHeroXZ: { value: new THREE.Vector2(0, 0) },
      },
    });
    this.riverMesh = new THREE.Mesh(riverGeo, this.riverMat);
    this.riverMesh.position.set(0, 0, -42);
    this.scene.add(this.riverMesh);

    // Enclosing 3D Stratified Sedona Sandstone Gorge + 3D Sculpted Conifers & Mossy Shrubs + Waterfall Mist
    this.cliffMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.sandstoneTex,
      roughness: 0.76,
      metalness: 0.04,
    });
    this.coniferMat = new THREE.MeshStandardMaterial({
      color: '#466c49',
      roughness: 0.78,
      metalness: 0.02,
      alphaTest: 0.50,
      side: THREE.DoubleSide,
      transparent: false,
    });
    this.mossyRockMat = new THREE.MeshStandardMaterial({
      color: '#526b4e',
      map: this.sandstoneTex,
      roughness: 0.84,
      metalness: 0.04,
    });
    this.waterfallMat = new THREE.MeshBasicMaterial({
      map: this.waterfallTex,
      color: '#f0fdfa',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waterfallMistMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#e8fbff',
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const cliffProtoGeo = buildSteppedCliffGeo(19);
    const shelfProtoGeo = buildStratifiedLedgeGeo(77);
    const coniferGeo = buildRedwoodBoughClusterGeo();
    const mossyRockGeo = buildCraggyMossyRockGeo();
    const fallsGeo = new THREE.PlaneGeometry(2.05, 10.6);
    const mistCurtainGeo = new THREE.PlaneGeometry(3.4, 3.0);

    const sidePairs = MAX_GORGE_SEGS * 2;
    this.gorgeCliffInst = new THREE.InstancedMesh(cliffProtoGeo, this.cliffMat, sidePairs);
    this.gorgeShelfInst = new THREE.InstancedMesh(shelfProtoGeo, this.cliffMat, sidePairs);
    this.gorgeTreeInst = new THREE.InstancedMesh(coniferGeo, this.coniferMat, sidePairs * 2);
    this.gorgeShrubInst = new THREE.InstancedMesh(mossyRockGeo, this.mossyRockMat, sidePairs * 2);
    this.gorgeFallsInst = new THREE.InstancedMesh(fallsGeo, this.waterfallMat, sidePairs);
    this.gorgeMistInst = new THREE.InstancedMesh(mistCurtainGeo, this.waterfallMistMat, sidePairs * 2);
    for (const im of [
      this.gorgeCliffInst,
      this.gorgeShelfInst,
      this.gorgeTreeInst,
      this.gorgeShrubInst,
      this.gorgeFallsInst,
      this.gorgeMistInst,
    ]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Gateway + Sculpted Carved-Wood & Inlaid-Bronze Pelagian Hydro-Skimmer Board!
    this.heroRoot = new THREE.Group();

    const boardParts = buildHydroSkimmerBoardParts();
    this.boardWoodMat = new THREE.MeshStandardMaterial({
      color: '#f0e2d4',
      map: this.redwoodFallbackTex,
      roughness: 0.36,
      metalness: 0.14,
    });
    this.boardBronzeMat = new THREE.MeshStandardMaterial({
      color: '#e5be7e',
      roughness: 0.28,
      metalness: 0.84,
    });
    this.boardRuneMat = new THREE.MeshStandardMaterial({
      color: '#7df9ff',
      map: this.hydroRuneTex,
      emissive: '#38bdf8',
      emissiveMap: this.hydroRuneTex,
      emissiveIntensity: 1.25,
      roughness: 0.18,
      metalness: 0.15,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });

    this.hydroBoardGroup = new THREE.Group();
    this.boardHullMesh = new THREE.Mesh(boardParts.hullGeo, this.boardWoodMat);
    this.boardBronzeMesh = new THREE.Mesh(boardParts.bronzeGeo, this.boardBronzeMat);
    this.boardRuneMesh = new THREE.Mesh(boardParts.runeGeo, this.boardRuneMat);
    this.hydroBoardGroup.add(this.boardHullMesh, this.boardBronzeMesh, this.boardRuneMesh);
    this.hydroBoardGroup.position.set(0, 0.05, 0.08);
    this.heroRoot.add(this.hydroBoardGroup);

    // Soft Feathered Radial-Alpha Whitewater Wake Mist trailing behind swallowtail (1 merged draw call!)
    this.hydroWakeGroup = new THREE.Group();
    const wakeRibbons = [];
    for (const sx of [-1, 1]) {
      const wingGeo = new THREE.PlaneGeometry(0.86, 3.15, 4, 8);
      wingGeo.rotateX(-Math.PI * 0.48);
      wingGeo.rotateY(-sx * 0.28);
      wingGeo.translate(sx * 0.56, 0.07, 1.85);
      wakeRibbons.push(wingGeo);
    }
    const centerPlumeGeo = new THREE.PlaneGeometry(0.88, 2.75, 4, 6);
    centerPlumeGeo.rotateX(-Math.PI * 0.49);
    centerPlumeGeo.translate(0, 0.05, 1.98);
    wakeRibbons.push(centerPlumeGeo);

    const mergedWakeGeo = safeMergeGeos(wakeRibbons);
    for (const w of wakeRibbons) w.dispose();
    this.wakeRibbonMat = new THREE.MeshBasicMaterial({
      map: this.wakeRibbonTex,
      color: '#dffbff',
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.wakeMistMesh = new THREE.Mesh(mergedWakeGeo, this.wakeRibbonMat);
    this.hydroWakeGroup.add(this.wakeMistMesh);
    this.heroRoot.add(this.hydroWakeGroup);

    this.surfHero = new AdaptiveSurfHero(this.skinId);
    this.surfHero.group.scale.setScalar(1.48);
    this.surfHero.group.position.set(0, 0.14, 0);
    this.heroRoot.add(this.surfHero.group);
    this.scene.add(this.heroRoot);

    // Carved Bronze-and-Sandstone Pelagian River Boost Gates (`1X..4X`, instanced stone + bronze + curtains!)
    const gateParts = buildPelagianRiverGateParts();
    this.gateStoneMat = new THREE.MeshStandardMaterial({
      color: '#eddcc7',
      map: this.sandstoneTex,
      roughness: 0.62,
      metalness: 0.08,
    });
    this.gateStoneInst = new THREE.InstancedMesh(gateParts.stoneGeo, this.gateStoneMat, MAX_GATES);
    this.gateBronzeInst = new THREE.InstancedMesh(gateParts.bronzeGeo, this.boardBronzeMat, MAX_GATES);
    this.gateCurtainMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const gateCurtainGeo = new THREE.PlaneGeometry(2.65, 2.55);
    gateCurtainGeo.translate(0, 1.85, 0);
    this.gateCurtainInst = new THREE.InstancedMesh(gateCurtainGeo, this.gateCurtainMat, MAX_GATES);
    for (const im of [this.gateStoneInst, this.gateBronzeInst, this.gateCurtainInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Sculpted Translucent Foaming River Wave-Crest Ramps + Crest Spray Mist
    const rampGeo = buildWaveCrestRampGeo();
    this.rampMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      map: this.rampAlbedoTex,
      normalMap: this.rampNormalTex,
      normalScale: new THREE.Vector2(0.92, 0.92),
      emissive: '#095f70',
      emissiveIntensity: 0.22,
      roughness: 0.10,
      metalness: 0.16,
      transparent: true,
      opacity: 0.90,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rampInst = new THREE.InstancedMesh(rampGeo, this.rampMat, MAX_RAMPS);
    this.rampInst.frustumCulled = false;
    this.scene.add(this.rampInst);

    const rampMistGeo = new THREE.PlaneGeometry(2.55, 1.05);
    this.rampMistMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#ecfeff',
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rampMistInst = new THREE.InstancedMesh(rampMistGeo, this.rampMistMat, MAX_RAMPS);
    this.rampMistInst.frustumCulled = false;
    this.scene.add(this.rampMistInst);

    // Feathered Whitewater Foam Collars hugging the waterline base of every Arch Pier, River Boulder & Ramp (1 draw call!)
    const pierFoamGeo = new THREE.PlaneGeometry(1.85, 2.55);
    pierFoamGeo.rotateX(-Math.PI * 0.5);
    this.pierFoamMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#ecfeff',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pierFoamInst = new THREE.InstancedMesh(pierFoamGeo, this.pierFoamMat, MAX_GATES * 2 + MAX_HAZARDS + MAX_RAMPS);
    this.pierFoamInst.frustumCulled = false;
    this.scene.add(this.pierFoamInst);

    // Hazards (Wet Stratified River Boulders, Carved Timber Crates, Siphon Surge Mines)
    const boulderGeo = buildRockBoulderGeo(0.76, 33);
    this.boulderMat = new THREE.MeshStandardMaterial({
      color: '#f5ebe0',
      map: this.sandstoneTex,
      roughness: 0.36,
      metalness: 0.08,
    });
    this.boulderInst = new THREE.InstancedMesh(boulderGeo, this.boulderMat, MAX_HAZARDS);
    this.crateMat = new THREE.MeshStandardMaterial({
      color: '#dfb895',
      map: this.redwoodFallbackTex,
      roughness: 0.58,
      metalness: 0.18,
    });
    this.crateInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.95, 0.85, 0.95),
      this.crateMat,
      MAX_HAZARDS
    );
    this.mineGeo = buildSpikedSiphonMineGeo();
    this.mineMat = new THREE.MeshStandardMaterial({
      color: '#5a4a3c',
      emissive: '#9a3412',
      emissiveIntensity: 0.24,
      metalness: 0.84,
      roughness: 0.34,
    });
    this.mineInst = new THREE.InstancedMesh(this.mineGeo, this.mineMat, MAX_HAZARDS);
    for (const im of [this.boulderInst, this.crateInst, this.mineInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Faceted Sapphire/Amber Pelagian Boost Crystals (`sk.gears`) & Hydro-Pulse Bolts
    this.seedInst = new THREE.InstancedMesh(
      buildBoostCrystalGeo(),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#d97706',
        emissiveIntensity: 0.72,
        roughness: 0.14,
        metalness: 0.62,
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
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshBasicMaterial({
        map: this.mistTex,
        color: '#ebfcff',
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      MAX_SPRAY
    );
    for (const im of [this.seedInst, this.boltInst, this.sprayInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }
  }

  _loadAssets() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;

    // Brand-new Studio PBR Carved Skimmer Wood + Verdigris/Gold Filigree Inlays (`mg_pbr_skimmer_wood`)
    loadLocalWebpTex('assets/textures/mg_pbr_skimmer_wood_albedo.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      this.boardWoodMat.map = t;
      this.boardWoodMat.needsUpdate = true;
      this.crateMat.map = t;
      this.crateMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/mg_pbr_skimmer_wood_normal.webp', false, 1, 1, (t) => {
      if (this._disposed) return;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      this.boardWoodMat.normalMap = t;
      this.boardWoodMat.normalScale.set(1.0, 1.0);
      this.boardWoodMat.needsUpdate = true;
      this.crateMat.normalMap = t;
      this.crateMat.normalScale.set(0.95, 0.95);
      this.crateMat.needsUpdate = true;
    });

    // Antique Bronze PBR maps for Board Rails/Fins, Pelagian River Gate Collars & Spiked Siphon Mines
    loadLocalWebpTex('assets/textures/arch_antique_bronze_albedo.webp', true, 2, 1, (t) => {
      if (this._disposed) return;
      this.boardBronzeMat.map = t;
      this.boardBronzeMat.needsUpdate = true;
      this.mineMat.map = t;
      this.mineMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/arch_antique_bronze_normal.webp', false, 2, 1, (t) => {
      if (this._disposed) return;
      this.boardBronzeMat.normalMap = t;
      this.boardBronzeMat.normalScale.set(1.0, 1.0);
      this.boardBronzeMat.needsUpdate = true;
      this.mineMat.normalMap = t;
      this.mineMat.normalScale.set(1.1, 1.1);
      this.mineMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/arch_antique_bronze_orm.webp', false, 2, 1, (t) => {
      if (this._disposed) return;
      this.boardBronzeMat.roughnessMap = t;
      this.boardBronzeMat.metalnessMap = t;
      this.boardBronzeMat.needsUpdate = true;
      this.mineMat.roughnessMap = t;
      this.mineMat.metalnessMap = t;
      this.mineMat.needsUpdate = true;
    });

    // Dark Redwood Pine Boughs (`alphaTest: 0.50`) + Rugged Mossy Limestone Canyon Rocks
    loadLocalWebpTex('assets/textures/biome_foliage_redwood.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.coniferMat.map = t;
      this.coniferMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/biome_rock_limestone_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.mossyRockMat.map = t;
      this.mossyRockMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/biome_rock_limestone_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.mossyRockMat.normalMap = t;
      this.mossyRockMat.normalScale.set(1.25, 1.25);
      this.mossyRockMat.needsUpdate = true;
    });

    // Carved Sandstone Masonry for Pelagian River Boost Gates
    loadLocalWebpTex('assets/textures/arch_canyon_sandstone_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.gateStoneMat.map = t;
      this.gateStoneMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/arch_canyon_sandstone_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.gateStoneMat.normalMap = t;
      this.gateStoneMat.normalScale.set(1.15, 1.15);
      this.gateStoneMat.needsUpdate = true;
    });

    // Brand-new Studio PBR Stratified Sedona Sandstone Cliff Strata (`mg_pbr_sedona_strata`, ZERO Voronoi cracks!)
    loadLocalWebpTex('assets/textures/mg_pbr_sedona_strata_albedo.webp', true, 2, 2, (t) => {
      if (this._disposed) return;
      this.cliffMat.map = t;
      this.cliffMat.needsUpdate = true;
      this.boulderMat.map = t;
      this.boulderMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/mg_pbr_sedona_strata_normal.webp', false, 2, 2, (t) => {
      if (this._disposed) return;
      this.cliffMat.normalMap = t;
      this.cliffMat.normalScale.set(1.35, 1.35);
      this.cliffMat.needsUpdate = true;
      this.boulderMat.normalMap = t;
      this.boulderMat.normalScale.set(1.15, 1.15);
      this.boulderMat.needsUpdate = true;
    });

    // Canyon Backdrop Panorama
    loadLocalWebpTex('assets/textures/mg_bg_rapids_surf.webp', true, 1, 1, (t) => {
      if (this._disposed) return;
      this.skyBackdropWebp = t;
      this.skyBackdropMat.map = t;
      this.skyBackdropMat.needsUpdate = true;
    });
  }

  render(state, _opts = {}) {
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
    this.hemiLight.color.set(th.hemiSky);
    this.hemiLight.groundColor.set(th.hemiGnd);
    this.cliffMat.color.set(th.cliff);

    const dist = Number(sk.distance) || time * 18;
    const boostMult = Math.max(1, Number(sk.boostMult) || 1);
    const laneX = Number(sk.laneX) || 0;
    const heroY = Math.max(0, Number(sk.y) || 0) + Math.sin(time * 8.5) * 0.032;
    const bank = clamp((Number(sk.vx) || 0) / 9.0, -1, 1);

    // Update GPU GLSL Fresnel Specular Water Shader uniforms (0 CPU vertex loops!)
    const u = this.riverMat.uniforms;
    u.uTime.value = time;
    u.uDist.value = dist;
    u.uDeepColor.value.set(th.waterDeep);
    u.uShallowColor.value.set(th.waterShallow);
    u.uSkyColor.value.set(th.waterSky);
    u.uSunColor.value.set(th.sun);
    u.uFogColor.value.set(th.fog);
    u.uHeroXZ.value.set(laneX, 0);

    this.waterfallTex.offset.set(0, -(time * 1.35) % 1);

    // Loop Instanced Canyon Cliffs, Stratified Ledges, 3D Sculpted Conifers & Mossy Shrubs + Waterfall Mist
    const gorgeStep = GORGE_SPAN_Z / MAX_GORGE_SEGS;
    const dm = this._dummy;
    let cIdx = 0;
    let tIdx = 0;
    let sIdx = 0;
    let fIdx = 0;
    let mIdx = 0;

    for (let i = 0; i < MAX_GORGE_SEGS; i++) {
      const wrappedZ = (((i * gorgeStep + dist) % GORGE_SPAN_Z) + GORGE_SPAN_Z) % GORGE_SPAN_Z;
      const segZ = 8 - wrappedZ;
      for (const side of [-1, 1]) {
        // Stepped Stratified Sedona Sandstone Cliff
        dm.position.set(side * (11.6 + (i % 2) * 0.85), 5.6, segZ);
        dm.rotation.set(0, i * 0.65 + (side > 0 ? 1.2 : 0), 0);
        dm.scale.set(1.15, 1.0 + (i % 3) * 0.18, 1.18);
        dm.updateMatrix();
        this.gorgeCliffInst.setMatrixAt(cIdx, dm.matrix);

        // Angular Stratified Riverbank Sandstone Ledge
        const shelfX = side * (7.6 + (i % 2) * 0.42);
        dm.position.set(shelfX, 0.32, segZ + 1.1);
        dm.rotation.set(0, i * 0.55 + side * 0.4, 0);
        dm.scale.set(1.05, 0.72, 1.22);
        dm.updateMatrix();
        this.gorgeShelfInst.setMatrixAt(cIdx++, dm.matrix);

        // Real 3D Sculpted Redwood Conifers crowning upper canyon cliff rims (ZERO 2D cardboard cards!)
        for (let k = 0; k < 2; k++) {
          dm.position.set(side * (9.2 + k * 1.35), 11.4 + ((i + k) % 3) * 0.85, segZ + (k - 0.5) * 2.4);
          dm.rotation.set(0, i * 0.8 + k * 1.6, 0);
          dm.scale.setScalar(0.88 + ((i + k) % 3) * 0.16);
          dm.updateMatrix();
          this.gorgeTreeInst.setMatrixAt(tIdx++, dm.matrix);
        }

        // Real 3D Sculpted Mossy Canyon Shrubs nestled on lower canyon ledges (replaces otter blob!)
        for (let k = 0; k < 2; k++) {
          const rx = shelfX - side * (0.45 + k * 0.65);
          const rz = segZ + (k === 0 ? 0.4 : 2.5);
          dm.position.set(rx, 0.82 + k * 0.22, rz);
          dm.rotation.set(0, i * 1.1 + k * 1.7, 0);
          dm.scale.setScalar(0.76 + ((i + k) % 3) * 0.18);
          dm.updateMatrix();
          this.gorgeShrubInst.setMatrixAt(sIdx++, dm.matrix);
        }

        // Cliffside Waterfall + Soft Drifting Alpha Waterfall Mist Curtains
        if ((i + (side > 0 ? 1 : 0)) % 3 === 0) {
          dm.position.set(side * 7.05, 5.2, segZ);
          dm.rotation.set(0, -side * 0.22, 0);
          dm.scale.setScalar(1);
          dm.updateMatrix();
          this.gorgeFallsInst.setMatrixAt(fIdx++, dm.matrix);

          for (let m = 0; m < 2; m++) {
            const driftPhase = (time * 0.65 + i * 0.31 + m * 0.5) % 1;
            const my = 0.85 + driftPhase * 2.35;
            const mx = side * (6.95 - driftPhase * 0.65);
            const ms = 0.85 + Math.sin(driftPhase * Math.PI) * 0.48;
            dm.position.set(mx, my, segZ + (m - 0.5) * 1.25);
            dm.rotation.set(0, -side * 0.28, Math.sin(time * 0.9 + m) * 0.12);
            dm.scale.set(ms * 1.15, ms * 0.92, 1);
            dm.updateMatrix();
            this.gorgeMistInst.setMatrixAt(mIdx++, dm.matrix);
          }
        }
      }
    }
    this.gorgeCliffInst.count = cIdx;
    this.gorgeShelfInst.count = cIdx;
    this.gorgeTreeInst.count = tIdx;
    this.gorgeShrubInst.count = sIdx;
    this.gorgeFallsInst.count = fIdx;
    this.gorgeMistInst.count = mIdx;
    this.gorgeCliffInst.instanceMatrix.needsUpdate = true;
    this.gorgeShelfInst.instanceMatrix.needsUpdate = true;
    this.gorgeTreeInst.instanceMatrix.needsUpdate = true;
    this.gorgeShrubInst.instanceMatrix.needsUpdate = true;
    this.gorgeFallsInst.instanceMatrix.needsUpdate = true;
    this.gorgeMistInst.instanceMatrix.needsUpdate = true;

    // Update Gateway carving in dynamic crouched surfer lean stance on her Hydro-Skimmer Board!
    this.heroRoot.position.set(laneX, heroY, 0);
    this.heroRoot.rotation.set(clamp((sk.vy || 0) * 0.04, -0.28, 0.35), -bank * 0.18, -bank * 0.28);
    this.hydroBoardGroup.visible = true;
    this.boardRuneMat.emissiveIntensity = 1.15 + (boostMult - 1) * 0.35 + Math.sin(time * 6.0) * 0.18;
    const onWaterAlpha = clamp(1 - heroY * 2.2, 0, 1);
    this.hydroWakeGroup.visible = onWaterAlpha > 0.04;
    this.wakeRibbonMat.opacity = 0.56 * onWaterAlpha;
    this.hydroWakeGroup.scale.set(1 + Math.abs(bank) * 0.22, 1, 1 + (boostMult - 1) * 0.18);
    this.wakeLight.position.set(laneX, heroY + 0.85, 0.6);

    const onWater = Boolean(sk.onWater ?? heroY < 0.25);
    this.surfHero.update(dt, {
      time,
      vx: sk.vx || 0,
      vy: sk.vy || 0,
      onGround: onWater,
      surfing: onWater,
      rapidsSurf: onWater,
      anim: !onWater ? 'AirRise' : 'RapidsSurf',
      surfBank: bank,
      landSquash: onWater ? 0.54 + Math.abs(bank) * 0.28 : 0.08,
      frillFlare: 0.40 + (boostMult - 1) * 0.2,
    });

    // Carved Bronze-and-Sandstone Pelagian River Boost Gates + Waterline Pier Foam Collars
    const gates = sk.gates || [];
    const tierCol = BOOST_TIER_COLORS[Math.min(3, boostMult - 1)];
    this.gateCurtainMat.color.set(tierCol.curtain);
    let gCnt = 0;
    let pfCnt = 0;
    const pfMax = this.pierFoamInst ? this.pierFoamInst.instanceMatrix.count : 0;
    for (let i = 0; i < gates.length && gCnt < MAX_GATES; i++) {
      const gt = gates[i];
      if (gt.hit) continue;
      const wz = -(gt.z - dist);
      if (wz > 6 || wz < -95) continue;
      const gx = gt.laneX || 0;
      dm.position.set(gx, 0.0, wz);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.gateStoneInst.setMatrixAt(gCnt, dm.matrix);
      this.gateBronzeInst.setMatrixAt(gCnt, dm.matrix);
      this.gateCurtainInst.setMatrixAt(gCnt++, dm.matrix);

      // Feathered whitewater foam collars around both stone arch pier bases!
      for (const side of [-1.72, 1.72]) {
        if (pfCnt < pfMax) {
          const pulse = 0.94 + Math.sin(time * 4.5 + i + side) * 0.08;
          dm.position.set(gx + side, 0.045, wz + 0.35);
          dm.rotation.set(0, 0, 0);
          dm.scale.set(0.95 * pulse, 1, 1.15 * pulse);
          dm.updateMatrix();
          this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
        }
      }
    }
    this.gateStoneInst.count = gCnt;
    this.gateBronzeInst.count = gCnt;
    this.gateCurtainInst.count = gCnt;
    if (gCnt > 0) {
      this.gateStoneInst.instanceMatrix.needsUpdate = true;
      this.gateBronzeInst.instanceMatrix.needsUpdate = true;
      this.gateCurtainInst.instanceMatrix.needsUpdate = true;
    }

    // Sculpted Foaming River Wave-Crest Ramps + Crest Spray Mist + Trailing Whitewater Wake
    const ramps = sk.ramps || [];
    let rCount = 0;
    for (let i = 0; i < ramps.length && rCount < MAX_RAMPS; i++) {
      const rp = ramps[i];
      const wz = -(rp.z - dist);
      if (wz > 6 || wz < -95) continue;
      const surge = 1.0 + Math.sin(time * 4.2 + i) * 0.04;
      dm.position.set(rp.laneX || 0, 0.03, wz);
      dm.rotation.set(0, 0, 0);
      dm.scale.set(1, surge, 1);
      dm.updateMatrix();
      this.rampInst.setMatrixAt(rCount, dm.matrix);

      dm.position.set(rp.laneX || 0, 0.46 * surge + Math.sin(time * 5.5 + i) * 0.04, wz - 1.35);
      dm.rotation.set(0, 0, Math.sin(time * 2.4 + i) * 0.06);
      dm.scale.set(1.25 + Math.sin(time * 3.8 + i) * 0.1, 0.72, 1);
      dm.updateMatrix();
      this.rampMistInst.setMatrixAt(rCount++, dm.matrix);

      if (pfCnt < pfMax) {
        dm.position.set(rp.laneX || 0, 0.05, wz + 0.45);
        dm.rotation.set(0, 0, 0);
        dm.scale.set(1.85, 1, 1.65);
        dm.updateMatrix();
        this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
      }
    }
    this.rampInst.count = rCount;
    this.rampMistInst.count = rCount;
    if (rCount > 0) {
      this.rampInst.instanceMatrix.needsUpdate = true;
      this.rampMistInst.instanceMatrix.needsUpdate = true;
    }

    // Hazards (Boulders + Waterline Foam Collars, Carved Timber Crates, Siphon Surge Mines)
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
        if (pfCnt < pfMax) {
          const bp = 0.92 + Math.sin(time * 5.0 + i) * 0.08;
          dm.position.set(hz.laneX || 0, 0.045, wz + 0.3);
          dm.rotation.set(0, 0, 0);
          dm.scale.set(1.18 * bp, 1, 1.32 * bp);
          dm.updateMatrix();
          this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
        }
      }
    }
    this.boulderInst.count = bCnt;
    this.crateInst.count = cCnt;
    this.mineInst.count = mCnt;
    if (bCnt > 0) this.boulderInst.instanceMatrix.needsUpdate = true;
    if (cCnt > 0) this.crateInst.instanceMatrix.needsUpdate = true;
    if (mCnt > 0) this.mineInst.instanceMatrix.needsUpdate = true;
    if (this.pierFoamInst) {
      this.pierFoamInst.count = pfCnt;
      if (pfCnt > 0) this.pierFoamInst.instanceMatrix.needsUpdate = true;
    }

    // Faceted Sapphire/Amber Boost Crystals (`sk.gears`) & Hydro-Pulse Bolts (`sk.bolts`)
    const seeds = sk.gears || [];
    let sCnt = 0;
    for (let i = 0; i < seeds.length && sCnt < MAX_SEEDS; i++) {
      const g = seeds[i];
      if (g.collected) continue;
      const wz = -(g.z - dist);
      if (wz > 6 || wz < -95) continue;
      dm.position.set(g.laneX || 0, (g.y ?? 0.55) + Math.sin(time * 4 + i) * 0.09, wz);
      dm.rotation.set(0.18, time * 2.8 + i, 0.14);
      dm.scale.setScalar(1.05);
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#38bdf8' : '#fbbf24');
      this.seedInst.setColorAt(sCnt, this._col);
      this.seedInst.setMatrixAt(sCnt++, dm.matrix);
    }
    this.seedInst.count = sCnt;
    if (sCnt > 0) {
      this.seedInst.instanceMatrix.needsUpdate = true;
      if (this.seedInst.instanceColor) this.seedInst.instanceColor.needsUpdate = true;
    }

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

    // Soft Radial-Alpha Whitewater Wake Spray Mist trailing behind the swallowtail!
    let spCnt = 0;
    for (let i = 0; i < MAX_SPRAY; i++) {
      const age = (time * (2.4 + boostMult * 0.38) + i * 0.053) % 1;
      const side = i % 2 === 0 ? -1 : 1;
      const spreadBase = 0.24 + age * (0.65 + Math.abs(bank) * 0.72);
      const arcSpread = (side * spreadBase - bank * 0.45 * age) * (0.75 + (i % 5) * 0.12);
      const sy = heroY + 0.10 + Math.sin(age * Math.PI) * (0.48 + Math.abs(bank) * 0.38);
      const sz = 1.05 + age * 4.6;
      const puffScale = Math.sin(age * Math.PI) * (0.65 + age * 0.85) * (heroY < 0.4 ? 1.08 : 0.30);
      dm.position.set(laneX + arcSpread, sy, sz);
      dm.rotation.set(0, 0, i * 0.7 + time * 1.4 * side);
      dm.scale.setScalar(Math.max(0.001, puffScale));
      dm.updateMatrix();
      this.sprayInst.setMatrixAt(spCnt++, dm.matrix);
    }
    this.sprayInst.count = spCnt;
    this.sprayInst.instanceMatrix.needsUpdate = true;

    // Dynamic Heroic Chase Camera: 100% Portrait (412x915) & Desktop (1920x1080) Aspect-Safe!
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const wantFov = (portrait ? 58 : 48) + (boostMult - 1) * 2.4;
    if (Math.abs(this.camera.fov - wantFov) > 0.1) {
      this.camera.fov = lerp(this.camera.fov, wantFov, 0.12);
      this.camera.updateProjectionMatrix();
    }
    this.surfHero.group.scale.setScalar(portrait ? 1.62 : 1.56);

    const sh = Number(state.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 69) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 57) * sh * 0.02 : 0;
    const camZ = portrait ? 5.35 : 4.35;
    const camY = (portrait ? 2.48 : 2.05) + heroY * 0.42;
    const camX = laneX * (portrait ? 0.80 : 0.64);
    this.camera.position.set(camX + sx, camY + sy, camZ);
    this.camera.lookAt(laneX * (portrait ? 0.90 : 0.86), 0.96 + heroY * 0.35, -4.8);

    // Aspect-cover studio-painted Canyon Gorge panorama backdrop
    const bgDist = camZ + 104;
    const bgH = 2 * Math.tan((this.camera.fov * 0.5) * (Math.PI / 180)) * bgDist * 1.15;
    const bgW = bgH * aspect * 1.15;
    this.skyBackdrop.scale.set(bgW, bgH, 1);
    this.skyBackdrop.position.set(camX, camY + bgH * 0.16, -104);
    if (this.skyBackdropWebp) {
      const imgAspect = 1376 / 768;
      const quadAspect = bgW / Math.max(0.01, bgH);
      if (quadAspect < imgAspect) {
        const repX = clamp(quadAspect / imgAspect, 0.32, 1);
        this.skyBackdropWebp.repeat.set(repX, 1);
        this.skyBackdropWebp.offset.set((1 - repX) * 0.5, 0);
      } else {
        const repY = clamp(imgAspect / quadAspect, 0.52, 1);
        this.skyBackdropWebp.repeat.set(1, repY);
        this.skyBackdropWebp.offset.set(0, (1 - repY) * 0.42);
      }
    }

    this.webgl.setRenderTarget(null);
    this.webgl.render(this.scene, this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.surfHero?.dispose();
    this.rampAlbedoTex?.dispose();
    this.rampNormalTex?.dispose();
    this.sandstoneTex?.dispose();
    this.redwoodFallbackTex?.dispose();
    this.hydroRuneTex?.dispose();
    this.mistTex?.dispose();
    this.wakeRibbonTex?.dispose();
    this.waterfallTex?.dispose();
    this.skyBackdropTex?.dispose();
  }
}

export { SkimmerRenderer as RapidsSurfRenderer };
export default SkimmerRenderer;
