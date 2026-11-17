// Real-time Planar-Reflection Ocean (`src/water.js`)
// Ported from `origin/main` (`e42c3da`) and upgraded for Dual-Era 2026 Reboot ("Moonlit Storm")
// & 2008 XBLA HD Original Mode:
//  - Real-time planar reflection (`WebGLRenderTarget` + oblique near clip plane)
//  - 4 scrolling layers of a procedurally generated tileable 28-wave normal map over sharpened
//    directional 3D vertex swells
//  - Schlick Fresnel, dual-lobe moon/sun glitter path + wet storm-wave facet sheen, subsurface
//    crest scattering, expanding splash/rain ring ripples, and crashing frothy tower-base foam collar
//  - Clean preset/palette/moonlight hooks + strict WebGL state save/restore & 0 per-frame allocations

import * as THREE from 'three';

export const OCEAN_PRESETS = {
  moonlit_storm: {
    deepColor: '#091926',
    shallowColor: '#163852',
    skyColor: '#0c1c30',
    sunColor: '#d8ecff',
    sunDir: [0.42, 0.34, -0.84],
    glowColor: '#5efce8',
    foamColor: '#f0f8ff',
    swell: 1.22,
    chopStrength: 1.32,
    sunStrength: 1.36,
    moonGlitter: 0.44,
    foamStrength: 1.42,
    collarWidth: 1.38,
  },
  storm: {
    deepColor: '#071522',
    shallowColor: '#13314a',
    skyColor: '#0a1829',
    sunColor: '#cfe4ff',
    sunDir: [0.42, 0.34, -0.84],
    glowColor: '#38bdf8',
    foamColor: '#eff8ff',
    swell: 1.28,
    chopStrength: 1.38,
    sunStrength: 1.32,
    moonGlitter: 0.46,
    foamStrength: 1.48,
    collarWidth: 1.44,
  },
  mist: {
    deepColor: '#091926',
    shallowColor: '#163852',
    skyColor: '#0c1c30',
    sunColor: '#d8ecff',
    sunDir: [0.42, 0.34, -0.84],
    glowColor: '#5efce8',
    foamColor: '#f0f8ff',
    swell: 1.22,
    chopStrength: 1.32,
    sunStrength: 1.36,
    moonGlitter: 0.44,
    foamStrength: 1.42,
    collarWidth: 1.38,
  },
  sinking: {
    deepColor: '#06202e',
    shallowColor: '#0e5b6e',
    skyColor: '#0b2236',
    sunColor: '#bae6fd',
    sunDir: [0.36, 0.38, -0.85],
    glowColor: '#22d3ee',
    foamColor: '#e6f9ff',
    swell: 1.26,
    chopStrength: 1.28,
    sunStrength: 1.25,
    moonGlitter: 0.38,
    foamStrength: 1.36,
    collarWidth: 1.35,
  },
  foundry: {
    deepColor: '#0c131c',
    shallowColor: '#22303f',
    skyColor: '#181824',
    sunColor: '#ffd29d',
    sunDir: [-0.38, 0.28, -0.88],
    glowColor: '#fb923c',
    foamColor: '#e2e8f0',
    swell: 1.05,
    chopStrength: 1.18,
    sunStrength: 1.18,
    moonGlitter: 0.34,
    foamStrength: 1.12,
    collarWidth: 1.18,
  },
  blizzard: {
    deepColor: '#071a2c',
    shallowColor: '#1e4e6e',
    skyColor: '#10263e',
    sunColor: '#e0f2fe',
    sunDir: [0.32, 0.42, -0.85],
    glowColor: '#7dd3fc',
    foamColor: '#f8fafc',
    swell: 1.16,
    chopStrength: 1.26,
    sunStrength: 1.35,
    moonGlitter: 0.48,
    foamStrength: 1.46,
    collarWidth: 1.4,
  },
  prism: {
    deepColor: '#0b1026',
    shallowColor: '#23285c',
    skyColor: '#121638',
    sunColor: '#e9d5ff',
    sunDir: [0.4, 0.36, -0.84],
    glowColor: '#c084fc',
    foamColor: '#f3e8ff',
    swell: 1.04,
    chopStrength: 1.16,
    sunStrength: 1.3,
    moonGlitter: 0.42,
    foamStrength: 1.18,
    collarWidth: 1.22,
  },
  piston: {
    deepColor: '#081824',
    shallowColor: '#153b4f',
    skyColor: '#0d2030',
    sunColor: '#cbd5e1',
    sunDir: [-0.4, 0.32, -0.86],
    glowColor: '#38bdf8',
    foamColor: '#e8f4fa',
    swell: 1.18,
    chopStrength: 1.3,
    sunStrength: 1.22,
    moonGlitter: 0.38,
    foamStrength: 1.32,
    collarWidth: 1.3,
  },
  blackout: {
    deepColor: '#050d17',
    shallowColor: '#10283d',
    skyColor: '#071120',
    sunColor: '#dbeafe',
    sunDir: [0.44, 0.35, -0.83],
    glowColor: '#5efce8',
    foamColor: '#eff8ff',
    swell: 1.34,
    chopStrength: 1.44,
    sunStrength: 1.42,
    moonGlitter: 0.5,
    foamStrength: 1.52,
    collarWidth: 1.46,
  },
  apex: {
    deepColor: '#080d1c',
    shallowColor: '#163547',
    skyColor: '#0e162b',
    sunColor: '#fde68a',
    sunDir: [0.38, 0.32, -0.87],
    glowColor: '#34d399',
    foamColor: '#ecfeff',
    swell: 1.24,
    chopStrength: 1.34,
    sunStrength: 1.34,
    moonGlitter: 0.42,
    foamStrength: 1.38,
    collarWidth: 1.34,
  },
  day: {
    deepColor: '#012a40',
    shallowColor: '#0aa5b8',
    skyColor: '#1a4c7a',
    sunColor: '#fff1d6',
    sunDir: [-0.45, 0.38, -0.81],
    glowColor: '#38bdf8',
    foamColor: '#f0faff',
    swell: 1.0,
    chopStrength: 1.0,
    sunStrength: 1.05,
    moonGlitter: 0.2,
    foamStrength: 1.0,
    collarWidth: 1.0,
  },
  dusk: {
    deepColor: '#071b30',
    shallowColor: '#145870',
    skyColor: '#241e42',
    sunColor: '#ffb27c',
    sunDir: [-0.48, 0.16, -0.86],
    glowColor: '#fb923c',
    foamColor: '#ffeede',
    swell: 1.05,
    chopStrength: 1.08,
    sunStrength: 1.2,
    moonGlitter: 0.28,
    foamStrength: 1.05,
    collarWidth: 1.08,
  },
  original: {
    deepColor: '#041d3d',
    shallowColor: '#0ea5e9',
    skyColor: '#091836',
    sunColor: '#ffe8b8',
    sunDir: [-0.45, 0.28, -0.85],
    glowColor: '#38bdf8',
    foamColor: '#e8f7ff',
    swell: 0.85,
    chopStrength: 0.96,
    sunStrength: 1.15,
    moonGlitter: 0.24,
    foamStrength: 0.88,
    collarWidth: 0.96,
  },
  original_hd: {
    deepColor: '#041d3d',
    shallowColor: '#0ea5e9',
    skyColor: '#091836',
    sunColor: '#ffe8b8',
    sunDir: [-0.45, 0.28, -0.85],
    glowColor: '#38bdf8',
    foamColor: '#e8f7ff',
    swell: 0.85,
    chopStrength: 0.96,
    sunStrength: 1.15,
    moonGlitter: 0.24,
    foamStrength: 0.88,
    collarWidth: 0.96,
  },
};

// Tileable organic ocean normal map: multi-octave periodic value-noise + domain-warped FBM
// wrapped seamlessly on the [0, size)^2 torus (zero regular plane-wave plaid/lattice!).
export function createWaterNormalTexture(size = 256) {
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
      // Domain warp so crests bend organically like wind-driven sea chop
      const wx = (pNoise(u, v, 4, 11) - 0.5) * 0.16 + (pNoise(u, v, 8, 23) - 0.5) * 0.07;
      const wy = (pNoise(u, v, 4, 37) - 0.5) * 0.16 + (pNoise(u, v, 8, 53) - 0.5) * 0.07;
      const uw = u + wx;
      const vw = v + wy;
      const o1 = pNoise(uw, vw, 5, 101) * 0.52;
      const o2 = pNoise(uw, vw, 11, 211) * 0.3;
      const o3 = pNoise(uw, vw, 23, 307) * 0.16;
      const o4 = pNoise(uw, vw, 46, 409) * 0.08;
      //Sharpen wave ridges slightly (1 - |2n - 1|) for authentic capillary crests
      const r1 = 1 - Math.abs(pNoise(uw, vw, 9, 503) * 2 - 1);
      const r2 = 1 - Math.abs(pNoise(uw, vw, 19, 607) * 2 - 1);
      hf[y * size + x] = o1 + o2 + o3 + o4 + r1 * r1 * 0.22 + r2 * r2 * 0.11;
    }
  }

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
      data[i4 + 3] = 255;
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
      towerRadius = 2.55,
      preset = 'moonlit_storm',
      era = 'reboot',
      size = 480,
      segments = 72,
      waterY = -0.58,
    } = {}
  ) {
    this.webgl = webgl;
    this.reflectionEnabled = true;
    this.resScale = 0.45;
    this.era = era === 'original' ? 'original' : 'reboot';
    this.currentPreset = preset;
    this.normalTex = createWaterNormalTexture(256);

    const outerRadius = Math.max(220, size * 0.5);
    const geo = new THREE.PlaneGeometry(2, 2, segments, segments);
    geo.rotateX(-Math.PI / 2);
    // Concentric square-to-disk mapping: 360° circular horizon (zero square corners) with ultra-dense
    // ~0.4m rings hugging the tower collar and smooth expansion out to `outerRadius` (~240m)!
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
        const worldR = outerRadius * (0.135 * rGrid + 0.865 * Math.pow(rGrid, 3.1));
        pos.setX(i, Math.cos(phi) * worldR);
        pos.setZ(i, Math.sin(phi) * worldR);
      }
      pos.needsUpdate = true;
      geo.computeBoundingSphere();
    }

    this.rt = new THREE.WebGLRenderTarget(256, 256, {
      type: THREE.HalfFloatType,
      samples: 0,
      depthBuffer: true,
    });
    this.rt.texture.generateMipmaps = false;
    this.rt.texture.minFilter = THREE.LinearFilter;
    this.rt.texture.magFilter = THREE.LinearFilter;
    this.textureMatrix = new THREE.Matrix4();

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        normalMap: { value: null },
        reflectionMap: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        useReflection: { value: 1 },
        deepColor: { value: new THREE.Color('#091926') },
        shallowColor: { value: new THREE.Color('#163852') },
        skyColor: { value: new THREE.Color('#0c1c30') },
        sunColor: { value: new THREE.Color('#d8ecff') },
        sunDir: { value: new THREE.Vector3(0.42, 0.34, -0.84).normalize() },
        glowColor: { value: new THREE.Color('#5efce8') },
        foamColor: { value: new THREE.Color('#f0f8ff') },
        towerRadius: { value: towerRadius },
        swell: { value: 1.22 },
        chopStrength: { value: 1.32 },
        sunStrength: { value: 1.36 },
        moonGlitter: { value: 0.44 },
        foamStrength: { value: 1.42 },
        collarWidth: { value: 1.38 },
        lightningBoost: { value: 0 },
        uIsOrig: { value: era === 'original' ? 1 : 0 },
        uOuterRadius: { value: outerRadius },
        ripples: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, -100, 0)) },
      },
    ]);
    uniforms.normalMap.value = this.normalTex;
    uniforms.reflectionMap.value = this.rt.texture;
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
        uniform mat4 textureMatrix;
        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying vec4 vReflCoord;
        #include <fog_pars_vertex>

        // Sharpened 5-component directional Gerstner/trochoidal storm swells (peaked storm crests, deep carved troughs)
        vec3 waves(vec2 p) {
          float h = 0.0;
          float dx = 0.0;
          float dz = 0.0;
          vec2 dirs[5];
          dirs[0] = normalize(vec2(1.0, 0.32));
          dirs[1] = normalize(vec2(-0.54, 1.0));
          dirs[2] = normalize(vec2(0.34, -1.0));
          dirs[3] = normalize(vec2(-1.0, -0.58));
          dirs[4] = normalize(vec2(0.76, -0.65));
          float amps[5];
          amps[0] = 0.215; amps[1] = 0.132; amps[2] = 0.078; amps[3] = 0.046; amps[4] = 0.026;
          float freqs[5];
          freqs[0] = 0.36; freqs[1] = 0.66; freqs[2] = 1.15; freqs[3] = 1.92; freqs[4] = 2.82;
          float speeds[5];
          speeds[0] = 1.18; speeds[1] = 1.58; speeds[2] = 2.18; speeds[3] = 2.88; speeds[4] = 3.48;

          for (int i = 0; i < 5; i++) {
            float ph = dot(dirs[i], p) * freqs[i] + time * speeds[i];
            float s = sin(ph);
            float c = cos(ph);
            // Pronounced trochoidal steepening so storm swells form sharp ridges & deep carved valleys
            float sharp = s + 0.34 * (s * s - 0.5);
            float dSharp = c * (1.0 + 0.68 * s);
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
          float horCalm = 1.0 - smoothstep(0.42, 0.86, r / max(uOuterRadius, 1.0));
          // Surge builds right outside the masonry wall and calms smoothly into the distant horizon mist
          float calm = smoothstep(towerRadius * 0.84, towerRadius + 1.55, r) * swell * horCalm;
          vec3 w = waves(wp.xz) * calm;
          // Horizontal Gerstner crest pinch sharpens storm wave ridges in 3D silhouette
          wp.xz -= vec2(w.y, w.z) * 0.24 * clamp(calm, 0.0, 1.4);
          wp.y += w.x;
          vHeight = w.x;
          vSwellN = normalize(vec3(-w.y * 1.18, 1.0, -w.z * 1.18));
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
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 skyColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform vec3 glowColor;
        uniform vec3 foamColor;
        uniform float towerRadius;
        uniform float chopStrength;
        uniform float sunStrength;
        uniform float moonGlitter;
        uniform float foamStrength;
        uniform float collarWidth;
        uniform float lightningBoost;
        uniform float uIsOrig;
        uniform float uOuterRadius;
        uniform vec4 ripples[12]; // x, z, start time, strength
        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying vec4 vReflCoord;
        #include <fog_pars_fragment>

        vec3 sampleN(vec2 uv) { return texture2D(normalMap, uv).xyz * 2.0 - 1.0; }

        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          v += 0.55 * noise(p);
          v += 0.30 * noise(p * 2.13 + vec2(3.7, 1.9));
          v += 0.15 * noise(p * 4.41 - vec2(1.3, 5.2));
          return v;
        }

        void main() {
          vec2 p = vWorld.xz;
          // Four scrolling tileable ripple layers at complementary scales and directions
          mat2 rotA = mat2(0.80, -0.60, 0.60, 0.80);
          mat2 rotB = mat2(-0.55, 0.835, -0.835, -0.55);
          mat2 rotC = mat2(0.31, 0.95, -0.95, 0.31);
          vec2 warp = vec2(
            fbm(p * 0.085 + vec2(time * 0.04, -time * 0.03)) - 0.5,
            fbm(p * 0.085 + vec2(-time * 0.03, time * 0.05) + 4.7) - 0.5
          ) * 1.45;
          vec2 pw = p + warp;
          vec3 n1 = sampleN(pw * 0.095 + vec2(time * 0.022, time * 0.014));
          vec3 n2 = sampleN((rotA * pw) * 0.21 + vec2(-time * 0.019, time * 0.027));
          vec3 n3 = sampleN((rotB * pw) * 0.43 + vec2(time * 0.034, -time * 0.029));
          vec3 n4 = sampleN((rotC * pw) * 0.86 + vec2(-time * 0.049, -time * 0.038));
          vec3 rip = (n1 + n2 * 0.82 + n3 * 0.58 + n4 * 0.34) * chopStrength;

          vec3 viewVec = cameraPosition - vWorld;
          float dist = length(viewVec);
          vec3 v = viewVec / max(dist, 1e-4);
          // Ripples attenuate smoothly toward the horizon to prevent aliasing shimmer
          float detail = mix(1.0, 0.24, smoothstep(14.0, 68.0, dist));

          // Cellular foam lace mask so ripples & surf collars break into frothy sea-spume webs (never solid bands!)
          float foamCellA = fbm(pw * 2.4 + vec2(time * 0.18, -time * 0.14));
          float foamCellB = noise((rotA * pw) * 7.2 - vec2(time * 0.32, time * 0.21));
          float laceMask = smoothstep(0.34, 0.78, foamCellA * 0.65 + foamCellB * 0.35);

          // Expanding ring ripples (splashes, rain, landings) + constant surge train around tower base
          vec2 rn = vec2(0.0);
          float ringFoam = 0.0;
          for (int i = 0; i < 12; i++) {
            vec4 R = ripples[i];
            float age = time - R.z;
            if (age < 0.0 || age > 4.0) continue;
            vec2 dv = p - R.xy;
            float d = length(dv) + 1e-4;
            float c = age * 1.75;
            float env = R.w * exp(-age * 0.92) * exp(-pow((d - c) / (0.32 + age * 0.24), 2.0));
            float ph = (d - c) * 11.5;
            rn += (dv / d) * cos(ph) * env * 0.92;
            ringFoam += max(0.0, sin(ph)) * env * (0.22 + 0.62 * laceMask);
          }

          float rr = length(p);
          float baseEnv = exp(-max(0.0, rr - towerRadius - 0.35) * 0.26)
                        * smoothstep(towerRadius - 0.05, towerRadius + 0.72, rr);
          float bph = rr * 4.4 - time * 2.75 + foamCellA * 2.2;
          rn += (p / max(rr, 1e-3)) * cos(bph) * baseEnv * 0.38;
          ringFoam += smoothstep(0.76, 1.0, sin(bph)) * baseEnv * 0.36 * laceMask;

          vec3 n = normalize(
            vSwellN
            + vec3(rip.x + rn.x, 0.0, rip.y + rn.y) * 0.165 * detail
            + vec3(rn.x, 0.0, rn.y) * 0.12
          );

          // Schlick Fresnel (water F0 = 0.024), smoothly damped near the distant horizon to prevent bright horizon banding
          float farAtten = 1.0 - smoothstep(34.0, 92.0, dist);
          float cosT = clamp(dot(n, v), 0.0, 1.0);
          float fres = 0.024 + 0.976 * pow(1.0 - cosT, 5.0);
          fres = clamp(fres, 0.0, 0.93) * mix(0.32, 1.0, farAtten);

          // Planar reflection distorted by wave normals (soft-compressed in Reboot linear HDR so bright moon/cloud
          // reflections never blow out the bottom-right sea above UnrealBloomPass's ~0.82 threshold)
          vec3 refl = skyColor * (uIsOrig > 0.5 ? (1.12 + lightningBoost * 0.65) : (0.55 + lightningBoost * 0.35));
          if (useReflection > 0.5 && vReflCoord.w > 0.001) {
            vec2 rc = vReflCoord.xy / vReflCoord.w;
            rc += n.xz * 0.048 * detail;
            rc = clamp(rc, vec2(0.002), vec2(0.998));
            refl = texture2D(reflectionMap, rc).rgb;
            if (uIsOrig < 0.5) {
              refl = (refl / (vec3(1.0) + refl * 0.85)) * (0.42 + lightningBoost * 0.14);
            }
          }

          // Deep storm body colour + dramatic abyssal trough darkening + translucent crest lift
          float crest = clamp(vHeight * 2.6 + 0.5, 0.0, 1.0);
          float troughAO = uIsOrig > 0.5 ? 1.0 : mix(0.32, 1.16, smoothstep(-0.22, 0.18, vHeight));
          vec3 body = mix(deepColor * (uIsOrig > 0.5 ? 1.0 : 0.68), shallowColor, pow(crest, 1.35) * (uIsOrig > 0.5 ? 0.62 : 0.54)) * troughAO;

          // Subsurface scattering: moonlight/sunlight glowing through thin wave backs + subtle tower bounce
          vec3 L = normalize(sunDir);
          float sss = pow(clamp(dot(v, -L) * 0.5 + 0.5, 0.0, 1.0), 2.8) * smoothstep(0.42, 0.96, crest) * farAtten;
          body += shallowColor * sss * (uIsOrig > 0.5 ? 0.68 : 0.48);
          float nearGlow = exp(-max(0.0, rr - towerRadius) * 0.55) * (uIsOrig > 0.5 ? 0.12 : 0.07);
          body += glowColor * nearGlow * (0.5 + 0.5 * crest);

          // Attenuate reflection inside deep wave troughs in Reboot so valleys read as dark abyssal shadows
          float reflWeight = uIsOrig > 0.5 ? fres : fres * mix(0.34, 0.90, smoothstep(-0.18, 0.16, vHeight));
          vec3 col = mix(body, refl, reflWeight);

          // Dual-lobe Moon / Sun Glitter Path:
          // 1) Razor-crisp mirror glints on steep wave facets
          // 2) Restrained storm-wave sheen in Reboot so dark midnight swells stay deep slate-indigo (#0a1526..#1e334d)
          vec3 hVec = normalize(L + v);
          float ndh = max(dot(n, hVec), 0.0);
          if (uIsOrig > 0.5) {
            float tightGlint = pow(ndh, 390.0) * 2.35;
            float midGlitter = pow(ndh, 58.0) * (0.16 + moonGlitter * 0.34);
            float stormFacetSheen = pow(ndh, 14.0) * moonGlitter * 0.14 * (0.35 + 0.65 * crest);
            col += sunColor * (tightGlint + midGlitter + stormFacetSheen) * (sunStrength + lightningBoost * 0.8) * farAtten;
          } else {
            float tightGlint = pow(ndh, 440.0) * 1.55;
            float midGlitter = pow(ndh, 72.0) * (0.052 + moonGlitter * 0.11);
            float stormFacetSheen = pow(ndh, 16.0) * moonGlitter * 0.042 * (0.35 + 0.65 * crest);
            vec3 specAdd = sunColor * (tightGlint + midGlitter + stormFacetSheen) * (sunStrength * 0.78 + lightningBoost * 0.45) * farAtten;
            col += min(specAdd, vec3(0.66, 0.72, 0.78));
          }

          // Crashing Sea-Foam Collar around the stone tower base + lacy spume + open-sea whitecaps
          float ang = atan(vWorld.x, vWorld.z);
          float cw = max(0.5, collarWidth);
          float fn = fbm(vec2(ang * 8.0 + sin(time * 0.45), rr * 3.6 - time * 1.25));
          float fnFine = noise(vec2(ang * 26.0, rr * 9.5 + time * 0.85));
          float turb = fn * 0.66 + fnFine * 0.34;

          // Frothy lacy whitewater hugging basal stonework (modulated by cellular lace so it never forms a flat paint band!)
          float innerProx = smoothstep(towerRadius + 0.85 * cw, towerRadius + 0.04, rr + (turb - 0.5) * 0.72 * cw);
          float innerCollar = innerProx * smoothstep(0.26, 0.72, turb * 0.65 + laceMask * 0.55);
          float outerLace = smoothstep(0.50, 0.78, turb)
                          * smoothstep(towerRadius + 2.65 * cw, towerRadius + 0.35, rr)
                          * laceMask;
          float spumeStreaks = smoothstep(0.64, 0.88, noise(vec2(ang * 17.0 + sin(rr * 2.0 - time), rr * 2.6 - time * 1.6)))
                             * smoothstep(towerRadius + 2.0 * cw, towerRadius + 0.25, rr);

          // Wind-whipped whitecaps + netted sea-spume veins along open-ocean storm crests (matching high-res storm photo)
          float crestTurb = fbm(pw * 1.65 + vec2(time * 0.28, -time * 0.19));
          float veinA = 1.0 - abs(noise(pw * 2.85 + vec2(time * 0.21, -time * 0.16)) * 2.0 - 1.0);
          float veinB = 1.0 - abs(noise((rotB * pw) * 5.6 - vec2(time * 0.29, time * 0.18)) * 2.0 - 1.0);
          float foamWeb = smoothstep(0.56, 0.90, veinA * 0.64 + veinB * 0.36);
          float slopePinch = clamp(1.0 - vSwellN.y, 0.0, 1.0);
          float crestBand = smoothstep(0.038, 0.165, vHeight + slopePinch * 0.08);
          float crestFoam = (crestBand * (smoothstep(0.46, 0.78, crestTurb) * 0.62 + foamWeb * 0.68)
                          + smoothstep(-0.02, 0.11, vHeight) * foamWeb * laceMask * 0.26)
                          * (1.0 - smoothstep(28.0, 74.0, dist));

          float rawFoam = innerCollar * 0.88
                        + outerLace * 0.50
                        + spumeStreaks * 0.36
                        + crestFoam * (uIsOrig > 0.5 ? 0.48 : 0.52)
                        + ringFoam;
          float foam = clamp(rawFoam * foamStrength, 0.0, 1.0);
          vec3 frothyWhite = uIsOrig > 0.5
            ? mix(foamColor * 0.86, vec3(0.96, 0.99, 1.0), smoothstep(0.48, 0.96, foam))
            : mix(min(foamColor, vec3(0.52, 0.59, 0.67)) * 0.74, vec3(0.50, 0.58, 0.66), smoothstep(0.42, 0.92, foam));
          col = mix(col, frothyWhite, foam * (uIsOrig > 0.5 ? 0.82 : 0.80));

          // Seamless distant horizon mist blend + circular radial alpha feathering (zero polygon horizon edge!)
          float radNorm = rr / max(uOuterRadius, 1.0);
          float horMist = max(smoothstep(44.0, 108.0, dist), smoothstep(0.34, 0.78, radNorm));
          vec3 mistTarget = skyColor * (uIsOrig > 0.5 ? 0.88 : 0.44);
          #ifdef USE_FOG
            mistTarget = mix(fogColor, mistTarget, 0.24);
          #endif
          col = mix(col, mistTarget, horMist * 0.88);
          float horizonAlpha = (1.0 - smoothstep(58.0, 152.0, dist)) * (1.0 - smoothstep(0.42, 0.92, radNorm));
          if (horizonAlpha < 0.002) discard;

          gl_FragColor = vec4(col, horizonAlpha);
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

    this.applyPreset(era === 'original' ? 'original_hd' : preset);
  }

  /**
   * Applies a named preset from `OCEAN_PRESETS` (or a custom config object) with optional overrides.
   */
  applyPreset(presetOrObj = 'moonlit_storm', overrides = null) {
    const base =
      typeof presetOrObj === 'string'
        ? OCEAN_PRESETS[presetOrObj] || OCEAN_PRESETS.moonlit_storm
        : presetOrObj || OCEAN_PRESETS.moonlit_storm;
    if (typeof presetOrObj === 'string') {
      this.currentPreset = presetOrObj;
      if (this.material?.uniforms?.uIsOrig) {
        this.material.uniforms.uIsOrig.value =
          presetOrObj === 'original' || presetOrObj === 'original_hd' || this.era === 'original' ? 1 : 0;
      }
    }
    this._writeUniformConfig(base);
    if (overrides && typeof overrides === 'object') {
      this._writeUniformConfig(overrides);
    }
    return this;
  }

  /**
   * Switches between `'reboot'` (Moonlit Storm / biome theme) and `'original'` (2008 XBLA HD).
   */
  setEra(era = 'reboot', theme = null) {
    this.era = era === 'original' ? 'original' : 'reboot';
    if (this.material?.uniforms?.uIsOrig) {
      this.material.uniforms.uIsOrig.value = this.era === 'original' ? 1 : 0;
    }
    if (this.era === 'original') {
      this.applyPreset('original_hd');
    } else {
      const key = theme && OCEAN_PRESETS[theme] ? theme : 'moonlit_storm';
      this.applyPreset(key);
    }
    return this;
  }

  /**
   * Clean palette & wave tuning hook for `src/renderer.js`.
   */
  setPalette(opts = {}) {
    if (!opts || typeof opts !== 'object') return this;
    if (opts.era === 'original') {
      this.era = 'original';
      this.applyPreset(opts.preset || 'original_hd', opts);
      return this;
    }
    if (opts.era === 'reboot') {
      this.era = 'reboot';
    }
    const presetKey = opts.preset || opts.theme;
    if (presetKey && OCEAN_PRESETS[presetKey]) {
      this.applyPreset(presetKey, opts);
    } else {
      this._writeUniformConfig(opts);
    }
    return this;
  }

  /**
   * Updates key moon/sun directional glitter parameters without allocating.
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

  setWaterLevel(y) {
    if (Number.isFinite(y)) {
      this.mesh.position.y = y;
    }
    return this;
  }

  _writeUniformConfig(cfg) {
    const u = this.material.uniforms;
    if (cfg.deepColor !== undefined) u.deepColor.value.set(cfg.deepColor);
    if (cfg.shallowColor !== undefined) u.shallowColor.value.set(cfg.shallowColor);
    if (cfg.skyColor !== undefined) u.skyColor.value.set(cfg.skyColor);
    if (cfg.sunColor !== undefined) u.sunColor.value.set(cfg.sunColor);
    if (cfg.glowColor !== undefined) u.glowColor.value.set(cfg.glowColor);
    if (cfg.foamColor !== undefined) u.foamColor.value.set(cfg.foamColor);
    if (cfg.sunDir) {
      if (Array.isArray(cfg.sunDir)) {
        u.sunDir.value.set(cfg.sunDir[0], cfg.sunDir[1], cfg.sunDir[2]).normalize();
      } else if (typeof cfg.sunDir.x === 'number') {
        u.sunDir.value.set(cfg.sunDir.x, cfg.sunDir.y, cfg.sunDir.z || 0).normalize();
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
  }

  /**
   * Per-frame time & dynamic water state update (zero allocations).
   */
  update(time, opts = null) {
    const u = this.material.uniforms;
    u.time.value = Number(time) || 0;
    if (opts) {
      if (opts.waterY !== undefined) this.mesh.position.y = opts.waterY;
      if (opts.lightningFlash !== undefined) u.lightningBoost.value = opts.lightningFlash;
      if (opts.towerRadius !== undefined) u.towerRadius.value = opts.towerRadius;
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

  setSize(w, h, dpr = 1) {
    const scale = this.resScale || 0.45;
    const rw = Math.max(64, Math.floor((w || 360) * (dpr || 1) * scale));
    const rh = Math.max(64, Math.floor((h || 640) * (dpr || 1) * scale));
    if (this.rt.width !== rw || this.rt.height !== rh) {
      this.rt.setSize(rw, rh);
    }
  }

  /**
   * Renders the mirrored scene into `this.rt` using an oblique water-plane near clip.
   * Strictly saves and restores all WebGLRenderer state with zero heap allocations.
   */
  updateReflection(scene, camera) {
    this.material.uniforms.useReflection.value = this.reflectionEnabled ? 1 : 0;
    if (!this.reflectionEnabled || !this.webgl || !scene || !camera) return;

    const mesh = this.mesh;
    mesh.updateMatrixWorld();
    camera.updateMatrixWorld();

    this._reflectorWorld.setFromMatrixPosition(mesh.matrixWorld);
    this._camWorld.setFromMatrixPosition(camera.matrixWorld);
    this._rot.extractRotation(mesh.matrixWorld);
    this._normal.set(0, 1, 0);
    this._view.subVectors(this._reflectorWorld, this._camWorld);
    if (this._view.dot(this._normal) > 0) return; // Camera is below the water plane

    this._view.reflect(this._normal).negate();
    this._view.add(this._reflectorWorld);

    this._rot.extractRotation(camera.matrixWorld);
    this._lookAt.set(0, 0, -1).applyMatrix4(this._rot).add(this._camWorld);
    this._target.subVectors(this._reflectorWorld, this._lookAt);
    this._target.reflect(this._normal).negate();
    this._target.add(this._reflectorWorld);

    const vc = this._virtualCam;
    vc.position.copy(this._view);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(this._normal);
    vc.lookAt(this._target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.textureMatrix.multiply(mesh.matrixWorld);

    // Oblique near plane aligned with the water surface so submerged geometry never leaks above
    this._plane.setFromNormalAndCoplanarPoint(this._normal, this._reflectorWorld);
    this._plane.applyMatrix4(vc.matrixWorldInverse);
    this._clip.set(
      this._plane.normal.x,
      this._plane.normal.y,
      this._plane.normal.z,
      this._plane.constant
    );
    const pm = vc.projectionMatrix.elements;
    this._q.x = (Math.sign(this._clip.x) + pm[8]) / pm[0];
    this._q.y = (Math.sign(this._clip.y) + pm[9]) / pm[5];
    this._q.z = -1.0;
    this._q.w = (1.0 + pm[10]) / pm[14];
    this._clip.multiplyScalar(2.0 / this._clip.dot(this._q));
    pm[2] = this._clip.x;
    pm[6] = this._clip.y;
    pm[10] = this._clip.z + 1.0 - 0.003;
    pm[14] = this._clip.w;

    const r = this.webgl;
    const prevTarget = r.getRenderTarget ? r.getRenderTarget() : null;
    const prevAutoClear = r.autoClear;
    const prevToneMapping = r.toneMapping;
    const prevExposure = r.toneMappingExposure;
    const prevXr = r.xr ? r.xr.enabled : false;
    const prevShadowAuto = r.shadowMap ? r.shadowMap.autoUpdate : false;
    const prevVisible = mesh.visible;

    try {
      if (r.xr) r.xr.enabled = false;
      if (r.shadowMap) r.shadowMap.autoUpdate = false;
      mesh.visible = false;
      r.setRenderTarget(this.rt);
      if (r.state?.buffers?.depth) {
        r.state.buffers.depth.setMask(true);
      }
      r.autoClear = true;
      r.clear(true, true, false);
      r.render(scene, vc);
    } finally {
      mesh.visible = prevVisible;
      if (r.xr) r.xr.enabled = prevXr;
      if (r.shadowMap) r.shadowMap.autoUpdate = prevShadowAuto;
      r.autoClear = prevAutoClear;
      r.toneMapping = prevToneMapping;
      r.toneMappingExposure = prevExposure;
      r.setRenderTarget(prevTarget);
    }
  }

  dispose() {
    this.rt?.dispose();
    this.normalTex?.dispose();
    this.mesh?.geometry?.dispose();
    this.material?.dispose();
  }
}
