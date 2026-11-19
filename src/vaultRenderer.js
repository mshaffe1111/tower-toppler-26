// TOWERING WATERS: GATEWAY'S DESCENT — ANCIENT AQUEDUCT VALVE VAULT 3D RENDERER (`src/vaultRenderer.js`)
//
// AAA Temple Aqueduct Rotunda & Concentric Bronze Astrolabe Water-Lock Engine:
//   - Carved Pelagian astrolabe vault door (`mg_pbr_vault_door_albedo/normal.webp`) layered with
//     engraved antique-bronze concentric rings, radial spokes, recessed aqua rune ring & pressurized
//     water conduits.
//   - Sunlit weathered travertine ashlar masonry rotunda (`mg_pbr_sanctum_masonry_albedo/normal.webp`)
//     flanked by fluted PBR travertine columns (`arch_coral_travertine_albedo/normal.webp`) with
//     carved capitals, stepped plinths, and riveted antique-bronze collars & pouring water spouts
//     (`arch_antique_bronze_albedo/normal.webp`).
//   - Animated caustic normal-mapped turquoise water basin with depth gradient, dual-scroll ripple
//     normals, soft shoreline foam rings, and feathered radial water-mote sprites.
//   - Unified main-game golden sun + cool azure hemisphere + soft exponential atmospheric fog,
//     zero PMREM stalls, zero external URLs, <= 40 draw calls, aspect-safe 412x915 & 1920x1080 framing.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const RING_RADII = [2.22, 1.64, 1.08];
const RING_Z = [0.08, 0.17, 0.26];
const WATER_Y = -2.85;
const MAX_MOTES = 96;
const MAX_STRIKE_GEMS = 5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function wrapAngle(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
}

function buildNotchArcGeo(radius, tube, arcSpan) {
  return new THREE.TorusGeometry(radius, tube, 12, 32, arcSpan);
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

function makeFlatNormalTex() {
  const data = new Uint8Array([128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function mergeNorm(geos) {
  const norm = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    }
    return ng;
  });
  const merged = BufferGeometryUtils.mergeGeometries(norm, false);
  for (const g of norm) g.dispose();
  return merged;
}

function buildFlutedShaftGeo(radiusTop, radiusBot, height, flutes = 12, radialSegs = 48, heightSegs = 4) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBot, height, radialSegs, heightSegs, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.001) continue;
    // Fade flutes softly near top and bottom neckings
    const yNorm = Math.abs(y) / (height * 0.5);
    const fluteFade = clamp((0.92 - yNorm) / 0.14, 0, 1);
    const ang = Math.atan2(z, x);
    const flute = Math.pow(Math.abs(Math.sin(ang * (flutes * 0.5))), 1.35);
    const scale = 1 - flute * 0.075 * fluteFade;
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildFlutedColumnStonePair() {
  const parts = [];
  for (const sx of [-3.48, 3.48]) {
    const z = -0.68;
    // Stepped square plinth base sitting in basin
    const plinthLow = new THREE.BoxGeometry(1.18, 0.42, 1.18);
    plinthLow.translate(sx, WATER_Y + 0.18, z);
    parts.push(plinthLow);

    const plinthMid = new THREE.BoxGeometry(0.98, 0.28, 0.98);
    plinthMid.translate(sx, WATER_Y + 0.52, z);
    parts.push(plinthMid);

    // Molded Attic torus base
    const baseTorus = new THREE.TorusGeometry(0.42, 0.09, 10, 24);
    baseTorus.rotateX(Math.PI * 0.5);
    baseTorus.translate(sx, WATER_Y + 0.72, z);
    parts.push(baseTorus);

    // Sculpted 12-flute travertine shaft
    const shaftH = 6.55;
    const shaftY = WATER_Y + 0.78 + shaftH * 0.5;
    const shaft = buildFlutedShaftGeo(0.32, 0.39, shaftH, 12, 48, 4);
    shaft.translate(sx, shaftY, z);
    parts.push(shaft);

    // Carved flared echinus + square abacus capital
    const capY = WATER_Y + 0.78 + shaftH;
    const echinus = new THREE.CylinderGeometry(0.49, 0.33, 0.28, 24);
    echinus.translate(sx, capY + 0.14, z);
    parts.push(echinus);

    const abacus = new THREE.BoxGeometry(1.12, 0.24, 1.12);
    abacus.translate(sx, capY + 0.38, z);
    parts.push(abacus);
  }
  return mergeNorm(parts);
}

function buildColumnBronzeTrimPair() {
  const parts = [];
  for (const sx of [-3.48, 3.48]) {
    const z = -0.68;
    const baseY = WATER_Y + 0.78;
    // Lower, mid-shaft, and upper decorative antique-bronze collars with rivets
    for (const [cy, rad, tube] of [
      [baseY + 0.12, 0.40, 0.055],
      [baseY + 3.15, 0.365, 0.048],
      [baseY + 6.48, 0.34, 0.055],
    ]) {
      const collar = new THREE.TorusGeometry(rad, tube, 10, 24);
      collar.rotateX(Math.PI * 0.5);
      collar.translate(sx, cy, z);
      parts.push(collar);

      for (let r = 0; r < 6; r++) {
        const ra = (r / 6) * TAU;
        const stud = new THREE.SphereGeometry(0.032, 6, 6);
        stud.translate(sx + Math.cos(ra) * (rad + tube * 0.8), cy, z + Math.sin(ra) * (rad + tube * 0.8));
        parts.push(stud);
      }
    }

    // Capital bronze frieze trim plate
    const capTrim = new THREE.BoxGeometry(1.04, 0.10, 1.04);
    capTrim.translate(sx, baseY + 6.72, z);
    parts.push(capTrim);

    // Ornate sculpted bronze aqueduct gargoyle/flanged water spout projecting inward from column
    const spoutX = sx * 0.86;
    const spoutY = 2.38;
    const spoutZ = -0.35;
    // Carved diamond escutcheon wall-plate + arched hood shroud
    const escutcheon = new THREE.CylinderGeometry(0.32, 0.34, 0.12, 6);
    escutcheon.rotateX(Math.PI * 0.5);
    escutcheon.translate(spoutX, spoutY, spoutZ - 0.34);
    parts.push(escutcheon);

    const hoodArch = new THREE.TorusGeometry(0.21, 0.055, 8, 16, Math.PI);
    hoodArch.translate(spoutX, spoutY + 0.06, spoutZ - 0.08);
    parts.push(hoodArch);

    const pipe = new THREE.CylinderGeometry(0.145, 0.175, 0.72, 14);
    pipe.rotateX(Math.PI * 0.5);
    pipe.translate(spoutX, spoutY, spoutZ);
    parts.push(pipe);

    // Flared flanged bronze nozzle mouth with crown crest
    const lip = new THREE.TorusGeometry(0.165, 0.044, 10, 20);
    lip.translate(spoutX, spoutY, spoutZ + 0.36);
    parts.push(lip);

    const browCrest = new THREE.ConeGeometry(0.11, 0.20, 4);
    browCrest.rotateX(Math.PI * 0.38);
    browCrest.translate(spoutX, spoutY + 0.18, spoutZ + 0.24);
    parts.push(browCrest);
  }
  return mergeNorm(parts);
}

function buildAstrolabeBronzeReliefGeo() {
  const parts = [];
  // Outer riveted bronze astrolabe bezel rim framing the studio carved vault door cleanly (zero stick spokes obscuring the door relief!)
  const outerBezel = new THREE.TorusGeometry(2.70, 0.105, 14, 60);
  outerBezel.translate(0, 0, -0.04);
  parts.push(outerBezel);

  // Subtle recessed inner bronze trim groove rings framing the rotary tracks
  for (const r of [2.52, 1.93, 1.36]) {
    const sep = new THREE.TorusGeometry(r, 0.024, 8, 52);
    sep.translate(0, 0, -0.032);
    parts.push(sep);
  }

  // 8 Ornamental bezel bosses + 16 perimeter rivets around outer frame
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * TAU;
    const boss = new THREE.CylinderGeometry(0.085, 0.10, 0.075, 8);
    boss.rotateX(Math.PI * 0.5);
    boss.translate(Math.cos(ang) * 2.70, Math.sin(ang) * 2.70, 0.035);
    parts.push(boss);
  }
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * TAU + Math.PI / 16;
    const riv = new THREE.SphereGeometry(0.036, 6, 6);
    riv.translate(Math.cos(ang) * 2.70, Math.sin(ang) * 2.70, 0.055);
    parts.push(riv);
  }

  return mergeNorm(parts);
}

function buildOrnateCaliperBezelGeo() {
  // Sculpted antique-bronze 12-o'clock arch crest & downward pointer bezel framing the alignment jewel (zero flat brown square!)
  const parts = [];
  const archCrown = new THREE.TorusGeometry(0.28, 0.068, 10, 22, Math.PI);
  archCrown.translate(0, 2.58, 0.24);
  parts.push(archCrown);

  const lowerCradle = new THREE.TorusGeometry(0.22, 0.052, 8, 18);
  lowerCradle.translate(0, 2.58, 0.26);
  parts.push(lowerCradle);

  for (const sx of [-0.28, 0.28]) {
    const shoulder = new THREE.CylinderGeometry(0.08, 0.11, 0.26, 8);
    shoulder.translate(sx, 2.50, 0.22);
    parts.push(shoulder);
    const rivet = new THREE.SphereGeometry(0.052, 8, 6);
    rivet.translate(sx, 2.66, 0.28);
    parts.push(rivet);
  }
  const crestFinial = new THREE.OctahedronGeometry(0.095, 0);
  crestFinial.scale(0.9, 1.35, 0.7);
  crestFinial.translate(0, 2.94, 0.24);
  parts.push(crestFinial);

  // Sculpted downward bronze pointer beak housing
  const beak = new THREE.ConeGeometry(0.15, 0.34, 4);
  beak.rotateZ(Math.PI);
  beak.scale(1.0, 1.0, 0.65);
  beak.translate(0, 2.26, 0.26);
  parts.push(beak);

  return mergeNorm(parts);
}

function createSoftSunbeamTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(254, 243, 199);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  // Dual-axis soft feathered gradient: fades completely to 0 at left, right, top, AND bottom (ZERO hard triangle edges!)
  const hGrad = ctx.createLinearGradient(0, 0, size, 0);
  hGrad.addColorStop(0.0, 'rgba(255, 244, 210, 0.0)');
  hGrad.addColorStop(0.28, 'rgba(255, 244, 210, 0.42)');
  hGrad.addColorStop(0.50, 'rgba(255, 250, 224, 0.85)');
  hGrad.addColorStop(0.72, 'rgba(255, 244, 210, 0.42)');
  hGrad.addColorStop(1.0, 'rgba(255, 244, 210, 0.0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'destination-in';
  const vGrad = ctx.createLinearGradient(0, 0, 0, size);
  vGrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  vGrad.addColorStop(0.22, 'rgba(255,255,255,0.85)');
  vGrad.addColorStop(0.70, 'rgba(255,255,255,0.38)');
  vGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSculptedVaultRingGeo(rad) {
  const parts = [];
  // Main machined bronze rotary ring chassis
  parts.push(new THREE.TorusGeometry(rad, 0.132, 14, 52));

  // Beveled inner & outer precision flange lips
  const outerLip = new THREE.TorusGeometry(rad + 0.115, 0.03, 8, 48);
  outerLip.translate(0, 0, 0.02);
  parts.push(outerLip);

  const innerLip = new THREE.TorusGeometry(rad - 0.115, 0.028, 8, 44);
  innerLip.translate(0, 0, 0.02);
  parts.push(innerLip);

  // 12 planetary gear teeth along inner circumference
  const teethCount = Math.round(rad * 7);
  for (let t = 0; t < teethCount; t++) {
    const ta = (t / teethCount) * TAU;
    const tooth = new THREE.BoxGeometry(0.055, 0.085, 0.09);
    tooth.translate(0, rad - 0.145, 0);
    tooth.rotateZ(ta);
    parts.push(tooth);
  }

  // 4 sculpted rotary valve handle lugs & riveted collars
  for (let s = 0; s < 4; s++) {
    const sa = (s * Math.PI) / 2 + Math.PI * 0.25;
    const cx = Math.cos(sa) * (rad + 0.155);
    const cy = Math.sin(sa) * (rad + 0.155);
    const lug = new THREE.CylinderGeometry(0.068, 0.088, 0.11, 10);
    lug.rotateX(Math.PI * 0.5);
    lug.translate(cx, cy, 0.02);
    parts.push(lug);

    const cap = new THREE.SphereGeometry(0.062, 8, 8);
    cap.translate(cx, cy, 0.08);
    parts.push(cap);
  }

  return mergeNorm(parts);
}

function createEmberBedTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(220, 95, 25);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#240b04';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 48; i++) {
    const x = ((i * 37 + 13) % size);
    const y = ((i * 53 + 19) % size);
    const r = 6 + (i % 9);
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, i % 3 === 0 ? '#fef08a' : '#fb923c');
    g.addColorStop(0.55, '#c2410c');
    g.addColorStop(1, 'rgba(36, 11, 4, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTeardropFlameTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(255, 210, 120);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const g1 = ctx.createRadialGradient(cx, size * 0.66, 3, cx, size * 0.54, size * 0.44);
  g1.addColorStop(0.0, 'rgba(255, 252, 232, 0.96)');
  g1.addColorStop(0.28, 'rgba(253, 224, 71, 0.84)');
  g1.addColorStop(0.58, 'rgba(249, 115, 22, 0.44)');
  g1.addColorStop(0.85, 'rgba(220, 38, 38, 0.12)');
  g1.addColorStop(1.0, 'rgba(180, 20, 10, 0.0)');
  ctx.save();
  ctx.translate(cx, size * 0.56);
  ctx.scale(0.68, 1.05);
  ctx.translate(-cx, -size * 0.56);
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(cx, size * 0.56, size * 0.46, 0, TAU);
  ctx.fill();
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildAqueductFountainGeos() {
  const stoneParts = [];
  const bronzeParts = [];
  const emberParts = [];
  for (const sx of [-2.85, 2.85]) {
    const y0 = WATER_Y + 0.02;
    const z0 = 0.72;
    // Beveled octagonal stepped travertine pedestal + fluted column shaft
    const base = new THREE.CylinderGeometry(0.44, 0.54, 0.24, 8);
    base.translate(sx, y0 + 0.12, z0);
    stoneParts.push(base);

    const stemStone = new THREE.CylinderGeometry(0.21, 0.28, 0.56, 12);
    stemStone.translate(sx, y0 + 0.52, z0);
    stoneParts.push(stemStone);

    // Sculpted scalloped antique-bronze brazier bowl (LatheGeometry)
    const bowlPts = [
      new THREE.Vector2(0.14, 0.0),
      new THREE.Vector2(0.26, 0.08),
      new THREE.Vector2(0.42, 0.22),
      new THREE.Vector2(0.48, 0.32),
      new THREE.Vector2(0.42, 0.34),
      new THREE.Vector2(0.34, 0.22),
      new THREE.Vector2(0.08, 0.18),
    ];
    const bowl = new THREE.LatheGeometry(bowlPts, 20);
    bowl.translate(sx, y0 + 0.78, z0);
    bronzeParts.push(bowl);

    // Rolled bronze rim & pedestal collar
    const rim = new THREE.TorusGeometry(0.45, 0.036, 8, 22);
    rim.rotateX(Math.PI * 0.5);
    rim.translate(sx, y0 + 1.09, z0);
    bronzeParts.push(rim);

    const collar = new THREE.TorusGeometry(0.26, 0.04, 8, 18);
    collar.rotateX(Math.PI * 0.5);
    collar.translate(sx, y0 + 0.78, z0);
    bronzeParts.push(collar);

    // Domed glowing cracked ember bed inside bronze brazier bowl (ZERO flat blue discs or white diamonds!)
    const ember = new THREE.SphereGeometry(0.35, 14, 8, 0, TAU, 0, Math.PI * 0.5);
    ember.scale(1.0, 0.42, 1.0);
    ember.translate(sx, y0 + 0.99, z0);
    emberParts.push(ember);
  }
  return {
    stoneGeo: mergeNorm(stoneParts),
    bronzeGeo: mergeNorm(bronzeParts),
    emberGeo: mergeNorm(emberParts),
  };
}

function createWaterCausticAlbedoTex(size = 256) {
  // Smooth organic pixel-computed multi-wave ocean caustic interference field (ZERO circles, ZERO hexagons!)
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const w1 = Math.sin((u * 3 + v * 2) * TAU + Math.sin((v * 2 - u) * TAU) * 0.9);
      const w2 = Math.sin((u * 2 - v * 4) * TAU + Math.cos((u * 3 + v) * TAU) * 0.85);
      const w3 = Math.cos((u * 5 + v * 3) * TAU - Math.sin((u * 2 + v * 5) * TAU) * 0.7);
      const w4 = Math.sin((u * 4 - v * 2) * TAU + Math.cos((v * 4 - u * 2) * TAU) * 0.6);
      const field = (w1 + w2 + w3 + w4) * 0.25;
      // Subtle organic sunlight filaments along wave-crest intersections
      const caustic = Math.pow(clamp(1 - Math.abs(field) * 2.1, 0, 1), 3.2) * 0.55 + clamp(field * 0.5 + 0.5, 0, 1) * 0.14;
      const r = clamp(Math.round(7 + caustic * 78), 0, 255);
      const g = clamp(Math.round(58 + caustic * 155), 0, 255);
      const b = clamp(Math.round(76 + caustic * 145), 0, 255);
      const idx = (y * size + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWaterRippleNormalTex(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const hAt = (u, v) => {
    const a1 = (u * 3 + v * 2) * TAU;
    const a2 = (u * 5 - v * 4) * TAU;
    const a3 = (u * 2 + v * 7) * TAU;
    const a4 = (u * 8 + v * 3) * TAU;
    return (
      Math.sin(a1) * 0.38 +
      Math.cos(a2) * 0.28 +
      Math.sin(a3) * 0.20 +
      Math.cos(a4) * 0.14
    );
  };
  const eps = 1 / size;
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const dx = (hAt(u + eps, v) - hAt(u - eps, v)) * strength;
      const dy = (hAt(u, v + eps) - hAt(u, v - eps)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const inv = 1 / Math.hypot(nx, ny, nz);
      const idx = (y * size + x) * 4;
      data[idx] = clamp(Math.round((nx * inv * 0.5 + 0.5) * 255), 0, 255);
      data[idx + 1] = clamp(Math.round((ny * inv * 0.5 + 0.5) * 255), 0, 255);
      data[idx + 2] = clamp(Math.round((nz * inv * 0.5 + 0.5) * 255), 0, 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createShorelineFoamTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(180, 245, 255);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const cy = size * 0.5;
  const g = ctx.createRadialGradient(cx, cy, size * 0.24, cx, cy, size * 0.49);
  g.addColorStop(0.0, 'rgba(186, 230, 253, 0.0)');
  g.addColorStop(0.45, 'rgba(165, 243, 252, 0.16)');
  g.addColorStop(0.72, 'rgba(224, 247, 255, 0.52)');
  g.addColorStop(0.86, 'rgba(125, 211, 252, 0.22)');
  g.addColorStop(1.0, 'rgba(14, 116, 144, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Subtle organic foam flecks along ring crest
  for (let i = 0; i < 42; i++) {
    const ang = (i / 42) * TAU;
    const rad = size * (0.35 + ((i * 37) % 10) * 0.008);
    const fx = cx + Math.cos(ang) * rad;
    const fy = cy + Math.sin(ang) * rad;
    const fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, 9 + (i % 6));
    fg.addColorStop(0, 'rgba(240, 253, 255, 0.42)');
    fg.addColorStop(1, 'rgba(240, 253, 255, 0.0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(fx, fy, 12, 0, TAU);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaterfallRibbonTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(120, 230, 250);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const base = ctx.createLinearGradient(0, 0, size, 0);
  base.addColorStop(0, 'rgba(56, 189, 248, 0.12)');
  base.addColorStop(0.25, 'rgba(125, 211, 252, 0.45)');
  base.addColorStop(0.5, 'rgba(224, 247, 255, 0.65)');
  base.addColorStop(0.75, 'rgba(125, 211, 252, 0.45)');
  base.addColorStop(1, 'rgba(56, 189, 248, 0.12)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 28; i++) {
    const sx = (i * 29 + 7) % size;
    const sy = (i * 43) % size;
    const w = 3 + (i % 5);
    const h = 24 + (i % 34);
    for (const oy of [-size, 0, size]) {
      const g = ctx.createLinearGradient(sx, sy + oy, sx, sy + oy + h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.45, 'rgba(240, 253, 255, 0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx, sy + oy, w, h);
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
  const cy = size * 0.5;
  // Soft recessed glow ring
  const rg = ctx.createRadialGradient(cx, cy, size * 0.34, cx, cy, size * 0.49);
  rg.addColorStop(0.0, 'rgba(6, 182, 212, 0)');
  rg.addColorStop(0.35, 'rgba(34, 211, 238, 0.25)');
  rg.addColorStop(0.55, 'rgba(94, 252, 232, 0.72)');
  rg.addColorStop(0.75, 'rgba(34, 211, 238, 0.25)');
  rg.addColorStop(1.0, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, size, size);

  // Carved radial Pelagian wave & chevron ticks
  ctx.strokeStyle = 'rgba(224, 255, 252, 0.92)';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * TAU;
    ctx.save();
    ctx.translate(cx + Math.cos(ang) * (size * 0.415), cy + Math.sin(ang) * (size * 0.415));
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

export class VaultRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.dpr = opts.dpr || 1;
    this.envMap = opts.envMap || null;
    this._disposed = false;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._loadedTextures = [];

    // Lightweight placeholder PBR maps pre-bound before prewarm() so async WebP swaps cause 0ms shader recompile!
    this._flatNormalTex = makeFlatNormalTex();
    this._stonePlaceholder = makeSolidAlbedoTex(218, 206, 184);
    this._bronzePlaceholder = makeSolidAlbedoTex(186, 142, 74);
    this._vaultDoorPlaceholder = makeSolidAlbedoTex(72, 112, 114);

    this.waterAlbedoTex = createWaterCausticAlbedoTex(256);
    this.waterAlbedoTex.repeat.set(4, 3);
    this.waterNormalTex = createWaterRippleNormalTex(256);
    this.waterNormalTex.repeat.set(6, 5);
    this.shoreFoamTex = createShorelineFoamTex(256);
    this.waterfallTex = createWaterfallRibbonTex(128);
    this.waterfallTex.repeat.set(1, 2.6);
    this.sunbeamTex = createSoftSunbeamTex(128);
    this.runeRingTex = createAquaRuneRingTex(256);
    this.moteGlowTex = createSoftGlowSpriteTex(64);

    this._initScene();
    this._loadPbrTextures();
  }

  setEra(_era) {}

  prewarm() {
    try {
      this.webgl?.compile?.(this.scene, this.camera);
    } catch {
      // Ignore
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
    this.scene.background = new THREE.Color('#133a52');
    // Unified soft exponential atmospheric fog matching the chamber horizon
    this.scene.fog = new THREE.FogExp2('#15435e', 0.032);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.65;
    }

    this.camera = new THREE.PerspectiveCamera(46, this.width / Math.max(1, this.height), 0.2, 70);

    // Unified Main-Game Lighting Rig: Warm Golden Sun Key + Cool Azure Hemisphere + Turquoise Basin Bounce
    this.hemiLight = new THREE.HemisphereLight('#7cc8f0', '#28455c', 1.22);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff1d6', 2.35);
    this.sunLight.position.set(4.8, 11.5, 9.5);
    this.scene.add(this.sunLight);

    this.basinBounce = new THREE.DirectionalLight('#38bdf8', 0.85);
    this.basinBounce.position.set(-5.5, -2.5, 5.5);
    this.scene.add(this.basinBounce);

    this.coreLight = new THREE.PointLight('#5efce8', 1.85, 11);
    this.coreLight.position.set(0, 0, 1.8);
    this.scene.add(this.coreLight);

    // Shared PBR Materials (all pre-bound with map + normalMap for 0-stall prewarm)
    this.rotundaMat = new THREE.MeshStandardMaterial({
      color: '#e5dac6',
      map: this._stonePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.68,
      metalness: 0.06,
      side: THREE.BackSide,
    });

    this.travMat = new THREE.MeshStandardMaterial({
      color: '#ebe0cc',
      map: this._stonePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughness: 0.60,
      metalness: 0.05,
    });

    this.bronzeMat = new THREE.MeshStandardMaterial({
      color: '#e3b25d',
      map: this._bronzePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.05, 1.05),
      emissive: '#382208',
      emissiveIntensity: 0.16,
      roughness: 0.28,
      metalness: 0.72,
    });

    this.vaultDoorMat = new THREE.MeshStandardMaterial({
      color: '#e6f0ee',
      map: this._vaultDoorPlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.38,
      metalness: 0.44,
    });

    // 1. Concave Carved Ashlar Masonry Rotunda Wall (`mg_pbr_sanctum_masonry_albedo/normal`)
    const rotunda = new THREE.Mesh(
      new THREE.CylinderGeometry(6.85, 6.85, 11.8, 32, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      this.rotundaMat
    );
    rotunda.position.set(0, 0.5, 2.2);
    this.scene.add(rotunda);

    // 2. Fluted PBR Travertine Temple Columns + Carved Capitals + Stepped Plinths + Antique Bronze Collars & Spouts (2 draw calls total!)
    const columnsStone = new THREE.Mesh(buildFlutedColumnStonePair(), this.travMat);
    const columnsBronze = new THREE.Mesh(buildColumnBronzeTrimPair(), this.bronzeMat);
    this.scene.add(columnsStone, columnsBronze);

    // Animated Translucent Pouring Water Cascades & Shoreline Splash Foam Rings
    const cascadeMat = new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      map: this.waterfallTex,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const splashParts = [];
    for (const sx of [-3.48, 3.48]) {
      const wfX = sx * 0.86;
      const waterfall = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 5.25, 12, 1, true), cascadeMat);
      waterfall.position.set(wfX, -0.24, -0.02);
      this.scene.add(waterfall);

      const sp = new THREE.PlaneGeometry(1.5, 1.5);
      sp.rotateX(-Math.PI * 0.5);
      sp.translate(wfX, WATER_Y + 0.035, -0.02);
      splashParts.push(sp);
    }
    this.splashFoamMesh = new THREE.Mesh(
      mergeNorm(splashParts),
      new THREE.MeshBasicMaterial({
        color: '#e0faff',
        map: this.shoreFoamTex,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.splashFoamMesh);

    // Soft Feathered Volumetric Golden Sunbeam from Upper Rotunda Oculus (ZERO hard triangle edges!)
    const sunbeam = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 11.5),
      new THREE.MeshBasicMaterial({
        color: '#fef3c7',
        map: this.sunbeamTex,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    sunbeam.position.set(0.45, 2.6, 0.75);
    sunbeam.rotation.z = -0.18;
    this.scene.add(sunbeam);

    // 3. Dark-Emerald Reflective Caustic Normal-Mapped Water Pool + Soft Shoreline Foam Ring
    this.waterMat = new THREE.MeshStandardMaterial({
      color: '#0c6876',
      map: this.waterAlbedoTex,
      normalMap: this.waterNormalTex,
      normalScale: new THREE.Vector2(0.95, 0.95),
      emissive: '#053a47',
      emissiveMap: this.waterAlbedoTex,
      emissiveIntensity: 0.30,
      roughness: 0.12,
      metalness: 0.32,
    });
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 18, 24, 18), this.waterMat);
    this.waterMesh.rotation.x = -Math.PI * 0.5;
    this.waterMesh.position.set(0, WATER_Y, 1.5);
    this.scene.add(this.waterMesh);

    // Soft shoreline foam halo ringing the submerged vault plinth & flanking rotunda basin
    this.basinFoamRing = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 5.4),
      new THREE.MeshBasicMaterial({
        color: '#ccf7ff',
        map: this.shoreFoamTex,
        transparent: true,
        opacity: 0.46,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.basinFoamRing.rotation.x = -Math.PI * 0.5;
    this.basinFoamRing.position.set(0, WATER_Y + 0.025, 0.15);
    this.scene.add(this.basinFoamRing);

    // 4. Sculpted Flanking Antique-Bronze Flame & Ember Braziers (matching Sanctum, ZERO flat light-blue discs!)
    const fntGeos = buildAqueductFountainGeos();
    this.brazierEmberTex = createEmberBedTex(128);
    this.brazierFlameTex = createTeardropFlameTex(128);
    this.brazierEmberMat = new THREE.MeshStandardMaterial({
      color: '#ff9a3c',
      map: this.brazierEmberTex,
      emissive: '#f97316',
      emissiveMap: this.brazierEmberTex,
      emissiveIntensity: 1.55,
      roughness: 0.65,
    });
    this.scene.add(
      new THREE.Mesh(fntGeos.stoneGeo, this.travMat),
      new THREE.Mesh(fntGeos.bronzeGeo, this.bronzeMat),
      new THREE.Mesh(fntGeos.emberGeo, this.brazierEmberMat)
    );
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: '#ffedd5',
      map: this.brazierFlameTex,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flameInnerMat = new THREE.MeshBasicMaterial({
      color: '#fef9c3',
      map: this.brazierFlameTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.brazierFlames = [];
    for (const sx of [-2.85, 2.85]) {
      const fOut = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.15), flameOuterMat);
      fOut.position.set(sx, WATER_Y + 1.48, 0.72);
      const fIn = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.74), flameInnerMat);
      fIn.position.set(sx, WATER_Y + 1.40, 0.75);
      this.scene.add(fOut, fIn);
      this.brazierFlames.push({ fOut, fIn, sx });
    }

    // 5. Carved Stone & Verdigris-Bronze Relief Astrolabe Vault Wheel (`mg_pbr_vault_door_albedo/normal`)
    // Carved stone outer drum rim
    const stoneBackRim = new THREE.Mesh(new THREE.CylinderGeometry(2.86, 2.94, 0.36, 48), this.travMat);
    stoneBackRim.rotation.x = Math.PI * 0.5;
    stoneBackRim.position.z = -0.24;
    this.scene.add(stoneBackRim);

    // Planar UV-mapped Pelagian carved astrolabe door face (1:1 circular relief texture + Sobel normal map, unobstructed!)
    const astrolabeFace = new THREE.Mesh(new THREE.CircleGeometry(2.68, 48), this.vaultDoorMat);
    astrolabeFace.position.z = -0.055;
    this.scene.add(astrolabeFace);

    // Riveted antique-bronze outer bezel & subtle recessed ring tracks (1 merged draw call!)
    const astrolabeBronze = new THREE.Mesh(buildAstrolabeBronzeReliefGeo(), this.bronzeMat);
    this.scene.add(astrolabeBronze);

    // Subtle recessed glowing aqua rune halo around the outer engraved track
    this.runeRingMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      map: this.runeRingTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.runeRingMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.15, 5.15), this.runeRingMat);
    this.runeRingMesh.position.z = -0.015;
    this.scene.add(this.runeRingMesh);

    // 6. Top 12-O'Clock (+Y) Ornate Carved Antique-Bronze Pointer Bezel Framing a Faceted Crystal Jewel
    this.topCaliper = new THREE.Group();
    const calHousing = new THREE.Mesh(buildOrnateCaliperBezelGeo(), this.bronzeMat);
    this.caliperGemMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0284c7',
      emissiveIntensity: 0.65,
      roughness: 0.10,
      metalness: 0.36,
      transparent: true,
      opacity: 0.92,
    });
    const calGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.155, 0), this.caliperGemMat);
    calGem.scale.set(0.88, 1.25, 0.72);
    calGem.position.set(0, 2.58, 0.36);
    const calGemHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.64, 0.64),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.36,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    calGemHalo.position.set(0, 2.58, 0.44);
    this.caliperGemHalo = calGemHalo;
    this.topCaliper.add(calHousing, calGem, calGemHalo);
    this.scene.add(this.topCaliper);

    // 7. 3 Concentric Machined Antique-Bronze Rings with Luminous Translucent Aquamarine Crystal Conduits (6 draw calls total!)
    this.ringObjs = [];
    this.ringChassisMats = [];
    for (let i = 0; i < 3; i++) {
      const rad = RING_RADII[i];
      const tol = i === 0 ? 0.42 : i === 1 ? 0.38 : 0.35;
      const rg = new THREE.Group();
      rg.position.z = RING_Z[i];

      const chassisMat = new THREE.MeshStandardMaterial({
        color: '#e0aa52',
        map: this._bronzePlaceholder,
        normalMap: this._flatNormalTex,
        normalScale: new THREE.Vector2(1.0, 1.0),
        emissive: '#301d06',
        emissiveIntensity: 0.14,
        roughness: 0.26,
        metalness: 0.74,
      });
      this.ringChassisMats.push(chassisMat);

      const ringMesh = new THREE.Mesh(buildSculptedVaultRingGeo(rad), chassisMat);
      rg.add(ringMesh);

      // Translucent jewel-like aquamarine/sapphire conduit inset into grooved bronze channel (`delta === 0` at 12 o'clock)
      const notchMat = new THREE.MeshStandardMaterial({
        color: '#0ea5e9',
        emissive: '#0369a1',
        emissiveIntensity: 0.58,
        roughness: 0.08,
        metalness: 0.32,
        transparent: true,
        opacity: 0.74,
      });
      const notchMesh = new THREE.Mesh(buildNotchArcGeo(rad, 0.142, tol * 2), notchMat);
      notchMesh.rotation.z = Math.PI * 0.5 - tol;
      notchMesh.position.z = 0.02;
      rg.add(notchMesh);

      rg.userData = { rad, builtTol: tol, chassisMat, notchMat, notchMesh };
      this.scene.add(rg);
      this.ringObjs.push(rg);
    }

    // 8. Central Faceted Sapphire Harmonic Seed & Tri-Axis Bronze Armillary Gimbal
    this.centerSeedGroup = new THREE.Group();
    this.centerSeedGroup.position.z = 0.34;
    const gimbal1 = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 10, 32), this.bronzeMat);
    const gimbal2 = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.034, 10, 28), this.bronzeMat);
    this.seedCoreMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0284c7',
      emissiveIntensity: 0.48,
      roughness: 0.10,
      metalness: 0.38,
      flatShading: true,
    });
    const seedCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), this.seedCoreMat);
    seedCore.scale.set(0.82, 1.24, 0.82);
    const seedBezel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.028, 8, 20), this.bronzeMat);
    seedBezel.rotation.x = Math.PI * 0.5;
    seedCore.add(seedBezel);
    const seedHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.10, 1.10),
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    seedHalo.position.z = -0.06;
    this.centerSeedGroup.add(gimbal1, gimbal2, seedCore, seedHalo);
    this.centerSeedGroup.userData = { gimbal1, gimbal2, seedCore, seedHalo };
    this.scene.add(this.centerSeedGroup);

    // 9. Strike Telemetry Crystals nested inside Carved Antique-Bronze Hexagonal Sockets below the dial
    this.strikeGems = [];
    const sockGeo = new THREE.CylinderGeometry(0.165, 0.195, 0.10, 6);
    sockGeo.rotateX(Math.PI * 0.5);
    const sockRimGeo = new THREE.TorusGeometry(0.15, 0.026, 8, 6);
    for (let i = 0; i < MAX_STRIKE_GEMS; i++) {
      const slot = new THREE.Group();
      const socket = new THREE.Mesh(sockGeo, this.bronzeMat);
      socket.position.z = -0.02;
      const rim = new THREE.Mesh(sockRimGeo, this.bronzeMat);
      rim.position.z = 0.04;
      const gm = new THREE.MeshStandardMaterial({
        color: '#0ea5e9',
        emissive: '#0284c7',
        emissiveIntensity: 0.58,
        roughness: 0.10,
        metalness: 0.36,
        flatShading: true,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), gm);
      gem.scale.set(0.95, 1.05, 0.72);
      gem.position.z = 0.055;
      slot.add(socket, rim, gem);
      slot.position.set(0, -2.56, 0.34);
      slot.visible = false;
      slot.userData = { gem, mat: gm };
      this.scene.add(slot);
      this.strikeGems.push(slot);
    }

    // 10. Soft Radial Alpha Glowing Water-Droplet & Golden Sunlit Motes (Billboarded InstancedMesh, 1 draw call!)
    this.moteInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_MOTES
    );
    this.moteInst.frustumCulled = false;
    for (let i = 0; i < MAX_MOTES; i++) {
      this._col.set(i % 3 === 0 ? '#fef08a' : '#7dd3fc');
      this.moteInst.setColorAt(i, this._col);
    }
    if (this.moteInst.instanceColor) this.moteInst.instanceColor.needsUpdate = true;
    this.scene.add(this.moteInst);
  }

  _loadPbrTextures() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    const loadTex = (url, isColor, repX, repY, onDone) => {
      loader.load(
        url,
        (t) => {
          if (this._disposed) {
            t.dispose();
            return;
          }
          if (repX > 0 && repY > 0) {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(repX, repY);
          }
          if (isColor) t.colorSpace = THREE.SRGBColorSpace;
          this._loadedTextures.push(t);
          onDone(t);
        },
        undefined,
        () => {}
      );
    };

    // Chamber backdrop
    loadTex('assets/textures/mg_bg_core_reactor.webp', true, 0, 0, (t) => {
      this.scene.background = t;
    });

    // Studio Carved Pelagian Astrolabe Vault Door (albedo + Sobel normal)
    loadTex('assets/textures/mg_pbr_vault_door_albedo.webp', true, 0, 0, (t) => {
      this.vaultDoorMat.map = t;
      this.vaultDoorMat.needsUpdate = true;
    });
    loadTex('assets/textures/mg_pbr_vault_door_normal.webp', false, 0, 0, (t) => {
      this.vaultDoorMat.normalMap = t;
      this.vaultDoorMat.needsUpdate = true;
    });

    // Studio Weathered Sanctum Ashlar Masonry for Rotunda Wall (albedo + Sobel normal)
    loadTex('assets/textures/mg_pbr_sanctum_masonry_albedo.webp', true, 3.5, 2.2, (t) => {
      this.rotundaMat.map = t;
      this.rotundaMat.needsUpdate = true;
    });
    loadTex('assets/textures/mg_pbr_sanctum_masonry_normal.webp', false, 3.5, 2.2, (t) => {
      this.rotundaMat.normalMap = t;
      this.rotundaMat.needsUpdate = true;
    });

    // Carved Coral Travertine for Fluted Columns, Plinths, Capitals & Astrolabe Surround
    loadTex('assets/textures/arch_coral_travertine_albedo.webp', true, 2, 2, (t) => {
      this.travMat.map = t;
      this.travMat.needsUpdate = true;
    });
    loadTex('assets/textures/arch_coral_travertine_normal.webp', false, 2, 2, (t) => {
      this.travMat.normalMap = t;
      this.travMat.needsUpdate = true;
    });

    // Hammered Antique Bronze for Collars, Astrolabe Relief, Rings, Caliper & Fountains
    loadTex('assets/textures/arch_antique_bronze_albedo.webp', true, 2, 2, (t) => {
      this.bronzeMat.map = t;
      this.bronzeMat.needsUpdate = true;
      for (const rm of this.ringChassisMats) {
        rm.map = t;
        rm.needsUpdate = true;
      }
    });
    loadTex('assets/textures/arch_antique_bronze_normal.webp', false, 2, 2, (t) => {
      this.bronzeMat.normalMap = t;
      this.bronzeMat.needsUpdate = true;
      for (const rm of this.ringChassisMats) {
        rm.normalMap = t;
        rm.needsUpdate = true;
      }
    });
  }

  render(state, _opts = {}) {
    if (this._disposed || !this.webgl || !state) return;
    const vault = state.vault || state.sanctumVault;
    if (!vault) return;

    const time = Number(state.time) || 0;
    const rings = vault.rings || [];
    const status = vault.status || 'playing';
    const activeIdx = vault.activeRing || 0;

    let activeInSweetSpot = false;
    let lockedCount = 0;

    for (let i = 0; i < this.ringObjs.length; i++) {
      const ro = this.ringObjs[i];
      const rState = rings[i];
      if (!rState) continue;
      if (rState.locked) lockedCount++;

      const delta = wrapAngle((rState.angle || 0) - (rState.targetAngle || 0));
      ro.rotation.z = delta;

      const tol = rState.tolerance || (i === 0 ? 0.42 : i === 1 ? 0.38 : 0.35);
      const ud = ro.userData;
      if (Math.abs(tol - ud.builtTol) > 0.005) {
        ud.notchMesh.geometry.dispose();
        ud.notchMesh.geometry = buildNotchArcGeo(ud.rad, 0.142, tol * 2);
        ud.notchMesh.rotation.z = Math.PI * 0.5 - tol;
        ud.builtTol = tol;
      }

      const isActive = i === activeIdx && status === 'playing';
      const inZone = Math.abs(delta) <= tol;
      if (isActive && inZone) activeInSweetSpot = true;

      if (status === 'failed') {
        ud.chassisMat.color.set('#a84646');
        ud.notchMat.color.set('#e11d48');
        ud.notchMat.emissive.set('#be123c');
        ud.notchMat.emissiveIntensity = 0.72;
        ud.notchMat.opacity = 0.78;
      } else if (rState.locked || status === 'won') {
        ud.chassisMat.color.set('#f5cb5c');
        ud.notchMat.color.set('#10b981');
        ud.notchMat.emissive.set('#047857');
        ud.notchMat.emissiveIntensity = 0.78;
        ud.notchMat.opacity = 0.76;
      } else if (isActive) {
        ud.chassisMat.color.set('#f5be63');
        if (inZone) {
          ud.notchMat.color.set('#22d3ee');
          ud.notchMat.emissive.set('#0891b2');
          ud.notchMat.emissiveIntensity = 0.92 + Math.sin(time * 22) * 0.14;
          ud.notchMat.opacity = 0.78;
        } else {
          ud.notchMat.color.set('#0284c7');
          ud.notchMat.emissive.set('#0369a1');
          ud.notchMat.emissiveIntensity = 0.62;
          ud.notchMat.opacity = 0.72;
        }
      } else {
        ud.chassisMat.color.set('#bd904d');
        ud.notchMat.color.set('#164e63');
        ud.notchMat.emissive.set('#083344');
        ud.notchMat.emissiveIntensity = 0.35;
        ud.notchMat.opacity = 0.64;
      }
    }

    // Caliper Jewel, Rune Ring & Fountain Glow Feedback
    const calCol =
      status === 'failed' ? '#e11d48' : status === 'won' ? '#fde047' : activeInSweetSpot ? '#34d399' : '#22d3ee';
    this.caliperGemMat.emissive.set(calCol);
    this.caliperGemHalo.material.color.set(calCol);
    this.caliperGemHalo.scale.setScalar(activeInSweetSpot || status === 'won' ? 1.25 + Math.sin(time * 14) * 0.14 : 0.92);
    const pressure = status === 'won' ? 1 : lockedCount / 3;
    this.runeRingMesh.rotation.z = -time * (0.08 + pressure * 0.22);
    this.runeRingMat.opacity = 0.36 + pressure * 0.28 + Math.sin(time * 3.2) * 0.06;
    this.runeRingMat.color.set(status === 'failed' ? '#fb7185' : status === 'won' ? '#fde047' : '#5efce8');

    // Animated Water Caustic & Ripple Normal Scroll + Cascading Spouts + Breathing Shoreline Foam
    this.waterAlbedoTex.offset.set((time * 0.022) % 1, (time * 0.016) % 1);
    this.waterNormalTex.offset.set((-time * 0.036) % 1, (time * 0.028) % 1);
    this.waterfallTex.offset.y = (time * 1.35) % 1;
    this.basinFoamRing.material.opacity = 0.46 + Math.sin(time * 2.4) * 0.08;
    this.splashFoamMesh.material.opacity = 0.66 + Math.sin(time * 5.8) * 0.12;

    // Central Harmonic Seed Gimbal
    const cUd = this.centerSeedGroup.userData;
    const spinBoost = status === 'won' ? 3.4 : 1 + pressure * 1.4;
    cUd.gimbal1.rotation.set(time * 1.1 * spinBoost, time * 0.8 * spinBoost, 0);
    cUd.gimbal2.rotation.set(0, time * 1.4 * spinBoost, time * 1.1 * spinBoost);
    cUd.seedCore.rotation.set(time * 1.6, time * 2.3, 0);
    cUd.seedCore.scale.setScalar(status === 'won' ? 1.32 + Math.sin(time * 10) * 0.08 : 1.0 + pressure * 0.15);
    this.seedCoreMat.emissive.set(status === 'failed' ? '#f43f5e' : status === 'won' ? '#fde047' : '#22d3ee');
    cUd.seedHalo.material.color.set(status === 'failed' ? '#fb7185' : status === 'won' ? '#fef08a' : '#5efce8');
    cUd.seedHalo.scale.setScalar(1.0 + pressure * 0.35 + Math.sin(time * 4.2) * 0.08);

    // Flickering Antique-Bronze Flame & Ember Braziers flanking the Vault
    if (this.brazierEmberMat) {
      this.brazierEmberMat.emissiveIntensity = 1.45 + Math.sin(time * 11.2) * 0.22;
    }
    if (this.brazierFlames) {
      for (let i = 0; i < this.brazierFlames.length; i++) {
        const bf = this.brazierFlames[i];
        const fA = Math.sin(time * 9.5 + i * 2.4) * 0.12 + Math.cos(time * 14.7 + i) * 0.06;
        const fB = Math.sin(time * 13.1 + i * 3.1) * 0.14;
        bf.fOut.position.set(bf.sx + Math.sin(time * 6.0 + i) * 0.025, WATER_Y + 1.46 + fA * 0.12, 0.72);
        bf.fOut.scale.set(0.95 + fB * 0.28, 1.0 + fA * 0.55, 1);
        bf.fIn.position.set(bf.sx - Math.sin(time * 7.5 + i) * 0.018, WATER_Y + 1.38 + fB * 0.09, 0.75);
        bf.fIn.scale.set(0.88 - fA * 0.22, 0.96 + fB * 0.45, 1);
      }
    }

    // Strike Gems nested inside Carved Antique-Bronze Hexagonal Sockets (`maxStrikes` remaining indicator)
    const maxS = Math.min(MAX_STRIKE_GEMS, vault.maxStrikes || 3);
    const strikes = vault.strikes || 0;
    for (let i = 0; i < MAX_STRIKE_GEMS; i++) {
      const slot = this.strikeGems[i];
      if (i >= maxS) {
        slot.visible = false;
        continue;
      }
      slot.visible = true;
      slot.position.x = (i - (maxS - 1) * 0.5) * 0.46;
      slot.userData.gem.rotation.y = time * 2.0 + i;
      const used = i < strikes;
      slot.userData.mat.color.set(used ? '#e11d48' : '#0ea5e9');
      slot.userData.mat.emissive.set(used ? '#9f1239' : '#0284c7');
    }

    // Aspect-safe Heroic Camera Push-In as Rings Lock (`0 -> 1 -> 2 -> won`)
    // Guarantees all 3 concentric rings (R = 2.68) stay 100% inside safe-zone on 412x915 Portrait & 1920x1080 Desktop!
    const aspect = this.width / Math.max(1, this.height);
    const halfFovTan = Math.tan(this.camera.fov * 0.5 * (Math.PI / 180));
    const needHalfW = 2.85 / 0.72;
    const portraitZ = needHalfW / Math.max(0.28, halfFovTan * aspect);
    const baseZ = aspect < 0.85 ? clamp(portraitZ, 9.6, 12.2) : aspect < 1.15 ? 8.2 : 7.55;
    const pushZ = baseZ - pressure * 0.55 - (status === 'won' ? 0.30 : 0);
    const sh = (Number(state.shake) || 0) * 0.02;
    const sx = sh > 0.001 ? Math.sin(time * 73) * sh : 0;
    const sy = sh > 0.001 ? Math.cos(time * 61) * sh : 0;
    this.camera.position.set(Math.sin(time * 0.35) * 0.14 + sx, 0.15 + sy, pushZ);
    this.camera.lookAt(0, 0.05, 0);

    // Billboarded Soft Radial Water-Droplet & Golden Pollen Motes
    const dm = this._dummy;
    const camQ = this.camera.quaternion;
    for (let i = 0; i < MAX_MOTES; i++) {
      const mx = Math.sin(i * 2.3 + time * 0.4) * 3.7;
      const my = WATER_Y + 0.2 + ((i * 0.17 + time * 0.52) % 6.4);
      const mz = Math.cos(i * 1.9 + time * 0.35) * 1.8 + 0.55;
      dm.position.set(mx, my, mz);
      dm.quaternion.copy(camQ);
      dm.scale.setScalar(0.65 + Math.sin(time * 3.8 + i) * 0.28);
      dm.updateMatrix();
      this.moteInst.setMatrixAt(i, dm.matrix);
    }
    this.moteInst.count = MAX_MOTES;
    this.moteInst.instanceMatrix.needsUpdate = true;

    this.webgl.setRenderTarget(null);
    this.webgl.render(this.scene, this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._flatNormalTex?.dispose();
    this._stonePlaceholder?.dispose();
    this._bronzePlaceholder?.dispose();
    this._vaultDoorPlaceholder?.dispose();
    this.waterAlbedoTex?.dispose();
    this.waterNormalTex?.dispose();
    this.shoreFoamTex?.dispose();
    this.waterfallTex?.dispose();
    this.sunbeamTex?.dispose();
    this.runeRingTex?.dispose();
    this.moteGlowTex?.dispose();
    for (const t of this._loadedTextures) t.dispose();
    this._loadedTextures.length = 0;
  }
}

export { VaultRenderer as SanctumVaultRenderer };
export default VaultRenderer;
