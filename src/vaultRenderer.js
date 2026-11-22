// TOWERING WATERS: GATEWAY'S DESCENT — HARMONIC ASTROLABE VAULT 3D RENDERER (`src/vaultRenderer.js`)
//
// Blender-First Pelagian Domed Astrolabe Cathedral Engine:
//   - Loads sculpted Blender 5.3 PBR + Vertex-AO kit `assets/models/env_vault_chamber.glb`:
//       * `Vault_ChamberRotunda` — Monumental domed sandstone/travertine cathedral rotunda w/ 8
//         swept bronze vault ribs, central oculus ring, tall fluted columns, 7 recessed lancet
//         alcoves, curved stepped stone walkways, & twin sculpted Axolotl-Guardian water-spouts
//       * `Vault_Waterfalls`     — 3D volumetric parabolic cascades shaded w/ animated GLSL foam
//       * `Vault_OuterFrame`, `Vault_Ring0`, `Vault_Ring1`, `Vault_Ring2`, `Vault_CoreJewel`
//       * `Vault_HeroDais`       — Carved stone-and-bronze casting dais for Gateway 2.0
//       * `Vault_Brazier`        — Sculpted stone-pedestal antique-bronze fire braziers
//   - Real single-pass GLSL crystal-clear turquoise reflective water basin (Main Spire quality:
//     Schlick Fresnel reflections, dual-rotated organic ripple normals, submerged sunlit caustics,
//     lacy shoreline & waterfall splash foam — ZERO polka dots, ZERO extra reflection passes!)
//   - Diagonal golden oculus volumetric sunbeams, flickering teardrop brazier flames, tactile ring
//     detent recoil, lock shockwaves, dual Gateway 2.0 hydro-channel ribbons, & locked 60fps D3D11!

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GatewayRig } from './gateway.js';
import { createWaterNormalTexture } from './water.js';

const TAU = Math.PI * 2;
const RING_RADII = [2.22, 1.64, 1.08];
const RING_Z = [0.08, 0.17, 0.26];
const WATER_Y = -2.85;
const MAX_MOTES = 88;
const MAX_STRIKE_GEMS = 5;
const MAX_LOCK_BURST = 28;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function wrapAngle(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
}

function buildNotchArcGeo(radius, tube, arcSpan) {
  return new THREE.TorusGeometry(radius, tube, 10, 32, arcSpan);
}

function makeSolidAlbedoTex(r, g, b) {
  const data = new Uint8Array([r, g, b, 255, r, g, b, 255, r, g, b, 255, r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSoftSunbeamTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(254, 240, 196);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const hGrad = ctx.createLinearGradient(0, 0, size, 0);
  hGrad.addColorStop(0.0, 'rgba(255, 242, 200, 0.0)');
  hGrad.addColorStop(0.28, 'rgba(255, 242, 200, 0.42)');
  hGrad.addColorStop(0.50, 'rgba(255, 249, 222, 0.88)');
  hGrad.addColorStop(0.72, 'rgba(255, 242, 200, 0.42)');
  hGrad.addColorStop(1.0, 'rgba(255, 242, 200, 0.0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'destination-in';
  const vGrad = ctx.createLinearGradient(0, 0, 0, size);
  vGrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  vGrad.addColorStop(0.18, 'rgba(255,255,255,0.88)');
  vGrad.addColorStop(0.72, 'rgba(255,255,255,0.40)');
  vGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTeardropFlameTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(255, 200, 96);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const aura = ctx.createRadialGradient(cx, size * 0.62, 2, cx, size * 0.56, size * 0.46);
  aura.addColorStop(0.0, 'rgba(255, 232, 145, 0.82)');
  aura.addColorStop(0.36, 'rgba(251, 146, 60, 0.52)');
  aura.addColorStop(0.70, 'rgba(220, 38, 38, 0.16)');
  aura.addColorStop(1.0, 'rgba(180, 20, 0, 0.0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);

  const drawTongue = (ox, oy, rx, ry, innerCol, midCol, outerCol) => {
    ctx.save();
    ctx.translate(cx + ox, size * 0.68 + oy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0.12, 0.05, 0, -0.25, 1.0);
    g.addColorStop(0.0, innerCol);
    g.addColorStop(0.38, midCol);
    g.addColorStop(0.76, outerCol);
    g.addColorStop(1.0, 'rgba(234, 88, 12, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -1.05);
    ctx.bezierCurveTo(0.62, -0.45, 0.85, 0.35, 0, 0.72);
    ctx.bezierCurveTo(-0.85, 0.35, -0.62, -0.45, 0, -1.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawTongue(0, -4, size * 0.34, size * 0.48, 'rgba(255, 252, 214, 0.94)', 'rgba(251, 146, 60, 0.72)', 'rgba(234, 88, 12, 0.16)');
  drawTongue(-5, -2, size * 0.20, size * 0.36, 'rgba(255, 255, 238, 0.86)', 'rgba(253, 186, 116, 0.54)', 'rgba(249, 115, 22, 0.08)');
  drawTongue(6, 0, size * 0.18, size * 0.32, 'rgba(255, 255, 232, 0.82)', 'rgba(251, 191, 36, 0.48)', 'rgba(249, 115, 22, 0.08)');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftGlowSpriteTex(size = 64) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(255, 250, 210);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  g.addColorStop(0.0, 'rgba(255, 255, 245, 1.0)');
  g.addColorStop(0.28, 'rgba(186, 248, 255, 0.72)');
  g.addColorStop(0.62, 'rgba(56, 189, 248, 0.20)');
  g.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHydroRibbonTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(120, 245, 252);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const base = ctx.createLinearGradient(0, 0, 0, size);
  base.addColorStop(0.0, 'rgba(56, 189, 248, 0.08)');
  base.addColorStop(0.28, 'rgba(125, 235, 252, 0.52)');
  base.addColorStop(0.50, 'rgba(232, 255, 255, 0.88)');
  base.addColorStop(0.72, 'rgba(125, 235, 252, 0.52)');
  base.addColorStop(1.0, 'rgba(56, 189, 248, 0.08)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 22; i++) {
    const sx = (i * 31) % size;
    const sy = 16 + ((i * 23) % (size - 32));
    const w = 24 + (i % 28);
    for (const ox of [-size, 0, size]) {
      const g = ctx.createLinearGradient(sx + ox, sy, sx + ox + w, sy);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(240, 255, 255, 0.65)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx + ox, sy, w, 4 + (i % 4));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAquaRuneRingTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(94, 252, 232);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const rg = ctx.createRadialGradient(cx, cx, size * 0.34, cx, cx, size * 0.49);
  rg.addColorStop(0.0, 'rgba(6, 182, 212, 0)');
  rg.addColorStop(0.36, 'rgba(34, 211, 238, 0.24)');
  rg.addColorStop(0.55, 'rgba(94, 252, 232, 0.72)');
  rg.addColorStop(0.76, 'rgba(34, 211, 238, 0.24)');
  rg.addColorStop(1.0, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(224, 255, 252, 0.90)';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * TAU;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * (size * 0.415), cx + Math.sin(ang) * (size * 0.415));
    ctx.rotate(ang + Math.PI * 0.5);
    ctx.beginPath();
    if (i % 3 === 0) {
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 0);
      ctx.closePath();
    } else {
      ctx.moveTo(-4, -5);
      ctx.lineTo(0, 5);
      ctx.lineTo(4, -5);
    }
    ctx.stroke();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------------------------ REAL GLSL TURQUOISE BASIN WATER & FOAMING WATERFALL SHADERS (60FPS LOCKED!)
function createVaultWaterMaterial(normalTex) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uNormalMap: { value: normalTex },
      uDeepColor: { value: new THREE.Color('#053c52') },
      uShallowColor: { value: new THREE.Color('#13bfa8') },
      uSkyColor: { value: new THREE.Color('#287492') },
      uWarmReflColor: { value: new THREE.Color('#e8ba6e') },
      uSunColor: { value: new THREE.Color('#ffefc2') },
      uSunDir: { value: new THREE.Vector3(0.32, 0.72, 0.62).normalize() },
      uDaisPos: { value: new THREE.Vector2(-2.75, 2.05) },
      uPulseBoost: { value: 0 },
    },
  ]);

  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float w = sin(wp.x * 0.85 + uTime * 1.45) * 0.016
                + cos(wp.z * 0.92 - uTime * 1.18) * 0.014;
        wp.y += w;
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uNormalMap;
      uniform vec3 uDeepColor;
      uniform vec3 uShallowColor;
      uniform vec3 uSkyColor;
      uniform vec3 uWarmReflColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec2 uDaisPos;
      uniform float uPulseBoost;

      varying vec3 vWorld;
      #include <fog_pars_fragment>

      vec3 sampleN(vec2 uv) { return texture2D(uNormalMap, uv).xyz * 2.0 - 1.0; }

      void main() {
        vec2 p = vWorld.xz;
        mat2 rotA = mat2(0.80, -0.60, 0.60, 0.80);
        mat2 rotB = mat2(-0.55, 0.835, -0.835, -0.55);

        // Ultra-fast 3-tap hardware-filtered multi-scale ripples + organic warp (ZERO procedural fbm ALU, ZERO polka dots!)
        vec3 n1 = sampleN(p * 0.16 + vec2(uTime * 0.030, uTime * 0.020));
        vec2 pw = p + n1.xy * 0.34;
        vec3 n2 = sampleN((rotA * pw) * 0.31 + vec2(-uTime * 0.026, uTime * 0.034));
        vec3 n3 = sampleN((rotB * pw) * 0.56 + vec2(uTime * 0.038, -uTime * 0.028));
        vec2 rip = n1.xy + n2.xy * 0.72 + n3.xy * 0.36;

        // Twin waterfall splash ripples at (-3.38, 0.35) and (+3.38, 0.35)
        vec2 dpL = p - vec2(-3.38, 0.35);
        vec2 dpR = p - vec2(3.38, 0.35);
        float dSplL = length(dpL);
        float dSplR = length(dpR);
        float dSpl = min(dSplL, dSplR);
        float wSplL = exp(-dSplL * 0.92) * sin(dSplL * 9.5 - uTime * 7.2);
        float wSplR = exp(-dSplR * 0.92) * sin(dSplR * 9.5 - uTime * 7.2 + 1.4);
        rip += (dpL / max(dSplL, 0.05)) * wSplL * 0.42 + (dpR / max(dSplR, 0.05)) * wSplR * 0.42;

        vec3 N = normalize(vec3(rip.x * 0.18, 1.0, rip.y * 0.18));
        vec3 V = normalize(cameraPosition - vWorld);

        // Distances to architectural shorelines (rotunda wall, astrolabe plinth, Hero Dais, braziers)
        float rRot = length(p - vec2(0.0, 1.65));
        float dWall = max(0.0, 6.75 - rRot);
        float dDais = max(0.0, length(p - uDaisPos) - 1.24);
        float dPlinth = max(0.0, length((p - vec2(0.0, -0.26)) * vec2(0.52, 1.45)) - 1.02);
        float dBrazL = max(0.0, length(p - vec2(-2.65, 0.95)) - 0.56);
        float dBrazR = max(0.0, length(p - vec2(2.65, 0.95)) - 0.56);
        float shoreD = min(min(dWall, dDais), min(dPlinth, min(dBrazL, dBrazR)));

        // Smooth crystal turquoise depth gradient + delicate sunlit underwater caustic filigree
        float shallowMask = exp(-shoreD * 0.85) * 0.65 + exp(-length(p - vec2(0.0, 0.4)) * 0.18) * 0.35;
        vec3 waterBody = mix(uDeepColor, uShallowColor, clamp(shallowMask, 0.0, 1.0));

        // Refracted submerged caustic filigree directly from rotated normal-map interference (0 extra fetches!)
        float ca1 = pow(clamp(1.0 - abs(n1.x - n2.y) * 3.8, 0.0, 1.0), 3.4);
        float ca2 = pow(clamp(1.0 - abs(n2.x + n3.y) * 3.6, 0.0, 1.0), 3.8);
        float causticLine = clamp(ca1 * 0.68 + ca2 * 0.52, 0.0, 1.0);
        float oculusPool = exp(-dot(p - vec2(0.0, 0.9), p - vec2(0.0, 0.9)) * 0.044);
        waterBody += vec3(0.22, 0.88, 0.92) * causticLine * (0.20 + 0.42 * oculusPool + 0.24 * uPulseBoost);

        // Schlick Fresnel reflecting warm vaulted rotunda bronze/sandstone + golden astrolabe glow
        float cosT = clamp(dot(N, V), 0.0, 1.0);
        float fres = clamp(0.028 + 0.972 * pow(1.0 - cosT, 4.2), 0.0, 0.84);
        vec3 R = reflect(-V, N);
        float reflAstro = exp(-pow(p.x * 0.32, 2.0)) * smoothstep(4.2, -1.8, p.y) * 0.70;
        float reflBraz = (exp(-dBrazL * 0.78) + exp(-dBrazR * 0.78)) * 0.52;
        vec3 envRefl = mix(uSkyColor * 0.80, uWarmReflColor * 0.84, clamp(0.22 + reflAstro * 0.62 + max(0.0, R.y) * 0.22, 0.0, 1.0));
        envRefl += vec3(1.0, 0.58, 0.18) * reflBraz;
        envRefl += vec3(0.18, 0.84, 0.90) * (0.14 + 0.20 * uPulseBoost) * reflAstro;

        vec3 col = mix(waterBody, envRefl, fres * 0.64);

        // Controlled golden sunlit specular glitter from overhead oculus (clamped — zero harsh clipping!)
        vec3 H = normalize(uSunDir + V);
        float specSharp = pow(max(dot(N, H), 0.0), 140.0) * 0.82;
        float specSoft = pow(max(dot(N, H), 0.0), 24.0) * 0.16;
        col += uSunColor * (specSharp + specSoft) * (0.45 + 0.55 * oculusPool);

        // Organic lacy shoreline foam collar & waterfall boil rings derived directly from n2/n3!
        float lace = smoothstep(-0.18, 0.58, n2.x * 0.55 + n3.y * 0.65);
        float shoreFoam = exp(-shoreD * 3.8) * (0.24 + 0.62 * lace);
        float splBoil = exp(-dSpl * 1.95) * (0.62 + 0.38 * lace)
                      + smoothstep(0.65, 1.0, sin(dSpl * 9.8 - uTime * 7.5)) * exp(-dSpl * 1.25) * 0.44 * lace;
        float foam = clamp(shoreFoam * 0.72 + splBoil, 0.0, 0.90);
        col = mix(col, vec3(0.88, 0.98, 1.0), foam);

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });
}

function createFoamingWaterfallMaterial(waterY, normalTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWaterY: { value: waterY },
      uNormalMap: { value: normalTex },
      uTopColor: { value: new THREE.Color('#42cce0') },
      uFoamColor: { value: new THREE.Color('#f4feff') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaterY;
      uniform sampler2D uNormalMap;
      uniform vec3 uTopColor;
      uniform vec3 uFoamColor;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormalW;

      void main() {
        // Airy translucent sunlit rushing water ribbons using fast hardware texture lookups + soft silhouette feathering!
        vec2 uv1 = vec2(vUv.x * 1.8, vWorld.y * 0.34 + uTime * 1.55);
        vec2 uv2 = vec2(vUv.x * 3.2 + 0.37, vWorld.y * 0.58 + uTime * 2.35);
        float s1 = texture2D(uNormalMap, uv1).x;
        float s2 = texture2D(uNormalMap, uv2).y;
        float streak = s1 * 0.56 + s2 * 0.44;
        float foam = smoothstep(0.46, 0.78, streak);
        float boil = smoothstep(uWaterY + 0.95, uWaterY - 0.02, vWorld.y);
        float submergeFade = smoothstep(uWaterY - 0.16, uWaterY + 0.06, vWorld.y);

        vec3 V = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormalW), V));
        float softEdge = smoothstep(0.06, 0.58, facing);
        vec3 col = mix(uTopColor, uFoamColor, clamp(foam * 0.85 + boil * 0.78 + (1.0 - facing) * 0.25, 0.0, 1.0));
        float alpha = clamp((0.36 + foam * 0.38 + boil * 0.32) * (0.35 + 0.65 * softEdge) * submergeFade, 0.0, 0.86);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function buildVaultEnvMap(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#16455d');
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 10),
      new THREE.MeshBasicMaterial({ color: '#1b5872', side: THREE.BackSide })
    );
    envScene.add(dome);
    const oculus = new THREE.Mesh(
      new THREE.CircleGeometry(5.6, 18),
      new THREE.MeshBasicMaterial({ color: '#ffe8b8' })
    );
    oculus.position.set(2.5, 12, 5.5);
    oculus.lookAt(0, 0, 0);
    envScene.add(oculus);
    const warmBounce = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 14),
      new THREE.MeshBasicMaterial({ color: '#e6a654' })
    );
    warmBounce.position.set(-10, 0.5, 5);
    warmBounce.lookAt(0, 0, 0);
    envScene.add(warmBounce);
    const aquaBounce = new THREE.Mesh(
      new THREE.CircleGeometry(4.5, 14),
      new THREE.MeshBasicMaterial({ color: '#38d8d4' })
    );
    aquaBounce.position.set(8, -4, 5);
    aquaBounce.lookAt(0, 0, 0);
    envScene.add(aquaBounce);
    const rt = pmrem.fromScene(envScene, 0.045);
    for (const m of [dome, oculus, warmBounce, aquaBounce]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    pmrem.dispose();
    return rt;
  } catch {
    return null;
  }
}

function buildVaultHydroRibbonGeo(segs = 18) {
  const verts = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    uvs[i * 4 + 0] = u * 2.5;
    uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = u * 2.5;
    uvs[i * 4 + 3] = 1;
    if (i < segs) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.userData.segs = segs;
  return geo;
}

function cloneSubtreeWithMaterials(srcObj) {
  const clone = srcObj.clone(true);
  clone.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    if (Array.isArray(o.material)) {
      o.material = o.material.map((m) => m.clone());
    } else {
      o.material = o.material.clone();
    }
  });
  return clone;
}

// ------------------------------------------------------------------------------------ VaultRenderer
export class VaultRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.dpr = opts.dpr || 1;
    this.envMap = opts.envMap || null;
    this.skinId = opts.skinId || 'sea_glass_guardian';
    this._disposed = false;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._lookVec = new THREE.Vector3(0, 0.4, 0.3);
    this._loadedTextures = [];
    this.postfxActive = false;
    this._envRt = null;
    this._envBuilt = false;
    this._glbLoaded = false;
    this._prevLockedMask = 0;
    this._prevStrikes = 0;
    this._prevTime = 0;
    this._ringDetentT = [-10, -10, -10];
    this._lockBurstT = -10;
    this._lockBurstRingIdx = 0;
    this._strikeFlashT = -10;
    this._heroCastT = -10;

    this.waterNormalTex = createWaterNormalTexture(128);
    this.sunbeamTex = createSoftSunbeamTex(128);
    this.flameTex = createTeardropFlameTex(128);
    this.hydroRibbonTex = createHydroRibbonTex(128);
    this.runeRingTex = createAquaRuneRingTex(256);
    this.moteGlowTex = createSoftGlowSpriteTex(64);

    this._initScene();
    this._loadVaultChamberGlb();
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.hero?.setSkin?.(skinId);
  }

  prewarm() {
    try {
      this.webgl?.compile?.(this.scene, this.camera);
    } catch {
      // Ignore headless
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
    this.scene.background = new THREE.Color('#0f384e');
    this.scene.fog = new THREE.FogExp2('#103c52', 0.026);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.68;
    }

    this.camera = new THREE.PerspectiveCamera(47, this.width / Math.max(1, this.height), 0.2, 75);

    // Balanced Main-Spire Cathedral Lighting Rig (Warm Oculus Sun + Cool Turquoise Basin Bounce + Single Dynamic Core PointLight)
    this.hemiLight = new THREE.HemisphereLight('#86cce8', '#264656', 0.92);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#ffebc4', 1.88);
    this.sunLight.position.set(4.2, 12.5, 8.2);
    this.sunLight.castShadow = false;
    this.scene.add(this.sunLight);

    this.basinBounce = new THREE.DirectionalLight('#22bfd4', 0.74);
    this.basinBounce.position.set(-4.8, -2.5, 5.8);
    this.scene.add(this.basinBounce);

    this.coreLight = new THREE.PointLight('#4ef6e8', 1.85, 14);
    this.coreLight.position.set(0, 0.2, 2.2);
    this.scene.add(this.coreLight);

    // Root container for sculpted Blender 5.3 Vault Rotunda + Astrolabe Outer Frame + Waterfalls + Braziers
    this.glbArchGroup = new THREE.Group();
    this.scene.add(this.glbArchGroup);

    // Minimal clean fallback backdrop visible ONLY during the ~10ms async GLB fetch (hidden immediately on GLB load!)
    this.fallbackGroup = new THREE.Group();
    this.bronzeFallbackMat = new THREE.MeshStandardMaterial({
      color: '#cfa04c',
      roughness: 0.30,
      metalness: 0.80,
    });
    const fbRim = new THREE.Mesh(new THREE.TorusGeometry(2.74, 0.14, 10, 32), this.bronzeFallbackMat);
    const fbBack = new THREE.Mesh(
      new THREE.CircleGeometry(2.68, 32),
      new THREE.MeshStandardMaterial({ color: '#1b3f52', roughness: 0.55, metalness: 0.25 })
    );
    fbBack.position.z = -0.14;
    this.fallbackGroup.add(fbRim, fbBack);
    this.scene.add(this.fallbackGroup);

    // 1. REAL GLSL Crystal-Clear Reflective Turquoise Vault Floor Basin (ZERO polka dots!)
    this.waterMat = createVaultWaterMaterial(this.waterNormalTex);
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(34, 28, 36, 28), this.waterMat);
    this.waterMesh.rotation.x = -Math.PI * 0.5;
    this.waterMesh.position.set(0, WATER_Y, 1.6);
    this.scene.add(this.waterMesh);

    // Shared GLSL Foaming Waterfall Material (applied to `Vault_Waterfalls` on GLB load!)
    this.waterfallMat = createFoamingWaterfallMaterial(WATER_Y, this.waterNormalTex);

    // Animated Translucent Mist Plumes where Twin Waterfalls Plunge into the Turquoise Basin
    this.splashMistMat = new THREE.MeshBasicMaterial({
      color: '#d8fbff',
      map: this.moteGlowTex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.wfSplashMists = [];
    for (const sx of [-3.38, 3.38]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), this.splashMistMat);
      m.position.set(sx, WATER_Y + 0.34, 0.36);
      this.scene.add(m);
      this.wfSplashMists.push({ mesh: m, sx });
    }

    // 2. Diagonal Golden Volumetric Sunbeam Cones slanting down from the Domed Oculus
    this.sunbeamMat = new THREE.MeshBasicMaterial({
      color: '#ffe9b0',
      map: this.sunbeamTex,
      transparent: true,
      opacity: 0.21,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sunbeams = [];
    for (const [bx, by, bz, bw, bh, rz] of [
      [-1.05, 2.6, 1.15, 3.6, 11.4, -0.24],
      [0.85, 2.9, 0.85, 4.2, 11.8, -0.28],
      [-2.25, 2.0, 1.85, 2.5, 9.8, -0.20],
    ]) {
      const sb = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), this.sunbeamMat);
      sb.position.set(bx, by, bz);
      sb.rotation.z = rz;
      this.scene.add(sb);
      this.sunbeams.push(sb);
    }

    // 3. Soft Flickering Dual-Layer Teardrop Brazier Flames (mounted cleanly above `Vault_Brazier` bowls at X=+/-2.65, Z=0.95)
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: '#ffedd5',
      map: this.flameTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameInnerMat = new THREE.MeshBasicMaterial({
      color: '#fef9c3',
      map: this.flameTex,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.brazierFlames = [];
    for (const sx of [-2.65, 2.65]) {
      const fOut = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.16), flameOuterMat);
      fOut.position.set(sx, WATER_Y + 1.46, 0.95);
      const fIn = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.74), flameInnerMat);
      fIn.position.set(sx, WATER_Y + 1.38, 0.98);
      this.scene.add(fOut, fIn);
      this.brazierFlames.push({ fOut, fIn, sx });
    }

    // 4. Recessed Glowing Aqua Rune Halo behind the 3 Concentric Astrolabe Rings
    this.runeRingMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      map: this.runeRingTex,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.runeRingMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.15, 5.15), this.runeRingMat);
    this.runeRingMesh.position.z = -0.02;
    this.scene.add(this.runeRingMesh);

    // 5. Top 12-O'Clock (+Y) Caliper Crystal Alignment Indicator Jewel (nests right into `Vault_OuterFrame` crown arch!)
    this.caliperGemMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#0891b2',
      emissiveIntensity: 0.85,
      roughness: 0.12,
      metalness: 0.28,
      flatShading: true,
    });
    this.caliperGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), this.caliperGemMat);
    this.caliperGem.scale.set(0.88, 1.24, 0.72);
    this.caliperGem.position.set(0, 2.66, 0.36);
    this.caliperGemHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.68),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.caliperGemHalo.position.set(0, 2.66, 0.44);
    this.scene.add(this.caliperGem, this.caliperGemHalo);

    // 6. 3 Concentric Rotary Astrolabe Ring Slots (populated w/ Blender `Vault_Ring0..2` + live tolerance sweet-spot conduit!)
    this.ringObjs = [];
    for (let i = 0; i < 3; i++) {
      const rad = RING_RADII[i];
      const tol = i === 0 ? 0.42 : i === 1 ? 0.38 : 0.35;
      const rg = new THREE.Group();
      rg.position.z = RING_Z[i];

      const fallbackRing = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.13, 10, 36), this.bronzeFallbackMat.clone());
      rg.add(fallbackRing);

      // Luminous translucent tolerance arc showing exact sweet-spot zone centered at 12-o'clock (`delta === 0`)
      const notchMat = new THREE.MeshStandardMaterial({
        color: '#14d8e8',
        emissive: '#0284c7',
        emissiveIntensity: 0.72,
        roughness: 0.12,
        metalness: 0.24,
        transparent: true,
        opacity: 0.72,
      });
      const notchMesh = new THREE.Mesh(buildNotchArcGeo(rad, 0.132, tol * 2), notchMat);
      notchMesh.rotation.z = Math.PI * 0.5 - tol;
      notchMesh.position.z = 0.035;
      rg.add(notchMesh);

      rg.userData = {
        rad,
        builtTol: tol,
        fallbackRing,
        glbRing: null,
        bronzeMats: [fallbackRing.material],
        crystalMats: [],
        notchMat,
        notchMesh,
      };
      this.scene.add(rg);
      this.ringObjs.push(rg);
    }

    // 7. Central Harmonic Core Jewel Group (populated w/ Blender `Vault_CoreJewel`!)
    this.centerSeedGroup = new THREE.Group();
    this.centerSeedGroup.position.z = 0.36;
    this.seedCoreMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#0284c7',
      emissiveIntensity: 0.65,
      roughness: 0.10,
      metalness: 0.30,
      flatShading: true,
    });
    this.fallbackSeedCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.seedCoreMat);
    this.fallbackSeedCore.scale.set(0.82, 1.24, 0.82);
    this.seedHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.seedHalo.position.z = -0.05;
    this.centerSeedGroup.add(this.fallbackSeedCore, this.seedHalo);
    this.centerSeedGroup.userData = { glbCore: null, crystalMats: [this.seedCoreMat] };
    this.scene.add(this.centerSeedGroup);

    // 8. Strike Telemetry Gems nested in sculpted bronze hexagonal sockets along the lower cradle
    this.strikeGems = [];
    const sockGeo = new THREE.CylinderGeometry(0.155, 0.185, 0.09, 6);
    sockGeo.rotateX(Math.PI * 0.5);
    for (let i = 0; i < MAX_STRIKE_GEMS; i++) {
      const slot = new THREE.Group();
      const socket = new THREE.Mesh(sockGeo, this.bronzeFallbackMat);
      socket.position.z = -0.02;
      const gm = new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#0284c7',
        emissiveIntensity: 0.65,
        roughness: 0.12,
        metalness: 0.30,
        flatShading: true,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), gm);
      gem.scale.set(0.95, 1.05, 0.72);
      gem.position.z = 0.055;
      slot.add(socket, gem);
      slot.position.set(0, -2.56, 0.34);
      slot.visible = false;
      slot.userData = { gem, mat: gm };
      this.scene.add(slot);
      this.strikeGems.push(slot);
    }

    // 9. Floating Sunlit Golden Dust & Turquoise Mist Motes (1 draw call!)
    this.moteInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.15, 0.15),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_MOTES
    );
    this.moteInst.frustumCulled = false;
    for (let i = 0; i < MAX_MOTES; i++) {
      this._col.set(i % 2 === 0 ? '#fef08a' : '#7dd3fc');
      this.moteInst.setColorAt(i, this._col);
    }
    if (this.moteInst.instanceColor) this.moteInst.instanceColor.needsUpdate = true;
    this.scene.add(this.moteInst);

    // 10. Gateway 2.0 Heroine on Sculpted Blender `Vault_HeroDais` + Grounded Contact AO!
    this.heroDaisGroup = new THREE.Group();
    this.fallbackDais = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 1.15, 0.36, 12),
      new THREE.MeshStandardMaterial({ color: '#d8c29a', roughness: 0.65 })
    );
    this.fallbackDais.position.y = -0.02;
    this.heroDaisGroup.add(this.fallbackDais);

    let aoTex = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const ac = document.createElement('canvas');
      ac.width = 64;
      ac.height = 64;
      const actx = ac.getContext('2d');
      const ag = actx.createRadialGradient(32, 32, 4, 32, 32, 30);
      ag.addColorStop(0, 'rgba(6, 20, 32, 0.56)');
      ag.addColorStop(0.55, 'rgba(6, 20, 32, 0.22)');
      ag.addColorStop(1, 'rgba(6, 20, 32, 0)');
      actx.fillStyle = ag;
      actx.fillRect(0, 0, 64, 64);
      aoTex = new THREE.CanvasTexture(ac);
      this._heroAoTex = aoTex;
    }
    const heroContactAo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 1.12),
      new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.90, depthWrite: false })
    );
    heroContactAo.rotation.x = -Math.PI * 0.5;
    heroContactAo.position.y = 0.172;
    this.heroDaisGroup.add(heroContactAo);

    this.hero = new GatewayRig(this.skinId);
    this.hero.group.position.set(0, 0.165, 0);
    this.hero.group.rotation.y = 2.42;
    this.hero.group.scale.setScalar(1.44);
    this.heroDaisGroup.add(this.hero.group);
    this.heroDaisGroup.position.set(-2.75, WATER_Y + 0.18, 2.05);
    this.scene.add(this.heroDaisGroup);

    // 11. Dual Glowing Aquamarine Hydro-Channel Ribbons from Gateway's Paws into Active Ring!
    this.hydroRibbonGeoL = buildVaultHydroRibbonGeo(18);
    this.hydroRibbonGeoR = buildVaultHydroRibbonGeo(18);
    this.hydroRibbonMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      map: this.hydroRibbonTex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.hydroArcL = new THREE.Mesh(this.hydroRibbonGeoL, this.hydroRibbonMat);
    this.hydroArcR = new THREE.Mesh(this.hydroRibbonGeoR, this.hydroRibbonMat);
    this.hydroArcL.frustumCulled = false;
    this.hydroArcR.frustumCulled = false;
    this.scene.add(this.hydroArcL, this.hydroArcR);

    // 12. Expanding Lock Shockwave Ring & 28 Radial Sparkle Burst Sprites
    this.lockWaveMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      map: this.runeRingTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.lockWaveMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6), this.lockWaveMat);
    this.lockWaveMesh.position.z = 0.44;
    this.lockWaveMesh.visible = false;
    this.scene.add(this.lockWaveMesh);

    this.lockBurstInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_LOCK_BURST
    );
    this.lockBurstInst.frustumCulled = false;
    for (let i = 0; i < MAX_LOCK_BURST; i++) {
      this._col.set(i % 2 === 0 ? '#fde047' : '#5efce8');
      this.lockBurstInst.setColorAt(i, this._col);
    }
    if (this.lockBurstInst.instanceColor) this.lockBurstInst.instanceColor.needsUpdate = true;
    this.lockBurstInst.count = 0;
    this.scene.add(this.lockBurstInst);
  }

  _loadVaultChamberGlb() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const loader = new GLTFLoader();
    loader.load(
      'assets/models/env_vault_chamber.glb',
      (gltf) => {
        if (this._disposed || !gltf?.scene) return;
        this._mountVaultChamberGlb(gltf.scene);
      },
      undefined,
      () => {}
    );
  }

  _tuneMaterials(obj, { calmLancets = false, envScale = 0.72 } = {}) {
    obj.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (typeof m.envMapIntensity === 'number') m.envMapIntensity = envScale;
        const mn = m.name || '';
        // Balance antique bronze roughness & sheen so metal gleams richly without blowing out to white!
        if (mn.includes('Bronze')) {
          m.roughness = Math.max(0.28, m.roughness ?? 0.32);
          m.metalness = Math.min(0.80, m.metalness ?? 0.76);
          m.envMapIntensity = 0.68;
        }
        if (mn.includes('Basalt')) {
          m.metalness = Math.min(0.06, m.metalness ?? 0.05);
          m.roughness = Math.max(0.68, m.roughness ?? 0.74);
        }
        // Dial back far-left/right rotunda lancet cyan tracery into serene recessed stained-glass glow (Visual QC Gate #641!)
        if (calmLancets && mn.includes('AquaCrystal')) {
          m.emissiveIntensity = 0.36;
          m.color?.set('#1f8fa4');
          m.emissive?.set('#0c6075');
        }
        if (calmLancets && mn.includes('GoldRune')) {
          m.emissiveIntensity = 0.52;
        }
        if (mn.includes('Ember')) {
          m.emissiveIntensity = 1.15;
        }
      }
    });
  }

  _mountVaultChamberGlb(root) {
    const byName = (name) => root.getObjectByName(name);

    // 1. Domed Cathedral Rotunda
    const rotunda = byName('Vault_ChamberRotunda');
    if (rotunda) {
      const rClone = cloneSubtreeWithMaterials(rotunda);
      this._tuneMaterials(rClone, { calmLancets: true, envScale: 0.62 });
      this.glbArchGroup.add(rClone);
    }

    // 2. Sculpted 3D Parabolic Waterfalls with Animated GLSL Foaming Shader!
    const waterfalls = byName('Vault_Waterfalls');
    if (waterfalls) {
      const wfClone = waterfalls.clone(true);
      wfClone.traverse((o) => {
        if (o.isMesh) {
          o.material = this.waterfallMat;
          o.renderOrder = 2;
        }
      });
      this.glbArchGroup.add(wfClone);
    }

    // 3. Monumental Sculpted 3D Astrolabe Outer Frame
    const outerFrame = byName('Vault_OuterFrame');
    if (outerFrame) {
      const ofClone = cloneSubtreeWithMaterials(outerFrame);
      this._tuneMaterials(ofClone, { calmLancets: false, envScale: 0.74 });
      this.glbArchGroup.add(ofClone);
    }

    // 4. Twin Sculpted Stone-Pedestal Antique-Bronze Braziers (100% clear of waterfalls!)
    const brazierSrc = byName('Vault_Brazier');
    if (brazierSrc) {
      this._brazierEmberMats = [];
      for (const sx of [-2.65, 2.65]) {
        const bClone = cloneSubtreeWithMaterials(brazierSrc);
        this._tuneMaterials(bClone, { calmLancets: false, envScale: 0.72 });
        bClone.position.set(sx, WATER_Y + 0.01, 0.95);
        bClone.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if ((m.name || '').includes('Ember')) this._brazierEmberMats.push(m);
          }
        });
        this.glbArchGroup.add(bClone);
      }
    }

    // 5. Sculpted Gateway 2.0 Stone & Bronze Casting Dais
    const daisSrc = byName('Vault_HeroDais');
    if (daisSrc) {
      const dClone = cloneSubtreeWithMaterials(daisSrc);
      this._tuneMaterials(dClone, { calmLancets: false, envScale: 0.68 });
      this.heroDaisGroup.add(dClone);
      this.fallbackDais.visible = false;
    }

    // 6. 3 Concentric Monumental 3D Beveled Bronze Astrolabe Rings (`Vault_Ring0..2`)
    for (let i = 0; i < 3; i++) {
      const rSrc = byName(`Vault_Ring${i}`);
      if (!rSrc) continue;
      const rg = this.ringObjs[i];
      const rClone = cloneSubtreeWithMaterials(rSrc);
      this._tuneMaterials(rClone, { calmLancets: false, envScale: 0.76 });
      const bronzeMats = [];
      const crystalMats = [];
      rClone.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          const mn = m.name || '';
          if (mn.includes('Aqua') || mn.includes('GoldRune')) {
            crystalMats.push(m);
          } else {
            bronzeMats.push(m);
          }
        }
      });
      rg.add(rClone);
      rg.userData.fallbackRing.visible = false;
      rg.userData.glbRing = rClone;
      rg.userData.bronzeMats = bronzeMats;
      rg.userData.crystalMats = crystalMats;
    }

    // 7. Central Sculpted Faceted Harmonic Core Jewel (`Vault_CoreJewel`)
    const coreSrc = byName('Vault_CoreJewel');
    if (coreSrc) {
      const cClone = cloneSubtreeWithMaterials(coreSrc);
      this._tuneMaterials(cClone, { calmLancets: false, envScale: 0.80 });
      const crystalMats = [];
      cClone.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if ((m.name || '').includes('Aqua') || (m.name || '').includes('GoldRune')) {
            crystalMats.push(m);
          }
        }
      });
      this.centerSeedGroup.add(cClone);
      this.fallbackSeedCore.visible = false;
      this.centerSeedGroup.userData.glbCore = cClone;
      this.centerSeedGroup.userData.crystalMats = crystalMats;
    }

    this.fallbackGroup.visible = false;
    this._glbLoaded = true;
  }

  render(state, opts = {}) {
    if (this._disposed || !this.webgl || !state) return;
    const vault = state.vault || state.sanctumVault;
    if (!vault) return;

    const skin = state.player?.skinId || state.gateway?.skinId || state.skinId || opts?.skinId || this.skinId;
    if (skin && skin !== this.skinId) this.setSkin(skin);

    const time = Number(state.time) || 0;
    const dt = clamp(
      Number(opts?.dt ?? state.dt) || (this._prevTime > 0 ? time - this._prevTime : 0.016),
      0.001,
      0.05
    );
    this._prevTime = time;

    // Shared PMREM Biome IBL (zero-stall reuse from main renderer or one-time lightweight cathedral PMREM)
    const extEnv = opts?.envMap || this.envMap;
    if (extEnv) {
      if (this.scene.environment !== extEnv) {
        this.scene.environment = extEnv;
        this.scene.environmentIntensity = 0.56;
      }
    } else if (!this._envBuilt) {
      this._envBuilt = true;
      this._envRt = buildVaultEnvMap(this.webgl);
      if (this._envRt?.texture) {
        this.scene.environment = this._envRt.texture;
        this.scene.environmentIntensity = 0.62;
      }
    }

    const rings = vault.rings || [];
    const status = vault.status || 'playing';
    const activeIdx = vault.activeRing || 0;

    let activeInSweetSpot = false;
    let lockedCount = 0;
    let lockedMask = 0;

    for (let i = 0; i < 3; i++) {
      if (rings[i]?.locked) {
        lockedMask |= 1 << i;
        if (!(this._prevLockedMask & (1 << i))) {
          this._ringDetentT[i] = time;
          this._lockBurstT = time;
          this._lockBurstRingIdx = i;
          this._heroCastT = time;
        }
      }
    }
    if (lockedMask === 0 && this._prevLockedMask !== 0) {
      this._ringDetentT[0] = -10;
      this._ringDetentT[1] = -10;
      this._ringDetentT[2] = -10;
    }
    this._prevLockedMask = lockedMask;

    const strikesNow = vault.strikes || 0;
    if (strikesNow > this._prevStrikes) {
      this._strikeFlashT = time;
    }
    this._prevStrikes = strikesNow;

    for (let i = 0; i < this.ringObjs.length; i++) {
      const ro = this.ringObjs[i];
      const rState = rings[i];
      if (!rState) continue;
      if (rState.locked) lockedCount++;

      // Tactile mechanical spring detent recoil on newly locked bronze ring
      const detAge = time - this._ringDetentT[i];
      const hasDetent = detAge >= 0 && detAge < 0.65;
      const detentZ = hasDetent ? -Math.sin(detAge * 34) * Math.exp(-detAge * 7.2) * 0.20 : 0;
      const detentTwist = hasDetent ? Math.sin(detAge * 28) * Math.exp(-detAge * 8.5) * 0.08 : 0;
      const detentGlow = hasDetent ? Math.exp(-detAge * 5.2) : 0;

      const delta = wrapAngle((rState.angle || 0) - (rState.targetAngle || 0));
      ro.rotation.z = delta + detentTwist;
      ro.position.z = RING_Z[i] + detentZ;

      const tol = rState.tolerance || (i === 0 ? 0.42 : i === 1 ? 0.38 : 0.35);
      const ud = ro.userData;
      if (Math.abs(tol - ud.builtTol) > 0.005) {
        ud.notchMesh.geometry.dispose();
        ud.notchMesh.geometry = buildNotchArcGeo(ud.rad, 0.132, tol * 2);
        ud.notchMesh.rotation.z = Math.PI * 0.5 - tol;
        ud.builtTol = tol;
      }

      const isActive = i === activeIdx && status === 'playing';
      const inZone = Math.abs(delta) <= tol;
      if (isActive && inZone) activeInSweetSpot = true;

      let bronzeCol = '#d8b068';
      let bronzeEmi = '#2a1806';
      let bronzeEmiInt = 0.12;
      let cryCol = '#34f2e6';
      let cryEmi = '#0891b2';
      let cryEmiInt = 0.85;

      if (status === 'failed') {
        bronzeCol = '#a84e4e';
        bronzeEmi = '#450a0a';
        bronzeEmiInt = 0.26;
        cryCol = '#fb7185';
        cryEmi = '#be123c';
        cryEmiInt = 1.25;
        ud.notchMat.color.set('#e11d48');
        ud.notchMat.emissive.set('#be123c');
        ud.notchMat.emissiveIntensity = 0.78;
        ud.notchMat.opacity = 0.76;
      } else if (rState.locked || status === 'won') {
        bronzeCol = '#f7d682';
        bronzeEmi = '#8c5608';
        bronzeEmiInt = 0.20 + detentGlow * 0.75;
        cryCol = '#5efce8';
        cryEmi = '#10b981';
        cryEmiInt = 1.35 + detentGlow * 1.1;
        ud.notchMat.color.set('#34d399');
        ud.notchMat.emissive.set('#059669');
        ud.notchMat.emissiveIntensity = 0.92 + detentGlow * 1.2;
        ud.notchMat.opacity = 0.82;
      } else if (isActive) {
        bronzeCol = '#f0c878';
        bronzeEmi = '#422808';
        bronzeEmiInt = inZone ? 0.30 : 0.14;
        if (inZone) {
          cryCol = '#80fff6';
          cryEmi = '#06b6d4';
          cryEmiInt = 1.45 + Math.sin(time * 24) * 0.25;
          ud.notchMat.color.set('#5efce8');
          ud.notchMat.emissive.set('#06b6d4');
          ud.notchMat.emissiveIntensity = 1.15 + Math.sin(time * 24) * 0.22;
          ud.notchMat.opacity = 0.86;
        } else {
          cryCol = '#38bdf8';
          cryEmi = '#0284c7';
          cryEmiInt = 0.92;
          ud.notchMat.color.set('#0ea5e9');
          ud.notchMat.emissive.set('#0369a1');
          ud.notchMat.emissiveIntensity = 0.65;
          ud.notchMat.opacity = 0.70;
        }
      } else {
        bronzeCol = '#b89458';
        bronzeEmi = '#1e1204';
        bronzeEmiInt = 0.08;
        cryCol = '#2a8fa8';
        cryEmi = '#0c4a6e';
        cryEmiInt = 0.45;
        ud.notchMat.color.set('#164e63');
        ud.notchMat.emissive.set('#083344');
        ud.notchMat.emissiveIntensity = 0.34;
        ud.notchMat.opacity = 0.56;
      }

      for (const bm of ud.bronzeMats) {
        bm.color?.set(bronzeCol);
        if (bm.emissive) {
          bm.emissive.set(bronzeEmi);
          bm.emissiveIntensity = bronzeEmiInt;
        }
      }
      for (const cm of ud.crystalMats) {
        cm.color?.set(cryCol);
        if (cm.emissive) {
          cm.emissive.set(cryEmi);
          cm.emissiveIntensity = cryEmiInt;
        }
      }
    }

    // Caliper Crystal, Rune Halo & Dynamic Core Light Feedback
    const strikeAge = time - this._strikeFlashT;
    const strikeFlash = strikeAge >= 0 && strikeAge < 0.48 ? Math.exp(-strikeAge * 6.5) : 0;
    const burstAge = time - this._lockBurstT;
    const burstActive = burstAge >= 0 && burstAge < 0.85;
    const calCol =
      status === 'failed' || strikeFlash > 0.25
        ? '#f43f5e'
        : status === 'won'
          ? '#fde047'
          : activeInSweetSpot
            ? '#34d399'
            : '#22d3ee';
    this.caliperGemMat.emissive.set(calCol);
    this.caliperGemMat.emissiveIntensity = activeInSweetSpot ? 1.45 : burstActive ? 1.75 : 0.80;
    this.caliperGem.rotation.y = time * 1.4;
    this.caliperGemHalo.material.color.set(calCol);
    this.caliperGemHalo.scale.setScalar(
      activeInSweetSpot || status === 'won' || burstActive ? 1.35 + Math.sin(time * 16) * 0.14 : 0.94
    );

    const pressure = status === 'won' ? 1 : lockedCount / 3;
    this.runeRingMesh.rotation.z = -time * (0.08 + pressure * 0.24);
    this.runeRingMat.opacity = 0.30 + pressure * 0.30 + Math.sin(time * 3.2) * 0.05;
    this.runeRingMat.color.set(
      status === 'failed' || strikeFlash > 0.25 ? '#fb7185' : status === 'won' ? '#fde047' : '#5efce8'
    );
    this.coreLight.color.set(
      status === 'failed' || strikeFlash > 0.25 ? '#f43f5e' : status === 'won' ? '#fde047' : '#5efce8'
    );
    this.coreLight.intensity = 1.9 + pressure * 1.1 + (burstActive ? (1 - burstAge / 0.85) * 1.8 : 0);

    // Animate GLSL Water Basin + GLSL Volumetric Foaming Waterfalls + Splash Mist + Oculus Sunbeams + Hydro Ribbons
    this.waterMat.uniforms.uTime.value = time;
    this.waterMat.uniforms.uPulseBoost.value = pressure * 0.7 + (burstActive ? (1 - burstAge / 0.85) * 0.8 : 0);
    this.waterfallMat.uniforms.uTime.value = time;
    this.hydroRibbonTex.offset.x = (-time * 1.65) % 1;
    this.sunbeamMat.opacity = (status === 'won' ? 0.25 : 0.19) + Math.sin(time * 0.85) * 0.028;
    if (this.wfSplashMists) {
      for (let i = 0; i < this.wfSplashMists.length; i++) {
        const sm = this.wfSplashMists[i];
        const pM = 1.0 + Math.sin(time * 5.2 + i * 2.1) * 0.10;
        sm.mesh.scale.set(pM, 0.92 + Math.cos(time * 4.4 + i) * 0.12, 1);
      }
    }

    // Central Sculpted Harmonic Core Jewel Gimbal Spin
    const spinBoost = status === 'won' ? 2.8 : 1 + pressure * 1.1;
    this.centerSeedGroup.rotation.set(
      Math.sin(time * 0.9 * spinBoost) * 0.18,
      time * 0.95 * spinBoost,
      time * 0.42 * spinBoost
    );
    const coreScale = status === 'won' ? 1.24 + Math.sin(time * 9) * 0.06 : 1.0 + pressure * 0.10;
    this.centerSeedGroup.scale.setScalar(coreScale);
    const coreC = status === 'failed' ? '#f43f5e' : status === 'won' ? '#fde047' : '#22e8dc';
    for (const cm of this.centerSeedGroup.userData.crystalMats || []) {
      cm.emissive?.set(coreC);
    }
    this.seedHalo.material.color.set(status === 'failed' ? '#fb7185' : status === 'won' ? '#fef08a' : '#5efce8');

    // Flickering Antique-Bronze Chamber Braziers
    if (this._brazierEmberMats) {
      const emI = 1.55 + Math.sin(time * 11.2) * 0.25;
      for (const em of this._brazierEmberMats) em.emissiveIntensity = emI;
    }
    for (let i = 0; i < this.brazierFlames.length; i++) {
      const bf = this.brazierFlames[i];
      const fA = Math.sin(time * 9.5 + i * 2.4) * 0.12 + Math.cos(time * 14.7 + i) * 0.06;
      const fB = Math.sin(time * 13.1 + i * 3.1) * 0.14;
      bf.fOut.position.set(bf.sx + Math.sin(time * 6.0 + i) * 0.025, WATER_Y + 1.44 + fA * 0.12, 0.95);
      bf.fOut.scale.set(0.94 + fB * 0.26, 1.0 + fA * 0.52, 1);
      bf.fIn.position.set(bf.sx - Math.sin(time * 7.5 + i) * 0.018, WATER_Y + 1.36 + fB * 0.09, 0.98);
      bf.fIn.scale.set(0.86 - fA * 0.20, 0.96 + fB * 0.42, 1);
    }

    // Strike Gems (`maxStrikes` remaining indicator)
    const maxS = Math.min(MAX_STRIKE_GEMS, vault.maxStrikes || 3);
    for (let i = 0; i < MAX_STRIKE_GEMS; i++) {
      const slot = this.strikeGems[i];
      if (i >= maxS) {
        slot.visible = false;
        continue;
      }
      slot.visible = true;
      slot.position.x = (i - (maxS - 1) * 0.5) * 0.46;
      slot.userData.gem.rotation.y = time * 2.0 + i;
      const used = i < strikesNow;
      slot.userData.mat.color.set(used ? '#e11d48' : '#22d3ee');
      slot.userData.mat.emissive.set(used ? '#9f1239' : '#0284c7');
    }

    // Aspect-Safe 3/4 Cathedral Framing showcasing Vaulted Bronze-Ribbed Dome, Oculus Sunbeams, Astrolabe Lock, Water Basin & Gateway 2.0!
    const aspect = this.width / Math.max(1, this.height);
    const portrait = aspect < 0.85;
    const halfFovTan = Math.tan(this.camera.fov * 0.5 * (Math.PI / 180));
    const needHalfW = 2.95 / 0.72;
    const portraitZ = needHalfW / Math.max(0.28, halfFovTan * aspect);
    const baseZ = portrait ? clamp(portraitZ, 10.6, 12.2) : aspect < 1.15 ? 9.15 : 8.78;
    const pushZ = baseZ - pressure * 0.40 - (status === 'won' ? 0.24 : 0);
    const sh = (Number(state.shake) || 0) * 0.02 + strikeFlash * 0.08;
    const sx = sh > 0.001 ? Math.sin(time * 73) * sh : 0;
    const sy = sh > 0.001 ? Math.cos(time * 61) * sh : 0;
    const camOffX = portrait ? -0.22 : -0.40;
    const camOffY = portrait ? -0.32 : -0.16;
    this.camera.position.set(camOffX + Math.sin(time * 0.35) * 0.14 + sx, camOffY + sy, pushZ);
    this.camera.lookAt(portrait ? -0.10 : -0.20, portrait ? -0.26 : 0.26, -0.15);

    // Position & Animate Gateway 2.0 on `Vault_HeroDais` + Sync GLSL Water Dais Shoreline Foam
    const daisX = portrait ? -1.16 : -2.88;
    const daisY = portrait ? WATER_Y - 0.08 : WATER_Y + 0.18;
    const daisZ = portrait ? 2.25 : 2.15;
    const heroSc = portrait ? 1.30 : 1.44;
    this.heroDaisGroup.position.set(daisX, daisY, daisZ);
    this.waterMat.uniforms.uDaisPos.value.set(daisX, daisZ);
    this.hero.group.scale.setScalar(heroSc);
    this.hero.group.rotation.y = portrait ? 2.58 : 2.38;

    const castAge = time - this._heroCastT;
    const isCastingLock = castAge >= 0 && castAge < 0.72;
    const targetRingR = RING_RADII[clamp(activeIdx, 0, 2)] || 1.64;
    const aimY = status === 'won' ? 0.05 : targetRingR * 0.85;
    this._lookVec.set(0, aimY, 0.35);
    const heroAnim =
      status === 'won'
        ? 'HeroCelebrate'
        : isCastingLock || activeInSweetSpot
          ? 'HydroCast'
          : 'IdleCurious';
    const heroMood =
      status === 'failed' || strikeFlash > 0.2
        ? 'surprised'
        : status === 'won' || isCastingLock
          ? 'joyful'
          : activeInSweetSpot
            ? 'determined'
            : 'curious';
    this.hero.update(dt, {
      time,
      vx: 0,
      vy: 0,
      onGround: true,
      anim: heroAnim,
      mood: heroMood,
      lookTarget: this._lookVec,
      victory: status === 'won',
      castHydro: isCastingLock || activeInSweetSpot || status === 'won',
    });

    // Dual Glowing Aquamarine Hydro-Channel Ribbons curving from Gateway's raised paws into the Astrolabe!
    const showRibbons = status !== 'failed';
    this.hydroArcL.visible = showRibbons;
    this.hydroArcR.visible = showRibbons;
    if (showRibbons) {
      const pawBaseX = daisX + 0.24 * heroSc;
      const pawBaseY = daisY + 0.16 + (isCastingLock || status === 'won' ? 0.92 : 0.76) * heroSc;
      const pawBaseZ = daisZ - 0.18 * heroSc;
      const endY = status === 'won' ? 0.05 : activeInSweetSpot || isCastingLock ? 2.48 : targetRingR * 0.72;
      const endX = status === 'won' ? 0 : -0.18;
      const ribbonW = isCastingLock || status === 'won' ? 0.13 : activeInSweetSpot ? 0.11 : 0.068;
      this._updateVaultHydroRibbon(this.hydroRibbonGeoL, pawBaseX - 0.14, pawBaseY, pawBaseZ, endX - 0.16, endY, 0.34, ribbonW, time, 0);
      this._updateVaultHydroRibbon(this.hydroRibbonGeoR, pawBaseX + 0.16, pawBaseY + 0.06, pawBaseZ - 0.08, endX + 0.18, endY - 0.12, 0.34, ribbonW, time, 2.2);
      this.hydroRibbonMat.color.set(
        status === 'won' || isCastingLock ? '#fde047' : activeInSweetSpot ? '#34d399' : '#5efce8'
      );
      this.hydroRibbonMat.opacity = isCastingLock || status === 'won' ? 0.90 : activeInSweetSpot ? 0.82 : 0.56;
    }

    // Lock Shockwave Ring & Radial Burst Sparkles
    const dm = this._dummy;
    const camQ = this.camera.quaternion;
    if (burstActive) {
      const bt = burstAge / 0.85;
      const easeOut = 1 - Math.pow(1 - bt, 2.4);
      const bRad = RING_RADII[clamp(this._lockBurstRingIdx, 0, 2)] || 1.64;
      this.lockWaveMesh.visible = true;
      this.lockWaveMesh.scale.setScalar((bRad / 2.2) * (0.72 + easeOut * 1.15));
      this.lockWaveMesh.rotation.z = time * 1.4;
      this.lockWaveMat.opacity = (1 - bt) * (1 - bt) * 0.92;
      this.lockWaveMat.color.set(status === 'won' ? '#fde047' : '#5efce8');

      for (let i = 0; i < MAX_LOCK_BURST; i++) {
        const ang = (i / MAX_LOCK_BURST) * TAU + (i % 3) * 0.14;
        const speed = 1.15 + (i % 5) * 0.34;
        const fromCaliper = i < 10;
        const bx = fromCaliper
          ? Math.cos(ang) * easeOut * 1.45 * speed
          : Math.cos(ang) * (bRad + easeOut * 1.15 * speed);
        const by = fromCaliper
          ? 2.58 + Math.sin(ang) * easeOut * 1.25 * speed
          : Math.sin(ang) * (bRad + easeOut * 1.15 * speed);
        const bz = 0.45 + Math.sin(bt * Math.PI) * 0.65;
        const sc = (1 - bt) * (0.75 + (i % 3) * 0.35);
        dm.position.set(bx, by, bz);
        dm.quaternion.copy(camQ);
        dm.scale.setScalar(Math.max(0.01, sc));
        dm.updateMatrix();
        this.lockBurstInst.setMatrixAt(i, dm.matrix);
      }
      this.lockBurstInst.count = MAX_LOCK_BURST;
      this.lockBurstInst.instanceMatrix.needsUpdate = true;
    } else {
      this.lockWaveMesh.visible = false;
      this.lockBurstInst.count = 0;
    }

    // Floating Golden Sunlit Dust & Aqua Mist Motes
    for (let i = 0; i < MAX_MOTES; i++) {
      const mx = Math.sin(i * 2.3 + time * 0.38) * 3.8;
      const my = WATER_Y + 0.25 + ((i * 0.19 + time * 0.48) % 6.6);
      const mz = Math.cos(i * 1.9 + time * 0.32) * 1.9 + 0.65;
      dm.position.set(mx, my, mz);
      dm.quaternion.copy(camQ);
      dm.scale.setScalar(0.64 + Math.sin(time * 3.6 + i) * 0.26);
      dm.updateMatrix();
      this.moteInst.setMatrixAt(i, dm.matrix);
    }
    this.moteInst.count = MAX_MOTES;
    this.moteInst.instanceMatrix.needsUpdate = true;

    // Shared CinematicPostFX Routing (with crisp ACES Filmic standalone fallback)
    const postfx = opts?.postfx || null;
    const biomeKey = opts?.biomeKey || opts?.biome || state.biomeKey || 'coral';
    if (postfx && postfx.enabled && !postfx._disposed && typeof postfx.render === 'function') {
      this.postfxActive = true;
      postfx.render(this.scene, this.camera, {
        biome: biomeKey,
        exposure: status === 'won' ? 1.06 : 0.98,
        bloomStrength: status === 'won' ? 0.44 : burstActive ? 0.40 : 0.26,
        bloomThreshold: 0.88,
        flash: burstActive ? Math.max(0, (1 - burstAge / 0.28) * 0.14) : 0,
      });
    } else {
      this.postfxActive = false;
      this.webgl.setRenderTarget(null);
      const prevTM = this.webgl.toneMapping;
      const prevExp = this.webgl.toneMappingExposure;
      this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
      this.webgl.toneMappingExposure = status === 'won' ? 1.04 : 0.96;
      this.webgl.render(this.scene, this.camera);
      this.webgl.toneMapping = prevTM;
      this.webgl.toneMappingExposure = prevExp;
    }
  }

  _updateVaultHydroRibbon(geo, sx, sy, sz, ex, ey, ez, halfW, time, phase) {
    const segs = geo.userData.segs || 18;
    const pos = geo.attributes.position;
    for (let i = 0; i <= segs; i++) {
      const s = i / segs;
      const arch = Math.sin(s * Math.PI);
      const wave = Math.sin(s * TAU * 1.6 - time * 8.5 + phase) * 0.14 * arch;
      const px = lerp(sx, ex, s) + wave * 0.7;
      const py = lerp(sy, ey, s) + arch * 0.65 + Math.cos(s * TAU * 1.3 - time * 7.2 + phase) * 0.10 * arch;
      const pz = lerp(sz, ez, s) + arch * 0.45;
      const w = halfW * (0.35 + arch * 0.85);
      pos.setXYZ(i * 2, px - w * 0.55, py + w * 0.85, pz);
      pos.setXYZ(i * 2 + 1, px + w * 0.55, py - w * 0.85, pz);
    }
    pos.needsUpdate = true;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.hero?.dispose?.();
    this._envRt?.dispose();
    this._envRt = null;
    this.hydroRibbonGeoL?.dispose();
    this.hydroRibbonGeoR?.dispose();
    this.waterNormalTex?.dispose();
    this.sunbeamTex?.dispose();
    this.flameTex?.dispose();
    this.hydroRibbonTex?.dispose();
    this.runeRingTex?.dispose();
    this.moteGlowTex?.dispose();
    this._heroAoTex?.dispose();
    for (const t of this._loadedTextures) t.dispose();
    this._loadedTextures.length = 0;
  }
}

export { VaultRenderer as SanctumVaultRenderer };
export default VaultRenderer;
