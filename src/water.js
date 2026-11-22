// ============================================================================
// Towering Waters: Gateway's Descent — Multi-Biome Living Water Shader (`src/water.js`)
//
// Supports all 5 Earth Water Biomes + Ecosystem Purification Healing (`0..1`):
//   1. `'canyon_river'` : Directional rushing emerald-teal river rapids, standing
//                         hydraulic wave crests, boulder V-wakes & golden morning sun!
//   2. `'alpine_lake'`  : Ultra-clear glassy turquoise-cobalt alpine mirror lake with
//                         crisp reflections of snow-capped granite peaks & gentle ripples!
//   3. `'mist_bayou'`   : Calm reflective jade-amber bayou delta channels with lazy
//                         rotational current swirls, sunset mirror sheen & mist veins!
//   4. `'coral_sea'`    : Crystal-clear translucent turquoise noon lagoon (`uClarity`)
//                         revealing 3D underwater coral reef shelves & gliding manta rays
//                         beneath sparkling tropical sun-glitter & reef whitewater!
//   5. `'storm_ocean'`  : Polar & tempest deep ocean with a colossal 3D swirling
//                         maelstrom whirlpool funnel around the spire base & aurora glints!
//
// Strict 60fps Mobile Guarantees:
//   - Real-time oblique-clipped planar reflection (`WebGLRenderTarget`)
//   - Zero per-frame heap/GC allocations & strict WebGLRenderer state save/restore
// ============================================================================

import * as THREE from 'three';

export const WATER_BIOMES = Object.freeze([
  'canyon_river',
  'alpine_lake',
  'mist_bayou',
  'coral_sea',
  'storm_ocean',
]);

const BIOME_ALIAS_MAP = Object.freeze({
  canyon_river: 'canyon_river',
  canyon: 'canyon_river',
  river: 'canyon_river',
  redwood: 'canyon_river',
  rapids: 'canyon_river',
  foundry: 'canyon_river',
  piston: 'canyon_river',

  alpine_lake: 'alpine_lake',
  alpine: 'alpine_lake',
  lake: 'alpine_lake',
  glacier: 'alpine_lake',
  blizzard: 'alpine_lake',

  mist_bayou: 'mist_bayou',
  bayou: 'mist_bayou',
  delta: 'mist_bayou',
  swamp: 'mist_bayou',
  mist: 'mist_bayou',
  dusk: 'mist_bayou',

  coral_sea: 'coral_sea',
  coral: 'coral_sea',
  reef: 'coral_sea',
  lagoon: 'coral_sea',
  sea: 'coral_sea',
  sinking: 'coral_sea',
  prism: 'coral_sea',
  day: 'coral_sea',

  storm_ocean: 'storm_ocean',
  ocean: 'storm_ocean',
  polar: 'storm_ocean',
  tempest: 'storm_ocean',
  maelstrom: 'storm_ocean',
  blackout: 'storm_ocean',
  apex: 'storm_ocean',
  moonlit_storm: 'storm_ocean',
  storm: 'storm_ocean',
});

export function resolveWaterBiome(raw, towerId = 1) {
  if (typeof raw === 'string') {
    const key = raw.trim().toLowerCase();
    if (BIOME_ALIAS_MAP[key]) return BIOME_ALIAS_MAP[key];
  }
  const idx = Math.floor((Math.max(1, Number(towerId) || 1) - 1) / 2) % WATER_BIOMES.length;
  return WATER_BIOMES[idx];
}

const CANONICAL_WATER_PRESETS = {
  canyon_river: Object.freeze({
    biomeMode: 0,
    deepColor: '#074848',
    shallowColor: '#1ad4b4',
    skyColor: '#66b8f0',
    horizonMistColor: '#f5cf92',
    sunColor: '#fff1c2',
    sunDir: [0.46, 0.36, -0.81],
    glowColor: '#34f5c8',
    foamColor: '#f8fcff',
    siltColor: '#6e644e',
    swell: 0.76,
    chopStrength: 1.22,
    sunStrength: 1.46,
    moonGlitter: 0.56,
    foamStrength: 1.52,
    collarWidth: 1.45,
    flowVel: [1.48, 0.36],
    clarity: 0.26,
    reflStrength: 0.68,
    vortexAmt: 0.0,
    causticStrength: 0.38,
  }),

  alpine_lake: Object.freeze({
    biomeMode: 1,
    deepColor: '#0b3b72',
    shallowColor: '#24cbe8',
    skyColor: '#5eaaf4',
    horizonMistColor: '#dcebf8',
    sunColor: '#fff4eb',
    sunDir: [0.38, 0.44, -0.81],
    glowColor: '#67e8f9',
    foamColor: '#f4faff',
    siltColor: '#5c6d7e',
    swell: 0.18,
    chopStrength: 0.36,
    sunStrength: 1.32,
    moonGlitter: 0.48,
    foamStrength: 0.58,
    collarWidth: 0.92,
    flowVel: [0.12, 0.05],
    clarity: 0.34,
    reflStrength: 0.94,
    vortexAmt: 0.0,
    causticStrength: 0.32,
  }),

  mist_bayou: Object.freeze({
    biomeMode: 2,
    deepColor: '#0d3025',
    shallowColor: '#318f6a',
    skyColor: '#d87a4a',
    horizonMistColor: '#c88862',
    sunColor: '#ffbe76',
    sunDir: [-0.42, 0.24, -0.87],
    glowColor: '#fbbf24',
    foamColor: '#fef3c7',
    siltColor: '#4c4635',
    swell: 0.26,
    chopStrength: 0.54,
    sunStrength: 1.38,
    moonGlitter: 0.52,
    foamStrength: 0.56,
    collarWidth: 1.04,
    flowVel: [0.30, -0.18],
    clarity: 0.20,
    reflStrength: 0.84,
    vortexAmt: 0.0,
    causticStrength: 0.20,
  }),

  coral_sea: Object.freeze({
    biomeMode: 3,
    deepColor: '#055587',
    shallowColor: '#0fe0d6',
    skyColor: '#48c4f8',
    horizonMistColor: '#b4f0fc',
    sunColor: '#fffbe6',
    sunDir: [0.32, 0.58, -0.75],
    glowColor: '#22f5e8',
    foamColor: '#ffffff',
    siltColor: '#667a7e',
    swell: 0.52,
    chopStrength: 0.78,
    sunStrength: 1.62,
    moonGlitter: 0.68,
    foamStrength: 1.16,
    collarWidth: 1.26,
    flowVel: [0.26, 0.20],
    clarity: 0.62,
    reflStrength: 0.56,
    vortexAmt: 0.0,
    causticStrength: 0.72,
  }),

  storm_ocean: Object.freeze({
    biomeMode: 4,
    deepColor: '#07243e',
    shallowColor: '#167ea2',
    skyColor: '#1c5074',
    horizonMistColor: '#307288',
    sunColor: '#c4f8ff',
    sunDir: [0.40, 0.34, -0.85],
    glowColor: '#00f5c4',
    foamColor: '#eefbff',
    siltColor: '#2c3c4c',
    swell: 1.32,
    chopStrength: 1.36,
    sunStrength: 1.38,
    moonGlitter: 0.52,
    foamStrength: 1.58,
    collarWidth: 1.68,
    flowVel: [0.52, 0.40],
    clarity: 0.08,
    reflStrength: 0.68,
    vortexAmt: 1.0,
    causticStrength: 0.22,
  }),
};

export const OCEAN_PRESETS = Object.freeze({
  ...CANONICAL_WATER_PRESETS,
  // Legacy theme aliases mapped cleanly onto the 5 Earth Watershed Biomes
  foundry: CANONICAL_WATER_PRESETS.canyon_river,
  piston: CANONICAL_WATER_PRESETS.canyon_river,
  blizzard: CANONICAL_WATER_PRESETS.alpine_lake,
  mist: CANONICAL_WATER_PRESETS.mist_bayou,
  dusk: CANONICAL_WATER_PRESETS.mist_bayou,
  sinking: CANONICAL_WATER_PRESETS.coral_sea,
  prism: CANONICAL_WATER_PRESETS.coral_sea,
  day: CANONICAL_WATER_PRESETS.coral_sea,
  blackout: CANONICAL_WATER_PRESETS.storm_ocean,
  apex: CANONICAL_WATER_PRESETS.storm_ocean,
  moonlit_storm: CANONICAL_WATER_PRESETS.storm_ocean,
  storm: CANONICAL_WATER_PRESETS.storm_ocean,
});

// Tileable organic water normal map: multi-octave periodic value-noise + domain-warped FBM
// wrapped seamlessly on the [0, size)^2 torus with capillary ridge sharpening.
export function createWaterNormalTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const hashGrid = (ix, iy, per, salt) => {
    const wx = ((ix % per) + per) % per;
    const wy = ((iy % per) + per) % per;
    let h = (wx * 374761393 + wy * 668265263 + salt * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const pNoise = (u, v, per, salt) => {
    const gx = u * per;
    const gy = v * per;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hashGrid(ix, iy, per, salt);
    const b = hashGrid(ix + 1, iy, per, salt);
    const c = hashGrid(ix, iy + 1, per, salt);
    const d = hashGrid(ix + 1, iy + 1, per, salt);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };

  const hf = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const wx = (pNoise(u, v, 4, 11) - 0.5) * 0.16 + (pNoise(u, v, 8, 23) - 0.5) * 0.07;
      const wy = (pNoise(u, v, 4, 37) - 0.5) * 0.16 + (pNoise(u, v, 8, 53) - 0.5) * 0.07;
      const uw = u + wx;
      const vw = v + wy;
      const o1 = pNoise(uw, vw, 5, 101) * 0.52;
      const o2 = pNoise(uw, vw, 11, 211) * 0.30;
      const o3 = pNoise(uw, vw, 23, 307) * 0.16;
      const o4 = pNoise(uw, vw, 46, 409) * 0.08;
      const r1 = 1 - Math.abs(pNoise(uw, vw, 9, 503) * 2 - 1);
      const r2 = 1 - Math.abs(pNoise(uw, vw, 19, 607) * 2 - 1);
      hf[y * size + x] = o1 + o2 + o3 + o4 + r1 * r1 * 0.22 + r2 * r2 * 0.11;
    }
  }

  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < hf.length; i++) {
    if (hf[i] < minH) minH = hf[i];
    if (hf[i] > maxH) maxH = hf[i];
  }
  const invSpanH = 1 / Math.max(1e-4, maxH - minH);
  const strength = 2.65;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (hf[y * size + xp] - hf[y * size + xm]) * strength;
      const dy = (hf[yp * size + x] - hf[ym * size + x]) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      const i4 = (y * size + x) * 4;
      data[i4] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      data[i4 + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      data[i4 + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      // Pack normalized multi-octave FBM height into alpha channel -> 0 procedural sin() hashes per pixel!
      data[i4 + 3] = Math.round(Math.max(0, Math.min(1, (hf[y * size + x] - minH) * invSpanH)) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Ocean {
  constructor(
    webgl,
    {
      towerRadius = 3.75,
      preset = 'canyon_river',
      size = 280,
      segments = 48,
      waterY = -0.82,
    } = {}
  ) {
    this.webgl = webgl;
    this.reflectionEnabled = false;
    this.resScale = 0.5;
    this.era = 'reboot';
    this.currentPreset = resolveWaterBiome(preset);
    this._purification = 0;
    this._purificationTarget = 0;
    this.normalTex = createWaterNormalTexture(128);

    const outerRadius = Math.max(180, size * 0.62);
    const geo = new THREE.PlaneGeometry(2, 2, segments, segments);
    geo.rotateX(-Math.PI / 2);
    // Concentric square-to-disk mapping: 360-deg circular horizon with dense rings
    // hugging the 3.75m spire base / maelstrom funnel and smooth expansion to outerRadius.
    {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        const v = pos.getZ(i);
        let rGrid = 0;
        let phi = 0;
        const au = Math.abs(u);
        const av = Math.abs(v);
        if (au > 1e-6 || av > 1e-6) {
          if (au > av) {
            rGrid = au;
            phi = (Math.PI * 0.25) * (v / u) + (u < 0 ? Math.PI : 0);
          } else {
            rGrid = av;
            phi = Math.PI * 0.5 - (Math.PI * 0.25) * (u / v) + (v < 0 ? Math.PI : 0);
          }
        }
        const worldR = outerRadius * (0.145 * rGrid + 0.855 * Math.pow(rGrid, 3.0));
        pos.setX(i, Math.cos(phi) * worldR);
        pos.setZ(i, Math.sin(phi) * worldR);
      }
      pos.needsUpdate = true;
      geo.computeBoundingSphere();
    }

    // Zero extra render passes & zero reflection WebGLRenderTarget VRAM on integrated GPUs:
    // reflection is computed analytically in the single-pass water fragment shader!
    this.rt = null;
    this.textureMatrix = new THREE.Matrix4();

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        normalMap: { value: null },
        reflectionMap: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        useReflection: { value: 0 },
        uBiomeMode: { value: 0 },
        deepColor: { value: new THREE.Color('#074848') },
        shallowColor: { value: new THREE.Color('#1ad4b4') },
        skyColor: { value: new THREE.Color('#66b8f0') },
        uHorizonMistColor: { value: new THREE.Color('#f5cf92') },
        sunColor: { value: new THREE.Color('#fff1c2') },
        sunDir: { value: new THREE.Vector3(0.46, 0.36, -0.81).normalize() },
        glowColor: { value: new THREE.Color('#34f5c8') },
        foamColor: { value: new THREE.Color('#f8fcff') },
        uSiltColor: { value: new THREE.Color('#6e644e') },
        towerRadius: { value: towerRadius },
        swell: { value: 0.76 },
        chopStrength: { value: 1.22 },
        sunStrength: { value: 1.46 },
        moonGlitter: { value: 0.56 },
        foamStrength: { value: 1.52 },
        collarWidth: { value: 1.45 },
        lightningBoost: { value: 0 },
        uOuterRadius: { value: outerRadius },
        uFlowVel: { value: new THREE.Vector2(1.48, 0.36) },
        uClarity: { value: 0.26 },
        uReflStrength: { value: 0.68 },
        uVortexAmt: { value: 0.0 },
        uCausticStrength: { value: 0.38 },
        uPurification: { value: 0.0 },
        ripples: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, -100, 0)) },
      },
    ]);
    uniforms.normalMap.value = this.normalTex;
    uniforms.reflectionMap.value = null;
    uniforms.textureMatrix.value = this.textureMatrix;

    this.material = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      transparent: true,
      depthWrite: true,
      vertexShader: /* glsl */ `
        uniform float time;
        uniform float swell;
        uniform float towerRadius;
        uniform float uOuterRadius;
        uniform float uBiomeMode;
        uniform vec2 uFlowVel;
        uniform float uVortexAmt;
        uniform mat4 textureMatrix;

        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying float vVortexFunnel;
        varying vec4 vReflCoord;
        #include <fog_pars_vertex>

        vec3 waves(vec2 p) {
          float h = 0.0;
          float dx = 0.0;
          float dz = 0.0;
          vec2 flowDir = length(uFlowVel) > 0.01 ? normalize(uFlowVel) : vec2(1.0, 0.25);
          vec2 flowPerp = vec2(-flowDir.y, flowDir.x);
          float flowSpd = length(uFlowVel);

          vec2 dirs[5];
          if (uBiomeMode < 0.5) {
            // Mode 0 ('canyon_river'): Directional rushing river rapids & hydraulic standing waves
            dirs[0] = flowDir;
            dirs[1] = normalize(flowDir * 0.84 + flowPerp * 0.54);
            dirs[2] = normalize(flowDir * 0.84 - flowPerp * 0.54);
            dirs[3] = normalize(flowDir * 0.45 + flowPerp * 0.89);
            dirs[4] = normalize(-flowDir * 0.35 + flowPerp * 0.94);
          } else {
            dirs[0] = normalize(vec2(1.0, 0.32));
            dirs[1] = normalize(vec2(-0.54, 1.0));
            dirs[2] = normalize(vec2(0.34, -1.0));
            dirs[3] = normalize(vec2(-1.0, -0.58));
            dirs[4] = normalize(vec2(0.76, -0.65));
          }

          float amps[5];
          amps[0] = 0.205; amps[1] = 0.128; amps[2] = 0.078; amps[3] = 0.045; amps[4] = 0.026;
          float freqs[5];
          freqs[0] = 0.38; freqs[1] = 0.68; freqs[2] = 1.18; freqs[3] = 1.95; freqs[4] = 2.85;
          float speeds[5];
          float spdMul = uBiomeMode < 0.5 ? (1.35 + flowSpd * 0.45) : 1.0;
          speeds[0] = -1.25 * spdMul;
          speeds[1] = -1.68 * spdMul;
          speeds[2] = -2.24 * spdMul;
          speeds[3] = 2.65;
          speeds[4] = -3.15 * spdMul;

          for (int i = 0; i < 5; i++) {
            float ph = dot(dirs[i], p) * freqs[i] + time * speeds[i];
            float s = sin(ph);
            float c = cos(ph);
            float sharp = s + 0.32 * (s * s - 0.5);
            float dSharp = c * (1.0 + 0.64 * s);
            h += sharp * amps[i];
            float deriv = dSharp * amps[i] * freqs[i];
            dx += deriv * dirs[i].x;
            dz += deriv * dirs[i].y;
          }
          return vec3(h, dx, dz);
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float r = length(wp.xz);
          float horCalm = 1.0 - smoothstep(0.42, 0.88, r / max(uOuterRadius, 1.0));
          float calm = smoothstep(towerRadius * 0.82, towerRadius + 1.85, r) * swell * horCalm;
          vec3 w = waves(wp.xz) * calm;

          // Colossal 3D Swirling Maelstrom Whirlpool Funnel around spire base ('storm_ocean')
          float vortexFunnel = 0.0;
          vec2 vortexSlope = vec2(0.0);
          if (uVortexAmt > 0.01) {
            float dOut = max(0.0, r - towerRadius + 0.15);
            float innerWall = smoothstep(towerRadius - 0.25, towerRadius + 0.95, r);
            float funnelEnv = exp(-dOut * 0.155) * innerWall * uVortexAmt;
            float ang = atan(wp.x, wp.z);
            float spiralArm = sin(ang * 5.0 + r * 1.15 - time * 3.85) * 0.18 * funnelEnv;
            vortexFunnel = funnelEnv;
            w.x += (-1.28 * funnelEnv + spiralArm);
            vec2 radDir = wp.xz / max(r, 1e-3);
            vortexSlope = radDir * (0.20 * funnelEnv);
          }
          vVortexFunnel = vortexFunnel;

          wp.xz -= vec2(w.y, w.z) * 0.22 * clamp(calm, 0.0, 1.4);
          wp.y += w.x;
          vHeight = w.x;
          vSwellN = normalize(vec3(-(w.y + vortexSlope.x) * 1.15, 1.0, -(w.z + vortexSlope.y) * 1.15));
          vWorld = wp.xyz;
          vReflCoord = textureMatrix * vec4(position, 1.0);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform sampler2D normalMap;
        uniform sampler2D reflectionMap;
        uniform float useReflection;
        uniform float uBiomeMode;
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 skyColor;
        uniform vec3 uHorizonMistColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform vec3 glowColor;
        uniform vec3 foamColor;
        uniform vec3 uSiltColor;
        uniform float towerRadius;
        uniform float chopStrength;
        uniform float sunStrength;
        uniform float moonGlitter;
        uniform float foamStrength;
        uniform float collarWidth;
        uniform float lightningBoost;
        uniform float uOuterRadius;
        uniform vec2 uFlowVel;
        uniform float uClarity;
        uniform float uReflStrength;
        uniform float uVortexAmt;
        uniform float uCausticStrength;
        uniform float uPurification;
        uniform vec4 ripples[12];

        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying float vVortexFunnel;
        varying vec4 vReflCoord;
        #include <fog_pars_fragment>

        // Hardware bilinear texture FBM packed in normalMap.a (0 procedural sin-hash loops -> 5x faster iGPU fill-rate!)
        vec4 sampleWater(vec2 uv) { return texture2D(normalMap, uv); }

        void main() {
          vec2 p = vWorld.xz;
          float rr = length(p);
          float ang = atan(vWorld.x, vWorld.z);

          mat2 rotA = mat2(0.80, -0.60, 0.60, 0.80);
          mat2 rotB = mat2(-0.55, 0.835, -0.835, -0.55);

          // Biome-specific directional river advection, bayou eddies, or artifact-free maelstrom spiral!
          vec2 advect = -uFlowVel * (time * 0.11);
          vec2 swirlP = p;
          vec2 vortexNormalAdd = vec2(0.0);
          if (uVortexAmt > 0.01) {
            float twistEnv = exp(-max(0.0, rr - towerRadius) * 0.11) * uVortexAmt;
            float fixedTwist = 1.35 * twistEnv;
            float cs = cos(fixedTwist);
            float sn = sin(fixedTwist);
            swirlP = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
            float groovePh = ang * 6.0 + log(max(1.0, rr)) * 8.2 - time * 4.1;
            vec2 tangDir = vec2(-vWorld.z, vWorld.x) / max(rr, 1e-3);
            vec2 radDir = p / max(rr, 1e-3);
            vortexNormalAdd = (tangDir * 0.55 + radDir * 0.85) * cos(groovePh) * twistEnv * 1.45;
          } else if (abs(uBiomeMode - 2.0) < 0.4) {
            float eddy = sin(p.x * 0.12 + time * 0.18) * cos(p.y * 0.12 - time * 0.15) * 1.8;
            swirlP += vec2(eddy, -eddy * 0.7);
          }

          vec4 sWarp = sampleWater(swirlP * 0.036 + advect * 0.20 + vec2(time * 0.014, -time * 0.011));
          vec2 pw = swirlP + (sWarp.rg - 0.5) * 1.45;

          vec4 s1 = sampleWater(pw * 0.095 + advect + vec2(time * 0.020, time * 0.012));
          vec4 s2 = sampleWater((rotA * pw) * 0.24 + advect * 1.45 + vec2(-time * 0.019, time * 0.026));
          vec3 n1 = s1.xyz * 2.0 - 1.0;
          vec3 n2 = s2.xyz * 2.0 - 1.0;
          vec3 rip = (n1 + n2 * 0.78) * chopStrength + vec3(vortexNormalAdd, 0.0);

          vec3 viewVec = cameraPosition - vWorld;
          float dist = length(viewVec);
          vec3 v = viewVec / max(dist, 1e-4);
          float detail = mix(1.0, 0.22, smoothstep(16.0, 78.0, dist));

          vec4 sFoam = sampleWater((rotB * pw) * 0.46 + advect * 0.65 + vec2(time * 0.038, -time * 0.028));
          float foamCellA = sFoam.a * 0.62 + s1.a * 0.38;
          float foamCellB = s2.a;
          float laceMask = smoothstep(0.32, 0.78, foamCellA * 0.65 + foamCellB * 0.35);

          // Expanding ring ripples + spire shoreline lap (4 active ripples for 60fps Radeon fill-rate!)
          vec2 rn = vec2(0.0);
          float ringFoam = 0.0;
          for (int i = 0; i < 4; i++) {
            vec4 R = ripples[i];
            float age = time - R.z;
            if (age < 0.0 || age > 4.0) continue;
            vec2 dv = p - R.xy;
            float d = length(dv) + 1e-4;
            float c = age * 1.85;
            float env = R.w * exp(-age * 0.92) * exp(-pow((d - c) / (0.34 + age * 0.25), 2.0));
            float ph = (d - c) * 11.0;
            rn += (dv / d) * cos(ph) * env * 0.90;
            ringFoam += max(0.0, sin(ph)) * env * (0.24 + 0.62 * laceMask);
          }

          float baseEnv = exp(-max(0.0, rr - towerRadius - 0.38) * 0.24)
                        * smoothstep(towerRadius - 0.08, towerRadius + 0.82, rr);
          float bph = rr * 4.1 - time * 2.55 + foamCellA * 2.0;
          rn += (p / max(rr, 1e-3)) * cos(bph) * baseEnv * 0.36;
          ringFoam += smoothstep(0.74, 1.0, sin(bph)) * baseEnv * 0.34 * laceMask;

          vec3 n = normalize(
            vSwellN
            + vec3(rip.x + rn.x, 0.0, rip.y + rn.y) * 0.155 * detail
            + vec3(rn.x, 0.0, rn.y) * 0.11
          );

          // Schlick Fresnel (water F0 = 0.024)
          float farAtten = 1.0 - smoothstep(42.0, 110.0, dist);
          float cosT = clamp(dot(n, v), 0.0, 1.0);
          float fres = 0.024 + 0.976 * pow(1.0 - cosT, 5.0);
          fres = clamp(fres, 0.0, 0.94) * mix(0.38, 1.0, farAtten);

          // Crisp Single-Pass Analytic Fresnel Sky / Vista / Sun / Spire Reflection (0 extra render passes!)
          vec3 reflDir = reflect(-v, n);
          float reflUp = clamp(reflDir.y, 0.0, 1.0);
          vec3 L = normalize(sunDir);
          float reflSun = max(0.0, dot(reflDir, L));
          vec3 zenithRefl = skyColor * vec3(0.72, 0.84, 1.04);
          vec3 skyGrad = mix(uHorizonMistColor * 0.94, skyColor * 1.04, smoothstep(0.0, 0.34, reflUp));
          skyGrad = mix(skyGrad, zenithRefl, smoothstep(0.32, 0.82, reflUp));
          // Mirrored distant vista band (canyon cliffs / alpine peaks / sunset treeline / aurora sheen)
          float vistaAz = atan(reflDir.x, reflDir.z);
          float vistaRidgeline = 0.09 + 0.055 * sin(vistaAz * 5.0 + 0.7) + 0.03 * cos(vistaAz * 11.0 - 0.4);
          float vistaBand = smoothstep(vistaRidgeline + 0.06, vistaRidgeline - 0.02, reflUp) * smoothstep(0.0, 0.03, reflUp);
          vec3 vistaReflCol = mix(deepColor * 0.65 + uHorizonMistColor * 0.45, uHorizonMistColor * 0.82, 0.55);
          skyGrad = mix(skyGrad, vistaReflCol, vistaBand * 0.34);
          // Warm solar / aurora sky dome reflection bounce
          skyGrad += sunColor * (pow(reflSun, 5.0) * 0.34 + pow(reflSun, 24.0) * 0.52) * (0.75 + 0.25 * sunStrength);
          if (uVortexAmt > 0.01) {
            float aurWave = 0.5 + 0.5 * sin(vistaAz * 4.0 + time * 0.45 + n.x * 5.0);
            skyGrad += glowColor * aurWave * smoothstep(0.04, 0.45, reflUp) * 0.36;
          }
          // Subtle spire tower base reflection shadow & conduit bounce right around the tower perimeter
          float spireReflMask = exp(-max(0.0, rr - towerRadius) * 0.24) * (1.0 - smoothstep(0.25, 0.65, reflUp));
          skyGrad = mix(skyGrad, deepColor * 0.48 + glowColor * 0.22, spireReflMask * 0.45);
          vec3 refl = skyGrad * (0.86 + uReflStrength * 0.26 + lightningBoost * 0.38);

          // Vibrant Biome Water Body + Ecosystem Purification Bloom (0..1)
          float purify = clamp(uPurification, 0.0, 1.0);
          vec3 effDeep = mix(deepColor, deepColor * vec3(0.88, 1.12, 1.18), purify * 0.45);
          vec3 effShallow = mix(shallowColor, shallowColor * vec3(0.92, 1.16, 1.14) + vec3(0.0, 0.06, 0.07), purify * 0.52);

          // Subtle unpurified siphon silt collar right at spire intakes that clears away to crystal water as purify -> 1!
          float siltRing = exp(-max(0.0, rr - towerRadius) * 0.28) * (1.0 - purify) * 0.24;

          float crest = clamp(vHeight * 2.4 + 0.52, 0.0, 1.0);
          float shallowZone = exp(-max(0.0, rr - towerRadius) * 0.055) * 0.48
                            + (uBiomeMode > 2.5 && uBiomeMode < 3.5 ? (1.0 - smoothstep(10.0, 44.0, rr)) * 0.56 : 0.0);
          float shallowMix = clamp(pow(crest, 1.25) * 0.58 + shallowZone, 0.0, 0.94);
          float troughShade = mix(0.68, 1.12, smoothstep(-0.24, 0.20, vHeight));
          vec3 body = mix(effDeep, effShallow, shallowMix) * troughShade;
          body = mix(body, uSiltColor, siltRing);

          // Sunlit underwater caustic web shimmer in shallow clear water (texture-driven, 0 ALU hashes!)
          if (uCausticStrength > 0.02 && dist < 52.0) {
            float c1 = 1.0 - abs(s1.a * 2.0 - 1.0);
            float c2 = 1.0 - abs(s2.a * 2.0 - 1.0);
            float caust = pow(clamp(c1 * 0.55 + c2 * 0.45, 0.0, 1.0), 3.4);
            float caustFade = (1.0 - smoothstep(18.0, 50.0, dist)) * (0.45 + 0.55 * shallowMix);
            body += effShallow * caust * uCausticStrength * (0.62 + 0.45 * purify) * caustFade;
          }

          // Subsurface sun/aurora scattering through wave crests + spire bioluminescent bounce
          float sss = pow(clamp(dot(v, -L) * 0.5 + 0.5, 0.0, 1.0), 2.5) * smoothstep(0.35, 0.95, crest) * farAtten;
          body += effShallow * sss * 0.58;
          float nearGlow = exp(-max(0.0, rr - towerRadius) * 0.42) * (0.10 + purify * 0.14);
          body += glowColor * nearGlow * (0.5 + 0.5 * crest);

          // Expanding Ecosystem Purification Harmonic Pulse Wave when purify > 0.01
          if (purify > 0.01 && purify < 0.995) {
            float waveR = towerRadius + purify * 46.0;
            float pBand = exp(-pow((rr - waveR) / 2.2, 2.0));
            body += mix(glowColor, vec3(0.98, 0.92, 0.55), 0.38) * pBand * 0.85;
          }

          float reflMix = clamp(fres * mix(0.62, 1.05, uReflStrength), 0.0, 0.94);
          vec3 col = mix(body, refl, reflMix);

          // Sun / Sunset / Aurora Diamond Glitter Path (capped smoothly below postfx white-bloom washout)
          vec3 hVec = normalize(L + v);
          float ndh = max(dot(n, hVec), 0.0);
          float tightGlint = pow(ndh, 420.0) * 1.85;
          float midGlitter = pow(ndh, 64.0) * (0.10 + moonGlitter * 0.24);
          float facetSheen = pow(ndh, 16.0) * moonGlitter * 0.085 * (0.35 + 0.65 * crest);
          vec3 specAdd = sunColor * (tightGlint + midGlitter + facetSheen) * (sunStrength * 0.85 + lightningBoost * 0.55) * farAtten;
          col += min(specAdd, vec3(0.95, 0.94, 0.90));

          // Biome-Specific Whitewater Foam:
          // - Spire collar & lacy surf
          // - Mode 0 ('canyon_river'): Standing whitewater rapid hydraulic crests & downstream wake streaks!
          // - Mode 2 ('mist_bayou'): Delicate curling delta current pollen/mist ribbons!
          // - Mode 4 ('storm_ocean'): Colossal spiraling maelstrom whirlpool spume bands!
          float cw = max(0.5, collarWidth);
          float collarSample = sampleWater(vec2(ang * 1.35 + time * 0.035, rr * 0.44 - time * 0.16)).a;
          float turb = collarSample * 0.66 + sFoam.a * 0.34;

          float innerProx = smoothstep(towerRadius + 0.92 * cw, towerRadius + 0.05, rr + (turb - 0.5) * 0.75 * cw);
          float innerCollar = innerProx * smoothstep(0.26, 0.72, turb * 0.65 + laceMask * 0.55);
          float outerLace = smoothstep(0.50, 0.78, turb)
                          * smoothstep(towerRadius + 2.75 * cw, towerRadius + 0.35, rr)
                          * laceMask;

          float crestTurb = foamCellA;
          float veinA = 1.0 - abs(sFoam.a * 2.0 - 1.0);
          float veinB = 1.0 - abs(s2.a * 2.0 - 1.0);
          float foamWeb = smoothstep(0.56, 0.90, veinA * 0.64 + veinB * 0.36);
          float slopePinch = clamp(1.0 - vSwellN.y, 0.0, 1.0);
          float crestBand = smoothstep(0.032, 0.155, vHeight + slopePinch * 0.08);
          float crestFoam = (crestBand * (smoothstep(0.44, 0.78, crestTurb) * 0.62 + foamWeb * 0.68)
                          + smoothstep(-0.02, 0.10, vHeight) * foamWeb * laceMask * 0.24)
                          * (1.0 - smoothstep(32.0, 84.0, dist));

          float biomeSpecialFoam = 0.0;
          if (uBiomeMode < 0.5) {
            // Canyon River standing rapids & downstream spire wake V-plume
            vec2 fDir = normalize(uFlowVel + vec2(1e-4));
            float downProj = dot(p, fDir);
            float crossDist = abs(dot(p, vec2(-fDir.y, fDir.x)));
            float spireWake = smoothstep(0.0, 2.5, downProj)
                            * exp(-max(0.0, downProj - towerRadius) * 0.065)
                            * smoothstep(towerRadius + 2.4 + downProj * 0.24, towerRadius * 0.55, crossDist);
            float standingRibs = smoothstep(0.54, 0.86, sin(dot(pw, fDir) * 1.55 - time * 3.4) * 0.5 + 0.5)
                               * smoothstep(0.38, 0.76, foamCellA);
            biomeSpecialFoam = (spireWake * (0.45 + 0.55 * laceMask) + standingRibs * 0.44)
                             * (1.0 - smoothstep(34.0, 82.0, dist));
          } else if (uVortexAmt > 0.01) {
            // Polar Maelstrom logarithmic spiral spume arms churning around the spire!
            float logR = log(max(1.0, rr));
            float spiralPhase = ang * 5.0 + logR * 7.8 - time * 3.8 + foamCellA * 1.8;
            float spiralBands = smoothstep(0.42, 0.92, sin(spiralPhase) * 0.5 + 0.5);
            float maelstromZone = exp(-max(0.0, rr - towerRadius - 0.4) * 0.095)
                                * smoothstep(towerRadius - 0.1, towerRadius + 0.9, rr);
            biomeSpecialFoam = spiralBands * maelstromZone * (0.48 + 0.52 * laceMask) * uVortexAmt * 1.15;
          }

          float rawFoam = innerCollar * 0.86
                        + outerLace * 0.48
                        + crestFoam * 0.50
                        + biomeSpecialFoam
                        + ringFoam;
          float foam = clamp(rawFoam * foamStrength, 0.0, 1.0);
          vec3 crispFoamCol = min(foamColor * (0.86 + 0.14 * smoothstep(0.4, 0.95, foam)), vec3(0.96, 0.98, 1.0));
          col = mix(col, crispFoamCol, foam * 0.84);

          // Seamless distant horizon mist blend + circular radial alpha feathering
          float radNorm = rr / max(uOuterRadius, 1.0);
          float horMist = max(smoothstep(54.0, 128.0, dist), smoothstep(0.38, 0.82, radNorm));
          vec3 mistTarget = uHorizonMistColor * 0.88;
          #ifdef USE_FOG
            mistTarget = mix(fogColor, mistTarget, 0.42);
          #endif
          col = mix(col, mistTarget, horMist * 0.90);

          float horizonAlpha = (1.0 - smoothstep(72.0, 168.0, dist)) * (1.0 - smoothstep(0.46, 0.94, radNorm));
          if (horizonAlpha < 0.002) discard;

          // Crystal-Clear Lagoon / Shallows Transmission ('coral_sea', 'alpine_lake', 'canyon_river'):
          // Allows opaque 3D Underwater Coral Reef Shelves & Gliding Manta Rays below waterY to shine right through!
          float clarityZone = (1.0 - smoothstep(22.0, 54.0, dist)) * (1.0 - horMist);
          float effClarity = clamp(uClarity + purify * 0.14, 0.0, 0.78) * clarityZone;
          float surfaceOpacity = clamp(1.0 - effClarity * (1.0 - fres * 0.84), 0.34, 1.0);
          surfaceOpacity = mix(surfaceOpacity, 1.0, clamp(foam * 1.15, 0.0, 1.0));

          gl_FragColor = vec4(col, surfaceOpacity * horizonAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'OceanSurface';
    this.mesh.renderOrder = -5;
    this.mesh.position.y = waterY;

    // Preallocated reflection camera & math scratch objects (0 per-frame allocations)
    this._virtualCam = new THREE.PerspectiveCamera();
    this._plane = new THREE.Plane();
    this._normal = new THREE.Vector3();
    this._reflectorWorld = new THREE.Vector3();
    this._camWorld = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this._lookAt = new THREE.Vector3();
    this._clip = new THREE.Vector4();
    this._view = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._q = new THREE.Vector4();
    this._ri = 0;

    this.applyPreset(this.currentPreset);
  }

  /**
   * Applies one of the 5 Earth Water Biomes (or legacy alias / custom config object).
   */
  applyPreset(presetOrObj = 'canyon_river', overrides = null) {
    let base;
    if (typeof presetOrObj === 'string') {
      const resolved = resolveWaterBiome(presetOrObj);
      this.currentPreset = resolved;
      base = OCEAN_PRESETS[presetOrObj] || CANONICAL_WATER_PRESETS[resolved] || CANONICAL_WATER_PRESETS.canyon_river;
    } else {
      base = presetOrObj || CANONICAL_WATER_PRESETS.canyon_river;
    }
    this._writeUniformConfig(base);
    if (overrides && typeof overrides === 'object') {
      this._writeUniformConfig(overrides);
    }
    return this;
  }

  /**
   * Direct biome setter (`'canyon_river'`, `'alpine_lake'`, `'mist_bayou'`, `'coral_sea'`, `'storm_ocean'`).
   */
  setTheme(theme = 'canyon_river', overrides = null) {
    return this.applyPreset(theme, overrides);
  }

  /**
   * Preserves legacy `setEra(era, theme)` caller compatibility while always rendering AAA biome water.
   */
  setEra(_era = 'reboot', theme = null) {
    this.era = 'reboot';
    if (theme) {
      this.applyPreset(theme);
    } else if (this.currentPreset) {
      this.applyPreset(this.currentPreset);
    }
    return this;
  }

  /**
   * Clean palette & wave tuning hook for `src/renderer.js`.
   */
  setPalette(opts = {}) {
    if (!opts || typeof opts !== 'object') return this;
    const presetKey = opts.preset || opts.theme;
    if (presetKey) {
      this.applyPreset(presetKey, opts);
    } else {
      this._writeUniformConfig(opts);
    }
    return this;
  }

  /**
   * Sets Ecosystem Healing / Spire Purification progress (`0..1`).
   */
  setPurification(progress = 0) {
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    this._purificationTarget = p;
    this._purification = p;
    this.material.uniforms.uPurification.value = p;
    return this;
  }

  setRestored(restored = true) {
    return this.setPurification(restored ? 1 : 0);
  }

  /**
   * Updates key sun / aurora directional glitter parameters without allocating.
   */
  setMoonlight({ color, direction, dir, strength, glitter, sheen } = {}) {
    const u = this.material.uniforms;
    if (color !== undefined) u.sunColor.value.set(color);
    const dVec = direction || dir;
    if (dVec) {
      if (Array.isArray(dVec)) {
        u.sunDir.value.set(dVec[0], dVec[1], dVec[2]).normalize();
      } else if (dVec.isVector3 || (typeof dVec.x === 'number' && typeof dVec.y === 'number')) {
        u.sunDir.value.set(dVec.x, dVec.y, dVec.z || 0).normalize();
      }
    }
    if (strength !== undefined) u.sunStrength.value = Number(strength);
    const gVal = glitter ?? sheen;
    if (gVal !== undefined) u.moonGlitter.value = Number(gVal);
    return this;
  }

  setSunlight(opts = {}) {
    return this.setMoonlight(opts);
  }

  setWaterLevel(y) {
    if (Number.isFinite(y)) {
      this.mesh.position.y = y;
    }
    return this;
  }

  _writeUniformConfig(cfg) {
    const u = this.material.uniforms;
    if (cfg.biomeMode !== undefined) u.uBiomeMode.value = Number(cfg.biomeMode);
    if (cfg.deepColor !== undefined) u.deepColor.value.set(cfg.deepColor);
    if (cfg.shallowColor !== undefined) u.shallowColor.value.set(cfg.shallowColor);
    if (cfg.skyColor !== undefined) u.skyColor.value.set(cfg.skyColor);
    if (cfg.horizonMistColor !== undefined) u.uHorizonMistColor.value.set(cfg.horizonMistColor);
    if (cfg.sunColor !== undefined) u.sunColor.value.set(cfg.sunColor);
    if (cfg.glowColor !== undefined) u.glowColor.value.set(cfg.glowColor);
    if (cfg.foamColor !== undefined) u.foamColor.value.set(cfg.foamColor);
    if (cfg.siltColor !== undefined) u.uSiltColor.value.set(cfg.siltColor);
    if (cfg.sunDir) {
      if (Array.isArray(cfg.sunDir)) {
        u.sunDir.value.set(cfg.sunDir[0], cfg.sunDir[1], cfg.sunDir[2]).normalize();
      } else if (typeof cfg.sunDir.x === 'number') {
        u.sunDir.value.set(cfg.sunDir.x, cfg.sunDir.y, cfg.sunDir.z || 0).normalize();
      }
    }
    if (cfg.flowVel) {
      if (Array.isArray(cfg.flowVel)) {
        u.uFlowVel.value.set(cfg.flowVel[0], cfg.flowVel[1]);
      } else if (typeof cfg.flowVel.x === 'number') {
        u.uFlowVel.value.set(cfg.flowVel.x, cfg.flowVel.y);
      }
    }
    if (cfg.towerRadius !== undefined) u.towerRadius.value = Number(cfg.towerRadius);
    if (cfg.swell !== undefined) u.swell.value = Number(cfg.swell);
    if (cfg.chopStrength !== undefined) u.chopStrength.value = Number(cfg.chopStrength);
    if (cfg.sunStrength !== undefined) u.sunStrength.value = Number(cfg.sunStrength);
    if (cfg.moonGlitter !== undefined) u.moonGlitter.value = Number(cfg.moonGlitter);
    if (cfg.foamStrength !== undefined) u.foamStrength.value = Number(cfg.foamStrength);
    if (cfg.collarWidth !== undefined) u.collarWidth.value = Number(cfg.collarWidth);
    if (cfg.lightningBoost !== undefined) u.lightningBoost.value = Number(cfg.lightningBoost);
    if (cfg.clarity !== undefined) u.uClarity.value = Number(cfg.clarity);
    if (cfg.reflStrength !== undefined) u.uReflStrength.value = Number(cfg.reflStrength);
    if (cfg.vortexAmt !== undefined) u.uVortexAmt.value = Number(cfg.vortexAmt);
    if (cfg.causticStrength !== undefined) u.uCausticStrength.value = Number(cfg.causticStrength);
    if (cfg.purificationProgress !== undefined || cfg.restored !== undefined) {
      const p = cfg.purificationProgress !== undefined ? Number(cfg.purificationProgress) : (cfg.restored ? 1 : 0);
      this.setPurification(p);
    }
  }

  /**
   * Per-frame time & dynamic water state update (zero allocations).
   */
  update(time, opts = null) {
    const u = this.material.uniforms;
    const t = Number(time) || 0;
    const prevT = u.time.value || t;
    const dt = Math.min(0.05, Math.max(0.0, t - prevT));
    u.time.value = t;

    if (opts) {
      if (opts.theme && resolveWaterBiome(opts.theme) !== this.currentPreset) {
        this.applyPreset(opts.theme);
      }
      if (opts.waterY !== undefined) this.mesh.position.y = opts.waterY;
      if (opts.lightningFlash !== undefined) u.lightningBoost.value = opts.lightningFlash;
      if (opts.towerRadius !== undefined) u.towerRadius.value = opts.towerRadius;
      if (opts.purificationProgress !== undefined) {
        this._purificationTarget = Math.max(0, Math.min(1, Number(opts.purificationProgress) || 0));
      } else if (opts.restored !== undefined) {
        this._purificationTarget = opts.restored ? 1 : 0;
      }
    }

    if (Math.abs(this._purificationTarget - this._purification) > 1e-4) {
      const rate = dt > 0 ? Math.min(1, dt * 2.4) : 1;
      this._purification += (this._purificationTarget - this._purification) * rate;
      u.uPurification.value = this._purification;
    }
  }

  /**
   * Spawns an expanding ring ripple at world `(x, z)`.
   */
  addRipple(x, z, strength = 1, time = this.material.uniforms.time.value) {
    const arr = this.material.uniforms.ripples.value;
    this._ri = ((this._ri || 0) + 1) % arr.length;
    arr[this._ri].set(x, z, time, strength);
  }

  setSize(_w, _h, _dpr = 1) {
    // Analytic single-pass reflection requires no offscreen render target resize.
  }

  /**
   * No-op: planar reflection pass removed (0 extra scene draw calls; analytic Fresnel reflection
   * is evaluated directly inside the single-pass water fragment shader for locked 60fps!).
   */
  updateReflection(_scene, _camera) {
    this.material.uniforms.useReflection.value = 0;
  }

  dispose() {
    this.rt?.dispose();
    this.normalTex?.dispose();
    this.mesh?.geometry?.dispose();
    this.material?.dispose();
  }
}
