// MK.7 mini-submarine bonus stage renderer.
//
// Owns its own scene + cameras and draws a SubStage (src/subStage.js) into the game's shared
// THREE.WebGLRenderer. Gameplay state is in CSS-pixel screen coordinates; every entity is mapped
// onto the z = 0 world plane by unprojecting through a fixed copy of the camera (`mapCam`), so what
// you see is exactly where the hit-boxes are. Background layers live at real depths and get their
// parallax from the perspective camera for free. The *view* camera may drift, follow and (for the
// arrival) fly up to the waterline for an over/under shot; screen-space effects (particles, popups)
// are re-projected through it so they stay glued to the world.
//
// Look: a living sea that goes from a polluted, bioluminescent deep (healing 0) to a sun-drenched
// reef (healing 1): sky glowing through a rippling surface, swaying light shafts, caustics dancing
// over the sand, the sub and the fish, depth-of-field motes, sunken tower ruins, kelp forests and
// boid schools that part around the sub.
//
// Performance notes: everything repeated is an InstancedMesh, materials/geometries are shared, the
// sub is merged per material (~9 draws), all per-frame work writes into preallocated typed arrays
// (no allocations in render()), and the whole frame stays well under ~110 draw calls.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const FOV = 50;
const CAM_Z = 16;
const TOWER_Z = -5.5;
const RUBBLE_Z = -7;
const BACKDROP_Z = -100;

const MAX_FISH = 64;
const MAX_AMB = 124;
const MAX_SHELL = 96;
const MAX_JELLY = 14;
const MAX_MINE = 12;
const MAX_LINKS = 260;
const MAX_CLAM = 6;
const MAX_GLOW = 420;
const MAX_STAR = 140;
const MAX_SHADE = 48;
const MAX_RING = 24;
const MAX_PART = 600;
const MAX_WAKE = 240;
const MAX_POP = 18;

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

// ---------------------------------------------------------------------------------- palettes
// Three stops: healing 0 (polluted, bioluminescent deep) / 0.5 / 1 (clear sunlit turquoise)
const PAL_HEX = {
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
  skyTop: ['#2a2450', '#3a6fc0', '#2f7fe0'],
  skyHor: ['#d9875f', '#ffc896', '#ffe0b8'],
  skySun: ['#ff9a52', '#ffd590', '#fff1c8'],
  glass: ['#7fe8ff', '#a8ecff', '#d8fbff'],
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
// cheap animated caustic web for lit objects (sub, fish, coral): ridges where two warped wave
// fields cancel out
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
function flag(geo, name, v) {
  geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(v), 1));
  return geo;
}
const STD_ATTRS = ['position', 'normal', 'color', 'uv'];
function merge(list, extras = []) {
  const keep = STD_ATTRS.concat(extras);
  const prepared = list.map((g) => {
    let ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) {
      if (!keep.includes(name)) ng.deleteAttribute(name);
    }
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    if (!ng.attributes.color) solid(ng, 1, 1, 1);
    for (const e of extras) if (!ng.attributes[e]) flag(ng, e, 0);
    return ng;
  });
  return mergeGeometries(prepared, false);
}
// place a geometry: scale, rotate (XYZ euler), translate
function place(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
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

// four-pointed glint with a soft core (sparkles, sun glints, gold fish glitter)
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

// Patch a MeshStandardMaterial with optional rim light, per-instance glow, sway, fish wag, caustic
// light, surface clipping, "above water" fog removal and always-white eye vertices.
function patchStd(mat, U, opts = {}) {
  const {
    rim = null,
    glow = false,
    sway = 0,
    wag = false,
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
    let head = 'uniform float uTime;\nuniform float uScrollW;\n';
    if (glow) head += 'attribute float aGlow;\nvarying float vGlow;\n';
    if (wag) head += 'attribute vec3 aAnim;\n';
    if (eye) head += 'attribute float aEye;\nvarying float vEye;\n';
    if (needW) head += 'varying vec3 vCW;\n';
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${head}`);
    let bv = '#include <begin_vertex>\n';
    if (glow) bv += 'vGlow = aGlow;\n';
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
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', bv);
    if (needW) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cwp = instanceMatrix * cwp;
        #endif
        vCW = (modelMatrix * cwp).xyz;`
      );
    }

    let fhead = '';
    if (rim) fhead += 'uniform vec3 uRimColor;\nuniform float uRimStr;\n';
    if (glow) fhead += 'varying float vGlow;\n';
    if (eye) fhead += 'varying float vEye;\n';
    if (selfLit) fhead += 'uniform float uSelfLit;\n';
    if (needW) fhead += 'uniform float uTime;\nuniform float uScrollW;\nuniform float uSurfY;\nuniform float uSeabedY;\nuniform float uCausticStr;\nuniform vec3 uCausticCol;\nvarying vec3 vCW;\n';
    if (caustic > 0) fhead += GLSL_CAUSTIC_LITE;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${fhead}`);
    if (clip) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (vCW.y > uSurfY) discard;\n'
      );
    }
    let cf = '#include <color_fragment>\n';
    if (eye) cf += 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), vEye);\n';
    if (nacre) cf += 'if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.93), 0.72);\n';
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', cf);
    let ef = '#include <emissivemap_fragment>\n';
    if (glow) ef += 'totalEmissiveRadiance += diffuseColor.rgb * vGlow;\n';
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
          float cDepth = mix(0.3, 1.0, clamp((vCW.y - uSeabedY) / max(uSurfY - uSeabedY, 0.001), 0.0, 1.0));
          float cUp = clamp(normal.y * 0.65 + 0.45, 0.0, 1.0);
          float cWet = 1.0 - smoothstep(uSurfY - 0.05, uSurfY + 0.05, vCW.y);
          totalEmissiveRadiance += diffuseColor.rgb * uCausticCol * min(cK * uCausticStr * cDepth * cUp * cWet * ${caustic.toFixed(3)}, 0.75);
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
  const k = `${rim ? 1 : 0}${glow ? 1 : 0}${sway}${wag ? 1 : 0}${nacre ? 1 : 0}${caustic}${clip ? 1 : 0}${airFog ? 1 : 0}${eye ? 1 : 0}${selfLit ? 1 : 0}`;
  mat.customProgramCacheKey = () => `sub_${key}_${k}`;
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

// kelp: two crossed, tapering ribbons; the frond silhouette comes from an alpha texture
function buildKelp() {
  const parts = [];
  for (let k = 0; k < 2; k++) {
    const g = new THREE.PlaneGeometry(0.95, 1, 1, 20);
    g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1.05 - y * 0.3) + Math.sin(y * 6 + k * 2) * 0.05);
    }
    g.rotateY(k * (Math.PI / 2) + 0.35);
    parts.push(g);
  }
  const geo = merge(parts);
  geo.computeVertexNormals();
  paint(geo, (x, y, z, c) => {
    const k = 0.4 + 0.6 * clamp(y, 0, 1);
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return geo;
}

function makeKelpTex() {
  return canvasTex(64, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = mulberry32(31);
    // stipe
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(32, h);
    for (let y = h; y > 0; y -= 16) ctx.lineTo(32 + Math.sin(y * 0.03) * 3, y);
    ctx.stroke();
    // alternating blades with a little gas bladder at each base
    for (let i = 0; i < 17; i++) {
      const y = h - 18 - i * 29 - r() * 6;
      const side = i % 2 ? 1 : -1;
      const len = 23 + r() * 7 - i * 0.35;
      const g = ctx.createLinearGradient(32, y, 32 + side * len, y - 12);
      g.addColorStop(0, '#f2f2f2');
      g.addColorStop(1, '#bdbdbd');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(32 + side * 2, y);
      ctx.rotate(side * -0.55);
      ctx.beginPath();
      ctx.ellipse(side * len * 0.5, 0, len * 0.5, 6 + r() * 2.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(32 + side * 4, y + 2, 3.2, 0, TAU);
      ctx.fill();
    }
  });
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

// A sunken, broken tower stump: jagged top, stone courses and dark arched windows painted in.
function buildRuin() {
  const g = new THREE.CylinderGeometry(1, 1.1, 1, 20, 14, true);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = Math.atan2(p.getZ(i), p.getX(i));
    if (y > 0.99) p.setY(i, 0.6 + Math.abs(Math.sin(a * 1.6 + 0.7)) * 0.3 + Math.sin(a * 9) * 0.05);
  }
  g.computeVertexNormals();
  paint(g, (x, y, z, c) => {
    const a = Math.atan2(z, x);
    let k = Math.floor(y * 12) % 2 ? 0.86 : 1.0;
    for (let w = 0; w < 5; w++) {
      const wa = -Math.PI + (w + 0.5) * (TAU / 5);
      let da = Math.abs(a - wa);
      if (da > Math.PI) da = TAU - da;
      if (da < 0.2 && y > 0.3 && y < 0.5) k = 0.18;
      if (da < 0.2 && y > 0.62 && y < 0.78) k = 0.2;
    }
    k *= 0.65 + 0.35 * clamp(y * 1.6, 0, 1);
    c[0] = k;
    c[1] = k;
    c[2] = k;
  });
  return g;
}

// Gameplay / ambient fish: fusiform body tapering into a forked tail, dorsal + pectoral fins, and big
// cartoon eyes (aEye = 1 keeps sclera and glints white whatever the instance colour).
function buildFish(low = false) {
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
  paint(body, (x, y, z, c) => {
    let k = y < 0 ? 1.0 : lerp(1.0, 0.55, clamp(y / 0.42, 0, 1));
    if (Math.sin(x * 7.5 + 1.2) > 0.8 && y > -0.2) k *= 0.62; // stripes
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
      const w = new THREE.SphereGeometry(0.18, 10, 8);
      w.translate(-0.56, 0.11, 0.17 * sz);
      solid(w, 1, 1, 1);
      flag(w, 'aEye', 1);
      eyes.push(w);
      const pu = new THREE.SphereGeometry(0.105, 8, 6);
      pu.translate(-0.65, 0.11, 0.27 * sz);
      solid(pu, 0.01, 0.01, 0.02);
      eyes.push(pu);
      const gl = new THREE.SphereGeometry(0.038, 6, 4);
      gl.translate(-0.7, 0.16, 0.335 * sz);
      solid(gl, 1, 1, 1);
      flag(gl, 'aEye', 1);
      eyes.push(gl);
    } else {
      const e = new THREE.SphereGeometry(0.1, 5, 4);
      e.translate(-0.64, 0.11, 0.24 * sz);
      solid(e, 0.02, 0.02, 0.03);
      eyes.push(e);
    }
  }
  return merge(parts.concat(eyes), ['aEye']);
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
      uniform float uTime;
      varying vec3 vN; varying vec3 vV;
      void main(){
        // wobbly soap-film: a few travelling lobes, phase from the instance position
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
        // swirling thin-film iridescence
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

// canopy glass: fresnel tint, a soft sky reflection band, two hard highlights and a glare streak
function canopyMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uTint: { value: new THREE.Color('#a8ecff') }, uSky: { value: new THREE.Color('#d8fbff') }, uTime: U.uTime },
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
      uniform vec3 uTint; uniform vec3 uSky; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vL;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float fres = pow(1.0 - clamp(abs(dot(n, v)), 0.0, 1.0), 2.2);
        float spec = pow(max(dot(n, normalize(vec3(-0.45, 0.9, 0.7) + v)), 0.0), 90.0);
        float spec2 = pow(max(dot(n, normalize(vec3(0.7, 0.3, 0.8) + v)), 0.0), 40.0) * 0.4;
        float streak = smoothstep(0.9, 0.985, dot(n, normalize(vec3(-0.55, 0.55, 0.65)))) * 0.55;
        float sweep = smoothstep(0.08, 0.0, abs(vL.x * 0.8 + vL.y - 0.25 - sin(uTime * 0.6) * 0.5)) * 0.25;
        float skyRef = smoothstep(0.1, 0.9, n.y) * fres;
        vec3 col = uTint * (0.18 + fres * 1.3) + uSky * skyRef * 0.8 + vec3(spec * 2.6 + spec2 + streak + sweep);
        gl_FragColor = vec4(col, clamp(0.06 + fres * 0.7 + spec + spec2 + streak + sweep, 0.0, 1.0));
        ${GLSL_OUT}
      }`,
  });
}

// headlight beam: soft volumetric cone with dust drifting through it
function lightConeMaterial(U) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#fff1b8') }, uStr: { value: 0.35 }, uTime: U.uTime, uScrollW: U.uScrollW },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vT = clamp((position.x - 1.32) / 5.0, 0.0, 1.0); // 0 at the tip (nose), 1 at the open end
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uStr; uniform float uTime; uniform float uScrollW;
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.5);
        vec2 q = vec2(vW.x + uScrollW, vW.y) * 2.2;
        float dust = vnoise(q + vec2(uTime * 0.35, uTime * 0.12)) * 0.6 + vnoise(q * 2.7 - vec2(uTime * 0.5, 0.0)) * 0.4;
        float a = pow(1.0 - vT, 1.7) * edge * uStr * (0.7 + 0.6 * dust);
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

// propeller motion blur disc
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

// ---------------------------------------------------------------------------------- renderer
const EMPTY = [];

export class SubRenderer {
  constructor(webglRenderer, { softDotTex } = {}) {
    this.gl = webglRenderer;
    this.softDot = softDotTex || makeSoftDot();
    this._ownSoftDot = !softDotTex;
    this.starTex = makeStarTex();
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
      uSurfY: { value: 5.7 },
      uSeabedY: { value: -6 },
      uCausticStr: { value: 0.5 },
      uCausticCol: { value: new THREE.Color('#c9fff5') },
      uBio: { value: 0 },
      uBioCol: { value: new THREE.Color('#69f0ff') },
    });

    this.scene = new THREE.Scene();
    this.fogColor = U.uFogColor.value;
    this.scene.background = this.fogColor;
    this.scene.fog = new THREE.Fog(this.fogColor, CAM_Z, 60);

    this.camera = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 220);
    this.camera.position.set(0, 0, CAM_Z);
    this.mapCam = new THREE.PerspectiveCamera(FOV, 390 / 620, 0.5, 220);
    this.mapCam.position.set(0, 0, CAM_Z);

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
    this._heal = -1;
    this._lastTime = null;
    this._glowColor = new THREE.Color('#38bdf8');
    this._glowHex = '';
    this._towerR = -1;
    this._cine = 0;
    this._camFX = 0;
    this._camFY = 0;
    this._surfW = 5.7;
    this._seabedW = -6;
    // sub animation state (springs driven by gameplay counters)
    this._sq = 0;
    this._sqV = 0;
    this._recoil = 0;
    this._cheer = 0;
    this._propSpin = 0;
    this._lastShots = 0;
    this._lastCatches = 0;
    this._lastHits = 0;
    this._lastVfxId = 0;
    this._wakeSwirl = 0;

    this.colors = {};
    for (const k in PAL) this.colors[k] = new THREE.Color();

    this._fishSmall = SMALL_FISH_HEX.map((h) => new THREE.Color(h));
    this._fishBig = BIG_FISH_HEX.map((h) => new THREE.Color(h));
    this._fishGold = new THREE.Color(GOLD_HEX);
    this._jellyCols = JELLY_HEX.map((h) => new THREE.Color(h));
    this._white = new THREE.Color(1, 1, 1);
    this._sick = new THREE.Color('#7d8a6a');
    this._clamDead = new THREE.Color('#9a8296');
    this._clamLush = new THREE.Color('#f0a8cf');

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
    for (const m of [this.vignette, this.waterline]) {
      m.scale.set(width, height, 1);
      m.position.set(width / 2, -height / 2, -5);
    }
    this.waterMat.uniforms.uSize.value.set(width, height);
    this._hudDrawn = null;
    this._cardForW = 0;
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

    // ---- backdrop: sky above the waterline (only seen during the arrival shot), fog colour below
    const bdGeo = new THREE.PlaneGeometry(700, 320);
    this.backdropMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uScrollW: U.uScrollW,
        uSurfY: U.uSurfY,
        uFogColor: U.uFogColor,
        uSkyTop: { value: new THREE.Color() },
        uSkyHor: { value: new THREE.Color() },
        uSunCol: { value: new THREE.Color() },
        uHeal: { value: 1 },
      },
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform float uSurfY; uniform vec3 uFogColor;
        uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uSunCol; uniform float uHeal;
        varying vec3 vW;
        ${GLSL_NOISE}
        void main(){
          float hy = vW.y - uSurfY;
          if (hy < 0.0) { gl_FragColor = vec4(uFogColor, 1.0); ${GLSL_OUT} return; }
          float e = clamp(hy / 42.0, 0.0, 1.0);
          vec3 col = mix(uSkyHor, uSkyTop, pow(e, 0.7));
          // sun
          float d = length(vW.xy - vec2(-17.0, uSurfY + 8.5));
          col += uSunCol * (smoothstep(3.2, 2.6, d) * 1.4 + exp(-d * 0.22) * 0.55 + exp(-d * 0.05) * 0.25);
          // soft drifting clouds (smog bands when the sea is still sick)
          vec2 cp = vec2(vW.x * 0.035 + uTime * 0.006, hy * 0.11);
          float cl = vnoise(cp * vec2(1.0, 2.8)) * 0.62 + vnoise(cp * vec2(2.6, 6.0) + 3.1) * 0.38;
          cl = smoothstep(0.5, 0.82, cl) * smoothstep(0.02, 0.12, e) * (1.0 - smoothstep(0.45, 0.85, e));
          vec3 cloudCol = mix(uSkyHor * 0.8, vec3(1.0, 0.98, 0.95), 0.35 + 0.4 * uHeal);
          col = mix(col, cloudCol, cl * 0.6);
          // the other towers, still standing on the horizon
          float tw = 0.0;
          for (int k = 0; k < 4; k++) {
            float fk = float(k);
            float cx = -41.0 + fk * 23.0 + sin(fk * 7.3) * 4.0;
            float h = 5.0 + fract(fk * 0.71 + 0.2) * 6.0;
            float w = (0.75 + fract(fk * 0.37) * 0.5) * (1.0 - 0.25 * clamp(hy / h, 0.0, 1.0));
            float dx = abs(vW.x - cx);
            float inX = smoothstep(w + 0.12, w - 0.12, dx);
            // crenellated crown + a little spire
            float cren = step(0.5, fract((vW.x - cx) * 2.2)) * 0.45;
            float top = h + cren * step(dx, w);
            float inY = smoothstep(top + 0.1, top - 0.1, hy);
            float spire = smoothstep(0.16, 0.0, dx) * smoothstep(h + 2.2, h + 1.9, hy) * step(h, hy);
            tw = max(tw, max(inX * inY, spire));
            float tip = exp(-length(vec2(vW.x - cx, hy - h - 2.2)) * 2.0) * (0.55 + 0.45 * sin(uTime * 2.0 + fk * 1.7));
            col += vec3(1.0, 0.3, 0.25) * tip * 0.7;
          }
          col = mix(col, uSkyHor * 0.5 + uSkyTop * 0.12, tw * 0.62);
          // horizon haze
          col = mix(col, uSkyHor * 1.08, exp(-hy * 0.45) * 0.55);
          gl_FragColor = vec4(col, 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.backdrop = new THREE.Mesh(bdGeo, this.backdropMat);
    this.backdrop.position.z = BACKDROP_Z;
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -10;
    this.scene.add(this.backdrop);

    // ---- seabed with dunes + animated caustics + toxic sludge + bioluminescent specks
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
          col *= 0.88 + ripple * 0.16;
          float lam = clamp(dot(vN, normalize(vec3(-0.3, 1.0, 0.45))), 0.0, 1.0);
          col *= 0.5 + 0.6 * lam;
          float c = caustic(p * 0.16, uTime * 0.5) * 0.7 + caustic(p * 0.31 + 3.1, uTime * 0.62) * 0.45;
          col += uCausticColor * c * uCaustic * (0.55 + 0.45 * lam);
          float tn = vnoise(p * 0.22 + 7.3) * 0.7 + vnoise(p * 0.9 + 2.0) * 0.3;
          float tox = smoothstep(0.6, 0.76, tn) * uToxicAmt;
          col = mix(col, uToxic * 0.16, tox * 0.85);
          col += uToxic * tox * (0.1 + 0.07 * sin(uTime * 2.0 + p.x * 0.7));
          // bioluminescent plankton specks in the sand (only while the sea is dark)
          vec2 g = p * vec2(4.0, 5.0);
          vec2 gi = floor(g);
          float hs = hash12(gi);
          float spk = step(0.9, hs) * smoothstep(0.3, 0.05, length(fract(g) - 0.5));
          col += uBioCol * spk * uBio * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.2 + hs * 3.0) + hs * 40.0))) * 1.4;
          float f = smoothstep(uFogNear, uFogFar, vDepth);
          gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
          ${GLSL_OUT}
        }`,
    });
    this.seabed = new THREE.Mesh(bedGeo, this.bedMat);
    this.seabed.frustumCulled = false;
    this.scene.add(this.seabed);

    // ---- water surface seen from below: rippling, sky glowing through, shattered sun
    // spans from behind the camera (so a rising camera never sees past its near edge) to beyond
    // the backdrop (so no sliver of sky shows at the horizon)
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
        uniform vec3 uSunCol; uniform float uAlpha;
        ${GLSL_FOG_PARS}
        varying vec3 vW; varying float vDepth;
        ${GLSL_NOISE}
        void main(){
          vec3 V = normalize(vW - cameraPosition);
          vec2 p = vec2(vW.x + uScrollW * 0.35, vW.z);
          float n1 = vnoise(p * 0.55 + vec2(uTime * 0.22, uTime * 0.07));
          float n2 = vnoise(p * 1.7 - vec2(uTime * 0.31, -uTime * 0.17));
          float wav = n1 * 0.65 + n2 * 0.35;
          // looking up steeply = inside "Snell's window" (bright sky), grazing = total internal reflection
          float up = clamp(V.y, 0.0, 1.0);
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
        }`,
    });
    this.surface = new THREE.Mesh(surfGeo, this.surfMat);
    this.surface.frustumCulled = false;
    this.surface.renderOrder = 5;
    this.scene.add(this.surface);

    // ---- light shafts (instanced additive planes, swaying from the surface)
    const rayGeo = new THREE.PlaneGeometry(1, 1);
    rayGeo.translate(0, -0.5, 0);
    this.rayMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime,
        uFogNear: U.uFogNear,
        uFogFar: U.uFogFar,
        uSurfY: U.uSurfY,
        uColor: { value: new THREE.Color() },
        uStr: { value: 0.5 },
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
          float k = -position.y; // 0 at the surface, 1 at the far end
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
          float edge = sin(vUv.x * 3.14159); edge = edge * edge * edge;
          float len = pow(vUv.y, 1.35) * smoothstep(1.0, 0.94, vUv.y) * smoothstep(3.0, 11.0, vDepth);
          float streak = 0.45 + 0.8 * vnoise(vec2(vUv.x * 5.0 + vPh * 7.0, vUv.y * 1.4 - uTime * 0.07));
          float flick = 0.62 + 0.38 * sin(uTime * 0.7 + vPh * 3.0) * sin(uTime * 1.13 + vPh);
          float a = edge * len * streak * flick * uStr * (1.0 - smoothstep(uFogNear, uFogFar * 1.15, vDepth) * 0.75);
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`,
    });
    const rng = mulberry32(77);
    const NR = 14;
    this.rays = new THREE.InstancedMesh(rayGeo, this.rayMat, NR);
    this.rays.frustumCulled = false;
    this.rays.renderOrder = 6;
    this.rayItems = [];
    for (let i = 0; i < NR; i++) {
      this.rayItems.push({
        u: (i + rng() * 0.6) / NR,
        z: lerp(-2.5, -24, rng()),
        w: lerp(0.8, 3.4, rng()),
        len: lerp(14, 24, rng()),
        tilt: lerp(0.2, 0.36, rng()),
        sway: rng() * TAU,
      });
    }
    this.scene.add(this.rays);

    // ---- marine snow / bioluminescent plankton with depth-of-field bokeh
    const NS = 440;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      const fg = i < NS * 0.12;
      sp[i * 3] = (rng() - 0.5) * 60;
      sp[i * 3 + 1] = rng() * 16 - 8;
      sp[i * 3 + 2] = fg ? lerp(5, 11, rng()) : lerp(-16, 4, Math.pow(rng(), 0.8));
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
        uAlpha: { value: 0.8 },
        uTwinkle: { value: 0.35 },
        uMap: { value: this.softDot },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScrollW; uniform float uSpan; uniform float uYmin; uniform float uYmax; uniform float uPx;
        uniform float uFogNear; uniform float uFogFar; uniform float uFocus; uniform float uSurfY; uniform float uTwinkle;
        attribute float aSeed;
        varying float vA; varying float vMix;
        void main(){
          vec3 p = position;
          float par = p.z > 4.5 ? 1.6 : 1.0; // foreground motes drift past faster
          p.x = mod(p.x - uScrollW * par + sin(uTime * 0.3 + aSeed * 6.0) * 0.5 + uSpan * 0.5, uSpan) - uSpan * 0.5;
          float hgt = uYmax - uYmin;
          p.y = uYmin + mod(p.y - uYmin - uTime * (0.08 + fract(aSeed * 7.0) * 0.22), hgt);
          p.z += sin(uTime * 0.4 + aSeed * 11.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          float coc = clamp(abs(d - uFocus) / max(d, 0.5) * 2.4, 0.0, 2.6);
          gl_PointSize = (0.045 + fract(aSeed * 13.0) * 0.08) * uPx / max(d, 0.5) * (1.0 + coc * 3.2);
          float tw = 1.0 - uTwinkle + uTwinkle * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 20.0);
          float near = smoothstep(1.2, 3.5, d);
          vA = (0.35 + 0.65 * fract(aSeed * 3.7)) * (1.0 - smoothstep(uFogNear, uFogFar, d)) * tw * near / (1.0 + coc * coc * 3.5);
          vA *= 1.0 - step(uSurfY, p.y);
          vMix = step(0.72, fract(aSeed * 5.31));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform vec3 uColor2; uniform float uAlpha; uniform sampler2D uMap;
        varying float vA; varying float vMix;
        void main(){
          float a = texture2D(uMap, gl_PointCoord).a * vA * uAlpha;
          gl_FragColor = vec4(mix(uColor, uColor2, vMix), a);
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
      const mat = patchStd(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0, flatShading: true }), U, {
        clip: true,
        key: 'spire',
      });
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
    // sunken ruins of toppled towers (stumps and fallen segments), far back in the haze
    {
      const mat = patchStd(
        new THREE.MeshStandardMaterial({ vertexColors: true, color: '#ffffff', roughness: 0.95, metalness: 0, flatShading: true, side: THREE.DoubleSide }),
        U,
        { clip: true, key: 'ruin' }
      );
      const N = 9;
      const mesh = instanced(buildRuin(), mat, N);
      const items = [];
      for (let i = 0; i < N; i++) {
        const fallen = i % 3 === 2;
        const r = lerp(1.4, 2.6, rng());
        items.push({
          u: (i + rng() * 0.6) / N,
          z: lerp(-17, -32, rng()),
          dy: fallen ? 0.2 : -0.9,
          sx: r,
          sy: fallen ? lerp(6, 10, rng()) : lerp(3.5, 9, rng()),
          sz: r,
          rx: fallen ? (rng() - 0.5) * 0.5 : 0,
          ry: rng() * TAU,
          rz: fallen ? (rng() < 0.5 ? 1 : -1) * lerp(1.15, 1.4, rng()) : (rng() - 0.5) * 0.3,
          shade: lerp(0.85, 1.15, rng()),
        });
      }
      this.ruinLayer = addLayer(mesh, items, 12, { kind: 'far' });
    }
    // mid rocks
    {
      const geo = buildRock(rng, 1);
      const mat = patchStd(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, flatShading: true }), U, {
        caustic: 0.5,
        key: 'rock',
      });
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
    // kelp: a tall, dark forest far back + lush fronds in the mid-ground
    {
      this.kelpTex = makeKelpTex();
      const geo = buildKelp();
      const mat = patchStd(
        new THREE.MeshStandardMaterial({ map: this.kelpTex, alphaTest: 0.42, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
        U,
        { sway: 0.3, glow: true, caustic: 0.7, clip: true, key: 'kelp' }
      );
      const kelpCols = ['#2f8a3e', '#4f9a33', '#6f9a2e', '#2a7f5a', '#7a8f2a'].map((h) => new THREE.Color(h));
      const dead = new THREE.Color('#4a3d2c');
      {
        const N = 24;
        const mesh = instanced(geo.clone(), mat, N, { glow: true });
        const items = [];
        for (let i = 0; i < N; i++) {
          items.push({
            u: (i + rng() * 0.9) / N,
            z: lerp(-10, -19, rng()),
            dy: -0.3,
            sx: lerp(1.3, 2.1, rng()),
            sy: lerp(7, 12.5, rng()),
            sz: 1.4,
            ry: (rng() - 0.5) * 0.8,
            lush: kelpCols[i % kelpCols.length],
            dead,
            glow: 0,
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
          sx: lerp(1.0, 1.6, rng()),
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
    this._coralRim = { value: 0.2 };
    const coralMat = (key, { sway = 0.03, ...extra } = {}) =>
      patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, ...extra }), U, {
        sway,
        glow: true,
        caustic: 0.9,
        key,
        rim: { color: new THREE.Color('#ffffff'), str: this._coralRim },
      });
    const coralItems = (N, zNear, zFar, fg, sMin, sMax, rngFn) => {
      const items = [];
      for (let i = 0; i < N; i++) {
        const isFg = i < fg;
        const s = isFg ? lerp(0.3, 0.5, rngFn()) : lerp(sMin, sMax, rngFn());
        items.push({
          u: rngFn(),
          z: isFg ? lerp(2.1, 2.8, rngFn()) : lerp(zNear, zFar, rngFn()),
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
      this.fanTex = fanTex;
      const mat = patchStd(new THREE.MeshStandardMaterial({ map: fanTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 }), U, {
        sway: 0.12,
        glow: true,
        caustic: 0.6,
        key: 'fan',
      });
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

    this._haloLayers = [this.brainLayer, this.tubeLayer];
    this._lushLayers = [this.stagLayer, this.fanLayer, this.brainLayer, this.tubeLayer, this.kelpLayer, this.backKelpLayer];
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

  // ------------------------------------------------------------------ build: submarine (hero object)
  // Local space: +X nose, +Y up, +Z toward the camera. Parts are merged per material so the whole
  // sub (with Pogo, canopy, lamps, prop, beam) costs ~9 draw calls.
  _buildSub() {
    const U = this.U;
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    const body = new THREE.Group();
    outer.add(inner);
    inner.add(body);
    body.position.y = -0.14;
    outer.rotation.order = 'YZX';
    this.subOuter = outer;
    this.subInner = inner;
    this.subBody = body;

    const L0 = -1.15;
    const L1 = 1.26;
    const R = 0.6;
    const hr = (x) => {
      const u = clamp((x - L0) / (L1 - L0), 0, 1);
      return R * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(u, 1.36))), 0.55);
    };
    this._hr = hr;
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

    // ---- hull (lathe), with vertex rings exactly on the panel seams / colour bands
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
    paint(hull, (x, y, z, c) => {
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

    // ---- turret deck + interior
    const deck = new THREE.CylinderGeometry(0.47, 0.54, 0.34, 40, 1, false);
    place(deck, 0.2, 0.45, 0, 0, 0, 0, 1.12, 1, 1);
    paint(deck, (x, y, z, c) => {
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
    place(panel, 0.64, 0.64, 0, 0, 0, -0.6);
    solidC(panel, DARK, 1.3);
    paintP.push(panel);

    // ---- fins (bevelled, red), dive planes, prop shroud + struts
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.42, 0);
    finShape.lineTo(0.08, 0.4);
    finShape.lineTo(-0.14, 0.42);
    finShape.closePath();
    const finGeo = () => {
      const g = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 1 });
      g.translate(-0.2, 0, -0.02);
      paint(g, (x, y, z, c) => {
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

    // ---- metal: porthole rims, rivets, headlight housing, collar, periscope, antenna, prop shaft
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
    this._navLocal = new THREE.Vector3(-0.647, 0.755, 0);
    const shaft = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10);
    place(shaft, -1.15, 0, 0, 0, 0, Math.PI / 2);
    solidC(shaft, METD);
    metalP.push(shaft);
    // dashboard lights
    for (let k = 0; k < 3; k++) {
      const l = new THREE.SphereGeometry(0.016, 6, 4);
      place(l, 0.665, 0.67, -0.1 + k * 0.1);
      solidC(l, C(['#5dff8a', '#ffcc33', '#ff4d6a'][k]), 1.3);
      lampP.push(l);
    }

    this.hullRim = { value: 0.55 };
    this.subLit = { value: 0.04 };
    const paintMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.22, roughness: 0.32 }), U, {
      rim: { color: new THREE.Color('#ffe7a0'), str: this.hullRim },
      caustic: 1.1,
      selfLit: this.subLit,
      key: 'subpaint',
    });
    const metalMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.25 }), U, {
      rim: { color: new THREE.Color('#e6f6ff'), str: this.hullRim },
      caustic: 0.6,
      selfLit: this.subLit,
      key: 'submetal',
    });
    const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.flashMats = [paintMat, metalMat];
    body.add(new THREE.Mesh(merge(paintP), paintMat));
    body.add(new THREE.Mesh(merge(metalP), metalMat));
    body.add(new THREE.Mesh(merge(lampP), lampMat));

    // ---- MK.7 roundel decal
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
      patchStd(new THREE.MeshStandardMaterial({ map: decalTex, alphaTest: 0.5, roughness: 0.35, metalness: 0.1 }), U, {
        caustic: 0.8,
        selfLit: this.subLit,
        key: 'decal',
      })
    );
    decal.position.set(-0.42, -0.02, hr(-0.42) + 0.006);
    decal.rotation.y = -0.12;
    body.add(decal);

    // ---- Pogo: green frog-like pilot with big orange eyes and a red knitted scarf
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
      const HX = 0.24;
      const HY = 0.83;
      const PIV_Y = 0.62;
      const parts = [];
      const v = new THREE.Vector3();
      const head = new THREE.SphereGeometry(0.22, 30, 22);
      place(head, HX, HY, 0, 0, 0, 0, 1.1, 0.92, 1.02);
      const face = new THREE.Vector3(0.78, 0, 0.62).normalize();
      const blushL = new THREE.Vector3(0.62, -0.28, 0.73).normalize();
      const blushR = new THREE.Vector3(0.9, -0.28, -0.33).normalize();
      paint(head, (x, y, z, c) => {
        v.set((x - HX) / 1.1, (y - HY) / 0.92, z / 1.02).normalize();
        let col = SKIN;
        let k = 0.82 + 0.18 * clamp(v.y + 0.6, 0, 1);
        const c0 = this._c.copy(col);
        if (v.y < -0.12 && v.dot(face) > 0.1) c0.lerp(BELLY, smooth01((-v.y - 0.12) * 3));
        if (v.dot(blushL) > 0.95 || v.dot(blushR) > 0.95) c0.lerp(BLUSH, 0.65);
        c[0] = c0.r * k;
        c[1] = c0.g * k;
        c[2] = c0.b * k;
      });
      parts.push(head);
      const shoulders = new THREE.SphereGeometry(0.2, 18, 12);
      place(shoulders, HX - 0.03, 0.62, 0, 0, 0, 0, 1.05, 0.7, 1.1);
      solidC(shoulders, SKIN, 0.85);
      parts.push(shoulders);
      const look = new THREE.Vector3(0.8, 0.06, 0.6).normalize();
      for (const side of [1, -1]) {
        const ez = side * 0.105;
        const dome = new THREE.SphereGeometry(0.1, 18, 12);
        place(dome, HX + 0.07, HY + 0.145, ez);
        solidC(dome, SKIN, 0.95);
        parts.push(dome);
        const eye = new THREE.SphereGeometry(0.09, 26, 18);
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
      }
      // wide frog smile
      const smile = new THREE.TorusGeometry(0.085, 0.013, 6, 18, Math.PI * 0.62);
      smile.rotateZ(-Math.PI * 0.81);
      const mf = new THREE.Vector3(0.88, -0.28, 0.38).normalize();
      smile.rotateY(Math.atan2(mf.x, mf.z));
      smile.translate(HX + mf.x * 0.236, HY + mf.y * 0.2 + 0.035, mf.z * 0.226);
      solidC(smile, MOUTH);
      parts.push(smile);
      // knitted scarf: striped ring + knot + a tail streaming back
      const scarf = new THREE.TorusGeometry(0.175, 0.055, 10, 40);
      place(scarf, HX, 0.665, 0, Math.PI / 2, 0, 0, 1.1, 1.0, 1.05);
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
      const knot = new THREE.SphereGeometry(0.06, 12, 8);
      place(knot, HX - 0.02, 0.655, 0.2, 0, 0, 0, 1, 0.9, 0.8);
      solidC(knot, SCARF);
      parts.push(knot);
      const tail = new THREE.BoxGeometry(0.3, 0.07, 0.025, 6, 1, 1);
      {
        const p = tail.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          p.setY(i, p.getY(i) + Math.sin((x + 0.15) * 9) * 0.02 + (x + 0.15) * 0.12);
        }
      }
      tail.computeVertexNormals();
      place(tail, HX - 0.2, 0.67, 0.21, 0, 0.25, 0.05);
      paint(tail, (x, y, z, c) => {
        const stripe = Math.floor((x - HX) * 30 + 30) % 3 === 0;
        const col = stripe ? SCARF2 : SCARF;
        c[0] = col.r;
        c[1] = col.g;
        c[2] = col.b;
      });
      parts.push(tail);
      // mittens on the controls
      for (const side of [1, -1]) {
        const mitt = new THREE.SphereGeometry(0.048, 10, 8);
        place(mitt, HX + 0.3, 0.67, side * 0.12);
        solidC(mitt, SKIN, 0.95);
        parts.push(mitt);
      }
      const geo = merge(parts);
      geo.translate(-HX, -PIV_Y, 0);
      this.pogoLit = { value: 0.12 };
      const pogoMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0 }), U, {
        rim: { color: new THREE.Color('#fef9c3'), str: { value: 0.42 } },
        selfLit: this.pogoLit,
        key: 'pogo',
      });
      this.pogo = new THREE.Group();
      this.pogo.position.set(HX, PIV_Y, 0);
      this.pogo.add(new THREE.Mesh(geo, pogoMat));
      body.add(this.pogo);
    }

    // ---- glass canopy
    this.canopyMat = canopyMaterial(U);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 20, 0, TAU, 0, Math.PI / 2), this.canopyMat);
    canopy.position.set(0.2, 0.625, 0);
    canopy.scale.set(1.12, 1.04, 1.0);
    canopy.renderOrder = 15;
    body.add(canopy);

    // ---- propeller (spins) + motion-blur disc
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
      body.add(this.prop);
      this.propBlurMat = propBlurMaterial(U);
      const blur = new THREE.Mesh(new THREE.CircleGeometry(0.27, 32), this.propBlurMat);
      blur.position.set(-1.27, 0, 0);
      blur.rotation.y = Math.PI / 2;
      blur.renderOrder = 14;
      body.add(blur);
    }

    // ---- headlight: volumetric beam + a real spot light that lights fish / coral / seabed
    const coneGeo = new THREE.ConeGeometry(1.25, 5.0, 32, 1, true);
    coneGeo.rotateZ(Math.PI / 2);
    coneGeo.translate(1.32 + 2.5, 0, 0);
    this.coneMat = lightConeMaterial(U);
    this.cone = new THREE.Mesh(coneGeo, this.coneMat);
    this.cone.renderOrder = 8;
    body.add(this.cone);
    this.spot = new THREE.SpotLight('#fff1c4', 40, 15, 0.5, 0.7, 1.4);
    this.spot.position.set(1.3, 0, 0);
    this.spotTarget = new THREE.Object3D();
    this.spotTarget.position.set(5, -0.3, 0);
    body.add(this.spot, this.spotTarget);
    this.spot.target = this.spotTarget;

    this._portLocal = PORTS.map((px) => new THREE.Vector3(px, -0.02, hr(px) + 0.03));
    this._subTail = new THREE.Vector3();
    this._subSc = 0.5;
    this.scene.add(outer);
  }

  // ------------------------------------------------------------------ build: gameplay entities
  _buildEntities() {
    const U = this.U;
    this.fishRim = { value: 0.55 };
    const fishMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12 }), U, {
      wag: true,
      glow: true,
      eye: true,
      caustic: 0.9,
      rim: { color: new THREE.Color('#ffffff'), str: this.fishRim },
      key: 'fish',
    });
    this.fishMesh = instanced(buildFish(), fishMat, MAX_FISH, { glow: true, anim: true });
    this.ambMesh = instanced(buildFish(true), fishMat, MAX_AMB, { glow: true, anim: true });
    this.scene.add(this.fishMesh, this.ambMesh);

    // background schools: boids (cohesion / separation / alignment + wander), near ones flee the sub
    const rng = mulberry32(4321);
    this.ambSchools = [];
    const ambCols = ['#a9c9dc', '#7fb3d0', '#c7d9a8', '#e0b98a', '#9fd6c9', '#d6b3e8'].map((h) => new THREE.Color(h));
    const defs = [
      { z: -2.6, n: 18, avoid: true },
      { z: -3.6, n: 16, avoid: true },
      { z: -7, n: 22 },
      { z: -9.5, n: 20 },
      { z: -12, n: 24 },
      { z: -15, n: 24 },
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
        size: lerp(0.15, 0.22, rng()) * (d.z > -5 ? 1.25 : 1),
        color: ambCols[k % ambCols.length],
        ph: rng() * TAU,
        avoid: !!d.avoid,
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

    this.shellMesh = instanced(new THREE.SphereGeometry(1, 24, 16), bubbleShellMaterial(U), MAX_SHELL, { color: false });
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
    this.mineRim = { value: 0.9 };
    const mineMat = patchStd(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.35 }), U, {
      rim: { color: new THREE.Color('#ff4a2a'), str: this.mineRim },
      caustic: 0.5,
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
      caustic: 0.7,
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
    // four-point glints (sparkles, collect trails, sun glints)
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
    // dark soft halos behind the sub and hazards so they read against bright, busy water
    this.shadeMat = new THREE.MeshBasicMaterial({
      map: this.softDot,
      color: '#00060e',
      transparent: true,
      depthWrite: false,
      opacity: 0.3,
      toneMapped: false,
    });
    this.shadeMesh = instanced(new THREE.PlaneGeometry(1, 1), this.shadeMat, MAX_SHADE, { color: false });
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
    this.ringTex = ringTex;
    this.ringMesh = instanced(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      MAX_RING
    );
    this.ringMesh.renderOrder = 13;
    this.scene.add(this.ringMesh);

    // wake / ambient rising bubbles / pop droplets / surfacing spray (points)
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
    for (let i = 0; i < MAX_WAKE; i++) this.wake.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0.1, g: 0.8, bio: 0 });
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
    // premultiplied blending: aBio = 0 draws a normal see-through bubble, aBio = 1 an additive
    // bioluminescent spark (dinoflagellates lighting up in the prop wash of a dark sea)
    this.wakeMat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: bubbleTex }, uGlow: { value: this.softDot }, uPx: { value: 600 }, uColor: { value: new THREE.Color('#e6fbff') }, uBioCol: U.uBioCol },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
        uniform float uPx; attribute float aSize; attribute float aAlpha; attribute float aBio; varying float vA; varying float vB;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx / -mv.z * (1.0 + aBio * 0.8); vA = aAlpha; vB = aBio; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform sampler2D uGlow; uniform vec3 uColor; uniform vec3 uBioCol; varying float vA; varying float vB;
        void main(){
          float ta = texture2D(uMap, gl_PointCoord).a;
          float ga = texture2D(uGlow, gl_PointCoord).a;
          vec3 bubble = uColor * ta;
          vec3 spark = uBioCol * ga * 1.3;
          gl_FragColor = vec4(mix(bubble, spark, vB) * vA, ta * vA * (1.0 - vB));
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
    const U = this.U;
    const rng = mulberry32(99);
    // the tower you just toppled: a broken, sunken stump
    const g = new THREE.CylinderGeometry(2.3, 2.6, 1, 28, 8, true);
    g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const a = Math.atan2(p.getZ(i), p.getX(i));
      if (y > 0.99) p.setY(i, 0.55 + Math.abs(Math.sin(a * 3.3 + 1)) * 0.35 + Math.sin(a * 11) * 0.08);
    }
    g.computeVertexNormals();
    const stoneTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
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
      },
      { repeat: true }
    );
    stoneTex.repeat.set(4, 2);
    this.stoneTex = stoneTex;
    const rubbleMat = patchStd(
      new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, side: THREE.DoubleSide, color: '#ffffff', emissive: '#1a1426' }),
      U,
      { caustic: 0.6, key: 'rubble' }
    );
    this.rubble = new THREE.Mesh(g, rubbleMat);
    this.rubble.scale.set(1, 6, 1);
    this.rubble.rotation.z = 0.12;
    this.scene.add(this.rubble);
    const bg = new THREE.BoxGeometry(1, 0.7, 0.9);
    this.blocks = instanced(
      bg,
      patchStd(new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9, color: '#ffffff', emissive: '#1a1426' }), U, { caustic: 0.6, key: 'blocks' }),
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

    // the next tower: dark cylinder with glowing windows (palette.glow)
    const towerTex = canvasTex(
      256,
      256,
      (ctx, w, h) => {
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
        // thin glowing ledge line
        ctx.fillStyle = '#666';
        ctx.fillRect(0, 250, 256, 6);
      },
      { repeat: true }
    );
    this.towerTex = towerTex;
    this.winTex = winTex;
    const tg = new THREE.CylinderGeometry(1, 1, 1, 56, 1, true);
    tg.translate(0, 0.5, 0);
    this.towerMat = patchStd(
      new THREE.MeshStandardMaterial({
        map: towerTex,
        emissiveMap: winTex,
        emissive: new THREE.Color('#38bdf8'),
        emissiveIntensity: 2.4,
        roughness: 0.85,
        metalness: 0.1,
      }),
      U,
      { airFog: true, caustic: 0.5, key: 'tower' }
    );
    this.nextTower = new THREE.Mesh(tg, this.towerMat);
    this.nextTower.visible = false;
    this.scene.add(this.nextTower);
    const baseG = new THREE.CylinderGeometry(1.12, 1.25, 0.6, 56, 1, false);
    baseG.translate(0, 0.3, 0);
    this.towerBase = new THREE.Mesh(baseG, new THREE.MeshStandardMaterial({ color: '#1a1f33', roughness: 0.8, emissive: '#000000' }));
    this.towerBase.visible = false;
    this.scene.add(this.towerBase);
  }

  // ------------------------------------------------------------------ build: overlay (HUD, popups, particles, cinematic)
  _buildOverlay() {
    this.overlay = new THREE.Scene();
    this.oCam = new THREE.OrthographicCamera(0, 390, 0, -620, -10, 10);
    const quad = (this._quad = new THREE.PlaneGeometry(1, 1));
    const basic = (extra = {}) => new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...extra });

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
    this.vignette = new THREE.Mesh(quad, this.vigMat);
    this.vignette.renderOrder = 0;
    this.overlay.add(this.vignette);

    // over/under waterline + underwater tint for the arrival shot (full-screen, premultiplied)
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uLineY: { value: 0 },
        uSize: { value: new THREE.Vector2(390, 620) },
        uTime: this.U.uTime,
        uAlpha: { value: 0 },
        uTint: { value: new THREE.Color('#0a6787') },
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
          float d = px.y - wl; // > 0 below the waterline
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
    this.hudMarker = new THREE.Mesh(
      quad,
      basic({
        map: canvasTex(96, 64, (ctx) => {
          ctx.translate(48, 36);
          ctx.lineJoin = 'round';
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
          ctx.fillStyle = '#45c46c';
          ctx.beginPath();
          ctx.arc(5, -10, 6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(8, -14, 2.6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#fff8de';
          ctx.beginPath();
          ctx.arc(27, 4, 4, 0, TAU);
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

    // cinematic letterbox + ride-complete card
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

  // glass HUD panel: catch counters, sea bonus (rolling), distance to the next tower, progress track
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
    const fish = stage.fishCaught || 0;
    const pearls = stage.pearls || 0;
    const dist = Math.max(0, Math.round((1 - clamp(stage.progress || 0, 0, 1)) * 48)) * 10;
    const glow = stage.nextGlow || '#38bdf8';
    let d = this._hudDrawn;
    if (d && d.W === W && d.pr === pr && d.fish === fish && d.pearls === pearls && d.bonus === bonus && d.dist === dist && d.glow === glow) return;
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
    // panel
    const g = ctx.createLinearGradient(0, 6, 0, 58);
    g.addColorStop(0, 'rgba(14,34,62,0.66)');
    g.addColorStop(1, 'rgba(4,12,28,0.58)');
    ctx.fillStyle = g;
    this._roundRect(ctx, 8, 6, W - 16, 52, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,235,255,0.38)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(24, 7.5);
    ctx.lineTo(W - 24, 7.5);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    // counters
    this._fishGlyph(ctx, 24, 23, 1.05, '#ffb347');
    ctx.font = this._font(800, 15);
    this._txt(ctx, `${fish}`, 40, 23.5, '#fff3dc');
    const px = 40 + Math.max(22, ctx.measureText(`${fish}`).width + 14);
    this._pearlGlyph(ctx, px + 6, 23, 1);
    this._txt(ctx, `${pearls}`, px + 16, 23.5, '#ffe4f3');
    // distance to the next tower
    ctx.font = this._font(700, 7.5);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    this._txt(ctx, 'NEXT TOWER', W / 2, 16, 'rgba(160,240,255,0.85)', 'center', 0);
    ctx.font = this._font(800, 12);
    this._txt(ctx, `${dist} M`, W / 2, 29, '#e8fbff', 'center');
    // sea bonus
    ctx.font = this._font(700, 7.5);
    this._txt(ctx, 'SEA BONUS', W - 22, 16, 'rgba(255,214,120,0.9)', 'right', 0);
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
    ctx.strokeStyle = 'rgba(160,240,255,0.32)';
    ctx.stroke();
    for (let k = 1; k < 8; k++) {
      ctx.fillStyle = 'rgba(160,240,255,0.25)';
      ctx.fillRect(x0 + ((x1 - x0) * k) / 8 - 0.5, y - 2, 1, 4);
    }
    ctx.fillStyle = '#8b86a0';
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
    g.addColorStop(0, 'rgba(16,30,60,0.88)');
    g.addColorStop(1, 'rgba(5,10,26,0.9)');
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
      if (icon === 'fish') this._fishGlyph(ctx, cx - 16, 52, 0.9, '#ffb347');
      else if (icon === 'pearl') this._pearlGlyph(ctx, cx - 16, 52, 0.95);
      else if (icon === 'jelly') {
        ctx.fillStyle = '#f0abfc';
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

  // ------------------------------------------------------------------ healing look
  _applyHealing(h) {
    this._heal = h;
    const C = this.colors;
    const U = this.U;
    for (const k in PAL) mix3(C[k], PAL[k], h);
    this.fogColor.copy(C.fog);
    this.scene.fog.color.copy(C.fog);
    U.uFogFar.value = CAM_Z + lerp(22, 76, h);
    U.uFogNear.value = CAM_Z - 0.5;
    this.scene.fog.near = U.uFogNear.value;
    this.scene.fog.far = U.uFogFar.value;
    this.hemi.color.copy(C.hemiSky);
    this.hemi.groundColor.copy(C.hemiGround);
    this.hemi.intensity = lerp(1.3, 2.1, h);
    this.sun.color.copy(C.sun);
    this.sun.intensity = lerp(0.75, 2.6, h);
    this.back.intensity = lerp(0.8, 1.1, h);
    this.back.color.set(h < 0.4 ? '#8a7cff' : '#7ee8ff');
    const bu = this.bedMat.uniforms;
    bu.uSandA.value.copy(C.sandA);
    bu.uSandB.value.copy(C.sandB);
    bu.uCausticColor.value.copy(C.caustic);
    bu.uCaustic.value = lerp(0.12, 0.8, h);
    bu.uToxic.value.copy(C.toxic);
    bu.uToxicAmt.value = Math.pow(1 - h, 1.4);
    U.uCausticStr.value = lerp(0.1, 0.95, h);
    U.uCausticCol.value.copy(C.caustic);
    U.uBio.value = Math.pow(1 - h, 1.3);
    U.uBioCol.value.set('#45f0ff').lerp(this._c2.set('#c8fff4'), h);
    const su = this.surfMat.uniforms;
    su.uSurf.value.copy(C.surf);
    su.uSurfHi.value.copy(C.surfHi);
    su.uDeep.value.copy(C.surfDeep);
    su.uSunCol.value.copy(C.surfSun).multiplyScalar(lerp(0.35, 1.0, h));
    this.rayMat.uniforms.uColor.value.copy(C.ray);
    this.rayMat.uniforms.uStr.value = lerp(0.1, 0.55, h);
    const sn = this.snowMat.uniforms;
    sn.uColor.value.copy(C.snow);
    sn.uColor2.value.copy(C.bio);
    sn.uAlpha.value = lerp(1.05, 0.6, h);
    sn.uTwinkle.value = lerp(0.75, 0.3, h);
    const bd = this.backdropMat.uniforms;
    bd.uSkyTop.value.copy(C.skyTop);
    bd.uSkyHor.value.copy(C.skyHor);
    bd.uSunCol.value.copy(C.skySun);
    bd.uHeal.value = h;
    this.canopyMat.uniforms.uTint.value.copy(C.glass);
    this.canopyMat.uniforms.uSky.value.copy(C.surfHi);
    this.waterMat.uniforms.uTint.value.copy(C.fog);
    this.vigMat.uniforms.uColor.value.copy(C.vignette);
    this.vigMat.uniforms.uStr.value = lerp(0.5, 0.32, h);
    this._coralRim.value = lerp(0.08, 0.28, h);
    this.shadeMat.opacity = lerp(0.0, 0.42, h);
    this.subLit.value = lerp(0.08, 0.02, h);
    this.pogoLit.value = lerp(0.24, 0.1, h);

    const c = this._c;
    const tint = (layer, base, k = 1) => {
      for (let i = 0; i < layer.items.length; i++) {
        c.copy(base).multiplyScalar((layer.items[i].shade || 1) * k);
        layer.mesh.setColorAt(i, c);
      }
      layer.mesh.instanceColor.needsUpdate = true;
      layer.mesh.count = layer.items.length;
    };
    tint(this.farLayer, C.far);
    tint(this.ruinLayer, C.far, 1.25);
    tint(this.rockLayer, C.rock);

    // coral: dead & bleached -> lush & glowing; sparse -> dense
    const coralFrac = 0.34 + 0.66 * h;
    for (let li = 0; li < this._lushLayers.length; li++) {
      const layer = this._lushLayers[li];
      const glowAttr = layer.mesh.geometry.attributes.aGlow;
      const isKelp = layer === this.kelpLayer || layer === this.backKelpLayer;
      const isBack = layer === this.backKelpLayer;
      for (let i = 0; i < layer.items.length; i++) {
        const it = layer.items[i];
        c.lerpColors(it.dead, it.lush, isKelp ? Math.min(1, h * 1.3) : h);
        if (it.fg) c.multiplyScalar(0.55);
        if (isBack) c.lerp(C.far, 0.45).multiplyScalar(0.8);
        layer.mesh.setColorAt(i, c);
        glowAttr.array[i] = isKelp ? it.glow * h : it.glow * h * h * (it.fg ? 0.4 : 1);
        if (isKelp) it.kScale = lerp(isBack ? 0.55 : 0.32, 1, h);
      }
      glowAttr.needsUpdate = true;
      layer.mesh.instanceColor.needsUpdate = true;
      layer.visibleFrac = isBack ? 0.35 + 0.45 * h : isKelp ? 0.2 + 0.45 * h : coralFrac;
      layer.mesh.count = Math.max(1, Math.round(layer.items.length * layer.visibleFrac));
    }
    this._composeLayer(this.kelpLayer);
    this._composeLayer(this.backKelpLayer);
    this.barrelLayer.mesh.count = Math.round(this.barrelLayer.items.length * clamp((0.85 - h) / 0.85, 0, 1));
    for (let i = 0; i < this.barrelLayer.items.length; i++) this.barrelLayer.mesh.setColorAt(i, this._white);
    this.barrelLayer.mesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ glow helpers
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

  // ------------------------------------------------------------------ render
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
    const h = clamp(stage.healing || 0, 0, 1);
    if (Math.abs(h - this._heal) > 0.0005) this._applyHealing(h);

    const pxw = this._pxw(0) * this._kx;
    const scrollW = (stage.scroll || 0) * pxw;
    U.uScrollW.value = scrollW;
    const v = this._v;
    const seabedW = this._toWorld(0, stage.seabedY ?? stage.height * 0.905, 0, v).y;
    const surfW = this._toWorld(0, stage.surfaceY ?? stage.height * 0.085, 0, v).y;
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
    this._updateTowers(stage, scrollW, seabedW, surfW, time, h);
    this._updateSub(stage, time, dt, pxw);
    this._updateFish(stage, time, pxw);
    this._updateAmbient(stage, time, dt, scrollW, seabedW, surfW, h);
    this._updateShells(stage, time, pxw);
    this._updateJellies(stage, time, pxw);
    this._updateMines(stage, time, pxw, seabedW);
    this._updateClams(stage, time, pxw, seabedW, h);
    this._updateRings(stage, pxw);
    this._updateVfx(stage, time, pxw);
    this._updateWake(stage, dt, seabedW, surfW, h);
    this._glowEnd();

    // overlay
    this._popFrame++;
    this._updateFxGroup(stage);
    this._drawHud(stage, dt);
    this._updateHud(stage, time, dt);
    this._updateCinematic(stage, time);
    this._updateParticles(particles, pr);
    this._updatePopups(popups, stage);
    const sub = stage.sub;
    const flash = sub && sub.stun > 0 ? (sub.stun / (sub.stunMax || 1)) * 0.35 : 0;
    this.vigMat.uniforms.uFlash.value = flash;

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

  // View camera: a lazy follow + slow handheld drift while riding; for the arrival it rises to the
  // waterline, dollies in and tilts up for an over/under shot of the sub surfacing by the tower.
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
    const bl = this.barrelLayer;
    const kb = clamp((0.85 - h) / 0.85, 0, 1);
    for (let i = 0; i < bl.mesh.count; i++) {
      const it = bl.items[i];
      const p = 0.6 + 0.4 * Math.sin(time * 2.3 + i * 1.7);
      this._glow(it.x, it.y + 0.3, it.z + 0.6, 2.3, 0.25 * p * kb, 0.7 * p * kb, 0.12 * p * kb);
    }
    if (h < 0.12) return;
    const L = this.stagLayer;
    const tips = this.staghornTips || EMPTY;
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
    for (let li = 0; li < this._haloLayers.length; li++) {
      const layer = this._haloLayers[li];
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
    const cine = this._cine;
    // foam collar where the tower meets the sea + its glow spilling above the water
    const fk = (0.3 + 0.7 * cine) * (0.85 + 0.15 * Math.sin(time * 3.1));
    this._glow(x, surfW - 0.03, TOWER_Z + R + 0.25, R * 2.7, 0.62 * fk, 0.72 * fk, 0.78 * fk, 0.28);
    this._glow(x, surfW + 2.5, TOWER_Z - 1.4, R * 5, g.r * 0.3 * cine, g.g * 0.3 * cine, g.b * 0.3 * cine);
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
    // gameplay events drive springs: fire = recoil, catch = happy bounce, hit = big squash
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
    const sc = ((sub.rx * pxw) / 1.15) * 1.06;
    const surf = sub.surfaced || 0;
    const bob = Math.sin(time * 2.1) * 0.045 * sc * (1 - surf) + Math.sin(time * 1.8) * 0.035 * sc * surf;
    outer.position.set(v.x - this._recoil * 0.07 * sc, v.y + bob, 0);
    const sq = this._sq;
    outer.scale.set(sc * (1 + sq * 0.16), sc * (1 - sq * 0.13), sc * (1 - sq * 0.1));
    const vx = sub.vx || 0;
    const vy = sub.vy || 0;
    const pitch = clamp(-vy * 0.0016 - (sub.ay || 0) * 0.00012, -0.42, 0.42) + Math.sin(time * 1.7) * 0.02;
    const roll = 0.15 + clamp(vy * 0.0007 + (sub.ax || 0) * 0.00008, -0.22, 0.3) + Math.sin(time * 1.3) * 0.03;
    const yaw = -0.3 + clamp(vx * 0.0007, -0.16, 0.16);
    outer.rotation.set(
      roll * (1 - surf) + surf * (0.14 + Math.sin(time * 1.4) * 0.05),
      yaw * (1 - surf) - surf * 0.2,
      pitch * (1 - surf) + surf * Math.sin(time * 1.9) * 0.05
    );
    this.subInner.rotation.x = sub.spin || 0;
    const spin = dt * (6 + (sub.prop ?? 1) * 30);
    this.prop.rotation.x += spin;
    this.propBlurMat.uniforms.uSpin.value = time * 9;
    this.propBlurMat.uniforms.uAmt.value = clamp(((sub.prop ?? 1) - 0.25) / 0.9, 0, 1);
    // Pogo: hops when he catches something, wobbles dizzily when stunned, leans with the motion
    const ch = this._cheer;
    this.pogo.position.y = 0.62 + Math.abs(Math.sin((1 - ch) * Math.PI * 3)) * 0.035 * ch;
    this.pogo.rotation.y = sub.stun > 0 ? Math.sin(time * 15) * 0.35 : Math.sin(time * 0.9) * 0.08;
    this.pogo.rotation.z = clamp(vx * 0.0004, -0.12, 0.12) + ch * Math.sin(time * 20) * 0.06;

    // stun flashing / invulnerability blink
    let fl = 0;
    if (sub.stun > 0) fl = Math.sin(time * 42) > 0 ? 1.1 : 0.15;
    else if (sub.invuln > 0) fl = Math.sin(time * 26) > 0.4 ? 0.35 : 0;
    for (let i = 0; i < this.flashMats.length; i++) this.flashMats[i].emissive.setRGB(fl, fl * 0.9, fl * 0.95);
    const h = this._heal;
    const lightOn = (sub.stun > 0 ? (Math.sin(time * 30) > 0 ? 0.3 : 0) : 1) * (1 - smooth01(surf * 1.5));
    this.coneMat.uniforms.uStr.value = lerp(0.55, 0.22, h) * lightOn;
    this.spot.intensity = lerp(70, 30, h) * lightOn;

    // glows anchored to sub parts
    outer.updateMatrixWorld(true);
    const p = this._v2;
    const body = this.subBody;
    body.localToWorld(p.set(1.3, 0, 0));
    this._glow(p.x, p.y, p.z + 0.35, sc * 1.25 * lightOn, 1.0 * lightOn, 0.95 * lightOn, 0.72 * lightOn);
    this._star(p.x, p.y, p.z + 0.5, sc * 1.5 * lightOn, 0.3 + Math.sin(time * 0.7) * 0.1, 0.6 * lightOn, 0.56 * lightOn, 0.4 * lightOn);
    const blink = Math.sin(time * 4.2) > 0.55 ? 1 : 0.12;
    body.localToWorld(p.copy(this._navLocal));
    this._glow(p.x, p.y, p.z + 0.2, sc * 0.55 * blink, 1.0 * blink, 0.2 * blink, 0.2 * blink);
    const portK = lerp(0.42, 0.16, h);
    for (let i = 0; i < this._portLocal.length; i++) {
      body.localToWorld(p.copy(this._portLocal[i]));
      this._glow(p.x, p.y, p.z + 0.15, sc * 0.42, 1.0 * portK, 0.75 * portK, 0.35 * portK);
    }
    // warm cockpit backlight so Pogo reads against any water colour
    body.localToWorld(p.set(0.24, 0.84, -0.35));
    const ck = lerp(0.3, 0.16, h);
    this._glow(p.x, p.y, p.z, sc * 1.5, 0.95 * ck, 0.85 * ck, 0.5 * ck);
    this._glow(v.x, v.y + bob, -0.8, sc * 4.6, 0.14, 0.12, 0.05);
    this._shade(v.x, v.y + bob, sc * 5.2, sc * 3.6);
    // surfacing: foam where the hull breaks the water
    if (surf > 0) {
      const foam = surf * (0.75 + 0.25 * Math.sin(time * 6));
      this._glow(v.x, this._surfW - 0.03, 0.75, sc * 4.2, 0.32 * foam, 0.38 * foam, 0.42 * foam, sc * 0.32);
      this._glow(v.x - sc * 0.9, this._surfW - 0.03, 0.8, sc * 2.2, 0.4 * foam, 0.45 * foam, 0.46 * foam, sc * 0.22);
    }
    body.localToWorld(this._subTail.set(-1.4, 0, 0));
    this._subSc = sc;
  }

  _fishColor(f, out) {
    if (f.type === 'gold') return out.copy(this._fishGold);
    if (f.type === 'big') return out.copy(this._fishBig[f.color % this._fishBig.length]);
    return out.copy(this._fishSmall[f.color % this._fishSmall.length]);
  }

  _updateFish(stage, time, pxw) {
    const fish = stage.fish || EMPTY;
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
        d.rotation.set(0, (f.dir > 0 ? Math.PI : 0) + 0.25, clamp((f.vy || 0) * 0.004, -0.5, 0.5));
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
      if (f.type === 'gold') {
        for (let k = 0; k < 3; k++) {
          const a = time * (2.2 + k * 0.7) + k * 2.1 + f.seed;
          const tw = Math.max(0, Math.sin(time * 7 + k * 2.3));
          this._star(v.x + Math.cos(a) * s * 1.3, v.y + Math.sin(a * 1.3) * s * 0.8, 0.6, s * 1.4 * tw, a, 1, 0.9 * tw, 0.5 * tw);
        }
      }
      // fresh bubble: a few glints spin around the trapped fish
      if (bubbled && f.bubbleT < 0.45) {
        const k = 1 - f.bubbleT / 0.45;
        const R = f.bubbleR * pxw;
        for (let j = 0; j < 4; j++) {
          const a = j * 1.5708 + f.bubbleT * 7 + f.seed;
          this._star(v.x + Math.cos(a) * R, v.y + Math.sin(a) * R, 0.7, R * 0.7 * k, a, 0.8 * k, 0.95 * k, 1.0 * k);
        }
      }
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aAnim.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
  }

  // Ambient boid schools. Positions/velocities are local to each school's anchor (which travels and
  // wraps with the scenery); orientation follows the velocity, written straight into the matrices.
  _updateAmbient(stage, time, dt, scrollW, seabedW, surfW, h) {
    const mesh = this.ambMesh;
    const arr = mesh.instanceMatrix.array;
    const anim = mesh.geometry.attributes.aAnim.array;
    const glow = mesh.geometry.attributes.aGlow.array;
    const P = this.boidPos;
    const V = this.boidVel;
    const c = this._c;
    const total = Math.round(lerp(14, MAX_AMB, h));
    const sub = stage.sub;
    const sw = sub ? this._toWorld(sub.x, sub.y, 0, this._v2) : this._v2.set(999, 999, 0);
    const avoidR = Math.max(1.2, (this._subSc || 0.5) * 2.6);
    const sdt = Math.min(dt, 0.033);
    let n = 0;
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
      // write visible instances
      const lush = c.copy(S.color).lerp(this._sick, (1 - h) * 0.7);
      lush.lerp(this.U.uBioCol.value, (1 - h) * 0.45);
      for (let i = i0; i < i1 && n < total && n < MAX_AMB; i++) {
        const o = i * 3;
        // heading = swimming direction through the water (school drift + own velocity)
        let hx = S.dir * S.speed * 0.8 + V[o];
        let hy = V[o + 1];
        let hz = V[o + 2];
        const hl = Math.sqrt(hx * hx + hz * hz) + 1e-4;
        if (Math.abs(hy) > hl * 0.6) hy = Math.sign(hy) * hl * 0.6;
        const l = Math.sqrt(hx * hx + hy * hy + hz * hz) + 1e-5;
        // local +X axis points backwards (model head is at -X)
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
        const m = n * 16;
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
        mesh.setColorAt(n, lush);
        anim[n * 3] = 11 + fract(i * 0.61) * 4;
        anim[n * 3 + 1] = i * 1.3 + k;
        anim[n * 3 + 2] = 0.8;
        glow[n] = lerp(0.45, 0.08, h);
        n++;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.geometry.attributes.aAnim.needsUpdate = true;
    mesh.geometry.attributes.aGlow.needsUpdate = true;
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

  _updateShells(stage, time, pxw) {
    let n = 0;
    const bubbles = stage.bubbles || EMPTY;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const v = this._toWorld(b.x, b.y, 0, this._v);
      const grow = clamp(b.age / 0.12, 0.3, 1);
      // squash-stretch along the flight (fast = stretched), settling into a wobble
      const sp = clamp(Math.abs(b.vx || 0) / 400, 0, 1);
      n = this._putShell(n, v.x, v.y, 0.3, b.r * pxw * grow, sp * 0.18 + Math.sin(b.age * 18 + b.seed) * 0.08);
      this._glow(v.x, v.y, 0.2, b.r * pxw * 3.2, 0.1, 0.22, 0.28);
      // a little trail of micro bubbles
      if (((b.age * 30) | 0) % 2 === 0 && Math.random() < 0.5) {
        this._spawnWake(v.x - b.r * pxw * 1.2, v.y + (Math.random() - 0.5) * b.r * pxw, 0.3, -0.4, 0.2, 0.04 + Math.random() * 0.04, 0.5, 0.8, 0);
      }
    }
    const fish = stage.fish || EMPTY;
    for (let i = 0; i < fish.length; i++) {
      const f = fish[i];
      if (f.state !== 'bubbled' || f.bubbleT < 0) continue;
      const v = this._toWorld(f.x, f.y, 0, this._v);
      const pop = clamp(f.bubbleT / 0.18, 0, 1);
      const over = 1 + Math.sin(pop * Math.PI) * 0.25;
      const jig = Math.exp(-f.bubbleT * 4) * Math.sin(f.bubbleT * 30) * 0.12;
      n = this._putShell(n, v.x, v.y, 0.2, f.bubbleR * pxw * pop * over, Math.sin(time * 3 + f.seed) * 0.05 + jig);
    }
    this.shellMesh.count = n;
    this.shellMesh.instanceMatrix.needsUpdate = true;
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
    const clams = stage.clams || EMPTY;
    const d = this._dummy;
    const c = this._c;
    c.copy(this._clamDead).lerp(this._clamLush, h);
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
        if (o > 0.4) this._star(v.x + sc * 0.15, y + pr * 1.4, hingeZ + sc * 1.5, sc * 0.9 * o * (0.6 + 0.4 * Math.sin(time * 8 + i)), time * 1.5, 1, 0.85, 0.95);
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
      const o = n * 16;
      arr.fill(0, o, o + 16);
      arr[o] = rad;
      arr[o + 5] = r.flat ? rad * 0.22 : rad;
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

  // one-shot presentation events from the stage (sparkles, pops, whooshes, splashes, ...)
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
              this._spawnWake(v.x + Math.cos(a) * S * 0.6, v.y + Math.sin(a) * S * 0.6, 0.4, Math.cos(a) * sp, Math.sin(a) * sp, 0.05 + Math.random() * 0.06, 0.45 + Math.random() * 0.3, 0.5, 0);
            }
          }
          this._star(v.x, v.y, 0.8, S * 1.6 * k * k, e.id, rgb[0] * k, rgb[1] * k, rgb[2] * k);
          break;
        }
        case 'muzzle': {
          if (fresh) {
            for (let j = 0; j < 4; j++) {
              this._spawnWake(v.x, v.y + (Math.random() - 0.5) * S, 0.35, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2, 0.04 + Math.random() * 0.05, 0.4, 0.6, 0);
            }
          }
          this._glow(v.x, v.y, 0.6, S * 3 * k, 0.35 * k, 0.55 * k, 0.65 * k);
          break;
        }
        case 'collect': {
          // a glint flies from the catch into the sub
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
          // speed streaks peeling off the hull on the side the hazard passed
          const side = e.a || 1;
          const sv = sub ? this._toWorld(sub.x, sub.y, 0, this._v3) : v;
          for (let j = 0; j < 5; j++) {
            const off = (j - 2) * 0.16 * sc;
            const x = sv.x - (0.2 + t * 3.4 + Math.abs(j - 2) * 0.3) * sc;
            const y = sv.y - side * (0.72 * sc + off) ;
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
            for (let j = 0; j < 46; j++) {
              const a = Math.PI * 0.5 + (Math.random() - 0.5) * 1.6;
              const sp = 2.5 + Math.random() * 4.5;
              this._spawnWake(
                v.x + (Math.random() - 0.5) * sc * 2.4,
                this._surfW + 0.02,
                (Math.random() - 0.5) * 0.8,
                Math.cos(a) * sp * 0.6,
                Math.sin(a) * sp,
                0.06 + Math.random() * 0.1,
                1.0 + Math.random() * 0.6,
                -9.5,
                0
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
    if (sub && (sub.surfaced || 0) < 0.3) {
      const prop = sub.prop ?? 1;
      this._wakeAcc += dt * (10 + prop * 30);
      const sc = this._subSc || 0.5;
      while (this._wakeAcc > 1) {
        this._wakeAcc -= 1;
        // propeller wash: a helix of bubbles spiralling out behind the shroud
        this._wakeSwirl += 2.39996;
        const r = 0.16 * sc;
        const bio = Math.random() < bioAmt * 0.75 ? 1 : 0;
        this._spawnWake(
          this._subTail.x + (Math.random() - 0.5) * 0.1 * sc,
          this._subTail.y + Math.sin(this._wakeSwirl) * r,
          this._subTail.z + Math.cos(this._wakeSwirl) * r,
          -(0.7 + prop * 1.1) - Math.random() * 0.5,
          0.15 + Math.random() * 0.35 + Math.sin(this._wakeSwirl) * 0.3,
          (0.05 + Math.random() * 0.09) * sc * 2.2,
          0.8 + Math.random() * 0.8,
          0.8,
          bio
        );
      }
    }
    // vents: little bubble streams rising from the seabed (more life = more bubbles)
    this._ventAcc += dt * lerp(3, 9, h);
    while (this._ventAcc > 1) {
      this._ventAcc -= 1;
      const z = lerp(-1, -7, Math.random());
      const hw = this._halfW(z);
      this._spawnWake((Math.random() * 2 - 1) * hw, seabedW + 0.1, z, 0, 0.6 + Math.random() * 0.6, 0.06 + Math.random() * 0.08, 3 + Math.random() * 3, 0.8, 0);
    }
    for (let i = 0; i < MAX_WAKE; i++) {
      const w = this.wake[i];
      if (w.life > 0) {
        w.life -= dt;
        if (w.g > 0) {
          // bubble: drag, buoyancy, wobble; pops at the surface
          w.vx *= Math.exp(-2 * dt);
          w.vy = Math.min(w.vy * Math.exp(-1.5 * dt) + dt * w.g * 1.4, 1.6);
          w.x += (w.vx - worldSpeed) * dt + Math.sin(w.life * 7 + i) * 0.004;
          w.y += w.vy * dt;
          if (w.y > surfW) w.life = 0;
        } else {
          // spray droplet: ballistic in air, gone when it falls back in
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
      this.wakeAlpha[i] = a * (w.bio ? 0.9 : 0.85);
      this.wakeBio[i] = w.bio;
    }
    const g = this.wakePoints.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aBio.needsUpdate = true;
  }

  _updateHud(stage, time, dt) {
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

    // combo badge
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

  _updateCinematic(stage, time) {
    const cine = this._cine;
    const W = this.width;
    const H = this.height;
    // letterbox
    const lb = H * 0.075 * smooth01(cine * 1.3);
    this.lbTop.visible = this.lbBot.visible = lb > 0.5;
    if (lb > 0.5) {
      this.lbTop.scale.set(W, lb, 1);
      this.lbTop.position.set(W / 2, -lb / 2, 0);
      this.lbBot.scale.set(W, lb, 1);
      this.lbBot.position.set(W / 2, -H + lb / 2, 0);
    }
    // waterline across the lens once the camera reaches the surface
    const wa = smooth01((cine - 0.72) / 0.22);
    this.waterline.visible = wa > 0.01;
    if (wa > 0.01) {
      const p = this._va.set(this.camera.position.x, this._surfW, this.camera.position.z - 120).project(this.camera);
      this.waterMat.uniforms.uLineY.value = (1 - p.y) * 0.5 * H;
      this.waterMat.uniforms.uAlpha.value = wa;
    }
    // ride-complete card with a counting bonus, once the sub has broken the surface
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
    // portrait: under the banner, in the sky; landscape: tucked into the sky on the left
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
      // cache the texture entry on the popup itself (no per-frame key strings)
      let e = pop.__subTex;
      if (!e || e.dead || e.text !== pop.text || e.color !== (pop.color || '#ffffff')) {
        e = this._popupTex(pop.text, pop.color || '#ffffff');
        pop.__subTex = e;
      } else e.used = this._popFrame;
      if (m.material.map !== e.tex) {
        m.material.map = e.tex;
        m.material.needsUpdate = true;
      }
      const t = 1 - clamp(pop.life / (pop.maxLife || 1), 0, 1);
      // punchy pop-in with overshoot, then drift + fade
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
        if (m.map && m.map !== this.softDot && !seen.has(m.map)) {
          seen.add(m.map);
          m.map.dispose();
        }
        if (m.emissiveMap && !seen.has(m.emissiveMap)) {
          seen.add(m.emissiveMap);
          m.emissiveMap.dispose();
        }
        m.dispose();
      }
    };
    this.scene.traverse(kill);
    this.overlay.traverse(kill);
    for (const e of this._popCache.values()) e.tex.dispose();
    this._popCache.clear();
    for (const t of this._comboTex) if (t) t.dispose();
    this.bubbleTex?.dispose();
    this.starTex?.dispose();
    if (this._ownSoftDot) this.softDot.dispose();
  }
}
