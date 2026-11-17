// TOWER TOPPLER '26 — ANCIENT FLOODED NEBULUS SANCTUM 3D RENDERER (src/puzzleRenderer.js)
//
// Shares `GameRenderer.webgl` with strict WebGL state save/restore (`setRenderTarget(null)`,
// `autoClear`, `toneMapping`, `toneMappingExposure`).
//
// Next-Gen 2026 Upgrades:
// 1. Closer heroic 3/4 isometric camera + ~2.2x larger 33-bone `PogoRig` Explorer Pogo V2 (`POGO_SCALE = 1.32`,
//    `setSkin`, `setEra`, exact `this._pogoYaw - 0.38` yaw alignment, and Next-Gen `poseState` contract).
// 2. Ancient Flooded Nebulus Sanctum architecture: stepped carved-slate puzzle island surrounded by dark
//    rippling subterranean GLSL water moat, glowing floor energy conduits (`progressRatio`), and a massive
//    3D Carved Sanctum Vault Gate that physically grinds upward (`gateOpen`) with golden light spill.
// 3. Loads Blender 5.3.0 `assets/models/puzzle_props.glb` (`temple_bell`, `prism_mirror`, `push_monolith`,
//    `sanctum_brazier`) with sculpted Frame-0 procedural fallbacks, 3-layer volumetric prism beams +
//    refraction sparks, Par-Move HUD telemetry, and zero emojis.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PogoRig } from './pogo.js';
import { BELL_COLORS } from './puzzleRoom.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const INTRO_T = 1.05;
const FLIP_T = 0.38;
const BEAM_Y = 0.76;
const POGO_SCALE = 1.32;
const WATER_Y = -0.32;
const HUD_TOP_OFFSET = 114;

const MAX_TILES = 64;
const MAX_GLOW = 260;
const MAX_STAR = 84;
const MAX_FGLOW = 128;
const MAX_SHADE = 40;
const MAX_RING = 32;
const MAX_BEAM = 28;
const MAX_DUST = 260;
const MAX_PART = 600;
const MAX_POP = 14;
const MAX_PILLAR = 12;
const MAX_TORCH = 28;
const MAX_EMBERS = 72;
const MAX_MOAT_MIST = 12;

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

// Weathered dark indigo-slate chamber masonry tints anchored around `#2b2d4a`
// (multiplied with ~0.68 average stone texture luminance -> rich `#2b2d4a`–`#3a3e66` albedo)
const WORLD_STONE = [
  '#464a78',
  '#3f4672',
  '#4c4a73',
  '#425178',
  '#4d4678',
  '#3e4f73',
  '#444874',
  '#3c406b',
];
const WORLD_TORCH = [
  '#ffaa33',
  '#ffb03b',
  '#ffa52b',
  '#ffad38',
  '#ffa830',
  '#ffb442',
  '#ffaa33',
  '#ff9f29',
];

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
const ADD = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
};

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
    },
    { srgb: false }
  );
}

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
    const c = light ? '210,224,255' : '6,8,20';
    g.addColorStop(0, `rgba(${c},${alpha})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function makeSlabTex() {
  const rng = mulberry32(77);
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#8b92ab';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rng, 26, 20, 70, 0.14, false);
    blotches(ctx, w, h, rng, 18, 10, 40, 0.1, true);
    const e = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(8,10,24,0.38)');
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(12,15,32,0.28)';
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
    ctx.strokeStyle = 'rgba(10,12,26,0.42)';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.strokeStyle = 'rgba(195,214,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(25, 25, w - 50, h - 50);
    speckle(ctx, w, h, rng, 24);
  });
}

function makeFlagTex() {
  const rng = mulberry32(4242);
  return canvasTex(
    512,
    512,
    (ctx, w, h) => {
      // Deep damp indigo-slate mortar bed
      ctx.fillStyle = '#14172b';
      ctx.fillRect(0, 0, w, h);
      let y = 0;
      while (y < h) {
        const rh = 60 + Math.floor(rng() * 50);
        let x = -Math.floor(rng() * 60);
        while (x < w) {
          const rw = 70 + Math.floor(rng() * 90);
          const tone = 98 + Math.floor(rng() * 42);
          ctx.fillStyle = `rgb(${tone - 8},${tone - 4},${tone + 14})`;
          const g = 3 + rng() * 2;
          ctx.beginPath();
          ctx.moveTo(x + g + rng() * 4, y + g + rng() * 3);
          ctx.lineTo(x + rw - g - rng() * 4, y + g + rng() * 3);
          ctx.lineTo(x + rw - g - rng() * 4, y + rh - g - rng() * 3);
          ctx.lineTo(x + g + rng() * 4, y + rh - g - rng() * 3);
          ctx.closePath();
          ctx.fill();
          if (x + rw > w) {
            ctx.save();
            ctx.translate(-w, 0);
            ctx.fill();
            ctx.restore();
          }
          // Subtle mossy mortar tufts in damp stone seams
          if (rng() > 0.68) {
            ctx.fillStyle = 'rgba(54, 94, 48, 0.58)';
            ctx.beginPath();
            ctx.arc(x + rw * 0.4, y + g, 3.2 + rng() * 2.5, 0, TAU);
            ctx.fill();
          }
          x += rw;
        }
        y += rh;
      }
      blotches(ctx, w, h, rng, 60, 20, 90, 0.16, false);
      blotches(ctx, w, h, rng, 30, 10, 50, 0.08, true);
      speckle(ctx, w, h, rng, 28);
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
      // Deep recessed obsidian-indigo mortar channels (`#060814`) for dramatic 3D Sobel relief
      ctx.fillStyle = '#060814';
      ctx.fillRect(0, 0, w, h);
      const rows = 6;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -Math.floor(rng() * 80);
        while (x < w) {
          const bw = 90 + Math.floor(rng() * 90);
          const tone = 114 + Math.floor(rng() * 48);
          const y0 = r * rh;
          const grad = ctx.createLinearGradient(0, y0, 0, y0 + rh);
          grad.addColorStop(0, `rgb(${tone + 14},${tone + 18},${tone + 34})`);
          grad.addColorStop(0.5, `rgb(${tone},${tone + 4},${tone + 20})`);
          grad.addColorStop(1, `rgb(${tone - 32},${tone - 30},${tone - 12})`);
          const draw = (ox) => {
            // Outer beveled chamfer step
            ctx.fillStyle = `rgb(${tone - 42},${tone - 38},${tone - 22})`;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x + 4 + ox, y0 + 4, bw - 8, rh - 8, 5);
            else ctx.rect(x + 4 + ox, y0 + 4, bw - 8, rh - 8);
            ctx.fill();
            // Raised chiseled ashlar face
            ctx.fillStyle = grad;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x + 8 + ox, y0 + 8, Math.max(8, bw - 16), Math.max(8, rh - 16), 4);
            else ctx.rect(x + 8 + ox, y0 + 8, Math.max(8, bw - 16), Math.max(8, rh - 16));
            ctx.fill();
            // Chiseled top specular bevel
            ctx.fillStyle = 'rgba(210, 228, 255, 0.24)';
            ctx.fillRect(x + 9 + ox, y0 + 8, Math.max(4, bw - 18), 3);
          };
          draw(0);
          if (x + bw > w) draw(-w);
          if (x < 0) draw(w);

          // Organic mossy stone seams tucked along ashlar mortar crevices
          if (rng() > 0.62) {
            ctx.fillStyle = 'rgba(56, 98, 50, 0.68)';
            for (let m = 0; m < 3; m++) {
              const mx = ((x + bw * (0.2 + m * 0.24) + w) % w);
              ctx.beginPath();
              ctx.arc(mx, y0 + 3.0 + (m % 2), 2.8 + rng() * 2.2, 0, TAU);
              ctx.fill();
            }
          }
          x += bw;
        }
      }
      blotches(ctx, w, h, rng, 70, 14, 70, 0.20, false);
      blotches(ctx, w, h, rng, 26, 8, 30, 0.10, true);
      ctx.strokeStyle = 'rgba(4,6,14,0.65)';
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 20; i++) {
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

// Generates a crisp 3x3 Sobel tangent-space normalMap directly from a procedural stone CanvasTexture
function makeSobelNormalTex(srcTex, strength = 3.6, repeat = true) {
  const srcCanvas = srcTex?.image;
  const w = srcCanvas?.width || 128;
  const h = srcCanvas?.height || 128;
  let lum = null;
  try {
    const sctx = srcCanvas.getContext('2d');
    const sData = sctx.getImageData(0, 0, w, h).data;
    lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      lum[i] = (sData[i * 4] * 0.299 + sData[i * 4 + 1] * 0.587 + sData[i * 4 + 2] * 0.114) / 255;
    }
  } catch (_) {
    lum = new Float32Array(w * h).fill(0.5);
  }
  return canvasTex(
    w,
    h,
    (ctx) => {
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const H = (x, y) => lum[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
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
    { srgb: false, repeat }
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
    g.addColorStop(0, '#eef7ff');
    g.addColorStop(1, '#9ec9ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, h - 4);
    ctx.lineTo(8, 30);
    ctx.quadraticCurveTo(w / 2, -6, w - 8, 30);
    ctx.lineTo(w - 8, h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(14,18,34,0.88)';
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
    for (const k of Object.keys(ng.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(k)) ng.deleteAttribute(k);
    }
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    }
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

function buildColumn(height) {
  const parts = [];
  parts.push(paint(place(new THREE.CylinderGeometry(0.36, 0.42, 0.28, 12), 0, 0.14, 0), 0.78, 0.8, 0.88));
  parts.push(paint(place(new THREE.CylinderGeometry(0.31, 0.36, 0.12, 12), 0, 0.34, 0), 0.86, 0.88, 0.94));
  parts.push(
    paint(place(new THREE.CylinderGeometry(0.25, 0.28, height - 0.8, 12, 4), 0, 0.4 + (height - 0.8) / 2, 0), 1, 1, 1)
  );
  parts.push(
    paint(place(new THREE.CylinderGeometry(0.36, 0.26, 0.22, 12), 0, height - 0.29, 0), 0.86, 0.88, 0.94)
  );
  parts.push(paint(place(new THREE.BoxGeometry(0.8, 0.18, 0.8), 0, height - 0.09, 0), 0.78, 0.8, 0.88));
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
  return mergeStd([paint(g, 1, 1, 1), paint(base, 0.82, 0.84, 0.9)]);
}

function buildSconce() {
  const iron = [0.15, 0.16, 0.2];
  const brass = [0.58, 0.42, 0.2];
  const parts = [];
  parts.push(paint(place(new THREE.BoxGeometry(0.08, 0.42, 0.08), 0, -0.1, -0.2), ...iron));
  parts.push(paint(place(new THREE.BoxGeometry(0.06, 0.06, 0.34), 0, -0.22, -0.04), ...iron));
  parts.push(paint(place(new THREE.CylinderGeometry(0.15, 0.07, 0.2, 10, 1, true), 0, 0, 0.1), ...iron));
  parts.push(paint(place(new THREE.TorusGeometry(0.15, 0.025, 6, 14), 0, 0.1, 0.1, Math.PI / 2), ...brass));
  parts.push(paint(place(new THREE.SphereGeometry(0.09, 8, 6), 0, 0.06, 0.1), 0.42, 0.18, 0.05));
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
  const wood = [0.3, 0.22, 0.16];
  const iron = [0.18, 0.19, 0.23];
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
  return mergeStd([paint(a, 0.78, 0.8, 0.88), paint(b, 0.92, 0.94, 0.98)]);
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
  parts.push(paint(place(new THREE.CylinderGeometry(0.05, 0.07, 0.32, 8), 0, 0.16, 0), 0.26, 0.28, 0.34));
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
  const g = mergeGeometries(
    parts.map((p) => (p.index ? p.toNonIndexed() : p)),
    false
  );
  g.computeVertexNormals();
  return g;
}

function buildEmitter() {
  const bronze = [0.75, 0.55, 0.28];
  const parts = [];
  parts.push(paint(place(new THREE.CylinderGeometry(0.34, 0.4, 0.5, 12), 0, 0.25, 0), 0.72, 0.74, 0.82));
  parts.push(paint(place(new THREE.BoxGeometry(0.16, 0.5, 0.16), 0, 0.6, -0.1), 0.58, 0.6, 0.68));
  parts.push(paint(place(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), 0, BEAM_Y, -0.05, Math.PI / 2), ...bronze));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    parts.push(
      paint(
        place(
          new THREE.ConeGeometry(0.06, 0.18, 4),
          Math.cos(a) * 0.42,
          BEAM_Y + Math.sin(a) * 0.42,
          -0.05,
          0,
          0,
          a - Math.PI / 2
        ),
        ...bronze
      )
    );
  }
  return mergeStd(parts);
}

function buildStele() {
  const parts = [];
  parts.push(paint(place(new THREE.BoxGeometry(1.9, 0.3, 0.6), 0, 0.15, 0), 0.72, 0.74, 0.82));
  parts.push(paint(place(new THREE.BoxGeometry(1.6, 2.1, 0.32), 0, 1.35, 0), 1, 1, 1));
  parts.push(paint(place(new THREE.BoxGeometry(1.8, 0.2, 0.42), 0, 2.48, 0), 0.82, 0.84, 0.92));
  parts.push(
    paint(place(new THREE.CylinderGeometry(0.0, 0.5, 0.3, 4, 1), 0, 2.73, 0, 0, Math.PI / 4), 0.82, 0.84, 0.92)
  );
  return mergeStd(parts);
}

// Next-Gen Explorer Star Core + Golden Gear celebration reward meshes
function buildStarCoreMesh() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2;
    const r = i % 2 === 0 ? 0.36 : 0.16;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 3,
    curveSegments: 4,
  });
  g.translate(0, 0, -0.04);
  g.computeVertexNormals();
  return g;
}

function buildGoldenGearMesh() {
  const parts = [];
  parts.push(place(new THREE.TorusGeometry(0.22, 0.065, 10, 24), 0, 0, 0));
  parts.push(place(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), 0, 0, 0, Math.PI / 2, 0, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    parts.push(
      place(
        new THREE.BoxGeometry(0.08, 0.11, 0.08),
        Math.cos(a) * 0.28,
        Math.sin(a) * 0.28,
        0,
        0,
        0,
        a - Math.PI / 2
      )
    );
  }
  return mergeStd(parts);
}

function buildProcBrazier() {
  const iron = [0.14, 0.16, 0.22];
  const bronze = [0.68, 0.48, 0.22];
  const stone = [0.58, 0.62, 0.74];
  const parts = [];
  parts.push(paint(place(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 8), 0, 0.05, 0), ...stone));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    parts.push(
      paint(
        place(
          new THREE.BoxGeometry(0.055, 0.78, 0.055),
          Math.cos(a) * 0.16,
          0.44,
          Math.sin(a) * 0.16,
          Math.sin(a) * 0.14,
          0,
          -Math.cos(a) * 0.14
        ),
        ...iron
      )
    );
  }
  parts.push(paint(place(new THREE.CylinderGeometry(0.28, 0.14, 0.2, 12), 0, 0.78, 0), ...iron));
  parts.push(paint(place(new THREE.TorusGeometry(0.28, 0.028, 6, 16), 0, 0.87, 0, Math.PI / 2), ...bronze));
  parts.push(paint(place(new THREE.SphereGeometry(0.16, 10, 6), 0, 0.86, 0, 0, 0, 0, 1.2, 0.55, 1.2), 0.88, 0.36, 0.08));
  return mergeStd(parts);
}

function buildVaultFrameGeo() {
  const stone = [0.82, 0.85, 0.94];
  const dark = [0.54, 0.58, 0.7];
  const bronze = [0.78, 0.56, 0.26];
  const parts = [];
  for (const sx of [-1, 1]) {
    // Stepped monumental jamb pillars
    parts.push(paint(place(new THREE.BoxGeometry(0.68, 4.1, 0.72), sx * 1.48, 1.65, 0), ...stone));
    parts.push(paint(place(new THREE.BoxGeometry(0.82, 0.42, 0.86), sx * 1.48, -0.18, 0), ...dark));
    parts.push(paint(place(new THREE.BoxGeometry(0.78, 0.26, 0.82), sx * 1.48, 3.56, 0), ...dark));
    // Vertical bronze guide tracks for the rising gate slab
    parts.push(paint(place(new THREE.BoxGeometry(0.09, 3.6, 0.16), sx * 1.12, 1.55, 0.24), ...bronze));
  }
  // Monumental carved architrave lintel & pediment
  parts.push(paint(place(new THREE.BoxGeometry(3.96, 0.54, 0.88), 0, 3.92, 0), ...stone));
  parts.push(paint(place(new THREE.BoxGeometry(4.24, 0.22, 0.98), 0, 4.28, 0), ...dark));
  parts.push(paint(place(new THREE.CylinderGeometry(0.0, 1.45, 0.56, 4, 1), 0, 4.66, 0, 0, Math.PI / 4), ...stone));
  // Bronze keystone seal frame
  parts.push(paint(place(new THREE.TorusGeometry(0.32, 0.055, 8, 20), 0, 3.94, 0.45), ...bronze));
  return mergeStd(parts);
}

function buildVaultDoorGeo() {
  const stone = [0.76, 0.8, 0.92];
  const coffer = [0.48, 0.52, 0.66];
  const bronze = [0.84, 0.62, 0.28];
  const parts = [];
  // Heavy 2.22m x 3.45m carved basalt vault slab
  parts.push(paint(place(new THREE.BoxGeometry(2.22, 3.46, 0.34), 0, 1.73, 0), ...stone));
  // Center seam & horizontal bronze locking bars
  parts.push(paint(place(new THREE.BoxGeometry(0.09, 3.44, 0.4), 0, 1.73, 0), ...bronze));
  for (const y of [0.52, 1.72, 2.92]) {
    parts.push(paint(place(new THREE.BoxGeometry(2.18, 0.11, 0.39), 0, y, 0), ...bronze));
  }
  // 4 recessed stone coffers
  for (const sx of [-0.56, 0.56]) {
    for (const y of [1.12, 2.32]) {
      parts.push(paint(place(new THREE.BoxGeometry(0.76, 0.88, 0.08), sx, y, 0.16), ...coffer));
    }
  }
  // Central interlocking sanctum rosette seal
  parts.push(paint(place(new THREE.TorusGeometry(0.42, 0.055, 8, 24), 0, 1.72, 0.2), ...bronze));
  parts.push(paint(place(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 12), 0, 1.72, 0.19, Math.PI / 2, 0, 0), ...bronze));
  return mergeStd(parts);
}

// Vaulted Cathedral Stone Ribs, Triforium Cornice & Recessed Clerestory Arcade (`y_screen = 0..32%`)
function buildCathedralUpperStoneGeo(R, gap, colAngles, clerestoryAngles) {
  const stone = [0.78, 0.82, 0.94];
  const dark = [0.46, 0.50, 0.64];
  const hi = [0.90, 0.93, 1.0];
  const parts = [];
  const arcSpan = TAU - gap * 2;
  const zAxis = new THREE.Vector3(0, 0, 1);

  // Exact endpoint-to-endpoint 3D stone rib/arch beam helper (100% seamless tangent joints, zero twisted blocks!)
  const addBeam = (p0, p1, w, h, rgb, overlap = 1.08) => {
    const dir = p1.clone().sub(p0);
    const len = dir.length() * overlap;
    if (len < 1e-3) return;
    const mid = p0.clone().addScaledVector(dir, 0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(zAxis, dir.normalize());
    const eul = new THREE.Euler().setFromQuaternion(q);
    parts.push(paint(place(new THREE.BoxGeometry(w, h, len), mid.x, mid.y, mid.z, eul.x, eul.y, eul.z), ...rgb));
  };

  // 1. Open-Ended Romanesque Triforium Sill Cornice (`y = 2.74`, strictly openEnded = true!) + Carved Corbels
  const corniceFace = new THREE.CylinderGeometry(R + 0.14, R + 0.22, 0.18, 72, 1, true, gap, arcSpan);
  corniceFace.translate(0, 2.76, 0);
  parts.push(paint(corniceFace, ...stone));
  const nCorbels = 32;
  for (let i = 0; i < nCorbels; i++) {
    const a0 = gap + (arcSpan * i) / nCorbels;
    const a1 = gap + (arcSpan * (i + 1)) / nCorbels;
    const amid = (a0 + a1) * 0.5;
    const segW = (a1 - a0) * (R + 0.24) * 1.04;
    // Top sill ledge strip hugging ONLY the outer wall perimeter (100% open center!)
    parts.push(
      paint(
        place(new THREE.BoxGeometry(segW, 0.10, 0.30), Math.sin(amid) * (R + 0.26), 2.84, Math.cos(amid) * (R + 0.26), 0, amid, 0),
        ...stone
      )
    );
    parts.push(
      paint(
        place(new THREE.BoxGeometry(0.13, 0.20, 0.24), Math.sin(amid) * (R + 0.22), 2.61, Math.cos(amid) * (R + 0.22), 0, amid, 0),
        ...dark
      )
    );
  }

  // 2. Upper Clerestory Ashlar Piers, Deep Window Reveals (`R + 0.28 -> R + 1.68`) & Pointed Archivolts (`y = 2.84..5.55`)
  const winHalfA = 0.155;
  const nWallSegs = 64;
  for (let i = 0; i < nWallSegs; i++) {
    const a0 = gap + (arcSpan * i) / nWallSegs;
    const a1 = gap + (arcSpan * (i + 1)) / nWallSegs;
    const amid = (a0 + a1) * 0.5;
    let inWin = false;
    for (let w = 0; w < clerestoryAngles.length; w++) {
      if (Math.abs(amid - clerestoryAngles[w]) < winHalfA) {
        inWin = true;
        break;
      }
    }
    const segW = (a1 - a0) * (R + 0.34) * 1.06;
    const px = Math.sin(amid) * (R + 0.34);
    const pz = Math.cos(amid) * (R + 0.34);
    if (!inWin) {
      parts.push(paint(place(new THREE.BoxGeometry(segW, 2.85, 0.24), px, 4.26, pz, 0, amid, 0), ...dark));
    } else {
      // High spandrel masonry above the pointed clerestory arch (`y = 4.86..5.68`)
      parts.push(paint(place(new THREE.BoxGeometry(segW, 0.88, 0.26), px, 5.26, pz, 0, amid, 0), ...dark));
    }
  }

  // Sculpted 3D Clerestory Jamb Reveals, Sills, Central Mullions & Smooth Pointed Stone Archivolts
  for (let w = 0; w < clerestoryAngles.length; w++) {
    const wa = clerestoryAngles[w];
    const ca = Math.cos(wa);
    const sa = Math.sin(wa);
    const openW = winHalfA * 2 * (R + 0.35);
    const sx = sa * (R + 0.92);
    const sz = ca * (R + 0.92);
    parts.push(paint(place(new THREE.BoxGeometry(openW + 0.36, 0.14, 1.42), sx, 2.86, sz, 0, wa, 0), ...stone));

    for (const side of [-1, 1]) {
      const ja = wa + side * winHalfA;
      parts.push(
        paint(place(new THREE.BoxGeometry(0.22, 1.92, 1.40), Math.sin(ja) * (R + 0.92), 3.80, Math.cos(ja) * (R + 0.92), 0, ja, 0), ...stone)
      );
    }
    // Slender central stone Gothic mullion
    parts.push(
      paint(place(new THREE.CylinderGeometry(0.052, 0.062, 1.88, 8), sa * (R + 0.46), 3.80, ca * (R + 0.46), 0, wa, 0), ...hi)
    );

    // Smooth continuous pointed Gothic/Romanesque stone archivolt (`8` tangent-aligned arch segments)
    const archR = openW * 0.52;
    const archPt = (t) => {
      const lx = Math.cos(t) * archR;
      const ly = 4.38 + Math.sin(t) * 0.46 + (1 - Math.abs(Math.cos(t))) * 0.14;
      return new THREE.Vector3(sa * (R + 0.26) + ca * lx, ly, ca * (R + 0.26) - sa * lx);
    };
    for (let k = 0; k < 8; k++) {
      const p0 = archPt((k / 8) * Math.PI);
      const p1 = archPt(((k + 1) / 8) * Math.PI);
      addBeam(p0, p1, 0.24, 0.22, k === 3 || k === 4 ? hi : stone, 1.12);
    }
  }

  // 3. Clean Vertical Carved Stone Clerestory Pilasters & Upper Molded Cornice Ring (zero overhanging ceiling planks!)
  const upperCornice = new THREE.CylinderGeometry(R + 0.14, R + 0.24, 0.18, 72, 1, true, gap, arcSpan);
  upperCornice.translate(0, 5.02, 0);
  parts.push(paint(upperCornice, ...stone));
  for (let i = 0; i < colAngles.length; i++) {
    const a = colAngles[i];
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    // Molded Romanesque abacus capital at triforium sill + vertical fluted stone pilaster rising cleanly up the wall
    parts.push(paint(place(new THREE.BoxGeometry(0.48, 0.20, 0.44), sa * (R + 0.08), 3.36, ca * (R + 0.08), 0, a, 0), ...hi));
    parts.push(paint(place(new THREE.BoxGeometry(0.32, 1.72, 0.30), sa * (R + 0.18), 4.24, ca * (R + 0.18), 0, a, 0), ...stone));
    parts.push(paint(place(new THREE.BoxGeometry(0.46, 0.18, 0.38), sa * (R + 0.16), 5.06, ca * (R + 0.16), 0, a, 0), ...hi));
  }

  return mergeStd(parts);
}

// Wrought-Iron Barred Clerestory Window Grilles + Heavy Hanging Link-by-Link Sanctum Chains (`ironMat` — 1 draw call!)
function buildCathedralIronworkGeo(R, vaultZ, clerestoryAngles) {
  const iron = [0.11, 0.13, 0.18];
  const rimIron = [0.22, 0.25, 0.34];
  const bronze = [0.58, 0.42, 0.20];
  const parts = [];
  const winHalfA = 0.155;

  // 1. Wrought-Iron Barred Window Grilles inside all 4 Recessed Moonlit Clerestory Arches
  for (let w = 0; w < clerestoryAngles.length; w++) {
    const wa = clerestoryAngles[w];
    const gr = R + 0.68;
    const openW = winHalfA * 2 * gr;
    const ca = Math.cos(wa);
    const sa = Math.sin(wa);
    for (let b = -2; b <= 2; b++) {
      if (b === 0) continue;
      const lx = (b / 2.6) * (openW * 0.5);
      const ratio = lx / (openW * 0.54);
      const archLift = Math.sqrt(Math.max(0, 1 - ratio * ratio)) * 0.38;
      const bh = 1.62 + archLift;
      const bx = sa * gr + ca * lx;
      const bz = ca * gr - sa * lx;
      parts.push(paint(place(new THREE.CylinderGeometry(0.022, 0.022, bh, 5), bx, 2.90 + bh * 0.5, bz), ...iron));
    }
    for (const ty of [3.32, 3.84, 4.34]) {
      parts.push(paint(place(new THREE.BoxGeometry(openW * 0.96, 0.036, 0.036), sa * gr, ty, ca * gr, 0, wa, 0), ...iron));
    }
    parts.push(paint(place(new THREE.TorusGeometry(0.24, 0.024, 5, 12), sa * gr, 4.52, ca * gr, 0, wa, 0), ...rimIron));
  }

  // Low-poly crisp 3D alternating-link wrought-iron chains (`TorusGeometry(..., 4, 8)` saves -14k tris!)
  const addChain = (x, z, yBot, yTop, withWeight = true, scale = 1.0) => {
    const step = 0.155 * scale;
    const nLinks = Math.max(2, Math.floor((yTop - yBot) / step));
    for (let k = 0; k < nLinks; k++) {
      const ly = yBot + (k + 0.5) * step;
      const ry = k % 2 === 0 ? 0.35 : 0.35 + Math.PI * 0.5;
      const link = new THREE.TorusGeometry(0.070 * scale, 0.022 * scale, 4, 8);
      link.scale(0.72, 1.32, 0.72);
      parts.push(paint(place(link, x, ly, z, 0, ry, 0), ...(k % 3 === 0 ? rimIron : iron)));
    }
    if (withWeight) {
      parts.push(paint(place(new THREE.TorusGeometry(0.11 * scale, 0.026 * scale, 5, 10), x, yBot - 0.06 * scale, z, 0, 0.3, 0), ...bronze));
      parts.push(paint(place(new THREE.CylinderGeometry(0.12 * scale, 0.16 * scale, 0.28 * scale, 8), x, yBot - 0.24 * scale, z), ...iron));
      parts.push(paint(place(new THREE.CylinderGeometry(0.16 * scale, 0.05 * scale, 0.14 * scale, 8), x, yBot - 0.44 * scale, z), ...rimIron));
    }
  };

  // 2. Twin Taut Clockwork Hoist Chains connected directly to the North Vault Gate Gears
  addChain(-1.38, vaultZ + 0.42, 2.95, 5.85, false, 0.92);
  addChain(1.38, vaultZ + 0.42, 2.95, 5.85, false, 0.92);

  // 3. 4 Heavy Atmospheric Parallax Cavern Chains & Plumb Counterweights framing `y = 0..32%`
  addChain(-2.78, -2.60, 2.82, 5.95, true, 1.08);
  addChain(2.78, -2.60, 2.98, 5.95, true, 1.08);
  addChain(-3.55, -0.80, 2.62, 5.85, true, 1.15);
  addChain(3.55, -0.80, 2.72, 5.85, true, 1.15);

  return mergeStd(parts);
}

// ---------------------------------------------------------------------------------- materials
function runeMaterial(U, params) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRunes = U.uRunes;
    sh.uniforms.uGlow = U.uGlow;
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec4 aTile;\nvarying vec4 vTile;\nvarying vec3 vON;\nvarying vec2 vTUv;\nvarying vec3 vOP;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTile = aTile;\nvON = normal;\nvTUv = uv;\nvOP = position;'
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uRunes;\nuniform vec3 uGlow;\nuniform float uTime;\nvarying vec4 vTile;\nvarying vec3 vON;\nvarying vec2 vTUv;\nvarying vec3 vOP;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rTop = smoothstep(0.55, 0.85, abs(vON.y));
        vec2 tuv = vTUv;
        float rStr = min(vTile.w, 1.0);
        if (vTile.w > 1.5) {
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
          totalEmissiveRadiance += uGlow * (runeG * (0.06 + vTile.x * 2.3 * shimmer + vTile.y * 2.8) + rim * (vTile.x * 0.85 + vTile.y * 1.6) + rTop * rStr * (vTile.x * 0.1 + vTile.y * 0.3));
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
        void main(){ float a = texture2D(uMap, vUv).a * vCol.r; gl_FragColor = vec4(0.015, 0.02, 0.04, a); ${GLSL_OUT} }`,
  });
}

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

function setTRS(arr, i, x, y, z, ry, rx, rz, sx, sy = sx, sz = sx) {
  const o = i * 16;
  const cy = Math.cos(ry);
  const syy = Math.sin(ry);
  const cx = Math.cos(rx);
  const sxx = Math.sin(rx);
  const cz = Math.cos(rz);
  const szz = Math.sin(rz);
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
  if (tile) {
    geo.setAttribute(
      'aTile',
      new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage)
    );
  }
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
// Compass yaw for +Z-forward PogoRig: 0 East (+X) = +PI/2, 1 South (+Z) = 0, 2 West (-X) = -PI/2, 3 North (-Z) = PI
const DIR_YAW = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];

export class PuzzleRenderer {
  constructor(webglRenderer, opts = {}) {
    const { softDotTex = null, skinId = 'default_amphibian', era = 'reboot' } = opts || {};
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this._ownSoftDot = !softDotTex;
    this.starTex = makeStarTex();
    this.ringTex = makeRingTex();
    this.width = 390;
    this.height = 620;
    this._dpr = 1;
    this.skinId = skinId || 'default_amphibian';
    this.era = era === 'original' ? 'original' : 'reboot';
    this.exposure = 1.0;
    this._kx = 1;
    this._ky = 1;

    const U = (this.U = {
      uTime: { value: 0 },
      uGlow: { value: new THREE.Color('#5efce8') },
      uTorch: { value: new THREE.Color('#ffaa33') },
      uRunes: { value: makeRuneAtlas() },
      uBand: { value: 0.6 },
      uShaftA: { value: new THREE.Vector3() },
      uShaftB: { value: new THREE.Vector3() },
      uTorchP: { value: [new THREE.Vector3(), new THREE.Vector3()] },
      uPx: { value: 600 },
      uRoomR: { value: 5 },
      uSolved: { value: 0 },
      uProgress: { value: 0 },
      uConduitSurge: { value: 0 },
      uGateOpen: { value: 0 },
      uIslandHalf: { value: new THREE.Vector2(2.6, 2.6) },
      uDoorX: { value: 0 },
    });

    this.scene = new THREE.Scene();
    this.bg = new THREE.Color('#060913');
    this.scene.background = this.bg;
    this.scene.fog = new THREE.Fog('#080d1c', 18, 46);
    this.camera = new THREE.PerspectiveCamera(42, 390 / 620, 0.1, 120);
    this.mapCam = new THREE.PerspectiveCamera(42, 390 / 620, 0.1, 120);

    // Scratch state (zero per-frame heap allocations)
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
    this._gold = new THREE.Color('#fde047');
    this._lastTime = null;
    this._roomRef = null;
    this._puzzleRef = null;
    this._lastVfxId = 0;
    this._lastActs = 0;
    this._pogoYaw = Math.PI;
    this._conduitSurge = 0;
    this._prismCols = [
      new THREE.Color('#5efce8'),
      new THREE.Color('#38bdf8'),
      new THREE.Color('#a78bfa'),
      new THREE.Color('#34d399'),
      new THREE.Color('#fde047'),
    ];
    this._glbPropsReady = false;
    this.glbBellPool = [];
    this.glbMirrorPool = [];
    this.glbBlockPool = [];
    this.glbBrazierPool = [];
    this._brazierPos = [];
    this._rings = [];
    for (let i = 0; i < MAX_RING; i++) {
      this._rings.push({
        t0: -10,
        life: 1,
        x: 0,
        y: 0,
        z: 0,
        r0: 0.2,
        r1: 1.4,
        flat: 0,
        col: new THREE.Color(),
        on: false,
      });
    }
    this._flips = new Int32Array(MAX_TILES);
    this._flipSeen = new Float32Array(MAX_TILES).fill(-1e9);
    this._tileRot = new Uint8Array(MAX_TILES);
    this._tileTint = new Float32Array(MAX_TILES);
    this._tileGlyph = new Float32Array(MAX_TILES);

    this._buildTextures();
    this._buildMaterials();
    this._buildLights();
    this._buildEnvMap();
    this._buildStatic();
    this._buildPuzzleMeshes();
    this._buildPogo();
    this._buildOverlay();

    this.setSkin(this.skinId);
    this.setEra(this.era);
    this.resize(390, 620, 1);
  }

  setSkin(skinId) {
    if (!skinId) return;
    this.skinId = skinId;
    this.pogoRig?.setSkin(skinId);
  }

  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    this.era = next;
    this.pogoRig?.setEraStyle?.(next);
    this.exposure = next === 'original' ? 1.05 : 1.0;
  }

  // ------------------------------------------------------------------ build
  _buildTextures() {
    this.slabTex = makeSlabTex();
    this.flagTex = makeFlagTex();
    this.wallTex = makeWallTex();
    this.slabNormalTex = makeSobelNormalTex(this.slabTex, 3.1, false);
    this.flagNormalTex = makeSobelNormalTex(this.flagTex, 3.2, true);
    this.wallNormalTex = makeSobelNormalTex(this.wallTex, 4.4, true);
    this.arrowTex = makeArrowTex();
    this.windowTex = makeWindowTex();
  }

  _buildMaterials() {
    const U = this.U;
    this.stoneTint = new THREE.Color('#464a78');
    this.tileMat = runeMaterial(U, {
      map: this.slabTex,
      normalMap: this.slabNormalTex,
      normalScale: new THREE.Vector2(1.55, 1.55),
      roughness: 0.28,
      metalness: 0.14,
      color: '#ffffff',
    });
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.flagTex,
      normalMap: this.flagNormalTex,
      normalScale: new THREE.Vector2(1.65, 1.65),
      roughness: 0.34,
      metalness: 0.12,
      vertexColors: true,
    });
    this.wallMat = new THREE.MeshStandardMaterial({
      map: this.wallTex,
      normalMap: this.wallNormalTex,
      normalScale: new THREE.Vector2(2.35, 2.35),
      roughness: 0.44,
      metalness: 0.12,
      vertexColors: true,
      side: THREE.BackSide,
    });
    this.stoneMat = new THREE.MeshStandardMaterial({
      map: this.slabTex,
      normalMap: this.slabNormalTex,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughness: 0.38,
      metalness: 0.12,
      vertexColors: true,
    });
    this.ironMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.52,
    });
    this.ledgeMat = new THREE.MeshStandardMaterial({
      color: '#2b2d4a',
      roughness: 0.76,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    this.bronzeMat = new THREE.MeshStandardMaterial({
      color: '#e0a95c',
      roughness: 0.32,
      metalness: 0.85,
      vertexColors: true,
    });
    this.goldMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.22,
      metalness: 0.92,
      emissive: '#b45309',
      emissiveIntensity: 0.45,
    });
    this.starCoreMat = new THREE.MeshStandardMaterial({
      color: '#fde047',
      roughness: 0.16,
      metalness: 0.35,
      emissive: '#f59e0b',
      emissiveIntensity: 0.75,
    });
    this.bandMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.gemMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.mirrorMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      roughness: 0.08,
      metalness: 1.0,
      emissive: '#162c46',
      emissiveIntensity: 0.55,
    });
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: '#8fe8ff',
      roughness: 0.12,
      metalness: 0.12,
      emissive: '#3ad0ff',
      emissiveIntensity: 0.28,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    this.runeStoneMat = runeMaterial(U, {
      map: this.slabTex,
      normalMap: this.slabNormalTex,
      normalScale: new THREE.Vector2(1.45, 1.45),
      roughness: 0.42,
      metalness: 0.10,
      color: '#ffffff',
    });

    this.bandRuneMat = new THREE.ShaderMaterial({
      uniforms: {
        uRunes: U.uRunes,
        uGlow: U.uGlow,
        uTime: U.uTime,
        uBand: U.uBand,
        uSolved: U.uSolved,
      },
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
          float ripple = uSolved * exp(-pow((vUv.x - fract(uTime * 0.35)) * 6.0, 2.0)) * 2.2;
          float lines = (smoothstep(0.0, 0.04, vUv.y) - smoothstep(0.04, 0.08, vUv.y)) + (smoothstep(0.92, 0.96, vUv.y) - smoothstep(0.96, 1.0, vUv.y));
          float k = a * (0.35 + 0.65 * wave) * flick * uBand + lines * 0.25 * uBand + a * ripple;
          gl_FragColor = vec4(uGlow * k, 1.0);
          ${GLSL_OUT}
        }`,
    });

    // Multi-layered domain-warped FBM volumetric fire for wall sconces & corner braziers
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
          float seed = vCol.r * 23.7;
          float layer = vCol.g; // 0.0 outer roaring crimson-amber, 0.5 mid dancing gold, 1.0 white-hot plasma core
          float inten = vCol.b;
          float y = vUv.y;
          float x = (vUv.x - 0.5) * 2.0;
          float borderFade = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x)
                           * smoothstep(0.0, 0.06, y) * smoothstep(1.0, 0.88, y);

          // 3-octave scrolling FBM turbulence for licking, bifurcating volumetric flame tongues
          float n1 = vnoise(vec2(x * 2.6 + seed, y * 3.8 - uTime * (5.6 + layer * 2.2)));
          float n2 = vnoise(vec2(x * 5.4 - seed * 1.3, y * 7.6 - uTime * (9.2 + layer * 3.0)));
          float n3 = vnoise(vec2(x * 10.5 + seed * 0.7, y * 14.0 - uTime * 13.5));
          float fbm = n1 * 0.52 + n2 * 0.33 + n3 * 0.15;

          float sway = (n1 - 0.5) * (0.68 - layer * 0.24) * pow(y, 0.85);
          float nx = x + sway;
          float width = mix(0.66, 0.36, layer) * pow(max(0.0, 1.04 - y), mix(0.62, 0.95, layer));
          float tongue = smoothstep(width, width * 0.14, abs(nx) - (fbm - 0.5) * 0.28 * y);
          float tipErode = 1.0 - smoothstep(mix(0.46, 0.62, layer), 0.98, y + (0.5 - fbm) * 0.42);
          float body = clamp(tongue * tipErode * borderFade, 0.0, 1.0);

          float core = smoothstep(width * 0.58, 0.0, abs(nx)) * (1.0 - smoothstep(0.08, 0.58, y));
          vec3 outerC = mix(vec3(0.92, 0.18, 0.02), vec3(1.0, 0.58, 0.10), clamp(fbm * 1.25, 0.0, 1.0));
          vec3 midC = mix(vec3(1.0, 0.52, 0.08), vec3(1.0, 0.84, 0.34), body);
          vec3 innerC = vec3(1.0, 0.96, 0.80);
          vec3 col = mix(outerC, midC, clamp(layer + body * 0.55, 0.0, 1.0)) + innerC * core * (0.45 + layer * 0.65);
          gl_FragColor = vec4(col * body * inten * 0.92, 1.0);
          ${GLSL_OUT}
        }`,
    });

    // Buoyant Rising Warm Ember Sparks above all 8 braziers & wall sconces
    this.U.uFireAnchors = { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, -10, 0)) };
    this.U.uFireCount = { value: 0 };
    this.emberMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uPx: U.uPx,
        uMap: { value: this.softDot },
        uAnchors: this.U.uFireAnchors,
        uCount: this.U.uFireCount,
      },
      ...ADD,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPx; uniform vec3 uAnchors[8]; uniform float uCount;
        attribute vec4 aEmber;
        varying float vA; varying vec3 vC;
        void main(){
          int idx = int(mod(floor(aEmber.x * 8.0), max(1.0, uCount)));
          vec3 base = uAnchors[0];
          for (int k = 0; k < 8; k++) { if (k == idx) base = uAnchors[k]; }
          float life = fract(uTime * (0.42 + aEmber.y * 0.46) + aEmber.z);
          float rise = life * (1.25 + aEmber.w * 0.95);
          float ang = uTime * (2.2 + aEmber.y * 2.4) + aEmber.z * 6.2831853;
          float rad = (0.05 + life * 0.24) * (0.5 + aEmber.w * 0.7);
          vec3 p = base + vec3(cos(ang) * rad, rise + 0.08, sin(ang) * rad);
          float flick = 0.65 + 0.35 * sin(uTime * 19.0 + aEmber.z * 40.0);
          vA = smoothstep(0.0, 0.12, life) * pow(1.0 - life, 1.35) * flick * step(0.5, uCount);
          vC = mix(vec3(1.0, 0.90, 0.52), vec3(1.0, 0.34, 0.06), smoothstep(0.15, 0.85, life));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.028 + (1.0 - life) * 0.026) * uPx / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(vC * a * 1.4, a); ${GLSL_OUT} }`,
    });

    // Drifting Atmospheric Subterranean Moat Mist (strictly 0.0 4-edge box-faded FBM vapor)
    this.moatMistMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uTorch: U.uTorch,
        uGlow: U.uGlow,
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vC; varying float vSeed;
        void main(){
          vUv = uv; vC = instanceColor;
          vSeed = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.47;
          gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uTorch; uniform vec3 uGlow;
        varying vec2 vUv; varying vec3 vC; varying float vSeed;
        ${GLSL_NOISE}
        void main(){
          float boxFade = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x)
                        * smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
          vec2 q = (vUv - 0.5) * 2.0;
          float rad = 1.0 - smoothstep(0.25, 0.96, length(q));
          float n1 = vnoise(vUv * 3.2 + vec2(uTime * 0.08 + vSeed, -uTime * 0.05));
          float n2 = vnoise(vUv * 6.8 - vec2(uTime * 0.12, uTime * 0.07 - vSeed));
          float fbm = n1 * 0.62 + n2 * 0.38;
          float a = boxFade * rad * smoothstep(0.28, 0.82, fbm) * 0.22 * vC.r;
          vec3 mistCol = mix(vec3(0.22, 0.32, 0.48), uGlow * 0.55 + uTorch * 0.35, vC.g * 0.42);
          gl_FragColor = vec4(mistCol, a);
          ${GLSL_OUT}
        }`,
    });

    // Dusty silver-blue moonlit slit-window shaft
    this.shaftMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uCol: { value: new THREE.Color('#a8cef8') },
        uStr: { value: 0.105 },
      },
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

    this.dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uShaftA: U.uShaftA,
        uShaftB: U.uShaftB,
        uTorchP: U.uTorchP,
        uPx: U.uPx,
        uMap: { value: this.softDot },
        uR: U.uRoomR,
      },
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
          vec3 ab = uShaftB - uShaftA; float h = clamp(dot(p - uShaftA, ab) / dot(ab, ab), 0.0, 1.0);
          float d = length(p - (uShaftA + ab * h));
          float inShaft = exp(-d * d * 2.2) * 1.45;
          float torch = 0.0;
          for (int i = 0; i < 2; i++) { vec3 q = p - uTorchP[i]; torch += exp(-dot(q, q) * 0.6) * 0.9; }
          float tw = 0.6 + 0.4 * sin(t * (1.0 + aSeed.y * 2.0) + aSeed.z * 30.0);
          vA = (0.06 + inShaft + torch) * tw;
          vC = mix(vec3(1.0, 0.72, 0.35), vec3(0.78, 0.9, 1.0), clamp(inShaft - torch * 0.45, 0.0, 1.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.035 + aSeed.w * 0.03) * uPx / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main(){ float a = texture2D(uMap, gl_PointCoord).a * vA; gl_FragColor = vec4(vC * a, a); ${GLSL_OUT} }`,
    });

    const beamMat = (sharp, col, inten) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: U.uTime,
          uCol: { value: new THREE.Color(col) },
          uInt: { value: inten },
          uSharp: { value: sharp },
        },
        ...ADD,
        vertexShader: /* glsl */ `
          varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vLen; varying vec3 vICol;
          void main(){
            vUv = uv;
            vICol = instanceColor;
            vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
            vV = normalize(cameraPosition - wp.xyz);
            vLen = length(instanceMatrix[1].xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uCol; uniform float uInt; uniform float uSharp;
          varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying float vLen; varying vec3 vICol;
          void main(){
            float f = abs(dot(normalize(vN), normalize(vV)));
            float k = pow(f, uSharp);
            float flow = 0.72 + 0.28 * sin((vUv.y * vLen) * 8.5 - uTime * 18.0);
            gl_FragColor = vec4(uCol * vICol * k * uInt * flow, 1.0);
            ${GLSL_OUT}
          }`,
      });
    this.beamCoreMat = beamMat(3.2, '#fffaf0', 2.25);
    this.beamGlowMat = beamMat(1.45, '#ffffff', 0.85);
    this.beamHaloMat = beamMat(1.05, '#ffffff', 0.34);

    // Dark Rippling Subterranean Sanctum Water Moat (caustics + island shoreline foam + sconce/gate reflections)
    this.sanctumWaterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uGlow: U.uGlow,
        uTorch: U.uTorch,
        uTorchP: U.uTorchP,
        uShaftB: U.uShaftB,
        uRoomR: U.uRoomR,
        uSolved: U.uSolved,
        uProgress: U.uProgress,
        uGateOpen: U.uGateOpen,
        uIslandHalf: U.uIslandHalf,
        uDoorX: U.uDoorX,
      },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uGlow; uniform vec3 uTorch; uniform vec3 uTorchP[2];
        uniform vec3 uShaftB; uniform float uRoomR; uniform float uSolved; uniform float uProgress;
        uniform float uGateOpen; uniform vec2 uIslandHalf; uniform float uDoorX;
        varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vW.xz;
          float t = uTime;
          // Multi-layered subterranean ripple normals
          float n1 = vnoise(p * 2.3 + vec2(t * 0.42, -t * 0.31));
          float n2 = vnoise(p * 4.8 - vec2(t * 0.64, t * 0.48));
          float n3 = vnoise(p * 9.2 + vec2(t * 0.9, t * 0.7));
          vec2 grad = vec2(n1 - 0.5, n2 - 0.5) * 0.55 + vec2(n3 - 0.5) * 0.22;
          vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.08 + 0.92 * pow(1.0 - max(dot(N, V), 0.0), 4.0);

          // Signed distance to carved puzzle island & south entrance causeway
          vec2 dIsle = abs(p) - uIslandHalf;
          float sdIsle = length(max(dIsle, 0.0)) + min(max(dIsle.x, dIsle.y), 0.0);
          vec2 dBridge = abs(p - vec2(uDoorX, uIslandHalf.y + 1.8)) - vec2(0.82, 1.9);
          float sdBridge = length(max(dBridge, 0.0)) + min(max(dBridge.x, dBridge.y), 0.0);
          float shoreDist = min(sdIsle, sdBridge);

          // Deep indigo-abyss base + dancing cyan subterranean caustics
          vec3 deep = vec3(0.016, 0.032, 0.068);
          vec3 shallow = vec3(0.035, 0.085, 0.145);
          float caust = smoothstep(0.56, 0.88, n1 * 0.58 + n2 * 0.52);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 2.2, shoreDist));
          col += uGlow * caust * (0.12 + uProgress * 0.18 + uSolved * 0.22) * smoothstep(3.8, 0.2, shoreDist);

          // Animated lapping shoreline ripples around the sunken stone island
          float lap = sin(shoreDist * 15.0 - t * 3.4 + n1 * 3.0);
          float foam = smoothstep(0.55, 0.95, lap) * exp(-max(shoreDist, 0.0) * 2.6) * step(-0.05, shoreDist);
          col += mix(vec3(0.55, 0.82, 0.98), uGlow, 0.45) * foam * 0.42;

          // Specular reflections from wall sconces, moonlit shaft, and opening North Vault Gate
          vec3 R = reflect(-V, N);
          for (int i = 0; i < 2; i++) {
            vec3 L = normalize(uTorchP[i] - vW);
            float sp = pow(max(dot(R, L), 0.0), 28.0);
            float att = 1.0 / (1.0 + dot(uTorchP[i].xz - p, uTorchP[i].xz - p) * 0.08);
            col += uTorch * sp * att * 0.85;
          }
          vec3 mL = normalize(vec3(uShaftB.x - p.x, 4.2, uShaftB.z - p.y));
          col += vec3(0.72, 0.88, 1.0) * pow(max(dot(R, mL), 0.0), 42.0) * 0.45;

          // Blazing golden-cyan reflection spilling across the water from the North Sanctum Vault Gate
          float gateAlign = exp(-pow(p.x * 0.65, 2.0)) * smoothstep(1.5, -uIslandHalf.y - 1.8, p.y);
          col += mix(uGlow, vec3(1.0, 0.84, 0.38), 0.68) * gateAlign * (0.08 + uGateOpen * 0.85) * (0.65 + 0.35 * n2);

          // Sky/cavern Fresnel sheen + radial cavern edge fade
          col = mix(col, vec3(0.10, 0.16, 0.28) + uGlow * 0.08, clamp(fres * 0.48, 0.0, 0.55));
          float rFade = 1.0 - smoothstep(uRoomR * 0.86, uRoomR * 1.18, length(p));
          float alpha = clamp(0.84 + foam * 0.14, 0.0, 0.96) * rFade;
          gl_FragColor = vec4(col, alpha);
          ${GLSL_OUT}
        }`,
    });

    // Glowing Carved Floor Energy Conduits (progressively fill from South to North Vault Gate)
    this.conduitMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uGlow: U.uGlow,
        uProgress: U.uProgress,
        uSurge: U.uConduitSurge,
        uSolved: U.uSolved,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aFlow;
        varying vec2 vUv; varying float vFlow;
        void main(){
          vUv = uv;
          vFlow = aFlow;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uGlow; uniform float uProgress; uniform float uSurge; uniform float uSolved;
        varying vec2 vUv; varying float vFlow;
        void main(){
          float groove = 1.0 - smoothstep(0.18, 0.5, abs(vUv.x - 0.5));
          float lit = smoothstep(vFlow - 0.08, vFlow + 0.08, uProgress + 0.06);
          // reverse smoothstep: lit = 1 when vFlow <= uProgress
          float activeK = 1.0 - lit;
          float pulse = 0.65 + 0.35 * sin(vFlow * 18.0 - uTime * 5.5);
          float base = 0.12 + activeK * (0.78 + pulse * 0.45) + uSurge * 0.65 + uSolved * 0.55;
          vec3 col = mix(uGlow, vec3(1.0, 0.86, 0.38), uSolved * 0.65 + uSurge * 0.35);
          float a = groove * base;
          gl_FragColor = vec4(col * a * 1.25, a);
          ${GLSL_OUT}
        }`,
    });

    // Golden-Cyan Volumetric Portal Chamber Glow behind the rising 3D Sanctum Vault Gate
    this.vaultPortalMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uGlow: U.uGlow,
        uOpen: U.uGateOpen,
      },
      ...ADD,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uGlow; uniform float uOpen;
        varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
          vec2 q = vUv - vec2(0.5, 0.42);
          float d = length(q * vec2(1.15, 0.85));
          float swirl = vnoise(vec2(atan(q.y, q.x) * 3.0 + uTime * 0.6, d * 6.0 - uTime * 1.1));
          float core = smoothstep(0.62, 0.04, d) * (0.72 + 0.28 * swirl);
          vec3 col = mix(uGlow, vec3(1.0, 0.88, 0.45), smoothstep(0.45, 0.05, d));
          float k = core * (0.16 + uOpen * 1.45);
          gl_FragColor = vec4(col * k, 1.0);
          ${GLSL_OUT}
        }`,
    });

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

    // Deep Exterior Moonlit Storm-Cavern Vista visible through Recessed Barred Clerestory Arches
    this.clerestoryDepthMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uGlow: U.uGlow,
      },
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vW;
        void main(){
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uGlow;
        varying vec2 vUv; varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          float ang = atan(vW.x, vW.z);
          float u = ang / 6.2831853 + 0.5;
          float v = clamp((vW.y - 2.75) / 2.85, 0.0, 1.0);

          // Moody midnight-indigo storm sky + silver-blue moonlight streaming in through the clerestory
          vec3 skyLo = vec3(0.055, 0.11, 0.22);
          vec3 skyHi = vec3(0.018, 0.036, 0.085);
          vec3 col = mix(skyLo, skyHi, smoothstep(0.05, 0.92, v));

          // Crisp stars in upper storm rifts
          vec2 sp = vec2(u * 140.0, v * 48.0);
          vec2 gi = floor(sp);
          float sh = hash12(gi);
          if (sh > 0.94 && v > 0.32) {
            float st = smoothstep(0.14, 0.02, length(fract(sp) - 0.5));
            col += vec3(0.75, 0.88, 1.0) * st * 0.65;
          }

          // Multi-layer drifting storm clouds with silver-rimmed lunar scattering
          float n1 = vnoise(vec2(u * 14.0 + uTime * 0.06, v * 4.5));
          float n2 = vnoise(vec2(u * 29.0 - uTime * 0.09, v * 9.0 + n1 * 0.8));
          float cloud = smoothstep(0.32, 0.78, n1 * 0.62 + n2 * 0.38);
          float moonFocus = exp(-pow((ang - (3.14159 + 0.44)) * 1.45, 2.0)) + exp(-pow((ang + (3.14159 - 0.44)) * 1.45, 2.0));
          vec3 cloudRim = vec3(0.46, 0.68, 0.98) * (0.45 + 0.85 * moonFocus);
          col = mix(col, vec3(0.025, 0.048, 0.10), cloud * 0.72);
          col += cloudRim * smoothstep(0.18, 0.52, cloud) * (1.0 - cloud * 0.55) * 0.62;

          // Distant craggy archipelago sea-stack silhouettes along the lower clerestory horizon
          float ridgeH = 0.18 + 0.24 * pow(vnoise(vec2(u * 22.0, 2.7)), 1.6) + 0.10 * vnoise(vec2(u * 54.0, 5.1));
          float ridgeMask = 1.0 - smoothstep(ridgeH - 0.02, ridgeH + 0.025, v);
          col = mix(col, vec3(0.015, 0.028, 0.062), ridgeMask * 0.88);

          // Rolling silver-cyan clerestory mist at sill level
          float sillMist = (1.0 - smoothstep(0.0, 0.42, v)) * (0.55 + 0.45 * n2);
          col += mix(vec3(0.24, 0.42, 0.70), uGlow * 0.45, 0.28) * sillMist * 0.48;

          gl_FragColor = vec4(col, 1.0);
          ${GLSL_OUT}
        }`,
    });
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#8cb4e8', '#141528', 0.62);
    this.windowLight = new THREE.DirectionalLight('#c4e2ff', 1.42);
    this.windowLight.position.set(-4, 9, -6);
    this.windowLight.castShadow = true;
    this.windowLight.shadow.mapSize.set(1024, 1024);
    const sc = this.windowLight.shadow.camera;
    sc.left = -6.2;
    sc.right = 6.2;
    sc.top = 6.2;
    sc.bottom = -6.2;
    sc.near = 2.0;
    sc.far = 34.0;
    sc.updateProjectionMatrix?.();
    this.windowLight.shadow.bias = -0.0005;
    this.windowLight.shadow.normalBias = 0.022;
    this.torchL = new THREE.PointLight('#ffaa33', 14.5, 13, 1.7);
    this.torchR = new THREE.PointLight('#ffaa33', 14.5, 13, 1.7);
    this.fxLight = new THREE.PointLight('#5efce8', 0, 9, 1.6);
    this.fill = new THREE.DirectionalLight('#ffd6ad', 0.62);
    this.fill.position.set(1.5, 6, 9);
    this.scene.add(
      this.hemi,
      this.windowLight,
      this.windowLight.target,
      this.torchL,
      this.torchR,
      this.fxLight,
      this.fill
    );
  }

  _buildEnvMap() {
    const gl = this.gl;
    const prevRT = gl.getRenderTarget ? gl.getRenderTarget() : null;
    const prevAuto = gl.autoClear;
    const prevTM = gl.toneMapping;
    const prevScTest = gl.getScissorTest ? gl.getScissorTest() : false;
    const prevVP = gl.getViewport && THREE.Vector4 ? gl.getViewport(new THREE.Vector4()) : null;
    const prevSC = gl.getScissor && THREE.Vector4 ? gl.getScissor(new THREE.Vector4()) : null;
    try {
      const envScene = new THREE.Scene();
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(10, 24, 12),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          vertexShader:
            'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader:
            'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.14,0.12,0.22), vec3(0.04,0.06,0.12), smoothstep(-0.2, 0.7, h)); gl_FragColor = vec4(c, 1.0); }',
        })
      );
      envScene.add(sky);
      const blob = (x, y, z, r, col, k) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(r, 12, 8),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) })
        );
        m.position.set(x, y, z);
        envScene.add(m);
      };
      blob(-5, 2, -5, 0.9, '#ffaa33', 5);
      blob(5, 2, -5, 0.9, '#ffaa33', 5);
      blob(-3, 7, -4, 1.4, '#b8dcff', 3.2);
      blob(0, -1, 7, 2.0, '#2b395c', 1.6);
      const pmrem = new THREE.PMREMGenerator(gl);
      this._envRT = pmrem.fromScene(envScene, 0.03);
      pmrem.dispose();
      envScene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this.scene.environment = this._envRT.texture;
      this.scene.environmentIntensity = 0.52;
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

  _buildStatic() {
    const U = this.U;
    this.roomGroup = new THREE.Group();
    this.scene.add(this.roomGroup);

    const quad = (this._quad = new THREE.PlaneGeometry(1, 1));
    const flatQuad = (this._flatQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

    this.tiles = inst(roundedBox(0.94, 0.16, 0.94, 0.045, 2), this.tileMat, MAX_TILES, {
      color: true,
      tile: true,
    });
    this.tiles.receiveShadow = true;
    this.tileAttr = this.tiles.geometry.attributes.aTile;
    this.scene.add(this.tiles);

    this.columns = inst(buildColumn(5.2), this.stoneMat, MAX_PILLAR, { color: true });
    this.sconces = inst(buildSconce(), this.ironMat, 8);
    this.scene.add(this.columns, this.sconces);
    this.flames = new Quads(quad, this.flameMat, MAX_TORCH, 3);
    this.scene.add(this.flames.mesh);

    // Rising Warm Ember Sparks (single Points draw call across all braziers & sconces)
    {
      const eg = new THREE.BufferGeometry();
      const ep = new Float32Array(MAX_EMBERS * 3);
      const ea = new Float32Array(MAX_EMBERS * 4);
      const erng = mulberry32(7171);
      for (let i = 0; i < MAX_EMBERS; i++) {
        ea[i * 4] = (i % 8) / 8;
        ea[i * 4 + 1] = erng();
        ea[i * 4 + 2] = erng();
        ea[i * 4 + 3] = erng();
      }
      eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
      eg.setAttribute('aEmber', new THREE.BufferAttribute(ea, 4));
      this.emberPoints = new THREE.Points(eg, this.emberMat);
      this.emberPoints.frustumCulled = false;
      this.emberPoints.renderOrder = 6;
      this.scene.add(this.emberPoints);
    }

    // Drifting Subterranean Moat Mist (single InstancedMesh draw call over dark water moat)
    {
      this.moatMistMesh = inst(flatQuad, this.moatMistMat, MAX_MOAT_MIST, { color: true });
      this.moatMistMesh.renderOrder = 2;
      this.scene.add(this.moatMistMesh);
    }

    this.windowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 1.5),
      new THREE.MeshBasicMaterial({
        map: this.windowTex,
        transparent: true,
        toneMapped: false,
        color: new THREE.Color(0.95, 1.04, 1.16),
      })
    );
    this.scene.add(this.windowMesh);
    this.shaft = new THREE.Mesh(new THREE.BufferGeometry(), this.shaftMat);
    this.shaft.frustumCulled = false;
    this.shaft.renderOrder = 4;
    this.scene.add(this.shaft);

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

    this.glows = new Quads(quad, billboardMat(this.softDot), MAX_GLOW, 6);
    this.stars = new Quads(quad, billboardMat(this.starTex), MAX_STAR, 7);
    this.fglows = new Quads(flatQuad, flatMat(this.softDot), MAX_FGLOW, 2);
    this.shades = new Quads(flatQuad, flatMat(this.softDot, { additive: false }), MAX_SHADE, 1);
    const rq = new THREE.PlaneGeometry(1, 1);
    rq.setAttribute(
      'aRing',
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_RING * 2), 2).setUsage(THREE.DynamicDrawUsage)
    );
    this.ringAttr = rq.attributes.aRing;
    this.rings = new Quads(rq, this.ringMat, MAX_RING, 6);
    this.scene.add(this.glows.mesh, this.stars.mesh, this.fglows.mesh, this.shades.mesh, this.rings.mesh);

    this.exitMat = new THREE.MeshBasicMaterial({
      map: this.arrowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: '#ffffff',
      toneMapped: false,
    });
    this.exitMark = new THREE.Mesh(flatQuad, this.exitMat);
    this.exitMark.renderOrder = 3;
    this.scene.add(this.exitMark);

    this.stele = new THREE.Mesh(buildStele(), this.stoneMat);
    this.stele.castShadow = true;
    this.stele.receiveShadow = true;
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
    this.muralMat = new THREE.MeshStandardMaterial({
      map: this.muralTex,
      emissiveMap: this.muralGlowTex,
      emissive: '#ffffff',
      emissiveIntensity: 1.5,
      roughness: 0.68,
    });
    this.mural = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.7), this.muralMat);
    this.mural.position.set(0, 1.38, 0.165);
    this.stele.add(this.mural);
    this.scene.add(this.stele);

    // Reward: Explorer Star Core + Golden Gear
    this.reward = new THREE.Group();
    this.starfish = new THREE.Mesh(buildStarCoreMesh(), this.starCoreMat);
    this.key = new THREE.Mesh(buildGoldenGearMesh(), this.goldMat);
    this.starfish.position.set(-0.36, 0, 0);
    this.key.position.set(0.38, 0, 0);
    this.reward.add(this.starfish, this.key);
    this.reward.visible = false;
    this.scene.add(this.reward);

    this.pillarBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.75, 1, 20, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uTime: U.uTime, uCol: { value: new THREE.Color('#fde68a') }, uA: { value: 0 } },
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

    // ---- Massive 3D Carved Sanctum Vault Gate (North Wall Heroic Focal Point)
    this.vaultRoot = new THREE.Group();
    this.vaultPortalMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 3.55), this.vaultPortalMat);
    this.vaultPortalMesh.position.set(0, 1.72, -0.22);
    this.vaultPortalMesh.renderOrder = 3;
    this.vaultFrameMesh = new THREE.Mesh(buildVaultFrameGeo(), this.stoneMat);
    this.vaultFrameMesh.castShadow = true;
    this.vaultFrameMesh.receiveShadow = true;
    this.vaultDoorGroup = new THREE.Group();
    this.vaultDoorMesh = new THREE.Mesh(buildVaultDoorGeo(), this.stoneMat);
    this.vaultDoorMesh.castShadow = true;
    this.vaultDoorMesh.receiveShadow = true;
    this.vaultDoorGroup.add(this.vaultDoorMesh);
    const gearGeo = buildGoldenGearMesh();
    this.vaultGearL = new THREE.Mesh(gearGeo, this.bronzeMat);
    this.vaultGearR = new THREE.Mesh(gearGeo, this.bronzeMat);
    this.vaultGearL.position.set(-1.38, 2.75, 0.42);
    this.vaultGearR.position.set(1.38, 2.75, 0.42);
    this.vaultGearL.scale.setScalar(1.28);
    this.vaultGearR.scale.setScalar(1.28);
    this.vaultRoot.add(
      this.vaultPortalMesh,
      this.vaultDoorGroup,
      this.vaultFrameMesh,
      this.vaultGearL,
      this.vaultGearR
    );
    this.scene.add(this.vaultRoot);

    // Procedural Frame-0 Island Corner Braziers (replaced seamlessly once `puzzle_props.glb` finishes loading)
    this.procBraziers = inst(buildProcBrazier(), this.ironMat, 4);
    this.procBraziers.castShadow = true;
    this.scene.add(this.procBraziers);
  }

  _buildPuzzleMeshes() {
    this.bellFrames = inst(buildBellFrame(), this.ironMat, 5);
    this.bellFrames.castShadow = true;
    this.bellBodies = inst(buildBell(), this.bronzeMat, 5);
    this.bellBodies.castShadow = true;
    this.bellBands = inst(buildBellBand(), this.bandMat, 5, { color: true });
    this.gems = inst(new THREE.OctahedronGeometry(0.1, 0), this.gemMat, 16, { color: true });
    this.pedestals = inst(buildPedestal(), this.stoneMat, 12, { color: true });
    this.pedestals.receiveShadow = true;
    this.pennants = inst(
      this._buildPennantGeo(),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.78, color: '#ffffff' }),
      10,
      { color: true }
    );

    this.mirrorFrames = inst(buildMirrorFrame(), this.bronzeMat, 6);
    this.mirrorFrames.castShadow = true;
    this.mirrorFaces = inst(buildMirrorFace(), this.mirrorMat, 6, { color: true });
    this.mirrorFaces.castShadow = true;
    this.beamCore = inst(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), this.beamCoreMat, MAX_BEAM, {
      color: true,
    });
    this.beamGlow = inst(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), this.beamGlowMat, MAX_BEAM, {
      color: true,
    });
    this.beamHalo = inst(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), this.beamHaloMat, MAX_BEAM, {
      color: true,
    });
    this.beamCore.renderOrder = 6;
    this.beamGlow.renderOrder = 5;
    this.beamHalo.renderOrder = 4;
    this.emitter = new THREE.Mesh(buildEmitter(), this.bronzeMat);
    this.emitter.castShadow = true;
    this.crystal = new THREE.Mesh(buildCrystal(), this.crystalMat);
    this.crystal.castShadow = true;
    this.crystalBase = new THREE.Mesh(buildPedestal(0.42, 0.3), this.stoneMat);
    this.crystalBase.castShadow = true;
    this.crystalBase.receiveShadow = true;
    this.crystal.add(this.crystalBase);

    this.blocks = inst(roundedBox(0.84, 0.84, 0.84, 0.07, 2), this.runeStoneMat, 5, {
      color: true,
      tile: true,
    });
    this.blocks.castShadow = true;
    this.blocks.receiveShadow = true;
    this.blockAttr = this.blocks.geometry.attributes.aTile;
    const plateGeo = new THREE.CylinderGeometry(0.4, 0.43, 0.08, 24);
    {
      const pos = plateGeo.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = pos.getX(i) / 0.86 + 0.5;
        uv[i * 2] = clamp(uv[i * 2], 0, 1);
        uv[i * 2 + 1] = 0.5 - pos.getZ(i) / 0.86;
      }
      plateGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    this.plates = inst(plateGeo, this.runeStoneMat.clone(), 5, { color: true, tile: true });
    this.plates.receiveShadow = true;
    this.plates.material.onBeforeCompile = this.runeStoneMat.onBeforeCompile;
    this.plates.material.customProgramCacheKey = this.runeStoneMat.customProgramCacheKey;
    this.plateAttr = this.plates.geometry.attributes.aTile;
    this.solids = inst(buildBrokenColumn(), this.stoneMat, 8, { color: true });
    this.solids.castShadow = true;
    this.solids.receiveShadow = true;

    // GLB Prop Container Groups (`assets/models/puzzle_props.glb`)
    this.glbBellGroup = new THREE.Group();
    this.glbMirrorGroup = new THREE.Group();
    this.glbBlockGroup = new THREE.Group();
    this.glbBrazierGroup = new THREE.Group();

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
      this.beamHalo,
      this.emitter,
      this.crystal,
      this.blocks,
      this.plates,
      this.solids,
      this.glbBellGroup,
      this.glbMirrorGroup,
      this.glbBlockGroup,
      this.glbBrazierGroup
    );

    this._loadPuzzlePropsGlb();
  }

  _loadPuzzlePropsGlb() {
    let url = './assets/models/puzzle_props.glb';
    try {
      url = new URL('../assets/models/puzzle_props.glb', import.meta.url).href;
    } catch (_) {
      // Fallback relative URL
    }
    try {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          if (this._disposed || !gltf?.scene) return;
          const root = gltf.scene;
          const tplBell = root.getObjectByName('temple_bell');
          const tplMirror = root.getObjectByName('prism_mirror');
          const tplBlock = root.getObjectByName('push_monolith');
          const tplBrazier = root.getObjectByName('sanctum_brazier');

          const cloneWithMats = (tpl, cloneNames) => {
            const instRoot = tpl.clone(true);
            instRoot.position.set(0, 0, 0);
            instRoot.rotation.set(0, 0, 0);
            instRoot.scale.setScalar(1);
            const bucket = {};
            for (const nm of cloneNames) bucket[nm] = [];
            instRoot.traverse((o) => {
              if (!o.isMesh) return;
              o.frustumCulled = false;
              o.castShadow = true;
              o.receiveShadow = true;
              const remap = (m) => {
                if (!m) return m;
                if (m.name === 'mat_rune_glow') {
                  o.castShadow = false;
                }
                if (tpl === tplBrazier && m.name !== 'mat_iron') {
                  o.castShadow = false;
                }
                if ((tpl === tplBell || tpl === tplMirror) && m.name === 'mat_stone') {
                  o.castShadow = false;
                }
                if (m.name === 'mat_fire_glow') {
                  // Flatten static Blender flame cone into a glowing coal bed seated at y = 0.84 inside the brazier bowl
                  o.castShadow = false;
                  o.receiveShadow = false;
                  o.scale.y = 0.14;
                  o.position.y = 0.84 * (1 - 0.14);
                }
                if (cloneNames.includes(m.name)) {
                  const cm = m.clone();
                  if (m.name === 'mat_fire_glow') {
                    cm.color?.set('#ff6a14');
                    cm.emissive?.set('#ff5500');
                  }
                  cm.emissiveIntensity = Math.min(1.6, cm.emissiveIntensity || 0.9);
                  bucket[m.name].push(cm);
                  return cm;
                }
                if (m.emissiveIntensity > 1.4) m.emissiveIntensity = 1.4;
                return m;
              };
              o.material = Array.isArray(o.material) ? o.material.map(remap) : remap(o.material);
            });
            return { instRoot, bucket };
          };

          if (tplBell) {
            for (let i = 0; i < 5; i++) {
              const { instRoot, bucket } = cloneWithMats(tplBell, ['mat_rune_glow']);
              instRoot.visible = false;
              const body = instRoot.getObjectByName('bell_body');
              this.glbBellGroup.add(instRoot);
              this.glbBellPool.push({ root: instRoot, body, runeMats: bucket.mat_rune_glow });
            }
          }
          if (tplMirror) {
            for (let i = 0; i < 6; i++) {
              const { instRoot, bucket } = cloneWithMats(tplMirror, ['mat_mirror_crystal']);
              instRoot.visible = false;
              const turret = instRoot.getObjectByName('mirror_turret');
              this.glbMirrorGroup.add(instRoot);
              this.glbMirrorPool.push({ root: instRoot, turret, crystalMats: bucket.mat_mirror_crystal });
            }
          }
          if (tplBlock) {
            for (let i = 0; i < 5; i++) {
              const { instRoot, bucket } = cloneWithMats(tplBlock, ['mat_rune_glow']);
              instRoot.visible = false;
              this.glbBlockGroup.add(instRoot);
              this.glbBlockPool.push({ root: instRoot, runeMats: bucket.mat_rune_glow });
            }
          }
          if (tplBrazier) {
            for (let i = 0; i < 4; i++) {
              const { instRoot, bucket } = cloneWithMats(tplBrazier, ['mat_fire_glow']);
              instRoot.visible = false;
              this.glbBrazierGroup.add(instRoot);
              this.glbBrazierPool.push({ root: instRoot, fireMats: bucket.mat_fire_glow });
            }
          }

          this._glbPropsReady = true;
          if (this._roomRef) {
            this._syncGlbRoomProps(this._roomRef);
          }
        },
        undefined,
        () => {
          // Keep procedural sanctum props active if `.glb` unavailable
        }
      );
    } catch (_) {
      // Headless / stub loader fallback keeps procedural sanctum props active
    }
  }

  _syncGlbRoomProps(room) {
    if (!this._glbPropsReady || !room) return;
    const t = room.puzzle?.type;
    if (this.glbBellPool.length) {
      this.bellFrames.visible = false;
      this.bellBodies.visible = false;
      this.bellBands.visible = false;
      this.glbBellGroup.visible = t === 'bells';
      for (let i = 0; i < this.glbBellPool.length; i++) {
        const slot = this.glbBellPool[i];
        const b = t === 'bells' ? room.bells[i] : null;
        slot.root.visible = !!b;
        if (b) {
          slot.root.position.set(room.worldX(b.x), 0.08, room.worldZ(b.y));
          const col = this._bellCols[b.color];
          for (const m of slot.runeMats) {
            m.color.copy(col);
            m.emissive.copy(col);
          }
        }
      }
    }
    if (this.glbMirrorPool.length) {
      this.mirrorFrames.visible = false;
      this.mirrorFaces.visible = false;
      this.glbMirrorGroup.visible = t === 'beam';
      for (let i = 0; i < this.glbMirrorPool.length; i++) {
        const slot = this.glbMirrorPool[i];
        const m = t === 'beam' ? room.mirrors[i] : null;
        slot.root.visible = !!m;
      }
    }
    if (this.glbBlockPool.length) {
      this.blocks.visible = false;
      this.glbBlockGroup.visible = t === 'blocks';
      for (let i = 0; i < this.glbBlockPool.length; i++) {
        const slot = this.glbBlockPool[i];
        const b = t === 'blocks' ? room.blocks[i] : null;
        slot.root.visible = !!b;
      }
    }
    if (this.glbBrazierPool.length && this._brazierPos.length) {
      this.procBraziers.visible = false;
      this.glbBrazierGroup.visible = true;
      for (let i = 0; i < this.glbBrazierPool.length; i++) {
        const slot = this.glbBrazierPool[i];
        const bp = this._brazierPos[i];
        slot.root.visible = !!bp;
        if (bp) {
          slot.root.position.set(bp.x, 0.02, bp.z);
          slot.root.rotation.y = (i * Math.PI) / 2 + 0.4;
        }
      }
    }
  }

  _buildPennantGeo() {
    const g = new THREE.PlaneGeometry(0.2, 0.5, 1, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const yy = y - 0.25;
      const tip = yy < -0.4 && Math.abs(x) < 0.01 ? 0.08 : 0;
      pos.setXYZ(i, x * (1 - (-yy / 0.5) * 0.15), yy + tip, Math.sin(-yy * 6) * 0.02);
    }
    g.computeVertexNormals();
    return g;
  }

  // Next-Gen 33-Bone `PogoRig` Instantiation (§3.1.D, scaled 1.32x for heroic ~2.2x close-up presence)
  _buildPogo() {
    this.pogoRig = new PogoRig(this.skinId);
    if (this.pogoRig.bones?.blaster) {
      this.pogoRig.bones.blaster.visible = false;
    }
    this.pogoObj = this.pogoRig.group;
    this.pogoObj.scale.setScalar(POGO_SCALE);
    this.pogoRoot = new THREE.Group();
    this.pogoRoot.add(this.pogoObj);
    this.scene.add(this.pogoRoot);

    // Preallocated Next-Gen `poseState` object (zero per-frame allocations)
    this._pogoState = {
      time: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onElevator: false,
      squashX: 1,
      squashY: 1,
      landImpact: 0,
      muzzleFlash: 0,
      hurtTimer: 0,
      invuln: 0,
      enteringDoor: 0,
      victory: false,
    };
  }

  _buildOverlay() {
    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 390, 0, -620, -10, 10);
    const quad = this._quad;
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
        uFade: { value: 1 },
        uFlash: { value: 0 },
        uFlashCol: { value: new THREE.Color('#fde68a') },
      },
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
          vec3 col = mix(vec3(0.02, 0.03, 0.07), uFlashCol, uFlash * (1.0 - v));
          float a = max(v * 0.6, uFade);
          a = max(a, uFlash * 0.32 * (1.0 - v));
          gl_FragColor = vec4(col * (1.0 - uFade), a);
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

    this._hudCanvas = document.createElement('canvas');
    this._hudTex = new THREE.CanvasTexture(this._hudCanvas);
    this._hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hudPanel = new THREE.Mesh(quad, basic({ map: this._hudTex }));
    this.hudPanel.renderOrder = 5;
    this.overlay.add(this.hudPanel);
    this._hudKey = '';

    // Bespoke vector EXIT chip (drawn chevron stroke — zero unicode arrows or emojis!)
    this.exitChip = new THREE.Mesh(
      quad,
      basic({
        map: canvasTex(196, 64, (ctx) => {
          ctx.fillStyle = 'rgba(8, 14, 30, 0.82)';
          ctx.strokeStyle = 'rgba(217, 169, 78, 0.78)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(4, 6, 188, 52, 26);
          else ctx.rect(4, 6, 188, 52);
          ctx.fill();
          ctx.stroke();
          ctx.font = '800 24px Orbitron, "Arial Black", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText('EXIT', 82, 33);
          ctx.strokeStyle = '#7be8ff';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(132, 26);
          ctx.lineTo(143, 39);
          ctx.lineTo(154, 26);
          ctx.stroke();
        }),
      })
    );
    this.exitChip.renderOrder = 6;
    this.overlay.add(this.exitChip);
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
      // Optional pre-warm
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
    this.U.uGlow.value.set(room.glow || '#5efce8');
    this.glowCol = this.U.uGlow.value;

    this.tileMat.color.copy(this.stoneTint).lerp(this._white, 0.24);
    this.stoneMat.color.copy(this.stoneTint).lerp(this._white, 0.16);
    this.runeStoneMat.color.copy(this.stoneTint).lerp(this._white, 0.22);
    this.plates.material.color.copy(this.stoneTint).multiplyScalar(0.84);
    this.floorMat.color.copy(this.stoneTint).multiplyScalar(0.85);
    this.wallMat.color.copy(this.stoneTint).multiplyScalar(0.95);
    const rng = mulberry32((Number(p.seed) || 7) * 31 + 5);

    for (const ch of [...this.roomGroup.children]) {
      ch.geometry?.dispose();
      this.roomGroup.remove(ch);
    }

    // Submerged cavern flagstone bed + Dark Rippling Subterranean Water Moat
    {
      const g = new THREE.RingGeometry(0, R * 2.5, 72, 12);
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
        let k = 0.35 + 0.45 * (1 - smooth01((r - 0.55) / 0.45));
        k *= 1 - smooth01((r - 0.95) / 0.9) * 0.85;
        col[i * 3] = k;
        col[i * 3 + 1] = k;
        col[i * 3 + 2] = k;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const floor = new THREE.Mesh(g, this.floorMat);
      floor.position.y = -0.68;
      this.roomGroup.add(floor);

      const wg = new THREE.CircleGeometry(R * 1.24, 72);
      wg.rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(wg, this.sanctumWaterMat);
      water.position.y = WATER_Y;
      water.renderOrder = 1;
      this.roomGroup.add(water);
    }

    // Stepped Carved-Slate Sanctum Island Plinth + South Causeway Bridge + Glowing Energy Conduits
    const hx = cols / 2 + 0.24;
    const hz = rows / 2 + 0.24;
    const dx = room.worldX(room.doorX);
    this.U.uIslandHalf.value.set(hx + 0.16, hz + 0.16);
    this.U.uDoorX.value = dx;
    {
      const parts = [];
      const t = 0.24;
      const rimH = 0.12;
      // Stepped monolithic stone island foundation rising out of subterranean water (y = -0.72 .. 0.02)
      parts.push(paint(place(new THREE.BoxGeometry(hx * 2 + 0.52, 0.38, hz * 2 + 0.52), 0, -0.51, 0), 0.38, 0.42, 0.56));
      parts.push(paint(place(new THREE.BoxGeometry(hx * 2 + 0.22, 0.3, hz * 2 + 0.22), 0, -0.19, 0), 0.62, 0.66, 0.8));
      parts.push(paint(place(new THREE.BoxGeometry(cols + 0.08, 0.1, rows + 0.08), 0, -0.1, 0), 0.18, 0.2, 0.3));
      // Raised carved island border curb
      parts.push(place(new THREE.BoxGeometry(hx * 2 + t, rimH, t), 0, -0.01, -hz));
      parts.push(place(new THREE.BoxGeometry(t, rimH, hz * 2 + t), -hx, -0.01, 0));
      parts.push(place(new THREE.BoxGeometry(t, rimH, hz * 2 + t), hx, -0.01, 0));
      const left = dx - 0.54 - -hx;
      const right = hx - (dx + 0.54);
      if (left > 0.05) {
        parts.push(place(new THREE.BoxGeometry(left + t / 2, rimH, t), -hx + left / 2 - t / 4, -0.01, hz));
      }
      if (right > 0.05) {
        parts.push(place(new THREE.BoxGeometry(right + t / 2, rimH, t), hx - right / 2 + t / 4, -0.01, hz));
      }
      // 4 Corner Sanctum Brazier buttress plinths
      this._brazierPos = [];
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const bx = sx * (hx + 0.12);
          const bz = sz * (hz + 0.12);
          parts.push(paint(place(new THREE.BoxGeometry(0.62, 0.72, 0.62), bx, -0.34, bz), 0.72, 0.76, 0.88));
          this._brazierPos.push(new THREE.Vector3(bx, 0.02, bz));
        }
      }
      // North Vault Gate stone conduit causeway spanning across the water moat
      const vaultZ = -hz - 1.58;
      this._vaultZ = vaultZ;
      const nBridgeLen = Math.max(0.6, Math.abs(vaultZ) - hz);
      parts.push(
        paint(
          place(new THREE.BoxGeometry(1.55, 0.56, nBridgeLen + 0.3), 0, -0.28, -hz - nBridgeLen * 0.5),
          0.66,
          0.7,
          0.84
        )
      );
      parts.push(
        paint(place(new THREE.BoxGeometry(4.5, 0.62, 1.35), 0, -0.31, vaultZ - 0.1), 0.64, 0.68, 0.82)
      );
      const plinthMesh = new THREE.Mesh(mergeStd(parts), this.stoneMat);
      plinthMesh.receiveShadow = true;
      plinthMesh.castShadow = true;
      this.roomGroup.add(plinthMesh);

      // South Entrance Stone Causeway Bridge across the flooded moat
      const bridgeLen = Math.max(1.4, R - hz + 0.5);
      const steps = [];
      steps.push(
        paint(
          place(new THREE.BoxGeometry(1.62, 0.52, bridgeLen), dx, -0.32, hz + bridgeLen * 0.5),
          0.7,
          0.74,
          0.86
        )
      );
      for (let k = 0; k < 3; k++) {
        steps.push(place(new THREE.BoxGeometry(1.32 - k * 0.04, 0.12, 0.44), dx, -0.06 - k * 0.06, hz + 0.24 + k * 0.42));
      }
      for (const sx of [-1, 1]) {
        steps.push(paint(place(new THREE.BoxGeometry(0.26, 0.52, 0.32), dx + sx * 0.76, 0.18, hz + 0.1), 0.82, 0.84, 0.92));
        steps.push(paint(place(new THREE.BoxGeometry(0.34, 0.1, 0.4), dx + sx * 0.76, 0.46, hz + 0.1), 0.92, 0.94, 0.98));
        steps.push(
          paint(
            place(new THREE.BoxGeometry(0.16, 0.22, bridgeLen - 0.4), dx + sx * 0.74, -0.02, hz + bridgeLen * 0.5 + 0.2),
            0.76,
            0.8,
            0.9
          )
        );
      }
      const bridgeMesh = new THREE.Mesh(mergeStd(steps), this.stoneMat);
      bridgeMesh.receiveShadow = true;
      this.roomGroup.add(bridgeMesh);
      this._doorX = dx;
      this._doorZ = hz;

      // Place Island Corner Braziers (procedural Frame-0 + GLB sync)
      const bzArr = this.procBraziers.instanceMatrix.array;
      for (let i = 0; i < this._brazierPos.length; i++) {
        const bp = this._brazierPos[i];
        setTRS(bzArr, i, bp.x, 0.02, bp.z, (i * Math.PI) / 2, 0, 0, 1);
      }
      this.procBraziers.count = this._brazierPos.length;
      this.procBraziers.instanceMatrix.needsUpdate = true;
      this.procBraziers.visible = !this._glbPropsReady;

      // Carved Glowing Floor Energy Conduits (South threshold -> West/East island circuit -> North Vault Gate)
      const condVerts = [];
      const condUvs = [];
      const condFlows = [];
      const addConduitSeg = (x0, z0, x1, z1, f0, f1, w = 0.11, y = 0.052) => {
        const vx = x1 - x0;
        const vz = z1 - z0;
        const len = Math.hypot(vx, vz) || 1;
        const nx = (-vz / len) * (w * 0.5);
        const nz = (vx / len) * (w * 0.5);
        condVerts.push(
          x0 - nx, y, z0 - nz,
          x0 + nx, y, z0 + nz,
          x1 + nx, y, z1 + nz,
          x0 - nx, y, z0 - nz,
          x1 + nx, y, z1 + nz,
          x1 - nx, y, z1 - nz
        );
        condUvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
        condFlows.push(f0, f0, f1, f0, f1, f1);
      };
      // Perimeter & central spine conduits leading into the North Vault Gate
      addConduitSeg(dx, hz + 0.05, -hx, hz, 0.0, 0.2);
      addConduitSeg(dx, hz + 0.05, hx, hz, 0.0, 0.2);
      addConduitSeg(-hx, hz, -hx, -hz, 0.2, 0.65);
      addConduitSeg(hx, hz, hx, -hz, 0.2, 0.65);
      addConduitSeg(-hx, -hz, 0, -hz, 0.65, 0.86);
      addConduitSeg(hx, -hz, 0, -hz, 0.65, 0.86);
      addConduitSeg(0, -hz, 0, vaultZ + 0.28, 0.86, 1.0, 0.18, 0.02);
      addConduitSeg(-0.38, -hz, -0.38, vaultZ + 0.28, 0.88, 1.0, 0.09, 0.02);
      addConduitSeg(0.38, -hz, 0.38, vaultZ + 0.28, 0.88, 1.0, 0.09, 0.02);
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(condVerts, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(condUvs, 2));
      cg.setAttribute('aFlow', new THREE.Float32BufferAttribute(condFlows, 1));
      const conduitMesh = new THREE.Mesh(cg, this.conduitMat);
      conduitMesh.renderOrder = 3;
      this.roomGroup.add(conduitMesh);

      // Position the Massive 3D Carved Sanctum Vault Gate dead-center on the North Wall
      this.vaultRoot.position.set(0, -0.02, vaultZ);
      this.vaultDoorGroup.position.set(0, 0, 0);
    }

    // Ashlar indigo-slate lower chamber wall + Recessed Moonlit Barred Clerestory + Ribbed Cathedral Vault + Hanging Chains
    const gap = 62 * DEG;
    const lowerWallH = 2.86;
    const clerestoryAngles = [Math.PI - 0.88, Math.PI - 0.48, Math.PI + 0.46, Math.PI + 0.88];
    const colAngles = [];
    const nCol = 9;
    for (let i = 0; i < nCol; i++) {
      colAngles.push(gap + 0.12 + ((TAU - gap * 2 - 0.24) * i) / (nCol - 1));
    }
    this._clerestoryGlowPos = [];
    for (let i = 0; i < clerestoryAngles.length; i++) {
      const ca = clerestoryAngles[i];
      this._clerestoryGlowPos.push(new THREE.Vector3(Math.sin(ca) * (R + 0.42), 3.78, Math.cos(ca) * (R + 0.42)));
    }
    {
      const g = new THREE.CylinderGeometry(R + 0.35, R + 0.35, lowerWallH, 72, 4, true, gap, TAU - gap * 2);
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      const col = new Float32Array(pos.count * 3);
      const rep = Math.round(((R + 0.35) * TAU) / 3.2);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) + lowerWallH / 2;
        uv.setXY(i, uv.getX(i) * rep * ((TAU - gap * 2) / TAU), y / 3.2);
        const k = (0.48 + 0.52 * (1 - smooth01((y - 1.8) / 2.2))) * (0.68 + 0.32 * smooth01(y / 0.8));
        col[i * 3] = k;
        col[i * 3 + 1] = k;
        col[i * 3 + 2] = k;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.translate(0, lowerWallH / 2 - 0.06, 0);
      const wallMesh = new THREE.Mesh(g, this.wallMat);
      wallMesh.receiveShadow = true;
      this.roomGroup.add(wallMesh);

      // Deep exterior moonlit storm-cavern backdrop behind the recessed clerestory arches (`R + 1.76`)
      const skyShellGeo = new THREE.CylinderGeometry(R + 1.76, R + 1.76, 3.35, 56, 1, true, gap, TAU - gap * 2);
      skyShellGeo.translate(0, 4.35, 0);
      const skyShellMesh = new THREE.Mesh(skyShellGeo, this.clerestoryDepthMat);
      this.roomGroup.add(skyShellMesh);

      // Vaulted Cathedral Stone Ribs, Triforium Cornice & Recessed Clerestory Piers (`1` merged stoneMat draw call)
      const cathStoneMesh = new THREE.Mesh(
        buildCathedralUpperStoneGeo(R, gap, colAngles, clerestoryAngles),
        this.stoneMat
      );
      cathStoneMesh.receiveShadow = true;
      this.roomGroup.add(cathStoneMesh);

      // Barred Wrought-Iron Clerestory Grilles + 6 Hanging Link-by-Link Sanctum Chains (`1` merged ironMat draw call)
      const cathIronMesh = new THREE.Mesh(
        buildCathedralIronworkGeo(R, this._vaultZ || -hz - 1.58, clerestoryAngles),
        this.ironMat
      );
      cathIronMesh.castShadow = true;
      cathIronMesh.receiveShadow = true;
      this.roomGroup.add(cathIronMesh);

      const bg = new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.38, 96, 1, true, gap, TAU - gap * 2);
      bg.translate(0, 2.35, 0);
      const band = new THREE.Mesh(bg, this.bandRuneMat);
      band.renderOrder = 3;
      this.roomGroup.add(band);

      const lg = new THREE.CylinderGeometry(R + 0.18, R + 0.18, 0.12, 72, 1, true, gap, TAU - gap * 2);
      lg.translate(0, 2.08, 0);
      this.ledgeMat.color.copy(this.stoneTint).multiplyScalar(0.68);
      this.roomGroup.add(new THREE.Mesh(lg, this.ledgeMat));
    }

    // Engaged stone columns + wrought-iron wall sconces
    const carr = this.columns.instanceMatrix.array;
    for (let i = 0; i < colAngles.length; i++) {
      const a = colAngles[i];
      setTRS(carr, i, Math.sin(a) * (R + 0.08), -0.06, Math.cos(a) * (R + 0.08), a, 0, 0, 1, 0.65, 1);
      this._c.copy(this._white).multiplyScalar(0.84 + rng() * 0.2);
      this.columns.setColorAt(i, this._c);
    }
    this.columns.count = colAngles.length;
    this.columns.instanceMatrix.needsUpdate = true;
    this.columns.instanceColor.needsUpdate = true;

    const tAng = [Math.PI - 0.62, Math.PI + 0.62, Math.PI / 2 + 0.05, -Math.PI / 2 - 0.05];
    this._torchPos = [];
    const sarr = this.sconces.instanceMatrix.array;
    for (let i = 0; i < tAng.length; i++) {
      const a = tAng[i];
      const r = R + 0.05;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      setTRS(sarr, i, x - Math.sin(a) * 0.25, 2.0, z - Math.cos(a) * 0.25, a + Math.PI, 0, 0, 1);
      this._torchPos.push(new THREE.Vector3(x - Math.sin(a) * 0.35, 2.12, z - Math.cos(a) * 0.35));
    }
    this.sconces.count = tAng.length;
    this.sconces.instanceMatrix.needsUpdate = true;
    this.torchL.position.copy(this._torchPos[0]).add(this._v.set(0, 0.3, 0.3));
    this.torchR.position.copy(this._torchPos[1]).add(this._v.set(0, 0.3, 0.3));
    this.U.uTorchP.value[0].copy(this._torchPos[0]);
    this.U.uTorchP.value[1].copy(this._torchPos[1]);

    // Populate all 8 rising-ember fire anchors (4 island corner braziers + 4 iron wall sconces)
    {
      const anchors = this.U.uFireAnchors.value;
      let ai = 0;
      for (let i = 0; i < this._brazierPos.length && ai < 8; i++) {
        anchors[ai++].set(this._brazierPos[i].x, 0.88, this._brazierPos[i].z);
      }
      for (let i = 0; i < this._torchPos.length && ai < 8; i++) {
        anchors[ai++].set(this._torchPos[i].x, this._torchPos[i].y + 0.14, this._torchPos[i].z);
      }
      this.U.uFireCount.value = ai;
    }

    // Moonlit barred clerestory bay (`Math.PI + 0.46`) + dusty silver-blue volumetric shaft
    {
      const a = Math.PI + 0.46;
      const wx = Math.sin(a) * (R + 0.42);
      const wz = Math.cos(a) * (R + 0.42);
      this.windowMesh.visible = false;
      this.windowMesh.position.set(wx, 4.15, wz);
      this.windowMesh.rotation.set(0, a + Math.PI, 0);
      const A = new THREE.Vector3(wx * 0.97, 4.18, wz * 0.97);
      const B = new THREE.Vector3(room.worldX(cols * 0.62), 0, room.worldZ(rows * 0.45));
      this._shaftFloor = B;
      this.U.uShaftA.value.copy(A);
      this.U.uShaftB.value.copy(B);
      this.windowLight.position.copy(A).add(A.clone().sub(B).multiplyScalar(2));
      this.windowLight.target.position.copy(B);
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

    this._tileCount = cols * rows;
    for (let i = 0; i < this._tileCount; i++) {
      this._tileRot[i] = Math.floor(rng() * 4);
      this._tileTint[i] = 0.84 + rng() * 0.22;
      this._tileGlyph[i] = Math.floor(rng() * 16);
      this._flips[i] = 0;
      this._flipSeen[i] = -1e9;
    }

    // Angle Hint Stele on the North-West plinth so the central 3D Sanctum Vault Gate stands unobstructed
    const steleX = -Math.max(2.15, cols * 0.46);
    const steleZ = room.worldZ(0) - 0.95;
    this.stele.visible = p.type !== 'beam';
    this.stele.position.set(steleX, -0.04, steleZ);
    this.stele.rotation.set(0, 0.34, 0);
    const initShow = p.showTarget !== false || room.solved ? 1.0 : clamp(room.peekAlpha ?? 0, 0, 1);
    this._lastMuralShow = -1;
    this._drawMural(room, initShow);

    const t = p.type;
    const vis = (o, on) => {
      o.visible = on;
    };
    vis(this.bellFrames, t === 'bells' && !this._glbPropsReady);
    vis(this.bellBodies, t === 'bells' && !this._glbPropsReady);
    vis(this.bellBands, t === 'bells' && !this._glbPropsReady);
    vis(this.pennants, t === 'bells');
    vis(this.mirrorFrames, t === 'beam' && !this._glbPropsReady);
    vis(this.mirrorFaces, t === 'beam' && !this._glbPropsReady);
    vis(this.beamCore, t === 'beam');
    vis(this.beamGlow, t === 'beam');
    vis(this.beamHalo, t === 'beam');
    vis(this.emitter, t === 'beam');
    vis(this.crystal, t === 'beam');
    vis(this.blocks, t === 'blocks' && !this._glbPropsReady);
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
      this.emitter.rotation.set(0, Math.atan2(sdx, sdy), 0);
      this.crystal.position.set(room.worldX(room.crystal.x), -0.06, room.worldZ(room.crystal.y));
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
    this._pogoYaw = Math.PI; // Facing North into the chamber on entry
    this._crystalBloom = 0;
    this._solveFlash = 0;
    this._conduitSurge = 0;
    this._syncGlbRoomProps(room);
  }

  _drawMural(room, effectiveShowInput = undefined) {
    const p = room.puzzle;
    const effectiveShow =
      effectiveShowInput !== undefined
        ? clamp(effectiveShowInput, 0, 1)
        : p.showTarget !== false || room.solved
          ? 1.0
          : clamp(room.peekAlpha ?? 0, 0, 1);
    this._lastMuralShow = effectiveShow;
    const c = this.muralCanvas;
    const ctx = c.getContext('2d');
    const gc = this.muralGlowCanvas.getContext('2d');
    const W = c.width;
    const H = c.height;
    const glow = '#' + this.glowCol.getHexString();
    ctx.fillStyle = '#3b4066';
    ctx.fillRect(0, 0, W, H);
    blotches(ctx, W, H, mulberry32(12), 30, 10, 60, 0.18, false);
    ctx.strokeStyle = 'rgba(10,12,26,0.68)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.strokeStyle = 'rgba(195,216,255,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    gc.fillStyle = '#000';
    gc.fillRect(0, 0, W, H);
    const carve = (draw) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(10,12,26,0.72)';
      ctx.fillStyle = 'rgba(10,12,26,0.62)';
      draw(ctx);
      ctx.restore();
    };
    this._sockets = null;
    if (p.type === 'lights') {
      const n = p.n;
      const cell = Math.min(W - 60, H - 90) / n;
      const ox = (W - cell * n) / 2;
      const oy = 34;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = p.target[y * n + x];
          const cx = ox + (x + 0.5) * cell;
          const cy = oy + (y + 0.5) * cell;
          // Weathered carved recessed rune socket ALWAYS visible (>= 0.18 alpha even when peekAlpha === 0)
          carve((k) => {
            k.lineWidth = 4.2;
            k.beginPath();
            k.arc(cx, cy, cell * 0.36, 0, TAU);
            k.stroke();
            k.beginPath();
            k.arc(cx, cy, cell * 0.28, 0, TAU);
            k.fill();
          });
          ctx.save();
          ctx.strokeStyle = 'rgba(195, 224, 255, 0.20)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy, cell * 0.32, 0, TAU);
          ctx.stroke();
          drawRune(ctx, mulberry32(4100 + (y * n + x) * 97), cx, cy, cell * 0.34);
          ctx.restore();

          gc.save();
          gc.globalAlpha = 0.18;
          gc.strokeStyle = glow;
          gc.lineWidth = 1.8;
          gc.beginPath();
          gc.arc(cx, cy, cell * 0.33, 0, TAU);
          gc.stroke();
          gc.restore();

          if (on && effectiveShow > 0.01) {
            gc.save();
            gc.globalAlpha = effectiveShow;
            const g = gc.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.43);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.38, glow);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            gc.fillStyle = g;
            gc.beginPath();
            gc.arc(cx, cy, cell * 0.43, 0, TAU);
            gc.fill();
            gc.restore();

            ctx.save();
            ctx.globalAlpha = effectiveShow;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, cell * 0.26, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.0;
            drawRune(ctx, mulberry32(4100 + (y * n + x) * 97), cx, cy, cell * 0.34);
            ctx.restore();
          } else if (!on) {
            carve((k) => {
              k.beginPath();
              k.arc(cx, cy, cell * 0.11, 0, TAU);
              k.fill();
            });
          }
        }
      }
      carve((k) => {
        k.lineWidth = 3;
        k.beginPath();
        k.moveTo(40, H - 46);
        k.lineTo(W - 40, H - 46);
        k.stroke();
      });
    } else if (p.type === 'bells') {
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
      ctx.strokeStyle = 'rgba(217, 185, 118, 0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 44, 168);
      ctx.quadraticCurveTo(W / 2 - 38, 82, W / 2, 72);
      ctx.quadraticCurveTo(W / 2 + 38, 82, W / 2 + 44, 168);
      ctx.stroke();

      const n = p.order.length;
      const sp = Math.min(40, (W - 60) / n);
      const sockets = [];
      for (let i = 0; i < n; i++) {
        const cx = W / 2 + (i - (n - 1) / 2) * sp;
        const cy = 250;
        // Carved recessed socket + faint 0.20 rim ALWAYS visible even when peekAlpha === 0
        carve((k) => {
          k.lineWidth = 4;
          k.beginPath();
          k.arc(cx, cy, 13, 0, TAU);
          k.stroke();
          k.beginPath();
          k.arc(cx, cy, 7, 0, TAU);
          k.fill();
        });
        ctx.strokeStyle = 'rgba(195, 224, 255, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, TAU);
        ctx.stroke();

        gc.save();
        gc.globalAlpha = 0.18;
        gc.strokeStyle = glow;
        gc.lineWidth = 1.6;
        gc.beginPath();
        gc.arc(cx, cy, 12, 0, TAU);
        gc.stroke();
        gc.restore();

        if (effectiveShow > 0.01 && p.bells && p.bells[p.order[i]]) {
          const tCol = BELL_COLORS[p.bells[p.order[i]].color] || glow;
          ctx.save();
          ctx.globalAlpha = effectiveShow;
          ctx.fillStyle = tCol;
          ctx.beginPath();
          ctx.arc(cx, cy, 7.5, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = tCol;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 12.5, 0, TAU);
          ctx.stroke();
          ctx.restore();

          gc.save();
          gc.globalAlpha = effectiveShow;
          gc.fillStyle = tCol;
          gc.beginPath();
          gc.arc(cx, cy, 6.5, 0, TAU);
          gc.fill();
          gc.strokeStyle = tCol;
          gc.lineWidth = 4;
          gc.beginPath();
          gc.arc(cx, cy, 12.5, 0, TAU);
          gc.stroke();
          gc.restore();
        }
        sockets.push([cx / W, cy / H]);
      }
      this._sockets = sockets;
    } else {
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
      gc.globalAlpha = 0.55;
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

  resize(width, height, dpr = 1) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this._dpr = Number(dpr) || 1;
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
  render(roomOrState, ctx = {}) {
    let room = roomOrState;
    let opts = ctx || {};
    if (room && !room.puzzle && (room.puzzleRoom || room.room)) {
      opts = room;
      room = room.puzzleRoom || room.room;
    }
    if (!room || !room.puzzle) return;

    if (opts.era && opts.era !== this.era) {
      this.setEra(opts.era);
    }
    if (opts.player?.skinId && opts.player.skinId !== this.skinId) {
      this.setSkin(opts.player.skinId);
    }

    const time = opts.time ?? room.t ?? 0;
    const particles = opts.particles ?? null;
    const popups = opts.popups ?? null;
    const shake = opts.shake ?? 0;

    const gl = this.gl;
    const dt = this._lastTime === null ? 1 / 60 : clamp(time - this._lastTime, 0, 0.05);
    this._lastTime = time;
    if (room.puzzle !== this._puzzleRef || room !== this._roomRef || (room.t || 0) < (this._lastRoomT || 0)) {
      this._setupRoom(room);
    }
    this._lastRoomT = room.t || 0;
    this._kx = room.width ? this.width / room.width : 1;
    this._ky = room.height ? this.height / room.height : 1;
    const U = this.U;
    U.uTime.value = time;
    const pr = gl.getPixelRatio ? gl.getPixelRatio() : this._dpr;
    U.uPx.value = (this.height * pr) / (2 * Math.tan((this.camera.fov * DEG) / 2));

    this._syncMapCam(room);
    const mag =
      (Number(typeof shake === 'object' ? Math.hypot(shake.x || 0, shake.y || 0) : shake) || 0) * 0.006;
    this._updateCamera(room, time, dt, mag);

    this._consumeVfx(room);
    this.fxLight.intensity = 0;
    this.flames.begin();
    this.glows.begin();
    this.stars.begin();
    this.fglows.begin();
    this.shades.begin();
    this.rings.begin();
    this._updateTorches(room, time);
    this._updateSanctum(room, time, dt);
    this._updateTiles(room);
    this._updateDoor(room, time);
    if (room.type === 'bells') this._updateBells(room, time);
    else if (room.type === 'beam') this._updateBeam(room, time, dt);
    else if (room.type === 'blocks') this._updateBlocks(room, time);
    this._updateStele(room, time);
    this._updatePogo(room, time, dt);
    this._updateReward(room, time);
    this._updateRings(time);
    this.flames.end();
    this.glows.end();
    this.stars.end();
    this.fglows.end();
    this.shades.end();
    this.rings.end();
    this.ringAttr.needsUpdate = true;

    this._popFrame++;
    this._updateFxGroup();
    this._drawHud(room);
    this._updateExitChip(room, time);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, room);
    this.vigMat.uniforms.uFade.value = clamp(room.fade ?? 0, 0, 1);
    this._solveFlash = Math.max(0, this._solveFlash - dt * 2.2);
    this.vigMat.uniforms.uFlash.value = this._solveFlash;

    // Strict WebGL state save & restore (`shadowMap`, `setRenderTarget(null)`, `autoClear`, `toneMapping`, `toneMappingExposure`)
    const prevRenderTarget = gl.getRenderTarget ? gl.getRenderTarget() : null;
    const prevAutoClear = gl.autoClear;
    const prevToneMapping = gl.toneMapping;
    const prevExposure = gl.toneMappingExposure;
    const hasSM = !!gl.shadowMap;
    const prevShadowEnabled = hasSM ? gl.shadowMap.enabled : false;
    const prevShadowType = hasSM ? gl.shadowMap.type : 0;
    const prevShadowAuto = hasSM ? gl.shadowMap.autoUpdate : true;
    try {
      if (gl.setRenderTarget) gl.setRenderTarget(null);
      if (hasSM) {
        gl.shadowMap.enabled = this.era !== 'original';
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.shadowMap.autoUpdate = true;
      }
      this.windowLight.castShadow = this.era !== 'original';
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = this.exposure;
      gl.autoClear = true;
      gl.render(this.scene, this.camera);
      gl.autoClear = false;
      gl.clearDepth();
      gl.render(this.overlay, this.oCam);
    } finally {
      if (gl.setRenderTarget) gl.setRenderTarget(prevRenderTarget);
      if (hasSM) {
        gl.shadowMap.enabled = prevShadowEnabled;
        gl.shadowMap.type = prevShadowType;
        gl.shadowMap.autoUpdate = prevShadowAuto;
      }
      gl.autoClear = prevAutoClear;
      gl.toneMapping = prevToneMapping;
      gl.toneMappingExposure = prevExposure;
    }
  }

  _updateCamera(room, time, dt, mag) {
    const v = room.view;
    const cam = this.camera;
    const ph = room.phase;
    const kIn = ph === 'intro' ? 1 - smooth01(room.phaseT / INTRO_T) : 0;
    const kSolve =
      room.solved && room.rewardT >= 0
        ? smooth01((room.t - room.rewardT) / 1.6) * (ph === 'leaving' ? 0.6 : 1)
        : 0;
    const kLeave = ph === 'leaving' || ph === 'done' ? smooth01(room.fade || 0) : 0;
    const dX = Math.sin(time * 0.23) * 0.07 + Math.sin(time * 0.61) * 0.02;
    const dY = Math.cos(time * 0.19) * 0.05;
    const ex = v.eye[0] + dX;
    let ey = v.eye[1] + dY - kIn * kIn * 1.6 - kSolve * 0.5;
    let ez = v.eye[2] + kIn * kIn * 2.4 - kSolve * 0.6;
    const tx = v.target[0] + dX * 0.4;
    let ty = v.target[1] + kSolve * 0.35;
    let tz = v.target[2] + kIn * kIn * 0.9;
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
    void dt;
  }

  _updateFxGroup() {
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
    this.fxGroup.scale.set(sx, sy, 1);
    this.fxGroup.position.set(qax - pax * sx, -(qay - pay * sy), 0);
  }

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

  _consumeVfx(room) {
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
        for (let k = 0; k < 3; k++) {
          this._ring(x, 1.1, z, 0.25, 1.8 + k * 0.5, 1.1 + k * 0.15, col, false, k * 0.16);
        }
        this._ring(x, 0.03, z, 0.3, 2.2, 1.3, col, true);
      } else if (e.kind === 'wrong') {
        this._c.set('#fb7185');
        this._ring(x, 1.1, z, 0.2, 1.2, 0.9, this._c, false);
        this._ring(x, 0.03, z, 0.3, 1.4, 1.0, this._c, true);
      } else if (e.kind === 'stomp') {
        this._ring(x, 0.05, z, 0.2, 1.7, 0.6, e.a ? this.glowCol : this._c.set('#64748b'), true);
      } else if (e.kind === 'hopland' || e.kind === 'bump') {
        this._ring(x, 0.04, z, 0.1, 0.7, 0.35, this._c.set('#475569'), true);
      } else if (e.kind === 'plate') {
        this._ring(x, 0.06, z, 0.3, 2.0, 0.9, this.glowCol, true);
        this._ring(x, 0.9, z, 0.2, 1.3, 0.7, this.glowCol, false);
      } else if (e.kind === 'push' || e.kind === 'undo') {
        this._ring(x, 0.04, z, 0.2, 1.0, 0.45, this._c.set('#64748b'), true);
      } else if (e.kind === 'rotate') {
        this._ring(x, 0.06, z, 0.2, 1.1, 0.5, this._c.set('#ffcf7a'), true);
      } else if (e.kind === 'crystal') {
        this._crystalBloom = 1;
        for (let k = 0; k < 3; k++) {
          this._ring(x, 1.1, z, 0.3, 2.6 + k, 1.2, this.glowCol, false, k * 0.12);
        }
      } else if (e.kind === 'solve') {
        this._solveFlash = 0.75;
        this._conduitSurge = 1.0;
        for (let k = 0; k < 4; k++) {
          this._ring(0, 0.05, 0, 0.5, 4 + k * 1.2, 1.6, k % 2 ? this._gold : this.glowCol, true, k * 0.18);
        }
      } else if (e.kind === 'conduit_surge') {
        this._conduitSurge = Math.max(this._conduitSurge, 0.85);
      } else if (e.kind === 'prism_bounce') {
        this._conduitSurge = Math.max(this._conduitSurge, 0.55);
        this._ring(x, BEAM_Y, z, 0.15, 0.95, 0.45, this.glowCol, false);
      } else if (e.kind === 'gate_open') {
        this._conduitSurge = 1.0;
        this._ring(0, 0.25, this._vaultZ || -3.6, 0.4, 3.2, 1.2, this._gold, false);
      } else if (e.kind === 'collect') {
        this._ring(x, 0.9, z, 0.2, 1.5, 0.6, this._gold, false);
      }
    }
  }

  _updateSanctum(room, time, dt) {
    const prog = clamp(room.progressRatio ?? (room.solved ? 1 : 0), 0, 1);
    const gateOpen = clamp(room.gateOpen ?? (room.solved ? 1 : 0), 0, 1);
    this._conduitSurge = Math.max(0, (this._conduitSurge || 0) - dt * 2.2);
    this.U.uProgress.value = prog;
    this.U.uConduitSurge.value = this._conduitSurge;
    this.U.uGateOpen.value = gateOpen;

    // Physically grind the Massive 3D Carved Sanctum Vault Gate upward + spin interlocking bronze cogwheels
    const grinding = gateOpen > 0.01 && gateOpen < 0.99;
    const grindJit = grinding ? Math.sin(time * 52.0) * 0.022 : 0;
    this.vaultDoorGroup.position.set(grindJit, gateOpen * 2.48, 0);
    const gearAng = gateOpen * TAU * 2.25;
    this.vaultGearL.rotation.z = gearAng;
    this.vaultGearR.rotation.z = -gearAng;

    const vz = this._vaultZ || -3.6;
    if (gateOpen > 0.02) {
      const k = gateOpen;
      this.glows.bill(0, 1.35, vz + 0.15, 3.2 * k + 0.6, 3.4 * k + 0.6, 0, 0.42 * k, 0.36 * k, 0.14 * k);
      this.fglows.flat(0, 0.03, vz + 1.1, 2.8 * k + 0.6, 2.4 * k + 0.5, 0, 0.24 * k, 0.2 * k, 0.08 * k);
      if (grinding) {
        for (let i = -1; i <= 1; i++) {
          this.glows.bill(
            i * 0.85 + Math.sin(time * 19 + i) * 0.12,
            0.22 + ((time * 1.7 + i * 0.37) % 1) * 1.4,
            vz + 0.28,
            0.35,
            0.35,
            0,
            0.32,
            0.28,
            0.18
          );
        }
      }
    }

    // Island Corner Sanctum Braziers (3-layer volumetric FBM fire + warm amber water/stone reflections)
    const tc = this.U.uTorch.value;
    for (let i = 0; i < this._brazierPos.length; i++) {
      const bp = this._brazierPos[i];
      const fl = 0.84 + 0.11 * Math.sin(time * 14.3 + i * 2.7) + 0.07 * Math.cos(time * 22.1 + i * 4.1);
      const sway = Math.sin(time * 3.8 + i * 1.7) * 0.08;
    // Layer 0: wide outer roaring crimson-amber flame; Layer 1: mid dancing golden tongue; Layer 2: white-gold plasma core
      this.flames.bill(bp.x, 0.83, bp.z, 0.56 * fl, 0.88 * fl, sway, ((i * 3 + 1) * 0.19) % 1, 0.0, 1.08);
      this.flames.bill(bp.x + sway * 0.18, 0.85, bp.z, 0.40 * fl, 0.72 * fl, -sway * 1.2, ((i * 3 + 2) * 0.27) % 1, 0.5, 1.18);
      this.flames.bill(bp.x, 0.83, bp.z, 0.25 * fl, 0.48 * fl, sway * 0.6, ((i * 3 + 3) * 0.33) % 1, 1.0, 1.28);
      this.glows.bill(bp.x, 1.08, bp.z, 1.45 * fl, 1.45 * fl, 0, tc.r * 0.28, tc.g * 0.22, tc.b * 0.1);
      this.fglows.flat(bp.x, 0.03, bp.z, 1.55 * fl, 1.55 * fl, 0, tc.r * 0.18, tc.g * 0.13, tc.b * 0.05);
      if (this._glbPropsReady && this.glbBrazierPool[i]) {
        for (const m of this.glbBrazierPool[i].fireMats) {
          m.emissiveIntensity = 1.15 + fl * 0.55 + (room.solved ? 0.35 : 0);
        }
      }
    }

    // Drifting Atmospheric Subterranean Moat Mist hovering above the dark caustic water ring
    if (this.moatMistMesh) {
      const mArr = this.moatMistMesh.instanceMatrix.array;
      const hx = this.U.uIslandHalf.value.x;
      const hz = this.U.uIslandHalf.value.y;
      const R = room.radius || 5;
      const midR = lerp(Math.max(hx, hz) + 0.65, R - 0.35, 0.52);
      for (let i = 0; i < MAX_MOAT_MIST; i++) {
        const baseA = (i / MAX_MOAT_MIST) * TAU + time * (i % 2 === 0 ? 0.055 : -0.042);
        const rad = midR + Math.sin(time * 0.35 + i * 2.1) * 0.45;
        const mx = Math.sin(baseA) * rad;
        const mz = Math.cos(baseA) * rad;
        const my = WATER_Y + 0.14 + (i % 3) * 0.08 + Math.sin(time * 0.6 + i) * 0.03;
        const ms = 2.25 + (i % 3) * 0.55;
        setTRS(mArr, i, mx, my, mz, baseA * 0.5, 0, 0, ms, 1, ms * 0.82);
        const warmNear = (i % 2 === 0 ? 0.65 : 0.35);
        this._c.setRGB(0.85 + 0.15 * Math.sin(time * 0.8 + i), warmNear, 1);
        this.moatMistMesh.setColorAt(i, this._c);
      }
      this.moatMistMesh.count = MAX_MOAT_MIST;
      this.moatMistMesh.instanceMatrix.needsUpdate = true;
      if (this.moatMistMesh.instanceColor) this.moatMistMesh.instanceColor.needsUpdate = true;
    }
  }

  _updateTorches(room, time) {
    const tp = this._torchPos;
    let f0 = 0;
    for (let i = 0; i < tp.length; i++) {
      const p = tp[i];
      const fl =
        0.82 +
        0.1 * Math.sin(time * 13.1 + i * 2.1) +
        0.08 * Math.sin(time * 23.7 + i * 5.3) +
        0.06 * Math.sin(time * 7.3 + i);
      if (i === 0) f0 = fl;
      const sway = Math.sin(time * 3.2 + i) * 0.06;
      this.flames.bill(p.x, p.y, p.z, 0.42 * fl, 0.72 * (0.9 + 0.1 * fl), sway, (i * 0.27) % 1, 0.0, 0.92);
      this.flames.bill(p.x, p.y + 0.02, p.z, 0.30 * fl, 0.56 * fl, -sway * 1.1, ((i + 3) * 0.31) % 1, 0.5, 1.02);
      this.flames.bill(p.x, p.y, p.z, 0.18 * fl, 0.36 * fl, sway * 0.5, ((i + 5) * 0.17) % 1, 1.0, 1.12);
      const tc = this.U.uTorch.value;
      this.glows.bill(p.x, p.y + 0.2, p.z, 1.7 * fl, 1.7 * fl, 0, tc.r * 0.3, tc.g * 0.3, tc.b * 0.3);
      this.glows.bill(p.x, p.y + 0.12, p.z, 0.6, 0.6, 0, 0.9 * fl, 0.65 * fl, 0.3 * fl);
      const dx = this.camera.position.x - p.x;
      const dz = this.camera.position.z - p.z;
      const rot = Math.atan2(dx, dz);
      const len = 3.2;
      this.fglows.flat(
        p.x + Math.sin(rot) * len * 0.42,
        -0.03,
        p.z + Math.cos(rot) * len * 0.42,
        0.7 * fl,
        len,
        rot,
        tc.r * 0.28 * fl,
        tc.g * 0.22 * fl,
        tc.b * 0.14 * fl
      );
      this.fglows.flat(
        p.x + Math.sin(rot) * len * 0.3,
        -0.025,
        p.z + Math.cos(rot) * len * 0.3,
        0.22 * fl,
        len * 0.7,
        rot,
        tc.r * 0.32 * fl,
        tc.g * 0.28 * fl,
        tc.b * 0.18 * fl
      );
      this.fglows.flat(p.x * 0.9, -0.03, p.z * 0.9, 2.6, 2.6, 0, tc.r * 0.07, tc.g * 0.05, tc.b * 0.03);
    }
    const f1 = 0.82 + 0.1 * Math.sin(time * 12.3 + 7.1) + 0.08 * Math.sin(time * 21.9 + 3.3);
    const solvedBoost = room.solved ? 1.15 : 1;
    this.torchL.intensity = 14.5 * f0 * solvedBoost;
    this.torchR.intensity = 14.5 * f1 * solvedBoost;

    const B = this._shaftFloor;
    this.fglows.flat(B.x, 0.03, B.z, 2.3, 1.6, 0.5, 0.14, 0.19, 0.28);
    // Luminous silver-blue moonlight mist inside all 4 recessed barred clerestory arches + upper vault haze
    if (this._clerestoryGlowPos) {
      for (let i = 0; i < this._clerestoryGlowPos.length; i++) {
        const cp = this._clerestoryGlowPos[i];
        const primary = i === 2 ? 1.45 : 0.92;
        const drift = 0.88 + 0.12 * Math.sin(time * 0.9 + i * 1.7);
        this.glows.bill(cp.x, cp.y, cp.z, 2.2 * drift, 2.5 * drift, 0, 0.11 * primary, 0.17 * primary, 0.28 * primary);
        this.glows.bill(cp.x * 0.76, cp.y + 0.85, cp.z * 0.76, 3.1, 1.6, 0, 0.045, 0.075, 0.14);
      }
    }
    const solvedK = room.rewardT >= 0 ? clamp((room.t - room.rewardT) / 0.8, 0, 1) : 0;
    this.U.uBand.value = 0.55 + 0.25 * Math.sin(time * 0.7) * 0.5 + solvedK * 0.55;
    this.U.uSolved.value = room.solved ? 1 : 0;
  }

  _updateTiles(room) {
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
        const ry = this._tileRot[i] * (Math.PI / 2);
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
            if (lit > 0.5) {
              this.fglows.flat(
                wx,
                0.05,
                wz,
                1.25,
                1.25,
                0,
                this.glowCol.r * (0.1 + flash * 0.28),
                this.glowCol.g * (0.1 + flash * 0.28),
                this.glowCol.b * (0.1 + flash * 0.28)
              );
            }
            if (flash > 0.05) {
              this.glows.bill(
                wx,
                0.25 + lift,
                wz,
                1.1 * flash + 0.3,
                1.1 * flash + 0.3,
                0,
                this.glowCol.r * flash * 0.48,
                this.glowCol.g * flash * 0.48,
                this.glowCol.b * flash * 0.48
              );
            }
          }
        }
        if (x === room.doorX && y === rows - 1) glyph = -1;
        tint.copy(this._white).multiplyScalar(this._tileTint[i] * (lights && strength ? 1.0 : 0.92));
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
      this.fxLight.intensity = 1.4 + litN * 0.42;
    }
    this.tiles.instanceMatrix.needsUpdate = true;
    this.tiles.instanceColor.needsUpdate = true;
    this.tileAttr.needsUpdate = true;
  }

  _updateDoor(room, time) {
    const po = room.pogo;
    const onEntrance =
      po.x === room.doorX &&
      po.y === room.rows - 1 &&
      !po.moving &&
      (room.phase === 'play' || room.phase === 'solved');
    this._onEntrance = onEntrance;
    const pulse = 0.55 + 0.45 * Math.sin(time * 4);
    const k = onEntrance ? 1 : 0.35;
    const g = this.glowCol;
    this.exitMat.color.setRGB(
      g.r * (0.6 + pulse * 0.8) * k,
      g.g * (0.6 + pulse * 0.8) * k,
      g.b * (0.6 + pulse * 0.8) * k
    );
    this.exitMark.position.set(this._doorX, -0.01, this._doorZ + 0.32);
    this.exitMark.scale.set(0.7, 1, 0.7);
    this.fglows.flat(this._doorX, 0.02, this._doorZ + 0.1, 2.0, 1.8, 0, 0.12, 0.18, 0.28);
    this.fglows.flat(this._doorX, -0.2, this._doorZ + 0.8, 1.6, 1.4, 0, 0.1, 0.16, 0.25);
    this.glows.bill(this._doorX, 0.3, this._doorZ + 1.0, 2.2, 1.2, 0, 0.05, 0.08, 0.13);
    for (const sx of [-1, 1]) {
      const x = this._doorX + sx * 0.74;
      this.glows.bill(
        x,
        0.62,
        this._doorZ + 0.08,
        0.5 + pulse * 0.15 * k,
        0.5 + pulse * 0.15 * k,
        0,
        g.r * 0.5 * (0.4 + k),
        g.g * 0.5 * (0.4 + k),
        g.b * 0.5 * (0.4 + k)
      );
    }
  }

  _updateBells(room, time) {
    const barr = this.bellBodies.instanceMatrix.array;
    const garr = this.gems.instanceMatrix.array;
    let gi = (this.gems.count = 0);
    const penArr = this.pennants.instanceMatrix.array;
    for (let i = 0; i < room.bells.length; i++) {
      const b = room.bells[i];
      const x = room.worldX(b.x);
      const z = room.worldZ(b.y);
      const since = room.t - b.ringAt;
      const wrongSince = room.t - b.wrongAt;
      const wob =
        wrongSince >= 0 && wrongSince < 0.8
          ? Math.sin(wrongSince * 30) * 0.08 * (1 - wrongSince / 0.8)
          : 0;
      const size = 1.3 - (b.note / 9) * 0.3;
      setTRS(barr, i, x, 1.62, z, 0, b.swing, wob, size);
      const col = this._bellCols[b.color];
      const flash = since >= 0 && since < 1.5 ? Math.exp(-since * 2.6) : 0;
      const hint = room.hintBell === i ? 0.5 + 0.5 * Math.sin(time * 5) : 0;
      if (this._glbPropsReady && this.glbBellPool[i]) {
        const slot = this.glbBellPool[i];
        slot.root.visible = true;
        slot.root.position.set(x, 0.08, z);
        if (slot.body) {
          slot.body.rotation.set(b.swing, 0, wob);
          slot.body.scale.setScalar(0.92 + (size - 1.0) * 0.45);
        }
        for (const m of slot.runeMats) {
          m.emissiveIntensity = 0.48 + flash * 1.35 + hint * 0.85;
        }
      }
      this._c.copy(col).multiplyScalar(0.75 + flash * 1.5 + hint * 0.8);
      this.bellBands.setColorAt(i, this._c);
      setTRS(garr, gi, x, 1.86, z, time * 0.8 + i, 0, 0, 1 + flash * 0.4, 1.4 + flash * 0.4, 1 + flash * 0.4);
      this._c.copy(col).multiplyScalar(1.05 + flash * 1.4 + hint);
      this.gems.setColorAt(gi, this._c);
      gi++;
      const gk = 0.28 + flash * 0.85 + hint * 0.85;
      this.glows.bill(x, 1.86, z, 0.55 + gk * 0.6, 0.55 + gk * 0.6, 0, col.r * gk, col.g * gk, col.b * gk);
      const mouthY = 1.62 - 0.5 * size;
      const sw = b.swing;
      if (flash > 0.02) {
        this.glows.bill(
          x,
          mouthY + 0.1,
          z + Math.sin(sw) * 0.5 * size,
          1.4 * flash + 0.3,
          1.4 * flash + 0.3,
          0,
          col.r * flash * 0.7,
          col.g * flash * 0.7,
          col.b * flash * 0.7
        );
        this.stars.bill(
          x + 0.18,
          mouthY + 0.25,
          z,
          0.5 * flash,
          0.5 * flash,
          time * 2,
          col.r * flash,
          col.g * flash,
          col.b * flash
        );
      }
      this.fglows.flat(
        x,
        0.04,
        z,
        1.6 + flash,
        1.6 + flash,
        0,
        col.r * (0.07 + flash * 0.28 + hint * 0.24),
        col.g * (0.07 + flash * 0.28 + hint * 0.24),
        col.b * (0.07 + flash * 0.28 + hint * 0.24)
      );
      if (hint > 0) {
        this.stars.bill(
          x,
          2.05 + Math.sin(time * 3) * 0.06,
          z,
          0.7 * hint + 0.2,
          0.7 * hint + 0.2,
          time,
          col.r * hint,
          col.g * hint,
          col.b * hint
        );
      }
      this.shades.flat(x, 0.11, z, 1.2, 1.0, 0, 0.55, 0, 0);
      for (let s = 0; s < 2; s++) {
        const sx = s ? 1 : -1;
        setTRS(
          penArr,
          i * 2 + s,
          x + sx * 0.5,
          1.6,
          z + 0.075,
          Math.sin(time * 1.7 + i + s) * 0.25,
          Math.sin(time * 2.3 + i * 2 + s) * 0.12 + flash * 0.3,
          0,
          1
        );
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
    const halo = this.beamHalo.instanceMatrix.array;
    const g = this.glowCol;
    let s = 0;
    const pCols = this._prismCols;
    for (let i = 0; i + 1 < n && s < MAX_BEAM; i++) {
      const ax = room.worldX(pts[i * 2]);
      const az = room.worldZ(pts[i * 2 + 1]);
      const bx = room.worldX(pts[i * 2 + 2]);
      const bz = room.worldZ(pts[i * 2 + 3]);
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      const yaw = Math.atan2(dx, dz);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const segCol = bm.hit && i === n - 2 ? this._gold : pCols[i % pCols.length];
      setTRS(core, s, mx, BEAM_Y, mz, yaw, Math.PI / 2, 0, 0.032, len, 0.032);
      setTRS(glow, s, mx, BEAM_Y, mz, yaw, Math.PI / 2, 0, 0.105, len, 0.105);
      setTRS(halo, s, mx, BEAM_Y, mz, yaw, Math.PI / 2, 0, 0.23, len, 0.23);
      this.beamCore.setColorAt(s, this._white);
      this.beamGlow.setColorAt(s, segCol);
      this.beamHalo.setColorAt(s, segCol);
      this.fglows.flat(mx, 0.04, mz, 0.85, len + 0.45, yaw, segCol.r * 0.14, segCol.g * 0.16, segCol.b * 0.18);
      s++;

      // Multi-ray prism refraction sparks at each bounce vertex
      const spk = 0.78 + 0.22 * Math.sin(time * 22 + i * 1.9);
      this.glows.bill(bx, BEAM_Y, bz, 0.85 * spk, 0.85 * spk, 0, segCol.r * 0.75, segCol.g * 0.85, segCol.b * 0.95);
      this.stars.bill(bx, BEAM_Y, bz, 0.56 * spk, 0.56 * spk, time * 2.8 + i, 1.0, 0.98, 0.92);
      if (i < n - 2) {
        for (let k = 0; k < 2; k++) {
          const sa = time * 5.5 + i * 2.1 + k * Math.PI;
          this.stars.bill(
            bx + Math.cos(sa) * 0.22,
            BEAM_Y + Math.sin(sa * 1.3) * 0.14,
            bz + Math.sin(sa) * 0.22,
            0.28 * spk,
            0.28 * spk,
            -sa,
            segCol.r,
            segCol.g,
            segCol.b
          );
        }
      }
    }
    this.beamCore.count = s;
    this.beamGlow.count = s;
    this.beamHalo.count = s;
    this.beamCore.instanceMatrix.needsUpdate = true;
    this.beamGlow.instanceMatrix.needsUpdate = true;
    this.beamHalo.instanceMatrix.needsUpdate = true;
    if (this.beamCore.instanceColor) this.beamCore.instanceColor.needsUpdate = true;
    if (this.beamGlow.instanceColor) this.beamGlow.instanceColor.needsUpdate = true;
    if (this.beamHalo.instanceColor) this.beamHalo.instanceColor.needsUpdate = true;
    if (n > 0) {
      const ex = room.worldX(pts[0]);
      const ez = room.worldZ(pts[1]);
      const pul = 0.85 + 0.15 * Math.sin(time * 6);
      this.glows.bill(ex, BEAM_Y, ez, 1.3 * pul, 1.3 * pul, 0, 0.8, 0.95, 1.0);
      this.stars.bill(ex, BEAM_Y, ez, 0.88, 0.88, time * 0.5, 0.9, 0.98, 1);
    }
    if (n > 1 && !bm.hit) {
      const lx = room.worldX(pts[(n - 1) * 2]);
      const lz = room.worldZ(pts[(n - 1) * 2 + 1]);
      const fl = 0.7 + 0.3 * Math.sin(time * 31);
      this.glows.bill(lx, BEAM_Y, lz, 0.9 * fl, 0.9 * fl, 0, 0.7, 0.88, 1.0);
      this.stars.bill(lx, BEAM_Y, lz, 0.6 * fl, 0.6 * fl, time * 3, 0.85, 0.95, 1);
    }

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
      this._c.setRGB(0.8 + lit * 0.45, 0.86 + lit * 0.38, 0.96 + lit * 0.2);
      this.mirrorFaces.setColorAt(i, this._c);
      if (this._glbPropsReady && this.glbMirrorPool[i]) {
        const slot = this.glbMirrorPool[i];
        slot.root.visible = true;
        slot.root.position.set(x, 0.04 + hop, z);
        if (slot.turret) {
          slot.turret.rotation.set(0, -m.angle, 0);
        }
        for (const cm of slot.crystalMats) {
          cm.emissiveIntensity = 0.35 + lit * 1.25;
        }
      }
      if (lit) this.glows.bill(x, BEAM_Y, z, 0.95, 0.95, 0, 0.38, 0.52, 0.62);
      if (turn >= 0 && turn < 0.4) {
        const k = 1 - turn / 0.4;
        this.stars.bill(
          x + Math.cos(time * 9) * 0.35,
          0.5 + turn,
          z + Math.sin(time * 9) * 0.35,
          0.4 * k,
          0.4 * k,
          time * 4,
          0.85,
          0.95 * k,
          1.0 * k
        );
      }
      this.shades.flat(x, 0.11, z, 1.1, 1.1, 0, 0.45, 0, 0);
    }
    this.mirrorFrames.instanceMatrix.needsUpdate = true;
    this.mirrorFaces.instanceMatrix.needsUpdate = true;
    this.mirrorFaces.instanceColor.needsUpdate = true;

    const ch = room.charge || 0;
    this._crystalBloom = Math.max(0, (this._crystalBloom || 0) - dt * 0.8);
    const cp = this.crystal.position;
    const pulse = 0.85 + 0.15 * Math.sin(time * 3);
    this.crystalMat.emissiveIntensity = 0.3 + ch * 1.3 * pulse;
    this.crystalMat.emissive.copy(g).lerp(this._white, ch * 0.3);
    this.crystal.rotation.y = time * (0.2 + ch * 0.8);
    const ck = 0.15 + ch * 0.8 * pulse + this._crystalBloom * 0.85;
    this.glows.bill(
      cp.x,
      1.05,
      cp.z,
      1.0 + ck * 1.1,
      1.4 + ck * 1.3,
      0,
      g.r * ck * 0.3,
      g.g * ck * 0.3,
      g.b * ck * 0.3
    );
    this.glows.bill(cp.x, 1.1, cp.z, 0.5 + ck * 0.3, 0.8 + ck * 0.4, 0, ck * 0.45, ck * 0.45, ck * 0.45);
    this.fglows.flat(
      cp.x,
      0.05,
      cp.z,
      1.4 + ck * 1.4,
      1.4 + ck * 1.4,
      0,
      g.r * ck * 0.15,
      g.g * ck * 0.15,
      g.b * ck * 0.15
    );
    if (ch > 0.05) {
      for (let r = 0; r < 3; r++) {
        const a = time * (0.6 + r * 0.25) + r * 2.1;
        this.stars.bill(
          cp.x,
          1.05 + r * 0.25,
          cp.z,
          (1.0 + r * 0.45) * ch,
          (1.0 + r * 0.45) * ch,
          a,
          g.r * ch * 0.65,
          g.g * ch * 0.65,
          g.b * ch * 0.65
        );
      }
      for (let r = 0; r < 6; r++) {
        const a = (r / 6) * TAU + time * 0.25;
        const k = ch * (0.5 + 0.5 * Math.sin(time * 2 + r));
        this._c.setHSL(r / 6, 0.85, 0.6);
        this.glows.bill(
          cp.x + Math.cos(a) * 0.9 * ch,
          1.5 + Math.sin(a * 2) * 0.2,
          cp.z + Math.sin(a) * 0.5 * ch,
          0.45 * k + 0.05,
          0.45 * k + 0.05,
          0,
          this._c.r * k,
          this._c.g * k,
          this._c.b * k
        );
      }
    }
    this.fxLight.color.copy(g);
    this.fxLight.position.set(cp.x, 1.4, cp.z);
    this.fxLight.intensity = ch * 3.8 + this._crystalBloom * 3.8;
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
      at[i * 4 + 3] = 2;
      this.blocks.setColorAt(i, this._c.copy(this._white).multiplyScalar(1.25));
      if (this._glbPropsReady && this.glbBlockPool[i]) {
        const slot = this.glbBlockPool[i];
        slot.root.visible = true;
        slot.root.position.set(x, 0.02, z);
        slot.root.rotation.set(dz * tilt, 0, -dx * tilt);
        for (const rm of slot.runeMats) {
          rm.color.copy(on ? this._gold : g);
          rm.emissive.copy(on ? this._gold : g);
          rm.emissiveIntensity = on ? 1.35 + flash * 0.6 : 0.42 + 0.1 * Math.sin(time * 2 + i);
        }
      }
      this.shades.flat(x, 0.08, z, 1.25, 1.25, 0, 0.6, 0, 0);
      if (on) {
        this.glows.bill(
          x,
          0.9,
          z,
          1.1 + flash,
          1.1 + flash,
          0,
          g.r * (0.14 + flash * 0.55),
          g.g * (0.14 + flash * 0.55),
          g.b * (0.14 + flash * 0.55)
        );
      }
      if (moving) this.glows.bill(x - dx * 0.4, 0.15, z - dz * 0.4, 0.8, 0.5, 0, 0.1, 0.12, 0.16);
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
      const k = pr ? 0.34 : 0.12 + 0.06 * Math.sin(time * 2.5 + i);
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
    const p = room.puzzle;
    const effectiveShow = p.showTarget !== false || room.solved ? 1.0 : clamp(room.peekAlpha ?? 0, 0, 1);
    if (Math.abs(effectiveShow - (this._lastMuralShow ?? -1)) > 0.018) {
      this._drawMural(room, effectiveShow);
    }
    const sp = this.stele.position;
    this.shades.flat(sp.x, 0.0, sp.z + 0.1, 2.6, 1.1, 0, 0.55, 0, 0);
    if (room.type === 'lights') {
      const k = 0.85 + 0.15 * Math.sin(time * 1.6);
      this.muralMat.emissiveIntensity = (0.32 + 1.15 * effectiveShow) * k + (room.solved ? 0.7 : 0);
      const halo = 0.025 + 0.085 * effectiveShow;
      this.glows.bill(
        sp.x,
        1.4,
        sp.z + 0.4,
        2.2,
        2.4,
        0,
        this.glowCol.r * halo,
        this.glowCol.g * halo,
        this.glowCol.b * halo
      );
    } else if (room.type === 'bells' && this._sockets) {
      const k = 0.88 + 0.12 * Math.sin(time * 1.6);
      this.muralMat.emissiveIntensity = (0.32 + 1.05 * effectiveShow) * k + (room.solved ? 0.65 : 0);
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
          this.glows.bill(x, y, z, 0.32 * pop, 0.32 * pop, 0, col.r * 1.15, col.g * 1.15, col.b * 1.15);
          this.glows.bill(x, y, z, 0.12, 0.12, 0, 1, 1, 1);
        } else if (wrong >= 0 && wrong < 0.7) {
          const wk = (1 - wrong / 0.7) * (0.5 + 0.5 * Math.sin(wrong * 40));
          this.glows.bill(x, y, z, 0.3, 0.3, 0, 0.6 * wk, 0.25 * wk, 0.35 * wk);
        } else if (effectiveShow > 0.03 && p.bells && p.bells[p.order[i]]) {
          const col = this._bellCols[p.bells[p.order[i]].color];
          const pk = effectiveShow * 0.88;
          const sz = 0.24 * (0.65 + 0.35 * effectiveShow);
          this.glows.bill(x, y, z, sz, sz, 0, col.r * pk, col.g * pk, col.b * pk);
        }
      }
    }
  }

  // Exact Next-Gen `PogoRig` Yaw (`this._pogoYaw - 0.38`) & `poseState` Adapter (§3.1.D)
  _updatePogo(room, time, dt) {
    const po = room.pogo;
    const root = this.pogoRoot;
    let wx = room.worldX(po.px);
    let wz = room.worldZ(po.py);
    const fd = po.facing;
    wx += [1, 0, -1, 0][fd] * po.bump * 0.6;
    wz += [0, 1, 0, -1][fd] * po.bump * 0.6;
    const stepBob = po.moving ? Math.sin(po.moveT * Math.PI) * 0.06 : 0;
    const out = Math.max(0, po.py - (room.rows - 0.5));
    const wy = 0.02 + po.hop + stepBob - out * 0.42;
    root.position.set(wx, wy, wz);
    root.visible = (po.alpha ?? 1) > 0.02;

    const lookCam = (!po.moving && po.idle > 2.2) || (room.phase === 'solved' && !po.moving);
    const want = lookCam ? (room.phase === 'solved' ? 0.38 : 0) : DIR_YAW[fd];
    let d = want - this._pogoYaw;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    this._pogoYaw += d * (1 - Math.exp(-18 * dt));
    // Exact §3.1.D Yaw Alignment: compensates PogoRig's internal +0.38 rad 3/4 hero yaw
    root.rotation.y = this._pogoYaw - 0.38;

    if (this.pogoRig) {
      const land =
        po.hopT >= 0.2 && po.hopT < 0.3 ? Math.sin(((po.hopT - 0.2) / 0.1) * Math.PI) : 0;
      const acted = po.acts !== this._lastActs;
      this._lastActs = po.acts;

      const ps = this._pogoState;
      ps.time = time;
      ps.vx = po.speed * 0.55;
      ps.vy = po.hopT >= 0 ? (po.hopT < 0.12 ? 5.5 : -6.0) : 0;
      ps.facing = 1;
      ps.onGround = po.hop < 0.03;
      ps.onElevator = false;
      ps.squashX = 1 + land * 0.12;
      ps.squashY = 1 - land * 0.14;
      ps.landImpact = land;
      ps.muzzleFlash = acted ? 0.12 : 0;
      ps.hurtTimer = 0;
      ps.invuln = 0;
      ps.enteringDoor = 0;
      ps.victory = room.phase === 'solved';
      this.pogoRig.update(dt, ps);
      if (this.pogoRig.bones?.blaster) {
        this.pogoRig.bones.blaster.visible = false;
      }
    }

    const sh = clamp(1 - po.hop * 1.4, 0.4, 1);
    this.shades.flat(wx, 0.08 - out * 0.42, wz, 1.15 * sh, 1.15 * sh, 0, 0.72 * sh * (po.alpha ?? 1), 0, 0);
    if (room.type === 'beam' && this._inBeam(room, po.px, po.py)) {
      this.glows.bill(wx, 0.7 + wy, wz, 1.2, 1.2, 0, 0.28, 0.36, 0.42);
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

  _updateReward(room, time) {
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
    r.scale.setScalar(s * 1.48);
    r.rotation.y = Math.sin(time * 0.9) * 0.5;
    this.starfish.rotation.set(0, time * 1.8, Math.sin(time * 1.3) * 0.2);
    this.key.rotation.set(0, -time * 1.6, time * 2.2);

    const pa =
      clamp(age / 0.5, 0, 1) * (room.collectT >= 0 ? 1 - clamp((room.t - room.collectT) / 0.6, 0, 1) : 1);
    this.pillarBeam.visible = pa > 0.01;
    this.pillarBeam.position.set(cx, 3.2, cz);
    this.pillarBeam.scale.set(1, 6.6, 1);
    this.pillarBeam.material.uniforms.uA.value = pa * 0.2;
    if (r.visible) {
      const k = s;
      this.glows.bill(x, y, z, 2.2 * k, 1.6 * k, 0, 0.2 * k, 0.16 * k, 0.06 * k);
      for (let i = 0; i < 4; i++) {
        const a = time * 1.5 + (i / 4) * TAU;
        this.stars.bill(
          x + Math.cos(a) * 0.7,
          y + Math.sin(a * 1.3) * 0.3,
          z + Math.sin(a) * 0.4,
          0.45 * k,
          0.45 * k,
          time * 3 + i,
          1,
          0.92,
          0.55
        );
      }
      this.fglows.flat(cx, 0.05, cz, 3 * pa, 3 * pa, 0, 0.16 * pa, 0.13 * pa, 0.05 * pa);
    }
    if (room.type !== 'beam') {
      this.fxLight.color.set('#fde047');
      this.fxLight.position.set(cx, 2.2, cz);
      this.fxLight.intensity = 4.6 * pa;
    }
  }

  _updateRings(time) {
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
      const i = r.flat
        ? this.rings.flat(r.x, r.y, r.z, rad * 2, rad * 2, 0, r.col.r * a, r.col.g * a, r.col.b * a)
        : this.rings.bill(r.x, r.y, r.z, rad * 2, rad * 2, 0, r.col.r * a, r.col.g * a, r.col.b * a);
      if (i >= 0) {
        if (r.flat) {
          const m = this.rings.m;
          m[i * 16 + 5] = rad * 2;
        }
        ra[i * 2] = q;
        ra[i * 2 + 1] = r.flat;
      }
    }
  }

  // ------------------------------------------------------------------ overlay
  _updateExitChip(room, time) {
    const show = this._onEntrance || (room.phase === 'play' && room.playT < 4 && room.playT > 0.4);
    this._exitA = clamp((this._exitA || 0) + (show ? 0.08 : -0.08), 0, 1);
    const a = this._exitA * (1 - clamp(room.fade || 0, 0, 1));
    this.exitChip.visible = a > 0.01;
    if (!this.exitChip.visible) return;
    const v = this._v.set(this._doorX, 0.05, this._doorZ + 0.9).project(this.camera);
    const wide = this.width / this.height > 1.15;
    const x = (v.x + 1) * 0.5 * this.width;
    const rawY = (1 - v.y) * 0.5 * this.height + (wide ? 10 : 14);
    const y = wide
      ? clamp(rawY, this.height * 0.84, this.height - 20)
      : clamp(rawY, this.height * 0.78, this.height - 102);
    const s = clamp((wide ? this.height * 1.15 : this.width) / 390, 0.78, 1.25);
    this.exitChip.scale.set((wide ? 82 : 94) * s, (wide ? 27 : 31) * s, 1);
    this.exitChip.position.set(x, -y + Math.sin(time * 4) * 2, 0);
    this.exitChip.material.opacity = a * (this._onEntrance ? 1 : 0.72);
  }

  _font(weight, px, fam = 'Orbitron, Rajdhani, "Segoe UI", sans-serif') {
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
      } else {
        cur = t;
      }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  _drawHud(room) {
    const p = room.puzzle;
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : this._dpr || 1);
    const W = this.width;
    const wide = W / this.height > 1.15;
    const s = wide ? clamp(this.height / 420, 0.78, 1.06) : clamp(W / 390, 0.85, 1.2);
    const pw = wide ? Math.min(W * 0.255, 236 * s) : Math.min(W - 18, 500 * s);
    const ph = (wide ? 50 : 56) * s;
    const cw = Math.max(1, Math.round(pw * pr));
    const ch = Math.max(1, Math.round(ph * pr));
    const effectiveShow = p.showTarget !== false || room.solved ? 1 : clamp(room.peekAlpha ?? 0, 0, 1);
    const peekBucket = Math.round(effectiveShow * 4);
    const prog =
      room.type === 'bells'
        ? `${room.progress}:${room.rung.join('')}`
        : room.type === 'beam'
          ? room.beam.hit
            ? 1
            : 0
          : room.type === 'blocks'
            ? room.platesOn
            : 0;
    const key = `${room.hud.rev}|${room.hud.title}|${room.hud.line}|${room.hud.status}|${prog}|${peekBucket}|${room.moves}|${room.parMoves}|${room.solved}|${cw}x${ch}|${W}x${this.height}`;
    const hudA =
      room.phase === 'intro' ? smooth01((room.phaseT - 0.3) / 0.5) : 1 - clamp(room.fade || 0, 0, 1);
    this.hudPanel.material.opacity = hudA;
    this.hudPanel.visible = hudA > 0.01;
    const hudX = wide ? W - 12 - pw / 2 : W / 2;
    const hudY = wide ? -(112 + ph / 2) : -(HUD_TOP_OFFSET + ph / 2);
    this.hudPanel.scale.set(pw, ph, 1);
    this.hudPanel.position.set(hudX, hudY, 0);
    const c = this._hudCanvas;
    if (key === this._hudKey && c.width === cw && c.height === ch) return;
    this._hudKey = key;

    // Recreate `CanvasTexture` whenever backing pixel dimensions change so Three.js
    // allocates fresh `texStorage2D` instead of leaving stale sub-rect VRAM ghosts.
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
      if (this._hudTex) this._hudTex.dispose();
      this._hudTex = new THREE.CanvasTexture(c);
      this._hudTex.colorSpace = THREE.SRGBColorSpace;
      this._hudTex.generateMipmaps = false;
      this._hudTex.minFilter = THREE.LinearFilter;
      this.hudPanel.material.map = this._hudTex;
      this.hudPanel.material.needsUpdate = true;
    }
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    ctx.setTransform(pr, 0, 0, pr, 0, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, ph);
    bg.addColorStop(0, 'rgba(10, 16, 34, 0.84)');
    bg.addColorStop(1, 'rgba(5, 9, 22, 0.84)');
    ctx.fillStyle = bg;
    this._roundRect(ctx, 1, 1, pw - 2, ph - 2, 12 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 169, 78, 0.45)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    const glow = '#' + this.glowCol.getHexString();
    const mx = (wide ? 22 : 26) * s;
    const my = ph / 2;
    const mg = ctx.createRadialGradient(mx, my, 2, mx, my, (wide ? 16 : 19) * s);
    mg.addColorStop(0, glow);
    mg.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, (wide ? 16 : 19) * s, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(217, 169, 78, 0.72)';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(mx, my, (wide ? 12.5 : 14.5) * s, 0, TAU);
    ctx.stroke();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.0 * s;
    const typeIdx = ['lights', 'bells', 'beam', 'blocks'].indexOf(room.type);
    drawRune(ctx, mulberry32(1000 + (typeIdx * 4 + 1) * 77), mx, my, (wide ? 19 : 22) * s);
    ctx.restore();

    const rw = this._drawHudWidget(ctx, room, pw, ph, s, glow, effectiveShow);
    const tx = (wide ? 42 : 50) * s;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = this._font(800, (wide ? 10.5 : 12) * s);
    ctx.fillStyle = '#7be8ff';
    const titleStr = room.hud.title || p.title;
    ctx.fillText(titleStr, tx, (wide ? 18 : 20) * s);
    if (room.parMoves > 0) {
      const tw = ctx.measureText(titleStr).width;
      const inPar = (room.moves || 0) <= room.parMoves;
      ctx.font = this._font(800, (wide ? 8.8 : 9.5) * s);
      ctx.fillStyle = room.parCleared ? '#fde047' : inPar ? '#fbbf24' : 'rgba(148, 169, 201, 0.82)';
      const parTxt = room.parCleared ? 'PAR +5G' : `PAR ${room.moves || 0}/${room.parMoves}`;
      if (tx + tw + 6 * s + ctx.measureText(parTxt).width < pw - rw - 4 * s) {
        ctx.fillText(parTxt, tx + tw + 6 * s, (wide ? 17.5 : 19.5) * s);
      }
    }

    const lineStr = wide
      ? room.solved
        ? 'Vault open • step south to exit'
        : !room.showTarget && effectiveShow > 0.25
          ? 'Doorway clue lit on stele'
          : !room.showTarget && (room.type === 'lights' || room.type === 'bells')
            ? 'Step to doorway to peek clue'
            : room.hud.line
      : room.hud.line;
    ctx.font = this._font(600, (wide ? 10.5 : 11.8) * s, 'Rajdhani, "Segoe UI", sans-serif');
    ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
    const maxW = Math.max(40 * s, pw - tx - rw - 8 * s);
    let lines = this._wrap(ctx, lineStr, maxW, 2);
    if (lines.length > 1) {
      ctx.font = this._font(600, (wide ? 9.8 : 11) * s, 'Rajdhani, "Segoe UI", sans-serif');
      lines = this._wrap(ctx, lineStr, maxW, 2);
    }
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tx, (lines.length > 1 ? (wide ? 31 : 34) : (wide ? 35 : 38)) * s + i * (wide ? 11.5 : 12.5) * s);
    }

    this._hudTex.needsUpdate = true;
  }

  _drawHudWidget(ctx, room, pw, ph, s, glow, effectiveShow = 1) {
    const p = room.puzzle;
    const right = pw - 10 * s;
    const cy = ph / 2;
    const sx = right - 11 * s;

    // Vector Star Core emblem: dim slate until chamber is solved, radiant gold when solved
    ctx.save();
    ctx.globalAlpha = room.solved ? 1 : 0.36;
    ctx.fillStyle = room.solved ? '#fde047' : '#94a9c9';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const rad = (i % 2 === 0 ? 9.5 : 4.2) * s;
      if (i === 0) ctx.moveTo(sx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      else ctx.lineTo(sx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    let used = 32 * s;
    const x1 = sx - 18 * s;
    if (room.type === 'lights' && effectiveShow > 0.15) {
      const n = p.n;
      const cell = 8.8 * s;
      const w = n * cell;
      const x0 = x1 - w;
      const y0 = cy - w / 2;
      ctx.save();
      ctx.globalAlpha = effectiveShow;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const on = p.target[y * n + x];
          ctx.fillStyle = on ? glow : 'rgba(148,169,201,0.22)';
          ctx.beginPath();
          ctx.arc(x0 + (x + 0.5) * cell, y0 + (y + 0.5) * cell, cell * (on ? 0.36 : 0.22), 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      used += w + 10 * s;
    } else if (room.type === 'bells') {
      const n = p.order.length;
      const sp = 12 * s;
      const x0 = x1 - n * sp;
      for (let i = 0; i < n; i++) {
        const cx = x0 + (i + 0.5) * sp;
        if (i < room.progress) {
          ctx.fillStyle = BELL_COLORS[room.rung[i]];
          ctx.beginPath();
          ctx.arc(cx, cy, 4.8 * s, 0, TAU);
          ctx.fill();
        } else {
          const targetCol =
            effectiveShow > 0.15 && p.bells && p.bells[p.order[i]]
              ? BELL_COLORS[p.bells[p.order[i]].color]
              : null;
          ctx.save();
          if (targetCol) ctx.globalAlpha = effectiveShow;
          ctx.strokeStyle = targetCol || 'rgba(148,169,201,0.45)';
          ctx.lineWidth = (targetCol ? 2.1 : 1.5) * s;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.4 * s, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
      used += n * sp + 10 * s;
    } else if (room.type === 'blocks') {
      ctx.font = this._font(800, 13 * s);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = room.platesOn === room.plates.length ? glow : '#f8fafc';
      const txt = `${room.platesOn}/${room.plates.length}`;
      ctx.fillText(txt, x1, cy);
      used += ctx.measureText(txt).width + 12 * s;
    } else if (room.type === 'beam') {
      const on = room.beam.hit;
      ctx.fillStyle = on ? glow : 'rgba(148,169,201,0.32)';
      ctx.beginPath();
      ctx.moveTo(x1 - 7.5 * s, cy - 11 * s);
      ctx.lineTo(x1, cy);
      ctx.lineTo(x1 - 7.5 * s, cy + 11 * s);
      ctx.lineTo(x1 - 15 * s, cy);
      ctx.closePath();
      ctx.fill();
      used += 24 * s;
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
        for (const k of ['map', 'emissiveMap', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
          const t = m[k];
          if (t && t !== this.softDot && !seen.has(t)) {
            seen.add(t);
            t.dispose();
          }
        }
        m.dispose();
      }
    };
    if (this.pogoObj && this.pogoRoot) this.pogoRoot.remove(this.pogoObj);
    this.pogoRig?.dispose?.();
    this.scene.traverse(kill);
    this.overlay.traverse(kill);
    for (const e of this._popCache.values()) e.tex.dispose();
    this._popCache.clear();
    for (const t of [
      this.wallTex,
      this.wallNormalTex,
      this.slabTex,
      this.slabNormalTex,
      this.flagTex,
      this.flagNormalTex,
    ]) {
      if (t && !seen.has(t)) {
        seen.add(t);
        t.dispose();
      }
    }
    this.windowLight?.shadow?.map?.dispose?.();
    this.U.uRunes.value.dispose();
    this.starTex.dispose();
    this.ringTex.dispose();
    this._envRT?.dispose();
    if (this._ownSoftDot) this.softDot.dispose();
  }
}
