// THE GLIDE renderer: Pogo's hang-glider ride between worlds.
//
// Owns its own scene + cameras and draws a GlideStage (src/glideStage.js) into the game's shared
// THREE.WebGLRenderer, exactly like SubRenderer does for the submarine. Gameplay state is in
// CSS-pixel screen coordinates; every entity is mapped onto the z = 0 world plane by unprojecting
// through a fixed copy of the camera (`mapCam`), so what you see is exactly where the hit-boxes are.
// Scenery lives at real depths (clouds from 6 to 300 units away, islands and towers on the
// horizon) and gets its parallax from the perspective camera for free. The *view* camera may drift,
// follow and (for the launch and the landing) dolly in; screen-space effects (particles, popups)
// are re-projected through it so they stay glued to the world.
//
// Look: a living sky per world (dawn, day, snow, sunset, night, after-rain, gale, storm, ember):
// sun or moon with god rays, layered lit cumulus at real depths, the sea far below with a
// glittering sun path, islands and other worlds' towers on the horizon, the next world's tower
// growing as you approach, wind streaks, birds, rain / snow / embers, thermals shimmering up off
// the sea, and storm clouds that flicker before they strike.
//
// Performance notes: everything repeated is an InstancedMesh, materials/geometries are shared, the
// glider is merged per material (~5 draws), all per-frame work writes into preallocated typed arrays
// (no allocations in render()), and the whole frame stays well under ~110 draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 50;
const CAM_Z = 16;
const PITCH = 9 * DEG; // the camera looks a little up: horizon ~67% down the screen
const TOWER_Z = -6.5; // the next tower when you land beside it
const TOWER_FAR_Z = -300; // ... and when it first shows on the horizon
const SKY_Z = -400;

const MAX_LANTERN = 72;
const MAX_KITE = 8;
const MAX_GATE = 8;
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

// storm cloud = 4 puffs: [offset x, offset y, scale, atlas cell] (relative to the cloud width)
const STORM_PUFFS = [0, 0, 1.0, 0, -0.32, 0.06, 0.62, 1, 0.34, 0.03, 0.68, 2, 0.05, 0.22, 0.6, 3];

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
// Index = GlideStage.themeKey. sun: [x, y, z] direction (normalised at build); size in radians.
const THEMES = {
  dawn: {
    top: '#2c4a96', mid: '#d98a9a', hor: '#ffc98f', haze: '#f0b993', sun: '#ffc27a', sunDir: [-0.14, 0.09, -1], sunSize: 0.05,
    stars: 0.0, moon: 0, rays: 0.55, cirrus: 0.6, rainbow: 0,
    cloudLit: '#fff1de', cloudShade: '#b48aa3', cloudRim: '#ffd59a', sea: '#24507e', seaFar: '#7d8fb4', glint: 1.1, chop: 0.6, foam: 0.15,
    isle: '#3d5d4a', isleFar: '#8f8fa8', hemiSky: '#ffd9c0', hemiGround: '#2a3f5f', light: '#ffd7a8', lightI: 2.4, exposure: 1.05,
    precip: 'none', lanternK: 1.0, birds: 1, wind: 0.5,
  },
  day: {
    top: '#1d5fcf', mid: '#4f97e6', hor: '#bfe2ff', haze: '#b9dcf5', sun: '#fff3d6', sunDir: [-0.1, 0.36, -1], sunSize: 0.04,
    stars: 0, moon: 0, rays: 0.35, cirrus: 0.8, rainbow: 0,
    cloudLit: '#ffffff', cloudShade: '#93acd0', cloudRim: '#ffffff', sea: '#0f4f86', seaFar: '#4f97c8', glint: 1.2, chop: 0.7, foam: 0.2,
    isle: '#3f7a4c', isleFar: '#8fb0c6', hemiSky: '#dff1ff', hemiGround: '#2d5a7a', light: '#fff6e4', lightI: 2.8, exposure: 1.0,
    precip: 'none', lanternK: 0.8, birds: 1, wind: 0.6,
  },
  snow: {
    top: '#6f8db3', mid: '#a9bfd6', hor: '#e6eef6', haze: '#dfe8f1', sun: '#f4f8ff', sunDir: [-0.05, 0.24, -1], sunSize: 0.045,
    stars: 0, moon: 0, rays: 0.25, cirrus: 0.3, rainbow: 0,
    cloudLit: '#f7fbff', cloudShade: '#9aa9bf', cloudRim: '#ffffff', sea: '#3d607d', seaFar: '#bccbd8', glint: 0.8, chop: 0.75, foam: 0.35,
    isle: '#e8eef4', isleFar: '#b8c6d6', hemiSky: '#eaf2ff', hemiGround: '#5b6f86', light: '#f2f6ff', lightI: 2.1, exposure: 1.02,
    precip: 'snow', lanternK: 1.0, birds: 0.6, wind: 0.8,
  },
  sunset: {
    top: '#2c2366', mid: '#d4567e', hor: '#ffb066', haze: '#f59a6a', sun: '#ffb45c', sunDir: [-0.12, 0.045, -1], sunSize: 0.07,
    stars: 0.15, moon: 0, rays: 0.7, cirrus: 0.7, rainbow: 0,
    cloudLit: '#ffc59a', cloudShade: '#7a3f6e', cloudRim: '#ffd37a', sea: '#3b2f6a', seaFar: '#d98c86', glint: 1.6, chop: 0.6, foam: 0.12,
    isle: '#3a2a4a', isleFar: '#9a6f8f', hemiSky: '#ffb592', hemiGround: '#3a2552', light: '#ffb070', lightI: 2.3, exposure: 1.05,
    precip: 'none', lanternK: 1.4, birds: 1, wind: 0.5,
  },
  night: {
    top: '#040921', mid: '#0f1d48', hor: '#2b3f78', haze: '#26386a', sun: '#dfe8ff', sunDir: [-0.1, 0.3, -1], sunSize: 0.05,
    stars: 1.0, moon: 1, rays: 0.12, cirrus: 0.35, rainbow: 0,
    cloudLit: '#7d8fc4', cloudShade: '#1a2246', cloudRim: '#c9d6ff', sea: '#050d22', seaFar: '#1d2c58', glint: 0.6, chop: 0.55, foam: 0.05,
    isle: '#0f1730', isleFar: '#26355f', hemiSky: '#6f84c8', hemiGround: '#0b1028', light: '#c9d6ff', lightI: 1.0, exposure: 1.12,
    precip: 'fireflies', lanternK: 2.1, birds: 0, wind: 0.4,
  },
  rain: {
    top: '#4c76a8', mid: '#9fbbd2', hor: '#e8efe6', haze: '#dbe5df', sun: '#fff1cf', sunDir: [-0.1, 0.16, -1], sunSize: 0.045,
    stars: 0, moon: 0, rays: 0.6, cirrus: 0.4, rainbow: 1,
    cloudLit: '#ffffff', cloudShade: '#8496ad', cloudRim: '#fff6dc', sea: '#2f6a86', seaFar: '#b6cdd2', glint: 1.3, chop: 0.65, foam: 0.2,
    isle: '#3b7a4f', isleFar: '#93adb4', hemiSky: '#e6f3ff', hemiGround: '#3a5a6a', light: '#fff3d6', lightI: 2.5, exposure: 1.0,
    precip: 'drizzle', lanternK: 0.9, birds: 1, wind: 0.6,
  },
  gale: {
    top: '#3a6fbe', mid: '#8bb3dc', hor: '#f4dfb4', haze: '#ecd8b0', sun: '#ffe0a0', sunDir: [-0.1, 0.2, -1], sunSize: 0.05,
    stars: 0, moon: 0, rays: 0.5, cirrus: 1.0, rainbow: 0,
    cloudLit: '#fff4e0', cloudShade: '#a49aa6', cloudRim: '#ffe6b0', sea: '#2a5f8c', seaFar: '#c9c3ad', glint: 1.4, chop: 1.0, foam: 0.45,
    isle: '#7d8a4a', isleFar: '#b0a68c', hemiSky: '#ffeccc', hemiGround: '#40506a', light: '#ffe4b0', lightI: 2.6, exposure: 1.02,
    precip: 'leaves', lanternK: 1.0, birds: 1, wind: 1.0,
  },
  storm: {
    top: '#151b2a', mid: '#2c3446', hor: '#59647a', haze: '#4a5468', sun: '#8f9cb8', sunDir: [-0.1, 0.25, -1], sunSize: 0.05, disc: 0,
    stars: 0, moon: 0, rays: 0.05, cirrus: 0.0, rainbow: 0,
    cloudLit: '#8a95ab', cloudShade: '#262c3b', cloudRim: '#b9c6e0', sea: '#0f1d26', seaFar: '#3a4656', glint: 0.25, chop: 1.1, foam: 0.4,
    isle: '#1c2430', isleFar: '#3d4758', hemiSky: '#8e9bb4', hemiGround: '#1a2230', light: '#b8c4dc', lightI: 1.1, exposure: 1.15,
    precip: 'rain', lanternK: 1.6, birds: 0, wind: 0.9,
  },
  ember: {
    top: '#1d0a24', mid: '#6a1838', hor: '#ff7438', haze: '#c4483a', sun: '#ff6a2a', sunDir: [-0.08, 0.035, -1], sunSize: 0.08,
    stars: 0.35, moon: 0, rays: 0.6, cirrus: 0.5, rainbow: 0,
    cloudLit: '#ff9a6a', cloudShade: '#3a1430', cloudRim: '#ffb05a', sea: '#230d1e', seaFar: '#a3423a', glint: 1.5, chop: 0.7, foam: 0.12,
    isle: '#1a0d14', isleFar: '#6a2a2e', hemiSky: '#ff9c6e', hemiGround: '#2a0e1c', light: '#ff8a50', lightI: 1.8, exposure: 1.08,
    precip: 'embers', lanternK: 1.5, birds: 0.3, wind: 0.6,
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
    for (const name of Object.keys(ng.attributes)) if (!STD_ATTRS.includes(name)) ng.deleteAttribute(name);
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
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
// a cylinder between two points
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

// Cumulus atlas (2 x 2 cells of 256 x 128): R/G/B = how sun-lit the puff is (top-left lit), A = density
function makeCloudAtlas() {
  const rng = mulberry32(2024);
  return canvasTex(
    512,
    256,
    (ctx) => {
      ctx.clearRect(0, 0, 512, 256);
      for (let cell = 0; cell < 4; cell++) {
        const ox = (cell % 2) * 256;
        const oy = Math.floor(cell / 2) * 128;
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, 256, 128);
        ctx.clip();
        // puffs: a flat-bottomed heap, big in the middle, small at the ends
        const puffs = [];
        const n = 16 + Math.floor(rng() * 8);
        for (let k = 0; k < n; k++) {
          const u = rng();
          const spread = cell === 3 ? 0.95 : 0.8;
          const x = 128 + (u - 0.5) * 256 * spread;
          const hump = 1 - Math.pow(Math.abs(u - 0.5) * 2, 1.6);
          const r = (14 + rng() * 18) * (0.55 + hump * 0.75) * (cell === 2 ? 0.8 : 1);
          const y = 104 - r * 0.55 - hump * (cell === 3 ? 20 : 40) * rng();
          puffs.push([x, y, r]);
        }
        // shadow pass (whole heap, grey), then lit caps offset toward the sun
        for (const [x, y, r] of puffs) {
          const g = ctx.createRadialGradient(ox + x, oy + y, r * 0.2, ox + x, oy + y, r);
          g.addColorStop(0, 'rgba(120,120,120,1)');
          g.addColorStop(0.75, 'rgba(105,105,105,0.95)');
          g.addColorStop(1, 'rgba(100,100,100,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(ox + x, oy + y, r, 0, TAU);
          ctx.fill();
        }
        for (const [x, y, r] of puffs) {
          const cx = ox + x - r * 0.22;
          const cy = oy + y - r * 0.3;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.95);
          g.addColorStop(0, 'rgba(255,255,255,0.95)');
          g.addColorStop(0.55, 'rgba(235,235,235,0.6)');
          g.addColorStop(1, 'rgba(200,200,200,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.95, 0, TAU);
          ctx.fill();
        }
        // flatten the base
        const fade = ctx.createLinearGradient(0, oy + 96, 0, oy + 124);
        fade.addColorStop(0, 'rgba(0,0,0,0)');
        fade.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = fade;
        ctx.fillRect(ox, oy + 96, 256, 32);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }
    },
    { srgb: false }
  );
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

// write a scale/rotZ/translate matrix straight into an instance array (no Object3D)
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

// Patch a MeshStandardMaterial: rim light, self light, back-lit translucency (sails), gull wing flap.
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
      // gull wings: shoulder + elbow joints driven by the per-instance flap phase (aAnim.x)
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
    if (backLit) ef += 'if (!gl_FrontFacing) totalEmissiveRadiance += diffuseColor.rgb * uBackCol * uBackLit;\nelse totalEmissiveRadiance += diffuseColor.rgb * uBackCol * uBackLit * 0.35;\n';
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

// ---------------------------------------------------------------------------------- geometry builders
function buildIsland(rng, { peaks = 2, flat = 0.4 } = {}) {
  // a lumpy island: rocky cliffs, a green crown, a sand rim at the waterline
  const g = new THREE.CylinderGeometry(1, 1.15, 1, 28, 6, false);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  const ph = [rng() * TAU, rng() * TAU, rng() * TAU];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    let r = 1 + Math.sin(a * 3 + ph[0]) * 0.12 + Math.sin(a * 7 + ph[1]) * 0.06;
    let h = y;
    if (y > 0.99) {
      // crown: a few soft peaks
      let pk = 0;
      for (let k = 0; k < peaks; k++) {
        const pa = ph[k % 3] + k * 2.1;
        const d = Math.hypot(Math.cos(a) * 0.5 - Math.cos(pa) * 0.35, Math.sin(a) * 0.5 - Math.sin(pa) * 0.35);
        pk = Math.max(pk, Math.exp(-d * d * 6));
      }
      h = 1 + pk * (1 - flat) * 0.55;
      r *= 0.78 - pk * 0.25;
    } else {
      r *= 1 - y * y * 0.2;
    }
    p.setXYZ(i, x * r, h, z * r);
  }
  // collapse the top cap toward the centre peak
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const rock = 0.55 + 0.1 * Math.sin(x * 9 + z * 7);
    if (y < 0.08) {
      c[0] = 1.0;
      c[1] = 0.9;
      c[2] = 0.66; // sand
    } else if (y > 0.82) {
      c[0] = 0.35;
      c[1] = 0.75;
      c[2] = 0.35; // grass
    } else {
      c[0] = rock * 0.9;
      c[1] = rock * 0.82;
      c[2] = rock * 0.72;
    }
  });
  return g;
}

function buildFarTower() {
  // slender stepped tower with a spire (other worlds on the horizon)
  const parts = [];
  const body = new THREE.CylinderGeometry(0.5, 0.62, 1, 10, 1);
  body.translate(0, 0.5, 0);
  parts.push(solid(body, 1, 1, 1));
  const ring = new THREE.CylinderGeometry(0.62, 0.62, 0.05, 10, 1);
  place(ring, 0, 1.0, 0);
  parts.push(solid(ring, 0.8, 0.8, 0.8));
  const spire = new THREE.ConeGeometry(0.42, 0.22, 10);
  place(spire, 0, 1.13, 0);
  parts.push(solid(spire, 0.9, 0.9, 0.9));
  return merge(parts);
}

function buildLantern() {
  // paper sky lantern: lathe, wider near the top, open at the bottom with a little burner ring
  const pts = [];
  const prof = [
    [0.36, -0.62],
    [0.5, -0.45],
    [0.62, -0.1],
    [0.68, 0.22],
    [0.62, 0.5],
    [0.44, 0.7],
    [0.06, 0.78],
  ];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 16);
  const rim = new THREE.TorusGeometry(0.36, 0.035, 5, 16);
  place(rim, 0, -0.62, 0, Math.PI / 2);
  return merge([g, rim]);
}

function buildKiteGeo() {
  // a five-point star kite (flat, double-sided), UVs from shape coordinates
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
    // a slight bow so it catches light
    p.setZ(i, -0.12 * (1 - Math.hypot(p.getX(i), p.getY(i))));
  }
  g.computeVertexNormals();
  return g;
}

function buildKiteTail() {
  // ribbon with three bows; x from 0 (kite) to -1 (end); waved in the shader
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
  // local: facing -X (flies leftward), wings along +-Z, up +Y; wing colours in vertex colours
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
  // wings: tapered, swept panels from the shoulder out to the tip
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
function cloudMaterial(U, tex, { fg = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uLit: U.uCloudLit,
      uShade: U.uCloudShade,
      uRim: U.uCloudRim,
      uHaze: U.uHaze,
      uFlash: U.uFlash,
      uTime: U.uTime,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aCloud; // x: atlas cell, y: brightness, z: opacity, w: storm (0..1) / flicker
      varying vec2 vUv; varying vec4 vC; varying float vDepth;
      void main(){
        float cell = aCloud.x;
        vec2 o = vec2(mod(cell, 2.0), floor(cell / 2.0)) * 0.5;
        vUv = o + uv * 0.5;
        vC = aCloud;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uRim; uniform vec3 uHaze; uniform float uFlash; uniform float uTime;
      varying vec2 vUv; varying vec4 vC; varying float vDepth;
      ${GLSL_NOISE}
      void main(){
        vec4 t = texture2D(uMap, vUv);
        vec2 q = vUv * vec2(9.0, 18.0) + vC.x * 3.7;
        float nz = fbm3(q + vec2(uTime * 0.03, 0.0));
        float dens = t.a + (nz - 0.5) * 0.55 * (1.0 - t.a * 0.6);
        float a = smoothstep(0.12, 0.55, dens) * vC.z;
        if (a < 0.004) discard;
        float lum = clamp(t.r + (nz - 0.5) * 0.25, 0.0, 1.0);
        float storm = clamp(vC.w, 0.0, 1.0);
        float flick = max(vC.w - 1.0, 0.0);
        vec3 lit = mix(uLit, uLit * 0.42 + uShade * 0.2, storm);
        vec3 sh = mix(uShade, uShade * 0.35, storm);
        vec3 col = mix(sh, lit, smoothstep(0.42, 0.9, lum)) * vC.y;
        // silver lining where the puff thins out
        float edge = smoothstep(0.12, 0.3, dens) * (1.0 - smoothstep(0.3, 0.75, dens));
        col += uRim * edge * (0.2 + 0.3 * lum) * (1.0 - storm * 0.7);
        // storm cloud lighting up from inside before a strike
        col += vec3(0.75, 0.82, 1.0) * flick * (0.4 + 0.6 * lum);
        col += vec3(0.85, 0.9, 1.0) * uFlash * 0.6 * lum;
        ${fg ? '' : 'col = mix(col, uHaze, smoothstep(60.0, 420.0, vDepth) * 0.7);'}
        gl_FragColor = vec4(col, a);
        ${GLSL_OUT}
      }`,
  });
}

function lanternMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uK: U.uLanternK },
    vertexShader: /* glsl */ `
      attribute float aGlow;
      varying vec3 vL; varying vec3 vC; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        vL = position; vC = instanceColor; vG = aGlow;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal)); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uK;
      varying vec3 vL; varying vec3 vC; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = atan(vL.z, vL.x);
        float ribs = 0.82 + 0.18 * pow(abs(cos(a * 4.0)), 6.0);
        float flame = smoothstep(0.75, -0.65, vL.y);
        float flick = 0.88 + 0.12 * sin(uTime * 13.0 + vG * 40.0) * sin(uTime * 7.3 + vL.y);
        float ndv = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        vec3 paper = vC * (0.45 + 1.25 * flame * flick) * ribs * (0.75 + 0.25 * ndv);
        paper += vec3(1.0, 0.86, 0.55) * pow(flame, 2.0) * 0.55 * flick;
        paper *= mix(1.0, uK, 0.6) * (1.0 + vG * 0.8);
        float band = smoothstep(0.69, 0.72, vL.y) + smoothstep(-0.56, -0.6, vL.y);
        paper = mix(paper, vC * 0.25, clamp(band, 0.0, 1.0) * 0.6);
        gl_FragColor = vec4(paper, 1.0);
        ${GLSL_OUT}
      }`,
  });
}

function gateMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: /* glsl */ `
      attribute float aGlow;
      varying vec3 vL; varying vec3 vC; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        vL = position; vC = instanceColor; vG = aGlow;
        vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal)); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vL; varying vec3 vC; varying float vG; varying vec3 vN; varying vec3 vV;
      void main(){
        float a = atan(vL.y, vL.x);
        // bulbs around the hoop, chasing toward the top
        float cell = fract(a / 6.2831853 * 16.0);
        float bulb = smoothstep(0.32, 0.1, abs(cell - 0.5));
        float chase = pow(0.5 + 0.5 * sin(a * 2.0 - uTime * 9.0 + floor(a / 6.2831853 * 16.0) * 0.6), 3.0);
        vec3 n = normalize(vN);
        float lam = clamp(dot(n, normalize(vec3(-0.4, 0.7, 0.6))), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(-normalize(vec3(-0.4, 0.7, 0.6)), n), normalize(vV)), 0.0, 1.0), 24.0);
        vec3 metal = vC * (0.35 + 0.75 * lam) + vec3(1.0, 0.95, 0.8) * spec * 0.8;
        vec3 lit = mix(vec3(1.0, 0.92, 0.6), vec3(0.75, 1.0, 1.0), chase) * (1.4 + chase * 1.4);
        vec3 col = mix(metal, lit, bulb * vG * (0.45 + 0.55 * chase));
        gl_FragColor = vec4(col, 1.0);
        ${GLSL_OUT}
      }`,
  });
}

function thermalMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color('#ffcf7a') } },
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
        float wob = (vnoise(vec2(vUv.y * 4.0 - uTime * 0.9, vPh)) - 0.5) * 0.35;
        float edge = 1.0 - smoothstep(0.35, 1.0, abs(x + wob));
        float shimmer = vnoise(vec2(vUv.x * 7.0 + wob * 3.0, vUv.y * 9.0 - uTime * 2.2 + vPh));
        shimmer = 0.45 + 0.75 * shimmer;
        // rising chevrons: "this air goes UP"
        float cy = fract(vUv.y * 11.0 - uTime * 1.6 + vPh);
        float row = floor(vUv.y * 11.0 - uTime * 1.6 + vPh);
        float cx = x * 2.4 + sin(row * 1.7) * 0.5;
        float chev = smoothstep(0.09, 0.0, abs(cy - 0.5 + abs(cx) * 0.35)) * (1.0 - smoothstep(0.18, 0.42, abs(cx)));
        float fadeY = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
        float body = edge * shimmer * 0.035;
        float a = (body + chev * 0.2) * fadeY * vC.r;
        vec3 col = uColor * (body + chev * 0.55) * fadeY * vC.r;
        gl_FragColor = vec4(col, a * 0.7);
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
    uniforms: { uTime: U.uTime, uColor: { value: new THREE.Color('#4d5868') } },
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
        streaks = smoothstep(0.55, 0.95, streaks);
        float body = (1.0 - smoothstep(0.4, 1.0, abs(x))) * smoothstep(1.0, 0.9, vUv.y) * smoothstep(0.0, 0.5, vUv.y);
        float a = body * (0.1 + streaks * 0.35) * vC.r;
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
        // white-hot core, violet halo: reads on a dark storm and on a bright day alike
        vec3 col = mix(vec3(0.42, 0.36, 0.95) * halo, vec3(1.0, 1.0, 1.0) * 1.3, core);
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
      uColor: { value: new THREE.Color('#ffffff') },
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
        float fall = uKind < 0.5 ? 0.9 + fract(aSeed * 7.0) * 0.8   // snow
                   : uKind < 1.5 ? 16.0 + fract(aSeed * 7.0) * 6.0  // rain
                   : uKind < 2.5 ? -1.2 - fract(aSeed * 7.0) * 1.6  // embers rise
                   : uKind < 3.5 ? -0.15                             // fireflies hover
                   : uKind < 4.5 ? 0.7 + fract(aSeed * 7.0) * 0.6  // leaves
                   : 7.0 + fract(aSeed * 7.0) * 3.0;                // drizzle
        float par = 1.0 + max(p.z, 0.0) * 0.06;
        float sway = sin(uTime * (0.6 + fract(aSeed * 3.0)) + aSeed * 30.0) * (uKind > 2.5 ? 1.2 : 0.6);
        p.x = mod(p.x - uScrollW * par - uTime * uWind * (1.0 + fract(aSeed * 5.0)) + sway + uSpan * 0.5, uSpan) - uSpan * 0.5;
        p.y = uYmin + mod(p.y - uYmin - uTime * fall, hgt);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float sz = uKind < 0.5 ? 0.09 + fract(aSeed * 13.0) * 0.11
                 : uKind < 1.5 ? 0.22
                 : uKind < 2.5 ? 0.05 + fract(aSeed * 13.0) * 0.07
                 : uKind < 3.5 ? 0.05 + fract(aSeed * 13.0) * 0.05
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
        if (uKind > 0.5 && uKind < 1.5 || uKind > 4.5) {
          // rain: a slanted streak
          vec2 r = vec2(q.x + q.y * 0.18, q.y);
          a = (1.0 - smoothstep(0.0, 0.05, abs(r.x))) * (1.0 - smoothstep(0.2, 0.5, abs(r.y)));
        } else if (uKind > 3.5) {
          // leaves: a little spinning ellipse
          float c = cos(vRot), s = sin(vRot);
          vec2 r = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          a = 1.0 - smoothstep(0.2, 0.26, length(r * vec2(1.0, 2.2)));
          col = mix(vec3(0.95, 0.62, 0.18), vec3(0.62, 0.78, 0.22), fract(vSeed * 11.0));
        } else {
          a = texture2D(uMap, gl_PointCoord).a;
          if (uKind > 1.5 && uKind < 2.5) col = mix(uColor, vec3(1.0, 0.85, 0.4), fract(vSeed * 11.0));
        }
        float k = a * vA * uAlpha;
        gl_FragColor = vec4(col * k, k * (1.0 - uAdd));
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------------- renderer
const EMPTY = [];

export class GlideRenderer {
  constructor(webglRenderer, { softDotTex } = {}) {
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this._ownSoftDot = !softDotTex;
    this.starTex = makeStarTex();
    this.width = 390;
    this.height = 620;
    this.exposure = 1.05;
    this._kx = 1;
    this._ky = 1;

    const U = (this.U = {
      uTime: { value: 0 },
      uScrollW: { value: 0 },
      uSeaY: { value: -5 },
      uHaze: { value: new THREE.Color('#cfe6f7') },
      uSkyTop: { value: new THREE.Color() },
      uSkyMid: { value: new THREE.Color() },
      uSkyHor: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.3, -1).normalize() },
      uCloudLit: { value: new THREE.Color() },
      uCloudShade: { value: new THREE.Color() },
      uCloudRim: { value: new THREE.Color() },
      uFlash: { value: 0 },
      uLanternK: { value: 1 },
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    this.scene.fog = new THREE.Fog(U.uHaze.value, 60, 520);

    this.camera = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 900);
    this.camera.position.set(0, 0, CAM_Z);
    this.camera.rotation.x = PITCH;
    this.mapCam = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 900);
    this.mapCam.position.set(0, 0, CAM_Z);
    this.mapCam.rotation.x = PITCH;

    // scratch
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
    this._themeKey = '';
    this._lastTime = null;
    this._glowColor = new THREE.Color('#38bdf8');
    this._glowHex = '';
    this._summitHex = '';
    this._cine = 0;
    this._intro = 0;
    this._camFX = 0;
    this._camFY = 0;
    this._seaW = -5;
    this._flash = 0;
    this._ambFlashT = 3;
    // glider animation state (springs driven by gameplay counters)
    this._sq = 0;
    this._sqV = 0;
    this._cheer = 0;
    this._flapAnim = 0;
    this._wob = 0;
    this._lastFlaps = 0;
    this._lastCatches = 0;
    this._lastHits = 0;
    this._lastSkims = 0;
    this._lastVfxId = 0;
    this._legPh = 0;
    this._streakAcc = 0;
    this._moteAcc = 0;

    this.colors = {};
    this._lanternCols = LANTERN_HEX.map((h) => new THREE.Color(h));
    this._kiteCols = KITE_HEX.map((h) => new THREE.Color(h));
    this._gold = new THREE.Color(GOLD_HEX);
    this._white = new THREE.Color(1, 1, 1);
    this._birdCol = new THREE.Color('#888888');

    this._buildLights();
    this._buildSky();
    this._buildSea();
    this._buildScenery();
    this._buildClouds();
    this._buildGlider();
    this._buildEntities();
    this._buildTowers();
    this._buildOverlay();
    this.resize(390, 620);
  }

  // ------------------------------------------------------------------ mapping
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

  // world y at depth z for an elevation angle (radians) above the camera's eye level
  _elevY(z, elev) {
    return Math.tan(elev) * (CAM_Z - z);
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
      for (const it of layer.items) it.span = 2 * this._halfW(it.z) + layer.margin + Math.abs(it.z) * 0.15;
    }
    const sw = 2 * this._halfW(-10) + 8;
    this.precipMat.uniforms.uSpan.value = sw;
    this.vignette.scale.set(width, height, 1);
    this.vignette.position.set(width / 2, -height / 2, -5);
    this._hudDrawn = null;
    this._cardForW = 0;
  }

  // ------------------------------------------------------------------ build: lights, sky, sea
  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#dff1ff', '#2d5a7a', 1.6);
    this.sunLight = new THREE.DirectionalLight('#fff6e4', 2.6);
    this.sunLight.position.set(-3, 9, -6);
    this.fill = new THREE.DirectionalLight('#ffffff', 0.7); // back rim from the sun side
    this.fill.position.set(-2, 4, -12);
    this.scene.add(this.hemi, this.sunLight, this.fill);
  }

  _buildSky() {
    const U = this.U;
    const geo = new THREE.PlaneGeometry(1400, 620);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uTop: U.uSkyTop,
        uMid: U.uSkyMid,
        uHor: U.uSkyHor,
        uSunCol: U.uSunCol,
        uSunDir: U.uSunDir,
        uSunSize: { value: 0.05 },
        uStars: { value: 0 },
        uMoon: { value: 0 },
        uRays: { value: 0.4 },
        uCirrus: { value: 0.5 },
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
        uniform float uTime; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSunCol; uniform vec3 uSunDir;
        uniform float uSunSize; uniform float uStars; uniform float uMoon; uniform float uRays; uniform float uCirrus; uniform float uRainbow;
        uniform float uFlash; uniform float uScrollW; uniform float uDisc;
        varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          vec3 d = normalize(vW - cameraPosition);
          float e = d.y;
          vec3 col = mix(uHor, uMid, smoothstep(-0.01, 0.2, e));
          col = mix(col, uTop, smoothstep(0.14, 0.62, e));
          float sd = clamp(dot(d, uSunDir), -1.0, 1.0);
          float ang = acos(sd);
          // stars (fade toward the horizon), a few twinkling
          if (uStars > 0.0) {
            vec2 sp = vec2(atan(d.x, -d.z), e) * 160.0;
            vec2 gi = floor(sp);
            float h = hash12(gi);
            vec2 f = fract(sp) - 0.5 - (vec2(hash12(gi + 7.1), hash12(gi + 3.3)) - 0.5) * 0.6;
            float st = step(0.965, h) * smoothstep(0.12, 0.0, length(f)) * (0.5 + 0.5 * sin(uTime * (1.0 + h * 4.0) + h * 70.0));
            float big = step(0.996, h) * smoothstep(0.3, 0.0, length(f));
            col += vec3(0.85, 0.9, 1.0) * (st + big * 1.5) * uStars * smoothstep(0.02, 0.25, e);
          }
          // high cirrus wisps
          vec2 cp = vec2(d.x / max(e + 0.25, 0.05) * 2.0 + uTime * 0.004 + uScrollW * 0.0006, e * 6.0);
          float ci = fbm3(cp * vec2(1.0, 4.0)) * fbm3(cp * vec2(3.0, 9.0) + 2.0);
          ci = smoothstep(0.22, 0.5, ci) * smoothstep(0.05, 0.25, e) * (1.0 - smoothstep(0.55, 0.9, e));
          col = mix(col, mix(uHor, vec3(1.0), 0.6) + uSunCol * 0.15, ci * uCirrus * 0.45);
          // god rays: angular streaks fanning out from the sun
          vec3 rel = d - uSunDir * sd;
          float ra = atan(rel.y, rel.x);
          float rays = vnoise(vec2(ra * 7.0, uTime * 0.07)) * 0.6 + vnoise(vec2(ra * 19.0, uTime * 0.11 + 4.0)) * 0.4;
          rays = smoothstep(0.35, 0.85, rays) * exp(-ang * 2.6) * smoothstep(0.03, 0.12, ang);
          col += uSunCol * rays * uRays * 0.4;
          // sun (or moon)
          float disc = smoothstep(uSunSize, uSunSize * 0.86, ang);
          if (uMoon > 0.5) {
            vec3 md = normalize(uSunDir + vec3(0.012, 0.008, 0.0));
            float shadow = smoothstep(uSunSize * 0.95, uSunSize * 0.8, acos(clamp(dot(d, md), -1.0, 1.0)));
            vec2 mp = (d.xy - uSunDir.xy) / uSunSize;
            float crater = vnoise(mp * 3.0 + 5.0) * 0.25 + vnoise(mp * 7.0) * 0.12;
            vec3 moonCol = vec3(0.93, 0.95, 1.0) * (0.85 - crater);
            col = mix(col, moonCol * 1.6, disc * (1.0 - shadow * 0.92));
            col += uSunCol * (exp(-ang * 9.0) * 0.35 + exp(-ang * 30.0) * 0.3);
          } else {
            col = mix(col, uSunCol * 3.0 + vec3(0.6), disc * uDisc);
            col += uSunCol * (exp(-ang * 9.0) * 0.3 + (exp(-ang * 22.0) * 0.5 + exp(-ang * 60.0) * 0.7) * uDisc);
          }
          // warm glow along the horizon under the sun
          col += uSunCol * exp(-abs(e) * 14.0) * pow(max(sd, 0.0), 6.0) * 0.6;
          // rainbow after the rain (an arc to the right of the view)
          if (uRainbow > 0.0) {
            vec3 rc = normalize(vec3(0.55, -0.32, -1.0));
            float rr = acos(clamp(dot(d, rc), -1.0, 1.0));
            float band = (rr - 0.62) / 0.05;
            vec3 rb = clamp(vec3(1.0 - abs(band - 0.85) * 1.6, 1.0 - abs(band - 0.15) * 1.6, 1.0 - abs(band + 0.65) * 1.6), 0.0, 1.0);
            float ra2 = smoothstep(1.4, 0.4, abs(band)) * smoothstep(0.0, 0.08, e);
            col = mix(col, col + rb * 0.55, ra2 * uRainbow);
          }
          // haze at the horizon
          col = mix(col, uHor, exp(-max(e, 0.0) * 30.0) * 0.6);
          col += vec3(0.75, 0.82, 1.0) * uFlash * 0.45 * (0.6 + 0.4 * smoothstep(0.0, 0.4, e));
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
    const geo = new THREE.PlaneGeometry(1600, 440, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -200);
    this.seaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uSkyTop: U.uSkyTop,
        uSkyHor: U.uSkyHor,
        uSunCol: U.uSunCol,
        uSunDir: U.uSunDir,
        uHaze: U.uHaze,
        uFlash: U.uFlash,
        uDeep: { value: new THREE.Color() },
        uFar: { value: new THREE.Color() },
        uGlint: { value: 1 },
        uChop: { value: 0.6 },
        uFoam: { value: 0.2 },
        uMoon: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vW; varying float vDist;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunCol; uniform vec3 uSunDir;
        uniform vec3 uHaze; uniform float uFlash; uniform vec3 uDeep; uniform vec3 uFar; uniform float uGlint; uniform float uChop; uniform float uFoam; uniform float uMoon;
        varying vec3 vW; varying float vDist;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vec2(vW.x + uScrollW, vW.z);
          float t = uTime;
          // swell + chop: analytic gradient of a few travelling waves, plus noise ripples
          vec2 g = vec2(0.0);
          g += vec2(0.55, 0.35) * cos(dot(p, vec2(0.55, 0.35)) * 1.0 + t * 1.1) * 0.5;
          g += vec2(-0.3, 0.8) * cos(dot(p, vec2(-0.3, 0.8)) * 1.3 + t * 1.4) * 0.35;
          g += vec2(0.9, -0.2) * cos(dot(p, vec2(0.9, -0.2)) * 2.1 - t * 1.9) * 0.2;
          float n1 = vnoise(p * 1.6 + vec2(t * 0.4, t * 0.25));
          float n2 = vnoise(p * 3.7 - vec2(t * 0.6, -t * 0.3));
          g += (vec2(n1, n2) - 0.5) * 0.9;
          float fadeN = 1.0 / (1.0 + vDist * 0.03);
          vec3 n = normalize(vec3(-g.x * uChop * 0.28 * fadeN, 1.0, -g.y * uChop * 0.28 * fadeN));
          vec3 v = normalize(cameraPosition - vW);
          vec3 r = reflect(-v, n);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 sky = mix(uSkyHor, uSkyTop, smoothstep(0.0, 0.3, r.y)) * 0.8;
          float sd = max(dot(r, uSunDir), 0.0);
          float spec = pow(sd, 400.0) * 3.0 + pow(sd, 90.0) * 0.22;
          // glitter: sparkles in the sun path
          vec2 gp = p * vec2(5.0, 10.0);
          float sp = hash12(floor(gp) + floor(t * 7.0));
          float glit = step(0.94, sp) * pow(sd, 6.0) * smoothstep(0.5, 0.0, length(fract(gp) - 0.5)) * smoothstep(10.0, 40.0, vDist);
          vec3 water = mix(uDeep, uFar, smoothstep(40.0, 300.0, vDist));
          water *= 0.85 + 0.25 * n1;
          vec3 col = mix(water, sky, clamp(fres, 0.0, 0.5));
          col += uSunCol * (spec + glit * 2.2) * uGlint;
          // whitecaps
          float fn = vnoise(p * 0.9 + vec2(t * 0.5, 0.0)) * vnoise(p * 2.3 - vec2(0.0, t * 0.3));
          float foam = smoothstep(0.5 - uFoam * 0.15, 0.64 - uFoam * 0.15, fn) * uFoam * smoothstep(160.0, 20.0, vDist);
          col = mix(col, vec3(0.92, 0.96, 1.0) * (0.55 + 0.45 * uSkyHor), foam * 0.55);
          col += vec3(0.6, 0.7, 0.9) * uFlash * 0.25;
          // haze toward the horizon (meets the sky there)
          col = mix(col, uHaze, smoothstep(140.0, 430.0, vDist) * 0.85);
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
    // far islands on the horizon
    {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
      const geo = buildIsland(rng, { peaks: 3, flat: 0.2 });
      const N = 12;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const z = lerp(-170, -330, rng());
        const big = rng() < 0.4;
        items.push({ u: (i + rng() * 0.7) / N, z, sx: big ? lerp(14, 26, rng()) : lerp(6, 12, rng()), sy: big ? lerp(4, 9, rng()) : lerp(2, 5, rng()), ry: rng() * TAU, shade: lerp(0.85, 1.1, rng()) });
      }
      this.farIsles = addLayer(mesh, items, 60, { kind: 'far' });
    }
    // mid islands and sea stacks
    {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
      const geo = buildIsland(rng, { peaks: 2, flat: 0.5 });
      const N = 9;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const stack = rng() < 0.2;
        items.push({ u: (i + rng() * 0.6) / N, z: lerp(-80, -150, rng()), sx: stack ? lerp(1.5, 2.5, rng()) : lerp(6, 13, rng()), sy: stack ? lerp(3, 6, rng()) : lerp(1.2, 2.8, rng()), ry: rng() * TAU, shade: lerp(0.9, 1.1, rng()) });
      }
      this.midIsles = addLayer(mesh, items, 30, { kind: 'mid' });
    }
    // other worlds' towers standing on the horizon, beacons blinking
    {
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0.05, flatShading: true });
      const N = 6;
      const mesh = instanced(buildFarTower(), mat, N);
      const items = [];
      const glows = ['#38bdf8', '#c084fc', '#34d399', '#fb923c', '#f472b6', '#facc15'];
      for (let i = 0; i < N; i++) {
        items.push({ u: (i + 0.2 + rng() * 0.6) / N, z: lerp(-190, -320, rng()), sx: lerp(2.0, 3.0, rng()), sy: lerp(18, 34, rng()), ry: 0, shade: 1, glow: new THREE.Color(glows[i % glows.length]) });
      }
      this.farTowers = addLayer(mesh, items, 50, { kind: 'tower' });
    }
    for (const layer of this.layers) this._composeLayer(layer);

    // distant birds (silhouettes) share the gull mesh; built with the entities
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

  // ------------------------------------------------------------------ build: clouds
  _buildClouds() {
    const U = this.U;
    this.cloudTex = makeCloudAtlas();
    const rng = mulberry32(777);
    const quad = new THREE.PlaneGeometry(1, 0.5);
    quad.translate(0, 0.25, 0); // pivot at the flat base
    // background cumulus: banks on the horizon, mid and near layers (instances sorted far -> near)
    const defs = [
      { n: 14, z: [-300, -360], w: [70, 140], el: [0.2, 3.5], b: [0.85, 1.0], a: [0.85, 1.0] },
      { n: 10, z: [-150, -230], w: [36, 70], el: [1.5, 10], b: [0.9, 1.05], a: [0.8, 1.0] },
      { n: 7, z: [-80, -120], w: [18, 30], el: [8, 24], b: [0.95, 1.05], a: [0.75, 0.95] },
      { n: 4, z: [-35, -55], w: [8, 13], el: [14, 28], b: [1.0, 1.05], a: [0.55, 0.8] },
    ];
    const items = [];
    for (const d of defs) {
      for (let i = 0; i < d.n; i++) {
        items.push({
          u: (i + rng() * 0.8) / d.n,
          z: lerp(d.z[0], d.z[1], rng()),
          w: lerp(d.w[0], d.w[1], rng()),
          el: lerp(d.el[0], d.el[1], rng()) * DEG,
          cell: Math.floor(rng() * 4),
          b: lerp(d.b[0], d.b[1], rng()),
          a: lerp(d.a[0], d.a[1], rng()),
          flip: rng() < 0.5 ? -1 : 1,
          drift: lerp(0.2, 0.8, rng()),
          span: 100,
        });
      }
    }
    items.sort((a, b) => a.z - b.z);
    const geo = quad.clone();
    geo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(MAX_CLOUD * 4), 4));
    this.cloudMesh = new THREE.InstancedMesh(geo, cloudMaterial(U, this.cloudTex), MAX_CLOUD);
    this.cloudMesh.frustumCulled = false;
    this.cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.cloudMesh.count = Math.min(MAX_CLOUD, items.length);
    this.cloudMesh.renderOrder = -5;
    this.scene.add(this.cloudMesh);
    this.cloudItems = items;
    const ca = geo.attributes.aCloud.array;
    for (let i = 0; i < this.cloudMesh.count; i++) {
      const it = items[i];
      ca[i * 4] = it.cell;
      ca[i * 4 + 1] = it.b;
      ca[i * 4 + 2] = it.a;
      ca[i * 4 + 3] = 0;
    }
    geo.attributes.aCloud.needsUpdate = true;
    // the cloud layers wrap like the scenery layers
    this.cloudLayer = { mesh: this.cloudMesh, items, margin: 40 };
    this.layers.push(this.cloudLayer);

    // foreground cloud wisps that sweep past in front of everything (soft, see-through)
    const fgGeo = quad.clone();
    fgGeo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(MAX_FGCLOUD * 4), 4));
    this.fgCloudMesh = new THREE.InstancedMesh(fgGeo, cloudMaterial(U, this.cloudTex, { fg: true }), MAX_FGCLOUD);
    this.fgCloudMesh.frustumCulled = false;
    this.fgCloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fgCloudMesh.renderOrder = 40;
    this.fgCloudMesh.count = MAX_FGCLOUD;
    this.scene.add(this.fgCloudMesh);
    this.fgItems = [];
    const fa = fgGeo.attributes.aCloud.array;
    for (let i = 0; i < MAX_FGCLOUD; i++) {
      const low = i % 2 === 0;
      this.fgItems.push({ u: (i + rng() * 0.5) / MAX_FGCLOUD, z: lerp(6, 10, rng()), w: lerp(10, 15, rng()), yf: low ? lerp(-0.45, -0.25, rng()) : lerp(1.12, 1.3, rng()), cell: Math.floor(rng() * 4), flip: rng() < 0.5 ? -1 : 1, span: 40 });
      fa[i * 4] = this.fgItems[i].cell;
      fa[i * 4 + 1] = 1.05;
      fa[i * 4 + 2] = 0.3;
      fa[i * 4 + 3] = 0;
    }
    fgGeo.attributes.aCloud.needsUpdate = true;

    // storm clouds (gameplay hazard): several puffs each, darker, flicker before striking
    const sGeo = quad.clone();
    sGeo.setAttribute('aCloud', new THREE.InstancedBufferAttribute(new Float32Array(MAX_STORM_PUFF * 4), 4));
    sGeo.attributes.aCloud.setUsage(THREE.DynamicDrawUsage);
    this.stormMesh = new THREE.InstancedMesh(sGeo, cloudMaterial(U, this.cloudTex, { fg: true }), MAX_STORM_PUFF);
    this.stormMesh.frustumCulled = false;
    this.stormMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.stormMesh.renderOrder = 8;
    this.stormMesh.count = 0;
    this.scene.add(this.stormMesh);

    // rain curtains under the storm clouds
    const rc = new THREE.PlaneGeometry(1, 1);
    rc.translate(0, -0.5, 0);
    this.curtainMesh = instanced(rc, rainCurtainMaterial(U), MAX_STORM);
    this.curtainMesh.renderOrder = 7;
    this.scene.add(this.curtainMesh);
  }

  // ------------------------------------------------------------------ build: the hang glider + Pogo
  // Local space: +X nose (direction of flight), +Y up, +Z toward the camera. Wing at y = 0, Pogo
  // hangs below it holding the control bar. Merged per material (~5 draws).
  _buildGlider() {
    const U = this.U;
    const outer = new THREE.Group();
    const inner = new THREE.Group(); // tumble roll
    const body = new THREE.Group(); // pitch / squash
    outer.add(inner);
    inner.add(body);
    outer.rotation.order = 'YXZ';
    this.gOuter = outer;
    this.gInner = inner;
    this.gBody = body;
    const C = (h) => new THREE.Color(h);
    const MET = C('#d5dde6');
    const METD = C('#7d8898');

    // ---- sail: a delta wing with billow, scalloped trailing edge between battens
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
        const u = (i / segU) * 2 - 1; // -1 (far tip) .. 1 (near tip)
        const au = Math.abs(u);
        // leading edge: nose -> tip (swept back)
        const lx = lerp(NOSE.x, -0.42, au);
        const lz = u * TIP;
        // trailing edge: keel tail -> tip, scalloped between battens
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
      // chevron bands: red keel, sunny yellow, white, teal, red tips; battens; a sun emblem
      const bands = [
        [0.0, '#e5322d'],
        [0.1, '#ffc21a'],
        [0.36, '#fff6e0'],
        [0.5, '#22b8cf'],
        [0.7, '#ffc21a'],
        [0.86, '#e5322d'],
      ];
      for (let k = 0; k < bands.length; k++) {
        const x0 = bands[k][0] * w;
        const x1 = (k + 1 < bands.length ? bands[k + 1][0] : 1) * w;
        ctx.fillStyle = bands[k][1];
        ctx.fillRect(x0, 0, x1 - x0 + 1, h);
      }
      // batten lines
      ctx.fillStyle = 'rgba(40,30,40,0.35)';
      for (let k = 1; k <= 6; k++) ctx.fillRect((k / 7) * w - 1, 0, 2, h * 0.92);
      // leading-edge pocket (darker band at v = 0)
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.25);
      g.addColorStop(0, 'rgba(20,20,40,0.55)');
      g.addColorStop(1, 'rgba(20,20,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.25);
      // trailing hem
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(0, h - 4, w, 4);
      // sun emblem on the white band
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath();
      ctx.arc(0.43 * w, h * 0.45, 8, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff8a1f';
      ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(0.43 * w + Math.cos(a) * 11, h * 0.45 + Math.sin(a) * 11);
        ctx.lineTo(0.43 * w + Math.cos(a) * 15, h * 0.45 + Math.sin(a) * 15);
        ctx.stroke();
      }
    });
    this.sailBack = { value: 0.5 };
    this.sailBackCol = { value: new THREE.Color('#fff2d0') };
    this.gliderRim = { value: 0.3 };
    this.gliderRimCol = { value: new THREE.Color('#fff4d6') };
    this.sailMat = patchStd(new THREE.MeshStandardMaterial({ map: this.sailTex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide }), U, {
      backLit: { str: this.sailBack, color: this.sailBackCol },
      rim: { color: this.gliderRimCol, str: this.gliderRim },
      key: 'sail',
    });
    this.flashMats = [this.sailMat];
    // the wing banks about the keel (shows its striped underside); Pogo + A-frame stay upright
    const wing = new THREE.Group();
    body.add(wing);
    this.gWing = wing;
    const sailMesh = new THREE.Mesh(sail, this.sailMat);
    wing.add(sailMesh);
    this.sailMesh = sailMesh;

    // ---- frame: leading edges, keel, crossbar, king post, A-frame + control bar, wires
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const frame = []; // upright: A-frame, control bar, strap
    const wframe = []; // banks with the sail
    for (const s of [1, -1]) {
      wframe.push(solidC(tube(V(0.95, 0.0, 0), V(-0.42, 0.1, s * TIP), 0.028, 0.02, 8), MET));
      wframe.push(solidC(tube(V(0.2, 0.08, s * 0.04), V(0.02, 0.1, s * 1.0), 0.016, 0.016, 6), METD)); // crossbar
    }
    wframe.push(solidC(tube(V(0.98, 0.0, 0), V(-0.66, -0.02, 0), 0.026, 0.022, 8), MET)); // keel
    wframe.push(solidC(tube(V(0.12, 0.0, 0), V(0.1, 0.42, 0), 0.016, 0.012, 6), METD)); // king post
    const BAR_Y = -0.92;
    const BAR_X = 0.36;
    const BAR_Z = 0.42;
    for (const s of [1, -1]) {
      frame.push(solidC(tube(V(0.12, -0.02, 0), V(BAR_X, BAR_Y, s * BAR_Z), 0.016, 0.016, 6), MET)); // down tubes
    }
    frame.push(solidC(tube(V(BAR_X, BAR_Y, -BAR_Z), V(BAR_X, BAR_Y, BAR_Z), 0.02, 0.02, 8), C('#2b2f3a'))); // base bar
    // rigging wires (thin)
    const wires = [
      [V(0.1, 0.42, 0), V(0.95, 0.0, 0)],
      [V(0.1, 0.42, 0), V(-0.62, 0.0, 0)],
      [V(0.1, 0.42, 0), V(-0.2, 0.06, 1.05)],
      [V(0.1, 0.42, 0), V(-0.2, 0.06, -1.05)],
    ];
    for (const [a, b] of wires) wframe.push(solidC(tube(a, b, 0.005, 0.005, 3), C('#c9d2dc')));
    frame.push(solidC(tube(V(BAR_X, BAR_Y, 0), V(0.95, 0.0, 0), 0.005, 0.005, 3), C('#c9d2dc')));
    // hang strap down to Pogo's harness
    frame.push(solidC(tube(V(0.08, -0.02, 0), V(0.0, -0.6, 0), 0.014, 0.014, 5), C('#30343f')));
    // wing-tip lights (lamp colours, picked up again as glows)
    const frameMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.3 }), U, {
      rim: { color: this.gliderRimCol, str: this.gliderRim },
      key: 'frame',
    });
    this.flashMats.push(frameMat);
    body.add(new THREE.Mesh(merge(frame), frameMat));
    wing.add(new THREE.Mesh(merge(wframe), frameMat));
    this._tipNear = V(-0.42, 0.1, TIP);
    this._tipFar = V(-0.42, 0.1, -TIP);
    this._noseLocal = V(0.98, 0, 0);
    this._tailLocal = V(-0.62, 0, 0);

    // ---- Pogo: green frog-like pilot (the sub's Pogo, now hanging under a wing), red scarf
    {
      const SKIN = C('#45c46c');
      const BELLY = C('#f3f7cf');
      const BLUSH = C('#f87197');
      const MOUTH = C('#3a0d12');
      const IRIS = C('#f59e0b');
      const IRISD = C('#b45309');
      const PUPIL = C('#05070d');
      const WHITE = C('#ffffff');
      const SCARF = C('#dc2626');
      const SCARF2 = C('#fde68a');
      const HARN = C('#334155');
      const HX = 0.06;
      const HY = -0.72;
      const parts = [];
      const v = new THREE.Vector3();
      const head = new THREE.SphereGeometry(0.22, 28, 20);
      place(head, HX, HY, 0, 0, 0, 0, 1.1, 0.92, 1.02);
      const face = new THREE.Vector3(0.78, 0, 0.62).normalize();
      const blushL = new THREE.Vector3(0.62, -0.28, 0.73).normalize();
      const blushR = new THREE.Vector3(0.9, -0.28, -0.33).normalize();
      paint(head, (x, y, z, c) => {
        v.set((x - HX) / 1.1, (y - HY) / 0.92, z / 1.02).normalize();
        const k = 0.82 + 0.18 * clamp(v.y + 0.6, 0, 1);
        const c0 = this._c.copy(SKIN);
        if (v.y < -0.12 && v.dot(face) > 0.1) c0.lerp(BELLY, smooth01((-v.y - 0.12) * 3));
        if (v.dot(blushL) > 0.95 || v.dot(blushR) > 0.95) c0.lerp(BLUSH, 0.65);
        c[0] = c0.r * k;
        c[1] = c0.g * k;
        c[2] = c0.b * k;
      });
      parts.push(head);
      // round body + belly, in a little harness
      const torso = new THREE.SphereGeometry(0.2, 20, 14);
      place(torso, HX - 0.02, HY - 0.27, 0, 0, 0, 0, 0.95, 1.12, 0.95);
      paint(torso, (x, y, z, c) => {
        const front = x - (HX - 0.02) > 0.05 && Math.abs(z) < 0.15;
        const col = front ? BELLY : SKIN;
        const k = 0.8 + 0.2 * clamp((y - (HY - 0.45)) / 0.4, 0, 1);
        c[0] = col.r * k;
        c[1] = col.g * k;
        c[2] = col.b * k;
      });
      parts.push(torso);
      const belt = new THREE.TorusGeometry(0.19, 0.03, 6, 24);
      place(belt, HX - 0.02, HY - 0.33, 0, Math.PI / 2, 0, 0, 1, 1, 1);
      solidC(belt, HARN);
      parts.push(belt);
      const look = new THREE.Vector3(0.8, 0.06, 0.6).normalize();
      for (const side of [1, -1]) {
        const dome = new THREE.SphereGeometry(0.1, 16, 10);
        place(dome, HX + 0.07, HY + 0.145, side * 0.105);
        solidC(dome, SKIN, 0.95);
        parts.push(dome);
        const eye = new THREE.SphereGeometry(0.09, 22, 16);
        const ex = HX + 0.12;
        const ey = HY + 0.155;
        const ezz = side * 0.115;
        place(eye, ex, ey, ezz);
        paint(eye, (x, y, z, c) => {
          v.set(x - ex, y - ey, z - ezz).normalize();
          const d = v.dot(look);
          let col = WHITE;
          if (d > 0.88) col = PUPIL;
          else if (d > 0.45) col = this._c.copy(IRIS).lerp(IRISD, (d - 0.45) / 0.43);
          c[0] = col.r;
          c[1] = col.g;
          c[2] = col.b;
        });
        parts.push(eye);
        const glint = new THREE.SphereGeometry(0.022, 8, 6);
        place(glint, ex + look.x * 0.088 - 0.012, ey + look.y * 0.088 + 0.03, ezz + look.z * 0.088 - 0.01);
        solidC(glint, WHITE);
        parts.push(glint);
        // goggles strap look: little brown band over the domes
      }
      const smile = new THREE.TorusGeometry(0.085, 0.013, 6, 18, Math.PI * 0.62);
      smile.rotateZ(-Math.PI * 0.81);
      const mf = new THREE.Vector3(0.88, -0.28, 0.38).normalize();
      smile.rotateY(Math.atan2(mf.x, mf.z));
      smile.translate(HX + mf.x * 0.236, HY + mf.y * 0.2 + 0.035, mf.z * 0.226);
      solidC(smile, MOUTH);
      parts.push(smile);
      // scarf ring + knot
      const scarf = new THREE.TorusGeometry(0.16, 0.05, 8, 32);
      place(scarf, HX, HY - 0.17, 0, Math.PI / 2, 0, 0, 1.1, 1.0, 1.05);
      paint(scarf, (x, y, z, c) => {
        const a = Math.atan2(z, x - HX);
        const stripe = Math.floor(((a + Math.PI) / TAU) * 21) % 3 === 0;
        const col = stripe ? SCARF2 : SCARF;
        const k = 0.82 + 0.18 * Math.sin(a * 42);
        c[0] = col.r * k;
        c[1] = col.g * k;
        c[2] = col.b * k;
      });
      parts.push(scarf);
      // arms reaching forward/up to the control bar, mittens on the bar
      for (const side of [1, -1]) {
        const sh = V(HX + 0.02, HY - 0.2, side * 0.17);
        const hand = V(BAR_X - 0.01, BAR_Y + 0.03, side * 0.3);
        const arm = tube(sh, hand, 0.05, 0.042, 8);
        solidC(arm, SKIN, 0.92);
        parts.push(arm);
        const mitt = new THREE.SphereGeometry(0.055, 10, 8);
        place(mitt, hand.x, hand.y, hand.z);
        solidC(mitt, SKIN, 0.98);
        parts.push(mitt);
      }
      const geo = merge(parts);
      this.pogoLit = { value: 0.1 };
      const pogoMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0 }), U, {
        rim: { color: { value: new THREE.Color('#fef9c3') }, str: { value: 0.42 } },
        selfLit: this.pogoLit,
        key: 'pogo',
      });
      this.pogoMat = pogoMat;
      this.flashMats.push(pogoMat);
      this.pogo = new THREE.Mesh(geo, pogoMat);
      body.add(this.pogo);

      // legs: their own mesh so they can dangle, kick and run (pivot at the hips)
      const legs = [];
      for (const side of [1, -1]) {
        const thigh = tube(V(0, 0, side * 0.09), V(0.02, -0.2, side * 0.11), 0.055, 0.048, 8);
        solidC(thigh, SKIN, 0.9);
        legs.push(thigh);
        const foot = new THREE.SphereGeometry(0.07, 12, 8);
        place(foot, 0.07, -0.23, side * 0.11, 0, 0, 0, 1.5, 0.55, 1.05);
        solidC(foot, C('#34b360'));
        legs.push(foot);
      }
      this.legs = new THREE.Group();
      this.legs.position.set(HX - 0.03, HY - 0.44, 0);
      const legMesh = new THREE.Mesh(merge(legs), pogoMat);
      this.legs.add(legMesh);
      body.add(this.legs);
      this._pogoHead = V(HX, HY, 0);
      this._feetLocalY = HY - 0.44 - 0.27;

      // scarf tail streaming back in the wind (shader-waved ribbon)
      const tail = new THREE.PlaneGeometry(0.62, 0.075, 14, 1);
      tail.translate(-0.31, 0, 0);
      paint(tail, (x, y, z, c) => {
        const stripe = Math.floor(-x * 26) % 3 === 0;
        const col = stripe ? SCARF2 : SCARF;
        c[0] = col.r;
        c[1] = col.g;
        c[2] = col.b;
      });
      this.scarfAmt = { value: 1 };
      const scarfMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
      scarfMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = U.uTime;
        shader.uniforms.uAmt = this.scarfAmt;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmt;')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            float k = -position.x / 0.62;
            transformed.y += sin(uTime * 14.0 + position.x * 13.0) * 0.07 * k * uAmt - k * k * 0.12 * (1.2 - uAmt);
            transformed.z += cos(uTime * 11.0 + position.x * 9.0) * 0.05 * k * uAmt;`
          );
      };
      scarfMat.customProgramCacheKey = () => 'glide_scarf';
      const scarfTail = new THREE.Mesh(tail, scarfMat);
      scarfTail.position.set(HX - 0.12, HY - 0.16, 0.1);
      scarfTail.rotation.y = 0.15;
      body.add(scarfTail);
      this.scarfTail = scarfTail;
    }
    this._gSc = 0.5;
    this.scene.add(outer);
  }

  // ------------------------------------------------------------------ build: gameplay entities
  _buildEntities() {
    const U = this.U;
    // sky lanterns (+ the golden one)
    this.lanternMesh = instanced(buildLantern(), lanternMaterial(U), MAX_LANTERN, { glow: true });
    this.lanternMesh.renderOrder = 4;
    this.scene.add(this.lanternMesh);

    // star kites + tails
    this.kiteTex = canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      // radial two-tone segments
      ctx.translate(64, 64);
      for (let k = 0; k < 10; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(255,255,255,1)' : 'rgba(205,205,205,1)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 90, (k * TAU) / 10 - Math.PI / 2 - TAU / 20, ((k + 1) * TAU) / 10 - Math.PI / 2 - TAU / 20);
        ctx.closePath();
        ctx.fill();
      }
      // a happy face
      ctx.fillStyle = '#1b1530';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 11, 2, 5, 7, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 11 - 1.5, -1, 2, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#1b1530';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 12, 8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,140,0.55)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 20, 14, 5, 0, TAU);
        ctx.fill();
      }
    });
    const kiteMat = patchStd(new THREE.MeshStandardMaterial({ map: this.kiteTex, roughness: 0.55, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.0 }), U, {
      selfLit: { value: 0.45 },
      rim: { color: { value: new THREE.Color('#ffffff') }, str: { value: 0.3 } },
      key: 'kite',
    });
    this.kiteMesh = instanced(buildKiteGeo(), kiteMat, MAX_KITE);
    this.kiteMesh.renderOrder = 4;
    const tailMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false });
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

    // ring gates
    const gateGeo = new THREE.TorusGeometry(1, 0.1, 10, 64);
    this.gateMesh = instanced(gateGeo, gateMaterial(U), MAX_GATE, { glow: true });
    this.gateMesh.renderOrder = 6;
    this.scene.add(this.gateMesh);

    // thermals
    const thGeo = new THREE.PlaneGeometry(1, 1);
    thGeo.translate(0, 0.5, 0);
    this.thermalMesh = instanced(thGeo, thermalMaterial(U), MAX_THERMAL);
    this.thermalMesh.renderOrder = 2;
    this.scene.add(this.thermalMesh);

    // gulls (gameplay flocks first, then distant ambient birds) share one mesh
    const gullMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), U, {
      flap: true,
      rim: { color: { value: new THREE.Color('#ffffff') }, str: { value: 0.35 } },
      key: 'gull',
    });
    this.gullMesh = instanced(buildGull(), gullMat, MAX_GULL, { anim: true });
    this.gullMesh.renderOrder = 5;
    this.scene.add(this.gullMesh);
    const rng = mulberry32(99);
    this.ambFlocks = [];
    for (let k = 0; k < 5; k++) {
      this.ambFlocks.push({ u: rng(), z: lerp(-90, -200, rng()), el: lerp(3, 14, rng()) * DEG, n: 3 + Math.floor(rng() * 4), speed: lerp(1.5, 3.5, rng()), ph: rng() * TAU, dir: rng() < 0.7 ? 1 : -1 });
    }

    // lightning bolts: ribbons of quads written per frame
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

    // wind streaks
    this.streakMesh = instanced(new THREE.PlaneGeometry(1, 1), streakMaterial(), MAX_STREAK);
    this.streakMesh.renderOrder = 20;
    this.scene.add(this.streakMesh);
    this.streaks = [];
    for (let i = 0; i < MAX_STREAK; i++) this.streaks.push({ x: 0, y: 0, z: 0, len: 1, life: 0, max: 1, v: 1, a: 0.5 });
    this._streakIdx = 0;

    // additive glows (soft-dot quads) for everything that shines
    const glowMat = new THREE.MeshBasicMaterial({ map: this.softDot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.glowMesh = instanced(new THREE.PlaneGeometry(1, 1), glowMat, MAX_GLOW);
    this.glowMesh.renderOrder = 9;
    this.scene.add(this.glowMesh);
    const starMat = new THREE.MeshBasicMaterial({ map: this.starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.starMesh = instanced(new THREE.PlaneGeometry(1, 1), starMat, MAX_STAR);
    this.starMesh.renderOrder = 26;
    this.scene.add(this.starMesh);
    // dark soft halos behind the glider / hazards so they read against a bright sky
    this.shadeMat = new THREE.MeshBasicMaterial({ map: this.softDot, color: '#0a1020', transparent: true, depthWrite: false, opacity: 0.3, toneMapped: false });
    this.shadeMesh = instanced(new THREE.PlaneGeometry(1, 1), this.shadeMat, MAX_SHADE, { color: false });
    this.shadeMesh.renderOrder = 1;
    this.scene.add(this.shadeMesh);

    // shock-wave rings
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
      new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      MAX_RING
    );
    this.ringMesh.renderOrder = 13;
    this.scene.add(this.ringMesh);

    // world-space puffs: feathers, spray, dust, thermal motes, sparks (points)
    this.puffs = [];
    for (let i = 0; i < MAX_PUFF; i++) this.puffs.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0.1, g: 0, r: 1, gg: 1, b: 1, drag: 1, kind: 0 });
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

    // precipitation (snow / rain / embers / fireflies / leaves / drizzle)
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

  // ------------------------------------------------------------------ build: summit (launch) + next tower and its island
  _buildTowers() {
    const rng = mulberry32(99);
    const stoneTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#3a3646';
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++) {
          const off = (r % 2) * 16;
          for (let c = -1; c < 8; c++) {
            const v = 120 + Math.floor(rng() * 50);
            ctx.fillStyle = `rgb(${v},${v - 8},${v + 6})`;
            ctx.fillRect(c * 32 + off + 2, r * 32 + 2, 28, 28);
          }
        }
      },
      { repeat: true }
    );
    this.stoneTex = stoneTex;
    stoneTex.repeat.set(6, 30 / ((TAU / 6) * 0.9));
    // the summit you launch from: a stout crenellated tower top
    const parts = [];
    const shaft = new THREE.CylinderGeometry(1, 1.06, 30, 40, 1, true);
    shaft.translate(0, -15, 0);
    parts.push(shaft);
    const lip = new THREE.CylinderGeometry(1.08, 1.08, 0.16, 40, 1, false);
    lip.translate(0, -0.1, 0);
    parts.push(lip);
    const top = new THREE.CircleGeometry(1, 40);
    top.rotateX(-Math.PI / 2);
    parts.push(top);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      if (Math.sin(a) > 0.45) continue; // open toward the camera: the run-up and the leap
      const m = new THREE.BoxGeometry(0.28, 0.2, 0.14);
      m.translate(0, 0.1, 0);
      m.rotateY(-a + Math.PI / 2);
      m.translate(Math.cos(a) * 0.93, 0, Math.sin(a) * 0.93);
      parts.push(m);
    }
    const sg = merge(parts.map((g) => solid(g, 1, 1, 1)));
    this.summitMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.92, color: '#ffffff', emissive: '#1a1426', emissiveIntensity: 1 });
    this.summitMesh = new THREE.Mesh(sg, this.summitMat);
    this.summitMesh.visible = false;
    this.scene.add(this.summitMesh);
    // a pennant on a pole at the back of the summit
    const flagParts = [];
    const pole = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
    pole.translate(0, 0.5, 0);
    flagParts.push(solid(pole, 0.85, 0.85, 0.9));
    const pennant = new THREE.PlaneGeometry(0.55, 0.3, 8, 1);
    pennant.translate(-0.275, 0.82, 0);
    flagParts.push(solid(pennant, 1, 1, 1));
    this.flagMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#fbbf24', roughness: 0.7, side: THREE.DoubleSide, emissive: '#000000' });
    this.flagMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.U.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fk = clamp(-position.x / 0.55, 0.0, 1.0);\ntransformed.z += sin(uTime * 9.0 + position.x * 12.0) * 0.08 * fk;\ntransformed.y += sin(uTime * 7.0 + position.x * 8.0) * 0.03 * fk;');
    };
    this.flagMat.customProgramCacheKey = () => 'glide_flag';
    this.flag = new THREE.Mesh(merge(flagParts), this.flagMat);
    this.flag.visible = false;
    this.scene.add(this.flag);

    // the next world's tower: dark brick with glowing arched windows (its palette glow)
    const towerTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
        ctx.fillStyle = '#121626';
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 8; r++) {
          const off = (r % 2) * 16;
          for (let c = -1; c < 8; c++) {
            const v = 30 + Math.floor(rng() * 18);
            ctx.fillStyle = `rgb(${v},${v + 4},${v + 18})`;
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
    this.towerMat = new THREE.MeshStandardMaterial({ map: towerTex, emissiveMap: winTex, emissive: new THREE.Color('#38bdf8'), emissiveIntensity: 2.2, roughness: 0.85, metalness: 0.1 });
    this.nextTower = new THREE.Mesh(tg, this.towerMat);
    this.nextTower.visible = false;
    this.scene.add(this.nextTower);
    // crown on top (seen while it is far away): battlements + a beacon cone
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
    this.crownMat = new THREE.MeshStandardMaterial({ color: '#232a40', roughness: 0.8, emissive: '#000000' });
    this.crown = new THREE.Mesh(merge(crown.map((g) => solid(g, 1, 1, 1))), this.crownMat);
    this.crown.visible = false;
    this.scene.add(this.crown);
    // its island: a grassy crown, a sand beach (where Pogo lands), a wet rim at the waterline
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
    // bottom -> top so the faces point outward
    const ig = new THREE.LatheGeometry(prof.slice().reverse().map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), 72);
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
        c[0] = 0.55 * n;
        c[1] = 0.62 * n;
        c[2] = 0.58 * n; // under water
      } else if (y < 0.35) {
        c[0] = 0.86 * n;
        c[1] = 0.72 * n;
        c[2] = 0.52 * n; // wet sand
      } else if (rr < 0.58 + 0.05 * Math.sin(Math.atan2(z, x) * 5)) {
        c[0] = 0.42 * n;
        c[1] = 0.7 * n;
        c[2] = 0.32 * n; // grass
      } else {
        c[0] = 1.0 * n;
        c[1] = 0.87 * n;
        c[2] = 0.62 * n; // dry sand
      }
    });
    this.isleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: '#b8b8b8' });
    this.isle = new THREE.Mesh(ig, this.isleMat);
    this.isle.visible = false;
    this.scene.add(this.isle);
    // palms on the island (instanced, curved trunks and drooping fronds)
    {
      const parts = [];
      const segs = 7;
      let px = 0;
      let py = 0;
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const x0 = Math.pow(t0, 2) * 0.55;
        const x1 = Math.pow(t1, 2) * 0.55;
        const seg = tube(new THREE.Vector3(x0, t0 * 3, 0), new THREE.Vector3(x1, t1 * 3, 0), lerp(0.13, 0.08, t0), lerp(0.13, 0.08, t1), 7);
        solid(seg, k % 2 ? 0.52 : 0.44, k % 2 ? 0.38 : 0.32, 0.22);
        parts.push(seg);
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
        parts.push(leaf);
      }
      for (let k = 0; k < 3; k++) {
        const nut = new THREE.SphereGeometry(0.1, 8, 6);
        const a = (k / 3) * TAU;
        nut.translate(px + Math.cos(a) * 0.12, py - 0.12, Math.sin(a) * 0.12);
        solid(nut, 0.35, 0.25, 0.12);
        parts.push(nut);
      }
      const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
      this.palms = instanced(merge(parts), palmMat, 4, { color: false });
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

  // ------------------------------------------------------------------ build: overlay (HUD, popups, particles, cinematic)
  _buildOverlay() {
    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 390, 0, -620, -10, 10);
    const quad = (this._quad = new THREE.PlaneGeometry(1, 1));
    const basic = (extra = {}) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

    this.vigMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#0a1530') }, uStr: { value: 0.35 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color('#ff3d6e') }, uWhite: { value: 0 } },
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
          col = mix(col, vec3(0.92, 0.95, 1.0), uWhite);
          gl_FragColor = vec4(col, clamp(a + uFlash * v * 0.6 + uWhite * 0.55, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
    });
    this.vignette = new THREE.Mesh(quad, this.vigMat);
    this.vignette.renderOrder = 0;
    this.overlay.add(this.vignette);

    // screen-space effects that live in stage pixels (re-projected through the moving camera)
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

    // incoming-hazard telegraphs at the right edge (gull flock / gust up / gust down)
    const warnTex = (kind) =>
      canvasTex(128, 128, (ctx) => {
        ctx.translate(64, 64);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.fillStyle = 'rgba(8,14,30,0.55)';
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = kind === 'gull' ? '#fb7185' : '#7dd3fc';
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
          ctx.font = '900 30px "Arial Black", sans-serif';
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
    this._warnTex = { gull: warnTex('gull'), gustUp: warnTex('gustUp'), gustDown: warnTex('gustDown') };
    this.warnPool = [];
    for (let i = 0; i < MAX_WARN; i++) {
      const m = new THREE.Mesh(quad, basic({ map: this._warnTex.gull }));
      m.visible = false;
      m.renderOrder = 4;
      this.overlay.add(m);
      this.warnPool.push(m);
    }

    // ---- HUD: glass panel (canvas, redrawn only when a value changes) + live progress pieces
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
          g.addColorStop(0, '#ffb547');
          g.addColorStop(0.7, '#ffe48a');
          g.addColorStop(1, '#ffffff');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(0, 3, w, 3);
        }),
      })
    );
    this.hudFill.renderOrder = 6;
    this.hudHead = new THREE.Mesh(quad, basic({ map: this.softDot, color: '#fff1c2', blending: THREE.AdditiveBlending }));
    this.hudHead.renderOrder = 7;
    this.hudMarker = new THREE.Mesh(
      quad,
      basic({
        map: canvasTex(96, 64, (ctx) => {
          // little hang glider icon
          ctx.translate(48, 34);
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#2a1c03';
          ctx.lineWidth = 3;
          const g = ctx.createLinearGradient(-36, 0, 36, 0);
          g.addColorStop(0, '#e5322d');
          g.addColorStop(0.35, '#ffc21a');
          g.addColorStop(0.55, '#fff6e0');
          g.addColorStop(0.75, '#22b8cf');
          g.addColorStop(1, '#e5322d');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(30, -4);
          ctx.lineTo(-36, -14);
          ctx.lineTo(-24, -2);
          ctx.lineTo(-36, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#d5dde6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-2, -4);
          ctx.lineTo(4, 14);
          ctx.lineTo(-8, 14);
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = '#45c46c';
          ctx.beginPath();
          ctx.arc(-4, 12, 6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-1, 9, 2.4, 0, TAU);
          ctx.fill();
        }),
      })
    );
    this.hudMarker.renderOrder = 8;
    this.hudGroup.add(this.hudPanel, this.hudFill, this.hudHead, this.hudMarker);
    this._hudDrawn = null;
    this._dispBonus = 0;

    // combo badge: ring timer (shader) + cached "xN" label textures
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
    this.comboText = new THREE.Mesh(quad, basic());
    this.comboText.renderOrder = 7;
    this.comboRing.visible = false;
    this.comboText.visible = false;
    this.overlay.add(this.comboRing, this.comboText);
    this._comboTex = [];
    this._comboCols = ['#f472b6', '#fb923c', '#fde047'].map((h) => new THREE.Color(h));
    this._comboAlpha = 0;
    this._comboShown = 0;

    // flap-ready pip (small ring under the combo badge area, near the glider? no: bottom-left)
    // cinematic letterbox + flight-complete card
    this.lbTop = new THREE.Mesh(quad, basic({ color: '#000000', opacity: 0.94 }));
    this.lbBot = new THREE.Mesh(quad, basic({ color: '#000000', opacity: 0.94 }));
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

  _font(weight, px) {
    return `${weight} ${px}px Orbitron, "Arial Black", "Segoe UI", sans-serif`;
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

  // glass HUD panel: lantern + gate counters, sky bonus (rolling), distance to the next world
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
    const W = this.width;
    const lan = stage.collected || 0;
    const gates = stage.gatesPassed || 0;
    const dist = Math.max(0, Math.round((1 - clamp(stage.progress || 0, 0, 1)) * 48)) / 10;
    const glow = stage.nextGlow || '#38bdf8';
    let d = this._hudDrawn;
    if (d && d.W === W && d.pr === pr && d.lan === lan && d.gates === gates && d.bonus === bonus && d.dist === dist && d.glow === glow) return;
    if (!d) d = this._hudDrawn = { W: 0, pr: 0, lan: -1, gates: -1, bonus: -1, dist: -1, glow: '' };
    const sizeChanged = d.W !== W || d.pr !== pr;
    d.W = W;
    d.pr = pr;
    d.lan = lan;
    d.gates = gates;
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
    g.addColorStop(0, 'rgba(18,30,62,0.62)');
    g.addColorStop(1, 'rgba(8,14,34,0.55)');
    ctx.fillStyle = g;
    this._roundRect(ctx, 8, 6, W - 16, 52, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(24, 7.5);
    ctx.lineTo(W - 24, 7.5);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // counters
    this._lanternGlyph(ctx, 24, 23, 1.1);
    ctx.font = this._font(800, 15);
    this._txt(ctx, `${lan}`, 36, 23.5, '#fff3dc');
    const px = 36 + Math.max(22, ctx.measureText(`${lan}`).width + 14);
    this._gateGlyph(ctx, px + 4, 23, 1);
    this._txt(ctx, `${gates}`, px + 14, 23.5, '#cffafe');
    // distance to the next world
    ctx.font = this._font(700, 7.5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    this._txt(ctx, 'NEXT WORLD', W / 2, 16, 'rgba(255,226,170,0.9)', 'center', 0);
    ctx.font = this._font(800, 12);
    this._txt(ctx, `${dist.toFixed(1)} KM`, W / 2, 29, '#fff8e8', 'center');
    // sky bonus
    ctx.font = this._font(700, 7.5);
    this._txt(ctx, 'SKY BONUS', W - 22, 16, 'rgba(255,214,120,0.9)', 'right', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = this._font(900, 15);
    this._txt(ctx, bonus.toLocaleString('en-US'), W - 22, 30, '#ffd66b', 'right');
    // progress track + end icons
    const x0 = 36;
    const x1 = W - 52;
    const y = 46;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    this._roundRect(ctx, x0 - 2, y - 4, x1 - x0 + 4, 8, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,170,0.32)';
    ctx.stroke();
    for (let k = 1; k < 8; k++) {
      ctx.fillStyle = 'rgba(255,226,170,0.25)';
      ctx.fillRect(x0 + ((x1 - x0) * k) / 8 - 0.5, y - 2, 1, 4);
    }
    // start: the summit you left (crenellated)
    ctx.fillStyle = '#9b93ad';
    ctx.fillRect(16, 42, 12, 12);
    ctx.fillRect(15, 39, 3, 4);
    ctx.fillRect(20.5, 39, 3, 4);
    ctx.fillRect(26, 39, 3, 4);
    // end: the next world's tower on its island
    ctx.fillStyle = '#f3d79a';
    ctx.beginPath();
    ctx.ellipse(W - 35, 56, 12, 3, 0, 0, TAU);
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
    g.addColorStop(0, 'rgba(22,30,64,0.88)');
    g.addColorStop(1, 'rgba(8,10,28,0.9)');
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
    this._txt(ctx, stage.perfect ? 'PERFECT FLIGHT' : 'FLIGHT COMPLETE', W / 2, 24, stage.perfect ? '#fde047' : '#ffb800', 'center', 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const cols = [
      [`${stage.lanternsCaught || 0}`, 'LANTERNS', 'lantern'],
      [`${stage.gatesPassed || 0}/${stage.gatesTotal || 0}`, 'GATES', 'gate'],
      [`${(stage.kites || 0) + (stage.goldCaught || 0)}`, 'KITES', 'kite'],
      [`${stage.nearMisses || 0}`, 'CLOSE CALLS', 'close'],
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
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(ix - 8 + k * 3, 48 + k * 4);
          ctx.lineTo(ix + 6 + k * 3, 48 + k * 4);
          ctx.stroke();
        }
      }
      ctx.font = this._font(900, val.length > 3 ? 13 : 16);
      this._txt(ctx, val, ix + 12, 53, '#ffffff', 'left');
      ctx.font = this._font(700, 7.5);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
      this._txt(ctx, label, cx, 72, 'rgba(255,226,170,0.82)', 'center', 0);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    ctx.strokeStyle = 'rgba(255,226,170,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, 88);
    ctx.lineTo(W - 22, 88);
    ctx.stroke();
    ctx.font = this._font(800, 9);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    this._txt(ctx, 'SKY BONUS', 24, 116, 'rgba(255,214,120,0.95)', 'left', 0);
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

  // ------------------------------------------------------------------ theme look
  _applyTheme(key) {
    const T = THEMES[key] || THEMES.day;
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
    this.hemi.color.set(T.hemiSky);
    this.hemi.groundColor.set(T.hemiGround);
    this.hemi.intensity = key === 'night' ? 1.3 : 1.7;
    this.sunLight.color.set(T.light);
    this.sunLight.intensity = T.lightI;
    // the sky's sun is ahead of us; key light comes from over the left shoulder so things read
    this.sunLight.position.set(-6, 10, 12);
    this.fill.intensity = key === 'night' ? 0.5 : 1.1;
    this.fill.color.set(T.sun);
    this.exposure = T.exposure;
    this.sailBackCol.value.set(T.sun).lerp(this._c2.set('#ffffff'), 0.4);
    this.sailBack.value = key === 'night' ? 0.1 : key === 'storm' ? 0.08 : 0.22;
    this.gliderRimCol.value.set(T.cloudRim);
    this.vigMat.uniforms.uColor.value.set(key === 'night' || key === 'storm' ? '#02040c' : key === 'ember' ? '#1a0408' : '#0a1530');
    this.vigMat.uniforms.uStr.value = key === 'night' || key === 'storm' ? 0.5 : 0.3;
    this.pogoLit.value = key === 'night' ? 0.28 : key === 'storm' ? 0.22 : 0.08;
    // scenery tints
    const c = this._c;
    const tint = (layer, base, k = 1) => {
      const bc = this._c3 || (this._c3 = new THREE.Color());
      bc.copy(base);
      for (let i = 0; i < layer.items.length; i++) {
        c.copy(bc).multiplyScalar((layer.items[i].shade || 1) * k);
        layer.mesh.setColorAt(i, c);
      }
      layer.mesh.instanceColor.needsUpdate = true;
    };
    const dim = key === 'night' ? 0.35 : key === 'storm' ? 0.45 : key === 'ember' ? 0.4 : 1;
    tint(this.farIsles, this._c2.set(T.isleFar).lerp(this._c.set(T.haze), 0.15), 1);
    tint(this.midIsles, this._c2.set('#ffffff').lerp(this._c.set(T.haze), 0.35).multiplyScalar(dim), 1);
    tint(this.farTowers, this._c2.set(T.isleFar).multiplyScalar(0.85), 1);
    this._birdCol.set(T.isleFar).lerp(this._c2.set(T.haze), 0.3).multiplyScalar(0.75);
    // precipitation
    const pk = { none: -1, snow: 0, rain: 1, embers: 2, fireflies: 3, leaves: 4, drizzle: 5 }[T.precip] ?? -1;
    const pm = this.precipMat.uniforms;
    this.precip.visible = pk >= 0;
    pm.uKind.value = Math.max(0, pk);
    pm.uColor.value.set(pk === 0 ? '#ffffff' : pk === 1 || pk === 5 ? '#c3d2ec' : pk === 2 ? '#ff8a3d' : pk === 3 ? '#b8ff3a' : '#ffffff');
    pm.uAlpha.value = pk === 0 ? 0.95 : pk === 1 ? 0.5 : pk === 5 ? 0.22 : pk === 2 ? 1.0 : pk === 3 ? 0.75 : 0.9;
    pm.uWind.value = pk === 1 ? 4 : pk === 4 ? 5 : pk === 0 ? 1.5 : 0.6;
    pm.uAdd.value = pk === 2 || pk === 3 ? 1 : 0;
    this.precip.geometry.setDrawRange(0, pk === 1 ? MAX_PRECIP : pk === 3 ? 120 : pk === 5 ? 260 : pk === 4 ? 90 : pk === 2 ? 220 : 420);
    this.thermalMesh.material.uniforms.uColor.value.set(key === 'night' ? '#ffb24a' : key === 'snow' ? '#ffe2b0' : '#ffcf7a');
  }

  // ------------------------------------------------------------------ glow helpers
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

  _spawnStreak(x, y, z, len, v, life, a) {
    const s = this.streaks[this._streakIdx];
    this._streakIdx = (this._streakIdx + 1) % MAX_STREAK;
    s.x = x;
    s.y = y;
    s.z = z;
    s.len = len;
    s.v = v;
    s.life = life;
    s.max = life;
    s.a = a;
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
    this._bolts = 0;
  }

  render(stage, { time = 0, particles = null, popups = null, shake = 0 } = {}) {
    if (!stage) return;
    const gl = this.gl;
    const dt = this._lastTime === null ? 1 / 60 : clamp(time - this._lastTime, 0, 0.05);
    this._lastTime = time;
    this._kx = stage.width ? this.width / stage.width : 1;
    this._ky = stage.height ? this.height / stage.height : 1;
    const U = this.U;
    U.uTime.value = time;
    if (stage !== this._stageRef || (stage.t || 0) < this._lastStageT) this._resetRide(stage);
    this._lastStageT = stage.t || 0;
    const key = stage.themeKey || 'day';
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
    const pr = gl.getPixelRatio ? gl.getPixelRatio() : 1;
    const focal = (this.height * pr) / (2 * Math.tan(FOV * 0.5 * DEG));
    pm.uPx.value = focal;
    this.puffMat.uniforms.uPx.value = focal;

    // lightning flash decays; storms on the horizon flicker by themselves
    this._flash *= Math.exp(-7 * dt);
    if (key === 'storm' || key === 'ember') {
      this._ambFlashT -= dt;
      if (this._ambFlashT <= 0) {
        this._ambFlashT = 2.5 + Math.random() * 4;
        this._flash = Math.max(this._flash, key === 'storm' ? 0.35 : 0.15);
      }
    }
    U.uFlash.value = this._flash;

    const mag = (Number(typeof shake === 'object' ? Math.hypot(shake.x || 0, shake.y || 0) : shake) || 0) * 0.022;
    this._updateCamera(stage, time, dt, mag);

    this._updateLayers(scrollW, seaW, time);
    this._updateClouds(stage, scrollW, seaW, time, pxw);

    this._glowBegin();
    this._updateHorizonGlows(time, seaW);
    this._updateTowers(stage, seaW, time, pxw);
    this._updateGlider(stage, time, dt, pxw);
    this._updateLanterns(stage, time, pxw);
    this._updateGates(stage, time, pxw);
    this._updateThermals(stage, time, dt, pxw, seaW);
    this._updateStorms(stage, time, pxw, seaW);
    this._updateGulls(stage, time, dt, pxw, scrollW, seaW);
    this._updateRings(stage, pxw);
    this._updateVfx(stage, time, pxw, seaW);
    this._updateStreaks(stage, dt, pxw);
    this._updatePuffs(dt, seaW);
    this._updateSeaGlints(time, seaW);
    this._glowEnd();

    // overlay
    this._popFrame++;
    this._updateFxGroup(stage);
    this._drawHud(stage, dt);
    this._updateHud(stage, time, dt);
    this._updateWarnings(stage, time);
    this._updateCinematic(stage, time);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, stage);
    const g = stage.glider;
    this.vigMat.uniforms.uFlash.value = g && g.stun > 0 ? (g.stun / (g.stunMax || 1)) * 0.35 : 0;
    this.vigMat.uniforms.uWhite.value = Math.min(0.5, this._flash * 0.5);

    const prevAuto = gl.autoClear;
    const prevExp = gl.toneMappingExposure;
    gl.toneMappingExposure = this.exposure * (1 + this._flash * 0.35);
    gl.autoClear = true;
    gl.render(this.scene, this.camera);
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(this.overlay, this.oCam);
    gl.autoClear = prevAuto;
    gl.toneMappingExposure = prevExp;
  }

  // View camera: lazy follow + slow handheld drift; starts close on the summit for the launch and
  // dollies in toward the landing beach for the arrival.
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
    // close-ups: launch (intro) and landing (cine)
    const close = Math.max(intro, cine * 0.85);
    const camZ = lerp(CAM_Z, 11.2, close);
    const k = 1 - camZ / CAM_Z; // keep the focus point on screen while dollying
    const fx = lerp(this._camFX + dX, gw.x * k * 1.05, close);
    const fy = lerp(this._camFY + dY, gw.y * k * 0.95, close);
    this.camera.position.set(fx + Math.sin(time * 73.7) * mag, fy + Math.cos(time * 61.3) * mag * 0.85, camZ);
    // bank a touch with the glider while riding
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

  _updateLayers(scrollW, seaW, time) {
    const layers = this.layers;
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      if (layer === this.cloudLayer) continue;
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
        it.y = seaW - (layer.kind === 'tower' ? 0.5 : 0.25) * (it.sy || 1) * 0.1;
        arr[i * 16 + 12] = x;
        arr[i * 16 + 13] = it.y;
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  _updateClouds(stage, scrollW, seaW, time, pxw) {
    // background cumulus: placed by elevation angle at their depth, drifting with the wind
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
    // foreground wisps (fast, see-through, rare enough not to hide the action)
    const fa = this.fgCloudMesh.instanceMatrix.array;
    const intro = this._intro;
    const H0 = seaW;
    const H1 = this._toWorld(0, stage.top || stage.height * 0.14, 0, this._v2).y;
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

  // beacons on far towers, the sun glare, ambient horizon lightning
  _updateHorizonGlows(time, seaW) {
    const L = this.farTowers;
    for (let i = 0; i < L.mesh.count; i++) {
      const it = L.items[i];
      const p = 0.55 + 0.45 * Math.sin(time * 2.2 + i * 1.9);
      const c = it.glow;
      const top = it.y + it.sy * 1.2;
      const s = 2.2 + it.sx;
      this._glow(it.x, top, it.z + 1, s * 1.1 * p, c.r * 0.22 * p, c.g * 0.22 * p, c.b * 0.22 * p);
    }
    if (this._flash > 0.05 && this._themeKey === 'storm') {
      const f = this._flash;
      this._glow(-30 + Math.sin(time * 3.1) * 60, seaW + 30, SKY_Z + 20, 220 * f, 0.4 * f, 0.45 * f, 0.6 * f, 120 * f);
    }
  }

  _updateTowers(stage, seaW, time, pxw) {
    const v = this._v;
    // ---- the summit you launch from: scrolls away to the left
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
      const cz = -R * 0.68; // front rim just in front of the gameplay plane: Pogo stands on it
      this.summitMesh.position.set(cx, topY, cz);
      this.summitMesh.scale.setScalar(R);
      this.flag.position.set(cx - R * 0.5, topY, cz - R * 0.5);
      this.flag.scale.setScalar(R * 0.9);
      // a warm glow on the parapet, the last bit of the old world
      this._glow(cx, topY + 0.3, cz + R + 0.2, R * 2.4, 0.22, 0.18, 0.1, R * 0.5);
    }

    // ---- the next world's tower: on the horizon at first, growing as you approach
    const tw = stage.tower;
    const show = !!(tw && tw.active);
    this.nextTower.visible = this.crown.visible = this.isle.visible = show;
    this.palms.visible = show;
    if (!show) return;
    if (this._glowHex !== tw.glow) {
      this._glowHex = tw.glow;
      this._glowColor.set(tw.glow || '#38bdf8');
      this.towerMat.emissive.copy(this._glowColor);
      this.crownMat.emissive.copy(this._glowColor).multiplyScalar(0.12);
    }
    // depth: interpolate the apparent size (1 / distance), so the growth feels steady
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
    // island: the landing beach top sits at the stage's landY on the gameplay plane
    const landW = this._toWorld(0, stage.landY ?? stage.seaY - 26, 0, this._v2).y;
    const isleH = Math.max(0.3, landW - seaW);
    const isleR = Math.max(R * 2.2, (0 - TOWER_Z) + 1.6);
    const ix = x - R * 0.8;
    this.isle.position.set(ix, seaW - 0.02, z);
    this.isle.scale.set(isleR * 1.4, isleH, isleR);
    this.palms.visible = true;
    const parr = this.palms.instanceMatrix.array;
    const d = this._dummy;
    for (let i = 0; i < this.palmSpots.length; i++) {
      const sp = this.palmSpots[i];
      const nx = sp[0];
      const nz = sp[1];
      const sc = sp[2];
      const ry = sp[3];
      d.position.set(ix + nx * isleR * 1.4, seaW + isleH * 0.98, z + nz * isleR);
      d.rotation.set(0, ry + Math.sin(time * 0.8 + i) * 0.03, Math.sin(time * 1.1 + i * 2) * 0.025);
      d.scale.setScalar(sc * clamp(isleR / 8, 0.8, 1.6));
      d.updateMatrix();
      d.matrix.toArray(parr, i * 16);
    }
    this.palms.instanceMatrix.needsUpdate = true;
    const arrive = stage.phase === 'arrive' || stage.phase === 'done' ? clamp((stage.arriveT || 0) / 1.5, 0, 1) : 0;
    this.towerMat.emissiveIntensity = 1.8 + arrive * 1.6 + Math.sin(time * 2) * 0.2 + (1 - dpt) * 1.5;
    const g = this._glowColor;
    const dist = CAM_Z - z;
    const k = clamp(30 / dist, 0.15, 1);
    const hs = (0.24 + arrive * 0.2) * (0.6 + 0.4 * (1 - dpt));
    this._glow(x, y0 + Math.min(height * 0.3, 8), z - 1, R * 5 / k * 0.5 + 6, g.r * hs, g.g * hs, g.b * hs);
    // beacon on the crown, pulsing: "that's where we're going"
    const bp = 0.6 + 0.4 * Math.sin(time * 3.2);
    const by = y0 + height + R * 2.2;
    this._glow(x, by, z + R, (R * 2 + dist * 0.016) * bp, g.r * 0.45 * bp, g.g * 0.45 * bp, g.b * 0.45 * bp);
    this._star(x, by, z + R + 0.2, (R * 1.3 + dist * 0.012) * bp, time * 0.4, g.r * 0.7 * bp, g.g * 0.7 * bp, g.b * 0.7 * bp);
    // a glow on the sea around the island
    this._glow(x, seaW + 0.1, z + isleR * 0.9, isleR * 3, g.r * 0.12, g.g * 0.12, g.b * 0.12, isleR * 0.4);
  }

  _updateGlider(stage, time, dt, pxw) {
    const gs = stage.glider;
    const outer = this.gOuter;
    if (!gs) {
      outer.visible = false;
      return;
    }
    outer.visible = true;
    // gameplay counters drive springs: flap = wing stroke, catch = happy bounce, hit = big squash
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
    // pitch: nose follows the flight path (dive = nose down), plus the flare when landing
    const path = Math.atan2(-vy, Math.max(60, sp));
    let pitch = clamp(path * 0.55, -0.36, 0.28) + (gs.flare || 0) * 0.38 + this._flapAnim * 0.14;
    pitch = lerp(pitch, 0.12, grounded);
    const bob = Math.sin(time * 1.9) * 0.05 * sc * (1 - grounded);
    // anchor: the gameplay point is the middle of the rig; grounded = feet on the surface
    const footY = this._feetLocalY * sc;
    let oy = gw.y + 0.55 * sc;
    if (grounded > 0) {
      const surfY = this._toWorld(0, landed > 0 ? stage.landY : stage.summitY, 0, this._v2).y;
      oy = lerp(oy, surfY - footY + 0.05 * sc, grounded);
    }
    const sq = this._sq;
    outer.position.set(gw.x, oy + bob, 0);
    outer.scale.set(sc * (1 + sq * 0.1), sc * (1 - sq * 0.14), sc * (1 + sq * 0.06));
    // 3/4 view: rolled toward the camera so we see the top of the sail, slight yaw
    const roll = Math.sin(time * 1.3) * 0.04 * (1 - grounded) + clamp(vy * 0.0002, -0.05, 0.05);
    const yaw = -0.42 + clamp(vx * 0.0005, -0.1, 0.1);
    outer.rotation.set(roll, yaw, pitch);
    // the wing banks to show its striped underside (less on the ground)
    this.gWing.rotation.x = lerp(-0.4, -0.1, grounded) + clamp(vy * 0.0004, -0.08, 0.08);
    this.gInner.rotation.x = gs.spin || 0;
    // wing stroke: the flap billows and lifts the tips (scale on the body)
    const fl = this._flapAnim;
    this.gBody.scale.set(1, 1 + fl * Math.sin(fl * 9) * 0.12, 1 + fl * 0.08);
    // Pogo: legs run on the summit, dangle and kick in the air, tuck in a dive, stand when landed
    const dive = gs.dive || 0;
    const lift = gs.lift || 0;
    let legRot = 0;
    if (launch < 1 && (stage.t || 0) > 0.25) {
      this._legPh += dt * 18;
      legRot = Math.sin(this._legPh) * 0.7 * (1 - launch);
    } else if (landed > 0) {
      legRot = Math.sin(time * 14) * 0.5 * Math.max(0, 1 - landed * 2.2);
    } else {
      legRot = -0.35 * dive + Math.sin(time * 3.1) * 0.12 + fl * Math.sin(time * 24) * 0.5 + this._cheer * Math.sin(time * 20) * 0.4;
    }
    this.legs.rotation.z = legRot + lerp(0.25 + dive * 0.6, 0, grounded);
    this.legs.rotation.x = Math.sin(time * 2.3) * 0.08 * (1 - grounded);
    this.pogo.rotation.z = lerp(this._cheer * Math.sin(time * 18) * 0.05, 0, grounded);
    this.scarfAmt.value = 0.6 + clamp(sp / 260, 0, 1) * 0.7 - grounded * 0.4;

    // stun flashing / invulnerability blink
    let flv = 0;
    if (gs.stun > 0) flv = Math.sin(time * 42) > 0 ? 1.1 : 0.15;
    else if (gs.invuln > 0) flv = Math.sin(time * 26) > 0.4 ? 0.35 : 0;
    for (let i = 0; i < this.flashMats.length; i++) this.flashMats[i].emissive.setRGB(flv, flv * 0.9, flv * 0.95);

    // glows anchored to the rig: wing-tip nav lights, warm thermal glow, a soft halo
    outer.updateMatrixWorld(true);
    const p = this._v2;
    const body = this.gBody;
    const blink = Math.sin(time * 4.5) > 0.4 ? 1 : 0.15;
    this.gWing.localToWorld(p.copy(this._tipNear));
    this._glow(p.x, p.y, p.z + 0.2, sc * 0.55 * blink, 0.2 * blink, 1.0 * blink, 0.35 * blink);
    this.gWing.localToWorld(p.copy(this._tipFar));
    this._glow(p.x, p.y, p.z + 0.2, sc * 0.5 * blink, 1.0 * blink, 0.2 * blink, 0.2 * blink);
    const night = this._themeKey === 'night' || this._themeKey === 'storm' ? 1 : 0.4;
    this._glow(gw.x, gw.y, -0.6, sc * 4.2, 0.1 * night, 0.09 * night, 0.06 * night);
    if (lift > 0.05) {
      const lk = lift * (0.7 + 0.3 * Math.sin(time * 8));
      this._glow(gw.x, gw.y + 0.4 * sc, -0.8, sc * 3.4, 0.2 * lk, 0.13 * lk, 0.03 * lk, sc * 2.4);
    }
    this._shade(gw.x, gw.y, -0.5, sc * 5.4, sc * 3.6);
    this._speedK = clamp((dive * 0.8 + Math.max(0, (gs.speed || 1) - 1) * 1.6) * (1 - grounded), 0, 1);
  }

  _updateLanterns(stage, time, pxw) {
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
        // wobble in 3D a little: fold yaw into the matrix via X scale
        karr[nk * 16] *= 0.85 + 0.15 * Math.cos(l.age * 1.7 + l.phase);
        const c = this._kiteCols[l.hue % this._kiteCols.length];
        kites.setColorAt(nk, c);
        putMat(tarr, nk, v.x - Math.cos(tilt) * s * 0.0, v.y - s * 0.6, 0.15, s * 2.6, s * 2.2, 1, -0.5 + tilt * 0.4);
        this.kiteTail.setColorAt(nk, c);
        this._glow(v.x, v.y, -0.3, s * 4, c.r * 0.2, c.g * 0.2, c.b * 0.2);
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
      // warm halo; brighter at night
      const hk = (gold ? 0.5 : 0.11) * lk;
      const fl = 0.85 + 0.15 * Math.sin(time * 9 + l.seed * 7);
      this._glow(v.x, v.y - s * 0.2, -0.2, s * (gold ? 6 : 4.2) * fl, c.r * hk * fl, c.g * hk * 0.75 * fl, c.b * hk * 0.5 * fl);
      this._glow(v.x, v.y - s * 0.55, 0.3, s * 0.9, 0.8 * fl, 0.65 * fl, 0.35 * fl);
      if (gold) {
        for (let k = 0; k < 3; k++) {
          const a = time * (2.2 + k * 0.7) + k * 2.1 + l.seed;
          const tw = Math.max(0, Math.sin(time * 7 + k * 2.3));
          this._star(v.x + Math.cos(a) * s * 1.5, v.y + Math.sin(a * 1.3) * s, 0.6, s * 1.6 * tw, a, 1, 0.9 * tw, 0.5 * tw);
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

  _updateGates(stage, time, pxw) {
    const list = stage.gates || EMPTY;
    const mesh = this.gateMesh;
    const glow = mesh.geometry.attributes.aGlow.array;
    const d = this._dummy;
    let n = 0;
    for (let i = 0; i < list.length && n < MAX_GATE; i++) {
      const gt = list[i];
      const v = this._toWorld(gt.x, gt.y, 0, this._v);
      const R = gt.r * pxw;
      let scale = R;
      let col = 1;
      let cr = 1.0;
      let cg = 0.68;
      let cb = 0.18;
      if (gt.state === 'passed') {
        const t = clamp(gt.t / 0.7, 0, 1);
        scale = R * (1 + t * 0.8);
        col = 1 - t;
        cr = 1.6;
        cg = 1.5;
        cb = 1.1;
      } else if (gt.state === 'missed') {
        const t = clamp(gt.t / 1.2, 0, 1);
        col = (1 - t) * 0.5;
        cr = cg = cb = 0.6;
      }
      if (col <= 0.01) continue;
      d.position.set(v.x, v.y, 0);
      d.rotation.set(0, 1.12 + Math.sin(time * 0.8 + gt.seed) * 0.08, 0);
      d.scale.set(scale, scale, scale);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      this._c.setRGB(cr * col, cg * col, cb * col);
      mesh.setColorAt(n, this._c);
      glow[n] = gt.state === 'open' ? 1 : 0.3;
      // halo + a glint at the top of the hoop
      this._glow(v.x, v.y, -0.4, R * 2.6, 0.3 * col, 0.22 * col, 0.08 * col, R * 3.4);
      if (gt.state === 'open') this._star(v.x, v.y + R, 0.4, R * 0.7 * (0.6 + 0.4 * Math.sin(time * 5 + gt.seed)), time, 0.7, 1, 1);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
  }

  _updateThermals(stage, time, dt, pxw, seaW) {
    const list = stage.thermals || EMPTY;
    const mesh = this.thermalMesh;
    const arr = mesh.instanceMatrix.array;
    const col = mesh.instanceColor.array;
    const topW = this._toWorld(0, (stage.top || 0) - 30, 0, this._v2).y;
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
      // warm haze where it leaves the sea
      this._glow(x, seaW + 0.3, -0.5, w * 1.6, 0.25 * f, 0.16 * f, 0.05 * f, w * 0.5);
      n++;
    }
    // rising motes (dust, petals) inside the columns
    while (this._moteAcc > 1 && list.length) {
      this._moteAcc -= 1;
      const th = list[Math.floor(Math.random() * list.length)];
      const x = this._toWorld(th.x, 0, 0, this._v).x;
      const w = th.w * pxw;
      const y = lerp(seaW + 0.5, topW, Math.random() * 0.7);
      const warm = this._themeKey === 'snow' ? 0.9 : 1;
      this._spawnPuff(x + (Math.random() - 0.5) * w * 1.6, y, (Math.random() - 0.5) * 1.5, 0, 1.2 + Math.random() * 1.6, 0.05 + Math.random() * 0.06, 1.6 + Math.random(), 0, 1.0 * warm, 0.85 * warm, 0.5, 0.5, 1);
    }
    if (!list.length) this._moteAcc = 0;
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
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
      // flicker: charging = increasingly frantic inner flashes
      let fl = 0;
      if (c.state === 'charge') {
        const k = clamp(c.t / (stage._strikeCharge || 1.2), 0, 1);
        fl = (Math.sin(time * (18 + k * 30) + c.seed) > 0.2 - k * 0.6 ? 1 : 0) * (0.35 + k * 0.9);
      } else if (c.state === 'strike') {
        fl = 1.6 * (1 - c.t / 0.42);
      }
      for (let k = 0; k < 4 && n < MAX_STORM_PUFF; k++) {
        const o4 = k * 4;
        const ox = STORM_PUFFS[o4];
        const oy = STORM_PUFFS[o4 + 1];
        const s = STORM_PUFFS[o4 + 2];
        const cell = STORM_PUFFS[o4 + 3];
        const bob = Math.sin(time * 0.9 + c.seed + k) * 0.05;
        putMat(arr, n, v.x + ox * W, base + (oy + bob) * W * 0.5, 0.2 - k * 0.05, W * s * (k % 2 ? -1 : 1), W * s);
        ca[n * 4] = (cell + Math.floor(c.seed)) % 4;
        ca[n * 4 + 1] = 0.9 + k * 0.04;
        ca[n * 4 + 2] = 0.97;
        ca[n * 4 + 3] = 0.82 + fl;
        n++;
      }
      // rain curtain under it
      const bx = v.x + (c.strikeX || 0) * pxw;
      putMat(carr, nc, v.x, base + W * 0.08, -0.2, W * 0.9, base - seaW + 0.5);
      ccol[nc * 3] = 0.8;
      ccol[nc * 3 + 1] = 0.8;
      ccol[nc * 3 + 2] = 0.8;
      nc++;
      // telegraph: a crackling guide line + a growing glow where it will hit the sea
      if (c.state === 'charge') {
        const k = clamp(c.t / (stage._strikeCharge || 1.2), 0, 1);
        const p = 0.5 + 0.5 * Math.sin(time * (14 + k * 26));
        const h = base - seaW;
        const a = (0.15 + 0.5 * k) * p;
        this._glow(bx, (base + seaW) * 0.5, 0.3, 0.14 + k * 0.12, 0.8 * a, 0.86 * a, 1.0 * a, h);
        // little sparks crawling down the strike line
        for (let j = 0; j < 3; j++) {
          const f = (time * (1.2 + j * 0.4) + j * 0.33 + c.seed) % 1;
          this._star(bx + Math.sin(time * 30 + j * 2) * 0.15, base - f * h, 0.45, (0.25 + k * 0.35) * p, time * 9 + j, 0.7 * k, 0.8 * k, 1.0 * k);
        }
        this._glow(bx, seaW + 0.1, 0.4, 1.4 + k * 2.2, 0.6 * a, 0.7 * a, 1.0 * a, 0.5 + k * 0.6);
        this._glow(bx, base, 0.5, W * 0.6 * (0.5 + k), 0.55 * k * p, 0.6 * k * p, 0.85 * k * p);
      }
      if (c.state === 'strike' && c.t < 0.12 && c.strikes !== c._seenStrike) {
        c._seenStrike = c.strikes;
        this._flash = Math.max(this._flash, 0.85);
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
      d.rotation.set(0.5 + (scatter ? Math.sin(time * 9 + b.seed) * 0.6 : 0), 0.3, clamp(-(b.vy || 0) * 0.003, -0.6, 0.6) + (scatter ? Math.sin(time * 7 + b.seed) * 0.5 : 0));
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
    // distant ambient flocks: tiny silhouettes, tinted by the haze
    const T = this.theme || THEMES.day;
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

  // a jagged bolt from (x0, y0) down to (x1, y1) written as camera-facing quads
  // deterministic per bolt / flicker frame (mulberry32 on this._boltState), no closures
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
      // occasional fork
      if (steps > 6 && k > 2 && k < steps - 2 && this._boltRand() < 0.18) seg = this._writeBolt(seg, nx, ny, nx + (this._boltRand() - 0.5) * 4, ny - (y0 - y1) * 0.25, a * 0.6, width * 0.6, 4);
      px = nx;
      py = ny;
    }
    return seg;
  }

  // one-shot presentation events from the stage
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
            this._star(v.x + Math.cos(a) * rr, v.y + Math.sin(a) * rr, 0.8, sz, a + time * 3, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          }
          if (t < 0.35) this._glow(v.x, v.y, 0.7, S * 2.2 * (1 - t / 0.35), rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5);
          break;
        }
        case 'pop': {
          if (fresh) {
            // paper scraps + embers
            for (let j = 0; j < 9; j++) {
              const a = (j / 9) * TAU + Math.random() * 0.5;
              const sp = 1.5 + Math.random() * 2;
              this._spawnPuff(v.x, v.y, 0.4, Math.cos(a) * sp, Math.sin(a) * sp + 0.8, 0.07 + Math.random() * 0.06, 0.5 + Math.random() * 0.4, -2.5, rgb[0], rgb[1], rgb[2], 2.5, 2);
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
            this._glow(x, y, 0.85, sc * (2.6 - Math.abs(j - 2) * 0.4) * (0.4 + 0.6 * k), 0.75 * a, 0.95 * a, 1.0 * a, sc * 0.11);
          }
          break;
        }
        case 'zap': {
          this._glow(v.x, v.y, 0.9, S * 0.3 * (1 + t * 2), rgb[0] * k, rgb[1] * k, rgb[2] * k);
          this._star(v.x, v.y, 1.0, S * 0.2 * k * (1 + t), e.id + t * 2, k, k, k);
          break;
        }
        case 'bolt': {
          // the strike itself: a jagged ribbon from the cloud to the sea + the impact
          const y0 = v.y;
          const y1 = seaW;
          const a = k > 0.6 ? 1 : (k / 0.6) * (0.6 + 0.4 * Math.sin(time * 60));
          // re-seed per event and per flicker frame so the shape crackles
          const fr = Math.floor(t * 9);
          this._boltState = (e.id * 2654435761 + fr * 97) >>> 0;
          seg = this._writeBolt(seg, v.x, y0, v.x + (this._boltRand() - 0.5) * 0.6, y1, a, 0.12 + 0.05 * k, 14);
          this._glow(v.x, (y0 + y1) * 0.5, 0.5, 1.3 * a, 0.22 * a, 0.22 * a, 0.45 * a, (y0 - y1) * 1.05);
          this._glow(v.x, y1 + 0.15, 0.7, 2.6 * a, 0.45 * a, 0.45 * a, 0.8 * a, 0.9 * a);
          if (fresh) {
            for (let j = 0; j < 22; j++) {
              const ang = Math.PI * 0.5 + (Math.random() - 0.5) * 1.8;
              const sp = 2 + Math.random() * 4;
              this._spawnPuff(v.x + (Math.random() - 0.5) * 0.5, y1 + 0.05, (Math.random() - 0.5) * 0.6, Math.cos(ang) * sp * 0.6, Math.sin(ang) * sp, 0.06 + Math.random() * 0.07, 0.8 + Math.random() * 0.5, -9, 0.9, 0.95, 1.0, 1, 1);
            }
          }
          break;
        }
        case 'feathers': {
          if (fresh) {
            for (let j = 0; j < 16; j++) {
              const a = Math.random() * TAU;
              const sp = 1 + Math.random() * 2.2;
              this._spawnPuff(v.x, v.y, 0.4, Math.cos(a) * sp, Math.sin(a) * sp + 0.6, 0.09 + Math.random() * 0.07, 1.4 + Math.random() * 0.8, -0.9, 1, 1, 1, 1.6, 3);
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
              this._spawnPuff(v.x + (Math.random() - 0.5) * sc * 2.4, seaW + 0.02, (Math.random() - 0.5) * 0.8, Math.cos(ang) * sp * 0.6 - 1.0, Math.sin(ang) * sp, 0.06 + Math.random() * 0.1, 1.0 + Math.random() * 0.6, -9.5, 0.9, 0.97, 1.0, 1, 1);
            }
          }
          this._glow(v.x, seaW + 0.05, 0.9, sc * 5 * (0.4 + t), 0.5 * k, 0.6 * k, 0.65 * k, sc * 1.2 * k);
          break;
        }
        case 'flap': {
          // a puff of air pushed down off the trailing edge
          if (fresh) {
            for (let j = 0; j < 10; j++) {
              this._spawnPuff(v.x + (Math.random() - 0.5) * S * 1.4, v.y, 0.3, -1 - Math.random() * 1.5, -1.5 - Math.random() * 1.5, 0.12 + Math.random() * 0.12, 0.5 + Math.random() * 0.3, 0, 0.85, 0.9, 1.0, 2.2, 0);
            }
            this._spawnStreak(v.x + S * 0.3, v.y + sc * 0.3, 0.4, sc * 3, 1.0, 0.35, 0.7);
            this._spawnStreak(v.x + S * 0.3, v.y - sc * 0.1, 0.4, sc * 2.5, 1.0, 0.3, 0.6);
          }
          if (t < 0.4) this._glow(v.x, v.y - 0.2 * sc, 0.4, sc * 3 * (1 - t / 0.4), 0.18, 0.2, 0.24, sc * 1.2);
          break;
        }
        case 'gate': {
          this._glow(v.x, v.y, 0.6, S * (2 + t * 3), rgb[0] * 0.3 * k, rgb[1] * 0.3 * k, rgb[2] * 0.3 * k, S * (3 + t * 4));
          for (let j = 0; j < 8; j++) {
            const a = (j / 8) * TAU + time;
            const rr = S * (1 + t * 2.4);
            this._star(v.x + Math.cos(a) * rr * 0.4, v.y + Math.sin(a) * rr, 0.8, S * 0.5 * k, a, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          }
          break;
        }
        case 'puff': {
          if (fresh) {
            for (let j = 0; j < 10; j++) {
              const a = Math.random() * TAU;
              this._spawnPuff(v.x, v.y, 0.5, Math.cos(a) * 1.4, Math.sin(a) * 1.2, 0.3 + Math.random() * 0.25, 0.7 + Math.random() * 0.4, 0, 0.62, 0.66, 0.74, 2, 0);
            }
          }
          break;
        }
        case 'gust': {
          if (fresh) {
            for (let j = 0; j < 8; j++) {
              this._spawnStreak(v.x + (Math.random() - 0.2) * sc * 6, v.y + (Math.random() - 0.5) * sc * 3, 0.5 + Math.random() * 2, sc * (3 + Math.random() * 3), 2.2, 0.5 + Math.random() * 0.3, 0.8);
            }
          }
          break;
        }
        case 'dust': {
          if (fresh) {
            for (let j = 0; j < 22; j++) {
              const dir = Math.random() < 0.5 ? -1 : 1;
              this._spawnPuff(v.x + dir * Math.random() * sc, v.y + 0.05, (Math.random() - 0.5) * 0.6, dir * (0.6 + Math.random() * 1.8), 0.3 + Math.random() * 0.8, 0.14 + Math.random() * 0.16, 0.9 + Math.random() * 0.6, -0.6, 1.0, 0.9, 0.7, 1.8, 0);
            }
          }
          break;
        }
        case 'launch': {
          if (fresh) {
            for (let j = 0; j < 14; j++) {
              const dir = Math.random() < 0.5 ? -1 : 1;
              this._spawnPuff(v.x + dir * Math.random() * sc * 0.6, v.y + 0.05, (Math.random() - 0.5) * 0.5, dir * (0.5 + Math.random() * 1.2), 0.4 + Math.random() * 0.6, 0.12 + Math.random() * 0.12, 0.8 + Math.random() * 0.5, -0.5, 0.95, 0.92, 0.88, 2, 0);
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

  // wind streaks: speed lines that stream past (more when diving, in gusts, and on gale days)
  _updateStreaks(stage, dt, pxw) {
    const gs = stage.glider;
    const T = this.theme || THEMES.day;
    const speed = (stage.scrollSpeed || 0) * pxw;
    const sk = this._speedK || 0;
    const gust = Math.abs(stage.wind || 0);
    const riding = stage.phase === 'ride' || stage.phase === 'intro';
    const rate = riding ? 3 + T.wind * 6 + sk * 26 + gust * 30 : 0;
    this._streakAcc += dt * rate;
    const hw = this._halfW(0);
    const topY = this._toWorld(0, stage.top || 80, 0, this._v2).y;
    while (this._streakAcc > 1) {
      this._streakAcc -= 1;
      const z = lerp(-8, 6, Math.random());
      const kz = (CAM_Z - z) / CAM_Z;
      let y = lerp(this._seaW + 1, topY + 2, Math.random()) * kz;
      if (gs && Math.random() < sk * 0.6) {
        const gw = this._toWorld(gs.x, gs.y, 0, this._v3);
        y = gw.y + (Math.random() - 0.5) * this._gSc * 4;
      }
      this._spawnStreak(hw * kz + 3, y, z, lerp(1.2, 4, Math.random()) * (1 + sk), 1.4 + sk * 1.2 + gust, 0.9 + Math.random() * 0.6, lerp(0.25, 0.6, Math.random()) * (0.5 + sk * 0.6 + gust * 0.5));
    }
    const mesh = this.streakMesh;
    const arr = mesh.instanceMatrix.array;
    const col = mesh.instanceColor.array;
    const night = this._themeKey === 'night' || this._themeKey === 'storm' ? 0.55 : 1;
    let n = 0;
    for (let i = 0; i < MAX_STREAK; i++) {
      const s = this.streaks[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      const kz = (CAM_Z - s.z) / CAM_Z;
      s.x -= (speed * s.v + 3) * dt;
      const a = Math.min(1, s.life / s.max * 2.5) * Math.min(1, (s.max - s.life) * 6) * s.a * night;
      putMat(arr, n, s.x, s.y, s.z, s.len, 0.035 * kz + 0.02, 1, 0);
      col[n * 3] = a;
      col[n * 3 + 1] = a;
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
          // feathers: see-saw down
          p.vy = Math.max(p.vy, -0.7);
          p.x += Math.sin(p.life * 6 + i) * 0.6 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 1 && p.vy < 0 && p.y < seaW) p.life = 0; // spray falls back in
      }
      const a = p.life > 0 ? Math.min(1, (p.life / p.max) * 2) : 0;
      const o = i * 3;
      this.puffPos[o] = p.x;
      this.puffPos[o + 1] = p.y;
      this.puffPos[o + 2] = p.z;
      const glow = p.kind === 2 ? 1.6 : 1;
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

  // twinkling glints along the sun (or moon) path on the water
  _updateSeaGlints(time, seaW) {
    const T = this.theme || THEMES.day;
    if (T.glint < 0.5) return;
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

  _updateCinematic(stage, time) {
    const cine = this._cine;
    const W = this.width;
    const H = this.height;
    const lb = H * 0.075 * Math.max(smooth01(cine * 1.3), this._intro * 0.9);
    this.lbTop.visible = this.lbBot.visible = lb > 0.5;
    if (lb > 0.5) {
      this.lbTop.scale.set(W, lb, 1);
      this.lbTop.position.set(W / 2, -lb / 2, 0);
      this.lbBot.scale.set(W, lb, 1);
      this.lbBot.position.set(W / 2, -H + lb / 2, 0);
    }
    // flight-complete card with a counting bonus, once Pogo has touched down
    const at = stage.phase === 'arrive' || stage.phase === 'done' ? stage.arriveT || 0 : -1;
    if (at < 0) this._cardT0 = -1;
    else if (this._cardT0 < 0 && ((stage.glider && stage.glider.landed > 0.3) || at > 3.6)) this._cardT0 = Math.max(at, 1.9);
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
      let e = pop.__glideTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#ffffff')) {
        e = this._popupTex(pop.text, pop.color || '#ffffff');
        pop.__glideTex = e;
      } else e.used = this._popFrame;
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
        for (const k of ['map', 'emissiveMap']) {
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
    this.cloudTex?.dispose();
    this.starTex?.dispose();
    this.ringTex?.dispose();
    if (this._ownSoftDot) this.softDot.dispose();
  }
}
