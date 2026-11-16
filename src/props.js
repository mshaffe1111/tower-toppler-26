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
  // heat glow: one sparse set of fissures per slab (not tiled), over the dark cracks in the stone
  cracks.repeat.set(1, 1);
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
    ledgeTop: new THREE.MeshStandardMaterial({ color: '#f3e9cf', map: T.limestone, roughness: 0.82, envMapIntensity: 0.45, emissive: '#3a3020', emissiveIntensity: 0.55 }),
    ledgeFront: new THREE.MeshStandardMaterial({ color: '#bfb39b', map: T.limestone, roughness: 0.9, envMapIntensity: 0.45, emissive: '#2a2216', emissiveIntensity: 0.55 }),
    // Crumbling ledge: the same stone, cracked through, heat glowing in the cracks
    crumble: new THREE.MeshStandardMaterial({ color: '#e6d8b8', map: T.crackedStone, roughness: 0.9, envMapIntensity: 0.45, emissive: '#ff6a10', emissiveIntensity: 0.45 }),
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
    liftDisc: new THREE.MeshStandardMaterial({ color: '#e6dcc2', map: T.limestone, roughness: 0.85, envMapIntensity: 0.45, emissive: '#2a2216', emissiveIntensity: 0.55 }),
    liftTop: new THREE.MeshStandardMaterial({ color: '#f6eed8', map: T.limestone, roughness: 0.8, envMapIntensity: 0.45, emissive: '#3a3020', emissiveIntensity: 0.55 }),
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
const LEDGE_T = 0.175; // ledge thickness: one brick row
let LGEO = null;
function slabCourse(r0, r1, count, height, bevel, gapA, offset = 0) {
  const pieceA = (COL_ANGLE * 0.94 - gapA * (count - 1)) / count;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const g = arcSlab(r0, r1, pieceA, height, bevel, 5, 2, 0.03);
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
    // caps sit a hair apart (a fine seam); the bevels overlap underneath, so nothing shows through
    // one brick row thick (measured ~0.17), reaching ~0.4 of the radius past the wall
    top: slabCourse(R - 0.03, R + 0.98, 3, 0.075, 0.02, 0.004),
    body: (() => {
      const g = slabCourse(R - 0.03, R + 0.93, 4, 0.1, 0.018, 0.004);
      g.translate(0, -0.075, 0);
      return g;
    })(),
    crumbleTop: arcSlab(R - 0.03, R + 0.98, span * 0.31, 0.075, 0.02, 4, 2),
    crumbleBody: (() => {
      const g = arcSlab(R - 0.03, R + 0.93, span * 0.31, 0.1, 0.018, 4, 2);
      g.translate(0, -0.075, 0);
      return g;
    })(),
    iceSlab: arcSlab(R - 0.06, R + 0.98, span, 0.17, 0.05, 10),
    iceTop: arcSlab(R - 0.02, R + 0.96, span * 0.97, 0.04, 0.015, 10),
    convBase: arcSlab(R - 0.06, R + 0.98, span, 0.17, 0.03, 10),
    convTread: arcSlab(R + 0.02, R + 0.9, span * 0.98, 0.035, 0.008, 10),
    convHazard: arcSlab(R + 0.96, R + 0.995, span * 0.9, 0.07, 0.008, 10),
    roller: new THREE.CylinderGeometry(0.05, 0.05, 0.9, 10),
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
  node.position.y = l.floor * FH;
  node.rotation.y = (l.col + 0.5) * COL_ANGLE;
  const add = (geo, mat, y = 0, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = cast;
    m.receiveShadow = true;
    node.add(m);
    return m;
  };
  node.userData = { baseY: l.floor * FH, type: l.type };

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
    if (l.h) {
      // real-tower blocks: one or two rows tall, standing on the step below
      const hh = l.h * FH * 0.96;
      crate.scale.y = hh / 0.56;
      crate.position.y = hh / 2 + 0.005;
    }
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
  } else if (l.type === 'pillar') {
    // Solid stone pillar (the original's poles): blocks the way, can't be stood on or shot
    const hh = (l.h || 1) * FH;
    const pil = new THREE.Mesh(new RoundedBoxGeometry(0.5, hh, 0.5, 2, 0.05), mats.ledgeFront);
    pil.position.set(0, hh / 2, R + 0.3);
    pil.castShadow = true;
    pil.receiveShadow = true;
    node.add(pil);
    node.userData.mainMat = mats.ledgeFront;
  } else if (l.type === 'ice' || l.type === 'slideR' || l.type === 'slideL') {
    add(G.iceSlab, mats.ice, -0.02);
    add(G.iceTop, mats.iceTop, 0.015);
    for (const k of [-0.34, -0.1, 0.12, 0.33]) {
      const ic = new THREE.Mesh(G.icicle, mats.ice);
      const [x, z] = polar(k * COL_ANGLE, R + 0.78 + (k > 0 ? 0.06 : 0));
      ic.position.set(x, -0.19, z);
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
      rol.position.set(0, -0.07, R + 0.47);
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
// World height of one floor (one stair step). Measured from 7800 footage: a step is about one
// brick row and Pogo is about two steps tall, so steps are low and wide like real stairs.
// Both modes use the 7800's proportions, measured from the player's clip: a step row is 0.28 of
// a column's width (21.5 px rows on a 195 px-radius tower), so stairs, Pogo and enemies sit low
// against the tower. (Kept switchable per mode with setStepHeight(); everything reads FH live.)
export const STEP_ORIGINAL = 0.28;
export const STEP_REBOOT = 0.28;
export let FH = STEP_REBOOT;
export let DOOR_H = FH * 2.78; // a doorway is ~2.8 steps tall: taller than Pogo
let COURSE_H = FH / 2; // two brick courses per step
export function setStepHeight(h) {
  if (h === FH) return;
  FH = h;
  DOOR_H = h * 2.78;
  COURSE_H = h / 2;
}
const DGEOS = {};
function doorGeos() {
  if (DGEOS[FH]) return DGEOS[FH];
  const DGEO = { portal: new THREE.PlaneGeometry(DOOR_W * 0.96, DOOR_H * 0.96) };
  DGEO.portal.translate(0, (DOOR_H * 0.96) / 2 + 0.02, 0);
  for (const geo of Object.values(DGEO)) geo.userData.shared = true;
  DGEOS[FH] = DGEO;
  return DGEO;
}

export function buildDoor(door, pal, mats, softDotTex) {
  const G = doorGeos();
  const R = TOWER_RADIUS;
  const g = new THREE.Group();
  g.rotation.y = (door.col + 0.5) * COL_ANGLE;
  g.position.y = door.floor * FH;
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
  const baseY = el.minFloor * FH - LEDGE_T - 0.12; // just under a boarding ledge's slab
  const base = new THREE.Mesh(G.base, mats.liftDisc);
  base.position.set(0, baseY, R + 0.42);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  // stepped stone bracket into the wall, so the column is visibly carried
  for (const [r1, h, y] of [[R + 0.42, 0.12, baseY], [R + 0.26, 0.1, baseY - 0.12]]) {
    const b = new THREE.Mesh(arcSlab(R - 0.03, r1, COL_ANGLE * 0.32, h, 0.02, 4, 1, 0.02), mats.ledgeFront);
    b.position.y = y;
    b.castShadow = true;
    b.receiveShadow = true;
    g.add(b);
  }
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

  const bottom = el.minFloor * FH - LEDGE_T; // top of the footing disc
  const maxDiscs = Math.ceil(((el.maxFloor - el.minFloor) * FH + 0.45) / DISC_H) + 1;
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

// REBOOT materials: each changes the wall's block layout and surface, plus its ledges and crown.
//   around: blocks round the tower; rows: brick courses per block row; jitter: block width
//   variation; proud: how much blocks stand in and out; colours, roughness, metalness, glow.
export const MATERIAL_THEMES = {
  rock: { around: 9, rows: [2, 3], jitter: 0.35, proud: 0.05, bevel: 0.05, joint: 0.07, surface: 'stone', tile: 0.45, colors: ['#8f877a', '#7a7367', '#a0978a', '#857d70', '#6e685e', '#958a78'], mortar: '#1a1714', roughness: 1, metalness: 0, normal: 1.4, hi: '#f4e8d4', ledge: ['#a39a8a', '#7d7568', 0.95, 0], crown: '#7b7468' },
  timber: { around: 7, rows: [1], jitter: 0.35, proud: 0.015, bevel: 0.028, joint: 0.028, surface: 'wood', tile: 0.5, colors: ['#9a6438', '#8a5630', '#a8703e', '#7c4c2a', '#b07a46'], bands: { every: 6, color: '#4a2c16', proud: 0.035 }, mortar: '#1a0f07', roughness: 0.8, metalness: 0, normal: 1, hi: '#ffd8a0', ledge: ['#9a6a3e', '#6e4426', 0.8, 0], crown: '#5a3820' },
  metal: { around: 8, rows: [4], jitter: 0, proud: 0.01, bevel: 0.025, joint: 0.03, surface: 'brushed', tile: 0.6, colors: ['#8b9198', '#6f757d', '#9ca2a9', '#868079', '#646b74'], mortar: '#0c0e12', roughness: 0.5, metalness: 0.65, normal: 0.6, hi: '#eef3ff', rivets: '#c4c9cf', ledge: ['#5a6470', '#3a424c', 0.45, 0.7], crown: '#4a525e' },
  brass: { around: 8, rows: [3], jitter: 0, proud: 0.01, bevel: 0.025, joint: 0.03, surface: 'brushed', tile: 0.6, colors: ['#d2a04a', '#c08c3a', '#deb25c', '#b8784a', '#c9973f'], mortar: '#1c1206', roughness: 0.38, metalness: 0.6, normal: 0.6, hi: '#fff2c8', rivets: '#f2dc98', ledge: ['#a07a36', '#6e5222', 0.4, 0.7], crown: '#8a6a2e' },
  crystal: { around: 12, rows: [2, 3], jitter: 0.3, proud: 0.07, bevel: 0.04, joint: 0.04, surface: 'crystal', tile: 0.8, colors: ['#b49af0', '#c8a8f6', '#9a86e8', '#d6b8fa', '#a890ee', '#e0b0f0'], mortar: '#3a1d6e', roughness: 0.15, metalness: 0.1, normal: 1, hi: '#ffffff', glow: ['#a070f0', 0.5], blockGlow: 0.12, ledge: ['#e8dcff', '#b49ae8', 0.15, 0.05], crown: '#9a7ae0' },
  siding: { around: 5, rows: [1], jitter: 0.2, proud: 0, bevel: 0.012, joint: 0.012, tilt: -0.16, surface: 'paint', tile: 0.6, colors: ['#e9ecef', '#dfe4e8', '#f2f4f5', '#e4e8ea'], paints: [['#e9ecef', '#dfe4e8', '#f2f4f5'], ['#6f9fc8', '#6496c0', '#78a8d0'], ['#c24a3e', '#b84236', '#cc5446'], ['#7fae8a', '#76a482', '#88b692'], ['#f0d58a', '#e8cc80', '#f6dc94']], bands: { every: 9, color: '#f6f6f2', proud: 0.03 }, mortar: 'paint', roughness: 0.6, metalness: 0, normal: 0.8, hi: '#ffffff', ledge: ['#f2f2ee', '#c8ccd0', 0.6, 0], crown: '#5a6068' },
  straw: { around: 18, rows: [2], jitter: 0.4, proud: 0.09, bevel: 0.04, joint: 0, tilt: -0.42, overlap: 1.35, surface: 'straw', tile: 0.9, colors: ['#d9a850', '#c8963e', '#e2b860', '#bf8a3a', '#d4a24c'], mortar: '#3a2a12', roughness: 1, metalness: 0, normal: 1.4, hi: '#fff0b0', ledge: ['#a87c44', '#7a5630', 0.9, 0], crown: '#8a6a32' },
  shingle: { around: 34, rows: [1], jitter: 0, proud: 0.02, bevel: 0.012, joint: 0.012, tilt: -0.12, shape: 'scale', surface: null, tile: 0.8, colors: ['#c8643a', '#b85a34', '#d27046', '#a8502e', '#c06a40'], mortar: '#2a140c', roughness: 0.85, metalness: 0, normal: 0.8, hi: '#ffd0a8', ledge: ['#8a7a6a', '#5e5246', 0.9, 0], crown: '#7a3a22' },
  bamboo: { around: 76, rows: [4], jitter: 0, proud: 0.02, bevel: 0, joint: 0.01, shape: 'pole', surface: 'bamboo', tile: 1, colors: ['#a8b048', '#8e9a3e', '#c4bc5c', '#b0a24a', '#7e8c3a', '#c8c070'], mortar: '#26300f', roughness: 0.5, metalness: 0, normal: 0.6, hi: '#fff8c0', ledge: ['#8a7a4a', '#5e5230', 0.7, 0], crown: '#6a6430' },
  sandstone: { around: 8, rows: [3, 4, 2], jitter: 0.3, proud: 0.035, bevel: 0.05, joint: 0.045, surface: 'strata', tile: 0.4, colors: ['#d8a26a', '#cc945e', '#e2b07a', '#c68a58', '#d49c64'], mortar: '#5a3a22', roughness: 1, metalness: 0, normal: 1.3, hi: '#fff0d0', ledge: ['#c8986a', '#9a7048', 0.95, 0], crown: '#a8784a' },
  copper: { around: 9, rows: [3], jitter: 0, proud: 0.01, bevel: 0.025, joint: 0.03, surface: 'patina', tile: 0.5, colors: ['#f2f2f2', '#e6e6e6', '#fafafa', '#dedede'], mortar: '#14100c', roughness: 1, metalness: 0.75, normal: 0.8, hi: '#fff0e0', rivets: '#9ad0b8', ledge: ['#5e9a86', '#3e6a5c', 0.6, 0.2], crown: '#4e8a76' },
  ice: { around: 8, rows: [3], jitter: 0.2, proud: 0.03, bevel: 0.06, joint: 0.035, surface: 'frost', tile: 0.5, colors: ['#bfe6f6', '#aedcf2', '#d0eefa', '#a4d4ee'], mortar: '#3a7ea6', roughness: 0.2, metalness: 0.05, normal: 0.9, hi: '#ffffff', glow: ['#6cc8f0', 0.25], blockGlow: 0.05, ledge: ['#e8f6ff', '#a8d4ee', 0.25, 0.05], crown: '#a8d8f0' },
  marble: { around: 10, rows: [3], jitter: 0.1, proud: 0.015, bevel: 0.03, joint: 0.03, surface: 'marble', tile: 0.45, colors: ['#ece8e0', '#e2dcd2', '#f4f0e8', '#dcd4c6'], mortar: '#a88a48', roughness: 0.4, metalness: 0, normal: 0.6, hi: '#ffffff', ledge: ['#f0ece4', '#c8c0b0', 0.35, 0], crown: '#d8d0c0' },
  obsidian: { around: 10, rows: [2, 3], jitter: 0.3, proud: 0.04, bevel: 0.04, joint: 0.07, surface: 'glass', tile: 0.6, colors: ['#1e1828', '#261c32', '#17121e', '#2c2038'], mortar: '#ff5a1a', roughness: 0.25, metalness: 0.2, normal: 1, hi: '#a888e8', glow: ['#ff5a1a', 1.2], ledge: ['#3a2e44', '#221a2a', 0.35, 0.2], crown: '#2a1e36' },
};

// Re-skin the ledge and lift materials to a tower's material theme (Reboot)
// Which material each Reboot tower is built from (campaign by tower id; daily by weekday)
// Which materials each Reboot tower is built from: [level 1, level 2, level 3]
export const TOWER_MATERIAL = {
  1: ['rock', 'straw', 'shingle'],
  2: ['metal', 'brass', 'copper'],
  3: ['marble', 'siding', 'bamboo'],
  4: ['ice', 'crystal', 'siding'],
  5: ['timber', 'sandstone', 'straw'],
  6: ['siding', 'shingle', 'copper'],
  7: ['obsidian', 'sandstone', 'metal'],
  8: ['obsidian', 'crystal', 'brass'],
};
export const MATERIAL_NAMES = Object.keys(MATERIAL_THEMES);
// The daily tower's material: picked by the date's seed from the ones that suit its twist
const TWIST_MATERIALS = {
  blizzard: ['ice', 'crystal', 'siding', 'timber'],
  flood: ['shingle', 'siding', 'copper', 'timber', 'rock'],
  dark: ['obsidian', 'metal', 'crystal', 'marble'],
  wind: ['straw', 'bamboo', 'sandstone', 'rock'],
  collapse: ['sandstone', 'rock', 'straw', 'timber'],
  pistons: ['brass', 'metal', 'copper'],
};
export function materialForSeed(seed, mechanic = 'none') {
  const pool = TWIST_MATERIALS[mechanic] || MATERIAL_NAMES;
  const h = Math.imul((seed | 0) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
  return pool[(h >>> 7) % pool.length];
}

export function themeLedgeMaterials(mats, theme) {
  const T = MATERIAL_THEMES[theme];
  if (!T) return;
  const [top, front, rough, metal] = T.ledge;
  for (const [k, c] of [
    ['ledgeTop', top],
    ['ledgeFront', front],
    ['liftDisc', top],
  ]) {
    if (!mats[k]) continue;
    const m = mats[k].clone();
    m.color.set(c);
    m.roughness = rough;
    m.metalness = metal;
    m.emissive.set(T.glow ? T.glow[0] : '#000000');
    m.emissiveIntensity = T.glow ? T.glow[1] * 0.15 : 0.05;
    mats[k] = m;
  }
}
export function towerStyleName(tower) {
  if (tower.style && TOWER_STYLES[tower.style]) return tower.style;
  if (STYLE_BY_TOWER[tower.id]) return STYLE_BY_TOWER[tower.id];
  const keys = Object.keys(TOWER_STYLES);
  return keys[Math.abs((tower.seed ?? tower.id ?? 0) | 0) % keys.length];
}

// Measured from the originals: 5 brick rows per floor (a ledge takes the place of one), ~8-9
// bricks across the visible face = 22 around (each ~0.74 wide, ~4:1), thin dark mortar
const BRICKS_AROUND = 22;
const BRICK_PROUD = 0.055; // how far a brick face stands out from the mortar
const BRICK_GAIN = 1.22; // instance colour gain (the clay texture is ~0.85 albedo)
const MERLONS = 12;

export function buildTowerBody(tower, pal, mats, softDotTex, chromeEnv = null) {
  const R = TOWER_RADIUS;
  const floors = tower.floors;
  const totalH = floors * FH;
  const g = new THREE.Group();
  const styleName = towerStyleName(tower);
  const S = TOWER_STYLES[styleName];
  const brickCol = new THREE.Color(S.brick);
  const altCol = new THREE.Color(S.alt);

  // Mortar core: the thin dark joints between bricks (plain and matte, so a joint never lights up)
  const coreMat = new THREE.MeshStandardMaterial({ color: S.mortar, roughness: 1, metalness: 0, envMapIntensity: 0.3 });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.035, R - 0.035, totalH + 0.2, 64, 1, false), coreMat);
  core.position.y = totalH / 2;
  core.receiveShadow = true;
  core.castShadow = true; // the tower's shadow comes from the core (bricks skip the shadow pass)
  g.add(core);

  // Door openings: straight-sided black rectangles, four courses tall
  const halfW = DOOR_W / 2 / (R + BRICK_PROUD); // half-width in radians at the brick face
  const holes = tower.doors.map((d) => ({ a: (d.col + 0.5) * COL_ANGLE, w: halfW, y0: d.floor * FH + 0.01, y1: d.floor * FH + DOOR_H - 0.01 }));
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

  const theme = MATERIAL_THEMES[tower.material];
  if (theme) {
    const res = buildThemedWall(g, tower, theme, holes, totalH, coreMat);
    return finishTowerBody(g, tower, pal, mats, softDotTex, totalH, styleName, coreMat, new THREE.Color(theme.crown), theme.hi, res, res.mats);
  }
  const N = BRICKS_AROUND;
  const blockA = TWO_PI / N;
  // chamfered (one-segment) bevel: reads exactly like the classic bricks and keeps the
  // whole tower around 120 triangles a brick
  const BEV = 0.022;
  const BRICK_HT = COURSE_H - 0.028; // ~1 px of mortar between rows
  const JOINT_W = 0.05; // ~2 px between bricks
  const R1 = R + BRICK_PROUD - BEV; // the cap's outer radius (the bevel adds BEV all round)
  const CAP_A = (blockA * (R + BRICK_PROUD) - JOINT_W - 2 * BEV) / R1;
  const brickGeo = arcSlab(R - 0.02, R1, CAP_A, BRICK_HT, BEV, 2, 1, 0.025);
  brickGeo.translate(0, BRICK_HT, 0); // spans y = 0 .. BRICK_HT
  const courses = Math.ceil(totalH / COURSE_H);
  const brickMat = createBrickMaterial('#ffffff', { hi: S.hi, brickHalf: [(CAP_A * R1) / 2 + BEV, BRICK_HT / 2] });
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
  const half = (CAP_A * R1 + 2 * BEV) / 2 / (R + BRICK_PROUD);
  const joint = JOINT_W / (R + BRICK_PROUD);
  const place = (a0, a1, y0) => {
    // a (possibly cut) brick covering angles a0..a1
    const span = a1 - a0;
    if (span < blockA * 0.12 || n >= inst.count) return;
    q.setFromEuler(e.set(0, (a0 + a1) / 2, 0));
    m4.compose(pos.set(0, y0 + 0.014, 0), q, scl.set(Math.max(0.1, span / (half * 2)), 1, 1));
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
      m4.compose(pos.set(0, y0 + 0.014, 0), q, scl.set(out, 1, out));
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

  return finishTowerBody(g, tower, pal, mats, softDotTex, totalH, styleName, coreMat, brickCol.clone().multiplyScalar(BRICK_GAIN), S.hi, null, [brickMat]);
}

// The Reboot's material walls: rows of blocks (rough stone in uneven courses, long timber planks
// with darker frame bands, riveted metal panels, crystal and obsidian blocks), cut round the door
// openings, each with its own surface texture
function buildThemedWall(g, tower, T, holes, totalH, coreMat) {
  const R = TOWER_RADIUS;
  if (T.mortar !== 'paint') coreMat.color.set(T.mortar);
  if (T.glow) {
    // seams that glow (lava between obsidian blocks, light inside crystal)
    coreMat.emissive = new THREE.Color(T.glow[0]);
    coreMat.emissiveIntensity = T.glow[1];
  }
  const N = T.around;
  const blockA = TWO_PI / N;
  const baseH = T.rows[0] * COURSE_H;
  const BEV = T.bevel;
  const over = T.overlap || 1; // thatch layers hang over the row below
  const BLOCK_HT = baseH * over - T.joint * 0.6;
  const R1 = R + BRICK_PROUD - BEV;
  const CAP_A = (blockA * (R + BRICK_PROUD) - T.joint - 2 * BEV) / R1;
  const RF = R + BRICK_PROUD; // the wall face
  let geo;
  let poleHalf = 0;
  if (T.shape === 'scale') {
    // a fish-scale tile: square top, round bottom, hanging over the row below
    const w = blockA * RF - T.joint;
    const rr = w / 2;
    const sh = new THREE.Shape();
    const top = baseH + rr * 0.9;
    sh.moveTo(-w / 2, top);
    sh.lineTo(w / 2, top);
    sh.lineTo(w / 2, rr * 0.9);
    sh.absarc(0, rr * 0.9, rr, 0, Math.PI, true);
    sh.closePath();
    geo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 8 });
    geo.translate(0, -rr * 0.9, RF - 0.035);
  } else if (T.shape === 'pole') {
    // a bamboo culm segment with a swollen node at each end
    const pr = (blockA * RF) / 2 - T.joint / 2;
    poleHalf = pr / RF;
    const H = baseH;
    const prof = [
      [0.001, 0],
      [pr * 0.96, 0],
      [pr * 1.1, 0.014],
      [pr * 0.94, 0.04],
      [pr * 0.9, H * 0.5],
      [pr * 0.94, H - 0.03],
      [pr * 1.06, H - 0.008],
      [0.001, H],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    geo = new THREE.LatheGeometry(prof, 10);
    geo.translate(0, 0, RF - pr * 0.6);
  } else {
    geo = arcSlab(R - 0.02, R1, CAP_A, BLOCK_HT, BEV, Math.max(2, Math.ceil(blockA / 0.1)), 1, Math.min(0.025, BEV));
    geo.translate(0, BLOCK_HT, 0);
    if (over > 1) geo.translate(0, -(BLOCK_HT - baseH), 0);
  }
  if (T.tilt) {
    // lap boards / thatch / tiles: each row's top tucks in, so its lower edge stands proud. A
    // conical tilt (in each vertex's own radial plane), so long curved boards stay level.
    const P = geo.attributes.position;
    const c = Math.cos(T.tilt);
    const sn = Math.sin(T.tilt);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 1e-6) continue;
      const dr = r - RF;
      const r2 = RF + c * dr + sn * y;
      P.setXYZ(i, (x / r) * r2, c * y - sn * dr, (z / r) * r2);
    }
    geo.computeVertexNormals();
  }
  const mat = createBrickMaterial('#ffffff', { hi: T.hi, brickHalf: [(CAP_A * R1) / 2 + BEV, BLOCK_HT / 2], edgeDarken: T.metalness > 0.4 ? 0.15 : 0.3, surface: T.surface, tile: T.tile, angular: true });
  mat.roughness = T.roughness;
  mat.metalness = T.metalness;
  if (mat.normalScale) mat.normalScale.setScalar(0.45 * T.normal);
  if (T.glow && T.blockGlow) {
    mat.emissive = new THREE.Color(T.glow[0]);
    mat.emissiveIntensity = T.blockGlow;
  }
  const minRow = Math.min(...T.rows) * COURSE_H;
  const cap = Math.ceil(totalH / minRow + 2) * N * 3 + 64;
  const spanAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1);
  geo.setAttribute('aSpan', spanAttr);
  const inst = new THREE.InstancedMesh(geo, mat, cap);
  inst.receiveShadow = true;
  inst.castShadow = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  let seed = (tower.id || 1) * 9137 + ((tower.seed | 0) % 7919) + 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // painted siding: one paint colour per tower
  const cols = (T.paints ? T.paints[Math.floor(rnd() * T.paints.length)] : T.colors).map((c) => new THREE.Color(c));
  // siding: the gaps between boards are the boards' own colour in shadow, not black
  if (T.mortar === 'paint') coreMat.color.copy(cols[0]).multiplyScalar(0.45);
  const bandCol = T.bands ? new THREE.Color(T.bands.color) : null;
  const half = (CAP_A * R1 + 2 * BEV) / 2 / (R + BRICK_PROUD);
  const joint = T.joint / (R + BRICK_PROUD);
  const angDist = (a, b) => {
    let d = (a - b) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return d;
  };
  const rivets = [];
  let n = 0;
  let band = false;
  const shaped = T.shape === 'scale' || T.shape === 'pole';
  const place = (a0, a1, y0, hr) => {
    const span = a1 - a0;
    if (span < blockA * 0.12 || hr < 0.07 || n >= inst.count) return;
    q.setFromEuler(e.set(0, (a0 + a1) / 2, 0));
    const proud = band ? T.bands.proud : T.proud;
    const out = 1 + (band ? proud / R : (rnd() - 0.5) * 2 * (proud / R));
    const sy = shaped ? hr / baseH : (hr * over - T.joint * 0.6) / BLOCK_HT;
    m4.compose(pos.set(0, y0 + 0.014, 0), q, scl.set(out, sy, out));
    inst.setMatrixAt(n, m4);
    spanAttr.setX(n, T.shape === 'pole' ? 1 : Math.max(0.1, span / (half * 2)));
    if (band) col.copy(bandCol).multiplyScalar(BRICK_GAIN * (0.92 + rnd() * 0.16));
    else col.copy(cols[Math.floor(rnd() * cols.length)]).multiplyScalar(BRICK_GAIN * (0.93 + rnd() * 0.14));
    inst.setColorAt(n, col);
    n++;
    if (T.rivets && span > blockA * 0.35) {
      // a row of rivets along each panel's top and bottom edge
      const k = Math.max(2, Math.round((span * R) / 0.4));
      for (let j = 0; j < k; j++) {
        const a = a0 + span * ((j + 0.5) / k);
        rivets.push({ a, y: y0 + 0.014 + hr * 0.11 }, { a, y: y0 + 0.014 + hr * 0.89 });
      }
    }
  };
  // place a block over angles a0..a1, cut round door openings: the parts beside an opening keep
  // their height, the part over it is cut down to the lintel (and under it to the sill)
  const gapV = Math.max(0.02, T.joint * 0.6);
  const overUnder = (a0, a1, y0, hr, h) => {
    if (h.y0 - y0 - gapV > 0.07) place(a0, a1, y0, h.y0 - y0 - gapV);
    if (y0 + hr - h.y1 - gapV > 0.07) place(a0, a1, h.y1 + gapV, y0 + hr - h.y1 - gapV);
  };
  const placeCut = (a0, a1, y0, hr) => {
    for (const h of holes) {
      if (!(y0 + hr > h.y0 && y0 < h.y1)) continue;
      const d0 = angDist(a0, h.a);
      const hs = a0 - d0; // the opening's centre, unwrapped next to a0
      if (T.shape === 'pole') {
        // poles are never sliced lengthwise: one in the opening is shortened instead
        if (Math.abs(angDist((a0 + a1) / 2, h.a)) < h.w + poleHalf * 0.6) {
          overUnder(a0, a1, y0, hr, h);
          return;
        }
        continue;
      }
      const L = hs - h.w;
      const Rr = hs + h.w;
      if (a1 <= L || a0 >= Rr) continue;
      if (a0 < L - joint / 2) placeCut(a0, L - joint / 2, y0, hr);
      overUnder(Math.max(a0, L), Math.min(a1, Rr), y0, hr, h);
      if (a1 > Rr + joint / 2) placeCut(Rr + joint / 2, a1, y0, hr);
      return;
    }
    place(a0, a1, y0, hr);
  };
  let y0 = 0;
  const pole = T.shape === 'pole';
  for (let r = 0; y0 < totalH + (pole ? baseH : 0); r++) {
    const hr = T.rows[Math.floor(rnd() * T.rows.length)] * COURSE_H;
    band = Boolean(T.bands) && r % T.bands.every === T.bands.every - 1;
    // walk round the tower with jittered block widths; each row starts half a block on
    let a = (r % 2) * blockA * 0.5 + rnd() * blockA * T.jitter;
    const end = a + TWO_PI;
    let k = 0;
    while (a < end - blockA * 0.2) {
      let w = band ? blockA * 1.5 : shaped ? blockA : blockA * (1 + (rnd() - 0.5) * 2 * T.jitter);
      if (end - (a + w) < blockA * 0.45) w = end - a; // close the ring without a sliver
      // bamboo: neighbouring poles' joints are staggered (by a third or two thirds of a segment)
      const yo = pole ? -hr * ((k * 7) % 3) / 3 : 0;
      placeCut(a + joint / 2, a + w - joint / 2, y0 + yo, hr);
      a += w;
      k++;
    }
    y0 += hr;
  }
  inst.count = n;
  inst.instanceMatrix.needsUpdate = true;
  spanAttr.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);
  const mats = [mat];
  // metal: rivets
  if (rivets.length) {
    const rg = new THREE.SphereGeometry(0.026, 8, 5);
    const rm = new THREE.MeshStandardMaterial({ color: T.rivets, roughness: 0.3, metalness: 0.85 });
    const ri = new THREE.InstancedMesh(rg, rm, rivets.length);
    rivets.forEach((v, k) => {
      const rr = R + BRICK_PROUD + T.proud + 0.004;
      m4.compose(pos.set(Math.sin(v.a) * rr, v.y, Math.cos(v.a) * rr), q.identity(), scl.set(1, 1, 0.6));
      ri.setMatrixAt(k, m4);
    });
    ri.receiveShadow = true;
    g.add(ri);
    mats.push(rm);
  }
  return { metalness: T.metalness, roughness: T.roughness, mats };
}

function finishTowerBody(g, tower, pal, mats, softDotTex, totalH, styleName, coreMat, crownCol, crownHi, themed, wallMats = []) {
  const R = TOWER_RADIUS;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  // Crown: battlements in the tower's colour / material
  const crownMat = createBrickMaterial(crownCol, { hi: crownHi });
  if (themed) {
    crownMat.metalness = themed.metalness;
    crownMat.roughness = themed.roughness;
  }
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
    stoneMats: [plinth.material, ...wallMats, crownMat],
  };
}
