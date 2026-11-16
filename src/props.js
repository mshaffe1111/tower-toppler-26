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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLS } from './levels.js';
import { createLedgeStoneMaterial, createBrickMaterial } from './materials.js';

export const TOWER_RADIUS = 2.55;
const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;

// Curved slab hugging the tower: annular sector centred on +Z, top face at y = 0, spanning
// y = -height..0. NOTE: the bevel grows the footprint by `bevel` on every side. `corner` rounds the
// four vertical edges (world units) so the ends catch light too.
export function arcSlab(r0, r1, span, height, bevel = 0.025, curveSegments = 6, bevelSegments = 3, corner = 0) {
  const a0 = -span / 2 - Math.PI / 2;
  const a1 = span / 2 - Math.PI / 2;
  const shape = new THREE.Shape();
  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  if (corner > 0) {
    const c = Math.min(corner, (r1 - r0) * 0.45, ((r0 * span) / 2) * 0.9);
    const o0 = c / r1;
    const i0 = c / r0;
    shape.moveTo(...P(r1, a0 + o0));
    shape.absarc(0, 0, r1, a0 + o0, a1 - o0, false);
    shape.quadraticCurveTo(...P(r1, a1), ...P(r1 - c, a1));
    shape.lineTo(...P(r0 + c, a1));
    shape.quadraticCurveTo(...P(r0, a1), ...P(r0, a1 - i0));
    shape.absarc(0, 0, r0, a1 - i0, a0 + i0, true);
    shape.quadraticCurveTo(...P(r0, a0), ...P(r0 + c, a0));
    shape.lineTo(...P(r1 - c, a0));
    shape.quadraticCurveTo(...P(r1, a0), ...P(r1, a0 + o0));
  } else {
    shape.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
    shape.absarc(0, 0, r1, a0, a1, false);
    shape.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
    shape.absarc(0, 0, r0, a1, a0, true);
  }
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
  // Limestone: pale stone with soft mottling and a dotted speckle (the classic ledge stone)
  const limestoneDraw = (g, w, h) => {
    g.fillStyle = '#f1ede4';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 10 + rnd() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() < 0.55;
      gr.addColorStop(0, dark ? `rgba(120,108,86,${0.08 + rnd() * 0.1})` : `rgba(255,252,244,${0.1 + rnd() * 0.15})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
    }
    for (let i = 0; i < 2600; i++) {
      const d = rnd();
      g.fillStyle = d < 0.75 ? `rgba(78,68,52,${0.25 + rnd() * 0.45})` : `rgba(255,255,250,${0.4 + rnd() * 0.5})`;
      const sz = rnd() < 0.85 ? 1 : 2;
      g.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), sz, sz);
    }
  };
  const limestone = canvasTex(256, 256, limestoneDraw, { repeat: [2.2, 2.2] });
  const crackedStone = canvasTex(
    256,
    256,
    (g, w, h) => {
      limestoneDraw(g, w, h);
      g.strokeStyle = 'rgba(40,30,20,0.85)';
      g.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        let x = rnd() * w;
        let y = rnd() * h;
        g.lineWidth = 1.2 + rnd() * 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let s2 = 0; s2 < 8; s2++) {
          x += (rnd() - 0.5) * 50;
          y += (rnd() - 0.3) * 36;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
    { repeat: [2.2, 2.2] }
  );
  for (const t of [cracks]) t.repeat.set(2.2, 2.2);
  TEX = { cracks, frost, treadR: tread(1), treadL: tread(-1), hazard, runes, limestone, crackedStone };
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
      aspect: { value: DOOR_H / DOOR_W },
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
      uniform float aspect;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        // the opening is DOOR_W wide x DOOR_H tall: scale y so the vortex is round in the world
        vec2 p = (vUv - vec2(0.5, 0.47)) * vec2(1.0, aspect);
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
        vec3 col = glow * disk * (0.06 + 0.7 * pow(arms, 4.0)) * 1.25;
        col += glow2 * disk * pow(arms2, 8.0) * 0.55;
        col += mix(glow, vec3(1.0), 0.5) * ring * 2.0;
        col += vec3(1.0) * spark * 1.5;
        col *= 1.0 - core;
        // fades to pure black well inside the opening so it reads as a hole in the wall
        float edge = smoothstep(0.5, 0.32, r);
        col *= edge;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ---------------------------------------------------------------------------------------------
// Shared materials per tower palette
// ---------------------------------------------------------------------------------------------
export function createPropMaterials(pal, chromeEnv) {
  const T = textures();
  // Ledges & lift discs: the same pale limestone on every tower (light cream tops, darker greige
  // speckled fronts), so they always stand out from the coloured brick
  const mats = {
    ledgeTop: new THREE.MeshStandardMaterial({ color: '#f3e9cf', map: T.limestone, roughness: 0.82, envMapIntensity: 0.55 }),
    ledgeFront: new THREE.MeshStandardMaterial({ color: '#bfb39b', map: T.limestone, roughness: 0.9, envMapIntensity: 0.55 }),
    // Crumbling ledge: the same stone, cracked through, heat glowing in the cracks
    crumble: new THREE.MeshStandardMaterial({ color: '#e2d3b0', map: T.crackedStone, roughness: 0.9, emissive: '#ff7a1a', emissiveIntensity: 0.9 }),
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
    recess: new THREE.MeshBasicMaterial({ color: '#010205' }),
    liftDisc: new THREE.MeshStandardMaterial({ color: '#e6dcc2', map: T.limestone, roughness: 0.85, envMapIntensity: 0.55 }),
    liftTop: new THREE.MeshStandardMaterial({ color: '#f6eed8', map: T.limestone, roughness: 0.8, envMapIntensity: 0.55 }),
  };
  mats.crumble.emissiveMap = T.cracks;
  mats.crumble.needsUpdate = true;
  mats.stoneList = [];
  return mats;
}

// ---------------------------------------------------------------------------------------------
// Ledges: stacked limestone slabs protruding from the wall (a lighter top course of three
// slabs over a darker course of four, laid like bricks)
// ---------------------------------------------------------------------------------------------
let LGEO = null;
function slabCourse(r0, r1, count, height, bevel, gapA, offset = 0) {
  const pieceA = (COL_ANGLE * 0.94 - gapA * (count - 1)) / count;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const g = arcSlab(r0, r1, pieceA, height, bevel, 5, 2);
    g.rotateY(-COL_ANGLE * 0.47 + pieceA / 2 + i * (pieceA + gapA) + offset);
    parts.push(g);
  }
  return mergeGeometries(parts);
}
function ledgeGeos() {
  if (LGEO) return LGEO;
  const R = TOWER_RADIUS;
  const span = COL_ANGLE * 0.93;
  LGEO = {
    top: slabCourse(R - 0.03, R + 0.78, 3, 0.11, 0.025, -0.004),
    body: (() => {
      const g = slabCourse(R - 0.03, R + 0.72, 4, 0.15, 0.022, -0.004);
      g.translate(0, -0.11, 0);
      return g;
    })(),
    crumbleTop: arcSlab(R - 0.03, R + 0.8, span * 0.31, 0.11, 0.025, 4, 2),
    crumbleBody: (() => {
      const g = arcSlab(R - 0.03, R + 0.74, span * 0.31, 0.15, 0.022, 4, 2);
      g.translate(0, -0.11, 0);
      return g;
    })(),
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
    // Three cracked limestone slabs with heat glowing through the fissures
    for (const k of [-1, 0, 1]) {
      const a = k * COL_ANGLE * 0.31;
      const top = add(G.crumbleTop, mats.crumble, 0);
      top.rotation.y = a;
      top.rotation.z = k * 0.02;
      const body = add(G.crumbleBody, mats.crumble, 0);
      body.rotation.y = a;
      body.rotation.z = k * 0.02;
    }
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
    for (const k of [-0.47, 0.47]) {
      const holder = new THREE.Group();
      holder.rotation.y = k * COL_ANGLE * 0.93;
      const rol = new THREE.Mesh(G.roller, mats.steel);
      rol.rotation.x = Math.PI / 2;
      rol.position.set(0, -0.08, R + 0.38);
      holder.add(rol);
      node.add(holder);
    }
  } else {
    // Solid: limestone slabs, pale top course over a darker speckled course
    add(G.top, mats.ledgeTop, 0);
    add(G.body, mats.ledgeFront, 0);
  }
  return node;
}

// ---------------------------------------------------------------------------------------------
// Doors: a plain tall black opening in the brickwork with the black-hole vortex inside.
// (The opening itself is cut by buildTowerBody; this adds the vortex, motes and exit emblem.)
// ---------------------------------------------------------------------------------------------
export const DOOR_W = 0.68; // world units across the opening
export const DOOR_H = 1.0; // floor to the top of the 4th brick course
let DGEO = null;
function doorGeos() {
  if (DGEO) return DGEO;
  DGEO = { portal: new THREE.PlaneGeometry(DOOR_W * 0.96, DOOR_H * 0.96) };
  DGEO.portal.translate(0, (DOOR_H * 0.96) / 2 + 0.02, 0);
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

  // set just behind the brick faces so the opening's edges are the bricks themselves
  const z = R - 0.012;
  const portalMat = createPortalMaterial(glow, glow2);
  const portal = new THREE.Mesh(G.portal, portalMat);
  portal.position.set(0, 0, z);
  g.add(portal);

  // Motes drifting into the vortex
  const motes = [];
  const moteMat = new THREE.SpriteMaterial({ map: softDotTex, color: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < (kind === 'exit' ? 10 : 6); i++) {
    const m = new THREE.Sprite(moteMat);
    m.scale.setScalar(0.07);
    m.userData = { a: Math.random() * TWO_PI, r: 0.22 + Math.random() * 0.12, sp: 0.6 + Math.random() * 0.8 };
    g.add(m);
    motes.push(m);
  }
  // Exit crown emblem floating above the opening
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
    crown.position.set(0, 1.25, R + 0.2);
    g.add(crown);
  }

  const update = (time) => {
    portalMat.uniforms.time.value = time;
    for (const m of motes) {
      const u = m.userData;
      const k = (time * u.sp * 0.35 + u.a) % 1;
      const rr = u.r * (1 - k);
      m.position.set(Math.cos(u.a + k * 6) * rr, 0.5 + Math.sin(u.a + k * 6) * rr, z + 0.03 + (1 - k) * 0.08);
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
// Lifts: a column of stacked limestone discs standing against the wall, with a wider disc
// platform on top that Pogo rides. The column grows and shrinks as the lift moves.
// ---------------------------------------------------------------------------------------------
const DISC_H = 0.16;
let LIFTGEO = null;
function liftGeos() {
  if (LIFTGEO) return LIFTGEO;
  // drum profile with rounded rims so a seam shows between stacked discs
  const prof = (r, h, e) => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r - e, 0),
    new THREE.Vector2(r - e * 0.3, e * 0.3),
    new THREE.Vector2(r, e),
    new THREE.Vector2(r, h - e),
    new THREE.Vector2(r - e * 0.3, h - e * 0.3),
    new THREE.Vector2(r - e, h),
    new THREE.Vector2(0, h),
  ];
  LIFTGEO = {
    disc: new THREE.LatheGeometry(prof(0.3, DISC_H, 0.03), 28),
    top: new THREE.LatheGeometry(prof(0.4, 0.13, 0.035), 32),
    base: new THREE.LatheGeometry(prof(0.38, 0.12, 0.03), 28),
  };
  for (const geo of Object.values(LIFTGEO)) geo.userData.shared = true;
  return LIFTGEO;
}

export function buildLiftTrack(el, pal, mats) {
  // The column's footing: a wider disc where it stands
  const R = TOWER_RADIUS;
  const G = liftGeos();
  const g = new THREE.Group();
  g.rotation.y = (el.col + 0.5) * COL_ANGLE;
  const base = new THREE.Mesh(G.base, mats.liftDisc);
  base.position.set(0, el.minFloor - 0.45, R + 0.42);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  return g;
}

export function buildLiftPod(el, pal, mats) {
  const R = TOWER_RADIUS;
  const G = liftGeos();
  const pod = new THREE.Group();
  pod.rotation.y = (el.col + 0.5) * COL_ANGLE;
  // Every shaft has a landing ledge at its top floor: the platform sits a hair below the ledge
  // top and inside its footprint, so at the top stop it docks into the ledge (no z-fighting)
  const top = new THREE.Mesh(G.top, mats.liftTop);
  top.position.set(0, -0.13 - 0.012, R + 0.42);
  top.castShadow = true;
  top.receiveShadow = true;
  pod.add(top);

  const bottom = el.minFloor - 0.45 + 0.12; // top of the footing disc
  const maxDiscs = Math.ceil((el.maxFloor - el.minFloor + 0.45) / DISC_H) + 1;
  const column = new THREE.InstancedMesh(G.disc, mats.liftDisc, maxDiscs);
  column.castShadow = true;
  column.receiveShadow = true;
  column.frustumCulled = false;
  pod.add(column);
  const m4 = new THREE.Matrix4();
  const layout = () => {
    // stack whole discs down from just under the platform to the footing
    const topY = pod.position.y - 0.13 - 0.012;
    const len = Math.max(0, topY - bottom);
    const count = Math.min(maxDiscs, Math.ceil(len / DISC_H));
    for (let i = 0; i < count; i++) {
      const y = topY - (i + 1) * DISC_H;
      m4.makeTranslation(0, Math.max(bottom, y) - pod.position.y, R + 0.42);
      column.setMatrixAt(i, m4);
    }
    column.count = count;
    column.instanceMatrix.needsUpdate = true;
  };
  let lastY = null;
  pod.userData = {
    update() {
      if (pod.position.y !== lastY) {
        lastY = pod.position.y;
        layout();
      }
    },
  };
  return pod;
}

// ---------------------------------------------------------------------------------------------
// Tower body: a brick tower, true to the 1987 original. Every tower is one bold, saturated brick
// colour (the colour IS the tower's identity), running bond, four courses per floor, each brick
// bevelled with a bright top-left edge and a dark bottom-right edge so it reads on its own.
// Openings are plain black rectangles; the crown is brick battlements.
// ---------------------------------------------------------------------------------------------
// brick / alt: the two clay colours bricks vary between; hi: the warm highlight tint on the lit
// bevels; vary: ±value variation per brick; burnt: share of over-fired darker bricks
export const TOWER_STYLES = {
  red: { brick: '#e2401c', alt: '#d03018', hi: '#ffc24d', mortar: '#3a120c', vary: 0.07, burnt: 0.03 },
  green: { brick: '#2fb43a', alt: '#27a232', hi: '#c8ff7a', mortar: '#0c2e10', vary: 0.07, burnt: 0.03 },
  blue: { brick: '#2c4fd6', alt: '#3341c4', hi: '#9fc4ff', mortar: '#0d1440', vary: 0.07, burnt: 0.03 },
  ice: { brick: '#a9d6f2', alt: '#c9e8fa', hi: '#ffffff', mortar: '#4f7590', vary: 0.05, burnt: 0, frosted: true },
  orange: { brick: '#e0702a', alt: '#cf5f22', hi: '#ffd27a', mortar: '#3d1a0a', vary: 0.07, burnt: 0.03 },
  teal: { brick: '#1f9e96', alt: '#1a8a8a', hi: '#9ff5e6', mortar: '#0a2a2a', vary: 0.07, burnt: 0.03, barnacles: true },
  magenta: { brick: '#a3207f', alt: '#8c1c78', hi: '#ff8ad8', mortar: '#2a0822', vary: 0.07, burnt: 0.03 },
  gold: { brick: '#d6a21e', alt: '#c48f18', hi: '#fff1a8', mortar: '#3a2a06', vary: 0.07, burnt: 0.02 },
};
const STYLE_BY_TOWER = { 1: 'red', 2: 'green', 3: 'blue', 4: 'ice', 5: 'orange', 6: 'teal', 7: 'magenta', 8: 'gold' };
export function towerStyleName(tower) {
  if (tower.style && TOWER_STYLES[tower.style]) return tower.style;
  if (STYLE_BY_TOWER[tower.id]) return STYLE_BY_TOWER[tower.id];
  const keys = Object.keys(TOWER_STYLES);
  return keys[Math.abs((tower.seed ?? tower.id ?? 0) | 0) % keys.length];
}

const BRICKS_AROUND = 32; // ~0.5 wide
const COURSE_H = 0.25; // 4 courses per floor
const BRICK_PROUD = 0.055; // how far a brick face stands out from the mortar
const BRICK_GAIN = 1.22; // instance colour gain (the clay texture is ~0.85 albedo)
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

  // Mortar core: the thin dark joints between bricks
  const coreMat = createLedgeStoneMaterial(new THREE.Color(S.mortar).multiplyScalar(1.6), {});
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.035, R - 0.035, totalH + 0.2, 64, 1, false), coreMat);
  core.position.y = totalH / 2;
  core.receiveShadow = true;
  core.castShadow = true; // the tower's shadow comes from the core (bricks skip the shadow pass)
  g.add(core);

  // Door openings: straight-sided black rectangles, four courses tall
  const halfW = DOOR_W / 2 / (R + BRICK_PROUD); // half-width in radians at the brick face
  const holes = tower.doors.map((d) => ({ a: (d.col + 0.5) * COL_ANGLE, w: halfW, y0: d.floor + 0.01, y1: d.floor + DOOR_H - 0.01 }));
  const angDist = (a, b) => {
    let d = (a - b) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return d;
  };
  for (const h of holes) {
    // the black interior: a box-shaped void set into the wall
    const back = new THREE.Mesh(arcSlab(R - 0.3, R - 0.02, h.w * 2.4, DOOR_H + 0.08, 0.0, 6), mats.recess);
    back.rotation.y = h.a;
    back.position.y = h.y0 - 0.05 + DOOR_H + 0.08;
    g.add(back);
  }

  const N = BRICKS_AROUND;
  const blockA = TWO_PI / N;
  const BRICK_HT = COURSE_H - 0.035;
  const CAP_A = blockA * 0.8;
  const brickGeo = arcSlab(R - 0.02, R + BRICK_PROUD - 0.03, CAP_A, BRICK_HT, 0.03, 3, 2, 0.03);
  brickGeo.translate(0, BRICK_HT, 0); // spans y = 0 .. BRICK_HT
  const courses = Math.ceil(totalH / COURSE_H);
  const brickMat = createBrickMaterial('#ffffff', { hi: S.hi, brickHalf: [(CAP_A * (R + BRICK_PROUD - 0.03)) / 2 + 0.03, BRICK_HT / 2] });
  const inst = new THREE.InstancedMesh(brickGeo, brickMat, courses * N + 64);
  inst.receiveShadow = true;
  inst.castShadow = false;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const frost = new THREE.Color('#f2faff');
  const col = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  let seed = (tower.id || 1) * 7717 + 3 + ((tower.seed | 0) % 9973);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const brickColour = () => {
    col.copy(brickCol).lerp(altCol, rnd() * rnd());
    col.multiplyScalar(BRICK_GAIN * (1 + (rnd() - 0.5) * 2 * S.vary));
    if (rnd() < (S.burnt || 0)) col.multiplyScalar(0.78);
    col.getHSL(hsl);
    col.setHSL(hsl.h + (rnd() - 0.5) * 0.01, hsl.s, hsl.l);
    if (S.frosted) col.lerp(frost, 0.05 + rnd() * 0.15);
    return col;
  };
  const deco = [];
  let n = 0;
  // a brick's full half-span including its bevel (the rest of the pitch is the joint)
  const half = (CAP_A * (R + BRICK_PROUD - 0.03) + 0.06) / 2 / (R + BRICK_PROUD);
  const joint = blockA * 0.08;
  const place = (a0, a1, y0) => {
    // a (possibly cut) brick covering angles a0..a1
    const span = a1 - a0;
    if (span < blockA * 0.12 || n >= inst.count) return;
    q.setFromEuler(e.set(0, (a0 + a1) / 2, 0));
    m4.compose(pos.set(0, y0 + 0.0175, 0), q, scl.set(Math.max(0.1, span / (half * 2)), 1, 1));
    inst.setMatrixAt(n, m4);
    inst.setColorAt(n, brickColour());
    n++;
  };
  for (let c = 0; c < courses; c++) {
    const y0 = c * COURSE_H;
    const yc = y0 + COURSE_H / 2;
    const stagger = (c % 2) * 0.5; // running bond
    const rowHoles = holes.filter((h) => y0 + COURSE_H > h.y0 && y0 < h.y1);
    for (let b = 0; b < N; b++) {
      const a = (b + stagger) * blockA;
      let a0 = a - half;
      let a1 = a + half;
      // cut bricks to the door opening so its sides are straight
      let skip = false;
      for (const h of rowHoles) {
        const d0 = angDist(a0, h.a);
        const d1 = angDist(a1, h.a);
        if (d0 >= h.w || d1 <= -h.w) continue; // no overlap
        if (d0 >= -h.w && d1 <= h.w) {
          skip = true; // fully inside the opening
          break;
        }
        if (d0 < -h.w && d1 > h.w) {
          // opening in the middle of this brick: two cut pieces
          place(a0, h.a - h.w - joint / 2, y0);
          place(h.a + h.w + joint / 2, a1, y0);
          skip = true;
          break;
        }
        if (d0 < -h.w) a1 = h.a - h.w - joint / 2;
        else a0 = h.a + h.w + joint / 2;
      }
      if (skip) continue;
      if (a1 - a0 < half * 1.99) {
        place(a0, a1, y0);
        continue;
      }
      q.setFromEuler(e.set((rnd() - 0.5) * 0.006, a + (rnd() - 0.5) * 0.004, (rnd() - 0.5) * 0.006));
      const out = 1 + (rnd() - 0.5) * 0.005;
      m4.compose(pos.set(0, y0 + 0.0175, 0), q, scl.set(out, 1, out));
      inst.setMatrixAt(n, m4);
      inst.setColorAt(n, brickColour());
      n++;
      if (S.barnacles && yc < Math.min(3.5, totalH * 0.25) && rnd() < 0.25 + 0.5 * (1 - yc / 3.5)) {
        deco.push({ a: a + (rnd() - 0.5) * blockA * 0.7, y: yc + (rnd() - 0.5) * COURSE_H * 0.6 });
      }
    }
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);

  // Barnacles low on the sea tower
  if (deco.length) {
    const bGeo = new THREE.ConeGeometry(0.028, 0.04, 7, 1, true);
    const im = new THREE.InstancedMesh(bGeo, new THREE.MeshStandardMaterial({ color: '#d9d4c2', roughness: 0.9 }), deco.length);
    deco.forEach((d, k) => {
      const r = R + BRICK_PROUD + 0.004;
      q.setFromEuler(e.set(Math.PI / 2, d.a, 0));
      const s2 = 0.7 + rnd() * 0.8;
      m4.compose(pos.set(Math.sin(d.a) * r, d.y, Math.cos(d.a) * r), q, scl.set(s2, s2, s2));
      im.setMatrixAt(k, m4);
    });
    im.receiveShadow = true;
    g.add(im);
  }

  // Crown: brick battlements in the tower's colour
  const crownMat = createBrickMaterial(brickCol.clone().multiplyScalar(BRICK_GAIN), { hi: S.hi });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.09, R + 0.03, 0.12, 64), crownMat);
  cap.position.y = totalH + 0.06;
  cap.castShadow = true;
  cap.receiveShadow = true;
  g.add(cap);
  const segA = TWO_PI / MERLONS;
  const parapetGeo = arcSlab(R - 0.12, R + 0.1, segA * 0.99, 0.3, 0.025, 6, 2);
  const merlonGeo = arcSlab(R - 0.12, R + 0.1, segA * 0.54, 0.34, 0.03, 4, 2);
  const parapetInst = new THREE.InstancedMesh(parapetGeo, crownMat, MERLONS);
  const merlonInst = new THREE.InstancedMesh(merlonGeo, crownMat, MERLONS);
  for (let b = 0; b < MERLONS; b++) {
    q.setFromEuler(e.set(0, b * segA, 0));
    m4.compose(pos.set(0, totalH + 0.12 + 0.3, 0), q, scl.set(1, 1, 1));
    parapetInst.setMatrixAt(b, m4);
    m4.compose(pos.set(0, totalH + 0.42 + 0.34, 0), q, scl);
    merlonInst.setMatrixAt(b, m4);
  }
  for (const im of [parapetInst, merlonInst]) {
    im.castShadow = true;
    im.receiveShadow = true;
  }
  g.add(parapetInst, merlonInst);
  // Brazier
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.3, 20), mats.steelDark);
  bowl.position.y = totalH + 0.27;
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
    stoneMats: [coreMat, plinth.material, brickMat, crownMat],
  };
}
