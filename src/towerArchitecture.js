// ============================================================================
// TOWERING WATERS: GATEWAY'S DESCENT — AAA 3D SPIRE ARCHITECTURE ENGINE
// Module: src/towerArchitecture.js
//
// Builds monumental, non-clunky 3D Hydro-Sanctum & Siphon Spires across all 5
// Earth Water Biomes (`canyon_river`, `alpine_lake`, `mist_bayou`, `coral_sea`,
// `storm_ocean`) at full V3 scale (`COLS = 20`, `TOWER_RADIUS = 3.75`,
// `FLOOR_HEIGHT = 1.50`):
//   - Sweeping vertical architectural buttress ribs & arched colonnade bands
//   - Recessed transparent glass Hydro-Conduit tubes with live flowing water
//   - Spinning 3D Pelton Hydro-Turbines / Waterwheels (`hydro_turbine.glb`)
//   - Interactive Wall Pipe-Valves (`pipe_valve.glb`), Gecko Wall-Scamper
//     crystal/moss strips (`wallStrips`), & Tail-Swing Grapple Rings (`grappleRings`)
//   - Real 5-riser engineered 3D staircases (`real_staircase.glb`) with beveled
//     treads, risers, bullnose nosings, side stringers, trusses & handrails
//   - Real full-height mechanical elevators (`mech_elevator.glb`) with twin
//     bolted I-beam guide rails, overhead pulley/winch housing, spinning sheave
//     wheels, sea-glass & brass cab railing, animated safety gate, directional
//     chevrons, taut hoist cables, and opposition counterweight
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries as _rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PUZZLE_TYPES, BELL_COLORS, makePuzzle } from './puzzleRoom.js';

function mergeGeometries(parts) {
  const valid = parts.filter(Boolean);
  if (!valid.length) return new THREE.BufferGeometry();
  const normalized = valid.map((g) => (g.index ? g.toNonIndexed() : g));
  // Ensure consistent attribute set (position, normal, uv) before merge
  for (let i = 0; i < normalized.length; i++) {
    const g = normalized[i];
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const cnt = g.attributes.position.count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
    }
  }
  const merged = _rawMergeGeometries(normalized, false);
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] !== valid[i]) normalized[i].dispose();
    if (valid[i] && !valid[i].userData?.shared) valid[i].dispose();
  }
  return merged;
}

export const COLS = 20;
export const TOWER_RADIUS = 3.75;
export const FLOOR_HEIGHT = 1.5;
export const STEP_ORIGINAL = FLOOR_HEIGHT;
export const TWO_PI = Math.PI * 2;
export const COL_ANGLE = TWO_PI / COLS;

export const BIOME_THEME_LIST = [
  'canyon_river',
  'alpine_lake',
  'mist_bayou',
  'coral_sea',
  'storm_ocean',
];
export const REBOOT_THEME_LIST = BIOME_THEME_LIST;

const LEDGE_OFFSET = 0.46; // Centerline radius = TOWER_RADIUS + 0.46 (4.21u)
const LIFT_OFFSET = 0.48;  // Elevator cab centerline = TOWER_RADIUS + 0.48 (4.23u)
const DOOR_W = 0.98;
const DOOR_H = 1.38;
const BRICK_PROUD = 0.068;
const CROWN_RIBS = 10;
const PROP_SPAN_Y = 1e6;
const VIS_ALT_WINDOW = 14.8;

// Zero-allocation scratch math objects for per-frame updates & instancing
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _col = new THREE.Color();
const _zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

// ============================================================================
// 1. DETERMINISTIC PRNG, THEME RESOLUTION & SELF-CACHING `.GLB` LOADER
// ============================================================================

function mulberry32(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function angDist(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

const THEME_ALIAS_MAP = {
  // Canonical 5 Earth Water Biomes
  canyon_river: 'canyon_river',
  alpine_lake: 'alpine_lake',
  mist_bayou: 'mist_bayou',
  coral_sea: 'coral_sea',
  storm_ocean: 'storm_ocean',

  // Biome shorthand & legacy theme/material aliases
  canyon: 'canyon_river',
  river: 'canyon_river',
  redwood: 'canyon_river',
  foundry: 'canyon_river',
  sandstone: 'canyon_river',
  copper: 'canyon_river',
  timber: 'canyon_river',

  alpine: 'alpine_lake',
  lake: 'alpine_lake',
  glacier: 'alpine_lake',
  blizzard: 'alpine_lake',
  ice: 'alpine_lake',
  marble: 'alpine_lake',
  granite: 'alpine_lake',

  mist: 'mist_bayou',
  bayou: 'mist_bayou',
  swamp: 'mist_bayou',
  delta: 'mist_bayou',
  moonlit_slate: 'mist_bayou',
  rock: 'mist_bayou',
  moss: 'mist_bayou',

  coral: 'coral_sea',
  reef: 'coral_sea',
  lagoon: 'coral_sea',
  sea: 'coral_sea',
  sinking: 'coral_sea',
  prism: 'coral_sea',
  crystal: 'coral_sea',
  brass: 'coral_sea',

  storm: 'storm_ocean',
  ocean: 'storm_ocean',
  tempest: 'storm_ocean',
  polar: 'storm_ocean',
  piston: 'storm_ocean',
  blackout: 'storm_ocean',
  apex: 'storm_ocean',
  obsidian: 'storm_ocean',
  metal: 'storm_ocean',
  siding: 'storm_ocean',
};

export function resolveRebootTheme(tower) {
  const candidates = [tower?.theme, tower?.biome, tower?.skyTheme, tower?.material];
  for (let i = 0; i < candidates.length; i++) {
    const raw = String(candidates[i] || '').trim().toLowerCase();
    if (raw && THEME_ALIAS_MAP[raw]) return THEME_ALIAS_MAP[raw];
  }
  const actIdx = Math.floor(Math.max(0, (Number(tower?.id) || 1) - 1) / 2) % BIOME_THEME_LIST.length;
  return BIOME_THEME_LIST[actIdx];
}

export function getTowerStepHeight(tower, _eraCompat = false, overrideFh = null) {
  if (typeof overrideFh === 'number' && overrideFh > 0) return overrideFh;
  if (typeof tower?.stepHeight === 'number' && tower.stepHeight > 0) return tower.stepHeight;
  return FLOOR_HEIGHT;
}

// Self-contained singleton GLB asset cache so `towerArchitecture.js` loads its 4 `.glb`s
// automatically in browser contexts even if `glbAssets` is omitted or not yet populated
const INTERNAL_GLB_CACHE = {
  started: false,
  real_staircase: null,
  mech_elevator: null,
  hydro_turbine: null,
  pipe_valve: null,
  listeners: new Set(),
};

function markSharedSubtree(rootObj) {
  if (!rootObj) return rootObj;
  rootObj.traverse((o) => {
    if (o.geometry) {
      o.geometry.userData = o.geometry.userData || {};
      o.geometry.userData.shared = true;
    }
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      if (!m) continue;
      m.userData = m.userData || {};
      m.userData.shared = true;
      if (typeof m.emissiveIntensity === 'number' && m.emissiveIntensity > 1.85) {
        m.emissiveIntensity = 1.85;
      }
      for (const tk of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        if (m[tk]) {
          m[tk].userData = m[tk].userData || {};
          m[tk].userData.shared = true;
        }
      }
    }
  });
  return rootObj;
}

function ensureInternalGlbLoad() {
  if (INTERNAL_GLB_CACHE.started) return;
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !window.location?.href ||
    typeof fetch !== 'function'
  ) {
    return;
  }
  INTERNAL_GLB_CACHE.started = true;

  let loader;
  try {
    loader = new GLTFLoader();
  } catch {
    return;
  }

  const specs = [
    ['real_staircase', 'assets/models/real_staircase.glb'],
    ['mech_elevator', 'assets/models/mech_elevator.glb'],
    ['hydro_turbine', 'assets/models/hydro_turbine.glb'],
    ['pipe_valve', 'assets/models/pipe_valve.glb'],
  ];

  for (const [key, url] of specs) {
    try {
      loader.load(
        url,
        (gltf) => {
          if (!gltf?.scene) return;
          INTERNAL_GLB_CACHE[key] = markSharedSubtree(gltf.scene);
          for (const fn of INTERNAL_GLB_CACHE.listeners) {
            try {
              fn(key, INTERNAL_GLB_CACHE[key]);
            } catch {
              // Ignore disposed listener errors
            }
          }
        },
        undefined,
        () => {
          // Procedural twin geometry remains active if offline fetch fails
        }
      );
    } catch {
      // Ignore relative URL errors in non-browser headless environments
    }
  }
}

function findNamedMeshGeo(root, nodeName) {
  if (!root) return null;
  let found = null;
  root.traverse((o) => {
    if (!found && o.isMesh && (o.name === nodeName || o.parent?.name === nodeName)) {
      found = o.geometry;
    }
  });
  return found;
}

function findNamedObject(root, nodeName) {
  if (!root) return null;
  let found = null;
  root.traverse((o) => {
    if (!found && o.name === nodeName) found = o;
  });
  return found;
}

// ============================================================================
// 2. CURVED BEVELED 3D MASONRY GEOMETRY (`arcSlab` & `hexBasaltColumn`)
// ============================================================================

function stripHiddenInnerFaces(geo, innerRadiusThreshold) {
  if (!innerRadiusThreshold || innerRadiusThreshold <= 0) return geo;
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  const pos = nonIndexed.attributes.position;
  const nrm = nonIndexed.attributes.normal;
  const uv = nonIndexed.attributes.uv;
  const triCount = Math.floor(pos.count / 3);

  const keepTris = [];
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = i0 + 1;
    const i2 = i0 + 2;
    const r0 = Math.hypot(pos.getX(i0), pos.getZ(i0));
    const r1 = Math.hypot(pos.getX(i1), pos.getZ(i1));
    const r2 = Math.hypot(pos.getX(i2), pos.getZ(i2));
    if (r0 < innerRadiusThreshold && r1 < innerRadiusThreshold && r2 < innerRadiusThreshold) {
      const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
      const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
      const nx = (nrm.getX(i0) + nrm.getX(i1) + nrm.getX(i2)) / 3;
      const nz = (nrm.getZ(i0) + nrm.getZ(i1) + nrm.getZ(i2)) / 3;
      const ny = (nrm.getY(i0) + nrm.getY(i1) + nrm.getY(i2)) / 3;
      if (cx * nx + cz * nz < -0.04 && Math.abs(ny) < 0.92) {
        continue;
      }
    }
    keepTris.push(t);
  }

  if (keepTris.length === triCount) {
    if (nonIndexed !== geo) nonIndexed.dispose();
    return geo;
  }

  const outCount = keepTris.length * 3;
  const outPos = new Float32Array(outCount * 3);
  const outNrm = new Float32Array(outCount * 3);
  const outUv = uv ? new Float32Array(outCount * 2) : null;

  for (let k = 0; k < keepTris.length; k++) {
    const srcBase = keepTris[k] * 3;
    const dstBase = k * 3;
    for (let v = 0; v < 3; v++) {
      const sv = srcBase + v;
      const dv = dstBase + v;
      outPos[dv * 3] = pos.getX(sv);
      outPos[dv * 3 + 1] = pos.getY(sv);
      outPos[dv * 3 + 2] = pos.getZ(sv);
      outNrm[dv * 3] = nrm.getX(sv);
      outNrm[dv * 3 + 1] = nrm.getY(sv);
      outNrm[dv * 3 + 2] = nrm.getZ(sv);
      if (outUv) {
        outUv[dv * 2] = uv.getX(sv);
        outUv[dv * 2 + 1] = uv.getY(sv);
      }
    }
  }

  const trimmed = new THREE.BufferGeometry();
  trimmed.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  trimmed.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
  if (outUv) trimmed.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
  if (nonIndexed !== geo) nonIndexed.dispose();
  geo.dispose();
  return trimmed;
}

function stripWallBuriedBackFaces(geo, zThreshold = 0, nzThreshold = -0.3) {
  const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
  const pos = nonIndexed.attributes.position;
  const nrm = nonIndexed.attributes.normal;
  const uv = nonIndexed.attributes.uv;
  const triCount = Math.floor(pos.count / 3);

  const keepTris = [];
  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3;
    const i1 = i0 + 1;
    const i2 = i0 + 2;
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
    const nz = (nrm.getZ(i0) + nrm.getZ(i1) + nrm.getZ(i2)) / 3;
    const ny = (nrm.getY(i0) + nrm.getY(i1) + nrm.getY(i2)) / 3;
    if (cz < zThreshold && nz < nzThreshold && Math.abs(ny) < 0.92) {
      continue;
    }
    keepTris.push(t);
  }

  if (keepTris.length === triCount) {
    if (nonIndexed !== geo) nonIndexed.dispose();
    return geo;
  }

  const outCount = keepTris.length * 3;
  const outPos = new Float32Array(outCount * 3);
  const outNrm = new Float32Array(outCount * 3);
  const outUv = uv ? new Float32Array(outCount * 2) : null;
  for (let k = 0; k < keepTris.length; k++) {
    const srcBase = keepTris[k] * 3;
    const dstBase = k * 3;
    for (let v = 0; v < 3; v++) {
      const sv = srcBase + v;
      const dv = dstBase + v;
      outPos[dv * 3] = pos.getX(sv);
      outPos[dv * 3 + 1] = pos.getY(sv);
      outPos[dv * 3 + 2] = pos.getZ(sv);
      outNrm[dv * 3] = nrm.getX(sv);
      outNrm[dv * 3 + 1] = nrm.getY(sv);
      outNrm[dv * 3 + 2] = nrm.getZ(sv);
      if (outUv) {
        outUv[dv * 2] = uv.getX(sv);
        outUv[dv * 2 + 1] = uv.getY(sv);
      }
    }
  }
  const trimmed = new THREE.BufferGeometry();
  trimmed.setAttribute('position', new THREE.BufferAttribute(outPos, 3));
  trimmed.setAttribute('normal', new THREE.BufferAttribute(outNrm, 3));
  if (outUv) trimmed.setAttribute('uv', new THREE.BufferAttribute(outUv, 2));
  if (nonIndexed !== geo) nonIndexed.dispose();
  geo.dispose();
  return trimmed;
}

export function arcSlab(
  r0,
  r1,
  span,
  height,
  bevel = 0.025,
  curveSegments = 3,
  bevelSegments = 1,
  corner = 0,
  stripInnerR = 0
) {
  const a0 = -span * 0.5 - Math.PI * 0.5;
  const a1 = span * 0.5 - Math.PI * 0.5;
  const shape = new THREE.Shape();
  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

  if (corner > 0) {
    const c = Math.min(corner, (r1 - r0) * 0.42, r0 * span * 0.5 * 0.82);
    const o0 = c / r1;
    const i0 = c / r0;
    shape.moveTo(...P(r1, a0 + o0));
    shape.absarc(0, 0, r1, a0 + o0, a1 - o0, false);
    shape.lineTo(...P(r1 - c, a1));
    shape.lineTo(...P(r0 + c, a1));
    shape.lineTo(...P(r0, a1 - i0));
    shape.absarc(0, 0, r0, a1 - i0, a0 + i0, true);
    shape.lineTo(...P(r0 + c, a0));
    shape.lineTo(...P(r1 - c, a0));
    shape.lineTo(...P(r1, a0 + o0));
  } else {
    shape.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
    shape.absarc(0, 0, r1, a0, a1, false);
    shape.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
    shape.absarc(0, 0, r0, a1, a0, true);
  }
  shape.closePath();

  const effBev = Math.min(bevel, height * 0.42);
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, height - effBev * 2),
    bevelEnabled: effBev > 0,
    bevelThickness: effBev,
    bevelSize: effBev,
    bevelSegments: Math.max(1, bevelSegments),
    curveSegments: Math.max(1, curveSegments),
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -height + effBev, 0);
  geo.computeVertexNormals();

  if (stripInnerR > 0) {
    geo = stripHiddenInnerFaces(geo, stripInnerR);
  }
  return geo;
}

function buildHexBasaltGeo(radiusHalfW, height, rf, bevel = 0.022) {
  const shape = new THREE.Shape();
  const rx = radiusHalfW * 1.04;
  const rz = radiusHalfW * 0.88;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TWO_PI + Math.PI / 6;
    const px = Math.cos(a) * rx;
    const pz = Math.sin(a) * rz;
    if (i === 0) shape.moveTo(px, pz);
    else shape.lineTo(px, pz);
  }
  shape.closePath();
  const effBev = Math.min(bevel, height * 0.35, radiusHalfW * 0.35);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.004, height - effBev * 2),
    bevelEnabled: true,
    bevelThickness: effBev,
    bevelSize: effBev,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI * 0.5);
  const centerZ = rf - rz * 0.45;
  geo.translate(0, effBev, centerZ);
  geo.computeVertexNormals();
  return stripWallBuriedBackFaces(geo, centerZ - rz * 0.05, -0.15);
}

// ============================================================================
// 3. 1024x1024 PROCEDURAL PBR SURFACE GENERATOR FOR ALL 5 EARTH WATER BIOMES
// ============================================================================

const SURFACE_TEX_SIZE = 1024;
const SURFACE_CACHE = new Map();

function createLattice256(px, py, rand) {
  const mx = px - 1;
  const my = py - 1;
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const out = new Float32Array(256 * 256);
  const invX = px / 256;
  const invY = py / 256;
  for (let y = 0; y < 256; y++) {
    const fy = y * invY;
    const iy = fy | 0;
    const ty = fy - iy;
    const uy = ty * ty * (3 - 2 * ty);
    const y0 = (iy & my) * px;
    const y1 = ((iy + 1) & my) * px;
    const row = y * 256;
    for (let x = 0; x < 256; x++) {
      const fx = x * invX;
      const ix = fx | 0;
      const tx = fx - ix;
      const ux = tx * tx * (3 - 2 * tx);
      const x0 = ix & mx;
      const x1 = (ix + 1) & mx;
      const a = g[y0 + x0];
      const b = g[y0 + x1];
      const c = g[y1 + x0];
      const d = g[y1 + x1];
      out[row + x] = (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
    }
  }
  return out;
}

function precomputeVoronoiField(gridN, rand) {
  const V_SIZE = 256;
  const pts = new Float32Array(gridN * gridN * 5);
  for (let j = 0; j < gridN; j++) {
    for (let i = 0; i < gridN; i++) {
      const idx = (j * gridN + i) * 5;
      pts[idx] = (i + 0.14 + rand() * 0.72) / gridN;
      pts[idx + 1] = (j + 0.14 + rand() * 0.72) / gridN;
      pts[idx + 2] = rand();
      pts[idx + 3] = rand();
      pts[idx + 4] = rand();
    }
  }
  const edgeBuf = new Float32Array(V_SIZE * V_SIZE);
  const toneBuf = new Float32Array(V_SIZE * V_SIZE);

  for (let y = 0; y < V_SIZE; y++) {
    const v = y / V_SIZE;
    const cj = Math.floor(v * gridN);
    for (let x = 0; x < V_SIZE; x++) {
      const u = x / V_SIZE;
      const ci = Math.floor(u * gridN);
      let d1 = 99;
      let d2 = 99;
      let bestIdx = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = cj + dj;
        const wj = ((jj % gridN) + gridN) % gridN;
        const offY = Math.floor(jj / gridN);
        for (let di = -1; di <= 1; di++) {
          const ii = ci + di;
          const wi = ((ii % gridN) + gridN) % gridN;
          const offX = Math.floor(ii / gridN);
          const pIdx = (wj * gridN + wi) * 5;
          const dx = (u - (pts[pIdx] + offX)) * gridN;
          const dy = (v - (pts[pIdx + 1] + offY)) * gridN;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            bestIdx = pIdx;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const k = y * V_SIZE + x;
      edgeBuf[k] = d2 - d1;
      toneBuf[k] = pts[bestIdx + 4];
    }
  }
  return { edgeBuf, toneBuf };
}

function makeDataTex(data, size, srgb, repeatVal) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(repeatVal, repeatVal);
  tex.needsUpdate = true;
  tex.userData.shared = true;
  return tex;
}

const SURFACE_ALIAS = {
  canyon_sandstone: 'canyon_sandstone',
  alpine_granite: 'alpine_granite',
  bayou_limestone: 'bayou_limestone',
  coral_travertine: 'coral_travertine',
  storm_basalt: 'storm_basalt',
  redwood_timber: 'redwood_timber',
  antique_bronze: 'antique_bronze',
  mist_slate: 'bayou_limestone',
  sinking_limestone: 'coral_travertine',
  foundry_iron: 'canyon_sandstone',
  blizzard_ice: 'alpine_granite',
  prism_obsidian: 'coral_travertine',
  piston_steel: 'storm_basalt',
  blackout_basalt: 'storm_basalt',
  apex_monolith: 'storm_basalt',
};

const SURFACE_REF_TINT = {
  canyon_sandstone: '#b6603e',
  alpine_granite: '#95a5b9',
  bayou_limestone: '#546658',
  coral_travertine: '#dad0bb',
  storm_basalt: '#29354a',
  redwood_timber: '#6e341d',
  antique_bronze: '#b88946',
};

const _whiteColor = new THREE.Color('#ffffff');
const BAKED_WEBP_CACHE = new Map();

function cloneLoadedWebpTex(srcTex, tile, isSrgb) {
  const t = srcTex.clone();
  t.image = srcTex.image;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.repeat.set(tile, tile);
  t.needsUpdate = true;
  t.userData = { shared: true };
  return t;
}

function applyBakedMaterialUpgrade(mat, entry) {
  if (!mat || !entry?.hasBakedWebp) return;
  mat.map = entry.map;
  mat.normalMap = entry.normalMap;
  mat.roughnessMap = entry.ormMap;
  mat.aoMap = entry.ormMap;
  if (mat.userData?.useMetalMap) {
    mat.metalnessMap = entry.ormMap;
  }
  if (mat.userData?.hasRichAlbedo) {
    mat.userData.hasRichAlbedo.value = 1.0;
  }
  if (mat.userData?.richTintColor) {
    mat.color.copy(mat.userData.richTintColor);
  } else if (mat.userData?.baseColor && !mat.userData?.keepFullTint) {
    const lift = typeof mat.userData.richAlbedoLift === 'number' ? mat.userData.richAlbedoLift : 0.8;
    mat.color.copy(mat.userData.baseColor).lerp(_whiteColor, lift);
  }
  mat.needsUpdate = true;
}

function subscribeMaterialToSurface(entry, mat) {
  if (!entry || !mat) return;
  entry.subscribers.add(mat);
  if (entry.hasBakedWebp) {
    applyBakedMaterialUpgrade(mat, entry);
  }
}

function bindRawWebpToEntry(entry, rawSet) {
  if (!entry || !rawSet || entry.hasBakedWebp) return;
  entry.map = cloneLoadedWebpTex(rawSet.albedo, entry.tile, true);
  entry.normalMap = cloneLoadedWebpTex(rawSet.normal, entry.tile, false);
  entry.ormMap = cloneLoadedWebpTex(rawSet.orm, entry.tile, false);
  entry.hasBakedWebp = true;
  for (const mat of entry.subscribers) {
    applyBakedMaterialUpgrade(mat, entry);
  }
}

function ensureBakedWebpSurface(kind) {
  if (BAKED_WEBP_CACHE.has(kind)) return BAKED_WEBP_CACHE.get(kind);
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !window.location?.href
  ) {
    return null;
  }

  let loader;
  try {
    loader = new THREE.TextureLoader();
  } catch {
    return null;
  }

  const record = { ready: false, albedo: null, normal: null, orm: null };
  BAKED_WEBP_CACHE.set(kind, record);

  const loadOne = (suffix, isSrgb, slotKey) => {
    try {
      const url = new URL(`../assets/textures/arch_${kind}_${suffix}.webp`, import.meta.url).href;
      loader.load(
        url,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.anisotropy = 8;
          tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.userData = { shared: true };
          record[slotKey] = tex;
          if (record.albedo && record.normal && record.orm && !record.ready) {
            record.ready = true;
            for (const entry of SURFACE_CACHE.values()) {
              if (entry.kind === kind) {
                bindRawWebpToEntry(entry, record);
              }
            }
          }
        },
        undefined,
        () => {
          // Procedural 1024x1024 fallback remains active if offline fetch is unavailable
        }
      );
    } catch {
      // Ignore relative URL resolution errors in non-browser runtimes
    }
  };

  loadOne('albedo', true, 'albedo');
  loadOne('normal', false, 'normal');
  loadOne('orm', false, 'orm');
  return record;
}

export function getSurfaceMaps1024(rawKind = 'canyon_sandstone', tile = 0.55) {
  const kind = SURFACE_ALIAS[rawKind] || 'canyon_sandstone';
  const cacheKey = `${kind}_${tile}`;
  if (SURFACE_CACHE.has(cacheKey)) return SURFACE_CACHE.get(cacheKey);

  const N = SURFACE_TEX_SIZE;
  const seedMap = {
    canyon_sandstone: 2113,
    alpine_granite: 3251,
    bayou_limestone: 4397,
    coral_travertine: 5501,
    storm_basalt: 6653,
    redwood_timber: 7789,
    antique_bronze: 8893,
  };
  const rand = mulberry32(seedMap[kind] || 2113);

  const b8 = createLattice256(8, 8, rand);
  const b16 = createLattice256(16, 16, rand);
  const b32 = createLattice256(32, 32, rand);
  const b64 = createLattice256(64, 64, rand);
  const bHoriz = createLattice256(8, 128, rand);
  const bVert = createLattice256(128, 8, rand);
  const fine128 = createLattice256(64, 64, rand);
  const vor = precomputeVoronoiField(9, rand);
  const edgeBuf = vor.edgeBuf;
  const toneBuf = vor.toneBuf;

  const hBuf = new Float32Array(N * N);
  const albData = new Uint8Array(N * N * 4);
  const ormData = new Uint8Array(N * N * 4);
  const nrmData = new Uint8Array(N * N * 4);

  const kindId =
    kind === 'canyon_sandstone'
      ? 0
      : kind === 'alpine_granite'
      ? 1
      : kind === 'bayou_limestone'
      ? 2
      : kind === 'coral_travertine'
      ? 3
      : kind === 'storm_basalt'
      ? 4
      : kind === 'antique_bronze'
      ? 6
      : 5;

  for (let y = 0; y < N; y++) {
    const uy0 = y >> 2;
    const uy1 = (uy0 + 1) & 255;
    const fy = (y & 3) * 0.25;
    const wy0 = uy0 << 8;
    const wy1 = uy1 << 8;
    const fyRow = (y & 255) << 8;
    const yRow = y * N;

    for (let x = 0; x < N; x++) {
      const i = yRow + x;
      const i4 = i << 2;
      const ux0 = x >> 2;
      const ux1 = (ux0 + 1) & 255;
      const fx = (x & 3) * 0.25;
      const i00 = wy0 + ux0;
      const i10 = wy0 + ux1;
      const i01 = wy1 + ux0;
      const i11 = wy1 + ux1;

      const n8v = (b8[i00] + (b8[i10] - b8[i00]) * fx) * (1 - fy) + (b8[i01] + (b8[i11] - b8[i01]) * fx) * fy;
      const n16v = (b16[i00] + (b16[i10] - b16[i00]) * fx) * (1 - fy) + (b16[i01] + (b16[i11] - b16[i01]) * fx) * fy;
      const mid = (b32[i00] + (b32[i10] - b32[i00]) * fx) * (1 - fy) + (b32[i01] + (b32[i11] - b32[i01]) * fx) * fy;
      const fine = b64[i00] * 0.45 + fine128[fyRow + (x & 255)] * 0.55;
      const broad = n8v * 0.58 + n16v * 0.42;
      const eVal = (edgeBuf[i00] + (edgeBuf[i10] - edgeBuf[i00]) * fx) * (1 - fy) + (edgeBuf[i01] + (edgeBuf[i11] - edgeBuf[i01]) * fx) * fy;

      let hHash = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
      hHash = Math.imul(hHash ^ (hHash >>> 13), 1274126177) >>> 0;
      const gNorm = (hHash & 1023) * 0.0009775;

      // Chiseled running-bond sub-ashlar courses
      const dyRow = (y + ((mid * 5.0) | 0)) & 127;
      const hDist = dyRow < 64 ? dyRow : 128 - dyRow;
      const subRow = (y / 128) | 0;
      const colShift = (subRow & 1) * 128 + ((subRow * 73) & 3) * 32;
      const dxCol = (x + colShift + ((n16v * 8.0) | 0)) & 255;
      const vDist = dxCol < 128 ? dxCol : 256 - dxCol;
      const subMortar = Math.max(hDist < 3 ? 1.0 - hDist / 3 : 0.0, vDist < 3 ? 1.0 - vDist / 3 : 0.0);
      const subBevel = (hDist < 11 ? (11 - hDist) * 0.026 : 0) + (vDist < 11 ? (11 - vDist) * 0.022 : 0);

      let ht = 0.5;
      let cr = 0.9;
      let cg = 0.9;
      let cb = 0.9;
      let ao = 1.0;
      let rough = 0.65;
      let metal = 0.04;

      if (kindId === 0) {
        // canyon_sandstone — Cross-bedded warm red-rock strata + quartz sparkle + ashlar tooling
        const strataY = (uy0 + ((broad * 22) | 0)) & 255;
        const strata = bHoriz[(strataY << 8) + ux0];
        const crack = eVal < 0.04 ? 1 - eVal / 0.04 : 0;
        ht = strata * 0.42 + broad * 0.28 + fine * 0.22 - subBevel - subMortar * 0.52 - crack * 0.32 + (gNorm - 0.5) * 0.06;
        const v = 0.87 + (strata - 0.5) * 0.26 + (broad - 0.5) * 0.16 - subMortar * 0.42 - crack * 0.24;
        cr = v * 1.04;
        cg = v * (0.94 + strata * 0.06);
        cb = v * 0.88;
        ao = Math.max(0.28, 1.0 - subMortar * 0.62 - crack * 0.38 - subBevel * 0.2);
        rough = Math.max(0.42, Math.min(0.9, 0.68 + fine * 0.16 - (gNorm > 0.96 ? 0.22 : 0)));
        metal = 0.03;
      } else if (kindId === 1) {
        // alpine_granite — Crisp drafted silver-quartz granite ashlar + crystalline mica flecks
        const mica = gNorm > 0.94 ? (gNorm - 0.94) * 8.0 : 0;
        const crack = eVal < 0.034 ? 1 - eVal / 0.034 : 0;
        const facet = toneBuf[i00];
        ht = broad * 0.26 + mid * 0.24 + fine * 0.28 - subBevel * 1.15 - subMortar * 0.58 - crack * 0.25;
        const v = 0.9 + (facet - 0.5) * 0.14 + (fine - 0.5) * 0.16 + mica * 0.18 - subMortar * 0.48;
        cr = v * 0.97;
        cg = v * 0.99;
        cb = Math.min(1.0, v * 1.03);
        ao = Math.max(0.32, 1.0 - subMortar * 0.65 - crack * 0.3 - subBevel * 0.24);
        rough = Math.max(0.22, Math.min(0.76, 0.46 + fine * 0.18 - mica * 0.24));
        metal = 0.08 + mica * 0.15;
      } else if (kindId === 2) {
        // bayou_limestone — Ancient carved temple limestone + velvety moss pockets + rain streaks
        const crack = eVal < 0.048 ? 1 - eVal / 0.048 : 0;
        const pSample = fine128[(((y + 23) & 255) << 8) + ((x + 41) & 255)];
        const pit = pSample > 0.74 ? (pSample - 0.74) * 3.5 : 0;
        const mossRaw = b16[(((uy0 + 19) & 255) << 8) + ((ux0 + 31) & 255)] * 0.65 + fine * 0.35;
        const moss = mossRaw > 0.64 ? (mossRaw - 0.64) * 2.6 : 0;
        ht = broad * 0.38 + mid * 0.28 + fine * 0.24 - subBevel - subMortar * 0.55 - crack * 0.42 - pit * 0.44 + moss * 0.12;
        const v = 0.85 + (broad - 0.5) * 0.24 - subMortar * 0.48 - crack * 0.32 - pit * 0.18;
        cr = v * (0.96 - moss * 0.26);
        cg = v * (1.01 + moss * 0.12);
        cb = v * (0.95 - moss * 0.28);
        ao = Math.max(0.24, 1.0 - subMortar * 0.66 - crack * 0.44 - pit * 0.36);
        rough = Math.max(0.34, Math.min(0.92, 0.64 + moss * 0.22 + fine * 0.14));
        metal = 0.04;
      } else if (kindId === 3) {
        // coral_travertine — Sun-bleached fossilized coral-limestone + wave flutes + nacre sheen
        const flute = bHoriz[fyRow + ((ux0 + ((mid * 10) | 0)) & 255)];
        const pSample = fine128[(((y + 53) & 255) << 8) + ((x + 71) & 255)];
        const pore = pSample > 0.76 ? (pSample - 0.76) * 3.4 : 0;
        const crack = eVal < 0.04 ? 1 - eVal / 0.04 : 0;
        ht = flute * 0.34 + broad * 0.3 + fine * 0.22 - pore * 0.45 - subMortar * 0.44 - crack * 0.25;
        const v = 0.91 + (flute - 0.5) * 0.18 + (broad - 0.5) * 0.14 - pore * 0.18 - subMortar * 0.36;
        cr = Math.min(1.0, v * 1.02);
        cg = v * 1.0;
        cb = v * 0.95;
        ao = Math.max(0.36, 1.0 - pore * 0.4 - subMortar * 0.52 - crack * 0.28);
        rough = Math.max(0.28, Math.min(0.78, 0.48 + fine * 0.2 + pore * 0.18));
        metal = 0.07;
      } else if (kindId === 4) {
        // storm_basalt — Columnar volcanic basalt + machined titanium armor seams
        const stria = bVert[(uy0 << 8) + (x & 255)];
        const crack = eVal < 0.042 ? 1 - eVal / 0.042 : 0;
        const seam = ((x & 127) < 3 || (y & 127) < 3) ? 1.0 : 0.0;
        ht = stria * 0.34 + broad * 0.24 + fine * 0.18 - seam * 0.46 - crack * 0.28 + (gNorm - 0.5) * 0.04;
        const v = 0.86 + (stria - 0.5) * 0.2 + (broad - 0.5) * 0.14 - seam * 0.34 - crack * 0.2;
        cr = v * 0.96;
        cg = v * 0.99;
        cb = Math.min(1.0, v * 1.04);
        ao = Math.max(0.34, 1.0 - seam * 0.48 - crack * 0.32);
        rough = Math.max(0.22, Math.min(0.68, 0.32 + fine * 0.22 + crack * 0.18));
        metal = 0.38 + (1.0 - seam) * 0.18;
      } else if (kindId === 6) {
        // antique_bronze — Planished hammered bronze + embossed filigree + rivet straps + cavity patina
        const strap = ((x & 255) < 12 || (y & 255) < 12) ? 1.0 : 0.0;
        const dimple = Math.max(0, 0.09 - eVal) * 8.5;
        const scroll = 0.5 + 0.5 * Math.sin(x * 0.049087 + Math.sin(y * 0.049087) * 1.4);
        const emboss = (1 - strap) * (scroll > 0.72 ? (scroll - 0.72) * 1.8 : 0);
        ht = broad * 0.16 + fine * 0.12 - dimple * 0.12 + strap * 0.24 + emboss * 0.22;
        const v = 0.88 + (broad - 0.5) * 0.14 + emboss * 0.14 - dimple * 0.08;
        cr = Math.min(1.0, v * 1.04);
        cg = v * 0.94;
        cb = v * 0.82;
        ao = Math.max(0.38, 1.0 - dimple * 0.28);
        rough = Math.max(0.18, Math.min(0.62, 0.3 + fine * 0.16 - emboss * 0.08));
        metal = 0.9;
      } else {
        // redwood_timber — Deep grained seasoned redwood planks & beams
        const grain = bVert[(uy0 << 8) + (x & 255)] * 0.65 + bHoriz[fyRow + ux0] * 0.35;
        const plank = (y & 63) < 3 ? 1.0 : 0.0;
        ht = grain * 0.38 + fine * 0.18 - plank * 0.52;
        const v = 0.86 + (grain - 0.5) * 0.26 - plank * 0.38;
        cr = Math.min(1.0, v * 1.06);
        cg = v * 0.92;
        cb = v * 0.86;
        ao = Math.max(0.35, 1.0 - plank * 0.55);
        rough = 0.58 + fine * 0.2;
        metal = 0.04;
      }

      hBuf[i] = ht;
      albData[i4] = cr <= 0 ? 0 : cr >= 1 ? 255 : (cr * 255 + 0.5) | 0;
      albData[i4 + 1] = cg <= 0 ? 0 : cg >= 1 ? 255 : (cg * 255 + 0.5) | 0;
      albData[i4 + 2] = cb <= 0 ? 0 : cb >= 1 ? 255 : (cb * 255 + 0.5) | 0;
      albData[i4 + 3] = 255;

      ormData[i4] = ao <= 0 ? 0 : ao >= 1 ? 255 : (ao * 255 + 0.5) | 0;
      ormData[i4 + 1] = rough <= 0 ? 0 : rough >= 1 ? 255 : (rough * 255 + 0.5) | 0;
      ormData[i4 + 2] = metal <= 0 ? 0 : metal >= 1 ? 255 : (metal * 255 + 0.5) | 0;
      ormData[i4 + 3] = 255;
    }
  }

  const strengthMap = {
    canyon_sandstone: 4.2,
    alpine_granite: 3.6,
    bayou_limestone: 4.5,
    coral_travertine: 3.8,
    storm_basalt: 3.5,
    redwood_timber: 3.2,
    antique_bronze: 3.4,
  };
  const kStrength = strengthMap[kind] || 3.8;
  const mask = N - 1;

  for (let y = 0; y < N; y++) {
    const ym = ((y - 1) & mask) * N;
    const yp = ((y + 1) & mask) * N;
    const yRow = y * N;
    for (let x = 0; x < N; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;
      const i4 = (yRow + x) << 2;
      const nx = -(hBuf[yRow + xp] - hBuf[yRow + xm]) * kStrength;
      const ny = (hBuf[yp + x] - hBuf[ym + x]) * kStrength;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nrmData[i4] = ((nx * invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      nrmData[i4 + 1] = ((ny * invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      nrmData[i4 + 2] = ((invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      nrmData[i4 + 3] = 255;
    }
  }

  const entry = {
    kind,
    tile,
    hasBakedWebp: false,
    subscribers: new Set(),
    map: makeDataTex(albData, N, true, tile),
    normalMap: makeDataTex(nrmData, N, false, tile),
    ormMap: makeDataTex(ormData, N, false, tile),
  };
  SURFACE_CACHE.set(cacheKey, entry);

  const rawWebp = ensureBakedWebpSurface(kind);
  if (rawWebp?.ready) {
    bindRawWebpToEntry(entry, rawWebp);
  }
  return entry;
}

// ============================================================================
// 4. WATERLINE WETNESS, BAKED BOUNCE-AO & CURVED BLOCK SHADER MATERIALS
// ============================================================================

function attachWaterlineShader(mat, wetStrength = 0.78) {
  mat.userData.waterY = mat.userData.waterY || { value: -0.82 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterY = mat.userData.waterY;
    shader.uniforms.uWetStrength = { value: wetStrength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArchWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 archWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          archWp = instanceMatrix * archWp;
        #endif
        vArchWorldPos = (modelMatrix * archWp).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vArchWorldPos;\nuniform float uWaterY;\nuniform float uWetStrength;'
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float archWet = (1.0 - smoothstep(uWaterY + 0.08, uWaterY + 2.35, vArchWorldPos.y)) * uWetStrength;
        float algaeWave = 0.5 + 0.5 * sin(vArchWorldPos.x * 2.8 + sin(vArchWorldPos.y * 3.2) * 1.4) * cos(vArchWorldPos.z * 2.9 - vArchWorldPos.y * 1.9);
        float archAlgae = archWet * smoothstep(0.45, 0.86, algaeWave);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.50, 0.56, 0.62), archWet * 0.58);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07, 0.16, 0.12), archAlgae * 0.22);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, (1.0 - smoothstep(uWaterY + 0.08, uWaterY + 2.1, vArchWorldPos.y)) * uWetStrength * 0.68);`
      );
  };
  mat.customProgramCacheKey = () => `arch_wet_v3_${wetStrength > 0.01 ? '1' : '0'}`;
  return mat;
}

let DEFAULT_WALL_AO_TEX = null;
function getDefaultWallAoTex() {
  if (DEFAULT_WALL_AO_TEX) return DEFAULT_WALL_AO_TEX;
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  tex.userData.shared = true;
  DEFAULT_WALL_AO_TEX = tex;
  return tex;
}

function buildWallAoLightTexture(tower, fh, totalH, clueEntries = null, conduitAngles = []) {
  const W = 80;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  const aoGrid = new Float32Array(W * H);
  const warmGrid = new Float32Array(W * H);
  const coolGrid = new Float32Array(W * H);
  const invTotalH = 1 / Math.max(3, totalH);

  const stamp = (phiCenter, yTop, yBot, halfAng, rAmt, gAmt, bAmt) => {
    const v0 = Math.max(0, Math.min(H - 1, Math.floor(yBot * invTotalH * H)));
    const v1 = Math.max(0, Math.min(H - 1, Math.ceil(yTop * invTotalH * H)));
    const spanY = Math.max(0.05, yTop - yBot);
    for (let vy = v0; vy <= v1; vy++) {
      const wy = ((vy + 0.5) / H) * totalH;
      const tVert = Math.max(0, Math.min(1, (yTop - wy) / spanY));
      const vWeight = rAmt > 0 ? Math.pow(1 - tVert, 1.35) : Math.sin(tVert * Math.PI);
      const rowOff = vy * W;
      for (let ux = 0; ux < W; ux++) {
        const ang = ((ux + 0.5) / W) * TWO_PI;
        const da = Math.abs(angDist(ang, phiCenter));
        if (da >= halfAng) continue;
        const hWeight = 1 - Math.pow(da / halfAng, 2.2);
        const w = vWeight * hWeight;
        const idx = rowOff + ux;
        if (rAmt > 0) aoGrid[idx] = Math.min(1, Math.max(aoGrid[idx], w * rAmt));
        if (gAmt > 0) warmGrid[idx] = Math.min(1, warmGrid[idx] + w * gAmt);
        if (bAmt > 0) coolGrid[idx] = Math.min(1, coolGrid[idx] + w * bAmt);
      }
    }
  };

  for (const l of tower?.ledges || []) {
    if (l.type === 'box' || l.type === 'laserGate') continue;
    const phi = (l.col + 0.5) * COL_ANGLE;
    const ly = l.floor * fh;
    stamp(phi, ly + 0.04, ly - 0.95, COL_ANGLE * 0.78, 0.82, 0, 0);
    stamp(phi, ly + 0.22, ly - 0.03, COL_ANGLE * 0.65, 0.32, 0, 0);
  }

  for (const el of tower?.elevators || []) {
    const phi = (el.col + 0.5) * COL_ANGLE;
    const topY = (el.maxFloor + 1.55) * fh;
    const startY = (el.startFloor ?? el.minFloor ?? 0) * fh;
    stamp(phi, topY + 0.12, topY - 1.35, COL_ANGLE * 0.82, 0.82, 0.62, 0.25);
    stamp(phi, startY + 1.6, startY - 0.4, COL_ANGLE * 0.88, 0, 0.35, 0.55);
  }

  for (const d of tower?.doors || []) {
    const phi = (d.col + 0.5) * COL_ANGLE;
    const dy = d.floor * fh;
    stamp(phi, dy + DOOR_H + 0.35, dy - 0.2, COL_ANGLE * 0.92, 0.36, 0.28, 0.68);
  }

  for (let i = 0; i < conduitAngles.length; i++) {
    stamp(conduitAngles[i], totalH, 0, COL_ANGLE * 0.48, 0.25, 0, 0.55);
  }

  if (Array.isArray(clueEntries)) {
    for (const ce of clueEntries) {
      const cPhi = ce.colCenter * COL_ANGLE;
      const cy = ce.floorY * fh;
      stamp(cPhi, cy + 1.05, cy - 1.05, COL_ANGLE * 0.95, 0.24, 0, 0.78);
    }
  }

  for (let i = 0; i < W * H; i++) {
    const i4 = i << 2;
    data[i4] = Math.min(255, (aoGrid[i] * 255 + 0.5) | 0);
    data[i4 + 1] = Math.min(255, (warmGrid[i] * 255 + 0.5) | 0);
    data[i4 + 2] = Math.min(255, (coolGrid[i] * 255 + 0.5) | 0);
    data[i4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const BLOCK_MAT_CACHE = new Map();
const TRIM_METAL_RICH_TINT = {
  canyon_river: '#ffd8be',
  alpine_lake: '#fff3d1',
  mist_bayou: '#edd8b4',
  coral_sea: '#b8f5e8',
  storm_ocean: '#ffdfc4',
};

function createTrimMetalMaterial(rbTheme, spec) {
  const maps = getSurfaceMaps1024('antique_bronze', 1.35);
  const baseCol = new THREE.Color(spec.metalTrim || '#c8703e');
  const richCol = new THREE.Color(TRIM_METAL_RICH_TINT[rbTheme] || '#ffe4c8');
  const mat = new THREE.MeshStandardMaterial({
    color: maps.hasBakedWebp ? richCol.clone() : baseCol.clone(),
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.88, 0.88),
    roughnessMap: maps.ormMap,
    aoMap: maps.ormMap,
    aoMapIntensity: 0.72,
    metalnessMap: maps.ormMap,
    roughness: 0.36,
    metalness: 0.88,
  });
  mat.userData.useMetalMap = true;
  mat.userData.baseColor = baseCol;
  mat.userData.richTintColor = richCol;
  attachWaterlineShader(mat, 0.55);
  subscribeMaterialToSurface(maps, mat);
  return mat;
}

export function createBlockMaterial({
  color = '#ffffff',
  surface = 'canyon_sandstone',
  tile = 0.55,
  roughness = 0.52,
  metalness = 0.08,
  normalScale = 1.15,
  hi = '#eef6ff',
  brickHalf = [0.28, 0.14],
  edgeDarken = 0.24,
  emissive = '#000000',
  emissiveIntensity = 0,
  angular = true,
  wetStrength = 0.8,
  useMetalMap = false,
  wallAoTex = null,
  totalH = 27.0,
  richAlbedoLift = 0.82,
} = {}) {
  const hasWallAo = Boolean(wallAoTex);
  const resolvedKind = SURFACE_ALIAS[surface] || 'canyon_sandstone';
  const cacheKey = `${resolvedKind}|${color}|${tile}|${roughness}|${metalness}|${normalScale}|${hi}|${brickHalf[0].toFixed(3)}_${brickHalf[1].toFixed(3)}|${edgeDarken}|${emissive}|${emissiveIntensity}|${angular ? 1 : 0}|${wetStrength}|${useMetalMap ? 1 : 0}|${hasWallAo ? 1 : 0}`;
  const existing = BLOCK_MAT_CACHE.get(cacheKey);
  if (existing) {
    if (wallAoTex) existing.userData.wallAoUniform.value = wallAoTex;
    existing.userData.totalHUniform.value = Math.max(3.0, totalH);
    return existing;
  }

  const maps = getSurfaceMaps1024(resolvedKind, tile);
  const baseColorObj = new THREE.Color(color);
  const isNeutralWhite = baseColorObj.r > 0.98 && baseColorObj.g > 0.98 && baseColorObj.b > 0.98;
  const mat = new THREE.MeshStandardMaterial({
    color: baseColorObj.clone(),
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.55 * normalScale, 0.55 * normalScale),
    roughnessMap: maps.ormMap,
    aoMap: maps.ormMap,
    aoMapIntensity: 0.88,
    roughness,
    metalness,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  });
  if (useMetalMap) {
    mat.metalnessMap = maps.ormMap;
  }

  const refTintColor = new THREE.Color(SURFACE_REF_TINT[resolvedKind] || '#999999');
  mat.userData.shared = true;
  mat.userData.useMetalMap = useMetalMap;
  mat.userData.baseColor = baseColorObj;
  mat.userData.keepFullTint = isNeutralWhite;
  mat.userData.richAlbedoLift = richAlbedoLift;
  mat.userData.hasRichAlbedo = { value: maps.hasBakedWebp ? 1.0 : 0.0 };
  mat.userData.waterY = { value: -0.82 };
  mat.userData.wallAoUniform = { value: wallAoTex || getDefaultWallAoTex() };
  mat.userData.totalHUniform = { value: Math.max(3.0, totalH) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterY = mat.userData.waterY;
    shader.uniforms.uWetStrength = { value: wetStrength };
    shader.uniforms.uEdgeDarken = { value: edgeDarken };
    shader.uniforms.uBrickHi = { value: new THREE.Color(hi) };
    shader.uniforms.uBrickHalf = { value: new THREE.Vector2(brickHalf[0], brickHalf[1]) };
    shader.uniforms.uWallAoMap = mat.userData.wallAoUniform;
    shader.uniforms.uTotalH = mat.userData.totalHUniform;
    shader.uniforms.uHasRichAlbedo = mat.userData.hasRichAlbedo;
    shader.uniforms.uRefTint = { value: refTintColor };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vArchWorldPos;\nvarying vec3 vArchTowerPos;\nvarying vec3 vBrickN;\nvarying vec2 vBrickP;' +
          (angular ? '\nattribute float aSpan;' : '')
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        ${
          angular
            ? `{
          float dAng = atan(position.x, position.z) * (aSpan - 1.0);
          float cd = cos(dAng);
          float sd = sin(dAng);
          objectNormal.xz = vec2(objectNormal.x * cd + objectNormal.z * sd, objectNormal.z * cd - objectNormal.x * sd);
        }`
            : ''
        }
        {
          vec2 rad = length(position.xz) > 1e-4 ? normalize(position.xz) : vec2(0.0, 1.0);
          vec2 tng = vec2(rad.y, -rad.x);
          vBrickN = vec3(dot(objectNormal.xz, tng), objectNormal.y, dot(objectNormal.xz, rad));
          vBrickP = vec2(atan(position.x, position.z) * length(position.xz), position.y);
        }`
      )
      .replace(
        '#include <begin_vertex>',
        angular
          ? `#include <begin_vertex>
        {
          float rr = length(transformed.xz);
          float aa = atan(transformed.x, transformed.z) * aSpan;
          transformed.x = sin(aa) * rr;
          transformed.z = cos(aa) * rr;
        }`
          : '#include <begin_vertex>'
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec2 brickUvOff = fract(vec2(float(gl_InstanceID) * 0.6180339, float(gl_InstanceID) * 0.3819660)) * 5.0;
          #ifdef USE_MAP
            vMapUv += brickUvOff;
          #endif
          #ifdef USE_NORMALMAP
            vNormalMapUv += brickUvOff;
          #endif
          #ifdef USE_ROUGHNESSMAP
            vRoughnessMapUv += brickUvOff;
          #endif
          #ifdef USE_AOMAP
            vAoMapUv += brickUvOff;
          #endif
          #ifdef USE_METALNESSMAP
            vMetalnessMapUv += brickUvOff;
          #endif
        #endif`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 archWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          archWp = instanceMatrix * archWp;
        #endif
        vArchTowerPos = archWp.xyz;
        vArchWorldPos = (modelMatrix * archWp).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vArchWorldPos;
        varying vec3 vArchTowerPos;
        varying vec3 vBrickN;
        varying vec2 vBrickP;
        uniform float uWaterY;
        uniform float uWetStrength;
        uniform float uEdgeDarken;
        uniform vec3 uBrickHi;
        uniform vec2 uBrickHalf;
        uniform sampler2D uWallAoMap;
        uniform float uTotalH;
        uniform float uHasRichAlbedo;
        uniform vec3 uRefTint;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float archWet = (1.0 - smoothstep(uWaterY + 0.08, uWaterY + 2.45, vArchWorldPos.y)) * uWetStrength;
        float algaeWave = 0.5 + 0.5 * sin(vArchWorldPos.x * 2.8 + sin(vArchWorldPos.y * 3.4) * 1.5) * cos(vArchWorldPos.z * 3.1 - vArchWorldPos.y * 2.0);
        float archAlgae = archWet * smoothstep(0.44, 0.86, algaeWave);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.48, 0.54, 0.62), archWet * 0.58);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.14, 0.10), archAlgae * 0.22);`
      )
      .replace(
        '#include <color_fragment>',
        `vec3 archPreCol = diffuseColor.rgb;
        #include <color_fragment>
        #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
        if (uHasRichAlbedo > 0.5) {
          float refLum = max(0.035, dot(uRefTint, vec3(0.299, 0.587, 0.114)));
          float vLum = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
          float relShade = clamp(vLum / refLum, 0.44, 1.32);
          vec3 refChroma = uRefTint / refLum;
          vec3 vChroma = vColor.rgb / max(0.035, vLum);
          float bandShift = clamp(length(vChroma - refChroma) * 0.62, 0.0, 0.62);
          vec3 richBrick = archPreCol * mix(1.0, relShade, 0.86);
          richBrick = mix(richBrick, richBrick * clamp(vChroma * 0.88, vec3(0.48), vec3(1.62)), bandShift);
          diffuseColor.rgb = mix(diffuseColor.rgb, richBrick, uHasRichAlbedo);
        }
        #endif
        #ifdef USE_INSTANCING
        {
          vec3 bn = normalize(vBrickN);
          float hiK = clamp(smoothstep(0.24, 0.86, bn.y) + 0.55 * smoothstep(0.24, 0.86, bn.x), 0.0, 1.0);
          float loK = clamp(smoothstep(0.18, 0.80, -bn.y) + 0.58 * smoothstep(0.18, 0.80, -bn.x), 0.0, 1.0);
          vec2 fp = clamp(vec2(vBrickP.x / max(0.03, uBrickHalf.x), (vBrickP.y - uBrickHalf.y) / max(0.03, uBrickHalf.y)), -1.0, 1.0);
          float edgeCrevice = smoothstep(0.74, 1.0, max(abs(fp.x), abs(fp.y)));
          float faceGrad = fp.y * 0.44 + fp.x * 0.28;
          diffuseColor.rgb *= (1.0 + faceGrad * 0.09) * (1.0 - edgeCrevice * 0.28);
          vec3 lum = vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
          diffuseColor.rgb = mix(diffuseColor.rgb, uBrickHi * max(lum * 1.65, vec3(0.32)), hiK * 0.42);
          diffuseColor.rgb *= 1.0 - loK * 0.52;
        }
        #endif`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.24, (1.0 - smoothstep(uWaterY + 0.08, uWaterY + 2.2, vArchWorldPos.y)) * uWetStrength * 0.62);`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          float angU = fract(atan(vArchTowerPos.x, vArchTowerPos.z) / 6.2831853 + 1.0);
          float altV = clamp(vArchTowerPos.y / uTotalH, 0.0, 1.0);
          vec3 aoBounce = texture2D(uWallAoMap, vec2(angU, altV)).rgb;
          outgoingLight *= (1.0 - aoBounce.r * 0.72);
          outgoingLight += diffuseColor.rgb * vec3(1.35, 0.88, 0.36) * aoBounce.g * 0.78;
          outgoingLight += diffuseColor.rgb * vec3(0.28, 1.18, 1.12) * aoBounce.b * 0.62;
          float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          outgoingLight *= mix(1.0 - uEdgeDarken, 1.0, smoothstep(0.05, 0.74, ndv));
        }
        #include <opaque_fragment>`
      );
  };

  mat.customProgramCacheKey = () =>
    `arch_block_v4_${angular ? 'A' : 'S'}_${useMetalMap ? 'M' : 'N'}_${hasWallAo ? 'W' : '0'}`;
  subscribeMaterialToSurface(maps, mat);
  BLOCK_MAT_CACHE.set(cacheKey, mat);
  return mat;
}

// ============================================================================
// 5. HYDRO-CONDUIT FLOWING WATER SHADER, PORTAL SHADER & PROCEDURAL PROP MAPS
// ============================================================================

function createHydroConduitMaterial(deepHex, glowHex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFlowDir: { value: -1.0 }, // -1 siphon drain -> +1.8 upward purification surge!
      uPurify: { value: 0.0 },
      uDeep: { value: new THREE.Color(deepHex) },
      uGlow: { value: new THREE.Color(glowHex) },
      uGold: { value: new THREE.Color('#fef08a') },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNrm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNrm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uFlowDir;
      uniform float uPurify;
      uniform vec3 uDeep;
      uniform vec3 uGlow;
      uniform vec3 uGold;
      varying vec2 vUv;
      varying vec3 vNrm;
      varying vec3 vView;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float speed = mix(0.85 * uFlowDir, -2.4, uPurify);
        float flowY = vUv.y * 9.0 + uTime * speed;
        float ribbon1 = 0.5 + 0.5 * sin(vUv.x * 18.8495 + flowY * 2.2);
        float ribbon2 = 0.5 + 0.5 * cos(vUv.x * 12.5663 - flowY * 3.4 + 1.3);
        float pulseRing = pow(0.5 + 0.5 * sin(flowY * 1.6), 5.0);

        vec2 cell = floor(vec2(vUv.x * 8.0, flowY * 3.2));
        vec2 f = fract(vec2(vUv.x * 8.0, flowY * 3.2)) - 0.5;
        float rnd = hash21(cell);
        float bubble = rnd > 0.72 ? smoothstep(0.28, 0.06, length(f)) : 0.0;

        float fres = pow(1.0 - abs(dot(normalize(vNrm), normalize(vView))), 1.75);
        vec3 baseCol = mix(uDeep, uGlow, ribbon1 * 0.65 + ribbon2 * 0.35);
        baseCol = mix(baseCol, uGold, uPurify * (0.38 + 0.45 * pulseRing));
        vec3 col = baseCol * (0.78 + 0.85 * pulseRing) + (uGlow + 0.35) * bubble * 0.9 + uGlow * fres * 0.55;
        float alpha = clamp(0.62 + 0.26 * pulseRing + 0.22 * bubble + fres * 0.18, 0.0, 0.96);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

let DETAIL_TEX = null;

function makeCanvasOrDataTex(w, h, drawFn, { srgb = true, repeat = null, clamp = false } = {}) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext && c.getContext('2d');
    if (ctx) {
      drawFn(ctx, w, h);
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      t.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      t.anisotropy = 4;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      t.userData.shared = true;
      return t;
    }
  }
  const buf = new Uint8Array(w * h * 4).fill(255);
  const dt = new THREE.DataTexture(buf, w, h, THREE.RGBAFormat);
  if (srgb) dt.colorSpace = THREE.SRGBColorSpace;
  dt.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  dt.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (repeat) dt.repeat.set(repeat[0], repeat[1]);
  dt.needsUpdate = true;
  dt.userData.shared = true;
  return dt;
}

function getDetailTextures() {
  if (DETAIL_TEX) return DETAIL_TEX;
  const rnd = mulberry32(4242);

  const glowDot = makeCanvasOrDataTex(
    128,
    128,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0.0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.28, 'rgba(255,255,255,0.68)');
      gr.addColorStop(0.65, 'rgba(255,255,255,0.16)');
      gr.addColorStop(1.0, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    },
    { srgb: true, clamp: true }
  );

  const mist = makeCanvasOrDataTex(
    256,
    256,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const puffs = [
        [0.5, 0.54, 0.42, 0.34],
        [0.36, 0.58, 0.32, 0.28],
        [0.64, 0.56, 0.32, 0.28],
        [0.48, 0.4, 0.28, 0.22],
      ];
      for (const [px, py, pr, pa] of puffs) {
        const gr = g.createRadialGradient(px * w, py * h, 0, px * w, py * h, pr * w);
        gr.addColorStop(0, `rgba(220,248,255,${pa})`);
        gr.addColorStop(0.55, `rgba(175,228,248,${pa * 0.45})`);
        gr.addColorStop(1, 'rgba(175,228,248,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
    },
    { srgb: true, clamp: true }
  );

  const cracks = makeCanvasOrDataTex(256, 256, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.shadowColor = '#ffffff';
    g.shadowBlur = 7;
    g.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      let x = rnd() * w;
      let y = rnd() * h;
      g.lineWidth = 1.8 + rnd() * 2.4;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (rnd() - 0.5) * 56;
        y += (rnd() - 0.35) * 42;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });

  const frost = makeCanvasOrDataTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e6f8ff');
    gr.addColorStop(1, '#9bd8f5');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.62)';
    g.lineWidth = 1.3;
    for (let k = 0; k < 36; k++) {
      const cx = rnd() * w;
      const cy = rnd() * h;
      g.beginPath();
      for (let a = 0; a < 6; a++) {
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos((a * Math.PI) / 3) * 10, cy + Math.sin((a * Math.PI) / 3) * 10);
      }
      g.stroke();
    }
  });

  const makeConveyor = (dir) =>
    makeCanvasOrDataTex(
      128,
      64,
      (g, w, h) => {
        g.fillStyle = '#192534';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) {
          g.fillStyle = '#293b4f';
          g.fillRect(x, 0, 15, h);
          g.strokeStyle = '#38bdf8';
          g.lineWidth = 5.5;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x + 11 - 6 * dir, 13);
          g.lineTo(x + 11 + 6 * dir, 32);
          g.lineTo(x + 11 - 6 * dir, 51);
          g.stroke();
        }
      },
      { repeat: [3, 1] }
    );

  const makeSlide = (dir) =>
    makeCanvasOrDataTex(
      128,
      64,
      (g, w, h) => {
        g.fillStyle = '#7dd3fc';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) {
          g.strokeStyle = '#ffffff';
          g.lineWidth = 5;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x + 12 - 7 * dir, 12);
          g.lineTo(x + 12 + 7 * dir, 32);
          g.lineTo(x + 12 - 7 * dir, 52);
          g.stroke();
        }
      },
      { repeat: [3, 1] }
    );

  const hazard = makeCanvasOrDataTex(
    256,
    64,
    (g, w, h) => {
      g.fillStyle = '#d99b26';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#141e2e';
      for (let x = -h; x < w + h; x += 32) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + 16, h);
        g.lineTo(x + 16 + h, 0);
        g.lineTo(x + h, 0);
        g.fill();
      }
    },
    { repeat: [2, 1] }
  );

  const runeBox = makeCanvasOrDataTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.shadowColor = '#5efce8';
    g.shadowBlur = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath();
    g.arc(w / 2, h / 2, 24, 0, TWO_PI);
    g.moveTo(w / 2, 22);
    g.lineTo(w / 2, h - 22);
    g.moveTo(22, h / 2);
    g.lineTo(w - 22, h / 2);
    g.stroke();
  });

  const runeSigil = makeCanvasOrDataTex(
    256,
    256,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#ffffff';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.shadowColor = '#5efce8';
      g.shadowBlur = 16;
      g.lineWidth = 9;
      g.beginPath();
      g.arc(128, 128, 88, 0, TWO_PI);
      g.stroke();
      g.lineWidth = 5.5;
      g.beginPath();
      g.arc(128, 128, 68, 0, TWO_PI);
      g.stroke();
      // Harmonic wave-seed emblem inside sanctum ring
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(128, 54);
      g.quadraticCurveTo(176, 114, 128, 198);
      g.quadraticCurveTo(80, 114, 128, 54);
      g.moveTo(86, 136);
      g.quadraticCurveTo(128, 114, 170, 136);
      g.stroke();
    },
    { srgb: true, clamp: true }
  );

  DETAIL_TEX = {
    glowDot,
    mist,
    cracks,
    frost,
    convR: makeConveyor(1),
    convL: makeConveyor(-1),
    slideR: makeSlide(1),
    slideL: makeSlide(-1),
    hazard,
    runeBox,
    runeSigil,
  };
  return DETAIL_TEX;
}

const PORTAL_MAT_CACHE = new Map();

function createPortalMaterial(glowHex, glow2Hex, aspect = 1.4, isMistPassage = false) {
  const key = `${glowHex}_${glow2Hex}_${aspect.toFixed(2)}_${isMistPassage ? 'M' : 'V'}`;
  const cached = PORTAL_MAT_CACHE.get(key);
  if (cached) return cached;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: new THREE.Color(glowHex) },
      uGlow2: { value: new THREE.Color(glow2Hex) },
      uAspect: { value: aspect },
      uMistMode: { value: isMistPassage ? 1.0 : 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uGlow;
      uniform vec3 uGlow2;
      uniform float uAspect;
      uniform float uMistMode;
      varying vec2 vUv;
      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      float fbmMist(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = p * 2.03 + vec2(1.7, -1.3);
          a *= 0.5;
        }
        return v;
      }
      void main() {
        if (uMistMode > 0.5) {
          // Illuminated vaulted aqueduct passage with shimmering water-caustic glow!
          vec2 q = vUv;
          float archMask = smoothstep(0.54, 0.42, length((q - vec2(0.5, 0.62)) * vec2(1.0, 0.85)));
          float reveal = smoothstep(0.16, 0.0, min(q.x, 1.0 - q.x)) * 0.35;
          float caustic = fbmMist(vec2(q.x * 4.2 + sin(uTime * 0.45) * 0.4, q.y * 3.6 - uTime * 0.22));
          float caustic2 = fbmMist(vec2(q.x * 6.4 - uTime * 0.28, q.y * 5.2 + uTime * 0.18) + caustic);
          float shimmer = smoothstep(0.36, 0.84, caustic * 0.55 + caustic2 * 0.45);
          float depthGlow = exp(-pow((q.x - 0.5) / 0.36, 2.0)) * smoothstep(0.95, 0.08, q.y);
          vec3 col = mix(uGlow, uGlow2, clamp(shimmer * 0.72 * depthGlow + archMask * 0.22, 0.0, 1.0));
          col += uGlow2 * reveal * 0.28;
          gl_FragColor = vec4(col, 1.0);
        } else {
          vec2 p = (vUv - vec2(0.5, 0.5)) * vec2(1.0, uAspect);
          float r = length(p);
          float a = atan(p.y, p.x);
          float swirl = a * 2.0 + 1.55 / (r + 0.06) - uTime * 1.95;
          float arms = 0.5 + 0.5 * sin(swirl);
          float arms2 = 0.5 + 0.5 * sin(swirl * 2.0 + 1.2);
          float disk = smoothstep(0.56, 0.10, r);
          float core = smoothstep(0.15, 0.07, r);
          float ring = exp(-pow((r - 0.18) / 0.028, 2.0));
          vec3 col = uGlow * disk * (0.12 + 0.48 * pow(arms, 3.5));
          col += uGlow2 * disk * pow(arms2, 6.0) * 0.34;
          col += mix(uGlow, uGlow2, 0.55) * ring * 0.92;
          col *= (1.0 - core * 0.65) * smoothstep(0.56, 0.28, r);
          gl_FragColor = vec4(col, 1.0);
        }
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  mat.userData.shared = true;
  PORTAL_MAT_CACHE.set(key, mat);
  return mat;
}

// ============================================================================
// 6. 5 EARTH WATER BIOME ARCHITECTURAL SPECIFICATIONS
// ============================================================================

const BIOME_SPECS = {
  // Act I: Redwood Canyon Rivers — Warm red-rock sandstone, redwood beams, riveted copper & waterwheels
  canyon_river: {
    around: 18,
    rows: [2, 3, 2],
    jitter: 0.24,
    proud: 0.048,
    bevel: 0.028,
    joint: 0.036,
    shape: 'arc',
    surface: 'canyon_sandstone',
    tile: 0.58,
    colors: ['#b85c3b', '#c96f49', '#9f4b2e', '#d6835a', '#ab5436', '#c26742'],
    mortar: '#2b130b',
    roughness: 0.68,
    metalness: 0.04,
    normalScale: 1.38,
    hi: '#ffe4c4',
    edgeDarken: 0.24,
    bands: { every: 5, color: '#6e341d', proud: 0.056 }, // Seasoned redwood tie-beams
    buttressColor: '#8f4228',
    ledgeBody: '#9c4e32',
    ledgeTop: '#d88c63',
    metalTrim: '#c8703e',      // Riveted burnished copper
    metalDark: '#38241d',
    crown: '#7d3922',
    conduitDeep: '#0891b2',
    conduitGlow: '#22d3ee',
    accentGlow: '#34d399',
    doorThroat: '#122429',
    doorMist: '#38bdf8',
    buttressCount: 5,
    conduitCount: 5,
    hasTimberBeams: true,
    hasLanterns: false,
  },

  // Act II: Crystal Alpine Mirror Lakes — Carved silver-granite, brushed brass aqueducts & glacier glass
  alpine_lake: {
    around: 20,
    rows: [2, 2, 3],
    jitter: 0.16,
    proud: 0.042,
    bevel: 0.026,
    joint: 0.03,
    shape: 'arc',
    surface: 'alpine_granite',
    tile: 0.56,
    colors: ['#8e9eb2', '#a4b5c9', '#7b8b9f', '#b9c8da', '#96a6ba', '#8393a7'],
    mortar: '#1a2536',
    roughness: 0.44,
    metalness: 0.1,
    normalScale: 1.22,
    hi: '#ffffff',
    edgeDarken: 0.2,
    bands: { every: 4, color: '#cfa044', proud: 0.048 }, // Brushed brass aqueduct bands
    buttressColor: '#76879c',
    ledgeBody: '#798b9f',
    ledgeTop: '#d2dfed',
    metalTrim: '#d6a94a',      // Brushed champagne-brass
    metalDark: '#263244',
    crown: '#6e7f94',
    conduitDeep: '#0284c7',
    conduitGlow: '#7dd3fc',
    accentGlow: '#38bdf8',
    doorThroat: '#0d1d33',
    doorMist: '#7dd3fc',
    buttressCount: 5,
    conduitCount: 5,
    hasTimberBeams: false,
    hasLanterns: false,
  },

  // Act III: Emerald Mist Bayous — Overgrown mossy temple limestone, root-wrapped bronze & amber lanterns
  mist_bayou: {
    around: 16,
    rows: [2, 3, 3],
    jitter: 0.28,
    proud: 0.052,
    bevel: 0.032,
    joint: 0.042,
    shape: 'arc',
    surface: 'bayou_limestone',
    tile: 0.56,
    colors: ['#4f6154', '#607363', '#415045', '#6f8271', '#56685a', '#48594d'],
    mortar: '#111b14',
    roughness: 0.66,
    metalness: 0.05,
    normalScale: 1.42,
    hi: '#d9f2dc',
    edgeDarken: 0.28,
    bands: { every: 5, color: '#786036', proud: 0.052 }, // Ancient temple bronze frieze
    buttressColor: '#435447',
    ledgeBody: '#4a5c4e',
    ledgeTop: '#7d9480',
    metalTrim: '#8c6f3e',      // Root-wrapped aged bronze
    metalDark: '#222b23',
    crown: '#46574a',
    conduitDeep: '#0d9488',
    conduitGlow: '#5efce8',
    accentGlow: '#fbbf24',
    doorThroat: '#122119',
    doorMist: '#5efce8',
    buttressCount: 4,
    conduitCount: 4,
    hasTimberBeams: false,
    hasLanterns: true,
    hasMoss: true,
  },

  // Act IV: Sunlit Tropical Coral Seas — Bleached coral-travertine, pearl inlay, sea-glass & verdigris bronze
  coral_sea: {
    around: 18,
    rows: [2, 3, 2],
    jitter: 0.22,
    proud: 0.046,
    bevel: 0.032,
    joint: 0.036,
    shape: 'arc',
    surface: 'coral_travertine',
    tile: 0.54,
    colors: ['#d8ccb6', '#e7decb', '#c6b8a0', '#f0e8d8', '#cfc2ab', '#dfd4bf'],
    mortar: '#1c3b47',
    roughness: 0.48,
    metalness: 0.08,
    normalScale: 1.25,
    hi: '#ffffff',
    edgeDarken: 0.18,
    bands: { every: 4, color: '#389e8d', proud: 0.048 }, // Verdigris bronze & mother-of-pearl band
    buttressColor: '#bfb199',
    ledgeBody: '#b8aa92',
    ledgeTop: '#eee6d6',
    metalTrim: '#3aa392',      // Sea-verdigris bronze & pearl gold
    metalDark: '#1f424a',
    crown: '#cbbda5',
    conduitDeep: '#0891b2',
    conduitGlow: '#67e8f9',
    accentGlow: '#2dd4bf',
    doorThroat: '#0a2936',
    doorMist: '#67e8f9',
    buttressCount: 5,
    conduitCount: 5,
    hasTimberBeams: false,
    hasLanterns: false,
    hasCoral: true,
  },

  // Act V: Polar & Tempest Oceans — Dark hexagonal basalt, brushed titanium & glowing cyan plasma-hydro veins
  storm_ocean: {
    around: 26,
    rows: [3, 3, 2],
    jitter: 0.04,
    proud: 0.036,
    bevel: 0.02,
    joint: 0.018,
    shape: 'hexBasalt',
    surface: 'storm_basalt',
    tile: 0.58,
    colors: ['#242f42', '#2f3c54', '#1c2536', '#394863', '#29354a'],
    mortar: '#080e1a',
    coreGlow: ['#0284c7', 0.34],
    roughness: 0.32,
    metalness: 0.42,
    normalScale: 1.18,
    hi: '#e0f2fe',
    edgeDarken: 0.24,
    useMetalMap: true,
    bands: { every: 4, color: '#cf7d3a', proud: 0.044 },
    buttressColor: '#2c394f',
    ledgeBody: '#334259',
    ledgeTop: '#6d84a3',
    metalTrim: '#d4823f',      // Offshore copper-titanium alloy
    metalDark: '#161f2e',
    crown: '#263247',
    conduitDeep: '#0284c7',
    conduitGlow: '#22d3ee',
    accentGlow: '#38bdf8',
    doorThroat: '#071526',
    doorMist: '#38bdf8',
    buttressCount: 6,
    conduitCount: 6,
    hasTimberBeams: false,
    hasLanterns: false,
    hasPlasmaVeins: true,
  },
};

// ============================================================================
// 7. PROCEDURAL TWIN GEOMETRIES + `.GLB` MESH EXTRACTION (`ARCH_GEOS`)
// ============================================================================

let ARCH_GEOS = null;

function cylLocalVec(r, thetaRel, yRel, refR) {
  return [r * Math.sin(thetaRel), yRel, r * Math.cos(thetaRel) - refR];
}

function buildProceduralStairFlightGeos(dirSign = 1) {
  const R = TOWER_RADIUS;
  const refR = R + LEDGE_OFFSET;
  const rWall = R - 0.06;
  const rOuter = R + 0.95;
  const rRail = R + 0.9;
  const steps = 5;
  const stepRise = FLOOR_HEIGHT / steps;
  const tStart = 0.12 * COL_ANGLE;
  const tEnd = 0.92 * COL_ANGLE;
  const tSpan = (tEnd - tStart) / steps;

  const stoneParts = [];
  const metalParts = [];

  for (let s = 0; s < steps; s++) {
    const yPrev = s * stepRise;
    const yTop = (s + 1) * stepRise;
    const midA = dirSign * (tStart + (s + 0.5) * tSpan);
    const treadSpan = tSpan + 0.02 * COL_ANGLE;

    // Beveled tread slab
    const tread = arcSlab(rWall, rOuter - 0.015, treadSpan, 0.068, 0.012, 2, 1, 0, R - 0.01);
    tread.rotateY(midA);
    tread.translate(0, yTop, -refR);
    stoneParts.push(tread);

    // Solid vertical riser plate
    const riserA = dirSign * (tStart + (s + 0.08) * tSpan);
    const riser = arcSlab(rWall, rOuter - 0.045, 0.042 * COL_ANGLE, stepRise - 0.01, 0.008, 1, 1, 0, R - 0.01);
    riser.rotateY(riserA);
    riser.translate(0, yTop - 0.055, -refR);
    stoneParts.push(riser);

    // Metallic bullnose anti-slip nosing
    const noseA = dirSign * (tStart + s * tSpan + 0.004 * COL_ANGLE);
    const nose = arcSlab(rWall + 0.08, rOuter + 0.006, 0.038 * COL_ANGLE, 0.036, 0.006, 1, 1, 0);
    nose.rotateY(noseA);
    nose.translate(0, yTop + 0.005, -refR);
    metalParts.push(nose);
  }

  // Angled outer & inner stringers + underside cantilever struts
  const runArc = (tEnd - tStart) * rOuter;
  const strLen = Math.hypot(runArc, FLOOR_HEIGHT) + 0.12;
  const pitch = Math.atan2(FLOOR_HEIGHT, runArc);
  const midFlightA = dirSign * (tStart + tEnd) * 0.5;
  const [ox, oy, oz] = cylLocalVec(rOuter - 0.035, midFlightA, FLOOR_HEIGHT * 0.5 - 0.14, refR);
  const outerStr = new THREE.BoxGeometry(strLen, 0.19, 0.065);
  outerStr.rotateZ(dirSign * pitch);
  outerStr.rotateY(midFlightA);
  outerStr.translate(ox, oy, oz);
  metalParts.push(outerStr);

  const [ix, iy, iz] = cylLocalVec(R + 0.05, midFlightA, FLOOR_HEIGHT * 0.5 - 0.14, refR);
  const innerStr = new THREE.BoxGeometry(strLen * 0.86, 0.21, 0.085);
  innerStr.rotateZ(dirSign * pitch);
  innerStr.rotateY(midFlightA);
  innerStr.translate(ix, iy, iz);
  stoneParts.push(innerStr);

  for (const frac of [0.3, 0.72]) {
    const thB = dirSign * (tStart + (tEnd - tStart) * frac);
    const yb = frac * FLOOR_HEIGHT - 0.24;
    const [bx, , bz] = cylLocalVec(R + 0.45, thB, yb, refR);
    const strut = new THREE.BoxGeometry(0.058, 0.072, 0.88);
    strut.rotateX(-0.42);
    strut.rotateY(thB);
    strut.translate(bx, yb, bz);
    metalParts.push(strut);
  }

  // Outer safety balustrade handrail + 6 vertical balusters/newels
  const railH = 0.45;
  for (let s = 0; s <= steps; s++) {
    const f = s / steps;
    const thR = dirSign * (tStart + (tEnd - tStart) * f);
    const yStep = f * FLOOR_HEIGHT;
    const isNewel = s === 0 || s === steps;
    const pH = railH + (isNewel ? 0.06 : 0);
    const [px, , pz] = cylLocalVec(rRail, thR, yStep, refR);
    const post = new THREE.CylinderGeometry(isNewel ? 0.028 : 0.017, isNewel ? 0.03 : 0.017, pH + 0.04, 6);
    post.translate(px, yStep + pH * 0.5 - 0.02, pz);
    metalParts.push(post);
  }
  const [hx, , hz] = cylLocalVec(rRail, midFlightA, FLOOR_HEIGHT * 0.5 + railH, refR);
  const topRail = new THREE.BoxGeometry(strLen, 0.048, 0.052);
  topRail.rotateZ(dirSign * pitch);
  topRail.rotateY(midFlightA);
  topRail.translate(hx, FLOOR_HEIGHT * 0.5 + railH, hz);
  const kneeRail = new THREE.BoxGeometry(strLen, 0.024, 0.028);
  kneeRail.rotateZ(dirSign * pitch);
  kneeRail.rotateY(midFlightA);
  kneeRail.translate(hx, FLOOR_HEIGHT * 0.5 + railH * 0.48, hz);
  metalParts.push(topRail, kneeRail);

  return {
    stone: mergeGeometries(stoneParts),
    metal: mergeGeometries(metalParts),
  };
}

function buildProceduralTerraceGeos() {
  const R = TOWER_RADIUS;
  const refR = R + LEDGE_OFFSET;
  const rWall = R - 0.06;
  const rOuter = R + 0.95;
  const span = 0.98 * COL_ANGLE;

  const stoneParts = [];
  const metalParts = [];

  const bed = arcSlab(rWall, rOuter - 0.05, span, 0.12, 0.014, 3, 1, 0, R - 0.01);
  bed.translate(0, -0.055, -refR);
  stoneParts.push(bed);

  for (const [f0, f1, lip] of [
    [-0.49, -0.17, -0.004],
    [-0.155, 0.155, 0.008],
    [0.17, 0.49, -0.004],
  ]) {
    const pSpan = (f1 - f0) * COL_ANGLE;
    const midA = (f0 + f1) * 0.5 * COL_ANGLE;
    const pav = arcSlab(rWall, rOuter + lip - 0.024, pSpan, 0.064, 0.012, 2, 1, 0, R - 0.01);
    pav.rotateY(midA);
    pav.translate(0, 0, -refR);
    stoneParts.push(pav);
  }

  const curb = arcSlab(rOuter - 0.042, rOuter + 0.012, span, 0.072, 0.008, 3, 1, 0);
  curb.translate(0, 0.006, -refR);
  metalParts.push(curb);

  for (const side of [-1, 1]) {
    const thC = side * 0.31 * COL_ANGLE;
    const corb = arcSlab(rWall, R + 0.46, 0.11 * COL_ANGLE, 0.36, 0.014, 1, 1, 0, R - 0.01);
    corb.rotateY(thC);
    corb.translate(0, -0.15, -refR);
    stoneParts.push(corb);

    const [tx, , tz] = cylLocalVec(R + 0.48, thC, -0.31, refR);
    const strut = new THREE.BoxGeometry(0.06, 0.075, 0.92);
    strut.rotateX(-0.46);
    strut.rotateY(thC);
    strut.translate(tx, -0.31, tz);
    metalParts.push(strut);

    const [px, , pz] = cylLocalVec(rOuter - 0.03, side * 0.44 * COL_ANGLE, 0.05, refR);
    const bollard = new THREE.CylinderGeometry(0.026, 0.03, 0.13, 6);
    bollard.translate(px, 0.045, pz);
    metalParts.push(bollard);
  }

  return {
    stone: mergeGeometries(stoneParts),
    metal: mergeGeometries(metalParts),
  };
}

function getSharedArchGeometries() {
  if (ARCH_GEOS) return ARCH_GEOS;
  const R = TOWER_RADIUS;
  const refR = R + LEDGE_OFFSET;
  const span = COL_ANGLE * 0.96;
  const ledgeWidth = refR * COL_ANGLE;

  const flightR = buildProceduralStairFlightGeos(1);
  const flightL = buildProceduralStairFlightGeos(-1);
  const terrace = buildProceduralTerraceGeos();

  // Terrace cliff-end safety guard rail (placed on exposed ends of walkways)
  const buildEndGuardRailGeo = () => {
    const parts = [];
    const r0 = R + 0.12;
    const r1 = R + 0.91;
    const len = r1 - r0;
    const midZ = (r0 + r1) * 0.5 - refR;
    const topBar = new THREE.BoxGeometry(0.042, 0.042, len);
    topBar.translate(0, 0.44, midZ);
    const midBar = new THREE.BoxGeometry(0.026, 0.026, len);
    midBar.translate(0, 0.22, midZ);
    const pIn = new THREE.CylinderGeometry(0.022, 0.024, 0.46, 6);
    pIn.translate(0, 0.23, r0 - refR);
    const pOut = new THREE.CylinderGeometry(0.026, 0.028, 0.48, 6);
    pOut.translate(0, 0.24, r1 - refR);
    parts.push(topBar, midBar, pIn, pOut);
    return mergeGeometries(parts);
  };

  const buildMossClusterGeo = () => {
    const m1 = new THREE.SphereGeometry(0.11, 6, 3, 0, TWO_PI, 0, Math.PI * 0.68);
    m1.scale(1.55, 0.38, 0.78);
    const m2 = new THREE.SphereGeometry(0.085, 5, 3, 0, TWO_PI, 0, Math.PI * 0.68);
    m2.scale(1.32, 0.36, 0.72);
    m2.translate(0.11, -0.015, 0.02);
    const m3 = new THREE.SphereGeometry(0.068, 5, 3, 0, TWO_PI, 0, Math.PI * 0.75);
    m3.scale(0.88, 1.15, 0.58);
    m3.translate(0.02, -0.075, 0.048);
    return mergeGeometries([m1, m2, m3]);
  };

  const buildCoralClusterGeo = () => {
    const c1 = new THREE.CylinderGeometry(0.095, 0.032, 0.24, 7);
    c1.rotateX(0.45);
    c1.translate(0, 0.06, 0.08);
    const c2 = new THREE.CylinderGeometry(0.075, 0.026, 0.19, 6);
    c2.rotateX(0.55);
    c2.rotateZ(-0.42);
    c2.translate(0.08, 0.02, 0.07);
    const c3 = new THREE.SphereGeometry(0.072, 7, 5);
    c3.scale(1.2, 0.65, 1.0);
    c3.translate(-0.06, -0.02, 0.05);
    return mergeGeometries([c1, c2, c3]);
  };

  const buildCrystalClusterGeo = () => {
    const s1 = new THREE.ConeGeometry(0.068, 0.36, 6);
    s1.rotateX(Math.PI * 0.38);
    s1.translate(0, 0.05, 0.13);
    const s2 = new THREE.ConeGeometry(0.048, 0.27, 6);
    s2.rotateX(Math.PI * 0.45);
    s2.rotateZ(-0.34);
    s2.translate(0.075, 0.015, 0.1);
    const s3 = new THREE.ConeGeometry(0.044, 0.24, 6);
    s3.rotateX(Math.PI * 0.32);
    s3.rotateZ(0.38);
    s3.translate(-0.068, -0.015, 0.09);
    return mergeGeometries([s1, s2, s3]);
  };

  const buildTempleLanternGeo = () => {
    const arm = new THREE.BoxGeometry(0.036, 0.042, 0.36);
    arm.translate(0, 0.22, 0.16);
    const brace = new THREE.BoxGeometry(0.028, 0.22, 0.028);
    brace.rotateX(-0.62);
    brace.translate(0, 0.13, 0.1);
    const cap = new THREE.ConeGeometry(0.13, 0.09, 6);
    cap.translate(0, 0.14, 0.31);
    const base = new THREE.CylinderGeometry(0.085, 0.065, 0.045, 6);
    base.translate(0, -0.08, 0.31);
    return mergeGeometries([arm, brace, cap, base]);
  };

  const buildLanternCoreGeo = () => {
    const g = new THREE.CylinderGeometry(0.075, 0.072, 0.16, 8);
    g.translate(0, 0.02, 0.31);
    return g;
  };

  const buildButtressSegGeo = () => {
    // Tapered architectural pilaster/buttress segment centered at (0, 0, 0) height 1.0
    const spine = new RoundedBoxGeometry(0.34, 1.0, 0.42, 1, 0.028);
    const fin = new RoundedBoxGeometry(0.18, 0.96, 0.56, 1, 0.022);
    fin.translate(0, 0, 0.06);
    return mergeGeometries([spine, fin]);
  };

  const buildButtressCapGeo = () => {
    const cap = new RoundedBoxGeometry(0.42, 0.16, 0.64, 1, 0.024);
    const slope = new THREE.ConeGeometry(0.28, 0.24, 4);
    slope.rotateY(Math.PI * 0.25);
    slope.scale(1.05, 1.0, 1.35);
    slope.translate(0, 0.18, 0.02);
    return mergeGeometries([cap, slope]);
  };

  const buildButtressCollarGeo = () => {
    const band = new RoundedBoxGeometry(0.4, 0.095, 0.62, 1, 0.016);
    band.translate(0, 0, 0.03);
    const parts = [band];
    for (const sx of [-0.15, 0.15]) {
      const bolt = new THREE.SphereGeometry(0.024, 6, 4);
      bolt.translate(sx, 0, 0.345);
      parts.push(bolt);
    }
    const boss = new THREE.CylinderGeometry(0.052, 0.058, 0.04, 8);
    boss.rotateX(Math.PI * 0.5);
    boss.translate(0, 0, 0.35);
    parts.push(boss);
    return mergeGeometries(parts);
  };

  const buildConduitClampGeo = () => {
    const ring = new THREE.TorusGeometry(0.185, 0.032, 6, 16, Math.PI * 1.15);
    ring.rotateX(Math.PI * 0.5);
    ring.rotateY(-Math.PI * 0.075);
    const lugL = new THREE.BoxGeometry(0.065, 0.085, 0.12);
    lugL.translate(-0.18, 0, -0.02);
    const lugR = new THREE.BoxGeometry(0.065, 0.085, 0.12);
    lugR.translate(0.18, 0, -0.02);
    return mergeGeometries([ring, lugL, lugR]);
  };

  const buildValveWheelGeo = () => {
    const rim = new THREE.TorusGeometry(0.26, 0.024, 6, 18);
    const hub = new THREE.CylinderGeometry(0.052, 0.052, 0.08, 8);
    hub.rotateX(Math.PI * 0.5);
    const parts = [rim, hub];
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.CylinderGeometry(0.015, 0.015, 0.52, 6);
      spoke.rotateZ((s * Math.PI) / 3);
      parts.push(spoke);
    }
    return mergeGeometries(parts);
  };

  ARCH_GEOS = {
    procFlightRStone: flightR.stone,
    procFlightRMetal: flightR.metal,
    procFlightLStone: flightL.stone,
    procFlightLMetal: flightL.metal,
    procTerraceStone: terrace.stone,
    procTerraceMetal: terrace.metal,
    endGuardRail: buildEndGuardRailGeo(),

    buttressSeg: buildButtressSegGeo(),
    buttressCap: buildButtressCapGeo(),
    buttressCollar: buildButtressCollarGeo(),
    conduitClamp: buildConduitClampGeo(),
    mossCluster: buildMossClusterGeo(),
    coralCluster: buildCoralClusterGeo(),
    crystalCluster: buildCrystalClusterGeo(),
    templeLantern: buildTempleLanternGeo(),
    lanternCore: buildLanternCoreGeo(),
    valveWheel: buildValveWheelGeo(),

    crumbleTriple: (() => {
      const parts = [];
      for (const k of [-1, 0, 1]) {
        const g = arcSlab(R - 0.04, R + 0.94, span * 0.31, 0.22, 0.022, 1, 1, 0.018, R - 0.01);
        g.translate(0, 0, -refR);
        g.rotateY(k * COL_ANGLE * 0.31);
        g.rotateZ(k * 0.018);
        parts.push(g);
      }
      return mergeGeometries(parts);
    })(),
    iceSlab: (() => {
      const g = arcSlab(R - 0.05, R + 0.95, span, 0.2, 0.028, 2, 1, 0.02, R - 0.01);
      g.translate(0, 0, -refR);
      return g;
    })(),
    iceCap: (() => {
      const g = arcSlab(R - 0.02, R + 0.93, span * 0.97, 0.05, 0.012, 2, 1, 0.018, R - 0.01);
      g.translate(0, 0.01, -refR);
      return g;
    })(),
    convBase: (() => {
      const g = arcSlab(R - 0.05, R + 0.95, span, 0.2, 0.022, 2, 1, 0.018, R - 0.01);
      g.translate(0, 0, -refR);
      return g;
    })(),
    convTread: (() => {
      const g = arcSlab(R + 0.04, R + 0.88, span * 0.96, 0.042, 0.008, 2, 1, 0);
      g.translate(0, 0.016, -refR);
      return g;
    })(),
    convHazard: (() => {
      const g = arcSlab(R + 0.9, R + 0.96, span * 0.94, 0.095, 0.008, 2, 1, 0);
      g.translate(0, -0.04, -refR);
      return g;
    })(),
    rollerTrio: (() => {
      const parts = [];
      for (const rx of [-0.34, 0, 0.34]) {
        const r = new THREE.CylinderGeometry(0.055, 0.055, 0.84, 8);
        r.rotateX(Math.PI * 0.5);
        r.translate(rx * ledgeWidth, -0.075, 0);
        parts.push(r);
      }
      return mergeGeometries(parts);
    })(),
    twinHoistCables: (() => {
      const cL = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6);
      cL.translate(-0.24, 0, -0.1);
      const cR = new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6);
      cR.translate(0.24, 0, -0.1);
      return mergeGeometries([cL, cR]);
    })(),
    singleReturnCable: new THREE.CylinderGeometry(0.016, 0.016, 1.0, 6),
    laserEmitters: (() => {
      const eL = new THREE.CylinderGeometry(0.088, 0.105, 0.34, 8);
      eL.translate(-ledgeWidth * 0.44, 0.18, 0);
      const eR = new THREE.CylinderGeometry(0.088, 0.105, 0.34, 8);
      eR.translate(ledgeWidth * 0.44, 0.18, 0);
      return mergeGeometries([eL, eR]);
    })(),
    steamNozzle: (() => {
      const n = new THREE.CylinderGeometry(0.16, 0.2, 0.18, 10);
      n.translate(0, 0.08, 0);
      return n;
    })(),
    pistonRams: (() => {
      const rL = new THREE.CylinderGeometry(0.105, 0.105, 1.02, 8);
      rL.rotateX(Math.PI * 0.5);
      rL.translate(-0.32, -0.1, -0.44);
      const rR = new THREE.CylinderGeometry(0.105, 0.105, 1.02, 8);
      rR.rotateX(Math.PI * 0.5);
      rR.translate(0.32, -0.1, -0.44);
      return mergeGeometries([rL, rR]);
    })(),
    exitCrownTines: (() => {
      const parts = [];
      for (let sp = 0; sp < 6; sp++) {
        const ca = (sp / 6) * TWO_PI;
        const tine = new THREE.ConeGeometry(0.048, 0.18, 6);
        tine.translate(Math.cos(ca) * 0.24, 0.1, Math.sin(ca) * 0.24);
        parts.push(tine);
      }
      return mergeGeometries(parts);
    })(),
    energyBox: new RoundedBoxGeometry(1.06, 0.78, 0.78, 1, 0.068),
    energyCore: new THREE.BoxGeometry(0.68, 0.42, 0.82),
    flutedPillar: new THREE.CylinderGeometry(0.32, 0.34, 1.0, 12),
    pillarCollar: new RoundedBoxGeometry(0.88, 0.11, 0.76, 1, 0.022),
    pipeSegment: new THREE.CylinderGeometry(0.056, 0.056, 1.0, 8),
    pipeFlange: new THREE.CylinderGeometry(0.098, 0.098, 0.068, 10),
    ashlarBlock: new RoundedBoxGeometry(1, 1, 1, 1, 0.06),
    recessVoid: arcSlab(R - 0.48, R - 0.02, 0.34, 1.0, 0, 1, 1, 0),
    sparkCube: new THREE.BoxGeometry(0.045, 0.045, 0.045),
  };

  for (const g of Object.values(ARCH_GEOS)) {
    g.userData.shared = true;
  }
  return ARCH_GEOS;
}

// ============================================================================
// 8. INSTANCED BATCHING UTILITIES & SPIRE SILHOUETTE BUILDER
// ============================================================================

function pushInstance(list, x, y, z, rx, ry, rz, sx, sy, sz, colorHex = null) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _pos.set(x, y, z);
  _scl.set(sx, sy, sz);
  const m = new THREE.Matrix4().compose(_pos, _q, _scl);
  list.push({ m, c: colorHex ? new THREE.Color(colorHex) : null, y });
  return list.length - 1;
}

function buildInstancedFromList(
  geo,
  mat,
  list,
  { castShadow = false, receiveShadow = true, keepInReflection = false } = {}
) {
  if (!list.length) return null;
  const inst = new THREE.InstancedMesh(geo, mat, list.length);
  let hasColor = false;
  for (let i = 0; i < list.length; i++) {
    inst.setMatrixAt(i, list[i].m);
    if (list[i].c) {
      inst.setColorAt(i, list[i].c);
      hasColor = true;
    }
  }
  inst.instanceMatrix.needsUpdate = true;
  if (hasColor && inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.castShadow = castShadow;
  inst.receiveShadow = receiveShadow;
  inst.userData.keepInReflection = keepInReflection;
  return inst;
}

function buildBandedInstancedFromList(
  group,
  bandedMeshes,
  geo,
  mat,
  list,
  bandSpanY,
  { castShadow = false, receiveShadow = true, keepInReflection = false } = {}
) {
  if (!list.length) return [];
  const buckets = new Map();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const bIdx = Math.max(0, Math.floor((item.y ?? 0) / bandSpanY));
    let bucket = buckets.get(bIdx);
    if (!bucket) {
      bucket = [];
      buckets.set(bIdx, bucket);
    }
    item._bandOutRef = { bucket, localIdx: bucket.length };
    bucket.push(item);
  }
  const created = [];
  for (const [bIdx, bucket] of buckets.entries()) {
    const inst = buildInstancedFromList(geo, mat, bucket, {
      castShadow,
      receiveShadow,
      keepInReflection,
    });
    if (!inst) continue;
    const minY = bIdx * bandSpanY - 0.5;
    const maxY = (bIdx + 1) * bandSpanY + 0.5;
    inst.userData.bandMinY = minY;
    inst.userData.bandMaxY = maxY;
    inst.userData.bandMidY = (minY + maxY) * 0.5;
    for (let j = 0; j < bucket.length; j++) {
      bucket[j]._bandOutRef.inst = inst;
    }
    group.add(inst);
    bandedMeshes.push(inst);
    created.push(inst);
  }
  return created;
}

function isNearOpening(phi, y, holes, padA = 0.12, padY = 0.3) {
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    if (y >= h.y0 - padY && y <= h.y1 + padY && Math.abs(angDist(phi, h.a)) < h.w + padA) {
      return true;
    }
  }
  return false;
}

function isInChannel(phi, y, channels, padA = 0.12) {
  for (let i = 0; i < channels.length; i++) {
    const s = channels[i];
    if (y >= s.y0 - 0.35 && y <= s.y1 + 0.55 && Math.abs(angDist(phi, s.a)) < s.w + padA) {
      return true;
    }
  }
  return false;
}

function materializeWallBands(
  group,
  bandedMeshes,
  baseGeo,
  blockMat,
  entries,
  bandSpanY,
  useSpanAttr,
  castShadow = false,
  keepInReflection = true,
  angularSectors = 8
) {
  const secCount = Math.max(1, angularSectors | 0);
  const secWidth = TWO_PI / secCount;
  const buckets = new Map();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const bIdx = Math.max(0, Math.floor(e.y / bandSpanY));
    const sIdx =
      secCount > 1
        ? Math.min(secCount - 1, Math.floor((((e.phi ?? 0) % TWO_PI + TWO_PI) % TWO_PI) / secWidth))
        : 0;
    const key = `${bIdx}_${sIdx}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { bIdx, sIdx, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(e);
  }
  for (const { bIdx, sIdx, items } of buckets.values()) {
    const bandGeo = baseGeo.clone();
    if (useSpanAttr) {
      const spanArr = new Float32Array(items.length);
      for (let i = 0; i < items.length; i++) spanArr[i] = items[i].span;
      bandGeo.setAttribute('aSpan', new THREE.InstancedBufferAttribute(spanArr, 1));
    }
    const inst = new THREE.InstancedMesh(bandGeo, blockMat, items.length);
    for (let i = 0; i < items.length; i++) {
      inst.setMatrixAt(i, items[i].m);
      inst.setColorAt(i, items[i].c);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = castShadow;
    inst.receiveShadow = true;
    const minY = bIdx * bandSpanY - 0.5;
    const maxY = (bIdx + 1) * bandSpanY + 0.5;
    inst.userData = {
      keepInReflection,
      bandMinY: minY,
      bandMaxY: maxY,
      bandMidY: (minY + maxY) * 0.5,
      sectorPhi: secCount > 1 ? (sIdx + 0.5) * secWidth : undefined,
    };
    group.add(inst);
    bandedMeshes.push(inst);
  }
  baseGeo.dispose();
}

function selectClearSpireAngles(count, offsetFrac, shafts, holes, totalH) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const basePhi = ((i + offsetFrac) / count) * TWO_PI;
    // Try small angular nudges if an elevator shaft sits right on basePhi
    let chosen = null;
    for (const nudge of [0, 0.14, -0.14, 0.26, -0.26]) {
      const cand = (basePhi + nudge + TWO_PI) % TWO_PI;
      if (!isInChannel(cand, totalH * 0.45, shafts, 0.18)) {
        chosen = cand;
        break;
      }
    }
    if (chosen !== null) out.push(chosen);
  }
  return out;
}

function buildTowerMasonryAndAccents(
  group,
  tower,
  rbTheme,
  fh,
  holes,
  shafts,
  conduitChannels,
  buttressAngles,
  stoneMats,
  bandedMeshes,
  wallAoTex,
  pipeAvoidHoles,
  turbineGlb,
  walkableSet
) {
  const R = TOWER_RADIUS;
  const totalH = (tower?.floors || 18) * fh;
  const pal = tower?.palette || {};
  const G = getSharedArchGeometries();
  const T = getDetailTextures();
  const spec = BIOME_SPECS[rbTheme] || BIOME_SPECS.canyon_river;
  const rnd = mulberry32((Number(tower?.id) || 1) * 9137 + ((tower?.seed | 0) % 7919) + 17);

  // 1. Sleek Tapered Recessed Mortar Core Cylinder
  const mortarColor = spec.mortar || pal.mortar || '#141c29';
  const coreMat = new THREE.MeshStandardMaterial({
    color: mortarColor,
    roughness: 0.94,
    metalness: 0.04,
  });
  if (spec.coreGlow) {
    coreMat.emissive = new THREE.Color(spec.coreGlow[0]);
    coreMat.emissiveIntensity = spec.coreGlow[1];
  }
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.11, R - 0.02, totalH + 0.4, 40, 1, false),
    coreMat
  );
  core.position.y = totalH * 0.5;
  core.castShadow = true;
  core.receiveShadow = true;
  core.userData.keepInReflection = true;
  group.add(core);

  // Dark 3D void sleeves behind every doorway
  if (holes.length > 0) {
    const recessMat = new THREE.MeshBasicMaterial({ color: spec.doorThroat || '#050b14' });
    const recessInst = new THREE.InstancedMesh(G.recessVoid, recessMat, holes.length);
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      _e.set(0, h.a, 0);
      _q.setFromEuler(_e);
      _pos.set(0, h.y1 + 0.05, 0);
      _scl.set(Math.max(0.5, (h.w * 2.35) / 0.34), h.y1 - h.y0 + 0.12, 1);
      _m4.compose(_pos, _q, _scl);
      recessInst.setMatrixAt(i, _m4);
    }
    recessInst.instanceMatrix.needsUpdate = true;
    group.add(recessInst);
  }

  // 2. Curved Beveled 3D Masonry Courses (with recessed Elevator Shafts & Hydro-Conduit Niches!)
  const mossList = [];
  const coralList = [];
  const crystalList = [];
  const lanternBodyList = [];
  const lanternGlowList = [];

  const N = spec.around;
  const blockA = TWO_PI / N;
  const courseUnit = fh * 0.145;
  const baseH = spec.rows[0] * courseUnit;
  const bev = spec.bevel;
  const blockHt = Math.max(0.1, baseH - spec.joint * 0.55);
  const r1 = R + BRICK_PROUD - bev;
  const rf = R + BRICK_PROUD;
  const capA = Math.max(0.04, (blockA * rf - spec.joint - 2 * bev) / r1);
  const isHex = spec.shape === 'hexBasalt';

  let blockGeo;
  let hexHalfA = 0;
  if (isHex) {
    const hexR = blockA * rf * 0.54;
    hexHalfA = hexR / rf;
    blockGeo = buildHexBasaltGeo(hexR, baseH - 0.016, rf, bev);
  } else {
    blockGeo = arcSlab(R - 0.06, r1, capA, blockHt, bev, 2, 1, 0, R - 0.015);
    blockGeo.translate(0, blockHt, 0);
  }

  const blockMat = createBlockMaterial({
    color: '#ffffff',
    surface: spec.surface,
    tile: spec.tile,
    roughness: spec.roughness,
    metalness: spec.metalness,
    normalScale: spec.normalScale,
    hi: spec.hi,
    brickHalf: [capA * r1 * 0.5 + bev, blockHt * 0.5],
    edgeDarken: spec.edgeDarken,
    angular: !isHex,
    wetStrength: 0.82,
    useMetalMap: Boolean(spec.useMetalMap),
    wallAoTex,
    totalH,
  });
  stoneMats.push(blockMat);

  const basePaletteCols = spec.colors.map((hex) => new THREE.Color(hex));
  const bandCol = spec.bands ? new THREE.Color(spec.bands.color) : null;
  const mossHexes = ['#295422', '#35682c', '#1f4219', '#3f7834'];
  const coralHexes = ['#f472b6', '#fb7185', '#38bdf8', '#fbbf24', '#2dd4bf'];
  const crystalHexes = ['#38bdf8', '#67e8f9', '#818cf8'];

  const half = (capA * r1 + 2 * bev) * 0.5 / rf;
  const jointA = spec.joint / rf;
  const wallEntries = [];
  let isBand = false;

  const placeBlock = (a0, a1, y0, hr) => {
    const sp = a1 - a0;
    if (sp < blockA * 0.12 || hr < 0.06) return;
    const midA = (a0 + a1) * 0.5;
    const inShaft = y0 >= -0.2 && isInChannel(midA, y0 + hr * 0.5, shafts, 0.015);
    const inConduit = y0 >= 0.1 && isInChannel(midA, y0 + hr * 0.5, conduitChannels, 0.008);
    const channelRecess = inShaft ? -0.18 : inConduit ? -0.15 : 0;

    // Graceful flared surf base (y < 2.2 down to -2.4) + sleek upward architectural entasis taper
    const flareBase = y0 < 2.2 ? Math.pow(Math.max(0, 2.2 - y0) / 4.2, 1.45) * 0.36 : 0;
    const upperTaper = y0 > 0 ? -0.085 * Math.min(1, y0 / Math.max(14, totalH)) : 0;

    const proudAmt = isBand ? spec.bands.proud : spec.proud;
    const stoneRelief = isBand ? proudAmt : (rnd() - 0.45) * 2.0 * proudAmt;
    const radialOut = 1 + (channelRecess + flareBase + upperTaper + stoneRelief) / R;
    const sy = isHex ? hr / blockHt : Math.max(0.15, (hr - spec.joint * 0.55) / blockHt);

    _e.set((rnd() - 0.5) * 0.012, midA, (rnd() - 0.5) * 0.012);
    _q.setFromEuler(_e);
    _pos.set(0, y0 + 0.01, 0);
    _scl.set(radialOut, sy, radialOut);
    const m = new THREE.Matrix4().compose(_pos, _q, _scl);

    const c = new THREE.Color();
    if (isBand && bandCol) {
      c.copy(bandCol).multiplyScalar(0.94 + rnd() * 0.14);
    } else {
      c.copy(basePaletteCols[Math.floor(rnd() * basePaletteCols.length)]).multiplyScalar(0.92 + rnd() * 0.18);
    }
    if (inShaft || inConduit) c.multiplyScalar(0.54);

    wallEntries.push({
      m,
      c,
      span: !isHex ? Math.max(0.12, sp / (half * 2)) : 1,
      y: Math.max(0, y0 + hr * 0.5),
      phi: ((midA % TWO_PI) + TWO_PI) % TWO_PI,
    });

    if (!inShaft && !inConduit && sp > blockA * 0.42 && y0 > -0.4 && y0 < totalH - 0.6) {
      const surfR = rf + (radialOut - 1) * R;
      if (spec.hasMoss && !isBand && rnd() < 0.14) {
        const ma = a0 + sp * (0.2 + rnd() * 0.6);
        pushInstance(
          mossList,
          Math.sin(ma) * (surfR + 0.012),
          y0 + 0.02,
          Math.cos(ma) * (surfR + 0.012),
          (rnd() - 0.5) * 0.3,
          ma,
          (rnd() - 0.5) * 0.4,
          0.85 + rnd() * 0.85,
          0.8 + rnd() * 0.7,
          0.85 + rnd() * 0.4,
          mossHexes[Math.floor(rnd() * mossHexes.length)]
        );
      } else if (spec.hasCoral && y0 < 4.5 && rnd() < 0.16) {
        const ca = a0 + sp * (0.2 + rnd() * 0.6);
        pushInstance(
          coralList,
          Math.sin(ca) * (surfR + 0.01),
          y0 + hr * 0.4,
          Math.cos(ca) * (surfR + 0.01),
          0,
          ca,
          (rnd() - 0.5) * 0.6,
          0.85 + rnd() * 0.7,
          0.85 + rnd() * 0.7,
          0.85 + rnd() * 0.5,
          coralHexes[Math.floor(rnd() * coralHexes.length)]
        );
      } else if (spec.hasPlasmaVeins && !isBand && rnd() < 0.055) {
        pushInstance(
          crystalList,
          Math.sin(midA) * (surfR + 0.015),
          y0 + hr * 0.5,
          Math.cos(midA) * (surfR + 0.015),
          0,
          midA,
          (rnd() - 0.5) * 0.5,
          0.8 + rnd() * 0.5,
          0.8 + rnd() * 0.6,
          0.8 + rnd() * 0.5,
          crystalHexes[Math.floor(rnd() * crystalHexes.length)]
        );
      }
    }
  };

  const gapV = Math.max(0.02, spec.joint * 0.52);
  const overUnder = (a0, a1, y0, hr, h) => {
    if (h.y0 - y0 - gapV > 0.06) placeBlock(a0, a1, y0, h.y0 - y0 - gapV);
    if (y0 + hr - h.y1 - gapV > 0.06) placeBlock(a0, a1, h.y1 + gapV, y0 + hr - h.y1 - gapV);
  };

  const placeCut = (a0, a1, y0, hr) => {
    for (const h of holes) {
      if (!(y0 + hr > h.y0 && y0 < h.y1)) continue;
      const d0 = angDist(a0, h.a);
      const hs = a0 - d0;
      if (isHex) {
        if (Math.abs(angDist((a0 + a1) * 0.5, h.a)) < h.w + hexHalfA * 0.65) {
          overUnder(a0, a1, y0, hr, h);
          return;
        }
        continue;
      }
      const L = hs - h.w;
      const Rr = hs + h.w;
      if (a1 <= L || a0 >= Rr) continue;
      if (a0 < L - jointA * 0.5) placeCut(a0, L - jointA * 0.5, y0, hr);
      overUnder(Math.max(a0, L), Math.min(a1, Rr), y0, hr, h);
      if (a1 > Rr + jointA * 0.5) placeCut(Rr + jointA * 0.5, a1, y0, hr);
      return;
    }
    placeBlock(a0, a1, y0, hr);
  };

  let y0 = isHex ? -0.6 : -2.4;
  for (let r = 0; y0 < totalH + (isHex ? baseH : 0); r++) {
    const hr = (isHex ? spec.rows[0] : spec.rows[Math.floor(rnd() * spec.rows.length)]) * courseUnit;
    isBand = !isHex && y0 > 0.8 && Boolean(spec.bands) && r % spec.bands.every === spec.bands.every - 1;
    let a = isHex ? 0 : (r % 2) * blockA * 0.5 + rnd() * blockA * spec.jitter;
    const end = a + TWO_PI;
    let k = 0;
    while (a < end - blockA * 0.2) {
      let w = isBand
        ? blockA * 1.45
        : isHex
        ? blockA
        : blockA * (1 + (rnd() - 0.5) * 2 * spec.jitter);
      if (!isHex && end - (a + w) < blockA * 0.45) w = end - a;
      const yo = isHex ? (-hr * ((k * 5) % 3)) / 3 : 0;
      placeCut(a + jointA * 0.5, a + w - jointA * 0.5, y0 + yo, hr);
      a += w;
      k++;
    }
    y0 += hr;
  }

  materializeWallBands(group, bandedMeshes, blockGeo, blockMat, wallEntries, PROP_SPAN_Y, !isHex, false, true, 8);

  // 3. Sweeping Vertical Architectural Buttress Ribs (Breaks Up Straight Cylinder Silhouette!)
  const buttressMat = createBlockMaterial({
    color: spec.buttressColor,
    surface: spec.hasTimberBeams ? 'redwood_timber' : spec.surface,
    tile: 0.62,
    roughness: Math.max(0.34, spec.roughness - 0.08),
    metalness: spec.metalness,
    normalScale: spec.normalScale,
    hi: spec.hi,
    angular: false,
    wetStrength: 0.8,
    wallAoTex,
    totalH,
  });
  const trimMetalMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: spec.metalTrim,
      roughness: 0.28,
      metalness: 0.86,
    }),
    0.55
  );
  const darkMetalMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: spec.metalDark,
      roughness: 0.4,
      metalness: 0.82,
    }),
    0.6
  );
  stoneMats.push(buttressMat, trimMetalMat, darkMetalMat);

  const buttressSegs = [];
  const buttressCaps = [];
  for (let b = 0; b < buttressAngles.length; b++) {
    const bPhi = buttressAngles[b];
    const tierStep = 4 * fh; // 6.0u tiers stepping gracefully inward
    for (let by = -1.5; by < totalH - 1.2; by += tierStep) {
      const segH = Math.min(tierStep - 0.14, totalH - 0.8 - by);
      if (segH < 0.8) continue;
      const midY = by + segH * 0.5;
      if (isNearOpening(bPhi, midY, pipeAvoidHoles, 0.18, segH * 0.48)) continue;

      const altFrac = Math.max(0, Math.min(1, midY / Math.max(12, totalH)));
      const tierOut = 0.26 * (1 - altFrac * 0.58) + (by < 0 ? 0.18 : 0);
      const br = R + tierOut;
      const depthScale = 1.15 - altFrac * 0.42;

      pushInstance(
        buttressSegs,
        Math.sin(bPhi) * br,
        midY,
        Math.cos(bPhi) * br,
        0,
        bPhi,
        0,
        0.95 - altFrac * 0.18,
        segH,
        depthScale
      );
      pushInstance(
        buttressCaps,
        Math.sin(bPhi) * (br + 0.02),
        by + segH + 0.04,
        Math.cos(bPhi) * (br + 0.02),
        0,
        bPhi,
        0,
        0.98 - altFrac * 0.18,
        1.0,
        depthScale
      );

      // Warm hanging temple lanterns on Bayou buttress tiers!
      if (spec.hasLanterns && by > 0.5 && by < totalH - 3.0) {
        const ly = by + segH * 0.65;
        const lr = br + 0.18;
        pushInstance(lanternBodyList, Math.sin(bPhi) * lr, ly, Math.cos(bPhi) * lr, 0, bPhi, 0, 1, 1, 1);
        pushInstance(lanternGlowList, Math.sin(bPhi) * lr, ly, Math.cos(bPhi) * lr, 0, bPhi, 0, 1, 1, 1);
      }
    }
  }
  buildBandedInstancedFromList(group, bandedMeshes, G.buttressSeg, buttressMat, buttressSegs, PROP_SPAN_Y, {
    castShadow: true,
    keepInReflection: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.buttressCap, trimMetalMat, buttressCaps, PROP_SPAN_Y, {
    castShadow: true,
    keepInReflection: true,
  });

  // 4. Recessed Transparent Glass Hydro-Conduit Tubes + Animated Flowing Water Core!
  const conduitMat = createHydroConduitMaterial(spec.conduitDeep, spec.conduitGlow);
  const glassTubeMat = new THREE.MeshStandardMaterial({
    color: '#e0f7ff',
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const clampList = [];
  const conduitWaterParts = [];
  const conduitGlassParts = [];

  for (let c = 0; c < conduitChannels.length; c++) {
    const ch = conduitChannels[c];
    const cPhi = ch.a;
    // Split vertical conduit cleanly around any doorway opening
    let segStart = 0.2;
    const spanEnd = totalH - 0.3;
    const emitConduitSpan = (yA, yB) => {
      const hLen = yB - yA;
      if (hLen < 1.1) return;
      const midY = (yA + yB) * 0.5;
      const cr = R + 0.02;
      const cx = Math.sin(cPhi) * cr;
      const cz = Math.cos(cPhi) * cr;

      const wGeo = new THREE.CylinderGeometry(0.115, 0.125, hLen, 12, 1, true);
      wGeo.rotateY(cPhi);
      wGeo.translate(cx, midY, cz);
      conduitWaterParts.push(wGeo);

      const gGeo = new THREE.CylinderGeometry(0.155, 0.165, hLen, 12, 1, true);
      gGeo.rotateY(cPhi);
      gGeo.translate(cx, midY, cz);
      conduitGlassParts.push(gGeo);

      for (let ry = yA + 0.15; ry <= yB - 0.1; ry += fh) {
        pushInstance(clampList, cx, ry, cz, 0, cPhi, 0, 1, 1, 1);
      }
    };

    const sortedHoles = pipeAvoidHoles
      .filter((h) => Math.abs(angDist(cPhi, h.a)) < h.w + 0.18)
      .sort((a, b) => a.y0 - b.y0);
    for (const bh of sortedHoles) {
      if (bh.y0 - 0.35 > segStart) {
        emitConduitSpan(segStart, bh.y0 - 0.35);
      }
      segStart = Math.max(segStart, bh.y1 + 0.35);
    }
    if (spanEnd > segStart) {
      emitConduitSpan(segStart, spanEnd);
    }
  }

  if (conduitWaterParts.length) {
    const waterCoreMesh = new THREE.Mesh(mergeGeometries(conduitWaterParts), conduitMat);
    waterCoreMesh.userData.keepInReflection = true;
    group.add(waterCoreMesh);

    const glassShellMesh = new THREE.Mesh(mergeGeometries(conduitGlassParts), glassTubeMat);
    group.add(glassShellMesh);
  }
  buildBandedInstancedFromList(group, bandedMeshes, G.conduitClamp, trimMetalMat, clampList, PROP_SPAN_Y);

  // 5. Arched Colonnade / Aqueduct Cornice Bands Every 4 Floors
  const corniceParts = [];
  for (let fy = 4 * fh; fy < totalH - 1.5; fy += 4 * fh) {
    for (let col = 0; col < COLS; col++) {
      const aPhi = (col + 0.5) * COL_ANGLE;
      if (
        isNearOpening(aPhi, fy, pipeAvoidHoles, 0.16, 0.55) ||
        isInChannel(aPhi, fy, shafts, 0.12) ||
        isInChannel(aPhi, fy, conduitChannels, 0.08)
      ) {
        continue;
      }
      const altTaper = -0.085 * Math.min(1, fy / Math.max(14, totalH));
      const bandSlab = arcSlab(
        R - 0.04,
        R + BRICK_PROUD + 0.095 + altTaper,
        COL_ANGLE * 0.92,
        0.16,
        0.022,
        2,
        1,
        0.015,
        R - 0.01
      );
      bandSlab.rotateY(aPhi);
      bandSlab.translate(0, fy + 0.08, 0);
      corniceParts.push(bandSlab);
    }
  }
  if (corniceParts.length) {
    const corniceMesh = new THREE.Mesh(mergeGeometries(corniceParts), buttressMat);
    corniceMesh.castShadow = true;
    corniceMesh.receiveShadow = true;
    corniceMesh.userData.keepInReflection = true;
    group.add(corniceMesh);
  }

  // 6. Spinning 3D Hydro-Turbines / Pelton Waterwheels (`hydro_turbine.glb`) on Clear Spire Bays!
  const turbineRotors = [];
  const candidateTurbineSpots = [
    { fracA: 0.18, floor: Math.min(tower.floors - 4, 3.2) },
    { fracA: 0.68, floor: Math.min(tower.floors - 4, Math.max(5.2, Math.floor(tower.floors * 0.48))) },
    { fracA: 0.43, floor: Math.min(tower.floors - 3, Math.max(7.2, Math.floor(tower.floors * 0.72))) },
  ];

  const buildProceduralTurbinePair = () => {
    const housingGrp = new THREE.Group();
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.18, 14), darkMetalMat);
    mount.rotation.x = Math.PI * 0.5;
    const spout = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 12, Math.PI * 0.6), trimMetalMat);
    spout.position.set(0.1, 0.82, 0.18);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), trimMetalMat);
    axle.rotation.x = Math.PI * 0.5;
    axle.position.z = 0.24;
    housingGrp.add(mount, spout, axle);

    const wheelGrp = new THREE.Group();
    wheelGrp.position.z = 0.28;
    const rimParts = [
      new THREE.TorusGeometry(0.86, 0.036, 6, 20),
      new THREE.TorusGeometry(0.66, 0.028, 6, 18),
    ];
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TWO_PI;
      const paddle = new THREE.BoxGeometry(0.18, 0.035, 0.24);
      paddle.rotateZ(ang + 0.45);
      paddle.translate(Math.cos(ang) * 0.88, Math.sin(ang) * 0.88, 0);
      rimParts.push(paddle);
      if (k < 6) {
        const spoke = new THREE.BoxGeometry(1.68, 0.055, 0.08);
        spoke.rotateZ(ang);
        rimParts.push(spoke);
      }
    }
    const wheelMesh = new THREE.Mesh(mergeGeometries(rimParts), trimMetalMat);
    wheelMesh.castShadow = true;
    const hubGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.28, 10),
      new THREE.MeshBasicMaterial({ color: spec.conduitGlow })
    );
    hubGlow.rotation.x = Math.PI * 0.5;
    wheelGrp.add(wheelMesh, hubGlow);
    return { housing: housingGrp, wheel: wheelGrp };
  };

  for (let tIdx = 0; tIdx < candidateTurbineSpots.length; tIdx++) {
    const spot = candidateTurbineSpots[tIdx];
    if (spot.floor < 1.8 || spot.floor >= (tower.floors || 18) - 2) continue;
    let placedPhi = null;
    for (let stepTry = 0; stepTry < 10; stepTry++) {
      const testCol = (Math.round(spot.fracA * COLS) + stepTry * 2) % COLS;
      const testPhi = (testCol + 0.5) * COL_ANGLE;
      const ty = spot.floor * fh;
      // Ensure zero collision with walkable ledges, doors, or elevator shafts within ±1 col & ±1 floor!
      let blocked =
        isNearOpening(testPhi, ty, pipeAvoidHoles, COL_ANGLE * 1.1, 1.8) ||
        isInChannel(testPhi, ty, shafts, COL_ANGLE * 1.1);
      if (!blocked) {
        const flInt = Math.round(spot.floor);
        for (let dc = -1; dc <= 1 && !blocked; dc++) {
          for (let df = -1; df <= 1; df++) {
            const wc = ((testCol + dc) % COLS + COLS) % COLS;
            if (walkableSet.has(`${wc}_${flInt + df}`)) {
              blocked = true;
              break;
            }
          }
        }
      }
      if (!blocked) {
        placedPhi = testPhi;
        break;
      }
    }
    if (placedPhi === null) continue;

    const ty = spot.floor * fh;
    const tr = R + BRICK_PROUD + 0.04;
    const tHolder = new THREE.Group();
    tHolder.position.set(Math.sin(placedPhi) * tr, ty, Math.cos(placedPhi) * tr);
    tHolder.rotation.y = placedPhi;

    let wheelNode = null;
    if (turbineGlb) {
      const cloned = turbineGlb.clone(true);
      markSharedSubtree(cloned);
      cloned.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      wheelNode = findNamedObject(cloned, 'turbine_wheel');
      tHolder.add(cloned);
    } else {
      const built = buildProceduralTurbinePair();
      wheelNode = built.wheel;
      tHolder.add(built.housing, built.wheel);
    }

    // Cascading water-arc ring around the Pelton buckets
    const sprayArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.032, 6, 18, Math.PI * 0.85),
      new THREE.MeshBasicMaterial({
        color: spec.conduitGlow,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      })
    );
    sprayArc.position.z = 0.28;
    sprayArc.rotation.z = -0.35;
    tHolder.add(sprayArc);

    group.add(tHolder);
    turbineRotors.push({
      holder: tHolder,
      wheel: wheelNode,
      sprayArc,
      phi: placedPhi,
      y: ty,
      speed: (tIdx % 2 === 0 ? -1 : 1) * (1.55 + tIdx * 0.22),
      isProcedural: !turbineGlb,
    });
  }

  // 7. Biome Lanterns & Crystal Accents Materialization
  if (lanternBodyList.length) {
    const lGlowMat = new THREE.MeshBasicMaterial({ color: '#ffbe42' });
    buildBandedInstancedFromList(group, bandedMeshes, G.templeLantern, trimMetalMat, lanternBodyList, PROP_SPAN_Y);
    buildBandedInstancedFromList(group, bandedMeshes, G.lanternCore, lGlowMat, lanternGlowList, PROP_SPAN_Y, {
      receiveShadow: false,
    });
  }
  if (crystalList.length) {
    const crMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: spec.conduitGlow,
      emissiveIntensity: 0.95,
      roughness: 0.12,
      metalness: 0.25,
    });
    buildBandedInstancedFromList(group, bandedMeshes, G.crystalCluster, crMat, crystalList, PROP_SPAN_Y);
  }

  // 8. Monumental Summit Reactor Core Intake & Arched Aqueduct Crown (`y = totalH .. totalH + 2.6`)
  const crownMat = createBlockMaterial({
    color: spec.crown,
    surface: spec.surface,
    tile: 0.56,
    roughness: spec.roughness,
    metalness: spec.metalness,
    normalScale: spec.normalScale,
    hi: spec.hi,
    angular: false,
    wetStrength: 0,
  });
  const crownMinY = totalH - 0.4;
  const crownMaxY = totalH + 3.2;

  // Molded summit cornice deck + open flooded Central Reactor Shaft Rim (`core_descent` entrance!)
  const rimOuter = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.26, R + 0.04, 0.24, 40), crownMat);
  rimOuter.position.y = totalH + 0.12;
  rimOuter.castShadow = true;
  rimOuter.receiveShadow = true;
  rimOuter.userData = { keepInReflection: true, bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 0.6 };
  group.add(rimOuter);
  bandedMeshes.push(rimOuter);

  // Glowing Flooded Reactor Core Pool inside the summit rim!
  const corePool = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.35, 32),
    createPortalMaterial(spec.conduitDeep, spec.conduitGlow, 1.0, false)
  );
  corePool.rotation.x = -Math.PI * 0.5;
  corePool.position.y = totalH + 0.25;
  group.add(corePool);

  // Sculpted Flying Aqueduct Crown Ribs arching gracefully toward the summit Harmonic Ring
  const crownParts = [];
  const crownMetalParts = [];
  const segA = TWO_PI / CROWN_RIBS;
  for (let b = 0; b < CROWN_RIBS; b++) {
    const ang = b * segA;
    const basePillar = arcSlab(R - 0.14, R + 0.22, segA * 0.42, 0.68, 0.026, 2, 1, 0.02, R - 0.02);
    basePillar.rotateY(ang);
    basePillar.translate(0, totalH + 0.92, 0);
    crownParts.push(basePillar);

    const archArm = new THREE.BoxGeometry(0.16, 1.45, 0.22);
    archArm.rotateX(-0.58);
    archArm.translate(0, totalH + 1.42, R - 0.42);
    archArm.rotateY(ang);
    crownMetalParts.push(archArm);
  }
  const summitRing = new THREE.TorusGeometry(R * 0.46, 0.095, 8, 28);
  summitRing.rotateX(Math.PI * 0.5);
  summitRing.translate(0, totalH + 1.95, 0);
  crownMetalParts.push(summitRing);

  const crownStoneMesh = new THREE.Mesh(mergeGeometries(crownParts), crownMat);
  crownStoneMesh.castShadow = true;
  crownStoneMesh.receiveShadow = true;
  crownStoneMesh.userData = { keepInReflection: true, bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 1.0 };
  const crownMetalMesh = new THREE.Mesh(mergeGeometries(crownMetalParts), trimMetalMat);
  crownMetalMesh.castShadow = true;
  crownMetalMesh.userData = { keepInReflection: true, bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 1.4 };
  group.add(crownStoneMesh, crownMetalMesh);
  bandedMeshes.push(crownStoneMesh, crownMetalMesh);

  // Summit Harmonic Water-Seed Beacon Sprites
  const crownFlames = [];
  for (let i = 0; i < 4; i++) {
    const fl = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: T.glowDot,
        color: i % 2 === 0 ? spec.conduitGlow : spec.accentGlow,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    fl.position.y = totalH + 2.05;
    group.add(fl);
    crownFlames.push(fl);
  }

  // 9. Flared Submerged River/Lake/Sea Foundation Plinth (`y = -3.2 .. -0.2`)
  const plinthMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: mortarColor,
      roughness: 0.84,
      metalness: 0.06,
    }),
    0.72
  );
  stoneMats.push(plinthMat);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.56, 3.0, 32), plinthMat);
  plinth.position.y = -1.7;
  plinth.receiveShadow = true;
  plinth.userData = { keepInReflection: true, bandMinY: -3.4, bandMaxY: 0.3, bandMidY: -1.5 };
  group.add(plinth);
  bandedMeshes.push(plinth);

  return {
    coreMat,
    conduitMat,
    corePoolMat: corePool.material,
    crownFlames,
    turbineRotors,
    totalH,
    mossList,
    coralList,
    trimMetalMat,
    darkMetalMat,
  };
}

// ============================================================================
// 9. EXTERIOR SANCTUM CLUE STELES (`tower.runeDoors` + `door.clue` + `tower.clue`)
// ============================================================================

let CLUE_FRAME_MAT = null;
function getClueFrameMaterial() {
  if (CLUE_FRAME_MAT) return CLUE_FRAME_MAT;
  CLUE_FRAME_MAT = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.74,
  });
  CLUE_FRAME_MAT.userData.shared = true;
  return CLUE_FRAME_MAT;
}

function paintGeoVertexColor(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const c = new THREE.Color(hex);
  const cnt = g.attributes.position.count;
  const arr = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function remapGeoUvRect(geo, u0, v0, u1, v1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const uv = g.attributes.uv;
  if (uv) {
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    uv.needsUpdate = true;
  }
  return g;
}

function wrapTowerCol(c) {
  return ((Math.round(Number(c) || 0) % COLS) + COLS) % COLS;
}

function isClueBayBlocked(tower, candCol, doorFloor, selfDoor) {
  const wc = wrapTowerCol(candCol);
  const yLo = doorFloor + 1.35;
  const yHi = doorFloor + 2.55;
  for (const l of tower?.ledges || []) {
    if (wrapTowerCol(l.col) !== wc) continue;
    const lf = Number(l.floor) || 0;
    if (l.type === 'pillar' || (l.type === 'box' && l.h)) {
      const topF = lf + Math.max(1, Number(l.h) || 1);
      if (lf < yHi && topF > yLo) return true;
    } else if (lf >= yLo && lf <= yHi) {
      return true;
    }
  }
  for (const d of tower?.doors || []) {
    if (d === selfDoor || (selfDoor?.id && d.id === selfDoor.id)) continue;
    if (wrapTowerCol(d.col) === wc && Math.abs((Number(d.floor) || 0) - (doorFloor + 1.85)) < 1.15) {
      return true;
    }
  }
  for (const el of tower?.elevators || []) {
    if (
      wrapTowerCol(el.col) === wc &&
      doorFloor + 1.85 >= (Number(el.minFloor) || 0) - 0.5 &&
      doorFloor + 1.85 <= (Number(el.maxFloor) || 0) + 1.5
    ) {
      return true;
    }
  }
  return false;
}

function resolveClueColOffset(tower, door) {
  if (typeof door?.clueColOffset === 'number' && Number.isFinite(door.clueColOffset) && door.clueColOffset !== 0) {
    return door.clueColOffset;
  }
  if (typeof door?.clue?.clueColOffset === 'number' && Number.isFinite(door.clue.clueColOffset) && door.clue.clueColOffset !== 0) {
    return door.clue.clueColOffset;
  }
  const df = Number(door?.floor) || 0;
  if (!isClueBayBlocked(tower, door?.col, df, door)) return 0;
  for (const candOff of [1, -1, 2, -2]) {
    if (!isClueBayBlocked(tower, (Number(door?.col) || 0) + candOff, df, door)) {
      return candOff * 1.24;
    }
  }
  return 0;
}

function normalizeResolvedClue(rawClue, fallbackType = 'lights') {
  if (!rawClue || !rawClue.kind) return { kind: fallbackType };
  if (rawClue.kind === 'lights') {
    const n = Math.max(2, Math.min(5, Number(rawClue.n) || Math.round(Math.sqrt(rawClue.pattern?.length || 9)) || 3));
    const pat = Array.isArray(rawClue.pattern)
      ? rawClue.pattern.slice(0, n * n).map((v) => (v ? 1 : 0))
      : new Array(n * n).fill(0);
    while (pat.length < n * n) pat.push(0);
    return { kind: 'lights', n, pattern: pat };
  }
  if (rawClue.kind === 'bells') {
    const order = Array.isArray(rawClue.order) ? rawClue.order.slice() : [];
    const colors =
      Array.isArray(rawClue.colors) && rawClue.colors.length === order.length
        ? rawClue.colors.slice()
        : order.map((cIdx) => BELL_COLORS[Number(cIdx) % BELL_COLORS.length] || '#5efce8');
    if (!order.length && Array.isArray(rawClue.colors) && rawClue.colors.length) {
      return {
        kind: 'bells',
        order: rawClue.colors.map((_, i) => i),
        colors: rawClue.colors.slice(),
      };
    }
    return { kind: 'bells', order, colors };
  }
  return { kind: String(rawClue.kind) };
}

function collectTowerClueEntries(tower) {
  if (!tower) return [];
  const mergedByKey = new Map();
  const ingestDoor = (d) => {
    if (!d) return;
    const key = d.id ? `id:${d.id}` : `cf:${wrapTowerCol(d.col)}_${Math.round(Number(d.floor) || 0)}`;
    const prev = mergedByKey.get(key);
    mergedByKey.set(key, prev ? { ...prev, ...d, clue: d.clue || prev.clue } : { ...d });
  };
  if (Array.isArray(tower.runeDoors)) {
    for (const rd of tower.runeDoors) ingestDoor(rd);
  }
  if (Array.isArray(tower.doors)) {
    for (const d of tower.doors) {
      if (d && (d.isRune || d.rune)) ingestDoor(d);
    }
  }

  const runeDoorList = Array.from(mergedByKey.values());
  const entries = [];

  if (runeDoorList.length > 0) {
    for (let idx = 0; idx < runeDoorList.length; idx++) {
      const door = runeDoorList[idx];
      const pType =
        door.puzzleType ||
        door.clue?.kind ||
        PUZZLE_TYPES[((Number(tower.id) || 1) - 1 + idx) % PUZZLE_TYPES.length] ||
        'lights';
      let rawClue = door.clue || null;
      if (!rawClue && tower.clue && (tower.clue.doorId === door.id || (runeDoorList.length === 1 && tower.clue.kind === pType))) {
        rawClue = tower.clue;
      }
      if (!rawClue) {
        try {
          const pSeed = door.puzzleSeed ?? ((Number(tower.id) || 1) * 7919 + 17 + idx * 131);
          const pDiff = door.puzzleDifficulty ?? Math.min(0.85, 0.25 + ((Number(tower.id) || 1) - 1) * 0.08);
          const puz = makePuzzle({ type: pType, seed: pSeed, difficulty: pDiff, hideTarget: false });
          rawClue = puz?.clue || { kind: pType };
        } catch {
          rawClue = { kind: pType };
        }
      }
      const clue = normalizeResolvedClue(rawClue, pType);
      const colOffset = resolveClueColOffset(tower, door);
      const doorCol = Number(door.col) || 0;
      const doorFloor = Number(door.floor) || 0;
      entries.push({
        doorId: door.id || null,
        doorCol,
        doorFloor,
        colOffset,
        colCenter: doorCol + 0.5 + colOffset,
        floorY: doorFloor + 1.85,
        clue,
      });
    }
    return entries;
  }

  if (tower.clue && tower.clue.kind) {
    const dc = Number(tower.clue.col) || 0;
    const df = Number(tower.clue.floor) || 2;
    entries.push({
      doorId: tower.clue.doorId || null,
      doorCol: dc,
      doorFloor: df,
      colOffset: 0,
      colCenter: dc + 0.5,
      floorY: df + 1.45,
      clue: normalizeResolvedClue(tower.clue, tower.clue.kind),
    });
  }
  return entries;
}

function computeClueEntriesSignature(entries) {
  if (!entries || !entries.length) return 'none';
  let s = '';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const c = e.clue;
    const pat = c.pattern ? c.pattern.join('') : c.colors ? c.colors.join(',') : '';
    s += `${e.colCenter.toFixed(2)}@${e.floorY.toFixed(2)}:${c.kind}:${c.n || ''}:${pat}|`;
  }
  return s;
}

function createClueSteleCanvasTex(clue, ownedTextures) {
  const W = 512;
  const H = 512;
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext && cv.getContext('2d');
    if (ctx) {
      drawClueSteleArtwork(ctx, W, H, clue);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = 4;
      if (Array.isArray(ownedTextures)) ownedTextures.push(tex);
      return tex;
    }
  }
  const fallback = new THREE.DataTexture(new Uint8Array([94, 242, 255, 255]), 1, 1, THREE.RGBAFormat);
  fallback.colorSpace = THREE.SRGBColorSpace;
  fallback.needsUpdate = true;
  if (Array.isArray(ownedTextures)) ownedTextures.push(fallback);
  return fallback;
}

function drawClueSteleArtwork(ctx, W, H, clue) {
  ctx.fillStyle = '#050c18';
  ctx.fillRect(0, 0, W, H);

  if (clue.kind === 'lights') {
    const n = clue.n || 3;
    const pad = 34;
    const inner = W - pad * 2;
    const step = inner / n;
    const gap = n >= 4 ? 10 : 13;

    ctx.strokeStyle = '#d49b2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.strokeStyle = 'rgba(94, 242, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const on = Boolean(clue.pattern?.[r * n + c]);
        const x0 = pad + c * step + gap * 0.5;
        const y0 = pad + r * step + gap * 0.5;
        const cs = step - gap;
        const cx = x0 + cs * 0.5;
        const cy = y0 + cs * 0.5;

        if (on) {
          const grd = ctx.createRadialGradient(cx, cy, cs * 0.06, cx, cy, cs * 0.68);
          grd.addColorStop(0.0, '#d8feff');
          grd.addColorStop(0.38, '#5ef2ff');
          grd.addColorStop(0.85, '#17bfd9');
          grd.addColorStop(1.0, '#0c7fa0');
          ctx.fillStyle = grd;
          ctx.fillRect(x0, y0, cs, cs);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = n >= 4 ? 5 : 7;
          ctx.beginPath();
          const dr = cs * 0.28;
          ctx.moveTo(cx, cy - dr);
          ctx.lineTo(cx + dr, cy);
          ctx.lineTo(cx, cy + dr);
          ctx.lineTo(cx - dr, cy);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#081220';
          ctx.fillRect(x0, y0, cs, cs);
          ctx.strokeStyle = '#2d4e70';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(x0 + 4, y0 + 4, cs - 8, cs - 8);
        }
      }
    }
    return;
  }

  if (clue.kind === 'bells') {
    const cols = clue.colors?.length ? clue.colors : ['#ff4f64', '#ffb02e', '#3fe07e'];
    const n = Math.max(1, cols.length);
    const crestH = Math.round(H * 0.76);

    ctx.fillStyle = '#070f1d';
    ctx.fillRect(0, 0, W, crestH);
    ctx.strokeStyle = '#d49b2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, crestH - 16);

    const padX = 28;
    const slotW = (W - padX * 2) / n;
    for (let k = 0; k < n; k++) {
      const hex = cols[k] || '#5efce8';
      const cx = padX + slotW * (k + 0.5);
      ctx.fillStyle = '#101b30';
      ctx.strokeStyle = hex;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, 84, 18, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), cx, 85);

      const bw = Math.min(44, slotW * 0.44);
      const bx0 = cx - bw * 0.5;
      const by0 = 250;
      const by1 = crestH - 26;
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(bx0 + bw, by0);
      ctx.lineTo(bx0 + bw, by1);
      ctx.lineTo(cx, by1 - 20);
      ctx.lineTo(bx0, by1);
      ctx.closePath();
      ctx.fill();

      const sx0 = (k * W) / n;
      const sw = W / n;
      ctx.fillStyle = hex;
      ctx.fillRect(sx0, crestH, sw, H - crestH);
    }
    return;
  }

  ctx.strokeStyle = '#d49b2a';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.strokeStyle = '#5ef2ff';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.5, 118, 0, TWO_PI);
  ctx.stroke();
}

function buildSingleClueStele(entry, fh, ownedTextures) {
  const { clue, colCenter, floorY, colOffset } = entry;
  const g = new THREE.Group();
  const cluePhi = colCenter * COL_ANGLE;
  const clueY = floorY * fh;
  g.rotation.y = cluePhi;
  g.position.y = clueY;

  const steleR = TOWER_RADIUS + 0.58;
  const isBells = clue.kind === 'bells';
  const bellCount = isBells ? Math.max(3, clue.colors?.length || clue.order?.length || 3) : 0;
  const steleW = isBells ? Math.max(1.52, bellCount * 0.34 + 0.28) : 1.38;
  const steleH = isBells ? 1.24 : 1.38;

  const frameParts = [];
  const obsidianHex = '#101a2c';
  const brassHex = '#e0a628';
  const ironHex = '#232c3d';

  const slab = new RoundedBoxGeometry(steleW, steleH, 0.095, 1, 0.018);
  slab.translate(0, 0, steleR - 0.048);
  frameParts.push(paintGeoVertexColor(slab, obsidianHex));

  const railT = 0.054;
  const railD = 0.115;
  const topRail = new THREE.BoxGeometry(steleW + 0.09, railT, railD);
  topRail.translate(0, steleH * 0.5 + railT * 0.35, steleR - 0.025);
  const botRail = new THREE.BoxGeometry(steleW + 0.09, railT, railD);
  botRail.translate(0, -steleH * 0.5 - railT * 0.35, steleR - 0.025);
  const leftRail = new THREE.BoxGeometry(railT, steleH + 0.05, railD);
  leftRail.translate(-steleW * 0.5 - railT * 0.35, 0, steleR - 0.025);
  const rightRail = new THREE.BoxGeometry(railT, steleH + 0.05, railD);
  rightRail.translate(steleW * 0.5 + railT * 0.35, 0, steleR - 0.025);
  frameParts.push(
    paintGeoVertexColor(topRail, brassHex),
    paintGeoVertexColor(botRail, brassHex),
    paintGeoVertexColor(leftRail, brassHex),
    paintGeoVertexColor(rightRail, brassHex)
  );

  const armLen = steleR - TOWER_RADIUS + 0.04;
  const armMidZ = (TOWER_RADIUS - 0.03 + steleR - 0.05) * 0.5;
  for (const sx of [-steleW * 0.34, steleW * 0.34]) {
    const arm = new THREE.BoxGeometry(0.072, 0.082, armLen);
    arm.translate(sx, steleH * 0.28, armMidZ);
    const strut = new THREE.BoxGeometry(0.055, 0.062, armLen * 1.08);
    strut.rotateX(0.46);
    strut.translate(sx, -steleH * 0.16, armMidZ);
    frameParts.push(paintGeoVertexColor(arm, ironHex), paintGeoVertexColor(strut, brassHex));
  }

  if (colOffset !== 0) {
    const reachX = -Math.sign(colOffset) * Math.min(1.65, Math.abs(colOffset) * (TOWER_RADIUS + 0.45) * COL_ANGLE * 0.82);
    const hArm = new THREE.BoxGeometry(Math.abs(reachX), 0.062, 0.068);
    hArm.translate(reachX * 0.5, -steleH * 0.38, steleR - 0.06);
    frameParts.push(paintGeoVertexColor(hArm, brassHex));
  }

  g.add(new THREE.Mesh(mergeGeometries(frameParts), getClueFrameMaterial()));

  const steleTex = createClueSteleCanvasTex(clue, ownedTextures);
  const faceParts = [];
  const faceW = steleW - 0.04;
  const faceH = steleH - 0.04;

  if (isBells) {
    const backing = remapGeoUvRect(new THREE.PlaneGeometry(faceW, faceH), 0, 0.24, 1, 1);
    backing.translate(0, 0, steleR + 0.004);
    faceParts.push(backing);

    const bellProf = [
      new THREE.Vector2(0.0, -0.105),
      new THREE.Vector2(0.118, -0.105),
      new THREE.Vector2(0.124, -0.078),
      new THREE.Vector2(0.086, -0.028),
      new THREE.Vector2(0.068, 0.048),
      new THREE.Vector2(0.048, 0.088),
      new THREE.Vector2(0.0, 0.098),
    ];
    const padFrac = 28 / 512;
    const usableW = faceW * (1 - padFrac * 2);
    const slotW = usableW / bellCount;
    for (let k = 0; k < bellCount; k++) {
      const bx = -usableW * 0.5 + slotW * (k + 0.5);
      const u0 = (k + 0.08) / bellCount;
      const u1 = (k + 0.92) / bellCount;
      const bellBody = remapGeoUvRect(new THREE.LatheGeometry(bellProf, 12), u0, 0.01, u1, 0.23);
      bellBody.translate(bx, 0.07, steleR + 0.072);
      const shackle = remapGeoUvRect(new THREE.TorusGeometry(0.024, 0.008, 5, 10), u0, 0.01, u1, 0.23);
      shackle.translate(bx, 0.178, steleR + 0.07);
      const clapper = remapGeoUvRect(new THREE.SphereGeometry(0.028, 7, 5), u0, 0.01, u1, 0.23);
      clapper.translate(bx, -0.05, steleR + 0.074);
      faceParts.push(bellBody, shackle, clapper);
    }
  } else {
    const backing = new THREE.PlaneGeometry(faceW, faceH);
    backing.translate(0, 0, steleR + 0.004);
    faceParts.push(backing);

    if (clue.kind === 'lights' && clue.n && Array.isArray(clue.pattern)) {
      const n = clue.n;
      const padFrac = 34 / 512;
      const stepFrac = (1 - padFrac * 2) / n;
      const gapFrac = (n >= 4 ? 10 : 13) / 512;
      const cellW = (stepFrac - gapFrac) * faceW;
      const cellH = (stepFrac - gapFrac) * faceH;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (!clue.pattern[r * n + c]) continue;
          const u0 = padFrac + c * stepFrac + gapFrac * 0.5;
          const u1 = padFrac + (c + 1) * stepFrac - gapFrac * 0.5;
          const vTop = 1 - (padFrac + r * stepFrac + gapFrac * 0.5);
          const vBot = 1 - (padFrac + (r + 1) * stepFrac - gapFrac * 0.5);
          const cx = ((u0 + u1) * 0.5 - 0.5) * faceW;
          const cy = ((vBot + vTop) * 0.5 - 0.5) * faceH;
          const raised = remapGeoUvRect(new THREE.BoxGeometry(cellW, cellH, 0.036), u0, vBot, u1, vTop);
          raised.translate(cx, cy, steleR + 0.022);
          faceParts.push(raised);
        }
      }
    }
  }

  const faceMat = new THREE.MeshBasicMaterial({
    map: steleTex,
    color: '#ffffff',
    toneMapped: false,
    fog: false,
  });
  g.add(new THREE.Mesh(mergeGeometries(faceParts), faceMat));

  return {
    group: g,
    phi: cluePhi,
    y: clueY,
    doorId: entry.doorId,
    doorCol: entry.doorCol,
    doorFloor: entry.doorFloor,
    faceMat,
  };
}

function buildAllTowerClueSteles(tower, fh, group, cullableNodes, ownedTextures) {
  const container = new THREE.Group();
  group.add(container);

  let builtList = [];
  let activeSig = '';

  const rebuildFromTower = (liveTower) => {
    while (container.children.length > 0) {
      const child = container.children[0];
      container.remove(child);
      child.traverse((o) => {
        if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
        if (o.material?.map && !o.material.map.userData?.shared) o.material.map.dispose();
      });
    }
    for (let i = cullableNodes.length - 1; i >= 0; i--) {
      if (cullableNodes[i].isClueStele) cullableNodes.splice(i, 1);
    }

    const entries = collectTowerClueEntries(liveTower);
    activeSig = computeClueEntriesSignature(entries);
    builtList = [];
    for (let i = 0; i < entries.length; i++) {
      const built = buildSingleClueStele(entries[i], fh, ownedTextures);
      container.add(built.group);
      cullableNodes.push({
        node: built.group,
        phi: built.phi,
        y: built.y,
        isClueStele: true,
      });
      builtList.push(built);
    }
  };

  rebuildFromTower(tower);

  return {
    update: (t, state, liveTower) => {
      if (liveTower && (liveTower.clue || liveTower.runeDoors || liveTower.doors)) {
        const checkEntries = collectTowerClueEntries(liveTower);
        const nextSig = computeClueEntriesSignature(checkEntries);
        if (nextSig !== activeSig) rebuildFromTower(liveTower);
      }

      const liveDoors = state?.doors || liveTower?.doors || [];
      for (let i = 0; i < builtList.length; i++) {
        const b = builtList[i];
        let solved = false;
        for (let dIdx = 0; dIdx < liveDoors.length; dIdx++) {
          const ld = liveDoors[dIdx];
          if ((b.doorId && ld.id === b.doorId) || (ld.col === b.doorCol && ld.floor === b.doorFloor && (ld.isRune || ld.rune))) {
            solved = Boolean(ld.solved);
            break;
          }
        }
        if (solved) {
          b.faceMat.color.setRGB(0.74, 0.98, 0.86);
        } else {
          b.faceMat.color.setScalar(0.94 + 0.06 * Math.sin(t * 2.8 + i));
        }
      }
    },
  };
}

// ============================================================================
// 10. INTERACTIVE PIPE-VALVES (`pipe_valve.glb`), SWITCHES, WORKBENCH & CHEST
// ============================================================================

export function buildSwitchMesh(mode = 'pipeValve', glbAssets = null) {
  const g = new THREE.Group();
  const G = getSharedArchGeometries();
  const valveGlb = glbAssets?.pipe_valve || INTERNAL_GLB_CACHE.pipe_valve || null;

  const isValve =
    mode === 'pipeValve' || mode === 'floodValve' || mode === 'drainValve' || mode === 'valve';

  const sightMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#f59e0b',
    emissiveIntensity: 1.35,
    roughness: 0.12,
  });

  let wheel = null;
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), sightMat);
  orb.position.y = 0.42;

  if (isValve && valveGlb) {
    const cloned = valveGlb.clone(true);
    markSharedSubtree(cloned);
    cloned.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.name === 'valve_sight_core' || o.parent?.name === 'valve_sight_core') {
          o.material = sightMat;
        }
      }
    });
    wheel = findNamedObject(cloned, 'valve_wheel');
    g.add(cloned);
    orb.visible = false;
    g.add(orb);
  } else if (isValve) {
    const ironMat = new THREE.MeshStandardMaterial({ color: '#253142', metalness: 0.82, roughness: 0.36 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: '#cf9638', metalness: 0.88, roughness: 0.24 });
    const copperMat = new THREE.MeshStandardMaterial({ color: '#d95d39', metalness: 0.78, roughness: 0.28 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.12, 10), ironMat);
    base.position.y = 0.06;
    const standPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.62, 10), bronzeMat);
    standPipe.position.y = 0.36;
    const wallPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10), ironMat);
    wallPipe.rotation.x = Math.PI * 0.5;
    wallPipe.position.set(0, 0.56, -0.2);
    const sightCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.22, 10), sightMat);
    sightCyl.position.y = 0.35;

    wheel = new THREE.Mesh(G.valveWheel, copperMat);
    wheel.position.set(0, 0.56, 0.2);
    wheel.castShadow = true;

    orb.visible = false;
    g.add(base, standPipe, wallPipe, sightCyl, wheel, orb);
  } else {
    const ironMat = new THREE.MeshStandardMaterial({ color: '#2b384b', metalness: 0.8, roughness: 0.32 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d9a438', metalness: 0.88, roughness: 0.22 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.24, 12), ironMat);
    ped.position.y = 0.12;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.028, 6, 18), brassMat);
    collar.rotation.x = Math.PI * 0.5;
    collar.position.y = 0.24;
    g.add(ped, collar, orb);
  }

  g.userData = { orb, orbMat: sightMat, wheel, mode, isValve, usedGlb: Boolean(isValve && valveGlb) };
  return g;
}

export function buildWorkbenchMesh() {
  const g = new THREE.Group();
  const T = getDetailTextures();
  const timberMat = new THREE.MeshStandardMaterial({ color: '#734427', roughness: 0.68, metalness: 0.1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#242d3d', roughness: 0.38, metalness: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.22, metalness: 0.88 });

  const top = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.085, 0.52, 1, 0.014), timberMat);
  top.position.y = 0.44;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const legGeo = new THREE.BoxGeometry(0.068, 0.43, 0.068);
  for (const lx of [-0.38, 0.38]) {
    for (const lz of [-0.19, 0.19]) {
      const leg = new THREE.Mesh(legGeo, ironMat);
      leg.position.set(lx, 0.215, lz);
      g.add(leg);
    }
  }

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.36, 8), brassMat);
  lampStem.position.set(0.32, 0.64, -0.12);
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.11, 10), brassMat);
  lampShade.position.set(0.2, 0.76, -0.02);
  const lampGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: T.glowDot,
      color: '#5efce8',
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  lampGlow.scale.set(0.95, 0.85, 1);
  lampGlow.position.set(0.08, 0.68, 0.04);
  g.add(lampStem, lampShade, lampGlow);

  const dynamoGroup = new THREE.Group();
  dynamoGroup.position.set(-0.02, 0.66, 0.02);
  const holoMat = new THREE.MeshBasicMaterial({
    color: '#5efce8',
    wireframe: true,
    transparent: true,
    opacity: 0.52,
  });
  const holoGhost = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), holoMat);

  const craftedGroup = new THREE.Group();
  craftedGroup.visible = false;
  const dynamoCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.15, 0),
    new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#10b981',
      emissiveIntensity: 1.35,
      roughness: 0.12,
    })
  );
  const dynamoCoil = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 8, 20), brassMat);
  craftedGroup.add(dynamoCore, dynamoCoil);

  dynamoGroup.add(holoGhost, craftedGroup);
  g.add(dynamoGroup);
  g.userData = { dynamoGroup, holoGhost, holoMat, craftedGroup, dynamoCoil, lampGlow };
  return g;
}

export function buildTreasureChestMesh() {
  const g = new THREE.Group();
  const T = getDetailTextures();
  const oakMat = new THREE.MeshStandardMaterial({ color: '#61371b', roughness: 0.64, metalness: 0.14 });
  const bandMat = new THREE.MeshStandardMaterial({ color: '#263044', roughness: 0.36, metalness: 0.82 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#fde047',
    emissive: '#d97706',
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.88,
  });

  const box = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.3, 0.44, 1, 0.016), oakMat);
  box.position.y = 0.15;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  for (const bx of [-0.24, 0, 0.24]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.31, 0.46), bx === 0 ? goldMat : bandMat);
    strap.position.set(bx, 0.155, 0);
    g.add(strap);
  }

  const hoardGroup = new THREE.Group();
  hoardGroup.position.y = 0.28;
  const goldPile = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 12, 8),
    new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#f59e0b',
      emissiveIntensity: 1.1,
      metalness: 0.78,
      roughness: 0.16,
    })
  );
  goldPile.scale.set(1.15, 0.36, 0.72);
  hoardGroup.add(goldPile);
  g.add(hoardGroup);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.3, -0.22);
  const lidGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.68, 12, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI * 0.5);
  const lidWood = new THREE.Mesh(lidGeo, oakMat);
  lidWood.position.set(0, 0, 0.22);
  lidPivot.add(lidWood);
  g.add(lidPivot);

  const treasureGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: T.glowDot,
      color: '#fde047',
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  treasureGlow.scale.set(1.4, 1.25, 1);
  treasureGlow.position.set(0, 0.48, 0.05);
  g.add(treasureGlow);

  g.userData = { lidPivot, hoardGroup, treasureGlow, openLerp: 0 };
  return g;
}

// ============================================================================
// 11. MAIN BUILDER: `buildDetailedTowerGroup(tower, era, glbAssets)`
// ============================================================================

export function buildDetailedTowerGroup(tower, _eraCompat = 'reboot', glbAssets = {}) {
  ensureInternalGlbLoad();

  const fh = getTowerStepHeight(tower, false, glbAssets?.fh);
  const rbTheme = resolveRebootTheme(tower);
  const spec = BIOME_SPECS[rbTheme] || BIOME_SPECS.canyon_river;
  const pal = tower?.palette || {};

  const R = TOWER_RADIUS;
  const ledgeR = R + LEDGE_OFFSET;
  const liftR = R + LIFT_OFFSET;
  const group = new THREE.Group();
  const G = getSharedArchGeometries();
  const T = getDetailTextures();
  const stoneMats = [];

  const stairGlb = markSharedSubtree(glbAssets?.real_staircase || glbAssets?.realStaircase || INTERNAL_GLB_CACHE.real_staircase || null);
  const liftGlb = markSharedSubtree(glbAssets?.mech_elevator || glbAssets?.mechElevator || INTERNAL_GLB_CACHE.mech_elevator || null);
  const turbineGlb = markSharedSubtree(glbAssets?.hydro_turbine || glbAssets?.hydroTurbine || INTERNAL_GLB_CACHE.hydro_turbine || null);
  const valveGlb = markSharedSubtree(glbAssets?.pipe_valve || glbAssets?.pipeValve || INTERNAL_GLB_CACHE.pipe_valve || null);

  // 1. Precompute Doorway Openings, Mechanical Elevator Shafts, Hydro-Conduits & Buttress Ribs
  const halfDoorAngle = (DOOR_W * 0.5) / (R + BRICK_PROUD);
  const holes = (tower?.doors || []).map((d) => ({
    a: (d.col + 0.5) * COL_ANGLE,
    w: halfDoorAngle,
    y0: d.floor * fh + 0.01,
    y1: d.floor * fh + DOOR_H - 0.01,
  }));

  const shafts = (tower?.elevators || []).map((el) => ({
    a: (el.col + 0.5) * COL_ANGLE,
    w: COL_ANGLE * 0.52,
    y0: (el.minFloor ?? 0) * fh - 0.3,
    y1: ((el.maxFloor ?? 4) + 1.55) * fh,
  }));

  const walkableSet = new Set();
  for (const l of tower?.ledges || []) {
    if (l.type !== 'box' && l.type !== 'pillar' && l.type !== 'laserGate') {
      walkableSet.add(`${wrapTowerCol(l.col)}_${Math.round(Number(l.floor) || 0)}`);
    }
  }

  const totalH = (tower?.floors || 18) * fh;
  const initialClueEntries = collectTowerClueEntries(tower);
  const pipeAvoidHoles = holes.concat(
    initialClueEntries.map((ce) => ({
      a: ce.colCenter * COL_ANGLE,
      w: COL_ANGLE * 0.72,
      y0: (ce.floorY - 0.75) * fh,
      y1: (ce.floorY + 0.75) * fh,
    }))
  );

  const buttressAngles = selectClearSpireAngles(spec.buttressCount || 5, 0.12, shafts, pipeAvoidHoles, totalH);
  const conduitAngles = selectClearSpireAngles(
    spec.conduitCount || 5,
    0.12 + 0.5 / (spec.conduitCount || 5),
    shafts,
    pipeAvoidHoles,
    totalH
  );
  const conduitChannels = conduitAngles.map((a) => ({
    a,
    w: 0.068,
    y0: 0.1,
    y1: totalH - 0.25,
  }));

  const bandedMeshes = [];
  const cullableNodes = [];
  const wallAoTex = buildWallAoLightTexture(tower, fh, totalH, initialClueEntries, conduitAngles);
  const ownedTextures = wallAoTex && !wallAoTex.userData?.shared ? [wallAoTex] : [];

  const bodyInfo = buildTowerMasonryAndAccents(
    group,
    tower,
    rbTheme,
    fh,
    holes,
    shafts,
    conduitChannels,
    buttressAngles,
    stoneMats,
    bandedMeshes,
    wallAoTex,
    pipeAvoidHoles,
    turbineGlb,
    walkableSet
  );

  const trimMetalMat = bodyInfo.trimMetalMat;
  const darkMetalMat = bodyInfo.darkMetalMat;

  // 2. Exterior Sanctum Clue Steles
  const builtClues = buildAllTowerClueSteles(tower, fh, group, cullableNodes, ownedTextures);
  const clueUpdater = builtClues.update;

  // 3. Grand 1.38u-Tall Illuminated Arched Sanctum Doorways
  const mistSprites = [];
  const sparkEmitters = [];
  const sparkInstancers = [];
  const exitRings = [];
  const runeDoors = [];
  const portalMats = [bodyInfo.corePoolMat];
  const forgeLights = [];

  const useExternalVfx = Boolean(glbAssets?.useOceanVfx);
  const ashlarInstances = [];
  const doorArchParts = [];
  const doorMetalParts = [];
  const portalBuckets = new Map();

  const ashlarMat = createBlockMaterial({
    color: spec.ledgeTop,
    surface: spec.surface,
    tile: 0.58,
    roughness: Math.max(0.34, spec.roughness - 0.08),
    metalness: Math.min(0.25, spec.metalness),
    normalScale: spec.normalScale,
    hi: spec.hi,
    angular: false,
    wetStrength: 0.82,
    wallAoTex,
    totalH,
  });
  stoneMats.push(ashlarMat);

  const transformDoorGeo = (geo, phi, centerY) => {
    _e.set(0, phi, 0);
    _q.setFromEuler(_e);
    _pos.set(R * Math.sin(phi), centerY, R * Math.cos(phi));
    _scl.set(1, 1, 1);
    _m4.compose(_pos, _q, _scl);
    geo.applyMatrix4(_m4);
    return geo;
  };

  for (const door of tower?.doors || []) {
    const phi = (door.col + 0.5) * COL_ANGLE;
    const isRuneDoor = Boolean(door.isRune || door.rune);
    const isVaultDoor = Boolean(door.isVault || door.vault);
    const isExitDoor = Boolean(door.isExit);
    const isSparkArch = door.tunnelStyle === 'sparkArch' && !isExitDoor && !isVaultDoor && !isRuneDoor;
    const isPassageDoor = !isSparkArch && !isRuneDoor && !isVaultDoor && !isExitDoor;
    const doorCenterY = door.floor * fh + DOOR_H * 0.5;

    const pGlow = isExitDoor
      ? '#0ea5e9'
      : isRuneDoor
      ? '#14b8a6'
      : isVaultDoor
      ? '#8b5cf6'
      : isSparkArch
      ? '#ea580c'
      : spec.doorThroat;
    const pGlow2 = isExitDoor
      ? '#fef08a'
      : isRuneDoor
      ? '#99f6e4'
      : isVaultDoor
      ? '#fde047'
      : isSparkArch
      ? '#ffd166'
      : spec.doorMist;

    const pKey = `${pGlow}_${pGlow2}_${isPassageDoor ? 'M' : 'V'}`;
    let pBucket = portalBuckets.get(pKey);
    if (!pBucket) {
      pBucket = { pGlow, pGlow2, isMist: isPassageDoor, parts: [] };
      portalBuckets.set(pKey, pBucket);
    }
    const pQuad = new THREE.PlaneGeometry(DOOR_W * 0.96, DOOR_H * 0.98);
    pQuad.translate(0, 0, -0.015);
    pBucket.parts.push(transformDoorGeo(pQuad, phi, doorCenterY));

    // Sculpted Arched Sanctum Doorway Surround: Twin Colonnettes + Semicircular Stone Archivolt + Keystone + Threshold Sill!
    const archRad = DOOR_W * 0.5 + 0.08;
    const legH = DOOR_H - archRad + 0.08;
    for (const sx of [-1, 1]) {
      const colPillar = new THREE.CylinderGeometry(0.105, 0.12, legH, 10);
      colPillar.translate(sx * archRad, -DOOR_H * 0.5 + legH * 0.5, 0.08);
      doorArchParts.push(transformDoorGeo(colPillar, phi, doorCenterY));

      const capBlock = new RoundedBoxGeometry(0.27, 0.11, 0.34, 1, 0.018);
      capBlock.translate(sx * archRad, -DOOR_H * 0.5 + legH + 0.02, 0.09);
      doorMetalParts.push(transformDoorGeo(capBlock, phi, doorCenterY));
    }

    const archivolt = new THREE.TorusGeometry(archRad, 0.115, 8, 18, Math.PI);
    archivolt.translate(0, DOOR_H * 0.5 - archRad, 0.085);
    doorArchParts.push(transformDoorGeo(archivolt, phi, doorCenterY));

    const innerBronzeTrim = new THREE.TorusGeometry(archRad - 0.065, 0.036, 6, 18, Math.PI);
    innerBronzeTrim.translate(0, DOOR_H * 0.5 - archRad, 0.14);
    doorMetalParts.push(transformDoorGeo(innerBronzeTrim, phi, doorCenterY));

    const keystone = new RoundedBoxGeometry(0.24, 0.28, 0.36, 1, 0.024);
    keystone.translate(0, DOOR_H * 0.5 + 0.06, 0.11);
    doorMetalParts.push(transformDoorGeo(keystone, phi, doorCenterY));

    const sill = new RoundedBoxGeometry(DOOR_W + 0.42, 0.09, 0.42, 1, 0.018);
    sill.translate(0, -DOOR_H * 0.5 + 0.035, 0.09);
    doorArchParts.push(transformDoorGeo(sill, phi, doorCenterY));

    if (isSparkArch) {
      sparkEmitters.push({ col: door.col, floor: door.floor, y: door.floor * fh, ang: phi });
    }

    if (isRuneDoor || isVaultDoor || isExitDoor) {
      const dg = new THREE.Group();
      dg.position.set(R * Math.sin(phi), doorCenterY, R * Math.cos(phi));
      dg.rotation.y = phi;

      if (isRuneDoor) {
        const ringMat = new THREE.MeshStandardMaterial({
          color: '#5efce8',
          emissive: '#14b8a6',
          emissiveIntensity: 1.45,
          roughness: 0.18,
        });
        const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.038, 6, 24), ringMat);
        ringMesh.position.set(0, 0.04, 0.16);

        const gemMat = new THREE.MeshStandardMaterial({
          color: '#5efce8',
          emissive: '#0d9488',
          emissiveIntensity: 1.55,
          roughness: 0.14,
        });
        const keystoneGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), gemMat);
        keystoneGem.position.set(0, DOOR_H * 0.5 + 0.08, 0.29);

        const sigilMat = new THREE.MeshBasicMaterial({
          map: T.runeSigil,
          color: '#5efce8',
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sigilMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), sigilMat);
        sigilMesh.position.set(0, 0.04, 0.18);

        dg.add(ringMesh, keystoneGem, sigilMesh);
        runeDoors.push({
          id: door.id,
          col: door.col,
          floor: door.floor,
          ringMat,
          gemMat,
          sigilMat,
          ringMesh,
          sigilMesh,
        });
      } else if (isVaultDoor) {
        const goldLockMat = new THREE.MeshStandardMaterial({
          color: '#fde047',
          emissive: '#d97706',
          emissiveIntensity: 1.25,
          metalness: 0.88,
          roughness: 0.18,
        });
        const aquaLockMat = new THREE.MeshStandardMaterial({
          color: '#67e8f9',
          emissive: '#0891b2',
          emissiveIntensity: 1.2,
          metalness: 0.65,
          roughness: 0.22,
        });
        const outerLock = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 6, 24), goldLockMat);
        outerLock.position.set(0, 0.03, 0.16);
        const innerLock = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 6, 20), aquaLockMat);
        innerLock.position.set(0, 0.03, 0.18);
        dg.add(outerLock, innerLock);
        exitRings.push(outerLock, innerLock);
      } else if (isExitDoor) {
        const crownGoldMat = new THREE.MeshStandardMaterial({
          color: '#fde047',
          emissive: '#06b6d4',
          emissiveIntensity: 1.35,
          metalness: 0.9,
          roughness: 0.16,
        });
        const exitHalo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.048, 6, 24), crownGoldMat);
        exitHalo.rotation.x = Math.PI * 0.5;
        exitHalo.position.set(0, DOOR_H * 0.5 + 0.42, 0.18);

        const crownGrp = new THREE.Group();
        crownGrp.position.set(0, DOOR_H * 0.5 + 0.42, 0.18);
        crownGrp.add(new THREE.Mesh(G.exitCrownTines, crownGoldMat));

        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.46, 3.8, 14, 1, true),
          new THREE.MeshBasicMaterial({
            color: '#67e8f9',
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        beam.position.set(0, DOOR_H * 0.5 + 1.95, 0.16);
        dg.add(exitHalo, crownGrp, beam);
        exitRings.push(crownGrp);
      }

      group.add(dg);
      cullableNodes.push({ node: dg, phi, y: doorCenterY });
    }
  }

  for (const bucket of portalBuckets.values()) {
    const pMat = createPortalMaterial(bucket.pGlow, bucket.pGlow2, DOOR_H / DOOR_W, bucket.isMist);
    portalMats.push(pMat);
    group.add(new THREE.Mesh(mergeGeometries(bucket.parts), pMat));
  }
  if (doorArchParts.length) {
    const archMesh = new THREE.Mesh(mergeGeometries(doorArchParts), ashlarMat);
    archMesh.castShadow = true;
    archMesh.receiveShadow = true;
    group.add(archMesh);
  }
  if (doorMetalParts.length) {
    const doorTrimMesh = new THREE.Mesh(mergeGeometries(doorMetalParts), trimMetalMat);
    doorTrimMesh.castShadow = true;
    group.add(doorTrimMesh);
  }

  // 4. REAL MECHANICAL ELEVATORS (`mech_elevator.glb` + Full-Height Bolted I-Beam Shafts!)
  const elevatorPods = [];
  const cableMat = new THREE.MeshStandardMaterial({ color: '#dbe4f0', metalness: 0.9, roughness: 0.18 });
  const shaftSteelParts = [];
  const shaftBrassParts = [];
  let cabLightAssigned = false;

  const buildProceduralElevatorCab = () => {
    const cab = new THREE.Group();
    const steelParts = [];
    const brassParts = [];

    const chassis = new RoundedBoxGeometry(1.16, 0.17, 0.92, 1, 0.022);
    chassis.translate(0, -0.085, 0);
    steelParts.push(chassis);

    const trimRim = new RoundedBoxGeometry(1.2, 0.045, 0.96, 1, 0.012);
    trimRim.translate(0, -0.025, 0);
    brassParts.push(trimRim);

    // Waist-high brass rails + rear yoke columns + guide shoes
    for (const sx of [-1, 1]) {
      const px = sx * 0.54;
      const fPost = new THREE.CylinderGeometry(0.028, 0.028, 0.57, 8);
      fPost.translate(px, 0.285, 0.4);
      const sRail = new THREE.CylinderGeometry(0.024, 0.024, 0.76, 8);
      sRail.rotateX(Math.PI * 0.5);
      sRail.translate(px, 0.53, 0.02);
      brassParts.push(fPost, sRail);

      const rPost = new THREE.CylinderGeometry(0.034, 0.034, 1.68, 8);
      rPost.translate(px, 0.76, -0.36);
      const shoe = new RoundedBoxGeometry(0.14, 0.56, 0.15, 1, 0.012);
      shoe.translate(sx * 0.52, 0.14, -0.43);
      steelParts.push(rPost, shoe);
    }
    const backRail = new THREE.CylinderGeometry(0.024, 0.024, 1.08, 8);
    backRail.rotateZ(Math.PI * 0.5);
    backRail.translate(0, 0.53, -0.36);
    const yokeTop = new RoundedBoxGeometry(1.12, 0.09, 0.18, 1, 0.016);
    yokeTop.translate(0, 1.66, -0.18);
    brassParts.push(backRail, yokeTop);

    const steelMesh = new THREE.Mesh(mergeGeometries(steelParts), darkMetalMat);
    steelMesh.castShadow = true;
    const brassMesh = new THREE.Mesh(mergeGeometries(brassParts), trimMetalMat);
    brassMesh.castShadow = true;

    const glassMat = new THREE.MeshStandardMaterial({
      color: '#a5f3fc',
      roughness: 0.06,
      metalness: 0.1,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const glassParts = [];
    for (const sx of [-0.54, 0.54]) {
      const gp = new THREE.BoxGeometry(0.018, 0.42, 0.68);
      gp.translate(sx, 0.27, 0.02);
      glassParts.push(gp);
    }
    const backGp = new THREE.BoxGeometry(0.98, 0.42, 0.018);
    backGp.translate(0, 0.27, -0.36);
    glassParts.push(backGp);
    const glassMesh = new THREE.Mesh(mergeGeometries(glassParts), glassMat);

    const deckGlowMat = new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: spec.conduitGlow,
      emissiveIntensity: 1.35,
      roughness: 0.16,
    });
    const deckGlow = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.014, 0.7), deckGlowMat);
    deckGlow.position.set(0, 0.002, 0.02);

    const gate = new THREE.Group();
    gate.position.set(-0.52, 0.49, 0.4);
    const gateBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.02, 8), trimMetalMat);
    gateBar.rotation.z = Math.PI * 0.5;
    gateBar.position.x = 0.51;
    gate.add(gateBar);

    const upMat = new THREE.MeshStandardMaterial({ color: '#5efce8', emissive: '#10b981', emissiveIntensity: 1.5 });
    const dnMat = new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#f59e0b', emissiveIntensity: 1.5 });
    const chevUp = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 4), upMat);
    chevUp.position.set(0.54, 1.13, -0.24);
    const chevDn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 4), dnMat);
    chevDn.rotation.x = Math.PI;
    chevDn.position.set(0.54, 0.97, -0.24);

    cab.add(steelMesh, brassMesh, glassMesh, deckGlow, gate, chevUp, chevDn);
    return { cab, gate, chevUp, chevDn, upMat, dnMat, deckGlowMat };
  };

  for (const el of tower?.elevators || []) {
    const phi = (el.col + 0.5) * COL_ANGLE;
    const minFl = Number(el.minFloor) || 0;
    const maxFl = Number(el.maxFloor) || 4;
    const botShaftY = minFl * fh - 0.28;
    const topWinchY = (maxFl + 1.52) * fh;
    const shaftH = Math.max(1.2, topWinchY - botShaftY);
    const midShaftY = (topWinchY + botShaftY) * 0.5;

    _e.set(0, phi, 0);
    _q.setFromEuler(_e);
    _pos.set(liftR * Math.sin(phi), 0, liftR * Math.cos(phi));
    _scl.set(1, 1, 1);
    _m4.compose(_pos, _q, _scl);

    // 4a. Twin Continuous Full-Height Steel/Brass I-Beam Guide Rails (`x = ±0.52, z = -0.43`)
    for (const sx of [-1, 1]) {
      const rx = sx * 0.52;
      const rz = -0.43;
      const frontFlange = new THREE.BoxGeometry(0.082, shaftH, 0.022);
      frontFlange.translate(rx, midShaftY, rz + 0.042);
      frontFlange.applyMatrix4(_m4);
      shaftBrassParts.push(frontFlange);

      const web = new THREE.BoxGeometry(0.024, shaftH, 0.085);
      web.translate(rx, midShaftY, rz);
      web.applyMatrix4(_m4);
      const backFlange = new THREE.BoxGeometry(0.095, shaftH, 0.024);
      backFlange.translate(rx, midShaftY, rz - 0.042);
      backFlange.applyMatrix4(_m4);
      shaftSteelParts.push(web, backFlange);
    }

    // Center recessed counterweight guide track (`x = 0, z = -0.47`)
    const cwtTrack = new THREE.BoxGeometry(0.055, shaftH, 0.032);
    cwtTrack.translate(0, midShaftY, -0.47);
    cwtTrack.applyMatrix4(_m4);
    shaftSteelParts.push(cwtTrack);

    // Horizontal Cross-Ties & Wall Anchor Clamps every 0.75u (2 per floor!)
    for (let ty = botShaftY + 0.25; ty <= topWinchY - 0.2; ty += 0.75) {
      const tie = new THREE.BoxGeometry(1.14, 0.055, 0.048);
      tie.translate(0, ty, -0.45);
      tie.applyMatrix4(_m4);
      shaftSteelParts.push(tie);

      for (const sx of [-0.52, 0.52]) {
        const wallBolt = new THREE.BoxGeometry(0.12, 0.08, 0.16);
        wallBolt.translate(sx, ty, -0.5);
        wallBolt.applyMatrix4(_m4);
        shaftBrassParts.push(wallBolt);
      }
    }

    // Bottom Hydraulic Buffer Plinth & Spring Bumpers
    const pitBase = new RoundedBoxGeometry(1.24, 0.18, 0.88, 1, 0.02);
    pitBase.translate(0, botShaftY + 0.06, -0.06);
    pitBase.applyMatrix4(_m4);
    shaftSteelParts.push(pitBase);
    for (const sx of [-0.32, 0.32]) {
      const bufCyl = new THREE.CylinderGeometry(0.055, 0.068, 0.22, 8);
      bufCyl.translate(sx, botShaftY + 0.22, -0.06);
      bufCyl.applyMatrix4(_m4);
      shaftBrassParts.push(bufCyl);
    }

    // Chiseled Stone Reveal Pilasters framing the elevator shaft niche
    for (let py = botShaftY + 0.45; py < topWinchY - 0.2; py += 0.72) {
      const taperOff = -0.085 * Math.min(1, py / Math.max(14, totalH));
      for (const sxSign of [-1, 1]) {
        const pAng = phi + sxSign * COL_ANGLE * 0.56;
        pushInstance(
          ashlarInstances,
          Math.sin(pAng) * (R + 0.04 + taperOff),
          py,
          Math.cos(pAng) * (R + 0.04 + taperOff),
          0,
          pAng,
          0,
          0.18,
          0.66,
          0.28
        );
      }
    }

    // 4b. Overhead Pulley / Winch Motor Housing + Twin Spinning Sheave Wheels!
    const winchGroup = new THREE.Group();
    winchGroup.position.set(liftR * Math.sin(phi), topWinchY, liftR * Math.cos(phi));
    winchGroup.rotation.y = phi;

    const sheaveWheels = [];
    const glbWinchSrc = liftGlb ? findNamedObject(liftGlb, 'winch_housing') : null;
    const glbSheaveSrc = liftGlb ? findNamedObject(liftGlb, 'sheave_wheel') : null;

    if (glbWinchSrc && glbSheaveSrc) {
      const whClone = glbWinchSrc.clone(true);
      markSharedSubtree(whClone);
      whClone.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      winchGroup.add(whClone);

      for (const sx of [-0.24, 0.24]) {
        const shClone = glbSheaveSrc.clone(true);
        markSharedSubtree(shClone);
        shClone.position.set(sx, 0.14, -0.1);
        winchGroup.add(shClone);
        sheaveWheels.push(shClone);
      }
    } else {
      const hood = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.28, 0.98, 1, 0.025), darkMetalMat);
      hood.position.set(0, 0.22, -0.18);
      hood.castShadow = true;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.88, 12), trimMetalMat);
      drum.rotation.z = Math.PI * 0.5;
      drum.position.set(0, 0.26, -0.26);
      winchGroup.add(hood, drum);

      for (const sx of [-0.24, 0.24]) {
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16), trimMetalMat);
        sh.rotation.z = Math.PI * 0.5;
        sh.position.set(sx, 0.14, -0.1);
        winchGroup.add(sh);
        sheaveWheels.push(sh);
      }
    }
    group.add(winchGroup);

    // 4c. Taut Vertical Cab Hoist Cables + Moving Opposition Counterweight + Return Cable!
    const cablesMesh = new THREE.Mesh(G.twinHoistCables, cableMat);
    cablesMesh.rotation.y = phi;
    group.add(cablesMesh);

    const cwtCableMesh = new THREE.Mesh(G.singleReturnCable, cableMat);
    cwtCableMesh.rotation.y = phi;
    group.add(cwtCableMesh);

    const cwtNode = new THREE.Group();
    const glbCwtSrc = liftGlb ? findNamedObject(liftGlb, 'counterweight') : null;
    if (glbCwtSrc) {
      const cClone = glbCwtSrc.clone(true);
      markSharedSubtree(cClone);
      cwtNode.add(cClone);
    } else {
      const cBlock = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.68, 0.14, 1, 0.015), darkMetalMat);
      const cCap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.1, 0.16), trimMetalMat);
      cCap.position.y = 0.28;
      cwtNode.add(cBlock, cCap);
    }
    cwtNode.rotation.y = phi;
    group.add(cwtNode);

    // 4d. Sleek Mechanical Elevator Cab (`pod`)
    const pod = new THREE.Group();
    let safetyGate = null;
    let chevUp = null;
    let chevDn = null;
    let upMat = null;
    let dnMat = null;
    let deckGlowMat = null;

    const glbCabSrc = liftGlb ? findNamedObject(liftGlb, 'elevator_cab') : null;
    if (glbCabSrc) {
      const cabClone = glbCabSrc.clone(true);
      markSharedSubtree(cabClone);
      cabClone.traverse((o) => {
        if (!o.isMesh) return;
        const mName = o.material?.name || '';
        const isGlass = mName.includes('glass');
        o.castShadow = !isGlass;
        o.receiveShadow = !isGlass;
        // Clone small indicator materials per-cab so each elevator shows its own live direction/power state!
        if (mName === 'mat_chevron_up') {
          upMat = o.material.clone();
          o.material = upMat;
        } else if (mName === 'mat_chevron_down') {
          dnMat = o.material.clone();
          o.material = dnMat;
        } else if (mName === 'mat_lift_deck_glow') {
          deckGlowMat = o.material.clone();
          o.material = deckGlowMat;
        }
      });
      safetyGate = findNamedObject(cabClone, 'safety_gate');
      chevUp = findNamedObject(cabClone, 'chevron_up');
      chevDn = findNamedObject(cabClone, 'chevron_down');
      pod.add(cabClone);
    } else {
      const proc = buildProceduralElevatorCab();
      safetyGate = proc.gate;
      chevUp = proc.chevUp;
      chevDn = proc.chevDn;
      upMat = proc.upMat;
      dnMat = proc.dnMat;
      deckGlowMat = proc.deckGlowMat;
      pod.add(proc.cab);
    }

    if (!cabLightAssigned) {
      cabLightAssigned = true;
      const cabLight = new THREE.PointLight(spec.conduitGlow, 1.55, 6.2);
      cabLight.position.set(0, 0.85, 0.18);
      pod.add(cabLight);
    }

    const startY = (el.startFloor ?? minFl) * fh;
    const minWorldY = minFl * fh;
    const maxWorldY = maxFl * fh;
    let lastPodY = null;

    const syncMechanicalRig = () => {
      if (pod.position.y === lastPodY) return;
      lastPodY = pod.position.y;

      // 1. Cab Hoist Cables from yoke top (`podY + 1.72`) up to Winch Sheave (`topWinchY + 0.14`)
      const attachY = pod.position.y + 1.72;
      const topAttachY = topWinchY + 0.14;
      const cabLen = Math.max(0.1, topAttachY - attachY);
      cablesMesh.position.set(liftR * Math.sin(phi), (topAttachY + attachY) * 0.5, liftR * Math.cos(phi));
      cablesMesh.scale.set(1, cabLen, 1);

      // 2. Opposition Counterweight (`cwtY` moves downward as cab rises!)
      const travelFrac = maxWorldY > minWorldY ? (pod.position.y - minWorldY) / (maxWorldY - minWorldY) : 0;
      const cwtMinY = minWorldY + 0.45;
      const cwtMaxY = Math.max(cwtMinY + 0.4, topWinchY - 0.85);
      const cwtY = cwtMaxY - Math.max(0, Math.min(1, travelFrac)) * (cwtMaxY - cwtMinY);
      const cwtR = liftR - 0.39;
      cwtNode.position.set(cwtR * Math.sin(phi), cwtY, cwtR * Math.cos(phi));

      const cwtTop = cwtY + 0.36;
      const cwtLen = Math.max(0.1, topAttachY - cwtTop);
      cwtCableMesh.position.set(cwtR * Math.sin(phi), (topAttachY + cwtTop) * 0.5, cwtR * Math.cos(phi));
      cwtCableMesh.scale.set(1, cwtLen, 1);

      // 3. Spin Overhead Sheave Wheels proportionally to cable travel!
      const wheelRot = pod.position.y * 4.35;
      for (let s = 0; s < sheaveWheels.length; s++) {
        sheaveWheels[s].rotation.x = wheelRot;
      }
    };

    pod.position.set(liftR * Math.sin(phi), startY, liftR * Math.cos(phi));
    pod.rotation.y = phi;
    pod.userData = {
      col: el.col,
      podOffsetY: 0,
      minFloor: minFl,
      maxFloor: maxFl,
      pipeGroup: el.pipeGroup || null,
      update: syncMechanicalRig,
      cablesMesh,
      cwtCableMesh,
      cwtNode,
      winchGroup,
      sheaveWheels,
      safetyGate,
      chevUp,
      chevDn,
      upMat,
      dnMat,
      deckGlowMat,
      gateAngle: 1.15,
      phi,
      minY: botShaftY,
      maxY: topWinchY,
      usedGlb: Boolean(glbCabSrc),
    };
    syncMechanicalRig();
    group.add(pod);
    elevatorPods.push(pod);
  }

  buildBandedInstancedFromList(group, bandedMeshes, G.ashlarBlock, ashlarMat, ashlarInstances, PROP_SPAN_Y);

  if (shaftSteelParts.length) {
    const shaftSteelMesh = new THREE.Mesh(mergeGeometries(shaftSteelParts), darkMetalMat);
    shaftSteelMesh.castShadow = true;
    shaftSteelMesh.receiveShadow = true;
    shaftSteelMesh.userData.keepInReflection = true;
    group.add(shaftSteelMesh);
  }
  if (shaftBrassParts.length) {
    const shaftBrassMesh = new THREE.Mesh(mergeGeometries(shaftBrassParts), trimMetalMat);
    shaftBrassMesh.castShadow = true;
    shaftBrassMesh.receiveShadow = true;
    group.add(shaftBrassMesh);
  }

  // 5. REAL 5-RISER STAIRCASES (`real_staircase.glb`) & ARCHITECTURAL TERRACE DECKS!
  const ledgeBodyMat = createBlockMaterial({
    color: pal.ledge || spec.ledgeBody,
    surface: spec.surface,
    tile: 0.6,
    roughness: Math.min(0.8, spec.roughness + 0.04),
    metalness: spec.metalness,
    normalScale: spec.normalScale,
    hi: spec.hi,
    angular: false,
    wetStrength: 0.85,
    wallAoTex,
    totalH,
  });
  const ledgeTopMat = createBlockMaterial({
    color: pal.ledgeTop || spec.ledgeTop,
    surface: spec.surface,
    tile: 0.6,
    roughness: Math.max(0.3, spec.roughness - 0.12),
    metalness: spec.metalness,
    normalScale: spec.normalScale * 0.92,
    hi: spec.hi,
    angular: false,
    wetStrength: 0.85,
    wallAoTex,
    totalH,
  });
  stoneMats.push(ledgeBodyMat, ledgeTopMat);

  const iceMat = new THREE.MeshStandardMaterial({
    color: '#93d5fd',
    map: T.frost,
    emissive: '#0284c7',
    emissiveIntensity: 0.24,
    roughness: 0.08,
    metalness: 0.16,
    transparent: true,
    opacity: 0.88,
  });
  const iceTopMat = new THREE.MeshStandardMaterial({ color: '#f0f9ff', map: T.frost, roughness: 0.08 });
  const slideMatR = new THREE.MeshStandardMaterial({
    map: T.slideR,
    emissive: '#38bdf8',
    emissiveIntensity: 0.22,
    roughness: 0.08,
    metalness: 0.2,
  });
  const slideMatL = new THREE.MeshStandardMaterial({
    map: T.slideL,
    emissive: '#38bdf8',
    emissiveIntensity: 0.22,
    roughness: 0.08,
    metalness: 0.2,
  });
  const convMatR = new THREE.MeshStandardMaterial({ map: T.convR, roughness: 0.36, metalness: 0.35 });
  const convMatL = new THREE.MeshStandardMaterial({ map: T.convL, roughness: 0.36, metalness: 0.35 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: T.hazard, roughness: 0.44 });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: spec.ledgeTop,
    emissive: spec.conduitGlow,
    emissiveIntensity: 0.12,
    roughness: 0.28,
    metalness: 0.62,
  });
  const sharedBoxMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    emissive: '#0891b2',
    emissiveMap: T.runeBox,
    emissiveIntensity: 0.88,
    roughness: 0.28,
    metalness: 0.68,
  });
  const sharedBoxCoreMat = new THREE.MeshBasicMaterial({ color: '#67e8f9' });
  const sharedCrumbleIdleMat = new THREE.MeshStandardMaterial({
    color: spec.ledgeBody,
    emissive: '#f59e0b',
    emissiveMap: T.cracks,
    emissiveIntensity: 0.58,
    roughness: 0.68,
    metalness: 0.1,
  });
  const sharedCrumbleActiveMat = new THREE.MeshStandardMaterial({
    color: spec.ledgeBody,
    emissive: '#ef4444',
    emissiveMap: T.cracks,
    emissiveIntensity: 1.45,
    roughness: 0.68,
    metalness: 0.1,
  });

  // Extract `.glb` geometries when available, falling back seamlessly to our matching procedural twins
  const flightRStoneGeo = findNamedMeshGeo(stairGlb, 'stair_flight_R_stone') || G.procFlightRStone;
  const flightRMetalGeo = findNamedMeshGeo(stairGlb, 'stair_flight_R_metal') || G.procFlightRMetal;
  const flightLStoneGeo = findNamedMeshGeo(stairGlb, 'stair_flight_L_stone') || G.procFlightLStone;
  const flightLMetalGeo = findNamedMeshGeo(stairGlb, 'stair_flight_L_metal') || G.procFlightLMetal;
  const terraceStoneGeo = findNamedMeshGeo(stairGlb, 'terrace_deck_stone') || G.procTerraceStone;
  const terraceMetalGeo = findNamedMeshGeo(stairGlb, 'terrace_deck_metal') || G.procTerraceMetal;

  const terraceStoneBatch = [];
  const terraceMetalBatch = [];
  const flightRStoneBatch = [];
  const flightRMetalBatch = [];
  const flightLStoneBatch = [];
  const flightLMetalBatch = [];
  const endGuardBatch = [];

  const ledgeMossBatch = bodyInfo.mossList ? bodyInfo.mossList.slice() : [];
  const ledgeCoralBatch = bodyInfo.coralList ? bodyInfo.coralList.slice() : [];
  const iceSlabBatch = [];
  const iceCapBatch = [];
  const slideRCapBatch = [];
  const slideLCapBatch = [];
  const pillarShaftBatch = [];
  const pillarCollarBatch = [];
  const boxCrateBatch = [];
  const boxCoreBatch = [];
  const convBaseBatch = [];
  const convHazBatch = [];
  const convRollerBatch = [];
  const steamDeckBatch = [];
  const steamCapBatch = [];
  const steamNozzleBatch = [];
  const laserEmitterBatch = [];

  const conveyorRollers = [];
  const ledgeMeshes = [];
  const ledgeWidth = ledgeR * COL_ANGLE;

  // Map solid/stair walkable cells and blocking pillars/boxes to solve continuous 5-riser stair flights!
  const solidWalkableSet = new Set();
  const blockerSet = new Set();
  for (const l of tower?.ledges || []) {
    const wc = wrapTowerCol(l.col);
    const fl = Math.round(Number(l.floor) || 0);
    if (l.type === 'box' || l.type === 'pillar') {
      const topH = Math.max(1, Math.round(Number(l.h) || 1));
      for (let k = 0; k < topH; k++) blockerSet.add(`${wc}_${fl + k}`);
    } else if (l.type === 'solid' || l.type === 'stair' || l.type === 'stairR' || l.type === 'stairL') {
      solidWalkableSet.add(`${wc}_${fl}`);
    }
  }

  const hasAscendingFlightR = (col, floor) => {
    const wc = wrapTowerCol(col);
    const rc = wrapTowerCol(wc + 1);
    if (blockerSet.has(`${wc}_${floor + 1}`)) return false;
    return solidWalkableSet.has(`${rc}_${floor + 1}`);
  };

  const hasAscendingFlightL = (col, floor) => {
    const wc = wrapTowerCol(col);
    const lc = wrapTowerCol(wc - 1);
    if (blockerSet.has(`${wc}_${floor + 1}`)) return false;
    return solidWalkableSet.has(`${lc}_${floor + 1}`);
  };

  const makeStaticProxy = (phi, y, type, batchRefs) => {
    const proxy = new THREE.Object3D();
    proxy.position.set(ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi));
    proxy.rotation.y = phi;
    proxy.userData = {
      baseR: ledgeR,
      baseY: y,
      phi,
      type,
      isStaticInstanced: true,
      batchRefs,
      lastGone: false,
    };
    return proxy;
  };

  for (let idx = 0; idx < (tower?.ledges || []).length; idx++) {
    const l = tower.ledges[idx];
    const wc = wrapTowerCol(l.col);
    const fl = Math.round(Number(l.floor) || 0);
    const phi = (l.col + 0.5) * COL_ANGLE;
    const isBox = l.type === 'box';
    const isPillar = l.type === 'pillar';

    let y = l.floor * fh;
    let blockH = 0.78;
    if (isPillar) {
      blockH = Math.max(1, l.h || 1) * fh;
      y = l.floor * fh + blockH * 0.5;
    } else if (isBox) {
      blockH = l.h ? Math.max(1, l.h) * fh * 0.94 : 0.78;
      y = l.h ? l.floor * fh + blockH * 0.5 + 0.01 : l.floor * fh + 0.39;
    }

    const isSolidOrStair =
      l.type === 'solid' || l.type === 'stair' || l.type === 'stairR' || l.type === 'stairL';

    if (isSolidOrStair) {
      const batchRefs = [];
      const lc = wrapTowerCol(wc - 1);
      const rc = wrapTowerCol(wc + 1);

      // Check ascending flights originating from this cell + incoming flights from fl - 1
      const goUpR =
        l.type === 'stairR' ||
        (l.stairDir === 1 && !solidWalkableSet.has(`${rc}_${fl}`)) ||
        hasAscendingFlightR(wc, fl);
      const goUpL =
        l.type === 'stairL' ||
        (l.stairDir === -1 && !solidWalkableSet.has(`${lc}_${fl}`)) ||
        hasAscendingFlightL(wc, fl);

      const fromDownL = solidWalkableSet.has(`${lc}_${fl - 1}`) && hasAscendingFlightR(lc, fl - 1);
      const fromDownR = solidWalkableSet.has(`${rc}_${fl - 1}`) && hasAscendingFlightL(rc, fl - 1);

      const stairOnLeft = goUpL || fromDownL;
      const stairOnRight = goUpR || fromDownR;

      // Emit 5-Riser Engineered Staircase Flights (`real_staircase.glb`)!
      if (goUpR) {
        const sIdx = pushInstance(flightRStoneBatch, ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi), 0, phi, 0, 1, 1, 1);
        const mIdx = pushInstance(flightRMetalBatch, ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi), 0, phi, 0, 1, 1, 1);
        batchRefs.push(flightRStoneBatch[sIdx], flightRMetalBatch[mIdx]);
      }
      if (goUpL) {
        const sIdx = pushInstance(flightLStoneBatch, ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi), 0, phi, 0, 1, 1, 1);
        const mIdx = pushInstance(flightLMetalBatch, ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi), 0, phi, 0, 1, 1, 1);
        batchRefs.push(flightLStoneBatch[sIdx], flightLMetalBatch[mIdx]);
      }

      // Compute exact non-overlapping Terrace Landing Deck width & angular shift so stairs & landings lock 1:1!
      let deckScaleX = 1.03;
      let deckPhi = phi;
      if (stairOnLeft && stairOnRight) {
        // Mid-staircase connecting landing between incoming & outgoing 5-riser flights
        deckScaleX = 0.28;
      } else if (stairOnRight && !stairOnLeft) {
        deckScaleX = 0.64;
        deckPhi = phi - 0.175 * COL_ANGLE;
      } else if (stairOnLeft && !stairOnRight) {
        deckScaleX = 0.64;
        deckPhi = phi + 0.175 * COL_ANGLE;
      }

      const tsIdx = pushInstance(
        terraceStoneBatch,
        ledgeR * Math.sin(deckPhi),
        y,
        ledgeR * Math.cos(deckPhi),
        0,
        deckPhi,
        0,
        deckScaleX,
        1,
        1
      );
      const tmIdx = pushInstance(
        terraceMetalBatch,
        ledgeR * Math.sin(deckPhi),
        y,
        ledgeR * Math.cos(deckPhi),
        0,
        deckPhi,
        0,
        deckScaleX,
        1,
        1
      );
      batchRefs.push(terraceStoneBatch[tsIdx], terraceMetalBatch[tmIdx]);

      // Add subtle low end-cap guard rail on multi-col terrace cliff ends (where flat neighbor is part of a terrace >= 2 cols)
      const hasFlatL = walkableSet.has(`${lc}_${fl}`);
      const hasFlatR = walkableSet.has(`${rc}_${fl}`);
      if (!stairOnLeft && !hasFlatL && hasFlatR) {
        const gPhi = phi - 0.46 * COL_ANGLE;
        const gIdx = pushInstance(endGuardBatch, ledgeR * Math.sin(gPhi), y, ledgeR * Math.cos(gPhi), 0, gPhi, 0, 1, 0.55, 1);
        batchRefs.push(endGuardBatch[gIdx]);
      }
      if (!stairOnRight && !hasFlatR && hasFlatL) {
        const gPhi = phi + 0.46 * COL_ANGLE;
        const gIdx = pushInstance(endGuardBatch, ledgeR * Math.sin(gPhi), y, ledgeR * Math.cos(gPhi), 0, gPhi, 0, 1, 0.55, 1);
        batchRefs.push(endGuardBatch[gIdx]);
      }

      // Biome organic moss / coral embellishments on terrace rims
      if (spec.hasMoss && (wc + fl) % 2 === 0) {
        const mx = (ledgeR + 0.34) * Math.sin(deckPhi);
        const mz = (ledgeR + 0.34) * Math.cos(deckPhi);
        pushInstance(ledgeMossBatch, mx, y - 0.01, mz, 0.12, deckPhi, 0, 0.9, 0.65, 0.9, '#2e5926');
      } else if (spec.hasCoral && fl <= 3 && (wc + fl) % 2 === 1) {
        const cx = (ledgeR + 0.32) * Math.sin(deckPhi);
        const cz = (ledgeR + 0.32) * Math.cos(deckPhi);
        pushInstance(ledgeCoralBatch, cx, y - 0.08, cz, 0.2, deckPhi, 0.3, 0.85, 0.85, 0.85, '#fb7185');
      }

      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, batchRefs));
      continue;
    }

    if (isPillar) {
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const colCapH = Math.min(0.11, blockH * 0.12);
      const s1 = pushInstance(pillarShaftBatch, lx, y, lz, 0, phi, 0, 1, blockH * 0.94, 1);
      const c1 = pushInstance(pillarCollarBatch, lx, y + blockH * 0.5 - colCapH * 0.5, lz, 0, phi, 0, 1, colCapH / 0.11, 1);
      const c2 = pushInstance(pillarCollarBatch, lx, y - blockH * 0.5 + colCapH * 0.5, lz, 0, phi, 0, 1, colCapH / 0.11, 1);
      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, [pillarShaftBatch[s1], pillarCollarBatch[c1], pillarCollarBatch[c2]]));
      continue;
    }

    if (l.type === 'ice' || l.type === 'slideR' || l.type === 'slideL') {
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const b1 = pushInstance(iceSlabBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const targetCapBatch = l.type === 'slideR' ? slideRCapBatch : l.type === 'slideL' ? slideLCapBatch : iceCapBatch;
      const b2 = pushInstance(targetCapBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, [iceSlabBatch[b1], targetCapBatch[b2]]));
      continue;
    }

    if (isBox) {
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const sy = blockH / 0.78;
      const b1 = pushInstance(boxCrateBatch, lx, y, lz, 0, phi, 0, 1, sy, 1);
      const b2 = pushInstance(boxCoreBatch, lx, y, lz, 0, phi, 0, 1, sy, 1);
      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, [boxCrateBatch[b1], boxCoreBatch[b2]]));
      continue;
    }

    // Dynamic Specialty Ledges (`crumble`, `conveyor*`, `laserGate`, `phaseBlock`, `piston`, `steamVent`)
    const node = new THREE.Group();
    node.position.set(ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi));
    node.rotation.y = phi;

    if (l.type === 'crumble') {
      const pieceMesh = new THREE.Mesh(G.crumbleTriple, sharedCrumbleIdleMat);
      pieceMesh.castShadow = true;
      pieceMesh.receiveShadow = true;
      node.add(pieceMesh);
      node.userData = {
        baseR: ledgeR,
        baseY: y,
        phi,
        type: l.type,
        pieceMesh,
        idleMat: sharedCrumbleIdleMat,
        activeMat: sharedCrumbleActiveMat,
      };
    } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
      const dir = l.type === 'conveyorR' ? 1 : -1;
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const c1 = pushInstance(convBaseBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const c2 = pushInstance(convHazBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const c3 = pushInstance(convRollerBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const tread = new THREE.Mesh(G.convTread, dir > 0 ? convMatR : convMatL);
      node.add(tread);
      node.userData = {
        baseR: ledgeR,
        baseY: y,
        phi,
        type: l.type,
        treadMesh: tread,
        convMatR,
        convMatL,
        batchRefs: [convBaseBatch[c1], convHazBatch[c2], convRollerBatch[c3]],
        lastGone: false,
      };
    } else if (l.type === 'laserGate') {
      const isRed = l.switchGroup !== 'cyan';
      const beamColor = isRed ? '#fb7185' : '#38bdf8';
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const e1 = pushInstance(laserEmitterBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.058, 0.058, ledgeWidth * 0.9, 6),
        new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.9 })
      );
      beam.rotation.z = Math.PI * 0.5;
      beam.position.y = 0.24;
      node.add(beam);
      node.userData = {
        baseR: ledgeR,
        baseY: y,
        phi,
        type: l.type,
        beam,
        batchRefs: [laserEmitterBatch[e1]],
        lastGone: false,
      };
    } else if (l.type === 'phaseBlock') {
      const isRed = l.switchGroup === 'red';
      const holoMat = new THREE.MeshStandardMaterial({
        color: isRed ? '#f43f5e' : '#38bdf8',
        emissive: isRed ? '#e11d48' : '#0284c7',
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.82,
        roughness: 0.14,
      });
      const slab = new THREE.Mesh(G.iceSlab, holoMat);
      node.add(slab);
      node.userData = { baseR: ledgeR, baseY: y, phi, type: l.type, slab };
    } else if (l.type === 'piston') {
      const rams = new THREE.Mesh(G.pistonRams, cableMat);
      const deck = new THREE.Mesh(terraceStoneGeo, ledgeTopMat);
      const trim = new THREE.Mesh(terraceMetalGeo, trimMetalMat);
      node.add(rams, deck, trim);
      node.userData = { baseR: ledgeR, baseY: y, phi, type: l.type };
    } else if (l.type === 'steamVent' || l.type === 'geyser') {
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const s1 = pushInstance(steamDeckBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const s2 = pushInstance(steamCapBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const s3 = pushInstance(steamNozzleBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const warnRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.025, 6, 16),
        new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.25 })
      );
      warnRing.rotation.x = Math.PI * 0.5;
      warnRing.position.y = 0.18;
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 2.35, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#bae6fd',
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      plume.rotation.x = Math.PI;
      plume.position.y = 1.28;
      plume.visible = false;
      node.add(warnRing, plume);
      node.userData = {
        baseR: ledgeR,
        baseY: y,
        phi,
        type: l.type,
        plume,
        warnRing,
        batchRefs: [steamDeckBatch[s1], steamCapBatch[s2], steamNozzleBatch[s3]],
        lastGone: false,
      };
    }

    group.add(node);
    ledgeMeshes.push(node);
  }

  // Basal Waterline Pier Staircase descending into the river/lake/sea near spawn!
  {
    const spawnCol = wrapTowerCol(tower?.spawn?.col ?? 0);
    const pierCol = wrapTowerCol(spawnCol - 1);
    const pierPhi = (pierCol + 0.5) * COL_ANGLE;
    if (!walkableSet.has(`${pierCol}_0`)) {
      pushInstance(flightRStoneBatch, ledgeR * Math.sin(pierPhi), -fh, ledgeR * Math.cos(pierPhi), 0, pierPhi, 0, 1, 1, 1);
      pushInstance(flightRMetalBatch, ledgeR * Math.sin(pierPhi), -fh, ledgeR * Math.cos(pierPhi), 0, pierPhi, 0, 1, 1, 1);
    }
  }

  // Materialize Real Staircase & Terrace InstancedMeshes (with `castShadow: true` so 5 risers & handrails cast real shadows!)
  const instTerraceStone = buildBandedInstancedFromList(
    group,
    bandedMeshes,
    terraceStoneGeo,
    ledgeTopMat,
    terraceStoneBatch,
    PROP_SPAN_Y,
    { castShadow: true, keepInReflection: true }
  );
  const instTerraceMetal = buildBandedInstancedFromList(
    group,
    bandedMeshes,
    terraceMetalGeo,
    trimMetalMat,
    terraceMetalBatch,
    PROP_SPAN_Y,
    { castShadow: true, keepInReflection: false }
  );
  const instFlightRStone = buildBandedInstancedFromList(
    group,
    bandedMeshes,
    flightRStoneGeo,
    ledgeTopMat,
    flightRStoneBatch,
    PROP_SPAN_Y,
    { castShadow: true, keepInReflection: true }
  );
  const instFlightRMetal = buildBandedInstancedFromList(
    group,
    bandedMeshes,
    flightRMetalGeo,
    trimMetalMat,
    flightRMetalBatch,
    PROP_SPAN_Y,
    { castShadow: true, keepInReflection: false }
  );
  const instFlightLStone = buildBandedInstancedFromList(
    group,
    bandedMeshes,
    flightLStoneGeo,
    ledgeTopMat,
    flightLStoneBatch,
    PROP_SPAN_Y,
    { castShadow: true, keepInReflection: true }
  );
  const instFlightLMetal = buildBandedInstancedFromList(
    group,
    bandedMeshes,
    flightLMetalGeo,
    trimMetalMat,
    flightLMetalBatch,
    PROP_SPAN_Y,
    { castShadow: true, keepInReflection: false }
  );
  buildBandedInstancedFromList(group, bandedMeshes, G.endGuardRail, trimMetalMat, endGuardBatch, PROP_SPAN_Y, {
    castShadow: true,
  });

  buildBandedInstancedFromList(group, bandedMeshes, G.iceSlab, iceMat, iceSlabBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceCap, iceTopMat, iceCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceCap, slideMatR, slideRCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceCap, slideMatL, slideLCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.flutedPillar, pillarMat, pillarShaftBatch, PROP_SPAN_Y, {
    castShadow: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.pillarCollar, ledgeTopMat, pillarCollarBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.energyBox, sharedBoxMat, boxCrateBatch, PROP_SPAN_Y, {
    castShadow: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.energyCore, sharedBoxCoreMat, boxCoreBatch, PROP_SPAN_Y, {
    receiveShadow: false,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.convBase, darkMetalMat, convBaseBatch, PROP_SPAN_Y, {
    castShadow: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.convHazard, hazardMat, convHazBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.rollerTrio, cableMat, convRollerBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, terraceStoneGeo, ledgeBodyMat, steamDeckBatch, PROP_SPAN_Y, {
    castShadow: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, terraceMetalGeo, trimMetalMat, steamCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.steamNozzle, trimMetalMat, steamNozzleBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.laserEmitters, trimMetalMat, laserEmitterBatch, PROP_SPAN_Y);

  if (ledgeMossBatch.length) {
    const lmMat = attachWaterlineShader(
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0.02 }),
      0.7
    );
    stoneMats.push(lmMat);
    buildBandedInstancedFromList(group, bandedMeshes, G.mossCluster, lmMat, ledgeMossBatch, PROP_SPAN_Y);
  }
  if (ledgeCoralBatch.length) {
    const lcMat = attachWaterlineShader(
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.58, metalness: 0.06 }),
      0.65
    );
    stoneMats.push(lcMat);
    buildBandedInstancedFromList(group, bandedMeshes, G.coralCluster, lcMat, ledgeCoralBatch, PROP_SPAN_Y);
  }

  // 6. Gecko Wall-Scamper Crystal/Moss Strips (`tower.wallStrips`) & Tail-Swing Grapple Rings (`tower.grappleRings`)!
  const wallStripNodes = [];
  const rawStrips = tower?.wallStrips || tower?.geckoStrips || tower?.climbStrips || [];
  if (rawStrips.length > 0) {
    const stripPadMat = new THREE.MeshStandardMaterial({
      color: rbTheme === 'mist_bayou' || rbTheme === 'canyon_river' ? '#2dd4bf' : '#67e8f9',
      emissive: rbTheme === 'mist_bayou' ? '#10b981' : '#0891b2',
      emissiveIntensity: 0.58,
      roughness: 0.34,
      metalness: 0.18,
    });
    for (let i = 0; i < rawStrips.length; i++) {
      const ws = rawStrips[i];
      const sPhi = (ws.col + 0.5) * COL_ANGLE;
      const minY = (ws.minFloor ?? ws.floor ?? 0) * fh;
      const maxY = (ws.maxFloor ?? (ws.floor ?? 0) + (ws.h || 3)) * fh;
      const spanH = Math.max(0.8, maxY - minY);
      const midY = (minY + maxY) * 0.5;
      const sr = R + BRICK_PROUD + 0.045;

      const stripGrp = new THREE.Group();
      stripGrp.position.set(sr * Math.sin(sPhi), midY, sr * Math.cos(sPhi));
      stripGrp.rotation.y = sPhi;

      const railParts = [];
      for (const sx of [-0.34, 0.34]) {
        const rail = new THREE.BoxGeometry(0.052, spanH, 0.068);
        rail.translate(sx, 0, 0.02);
        railParts.push(rail);
      }
      const padParts = [];
      const rungCount = Math.max(3, Math.floor(spanH / 0.38));
      for (let r = 0; r < rungCount; r++) {
        const ry = -spanH * 0.5 + ((r + 0.5) / rungCount) * spanH;
        const chevL = new THREE.BoxGeometry(0.32, 0.085, 0.055);
        chevL.rotateZ(0.34);
        chevL.translate(-0.13, ry, 0.035);
        const chevR = new THREE.BoxGeometry(0.32, 0.085, 0.055);
        chevR.rotateZ(-0.34);
        chevR.translate(0.13, ry, 0.035);
        padParts.push(chevL, chevR);
      }

      const railsMesh = new THREE.Mesh(mergeGeometries(railParts), trimMetalMat);
      const padsMesh = new THREE.Mesh(mergeGeometries(padParts), stripPadMat);
      padsMesh.castShadow = true;
      stripGrp.add(railsMesh, padsMesh);
      group.add(stripGrp);
      wallStripNodes.push({ group: stripGrp, phi: sPhi, minY, maxY, padMat: stripPadMat });
    }
  }

  const grappleNodes = [];
  const rawGrapples = tower?.grappleRings || tower?.swingRings || [];
  for (let i = 0; i < rawGrapples.length; i++) {
    const gr = rawGrapples[i];
    const gPhi = (gr.col + 0.5) * COL_ANGLE;
    const gy = (gr.floor + 0.88) * fh;
    const grRad = R + 0.52;

    const gNode = new THREE.Group();
    gNode.position.set(grRad * Math.sin(gPhi), gy, grRad * Math.cos(gPhi));
    gNode.rotation.y = gPhi;

    // Cantilevered forged-bronze davit crane arm anchored back to spire masonry
    const armLen = grRad - R + 0.06;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.095, armLen), trimMetalMat);
    arm.position.set(0, 0.34, -armLen * 0.5);
    arm.castShadow = true;
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.065, armLen * 1.05), darkMetalMat);
    brace.rotation.x = 0.45;
    brace.position.set(0, 0.14, -armLen * 0.52);
    gNode.add(arm, brace);

    const ringPivot = new THREE.Group();
    ringPivot.position.set(0, 0.3, 0);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6), trimMetalMat);
    chain.position.y = -0.12;
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#06b6d4',
      emissiveIntensity: 1.15,
      metalness: 0.85,
      roughness: 0.16,
    });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.042, 8, 22), ringMat);
    torus.position.y = -0.34;
    torus.castShadow = true;
    const innerGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 0),
      new THREE.MeshBasicMaterial({ color: '#67e8f9' })
    );
    innerGem.position.y = -0.34;
    ringPivot.add(chain, torus, innerGem);
    gNode.add(ringPivot);

    group.add(gNode);
    grappleNodes.push({
      id: gr.id,
      col: gr.col,
      floor: gr.floor,
      group: gNode,
      ringPivot,
      ringMat,
      phi: gPhi,
      y: gy,
    });
  }

  // 7. Interactive Wall Pipe-Valves (`pipe_valve.glb`) & Hydro-Switches (`tower.switches`)
  const switchNodes = [];
  for (const sw of tower?.switches || []) {
    const sm = buildSwitchMesh(sw.mode || 'pipeValve', { pipe_valve: valveGlb });
    const sPhi = (sw.col + 0.5) * COL_ANGLE;
    const sr = ledgeR;
    sm.position.set(sr * Math.sin(sPhi), sw.floor * fh, sr * Math.cos(sPhi));
    sm.rotation.y = sPhi;
    group.add(sm);
    switchNodes.push(sm);
  }

  let workbenchProp = null;
  if (tower?.workbench) {
    workbenchProp = buildWorkbenchMesh();
    const wPhi = (tower.workbench.col + 0.5) * COL_ANGLE;
    workbenchProp.position.set(ledgeR * Math.sin(wPhi), tower.workbench.floor * fh, ledgeR * Math.cos(wPhi));
    workbenchProp.rotation.y = wPhi;
    group.add(workbenchProp);
  }

  let treasureChestProp = null;
  if (tower?.treasureChest) {
    treasureChestProp = buildTreasureChestMesh();
    const cPhi = (tower.treasureChest.col + 0.5) * COL_ANGLE;
    treasureChestProp.position.set(ledgeR * Math.sin(cPhi), tower.treasureChest.floor * fh, ledgeR * Math.cos(cPhi));
    treasureChestProp.rotation.y = cPhi;
    group.add(treasureChestProp);
  }

  // Seamless hot-swap listener if internal GLB loader completes after initial frame-0 tower build!
  const onGlbReady = (key, glbScene) => {
    if (key === 'real_staircase' && glbScene) {
      const swapGeo = (instArr, nodeName) => {
        const g = findNamedMeshGeo(glbScene, nodeName);
        if (!g) return;
        for (const inst of instArr) inst.geometry = g;
      };
      swapGeo(instTerraceStone, 'terrace_deck_stone');
      swapGeo(instTerraceMetal, 'terrace_deck_metal');
      swapGeo(instFlightRStone, 'stair_flight_R_stone');
      swapGeo(instFlightRMetal, 'stair_flight_R_metal');
      swapGeo(instFlightLStone, 'stair_flight_L_stone');
      swapGeo(instFlightLMetal, 'stair_flight_L_metal');
    } else if (key === 'hydro_turbine' && glbScene) {
      for (const tr of bodyInfo.turbineRotors) {
        if (!tr.isProcedural) continue;
        while (tr.holder.children.length > 1) {
          tr.holder.remove(tr.holder.children[0]);
        }
        const cloned = glbScene.clone(true);
        markSharedSubtree(cloned);
        cloned.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        tr.wheel = findNamedObject(cloned, 'turbine_wheel');
        tr.holder.add(cloned);
        tr.isProcedural = false;
      }
    }
  };
  INTERNAL_GLB_CACHE.listeners.add(onGlbReady);

  const _reflSavedVis = [];

  const cached = {
    group,
    tower,
    era: 'reboot',
    theme: rbTheme,
    fh,
    isRealOrig: false,
    totalH: bodyInfo.totalH,
    coreMat: bodyInfo.coreMat,
    conduitMat: bodyInfo.conduitMat,
    cylMat: stoneMats[0] || bodyInfo.coreMat,
    crownFlames: bodyInfo.crownFlames,
    turbineRotors: bodyInfo.turbineRotors,
    bandedMeshes,
    cullableNodes,
    sharedBoxMat,
    sharedBoxCoreMat,
    ledgeMeshes,
    elevatorPods,
    conveyorRollers,
    wallStripNodes,
    grappleNodes,
    mistSprites,
    sparkEmitters,
    sparkInstancers,
    forgeLights,
    portalMats,
    exitRings,
    runeDoors,
    clueUpdater,
    stoneMats,
    wallAoTex,
    ownedTextures,
    switchNodes,
    workbenchProp,
    treasureChestProp,
    hasEmbeddedProps: true,
    _onGlbReady: onGlbReady,
    _lastWaterY: -0.82,
    _inReflection: false,
    setReflectionPass(isRefl) {
      const on = Boolean(isRefl);
      if (cached._inReflection === on) return;
      cached._inReflection = on;
      const kids = group.children;
      if (on) {
        _reflSavedVis.length = kids.length;
        const maxReflY = cached._lastWaterY + 6.5;
        for (let i = 0; i < kids.length; i++) {
          const k = kids[i];
          const prev = k.visible;
          _reflSavedVis[i] = prev;
          if (!prev || !k.userData?.keepInReflection) {
            k.visible = false;
          } else if (k.userData.bandMinY !== undefined && k.userData.bandMinY > maxReflY) {
            k.visible = false;
          }
        }
      } else {
        const len = Math.min(kids.length, _reflSavedVis.length);
        for (let i = 0; i < len; i++) {
          kids[i].visible = _reflSavedVis[i];
        }
      }
    },
    _externalVfxActive: useExternalVfx,
    setExternalVfxActive(active) {
      cached._externalVfxActive = Boolean(active);
    },
    _lastTime: 0,
    dispose() {
      disposeTowerArchitecture(cached);
    },
  };

  return cached;
}

// ============================================================================
// 12. ZERO-ALLOCATION PER-FRAME ANIMATOR: `updateTowerArchitecture`
// ============================================================================

export function updateTowerArchitecture(cachedTower, state = {}, time = 0, dtArg = null) {
  if (!cachedTower || !cachedTower.group) return;

  const dt =
    typeof dtArg === 'number' && dtArg > 0
      ? Math.min(0.05, dtArg)
      : Math.min(0.05, Math.max(0.001, time - (cachedTower._lastTime || time) || 0.016));
  cachedTower._lastTime = time;

  const fh = cachedTower.fh || FLOOR_HEIGHT;
  const tower = state?.tower || cachedTower.tower || {};
  const hero = state?.gateway || state?.player || null;
  const T = getDetailTextures();
  const purify = Math.max(0, Math.min(1, Number(state?.purificationProgress) || 0));

  const fullTowerView = Boolean(
    state?.topple?.active ||
      state?.cutsceneCam?.active ||
      state?.titleShowcase ||
      state?.mode === 'title' ||
      purify > 0.01
  );
  const camFloor = state?.camFloor != null ? state.camFloor : hero?.floor != null ? hero.floor : 2;
  const camY = camFloor * fh + 1.5;
  const effCamAngle =
    cachedTower.group.rotation.y !== 0
      ? -cachedTower.group.rotation.y
      : state?.camCol != null
      ? state.camCol * COL_ANGLE
      : 0;

  // 0. Vertical Row-Band & Back-Wall Sector Frustum Culling (`VIS_ALT_WINDOW = 14.8u` for V3 scale!)
  const banded = cachedTower.bandedMeshes;
  if (banded) {
    const minVisY = camY - VIS_ALT_WINDOW;
    const maxVisY = camY + VIS_ALT_WINDOW;
    for (let i = 0; i < banded.length; i++) {
      const bm = banded[i];
      const ud = bm.userData;
      const altOk = ud.bandMaxY >= minVisY && ud.bandMinY <= maxVisY;
      const angOk = ud.sectorPhi === undefined || Math.cos(ud.sectorPhi - effCamAngle) >= -0.42;
      bm.visible = fullTowerView || (altOk && angOk);
    }
  }

  const cullNodes = cachedTower.cullableNodes;
  if (cullNodes) {
    for (let i = 0; i < cullNodes.length; i++) {
      const cn = cullNodes[i];
      cn.node.visible =
        fullTowerView ||
        (Math.cos(cn.phi - effCamAngle) >= -0.32 && Math.abs(cn.y - camY) <= VIS_ALT_WINDOW);
    }
  }

  // 1. Dynamic Waterline Wetness (`uWaterY`) & Hydro-Conduit Live Flowing Water
  const waterFloor =
    state?.waterFloor != null
      ? state.waterFloor
      : tower?.mechanics?.waterBaseFloor != null
      ? tower.mechanics.waterBaseFloor
      : -0.55;
  const waterY = waterFloor * fh + (cachedTower.group.position.y || 0);
  cachedTower._lastWaterY = waterY;

  const stoneMats = cachedTower.stoneMats;
  if (stoneMats) {
    const aoTex = cachedTower.wallAoTex || getDefaultWallAoTex();
    const totH = Math.max(3.0, cachedTower.totalH || 27.0);
    for (let i = 0; i < stoneMats.length; i++) {
      const u = stoneMats[i].userData;
      if (!u) continue;
      if (u.waterY) u.waterY.value = waterY;
      if (u.wallAoUniform) u.wallAoUniform.value = aoTex;
      if (u.totalHUniform) u.totalHUniform.value = totH;
    }
  }

  if (cachedTower.conduitMat) {
    const u = cachedTower.conduitMat.uniforms;
    u.uTime.value = time;
    u.uPurify.value = purify;
    // Check if any pipe valve is activated to boost conduit pressure
    let anyPipeActive = false;
    if (state?.pipeStates) {
      for (const k in state.pipeStates) {
        if (state.pipeStates[k]) {
          anyPipeActive = true;
          break;
        }
      }
    }
    u.uFlowDir.value = anyPipeActive ? 1.45 : -1.0;
  }

  // 2. Spin 3D Pelton Hydro-Turbines / Waterwheels!
  if (cachedTower.turbineRotors) {
    const speedBoost = 1 + purify * 2.2;
    for (let i = 0; i < cachedTower.turbineRotors.length; i++) {
      const tr = cachedTower.turbineRotors[i];
      const inView =
        fullTowerView ||
        (Math.cos(tr.phi - effCamAngle) >= -0.45 && Math.abs(tr.y - camY) <= VIS_ALT_WINDOW);
      tr.holder.visible = inView;
      if (!inView) continue;
      if (tr.wheel) {
        tr.wheel.rotation.z = time * tr.speed * speedBoost;
      }
      if (tr.sprayArc) {
        tr.sprayArc.material.opacity = 0.42 + 0.2 * Math.sin(time * 7.5 + i);
      }
    }
  }

  // 3. Scroll Sluice Conveyors & Siphon Containment Pod Glow
  T.convR.offset.x = -(time * 1.4) % 1;
  T.convL.offset.x = (time * 1.4) % 1;
  T.slideR.offset.x = -(time * 1.15) % 1;
  T.slideL.offset.x = (time * 1.15) % 1;

  if (cachedTower.sharedBoxMat) {
    cachedTower.sharedBoxMat.emissiveIntensity = 0.72 + 0.35 * Math.sin(time * 5.2);
  }

  // 4. Summit Reactor Beacon & Portal Shaders
  if (cachedTower.crownFlames) {
    const showCrown = fullTowerView || Math.abs(cachedTower.totalH + 1.5 - camY) <= VIS_ALT_WINDOW;
    for (let i = 0; i < cachedTower.crownFlames.length; i++) {
      const fl = cachedTower.crownFlames[i];
      fl.visible = showCrown;
      if (!showCrown) continue;
      const k = (time * 1.2 + i * 0.25) % 1;
      fl.position.y = cachedTower.totalH + 1.9 + k * 1.25;
      fl.scale.setScalar((1.35 - k * 0.75) * (1 + purify * 0.8));
      fl.material.opacity = Math.sin(k * Math.PI) * 0.82;
    }
  }
  if (cachedTower.portalMats) {
    for (let i = 0; i < cachedTower.portalMats.length; i++) {
      cachedTower.portalMats[i].uniforms.uTime.value = time;
    }
  }

  if (cachedTower.clueUpdater) {
    cachedTower.clueUpdater(time, state, tower);
  }

  // 5. Sanctum Rune Doors & Summit/Vault Rings
  if (cachedTower.runeDoors?.length > 0) {
    const liveDoors = state?.doors || tower?.doors || [];
    for (let r = 0; r < cachedTower.runeDoors.length; r++) {
      const rd = cachedTower.runeDoors[r];
      let solved = false;
      for (let dIdx = 0; dIdx < liveDoors.length; dIdx++) {
        const ld = liveDoors[dIdx];
        if ((rd.id && ld.id === rd.id) || (ld.col === rd.col && ld.floor === rd.floor)) {
          solved = Boolean(ld.solved);
          break;
        }
      }
      if (solved) {
        rd.ringMat.color.set('#334155');
        rd.ringMat.emissive.set('#0f766e');
        rd.ringMat.emissiveIntensity = 0.2;
        rd.gemMat.emissiveIntensity = 0.18;
        rd.sigilMat.opacity = 0.18;
      } else {
        rd.ringMat.color.set('#5efce8');
        rd.ringMat.emissive.set('#14b8a6');
        rd.ringMat.emissiveIntensity = 1.25 + 0.35 * Math.sin(time * 3.1);
        rd.gemMat.emissiveIntensity = 1.35 + 0.3 * Math.cos(time * 2.7);
        rd.sigilMat.opacity = 0.78 + 0.18 * Math.sin(time * 2.5);
        rd.sigilMesh.position.y = 0.04 + Math.sin(time * 2.1) * 0.03;
        rd.ringMesh.rotation.z = Math.sin(time * 0.9) * 0.14;
      }
    }
  }

  for (let i = 0; i < cachedTower.exitRings.length; i++) {
    const er = cachedTower.exitRings[i];
    if (er.isGroup) er.rotation.y = time * 1.4;
    else er.rotation.z = time * (i % 2 === 0 ? 1.8 : -2.4);
  }

  // 6. Gecko Wall-Scamper Strips & Tail-Swing Grapple Rings Animation
  if (cachedTower.wallStripNodes) {
    for (let i = 0; i < cachedTower.wallStripNodes.length; i++) {
      const ws = cachedTower.wallStripNodes[i];
      ws.group.visible =
        fullTowerView ||
        (Math.cos(ws.phi - effCamAngle) >= -0.35 && ws.maxY >= camY - VIS_ALT_WINDOW && ws.minY <= camY + VIS_ALT_WINDOW);
      if (ws.group.visible && i === 0) {
        ws.padMat.emissiveIntensity = 0.52 + 0.22 * Math.sin(time * 3.6);
      }
    }
  }

  if (cachedTower.grappleNodes) {
    const activeTarget = hero?.grappleTarget || null;
    for (let i = 0; i < cachedTower.grappleNodes.length; i++) {
      const gr = cachedTower.grappleNodes[i];
      const vis =
        fullTowerView ||
        (Math.cos(gr.phi - effCamAngle) >= -0.35 && Math.abs(gr.y - camY) <= VIS_ALT_WINDOW);
      gr.group.visible = vis;
      if (!vis) continue;
      const isTargeted =
        activeTarget &&
        ((gr.id && activeTarget.id === gr.id) ||
          (activeTarget.col === gr.col && Math.abs((activeTarget.floor ?? 0) - gr.floor) < 0.5));
      gr.ringPivot.rotation.z = Math.sin(time * 2.2 + i) * (isTargeted ? 0.22 : 0.08);
      gr.ringMat.emissiveIntensity = isTargeted ? 2.1 : 1.05 + 0.28 * Math.sin(time * 3.4 + i);
    }
  }

  // 7. Dynamic Ledges (`crumble`, `box`, `conveyor*`, `laserGate`, `phaseBlock`, `piston`, `steamVent`)
  const ledges = state?.ledges || tower?.ledges || [];
  for (let i = 0; i < ledges.length; i++) {
    const l = ledges[i];
    const node = cachedTower.ledgeMeshes[i];
    if (!node) continue;
    const ud = node.userData;

    if (ud.isStaticInstanced) {
      const gone = Boolean(l.gone);
      if (gone !== ud.lastGone) {
        ud.lastGone = gone;
        for (let b = 0; b < ud.batchRefs.length; b++) {
          const item = ud.batchRefs[b];
          const out = item?._bandOutRef;
          if (out?.inst) {
            out.inst.setMatrixAt(out.localIdx, gone ? _zeroMatrix : item.m);
            out.inst.instanceMatrix.needsUpdate = true;
          }
        }
      }
      continue;
    }

    const gone = Boolean(l.gone);
    if (Array.isArray(ud.batchRefs) && gone !== ud.lastGone) {
      ud.lastGone = gone;
      for (let b = 0; b < ud.batchRefs.length; b++) {
        const item = ud.batchRefs[b];
        const out = item?._bandOutRef;
        if (out?.inst) {
          out.inst.setMatrixAt(out.localIdx, gone ? _zeroMatrix : item.m);
          out.inst.instanceMatrix.needsUpdate = true;
        }
      }
    }
    if (gone) {
      node.visible = false;
      continue;
    }

    const inView =
      fullTowerView ||
      (Math.cos(ud.phi - effCamAngle) >= -0.32 && Math.abs(ud.baseY - camY) <= VIS_ALT_WINDOW);
    node.visible = inView;
    if (!inView) continue;

    if (l.type === 'crumble' && ud.pieceMesh) {
      const wantMat = l.crumbling ? ud.activeMat : ud.idleMat;
      if (ud.pieceMesh.material !== wantMat) ud.pieceMesh.material = wantMat;
      node.position.y = ud.baseY + (l.shake ? Math.sin(time * 55) * 0.055 : 0);
    } else if ((l.type === 'conveyorR' || l.type === 'conveyorL') && ud.treadMesh) {
      const wantMat = l.type === 'conveyorR' ? ud.convMatR : ud.convMatL;
      if (ud.treadMesh.material !== wantMat) ud.treadMesh.material = wantMat;
    } else if (l.type === 'laserGate' && ud.beam) {
      ud.beam.visible = l.active !== false;
      const pulse = 0.85 + 0.2 * Math.sin(time * 28);
      ud.beam.scale.set(pulse, 1, pulse);
    } else if (l.type === 'phaseBlock' && ud.slab) {
      ud.slab.visible = l.active !== false;
    } else if (l.type === 'piston') {
      const ext = l.pistonExt != null ? l.pistonExt : 1;
      const rad = TOWER_RADIUS - 0.3 + ext * (LEDGE_OFFSET + 0.3);
      node.position.x = rad * Math.sin(ud.phi);
      node.position.z = rad * Math.cos(ud.phi);
    } else if ((l.type === 'steamVent' || l.type === 'geyser') && ud.plume) {
      ud.plume.visible = Boolean(l.steamActive);
      if (ud.warnRing) {
        ud.warnRing.material.opacity = l.steamWarn ? 0.58 + 0.35 * Math.sin(time * 24) : 0.18;
      }
      if (ud.plume.visible) {
        ud.plume.scale.set(0.88 + Math.sin(time * 30) * 0.2, 0.92 + Math.cos(time * 24) * 0.15, 1);
      }
    }
  }

  // 8. REAL MECHANICAL ELEVATORS: Cab, Hoist Cables, Counterweight, Spinning Sheaves, Safety Gate & Chevrons!
  const elevators = state?.elevators || tower?.elevators || [];
  for (let i = 0; i < elevators.length; i++) {
    const pod = cachedTower.elevatorPods[i];
    if (!pod) continue;
    const el = elevators[i];
    const pUd = pod.userData;
    const elFloor = el.floor != null ? el.floor : el.startFloor || 0;
    const podY = elFloor * fh + (pUd.podOffsetY || 0);
    pod.position.y = podY;

    const onFront = fullTowerView || Math.cos(pUd.phi - effCamAngle) >= -0.36;
    const shaftInAlt = fullTowerView || (pUd.minY <= camY + VIS_ALT_WINDOW && pUd.maxY >= camY - VIS_ALT_WINDOW);
    const podInAlt = fullTowerView || Math.abs(podY + 0.8 - camY) <= VIS_ALT_WINDOW;

    pod.visible = onFront && podInAlt;
    if (pUd.winchGroup) pUd.winchGroup.visible = onFront && Math.abs(pUd.maxY - camY) <= VIS_ALT_WINDOW + 2.0;
    if (pUd.cablesMesh) pUd.cablesMesh.visible = onFront && shaftInAlt;
    if (pUd.cwtCableMesh) pUd.cwtCableMesh.visible = onFront && shaftInAlt;
    if (pUd.cwtNode) pUd.cwtNode.visible = onFront && shaftInAlt;

    if (onFront && shaftInAlt && pUd.update) {
      pUd.update();
    }

    if (pod.visible) {
      const isPowered =
        el.powered !== false &&
        (pUd.pipeGroup == null || !state?.pipeStates || state.pipeStates[pUd.pipeGroup] !== false);
      const atStop =
        !isPowered ||
        (el.dwellTimer || 0) > 0.02 ||
        Math.abs(elFloor - pUd.minFloor) < 0.06 ||
        Math.abs(elFloor - pUd.maxFloor) < 0.06;

      // Smoothly lift front entry safety bar at stops (`1.18 rad`) and lower horizontal (`0.0 rad`) while moving!
      if (pUd.safetyGate) {
        const wantGate = atStop ? 1.18 : 0.0;
        pUd.gateAngle += (wantGate - pUd.gateAngle) * Math.min(1, dt * 9.5);
        pUd.safetyGate.rotation.z = pUd.gateAngle;
      }

      // Update lighted Up / Down Chevron Indicators & Illuminated Floor Deck
      const dir = el.dir || 1;
      if (pUd.upMat && pUd.dnMat) {
        if (!isPowered) {
          pUd.upMat.emissive.set('#ef4444');
          pUd.dnMat.emissive.set('#ef4444');
          const blink = 0.35 + 0.35 * Math.sin(time * 5.0);
          pUd.upMat.emissiveIntensity = blink;
          pUd.dnMat.emissiveIntensity = blink;
        } else {
          pUd.upMat.emissive.set('#10b981');
          pUd.dnMat.emissive.set('#f59e0b');
          pUd.upMat.emissiveIntensity = dir >= 0 ? 1.75 : 0.16;
          pUd.dnMat.emissiveIntensity = dir < 0 ? 1.75 : 0.16;
        }
      }
      if (pUd.deckGlowMat) {
        pUd.deckGlowMat.emissive.set(isPowered ? '#22d3ee' : '#f59e0b');
        pUd.deckGlowMat.emissiveIntensity = isPowered ? 1.35 : 0.45 + 0.2 * Math.sin(time * 4.0);
      }
    }
  }

  // 9. Interactive Wall Pipe-Valves (`pipe_valve.glb`) & Hydro-Switches
  const switches = state?.switches || tower?.switches || [];
  const ledgeR = TOWER_RADIUS + LEDGE_OFFSET;
  for (let i = 0; i < cachedTower.switchNodes.length; i++) {
    const sm = cachedTower.switchNodes[i];
    if (i >= switches.length) {
      sm.visible = false;
      continue;
    }
    const sw = switches[i];
    const sPhi = (sw.col + 0.5) * COL_ANGLE;
    const sy = sw.floor * fh;
    const swInView =
      fullTowerView ||
      (Math.cos(sPhi - effCamAngle) >= -0.32 && Math.abs(sy - camY) <= VIS_ALT_WINDOW);
    sm.visible = swInView;
    if (!swInView) continue;

    sm.position.set(ledgeR * Math.sin(sPhi), sy, ledgeR * Math.cos(sPhi));
    sm.rotation.y = sPhi;

    const u = sm.userData;
    if (u.orb && u.orb.visible) {
      u.orb.rotation.y = time * 2.8;
    }
    if (u.wheel) {
      if (typeof sw.valveAngle === 'number') {
        u.wheel.rotation.z = sw.valveAngle;
      } else {
        u.wheel.rotation.z = sw.active ? time * 4.8 : Math.sin(time * 1.4) * 0.12;
      }
    }
    const idleHex = sw.group === 'cyan' ? '#38bdf8' : '#f59e0b';
    const activeHex = sw.active ? '#2dd4bf' : idleHex;
    u.orbMat.color.set(activeHex);
    u.orbMat.emissive.set(activeHex);
    u.orbMat.emissiveIntensity = sw.active ? 1.65 : 1.05;
  }

  // 10. Embedded Workbench & Sunken Treasure Chest
  const wb = state?.workbench || tower?.workbench;
  if (wb && wb.col != null && wb.floor != null) {
    if (!cachedTower.workbenchProp) {
      cachedTower.workbenchProp = buildWorkbenchMesh();
      cachedTower.group.add(cachedTower.workbenchProp);
    }
    const wbProp = cachedTower.workbenchProp;
    const wPhi = (wb.col + 0.5) * COL_ANGLE;
    const wy = wb.floor * fh;
    const wbVis =
      fullTowerView ||
      (Math.cos(wPhi - effCamAngle) >= -0.32 && Math.abs(wy - camY) <= VIS_ALT_WINDOW);
    wbProp.visible = wbVis;
    if (wbVis) {
      wbProp.position.set(ledgeR * Math.sin(wPhi), wy, ledgeR * Math.cos(wPhi));
      wbProp.rotation.y = wPhi;
      const wUd = wbProp.userData;
      const isCrafted = Boolean(wb.crafted);
      wUd.holoGhost.visible = !isCrafted;
      wUd.craftedGroup.visible = isCrafted;
      wUd.dynamoGroup.rotation.y = time * (isCrafted ? 3.4 : 1.8);
    }
  } else if (cachedTower.workbenchProp) {
    cachedTower.workbenchProp.visible = false;
  }

  const chest = state?.treasureChest || tower?.treasureChest;
  if (chest && chest.col != null && chest.floor != null) {
    if (!cachedTower.treasureChestProp) {
      cachedTower.treasureChestProp = buildTreasureChestMesh();
      cachedTower.group.add(cachedTower.treasureChestProp);
    }
    const chestProp = cachedTower.treasureChestProp;
    const cPhi = (chest.col + 0.5) * COL_ANGLE;
    const cy = chest.floor * fh;
    const chestVis =
      fullTowerView ||
      (Math.cos(cPhi - effCamAngle) >= -0.32 && Math.abs(cy - camY) <= VIS_ALT_WINDOW);
    chestProp.visible = chestVis;
    if (chestVis) {
      chestProp.position.set(ledgeR * Math.sin(cPhi), cy, ledgeR * Math.cos(cPhi));
      chestProp.rotation.y = cPhi;
      const cUd = chestProp.userData;
      const targetOpen = chest.opened ? 1 : 0;
      cUd.openLerp += (targetOpen - cUd.openLerp) * Math.min(1, dt * 7.5);
      cUd.lidPivot.rotation.x = -1.18 * cUd.openLerp;
      cUd.hoardGroup.visible = cUd.openLerp > 0.05;
      cUd.treasureGlow.material.opacity = cUd.openLerp * (0.65 + 0.14 * Math.sin(time * 4.2));
    }
  } else if (cachedTower.treasureChestProp) {
    cachedTower.treasureChestProp.visible = false;
  }
}

// ============================================================================
// 13. GPU MEMORY HYGIENE: `disposeTowerArchitecture(cachedTower)`
// ============================================================================

export function disposeTowerArchitecture(cachedTower) {
  if (!cachedTower || !cachedTower.group) return;
  if (cachedTower._onGlbReady) {
    INTERNAL_GLB_CACHE.listeners.delete(cachedTower._onGlbReady);
    cachedTower._onGlbReady = null;
  }
  if (Array.isArray(cachedTower.ownedTextures)) {
    for (let i = 0; i < cachedTower.ownedTextures.length; i++) {
      const t = cachedTower.ownedTextures[i];
      if (t && !t.userData?.shared) t.dispose();
    }
    cachedTower.ownedTextures.length = 0;
  }
  cachedTower.wallAoTex = null;
  cachedTower.group.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData?.shared) {
      obj.geometry.dispose();
    }
  });
}
