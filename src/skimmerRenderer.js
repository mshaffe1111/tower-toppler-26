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
const MAX_SPRAY = 220;
const MAX_GORGE_SEGS = 12;
const MAX_CANYON_ARCHES = 5;
const MAX_SUNBEAMS = 8;
const GORGE_SPAN_Z = 108;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Unified S-gorge canyon spline: 0 at Gateway (wz >= 0) so steering lanes match game.js 1:1,
// curving dramatically ahead downriver through sculpted cliffs, arches, and waterfalls!
function gorgeCurveX(wz, dist) {
  const dAhead = wz < 0 ? -wz : 0;
  if (dAhead <= 0.001) return 0;
  const f = dAhead < 15.0 ? dAhead / 15.0 : 1.0;
  const f2 = f * f * (3.0 - 2.0 * f);
  return (Math.sin(dAhead * 0.048 + dist * 0.030) * 3.8 + Math.cos(dAhead * 0.025 - dist * 0.017) * 1.45) * f2;
}

function gorgeCurveYaw(wz, dist) {
  const x0 = gorgeCurveX(wz, dist);
  const x1 = gorgeCurveX(wz - 1.5, dist);
  return Math.atan2(x1 - x0, -1.5) * 0.65;
}

function resolveItemWorldZ(itemZ, dist) {
  // game.js decrements item.z each frame so z === 0 is right at Gateway and +z is ahead downriver.
  // Also gracefully supports absolute world coordinates if an external caller passes z > 68.
  const relZ = itemZ > 68 && dist > 60 ? itemZ - dist : itemZ;
  return -relZ;
}

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

// --- ANIMATED GLSL MULTI-WAVE FRESNEL SPECULAR CURVED S-GORGE CANYON RAPIDS WATER SHADER ---
const RAPIDS_WATER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uDist;
  varying vec3 vWorldPos;
  varying float vLocalX;
  varying float vWaveH;
  varying float vCamDist;

  float gorgeCurveX(float wz, float dist) {
    float dAhead = max(0.0, -wz);
    float f = smoothstep(0.0, 15.0, dAhead);
    return (sin(dAhead * 0.048 + dist * 0.030) * 3.8 + cos(dAhead * 0.025 - dist * 0.017) * 1.45) * f;
  }

  void main() {
    vec3 pos = position;
    vec4 baseWorld = modelMatrix * vec4(pos, 1.0);
    float localX = baseWorld.x;
    float curveOffset = gorgeCurveX(baseWorld.z, uDist);
    pos.x += curveOffset;

    float zFlow = baseWorld.z - uDist;

    // 4 layered directional whitewater canyon swells + rolling cross-chop
    float w1 = sin(zFlow * 0.44 + localX * 0.42 + uTime * 2.2) * 0.12;
    float w2 = cos(zFlow * 0.86 - localX * 0.68 + uTime * 3.4) * 0.07;
    float w3 = sin(zFlow * 1.48 + localX * 1.15 - uTime * 4.2) * 0.04;
    float w4 = cos((localX * 0.92 - zFlow * 0.58) + uTime * 2.7) * 0.032;
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
    h += sin(p.y * 2.95 + p.x * 2.35 - t * 4.4) * 0.08;
    h += (fbm(p * vec2(0.55, 0.26) + vec2(0.0, t * 0.48)) - 0.5) * 0.35;
    return h;
  }

  void main() {
    // River coordinate rushing toward camera (+Z relative to world scroll uDist) along S-curve centerline
    vec2 rp = vec2(vLocalX, vWorldPos.z - uDist * 0.96);
    float eps = 0.14;
    float hc = waveHeight(rp, uTime);
    float hx = waveHeight(rp + vec2(eps, 0.0), uTime);
    float hz = waveHeight(rp + vec2(0.0, eps), uTime);
    vec3 N = normalize(vec3((hc - hx) * 1.55, 1.0, (hc - hz) * 1.55));

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uSunDir);

    // Bank shallowness & depth gradient following the curved S-gorge banks
    float bankT = smoothstep(2.0, 7.8, abs(vLocalX));
    vec3 baseWater = mix(uDeepColor, uShallowColor, clamp(0.46 + bankT * 0.46 + vWaveH * 1.8, 0.0, 1.0));

    // Subsurface turquoise sunlight transmission through wave crests
    float sss = pow(clamp(dot(V, normalize(-L + N * 0.48)), 0.0, 1.0), 2.5) * (0.62 + max(0.0, vWaveH) * 3.8);
    baseWater += vec3(0.10, 0.56, 0.52) * sss;

    // Schlick Fresnel sky & sunlit canyon reflection
    float ndotv = max(dot(N, V), 0.0);
    float fresnel = 0.05 + 0.95 * pow(1.0 - ndotv, 4.0);
    vec3 reflSky = mix(uSkyColor, uSunColor, 0.38 + 0.30 * clamp(N.x * 0.5 + 0.5, 0.0, 1.0));
    vec3 col = mix(baseWater, reflSky, fresnel * 0.54);

    // Crisp sunlight specular sparkle + broad water sheen
    vec3 H = normalize(L + V);
    float specSharp = pow(max(dot(N, H), 0.0), 112.0);
    float specBroad = pow(max(dot(N, H), 0.0), 20.0);
    col += uSunColor * (specSharp * 1.85 + specBroad * 0.28);

    // Domain-warped organic whitewater rushing current foam & curved canyon shoreline rapids
    vec2 fUv = vec2(rp.x * 0.68, rp.y * 0.21);
    float warp = fbm(fUv + vec2(0.0, uTime * 0.42));
    float currentNoise = fbm(fUv * vec2(2.1, 1.35) + vec2(warp * 1.55, -uTime * 0.68));
    float crestFoam = smoothstep(0.55, 0.78, currentNoise + vWaveH * 1.25);
    float bankFoam = smoothstep(5.4, 8.2, abs(vLocalX) + (currentNoise - 0.5) * 1.85);

    // Dynamic V-shaped hydro wake + rooster-tail trench carved right behind Gateway
    vec2 toHero = vec2(vLocalX - uHeroXZ.x, vWorldPos.z - uHeroXZ.y);
    float wakeV = exp(-pow(abs(toHero.x) - max(0.0, toHero.y) * 0.34, 2.0) * 5.2) *
                  smoothstep(-0.25, 0.35, toHero.y) * smoothstep(6.2, 0.6, toHero.y);
    float wakeCore = exp(-toHero.x * toHero.x * 6.5) * smoothstep(0.0, 0.5, toHero.y) * smoothstep(4.2, 0.5, toHero.y);
    float totalFoam = clamp(crestFoam * 0.62 + bankFoam * 0.88 + (wakeV * 0.82 + wakeCore * 0.55) * (0.62 + currentNoise * 0.55), 0.0, 0.96);
    vec3 foamCol = mix(vec3(0.90, 0.99, 1.0), uSunColor, 0.14);
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
    const trickSpin = pose.trickSpin || 0;
    const airGrab = pose.airGrab || 0;
    if (this.liveRig?.update) {
      try {
        // Athletic dynamic 3/4 carving stance + expressive mid-air 360° trick-flip!
        this.liveRig.group.rotation.order = 'YXZ';
        this.liveRig.group.rotation.y = Math.PI + 0.44 + bank * 0.34 + trickSpin;
        this.liveRig.group.rotation.x = -0.14 - Math.abs(bank) * 0.08 + airGrab * 0.36;
        this.liveRig.group.rotation.z = -bank * 0.22;
        this.liveRig.update(dt, pose);
        return;
      } catch {
        // Fallback
      }
    }
    const t = pose.time || 0;
    this.fallback.body.rotation.x = -0.22 + airGrab * 0.35;
    this.fallback.body.rotation.z = -bank * 0.35;
    this.fallback.body.rotation.y = 0.42 + bank * 0.26 + trickSpin;
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
 * Crisp 0.42u faceted Pelagian sea-glass crystal mounted cleanly inside a Slalom Hydro-Ring
 * (ZERO oversized 1.0u crystals clipping Gateway's head or the chase camera!).
 */
function buildBoostCrystalGeo() {
  const parts = [];
  const prism = new THREE.CylinderGeometry(0.11, 0.11, 0.22, 6);
  parts.push(prism);
  const topTip = new THREE.ConeGeometry(0.11, 0.15, 6);
  topTip.translate(0, 0.185, 0);
  parts.push(topTip);
  const botTip = new THREE.ConeGeometry(0.11, 0.15, 6);
  botTip.rotateX(Math.PI);
  botTip.translate(0, -0.185, 0);
  parts.push(botTip);
  const merged = safeMergeGeos(parts);
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * Dramatic sculpted overhanging canyon stone & Pelagian bronze aqueduct arch spanning the S-gorge!
 */
function buildCanyonStoneArchParts() {
  const stoneParts = [];
  const bronzeParts = [];

  // Towering sandstone abutments gripping both curved gorge walls
  for (const sx of [-1, 1]) {
    const col = new THREE.CylinderGeometry(1.65, 2.55, 11.4, 9, 4);
    const pos = col.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const crag = 1.0 + 0.12 * Math.sin(y * 1.4 + sx * 2.1) + 0.08 * Math.cos(Math.atan2(z, x) * 3.0);
      pos.setXYZ(i, x * crag, y, z * crag);
    }
    col.computeVertexNormals();
    col.translate(sx * 8.4, 5.2, 0);
    stoneParts.push(col);
  }

  // Sweeping overhanging natural rock & carved voussoir bridge vault (17u wide, 9.6u high clearance!)
  const archSegs = 13;
  const spanX = 8.4;
  const springY = 5.4;
  const riseY = 4.6;
  for (let i = 0; i < archSegs; i++) {
    const t = (i + 0.5) / archSegs;
    const ang = t * Math.PI;
    const ax = -Math.cos(ang) * spanX;
    const ay = springY + Math.sin(ang) * riseY;
    const isCenter = Math.abs(i - 6) <= 1;
    const blk = new THREE.BoxGeometry(2.35, isCenter ? 1.85 : 1.55, isCenter ? 2.55 : 2.15);
    const slope = Math.atan2(Math.cos(ang) * riseY, Math.sin(ang) * spanX);
    blk.rotateZ(slope);
    blk.translate(ax, ay, Math.sin(i * 1.7) * 0.16);
    stoneParts.push(blk);
  }

  // Decorative ancient Pelagian bronze arch ribs & keystone sun-crest overhead
  const innerArc = new THREE.TorusGeometry(7.7, 0.14, 7, 28, Math.PI);
  innerArc.scale(1.0, 0.54, 1.0);
  innerArc.translate(0, springY - 0.15, 0.92);
  bronzeParts.push(innerArc);

  const keystone = new THREE.OctahedronGeometry(0.68, 0);
  keystone.scale(1.0, 1.25, 0.65);
  keystone.translate(0, springY + riseY + 0.15, 0.98);
  bronzeParts.push(keystone);

  const stoneGeo = safeMergeGeos(stoneParts);
  const bronzeGeo = safeMergeGeos(bronzeParts);
  for (const g of stoneParts) g.dispose();
  for (const g of bronzeParts) g.dispose();
  return { stoneGeo, bronzeGeo };
}

/**
 * Glowing smashable Pelagian Siphon Supply Buoy (bronze flotation frame + luminous hydro-core!).
 */
function buildSupplyBuoyParts() {
  const frameParts = [];
  const coreParts = [];

  // Octagonal flotation collar + riveted bronze ribs + beacon spire
  const collar = new THREE.TorusGeometry(0.56, 0.12, 8, 8);
  collar.rotateX(Math.PI * 0.5);
  collar.translate(0, 0.08, 0);
  frameParts.push(collar);

  const baseFloat = new THREE.CylinderGeometry(0.52, 0.42, 0.34, 8);
  baseFloat.translate(0, -0.06, 0);
  frameParts.push(baseFloat);

  const cap = new THREE.CylinderGeometry(0.30, 0.46, 0.22, 8);
  cap.translate(0, 0.68, 0);
  frameParts.push(cap);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const strut = new THREE.CylinderGeometry(0.045, 0.055, 0.64, 6);
    strut.translate(Math.cos(a) * 0.42, 0.38, Math.sin(a) * 0.42);
    frameParts.push(strut);
  }

  // Luminous glowing sea-glass hydro-power core pulsing inside the buoy cage!
  const orb = new THREE.OctahedronGeometry(0.36, 1);
  orb.translate(0, 0.38, 0);
  coreParts.push(orb);

  const beacon = new THREE.SphereGeometry(0.14, 10, 8);
  beacon.translate(0, 0.92, 0);
  coreParts.push(beacon);

  const frameGeo = safeMergeGeos(frameParts);
  const coreGeo = safeMergeGeos(coreParts);
  for (const g of frameParts) g.dispose();
  for (const g of coreParts) g.dispose();
  return { frameGeo, coreGeo };
}

/**
 * Sculpted curved 3D Rooster-Tail hydro spray plume arcing upward behind Gateway's carving edge!
 */
function buildRoosterTailPlumeGeo() {
  const geo = new THREE.PlaneGeometry(0.68, 2.45, 5, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i); // -1.225..+1.225
    const t = clamp((y + 1.225) / 2.45, 0, 1); // 0 at board tail -> 1 trailing behind
    const arcY = Math.sin(t * Math.PI * 0.88) * (0.62 + t * 0.28);
    const arcZ = 0.68 + t * 2.55;
    const spreadX = x * (0.45 + t * 1.15);
    pos.setXYZ(i, spreadX, arcY, arcZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function createVolumetricSunbeamTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([255, 240, 195, 120]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const hGrad = ctx.createLinearGradient(0, 0, size, 0);
  hGrad.addColorStop(0.0, 'rgba(255, 243, 200, 0.0)');
  hGrad.addColorStop(0.28, 'rgba(255, 243, 200, 0.42)');
  hGrad.addColorStop(0.50, 'rgba(255, 250, 224, 0.90)');
  hGrad.addColorStop(0.72, 'rgba(255, 243, 200, 0.42)');
  hGrad.addColorStop(1.0, 'rgba(255, 243, 200, 0.0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-in';
  const vGrad = ctx.createLinearGradient(0, 0, 0, size);
  vGrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  vGrad.addColorStop(0.20, 'rgba(255,255,255,0.88)');
  vGrad.addColorStop(0.78, 'rgba(255,255,255,0.42)');
  vGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Lightweight procedural sky-ground-sun PMREM CubeUV environment map fallback
 * so PBR metals & sea-glass always gleam with crisp reflections even in standalone mode!
 */
function buildProceduralEnvMap(webgl, topHex = '#38bdf8', horHex = '#fde68a', gndHex = '#1e3a4c') {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(horHex);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: topHex, side: THREE.BackSide })
    );
    envScene.add(dome);
    const sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fff7d6' })
    );
    sunOrb.position.set(8, 12, 10);
    envScene.add(sunOrb);
    const gnd = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: gndHex, side: THREE.DoubleSide })
    );
    gnd.rotation.x = -Math.PI * 0.5;
    gnd.position.y = -6;
    envScene.add(gnd);
    const rt = pmrem.fromScene(envScene, 0.04);
    dome.geometry.dispose();
    dome.material.dispose();
    sunOrb.geometry.dispose();
    sunOrb.material.dispose();
    gnd.geometry.dispose();
    gnd.material.dispose();
    pmrem.dispose();
    return { rt, texture: rt.texture };
  } catch {
    return null;
  }
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
    this._ownEnvRt = null;
    this.postfxActive = false;

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
    this.sunbeamTex = createVolumetricSunbeamTex(128);

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
    this.scene.fog = new THREE.FogExp2('#d4bd9c', 0.0098);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.85;
    } else {
      const env = buildProceduralEnvMap(this.webgl, '#38bdf8', '#f6d196', '#164e63');
      if (env) {
        this._ownEnvRt = env.rt;
        this.envMap = env.texture;
        this.scene.environment = env.texture;
        this.scene.environmentIntensity = 0.85;
      }
    }

    this.camera = new THREE.PerspectiveCamera(54, this.width / Math.max(1, this.height), 0.2, 210);

    // Unified Main-Game Lighting: warm golden directional key w/ hero contact shadow + cool azure hemisphere bounce + warm rim
    this.hemiLight = new THREE.HemisphereLight('#7cc8f0', '#28455c', 1.42);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff1d6', 2.45);
    this.sunLight.position.set(14, 24, 16);
    if (this.webgl?.shadowMap?.enabled) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.camera.near = 2;
      this.sunLight.shadow.camera.far = 70;
      this.sunLight.shadow.camera.left = -14;
      this.sunLight.shadow.camera.right = 14;
      this.sunLight.shadow.camera.top = 14;
      this.sunLight.shadow.camera.bottom = -14;
      this.sunLight.shadow.bias = -0.0006;
      this.sunLight.shadow.normalBias = 0.024;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight('#fcd39d', 1.15);
    this.rimLight.position.set(-16, 14, 10);
    this.scene.add(this.rimLight);

    this.wakeLight = new THREE.PointLight('#5efce8', 1.45, 9.5);
    this.scene.add(this.wakeLight);

    // Curved Fog-Blended Horizon Sky Panorama + Soft Horizon Mist Skirt (ZERO hard seam!)
    this.skyBackdropMat = new THREE.MeshBasicMaterial({
      map: this.skyBackdropTex,
      fog: false,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const skyCylGeo = new THREE.CylinderGeometry(126, 126, 94, 32, 1, true, Math.PI * 0.55, Math.PI * 0.90);
    this.skyBackdrop = new THREE.Mesh(skyCylGeo, this.skyBackdropMat);
    this.skyBackdrop.position.set(0, 26, 0);
    this.scene.add(this.skyBackdrop);

    this.horizonMistMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#e8d8be',
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: false,
    });
    this.horizonMistBand = new THREE.Mesh(new THREE.PlaneGeometry(140, 24), this.horizonMistMat);
    this.horizonMistBand.position.set(0, 4.5, -104);
    this.scene.add(this.horizonMistBand);

    // Majestic Distant Destination Pelagian Spire rising at the canyon vanishing point!
    this.destSpireGroup = new THREE.Group();
    const spireMat = new THREE.MeshStandardMaterial({
      color: '#d8b48c',
      roughness: 0.72,
      metalness: 0.12,
      fog: true,
    });
    const spireGlowMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const spireBody = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 5.4, 36, 14), spireMat);
    spireBody.position.y = 16;
    const spireCrown = new THREE.Mesh(new THREE.ConeGeometry(4.1, 8.5, 10), spireMat);
    spireCrown.position.y = 37.5;
    const spireBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), spireGlowMat);
    spireBeacon.position.y = 43.2;
    const spireBand1 = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.35, 8, 24), spireGlowMat);
    spireBand1.rotation.x = Math.PI * 0.5;
    spireBand1.position.y = 15;
    const spireBand2 = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.32, 8, 24), spireGlowMat);
    spireBand2.rotation.x = Math.PI * 0.5;
    spireBand2.position.y = 26;
    this.destSpireGroup.add(spireBody, spireCrown, spireBeacon, spireBand1, spireBand2);
    this.destSpireGroup.position.set(0, -1.5, -96);
    this.scene.add(this.destSpireGroup);

    // Real Animated GLSL Multi-Wave Fresnel Specular Curved S-Gorge Whitewater Canyon River (48x84 mesh!)
    const riverGeo = new THREE.PlaneGeometry(36, 142, 48, 84);
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
        uSunDir: { value: new THREE.Vector3(14, 24, 16).normalize() },
        uFogColor: { value: new THREE.Color('#d4bd9c') },
        uFogDensity: { value: 0.0098 },
        uHeroXZ: { value: new THREE.Vector2(0, 0) },
      },
    });
    this.riverMesh = new THREE.Mesh(riverGeo, this.riverMat);
    this.riverMesh.position.set(0, 0, -45);
    this.scene.add(this.riverMesh);

    // Enclosing 3D Stratified Sedona Sandstone Gorge + Sculpted Overhanging Stone Arches + Volumetric Sunbeams
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
      opacity: 0.76,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.waterfallMistMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#e8fbff',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sunbeamMat = new THREE.MeshBasicMaterial({
      map: this.sunbeamTex,
      color: '#fff2cc',
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const cliffProtoGeo = buildSteppedCliffGeo(19);
    const shelfProtoGeo = buildStratifiedLedgeGeo(77);
    const coniferGeo = buildRedwoodBoughClusterGeo();
    const mossyRockGeo = buildCraggyMossyRockGeo();
    const fallsGeo = new THREE.PlaneGeometry(2.35, 11.4);
    const mistCurtainGeo = new THREE.PlaneGeometry(3.8, 3.2);
    const sunbeamGeo = new THREE.PlaneGeometry(5.4, 21.0);
    const canyonArchParts = buildCanyonStoneArchParts();

    const sidePairs = MAX_GORGE_SEGS * 2;
    this.gorgeCliffInst = new THREE.InstancedMesh(cliffProtoGeo, this.cliffMat, sidePairs);
    this.gorgeShelfInst = new THREE.InstancedMesh(shelfProtoGeo, this.cliffMat, sidePairs);
    this.gorgeTreeInst = new THREE.InstancedMesh(coniferGeo, this.coniferMat, sidePairs * 2);
    this.gorgeShrubInst = new THREE.InstancedMesh(mossyRockGeo, this.mossyRockMat, sidePairs * 2);
    this.gorgeFallsInst = new THREE.InstancedMesh(fallsGeo, this.waterfallMat, sidePairs);
    this.gorgeMistInst = new THREE.InstancedMesh(mistCurtainGeo, this.waterfallMistMat, sidePairs * 2);
    this.canyonArchStoneInst = new THREE.InstancedMesh(canyonArchParts.stoneGeo, this.cliffMat, MAX_CANYON_ARCHES);
    this.sunbeamInst = new THREE.InstancedMesh(sunbeamGeo, this.sunbeamMat, MAX_SUNBEAMS);
    for (const im of [
      this.gorgeCliffInst,
      this.gorgeShelfInst,
      this.gorgeTreeInst,
      this.gorgeShrubInst,
      this.gorgeFallsInst,
      this.gorgeMistInst,
      this.canyonArchStoneInst,
      this.sunbeamInst,
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
      roughness: 0.34,
      metalness: 0.14,
    });
    this.boardBronzeMat = new THREE.MeshStandardMaterial({
      color: '#e5be7e',
      roughness: 0.24,
      metalness: 0.86,
    });
    this.canyonArchBronzeInst = new THREE.InstancedMesh(canyonArchParts.bronzeGeo, this.boardBronzeMat, MAX_CANYON_ARCHES);
    this.canyonArchBronzeInst.frustumCulled = false;
    this.scene.add(this.canyonArchBronzeInst);

    this.boardRuneMat = new THREE.MeshStandardMaterial({
      color: '#7df9ff',
      map: this.hydroRuneTex,
      emissive: '#38bdf8',
      emissiveMap: this.hydroRuneTex,
      emissiveIntensity: 1.45,
      roughness: 0.18,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });

    this.hydroBoardGroup = new THREE.Group();
    this.boardHullMesh = new THREE.Mesh(boardParts.hullGeo, this.boardWoodMat);
    this.boardBronzeMesh = new THREE.Mesh(boardParts.bronzeGeo, this.boardBronzeMat);
    this.boardRuneMesh = new THREE.Mesh(boardParts.runeGeo, this.boardRuneMat);
    this.boardHullMesh.castShadow = true;
    this.boardHullMesh.receiveShadow = true;
    this.hydroBoardGroup.add(this.boardHullMesh, this.boardBronzeMesh, this.boardRuneMesh);
    this.hydroBoardGroup.position.set(0, 0.05, 0.08);
    this.heroRoot.add(this.hydroBoardGroup);

    // Soft Feathered Radial-Alpha Whitewater Wake Mist + Dramatic 3D Curved Rooster-Tail Spray Arc!
    this.hydroWakeGroup = new THREE.Group();
    const wakeRibbons = [];
    for (const sx of [-1, 1]) {
      const wingGeo = new THREE.PlaneGeometry(0.94, 3.45, 4, 8);
      wingGeo.rotateX(-Math.PI * 0.48);
      wingGeo.rotateY(-sx * 0.30);
      wingGeo.translate(sx * 0.58, 0.07, 1.95);
      wakeRibbons.push(wingGeo);
    }
    const centerPlumeGeo = new THREE.PlaneGeometry(0.92, 2.95, 4, 6);
    centerPlumeGeo.rotateX(-Math.PI * 0.49);
    centerPlumeGeo.translate(0, 0.05, 2.08);
    wakeRibbons.push(centerPlumeGeo);

    const mergedWakeGeo = safeMergeGeos(wakeRibbons);
    for (const w of wakeRibbons) w.dispose();
    this.wakeRibbonMat = new THREE.MeshBasicMaterial({
      map: this.wakeRibbonTex,
      color: '#e4fcff',
      transparent: true,
      opacity: 0.64,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.wakeMistMesh = new THREE.Mesh(mergedWakeGeo, this.wakeRibbonMat);
    this.hydroWakeGroup.add(this.wakeMistMesh);

    // Dynamic 3D Sculpted Rooster-Tail Plume arcing high behind Gateway's carving edge!
    this.roosterTailMat = new THREE.MeshBasicMaterial({
      map: this.wakeRibbonTex,
      color: '#f0feff',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.roosterTailMesh = new THREE.Mesh(buildRoosterTailPlumeGeo(), this.roosterTailMat);
    this.hydroWakeGroup.add(this.roosterTailMesh);
    this.heroRoot.add(this.hydroWakeGroup);

    // Sparkling Golden-Aqua Aerial Trick-Flip Halo Ring!
    this.trickHaloMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.trickHaloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.055, 8, 28), this.trickHaloMat);
    this.trickHaloMesh.position.set(0, 0.85, 0);
    this.trickHaloMesh.visible = false;
    this.heroRoot.add(this.trickHaloMesh);

    this.surfHero = new AdaptiveSurfHero(this.skinId);
    this.surfHero.group.scale.setScalar(1.38);
    this.surfHero.group.position.set(0, 0.14, 0);
    this.surfHero.group.traverse?.((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
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
      opacity: 0.30,
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
      emissive: '#0c7c92',
      emissiveIntensity: 0.28,
      roughness: 0.10,
      metalness: 0.16,
      transparent: true,
      opacity: 0.92,
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
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.rampMistInst = new THREE.InstancedMesh(rampMistGeo, this.rampMistMat, MAX_RAMPS);
    this.rampMistInst.frustumCulled = false;
    this.scene.add(this.rampMistInst);

    // Feathered Whitewater Foam Collars hugging the waterline base of every Arch Pier, River Boulder & Ramp
    const pierFoamGeo = new THREE.PlaneGeometry(1.85, 2.55);
    pierFoamGeo.rotateX(-Math.PI * 0.5);
    this.pierFoamMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#ecfeff',
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pierFoamInst = new THREE.InstancedMesh(pierFoamGeo, this.pierFoamMat, MAX_GATES * 2 + MAX_HAZARDS + MAX_RAMPS);
    this.pierFoamInst.frustumCulled = false;
    this.scene.add(this.pierFoamInst);

    // Hazards (Wet Stratified River Boulders, Glowing Smashable Siphon Supply Buoys, Siphon Surge Mines)
    const boulderGeo = buildRockBoulderGeo(0.76, 33);
    this.boulderMat = new THREE.MeshStandardMaterial({
      color: '#f5ebe0',
      map: this.sandstoneTex,
      roughness: 0.36,
      metalness: 0.08,
    });
    this.boulderInst = new THREE.InstancedMesh(boulderGeo, this.boulderMat, MAX_HAZARDS);

    const buoyParts = buildSupplyBuoyParts();
    this.crateMat = new THREE.MeshStandardMaterial({
      color: '#d89b52',
      emissive: '#451a03',
      emissiveIntensity: 0.22,
      roughness: 0.30,
      metalness: 0.78,
    });
    this.crateInst = new THREE.InstancedMesh(buoyParts.frameGeo, this.crateMat, MAX_HAZARDS);
    this.crateCoreMat = new THREE.MeshStandardMaterial({
      color: '#7df9ff',
      emissive: '#22d3ee',
      emissiveIntensity: 1.65,
      roughness: 0.10,
      metalness: 0.22,
    });
    this.crateCoreInst = new THREE.InstancedMesh(buoyParts.coreGeo, this.crateCoreMat, MAX_HAZARDS);

    this.mineGeo = buildSpikedSiphonMineGeo();
    this.mineMat = new THREE.MeshStandardMaterial({
      color: '#6b4d3e',
      emissive: '#dc2626',
      emissiveIntensity: 0.42,
      metalness: 0.84,
      roughness: 0.30,
    });
    this.mineInst = new THREE.InstancedMesh(this.mineGeo, this.mineMat, MAX_HAZARDS);
    for (const im of [this.boulderInst, this.crateInst, this.crateCoreInst, this.mineInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }

    // Crisp 0.42u Faceted Crystals mounted cleanly inside glowing Slalom Hydro-Rings (`sk.gears`)!
    this.seedInst = new THREE.InstancedMesh(
      buildBoostCrystalGeo(),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#38bdf8',
        emissiveIntensity: 1.15,
        roughness: 0.12,
        metalness: 0.55,
      }),
      MAX_SEEDS
    );
    this.slalomRingMat = new THREE.MeshStandardMaterial({
      color: '#e0faff',
      emissive: '#22d3ee',
      emissiveIntensity: 1.35,
      roughness: 0.16,
      metalness: 0.48,
      transparent: true,
      opacity: 0.88,
    });
    this.slalomRingInst = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.96, 0.048, 8, 28),
      this.slalomRingMat,
      MAX_SEEDS
    );
    this.boltInst = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#38bdf8',
        emissiveIntensity: 1.8,
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
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      MAX_SPRAY
    );
    for (const im of [this.seedInst, this.slalomRingInst, this.boltInst, this.sprayInst]) {
      im.frustumCulled = false;
      this.scene.add(im);
    }
    // Pre-allocate `instanceColor` upfront so D3D11 never recompiles shaders on first pickup!
    this._col.set('#ffffff');
    this._dummy.position.set(0, 0, 0);
    this._dummy.rotation.set(0, 0, 0);
    this._dummy.scale.setScalar(1);
    this._dummy.updateMatrix();
    for (const im of [this.seedInst, this.slalomRingInst]) {
      im.setMatrixAt(0, this._dummy.matrix);
      im.setColorAt(0, this._col);
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
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
    });
    loadLocalWebpTex('assets/textures/mg_pbr_skimmer_wood_normal.webp', false, 1, 1, (t) => {
      if (this._disposed) return;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      this.boardWoodMat.normalMap = t;
      this.boardWoodMat.normalScale.set(1.0, 1.0);
      this.boardWoodMat.needsUpdate = true;
    });

    // Antique Bronze PBR maps for Board Rails/Fins, Pelagian River Gate Collars, Supply Buoys & Spiked Siphon Mines
    loadLocalWebpTex('assets/textures/arch_antique_bronze_albedo.webp', true, 2, 1, (t) => {
      if (this._disposed) return;
      this.boardBronzeMat.map = t;
      this.boardBronzeMat.needsUpdate = true;
      this.crateMat.map = t;
      this.crateMat.needsUpdate = true;
      this.mineMat.map = t;
      this.mineMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/arch_antique_bronze_normal.webp', false, 2, 1, (t) => {
      if (this._disposed) return;
      this.boardBronzeMat.normalMap = t;
      this.boardBronzeMat.normalScale.set(1.0, 1.0);
      this.boardBronzeMat.needsUpdate = true;
      this.crateMat.normalMap = t;
      this.crateMat.normalScale.set(1.0, 1.0);
      this.crateMat.needsUpdate = true;
      this.mineMat.normalMap = t;
      this.mineMat.normalScale.set(1.1, 1.1);
      this.mineMat.needsUpdate = true;
    });
    loadLocalWebpTex('assets/textures/arch_antique_bronze_orm.webp', false, 2, 1, (t) => {
      if (this._disposed) return;
      this.boardBronzeMat.roughnessMap = t;
      this.boardBronzeMat.metalnessMap = t;
      this.boardBronzeMat.needsUpdate = true;
      this.crateMat.roughnessMap = t;
      this.crateMat.metalnessMap = t;
      this.crateMat.needsUpdate = true;
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

  render(state, opts = {}) {
    if (this._disposed || !this.webgl || !state) return;
    const sk = state.rapidsSurf || state.rapids || state.skimmer;
    if (!sk) return;

    const time = Number(state.time ?? sk.timer) || 0;
    const dt = clamp(time - this._lastTime || 0.016, 0.001, 0.05);
    this._lastTime = time;

    const skin = state.gateway?.skinId || state.player?.skinId || state.skinId || this.skinId;
    if (skin && skin !== this.skinId) this.setSkin(skin);

    // Accept shared biome PMREM envMap from main GameRenderer when provided
    if (opts?.envMap && this.scene.environment !== opts.envMap) {
      this.scene.environment = opts.envMap;
      this.scene.environmentIntensity = 0.88;
    }

    const rawTheme = opts?.biomeKey || opts?.biome || sk.biome || state.tower?.theme || 'canyon_river';
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
    if (this.horizonMistMat) this.horizonMistMat.color.set(th.fog);
    if (this.sunbeamMat) this.sunbeamMat.color.set(th.sun);

    const dist = Number(sk.distance) || time * 18;
    const boostMult = Math.max(1, Number(sk.boostMult) || 1);
    const laneX = Number(sk.laneX) || 0;
    const rawY = Math.max(0, Number(sk.y) || 0);
    const onWater = Boolean(sk.onWater ?? rawY < 0.25);
    const runProgress = clamp((Number(sk.timer) || 0) / Math.max(1, Number(sk.duration) || 18), 0, 1);

    // Track directional hero shadow frustum tightly around Gateway
    if (this.sunLight.castShadow) {
      this.sunLight.position.set(laneX + 12, 22, 12);
      this.sunLight.target.position.set(laneX, 0.5, -4);
      this.sunLight.target.updateMatrixWorld();
    }

    // Sample exact river wave height & longitudinal/lateral slopes matching RAPIDS_WATER_VERT
    const zFlow = -dist;
    const w1Arg = zFlow * 0.44 + laneX * 0.42 + time * 2.2;
    const w2Arg = zFlow * 0.86 - laneX * 0.68 + time * 3.4;
    const w3Arg = zFlow * 1.48 + laneX * 1.15 - time * 4.2;
    const w4Arg = laneX * 0.92 - zFlow * 0.58 + time * 2.7;
    const waveH =
      Math.sin(w1Arg) * 0.12 +
      Math.cos(w2Arg) * 0.07 +
      Math.sin(w3Arg) * 0.04 +
      Math.cos(w4Arg) * 0.032;
    const dhDz =
      Math.cos(w1Arg) * 0.12 * 0.44 -
      Math.sin(w2Arg) * 0.07 * 0.86 +
      Math.cos(w3Arg) * 0.04 * 1.48 +
      Math.sin(w4Arg) * 0.032 * 0.58;
    const dhDx =
      Math.cos(w1Arg) * 0.12 * 0.42 +
      Math.sin(w2Arg) * 0.07 * 0.68 +
      Math.cos(w3Arg) * 0.04 * 1.15 -
      Math.sin(w4Arg) * 0.032 * 0.92;

    // Detect wave-jump touchdown & trigger expressive mid-air 360° Trick-Flip off whitewater ramps!
    if (this._prevOnWater && !onWater && (Number(sk.vy) || 0) > 7.5) {
      this._trickActive = true;
      this._trickPhase = 0;
    }
    if (!this._prevOnWater && onWater) {
      const impact = clamp(0.48 + Math.abs(this._prevVy) * 0.09, 0.48, 1.0);
      this._landCompress = Math.max(this._landCompress, impact);
      this._landSplashT = 1.0;
      this._landSplashX = laneX;
      this._trickActive = false;
      this._trickPhase = 0;
    }
    if ((Number(sk.whipTimer) || 0) > 0.05 && !onWater && !this._trickActive) {
      this._trickActive = true;
      this._trickPhase = 0;
    }
    if (this._trickActive && !onWater) {
      this._trickPhase = Math.min(1, this._trickPhase + dt * 1.65);
    } else if (onWater) {
      this._trickActive = false;
      this._trickPhase = 0;
    }
    this._prevOnWater = onWater;
    this._prevVy = Number(sk.vy) || 0;
    this._landCompress *= Math.exp(-8.2 * dt);
    if (this._landCompress < 0.005) this._landCompress = 0;
    if (this._landSplashT > 0) this._landSplashT = Math.max(0, this._landSplashT - dt * 1.75);

    const waveRideY = onWater ? waveH * 0.55 - this._landCompress * 0.14 : 0;
    const heroY = rawY + waveRideY + Math.sin(time * 8.5) * 0.024;
    const rawBank = clamp((Number(sk.vx) || 0) / 7.8, -1, 1);
    this._bankSmooth += (rawBank - this._bankSmooth) * (1 - Math.exp(-11.0 * dt));
    const bank = this._bankSmooth;

    const wavePitch = onWater ? clamp(-dhDz * 1.35, -0.24, 0.24) : 0;
    const waveRoll = onWater ? clamp(-dhDx * 0.85, -0.18, 0.18) : 0;
    const wantPitch = onWater
      ? wavePitch + Math.abs(bank) * 0.09 - this._landCompress * 0.16
      : clamp((sk.vy || 0) * 0.055, -0.32, 0.38);
    this._pitchSmooth += (wantPitch - this._pitchSmooth) * (1 - Math.exp(-10.5 * dt));

    // Update GPU GLSL Curved S-Gorge Fresnel Specular Water Shader uniforms
    const u = this.riverMat.uniforms;
    u.uTime.value = time;
    u.uDist.value = dist;
    u.uDeepColor.value.set(th.waterDeep);
    u.uShallowColor.value.set(th.waterShallow);
    u.uSkyColor.value.set(th.waterSky);
    u.uSunColor.value.set(th.sun);
    u.uFogColor.value.set(th.fog);
    u.uHeroXZ.value.set(laneX, 0);

    this.waterfallTex.offset.set(0, -(time * 1.45) % 1);

    // Loop Curved S-Gorge Canyon Cliffs, Ledges, Conifers, Shrubs, Side-Waterfalls, Overhanging Arches & God-Rays
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
      const curveX = gorgeCurveX(segZ, dist);
      const curveYaw = gorgeCurveYaw(segZ, dist);

      for (const side of [-1, 1]) {
        // Stepped Stratified Sandstone Cliff Wall hugging the curved S-gorge
        dm.position.set(curveX + side * (11.4 + (i % 2) * 0.9), 5.6, segZ);
        dm.rotation.set(0, curveYaw + i * 0.65 + (side > 0 ? 1.2 : 0), 0);
        dm.scale.set(1.18, 1.0 + (i % 3) * 0.20, 1.22);
        dm.updateMatrix();
        this.gorgeCliffInst.setMatrixAt(cIdx, dm.matrix);

        // Angular Stratified Riverbank Sandstone Ledge
        const shelfX = curveX + side * (7.5 + (i % 2) * 0.45);
        dm.position.set(shelfX, 0.32, segZ + 1.1);
        dm.rotation.set(0, curveYaw + i * 0.55 + side * 0.4, 0);
        dm.scale.set(1.08, 0.74, 1.25);
        dm.updateMatrix();
        this.gorgeShelfInst.setMatrixAt(cIdx++, dm.matrix);

        // Real 3D Sculpted Conifers crowning upper curved gorge cliff rims
        for (let k = 0; k < 2; k++) {
          dm.position.set(curveX + side * (9.1 + k * 1.45), 11.4 + ((i + k) % 3) * 0.9, segZ + (k - 0.5) * 2.4);
          dm.rotation.set(0, i * 0.8 + k * 1.6, 0);
          dm.scale.setScalar(0.92 + ((i + k) % 3) * 0.16);
          dm.updateMatrix();
          this.gorgeTreeInst.setMatrixAt(tIdx++, dm.matrix);
        }

        // Real 3D Sculpted Mossy Canyon Rocks nestled on lower ledges
        for (let k = 0; k < 2; k++) {
          const rx = shelfX - side * (0.45 + k * 0.65);
          const rz = segZ + (k === 0 ? 0.4 : 2.5);
          dm.position.set(rx, 0.82 + k * 0.22, rz);
          dm.rotation.set(0, i * 1.1 + k * 1.7, 0);
          dm.scale.setScalar(0.76 + ((i + k) % 3) * 0.18);
          dm.updateMatrix();
          this.gorgeShrubInst.setMatrixAt(sIdx++, dm.matrix);
        }

        // Sunlit Side-Waterfalls plunging down curved gorge cliffs + Mist Plumes
        if ((i + (side > 0 ? 1 : 0)) % 2 === 0) {
          dm.position.set(curveX + side * 6.95, 5.4, segZ);
          dm.rotation.set(0, curveYaw - side * 0.24, 0);
          dm.scale.setScalar(1);
          dm.updateMatrix();
          this.gorgeFallsInst.setMatrixAt(fIdx++, dm.matrix);

          for (let m = 0; m < 2; m++) {
            const driftPhase = (time * 0.68 + i * 0.31 + m * 0.5) % 1;
            const my = 0.85 + driftPhase * 2.45;
            const mx = curveX + side * (6.85 - driftPhase * 0.72);
            const ms = 0.90 + Math.sin(driftPhase * Math.PI) * 0.52;
            dm.position.set(mx, my, segZ + (m - 0.5) * 1.25);
            dm.rotation.set(0, -side * 0.28, Math.sin(time * 0.9 + m) * 0.12);
            dm.scale.set(ms * 1.2, ms * 0.95, 1);
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

    // Dramatic Overhanging Sculpted Stone & Pelagian Bronze Canyon Arches spanning the S-gorge!
    const archSpan = 104;
    const archStep = archSpan / MAX_CANYON_ARCHES;
    for (let i = 0; i < MAX_CANYON_ARCHES; i++) {
      const wrappedZ = (((i * archStep + dist) % archSpan) + archSpan) % archSpan;
      const az = 2 - wrappedZ;
      const ax = gorgeCurveX(az, dist);
      const ayaw = gorgeCurveYaw(az, dist);
      dm.position.set(ax, 0.0, az);
      dm.rotation.set(0, ayaw, 0);
      dm.scale.set(1.0 + (i % 2) * 0.06, 0.96 + (i % 3) * 0.08, 1.0);
      dm.updateMatrix();
      this.canyonArchStoneInst.setMatrixAt(i, dm.matrix);
      this.canyonArchBronzeInst.setMatrixAt(i, dm.matrix);
    }
    this.canyonArchStoneInst.count = MAX_CANYON_ARCHES;
    this.canyonArchBronzeInst.count = MAX_CANYON_ARCHES;
    this.canyonArchStoneInst.instanceMatrix.needsUpdate = true;
    this.canyonArchBronzeInst.instanceMatrix.needsUpdate = true;

    // Volumetric Slanted Sunlight God-Rays slicing diagonally through canyon mist!
    const beamSpan = 92;
    const beamStep = beamSpan / MAX_SUNBEAMS;
    for (let i = 0; i < MAX_SUNBEAMS; i++) {
      const wrappedZ = (((i * beamStep + dist * 0.85) % beamSpan) + beamSpan) % beamSpan;
      const bz = -6 - wrappedZ;
      const bx = gorgeCurveX(bz, dist) + (i % 2 === 0 ? -2.2 : 2.4);
      dm.position.set(bx, 8.2, bz);
      dm.rotation.set(0, 0.08, -0.34);
      dm.scale.set(0.95 + (i % 3) * 0.25, 1.0, 1.0);
      dm.updateMatrix();
      this.sunbeamInst.setMatrixAt(i, dm.matrix);
    }
    this.sunbeamInst.count = MAX_SUNBEAMS;
    this.sunbeamInst.instanceMatrix.needsUpdate = true;

    // Distant Destination Spire growing subtly at the canyon vanishing point as run progresses!
    if (this.destSpireGroup) {
      const farCurveX = gorgeCurveX(-96, dist);
      this.destSpireGroup.position.set(farCurveX, -1.8, -96);
      this.destSpireGroup.scale.setScalar(0.76 + runProgress * 0.56);
      this.destSpireGroup.rotation.y = time * 0.14;
    }

    // Update Gateway 2.0 carving in expressive 3/4 surf stance + 360° mid-air trick-flips!
    const trickSpin = this._trickActive ? Math.sin(this._trickPhase * Math.PI * 0.5) * TAU : 0;
    const airGrab = this._trickActive ? Math.sin(this._trickPhase * Math.PI) : 0;
    this.heroRoot.position.set(laneX, heroY, 0);
    const boardRoll = -bank * 0.46 + waveRoll;
    const boardYaw = -bank * 0.24;
    this.heroRoot.rotation.set(this._pitchSmooth, boardYaw, boardRoll);
    this.hydroBoardGroup.visible = true;
    this.hydroBoardGroup.position.set(0, 0.05 - this._landCompress * 0.04, 0.08);
    this.hydroBoardGroup.rotation.set(airGrab * 0.22, trickSpin * 0.5, 0);
    this.boardRuneMat.emissiveIntensity = 1.25 + (boostMult - 1) * 0.40 + Math.sin(time * 6.0) * 0.20;

    const onWaterAlpha = clamp(1 - rawY * 2.2, 0, 1);
    this.hydroWakeGroup.visible = onWaterAlpha > 0.04;
    this.wakeRibbonMat.opacity = (0.62 + Math.abs(bank) * 0.20 + this._landCompress * 0.22) * onWaterAlpha;
    this.hydroWakeGroup.position.set(-bank * 0.22, 0, 0);
    this.hydroWakeGroup.rotation.set(0, bank * 0.16, -boardRoll * 0.35);
    this.hydroWakeGroup.scale.set(1 + Math.abs(bank) * 0.32 + this._landCompress * 0.25, 1, 1 + (boostMult - 1) * 0.20);
    if (this.roosterTailMesh) {
      this.roosterTailMat.opacity = (0.48 + Math.abs(bank) * 0.42 + (boostMult - 1) * 0.12) * onWaterAlpha;
      this.roosterTailMesh.scale.set(
        0.75 + Math.abs(bank) * 0.65,
        0.75 + Math.abs(bank) * 0.95 + (boostMult - 1) * 0.18,
        0.92 + (boostMult - 1) * 0.15
      );
      this.roosterTailMesh.rotation.y = -bank * 0.32;
    }
    if (this.trickHaloMesh) {
      this.trickHaloMesh.visible = airGrab > 0.04;
      this.trickHaloMat.opacity = airGrab * 0.85;
      this.trickHaloMesh.scale.setScalar(0.85 + airGrab * 0.68);
      this.trickHaloMesh.rotation.set(Math.PI * 0.42, trickSpin, time * 5.0);
    }
    this.wakeLight.position.set(laneX, heroY + 0.95, 0.75);

    this.surfHero.update(dt, {
      time,
      vx: sk.vx || 0,
      vy: sk.vy || 0,
      onGround: onWater,
      surfing: onWater,
      rapidsSurf: onWater,
      anim: this._trickActive ? 'SpringSomersault' : !onWater ? 'AirRise' : 'RapidsSurf',
      mood: this._trickActive || boostMult >= 3 ? 'joyful' : 'determined',
      surfBank: bank,
      trickSpin,
      airGrab,
      landSquash: onWater ? clamp(0.54 + Math.abs(bank) * 0.28 + this._landCompress * 0.42, 0, 1.1) : 0.08,
      frillFlare: 0.45 + (boostMult - 1) * 0.2 + Math.abs(bank) * 0.20 + airGrab * 0.35,
    });

    // Carved Bronze-and-Sandstone Pelagian River Boost Gates + Waterline Pier Foam Collars (1:1 synced!)
    const gates = sk.gates || [];
    const tierCol = BOOST_TIER_COLORS[Math.min(3, boostMult - 1)];
    this.gateCurtainMat.color.set(tierCol.curtain);
    let gCnt = 0;
    let pfCnt = 0;
    const pfMax = this.pierFoamInst ? this.pierFoamInst.instanceMatrix.count : 0;
    for (let i = 0; i < gates.length && gCnt < MAX_GATES; i++) {
      const gt = gates[i];
      if (gt.hit) continue;
      const wz = resolveItemWorldZ(gt.z, dist);
      if (wz > 1.8 || wz < -92) continue;
      const gx = (gt.laneX || 0) + gorgeCurveX(wz, dist);
      const gyaw = gorgeCurveYaw(wz, dist);
      dm.position.set(gx, 0.0, wz);
      dm.rotation.set(0, gyaw, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.gateStoneInst.setMatrixAt(gCnt, dm.matrix);
      this.gateBronzeInst.setMatrixAt(gCnt, dm.matrix);
      this.gateCurtainInst.setMatrixAt(gCnt++, dm.matrix);

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

    // Sculpted Foaming River Wave-Crest Ramps + Crest Spray Mist
    const ramps = sk.ramps || [];
    let rCount = 0;
    for (let i = 0; i < ramps.length && rCount < MAX_RAMPS; i++) {
      const rp = ramps[i];
      const wz = resolveItemWorldZ(rp.z, dist);
      if (wz > 1.8 || wz < -92) continue;
      const rx = (rp.laneX || 0) + gorgeCurveX(wz, dist);
      const ryaw = gorgeCurveYaw(wz, dist);
      const surge = 1.0 + Math.sin(time * 4.2 + i) * 0.04;
      dm.position.set(rx, 0.03, wz);
      dm.rotation.set(0, ryaw, 0);
      dm.scale.set(1, surge, 1);
      dm.updateMatrix();
      this.rampInst.setMatrixAt(rCount, dm.matrix);

      dm.position.set(rx, 0.48 * surge + Math.sin(time * 5.5 + i) * 0.04, wz - 1.35);
      dm.rotation.set(0, ryaw, Math.sin(time * 2.4 + i) * 0.06);
      dm.scale.set(1.28 + Math.sin(time * 3.8 + i) * 0.1, 0.74, 1);
      dm.updateMatrix();
      this.rampMistInst.setMatrixAt(rCount++, dm.matrix);

      if (pfCnt < pfMax) {
        dm.position.set(rx, 0.05, wz + 0.45);
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

    // Hazards (Boulders, Glowing Smashable Siphon Supply Buoys, Spiked Siphon Surge Mines)
    const hazards = sk.hazards || [];
    let bCnt = 0;
    let cCnt = 0;
    let mCnt = 0;
    this.crateCoreMat.emissiveIntensity = 1.55 + Math.sin(time * 6.8) * 0.45;
    for (let i = 0; i < hazards.length; i++) {
      const hz = hazards[i];
      const wz = resolveItemWorldZ(hz.z, dist);
      if (wz > 1.6 || wz < -92) continue;
      const hx = (hz.laneX || 0) + gorgeCurveX(wz, dist);
      dm.position.set(hx, 0.32 + Math.sin(time * 3.4 + i) * 0.08, wz);
      dm.rotation.set(Math.sin(time * 2.2 + i) * 0.08, time * 0.65 + i, Math.cos(time * 2.0 + i) * 0.08);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      if (hz.type === 'mine' && mCnt < MAX_HAZARDS) {
        this.mineInst.setMatrixAt(mCnt++, dm.matrix);
      } else if (hz.type === 'crate' && cCnt < MAX_HAZARDS) {
        this.crateInst.setMatrixAt(cCnt, dm.matrix);
        this.crateCoreInst.setMatrixAt(cCnt++, dm.matrix);
      } else if (bCnt < MAX_HAZARDS) {
        this.boulderInst.setMatrixAt(bCnt++, dm.matrix);
        if (pfCnt < pfMax) {
          const bp = 0.92 + Math.sin(time * 5.0 + i) * 0.08;
          dm.position.set(hx, 0.045, wz + 0.3);
          dm.rotation.set(0, 0, 0);
          dm.scale.set(1.18 * bp, 1, 1.32 * bp);
          dm.updateMatrix();
          this.pierFoamInst.setMatrixAt(pfCnt++, dm.matrix);
        }
      }
    }
    this.boulderInst.count = bCnt;
    this.crateInst.count = cCnt;
    this.crateCoreInst.count = cCnt;
    this.mineInst.count = mCnt;
    if (bCnt > 0) this.boulderInst.instanceMatrix.needsUpdate = true;
    if (cCnt > 0) {
      this.crateInst.instanceMatrix.needsUpdate = true;
      this.crateCoreInst.instanceMatrix.needsUpdate = true;
    }
    if (mCnt > 0) this.mineInst.instanceMatrix.needsUpdate = true;
    if (this.pierFoamInst) {
      this.pierFoamInst.count = pfCnt;
      if (pfCnt > 0) this.pierFoamInst.instanceMatrix.needsUpdate = true;
    }

    // Crisp 0.42u Faceted Sea-Glass Crystals mounted cleanly inside Slalom Hydro-Rings (`sk.gears`)
    // Strictly culled at `wz > -0.45` with smooth scale-out fade so NOTHING EVER clips Gateway's head or camera!
    const seeds = sk.gears || [];
    let sCnt = 0;
    for (let i = 0; i < seeds.length && sCnt < MAX_SEEDS; i++) {
      const g = seeds[i];
      if (g.collected) continue;
      const wz = resolveItemWorldZ(g.z, dist);
      if (wz > -0.45 || wz < -92) continue;
      const nearFade = wz > -1.25 ? clamp((-0.45 - wz) / 0.80, 0.05, 1.0) : 1.0;
      const gx = (g.laneX || 0) + gorgeCurveX(wz, dist);
      const gyaw = gorgeCurveYaw(wz, dist);
      const gy = Math.max(0.98, (g.y ?? 0.55) + 0.55) + Math.sin(time * 4.2 + i) * 0.08;

      // Outer Slalom Hydro-Ring framed cleanly around the surf lane
      dm.position.set(gx, gy, wz);
      dm.rotation.set(0, gyaw, time * 1.4 + i);
      dm.scale.setScalar(nearFade);
      dm.updateMatrix();
      this._col.set(i % 2 === 0 ? '#5efce8' : '#fde047');
      this.slalomRingInst.setColorAt(sCnt, this._col);
      this.slalomRingInst.setMatrixAt(sCnt, dm.matrix);

      // Compact 0.42u faceted gem sparkling at ring apex (never blocking Gateway's silhouette!)
      dm.position.set(gx, gy + 0.52 * nearFade, wz);
      dm.rotation.set(0.18, time * 3.1 + i, 0.14);
      dm.scale.setScalar(0.92 * nearFade);
      dm.updateMatrix();
      this.seedInst.setColorAt(sCnt, this._col);
      this.seedInst.setMatrixAt(sCnt++, dm.matrix);
    }
    this.seedInst.count = sCnt;
    this.slalomRingInst.count = sCnt;
    if (sCnt > 0) {
      this.seedInst.instanceMatrix.needsUpdate = true;
      this.slalomRingInst.instanceMatrix.needsUpdate = true;
      if (this.seedInst.instanceColor) this.seedInst.instanceColor.needsUpdate = true;
      if (this.slalomRingInst.instanceColor) this.slalomRingInst.instanceColor.needsUpdate = true;
    }

    const bolts = sk.bolts || [];
    let bltCnt = 0;
    for (let i = 0; i < bolts.length && bltCnt < MAX_BOLTS; i++) {
      const b = bolts[i];
      const wz = resolveItemWorldZ(b.z, dist);
      if (wz > -0.35 || wz < -92) continue;
      const bx = (b.laneX || 0) + gorgeCurveX(wz, dist);
      dm.position.set(bx, (b.y ?? 0.55) + 0.25, wz);
      dm.rotation.set(time * 8, time * 10, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.boltInst.setMatrixAt(bltCnt++, dm.matrix);
    }
    this.boltInst.count = bltCnt;
    if (bltCnt > 0) this.boltInst.instanceMatrix.needsUpdate = true;

    // Asymmetric Whitewater Rooster-Tail Carving Wake Spray Droplets + Landing Splash Crown
    let spCnt = 0;
    const absBank = Math.abs(bank);
    const carveRail = bank >= 0 ? 1 : -1;
    const wakeQuota = this._landSplashT > 0.02 ? 148 : MAX_SPRAY;
    for (let i = 0; i < wakeQuota && spCnt < MAX_SPRAY; i++) {
      const age = (time * (2.6 + boostMult * 0.45 + absBank * 0.5) + i * 0.047) % 1;
      const isCarveRooster = absBank > 0.06 && (i % 4 !== 0);
      const side = isCarveRooster ? carveRail : i % 2 === 0 ? -1 : 1;
      const carveBoost = isCarveRooster ? 1.0 + absBank * 1.25 : 1.0 - absBank * 0.35;
      const spreadBase = 0.22 + age * (0.68 + absBank * 0.92 * carveBoost);
      const arcSpread = (side * spreadBase - bank * 0.55 * age) * (0.76 + (i % 5) * 0.11);
      const roosterLift = isCarveRooster ? 0.48 + absBank * 0.92 : 0.40;
      const sy = heroY + 0.08 + Math.sin(age * Math.PI) * roosterLift * (0.74 + (i % 3) * 0.18);
      const sz = (isCarveRooster ? 0.52 : 0.98) + age * (4.6 + absBank * 1.3);
      const puffScale =
        Math.sin(age * Math.PI) *
        (0.56 + age * 0.96) *
        (isCarveRooster ? 0.98 + absBank * 0.65 : 0.78) *
        (rawY < 0.4 ? 1.12 : 0.22);
      dm.position.set(laneX + arcSpread, sy, sz);
      dm.rotation.set(0, 0, i * 0.7 + time * 1.6 * side);
      dm.scale.setScalar(Math.max(0.001, puffScale));
      dm.updateMatrix();
      this.sprayInst.setMatrixAt(spCnt++, dm.matrix);
    }

    if (this._landSplashT > 0.02) {
      const spProg = 1 - this._landSplashT;
      const splashN = MAX_SPRAY - spCnt;
      for (let i = 0; i < splashN; i++) {
        const ang = (i / Math.max(1, splashN)) * TAU + (i % 3) * 0.17;
        const rad = 0.42 + spProg * (2.05 + (i % 4) * 0.35);
        const sx = this._landSplashX + Math.cos(ang) * rad;
        const sz = 0.25 + Math.sin(ang) * rad * 1.15 + spProg * 1.85;
        const sy = 0.10 + Math.sin(spProg * Math.PI) * (0.95 + (i % 4) * 0.26);
        const sc = Math.sin(spProg * Math.PI) * (0.88 + (i % 3) * 0.38);
        dm.position.set(sx, sy, sz);
        dm.rotation.set(0, 0, ang + time * 2.2);
        dm.scale.setScalar(Math.max(0.001, sc));
        dm.updateMatrix();
        this.sprayInst.setMatrixAt(spCnt++, dm.matrix);
      }
    }
    this.sprayInst.count = spCnt;
    this.sprayInst.instanceMatrix.needsUpdate = true;

    // Dynamic Heroic 3/4 Surfing Chase Camera (shows Gateway's expressive side-profile & streaming scarf!)
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const wantFov = (portrait ? 58 : 49) + (boostMult - 1) * 3.0 + (this._trickActive ? 4.0 : 0);
    if (Math.abs(this.camera.fov - wantFov) > 0.1) {
      this.camera.fov = lerp(this.camera.fov, wantFov, 0.12);
      this.camera.updateProjectionMatrix();
    }
    this.surfHero.group.scale.setScalar(portrait ? 1.24 : 1.18);

    const sh = Number(state.shake) || 0;
    const sx = sh > 0.01 ? Math.sin(time * 69) * sh * 0.02 : 0;
    const sy = sh > 0.01 ? Math.cos(time * 57) * sh * 0.02 : 0;
    const wantCamSwing = -bank * (portrait ? 0.52 : 0.72) + Math.sin(time * 0.55) * 0.12;
    this._camXSwing += (wantCamSwing - this._camXSwing) * (1 - Math.exp(-5.5 * dt));
    const camZ = portrait ? 5.45 : 4.65;
    const camY = (portrait ? 2.45 : 2.08) + heroY * 0.44;
    const camX = laneX * (portrait ? 0.78 : 0.64) + this._camXSwing;
    this.camera.position.set(camX + sx, camY + sy, camZ);
    const lookCurve = gorgeCurveX(-14, dist) * 0.28;
    this.camera.lookAt(laneX * (portrait ? 0.88 : 0.82) + lookCurve, 0.98 + heroY * 0.36, -6.5);

    // Keep curved sky cylinder & soft horizon mist centered cleanly on camera
    this.skyBackdrop.position.set(camX, camY + 18, camZ);
    if (this.horizonMistBand) {
      this.horizonMistBand.position.set(camX + gorgeCurveX(-98, dist) * 0.4, 4.2, -104);
    }

    // Route cleanly through main GameRenderer's CinematicPostFX when provided, with ACES standalone fallback!
    const postfx = opts?.postfx;
    if (postfx && postfx.enabled && !postfx._disposed && typeof postfx.render === 'function') {
      this.postfxActive = true;
      postfx.render(this.scene, this.camera, {
        biome: bKey,
        exposure: 1.06,
        bloomThreshold: 0.82,
        bloomStrength: 0.30,
        bloomRadius: 0.40,
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
    this.surfHero?.dispose();
    this._ownEnvRt?.dispose();
    this.rampAlbedoTex?.dispose();
    this.rampNormalTex?.dispose();
    this.sandstoneTex?.dispose();
    this.redwoodFallbackTex?.dispose();
    this.hydroRuneTex?.dispose();
    this.mistTex?.dispose();
    this.wakeRibbonTex?.dispose();
    this.waterfallTex?.dispose();
    this.skyBackdropTex?.dispose();
    this.sunbeamTex?.dispose();
  }
}

export { SkimmerRenderer as RapidsSurfRenderer };
export default SkimmerRenderer;
