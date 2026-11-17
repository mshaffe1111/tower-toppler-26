// MK.7 Mini-Submarine & 2026 Reboot Manta-Bathysphere Renderer (`src/subRenderer.js`)
//
// Ported from `origin/main` (`e42c3da`) + `docs/wip/sub-stage-upgrade.patch` (shader precompile,
// DOF bokeh clamp, surfacing splash spray) and upgraded to 2026 Reboot perfection:
//  - Dual-Era Hero Craft:
//    * `era === 'reboot'`: Loads `assets/models/reboot_sub_mk7.glb` via `GLTFLoader` (with an
//      instant Frame-0 sculpted dark-titanium/brass Manta-Bathysphere fallback), clear panoramic
//      glass `nose_dome`, twin plasma-bubble wing thrusters, chin searchlights, dancing hull
//      caustics, and **Explorer Pogo V2 (`PogoRig` from `./pogo.js`)** seated visibly at
//      `pilot_seat` `(0.36, -0.18, 0)` illuminated by warm/cyan helm instruments!
//    * `era === 'original'`: Classic glossy 2008 XBLA HD yellow & crimson MK.7 hull + spinning
//      4-blade stern propeller + Explorer Pogo V2 in the upper glass turret canopy.
//  - `.glb` Abyssal Fauna & Landmarks:
//    * `assets/models/alien_fish_1.glb` (Abyssal Angler-Stalker) & `alien_fish_2.glb` (Veil-Fin
//      Ribbon Ray-Fish) baked into GPU-undulating caustic `InstancedMesh` pipelines for both
//      gameplay schools AND the 124-fish boid schools parting around the sub!
//    * `assets/models/sea_mine.glb` (barnacle-encrusted horned naval mine + cryo-freeze Sonar
//      tint) above 260 swaying anchor chain links (`MAX_LINKS = 260`).
//    * `assets/models/warp_cavern.glb` (jagged basalt & glowing amethyst/cyan crystal arch +
//      swirling GLSL abyssal portal throat).
//    * Expanding 3D Abyssal Sonar Ping wavefront (`sonarPulse`), 3D Volcanic Hydrothermal Bubble
//      Vents (`vents`), and spinning 3D Golden Gears (`isGear`) inside iridescent bubble shells.
//  - Seamless Zero-Allocation Adapter: `SubRenderer.render(...)` accepts `SubStage`, `game.js`'s
//    `state.sub`, or full `RenderState` with strict WebGL state save/restore & 0 per-frame GC!

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PogoRig, POGO_SKINS } from './pogo.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 50;
const CAM_Z = 16;
const TOWER_Z = -5.5;
const RUBBLE_Z = -7;
const BACKDROP_Z = -100;

const MAX_FISH = 64;
const MAX_GEAR = 24;
const MAX_AMB = 124;
const MAX_SHELL = 96;
const MAX_TORP = 18;
const MAX_JELLY = 14;
const MAX_MINE = 14;
const MAX_LINKS = 260;
const MAX_CLAM = 6;
const MAX_VENT = 8;
const MAX_GLOW = 460;
const MAX_STAR = 160;
const MAX_SHADE = 56;
const MAX_RING = 28;
const MAX_PART = 600;
const MAX_WAKE = 260;
const MAX_POP = 18;

const SKIN_MAP = new Map(POGO_SKINS.map((s) => [s.id, s]));

const BLASTER_FX_COLORS = {
  standard_cryo: { core: '#e0f2fe', glow: '#38bdf8', accent: '#5efce8' },
  cryo_cyan: { core: '#e0f2fe', glow: '#38bdf8', accent: '#5efce8' },
  emerald_plasma: { core: '#ecfdf5', glow: '#10b981', accent: '#34d399' },
  emerald_venom: { core: '#ecfdf5', glow: '#10b981', accent: '#34d399' },
  solar_ember: { core: '#fef9c3', glow: '#f97316', accent: '#fbbf24' },
  solar_amber: { core: '#fef9c3', glow: '#f97316', accent: '#fbbf24' },
  amethyst_void: { core: '#fae8ff', glow: '#a855f7', accent: '#e879f9' },
  plasma_violet: { core: '#fae8ff', glow: '#a855f7', accent: '#e879f9' },
  void_crimson: { core: '#ffe4e6', glow: '#f43f5e', accent: '#fb7185' },
  retro_voxel: { core: '#ffffff', glow: '#22d3ee', accent: '#fde047' },
  diamond_prism: { core: '#ffffff', glow: '#67e8f9', accent: '#f0abfc' },
  prismatic_star: { core: '#ffffff', glow: '#67e8f9', accent: '#f0abfc' },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
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

// Shared session-wide GLB promise cache so multiple SubRenderer lifecycles never re-fetch
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
        (gltf) => resolve(gltf && gltf.scene ? gltf.scene : null),
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

// ---------------------------------------------------------------------------------- Dual-Era Palettes
// Reboot Mode (`PAL_REBOOT_HEX`): Moody, wet, dark-cinematic Moonlit Storm abyssal palette
// matching `media_1794856383556_f193848e.jpg` & Explorer Pogo V2 across all healing stages!
const PAL_REBOOT_HEX = {
  fog: ['#040d1e', '#06152c', '#081e3a'],
  hemiSky: ['#4678a3', '#6ec4f0', '#a5e0fc'],
  hemiGround: ['#040915', '#071124', '#091a33'],
  sun: ['#8ebcf7', '#c2deff', '#e0f0ff'],
  surf: ['#06162c', '#081d38', '#0a2546'],
  surfDeep: ['#020712', '#030c1c', '#051226'],
  surfHi: ['#38bdf8', '#67e8f9', '#93e6ff'],
  surfSun: ['#56a3d9', '#7dd3fc', '#bae6fd'],
  ray: ['#38bdf8', '#67e8f9', '#93e6ff'],
  sandA: ['#090f1f', '#10182e', '#16223c'],
  sandB: ['#16203b', '#202e50', '#293b64'],
  caustic: ['#38bdf8', '#67e8f9', '#bae6fd'],
  toxic: ['#10b981', '#22d3ee', '#38bdf8'],
  snow: ['#5efce8', '#7dd3fc', '#bae6fd'],
  bio: ['#5efce8', '#38bdf8', '#2dd4bf'],
  rock: ['#121d36', '#192847', '#213459'],
  far: ['#091930', '#0d2442', '#122f54'],
  vignette: ['#01040a', '#020712', '#030b18'],
  skyTop: ['#030712', '#050b1a', '#071124'],
  skyHor: ['#0d1e36', '#132a48', '#193558'],
  skySun: ['#d8ecff', '#e4f1ff', '#f2f8ff'],
  glass: ['#7fe8ff', '#a8ecff', '#d8fbff'],
};

// Original Mode (`PAL_ORIGINAL_HEX`): Crisp 2008 XBLA HD vibrant turquoise/sapphire arcade sea
const PAL_ORIGINAL_HEX = {
  fog: ['#071827', '#0e3a52', '#0a6787'],
  hemiSky: ['#5f8f8a', '#9ad8e6', '#d8fbff'],
  hemiGround: ['#180c2c', '#103043', '#0b4560'],
  sun: ['#8fb7a0', '#e6f4d6', '#fff2d2'],
  surf: ['#1d3a3c', '#3a8fa2', '#5ccbe0'],
  surfDeep: ['#08141c', '#0d3446', '#0f5874'],
  surfHi: ['#86c79a', '#c2f2fb', '#effdff'],
  surfSun: ['#b9d98a', '#fff4d6', '#fffaf0'],
  ray: ['#6fb7a8', '#c9f2ea', '#fff4d4'],
  sandA: ['#16182a', '#45463f', '#8c6d48'],
  sandB: ['#2a2c44', '#716f5e', '#c9ad7c'],
  caustic: ['#6fffd8', '#c9fff5', '#fffbe8'],
  toxic: ['#7dff2e', '#6be08a', '#40c0a0'],
  snow: ['#69f0ff', '#cdeff2', '#fff6dc'],
  bio: ['#ff5fd2', '#a3e9ff', '#fffbe8'],
  rock: ['#1f2238', '#2c4652', '#3a6672'],
  far: ['#14213a', '#1a4154', '#16657f'],
  vignette: ['#02060e', '#020c16', '#01161f'],
  skyTop: ['#181c48', '#2c5fb8', '#2f7fe0'],
  skyHor: ['#d9875f', '#ffc896', '#ffe0b8'],
  skySun: ['#ff9a52', '#ffd590', '#fff1c8'],
  glass: ['#7fe8ff', '#a8ecff', '#d8fbff'],
};

const PAL_REBOOT = {};
const PAL_ORIG = {};
for (const k in PAL_REBOOT_HEX) PAL_REBOOT[k] = PAL_REBOOT_HEX[k].map((h) => new THREE.Color(h));
for (const k in PAL_ORIGINAL_HEX) PAL_ORIG[k] = PAL_ORIGINAL_HEX[k].map((h) => new THREE.Color(h));

function mix3(out, stops, h) {
  if (h <= 0.5) return out.lerpColors(stops[0], stops[1], h * 2);
  return out.lerpColors(stops[1], stops[2], (h - 0.5) * 2);
}

// Classic Original HD fish colors vs Reboot bioluminescent abyssal tints (multiplied onto GLB textures)
const ORIG_SMALL_FISH_HEX = ['#ff8a3d', '#ffd23f', '#ff5fa2', '#8bff5a', '#45dcff'];
const ORIG_BIG_FISH_HEX = ['#8f7bff', '#ff6464', '#2fd6c1'];
const REBOOT_FISH_TINTS = ['#ffffff', '#b8f3ff', '#f5d0fe', '#99f6e4', '#bae6fd'];
const REBOOT_BIG_TINTS = ['#e0f2fe', '#f3e8ff', '#a7f3d0'];
const GOLD_HEX = '#ffc928';
const JELLY_HEX = ['#e879f9', '#a855f7', '#38bdf8'];
const CORAL_LUSH_ORIG_HEX = ['#22d3ee', '#c084fc', '#34d399', '#f472b6', '#38bdf8', '#fbbf24', '#818cf8', '#5efce8'];
const CORAL_LUSH_REBOOT_HEX = ['#14b8a6', '#22d3ee', '#34d399', '#38bdf8', '#2dd4bf', '#f59e0b', '#06b6d4', '#5eead4'];
const CORAL_DEAD_HEX = ['#0d1526', '#101a2e', '#131e33', '#0b1220'];

// ---------------------------------------------------------------------------------- GLSL bits
const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
float caustic(vec2 uv, float time){
  vec2 p = uv * 6.28318 - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 1.0);
}
`;

const GLSL_CAUSTIC_LITE = /* glsl */ `
float causticLite(vec2 p, float t){
  vec2 q = p + vec2(sin(p.y * 1.7 + t * 0.9), cos(p.x * 1.3 - t * 0.7)) * 0.55;
  float a = sin(q.x * 2.1 + t) * sin(q.y * 2.3 - t * 0.8);
  vec2 r = p * 1.63 + vec2(cos(p.y * 2.1 - t * 0.6), sin(p.x * 1.9 + t * 0.8)) * 0.5;
  float b = sin(r.x * 2.4 - t * 1.1) * sin(r.y * 2.0 + t * 0.7);
  float c = 1.0 - abs(a + b) * 0.5;
  c = c * c; c = c * c * c;
  return c;
}
`;

const GLSL_FOG_PARS = /* glsl */ `
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
`;

const GLSL_OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

function duneRaw(x, z) {
  return Math.sin(x * 0.33) * 0.35 + Math.sin(x * 0.81 + z * 0.47) * 0.18 + Math.sin(x * 1.9 - z * 1.3) * 0.05;
}
function duneAmp(z) {
  const t = clamp((1.5 - z) / 7.5, 0, 1);
  return lerp(0.12, 1.0, t * t * (3 - 2 * t));
}

// ---------------------------------------------------------------------------------- Geometry & Texture Helpers
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
  return paint(geo, (_x, _y, _z, c) => {
    c[0] = r;
    c[1] = g;
    c[2] = b;
  });
}
function solidC(geo, color, k = 1) {
  return solid(geo, color.r * k, color.g * k, color.b * k);
}
function flag(geo, name, v) {
  geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(v), 1));
  return geo;
}

const STD_ATTRS = ['position', 'normal', 'color', 'uv'];
function merge(list, extras = []) {
  const keep = STD_ATTRS.concat(extras);
  const prepared = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    for (const name of Object.keys(ng.attributes)) {
      if (!keep.includes(name)) ng.deleteAttribute(name);
    }
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    }
    if (!ng.attributes.color) solid(ng, 1, 1, 1);
    for (const e of extras) if (!ng.attributes[e]) flag(ng, e, 0);
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

function makeDataTex(w, h, fillFn, { srgb = false, repeat = true } = {}) {
  const data = new Uint8Array(w * h * 4);
  fillFn(data, w, h);
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// Tileable craggy wet-basalt & chiseled stone normal map (periodic FBM — zero diagonal crosshatch!)
function makeStoneNormalTex(size = 128) {
  return makeDataTex(size, size, (data, w, h) => {
    const hashG = (ix, iy, per, salt) => {
      const wx = ((ix % per) + per) % per;
      const wy = ((iy % per) + per) % per;
      let n = (wx * 374761393 + wy * 668265263 + salt * 1442695041) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
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
      const a = hashG(ix, iy, per, salt);
      const b = hashG(ix + 1, iy, per, salt);
      const c = hashG(ix, iy + 1, per, salt);
      const d = hashG(ix + 1, iy + 1, per, salt);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    const hf = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const wx = (pNoise(u, v, 4, 17) - 0.5) * 0.14;
        const wy = (pNoise(u, v, 4, 41) - 0.5) * 0.14;
        const o1 = pNoise(u + wx, v + wy, 5, 103) * 0.55;
        const o2 = pNoise(u + wx, v + wy, 11, 223) * 0.3;
        const o3 = pNoise(u + wx, v + wy, 23, 337) * 0.15;
        hf[y * w + x] = o1 + o2 + o3;
      }
    }
    const str = 2.2;
    for (let y = 0; y < h; y++) {
      const ym = (y - 1 + h) % h;
      const yp = (y + 1) % h;
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w;
        const xp = (x + 1) % w;
        const dx = (hf[y * w + xp] - hf[y * w + xm]) * str;
        const dy = (hf[yp * w + x] - hf[ym * w + x]) * str;
        const nx = -dx;
        const ny = -dy;
        const nz = 1;
        const inv = 1 / Math.hypot(nx, ny, nz);
        const i4 = (y * w + x) * 4;
        data[i4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
        data[i4 + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
        data[i4 + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
        data[i4 + 3] = 255;
      }
    }
  });
}

// Seamless porous polyp-pore & organic coral vein normal map (eliminates smooth plastic reef look!)
function makeCoralPorousNormalTex(size = 128) {
  return makeDataTex(size, size, (data, w, h) => {
    const hashG = (ix, iy, per, salt) => {
      const wx = ((ix % per) + per) % per;
      const wy = ((iy % per) + per) % per;
      let n = (wx * 374761393 + wy * 668265263 + salt * 1442695041) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    // Cellular Worley polyp pores + ridged skeletal veins on periodic grid
    const worley = (u, v, per, salt) => {
      const gx = u * per;
      const gy = v * per;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      let minD = 9;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx + hashG(ix + dx, iy + dy, per, salt);
          const cy = iy + dy + hashG(ix + dx, iy + dy, per, salt + 71);
          const d2 = (gx - cx) * (gx - cx) + (gy - cy) * (gy - cy);
          if (d2 < minD) minD = d2;
        }
      }
      return Math.sqrt(minD);
    };
    const hf = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const pore1 = worley(u, v, 14, 13);
        const pore2 = worley(u, v, 28, 59);
        const vein = Math.sin((u * 6 + Math.sin(v * TAU * 2) * 0.25) * TAU) * 0.18;
        hf[y * w + x] = smoothstep(0.08, 0.52, pore1) * 0.62 + smoothstep(0.06, 0.48, pore2) * 0.38 + vein;
      }
    }
    const str = 2.85;
    for (let y = 0; y < h; y++) {
      const ym = (y - 1 + h) % h;
      const yp = (y + 1) % h;
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w;
        const xp = (x + 1) % w;
        const dx = (hf[y * w + xp] - hf[y * w + xm]) * str;
        const dy = (hf[yp * w + x] - hf[ym * w + x]) * str;
        const nx = -dx;
        const ny = -dy;
        const nz = 1;
        const inv = 1 / Math.hypot(nx, ny, nz);
        const i4 = (y * w + x) * 4;
        data[i4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
        data[i4 + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
        data[i4 + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
        data[i4 + 3] = 255;
      }
    }
  });
}

function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeDataTex(16, 16, (d) => d.fill(255), { srgb, repeat });
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
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

/**
 * Extracts and bakes a multi-node `.glb` scene into a single normalized `BufferGeometry` +
 * optional primary albedo/normal maps so `.glb` creatures & mines render via 1 `InstancedMesh`!
 */
function bakeGlbForInstancing(glbRoot, { scale = 1, minY = -Infinity, tailStartX = 999 } = {}) {
  glbRoot.updateMatrixWorld(true);
  const invRoot = new THREE.Matrix4().copy(glbRoot.matrixWorld).invert();
  const relMat = new THREE.Matrix4();
  const nrmMat = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const parts = [];
  let primaryMap = null;
  let primaryNormalMap = null;

  glbRoot.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    relMat.multiplyMatrices(invRoot, obj.matrixWorld);
    nrmMat.getNormalMatrix(relMat);

    const srcGeo = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const groups =
      srcGeo.groups && srcGeo.groups.length > 0
        ? srcGeo.groups
        : [{ start: 0, count: srcGeo.attributes.position.count, materialIndex: 0 }];

    const posAttr = srcGeo.attributes.position;
    const nrmAttr = srcGeo.attributes.normal;
    const uvAttr = srcGeo.attributes.uv;
    const isTailNode = /tail/i.test(obj.name || '');
    const isPectoralNode = /pectoral/i.test(obj.name || '');

    for (const grp of groups) {
      const mat = mats[grp.materialIndex || 0] || mats[0];
      const hasMap = Boolean(mat && mat.map);
      if (hasMap && !primaryMap) primaryMap = mat.map;
      if (mat && mat.normalMap && !primaryNormalMap) primaryNormalMap = mat.normalMap;

      const baseCol = mat && mat.color ? mat.color : new THREE.Color(1, 1, 1);
      const emCol = mat && mat.emissive ? mat.emissive : new THREE.Color(0, 0, 0);
      const emStr = mat && typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 0;
      const emLum = Math.max(emCol.r, emCol.g, emCol.b) * emStr;

      const outPos = [];
      const outNrm = [];
      const outUv = [];
      const outCol = [];
      const outUseMap = [];
      const outPartGlow = [];
      const outFin = [];

      const end = Math.min(posAttr.count, grp.start + grp.count);
      for (let t = grp.start; t + 2 < end; t += 3) {
        // Transform triangle & optionally cull static hanging chain links below `minY`
        let skipTri = false;
        const triP = [];
        const triN = [];
        for (let k = 0; k < 3; k++) {
          const idx = t + k;
          v.fromBufferAttribute(posAttr, idx).applyMatrix4(relMat);
          if (v.y < minY) skipTri = true;
          triP.push(v.x * scale, v.y * scale, v.z * scale);
          if (nrmAttr) {
            n.fromBufferAttribute(nrmAttr, idx).applyMatrix3(nrmMat).normalize();
            triN.push(n.x, n.y, n.z);
          } else {
            triN.push(0, 1, 0);
          }
        }
        if (skipTri) continue;

        for (let k = 0; k < 3; k++) {
          const idx = t + k;
          const px = triP[k * 3];
          const py = triP[k * 3 + 1];
          const pz = triP[k * 3 + 2];
          outPos.push(px, py, pz);
          outNrm.push(triN[k * 3], triN[k * 3 + 1], triN[k * 3 + 2]);
          if (uvAttr) {
            outUv.push(uvAttr.getX(idx), uvAttr.getY(idx));
          } else {
            outUv.push(0.5, 0.5);
          }
          if (hasMap) {
            outCol.push(1, 1, 1);
            outUseMap.push(1);
          } else if (emLum > 1.2) {
            outCol.push(
              clamp(Math.max(baseCol.r, emCol.r), 0, 1),
              clamp(Math.max(baseCol.g, emCol.g), 0, 1),
              clamp(Math.max(baseCol.b, emCol.b), 0, 1)
            );
            outUseMap.push(0);
          } else {
            outCol.push(baseCol.r, baseCol.g, baseCol.b);
            outUseMap.push(0);
          }
          outPartGlow.push(emLum > 0.25 ? Math.min(2.6, emLum) : 0);
          const finW = isTailNode || px / scale >= tailStartX ? 1.0 : isPectoralNode ? 0.5 : 0.0;
          outFin.push(finW);
        }
      }

      if (outPos.length > 0) {
        const sub = new THREE.BufferGeometry();
        sub.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
        sub.setAttribute('normal', new THREE.Float32BufferAttribute(outNrm, 3));
        sub.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
        sub.setAttribute('color', new THREE.Float32BufferAttribute(outCol, 3));
        sub.setAttribute('aUseMap', new THREE.Float32BufferAttribute(outUseMap, 1));
        sub.setAttribute('aPartGlow', new THREE.Float32BufferAttribute(outPartGlow, 1));
        sub.setAttribute('aFin', new THREE.Float32BufferAttribute(outFin, 1));
        parts.push(sub);
      }
    }
  });

  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return { geo: merged, map: primaryMap, normalMap: primaryNormalMap };
}

// Patch a MeshStandardMaterial with rim light, per-instance glow, sway, fish wag, GLB fin wag,
// selective GLB albedo map (`aUseMap`), per-vertex emissive (`aPartGlow`), underwater caustics,
// surface clipping, and above-water fog removal.
function patchStd(mat, U, opts = {}) {
  const {
    rim = null,
    glow = false,
    sway = 0,
    wag = false,
    finWag = false,
    useMapUniform = null,
    partGlow = false,
    nacre = false,
    caustic = 0,
    clip = false,
    airFog = false,
    eye = false,
    selfLit = null,
    key = 'std',
  } = opts;
  const needW = caustic > 0 || clip || airFog;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uScrollW = U.uScrollW;
    if (needW) {
      shader.uniforms.uSurfY = U.uSurfY;
      shader.uniforms.uSeabedY = U.uSeabedY;
      shader.uniforms.uCausticStr = U.uCausticStr;
      shader.uniforms.uCausticCol = U.uCausticCol;
    }
    if (rim) {
      shader.uniforms.uRimColor = { value: rim.color };
      shader.uniforms.uRimStr = rim.str;
    }
    if (selfLit) shader.uniforms.uSelfLit = selfLit;
    if (useMapUniform) {
      shader.uniforms.uBodyMap = useMapUniform.map;
      shader.uniforms.uHasBodyMap = useMapUniform.enabled;
    }

    let head = 'uniform float uTime;\nuniform float uScrollW;\n';
    if (glow) head += 'attribute float aGlow;\nvarying float vGlow;\n';
    if (wag || finWag) head += 'attribute vec3 aAnim;\n';
    if (finWag) head += 'attribute float aFin;\n';
    if (useMapUniform) head += 'attribute float aUseMap;\nvarying float vUseMap;\nvarying vec2 vMapUv;\n';
    if (partGlow) head += 'attribute float aPartGlow;\nvarying float vPartGlow;\n';
    if (eye) head += 'attribute float aEye;\nvarying float vEye;\n';
    if (needW) head += 'varying vec3 vCW;\n';
    if (airFog) head += 'uniform float uSurfY;\nvarying float vCamSub;\n';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`);

    let bv = '#include <begin_vertex>\n';
    if (glow) bv += 'vGlow = aGlow;\n';
    if (useMapUniform) bv += 'vUseMap = aUseMap;\nvMapUv = uv;\n';
    if (partGlow) bv += 'vPartGlow = aPartGlow;\n';
    if (eye) bv += 'vEye = aEye;\n';
    if (sway) {
      bv += `
      #ifdef USE_INSTANCING
        float swPh = (instanceMatrix[3].x + uScrollW) * 0.55 + instanceMatrix[3].z * 1.7;
      #else
        float swPh = 0.0;
      #endif
        float swH = max(position.y, 0.0);
        transformed.x += sin(uTime * 1.25 + swPh + swH * 1.4) * swH * swH * ${sway.toFixed(4)};
        transformed.z += cos(uTime * 0.9 + swPh * 1.3) * swH * swH * ${(sway * 0.45).toFixed(4)};
      `;
    }
    if (wag) {
      bv += `
        float wt = smoothstep(-0.35, 1.65, position.x);
        float wph = uTime * aAnim.x + aAnim.y;
        transformed.z += sin(wph - position.x * 2.4) * wt * wt * 0.6 * aAnim.z;
        transformed.y += sin(wph * 0.5) * 0.03 * aAnim.z;
      `;
    }
    if (finWag) {
      bv += `
        float wph = uTime * aAnim.x + aAnim.y;
        float bodyFlex = smoothstep(-0.25, 1.15, position.x);
        float tailBoost = step(0.8, aFin) * smoothstep(0.35, 1.25, position.x);
        transformed.z += sin(wph - position.x * 2.15) * (bodyFlex * bodyFlex * 0.34 + tailBoost * 0.28) * aAnim.z;
        if (aFin > 0.2 && aFin < 0.8) {
          float pecSpan = clamp((abs(position.z) - 0.16) / 0.38, 0.0, 1.0);
          transformed.y += sin(wph * 0.85 + sign(position.z) * 0.6) * pecSpan * 0.14 * aAnim.z;
        }
      `;
    }
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', bv);

    if (needW) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cwp = instanceMatrix * cwp;
        #endif
        vCW = (modelMatrix * cwp).xyz;
        ${airFog ? 'vCamSub = step(cameraPosition.y, uSurfY - 0.12);' : ''}`
      );
    }

    let fhead = '';
    if (rim) fhead += 'uniform vec3 uRimColor;\nuniform float uRimStr;\n';
    if (glow) fhead += 'varying float vGlow;\n';
    if (useMapUniform) fhead += 'uniform sampler2D uBodyMap;\nuniform float uHasBodyMap;\nvarying float vUseMap;\nvarying vec2 vMapUv;\n';
    if (partGlow) fhead += 'varying float vPartGlow;\n';
    if (eye) fhead += 'varying float vEye;\n';
    if (selfLit) fhead += 'uniform float uSelfLit;\n';
    if (airFog) fhead += 'varying float vCamSub;\n';
    if (needW) {
      fhead +=
        'uniform float uTime;\nuniform float uScrollW;\nuniform float uSurfY;\nuniform float uSeabedY;\nuniform float uCausticStr;\nuniform vec3 uCausticCol;\nvarying vec3 vCW;\n';
    }
    if (caustic > 0) fhead += GLSL_CAUSTIC_LITE;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fhead}`);

    if (clip) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (vCW.y > uSurfY) discard;\n'
      );
    } else if (airFog) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (vCamSub > 0.5 && vCW.y > uSurfY + 0.04) discard;\n'
      );
    }

    let cf = '#include <color_fragment>\n';
    if (useMapUniform) {
      cf += `
        if (uHasBodyMap > 0.5 && vUseMap > 0.5) {
          vec4 bTex = texture2D(uBodyMap, vMapUv);
          diffuseColor.rgb *= bTex.rgb;
        }
      `;
    }
    if (eye) cf += 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), vEye);\n';
    if (nacre) cf += 'if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.93), 0.72);\n';
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', cf);

    let ef = '#include <emissivemap_fragment>\n';
    if (glow) ef += 'totalEmissiveRadiance += diffuseColor.rgb * vGlow;\n';
    if (partGlow) ef += 'totalEmissiveRadiance += diffuseColor.rgb * vPartGlow;\n';
    if (selfLit) ef += 'totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;\n';
    if (rim) {
      ef += `
        float rimF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        totalEmissiveRadiance += uRimColor * (rimF * rimF * rimF) * uRimStr;
      `;
    }
    if (caustic > 0) {
      ef += `
        {
          vec2 cp = vec2(vCW.x + uScrollW + vCW.y * 0.3, vCW.z * 1.4 - vCW.y * 0.45) * 1.15;
          float cK = causticLite(cp, uTime * 1.1);
          float cDepth = mix(0.35, 1.0, clamp((vCW.y - uSeabedY) / max(uSurfY - uSeabedY, 0.001), 0.0, 1.0));
          float cUp = clamp(normal.y * 0.65 + 0.45, 0.0, 1.0);
          float cWet = 1.0 - smoothstep(uSurfY - 0.05, uSurfY + 0.05, vCW.y);
          totalEmissiveRadiance += diffuseColor.rgb * uCausticCol * min(cK * uCausticStr * cDepth * cUp * cWet * ${caustic.toFixed(3)}, 0.82);
        }
      `;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', ef);

    if (airFog) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `#ifdef USE_FOG
          float fogF = smoothstep(fogNear, fogFar, vFogDepth);
          fogF *= 1.0 - smoothstep(uSurfY - 0.02, uSurfY + 0.35, vCW.y);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogF);
        #endif`
      );
    }
  };
  const k = `${rim ? 1 : 0}${glow ? 1 : 0}${sway}${wag ? 1 : 0}${finWag ? 1 : 0}${useMapUniform ? 1 : 0}${partGlow ? 1 : 0}${nacre ? 1 : 0}${caustic}${clip ? 1 : 0}${airFog ? 1 : 0}${eye ? 1 : 0}${selfLit ? 1 : 0}`;
  mat.customProgramCacheKey = () => `sub_${key}_${k}`;
  return mat;
}

function instanced(geo, mat, count, { color = true, glow = false, anim = false } = {}) {
  if (glow && !geo.attributes.aGlow) {
    geo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(count), 1));
  }
  if (anim && !geo.attributes.aAnim) {
    geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
  }
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

// ---------------------------------------------------------------------------------- Procedural Builders
function buildStaghorn(rng) {
  const parts = [];
  const tips = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const mid = new THREE.Vector3();
  const branch = (start, dir, len, rad, depth) => {
    const end = start.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(rad * 0.64, rad * 1.06, len, 5, 1, true);
    const gp = g.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const py = gp.getY(i) + len * 0.5;
      const t = clamp(py / Math.max(len, 1e-4), 0, 1);
      const nodule = 1 + 0.14 * Math.sin(t * 10 + start.x * 5);
      gp.setXYZ(i, gp.getX(i) * nodule, py, gp.getZ(i) * nodule);
    }
    g.computeVertexNormals();
    q.setFromUnitVectors(up, dir);
    g.applyQuaternion(q);
    g.translate(start.x, start.y, start.z);
    parts.push(g);
    if (depth === 0) {
      const s = new THREE.IcosahedronGeometry(rad * 0.9, 0);
      s.scale(0.88, 1.32, 0.88);
      s.applyQuaternion(q);
      s.translate(end.x, end.y, end.z);
      parts.push(s);
      tips.push(end.clone());
      return;
    }
    const n = depth === 3 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const d = dir.clone();
      d.x += (rng() - 0.5) * 1.28;
      d.z += (rng() - 0.5) * 0.95;
      d.y += 0.28;
      d.normalize();
      mid.copy(end);
      branch(mid, d, len * (0.66 + rng() * 0.16), rad * 0.68, depth - 1);
    }
  };
  const baseRock = new THREE.IcosahedronGeometry(0.28, 0);
  baseRock.scale(1.25, 0.55, 1.15);
  baseRock.translate(0, 0.02, 0);
  parts.push(baseRock);
  branch(new THREE.Vector3(0, -0.06, 0), up, 0.48, 0.125, 3);
  const geo = merge(parts);
  paint(geo, (x, y, z, c) => {
    const h = clamp(y / 1.28, 0, 1);
    const tipK = Math.pow(h, 2.3);
    const vein = 0.5 + 0.5 * Math.sin(x * 16 + y * 12 + z * 14);
    c[0] = lerp(0.08, 1.0, tipK) * (0.85 + 0.15 * vein);
    c[1] = lerp(0.12, 1.0, tipK) * (0.85 + 0.15 * vein);
    c[2] = lerp(0.2, 1.0, tipK) * (0.88 + 0.12 * vein);
  });
  return { geo, tips };
}

function buildBrain() {
  const g = new THREE.SphereGeometry(1, 15, 9);
  const p = g.attributes.position;
  const uvs = g.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const fold =
      Math.sin(v.x * 13 + Math.sin(v.z * 8.5) * 2.1) *
      Math.cos(v.z * 12 - Math.sin(v.y * 10) * 1.8);
    const crag = 1 + fold * 0.085 + 0.06 * Math.sin(v.x * 4.2 + v.z * 3.7);
    v.multiplyScalar(crag);
    if (v.y < 0) v.y *= 0.22;
    p.setXYZ(i, v.x * 1.08, v.y * 0.72, v.z * 0.96);
    if (uvs) uvs.setXY(i, uvs.getX(i) * 3.0, uvs.getY(i) * 2.0);
  }
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const fold =
      Math.sin(x * 13 + Math.sin(z * 8.5) * 2.1) *
      Math.cos(z * 12 - Math.sin(y * 10) * 1.8);
    const ridge = Math.pow(clamp(fold * 0.5 + 0.5, 0, 1), 2.4) * smoothstep(-0.05, 0.55, y);
    c[0] = lerp(0.07, 0.95, ridge);
    c[1] = lerp(0.11, 1.0, ridge);
    c[2] = lerp(0.19, 1.0, ridge);
  });
  return g;
}

// Organic 3-tier ruffled Montipora / Turbinaria table-plate & chalice sponge reef (replaces smooth plastic cylinder pipes!)
function buildTableReef(rng) {
  const parts = [];
  const stalk = new THREE.CylinderGeometry(0.16, 0.34, 0.58, 7, 2, true);
  stalk.translate(0, 0.24, 0);
  {
    const sp = stalk.attributes.position;
    const suv = stalk.attributes.uv;
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i);
      const a = Math.atan2(sp.getZ(i), sp.getX(i));
      const crag = 1 + 0.22 * Math.sin(a * 4 + y * 7);
      const sx = sp.getX(i) * crag;
      const sz = sp.getZ(i) * crag;
      sp.setXYZ(i, sx, y, sz);
      if (suv) suv.setXY(i, sx * 0.85 + 0.5, y * 0.95);
    }
    stalk.computeVertexNormals();
  }
  parts.push(stalk);

  const tiers = [
    { y: 0.34, rIn: 0.12, rOut: 0.68, ox: -0.12, oz: 0.08, tiltX: 0.16, tiltZ: -0.14 },
    { y: 0.64, rIn: 0.1, rOut: 0.82, ox: 0.1, oz: -0.06, tiltX: -0.12, tiltZ: 0.18 },
    { y: 0.94, rIn: 0.08, rOut: 0.56, ox: -0.04, oz: 0.05, tiltX: 0.1, tiltZ: 0.1 },
  ];
  for (let ti = 0; ti < tiers.length; ti++) {
    const T = tiers[ti];
    const cup = new THREE.CylinderGeometry(T.rOut, T.rIn, 0.22, 14, 2, true);
    const cp = cup.attributes.position;
    const cuv = cup.attributes.uv;
    const ph = rng() * TAU;
    for (let i = 0; i < cp.count; i++) {
      const x = cp.getX(i);
      const y = cp.getY(i);
      const z = cp.getZ(i);
      const a = Math.atan2(z, x);
      const rr = Math.hypot(x, z);
      const rimT = clamp(rr / Math.max(T.rOut, 0.01), 0, 1);
      const ruffle = 1 + (0.18 * Math.sin(a * 6 + ph) + 0.09 * Math.cos(a * 11 - ph)) * rimT;
      const waveY = Math.sin(a * 7 + ph) * 0.055 * rimT + rimT * rimT * 0.08;
      const nx = x * ruffle;
      const nz = z * ruffle;
      cp.setXYZ(i, nx, y * 0.45 + waveY, nz);
      // Planar top-down UVs prevent radial cylinder-UV Moiré stripes!
      if (cuv) cuv.setXY(i, nx * 0.68 + 0.5 + ti * 0.27, nz * 0.68 + 0.5);
    }
    cup.rotateX(T.tiltX);
    cup.rotateZ(T.tiltZ);
    cup.translate(T.ox, T.y, T.oz);
    cup.computeVertexNormals();
    parts.push(cup);
  }
  const geo = merge(parts);
  paint(geo, (x, y, z, c) => {
    const rad = Math.hypot(x, z);
    const rim = smoothstep(0.24, 0.72, rad) * smoothstep(0.18, 0.95, y);
    const rib = 0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 10 + rad * 7);
    const k = clamp(rim * (0.76 + 0.28 * rib), 0, 1);
    c[0] = lerp(0.09, 1.0, k);
    c[1] = lerp(0.14, 1.0, k);
    c[2] = lerp(0.23, 1.0, k);
  });
  return geo;
}

// 3 sinuous, spirally-twisted 3D Macrocystis giant kelp ribbon blades (lean triangle budget + zero flat oval paddles!)
function buildKelp() {
  const parts = [];
  const blades = [
    { ox: 0.0, oz: 0.0, w: 0.38, h: 1.0, rotY: 0.15, phase: 0.0 },
    { ox: 0.11, oz: -0.08, w: 0.33, h: 0.88, rotY: 1.35, phase: 1.9 },
    { ox: -0.1, oz: 0.09, w: 0.29, h: 0.76, rotY: 2.55, phase: 3.7 },
  ];
  for (let k = 0; k < blades.length; k++) {
    const B = blades[k];
    const g = new THREE.PlaneGeometry(B.w, B.h, 1, 11);
    g.translate(0, B.h * 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x0 = p.getX(i);
      const y = p.getY(i);
      const ny = clamp(y / B.h, 0, 1);
      const widthEnv = Math.sin(Math.pow(ny, 0.72) * Math.PI * 0.94) * 1.12 + 0.08 * (1 - ny);
      const edgeFrac = Math.abs(x0) / Math.max(B.w * 0.5, 1e-4);
      const wx = x0 * widthEnv;
      const twist = ny * 2.15 + B.phase * 0.4;
      const ruffleZ = Math.sin(ny * 24 + B.phase + (x0 > 0 ? 0 : 1.4)) * 0.045 * edgeFrac;
      const sx = wx * Math.cos(twist) - ruffleZ * Math.sin(twist) + Math.sin(ny * 5.2 + B.phase) * 0.11 * ny;
      const sz = wx * Math.sin(twist) + ruffleZ * Math.cos(twist) + Math.cos(ny * 4.1 + B.phase) * 0.08 * ny;
      p.setXYZ(i, sx, y, sz);
    }
    g.rotateY(B.rotY);
    g.translate(B.ox, 0, B.oz);
    g.computeVertexNormals();
    paint(g, (x, y, z, c) => {
      const ny = clamp(y / B.h, 0, 1);
      const rOff = clamp(Math.hypot(x - B.ox, z - B.oz) / 0.2, 0, 1);
      const k = (0.28 + 0.52 * ny) * (0.68 + 0.52 * rOff);
      c[0] = k * 0.78;
      c[1] = k * 1.05;
      c[2] = k * 0.96;
    });
    parts.push(g);
  }
  return merge(parts);
}

// Continuous corrugated translucent kelp ribbon lamina texture (zero oval disc cutouts!)
function makeKelpTex() {
  return canvasTex(64, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const ny = 1 - y / h;
      const taper = Math.sin(Math.pow(clamp(ny, 0.01, 0.99), 0.75) * Math.PI * 0.96);
      const serrate = 1 + 0.09 * Math.sin(ny * 58) + 0.05 * Math.cos(ny * 113);
      const halfW = Math.max(2.5, w * 0.44 * taper * serrate);
      const g = ctx.createLinearGradient(w * 0.5 - halfW, y, w * 0.5 + halfW, y);
      g.addColorStop(0.0, 'rgba(210,255,238,0.0)');
      g.addColorStop(0.12, 'rgba(215,255,240,0.95)');
      g.addColorStop(0.42, 'rgba(135,195,168,0.98)');
      g.addColorStop(0.5, 'rgba(92,148,125,1.0)');
      g.addColorStop(0.58, 'rgba(135,195,168,0.98)');
      g.addColorStop(0.88, 'rgba(215,255,240,0.95)');
      g.addColorStop(1.0, 'rgba(210,255,238,0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(w * 0.5 - halfW, y, halfW * 2, 1.5);
    }
    ctx.strokeStyle = 'rgba(230,255,246,0.28)';
    ctx.lineWidth = 1.1;
    for (let i = 4; i < 28; i++) {
      const y0 = h - i * 8.8;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y0);
      ctx.quadraticCurveTo(w * 0.34, y0 - 5, w * 0.16, y0 - 12);
      ctx.moveTo(w * 0.5, y0 - 3);
      ctx.quadraticCurveTo(w * 0.66, y0 - 8, w * 0.84, y0 - 15);
      ctx.stroke();
    }
  });
}

function buildFan() {
  const g = new THREE.PlaneGeometry(2.1, 1.25, 12, 8);
  g.translate(0, 0.625, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, -x * x * 0.2 + Math.sin(x * 3.8 + y * 2.5) * 0.08 * y);
  }
  g.computeVertexNormals();
  paint(g, (x, y, _z, c) => {
    const tip = clamp(Math.hypot(x * 0.75, y) / 1.2, 0, 1);
    const k = lerp(0.14, 1.05, Math.pow(tip, 1.6));
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return g;
}

// Smooth-normals wet basalt boulder
function buildRock(rng, detail = 2) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3);
  const p = g.attributes.position;
  const uvs = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i);
    const y0 = p.getY(i);
    const z0 = p.getZ(i);
    const n =
      0.86 +
      0.16 * Math.sin(x0 * 3.1 + z0 * 2.4) +
      0.1 * Math.cos(y0 * 4.2 - x0 * 2.7) +
      (rng() - 0.5) * 0.07;
    p.setXYZ(i, x0 * n, y0 * n * 0.88, z0 * n);
    uvs[i * 2] = (Math.atan2(z0, x0) / TAU + 0.5) * 2;
    uvs[i * 2 + 1] = (y0 * 0.5 + 0.5) * 2;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

// Continuous manifold craggy abyssal canyon ridge wall & jagged sea-stack massif (zero cylinders, zero floating blocks!)
function buildAbyssalCanyonCliff(rng) {
  let g = new THREE.BoxGeometry(2.8, 1.0, 0.72, 16, 10, 3);
  g.translate(0, 0.5, 0);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3);
  const pos = g.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = x / 1.4; // -1..1
    const ny = clamp(y, 0, 1);
    // Sculpt 3 dramatic jagged mountain/canyon crag peaks across the ridge silhouette
    const p1 = Math.exp(-Math.pow((nx + 0.58) / 0.42, 2)) * 0.78;
    const p2 = Math.exp(-Math.pow((nx - 0.06) / 0.48, 2)) * 1.08;
    const p3 = Math.exp(-Math.pow((nx - 0.66) / 0.38, 2)) * 0.66;
    const serrate = 0.09 * (1.0 - Math.abs(Math.sin(nx * 7.5 + 0.6))) + 0.045 * Math.cos(nx * 14.0);
    const crestH = Math.max(0.24, Math.max(p1, Math.max(p2, p3)) + serrate);
    y = ny * crestH;

    // Taper thickness toward jagged ridge knife-edge + carve stepped basalt strata & undercut ledges
    const taperZ = lerp(1.22, 0.22, Math.pow(ny, 0.85));
    const strata = 0.07 * Math.sin(ny * 16.0 + nx * 3.2) + 0.05 * (1.0 - Math.abs(Math.sin(nx * 5.2 + ny * 4.5)));
    z = z * taperZ + strata * Math.sign(z || 1) + Math.sin(nx * 2.6) * 0.12;
    x = x * (1.0 - 0.12 * ny) + Math.sin(ny * 5.0 + nx * 2.0) * 0.08 + (rng() - 0.5) * 0.03;

    pos.setXYZ(i, x, y, z);
    uvs[i * 2] = x * 1.1 + 0.5;
    uvs[i * 2 + 1] = y * 2.6;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const ny = clamp(y, 0, 1.15);
    const ridgeCrest = smoothstep(0.22, 0.96, ny) * (0.72 + 0.28 * Math.sin(x * 4.4 + z * 3.5));
    const bioVein = Math.pow(Math.max(0, Math.sin(x * 6.5 + y * 8.2 - z * 4.0)), 14) * smoothstep(0.12, 0.78, ny);
    c[0] = lerp(0.36, 0.96, ridgeCrest) + bioVein * 0.14;
    c[1] = lerp(0.44, 1.06, ridgeCrest) + bioVein * 0.54;
    c[2] = lerp(0.58, 1.22, ridgeCrest) + bioVein * 0.68;
  });
  return g;
}

// Continuous manifold 2-span sunken Romanesque stone aqueduct / broken viaduct arch (ExtrudeGeometry — zero floating cubes!)
function buildSunkenAqueductArch() {
  const parts = [];
  const shape = new THREE.Shape();
  // Left battered pier outer base -> broken jagged Romanesque roadway deck -> crumbled right pier
  shape.moveTo(-1.42, 0.0);
  shape.lineTo(-1.32, 0.96);
  shape.lineTo(-1.08, 1.02);
  shape.lineTo(-0.74, 0.98);
  shape.lineTo(-0.46, 1.05);
  shape.lineTo(-0.12, 1.01);
  shape.lineTo(0.18, 0.96);
  // Weathered Romanesque parapet notch over the right arch span (strictly above y = 0.88 so zero arc self-intersection!)
  shape.lineTo(0.42, 0.91);
  shape.lineTo(0.66, 0.88);
  shape.lineTo(0.94, 0.93);
  shape.lineTo(1.22, 0.84);
  shape.lineTo(1.34, 0.0);
  // Carve right semicircular Romanesque arch intrados
  shape.lineTo(0.96, 0.0);
  shape.lineTo(0.96, 0.44);
  shape.absarc(0.62, 0.44, 0.34, 0.0, Math.PI, false);
  shape.lineTo(0.28, 0.0);
  // Center pier base -> carve left semicircular Romanesque arch intrados!
  shape.lineTo(-0.26, 0.0);
  shape.lineTo(-0.26, 0.46);
  shape.absarc(-0.66, 0.46, 0.4, 0.0, Math.PI, false);
  shape.lineTo(-1.06, 0.0);
  shape.closePath();

  const archBody = new THREE.ExtrudeGeometry(shape, {
    depth: 0.36,
    bevelEnabled: false,
    curveSegments: 10,
  });
  archBody.translate(0, 0, -0.18);
  parts.push(archBody);

  // Flared Romanesque stone pier plinths & impost capitals (solidly fused to piers)
  for (const px of [-1.22, 0.01, 1.14]) {
    const plinth = new THREE.BoxGeometry(0.46, 0.11, 0.46);
    plinth.translate(px, 0.055, 0);
    const cap = new THREE.BoxGeometry(0.42, 0.06, 0.44);
    cap.translate(px, 0.46, 0);
    parts.push(plinth, cap);
  }
  // Overhanging stone roadway cornice along intact left span
  const cornice = new THREE.BoxGeometry(1.58, 0.055, 0.45);
  cornice.translate(-0.56, 0.95, 0);
  parts.push(cornice);

  const merged = merge(parts);
  const mp = merged.attributes.position;
  const uvs = new Float32Array(mp.count * 2);
  for (let i = 0; i < mp.count; i++) {
    uvs[i * 2] = mp.getX(i) * 1.2 + 0.5;
    uvs[i * 2 + 1] = mp.getY(i) * 2.2;
  }
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.computeVertexNormals();
  paint(merged, (x, y, z, c) => {
    const h = clamp(y, 0, 1.08);
    const moss = smoothstep(0.35, 0.85, Math.sin(x * 5.8 + y * 7.2) * Math.cos(z * 6.0 + x * 3.1));
    const shade = lerp(0.54, 1.06, h);
    c[0] = shade * lerp(0.78, 0.52, moss * 0.45);
    c[1] = shade * lerp(0.88, 1.02, moss * 0.45);
    c[2] = shade * lerp(1.12, 0.92, moss * 0.45);
  });
  return merged;
}

// Real 3D Curved Beveled-Block Sunken Watchtower Ruin with Vaulted Stone Arch & Overhanging Corbel Ledge!
// (Zero painted checkerboard soup-can cylinder, and sculpted solid mortar core so zero blocks float!)
function buildBeveledTowerRuin({ courses = 7, cols = 11, radius = 1.0, seed = 41 } = {}) {
  const rng = mulberry32(seed);
  const parts = [];
  const courseH = 1.0 / courses;
  const rimAt = (a) => clamp(0.58 + 0.30 * Math.sin(a * 2.0 + 0.8) + 0.11 * Math.cos(a * 5.0), 0.28, 0.96);

  // 1. Recessed dark #050711 mortar core sculpted to exact jagged top parapet contour (zero floating sky gaps!)
  const core = new THREE.CylinderGeometry(radius * 0.91, radius * 0.99, 1.0, 20, 5, false);
  core.translate(0, 0.5, 0);
  {
    const cp = core.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const cx = cp.getX(i);
      const cy = cp.getY(i);
      const cz = cp.getZ(i);
      const ca = Math.atan2(cx, cz);
      const lim = Math.max(0.24, rimAt(ca) - courseH * 0.35);
      cp.setY(i, cy * lim);
    }
    core.computeVertexNormals();
  }
  solid(core, 0.16, 0.2, 0.32);
  parts.push(core);

  // 2. Individually-extruded 3D curved beveled ashlar blocks with jagged crumbled top parapet & doorway opening
  const doorAng = 0.0; // Facing +Z towards camera when ry ~ 0
  const addBevelBlock = (aMid, arcSpan, yMid, bh, rInner, rOuter, shadeR, shadeG, shadeB) => {
    const bw = Math.max(0.08, 2 * rOuter * Math.sin(arcSpan * 0.48));
    const bd = Math.max(0.08, rOuter - rInner);
    const bx = new THREE.BoxGeometry(bw, bh, bd, 1, 1, 1);
    const bp = bx.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const z = bp.getZ(i);
      if (z > 0) {
        bp.setX(i, bp.getX(i) * 0.93);
        bp.setY(i, bp.getY(i) * 0.91);
      }
      const lx = bp.getX(i);
      bp.setZ(i, z - (lx * lx) / (2.2 * rOuter));
    }
    bx.computeVertexNormals();
    bx.translate(0, yMid, (rInner + rOuter) * 0.5);
    bx.rotateY(aMid);
    solid(bx, shadeR, shadeG, shadeB);
    parts.push(bx);
  };

  const stepA = TAU / cols;
  for (let row = 0; row < courses; row++) {
    const yMid = (row + 0.5) * courseH;
    const taper = lerp(1.05, 0.96, row / courses);
    const offA = (row % 2) * stepA * 0.5;
    for (let ci = 0; ci < cols; ci++) {
      const a = -Math.PI + ci * stepA + offA;
      let daDoor = Math.abs(a - doorAng);
      if (daDoor > Math.PI) daDoor = TAU - daDoor;
      if (row >= 1 && row <= 3 && daDoor < stepA * 0.92) continue;
      if (yMid > rimAt(a)) continue;

      const rOut = radius * taper * (1.0 + (rng() - 0.5) * 0.045);
      const rIn = radius * taper * 0.86;
      const sh = 0.66 + rng() * 0.38;
      const moss = rng() < 0.22 && row <= 3;
      addBevelBlock(
        a,
        stepA * 0.96,
        yMid,
        courseH * 0.91,
        rIn,
        rOut,
        moss ? sh * 0.48 : sh * 0.84,
        moss ? sh * 0.92 : sh * 0.88,
        moss ? sh * 0.72 : sh * 1.08
      );
    }
  }

  // 3. Vaulted Romanesque Stone Doorway Arch Voussoirs + Keystone around the opening
  const archY = 3.65 * courseH;
  const archW = radius * 0.38;
  for (let vi = 0; vi < 7; vi++) {
    const t = vi / 6;
    const va = Math.PI * (1 - t);
    const vx = Math.cos(va) * archW;
    const vy = archY + Math.sin(va) * (courseH * 1.15);
    const vBox = new THREE.BoxGeometry(0.12 * radius, 0.14 * radius, 0.18 * radius);
    vBox.rotateZ(va - Math.PI * 0.5);
    vBox.translate(vx, vy, radius * 1.02);
    solid(vBox, 1.05, 1.1, 1.24);
    parts.push(vBox);
  }

  // 4. Overhanging Weathered 3D Stone Ledge + Curved Corbel Ribs (matching `reference_north_star.jpg`!)
  for (let li = -2; li <= 2; li++) {
    const la = doorAng + li * 0.36;
    addBevelBlock(la, 0.35, courseH * 0.92, courseH * 0.46, radius * 0.96, radius * 1.34, 0.95, 1.02, 1.16);
    if (li % 2 === 0) {
      // Stepped S-scroll stone corbel bracket underneath overhanging slab
      const rib = new THREE.BoxGeometry(0.11 * radius, courseH * 0.72, 0.26 * radius);
      rib.rotateX(0.32);
      rib.translate(0, courseH * 0.48, radius * 1.12);
      rib.rotateY(la);
      solid(rib, 0.66, 0.72, 0.86);
      parts.push(rib);
    }
  }

  const merged = merge(parts);
  // Compute cylindrical UVs so `stoneNormalTex` tiles cleanly across every 3D block face
  const mp = merged.attributes.position;
  const uvs = new Float32Array(mp.count * 2);
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i);
    const y = mp.getY(i);
    const z = mp.getZ(i);
    uvs[i * 2] = (Math.atan2(x, z) / TAU + 0.5) * 4.0;
    uvs[i * 2 + 1] = y * 3.0;
  }
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return merged;
}

function buildRuin() {
  return buildBeveledTowerRuin({ courses: 6, cols: 8, radius: 1.0, seed: 41 });
}

// Classic Original Mode fish
function buildClassicFish(low = false) {
  const body = low ? new THREE.SphereGeometry(1, 10, 7) : new THREE.SphereGeometry(1, 18, 12);
  {
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const taper = x > 0 ? 1 - 0.6 * x * x : 1 - 0.12 * x * x;
      let y = p.getY(i) * 0.56 * taper;
      if (y < 0) y *= 0.92;
      p.setXYZ(i, x * 1.02, y, p.getZ(i) * 0.32 * taper);
    }
    body.computeVertexNormals();
  }
  paint(body, (x, y, _z, c) => {
    let k = y < 0 ? 1.0 : lerp(1.0, 0.55, clamp(y / 0.42, 0, 1));
    if (Math.sin(x * 7.5 + 1.2) > 0.8 && y > -0.2) k *= 0.62;
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  const fin = (pts, depth = 0.04) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) s.lineTo(pts[i], pts[i + 1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  const tail = fin([0, 0.1, 0.55, 0.52, 0.42, 0.02, 0.55, -0.5, 0, -0.1]);
  tail.translate(0.9, 0, 0);
  solid(tail, 0.85, 0.85, 0.85);
  const dorsal = fin([-0.32, 0, 0.0, 0.34, 0.32, 0.0], 0.035);
  dorsal.translate(0.05, 0.42, 0);
  solid(dorsal, 0.7, 0.7, 0.7);
  const parts = [body, tail, dorsal];
  if (!low) {
    for (const sz of [1, -1]) {
      const pec = fin([0, 0, 0.26, 0.1, 0.22, -0.08], 0.03);
      pec.rotateY(sz * 0.5);
      pec.translate(-0.15, -0.14, sz * 0.22);
      solid(pec, 0.9, 0.9, 0.9);
      parts.push(pec);
    }
  }
  const eyes = [];
  for (const sz of [1, -1]) {
    if (!low) {
      const w = new THREE.SphereGeometry(0.16, 10, 8);
      w.translate(-0.56, 0.11, 0.17 * sz);
      solid(w, 1, 1, 1);
      flag(w, 'aEye', 1);
      eyes.push(w);
      const pu = new THREE.SphereGeometry(0.095, 8, 6);
      pu.translate(-0.65, 0.11, 0.26 * sz);
      solid(pu, 0.01, 0.01, 0.02);
      eyes.push(pu);
    } else {
      const e = new THREE.SphereGeometry(0.1, 5, 4);
      e.translate(-0.64, 0.11, 0.24 * sz);
      solid(e, 0.02, 0.02, 0.03);
      eyes.push(e);
    }
  }
  return merge(parts.concat(eyes), ['aEye']);
}

// Frame-0 Reboot Alien Fish Fallback & Low-LOD Ambient Boid School Mesh (zero white cartoon eyes!)
function buildRebootFallbackFish(species = 0, low = false) {
  const body = low ? new THREE.SphereGeometry(1, 9, 6) : new THREE.SphereGeometry(1, 20, 14);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const taper = x > 0 ? 1 - 0.64 * x * x : 1 - 0.18 * x * x;
    const y = p.getY(i) * (species === 0 ? 0.44 : 0.36) * taper;
    const z = p.getZ(i) * 0.28 * taper;
    p.setXYZ(i, x * 0.88, y, z);
  }
  body.computeVertexNormals();
  const cBase = species === 0 ? new THREE.Color('#0f6b99') : new THREE.Color('#6d28d9');
  const cStripe = species === 0 ? new THREE.Color('#5efce8') : new THREE.Color('#f472b6');
  const cTmp = new THREE.Color();
  paint(body, (x, y, _z, c) => {
    const band = Math.pow(0.5 + 0.5 * Math.sin(x * 11 + y * 5), 3);
    cTmp.copy(cBase).lerp(cStripe, band * 0.65 + clamp(-y * 1.4, 0, 0.35));
    c[0] = cTmp.r;
    c[1] = cTmp.g;
    c[2] = cTmp.b;
  });
  flag(body, 'aUseMap', 0);
  flag(body, 'aPartGlow', 0.18);
  flag(body, 'aFin', 0);

  const parts = [body];
  // Crescent ribbon tail
  for (const sy of [-1, 1]) {
    const lobe = new THREE.ConeGeometry(0.11, 0.62, low ? 4 : 6);
    lobe.rotateZ(-Math.PI / 2 + sy * 0.46);
    lobe.translate(0.92, sy * 0.22, 0);
    solidC(lobe, cStripe, 0.92);
    flag(lobe, 'aUseMap', 0);
    flag(lobe, 'aPartGlow', 0.55);
    flag(lobe, 'aFin', 1.0);
    parts.push(lobe);
  }
  if (!low) {
    // Swept pectorals
    for (const sz of [-1, 1]) {
      const pec = new THREE.ConeGeometry(0.08, 0.42, 5);
      pec.rotateX(sz * 1.15);
      pec.rotateY(-0.35 * sz);
      pec.translate(-0.12, -0.06, sz * 0.26);
      solidC(pec, cStripe, 0.85);
      flag(pec, 'aUseMap', 0);
      flag(pec, 'aPartGlow', 0.45);
      flag(pec, 'aFin', 0.5);
      parts.push(pec);
    }
    // Glossy dark abyssal eyes + bioluminescent angler esca lure on species 0
    for (const sz of [-1, 1]) {
      const eye = new THREE.SphereGeometry(0.085, 8, 6);
      eye.translate(-0.52, 0.08, sz * 0.21);
      solid(eye, 0.02, 0.04, 0.08);
      flag(eye, 'aUseMap', 0);
      flag(eye, 'aPartGlow', 0);
      flag(eye, 'aFin', 0);
      parts.push(eye);
    }
    if (species === 0) {
      const lure = new THREE.SphereGeometry(0.08, 8, 6);
      lure.translate(-0.84, 0.24, 0);
      solid(lure, 1.0, 0.45, 0.82);
      flag(lure, 'aUseMap', 0);
      flag(lure, 'aPartGlow', 2.2);
      flag(lure, 'aFin', 0);
      parts.push(lure);
    }
  }
  return merge(parts, ['aUseMap', 'aPartGlow', 'aFin']);
}

function buildMineFallback() {
  const parts = [];
  const body = new THREE.SphereGeometry(1, 22, 16);
  solid(body, 0.19, 0.23, 0.29);
  flag(body, 'aUseMap', 0);
  flag(body, 'aPartGlow', 0);
  parts.push(body);

  const ico = new THREE.IcosahedronGeometry(1, 0);
  const p = ico.attributes.position;
  const dirs = [];
  const seen = new Set();
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
    const k = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
    if (!seen.has(k)) {
      seen.add(k);
      dirs.push(v);
    }
  }
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (const d of dirs) {
    const horn = new THREE.CylinderGeometry(0.11, 0.17, 0.34, 8);
    horn.translate(0, 1.06, 0);
    const tip = new THREE.SphereGeometry(0.085, 8, 6);
    tip.translate(0, 1.28, 0);
    q.setFromUnitVectors(up, d);
    horn.applyQuaternion(q);
    tip.applyQuaternion(q);
    solid(horn, 0.68, 0.5, 0.22);
    flag(horn, 'aUseMap', 0);
    flag(horn, 'aPartGlow', 0);
    solid(tip, 1.0, 0.16, 0.24);
    flag(tip, 'aUseMap', 0);
    flag(tip, 'aPartGlow', 2.2);
    parts.push(horn, tip);
  }
  const band = new THREE.TorusGeometry(1.0, 0.065, 6, 32);
  band.rotateX(Math.PI / 2);
  solid(band, 0.72, 0.52, 0.22);
  flag(band, 'aUseMap', 0);
  flag(band, 'aPartGlow', 0);
  parts.push(band);
  return merge(parts, ['aUseMap', 'aPartGlow']);
}

function buildGoldenGearGeometry() {
  const parts = [];
  const rim = new THREE.TorusGeometry(0.62, 0.16, 10, 28);
  parts.push(rim);
  const hub = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16);
  hub.rotateX(Math.PI / 2);
  parts.push(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const tooth = new THREE.BoxGeometry(0.22, 0.28, 0.22);
    tooth.translate(0, 0.82, 0);
    tooth.rotateZ(a);
    parts.push(tooth);
    if (i < 4) {
      const spoke = new THREE.BoxGeometry(0.1, 1.16, 0.12);
      spoke.rotateZ(a);
      parts.push(spoke);
    }
  }
  return merge(parts);
}

function buildVentChimneyGeometry(rng) {
  let g = new THREE.CylinderGeometry(0.4, 1.02, 1.38, 18, 10, true);
  g.translate(0, 0.69, 0);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3);
  const p = g.attributes.position;
  const uvs = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const jag = 1 + Math.sin(a * 5 + y * 4.2) * 0.14 + Math.cos(a * 9 - y * 6.5) * 0.07 + (rng() - 0.5) * 0.04;
    p.setX(i, p.getX(i) * jag);
    p.setZ(i, p.getZ(i) * jag);
    if (y > 1.25) p.setY(i, y + Math.sin(a * 4) * 0.11);
    uvs[i * 2] = (a / TAU + 0.5) * 2.5;
    uvs[i * 2 + 1] = y * 2.0;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const a = Math.atan2(z, x);
    const rimGlow = smoothstep(0.95, 1.38, y) * (0.45 + 0.55 * Math.pow(Math.max(0, Math.sin(a * 5 + 0.8)), 4));
    const fissure = Math.pow(Math.max(0, Math.sin(a * 6 + y * 3.8)), 10) * clamp(1.15 - y * 0.45, 0, 1);
    const base = 0.042 + 0.038 * clamp(y, 0, 1);
    c[0] = base + fissure * 0.12 + rimGlow * 0.18;
    c[1] = base * 1.12 + fissure * 0.55 + rimGlow * 0.72;
    c[2] = base * 1.48 + fissure * 0.68 + rimGlow * 0.85;
  });
  return g;
}
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function buildShell() {
  const g = new THREE.SphereGeometry(1, 30, 8, 0, TAU, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const rr = Math.hypot(x, z);
    const ridge = 1 + Math.cos(a * 16) * 0.05 * rr;
    p.setXYZ(i, x * ridge, y * 0.36, z * ridge * 0.85);
  }
  g.computeVertexNormals();
  paint(g, (x, _y, z, c) => {
    const a = Math.atan2(z, x);
    const k = 0.72 + 0.28 * (0.5 + 0.5 * Math.cos(a * 16));
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  g.translate(0, 0, 0.85);
  return g;
}

// ---------------------------------------------------------------------------------- Custom Shader Materials
function bubbleShellMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color('#bdf4ff') }, uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].y * 2.3;
        vec3 p = position;
        float w = sin(dot(normal, vec3(3.0, 2.0, 1.0)) + uTime * 9.0 + ph) * 0.045
                + sin(dot(normal, vec3(-2.0, 3.0, 2.0)) * 1.7 - uTime * 6.0 + ph * 1.7) * 0.03;
        p += normal * w;
        vec4 w4 = instanceMatrix * vec4(p, 1.0);
        vec4 mv = modelViewMatrix * w4;
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint; uniform float uTime;
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.2);
        vec3 L = normalize(vec3(-0.55, 0.8, 0.6));
        float spec = pow(max(dot(n, normalize(L + v)), 0.0), 70.0);
        float spec2 = pow(max(dot(n, normalize(vec3(0.5, -0.6, 0.6) + v)), 0.0), 30.0) * 0.35;
        float film = fres * 1.4 + sin(n.x * 4.0 + n.y * 3.0 + uTime * 1.5) * 0.12;
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (film + vec3(0.0, 0.33, 0.67)));
        vec3 col = mix(uTint, irid, 0.45) * (0.35 + fres * 1.9) + vec3(spec * 2.4 + spec2);
        float a = clamp(0.08 + fres * 0.9 + spec + spec2, 0.0, 1.0);
        gl_FragColor = vec4(col, a);
        ${GLSL_OUT}
      }`,
  });
}

function jellyBellMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aAlpha;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vC; varying float vA; varying float vPh;
      void main(){
        vec3 p = position;
        float rimK = smoothstep(0.3, -0.12, p.y);
        float ang = atan(p.z, p.x);
        p.xz *= 1.0 + sin(ang * 8.0 + uTime * 3.0) * 0.05 * rimK;
        vL = position;
        vC = instanceColor; vA = aAlpha;
        vPh = instanceMatrix[3].x * 0.7 + instanceMatrix[3].y * 0.4;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(p, 1.0));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying vec3 vC; varying float vA; varying float vPh;
      void main(){
        float ndv = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 1.8);
        float ang = atan(vL.z, vL.x);
        float gon = smoothstep(0.55, 0.95, sin(ang * 4.0) * 0.5 + 0.5) * smoothstep(0.15, 0.5, vL.y) * smoothstep(0.82, 0.45, vL.y);
        float rim = smoothstep(0.12, -0.08, vL.y);
        float beat = 0.75 + 0.25 * sin(uTime * 3.0 + vPh);
        vec3 col = vC * (0.5 + fres * 1.35) * beat + vC * gon * 1.3 + vec3(1.0) * (fres * 0.12 + rim * 0.35);
        float a = clamp(0.6 + fres * 0.4 + gon * 0.3 + rim * 0.3, 0.0, 1.0) * vA;
        gl_FragColor = vec4(col, a);
        ${GLSL_OUT}
      }`,
  });
}

function tentacleMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute float aAlpha;
      varying vec3 vC; varying float vD; varying float vA;
      void main(){
        vec3 p = position;
        float d = -p.y;
        float ph = instanceMatrix[3].x * 0.8 + p.x * 4.0 + p.z * 6.0;
        p.x += sin(uTime * 2.4 - d * 2.6 + ph) * 0.16 * d + d * d * 0.09;
        p.z += cos(uTime * 1.9 - d * 2.2 + ph) * 0.08 * d;
        vD = clamp(d / 2.3, 0.0, 1.0);
        vC = instanceColor; vA = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(p, 1.0));
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vD; varying float vA;
      void main(){
        vec3 col = vC * (1.25 - vD * 0.6) + 0.12;
        gl_FragColor = vec4(col, (1.0 - vD) * 0.72 * vA);
        ${GLSL_OUT}
      }`,
  });
}

// Panoramic bathysphere / turret glass dome: crystal-clear center so Explorer Pogo V2 reads 100%
// razor-sharp inside, with crisp Schlick Fresnel rim & dual catchlight highlights!
function canopyMaterial(U, { clearCenter = 0.04 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: new THREE.Color('#9ee8ff') },
      uSky: { value: new THREE.Color('#d8fbff') },
      uTime: U.uTime,
      uCenterAlpha: { value: clearCenter },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vL = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint; uniform vec3 uSky; uniform float uTime; uniform float uCenterAlpha;
      varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.6);
        float spec = pow(max(dot(n, normalize(vec3(-0.42, 0.88, 0.72) + v)), 0.0), 110.0);
        float spec2 = pow(max(dot(n, normalize(vec3(0.68, 0.34, 0.78) + v)), 0.0), 48.0) * 0.32;
        float streak = smoothstep(0.92, 0.99, dot(n, normalize(vec3(-0.52, 0.62, 0.62)))) * 0.48;
        float skyRef = smoothstep(0.15, 0.92, n.y) * fres;
        vec3 col = uTint * (0.12 + fres * 1.35) + uSky * skyRef * 0.75 + vec3(spec * 2.4 + spec2 + streak);
        float alpha = clamp(uCenterAlpha + fres * 0.64 + spec + spec2 + streak, 0.0, 0.92);
        gl_FragColor = vec4(col, alpha);
        ${GLSL_OUT}
      }`,
  });
}

function lightConeMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#c8f1ff') },
      uCoreColor: { value: new THREE.Color('#ecfeff') },
      uStr: { value: 0.42 },
      uTime: U.uTime,
      uScrollW: U.uScrollW,
      uSurfY: U.uSurfY,
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aCore;
      varying float vT; varying float vCore; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vAng;
      void main(){
        vT = clamp(1.0 - uv.y, 0.0, 1.0);
        vCore = aCore;
        vAng = uv.x * 6.283185;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uCoreColor; uniform float uStr; uniform float uTime; uniform float uScrollW; uniform float uSurfY;
      varying float vT; varying float vCore; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying float vAng;
      ${GLSL_NOISE}
      void main(){
        if (vW.y > uSurfY) discard;
        float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), mix(1.55, 1.15, vCore));
        vec2 q = vec2(vW.x + uScrollW, vW.y * 1.35) * 2.4;
        float dust = vnoise(q + vec2(uTime * 0.42, uTime * 0.14)) * 0.58 + vnoise(q * 2.9 - vec2(uTime * 0.62, 0.0)) * 0.42;
        float mote = smoothstep(0.76, 0.96, vnoise(q * 6.2 + vec2(uTime * 0.3, -uTime * 0.22)));
        float rays = 0.72 + 0.28 * sin(vAng * 5.0 + uTime * 1.3 - vT * 4.0);
        float axial = smoothstep(0.0, 0.05, vT) * pow(1.0 - vT, mix(1.65, 1.25, vCore));
        float a = axial * edge * uStr * (0.58 + 0.62 * dust) * rays * mix(0.78, 1.28, vCore) + axial * edge * mote * uStr * 0.55;
        vec3 col = mix(uColor, uCoreColor, vCore * 0.65 + mote * 0.45);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.92));
        #include <colorspace_fragment>
      }`,
  });
}

function thrusterPlumeMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uBoost: { value: 0.65 },
      uInner: { value: new THREE.Color('#ffffff') },
      uOuter: { value: new THREE.Color('#38bdf8') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uBoost; uniform vec3 uInner; uniform vec3 uOuter;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float axial = clamp(vUv.y, 0.0, 1.0);
        float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.25);
        float pulse = 0.78 + 0.22 * sin(uTime * 38.0 - axial * 12.0);
        vec3 col = mix(uOuter, uInner, pow(axial, 1.8));
        float a = pow(axial, 1.35) * edge * pulse * clamp(uBoost, 0.0, 1.35) * 0.85;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
}

function propBlurMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uSpin: { value: 0 }, uAmt: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uSpin; uniform float uAmt; varying vec2 vP;
      void main(){
        float r = length(vP) / 0.27;
        float a = atan(vP.y, vP.x);
        float blades = 0.55 + 0.45 * sin(a * 4.0 - uSpin);
        float ring = smoothstep(1.0, 0.85, r) * smoothstep(0.18, 0.35, r);
        gl_FragColor = vec4(vec3(0.85, 0.9, 0.95), ring * blades * uAmt * 0.38);
        #include <colorspace_fragment>
      }`,
  });
}

// 3D Expanding Abyssal Sonar Ping Wavefront
function sonarWaveMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color('#5efce8') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uProgress; uniform vec3 uColor;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float ndv = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float rim = pow(1.0 - ndv, 2.8);
        float grid = smoothstep(0.82, 0.98, sin(atan(vP.y, vP.x) * 16.0 + uTime * 6.0)) * 0.35;
        float bands = smoothstep(0.75, 0.98, sin(length(vP.xy) * 22.0 - uTime * 18.0)) * 0.4;
        float fade = pow(clamp(1.0 - uProgress, 0.0, 1.0), 1.35);
        float a = (rim * 0.95 + (grid + bands) * rim) * fade;
        vec3 col = mix(uColor, vec3(0.9, 0.99, 1.0), rim * 0.55);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
        #include <colorspace_fragment>
      }`,
  });
}

// Hydrothermal Bubble Vent Shimmer Plume
function ventPlumeMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uSurfY: U.uSurfY,
      uColor: { value: new THREE.Color('#5efce8') },
      uBaseColor: { value: new THREE.Color('#fb923c') },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv; varying float vWy; varying float vPh;
      void main(){
        vUv = uv;
        vPh = instanceMatrix[3].x * 0.65;
        vec3 p = position;
        float h = clamp(uv.y, 0.0, 1.0);
        p.x += sin(uTime * 3.4 - h * 5.5 + vPh) * 0.14 * h;
        vec4 w = modelMatrix * (instanceMatrix * vec4(p, 1.0));
        vWy = w.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSurfY; uniform vec3 uColor; uniform vec3 uBaseColor;
      varying vec2 vUv; varying float vWy; varying float vPh;
      ${GLSL_NOISE}
      void main(){
        if (vWy > uSurfY) discard;
        float edge = sin(vUv.x * 3.14159);
        edge = edge * edge;
        float rise = vnoise(vec2(vUv.x * 4.5 + vPh, vUv.y * 5.0 - uTime * 2.6)) * 0.65
                   + vnoise(vec2(vUv.x * 9.0 - vPh, vUv.y * 11.0 - uTime * 4.4)) * 0.35;
        float vert = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.25);
        vec3 col = mix(uBaseColor, uColor, smoothstep(0.0, 0.24, vUv.y));
        float a = edge * vert * (0.28 + 0.72 * rise) * 0.42;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
}

// Warp Cavern Swirling Abyssal Portal Vortex (deep abyssal teal-indigo + underwater fog + cavern-mouth fade)
function portalVortexMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime,
      uFogColor: U.uFogColor,
      uFogNear: U.uFogNear,
      uFogFar: U.uFogFar,
      uSurfY: U.uSurfY,
      uOuter: { value: new THREE.Color('#082f49') },
      uMid: { value: new THREE.Color('#0284c7') },
      uInner: { value: new THREE.Color('#5efce8') },
      uVisAlpha: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vW; varying float vDepth;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uOuter; uniform vec3 uMid; uniform vec3 uInner;
      uniform float uSurfY; uniform float uVisAlpha;
      ${GLSL_FOG_PARS}
      varying vec2 vUv; varying vec3 vW; varying float vDepth;
      void main(){
        if (vW.y > uSurfY - 0.14) discard;
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 0.98) discard;
        float a = atan(p.y, p.x);
        float swirl = sin(a * 5.0 - r * 10.5 + uTime * 3.8) * 0.5 + 0.5;
        float swirl2 = sin(a * 3.0 + r * 7.5 - uTime * 2.5) * 0.5 + 0.5;
        float core = exp(-r * 3.8);
        vec3 col = mix(uOuter * 0.75, uMid, swirl * 0.62 * (1.0 - r * 0.45));
        col = mix(col, uInner, core * 0.72 + swirl2 * 0.18 * (1.0 - r));
        float fogF = smoothstep(uFogNear, uFogFar * 0.82, vDepth);
        col = mix(col, uFogColor, fogF);
        float mouthFade = smoothstep(0.96, 0.42, r);
        float alpha = mouthFade * (0.68 + 0.24 * core) * (1.0 - fogF * 0.85) * uVisAlpha;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
        ${GLSL_OUT}
      }`,
  });
}

// ---------------------------------------------------------------------------------- SubRenderer
const EMPTY = [];

export class SubRenderer {
  constructor(
    webglRenderer,
    {
      softDotTex = null,
      era = 'reboot',
      skinId = 'default_amphibian',
      blasterFxId = 'standard_cryo',
      showHud = true,
    } = {}
  ) {
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this._ownSoftDot = !softDotTex;
    this.starTex = makeStarTex();
    this.stoneNormalTex = makeStoneNormalTex(128);
    this.coralPorousNormalTex = makeCoralPorousNormalTex(128);
    this.width = 390;
    this.height = 620;
    this.era = era === 'original' ? 'original' : 'reboot';
    this.skinId = SKIN_MAP.has(skinId) ? skinId : 'default_amphibian';
    this.blasterFxId = blasterFxId || 'standard_cryo';
    this.showHud = showHud !== false;
    this.exposure = 1.08;
    this._kx = 1;
    this._ky = 1;
    this._disposed = false;

    const U = (this.U = {
      uTime: { value: 0 },
      uScrollW: { value: 0 },
      uFogColor: { value: new THREE.Color('#061526') },
      uFogNear: { value: CAM_Z },
      uFogFar: { value: 64 },
      uSurfY: { value: 5.7 },
      uSeabedY: { value: -6 },
      uCausticStr: { value: 0.72 },
      uCausticCol: { value: new THREE.Color('#67e8f9') },
      uBio: { value: 0.55 },
      uBioCol: { value: new THREE.Color('#5efce8') },
    });

    this.scene = new THREE.Scene();
    this.fogColor = U.uFogColor.value;
    this.scene.background = this.fogColor;
    this.scene.fog = new THREE.Fog(this.fogColor, CAM_Z, 64);

    this.camera = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 220);
    this.camera.position.set(0, 0, CAM_Z);
    this.mapCam = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 220);
    this.mapCam.position.set(0, 0, CAM_Z);

    // Preallocated scratch vectors & state (0 per-frame GC allocations)
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._v3 = new THREE.Vector3();
    this._va = new THREE.Vector3();
    this._vb = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this._colorCache = new Map();
    this._rgb = [0, 0, 0];
    this._lastStageT = 0;
    this._stageRef = null;
    this._heal = -1;
    this._healEra = '';
    this._lastTime = null;
    this._glowColor = new THREE.Color('#38bdf8');
    this._glowHex = '';
    this._towerR = -1;
    this._cine = 0;
    this._camFX = 0;
    this._camFY = 0;
    this._surfW = 5.7;
    this._seabedW = -6;

    // Hero sub spring & pose state
    this._sq = 0;
    this._sqV = 0;
    this._recoil = 0;
    this._cheer = 0;
    this._lastShots = 0;
    this._lastCatches = 0;
    this._lastHits = 0;
    this._lastVfxId = 0;
    this._wakeSwirl = 0;
    this._poseState = {
      time: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      hurtTimer: 0,
      invuln: 0,
      muzzleFlash: 0,
      victory: false,
      squashX: 1,
      squashY: 1,
    };

    // Zero-allocation `state.sub` -> `SubStage` adapter state & pools
    this._initAdapterPools();

    this.colors = {};
    for (const k in PAL_REBOOT) this.colors[k] = new THREE.Color();

    this._origFishSmall = ORIG_SMALL_FISH_HEX.map((h) => new THREE.Color(h));
    this._origFishBig = ORIG_BIG_FISH_HEX.map((h) => new THREE.Color(h));
    this._rebootFishTints = REBOOT_FISH_TINTS.map((h) => new THREE.Color(h));
    this._rebootBigTints = REBOOT_BIG_TINTS.map((h) => new THREE.Color(h));
    this._fishGold = new THREE.Color(GOLD_HEX);
    this._jellyCols = JELLY_HEX.map((h) => new THREE.Color(h));
    this._white = new THREE.Color(1, 1, 1);
    this._cryoCol = new THREE.Color('#67e8f9');
    this._sick = new THREE.Color('#3b5268');
    this._clamDead = new THREE.Color('#64748b');
    this._clamLush = new THREE.Color('#f0a8cf');

    this._buildLights();
    this._buildEnvironment();
    this._buildLayers();
    this._buildSub();
    this._buildEntities();
    this._buildTowers();
    this._buildOverlay();

    this.setSkin(this.skinId);
    this.setBlasterFx(this.blasterFxId);
    this.setEra(this.era);
    this.resize(390, 620);

    // Load all 5 `.glb` models asynchronously and hot-swap cleanly
    this._readyPromise = this._loadAllGlbAssets();
    this._precompile();
  }

  /**
   * Resolves once all submarine `.glb` models (`reboot_sub_mk7.glb`, `alien_fish_1/2.glb`,
   * `sea_mine.glb`, `warp_cavern.glb`, and `pogo.glb`) have finished loading.
   */
  whenReady() {
    return this._readyPromise;
  }

  _precompile() {
    const gl = this.gl;
    this._needsCompile = false;
    if (!gl || typeof gl.compile !== 'function') return;
    let parallel = false;
    try {
      parallel = Boolean(gl.extensions && gl.extensions.has && gl.extensions.has('KHR_parallel_shader_compile'));
    } catch {
      parallel = false;
    }
    if (parallel && typeof gl.compileAsync === 'function') {
      try {
        gl.compileAsync(this.scene, this.camera).catch(() => {});
        gl.compileAsync(this.overlay, this.oCam).catch(() => {});
      } catch {
        this._needsCompile = true;
      }
    } else {
      this._needsCompile = true;
    }
  }

  // ------------------------------------------------------------------ Public Customization Hooks
  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    const changed = this.era !== next;
    this.era = next;
    const isOrig = next === 'original';

    if (this.rebootSubGroup) this.rebootSubGroup.visible = !isOrig;
    if (this.classicSubGroup) this.classicSubGroup.visible = isOrig;
    if (this.rebootConeMesh) this.rebootConeMesh.visible = !isOrig;
    if (this.cone) this.cone.visible = isOrig;

    if (this.pogoMount) {
      if (isOrig && this.classicPilotAnchor) {
        this.classicPilotAnchor.add(this.pogoMount);
        this.pogoMount.scale.setScalar(0.55);
        this.pogoMount.rotation.set(0, Math.PI * 0.5 - 0.24, 0);
      } else if (this.rebootPilotAnchor) {
        this.rebootPilotAnchor.add(this.pogoMount);
        this.pogoMount.scale.setScalar(0.62);
        this.pogoMount.rotation.set(0, Math.PI * 0.5 - 0.22, 0);
      }
    }
    if (this.pogoRig) {
      this.pogoRig.setEraStyle(next);
      if (this.pogoRig.bones?.blaster) this.pogoRig.bones.blaster.visible = false;
      if (this.pogoRig.bones?.backpack) this.pogoRig.bones.backpack.visible = false;
    }

    if (this.classicFishMesh) this.classicFishMesh.visible = isOrig;
    if (this.classicAmbMesh) this.classicAmbMesh.visible = isOrig;
    if (this.rebootFish1Mesh) this.rebootFish1Mesh.visible = !isOrig;
    if (this.rebootFish2Mesh) this.rebootFish2Mesh.visible = !isOrig;
    if (this.rebootAmb1Mesh) this.rebootAmb1Mesh.visible = !isOrig;
    if (this.rebootAmb2Mesh) this.rebootAmb2Mesh.visible = !isOrig;

    if (this.classicMineMesh) this.classicMineMesh.visible = isOrig;
    if (this.rebootMineMesh) this.rebootMineMesh.visible = !isOrig;

    this.exposure = isOrig ? 1.12 : 1.06;
    this._redrawHudMarker();
    if (changed && this._heal >= 0) {
      this._applyHealing(this._heal);
    }
  }

  setSkin(skinId) {
    const skin = SKIN_MAP.get(skinId) || POGO_SKINS[0];
    this.skinId = skin.id;
    if (this.pogoRig) {
      this.pogoRig.setSkin(skin.id);
      if (this.pogoRig.bones?.blaster) this.pogoRig.bones.blaster.visible = false;
      if (this.pogoRig.bones?.backpack) this.pogoRig.bones.backpack.visible = false;
    }
    this._redrawHudMarker();
  }

  setBlasterFx(fxId) {
    this.blasterFxId = fxId || 'standard_cryo';
    const style = BLASTER_FX_COLORS[this.blasterFxId] || BLASTER_FX_COLORS.standard_cryo;
    if (this.torpedoMat) {
      this.torpedoMat.color.set(style.core);
      this.torpedoMat.emissive.set(style.glow);
    }
    if (this.thrusterPlumeMat) {
      this.thrusterPlumeMat.uniforms.uOuter.value.set(style.glow);
    }
    if (this.sonarWaveMat) {
      this.sonarWaveMat.uniforms.uColor.value.set(style.accent);
    }
  }

  // ------------------------------------------------------------------ Async `.glb` Integration
  async _loadAllGlbAssets() {
    const [subGlb, fish1Glb, fish2Glb, mineGlb, cavernGlb] = await Promise.all([
      loadCachedGlb('assets/models/reboot_sub_mk7.glb'),
      loadCachedGlb('assets/models/alien_fish_1.glb'),
      loadCachedGlb('assets/models/alien_fish_2.glb'),
      loadCachedGlb('assets/models/sea_mine.glb'),
      loadCachedGlb('assets/models/warp_cavern.glb'),
    ]);

    if (this._disposed) return;
    if (subGlb) this._applyRebootSubGlb(subGlb);
    if (fish1Glb) this._applyAlienFishGlb(fish1Glb, 0);
    if (fish2Glb) this._applyAlienFishGlb(fish2Glb, 1);
    if (mineGlb) this._applySeaMineGlb(mineGlb);
    if (cavernGlb) this._applyWarpCavernGlb(cavernGlb);

    // Also allow PogoRig's shared `pogo.glb` promise a short tick to settle if running in browser
    if (this.pogoRig && !this.pogoRig._glbApplied && typeof window !== 'undefined') {
      const t0 = Date.now();
      while (!this.pogoRig._glbApplied && !this._disposed && Date.now() - t0 < 1200) {
        await new Promise((r) => setTimeout(r, 25));
      }
      if (this.pogoRig.bones?.blaster) this.pogoRig.bones.blaster.visible = false;
      if (this.pogoRig.bones?.backpack) this.pogoRig.bones.backpack.visible = false;
    }
    this._precompile();
  }

  _applyRebootSubGlb(srcScene) {
    const clone = srcScene.clone(true);
    const glbGroup = new THREE.Group();
    glbGroup.name = 'RebootSubGlb';

    let seatPos = null;
    clone.traverse((o) => {
      if (o.name === 'pilot_seat') {
        seatPos = o.position.clone();
      }
      if (!o.isMesh) return;
      if (o.name === 'nose_dome') {
        o.material = this.rebootDomeMat;
        o.renderOrder = 15;
        return;
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const nextMats = mats.map((m, idx) => {
        if (!m) return m;
        const mc = m.clone();
        const mName = mc.name || `${o.name}_${idx}`;
        const emLum = mc.emissive ? Math.max(mc.emissive.r, mc.emissive.g, mc.emissive.b) * (mc.emissiveIntensity || 0) : 0;
        if (emLum > 0.8) {
          return mc;
        }
        patchStd(mc, this.U, {
          rim: { color: new THREE.Color('#93c5fd'), str: this.hullRim },
          caustic: 0.95,
          selfLit: this.subLit,
          key: `rsub_${mName}`,
        });
        this.rebootFlashMats.push(mc);
        return mc;
      });
      o.material = Array.isArray(o.material) ? nextMats : nextMats[0];
    });

    glbGroup.add(clone);
    this.rebootSubGroup.add(glbGroup);
    this.rebootGlbHull = glbGroup;
    if (this.rebootProceduralHull) {
      this.rebootProceduralHull.visible = false;
    }
    if (seatPos && this.rebootPilotAnchor) {
      this.rebootPilotAnchor.position.copy(seatPos);
    }
  }

  _applyAlienFishGlb(srcScene, speciesIdx) {
    const baked = bakeGlbForInstancing(srcScene, {
      scale: speciesIdx === 0 ? 1.75 : 1.72,
      tailStartX: speciesIdx === 0 ? 0.28 : 0.3,
    });
    if (!baked) return;

    const uWrap = speciesIdx === 0 ? this._fish1MapWrap : this._fish2MapWrap;
    if (baked.map) {
      uWrap.map.value = baked.map;
      uWrap.enabled.value = 1;
    }

    const gpMesh = speciesIdx === 0 ? this.rebootFish1Mesh : this.rebootFish2Mesh;

    const replaceInstGeo = (instMesh, templateGeo, maxCount) => {
      const nextGeo = templateGeo.clone();
      nextGeo.setAttribute('aGlow', instMesh.geometry.attributes.aGlow);
      nextGeo.setAttribute('aAnim', instMesh.geometry.attributes.aAnim);
      const oldGeo = instMesh.geometry;
      instMesh.geometry = nextGeo;
      oldGeo.dispose();
      instMesh.count = Math.min(instMesh.count, maxCount);
    };

    // Foreground gameplay fish use full `.glb` sculpts; 124 distant background boids keep streamlined low-LOD school mesh (<120k tri budget)
    replaceInstGeo(gpMesh, baked.geo, MAX_FISH);
    baked.geo.dispose();
  }

  _applySeaMineGlb(srcScene) {
    // Trim hanging chain links below y = -0.46 so floating mines look clean and anchored mines
    // connect seamlessly into our animated 260-link swaying chain!
    const baked = bakeGlbForInstancing(srcScene, { scale: 2.75, minY: -0.46 });
    if (!baked) return;
    if (baked.map) {
      this._mineMapWrap.map.value = baked.map;
      this._mineMapWrap.enabled.value = 1;
    }
    if (baked.normalMap) {
      this.rebootMineMat.normalMap = baked.normalMap;
      this.rebootMineMat.normalScale.set(0.65, 0.65);
      this.rebootMineMat.needsUpdate = true;
    }
    const oldGeo = this.rebootMineMesh.geometry;
    this.rebootMineMesh.geometry = baked.geo;
    oldGeo.dispose();
  }

  _applyWarpCavernGlb(srcScene) {
    const clone = srcScene.clone(true);
    clone.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      if (o.name === 'portal_throat') {
        o.visible = false; // Replaced by our animated swirling GLSL `warpPortalDisc`!
        return;
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map((m, idx) => {
        if (!m) return m;
        const mc = m.clone();
        mc.side = THREE.DoubleSide;
        const emLum = mc.emissive ? Math.max(mc.emissive.r, mc.emissive.g, mc.emissive.b) * (mc.emissiveIntensity || 0) : 0;
        if (emLum >= 0.8) {
          // Shift amethyst crystal tint to deep abyssal sapphire-cyan so cavern harmonizes with Moonlit Storm sea
          if (mc.color && mc.color.r > mc.color.g) {
            mc.color.set('#0369a1');
            mc.emissive.set('#38bdf8');
            mc.emissiveIntensity = 1.15;
          } else {
            mc.emissiveIntensity = Math.min(mc.emissiveIntensity || 1.2, 1.35);
          }
          patchStd(mc, this.U, { clip: true, key: `wcav_crys_${o.name}_${idx}` });
        } else {
          mc.color.set('#0f1c2e');
          mc.roughness = 0.38;
          mc.metalness = 0.16;
          patchStd(mc, this.U, {
            clip: true,
            caustic: 0.85,
            rim: { color: new THREE.Color('#38bdf8'), str: { value: 0.34 } },
            key: `wcav_${o.name}_${idx}`,
          });
        }
        return mc;
      });
      if (!Array.isArray(o.material) && o.material.length === 1) {
        o.material = o.material[0];
      }
    });
    this.warpCavernGlb = clone;
    this.warpCavernGroup.add(clone);
  }

  // ------------------------------------------------------------------ Coordinate Mapping
  _toWorld(px, py, z, out) {
    const cam = this.mapCam;
    out.set(((px * this._kx) / this.width) * 2 - 1, 1 - ((py * this._ky) / this.height) * 2, 0.5).unproject(cam);
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

  resize(width, height) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
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
      for (const it of layer.items) it.span = 2 * this._halfW(it.z) + layer.margin;
    }
    const sw = 2 * this._halfW(-16) + 6;
    this.snowMat.uniforms.uSpan.value = sw;
    for (const m of [this.vignette, this.waterline]) {
      m.scale.set(width, height, 1);
      m.position.set(width / 2, -height / 2, -5);
    }
    this.waterMat.uniforms.uSize.value.set(width, height);
    this._hudDrawn = null;
    this._cardForW = 0;
  }

  // ------------------------------------------------------------------ Zero-Allocation `state.sub` Adapter
  _initAdapterPools() {
    this._adaptFishPool = Array.from({ length: MAX_FISH }, () => ({
      type: 'small',
      species: 0,
      isGear: false,
      isSonarCache: false,
      x: 0,
      y: 0,
      vy: 0,
      r: 10,
      color: 0,
      customHex: '',
      state: 'swim',
      bubbleT: 0,
      bubbleR: 18,
      dir: -1,
      seed: 0,
    }));
    this._adaptMinePool = Array.from({ length: MAX_MINE }, () => ({
      x: 0,
      y: 0,
      r: 16,
      kind: 'anchored',
      phase: 0,
      blink: 0,
      spin: 0,
      frozenTimer: 0,
    }));
    this._adaptBubblePool = Array.from({ length: MAX_TORP }, () => ({
      x: 0,
      y: 0,
      vx: 300,
      r: 8,
      age: 0.2,
      seed: 0,
      isTorpedo: true,
    }));
    this._adaptRingPool = Array.from({ length: MAX_RING }, () => ({
      x: 0,
      y: 0,
      r0: 10,
      r1: 120,
      color: '#5efce8',
      life: 0.5,
      maxLife: 0.8,
      flat: false,
    }));

    this._fishTrack = new WeakMap();
    this._bubbleTrack = new WeakSet();
    this._adaptedSub = {
      x: 120,
      y: 240,
      vx: 0,
      vy: 0,
      rx: 34,
      ry: 19,
      stun: 0,
      stunMax: 1,
      invuln: 0,
      spin: 0,
      surfaced: 0,
      prop: 1,
      ax: 0,
      ay: 0,
      shots: 0,
      catches: 0,
    };
    this._adaptedTower = { active: false, x: 0, r: 100, targetX: 0, glow: '#38bdf8', name: 'WATCHTOWER' };
    this._adaptedStage = {
      width: 390,
      height: 620,
      s: 1,
      t: 0,
      phase: 'ride',
      arriveT: 0,
      progress: 0,
      healing: 0.45,
      scroll: 0,
      scrollSpeed: 96,
      surfaceY: 64,
      seabedY: 560,
      sub: this._adaptedSub,
      fish: [],
      jellies: EMPTY,
      mines: [],
      clams: EMPTY,
      bubbles: [],
      rings: [],
      vfx: EMPTY,
      vents: EMPTY,
      warpCave: null,
      sonarPulse: 0,
      sonarOriginX: 0,
      sonarOriginY: 0,
      tower: this._adaptedTower,
      fishCaught: 0,
      pearls: 0,
      jelliesPopped: 0,
      nearMisses: 0,
      bonus: 0,
      hits: 0,
      mult: 1,
      comboTimer: 0,
      comboTimerMax: 2.4,
      comboPulseT: -10,
      nextGlow: '#38bdf8',
      perfect: false,
    };
    this._adaptScroll = 0;
    this._adaptLastTimer = -1;
    this._adaptLastCaught = 0;
  }

  _resolveRenderArgs(input, opts = {}) {
    if (!input) return null;

    // Sync era / skin / blasterFx if supplied in `opts` or `input`
    const reqEra = opts.era || input.era || (input.original === true ? 'original' : null);
    if (reqEra && (reqEra === 'original' || reqEra === 'reboot') && reqEra !== this.era) {
      this.setEra(reqEra);
    }
    const reqSkin = opts.skinId || input.skinId || input.player?.skinId;
    if (reqSkin && reqSkin !== this.skinId) {
      this.setSkin(reqSkin);
    }
    const reqFx = opts.blasterFxId || input.blasterFxId || input.player?.blasterFxId;
    if (reqFx && reqFx !== this.blasterFxId) {
      this.setBlasterFx(reqFx);
    }

    // Case 1: Full game / RenderState wrapper containing `subStage`
    if (input.subStage && typeof input.subStage === 'object') {
      return {
        stage: input.subStage,
        time: opts.time ?? input.time ?? 0,
        particles: opts.particles ?? input.particles ?? null,
        popups: opts.popups ?? input.popups ?? null,
        shake: opts.shake ?? input.shake ?? 0,
      };
    }

    // Case 2: Direct `SubStage` instance (`has phase` & `input.sub` object)
    if (input.sub && typeof input.sub === 'object' && ('phase' in input || 'rideT' in input)) {
      return {
        stage: input,
        time: opts.time ?? input.t ?? 0,
        particles: opts.particles ?? null,
        popups: opts.popups ?? null,
        shake: opts.shake ?? 0,
      };
    }

    // Case 3: `game.js`'s `state.sub` (either passed directly or via `state.sub`)
    const rawSub = input.sub && typeof input.sub.x === 'number' ? input.sub : input;
    if (typeof rawSub.x !== 'number') return null;

    const time = opts.time ?? input.time ?? rawSub.timer ?? 0;
    const dt = this._lastAdaptTime == null ? 1 / 60 : clamp(time - this._lastAdaptTime, 0, 0.05);
    this._lastAdaptTime = time;

    const W = this.width || 390;
    const H = this.height || 620;
    const s = clamp(Math.sqrt((W * H) / (390 * 620)), 0.8, 1.6);
    const st = this._adaptedStage;
    const asub = this._adaptedSub;

    const timer = Number(rawSub.timer) || 0;
    const duration = Math.max(1, Number(rawSub.duration) || 16);
    if (timer < this._adaptLastTimer - 0.5) {
      this._adaptScroll = 0;
      this._adaptLastCaught = 0;
      asub.shots = 0;
      asub.catches = 0;
    }
    this._adaptLastTimer = timer;

    const boostMult = (rawSub.ventBoostTimer || 0) > 0 ? 1.3 : 1.0;
    const scrollSpd = 96 * s * boostMult;
    this._adaptScroll += scrollSpd * dt;

    st.width = W;
    st.height = H;
    st.s = s;
    st.t = timer;
    st.progress = clamp(timer / duration, 0, 1);
    st.healing = this.era === 'original' ? 0.85 : 0.45 + st.progress * 0.35;
    st.scroll = this._adaptScroll;
    st.scrollSpeed = scrollSpd;
    st.surfaceY = H * 0.095;
    st.seabedY = H * 0.905;
    let spVal = 0;
    if (typeof rawSub.sonarPulse === 'number') {
      spVal = rawSub.sonarPulse;
    } else if (rawSub.sonarPulse && typeof rawSub.sonarPulse === 'object') {
      const maxR = Math.max(1, Number(rawSub.sonarPulse.maxR) || 500);
      spVal = clamp(1 - (Number(rawSub.sonarPulse.r) || 0) / maxR, 0, 1);
    }
    st.sonarPulse = spVal;
    st.sonarOriginX = rawSub.sonarOriginX ?? rawSub.sonarPulse?.x ?? rawSub.x;
    st.sonarOriginY = rawSub.sonarOriginY ?? rawSub.sonarPulse?.y ?? rawSub.y;
    st.vents = rawSub.vents || EMPTY;
    st.warpCave = rawSub.warpCave || null;
    st.fishCaught = rawSub.fishCaughtCount || 0;
    st.bonus = (rawSub.fishCaughtCount || 0) * (this.era === 'original' ? 50 : 250) + (rawSub.minesDestroyed || 0) * 150;

    if (st.fishCaught > this._adaptLastCaught) {
      asub.catches += st.fishCaught - this._adaptLastCaught;
    }
    this._adaptLastCaught = st.fishCaught;

    // Next watchtower glides into view during the closing stretch of the transit
    const tw = this._adaptedTower;
    const remSec = duration - timer;
    tw.r = clamp(W * 0.28, 70 * s, 185 * s);
    tw.targetX = W - tw.r * 0.62;
    if (remSec < 3.4) {
      tw.active = true;
      const slideK = smooth01((3.4 - remSec) / 3.2);
      tw.x = lerp(W + tw.r * 1.5, tw.targetX, slideK);
    } else {
      tw.active = false;
      tw.x = W + tw.r * 1.5;
    }

    const pvx = asub.vx;
    const pvy = asub.vy;
    asub.x = rawSub.x;
    asub.y = rawSub.y;
    asub.vx = rawSub.vx || 0;
    asub.vy = rawSub.vy || 0;
    asub.rx = 34 * s;
    asub.ry = 19 * s;
    if (dt > 0) {
      const k = 1 - Math.exp(-10 * dt);
      asub.ax += (clamp((asub.vx - pvx) / dt, -4000, 4000) - asub.ax) * k;
      asub.ay += (clamp((asub.vy - pvy) / dt, -4000, 4000) - asub.ay) * k;
    }
    asub.prop = 0.85 + clamp(asub.vx / 240, -0.35, 0.65) + ((rawSub.ventBoostTimer || 0) > 0 ? 0.35 : 0);

    // Map fish (zero allocations)
    const srcFish = rawSub.fish || EMPTY;
    st.fish.length = 0;
    for (let i = 0; i < srcFish.length && st.fish.length < MAX_FISH; i++) {
      const sf = srcFish[i];
      if (!sf || sf.caught) continue;
      let tr = this._fishTrack.get(sf);
      if (!tr) {
        tr = { seed: (i * 1.61803) % TAU, bubbleT: 0 };
        this._fishTrack.set(sf, tr);
      }
      if (sf.bubbled) tr.bubbleT += dt;
      else tr.bubbleT = 0;

      const df = this._adaptFishPool[st.fish.length];
      df.isGear = Boolean(sf.isGear);
      df.isSonarCache = Boolean(sf.isSonarCache);
      df.type = sf.isGear ? 'gold' : 'small';
      df.species = (sf.species ?? sf.modelIdx ?? i) & 1;
      df.x = sf.x;
      df.y = sf.y;
      df.vy = 0;
      df.r = (sf.isGear ? 12 : 10.5) * s;
      df.color = i % 5;
      df.customHex = sf.color || '';
      df.state = sf.bubbled ? 'bubbled' : 'swim';
      df.bubbleT = sf.bubbled ? Math.max(0.02, tr.bubbleT) : 0;
      df.bubbleR = (sf.isGear ? 21 : 19) * s;
      df.dir = (sf.vx || -1) > 0 ? 1 : -1;
      df.seed = tr.seed;
      st.fish.push(df);
    }

    // Map mines (zero allocations)
    const srcMines = rawSub.mines || EMPTY;
    st.mines.length = 0;
    for (let i = 0; i < srcMines.length && st.mines.length < MAX_MINE; i++) {
      const sm = srcMines[i];
      if (!sm || (sm.hp !== undefined && sm.hp <= 0)) continue;
      const dm = this._adaptMinePool[st.mines.length];
      dm.x = sm.x;
      dm.y = sm.y;
      dm.r = 16.5 * s;
      dm.kind = sm.y < H * 0.36 ? 'float' : 'anchored';
      dm.phase = sm.phase || 0;
      dm.blink = (time * 1.6 + (sm.phase || 0)) % 1;
      dm.spin = time * 0.6 + (sm.phase || 0);
      dm.frozenTimer = sm.frozenTimer || 0;
      st.mines.push(dm);
    }

    // Map bubbles / Cryo-Torpedoes (zero allocations)
    const srcBub = rawSub.bubbles || EMPTY;
    st.bubbles.length = 0;
    for (let i = 0; i < srcBub.length && st.bubbles.length < MAX_TORP; i++) {
      const sb = srcBub[i];
      if (!sb) continue;
      if (!this._bubbleTrack.has(sb)) {
        this._bubbleTrack.add(sb);
        asub.shots++;
      }
      const db = this._adaptBubblePool[st.bubbles.length];
      db.x = sb.x;
      db.y = sb.y;
      db.vx = sb.vx || 320;
      db.r = 8.2 * s;
      db.age = 0.25 + ((time * 2 + i * 0.3) % 1);
      db.seed = i * 1.3;
      db.isTorpedo = sb.isTorpedo !== undefined ? Boolean(sb.isTorpedo) : this.era !== 'original';
      st.bubbles.push(db);
    }

    // Map shockwave rings
    const srcSw = rawSub.shockwaves || EMPTY;
    st.rings.length = 0;
    for (let i = 0; i < srcSw.length && st.rings.length < MAX_RING; i++) {
      const sw = srcSw[i];
      if (!sw || sw.life <= 0) continue;
      const dr = this._adaptRingPool[st.rings.length];
      dr.x = sw.x;
      dr.y = sw.y;
      dr.r0 = 12 * s;
      dr.r1 = (sw.maxR || 120) * 0.45;
      dr.color = sw.color || '#5efce8';
      dr.life = sw.life;
      dr.maxLife = sw.maxLife || 0.85;
      dr.flat = false;
      st.rings.push(dr);
    }

    return {
      stage: st,
      time,
      particles: opts.particles ?? input.particles ?? null,
      popups: opts.popups ?? input.popups ?? null,
      shake: opts.shake ?? input.shake ?? 0,
    };
  }

  // ------------------------------------------------------------------ Build: Lights & Environment
  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#7dd3fc', '#081224', 1.65);
    this.sun = new THREE.DirectionalLight('#cfe4ff', 2.0);
    this.sun.position.set(-3, 12, 7);
    this.back = new THREE.DirectionalLight('#5efce8', 0.95);
    this.back.position.set(5, 3, -8);
    this.scene.add(this.hemi, this.sun, this.back);
  }

  _buildEnvironment() {
    const U = this.U;

    // Backdrop: deep #040d1e..#091e3a bioluminescent abyssal trench & canyon vista below waterline,
    // plus dramaticridged storm clouds, cratered moon & archipelago silhouettes above waterline (arrival shot)
    const bdGeo = new THREE.PlaneGeometry(700, 320);
    this.backdropMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uSurfY: U.uSurfY,
        uSeabedY: U.uSeabedY,
        uFogColor: U.uFogColor,
        uSkyTop: { value: new THREE.Color() },
        uSkyHor: { value: new THREE.Color() },
        uSunCol: { value: new THREE.Color() },
        uHeal: { value: 1 },
        uMoonMode: { value: 1 },
      },
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform float uSurfY; uniform float uSeabedY; uniform vec3 uFogColor;
        uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunCol; uniform float uHeal; uniform float uMoonMode;
        varying vec3 vW;
        ${GLSL_NOISE}
        float ridgeN(vec2 p){
          float a = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
          float b = 1.0 - abs(vnoise(p * 2.17 + 4.3) * 2.0 - 1.0);
          float c = 1.0 - abs(vnoise(p * 4.61 - 2.1) * 2.0 - 1.0);
          return a * 0.56 + b * 0.30 + c * 0.14;
        }
        void main(){
          float hy = vW.y - uSurfY;
          if (hy < 0.0) {
            if (uMoonMode < 0.5) {
              gl_FragColor = vec4(uFogColor, 1.0);
              ${GLSL_OUT}
              return;
            }
            // Deep #040d1e..#091e3a bioluminescent abyssal haze + multi-layer distant trench wall silhouettes
            float spanY = max(uSurfY - uSeabedY, 4.0);
            float depth01 = clamp(-hy / (spanY * 4.2), 0.0, 1.0);
            vec3 upperAbyss = vec3(0.008, 0.028, 0.068); // ~ #091e3a linear
            vec3 midAbyss   = vec3(0.003, 0.012, 0.030); // ~ #040d1e linear
            vec3 deepTrench = vec3(0.0015, 0.005, 0.015);
            vec3 col = mix(upperAbyss, midAbyss, smoothstep(0.0, 0.52, depth01));
            col = mix(col, deepTrench, smoothstep(0.48, 1.0, depth01));
            col = mix(col, uFogColor, 0.38);

            // Farthermost parallax abyssal canyon ridge & submerged sea-arch silhouettes in the deep mist
            float pxFar = vW.x * 0.038 + uScrollW * 0.045;
            float cliffFar = ridgeN(vec2(pxFar, 1.7)) * 18.0 + vnoise(vec2(pxFar * 2.4, 5.1)) * 5.5 - 24.0;
            float farMask = smoothstep(cliffFar + 1.2, cliffFar - 1.2, hy);
            col = mix(col, vec3(0.0025, 0.009, 0.024), farMask * 0.62);

            float pxMid = vW.x * 0.055 + uScrollW * 0.085 + 11.3;
            float cliffMid = ridgeN(vec2(pxMid, 3.9)) * 15.0 - 22.5;
            // Carve occasional submerged natural stone arch openings in the distant ridge
            float archCell = fract(pxMid * 0.28);
            float archOpen = smoothstep(0.22, 0.12, abs(archCell - 0.5)) * smoothstep(-24.0, -16.0, hy) * smoothstep(-10.0, -14.5, hy);
            float midMask = clamp(smoothstep(cliffMid + 0.9, cliffMid - 0.9, hy) - archOpen * 0.85, 0.0, 1.0);
            col = mix(col, vec3(0.0018, 0.0065, 0.018), midMask * 0.72);

            // Subtle drifting bioluminescent cyan-teal abyssal current wisps
            float bioMist = ridgeN(vec2(vW.x * 0.026 + uScrollW * 0.03 - uTime * 0.012, hy * 0.055 + uTime * 0.008));
            col += vec3(0.004, 0.026, 0.042) * pow(bioMist, 3.0) * (1.0 - depth01 * 0.55);

            gl_FragColor = vec4(col, 1.0);
            ${GLSL_OUT}
            return;
          }
          float e = clamp(hy / 42.0, 0.0, 1.0);
          vec3 col = mix(uSkyHor, uSkyTop, pow(e, 0.68));
          vec2 sunCenter = vec2(uMoonMode > 0.5 ? 16.0 : -17.0, uSurfY + 9.6);
          vec2 md = vW.xy - sunCenter;
          float d = length(md);
          if (uMoonMode > 0.5) {
            // Crisp cratered lunar Mare relief + delicate wispy cloud filaments (zero black cutout!)
            vec2 mUv = md / 2.65;
            float mare = vnoise(mUv * 2.4 + 3.1) * 0.55 + vnoise(mUv * 5.8 - 1.7) * 0.30 + ridgeN(mUv * 9.0) * 0.15;
            float limb = sqrt(clamp(1.0 - dot(mUv, mUv), 0.0, 1.0));
            float disc = smoothstep(2.72, 2.54, d);
            vec3 moonSurf = uSunCol * (0.72 + 0.36 * limb - 0.28 * smoothstep(0.42, 0.78, mare));
            col = mix(col, moonSurf, disc * 0.96);
            col += uSunCol * (exp(-d * 0.34) * 0.30 + exp(-d * 0.08) * 0.12);
          } else {
            col += uSunCol * (smoothstep(3.2, 2.6, d) * 1.4 + exp(-d * 0.22) * 0.55 + exp(-d * 0.05) * 0.25);
          }
          // Multi-octave ridged cumulonimbus storm clouds + wispy filaments
          vec2 cp = vec2(vW.x * 0.032 + uTime * 0.005, hy * 0.095);
          float cl = ridgeN(cp * vec2(1.1, 2.2)) * 0.64 + vnoise(cp * vec2(3.4, 6.8) + 2.7) * 0.36;
          float clMask = smoothstep(0.46, 0.84, cl) * smoothstep(0.02, 0.14, e) * (1.0 - smoothstep(0.52, 0.92, e));
          vec3 cloudBelly = uSkyTop * 0.75;
          vec3 cloudRim = uMoonMode > 0.5
            ? mix(uSkyHor * 1.25, uSunCol * 0.78, smoothstep(20.0, 3.2, d) * 0.62 + 0.14)
            : mix(uSkyHor * 0.8, vec3(1.0, 0.98, 0.95), 0.35 + 0.4 * uHeal);
          vec3 cloudCol = mix(cloudBelly, cloudRim, smoothstep(0.52, 0.86, cl));
          // Delicate translucent wisps across the moon (never opaque black!)
          float moonGuard = uMoonMode > 0.5 ? mix(0.68, 0.24, smoothstep(3.4, 1.8, d)) : 0.62;
          col = mix(col, cloudCol, clMask * moonGuard);

          // Distant craggy coastal sea-stacks & sister Watchtowers shrouded in horizon sea-mist
          float stackH = ridgeN(vec2(vW.x * 0.075 + 2.3, 0.8)) * 5.8 - 1.4;
          float stackMask = smoothstep(stackH + 0.18, stackH - 0.18, hy) * step(0.0, stackH);
          float tw = 0.0;
          for (int k = 0; k < 4; k++) {
            float fk = float(k);
            float cx = -41.0 + fk * 23.0 + sin(fk * 7.3) * 4.0;
            float h = 5.0 + fract(fk * 0.71 + 0.2) * 6.0;
            float w = (0.75 + fract(fk * 0.37) * 0.5) * (1.0 - 0.25 * clamp(hy / h, 0.0, 1.0));
            float dx = abs(vW.x - cx);
            float inX = smoothstep(w + 0.12, w - 0.12, dx);
            float cren = step(0.5, fract((vW.x - cx) * 2.2)) * 0.45;
            float top = h + cren * step(dx, w);
            float inY = smoothstep(top + 0.1, top - 0.1, hy);
            float spire = smoothstep(0.16, 0.0, dx) * smoothstep(h + 2.2, h + 1.9, hy) * step(h, hy);
            tw = max(tw, max(inX * inY, spire));
            float tip = exp(-length(vec2(vW.x - cx, hy - h - 2.2)) * 2.0) * (0.55 + 0.45 * sin(uTime * 2.0 + fk * 1.7));
            col += (uMoonMode > 0.5 ? vec3(1.0, 0.68, 0.22) : vec3(1.0, 0.3, 0.25)) * tip * 0.65;
          }
          float sil = max(tw, stackMask * 0.85);
          col = mix(col, uSkyTop * 0.55 + uSkyHor * 0.22, sil * 0.78);
          col = mix(col, uSkyHor * 0.92, exp(-hy * 0.42) * 0.58);
          gl_FragColor = vec4(col, 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.backdrop = new THREE.Mesh(bdGeo, this.backdropMat);
    this.backdrop.position.z = BACKDROP_Z;
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -10;
    this.scene.add(this.backdrop);

    // Seabed with sculpted dunes + animated caustics + bioluminescent plankton specks
    const bedGeo = new THREE.PlaneGeometry(240, 110, 64, 24);
    bedGeo.rotateX(-Math.PI / 2);
    bedGeo.translate(0, 0, -45);
    this.bedMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uFogColor: U.uFogColor,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uBio: U.uBio,
        uBioCol: U.uBioCol,
        uSandA: { value: new THREE.Color() },
        uSandB: { value: new THREE.Color() },
        uCausticColor: { value: new THREE.Color() },
        uCaustic: { value: 1 },
        uToxic: { value: new THREE.Color() },
        uToxicAmt: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float uScrollW;
        varying vec3 vW; varying vec3 vN; varying float vDepth;
        float dune(vec2 p){ return sin(p.x*0.33)*0.35 + sin(p.x*0.81 + p.y*0.47)*0.18 + sin(p.x*1.9 - p.y*1.3)*0.05; }
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          float t = clamp((1.5 - w.z) / 7.5, 0.0, 1.0);
          float amp = mix(0.12, 1.0, t*t*(3.0-2.0*t));
          vec2 q = vec2(w.x + uScrollW, w.z);
          float h = dune(q) * amp;
          float e = 0.2;
          float hx = dune(q + vec2(e, 0.0)) * amp;
          float hz = dune(q + vec2(0.0, e)) * amp;
          w.y += h;
          vN = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
          vW = vec3(q.x, w.y, w.z);
          vec4 mv = viewMatrix * w;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uSandA; uniform vec3 uSandB; uniform vec3 uCausticColor; uniform float uCaustic;
        uniform vec3 uToxic; uniform float uToxicAmt; uniform float uBio; uniform vec3 uBioCol;
        ${GLSL_FOG_PARS}
        varying vec3 vW; varying vec3 vN; varying float vDepth;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vW.xz;
          float n = vnoise(p * 0.35) * 0.6 + vnoise(p * 1.7) * 0.3 + vnoise(p * 9.0) * 0.1;
          vec3 col = mix(uSandA, uSandB, n);
          float ripple = sin(p.x * 4.5 + sin(p.y * 2.0) * 1.5 + n * 4.0) * 0.5 + 0.5;
          col *= 0.88 + ripple * 0.18;
          float lam = clamp(dot(vN, normalize(vec3(-0.3, 1.0, 0.45))), 0.0, 1.0);
          col *= 0.52 + 0.62 * lam;
          float c = caustic(p * 0.16, uTime * 0.5) * 0.72 + caustic(p * 0.31 + 3.1, uTime * 0.62) * 0.48;
          col += uCausticColor * c * uCaustic * (0.58 + 0.42 * lam);
          float tn = vnoise(p * 0.22 + 7.3) * 0.7 + vnoise(p * 0.9 + 2.0) * 0.3;
          float tox = smoothstep(0.62, 0.78, tn) * uToxicAmt;
          col = mix(col, uToxic * 0.18, tox * 0.65);
          col += uToxic * tox * (0.09 + 0.06 * sin(uTime * 2.0 + p.x * 0.7));
          vec2 g = p * vec2(4.0, 5.0);
          vec2 gi = floor(g);
          float hs = hash12(gi);
          float spk = step(0.9, hs) * smoothstep(0.3, 0.05, length(fract(g) - 0.5));
          col += uBioCol * spk * uBio * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.2 + hs * 3.0) + hs * 40.0))) * 1.35;
          float f = smoothstep(uFogNear, uFogFar, vDepth);
          gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.seabed = new THREE.Mesh(bedGeo, this.bedMat);
    this.seabed.frustumCulled = false;
    this.scene.add(this.seabed);

    // Water surface seen from below: moody midnight-cyan (#06162c) Snell's-window + crisp silver-cyan wave caustics!
    const surfGeo = new THREE.PlaneGeometry(300, 156, 1, 1);
    surfGeo.rotateX(Math.PI / 2);
    surfGeo.translate(0, 0, -52);
    this.surfMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uFogColor: U.uFogColor,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uSurf: { value: new THREE.Color() },
        uSurfHi: { value: new THREE.Color() },
        uDeep: { value: new THREE.Color() },
        uSunCol: { value: new THREE.Color() },
        uAlpha: { value: 1 },
        uIsOrig: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vW; varying float vDepth;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vec4 mv = viewMatrix * w;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform vec3 uSurf; uniform vec3 uSurfHi; uniform vec3 uDeep;
        uniform vec3 uSunCol; uniform float uAlpha; uniform float uIsOrig;
        ${GLSL_FOG_PARS}
        varying vec3 vW; varying float vDepth;
        ${GLSL_NOISE}
        void main(){
          vec3 V = normalize(vW - cameraPosition);
          vec2 p = vec2(vW.x + uScrollW * 0.35, vW.z);
          float n1 = vnoise(p * 0.52 + vec2(uTime * 0.22, uTime * 0.07));
          float n2 = vnoise(p * 1.65 - vec2(uTime * 0.31, -uTime * 0.17));
          float wav = n1 * 0.62 + n2 * 0.38;
          float up = clamp(V.y, 0.0, 1.0);
          if (uIsOrig > 0.5) {
            float win = smoothstep(0.04, 0.4, up + (wav - 0.5) * 0.2);
            float c = caustic(p * 0.075, uTime * 0.35);
            float sun = pow(max(dot(V, normalize(vec3(-0.25, 0.6, -0.76))), 0.0), 14.0);
            float shatter = smoothstep(0.35, 0.75, wav + c * 0.6);
            vec3 col = mix(uDeep, uSurf, win) * (0.8 + 0.36 * wav);
            col += uSurfHi * c * (0.75 + 1.1 * win);
            col += uSunCol * sun * (0.35 + 1.1 * shatter);
            float f = smoothstep(uFogNear * 0.55, uFogFar * 0.9, vDepth);
            col = mix(col, uFogColor, f);
            gl_FragColor = vec4(col, uAlpha);
            ${GLSL_OUT}
            return;
          }
          // Reboot Mode: Moody midnight-cyan (#06162c) Snell's-window + razor-crisp silver-cyan wave caustics
          // (zero milky grey-white washout across the top 35% of the screen!)
          float ridge = 1.0 - abs(vnoise(p * 0.38 + vec2(uTime * 0.16, -uTime * 0.09)) * 2.0 - 1.0);
          float win = smoothstep(0.06, 0.46, up + (wav - 0.5) * 0.16);
          float c1 = caustic(p * 0.095, uTime * 0.40);
          float c2 = caustic(p * 0.21 + 3.7, -uTime * 0.32);
          float cCrisp = pow(clamp(c1 * 0.72 + c2 * 0.54, 0.0, 1.0), 1.38);
          float ridgeLace = smoothstep(0.62, 0.94, ridge) * (0.35 + 0.65 * n2);

          // Dark abyssal total-internal-reflection rim (#020712) -> moody #06162c Snell's window
          vec3 col = mix(uDeep, uSurf, win * 0.92) * (0.62 + 0.52 * wav);
          // Crisp silver-cyan caustic web & wave-crest refraction lines
          vec3 causticTint = mix(uSurfHi * 0.65, vec3(0.72, 0.95, 1.0), cCrisp * 0.55);
          col += causticTint * (cCrisp * (0.38 + 0.64 * win) + ridgeLace * 0.14 * win);
          // Focused Snell's-window lunar shimmer (tight exponent prevents milky sky washout)
          float moonSpec = pow(max(dot(V, normalize(vec3(-0.22, 0.66, -0.72))), 0.0), 62.0);
          col += min(uSunCol * moonSpec * (0.20 + 0.85 * cCrisp), vec3(0.28, 0.42, 0.52));

          float f = smoothstep(uFogNear * 0.62, uFogFar * 0.96, vDepth);
          col = mix(col, uFogColor, f);
          gl_FragColor = vec4(col, uAlpha);
          ${GLSL_OUT}
        }`,
    });
    this.surface = new THREE.Mesh(surfGeo, this.surfMat);
    this.surface.frustumCulled = false;
    this.surface.renderOrder = 5;
    this.scene.add(this.surface);

    // Volumetric swaying moon/sun shafts (focused diagonal silver-cyan beams without upper-ceiling haze washout)
    const rayGeo = new THREE.PlaneGeometry(1, 1);
    rayGeo.translate(0, -0.5, 0);
    this.rayMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uSurfY: U.uSurfY,
        uColor: { value: new THREE.Color() },
        uStr: { value: 0.34 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv; varying float vPh; varying float vDepth; varying float vWy;
        void main(){
          vUv = uv;
          vPh = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 1.3;
          vec4 w = modelMatrix * (instanceMatrix * vec4(position, 1.0));
          float k = -position.y;
          w.x += (sin(uTime * 0.42 + vPh * 2.0) * 0.9 + sin(uTime * 0.27 + vPh) * 0.5) * k;
          vWy = w.y;
          vec4 mv = viewMatrix * w;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; uniform float uStr; uniform float uFogNear; uniform float uFogFar; uniform float uSurfY;
        varying vec2 vUv; varying float vPh; varying float vDepth; varying float vWy;
        ${GLSL_NOISE}
        void main(){
          if (vWy > uSurfY) discard;
          float s = sin(vUv.x * 3.14159);
          float softEdge = pow(s, 3.2);
          float coreEdge = pow(s, 9.0);
          float len = pow(vUv.y, 1.25) * smoothstep(1.0, 0.78, vUv.y) * smoothstep(2.6, 10.5, vDepth);
          // Live wave-lens caustic focusing along each shaft
          float lens = pow(0.5 + 0.5 * sin(vUv.x * 9.5 + vPh * 4.2 + uTime * 1.45) * cos(vUv.x * 5.2 - uTime * 0.95 + vPh), 1.6);
          float streak = 0.42 + 0.85 * vnoise(vec2(vUv.x * 6.5 + vPh * 7.0, vUv.y * 1.6 - uTime * 0.09));
          float flick = 0.66 + 0.34 * sin(uTime * 0.85 + vPh * 3.0) * sin(uTime * 1.35 + vPh);
          float fogAtten = 1.0 - smoothstep(uFogNear, uFogFar * 1.15, vDepth) * 0.72;
          float a = (softEdge * 0.58 + coreEdge * 0.72 * (0.45 + 0.85 * lens)) * len * streak * flick * uStr * fogAtten;
          vec3 col = mix(uColor, vec3(0.82, 0.97, 1.0), coreEdge * lens * 0.55);
          gl_FragColor = vec4(col, clamp(a, 0.0, 0.85));
          #include <colorspace_fragment>
        }`,
    });
    const rng = mulberry32(77);
    const NR = 20;
    this.rays = new THREE.InstancedMesh(rayGeo, this.rayMat, NR);
    this.rays.frustumCulled = false;
    this.rays.renderOrder = 6;
    this.rayItems = [];
    for (let i = 0; i < NR; i++) {
      this.rayItems.push({
        u: (i + rng() * 0.7) / NR,
        z: lerp(-2.2, -24, rng()),
        w: lerp(0.65, 2.2, rng()),
        len: lerp(15, 25, rng()),
        tilt: lerp(0.18, 0.38, rng()),
        sway: rng() * TAU,
      });
    }
    this.scene.add(this.rays);

    // Dense multi-scale marine snow & bioluminescent cyan-emerald DOF bokeh orbs
    const NS = 640;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      const fg = i < NS * 0.12;
      sp[i * 3] = (rng() - 0.5) * 60;
      sp[i * 3 + 1] = rng() * 16 - 8;
      sp[i * 3 + 2] = fg ? lerp(4.8, 11.2, rng()) : lerp(-16, 4.2, Math.pow(rng(), 0.78));
      ss[i] = rng();
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    snowGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    this.snowMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uSurfY: U.uSurfY,
        uSpan: { value: 40 },
        uYmin: { value: -7 },
        uYmax: { value: 7 },
        uPx: { value: 600 },
        uFocus: { value: CAM_Z },
        uColor: { value: new THREE.Color() },
        uColor2: { value: new THREE.Color() },
        uAlpha: { value: 0.85 },
        uTwinkle: { value: 0.45 },
        uMap: { value: this.softDot },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform float uSpan; uniform float uYmin; uniform float uYmax; uniform float uPx;
        uniform float uFogNear; uniform float uFogFar; uniform float uFocus; uniform float uSurfY; uniform float uTwinkle;
        attribute float aSeed;
        varying float vA; varying float vMix; varying float vBokeh;
        void main(){
          vec3 p = position;
          float isBokeh = step(0.82, fract(aSeed * 9.17));
          vBokeh = isBokeh;
          float par = p.z > 4.5 ? 1.6 : 1.0;
          p.x = mod(p.x - uScrollW * par + sin(uTime * (0.3 + isBokeh * 0.35) + aSeed * 6.0) * (0.5 + isBokeh * 0.4) + uSpan * 0.5, uSpan) - uSpan * 0.5;
          float hgt = uYmax - uYmin;
          float riseDir = isBokeh > 0.5 ? 1.0 : -1.0;
          p.y = uYmin + mod(p.y - uYmin + riseDir * uTime * (0.09 + fract(aSeed * 7.0) * 0.24), hgt);
          p.z += sin(uTime * 0.45 + aSeed * 11.0) * 0.32;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          float coc = clamp(abs(d - uFocus) / max(d, 0.5) * 2.4, 0.0, 2.6);
          float baseSz = isBokeh > 0.5 ? (0.14 + fract(aSeed * 17.0) * 0.16) : (0.045 + fract(aSeed * 13.0) * 0.075);
          gl_PointSize = min(baseSz * uPx / max(d, 0.5) * (1.0 + coc * 1.8), uPx * 0.085);
          float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.2 + aSeed * 3.2) + aSeed * 20.0));
          float near = smoothstep(1.2, 3.5, d);
          vA = (0.38 + 0.62 * fract(aSeed * 3.7)) * (1.0 - smoothstep(uFogNear, uFogFar, d)) * tw * near / (1.0 + coc * coc * 2.8);
          vA *= (1.0 + isBokeh * 0.55) * (1.0 - step(uSurfY, p.y));
          vMix = max(isBokeh, step(0.68, fract(aSeed * 5.31)));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform vec3 uColor2; uniform float uAlpha; uniform sampler2D uMap;
        varying float vA; varying float vMix; varying float vBokeh;
        void main(){
          float texA = texture2D(uMap, gl_PointCoord).a;
          float core = smoothstep(0.45, 0.05, length(gl_PointCoord - 0.5));
          float a = texA * vA * uAlpha;
          vec3 col = mix(uColor, mix(uColor2, vec3(0.24, 0.96, 0.78), vBokeh * 0.55), vMix) + vec3(core * vBokeh * 0.35);
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    this.snow = new THREE.Points(snowGeo, this.snowMat);
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 7;
    this.scene.add(this.snow);
  }

  // ------------------------------------------------------------------ Build: Scrolling Scenery Layers
  _buildLayers() {
    const U = this.U;
    const rng = mulberry32(1234);
    this.layers = [];

    const addLayer = (mesh, items, margin, opts = {}) => {
      mesh.count = items.length;
      const layer = { mesh, items, margin, visibleFrac: 1, ...opts };
      this.layers.push(layer);
      this.scene.add(mesh);
      return layer;
    };

    // Far Layer 1: Craggy terraced abyssal canyon cliffs & jagged sea-stack massifs (replaces cylinder bgPillars!)
    {
      const geo = buildAbyssalCanyonCliff(rng);
      const mat = patchStd(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: '#ffffff',
          roughness: 0.72,
          metalness: 0.08,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.85, 0.85),
        }),
        U,
        {
          clip: true,
          caustic: 0.28,
          key: 'canyon_cliff',
        }
      );
      const N = 14;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        items.push({
          u: (i + rng() * 0.72) / N,
          z: lerp(-27, -45, rng()),
          dy: -0.36,
          sx: lerp(4.4, 7.6, rng()),
          sy: lerp(8.5, 15.6, rng()),
          sz: lerp(2.8, 4.6, rng()),
          ry: (rng() - 0.5) * 0.65 + (i % 2 === 1 ? Math.PI : 0),
          rz: (rng() - 0.5) * 0.1,
          shade: lerp(0.9, 1.3, rng()),
        });
      }
      this.farLayer = addLayer(mesh, items, 16, { kind: 'far' });
    }

    // Far Layer 2: Sunken Romanesque 2-span stone aqueduct arches & broken viaduct spans
    {
      const geo = buildSunkenAqueductArch();
      const mat = patchStd(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: '#ffffff',
          roughness: 0.62,
          metalness: 0.08,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.85, 0.85),
          side: THREE.DoubleSide,
        }),
        U,
        {
          clip: true,
          caustic: 0.44,
          key: 'aqueduct',
        }
      );
      const N = 8;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const sx = lerp(3.4, 5.2, rng());
        items.push({
          u: (i + 0.35 + rng() * 0.5) / N,
          z: lerp(-18.5, -31, rng()),
          dy: -0.28,
          sx,
          sy: sx * lerp(1.08, 1.38, rng()),
          sz: lerp(2.0, 3.2, rng()),
          ry: (rng() - 0.5) * 0.42 + (i % 2 === 1 ? Math.PI : 0),
          rz: (rng() - 0.5) * 0.1,
          shade: lerp(1.0, 1.38, rng()),
        });
      }
      this.aqueductLayer = addLayer(mesh, items, 14, { kind: 'far' });
    }

    // Far Layer 3: Distant toppled & sunken stone Watchtower silhouettes (beveled courses, arch portals & corbels)
    {
      const mat = patchStd(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: '#ffffff',
          roughness: 0.56,
          metalness: 0.08,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.8, 0.8),
          side: THREE.DoubleSide,
        }),
        U,
        {
          clip: true,
          caustic: 0.48,
          key: 'ruin',
        }
      );
      const N = 10;
      const mesh = instanced(buildRuin(), mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const fallen = i % 3 === 2;
        const r = lerp(1.7, 2.6, rng());
        items.push({
          u: (i + rng() * 0.6) / N,
          z: lerp(-14.5, -26, rng()),
          dy: fallen ? 0.15 : -0.45,
          sx: r,
          sy: fallen ? lerp(5.2, 8.2, rng()) : r * lerp(2.0, 2.85, rng()),
          sz: r,
          rx: fallen ? (rng() - 0.5) * 0.35 : (rng() - 0.5) * 0.06,
          ry: (rng() - 0.5) * 1.0,
          rz: fallen ? (rng() < 0.5 ? 1 : -1) * lerp(1.18, 1.4, rng()) : (rng() < 0.5 ? 1 : -1) * lerp(0.1, 0.28, rng()),
          shade: lerp(0.95, 1.28, rng()),
        });
      }
      this.ruinLayer = addLayer(mesh, items, 12, { kind: 'far' });
    }

    // Mid-ground wet basalt boulders (smooth PBR + silver rim + dancing caustics!)
    {
      const geo = buildRock(rng, 2);
      const mat = patchStd(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          roughness: 0.38,
          metalness: 0.12,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.75, 0.75),
        }),
        U,
        {
          caustic: 0.68,
          rim: { color: new THREE.Color('#7dd3fc'), str: { value: 0.18 } },
          key: 'rock',
        }
      );
      const N = 18;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        items.push({
          u: (i + rng() * 0.7) / N,
          z: lerp(-8, -18, rng()),
          dy: -0.6,
          sx: lerp(1.6, 4.4, rng()),
          sy: lerp(1.0, 3.2, rng()),
          sz: lerp(1.5, 3, rng()),
          ry: rng() * TAU,
          rz: (rng() - 0.5) * 0.3,
          shade: lerp(0.8, 1.2, rng()),
        });
      }
      this.rockLayer = addLayer(mesh, items, 10, { kind: 'rock' });
    }

    // Swaying 3D giant kelp ribbon-blade forests (back forest + foreground fronds with subsurface rim-glow)
    {
      this.kelpTex = makeKelpTex();
      const geo = buildKelp();
      this._kelpRim = { value: 0.42 };
      const mat = patchStd(
        new THREE.MeshStandardMaterial({
          map: this.kelpTex,
          alphaTest: 0.14,
          vertexColors: true,
          roughness: 0.44,
          metalness: 0.04,
          side: THREE.DoubleSide,
        }),
        U,
        {
          sway: 0.34,
          glow: true,
          caustic: 0.85,
          clip: true,
          rim: { color: new THREE.Color('#34d399'), str: this._kelpRim },
          key: 'kelp',
        }
      );
      const kelpCols = ['#145a46', '#1a6652', '#1f6e43', '#15585c', '#266b3d'].map((h) => new THREE.Color(h));
      const dead = new THREE.Color('#132433');
      {
        const N = 24;
        const mesh = instanced(geo.clone(), mat, N, { glow: true });
        const items = [];
        for (let i = 0; i < N; i++) {
          items.push({
            u: (i + rng() * 0.9) / N,
            z: lerp(-10, -19, rng()),
            dy: -0.3,
            sx: lerp(1.35, 2.2, rng()),
            sy: lerp(7, 12.5, rng()),
            sz: 1.45,
            ry: (rng() - 0.5) * 0.8,
            lush: kelpCols[i % kelpCols.length],
            dead,
            glow: 0.08,
            back: true,
          });
        }
        this.backKelpLayer = addLayer(mesh, items, 6, { kind: 'kelp' });
      }
      const N = 30;
      const mesh = instanced(geo, mat, N, { glow: true });
      const items = [];
      for (let i = 0; i < N; i++) {
        items.push({
          u: rng(),
          z: lerp(-4, -13, rng()),
          dy: -0.15,
          sx: lerp(1.15, 1.85, rng()),
          sy: lerp(3.8, 8.4, rng()),
          sz: 1.15,
          ry: (rng() - 0.5) * 0.8,
          lush: kelpCols[i % kelpCols.length],
          dead,
          glow: 0.12 + rng() * 0.14,
        });
      }
      this.kelpLayer = addLayer(mesh, items, 4, { kind: 'kelp' });
    }

    this._coralRim = { value: 0.28 };
    const coralMat = (key, { sway = 0.03, ...extra } = {}) =>
      patchStd(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.52,
          metalness: 0.06,
          normalMap: this.coralPorousNormalTex,
          normalScale: new THREE.Vector2(1.25, 1.25),
          side: THREE.DoubleSide,
          ...extra,
        }),
        U,
        {
          sway,
          glow: true,
          caustic: 0.9,
          key,
          rim: { color: new THREE.Color('#5efce8'), str: this._coralRim },
        }
      );
    const coralItems = (N, zNear, zFar, fg, sMin, sMax, rngFn) => {
      const items = [];
      for (let i = 0; i < N; i++) {
        const isFg = i < fg;
        const s = isFg ? lerp(0.3, 0.5, rngFn()) : lerp(sMin, sMax, rngFn());
        const lushOrig = new THREE.Color(CORAL_LUSH_ORIG_HEX[Math.floor(rngFn() * CORAL_LUSH_ORIG_HEX.length)]);
        const lushReboot = new THREE.Color(CORAL_LUSH_REBOOT_HEX[Math.floor(rngFn() * CORAL_LUSH_REBOOT_HEX.length)]);
        items.push({
          u: rngFn(),
          z: isFg ? lerp(2.1, 2.8, rngFn()) : lerp(zNear, zFar, rngFn()),
          dy: -0.08,
          sx: s,
          sy: s * lerp(0.85, 1.25, rngFn()),
          sz: s,
          ry: rngFn() * TAU,
          lush: lushReboot,
          lushOrig,
          lushReboot,
          dead: new THREE.Color(CORAL_DEAD_HEX[Math.floor(rngFn() * CORAL_DEAD_HEX.length)]),
          glow: lerp(0.14, 0.42, rngFn()),
          fg: isFg,
        });
      }
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rngFn() * (i + 1));
        const t = items[i];
        items[i] = items[j];
        items[j] = t;
      }
      return items;
    };

    // Staghorn coral + glowing bioluminescent tips
    {
      const { geo, tips } = buildStaghorn(rng);
      this.staghornTips = tips.filter((_, i) => i % 3 === 0).slice(0, 4);
      const N = 26;
      const mesh = instanced(geo, coralMat('stag', { sway: 0.035 }), N, { glow: true });
      this.stagLayer = addLayer(mesh, coralItems(N, -1.3, -7, 4, 1.1, 2.1, rng), 4, { kind: 'coral', tips: true });
    }
    // Sea fans
    {
      const fanTex = canvasTex(256, 160, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#fff';
        ctx.lineCap = 'round';
        const r2 = mulberry32(9);
        const draw = (x, y, a, len, wid, d) => {
          const x2 = x + Math.cos(a) * len;
          const y2 = y - Math.sin(a) * len;
          ctx.lineWidth = wid;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          if (d > 0) {
            draw(x2, y2, a + 0.28 + r2() * 0.15, len * 0.78, wid * 0.72, d - 1);
            draw(x2, y2, a - 0.28 - r2() * 0.15, len * 0.78, wid * 0.72, d - 1);
          }
        };
        for (let k = 0; k < 5; k++) draw(w / 2, h, 0.45 + k * 0.56, 34, 7, 5);
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.6;
        for (let r = 30; r < 160; r += 13) {
          ctx.beginPath();
          ctx.arc(w / 2, h, r, Math.PI * 1.06, Math.PI * 1.94);
          ctx.stroke();
        }
      });
      this.fanTex = fanTex;
      const mat = patchStd(
        new THREE.MeshStandardMaterial({ map: fanTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.55 }),
        U,
        { sway: 0.12, glow: true, caustic: 0.65, key: 'fan' }
      );
      const N = 12;
      const mesh = instanced(buildFan(), mat, N, { glow: true });
      const items = coralItems(N, -2, -8.5, 0, 0.9, 1.9, rng);
      for (const it of items) it.ry = (rng() - 0.5) * 0.9;
      this.fanLayer = addLayer(mesh, items, 4, { kind: 'coral' });
    }
    // Brain coral
    {
      const N = 12;
      const mesh = instanced(buildBrain(), coralMat('brain', { sway: 0 }), N, { glow: true });
      const items = coralItems(N, -1.2, -7, 2, 0.6, 1.25, rng);
      for (const it of items) {
        it.dy = -0.15;
        it.sy = it.sx * 0.8;
      }
      this.brainLayer = addLayer(mesh, items, 4, { kind: 'coral' });
    }
    // Terraced Montipora / Turbinaria table-plate & chalice reef (organic scalloped tiers — zero smooth plastic tubes!)
    {
      const N = 10;
      const mesh = instanced(buildTableReef(rng), coralMat('table', { sway: 0.025 }), N, { glow: true });
      this.tubeLayer = addLayer(mesh, coralItems(N, -1.5, -7.5, 2, 0.95, 1.75, rng), 4, { kind: 'coral' });
    }
    // Sunken iron-hooped barnacle salvage casks (dark weathered steel — zero pale smooth cylinder!)
    {
      const parts = [];
      const body = new THREE.CylinderGeometry(0.46, 0.46, 1.22, 12, 2);
      parts.push(body);
      for (const hy of [-0.42, 0.0, 0.42]) {
        const hoop = new THREE.TorusGeometry(0.47, 0.038, 5, 12);
        hoop.rotateX(Math.PI / 2);
        hoop.translate(0, hy, 0);
        parts.push(hoop);
      }
      const g = merge(parts);
      paint(g, (x, y, z, c) => {
        const hoop = Math.abs(Math.abs(y) - 0.42) < 0.05 || Math.abs(y) < 0.045 ? 1.45 : 0.65;
        const rust = 0.72 + 0.28 * Math.sin(x * 9 + y * 5) * Math.sin(z * 7);
        c[0] = hoop * rust * 0.14;
        c[1] = hoop * rust * 0.19;
        c[2] = hoop * rust * 0.28;
      });
      const mat = patchStd(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: '#ffffff',
          roughness: 0.48,
          metalness: 0.72,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.85, 0.85),
        }),
        U,
        { caustic: 0.55, key: 'barrel' }
      );
      const N = 6;
      const mesh = instanced(g, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        items.push({
          u: (i + rng() * 0.5) / N,
          z: lerp(-1.5, -6, rng()),
          dy: 0.25,
          sx: 0.8,
          sy: 0.8,
          sz: 0.8,
          rx: rng() < 0.5 ? Math.PI / 2 : (rng() - 0.5) * 0.4,
          ry: rng() * TAU,
          rz: (rng() - 0.5) * 0.4,
        });
      }
      this.barrelLayer = addLayer(mesh, items, 3, { kind: 'barrel' });
    }

    this._haloLayers = [this.brainLayer, this.tubeLayer];
    this._lushLayers = [this.stagLayer, this.fanLayer, this.brainLayer, this.tubeLayer, this.kelpLayer, this.backKelpLayer];
    for (const layer of this.layers) this._composeLayer(layer);
  }

  _composeLayer(layer) {
    const d = this._dummy;
    const { mesh, items } = layer;
    const v = this._v;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      d.position.set(0, 0, it.z);
      d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      const ks = it.kScale ?? 1;
      d.scale.set(it.sx, it.sy * ks, it.sz);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (layer.tips && this.staghornTips) {
        it.tipOff = it.tipOff || this.staghornTips.map(() => new THREE.Vector3());
        for (let k = 0; k < this.staghornTips.length; k++) {
          v.copy(this.staghornTips[k]);
          v.applyMatrix4(d.matrix);
          it.tipOff[k].set(v.x, v.y, v.z - it.z);
        }
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Build: Dual-Era Submarine + Explorer Pogo V2
  _buildSub() {
    const U = this.U;
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const body = new THREE.Group();
    outer.add(inner);
    inner.add(body);
    body.position.y = -0.06;
    outer.rotation.order = 'YZX';
    this.subOuter = outer;
    this.subInner = inner;
    this.subBody = body;

    this.hullRim = { value: 0.52 };
    this.subLit = { value: 0.04 };
    this.classicFlashMats = [];
    this.rebootFlashMats = [];

    // ---------------------------------------------------------
    // A. 2026 REBOOT CRAFT (`rebootSubGroup` + `reboot_sub_mk7.glb` + `pilot_seat` `(0.36,-0.18,0)`)
    // ---------------------------------------------------------
    const rebootGroup = new THREE.Group();
    rebootGroup.name = 'RebootMantaSub';
    this.rebootSubGroup = rebootGroup;
    body.add(rebootGroup);

    this.rebootDomeMat = canopyMaterial(U, { clearCenter: 0.04 });

    // Instant Frame-0 Procedural Manta-Bathysphere (exact `reboot_sub_mk7.glb` proportions!)
    {
      const proc = new THREE.Group();
      const tiParts = [];
      const brParts = [];
      const glParts = [];

      const hull = new THREE.CylinderGeometry(0.37, 0.08, 1.32, 20, 4);
      hull.rotateZ(Math.PI / 2);
      hull.scale(1, 0.92, 1.08);
      hull.translate(-0.38, 0.01, 0);
      tiParts.push(hull);

      // Swept Manta Hydro-Wings (±Z out to 0.92) + cyan leading-edge plasma strips
      for (const sz of [-1, 1]) {
        const wing = new THREE.BoxGeometry(0.62, 0.07, 0.64);
        wing.rotateY(sz * -0.46);
        wing.rotateX(sz * 0.08);
        wing.translate(-0.36, -0.05, sz * 0.62);
        tiParts.push(wing);

        const strip = new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8);
        strip.rotateX(Math.PI / 2);
        strip.rotateY(sz * -0.46);
        strip.translate(-0.24, -0.05, sz * 0.64);
        glParts.push(strip);

        const pod = new THREE.CylinderGeometry(0.058, 0.064, 0.54, 12);
        pod.rotateZ(Math.PI / 2);
        pod.translate(0.21, -0.22, sz * 0.44);
        tiParts.push(pod);

        const thr = new THREE.CylinderGeometry(0.118, 0.128, 0.34, 14);
        thr.rotateZ(Math.PI / 2);
        thr.translate(-0.68, -0.04, sz * 0.54);
        tiParts.push(thr);

        const thrRim = new THREE.TorusGeometry(0.125, 0.018, 8, 20);
        thrRim.rotateY(Math.PI / 2);
        thrRim.translate(-0.84, -0.04, sz * 0.54);
        brParts.push(thrRim);
      }

      const fin = new THREE.BoxGeometry(0.4, 0.32, 0.04);
      fin.rotateZ(-0.38);
      fin.translate(-0.68, 0.34, 0);
      tiParts.push(fin);

      const collar = new THREE.TorusGeometry(0.385, 0.032, 10, 32);
      collar.rotateY(Math.PI / 2);
      collar.translate(0.27, 0.01, 0);
      brParts.push(collar);

      // Cockpit floor, brass bucket backrest & cyan helm console
      const tub = new THREE.BoxGeometry(0.44, 0.05, 0.42);
      tub.translate(0.46, -0.22, 0);
      tiParts.push(tub);
      const backRest = new THREE.BoxGeometry(0.07, 0.3, 0.28);
      backRest.rotateZ(0.16);
      backRest.translate(0.28, -0.04, 0);
      brParts.push(backRest);
      const consoleBox = new THREE.BoxGeometry(0.08, 0.025, 0.26);
      consoleBox.rotateZ(-0.42);
      consoleBox.translate(0.62, -0.01, 0);
      glParts.push(consoleBox);

      const tiMat = patchStd(
        new THREE.MeshStandardMaterial({
          color: '#1e293b',
          metalness: 0.82,
          roughness: 0.28,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.25, 0.25),
        }),
        U,
        { rim: { color: new THREE.Color('#93c5fd'), str: this.hullRim }, caustic: 0.95, selfLit: this.subLit, key: 'rproc_ti' }
      );
      const brMat = patchStd(
        new THREE.MeshStandardMaterial({ color: '#c9933b', metalness: 0.88, roughness: 0.25 }),
        U,
        { rim: { color: new THREE.Color('#fde68a'), str: this.hullRim }, caustic: 0.75, selfLit: this.subLit, key: 'rproc_br' }
      );
      const glMat = new THREE.MeshBasicMaterial({ color: '#4ff0ff', toneMapped: false });
      this.rebootFlashMats.push(tiMat, brMat);

      proc.add(new THREE.Mesh(merge(tiParts), tiMat));
      proc.add(new THREE.Mesh(merge(brParts), brMat));
      proc.add(new THREE.Mesh(merge(glParts), glMat));

      const domeGeo = new THREE.SphereGeometry(0.37, 28, 18, 0, TAU, 0, Math.PI * 0.52);
      domeGeo.rotateZ(-Math.PI / 2);
      domeGeo.scale(1.88, 0.98, 1.02);
      const dome = new THREE.Mesh(domeGeo, this.rebootDomeMat);
      dome.position.set(0.26, 0, 0);
      dome.renderOrder = 15;
      proc.add(dome);

      this.rebootProceduralHull = proc;
      rebootGroup.add(proc);
    }

    // Twin Wing-Mounted Plasma-Bubble Thruster Plumes (`(-0.88, -0.04, ±0.54)`)
    const plumeGeo = new THREE.ConeGeometry(0.11, 0.95, 16, 1, true);
    plumeGeo.translate(0, -0.475, 0);
    plumeGeo.rotateZ(-Math.PI / 2);
    this.thrusterPlumeMat = thrusterPlumeMaterial(U);
    this.thrusterPlumeL = new THREE.Mesh(plumeGeo, this.thrusterPlumeMat);
    this.thrusterPlumeL.position.set(-0.86, -0.04, -0.54);
    this.thrusterPlumeL.renderOrder = 14;
    this.thrusterPlumeR = new THREE.Mesh(plumeGeo, this.thrusterPlumeMat);
    this.thrusterPlumeR.position.set(-0.86, -0.04, 0.54);
    this.thrusterPlumeR.renderOrder = 14;
    rebootGroup.add(this.thrusterPlumeL, this.thrusterPlumeR);

    // Compact Helm Console Lights inside `nose_dome` so Explorer Pogo V2 gleams warmly!
    this.cockpitWarmLight = new THREE.PointLight('#ffbe55', 1.55, 1.9, 1.6);
    this.cockpitWarmLight.position.set(0.56, 0.14, 0.24);
    this.cockpitCyanLight = new THREE.PointLight('#5efce8', 1.35, 1.8, 1.6);
    this.cockpitCyanLight.position.set(0.62, -0.04, 0.04);
    rebootGroup.add(this.cockpitWarmLight, this.cockpitCyanLight);

    // Exact `pilot_seat` anchor `(0.36, -0.18, 0.0)`
    this.rebootPilotAnchor = new THREE.Group();
    this.rebootPilotAnchor.position.set(0.36, -0.18, 0.0);
    rebootGroup.add(this.rebootPilotAnchor);

    // ---------------------------------------------------------
    // B. 1987 ORIGINAL CRAFT (`classicSubGroup` — Glossy 2008 XBLA HD MK.7)
    // ---------------------------------------------------------
    const classicGroup = new THREE.Group();
    classicGroup.name = 'ClassicMk7Sub';
    classicGroup.position.y = -0.08;
    this.classicSubGroup = classicGroup;
    body.add(classicGroup);

    const L0 = -1.15;
    const L1 = 1.26;
    const R = 0.6;
    const hr = (x) => {
      const u = clamp((x - L0) / (L1 - L0), 0, 1);
      return R * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 1.36))), 0.55);
    };
    const C = (h) => new THREE.Color(h);
    const YEL = C('#ffc21a');
    const RED = C('#e5322d');
    const REDD = C('#a61e1a');
    const DARK = C('#232a38');
    const MET = C('#d5dde6');
    const METD = C('#8b95a3');
    const SEAMS = [-0.7, 0.42, 0.86];
    const PORTS = [-0.12, 0.24, 0.6];
    const paintP = [];
    const metalP = [];
    const lampP = [];

    const xs = [];
    for (let i = 0; i <= 64; i++) xs.push(lerp(L0, L1, i / 64));
    for (const s of SEAMS) xs.push(s - 0.014, s, s + 0.014);
    xs.push(1.0, 1.012, -0.86, -0.852, -0.968, -0.96);
    xs.sort((a, b) => a - b);
    const pts = [];
    let last = -9;
    for (const x of xs) {
      if (x - last < 0.002) continue;
      last = x;
      pts.push(new THREE.Vector2(Math.max(hr(x), 0.001), x));
    }
    const hull = new THREE.LatheGeometry(pts, 48);
    hull.rotateZ(-Math.PI / 2);
    paint(hull, (x, y, _z, c) => {
      let base = YEL;
      let k = 1;
      if (x > 1.006) base = RED;
      else if (x < -0.856 && x > -0.964) base = RED;
      for (const s of SEAMS) if (Math.abs(x - s) < 0.007) k = 0.45;
      const r = Math.max(hr(x), 0.001);
      k *= 0.7 + 0.3 * smooth01((y / r + 0.75) / 1.5);
      c[0] = base.r * k;
      c[1] = base.g * k;
      c[2] = base.b * k;
    });
    paintP.push(hull);

    const deck = new THREE.CylinderGeometry(0.47, 0.54, 0.34, 40, 1, false);
    place(deck, 0.2, 0.45, 0, 0, 0, 0, 1.12, 1, 1);
    paint(deck, (_x, y, _z, c) => {
      const k = 0.72 + 0.28 * clamp((y - 0.28) / 0.34, 0, 1);
      c[0] = YEL.r * k;
      c[1] = YEL.g * k;
      c[2] = YEL.b * k;
    });
    paintP.push(deck);
    const floor = new THREE.CircleGeometry(0.49, 32);
    place(floor, 0.2, 0.615, 0, -Math.PI / 2, 0, 0, 1.12, 1, 1);
    solidC(floor, DARK);
    paintP.push(floor);
    const panel = new THREE.BoxGeometry(0.12, 0.07, 0.36);
    place(panel, 0.52, 0.64, 0, 0, 0, -0.6);
    solidC(panel, DARK, 1.3);
    paintP.push(panel);

    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.42, 0);
    finShape.lineTo(0.08, 0.4);
    finShape.lineTo(-0.14, 0.42);
    finShape.closePath();
    const finGeo = () => {
      const g = new THREE.ExtrudeGeometry(finShape, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.014,
        bevelSize: 0.014,
        bevelSegments: 1,
      });
      g.translate(-0.2, 0, -0.02);
      paint(g, (_x, y, _z, c) => {
        const k = 0.75 + 0.25 * clamp(1 - y / 0.42, 0, 1);
        c[0] = RED.r * k;
        c[1] = RED.g * k;
        c[2] = RED.b * k;
      });
      return g;
    };
    const fr = hr(-0.92);
    paintP.push(place(finGeo(), -0.92, fr * 0.72, 0));
    paintP.push(place(finGeo(), -0.92, -fr * 0.72, 0, Math.PI, 0, 0, 1, 0.8, 1));
    paintP.push(place(finGeo(), -0.92, 0, fr * 0.72, Math.PI / 2, 0, 0, 1, 0.85, 1));
    paintP.push(place(finGeo(), -0.92, 0, -fr * 0.72, -Math.PI / 2, 0, 0, 1, 0.85, 1));
    for (const dz of [1, -1]) {
      const plane = new THREE.BoxGeometry(0.3, 0.035, 0.24);
      place(plane, 0.74, -0.12, dz * (hr(0.74) + 0.07), 0, 0, -0.08);
      solidC(plane, RED);
      paintP.push(plane);
    }
    const shroud = new THREE.TorusGeometry(0.3, 0.05, 10, 36);
    place(shroud, -1.22, 0, 0, 0, Math.PI / 2, 0);
    solidC(shroud, RED);
    paintP.push(shroud);
    const band = new THREE.CylinderGeometry(0.3, 0.3, 0.13, 32, 1, true);
    place(band, -1.22, 0, 0, 0, 0, Math.PI / 2);
    solidC(band, REDD);
    paintP.push(band);
    for (const sy of [1, -1]) {
      const strut = new THREE.BoxGeometry(0.2, 0.03, 0.03);
      place(strut, -1.13, sy * 0.24, 0, 0, 0, sy * 0.5);
      solidC(strut, RED);
      paintP.push(strut);
    }

    for (const px of PORTS) {
      const r = hr(px);
      for (const side of [1, -1]) {
        const rim = new THREE.TorusGeometry(0.1, 0.024, 8, 22);
        place(rim, px, -0.02, side * r * 0.985, 0, side > 0 ? 0 : Math.PI, 0);
        solidC(rim, MET);
        metalP.push(rim);
        const lens = new THREE.CircleGeometry(0.084, 20);
        place(lens, px, -0.02, side * (r * 0.985 + 0.004), 0, side > 0 ? 0 : Math.PI, 0);
        solidC(lens, C('#ffd27a'), 1.15);
        lampP.push(lens);
      }
    }
    for (const sx of SEAMS) {
      const r = hr(sx) + 0.004;
      for (let th = -1.25; th <= 1.26; th += 0.25) {
        const rv = new THREE.SphereGeometry(0.017, 6, 4);
        place(rv, sx + 0.03, Math.sin(th) * r, Math.cos(th) * r);
        solidC(rv, METD);
        metalP.push(rv);
      }
    }
    const housing = new THREE.CylinderGeometry(0.125, 0.15, 0.09, 24);
    place(housing, 1.24, 0, 0, 0, 0, Math.PI / 2);
    solidC(housing, MET);
    metalP.push(housing);
    const lampLens = new THREE.CircleGeometry(0.105, 24);
    place(lampLens, 1.288, 0, 0, 0, Math.PI / 2, 0);
    solidC(lampLens, C('#fff8de'), 1.2);
    lampP.push(lampLens);
    const collar = new THREE.TorusGeometry(0.5, 0.042, 10, 56);
    place(collar, 0.2, 0.625, 0, Math.PI / 2, 0, 0, 1.12, 1, 1);
    solidC(collar, MET);
    metalP.push(collar);
    const peri = new THREE.CylinderGeometry(0.026, 0.032, 0.44, 10);
    place(peri, -0.3, 0.66, 0);
    solidC(peri, MET);
    metalP.push(peri);
    const periHead = new THREE.BoxGeometry(0.14, 0.07, 0.075);
    place(periHead, -0.25, 0.88, 0);
    solidC(periHead, MET);
    metalP.push(periHead);
    const periLens = new THREE.CircleGeometry(0.025, 12);
    place(periLens, -0.179, 0.88, 0, 0, Math.PI / 2, 0);
    solidC(periLens, C('#9ff3ff'));
    lampP.push(periLens);
    const ant = new THREE.CylinderGeometry(0.009, 0.013, 0.42, 6);
    place(ant, -0.6, 0.55, 0, 0, 0, 0.22);
    solidC(ant, METD);
    metalP.push(ant);
    const antTip = new THREE.SphereGeometry(0.032, 10, 8);
    place(antTip, -0.647, 0.755, 0);
    solidC(antTip, C('#ff3b3b'), 1.3);
    lampP.push(antTip);
    const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10);
    place(shaft, -1.15, 0, 0, 0, 0, Math.PI / 2);
    solidC(shaft, METD);
    metalP.push(shaft);

    const paintMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.22, roughness: 0.26 }), U, {
      rim: { color: new THREE.Color('#ffe7a0'), str: this.hullRim },
      caustic: 1.05,
      selfLit: this.subLit,
      key: 'subpaint',
    });
    const metalMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.52, roughness: 0.22 }), U, {
      rim: { color: new THREE.Color('#e6f6ff'), str: this.hullRim },
      caustic: 0.6,
      selfLit: this.subLit,
      key: 'submetal',
    });
    const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.classicFlashMats.push(paintMat, metalMat);
    classicGroup.add(new THREE.Mesh(merge(paintP), paintMat));
    classicGroup.add(new THREE.Mesh(merge(metalP), metalMat));
    classicGroup.add(new THREE.Mesh(merge(lampP), lampMat));

    const decalTex = canvasTex(128, 128, (ctx) => {
      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#e5322d';
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#1b2440';
      ctx.font = '900 76px "Arial Black", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('7', 66, 70);
    });
    this.decalTex = decalTex;
    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 28),
      patchStd(new THREE.MeshStandardMaterial({ map: decalTex, alphaTest: 0.5, roughness: 0.3, metalness: 0.1 }), U, {
        caustic: 0.8,
        selfLit: this.subLit,
        key: 'decal',
      })
    );
    decal.position.set(-0.42, -0.02, hr(-0.42) + 0.006);
    decal.rotation.y = -0.12;
    classicGroup.add(decal);

    this.classicPilotAnchor = new THREE.Group();
    this.classicPilotAnchor.position.set(0.16, 0.54, 0.0);
    classicGroup.add(this.classicPilotAnchor);

    this.canopyMat = canopyMaterial(U, { clearCenter: 0.06 });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 20, 0, TAU, 0, Math.PI / 2), this.canopyMat);
    canopy.position.set(0.2, 0.625, 0);
    canopy.scale.set(1.12, 1.04, 1.0);
    canopy.renderOrder = 15;
    classicGroup.add(canopy);

    {
      const parts = [];
      const hub = new THREE.ConeGeometry(0.075, 0.2, 14);
      place(hub, -0.05, 0, 0, 0, 0, Math.PI / 2);
      solidC(hub, MET);
      parts.push(hub);
      for (let k = 0; k < 4; k++) {
        const blade = new THREE.BoxGeometry(0.03, 0.22, 0.1);
        blade.translate(0, 0.13, 0);
        blade.rotateY(0.6);
        blade.rotateX((k * Math.PI) / 2);
        solidC(blade, MET, 0.95);
        parts.push(blade);
      }
      this.prop = new THREE.Mesh(merge(parts), metalMat);
      this.prop.position.set(-1.27, 0, 0);
      classicGroup.add(this.prop);
      this.propBlurMat = propBlurMaterial(U);
      const blur = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32), this.propBlurMat);
      blur.position.set(-1.27, 0, 0);
      blur.rotation.y = Math.PI / 2;
      blur.renderOrder = 14;
      classicGroup.add(blur);
    }

    // ---------------------------------------------------------
    // C. Shared Explorer Pogo V2 Pilot (`PogoRig` from `./pogo.js` — ZERO bean-frog!)
    // ---------------------------------------------------------
    this.pogoRig = new PogoRig(this.skinId);
    if (this.pogoRig.bones?.blaster) this.pogoRig.bones.blaster.visible = false;
    if (this.pogoRig.bones?.backpack) this.pogoRig.bones.backpack.visible = false;
    this.pogoMount = new THREE.Group();
    this.pogoMount.add(this.pogoRig.group);
    this.pogoMount.scale.setScalar(0.62);
    this.pogoMount.rotation.set(0, Math.PI * 0.5 - 0.22, 0);
    this.rebootPilotAnchor.add(this.pogoMount);

    // ---------------------------------------------------------
    // D. Dual-Era Volumetric Headlight Cones + Real SpotLight
    //    - Classic (`this.cone`): single bow cone from `(0.95, -0.06, 0)`
    //    - Reboot (`this.rebootConeMesh`): twin converging double-layer volumetric cones from
    //      `reboot_sub_mk7.glb`'s twin under-slung bow pods `(0.54, -0.22, ±0.43)`, keeping
    //      Explorer Pogo V2 inside the panoramic glass `nose_dome` 100% unobstructed!
    // ---------------------------------------------------------
    this.coneMat = lightConeMaterial(U);
    {
      const coneGeo = new THREE.ConeGeometry(1.25, 5.2, 32, 1, true);
      coneGeo.rotateZ(Math.PI / 2);
      coneGeo.translate(0.95 + 2.6, -0.06, 0);
      flag(coneGeo, 'aCore', 0.35);
      this.cone = new THREE.Mesh(coneGeo, this.coneMat);
      this.cone.renderOrder = 8;
      body.add(this.cone);
    }
    {
      const twinParts = [];
      for (const sz of [-1, 1]) {
        const yOff = sz < 0 ? -0.14 : -0.25;
        const pitch = sz < 0 ? 0.055 : -0.075;
        // Outer wide atmospheric scatter cone
        const outerC = new THREE.ConeGeometry(1.18, 6.6, 20, 1, true);
        outerC.rotateZ(Math.PI / 2);
        outerC.translate(3.3, 0, 0);
        outerC.rotateY(sz * 0.065);
        outerC.rotateZ(pitch);
        outerC.translate(0.54, yOff, sz * 0.44);
        flag(outerC, 'aCore', 0.0);
        twinParts.push(outerC);

        // Inner focused caustic filament beam
        const innerC = new THREE.ConeGeometry(0.38, 6.2, 16, 1, true);
        innerC.rotateZ(Math.PI / 2);
        innerC.translate(3.1, 0, 0);
        innerC.rotateY(sz * 0.065);
        innerC.rotateZ(pitch);
        innerC.translate(0.54, yOff, sz * 0.44);
        flag(innerC, 'aCore', 0.75);
        twinParts.push(innerC);
      }
      const twinGeo = merge(twinParts, ['aCore']);
      this.rebootConeMesh = new THREE.Mesh(twinGeo, this.coneMat);
      this.rebootConeMesh.renderOrder = 8;
      body.add(this.rebootConeMesh);
    }

    this.spot = new THREE.SpotLight('#e2f2ff', 54, 18, 0.58, 0.68, 1.35);
    this.spot.position.set(0.86, -0.14, 0);
    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(5.8, -0.38, 0);
    body.add(this.spot, this.spotTarget);
    this.spot.target = this.spotTarget;

    this._classicNavLocal = new THREE.Vector3(-0.647, 0.675, 0);
    this._rebootNavLocal = new THREE.Vector3(-0.78, 0.42, 0);
    this._rebootLampL = new THREE.Vector3(0.56, -0.22, -0.43);
    this._rebootLampR = new THREE.Vector3(0.56, -0.22, 0.43);
    this._classicPortLocal = PORTS.map((px) => new THREE.Vector3(px, -0.1, hr(px) + 0.03));
    this._subTail = new THREE.Vector3();
    this._subTailL = new THREE.Vector3();
    this._subTailR = new THREE.Vector3();
    this._subSc = 0.5;
    this.scene.add(outer);
  }

  // ------------------------------------------------------------------ Build: Entities, GLB Pools, Vents, Sonar, Warp Cavern
  _buildEntities() {
    const U = this.U;
    this.fishRim = { value: 0.55 };

    // 1a. Classic Fish Meshes (`era === 'original'`)
    const classicFishMat = patchStd(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.14 }),
      U,
      {
        wag: true,
        glow: true,
        eye: true,
        caustic: 0.9,
        rim: { color: new THREE.Color('#ffffff'), str: this.fishRim },
        key: 'cfish',
      }
    );
    this.classicFishMesh = instanced(buildClassicFish(), classicFishMat, MAX_FISH, { glow: true, anim: true });
    this.classicAmbMesh = instanced(buildClassicFish(true), classicFishMat, MAX_AMB, { glow: true, anim: true });
    this.scene.add(this.classicFishMesh, this.classicAmbMesh);

    // 1b. Reboot Alien Fish Meshes (`alien_fish_1.glb` & `alien_fish_2.glb`)
    const dummyWhiteTex = makeDataTex(4, 4, (d) => d.fill(255), { srgb: true });
    this._dummyWhiteTex = dummyWhiteTex;
    this._fish1MapWrap = { map: { value: dummyWhiteTex }, enabled: { value: 0 } };
    this._fish2MapWrap = { map: { value: dummyWhiteTex }, enabled: { value: 0 } };

    const makeRebootFishMat = (wrap, key) =>
      patchStd(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.22,
          metalness: 0.12,
          side: THREE.DoubleSide,
        }),
        U,
        {
          finWag: true,
          glow: true,
          partGlow: true,
          useMapUniform: wrap,
          caustic: 0.95,
          rim: { color: new THREE.Color('#67e8f9'), str: this.fishRim },
          key,
        }
      );

    this.rebootFish1Mat = makeRebootFishMat(this._fish1MapWrap, 'rfish1');
    this.rebootFish2Mat = makeRebootFishMat(this._fish2MapWrap, 'rfish2');
    const fb1 = buildRebootFallbackFish(0, false);
    const fb2 = buildRebootFallbackFish(1, false);
    const fbAmb1 = buildRebootFallbackFish(0, true);
    const fbAmb2 = buildRebootFallbackFish(1, true);
    this.rebootFish1Mesh = instanced(fb1, this.rebootFish1Mat, MAX_FISH, { glow: true, anim: true });
    this.rebootFish2Mesh = instanced(fb2, this.rebootFish2Mat, MAX_FISH, { glow: true, anim: true });
    this.rebootAmb1Mesh = instanced(fbAmb1, this.rebootFish1Mat, MAX_AMB, { glow: true, anim: true });
    this.rebootAmb2Mesh = instanced(fbAmb2, this.rebootFish2Mat, MAX_AMB, { glow: true, anim: true });
    this.scene.add(this.rebootFish1Mesh, this.rebootFish2Mesh, this.rebootAmb1Mesh, this.rebootAmb2Mesh);

    // 2. 124-Fish Ambient Boid Schools (parting dynamically around the sub!)
    const rng = mulberry32(4321);
    this.ambSchools = [];
    const ambCols = ['#a9e2f5', '#7dd3fc', '#c4b5fd', '#6ee7b7', '#99f6e4', '#e9d5ff'].map((h) => new THREE.Color(h));
    const defs = [
      { z: -2.6, n: 18, avoid: true, species: 0 },
      { z: -3.6, n: 16, avoid: true, species: 1 },
      { z: -7.0, n: 22, species: 0 },
      { z: -9.5, n: 20, species: 1 },
      { z: -12.0, n: 24, species: 0 },
      { z: -15.0, n: 24, species: 1 },
    ];
    this.boidPos = new Float32Array(MAX_AMB * 3);
    this.boidVel = new Float32Array(MAX_AMB * 3);
    let start = 0;
    for (let k = 0; k < defs.length; k++) {
      const d = defs[k];
      const n = Math.min(d.n, MAX_AMB - start);
      const dir = rng() < 0.3 ? -1 : 1;
      this.ambSchools.push({
        u: rng(),
        z: d.z,
        yf: lerp(0.2, 0.75, rng()),
        dir,
        speed: lerp(0.35, 1.0, rng()),
        n,
        start,
        species: d.species,
        size: lerp(0.16, 0.24, rng()) * (d.z > -5 ? 1.25 : 1),
        color: ambCols[k % ambCols.length],
        ph: rng() * TAU,
        avoid: Boolean(d.avoid),
      });
      for (let i = 0; i < n; i++) {
        const o = (start + i) * 3;
        this.boidPos[o] = (rng() - 0.5) * 2.2;
        this.boidPos[o + 1] = (rng() - 0.5) * 0.9;
        this.boidPos[o + 2] = (rng() - 0.5) * 1.2;
        this.boidVel[o] = dir * 0.3;
        this.boidVel[o + 1] = 0;
        this.boidVel[o + 2] = 0;
      }
      start += n;
    }

    // 3. 3D Golden Gears (`isGear`) + Iridescent Soap-Bubble Shells + Reboot Cryo-Torpedoes
    const gearMat = patchStd(
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 0.42,
        metalness: 0.88,
        roughness: 0.2,
      }),
      U,
      { caustic: 0.85, key: 'gear' }
    );
    this.gearMesh = instanced(buildGoldenGearGeometry(), gearMat, MAX_GEAR, { color: false });
    this.scene.add(this.gearMesh);

    this.shellMesh = instanced(new THREE.SphereGeometry(1, 24, 16), bubbleShellMaterial(U), MAX_SHELL, { color: false });
    this.shellMesh.renderOrder = 12;
    this.scene.add(this.shellMesh);

    const torpGeo = new THREE.OctahedronGeometry(1, 1);
    torpGeo.scale(1.65, 0.72, 0.72);
    this.torpedoMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 1.85,
      roughness: 0.08,
      metalness: 0.2,
    });
    this.torpedoMesh = instanced(torpGeo, this.torpedoMat, MAX_TORP, { color: false });
    this.torpedoMesh.renderOrder = 11;
    this.scene.add(this.torpedoMesh);

    // 4. Bioluminescent Jellyfish
    const bellPts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * (Math.PI / 2);
      bellPts.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * 1.0), Math.cos(a) * 0.82));
    }
    bellPts.push(new THREE.Vector2(1.05, -0.06), new THREE.Vector2(0.97, -0.15), new THREE.Vector2(0.86, -0.1));
    const bellGeo = new THREE.LatheGeometry(bellPts, 28);
    bellGeo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(MAX_JELLY), 1));
    this.bellMesh = instanced(bellGeo, jellyBellMaterial(U), MAX_JELLY);
    this.bellMesh.renderOrder = 11;

    const tparts = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const g = new THREE.PlaneGeometry(0.05, 2.3, 1, 14);
      g.translate(0, -1.15, 0);
      g.rotateY(a);
      g.translate(Math.cos(a) * 0.74, -0.06, Math.sin(a) * 0.74);
      tparts.push(g);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + 0.4;
      const g = new THREE.PlaneGeometry(0.17, 1.4, 1, 10);
      g.translate(0, -0.7, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 + Math.sin(p.getY(i) * 9) * 0.45));
      g.rotateY(a);
      g.translate(Math.cos(a) * 0.14, -0.05, Math.sin(a) * 0.14);
      tparts.push(g);
    }
    const tentGeo = merge(tparts);
    tentGeo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(MAX_JELLY), 1));
    this.tentMesh = instanced(tentGeo, tentacleMaterial(U), MAX_JELLY);
    this.tentMesh.renderOrder = 10;
    this.scene.add(this.bellMesh, this.tentMesh);

    // 5. Naval Mines (`sea_mine.glb` + Cryo-Freeze tint + 260-link swaying chains)
    this.mineRim = { value: 0.85 };
    this._mineMapWrap = { map: { value: dummyWhiteTex }, enabled: { value: 0 } };
    this.rebootMineMat = patchStd(
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.68, roughness: 0.42 }),
      U,
      {
        rim: { color: new THREE.Color('#ff3b4e'), str: this.mineRim },
        partGlow: true,
        useMapUniform: this._mineMapWrap,
        caustic: 0.6,
        key: 'rmine',
      }
    );
    const mineFallbackGeo = buildMineFallback();
    this.rebootMineMesh = instanced(mineFallbackGeo.clone(), this.rebootMineMat, MAX_MINE, { color: true });

    const classicMineMat = patchStd(
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.34 }),
      U,
      { rim: { color: new THREE.Color('#ff4a2a'), str: this.mineRim }, partGlow: true, caustic: 0.5, key: 'cmine' }
    );
    this.classicMineMesh = instanced(mineFallbackGeo, classicMineMat, MAX_MINE, { color: true });

    const link = new THREE.TorusGeometry(0.5, 0.15, 5, 10);
    const linkMat = new THREE.MeshStandardMaterial({ color: '#4b5563', metalness: 0.7, roughness: 0.4 });
    this.linkMesh = instanced(link, linkMat, MAX_LINKS, { color: false });
    const anchor = new THREE.CylinderGeometry(0.55, 0.75, 0.45, 10);
    this.anchorMesh = instanced(
      anchor,
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.65, metalness: 0.45 }),
      MAX_MINE,
      { color: false }
    );
    this.scene.add(this.rebootMineMesh, this.classicMineMesh, this.linkMesh, this.anchorMesh);

    // 6. Giant Clams & Pearls
    const shellGeo = buildShell();
    const clamMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, side: THREE.DoubleSide }), U, {
      nacre: true,
      caustic: 0.7,
      rim: { color: new THREE.Color('#ffd6ec'), str: { value: 0.3 } },
      key: 'clam',
    });
    const botGeo = shellGeo.clone();
    botGeo.scale(1, -0.8, 1);
    const idx = botGeo.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    this.clamBot = instanced(botGeo, clamMat, MAX_CLAM);
    this.clamTop = instanced(shellGeo, clamMat, MAX_CLAM);
    const pearlMat = new THREE.MeshStandardMaterial({
      color: '#fff7fb',
      emissive: '#ffd0ea',
      emissiveIntensity: 0.6,
      roughness: 0.1,
    });
    this.pearlMesh = instanced(new THREE.SphereGeometry(1, 16, 12), pearlMat, MAX_CLAM, { color: false });
    this.scene.add(this.clamBot, this.clamTop, this.pearlMesh);

    // 7. Hydrothermal Bubble Vents (`ventChimneyMesh` + `ventPlumeMesh`)
    const chimneyMat = patchStd(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.44,
        metalness: 0.16,
        normalMap: this.stoneNormalTex,
        normalScale: new THREE.Vector2(0.95, 0.95),
        side: THREE.DoubleSide,
      }),
      U,
      { caustic: 0.65, selfLit: { value: 0.14 }, key: 'ventchim' }
    );
    this.ventChimneyMesh = instanced(buildVentChimneyGeometry(rng), chimneyMat, MAX_VENT, { color: false });
    const vPlumeGeo = new THREE.PlaneGeometry(1, 1, 1, 12);
    vPlumeGeo.translate(0, 0.5, 0);
    this.ventPlumeMat = ventPlumeMaterial(U);
    this.ventPlumeMesh = instanced(vPlumeGeo, this.ventPlumeMat, MAX_VENT, { color: false });
    this.ventPlumeMesh.renderOrder = 7;
    this.scene.add(this.ventChimneyMesh, this.ventPlumeMesh);

    // 8. Bioluminescent Warp Cavern (`warp_cavern.glb` + Swirling Portal Throat)
    this.warpCavernGroup = new THREE.Group();
    this.warpCavernGroup.visible = false;
    {
      const procArch = new THREE.Group();
      const archMat = patchStd(
        new THREE.MeshStandardMaterial({
          color: '#0b1626',
          roughness: 0.42,
          metalness: 0.16,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.95, 0.95),
        }),
        U,
        {
          clip: true,
          caustic: 0.85,
          rim: { color: new THREE.Color('#38bdf8'), str: { value: 0.32 } },
          key: 'wproc_arch',
        }
      );
      const archGeo = new THREE.TorusGeometry(0.74, 0.25, 12, 26);
      {
        const ap = archGeo.attributes.position;
        for (let i = 0; i < ap.count; i++) {
          const x = ap.getX(i);
          const y = ap.getY(i);
          const z = ap.getZ(i);
          const a = Math.atan2(y, x);
          const crag = 1 + 0.13 * Math.sin(a * 5 + z * 6) + 0.08 * Math.cos(a * 9 - z * 4);
          ap.setXYZ(i, x * crag, y * crag, z * (0.9 + 0.2 * Math.sin(a * 7)));
        }
        archGeo.computeVertexNormals();
      }
      const archMesh = new THREE.Mesh(archGeo, archMat);
      procArch.add(archMesh);

      const crysAmMat = new THREE.MeshStandardMaterial({
        color: '#0369a1',
        emissive: '#38bdf8',
        emissiveIntensity: 1.15,
        roughness: 0.14,
      });
      const crysCyMat = new THREE.MeshStandardMaterial({
        color: '#0e7490',
        emissive: '#5efce8',
        emissiveIntensity: 1.35,
        roughness: 0.12,
      });
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + 0.2;
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), k % 2 === 0 ? crysAmMat : crysCyMat);
        shard.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0.08);
        shard.rotation.z = a + Math.PI * 0.5;
        procArch.add(shard);
      }
      this.warpProceduralArch = procArch;
      this.warpCavernGroup.add(procArch);

      this.warpPortalMat = portalVortexMaterial(U);
      this.warpPortalDisc = new THREE.Mesh(new THREE.CircleGeometry(0.56, 32), this.warpPortalMat);
      this.warpPortalDisc.position.z = -0.16;
      this.warpPortalDisc.renderOrder = 9;
      this.warpCavernGroup.add(this.warpPortalDisc);
    }
    this.scene.add(this.warpCavernGroup);

    // 9. Expanding 3D Abyssal Sonar Ping Wavefront
    this.sonarWaveMat = sonarWaveMaterial(U);
    this.sonarWaveMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), this.sonarWaveMat);
    this.sonarWaveMesh.visible = false;
    this.sonarWaveMesh.renderOrder = 13;
    this.scene.add(this.sonarWaveMesh);

    // 10. Additive Glows, 4-Point Glints, Silhouette Shades, Shockwave Rings & Wake Spray
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
    this.starMesh.renderOrder = 16;
    this.scene.add(this.starMesh);

    this.shadeMat = new THREE.MeshBasicMaterial({
      map: this.softDot,
      color: '#00060e',
      transparent: true,
      depthWrite: false,
      opacity: 0.34,
      toneMapped: false,
    });
    this.shadeMesh = instanced(new THREE.PlaneGeometry(1, 1), this.shadeMat, MAX_SHADE, { color: false });
    this.shadeMesh.renderOrder = 1;
    this.scene.add(this.shadeMesh);

    const ringTex = canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.62, 'rgba(255,255,255,0)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.88, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
    this.ringTex = ringTex;
    this.ringMesh = instanced(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: ringTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
      MAX_RING
    );
    this.ringMesh.renderOrder = 13;
    this.scene.add(this.ringMesh);

    // Wake bubbles, bioluminescent dinoflagellate sparks (`aBio = 1`), and surfacing spray (`aBio = 2`)
    const bubbleTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.08)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
      g.addColorStop(0.86, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(32, 32, 31, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(23, 22, 6, 0, TAU);
      ctx.fill();
    });
    this.bubbleTex = bubbleTex;
    this.wake = [];
    for (let i = 0; i < MAX_WAKE; i++) {
      this.wake.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0.1, g: 0.8, bio: 0 });
    }
    this._wakeIdx = 0;
    this._wakeAcc = 0;
    this._ventAcc = 0;
    const wg = new THREE.BufferGeometry();
    this.wakePos = new Float32Array(MAX_WAKE * 3);
    this.wakeSize = new Float32Array(MAX_WAKE);
    this.wakeAlpha = new Float32Array(MAX_WAKE);
    this.wakeBio = new Float32Array(MAX_WAKE);
    wg.setAttribute('position', new THREE.BufferAttribute(this.wakePos, 3).setUsage(THREE.DynamicDrawUsage));
    wg.setAttribute('aSize', new THREE.BufferAttribute(this.wakeSize, 1).setUsage(THREE.DynamicDrawUsage));
    wg.setAttribute('aAlpha', new THREE.BufferAttribute(this.wakeAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    wg.setAttribute('aBio', new THREE.BufferAttribute(this.wakeBio, 1).setUsage(THREE.DynamicDrawUsage));

    this.wakeMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: bubbleTex },
        uGlow: { value: this.softDot },
        uPx: { value: 600 },
        uColor: { value: new THREE.Color('#e6fbff') },
        uBioCol: U.uBioCol,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        uniform float uPx; attribute float aSize; attribute float aAlpha; attribute float aBio; varying float vA; varying float vB;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPx / max(-mv.z, 0.25) * (1.0 + min(aBio, 1.0) * 0.8);
          vA = aAlpha; vB = aBio;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform sampler2D uGlow; uniform vec3 uColor; uniform vec3 uBioCol; varying float vA; varying float vB;
        void main(){
          float ta = texture2D(uMap, gl_PointCoord).a;
          float ga = texture2D(uGlow, gl_PointCoord).a;
          float isSpray = step(1.5, vB);
          float isBio = step(0.5, vB) - isSpray;
          float isBub = 1.0 - isBio - isSpray;
          vec3 col = uColor * ta * isBub + uBioCol * ga * 1.3 * isBio + vec3(0.95, 0.98, 1.0) * ga * isSpray;
          gl_FragColor = vec4(col * vA, (ta * isBub + ga * 0.85 * isSpray) * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.wakePoints = new THREE.Points(wg, this.wakeMat);
    this.wakePoints.frustumCulled = false;
    this.wakePoints.renderOrder = 14;
    this.scene.add(this.wakePoints);
  }

  // ------------------------------------------------------------------ Build: Sunken Rubble & Rising Watchtower
  _buildTowers() {
    const U = this.U;
    const rng = mulberry32(99);
    // Real 3D curved beveled-block sunken Watchtower base with vaulted Romanesque arch & corbel ledge (zero painted grid cylinder!)
    const g = buildBeveledTowerRuin({ courses: 8, cols: 12, radius: 2.35, seed: 99 });
    const stoneTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#060915';
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 10; r++) {
          const rh = Math.floor(h / 10);
          const y0 = r * rh;
          let cx = -((r * 23) % 36);
          while (cx < w) {
            const bw = 26 + Math.floor(rng() * 22);
            const v = 88 + Math.floor(rng() * 44);
            const isMoss = rng() < 0.22;
            ctx.fillStyle = isMoss
              ? `rgb(${Math.floor(v * 0.52)},${Math.floor(v * 0.92)},${Math.floor(v * 0.62)})`
              : `rgb(${v},${v + 8},${v + 38})`;
            ctx.fillRect(cx + 2, y0 + 2, bw - 3.5, rh - 3.5);
            ctx.fillStyle = 'rgba(214,236,255,0.28)';
            ctx.fillRect(cx + 2, y0 + 2, bw - 3.5, 2);
            ctx.fillStyle = 'rgba(3,6,18,0.72)';
            ctx.fillRect(cx + 2, y0 + rh - 3.5, bw - 3.5, 2.2);
            cx += bw;
          }
        }
      },
      { repeat: true }
    );
    stoneTex.repeat.set(3, 2);
    this.stoneTex = stoneTex;
    const rubbleMat = patchStd(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        map: stoneTex,
        normalMap: this.stoneNormalTex,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughness: 0.56,
        metalness: 0.1,
        side: THREE.DoubleSide,
        color: '#bdd2f0',
        emissive: '#0c162b',
      }),
      U,
      { caustic: 0.92, key: 'rubble' }
    );
    this.rubble = new THREE.Mesh(g, rubbleMat);
    this.rubble.scale.set(1.08, 6.2, 1.08);
    this.rubble.rotation.set(0.04, 0.22, 0.08);
    this.scene.add(this.rubble);

    const bg = new THREE.BoxGeometry(1, 0.68, 0.88);
    {
      const bp = bg.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        if (bp.getY(i) > 0) {
          bp.setX(i, bp.getX(i) * 0.9);
          bp.setZ(i, bp.getZ(i) * 0.9);
        }
      }
      bg.computeVertexNormals();
    }
    this.blocks = instanced(
      bg,
      patchStd(
        new THREE.MeshStandardMaterial({
          map: stoneTex,
          normalMap: this.stoneNormalTex,
          normalScale: new THREE.Vector2(0.9, 0.9),
          roughness: 0.56,
          metalness: 0.1,
          color: '#aac0e0',
          emissive: '#0a1326',
        }),
        U,
        { caustic: 0.85, key: 'blocks' }
      ),
      9,
      { color: false }
    );
    this.blockItems = [];
    for (let i = 0; i < 9; i++) {
      this.blockItems.push({
        ox: lerp(-4.5, 5.5, rng()),
        z: RUBBLE_Z + lerp(-2, 3.5, rng()),
        s: lerp(0.6, 1.3, rng()),
        r: [rng() * TAU, rng() * TAU, rng() * TAU],
      });
    }
    this.blocks.count = 9;
    this.scene.add(this.blocks);

    // Rising destination Watchtower (finely-chiseled damp slate-indigo courses, moss/barnacles, stone lintels & mist-lit portals)
    const towerTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#060916';
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 12; r++) {
          const rh = h / 12;
          const y0 = r * rh;
          const isBelt = r === 11;
          let cx = -((r * 29) % 42);
          while (cx < w) {
            const bw = isBelt ? 36 : 22 + Math.floor(rng() * 24);
            const v = (isBelt ? 104 : 78) + Math.floor(rng() * 36);
            const moss = !isBelt && rng() < 0.18;
            ctx.fillStyle = moss
              ? `rgb(${Math.floor(v * 0.52)},${Math.floor(v * 0.9)},${Math.floor(v * 0.58)})`
              : `rgb(${v},${v + 7},${v + 38})`;
            ctx.fillRect(cx + 1.5, y0 + 1.5, bw - 3, rh - 3);
            ctx.fillStyle = isBelt ? 'rgba(226,240,255,0.34)' : 'rgba(196,225,255,0.22)';
            ctx.fillRect(cx + 1.5, y0 + 1.5, bw - 3, 1.8);
            ctx.fillStyle = 'rgba(3,6,16,0.75)';
            ctx.fillRect(cx + 1.5, y0 + rh - 2.8, bw - 3, 2.0);
            cx += bw;
          }
        }
        // Thick weathered grey ashlar stone doorway lintel & jambs surrounding recessed portal
        ctx.fillStyle = '#7382a3';
        ctx.fillRect(80, 92, 96, 16);
        ctx.fillRect(82, 106, 14, 78);
        ctx.fillRect(160, 106, 14, 78);
        ctx.strokeStyle = '#060916';
        ctx.lineWidth = 2;
        ctx.strokeRect(80, 92, 96, 16);
        // Mist-lit dark stone interior passage (never cartoon 4-pane window!)
        const pg = ctx.createLinearGradient(0, 106, 0, 184);
        pg.addColorStop(0, '#10182b');
        pg.addColorStop(0.55, '#1d2d47');
        pg.addColorStop(1, '#263b59');
        ctx.fillStyle = pg;
        ctx.fillRect(96, 108, 64, 76);
      },
      { repeat: true }
    );
    const winTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        // Subtle volumetric sea-mist & lantern glow inside recessed stone doorway (zero horizontal neon band!)
        const g2 = ctx.createRadialGradient(128, 152, 6, 128, 144, 48);
        g2.addColorStop(0, 'rgba(215,242,255,0.85)');
        g2.addColorStop(0.55, 'rgba(110,175,215,0.42)');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(96, 108, 64, 76);
      },
      { repeat: true }
    );
    this.towerTex = towerTex;
    this.winTex = winTex;
    const towerParts = [];
    const tgShaft = new THREE.CylinderGeometry(0.96, 1.02, 1, 48, 1, true);
    tgShaft.translate(0, 0.5, 0);
    towerParts.push(tgShaft);
    // 3D overhanging Romanesque stone corbel ring walkways along the rising Watchtower silhouette
    for (let li = 0; li < 6; li++) {
      const ly = 0.055 + li * 0.145;
      const tR = lerp(1.02, 0.96, ly);
      const slab = new THREE.CylinderGeometry(tR * 1.13, tR * 1.11, 0.011, 36, 1, false);
      slab.translate(0, ly, 0);
      const corb = new THREE.CylinderGeometry(tR * 1.1, tR * 1.01, 0.018, 36, 1, true);
      corb.translate(0, ly - 0.013, 0);
      towerParts.push(slab, corb);
    }
    const tg = merge(towerParts);
    this.towerMat = patchStd(
      new THREE.MeshStandardMaterial({
        map: towerTex,
        normalMap: this.stoneNormalTex,
        normalScale: new THREE.Vector2(0.95, 0.95),
        emissiveMap: winTex,
        emissive: new THREE.Color('#7dd3fc'),
        emissiveIntensity: 0.85,
        roughness: 0.64,
        metalness: 0.1,
      }),
      U,
      { airFog: true, caustic: 0.72, key: 'tower' }
    );
    this.nextTower = new THREE.Mesh(tg, this.towerMat);
    this.nextTower.visible = false;
    this.scene.add(this.nextTower);

    const baseG = new THREE.CylinderGeometry(1.12, 1.25, 0.6, 56, 1, false);
    baseG.translate(0, 0.3, 0);
    this.towerBase = new THREE.Mesh(
      baseG,
      new THREE.MeshStandardMaterial({
        color: '#1b2038',
        normalMap: this.stoneNormalTex,
        roughness: 0.42,
        metalness: 0.12,
        emissive: '#000000',
      })
    );
    this.towerBase.visible = false;
    this.scene.add(this.towerBase);
  }

  // ------------------------------------------------------------------ Build: Overlay (Vignette, Waterline, HUD, Popups, Card)
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
        uColor: { value: new THREE.Color('#020712') },
        uStr: { value: 0.48 },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color('#ff3d6e') },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uStr; uniform float uFlash; uniform vec3 uFlashColor; varying vec2 vUv;
        void main(){
          vec2 q = vUv - 0.5; q.x *= 0.85;
          float v = smoothstep(0.32, 0.75, length(q));
          float a = v * uStr;
          vec3 col = mix(uColor, uFlashColor, uFlash * v);
          gl_FragColor = vec4(col, clamp(a + uFlash * v * 0.6, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
    });
    this.vignette = new THREE.Mesh(quad, this.vigMat);
    this.vignette.renderOrder = 0;
    this.overlay.add(this.vignette);

    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uLineY: { value: 0 },
        uSize: { value: new THREE.Vector2(390, 620) },
        uTime: this.U.uTime,
        uAlpha: { value: 0 },
        uTint: { value: new THREE.Color('#071a2d') },
        uFoam: { value: new THREE.Color('#eafcff') },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uLineY; uniform vec2 uSize; uniform float uTime; uniform float uAlpha; uniform vec3 uTint; uniform vec3 uFoam;
        varying vec2 vUv;
        void main(){
          vec2 px = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
          float wl = uLineY + sin(px.x * 0.045 + uTime * 1.7) * 2.2 + sin(px.x * 0.11 - uTime * 2.3) * 1.1 + sin(px.x * 0.021 + uTime * 0.6) * 3.0;
          float d = px.y - wl;
          float line = exp(-d * d * 0.3);
          float below = d > 0.0 ? exp(-d * 0.08) : exp(d * 0.5) * 0.4;
          float tint = d > 0.0 ? 0.24 + 0.18 * smoothstep(0.0, 160.0, d) : 0.0;
          vec3 col = uFoam * (line * 0.95 + below * 0.22) + uTint * tint;
          gl_FragColor = vec4(col * uAlpha, tint * uAlpha);
          #include <colorspace_fragment>
        }`,
    });
    this.waterline = new THREE.Mesh(quad, this.waterMat);
    this.waterline.renderOrder = 1;
    this.waterline.visible = false;
    this.overlay.add(this.waterline);

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
      const m = new THREE.Mesh(quad, basic({ map: this.softDot }));
      m.visible = false;
      m.renderOrder = 3;
      this.fxGroup.add(m);
      this.popPool.push(m);
    }

    // Sea Progress HUD
    this.hudGroup = new THREE.Group();
    this.overlay.add(this.hudGroup);
    if (typeof document !== 'undefined') {
      this._hudCanvas = document.createElement('canvas');
      this._hudTex = new THREE.CanvasTexture(this._hudCanvas);
      this._hudTex.colorSpace = THREE.SRGBColorSpace;
    } else {
      this._hudCanvas = null;
      this._hudTex = this.softDot;
    }
    this.hudPanel = new THREE.Mesh(quad, basic({ map: this._hudTex }));
    this.hudPanel.renderOrder = 5;
    this.hudFill = new THREE.Mesh(
      quad,
      basic({
        map: canvasTex(256, 16, (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, w, 0);
          g.addColorStop(0, '#2dd4ff');
          g.addColorStop(0.7, '#9ff6ff');
          g.addColorStop(1, '#ffffff');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(0, 3, w, 3);
        }),
      })
    );
    this.hudFill.renderOrder = 6;
    this.hudHead = new THREE.Mesh(quad, basic({ map: this.softDot, color: '#bff6ff', blending: THREE.AdditiveBlending }));
    this.hudHead.renderOrder = 7;
    this.hudMarker = new THREE.Mesh(quad, basic({ map: this.softDot }));
    this.hudMarker.renderOrder = 8;
    this._redrawHudMarker();
    this.hudGroup.add(this.hudPanel, this.hudFill, this.hudHead, this.hudMarker);
    this._hudDrawn = null;
    this._dispBonus = 0;

    // Combo ring
    this.comboMat = new THREE.ShaderMaterial({
      uniforms: { uProg: { value: 1 }, uCol: { value: new THREE.Color('#f472b6') }, uAlpha: { value: 0 } },
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
          float a = disk * 0.74;
          col = mix(col, mix(vec3(0.16, 0.22, 0.32), uCol * 1.25, on), ring);
          a = max(a, ring * (0.55 + 0.45 * on));
          float halo = exp(-abs(r - 0.88) * 9.0) * (1.0 - disk) * on * 0.55;
          col += uCol * halo;
          a = max(a, halo * 0.6);
          gl_FragColor = vec4(col, a * uAlpha);
          #include <colorspace_fragment>
        }`,
    });
    this.comboRing = new THREE.Mesh(quad, this.comboMat);
    this.comboRing.renderOrder = 6;
    this.comboText = new THREE.Mesh(quad, basic({ map: this.softDot }));
    this.comboText.renderOrder = 7;
    this.comboRing.visible = false;
    this.comboText.visible = false;
    this.overlay.add(this.comboRing, this.comboText);
    this._comboTex = [];
    this._comboCols = ['#f472b6', '#fb923c', '#fde047'].map((h) => new THREE.Color(h));
    this._comboAlpha = 0;
    this._comboShown = 0;

    // Cinematic letterbox + arrival card
    this.lbTop = new THREE.Mesh(quad, basic({ color: '#000000', opacity: 0.94 }));
    this.lbBot = new THREE.Mesh(quad, basic({ color: '#000000', opacity: 0.94 }));
    this.lbTop.renderOrder = 9;
    this.lbBot.renderOrder = 9;
    this.lbTop.visible = false;
    this.lbBot.visible = false;
    this.overlay.add(this.lbTop, this.lbBot);
    if (typeof document !== 'undefined') {
      this._cardCanvas = document.createElement('canvas');
      this._cardTex = new THREE.CanvasTexture(this._cardCanvas);
      this._cardTex.colorSpace = THREE.SRGBColorSpace;
    } else {
      this._cardCanvas = null;
      this._cardTex = this.softDot;
    }
    this.card = new THREE.Mesh(quad, basic({ map: this._cardTex }));
    this.card.renderOrder = 10;
    this.card.visible = false;
    this.overlay.add(this.card);
    this._cardForW = 0;
    this._cardShown = -1;
    this._cardT0 = -1;
  }

  _redrawHudMarker() {
    if (!this.hudMarker) return;
    const isOrig = this.era === 'original';
    const skin = SKIN_MAP.get(this.skinId) || POGO_SKINS[0];
    const tex = canvasTex(96, 64, (ctx) => {
      ctx.translate(48, 34);
      ctx.lineJoin = 'round';
      if (isOrig) {
        ctx.fillStyle = '#ffc21f';
        ctx.strokeStyle = '#2a1c03';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 4, 28, 13, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e5322d';
        ctx.beginPath();
        ctx.moveTo(-26, 4);
        ctx.lineTo(-38, -6);
        ctx.lineTo(-38, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(160,240,255,0.85)';
        ctx.beginPath();
        ctx.arc(4, -8, 12, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Sleek Titanium & Brass Manta-Sub silhouette + Pogo in front glass dome!
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#5efce8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(28, 2);
        ctx.quadraticCurveTo(8, -14, -32, -5);
        ctx.lineTo(-24, 3);
        ctx.lineTo(-34, 11);
        ctx.quadraticCurveTo(6, 15, 28, 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(165,243,252,0.5)';
        ctx.beginPath();
        ctx.arc(13, 2, 11, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.fill();
        ctx.fillStyle = skin.bodyColor || '#56b847';
        ctx.beginPath();
        ctx.arc(12, 1, 5.5, 0, TAU);
        ctx.fill();
      }
    });
    if (this._markerTex) this._markerTex.dispose();
    this._markerTex = tex;
    this.hudMarker.material.map = tex;
    this.hudMarker.material.needsUpdate = true;
  }

  _font(weight, px) {
    return `${weight} ${px}px Orbitron, "Arial Black", "Segoe UI", sans-serif`;
  }

  _fishGlyph(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 7 * s, 4.6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 5.5 * s, y);
    ctx.lineTo(x + 11 * s, y - 5 * s);
    ctx.lineTo(x + 11 * s, y + 5 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0b1226';
    ctx.beginPath();
    ctx.arc(x - 3.4 * s, y - 1 * s, 1.3 * s, 0, TAU);
    ctx.fill();
  }

  _pearlGlyph(ctx, x, y, s) {
    const g = ctx.createRadialGradient(x - 1.8 * s, y - 2 * s, 0.5, x, y, 6 * s);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#ffe4f3');
    g.addColorStop(1, '#d9a6c6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 5.6 * s, 0, TAU);
    ctx.fill();
  }

  _txt(ctx, s, x, y, color, align = 'left', stroke = 3.5) {
    ctx.textAlign = align;
    ctx.lineWidth = stroke;
    ctx.strokeStyle = 'rgba(2,6,16,0.8)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  _drawHud(stage, dt) {
    if (!this._hudCanvas || !this.showHud) return;
    const target = stage.bonus || 0;
    let disp = this._dispBonus;
    if (disp !== target) {
      disp += (target - disp) * Math.min(1, dt * 7);
      if (Math.abs(target - disp) < 1) disp = target;
      this._dispBonus = disp;
    }
    const bonus = Math.round(disp);
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const W = this.width;
    const fish = stage.fishCaught || 0;
    const pearls = stage.pearls || 0;
    const dist = Math.max(0, Math.round((1 - clamp(stage.progress || 0, 0, 1)) * 48)) * 10;
    const glow = stage.nextGlow || '#38bdf8';
    let d = this._hudDrawn;
    if (
      d &&
      d.W === W &&
      d.pr === pr &&
      d.fish === fish &&
      d.pearls === pearls &&
      d.bonus === bonus &&
      d.dist === dist &&
      d.glow === glow
    ) {
      return;
    }
    if (!d) d = this._hudDrawn = { W: 0, pr: 0, fish: -1, pearls: -1, bonus: -1, dist: -1, glow: '' };
    const sizeChanged = d.W !== W || d.pr !== pr;
    d.W = W;
    d.pr = pr;
    d.fish = fish;
    d.pearls = pearls;
    d.bonus = bonus;
    d.dist = dist;
    d.glow = glow;
    const H = 64;
    const c = this._hudCanvas;
    const cw = Math.round(W * pr);
    const ch = Math.round(H * pr);
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
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 6, 0, 58);
    g.addColorStop(0, 'rgba(10,24,46,0.72)');
    g.addColorStop(1, 'rgba(4,10,24,0.64)');
    ctx.fillStyle = g;
    this._roundRect(ctx, 8, 6, W - 16, 52, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,235,255,0.34)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    this._fishGlyph(ctx, 24, 23, 1.05, '#38bdf8');
    ctx.font = this._font(800, 15);
    this._txt(ctx, `${fish}`, 40, 23.5, '#e8fbff');
    const px = 40 + Math.max(22, ctx.measureText(`${fish}`).width + 14);
    this._pearlGlyph(ctx, px + 6, 23, 1);
    this._txt(ctx, `${pearls}`, px + 16, 23.5, '#ffe4f3');
    ctx.font = this._font(700, 7.5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    this._txt(ctx, 'NEXT TOWER', W / 2, 16, 'rgba(160,240,255,0.85)', 'center', 0);
    ctx.font = this._font(800, 12);
    this._txt(ctx, `${dist} M`, W / 2, 29, '#e8fbff', 'center');
    ctx.font = this._font(700, 7.5);
    this._txt(ctx, 'SEA BONUS', W - 22, 16, 'rgba(255,214,120,0.9)', 'right', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = this._font(900, 15);
    this._txt(ctx, bonus.toLocaleString('en-US'), W - 22, 30, '#ffd66b', 'right');
    const x0 = 36;
    const x1 = W - 52;
    const y = 46;
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    this._roundRect(ctx, x0 - 2, y - 4, x1 - x0 + 4, 8, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,240,255,0.3)';
    ctx.stroke();
    for (let k = 1; k < 8; k++) {
      ctx.fillStyle = 'rgba(160,240,255,0.22)';
      ctx.fillRect(x0 + ((x1 - x0) * k) / 8 - 0.5, y - 2, 1, 4);
    }
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(16, 54);
    ctx.lineTo(16, 42);
    ctx.lineTo(19, 44);
    ctx.lineTo(22, 38);
    ctx.lineTo(25, 43);
    ctx.lineTo(28, 40);
    ctx.lineTo(28, 54);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#1a2036';
    ctx.fillRect(W - 42, 35, 14, 21);
    ctx.fillStyle = glow;
    ctx.fillRect(W - 39, 39, 3, 4);
    ctx.fillRect(W - 34, 39, 3, 4);
    ctx.fillRect(W - 39, 47, 3, 4);
    ctx.fillRect(W - 34, 47, 3, 4);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(W - 42, 35, 14, 21);
    this._hudTex.needsUpdate = true;
    this.hudPanel.scale.set(W, H, 1);
    this.hudPanel.position.set(W / 2, -H / 2, 0);
    this._trackX0 = x0;
    this._trackX1 = x1;
    this._trackY = y;
  }

  _comboTexFor(mult) {
    let t = this._comboTex[mult];
    if (t) return t;
    const col = mult >= 4 ? '#fde047' : mult === 3 ? '#fb923c' : '#f472b6';
    t = canvasTex(128, 128, (ctx) => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = this._font(900, 46);
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(2,6,16,0.9)';
      ctx.strokeText(`x${mult}`, 64, 58);
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.fillStyle = col;
      ctx.fillText(`x${mult}`, 64, 58);
      ctx.shadowBlur = 0;
      ctx.font = this._font(800, 15);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('COMBO', 66, 92);
    });
    this._comboTex[mult] = t;
    return t;
  }

  _drawCard(stage, shownBonus) {
    if (!this._cardCanvas) return;
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const W = Math.min(this.width - 36, 330);
    const H = 150;
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
    const glow = stage.nextGlow || '#38bdf8';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(12,24,48,0.9)');
    g.addColorStop(1, 'rgba(4,9,22,0.92)');
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = g;
    this._roundRect(ctx, 6, 6, W - 12, H - 12, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = this._font(800, 10);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    this._txt(ctx, stage.perfect ? 'PERFECT RIDE' : 'RIDE COMPLETE', W / 2, 24, stage.perfect ? '#fde047' : '#ffb800', 'center', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const cols = [
      [stage.fishCaught || 0, 'FISH', 'fish'],
      [stage.pearls || 0, 'PEARLS', 'pearl'],
      [stage.jelliesPopped || 0, 'JELLIES', 'jelly'],
      [stage.nearMisses || 0, 'CLOSE CALLS', 'close'],
    ];
    const cw4 = (W - 24) / 4;
    for (let i = 0; i < 4; i++) {
      const cx = 12 + cw4 * (i + 0.5);
      const [val, label, icon] = cols[i];
      if (icon === 'fish') this._fishGlyph(ctx, cx - 16, 52, 0.9, '#38bdf8');
      else if (icon === 'pearl') this._pearlGlyph(ctx, cx - 16, 52, 0.95);
      else if (icon === 'jelly') {
        ctx.fillStyle = '#e879f9';
        ctx.beginPath();
        ctx.arc(cx - 16, 53, 6, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(cx - 21, 53, 2, 6);
        ctx.fillRect(cx - 17, 53, 2, 7);
        ctx.fillRect(cx - 13, 53, 2, 5);
      } else {
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(cx - 24 + k * 3, 48 + k * 4);
          ctx.lineTo(cx - 10 + k * 3, 48 + k * 4);
          ctx.stroke();
        }
      }
      ctx.font = this._font(900, 16);
      this._txt(ctx, `${val}`, cx - 4, 53, '#ffffff', 'left');
      ctx.font = this._font(700, 7.5);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
      this._txt(ctx, label, cx, 72, 'rgba(160,240,255,0.8)', 'center', 0);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.strokeStyle = 'rgba(160,240,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 88);
    ctx.lineTo(W - 22, 88);
    ctx.stroke();
    ctx.font = this._font(800, 9);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    this._txt(ctx, 'SEA BONUS', 24, 116, 'rgba(255,214,120,0.95)', 'left', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = this._font(900, 24);
    ctx.shadowColor = '#ffb800';
    ctx.shadowBlur = 10;
    this._txt(ctx, `+${shownBonus.toLocaleString('en-US')}`, W - 24, 116, '#ffd66b', 'right', 5);
    ctx.shadowBlur = 0;
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
    if (typeof document === 'undefined') {
      e = { tex: this.softDot, aspect: 4, used: this._popFrame, text, color };
      this._popCache.set(key, e);
      return e;
    }
    const fs = 44;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const font = `900 ${fs}px Orbitron, "Arial Black", Impact, sans-serif`;
    ctx.font = font;
    const tw = Math.ceil(ctx.measureText(text).width);
    c.width = tw + 36;
    c.height = Math.ceil(fs * 1.55);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(4,8,22,0.9)';
    ctx.strokeText(text, c.width / 2, c.height / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, c.height / 2);
    ctx.shadowBlur = 0;
    const hi = ctx.createLinearGradient(0, c.height * 0.2, 0, c.height * 0.6);
    hi.addColorStop(0, 'rgba(255,255,255,0.55)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillText(text, c.width / 2, c.height / 2 - 2);
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

  // ------------------------------------------------------------------ Palette & Healing Atmosphere
  _applyHealing(h) {
    this._heal = h;
    this._healEra = this.era;
    const isOrig = this.era === 'original';
    const palSrc = isOrig ? PAL_ORIG : PAL_REBOOT;
    const C = this.colors;
    const U = this.U;

    // In Reboot Mode, even at h = 0 (World 1 / Tower 1), keep rich moonlit caustics, shafts, kelp & boid life!
    const visH = isOrig ? h : lerp(0.45, 1.0, h);
    for (const k in palSrc) mix3(C[k], palSrc[k], h);

    this.fogColor.copy(C.fog);
    this.scene.fog.color.copy(C.fog);
    U.uFogFar.value = CAM_Z + (isOrig ? lerp(22, 76, h) : lerp(54, 82, h));
    U.uFogNear.value = isOrig ? CAM_Z - 0.5 : CAM_Z + 3.5;
    this.scene.fog.near = U.uFogNear.value;
    this.scene.fog.far = U.uFogFar.value;
    this.hemi.color.copy(C.hemiSky);
    this.hemi.groundColor.copy(C.hemiGround);
    this.hemi.intensity = isOrig ? lerp(1.3, 2.1, h) : lerp(1.45, 1.95, h);
    this.sun.color.copy(C.sun);
    this.sun.intensity = isOrig ? lerp(0.75, 2.6, h) : lerp(1.5, 2.25, h);
    this.back.intensity = lerp(0.85, 1.15, h);
    this.back.color.set(isOrig ? (h < 0.4 ? '#8a7cff' : '#7ee8ff') : '#5efce8');

    const bu = this.bedMat.uniforms;
    bu.uSandA.value.copy(C.sandA);
    bu.uSandB.value.copy(C.sandB);
    bu.uCausticColor.value.copy(C.caustic);
    bu.uCaustic.value = isOrig ? lerp(0.12, 0.8, h) : lerp(0.58, 0.92, h);
    bu.uToxic.value.copy(C.toxic);
    bu.uToxicAmt.value = isOrig ? Math.pow(1 - h, 1.4) : Math.pow(1 - h, 1.8) * 0.45;
    U.uCausticStr.value = isOrig ? lerp(0.1, 0.95, h) : lerp(0.62, 0.98, h);
    U.uCausticCol.value.copy(C.caustic);
    U.uBio.value = isOrig ? Math.pow(1 - h, 1.3) : lerp(0.85, 0.4, h);
    U.uBioCol.value.set(isOrig ? '#45f0ff' : '#5efce8').lerp(this._c2.set('#c8fff4'), h * 0.6);

    const su = this.surfMat.uniforms;
    su.uSurf.value.copy(C.surf);
    su.uSurfHi.value.copy(C.surfHi);
    su.uDeep.value.copy(C.surfDeep);
    su.uSunCol.value.copy(C.surfSun).multiplyScalar(isOrig ? lerp(0.35, 1.0, h) : lerp(0.75, 1.0, h));
    su.uIsOrig.value = isOrig ? 1 : 0;

    this.rayMat.uniforms.uColor.value.copy(C.ray);
    this.rayMat.uniforms.uStr.value = isOrig ? lerp(0.1, 0.55, h) : lerp(0.28, 0.42, h);

    const sn = this.snowMat.uniforms;
    sn.uColor.value.copy(C.snow);
    sn.uColor2.value.copy(C.bio);
    sn.uAlpha.value = lerp(0.95, 0.65, h);
    sn.uTwinkle.value = lerp(0.68, 0.35, h);

    const bd = this.backdropMat.uniforms;
    bd.uSkyTop.value.copy(C.skyTop);
    bd.uSkyHor.value.copy(C.skyHor);
    bd.uSunCol.value.copy(C.skySun);
    bd.uHeal.value = h;
    bd.uMoonMode.value = isOrig ? 0 : 1;

    this.canopyMat.uniforms.uTint.value.copy(C.glass);
    this.canopyMat.uniforms.uSky.value.copy(C.surfHi);
    this.rebootDomeMat.uniforms.uTint.value.copy(C.glass);
    this.rebootDomeMat.uniforms.uSky.value.copy(C.surfHi);
    this.waterMat.uniforms.uTint.value.copy(C.fog);
    this.vigMat.uniforms.uColor.value.copy(C.vignette);
    this.vigMat.uniforms.uStr.value = isOrig ? lerp(0.5, 0.32, h) : lerp(0.52, 0.38, h);
    this._coralRim.value = lerp(0.16, 0.32, visH);
    this.shadeMat.opacity = lerp(0.2, 0.42, visH);
    this.subLit.value = lerp(0.06, 0.02, visH);

    const c = this._c;
    const tint = (layer, base, k = 1) => {
      for (let i = 0; i < layer.items.length; i++) {
        c.copy(base).multiplyScalar((layer.items[i].shade || 1) * k);
        layer.mesh.setColorAt(i, c);
      }
      layer.mesh.instanceColor.needsUpdate = true;
      layer.mesh.count = layer.items.length;
    };
    tint(this.farLayer, C.far, isOrig ? 1.0 : 1.38);
    if (this.aqueductLayer) tint(this.aqueductLayer, C.far, isOrig ? 1.15 : 1.68);
    tint(this.ruinLayer, C.far, isOrig ? 1.32 : 1.88);
    tint(this.rockLayer, C.rock, 1.16);

    const coralFrac = 0.55 + 0.45 * visH;
    for (let li = 0; li < this._lushLayers.length; li++) {
      const layer = this._lushLayers[li];
      const glowAttr = layer.mesh.geometry.attributes.aGlow;
      const isKelp = layer === this.kelpLayer || layer === this.backKelpLayer;
      const isBack = layer === this.backKelpLayer;
      for (let i = 0; i < layer.items.length; i++) {
        const it = layer.items[i];
        const targetLush = isKelp ? it.lush : isOrig ? it.lushOrig || it.lush : it.lushReboot || it.lush;
        c.lerpColors(it.dead, targetLush, isKelp ? Math.min(1, visH * 1.3) : visH);
        if (it.fg) c.multiplyScalar(0.55);
        if (isBack) c.lerp(C.far, 0.42).multiplyScalar(0.85);
        layer.mesh.setColorAt(i, c);
        glowAttr.array[i] = isKelp ? it.glow * visH : it.glow * visH * (it.fg ? 0.4 : 1);
        if (isKelp) it.kScale = lerp(isBack ? 0.68 : 0.58, 1, visH);
      }
      glowAttr.needsUpdate = true;
      layer.mesh.instanceColor.needsUpdate = true;
      layer.visibleFrac = isBack ? 0.65 + 0.35 * visH : isKelp ? 0.62 + 0.38 * visH : coralFrac;
      layer.mesh.count = Math.max(1, Math.round(layer.items.length * layer.visibleFrac));
    }
    this._composeLayer(this.kelpLayer);
    this._composeLayer(this.backKelpLayer);
    this.barrelLayer.mesh.count = Math.round(this.barrelLayer.items.length * clamp((0.75 - h) / 0.75, 0, 1));
    for (let i = 0; i < this.barrelLayer.items.length; i++) this.barrelLayer.mesh.setColorAt(i, this._white);
    this.barrelLayer.mesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Glow & Sprite Batch Helpers
  _glowBegin() {
    this._sN = 0;
    this._gN = 0;
    this._tN = 0;
  }
  _glow(x, y, z, size, r, g, b, sy = size) {
    if (this._gN >= MAX_GLOW) return;
    const i = this._gN++;
    const m = this.glowMesh.instanceMatrix.array;
    const o = i * 16;
    m[o] = size;
    m[o + 1] = 0;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = sy;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = 1;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    const c = this.glowMesh.instanceColor.array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }
  _star(x, y, z, size, rot, r, g, b) {
    if (this._tN >= MAX_STAR || size <= 0) return;
    const i = this._tN++;
    const m = this.starMesh.instanceMatrix.array;
    const o = i * 16;
    const cs = Math.cos(rot) * size;
    const sn = Math.sin(rot) * size;
    m[o] = cs;
    m[o + 1] = sn;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = -sn;
    m[o + 5] = cs;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = 1;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    const c = this.starMesh.instanceColor.array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }
  _shade(x, y, size, sy = size) {
    if (this._sN >= MAX_SHADE) return;
    const o = this._sN++ * 16;
    const m = this.shadeMesh.instanceMatrix.array;
    m.fill(0, o, o + 16);
    m[o] = size;
    m[o + 5] = sy;
    m[o + 10] = 1;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = -0.9;
    m[o + 15] = 1;
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

  // ------------------------------------------------------------------ Main Render Entry Point
  _resetRide(stage) {
    this._stageRef = stage;
    for (let i = 0; i < MAX_WAKE; i++) this.wake[i].life = 0;
    const vfx = stage.vfx || EMPTY;
    this._lastVfxId = vfx.length ? vfx[vfx.length - 1].id : 0;
    const sub = stage.sub || {};
    this._lastShots = sub.shots || 0;
    this._lastCatches = sub.catches || 0;
    this._lastHits = stage.hits || 0;
    this._sq = 0;
    this._sqV = 0;
    this._recoil = 0;
    this._cheer = 0;
    this._dispBonus = stage.bonus || 0;
    this._camFX = 0;
    this._camFY = 0;
    this._cardShown = -1;
    this._cardT0 = -1;
    this._comboAlpha = 0;
  }

  /**
   * Renders EITHER a `SubStage` instance, `game.js`'s `state.sub`, OR a full `RenderState`.
   * Strictly saves and restores all `WebGLRenderer` state (`renderTarget`, `autoClear`,
   * `toneMapping`, `toneMappingExposure`) with zero per-frame allocations!
   */
  render(stageOrSubOrState, opts = {}) {
    const resolved = this._resolveRenderArgs(stageOrSubOrState, opts);
    if (!resolved) return;
    const { stage, time, particles, popups, shake } = resolved;
    const gl = this.gl;
    if (!gl) return;

    if (this._needsCompile) {
      this._needsCompile = false;
      try {
        gl.compile(this.scene, this.camera);
        gl.compile(this.overlay, this.oCam);
      } catch {
        // Fallback to lazy compile
      }
    }

    const dt = this._lastTime === null ? 1 / 60 : clamp(time - this._lastTime, 0, 0.05);
    this._lastTime = time;
    this._kx = stage.width ? this.width / stage.width : 1;
    this._ky = stage.height ? this.height / stage.height : 1;
    const U = this.U;
    U.uTime.value = time;
    if (stage !== this._stageRef || (stage.t || 0) < this._lastStageT - 0.5) this._resetRide(stage);
    this._lastStageT = stage.t || 0;
    const h = clamp(stage.healing ?? (this.era === 'original' ? 0.85 : 0.45), 0, 1);
    if (Math.abs(h - this._heal) > 0.0005 || this._healEra !== this.era) this._applyHealing(h);

    const pxw = this._pxw(0) * this._kx;
    const scrollW = (stage.scroll || 0) * pxw;
    U.uScrollW.value = scrollW;
    const v = this._v;
    const seabedW = this._toWorld(0, stage.seabedY ?? stage.height * 0.905, 0, v).y;
    const surfW = this._toWorld(0, stage.surfaceY ?? stage.height * 0.095, 0, v).y;
    this._seabedW = seabedW;
    this._surfW = surfW;
    U.uSurfY.value = surfW;
    U.uSeabedY.value = seabedW;
    this.seabed.position.y = seabedW;
    this.surface.position.y = surfW + 0.15;
    this.snowMat.uniforms.uYmin.value = seabedW - 1;
    this.snowMat.uniforms.uYmax.value = surfW + 1;
    const pr = gl.getPixelRatio ? gl.getPixelRatio() : 1;
    const focal = (this.height * pr) / (2 * Math.tan(FOV * 0.5 * DEG));
    this.snowMat.uniforms.uPx.value = focal;
    this.wakeMat.uniforms.uPx.value = focal;

    const mag = (Number(typeof shake === 'object' ? Math.hypot(shake.x || 0, shake.y || 0) : shake) || 0) * 0.022;
    this._updateCamera(stage, time, dt, mag);
    const cine = this._cine;
    const surfA = 1 - smooth01((cine - 0.7) / 0.22);
    this.surfMat.uniforms.uAlpha.value = surfA;
    this.surface.visible = surfA > 0.01;

    this._updateLayers(scrollW, seabedW);
    this._updateRays(scrollW, surfW, time);

    this._glowBegin();
    this._updateCoralGlows(h, time);
    this._updateTowers(stage, scrollW, seabedW, surfW, time);
    this._updateVentsAndWarpCavern(stage, time, pxw, seabedW, surfW);
    this._updateSub(stage, time, dt, pxw);
    this._updateFishAndGears(stage, time, pxw);
    this._updateAmbient(stage, time, dt, scrollW, seabedW, surfW, h);
    this._updateShellsAndTorpedoes(stage, time, pxw);
    this._updateJellies(stage, time, pxw);
    this._updateMines(stage, time, pxw, seabedW);
    this._updateClams(stage, time, pxw, seabedW, h);
    this._updateSonarWave(stage, pxw);
    this._updateRings(stage, pxw);
    this._updateVfx(stage, time, pxw);
    this._updateWake(stage, dt, seabedW, surfW, h);
    this._glowEnd();

    // Overlay pass
    this._popFrame++;
    this._updateFxGroup(stage);
    this._drawHud(stage, dt);
    this._updateHud(stage, time, dt);
    this._updateCinematic(stage);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, stage);
    const sub = stage.sub;
    const flash = sub && sub.stun > 0 ? (sub.stun / (sub.stunMax || 1)) * 0.35 : 0;
    this.vigMat.uniforms.uFlash.value = flash;

    // Strict WebGL state save & restore
    const prevRenderTarget = gl.getRenderTarget ? gl.getRenderTarget() : null;
    const prevAutoClear = gl.autoClear;
    const prevToneMapping = gl.toneMapping;
    const prevExposure = gl.toneMappingExposure;
    try {
      if (gl.setRenderTarget) gl.setRenderTarget(null);
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = this.exposure;
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

  // ------------------------------------------------------------------ Per-Frame Updaters
  _updateCamera(stage, time, dt, mag) {
    const arriving = stage.phase === 'arrive' || stage.phase === 'done';
    const at = arriving ? stage.arriveT || 0 : 0;
    const cine = arriving ? smooth01((at - 0.25) / 2.0) : 0;
    this._cine = cine;
    const sub = stage.sub;
    const sw = sub ? this._toWorld(sub.x, sub.y, 0, this._v3) : this._v3.set(0, 0, 0);
    const kf = 1 - Math.exp(-1.6 * dt);
    this._camFX += (sw.x * 0.045 - this._camFX) * kf;
    this._camFY += (sw.y * 0.06 - this._camFY) * kf;
    const dX = Math.sin(time * 0.31) * 0.06 + Math.sin(time * 0.73) * 0.025;
    const dY = Math.cos(time * 0.23) * 0.05 + Math.sin(time * 0.61) * 0.02;
    const camZ = lerp(CAM_Z, 14.4, cine);
    const halfW0 = camZ * Math.tan(FOV * 0.5 * DEG) * this.camera.aspect;
    const x = lerp(this._camFX + dX, sw.x - halfW0 * 0.04, cine);
    const y = lerp(this._camFY + dY, this._surfW, smooth01(cine * 1.08));
    this.camera.position.set(x + Math.sin(time * 73.7) * mag, y + Math.cos(time * 61.3) * mag * 0.85, camZ);
    this.camera.rotation.set(0.085 * cine, 0, Math.sin(time * 0.17) * 0.008 * (1 - cine));
    this.camera.updateMatrixWorld();
    this.snowMat.uniforms.uFocus.value = camZ;
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

  _updateLayers(scrollW, seabedW) {
    const layers = this.layers;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const { mesh, items } = layer;
      const arr = mesh.instanceMatrix.array;
      const n = mesh.count;
      const tall = layer.kind === 'far' || layer.kind === 'rock';
      for (let i = 0; i < n; i++) {
        const it = items[i];
        const span = it.span;
        let x = (it.u * span - scrollW) % span;
        if (x < 0) x += span;
        x -= span * 0.5;
        it.x = x;
        const y = seabedW + duneRaw(x + scrollW, it.z) * duneAmp(it.z) + it.dy * (tall ? it.sy * 0.1 + 0.5 : 1);
        it.y = y;
        arr[i * 16 + 12] = x;
        arr[i * 16 + 13] = y;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  _updateRays(scrollW, surfW, time) {
    const d = this._dummy;
    const items = this.rayItems;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const span = 2 * this._halfW(it.z) + 8;
      let x = (it.u * span - scrollW * 0.35) % span;
      if (x < 0) x += span;
      x -= span * 0.5;
      d.position.set(x - 2, surfW + 0.2, it.z);
      d.rotation.set(0, 0, it.tilt + Math.sin(time * 0.25 + it.sway) * 0.04);
      d.scale.set(it.w * (1 + Math.sin(time * 0.4 + it.sway) * 0.15), it.len, 1);
      d.updateMatrix();
      this.rays.setMatrixAt(i, d.matrix);
    }
    this.rays.instanceMatrix.needsUpdate = true;
  }

  _updateCoralGlows(h, time) {
    const isOrig = this.era === 'original';
    const visH = isOrig ? h : lerp(0.45, 1.0, h);
    const bl = this.barrelLayer;
    const kb = clamp((0.75 - h) / 0.75, 0, 1);
    for (let i = 0; i < bl.mesh.count; i++) {
      const it = bl.items[i];
      const p = 0.6 + 0.4 * Math.sin(time * 2.3 + i * 1.7);
      this._glow(it.x, it.y + 0.3, it.z + 0.6, 1.9, 0.12 * p * kb, 0.55 * p * kb, 0.65 * p * kb);
    }
    if (visH < 0.12) return;
    const L = this.stagLayer;
    const tips = this.staghornTips || EMPTY;
    const k = (visH - 0.12) / 0.88;
    for (let i = 0; i < L.mesh.count; i++) {
      const it = L.items[i];
      if (it.fg || !it.tipOff) continue;
      const c = isOrig ? it.lushOrig || it.lush : it.lushReboot || it.lush;
      for (let t = 0; t < tips.length; t++) {
        const o = it.tipOff[t];
        const p = 0.55 + 0.45 * Math.sin(time * 2.1 + i * 2.3 + t * 1.7);
        const s = it.sx * 0.5 * p;
        this._glow(it.x + o.x, it.y + o.y, it.z + o.z + 0.1, s, c.r * k * p * 0.85, c.g * k * p * 0.85, c.b * k * p * 0.85);
      }
    }
    for (let li = 0; li < this._haloLayers.length; li++) {
      const layer = this._haloLayers[li];
      for (let i = 0; i < layer.mesh.count; i++) {
        const it = layer.items[i];
        if (it.fg) continue;
        const c = isOrig ? it.lushOrig || it.lush : it.lushReboot || it.lush;
        const p = 0.5 + 0.5 * Math.sin(time * 1.3 + i);
        this._glow(it.x, it.y + it.sy * 0.6, it.z - 0.2, it.sx * 2.4, c.r * 0.16 * k * p, c.g * 0.16 * k * p, c.b * 0.16 * k * p);
      }
    }
  }

  _updateTowers(stage, scrollW, seabedW, surfW, time) {
    const v = this._v;
    const rx0 = this._toWorld((stage.width || this.width) * 0.5, 0, RUBBLE_Z, v).x;
    const rx = rx0 - scrollW;
    const rVisible = rx > -this._halfW(RUBBLE_Z) - 12;
    this.rubble.visible = rVisible;
    this.blocks.visible = rVisible;
    if (rVisible) {
      this.rubble.position.set(rx, seabedW - 0.6, RUBBLE_Z);
      const d = this._dummy;
      for (let i = 0; i < this.blockItems.length; i++) {
        const b = this.blockItems[i];
        const x = rx + b.ox;
        d.position.set(x, seabedW + duneRaw(x + scrollW, b.z) * duneAmp(b.z) + b.s * 0.15, b.z);
        d.rotation.set(b.r[0], b.r[1], b.r[2]);
        d.scale.setScalar(b.s);
        d.updateMatrix();
        this.blocks.setMatrixAt(i, d.matrix);
      }
      this.blocks.instanceMatrix.needsUpdate = true;
    }

    const tw = stage.tower;
    const show = Boolean(tw && tw.active);
    this.nextTower.visible = show;
    this.towerBase.visible = show;
    if (!show) return;
    if (this._glowHex !== tw.glow) {
      this._glowHex = tw.glow;
      this._glowColor.set(tw.glow || '#38bdf8');
      this.towerMat.emissive.copy(this._glowColor);
      this.towerBase.material.emissive.copy(this._glowColor).multiplyScalar(0.08);
    }
    const x = this._toWorld(tw.x, 0, TOWER_Z, v).x;
    const R = tw.r * this._pxw(TOWER_Z) * this._kx;
    const height = 60;
    const y0 = seabedW - 0.8;
    this.nextTower.position.set(x, y0, TOWER_Z);
    this.nextTower.scale.set(R, height, R);
    this.towerBase.position.set(x, y0, TOWER_Z);
    this.towerBase.scale.set(R, 2.2, R);
    if (Math.abs(R - this._towerR) > 0.01) {
      this._towerR = R;
      const tile = (TAU * R) / 7;
      this.towerTex.repeat.set(7, height / tile);
      this.winTex.repeat.set(7, height / tile);
    }
    const arrive = stage.phase === 'arrive' || stage.phase === 'done' ? clamp((stage.arriveT || 0) / 1.5, 0, 1) : 0;
    this.towerMat.emissiveIntensity =
      this.era === 'original' ? 1.8 + arrive * 1.1 : 0.72 + arrive * 0.55 + Math.sin(time * 2) * 0.08;
    const g = this._glowColor;
    const hs = 0.2 + arrive * 0.16;
    this._glow(x, seabedW + 2.2, TOWER_Z - 1.2, R * 4.4, g.r * hs, g.g * hs, g.b * hs);
    this._glow(x, (seabedW + surfW) * 0.5, TOWER_Z - 1.2, R * 5.5, g.r * hs * 0.6, g.g * hs * 0.6, g.b * hs * 0.6);
    const cine = this._cine;
    const fk = (0.3 + 0.7 * cine) * (0.85 + 0.15 * Math.sin(time * 3.1));
    this._glow(x, surfW - 0.03, TOWER_Z + R + 0.25, R * 2.7, 0.62 * fk, 0.72 * fk, 0.78 * fk, 0.28);
    this._glow(x, surfW + 2.5, TOWER_Z - 1.4, R * 5, g.r * 0.3 * cine, g.g * 0.3 * cine, g.b * 0.3 * cine);
  }

  _updateVentsAndWarpCavern(stage, time, pxw, seabedW, surfW) {
    const isOrig = this.era === 'original';
    const vents = !isOrig && stage.vents ? stage.vents : EMPTY;
    const d = this._dummy;
    let vn = 0;
    const colHeight = Math.max(2, (surfW - seabedW) * 0.86);
    for (let i = 0; i < vents.length && vn < MAX_VENT; i++) {
      const vt = vents[i];
      if (vt.active === false) continue;
      const vw = this._toWorld(vt.x, 0, 0, this._v);
      const wid = Math.max(0.75, (vt.width || 52) * pxw);
      const yBase = seabedW - 0.08;

      d.position.set(vw.x, yBase, -0.35);
      d.rotation.set(0, (vt.phase || 0) * 1.3, 0);
      d.scale.set(wid * 0.72, 1.1, wid * 0.72);
      d.updateMatrix();
      this.ventChimneyMesh.setMatrixAt(vn, d.matrix);

      d.position.set(vw.x, yBase + 0.65, -0.25);
      d.rotation.set(0, 0, 0);
      d.scale.set(wid * 1.15, colHeight, 1);
      d.updateMatrix();
      this.ventPlumeMesh.setMatrixAt(vn, d.matrix);

      const p = 0.68 + 0.32 * Math.sin(time * 5.2 + (vt.phase || 0));
      this._glow(vw.x, yBase + 0.8, 0.1, wid * 2.4, 0.25 * p, 0.85 * p, 0.95 * p);
      if (((time * 60 + i * 7) | 0) % 3 === 0) {
        this._spawnWake(
          vw.x + (Math.random() - 0.5) * wid * 0.7,
          yBase + 0.9,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.35,
          1.4 + Math.random() * 1.1,
          0.07 + Math.random() * 0.09,
          2.2 + Math.random() * 1.4,
          1.2,
          Math.random() < 0.35 ? 1 : 0
        );
      }
      vn++;
    }
    this.ventChimneyMesh.count = vn;
    this.ventPlumeMesh.count = vn;
    this.ventChimneyMesh.instanceMatrix.needsUpdate = true;
    this.ventPlumeMesh.instanceMatrix.needsUpdate = true;

    // Upper Bioluminescent Warp Cavern (`warp_cavern.glb`)
    const wc = !isOrig ? stage.warpCave : null;
    const stW = stage.width || this.width;
    const showWc = Boolean(wc && wc.active !== false && !wc.entered && wc.x < stW + 24 && wc.x > -90);
    this.warpCavernGroup.visible = showWc;
    if (showWc) {
      const ww = this._toWorld(wc.x, wc.y, 0, this._v);
      const cavSc = Math.max(0.95, (wc.r || 46) * pxw * 1.38);
      const clampedY = Math.min(ww.y, surfW - cavSc * 1.05);
      const edgeFade = smoothstep(stW + 22, stW - 58, wc.x) * smoothstep(-85, -15, wc.x);
      this.warpCavernGroup.position.set(ww.x, clampedY, -0.35);
      this.warpCavernGroup.rotation.set(0.05, -0.28 + Math.sin(time * 0.9) * 0.04, 0);
      this.warpCavernGroup.scale.setScalar(cavSc);
      if (this.warpPortalMat?.uniforms?.uVisAlpha) {
        this.warpPortalMat.uniforms.uVisAlpha.value = edgeFade;
      }
      const pulse = (0.75 + 0.25 * Math.sin(time * 3.8)) * edgeFade;
      this._glow(ww.x, clampedY, -1.1, cavSc * 2.4, 0.04 * pulse, 0.26 * pulse, 0.36 * pulse);
    }
  }

  _updateSub(stage, time, dt, pxw) {
    const sub = stage.sub;
    const outer = this.subOuter;
    if (!sub) {
      outer.visible = false;
      return;
    }
    outer.visible = true;
    const isOrig = this.era === 'original';

    const shots = sub.shots || 0;
    if (shots !== this._lastShots) {
      if (shots > this._lastShots) {
        this._recoil = 1;
        this._sqV -= 2.4;
      }
      this._lastShots = shots;
    }
    const catches = sub.catches || 0;
    if (catches !== this._lastCatches) {
      if (catches > this._lastCatches) {
        this._cheer = 1;
        this._sqV += 3.2;
      }
      this._lastCatches = catches;
    }
    const hits = stage.hits || 0;
    if (hits !== this._lastHits) {
      if (hits > this._lastHits) this._sqV += 9;
      this._lastHits = hits;
    }
    this._sqV += (-170 * this._sq - 9 * this._sqV) * dt;
    this._sq = clamp(this._sq + this._sqV * dt, -0.6, 0.6);
    this._recoil *= Math.exp(-10 * dt);
    this._cheer *= Math.exp(-3 * dt);

    const v = this._toWorld(sub.x, sub.y, 0, this._v);
    const sc = ((sub.rx * pxw) / (isOrig ? 1.15 : 0.98)) * (isOrig ? 1.06 : 1.14);
    const surf = sub.surfaced || 0;
    const bob = Math.sin(time * 2.1) * 0.045 * sc * (1 - surf) + Math.sin(time * 1.8) * 0.035 * sc * surf;
    outer.position.set(v.x - this._recoil * 0.07 * sc, v.y + bob, 0);
    const sq = this._sq;
    outer.scale.set(sc * (1 + sq * 0.16), sc * (1 - sq * 0.13), sc * (1 - sq * 0.1));

    const vx = sub.vx || 0;
    const vy = sub.vy || 0;
    const pitch = clamp(-vy * 0.0016 - (sub.ay || 0) * 0.00012, -0.42, 0.42) + Math.sin(time * 1.7) * 0.02;
    const roll = 0.16 + clamp(vy * 0.0007 + (sub.ax || 0) * 0.00008, -0.24, 0.32) + Math.sin(time * 1.3) * 0.03;
    const yaw = (isOrig ? -0.3 : -0.26) + clamp(vx * 0.0007, -0.16, 0.16);
    outer.rotation.set(
      roll * (1 - surf) + surf * (0.14 + Math.sin(time * 1.4) * 0.05),
      yaw * (1 - surf) - surf * 0.2,
      pitch * (1 - surf) + surf * Math.sin(time * 1.9) * 0.05
    );
    this.subInner.rotation.x = sub.spin || 0;

    const propVal = sub.prop ?? 1;
    if (isOrig) {
      const spin = dt * (6 + propVal * 30);
      this.prop.rotation.x += spin;
      this.propBlurMat.uniforms.uSpin.value = time * 9;
      this.propBlurMat.uniforms.uAmt.value = clamp((propVal - 0.25) / 0.9, 0, 1);
    } else if (this.thrusterPlumeMat) {
      const thrBoost = clamp((propVal - 0.1) * 0.85, 0.2, 1.35) * (1 - surf * 0.85);
      this.thrusterPlumeMat.uniforms.uBoost.value = thrBoost;
      const pLen = 0.55 + thrBoost * 0.85 + Math.sin(time * 36) * 0.07;
      this.thrusterPlumeL.scale.set(pLen, 1, 1);
      this.thrusterPlumeR.scale.set(pLen, 1, 1);
      this.thrusterPlumeL.visible = this.thrusterPlumeR.visible = thrBoost > 0.05;
    }

    // ---- Update Real 33-Bone `PogoRig` Explorer Pogo V2 Pilot inside the glass nose-dome!
    if (this.pogoRig) {
      const ps = this._poseState;
      ps.time = time;
      ps.vx = 0;
      ps.vy = 0;
      ps.facing = 1;
      ps.onGround = true;
      ps.hurtTimer = sub.stun > 0 ? 0.25 : 0;
      ps.invuln = 0;
      ps.muzzleFlash = 0;
      ps.victory = false;
      this.pogoRig.update(dt, ps);

      const b = this.pogoRig.bones;
      if (b) {
        if (b.blaster) b.blaster.visible = false;
        if (b.backpack) b.backpack.visible = false;
        if (b.root) {
          b.root.position.set(0, 0, 0);
          b.root.rotation.set(0, 0, 0);
        }
        const ch = this._cheer;
        const hop = Math.abs(Math.sin((1 - ch) * Math.PI * 3)) * 0.045 * ch;
        const steerX = clamp(vx * 0.0012, -0.25, 0.25);
        const steerY = clamp(-vy * 0.0014, -0.24, 0.24);
        if (b.pelvis) {
          b.pelvis.position.set(0, 0.105 + hop, 0.02);
          b.pelvis.rotation.set(-0.08, 0, steerY * 0.18);
        }
        if (b.spine) b.spine.rotation.set(0.08, steerY * 0.15, 0);
        if (b.chest) b.chest.rotation.set(0.1 - ch * 0.14, steerX * 0.2, -steerY * 0.12);
        if (b.head) {
          const dizzy = sub.stun > 0 ? Math.sin(time * 16) * 0.32 : 0;
          b.head.rotation.set(
            -0.08 + steerY * 0.35 - ch * 0.16,
            0.16 + Math.sin(time * 1.1) * 0.09 + dizzy,
            0.08 + ch * Math.sin(time * 18) * 0.08
          );
        }
        // Seated knees inside forward footwell
        if (b.thighL) b.thighL.rotation.set(-1.26, 0.1, 0.1);
        if (b.thighR) b.thighR.rotation.set(-1.26, -0.1, -0.1);
        if (b.shinL) b.shinL.rotation.set(1.06, 0, 0);
        if (b.shinR) b.shinR.rotation.set(1.06, 0, 0);
        if (b.footL) b.footL.rotation.set(-0.12, 0, 0);
        if (b.footR) b.footR.rotation.set(-0.12, 0, 0);
        // Hands actively working the glowing helm console (or cheering on catch!)
        const cheerPump = ch * (0.9 + Math.sin(time * 18) * 0.25);
        if (b.upperArmL) b.upperArmL.rotation.set(-0.92 - cheerPump + steerY * 0.2, 0, 0.22);
        if (b.upperArmR) b.upperArmR.rotation.set(-0.92 - cheerPump - steerY * 0.2, 0, -0.22);
        if (b.forearmL) b.forearmL.rotation.set(-0.52 + cheerPump * 0.25, 0, 0);
        if (b.forearmR) b.forearmR.rotation.set(-0.52 + cheerPump * 0.25, 0, 0);
        if (b.handL) b.handL.rotation.set(0.25, 0, -0.1);
        if (b.handR) b.handR.rotation.set(0.25, 0, 0.1);
      }
    }

    // Stun / invulnerability flash
    let fl = 0;
    if (sub.stun > 0) fl = Math.sin(time * 42) > 0 ? 1.05 : 0.15;
    else if (sub.invuln > 0) fl = Math.sin(time * 26) > 0.4 ? 0.35 : 0;
    const fm = isOrig ? this.classicFlashMats : this.rebootFlashMats;
    for (let i = 0; i < fm.length; i++) fm[i].emissive.setRGB(fl, fl * 0.9, fl * 0.95);

    const h = this._heal;
    const airAtten = 1 - smooth01(this._cine * 1.45);
    const lightOn = (sub.stun > 0 ? (Math.sin(time * 30) > 0 ? 0.3 : 0) : 1) * (1 - smooth01(surf * 1.5)) * airAtten;
    this.coneMat.uniforms.uStr.value = (isOrig ? lerp(0.55, 0.22, h) : lerp(0.28, 0.19, h)) * lightOn;
    this.spot.intensity = (isOrig ? lerp(70, 30, h) : lerp(68, 46, h)) * lightOn;

    outer.updateMatrixWorld(true);
    const p = this._v2;
    const body = this.subBody;
    if (isOrig) {
      body.localToWorld(p.set(1.3, -0.08, 0));
      this._glow(p.x, p.y, p.z + 0.35, sc * 1.2 * lightOn, 0.82 * lightOn, 0.96 * lightOn, 1.0 * lightOn);
      this._star(p.x, p.y, p.z + 0.5, sc * 1.35 * lightOn, 0.3 + Math.sin(time * 0.7) * 0.1, 0.5 * lightOn, 0.65 * lightOn, 0.7 * lightOn);
    } else {
      // Twin compact bow-pod lens glints BELOW & BESIDE the panoramic nose dome so Pogo V2 is 100% crystal-clear!
      body.localToWorld(p.copy(this._rebootLampL));
      this._glow(p.x, p.y, p.z + 0.22, sc * 0.62 * lightOn, 0.45 * lightOn, 0.88 * lightOn, 1.0 * lightOn);
      body.localToWorld(p.copy(this._rebootLampR));
      this._glow(p.x, p.y, p.z + 0.22, sc * 0.62 * lightOn, 0.45 * lightOn, 0.88 * lightOn, 1.0 * lightOn);
      this._star(p.x, p.y, p.z + 0.35, sc * 0.68 * lightOn, 0.35 + Math.sin(time * 0.9) * 0.1, 0.35 * lightOn, 0.68 * lightOn, 0.78 * lightOn);
    }

    const blink = Math.sin(time * 4.2) > 0.55 ? 1 : 0.12;
    body.localToWorld(p.copy(isOrig ? this._classicNavLocal : this._rebootNavLocal));
    this._glow(p.x, p.y, p.z + 0.2, sc * 0.5 * blink, 1.0 * blink, 0.22 * blink, 0.28 * blink);

    if (isOrig) {
      const portK = lerp(0.42, 0.16, h);
      for (let i = 0; i < this._classicPortLocal.length; i++) {
        body.localToWorld(p.copy(this._classicPortLocal[i]));
        this._glow(p.x, p.y, p.z + 0.15, sc * 0.42, 1.0 * portK, 0.75 * portK, 0.35 * portK);
      }
      body.localToWorld(p.set(0.24, 0.76, -0.35));
      this._glow(p.x, p.y, p.z, sc * 1.45, 0.28, 0.25, 0.16);
      body.localToWorld(this._subTail.set(-1.4, -0.08, 0));
    } else {
      // Soft cyan-amber cockpit halo behind Pogo inside the panoramic glass dome + twin thruster glows
      body.localToWorld(p.set(0.48, 0.02, -0.25));
      this._glow(p.x, p.y, p.z, sc * 1.35, 0.08, 0.22, 0.28);
      body.localToWorld(this._subTailL.set(-0.92, -0.04, -0.54));
      body.localToWorld(this._subTailR.set(-0.92, -0.04, 0.54));
      body.localToWorld(this._subTail.set(-0.96, -0.02, 0));
      const tk = 0.28 * clamp(propVal, 0.2, 1.4);
      this._glow(this._subTailL.x, this._subTailL.y, this._subTailL.z + 0.1, sc * 0.75, 0.15 * tk, 0.85 * tk, 1.0 * tk);
      this._glow(this._subTailR.x, this._subTailR.y, this._subTailR.z + 0.1, sc * 0.75, 0.15 * tk, 0.85 * tk, 1.0 * tk);
    }
    this._shade(v.x, v.y + bob, sc * 5.0, sc * 3.5);
    if (surf > 0) {
      const foam = surf * (0.75 + 0.25 * Math.sin(time * 6));
      this._glow(v.x, this._surfW - 0.03, 0.75, sc * 4.2, 0.32 * foam, 0.38 * foam, 0.42 * foam, sc * 0.32);
      this._glow(v.x - sc * 0.9, this._surfW - 0.03, 0.8, sc * 2.2, 0.4 * foam, 0.45 * foam, 0.46 * foam, sc * 0.22);
    }
    this._subSc = sc;
  }

  _fishColor(f, out, isOrig) {
    if (f.type === 'gold') return out.copy(this._fishGold);
    if (isOrig) {
      if (f.customHex) return out.set(f.customHex);
      if (f.type === 'big') return out.copy(this._origFishBig[(f.color || 0) % this._origFishBig.length]);
      return out.copy(this._origFishSmall[(f.color || 0) % this._origFishSmall.length]);
    }
    if (f.type === 'big') return out.copy(this._rebootBigTints[(f.color || 0) % this._rebootBigTints.length]);
    return out.copy(this._rebootFishTints[(f.color || 0) % this._rebootFishTints.length]);
  }

  _updateFishAndGears(stage, time, pxw) {
    const fish = stage.fish || EMPTY;
    const isOrig = this.era === 'original';
    const d = this._dummy;
    const c = this._c;

    let nOrig = 0;
    let n1 = 0;
    let n2 = 0;
    let nGear = 0;

    const animOrig = this.classicFishMesh.geometry.attributes.aAnim.array;
    const glowOrig = this.classicFishMesh.geometry.attributes.aGlow.array;
    const anim1 = this.rebootFish1Mesh.geometry.attributes.aAnim.array;
    const glow1 = this.rebootFish1Mesh.geometry.attributes.aGlow.array;
    const anim2 = this.rebootFish2Mesh.geometry.attributes.aAnim.array;
    const glow2 = this.rebootFish2Mesh.geometry.attributes.aGlow.array;

    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      const v = this._toWorld(f.x, f.y, 0, this._v);
      const s = f.r * pxw * 1.25;
      const bubbled = f.state === 'bubbled' && (f.bubbleT ?? 0) >= 0;

      // 3D Golden Gear Collectibles (`f.isGear === true`)
      if (f.isGear) {
        if (nGear < MAX_GEAR) {
          d.position.set(v.x, v.y, 0.12);
          d.rotation.set(0.25, time * 2.8 + i, time * 1.4);
          d.scale.setScalar(s * 0.95);
          d.updateMatrix();
          this.gearMesh.setMatrixAt(nGear++, d.matrix);
          this._glow(v.x, v.y, -0.35, s * 4.2, 0.48, 0.36, 0.08);
          const tw = 0.55 + 0.45 * Math.sin(time * 7 + i * 2.1);
          this._star(v.x + s * 0.55, v.y + s * 0.45, 0.65, s * 1.25 * tw, time * 2.4, 1, 0.9, 0.45);
        }
        continue;
      }

      d.position.set(v.x, v.y, f.type === 'small' ? 0.1 : 0);
      if (bubbled) {
        d.rotation.set(Math.sin(time * 2 + f.seed) * 0.3, f.dir > 0 ? Math.PI : 0, Math.sin(time * 2.6 + f.seed) * 0.45);
      } else {
        d.rotation.set(0, (f.dir > 0 ? Math.PI : 0) + 0.22, clamp((f.vy || 0) * 0.004, -0.5, 0.5));
      }
      if (f.type === 'big') d.scale.set(s * 1.15, s * 1.32, s * 1.15);
      else d.scale.set(s * 1.12, s * 1.12, s * 1.12);
      d.updateMatrix();

      this._fishColor(f, c, isOrig);
      const wagSpd = bubbled ? 15 : f.state === 'free' ? 16 : f.type === 'big' ? 6.5 : 10.5;
      const wagPh = (f.seed || 0) * 3;
      const wagAmp = bubbled ? 0.9 : f.type === 'big' ? 0.6 : 0.8;
      const glVal = f.type === 'gold' ? 0.75 + 0.35 * Math.sin(time * 6) : isOrig ? 0.2 : 0.28;

      if (isOrig) {
        if (nOrig < MAX_FISH) {
          this.classicFishMesh.setMatrixAt(nOrig, d.matrix);
          this.classicFishMesh.setColorAt(nOrig, c);
          animOrig[nOrig * 3] = wagSpd;
          animOrig[nOrig * 3 + 1] = wagPh;
          animOrig[nOrig * 3 + 2] = wagAmp;
          glowOrig[nOrig] = glVal;
          nOrig++;
        }
      } else if ((f.species || 0) === 0) {
        if (n1 < MAX_FISH) {
          this.rebootFish1Mesh.setMatrixAt(n1, d.matrix);
          this.rebootFish1Mesh.setColorAt(n1, c);
          anim1[n1 * 3] = wagSpd;
          anim1[n1 * 3 + 1] = wagPh;
          anim1[n1 * 3 + 2] = wagAmp;
          glow1[n1] = glVal;
          n1++;
        }
      } else if (n2 < MAX_FISH) {
        this.rebootFish2Mesh.setMatrixAt(n2, d.matrix);
        this.rebootFish2Mesh.setColorAt(n2, c);
        anim2[n2 * 3] = wagSpd;
        anim2[n2 * 3 + 1] = wagPh;
        anim2[n2 * 3 + 2] = wagAmp;
        glow2[n2] = glVal;
        n2++;
      }

      const hk = f.type === 'gold' ? 0.55 : f.type === 'big' ? 0.16 : 0.2;
      if (f.type !== 'small') this._shade(v.x, v.y, s * 4.2, s * 3.4);
      this._glow(v.x, v.y, -0.5, s * (f.type === 'gold' ? 5 : 3.2), c.r * hk * 0.6, c.g * hk * 0.9, c.b * hk);
      if (f.type === 'gold') {
        for (let k = 0; k < 3; k++) {
          const a = time * (2.2 + k * 0.7) + k * 2.1 + f.seed;
          const tw = Math.max(0, Math.sin(time * 7 + k * 2.3));
          this._star(v.x + Math.cos(a) * s * 1.3, v.y + Math.sin(a * 1.3) * s * 0.8, 0.6, s * 1.4 * tw, a, 1, 0.9 * tw, 0.5 * tw);
        }
      }
      if (bubbled && f.bubbleT < 0.45) {
        const k = 1 - f.bubbleT / 0.45;
        const R = f.bubbleR * pxw;
        for (let j = 0; j < 4; j++) {
          const a = j * 1.5708 + f.bubbleT * 7 + f.seed;
          this._star(v.x + Math.cos(a) * R, v.y + Math.sin(a) * R, 0.7, R * 0.7 * k, a, 0.8 * k, 0.95 * k, 1.0 * k);
        }
      }
    }

    this.gearMesh.count = nGear;
    if (nGear) this.gearMesh.instanceMatrix.needsUpdate = true;

    const commitFishMesh = (m, count) => {
      m.count = count;
      if (count > 0) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.geometry.attributes.aAnim.needsUpdate = true;
        m.geometry.attributes.aGlow.needsUpdate = true;
      }
    };
    commitFishMesh(this.classicFishMesh, nOrig);
    commitFishMesh(this.rebootFish1Mesh, n1);
    commitFishMesh(this.rebootFish2Mesh, n2);
  }

  _updateAmbient(stage, time, dt, scrollW, seabedW, surfW, h) {
    const isOrig = this.era === 'original';
    const P = this.boidPos;
    const V = this.boidVel;
    const c = this._c;
    const total = isOrig ? Math.round(lerp(18, MAX_AMB, h)) : Math.round(lerp(92, MAX_AMB, h));
    const sub = stage.sub;
    const sw = sub ? this._toWorld(sub.x, sub.y, 0, this._v2) : this._v2.set(999, 999, 0);
    const avoidR = Math.max(1.3, (this._subSc || 0.5) * 2.8);
    const sdt = Math.min(dt, 0.033);

    let nOrig = 0;
    let n1 = 0;
    let n2 = 0;
    let totalWritten = 0;

    for (let k = 0; k < this.ambSchools.length; k++) {
      const S = this.ambSchools[k];
      const span = 2 * this._halfW(S.z) + 10;
      let cx = (S.u * span - scrollW + S.dir * S.speed * time) % span;
      if (cx < 0) cx += span;
      cx -= span * 0.5;
      const cy = lerp(seabedW + 1.8, surfW - 1.9, S.yf) + Math.sin(time * 0.37 + S.ph) * 0.7;
      const wx = Math.sin(time * 0.3 + S.ph) * 0.8;
      const wy = Math.sin(time * 0.47 + S.ph * 1.3) * 0.3;
      const wz = Math.cos(time * 0.29 + S.ph) * 0.6;
      const i0 = S.start;
      const i1 = S.start + S.n;
      let mx = 0;
      let my = 0;
      let mz = 0;
      let vxm = 0;
      let vym = 0;
      let vzm = 0;
      for (let i = i0; i < i1; i++) {
        mx += P[i * 3];
        my += P[i * 3 + 1];
        mz += P[i * 3 + 2];
        vxm += V[i * 3];
        vym += V[i * 3 + 1];
        vzm += V[i * 3 + 2];
      }
      const inv = 1 / S.n;
      mx *= inv;
      my *= inv;
      mz *= inv;
      vxm *= inv;
      vym *= inv;
      vzm *= inv;
      const sx = sw.x - cx;
      const sy = sw.y - cy;
      for (let i = i0; i < i1; i++) {
        const o = i * 3;
        const px = P[o];
        const py = P[o + 1];
        const pz = P[o + 2];
        let ax = (mx - px) * 0.7 + (wx - px) * 0.5;
        let ay = (my - py) * 0.9 + (wy - py) * 0.8;
        let az = (mz - pz) * 0.7 + (wz - pz) * 0.5;
        for (let j = i0; j < i1; j++) {
          if (j === i) continue;
          const q = j * 3;
          const dx = px - P[q];
          const dy = py - P[q + 1];
          const dz = pz - P[q + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 0.1 && d2 > 1e-5) {
            const f = 0.05 / d2;
            ax += dx * f;
            ay += dy * f;
            az += dz * f;
          }
        }
        ax += (vxm - V[o]) * 0.9;
        ay += (vym - V[o + 1]) * 0.9;
        az += (vzm - V[o + 2]) * 0.9;
        if (S.avoid) {
          const dx = px - sx;
          const dy = py - sy;
          const dd = Math.sqrt(dx * dx + dy * dy) + 1e-4;
          if (dd < avoidR) {
            const f = ((avoidR - dd) / avoidR) * 16;
            ax += (dx / dd) * f;
            ay += (dy / dd) * f;
            az -= f * 0.3;
          }
        }
        const al = Math.sqrt(ax * ax + ay * ay + az * az);
        if (al > 8) {
          ax *= 8 / al;
          ay *= 8 / al;
          az *= 8 / al;
        }
        let vx = V[o] + ax * sdt;
        let vy = V[o + 1] + ay * sdt;
        let vz = V[o + 2] + az * sdt;
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (sp > 1.8) {
          vx *= 1.8 / sp;
          vy *= 1.8 / sp;
          vz *= 1.8 / sp;
        }
        V[o] = vx;
        V[o + 1] = vy;
        V[o + 2] = vz;
        P[o] = px + vx * sdt;
        P[o + 1] = py + vy * sdt;
        P[o + 2] = pz + vz * sdt;
      }

      const targetMesh = isOrig
        ? this.classicAmbMesh
        : S.species === 0
        ? this.rebootAmb1Mesh
        : this.rebootAmb2Mesh;
      const arr = targetMesh.instanceMatrix.array;
      const anim = targetMesh.geometry.attributes.aAnim.array;
      const glow = targetMesh.geometry.attributes.aGlow.array;
      const lush = c.copy(S.color).lerp(this._sick, (1 - h) * 0.35);

      for (let i = i0; i < i1 && totalWritten < total; i++) {
        const slot = isOrig ? nOrig : S.species === 0 ? n1 : n2;
        if (slot >= MAX_AMB) break;
        const o = i * 3;
        const hx = S.dir * S.speed * 0.8 + V[o];
        let hy = V[o + 1];
        const hz = V[o + 2];
        const hl = Math.sqrt(hx * hx + hz * hz) + 1e-4;
        if (Math.abs(hy) > hl * 0.6) hy = Math.sign(hy) * hl * 0.6;
        const l = Math.sqrt(hx * hx + hy * hy + hz * hz) + 1e-5;
        const xx = -hx / l;
        const xy = -hy / l;
        const xz = -hz / l;
        let zx = -xz;
        let zz = xx;
        const zl = Math.sqrt(zx * zx + zz * zz) + 1e-5;
        zx /= zl;
        zz /= zl;
        const yx = -zz * xy;
        const yy = zz * xx - zx * xz;
        const yz = zx * xy;
        const s = S.size * (0.8 + 0.4 * fract(i * 0.37));
        const m = slot * 16;
        arr[m] = xx * s;
        arr[m + 1] = xy * s;
        arr[m + 2] = xz * s;
        arr[m + 3] = 0;
        arr[m + 4] = yx * s;
        arr[m + 5] = yy * s;
        arr[m + 6] = yz * s;
        arr[m + 7] = 0;
        arr[m + 8] = zx * s;
        arr[m + 9] = 0;
        arr[m + 10] = zz * s;
        arr[m + 11] = 0;
        arr[m + 12] = cx + P[o];
        arr[m + 13] = cy + P[o + 1];
        arr[m + 14] = S.z + P[o + 2];
        arr[m + 15] = 1;
        targetMesh.setColorAt(slot, lush);
        anim[slot * 3] = 11 + fract(i * 0.61) * 4;
        anim[slot * 3 + 1] = i * 1.3 + k;
        anim[slot * 3 + 2] = 0.8;
        glow[slot] = isOrig ? lerp(0.35, 0.08, h) : lerp(0.38, 0.16, h);
        if (isOrig) nOrig++;
        else if (S.species === 0) n1++;
        else n2++;
        totalWritten++;
      }
    }

    const commitAmb = (m, count) => {
      m.count = count;
      if (count > 0) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.geometry.attributes.aAnim.needsUpdate = true;
        m.geometry.attributes.aGlow.needsUpdate = true;
      }
    };
    commitAmb(this.classicAmbMesh, nOrig);
    commitAmb(this.rebootAmb1Mesh, n1);
    commitAmb(this.rebootAmb2Mesh, n2);
  }

  _putShell(n, x, y, z, r, wob) {
    if (n >= MAX_SHELL) return n;
    const arr = this.shellMesh.instanceMatrix.array;
    const o = n * 16;
    arr.fill(0, o, o + 16);
    arr[o] = r * (1 + wob);
    arr[o + 5] = r * (1 - wob);
    arr[o + 10] = r;
    arr[o + 12] = x;
    arr[o + 13] = y;
    arr[o + 14] = z;
    arr[o + 15] = 1;
    return n + 1;
  }

  _updateShellsAndTorpedoes(stage, time, pxw) {
    let nShell = 0;
    let nTorp = 0;
    const d = this._dummy;
    const bubbles = stage.bubbles || EMPTY;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const v = this._toWorld(b.x, b.y, 0, this._v);
      const rad = b.r * pxw;
      const grow = clamp((b.age || 0.2) / 0.12, 0.35, 1);

      if (b.isTorpedo && this.era !== 'original') {
        if (nTorp < MAX_TORP) {
          d.position.set(v.x, v.y, 0.32);
          d.rotation.set(time * 9 + i, 0, 0);
          d.scale.setScalar(rad * 0.88 * grow);
          d.updateMatrix();
          this.torpedoMesh.setMatrixAt(nTorp++, d.matrix);
        }
        nShell = this._putShell(nShell, v.x, v.y, 0.3, rad * 1.12 * grow, 0.16);
        this._glow(v.x, v.y, 0.2, rad * 4.2, 0.16, 0.65, 0.85);
      } else {
        const sp = clamp(Math.abs(b.vx || 0) / 400, 0, 1);
        nShell = this._putShell(
          nShell,
          v.x,
          v.y,
          0.3,
          rad * grow,
          sp * 0.18 + Math.sin((b.age || 0) * 18 + (b.seed || 0)) * 0.08
        );
        this._glow(v.x, v.y, 0.2, rad * 3.2, 0.1, 0.22, 0.28);
      }

      if ((((b.age || 0) * 30) | 0) % 2 === 0 && Math.random() < 0.5) {
        this._spawnWake(
          v.x - rad * 1.2,
          v.y + (Math.random() - 0.5) * rad,
          0.3,
          -0.4,
          0.2,
          0.04 + Math.random() * 0.04,
          0.5,
          0.8,
          b.isTorpedo ? 1 : 0
        );
      }
    }

    const fish = stage.fish || EMPTY;
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      if (f.state !== 'bubbled' || (f.bubbleT ?? 0) < 0) continue;
      const v = this._toWorld(f.x, f.y, 0, this._v);
      const pop = clamp((f.bubbleT || 0.2) / 0.18, 0.2, 1);
      const over = 1 + Math.sin(pop * Math.PI) * 0.25;
      const jig = Math.exp(-(f.bubbleT || 0) * 4) * Math.sin((f.bubbleT || 0) * 30) * 0.12;
      nShell = this._putShell(
        nShell,
        v.x,
        v.y,
        0.2,
        (f.bubbleR || f.r * 1.8) * pxw * pop * over,
        Math.sin(time * 3 + (f.seed || 0)) * 0.05 + jig
      );
    }

    this.shellMesh.count = nShell;
    this.shellMesh.instanceMatrix.needsUpdate = true;
    this.torpedoMesh.count = nTorp;
    if (nTorp > 0) this.torpedoMesh.instanceMatrix.needsUpdate = true;
  }

  _updateJellies(stage, time, pxw) {
    const jellies = stage.jellies || EMPTY;
    const bell = this.bellMesh;
    const tent = this.tentMesh;
    const d = this._dummy;
    const ba = bell.geometry.attributes.aAlpha.array;
    const ta = tent.geometry.attributes.aAlpha.array;
    const c = this._c;
    const bio = this.U.uBio.value;
    let n = 0;
    for (let i = 0; i < jellies.length && n < MAX_JELLY; i++) {
      const j = jellies[i];
      const v = this._toWorld(j.x, j.y, 0, this._v);
      const r = j.r * pxw * 1.05;
      const popped = j.state === 'popped';
      const pt = popped ? clamp(j.deadT / 0.45, 0, 1) : 0;
      const ps = Math.sin(j.pulse || 0);
      const sxz = (1 - 0.13 * ps) * (1 + pt * 0.7);
      const sy = (1 + 0.1 * ps) * (1 - pt * 0.4);
      d.position.set(v.x, v.y, -0.1);
      d.rotation.set(0.25, 0, Math.sin(time * 0.8 + j.phase) * 0.12);
      d.scale.set(r * sxz, r * sy, r * sxz);
      d.updateMatrix();
      bell.setMatrixAt(n, d.matrix);
      d.scale.set(r * (1 - 0.06 * ps), r * (1 + 0.05 * ps), r);
      d.updateMatrix();
      tent.setMatrixAt(n, d.matrix);
      c.copy(this._jellyCols[j.hue % this._jellyCols.length]);
      if (popped) c.lerp(this._white, 1 - pt);
      bell.setColorAt(n, c);
      tent.setColorAt(n, c);
      const a = 1 - pt;
      ba[n] = a;
      ta[n] = a;
      const gk = (0.32 + 0.12 * ps + bio * 0.18) * a;
      this._glow(v.x, v.y + r * 0.25, 0.25, r * (3.4 + bio * 1.2), c.r * gk, c.g * gk, c.b * gk);
      if (!popped) this._shade(v.x, v.y - r * 0.4, r * 4.2, r * 5.2);
      n++;
    }
    bell.count = n;
    tent.count = n;
    bell.instanceMatrix.needsUpdate = true;
    tent.instanceMatrix.needsUpdate = true;
    if (n) {
      bell.instanceColor.needsUpdate = true;
      tent.instanceColor.needsUpdate = true;
    }
    bell.geometry.attributes.aAlpha.needsUpdate = true;
    tent.geometry.attributes.aAlpha.needsUpdate = true;
  }

  _updateMines(stage, time, pxw, seabedW) {
    const mines = stage.mines || EMPTY;
    const isOrig = this.era === 'original';
    const activeMineMesh = isOrig ? this.classicMineMesh : this.rebootMineMesh;
    const inactiveMineMesh = isOrig ? this.rebootMineMesh : this.classicMineMesh;
    inactiveMineMesh.count = 0;

    const d = this._dummy;
    let n = 0;
    let ln = 0;
    let an = 0;
    for (let i = 0; i < mines.length && n < MAX_MINE; i++) {
      const m = mines[i];
      const v = this._toWorld(m.x, m.y, 0, this._v);
      const r = m.r * pxw;
      const frozen = (m.frozenTimer || 0) > 0;
      d.position.set(v.x, v.y, 0);
      d.rotation.set(0.24, m.spin || 0, 0.16);
      d.scale.setScalar(r);
      d.updateMatrix();
      activeMineMesh.setMatrixAt(n, d.matrix);
      activeMineMesh.setColorAt(n, frozen ? this._cryoCol : this._white);

      const mx = v.x;
      const my = v.y;
      if (frozen) {
        this._glow(mx, my, 0.5, r * 3.8, 0.18, 0.82, 0.95);
      } else {
        const on = (m.blink || 0) < 0.5 ? 1 : 0.18;
        this._glow(mx, my + r * 0.95, 0.9, r * (1.3 + on * 1.3), 1.0 * on, 0.18 * on, 0.14 * on);
        this._glow(mx, my, -0.6, r * 4.8, 0.3, 0.04, 0.04);
      }
      this._shade(mx, my, r * 5.2);

      if (m.kind === 'anchored') {
        const top = my - r * 1.0;
        const len = top - seabedW;
        const ls = r * 0.32;
        const step = ls * 0.82;
        const count = Math.min(40, Math.max(0, Math.floor(len / step)));
        for (let k = 0; k < count && ln < MAX_LINKS; k++) {
          const yy = top - k * step - step * 0.5;
          const sway = Math.sin(time * 1.2 + (m.phase || 0) + k * 0.2) * 0.04 * k * r;
          d.position.set(mx + sway, yy, 0);
          d.rotation.set(0, k % 2 ? Math.PI / 2 : 0, Math.PI / 2);
          d.scale.setScalar(ls);
          d.updateMatrix();
          this.linkMesh.setMatrixAt(ln++, d.matrix);
        }
        if (an < MAX_MINE) {
          d.position.set(mx, seabedW + 0.05, 0);
          d.rotation.set(0, 0, 0);
          d.scale.setScalar(r * 1.0);
          d.updateMatrix();
          this.anchorMesh.setMatrixAt(an++, d.matrix);
        }
      }
      n++;
    }
    activeMineMesh.count = n;
    this.linkMesh.count = ln;
    this.anchorMesh.count = an;
    if (n) {
      activeMineMesh.instanceMatrix.needsUpdate = true;
      if (activeMineMesh.instanceColor) activeMineMesh.instanceColor.needsUpdate = true;
    }
    this.linkMesh.instanceMatrix.needsUpdate = true;
    this.anchorMesh.instanceMatrix.needsUpdate = true;
    this.mineRim.value = 0.75 + 0.35 * Math.sin(time * 5);
  }

  _updateClams(stage, time, pxw, seabedW, h) {
    const clams = stage.clams || EMPTY;
    const d = this._dummy;
    const c = this._c;
    const visH = this.era === 'original' ? h : lerp(0.5, 1.0, h);
    c.copy(this._clamDead).lerp(this._clamLush, visH);
    let n = 0;
    let pn = 0;
    for (let i = 0; i < clams.length && n < MAX_CLAM; i++) {
      const cl = clams[i];
      const v = this._toWorld(cl.x, cl.y, 0, this._v);
      const sc = cl.r * pxw;
      const hingeZ = -0.85 * sc;
      const y = seabedW + 0.02;
      d.position.set(v.x, y, hingeZ);
      d.rotation.set(0, 0, 0);
      d.scale.set(sc, sc, sc);
      d.updateMatrix();
      this.clamBot.setMatrixAt(n, d.matrix);
      d.rotation.set(-(cl.open || 0) * 1.05, 0, 0);
      d.updateMatrix();
      this.clamTop.setMatrixAt(n, d.matrix);
      this.clamBot.setColorAt(n, c);
      this.clamTop.setColorAt(n, c);
      if (cl.hasPearl) {
        const pr = sc * 0.3;
        d.position.set(v.x, y + pr * 0.9, hingeZ + sc * 0.95);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(pr);
        d.updateMatrix();
        this.pearlMesh.setMatrixAt(pn++, d.matrix);
        const o = cl.open || 0;
        const p = (0.25 + o * 0.75) * (0.75 + 0.25 * Math.sin(time * 5 + i));
        this._glow(v.x, y + pr, hingeZ + sc * 1.3, sc * (1.5 + o * 2.6), 1.0 * p * 0.8, 0.8 * p * 0.8, 0.92 * p * 0.8);
        if (o > 0.4) {
          this._star(
            v.x + sc * 0.15,
            y + pr * 1.4,
            hingeZ + sc * 1.5,
            sc * 0.9 * o * (0.6 + 0.4 * Math.sin(time * 8 + i)),
            time * 1.5,
            1,
            0.85,
            0.95
          );
        }
      }
      n++;
    }
    this.clamBot.count = n;
    this.clamTop.count = n;
    this.pearlMesh.count = pn;
    this.clamBot.instanceMatrix.needsUpdate = true;
    this.clamTop.instanceMatrix.needsUpdate = true;
    this.pearlMesh.instanceMatrix.needsUpdate = true;
    if (n) {
      this.clamBot.instanceColor.needsUpdate = true;
      this.clamTop.instanceColor.needsUpdate = true;
    }
  }

  _updateSonarWave(stage, pxw) {
    const sp = Number(stage.sonarPulse) || 0;
    const show = sp > 0.01 && this.era !== 'original';
    this.sonarWaveMesh.visible = show;
    if (!show) return;
    const prog = clamp(1 - sp, 0, 1);
    const ox = stage.sonarOriginX ?? stage.sub?.x ?? 0;
    const oy = stage.sonarOriginY ?? stage.sub?.y ?? 0;
    const wPos = this._toWorld(ox, oy, 0, this._v);
    const maxWorldR = 275 * (stage.s || 1) * pxw;
    const curR = lerp(0.55, maxWorldR, 1 - Math.pow(1 - prog, 2.2));
    this.sonarWaveMesh.position.set(wPos.x, wPos.y, 0.15);
    this.sonarWaveMesh.scale.set(curR, curR, curR * 0.45);
    this.sonarWaveMat.uniforms.uProgress.value = prog;
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
      const t = 1 - r.life / (r.maxLife || 1);
      const v = this._toWorld(r.x, r.y, 0, this._v);
      const rad = lerp(r.r0, r.r1, 1 - (1 - t) * (1 - t)) * pxw * 2.3;
      const o = n * 16;
      arr.fill(0, o, o + 16);
      arr[o] = rad;
      arr[o + 5] = r.flat ? rad * 0.22 : rad;
      arr[o + 10] = 1;
      arr[o + 12] = v.x;
      arr[o + 13] = v.y;
      arr[o + 14] = 0.7;
      arr[o + 15] = 1;
      this._parseColor(r.color || '#5efce8', rgb);
      const a = Math.pow(Math.max(0, 1 - t), 1.5);
      col[n * 3] = rgb[0] * a;
      col[n * 3 + 1] = rgb[1] * a;
      col[n * 3 + 2] = rgb[2] * a;
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  _updateVfx(stage, time, pxw) {
    const list = stage.vfx || EMPTY;
    const rgb = this._rgb;
    const sub = stage.sub;
    const sc = this._subSc || 0.5;
    let maxId = this._lastVfxId;
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
            this._star(v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr, 0.8, sz, a + time * 3, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          }
          if (t < 0.35) this._glow(v.x, v.y, 0.7, S * 2.2 * (1 - t / 0.35), rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5);
          break;
        }
        case 'pop': {
          if (fresh) {
            const nd = e.size > 22 ? 12 : 6;
            for (let j = 0; j < nd; j++) {
              const a = (j / nd) * TAU + Math.random() * 0.4;
              const sp = 1.2 + Math.random() * 1.6;
              this._spawnWake(
                v.x + Math.cos(a) * S * 0.6,
                v.y + Math.sin(a) * S * 0.6,
                0.4,
                Math.cos(a) * sp,
                Math.sin(a) * sp,
                0.05 + Math.random() * 0.06,
                0.45 + Math.random() * 0.3,
                0.5,
                0
              );
            }
          }
          this._star(v.x, v.y, 0.8, S * 1.6 * k * k, e.id, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          break;
        }
        case 'muzzle': {
          if (fresh) {
            for (let j = 0; j < 4; j++) {
              this._spawnWake(
                v.x,
                v.y + (Math.random() - 0.5) * S,
                0.35,
                0.8 + Math.random() * 1.2,
                (Math.random() - 0.5) * 1.2,
                0.04 + Math.random() * 0.05,
                0.4,
                0.6,
                0
              );
            }
          }
          this._glow(v.x, v.y, 0.6, S * 3 * k, 0.35 * k, 0.65 * k, 0.75 * k);
          break;
        }
        case 'collect': {
          const tw = sub ? this._toWorld(sub.x, sub.y, 0, this._v3) : this._v3.set(e.tx * pxw, -e.ty * pxw, 0);
          const ease = t * t * (3 - 2 * t);
          const x = lerp(v.x, tw.x, ease);
          const y = lerp(v.y, tw.y, ease) + Math.sin(t * Math.PI) * 0.6 * sc;
          this._star(x, y, 0.9, sc * 0.9 * (0.5 + 0.5 * k), time * 6, rgb[0], rgb[1], rgb[2]);
          this._glow(x, y, 0.85, sc * 1.4, rgb[0] * 0.4, rgb[1] * 0.4, rgb[2] * 0.4);
          if (t > 0.85) this._glow(tw.x, tw.y, 0.9, sc * 3 * (t - 0.85) * 6, 0.3, 0.35, 0.3);
          break;
        }
        case 'whoosh': {
          const side = e.a || 1;
          const sv = sub ? this._toWorld(sub.x, sub.y, 0, this._v3) : v;
          for (let j = 0; j < 5; j++) {
            const off = (j - 2) * 0.16 * sc;
            const x = sv.x - (0.2 + t * 3.4 + Math.abs(j - 2) * 0.3) * sc;
            const y = sv.y - side * (0.72 * sc + off);
            const a = k * (1.0 - Math.abs(j - 2) * 0.22);
            this._glow(x, y, 0.85, sc * (2.6 - Math.abs(j - 2) * 0.4) * (0.4 + 0.6 * k), 0.45 * a, 0.95 * a, 1.0 * a, sc * 0.11);
          }
          if (t < 0.4) this._star(sv.x + sc * 0.2, sv.y - side * 0.6 * sc, 0.9, sc * 1.4 * (1 - t / 0.4), 0.4, 0.5, 0.95, 1.0);
          break;
        }
        case 'boom':
        case 'zap': {
          this._glow(v.x, v.y, 0.9, S * 0.25 * (1 + t * 2), rgb[0] * k, rgb[1] * k, rgb[2] * k);
          this._star(v.x, v.y, 1.0, S * 0.18 * k * (1 + t), e.id + t * 2, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          break;
        }
        case 'splash': {
          if (fresh) {
            for (let j = 0; j < 64; j++) {
              const a = Math.PI * 0.5 + (Math.random() - 0.5) * 1.7;
              const sp = 2.2 + Math.random() * 4.8;
              this._spawnWake(
                v.x + (Math.random() - 0.5) * sc * 2.6,
                this._surfW + 0.02,
                (Math.random() - 0.5) * 0.8 + 0.3,
                Math.cos(a) * sp * 0.6,
                Math.sin(a) * sp,
                0.025 + Math.random() * 0.06,
                1.0 + Math.random() * 0.6,
                -9.5,
                2
              );
            }
          }
          this._glow(v.x, this._surfW + 0.05, 0.9, sc * 5 * (0.4 + t), 0.6 * k, 0.7 * k, 0.75 * k, sc * 1.4 * k);
          break;
        }
        default:
          break;
      }
    }
    this._lastVfxId = maxId;
  }

  _spawnWake(x, y, z, vx, vy, size, life, g = 0.8, bio = 0) {
    const w = this.wake[this._wakeIdx];
    this._wakeIdx = (this._wakeIdx + 1) % MAX_WAKE;
    w.x = x;
    w.y = y;
    w.z = z;
    w.vx = vx;
    w.vy = vy;
    w.size = size;
    w.life = life;
    w.max = life;
    w.g = g;
    w.bio = bio;
  }

  _updateWake(stage, dt, seabedW, surfW, h) {
    const sub = stage.sub;
    const pxw = this._pxw(0);
    const worldSpeed = (stage.scrollSpeed || 0) * pxw;
    const bioAmt = this.U.uBio.value;
    const isOrig = this.era === 'original';

    if (sub && (sub.surfaced || 0) < 0.3) {
      const prop = sub.prop ?? 1;
      this._wakeAcc += dt * (10 + prop * 30);
      const sc = this._subSc || 0.5;
      while (this._wakeAcc > 1) {
        this._wakeAcc -= 1;
        this._wakeSwirl += 2.39996;
        const r = 0.14 * sc;
        const bio = Math.random() < bioAmt * 0.65 ? 1 : 0;
        const src = isOrig
          ? this._subTail
          : (this._wakeIdx & 1) === 0
          ? this._subTailL
          : this._subTailR;
        this._spawnWake(
          src.x + (Math.random() - 0.5) * 0.1 * sc,
          src.y + Math.sin(this._wakeSwirl) * r,
          src.z + Math.cos(this._wakeSwirl) * r,
          -(0.7 + prop * 1.1) - Math.random() * 0.5,
          0.12 + Math.random() * 0.3 + Math.sin(this._wakeSwirl) * 0.25,
          (0.045 + Math.random() * 0.085) * sc * 2.1,
          0.8 + Math.random() * 0.8,
          0.8,
          bio
        );
      }
    }

    this._ventAcc += dt * lerp(4, 9, h);
    while (this._ventAcc > 1) {
      this._ventAcc -= 1;
      const z = lerp(-1, -7, Math.random());
      const hw = this._halfW(z);
      this._spawnWake(
        (Math.random() * 2 - 1) * hw,
        seabedW + 0.1,
        z,
        0,
        0.6 + Math.random() * 0.6,
        0.06 + Math.random() * 0.08,
        3 + Math.random() * 3,
        0.8,
        0
      );
    }

    for (let i = 0; i < MAX_WAKE; i++) {
      const w = this.wake[i];
      if (w.life > 0) {
        w.life -= dt;
        if (w.g > 0) {
          w.vx *= Math.exp(-2 * dt);
          w.vy = Math.min(w.vy * Math.exp(-1.5 * dt) + dt * w.g * 1.4, 1.6);
          w.x += (w.vx - worldSpeed) * dt + Math.sin(w.life * 7 + i) * 0.004;
          w.y += w.vy * dt;
          if (w.y > surfW) w.life = 0;
        } else {
          w.vy += w.g * dt;
          w.x += w.vx * dt;
          w.y += w.vy * dt;
          if (w.vy < 0 && w.y < surfW) w.life = 0;
        }
      }
      const a = w.life > 0 ? Math.min(1, (w.life / w.max) * 2) : 0;
      this.wakePos[i * 3] = w.x;
      this.wakePos[i * 3 + 1] = w.y;
      this.wakePos[i * 3 + 2] = w.z;
      this.wakeSize[i] = w.size;
      this.wakeAlpha[i] = a * (w.bio === 1 ? 0.9 : 0.85);
      this.wakeBio[i] = w.bio;
    }
    const g = this.wakePoints.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aBio.needsUpdate = true;
  }

  _updateHud(stage, time, dt) {
    if (!this.showHud) {
      this.hudGroup.visible = false;
      this.comboRing.visible = false;
      this.comboText.visible = false;
      return;
    }
    const cine = this._cine;
    const hudA = 1 - smooth01(cine * 1.6);
    this.hudGroup.visible = hudA > 0.01;
    this.hudPanel.material.opacity = hudA;
    this.hudFill.material.opacity = hudA;
    this.hudHead.material.opacity = hudA;
    this.hudMarker.material.opacity = hudA;
    const p = clamp(stage.progress || 0, 0, 1);
    const x0 = this._trackX0 ?? 36;
    const x1 = this._trackX1 ?? this.width - 52;
    const y = -(this._trackY ?? 46);
    const w = Math.max(2, (x1 - x0) * p);
    this.hudFill.scale.set(w, 5, 1);
    this.hudFill.position.set(x0 + w / 2, y, 0);
    const mx = x0 + (x1 - x0) * p;
    this.hudHead.scale.set(22, 14, 1);
    this.hudHead.position.set(mx, y, 0);
    this.hudMarker.scale.set(30, 20, 1);
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
      const pulse = 1 + 0.45 * Math.exp(-Math.max(0, since) * 7) * Math.cos(since * 18);
      const R = 54 * (0.6 + 0.4 * easeOutBack(ca)) * pulse;
      const cx = this.width - 44;
      const cy = -94;
      this.comboRing.scale.set(R, R, 1);
      this.comboRing.position.set(cx, cy, 0);
      this.comboText.scale.set(R * 0.92, R * 0.92, 1);
      this.comboText.position.set(cx, cy, 0);
      this.comboMat.uniforms.uAlpha.value = ca;
      this.comboMat.uniforms.uProg.value = clamp((stage.comboTimer || 0) / (stage.comboTimerMax || 2.4), 0, 1);
      this.comboMat.uniforms.uCol.value.copy(this._comboCols[m >= 4 ? 2 : m === 3 ? 1 : 0]);
      this.comboText.material.opacity = ca;
    }
  }

  _updateCinematic(stage) {
    const cine = this._cine;
    const W = this.width;
    const H = this.height;
    const lb = H * 0.075 * smooth01(cine * 1.3);
    this.lbTop.visible = this.lbBot.visible = lb > 0.5;
    if (lb > 0.5) {
      this.lbTop.scale.set(W, lb, 1);
      this.lbTop.position.set(W / 2, -lb / 2, 0);
      this.lbBot.scale.set(W, lb, 1);
      this.lbBot.position.set(W / 2, -H + lb / 2, 0);
    }
    const wa = smooth01((cine - 0.72) / 0.22);
    this.waterline.visible = wa > 0.01;
    if (wa > 0.01) {
      const p = this._va.set(this.camera.position.x, this._surfW, this.camera.position.z - 120).project(this.camera);
      this.waterMat.uniforms.uLineY.value = (1 - p.y) * 0.5 * H;
      this.waterMat.uniforms.uAlpha.value = wa;
    }
    const at = stage.phase === 'arrive' || stage.phase === 'done' ? stage.arriveT || 0 : -1;
    if (at < 0) this._cardT0 = -1;
    else if (this._cardT0 < 0 && ((stage.sub && stage.sub.surfaced > 0.45) || at > 3.4)) this._cardT0 = Math.max(at, 1.9);
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
    const cx = wide ? Math.max((this._cardW * fit) / 2 + 14, W * 0.24) : W / 2;
    const cy = wide ? H * 0.1 + (this._cardH * fit) / 2 : H * 0.17 + this._cardH / 2;
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
      let e = pop.__subTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#ffffff')) {
        e = this._popupTex(pop.text, pop.color || '#ffffff');
        pop.__subTex = e;
      } else {
        e.used = this._popFrame;
      }
      if (m.material.map !== e.tex) {
        m.material.map = e.tex;
        m.material.needsUpdate = true;
      }
      const t = 1 - clamp(pop.life / (pop.maxLife || 1), 0, 1);
      const pin = t < 0.14 ? easeOutBack(t / 0.14) * 1.15 : 1.15 - Math.min(0.15, (t - 0.14) * 1.2);
      const hgt = 21 * s * Math.max(0.05, pin);
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
    if (this.pogoRig) {
      this.pogoRig.dispose();
    }
    const seen = new Set();
    const kill = (o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        // Do not dispose shared GLTF cached textures (`_glbCache`)
        if (m.map && m.map !== this.softDot && !seen.has(m.map) && m.map.isCanvasTexture) {
          seen.add(m.map);
          m.map.dispose();
        }
        if (m.emissiveMap && !seen.has(m.emissiveMap) && m.emissiveMap.isCanvasTexture) {
          seen.add(m.emissiveMap);
          m.emissiveMap.dispose();
        }
        m.dispose();
      }
    };
    this.scene.traverse(kill);
    this.overlay.traverse(kill);
    for (const e of this._popCache.values()) {
      if (e.tex && e.tex !== this.softDot) e.tex.dispose();
    }
    this._popCache.clear();
    for (const t of this._comboTex) if (t) t.dispose();
    this.bubbleTex?.dispose();
    this.starTex?.dispose();
    this.stoneNormalTex?.dispose();
    this.coralPorousNormalTex?.dispose();
    this._dummyWhiteTex?.dispose();
    this._markerTex?.dispose();
    if (this._ownSoftDot) this.softDot.dispose();
  }
}
