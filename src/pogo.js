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

// Chunky ribbed-knit texture (vertical V-stitch ribs with cream stripes)
function chunkyKnitTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 128, 128);
  // stripes
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 40, 128, 16);
  ctx.fillRect(0, 96, 128, 8);
  // V stitches
  for (let x = 0; x < 128; x += 16) {
    for (let y = 0; y < 128; y += 10) {
      const lg = ctx.createLinearGradient(x, y, x + 16, y);
      lg.addColorStop(0, 'rgba(0,0,0,0.28)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      lg.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + 8, y + 9);
      ctx.lineTo(x + 15, y);
      ctx.stroke();
    }
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
    '#include <begin_vertex>\ntransformed += normalize(objectNormal) * 0.018;'
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

// Fresnel rim light so Pogo always separates from the background
function addRimLight(mat, color = '#d9f99d', strength = 0.55) {
  mat.userData.rim = { value: new THREE.Color(color) };
  mat.userData.rimStrength = { value: strength };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = mat.userData.rim;
    shader.uniforms.rimStrength = mat.userData.rimStrength;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;')
      .replace(
        '#include <opaque_fragment>',
        'float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);\noutgoingLight += rimColor * rimF * rimStrength;\n#include <opaque_fragment>'
      );
  };
  mat.customProgramCacheKey = () => 'pogo-rim';
}

const BODY_PROFILE = [
  [0.0, 0.07],
  [0.16, 0.09],
  [0.27, 0.17],
  [0.325, 0.29],
  [0.335, 0.42],
  [0.32, 0.54],
  [0.29, 0.65],
  [0.235, 0.74],
  [0.14, 0.81],
  [0.0, 0.835],
];

// Radius of the body at height y (for placing things on the surface)
function bodyRadiusAt(y) {
  for (let i = 0; i < BODY_PROFILE.length - 1; i++) {
    const [r0, y0] = BODY_PROFILE[i];
    const [r1, y1] = BODY_PROFILE[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0.2;
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

  step(dt, anchor, force) {
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
        const r = bodyRadiusAt(Math.max(0.1, Math.min(0.8, p.y))) + 0.05;
        const h = Math.hypot(p.x, p.z);
        if (p.y > 0.08 && p.y < 0.83 && h < r) {
          const k2 = r / (h || 1e-4);
          p.x *= k2;
          p.z *= k2;
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
      color: '#5ee08a',
      emissive: '#15803d',
      emissiveIntensity: 0.07,
      roughness: 0.38,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
      sheen: 0.8,
      sheenColor: new THREE.Color('#ecfccb'),
      sheenRoughness: 0.4,
    });
    const bellyMat = phys({ color: '#f7fee7', roughness: 0.45, clearcoat: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') });
    const spotMat = phys({ color: '#2fb86a', roughness: 0.45, clearcoat: 0.6 });
    const lidMat = bodyMat.clone();
    const bootMat = phys({ color: '#3fca76', roughness: 0.4, clearcoat: 0.6 }); // frog feet (skins recolour)
    const tipMat = new THREE.MeshStandardMaterial({ color: '#fde68a', emissive: '#fde68a', emissiveIntensity: 0.3 });
    const darkMat = new THREE.MeshBasicMaterial({ color: '#0b1020' });
    const whiteMat = phys({ color: '#ffffff', roughness: 0.05, clearcoat: 1 });
    const irisMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#b45309', emissiveIntensity: 0.35, roughness: 0.12 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#05070d' });
    const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const blushMat = new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0.35, depthWrite: false });
    const tongueMat = new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.35 });
    const scarfMat = new THREE.MeshStandardMaterial({ map: chunkyKnitTexture(), roughness: 0.92, side: THREE.DoubleSide });
    const snowMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#7dd3fc', emissiveIntensity: 0.2, roughness: 0.7 });
    if (!ghost) {
      addRimLight(bodyMat, '#ecfccb', 0.5);
      addRimLight(lidMat, '#ecfccb', 0.5);
    }
    ud.mats = { bodyMat, bootMat, lidMat, tipMat, bellyMat, spotMat };

    const B = this.body;

    // Bean body (head and body are one squishy shape)
    const torso = new THREE.Mesh(new THREE.LatheGeometry(BODY_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48), bodyMat);
    B.add(torso);
    if (!ghost) addOutline(torso);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 28, 20), bellyMat);
    belly.scale.set(0.42, 0.95, 0.85);
    belly.position.set(0.215, 0.3, 0);
    B.add(belly);
    // Freckle spots on the back and crown
    const spotGeo = new THREE.SphereGeometry(0.035, 10, 8);
    const spots = [
      [0.62, 2.6, 1.0],
      [0.5, 3.2, 0.8],
      [0.68, 3.6, 0.7],
      [0.38, 2.9, 0.9],
      [0.56, 4.0, 0.6],
      [0.72, 2.2, 0.6],
    ];
    for (const [y, ang, sc] of spots) {
      const r = bodyRadiusAt(y);
      const sp = new THREE.Mesh(spotGeo, spotMat);
      sp.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      sp.scale.set(sc, sc, sc * 0.35);
      sp.lookAt(sp.position.x * 2, y, sp.position.z * 2);
      B.add(sp);
    }

    // Frog eye-domes on top of the head, with big glossy eyes set into the front
    const face = new THREE.Group();
    B.add(face);
    ud.face = face;
    const eyes = [];
    const eyeTex = { normal: eyeTexture('normal'), heart: eyeTexture('heart'), spiral: eyeTexture('spiral'), star: eyeTexture('star') };
    ud.eyeTex = eyeTex;
    const lashMat = new THREE.MeshBasicMaterial({ color: '#0b1020' });
    for (const side of [-1, 1]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.155, 32, 24), bodyMat);
      dome.position.set(0.05, 0.765, side * 0.152);
      face.add(dome);
      if (!ghost) addOutline(dome);
      const eg = new THREE.Group();
      eg.position.set(0.105, 0.78, side * 0.158);
      const eyeMat = ghost ? whiteMat : new THREE.MeshPhysicalMaterial({ map: eyeTex.normal, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.125, 40, 28), eyeMat);
      if (!ghost) addOutline(ball);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), glintMat);
      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glintMat);
      const lidGeo = new THREE.SphereGeometry(0.133, 32, 14, 0, TWO_PI, 0, Math.PI * 0.5);
      const upper = new THREE.Mesh(lidGeo, lidMat);
      const upperPivot = new THREE.Group();
      upperPivot.add(upper);
      // lid line + lashes ride on the upper lid
      const lidLine = new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.009, 6, 32, Math.PI), lashMat);
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
      browPivot.position.set(0.05, 0.135, 0);
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
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), blushMat);
      const y = 0.56;
      const r = bodyRadiusAt(y) + 0.003;
      const ang = side * 0.85;
      b.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      b.lookAt(b.position.x * 2, y, b.position.z * 2);
      face.add(b);
    }
    ud.blushMat = blushMat;

    // Mouth shapes (wide frog mouth), placed on the front surface
    const mouth = new THREE.Group();
    const my = 0.59;
    mouth.position.set(bodyRadiusAt(my) + 0.004, my, 0);
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

    // Scarf: knitted ring + two simulated tails knotted at the back
    // Chunky hand-knitted wrap: a lumpy, slightly tilted tube around the neck
    const wrapPts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = 0.345 + Math.sin(a * 3) * 0.008;
      wrapPts.push(new THREE.Vector3(Math.cos(a) * r, 0.405 + Math.sin(a) * 0.03 + Math.sin(a * 5) * 0.006, Math.sin(a) * r));
    }
    const wrapCurve = new THREE.CatmullRomCurve3(wrapPts, true);
    const ringGeo = new THREE.TubeGeometry(wrapCurve, 64, 0.072, 12, true);
    const ring = new THREE.Mesh(ringGeo, scarfMat);
    scarfMat.map.repeat.set(10, 1);
    B.add(ring);
    if (!ghost) addOutline(ring);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), scarfMat);
    knot.scale.set(0.8, 1, 1.15);
    knot.position.set(-0.35, 0.41, 0.07);
    B.add(knot);
    if (!ghost) addOutline(knot);
    const tailMat = scarfMat.clone();
    tailMat.map = chunkyKnitTexture();
    tailMat.map.repeat.set(1, 2);
    ud.scarfTails = [new ScarfTail(tailMat, 8, 0.07, 0.15, 0.045), new ScarfTail(tailMat, 7, 0.07, 0.13, 0.045)];
    for (const tail of ud.scarfTails) {
      tail.mesh.castShadow = !ghost;
      this.yawRoot.add(tail.mesh, tail.tassels);
    }
    ud.scarfAnchor = knot;

    // Mitten arms
    const arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.04, 0.36, side * 0.32);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.1, 4, 10), bodyMat);
      upper.position.y = -0.08;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), bodyMat);
      hand.position.y = -0.18;
      hand.scale.set(1, 0.9, 1.1);
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), bodyMat);
      thumb.position.set(0.05, -0.16, -side * 0.02);
      shoulder.add(upper, hand, thumb);
      if (!ghost) {
        addOutline(upper);
        addOutline(hand);
      }
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
      hip.position.set(0, 0.14, side * 0.13);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.06, 4, 8), bodyMat);
      leg.position.y = -0.05;
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), bootMat);
      foot.scale.set(1.35, 0.42, 1.05);
      foot.position.set(0.06, -0.115, 0);
      hip.add(leg, foot);
      if (!ghost) addOutline(foot);
      // pink toe-bean pads on the sole (flash when the foot lifts)
      for (const tz of [-0.045, 0, 0.045]) {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: '#fda4af', roughness: 0.5 }));
        pad.position.set(0.12, -0.15, tz);
        pad.scale.y = 0.4;
        hip.add(pad);
      }
      for (const tz of [-0.05, 0, 0.05]) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), bootMat);
        toe.position.set(0.17, -0.12, tz);
        hip.add(toe);
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
        if (o.isMesh && !o.material.transparent) o.castShadow = true;
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
    st.walkPhase += speed * dt * 4.2;
    const ph = st.walkPhase * Math.PI;
    const stepAmt = moving ? Math.min(1, speed / 2.9) : 0;
    for (const leg of ud.legs) {
      const sgn = leg.side < 0 ? 1 : -1;
      const swing = Math.sin(ph) * sgn * 0.13 * stepAmt;
      const lift = Math.max(0, Math.sin(ph) * sgn) * 0.07 * stepAmt;
      leg.hip.position.set(swing, 0.14 + lift, leg.side * 0.13);
      leg.hip.rotation.z = -swing * 1.6;
    }
    if (!s.onGround) {
      ud.legs[0].hip.position.set(0.06, 0.18 + (s.vy > 0 ? 0.04 : 0), -0.15);
      ud.legs[1].hip.position.set(-0.04, 0.17, 0.15);
      ud.legs[0].hip.rotation.z = -0.5;
      ud.legs[1].hip.rotation.z = 0.3;
    }
    if (emo === 'celebrate') {
      const k = Math.sin(t * 14);
      ud.legs[0].hip.position.y = 0.14 + Math.max(0, k) * 0.08;
      ud.legs[1].hip.position.y = 0.14 + Math.max(0, -k) * 0.08;
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
    this.body.position.y = bob - (emo === 'sleep' ? 0.07 : 0);
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
    let aL = 0.05;
    let aR = 0.05;
    let aLx = 0.18;
    let aRx = 0.18;
    if (moving) {
      aL = Math.sin(ph) * 0.65 * stepAmt;
      aR = -Math.sin(ph) * 0.65 * stepAmt;
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
    this._anchor.set(-0.36, 0.4 + this.body.position.y, 0.0);
    const fwd = Math.abs(s.vx);
    const wind = fwd * 6 + Math.abs(s.vy) * 1.5 + (s.wind || 0) * 8;
    this._force.set(-wind * 2.2, -9 - s.vy * 1.5, Math.sin(t * 9) * wind * 0.6);
    if (emo === 'panic') this._force.set(-12, 6, Math.sin(t * 20) * 14);
    if (emo === 'celebrate') this._force.set(-6, 4, Math.sin(t * 12) * 8);
    ud.scarfTails.forEach((tail, i) => {
      this._anchor.z = i === 0 ? 0.03 : -0.03;
      tail.step(dt, this._anchor, this._force);
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
