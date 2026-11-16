// Tower architecture & props, built with the same care as Pogo:
//  * the tower is made of individually cut, bevelled stone blocks (instanced) in staggered
//    courses over a dark mortar core, with stone string-courses and a crenellated crown
//  * ledges are chunky bevelled stone steps with carved corbels and an inlaid glow line;
//    every ledge type has its own material language (cracked/glowing crumble, real ice,
//    metal conveyor treads, energy blocks)
//  * doors are carved stone archways framing a swirling black-hole portal (shader);
//    the exit is gilded, secret vaults are violet
//  * lifts run in a track recessed into the wall, on a metal hover platform with thrusters
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLS } from './levels.js';
import { createLedgeStoneMaterial, createBrickMaterial } from './materials.js';

export const TOWER_RADIUS = 2.55;
const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;

// Curved slab hugging the tower: annular sector centred on +Z, top face at y = 0
export function arcSlab(r0, r1, span, height, bevel = 0.025, curveSegments = 6, bevelSegments = 3) {
  const a0 = -span / 2 - Math.PI / 2;
  const a1 = span / 2 - Math.PI / 2;
  const shape = new THREE.Shape();
  shape.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
  shape.absarc(0, 0, r1, a0, a1, false);
  shape.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
  shape.absarc(0, 0, r0, a1, a0, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -height + bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

const polar = (a, r) => [r * Math.sin(a), r * Math.cos(a)];

// ---------------------------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------------------------
function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Glowing fissures for crumbling stone (used as emissive map)
  const cracks = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.shadowColor = '#fff';
    g.shadowBlur = 6;
    for (let k = 0; k < 7; k++) {
      let x = rnd() * w;
      let y = rnd() * h;
      g.lineWidth = 1.5 + rnd() * 2.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 9; s++) {
        x += (rnd() - 0.5) * 60;
        y += (rnd() - 0.3) * 40;
        g.lineTo(x, y);
        if (rnd() < 0.25) {
          g.moveTo(x, y);
        }
      }
      g.stroke();
    }
  });
  // Frost for ice
  const frost = canvasTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e0f7ff');
    gr.addColorStop(1, '#a5dcf5');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.5})`;
      const s = 1 + rnd() * 3;
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1;
    for (let k = 0; k < 40; k++) {
      const x = rnd() * w;
      const y = rnd() * h;
      g.beginPath();
      for (let a = 0; a < 6; a++) {
        g.moveTo(x, y);
        g.lineTo(x + Math.cos((a * Math.PI) / 3) * 9, y + Math.sin((a * Math.PI) / 3) * 9);
      }
      g.stroke();
    }
  });
  const tread = (dir) =>
    canvasTex(
      128,
      64,
      (g, w, h) => {
        g.fillStyle = '#1f2937';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) {
          g.fillStyle = '#374151';
          g.fillRect(x, 0, 14, h);
          g.strokeStyle = '#fbbf24';
          g.lineWidth = 6;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x + 10 - 6 * dir, 14);
          g.lineTo(x + 10 + 6 * dir, 32);
          g.lineTo(x + 10 - 6 * dir, 50);
          g.stroke();
        }
      },
      { repeat: [4, 1] }
    );
  const hazard = canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = '#facc15';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#111827';
    for (let x = -h; x < w; x += 24) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 12, h);
      g.lineTo(x + 12 + h, 0);
      g.lineTo(x + h, 0);
      g.fill();
    }
  });
  const runes = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff';
    g.lineWidth = 5;
    g.shadowColor = '#fff';
    g.shadowBlur = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath();
    g.arc(w / 2, h / 2, 22, 0, TWO_PI);
    g.moveTo(w / 2, 26);
    g.lineTo(w / 2, h - 26);
    g.moveTo(26, h / 2);
    g.lineTo(w - 26, h / 2);
    g.stroke();
  });
  TEX = { cracks, frost, treadR: tread(1), treadL: tread(-1), hazard, runes };
  return TEX;
}

export function animateConveyorTextures(time) {
  if (!TEX) return;
  TEX.treadR.offset.x = -(time * 1.2) % 1;
  TEX.treadL.offset.x = (time * 1.2) % 1;
}

// ---------------------------------------------------------------------------------------------
// Black-hole portal shader
// ---------------------------------------------------------------------------------------------
function createPortalMaterial(glow, glow2) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      glow: { value: new THREE.Color(glow) },
      glow2: { value: new THREE.Color(glow2) },
      pull: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 glow;
      uniform vec3 glow2;
      uniform float pull;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = (vUv - vec2(0.5, 0.44)) * vec2(1.0, 0.82);
        float r = length(p);
        float a = atan(p.y, p.x);
        // spiral arms wound tighter toward the centre, rotating inward
        float swirl = a * 2.0 + 1.6 / (r + 0.05) - time * 2.2 * pull;
        float arms = 0.5 + 0.5 * sin(swirl);
        float arms2 = 0.5 + 0.5 * sin(swirl * 2.0 + 1.3);
        float disk = smoothstep(0.55, 0.12, r);
        // event horizon: pure black core, bright photon ring just outside it
        float core = smoothstep(0.13, 0.085, r);
        float ring = exp(-pow((r - 0.135) / 0.022, 2.0));
        // sparkles being pulled in
        vec2 sp = vec2(swirl * 1.3, r * 18.0);
        float spark = step(0.985, hash(floor(sp))) * smoothstep(0.5, 0.18, r);
        vec3 col = glow * disk * (0.25 + 0.75 * pow(arms, 3.0)) * 1.6;
        col += glow2 * disk * pow(arms2, 6.0) * 0.8;
        col += mix(glow, vec3(1.0), 0.5) * ring * 2.2;
        col += vec3(1.0) * spark * 1.5;
        col *= 1.0 - core;
        // dark rim toward the arch edge so it reads as a hole in the wall
        float edge = smoothstep(0.62, 0.42, r);
        col *= edge;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// Arch-shaped geometry (rectangle with a semicircular top), UVs normalised to the bounding box
function archGeometry(w, h) {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const g = new THREE.ShapeGeometry(s, 24);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + r) / w, pos.getY(i) / h);
  uv.needsUpdate = true;
  return g;
}

// ---------------------------------------------------------------------------------------------
// Shared materials per tower palette
// ---------------------------------------------------------------------------------------------
export function createPropMaterials(pal, chromeEnv) {
  const T = textures();
  // Ledges: the same bright polished-steel step on every tower, so they pop against any brick
  const mats = {
    ledgeSteel: new THREE.MeshStandardMaterial({ color: '#dfe4ec', metalness: 0.82, roughness: 0.24, envMap: chromeEnv, envMapIntensity: 1.15 }),
    ledgeGroove: new THREE.MeshStandardMaterial({ color: '#2a2f38', metalness: 0.7, roughness: 0.45, envMap: chromeEnv, envMapIntensity: 0.6 }),
    corbel: new THREE.MeshStandardMaterial({ color: '#8b929e', metalness: 0.8, roughness: 0.38, envMap: chromeEnv, envMapIntensity: 0.9 }),
    // Crumbling ledge: rusted, cracked steel with heat glowing through the cracks
    crumble: new THREE.MeshStandardMaterial({
      color: '#a8603a',
      metalness: 0.45,
      roughness: 0.72,
      envMap: chromeEnv,
      envMapIntensity: 0.5,
      emissive: '#ff7a1a',
      emissiveIntensity: 0.9,
    }),
    ice: new THREE.MeshPhysicalMaterial({
      color: '#cdefff',
      map: T.frost,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.86,
      emissive: '#38bdf8',
      emissiveIntensity: 0.18,
    }),
    iceTop: new THREE.MeshStandardMaterial({ color: '#f0fbff', map: T.frost, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: '#4b5563', metalness: 0.85, roughness: 0.32, envMap: chromeEnv }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.8, roughness: 0.4, envMap: chromeEnv }),
    treadR: new THREE.MeshStandardMaterial({ map: T.treadR, metalness: 0.4, roughness: 0.6 }),
    treadL: new THREE.MeshStandardMaterial({ map: T.treadL, metalness: 0.4, roughness: 0.6 }),
    hazard: new THREE.MeshStandardMaterial({ map: T.hazard, roughness: 0.5 }),
    gold: new THREE.MeshStandardMaterial({ color: '#f5c542', metalness: 1, roughness: 0.25, envMap: chromeEnv, emissive: '#7c4a03', emissiveIntensity: 0.25 }),
    violet: new THREE.MeshStandardMaterial({ color: '#a78bfa', metalness: 0.6, roughness: 0.3, envMap: chromeEnv, emissive: '#6d28d9', emissiveIntensity: 0.6 }),
    archBrick: createBrickMaterial('#ffffff', {}), // coloured by buildTowerBody (the tower's own brick)
    sillStone: createLedgeStoneMaterial(new THREE.Color('#c9c4bb').multiplyScalar(1.5), {}),
    recess: new THREE.MeshBasicMaterial({ color: '#020308' }),
    liftDeck: new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.28, envMap: chromeEnv }),
    liftGlow: new THREE.MeshStandardMaterial({ color: '#86efac', emissive: '#22c55e', emissiveIntensity: 2.0 }),
    spring: new THREE.MeshStandardMaterial({ color: '#4ade80', metalness: 0.55, roughness: 0.3, envMap: chromeEnv, envMapIntensity: 0.9, emissive: '#14532d', emissiveIntensity: 0.4 }),
    thrusterGlow: new THREE.MeshBasicMaterial({ color: '#bbf7d0', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  mats.crumble.emissiveMap = T.cracks;
  mats.crumble.needsUpdate = true;
  mats.stoneList = [mats.archBrick, mats.sillStone];
  return mats;
}

// ---------------------------------------------------------------------------------------------
// Ledges
// ---------------------------------------------------------------------------------------------
let LGEO = null;
function ledgeGeos() {
  if (LGEO) return LGEO;
  const R = TOWER_RADIUS;
  const span = COL_ANGLE * 0.93;
  LGEO = {
    // rounded "drum" step: big bevel = rolled front edge that catches a bright highlight
    slab: arcSlab(R - 0.02, R + 0.73, COL_ANGLE * 0.8, 0.26, 0.085, 12, 4),
    groove: arcSlab(R + 0.2, R + 0.825, COL_ANGLE * 0.86, 0.022, 0.006, 12, 1),
    corbel: arcSlab(R - 0.06, R + 0.3, COL_ANGLE * 0.34, 0.2, 0.03, 4),
    corbel2: arcSlab(R - 0.06, R + 0.16, COL_ANGLE * 0.24, 0.12, 0.022, 4),
    crumbleSeg: arcSlab(R - 0.06, R + 0.8, span * 0.31, 0.26, 0.045, 4),
    iceSlab: arcSlab(R - 0.06, R + 0.82, span, 0.22, 0.06, 10),
    iceTop: arcSlab(R - 0.02, R + 0.8, span * 0.97, 0.05, 0.02, 10),
    convBase: arcSlab(R - 0.06, R + 0.82, span, 0.22, 0.03, 10),
    convTread: arcSlab(R + 0.02, R + 0.74, span * 0.98, 0.035, 0.008, 10),
    convHazard: arcSlab(R + 0.8, R + 0.835, span * 0.9, 0.08, 0.008, 10),
    roller: new THREE.CylinderGeometry(0.05, 0.05, 0.74, 10),
    icicle: new THREE.ConeGeometry(0.035, 0.24, 6),
    box: new RoundedBoxGeometry(0.72, 0.56, 0.6, 3, 0.07),
  };
  LGEO.icicle.translate(0, -0.12, 0);
  LGEO.icicle.rotateX(Math.PI);
  for (const geo of Object.values(LGEO)) geo.userData.shared = true;
  return LGEO;
}

export function buildLedge(l, pal, mats) {
  const G = ledgeGeos();
  const R = TOWER_RADIUS;
  const node = new THREE.Group();
  node.position.y = l.floor;
  node.rotation.y = (l.col + 0.5) * COL_ANGLE;
  const add = (geo, mat, y = 0, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = cast;
    m.receiveShadow = true;
    node.add(m);
    return m;
  };
  const corbels = () => {
    add(G.corbel, mats.corbel, -0.26);
    add(G.corbel2, mats.corbel, -0.46);
  };
  node.userData = { baseY: l.floor, type: l.type };

  if (l.type === 'box') {
    // Shootable energy block: rounded crate with glowing rune panels
    const boxMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#f97316',
      emissiveMap: textures().runes,
      emissiveIntensity: 1.4,
      metalness: 0.3,
      roughness: 0.35,
    });
    const crate = new THREE.Mesh(G.box, boxMat);
    crate.position.set(0, 0.28, R + 0.36);
    crate.castShadow = true;
    node.add(crate);
    node.userData.mainMat = boxMat;
  } else if (l.type === 'crumble') {
    // Three cracked stones with molten light leaking through the fissures
    for (const k of [-1, 0, 1]) {
      const seg = add(G.crumbleSeg, mats.crumble, 0);
      seg.rotation.y = k * COL_ANGLE * 0.31;
      seg.rotation.z = k * 0.02;
    }
    corbels();
    node.userData.mainMat = mats.crumble;
  } else if (l.type === 'ice') {
    add(G.iceSlab, mats.ice, -0.02);
    add(G.iceTop, mats.iceTop, 0.015);
    for (const k of [-0.34, -0.1, 0.12, 0.33]) {
      const ic = new THREE.Mesh(G.icicle, mats.ice);
      const [x, z] = polar(k * COL_ANGLE, R + 0.62 + (k > 0 ? 0.05 : 0));
      ic.position.set(x, -0.24, z);
      ic.scale.setScalar(0.7 + Math.abs(k) * 1.2);
      node.add(ic);
    }
  } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
    const dir = l.type === 'conveyorR' ? 1 : -1;
    add(G.convBase, mats.steelDark, -0.02);
    add(G.convTread, dir > 0 ? mats.treadR : mats.treadL, 0.015, false);
    add(G.convHazard, mats.hazard, -0.08, false);
    // end rollers
    for (const k of [-0.47, 0.47]) {
      const holder = new THREE.Group();
      holder.rotation.y = k * COL_ANGLE * 0.93;
      const rol = new THREE.Mesh(G.roller, mats.steel);
      rol.rotation.x = Math.PI / 2;
      rol.position.set(0, -0.08, R + 0.38);
      holder.add(rol);
      node.add(holder);
    }
    corbels();
  } else {
    // Solid: polished steel drum step with a dark seam round its middle, steel bracket below
    add(G.slab, mats.ledgeSteel, 0);
    add(G.groove, mats.ledgeGroove, -0.118, false);
    corbels();
  }
  return node;
}

// ---------------------------------------------------------------------------------------------
// Doors: carved stone archway + black-hole portal
// ---------------------------------------------------------------------------------------------
let DGEO = null;
function doorGeos() {
  if (DGEO) return DGEO;
  DGEO = {
    pillar: new RoundedBoxGeometry(0.17, 0.27, 0.2, 2, 0.035),
    voussoir: new RoundedBoxGeometry(0.15, 0.13, 0.2, 2, 0.03),
    keystone: new RoundedBoxGeometry(0.17, 0.2, 0.24, 2, 0.04),
    sill: new RoundedBoxGeometry(0.86, 0.08, 0.3, 2, 0.03),
    portal: archGeometry(0.56, 0.84),
    recess: archGeometry(0.62, 0.9),
    mote: new THREE.OctahedronGeometry(0.03, 0),
  };
  for (const geo of Object.values(DGEO)) geo.userData.shared = true;
  return DGEO;
}

export function buildDoor(door, pal, mats, softDotTex) {
  const G = doorGeos();
  const R = TOWER_RADIUS;
  const g = new THREE.Group();
  g.rotation.y = (door.col + 0.5) * COL_ANGLE;
  g.position.y = door.floor;
  const kind = door.isExit ? 'exit' : door.vault ? 'vault' : 'tunnel';
  const glow = kind === 'exit' ? '#ffb020' : kind === 'vault' ? '#b26bff' : pal.glow;
  const glow2 = kind === 'exit' ? '#fff3b0' : kind === 'vault' ? '#ff7ad9' : '#ffffff';
  const frameMat = mats.archBrick;

  const z = R + 0.02;
  const recess = new THREE.Mesh(G.recess, mats.recess);
  recess.position.set(0, 0.02, z - 0.01);
  const portalMat = createPortalMaterial(glow, glow2);
  const portal = new THREE.Mesh(G.portal, portalMat);
  portal.position.set(0, 0.04, z);
  g.add(recess, portal);

  // Pillars
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const st = new THREE.Mesh(G.pillar, frameMat);
      st.position.set(side * 0.37, 0.14 + k * 0.28, z + 0.06);
      st.rotation.y = side * 0.04;
      st.castShadow = true;
      g.add(st);
    }
  }
  // Arch voussoirs around the semicircle + keystone
  const archR = 0.37;
  const archY = 0.84 - 0.28;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * Math.PI;
    const isKey = i === (n - 1) / 2;
    const st = new THREE.Mesh(isKey ? G.keystone : G.voussoir, isKey ? mats.sillStone : frameMat);
    st.position.set(Math.cos(a) * archR, archY + Math.sin(a) * archR, z + 0.06);
    st.rotation.z = a - Math.PI / 2;
    st.castShadow = true;
    g.add(st);
  }
  const sill = new THREE.Mesh(G.sill, mats.sillStone);
  sill.position.set(0, -0.02, z + 0.08);
  sill.receiveShadow = true;
  g.add(sill);
  // Keystone gem
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.05, 0),
    new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.4 })
  );
  gem.position.set(0, archY + archR, z + 0.19);
  g.add(gem);

  // Motes drifting into the portal
  const motes = [];
  const moteMat = new THREE.SpriteMaterial({ map: softDotTex, color: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < (kind === 'exit' ? 10 : 6); i++) {
    const m = new THREE.Sprite(moteMat);
    m.scale.setScalar(0.07);
    m.userData = { a: Math.random() * TWO_PI, r: 0.35 + Math.random() * 0.25, sp: 0.6 + Math.random() * 0.8 };
    g.add(m);
    motes.push(m);
  }
  // Exit crown emblem floating above the arch
  let crown = null;
  if (kind === 'exit') {
    crown = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.07, 18, 1, true), mats.gold);
    crown.add(band);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), mats.gold);
      const a = (i / 5) * TWO_PI;
      sp.position.set(Math.cos(a) * 0.12, 0.07, Math.sin(a) * 0.12);
      crown.add(sp);
    }
    crown.position.set(0, 1.25, z + 0.15);
    g.add(crown);
  }

  const update = (time) => {
    portalMat.uniforms.time.value = time;
    gem.rotation.y = time * 1.5;
    for (const m of motes) {
      const u = m.userData;
      const k = (time * u.sp * 0.35 + u.a) % 1;
      const rr = u.r * (1 - k);
      m.position.set(Math.cos(u.a + k * 6) * rr, 0.48 + Math.sin(u.a + k * 6) * rr * 0.9, z + 0.04 + (1 - k) * 0.08);
      m.material.opacity = Math.sin(k * Math.PI);
    }
    if (crown) {
      crown.rotation.y = time * 1.2;
      crown.position.y = 1.25 + Math.sin(time * 2.4) * 0.05;
    }
  };
  return { group: g, update, portalMat };
}

// ---------------------------------------------------------------------------------------------
// Lifts: recessed wall track + metal hover platform
// ---------------------------------------------------------------------------------------------
export function buildLiftTrack(el, pal, mats) {
  const R = TOWER_RADIUS;
  const g = new THREE.Group();
  g.rotation.y = (el.col + 0.5) * COL_ANGLE;
  const y0 = el.minFloor - 0.45;
  const y1 = el.maxFloor + 0.95;
  const h = y1 - y0;
  // dark channel
  const channel = new THREE.Mesh(new THREE.BoxGeometry(0.62, h, 0.05), mats.recess);
  channel.position.set(0, y0 + h / 2, R - 0.01);
  g.add(channel);
  // rails
  for (const x of [-0.24, 0.24]) {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(0.06, h, 0.07, 2, 0.02), mats.steel);
    rail.position.set(x, y0 + h / 2, R + 0.04);
    rail.castShadow = true;
    g.add(rail);
  }
  // guide lights every half floor
  const lightGeo = new THREE.BoxGeometry(0.05, 0.05, 0.02);
  for (let y = y0 + 0.25; y < y1; y += 0.5) {
    for (const x of [-0.24, 0.24]) {
      const l = new THREE.Mesh(lightGeo, mats.liftGlow);
      l.position.set(x, y, R + 0.08);
      g.add(l);
    }
  }
  // stone end caps
  for (const y of [y0, y1]) {
    const cap = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.14, 0.22, 2, 0.04), mats.steel);
    cap.position.set(0, y, R + 0.06);
    cap.castShadow = true;
    g.add(cap);
  }
  return g;
}

export function buildLiftPod(el, pal, mats, softDotTex) {
  const R = TOWER_RADIUS;
  const pod = new THREE.Group();
  pod.rotation.y = (el.col + 0.5) * COL_ANGLE;
  const span = COL_ANGLE * 0.92;
  const deck = new THREE.Mesh(arcSlab(R + 0.02, R + 0.8, span * 0.92, 0.14, 0.05, 10, 3), mats.ledgeSteel);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const rim = new THREE.Mesh(arcSlab(R + 0.8, R + 0.85, span * 0.96, 0.04, 0.01, 10), mats.liftGlow);
  rim.position.y = -0.04;
  const under = new THREE.Mesh(arcSlab(R + 0.1, R + 0.7, span * 0.8, 0.08, 0.02, 8), mats.steelDark);
  under.position.y = -0.12;
  // bracket into the track
  const bracket = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.18, 0.2, 2, 0.03), mats.steelDark);
  bracket.position.set(0, -0.06, R + 0.04);
  pod.add(deck, rim, under, bracket);
  // chevrons on the deck
  const chevMat = new THREE.MeshStandardMaterial({ color: '#86efac', emissive: '#22c55e', emissiveIntensity: 1.6 });
  for (const dy of [-0.1, 0.1]) {
    const ch = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 3, Math.PI), chevMat);
    ch.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    ch.position.set(0, 0.006, R + 0.45 + dy);
    pod.add(ch);
  }
  // hover thrusters
  const glows = [];
  for (const k of [-0.25, 0.25]) {
    const [x, z] = polar(k * span, R + 0.42);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 12), mats.steel);
    nozzle.position.set(x, -0.2, z);
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: softDotTex, color: '#86efac', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    flame.position.set(x, -0.3, z);
    flame.scale.set(0.22, 0.34, 1);
    pod.add(nozzle, flame);
    glows.push(flame);
  }
  pod.userData = {
    update(time) {
      const p = 0.8 + Math.sin(time * 30) * 0.15;
      for (const f of glows) {
        f.scale.set(0.2 * p, 0.34 * p, 1);
        f.material.opacity = 0.7 + Math.sin(time * 41) * 0.15;
      }
      chevMat.emissiveIntensity = 1.2 + Math.sin(time * 4) * 0.6;
    },
  };
  return pod;
}

// ---------------------------------------------------------------------------------------------
// Tower body: a brick tower. Every tower is a bold single-colour brick cylinder (the colour is the
// tower's identity, like the classic): running bond, four courses per floor, real bevelled bricks
// with per-brick colour variation, recessed mortar, steel ledges, black openings, battlements.
// ---------------------------------------------------------------------------------------------
// brick / alt: the two clay colours a tower's bricks vary between; vary: ±value variation;
// burnt: share of over-fired darker bricks; mortar: joint colour; seamGlow: light in the joints
export const TOWER_STYLES = {
  redbrick: { brick: '#b23a22', alt: '#9a2f1c', mortar: '#4a2c26', vary: 0.09, burnt: 0.06 },
  royal: { brick: '#2d48c4', alt: '#3a37b0', mortar: '#1a1f4a', vary: 0.08, burnt: 0.04, ironBands: true },
  moss: { brick: '#4f8a3a', alt: '#6b8536', mortar: '#26321e', vary: 0.09, burnt: 0.05, moss: true },
  ice: { brick: '#9fcde9', alt: '#c4e4f5', mortar: '#5d84a0', vary: 0.06, frosted: true, seamGlow: 0.08, seamColor: '#7dd3fc' },
  terracotta: { brick: '#cf6a2e', alt: '#b9552a', mortar: '#5c3622', vary: 0.09, burnt: 0.07, missing: 0.03 },
  seabrick: { brick: '#23857f', alt: '#1e6f7a', mortar: '#173d3c', vary: 0.08, burnt: 0.04, barnacles: true },
  charcoal: { brick: '#45414a', alt: '#35323a', mortar: '#2b1a12', vary: 0.1, burnt: 0.08, seamGlow: 0.2, seamColor: '#ff5a14' },
  amethyst: { brick: '#62329a', alt: '#7440a8', mortar: '#2a1838', vary: 0.08, burnt: 0.04, crystals: true, seamGlow: 0.24, seamColor: '#f5c542' },
};
const STYLE_BY_TOWER = { 1: 'redbrick', 2: 'royal', 3: 'moss', 4: 'ice', 5: 'terracotta', 6: 'seabrick', 7: 'charcoal', 8: 'amethyst' };
export function towerStyleName(tower) {
  if (tower.style && TOWER_STYLES[tower.style]) return tower.style;
  if (STYLE_BY_TOWER[tower.id]) return STYLE_BY_TOWER[tower.id];
  const keys = Object.keys(TOWER_STYLES);
  return keys[Math.abs((tower.seed ?? tower.id ?? 0) | 0) % keys.length];
}

const BRICKS_AROUND = 32; // ~0.5 wide
const COURSE_H = 0.25; // 4 courses per floor
const BRICK_PROUD = 0.055; // how far a brick face stands out from the mortar
const BRICK_GAIN = 1.2; // instance colour gain (the clay texture is ~0.85 albedo)
const MERLONS = 16;

export function buildTowerBody(tower, pal, mats, softDotTex, chromeEnv = null) {
  const R = TOWER_RADIUS;
  const floors = tower.floors;
  const totalH = floors;
  const g = new THREE.Group();
  const styleName = towerStyleName(tower);
  const S = TOWER_STYLES[styleName];
  const brickCol = new THREE.Color(S.brick);
  const altCol = new THREE.Color(S.alt);

  // Mortar core: the joints between bricks (recessed, darker; on some towers lit from within).
  // The renderer drives emissiveIntensity (0.35 normally), so the glow strength lives in the colour.
  const seamEm = S.seamGlow ? new THREE.Color(S.seamColor).multiplyScalar(S.seamGlow / 0.35) : new THREE.Color('#000000');
  const coreMat = createLedgeStoneMaterial(new THREE.Color(S.mortar).multiplyScalar(1.5), { emissive: seamEm, emissiveIntensity: 0.35 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.035, R - 0.035, totalH + 0.2, 64, 1, false), coreMat);
  core.position.y = totalH / 2;
  core.receiveShadow = true;
  core.castShadow = true; // the tower's shadow comes from the core (bricks skip the shadow pass)
  g.add(core);

  // Openings (door arches, lift tracks): w = half-width in radians
  const holes = [];
  for (const d of tower.doors) holes.push({ a: (d.col + 0.5) * COL_ANGLE, w: 0.185, y0: d.floor - 0.02, y1: d.floor + 1.0 });
  for (const el of tower.elevators) holes.push({ a: (el.col + 0.5) * COL_ANGLE, w: 0.16, y0: el.minFloor - 0.45, y1: el.maxFloor + 0.95 });
  const angDist = (a, b) => {
    let d = (a - b) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return Math.abs(d);
  };

  const N = BRICKS_AROUND;
  const blockA = TWO_PI / N;
  // Behind each opening: a recessed panel of dark brick (shadowed niche, never a hole to the core)
  const plateMat = createBrickMaterial(brickCol.clone().multiplyScalar(0.42), { edgeDarken: 0.2 });
  for (const h of holes) {
    const span = 2 * (h.w + blockA * 0.5);
    const plate = new THREE.Mesh(arcSlab(R - 0.034, R + 0.008, span, h.y1 - h.y0 + 0.1, 0.01, 8), plateMat);
    plate.rotation.y = h.a;
    plate.position.y = h.y1 + 0.05;
    plate.receiveShadow = true;
    g.add(plate);
  }

  const brickGeo = arcSlab(R - 0.04, R + BRICK_PROUD, blockA * 0.94, COURSE_H - 0.03, 0.016, 3, 2);
  brickGeo.translate(0, COURSE_H - 0.03, 0); // bottom at y = 0
  const halfGeo = arcSlab(R - 0.04, R + BRICK_PROUD, blockA * 0.44, COURSE_H - 0.03, 0.016, 2, 2);
  halfGeo.translate(0, COURSE_H - 0.03, 0);
  const courses = Math.ceil(totalH / COURSE_H);
  const brickMat = createBrickMaterial('#ffffff', {});
  const inst = new THREE.InstancedMesh(brickGeo, brickMat, courses * N);
  const halfInst = new THREE.InstancedMesh(halfGeo, brickMat, courses * 8);
  inst.receiveShadow = halfInst.receiveShadow = true;
  inst.castShadow = halfInst.castShadow = false;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const moss = new THREE.Color('#5d8f2c');
  const frost = new THREE.Color('#f2faff');
  const col = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  let seed = (tower.id || 1) * 7717 + 3 + ((tower.seed | 0) % 9973);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const brickColour = (y) => {
    col.copy(brickCol).lerp(altCol, rnd() * rnd());
    col.multiplyScalar(BRICK_GAIN * (1 + (rnd() - 0.5) * 2 * S.vary));
    if (rnd() < (S.burnt || 0)) {
      col.multiplyScalar(0.68);
      col.getHSL(hsl);
      col.setHSL(hsl.h, hsl.s * 0.8, hsl.l);
    }
    col.getHSL(hsl);
    col.setHSL(hsl.h + (rnd() - 0.5) * 0.012, hsl.s, hsl.l);
    if (S.moss && rnd() < 0.1 + 0.22 * (1 - y / totalH)) col.lerp(moss, 0.25 + rnd() * 0.3);
    if (S.frosted) col.lerp(frost, 0.08 + rnd() * 0.22);
    return col;
  };
  const deco = []; // {kind, a, y}
  let n = 0;
  let hn = 0;
  for (let c = 0; c < courses; c++) {
    const y0 = c * COURSE_H;
    const yc = y0 + COURSE_H / 2;
    const stagger = (c % 2) * 0.5; // running bond
    const inHole = (a, halfSpan) => holes.some((h) => y0 + COURSE_H > h.y0 && y0 < h.y1 && angDist(a, h.a) < halfSpan + h.w);
    for (let b = 0; b < N; b++) {
      const a = (b + stagger) * blockA + (rnd() - 0.5) * 0.006;
      if (inHole(a, blockA * 0.47)) {
        // this brick would cut into an opening: lay the outer half-brick instead, if it fits
        for (const side of [-1, 1]) {
          const ha = a + side * blockA * 0.25;
          if (inHole(ha, blockA * 0.22) || hn >= courses * 8) continue;
          q.setFromEuler(e.set(0, ha, 0));
          m4.compose(pos.set(0, y0 + 0.015, 0), q, scl.set(1, 1, 1));
          halfInst.setMatrixAt(hn, m4);
          halfInst.setColorAt(hn, brickColour(yc));
          hn++;
        }
        continue;
      }
      if (S.missing && c > 4 && rnd() < S.missing) continue; // a few knocked-out bricks
      const out = 1 + (rnd() - 0.5) * 0.006;
      q.setFromEuler(e.set((rnd() - 0.5) * 0.008, a, (rnd() - 0.5) * 0.008));
      m4.compose(pos.set(0, y0 + 0.015, 0), q, scl.set(out, 1, out));
      inst.setMatrixAt(n, m4);
      inst.setColorAt(n, brickColour(yc));
      n++;
      if (S.moss && rnd() < 0.05 + 0.08 * (1 - yc / totalH)) deco.push({ kind: 'moss', a: a + (rnd() - 0.5) * blockA * 0.5, y: y0 + COURSE_H - 0.01 });
      if (S.barnacles && yc < Math.min(4.5, totalH * 0.3) && rnd() < 0.3 + 0.5 * (1 - yc / 4.5)) {
        deco.push({ kind: 'barnacle', a: a + (rnd() - 0.5) * blockA * 0.7, y: yc + (rnd() - 0.5) * COURSE_H * 0.6 });
      }
      if (S.crystals && rnd() < 0.025) deco.push({ kind: 'crystal', a: a + blockA * 0.5, y: y0 + COURSE_H });
    }
  }
  inst.count = n;
  halfInst.count = hn;
  for (const im of [inst, halfInst]) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  g.add(inst);
  if (hn) g.add(halfInst);

  // Door arches are laid in the tower's own brick
  if (mats.archBrick) mats.archBrick.color.copy(brickCol).multiplyScalar(BRICK_GAIN * 0.92);

  // Style decorations (instanced)
  const decoKinds = {
    moss: { geo: new THREE.SphereGeometry(0.06, 8, 5), mat: new THREE.MeshStandardMaterial({ color: '#4f8a2a', roughness: 1 }) },
    barnacle: { geo: new THREE.ConeGeometry(0.03, 0.045, 7, 1, true), mat: new THREE.MeshStandardMaterial({ color: '#d9d4c2', roughness: 0.9 }) },
    crystal: { geo: new THREE.OctahedronGeometry(0.07, 0), mat: new THREE.MeshStandardMaterial({ color: '#f0abfc', emissive: '#c026d3', emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.2 }) },
  };
  for (const [kind, K] of Object.entries(decoKinds)) {
    const list = deco.filter((d) => d.kind === kind);
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(K.geo, K.mat, list.length);
    let k = 0;
    for (const d of list) {
      const r = R + BRICK_PROUD + (kind === 'moss' ? -0.01 : 0.004);
      e.set(kind === 'barnacle' ? Math.PI / 2 : rnd() * 0.6, d.a, kind === 'crystal' ? (rnd() - 0.5) * 1.2 : 0);
      q.setFromEuler(e);
      const s = 0.7 + rnd() * 0.8;
      scl.set(s * (kind === 'moss' ? 1.8 : 1), s * (kind === 'moss' ? 0.4 : kind === 'crystal' ? 2.2 : 1), s);
      m4.compose(pos.set(Math.sin(d.a) * r, d.y, Math.cos(d.a) * r), q, scl);
      im.setMatrixAt(k++, m4);
    }
    im.count = k;
    im.castShadow = false;
    im.receiveShadow = true;
    g.add(im);
  }

  // Iron bands (royal tower): riveted iron hoops every 2 floors
  if (S.ironBands) {
    const ironMat = new THREE.MeshStandardMaterial({ color: '#4a4f58', metalness: 0.85, roughness: 0.4, envMap: chromeEnv, envMapIntensity: 0.8 });
    const segA = TWO_PI / 16;
    const hoopGeo = arcSlab(R + BRICK_PROUD - 0.01, R + BRICK_PROUD + 0.05, segA * 1.002, 0.12, 0.015, 6);
    const rivetGeo = new THREE.SphereGeometry(0.022, 8, 6);
    const rivetMat = new THREE.MeshStandardMaterial({ color: '#b8b2aa', metalness: 0.9, roughness: 0.3, envMap: chromeEnv });
    const ys = [];
    for (let f = 2; f < floors; f += 2) ys.push(f - 0.5);
    const hoops = new THREE.InstancedMesh(hoopGeo, ironMat, ys.length * 16);
    const rivets = new THREE.InstancedMesh(rivetGeo, rivetMat, ys.length * 16 * 2);
    let hc = 0;
    let rc = 0;
    for (const y of ys) {
      for (let b = 0; b < 16; b++) {
        const a = (b + 0.5) * segA;
        if (holes.some((h) => y + 0.06 > h.y0 && y - 0.06 < h.y1 && angDist(a, h.a) < segA * 0.5 + h.w)) continue;
        q.setFromEuler(e.set(0, a, 0));
        m4.compose(pos.set(0, y + 0.06, 0), q, scl.set(1, 1, 1));
        hoops.setMatrixAt(hc++, m4);
        for (const da of [-0.3, 0.3]) {
          const aa = a + da * segA;
          const rr = R + BRICK_PROUD + 0.052;
          m4.compose(pos.set(Math.sin(aa) * rr, y, Math.cos(aa) * rr), q.identity(), scl.set(1, 1, 1));
          rivets.setMatrixAt(rc++, m4);
        }
      }
    }
    hoops.count = hc;
    rivets.count = rc;
    hoops.receiveShadow = true;
    g.add(hoops, rivets);
  }

  // Crown: stone coping, brick parapet and battlements (merlons), and a brazier
  const copingMat = createLedgeStoneMaterial(new THREE.Color('#c9c4bb').multiplyScalar(1.5), {});
  const crownBrickMat = createBrickMaterial(brickCol.clone().multiplyScalar(BRICK_GAIN * 0.95), {});
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.11, R + 0.02, 0.14, 64), copingMat);
  cap.position.y = totalH + 0.07;
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);
  const segA = TWO_PI / MERLONS;
  const parapetGeo = arcSlab(R - 0.12, R + 0.1, segA * 0.995, 0.34, 0.02, 6);
  const merlonGeo = arcSlab(R - 0.12, R + 0.1, segA * 0.56, 0.32, 0.025, 4);
  const merlonCapGeo = arcSlab(R - 0.14, R + 0.13, segA * 0.62, 0.06, 0.015, 4);
  const parapetInst = new THREE.InstancedMesh(parapetGeo, crownBrickMat, MERLONS);
  const merlonInst = new THREE.InstancedMesh(merlonGeo, crownBrickMat, MERLONS);
  const merlonCapInst = new THREE.InstancedMesh(merlonCapGeo, copingMat, MERLONS);
  for (let b = 0; b < MERLONS; b++) {
    q.setFromEuler(e.set(0, b * segA, 0));
    m4.compose(pos.set(0, totalH + 0.14 + 0.34, 0), q, scl.set(1, 1, 1));
    parapetInst.setMatrixAt(b, m4);
    m4.compose(pos.set(0, totalH + 0.48 + 0.32, 0), q, scl);
    merlonInst.setMatrixAt(b, m4);
    m4.compose(pos.set(0, totalH + 0.8 + 0.06, 0), q, scl);
    merlonCapInst.setMatrixAt(b, m4);
  }
  for (const im of [parapetInst, merlonInst, merlonCapInst]) {
    im.castShadow = true;
    im.receiveShadow = true;
  }
  g.add(parapetInst, merlonInst, merlonCapInst);
  // Brazier
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.3, 20), mats.steelDark);
  bowl.position.y = totalH + 0.3;
  g.add(bowl);
  const flames = [];
  for (let i = 0; i < 4; i++) {
    const fl = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: softDotTex, color: i % 2 ? pal.glow : '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    fl.position.y = totalH + 0.6;
    g.add(fl);
    flames.push(fl);
  }

  // Stone plinth rising out of the sea
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.14, R + 0.45, 1.6, 64),
    createLedgeStoneMaterial(new THREE.Color('#6b6f78').multiplyScalar(1.2), {})
  );
  plinth.position.y = -0.8;
  plinth.receiveShadow = true;
  g.add(plinth);

  const update = (time) => {
    flames.forEach((f, i) => {
      const k = (time * 1.4 + i * 0.25) % 1;
      f.position.y = totalH + 0.5 + k * 0.9;
      f.scale.setScalar((0.9 - k * 0.6) * (1 + Math.sin(time * 13 + i) * 0.1));
      f.material.opacity = Math.sin(k * Math.PI) * 0.9;
    });
  };
  return {
    group: g,
    update,
    coreMat,
    styleName,
    stoneMats: [coreMat, copingMat, plinth.material, brickMat, plateMat, crownBrickMat],
  };
}
