// Pogo — hero of Planet Nebulus, rebuilt as a character.
// True to the original (a little green frog-like creature with big eyes who walks upright and
// throws snowballs) with a designer-vinyl finish and a personality layer:
//  * squishy bean body with frog eye-domes, glossy eyes with double catchlights, wide frog grin,
//    cheek blush and freckles, mitten hands, big flat frog feet
//  * a red knitted scarf whose tails are simulated (they trail, flutter and whip around)
//  * he THROWS snowballs overhand, and packs a growing snowball in his hands while charging
//  * emotions drive lids, brows, mouth, blush, arms and antics: waddle, jump, panic windmill,
//    dizzy stars, sweat, idle wave + tongue "blep", nap with Zzz and a snot bubble, summit dance
//
// Local space: feet at y = 0, facing +X, up +Y.
import * as THREE from 'three';
import { meshSDF, sdSphere, sdEllipsoid, sdCapsule, smin, ssub, traceSurface, paintVertices } from './sculpt.js';

const TWO_PI = Math.PI * 2;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

function zTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '900 48px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(15,23,42,0.9)';
  ctx.strokeText('Z', 32, 34);
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText('Z', 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Knitted stripe texture for the scarf
function knitTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(0, 22, 64, 8);
  ctx.fillRect(0, 50, 64, 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 64; x += 8) {
    for (let y = 0; y < 64; y += 8) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 6);
      ctx.lineTo(x + 8, y);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Equirectangular eye texture: iris + pupil painted at the front (u = 0.5, v = 0.5) so the
// eyeball can simply rotate to look around. kind: 'normal' | 'heart' | 'spiral' | 'star'
function eyeTexture(kind) {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // Sclera: white with soft cool shading toward the back
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.5);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#f8fafc');
  g.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  const R = 54; // iris radius (~38° of arc)
  // Iris: warm amber with darker rim, radial fibres
  const ig = ctx.createRadialGradient(cx, cy - 6, 4, cx, cy, R);
  ig.addColorStop(0, '#fde68a');
  ig.addColorStop(0.45, '#f59e0b');
  ig.addColorStop(0.85, '#b45309');
  ig.addColorStop(1, '#451a03');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 1.02, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
  ctx.lineWidth = 2;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.38, cy + Math.sin(a) * R * 0.38);
    ctx.lineTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88);
    ctx.stroke();
  }
  // Limbal ring
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#2a1203';
  ctx.beginPath();
  ctx.ellipse(cx, cy, R - 2, R * 1.02 - 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#05070d';
  if (kind === 'heart') {
    ctx.fillStyle = '#e11d48';
    const s = 1.05;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 26 * s);
    ctx.bezierCurveTo(cx - 44 * s, cy - 2 * s, cx - 22 * s, cy - 36 * s, cx, cy - 16 * s);
    ctx.bezierCurveTo(cx + 22 * s, cy - 36 * s, cx + 44 * s, cy - 2 * s, cx, cy + 26 * s);
    ctx.fill();
  } else if (kind === 'spiral') {
    ctx.strokeStyle = '#05070d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.1) {
      const r = 3 + a * 2.3;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (kind === 'star') {
    ctx.fillStyle = '#05070d';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 30 : 13;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 25, 27, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Chunky striped knit. `along` = which texture axis runs along the scarf's length ('u' or 'v');
// stripes are bands across the scarf, repeating along its length (they ring the whole way round).
function chunkyKnitTexture(along = 'u') {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  // Draw with stripes as vertical bands (varying along x), then rotate if needed
  const draw = (g) => {
    const bands = [
      ['#dc2626', 46],
      ['#fef3c7', 11],
      ['#dc2626', 9],
      ['#fde68a', 6],
      ['#dc2626', 9],
      ['#fef3c7', 11],
      ['#dc2626', 36],
    ];
    let x = 0;
    for (const [col, w] of bands) {
      g.fillStyle = col;
      g.fillRect(x, 0, w, S);
      x += w;
    }
    // knit rows: V stitches stacked across the scarf
    for (let yy = 0; yy < S; yy += 16) {
      for (let xx = 0; xx < S; xx += 8) {
        const lg = g.createLinearGradient(xx, yy, xx, yy + 16);
        lg.addColorStop(0, 'rgba(0,0,0,0.3)');
        lg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
        lg.addColorStop(1, 'rgba(0,0,0,0.3)');
        g.strokeStyle = lg;
        g.lineWidth = 3.5;
        g.beginPath();
        g.moveTo(xx, yy + 1);
        g.lineTo(xx + 7, yy + 8);
        g.lineTo(xx, yy + 15);
        g.stroke();
      }
    }
  };
  if (along === 'u') {
    draw(ctx);
  } else {
    ctx.translate(S, 0);
    ctx.rotate(Math.PI / 2);
    draw(ctx);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Inverted-hull cartoon outline: a back-face shell pushed out along the normals
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: '#0b1226', side: THREE.BackSide });
OUTLINE_MAT.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed += normalize(normal) * 0.021;'
  );
};
OUTLINE_MAT.customProgramCacheKey = () => 'pogo-outline';
function addOutline(mesh) {
  const o = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
  o.castShadow = false;
  o.userData.outline = true;
  mesh.add(o);
  return o;
}

// Fresnel rim light + form shading. Pogo's body is otherwise one smooth colour, which reads as a
// "blob"; this darkens him underneath, in the creases under the scarf / arms / eye domes, and adds
// a soft top-light, so his shape reads at a glance. Uses object-space height (feet = 0, top ≈ 0.84).
function addRimLight(mat, color = '#d9f99d', strength = 0.3, { form = true } = {}) {
  mat.userData.rim = { value: new THREE.Color(color) };
  mat.userData.rimStrength = { value: strength };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = mat.userData.rim;
    shader.uniforms.rimStrength = mat.userData.rimStrength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nvarying vec3 vObjPos;')
      .replace(
        '#include <map_fragment>',
        form
          ? `#include <map_fragment>
        // height-based occlusion (darker toward the feet), soft top light
        float yN = clamp(vObjPos.y / 0.84, 0.0, 1.0);
        float ao = mix(0.5, 1.0, smoothstep(0.02, 0.55, yN));
        // crease under the scarf (scarf sits around y = 0.39)
        ao *= 1.0 - 0.28 * exp(-pow((vObjPos.y - 0.31) / 0.045, 2.0));
        // seam under the eye domes
        ao *= 1.0 - 0.16 * exp(-pow((vObjPos.y - 0.64) / 0.03, 2.0));
        diffuseColor.rgb *= ao;
        diffuseColor.rgb *= 1.0 + 0.12 * smoothstep(0.6, 1.0, yN);`
          : '#include <map_fragment>'
      )
      .replace(
        '#include <opaque_fragment>',
        'float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);\noutgoingLight += rimColor * rimF * rimStrength;\n#include <opaque_fragment>'
      );
  };
  mat.customProgramCacheKey = () => 'pogo-rim-' + (form ? 'f' : 'n');
}

// ---------------------------------------------------------------------------------------------
// Pogo's sculpt: head and body are ONE continuous surface built from blended shapes, so the
// cheeks, muzzle, eye sockets, belly and the waist all catch light and cast soft shadow.
// Local space: feet at y = 0, facing +X, symmetric in Z.
// ---------------------------------------------------------------------------------------------
// Like the 1987 sprite, Pogo is a plump, hunched frog: a big round body and back, frog haunches,
// and the head pushed FORWARD of the body rather than stacked on top of it. Every head feature is
// modelled in head space and offset by HEAD, so eyes, mouth, cheeks and blush all move together.
const HEAD = { x: 0.1, y: -0.02 };
const EYE = { x: 0.065 + HEAD.x, y: 0.775 + HEAD.y, z: 0.152, r: 0.148 }; // eye domes
export const EYEBALL = { x: 0.12 + HEAD.x, y: 0.787 + HEAD.y, z: 0.162, r: 0.113 };
// The whole upper body (sculpt, face, scarf, arms) rides BODY_LIFT above the ground so his frog
// legs show beneath the belly, standing and walking, like the original sprite.
const BODY_LIFT = 0.065;
const HIP = { x: -0.005, y: 0.205, z: 0.2 }; // hips sit inside the lifted belly; legs reach the ground
const SCARF_Y = 0.45; // mid-height of the band at the sides
const SCARF_TILT = 0.075; // a real wrap: low under the chin, up at the nape where it's knotted

function pogoSDF(x, y, z) {
  const az = Math.abs(z);
  const hx = x - HEAD.x; // head space
  const hy = y - HEAD.y;
  // big round body, set back under a rounded hump of a back
  // ONE smooth round body, as wide side-to-side as it is deep, so he reads the same plump shape
  // from the front, three-quarter and side (no separate hump: that left a kink in the profile)
  let d = sdEllipsoid(x, y, z, -0.07, 0.35, 0, 0.4, 0.315, 0.42);
  // frog haunches, blended in softly so they round out the lower sides without lumps
  d = smin(d, sdEllipsoid(x, y, az, -0.09, 0.19, 0.25, 0.17, 0.12, 0.11), 0.14);
  // the head, forward of the body, blended in with a soft fold
  d = smin(d, sdEllipsoid(hx, hy, z, 0.02, 0.585, 0, 0.29, 0.225, 0.305), 0.12);
  // belly bulge, front-low, with a gentle crease where it meets the body
  d = smin(d, sdEllipsoid(x, y, z, 0.11, 0.29, 0, 0.23, 0.22, 0.31), 0.035);
  // wide frog muzzle
  d = smin(d, sdEllipsoid(hx, hy, z, 0.165, 0.565, 0, 0.135, 0.085, 0.205), 0.06);
  // puffy cheeks
  d = smin(d, sdSphere(hx, hy, az, 0.16, 0.515, 0.175, 0.095), 0.05);
  // brow pads above the eyes
  d = smin(d, sdEllipsoid(hx, hy, az, 0.1, 0.9, 0.16, 0.07, 0.035, 0.07), 0.04);
  // frog eye domes
  d = smin(d, sdSphere(x, y, az, EYE.x, EYE.y, EYE.z, EYE.r), 0.06);
  // sockets the eyeballs sit in
  d = ssub(d, sdSphere(x, y, az, EYEBALL.x + 0.055, EYEBALL.y, EYEBALL.z + 0.004, 0.098), 0.022);
  // dimples at the mouth corners
  d = ssub(d, sdSphere(hx, hy, az, 0.262, 0.565, 0.14, 0.022), 0.022);
  // nostrils
  d = ssub(d, sdSphere(hx, hy, az, 0.292, 0.648, 0.042, 0.013), 0.012);
  return d;
}

// Big webbed frog foot + short leg (local hip space: hip at origin, toes toward +X)
function footSDF(x, y, z) {
  // chunky thigh tapering to the ankle
  let d = sdCapsule(x, y, z, -0.01, 0.03, 0, 0.018, -0.12, 0, 0.074);
  d = smin(d, sdEllipsoid(x, y, z, -0.015, -0.02, 0, 0.085, 0.07, 0.08), 0.05);
  d = smin(d, sdEllipsoid(x, y, z, 0.06, -0.159, 0, 0.165, 0.058, 0.125), 0.06);
  for (const tz of [-0.082, 0, 0.082]) d = smin(d, sdEllipsoid(x, y, z, 0.215, -0.167, tz, 0.06, 0.036, 0.042), 0.035);
  d = Math.max(d, -(y + 0.205)); // flat sole
  return d;
}

// Chunky arm with a big mitten hand and thumb (local shoulder space: hangs toward -Y, thumb +X)
function armSDF(side) {
  return (x, y, z) => {
    // tapered sausage arm flowing into the mitten (no pinched wrist)
    let d = sdCapsule(x, y, z, 0, 0.0, 0, 0.004, -0.13, 0, 0.07);
    d = smin(d, sdEllipsoid(x, y, z, 0.012, -0.2, 0, 0.088, 0.086, 0.096), 0.09);
    d = smin(d, sdEllipsoid(x, y, z, 0.068, -0.222, -side * 0.055, 0.04, 0.036, 0.034), 0.025);
    return d;
  };
}

let SCULPT = null;
function sculptCache() {
  if (SCULPT) return SCULPT;
  const body = meshSDF(pogoSDF, [-0.5, -0.02, -0.5], [0.52, 0.97, 0.5], 0.0125, { aoScale: 1.2 });
  const foot = meshSDF(footSDF, [-0.13, -0.22, -0.16], [0.3, 0.12, 0.16], 0.0085, { aoScale: 0.7 });
  const armL = meshSDF(armSDF(-1), [-0.12, -0.32, -0.13], [0.14, 0.08, 0.13], 0.0075, { aoScale: 0.6 });
  const armR = meshSDF(armSDF(1), [-0.12, -0.32, -0.13], [0.14, 0.08, 0.13], 0.0075, { aoScale: 0.6 });
  SCULPT = { body, foot, armL, armR };
  return SCULPT;
}

const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const FRECKLES = [
  [-0.22, 0.64, 0.16],
  [-0.27, 0.6, -0.12],
  [-0.06, 0.76, -0.05],
  [-0.36, 0.48, 0.08],
  [-0.12, 0.7, 0.24],
  [0.0, 0.81, 0.1],
  [-0.38, 0.36, -0.2],
  [-0.3, 0.52, 0.25],
];

// Paint the body skin: base colour, cream belly & throat, cheek blush, freckles, then
// multiply by baked occlusion and a soft top light so every crease has shadow.
function paintBody(geo, ao, skinHex) {
  const base = new THREE.Color(skinHex);
  const deep = base.clone().multiplyScalar(0.6);
  const cream = new THREE.Color('#f3f7cf');
  const blush = new THREE.Color('#f87197');
  const c = new THREE.Color();
  paintVertices(geo, (x, y, z, i, out) => {
    const az = Math.abs(z);
    c.copy(base);
    // belly + throat cream, fading softly at the edge
    const bellyD = sdEllipsoid(x, y, z, 0.13, 0.29, 0, 0.215, 0.205, 0.29);
    const front = smooth(0.0, 0.11, x);
    let m = smooth(0.025, -0.03, bellyD) * front;
    const throat = smooth(0.06, -0.02, sdEllipsoid(x, y, z, 0.2 + HEAD.x, 0.49 + HEAD.y, 0, 0.12, 0.06, 0.17)) * smooth(0.12 + HEAD.x, 0.2 + HEAD.x, x);
    m = Math.max(m, throat * 0.8);
    c.lerp(cream, m);
    // cheek blush
    const bd = (x - 0.225 - HEAD.x) ** 2 + (y - 0.515 - HEAD.y) ** 2 + (az - 0.2) ** 2;
    c.lerp(blush, Math.exp(-bd / 0.0028) * 0.5);
    // freckles on the back & crown
    for (const [fx, fy, fz] of FRECKLES) {
      const fd = (x - fx) ** 2 + (y - fy) ** 2 + (z - fz) ** 2;
      c.lerp(deep, Math.exp(-fd / 0.0007) * 0.85);
    }
    // darker back, lighter top (form) and baked occlusion
    const k = ao[i] * (0.78 + 0.26 * smooth(0.05, 0.85, y)) * (0.92 + 0.08 * smooth(-0.3, 0.2, x));
    out.copy(c).multiplyScalar(k);
  });
}

function paintPart(geo, ao, skinHex, { toeLight = false } = {}) {
  const base = new THREE.Color(skinHex);
  const light = base.clone().lerp(new THREE.Color('#f3f7cf'), 0.35);
  paintVertices(geo, (x, y, z, i, out) => {
    out.copy(base);
    if (toeLight) out.lerp(light, smooth(0.16, 0.24, x) * 0.6);
    out.multiplyScalar(ao[i] * (0.85 + 0.2 * smooth(-0.15, 0.05, y)));
  });
}

class ScarfTail {
  // A verlet chain rendered as a thick, flat knitted strip (a flattened tube) with tassels
  constructor(mat, segments, segLen, width, thickness = 0.04) {
    this.n = segments;
    this.len = segLen;
    this.w = width;
    this.th = thickness;
    this.ring = 8;
    this.p = [];
    this.pp = [];
    for (let i = 0; i <= segments; i++) {
      this.p.push(new THREE.Vector3(-0.3, 0.49 - i * segLen, 0));
      this.pp.push(new THREE.Vector3(-0.3, 0.49 - i * segLen, 0));
    }
    const R = this.ring;
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array((segments + 1) * R * 3);
    const uvs = new Float32Array((segments + 1) * R * 2);
    const idx = [];
    for (let i = 0; i <= segments; i++) {
      for (let k = 0; k < R; k++) {
        uvs.set([k / R, (i / segments) * 1.6], (i * R + k) * 2);
        if (i < segments) {
          const a0 = i * R + k;
          const a1 = i * R + ((k + 1) % R);
          const b0 = a0 + R;
          const b1 = a1 + R;
          idx.push(a0, b0, a1, a1, b0, b1);
        }
      }
    }
    // end cap
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    // Tassels (fringe) at the end
    this.tassels = new THREE.Group();
    const tGeo = new THREE.CylinderGeometry(0.009, 0.007, 0.07, 5);
    tGeo.translate(0, -0.035, 0);
    const tMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.9 });
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(tGeo, tMat);
      m.position.z = (k - 1.5) * (width / 4.2);
      this.tassels.add(m);
    }
    this._tmp = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._side = new THREE.Vector3();
    this._nrm = new THREE.Vector3();
  }

  step(dt, anchor, force, lift = 0) {
    this.lift = lift;
    const n = this.n;
    this.p[0].copy(anchor);
    this.pp[0].copy(anchor);
    const dt2 = dt * dt;
    for (let i = 1; i <= n; i++) {
      const p = this.p[i];
      const pp = this.pp[i];
      const vx = (p.x - pp.x) * 0.95;
      const vy = (p.y - pp.y) * 0.95;
      const vz = (p.z - pp.z) * 0.95;
      pp.copy(p);
      p.x += vx + force.x * dt2;
      p.y += vy + force.y * dt2;
      p.z += vz + force.z * dt2;
    }
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i <= n; i++) {
        const a = this.p[i - 1];
        const b = this.p[i];
        const d = this._tmp.subVectors(b, a);
        const len = d.length() || 1e-5;
        const diff = (len - this.len) / len;
        if (i === 1) b.addScaledVector(d, -diff);
        else {
          a.addScaledVector(d, diff * 0.5);
          b.addScaledVector(d, -diff * 0.5);
        }
      }
      this.p[0].copy(anchor);
      for (let i = 1; i <= n; i++) {
        const p = this.p[i];
        // push out of the sculpted body along its gradient
        const by = p.y - this.lift; // sculpt is in body space, which rides above the legs
        const d = pogoSDF(p.x, by, p.z);
        if (d < 0.028) {
          const e = 0.004;
          let gx = pogoSDF(p.x + e, by, p.z) - pogoSDF(p.x - e, by, p.z);
          let gy = pogoSDF(p.x, by + e, p.z) - pogoSDF(p.x, by - e, p.z);
          let gz = pogoSDF(p.x, by, p.z + e) - pogoSDF(p.x, by, p.z - e);
          const l = Math.hypot(gx, gy, gz) || 1;
          p.x += (gx / l) * (0.028 - d);
          p.y += (gy / l) * (0.028 - d);
          p.z += (gz / l) * (0.028 - d);
        }
        if (p.y < 0.03) p.y = 0.03;
      }
    }
    const pos = this.mesh.geometry.attributes.position.array;
    const R = this.ring;
    for (let i = 0; i <= n; i++) {
      const p = this.p[i];
      const nxt = this.p[Math.min(n, i + 1)];
      const prv = this.p[Math.max(0, i - 1)];
      this._t.subVectors(nxt, prv).normalize();
      // the strip lies flat against the back: its wide side is along Z
      this._side.set(0, 0, 1).addScaledVector(this._t, -this._t.z).normalize();
      this._nrm.crossVectors(this._t, this._side).normalize();
      const w = this.w * (1 - (i / n) * 0.15) * 0.5;
      const th = this.th * 0.5;
      for (let k = 0; k < R; k++) {
        const a = (k / R) * Math.PI * 2;
        // rounded-rectangle cross-section
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const sx = Math.sign(cs) * Math.pow(Math.abs(cs), 0.45) * w;
        const sy = Math.sign(sn) * Math.pow(Math.abs(sn), 0.45) * th;
        const o = (i * R + k) * 3;
        pos[o] = p.x + this._side.x * sx + this._nrm.x * sy;
        pos[o + 1] = p.y + this._side.y * sx + this._nrm.y * sy;
        pos[o + 2] = p.z + this._side.z * sx + this._nrm.z * sy;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    const end = this.p[n];
    this.tassels.position.copy(end);
    const dir = this._tmp.subVectors(this.p[n], this.p[n - 1]).normalize();
    this.tassels.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }
}

export class PogoRig {
  constructor({ ghost = false } = {}) {
    this.ghost = ghost;
    this.root = new THREE.Group(); // positioned/rotated by the renderer
    this.yawRoot = new THREE.Group(); // smoothed facing
    this.root.add(this.yawRoot);
    this.body = new THREE.Group(); // squash & stretch, waddle, bob (legs stay planted)
    this.yawRoot.add(this.body);
    this._build();
    this.state = {
      yaw: -0.85,
      walkPhase: 0,
      blinkT: 2,
      blink: 0,
      lookX: 0,
      lookY: 0,
      prevVx: 0,
      prevVy: 0,
      emotion: 'happy',
      mouth: 'smile',
      lean: 0,
      armL: 0,
      armR: 0,
      throwT: 0,
      prevMuzzle: 0,
      idleSeed: Math.random() * 10,
      landT: 0,
      wasGround: true,
    };
  }

  get group() {
    return this.root;
  }

  _build() {
    const ud = (this.root.userData = {});
    const ghost = this.ghost;
    const phys = (opts) => (ghost ? new THREE.MeshBasicMaterial({ color: opts.color }) : new THREE.MeshPhysicalMaterial(opts));
    const bodyMat = phys({
      color: '#45c46c',
      emissive: '#14532d',
      emissiveIntensity: 0.05,
      roughness: 0.48,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      sheen: 0.25,
      sheenColor: new THREE.Color('#d9f99d'),
      sheenRoughness: 0.5,
    });
    const bellyMat = phys({ color: '#f7fee7', roughness: 0.45, clearcoat: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') });
    const spotMat = phys({ color: '#22964f', roughness: 0.5, clearcoat: 0.4 });
    const lidMat = bodyMat.clone();
    const limbMat = bodyMat.clone(); // domes, arms, legs: same skin without height-based shading
    const bootMat = phys({ color: '#34b360', roughness: 0.45, clearcoat: 0.4 }); // frog feet (skins recolour)
    const tipMat = new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#fde68a', emissiveIntensity: 0.3 });
    const darkMat = new THREE.MeshBasicMaterial({ color: '#0b1020' });
    const whiteMat = phys({ color: '#ffffff', roughness: 0.05, clearcoat: 1 });
    const irisMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#b45309', emissiveIntensity: 0.35, roughness: 0.12 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#05070d' });
    const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const blushMat = new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0.35, depthWrite: false });
    const tongueMat = new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.35 });
    const scarfMat = new THREE.MeshStandardMaterial({ map: chunkyKnitTexture('u'), roughness: 0.92, side: THREE.DoubleSide });
    const snowMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#7dd3fc', emissiveIntensity: 0.2, roughness: 0.7 });
    if (!ghost) {
      addRimLight(bodyMat, '#fef9c3', 0.3);
      addRimLight(lidMat, '#fef9c3', 0.3, { form: false });
      addRimLight(bellyMat, '#ffffff', 0.15, { form: false });
      addRimLight(limbMat, '#fef9c3', 0.3, { form: false });
    }
    ud.mats = { bodyMat, bootMat, lidMat, tipMat, bellyMat, spotMat, limbMat };

    const B = this.body;

    // Sculpted head + body (one surface, vertex-painted, occlusion baked in)
    const sc = sculptCache();
    const bodyGeo = sc.body.geo.clone();
    paintBody(bodyGeo, sc.body.ao, '#45c46c');
    const skinMat = ghost
      ? new THREE.MeshBasicMaterial({ color: '#45c46c' })
      : new THREE.MeshPhysicalMaterial({
          vertexColors: true,
          color: '#ffffff',
          roughness: 0.5,
          clearcoat: 0.3,
          clearcoatRoughness: 0.35,
          sheen: 0.2,
          sheenColor: new THREE.Color('#ecfccb'),
          sheenRoughness: 0.5,
        });
    if (!ghost) addRimLight(skinMat, '#fef9c3', 0.28, { form: false });
    const torso = new THREE.Mesh(bodyGeo, skinMat);
    B.add(torso);
    if (!ghost) addOutline(torso);
    // Limb pieces share the skin look through their own vertex-painted geometries
    const limbSkin = ghost ? skinMat : skinMat.clone();
    if (!ghost) addRimLight(limbSkin, '#fef9c3', 0.28, { form: false });
    const footGeo = sc.foot.geo.clone();
    paintPart(footGeo, sc.foot.ao, '#3cb865', { toeLight: true });
    const armGeoL = sc.armL.geo.clone();
    const armGeoR = sc.armR.geo.clone();
    paintPart(armGeoL, sc.armL.ao, '#45c46c');
    paintPart(armGeoR, sc.armR.ao, '#45c46c');
    ud.recolor = (skinHex, footHex) => {
      paintBody(bodyGeo, sc.body.ao, skinHex);
      paintPart(armGeoL, sc.armL.ao, skinHex);
      paintPart(armGeoR, sc.armR.ao, skinHex);
      paintPart(footGeo, sc.foot.ao, footHex || skinHex, { toeLight: true });
    };

    // Frog eye-domes on top of the head, with big glossy eyes set into the front
    const face = new THREE.Group();
    B.add(face);
    ud.face = face;
    const eyes = [];
    const eyeTex = { normal: eyeTexture('normal'), heart: eyeTexture('heart'), spiral: eyeTexture('spiral'), star: eyeTexture('star') };
    ud.eyeTex = eyeTex;
    const lashMat = new THREE.MeshBasicMaterial({ color: '#0b1020' });
    for (const side of [-1, 1]) {
      const dome = new THREE.Object3D(); // domes are part of the sculpt
      const eg = new THREE.Group();
      eg.position.set(EYEBALL.x, EYEBALL.y, side * EYEBALL.z);
      const eyeMat = ghost ? whiteMat : new THREE.MeshPhysicalMaterial({ map: eyeTex.normal, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(EYEBALL.r, 40, 28), eyeMat);
      if (!ghost) addOutline(ball);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), glintMat);
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glintMat);
      const lidGeo = new THREE.SphereGeometry(EYEBALL.r + 0.008, 32, 14, 0, TWO_PI, 0, Math.PI * 0.5);
      const upper = new THREE.Mesh(lidGeo, lidMat);
      const upperPivot = new THREE.Group();
      upperPivot.add(upper);
      // lid line + lashes ride on the upper lid
      const lidLine = new THREE.Mesh(new THREE.TorusGeometry(EYEBALL.r + 0.008, 0.009, 6, 32, Math.PI), lashMat);
      lidLine.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      upperPivot.add(lidLine);
      for (let k = 0; k < 3; k++) {
        const lash = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.035, 3, 5), lashMat);
        const a = 0.25 + k * 0.32;
        lash.position.set(Math.cos(a) * 0.05, 0.02, side * (0.11 + k * 0.012));
        lash.rotation.x = side * (0.6 + k * 0.25);
        upperPivot.add(lash);
      }
      const lower = new THREE.Mesh(lidGeo, lidMat);
      lower.rotation.x = Math.PI;
      const lowerPivot = new THREE.Group();
      lowerPivot.add(lower);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), darkMat);
      brow.rotation.x = Math.PI / 2;
      const browPivot = new THREE.Group();
      browPivot.position.set(0.04, 0.135, 0);
      browPivot.add(brow);
      eg.add(ball, glint, glint2, upperPivot, lowerPivot, browPivot);
      face.add(eg);
      eyes.push({ eg, ball, eyeMat, glint, glint2, upperPivot, lowerPivot, browPivot, side, dome, iris: ball, pupil: ball });
    }
    ud.eyes = eyes;
    ud.eyeL = eyes[0].eg;
    ud.eyeR = eyes[1].eg;
    ud.eyeL.userData.lid = eyes[0].upperPivot;
    ud.eyeR.userData.lid = eyes[1].upperPivot;
    ud.eyeGroup = face;

    // Cheeks
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), blushMat);
      const dir = [Math.cos(0.85), -0.05, side * Math.sin(0.85)];
      const p = traceSurface(pogoSDF, [HEAD.x, 0.515 + HEAD.y, 0], dir, 0.6);
      b.position.set(p[0] + dir[0] * 0.004, p[1], p[2] + dir[2] * 0.004);
      b.lookAt(p[0] + dir[0], p[1] + dir[1], p[2] + dir[2]);
      face.add(b);
    }
    ud.blushMat = blushMat;

    // Mouth shapes (wide frog mouth), placed on the front surface
    const mouth = new THREE.Group();
    const my = 0.575 + HEAD.y;
    const mouthP = traceSurface(pogoSDF, [HEAD.x, my, 0], [1, 0, 0], 0.6);
    mouth.position.set(mouthP[0] + 0.006, my, 0);
    face.add(mouth);
    const mouths = {};
    const arcGeo = (r, arc) => new THREE.TorusGeometry(r, 0.018, 8, 28, arc);
    const smile = new THREE.Mesh(arcGeo(0.12, Math.PI * 0.62), darkMat);
    smile.rotation.set(0, Math.PI / 2, Math.PI + Math.PI * 0.19);
    smile.position.y = 0.065;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.026), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    tooth.position.set(0.004, -0.06, 0.035);
    const smileG = new THREE.Group();
    smileG.add(smile, tooth);
    mouths.smile = smileG;
    const grin = new THREE.Group();
    const grinShape = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24, Math.PI, Math.PI), darkMat);
    grinShape.rotation.y = Math.PI / 2;
    grinShape.scale.set(1.15, 0.85, 1);
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16, Math.PI, Math.PI), tongueMat);
    tongue.rotation.y = Math.PI / 2;
    tongue.position.set(0.003, -0.035, 0);
    grin.add(grinShape, tongue);
    mouths.grin = grin;
    const oh = new THREE.Group();
    const ohHole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), darkMat);
    ohHole.rotation.y = Math.PI / 2;
    const ohTongue = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), tongueMat);
    ohTongue.rotation.y = Math.PI / 2;
    ohTongue.position.set(0.002, -0.022, 0);
    oh.add(ohHole, ohTongue);
    mouths.oh = oh;
    const frown = new THREE.Mesh(arcGeo(0.08, Math.PI * 0.6), darkMat);
    frown.rotation.set(0, Math.PI / 2, Math.PI * 0.2);
    frown.position.y = -0.04;
    mouths.frown = frown;
    const teeth = new THREE.Group();
    const tBack = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), darkMat);
    tBack.rotation.y = Math.PI / 2;
    const tFront = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.03), new THREE.MeshBasicMaterial({ color: '#f8fafc' }));
    tFront.rotation.y = Math.PI / 2;
    tFront.position.x = 0.002;
    teeth.add(tBack, tFront);
    mouths.teeth = teeth;
    const blep = new THREE.Group();
    const blepLine = new THREE.Mesh(arcGeo(0.1, Math.PI * 0.55), darkMat);
    blepLine.rotation.set(0, Math.PI / 2, Math.PI + Math.PI * 0.22);
    blepLine.position.y = 0.06;
    const blepTongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.025, 4, 8), tongueMat);
    blepTongue.position.set(0.01, -0.035, 0.03);
    blep.add(blepLine, blepTongue);
    mouths.blep = blep;
    for (const m of Object.values(mouths)) {
      m.visible = false;
      mouth.add(m);
    }
    mouths.smile.visible = true;
    ud.mouths = mouths;

    // Scarf: a thin knitted band wrapped snugly round the neck, following the sculpted body
    // (it lies on the skin with a slight fabric puff, small wrinkles and rolled edges),
    // knotted at the back with two draping tails.
    const scarfGeo = (() => {
      const U = 120;
      const V = 9;
      const half = 0.058; // half band width
      const verts = [];
      const uvs = [];
      const idx = [];
      const edgeTop = [];
      const edgeBot = [];
      const e = 0.004;
      const grad = (x, y, z) => {
        const gx = pogoSDF(x + e, y, z) - pogoSDF(x - e, y, z);
        const gy = pogoSDF(x, y + e, z) - pogoSDF(x, y - e, z);
        const gz = pogoSDF(x, y, z + e) - pogoSDF(x, y, z - e);
        const l = Math.hypot(gx, gy, gz) || 1;
        return [gx / l, gy / l, gz / l];
      };
      for (let i = 0; i <= U; i++) {
        const a = (i / U) * Math.PI * 2;
        // sloped like a scarf on a forward-leaning neck: low under the chin, higher at the back
        const yc = SCARF_Y - Math.cos(a) * SCARF_TILT + Math.sin(a) * 0.012;
        for (let j = 0; j <= V; j++) {
          const v = j / V - 0.5;
          const y = yc + v * 2 * half;
          const sp = traceSurface(pogoSDF, [0, y, 0], [Math.cos(a), 0, Math.sin(a)], 0.6);
          const n = grad(sp[0], sp[1], sp[2]);
          const puff = 0.014 + 0.012 * Math.cos(v * Math.PI) + 0.003 * Math.sin(a * 11 + v * 4);
          const p = [sp[0] + n[0] * puff, sp[1] + n[1] * puff, sp[2] + n[2] * puff];
          verts.push(...p);
          uvs.push((i / U) * 7, j / V);
          if (j === 0) edgeBot.push(new THREE.Vector3(...p));
          if (j === V) edgeTop.push(new THREE.Vector3(...p));
          if (i < U && j < V) {
            const a0 = i * (V + 1) + j;
            const b0 = a0 + V + 1;
            idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
          }
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return { g, edgeTop, edgeBot };
    })();
    const ring = new THREE.Mesh(scarfGeo.g, scarfMat);
    ring.castShadow = !ghost;
    B.add(ring);
    // rolled knit edges give the band a defined border
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.9 });
    for (const pts of [scarfGeo.edgeTop, scarfGeo.edgeBot]) {
      const curve = new THREE.CatmullRomCurve3(pts.slice(0, -1), true);
      const edge = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.009, 6, true), edgeMat);
      B.add(edge);
    }
    // flat knot at the back
    const knotY = SCARF_Y + SCARF_TILT - 0.005;
    const knotP = traceSurface(pogoSDF, [0, knotY, 0.06], [-1, 0, 0], 0.6);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), scarfMat);
    knot.scale.set(0.45, 0.85, 1.1);
    knot.position.set(knotP[0] - 0.03, knotY, 0.06);
    B.add(knot);
    this._knotX = knotP[0] - 0.035;
    this._knotY = knotY;
    const tailMat = scarfMat.clone();
    tailMat.map = chunkyKnitTexture('v');
    tailMat.map.repeat.set(1, 1.5);
    // long tails that hang down his back almost to the ground
    ud.scarfTails = [new ScarfTail(tailMat, 9, 0.07, 0.13, 0.024), new ScarfTail(tailMat, 8, 0.07, 0.12, 0.024)];
    for (const tail of ud.scarfTails) {
      tail.mesh.castShadow = !ghost;
      this.yawRoot.add(tail.mesh, tail.tassels);
    }
    ud.scarfAnchor = knot;

    // Mitten arms
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.03, 0.385, side * 0.385);
      const arm = new THREE.Mesh(side < 0 ? armGeoL : armGeoR, limbSkin);
      const hand = arm;
      shoulder.add(arm);
      if (!ghost) addOutline(arm);
      B.add(shoulder);
      arms.push({ shoulder, hand, side });
    }
    ud.arms = arms;

    // Snowball held in the throwing hand / packed between both hands while charging
    const handBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 2), snowMat);
    handBall.position.y = -0.2;
    handBall.visible = false;
    arms[1].shoulder.add(handBall);
    ud.handBall = handBall;
    const chargeBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 3), snowMat.clone());
    chargeBall.position.set(0.38, 0.3, 0);
    chargeBall.visible = false;
    B.add(chargeBall);
    ud.chargeBall = chargeBall;

    // Big flat frog feet
    const legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(HIP.x, HIP.y, side * HIP.z);
      const foot = new THREE.Mesh(footGeo, limbSkin);
      hip.add(foot);
      if (!ghost) addOutline(foot);
      // pink toe-bean pads on the sole (flash when the foot lifts)
      for (const tz of [-0.082, 0, 0.082]) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 6), new THREE.MeshStandardMaterial({ color: '#fda4af', roughness: 0.5 }));
        pad.position.set(0.22, -0.202, tz);
        pad.scale.y = 0.35;
        hip.add(pad);
      }
      this.yawRoot.add(hip);
      legs.push({ hip, side });
    }
    ud.legs = legs;
    ud.footL = legs[0].hip;
    ud.footR = legs[1].hip;

    // Snow-pack backpack with a snowflake emblem
    const pack = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.08, 6, 14), phys({ color: '#38bdf8', roughness: 0.5, clearcoat: 0.5 }));
    pack.rotation.z = Math.PI / 2;
    pack.scale.set(1, 0.75, 1.2);
    pack.position.set(-0.31, 0.33, 0);
    const flake = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.11, 0.02), glintMat);
      bar.rotation.x = (k * Math.PI) / 3;
      flake.add(bar);
    }
    flake.position.set(-0.42, 0.33, 0);
    flake.rotation.y = Math.PI / 2;
    B.add(pack, flake);

    // Throw flash light (keeps the old "muzzle" handles for compatibility)
    const muzzleLight = new THREE.PointLight('#a5f3fc', 0, 3.5);
    muzzleLight.position.set(0.4, 0.5, 0.2);
    B.add(muzzleLight);
    ud.muzzle = new THREE.Object3D();
    ud.muzzleLight = muzzleLight;
    ud.cryoChamber = { material: new THREE.MeshStandardMaterial() };
    ud.barrel = new THREE.Object3D();
    ud.blaster = new THREE.Object3D();

    // Lantern (dark tower) in the left hand
    const lantern = new THREE.Group();
    const cageMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 });
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#f59e0b', emissiveIntensity: 2.2, transparent: true, opacity: 0.85 })
    );
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.04, 10), cageMat);
    cap.position.y = 0.07;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 4, 12, Math.PI), cageMat);
    handle.position.y = 0.09;
    lantern.add(glass, cap, handle);
    lantern.visible = false;
    lantern.position.y = -0.3;
    arms[0].shoulder.add(lantern);
    ud.lantern = lantern;
    ud.lanternFlame = glass;

    // Hat mount between the eye domes
    const hat = new THREE.Group();
    hat.position.set(-0.02, 0.86, 0);
    B.add(hat);
    ud.hat = hat;

    // Dizzy stars
    const stars = new THREE.Group();
    stars.position.set(0, 1.02, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
    for (let i = 0; i < 3; i++) stars.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.045), starMat));
    stars.visible = false;
    B.add(stars);
    ud.stars = stars;

    // Sweat drop
    const sweat = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#7dd3fc', emissive: '#0ea5e9', emissiveIntensity: 0.4, roughness: 0.05, transparent: true, opacity: 0.9 })
    );
    sweat.scale.set(1, 1.5, 1);
    sweat.visible = false;
    B.add(sweat);
    ud.sweat = sweat;

    // Sleep: Zzz + snot bubble
    const zTex = zTexture();
    const zs = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
      sp.visible = false;
      this.root.add(sp);
      zs.push(sp);
    }
    ud.zs = zs;
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 12),
      new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transparent: true, opacity: 0.45, roughness: 0.02, clearcoat: 1, depthWrite: false })
    );
    bubble.visible = false;
    B.add(bubble);
    ud.bubble = bubble;

    // Ice block (hit by his own snowball)
    const ice = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.05, 0.78),
      new THREE.MeshPhysicalMaterial({ color: '#bae6fd', emissive: '#38bdf8', emissiveIntensity: 0.2, transparent: true, opacity: 0.5, roughness: 0.05, depthWrite: false })
    );
    ice.position.y = 0.48;
    ice.visible = false;
    this.root.add(ice);
    ud.ice = ice;
    ud.body = this.body;

    if (!ghost) {
      this.root.traverse((o) => {
        if (o.isMesh && !o.material.transparent && !o.userData.outline) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    }
    this._anchor = new THREE.Vector3();
    this._force = new THREE.Vector3();
  }

  // s: per-frame state (see renderer)
  update(dt, s) {
    const ud = this.root.userData;
    const st = this.state;
    const t = s.time;
    dt = Math.min(0.05, Math.max(0.0001, dt));

    // ---- Emotion (priority order) ----
    let emo = 'happy';
    if (s.frozen) emo = 'frozen';
    else if (s.stun) emo = 'dizzy';
    else if (s.hurt) emo = 'hurt';
    else if (s.celebrate) emo = 'celebrate';
    else if (s.emote) emo = s.emote;
    else if (s.pound) emo = 'determined';
    else if (s.hang) emo = 'strain';
    else if (s.teeter) emo = 'panic';
    else if (!s.onGround && s.vy < -5) emo = 'falling';
    else if (!s.onGround) emo = 'jump';
    else if (s.charge > 0.05) emo = 'charging';
    else if (s.danger > 0.55) emo = 'worried';
    else if (s.lowTime) emo = 'nervous';
    else if (s.idle > 10) emo = 'sleep';
    else if (s.idle > 2.2) emo = 'idle';
    else if (Math.abs(s.vx) > 0.3) emo = 'walk';
    st.emotion = emo;

    // Landing squish
    if (s.onGround && !st.wasGround) st.landT = 0.25;
    st.wasGround = s.onGround;
    st.landT = Math.max(0, st.landT - dt);

    // Throw trigger (rising edge of the game's muzzle flash)
    if (s.muzzle > st.prevMuzzle + 0.05) st.throwT = 0.28;
    st.prevMuzzle = s.muzzle;
    st.throwT = Math.max(0, st.throwT - dt);

    // ---- Facing: quick turn ----
    const lookCam = emo === 'idle' || emo === 'celebrate' || emo === 'sleep' || emo === 'thumbs' || emo === 'joy';
    const targetYaw = s.facing < 0 ? Math.PI + 0.85 : -0.85;
    const yawGoal = lookCam ? (s.facing < 0 ? Math.PI + 1.35 : -1.35) : targetYaw;
    let dy = yawGoal - st.yaw;
    while (dy > Math.PI) dy -= TWO_PI;
    while (dy < -Math.PI) dy += TWO_PI;
    st.yaw += dy * (1 - Math.exp(-16 * dt));
    this.yawRoot.rotation.y = st.yaw + (emo === 'celebrate' ? Math.sin(t * 3) * 0.6 : 0);

    // ---- Waddle walk (stride driven by distance travelled) ----
    const speed = Math.abs(s.vx);
    const moving = s.onGround && speed > 0.2;
    st.walkPhase += speed * dt * 4.8;
    const ph = st.walkPhase * Math.PI;
    const stepAmt = moving ? Math.min(1, speed / 2.3) : 0;
    for (const leg of ud.legs) {
      const sgn = leg.side < 0 ? 1 : -1;
      // a big, readable step like the original sprite's walk: foot swings forward and lifts clear
      const swing = Math.sin(ph) * sgn * 0.17 * stepAmt;
      const lift = Math.max(0, Math.sin(ph) * sgn) * 0.11 * stepAmt;
      leg.hip.position.set(swing + HIP.x, HIP.y + lift, leg.side * HIP.z);
      leg.hip.rotation.z = -swing * 1.6;
    }
    if (!s.onGround) {
      ud.legs[0].hip.position.set(HIP.x + 0.08, HIP.y + 0.03 + (s.vy > 0 ? 0.04 : 0), -HIP.z - 0.01);
      ud.legs[1].hip.position.set(HIP.x - 0.02, HIP.y + 0.02, HIP.z + 0.01);
      ud.legs[0].hip.rotation.z = -0.5;
      ud.legs[1].hip.rotation.z = 0.3;
    }
    if (emo === 'celebrate') {
      const k = Math.sin(t * 14);
      ud.legs[0].hip.position.y = HIP.y - 0.01 + Math.max(0, k) * 0.08;
      ud.legs[1].hip.position.y = HIP.y - 0.01 + Math.max(0, -k) * 0.08;
    }
    const breathe = Math.sin(t * 2.2 + st.idleSeed) * 0.012;
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.055 * stepAmt : breathe;
    const waddle = moving ? Math.sin(ph) * 0.13 * stepAmt : 0;
    const accel = (s.vx - st.prevVx) / dt;
    st.prevVx = s.vx;
    const leanGoal = moving ? Math.min(0.16, speed * 0.045) : 0;
    st.lean = damp(st.lean, leanGoal + Math.max(-0.12, Math.min(0.12, accel * 0.01 * Math.sign(s.facing || 1))), 10, dt);

    // ---- Squash & stretch ----
    let sx = s.squashX;
    let sy = s.squashY;
    if (st.landT > 0) {
      const k = Math.sin((st.landT / 0.25) * Math.PI);
      sx *= 1 + k * 0.12;
      sy *= 1 - k * 0.12;
    }
    if (emo === 'sleep') {
      sy *= 0.9 + Math.sin(t * 1.6) * 0.03;
      sx *= 1.06;
    } else if (emo === 'charging') {
      sy *= 0.95 - s.charge * 0.05;
      sx *= 1.03 + s.charge * 0.04;
    } else if (!s.onGround && s.vy > 2) {
      sy *= 1.08;
      sx *= 0.94;
    }
    this.body.scale.set(sx, sy, sx);
    this.body.position.y = BODY_LIFT + bob - (emo === 'sleep' ? 0.07 : 0);
    // Summit dance: the whole Pogo hops (feet included)
    this.yawRoot.position.y = emo === 'celebrate' ? Math.abs(Math.sin(t * 7)) * 0.3 : damp(this.yawRoot.position.y, 0, 20, dt);
    this.body.rotation.set(waddle, 0, -st.lean);
    if (emo === 'panic') this.body.rotation.z = -Math.sin(t * 24) * 0.2;
    if (emo === 'dizzy') {
      this.body.rotation.z = Math.sin(t * 9) * 0.18;
      this.body.rotation.x = Math.cos(t * 9) * 0.12;
    }
    if (emo === 'strain') this.body.rotation.z = 0.25;
    if (emo === 'sleep') this.body.rotation.z = 0.12;
    if (emo === 'idle') this.body.rotation.x = Math.sin(t * 1.1) * 0.05;

    // ---- Arms ----
    // rest: arms hang relaxed against his round sides (a slight outward set so the mittens sit ON
    // the body's curve instead of sinking into it), a touch forward
    let aL = 0.16;
    let aR = 0.16;
    let aLx = -0.04;
    let aRx = -0.04;
    if (moving) {
      aL = 0.1 + Math.sin(ph) * 0.6 * stepAmt;
      aR = 0.1 - Math.sin(ph) * 0.6 * stepAmt;
    }
    const idleCycle = (t + st.idleSeed) % 6;
    switch (emo) {
      case 'jump':
        aL = -2.6;
        aR = -2.6;
        aLx = 0.4;
        aRx = 0.4;
        break;
      case 'falling':
        aL = -2.4 + Math.sin(t * 22) * 0.4;
        aR = -2.4 - Math.sin(t * 22) * 0.4;
        aLx = 1.0;
        aRx = 1.0;
        break;
      case 'celebrate':
        aL = -2.9 + Math.sin(t * 14) * 0.3;
        aR = -2.9 + Math.cos(t * 14) * 0.3;
        aLx = 0.25;
        aRx = 0.25;
        break;
      case 'idle':
        if (idleCycle < 1.6) {
          aL = -2.7 + Math.sin(t * 16) * 0.35; // wave at the camera
          aLx = 0.5;
        }
        break;
      case 'strain':
        aL = -2.9;
        aR = -2.9;
        break;
      case 'thumbs':
        aR = -2.2;
        aRx = 0.3;
        break;
      case 'joy':
        aL = -2.7 + Math.sin(t * 12) * 0.25;
        aR = -2.7 + Math.cos(t * 12) * 0.25;
        aLx = 0.35;
        aRx = 0.35;
        break;
      case 'smug':
        aL = 0.4;
        aR = 0.4;
        aLx = -0.25;
        aRx = -0.25;
        break;
      case 'hurt':
      case 'dizzy':
        aL = -0.9;
        aR = -0.9;
        aLx = 1.2;
        aRx = 1.2;
        break;
      case 'charging':
        aL = -1.35 + Math.sin(t * 18) * 0.06;
        aR = -1.35 - Math.sin(t * 18) * 0.06;
        aLx = -0.35;
        aRx = -0.35;
        break;
      case 'sleep':
        aL = 0.25;
        aR = 0.25;
        aLx = 0.05;
        aRx = 0.05;
        break;
      case 'nervous':
      case 'worried':
        aL = -0.5 + Math.sin(t * 9) * 0.1;
        aR = -0.5 - Math.sin(t * 9) * 0.1;
        aLx = -0.1;
        aRx = -0.1;
        break;
    }
    // Overhand throw (right arm): wind back then whip forward
    if (st.throwT > 0 && emo !== 'charging') {
      const k = 1 - st.throwT / 0.28;
      aR = k < 0.35 ? -2.8 * (k / 0.35) : -2.8 + ((k - 0.35) / 0.65) * 4.2;
      aRx = 0.1;
    }
    st.armL = damp(st.armL, aL, 16, dt);
    st.armR = st.throwT > 0 ? aR : damp(st.armR, aR, 16, dt);
    const left = ud.arms[0];
    const right = ud.arms[1];
    if (emo === 'panic') {
      left.shoulder.rotation.set(-1.25, 0, t * 22);
      right.shoulder.rotation.set(1.25, 0, -t * 22);
    } else {
      left.shoulder.rotation.set(-aLx, 0, st.armL);
      right.shoulder.rotation.set(aRx, 0, st.armR);
    }
    ud.handBall.visible = st.throwT > 0.17;
    const ch = emo === 'charging' ? s.charge : 0;
    ud.chargeBall.visible = ch > 0.02;
    if (ch > 0.02) {
      ud.chargeBall.scale.setScalar(0.5 + ch * 1.2);
      ud.chargeBall.rotation.set(t * 3, t * 2, 0);
      ud.chargeBall.material.emissiveIntensity = 0.2 + ch * 1.2 + (ch >= 1 ? Math.sin(t * 30) * 0.5 : 0);
    }
    ud.muzzleLight.intensity = Math.min(1, (s.muzzle || 0) / 0.14) * 2 + ch * 1.4;

    // ---- Eyes ----
    let lx = 0;
    let ly = 0;
    if (s.dangerDir != null && (emo === 'worried' || emo === 'walk' || emo === 'happy')) {
      lx = Math.max(-1, Math.min(1, s.dangerDir));
      ly = s.dangerUp || 0;
    } else if (emo === 'jump') ly = 0.6;
    else if (emo === 'falling') ly = -0.8;
    else if (emo === 'idle' && idleCycle > 1.6 && idleCycle < 4) lx = Math.sin(t * 0.9) * 0.9;
    else if (emo === 'charging') ly = -0.3;
    st.lookX = damp(st.lookX, lx, 12, dt);
    st.lookY = damp(st.lookY, ly, 12, dt);

    st.blinkT -= dt;
    if (st.blinkT <= 0) {
      st.blink = 0.14;
      st.blinkT = 1.8 + Math.random() * 3.5;
    }
    st.blink = Math.max(0, st.blink - dt);
    const blinkK = st.blink > 0 ? Math.sin((st.blink / 0.14) * Math.PI) : 0;

    let lidClose = 0.1;
    let lowerUp = 0.08;
    let browRot = 0;
    let browY = 0;
    let eyeScale = 1;
    let pupilScale = 1;
    switch (emo) {
      case 'happy':
      case 'walk':
        lowerUp = 0.18;
        break;
      case 'joy':
      case 'celebrate':
      case 'thumbs':
        lowerUp = 0.62;
        lidClose = 0.3;
        browY = 0.02;
        pupilScale = 1.15;
        break;
      case 'jump':
        lidClose = 0;
        eyeScale = 1.08;
        browY = 0.025;
        break;
      case 'falling':
      case 'panic':
        lidClose = 0;
        eyeScale = 1.15;
        pupilScale = 0.65;
        browRot = -0.5;
        browY = 0.03;
        break;
      case 'determined':
      case 'charging':
        lidClose = 0.38;
        browRot = 0.55;
        browY = -0.01;
        break;
      case 'strain':
        lidClose = 0.55;
        browRot = 0.4;
        break;
      case 'hurt':
        lidClose = 0.8;
        browRot = -0.4;
        break;
      case 'dizzy':
        lidClose = 0.3;
        pupilScale = 0.6;
        break;
      case 'worried':
      case 'nervous':
        lidClose = 0.15;
        browRot = -0.45;
        browY = 0.015;
        break;
      case 'idle':
        lowerUp = 0.22;
        lidClose = 0.12;
        pupilScale = 1.2;
        break;
      case 'sleep':
        lidClose = 1;
        break;
      case 'frozen':
        lidClose = 0;
        eyeScale = 1.12;
        pupilScale = 0.55;
        break;
      case 'smug':
        lidClose = 0.48;
        lowerUp = 0.3;
        browRot = 0.25;
        break;
    }
    lidClose = Math.max(lidClose, blinkK);
    // Eye texture swaps: hearts when celebrating/joy, spirals when dizzy, stars on a big find
    let eyeKind = 'normal';
    if (emo === 'celebrate' || emo === 'joy') eyeKind = 'heart';
    else if (emo === 'dizzy') eyeKind = 'spiral';
    else if (emo === 'thumbs') eyeKind = 'star';
    for (const e of ud.eyes) {
      const es = damp(e.eg.scale.x, eyeScale, 14, dt);
      e.eg.scale.setScalar(es);
      if (e.eyeMat.map && ud.eyeTex && e.eyeMat.map !== ud.eyeTex[eyeKind]) {
        e.eyeMat.map = ud.eyeTex[eyeKind];
        e.eyeMat.needsUpdate = true;
      }
      // Gaze: rotate the eyeball (yaw = left/right, roll = up/down), pupils dilate via scale
      const yaw = st.lookX * 0.45;
      const pitch = st.lookY * 0.38;
      if (emo === 'dizzy') e.ball.rotation.set(t * 6 * e.side, 0, 0);
      else e.ball.rotation.set(0, yaw, pitch);
      e.ball.scale.set(1, 1, 1);
      const dil = 0.94 + pupilScale * 0.06;
      e.ball.scale.set(1, dil, dil);
      // Catchlights stay put (they reflect the light, not the eye)
      e.glint.position.set(0.1, 0.045, -0.035 * e.side + 0.0);
      e.glint2.position.set(0.112, -0.02, 0.03 * e.side);
      const upGoal = 1.95 + (-0.5 - 1.95) * lidClose;
      const loGoal = -1.95 + (0.35 + 1.95) * lowerUp;
      e.upperPivot.rotation.z = damp(e.upperPivot.rotation.z, upGoal, 30, dt);
      e.lowerPivot.rotation.z = damp(e.lowerPivot.rotation.z, loGoal, 20, dt);
      e.browPivot.rotation.x = damp(e.browPivot.rotation.x, browRot * e.side, 14, dt);
      e.browPivot.position.y = damp(e.browPivot.position.y, 0.135 + browY, 14, dt);
      e.dome.scale.setScalar(damp(e.dome.scale.x, 1 + (eyeScale - 1) * 0.8, 14, dt));
    }

    // ---- Mouth ----
    let mouth = 'smile';
    if (emo === 'jump' || emo === 'panic' || emo === 'falling' || emo === 'frozen') mouth = 'oh';
    else if (emo === 'celebrate' || emo === 'joy' || emo === 'thumbs') mouth = 'grin';
    else if (emo === 'charging' || emo === 'determined' || emo === 'strain') mouth = 'teeth';
    else if (emo === 'hurt' || emo === 'dizzy' || emo === 'worried' || emo === 'nervous') mouth = 'frown';
    else if (emo === 'sleep') mouth = 'oh';
    else if (emo === 'idle' && idleCycle > 4.2) mouth = 'blep';
    if (st.mouth !== mouth) {
      ud.mouths[st.mouth].visible = false;
      ud.mouths[mouth].visible = true;
      st.mouth = mouth;
    }
    if (mouth === 'oh') {
      const k = emo === 'sleep' ? 0.45 + Math.sin(t * 1.6) * 0.15 : emo === 'panic' ? 1.3 : 1;
      ud.mouths.oh.scale.set(1, k * 1.2, k);
    }
    if (mouth === 'grin') ud.mouths.grin.scale.setScalar(1 + Math.sin(t * 14) * 0.05);

    const blushGoal = emo === 'celebrate' || emo === 'joy' || emo === 'thumbs' || emo === 'idle' ? 0.8 : emo === 'strain' || emo === 'charging' ? 0.65 : 0.45;
    ud.blushMat.opacity = damp(ud.blushMat.opacity, blushGoal, 8, dt);

    // ---- Scarf physics (in yawRoot space) ----
    const knotX = this._knotX ?? -0.36;
    this._anchor.set(knotX, (this._knotY ?? 0.45) + this.body.position.y, 0.0);
    const fwd = Math.abs(s.vx);
    const wind = fwd * 6 + Math.abs(s.vy) * 1.5 + (s.wind || 0) * 8;
    this._force.set(-wind * 2.2 - 0.8, -11 - s.vy * 1.5, Math.sin(t * 9) * wind * 0.6);
    if (emo === 'panic') this._force.set(-12, 6, Math.sin(t * 20) * 14);
    if (emo === 'celebrate') this._force.set(-6, 4, Math.sin(t * 12) * 8);
    ud.scarfTails.forEach((tail, i) => {
      this._anchor.z = i === 0 ? 0.03 : -0.03;
      tail.step(dt, this._anchor, this._force, this.body.position.y);
    });

    // ---- Antics ----
    ud.stars.visible = emo === 'dizzy';
    if (ud.stars.visible) {
      ud.stars.children.forEach((c, i) => {
        const a = t * 6 + (i * TWO_PI) / 3;
        c.position.set(Math.cos(a) * 0.26, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.26);
        c.rotation.set(t * 5, t * 7, 0);
      });
    }
    const sweaty = emo === 'nervous' || emo === 'strain' || emo === 'worried' || emo === 'charging';
    ud.sweat.visible = sweaty;
    if (sweaty) {
      const k = (t * 0.9) % 1;
      ud.sweat.position.set(0.1, 0.82 - k * 0.25, 0.27);
      ud.sweat.material.opacity = 0.9 * (1 - k);
    }
    const sleeping = emo === 'sleep';
    ud.zs.forEach((z, i) => {
      z.visible = sleeping;
      if (sleeping) {
        const k = (t * 0.45 + i / 3) % 1;
        z.position.set(0.1 + k * 0.35, 1.0 + k * 0.7, 0.1);
        z.scale.setScalar(0.12 + k * 0.14);
        z.material.opacity = Math.sin(k * Math.PI);
      }
    });
    ud.bubble.visible = sleeping;
    if (sleeping) {
      const k = Math.sin(t * 1.6) * 0.5 + 0.5;
      ud.bubble.position.set(0.37 + k * 0.03, 0.62, 0.06);
      ud.bubble.scale.setScalar(0.4 + k * 1.1);
    }
    ud.lantern.visible = Boolean(s.dark);
    if (s.dark) {
      ud.lantern.rotation.z = Math.sin(t * 3) * 0.2;
      ud.lanternFlame.material.emissiveIntensity = 2 + Math.sin(t * 17) * 0.4;
    }
    ud.ice.visible = Boolean(s.frozen);
  }

  // World position of the lantern (for the point light)
  lanternWorld(out) {
    return this.root.userData.lantern.getWorldPosition(out);
  }
}
