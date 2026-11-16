// MK.7 mini-submarine bonus stage renderer.
//
// Owns its own scene + cameras and draws a SubStage (src/subStage.js) into the game's shared
// THREE.WebGLRenderer. Gameplay state is in CSS-pixel screen coordinates; every entity is mapped
// onto the z = 0 world plane by unprojecting through an (unshaken) copy of the camera, so what you
// see is exactly where the hit-boxes are. Background layers live at real depths and get their
// parallax from the perspective camera for free.
//
// Performance notes: everything repeated is an InstancedMesh, materials/geometries are shared, all
// per-frame work writes into preallocated typed arrays (no allocations in render()), and the whole
// frame is ~60-70 draw calls.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 50;
const CAM_Z = 16;
const TOWER_Z = -5.5;
const RUBBLE_Z = -7;

const MAX_FISH = 64;
const MAX_AMB = 110;
const MAX_SHELL = 96;
const MAX_JELLY = 14;
const MAX_MINE = 12;
const MAX_LINKS = 260;
const MAX_CLAM = 6;
const MAX_GLOW = 360;
const MAX_RING = 24;
const MAX_PART = 600;
const MAX_WAKE = 120;
const MAX_POP = 18;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);

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

// ---------------------------------------------------------------------------------- palettes
// Three stops: healing 0 (toxic murk) / 0.5 / 1 (clear sunlit turquoise)
const PAL_HEX = {
  fog: ['#1d1431', '#123a50', '#0a6787'],
  hemiSky: ['#a6c25a', '#9ad8e6', '#d8fbff'],
  hemiGround: ['#2a1036', '#103043', '#0b4560'],
  sun: ['#c3cc6c', '#e6f4d6', '#fff2d2'],
  surf: ['#3f5a24', '#3a8fa2', '#5ccbe0'],
  surfHi: ['#a8c84e', '#c2f2fb', '#effdff'],
  ray: ['#9cc040', '#c9f2ea', '#fff4d4'],
  sandA: ['#241b2c', '#45463f', '#8c6d48'],
  sandB: ['#3e3248', '#716f5e', '#c9ad7c'],
  caustic: ['#9dff6a', '#c9fff5', '#fffbe8'],
  toxic: ['#7dff2e', '#6be08a', '#40c0a0'],
  snow: ['#c4e05e', '#cdeff2', '#f4ffff'],
  rock: ['#2e2338', '#2c4652', '#3a6672'],
  far: ['#271c3a', '#1a4154', '#16657f'],
  vignette: ['#07040f', '#020c16', '#01161f'],
};
const PAL = {};
for (const k in PAL_HEX) PAL[k] = PAL_HEX[k].map((h) => new THREE.Color(h));

function mix3(out, stops, h) {
  if (h <= 0.5) return out.lerpColors(stops[0], stops[1], h * 2);
  return out.lerpColors(stops[1], stops[2], (h - 0.5) * 2);
}

const SMALL_FISH_HEX = ['#ff8a3d', '#ffd23f', '#ff5fa2', '#8bff5a', '#45dcff'];
const BIG_FISH_HEX = ['#8f7bff', '#ff6464', '#2fd6c1'];
const GOLD_HEX = '#ffc928';
const JELLY_HEX = ['#ff5ad1', '#b16bff', '#ff7a90'];
const CORAL_LUSH_HEX = ['#ff4f8b', '#ff9a3c', '#c86bff', '#ffd23a', '#ff6b7f', '#5ef0a0', '#6aa8ff', '#ff7ad9'];
const CORAL_DEAD_HEX = ['#8b8290', '#7a7383', '#948a8c', '#6f6878'];

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
const GLSL_FOG_PARS = /* glsl */ `
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
`;
const GLSL_OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

// JS mirror of the seabed dune function (so props sit on the sand)
function duneRaw(x, z) {
  return Math.sin(x * 0.33) * 0.35 + Math.sin(x * 0.81 + z * 0.47) * 0.18 + Math.sin(x * 1.9 - z * 1.3) * 0.05;
}
function duneAmp(z) {
  const t = clamp((1.5 - z) / 7.5, 0, 1);
  return lerp(0.12, 1.0, t * t * (3 - 2 * t));
}

// ---------------------------------------------------------------------------------- helpers
function paint(geo, fn) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const c = [1, 1, 1];
  for (let i = 0; i < n; i++) {
    fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
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
function merge(list) {
  const prepared = list.map((g) => {
    let ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color' && name !== 'uv') ng.deleteAttribute(name);
    }
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    if (!ng.attributes.color) solid(ng, 1, 1, 1);
    return ng;
  });
  return mergeGeometries(prepared, false);
}

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

// Patch a MeshStandardMaterial with optional rim light, per-instance glow, sway and fish wag.
function patchStd(mat, U, opts = {}) {
  const { rim = null, glow = false, sway = 0, wag = false, nacre = false, key = 'std' } = opts;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uScrollW = U.uScrollW;
    if (rim) {
      shader.uniforms.uRimColor = { value: rim.color };
      shader.uniforms.uRimStr = rim.str;
    }
    let head = 'uniform float uTime;\nuniform float uScrollW;\n';
    if (glow) head += 'attribute float aGlow;\nvarying float vGlow;\n';
    if (wag) head += 'attribute vec3 aAnim;\n';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`);
    let bv = '#include <begin_vertex>\n';
    if (glow) bv += 'vGlow = aGlow;\n';
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
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', bv);

    let fhead = '';
    if (rim) fhead += 'uniform vec3 uRimColor;\nuniform float uRimStr;\n';
    if (glow) fhead += 'varying float vGlow;\n';
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fhead}`);
    let ef = '#include <emissivemap_fragment>\n';
    if (glow) ef += 'totalEmissiveRadiance += diffuseColor.rgb * vGlow;\n';
    if (rim) {
      ef += `
        float rimF = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        totalEmissiveRadiance += uRimColor * (rimF * rimF * rimF) * uRimStr;
      `;
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', ef);
    if (nacre) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.93), 0.72);\n'
      );
    }
  };
  mat.customProgramCacheKey = () => `sub_${key}_${rim ? 1 : 0}${glow ? 1 : 0}${sway}${wag ? 1 : 0}${nacre ? 1 : 0}`;
  return mat;
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

// ---------------------------------------------------------------------------------- geometry builders
function buildStaghorn(rng) {
  const parts = [];
  const tips = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const branch = (start, dir, len, rad, depth) => {
    const end = start.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(rad * 0.72, rad, len, 6, 1, false);
    g.translate(0, len / 2, 0);
    q.setFromUnitVectors(up, dir);
    g.applyQuaternion(q);
    g.translate(start.x, start.y, start.z);
    parts.push(g);
    if (depth === 0) {
      const s = new THREE.SphereGeometry(rad * 0.8, 6, 4);
      s.translate(end.x, end.y, end.z);
      parts.push(s);
      tips.push(end.clone());
      return;
    }
    const n = 2 + (rng() < 0.45 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const d = dir.clone();
      d.x += (rng() - 0.5) * 1.2;
      d.z += (rng() - 0.5) * 0.8;
      d.y += 0.3;
      d.normalize();
      branch(end, d, len * (0.66 + rng() * 0.16), rad * 0.7, depth - 1);
    }
  };
  branch(new THREE.Vector3(0, -0.1, 0), up, 0.5, 0.12, 3);
  const geo = merge(parts);
  paint(geo, (x, y, z, c) => {
    const k = 0.5 + 0.5 * clamp(y / 1.3, 0, 1);
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return { geo, tips };
}

function buildBrain() {
  const g = new THREE.SphereGeometry(1, 26, 16);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const groove = Math.sin(v.x * 11 + Math.sin(v.z * 7) * 1.6) * Math.sin(v.z * 10 + Math.sin(v.y * 9) * 1.4);
    v.multiplyScalar(1 + groove * 0.045);
    if (v.y < 0) v.y *= 0.25;
    p.setXYZ(i, v.x, v.y * 0.8, v.z);
  }
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const groove = Math.sin(x * 11 + Math.sin(z * 7) * 1.6) * Math.sin(z * 10 + Math.sin(y * 9) * 1.4);
    const k = 0.62 + 0.38 * clamp(groove * 0.5 + 0.6, 0, 1);
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return g;
}

function buildTubes(rng) {
  const parts = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    const h = 0.5 + rng() * 0.9;
    const r = 0.1 + rng() * 0.07;
    const g = new THREE.CylinderGeometry(r * 1.15, r, h, 10, 3, true);
    g.translate(0, h / 2, 0);
    g.rotateZ((rng() - 0.5) * 0.35);
    g.translate((rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.4);
    parts.push(g);
    const lip = new THREE.TorusGeometry(r * 1.15, 0.025, 5, 12);
    lip.rotateX(Math.PI / 2);
    lip.translate(0, h, 0);
    lip.rotateZ(0);
    parts.push(lip);
  }
  const geo = merge(parts);
  paint(geo, (x, y, z, c) => {
    const k = 0.55 + 0.45 * clamp(y / 1.2, 0, 1);
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return geo;
}

function buildKelp() {
  const parts = [];
  for (let k = 0; k < 2; k++) {
    const g = new THREE.PlaneGeometry(0.42, 1, 1, 16);
    g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      let x = p.getX(i) * (1.15 - y * 0.75);
      x += Math.sin(y * 7 + k * 2) * 0.06;
      p.setX(i, x);
    }
    g.rotateY(k * 1.1);
    parts.push(g);
  }
  const geo = merge(parts);
  geo.computeVertexNormals();
  paint(geo, (x, y, z, c) => {
    const k = 0.42 + 0.58 * clamp(y, 0, 1);
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return geo;
}

function buildFan() {
  const g = new THREE.PlaneGeometry(2, 1.15, 10, 6);
  g.translate(0, 0.575, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, -x * x * 0.18);
  }
  g.computeVertexNormals();
  return g;
}

function buildRock(rng, detail = 1) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 0.78 + rng() * 0.38;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

function buildSpire(rng) {
  let g = new THREE.CylinderGeometry(0.42, 1.0, 1, 8, 10, false);
  g.translate(0, 0.5, 0);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = Math.atan2(p.getZ(i), p.getX(i));
    const f = 1 + Math.sin(a * 3 + y * 7) * 0.12 + Math.sin(y * 13 + a) * 0.08 + (rng() - 0.5) * 0.12;
    p.setX(i, p.getX(i) * f + Math.sin(y * 4) * 0.12);
    p.setZ(i, p.getZ(i) * f);
  }
  g.computeVertexNormals();
  return g;
}

function buildFish(low = false) {
  const body = low ? new THREE.SphereGeometry(1, 10, 7) : new THREE.SphereGeometry(1, 16, 10);
  body.scale(1, 0.5, 0.3);
  paint(body, (x, y, z, c) => {
    let k = y < 0 ? 1.0 : lerp(1.0, 0.58, clamp(y / 0.45, 0, 1));
    if (Math.sin(x * 7.5 + 1.2) > 0.82) k *= 0.62; // stripes
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  const tail = new THREE.ConeGeometry(0.46, 0.78, 4, 1);
  tail.scale(1, 1, 0.12);
  tail.rotateZ(Math.PI / 2);
  tail.translate(1.2, 0, 0);
  solid(tail, 0.85, 0.85, 0.85);
  const dorsal = new THREE.ConeGeometry(0.26, 0.42, 4, 1);
  dorsal.scale(1, 1, 0.1);
  dorsal.rotateZ(-0.6);
  dorsal.translate(0.15, 0.5, 0);
  solid(dorsal, 0.72, 0.72, 0.72);
  const fin = new THREE.ConeGeometry(0.16, 0.3, 4, 1);
  fin.scale(1, 1, 0.1);
  fin.rotateZ(-2.2);
  fin.translate(0.05, -0.42, 0);
  solid(fin, 0.85, 0.85, 0.85);
  const eyes = [];
  for (const sz of [1, -1]) {
    if (!low) {
      const w = new THREE.SphereGeometry(0.15, 8, 6);
      w.translate(-0.6, 0.1, 0.17 * sz);
      solid(w, 1.0, 1.0, 1.0);
      eyes.push(w);
    }
    const e = low ? new THREE.SphereGeometry(0.1, 5, 4) : new THREE.SphereGeometry(0.095, 8, 6);
    e.translate(-0.66, 0.11, 0.23 * sz);
    solid(e, 0.02, 0.02, 0.03);
    eyes.push(e);
  }
  return merge([body, tail, dorsal, fin, ...eyes]);
}

function buildMine() {
  const parts = [];
  const body = new THREE.SphereGeometry(1, 22, 16);
  solid(body, 0.2, 0.22, 0.26);
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
    const horn = new THREE.CylinderGeometry(0.13, 0.19, 0.22, 8);
    horn.translate(0, 0.98, 0);
    const spike = new THREE.ConeGeometry(0.11, 0.5, 8);
    spike.translate(0, 1.32, 0);
    q.setFromUnitVectors(up, d);
    horn.applyQuaternion(q);
    spike.applyQuaternion(q);
    solid(horn, 0.42, 0.44, 0.5);
    solid(spike, 0.75, 0.76, 0.8);
    parts.push(horn, spike);
  }
  const band = new THREE.TorusGeometry(1.0, 0.075, 6, 36);
  band.rotateX(Math.PI / 2);
  solid(band, 0.75, 0.16, 0.12);
  parts.push(band);
  return merge(parts);
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
  paint(g, (x, y, z, c) => {
    const a = Math.atan2(z, x);
    const k = 0.72 + 0.28 * (0.5 + 0.5 * Math.cos(a * 16));
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  g.translate(0, 0, 0.85); // hinge at local origin (back edge)
  return g;
}

// ---------------------------------------------------------------------------------- shader materials
function bubbleShellMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color('#bdf4ff') }, uTime: U.uTime },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 w = instanceMatrix * vec4(position, 1.0);
        vec4 mv = modelViewMatrix * w;
        vN = normalize(normalMatrix * (mat3(instanceMatrix) * normal));
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 2.2);
        vec3 L = normalize(vec3(-0.55, 0.8, 0.6));
        float spec = pow(max(dot(n, normalize(L + v)), 0.0), 70.0);
        float spec2 = pow(max(dot(n, normalize(vec3(0.5, -0.6, 0.6) + v)), 0.0), 30.0) * 0.35;
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + vec3(0.0, 0.33, 0.67)));
        vec3 col = mix(uTint, irid, 0.38) * (0.35 + fres * 1.8) + vec3(spec * 2.2 + spec2);
        float a = clamp(0.07 + fres * 0.9 + spec + spec2, 0.0, 1.0);
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
        vec3 col = vC * (0.42 + fres * 1.5) * beat + vC * gon * 1.2 + vec3(1.0) * (fres * 0.3 + rim * 0.45);
        float a = clamp(0.5 + fres * 0.5 + gon * 0.3 + rim * 0.3, 0.0, 1.0) * vA;
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

function glassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color('#a8ecff') } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.4);
        float spec = pow(max(dot(n, normalize(vec3(-0.5, 0.9, 0.7) + v)), 0.0), 80.0);
        float streak = smoothstep(0.92, 0.99, dot(n, normalize(vec3(-0.4, 0.6, 0.7)))) * 0.6;
        vec3 col = uTint * (0.25 + fres * 1.6) + vec3(spec * 2.5 + streak);
        gl_FragColor = vec4(col, clamp(0.1 + fres * 0.75 + spec + streak, 0.0, 1.0));
        ${GLSL_OUT}
      }`,
  });
}

function lightConeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#fff1b8') }, uStr: { value: 0.35 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){
        vT = clamp((position.x - 1.32) / 4.5, 0.0, 1.0); // 0 at the tip (nose), 1 at the open end
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uStr;
      varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.4);
        float a = pow(1.0 - vT, 1.6) * edge * uStr;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------------- renderer
export class SubRenderer {
  constructor(webglRenderer, { softDotTex } = {}) {
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this.width = 390;
    this.height = 620;
    this.exposure = 1.12;
    this._kx = 1;
    this._ky = 1;

    const U = (this.U = {
      uTime: { value: 0 },
      uScrollW: { value: 0 },
      uFogColor: { value: new THREE.Color('#123a50') },
      uFogNear: { value: CAM_Z },
      uFogFar: { value: 60 },
    });

    this.scene = new THREE.Scene();
    this.fogColor = U.uFogColor.value;
    this.scene.background = this.fogColor;
    this.scene.fog = new THREE.Fog(this.fogColor, CAM_Z, 60);

    this.camera = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 160);
    this.camera.position.set(0, 0, CAM_Z);
    this.mapCam = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 160);
    this.mapCam.position.set(0, 0, CAM_Z);

    // scratch
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._dummy = new THREE.Object3D();
    this._c = new THREE.Color();
    this._c2 = new THREE.Color();
    this._colorCache = new Map();
    this._heal = -1;
    this._lastTime = null;
    this._glowColor = new THREE.Color('#38bdf8');
    this._glowHex = '';
    this._towerR = -1;

    this.colors = {};
    for (const k in PAL) this.colors[k] = new THREE.Color();

    this._fishSmall = SMALL_FISH_HEX.map((h) => new THREE.Color(h));
    this._fishBig = BIG_FISH_HEX.map((h) => new THREE.Color(h));
    this._fishGold = new THREE.Color(GOLD_HEX);
    this._jellyCols = JELLY_HEX.map((h) => new THREE.Color(h));
    this._white = new THREE.Color(1, 1, 1);

    this._buildLights();
    this._buildEnvironment();
    this._buildLayers();
    this._buildSub();
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
    // wrap spans for scrolling layers depend on the visible width at each depth
    for (const layer of this.layers) {
      for (const it of layer.items) it.span = 2 * this._halfW(it.z) + layer.margin;
    }
    const sw = 2 * this._halfW(-16) + 6;
    this.snowMat.uniforms.uSpan.value = sw;
    this.vignette.scale.set(width, height, 1);
    this.vignette.position.set(width / 2, -height / 2, -5);
    this._hudKey = '';
    this._statsKey = '';
  }

  // ------------------------------------------------------------------ build: lights & environment
  _buildLights() {
    this.hemi = new THREE.HemisphereLight('#9ad8e6', '#103043', 1.6);
    this.sun = new THREE.DirectionalLight('#fff2d2', 2);
    this.sun.position.set(-3, 12, 7);
    this.back = new THREE.DirectionalLight('#7ee8ff', 0.9);
    this.back.position.set(5, 3, -8);
    this.scene.add(this.hemi, this.sun, this.back);
  }

  _buildEnvironment() {
    const U = this.U;
    // ---- seabed with dunes + animated caustics + toxic sludge
    const bedGeo = new THREE.PlaneGeometry(240, 110, 120, 44);
    bedGeo.rotateX(-Math.PI / 2);
    bedGeo.translate(0, 0, -45);
    this.bedMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uFogColor: U.uFogColor,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
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
        uniform vec3 uToxic; uniform float uToxicAmt;
        ${GLSL_FOG_PARS}
        varying vec3 vW; varying vec3 vN; varying float vDepth;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vW.xz;
          float n = vnoise(p * 0.35) * 0.6 + vnoise(p * 1.7) * 0.3 + vnoise(p * 9.0) * 0.1;
          vec3 col = mix(uSandA, uSandB, n);
          float ripple = sin(p.x * 4.5 + sin(p.y * 2.0) * 1.5 + n * 4.0) * 0.5 + 0.5;
          col *= 0.88 + ripple * 0.16;
          float lam = clamp(dot(vN, normalize(vec3(-0.3, 1.0, 0.45))), 0.0, 1.0);
          col *= 0.5 + 0.6 * lam;
          float c = caustic(p * 0.16, uTime * 0.5) * 0.7 + caustic(p * 0.31 + 3.1, uTime * 0.62) * 0.45;
          col += uCausticColor * c * uCaustic * (0.55 + 0.45 * lam);
          float tn = vnoise(p * 0.22 + 7.3) * 0.7 + vnoise(p * 0.9 + 2.0) * 0.3;
          float tox = smoothstep(0.6, 0.76, tn) * uToxicAmt;
          col = mix(col, uToxic * 0.16, tox * 0.85);
          col += uToxic * tox * (0.1 + 0.07 * sin(uTime * 2.0 + p.x * 0.7));
          float f = smoothstep(uFogNear, uFogFar, vDepth);
          gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.seabed = new THREE.Mesh(bedGeo, this.bedMat);
    this.seabed.frustumCulled = false;
    this.scene.add(this.seabed);

    // ---- water surface seen from below
    const surfGeo = new THREE.PlaneGeometry(240, 110, 1, 1);
    surfGeo.rotateX(Math.PI / 2);
    surfGeo.translate(0, 0, -45);
    this.surfMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uFogColor: U.uFogColor,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uSurf: { value: new THREE.Color() },
        uSurfHi: { value: new THREE.Color() },
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
        uniform float uTime; uniform float uScrollW; uniform vec3 uSurf; uniform vec3 uSurfHi;
        ${GLSL_FOG_PARS}
        varying vec3 vW; varying float vDepth;
        ${GLSL_NOISE}
        void main(){
          vec2 p = vec2(vW.x + uScrollW * 0.35, vW.z);
          float c = caustic(p * 0.07, uTime * 0.35);
          float n = vnoise(p * 0.45 + vec2(uTime * 0.15, 0.0));
          vec3 col = uSurf * (0.6 + 0.5 * n) + uSurfHi * c * 1.25;
          float f = smoothstep(uFogNear * 0.55, uFogFar * 0.85, vDepth);
          col = mix(col, uFogColor, f);
          gl_FragColor = vec4(col, 0.8);
          ${GLSL_OUT}
        }`,
    });
    this.surface = new THREE.Mesh(surfGeo, this.surfMat);
    this.surface.frustumCulled = false;
    this.surface.renderOrder = 5;
    this.scene.add(this.surface);

    // ---- god rays (instanced additive planes)
    const rayGeo = new THREE.PlaneGeometry(1, 1);
    rayGeo.translate(0, -0.5, 0);
    this.rayMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uColor: { value: new THREE.Color() },
        uStr: { value: 0.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying float vPh; varying float vDepth;
        void main(){
          vUv = uv;
          vPh = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 1.3;
          vec4 mv = modelViewMatrix * (instanceMatrix * vec4(position, 1.0));
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; uniform float uStr; uniform float uFogNear; uniform float uFogFar;
        varying vec2 vUv; varying float vPh; varying float vDepth;
        void main(){
          float edge = sin(vUv.x * 3.14159); edge *= edge;
          float len = pow(vUv.y, 1.7);
          float flick = 0.6 + 0.4 * sin(uTime * 0.7 + vPh * 3.0) * sin(uTime * 1.13 + vPh);
          float a = edge * len * flick * uStr * (1.0 - smoothstep(uFogNear, uFogFar * 1.15, vDepth) * 0.75);
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`,
    });
    const rng = mulberry32(77);
    const NR = 11;
    this.rays = new THREE.InstancedMesh(rayGeo, this.rayMat, NR);
    this.rays.frustumCulled = false;
    this.rays.renderOrder = 6;
    this.rayItems = [];
    for (let i = 0; i < NR; i++) {
      this.rayItems.push({
        u: (i + rng() * 0.6) / NR,
        z: lerp(-3, -24, rng()),
        w: lerp(1.0, 3.6, rng()),
        len: lerp(13, 22, rng()),
        tilt: lerp(0.22, 0.36, rng()),
        sway: rng() * TAU,
      });
    }
    this.scene.add(this.rays);

    // ---- marine snow / toxic particulate
    const NS = 340;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      sp[i * 3] = (rng() - 0.5) * 60;
      sp[i * 3 + 1] = rng() * 16 - 8;
      sp[i * 3 + 2] = lerp(-16, 7, Math.pow(rng(), 0.8));
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
        uSpan: { value: 40 },
        uYmin: { value: -7 },
        uYmax: { value: 7 },
        uPx: { value: 600 },
        uColor: { value: new THREE.Color() },
        uAlpha: { value: 0.8 },
        uMap: { value: this.softDot },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform float uSpan; uniform float uYmin; uniform float uYmax; uniform float uPx;
        uniform float uFogNear; uniform float uFogFar;
        attribute float aSeed;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x = mod(p.x - uScrollW + sin(uTime * 0.3 + aSeed * 6.0) * 0.5 + uSpan * 0.5, uSpan) - uSpan * 0.5;
          float hgt = uYmax - uYmin;
          p.y = uYmin + mod(p.y - uYmin - uTime * (0.08 + fract(aSeed * 7.0) * 0.22), hgt);
          p.z += sin(uTime * 0.4 + aSeed * 11.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          gl_PointSize = (0.05 + fract(aSeed * 13.0) * 0.09) * uPx / d;
          float tw = 0.65 + 0.35 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 20.0);
          float near = smoothstep(4.0, 9.0, d);
          vA = (0.35 + 0.65 * fract(aSeed * 3.7)) * (1.0 - smoothstep(uFogNear, uFogFar, d)) * tw * near;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uAlpha; uniform sampler2D uMap;
        varying float vA;
        void main(){
          float a = texture2D(uMap, gl_PointCoord).a * vA * uAlpha;
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`,
    });
    this.snow = new THREE.Points(snowGeo, this.snowMat);
    this.snow.frustumCulled = false;
    this.snow.renderOrder = 7;
    this.scene.add(this.snow);
  }

  // ------------------------------------------------------------------ build: scrolling scenery layers
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

    // far spires / mesas
    {
      const geo = buildSpire(rng);
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, flatShading: true });
      const N = 16;
      const mesh = instanced(geo, mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const tall = rng() < 0.55;
        items.push({
          u: (i + rng() * 0.8) / N,
          z: lerp(-26, -46, rng()),
          dy: -0.5,
          sx: tall ? lerp(1.2, 2.4, rng()) : lerp(3, 6, rng()),
          sy: tall ? lerp(10, 22, rng()) : lerp(4, 8, rng()),
          sz: lerp(1.5, 3, rng()),
          ry: rng() * TAU,
          shade: lerp(0.75, 1.15, rng()),
        });
      }
      this.farLayer = addLayer(mesh, items, 14, { kind: 'far' });
    }
    // mid rocks
    {
      const geo = buildRock(rng, 1);
      const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, flatShading: true });
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
    // kelp
    {
      const geo = buildKelp();
      const mat = patchStd(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
        U,
        { sway: 0.32, glow: true, key: 'kelp' }
      );
      const N = 30;
      const mesh = instanced(geo, mat, N, { glow: true });
      const items = [];
      const kelpCols = ['#2f8a3e', '#4f9a33', '#6f9a2e', '#2a7f5a'].map((h) => new THREE.Color(h));
      const dead = new THREE.Color('#4a3d2c');
      for (let i = 0; i < N; i++) {
        items.push({
          u: rng(),
          z: lerp(-4, -13, rng()),
          dy: -0.15,
          sx: lerp(0.8, 1.4, rng()),
          sy: lerp(3.5, 8, rng()),
          sz: 1,
          ry: (rng() - 0.5) * 0.8,
          lush: kelpCols[i % kelpCols.length],
          dead,
          glow: rng() * 0.1,
        });
      }
      this.kelpLayer = addLayer(mesh, items, 4, { kind: 'kelp' });
    }
    const coralMat = (key, { sway = 0.03, ...extra } = {}) =>
      patchStd(
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, ...extra }),
        U,
        { sway, glow: true, key, rim: { color: new THREE.Color('#ffffff'), str: (this._coralRim ||= { value: 0.2 }) } }
      );
    const coralItems = (N, zNear, zFar, fg, sMin, sMax, rngFn) => {
      const items = [];
      for (let i = 0; i < N; i++) {
        const isFg = i < fg;
        const s = isFg ? lerp(0.45, 0.75, rngFn()) : lerp(sMin, sMax, rngFn());
        items.push({
          u: rngFn(),
          z: isFg ? lerp(1.3, 2.4, rngFn()) : lerp(zNear, zFar, rngFn()),
          dy: -0.08,
          sx: s,
          sy: s * lerp(0.85, 1.25, rngFn()),
          sz: s,
          ry: rngFn() * TAU,
          lush: new THREE.Color(CORAL_LUSH_HEX[Math.floor(rngFn() * CORAL_LUSH_HEX.length)]),
          dead: new THREE.Color(CORAL_DEAD_HEX[Math.floor(rngFn() * CORAL_DEAD_HEX.length)]),
          glow: lerp(0.08, 0.4, rngFn()),
          fg: isFg,
        });
      }
      // shuffle so the visible subset (first K) is spread out
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rngFn() * (i + 1));
        const t = items[i];
        items[i] = items[j];
        items[j] = t;
      }
      return items;
    };
    // staghorn coral (+ glowing tips)
    {
      const { geo, tips } = buildStaghorn(rng);
      this.staghornTips = tips.filter((_, i) => i % 3 === 0).slice(0, 4);
      const N = 26;
      const mesh = instanced(geo, coralMat('stag', { sway: 0.035 }), N, { glow: true });
      this.stagLayer = addLayer(mesh, coralItems(N, -1.3, -7, 4, 1.1, 2.1, rng), 4, { kind: 'coral', tips: true });
    }
    // sea fans
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
      const mat = patchStd(
        new THREE.MeshStandardMaterial({ map: fanTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 }),
        U,
        { sway: 0.12, glow: true, key: 'fan' }
      );
      const N = 12;
      const mesh = instanced(buildFan(), mat, N, { glow: true });
      const items = coralItems(N, -2, -8.5, 0, 0.9, 1.9, rng);
      for (const it of items) it.ry = (rng() - 0.5) * 0.9;
      this.fanLayer = addLayer(mesh, items, 4, { kind: 'coral' });
    }
    // brain coral
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
    // tube sponges
    {
      const N = 10;
      const mesh = instanced(buildTubes(rng), coralMat('tube', { sway: 0.05 }), N, { glow: true });
      this.tubeLayer = addLayer(mesh, coralItems(N, -1.5, -7.5, 2, 1.0, 1.9, rng), 4, { kind: 'coral' });
    }
    // toxic barrels (only while the sea is still poisoned)
    {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 1.25, 16, 4);
      paint(g, (x, y, z, c) => {
        const band = Math.abs(y) > 0.38 && Math.abs(y) < 0.48 ? 0.55 : 1;
        const rust = 0.75 + 0.25 * Math.sin(x * 9 + y * 5) * Math.sin(z * 7);
        c[0] = band * rust;
        c[1] = band * rust * 0.85;
        c[2] = band * rust * 0.55;
      });
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#7a6a3a', roughness: 0.8, metalness: 0.35 });
      const N = 7;
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

    // compose base matrices (rotation/scale fixed; translation is written per frame)
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

  // ------------------------------------------------------------------ build: submarine
  _buildSub() {
    const U = this.U;
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    outer.add(inner);
    outer.rotation.order = 'YZX';
    this.subOuter = outer;
    this.subInner = inner;

    this.hullRim = { value: 0.55 };
    const hullMat = patchStd(new THREE.MeshStandardMaterial({ color: '#ffbf1f', metalness: 0.3, roughness: 0.3 }), U, {
      rim: { color: new THREE.Color('#ffe7a0'), str: this.hullRim },
      key: 'hull',
    });
    const redMat = patchStd(new THREE.MeshStandardMaterial({ color: '#e5322d', metalness: 0.25, roughness: 0.4 }), U, {
      rim: { color: new THREE.Color('#ffb4a0'), str: this.hullRim },
      key: 'red',
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#d7e0ea', metalness: 0.55, roughness: 0.22 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2a3140', metalness: 0.4, roughness: 0.5 });
    this.flashMats = [hullMat, redMat];
    hullMat.userData = { er: 1.0, eg: 0.62, eb: 0.0 };
    redMat.userData = { er: 1.0, eg: 0.1, eb: 0.05 };

    const L0 = -1.22;
    const L1 = 1.3;
    const hr = (x) => {
      const u = clamp((x - L0) / (L1 - L0), 0, 1);
      return 0.56 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 1.36))), 0.55);
    };
    this._hr = hr;
    const pts = [];
    for (let i = 0; i <= 44; i++) {
      const u = i / 44;
      const y = lerp(L0, L1, u);
      pts.push(new THREE.Vector2(Math.max(hr(y), 0.001), y));
    }
    const hullGeo = new THREE.LatheGeometry(pts, 36);
    hullGeo.rotateZ(-Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    inner.add(hull);

    for (const sx of [0.62, -0.62]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(hr(sx) + 0.006, 0.032, 8, 40), redMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = sx;
      inner.add(ring);
    }
    // portholes (camera side)
    const glassBasic = new THREE.MeshBasicMaterial({ color: '#7ff3ff', toneMapped: false });
    for (const px of [-0.5, -0.12]) {
      const r = hr(px);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), glassBasic);
      lens.position.set(px, 0.0, r * 0.985);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 6, 18), chromeMat);
      rim.position.copy(lens.position);
      inner.add(lens, rim);
    }
    // dome + collar
    const domeR = 0.5;
    const domeX = 0.3;
    const domeY = 0.33;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(domeR, 0.045, 8, 36), chromeMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(domeX, domeY, 0);
    inner.add(collar);
    const seat = new THREE.Mesh(new THREE.CircleGeometry(domeR * 0.98, 28), darkMat);
    seat.rotation.x = -Math.PI / 2;
    seat.position.set(domeX, domeY + 0.01, 0);
    inner.add(seat);

    // Pogo
    const pogoMat = patchStd(new THREE.MeshStandardMaterial({ color: '#38d65f', roughness: 0.45, metalness: 0.05 }), U, {
      rim: { color: new THREE.Color('#c9ffb0'), str: { value: 0.5 } },
      key: 'pogo',
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 22, 16), pogoMat);
    head.scale.set(1.08, 0.95, 1);
    head.position.set(domeX + 0.02, domeY + 0.17, 0.02);
    inner.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), pogoMat);
    snout.scale.set(1.3, 0.8, 1);
    snout.position.set(domeX + 0.2, domeY + 0.13, 0.03);
    inner.add(snout);
    const eyeW = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, emissive: '#ffffff', emissiveIntensity: 0.25 });
    const eyeB = new THREE.MeshBasicMaterial({ color: '#05060a' });
    for (const ez of [0.1, -0.08]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 10), eyeW);
      w.position.set(domeX + 0.1, domeY + 0.33, ez);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), eyeB);
      p.position.set(domeX + 0.17, domeY + 0.34, ez + 0.035);
      inner.add(w, p);
    }
    const antMat = new THREE.MeshStandardMaterial({ color: '#2fb14f', roughness: 0.5 });
    const tipMat = new THREE.MeshStandardMaterial({ color: '#ff6fb5', emissive: '#ff3f9a', emissiveIntensity: 0.9 });
    for (const az of [0.07, -0.05]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.24, 6), antMat);
      stalk.position.set(domeX - 0.08, domeY + 0.38, az);
      stalk.rotation.z = 0.45;
      stalk.rotation.x = az > 0 ? -0.25 : 0.25;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), tipMat);
      tip.position.set(domeX - 0.135, domeY + 0.49, az * 1.45);
      inner.add(stalk, tip);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 30, 16, 0, TAU, 0, Math.PI / 2), glassMaterial());
    dome.position.set(domeX, domeY, 0);
    dome.renderOrder = 3;
    inner.add(dome);

    // periscope
    const peri = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.42, 8), chromeMat);
    peri.position.set(-0.32, 0.62, 0);
    const periHead = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.065, 0.07), chromeMat);
    periHead.position.set(-0.28, 0.84, 0);
    inner.add(peri, periHead);

    // fins
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.38, 0);
    finShape.lineTo(0.06, 0.36);
    finShape.lineTo(-0.14, 0.36);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.045, bevelEnabled: false });
    finGeo.translate(-0.2, 0, -0.0225);
    const fr = hr(-0.95);
    const finTop = new THREE.Mesh(finGeo, redMat);
    finTop.position.set(-0.92, fr * 0.7, 0);
    const finBot = new THREE.Mesh(finGeo, redMat);
    finBot.position.set(-0.92, -fr * 0.7, 0);
    finBot.scale.y = -0.8;
    const finL = new THREE.Mesh(finGeo, redMat);
    finL.rotation.x = Math.PI / 2;
    finL.position.set(-0.92, 0, fr * 0.7);
    const finR = new THREE.Mesh(finGeo, redMat);
    finR.rotation.x = -Math.PI / 2;
    finR.position.set(-0.92, 0, -fr * 0.7);
    inner.add(finTop, finBot, finL, finR);
    for (const dz of [1, -1]) {
      const plane = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.2), redMat);
      plane.position.set(0.72, -0.08, dz * (hr(0.72) + 0.06));
      inner.add(plane);
    }

    // propeller
    const prop = new THREE.Group();
    prop.position.set(-1.27, 0, 0);
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.2, 12), chromeMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.x = -0.05;
    prop.add(hub);
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.1), chromeMat);
      const holder = new THREE.Group();
      holder.rotation.x = (k * Math.PI) / 2;
      blade.position.y = 0.13;
      blade.rotation.y = 0.55;
      holder.add(blade);
      prop.add(holder);
    }
    inner.add(prop);
    this.prop = prop;
    const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 8, 28), redMat);
    shroud.rotation.y = Math.PI / 2;
    shroud.position.set(-1.27, 0, 0);
    inner.add(shroud);
    for (let k = 0; k < 2; k++) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.02), redMat);
      strut.position.set(-1.2, k ? 0.25 : -0.25, 0);
      inner.add(strut);
    }

    // headlight
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 18), chromeMat);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(1.28, 0, 0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.085, 18), new THREE.MeshBasicMaterial({ color: '#fff8d8', toneMapped: false }));
    lens.rotation.y = Math.PI / 2;
    lens.position.set(1.315, 0, 0);
    inner.add(cap, lens);
    const coneGeo = new THREE.ConeGeometry(1.15, 4.5, 28, 1, true);
    coneGeo.rotateZ(Math.PI / 2);
    coneGeo.translate(1.32 + 2.25, 0, 0);
    this.coneMat = lightConeMaterial();
    this.cone = new THREE.Mesh(coneGeo, this.coneMat);
    this.cone.renderOrder = 8;
    inner.add(this.cone);
    this.spot = new THREE.SpotLight('#fff1c4', 40, 14, 0.5, 0.7, 1.4);
    this.spot.position.set(1.3, 0, 0);
    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(5, -0.3, 0);
    inner.add(this.spot, this.spotTarget);
    this.spot.target = this.spotTarget;

    this.scene.add(outer);
  }

  // ------------------------------------------------------------------ build: gameplay entities
  _buildEntities() {
    const U = this.U;
    const fishMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.12 }), U, {
      wag: true,
      glow: true,
      rim: { color: new THREE.Color('#ffffff'), str: { value: 0.55 } },
      key: 'fish',
    });
    const fishGeo = buildFish();
    this.fishMesh = instanced(fishGeo, fishMat, MAX_FISH, { glow: true, anim: true });
    this.ambMesh = instanced(buildFish(true), fishMat, MAX_AMB, { glow: true, anim: true });
    this.scene.add(this.fishMesh, this.ambMesh);

    // background schools (purely decorative)
    const rng = mulberry32(4321);
    this.ambSchools = [];
    const ambCols = ['#a9c9dc', '#7fb3d0', '#c7d9a8', '#e0b98a', '#9fd6c9'].map((h) => new THREE.Color(h));
    for (let k = 0; k < 6; k++) {
      this.ambSchools.push({
        u: rng(),
        z: lerp(-6, -15, rng()),
        yf: lerp(0.18, 0.7, rng()),
        speed: lerp(0.4, 1.4, rng()) * (rng() < 0.25 ? -1 : 1),
        n: 14 + Math.floor(rng() * 8),
        R: lerp(1.0, 1.8, rng()),
        phase: rng() * TAU,
        size: lerp(0.16, 0.24, rng()),
        color: ambCols[k % ambCols.length],
      });
    }

    this.shellMesh = instanced(new THREE.SphereGeometry(1, 22, 16), bubbleShellMaterial(U), MAX_SHELL, { color: false });
    this.shellMesh.renderOrder = 12;
    this.scene.add(this.shellMesh);

    // jellyfish
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

    // mines
    const mineMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.35 }), U, {
      rim: { color: new THREE.Color('#ff4a2a'), str: (this.mineRim = { value: 0.9 }) },
      key: 'mine',
    });
    this.mineMesh = instanced(buildMine(), mineMat, MAX_MINE, { color: false });
    const link = new THREE.TorusGeometry(0.5, 0.15, 5, 10);
    const linkMat = new THREE.MeshStandardMaterial({ color: '#4b5160', metalness: 0.6, roughness: 0.45 });
    this.linkMesh = instanced(link, linkMat, MAX_LINKS, { color: false });
    const anchor = new THREE.CylinderGeometry(0.55, 0.75, 0.45, 8);
    this.anchorMesh = instanced(anchor, new THREE.MeshStandardMaterial({ color: '#3a3f4a', roughness: 0.7, metalness: 0.4 }), MAX_MINE, {
      color: false,
    });
    this.scene.add(this.mineMesh, this.linkMesh, this.anchorMesh);

    // clams
    const shellGeo = buildShell();
    const clamMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }), U, {
      nacre: true,
      rim: { color: new THREE.Color('#ffd6ec'), str: { value: 0.3 } },
      key: 'clam',
    });
    // bottom shell: mirrored copy with the triangle winding fixed so front faces stay outside
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
    const pearlMat = new THREE.MeshStandardMaterial({ color: '#fff7fb', emissive: '#ffd0ea', emissiveIntensity: 0.55, roughness: 0.12 });
    this.pearlMesh = instanced(new THREE.SphereGeometry(1, 16, 12), pearlMat, MAX_CLAM, { color: false });
    this.scene.add(this.clamBot, this.clamTop, this.pearlMesh);

    // additive glows (soft-dot quads) for everything that shines
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
    // dark soft halos behind the sub and hazards so they read against bright, busy water
    this.shadeMat = new THREE.MeshBasicMaterial({
      map: this.softDot,
      color: '#00060e',
      transparent: true,
      depthWrite: false,
      opacity: 0.3,
      toneMapped: false,
    });
    this.shadeMesh = instanced(new THREE.PlaneGeometry(1, 1), this.shadeMat, 48, { color: false });
    this.shadeMesh.renderOrder = 1;
    this.scene.add(this.shadeMesh);

    // shock-wave rings
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
    this.ringMesh = instanced(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      MAX_RING
    );
    this.ringMesh.renderOrder = 13;
    this.scene.add(this.ringMesh);

    // wake / ambient rising bubbles (points)
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
    this.wake = [];
    for (let i = 0; i < MAX_WAKE; i++) this.wake.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0.1 });
    this._wakeIdx = 0;
    this._wakeAcc = 0;
    this._ventAcc = 0;
    const wg = new THREE.BufferGeometry();
    this.wakePos = new Float32Array(MAX_WAKE * 3);
    this.wakeSize = new Float32Array(MAX_WAKE);
    this.wakeAlpha = new Float32Array(MAX_WAKE);
    wg.setAttribute('position', new THREE.BufferAttribute(this.wakePos, 3).setUsage(THREE.DynamicDrawUsage));
    wg.setAttribute('aSize', new THREE.BufferAttribute(this.wakeSize, 1).setUsage(THREE.DynamicDrawUsage));
    wg.setAttribute('aAlpha', new THREE.BufferAttribute(this.wakeAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.wakeMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: bubbleTex }, uPx: { value: 600 }, uColor: { value: new THREE.Color('#e6fbff') } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float uPx; attribute float aSize; attribute float aAlpha; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx / -mv.z; vA = aAlpha; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.wakePoints = new THREE.Points(wg, this.wakeMat);
    this.wakePoints.frustumCulled = false;
    this.wakePoints.renderOrder = 14;
    this.scene.add(this.wakePoints);
  }

  // ------------------------------------------------------------------ build: rubble + next tower
  _buildTowers() {
    const rng = mulberry32(99);
    // the tower you just toppled: a broken, sunken stump
    let g = new THREE.CylinderGeometry(2.3, 2.6, 1, 28, 8, true);
    g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const a = Math.atan2(p.getZ(i), p.getX(i));
      if (y > 0.99) p.setY(i, 0.55 + Math.abs(Math.sin(a * 3.3 + 1)) * 0.35 + Math.sin(a * 11) * 0.08);
    }
    g.computeVertexNormals();
    const stoneTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#4a4658';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * 16;
        for (let c = -1; c < 8; c++) {
          const v = 92 + Math.floor(rng() * 40);
          ctx.fillStyle = `rgb(${v},${v - 6},${v + 14})`;
          ctx.fillRect(c * 32 + off + 2, r * 32 + 2, 28, 28);
        }
      }
    }, { repeat: true });
    stoneTex.repeat.set(4, 2);
    this.rubble = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, side: THREE.DoubleSide, color: '#ffffff', emissive: '#1a1426' }));
    this.rubble.scale.set(1, 6, 1);
    this.rubble.rotation.z = 0.12;
    this.scene.add(this.rubble);
    const bg = new THREE.BoxGeometry(1, 0.7, 0.9);
    this.blocks = instanced(bg, new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, color: '#ffffff', emissive: '#1a1426' }), 9, { color: false });
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

    // the next tower: dark cylinder with glowing windows (palette.glow)
    const towerTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#121626';
      ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < 8; r++) {
        const off = (r % 2) * 16;
        for (let c = -1; c < 8; c++) {
          const v = 24 + Math.floor(rng() * 16);
          ctx.fillStyle = `rgb(${v},${v + 4},${v + 18})`;
          ctx.fillRect(c * 32 + off + 2, r * 32 + 2, 28, 28);
        }
      }
      ctx.fillStyle = '#05070e';
      ctx.fillRect(84, 60, 88, 120);
    }, { repeat: true });
    const winTex = canvasTex(256, 256, (ctx, w, h) => {
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
      // thin glowing ledge line
      ctx.fillStyle = '#666';
      ctx.fillRect(0, 250, 256, 6);
    }, { repeat: true });
    this.towerTex = towerTex;
    this.winTex = winTex;
    const tg = new THREE.CylinderGeometry(1, 1, 1, 56, 1, true);
    tg.translate(0, 0.5, 0);
    this.towerMat = new THREE.MeshStandardMaterial({
      map: towerTex,
      emissiveMap: winTex,
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 2.4,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.nextTower = new THREE.Mesh(tg, this.towerMat);
    this.nextTower.visible = false;
    this.scene.add(this.nextTower);
    const baseG = new THREE.CylinderGeometry(1.12, 1.25, 0.6, 56, 1, false);
    baseG.translate(0, 0.3, 0);
    this.towerBase = new THREE.Mesh(baseG, new THREE.MeshStandardMaterial({ color: '#1a1f33', roughness: 0.8, emissive: '#000000' }));
    this.towerBase.visible = false;
    this.scene.add(this.towerBase);
  }

  // ------------------------------------------------------------------ build: overlay (HUD, popups, particles)
  _buildOverlay() {
    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 390, 0, -620, -10, 10);

    this.vigMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#020c16') }, uStr: { value: 0.5 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color('#ff3d6e') } },
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
    this.vignette = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.vigMat);
    this.vignette.renderOrder = 0;
    this.overlay.add(this.vignette);

    // game particles (screen px)
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
    this.partPoints.renderOrder = 1;
    this.overlay.add(this.partPoints);

    // popups
    this._popCache = new Map();
    this._popFrame = 0;
    this.popPool = [];
    const quad = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < MAX_POP; i++) {
      const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      m.visible = false;
      m.renderOrder = 2;
      this.overlay.add(m);
      this.popPool.push(m);
    }

    // HUD: progress track (static canvas), fill, marker, stats text
    this.hudTrack = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
    this.hudFill = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
    this.hudMarker = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
    this.hudStats = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }));
    this.hudTrack.renderOrder = 3;
    this.hudFill.renderOrder = 4;
    this.hudMarker.renderOrder = 5;
    this.hudStats.renderOrder = 3;
    this.overlay.add(this.hudTrack, this.hudFill, this.hudMarker, this.hudStats);
    this._hudKey = '';
    this._statsKey = '';
    this._statsCanvas = document.createElement('canvas');
    this._statsTex = new THREE.CanvasTexture(this._statsCanvas);
    this._statsTex.colorSpace = THREE.SRGBColorSpace;
    this.hudStats.material.map = this._statsTex;

    // marker: tiny yellow sub icon
    this.hudMarker.material.map = canvasTex(96, 64, (ctx) => {
      ctx.translate(48, 34);
      ctx.fillStyle = 'rgba(255,214,90,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffc21f';
      ctx.strokeStyle = '#3b2a05';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 4, 30, 13, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#9ff0ff';
      ctx.beginPath();
      ctx.arc(4, -8, 11, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#39d65f';
      ctx.beginPath();
      ctx.arc(5, -9, 5.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e5322d';
      ctx.fillRect(-36, -4, 7, 16);
    });
    this.hudFill.material.map = canvasTex(256, 16, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#6ee7ff');
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(0, 2, w, 4);
    });
  }

  _rebuildHud(stage) {
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const W = this.width;
    const key = `${W}|${pr}|${stage.nextGlow}|${stage.towerIndex}`;
    if (key === this._hudKey) return;
    this._hudKey = key;
    const h = 30;
    if (this.hudTrack.material.map) this.hudTrack.material.map.dispose();
    const glow = stage.nextGlow || '#38bdf8';
    this.hudTrack.material.map = canvasTex(Math.round(W * pr), Math.round(h * pr), (ctx) => {
      ctx.scale(pr, pr);
      const x0 = 34;
      const x1 = W - 34;
      const y = 14;
      ctx.fillStyle = 'rgba(2,8,20,0.55)';
      ctx.strokeStyle = 'rgba(160,240,255,0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x0, y - 5, x1 - x0, 10, 5);
      else ctx.rect(x0, y - 5, x1 - x0, 10);
      ctx.fill();
      ctx.stroke();
      // toppled tower icon (broken, left)
      ctx.fillStyle = '#8b86a0';
      ctx.beginPath();
      ctx.moveTo(10, 24);
      ctx.lineTo(10, 10);
      ctx.lineTo(14, 13);
      ctx.lineTo(17, 7);
      ctx.lineTo(21, 12);
      ctx.lineTo(24, 9);
      ctx.lineTo(24, 24);
      ctx.closePath();
      ctx.fill();
      // next tower icon (right) in its glow colour
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#1a2036';
      ctx.fillRect(W - 25, 3, 15, 22);
      ctx.fillStyle = glow;
      ctx.fillRect(W - 21, 7, 3, 4);
      ctx.fillRect(W - 16, 7, 3, 4);
      ctx.fillRect(W - 21, 15, 3, 4);
      ctx.fillRect(W - 16, 15, 3, 4);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(W - 25, 3, 15, 22);
    });
    this.hudTrack.scale.set(W, h, 1);
    this.hudTrack.position.set(W / 2, -h / 2 - 4, 0);
    this._trackX0 = 36;
    this._trackX1 = W - 36;
    this._trackY = 4 + 14;
  }

  _drawStats(stage) {
    const mult = stage.mult || 1;
    const key = `${this.width}|${stage.fishCaught}|${stage.pearls}|${mult}`;
    if (key === this._statsKey) return;
    this._statsKey = key;
    const pr = Math.min(2, this.gl.getPixelRatio ? this.gl.getPixelRatio() : 1);
    const W = this.width;
    const h = 24;
    const c = this._statsCanvas;
    const cw = Math.round(W * pr);
    const ch = Math.round(h * pr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
      this._statsTex.dispose();
      this._statsTex = new THREE.CanvasTexture(c);
      this._statsTex.colorSpace = THREE.SRGBColorSpace;
      this.hudStats.material.map = this._statsTex;
      this.hudStats.material.needsUpdate = true;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, W, h);
    ctx.font = '800 13px Orbitron, "Arial Black", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const txt = (s, x, color, align = 'left') => {
      ctx.textAlign = align;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2,6,16,0.85)';
      ctx.strokeText(s, x, h / 2);
      ctx.fillStyle = color;
      ctx.fillText(s, x, h / 2);
    };
    // fish glyph
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(20, h / 2, 7, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(26, h / 2);
    ctx.lineTo(32, h / 2 - 5);
    ctx.lineTo(32, h / 2 + 5);
    ctx.fill();
    txt(`${stage.fishCaught}`, 37, '#ffe7c2');
    // pearl glyph
    const px = 86;
    ctx.fillStyle = '#ffe4f3';
    ctx.beginPath();
    ctx.arc(px, h / 2, 5.5, 0, TAU);
    ctx.fill();
    txt(`${stage.pearls}`, px + 10, '#ffe4f3');
    if (mult > 1) txt(`COMBO x${mult}`, W - 14, mult >= 4 ? '#fde047' : '#f9a8d4', 'right');
    this._statsTex.needsUpdate = true;
    this.hudStats.scale.set(W, h, 1);
    this.hudStats.position.set(W / 2, -(32 + h / 2), 0);
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
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(text, c.width / 2, c.height / 2 - 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    e = { tex, aspect: c.width / c.height, used: this._popFrame };
    this._popCache.set(key, e);
    if (this._popCache.size > 48) {
      for (const [k, v] of this._popCache) {
        if (v.used < this._popFrame - 2) {
          v.tex.dispose();
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

  // ------------------------------------------------------------------ healing look
  _applyHealing(h) {
    this._heal = h;
    const C = this.colors;
    for (const k in PAL) mix3(C[k], PAL[k], h);
    this.fogColor.copy(C.fog);
    this.scene.fog.color.copy(C.fog);
    this.U.uFogFar.value = CAM_Z + lerp(24, 76, h);
    this.U.uFogNear.value = CAM_Z - 0.5;
    this.scene.fog.near = this.U.uFogNear.value;
    this.scene.fog.far = this.U.uFogFar.value;
    this.hemi.color.copy(C.hemiSky);
    this.hemi.groundColor.copy(C.hemiGround);
    this.hemi.intensity = lerp(1.55, 2.1, h);
    this.sun.color.copy(C.sun);
    this.sun.intensity = lerp(0.9, 2.6, h);
    this.back.intensity = lerp(0.7, 1.1, h);
    this.back.color.set(h < 0.4 ? '#c18cff' : '#7ee8ff');
    const bu = this.bedMat.uniforms;
    bu.uSandA.value.copy(C.sandA);
    bu.uSandB.value.copy(C.sandB);
    bu.uCausticColor.value.copy(C.caustic);
    bu.uCaustic.value = lerp(0.14, 0.8, h);
    bu.uToxic.value.copy(C.toxic);
    bu.uToxicAmt.value = Math.pow(1 - h, 1.4);
    this.surfMat.uniforms.uSurf.value.copy(C.surf);
    this.surfMat.uniforms.uSurfHi.value.copy(C.surfHi);
    this.rayMat.uniforms.uColor.value.copy(C.ray);
    this.rayMat.uniforms.uStr.value = lerp(0.12, 0.55, h);
    this.snowMat.uniforms.uColor.value.copy(C.snow);
    this.snowMat.uniforms.uAlpha.value = lerp(0.95, 0.6, h);
    this.vigMat.uniforms.uColor.value.copy(C.vignette);
    this.vigMat.uniforms.uStr.value = lerp(0.45, 0.32, h);
    this._coralRim.value = lerp(0.08, 0.28, h);
    this.shadeMat.opacity = lerp(0.0, 0.42, h);

    const c = this._c;
    // far + rock colours
    for (let i = 0; i < this.farLayer.items.length; i++) {
      c.copy(C.far).multiplyScalar(this.farLayer.items[i].shade);
      this.farLayer.mesh.setColorAt(i, c);
    }
    for (let i = 0; i < this.rockLayer.items.length; i++) {
      c.copy(C.rock).multiplyScalar(this.rockLayer.items[i].shade);
      this.rockLayer.mesh.setColorAt(i, c);
    }
    this.farLayer.mesh.instanceColor.needsUpdate = true;
    this.rockLayer.mesh.instanceColor.needsUpdate = true;

    // coral: dead & bleached -> lush & glowing; sparse -> dense
    const coralFrac = 0.34 + 0.66 * h;
    for (const layer of [this.stagLayer, this.fanLayer, this.brainLayer, this.tubeLayer, this.kelpLayer]) {
      const glowAttr = layer.mesh.geometry.attributes.aGlow;
      const isKelp = layer === this.kelpLayer;
      for (let i = 0; i < layer.items.length; i++) {
        const it = layer.items[i];
        c.lerpColors(it.dead, it.lush, isKelp ? Math.min(1, h * 1.3) : h);
        if (it.fg) c.multiplyScalar(0.55);
        layer.mesh.setColorAt(i, c);
        glowAttr.array[i] = isKelp ? it.glow * h : it.glow * h * h * (it.fg ? 0.4 : 1);
        if (isKelp) it.kScale = lerp(0.32, 1, h);
      }
      glowAttr.needsUpdate = true;
      layer.mesh.instanceColor.needsUpdate = true;
      layer.visibleFrac = isKelp ? 0.2 + 0.55 * h : coralFrac;
      layer.mesh.count = Math.max(1, Math.round(layer.items.length * layer.visibleFrac));
    }
    this._composeLayer(this.kelpLayer);
    this.barrelLayer.mesh.count = Math.round(this.barrelLayer.items.length * clamp((0.85 - h) / 0.85, 0, 1));
    for (let i = 0; i < this.barrelLayer.items.length; i++) this.barrelLayer.mesh.setColorAt(i, this._white);
    this.barrelLayer.mesh.instanceColor.needsUpdate = true;
    this.farLayer.mesh.count = this.farLayer.items.length;
    this.rockLayer.mesh.count = this.rockLayer.items.length;
  }

  // ------------------------------------------------------------------ glow helpers
  _glowBegin() {
    this._sN = 0;
    this._gN = 0;
  }
  _glow(x, y, z, size, r, g, b) {
    if (this._gN >= MAX_GLOW) return;
    const i = this._gN++;
    const m = this.glowMesh.instanceMatrix.array;
    const o = i * 16;
    m[o] = size;
    m[o + 1] = 0;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = size;
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
  _shade(x, y, size, sy = size) {
    if (this._sN >= 48) return;
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
  }

  // ------------------------------------------------------------------ render
  render(stage, { time = 0, particles = null, popups = null, shake = 0 } = {}) {
    if (!stage) return;
    const gl = this.gl;
    const dt = this._lastTime === null ? 1 / 60 : clamp(time - this._lastTime, 0, 0.05);
    this._lastTime = time;
    this._kx = stage.width ? this.width / stage.width : 1;
    this._ky = stage.height ? this.height / stage.height : 1;
    const U = this.U;
    U.uTime.value = time;
    const h = clamp(stage.healing || 0, 0, 1);
    if (Math.abs(h - this._heal) > 0.0005) this._applyHealing(h);

    const pxw = this._pxw(0) * this._kx;
    const pxwY = this._pxw(0) * this._ky;
    const scrollW = (stage.scroll || 0) * pxw;
    U.uScrollW.value = scrollW;
    const v = this._v;
    const seabedW = this._toWorld(0, stage.seabedY ?? stage.height * 0.905, 0, v).y;
    const surfW = this._toWorld(0, stage.surfaceY ?? stage.height * 0.085, 0, v).y;
    this._seabedW = seabedW;
    this._surfW = surfW;
    this.seabed.position.y = seabedW;
    this.surface.position.y = surfW + 0.15;
    this.snowMat.uniforms.uYmin.value = seabedW - 1;
    this.snowMat.uniforms.uYmax.value = surfW + 1;
    const pr = gl.getPixelRatio ? gl.getPixelRatio() : 1;
    const focal = (this.height * pr) / (2 * Math.tan(FOV * 0.5 * DEG));
    this.snowMat.uniforms.uPx.value = focal;
    this.wakeMat.uniforms.uPx.value = focal;

    this._updateLayers(scrollW, seabedW, h, time);
    this._updateRays(scrollW, surfW, time);

    this._glowBegin();
    this._updateCoralGlows(h, time);
    this._updateTowers(stage, scrollW, seabedW, surfW, time, h);
    this._updateSub(stage, time, dt, pxw);
    this._updateFish(stage, time, pxw);
    this._updateAmbient(stage, time, scrollW, seabedW, surfW, h);
    this._updateShells(stage, time, pxw);
    this._updateJellies(stage, time, pxw);
    this._updateMines(stage, time, pxw, seabedW);
    this._updateClams(stage, time, pxw, seabedW, h);
    this._updateRings(stage, pxw);
    this._updateWake(stage, dt, seabedW, surfW, h, scrollW);
    this._glowEnd();

    // overlay
    this._popFrame++;
    this._rebuildHud(stage);
    this._drawStats(stage);
    this._updateHud(stage, time);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, stage);
    const sub = stage.sub;
    const flash = sub && sub.stun > 0 ? (sub.stun / (sub.stunMax || 1)) * 0.35 : 0;
    this.vigMat.uniforms.uFlash.value = flash;

    // camera shake (mapping uses the unshaken camera, so entities shake with the world)
    const mag = (Number(typeof shake === 'object' ? Math.hypot(shake.x || 0, shake.y || 0) : shake) || 0) * 0.022;
    this.camera.position.set(Math.sin(time * 73.7) * mag, Math.cos(time * 61.3) * mag * 0.85, CAM_Z);
    this.camera.updateMatrixWorld();

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

  _updateLayers(scrollW, seabedW) {
    for (const layer of this.layers) {
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
        const y = seabedW + duneRaw(x + scrollW, it.z) * duneAmp(it.z) + it.dy * (layer.kind === 'far' || layer.kind === 'rock' ? it.sy * 0.1 + 0.5 : 1);
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
      d.position.set(x - 2, surfW + 0.4, it.z);
      d.rotation.set(0, 0, it.tilt + Math.sin(time * 0.25 + it.sway) * 0.04);
      d.scale.set(it.w * (1 + Math.sin(time * 0.4 + it.sway) * 0.15), it.len, 1);
      d.updateMatrix();
      this.rays.setMatrixAt(i, d.matrix);
    }
    this.rays.instanceMatrix.needsUpdate = true;
  }

  _updateCoralGlows(h, time) {
    if (h < 0.12) {
      // toxic barrels leak a sickly glow instead
      const bl = this.barrelLayer;
      const k = 1 - h / 0.85;
      for (let i = 0; i < bl.mesh.count; i++) {
        const it = bl.items[i];
        const p = 0.6 + 0.4 * Math.sin(time * 2.3 + i * 1.7);
        this._glow(it.x, it.y + 0.3, it.z + 0.6, 2.4, 0.25 * p * k, 0.7 * p * k, 0.12 * p * k);
      }
      return;
    }
    const bl = this.barrelLayer;
    for (let i = 0; i < bl.mesh.count; i++) {
      const it = bl.items[i];
      const k = clamp((0.85 - h) / 0.85, 0, 1);
      const p = 0.6 + 0.4 * Math.sin(time * 2.3 + i * 1.7);
      this._glow(it.x, it.y + 0.3, it.z + 0.6, 2.2, 0.25 * p * k, 0.7 * p * k, 0.12 * p * k);
    }
    const L = this.stagLayer;
    const tips = this.staghornTips || [];
    const k = (h - 0.12) / 0.88;
    for (let i = 0; i < L.mesh.count; i++) {
      const it = L.items[i];
      if (it.fg || !it.tipOff) continue;
      for (let t = 0; t < tips.length; t++) {
        const o = it.tipOff[t];
        const p = 0.55 + 0.45 * Math.sin(time * 2.1 + i * 2.3 + t * 1.7);
        const s = it.sx * 0.5 * p;
        const c = it.lush;
        this._glow(it.x + o.x, it.y + o.y, it.z + o.z + 0.1, s, c.r * k * p * 0.9, c.g * k * p * 0.9, c.b * k * p * 0.9);
      }
    }
    // soft bioluminescent halo on brain coral & tubes
    for (const layer of [this.brainLayer, this.tubeLayer]) {
      for (let i = 0; i < layer.mesh.count; i++) {
        const it = layer.items[i];
        if (it.fg) continue;
        const c = it.lush;
        const p = 0.5 + 0.5 * Math.sin(time * 1.3 + i);
        this._glow(it.x, it.y + it.sy * 0.6, it.z - 0.2, it.sx * 2.6, c.r * 0.16 * k * p, c.g * 0.16 * k * p, c.b * 0.16 * k * p);
      }
    }
  }

  _updateTowers(stage, scrollW, seabedW, surfW, time, h) {
    const v = this._v;
    // rubble of the tower we toppled, scrolling away behind us
    const rx0 = this._toWorld(stage.width * 0.5, 0, RUBBLE_Z, v).x;
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

    // the next tower rising into view
    const tw = stage.tower;
    const show = !!(tw && tw.active);
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
    this.towerMat.emissiveIntensity = 2.0 + arrive * 1.6 + Math.sin(time * 2) * 0.2;
    const g = this._glowColor;
    // halo to lift the silhouette off the background
    const hs = 0.22 + arrive * 0.18;
    this._glow(x, seabedW + 2.2, TOWER_Z - 1.2, R * 4.4, g.r * hs, g.g * hs, g.b * hs);
    this._glow(x, (seabedW + surfW) * 0.5, TOWER_Z - 1.2, R * 5.5, g.r * hs * 0.6, g.g * hs * 0.6, g.b * hs * 0.6);
    this._glow(x - R * 0.2, surfW + 0.2, TOWER_Z + R + 0.1, R * 3.2, g.r * 0.25, g.g * 0.25, g.b * 0.25);
  }

  _updateSub(stage, time, dt, pxw) {
    const sub = stage.sub;
    const outer = this.subOuter;
    if (!sub) {
      outer.visible = false;
      return;
    }
    outer.visible = true;
    const v = this._toWorld(sub.x, sub.y, 0, this._v);
    const sc = (sub.rx * pxw) / 1.15;
    const bob = Math.sin(time * 2.1) * 0.05 * sc;
    outer.position.set(v.x, v.y + bob, 0);
    outer.scale.setScalar(sc);
    const tilt = clamp(-(sub.vy || 0) * 0.0017, -0.36, 0.36) + Math.sin(time * 1.7) * 0.025;
    const surf = sub.surfaced || 0;
    outer.rotation.set(0, -0.28 + clamp((sub.vx || 0) * 0.0006, -0.12, 0.12), tilt * (1 - surf) + surf * Math.sin(time * 2.5) * 0.06);
    this.subInner.rotation.x = sub.spin || 0;
    this.prop.rotation.x += dt * (6 + (sub.prop ?? 1) * 26);

    // stun flashing / invulnerability blink
    let fl = 0;
    if (sub.stun > 0) fl = Math.sin(time * 42) > 0 ? 1.1 : 0.15;
    else if (sub.invuln > 0) fl = Math.sin(time * 26) > 0.4 ? 0.35 : 0;
    const base = lerp(0.07, 0.015, this._heal); // keep the hull vivid in murky water
    for (const m of this.flashMats) {
      m.emissive.setRGB(fl + base * m.userData.er, fl * 0.9 + base * m.userData.eg, fl * 0.95 + base * m.userData.eb);
    }
    const lightOn = sub.stun > 0 ? (Math.sin(time * 30) > 0 ? 0.3 : 0) : 1;
    const h = this._heal;
    this.coneMat.uniforms.uStr.value = lerp(0.42, 0.24, h) * lightOn;
    this.spot.intensity = lerp(55, 32, h) * lightOn;
    // headlight lens glow + soft halo around the sub to make it pop on any background
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    const nx = v.x + 1.3 * sc * c * 0.96;
    const ny = v.y + bob + 1.3 * sc * s;
    this._glow(nx, ny, 0.6, sc * 1.1 * lightOn, 1.0 * lightOn, 0.95 * lightOn, 0.7 * lightOn);
    this._glow(v.x, v.y + bob, -0.8, sc * 4.6, 0.14, 0.12, 0.05);
    this._shade(v.x, v.y + bob, sc * 5.2, sc * 3.6);
    this._subTail = this._subTail || new THREE.Vector3();
    this._subTail.set(v.x - 1.45 * sc * c, v.y + bob - 1.45 * sc * s, 0);
    this._subSc = sc;
  }

  _fishColor(f, out) {
    if (f.type === 'gold') return out.copy(this._fishGold);
    if (f.type === 'big') return out.copy(this._fishBig[f.color % this._fishBig.length]);
    return out.copy(this._fishSmall[f.color % this._fishSmall.length]);
  }

  _updateFish(stage, time, pxw) {
    const fish = stage.fish || [];
    const mesh = this.fishMesh;
    const d = this._dummy;
    const anim = mesh.geometry.attributes.aAnim.array;
    const glow = mesh.geometry.attributes.aGlow.array;
    const c = this._c;
    let n = 0;
    for (let i = 0; i < fish.length && n < MAX_FISH; i++) {
      const f = fish[i];
      const v = this._toWorld(f.x, f.y, 0, this._v);
      const s = f.r * pxw * 1.25;
      d.position.set(v.x, v.y, f.type === 'small' ? 0.1 : 0);
      const bubbled = f.state === 'bubbled' && f.bubbleT >= 0;
      if (bubbled) {
        d.rotation.set(Math.sin(time * 2 + f.seed) * 0.3, f.dir > 0 ? Math.PI : 0, Math.sin(time * 2.6 + f.seed) * 0.45);
      } else {
        d.rotation.set(0, f.dir > 0 ? Math.PI : 0, clamp((f.vy || 0) * 0.004, -0.5, 0.5));
      }
      if (f.type === 'big') d.scale.set(s, s * 1.4, s * 1.15);
      else d.scale.set(s, s, s);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      this._fishColor(f, c);
      mesh.setColorAt(n, c);
      anim[n * 3] = bubbled ? 15 : f.state === 'free' ? 16 : f.type === 'big' ? 6 : 10;
      anim[n * 3 + 1] = f.seed * 3;
      anim[n * 3 + 2] = bubbled ? 0.9 : f.type === 'big' ? 0.55 : 0.75;
      glow[n] = f.type === 'gold' ? 0.75 + 0.35 * Math.sin(time * 6) : f.type === 'big' ? 0.12 : 0.22;
      // halo behind catchable fish
      const hk = f.type === 'gold' ? 0.55 : f.type === 'big' ? 0.12 : 0.2;
      if (f.type !== 'small') this._shade(v.x, v.y, s * 4.2, s * 3.4);
      this._glow(v.x, v.y, -0.5, s * (f.type === 'gold' ? 5 : 3.2), c.r * hk, c.g * hk, c.b * hk);
      if (f.type === 'gold' && (Math.sin(time * 9 + i) > 0.6)) {
        this._glow(v.x + Math.sin(time * 3.1) * s, v.y + Math.cos(time * 2.3) * s * 0.6, 0.6, s * 0.9, 1, 0.95, 0.6);
      }
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aAnim.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
  }

  _updateAmbient(stage, time, scrollW, seabedW, surfW, h) {
    const mesh = this.ambMesh;
    const d = this._dummy;
    const anim = mesh.geometry.attributes.aAnim.array;
    const glow = mesh.geometry.attributes.aGlow.array;
    const c = this._c;
    const sick = this._c2.set('#7d8a6a');
    const total = Math.round(lerp(8, MAX_AMB, h));
    let n = 0;
    for (let k = 0; k < this.ambSchools.length && n < total; k++) {
      const sc = this.ambSchools[k];
      const span = 2 * this._halfW(sc.z) + 10;
      let cx = (sc.u * span - scrollW - sc.speed * time) % span;
      if (cx < 0) cx += span;
      cx -= span * 0.5;
      const cy = lerp(seabedW + 1.5, surfW - 1.5, sc.yf) + Math.sin(time * 0.4 + sc.phase) * 0.8;
      const faceRight = sc.speed < 0;
      c.copy(sc.color).lerp(sick, 1 - h);
      for (let i = 0; i < sc.n && n < total; i++) {
        const a = sc.phase + i * 2.39996 + time * 0.35;
        const rr = sc.R * (0.35 + 0.65 * fract(i * 0.618));
        d.position.set(cx + Math.cos(a) * rr * 1.7, cy + Math.sin(i * 1.7 + time * 0.8) * rr * 0.45, sc.z + Math.sin(a) * rr * 0.8);
        d.rotation.set(0, faceRight ? Math.PI : 0, Math.sin(time * 1.3 + i) * 0.12);
        d.scale.setScalar(sc.size * (0.8 + 0.4 * fract(i * 0.37)));
        d.updateMatrix();
        mesh.setMatrixAt(n, d.matrix);
        mesh.setColorAt(n, c);
        anim[n * 3] = 11;
        anim[n * 3 + 1] = i * 1.3 + k;
        anim[n * 3 + 2] = 0.8;
        glow[n] = 0.08 * h;
        n++;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aAnim.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
  }

  _updateShells(stage, time, pxw) {
    const mesh = this.shellMesh;
    const arr = mesh.instanceMatrix.array;
    let n = 0;
    const put = (x, y, z, r, wob) => {
      if (n >= MAX_SHELL) return;
      const o = n * 16;
      const sx = r * (1 + wob);
      const sy = r * (1 - wob);
      arr[o] = sx;
      arr[o + 1] = 0;
      arr[o + 2] = 0;
      arr[o + 3] = 0;
      arr[o + 4] = 0;
      arr[o + 5] = sy;
      arr[o + 6] = 0;
      arr[o + 7] = 0;
      arr[o + 8] = 0;
      arr[o + 9] = 0;
      arr[o + 10] = r;
      arr[o + 11] = 0;
      arr[o + 12] = x;
      arr[o + 13] = y;
      arr[o + 14] = z;
      arr[o + 15] = 1;
      n++;
    };
    const bubbles = stage.bubbles || [];
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const v = this._toWorld(b.x, b.y, 0, this._v);
      const grow = clamp(b.age / 0.12, 0.3, 1);
      put(v.x, v.y, 0.3, b.r * pxw * grow, Math.sin(b.age * 18 + b.seed) * 0.08);
      this._glow(v.x, v.y, 0.2, b.r * pxw * 3.2, 0.1, 0.22, 0.28);
    }
    const fish = stage.fish || [];
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      if (f.state !== 'bubbled' || f.bubbleT < 0) continue;
      const v = this._toWorld(f.x, f.y, 0, this._v);
      const pop = clamp(f.bubbleT / 0.18, 0, 1);
      const over = 1 + Math.sin(pop * Math.PI) * 0.25;
      put(v.x, v.y, 0.2, f.bubbleR * pxw * pop * over, Math.sin(time * 3 + f.seed) * 0.05);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }

  _updateJellies(stage, time, pxw) {
    const jellies = stage.jellies || [];
    const bell = this.bellMesh;
    const tent = this.tentMesh;
    const d = this._dummy;
    const ba = bell.geometry.attributes.aAlpha.array;
    const ta = tent.geometry.attributes.aAlpha.array;
    const c = this._c;
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
      const gk = (0.32 + 0.12 * ps) * a;
      this._glow(v.x, v.y + r * 0.25, 0.25, r * 3.4, c.r * gk, c.g * gk, c.b * gk);
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
    const mines = stage.mines || [];
    const d = this._dummy;
    let n = 0;
    let ln = 0;
    let an = 0;
    for (let i = 0; i < mines.length && n < MAX_MINE; i++) {
      const m = mines[i];
      const v = this._toWorld(m.x, m.y, 0, this._v);
      const r = m.r * pxw;
      d.position.set(v.x, v.y, 0);
      d.rotation.set(0.3, m.spin, 0.2);
      d.scale.setScalar(r);
      d.updateMatrix();
      this.mineMesh.setMatrixAt(n, d.matrix);
      const mx = v.x;
      const my = v.y;
      // blinking warning lamp + red danger halo
      const on = m.blink < 0.5 ? 1 : 0.18;
      this._glow(mx, my + r * 1.05, 0.9, r * (1.4 + on * 1.4), 1.0 * on, 0.18 * on, 0.1 * on);
      this._glow(mx, my, -0.6, r * 5.2, 0.32, 0.04, 0.02);
      this._shade(mx, my, r * 5.5);
      if (m.kind === 'anchored') {
        const top = my - r * 1.0;
        const len = top - seabedW;
        const ls = r * 0.32;
        const step = ls * 0.82;
        const count = Math.min(40, Math.max(0, Math.floor(len / step)));
        for (let k = 0; k < count && ln < MAX_LINKS; k++) {
          const yy = top - k * step - step * 0.5;
          const sway = Math.sin(time * 1.2 + m.phase + k * 0.2) * 0.04 * k * r;
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
    this.mineMesh.count = n;
    this.linkMesh.count = ln;
    this.anchorMesh.count = an;
    this.mineMesh.instanceMatrix.needsUpdate = true;
    this.linkMesh.instanceMatrix.needsUpdate = true;
    this.anchorMesh.instanceMatrix.needsUpdate = true;
    this.mineRim.value = 0.75 + 0.35 * Math.sin(time * 5);
  }

  _updateClams(stage, time, pxw, seabedW, h) {
    const clams = stage.clams || [];
    const d = this._dummy;
    const c = this._c;
    c.set('#9a8296').lerp(this._c2.set('#f0a8cf'), h);
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
      d.scale.set(sc, sc, sc);
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

  _updateRings(stage, pxw) {
    const rings = stage.rings || [];
    const mesh = this.ringMesh;
    const arr = mesh.instanceMatrix.array;
    const col = mesh.instanceColor.array;
    const rgb = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < rings.length && n < MAX_RING; i++) {
      const r = rings[i];
      const t = 1 - r.life / r.maxLife;
      const v = this._toWorld(r.x, r.y, 0, this._v);
      const rad = lerp(r.r0, r.r1, 1 - (1 - t) * (1 - t)) * pxw * 2.3;
      const o = n * 16;
      arr.fill(0, o, o + 16);
      arr[o] = rad;
      arr[o + 5] = rad;
      arr[o + 10] = 1;
      arr[o + 12] = v.x;
      arr[o + 13] = v.y;
      arr[o + 14] = 0.7;
      arr[o + 15] = 1;
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

  _spawnWake(x, y, z, vx, vy, size, life) {
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
  }

  _updateWake(stage, dt, seabedW, surfW, h, scrollW) {
    const sub = stage.sub;
    const pxw = this._pxw(0);
    const worldSpeed = (stage.scrollSpeed || 0) * pxw;
    if (sub && this._subTail) {
      this._wakeAcc += dt * (8 + (sub.prop ?? 1) * 26);
      while (this._wakeAcc > 1) {
        this._wakeAcc -= 1;
        const sc = this._subSc || 0.5;
        this._spawnWake(
          this._subTail.x + (Math.random() - 0.5) * 0.15 * sc,
          this._subTail.y + (Math.random() - 0.5) * 0.3 * sc,
          (Math.random() - 0.5) * 0.4,
          -0.6 - Math.random() * 0.8,
          0.3 + Math.random() * 0.5,
          (0.05 + Math.random() * 0.09) * sc * 2.2,
          0.8 + Math.random() * 0.8
        );
      }
    }
    // vents: little bubble streams rising from the seabed (more life = more bubbles)
    this._ventAcc += dt * lerp(3, 9, h);
    while (this._ventAcc > 1) {
      this._ventAcc -= 1;
      const z = lerp(-1, -7, Math.random());
      const hw = this._halfW(z);
      this._spawnWake((Math.random() * 2 - 1) * hw, seabedW + 0.1, z, 0, 0.6 + Math.random() * 0.6, 0.06 + Math.random() * 0.08, 3 + Math.random() * 3);
    }
    for (let i = 0; i < MAX_WAKE; i++) {
      const w = this.wake[i];
      if (w.life > 0) {
        w.life -= dt;
        w.vx *= Math.exp(-2 * dt);
        w.vy = Math.min(w.vy + dt * 0.8, 1.6);
        w.x += (w.vx - worldSpeed) * dt + Math.sin(w.life * 7 + i) * 0.004;
        w.y += w.vy * dt;
        if (w.y > surfW) w.life = 0;
      }
      const a = w.life > 0 ? Math.min(1, w.life / w.max * 2) : 0;
      this.wakePos[i * 3] = w.x;
      this.wakePos[i * 3 + 1] = w.y;
      this.wakePos[i * 3 + 2] = w.z;
      this.wakeSize[i] = w.size;
      this.wakeAlpha[i] = a * 0.85;
    }
    const g = this.wakePoints.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  _updateHud(stage, time) {
    const p = clamp(stage.progress || 0, 0, 1);
    const x0 = this._trackX0 ?? 36;
    const x1 = this._trackX1 ?? this.width - 36;
    const y = -(this._trackY ?? 18);
    const w = Math.max(2, (x1 - x0) * p);
    this.hudFill.scale.set(w, 6, 1);
    this.hudFill.position.set(x0 + w / 2, y, 0);
    const mx = x0 + (x1 - x0) * p;
    this.hudMarker.scale.set(30, 20, 1);
    this.hudMarker.position.set(mx, y + 1 + Math.sin(time * 4) * 0.8, 0);
  }

  _updateParticles(particles, pr) {
    const g = this.partPoints.geometry;
    const n = particles ? Math.min(particles.length, MAX_PART) : 0;
    const rgb = [0, 0, 0];
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
      const e = this._popupTex(pop.text, pop.color || '#ffffff');
      if (m.material.map !== e.tex) {
        m.material.map = e.tex;
        m.material.needsUpdate = true;
      }
      const t = 1 - clamp(pop.life / (pop.maxLife || 1), 0, 1);
      const pin = t < 0.12 ? 0.6 + (t / 0.12) * 0.55 : 1.15 - Math.min(0.15, (t - 0.12) * 1.2);
      const hgt = 21 * s * pin;
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
        if (m.map && m.map !== this.softDot) m.map.dispose();
        if (m.emissiveMap) m.emissiveMap.dispose();
        m.dispose();
      }
    };
    this.scene.traverse(kill);
    this.overlay.traverse(kill);
    for (const e of this._popCache.values()) e.tex.dispose();
    this._popCache.clear();
  }
}
