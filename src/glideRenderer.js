// TOWER TOPPLER '26 — THE GLIDE 3D SCENE RENDERER (src/glideRenderer.js)
//
// Shares `GameRenderer.webgl` with strict WebGL state save/restore (`setRenderTarget(null)`,
// `autoClear`, `toneMapping`, `toneMappingExposure`) so `EffectComposer` + `UnrealBloomPass`
// never suffers state leaks across mode transitions.
//
// Next-Gen 2026 Upgrades:
// 1. `'moonlit_storm'` signature Reboot sky theme matching `media_1794856383556_f193848e.jpg`:
//    veiled silver-blue full storm moon, volumetric silver-cyan moonbeams, towering 3D basalt
//    sea-stack rock arches, glowing slipstream wind-tunnel rings, dark indigo-slate clouds with
//    silver rim-light, cyan/emerald bioluminescent updraft thermals + fireflies, and dark storm sea.
// 2. Real 33-bone `PogoRig` Explorer Pogo V2 (`./pogo.js`) suspended beneath the Da-Vinci /
//    Steampunk Sky-Wing (`assets/models/sky_glider.glb` with Frame-0 procedural Sky-Wing fallback),
//    gripping `grip_bar` with twin Cryo-Boost Jets and all 8 `POGO_SKINS` palettes.
// 3. Zero emojis; compact centered flight progress HUD positioned cleanly below `#hud`.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PogoRig, POGO_SKINS } from './pogo.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 50;
const CAM_Z = 16;
const PITCH = 9 * DEG;
const TOWER_Z = -6.5;
const TOWER_FAR_Z = -300;
const SKY_Z = -400;
const HUD_TOP_OFFSET = 98;
const POGO_GLIDE_SCALE = 1.48;

const MAX_LANTERN = 72;
const MAX_KITE = 8;
const MAX_GATE = 8;
const MAX_WIND_TUNNEL = 28;
const MAX_MOONBEAMS = 7;
const MAX_LIGHTHOUSE_BEAMS = 8;
const MAX_ARCH_FOAM = 28;
const VORTEX_SEGS = 22;
const MAX_HORIZON_MIST = 28;
const MAX_THERMAL = 8;
const MAX_STORM = 8;
const MAX_STORM_PUFF = MAX_STORM * 4;
const MAX_GULL = 96;
const MAX_CLOUD = 72;
const MAX_FGCLOUD = 6;
const MAX_STREAK = 70;
const MAX_GLOW = 360;
const MAX_STAR = 140;
const MAX_SHADE = 24;
const MAX_RING = 24;
const MAX_PART = 600;
const MAX_PUFF = 340;
const MAX_POP = 18;
const MAX_BOLT_SEG = 120;
const MAX_PRECIP = 520;
const MAX_WARN = 4;

const STORM_PUFFS = [0, -0.02, 1.15, 0, -0.44, 0.03, 0.88, 1, 0.46, 0.02, 0.92, 2, 0.04, 0.16, 0.96, 3];
const SKIN_MAP = new Map(POGO_SKINS.map((s) => [s.id, s]));

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

// ---------------------------------------------------------------------------------- sky themes
const THEMES = {
  moonlit_storm: {
    top: '#030611',
    mid: '#0b162b',
    hor: '#152640',
    haze: '#112138',
    sun: '#d8e9ff',
    sunDir: [0.128, 0.295, -1],
    sunSize: 0.039,
    stars: 0.76,
    moon: 1,
    moonFull: 1,
    aurora: 0.0,
    rays: 0.32,
    cirrus: 0.38,
    rainbow: 0,
    cloudLit: '#6886b2',
    cloudShade: '#0d1526',
    cloudRim: '#dcecff',
    sea: '#040a14',
    seaFar: '#0d1e34',
    glint: 0.88,
    chop: 1.0,
    foam: 0.52,
    isle: '#182334',
    isleFar: '#22334c',
    hemiSky: '#7d98bc',
    hemiGround: '#070e1b',
    light: '#dceaff',
    lightI: 2.15,
    exposure: 1.02,
    precip: 'fireflies',
    precipColor: '#5efce8',
    thermalColor: '#4ff0d2',
    lanternK: 1.85,
    birds: 0.55,
    wind: 0.72,
  },
  aurora: {
    top: '#040a18',
    mid: '#0b2138',
    hor: '#1b435c',
    haze: '#16374e',
    sun: '#d8f3ff',
    sunDir: [0.115, 0.28, -1],
    sunSize: 0.035,
    stars: 0.9,
    moon: 1,
    moonFull: 1,
    aurora: 1.0,
    rays: 0.24,
    cirrus: 0.3,
    rainbow: 0,
    cloudLit: '#79a8c4',
    cloudShade: '#13243b',
    cloudRim: '#a5f3fc',
    sea: '#040c18',
    seaFar: '#10293e',
    glint: 0.85,
    chop: 0.88,
    foam: 0.42,
    isle: '#1b2e3d',
    isleFar: '#2b4a5e',
    hemiSky: '#7dd3fc',
    hemiGround: '#0b1b2b',
    light: '#bae6fd',
    lightI: 1.85,
    exposure: 1.02,
    precip: 'snow',
    precipColor: '#e0f2fe',
    thermalColor: '#42f5aa',
    lanternK: 1.75,
    birds: 0.45,
    wind: 0.85,
  },
  dawn: {
    top: '#2c4a96',
    mid: '#d98a9a',
    hor: '#ffc98f',
    haze: '#f0b993',
    sun: '#ffc27a',
    sunDir: [-0.14, 0.09, -1],
    sunSize: 0.05,
    stars: 0.0,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.55,
    cirrus: 0.6,
    rainbow: 0,
    cloudLit: '#fff1de',
    cloudShade: '#b48aa3',
    cloudRim: '#ffd59a',
    sea: '#24507e',
    seaFar: '#7d8fb4',
    glint: 1.1,
    chop: 0.6,
    foam: 0.15,
    isle: '#3d5d4a',
    isleFar: '#8f8fa8',
    hemiSky: '#ffd9c0',
    hemiGround: '#2a3f5f',
    light: '#ffd7a8',
    lightI: 2.3,
    exposure: 1.02,
    precip: 'none',
    thermalColor: '#ffcf7a',
    lanternK: 1.0,
    birds: 1,
    wind: 0.5,
  },
  day: {
    top: '#1d5fcf',
    mid: '#4f97e6',
    hor: '#bfe2ff',
    haze: '#b9dcf5',
    sun: '#fff3d6',
    sunDir: [-0.1, 0.36, -1],
    sunSize: 0.04,
    stars: 0,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.35,
    cirrus: 0.8,
    rainbow: 0,
    cloudLit: '#ffffff',
    cloudShade: '#93acd0',
    cloudRim: '#ffffff',
    sea: '#0f4f86',
    seaFar: '#4f97c8',
    glint: 1.2,
    chop: 0.7,
    foam: 0.2,
    isle: '#3f7a4c',
    isleFar: '#8fb0c6',
    hemiSky: '#dff1ff',
    hemiGround: '#2d5a7a',
    light: '#fff6e4',
    lightI: 2.5,
    exposure: 0.98,
    precip: 'none',
    thermalColor: '#ffcf7a',
    lanternK: 0.85,
    birds: 1,
    wind: 0.6,
  },
  snow: {
    top: '#4e6b92',
    mid: '#87a3c2',
    hor: '#dbe6f2',
    haze: '#cfdce9',
    sun: '#f4f8ff',
    sunDir: [-0.05, 0.24, -1],
    sunSize: 0.045,
    stars: 0,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.25,
    cirrus: 0.3,
    rainbow: 0,
    cloudLit: '#f7fbff',
    cloudShade: '#889bb5',
    cloudRim: '#ffffff',
    sea: '#2f506c',
    seaFar: '#a8bccf',
    glint: 0.8,
    chop: 0.75,
    foam: 0.35,
    isle: '#e8eef4',
    isleFar: '#b8c6d6',
    hemiSky: '#eaf2ff',
    hemiGround: '#5b6f86',
    light: '#f2f6ff',
    lightI: 2.0,
    exposure: 1.0,
    precip: 'snow',
    precipColor: '#ffffff',
    thermalColor: '#7be8ff',
    lanternK: 1.05,
    birds: 0.6,
    wind: 0.8,
  },
  sunset: {
    top: '#2c2366',
    mid: '#d4567e',
    hor: '#ffb066',
    haze: '#f59a6a',
    sun: '#ffb45c',
    sunDir: [-0.12, 0.045, -1],
    sunSize: 0.07,
    stars: 0.15,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.7,
    cirrus: 0.7,
    rainbow: 0,
    cloudLit: '#ffc59a',
    cloudShade: '#7a3f6e',
    cloudRim: '#ffd37a',
    sea: '#3b2f6a',
    seaFar: '#d98c86',
    glint: 1.5,
    chop: 0.6,
    foam: 0.15,
    isle: '#3a2a4a',
    isleFar: '#9a6f8f',
    hemiSky: '#ffb592',
    hemiGround: '#3a2552',
    light: '#ffb070',
    lightI: 2.2,
    exposure: 1.02,
    precip: 'none',
    thermalColor: '#ffcf7a',
    lanternK: 1.4,
    birds: 1,
    wind: 0.5,
  },
  night: {
    top: '#040921',
    mid: '#0f1d48',
    hor: '#2b3f78',
    haze: '#26386a',
    sun: '#dfe8ff',
    sunDir: [-0.1, 0.3, -1],
    sunSize: 0.05,
    stars: 1.0,
    moon: 1,
    moonFull: 0,
    aurora: 0,
    rays: 0.15,
    cirrus: 0.35,
    rainbow: 0,
    cloudLit: '#7d8fc4',
    cloudShade: '#1a2246',
    cloudRim: '#c9d6ff',
    sea: '#050d22',
    seaFar: '#1d2c58',
    glint: 0.65,
    chop: 0.6,
    foam: 0.12,
    isle: '#0f1730',
    isleFar: '#26355f',
    hemiSky: '#6f84c8',
    hemiGround: '#0b1028',
    light: '#c9d6ff',
    lightI: 1.15,
    exposure: 1.06,
    precip: 'fireflies',
    precipColor: '#5efce8',
    thermalColor: '#ffb24a',
    lanternK: 2.1,
    birds: 0,
    wind: 0.45,
  },
  rain: {
    top: '#4c76a8',
    mid: '#9fbbd2',
    hor: '#e8efe6',
    haze: '#dbe5df',
    sun: '#fff1cf',
    sunDir: [-0.1, 0.16, -1],
    sunSize: 0.045,
    stars: 0,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.6,
    cirrus: 0.4,
    rainbow: 1,
    cloudLit: '#ffffff',
    cloudShade: '#8496ad',
    cloudRim: '#fff6dc',
    sea: '#2f6a86',
    seaFar: '#b6cdd2',
    glint: 1.3,
    chop: 0.65,
    foam: 0.22,
    isle: '#3b7a4f',
    isleFar: '#93adb4',
    hemiSky: '#e6f3ff',
    hemiGround: '#3a5a6a',
    light: '#fff3d6',
    lightI: 2.3,
    exposure: 0.99,
    precip: 'drizzle',
    precipColor: '#c3d2ec',
    thermalColor: '#ffcf7a',
    lanternK: 0.95,
    birds: 1,
    wind: 0.6,
  },
  gale: {
    top: '#3a6fbe',
    mid: '#8bb3dc',
    hor: '#f4dfb4',
    haze: '#ecd8b0',
    sun: '#ffe0a0',
    sunDir: [-0.1, 0.2, -1],
    sunSize: 0.05,
    stars: 0,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.5,
    cirrus: 1.0,
    rainbow: 0,
    cloudLit: '#fff4e0',
    cloudShade: '#a49aa6',
    cloudRim: '#ffe6b0',
    sea: '#2a5f8c',
    seaFar: '#c9c3ad',
    glint: 1.35,
    chop: 1.0,
    foam: 0.45,
    isle: '#7d8a4a',
    isleFar: '#b0a68c',
    hemiSky: '#ffeccc',
    hemiGround: '#40506a',
    light: '#ffe4b0',
    lightI: 2.4,
    exposure: 1.0,
    precip: 'leaves',
    thermalColor: '#ffcf7a',
    lanternK: 1.0,
    birds: 1,
    wind: 1.0,
  },
  storm: {
    top: '#090f1d',
    mid: '#182438',
    hor: '#334663',
    haze: '#283850',
    sun: '#9eb8db',
    sunDir: [0.115, 0.27, -1],
    sunSize: 0.036,
    disc: 0.65,
    stars: 0.25,
    moon: 1,
    moonFull: 1,
    aurora: 0,
    rays: 0.14,
    cirrus: 0.15,
    rainbow: 0,
    cloudLit: '#7084a3',
    cloudShade: '#161e2e',
    cloudRim: '#bfd6f2',
    sea: '#050c16',
    seaFar: '#16263a',
    glint: 0.55,
    chop: 1.12,
    foam: 0.55,
    isle: '#151e2c',
    isleFar: '#2c3b50',
    hemiSky: '#7d92b3',
    hemiGround: '#111a28',
    light: '#b8cceb',
    lightI: 1.75,
    exposure: 1.06,
    precip: 'rain',
    precipColor: '#c3d2ec',
    thermalColor: '#5efce8',
    lanternK: 1.75,
    birds: 0,
    wind: 0.95,
  },
  ember: {
    top: '#18081e',
    mid: '#5a1632',
    hor: '#f26a32',
    haze: '#b84236',
    sun: '#ff6a2a',
    sunDir: [-0.08, 0.04, -1],
    sunSize: 0.075,
    stars: 0.35,
    moon: 0,
    moonFull: 0,
    aurora: 0,
    rays: 0.6,
    cirrus: 0.5,
    rainbow: 0,
    cloudLit: '#ff9a6a',
    cloudShade: '#32112a',
    cloudRim: '#ffb05a',
    sea: '#1f0b1b',
    seaFar: '#993c35',
    glint: 1.45,
    chop: 0.72,
    foam: 0.16,
    isle: '#1a0d14',
    isleFar: '#6a2a2e',
    hemiSky: '#ff9c6e',
    hemiGround: '#2a0e1c',
    light: '#ff8a50',
    lightI: 1.75,
    exposure: 1.04,
    precip: 'embers',
    precipColor: '#ff8a3d',
    thermalColor: '#ffaa33',
    lanternK: 1.55,
    birds: 0.3,
    wind: 0.65,
  },
};

const LANTERN_HEX = ['#ff8f3a', '#ffcf3f', '#ff5d5d', '#ff74c8'];
const KITE_HEX = ['#ff5fa2', '#45dcff', '#8bff5a', '#ffd23f'];
const GOLD_HEX = '#ffc928';

// ---------------------------------------------------------------------------------- GLSL bits
const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm3(vec2 p){ return vnoise(p) * 0.55 + vnoise(p * 2.03 + 1.7) * 0.3 + vnoise(p * 4.1 + 3.3) * 0.15; }
`;
const GLSL_OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

// ---------------------------------------------------------------------------------- helpers
function paint(geo, fn) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const c = [1, 1, 1];
  for (let i = 0; i < n; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), c, i);
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function solid(geo, r, g, b) {
  return paint(geo, (x, y, z, c) => {
    c[0] = r;
    c[1] = g;
    c[2] = b;
  });
}
function solidC(geo, color, k = 1) {
  return solid(geo, color.r * k, color.g * k, color.b * k);
}
const STD_ATTRS = ['position', 'normal', 'color', 'uv'];
function merge(list) {
  const prepared = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) {
      if (!STD_ATTRS.includes(name)) ng.deleteAttribute(name);
    }
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    }
    if (!ng.attributes.color) solid(ng, 1, 1, 1);
    return ng;
  });
  return mergeGeometries(prepared, false);
}
function place(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}
function tube(a, b, r0, r1 = r0, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

function canvasTex(w, h, draw, { srgb = true, repeat = false, mip = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  if (!mip) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  t.needsUpdate = true;
  return t;
}

function makeSoftDot() {
  return canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

function makeStarTex() {
  return canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 14);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(32, 32);
      ctx.rotate((k * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -31);
      ctx.quadraticCurveTo(2.2, -4, 0, 0);
      ctx.quadraticCurveTo(-2.2, -4, 0, -31);
      ctx.fill();
      ctx.restore();
    }
  });
}

function instanced(geo, mat, count, { color = true, glow = false, anim = false } = {}) {
  if (glow) geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  if (anim) geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (color) {
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < count; i++) m.setColorAt(i, c);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  m.count = 0;
  return m;
}

function putMat(arr, i, x, y, z, sx, sy, sz = 1, rz = 0) {
  const o = i * 16;
  const c = Math.cos(rz);
  const s = Math.sin(rz);
  arr[o] = c * sx;
  arr[o + 1] = s * sx;
  arr[o + 2] = 0;
  arr[o + 3] = 0;
  arr[o + 4] = -s * sy;
  arr[o + 5] = c * sy;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = 0;
  arr[o + 9] = 0;
  arr[o + 10] = sz;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

function patchStd(mat, U, opts = {}) {
  const { rim = null, selfLit = null, backLit = null, flap = false, key = 'std' } = opts;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    if (rim) {
      shader.uniforms.uRimColor = rim.color;
      shader.uniforms.uRimStr = rim.str;
    }
    if (selfLit) shader.uniforms.uSelfLit = selfLit;
    if (backLit) {
      shader.uniforms.uBackLit = backLit.str;
      shader.uniforms.uBackCol = backLit.color;
    }
    let head = 'uniform float uTime;\n';
    if (flap) head += 'attribute vec3 aAnim;\n';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`);
    if (flap) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float az = abs(position.z);
          float ph = aAnim.x;
          float sh = sin(ph) * 0.85 * aAnim.z;
          float el = sin(ph - 0.9) * 0.7 * aAnim.z;
          float k1 = max(az - 0.1, 0.0);
          float k2 = max(az - 0.55, 0.0);
          transformed.y += sh * k1 + el * k2;
          transformed.z *= 1.0 - 0.12 * abs(sin(ph)) * aAnim.z * step(0.1, az);
          transformed.x += k2 * 0.12 * (1.0 + cos(ph));
        }`
      );
    }
    let fhead = '';
    if (rim) fhead += 'uniform vec3 uRimColor;\nuniform float uRimStr;\n';
    if (selfLit) fhead += 'uniform float uSelfLit;\n';
    if (backLit) fhead += 'uniform float uBackLit;\nuniform vec3 uBackCol;\n';
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fhead}`);
    let ef = '#include <emissivemap_fragment>\n';
    if (selfLit) ef += 'totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;\n';
    if (backLit) {
      ef +=
        'if (!gl_FrontFacing) totalEmissiveRadiance += diffuseColor.rgb * uBackCol * uBackLit;\nelse totalEmissiveRadiance += diffuseColor.rgb * uBackCol * uBackLit * 0.35;\n';
    }
    if (rim) {
      ef += `
        float rimF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        totalEmissiveRadiance += uRimColor * (rimF * rimF * rimF) * uRimStr;
      `;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', ef);
  };
  const k = `${rim ? 1 : 0}${selfLit ? 1 : 0}${backLit ? 1 : 0}${flap ? 1 : 0}`;
  mat.customProgramCacheKey = () => `glide_${key}_${k}`;
  return mat;
}

// ---------------------------------------------------------------------------------- periodic FBM / Worley / Sobel PBR generators
function hash2Periodic(ix, iy, period, seed) {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function periodicValueNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = hash2Periodic(ix, iy, period, seed);
  const b = hash2Periodic(ix + 1, iy, period, seed);
  const c = hash2Periodic(ix, iy + 1, period, seed);
  const d = hash2Periodic(ix + 1, iy + 1, period, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function periodicWorley(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let minDist = 4.0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const px = cx + hash2Periodic(cx, cy, period, seed);
      const py = cy + hash2Periodic(cx, cy, period, seed + 97);
      const ddx = px - x;
      const ddy = py - y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < minDist) minDist = d2;
    }
  }
  return Math.min(1, Math.sqrt(minDist));
}

function createTileableStormNoiseTex(size = 256) {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const m =
        periodicValueNoise(u, v, 4, 11) * 0.52 +
        periodicValueNoise(u, v, 8, 23) * 0.26 +
        periodicValueNoise(u, v, 16, 37) * 0.14 +
        periodicValueNoise(u, v, 32, 53) * 0.08;
      const s1 = 2 * periodicValueNoise(u, v, 6, 71) - 1;
      const s2 = 2 * periodicValueNoise(u, v, 12, 89) - 1;
      const s3 = 2 * periodicValueNoise(u, v, 24, 103) - 1;
      const s4 = 2 * periodicValueNoise(u, v, 48, 127) - 1;
      // Smooth C-infinity rounded billows (zero |x| derivative kink / horizontal crease lines!)
      const b1 = 1 - Math.sqrt(s1 * s1 + 0.045) * 0.978;
      const b2 = 1 - Math.sqrt(s2 * s2 + 0.045) * 0.978;
      const b3 = 1 - Math.sqrt(s3 * s3 + 0.045) * 0.978;
      const b4 = 1 - Math.sqrt(s4 * s4 + 0.045) * 0.978;
      const billow = b1 * 0.48 + b2 * 0.28 + b3 * 0.16 + b4 * 0.08;
      const det =
        periodicValueNoise(u, v, 12, 149) * 0.46 +
        periodicValueNoise(u, v, 24, 173) * 0.28 +
        periodicValueNoise(u, v, 48, 199) * 0.17 +
        periodicValueNoise(u, v, 96, 223) * 0.09;
      const cell = clamp(
        (1 - periodicWorley(u, v, 8, 251)) * 0.62 + (1 - periodicWorley(u, v, 18, 283)) * 0.38,
        0,
        1
      );
      const i4 = (y * size + x) * 4;
      d[i4] = Math.round(clamp(m, 0, 1) * 255);
      d[i4 + 1] = Math.round(clamp(billow, 0, 1) * 255);
      d[i4 + 2] = Math.round(clamp(det, 0, 1) * 255);
      d[i4 + 3] = Math.round(cell * 255);
    }
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// Fast arbitrary-period value noise for crisp 1024x512 cumulonimbus panorama & 512x512 lunar relief
function fastLatticeNoise(u, v, pU, pV, seed) {
  const x = u * pU;
  const y = v * pV;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Quintic C2 smoothstep (zero grid creases!)
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fx === -999 ? 0 : fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = ((ix % pU) + pU) % pU;
  const x1 = (x0 + 1) % pU;
  const y0 = ((iy % pV) + pV) % pV;
  const y1 = (y0 + 1) % pV;
  const h = (px, py) => {
    let n = (Math.imul(px, 374761393) + Math.imul(py, 668265263) + Math.imul(seed, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const a = h(x0, y0);
  const b = h(x1, y0);
  const c = h(x0, y1);
  const d = h(x1, y1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// Crisp 1024x512 Ridged/Worley Cumulonimbus Storm-Cloud Panorama + Directional Lunar Relief + Wispy Filaments
function createStormCumulonimbusPanoramaTex(w = 1024, h = 512) {
  const dens = new Float32Array(w * h);
  const wisp = new Float32Array(w * h);
  const virga = new Float32Array(w * h);
  // Precompute tileable 256x128 Worley cellular cauliflower table for fast bilinear sampling
  const wW = 256;
  const wH = 128;
  const worleyLut = new Float32Array(wW * wH);
  for (let wy = 0; wy < wH; wy++) {
    const v = wy / wH;
    for (let wx = 0; wx < wW; wx++) {
      const u = wx / wW;
      const c1 = 1 - periodicWorley(u, v, 8, 311);
      const c2 = 1 - periodicWorley(u, v, 18, 353);
      const c3 = 1 - periodicWorley(u, v, 36, 397);
      worleyLut[wy * wW + wx] = clamp(c1 * 0.50 + c2 * 0.32 + c3 * 0.18, 0, 1);
    }
  }
  const sampleWorley = (u, v) => {
    const fx = (((u % 1) + 1) % 1) * wW;
    const fy = (((v % 1) + 1) % 1) * wH;
    const x0 = Math.floor(fx) & (wW - 1);
    const y0 = Math.floor(fy) & (wH - 1);
    const x1 = (x0 + 1) & (wW - 1);
    const y1 = (y0 + 1) & (wH - 1);
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const a = worleyLut[y0 * wW + x0];
    const b = worleyLut[y0 * wW + x1];
    const c = worleyLut[y1 * wW + x0];
    const d = worleyLut[y1 * wW + x1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };

  for (let y = 0; y < h; y++) {
    // Lossless DataTexture (`flipY = false`): y = 0 -> v = 0.0 (horizon), y = h-1 -> v = 1.0 (zenith)!
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const wx = (fastLatticeNoise(u, v, 8, 4, 17) - 0.5) * 0.095 + (fastLatticeNoise(u, v, 16, 8, 29) - 0.5) * 0.045;
      const wy = (fastLatticeNoise(u, v, 8, 4, 43) - 0.5) * 0.085 + (fastLatticeNoise(u, v, 16, 8, 59) - 0.5) * 0.040;
      const uu = u + wx;
      const vv = clamp(v + wy, 0, 1);

      // Voluminous multi-octave cumulonimbus cauliflower billows (isotropic, zero premultiplied-alpha artifacts!)
      const m1 = fastLatticeNoise(uu, vv, 4, 4, 71);
      const m2 = fastLatticeNoise(uu, vv, 8, 6, 97);
      const m3 = fastLatticeNoise(uu, vv, 16, 12, 131);
      const m4 = fastLatticeNoise(uu, vv, 32, 24, 163);
      const m5 = fastLatticeNoise(uu, vv, 64, 48, 197);
      const m6 = fastLatticeNoise(u + wx * 0.4, clamp(v + wy * 0.4, 0, 1), 128, 64, 229);

      // Integer U multipliers (1.0 & 2.0) guarantee 100% periodic wrap at u = 0 / 1 with zero vertical seam!
      const cauli1 = sampleWorley(uu * 1.0, vv * 1.15);
      const cauli2 = sampleWorley(uu * 2.0 + 0.31, vv * 2.3 + 0.17);
      const billow = cauli1 * 0.62 + cauli2 * 0.38;

      // Dense towering cumulonimbus banks from horizon (v=0) up to v=0.78, breaking into starry rifts near zenith
      const bankDeck = smooth01((v + 0.04) / 0.12) * (1 - smooth01((v - 0.62) / 0.36));
      const fbm = m1 * 0.30 + m2 * 0.23 + m3 * 0.16 + m4 * 0.10 + m5 * 0.06 + m6 * 0.04 + billow * 0.11;
      const idx = y * w + x;
      dens[idx] = clamp(smooth01((fbm * (0.68 + 0.50 * bankDeck) - 0.27) / 0.46), 0, 1);

      // Soft wind-sheared feathery cloud filaments (gentle horizontal/windward wisps)
      const wu = u + wx * 0.7 + v * 0.06;
      const wv = clamp(v + wy * 0.5, 0, 1);
      const wf1 = fastLatticeNoise(wu, wv, 8, 16, 409);
      const wf2 = fastLatticeNoise(wu, wv, 16, 32, 443);
      const wf3 = fastLatticeNoise(wu, wv, 32, 64, 487);
      wisp[idx] = clamp(smooth01((wf1 * 0.46 + wf2 * 0.34 + wf3 * 0.20 - 0.40) / 0.44), 0, 1);

      // Subtle storm rain-virga curtains beneath lower cloud bases (v = 0..0.28)
      const vu = u - v * 0.12;
      const vg = fastLatticeNoise(vu, v, 32, 8, 521) * 0.62 + fastLatticeNoise(vu, v, 64, 16, 563) * 0.38;
      virga[idx] = clamp(smooth01((vg - 0.46) / 0.38) * (1 - smooth01((v - 0.24) / 0.22)), 0, 1);
    }
  }

  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const c0 = dens[idx];
      // Directional light-march toward upper-right moon (+y = +v zenith, +x = +u right)
      const s1 = dens[Math.min(h - 1, y + 2) * w + ((x + 2) & (w - 1))];
      const s2 = dens[Math.min(h - 1, y + 5) * w + ((x + 5) & (w - 1))];
      const s3 = dens[Math.min(h - 1, y + 9) * w + ((x + 9) & (w - 1))];
      const occ = s1 * 0.48 + s2 * 0.32 + s3 * 0.20;
      const lit = clamp(0.48 + (c0 - occ) * 1.45 + (1 - occ) * 0.26, 0, 1);
      const i4 = idx * 4;
      d[i4] = Math.round(c0 * 255);
      d[i4 + 1] = Math.round(lit * 255);
      d[i4 + 2] = Math.round(wisp[idx] * 255);
      d[i4 + 3] = Math.round(virga[idx] * 255);
    }
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Crisp 512x512 Selenographic Cratered Full Moon Texture (Authentic Lunar Maria + 75 Ringed Impact Craters + Rays)
function createCrateredMoonTex(size = 512) {
  const rng = mulberry32(19690720);
  const craters = [];
  // Major rayed & terraced craters + medium/micro impact basins (natural subtle lunar relief)
  craters.push({ x: -0.14, y: -0.56, r: 0.095, depth: 0.16, rim: 0.22, rays: 0.85 }); // Tycho
  craters.push({ x: -0.26, y: 0.08, r: 0.115, depth: 0.15, rim: 0.20, rays: 0.65 }); // Copernicus
  craters.push({ x: -0.46, y: 0.02, r: 0.072, depth: 0.13, rim: 0.18, rays: 0.42 }); // Kepler
  craters.push({ x: -0.18, y: 0.52, r: 0.082, depth: 0.15, rim: 0.16, rays: 0.0 }); // Plato
  for (let i = 0; i < 72; i++) {
    const a = rng() * TAU;
    const rad = Math.sqrt(rng()) * 0.88;
    const cr = i < 16 ? lerp(0.052, 0.098, rng()) : lerp(0.018, 0.048, rng());
    craters.push({
      x: Math.cos(a) * rad,
      y: Math.sin(a) * rad,
      r: cr,
      depth: lerp(0.07, 0.15, rng()),
      rim: lerp(0.08, 0.17, rng()),
      rays: 0,
    });
  }

  // Broad selenographic Lunar Maria basins with soft feathered coastlines
  const maria = [
    { x: -0.24, y: 0.26, rx: 0.40, ry: 0.34, w: 1.0 },  // Mare Imbrium
    { x: 0.18, y: 0.24, rx: 0.28, ry: 0.26, w: 0.90 },  // Mare Serenitatis
    { x: 0.34, y: 0.02, rx: 0.30, ry: 0.27, w: 0.86 },  // Mare Tranquillitatis
    { x: -0.48, y: -0.06, rx: 0.36, ry: 0.44, w: 0.88 }, // Oceanus Procellarum
    { x: -0.34, y: -0.36, rx: 0.24, ry: 0.22, w: 0.74 }, // Mare Humorum
    { x: 0.60, y: 0.18, rx: 0.17, ry: 0.20, w: 0.80 },  // Mare Crisium
    { x: 0.44, y: -0.22, rx: 0.22, ry: 0.24, w: 0.70 }, // Mare Fecunditatis
  ];

  return canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let py = 0; py < h; py++) {
        // Canvas y=0 is top (+Y lunar north)
        const my = 1 - (py / (h - 1)) * 2;
        for (let px = 0; px < w; px++) {
          const mx = (px / (w - 1)) * 2 - 1;
          const r2 = mx * mx + my * my;
          const i4 = (py * w + px) * 4;
          if (r2 > 1.04) {
            d[i4] = d[i4 + 1] = d[i4 + 2] = d[i4 + 3] = 0;
            continue;
          }
          const r = Math.sqrt(r2);
          const mz = Math.sqrt(Math.max(0.001, 1 - Math.min(1, r2)));
          // Spherical equirectangular-like projection so features foreshorten naturally near the lunar limb!
          const su = mx / (0.65 + 0.35 * mz) * 0.5 + 0.5;
          const sv = my / (0.65 + 0.35 * mz) * 0.5 + 0.5;

          const fbm1 = fastLatticeNoise(su, sv, 8, 8, 601);
          const fbm2 = fastLatticeNoise(su, sv, 16, 16, 641);
          const fbm3 = fastLatticeNoise(su, sv, 32, 32, 677);
          const fbm4 = fastLatticeNoise(su, sv, 64, 64, 709);
          const regolith = fbm1 * 0.42 + fbm2 * 0.28 + fbm3 * 0.18 + fbm4 * 0.12;

          // Warped coastline Maria mask (strong ~3.2:1 dark-basalt vs silver-highland contrast!)
          const wx = mx + (fbm1 - 0.5) * 0.19 + (fbm2 - 0.5) * 0.09;
          const wy = my + (fbm2 - 0.5) * 0.19 + (fbm3 - 0.5) * 0.09;
          let mareSum = 0;
          for (let m = 0; m < maria.length; m++) {
            const mb = maria[m];
            const dx = (wx - mb.x) / mb.rx;
            const dy = (wy - mb.y) / mb.ry;
            const md = dx * dx + dy * dy;
            if (md < 2.2) mareSum += Math.exp(-md * 1.45) * mb.w;
          }
          const mareMask = clamp(smooth01((mareSum * (0.58 + 0.52 * regolith) - 0.16) / 0.68), 0, 1);

          // Crater height relief + directional sun/earthshine shading + bright ejecta rays
          let relief = (regolith - 0.5) * 0.12;
          let rayBoost = 0;
          let darkFloor = 0;
          for (let k = 0; k < craters.length; k++) {
            const c = craters[k];
            const dx = mx - c.x;
            const dy = my - c.y;
            const dist = Math.hypot(dx, dy);
            if (dist < c.r * 1.45) {
              const q = dist / c.r;
              const qn = q / 0.82;
              const rq1 = (q - 0.94) / 0.18;
              const rq2 = (q - 0.92) / 0.28;
              const bowl = q < 0.82 ? -(1 - qn * qn) * c.depth : 0;
              const rim = Math.exp(-rq1 * rq1) * c.rim;
              // Directional rim highlight (upper-left grazing light)
              const rimSlope = ((dx * -0.55 + dy * 0.52) / Math.max(0.01, c.r)) * Math.exp(-rq2 * rq2) * c.rim * 0.85;
              relief += bowl + rim + rimSlope;
              if (k === 3 && q < 0.78) darkFloor = 0.55;
            }
            if (c.rays > 0 && dist > c.r * 0.8 && dist < c.r * 7.5) {
              const ang = Math.atan2(dy, dx);
              const streak = fastLatticeNoise(ang / TAU + 0.5, dist * 0.8, 32, 4, 751 + k * 29);
              const falloff = Math.exp(-(dist - c.r) / (c.r * 3.4));
              rayBoost += smooth01((streak - 0.56) / 0.34) * falloff * c.rays * 0.32;
            }
          }

          // Natural photographic lunar highlands (#ebf2fc) vs soft silver-slate basaltic Maria (#8899b6)
          let rCol = lerp(235, 134, mareMask);
          let gCol = lerp(242, 150, mareMask);
          let bCol = lerp(252, 178, mareMask);
          if (darkFloor > 0) {
            rCol = lerp(rCol, 118, darkFloor * 0.65);
            gCol = lerp(gCol, 132, darkFloor * 0.65);
            bCol = lerp(bCol, 160, darkFloor * 0.65);
          }
          const limb = 0.72 + 0.28 * Math.pow(mz, 0.36);
          const shade = clamp(limb * (1 + relief * (1 - mareMask * 0.25)) + rayBoost * 0.65, 0.32, 1.12);
          const alpha = 1 - smooth01((r - 0.955) / 0.055);
          d[i4] = Math.round(clamp(rCol * shade, 0, 255));
          d[i4 + 1] = Math.round(clamp(gCol * shade, 0, 255));
          d[i4 + 2] = Math.round(clamp(bCol * shade, 0, 255));
          d[i4 + 3] = Math.round(alpha * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: true, repeat: false, mip: true }
  );
}

function createWaterNormalTex(size = 256) {
  return canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const waves = [];
      let seed = 11;
      const r01 = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 28; i++) {
        const kx = Math.round((r01() - 0.5) * (6 + i * 1.65));
        const ky = Math.round((r01() - 0.5) * (6 + i * 1.65));
        if (kx === 0 && ky === 0) continue;
        const k = Math.hypot(kx, ky);
        waves.push({ kx, ky, amp: 1 / Math.pow(k, 1.22), ph: r01() * TAU });
      }
      for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
          const u = x / w;
          let dx = 0;
          let dy = 0;
          for (let i = 0; i < waves.length; i++) {
            const wv = waves[i];
            const a = TAU * (wv.kx * u + wv.ky * v) + wv.ph;
            const cs = Math.cos(a) * wv.amp;
            dx += cs * wv.kx;
            dy += cs * wv.ky;
          }
          const nx = -dx * 0.095;
          const ny = -dy * 0.095;
          const nz = 1;
          const inv = 1 / Math.hypot(nx, ny, nz);
          const i4 = (y * w + x) * 4;
          img.data[i4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
          img.data[i4 + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
          img.data[i4 + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
          img.data[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: true }
  );
}

// Natural Craggy FBM + Worley Wet-Basalt PBR Maps (ZERO rectangular grid lines!)
function createCraggyBasaltMaps(size = 256) {
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Domain-warped craggy volcanic basalt facets + micro-grain (100% seamless & isotropic)
      const warpU = u + (periodicValueNoise(u, v, 5, 31) - 0.5) * 0.09;
      const warpV = v + (periodicValueNoise(u, v, 5, 47) - 0.5) * 0.09;
      const fbm =
        periodicValueNoise(warpU, warpV, 6, 13) * 0.42 +
        periodicValueNoise(warpU, warpV, 14, 29) * 0.28 +
        periodicValueNoise(warpU, warpV, 28, 61) * 0.19 +
        periodicValueNoise(u, v, 56, 97) * 0.11;
      const ridge1 = 1 - Math.abs(2 * periodicValueNoise(warpU, warpV, 8, 131) - 1);
      const ridge2 = 1 - periodicWorley(warpU, warpV, 12, 181);
      const strata = 0.5 + 0.5 * Math.sin(warpV * TAU * 5.0 + (fbm - 0.5) * 4.4);
      const cracks = Math.pow(periodicWorley(warpU, warpV, 9, 211), 0.48);
      hgt[y * size + x] = clamp(
        (fbm * 0.46 + ridge1 * 0.26 + ridge2 * 0.16 + strata * 0.12) * (0.58 + 0.42 * cracks),
        0,
        1
      );
    }
  }

  const map = canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let y = 0; y < h; y++) {
        const v = y / h;
        for (let x = 0; x < w; x++) {
          const u = x / w;
          const hv = hgt[y * w + x];
          const mossPatch = periodicValueNoise(u, v, 8, 307);
          const mineralVar = periodicValueNoise(u, v, 16, 353) - 0.5;
          let r = 42 + hv * 66 + mineralVar * 10;
          let g = 49 + hv * 72 + mineralVar * 10;
          let b = 60 + hv * 84 + mineralVar * 12;
          if (mossPatch > 0.64 && hv > 0.36) {
            const mk = clamp((mossPatch - 0.64) * 2.4, 0, 0.62);
            r = lerp(r, 44, mk);
            g = lerp(g, 74, mk);
            b = lerp(b, 42, mk);
          }
          const i4 = (y * w + x) * 4;
          d[i4] = Math.round(clamp(r, 0, 255));
          d[i4 + 1] = Math.round(clamp(g, 0, 255));
          d[i4 + 2] = Math.round(clamp(b, 0, 255));
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: true, repeat: true }
  );

  const normalMap = canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const H = (x, y) => hgt[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
      const strength = 3.8;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
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
          d[i4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
          d[i4 + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
          d[i4 + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: true }
  );

  const roughnessMap = canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < w * h; i++) {
        const rv = Math.round(clamp(236 - hgt[i] * 68, 152, 246));
        const i4 = i * 4;
        d[i4] = rv;
        d[i4 + 1] = rv;
        d[i4 + 2] = rv;
        d[i4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: true }
  );

  return { map, normalMap, roughnessMap };
}

function patchWetRock(mat, U, key = 'wetrock') {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSeaY = U.uSeaY;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRockWorldY;')
      .replace(
        '#include <project_vertex>',
        `vec4 rwPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          rwPos = instanceMatrix * rwPos;
        #endif
        rwPos = modelMatrix * rwPos;
        vRockWorldY = rwPos.y;
        #include <project_vertex>`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSeaY;\nvarying float vRockWorldY;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float wetTide = 1.0 - smoothstep(0.25, 3.1, vRockWorldY - uSeaY);
        diffuseColor.rgb *= mix(1.0, 0.58, wetTide);
        roughnessFactor = mix(roughnessFactor, 0.24, wetTide * 0.85);`
      );
  };
  mat.customProgramCacheKey = () => `glide_${key}`;
  return mat;
}

// Woven Ripstop Canvas & Double-Stitched Leather Seam Normal + Roughness Maps for `sky_glider.glb`
function createSailClothMaps(size = 128) {
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Crisscross woven canvas warp/weft + ripstop grid + raised double-stitched seam ribs
      const warp = Math.sin(u * size * Math.PI * 0.5) * 0.5 + 0.5;
      const weft = Math.sin(v * size * Math.PI * 0.5) * 0.5 + 0.5;
      const ripstop = (x % 16 === 0 ? 0.18 : 0) + (y % 16 === 0 ? 0.18 : 0);
      const seamDist = Math.abs(((u * 4) % 1) - 0.5);
      const seamRib = seamDist < 0.045 ? 0.42 : 0;
      const stitchHole =
        Math.abs(seamDist - 0.026) < 0.012 && ((y >> 2) % 2 === 0) ? -0.35 : 0;
      const wrinkle = (periodicValueNoise(u, v, 6, 613) - 0.5) * 0.24;
      hgt[y * size + x] = clamp(0.45 + (warp * 0.12 + weft * 0.12) + ripstop + seamRib + stitchHole + wrinkle, 0, 1);
    }
  }
  const normalMap = canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const H = (x, y) => hgt[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
      const strength = 2.4;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
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
          const inv = 1 / Math.hypot(-dx, dy, 1);
          const i4 = (y * w + x) * 4;
          d[i4] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
          d[i4 + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
          d[i4 + 2] = Math.round((inv * 0.5 + 0.5) * 255);
          d[i4 + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: true }
  );
  const roughnessMap = canvasTex(
    size,
    size,
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < w * h; i++) {
        const rv = Math.round(clamp(205 - hgt[i] * 55, 110, 235));
        const i4 = i * 4;
        d[i4] = rv;
        d[i4 + 1] = rv;
        d[i4 + 2] = rv;
        d[i4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    },
    { srgb: false, repeat: true }
  );
  return { normalMap, roughnessMap };
}

function patchWatchtower(mat, U) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uSeaY = U.uSeaY;
    shader.uniforms.uHaze = U.uHaze;
    shader.uniforms.uSkyHor = U.uSkyHor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTwLocal;\nvarying float vTwWorldY;\nvarying float vTwSeed;\nvarying float vTwDist;')
      .replace(
        '#include <project_vertex>',
        `vTwLocal = position;
        vec4 twPos = vec4(transformed, 1.0);
        vTwSeed = 0.0;
        #ifdef USE_INSTANCING
          vTwSeed = instanceMatrix[3].x * 0.09 + instanceMatrix[3].z * 0.05;
          twPos = instanceMatrix * twPos;
        #endif
        twPos = modelMatrix * twPos;
        vTwWorldY = twPos.y;
        #include <project_vertex>
        vTwDist = -mvPosition.z;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform float uSeaY;\nuniform vec3 uHaze;\nuniform vec3 uSkyHor;\nvarying vec3 vTwLocal;\nvarying float vTwWorldY;\nvarying float vTwSeed;\nvarying float vTwDist;'
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float wetTide = 1.0 - smoothstep(0.2, 3.6, vTwWorldY - uSeaY);
        diffuseColor.rgb *= mix(1.0, 0.56, wetTide);
        roughnessFactor = mix(roughnessFactor, 0.24, wetTide * 0.85);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float ang = atan(vTwLocal.z, vTwLocal.x);
        // Blazing Golden Beacon Cupola (vTwLocal.y in 0.96..1.14)
        float cupola = smoothstep(0.95, 0.99, vTwLocal.y) * (1.0 - smoothstep(1.11, 1.15, vTwLocal.y));
        float mullion = smoothstep(0.22, 0.48, abs(sin(ang * 6.0)));
        float pulse = 0.85 + 0.15 * sin(uTime * 3.4 + vTwSeed * 12.0);
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.24) * cupola * (0.45 + 1.45 * mullion) * pulse;
        // Spiral glowing golden/cyan watchtower slit-windows along the stone shaft
        if (vTwLocal.y > 0.14 && vTwLocal.y < 0.88) {
          float tier = fract(vTwLocal.y * 7.5);
          float winY = smoothstep(0.28, 0.36, tier) * (1.0 - smoothstep(0.66, 0.74, tier));
          float spiralA = fract((ang / 6.2831853) * 8.0 + floor(vTwLocal.y * 7.5) * 0.37);
          float winX = smoothstep(0.36, 0.43, spiralA) * (1.0 - smoothstep(0.57, 0.64, spiralA));
          float litPick = step(0.35, fract(sin(floor(vTwLocal.y * 7.5) * 19.7 + floor((ang / 6.2831853) * 8.0) * 7.3 + vTwSeed) * 43758.5));
          vec3 winCol = fract(vTwLocal.y * 3.7 + vTwSeed) > 0.72 ? vec3(0.24, 0.92, 0.96) : vec3(1.0, 0.66, 0.20);
          totalEmissiveRadiance += winCol * winX * winY * litPick * 0.95;
        }`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 twHorMist = mix(uSkyHor, uHaze, 0.52) * 0.76;
        float twBaseFog = (1.0 - smoothstep(0.0, 6.2, vTwWorldY - uSeaY)) * smoothstep(55.0, 185.0, vTwDist) * 0.78;
        float twAerial = smoothstep(95.0, 325.0, vTwDist) * 0.72;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, twHorMist, clamp(max(twBaseFog, twAerial * (1.0 - cupola * 0.65)), 0.0, 0.86));
        #include <dithering_fragment>`
      );
  };
  mat.customProgramCacheKey = () => 'glide_watchtower_pbr_v2';
  return mat;
}

// Aerial-perspective + basal sea-mist grounding for mid & distant craggy archipelago ridges
function patchArchipelagoFog(mat, U, { distStart = 90, distEnd = 330, maxFog = 0.88, key = 'arch_fog' } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSeaY = U.uSeaY;
    shader.uniforms.uHaze = U.uHaze;
    shader.uniforms.uSkyHor = U.uSkyHor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vAfWorldY;\nvarying float vAfDist;')
      .replace(
        '#include <project_vertex>',
        `vec4 afPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          afPos = instanceMatrix * afPos;
        #endif
        afPos = modelMatrix * afPos;
        vAfWorldY = afPos.y;
        #include <project_vertex>
        vAfDist = -mvPosition.z;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uSeaY;\nuniform vec3 uHaze;\nuniform vec3 uSkyHor;\nvarying float vAfWorldY;\nvarying float vAfDist;'
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float wetTide = 1.0 - smoothstep(0.25, 3.2, vAfWorldY - uSeaY);
        diffuseColor.rgb *= mix(1.0, 0.55, wetTide);
        roughnessFactor = mix(roughnessFactor, 0.24, wetTide * 0.85);`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 afHorMist = mix(uSkyHor, uHaze, 0.52) * 0.76;
        float afAerial = smoothstep(${distStart.toFixed(1)}, ${distEnd.toFixed(1)}, vAfDist) * ${maxFog.toFixed(2)};
        float afBaseMist = (1.0 - smoothstep(-0.5, 5.2, vAfWorldY - uSeaY)) * smoothstep(58.0, 210.0, vAfDist) * 0.76;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, afHorMist, clamp(max(afAerial, afBaseMist), 0.0, 0.94));
        #include <dithering_fragment>`
      );
  };
  mat.customProgramCacheKey = () => `glide_${key}`;
  return mat;
}

function makeVoronoiSeafoamRingTex(size = 256) {
  return canvasTex(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const ny = (y / h) * 2 - 1;
      for (let x = 0; x < w; x++) {
        const nx = (x / w) * 2 - 1;
        const r = Math.hypot(nx, ny);
        const u = x / w;
        const v = y / h;
        const w1 = periodicWorley(u, v, 10, 401);
        const w2 = periodicWorley(u, v, 22, 463);
        const fbm = periodicValueNoise(u, v, 8, 509);
        // Lacy cellular Voronoi web peaking around r = 0.42..0.78, fading cleanly to 0 at center & outer edge
        const ringEnv = smooth01((r - 0.16) / 0.26) * (1 - smooth01((r - 0.62) / 0.36));
        const lace = smooth01((w1 * 0.65 + w2 * 0.35 - 0.22) / 0.42) * (0.65 + 0.35 * fbm);
        const alpha = clamp(ringEnv * (0.32 + lace * 0.88), 0, 1);
        const i4 = (y * w + x) * 4;
        d[i4] = 228;
        d[i4 + 1] = 244;
        d[i4 + 2] = 255;
        d[i4 + 3] = Math.round(alpha * 235);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// ---------------------------------------------------------------------------------- geometry builders
function buildIsland(rng, { peaks = 2, flat = 0.4, radSeg = 44, hSeg = 12 } = {}) {
  const g = new THREE.CylinderGeometry(1, 1.18, 1.15, radSeg, hSeg, false);
  g.translate(0, 0.42, 0);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const ph = [rng() * TAU, rng() * TAU, rng() * TAU];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    let r =
      1 +
      Math.sin(a * 3 + ph[0]) * 0.13 +
      Math.sin(a * 7 + ph[1]) * 0.065 +
      Math.sin(a * 13 + ph[2]) * 0.028;
    let h = y;
    if (y > 0.98) {
      let pk = 0;
      for (let k = 0; k < peaks; k++) {
        const pa = ph[k % 3] + k * 2.1;
        const d = Math.hypot(Math.cos(a) * 0.5 - Math.cos(pa) * 0.35, Math.sin(a) * 0.5 - Math.sin(pa) * 0.35);
        pk = Math.max(pk, Math.exp(-d * d * 6));
      }
      h = 1 + pk * (1 - flat) * 0.52;
      r *= 0.78 - pk * 0.24;
    } else {
      const yn = clamp((y + 0.15) / 1.15, 0, 1);
      r *= 1 - yn * yn * 0.22;
      r *= 1 + Math.sin(y * 9.0 + a * 3.0 + ph[0]) * 0.024;
    }
    const nx = x * r;
    const nz = z * r;
    p.setXYZ(i, nx, h, nz);
    if (uv) uv.setXY(i, (a / TAU + 0.5) * 3.0, (h + 0.2) * 1.6);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  paint(g, (x, y, z, c, k) => {
    const ny = nrm ? nrm.getY(k) : 0;
    const wetDark = 0.68 + 0.32 * smooth01((y - 0.02) / 0.45);
    const mossK = smooth01((y - 0.72) / 0.28) * smooth01((ny - 0.35) / 0.45) * 0.65;
    let r = wetDark;
    let gg = wetDark * 1.02;
    let b = wetDark * 1.06;
    r = lerp(r, 0.52, mossK);
    gg = lerp(gg, 0.82, mossK);
    b = lerp(b, 0.48, mossK);
    c[0] = r;
    c[1] = gg;
    c[2] = b;
  });
  return g;
}

// Organic Multi-Octave Craggy Coastal Headland & Archipelago Ridge Terrain (Grid mesh = ZERO pyramid cone apex!)
function buildArchipelagoRidge(rng, { segX = 34, segZ = 14 } = {}) {
  const g = new THREE.PlaneGeometry(3.4, 1.8, segX, segZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const seed = Math.floor(rng() * 10000) + 17;
  const ph0 = rng() * TAU;
  const ph1 = rng() * TAU;
  const ph2 = rng() * TAU;
  // 4 asymmetric rounded/craggy headland massifs + coastal saddle notches (never a single triangle peak!)
  const lobes = [
    { x: -0.92 + (rng() - 0.5) * 0.18, z: -0.08, rx: 0.58, rz: 0.55, h: lerp(0.52, 0.76, rng()) },
    { x: -0.26 + (rng() - 0.5) * 0.18, z: 0.06, rx: 0.66, rz: 0.62, h: lerp(0.78, 1.02, rng()) },
    { x: 0.42 + (rng() - 0.5) * 0.18, z: -0.05, rx: 0.62, rz: 0.58, h: lerp(0.68, 0.94, rng()) },
    { x: 1.02 + (rng() - 0.5) * 0.16, z: 0.08, rx: 0.52, rz: 0.50, h: lerp(0.42, 0.66, rng()) },
  ];

  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let z = p.getZ(i);
    const u = x / 3.4 + 0.5;
    const v = z / 1.8 + 0.5;

    // Irregular coastal shoreline warp so island footprint is organic
    const wx = (fastLatticeNoise(u, v, 4, 4, seed) - 0.5) * 0.42 + Math.sin(z * 2.7 + ph0) * 0.14;
    const wz = (fastLatticeNoise(u, v, 4, 4, seed + 31) - 0.5) * 0.28 + Math.sin(x * 1.9 + ph1) * 0.12;
    const sx = x + wx * 0.45;
    const sz = z + wz * 0.45;

    let baseH = 0;
    for (let k = 0; k < lobes.length; k++) {
      const lb = lobes[k];
      const dx = (sx - lb.x) / lb.rx;
      const dz = (sz - lb.z) / lb.rz;
      const d2 = dx * dx + dz * dz;
      // Rounded dome-shoulder plateau profile (1 / (1 + d2^1.6)) avoids sharp straight cone sides!
      baseH = Math.max(baseH, lb.h / (1 + Math.pow(d2, 1.55) * 1.85));
    }

    // Perimeter envelope ensures all 4 outer grid borders dip cleanly below sea level (y = -0.18)
    const envX = smooth01((1.66 - Math.abs(x)) / 0.48);
    const envZ = smooth01((0.88 - Math.abs(z)) / 0.36);
    const env = envX * envZ;

    // Multi-octave craggy coastal basalt cliff relief, stepped terraces & sea-stack shoulders
    const n1 = fastLatticeNoise(u, v, 8, 8, seed + 73);
    const n2 = fastLatticeNoise(u, v, 16, 16, seed + 127);
    const n3 = fastLatticeNoise(u, v, 32, 32, seed + 191);
    const crag = (n1 - 0.45) * 0.34 + (n2 - 0.48) * 0.19 + (n3 - 0.5) * 0.09 + Math.sin(sx * 5.2 + ph2) * 0.06;
    let rawY = (baseH + crag * smooth01(baseH / 0.35)) * env;
    // Subtle weathered basalt strata terraces along upper slopes
    rawY += Math.sin(rawY * 9.5 + n1 * 3.0) * 0.032 * env;
    const ny = rawY * 1.08 - (1 - env) * 0.22;

    // Pull cliff flanks slightly inward on steep faces for craggy rock overhang feel
    x += (n2 - 0.5) * 0.14 * env;
    z += (n1 - 0.5) * 0.10 * env;
    p.setXYZ(i, x, ny, z);
    if (uv) uv.setXY(i, u * 4.5, (ny + 0.25) * 2.2 + v * 1.5);
  }
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const shade = 0.54 + 0.46 * smooth01((y + 0.05) / 1.05);
    c[0] = shade * 0.90;
    c[1] = shade * 0.96;
    c[2] = shade * 1.08;
  });
  return g;
}

function horizonMistMaterial(U, noiseTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noiseTex },
      uTime: U.uTime,
      uSkyHor: U.uSkyHor,
      uHaze: U.uHaze,
      uCloudRim: U.uCloudRim,
      uFlash: U.uFlash,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC; varying float vSeed;
      void main(){
        vUv = uv;
        vC = instanceColor;
        vSeed = instanceMatrix[3].x * 0.071 + instanceMatrix[3].z * 0.043;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise; uniform float uTime;
      uniform vec3 uSkyHor; uniform vec3 uHaze; uniform vec3 uCloudRim; uniform float uFlash;
      varying vec2 vUv; varying vec3 vC; varying float vSeed;
      void main(){
        // Strictly 0.0 alpha on all 4 quad edges — zero rectangular cards!
        float box = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x)
                  * smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
        vec2 sOff = vec2(fract(vSeed * 1.37), fract(vSeed * 2.91));
        vec4 n1 = texture2D(uNoise, vUv * vec2(1.6, 0.9) + sOff + vec2(uTime * 0.011, 0.0));
        vec4 n2 = texture2D(uNoise, vUv * vec2(3.4, 1.8) - sOff + vec2(-uTime * 0.016, (n1.r - 0.5) * 0.14));
        float fbm = n1.r * 0.54 + n1.g * 0.28 + n2.b * 0.18;
        float wisp = smoothstep(0.24, 0.78, fbm) * box;
        vec3 baseFog = mix(uSkyHor, uHaze, 0.52) * 0.84;
        vec3 moonTint = mix(baseFog, uCloudRim * 0.52, smoothstep(0.35, 0.85, vUv.y) * vC.g * 0.42);
        moonTint += vec3(0.45, 0.62, 0.92) * uFlash * 0.22;
        float a = clamp(wisp * vC.r * 0.54, 0.0, 0.52);
        gl_FragColor = vec4(moonTint, a);
        ${GLSL_OUT}
      }`,
  });
}

function buildFarTower() {
  const uvScale = (g, su, sv) => {
    const uv = g.attributes.uv;
    if (uv) {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    return g;
  };
  const parts = [];
  // Rugged wave-lashed basalt reef plinth
  const plinth = uvScale(new THREE.CylinderGeometry(0.74, 0.96, 0.14, 18, 1), 3, 0.6);
  plinth.translate(0, 0.03, 0);
  parts.push(solid(plinth, 0.62, 0.66, 0.74));
  // Monumental tapered Watchtower stone shaft
  const body = uvScale(new THREE.CylinderGeometry(0.50, 0.68, 0.90, 24, 4), 4, 7);
  body.translate(0, 0.50, 0);
  parts.push(solid(body, 0.92, 0.96, 1.04));
  // Projecting Romanesque corbelled gallery balconies
  for (const [gy, gr] of [[0.38, 0.66], [0.68, 0.60], [0.94, 0.58]]) {
    const gal = uvScale(new THREE.CylinderGeometry(gr, gr * 0.88, 0.045, 20, 1), 3, 0.3);
    place(gal, 0, gy, 0);
    parts.push(solid(gal, 0.76, 0.82, 0.90));
  }
  // Crenellated stone merlons around the crown parapet
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const merlon = uvScale(new THREE.BoxGeometry(0.14, 0.055, 0.09), 0.4, 0.3);
    merlon.rotateY(-a + Math.PI / 2);
    merlon.translate(Math.cos(a) * 0.53, 0.985, Math.sin(a) * 0.53);
    parts.push(solid(merlon, 0.82, 0.88, 0.96));
  }
  // Glowing Golden Lighthouse Lantern Cupola
  const cupola = new THREE.CylinderGeometry(0.36, 0.38, 0.16, 16, 1);
  place(cupola, 0, 1.05, 0);
  parts.push(solid(cupola, 1.15, 0.92, 0.55));
  // Weathered copper/bronze conical cupola roof + finial spire
  const spire = new THREE.ConeGeometry(0.44, 0.20, 16);
  place(spire, 0, 1.22, 0);
  parts.push(solid(spire, 0.42, 0.52, 0.58));
  return merge(parts);
}

function buildSeaStackArch(rng) {
  const ph1 = rng() * TAU;
  const ph2 = rng() * TAU;
  const segU = 68;
  const segV = 32;
  const pos = [];
  const uvs = [];
  const idx = [];

  const archPoint = (u, out) => {
    const s = u * 2 - 1;
    const absS = Math.abs(s);
    const cx = Math.sign(s) * (1.08 * Math.pow(absS, 0.72) + 0.14 * absS * absS);
    const archH = Math.pow(Math.max(0, 1 - s * s), 0.62);
    const cragSpine =
      0.16 * Math.exp(-Math.pow((u - 0.33) * 6.5, 2)) + 0.10 * Math.exp(-Math.pow((u - 0.69) * 8.0, 2));
    const cy = lerp(-0.32, 1.46, archH) + cragSpine;
    const cz = Math.sin(s * Math.PI) * 0.08;
    return out.set(cx, cy, cz);
  };

  const pPrev = new THREE.Vector3();
  const pCur = new THREE.Vector3();
  const pNext = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const fwdZ = new THREE.Vector3(0, 0, 1);
  const nrm = new THREE.Vector3();
  const bin = new THREE.Vector3();

  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const s = u * 2 - 1;
    const absS = Math.abs(s);
    archPoint(Math.max(0, u - 0.01), pPrev);
    archPoint(u, pCur);
    archPoint(Math.min(1, u + 0.01), pNext);
    tan.subVectors(pNext, pPrev).normalize();
    nrm.crossVectors(tan, fwdZ).normalize();
    bin.crossVectors(tan, nrm).normalize();

    const pillarBulk = Math.pow(absS, 1.32);
    const baseFlare = Math.pow(Math.max(0, (absS - 0.64) / 0.36), 1.5) * 0.28;
    const baseRad = lerp(0.28, 0.56, pillarBulk) + baseFlare;

    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const th = v * TAU;
      const ct = Math.cos(th);
      const st = Math.sin(th);

      // Angular fractured basalt column ribs + stepped coastal cliff ledges
      const colRib1 = 1 - Math.abs(Math.sin(th * 3.0 + ph1 * 0.5 + u * 2.2));
      const colRib2 = 1 - Math.abs(Math.cos(th * 6.0 - ph2 * 0.5 + u * 3.8));
      const ribs = 0.84 + colRib1 * 0.22 + colRib2 * 0.11 + 0.05 * Math.cos(th * 11.0 + u * 9.0);
      const rN = baseRad * ribs * (ct > 0 ? 1.15 : 0.86);
      const rB = baseRad * ribs * 0.96;

      let vx = pCur.x + nrm.x * ct * rN + bin.x * st * rB;
      let vy = pCur.y + nrm.y * ct * rN + bin.y * st * rB;
      let vz = pCur.z + nrm.z * ct * rN + bin.z * st * rB;

      // Stepped horizontal sedimentary/basalt shelf ledges + angular crags
      const shelf = Math.sin(vy * 11.5 + ph1) * 0.028 + Math.sin(vy * 23.0 + vx * 4.0) * 0.014;
      const crag = (1 - Math.abs(Math.sin(vy * 6.8 + vx * 3.4 + ph2))) * 0.055 - 0.025;
      const disp = shelf + crag;
      vx += (nrm.x * ct + bin.x * st) * disp;
      vz += (nrm.z * ct + bin.z * st) * disp;
      vy += crag * 0.38;

      pos.push(vx, vy, vz);
      // Seamless periodic rock-grain UVs (integer V wrap across th = 0..TAU -> zero seam, zero grid lines!)
      uvs.push(u * 4.0, v * 2.0);
    }
  }

  const stride = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const nrmAttr = geo.attributes.normal;
  paint(geo, (x, y, z, c, k) => {
    const ny = nrmAttr ? nrmAttr.getY(k) : 0;
    // Darker surf-drenched lower cliff rock + natural vault AO + dark olive mossy crown
    const wetBase = 0.64 + 0.36 * smooth01((y - 0.04) / 0.52);
    const mossK = smooth01((y - 1.02) / 0.36) * smooth01((ny - 0.36) / 0.42) * 0.72;
    const underAO = 1 - smooth01((-ny - 0.18) / 0.58) * smooth01((y - 0.32) / 0.52) * 0.44;

    let r = wetBase * underAO;
    let g = wetBase * 1.02 * underAO;
    let b = wetBase * 1.06 * underAO;

    r = lerp(r, 0.48, mossK);
    g = lerp(g, 0.78, mossK);
    b = lerp(b, 0.44, mossK);

    c[0] = r;
    c[1] = g;
    c[2] = b;
  });
  return geo;
}

function buildLantern() {
  const pts = [];
  const prof = [
    [0.10, -0.74],
    [0.34, -0.62],
    [0.52, -0.44],
    [0.64, -0.08],
    [0.70, 0.22],
    [0.62, 0.50],
    [0.44, 0.68],
    [0.18, 0.76],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const parts = [];
  const glass = new THREE.LatheGeometry(pts, 16);
  parts.push(solid(glass, 1, 1, 1));
  // Forged-brass scalloped storm hood + bottom weighted collar + suspension bail ring
  const cap = new THREE.ConeGeometry(0.54, 0.22, 12);
  place(cap, 0, 0.78, 0);
  parts.push(solid(cap, 0.42, 0.30, 0.14));
  const rim = new THREE.TorusGeometry(0.36, 0.04, 5, 14);
  place(rim, 0, -0.62, 0, Math.PI / 2);
  parts.push(solid(rim, 0.42, 0.30, 0.14));
  const bail = new THREE.TorusGeometry(0.16, 0.025, 5, 12);
  place(bail, 0, 0.94, 0);
  parts.push(solid(bail, 0.52, 0.38, 0.18));
  return merge(parts);
}

function buildCelestialGateGeo() {
  const parts = [];
  // Outer beveled burnished-brass astrolabe ring
  const outer = new THREE.TorusGeometry(1.0, 0.086, 10, 48);
  parts.push(solid(outer, 1.0, 0.82, 0.42));
  // Recessed inner Celestial-Cyan arcane conduit ring
  const inner = new THREE.TorusGeometry(0.895, 0.036, 8, 48);
  parts.push(solid(inner, 0.28, 0.96, 1.0));
  // 12 radial brass gear-teeth & cardinal astrolabe clasps
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    const cardinal = k % 3 === 0;
    const tooth = new THREE.BoxGeometry(cardinal ? 0.13 : 0.085, cardinal ? 0.22 : 0.14, cardinal ? 0.16 : 0.11);
    tooth.rotateZ(a - Math.PI / 2);
    tooth.translate(Math.cos(a) * (cardinal ? 1.05 : 1.08), Math.sin(a) * (cardinal ? 1.05 : 1.08), 0);
    parts.push(solid(tooth, cardinal ? 1.05 : 0.88, cardinal ? 0.86 : 0.66, cardinal ? 0.48 : 0.28));
  }
  return merge(parts);
}

function buildKiteGeo() {
  const sh = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? 0.45 : 1.0;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (k === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  const g = new THREE.ShapeGeometry(sh, 2);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5);
    p.setZ(i, -0.12 * (1 - Math.hypot(p.getX(i), p.getY(i))));
  }
  g.computeVertexNormals();
  return g;
}

function buildKiteTail() {
  const parts = [];
  const rib = new THREE.PlaneGeometry(1, 0.035, 16, 1);
  rib.translate(-0.5, 0, 0);
  parts.push(solid(rib, 0.95, 0.95, 0.95));
  for (let k = 1; k <= 3; k++) {
    const bow = new THREE.PlaneGeometry(0.12, 0.12);
    bow.rotateZ(Math.PI / 4);
    place(bow, -k * 0.3, 0, 0.001, 0, 0, 0, 1, 0.55, 1);
    parts.push(solid(bow, 1, 1, 1));
    const bow2 = new THREE.PlaneGeometry(0.12, 0.12);
    bow2.rotateZ(Math.PI / 4);
    place(bow2, -k * 0.3, 0, 0.001, 0, 0, Math.PI / 2, 1, 0.55, 1);
    parts.push(solid(bow2, 1, 1, 1));
  }
  return merge(parts);
}

function buildGull() {
  const parts = [];
  const body = new THREE.SphereGeometry(0.2, 12, 8);
  place(body, 0, 0, 0, 0, 0, 0, 2.4, 0.95, 0.95);
  solid(body, 0.98, 0.98, 0.98);
  parts.push(body);
  const head = new THREE.SphereGeometry(0.13, 10, 8);
  place(head, -0.46, 0.08, 0);
  solid(head, 1, 1, 1);
  parts.push(head);
  const beak = new THREE.ConeGeometry(0.045, 0.2, 6);
  place(beak, -0.64, 0.05, 0, 0, 0, Math.PI / 2);
  solid(beak, 1.0, 0.62, 0.12);
  parts.push(beak);
  for (const side of [1, -1]) {
    const eye = new THREE.SphereGeometry(0.026, 6, 4);
    place(eye, -0.53, 0.12, side * 0.08);
    solid(eye, 0.03, 0.03, 0.05);
    parts.push(eye);
  }
  const tail = new THREE.ConeGeometry(0.13, 0.32, 4);
  place(tail, 0.5, 0.02, 0, 0, Math.PI / 4, -Math.PI / 2, 1, 1, 0.4);
  solid(tail, 0.85, 0.87, 0.9);
  parts.push(tail);
  const segs = 8;
  for (const side of [1, -1]) {
    const pos = [];
    const col = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const z = side * (0.08 + u * 1.0);
      const chord = lerp(0.36, 0.12, u);
      const lead = -0.12 + u * u * 0.22;
      const y = 0.03 + Math.sin(u * Math.PI) * 0.05;
      pos.push(lead, y, z, lead + chord, y, z);
      const tip = u > 0.78;
      const g = tip ? 0.12 : 0.78 - u * 0.1;
      col.push(g, g, g + 0.03, g * 0.95, g * 0.95, g);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      if (side > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    w.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    w.setIndex(idx);
    w.computeVertexNormals();
    parts.push(w);
  }
  return merge(parts);
}

// ---------------------------------------------------------------------------------- shader materials
// Ultra-soft domain-warped FBM mist & thunderhead shader (zero pill shapes, zero hard rim outlines!)
function cloudMaterial(U, noiseTex, { fg = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noiseTex },
      uLit: U.uCloudLit,
      uShade: U.uCloudShade,
      uHaze: U.uHaze,
      uFlash: U.uFlash,
      uTime: U.uTime,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aCloud;
      varying vec2 vUv; varying vec4 vC; varying float vDepth;
      void main(){
        vUv = uv;
        vC = aCloud;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uHaze; uniform float uFlash; uniform float uTime;
      varying vec2 vUv; varying vec4 vC; varying float vDepth;
      void main(){
        vec2 q = (vUv - 0.5) * vec2(2.0, 2.15);
        float boxFade = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x)
                      * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float env = exp(-dot(q, q) * 3.1) * smoothstep(0.95, 0.62, length(q)) * boxFade;
        vec2 seedOff = vec2(vC.x * 0.37, vC.x * 0.61);
        vec4 n1 = texture2D(uNoise, vUv * vec2(1.1, 0.75) + seedOff + vec2(uTime * 0.012, 0.0));
        vec4 n2 = texture2D(uNoise, vUv * vec2(2.3, 1.65) - seedOff + vec2(-uTime * 0.018, n1.r * 0.14));
        float fbm = n1.r * 0.52 + n2.g * 0.32 + n2.b * 0.16;
        float storm = clamp(vC.w, 0.0, 1.0);
        float flick = max(vC.w - 1.0, 0.0);
        float dens = env * smoothstep(0.24, 0.82, fbm);
        float maxA = ${fg ? 'mix(0.14, 0.86, storm)' : '0.45'};
        float a = clamp(dens * vC.z * maxA, 0.0, maxA);
        float topGrad = smoothstep(-0.55, 0.65, q.y) * 0.65 + fbm * 0.35;
        vec3 lit = mix(uLit * 0.55, uShade * 0.55, storm);
        vec3 sh = mix(uShade * 0.65, uShade * 0.28, storm);
        vec3 col = mix(sh, lit, clamp(topGrad, 0.0, 1.0)) * vC.y;
        col += vec3(0.62, 0.78, 1.0) * flick * (0.35 + 0.65 * fbm);
        col += vec3(0.68, 0.8, 1.0) * uFlash * 0.35 * fbm;
        ${fg ? '' : 'col = mix(col, uHaze, smoothstep(60.0, 420.0, vDepth) * 0.72);'}
        gl_FragColor = vec4(col, a);
        ${GLSL_OUT}
      }`,
  });
}

// Brooding Dark Midnight-Charcoal FBM Thunderhead Anvil Shader (zero white cotton-balls; internal cyan-violet plasma only on charge/strike!)
function thunderheadMaterial(U, noiseTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNoise: { value: noiseTex },
      uLit: U.uCloudLit,
      uShade: U.uCloudShade,
      uFlash: U.uFlash,
      uTime: U.uTime,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aCloud;
      varying vec2 vUv; varying vec4 vC;
      void main(){
        vUv = uv;
        vC = aCloud;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNoise; uniform vec3 uLit; uniform vec3 uShade; uniform float uFlash; uniform float uTime;
      varying vec2 vUv; varying vec4 vC;
      void main(){
        // Strictly zero alpha on all 4 quad borders + organic FBM cumulonimbus crown & heavy storm base
        float boxFade = smoothstep(0.0, 0.24, vUv.x) * smoothstep(1.0, 0.76, vUv.x)
                      * smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.76, vUv.y);
        vec2 seedOff = vec2(fract(vC.x * 0.273), fract(vC.x * 0.619));
        vec2 wUv = vUv * vec2(1.45, 1.15) + seedOff + vec2(uTime * 0.015, 0.0);
        vec4 n1 = texture2D(uNoise, wUv);
        vec4 n2 = texture2D(uNoise, vUv * vec2(3.1, 2.4) - seedOff + vec2(-uTime * 0.022, (n1.r - 0.5) * 0.22));
        float fbm = n1.r * 0.48 + n1.g * 0.30 + n2.b * 0.22;

        // Asymmetric cumulonimbus profile: flatter heavy rain-base below, billowing FBM turrets above
        vec2 q = (vUv - 0.5) * vec2(2.0, 2.05);
        q.y += (fbm - 0.5) * (q.y > -0.1 ? 0.52 : 0.22);
        q.x += (n1.b - 0.5) * 0.34;
        float coreShape = 1.0 - smoothstep(0.18, 0.92, length(q * vec2(0.92, q.y > 0.0 ? 1.12 : 1.32)));
        float dens = smoothstep(0.24, 0.68, coreShape * 0.62 + fbm * 0.58) * boxFade;
        float a = clamp(dens * vC.z * 0.90, 0.0, 0.90);

        // Brooding midnight-slate / indigo thunderhead (~0.11..0.20 sRGB — blends naturally with storm sky, zero white puffs!)
        vec3 deepBelly = vec3(0.013, 0.022, 0.044);
        vec3 slateCrown = vec3(0.036, 0.056, 0.096);
        float crownMix = clamp(smoothstep(-0.38, 0.46, q.y) * 0.68 + fbm * 0.42, 0.0, 1.0);
        vec3 col = mix(deepBelly, slateCrown, crownMix);
        float topRim = smoothstep(0.16, 0.52, q.y) * (1.0 - dens * 0.58) * fbm;
        col += min(uLit * 0.16, vec3(0.065, 0.098, 0.155)) * topRim;

        // Internal branching storm-cyan / electric-indigo veins ONLY during charge/strike (vC.w > 0)
        float charge = clamp(vC.w, 0.0, 1.35);
        if (charge > 0.005) {
          vec2 cq = (q - vec2(0.0, -0.10)) * vec2(1.35, 1.85);
          float bellyFocus = exp(-dot(cq, cq) * 3.6);
          float vein = pow(smoothstep(0.46, 0.88, n2.g * 0.62 + n2.a * 0.38), 2.2);
          vec3 plasma = mix(vec3(0.12, 0.28, 0.72), vec3(0.32, 0.86, 1.0), vein);
          col += plasma * charge * (0.10 + 0.42 * vein) * bellyFocus;
        }
        col += vec3(0.16, 0.26, 0.44) * uFlash * 0.25 * fbm;

        gl_FragColor = vec4(col * vC.y, a);
        ${GLSL_OUT}
      }`,
  });
}

function lanternMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uK: U.uLanternK },
    vertexColors: true,
    vertexShader: /* glsl */ `
      attribute float aGlow;
      varying vec3 vL; varying vec3 vC; varying vec3 vVertCol; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        vL = position; vC = instanceColor; vVertCol = color; vG = aGlow;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal)); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uK;
      varying vec3 vL; varying vec3 vC; varying vec3 vVertCol; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        // Forged-brass hood/rim/bail (vertex color darker than 0.65)
        if (vVertCol.r < 0.68) {
          vec3 lDir = normalize(vec3(0.35, 0.78, 0.52));
          float lam = clamp(dot(n, lDir), 0.0, 1.0);
          float spec = pow(clamp(dot(reflect(-lDir, n), v), 0.0, 1.0), 28.0);
          vec3 brass = vVertCol * (0.45 + 0.85 * lam) + vec3(1.0, 0.88, 0.56) * spec * 0.72;
          gl_FragColor = vec4(brass, 1.0);
        } else {
          float a = atan(vL.z, vL.x);
          float cage = smoothstep(0.92, 0.985, abs(cos(a * 3.0)));
          float ribs = 0.86 + 0.14 * pow(abs(cos(a * 6.0)), 4.0);
          float flame = smoothstep(0.74, -0.60, vL.y);
          float core = exp(-vL.y * vL.y * 4.2);
          float flick = 0.88 + 0.12 * sin(uTime * 13.0 + vG * 40.0) * sin(uTime * 7.3 + vL.y);
          float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
          vec3 paper = vC * (0.48 + 1.22 * flame * flick) * ribs * (0.72 + 0.28 * ndv);
          paper += vec3(1.0, 0.90, 0.60) * (pow(flame, 2.0) * 0.45 + core * 0.42 * ndv) * flick;
          paper *= mix(1.0, uK, 0.55) * (1.0 + vG * 0.65);
          paper = mix(paper, vec3(0.28, 0.18, 0.08), cage * 0.78);
          gl_FragColor = vec4(paper, 1.0);
        }
        ${GLSL_OUT}
      }`,
  });
}

function gateMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexColors: true,
    vertexShader: /* glsl */ `
      attribute float aGlow;
      varying vec3 vL; varying vec3 vC; varying vec3 vVertCol; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        vL = position; vC = instanceColor; vVertCol = color; vG = aGlow;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal)); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vL; varying vec3 vC; varying vec3 vVertCol; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = atan(vL.y, vL.x);
        float cell = fract(a / 6.2831853 * 24.0);
        float rune = smoothstep(0.34, 0.12, abs(cell - 0.5));
        float chase = pow(0.5 + 0.5 * sin(a * 3.0 - uTime * 8.5 + floor(a / 6.2831853 * 24.0) * 0.45), 2.6);
        vec3 n = normalize(vN);
        vec3 v = normalize(vV);
        vec3 lDir = normalize(vec3(0.36, 0.76, 0.54));
        float lam = clamp(dot(n, lDir), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(-lDir, n), v), 0.0, 1.0), 36.0);
        float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 3.0);
        // Inner cyan crystal conduit vs outer burnished-brass astrolabe ring & gear teeth
        float isCyanRing = step(0.85, vVertCol.b) * step(vVertCol.r, 0.45);
        vec3 brassCol = vC * vVertCol * (0.38 + 0.88 * lam) + vec3(1.0, 0.92, 0.68) * spec * 1.15 + vec3(0.85, 0.68, 0.34) * fres * 0.35;
        vec3 runeGlow = mix(vec3(0.24, 0.94, 1.0), vec3(1.0, 0.86, 0.44), chase) * (1.25 + chase * 1.1);
        vec3 outerFinal = mix(brassCol, runeGlow, rune * vG * 0.58);
        vec3 cyanCore = mix(vec3(0.18, 0.88, 1.0), vec3(0.82, 0.98, 1.0), chase) * (0.85 + 1.15 * vG);
        vec3 col = mix(outerFinal, cyanCore, isCyanRing);
        gl_FragColor = vec4(col, 1.0);
        ${GLSL_OUT}
      }`,
  });
}

function lighthouseBeamMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv; vC = instanceColor;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vec3 invS2 = 1.0 / max(vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz)), vec3(1e-4));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * (normal * invS2)));
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      ${GLSL_NOISE}
      void main(){
        // Cone apex at vUv.y = 1.0, outer mouth at vUv.y = 0.0
        float along = 1.0 - vUv.y;
        float axialFade = smoothstep(0.0, 0.07, along) * pow(max(0.0, 1.0 - along), 1.35);
        float softCylinder = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.55);
        float dust = 0.74 + 0.26 * vnoise(vec2(along * 4.5 - uTime * 0.45, vUv.x * 6.0));
        float a = axialFade * softCylinder * dust * 0.52;
        gl_FragColor = vec4(vC * a * 1.45, a);
        #include <colorspace_fragment>
      }`,
  });
}

function vortexRibbonMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uBoost: { value: 0.35 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying vec2 vUv; varying float vA;
      void main(){
        vUv = uv; vA = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBoost;
      varying vec2 vUv; varying float vA;
      void main(){
        float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float tail = (1.0 - smoothstep(0.08, 1.0, vUv.x)) * smoothstep(0.0, 0.08, vUv.x);
        float shimmer = 0.78 + 0.22 * sin(vUv.x * 22.0 - uTime * 16.0);
        float a = across * across * tail * vA * shimmer * clamp(0.30 + uBoost * 0.55, 0.0, 0.85);
        vec3 col = mix(vec3(0.32, 0.88, 1.0), vec3(0.86, 0.96, 1.0), across);
        gl_FragColor = vec4(col * a, a);
        #include <colorspace_fragment>
      }`,
  });
}

function windTunnelMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv; vC = instanceColor;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying vec3 vC; varying vec3 vN; varying vec3 vV;
      void main(){
        float swirl = sin(vUv.x * 18.84955 + vUv.y * 8.0 - uTime * 9.5);
        float ribbon = smoothstep(0.35, 0.98, swirl);
        float ring = smoothstep(0.18, 0.0, abs(fract(vUv.y * 3.0 - uTime * 2.4) - 0.5));
        float endFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.76, 1.0, vUv.y));
        float rim = 1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float a = (0.14 + ribbon * 0.38 + ring * 0.34) * (0.35 + 0.65 * pow(rim, 1.4)) * endFade;
        gl_FragColor = vec4(vC * a * 1.35, a);
        #include <colorspace_fragment>
      }`,
  });
}

function moonbeamMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uColor: { value: new THREE.Color('#cfe8ff') },
      uStr: { value: 0.28 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vPh;
      void main(){
        vUv = uv;
        vPh = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.07;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uStr;
      varying vec2 vUv; varying float vPh;
      ${GLSL_NOISE}
      void main(){
        float x = vUv.x * 2.0 - 1.0;
        float fadeX = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        float core = exp(-x * x * 3.8) * fadeX;
        float rays = 0.62 + 0.38 * vnoise(vec2(x * 4.5 + vPh * 3.0, vUv.y * 1.8 - uTime * 0.14));
        float mote = 0.78 + 0.22 * sin(uTime * 0.9 + vPh * 11.0 + vUv.y * 5.0);
        float fadeY = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
        float a = core * rays * mote * fadeY * uStr;
        gl_FragColor = vec4(uColor * a, a);
        #include <colorspace_fragment>
      }`,
  });
}

function jetPlumeMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uBoost: { value: 0.25 },
      uCore: { value: new THREE.Color('#aef8ff') },
      uOuter: { value: new THREE.Color('#22d3ee') },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBoost; uniform vec3 uCore; uniform vec3 uOuter;
      varying vec2 vUv;
      void main(){
        // Cone tip at vUv.y = 1, nozzle mouth at vUv.y = 0
        float along = 1.0 - vUv.y;
        float flicker = 0.82 + 0.18 * sin(uTime * 38.0 + along * 14.0);
        float core = pow(along, 1.35) * flicker;
        vec3 col = mix(uOuter, uCore, smoothstep(0.25, 0.92, along));
        float a = core * clamp(0.28 + uBoost * 0.85, 0.0, 1.25) * smoothstep(0.0, 0.12, along);
        gl_FragColor = vec4(col * a * 1.45, a);
        #include <colorspace_fragment>
      }`,
  });
}

function thermalMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color('#4ff0d2') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC; varying float vPh;
      void main(){
        vUv = uv; vC = instanceColor; vPh = instanceMatrix[3].x * 0.37;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vC; varying float vPh;
      ${GLSL_NOISE}
      void main(){
        float x = vUv.x * 2.0 - 1.0;
        float wob = (vnoise(vec2(vUv.y * 4.0 - uTime * 0.9, vPh)) - 0.5) * 0.24;
        float edge = (1.0 - smoothstep(0.28, 0.78, abs(x + wob))) * smoothstep(0.0, 0.24, 1.0 - abs(x));
        float shimmer = 0.45 + 0.75 * vnoise(vec2(vUv.x * 7.0 + wob * 3.0, vUv.y * 9.0 - uTime * 2.4 + vPh));
        // Twin counter-twisting 3D bioluminescent helical updraft ribbons + rising firefly bokeh motes
        float sx1 = sin(vUv.y * 15.0 - uTime * 4.6 + vPh * 4.0) * 0.48;
        float sx2 = sin(vUv.y * 15.0 - uTime * 4.6 + vPh * 4.0 + 3.14159) * 0.48;
        float h1 = exp(-pow((x + wob * 0.5 - sx1) * 7.5, 2.0)) * (0.55 + 0.45 * cos(vUv.y * 15.0 - uTime * 4.6 + vPh * 4.0));
        float h2 = exp(-pow((x + wob * 0.5 - sx2) * 8.5, 2.0)) * (0.45 + 0.35 * cos(vUv.y * 15.0 - uTime * 4.6 + vPh * 4.0 + 3.14159));
        vec2 mGrid = vec2((x + wob * 0.4) * 5.0, vUv.y * 18.0 - uTime * 3.4 + vPh * 7.0);
        vec2 mCell = floor(mGrid);
        float mSeed = hash12(mCell);
        vec2 mOff = fract(mGrid) - 0.5 - (vec2(hash12(mCell + 3.1), hash12(mCell + 8.7)) - 0.5) * 0.48;
        float firefly = step(0.68, mSeed) * smoothstep(0.24, 0.03, length(mOff)) * (0.5 + 0.5 * sin(uTime * 6.0 + mSeed * 30.0));
        float fadeY = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.66, 1.0, vUv.y));
        float body = edge * shimmer * 0.05;
        float spiral = (h1 * 0.36 + h2 * 0.24 + firefly * 0.58) * edge;
        float a = (body + spiral * 0.52) * fadeY * vC.r;
        vec3 helixCol = mix(uColor, vec3(0.68, 1.0, 0.92), clamp(firefly + h1 * 0.5, 0.0, 1.0));
        vec3 col = helixCol * (body + spiral * 0.78) * fadeY * vC.r;
        gl_FragColor = vec4(col, a * 0.76);
        #include <colorspace_fragment>
      }`,
  });
}

function streakMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC;
      void main(){ vUv = uv; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0)); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC;
      void main(){
        float head = smoothstep(1.0, 0.86, vUv.x);
        float tail = pow(vUv.x, 1.6);
        float w = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float a = head * tail * w * w;
        gl_FragColor = vec4(vC * a, a);
        #include <colorspace_fragment>
      }`,
  });
}

function rainCurtainMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color('#16243a') } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vC; varying float vPh;
      void main(){ vUv = uv; vC = instanceColor; vPh = instanceMatrix[3].x * 0.21; gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0)); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vC; varying float vPh;
      ${GLSL_NOISE}
      void main(){
        float x = vUv.x * 2.0 - 1.0;
        float streaks = vnoise(vec2(vUv.x * 38.0 + vUv.y * 4.0, vUv.y * 2.0 + uTime * 5.0 + vPh));
        streaks = smoothstep(0.58, 0.96, streaks);
        float edgeX = smoothstep(0.0, 0.26, vUv.x) * smoothstep(1.0, 0.74, vUv.x);
        float body = (1.0 - smoothstep(0.32, 0.88, abs(x))) * edgeX * smoothstep(1.0, 0.82, vUv.y) * smoothstep(0.0, 0.45, vUv.y);
        float a = body * (0.06 + streaks * 0.22) * vC.r;
        gl_FragColor = vec4(uColor, a);
        ${GLSL_OUT}
      }`,
  });
}

function boltMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      attribute float aA; attribute float aE;
      varying float vA; varying float vE;
      void main(){ vA = aA; vE = aE; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vE;
      void main(){
        float e = abs(vE);
        float core = 1.0 - smoothstep(0.12, 0.3, e);
        float halo = 1.0 - smoothstep(0.2, 1.0, e);
        vec3 col = mix(vec3(0.42, 0.56, 0.98) * halo, vec3(1.0, 1.0, 1.0) * 1.25, core);
        float a = max(core, halo * 0.75);
        gl_FragColor = vec4(col * a * vA, a * vA);
        #include <colorspace_fragment>
      }`,
  });
}

function precipMaterial(U, tex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uScrollW: U.uScrollW,
      uMap: { value: tex },
      uSpan: { value: 40 },
      uYmin: { value: -8 },
      uYmax: { value: 12 },
      uPx: { value: 600 },
      uKind: { value: 0 }, // 0 snow, 1 rain, 2 embers, 3 fireflies, 4 leaves, 5 drizzle
      uColor: { value: new THREE.Color('#5efce8') },
      uAlpha: { value: 0 },
      uWind: { value: 0 },
      uAdd: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScrollW; uniform float uSpan; uniform float uYmin; uniform float uYmax; uniform float uPx; uniform float uKind; uniform float uWind;
      attribute float aSeed;
      varying float vA; varying float vSeed; varying float vRot;
      void main(){
        vec3 p = position;
        float hgt = uYmax - uYmin;
        float fall = uKind < 0.5 ? 0.9 + fract(aSeed * 7.0) * 0.8
                   : uKind < 1.5 ? 16.0 + fract(aSeed * 7.0) * 6.0
                   : uKind < 2.5 ? -1.2 - fract(aSeed * 7.0) * 1.6
                   : uKind < 3.5 ? -0.22
                   : uKind < 4.5 ? 0.7 + fract(aSeed * 7.0) * 0.6
                   : 7.0 + fract(aSeed * 7.0) * 3.0;
        float par = 1.0 + max(p.z, 0.0) * 0.06;
        float sway = sin(uTime * (0.6 + fract(aSeed * 3.0)) + aSeed * 30.0) * (uKind > 2.5 ? 1.2 : 0.6);
        p.x = mod(p.x - uScrollW * par - uTime * uWind * (1.0 + fract(aSeed * 5.0)) + sway + uSpan * 0.5, uSpan) - uSpan * 0.5;
        p.y = uYmin + mod(p.y - uYmin - uTime * fall, hgt);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float sz = uKind < 0.5 ? 0.09 + fract(aSeed * 13.0) * 0.11
                 : uKind < 1.5 ? 0.22
                 : uKind < 2.5 ? 0.05 + fract(aSeed * 13.0) * 0.07
                 : uKind < 3.5 ? 0.07 + fract(aSeed * 13.0) * 0.08
                 : uKind < 4.5 ? 0.14 + fract(aSeed * 13.0) * 0.1
                 : 0.16;
        gl_PointSize = sz * uPx / max(d, 0.5);
        float tw = uKind > 1.5 && uKind < 3.5 ? 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 50.0), 2.0) : 1.0;
        vA = (0.45 + 0.55 * fract(aSeed * 3.7)) * tw * smoothstep(1.5, 4.0, d) * (1.0 - smoothstep(40.0, 80.0, d));
        vSeed = aSeed;
        vRot = uTime * (1.0 + fract(aSeed * 9.0) * 2.0) + aSeed * 20.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uAlpha; uniform float uKind; uniform float uAdd;
      varying float vA; varying float vSeed; varying float vRot;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float a;
        vec3 col = uColor;
        if ((uKind > 0.5 && uKind < 1.5) || uKind > 4.5) {
          vec2 r = vec2(q.x + q.y * 0.18, q.y);
          a = (1.0 - smoothstep(0.0, 0.05, abs(r.x))) * (1.0 - smoothstep(0.2, 0.5, abs(r.y)));
        } else if (uKind > 3.5) {
          float c = cos(vRot), s = sin(vRot);
          vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          a = 1.0 - smoothstep(0.2, 0.26, length(r * vec2(1.0, 2.2)));
          col = mix(vec3(0.95, 0.62, 0.18), vec3(0.62, 0.78, 0.22), fract(vSeed * 11.0));
        } else {
          a = texture2D(uMap, gl_PointCoord).a;
          if (uKind > 1.5 && uKind < 2.5) col = mix(uColor, vec3(1.0, 0.85, 0.4), fract(vSeed * 11.0));
          else if (uKind > 2.5 && uKind < 3.5) col = mix(uColor, vec3(0.26, 0.96, 0.67), fract(vSeed * 9.0));
        }
        float k = a * vA * uAlpha;
        gl_FragColor = vec4(col * k, k * (1.0 - uAdd));
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------------- GlideRenderer
const EMPTY = [];

export class GlideRenderer {
  constructor(webglRenderer, opts = {}) {
    const { softDotTex = null, skinId = 'default_amphibian', era = 'reboot' } = opts || {};
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this._ownSoftDot = !softDotTex;
    this.starTex = makeStarTex();
    this.width = 390;
    this.height = 620;
    this._dpr = 1;
    this.era = era === 'original' ? 'original' : 'reboot';
    this.skinId = 'default_amphibian';
    this.exposure = 1.02;
    this._kx = 1;
    this._ky = 1;

    const U = (this.U = {
      uTime: { value: 0 },
      uScrollW: { value: 0 },
      uSeaY: { value: -5 },
      uHaze: { value: new THREE.Color('#142642') },
      uSkyTop: { value: new THREE.Color() },
      uSkyMid: { value: new THREE.Color() },
      uSkyHor: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0.22, 0.29, -1).normalize() },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
      uCloudRim: { value: new THREE.Color() },
      uFlash: { value: 0 },
      uLanternK: { value: 1 },
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#050914');
    this.scene.fog = new THREE.Fog(U.uHaze.value, 60, 520);

    this.camera = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 900);
    this.camera.position.set(0, 0, CAM_Z);
    this.camera.rotation.x = PITCH;
    this.mapCam = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 900);
    this.mapCam.position.set(0, 0, CAM_Z);
    this.mapCam.rotation.x = PITCH;

    // Preallocated scratch vectors & state (zero per-frame heap allocations)
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._va = new THREE.Vector3();
    this._vb = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this._c3 = new THREE.Color();
    this._colorCache = new Map();
    this._rgb = [0, 0, 0];
    this._lastStageT = 0;
    this._stageRef = null;
    this._themeKey = '';
    this._lastTime = null;
    this._glowColor = new THREE.Color('#5efce8');
    this._glowHex = '';
    this._summitHex = '';
    this._cine = 0;
    this._intro = 0;
    this._camFX = 0;
    this._camFY = 0;
    this._seaW = -5;
    this._flash = 0;
    this._ambFlashT = 3;
    this._sq = 0;
    this._sqV = 0;
    this._cheer = 0;
    this._flapAnim = 0;
    this._lastFlaps = 0;
    this._lastCatches = 0;
    this._lastHits = 0;
    this._lastSkims = 0;
    this._lastVfxId = 0;
    this._legPh = 0;
    this._streakAcc = 0;
    this._moteAcc = 0;
    this._glbJetGlowMats = [];
    this._poseState = {
      time: 0,
      vx: 0,
      vy: 0,
      grounded: false,
      inElevator: false,
      shooting: 0,
      hitTimer: 0,
      drowning: 0,
      celebrating: 0,
      facing: 1,
      lookYaw: 0,
    };

    this._lanternCols = LANTERN_HEX.map((h) => new THREE.Color(h));
    this._kiteCols = KITE_HEX.map((h) => new THREE.Color(h));
    this._gold = new THREE.Color(GOLD_HEX);
    this._white = new THREE.Color(1, 1, 1);
    this._birdCol = new THREE.Color('#8899b0');

    this._buildLights();
    this._buildEnvMap();
    this._buildSky();
    this._buildSea();
    this._buildScenery();
    this._buildClouds();
    this._buildGlider();
    this._buildEntities();
    this._buildTowers();
    this._buildOverlay();

    this.setSkin(skinId);
    this.setEra(this.era);
    this.resize(390, 620, 1);
  }

  // ------------------------------------------------------------------ mapping
  _toWorld(px, py, z, out) {
    const cam = this.mapCam;
    out
      .set(((px * this._kx) / this.width) * 2 - 1, 1 - ((py * this._ky) / this.height) * 2, 0.5)
      .unproject(cam);
    const o = cam.position;
    const dx = out.x - o.x;
    const dy = out.y - o.y;
    const dz = out.z - o.z;
    const t = (z - o.z) / dz;
    return out.set(o.x + dx * t, o.y + dy * t, z);
  }

  _pxw(z) {
    return (2 * Math.tan(FOV * 0.5 * DEG) * (CAM_Z - z)) / this.height;
  }

  _halfW(z) {
    return (CAM_Z - z) * Math.tan(FOV * 0.5 * DEG) * this.camera.aspect;
  }

  _elevY(z, elev) {
    return Math.tan(elev) * (CAM_Z - z);
  }

  resize(width, height, dpr = 1) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this._dpr = Number(dpr) || 1;
    const aspect = Math.max(0.3, width / height);
    for (const cam of [this.camera, this.mapCam]) {
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
    }
    const o = this.oCam;
    o.left = 0;
    o.right = width;
    o.top = 0;
    o.bottom = -height;
    o.updateProjectionMatrix();
    for (const layer of this.layers) {
      for (const it of layer.items) {
        it.span = 2 * this._halfW(it.z) + layer.margin + Math.abs(it.z) * 0.15;
      }
    }
    const sw = 2 * this._halfW(-10) + 8;
    this.precipMat.uniforms.uSpan.value = sw;
    this.vignette.scale.set(width, height, 1);
    this.vignette.position.set(width / 2, -height / 2, -5);
    this._hudDrawn = null;
    this._cardForW = 0;
  }

  /**
   * Applies any of the 8 `POGO_SKINS` palettes to the real 33-bone `PogoRig` pilot + HUD marker.
   */
  setSkin(skinId) {
    const skin = SKIN_MAP.get(skinId) || POGO_SKINS[0];
    this.skinId = skin.id;
    if (this.pogoRig) {
      this.pogoRig.setSkin(skin.id);
      if (this.pogoRig.bones?.blaster) {
        this.pogoRig.bones.blaster.visible = false;
      }
    }
    if (this.pennantMat) {
      this.pennantMat.color.set(skin.harnessColor).lerp(this._c.set(skin.accentColor), 0.38);
    }
    if (this.jetPlumeMat) {
      this.jetPlumeMat.uniforms.uOuter.value.set(skin.accentColor || '#22d3ee');
    }
    this._redrawHudMarker(skin);
  }

  /**
   * Switches material gloss/roughness & exposure balance between `'reboot'` and `'original'`.
   */
  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    this.era = next;
    const isOrig = next === 'original';
    if (this.sailMat) {
      this.sailMat.roughness = isOrig ? 0.34 : 0.64;
      this.sailMat.metalness = isOrig ? 0.08 : 0.02;
    }
    if (this.pogoRig?.setEraStyle) {
      this.pogoRig.setEraStyle(next);
    }
    this.setSkin(this.skinId);
    if (this._themeKey) {
      this._applyTheme(this._themeKey);
    }
  }

  // ------------------------------------------------------------------ build: lights, IBL, FBM storm sky, 3D Gerstner ocean
  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#7ba4d8', '#081224', 1.35);
    this.sunLight = new THREE.DirectionalLight('#dbeeff', 2.25);
    this.sunLight.position.set(9, 14, 10);
    this.fill = new THREE.DirectionalLight('#93c5fd', 0.58);
    this.fill.position.set(-6, 5, 12);
    this.scene.add(this.hemi, this.sunLight, this.fill);
  }

  _buildEnvMap() {
    const gl = this.gl;
    if (!gl) return;
    const prevRT = gl.getRenderTarget ? gl.getRenderTarget() : null;
    const prevAuto = gl.autoClear;
    const prevTM = gl.toneMapping;
    const prevScTest = gl.getScissorTest ? gl.getScissorTest() : false;
    const prevVP = gl.getViewport && THREE.Vector4 ? gl.getViewport(new THREE.Vector4()) : null;
    const prevSC = gl.getScissor && THREE.Vector4 ? gl.getScissor(new THREE.Vector4()) : null;
    try {
      const envScene = new THREE.Scene();
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(16, 24, 14),
        new THREE.MeshBasicMaterial({ color: '#112240', side: THREE.BackSide })
      );
      envScene.add(dome);
      const addPatch = (x, y, z, r, hex, mul) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(r, 10, 8),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(mul) })
        );
        m.position.set(x, y, z);
        envScene.add(m);
      };
      addPatch(8, 11, 6, 2.8, '#e8f4ff', 3.4);
      addPatch(-7, 6, 8, 2.2, '#5ba8e8', 1.5);
      addPatch(0, -6, 4, 3.5, '#08182e', 1.1);
      const pmrem = new THREE.PMREMGenerator(gl);
      this._envRT = pmrem.fromScene(envScene, 0.035);
      pmrem.dispose();
      envScene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this.scene.environment = this._envRT.texture;
      this.scene.environmentIntensity = 0.58;
    } catch (_) {
      this._envRT = null;
    } finally {
      if (gl.setRenderTarget) gl.setRenderTarget(prevRT);
      if (prevVP && gl.setViewport) gl.setViewport(prevVP);
      if (prevSC && gl.setScissor) gl.setScissor(prevSC);
      if (gl.setScissorTest) gl.setScissorTest(prevScTest);
      gl.autoClear = prevAuto;
      gl.toneMapping = prevTM;
    }
  }

  _buildSky() {
    const U = this.U;
    this.stormNoiseTex = createTileableStormNoiseTex(256);
    this.skyPanoramaTex = createStormCumulonimbusPanoramaTex(1024, 512);
    this.moonDetailTex = createCrateredMoonTex(512);
    const geo = new THREE.PlaneGeometry(1650, 680);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uNoiseTex: { value: this.stormNoiseTex },
        uPanoramaTex: { value: this.skyPanoramaTex },
        uMoonTex: { value: this.moonDetailTex },
        uTop: U.uSkyTop,
        uMid: U.uSkyMid,
        uHor: U.uSkyHor,
        uHaze: U.uHaze,
        uCloudLit: U.uCloudLit,
        uCloudShade: U.uCloudShade,
        uCloudRim: U.uCloudRim,
        uSunCol: U.uSunCol,
        uSunDir: U.uSunDir,
        uSunSize: { value: 0.058 },
        uStars: { value: 0.72 },
        uMoon: { value: 1 },
        uMoonFull: { value: 1 },
        uAurora: { value: 0 },
        uRays: { value: 0.32 },
        uCirrus: { value: 0.38 },
        uRainbow: { value: 0 },
        uDisc: { value: 1 },
        uFlash: U.uFlash,
        uScrollW: U.uScrollW,
      },
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform sampler2D uNoiseTex; uniform sampler2D uPanoramaTex; uniform sampler2D uMoonTex;
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uHaze;
        uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform vec3 uCloudRim;
        uniform vec3 uSunCol; uniform vec3 uSunDir;
        uniform float uSunSize; uniform float uStars; uniform float uMoon; uniform float uMoonFull; uniform float uAurora;
        uniform float uRays; uniform float uCirrus; uniform float uRainbow;
        uniform float uFlash; uniform float uScrollW; uniform float uDisc;
        varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          vec3 d = normalize(vW - cameraPosition);
          float e = d.y;
          float uAz = atan(d.x, -d.z) * 0.318309886 + uScrollW * 0.00024;
          vec3 horizonMistCol = mix(uHor, uHaze, 0.52) * 0.76;

          // 1. Deep midnight-indigo zenith -> storm-slate mid -> locked horizon sea-fog
          vec3 col = mix(horizonMistCol, uMid * 0.76, smoothstep(0.005, 0.22, e));
          col = mix(col, uTop * 0.78, smoothstep(0.18, 0.72, e));

          // 2. Crisp circular pinpoint stars in clear upper-sky rifts
          vec3 starContrib = vec3(0.0);
          if (uStars > 0.0 && e > 0.04) {
            vec2 sp = vec2(atan(d.x, -d.z) * 165.0, e * 160.0);
            vec2 gi = floor(sp);
            float h = hash12(gi);
            if (h > 0.952) {
              vec2 f = fract(sp) - 0.5 - (vec2(hash12(gi + 7.1), hash12(gi + 3.3)) - 0.5) * 0.58;
              float st = smoothstep(0.105, 0.012, length(f)) * (0.58 + 0.42 * sin(uTime * (1.2 + h * 3.5) + h * 70.0));
              vec3 stTint = mix(vec3(0.74, 0.88, 1.0), vec3(1.0, 0.94, 0.84), fract(h * 17.3));
              starContrib = stTint * st * uStars * smoothstep(0.04, 0.24, e) * 0.90;
            }
          }

          // 3. Boreal Aurora Curtains
          if (uAurora > 0.01 && e > 0.03) {
            float auWave = sin(uAz * 18.84955 + uTime * 0.24) * 0.035;
            vec4 auN1 = texture2D(uNoiseTex, vec2(uAz * 2.5 + uTime * 0.008, e * 0.65 + auWave));
            vec4 auN2 = texture2D(uNoiseTex, vec2(uAz * 5.0 - uTime * 0.011, e * 0.42));
            float curtain = smoothstep(0.46, 0.85, auN1.g * 0.68 + auN2.b * 0.32);
            float vBand = smoothstep(0.04, 0.22, e) * exp(-max(0.0, e - 0.22) * 4.4);
            vec3 auCol = mix(vec3(0.04, 0.56, 0.38), vec3(0.20, 0.16, 0.56), smoothstep(0.14, 0.48, e));
            col += auCol * curtain * vBand * uAurora * 0.72;
          }

          // 4. Detailed 512x512 Cratered Lunar Mare Moon + Localized Silver-Blue Corona
          vec3 mFwd = normalize(uSunDir);
          vec3 mRight = normalize(cross(vec3(0.0, 1.0, 0.0), mFwd));
          vec3 mUp = cross(mFwd, mRight);
          float mCos = dot(d, mFwd);
          float mRad = max(0.028, uSunSize * 1.08);
          vec2 mUv = vec2(dot(d, mRight), dot(d, mUp)) / mRad;
          float rNorm = mCos > 0.0 ? length(mUv) : 99.0;

          float cInner = exp(-max(0.0, rNorm - 0.94) * 3.8);
          float cMid = exp(-rNorm * 0.95);
          float cOuter = exp(-rNorm * 0.36);
          col += starContrib * (1.0 - clamp(cMid * 2.1, 0.0, 1.0));
          col += uSunCol * (cInner * 0.22 + cMid * 0.085 + cOuter * 0.025) * uDisc;

          if (rNorm < 1.03 && uDisc > 0.05) {
            if (uMoon > 0.5) {
              vec2 moonSampleUv = vec2(mUv.x * 0.5 + 0.5, mUv.y * 0.5 + 0.5);
              vec4 mSample = texture2D(uMoonTex, moonSampleUv);
              vec3 moonSurf = mSample.rgb * mix(vec3(1.0), uSunCol, 0.45) * 0.98;
              if (uMoonFull < 0.5) {
                float cres = smoothstep(-0.15, 0.45, -mUv.x + mUv.y * 0.35);
                moonSurf *= 0.12 + 0.88 * cres;
              }
              col = mix(col, moonSurf * uDisc, mSample.a);
            } else {
              float discMask = 1.0 - smoothstep(0.95, 1.015, rNorm);
              col = mix(col, uSunCol * 2.1 + vec3(0.42), discMask * uDisc);
            }
          }

          // 5. Crisp 1024x512 Ridged/Worley Cumulonimbus Storm-Cloud Dome + Delicate Feathery Wisps
          if (e > -0.03) {
            float vCoord = clamp((e + 0.02) / 0.72, 0.0, 1.0);
            float vertBand = smoothstep(-0.025, 0.035, e) * (1.0 - smoothstep(0.66, 0.96, e));
            // Wide perspective-stabilized sky coordinate (zero zenith vertical stretch & zero 1px seam!)
            float uSky = (d.x / max(0.46, -d.z)) * 0.28 + uScrollW * 0.00024 + 0.31;
            vec2 pUv1 = vec2(uSky * 1.5 + uTime * 0.0024, vCoord);
            vec2 pUv2 = vec2(uSky * 3.0 - uTime * 0.0042 + 0.37, clamp(vCoord * 1.12 + 0.03, 0.0, 1.0));
            vec4 pan1 = texture2D(uPanoramaTex, pUv1);
            vec4 pan2 = texture2D(uPanoramaTex, pUv2);
            vec4 micro = texture2D(uNoiseTex, vec2(uSky * 7.0 + uTime * 0.007, e * 9.5));

            // Heavy cauliflower cumulonimbus parts with irregular FBM edges around the moon (zero circular halo or cutout!)
            float moonPocket = smoothstep(0.75, 2.75, rNorm + (pan1.r - 0.45) * 1.05 + (pan2.r - 0.5) * 0.45);
            float heavyRaw = (pan1.r * 0.56 + pan2.r * 0.30 + micro.g * 0.14) * mix(0.24, 1.0, moonPocket);
            float cloudDensity = pow(smoothstep(0.26, 0.84, heavyRaw), 1.15) * vertBand;

            // Delicate, feathery translucent cloud filaments drifting across the sky & lower-right lunar face
            float wispMask = pan1.b * 0.54 + pan2.b * 0.46;
            float lunarVeilBias = rNorm < 1.65
              ? smoothstep(-0.40, 0.58, mUv.x * 0.74 - mUv.y * 0.67) * 0.58 + 0.10
              : 0.34;
            float fineWisps = smoothstep(0.36, 0.90, wispMask + (micro.b - 0.5) * 0.18) * lunarVeilBias * vertBand;

            // Painterly 3D cumulonimbus crown & silver-blue Mie rim lighting (zero contour-ring step outline!)
            float bakedLit = clamp(pan1.g * 0.62 + pan2.g * 0.38, 0.0, 1.0);
            float nearMoonBoost = exp(-rNorm * 0.45) * 1.65 + exp(-rNorm * 0.16) * 0.32 + 0.14;
            float crownExposure = smoothstep(0.32, 0.86, bakedLit) * (1.0 - cloudDensity * 0.42);
            float softEdgeScatter = cloudDensity * (1.0 - cloudDensity) * 2.2 * smoothstep(0.38, 0.80, bakedLit);
            float silverRim = (crownExposure * 0.65 + softEdgeScatter * 0.75) * nearMoonBoost * uDisc;

            vec3 deepBelly = uCloudShade * 0.42;
            vec3 litCrown = mix(uCloudShade * 0.92, uCloudLit, 0.56);
            vec3 cBody = mix(deepBelly, litCrown, smoothstep(0.24, 0.84, bakedLit) * (1.0 - cloudDensity * 0.32));
            cBody += uCloudRim * silverRim * 0.62;
            cBody += vec3(0.55, 0.72, 1.0) * uFlash * 0.44 * (1.0 - cloudDensity * 0.42);

            // Subtle storm rain-virga curtains under distant cloud bases
            float virga = pan1.a * (1.0 - smoothstep(0.01, 0.18, e)) * (0.4 + 0.6 * moonPocket);
            col = mix(col, mix(horizonMistCol, uCloudShade * 0.68, 0.5), virga * 0.32);

            float cloudAlpha = clamp(cloudDensity * 0.94, 0.0, 0.95);
            col = mix(col, cBody, cloudAlpha);

            // Feathery translucent wisps softly veil the lower-right moon with silver-rimmed scattering
            vec3 wispCol = mix(uCloudShade * 0.62, uCloudRim * 0.78, clamp(exp(-rNorm * 0.80) * 0.72 + bakedLit * 0.25, 0.0, 1.0));
            col = mix(col, wispCol, clamp(fineWisps * 0.50 * (1.0 - cloudAlpha * 0.72), 0.0, 0.46));
          }

          if (uRainbow > 0.0) {
            vec3 rc = normalize(vec3(0.55, -0.32, -1.0));
            float rr = acos(clamp(dot(d, rc), -1.0, 1.0));
            float band = (rr - 0.62) / 0.05;
            vec3 rb = clamp(vec3(1.0 - abs(band - 0.85) * 1.6, 1.0 - abs(band - 0.15) * 1.6, 1.0 - abs(band + 0.65) * 1.6), 0.0, 1.0);
            float ra2 = smoothstep(1.4, 0.4, abs(band)) * smoothstep(0.0, 0.08, e);
            col = mix(col, col + rb * 0.45, ra2 * uRainbow);
          }

          // Locked atmospheric horizon sea-fog (matches seaMat horizon 1:1 — ZERO hard polygon horizon line!)
          float seaHaze = 1.0 - smoothstep(0.0, 0.052, max(0.0, e));
          col = mix(col, horizonMistCol, seaHaze * 0.96);
          col += vec3(0.58, 0.74, 1.0) * uFlash * 0.28 * exp(-max(e, 0.0) * 4.5);
          gl_FragColor = vec4(col, 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.position.set(0, 120, SKY_Z);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
  }

  _buildSea() {
    const U = this.U;
    this.waterNormalTex = createWaterNormalTex(256);
    // 3D Gerstner-displaced ocean grid (`88x68` = 11,968 tris reaching z = +26 under camera) + deep horizon skirt reaching SKY_Z
    const nearGeo = new THREE.PlaneGeometry(420, 232, 88, 68);
    nearGeo.rotateX(-Math.PI / 2);
    nearGeo.translate(0, 0, -90);
    const farGeo = new THREE.PlaneGeometry(2400, 310, 16, 8);
    farGeo.rotateX(-Math.PI / 2);
    farGeo.translate(0, 0, -358);
    const geo = mergeGeometries([nearGeo, farGeo], false);
    nearGeo.dispose();
    farGeo.dispose();

    this.seaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uNormalMap: { value: this.waterNormalTex },
        uSkyTop: U.uSkyTop,
        uSkyHor: U.uSkyHor,
        uSunCol: U.uSunCol,
        uSunDir: U.uSunDir,
        uHaze: U.uHaze,
        uFlash: U.uFlash,
        uDeep: { value: new THREE.Color('#040a14') },
        uFar: { value: new THREE.Color('#0c3850') },
        uGlint: { value: 1 },
        uChop: { value: 0.9 },
        uFoam: { value: 0.45 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform float uChop;
        varying vec3 vW; varying vec3 vSwellN; varying float vHeight; varying float vDist;
        vec3 stormWaves(vec2 p, float t) {
          float h = 0.0; float dx = 0.0; float dz = 0.0;
          vec2 d0 = normalize(vec2(0.32, 0.95));
          vec2 d1 = normalize(vec2(-0.46, 0.89));
          vec2 d2 = normalize(vec2(0.78, 0.62));
          vec2 d3 = normalize(vec2(-0.84, 0.54));

          float ph0 = dot(d0, p) * 0.28 + t * 1.45;
          h += sin(ph0) * 0.34;
          float c0 = cos(ph0) * 0.34 * 0.28;
          dx += c0 * d0.x; dz += c0 * d0.y;

          float ph1 = dot(d1, p) * 0.52 + t * 1.95;
          h += sin(ph1) * 0.19;
          float c1 = cos(ph1) * 0.19 * 0.52;
          dx += c1 * d1.x; dz += c1 * d1.y;

          float ph2 = dot(d2, p) * 0.96 + t * 2.65;
          h += sin(ph2) * 0.095;
          float c2 = cos(ph2) * 0.095 * 0.96;
          dx += c2 * d2.x; dz += c2 * d2.y;

          float ph3 = dot(d3, p) * 1.68 + t * 3.3;
          h += sin(ph3) * 0.048;
          float c3 = cos(ph3) * 0.048 * 1.68;
          dx += c3 * d3.x; dz += c3 * d3.y;

          return vec3(h, dx, dz);
        }
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          float distAtten = 1.0 - smoothstep(140.0, 235.0, -w.z);
          vec2 sp = vec2(w.x + uScrollW, w.z);
          vec3 sw = stormWaves(sp, uTime) * uChop * distAtten;
          w.y += sw.x;
          vHeight = sw.x;
          vSwellN = normalize(vec3(-sw.y, 1.0, -sw.z));
          vW = w.xyz;
          vec4 mv = viewMatrix * w;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform sampler2D uNormalMap;
        uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunCol; uniform vec3 uSunDir;
        uniform vec3 uHaze; uniform float uFlash; uniform vec3 uDeep; uniform vec3 uFar;
        uniform float uGlint; uniform float uChop; uniform float uFoam;
        varying vec3 vW; varying vec3 vSwellN; varying float vHeight; varying float vDist;
        ${GLSL_NOISE}
        vec3 sampleN(vec2 uv) { return texture2D(uNormalMap, uv).xyz * 2.0 - 1.0; }
        void main(){
          vec2 sp = vec2(vW.x + uScrollW, vW.z);
          // 4-octave counter-scrolling periodic wave normal layers (zero blotches, zero pixel dots!)
          vec3 n1 = sampleN(sp * 0.085 + vec2(uTime * 0.028, uTime * 0.019));
          vec3 n2 = sampleN(sp * 0.19 + vec2(-uTime * 0.024, uTime * 0.033));
          vec3 n3 = sampleN(sp * 0.42 + vec2(uTime * 0.042, -uTime * 0.028));
          vec3 n4 = sampleN(sp * 0.88 + vec2(-uTime * 0.056, -uTime * 0.046));
          vec3 rip = n1 + n2 * 0.82 + n3 * 0.58 + n4 * 0.35;

          float detail = mix(1.0, 0.18, smoothstep(18.0, 175.0, vDist));
          vec3 n = normalize(vSwellN + vec3(rip.x * 0.62 * uChop * detail, 0.0, rip.y * 0.62 * uChop * detail));
          vec3 v = normalize(cameraPosition - vW);

          // Schlick Fresnel (F0 = 0.02)
          float cosT = clamp(dot(n, v), 0.0, 1.0);
          float fres = clamp(0.02 + 0.98 * pow(1.0 - cosT, 5.0), 0.0, 0.88);

          vec3 reflDir = reflect(-v, n);
          vec3 skyRefl = mix(uSkyHor * 0.82, uSkyTop * 0.75, smoothstep(-0.02, 0.38, reflDir.y));

          // Deep #040a14 midnight troughs + cool slate-indigo storm crest scatter (zero tropical teal!)
          float crest = clamp(vHeight * 1.85 + 0.34, 0.0, 1.0);
          vec3 deepTrough = uDeep * 0.65;
          vec3 shallowCrest = mix(uFar, vec3(0.08, 0.17, 0.29), 0.48);
          vec3 body = mix(deepTrough, shallowCrest, crest * 0.56);
          float sss = pow(clamp(dot(v, -uSunDir) * 0.5 + 0.5, 0.0, 1.0), 3.2) * crest;
          body += shallowCrest * sss * 0.42;

          vec3 col = mix(body, skyRefl, fres * 0.72);

          // Crisp broken Blinn-Phong silver moonlit wave facets along the lunar glitter path (zero sheet washout!)
          vec3 hVec = normalize(normalize(uSunDir) + v);
          float ndh = max(dot(n, hVec), 0.0);
          float facetBreak = smoothstep(0.02, 0.32, length(rip.xy));
          float spec = (pow(ndh, 64.0) * 0.68 + pow(ndh, 195.0) * 1.45) * (0.45 + 0.55 * facetBreak);
          col += uSunCol * spec * uGlint;

          // Lacy wind-blown whitecap spray ONLY on steep breaking wave crests (zero near-camera blotches)
          float nFoam = vnoise(sp * 3.8 + vec2(uTime * 0.42, -uTime * 0.28)) * 0.62
                      + vnoise(sp * 8.6 - vec2(uTime * 0.65, uTime * 0.22)) * 0.38;
          float nearFade = smoothstep(10.0, 22.0, vDist);
          float whitecap = smoothstep(0.24, 0.48, vHeight) * smoothstep(0.64, 0.88, nFoam) * detail * nearFade;
          col = mix(col, vec3(0.82, 0.90, 0.98), clamp(whitecap * uFoam * 1.15, 0.0, 0.68));

          col += vec3(0.55, 0.72, 0.96) * uFlash * 0.22;
          // Exact 1:1 horizon sea-fog lock with skyMat (horizonMistCol) so there is ZERO 1px polygon horizon line!
          vec3 horizonMistCol = mix(uSkyHor, uHaze, 0.52) * 0.76;
          col = mix(col, horizonMistCol, smoothstep(130.0, 365.0, vDist));
          gl_FragColor = vec4(col, 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.seaMat.depthWrite = true;
    this.sea = new THREE.Mesh(geo, this.seaMat);
    this.sea.frustumCulled = false;
    this.sea.renderOrder = -9;
    this.scene.add(this.sea);
  }

  // ------------------------------------------------------------------ build: horizon scenery
  _buildScenery() {
    const rng = mulberry32(5150);
    this.layers = [];
    const addLayer = (mesh, items, margin, opts = {}) => {
      mesh.count = items.length;
      const layer = { mesh, items, margin, ...opts };
      this.layers.push(layer);
      this.scene.add(mesh);
      return layer;
    };
    // Shared craggy FBM + Worley + Sobel-normal wet volcanic basalt PBR maps (zero grid lines, zero grey rim halo!)
    const bm = createCraggyBasaltMaps(256);
    this.basaltTex = bm.map;
    this.basaltNormalTex = bm.normalMap;
    this.basaltBumpTex = bm.roughnessMap;
    const isleMat = (rough, nScale = 1.45, wetKey = '') => {
      const m = new THREE.MeshStandardMaterial({
        map: this.basaltTex,
        normalMap: this.basaltNormalTex,
        normalScale: new THREE.Vector2(nScale, nScale),
        roughnessMap: this.basaltBumpTex,
        vertexColors: true,
        roughness: rough,
        metalness: 0.06,
        flatShading: false,
      });
      return wetKey ? patchWetRock(m, this.U, wetKey) : m;
    };
    {
      const rawFarMat = new THREE.MeshStandardMaterial({
        map: this.basaltTex,
        normalMap: this.basaltNormalTex,
        normalScale: new THREE.Vector2(1.35, 1.35),
        roughnessMap: this.basaltBumpTex,
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.06,
        flatShading: false,
      });
      const mat = patchArchipelagoFog(rawFarMat, this.U, { distStart: 105, distEnd: 335, maxFog: 0.90, key: 'far_arch_fog' });
      const geo = buildArchipelagoRidge(rng, { segX: 34, segZ: 14 });
      const N = 16;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        // 2 parallax coastal headland tiers: mid-far craggy ridges (z = -148..-218) + deep horizon massifs (z = -225..-335)
        const deep = i >= 8;
        const slot = i % 8;
        const z = deep ? lerp(-225, -335, slot / 7 + (rng() - 0.5) * 0.08) : lerp(-148, -218, slot / 7 + (rng() - 0.5) * 0.08);
        items.push({
          u: (slot + rng() * 0.65) / 8,
          z,
          sx: deep ? lerp(20, 36, rng()) : lerp(13, 24, rng()),
          sy: deep ? lerp(11, 20, rng()) : lerp(7.5, 14, rng()),
          ry: (rng() - 0.5) * 0.36 + (i % 2 === 0 ? 0 : Math.PI),
          shade: deep ? lerp(0.72, 0.92, rng()) : lerp(0.88, 1.08, rng()),
        });
      }
      this.farIsles = addLayer(mesh, items, 95, { kind: 'far' });
    }
    {
      const rawMidMat = new THREE.MeshStandardMaterial({
        map: this.basaltTex,
        normalMap: this.basaltNormalTex,
        normalScale: new THREE.Vector2(1.75, 1.75),
        roughnessMap: this.basaltBumpTex,
        vertexColors: true,
        roughness: 0.76,
        metalness: 0.06,
        flatShading: false,
      });
      const mat = patchArchipelagoFog(rawMidMat, this.U, { distStart: 78, distEnd: 245, maxFog: 0.72, key: 'mid_arch_fog' });
      const geo = buildIsland(rng, { peaks: 3, flat: 0.18, radSeg: 28, hSeg: 8 });
      const N = 11;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const spire = i % 3 === 0;
        items.push({
          u: (i + rng() * 0.62) / N,
          z: lerp(-76, -142, i / Math.max(1, N - 1) + (rng() - 0.5) * 0.1),
          sx: spire ? lerp(3.4, 5.8, rng()) : lerp(7.5, 15.0, rng()),
          sy: spire ? lerp(8.5, 15.5, rng()) : lerp(4.2, 8.8, rng()),
          ry: rng() * TAU,
          shade: lerp(0.92, 1.12, rng()),
        });
      }
      this.midIsles = addLayer(mesh, items, 48, { kind: 'mid' });
    }
    // Colossal Mid-Ground & Horizon 3D Stone Nebulus Watchtowers with Blazing Golden Crowns
    {
      const mat = patchWatchtower(
        new THREE.MeshStandardMaterial({
          map: this.basaltTex,
          normalMap: this.basaltNormalTex,
          normalScale: new THREE.Vector2(1.9, 1.9),
          roughnessMap: this.basaltBumpTex,
          vertexColors: true,
          roughness: 0.72,
          metalness: 0.08,
          flatShading: false,
        }),
        this.U
      );
      const N = 8;
      const mesh = instanced(buildFarTower(), mat, N);
      const items = [];
      const glows = ['#ffcf66', '#ffd97d', '#5efce8', '#ffba42', '#38bdf8', '#ffd269', '#42f5aa', '#ffbe48'];
      for (let i = 0; i < N; i++) {
        // 3 colossal mid-ground archipelago Watchtowers (z = -58..-112) + 5 distant horizon monoliths (z = -155..-275)
        const isMid = i < 3;
        const z = isMid ? lerp(-58, -112, i / 2 + (rng() - 0.5) * 0.12) : lerp(-155, -275, (i - 3) / 4 + (rng() - 0.5) * 0.1);
        items.push({
          u: (i + 0.16 + rng() * 0.58) / N,
          z,
          sx: isMid ? lerp(4.2, 5.8, rng()) : lerp(3.0, 4.6, rng()),
          sy: isMid ? lerp(25, 36, rng()) : lerp(24, 42, rng()),
          ry: rng() * TAU,
          shade: isMid ? 1.08 : 0.94,
          glow: new THREE.Color(glows[i % glows.length]),
          beamSpd: (i % 2 === 0 ? 1 : -1) * lerp(0.38, 0.72, rng()),
          beamPh: rng() * TAU,
          beamLen: isMid ? lerp(28, 42, rng()) : lerp(34, 52, rng()),
        });
      }
      this.farTowers = addLayer(mesh, items, 68, { kind: 'tower' });

      // Sweeping 3D Volumetric Lighthouse Searchlight Cones from every Watchtower cupola
      const lbGeo = new THREE.ConeGeometry(1, 1, 20, 1, true);
      lbGeo.translate(0, -0.5, 0);
      lbGeo.rotateZ(Math.PI / 2); // apex at (0,0,0), open mouth along +X
      this.lighthouseBeamMat = lighthouseBeamMaterial(this.U);
      this.lighthouseBeamMesh = instanced(lbGeo, this.lighthouseBeamMat, MAX_LIGHTHOUSE_BEAMS);
      this.lighthouseBeamMesh.renderOrder = -2;
      this.scene.add(this.lighthouseBeamMesh);

      // Rolling Horizon Sea-Fog & Watchtower Base Sea-Mist Banks (28 FBM vapor banks in 1 draw call!)
      const hmGeo = new THREE.PlaneGeometry(1, 1);
      this.horizonMistMat = horizonMistMaterial(this.U, this.stormNoiseTex);
      this.horizonMistMesh = instanced(hmGeo, this.horizonMistMat, MAX_HORIZON_MIST);
      this.horizonMistMesh.renderOrder = -3;
      this.scene.add(this.horizonMistMesh);
      this.horizonMistBanks = [];
      for (let i = 0; i < MAX_HORIZON_MIST - N; i++) {
        const z = lerp(-82, -268, i / Math.max(1, MAX_HORIZON_MIST - N - 1));
        this.horizonMistBanks.push({
          u: (i + rng() * 0.75) / (MAX_HORIZON_MIST - N),
          z,
          sx: lerp(42, 96, rng()),
          sy: lerp(11, 24, rng()),
          span: lerp(220, 480, Math.abs(z) / 280),
          drift: (i % 2 === 0 ? 1 : -1) * lerp(0.35, 0.85, rng()),
        });
      }
    }
    // Towering 3D Craggy Wet-Basalt Sea-Stack Rock Arches (Sobel normal-mapped moonlit specular, zero silhouette halo!)
    {
      const mat = patchWetRock(
        new THREE.MeshStandardMaterial({
          map: this.basaltTex,
          normalMap: this.basaltNormalTex,
          normalScale: new THREE.Vector2(2.15, 2.15),
          roughnessMap: this.basaltBumpTex,
          vertexColors: true,
          roughness: 0.74,
          metalness: 0.06,
          flatShading: false,
        }),
        this.U,
        'arch_wet'
      );
      const geo = buildSeaStackArch(rng);
      const N = 5;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        items.push({
          u: (i + 0.18 + rng() * 0.55) / N,
          z: lerp(-36, -86, i / Math.max(1, N - 1) + (rng() - 0.5) * 0.14),
          sx: lerp(3.8, 5.8, rng()),
          sy: lerp(5.4, 9.2, rng()),
          ry: (rng() - 0.5) * 0.42,
          shade: lerp(0.92, 1.12, rng()),
          beacon: rng() < 0.8,
        });
      }
      this.seaArches = addLayer(mesh, items, 62, { kind: 'arch' });
    }
    // Voronoi Lacy Whitewater Surf Rings hugging sea-stack pillars & headland islands (Gerstner wave-conformant!)
    {
      this.foamRingTex = makeVoronoiSeafoamRingTex(256);
      const foamGeo = new THREE.PlaneGeometry(1, 1, 10, 10);
      foamGeo.rotateX(-Math.PI / 2);
      this.archFoamMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: this.U.uTime,
          uScrollW: this.U.uScrollW,
          uChop: { value: 1.0 },
          uMap: { value: this.foamRingTex },
          uHaze: this.U.uHaze,
        },
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uScrollW; uniform float uChop;
          varying vec2 vUv; varying vec3 vC; varying float vDist;
          float foamWaves(vec2 p, float t) {
            vec2 d0 = normalize(vec2(0.32, 0.95));
            vec2 d1 = normalize(vec2(-0.46, 0.89));
            vec2 d2 = normalize(vec2(0.78, 0.62));
            vec2 d3 = normalize(vec2(-0.84, 0.54));
            return sin(dot(d0, p) * 0.28 + t * 1.45) * 0.34
                 + sin(dot(d1, p) * 0.52 + t * 1.95) * 0.19
                 + sin(dot(d2, p) * 0.96 + t * 2.65) * 0.095
                 + sin(dot(d3, p) * 1.68 + t * 3.3) * 0.048;
          }
          void main(){
            vUv = uv;
            vC = instanceColor;
            vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
            float distAtten = 1.0 - smoothstep(140.0, 235.0, -w.z);
            w.y += foamWaves(vec2(w.x + uScrollW, w.z), uTime) * uChop * distAtten + 0.22;
            vec4 mv = viewMatrix * w;
            vDist = -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap; uniform vec3 uHaze;
          varying vec2 vUv; varying vec3 vC; varying float vDist;
          void main(){
            vec4 tx = texture2D(uMap, vUv);
            vec3 col = mix(tx.rgb * vC * 1.15, uHaze * 0.9, smoothstep(120.0, 320.0, vDist));
            gl_FragColor = vec4(col, clamp(tx.a * 1.12, 0.0, 0.96));
            ${GLSL_OUT}
          }`,
      });
      this.archFoamMesh = instanced(foamGeo, this.archFoamMat, MAX_ARCH_FOAM);
      this.archFoamMesh.renderOrder = -4;
      this.scene.add(this.archFoamMesh);
    }
    // Volumetric Silver-Cyan Moonbeams / Sun-Shafts slanting from storm clouds down to the sea
    {
      const mbGeo = new THREE.PlaneGeometry(1, 1);
      mbGeo.translate(0, 0.5, 0);
      this.moonbeamMat = moonbeamMaterial(this.U);
      this.moonbeamMesh = instanced(mbGeo, this.moonbeamMat, MAX_MOONBEAMS, { color: false });
      this.moonbeamMesh.renderOrder = -3;
      this.moonbeams = [];
      for (let i = 0; i < MAX_MOONBEAMS; i++) {
        this.moonbeams.push({
          u: (i + 0.12 + rng() * 0.7) / MAX_MOONBEAMS,
          z: lerp(-38, -165, rng()),
          sx: lerp(9, 22, rng()),
          sy: lerp(42, 78, rng()),
          slant: lerp(-0.24, -0.34, rng()),
          span: 120,
        });
      }
      this.moonbeamLayer = { mesh: this.moonbeamMesh, items: this.moonbeams, margin: 45, kind: 'moonbeam' };
      this.layers.push(this.moonbeamLayer);
      this.scene.add(this.moonbeamMesh);
    }
    for (const layer of this.layers) {
      if (layer !== this.moonbeamLayer) this._composeLayer(layer);
    }
  }

  _composeLayer(layer) {
    const d = this._dummy;
    const { mesh, items } = layer;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      d.position.set(0, 0, it.z);
      d.rotation.set(0, it.ry || 0, 0);
      d.scale.set(it.sx, it.sy, it.sx);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ build: FBM mist & storm thunderheads
  _buildClouds() {
    const U = this.U;
    this.cloudTex = this.stormNoiseTex;
    const rng = mulberry32(777);
    const quad = new THREE.PlaneGeometry(1, 0.5);
    quad.translate(0, 0.25, 0);
    // Sky clouds are now rendered natively in `_buildSky` via multi-octave domain-warped FBM!
    const items = [];
    const geo = quad.clone();
    geo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(MAX_CLOUD * 4), 4));
    this.cloudMesh = new THREE.InstancedMesh(geo, cloudMaterial(U, this.stormNoiseTex), MAX_CLOUD);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.count = 0;
    this.cloudMesh.visible = false;
    this.cloudItems = items;
    this.cloudLayer = { mesh: this.cloudMesh, items, margin: 40 };
    this.layers.push(this.cloudLayer);

    const fgGeo = quad.clone();
    fgGeo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(MAX_FGCLOUD * 4), 4));
    this.fgCloudMesh = new THREE.InstancedMesh(
      fgGeo,
      cloudMaterial(U, this.stormNoiseTex, { fg: true }),
      MAX_FGCLOUD
    );
    this.fgCloudMesh.frustumCulled = false;
    this.fgCloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fgCloudMesh.renderOrder = 40;
    this.fgCloudMesh.count = MAX_FGCLOUD;
    this.scene.add(this.fgCloudMesh);
    this.fgItems = [];
    const fa = fgGeo.attributes.aCloud.array;
    for (let i = 0; i < MAX_FGCLOUD; i++) {
      const low = i % 2 === 0;
      this.fgItems.push({
        u: (i + rng() * 0.5) / MAX_FGCLOUD,
        z: lerp(6, 10, rng()),
        w: lerp(12, 18, rng()),
        yf: low ? lerp(-0.45, -0.25, rng()) : lerp(1.12, 1.3, rng()),
        cell: i * 1.7 + rng(),
        flip: rng() < 0.5 ? -1 : 1,
        span: 40,
      });
      fa[i * 4] = this.fgItems[i].cell;
      fa[i * 4 + 1] = 0.95;
      fa[i * 4 + 2] = 0.72;
      fa[i * 4 + 3] = 0;
    }
    fgGeo.attributes.aCloud.needsUpdate = true;

    const sGeo = quad.clone();
    sGeo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(MAX_STORM_PUFF * 4), 4));
    sGeo.attributes.aCloud.setUsage(THREE.DynamicDrawUsage);
    this.stormMesh = new THREE.InstancedMesh(
      sGeo,
      thunderheadMaterial(U, this.stormNoiseTex),
      MAX_STORM_PUFF
    );
    this.stormMesh.frustumCulled = false;
    this.stormMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stormMesh.renderOrder = 8;
    this.stormMesh.count = 0;
    this.scene.add(this.stormMesh);

    const rc = new THREE.PlaneGeometry(1, 1);
    rc.translate(0, -0.5, 0);
    this.curtainMesh = instanced(rc, rainCurtainMaterial(U), MAX_STORM);
    this.curtainMesh.renderOrder = 7;
    this.scene.add(this.curtainMesh);
  }

  // ------------------------------------------------------------------ build: Da-Vinci / Steampunk Sky-Wing + Real 33-Bone Explorer PogoRig
  _buildGlider() {
    const U = this.U;
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const body = new THREE.Group();
    outer.add(inner);
    inner.add(body);
    outer.rotation.order = 'YXZ';
    this.gOuter = outer;
    this.gInner = inner;
    this.gBody = body;
    const C = (h) => new THREE.Color(h);
    const MET = C('#cbd5e1');
    const METD = C('#475569');
    const BRASS = C('#c89b48');
    const LEATHER = C('#4a321f');

    // ---- Expedition Ripstop Delta Sail (Procedural Frame-0 Sky-Wing fallback)
    const NOSE = new THREE.Vector3(0.95, 0, 0);
    const TIP = 1.48;
    const segU = 24;
    const segV = 6;
    const pos = [];
    const uvs = [];
    const idx = [];
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      for (let i = 0; i <= segU; i++) {
        const u = (i / segU) * 2 - 1;
        const au = Math.abs(u);
        const lx = lerp(NOSE.x, -0.42, au);
        const lz = u * TIP;
        const scal = Math.abs(Math.sin(au * Math.PI * 3.5)) * 0.07 * (1 - au * 0.5);
        const tx = lerp(-0.62, -0.5, au) + scal;
        const tz = u * TIP * lerp(0.0, 1.0, Math.pow(au, 0.92));
        const x = lerp(lx, tx, v);
        const z = lerp(lz, tz, v);
        const billow = Math.sin(Math.PI * Math.min(1, v * 1.15)) * (1 - au * au) * 0.13;
        const y = billow + au * 0.1 - v * 0.03;
        pos.push(x, y, z);
        uvs.push(au, v);
      }
    }
    const row = segU + 1;
    for (let j = 0; j < segV; j++) {
      for (let i = 0; i < segU; i++) {
        const a = j * row + i;
        idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sail.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sail.setIndex(idx);
    sail.computeVertexNormals();

    this.sailTex = canvasTex(256, 64, (ctx, w, h) => {
      const bands = [
        [0.0, '#1e293b'],
        [0.11, '#d99b38'],
        [0.34, '#f3ebd8'],
        [0.52, '#22b8cf'],
        [0.72, '#d99b38'],
        [0.86, '#b9382c'],
      ];
      for (let k = 0; k < bands.length; k++) {
        const x0 = bands[k][0] * w;
        const x1 = (k + 1 < bands.length ? bands[k + 1][0] : 1) * w;
        ctx.fillStyle = bands[k][1];
        ctx.fillRect(x0, 0, x1 - x0 + 1, h);
      }
      ctx.fillStyle = 'rgba(15,23,42,0.38)';
      for (let k = 1; k <= 6; k++) ctx.fillRect((k / 7) * w - 1, 0, 2, h * 0.92);
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.28);
      g.addColorStop(0, 'rgba(15,23,42,0.62)');
      g.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.28);
      ctx.fillStyle = 'rgba(226,232,240,0.45)';
      ctx.fillRect(0, h - 4, w, 4);
      const cx = 0.43 * w;
      const cy = h * 0.46;
      ctx.strokeStyle = '#9a6522';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#0e7490';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        const rad = k % 2 === 0 ? 12 : 4.2;
        if (k === 0) ctx.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
        else ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    });

    this.sailBack = { value: 0.35 };
    this.sailBackCol = { value: new THREE.Color('#cfe4ff') };
    this.gliderRim = { value: 0.32 };
    this.gliderRimCol = { value: new THREE.Color('#d6e9ff') };
    this.pogoLit = { value: 0.14 };
    const clothMaps = createSailClothMaps(128);
    this.sailClothNormalTex = clothMaps.normalMap;
    this.sailClothRoughTex = clothMaps.roughnessMap;
    this.sailMat = patchStd(
      new THREE.MeshStandardMaterial({
        map: this.sailTex,
        normalMap: this.sailClothNormalTex,
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughnessMap: this.sailClothRoughTex,
        roughness: 0.64,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
      U,
      {
        backLit: { str: this.sailBack, color: this.sailBackCol },
        rim: { color: this.gliderRimCol, str: this.gliderRim },
        key: 'sail',
      }
    );
    this.flashMats = [this.sailMat];

    const wing = new THREE.Group();
    body.add(wing);
    this.gWing = wing;

    this.procWingGroup = new THREE.Group();
    this.procTrapezeGroup = new THREE.Group();
    wing.add(this.procWingGroup);
    body.add(this.procTrapezeGroup);

    const sailMesh = new THREE.Mesh(sail, this.sailMat);
    this.procWingGroup.add(sailMesh);
    this.sailMesh = sailMesh;

    // ---- Da-Vinci / Steampunk Burnished Brass & Steel Spars, Feathered V-Tail & Twin Boost-Jets
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const frame = [];
    const wframe = [];
    const BAR_Y = -0.92;
    const BAR_X = 0.36;
    const BAR_Z = 0.44;
    for (const s of [1, -1]) {
      wframe.push(solidC(tube(V(0.98, 0.0, 0), V(-0.42, 0.1, s * TIP), 0.03, 0.022, 8), BRASS));
      wframe.push(solidC(tube(V(0.22, 0.08, s * 0.04), V(0.02, 0.1, s * 1.05), 0.018, 0.016, 6), METD));
      // Feathered V-tailfin spars
      wframe.push(solidC(tube(V(-0.56, 0.01, 0), V(-0.86, 0.2, s * 0.24), 0.014, 0.01, 6), BRASS));
      // Twin Steampunk Brass Cryo-Boost Jet Nacelles at (-0.36, 0.03, +-0.44)
      const pod = new THREE.CylinderGeometry(0.046, 0.056, 0.26, 12);
      place(pod, -0.35, 0.03, s * 0.44, 0, 0, Math.PI / 2);
      wframe.push(solidC(pod, BRASS));
      const shroud = new THREE.CylinderGeometry(0.058, 0.05, 0.07, 12);
      place(shroud, -0.46, 0.03, s * 0.44, 0, 0, Math.PI / 2);
      wframe.push(solidC(shroud, METD));
    }
    wframe.push(solidC(tube(V(1.02, 0.0, 0), V(-0.74, -0.01, 0), 0.028, 0.022, 8), BRASS));
    wframe.push(solidC(tube(V(0.12, 0.0, 0), V(0.1, 0.44, 0), 0.018, 0.013, 6), BRASS));
    for (const s of [1, -1]) {
      frame.push(solidC(tube(V(0.22, -0.02, s * 0.05), V(BAR_X, BAR_Y, s * BAR_Z), 0.017, 0.017, 6), METD));
    }
    frame.push(solidC(tube(V(BAR_X, BAR_Y, -BAR_Z), V(BAR_X, BAR_Y, BAR_Z), 0.02, 0.02, 10), BRASS));
    frame.push(solidC(tube(V(BAR_X, BAR_Y, -0.29), V(BAR_X, BAR_Y, 0.29), 0.025, 0.025, 8), LEATHER));
    const wires = [
      [V(0.1, 0.44, 0), V(0.98, 0.0, 0)],
      [V(0.1, 0.44, 0), V(-0.68, 0.0, 0)],
      [V(0.1, 0.44, 0), V(-0.2, 0.06, 1.08)],
      [V(0.1, 0.44, 0), V(-0.2, 0.06, -1.08)],
    ];
    for (const [a, b] of wires) wframe.push(solidC(tube(a, b, 0.005, 0.005, 4), MET));
    frame.push(solidC(tube(V(BAR_X, BAR_Y, 0), V(0.95, 0.0, 0), 0.005, 0.005, 4), MET));

    const frameMat = patchStd(
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.68, roughness: 0.26 }),
      U,
      {
        rim: { color: this.gliderRimCol, str: this.gliderRim },
        key: 'frame',
      }
    );
    this.flashMats.push(frameMat);
    this.procTrapezeGroup.add(new THREE.Mesh(merge(frame), frameMat));
    this.procWingGroup.add(new THREE.Mesh(merge(wframe), frameMat));

    // Permanent leather dorsal hang-strap + brass carabiner connecting keel to PogoRig's Explorer Harness
    const tetherParts = [];
    tetherParts.push(solidC(tube(V(0.08, -0.02, 0), V(0.0, -0.58, 0), 0.015, 0.015, 6), LEATHER));
    const carabiner = new THREE.TorusGeometry(0.032, 0.008, 6, 14);
    place(carabiner, 0.0, -0.6, 0, 0, Math.PI / 2, 0);
    tetherParts.push(solidC(carabiner, BRASS));
    body.add(new THREE.Mesh(merge(tetherParts), frameMat));

    // ---- Dynamic Twin Cryo-Boost Plasma Cones (aligned with `boost_jets` at (-0.49, 0.03, +-0.44))
    this.jetPlumeMat = jetPlumeMaterial(U);
    const plumeGeo = new THREE.ConeGeometry(0.048, 0.56, 12, 1, true);
    plumeGeo.rotateZ(Math.PI / 2); // cone tip points -X (aft exhaust), mouth at origin
    plumeGeo.translate(-0.28, 0, 0);
    this.jetPlumeL = new THREE.Mesh(plumeGeo, this.jetPlumeMat);
    this.jetPlumeR = new THREE.Mesh(plumeGeo, this.jetPlumeMat);
    this.jetPlumeL.position.set(-0.48, 0.03, -0.44);
    this.jetPlumeR.position.set(-0.48, 0.03, 0.44);
    this.jetPlumeL.renderOrder = 14;
    this.jetPlumeR.renderOrder = 14;
    wing.add(this.jetPlumeL, this.jetPlumeR);

    // ---- Load Blender 5.3.0 `assets/models/sky_glider.glb` (replaces procedural wing & trapeze seamlessly)
    this.glbWingGroup = new THREE.Group();
    this.glbTrapezeGroup = new THREE.Group();
    this.glbWingGroup.visible = false;
    this.glbTrapezeGroup.visible = false;
    wing.add(this.glbWingGroup);
    body.add(this.glbTrapezeGroup);
    this._loadSkyGliderGlb();

    this._tipNear = V(-0.42, 0.1, TIP);
    this._tipFar = V(-0.42, 0.1, -TIP);
    this._noseLocal = V(1.02, 0, 0);
    this._tailLocal = V(-0.74, 0, 0);
    this._jetLocalL = V(-0.52, 0.03, -0.44);
    this._jetLocalR = V(-0.52, 0.03, 0.44);

    // ---- Real 33-Bone `PogoRig` Explorer Pogo V2 Pilot (100% replaces old sphere pilot)
    this.pogoMount = new THREE.Group();
    body.add(this.pogoMount);
    this.pogoRig = new PogoRig(this.skinId);
    this.pogoRig.group.scale.setScalar(POGO_GLIDE_SCALE);
    if (this.pogoRig.bones?.blaster) {
      this.pogoRig.bones.blaster.visible = false;
    }
    this.pogoMount.add(this.pogoRig.group);
    // Face +X flight direction (+Z bind forward -> rotate Y by +PI/2 with slight heroic 3/4 turn toward camera)
    this.pogoMount.rotation.y = Math.PI * 0.5 - 0.16;
    this.pogoMount.position.set(-0.05, -1.21, 0);
    this._pogoHead = V(0.22, -0.56, 0);
    this._feetLocalY = -1.56;

    // Streaming weathered leather expedition strap pennant fluttering behind Pogo's pack
    const strapTail = new THREE.PlaneGeometry(0.54, 0.046, 12, 1);
    strapTail.translate(-0.27, 0, 0);
    this.scarfAmt = { value: 1 };
    const pennantMat = new THREE.MeshStandardMaterial({
      color: '#6b4429',
      roughness: 0.78,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
    pennantMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = U.uTime;
      shader.uniforms.uAmt = this.scarfAmt;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmt;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float k = -position.x / 0.54;
          transformed.y += sin(uTime * 14.0 + position.x * 13.0) * 0.055 * k * uAmt - k * k * 0.1 * (1.2 - uAmt);
          transformed.z += cos(uTime * 11.0 + position.x * 9.0) * 0.04 * k * uAmt;`
        );
    };
    pennantMat.customProgramCacheKey = () => 'glide_pennant';
    this.pennantMat = pennantMat;
    const scarfTail = new THREE.Mesh(strapTail, pennantMat);
    scarfTail.position.set(-0.22, -0.76, 0.08);
    scarfTail.rotation.y = 0.14;
    body.add(scarfTail);
    this.scarfTail = scarfTail;

    this._gSc = 0.5;
    this.scene.add(outer);

    // ---- Twin Aerodynamic Wingtip Condensation Vortex Ribbons (single merged Mesh = 1 draw call, zero-alloc!)
    {
      const stride = VORTEX_SEGS + 1;
      const vertCount = 2 * stride * 2;
      this._vortexPos = new Float32Array(vertCount * 3);
      this._vortexAlpha = new Float32Array(vertCount);
      const vUvs = new Float32Array(vertCount * 2);
      const vIdx = [];
      for (let side = 0; side < 2; side++) {
        const baseV = side * stride * 2;
        for (let k = 0; k < stride; k++) {
          const u = k / VORTEX_SEGS;
          const vi = baseV + k * 2;
          vUvs[vi * 2] = u;
          vUvs[vi * 2 + 1] = 0;
          vUvs[(vi + 1) * 2] = u;
          vUvs[(vi + 1) * 2 + 1] = 1;
          this._vortexAlpha[vi] = 1 - u;
          this._vortexAlpha[vi + 1] = 1 - u;
          if (k < VORTEX_SEGS) {
            vIdx.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
          }
        }
      }
      const vGeo = new THREE.BufferGeometry();
      vGeo.setAttribute('position', new THREE.BufferAttribute(this._vortexPos, 3).setUsage(THREE.DynamicDrawUsage));
      vGeo.setAttribute('uv', new THREE.BufferAttribute(vUvs, 2));
      vGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this._vortexAlpha, 1).setUsage(THREE.DynamicDrawUsage));
      vGeo.setIndex(vIdx);
      this.vortexRibbonMat = vortexRibbonMaterial(U);
      this.vortexRibbonMesh = new THREE.Mesh(vGeo, this.vortexRibbonMat);
      this.vortexRibbonMesh.frustumCulled = false;
      this.vortexRibbonMesh.renderOrder = 15;
      this.scene.add(this.vortexRibbonMesh);
      this._tipHistNear = new Float32Array(stride * 3);
      this._tipHistFar = new Float32Array(stride * 3);
      this._vortexInit = false;
      this._lastScrollW = 0;
    }
  }

  _loadSkyGliderGlb() {
    let url = './assets/models/sky_glider.glb';
    try {
      url = new URL('../assets/models/sky_glider.glb', import.meta.url).href;
    } catch (_) {
      // Fallback relative URL in non-standard environments
    }
    try {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          if (this._disposed || !gltf?.scene) return;
          const root = gltf.scene;
          const seenMat = new Set();
          root.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.frustumCulled = false;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              if (!m || seenMat.has(m)) continue;
              seenMat.add(m);
              m.side = THREE.DoubleSide;
              const mName = (m.name || '').toLowerCase();
              if (mName === 'mat_jet_glow') {
                m.emissiveIntensity = Math.min(1.45, m.emissiveIntensity || 1.2);
                this._glbJetGlowMats.push(m);
              } else {
                if (m.emissiveIntensity > 1.2) m.emissiveIntensity = 1.2;
                if (mName.includes('sail') || mName.includes('canvas') || mName.includes('cloth')) {
                  // Woven stitched-canvas ripstop PBR + warm backlit seam translucency
                  m.normalMap = this.sailClothNormalTex;
                  m.normalScale = new THREE.Vector2(0.95, 0.95);
                  m.roughnessMap = this.sailClothRoughTex;
                  m.roughness = 0.66;
                  m.metalness = 0.04;
                  m.needsUpdate = true;
                  patchStd(m, this.U, {
                    backLit: { str: this.sailBack, color: this.sailBackCol },
                    rim: { color: this.gliderRimCol, str: this.gliderRim },
                    key: 'glb_sail',
                  });
                } else if (mName.includes('leather') || mName.includes('strap') || mName.includes('grip')) {
                  m.normalMap = this.sailClothNormalTex;
                  m.normalScale = new THREE.Vector2(0.55, 0.55);
                  m.roughness = 0.52;
                  m.metalness = 0.14;
                  m.needsUpdate = true;
                } else {
                  // Burnished-brass & oiled-bronze steampunk spar/jet PBR
                  m.metalness = Math.max(m.metalness ?? 0.5, 0.85);
                  m.roughness = Math.min(m.roughness ?? 0.4, 0.25);
                  m.envMapIntensity = 1.45;
                  m.needsUpdate = true;
                }
                this.flashMats.push(m);
              }
            }
          });
          const wingNames = ['wing_sail', 'spar_frame', 'boost_jets'];
          const trapNames = ['trapeze_frame', 'grip_bar'];
          let attached = 0;
          for (const nm of wingNames) {
            const node = root.getObjectByName(nm);
            if (node) {
              this.glbWingGroup.add(node);
              attached++;
            }
          }
          for (const nm of trapNames) {
            const node = root.getObjectByName(nm);
            if (node) {
              if (nm === 'grip_bar') {
                this._gripBarPos = node.position.clone();
              }
              this.glbTrapezeGroup.add(node);
              attached++;
            }
          }
          if (attached === 0) {
            this.glbWingGroup.add(root);
          }
          this.glbWingGroup.visible = true;
          this.glbTrapezeGroup.visible = true;
          this.procWingGroup.visible = false;
          this.procTrapezeGroup.visible = false;
        },
        undefined,
        () => {
          // Keep procedural Sky-Wing active if asset unavailable
        }
      );
    } catch (_) {
      // Headless / stub loader fallback keeps procedural Sky-Wing active
    }
  }

  // ------------------------------------------------------------------ build: gameplay entities
  _buildEntities() {
    const U = this.U;
    this.lanternMesh = instanced(buildLantern(), lanternMaterial(U), MAX_LANTERN, { glow: true });
    this.lanternMesh.renderOrder = 4;
    this.scene.add(this.lanternMesh);

    this.kiteTex = canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.translate(64, 64);
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(255,255,255,1)' : 'rgba(205,215,235,1)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(
          0,
          0,
          90,
          (k * TAU) / 10 - Math.PI / 2 - TAU / 20,
          ((k + 1) * TAU) / 10 - Math.PI / 2 - TAU / 20
        );
        ctx.closePath();
        ctx.fill();
      }
      // Geometric star-compass core (crisp expedition emblem, zero cartoon smiley)
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
    });

    const kiteMat = patchStd(
      new THREE.MeshStandardMaterial({
        map: this.kiteTex,
        roughness: 0.55,
        side: THREE.DoubleSide,
        emissive: '#ffffff',
        emissiveIntensity: 0.0,
      }),
      U,
      {
        selfLit: { value: 0.42 },
        rim: { color: { value: new THREE.Color('#ffffff') }, str: { value: 0.3 } },
        key: 'kite',
      }
    );
    this.kiteMesh = instanced(buildKiteGeo(), kiteMat, MAX_KITE);
    this.kiteMesh.renderOrder = 4;
    const tailMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    tailMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = U.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float k = -position.x;
          float ph = instanceMatrix[3].x * 0.7;
          transformed.y += sin(uTime * 7.0 + position.x * 9.0 + ph) * 0.18 * k - k * k * 0.25;`
        );
    };
    tailMat.customProgramCacheKey = () => 'glide_kitetail';
    this.kiteTail = instanced(buildKiteTail(), tailMat, MAX_KITE);
    this.kiteTail.renderOrder = 3;
    this.scene.add(this.kiteMesh, this.kiteTail);

    const gateGeo = buildCelestialGateGeo();
    this.gateMesh = instanced(gateGeo, gateMaterial(U), MAX_GATE, { glow: true });
    this.gateMesh.renderOrder = 6;
    this.scene.add(this.gateMesh);

    // Swirling 3D Aerodynamic Wind-Tunnel Vortex Sleeves & Glowing Slipstream Rings
    const wtSleeveGeo = new THREE.CylinderGeometry(0.98, 0.82, 2.35, 32, 1, true);
    wtSleeveGeo.rotateX(Math.PI / 2); // aligns cylinder axis with local +Z (gate normal)
    wtSleeveGeo.translate(0, 0, -0.85);
    this.windTunnelMat = windTunnelMaterial(U);
    this.gateTunnelMesh = instanced(wtSleeveGeo, this.windTunnelMat, MAX_GATE);
    this.gateTunnelMesh.renderOrder = 5;
    this.scene.add(this.gateTunnelMesh);

    const windRingGeo = new THREE.CylinderGeometry(1.0, 0.94, 0.42, 28, 1, true);
    windRingGeo.rotateZ(Math.PI / 2); // ring bore aligned along +X slipstream
    this.windRingMesh = instanced(windRingGeo, this.windTunnelMat, MAX_WIND_TUNNEL);
    this.windRingMesh.renderOrder = 5;
    this.scene.add(this.windRingMesh);

    const thGeo = new THREE.PlaneGeometry(1, 1);
    thGeo.translate(0, 0.5, 0);
    this.thermalMesh = instanced(thGeo, thermalMaterial(U), MAX_THERMAL);
    this.thermalMesh.renderOrder = 2;
    this.scene.add(this.thermalMesh);

    const gullMat = patchStd(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
      U,
      {
        flap: true,
        rim: { color: { value: new THREE.Color('#ffffff') }, str: { value: 0.35 } },
        key: 'gull',
      }
    );
    this.gullMesh = instanced(buildGull(), gullMat, MAX_GULL, { anim: true });
    this.gullMesh.renderOrder = 5;
    this.scene.add(this.gullMesh);
    const rng = mulberry32(99);
    this.ambFlocks = [];
    for (let k = 0; k < 5; k++) {
      this.ambFlocks.push({
        u: rng(),
        z: lerp(-90, -200, rng()),
        el: lerp(3, 14, rng()) * DEG,
        n: 3 + Math.floor(rng() * 4),
        speed: lerp(1.5, 3.5, rng()),
        ph: rng() * TAU,
        dir: rng() < 0.7 ? 1 : -1,
      });
    }

    const bg = new THREE.BufferGeometry();
    this.boltPos = new Float32Array(MAX_BOLT_SEG * 4 * 3);
    this.boltA = new Float32Array(MAX_BOLT_SEG * 4);
    this.boltE = new Float32Array(MAX_BOLT_SEG * 4);
    const bi = new Uint16Array(MAX_BOLT_SEG * 6);
    for (let i = 0; i < MAX_BOLT_SEG; i++) {
      bi.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
      this.boltE[i * 4] = -1;
      this.boltE[i * 4 + 1] = 1;
      this.boltE[i * 4 + 2] = -1;
      this.boltE[i * 4 + 3] = 1;
    }
    bg.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3).setUsage(THREE.DynamicDrawUsage));
    bg.setAttribute('aA', new THREE.BufferAttribute(this.boltA, 1).setUsage(THREE.DynamicDrawUsage));
    bg.setAttribute('aE', new THREE.BufferAttribute(this.boltE, 1));
    bg.setIndex(new THREE.BufferAttribute(bi, 1));
    bg.setDrawRange(0, 0);
    this.boltMesh = new THREE.Mesh(bg, boltMaterial());
    this.boltMesh.frustumCulled = false;
    this.boltMesh.renderOrder = 30;
    this.scene.add(this.boltMesh);

    this.streakMesh = instanced(new THREE.PlaneGeometry(1, 1), streakMaterial(), MAX_STREAK);
    this.streakMesh.renderOrder = 20;
    this.scene.add(this.streakMesh);
    this.streaks = [];
    for (let i = 0; i < MAX_STREAK; i++) {
      this.streaks.push({ x: 0, y: 0, z: 0, len: 1, life: 0, max: 1, v: 1, a: 0.5, rz: 0, vy: 0 });
    }
    this._streakIdx = 0;

    const glowMat = new THREE.MeshBasicMaterial({
      map: this.softDot,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.glowMesh = instanced(new THREE.PlaneGeometry(1, 1), glowMat, MAX_GLOW);
    this.glowMesh.renderOrder = 9;
    this.scene.add(this.glowMesh);

    const starMat = new THREE.MeshBasicMaterial({
      map: this.starTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.starMesh = instanced(new THREE.PlaneGeometry(1, 1), starMat, MAX_STAR);
    this.starMesh.renderOrder = 26;
    this.scene.add(this.starMesh);

    this.shadeMat = new THREE.MeshBasicMaterial({
      map: this.softDot,
      color: '#050914',
      transparent: true,
      depthWrite: false,
      opacity: 0.34,
      toneMapped: false,
    });
    this.shadeMesh = instanced(new THREE.PlaneGeometry(1, 1), this.shadeMat, MAX_SHADE, { color: false });
    this.shadeMesh.renderOrder = 1;
    this.scene.add(this.shadeMesh);

    this.ringTex = canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.62, 'rgba(255,255,255,0)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.88, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
    this.ringMesh = instanced(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: this.ringTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      MAX_RING
    );
    this.ringMesh.renderOrder = 13;
    this.scene.add(this.ringMesh);

    this.puffs = [];
    for (let i = 0; i < MAX_PUFF; i++) {
      this.puffs.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        size: 0.1,
        g: 0,
        r: 1,
        gg: 1,
        b: 1,
        drag: 1,
        kind: 0,
      });
    }
    this._puffIdx = 0;
    const pg = new THREE.BufferGeometry();
    this.puffPos = new Float32Array(MAX_PUFF * 3);
    this.puffCol = new Float32Array(MAX_PUFF * 3);
    this.puffSize = new Float32Array(MAX_PUFF);
    this.puffAlpha = new Float32Array(MAX_PUFF);
    pg.setAttribute('position', new THREE.BufferAttribute(this.puffPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aColor', new THREE.BufferAttribute(this.puffCol, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aSize', new THREE.BufferAttribute(this.puffSize, 1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(this.puffAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.puffMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.softDot }, uPx: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        uniform float uPx; attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx / -mv.z; vC = aColor; vA = aAlpha; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vC * a * vA, a * vA * 0.85);
          #include <colorspace_fragment>
        }`,
    });
    this.puffPoints = new THREE.Points(pg, this.puffMat);
    this.puffPoints.frustumCulled = false;
    this.puffPoints.renderOrder = 22;
    this.scene.add(this.puffPoints);

    const rngP = mulberry32(31337);
    const ppos = new Float32Array(MAX_PRECIP * 3);
    const pseed = new Float32Array(MAX_PRECIP);
    for (let i = 0; i < MAX_PRECIP; i++) {
      ppos[i * 3] = (rngP() - 0.5) * 60;
      ppos[i * 3 + 1] = rngP() * 20 - 8;
      ppos[i * 3 + 2] = lerp(-22, 9, Math.pow(rngP(), 0.7));
      pseed[i] = rngP();
    }
    const prg = new THREE.BufferGeometry();
    prg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    prg.setAttribute('aSeed', new THREE.BufferAttribute(pseed, 1));
    this.precipMat = precipMaterial(U, this.softDot);
    this.precip = new THREE.Points(prg, this.precipMat);
    this.precip.frustumCulled = false;
    this.precip.renderOrder = 24;
    this.scene.add(this.precip);
  }

  // ------------------------------------------------------------------ build: summit + destination monolith
  _buildTowers() {
    const rng = mulberry32(99);
    const stoneTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        // Dark midnight-indigo weathered wet-basalt ashlar matching `media_1794856383556_f193848e.jpg`
        ctx.fillStyle = '#070b16';
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++) {
          const off = (r % 2) * 16;
          for (let c = -1; c < 8; c++) {
            const v = 18 + Math.floor(rng() * 14);
            const x0 = c * 32 + off + 1;
            const y0 = r * 32 + 1;
            const gr = ctx.createLinearGradient(x0, y0, x0, y0 + 30);
            gr.addColorStop(0, `rgb(${v + 8},${v + 15},${v + 28})`);
            gr.addColorStop(0.5, `rgb(${v + 3},${v + 9},${v + 20})`);
            gr.addColorStop(1, `rgb(${Math.max(8, v - 3)},${v + 2},${v + 12})`);
            ctx.fillStyle = gr;
            ctx.fillRect(x0, y0, 30, 30);
            if (rng() < 0.28) {
              ctx.fillStyle = 'rgba(26, 52, 34, 0.36)';
              ctx.fillRect(x0 + 2, y0 + 1, 14 + rng() * 12, 4 + rng() * 5);
            }
          }
        }
      },
      { repeat: true }
    );
    this.stoneTex = stoneTex;
    stoneTex.repeat.set(1, 1);

    const scaleUv = (g, su, sv) => {
      const uv = g.attributes.uv;
      if (uv) {
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
      }
      return g;
    };
    const parts = [];
    const shaft = scaleUv(new THREE.CylinderGeometry(1, 1.06, 30, 48, 18, true), 5, 24);
    shaft.translate(0, -15, 0);
    parts.push(shaft);
    const lip = scaleUv(new THREE.CylinderGeometry(1.08, 1.08, 0.16, 48, 1, false), 5, 0.35);
    lip.translate(0, -0.1, 0);
    parts.push(lip);
    const top = scaleUv(new THREE.CircleGeometry(1, 48), 2, 2);
    top.rotateX(-Math.PI / 2);
    parts.push(top);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      if (Math.sin(a) > 0.45) continue;
      const m = scaleUv(new THREE.BoxGeometry(0.28, 0.2, 0.14), 0.4, 0.3);
      m.translate(0, 0.1, 0);
      m.rotateY(-a + Math.PI / 2);
      m.translate(Math.cos(a) * 0.93, 0, Math.sin(a) * 0.93);
      parts.push(m);
    }
    const sg = merge(parts.map((g) => solid(g, 1, 1, 1)));
    paint(sg, (x, y, z, c) => {
      // Subtle weathered wet-basalt mortar courses + darker shadow toward lower tower shaft
      const course = 0.86 + 0.14 * Math.abs(Math.sin(y * 5.2));
      const depthDark = 0.62 + 0.38 * smooth01((y + 6.5) / 6.8);
      const k = course * depthDark;
      c[0] = k * 0.92;
      c[1] = k * 0.97;
      c[2] = k * 1.06;
    });
    this.summitMat = new THREE.MeshStandardMaterial({
      map: this.basaltTex,
      normalMap: this.basaltNormalTex,
      normalScale: new THREE.Vector2(2.1, 2.1),
      roughnessMap: this.basaltBumpTex,
      vertexColors: true,
      roughness: 0.64,
      metalness: 0.07,
      color: '#6e809a',
      emissive: '#040812',
      emissiveIntensity: 0.06,
    });
    this.summitMesh = new THREE.Mesh(sg, this.summitMat);
    this.summitMesh.visible = false;
    this.scene.add(this.summitMesh);

    const flagParts = [];
    const pole = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
    pole.translate(0, 0.5, 0);
    flagParts.push(solid(pole, 0.85, 0.85, 0.9));
    const pennant = new THREE.PlaneGeometry(0.55, 0.3, 8, 1);
    pennant.translate(-0.275, 0.82, 0);
    flagParts.push(solid(pennant, 1, 1, 1));
    this.flagMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: '#fbbf24',
      roughness: 0.7,
      side: THREE.DoubleSide,
      emissive: '#000000',
    });
    this.flagMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.U.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nfloat fk = clamp(-position.x / 0.55, 0.0, 1.0);\ntransformed.z += sin(uTime * 9.0 + position.x * 12.0) * 0.08 * fk;\ntransformed.y += sin(uTime * 7.0 + position.x * 8.0) * 0.03 * fk;'
        );
    };
    this.flagMat.customProgramCacheKey = () => 'glide_flag';
    this.flag = new THREE.Mesh(merge(flagParts), this.flagMat);
    this.flag.visible = false;
    this.scene.add(this.flag);

    const towerTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#0e1324';
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++) {
          const off = (r % 2) * 16;
          for (let c = -1; c < 8; c++) {
            const v = 34 + Math.floor(rng() * 20);
            ctx.fillStyle = `rgb(${v},${v + 5},${v + 24})`;
            ctx.fillRect(c * 32 + off + 2, r * 32 + 2, 28, 28);
          }
        }
        ctx.fillStyle = '#05070e';
        ctx.fillRect(84, 60, 88, 120);
      },
      { repeat: true }
    );
    const winTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        const g2 = ctx.createLinearGradient(0, 60, 0, 180);
        g2.addColorStop(0, '#ffffff');
        g2.addColorStop(1, '#9a9a9a');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(92, 176);
        ctx.lineTo(92, 100);
        ctx.arc(128, 100, 36, Math.PI, 0);
        ctx.lineTo(164, 176);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(125, 64, 6, 112);
        ctx.fillRect(92, 124, 72, 6);
        ctx.fillStyle = '#666';
        ctx.fillRect(0, 250, 256, 6);
      },
      { repeat: true }
    );
    this.towerTex = towerTex;
    this.winTex = winTex;
    const tg = new THREE.CylinderGeometry(1, 1, 1, 48, 1, true);
    tg.translate(0, 0.5, 0);
    this.towerMat = new THREE.MeshStandardMaterial({
      map: towerTex,
      normalMap: this.basaltNormalTex,
      normalScale: new THREE.Vector2(1.65, 1.65),
      roughnessMap: this.basaltBumpTex,
      emissiveMap: winTex,
      emissive: new THREE.Color('#5efce8'),
      emissiveIntensity: 1.65,
      roughness: 0.64,
      metalness: 0.12,
    });
    this.nextTower = new THREE.Mesh(tg, this.towerMat);
    this.nextTower.visible = false;
    this.scene.add(this.nextTower);

    const crown = [];
    const cr = new THREE.CylinderGeometry(1.12, 1.0, 0.5, 40, 1, false);
    cr.translate(0, 0.25, 0);
    crown.push(cr);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const m = new THREE.BoxGeometry(0.3, 0.35, 0.2);
      m.translate(0, 0.65, 0);
      m.rotateY(-a + Math.PI / 2);
      m.translate(Math.cos(a) * 1.02, 0, Math.sin(a) * 1.02);
      crown.push(m);
    }
    const cone = new THREE.ConeGeometry(0.75, 1.6, 24);
    cone.translate(0, 1.3, 0);
    crown.push(cone);
    this.crownMat = new THREE.MeshStandardMaterial({ color: '#232a44', roughness: 0.76, emissive: '#000000' });
    this.crown = new THREE.Mesh(merge(crown.map((g) => solid(g, 1, 1, 1))), this.crownMat);
    this.crown.visible = false;
    this.scene.add(this.crown);

    const prof = [
      [0.0, 1.03],
      [0.3, 1.04],
      [0.52, 1.02],
      [0.62, 1.0],
      [0.82, 0.98],
      [0.9, 0.9],
      [0.97, 0.62],
      [1.03, 0.28],
      [1.08, 0.04],
      [1.16, -0.25],
    ];
    const ig = new THREE.LatheGeometry(
      prof
        .slice()
        .reverse()
        .map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)),
      72
    );
    const irng = mulberry32(42);
    const ph = [irng() * TAU, irng() * TAU];
    {
      const p = ig.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const a = Math.atan2(z, x);
        const r = 1 + Math.sin(a * 3 + ph[0]) * 0.06 + Math.sin(a * 7 + ph[1]) * 0.03;
        p.setX(i, x * r);
        p.setZ(i, z * r);
      }
      ig.computeVertexNormals();
    }
    paint(ig, (x, y, z, c) => {
      const rr = Math.hypot(x, z);
      const n = 0.92 + 0.08 * Math.sin(x * 23 + z * 17) * Math.sin(x * 7 - z * 11);
      if (y < 0.02) {
        c[0] = 0.45 * n;
        c[1] = 0.54 * n;
        c[2] = 0.58 * n;
      } else if (y < 0.35) {
        c[0] = 0.76 * n;
        c[1] = 0.68 * n;
        c[2] = 0.54 * n;
      } else if (rr < 0.58 + 0.05 * Math.sin(Math.atan2(z, x) * 5)) {
        c[0] = 0.32 * n;
        c[1] = 0.58 * n;
        c[2] = 0.34 * n;
      } else {
        c[0] = 0.88 * n;
        c[1] = 0.8 * n;
        c[2] = 0.62 * n;
      }
    });
    this.isleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, color: '#b8b8b8' });
    this.isle = new THREE.Mesh(ig, this.isleMat);
    this.isle.visible = false;
    this.scene.add(this.isle);

    {
      const palmParts = [];
      const segs = 7;
      let px = 0;
      let py = 0;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const x0 = Math.pow(t0, 2) * 0.55;
        const x1 = Math.pow(t1, 2) * 0.55;
        const seg = tube(
          new THREE.Vector3(x0, t0 * 3, 0),
          new THREE.Vector3(x1, t1 * 3, 0),
          lerp(0.13, 0.08, t0),
          lerp(0.13, 0.08, t1),
          7
        );
        solid(seg, k % 2 ? 0.52 : 0.44, k % 2 ? 0.38 : 0.32, 0.22);
        palmParts.push(seg);
        px = x1;
        py = t1 * 3;
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.3;
        const leaf = new THREE.PlaneGeometry(1.6, 0.34, 8, 1);
        leaf.translate(0.8, 0, 0);
        const lp = leaf.attributes.position;
        for (let i = 0; i < lp.count; i++) {
          const lx = lp.getX(i);
          const w = Math.sin((lx / 1.6) * Math.PI) * (lp.getY(i) > 0 ? 1 : -1) * 0.17;
          lp.setY(i, w);
          lp.setZ(i, -lx * lx * 0.32);
        }
        leaf.rotateX(-Math.PI / 2);
        leaf.rotateZ(0.35 - (k % 2) * 0.25);
        leaf.rotateY(a);
        leaf.translate(px, py, 0);
        paint(leaf, (x2, y2, z2, c) => {
          const tip = Math.hypot(x2 - px, z2) / 1.6;
          c[0] = lerp(0.2, 0.42, tip);
          c[1] = lerp(0.55, 0.72, tip);
          c[2] = lerp(0.2, 0.25, tip);
        });
        palmParts.push(leaf);
      }
      const palmMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      this.palms = instanced(merge(palmParts), palmMat, 4, { color: false });
      this.palmSpots = [
        [-0.7, 0.18, 0.9, 0.2],
        [-0.42, -0.55, 1.15, 2.4],
        [0.62, -0.42, 1.0, 3.6],
        [0.78, 0.2, 0.8, 5.1],
      ];
      this.palms.count = 4;
      this.scene.add(this.palms);
    }
  }

  // ------------------------------------------------------------------ build: overlay
  _buildOverlay() {
    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 390, 0, -620, -10, 10);
    const quad = (this._quad = new THREE.PlaneGeometry(1, 1));
    const basic = (extra = {}) =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        ...extra,
      });

    this.vigMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#040814') },
        uStr: { value: 0.38 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color('#fb7185') },
        uWhite: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uStr; uniform float uFlash; uniform vec3 uFlashColor; uniform float uWhite; varying vec2 vUv;
        void main(){
          vec2 q = vUv - 0.5; q.x *= 0.85;
          float v = smoothstep(0.32, 0.78, length(q));
          float a = v * uStr;
          vec3 col = mix(uColor, uFlashColor, uFlash * v);
          col = mix(col, vec3(0.92, 0.96, 1.0), uWhite);
          gl_FragColor = vec4(col, clamp(a + uFlash * v * 0.6 + uWhite * 0.45, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
    });
    this.vignette = new THREE.Mesh(quad, this.vigMat);
    this.vignette.renderOrder = 0;
    this.overlay.add(this.vignette);

    this.fxGroup = new THREE.Group();
    this.overlay.add(this.fxGroup);
    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PART * 3);
    this.pCol = new Float32Array(MAX_PART * 3);
    this.pSize = new Float32Array(MAX_PART);
    this.pAlpha = new Float32Array(MAX_PART);
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    pg.setDrawRange(0, 0);
    this.partMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.softDot }, uPR: { value: 1 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uPR; attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA;
        void main(){ vC = aColor; vA = aAlpha; gl_PointSize = aSize * uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec3 vC; varying float vA;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(vC, a);
          #include <colorspace_fragment>
        }`,
    });
    this.partPoints = new THREE.Points(pg, this.partMat);
    this.partPoints.frustumCulled = false;
    this.partPoints.renderOrder = 2;
    this.fxGroup.add(this.partPoints);

    this._popCache = new Map();
    this._popFrame = 0;
    this.popPool = [];
    for (let i = 0; i < MAX_POP; i++) {
      const m = new THREE.Mesh(quad, basic());
      m.visible = false;
      m.renderOrder = 3;
      this.fxGroup.add(m);
      this.popPool.push(m);
    }

    // Vector hazard telegraphs (zero emojis)
    const warnTex = (kind) =>
      canvasTex(128, 128, (ctx) => {
        ctx.translate(64, 64);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.fillStyle = 'rgba(6,12,26,0.68)';
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = kind === 'gull' ? '#fb7185' : '#7be8ff';
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        if (kind === 'gull') {
          for (const dx of [-8, 14]) {
            ctx.beginPath();
            ctx.moveTo(dx - 22, -6);
            ctx.quadraticCurveTo(dx - 11, -20, dx, -2);
            ctx.quadraticCurveTo(dx + 11, -20, dx + 22, -6);
            ctx.stroke();
          }
          ctx.fillStyle = '#fb7185';
          ctx.font = '900 30px Orbitron, "Arial Black", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('!', 0, 34);
        } else {
          const s = kind === 'gustUp' ? -1 : 1;
          for (const dx of [-16, 0, 16]) {
            ctx.beginPath();
            ctx.moveTo(dx + 14, -22);
            ctx.quadraticCurveTo(dx - 16, -10 * s, dx + 4, 6);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(-14, 16 * s + 6);
          ctx.lineTo(0, 30 * s + 6);
          ctx.lineTo(14, 16 * s + 6);
          ctx.stroke();
        }
      });
    this._warnTex = {
      gull: warnTex('gull'),
      gustUp: warnTex('gustUp'),
      gustDown: warnTex('gustDown'),
    };
    this.warnPool = [];
    for (let i = 0; i < MAX_WARN; i++) {
      const m = new THREE.Mesh(quad, basic({ map: this._warnTex.gull }));
      m.visible = false;
      m.renderOrder = 4;
      this.overlay.add(m);
      this.warnPool.push(m);
    }

    // Compact Flight HUD strip positioned cleanly beneath `#hud`
    this.hudGroup = new THREE.Group();
    this.overlay.add(this.hudGroup);
    this._hudCanvas = document.createElement('canvas');
    this._hudTex = new THREE.CanvasTexture(this._hudCanvas);
    this._hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudPanel = new THREE.Mesh(quad, basic({ map: this._hudTex }));
    this.hudPanel.renderOrder = 5;
    this.hudFill = new THREE.Mesh(
      quad,
      basic({
        map: canvasTex(256, 16, (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, 0);
          g.addColorStop(0, '#38bdf8');
          g.addColorStop(0.6, '#5efce8');
          g.addColorStop(1, '#fde047');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(0, 3, w, 3);
        }),
      })
    );
    this.hudFill.renderOrder = 6;
    this.hudHead = new THREE.Mesh(
      quad,
      basic({ map: this.softDot, color: '#a5f3fc', blending: THREE.AdditiveBlending })
    );
    this.hudHead.renderOrder = 7;

    this._markerCanvas = document.createElement('canvas');
    this._markerCanvas.width = 96;
    this._markerCanvas.height = 64;
    this._markerTex = new THREE.CanvasTexture(this._markerCanvas);
    this._markerTex.colorSpace = THREE.SRGBColorSpace;
    this.hudMarker = new THREE.Mesh(quad, basic({ map: this._markerTex }));
    this.hudMarker.renderOrder = 8;
    this.hudGroup.add(this.hudPanel, this.hudFill, this.hudHead, this.hudMarker);
    this._hudDrawn = null;
    this._dispBonus = 0;

    this.comboMat = new THREE.ShaderMaterial({
      uniforms: {
        uProg: { value: 1 },
        uCol: { value: new THREE.Color('#5efce8') },
        uAlpha: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uProg; uniform vec3 uCol; uniform float uAlpha; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float ang = atan(p.x, p.y);
          float fr = ang >= 0.0 ? ang / 6.2831853 : 1.0 + ang / 6.2831853;
          float disk = smoothstep(0.79, 0.75, r);
          float ring = smoothstep(0.79, 0.83, r) * smoothstep(0.97, 0.93, r);
          float on = step(fr, uProg);
          vec3 col = vec3(0.02, 0.05, 0.12) * disk;
          float a = disk * 0.76;
          col = mix(col, mix(vec3(0.16, 0.22, 0.34), uCol * 1.2, on), ring);
          a = max(a, ring * (0.55 + 0.45 * on));
          float halo = exp(-abs(r - 0.88) * 9.0) * (1.0 - disk) * on * 0.5;
          col += uCol * halo;
          a = max(a, halo * 0.55);
          gl_FragColor = vec4(col, a * uAlpha);
          #include <colorspace_fragment>
        }`,
    });
    this.comboRing = new THREE.Mesh(quad, this.comboMat);
    this.comboRing.renderOrder = 6;
    this.comboText = new THREE.Mesh(quad, basic());
    this.comboText.renderOrder = 7;
    this.comboRing.visible = false;
    this.comboText.visible = false;
    this.overlay.add(this.comboRing, this.comboText);
    this._comboTex = [];
    this._comboCols = ['#5efce8', '#fb923c', '#fde047'].map((h) => new THREE.Color(h));
    this._comboAlpha = 0;
    this._comboShown = 0;

    this.lbTop = new THREE.Mesh(quad, basic({ color: '#030610', opacity: 0.92 }));
    this.lbBot = new THREE.Mesh(quad, basic({ color: '#030610', opacity: 0.92 }));
    this.lbTop.renderOrder = 9;
    this.lbBot.renderOrder = 9;
    this.lbTop.visible = false;
    this.lbBot.visible = false;
    this.overlay.add(this.lbTop, this.lbBot);
    this._cardCanvas = document.createElement('canvas');
    this._cardTex = new THREE.CanvasTexture(this._cardCanvas);
    this._cardTex.colorSpace = THREE.SRGBColorSpace;
    this.card = new THREE.Mesh(quad, basic({ map: this._cardTex }));
    this.card.renderOrder = 10;
    this.card.visible = false;
    this.overlay.add(this.card);
    this._cardForW = 0;
    this._cardShown = -1;
    this._cardT0 = -1;
  }

  _redrawHudMarker(skin) {
    if (!this._markerCanvas || !this._markerTex) return;
    const ctx = this._markerCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 96, 64);
    ctx.translate(48, 34);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    const g = ctx.createLinearGradient(-36, 0, 36, 0);
    g.addColorStop(0, '#b9382c');
    g.addColorStop(0.32, '#d99b38');
    g.addColorStop(0.55, '#f3ebd8');
    g.addColorStop(0.75, '#22b8cf');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(30, -4);
    ctx.lineTo(-36, -14);
    ctx.lineTo(-24, -2);
    ctx.lineTo(-36, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.lineTo(4, 14);
    ctx.lineTo(-8, 14);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = skin?.bodyColor || '#56b847';
    ctx.beginPath();
    ctx.arc(-4, 12, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = skin?.eyeGlow || '#65e87a';
    ctx.beginPath();
    ctx.arc(-1, 9, 2.4, 0, TAU);
    ctx.fill();
    this._markerTex.needsUpdate = true;
  }

  _font(weight, px) {
    return `${weight} ${px}px Orbitron, Rajdhani, "Segoe UI", sans-serif`;
  }

  _lanternGlyph(ctx, x, y, s, color = '#ff9a3c') {
    const g = ctx.createLinearGradient(x, y - 7 * s, x, y + 7 * s);
    g.addColorStop(0, color);
    g.addColorStop(1, '#fff1b0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 4 * s, y + 6 * s);
    ctx.quadraticCurveTo(x - 7.5 * s, y - 1 * s, x - 5.5 * s, y - 5 * s);
    ctx.quadraticCurveTo(x, y - 9 * s, x + 5.5 * s, y - 5 * s);
    ctx.quadraticCurveTo(x + 7.5 * s, y - 1 * s, x + 4 * s, y + 6 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(80,20,0,0.45)';
    ctx.fillRect(x - 4 * s, y + 5 * s, 8 * s, 1.5 * s);
  }

  _gateGlyph(ctx, x, y, s) {
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.4 * s;
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.6 * s, 7.5 * s, 0, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  _txt(ctx, s, x, y, color, align = 'left', stroke = 3.5) {
    ctx.textAlign = align;
    if (stroke > 0) {
      ctx.lineWidth = stroke;
      ctx.strokeStyle = 'rgba(2,6,16,0.85)';
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  _drawHud(stage, dt) {
    const target = stage.bonus || 0;
    let disp = this._dispBonus;
    if (disp !== target) {
      disp += (target - disp) * Math.min(1, dt * 7);
      if (Math.abs(target - disp) < 1) disp = target;
      this._dispBonus = disp;
    }
    const bonus = Math.round(disp);
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const wide = this.width / this.height > 1.15;
    const panelW = wide ? Math.min(this.width * 0.275, 258) : Math.min(this.width - 20, 520);
    const panelH = 54;
    const hudTop = wide ? (this.height >= 600 ? 86 : 80) : HUD_TOP_OFFSET;
    const panelLeft = wide ? this.width - 12 - panelW : (this.width - panelW) * 0.5;
    const x0 = 30;
    const x1 = panelW - 40;
    const y = 41;
    this.hudPanel.scale.set(panelW, panelH, 1);
    this.hudPanel.position.set(panelLeft + panelW * 0.5, -(hudTop + panelH / 2), 0);
    this._trackX0 = panelLeft + x0;
    this._trackX1 = panelLeft + x1;
    this._trackY = hudTop + y;
    const lan = stage.collected || 0;
    const gates = stage.gatesPassed || 0;
    const dist = Math.max(0, Math.round((1 - clamp(stage.progress || 0, 0, 1)) * 48)) / 10;
    const glow = stage.nextGlow || '#5efce8';
    let d = this._hudDrawn;
    if (
      d &&
      d.W === panelW &&
      d.H === panelH &&
      d.top === hudTop &&
      d.vw === this.width &&
      d.vh === this.height &&
      d.pr === pr &&
      d.lan === lan &&
      d.gates === gates &&
      d.bonus === bonus &&
      d.dist === dist &&
      d.glow === glow
    ) {
      return;
    }
    if (!d) {
      d = this._hudDrawn = { W: 0, H: 0, top: 0, vw: 0, vh: 0, pr: 0, lan: -1, gates: -1, bonus: -1, dist: -1, glow: '' };
    }
    const sizeChanged = d.W !== panelW || d.H !== panelH || d.pr !== pr;
    d.W = panelW;
    d.H = panelH;
    d.top = hudTop;
    d.vw = this.width;
    d.vh = this.height;
    d.pr = pr;
    d.lan = lan;
    d.gates = gates;
    d.bonus = bonus;
    d.dist = dist;
    d.glow = glow;

    const c = this._hudCanvas;
    const cw = Math.round(panelW * pr);
    const ch = Math.round(panelH * pr);
    if (c.width !== cw || c.height !== ch || sizeChanged) {
      c.width = cw;
      c.height = ch;
      this._hudTex.dispose();
      this._hudTex = new THREE.CanvasTexture(c);
      this._hudTex.colorSpace = THREE.SRGBColorSpace;
      this.hudPanel.material.map = this._hudTex;
      this.hudPanel.material.needsUpdate = true;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, panelW, panelH);

    const g = ctx.createLinearGradient(0, 2, 0, panelH - 2);
    g.addColorStop(0, 'rgba(8, 15, 32, 0.72)');
    g.addColorStop(1, 'rgba(4, 9, 22, 0.68)');
    ctx.fillStyle = g;
    this._roundRect(ctx, 2, 2, panelW - 4, panelH - 4, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 169, 78, 0.42)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    this._lanternGlyph(ctx, 20, 19, 1.0);
    ctx.font = this._font(800, 14);
    this._txt(ctx, `${lan}`, 32, 19.5, '#f8fafc');
    const px = 32 + Math.max(20, ctx.measureText(`${lan}`).width + 12);
    this._gateGlyph(ctx, px + 4, 19, 0.95);
    this._txt(ctx, `${gates}`, px + 13, 19.5, '#cffafe');

    ctx.font = this._font(700, 7.5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
    this._txt(ctx, 'DISTANCE', panelW / 2, 12, 'rgba(148, 169, 201, 0.92)', 'center', 0);
    ctx.font = this._font(800, 11.5);
    this._txt(ctx, `${dist.toFixed(1)} KM`, panelW / 2, 24, '#f8fafc', 'center');

    ctx.font = this._font(700, 7.5);
    this._txt(ctx, 'SKY BONUS', panelW - 14, 11, 'rgba(255, 228, 77, 0.9)', 'right', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = this._font(800, wide ? 12.5 : 13.5);
    this._txt(ctx, bonus.toLocaleString('en-US'), panelW - 14, 23, '#ffe44d', 'right');

    ctx.fillStyle = 'rgba(2, 6, 16, 0.55)';
    this._roundRect(ctx, x0 - 2, y - 3.5, x1 - x0 + 4, 7, 3.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(123, 232, 255, 0.28)';
    ctx.stroke();

    const iconTop = 35;
    ctx.fillStyle = '#64748b';
    ctx.fillRect(12, iconTop + 2, 10, 9);
    ctx.fillRect(11, iconTop - 1, 2.5, 3);
    ctx.fillRect(15.5, iconTop - 1, 2.5, 3);
    ctx.fillRect(20, iconTop - 1, 2.5, 3);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(panelW - 30, iconTop - 2, 12, 15);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(panelW - 30, iconTop - 2, 12, 15);
    ctx.fillStyle = glow;
    ctx.fillRect(panelW - 27, iconTop + 1, 2.5, 3);
    ctx.fillRect(panelW - 23, iconTop + 1, 2.5, 3);

    this._hudTex.needsUpdate = true;
  }

  _comboTexFor(mult) {
    let t = this._comboTex[mult];
    if (t) return t;
    const col = mult >= 4 ? '#fde047' : mult === 3 ? '#fb923c' : '#5efce8';
    t = canvasTex(128, 128, (ctx) => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = this._font(900, 44);
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(2,6,16,0.9)';
      ctx.strokeText(`x${mult}`, 64, 58);
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      ctx.fillText(`x${mult}`, 64, 58);
      ctx.shadowBlur = 0;
      ctx.font = this._font(800, 14);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('COMBO', 66, 92);
    });
    this._comboTex[mult] = t;
    return t;
  }

  _drawCard(stage, shownBonus) {
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const W = Math.min(this.width - 36, 336);
    const H = 152;
    const c = this._cardCanvas;
    const cw = Math.round(W * pr);
    const ch = Math.round(H * pr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
      this._cardTex.dispose();
      this._cardTex = new THREE.CanvasTexture(c);
      this._cardTex.colorSpace = THREE.SRGBColorSpace;
      this.card.material.map = this._cardTex;
      this.card.material.needsUpdate = true;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const glow = stage.nextGlow || '#5efce8';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10, 18, 38, 0.92)');
    g.addColorStop(1, 'rgba(5, 9, 22, 0.94)');
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = g;
    this._roundRect(ctx, 6, 6, W - 12, H - 12, 16);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = this._font(800, 10);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2.8px';
    this._txt(
      ctx,
      stage.perfect ? 'PERFECT FLIGHT' : 'FLIGHT COMPLETE',
      W / 2,
      24,
      stage.perfect ? '#fde047' : '#7be8ff',
      'center',
      0
    );
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const cols = [
      [`${stage.lanternsCaught || 0}`, 'LANTERNS', 'lantern'],
      [`${stage.gatesPassed || 0}/${stage.gatesTotal || 0}`, 'GATES', 'gate'],
      [`${(stage.kites || 0) + (stage.goldCaught || 0)}`, 'KITES', 'kite'],
      [`+${stage.gearsEarned || 0}`, 'GEARS', 'gear'],
    ];
    const cw4 = (W - 24) / 4;
    for (let i = 0; i < 4; i++) {
      const cx = 12 + cw4 * (i + 0.5);
      const [val, label, icon] = cols[i];
      const ix = cx - 16 - (val.length > 2 ? 6 : 0);
      if (icon === 'lantern') this._lanternGlyph(ctx, ix, 52, 0.95);
      else if (icon === 'gate') this._gateGlyph(ctx, ix, 52, 0.9);
      else if (icon === 'kite') {
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          const r = k % 2 ? 3.2 : 7.5;
          if (k === 0) ctx.moveTo(ix + Math.cos(a) * r, 52 + Math.sin(a) * r);
          else ctx.lineTo(ix + Math.cos(a) * r, 52 + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(ix, 52, 5.2, 0, TAU);
        ctx.stroke();
      }
      ctx.font = this._font(900, val.length > 3 ? 13 : 16);
      this._txt(ctx, val, ix + 11, 53, '#f8fafc', 'left');
      ctx.font = this._font(700, 7.5);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.4px';
      this._txt(ctx, label, cx, 72, 'rgba(148, 169, 201, 0.9)', 'center', 0);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.strokeStyle = 'rgba(217, 169, 78, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 88);
    ctx.lineTo(W - 22, 88);
    ctx.stroke();
    ctx.font = this._font(800, 9);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    this._txt(ctx, 'SKY BONUS', 24, 116, 'rgba(255, 228, 77, 0.95)', 'left', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = this._font(900, 23);
    this._txt(ctx, `+${shownBonus.toLocaleString('en-US')}`, W - 24, 116, '#ffe44d', 'right', 4.5);
    this._cardTex.needsUpdate = true;
    this._cardW = W;
    this._cardH = H;
  }

  _popupTex(text, color) {
    const key = `${text}|${color}`;
    let e = this._popCache.get(key);
    if (e) {
      e.used = this._popFrame;
      return e;
    }
    const fs = 42;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `900 ${fs}px Orbitron, "Arial Black", sans-serif`;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    c.width = tw + 36;
    c.height = Math.ceil(fs * 1.55);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(4,8,22,0.92)';
    ctx.strokeText(text, c.width / 2, c.height / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, c.height / 2);
    ctx.shadowBlur = 0;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    e = { tex, aspect: c.width / c.height, used: this._popFrame, text, color };
    this._popCache.set(key, e);
    if (this._popCache.size > 48) {
      for (const [k, v] of this._popCache) {
        if (v.used < this._popFrame - 2) {
          v.tex.dispose();
          v.dead = true;
          this._popCache.delete(k);
          if (this._popCache.size <= 40) break;
        }
      }
    }
    return e;
  }

  _parseColor(str, out) {
    let a = this._colorCache.get(str);
    if (!a) {
      this._c2.set(str);
      a = [this._c2.r, this._c2.g, this._c2.b];
      this._colorCache.set(str, a);
    }
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return a;
  }

  // ------------------------------------------------------------------ theme look
  _applyTheme(key) {
    const T = THEMES[key] || THEMES.moonlit_storm;
    this._themeKey = key;
    this.theme = T;
    const U = this.U;
    U.uSkyTop.value.set(T.top);
    U.uSkyMid.value.set(T.mid);
    U.uSkyHor.value.set(T.hor);
    U.uHaze.value.set(T.haze);
    U.uSunCol.value.set(T.sun);
    U.uSunDir.value.set(T.sunDir[0], T.sunDir[1], T.sunDir[2]).normalize();
    U.uCloudLit.value.set(T.cloudLit);
    U.uCloudShade.value.set(T.cloudShade);
    U.uCloudRim.value.set(T.cloudRim);
    U.uLanternK.value = T.lanternK;
    this.scene.fog.color.copy(U.uHaze.value);

    const sk = this.skyMat.uniforms;
    sk.uSunSize.value = T.sunSize;
    sk.uStars.value = T.stars;
    sk.uMoon.value = T.moon;
    sk.uMoonFull.value = T.moonFull ?? 0;
    sk.uAurora.value = T.aurora ?? 0;
    sk.uRays.value = T.rays;
    sk.uCirrus.value = T.cirrus;
    sk.uRainbow.value = T.rainbow;
    sk.uDisc.value = T.disc ?? 1;

    const se = this.seaMat.uniforms;
    se.uDeep.value.set(T.sea);
    se.uFar.value.set(T.seaFar);
    se.uGlint.value = T.glint;
    se.uChop.value = T.chop;
    se.uFoam.value = T.foam;
    if (this.archFoamMat) this.archFoamMat.uniforms.uChop.value = T.chop;

    const isDarkTheme =
      key === 'moonlit_storm' || key === 'aurora' || key === 'night' || key === 'storm';
    this.hemi.color.set(T.hemiSky);
    this.hemi.groundColor.set(T.hemiGround);
    this.hemi.intensity = isDarkTheme ? 1.32 : 1.6;
    this.sunLight.color.set(T.light);
    this.sunLight.intensity = isDarkTheme ? 2.25 : T.lightI;
    this.sunLight.position.set(9, 14, 10);
    this.fill.intensity = isDarkTheme ? 0.55 : 0.95;
    this.fill.color.set(T.sun);
    this.exposure = this.era === 'original' ? Math.min(1.08, T.exposure + 0.04) : T.exposure;

    this.sailBackCol.value.set(T.sun).lerp(this._c2.set('#ffffff'), 0.4);
    this.sailBack.value = isDarkTheme ? 0.28 : 0.34;
    this.gliderRimCol.value.set(T.cloudRim);
    this.vigMat.uniforms.uColor.value.set(
      isDarkTheme ? '#030612' : key === 'ember' ? '#1a0408' : '#0a1530'
    );
    this.vigMat.uniforms.uStr.value = isDarkTheme ? 0.42 : 0.3;
    this.pogoLit.value = isDarkTheme ? 0.22 : 0.08;

    const c = this._c;
    const tint = (layer, base, k = 1) => {
      const bc = this._c3.copy(base);
      for (let i = 0; i < layer.items.length; i++) {
        c.copy(bc).multiplyScalar((layer.items[i].shade || 1) * k);
        layer.mesh.setColorAt(i, c);
      }
      layer.mesh.instanceColor.needsUpdate = true;
    };
    const dim = isDarkTheme ? 0.45 : key === 'ember' ? 0.42 : 1;
    tint(this.farIsles, this._c2.set('#8694a8').lerp(this._c.set(T.haze), 0.32).multiplyScalar(isDarkTheme ? 0.92 : 1.12), 1);
    tint(this.midIsles, this._c2.set('#bcc6d4').lerp(this._c.set(T.haze), 0.14).multiplyScalar(isDarkTheme ? 1.12 : 1.22), 1);
    tint(
      this.farTowers,
      this._c2.set('#b8c6db').lerp(this._c.set(T.haze), 0.16).multiplyScalar(isDarkTheme ? 1.06 : 1.18),
      1
    );
    if (this.seaArches) {
      tint(
        this.seaArches,
        this._c2.set('#c4cedb').lerp(this._c.set(T.haze), 0.10).multiplyScalar(isDarkTheme ? 1.18 : 1.26),
        1
      );
    }
    if (this.moonbeamMat) {
      this.moonbeamMat.uniforms.uColor.value.set(T.sun).lerp(this._c2.set('#7be8ff'), isDarkTheme ? 0.35 : 0.1);
      this.moonbeamMat.uniforms.uStr.value =
        key === 'moonlit_storm' || key === 'aurora'
          ? 0.26
          : key === 'dawn' || key === 'sunset' || key === 'day'
            ? 0.16
            : 0.1;
    }
    this._birdCol.set(T.isleFar).lerp(this._c2.set(T.haze), 0.3).multiplyScalar(0.75);
    if (this.summitMat) {
      this.summitMat.color.set(isDarkTheme ? '#7689a6' : '#a8b8cf');
      this.summitMat.emissiveIntensity = isDarkTheme ? 0.06 : 0.14;
    }
    this.isleMat.color.set('#b8b8b8').multiplyScalar(dim < 1 ? 0.58 + dim * 0.4 : 1);
    if (key === 'snow') this.isleMat.color.set('#d8dde6');
    this.palms.material.color.setScalar(dim < 1 ? 0.62 : 1);

    const pk = { none: -1, snow: 0, rain: 1, embers: 2, fireflies: 3, leaves: 4, drizzle: 5 }[
      T.precip
    ] ?? -1;
    const pm = this.precipMat.uniforms;
    this.precip.visible = pk >= 0;
    pm.uKind.value = Math.max(0, pk);
    pm.uColor.value.set(
      T.precipColor ||
        (pk === 0
          ? '#ffffff'
          : pk === 1 || pk === 5
            ? '#c3d2ec'
            : pk === 2
              ? '#ff8a3d'
              : pk === 3
                ? '#5efce8'
                : '#ffffff')
    );
    pm.uAlpha.value =
      pk === 0 ? 0.92 : pk === 1 ? 0.48 : pk === 5 ? 0.22 : pk === 2 ? 0.95 : pk === 3 ? 0.85 : 0.9;
    pm.uWind.value = pk === 1 ? 4 : pk === 4 ? 5 : pk === 0 ? 1.5 : 0.6;
    pm.uAdd.value = pk === 2 || pk === 3 ? 1 : 0;
    this.precip.geometry.setDrawRange(
      0,
      pk === 1 ? MAX_PRECIP : pk === 3 ? 160 : pk === 5 ? 260 : pk === 4 ? 90 : pk === 2 ? 220 : 420
    );
    this.thermalMesh.material.uniforms.uColor.value.set(T.thermalColor || '#4ff0d2');
  }

  // ------------------------------------------------------------------ glow & particle helpers
  _glowBegin() {
    this._sN = 0;
    this._gN = 0;
    this._tN = 0;
  }
  _glow(x, y, z, size, r, g, b, sy = size) {
    if (this._gN >= MAX_GLOW || size <= 0) return;
    const i = this._gN++;
    putMat(this.glowMesh.instanceMatrix.array, i, x, y, z, size, sy);
    const c = this.glowMesh.instanceColor.array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }
  _star(x, y, z, size, rot, r, g, b) {
    if (this._tN >= MAX_STAR || size <= 0) return;
    const i = this._tN++;
    putMat(this.starMesh.instanceMatrix.array, i, x, y, z, size, size, 1, rot);
    const c = this.starMesh.instanceColor.array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }
  _shade(x, y, z, size, sy = size) {
    if (this._sN >= MAX_SHADE) return;
    putMat(this.shadeMesh.instanceMatrix.array, this._sN++, x, y, z, size, sy);
  }
  _glowEnd() {
    this.shadeMesh.count = this._sN;
    this.shadeMesh.instanceMatrix.needsUpdate = true;
    this.glowMesh.count = this._gN;
    this.glowMesh.instanceMatrix.needsUpdate = true;
    this.glowMesh.instanceColor.needsUpdate = true;
    this.starMesh.count = this._tN;
    this.starMesh.instanceMatrix.needsUpdate = true;
    this.starMesh.instanceColor.needsUpdate = true;
  }

  _spawnPuff(x, y, z, vx, vy, size, life, g, r, gg, b, drag = 1, kind = 0) {
    const p = this.puffs[this._puffIdx];
    this._puffIdx = (this._puffIdx + 1) % MAX_PUFF;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.size = size;
    p.life = life;
    p.max = life;
    p.g = g;
    p.r = r;
    p.gg = gg;
    p.b = b;
    p.drag = drag;
    p.kind = kind;
  }

  _spawnStreak(x, y, z, len, v, life, a, rz = 0, vy = 0) {
    const s = this.streaks[this._streakIdx];
    this._streakIdx = (this._streakIdx + 1) % MAX_STREAK;
    s.rz = rz;
    s.vy = vy;
    s.x = x;
    s.y = y;
    s.z = z;
    s.len = len;
    s.v = v;
    s.life = life;
    s.max = life;
    s.a = a;
  }

  prewarm() {
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const restore = () => {
      for (const o of hidden) o.visible = false;
    };
    try {
      this.gl.compile(this.overlay, this.oCam);
      this.gl.compile(this.scene, this.camera);
    } catch (_) {
      // Optional shader pre-warm
    }
    restore();
    return Promise.resolve();
  }

  // ------------------------------------------------------------------ render
  _resetRide(stage) {
    this._stageRef = stage;
    for (let i = 0; i < MAX_PUFF; i++) this.puffs[i].life = 0;
    for (let i = 0; i < MAX_STREAK; i++) this.streaks[i].life = 0;
    const vfx = stage.vfx || EMPTY;
    this._lastVfxId = vfx.length ? vfx[vfx.length - 1].id : 0;
    const g = stage.glider || {};
    this._lastFlaps = g.flaps || 0;
    this._lastCatches = g.catches || 0;
    this._lastSkims = g.skims || 0;
    this._lastHits = stage.hits || 0;
    this._sq = 0;
    this._sqV = 0;
    this._cheer = 0;
    this._flapAnim = 0;
    this._dispBonus = stage.bonus || 0;
    this._camFX = 0;
    this._camFY = 0;
    this._cardShown = -1;
    this._cardT0 = -1;
    this._comboAlpha = 0;
    this._flash = 0;
    this._vortexInit = false;
  }

  render(stageOrState, ctx = {}) {
    let stage = stageOrState;
    let opts = ctx || {};
    if (stage && !stage.glider && (stage.glide || stage.glideStage)) {
      opts = stage;
      stage = stage.glide || stage.glideStage;
    }
    if (!stage) return;

    if (opts.era && opts.era !== this.era) {
      this.setEra(opts.era);
    }
    if (opts.player?.skinId && opts.player.skinId !== this.skinId) {
      this.setSkin(opts.player.skinId);
    }

    const time = opts.time ?? stage.t ?? 0;
    const particles = opts.particles ?? null;
    const popups = opts.popups ?? null;
    const shake = opts.shake ?? 0;

    const gl = this.gl;
    const dt = this._lastTime === null ? 1 / 60 : clamp(time - this._lastTime, 0, 0.05);
    this._lastTime = time;
    this._kx = stage.width ? this.width / stage.width : 1;
    this._ky = stage.height ? this.height / stage.height : 1;
    const U = this.U;
    U.uTime.value = time;
    if (stage !== this._stageRef || (stage.t || 0) < this._lastStageT) this._resetRide(stage);
    this._lastStageT = stage.t || 0;

    const key = stage.themeKey || (this.era === 'original' ? 'day' : 'moonlit_storm');
    if (key !== this._themeKey) this._applyTheme(key);

    const pxw = this._pxw(0) * this._kx;
    const scrollW = (stage.scroll || 0) * pxw;
    U.uScrollW.value = scrollW;
    const v = this._v;
    const seaW = this._toWorld(0, stage.seaY ?? stage.height * 0.905, 0, v).y;
    this._seaW = seaW;
    U.uSeaY.value = seaW;
    this.sea.position.y = seaW;
    const pm = this.precipMat.uniforms;
    pm.uYmin.value = seaW - 1;
    pm.uYmax.value = this._elevY(-10, 30 * DEG) + 4;
    const pr = gl.getPixelRatio ? gl.getPixelRatio() : this._dpr;
    const focal = (this.height * pr) / (2 * Math.tan(FOV * 0.5 * DEG));
    pm.uPx.value = focal;
    this.puffMat.uniforms.uPx.value = focal;

    this._flash *= Math.exp(-7 * dt);
    if (key === 'storm' || key === 'moonlit_storm' || key === 'ember') {
      this._ambFlashT -= dt;
      if (this._ambFlashT <= 0) {
        this._ambFlashT = 3.2 + Math.random() * 4.5;
        this._flash = Math.max(this._flash, key === 'storm' ? 0.32 : 0.16);
      }
    }
    U.uFlash.value = this._flash;

    const mag =
      (Number(typeof shake === 'object' ? Math.hypot(shake.x || 0, shake.y || 0) : shake) || 0) * 0.022;
    this._updateCamera(stage, time, dt, mag);

    this._updateLayers(scrollW, seaW);
    this._updateClouds(stage, scrollW, seaW, time);

    this._glowBegin();
    this._updateHorizonGlows(time, seaW);
    this._updateTowers(stage, seaW, time);
    this._updateGlider(stage, time, dt, pxw, scrollW);
    this._updateLanterns(stage, time, pxw, seaW);
    this._updateGates(stage, time, pxw, seaW);
    this._updateThermals(stage, time, dt, pxw, seaW);
    this._updateStorms(stage, time, pxw, seaW);
    this._updateGulls(stage, time, dt, pxw, scrollW, seaW);
    this._updateRings(stage, pxw);
    this._updateVfx(stage, time, pxw, seaW);
    this._updateStreaks(stage, dt, pxw);
    this._updatePuffs(dt, seaW);
    this._updateSeaGlints(time, seaW);
    this._glowEnd();

    this._popFrame++;
    this._updateFxGroup(stage);
    this._drawHud(stage, dt);
    this._updateHud(stage, time, dt);
    this._updateWarnings(stage, time);
    this._updateCinematic(stage);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, stage);

    const g = stage.glider;
    this.vigMat.uniforms.uFlash.value = g && g.stun > 0 ? (g.stun / (g.stunMax || 1)) * 0.35 : 0;
    this.vigMat.uniforms.uWhite.value = Math.min(0.45, this._flash * 0.45);

    // Strict WebGL state save & restore (`setRenderTarget(null)`, `autoClear`, `toneMapping`, `toneMappingExposure`)
    const prevRenderTarget = gl.getRenderTarget ? gl.getRenderTarget() : null;
    const prevAutoClear = gl.autoClear;
    const prevToneMapping = gl.toneMapping;
    const prevExposure = gl.toneMappingExposure;
    try {
      if (gl.setRenderTarget) gl.setRenderTarget(null);
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = this.exposure * (1 + this._flash * 0.3);
      gl.autoClear = true;
      gl.render(this.scene, this.camera);
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(this.overlay, this.oCam);
    } finally {
      if (gl.setRenderTarget) gl.setRenderTarget(prevRenderTarget);
      gl.autoClear = prevAutoClear;
      gl.toneMapping = prevToneMapping;
      gl.toneMappingExposure = prevExposure;
    }
  }

  _updateCamera(stage, time, dt, mag) {
    const arriving = stage.phase === 'arrive' || stage.phase === 'done';
    const at = arriving ? stage.arriveT || 0 : 0;
    const cine = arriving ? smooth01((at - 0.4) / 2.4) : 0;
    this._cine = cine;
    const intro = stage.phase === 'intro' ? 1 - smooth01(((stage.t || 0) - 0.6) / 1.9) : 0;
    this._intro = intro;
    const g = stage.glider;
    const gw = g ? this._toWorld(g.x, g.y, 0, this._v3) : this._v3.set(0, 0, 0);
    const kf = 1 - Math.exp(-1.6 * dt);
    this._camFX += (gw.x * 0.05 - this._camFX) * kf;
    this._camFY += (gw.y * 0.07 - this._camFY) * kf;
    const dX = Math.sin(time * 0.29) * 0.08 + Math.sin(time * 0.71) * 0.03;
    const dY = Math.cos(time * 0.21) * 0.07 + Math.sin(time * 0.57) * 0.03;
    const close = Math.max(intro, cine * 0.85);
    const camZ = lerp(CAM_Z, 11.2, close);
    const k = 1 - camZ / CAM_Z;
    const fx = lerp(this._camFX + dX, gw.x * k * 1.05, close);
    const fy = lerp(this._camFY + dY, gw.y * k * 0.95, close);
    this.camera.position.set(fx + Math.sin(time * 73.7) * mag, fy + Math.cos(time * 61.3) * mag * 0.85, camZ);
    const bank = g && !arriving ? clamp((g.vy || 0) * -0.00006, -0.02, 0.02) : 0;
    this.camera.rotation.set(PITCH - cine * 0.03, 0, Math.sin(time * 0.17) * 0.008 * (1 - close) + bank);
    this.camera.updateMatrixWorld();
  }

  _updateFxGroup(stage) {
    const W = this.width;
    const H = this.height;
    const a = this._toWorld(0, 0, 0, this._va).project(this.camera);
    const b = this._toWorld(stage.width || W, stage.height || H, 0, this._vb).project(this.camera);
    const ax = (a.x + 1) * 0.5 * W;
    const ay = (1 - a.y) * 0.5 * H;
    const bx = (b.x + 1) * 0.5 * W;
    const by = (1 - b.y) * 0.5 * H;
    const g = this.fxGroup;
    g.position.set(ax, -ay, 0);
    g.scale.set((bx - ax) / W, (by - ay) / H, 1);
  }

  _updateLayers(scrollW, seaW) {
    const layers = this.layers;
    const d = this._dummy;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      if (layer === this.cloudLayer) continue;
      if (layer === this.moonbeamLayer) {
        const { mesh, items } = layer;
        mesh.count = items.length;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const span = it.span;
          let x = (it.u * span - scrollW * 0.45) % span;
          if (x < 0) x += span;
          x -= span * 0.5;
          d.position.set(x, seaW - 1.5, it.z);
          d.rotation.set(0, 0, it.slant);
          d.scale.set(it.sx, it.sy, 1);
          d.updateMatrix();
          mesh.setMatrixAt(i, d.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        continue;
      }
      const { mesh, items } = layer;
      const arr = mesh.instanceMatrix.array;
      const n = mesh.count;
      for (let i = 0; i < n; i++) {
        const it = items[i];
        const span = it.span;
        let x = (it.u * span - scrollW) % span;
        if (x < 0) x += span;
        x -= span * 0.5;
        it.x = x;
        it.y = seaW - (layer.kind === 'tower' ? 0.5 : layer.kind === 'arch' ? 0.08 : 0.25) * (it.sy || 1) * 0.1;
        arr[i * 16 + 12] = x;
        arr[i * 16 + 13] = it.y;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  _updateClouds(stage, scrollW, seaW, time) {
    const items = this.cloudItems;
    const arr = this.cloudMesh.instanceMatrix.array;
    const n = this.cloudMesh.count;
    const wind = time * 0.6;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const span = it.span;
      let x = (it.u * span - scrollW - wind * it.drift) % span;
      if (x < 0) x += span;
      x -= span * 0.5;
      const y = seaW + this._elevY(it.z, it.el) + 0.5;
      putMat(arr, i, x, y, it.z, it.w * it.flip, it.w);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;

    const fa = this.fgCloudMesh.instanceMatrix.array;
    const intro = this._intro;
    const H0 = seaW;
    const H1 = this._toWorld(0, stage.top || stage.height * 0.19, 0, this._v2).y;
    for (let i = 0; i < this.fgItems.length; i++) {
      const it = this.fgItems[i];
      const span = 2 * this._halfW(it.z) + it.w * 3;
      let x = (it.u * span - scrollW * 1.35 - time * 0.4) % span;
      if (x < 0) x += span;
      x -= span * 0.5;
      const y = lerp(H0, H1, it.yf) * ((CAM_Z - it.z) / CAM_Z) - it.w * 0.18;
      putMat(fa, i, x, y, it.z, it.w * it.flip, it.w * (1 - intro * 0.9));
    }
    this.fgCloudMesh.instanceMatrix.needsUpdate = true;
  }

  _updateHorizonGlows(time, seaW) {
    const L = this.farTowers;
    const d = this._dummy;
    let nb = 0;
    for (let i = 0; i < L.mesh.count; i++) {
      const it = L.items[i];
      const p = 0.72 + 0.28 * Math.sin(time * 2.4 + i * 1.9);
      const c = it.glow;
      const cupolaY = it.y + it.sy * 1.05;
      const s = 2.6 + it.sx * 1.15;
      // Blazing Golden Cupola Beacon Halo + Star Flare + Sea Reflection Shimmer
      this._glow(it.x, cupolaY, it.z + 1.2, s * 1.35 * p, c.r * 0.34 * p, c.g * 0.28 * p, c.b * 0.16 * p);
      this._star(it.x, cupolaY, it.z + 1.5, it.sx * 0.48 * p, time * 0.5 + i, c.r * 0.85 * p, c.g * 0.75 * p, c.b * 0.48 * p);
      this._glow(it.x, seaW + 0.18, it.z + it.sx * 1.5, it.sx * 4.2, c.r * 0.14 * p, c.g * 0.11 * p, c.b * 0.06 * p, it.sx * 0.55);

      if (this.lighthouseBeamMesh && nb < MAX_LIGHTHOUSE_BEAMS) {
        const sweepYaw = time * (it.beamSpd || 0.45) + (it.beamPh || 0);
        const bLen = (it.beamLen || 34) * 1.32;
        const bRad = bLen * 0.17;
        d.rotation.order = 'YXZ';
        d.position.set(it.x, cupolaY, it.z);
        d.rotation.set(0, sweepYaw, -0.06);
        d.scale.set(bLen, bRad, bRad);
        d.updateMatrix();
        this.lighthouseBeamMesh.setMatrixAt(nb, d.matrix);
        d.rotation.order = 'XYZ';
        this._c.setRGB(c.r * 0.92, c.g * 0.82, c.b * 0.58);
        this.lighthouseBeamMesh.setColorAt(nb, this._c);
        nb++;
      }
    }
    if (this.lighthouseBeamMesh) {
      this.lighthouseBeamMesh.count = nb;
      this.lighthouseBeamMesh.instanceMatrix.needsUpdate = true;
      if (this.lighthouseBeamMesh.instanceColor) this.lighthouseBeamMesh.instanceColor.needsUpdate = true;
    }
    if (this.horizonMistMesh) {
      const scrollW = this.U.uScrollW.value || 0;
      let nm = 0;
      // 1. Ground every 3D Watchtower in a swirling basal sea-mist bank
      for (let i = 0; i < L.mesh.count && nm < MAX_HORIZON_MIST; i++) {
        const it = L.items[i];
        const mw = it.sx * 6.8;
        const mh = Math.min(18, it.sy * 0.36);
        d.position.set(it.x + Math.sin(time * 0.25 + i) * 1.4, seaW + mh * 0.28, it.z + 1.8);
        d.rotation.set(0, 0, 0);
        d.scale.set(mw, mh, 1);
        d.updateMatrix();
        this.horizonMistMesh.setMatrixAt(nm, d.matrix);
        this._c.setRGB(0.92, 0.75, 1.0);
        this.horizonMistMesh.setColorAt(nm, this._c);
        nm++;
      }
      // 2. Rolling multi-depth archipelago sea-fog banks across the horizon
      for (let i = 0; i < this.horizonMistBanks.length && nm < MAX_HORIZON_MIST; i++) {
        const b = this.horizonMistBanks[i];
        const par = clamp(90 / Math.max(60, -b.z), 0.25, 1.0);
        let mx = (b.u * b.span - scrollW * par + time * b.drift) % b.span;
        if (mx < 0) mx += b.span;
        mx -= b.span * 0.5;
        d.position.set(mx, seaW + b.sy * 0.26, b.z);
        d.rotation.set(0, 0, 0);
        d.scale.set(b.sx, b.sy, 1);
        d.updateMatrix();
        this.horizonMistMesh.setMatrixAt(nm, d.matrix);
        this._c.setRGB(0.78, 0.55, 1.0);
        this.horizonMistMesh.setColorAt(nm, this._c);
        nm++;
      }
      this.horizonMistMesh.count = nm;
      this.horizonMistMesh.instanceMatrix.needsUpdate = true;
      if (this.horizonMistMesh.instanceColor) this.horizonMistMesh.instanceColor.needsUpdate = true;
    }
    if (this.seaArches) {
      const A = this.seaArches;
      const d = this._dummy;
      let nf = 0;
      for (let i = 0; i < A.mesh.count; i++) {
        const it = A.items[i];
        const cr = Math.cos(it.ry || 0);
        const sr = Math.sin(it.ry || 0);
        const surfPulse = 0.88 + 0.12 * Math.sin(time * 2.4 + i * 1.7);
        if (this.archFoamMesh) {
          for (const s of [-1, 1]) {
            if (nf >= MAX_ARCH_FOAM) break;
            const lx = it.x + s * cr * it.sx * 1.12;
            const lz = it.z - s * sr * it.sx * 1.12;
            d.position.set(lx, seaW, lz);
            d.rotation.set(0, time * 0.14 * s + i, 0);
            const fr = it.sx * 2.25 * surfPulse;
            d.scale.set(fr, 1, fr * 0.95);
            d.updateMatrix();
            this.archFoamMesh.setMatrixAt(nf, d.matrix);
            this._c.setRGB(0.86 * surfPulse, 0.94 * surfPulse, 1.0 * surfPulse);
            this.archFoamMesh.setColorAt(nf, this._c);
            nf++;
          }
        }
        if (!it.beacon) continue;
        const fl = 0.72 + 0.28 * Math.sin(time * 6.5 + i * 2.7);
        const bx = it.x - cr * it.sx * 0.28;
        const by = it.y + it.sy * 1.46;
        const bz = it.z + 0.6;
        this._glow(bx, by, bz, it.sx * 0.75 * fl, 0.95 * 0.3 * fl, 0.66 * 0.3 * fl, 0.22 * 0.3 * fl);
        this._star(bx, by, bz + 0.2, it.sx * 0.24 * fl, time * 0.8 + i, 1.0 * fl, 0.82 * fl, 0.42 * fl);
      }
      if (this.archFoamMesh && this.midIsles) {
        const M = this.midIsles;
        for (let i = 0; i < M.mesh.count && nf < MAX_ARCH_FOAM; i++) {
          const it = M.items[i];
          const sp = 0.86 + 0.14 * Math.sin(time * 2.1 + i * 2.3);
          d.position.set(it.x, seaW, it.z);
          d.rotation.set(0, -time * 0.08 + i, 0);
          const fr = it.sx * 2.65 * sp;
          d.scale.set(fr, 1, fr);
          d.updateMatrix();
          this.archFoamMesh.setMatrixAt(nf, d.matrix);
          this._c.setRGB(0.76 * sp, 0.85 * sp, 0.96 * sp);
          this.archFoamMesh.setColorAt(nf, this._c);
          nf++;
        }
      }
      if (this.archFoamMesh) {
        this.archFoamMesh.count = nf;
        this.archFoamMesh.instanceMatrix.needsUpdate = true;
        if (this.archFoamMesh.instanceColor) this.archFoamMesh.instanceColor.needsUpdate = true;
      }
    }
    if (this._flash > 0.05 && (this._themeKey === 'storm' || this._themeKey === 'moonlit_storm')) {
      const f = this._flash;
      this._glow(
        -30 + Math.sin(time * 3.1) * 60,
        seaW + 30,
        SKY_Z + 20,
        220 * f,
        0.35 * f,
        0.44 * f,
        0.62 * f,
        120 * f
      );
    }
  }

  _updateTowers(stage, seaW, time) {
    const v = this._v;
    const sm = stage.summit;
    const smVisible = !!sm && sm.x > -sm.r * 3 && (stage.t || 0) < 8;
    this.summitMesh.visible = smVisible;
    this.flag.visible = smVisible;
    if (smVisible) {
      if (this._summitHex !== sm.glow) {
        this._summitHex = sm.glow;
        this.flagMat.color.set(sm.glow || '#fbbf24');
      }
      const R = sm.r * this._pxw(0) * this._kx;
      const cx = this._toWorld(sm.x, sm.y, 0, v).x;
      const topY = this._toWorld(sm.x, sm.y, 0, this._v2).y;
      const cz = -R * 0.68;
      this.summitMesh.position.set(cx, topY, cz);
      this.summitMesh.scale.setScalar(R);
      this.flag.position.set(cx - R * 0.5, topY, cz - R * 0.5);
      this.flag.scale.setScalar(R * 0.9);
      this._glow(cx, topY + 0.3, cz + R + 0.2, R * 2.4, 0.2, 0.17, 0.1, R * 0.5);
    }

    const tw = stage.tower;
    const show = !!(tw && tw.active);
    this.nextTower.visible = this.crown.visible = this.isle.visible = show;
    this.palms.visible = show;
    if (!show) return;
    if (this._glowHex !== tw.glow) {
      this._glowHex = tw.glow;
      this._glowColor.set(tw.glow || '#5efce8');
      this.towerMat.emissive.copy(this._glowColor);
      this.crownMat.emissive.copy(this._glowColor).multiplyScalar(0.12);
    }
    const dpt = clamp(tw.depth || 0, 0, 1);
    const inv0 = 1 / (CAM_Z - TOWER_FAR_Z);
    const inv1 = 1 / (CAM_Z - TOWER_Z);
    const z = CAM_Z - 1 / lerp(inv0, inv1, Math.pow(dpt, 2.4));
    const x = this._toWorld(tw.x, 0, z, v).x;
    const R = tw.r * this._pxw(TOWER_Z) * this._kx;
    const height = 24;
    const y0 = seaW + 0.55;
    this.nextTower.position.set(x, y0, z);
    this.nextTower.scale.set(R, height, R);
    this.crown.position.set(x, y0 + height, z);
    this.crown.scale.set(R, R * 0.75, R);
    const tile = (TAU * R) / 7;
    this.towerTex.repeat.set(7, height / tile);
    this.winTex.repeat.set(7, height / tile);

    const landW = this._toWorld(0, stage.landY ?? stage.seaY - 26, 0, this._v2).y;
    const isleH = Math.max(0.3, landW - seaW);
    const isleR = Math.max(R * 2.2, 0 - TOWER_Z + 1.6);
    const ix = x - R * 0.8;
    this.isle.position.set(ix, seaW - 0.02, z);
    this.isle.scale.set(isleR * 1.4, isleH, isleR);
    this.palms.visible = true;
    const parr = this.palms.instanceMatrix.array;
    const d = this._dummy;
    for (let i = 0; i < this.palmSpots.length; i++) {
      const sp = this.palmSpots[i];
      d.position.set(ix + sp[0] * isleR * 1.4, seaW + isleH * 0.98, z + sp[1] * isleR);
      d.rotation.set(0, sp[3] + Math.sin(time * 0.8 + i) * 0.03, Math.sin(time * 1.1 + i * 2) * 0.025);
      d.scale.setScalar(sp[2] * clamp(isleR / 8, 0.8, 1.6));
      d.updateMatrix();
      d.matrix.toArray(parr, i * 16);
    }
    this.palms.instanceMatrix.needsUpdate = true;
    const arrive =
      stage.phase === 'arrive' || stage.phase === 'done' ? clamp((stage.arriveT || 0) / 1.5, 0, 1) : 0;
    this.towerMat.emissiveIntensity = 1.45 + arrive * 1.1 + Math.sin(time * 2) * 0.16 + (1 - dpt) * 1.1;
    const g = this._glowColor;
    const dist = CAM_Z - z;
    const k = clamp(30 / dist, 0.15, 1);
    const hs = (0.2 + arrive * 0.16) * (0.6 + 0.4 * (1 - dpt));
    this._glow(x, y0 + Math.min(height * 0.3, 8), z - 1, (R * 5) / k * 0.5 + 6, g.r * hs, g.g * hs, g.b * hs);
    const bp = 0.6 + 0.4 * Math.sin(time * 3.2);
    const by = y0 + height + R * 2.2;
    this._glow(x, by, z + R, (R * 2 + dist * 0.016) * bp, g.r * 0.4 * bp, g.g * 0.4 * bp, g.b * 0.4 * bp);
    this._star(
      x,
      by,
      z + R + 0.2,
      (R * 1.3 + dist * 0.012) * bp,
      time * 0.4,
      g.r * 0.65 * bp,
      g.g * 0.65 * bp,
      g.b * 0.65 * bp
    );
    this._glow(x, seaW + 0.1, z + isleR * 0.9, isleR * 3, g.r * 0.1, g.g * 0.1, g.b * 0.1, isleR * 0.4);
  }

  _updateGlider(stage, time, dt, pxw, scrollW = 0) {
    const gs = stage.glider;
    const outer = this.gOuter;
    if (!gs) {
      outer.visible = false;
      if (this.vortexRibbonMesh) this.vortexRibbonMesh.visible = false;
      return;
    }
    outer.visible = true;
    const flaps = gs.flaps || 0;
    if (flaps !== this._lastFlaps) {
      if (flaps > this._lastFlaps) {
        this._flapAnim = 1;
        this._sqV -= 3.2;
      }
      this._lastFlaps = flaps;
    }
    const catches = gs.catches || 0;
    if (catches !== this._lastCatches) {
      if (catches > this._lastCatches) {
        this._cheer = 1;
        this._sqV += 2.6;
      }
      this._lastCatches = catches;
    }
    const hits = stage.hits || 0;
    if (hits !== this._lastHits) {
      if (hits > this._lastHits) this._sqV += 8;
      this._lastHits = hits;
    }
    this._sqV += (-150 * this._sq - 8 * this._sqV) * dt;
    this._sq = clamp(this._sq + this._sqV * dt, -0.5, 0.5);
    this._cheer *= Math.exp(-2.6 * dt);
    this._flapAnim *= Math.exp(-4.2 * dt);

    const gw = this._toWorld(gs.x, gs.y, 0, this._v);
    const sc = (gs.rx * pxw) / 0.64;
    this._gSc = sc;
    const launch = gs.launch ?? 1;
    const landed = gs.landed || 0;
    const grounded = Math.max(1 - smooth01(launch * 1.6), smooth01(landed * 3));
    const vx = gs.vx || 0;
    const vy = gs.vy || 0;
    const sp = (stage.scrollSpeed || 0) + Math.max(0, vx) + 40;
    const path = Math.atan2(-vy, Math.max(60, sp));
    let pitch = clamp(path * 0.55, -0.36, 0.28) + (gs.flare || 0) * 0.38 + this._flapAnim * 0.14;
    pitch = lerp(pitch, 0.12, grounded);
    const bob = Math.sin(time * 1.9) * 0.05 * sc * (1 - grounded);
    const footY = this._feetLocalY * sc;
    let oy = gw.y + 0.55 * sc;
    if (grounded > 0) {
      const surfY = this._toWorld(0, landed > 0 ? stage.landY : stage.summitY, 0, this._v2).y;
      oy = lerp(oy, surfY - footY + 0.05 * sc, grounded);
    }
    const sq = this._sq;
    outer.position.set(gw.x, oy + bob, 0);
    outer.scale.set(sc * (1 + sq * 0.1), sc * (1 - sq * 0.14), sc * (1 + sq * 0.06));
    const roll = Math.sin(time * 1.3) * 0.04 * (1 - grounded) + clamp(vy * 0.0002, -0.05, 0.05);
    const yaw = -0.42 + clamp(vx * 0.0005, -0.1, 0.1);
    outer.rotation.set(roll, yaw, pitch);
    this.gWing.rotation.x = lerp(-0.4, -0.1, grounded) + clamp(vy * 0.0004, -0.08, 0.08);
    this.gInner.rotation.x = gs.spin || 0;
    const fl = this._flapAnim;
    this.gBody.scale.set(1, 1 + fl * Math.sin(fl * 9) * 0.12, 1 + fl * 0.08);

    const dive = gs.dive || 0;
    const lift = gs.lift || 0;
    const air = 1 - grounded;

    // ---- Update Real 33-Bone `PogoRig` Pilot (Trapeze Grip in Flight + 2-Bone IK Sprint/Celebrate on Ground)
    if (this.pogoRig) {
      const sprinting = launch < 1 && (stage.t || 0) > 0.25;
      const landingRun = landed > 0 && landed < 0.45;
      const landedCheer = landed >= 0.45 ? smooth01((landed - 0.45) / 0.35) : 0;
      const ps = this._poseState;
      ps.time = time;
      ps.vx = grounded > 0.35 ? (sprinting ? 4.4 * (1 - launch) : landingRun ? 3.2 * (1 - landed * 2) : 0) : 0;
      ps.vy = grounded > 0.35 ? 0 : clamp(-vy * 0.006, -3.5, 3.5);
      ps.grounded = grounded > 0.45;
      ps.inElevator = false;
      ps.shooting = 0;
      ps.hitTimer = gs.stun > 0 ? 0.35 : 0;
      ps.drowning = 0;
      ps.celebrating = Math.max(this._cheer * 0.45, landedCheer);
      ps.facing = 1;
      ps.lookYaw = clamp(-vy * 0.0008, -0.28, 0.28);

      this.pogoRig.update(dt, ps);

      const b = this.pogoRig.bones;
      if (b) {
        if (b.blaster) b.blaster.visible = false;
        if (b.root) {
          b.root.rotation.y = 0;
          b.root.position.y = lerp(b.root.position.y, 0.298, air);
        }
        const barX = this._gripBarPos ? this._gripBarPos.x : 0.36;
        const barY = this._gripBarPos ? this._gripBarPos.y : -0.92;
        // Blend mount from upright sprint/landing (-1.56 feet on ground) to dorsal trapeze suspension
        const pullUp = fl * 0.07 + dive * 0.04;
        this.pogoMount.position.set(
          lerp(barX - 0.29, barX - 0.41 + pullUp * 0.4, air),
          lerp(-1.56, barY - 0.29 + pullUp, air),
          0
        );
        this.pogoMount.rotation.y = Math.PI * 0.5 - 0.16 + clamp(vx * 0.0004, -0.08, 0.08);
        this.pogoMount.rotation.z = this._cheer * Math.sin(time * 18) * 0.05 * air;

        // Forward prone hang-glider harness lean in flight, upright on summit/beach
        const pronePitch = (0.94 + dive * 0.22 - lift * 0.1 - fl * 0.12) * air;
        if (b.pelvis) {
          b.pelvis.rotation.x = lerp(b.pelvis.rotation.x, pronePitch, air);
          b.pelvis.rotation.z = lerp(b.pelvis.rotation.z, clamp(vy * 0.00025, -0.1, 0.1), air);
        }
        if (b.spine) b.spine.rotation.x = lerp(b.spine.rotation.x, -0.12, air);
        if (b.chest) b.chest.rotation.x = lerp(b.chest.rotation.x, -0.14 - fl * 0.1, air);
        if (b.neck) b.neck.rotation.x = lerp(b.neck.rotation.x, -0.34, air);
        if (b.head) {
          b.head.rotation.x = lerp(b.head.rotation.x, -0.36 + clamp(vy * 0.0005, -0.18, 0.18), air);
          b.head.rotation.y = lerp(b.head.rotation.y, -0.14 + clamp(-vy * 0.0004, -0.22, 0.22), air);
          b.head.rotation.z = lerp(b.head.rotation.z, clamp(vy * 0.0003, -0.14, 0.14), air);
        }

        // Raise both 3-fingered hands onto `grip_bar` (x = 0.36, y = -0.92, z = +-0.24)
        const gripKeep = 1 - landedCheer * 0.85;
        if (gripKeep > 0.02) {
          const shLift = lerp(-1.82, -1.28 - fl * 0.26 - dive * 0.12, air);
          const elBend = lerp(-0.46, -0.36 - fl * 0.24, air);
          if (b.shoulderL) b.shoulderL.rotation.z = lerp(b.shoulderL.rotation.z, -0.12, gripKeep);
          if (b.shoulderR) b.shoulderR.rotation.z = lerp(b.shoulderR.rotation.z, 0.12, gripKeep);
          if (b.upperArmL) {
            b.upperArmL.rotation.x = lerp(b.upperArmL.rotation.x, shLift, gripKeep);
            b.upperArmL.rotation.z = lerp(b.upperArmL.rotation.z, -0.18, gripKeep);
          }
          if (b.upperArmR) {
            b.upperArmR.rotation.x = lerp(b.upperArmR.rotation.x, shLift, gripKeep);
            b.upperArmR.rotation.z = lerp(b.upperArmR.rotation.z, 0.18, gripKeep);
          }
          if (b.forearmL) b.forearmL.rotation.x = lerp(b.forearmL.rotation.x, elBend, gripKeep);
          if (b.forearmR) b.forearmR.rotation.x = lerp(b.forearmR.rotation.x, elBend, gripKeep);
          if (b.handL) b.handL.rotation.x = lerp(b.handL.rotation.x, 0.38, gripKeep);
          if (b.handR) b.handR.rotation.x = lerp(b.handR.rotation.x, 0.38, gripKeep);
        }

        // Aerodynamic trailing webbed feet + lively flutter-kick on wing-flap & lantern cheer
        if (air > 0.02) {
          const kickL =
            Math.sin(time * 3.2) * 0.1 +
            fl * Math.sin(time * 25) * 0.48 +
            this._cheer * Math.sin(time * 20) * 0.36;
          const kickR =
            Math.sin(time * 3.2 + Math.PI) * 0.1 +
            fl * Math.sin(time * 25 + Math.PI) * 0.48 +
            this._cheer * Math.sin(time * 20 + Math.PI) * 0.36;
          if (b.thighL) b.thighL.rotation.x = lerp(b.thighL.rotation.x, 0.16 + dive * 0.18 + kickL, air);
          if (b.thighR) b.thighR.rotation.x = lerp(b.thighR.rotation.x, 0.16 + dive * 0.18 + kickR, air);
          if (b.shinL) b.shinL.rotation.x = lerp(b.shinL.rotation.x, 0.38 + Math.max(0, kickL) * 0.55, air);
          if (b.shinR) b.shinR.rotation.x = lerp(b.shinR.rotation.x, 0.38 + Math.max(0, kickR) * 0.55, air);
          if (b.footL) b.footL.rotation.x = lerp(b.footL.rotation.x, 0.46, air);
          if (b.footR) b.footR.rotation.x = lerp(b.footR.rotation.x, 0.46, air);
        }
      }
    }

    // ---- Twin Cryo-Boost Jet Plumes & GLB Nozzle Glow
    const jetBoost = clamp((0.22 + fl * 1.15 + dive * 0.72 + lift * 0.55) * air, 0, 1.4);
    if (this.jetPlumeMat) {
      this.jetPlumeMat.uniforms.uBoost.value = jetBoost;
      const jetLen = 0.42 + jetBoost * 1.35 + Math.sin(time * 34) * 0.08 * jetBoost;
      const jetRad = 0.78 + jetBoost * 0.38;
      this.jetPlumeL.visible = this.jetPlumeR.visible = jetBoost > 0.04;
      this.jetPlumeL.scale.set(jetLen, jetRad, jetRad);
      this.jetPlumeR.scale.set(jetLen, jetRad, jetRad);
    }
    for (let i = 0; i < this._glbJetGlowMats.length; i++) {
      this._glbJetGlowMats[i].emissiveIntensity = 0.45 + jetBoost * 1.1;
    }

    this.scarfAmt.value = 0.6 + clamp(sp / 260, 0, 1) * 0.7 - grounded * 0.4;

    let flv = 0;
    if (gs.stun > 0) flv = Math.sin(time * 42) > 0 ? 0.95 : 0.15;
    else if (gs.invuln > 0) flv = Math.sin(time * 26) > 0.4 ? 0.32 : 0;
    for (let i = 0; i < this.flashMats.length; i++) {
      this.flashMats[i].emissive.setRGB(flv, flv * 0.9, flv * 0.95);
    }

    outer.updateMatrixWorld(true);
    const p = this._v2;
    const pFar = this._v3;
    const blink = Math.sin(time * 4.5) > 0.4 ? 1 : 0.15;
    this.gWing.localToWorld(p.copy(this._tipNear));
    this._glow(p.x, p.y, p.z + 0.2, sc * 0.52 * blink, 0.2 * blink, 0.95 * blink, 0.45 * blink);
    this.gWing.localToWorld(pFar.copy(this._tipFar));
    this._glow(pFar.x, pFar.y, pFar.z + 0.2, sc * 0.48 * blink, 0.95 * blink, 0.22 * blink, 0.22 * blink);

    // ---- Update Twin Aerodynamic Wingtip Condensation Vortex Ribbons (zero heap allocations!)
    if (this.vortexRibbonMesh) {
      const showRibbon = air > 0.15;
      this.vortexRibbonMesh.visible = showRibbon;
      if (showRibbon) {
        const stride = VORTEX_SEGS + 1;
        const hn = this._tipHistNear;
        const hf = this._tipHistFar;
        const dScroll = this._vortexInit ? clamp(scrollW - this._lastScrollW, -2.5, 2.5) : 0.12;
        this._lastScrollW = scrollW;
        if (!this._vortexInit) {
          for (let k = 0; k < stride; k++) {
            hn[k * 3] = p.x - k * 0.11 * sc;
            hn[k * 3 + 1] = p.y;
            hn[k * 3 + 2] = p.z;
            hf[k * 3] = pFar.x - k * 0.11 * sc;
            hf[k * 3 + 1] = pFar.y;
            hf[k * 3 + 2] = pFar.z;
          }
          this._vortexInit = true;
        } else {
          const adv = Math.max(0.055 * sc, dScroll);
          for (let k = VORTEX_SEGS; k >= 1; k--) {
            const dst = k * 3;
            const src = (k - 1) * 3;
            const swirl = Math.sin(time * 14.0 + k * 0.55) * 0.014 * sc;
            hn[dst] = hn[src] - adv;
            hn[dst + 1] = hn[src + 1] + swirl;
            hn[dst + 2] = hn[src + 2];
            hf[dst] = hf[src] - adv;
            hf[dst + 1] = hf[src + 1] - swirl;
            hf[dst + 2] = hf[src + 2];
          }
          hn[0] = p.x;
          hn[1] = p.y;
          hn[2] = p.z;
          hf[0] = pFar.x;
          hf[1] = pFar.y;
          hf[2] = pFar.z;
        }
        const vp = this._vortexPos;
        const vBoost = clamp(0.28 + fl * 0.95 + dive * 0.78 + lift * 0.45, 0, 1.35);
        this.vortexRibbonMat.uniforms.uBoost.value = vBoost;
        for (let side = 0; side < 2; side++) {
          const hArr = side === 0 ? hn : hf;
          const baseV = side * stride * 2;
          for (let k = 0; k < stride; k++) {
            const u = k / VORTEX_SEGS;
            const halfW = sc * (0.032 + 0.055 * Math.sin(u * Math.PI)) * (0.75 + vBoost * 0.45);
            const hx = hArr[k * 3];
            const hy = hArr[k * 3 + 1];
            const hz = hArr[k * 3 + 2];
            const vi0 = (baseV + k * 2) * 3;
            const vi1 = vi0 + 3;
            vp[vi0] = hx;
            vp[vi0 + 1] = hy - halfW;
            vp[vi0 + 2] = hz;
            vp[vi1] = hx;
            vp[vi1 + 1] = hy + halfW;
            vp[vi1 + 2] = hz;
          }
        }
        this.vortexRibbonMesh.geometry.attributes.position.needsUpdate = true;
      }
    }
    if (air > 0.1) {
      const jb = 0.35 + fl * 0.9 + dive * 0.55;
      this.gWing.localToWorld(p.copy(this._jetLocalL));
      this._glow(p.x, p.y, p.z + 0.12, sc * 0.65 * jb, 0.12 * jb, 0.86 * jb, 0.98 * jb);
      this.gWing.localToWorld(p.copy(this._jetLocalR));
      this._glow(p.x, p.y, p.z + 0.12, sc * 0.65 * jb, 0.12 * jb, 0.86 * jb, 0.98 * jb);
    }
    const night =
      this._themeKey === 'moonlit_storm' ||
      this._themeKey === 'aurora' ||
      this._themeKey === 'night' ||
      this._themeKey === 'storm'
        ? 1
        : 0.4;
    this._glow(gw.x, gw.y, -0.6, sc * 4.0, 0.08 * night, 0.1 * night, 0.12 * night);
    if (lift > 0.05) {
      const lk = lift * (0.7 + 0.3 * Math.sin(time * 8));
      const tc = this.thermalMesh.material.uniforms.uColor.value;
      this._glow(gw.x, gw.y + 0.4 * sc, -0.8, sc * 3.4, tc.r * 0.2 * lk, tc.g * 0.2 * lk, tc.b * 0.2 * lk, sc * 2.4);
    }
    this._shade(gw.x, gw.y, -0.5, sc * 5.4, sc * 3.6);
    this._speedK = clamp((dive * 0.8 + Math.max(0, (gs.speed || 1) - 1) * 1.6) * (1 - grounded), 0, 1);
  }

  _updateLanterns(stage, time, pxw, seaW = -5) {
    const list = stage.lanterns || EMPTY;
    const mesh = this.lanternMesh;
    const arr = mesh.instanceMatrix.array;
    const glowA = mesh.geometry.attributes.aGlow.array;
    const kites = this.kiteMesh;
    const karr = kites.instanceMatrix.array;
    const tarr = this.kiteTail.instanceMatrix.array;
    const lk = this.U.uLanternK.value;
    let n = 0;
    let nk = 0;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const v = this._toWorld(l.x, l.y, 0, this._v);
      if (l.type === 'kite') {
        if (nk >= MAX_KITE) continue;
        const s = l.r * pxw * 1.15;
        const tilt = Math.sin(l.age * 2.2 + l.phase) * 0.35;
        putMat(karr, nk, v.x, v.y, 0.2, s, s, s, tilt);
        karr[nk * 16] *= 0.85 + 0.15 * Math.cos(l.age * 1.7 + l.phase);
        const c = this._kiteCols[l.hue % this._kiteCols.length];
        kites.setColorAt(nk, c);
        putMat(tarr, nk, v.x, v.y - s * 0.6, 0.15, s * 2.6, s * 2.2, 1, -0.5 + tilt * 0.4);
        this.kiteTail.setColorAt(nk, c);
        this._glow(v.x, v.y, -0.3, s * 3.8, c.r * 0.18, c.g * 0.18, c.b * 0.18);
        nk++;
        continue;
      }
      if (n >= MAX_LANTERN) continue;
      const gold = l.type === 'gold';
      const s = l.r * pxw * (gold ? 1.25 : 1.05);
      const sway = Math.sin(l.age * 1.6 + l.phase) * 0.12;
      putMat(arr, n, v.x, v.y, 0, s, s * 1.1, s, sway);
      const c = gold ? this._gold : this._lanternCols[l.hue % this._lanternCols.length];
      mesh.setColorAt(n, c);
      glowA[n] = gold ? 0.8 + 0.4 * Math.sin(time * 6) : (l.pull || 0) * 0.6;
      const hk = (gold ? 0.45 : 0.1) * lk;
      const fl = 0.85 + 0.15 * Math.sin(time * 9 + l.seed * 7);
      this._glow(
        v.x,
        v.y - s * 0.2,
        -0.2,
        s * (gold ? 5.6 : 4.0) * fl,
        c.r * hk * fl,
        c.g * hk * 0.75 * fl,
        c.b * hk * 0.5 * fl
      );
      this._glow(v.x, v.y - s * 0.55, 0.3, s * 0.85, 0.75 * fl, 0.62 * fl, 0.35 * fl);
      // Shimmering Golden & Coral Storm-Lantern Reflections across the 3D Ocean Waves
      const hAbove = v.y - seaW;
      if (hAbove > -0.5 && hAbove < 14.0) {
        const seaFade = (1 - clamp(hAbove / 14.0, 0, 1)) * (gold ? 0.42 : 0.18) * lk;
        const rip = 0.74 + 0.26 * Math.sin(time * 6.8 + v.x * 1.9 + l.seed * 5.0);
        this._glow(
          v.x,
          seaW + 0.12,
          0.25,
          s * (gold ? 9.5 : 6.4) * rip,
          c.r * seaFade * rip,
          c.g * seaFade * 0.78 * rip,
          c.b * seaFade * 0.45 * rip,
          s * (gold ? 1.15 : 0.82)
        );
      }
      if (gold) {
        for (let k = 0; k < 3; k++) {
          const a = time * (2.2 + k * 0.7) + k * 2.1 + l.seed;
          const tw = Math.max(0, Math.sin(time * 7 + k * 2.3));
          this._star(
            v.x + Math.cos(a) * s * 1.5,
            v.y + Math.sin(a * 1.3) * s,
            0.6,
            s * 1.6 * tw,
            a,
            1,
            0.9 * tw,
            0.5 * tw
          );
        }
      }
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
    kites.count = nk;
    kites.instanceMatrix.needsUpdate = true;
    if (kites.instanceColor) kites.instanceColor.needsUpdate = true;
    this.kiteTail.count = nk;
    this.kiteTail.instanceMatrix.needsUpdate = true;
    if (this.kiteTail.instanceColor) this.kiteTail.instanceColor.needsUpdate = true;
  }

  _updateGates(stage, time, pxw, seaW = -5) {
    const list = stage.gates || EMPTY;
    const mesh = this.gateMesh;
    const tunnel = this.gateTunnelMesh;
    const glow = mesh.geometry.attributes.aGlow.array;
    const d = this._dummy;
    let n = 0;
    let nt = 0;
    let nr = 0;
    for (let i = 0; i < list.length && n < MAX_GATE; i++) {
      const gt = list[i];
      const v = this._toWorld(gt.x, gt.y, 0, this._v);
      const R = gt.r * pxw;
      let scale = R;
      let col = 1;
      let cr = 0.82;
      let cg = 0.66;
      let cb = 0.28;
      if (gt.state === 'passed') {
        const t = clamp(gt.t / 0.7, 0, 1);
        scale = R * (1 + t * 0.8);
        col = 1 - t;
        cr = 1.4;
        cg = 1.4;
        cb = 1.1;
      } else if (gt.state === 'missed') {
        const t = clamp(gt.t / 1.2, 0, 1);
        col = (1 - t) * 0.5;
        cr = cg = cb = 0.6;
      }
      if (col <= 0.01) continue;
      const yaw = 1.12 + Math.sin(time * 0.8 + gt.seed) * 0.08;
      const spin = time * 0.95 + gt.seed * 2.1;
      d.rotation.order = 'YXZ';
      d.position.set(v.x, v.y, 0);
      d.rotation.set(0, yaw, spin);
      d.scale.set(scale, scale, scale);
      d.updateMatrix();
      d.rotation.order = 'XYZ';
      mesh.setMatrixAt(n, d.matrix);
      this._c.setRGB(cr * col, cg * col, cb * col);
      mesh.setColorAt(n, this._c);
      glow[n] = gt.state === 'open' ? 1 : 0.3;

      // Celestial Ring Gate cyan-and-gold shimmer reflected on the storm waves below
      const gateAbove = v.y - seaW;
      if (gateAbove > -1.0 && gateAbove < 16.0) {
        const gf = (1 - clamp(gateAbove / 16.0, 0, 1)) * col * 0.32;
        const grip = 0.78 + 0.22 * Math.sin(time * 5.6 + v.x * 1.4 + gt.seed);
        this._glow(v.x, seaW + 0.14, 0.2, R * 4.4 * grip, 0.32 * gf, 0.88 * gf, 0.96 * gf, R * 0.58);
      }

      // Swirling 3D Wind-Tunnel Vortex Sleeve through the gate
      if (tunnel && nt < MAX_GATE && gt.state !== 'missed') {
        d.position.set(v.x, v.y, 0);
        d.rotation.set(0, yaw, time * 1.4 + gt.seed);
        d.scale.set(scale * 0.96, scale * 0.96, R * 1.18);
        d.updateMatrix();
        tunnel.setMatrixAt(nt, d.matrix);
        this._c2.setRGB(0.24 * col, 0.92 * col, 1.0 * col);
        tunnel.setColorAt(nt, this._c2);
        nt++;
      }

      // Trailing slipstream wind-tunnel guide rings ahead/behind open Ring Gates
      if (this.windRingMesh && gt.state === 'open') {
        for (let k = -1; k <= 1 && nr < MAX_WIND_TUNNEL; k += 2) {
          const pulse = 0.88 + 0.12 * Math.sin(time * 4.5 + k + gt.seed);
          d.position.set(v.x + k * R * 1.35, v.y, -0.15);
          d.rotation.set(time * 2.2 * k, 0, 0);
          d.scale.set(R * 0.72, R * 0.76 * pulse, R * 0.76 * pulse);
          d.updateMatrix();
          this.windRingMesh.setMatrixAt(nr, d.matrix);
          this._c2.setRGB(0.22, 0.88, 0.98);
          this.windRingMesh.setColorAt(nr, this._c2);
          nr++;
        }
      }

      this._glow(v.x, v.y, -0.4, R * 2.5, 0.16 * col, 0.28 * col, 0.34 * col, R * 3.3);
      if (gt.state === 'open') {
        this._star(
          v.x,
          v.y + R,
          0.4,
          R * 0.68 * (0.6 + 0.4 * Math.sin(time * 5 + gt.seed)),
          time,
          0.65,
          1,
          1
        );
      }
      n++;
    }

    // Glowing Wind-Tunnel Rings along active `stage.gusts` wind corridors
    const gusts = stage.gusts || EMPTY;
    if (this.windRingMesh && gusts.length) {
      for (let i = 0; i < gusts.length && nr < MAX_WIND_TUNNEL; i++) {
        const u = gusts[i];
        const ringsInCorridor = 3;
        const slant = -(u.dir || 1) * 0.26;
        const rad = Math.max(0.45, u.h * pxw * 0.48);
        for (let k = 0; k < ringsInCorridor && nr < MAX_WIND_TUNNEL; k++) {
          const frac = ((k + 0.5) / ringsInCorridor + time * 0.55) % 1;
          const gx = u.x + (1 - frac) * u.w;
          const gy = u.y + (frac - 0.5) * u.h * 0.35 * (u.dir || 1);
          const gw = this._toWorld(gx, gy, -0.2, this._v2);
          const fade = Math.sin(frac * Math.PI);
          d.position.set(gw.x, gw.y, -0.2);
          d.rotation.set(time * 2.6 + k, 0, slant);
          d.scale.set(rad * 1.1, rad, rad);
          d.updateMatrix();
          this.windRingMesh.setMatrixAt(nr, d.matrix);
          if ((u.dir || 1) < 0) {
            this._c2.setRGB(0.24 * fade, 0.96 * fade, 0.84 * fade);
          } else {
            this._c2.setRGB(0.42 * fade, 0.78 * fade, 1.0 * fade);
          }
          this.windRingMesh.setColorAt(nr, this._c2);
          nr++;
        }
      }
    }

    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
    if (tunnel) {
      tunnel.count = nt;
      tunnel.instanceMatrix.needsUpdate = true;
      if (tunnel.instanceColor) tunnel.instanceColor.needsUpdate = true;
    }
    if (this.windRingMesh) {
      this.windRingMesh.count = nr;
      this.windRingMesh.instanceMatrix.needsUpdate = true;
      if (this.windRingMesh.instanceColor) this.windRingMesh.instanceColor.needsUpdate = true;
    }
  }

  _updateThermals(stage, time, dt, pxw, seaW) {
    const list = stage.thermals || EMPTY;
    const mesh = this.thermalMesh;
    const arr = mesh.instanceMatrix.array;
    const col = mesh.instanceColor.array;
    const topW = this._toWorld(0, (stage.top || 0) - 30, 0, this._v2).y;
    const tc = mesh.material.uniforms.uColor.value;
    let n = 0;
    this._moteAcc += dt * list.length * 7;
    for (let i = 0; i < list.length && n < MAX_THERMAL; i++) {
      const th = list[i];
      const x = this._toWorld(th.x, 0, 0, this._v).x;
      const w = th.w * pxw * 1.8;
      const h = topW - seaW;
      putMat(arr, n, x, seaW, -0.6, w, h, 1, 0);
      const f = (th.fade || 0) * (th.str || 1);
      col[n * 3] = f;
      col[n * 3 + 1] = f;
      col[n * 3 + 2] = f;
      this._glow(x, seaW + 0.3, -0.5, w * 1.6, tc.r * 0.22 * f, tc.g * 0.22 * f, tc.b * 0.22 * f, w * 0.5);
      n++;
    }
    while (this._moteAcc > 1 && list.length) {
      this._moteAcc -= 1;
      const th = list[Math.floor(Math.random() * list.length)];
      const x = this._toWorld(th.x, 0, 0, this._v).x;
      const w = th.w * pxw;
      const y = lerp(seaW + 0.5, topW, Math.random() * 0.7);
      this._spawnPuff(
        x + (Math.random() - 0.5) * w * 1.6,
        y,
        (Math.random() - 0.5) * 1.5,
        0,
        1.2 + Math.random() * 1.6,
        0.05 + Math.random() * 0.06,
        1.6 + Math.random(),
        0,
        tc.r,
        tc.g,
        tc.b,
        0.5,
        1
      );
    }
    if (!list.length) this._moteAcc = 0;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    void time;
  }

  _updateStorms(stage, time, pxw, seaW) {
    const list = stage.clouds || EMPTY;
    const mesh = this.stormMesh;
    const arr = mesh.instanceMatrix.array;
    const ca = mesh.geometry.attributes.aCloud.array;
    const curt = this.curtainMesh;
    const carr = curt.instanceMatrix.array;
    const ccol = curt.instanceColor.array;
    let n = 0;
    let nc = 0;
    for (let i = 0; i < list.length && nc < MAX_STORM; i++) {
      const c = list[i];
      const v = this._toWorld(c.x, c.y, 0, this._v);
      const W = c.rx * pxw * 2.6;
      const base = v.y - c.ry * pxw * 0.55;
      let fl = 0;
      if (c.state === 'charge') {
        const k = clamp(c.t / (stage._strikeCharge || 1.2), 0, 1);
        fl = (Math.sin(time * (18 + k * 30) + c.seed) > 0.2 - k * 0.6 ? 1 : 0) * (0.35 + k * 0.9);
      } else if (c.state === 'strike') {
        fl = 1.5 * (1 - c.t / 0.42);
      }
      for (let k = 0; k < 4 && n < MAX_STORM_PUFF; k++) {
        const o4 = k * 4;
        const ox = STORM_PUFFS[o4];
        const oy = STORM_PUFFS[o4 + 1];
        const s = STORM_PUFFS[o4 + 2];
        const bob = Math.sin(time * 0.8 + c.seed + k * 1.4) * 0.035;
        // Wide flattened cumulonimbus strata (~2.5:1 aspect -> brooding storm anvil, zero round cotton-balls!)
        putMat(
          arr,
          n,
          v.x + ox * W * 0.88,
          base + (oy + bob) * W * 0.52,
          0.2 - k * 0.05,
          W * s * 1.36 * (k % 2 ? -1 : 1),
          W * s * 1.08
        );
        ca[n * 4] = c.seed * 1.7 + k * 2.31;
        ca[n * 4 + 1] = 1.0;
        ca[n * 4 + 2] = k === 0 ? 0.94 : 0.78;
        ca[n * 4 + 3] = fl;
        n++;
      }
      const bx = v.x + (c.strikeX || 0) * pxw;
      putMat(carr, nc, v.x, base + W * 0.06, -0.2, W * 1.15, base - seaW + 0.5);
      ccol[nc * 3] = 0.42;
      ccol[nc * 3 + 1] = 0.48;
      ccol[nc * 3 + 2] = 0.58;
      nc++;

      if (c.state === 'charge') {
        const k = clamp(c.t / (stage._strikeCharge || 1.2), 0, 1);
        const p = 0.5 + 0.5 * Math.sin(time * (14 + k * 26));
        const h = base - seaW;
        const a = (0.15 + 0.48 * k) * p;
        this._glow(bx, (base + seaW) * 0.5, 0.3, 0.14 + k * 0.12, 0.75 * a, 0.88 * a, 1.0 * a, h);
        for (let j = 0; j < 3; j++) {
          const f = (time * (1.2 + j * 0.4) + j * 0.33 + c.seed) % 1;
          this._star(
            bx + Math.sin(time * 30 + j * 2) * 0.15,
            base - f * h,
            0.45,
            (0.25 + k * 0.35) * p,
            time * 9 + j,
            0.7 * k,
            0.85 * k,
            1.0 * k
          );
        }
        this._glow(bx, seaW + 0.1, 0.4, 1.4 + k * 2.2, 0.6 * a, 0.75 * a, 1.0 * a, 0.5 + k * 0.6);
        this._glow(bx, base, 0.5, W * 0.6 * (0.5 + k), 0.5 * k * p, 0.62 * k * p, 0.88 * k * p);
      }
      if (c.state === 'strike' && c.t < 0.12 && c.strikes !== c._seenStrike) {
        c._seenStrike = c.strikes;
        this._flash = Math.max(this._flash, 0.8);
      }
      this._shade(v.x, base + W * 0.1, -0.4, W * 1.3, W * 0.7);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.attributes.aCloud.needsUpdate = true;
    curt.count = this._themeKey === 'night' ? 0 : nc;
    curt.instanceMatrix.needsUpdate = true;
    curt.instanceColor.needsUpdate = true;
  }

  _updateGulls(stage, time, dt, pxw, scrollW, seaW) {
    const list = stage.gulls || EMPTY;
    const mesh = this.gullMesh;
    const anim = mesh.geometry.attributes.aAnim.array;
    const d = this._dummy;
    let n = 0;
    for (let i = 0; i < list.length && n < MAX_GULL; i++) {
      const b = list[i];
      const v = this._toWorld(b.x, b.y, 0, this._v);
      const s = b.r * pxw * 2.1;
      const scatter = b.state === 'scatter';
      d.position.set(v.x, v.y, 0.3);
      d.rotation.set(
        0.5 + (scatter ? Math.sin(time * 9 + b.seed) * 0.6 : 0),
        0.3,
        clamp(-(b.vy || 0) * 0.003, -0.6, 0.6) + (scatter ? Math.sin(time * 7 + b.seed) * 0.5 : 0)
      );
      d.scale.set(s, s, s);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      mesh.setColorAt(n, this._white);
      anim[n * 3] = b.phase;
      anim[n * 3 + 1] = 0;
      anim[n * 3 + 2] = 1;
      this._shade(v.x, v.y, -0.3, s * 3.2, s * 2);
      n++;
    }
    const T = this.theme || THEMES.moonlit_storm;
    if (T.birds > 0) {
      this._c.copy(this._birdCol);
      for (let k = 0; k < this.ambFlocks.length; k++) {
        const F = this.ambFlocks[k];
        const span = 2 * this._halfW(F.z) + 30;
        let cx = (F.u * span - scrollW * 0.6 + F.dir * F.speed * time) % span;
        if (cx < 0) cx += span;
        cx -= span * 0.5;
        const cy = seaW + this._elevY(F.z, F.el) + Math.sin(time * 0.3 + F.ph) * 1.5;
        const nn = Math.round(F.n * T.birds);
        for (let j = 0; j < nn && n < MAX_GULL; j++) {
          const row = Math.ceil(j / 2);
          const side = j === 0 ? 0 : j % 2 ? -1 : 1;
          const bx = cx - F.dir * row * 1.4 + Math.sin(time * 0.8 + j) * 0.3;
          const by = cy + side * row * 0.8;
          d.position.set(bx, by, F.z);
          d.rotation.set(0.3, F.dir > 0 ? Math.PI : 0, 0);
          d.scale.setScalar(1.1);
          d.updateMatrix();
          mesh.setMatrixAt(n, d.matrix);
          mesh.setColorAt(n, this._c);
          anim[n * 3] = time * 7 + j * 1.3 + F.ph;
          anim[n * 3 + 1] = 0;
          anim[n * 3 + 2] = 1;
          n++;
        }
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aAnim.needsUpdate = true;
    void dt;
  }

  _updateRings(stage, pxw) {
    const rings = stage.rings || EMPTY;
    const mesh = this.ringMesh;
    const arr = mesh.instanceMatrix.array;
    const col = mesh.instanceColor.array;
    const rgb = this._rgb;
    let n = 0;
    for (let i = 0; i < rings.length && n < MAX_RING; i++) {
      const r = rings[i];
      const t = 1 - r.life / r.maxLife;
      const v = this._toWorld(r.x, r.y, 0, this._v);
      const rad = lerp(r.r0, r.r1, 1 - (1 - t) * (1 - t)) * pxw * 2.3;
      putMat(arr, n, v.x, v.y, 0.7, rad, r.flat ? rad * 0.22 : rad);
      this._parseColor(r.color, rgb);
      const a = Math.pow(1 - t, 1.5);
      col[n * 3] = rgb[0] * a;
      col[n * 3 + 1] = rgb[1] * a;
      col[n * 3 + 2] = rgb[2] * a;
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  _boltRand() {
    this._boltState = (this._boltState + 0x6d2b79f5) >>> 0;
    let q = this._boltState;
    q = Math.imul(q ^ (q >>> 15), q | 1);
    q ^= q + Math.imul(q ^ (q >>> 7), q | 61);
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  }

  _writeBolt(seg, x0, y0, x1, y1, a, width, steps) {
    let px = x0;
    let py = y0;
    for (let k = 1; k <= steps && seg < MAX_BOLT_SEG; k++) {
      const t = k / steps;
      const jit = k === steps ? 0 : (this._boltRand() - 0.5) * 0.9 * width * 6;
      const nx = lerp(x0, x1, t) + jit;
      const ny = lerp(y0, y1, t);
      const dx = nx - px;
      const dy = ny - py;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * width;
      const oy = (dx / len) * width;
      const o = seg * 12;
      const P = this.boltPos;
      P[o] = px - ox;
      P[o + 1] = py - oy;
      P[o + 2] = 0.6;
      P[o + 3] = px + ox;
      P[o + 4] = py + oy;
      P[o + 5] = 0.6;
      P[o + 6] = nx - ox;
      P[o + 7] = ny - oy;
      P[o + 8] = 0.6;
      P[o + 9] = nx + ox;
      P[o + 10] = ny + oy;
      P[o + 11] = 0.6;
      const A = this.boltA;
      A[seg * 4] = A[seg * 4 + 1] = A[seg * 4 + 2] = A[seg * 4 + 3] = a;
      seg++;
      if (steps > 6 && k > 2 && k < steps - 2 && this._boltRand() < 0.18) {
        seg = this._writeBolt(
          seg,
          nx,
          ny,
          nx + (this._boltRand() - 0.5) * 4,
          ny - (y0 - y1) * 0.25,
          a * 0.6,
          width * 0.6,
          4
        );
      }
      px = nx;
      py = ny;
    }
    return seg;
  }

  _updateVfx(stage, time, pxw, seaW) {
    const list = stage.vfx || EMPTY;
    const rgb = this._rgb;
    const gs = stage.glider;
    const sc = this._gSc || 0.5;
    let maxId = this._lastVfxId;
    let seg = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const fresh = e.id > this._lastVfxId;
      if (e.id > maxId) maxId = e.id;
      const t = 1 - clamp(e.life / (e.maxLife || 1), 0, 1);
      const k = 1 - t;
      const v = this._toWorld(e.x, e.y, 0, this._v);
      const S = (e.size || 10) * pxw;
      this._parseColor(e.color || '#ffffff', rgb);
      switch (e.kind) {
        case 'sparkle': {
          for (let j = 0; j < 6; j++) {
            const a = j * 1.0472 + e.id * 0.7;
            const rr = S * (0.35 + t * 1.2);
            const sz = S * (j % 2 ? 0.5 : 0.85) * k;
            this._star(
              v.x + Math.cos(a) * rr,
              v.y + Math.sin(a) * rr,
              0.8,
              sz,
              a + time * 3,
              rgb[0] * k,
              rgb[1] * k,
              rgb[2] * k
            );
          }
          if (t < 0.35) {
            this._glow(v.x, v.y, 0.7, S * 2.2 * (1 - t / 0.35), rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5);
          }
          break;
        }
        case 'pop': {
          if (fresh) {
            for (let j = 0; j < 9; j++) {
              const a = (j / 9) * TAU + Math.random() * 0.5;
              const sp = 1.5 + Math.random() * 2;
              this._spawnPuff(
                v.x,
                v.y,
                0.4,
                Math.cos(a) * sp,
                Math.sin(a) * sp + 0.8,
                0.07 + Math.random() * 0.06,
                0.5 + Math.random() * 0.4,
                -2.5,
                rgb[0],
                rgb[1],
                rgb[2],
                2.5,
                2
              );
            }
          }
          this._star(v.x, v.y, 0.8, S * 1.8 * k * k, e.id, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          this._glow(v.x, v.y, 0.6, S * 3 * k, rgb[0] * 0.4 * k, rgb[1] * 0.35 * k, rgb[2] * 0.25 * k);
          break;
        }
        case 'collect': {
          const tw = gs ? this._toWorld(gs.x, gs.y, 0, this._v3) : this._v3.set(v.x, v.y, 0);
          const ease = t * t * (3 - 2 * t);
          const x = lerp(v.x, tw.x, ease);
          const y = lerp(v.y, tw.y, ease) + Math.sin(t * Math.PI) * 0.6 * sc;
          this._star(x, y, 0.9, sc * 0.9 * (0.5 + 0.5 * k), time * 6, rgb[0], rgb[1], rgb[2]);
          this._glow(x, y, 0.85, sc * 1.4, rgb[0] * 0.4, rgb[1] * 0.4, rgb[2] * 0.4);
          if (t > 0.85) this._glow(tw.x, tw.y, 0.9, sc * 3 * (t - 0.85) * 6, 0.3, 0.3, 0.25);
          break;
        }
        case 'whoosh': {
          const side = e.a || 1;
          const sv = gs ? this._toWorld(gs.x, gs.y, 0, this._v3) : v;
          for (let j = 0; j < 5; j++) {
            const off = (j - 2) * 0.16 * sc;
            const x = sv.x - (0.2 + t * 3.4 + Math.abs(j - 2) * 0.3) * sc;
            const y = sv.y - side * (0.72 * sc + off) + (side === 0 ? (j - 2) * 0.3 * sc : 0);
            const a = k * (1.0 - Math.abs(j - 2) * 0.22);
            this._glow(
              x,
              y,
              0.85,
              sc * (2.6 - Math.abs(j - 2) * 0.4) * (0.4 + 0.6 * k),
              0.75 * a,
              0.95 * a,
              1.0 * a,
              sc * 0.11
            );
          }
          break;
        }
        case 'zap': {
          this._glow(v.x, v.y, 0.9, S * 0.3 * (1 + t * 2), rgb[0] * k, rgb[1] * k, rgb[2] * k);
          this._star(v.x, v.y, 1.0, S * 0.2 * k * (1 + t), e.id + t * 2, k, k, k);
          break;
        }
        case 'bolt': {
          const y0 = v.y;
          const y1 = seaW;
          const a = k > 0.6 ? 1 : (k / 0.6) * (0.6 + 0.4 * Math.sin(time * 60));
          const fr = Math.floor(t * 9);
          this._boltState = (e.id * 2654435761 + fr * 97) >>> 0;
          seg = this._writeBolt(
            seg,
            v.x,
            y0,
            v.x + (this._boltRand() - 0.5) * 0.6,
            y1,
            a,
            0.12 + 0.05 * k,
            14
          );
          this._glow(v.x, (y0 + y1) * 0.5, 0.5, 1.3 * a, 0.22 * a, 0.26 * a, 0.48 * a, (y0 - y1) * 1.05);
          this._glow(v.x, y1 + 0.15, 0.7, 2.6 * a, 0.45 * a, 0.5 * a, 0.82 * a, 0.9 * a);
          if (fresh) {
            for (let j = 0; j < 22; j++) {
              const ang = Math.PI * 0.5 + (Math.random() - 0.5) * 1.8;
              const sp = 2 + Math.random() * 4;
              this._spawnPuff(
                v.x + (Math.random() - 0.5) * 0.5,
                y1 + 0.05,
                (Math.random() - 0.5) * 0.6,
                Math.cos(ang) * sp * 0.6,
                Math.sin(ang) * sp,
                0.06 + Math.random() * 0.07,
                0.8 + Math.random() * 0.5,
                -9,
                0.9,
                0.95,
                1.0,
                1,
                1
              );
            }
          }
          break;
        }
        case 'feathers': {
          if (fresh) {
            for (let j = 0; j < 16; j++) {
              const a = Math.random() * TAU;
              const sp = 1 + Math.random() * 2.2;
              this._spawnPuff(
                v.x,
                v.y,
                0.4,
                Math.cos(a) * sp,
                Math.sin(a) * sp + 0.6,
                0.09 + Math.random() * 0.07,
                1.4 + Math.random() * 0.8,
                -0.9,
                1,
                1,
                1,
                1.6,
                3
              );
            }
          }
          if (t < 0.3) this._glow(v.x, v.y, 0.8, S * 2.5 * (1 - t / 0.3), 0.5, 0.5, 0.5);
          break;
        }
        case 'splash': {
          if (fresh) {
            for (let j = 0; j < 40; j++) {
              const ang = Math.PI * 0.5 + (Math.random() - 0.5) * 1.5;
              const sp = 2.2 + Math.random() * 4;
              this._spawnPuff(
                v.x + (Math.random() - 0.5) * sc * 2.4,
                seaW + 0.02,
                (Math.random() - 0.5) * 0.8,
                Math.cos(ang) * sp * 0.6 - 1.0,
                Math.sin(ang) * sp,
                0.06 + Math.random() * 0.1,
                1.0 + Math.random() * 0.6,
                -9.5,
                0.9,
                0.97,
                1.0,
                1,
                1
              );
            }
          }
          this._glow(v.x, seaW + 0.05, 0.9, sc * 5 * (0.4 + t), 0.5 * k, 0.6 * k, 0.65 * k, sc * 1.2 * k);
          break;
        }
        case 'flap': {
          if (fresh) {
            for (let j = 0; j < 10; j++) {
              this._spawnPuff(
                v.x + (Math.random() - 0.5) * S * 1.1,
                v.y - 0.08 * sc,
                0.3,
                -1.4 - Math.random() * 1.6,
                -1.2 - Math.random() * 1.2,
                0.05 + Math.random() * 0.05,
                0.42 + Math.random() * 0.24,
                0,
                0.10,
                0.28,
                0.42,
                2.4,
                0
              );
            }
            this._spawnStreak(v.x + S * 0.2, v.y + sc * 0.22, 0.4, sc * 2.2, 1.2, 0.28, 0.42, -0.14);
            this._spawnStreak(v.x + S * 0.2, v.y - sc * 0.08, 0.4, sc * 1.8, 1.2, 0.24, 0.36, -0.16);
          }
          if (t < 0.4) {
            const fk = 1 - t / 0.4;
            this._glow(v.x, v.y - 0.2 * sc, 0.4, sc * 2.4 * fk, 0.04 * fk, 0.16 * fk, 0.24 * fk, sc * 0.9);
          }
          break;
        }
        case 'gate': {
          this._glow(
            v.x,
            v.y,
            0.6,
            S * (2 + t * 3),
            rgb[0] * 0.3 * k,
            rgb[1] * 0.3 * k,
            rgb[2] * 0.3 * k,
            S * (3 + t * 4)
          );
          for (let j = 0; j < 8; j++) {
            const a = (j / 8) * TAU + time;
            const rr = S * (1 + t * 2.4);
            this._star(
              v.x + Math.cos(a) * rr * 0.4,
              v.y + Math.sin(a) * rr,
              0.8,
              S * 0.5 * k,
              a,
              rgb[0] * k,
              rgb[1] * k,
              rgb[2] * k
            );
          }
          break;
        }
        case 'puff': {
          if (fresh) {
            for (let j = 0; j < 10; j++) {
              const a = Math.random() * TAU;
              this._spawnPuff(
                v.x,
                v.y,
                0.5,
                Math.cos(a) * 1.4,
                Math.sin(a) * 1.2,
                0.3 + Math.random() * 0.25,
                0.7 + Math.random() * 0.4,
                0,
                0.62,
                0.66,
                0.74,
                2,
                0
              );
            }
          }
          break;
        }
        case 'gust': {
          if (fresh) {
            for (let j = 0; j < 8; j++) {
              this._spawnStreak(
                v.x + (Math.random() - 0.2) * sc * 6,
                v.y + (Math.random() - 0.5) * sc * 3,
                0.5 + Math.random() * 2,
                sc * (3 + Math.random() * 3),
                2.2,
                0.5 + Math.random() * 0.3,
                0.8
              );
            }
          }
          break;
        }
        case 'dust': {
          if (fresh) {
            for (let j = 0; j < 22; j++) {
              const dir = Math.random() < 0.5 ? -1 : 1;
              this._spawnPuff(
                v.x + dir * Math.random() * sc,
                v.y + 0.05,
                (Math.random() - 0.5) * 0.6,
                dir * (0.6 + Math.random() * 1.8),
                0.3 + Math.random() * 0.8,
                0.14 + Math.random() * 0.16,
                0.9 + Math.random() * 0.6,
                -0.6,
                1.0,
                0.9,
                0.7,
                1.8,
                0
              );
            }
          }
          break;
        }
        case 'launch': {
          if (fresh) {
            for (let j = 0; j < 14; j++) {
              const dir = Math.random() < 0.5 ? -1 : 1;
              this._spawnPuff(
                v.x + dir * Math.random() * sc * 0.6,
                v.y + 0.05,
                (Math.random() - 0.5) * 0.5,
                dir * (0.5 + Math.random() * 1.2),
                0.4 + Math.random() * 0.6,
                0.12 + Math.random() * 0.12,
                0.8 + Math.random() * 0.5,
                -0.5,
                0.95,
                0.92,
                0.88,
                2,
                0
              );
            }
          }
          break;
        }
        default:
          break;
      }
    }
    this._lastVfxId = maxId;
    const bg = this.boltMesh.geometry;
    bg.setDrawRange(0, seg * 6);
    if (seg) {
      bg.attributes.position.needsUpdate = true;
      bg.attributes.aA.needsUpdate = true;
    }
  }

  _updateStreaks(stage, dt, pxw) {
    const gs = stage.glider;
    const T = this.theme || THEMES.moonlit_storm;
    const speed = (stage.scrollSpeed || 0) * pxw;
    const sk = this._speedK || 0;
    const gust = Math.abs(stage.wind || 0);
    const riding = stage.phase === 'ride' || stage.phase === 'intro';
    const rate = riding && (sk > 0.22 || gust > 0.06) ? sk * 22 + gust * 28 : 0;
    this._streakAcc += dt * rate;
    const hw = this._halfW(0);
    const topY = this._toWorld(0, stage.top || 110, 0, this._v2).y;
    const flightSlant = gs ? clamp(-(gs.vy || 0) * 0.00055, -0.26, 0.26) : 0;
    while (this._streakAcc > 1) {
      this._streakAcc -= 1;
      const z = lerp(-4, 4, Math.random());
      const kz = (CAM_Z - z) / CAM_Z;
      let y = lerp(this._seaW + 1, topY + 2, Math.random()) * kz;
      if (gs) {
        const gw = this._toWorld(gs.x, gs.y, 0, this._v3);
        y = gw.y + (Math.random() - 0.5) * this._gSc * 4.2;
      }
      this._spawnStreak(
        hw * kz + 3,
        y,
        z,
        lerp(1.0, 2.8, Math.random()) * (0.8 + sk * 0.7),
        1.4 + sk * 1.2 + gust,
        0.55 + Math.random() * 0.4,
        lerp(0.18, 0.42, Math.random()) * (sk * 0.7 + gust * 0.5),
        flightSlant + (Math.random() - 0.5) * 0.06
      );
    }

    const gusts = stage.gusts || EMPTY;
    this._gustAcc = (this._gustAcc || 0) + dt * gusts.length * 26;
    while (this._gustAcc > 1 && gusts.length) {
      this._gustAcc -= 1;
      const u = gusts[Math.floor(Math.random() * gusts.length)];
      const gx = u.x + Math.random() * u.w;
      const gy = u.y + (Math.random() - 0.5) * u.h;
      const w = this._toWorld(gx, gy, 0, this._v3);
      const slant = -(u.dir || 1) * 0.28;
      this._spawnStreak(
        w.x,
        w.y,
        lerp(-1, 1.5, Math.random()),
        u.w * pxw * lerp(0.15, 0.35, Math.random()),
        2.4,
        0.55 + Math.random() * 0.3,
        lerp(0.45, 0.9, Math.random()),
        slant,
        -(u.dir || 1) * speed * 0.6
      );
    }
    if (!gusts.length) this._gustAcc = 0;

    const mesh = this.streakMesh;
    const arr = mesh.instanceMatrix.array;
    const col = mesh.instanceColor.array;
    const night =
      this._themeKey === 'moonlit_storm' ||
      this._themeKey === 'aurora' ||
      this._themeKey === 'night' ||
      this._themeKey === 'storm'
        ? 0.62
        : 1;
    let n = 0;
    for (let i = 0; i < MAX_STREAK; i++) {
      const s = this.streaks[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      const kz = (CAM_Z - s.z) / CAM_Z;
      s.x -= (speed * s.v + 3) * dt;
      s.y += s.vy * dt;
      const a = Math.min(1, (s.life / s.max) * 2.5) * Math.min(1, (s.max - s.life) * 6) * s.a * night;
      putMat(arr, n, s.x, s.y, s.z, s.len, 0.035 * kz + 0.02, 1, s.rz);
      col[n * 3] = a * 0.85;
      col[n * 3 + 1] = a * 0.95;
      col[n * 3 + 2] = a;
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  _updatePuffs(dt, seaW) {
    for (let i = 0; i < MAX_PUFF; i++) {
      const p = this.puffs[i];
      if (p.life > 0) {
        p.life -= dt;
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr;
        p.vy = p.vy * (p.g === 0 ? dr : 1) + p.g * dt;
        if (p.kind === 3) {
          p.vy = Math.max(p.vy, -0.7);
          p.x += Math.sin(p.life * 6 + i) * 0.6 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 1 && p.vy < 0 && p.y < seaW) p.life = 0;
      }
      const a = p.life > 0 ? Math.min(1, (p.life / p.max) * 2) : 0;
      const o = i * 3;
      this.puffPos[o] = p.x;
      this.puffPos[o + 1] = p.y;
      this.puffPos[o + 2] = p.z;
      const glow = p.kind === 2 ? 1.5 : 1;
      this.puffCol[o] = p.r * glow;
      this.puffCol[o + 1] = p.gg * glow;
      this.puffCol[o + 2] = p.b * glow;
      this.puffSize[i] = p.size * (p.kind === 0 ? 1 + (1 - p.life / p.max) * 1.5 : 1);
      this.puffAlpha[i] = a * (p.kind === 0 ? 0.55 : 1);
    }
    const g = this.puffPoints.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  _updateSeaGlints(time, seaW) {
    const T = this.theme || THEMES.moonlit_storm;
    // Moonlit themes render continuous 3D Gerstner Schlick-Fresnel wave facets directly on `this.sea` (zero artificial star dots!)
    if (T.glint < 0.45 || T.moon > 0.5) return;
    const sd = this.U.uSunDir.value;
    const c = this.U.uSunCol.value;
    for (let k = 0; k < 10; k++) {
      const ph = Math.floor(time * 3 + k * 0.37);
      const r1 = Math.sin(ph * 12.9898 + k * 78.233) * 43758.5453;
      const r2 = Math.sin(ph * 39.3468 + k * 11.135) * 24634.6345;
      const f1 = r1 - Math.floor(r1);
      const f2 = r2 - Math.floor(r2);
      const z = lerp(-12, -160, f1 * f1);
      const dist = CAM_Z - z;
      const x = (sd.x / -sd.z) * dist + (f2 - 0.5) * dist * 0.08;
      const tw = Math.max(0, Math.sin((time * 3 + k * 0.37) * Math.PI * 2));
      const s = (0.25 + dist * 0.012) * tw * T.glint;
      this._star(x, seaW + 0.05, z, s, k, c.r * tw, c.g * tw, c.b * tw);
    }
  }

  _updateHud(stage, time, dt) {
    const cine = this._cine;
    const hudA = (1 - smooth01(cine * 1.6)) * (1 - smooth01(this._intro * 1.4 - 0.2));
    this.hudGroup.visible = hudA > 0.01;
    this.hudPanel.material.opacity = hudA;
    this.hudFill.material.opacity = hudA;
    this.hudHead.material.opacity = hudA;
    this.hudMarker.material.opacity = hudA;
    const p = clamp(stage.progress || 0, 0, 1);
    const x0 = this._trackX0 ?? 36;
    const x1 = this._trackX1 ?? this.width - 52;
    const y = -(this._trackY ?? HUD_TOP_OFFSET + 40);
    const w = Math.max(2, (x1 - x0) * p);
    this.hudFill.scale.set(w, 4.5, 1);
    this.hudFill.position.set(x0 + w / 2, y, 0);
    const mx = x0 + (x1 - x0) * p;
    this.hudHead.scale.set(20, 12, 1);
    this.hudHead.position.set(mx, y, 0);
    this.hudMarker.scale.set(28, 19, 1);
    this.hudMarker.position.set(mx, y + 1 + Math.sin(time * 4) * 0.8, 0);

    const mult = stage.mult || 1;
    const active = mult > 1 && (stage.comboTimer || 0) > 0 && hudA > 0.5;
    this._comboAlpha = clamp(this._comboAlpha + (active ? dt * 8 : -dt * 4), 0, 1);
    if (active) this._comboShown = mult;
    const ca = this._comboAlpha * hudA;
    this.comboRing.visible = this.comboText.visible = ca > 0.01;
    if (ca > 0.01) {
      const m = this._comboShown || 2;
      const tex = this._comboTexFor(m);
      if (this.comboText.material.map !== tex) {
        this.comboText.material.map = tex;
        this.comboText.material.needsUpdate = true;
      }
      const since = (stage.t || 0) - (stage.comboPulseT ?? -10);
      const pulse = 1 + 0.42 * Math.exp(-Math.max(0, since) * 7) * Math.cos(since * 18);
      const wide = this.width / this.height > 1.15;
      const R = (wide ? 42 : 52) * (0.6 + 0.4 * easeOutBack(ca)) * pulse;
      const cx = this.width - 42;
      const cy = -(wide ? (this.height >= 600 ? 170 : 164) : HUD_TOP_OFFSET + 88);
      this.comboRing.scale.set(R, R, 1);
      this.comboRing.position.set(cx, cy, 0);
      this.comboText.scale.set(R * 0.92, R * 0.92, 1);
      this.comboText.position.set(cx, cy, 0);
      this.comboMat.uniforms.uAlpha.value = ca;
      this.comboMat.uniforms.uProg.value = clamp(
        (stage.comboTimer || 0) / (stage.comboTimerMax || 2.4),
        0,
        1
      );
      this.comboMat.uniforms.uCol.value.copy(this._comboCols[m >= 4 ? 2 : m === 3 ? 1 : 0]);
      this.comboText.material.opacity = ca;
    }
  }

  _updateWarnings(stage, time) {
    const list = stage.warnings || EMPTY;
    for (let i = 0; i < MAX_WARN; i++) {
      const m = this.warnPool[i];
      const w = list[i];
      if (!w || stage.phase !== 'ride') {
        m.visible = false;
        continue;
      }
      const tex = this._warnTex[w.kind] || this._warnTex.gull;
      if (m.material.map !== tex) {
        m.material.map = tex;
        m.material.needsUpdate = true;
      }
      const k = w.t / (w.max || 1);
      const pop = easeOutBack(clamp((1 - k) / 0.25, 0, 1));
      const blink = 0.65 + 0.35 * Math.sin(time * 18);
      const s = 34 * pop;
      m.scale.set(s, s, 1);
      m.position.set(this.width - 24, -w.y * this._ky, 1);
      m.material.opacity = clamp(k * 3, 0, 1) * blink;
      m.visible = s > 1;
    }
  }

  _updateCinematic(stage) {
    const cine = this._cine;
    const W = this.width;
    const H = this.height;
    const lb = H * 0.065 * Math.max(smooth01(cine * 1.3), this._intro * 0.85);
    this.lbTop.visible = this.lbBot.visible = lb > 0.5;
    if (lb > 0.5) {
      this.lbTop.scale.set(W, lb, 1);
      this.lbTop.position.set(W / 2, -lb / 2, 0);
      this.lbBot.scale.set(W, lb, 1);
      this.lbBot.position.set(W / 2, -H + lb / 2, 0);
    }
    const at = stage.phase === 'arrive' || stage.phase === 'done' ? stage.arriveT || 0 : -1;
    if (at < 0) this._cardT0 = -1;
    else if (this._cardT0 < 0 && ((stage.glider && stage.glider.landed > 0.25) || at > 2.4)) {
      this._cardT0 = Math.max(at, 1.45);
    }
    const show = this._cardT0 >= 0 && at >= this._cardT0;
    this.card.visible = show;
    if (!show) {
      this._cardShown = -1;
      return;
    }
    const ct = at - this._cardT0;
    const e = clamp(ct / 0.45, 0, 1);
    const cnt = smooth01((ct - 0.25) / 1.0);
    const shown = Math.round((stage.bonus || 0) * cnt);
    if (shown !== this._cardShown || this._cardForW !== W) {
      this._cardShown = shown;
      this._cardForW = W;
      this._drawCard(stage, shown);
    }
    const wide = W > H * 1.15;
    const fit = wide ? Math.min(1, (H * 0.44) / this._cardH) : 1;
    const s = (0.85 + 0.15 * easeOutBack(e)) * fit;
    const cx = wide ? Math.max((this._cardW * fit) / 2 + 14, W * 0.26) : W / 2;
    const cy = wide ? H * 0.14 + (this._cardH * fit) / 2 : H * 0.2 + this._cardH / 2;
    this.card.scale.set(this._cardW * s, this._cardH * s, 1);
    this.card.position.set(cx, -cy + (1 - e) * 16, 0);
    this.card.material.opacity = e;
  }

  _updateParticles(particles, pr) {
    const g = this.partPoints.geometry;
    const n = particles ? Math.min(particles.length, MAX_PART) : 0;
    const rgb = this._rgb;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      this.pPos[i * 3] = p.x * this._kx;
      this.pPos[i * 3 + 1] = -p.y * this._ky;
      this.pPos[i * 3 + 2] = 0;
      this._parseColor(p.color || '#ffffff', rgb);
      this.pCol[i * 3] = rgb[0];
      this.pCol[i * 3 + 1] = rgb[1];
      this.pCol[i * 3 + 2] = rgb[2];
      this.pSize[i] = (p.size || 4) * 2.6;
      this.pAlpha[i] = clamp(p.life / (p.maxLife || 1), 0, 1);
    }
    g.setDrawRange(0, n);
    if (n) {
      g.attributes.position.needsUpdate = true;
      g.attributes.aColor.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
      g.attributes.aAlpha.needsUpdate = true;
    }
    this.partMat.uniforms.uPR.value = pr;
  }

  _updatePopups(popups, stage) {
    const n = popups ? Math.min(popups.length, MAX_POP) : 0;
    const s = stage.s || 1;
    for (let i = 0; i < MAX_POP; i++) {
      const m = this.popPool[i];
      if (i >= n) {
        m.visible = false;
        continue;
      }
      const pop = popups[i];
      if (pop.x == null || pop.y == null) {
        m.visible = false;
        continue;
      }
      let e = pop.__glideTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#ffffff')) {
        e = this._popupTex(pop.text, pop.color || '#ffffff');
        pop.__glideTex = e;
      } else {
        e.used = this._popFrame;
      }
      if (m.material.map !== e.tex) {
        m.material.map = e.tex;
        m.material.needsUpdate = true;
      }
      const t = 1 - clamp(pop.life / (pop.maxLife || 1), 0, 1);
      const pin = t < 0.14 ? easeOutBack(t / 0.14) * 1.15 : 1.15 - Math.min(0.15, (t - 0.14) * 1.2);
      const hgt = 20 * s * Math.max(0.05, pin);
      let x = pop.x * this._kx;
      const w = hgt * e.aspect;
      x = clamp(x, w / 2 + 4, this.width - w / 2 - 4);
      m.scale.set(w, hgt, 1);
      m.position.set(x, -pop.y * this._ky, 1);
      m.material.opacity = clamp(1 - t * t, 0, 1);
      m.visible = true;
    }
  }

  dispose() {
    this._disposed = true;
    this.pogoRig?.group?.removeFromParent?.();
    this.pogoRig?.dispose?.();
    const seen = new Set();
    const kill = (o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap']) {
          const t = m[k];
          if (t && t !== this.softDot && !seen.has(t)) {
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
    for (const t of this._comboTex) if (t) t.dispose();
    for (const k in this._warnTex) this._warnTex[k].dispose();
    this._markerTex?.dispose();
    this.sailClothNormalTex?.dispose();
    this.sailClothRoughTex?.dispose();
    this.skyPanoramaTex?.dispose();
    this.moonDetailTex?.dispose();
    this.basaltTex?.dispose();
    this.basaltNormalTex?.dispose();
    this.basaltBumpTex?.dispose();
    this.stormNoiseTex?.dispose();
    this.waterNormalTex?.dispose();
    this.foamRingTex?.dispose();
    this._envRT?.dispose();
    if (this.cloudTex && this.cloudTex !== this.stormNoiseTex) this.cloudTex.dispose();
    this.starTex?.dispose();
    this.ringTex?.dispose();
    if (this._ownSoftDot) this.softDot.dispose();
  }
}
