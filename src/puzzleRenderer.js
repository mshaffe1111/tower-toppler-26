// Hidden puzzle chamber renderer.
//
// Owns its own scene + cameras and draws a PuzzleRoom (src/puzzleRoom.js) into the game's shared
// THREE.WebGLRenderer, exactly like SubRenderer does for the submarine. The room logic defines the
// camera (`room.view`, plain maths); `mapCam` is an exact copy of it (so particles / popups handed to
// the game's fx systems in screen pixels land where the logic put them) and the *view* camera adds
// the intro dolly, a slow handheld drift, the solve push-in and shake, with the screen-space effects
// re-projected through it.
//
// Look: a round, carved chamber deep inside the tower. Ashlar walls with engaged columns, iron
// sconces with living flames and two flickering torch lights, a slit window throwing a dusty light
// shaft onto a stone dais of rune tiles, a band of runes around the wall in the tower's own glow
// colour, flame reflections smeared across the polished floor, and puzzle pieces that answer with
// light: tiles flip and flare, bells swing and ring out visible waves, the beam sweeps with its
// mirror and makes the crystal bloom, rune blocks wake up on their plates.
//
// Performance: everything repeated is an InstancedMesh, materials and geometries are shared, all
// per-frame work writes into preallocated typed arrays (no allocations in render()), glow/flame/dust
// animation lives in shaders, and a frame is ~35-45 draw calls plus Pogo.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PogoRig } from './pogo.js';
import { BELL_COLORS } from './puzzleRoom.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const INTRO_T = 1.05; // keep in sync with puzzleRoom.js
const FLIP_T = 0.38;
const BEAM_Y = 0.72;
const POGO_SCALE = 0.8;

const MAX_TILES = 64;
const MAX_GLOW = 200;
const MAX_STAR = 48;
const MAX_FGLOW = 96;
const MAX_SHADE = 32;
const MAX_RING = 24;
const MAX_BEAM = 24;
const MAX_DUST = 240;
const MAX_PART = 600;
const MAX_POP = 14;
const MAX_PILLAR = 12;
const MAX_TORCH = 4;

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

// Stone tint per Reboot world (Sunrise Shoals .. Edge of Doom); the runes take the tower's glow colour
const WORLD_STONE = ['#a08b74', '#8c7b63', '#8193a6', '#b58a5e', '#5d5866', '#7b8d82', '#a8966f', '#6b6772', '#8a7a8e', '#6e5f5a'];
const WORLD_TORCH = ['#ff9a3c', '#ffa04a', '#ffb070', '#ff8c34', '#ff9248', '#ffa860', '#ff9c42', '#ff8a3c', '#ff9a50', '#ff7a2e'];

// ---------------------------------------------------------------------------------- GLSL bits
const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
`;
const GLSL_OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };

// ---------------------------------------------------------------------------------- textures
function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
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
  t.anisotropy = 4;
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

// Ring texture (bell waves, plates, door glyph halos)
function makeRingTex() {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 40, 64, 64, 63);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.82, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

// 4x4 atlas of procedural runes (white strokes on transparent)
function drawRune(ctx, rng, cx, cy, s) {
  const P = (gx, gy) => [cx + (gx - 1) * s * 0.36, cy + (gy - 1.5) * s * 0.26];
  ctx.beginPath();
  const stave = rng() < 0.75;
  if (stave) {
    const x = rng() < 0.7 ? 1 : rng() < 0.5 ? 0 : 2;
    const a = P(x, 0);
    const b = P(x, 3);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  const strokes = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < strokes; i++) {
    const kind = rng();
    if (kind < 0.62) {
      const a = P(Math.floor(rng() * 3), Math.floor(rng() * 4));
      let b = P(Math.floor(rng() * 3), Math.floor(rng() * 4));
      if (a[0] === b[0] && a[1] === b[1]) b = P(1, 3);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    } else if (kind < 0.85) {
      const c = P(1, 1 + Math.floor(rng() * 2));
      ctx.moveTo(c[0] + s * 0.14, c[1]);
      ctx.arc(c[0], c[1], s * 0.14, 0, TAU);
    } else {
      const a = P(0, 1);
      const b = P(1, 0.4);
      const c = P(2, 1);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
    }
  }
  ctx.stroke();
}

function makeRuneAtlas() {
  const rng = mulberry32(90210);
  return canvasTex(
    512,
    512,
    (ctx) => {
      ctx.clearRect(0, 0, 512, 512);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 16; i++) {
        const cx = (i % 4) * 128 + 64;
        const cy = Math.floor(i / 4) * 128 + 64;
        const r2 = mulberry32(1000 + i * 77);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 15;
        drawRune(ctx, r2, cx, cy, 100);
        const r3 = mulberry32(1000 + i * 77);
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.lineWidth = 7;
        drawRune(ctx, r3, cx, cy, 100);
      }
      void rng;
    },
    { srgb: false }
  );
}

// Stone surfaces: 'slab' (tile tops), 'flag' (outer floor), 'wall' (ashlar courses)
// fine grain: a cached 128px noise tile composited in overlay mode (no pixel read-back)
let NOISE_TILE = null;
function speckle(ctx, w, h, rng, amt) {
  if (!NOISE_TILE) {
    NOISE_TILE = document.createElement('canvas');
    NOISE_TILE.width = 128;
    NOISE_TILE.height = 128;
    const nctx = NOISE_TILE.getContext('2d');
    const img = nctx.createImageData(128, 128);
    const d = img.data;
    const r = mulberry32(8080);
    for (let i = 0; i < d.length; i += 4) {
      const v = (r() * 255) | 0;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = clamp(amt / 120, 0, 1);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(NOISE_TILE, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  void rng;
}

function blotches(ctx, w, h, rng, n, rMin, rMax, alpha, light) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = rMin + rng() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = light ? '255,255,255' : '0,0,0';
    g.addColorStop(0, `rgba(${c},${alpha})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function makeSlabTex() {
  const rng = mulberry32(77);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8f8a84';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 26, 20, 70, 0.12, false);
    blotches(ctx, w, h, rng, 18, 10, 40, 0.1, true);
    // worn, darker edges
    const e = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, w, h);
    // scratches
    ctx.strokeStyle = 'rgba(30,26,22,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const a = rng() * TAU;
      const l = 10 + rng() * 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    // engraved border line
    ctx.strokeStyle = 'rgba(20,16,12,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.strokeStyle = 'rgba(255,240,220,0.12)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(25, 25, w - 50, h - 50);
    speckle(ctx, w, h, rng, 26);
  });
}

function makeFlagTex() {
  const rng = mulberry32(4242);
  return canvasTex(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(0, 0, w, h);
      // irregular courses of flagstones
      let y = 0;
      while (y < h) {
        const rh = 60 + Math.floor(rng() * 50);
        let x = -Math.floor(rng() * 60);
        while (x < w) {
          const rw = 70 + Math.floor(rng() * 90);
          const tone = 92 + Math.floor(rng() * 40);
          ctx.fillStyle = `rgb(${tone},${tone - 6},${tone - 14})`;
          const g = 3 + rng() * 2;
          ctx.beginPath();
          ctx.moveTo(x + g + rng() * 4, y + g + rng() * 3);
          ctx.lineTo(x + rw - g - rng() * 4, y + g + rng() * 3);
          ctx.lineTo(x + rw - g - rng() * 4, y + rh - g - rng() * 3);
          ctx.lineTo(x + g + rng() * 4, y + rh - g - rng() * 3);
          ctx.closePath();
          ctx.fill();
          // wrap horizontally
          if (x + rw > w) {
            ctx.save();
            ctx.translate(-w, 0);
            ctx.fill();
            ctx.restore();
          }
          x += rw;
        }
        y += rh;
      }
      blotches(ctx, w, h, rng, 60, 20, 90, 0.16, false);
      blotches(ctx, w, h, rng, 30, 10, 50, 0.07, true);
      speckle(ctx, w, h, rng, 30);
    },
    { repeat: true }
  );
}

function makeWallTex() {
  const rng = mulberry32(31337);
  return canvasTex(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#1e1a17';
      ctx.fillRect(0, 0, w, h);
      const rows = 6;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -Math.floor(rng() * 80);
        while (x < w) {
          const bw = 90 + Math.floor(rng() * 90);
          const tone = 96 + Math.floor(rng() * 44);
          const y0 = r * rh;
          const grad = ctx.createLinearGradient(0, y0, 0, y0 + rh);
          grad.addColorStop(0, `rgb(${tone + 14},${tone + 8},${tone})`);
          grad.addColorStop(1, `rgb(${tone - 18},${tone - 22},${tone - 28})`);
          ctx.fillStyle = grad;
          const draw = (ox) => {
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x + 3 + ox, y0 + 3, bw - 6, rh - 6, 6);
            else ctx.rect(x + 3 + ox, y0 + 3, bw - 6, rh - 6);
            ctx.fill();
          };
          draw(0);
          if (x + bw > w) draw(-w);
          if (x < 0) draw(w);
          x += bw;
        }
      }
      // chips, cracks, grime
      blotches(ctx, w, h, rng, 70, 14, 70, 0.18, false);
      blotches(ctx, w, h, rng, 26, 8, 30, 0.08, true);
      ctx.strokeStyle = 'rgba(10,8,6,0.5)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 18; i++) {
        let x = rng() * w;
        let y = rng() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rng() - 0.5) * 30;
          y += rng() * 22;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      speckle(ctx, w, h, rng, 28);
    },
    { repeat: true }
  );
}

function makeArrowTex() {
  return canvasTex(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 12;
    for (let k = 0; k < 2; k++) {
      ctx.globalAlpha = k ? 0.55 : 1;
      ctx.beginPath();
      ctx.moveTo(30, 28 + k * 36);
      ctx.lineTo(64, 58 + k * 36);
      ctx.lineTo(98, 28 + k * 36);
      ctx.stroke();
    }
  });
}

function makeWindowTex() {
  return canvasTex(64, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e9f6ff');
    g.addColorStop(1, '#b8dcff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, h - 4);
    ctx.lineTo(8, 30);
    ctx.quadraticCurveTo(w / 2, -6, w - 8, 30);
    ctx.lineTo(w - 8, h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20,24,40,0.85)';
    ctx.fillRect(w / 2 - 2, 14, 4, h - 18);
    ctx.fillRect(10, h * 0.48, w - 20, 4);
  });
}

// ---------------------------------------------------------------------------------- geometry
function roundedBox(w, h, d, r, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const hz = d / 2 - r;
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3();
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    inner.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    v.sub(inner);
    if (v.lengthSq() < 1e-9) v.set(0, 1, 0);
    v.normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
    v.multiplyScalar(r).add(inner);
    pos.setXYZ(i, v.x, v.y, v.z);
    uv[i * 2] = v.x / w + 0.5;
    uv[i * 2 + 1] = 0.5 - v.z / d;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function paint(geo, r, g, b) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function mergeStd(list) {
  const prepared = list.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) ng.deleteAttribute(k);
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    if (!ng.attributes.color) paint(ng, 1, 1, 1);
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

// engaged wall column: base, fluted-ish shaft, capital
function buildColumn(height) {
  const parts = [];
  parts.push(paint(place(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 12), 0, 0.14, 0), 0.82, 0.8, 0.78));
  parts.push(paint(place(new THREE.CylinderGeometry(0.31, 0.36, 0.12, 12), 0, 0.34, 0), 0.9, 0.88, 0.85));
  parts.push(paint(place(new THREE.CylinderGeometry(0.25, 0.28, height - 0.8, 12, 4), 0, 0.4 + (height - 0.8) / 2, 0), 1, 1, 1));
  parts.push(paint(place(new THREE.CylinderGeometry(0.36, 0.26, 0.22, 12), 0, height - 0.29, 0), 0.9, 0.88, 0.85));
  parts.push(paint(place(new THREE.BoxGeometry(0.8, 0.18, 0.8), 0, height - 0.09, 0), 0.82, 0.8, 0.78));
  return mergeStd(parts);
}

function buildBrokenColumn() {
  const g = new THREE.CylinderGeometry(0.3, 0.34, 1.35, 10, 3);
  const pos = g.attributes.position;
  const rng = mulberry32(5);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0.6) pos.setY(i, y - rng() * 0.32);
  }
  g.computeVertexNormals();
  g.translate(0, 0.675, 0);
  const base = place(new THREE.CylinderGeometry(0.4, 0.44, 0.16, 10), 0, 0.08, 0);
  return mergeStd([paint(g, 1, 1, 1), paint(base, 0.85, 0.83, 0.8)]);
}

function buildSconce() {
  const iron = [0.16, 0.14, 0.13];
  const parts = [];
  parts.push(paint(place(new THREE.BoxGeometry(0.08, 0.4, 0.08), 0, -0.1, -0.2), ...iron));
  parts.push(paint(place(new THREE.BoxGeometry(0.06, 0.06, 0.34), 0, -0.22, -0.04), ...iron));
  parts.push(paint(place(new THREE.CylinderGeometry(0.15, 0.07, 0.2, 10, 1, true), 0, 0, 0.1), ...iron));
  parts.push(paint(place(new THREE.TorusGeometry(0.15, 0.025, 6, 14), 0, 0.1, 0.1, Math.PI / 2), 0.3, 0.24, 0.16));
  parts.push(paint(place(new THREE.SphereGeometry(0.09, 8, 6), 0, 0.06, 0.1), 0.35, 0.12, 0.04));
  return mergeStd(parts);
}

function buildBell() {
  const pts = [
    [0.0, 0.0],
    [0.06, 0.0],
    [0.1, -0.03],
    [0.14, -0.1],
    [0.16, -0.22],
    [0.18, -0.34],
    [0.23, -0.44],
    [0.3, -0.5],
    [0.33, -0.53],
    [0.315, -0.555],
    [0.27, -0.54],
    [0.2, -0.47],
    [0.15, -0.36],
    [0.12, -0.2],
    [0.0, -0.16],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  g.computeVertexNormals();
  // the clapper
  const cl = place(new THREE.SphereGeometry(0.06, 10, 8), 0, -0.5, 0);
  const rod = place(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6), 0, -0.32, 0);
  return mergeStd([paint(g, 1, 1, 1), paint(cl, 0.5, 0.42, 0.3), paint(rod, 0.5, 0.42, 0.3)]);
}

function buildBellBand() {
  const g = new THREE.TorusGeometry(0.305, 0.03, 8, 32);
  g.rotateX(Math.PI / 2);
  g.translate(0, -0.5, 0);
  const g2 = new THREE.TorusGeometry(0.17, 0.018, 6, 24);
  g2.rotateX(Math.PI / 2);
  g2.translate(0, -0.26, 0);
  return mergeStd([g, g2]);
}

function buildBellFrame() {
  const wood = [0.36, 0.24, 0.15];
  const iron = [0.2, 0.18, 0.17];
  const parts = [];
  for (const sx of [-1, 1]) {
    parts.push(paint(place(new THREE.BoxGeometry(0.11, 1.62, 0.11), sx * 0.5, 0.81, 0), ...wood));
    parts.push(paint(place(new THREE.BoxGeometry(0.2, 0.08, 0.26), sx * 0.5, 0.04, 0), ...iron));
    parts.push(paint(place(new THREE.BoxGeometry(0.06, 0.4, 0.05), sx * 0.39, 1.36, 0, 0, 0, sx * 0.75), ...wood));
  }
  parts.push(paint(place(new THREE.BoxGeometry(1.22, 0.12, 0.14), 0, 1.62, 0), ...wood));
  parts.push(paint(place(new THREE.BoxGeometry(1.26, 0.04, 0.16), 0, 1.69, 0), ...iron));
  parts.push(paint(place(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), 0, 1.5, 0), ...iron));
  return mergeStd(parts);
}

function buildPedestal(r = 0.4, h = 0.16) {
  const a = place(new THREE.CylinderGeometry(r, r + 0.05, h, 16), 0, h / 2, 0);
  const b = place(new THREE.CylinderGeometry(r - 0.06, r, 0.05, 16), 0, h + 0.025, 0);
  return mergeStd([paint(a, 0.8, 0.78, 0.75), paint(b, 0.95, 0.93, 0.9)]);
}

function buildMirrorFrame() {
  const brass = [0.78, 0.58, 0.3];
  const parts = [];
  const w = 0.78;
  const h = 0.92;
  const y0 = 0.32;
  parts.push(paint(place(new THREE.BoxGeometry(w + 0.1, 0.07, 0.1), 0, y0 + h, 0), ...brass));
  parts.push(paint(place(new THREE.BoxGeometry(w + 0.1, 0.07, 0.1), 0, y0, 0), ...brass));
  parts.push(paint(place(new THREE.BoxGeometry(0.07, h, 0.1), -w / 2, y0 + h / 2, 0), ...brass));
  parts.push(paint(place(new THREE.BoxGeometry(0.07, h, 0.1), w / 2, y0 + h / 2, 0), ...brass));
  parts.push(paint(place(new THREE.SphereGeometry(0.06, 8, 6), -w / 2, y0 + h + 0.05, 0), ...brass));
  parts.push(paint(place(new THREE.SphereGeometry(0.06, 8, 6), w / 2, y0 + h + 0.05, 0), ...brass));
  parts.push(paint(place(new THREE.CylinderGeometry(0.05, 0.07, 0.32, 8), 0, 0.16, 0), 0.3, 0.26, 0.22));
  return mergeStd(parts);
}

function buildMirrorFace() {
  const g = new THREE.BoxGeometry(0.72, 0.86, 0.035);
  g.translate(0, 0.32 + 0.46, 0);
  return g;
}

function buildCrystal() {
  const parts = [];
  const main = new THREE.OctahedronGeometry(1, 0);
  main.scale(0.26, 0.78, 0.26);
  main.rotateY(0.4);
  main.translate(0, 1.05, 0);
  parts.push(main);
  const rng = mulberry32(17);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.OctahedronGeometry(1, 0);
    const k = 0.45 + rng() * 0.3;
    s.scale(0.12 * k * 1.4, 0.42 * k, 0.12 * k * 1.4);
    const a = (i / 4) * TAU + rng();
    s.rotateZ((rng() - 0.5) * 0.9);
    s.rotateY(a);
    s.translate(Math.cos(a) * 0.2, 0.55 + k * 0.25, Math.sin(a) * 0.2);
    parts.push(s);
  }
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false);
  g.computeVertexNormals();
  return g;
}

function buildEmitter() {
  const bronze = [0.75, 0.55, 0.28];
  const parts = [];
  parts.push(paint(place(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 12), 0, 0.25, 0), 0.75, 0.72, 0.7));
  parts.push(paint(place(new THREE.BoxGeometry(0.16, 0.5, 0.16), 0, 0.6, -0.1), 0.6, 0.58, 0.55));
  // sun disc facing +Z (the beam direction), lens at its centre
  parts.push(paint(place(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), 0, BEAM_Y, -0.05, Math.PI / 2), ...bronze));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    parts.push(paint(place(new THREE.ConeGeometry(0.06, 0.18, 4), Math.cos(a) * 0.42, BEAM_Y + Math.sin(a) * 0.42, -0.05, 0, 0, a - Math.PI / 2), ...bronze));
  }
  return mergeStd(parts);
}

function buildStele() {
  const parts = [];
  parts.push(paint(place(new THREE.BoxGeometry(1.9, 0.3, 0.6), 0, 0.15, 0), 0.75, 0.72, 0.7));
  parts.push(paint(place(new THREE.BoxGeometry(1.6, 2.1, 0.32), 0, 1.35, 0), 1, 1, 1));
  parts.push(paint(place(new THREE.BoxGeometry(1.8, 0.2, 0.42), 0, 2.48, 0), 0.85, 0.83, 0.8));
  parts.push(paint(place(new THREE.CylinderGeometry(0.0, 0.5, 0.3, 4, 1), 0, 2.73, 0, 0, Math.PI / 4), 0.85, 0.83, 0.8));
  return mergeStd(parts);
}

function buildStarfish() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2;
    const r = i % 2 === 0 ? 0.36 : 0.15;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -0.03);
  g.computeVertexNormals();
  return g;
}

function buildKey() {
  const parts = [];
  parts.push(place(new THREE.TorusGeometry(0.13, 0.045, 10, 24), 0, 0.2, 0));
  parts.push(place(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), 0, -0.13, 0));
  parts.push(place(new THREE.BoxGeometry(0.14, 0.06, 0.05), 0.07, -0.3, 0));
  parts.push(place(new THREE.BoxGeometry(0.1, 0.06, 0.05), 0.05, -0.18, 0));
  parts.push(place(new THREE.SphereGeometry(0.06, 10, 8), 0, 0.2, 0));
  return mergeStd(parts);
}

// ---------------------------------------------------------------------------------- materials
// Rune-capable stone: per-instance aTile = (lit 0..1, flash 0..1, glyph index or -1, rune strength)
function runeMaterial(U, params) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRunes = U.uRunes;
    sh.uniforms.uGlow = U.uGlow;
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aTile;\nvarying vec4 vTile;\nvarying vec3 vON;\nvarying vec2 vTUv;\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTile = aTile;\nvON = normal;\nvTUv = uv;\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uRunes;\nuniform vec3 uGlow;\nuniform float uTime;\nvarying vec4 vTile;\nvarying vec3 vON;\nvarying vec2 vTUv;\nvarying vec3 vOP;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rTop = smoothstep(0.55, 0.85, abs(vON.y));
        vec2 tuv = vTUv;
        float rStr = min(vTile.w, 1.0);
        if (vTile.w > 1.5) {
          // rune blocks: a glyph on every face (projected along the dominant normal axis)
          vec3 an = abs(vON);
          if (an.y >= an.x && an.y >= an.z) tuv = vOP.xz / 0.84 + 0.5;
          else if (an.z >= an.x) tuv = vec2(vOP.x, -vOP.y) / 0.84 + 0.5;
          else tuv = vec2(vOP.z, -vOP.y) / 0.84 + 0.5;
          rTop = 1.0;
        }
        float runeG = 0.0;
        if (vTile.z >= 0.0) {
          vec2 cell = vec2(mod(vTile.z, 4.0), floor(vTile.z / 4.0));
          vec2 guv = (cell + clamp((tuv - 0.5) * 1.3 + 0.5, 0.0, 1.0)) / 4.0;
          runeG = texture2D(uRunes, vec2(guv.x, 1.0 - guv.y)).a * rTop * rStr;
        }
        diffuseColor.rgb *= 1.0 - runeG * 0.6 * (1.0 - vTile.x);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.7 + uGlow * 0.18, rTop * rStr * vTile.x * 0.6);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec2 e2 = abs(tuv - 0.5) * 2.0;
          float m = max(e2.x, e2.y);
          float rim = smoothstep(0.72, 0.79, m) * (1.0 - smoothstep(0.84, 0.9, m)) * rTop * rStr;
          float shimmer = 0.85 + 0.15 * sin(uTime * 2.3 + tuv.x * 6.0 + tuv.y * 4.0);
          totalEmissiveRadiance += uGlow * (runeG * (0.05 + vTile.x * 2.6 * shimmer + vTile.y * 3.2) + rim * (vTile.x * 0.9 + vTile.y * 1.8) + rTop * rStr * (vTile.x * 0.12 + vTile.y * 0.35));
        }`
      );
  };
  mat.customProgramCacheKey = () => 'puzzle_rune';
  return mat;
}

function billboardMat(map) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    ...ADD,
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vCol;
      void main(){
        vUv = uv;
        vCol = instanceColor;
        vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
        mv.xy += mat2(instanceMatrix[0].xy, instanceMatrix[1].xy) * position.xy;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; varying vec2 vUv; varying vec3 vCol;
      void main(){ float a = texture2D(uMap, vUv).a; gl_FragColor = vec4(vCol * a, a); ${GLSL_OUT} }`,
  });
}

function flatMat(map, { additive = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    ...(additive ? ADD : { transparent: true, depthWrite: false }),
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vCol;
      void main(){ vUv = uv; vCol = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: additive
      ? /* glsl */ `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vCol;
        void main(){ float a = texture2D(uMap, vUv).a; gl_FragColor = vec4(vCol * a, a); ${GLSL_OUT} }`
      : /* glsl */ `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vCol;
        void main(){ float a = texture2D(uMap, vUv).a * vCol.r; gl_FragColor = vec4(0.02, 0.012, 0.01, a); ${GLSL_OUT} }`,
  });
}

// Instanced quads with hand-written matrices (no Object3D per sprite)
class Quads {
  constructor(geo, mat, max, order = 0) {
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.m = this.mesh.instanceMatrix.array;
    this.c = this.mesh.instanceColor.array;
    this.max = max;
    this.n = 0;
    this.mesh.count = 0;
  }

  begin() {
    this.n = 0;
  }

  // camera-facing (billboard materials read the 2x2 and the translation)
  bill(x, y, z, sx, sy, rot, r, g, b) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    const m = this.m;
    const o = i * 16;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    m[o] = c * sx;
    m[o + 1] = s * sx;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = -s * sy;
    m[o + 5] = c * sy;
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
    this.c[i * 3] = r;
    this.c[i * 3 + 1] = g;
    this.c[i * 3 + 2] = b;
    return i;
  }

  // lying flat on the floor (geometry in the XZ plane), rotated about Y
  flat(x, y, z, sx, sz, rot, r, g, b) {
    if (this.n >= this.max) return -1;
    const i = this.n++;
    const m = this.m;
    const o = i * 16;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    m[o] = c * sx;
    m[o + 1] = 0;
    m[o + 2] = -s * sx;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = 1;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = s * sz;
    m[o + 9] = 0;
    m[o + 10] = c * sz;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    this.c[i * 3] = r;
    this.c[i * 3 + 1] = g;
    this.c[i * 3 + 2] = b;
    return i;
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// Instanced solid meshes with matrices written from position / yaw / pitch / scale
function setTRS(arr, i, x, y, z, ry, rx, rz, sx, sy = sx, sz = sx) {
  const o = i * 16;
  const cy = Math.cos(ry);
  const syy = Math.sin(ry);
  const cx = Math.cos(rx);
  const sxx = Math.sin(rx);
  const cz = Math.cos(rz);
  const szz = Math.sin(rz);
  // R = Ry * Rx * Rz
  const m00 = cy * cz + syy * sxx * szz;
  const m01 = -cy * szz + syy * sxx * cz;
  const m02 = syy * cx;
  const m10 = cx * szz;
  const m11 = cx * cz;
  const m12 = -sxx;
  const m20 = -syy * cz + cy * sxx * szz;
  const m21 = syy * szz + cy * sxx * cz;
  const m22 = cy * cx;
  arr[o] = m00 * sx;
  arr[o + 1] = m10 * sx;
  arr[o + 2] = m20 * sx;
  arr[o + 3] = 0;
  arr[o + 4] = m01 * sy;
  arr[o + 5] = m11 * sy;
  arr[o + 6] = m21 * sy;
  arr[o + 7] = 0;
  arr[o + 8] = m02 * sz;
  arr[o + 9] = m12 * sz;
  arr[o + 10] = m22 * sz;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

function inst(geo, mat, max, { color = false, tile = false } = {}) {
  if (tile) geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage));
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (color) {
    const c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) m.setColorAt(i, c);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  m.count = 0;
  return m;
}

const EMPTY = [];
const DIR_YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // E S W N -> rotation about Y of +X

export class PuzzleRenderer {
  constructor(webglRenderer, { softDotTex } = {}) {
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this._ownSoftDot = !softDotTex;
    this.starTex = makeStarTex();
    this.ringTex = makeRingTex();
    this.width = 390;
    this.height = 620;
    this.exposure = 1.0;
    this._kx = 1;
    this._ky = 1;

    const U = (this.U = {
      uTime: { value: 0 },
      uGlow: { value: new THREE.Color('#5eead4') },
      uTorch: { value: new THREE.Color('#ff9a3c') },
      uRunes: { value: makeRuneAtlas() },
      uBand: { value: 0.6 },
      uShaftA: { value: new THREE.Vector3() },
      uShaftB: { value: new THREE.Vector3() },
      uTorchP: { value: [new THREE.Vector3(), new THREE.Vector3()] },
      uPx: { value: 600 },
      uRoomR: { value: 5 },
      uSolved: { value: 0 },
    });

    this.scene = new THREE.Scene();
    this.bg = new THREE.Color('#07050a');
    this.scene.background = this.bg;
    this.scene.fog = new THREE.Fog('#0b0710', 18, 46);
    this.camera = new THREE.PerspectiveCamera(42, 390 / 620, 0.1, 120);
    this.mapCam = new THREE.PerspectiveCamera(42, 390 / 620, 0.1, 120);

    // scratch
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._va = new THREE.Vector3();
    this._vb = new THREE.Vector3();
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this._rgb = [0, 0, 0];
    this._colorCache = new Map();
    this._bellCols = BELL_COLORS.map((h) => new THREE.Color(h));
    this._white = new THREE.Color(1, 1, 1);
    this._gold = new THREE.Color('#ffd25e');
    this._lastTime = null;
    this._roomRef = null;
    this._puzzleRef = null;
    this._lastVfxId = 0;
    this._lastActs = 0;
    this._pogoYaw = -Math.PI / 2;
    this._rings = [];
    for (let i = 0; i < MAX_RING; i++) this._rings.push({ t0: -10, life: 1, x: 0, y: 0, z: 0, r0: 0.2, r1: 1.4, flat: 0, col: new THREE.Color(), on: false });
    this._flips = new Int32Array(MAX_TILES);
    this._flipSeen = new Float32Array(MAX_TILES).fill(-1e9);
    this._tileRot = new Uint8Array(MAX_TILES);
    this._tileTint = new Float32Array(MAX_TILES);
    this._tileGlyph = new Float32Array(MAX_TILES);
    this._bump = 0;

    this._buildTextures();
    this._buildMaterials();
    this._buildLights();
    this._buildEnvMap();
    this._buildStatic();
    this._buildPuzzleMeshes();
    this._buildPogo();
    this._buildOverlay();
    this.resize(390, 620);
  }

  // ------------------------------------------------------------------ build
  _buildTextures() {
    this.slabTex = makeSlabTex();
    this.flagTex = makeFlagTex();
    this.wallTex = makeWallTex();
    this.arrowTex = makeArrowTex();
    this.windowTex = makeWindowTex();
  }

  _buildMaterials() {
    const U = this.U;
    this.stoneTint = new THREE.Color('#a08b74');
    this.tileMat = runeMaterial(U, { map: this.slabTex, bumpMap: this.slabTex, bumpScale: 1.6, roughness: 0.42, metalness: 0.0, color: '#ffffff' });
    this.floorMat = new THREE.MeshStandardMaterial({ map: this.flagTex, bumpMap: this.flagTex, bumpScale: 2.2, roughness: 0.55, metalness: 0, vertexColors: true });
    this.wallMat = new THREE.MeshStandardMaterial({ map: this.wallTex, bumpMap: this.wallTex, bumpScale: 3, roughness: 0.9, metalness: 0, vertexColors: true, side: THREE.BackSide });
    this.stoneMat = new THREE.MeshStandardMaterial({ map: this.slabTex, bumpMap: this.slabTex, bumpScale: 1.2, roughness: 0.75, vertexColors: true });
    this.ironMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
    this.ledgeMat = new THREE.MeshStandardMaterial({ color: '#6a5a4a', roughness: 0.8, side: THREE.DoubleSide });
    this.bronzeMat = new THREE.MeshStandardMaterial({ color: '#e0a95c', roughness: 0.34, metalness: 0.85, vertexColors: true });
    this.goldMat = new THREE.MeshStandardMaterial({ color: '#ffc94a', roughness: 0.22, metalness: 1.0, emissive: '#7a4a00', emissiveIntensity: 0.4 });
    this.starfishMat = new THREE.MeshStandardMaterial({ color: '#ff7a2e', roughness: 0.45, metalness: 0.05, emissive: '#c2410c', emissiveIntensity: 0.5 });
    this.bandMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.gemMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.mirrorMat = new THREE.MeshStandardMaterial({ color: '#a9bccf', roughness: 0.08, metalness: 1.0, emissive: '#1a2a3a', emissiveIntensity: 0.6 });
    this.crystalMat = new THREE.MeshStandardMaterial({ color: '#8fe8ff', roughness: 0.12, metalness: 0.1, emissive: '#3ad0ff', emissiveIntensity: 0.25, flatShading: true, transparent: true, opacity: 0.92 });
    this.runeStoneMat = runeMaterial(U, { map: this.slabTex, bumpMap: this.slabTex, bumpScale: 1.4, roughness: 0.6, color: '#ffffff' });

    // wall rune band: additive glyph strip around the chamber
    this.bandRuneMat = new THREE.ShaderMaterial({
      uniforms: { uRunes: U.uRunes, uGlow: U.uGlow, uTime: U.uTime, uBand: U.uBand, uSolved: U.uSolved },
      ...ADD,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uRunes; uniform vec3 uGlow; uniform float uTime; uniform float uBand; uniform float uSolved; varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
          float n = 64.0;
          float ix = floor(vUv.x * n);
          float g = floor(hash12(vec2(ix, 3.1)) * 16.0);
          vec2 f = vec2(fract(vUv.x * n), vUv.y);
          vec2 cell = vec2(mod(g, 4.0), floor(g / 4.0));
          vec2 guv = (cell + clamp((f - 0.5) * vec2(1.15, 1.05) + 0.5, 0.0, 1.0)) / 4.0;
          float a = texture2D(uRunes, vec2(guv.x, 1.0 - guv.y)).a;
          float wave = 0.5 + 0.5 * sin(uTime * 0.9 - vUv.x * 18.0);
          float flick = 0.7 + 0.3 * hash12(vec2(ix, floor(uTime * 2.0)));
          float ripple = uSolved * exp(-pow((vUv.x - fract(uTime * 0.35)) * 6.0, 2.0)) * 2.5;
          float lines = (smoothstep(0.0, 0.04, vUv.y) - smoothstep(0.04, 0.08, vUv.y)) + (smoothstep(0.92, 0.96, vUv.y) - smoothstep(0.96, 1.0, vUv.y));
          float k = a * (0.35 + 0.65 * wave) * flick * uBand + lines * 0.25 * uBand + a * ripple;
          gl_FragColor = vec4(uGlow * k, 1.0);
          ${GLSL_OUT}
        }`,
    });

    // flame: animated noise teardrop, anchored at its base (instanced billboards)
    this.flameMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      ...ADD,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vCol;
        void main(){
          vUv = uv; vCol = instanceColor;
          vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
          mv.xy += mat2(instanceMatrix[0].xy, instanceMatrix[1].xy) * (position.xy + vec2(0.0, 0.5));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv; varying vec3 vCol;
        ${GLSL_NOISE}
        void main(){
          float seed = vCol.r * 17.0;
          float y = vUv.y; float x = (vUv.x - 0.5) * 2.0;
          float sway = (vnoise(vec2(y * 2.5 - uTime * 2.6, seed)) - 0.5) * 0.7 * y;
          float nx = x + sway;
          float w = 0.62 * pow(max(0.0, 1.0 - y), 0.8) * (0.85 + 0.15 * sin(uTime * 11.0 + seed));
          float tongue = vnoise(vec2(x * 3.0 + seed, y * 5.0 - uTime * 6.0));
          float body = smoothstep(w, w * 0.25, abs(nx)) * smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.45, 0.95, y + (tongue - 0.5) * 0.35));
          float core = smoothstep(w * 0.55, 0.0, abs(nx)) * (1.0 - smoothstep(0.1, 0.5, y));
          vec3 col = mix(vec3(1.0, 0.28, 0.04), vec3(1.0, 0.72, 0.3), body) + vec3(1.0, 0.95, 0.75) * core;
          gl_FragColor = vec4(col * body * 1.4, 1.0);
          ${GLSL_OUT}
        }`,
    });

    // light shaft from the slit window: soft, dusty, slowly breathing
    this.shaftMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCol: { value: new THREE.Color('#b9d2f5') }, uStr: { value: 0.085 } },
      ...ADD,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uCol; uniform float uStr; varying vec2 vUv; varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
          float along = smoothstep(0.0, 0.12, vUv.y) * (0.45 + 0.55 * vUv.y);
          float n = vnoise(vec2(vUv.x * 5.0 + uTime * 0.12, vUv.y * 3.0 - uTime * 0.2)) * 0.6 + 0.4;
          float breathe = 0.85 + 0.15 * sin(uTime * 0.5);
          gl_FragColor = vec4(uCol * edge * along * n * uStr * breathe, 1.0);
          ${GLSL_OUT}
        }`,
    });

    // dust motes drifting through the shaft and around the torches (all motion in the shader)
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uShaftA: U.uShaftA, uShaftB: U.uShaftB, uTorchP: U.uTorchP, uPx: U.uPx, uMap: { value: this.softDot }, uR: U.uRoomR },
      ...ADD,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uShaftA; uniform vec3 uShaftB; uniform vec3 uTorchP[2]; uniform float uPx; uniform float uR;
        attribute vec4 aSeed; varying float vA; varying vec3 vC;
        void main(){
          vec3 p = position;
          float t = uTime;
          p.x += sin(t * 0.21 * (0.5 + aSeed.x) + aSeed.y * 6.28) * 0.5;
          p.z += cos(t * 0.17 * (0.5 + aSeed.z) + aSeed.x * 6.28) * 0.5;
          p.y = mod(p.y + t * (0.04 + aSeed.w * 0.06), 5.0) + 0.15;
          // brightness: inside the light shaft, or near a torch
          vec3 ab = uShaftB - uShaftA; float h = clamp(dot(p - uShaftA, ab) / dot(ab, ab), 0.0, 1.0);
          float d = length(p - (uShaftA + ab * h));
          float inShaft = exp(-d * d * 2.2) * 1.4;
          float torch = 0.0;
          for (int i = 0; i < 2; i++) { vec3 q = p - uTorchP[i]; torch += exp(-dot(q, q) * 0.6) * 0.9; }
          float tw = 0.6 + 0.4 * sin(t * (1.0 + aSeed.y * 2.0) + aSeed.z * 30.0);
          vA = (0.06 + inShaft + torch) * tw;
          vC = mix(vec3(1.0, 0.72, 0.45), vec3(0.85, 0.92, 1.0), clamp(inShaft - torch * 0.5, 0.0, 1.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.035 + aSeed.w * 0.03) * uPx / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(vC * a, a); ${GLSL_OUT} }`,
    });

    // beam: additive cylinders, a hot core and a coloured sheath; energy flows along them
    const beamMat = (sharp, col, inten) =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uCol: { value: new THREE.Color(col) }, uInt: { value: inten }, uSharp: { value: sharp } },
        ...ADD,
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vLen;
          void main(){
            vUv = uv;
            vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            vLen = length(instanceMatrix[1].xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uCol; uniform float uInt; uniform float uSharp;
          varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vLen;
          void main(){
            float f = abs(dot(normalize(vN), normalize(vV)));
            float k = pow(f, uSharp);
            float flow = 0.72 + 0.28 * sin((vUv.y * vLen) * 7.0 - uTime * 16.0);
            gl_FragColor = vec4(uCol * k * uInt * flow, 1.0);
            ${GLSL_OUT}
          }`,
      });
    this.beamCoreMat = beamMat(3.0, '#fff6dc', 2.2);
    this.beamGlowMat = beamMat(1.4, '#ffb347', 0.7);

    // bell waves: billboard (aRing.y = 0) or flat on the floor (aRing.y = 1)
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.ringTex } },
      ...ADD,
      vertexShader: /* glsl */ `
        attribute vec2 aRing; varying vec2 vUv; varying vec3 vCol;
        void main(){
          vUv = uv; vCol = instanceColor;
          if (aRing.y > 0.5) {
            vec3 p = vec3(position.x, 0.0, -position.y);
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          } else {
            vec4 mv = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
            mv.xy += mat2(instanceMatrix[0].xy, instanceMatrix[1].xy) * position.xy;
            gl_Position = projectionMatrix * mv;
          }
        }`,
      fragmentShader: /* glsl */ `uniform sampler2D uMap; varying vec2 vUv; varying vec3 vCol;
        void main(){ float a = texture2D(uMap, vUv).a; gl_FragColor = vec4(vCol * a, a); ${GLSL_OUT} }`,
    });
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#ffcf9e', '#1c1016', 0.55);
    this.windowLight = new THREE.DirectionalLight('#b8d4ff', 0.75);
    this.windowLight.position.set(-4, 9, -6);
    this.torchL = new THREE.PointLight('#ff9a3c', 14, 13, 1.7);
    this.torchR = new THREE.PointLight('#ff9a3c', 14, 13, 1.7);
    this.fxLight = new THREE.PointLight('#5eead4', 0, 9, 1.6);
    // soft warm fill from the door side so faces toward the camera aren't silhouettes
    this.fill = new THREE.DirectionalLight('#ffd6ad', 0.7);
    this.fill.position.set(1.5, 6, 9);
    this.scene.add(this.hemi, this.windowLight, this.windowLight.target, this.torchL, this.torchR, this.fxLight, this.fill);
  }

  // A small warm environment for metals, Pogo's clearcoat and polished stone
  _buildEnvMap() {
    try {
      const envScene = new THREE.Scene();
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(10, 24, 12),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.22,0.13,0.08), vec3(0.05,0.04,0.06), smoothstep(-0.2, 0.7, h)); gl_FragColor = vec4(c, 1.0); }',
        })
      );
      envScene.add(sky);
      const blob = (x, y, z, r, col, k) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) }));
        m.position.set(x, y, z);
        envScene.add(m);
      };
      blob(-5, 2, -5, 0.9, '#ffa040', 6);
      blob(5, 2, -5, 0.9, '#ffa040', 6);
      blob(-3, 7, -4, 1.4, '#cfe4ff', 3);
      blob(0, -1, 7, 2.0, '#2a3a55', 1.5);
      const pmrem = new THREE.PMREMGenerator(this.gl);
      this._envRT = pmrem.fromScene(envScene, 0.03);
      pmrem.dispose();
      envScene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this.scene.environment = this._envRT.texture;
      this.scene.environmentIntensity = 0.55;
    } catch (_) {
      this._envRT = null;
    }
  }

  _buildStatic() {
    const U = this.U;
    this.roomGroup = new THREE.Group(); // per-room geometry (rebuilt when the chamber changes)
    this.scene.add(this.roomGroup);

    const quad = (this._quad = new THREE.PlaneGeometry(1, 1));
    const flatQuad = (this._flatQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

    // grid tiles (rounded stone slabs, rune-capable)
    this.tiles = inst(roundedBox(0.94, 0.16, 0.94, 0.045, 2), this.tileMat, MAX_TILES, { color: true, tile: true });
    this.tileAttr = this.tiles.geometry.attributes.aTile;
    this.scene.add(this.tiles);

    // wall columns + torches
    this.columns = inst(buildColumn(5.2), this.stoneMat, MAX_PILLAR, { color: true });
    this.sconces = inst(buildSconce(), this.ironMat, MAX_TORCH);
    this.scene.add(this.columns, this.sconces);
    this.flames = new Quads(quad, this.flameMat, MAX_TORCH, 3);
    this.scene.add(this.flames.mesh);

    // window + shaft
    this.windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.5), new THREE.MeshBasicMaterial({ map: this.windowTex, transparent: true, toneMapped: false, color: new THREE.Color(0.95, 1.02, 1.12) }));
    this.scene.add(this.windowMesh);
    this.shaft = new THREE.Mesh(new THREE.BufferGeometry(), this.shaftMat);
    this.shaft.frustumCulled = false;
    this.shaft.renderOrder = 4;
    this.scene.add(this.shaft);

    // dust
    const dg = new THREE.BufferGeometry();
    const dp = new Float32Array(MAX_DUST * 3);
    const ds = new Float32Array(MAX_DUST * 4);
    const rng = mulberry32(99);
    for (let i = 0; i < MAX_DUST; i++) {
      const a = rng() * TAU;
      const r = Math.sqrt(rng()) * 4.6;
      dp[i * 3] = Math.cos(a) * r;
      dp[i * 3 + 1] = rng() * 5;
      dp[i * 3 + 2] = Math.sin(a) * r - 0.5;
      ds[i * 4] = rng();
      ds[i * 4 + 1] = rng();
      ds[i * 4 + 2] = rng();
      ds[i * 4 + 3] = rng();
    }
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(ds, 4));
    this.dust = new THREE.Points(dg, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 5;
    this.scene.add(this.dust);

    // glow sprites, star glints, floor glows (reflections / light pools), soft shadows, rings
    this.glows = new Quads(quad, billboardMat(this.softDot), MAX_GLOW, 6);
    this.stars = new Quads(quad, billboardMat(this.starTex), MAX_STAR, 7);
    this.fglows = new Quads(flatQuad, flatMat(this.softDot), MAX_FGLOW, 2);
    this.shades = new Quads(flatQuad, flatMat(this.softDot, { additive: false }), MAX_SHADE, 1);
    const rq = new THREE.PlaneGeometry(1, 1);
    rq.setAttribute('aRing', new THREE.InstancedBufferAttribute(new Float32Array(MAX_RING * 2), 2).setUsage(THREE.DynamicDrawUsage));
    this.ringAttr = rq.attributes.aRing;
    this.rings = new Quads(rq, this.ringMat, MAX_RING, 6);
    this.scene.add(this.glows.mesh, this.stars.mesh, this.fglows.mesh, this.shades.mesh, this.rings.mesh);

    // the exit chevrons on the threshold
    this.exitMat = new THREE.MeshBasicMaterial({ map: this.arrowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffffff', toneMapped: false });
    this.exitMark = new THREE.Mesh(flatQuad, this.exitMat);
    this.exitMark.renderOrder = 3;
    this.scene.add(this.exitMark);

    // stele (mural / bell sockets / emblem)
    this.stele = new THREE.Mesh(buildStele(), this.stoneMat);
    this.muralCanvas = document.createElement('canvas');
    this.muralCanvas.width = 256;
    this.muralCanvas.height = 320;
    this.muralTex = new THREE.CanvasTexture(this.muralCanvas);
    this.muralTex.colorSpace = THREE.SRGBColorSpace;
    this.muralGlowCanvas = document.createElement('canvas');
    this.muralGlowCanvas.width = 256;
    this.muralGlowCanvas.height = 320;
    this.muralGlowTex = new THREE.CanvasTexture(this.muralGlowCanvas);
    this.muralGlowTex.colorSpace = THREE.SRGBColorSpace;
    this.muralMat = new THREE.MeshStandardMaterial({ map: this.muralTex, emissiveMap: this.muralGlowTex, emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.7 });
    this.mural = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.7), this.muralMat);
    this.mural.position.set(0, 1.38, 0.165);
    this.stele.add(this.mural);
    this.scene.add(this.stele);

    // reward: star-fish + key
    this.reward = new THREE.Group();
    this.starfish = new THREE.Mesh(buildStarfish(), this.starfishMat);
    this.key = new THREE.Mesh(buildKey(), this.goldMat);
    this.starfish.position.set(-0.36, 0, 0);
    this.key.position.set(0.38, 0, 0);
    this.reward.add(this.starfish, this.key);
    this.reward.visible = false;
    this.scene.add(this.reward);
    this.pillarBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.75, 1, 20, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uCol: { value: new THREE.Color('#ffe6a0') }, uA: { value: 0 } },
        ...ADD,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: /* glsl */ `uniform float uTime; uniform vec3 uCol; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          ${GLSL_NOISE}
          void main(){ float f = pow(abs(dot(vN, vV)), 2.0); float n = 0.6 + 0.4 * vnoise(vec2(vUv.x * 12.0, vUv.y * 3.0 - uTime * 1.5));
            float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
            gl_FragColor = vec4(uCol * f * n * fade * uA, 1.0); ${GLSL_OUT} }`,
      })
    );
    this.pillarBeam.renderOrder = 5;
    this.pillarBeam.visible = false;
    this.scene.add(this.pillarBeam);
  }

  _buildPuzzleMeshes() {
    // bells
    this.bellFrames = inst(buildBellFrame(), this.ironMat, 5);
    this.bellBodies = inst(buildBell(), this.bronzeMat, 5);
    this.bellBands = inst(buildBellBand(), this.bandMat, 5, { color: true });
    this.gems = inst(new THREE.OctahedronGeometry(0.1, 0), this.gemMat, 16, { color: true });
    this.pedestals = inst(buildPedestal(), this.stoneMat, 12, { color: true });
    this.pennants = inst(this._buildPennantGeo(), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8, color: '#ffffff' }), 10, { color: true });
    // mirrors + beam
    this.mirrorFrames = inst(buildMirrorFrame(), this.bronzeMat, 5);
    this.mirrorFaces = inst(buildMirrorFace(), this.mirrorMat, 5, { color: true });
    this.beamCore = inst(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), this.beamCoreMat, MAX_BEAM);
    this.beamGlow = inst(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), this.beamGlowMat, MAX_BEAM);
    this.beamCore.renderOrder = 5;
    this.beamGlow.renderOrder = 5;
    this.emitter = new THREE.Mesh(buildEmitter(), this.bronzeMat);
    this.crystal = new THREE.Mesh(buildCrystal(), this.crystalMat);
    this.crystalBase = new THREE.Mesh(buildPedestal(0.42, 0.3), this.stoneMat);
    this.crystal.add(this.crystalBase);
    this.crystalBase.position.y = -0.0;
    // blocks
    this.blocks = inst(roundedBox(0.84, 0.84, 0.84, 0.07, 2), this.runeStoneMat, 4, { color: true, tile: true });
    this.blockAttr = this.blocks.geometry.attributes.aTile;
    const plateGeo = new THREE.CylinderGeometry(0.4, 0.43, 0.08, 24);
    {
      const pos = plateGeo.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = pos.getX(i) / 0.86 + 0.5;
        uv[i * 2 + 1] = 0.5 - pos.getZ(i) / 0.86;
      }
      plateGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    this.plates = inst(plateGeo, this.runeStoneMat.clone(), 4, { color: true, tile: true });
    this.plates.material.onBeforeCompile = this.runeStoneMat.onBeforeCompile;
    this.plates.material.customProgramCacheKey = this.runeStoneMat.customProgramCacheKey;
    this.plateAttr = this.plates.geometry.attributes.aTile;
    this.solids = inst(buildBrokenColumn(), this.stoneMat, 8, { color: true });

    this.scene.add(
      this.bellFrames,
      this.bellBodies,
      this.bellBands,
      this.gems,
      this.pedestals,
      this.pennants,
      this.mirrorFrames,
      this.mirrorFaces,
      this.beamCore,
      this.beamGlow,
      this.emitter,
      this.crystal,
      this.blocks,
      this.plates,
      this.solids
    );
  }

  _buildPennantGeo() {
    const g = new THREE.PlaneGeometry(0.2, 0.5, 1, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      // a swallow-tail pennant hanging down from y = 0
      const yy = y - 0.25;
      const tip = yy < -0.4 && Math.abs(x) < 0.01 ? 0.08 : 0;
      pos.setXYZ(i, x * (1 - (-yy / 0.5) * 0.15), yy + tip, Math.sin(-yy * 6) * 0.02);
    }
    g.computeVertexNormals();
    return g;
  }

  _buildPogo() {
    try {
      this.pogoRig = new PogoRig();
      this.pogoObj = this.pogoRig.group;
    } catch (e) {
      // stand-in: a little green bean with big eyes
      this.pogoRig = null;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.45, 6, 14), new THREE.MeshStandardMaterial({ color: '#45c46c', roughness: 0.45 }));
      body.position.y = 0.56;
      g.add(body);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1 }));
        eye.position.set(0.22, 1.0, sx * 0.13);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#05070d' }));
        pup.position.set(0.32, 1.0, sx * 0.13);
        g.add(eye, pup);
      }
      this.pogoObj = g;
    }
    this.pogoObj.scale.setScalar(POGO_SCALE);
    this.pogoRoot = new THREE.Group();
    this.pogoRoot.add(this.pogoObj);
    this.scene.add(this.pogoRoot);
    this._pogoState = {
      time: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      squashX: 1,
      squashY: 1,
      teeter: false,
      stun: false,
      hurt: false,
      idle: 0,
      celebrate: false,
      emote: null,
      pound: false,
      hang: false,
      charge: 0,
      muzzle: 0,
      frozen: false,
      danger: 0,
      dangerDir: 0,
      dangerUp: 0,
      lowTime: false,
      dark: false,
    };
  }

  _buildOverlay() {
    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 390, 0, -620, -10, 10);
    const quad = this._quad;
    const basic = (extra = {}) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

    this.vigMat = new THREE.ShaderMaterial({
      uniforms: { uFade: { value: 1 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color('#ffe9b0') } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uFade; uniform float uFlash; uniform vec3 uFlashCol; varying vec2 vUv;
        void main(){
          vec2 q = vUv - 0.5; q.x *= 0.9;
          float v = smoothstep(0.3, 0.78, length(q));
          vec3 col = mix(vec3(0.03, 0.012, 0.006), uFlashCol, uFlash * (1.0 - v));
          float a = max(v * 0.62, uFade);
          a = max(a, uFlash * 0.35 * (1.0 - v));
          gl_FragColor = vec4(col * (1.0 - uFade) , a);
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

    // HUD panel (canvas, redrawn only when something it shows changes)
    this._hudCanvas = document.createElement('canvas');
    this._hudTex = new THREE.CanvasTexture(this._hudCanvas);
    this._hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudPanel = new THREE.Mesh(quad, basic({ map: this._hudTex }));
    this.hudPanel.renderOrder = 5;
    this.overlay.add(this.hudPanel);
    this._hudKey = '';

    // "EXIT" chip that appears by the door
    this.exitChip = new THREE.Mesh(
      quad,
      basic({
        map: canvasTex(192, 64, (ctx) => {
          ctx.fillStyle = 'rgba(12,8,6,0.72)';
          ctx.strokeStyle = 'rgba(255,214,150,0.85)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(4, 6, 184, 52, 26);
          else ctx.rect(4, 6, 184, 52);
          ctx.fill();
          ctx.stroke();
          ctx.font = '800 26px Orbitron, "Arial Black", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ffe2b0';
          ctx.fillText('EXIT ▼', 96, 34);
        }),
      })
    );
    this.exitChip.renderOrder = 6;
    this.overlay.add(this.exitChip);
  }

  /**
   * Optional: compile every shader up front (e.g. once while the tower loads), so stepping into the
   * first chamber never hitches. Returns a promise.
   */
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
      const par = this.gl.compileAsync && this.gl.extensions?.has?.('KHR_parallel_shader_compile');
      const p = par ? this.gl.compileAsync(this.scene, this.camera) : (this.gl.compile(this.scene, this.camera), null);
      if (p && p.then) return p.then(restore, restore);
    } catch (_) {
      /* compiling early is only an optimisation */
    }
    restore();
    return Promise.resolve();
  }

  // ------------------------------------------------------------------ per-room setup
  _setupRoom(room) {
    const p = room.puzzle;
    this._puzzleRef = p;
    this._roomRef = room;
    const cols = room.cols;
    const rows = room.rows;
    const R = room.radius;
    this.U.uRoomR.value = R;
    const wi = clamp(room.worldIndex | 0, 0, WORLD_STONE.length - 1);
    this.stoneTint.set(WORLD_STONE[wi]);
    this.U.uTorch.value.set(WORLD_TORCH[wi]);
    this.torchL.color.copy(this.U.uTorch.value);
    this.torchR.color.copy(this.U.uTorch.value);
    this.U.uGlow.value.set(room.glow || '#5eead4');
    this.glowCol = this.U.uGlow.value;
    this.tileMat.color.copy(this.stoneTint).lerp(this._white, 0.25);
    this.stoneMat.color.copy(this.stoneTint).lerp(this._white, 0.15);
    this.runeStoneMat.color.copy(this.stoneTint).lerp(this._white, 0.2);
    this.plates.material.color.copy(this.stoneTint).multiplyScalar(0.8);
    this.floorMat.color.copy(this.stoneTint).multiplyScalar(0.75);
    this.wallMat.color.copy(this.stoneTint).multiplyScalar(0.9);
    const rng = mulberry32((Number(p.seed) || 7) * 31 + 5);

    // --- dispose the previous chamber's geometry
    for (const ch of [...this.roomGroup.children]) {
      ch.geometry?.dispose();
      this.roomGroup.remove(ch);
    }

    // --- outer floor: flagstone disc, darker toward the walls
    {
      const g = new THREE.RingGeometry(0, R * 2.6, 72, 14);
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        uv[i * 2] = x / 3.2;
        uv[i * 2 + 1] = z / 3.2;
        const r = Math.hypot(x, z) / R;
        // darker toward the walls; past them (only seen through the open front) it sinks into shadow
        let k = 0.55 + 0.45 * (1 - smooth01((r - 0.55) / 0.45));
        k *= 1 - smooth01((r - 0.95) / 0.9) * 0.85;
        col[i * 3] = k;
        col[i * 3 + 1] = k;
        col[i * 3 + 2] = k;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const floor = new THREE.Mesh(g, this.floorMat);
      floor.position.y = -0.06;
      this.roomGroup.add(floor);
    }

    // --- the dais: a raised stone frame around the grid with a glowing inlay
    {
      const hx = cols / 2 + 0.16;
      const hz = rows / 2 + 0.16;
      const parts = [];
      const t = 0.22;
      const h = 0.1;
      parts.push(place(new THREE.BoxGeometry(hx * 2 + t, h, t), 0, -0.02, -hz));
      parts.push(place(new THREE.BoxGeometry(t, h, hz * 2 + t), -hx, -0.02, 0));
      parts.push(place(new THREE.BoxGeometry(t, h, hz * 2 + t), hx, -0.02, 0));
      // front edge: split around the door opening
      const dx = room.worldX(room.doorX);
      const left = dx - 0.5 - -hx;
      const right = hx - (dx + 0.5);
      if (left > 0.05) parts.push(place(new THREE.BoxGeometry(left + t / 2, h, t), -hx + left / 2 - t / 4, -0.02, hz));
      if (right > 0.05) parts.push(place(new THREE.BoxGeometry(right + t / 2, h, t), hx - right / 2 + t / 4, -0.02, hz));
      // grout bed under the tiles
      parts.push(paint(place(new THREE.BoxGeometry(cols, 0.1, rows), 0, -0.1, 0), 0.25, 0.22, 0.2));
      const frame = new THREE.Mesh(mergeStd(parts), this.stoneMat);
      this.roomGroup.add(frame);
      // threshold steps leading out of the door, down toward the camera
      const steps = [];
      for (let k = 0; k < 3; k++) steps.push(place(new THREE.BoxGeometry(1.25 - k * 0.04, 0.12, 0.42), dx, -0.08 - k * 0.14, hz + 0.24 + k * 0.4));
      for (const sx of [-1, 1]) {
        steps.push(paint(place(new THREE.BoxGeometry(0.26, 0.5, 0.3), dx + sx * 0.74, 0.17, hz + 0.08), 0.85, 0.83, 0.8));
        steps.push(paint(place(new THREE.BoxGeometry(0.34, 0.1, 0.38), dx + sx * 0.74, 0.45, hz + 0.08), 0.95, 0.93, 0.9));
      }
      this.roomGroup.add(new THREE.Mesh(mergeStd(steps), this.stoneMat));
      this._doorPostY = 0.56;
      this._doorX = dx;
      this._doorZ = hz;
    }

    // --- the walls: an open cylinder (the front quarter is where we look in from)
    const gap = 62 * DEG;
    const wallH = 7.5;
    {
      const g = new THREE.CylinderGeometry(R + 0.35, R + 0.35, wallH, 72, 8, true, gap, TAU - gap * 2);
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      const col = new Float32Array(pos.count * 3);
      const rep = Math.round(((R + 0.35) * TAU) / 3.2);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) + wallH / 2;
        uv.setXY(i, uv.getX(i) * rep * ((TAU - gap * 2) / TAU), y / 3.2);
        // dark toward the top (the tower's hollow rises into darkness) and a little AO at the floor
        const k = (0.35 + 0.65 * (1 - smooth01((y - 2.2) / 4.2))) * (0.65 + 0.35 * smooth01(y / 0.9));
        col[i * 3] = k;
        col[i * 3 + 1] = k;
        col[i * 3 + 2] = k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.translate(0, wallH / 2 - 0.06, 0);
      this.roomGroup.add(new THREE.Mesh(g, this.wallMat));
      // rune band
      const bg = new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.38, 96, 1, true, gap, TAU - gap * 2);
      bg.translate(0, 2.35, 0);
      const band = new THREE.Mesh(bg, this.bandRuneMat);
      band.renderOrder = 3;
      this.roomGroup.add(band);
      // a carved ledge under the band
      const lg = new THREE.CylinderGeometry(R + 0.18, R + 0.18, 0.12, 72, 1, true, gap, TAU - gap * 2);
      lg.translate(0, 2.08, 0);
      this.ledgeMat.color.copy(this.stoneTint).multiplyScalar(0.7);
      this.roomGroup.add(new THREE.Mesh(lg, this.ledgeMat));
    }

    // --- columns around the wall, torches on the back pair and the side pair
    const colAngles = [];
    const nCol = 9;
    for (let i = 0; i < nCol; i++) {
      const a = gap + 0.12 + ((TAU - gap * 2 - 0.24) * i) / (nCol - 1);
      colAngles.push(a);
    }
    const carr = this.columns.instanceMatrix.array;
    for (let i = 0; i < colAngles.length; i++) {
      const a = colAngles[i];
      setTRS(carr, i, Math.sin(a) * (R + 0.08), -0.06, Math.cos(a) * (R + 0.08), a, 0, 0, 1);
      this._c.copy(this._white).multiplyScalar(0.85 + rng() * 0.2);
      this.columns.setColorAt(i, this._c);
    }
    this.columns.count = colAngles.length;
    this.columns.instanceMatrix.needsUpdate = true;
    this.columns.instanceColor.needsUpdate = true;
    // torches between columns: back-left / back-right (lights) and left / right (flames only)
    const tAng = [Math.PI - 0.62, Math.PI + 0.62, Math.PI / 2 + 0.05, -Math.PI / 2 - 0.05];
    this._torchPos = [];
    const sarr = this.sconces.instanceMatrix.array;
    for (let i = 0; i < tAng.length; i++) {
      const a = tAng[i];
      const r = R + 0.05;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      // sconce faces the room centre (+Z of the sconce toward the centre)
      setTRS(sarr, i, x - Math.sin(a) * 0.25, 2.0, z - Math.cos(a) * 0.25, a + Math.PI, 0, 0, 1);
      const fx = x - Math.sin(a) * 0.35;
      const fz = z - Math.cos(a) * 0.35;
      this._torchPos.push(new THREE.Vector3(fx, 2.12, fz));
    }
    this.sconces.count = tAng.length;
    this.sconces.instanceMatrix.needsUpdate = true;
    this.torchL.position.copy(this._torchPos[0]).add(this._v.set(0, 0.3, 0.3));
    this.torchR.position.copy(this._torchPos[1]).add(this._v.set(0, 0.3, 0.3));
    this.U.uTorchP.value[0].copy(this._torchPos[0]);
    this.U.uTorchP.value[1].copy(this._torchPos[1]);

    // --- window + light shaft (back-left, high up), falling onto the dais
    {
      const a = Math.PI + 0.28;
      const wx = Math.sin(a) * (R + 0.3);
      const wz = Math.cos(a) * (R + 0.3);
      this.windowMesh.position.set(wx, 4.9, wz);
      this.windowMesh.rotation.set(0, a + Math.PI, 0);
      const A = new THREE.Vector3(wx * 0.96, 4.7, wz * 0.96);
      const B = new THREE.Vector3(room.worldX(cols * 0.62), 0, room.worldZ(rows * 0.45));
      this._shaftFloor = B;
      this.U.uShaftA.value.copy(A);
      this.U.uShaftB.value.copy(B);
      this.windowLight.position.copy(A).add(A.clone().sub(B).multiplyScalar(2));
      this.windowLight.target.position.copy(B);
      // two crossed quads from the window (narrow) to the floor (wide)
      const axis = B.clone().sub(A).normalize();
      const s1 = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 0, 1)).normalize();
      const s2 = new THREE.Vector3().crossVectors(axis, s1).normalize();
      const verts = [];
      const uvs = [];
      const pushQuad = (side) => {
        const wa = 0.42;
        const wb = 1.5;
        const a0 = A.clone().addScaledVector(side, -wa);
        const a1 = A.clone().addScaledVector(side, wa);
        const b0 = B.clone().addScaledVector(side, -wb);
        const b1 = B.clone().addScaledVector(side, wb);
        verts.push(...a0.toArray(), ...a1.toArray(), ...b1.toArray(), ...a0.toArray(), ...b1.toArray(), ...b0.toArray());
        uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      };
      pushQuad(s1);
      pushQuad(s2);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      sg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      this.shaft.geometry.dispose();
      this.shaft.geometry = sg;
    }

    // --- tiles
    this._tileCount = cols * rows;
    for (let i = 0; i < this._tileCount; i++) {
      this._tileRot[i] = Math.floor(rng() * 4);
      this._tileTint[i] = 0.84 + rng() * 0.22;
      this._tileGlyph[i] = Math.floor(rng() * 16);
      this._flips[i] = 0;
      this._flipSeen[i] = -1e9;
    }

    // --- stele position (behind the back row): mural / bell sockets / emblem
    const steleZ = room.worldZ(0) - 1.15;
    this.stele.visible = p.type !== 'beam';
    this.stele.position.set(0, -0.06, steleZ);
    this._drawMural(room);

    // --- puzzle pieces
    const t = p.type;
    const vis = (o, on) => {
      o.visible = on;
    };
    vis(this.bellFrames, t === 'bells');
    vis(this.bellBodies, t === 'bells');
    vis(this.bellBands, t === 'bells');
    vis(this.pennants, t === 'bells');
    vis(this.mirrorFrames, t === 'beam');
    vis(this.mirrorFaces, t === 'beam');
    vis(this.beamCore, t === 'beam');
    vis(this.beamGlow, t === 'beam');
    vis(this.emitter, t === 'beam');
    vis(this.crystal, t === 'beam');
    vis(this.blocks, t === 'blocks');
    vis(this.plates, t === 'blocks');
    vis(this.solids, t === 'blocks');
    this.gems.count = 0;
    this.pedestals.count = 0;

    if (t === 'bells') {
      const n = room.bells.length;
      const farr = this.bellFrames.instanceMatrix.array;
      const parr = this.pedestals.instanceMatrix.array;
      const penArr = this.pennants.instanceMatrix.array;
      let pc = 0;
      for (let i = 0; i < n; i++) {
        const b = room.bells[i];
        const x = room.worldX(b.x);
        const z = room.worldZ(b.y);
        setTRS(farr, i, x, 0.1, z, 0, 0, 0, 1);
        setTRS(parr, i, x, -0.02, z, 0, 0, 0, 1.18, 1, 1.18);
        this.pedestals.setColorAt(i, this._white);
        const col = this._bellCols[b.color];
        for (const sx of [-1, 1]) {
          setTRS(penArr, pc, x + sx * 0.5, 1.62, z + 0.075, 0, 0, 0, 1);
          this.pennants.setColorAt(pc, col);
          pc++;
        }
        this.bellBands.setColorAt(i, col);
      }
      this.bellFrames.count = n;
      this.pedestals.count = n;
      this.bellBodies.count = n;
      this.bellBands.count = n;
      this.pennants.count = pc;
      for (const m of [this.bellFrames, this.pedestals, this.pennants]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    } else if (t === 'beam') {
      const n = room.mirrors.length;
      const parr = this.pedestals.instanceMatrix.array;
      for (let i = 0; i < n; i++) {
        const m = room.mirrors[i];
        setTRS(parr, i, room.worldX(m.x), -0.02, room.worldZ(m.y), 0, 0, 0, 1);
        this.pedestals.setColorAt(i, this._white);
      }
      this.pedestals.count = n;
      this.pedestals.instanceMatrix.needsUpdate = true;
      this.pedestals.instanceColor.needsUpdate = true;
      this.mirrorFrames.count = n;
      this.mirrorFaces.count = n;
      const src = room.source;
      const sdx = [1, 0, -1, 0][src.dir];
      const sdy = [0, 1, 0, -1][src.dir];
      this.emitter.position.set(room.worldX(src.x + sdx * 0.15), -0.06, room.worldZ(src.y + sdy * 0.15));
      // the emitter model shoots along +Z; rotate +Z onto the beam direction
      this.emitter.rotation.set(0, Math.atan2(sdx, sdy), 0);
      this.crystal.position.set(room.worldX(room.crystal.x), -0.06, room.worldZ(room.crystal.y));
      // pull the outside pieces slightly toward the grid so they sit on the floor ring
      const cx = room.crystal.x < 0 ? 0.12 : room.crystal.x >= cols ? -0.12 : 0;
      const cz = room.crystal.y < 0 ? 0.12 : 0;
      this.crystal.position.x += cx;
      this.crystal.position.z += cz;
    } else if (t === 'blocks') {
      const sarr2 = this.solids.instanceMatrix.array;
      const solidCells = p.solid || EMPTY;
      for (let i = 0; i < solidCells.length && i < 8; i++) {
        const c = solidCells[i];
        setTRS(sarr2, i, room.worldX(c % cols), 0.0, room.worldZ((c / cols) | 0), rng() * TAU, 0, 0, 1);
        this.solids.setColorAt(i, this._c.copy(this._white).multiplyScalar(0.8 + rng() * 0.2));
      }
      this.solids.count = Math.min(8, solidCells.length);
      this.solids.instanceMatrix.needsUpdate = true;
      this.solids.instanceColor.needsUpdate = true;
      const plarr = this.plates.instanceMatrix.array;
      for (let i = 0; i < room.plates.length; i++) {
        const q = room.plates[i];
        setTRS(plarr, i, room.worldX(q.x), 0.03, room.worldZ(q.y), 0, 0, 0, 1);
        this.plates.setColorAt(i, this._white);
      }
      this.plates.count = room.plates.length;
      this.plates.instanceMatrix.needsUpdate = true;
      this.plates.instanceColor.needsUpdate = true;
      this.blocks.count = room.blocks.length;
    }
    this._lastVfxId = room.vfx.length ? room.vfx[room.vfx.length - 1].id : 0;
    this._lastActs = room.pogo.acts;
    for (const r of this._rings) r.on = false;
    this._hudKey = '';
    this._pogoYaw = Math.PI / 2;
    this._crystalBloom = 0;
    this._solveFlash = 0;
  }

  // the stele face: target pattern (lights), bell sockets (bells) or an emblem (blocks)
  _drawMural(room) {
    const p = room.puzzle;
    const c = this.muralCanvas;
    const ctx = c.getContext('2d');
    const gc = this.muralGlowCanvas.getContext('2d');
    const W = c.width;
    const H = c.height;
    const glow = '#' + this.glowCol.getHexString();
    ctx.fillStyle = '#8d857c';
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, mulberry32(12), 30, 10, 60, 0.12, false);
    ctx.strokeStyle = 'rgba(30,24,18,0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.strokeStyle = 'rgba(255,240,220,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    gc.fillStyle = '#000';
    gc.fillRect(0, 0, W, H);
    const carve = (draw) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(25,20,16,0.65)';
      ctx.fillStyle = 'rgba(25,20,16,0.55)';
      draw(ctx);
      ctx.restore();
    };
    this._sockets = null;
    if (p.type === 'lights') {
      const n = p.n;
      const cell = Math.min(W - 60, H - 90) / n;
      const ox = (W - cell * n) / 2;
      const oy = 34;
      if (p.showTarget) {
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            const on = p.target[y * n + x];
            const cx = ox + (x + 0.5) * cell;
            const cy = oy + (y + 0.5) * cell;
            carve((k) => {
              k.lineWidth = 4;
              k.beginPath();
              k.arc(cx, cy, cell * 0.36, 0, TAU);
              k.stroke();
            });
            if (on) {
              const g = gc.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.42);
              g.addColorStop(0, '#ffffff');
              g.addColorStop(0.35, glow);
              g.addColorStop(1, 'rgba(0,0,0,0)');
              gc.fillStyle = g;
              gc.beginPath();
              gc.arc(cx, cy, cell * 0.42, 0, TAU);
              gc.fill();
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(cx, cy, cell * 0.26, 0, TAU);
              ctx.fill();
            } else {
              carve((k) => {
                k.beginPath();
                k.arc(cx, cy, cell * 0.12, 0, TAU);
                k.fill();
              });
            }
          }
        }
      } else {
        // the pattern is outside: a weathered face and an eye pointing at the tower
        ctx.font = '900 120px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(25,20,16,0.55)';
        ctx.fillText('?', W / 2, H * 0.42);
        gc.font = '900 120px Georgia, serif';
        gc.textAlign = 'center';
        gc.textBaseline = 'middle';
        gc.fillStyle = glow;
        gc.globalAlpha = 0.35;
        gc.fillText('?', W / 2, H * 0.42);
        gc.globalAlpha = 1;
      }
      // footer rune line
      carve((k) => {
        k.lineWidth = 3;
        k.beginPath();
        k.moveTo(40, H - 46);
        k.lineTo(W - 40, H - 46);
        k.stroke();
      });
    } else if (p.type === 'bells') {
      // an engraved bell and one socket per note of the tune
      carve((k) => {
        k.lineWidth = 6;
        k.beginPath();
        k.moveTo(W / 2 - 46, 170);
        k.quadraticCurveTo(W / 2 - 40, 80, W / 2, 70);
        k.quadraticCurveTo(W / 2 + 40, 80, W / 2 + 46, 170);
        k.lineTo(W / 2 - 60, 178);
        k.lineTo(W / 2 + 60, 178);
        k.stroke();
        k.beginPath();
        k.arc(W / 2, 192, 9, 0, TAU);
        k.fill();
      });
      const n = p.order.length;
      const sp = Math.min(40, (W - 60) / n);
      const sockets = [];
      for (let i = 0; i < n; i++) {
        const cx = W / 2 + (i - (n - 1) / 2) * sp;
        const cy = 250;
        carve((k) => {
          k.lineWidth = 4;
          k.beginPath();
          k.arc(cx, cy, 12, 0, TAU);
          k.stroke();
          k.beginPath();
          k.arc(cx, cy, 6, 0, TAU);
          k.fill();
        });
        sockets.push([cx / W, cy / H]);
      }
      this._sockets = sockets;
    } else {
      // blocks: two plates and a block, engraved
      carve((k) => {
        k.lineWidth = 5;
        k.strokeRect(W / 2 - 40, 90, 80, 80);
        k.beginPath();
        k.ellipse(W / 2, 230, 70, 22, 0, 0, TAU);
        k.stroke();
        k.beginPath();
        k.moveTo(W / 2, 178);
        k.lineTo(W / 2, 204);
        k.moveTo(W / 2 - 10, 194);
        k.lineTo(W / 2, 206);
        k.lineTo(W / 2 + 10, 194);
        k.stroke();
      });
      gc.strokeStyle = glow;
      gc.globalAlpha = 0.5;
      gc.lineWidth = 4;
      gc.beginPath();
      gc.ellipse(W / 2, 230, 70, 22, 0, 0, TAU);
      gc.stroke();
      gc.globalAlpha = 1;
    }
    speckle(ctx, W, H, mulberry32(3), 18);
    this.muralTex.needsUpdate = true;
    this.muralGlowTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ mapping helpers
  _syncMapCam(room) {
    const v = room.view;
    const cam = this.mapCam;
    cam.fov = v.fov;
    cam.aspect = this.width / this.height;
    cam.position.set(v.eye[0], v.eye[1], v.eye[2]);
    cam.lookAt(v.target[0], v.target[1], v.target[2]);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  resize(width, height) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    for (const cam of [this.camera, this.mapCam]) {
      cam.aspect = Math.max(0.3, width / height);
      cam.updateProjectionMatrix();
    }
    const o = this.oCam;
    o.left = 0;
    o.right = width;
    o.top = 0;
    o.bottom = -height;
    o.updateProjectionMatrix();
    this.vignette.scale.set(width, height, 1);
    this.vignette.position.set(width / 2, -height / 2, -5);
    this._hudKey = '';
  }

  // ------------------------------------------------------------------ render
  render(room, { time = 0, particles = null, popups = null, shake = 0 } = {}) {
    if (!room || !room.puzzle) return;
    const gl = this.gl;
    const dt = this._lastTime === null ? 1 / 60 : clamp(time - this._lastTime, 0, 0.05);
    this._lastTime = time;
    if (room.puzzle !== this._puzzleRef || room !== this._roomRef || (room.t || 0) < (this._lastRoomT || 0)) this._setupRoom(room);
    this._lastRoomT = room.t || 0;
    this._kx = room.width ? this.width / room.width : 1;
    this._ky = room.height ? this.height / room.height : 1;
    const U = this.U;
    U.uTime.value = time;
    const pr = gl.getPixelRatio ? gl.getPixelRatio() : 1;
    U.uPx.value = (this.height * pr) / (2 * Math.tan((this.camera.fov * DEG) / 2));

    this._syncMapCam(room);
    const mag = (Number(typeof shake === 'object' ? Math.hypot(shake.x || 0, shake.y || 0) : shake) || 0) * 0.006;
    this._updateCamera(room, time, dt, mag);

    this._consumeVfx(room, time);
    this.fxLight.intensity = 0;
    this.glows.begin();
    this.stars.begin();
    this.fglows.begin();
    this.shades.begin();
    this.rings.begin();
    this._updateTorches(room, time);
    this._updateTiles(room, time);
    this._updateDoor(room, time);
    if (room.type === 'bells') this._updateBells(room, time);
    else if (room.type === 'beam') this._updateBeam(room, time, dt);
    else if (room.type === 'blocks') this._updateBlocks(room, time);
    this._updateStele(room, time);
    this._updatePogo(room, time, dt);
    this._updateReward(room, time, dt);
    this._updateRings(room, time);
    this.glows.end();
    this.stars.end();
    this.fglows.end();
    this.shades.end();
    this.rings.end();
    this.ringAttr.needsUpdate = true;

    // overlay
    this._popFrame++;
    this._updateFxGroup(room);
    this._drawHud(room);
    this._updateExitChip(room, time);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, room);
    this.vigMat.uniforms.uFade.value = clamp(room.fade ?? 0, 0, 1);
    this._solveFlash = Math.max(0, this._solveFlash - dt * 2.2);
    this.vigMat.uniforms.uFlash.value = this._solveFlash;

    const prevAuto = gl.autoClear;
    const prevExp = gl.toneMappingExposure;
    gl.toneMappingExposure = this.exposure;
    gl.autoClear = true;
    gl.render(this.scene, this.camera);
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(this.overlay, this.oCam);
    gl.autoClear = prevAuto;
    gl.toneMappingExposure = prevExp;
  }

  // Intro: dolly in through the door. Play: slow handheld drift. Solved: gentle push-in toward the
  // reward. Leaving: drift toward the door while the screen fades.
  _updateCamera(room, time, dt, mag) {
    const v = room.view;
    const cam = this.camera;
    const ph = room.phase;
    const kIn = ph === 'intro' ? 1 - smooth01(room.phaseT / INTRO_T) : 0;
    const kSolve = room.solved && room.rewardT >= 0 ? smooth01((room.t - room.rewardT) / 1.6) * (ph === 'leaving' ? 0.6 : 1) : 0;
    const kLeave = ph === 'leaving' || ph === 'done' ? smooth01(room.fade || 0) : 0;
    const dX = Math.sin(time * 0.23) * 0.07 + Math.sin(time * 0.61) * 0.02;
    const dY = Math.cos(time * 0.19) * 0.05;
    const ex = v.eye[0] + dX;
    let ey = v.eye[1] + dY - kIn * kIn * 1.6 - kSolve * 0.5;
    let ez = v.eye[2] + kIn * kIn * 2.4 - kSolve * 0.6;
    const tx = v.target[0] + dX * 0.4;
    let ty = v.target[1] + kSolve * 0.35;
    let tz = v.target[2] + kIn * kIn * 0.9;
    // leaving: lean toward the door threshold
    ey -= kLeave * 0.8;
    ez += kLeave * 0.6;
    ty -= kLeave * 0.3;
    tz += kLeave * 1.2;
    cam.position.set(ex + Math.sin(time * 71.3) * mag, ey + Math.cos(time * 63.1) * mag, ez);
    cam.lookAt(tx, ty, tz);
    cam.fov = v.fov;
    cam.aspect = this.width / this.height;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  // particles / popups from the game are in the logic's screen space (mapCam); keep them glued to the
  // world while the view camera drifts
  _updateFxGroup(room) {
    const W = this.width;
    const H = this.height;
    const a = this._va.set(-2, 0, -1.5);
    const b = this._vb.set(2, 0.8, 1.5);
    const pa = this._v.copy(a).project(this.mapCam);
    const pax = (pa.x + 1) * 0.5 * W;
    const pay = (1 - pa.y) * 0.5 * H;
    const pb = this._v.copy(b).project(this.mapCam);
    const pbx = (pb.x + 1) * 0.5 * W;
    const pby = (1 - pb.y) * 0.5 * H;
    const qa = this._v.copy(a).project(this.camera);
    const qax = (qa.x + 1) * 0.5 * W;
    const qay = (1 - qa.y) * 0.5 * H;
    const qb = this._v.copy(b).project(this.camera);
    const qbx = (qb.x + 1) * 0.5 * W;
    const qby = (1 - qb.y) * 0.5 * H;
    const sx = Math.abs(pbx - pax) > 1 ? (qbx - qax) / (pbx - pax) : 1;
    const sy = Math.abs(pby - pay) > 1 ? (qby - qay) / (pby - pay) : 1;
    const g = this.fxGroup;
    g.scale.set(sx, sy, 1);
    g.position.set(qax - pax * sx, -(qay - pay * sy), 0);
    void room;
  }

  // ------------------------------------------------------------------ vfx events -> renderer fx
  _ring(x, y, z, r0, r1, life, col, flat, delay = 0) {
    let best = this._rings[0];
    for (const r of this._rings) {
      if (!r.on) {
        best = r;
        break;
      }
      if (r.t0 < best.t0) best = r;
    }
    best.on = true;
    best.t0 = this.U.uTime.value + delay;
    best.life = life;
    best.x = x;
    best.y = y;
    best.z = z;
    best.r0 = r0;
    best.r1 = r1;
    best.flat = flat ? 1 : 0;
    best.col.copy(col);
  }

  _consumeVfx(room, time) {
    const vfx = room.vfx || EMPTY;
    for (let i = 0; i < vfx.length; i++) {
      const e = vfx[i];
      if (e.id <= this._lastVfxId) continue;
      this._lastVfxId = e.id;
      const x = room.worldX(e.x);
      const z = room.worldZ(e.y);
      if (e.kind === 'ring') {
        const b = room.bells[e.b];
        const col = this._bellCols[b.color];
        for (let k = 0; k < 3; k++) this._ring(x, 1.1, z, 0.25, 1.8 + k * 0.5, 1.1 + k * 0.15, col, false, k * 0.16);
        this._ring(x, 0.03, z, 0.3, 2.2, 1.3, col, true);
      } else if (e.kind === 'wrong') {
        this._c.set('#8c7aa6');
        this._ring(x, 1.1, z, 0.2, 1.2, 0.9, this._c, false);
        this._ring(x, 0.03, z, 0.3, 1.4, 1.0, this._c, true);
      } else if (e.kind === 'stomp') {
        this._ring(x, 0.05, z, 0.2, 1.7, 0.6, e.a ? this.glowCol : this._c.set('#b8a48c'), true);
      } else if (e.kind === 'hopland' || e.kind === 'bump') {
        this._ring(x, 0.04, z, 0.1, 0.7, 0.35, this._c.set('#7d6a58'), true);
      } else if (e.kind === 'plate') {
        this._ring(x, 0.06, z, 0.3, 2.0, 0.9, this.glowCol, true);
        this._ring(x, 0.9, z, 0.2, 1.3, 0.7, this.glowCol, false);
      } else if (e.kind === 'push' || e.kind === 'undo') {
        this._ring(x, 0.04, z, 0.2, 1.0, 0.45, this._c.set('#8a7660'), true);
      } else if (e.kind === 'rotate') {
        this._ring(x, 0.06, z, 0.2, 1.1, 0.5, this._c.set('#ffcf7a'), true);
      } else if (e.kind === 'crystal') {
        this._crystalBloom = 1;
        for (let k = 0; k < 3; k++) this._ring(x, 1.1, z, 0.3, 2.6 + k, 1.2, this.glowCol, false, k * 0.12);
      } else if (e.kind === 'solve') {
        this._solveFlash = 0.8;
        for (let k = 0; k < 4; k++) this._ring(0, 0.05, 0, 0.5, 4 + k * 1.2, 1.6, k % 2 ? this._gold : this.glowCol, true, k * 0.18);
      } else if (e.kind === 'collect') {
        this._ring(x, 0.9, z, 0.2, 1.5, 0.6, this._gold, false);
      }
    }
    void time;
  }

  // ------------------------------------------------------------------ world updates
  _updateTorches(room, time) {
    const tp = this._torchPos;
    let f0 = 0;
    for (let i = 0; i < tp.length; i++) {
      const p = tp[i];
      const fl = 0.82 + 0.1 * Math.sin(time * 13.1 + i * 2.1) + 0.08 * Math.sin(time * 23.7 + i * 5.3) + 0.06 * Math.sin(time * 7.3 + i);
      if (i === 0) f0 = fl;
      this.flames.bill(p.x, p.y, p.z, 0.36 * fl, 0.62 * (0.9 + 0.1 * fl), Math.sin(time * 3 + i) * 0.05, (i * 0.27) % 1, 1, 1);
      const tc = this.U.uTorch.value;
      this.glows.bill(p.x, p.y + 0.2, p.z, 1.7 * fl, 1.7 * fl, 0, tc.r * 0.32, tc.g * 0.32, tc.b * 0.32);
      this.glows.bill(p.x, p.y + 0.12, p.z, 0.6, 0.6, 0, 0.9 * fl, 0.65 * fl, 0.35 * fl);
      // reflection streak smeared toward the camera across the polished floor
      const dx = this.camera.position.x - p.x;
      const dz = this.camera.position.z - p.z;
      const rot = Math.atan2(dx, dz);
      const len = 3.2;
      this.fglows.flat(p.x + Math.sin(rot) * len * 0.42, -0.03, p.z + Math.cos(rot) * len * 0.42, 0.7 * fl, len, rot, tc.r * 0.3 * fl, tc.g * 0.24 * fl, tc.b * 0.16 * fl);
      this.fglows.flat(p.x + Math.sin(rot) * len * 0.3, -0.025, p.z + Math.cos(rot) * len * 0.3, 0.22 * fl, len * 0.7, rot, tc.r * 0.35 * fl, tc.g * 0.3 * fl, tc.b * 0.22 * fl);
      this.fglows.flat(p.x * 0.9, -0.03, p.z * 0.9, 2.6, 2.6, 0, tc.r * 0.07, tc.g * 0.055, tc.b * 0.04);
    }
    const f1 = 0.82 + 0.1 * Math.sin(time * 12.3 + 7.1) + 0.08 * Math.sin(time * 21.9 + 3.3);
    const solvedBoost = room.solved ? 1.15 : 1;
    this.torchL.intensity = 15 * f0 * solvedBoost;
    this.torchR.intensity = 15 * f1 * solvedBoost;
    // window pool of light on the dais + a faint glow at the window
    const B = this._shaftFloor;
    this.fglows.flat(B.x, 0.03, B.z, 2.3, 1.6, 0.5, 0.16, 0.19, 0.24);
    this.glows.bill(this.windowMesh.position.x * 0.98, this.windowMesh.position.y, this.windowMesh.position.z * 0.98, 2.6, 3.2, 0, 0.15, 0.18, 0.24);
    // rune band brightness
    const solvedK = room.rewardT >= 0 ? clamp((room.t - room.rewardT) / 0.8, 0, 1) : 0;
    this.U.uBand.value = 0.55 + 0.25 * Math.sin(time * 0.7) * 0.5 + solvedK * 0.6;
    this.U.uSolved.value = room.solved ? 1 : 0;
  }

  _updateTiles(room, time) {
    const cols = room.cols;
    const rows = room.rows;
    const arr = this.tiles.instanceMatrix.array;
    const at = this.tileAttr.array;
    const p = room.puzzle;
    const lights = room.type === 'lights';
    const tint = this._c;
    const solvedAge = room.rewardT >= 0 ? room.t - room.rewardT : -1;
    let k = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const wx = room.worldX(x);
        const wz = room.worldZ(y);
        let lit = 0;
        let flash = 0;
        let glyph = -1;
        let strength = 0;
        let ry = this._tileRot[i] * (Math.PI / 2);
        let rx = 0;
        let lift = 0;
        if (lights) {
          const gx = x - p.gx;
          const gy = y - p.gy;
          if (gx >= 0 && gy >= 0 && gx < p.n && gy < p.n) {
            const gi = gy * p.n + gx;
            const fa = room.flipAt[gi];
            if (fa !== this._flipSeen[i]) {
              if (this._flipSeen[i] > -1e8) this._flips[i]++;
              this._flipSeen[i] = fa;
            }
            const since = room.t - fa;
            const on = room.lit[gi];
            let shown = on;
            if (since < 0) shown = on ? 0 : 1;
            else if (since < FLIP_T) {
              const q = since / FLIP_T;
              const e = q * q * (3 - 2 * q);
              rx = (this._flips[i] - 1 + e) * Math.PI;
              lift = Math.sin(q * Math.PI) * 0.3;
              shown = q < 0.5 ? (on ? 0 : 1) : on;
              flash = q > 0.5 ? 1 : 0.3;
            } else {
              rx = this._flips[i] * Math.PI;
              flash = since < 2 ? Math.exp(-(since - FLIP_T) * 4) : 0;
            }
            lit = shown;
            glyph = this._tileGlyph[i];
            strength = 1;
            if (solvedAge >= 0) {
              const d = Math.hypot(gx - (p.n - 1) / 2, gy - (p.n - 1) / 2);
              const w = solvedAge * 3 - d;
              flash = Math.max(flash, w > 0 && w < 1.2 ? Math.sin((w / 1.2) * Math.PI) : 0);
              lit = Math.max(lit, room.lit[gi]);
            }
            // glow pools under lit runes
            if (lit > 0.5) this.fglows.flat(wx, 0.05, wz, 1.25, 1.25, 0, this.glowCol.r * (0.1 + flash * 0.3), this.glowCol.g * (0.1 + flash * 0.3), this.glowCol.b * (0.1 + flash * 0.3));
            if (flash > 0.05) this.glows.bill(wx, 0.25 + lift, wz, 1.1 * flash + 0.3, 1.1 * flash + 0.3, 0, this.glowCol.r * flash * 0.5, this.glowCol.g * flash * 0.5, this.glowCol.b * flash * 0.5);
          }
        } else if (room.type === 'blocks' && room.solid[i]) {
          // under a broken column the slab is cracked and dark
        }
        // the entrance tile: a faint arrow rune pointing out
        if (x === room.doorX && y === rows - 1) {
          glyph = -1;
        }
        tint.copy(this._white).multiplyScalar(this._tileTint[i] * (lights && strength ? 1.0 : 0.9));
        setTRS(arr, k, wx, -0.06 + lift, wz, ry, rx, 0, 1);
        this.tiles.setColorAt(k, tint);
        at[k * 4] = lit;
        at[k * 4 + 1] = flash;
        at[k * 4 + 2] = glyph;
        at[k * 4 + 3] = strength;
        k++;
      }
    }
    this.tiles.count = k;
    if (lights) {
      let litN = 0;
      for (let i = 0; i < room.lit.length; i++) litN += room.lit[i];
      this.fxLight.color.copy(this.glowCol);
      this.fxLight.position.set(0, 1.3, room.worldZ(p.gy + (p.n - 1) / 2));
      this.fxLight.intensity = 1.5 + litN * 0.45;
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    this.tiles.instanceColor.needsUpdate = true;
    this.tileAttr.needsUpdate = true;
    void time;
  }

  _updateDoor(room, time) {
    const po = room.pogo;
    const onEntrance = po.x === room.doorX && po.y === room.rows - 1 && !po.moving && (room.phase === 'play' || room.phase === 'solved');
    this._onEntrance = onEntrance;
    const pulse = 0.55 + 0.45 * Math.sin(time * 4);
    const k = onEntrance ? 1 : 0.35;
    const g = this.glowCol;
    this.exitMat.color.setRGB(g.r * (0.6 + pulse * 0.8) * k, g.g * (0.6 + pulse * 0.8) * k, g.b * (0.6 + pulse * 0.8) * k);
    this.exitMark.position.set(this._doorX, -0.01, this._doorZ + 0.32);
    this.exitMark.scale.set(0.7, 1, 0.7);
    // cool daylight spilling in from the stairwell, rune caps on the door posts
    this.fglows.flat(this._doorX, 0.02, this._doorZ + 0.1, 2.0, 1.8, 0, 0.14, 0.18, 0.26);
    this.fglows.flat(this._doorX, -0.2, this._doorZ + 0.8, 1.6, 1.4, 0, 0.12, 0.16, 0.24);
    this.glows.bill(this._doorX, 0.3, this._doorZ + 1.0, 2.2, 1.2, 0, 0.05, 0.07, 0.11);
    for (const sx of [-1, 1]) {
      const x = this._doorX + sx * 0.74;
      this.glows.bill(x, 0.62, this._doorZ + 0.08, 0.5 + pulse * 0.15 * k, 0.5 + pulse * 0.15 * k, 0, g.r * 0.5 * (0.4 + k), g.g * 0.5 * (0.4 + k), g.b * 0.5 * (0.4 + k));
    }
  }

  _updateBells(room, time) {
    const barr = this.bellBodies.instanceMatrix.array;
    const garr = this.gems.instanceMatrix.array;
    let gi = this.gems.count = 0;
    const penArr = this.pennants.instanceMatrix.array;
    for (let i = 0; i < room.bells.length; i++) {
      const b = room.bells[i];
      const x = room.worldX(b.x);
      const z = room.worldZ(b.y);
      const since = room.t - b.ringAt;
      const wrongSince = room.t - b.wrongAt;
      const wob = wrongSince >= 0 && wrongSince < 0.8 ? Math.sin(wrongSince * 30) * 0.08 * (1 - wrongSince / 0.8) : 0;
      const size = 1.3 - (b.note / 9) * 0.3; // low notes = big bells
      setTRS(barr, i, x, 1.62, z, 0, b.swing, wob, size);
      const col = this._bellCols[b.color];
      const flash = since >= 0 && since < 1.5 ? Math.exp(-since * 2.6) : 0;
      const hint = room.hintBell === i ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
      this._c.copy(col).multiplyScalar(0.75 + flash * 1.6 + hint * 0.8);
      this.bellBands.setColorAt(i, this._c);
      // gem on top of the frame
      setTRS(garr, gi, x, 1.86, z, time * 0.8 + i, 0, 0, 1 + flash * 0.4, 1.4 + flash * 0.4, 1 + flash * 0.4);
      this._c.copy(col).multiplyScalar(1.1 + flash * 1.5 + hint);
      this.gems.setColorAt(gi, this._c);
      gi++;
      const gk = 0.28 + flash * 0.9 + hint * 0.9;
      this.glows.bill(x, 1.86, z, 0.55 + gk * 0.6, 0.55 + gk * 0.6, 0, col.r * gk, col.g * gk, col.b * gk);
      // the bell mouth glows while it rings
      const mouthY = 1.62 - 0.5 * size;
      const sw = b.swing;
      if (flash > 0.02) {
        this.glows.bill(x, mouthY + 0.1, z + Math.sin(sw) * 0.5 * size, 1.4 * flash + 0.3, 1.4 * flash + 0.3, 0, col.r * flash * 0.7, col.g * flash * 0.7, col.b * flash * 0.7);
        this.stars.bill(x + 0.18, mouthY + 0.25, z, 0.5 * flash, 0.5 * flash, time * 2, col.r * flash, col.g * flash, col.b * flash);
      }
      this.fglows.flat(x, 0.04, z, 1.6 + flash, 1.6 + flash, 0, col.r * (0.07 + flash * 0.3 + hint * 0.25), col.g * (0.07 + flash * 0.3 + hint * 0.25), col.b * (0.07 + flash * 0.3 + hint * 0.25));
      if (hint > 0) {
        this.stars.bill(x, 2.05 + Math.sin(time * 3) * 0.06, z, 0.7 * hint + 0.2, 0.7 * hint + 0.2, time, col.r * hint, col.g * hint, col.b * hint);
      }
      this.shades.flat(x, 0.11, z, 1.2, 1.0, 0, 0.55, 0, 0);
      // pennants flutter
      for (let s = 0; s < 2; s++) {
        const sx = s ? 1 : -1;
        setTRS(penArr, i * 2 + s, x + sx * 0.5, 1.6, z + 0.075, Math.sin(time * 1.7 + i + s) * 0.25, Math.sin(time * 2.3 + i * 2 + s) * 0.12 + flash * 0.3, 0, 1);
      }
    }
    this.gems.count = gi;
    this.bellBodies.instanceMatrix.needsUpdate = true;
    this.bellBands.instanceColor.needsUpdate = true;
    this.gems.instanceMatrix.needsUpdate = true;
    this.gems.instanceColor.needsUpdate = true;
    this.pennants.instanceMatrix.needsUpdate = true;
  }

  _updateBeam(room, time, dt) {
    const bm = room.beam;
    const pts = bm.pts;
    const n = bm.n;
    const core = this.beamCore.instanceMatrix.array;
    const glow = this.beamGlow.instanceMatrix.array;
    const g = this.glowCol;
    let s = 0;
    const warm = this._c2.set('#ffcf7a');
    for (let i = 0; i + 1 < n && s < MAX_BEAM; i++) {
      const ax = room.worldX(pts[i * 2]);
      const az = room.worldZ(pts[i * 2 + 1]);
      const bx = room.worldX(pts[i * 2 + 2]);
      const bz = room.worldZ(pts[i * 2 + 3]);
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      // cylinder along +Y -> segment direction (horizontal): yaw then pitch 90deg
      const yaw = Math.atan2(dx, dz);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      setTRS(core, s, mx, BEAM_Y, mz, yaw, Math.PI / 2, 0, 0.035, len, 0.035);
      setTRS(glow, s, mx, BEAM_Y, mz, yaw, Math.PI / 2, 0, 0.12, len, 0.12);
      // light pooling on the floor along the beam
      this.fglows.flat(mx, 0.04, mz, 0.7, len + 0.4, yaw, warm.r * 0.12, warm.g * 0.1, warm.b * 0.06);
      s++;
      // bounce points sparkle
      this.glows.bill(bx, BEAM_Y, bz, 0.7, 0.7, 0, 0.9, 0.75, 0.45);
    }
    this.beamCore.count = s;
    this.beamGlow.count = s;
    this.beamCore.instanceMatrix.needsUpdate = true;
    this.beamGlow.instanceMatrix.needsUpdate = true;
    // emitter lens
    if (n > 0) {
      const ex = room.worldX(pts[0]);
      const ez = room.worldZ(pts[1]);
      const pul = 0.85 + 0.15 * Math.sin(time * 6);
      this.glows.bill(ex, BEAM_Y, ez, 1.3 * pul, 1.3 * pul, 0, 1.0, 0.8, 0.45);
      this.stars.bill(ex, BEAM_Y, ez, 0.9, 0.9, time * 0.5, 1, 0.9, 0.7);
    }
    // where the beam ends (not on the crystal): scorching glints on the wall
    if (n > 1 && !bm.hit) {
      const lx = room.worldX(pts[(n - 1) * 2]);
      const lz = room.worldZ(pts[(n - 1) * 2 + 1]);
      const fl = 0.7 + 0.3 * Math.sin(time * 31);
      this.glows.bill(lx, BEAM_Y, lz, 0.9 * fl, 0.9 * fl, 0, 0.9, 0.55, 0.25);
      this.stars.bill(lx, BEAM_Y, lz, 0.6 * fl, 0.6 * fl, time * 3, 1, 0.8, 0.5);
    }
    // mirrors
    const farr = this.mirrorFrames.instanceMatrix.array;
    const marr = this.mirrorFaces.instanceMatrix.array;
    for (let i = 0; i < room.mirrors.length; i++) {
      const m = room.mirrors[i];
      const x = room.worldX(m.x);
      const z = room.worldZ(m.y);
      const turn = room.t - m.turnAt;
      const hop = turn >= 0 && turn < 0.3 ? Math.sin((turn / 0.3) * Math.PI) * 0.06 : 0;
      setTRS(farr, i, x, 0.1 + hop, z, -m.angle, 0, 0, 1);
      setTRS(marr, i, x, 0.1 + hop, z, -m.angle, 0, 0, 1);
      const lit = m.lit ? 1 : 0;
      this._c.setRGB(0.8 + lit * 0.5, 0.85 + lit * 0.4, 0.95 + lit * 0.2);
      this.mirrorFaces.setColorAt(i, this._c);
      if (lit) this.glows.bill(x, BEAM_Y, z, 1.0, 1.0, 0, 0.5, 0.42, 0.28);
      if (turn >= 0 && turn < 0.4) {
        const k = 1 - turn / 0.4;
        this.stars.bill(x + Math.cos(time * 9) * 0.35, 0.5 + turn, z + Math.sin(time * 9) * 0.35, 0.4 * k, 0.4 * k, time * 4, 1, 0.85 * k, 0.5 * k);
      }
      this.shades.flat(x, 0.11, z, 1.1, 1.1, 0, 0.45, 0, 0);
    }
    this.mirrorFrames.instanceMatrix.needsUpdate = true;
    this.mirrorFaces.instanceMatrix.needsUpdate = true;
    this.mirrorFaces.instanceColor.needsUpdate = true;
    // crystal: charge drives its glow, the point light and the bloom
    const ch = room.charge || 0;
    this._crystalBloom = Math.max(0, (this._crystalBloom || 0) - dt * 0.8);
    const cp = this.crystal.position;
    const pulse = 0.85 + 0.15 * Math.sin(time * 3);
    this.crystalMat.emissiveIntensity = 0.3 + ch * 1.4 * pulse;
    this.crystalMat.emissive.copy(g).lerp(this._white, ch * 0.3);
    this.crystal.rotation.y = time * (0.2 + ch * 0.8);
    const ck = 0.15 + ch * 0.8 * pulse + this._crystalBloom * 0.9;
    this.glows.bill(cp.x, 1.05, cp.z, 1.0 + ck * 1.1, 1.4 + ck * 1.3, 0, g.r * ck * 0.32, g.g * ck * 0.32, g.b * ck * 0.32);
    this.glows.bill(cp.x, 1.1, cp.z, 0.5 + ck * 0.3, 0.8 + ck * 0.4, 0, ck * 0.5, ck * 0.5, ck * 0.5);
    this.fglows.flat(cp.x, 0.05, cp.z, 1.4 + ck * 1.4, 1.4 + ck * 1.4, 0, g.r * ck * 0.16, g.g * ck * 0.16, g.b * ck * 0.16);
    if (ch > 0.05) {
      for (let r = 0; r < 3; r++) {
        const a = time * (0.6 + r * 0.25) + r * 2.1;
        this.stars.bill(cp.x, 1.05 + r * 0.25, cp.z, (1.0 + r * 0.45) * ch, (1.0 + r * 0.45) * ch, a, g.r * ch * 0.7, g.g * ch * 0.7, g.b * ch * 0.7);
      }
      // refracted rainbow rays fanning up out of the crystal
      for (let r = 0; r < 6; r++) {
        const a = (r / 6) * TAU + time * 0.25;
        const k = ch * (0.5 + 0.5 * Math.sin(time * 2 + r));
        this._c.setHSL(r / 6, 0.9, 0.6);
        this.glows.bill(cp.x + Math.cos(a) * 0.9 * ch, 1.5 + Math.sin(a * 2) * 0.2, cp.z + Math.sin(a) * 0.5 * ch, 0.45 * k + 0.05, 0.45 * k + 0.05, 0, this._c.r * k, this._c.g * k, this._c.b * k);
      }
    }
    this.fxLight.color.copy(g);
    this.fxLight.position.set(cp.x, 1.4, cp.z);
    this.fxLight.intensity = ch * 4 + this._crystalBloom * 4;
    this.shades.flat(cp.x, 0.0, cp.z, 1.2, 1.2, 0, 0.5, 0, 0);
    this.shades.flat(this.emitter.position.x, 0.0, this.emitter.position.z, 1.1, 1.1, 0, 0.5, 0, 0);
  }

  _updateBlocks(room, time) {
    const arr = this.blocks.instanceMatrix.array;
    const at = this.blockAttr.array;
    const g = this.glowCol;
    for (let i = 0; i < room.blocks.length; i++) {
      const b = room.blocks[i];
      const x = room.worldX(b.px);
      const z = room.worldZ(b.py);
      const moving = b.moveT < 1;
      const tilt = moving ? Math.sin(b.moveT * Math.PI) * 0.06 : 0;
      const dx = b.x - b.fromX;
      const dz = b.y - b.fromY;
      setTRS(arr, i, x, 0.42, z, 0, dz * tilt, -dx * tilt, 1);
      const since = room.t - b.plateAt;
      const on = b.onPlate ? 1 : 0;
      const flash = b.onPlate && since >= 0 && since < 2 ? Math.exp(-since * 3) * 0.6 : 0;
      at[i * 4] = on ? 1 : 0.2 + 0.06 * Math.sin(time * 2 + i);
      at[i * 4 + 1] = flash;
      at[i * 4 + 2] = (i * 5 + 3) % 16;
      at[i * 4 + 3] = 2; // glyphs on every face
      this.blocks.setColorAt(i, this._c.copy(this._white).multiplyScalar(1.3));
      this.shades.flat(x, 0.08, z, 1.25, 1.25, 0, 0.6, 0, 0);
      if (on) this.glows.bill(x, 0.9, z, 1.1 + flash, 1.1 + flash, 0, g.r * (0.14 + flash * 0.6), g.g * (0.14 + flash * 0.6), g.b * (0.14 + flash * 0.6));
      if (moving) this.glows.bill(x - dx * 0.4, 0.15, z - dz * 0.4, 0.8, 0.5, 0, 0.12, 0.1, 0.08);
    }
    this.blocks.instanceMatrix.needsUpdate = true;
    this.blocks.instanceColor.needsUpdate = true;
    this.blockAttr.needsUpdate = true;
    const parr = this.plateAttr.array;
    const plarr = this.plates.instanceMatrix.array;
    for (let i = 0; i < room.plates.length; i++) {
      const q = room.plates[i];
      const x = room.worldX(q.x);
      const z = room.worldZ(q.y);
      const pr = q.pressed;
      setTRS(plarr, i, x, 0.03 - pr * 0.025, z, time * 0.1 * (1 - pr), 0, 0, 1);
      parr[i * 4] = pr ? 1 : 0.35 + 0.25 * Math.sin(time * 2.5 + i);
      parr[i * 4 + 1] = 0;
      parr[i * 4 + 2] = 12 + (i % 4);
      parr[i * 4 + 3] = 1;
      const k = pr ? 0.35 : 0.12 + 0.06 * Math.sin(time * 2.5 + i);
      this.fglows.flat(x, 0.08, z, 1.5, 1.5, 0, g.r * k, g.g * k, g.b * k);
    }
    this.plates.instanceMatrix.needsUpdate = true;
    this.plateAttr.needsUpdate = true;
    const solidCells = room.puzzle.solid || EMPTY;
    for (let i = 0; i < solidCells.length && i < 8; i++) {
      const c = solidCells[i];
      this.shades.flat(room.worldX(c % room.cols), 0.08, room.worldZ((c / room.cols) | 0), 1.2, 1.2, 0, 0.55, 0, 0);
    }
  }

  _updateStele(room, time) {
    if (!this.stele.visible) return;
    const sp = this.stele.position;
    this.shades.flat(sp.x, 0.0, sp.z + 0.1, 2.6, 1.1, 0, 0.55, 0, 0);
    if (room.type === 'lights') {
      const k = 0.85 + 0.15 * Math.sin(time * 1.6);
      this.muralMat.emissiveIntensity = 1.4 * k + (room.solved ? 0.8 : 0);
      this.glows.bill(sp.x, 1.4, sp.z + 0.4, 2.2, 2.4, 0, this.glowCol.r * 0.09, this.glowCol.g * 0.09, this.glowCol.b * 0.09);
    } else if (room.type === 'bells' && this._sockets) {
      const n = this._sockets.length;
      const wrong = room.t - room.wrongAt;
      for (let i = 0; i < n; i++) {
        const [u, v] = this._sockets[i];
        const x = sp.x + (u - 0.5) * 1.36;
        const y = sp.y + 1.38 + (0.5 - v) * 1.7;
        const z = sp.z + 0.2;
        if (i < room.progress) {
          const col = this._bellCols[room.rung[i]];
          const since = room.t - room.progressAt;
          const pop = i === room.progress - 1 && since < 0.6 ? 1 + Math.sin((since / 0.6) * Math.PI) * 0.8 : 1;
          this.glows.bill(x, y, z, 0.32 * pop, 0.32 * pop, 0, col.r * 1.2, col.g * 1.2, col.b * 1.2);
          this.glows.bill(x, y, z, 0.12, 0.12, 0, 1, 1, 1);
        } else if (wrong >= 0 && wrong < 0.7) {
          const k = (1 - wrong / 0.7) * (0.5 + 0.5 * Math.sin(wrong * 40));
          this.glows.bill(x, y, z, 0.3, 0.3, 0, 0.5 * k, 0.3 * k, 0.6 * k);
        }
      }
    }
  }

  _updatePogo(room, time, dt) {
    const po = room.pogo;
    const root = this.pogoRoot;
    let wx = room.worldX(po.px);
    let wz = room.worldZ(po.py);
    const fd = po.facing;
    wx += [1, 0, -1, 0][fd] * po.bump * 0.6;
    wz += [0, 1, 0, -1][fd] * po.bump * 0.6;
    // a little bounce per tile step; down the threshold steps when leaving
    const stepBob = po.moving ? Math.sin(po.moveT * Math.PI) * 0.07 : 0;
    const out = Math.max(0, po.py - (room.rows - 0.5));
    const wy = po.hop + stepBob - out * 0.42;
    root.position.set(wx, wy, wz);
    root.visible = (po.alpha ?? 1) > 0.02;
    // facing: toward the move; turn toward the camera when idle or celebrating
    const lookCam = (!po.moving && po.idle > 2.2) || (room.phase === 'solved' && !po.moving);
    const want = lookCam ? -Math.PI / 2 : DIR_YAW[fd];
    let d = want - this._pogoYaw;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    this._pogoYaw += d * (1 - Math.exp(-18 * dt));
    // PogoRig steers its own yaw to -0.85 (or -1.35 when looking at the camera); compensate
    root.rotation.y = this._pogoYaw + (lookCam ? 1.35 : 0.85);
    if (this.pogoRig) {
      const s = this._pogoState;
      s.time = time;
      s.vx = Math.min(3, po.speed * 0.45);
      s.vy = po.hopT >= 0 ? (po.hopT < 0.1 ? 4 : -4) : 0;
      s.onGround = po.hop < 0.03;
      const land = po.hopT >= 0.2 && po.hopT < 0.3 ? Math.sin(((po.hopT - 0.2) / 0.1) * Math.PI) : 0;
      s.squashX = 1 + land * 0.12;
      s.squashY = 1 - land * 0.14;
      s.idle = room.phase === 'play' ? po.idle : 0;
      s.celebrate = room.phase === 'solved' && room.solvedT > 0.3 && !po.moving;
      s.emote = po.emote || null;
      s.pound = room.type === 'lights' && po.hopT >= 0;
      const acted = po.acts !== this._lastActs;
      this._lastActs = po.acts;
      s.muzzle = acted ? 1 : 0;
      this.pogoRig.update(dt, s);
    }
    // soft shadow + a warm rim from the floor glow
    const sh = clamp(1 - po.hop * 1.4, 0.4, 1);
    this.shades.flat(wx, 0.08 - out * 0.42, wz, 0.85 * sh, 0.85 * sh, 0, 0.7 * sh * (po.alpha ?? 1), 0, 0);
    if (room.type === 'beam' && this._inBeam(room, po.px, po.py)) {
      this.glows.bill(wx, 0.7 + wy, wz, 1.2, 1.2, 0, 0.35, 0.28, 0.16);
    }
  }

  _inBeam(room, px, py) {
    const pts = room.beam.pts;
    for (let i = 0; i + 1 < room.beam.n; i++) {
      const ax = pts[i * 2];
      const ay = pts[i * 2 + 1];
      const bx = pts[i * 2 + 2];
      const by = pts[i * 2 + 3];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      if (l2 < 1e-6) continue;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
      if (Math.hypot(ax + dx * t - px, ay + dy * t - py) < 0.3) return true;
    }
    return false;
  }

  _updateReward(room, time, dt) {
    const show = room.rewardT >= 0 && !room.wasSolved;
    const r = this.reward;
    if (!show) {
      r.visible = false;
      this.pillarBeam.visible = false;
      return;
    }
    const age = room.t - room.rewardT;
    const rise = easeOutBack((age - 0.35) / 0.9);
    const cx = room.worldX((room.cols - 1) / 2);
    const cz = room.worldZ((room.rows - 1) / 2);
    let x = cx;
    let y = lerp(0.2, 2.25, clamp(rise, 0, 1.2));
    let z = cz;
    let s = clamp(rise, 0, 1.1);
    if (room.collectT >= 0) {
      const k = smooth01((room.t - room.collectT) / 0.45);
      const px = room.worldX(room.pogo.px);
      const pz = room.worldZ(room.pogo.py);
      x = lerp(cx, px, k);
      z = lerp(cz, pz, k);
      y = lerp(2.25, 0.8, k);
      s *= 1 - k;
    }
    r.visible = s > 0.02;
    r.position.set(x, y + Math.sin(time * 2.2) * 0.06, z);
    r.scale.setScalar(s * 1.55);
    r.rotation.y = Math.sin(time * 0.9) * 0.5;
    this.starfish.rotation.set(0, time * 1.8, Math.sin(time * 1.3) * 0.2);
    this.key.rotation.set(0, -time * 1.6, 0.35);
    // light pillar from above while it rises
    const pa = clamp(age / 0.5, 0, 1) * (room.collectT >= 0 ? 1 - clamp((room.t - room.collectT) / 0.6, 0, 1) : 1);
    this.pillarBeam.visible = pa > 0.01;
    this.pillarBeam.position.set(cx, 3.2, cz);
    this.pillarBeam.scale.set(1, 6.6, 1);
    this.pillarBeam.material.uniforms.uA.value = pa * 0.2;
    if (r.visible) {
      const k = s;
      this.glows.bill(x, y, z, 2.2 * k, 1.6 * k, 0, 0.18 * k, 0.13 * k, 0.05 * k);
      for (let i = 0; i < 4; i++) {
        const a = time * 1.5 + (i / 4) * TAU;
        this.stars.bill(x + Math.cos(a) * 0.7, y + Math.sin(a * 1.3) * 0.3, z + Math.sin(a) * 0.4, 0.45 * k, 0.45 * k, time * 3 + i, 1, 0.9, 0.55);
      }
      this.fglows.flat(cx, 0.05, cz, 3 * pa, 3 * pa, 0, 0.16 * pa, 0.12 * pa, 0.05 * pa);
    }
    // the fx light warms the room during the celebration
    if (room.type !== 'beam') {
      this.fxLight.color.set('#ffd27a');
      this.fxLight.position.set(cx, 2.2, cz);
      this.fxLight.intensity = 5 * pa;
    }
    void dt;
  }

  _updateRings(room, time) {
    const ra = this.ringAttr.array;
    for (const r of this._rings) {
      if (!r.on) continue;
      const age = time - r.t0;
      if (age < 0) continue;
      const q = age / r.life;
      if (q >= 1) {
        r.on = false;
        continue;
      }
      const e = 1 - (1 - q) * (1 - q);
      const rad = lerp(r.r0, r.r1, e);
      const a = (1 - q) * (1 - q) * (r.flat ? 0.6 : 1.0);
      const i = r.flat ? this.rings.flat(r.x, r.y, r.z, rad * 2, rad * 2, 0, r.col.r * a, r.col.g * a, r.col.b * a) : this.rings.bill(r.x, r.y, r.z, rad * 2, rad * 2, 0, r.col.r * a, r.col.g * a, r.col.b * a);
      if (i >= 0) {
        // flat rings need the full 3x3 scale for the shader's XZ path
        if (r.flat) {
          const m = this.rings.m;
          const o = i * 16;
          m[o + 5] = rad * 2;
        }
        ra[i * 2] = q;
        ra[i * 2 + 1] = r.flat;
      }
    }
    void room;
  }

  // ------------------------------------------------------------------ overlay
  _updateExitChip(room, time) {
    const show = this._onEntrance || (room.phase === 'play' && room.playT < 4 && room.playT > 0.4);
    this._exitA = clamp((this._exitA || 0) + (show ? 0.08 : -0.08), 0, 1);
    const a = this._exitA * (1 - clamp(room.fade || 0, 0, 1));
    this.exitChip.visible = a > 0.01;
    if (!this.exitChip.visible) return;
    const v = this._v.set(this._doorX, 0.05, this._doorZ + 0.9).project(this.camera);
    const x = (v.x + 1) * 0.5 * this.width;
    const y = Math.min(this.height - 22, (1 - v.y) * 0.5 * this.height + 6);
    const s = clamp(this.width / 390, 0.85, 1.4);
    this.exitChip.scale.set(96 * s, 32 * s, 1);
    this.exitChip.position.set(x, -y + Math.sin(time * 4) * 2, 0);
    this.exitChip.material.opacity = a * (this._onEntrance ? 1 : 0.7);
  }

  _font(weight, px, fam = 'Orbitron, "Arial Black", "Segoe UI", sans-serif') {
    return `${weight} ${px}px ${fam}`;
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  _wrap(ctx, text, maxW, maxLines = 2) {
    const words = String(text || '').split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  // Glass panel: puzzle rune + title + instruction, and a status widget on the right
  _drawHud(room) {
    const p = room.puzzle;
    const prog = room.type === 'bells' ? `${room.progress}:${room.rung.join('')}` : room.type === 'beam' ? (room.beam.hit ? 1 : 0) : room.type === 'blocks' ? room.platesOn : 0;
    const key = `${room.hud.rev}|${room.hud.title}|${room.hud.line}|${room.hud.status}|${prog}|${room.solved}|${this.width}x${this.height}`;
    const hudA = room.phase === 'intro' ? smooth01((room.phaseT - 0.3) / 0.5) : 1 - clamp(room.fade || 0, 0, 1);
    this.hudPanel.material.opacity = hudA;
    this.hudPanel.visible = hudA > 0.01;
    if (key === this._hudKey) return;
    this._hudKey = key;
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const W = this.width;
    const wide = W / this.height > 1.1;
    const s = clamp(Math.min(W, this.height * 1.1) / 390, 0.85, 1.3);
    const pw = wide ? Math.min(W * 0.44, 420 * s) : Math.min(W - 16, 560 * s);
    const ph = 66 * s;
    const c = this._hudCanvas;
    c.width = Math.round(pw * pr);
    c.height = Math.round(ph * pr);
    const ctx = c.getContext('2d');
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    // panel
    const bg = ctx.createLinearGradient(0, 0, 0, ph);
    bg.addColorStop(0, 'rgba(34,24,18,0.82)');
    bg.addColorStop(1, 'rgba(14,9,8,0.82)');
    ctx.fillStyle = bg;
    this._roundRect(ctx, 1, 1, pw - 2, ph - 2, 16 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,206,140,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const glow = '#' + this.glowCol.getHexString();
    // rune medallion
    const mx = 30 * s;
    const my = ph / 2;
    const mg = ctx.createRadialGradient(mx, my, 2, mx, my, 22 * s);
    mg.addColorStop(0, glow);
    mg.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 22 * s, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 16 * s, 0, TAU);
    ctx.stroke();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff6e6';
    ctx.lineWidth = 2.4 * s;
    const typeIdx = ['lights', 'bells', 'beam', 'blocks'].indexOf(room.type);
    drawRune(ctx, mulberry32(1000 + (typeIdx * 4 + 1) * 77), mx, my, 26 * s);
    ctx.restore();
    // right widget
    const rw = this._drawHudWidget(ctx, room, pw, ph, s, glow);
    // title + line
    const tx = 60 * s;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = this._font(800, 14 * s);
    ctx.fillStyle = '#ffe9c8';
    ctx.fillText(room.hud.title || p.title, tx, 24 * s);
    ctx.font = this._font(600, 13 * s, 'Rajdhani, "Segoe UI", sans-serif');
    ctx.fillStyle = 'rgba(240,222,196,0.86)';
    const maxW = pw - tx - rw - 12 * s;
    let lines = this._wrap(ctx, room.hud.line, maxW, 3);
    let lh = 15;
    if (lines.length > 2) {
      ctx.font = this._font(600, 11.5 * s, 'Rajdhani, "Segoe UI", sans-serif');
      lines = this._wrap(ctx, room.hud.line, maxW, 3);
      lh = 12;
    }
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tx, (lines.length > 2 ? 38 : 42) * s + i * lh * s);
    this._hudTex.needsUpdate = true;
    this.hudPanel.scale.set(pw, ph, 1);
    this.hudPanel.position.set(wide ? 8 + pw / 2 : W / 2, -(8 + ph / 2), 0);
  }

  _drawHudWidget(ctx, room, pw, ph, s, glow) {
    const p = room.puzzle;
    const right = pw - 12 * s;
    const cy = ph / 2;
    // key icon: dim until solved
    const kx = right - 12 * s;
    ctx.save();
    ctx.globalAlpha = room.solved ? 1 : 0.35;
    ctx.strokeStyle = room.solved ? '#ffd25e' : '#d9c3a2';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(kx, cy - 8 * s, 6 * s, 0, TAU);
    ctx.moveTo(kx, cy - 2 * s);
    ctx.lineTo(kx, cy + 14 * s);
    ctx.moveTo(kx, cy + 9 * s);
    ctx.lineTo(kx + 6 * s, cy + 9 * s);
    ctx.moveTo(kx, cy + 13 * s);
    ctx.lineTo(kx + 5 * s, cy + 13 * s);
    ctx.stroke();
    ctx.restore();
    let used = 34 * s;
    const x1 = kx - 22 * s;
    if (room.type === 'lights' && p.showTarget) {
      const n = p.n;
      const cell = 10 * s;
      const w = n * cell;
      const x0 = x1 - w;
      const y0 = cy - w / 2;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = p.target[y * n + x];
          ctx.fillStyle = on ? glow : 'rgba(255,240,220,0.14)';
          ctx.beginPath();
          ctx.arc(x0 + (x + 0.5) * cell, y0 + (y + 0.5) * cell, cell * (on ? 0.36 : 0.22), 0, TAU);
          ctx.fill();
        }
      }
      used += w + 12 * s;
    } else if (room.type === 'bells') {
      const n = p.order.length;
      const sp = 13 * s;
      const x0 = x1 - n * sp;
      for (let i = 0; i < n; i++) {
        const cx = x0 + (i + 0.5) * sp;
        if (i < room.progress) {
          ctx.fillStyle = BELL_COLORS[room.rung[i]];
          ctx.beginPath();
          ctx.arc(cx, cy, 5 * s, 0, TAU);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,240,220,0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5 * s, 0, TAU);
          ctx.stroke();
        }
      }
      used += n * sp + 12 * s;
    } else if (room.type === 'blocks') {
      ctx.font = this._font(800, 15 * s);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = room.platesOn === room.plates.length ? glow : '#ffe9c8';
      const txt = `${room.platesOn}/${room.plates.length}`;
      ctx.fillText(txt, x1, cy);
      used += ctx.measureText(txt).width + 14 * s;
    } else if (room.type === 'beam') {
      const on = room.beam.hit;
      ctx.fillStyle = on ? glow : 'rgba(255,240,220,0.3)';
      ctx.beginPath();
      ctx.moveTo(x1 - 8 * s, cy - 13 * s);
      ctx.lineTo(x1, cy);
      ctx.lineTo(x1 - 8 * s, cy + 13 * s);
      ctx.lineTo(x1 - 16 * s, cy);
      ctx.closePath();
      ctx.fill();
      used += 30 * s;
    }
    return used;
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
    ctx.strokeStyle = 'rgba(16,8,4,0.9)';
    ctx.strokeText(text, c.width / 2, c.height / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, c.width / 2, c.height / 2);
    ctx.shadowBlur = 0;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    e = { tex, aspect: c.width / c.height, used: this._popFrame, text, color };
    this._popCache.set(key, e);
    if (this._popCache.size > 40) {
      for (const [k, v] of this._popCache) {
        if (v.used < this._popFrame - 2) {
          v.tex.dispose();
          v.dead = true;
          this._popCache.delete(k);
          if (this._popCache.size <= 32) break;
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

  _updatePopups(popups, room) {
    const n = popups ? Math.min(popups.length, MAX_POP) : 0;
    const s = room.s || 1;
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
      let e = pop.__puzTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#ffffff')) {
        e = this._popupTex(pop.text, pop.color || '#ffffff');
        pop.__puzTex = e;
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
        for (const k of ['map', 'emissiveMap', 'bumpMap']) {
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
    this.U.uRunes.value.dispose();
    this.starTex.dispose();
    this.ringTex.dispose();
    this._envRT?.dispose();
    if (this._ownSoftDot) this.softDot.dispose();
  }
}
