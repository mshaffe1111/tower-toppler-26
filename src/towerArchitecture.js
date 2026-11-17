// ============================================================================
// TOWER TOPPLER '26 — NEXT-GEN 3D TOWER ARCHITECTURE & PBR MASONRY ENGINE
// Module: src/towerArchitecture.js
//
// Builds every Reboot and Original tower out of hundreds of individually-cut,
// curved, beveled 3D InstancedMesh `arcSlab` / `hexBasalt` blocks in staggered
// courses over a deep recessed mortar core (#0a0c18), with 1024x1024 procedural
// tangent-space normal, AO/roughness/metalness, and albedo micro-grain maps.
//
// Exports:
//   - buildDetailedTowerGroup(tower, era, glbAssets)
//   - updateTowerArchitecture(cachedTower, state, time, dt)
//   - disposeTowerArchitecture(cachedTower)
//   - buildWorkbenchMesh(), buildTreasureChestMesh(), buildSwitchMesh()
//   - arcSlab, resolveRebootTheme, TOWER_RADIUS, FLOOR_HEIGHT, STEP_ORIGINAL
// ============================================================================

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries as _rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLS } from './levels.js';
import { PUZZLE_TYPES, BELL_COLORS, makePuzzle } from './puzzleRoom.js';

function mergeGeometries(parts) {
  const normalized = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = _rawMergeGeometries(normalized, false);
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] !== parts[i]) normalized[i].dispose();
    if (parts[i] && !parts[i].userData?.shared) parts[i].dispose();
  }
  return merged;
}

export const TOWER_RADIUS = 2.55;
export const FLOOR_HEIGHT = 1.0;
export const STEP_ORIGINAL = 0.43;
export const TWO_PI = Math.PI * 2;
export const COL_ANGLE = TWO_PI / COLS;

export const REBOOT_THEME_LIST = [
  'mist',
  'sinking',
  'foundry',
  'blizzard',
  'prism',
  'piston',
  'blackout',
  'apex',
];

const DOOR_W = 0.68;
const BRICK_PROUD = 0.056;
const MERLONS = 12;
// Micro-props & ledges use ONE whole-tower InstancedMesh per type (1 draw call each, always in view);
// only the heavy masonry wall blocks are partitioned into vertical row bands.
const PROP_SPAN_Y = 1e6;

// Zero-allocation module-level scratch math objects for per-frame updates & instancing
const _m4 = new THREE.Matrix4();
const _m4b = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _col = new THREE.Color();
const _col2 = new THREE.Color();
const _zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

// ============================================================================
// 1. DETERMINISTIC PRNG & ANGLE / HEIGHT HELPERS
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

export function resolveRebootTheme(tower) {
  const raw = tower?.theme || '';
  if (REBOOT_THEME_LIST.includes(raw)) return raw;
  const mapFromMaterial = {
    moonlit_slate: 'mist',
    rock: 'mist',
    copper: 'sinking',
    sandstone: 'sinking',
    metal: 'foundry',
    brass: 'foundry',
    ice: 'blizzard',
    timber: 'blizzard',
    crystal: 'prism',
    siding: 'piston',
    obsidian: 'blackout',
    marble: 'apex',
  };
  if (tower?.material && mapFromMaterial[tower.material]) {
    return mapFromMaterial[tower.material];
  }
  const idx = Math.max(0, (Number(tower?.id) || 1) - 1) % REBOOT_THEME_LIST.length;
  return REBOOT_THEME_LIST[idx];
}

export function getTowerStepHeight(tower, isOrig, overrideFh = null) {
  if (typeof overrideFh === 'number' && overrideFh > 0) return overrideFh;
  if (typeof tower?.stepHeight === 'number' && tower.stepHeight > 0) return tower.stepHeight;
  return isOrig && tower?.real ? STEP_ORIGINAL : FLOOR_HEIGHT;
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
        continue; // Buried inside opaque mortar core (inner wall + inner top/bottom bevels)
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

/**
 * Curved beveled annular sector hugging the tower cylinder:
 * Centered on +Z, top face at y = 0, spanning y = -height .. 0.
 * Uses crisp 1-segment corner chamfers so vertical block corners catch moonlight
 * while keeping triangle counts lean (~44-58 tris/block) for mobile 60fps.
 */
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
    const c = Math.min(corner, (r1 - r0) * 0.42, (r0 * span * 0.5) * 0.82);
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

/**
 * Interlocking 3D Hexagonal Volcanic Basalt Column (`'blackout'` T7):
 * 6-sided columnar prism centered on +Z at wall radius `rf`, spanning y = 0 .. height.
 */
function buildHexBasaltGeo(radiusHalfW, height, rf, bevel = 0.018) {
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
// 3. 1024x1024 PROCEDURAL PBR SURFACE GENERATOR (CACHED, ZERO TEXTURE LEAKS)
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
  const distBuf = new Float32Array(V_SIZE * V_SIZE);
  const nxBuf = new Float32Array(V_SIZE * V_SIZE);
  const nyBuf = new Float32Array(V_SIZE * V_SIZE);
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
      distBuf[k] = d1;
      nxBuf[k] = (pts[bestIdx + 2] - 0.5) * 0.95;
      nyBuf[k] = (pts[bestIdx + 3] - 0.5) * 0.95;
      toneBuf[k] = pts[bestIdx + 4];
    }
  }

  return { edgeBuf, distBuf, nxBuf, nyBuf, toneBuf };
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

export function getSurfaceMaps1024(kind = 'mist_slate', tile = 0.55) {
  const cacheKey = `${kind}_${tile}`;
  if (SURFACE_CACHE.has(cacheKey)) return SURFACE_CACHE.get(cacheKey);

  const N = SURFACE_TEX_SIZE;
  const seedMap = {
    mist_slate: 1987,
    sinking_limestone: 2049,
    foundry_iron: 3119,
    blizzard_ice: 4211,
    prism_obsidian: 5303,
    piston_steel: 6421,
    blackout_basalt: 7529,
    apex_monolith: 8627,
    orig_arcade: 9733,
  };
  const rand = mulberry32(seedMap[kind] || 1337);

  // Precompute 256x256 multi-octave base fields (<2ms), then synthesize true 1024x1024 micro-grain inline!
  const b8 = createLattice256(8, 8, rand);
  const b16 = createLattice256(16, 16, rand);
  const b32 = createLattice256(32, 32, rand);
  const b64 = createLattice256(64, 64, rand);
  const bStreak = createLattice256(4, 128, rand);
  const bVert = createLattice256(128, 8, rand);
  // 128x128 fine micro-relief table tiled 8x across 1024x1024 for razor-sharp 1024 sub-millimeter pits
  const fine128 = createLattice256(64, 64, rand);

  const needsVor =
    kind === 'mist_slate' ||
    kind === 'blizzard_ice' ||
    kind === 'prism_obsidian' ||
    kind === 'sinking_limestone' ||
    kind === 'blackout_basalt';
  const vor = needsVor ? precomputeVoronoiField(kind === 'prism_obsidian' ? 7 : 9, rand) : null;
  const edgeBuf = vor ? vor.edgeBuf : null;
  const distBuf = vor ? vor.distBuf : null;
  const toneBuf = vor ? vor.toneBuf : null;
  const nxBuf = vor ? vor.nxBuf : null;
  const nyBuf = vor ? vor.nyBuf : null;

  const hBuf = new Float32Array(N * N);
  const albData = new Uint8Array(N * N * 4);
  const ormData = new Uint8Array(N * N * 4);
  const nrmData = new Uint8Array(N * N * 4);
  const directFacet = kind === 'prism_obsidian';

  const kindId =
    kind === 'mist_slate'
      ? 0
      : kind === 'sinking_limestone'
      ? 1
      : kind === 'foundry_iron'
      ? 2
      : kind === 'blizzard_ice'
      ? 3
      : kind === 'prism_obsidian'
      ? 4
      : kind === 'piston_steel'
      ? 5
      : kind === 'blackout_basalt'
      ? 6
      : kind === 'apex_monolith'
      ? 7
      : 8;

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
      const n64v = b64[i00];
      const fine = n64v * 0.45 + fine128[fyRow + (x & 255)] * 0.55;
      const broad = n8v * 0.58 + n16v * 0.42;

      // True 1024x1024 per-texel hash micro-grain
      let hHash = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
      hHash = Math.imul(hHash ^ (hHash >>> 13), 1274126177) >>> 0;
      const gNorm = (hHash & 1023) * 0.0009775;

      let ht = 0.5;
      let cr = 0.9;
      let cg = 0.9;
      let cb = 0.92;
      let ao = 1.0;
      let rough = 0.72;
      let metal = 0.0;

      if (kindId === 0) {
        // mist_slate — Matte-damp rough-hewn slate-violet stone w/ chiseled sub-ashlar courses & rain streaks!
        const eVal = (edgeBuf[i00] + (edgeBuf[i10] - edgeBuf[i00]) * fx) * (1 - fy) + (edgeBuf[i01] + (edgeBuf[i11] - edgeBuf[i01]) * fx) * fy;
        const crack = eVal < 0.045 ? 1 - eVal / 0.045 : 0;
        const pSample = fine128[(((y + 19) & 255) << 8) + ((x + 37) & 255)];
        const pit = pSample > 0.75 ? (pSample - 0.75) * 3.8 : 0;

        // Running-bond chiseled sub-courses (8 courses per 1024 tile -> ~4 tight courses per floor!)
        const rowH = 128;
        const subRow = (y / rowH) | 0;
        const dyRow = ((y + ((mid * 5.0) | 0)) & 127);
        const hDist = dyRow < 64 ? dyRow : 128 - dyRow;
        const colShift = (subRow & 1) * 128 + (((subRow * 73) & 3) * 32);
        const dxCol = ((x + colShift + ((n16v * 8.0) | 0)) & 255);
        const vDist = dxCol < 128 ? dxCol : 256 - dxCol;
        const subMortarH = hDist < 4 ? 1.0 - hDist * 0.25 : 0.0;
        const subMortarV = vDist < 4 ? 1.0 - vDist * 0.25 : 0.0;
        const subMortar = subMortarH > subMortarV ? subMortarH : subMortarV;
        const subBevel = (hDist < 12 ? (12 - hDist) * 0.032 : 0) + (vDist < 12 ? (12 - vDist) * 0.026 : 0);
        const stoneSeed = (((subRow * 131 + (((x + colShift) >> 8) * 57)) & 15) - 7.5) * 0.014;

        // Localized vertical rainwater drip streaks (wet sheen in streaks, matte rough-hewn elsewhere!)
        const streakRaw = bStreak[((y >> 3) << 8) + ux0] * 0.65 + b16[(((uy0 >> 1) & 255) << 8) + ux0] * 0.35;
        const rainStreak = streakRaw > 0.66 ? (streakRaw - 0.66) * 2.6 : 0;

        const chisel = (bStreak[fyRow + ux0] - 0.5) * 0.18;
        ht =
          broad * 0.42 +
          mid * 0.26 +
          fine * 0.26 +
          chisel +
          stoneSeed * 1.4 -
          subBevel -
          subMortar * 0.58 -
          crack * 0.42 -
          pit * 0.5 +
          (gNorm - 0.5) * 0.08;
        const v =
          0.82 +
          stoneSeed +
          (broad - 0.5) * 0.28 +
          (mid - 0.5) * 0.16 -
          subMortar * 0.56 -
          subBevel * 0.22 -
          crack * 0.36 -
          pit * 0.2 -
          rainStreak * 0.14 +
          (gNorm - 0.5) * 0.07;

        const mRaw = b16[(((uy0 + 15) & 255) << 8) + ((ux0 + 29) & 255)] * 0.62 + fine * 0.38;
        const dampMoss = mRaw > 0.70 ? (mRaw - 0.70) * 3.0 : 0;
        cr = v * (1 - dampMoss * 0.28);
        cg = v * (1 + dampMoss * 0.14);
        cb = v * (1.04 - dampMoss * 0.34);
        ao = Math.max(0.18, 1.0 - subMortar * 0.72 - crack * 0.48 - pit * 0.38 - subBevel * 0.22);
        rough = Math.max(
          0.26,
          Math.min(0.92, 0.70 + fine * 0.16 + dampMoss * 0.16 - rainStreak * 0.38)
        );
        metal = 0.04;
      } else if (kindId === 1) {
        // sinking_limestone
        const eVal = edgeBuf[i00];
        const crack = eVal < 0.048 ? 1 - eVal / 0.048 : 0;
        const flute = bStreak[fyRow + ((ux0 + ((mid * 12) | 0)) & 255)];
        const pSample = fine128[(((y + 43) & 255) << 8) + ((x + 71) & 255)];
        const shellPit = pSample > 0.76 ? (pSample - 0.76) * 3.6 : 0;
        ht = flute * 0.38 + broad * 0.34 + fine * 0.2 - shellPit * 0.48 - crack * 0.3 + (gNorm - 0.5) * 0.05;
        const v = 0.83 + (flute - 0.5) * 0.3 + (broad - 0.5) * 0.2 - shellPit * 0.2 - crack * 0.25;
        const aRaw = broad * 0.6 + mid * 0.4;
        const algae = aRaw > 0.66 ? (aRaw - 0.66) * 2.4 : 0;
        cr = v * (0.95 - algae * 0.2);
        cg = v * (1.01 + algae * 0.08);
        cb = v * (1.02 + algae * 0.04);
        ao = Math.max(0.35, 1.0 - shellPit * 0.4 - crack * 0.35);
        rough = 0.36 + fine * 0.26 + algae * 0.2;
        metal = 0.08;
      } else if (kindId === 2) {
        // foundry_iron
        const brush = bStreak[fyRow + ux0];
        const sSample = bStreak[(((y + 97) & 255) << 8) + ((ux0 + 53) & 255)];
        const scratch = sSample > 0.86 ? (sSample - 0.86) * 4.2 : 0;
        const soot = broad > 0.54 ? (broad - 0.54) * 1.45 : 0;
        ht = brush * 0.18 + fine * 0.22 - scratch * 0.26 + (gNorm - 0.5) * 0.04;
        const v = 0.88 + (brush - 0.5) * 0.16 + scratch * 0.12 - soot * 0.26;
        cr = v * 1.02;
        cg = v * 0.98;
        cb = v * 0.96;
        ao = Math.max(0.45, 1.0 - soot * 0.25 - scratch * 0.2);
        rough = 0.28 + brush * 0.2 + soot * 0.34;
        metal = Math.max(0.35, 0.88 - soot * 0.35);
      } else if (kindId === 3) {
        // blizzard_ice
        const eVal = (edgeBuf[i00] + (edgeBuf[i10] - edgeBuf[i00]) * fx) * (1 - fy) + (edgeBuf[i01] + (edgeBuf[i11] - edgeBuf[i01]) * fx) * fy;
        const fracture = eVal < 0.038 ? 1 - eVal / 0.038 : 0;
        const bubble = gNorm > 0.988 ? 0.35 : 0;
        ht = broad * 0.24 + mid * 0.16 - fracture * 0.28 + fine * 0.08;
        const v = 0.86 + (mid - 0.5) * 0.16 + fracture * 0.28 + bubble;
        cr = v * 0.95;
        cg = v * 0.99;
        cb = Math.min(1.0, v * 1.05);
        ao = Math.max(0.55, 1.0 - fracture * 0.22);
        rough = 0.1 + fracture * 0.42 + (fine > 0.72 ? 0.18 : 0);
        metal = 0.06;
      } else if (kindId === 4) {
        // prism_obsidian
        const eVal = edgeBuf[i00];
        const dVal = distBuf[i00];
        const tVal = toneBuf[i00];
        const edge = eVal < 0.055 ? 1 - eVal / 0.055 : 0;
        const ripple = Math.sin(dVal * 24.0) * Math.exp(-dVal * 1.6);
        ht = tVal * 0.35 + ripple * 0.12 + edge * 0.18 + (gNorm - 0.5) * 0.02;
        const v = 0.84 + (tVal - 0.5) * 0.22 + edge * 0.28 + ripple * 0.06;
        cr = v * 0.98;
        cg = v * 0.95;
        cb = Math.min(1.0, v * 1.06);
        ao = Math.max(0.5, 1.0 - (1 - edge) * 0.12);
        rough = 0.12 + edge * 0.26 + (mid > 0.74 ? 0.16 : 0);
        metal = 0.32;
      } else if (kindId === 5) {
        // piston_steel
        const mach = bStreak[fyRow + ux0];
        const vRib = (((x & 63) - 32) * ((x & 63) - 32)) * 0.0009;
        const wSample = b32[(((uy0 + 17) & 255) << 8) + ((ux0 + 53) & 255)];
        const wear = wSample > 0.75 ? (wSample - 0.75) * 2.2 : 0;
        ht = mach * 0.14 + vRib * 0.08 - wear * 0.15 + (gNorm - 0.5) * 0.03;
        const v = 0.9 + (mach - 0.5) * 0.14 - wear * 0.12;
        cr = v * 0.97;
        cg = v * 1.0;
        cb = v * 1.02;
        ao = Math.max(0.55, 1.0 - wear * 0.2);
        rough = 0.24 + mach * 0.18 + wear * 0.28;
        metal = 0.86;
      } else if (kindId === 6) {
        // blackout_basalt
        const eVal = edgeBuf[i00];
        const crack = eVal < 0.042 ? 1 - eVal / 0.042 : 0;
        const stria = bVert[(uy0 << 8) + (x & 255)];
        const pSample = fine128[(((y + 83) & 255) << 8) + ((x + 19) & 255)];
        const pore = pSample > 0.74 ? (pSample - 0.74) * 3.2 : 0;
        ht = stria * 0.36 + broad * 0.28 + fine * 0.2 - pore * 0.42 - crack * 0.26 + (gNorm - 0.5) * 0.04;
        const v = 0.82 + (stria - 0.5) * 0.24 + (broad - 0.5) * 0.18 - pore * 0.22 - crack * 0.22;
        cr = v * 0.96;
        cg = v * 0.98;
        cb = v * 1.04;
        ao = Math.max(0.38, 1.0 - pore * 0.38 - crack * 0.32);
        rough = 0.3 + fine * 0.26 + pore * 0.2;
        metal = 0.22;
      } else if (kindId === 7) {
        // apex_monolith
        const gx = ((x + ((n8v * 6) | 0)) & 127) * 0.0078125;
        const gy = ((y + ((mid * 6) | 0)) & 127) * 0.0078125;
        const dx = gx - 0.5;
        const dy = gy - 0.5;
        const grooveX = (dx < 0.035 && dx > -0.035 && gy > 0.18 && gy < 0.82) ? 1 : 0;
        const grooveY = (dy < 0.035 && dy > -0.035 && gx > 0.22 && gx < 0.78) ? 1 : 0;
        const rDist = Math.sqrt(dx * dx + dy * dy);
        const ringGroove = rDist > 0.252 && rDist < 0.308 ? 1 : 0;
        const groove = grooveX | grooveY | ringGroove;
        ht = broad * 0.22 + fine * 0.12 - groove * 0.48 + (gNorm - 0.5) * 0.02;
        const v = 0.88 + (broad - 0.5) * 0.16 - groove * 0.28;
        cr = v * (1 + groove * 0.18);
        cg = v * (0.98 + groove * 0.12);
        cb = v * (1.02 - groove * 0.22);
        ao = Math.max(0.42, 1.0 - groove * 0.42);
        rough = 0.2 + fine * 0.18 + groove * 0.25;
        metal = 0.42 + groove * 0.35;
      } else {
        // orig_arcade
        ht = broad * 0.16 + mid * 0.1 + fine * 0.08 + (gNorm - 0.5) * 0.02;
        const v = 0.94 + (broad - 0.5) * 0.08 + (fine - 0.5) * 0.04;
        cr = v;
        cg = v;
        cb = v;
        ao = 0.96;
        rough = 0.24 + fine * 0.08;
        metal = 0.16;
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
    mist_slate: 4.8,
    sinking_limestone: 4.5,
    foundry_iron: 2.8,
    blizzard_ice: 2.5,
    prism_obsidian: 2.8,
    piston_steel: 2.2,
    blackout_basalt: 4.0,
    apex_monolith: 3.6,
    orig_arcade: 1.5,
  };
  const kStrength = strengthMap[kind] || 3.2;
  const mask = N - 1;

  for (let y = 0; y < N; y++) {
    const ym = ((y - 1) & mask) * N;
    const yp = ((y + 1) & mask) * N;
    const yRow = y * N;
    const vy = (y >> 2) << 8;
    for (let x = 0; x < N; x++) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;
      const i4 = (yRow + x) << 2;

      let nx = -(hBuf[yRow + xp] - hBuf[yRow + xm]) * kStrength;
      let ny = (hBuf[yp + x] - hBuf[ym + x]) * kStrength;
      if (directFacet && nxBuf) {
        const vk = vy + (x >> 2);
        nx = nx * 0.55 + nxBuf[vk] * 0.65;
        ny = ny * 0.55 + nyBuf[vk] * 0.65;
      }
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      nrmData[i4] = ((nx * invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      nrmData[i4 + 1] = ((ny * invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      nrmData[i4 + 2] = ((invLen * 0.5 + 0.5) * 255 + 0.5) | 0;
      nrmData[i4 + 3] = 255;
    }
  }

  const entry = {
    map: makeDataTex(albData, N, true, tile),
    normalMap: makeDataTex(nrmData, N, false, tile),
    ormMap: makeDataTex(ormData, N, false, tile),
  };
  SURFACE_CACHE.set(cacheKey, entry);
  return entry;
}

// ============================================================================
// 4. PER-BLOCK BEVEL + CURVED `aSpan` + DYNAMIC WATERLINE SHADER MATERIAL
// ============================================================================

function attachWaterlineShader(mat, wetStrength = 0.8) {
  mat.userData.waterY = mat.userData.waterY || { value: -0.55 };
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
        float archWet = (1.0 - smoothstep(uWaterY + 0.05, uWaterY + 1.65, vArchWorldPos.y)) * uWetStrength;
        float algaeWave = 0.5 + 0.5 * sin(vArchWorldPos.x * 3.7 + sin(vArchWorldPos.y * 4.3) * 1.6) * cos(vArchWorldPos.z * 3.9 - vArchWorldPos.y * 2.4);
        float archAlgae = archWet * smoothstep(0.42, 0.85, algaeWave);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.44, 0.49, 0.56), archWet * 0.68);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.10, 0.07), archAlgae * 0.24);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.36, (1.0 - smoothstep(uWaterY + 0.05, uWaterY + 1.5, vArchWorldPos.y)) * uWetStrength * 0.68);`
      );
  };
  mat.customProgramCacheKey = () => `arch_wet_ledge_${wetStrength > 0.01 ? '1' : '0'}`;
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

/**
 * Bakes a cylindrical 64x128 (angle x height) Ambient-Occlusion & Colored Bounce-Light Map:
 *   R = Strong overhanging-ledge / corbel / canopy underside contact AO shadow
 *   G = Warm #ff9d2e furnace & cage-lift lantern bounce on adjacent masonry
 *   B = Eerie #4fd1c5 misty doorway / rune-portal rim bounce on adjacent masonry
 */
function buildWallAoLightTexture(tower, fh, totalH, isOrig, clueEntries = null) {
  if (isOrig) return getDefaultWallAoTex();
  const W = 64;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  const aoGrid = new Float32Array(W * H);
  const warmGrid = new Float32Array(W * H);
  const coolGrid = new Float32Array(W * H);
  const invTotalH = 1 / Math.max(2, totalH);

  const stamp = (phiCenter, yTop, yBot, halfAng, rAmt, gAmt, bAmt) => {
    const v0 = Math.max(0, Math.min(H - 1, Math.floor(yBot * invTotalH * H)));
    const v1 = Math.max(0, Math.min(H - 1, Math.ceil(yTop * invTotalH * H)));
    const spanY = Math.max(0.05, yTop - yBot);
    for (let vy = v0; vy <= v1; vy++) {
      const wy = ((vy + 0.5) / H) * totalH;
      const tVert = Math.max(0, Math.min(1, (yTop - wy) / spanY)); // 0 right under lip -> 1 at bottom
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
    // Deep underside shadow directly beneath overhanging slab & Romanesque corbels
    stamp(phi, ly + 0.03, ly - 0.72, COL_ANGLE * 0.74, 0.88, 0, 0);
    // Subtle top contact crease right where flagstone meets the wall
    stamp(phi, ly + 0.16, ly - 0.02, COL_ANGLE * 0.62, 0.34, 0, 0);
  }

  for (const el of tower?.elevators || []) {
    const phi = (el.col + 0.5) * COL_ANGLE;
    const topY = (el.maxFloor + 1.32) * fh;
    const startY = (el.startFloor ?? el.minFloor ?? 0) * fh;
    stamp(phi, topY + 0.08, topY - 1.05, COL_ANGLE * 0.78, 0.85, 0.75, 0);
    stamp(phi, startY + 1.35, startY - 0.35, COL_ANGLE * 0.92, 0, 0.65, 0);
  }

  for (const d of tower?.doors || []) {
    const phi = (d.col + 0.5) * COL_ANGLE;
    const dy = d.floor * fh;
    if (d.tunnelStyle === 'sparkArch') {
      stamp(phi, dy + 1.05, dy - 0.25, COL_ANGLE * 0.98, 0.45, 0.88, 0);
    } else {
      stamp(phi, dy + 1.1, dy - 0.15, COL_ANGLE * 0.82, 0.32, 0, 0.58);
    }
  }

  if (Array.isArray(clueEntries)) {
    for (const ce of clueEntries) {
      const cPhi = ce.colCenter * COL_ANGLE;
      const cy = ce.floorY * fh;
      stamp(cPhi, cy + 0.78, cy - 0.78, COL_ANGLE * 0.95, 0.22, 0, 0.78);
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

export function createBlockMaterial({
  color = '#ffffff',
  surface = 'mist_slate',
  tile = 0.55,
  roughness = 0.48,
  metalness = 0.12,
  normalScale = 1.15,
  hi = '#d4e6ff',
  brickHalf = [0.24, 0.11],
  edgeDarken = 0.28,
  emissive = '#000000',
  emissiveIntensity = 0,
  angular = true,
  wetStrength = 0.85,
  useMetalMap = false,
  wallAoTex = null,
  totalH = 20.0,
} = {}) {
  const hasWallAo = Boolean(wallAoTex);
  const cacheKey = `${surface}|${color}|${tile}|${roughness}|${metalness}|${normalScale}|${hi}|${brickHalf[0].toFixed(3)}_${brickHalf[1].toFixed(3)}|${edgeDarken}|${emissive}|${emissiveIntensity}|${angular ? 1 : 0}|${wetStrength}|${useMetalMap ? 1 : 0}|${hasWallAo ? 1 : 0}`;
  const existing = BLOCK_MAT_CACHE.get(cacheKey);
  if (existing) {
    if (wallAoTex) existing.userData.wallAoUniform.value = wallAoTex;
    existing.userData.totalHUniform.value = Math.max(2.0, totalH);
    return existing;
  }

  const maps = getSurfaceMaps1024(surface, tile);
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.55 * normalScale, 0.55 * normalScale),
    roughnessMap: maps.ormMap,
    aoMap: maps.ormMap,
    aoMapIntensity: 0.92,
    roughness,
    metalness,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  });
  if (useMetalMap) {
    mat.metalnessMap = maps.ormMap;
  }

  mat.userData.shared = true;
  mat.userData.waterY = { value: -0.55 };
  mat.userData.wallAoUniform = { value: wallAoTex || getDefaultWallAoTex() };
  mat.userData.totalHUniform = { value: Math.max(2.0, totalH) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterY = mat.userData.waterY;
    shader.uniforms.uWetStrength = { value: wetStrength };
    shader.uniforms.uEdgeDarken = { value: edgeDarken };
    shader.uniforms.uBrickHi = { value: new THREE.Color(hi) };
    shader.uniforms.uBrickHalf = { value: new THREE.Vector2(brickHalf[0], brickHalf[1]) };
    shader.uniforms.uWallAoMap = mat.userData.wallAoUniform;
    shader.uniforms.uTotalH = mat.userData.totalHUniform;

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
        uniform float uTotalH;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float archWet = (1.0 - smoothstep(uWaterY + 0.05, uWaterY + 1.85, vArchWorldPos.y)) * uWetStrength;
        float algaeWave = 0.5 + 0.5 * sin(vArchWorldPos.x * 3.7 + sin(vArchWorldPos.y * 4.3) * 1.6) * cos(vArchWorldPos.z * 3.9 - vArchWorldPos.y * 2.4);
        float archAlgae = archWet * smoothstep(0.42, 0.85, algaeWave);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.47, 0.55), archWet * 0.68);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.10, 0.07), archAlgae * 0.24);`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        #ifdef USE_INSTANCING
        {
          vec3 bn = normalize(vBrickN);
          float hiK = clamp(smoothstep(0.24, 0.86, bn.y) + 0.58 * smoothstep(0.24, 0.86, bn.x), 0.0, 1.0);
          float loK = clamp(smoothstep(0.18, 0.80, -bn.y) + 0.62 * smoothstep(0.18, 0.80, -bn.x), 0.0, 1.0);
          vec2 fp = clamp(vec2(vBrickP.x / max(0.03, uBrickHalf.x), (vBrickP.y - uBrickHalf.y) / max(0.03, uBrickHalf.y)), -1.0, 1.0);
          float edgeCrevice = smoothstep(0.72, 1.0, max(abs(fp.x), abs(fp.y)));
          float faceGrad = fp.y * 0.48 + fp.x * 0.32;
          diffuseColor.rgb *= (1.0 + faceGrad * 0.10) * (1.0 - edgeCrevice * 0.34);
          vec3 lum = vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
          diffuseColor.rgb = mix(diffuseColor.rgb, uBrickHi * max(lum * 1.95, vec3(0.28)), hiK * 0.54);
          diffuseColor.rgb *= 1.0 - loK * 0.68;
        }
        #endif`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.38, (1.0 - smoothstep(uWaterY + 0.05, uWaterY + 1.65, vArchWorldPos.y)) * uWetStrength * 0.66);`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          float angU = fract(atan(vArchTowerPos.x, vArchTowerPos.z) / 6.2831853 + 1.0);
          float altV = clamp(vArchTowerPos.y / uTotalH, 0.0, 1.0);
          vec3 aoBounce = texture2D(uWallAoMap, vec2(angU, altV)).rgb;
          outgoingLight *= (1.0 - aoBounce.r * 0.80);
          outgoingLight += diffuseColor.rgb * vec3(1.45, 0.82, 0.28) * aoBounce.g * 0.88;
          outgoingLight += diffuseColor.rgb * vec3(0.32, 1.15, 1.08) * aoBounce.b * 0.56;
          outgoingLight += diffuseColor.rgb * 0.025 * (1.0 - aoBounce.r);
          float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          outgoingLight *= mix(1.0 - uEdgeDarken, 1.0, smoothstep(0.05, 0.76, ndv));
        }
        #include <opaque_fragment>`
      );
  };

  mat.customProgramCacheKey = () =>
    `arch_block_${angular ? 'A' : 'S'}_${useMetalMap ? 'M' : 'N'}_${hasWallAo ? 'W' : '0'}`;
  BLOCK_MAT_CACHE.set(cacheKey, mat);
  return mat;
}

// ============================================================================
// 5. SHARED PROCEDURAL PROP TEXTURES & PORTAL SHADER (SINGLETON CACHE)
// ============================================================================

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

  // Soft Gaussian glow dot (0 alpha at edges - zero hard border)
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

  // Organic multi-puff volumetric doorway mist wisp (0 alpha at border)
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
        const cx = px * w;
        const cy = py * h;
        const rad = pr * w;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
        gr.addColorStop(0, `rgba(218,236,255,${pa})`);
        gr.addColorStop(0.55, `rgba(186,214,242,${pa * 0.45})`);
        gr.addColorStop(1, 'rgba(186,214,242,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }
    },
    { srgb: true, clamp: true }
  );

  // Glowing fissures for crumbling stone
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
      g.lineWidth = 1.6 + rnd() * 2.4;
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

  // Crystalline frost texture
  const frost = makeCanvasOrDataTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e6f8ff');
    gr.addColorStop(1, '#9bd8f5');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1.2;
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

  const makeConveyor = (dir, isOrig) =>
    makeCanvasOrDataTex(
      128,
      64,
      (g, w, h) => {
        g.fillStyle = isOrig ? '#0f172a' : '#1e2430';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) {
          g.fillStyle = isOrig ? '#1e293b' : '#323c4d';
          g.fillRect(x, 0, 15, h);
          g.strokeStyle = isOrig ? '#38bdf8' : '#fbbf24';
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
        g.fillStyle = '#bae6fd';
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

  // Worn diagonal hazard stripe trim
  const hazard = makeCanvasOrDataTex(
    256,
    64,
    (g, w, h) => {
      g.fillStyle = '#eab308';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#111827';
      for (let x = -h; x < w + h; x += 32) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + 16, h);
        g.lineTo(x + 16 + h, 0);
        g.lineTo(x + h, 0);
        g.fill();
      }
      // Subtle industrial grime & edge scuffs
      for (let i = 0; i < 220; i++) {
        g.fillStyle = `rgba(20,24,32,${0.12 + rnd() * 0.25})`;
        g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 1 + rnd() * 3);
      }
    },
    { repeat: [2, 1] }
  );

  // Shootable energy box circuit glyph map
  const runeBox = makeCanvasOrDataTex(128, 128, (g, w, h) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.shadowColor = '#ffffff';
    g.shadowBlur = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.beginPath();
    g.arc(w / 2, h / 2, 22, 0, TWO_PI);
    g.moveTo(w / 2, 24);
    g.lineTo(w / 2, h - 24);
    g.moveTo(24, h / 2);
    g.lineTo(w - 24, h / 2);
    g.stroke();
  });

  // Carved Nordic/Nebulus Rune Sigil for Secret Sanctum Doors
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
      g.lineWidth = 10;
      g.beginPath();
      g.arc(128, 128, 86, 0, TWO_PI);
      g.stroke();
      g.lineWidth = 6;
      g.beginPath();
      g.arc(128, 128, 68, 0, TWO_PI);
      g.stroke();
      g.lineWidth = 11;
      g.beginPath();
      g.moveTo(128, 52);
      g.lineTo(128, 204);
      g.moveTo(128, 84);
      g.lineTo(84, 128);
      g.lineTo(128, 158);
      g.moveTo(128, 84);
      g.lineTo(172, 128);
      g.lineTo(128, 158);
      g.moveTo(94, 180);
      g.lineTo(162, 180);
      g.stroke();
    },
    { srgb: true, clamp: true }
  );

  // Vintage industrial boiler steam pressure gauge dial
  const gaugeDial = makeCanvasOrDataTex(
    64,
    64,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const grd = g.createRadialGradient(32, 32, 4, 32, 32, 29);
      grd.addColorStop(0, '#e8dcc4');
      grd.addColorStop(0.82, '#bca982');
      grd.addColorStop(1, '#3b2e1e');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(32, 32, 29, 0, TWO_PI);
      g.fill();
      // Red high-pressure danger arc
      g.strokeStyle = '#b91c1c';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(32, 32, 22, -0.35, 0.85);
      g.stroke();
      // Tick marks
      g.strokeStyle = '#1e293b';
      g.lineWidth = 1.8;
      for (let t = 0; t <= 10; t++) {
        const a = Math.PI * 0.78 + (t / 10) * Math.PI * 1.44;
        g.beginPath();
        g.moveTo(32 + Math.cos(a) * 18, 32 + Math.sin(a) * 18);
        g.lineTo(32 + Math.cos(a) * 25, 32 + Math.sin(a) * 25);
        g.stroke();
      }
      // Needle + brass center pin
      g.strokeStyle = '#0f172a';
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(32, 32);
      g.lineTo(46, 20);
      g.stroke();
      g.fillStyle = '#92400e';
      g.beginPath();
      g.arc(32, 32, 4, 0, TWO_PI);
      g.fill();
    },
    { srgb: true, clamp: true }
  );

  DETAIL_TEX = {
    glowDot,
    mist,
    cracks,
    frost,
    convR: makeConveyor(1, false),
    convL: makeConveyor(-1, false),
    origConvR: makeConveyor(1, true),
    origConvL: makeConveyor(-1, true),
    slideR: makeSlide(1),
    slideL: makeSlide(-1),
    hazard,
    runeBox,
    runeSigil,
    gaugeDial,
  };
  return DETAIL_TEX;
}

const PORTAL_MAT_CACHE = new Map();

function createPortalMaterial(glowHex, glow2Hex, aspect = 1.3, isMistPassage = false) {
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
          // Deep shadowed castle stone passage with subtle low-lying sea-mist near threshold!
          vec2 q = vUv;
          float revealL = smoothstep(0.14, 0.0, q.x) * (0.14 + 0.22 * (1.0 - q.y));
          float revealR = smoothstep(0.86, 1.0, q.x) * (0.24 + 0.28 * (1.0 - q.y));
          float lintelShadow = smoothstep(0.98, 0.52, q.y);
          float lowMistMask = smoothstep(0.66, 0.02, q.y);
          float wisp1 = fbmMist(vec2(q.x * 2.9 - uTime * 0.16, q.y * 2.6 - uTime * 0.11));
          float wisp2 = fbmMist(vec2(q.x * 4.8 + uTime * 0.13, q.y * 4.0 - uTime * 0.20) + wisp1 * 0.85);
          float billow = smoothstep(0.28, 0.82, wisp1 * 0.58 + wisp2 * 0.42);
          float centerPlume = exp(-pow((q.x - 0.5) / 0.42, 2.0));
          vec3 darkThroat = uGlow;
          vec3 mistCol = uGlow2;
          vec3 revealStone = vec3(0.09, 0.12, 0.19) * (revealL + revealR);
          vec3 col = mix(darkThroat, mistCol, clamp((billow * 0.65 + 0.28) * lowMistMask * centerPlume * 0.72, 0.0, 1.0));
          col += revealStone * lintelShadow;
          col *= 0.18 + 0.82 * lintelShadow;
          gl_FragColor = vec4(col, 1.0);
        } else {
          vec2 p = (vUv - vec2(0.5, 0.48)) * vec2(1.0, uAspect);
          float r = length(p);
          float a = atan(p.y, p.x);
          float swirl = a * 2.0 + 1.45 / (r + 0.06) - uTime * 1.85;
          float arms = 0.5 + 0.5 * sin(swirl);
          float arms2 = 0.5 + 0.5 * sin(swirl * 2.0 + 1.2);
          float disk = smoothstep(0.54, 0.12, r);
          float core = smoothstep(0.16, 0.09, r);
          float ring = exp(-pow((r - 0.16) / 0.026, 2.0));
          vec2 sp = vec2(swirl * 1.2, r * 16.0);
          float spark = step(0.987, hash21(floor(sp))) * smoothstep(0.48, 0.18, r);
          vec3 col = uGlow * disk * (0.04 + 0.42 * pow(arms, 4.0));
          col += uGlow2 * disk * pow(arms2, 7.0) * 0.28;
          col += mix(uGlow, uGlow2, 0.55) * ring * 0.85;
          col += uGlow2 * spark * 0.85;
          col *= (1.0 - core) * smoothstep(0.52, 0.30, r);
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
// 6. 8 REBOOT BIOME MASONRY DEFINITIONS & ORIGINAL XBLA PALETTES
// ============================================================================

const REBOOT_BIOME_SPECS = {
  // T1: Watchtower of the Mist — High-Res Reference Photo Hero (`media_1794884512715_2296550d.jpg`)!
  mist: {
    around: 14,
    rows: [2, 3, 2],
    jitter: 0.28,
    proud: 0.046,
    bevel: 0.026,
    joint: 0.034,
    corner: 0.02,
    shape: 'arc',
    surface: 'mist_slate',
    tile: 0.62,
    colors: ['#242738', '#2d3146', '#353a52', '#1e2130', '#30354b', '#282c3f'],
    mortar: '#05070e',
    roughness: 0.74,
    metalness: 0.04,
    normalScale: 1.5,
    hi: '#b8cbe6',
    edgeDarken: 0.36,
    bands: { every: 8, color: '#393f57', proud: 0.052 },
    ledgeBody: '#434a5c',
    ledgeTop: '#646e85',
    crown: '#2a2e42',
    pipeColor: '#232632',
    rustColor: '#5c3824',
    accentGlow: '#5efce8',
  },

  // T2: Sinking Reliquary — Cyclopean drowned limestone + barnacles + verdigris bronze bands
  sinking: {
    around: 11,
    rows: [3, 4, 2],
    jitter: 0.36,
    proud: 0.054,
    bevel: 0.044,
    joint: 0.048,
    corner: 0.032,
    shape: 'arc',
    surface: 'sinking_limestone',
    tile: 0.48,
    colors: ['#1a3748', '#23475c', '#2c566e', '#152c3a', '#315f78', '#1f3f52'],
    mortar: '#071018',
    roughness: 0.44,
    metalness: 0.12,
    normalScale: 1.35,
    hi: '#c4f1ff',
    edgeDarken: 0.28,
    bands: { every: 5, color: '#2e8f80', proud: 0.045 },
    ledgeBody: '#3d6175',
    ledgeTop: '#6793ab',
    crown: '#2a7d70',
    pipeColor: '#2d7a6e',
    rustColor: '#52a896',
    accentGlow: '#22d3ee',
  },

  // T3: Smelter Foundry — Bolted cast-iron & burnished-brass boiler plates + glowing louvers + smokestacks
  foundry: {
    around: 11,
    rows: [3, 3, 2],
    jitter: 0.06,
    proud: 0.022,
    bevel: 0.022,
    joint: 0.042,
    corner: 0.018,
    shape: 'arc',
    surface: 'foundry_iron',
    tile: 0.62,
    colors: ['#2e2528', '#3a2f33', '#251e21', '#46383c', '#342a2d'],
    mortar: '#0e0605',
    coreGlow: ['#b83204', 0.22],
    roughness: 0.34,
    metalness: 0.78,
    normalScale: 1.05,
    hi: '#ffe0a3',
    edgeDarken: 0.18,
    useMetalMap: true,
    bands: { every: 4, color: '#c88c36', proud: 0.036 },
    rivets: '#d6dce5',
    ledgeBody: '#4a3b37',
    ledgeTop: '#7a6258',
    crown: '#382c2f',
    pipeColor: '#362a2c',
    rustColor: '#b45309',
    accentGlow: '#f59e0b',
  },

  // T4: Boreal Glacier — Beveled translucent glacial-ice blocks + Nordic timber beams + hanging icicles
  blizzard: {
    around: 13,
    rows: [2, 3, 2],
    jitter: 0.24,
    proud: 0.042,
    bevel: 0.048,
    joint: 0.036,
    corner: 0.03,
    shape: 'arc',
    surface: 'blizzard_ice',
    tile: 0.5,
    colors: ['#82caf0', '#a0defa', '#6ab8e3', '#bceaff', '#74c2eb'],
    mortar: '#0d263d',
    coreGlow: ['#38bdf8', 0.28],
    blockGlow: ['#0284c7', 0.14],
    roughness: 0.15,
    metalness: 0.08,
    normalScale: 1.0,
    hi: '#ffffff',
    edgeDarken: 0.22,
    bands: { every: 5, color: '#543824', proud: 0.044 },
    ledgeBody: '#6abce6',
    ledgeTop: '#e0f4ff',
    crown: '#4f3522',
    pipeColor: '#4f3522',
    rustColor: '#2c3545',
    accentGlow: '#67e8f9',
  },

  // T5: Prism Labyrinth — Faceted polished obsidian + inlaid gold filigree + glowing amethyst crystals
  prism: {
    around: 15,
    rows: [2, 3, 2],
    jitter: 0.25,
    proud: 0.05,
    bevel: 0.038,
    joint: 0.044,
    corner: 0.024,
    shape: 'arc',
    surface: 'prism_obsidian',
    tile: 0.58,
    colors: ['#211538', '#2d1d4d', '#392561', '#180f2b', '#412b6e'],
    mortar: '#1d0938',
    coreGlow: ['#a855f7', 0.65],
    blockGlow: ['#6b21a8', 0.09],
    roughness: 0.17,
    metalness: 0.32,
    normalScale: 1.15,
    hi: '#f5d0fe',
    edgeDarken: 0.22,
    bands: { every: 5, color: '#d99b16', proud: 0.038 },
    ledgeBody: '#4e3e6e',
    ledgeTop: '#8872b3',
    crown: '#2c1c4d',
    pipeColor: '#d49a1a',
    rustColor: '#9333ea',
    accentGlow: '#e879f9',
  },

  // T6: Piston Rig — Brushed-steel armored bulkhead plates + recessed structural I-beams + hazard trim
  piston: {
    around: 10,
    rows: [3, 4],
    jitter: 0.0,
    proud: 0.02,
    bevel: 0.02,
    joint: 0.054,
    corner: 0.016,
    shape: 'arc',
    surface: 'piston_steel',
    tile: 0.64,
    colors: ['#31434d', '#3d5360', '#27363f', '#496270', '#364a55'],
    mortar: '#081014',
    roughness: 0.3,
    metalness: 0.82,
    normalScale: 0.92,
    hi: '#e0f2fe',
    edgeDarken: 0.16,
    useMetalMap: true,
    bands: { every: 5, color: '#1f2b33', proud: 0.036 },
    rivets: '#cbd5e1',
    ledgeBody: '#485b63',
    ledgeTop: '#7d98a3',
    crown: '#31434d',
    pipeColor: '#64748b',
    rustColor: '#eab308',
    accentGlow: '#34d399',
  },

  // T7: Blackout Citadel — Interlocking 3D hexagonal volcanic basalt columns + copper lightning-rod ribs
  blackout: {
    around: 24,
    rows: [4, 4, 3],
    jitter: 0.0,
    proud: 0.034,
    bevel: 0.018,
    joint: 0.014,
    corner: 0,
    shape: 'hexBasalt',
    surface: 'blackout_basalt',
    tile: 0.56,
    colors: ['#1a1e33', '#232842', '#141729', '#2c3354', '#1e233b'],
    mortar: '#070912',
    coreGlow: ['#4f46e5', 0.25],
    roughness: 0.34,
    metalness: 0.22,
    normalScale: 1.25,
    hi: '#c7d2fe',
    edgeDarken: 0.28,
    ledgeBody: '#3d455e',
    ledgeTop: '#6b789e',
    crown: '#1e233b',
    pipeColor: '#c86d32',
    rustColor: '#4aa392',
    accentGlow: '#818cf8',
  },

  // T8: Master Apex Reactor — Ancient alien carved obsidian-gold slabs + glowing magma/emerald conduits
  apex: {
    around: 12,
    rows: [3, 2, 4],
    jitter: 0.18,
    proud: 0.048,
    bevel: 0.036,
    joint: 0.062,
    corner: 0.024,
    shape: 'arc',
    surface: 'apex_monolith',
    tile: 0.54,
    colors: ['#1f1633', '#2a1e45', '#161026', '#352657', '#241a3b'],
    mortar: '#1a0c04',
    coreGlow: ['#f59e0b', 0.88],
    blockGlow: ['#d97706', 0.08],
    roughness: 0.22,
    metalness: 0.42,
    normalScale: 1.2,
    hi: '#fef08a',
    edgeDarken: 0.2,
    useMetalMap: true,
    bands: { every: 4, color: '#d9a01b', proud: 0.044 },
    ledgeBody: '#53436b',
    ledgeTop: '#eab308',
    crown: '#d9a01b',
    pipeColor: '#d9a01b',
    rustColor: '#10b981',
    accentGlow: '#fbbf24',
  },
};

// ============================================================================
// 7. SHARED REUSABLE DETAIL GEOMETRIES (MOSS, PIPES, VALVES, CORBELS, LIFTS)
// ============================================================================

let ARCH_GEOS = null;

function getSharedArchGeometries() {
  if (ARCH_GEOS) return ARCH_GEOS;
  const R = TOWER_RADIUS;
  const ledgeR = R + 0.34;
  const span = COL_ANGLE * 0.94;

  // Multi-stone curved ledge courses (centered at local (0,0,0) = radius R + 0.34)
  const buildCurvedCourse = (r0, r1, count, h, bev, gapA, yOff = 0) => {
    const pieceA = (span - gapA * (count - 1)) / count;
    const parts = [];
    for (let i = 0; i < count; i++) {
      const g = arcSlab(r0, r1, pieceA, h, bev, 2, 1, 0.02, R - 0.005);
      g.rotateY(-span * 0.5 + pieceA * 0.5 + i * (pieceA + gapA));
      g.translate(0, yOff, -ledgeR);
      parts.push(g);
    }
    return mergeGeometries(parts);
  };

  // Chipped irregular hand-split flagstone pavers for Reboot ledges (lean 48 tris/ledge + irregular chipped lips!)
  const buildChippedFlagstoneTopGeo = () => {
    const pavers = [
      { f0: 0.0, f1: 0.47, rOut: R + 0.72, h: 0.064, yOff: 0.002, tiltZ: -0.011 },
      { f0: 0.485, f1: 1.0, rOut: R + 0.744, h: 0.068, yOff: -0.002, tiltZ: 0.009 },
    ];
    const parts = [];
    for (const p of pavers) {
      const pSpan = (p.f1 - p.f0) * span;
      const midFrac = (p.f0 + p.f1) * 0.5 - 0.5;
      const g = arcSlab(R - 0.04, p.rOut, pSpan, p.h, 0.014, 1, 1, 0, R - 0.005);
      g.rotateZ(p.tiltZ);
      g.rotateY(midFrac * span);
      g.translate(0, p.yOff, -ledgeR);
      parts.push(g);
    }
    return stripWallBuriedBackFaces(mergeGeometries(parts), -0.32, -0.8);
  };

  const buildChippedFlagstoneBedGeo = () => {
    const g = arcSlab(R - 0.04, R + 0.655, span * 0.98, 0.095, 0.014, 2, 1, 0, R - 0.005);
    g.translate(0, -0.056, -ledgeR);
    return stripWallBuriedBackFaces(g, -0.32, -0.8);
  };

  // Smoothly curved Romanesque S-scroll tapered stone corbel ribs + stepped abacus molding (~84 tris/pair, ZERO Minecraft cubes!)
  const buildCorbelPairGeo = () => {
    const prof = new THREE.Shape();
    prof.moveTo(-0.34, -0.095); // Wall top anchor beneath abacus
    prof.lineTo(0.26, -0.095);  // Upper neck under abacus cap
    prof.lineTo(0.265, -0.135); // Molded front roll
    prof.quadraticCurveTo(0.20, -0.17, 0.13, -0.195); // Upper convex ogee
    prof.bezierCurveTo(0.02, -0.23, -0.08, -0.32, -0.15, -0.43); // Smooth concave Romanesque S-taper!
    prof.quadraticCurveTo(-0.20, -0.49, -0.28, -0.50); // Lower carved scroll toe
    prof.lineTo(-0.34, -0.50); // Wall bottom anchor
    prof.closePath();

    const ribW = 0.125;
    const parts = [];
    for (const cx of [-0.30, 0.30]) {
      const rib = new THREE.ExtrudeGeometry(prof, {
        depth: ribW,
        bevelEnabled: false,
        curveSegments: 2,
      });
      rib.rotateY(-Math.PI * 0.5);
      rib.translate(cx + ribW * 0.5, 0, 0);

      // Stepped Romanesque abacus top molding block above each curved S-scroll rib
      const abacus = new THREE.BoxGeometry(ribW + 0.032, 0.042, 0.62);
      abacus.translate(cx, -0.08, -0.03);
      parts.push(rib, abacus);
    }
    return stripWallBuriedBackFaces(mergeGeometries(parts), -0.28, -0.8);
  };

  // Bolted wrought-iron diagonal tension/gusset support bracket alongside stone corbels
  const buildIronGussetBracketGeo = () => {
    const parts = [];
    const diag = new THREE.BoxGeometry(0.036, 0.42, 0.032);
    diag.rotateX(-0.74);
    diag.translate(0, -0.25, -0.04);
    const topPlate = new THREE.BoxGeometry(0.068, 0.022, 0.34);
    topPlate.translate(0, -0.085, 0.02);
    const wallPlate = new THREE.BoxGeometry(0.068, 0.28, 0.024);
    wallPlate.translate(0, -0.31, -0.27);
    const bolt1 = new THREE.ConeGeometry(0.02, 0.016, 5, 1, true);
    bolt1.rotateX(Math.PI * 0.5);
    bolt1.translate(0, -0.38, -0.255);
    parts.push(diag, topPlate, wallPlate, bolt1);
    return mergeGeometries(parts);
  };

  // Tarnished-brass boiler steam pressure gauge + cylindrical steam-trap canister
  const buildBrassGaugeGeo = () => {
    const bezel = new THREE.CylinderGeometry(0.082, 0.086, 0.044, 12);
    bezel.rotateX(Math.PI * 0.5);
    bezel.translate(0, 0, 0.055);
    const rim = new THREE.TorusGeometry(0.082, 0.012, 5, 12);
    rim.translate(0, 0, 0.076);
    const stem = new THREE.CylinderGeometry(0.016, 0.016, 0.09, 6);
    stem.translate(0, -0.095, 0.045);
    const elbow = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6);
    elbow.rotateX(Math.PI * 0.5);
    elbow.translate(0, -0.135, 0.015);
    return mergeGeometries([bezel, rim, stem, elbow]);
  };

  const buildSteamCanisterGeo = () => {
    const body = new THREE.CylinderGeometry(0.088, 0.088, 0.34, 10);
    const capT = new THREE.SphereGeometry(0.088, 10, 5, 0, TWO_PI, 0, Math.PI * 0.5);
    capT.translate(0, 0.17, 0);
    const port = new THREE.CylinderGeometry(0.048, 0.054, 0.09, 8);
    port.rotateX(Math.PI * 0.5);
    port.translate(0, -0.04, 0.075);
    return mergeGeometries([body, capT, port]);
  };

  // Draped organic velvety moss cushion overhanging stone joints & ledge lips (lean 30 tris/clump!)
  const buildMossClusterGeo = () => {
    const m1 = new THREE.SphereGeometry(0.088, 5, 2, 0, TWO_PI, 0, Math.PI * 0.68);
    m1.scale(1.55, 0.38, 0.74);
    const m2 = new THREE.SphereGeometry(0.066, 5, 2, 0, TWO_PI, 0, Math.PI * 0.68);
    m2.scale(1.32, 0.36, 0.68);
    m2.translate(0.082, -0.012, 0.014);
    const m3 = new THREE.SphereGeometry(0.054, 4, 2, 0, TWO_PI, 0, Math.PI * 0.75);
    m3.scale(0.88, 1.05, 0.54);
    m3.translate(0.014, -0.056, 0.036); // Draped overhanging moss tendril!
    return mergeGeometries([m1, m2, m3]);
  };

  // Low-profile crusty coastal limpet/barnacle dome cluster (closed rock-crusts - zero hollow rings!)
  const buildBarnacleClusterGeo = () => {
    const specs = [
      [0, 0, 0.038, 0.016],
      [0.045, 0.018, 0.028, 0.013],
      [-0.042, -0.016, 0.032, 0.014],
      [0.014, -0.038, 0.024, 0.012],
    ];
    const parts = specs.map(([ox, oy, r, h]) => {
      const c = new THREE.CylinderGeometry(r * 0.34, r, h, 5, 1, false);
      c.rotateX(Math.PI * 0.5);
      c.translate(ox, oy, h * 0.32);
      return c;
    });
    return mergeGeometries(parts);
  };

  // 3-shard protruding crystal cluster ('prism' & 'apex')
  const buildCrystalClusterGeo = () => {
    const s1 = new THREE.ConeGeometry(0.052, 0.28, 6);
    s1.rotateX(Math.PI * 0.38);
    s1.translate(0, 0.04, 0.1);
    const s2 = new THREE.ConeGeometry(0.038, 0.21, 6);
    s2.rotateX(Math.PI * 0.45);
    s2.rotateZ(-0.34);
    s2.translate(0.055, 0.01, 0.08);
    const s3 = new THREE.ConeGeometry(0.034, 0.18, 6);
    s3.rotateX(Math.PI * 0.32);
    s3.rotateZ(0.38);
    s3.translate(-0.05, -0.01, 0.07);
    return mergeGeometries([s1, s2, s3]);
  };

  // 3-spike hanging icicle cluster ('blizzard' & 'ice' ledges)
  const buildIcicleClusterGeo = () => {
    const i1 = new THREE.ConeGeometry(0.038, 0.28, 5);
    i1.rotateX(Math.PI);
    i1.translate(0, -0.14, 0);
    const i2 = new THREE.ConeGeometry(0.026, 0.19, 5);
    i2.rotateX(Math.PI);
    i2.translate(-0.055, -0.095, 0.01);
    const i3 = new THREE.ConeGeometry(0.024, 0.16, 5);
    i3.rotateX(Math.PI);
    i3.translate(0.052, -0.08, -0.01);
    return mergeGeometries([i1, i2, i3]);
  };

  // Wrought-iron 6-spoke valve wheel ('mist', 'foundry', 'piston', 'drainValve')
  const buildValveWheelGeo = () => {
    const rim = new THREE.TorusGeometry(0.105, 0.016, 6, 16);
    const hub = new THREE.CylinderGeometry(0.028, 0.028, 0.05, 8);
    hub.rotateX(Math.PI * 0.5);
    const parts = [rim, hub];
    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.CylinderGeometry(0.009, 0.009, 0.2, 5);
      spoke.rotateZ((s * Math.PI) / 3);
      parts.push(spoke);
    }
    return mergeGeometries(parts);
  };

  // Classic 1987 / 2008 XBLA telescoping lift disc lathe geometries
  const latheProf = (r, h, e) => [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r - e, 0),
    new THREE.Vector2(r, e),
    new THREE.Vector2(r, h - e),
    new THREE.Vector2(r - e, h),
    new THREE.Vector2(0, h),
  ];

  // Merged double-ring + crosshair elevator ceiling halo (1 draw call instead of 4!)
  const buildElevatorHaloGeo = () => {
    const outer = new THREE.TorusGeometry(0.36, 0.035, 8, 24);
    outer.rotateX(Math.PI * 0.5);
    const inner = new THREE.TorusGeometry(0.18, 0.02, 6, 18);
    inner.rotateX(Math.PI * 0.5);
    const sp1 = new THREE.BoxGeometry(0.7, 0.02, 0.022);
    const sp2 = new THREE.BoxGeometry(0.022, 0.02, 0.7);
    return mergeGeometries([outer, inner, sp1, sp2]);
  };

  const ledgeWidth = R * COL_ANGLE * 1.1;

  ARCH_GEOS = {
    ledgeTopCourse: buildCurvedCourse(R - 0.04, R + 0.72, 2, 0.068, 0.016, 0.006, 0),
    ledgeBodyCourse: buildCurvedCourse(R - 0.04, R + 0.67, 2, 0.115, 0.015, 0.006, -0.065),
    rebootFlagstoneTop: buildChippedFlagstoneTopGeo(),
    rebootFlagstoneBed: buildChippedFlagstoneBedGeo(),
    ironGussetBracket: buildIronGussetBracketGeo(),
    brassGauge: buildBrassGaugeGeo(),
    gaugeFace: (() => {
      const g = new THREE.CircleGeometry(0.074, 12);
      g.translate(0, 0, 0.08);
      return g;
    })(),
    steamCanister: buildSteamCanisterGeo(),
    origRealSlab: (() => {
      const g = arcSlab(R - 0.04, R + 0.7, span, 0.28, 0.02, 2, 1, 0.02, R - 0.005);
      g.translate(0, 0, -ledgeR);
      return g;
    })(),
    origRealCap: (() => {
      const g = arcSlab(R - 0.03, R + 0.72, span * 0.99, 0.052, 0.012, 2, 1, 0.018, R - 0.005);
      g.translate(0, 0.004, -ledgeR);
      return g;
    })(),
    corbelPair: buildCorbelPairGeo(),
    stairBody: (() => {
      const g = arcSlab(R - 0.03, R + 0.62, COL_ANGLE * 0.44, 0.18, 0.016, 1, 1, 0, R - 0.005);
      g.translate(0, 0, -ledgeR);
      return g;
    })(),
    stairCap: (() => {
      const g = arcSlab(R - 0.02, R + 0.65, COL_ANGLE * 0.46, 0.052, 0.012, 1, 1, 0, R - 0.005);
      g.translate(0, 0, -ledgeR);
      return g;
    })(),
    crumblePiece: (() => {
      const g = arcSlab(R - 0.03, R + 0.7, span * 0.31, 0.175, 0.018, 1, 1, 0.016, R - 0.005);
      g.translate(0, 0, -ledgeR);
      return g;
    })(),
    crumbleTriple: (() => {
      const parts = [];
      for (const k of [-1, 0, 1]) {
        const g = arcSlab(R - 0.03, R + 0.7, span * 0.31, 0.175, 0.018, 1, 1, 0.016, R - 0.005);
        g.translate(0, 0, -ledgeR);
        g.rotateY(k * COL_ANGLE * 0.31);
        g.rotateZ(k * 0.018);
        parts.push(g);
      }
      return mergeGeometries(parts);
    })(),
    iceSlab: (() => {
      const g = arcSlab(R - 0.04, R + 0.71, span, 0.17, 0.03, 2, 1, 0.022, R - 0.005);
      g.translate(0, 0, -ledgeR);
      return g;
    })(),
    iceCap: (() => {
      const g = arcSlab(R - 0.02, R + 0.69, span * 0.97, 0.045, 0.012, 2, 1, 0.018, R - 0.005);
      g.translate(0, 0.008, -ledgeR);
      return g;
    })(),
    convBase: (() => {
      const g = arcSlab(R - 0.04, R + 0.71, span, 0.165, 0.022, 2, 1, 0.018, R - 0.005);
      g.translate(0, 0, -ledgeR);
      return g;
    })(),
    convTread: (() => {
      const g = arcSlab(R + 0.02, R + 0.65, span * 0.96, 0.036, 0.008, 2, 1, 0);
      g.translate(0, 0.014, -ledgeR);
      return g;
    })(),
    convHazard: (() => {
      const g = arcSlab(R + 0.68, R + 0.725, span * 0.92, 0.085, 0.008, 2, 1, 0);
      g.translate(0, -0.035, -ledgeR);
      return g;
    })(),
    roller: new THREE.CylinderGeometry(0.046, 0.046, 0.64, 8),
    rollerTrio: (() => {
      const parts = [];
      for (const rx of [-0.34, 0, 0.34]) {
        const r = new THREE.CylinderGeometry(0.046, 0.046, 0.64, 8);
        r.rotateX(Math.PI * 0.5);
        r.translate(rx * ledgeWidth, -0.06, 0);
        parts.push(r);
      }
      return mergeGeometries(parts);
    })(),
    twinHoistCables: (() => {
      const cL = new THREE.CylinderGeometry(0.017, 0.017, 1.0, 5);
      cL.translate(-0.17, 0, 0);
      const cR = new THREE.CylinderGeometry(0.017, 0.017, 1.0, 5);
      cR.translate(0.17, 0, 0);
      return mergeGeometries([cL, cR]);
    })(),
    laserEmitters: (() => {
      const eL = new THREE.CylinderGeometry(0.075, 0.09, 0.26, 8);
      eL.translate(-ledgeWidth * 0.44, 0.16, 0);
      const eR = new THREE.CylinderGeometry(0.075, 0.09, 0.26, 8);
      eR.translate(ledgeWidth * 0.44, 0.16, 0);
      return mergeGeometries([eL, eR]);
    })(),
    steamNozzle: (() => {
      const n = new THREE.CylinderGeometry(0.12, 0.15, 0.15, 8);
      n.translate(0, 0.07, 0);
      return n;
    })(),
    pistonRams: (() => {
      const rL = new THREE.CylinderGeometry(0.085, 0.085, 0.76, 8);
      rL.rotateX(Math.PI * 0.5);
      rL.translate(-0.26, -0.09, -0.34);
      const rR = new THREE.CylinderGeometry(0.085, 0.085, 0.76, 8);
      rR.rotateX(Math.PI * 0.5);
      rR.translate(0.26, -0.09, -0.34);
      return mergeGeometries([rL, rR]);
    })(),
    exitCrownTines: (() => {
      const parts = [];
      for (let sp = 0; sp < 5; sp++) {
        const ca = (sp / 5) * TWO_PI;
        const tine = new THREE.ConeGeometry(0.036, 0.12, 6);
        tine.translate(Math.cos(ca) * 0.16, 0.08, Math.sin(ca) * 0.16);
        parts.push(tine);
      }
      return mergeGeometries(parts);
    })(),
    energyBox: new RoundedBoxGeometry(0.84, 0.54, 0.58, 1, 0.055),
    energyCore: new THREE.BoxGeometry(0.52, 0.28, 0.61),
    flutedPillar: new THREE.CylinderGeometry(0.24, 0.25, 1.0, 10),
    pillarCollar: new RoundedBoxGeometry(0.68, 0.08, 0.56, 1, 0.018),
    mossCluster: buildMossClusterGeo(),
    barnacleCluster: buildBarnacleClusterGeo(),
    crystalCluster: buildCrystalClusterGeo(),
    icicleCluster: buildIcicleClusterGeo(),
    valveWheel: buildValveWheelGeo(),
    rivetDome: (() => {
      const g = new THREE.ConeGeometry(0.026, 0.018, 4, 1, true);
      g.rotateX(Math.PI * 0.5);
      return g;
    })(),
    pipeSegment: new THREE.CylinderGeometry(0.042, 0.042, 1.0, 7),
    pipeFlange: new THREE.CylinderGeometry(0.078, 0.078, 0.058, 8),
    wallSconceBox: new RoundedBoxGeometry(0.22, 0.34, 0.13, 1, 0.022),
    louverHood: new RoundedBoxGeometry(0.38, 0.22, 0.07, 1, 0.016),
    louverGlow: new THREE.PlaneGeometry(0.3, 0.14),
    ashlarBlock: new THREE.BoxGeometry(1, 1, 1),
    elevatorHalo: buildElevatorHaloGeo(),
    recessVoid: arcSlab(R - 0.34, R - 0.02, 0.32, 1.0, 0, 1, 1, 0),
    portalPlane: new THREE.PlaneGeometry(DOOR_W * 0.94, 1.0),
    sparkCube: new THREE.BoxGeometry(0.038, 0.038, 0.038),
    liftDisc: new THREE.LatheGeometry(latheProf(0.29, 0.155, 0.026), 16),
    liftTop: new THREE.LatheGeometry(latheProf(0.42, 0.125, 0.03), 18),
    liftBase: new THREE.LatheGeometry(latheProf(0.38, 0.11, 0.025), 16),
  };

  for (const g of Object.values(ARCH_GEOS)) {
    g.userData.shared = true;
  }
  return ARCH_GEOS;
}

// ============================================================================
// 8. 3D INSTANCED MASONRY WALL + BIOME EXTRUDED ACCENTS + CROWN + SURF STAIRS
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
    const minY = bIdx * bandSpanY - 0.35;
    const maxY = (bIdx + 1) * bandSpanY + 0.35;
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

function isNearOpening(phi, y, holes, padA = 0.12, padY = 0.25) {
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    if (y >= h.y0 - padY && y <= h.y1 + padY && Math.abs(angDist(phi, h.a)) < h.w + padA) {
      return true;
    }
  }
  return false;
}

function isInElevatorShaft(phi, y, shafts, padA = 0.14) {
  for (let i = 0; i < shafts.length; i++) {
    const s = shafts[i];
    if (y >= s.y0 - 0.3 && y <= s.y1 + 0.5 && Math.abs(angDist(phi, s.a)) < s.w + padA) {
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
  keepInReflection = false,
  angularSectors = 1
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
    let spanAttr = null;
    if (useSpanAttr) {
      const spanArr = new Float32Array(items.length);
      for (let i = 0; i < items.length; i++) spanArr[i] = items[i].span;
      spanAttr = new THREE.InstancedBufferAttribute(spanArr, 1);
      bandGeo.setAttribute('aSpan', spanAttr);
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
    const minY = bIdx * bandSpanY - 0.25;
    const maxY = (bIdx + 1) * bandSpanY + 0.25;
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

function buildTowerMasonryAndAccents(
  group,
  tower,
  era,
  rbTheme,
  fh,
  isRealOrig,
  holes,
  shafts,
  stoneMats,
  bandedMeshes,
  bandSpanY,
  wallAoTex,
  pipeAvoidHoles = holes
) {
  const isOrig = era === 'original';
  const R = TOWER_RADIUS;
  const totalH = tower.floors * fh;
  const pal = tower.palette || {};
  const G = getSharedArchGeometries();
  const T = getDetailTextures();
  const rnd = mulberry32((Number(tower.id) || 1) * 9137 + ((tower.seed | 0) % 7919) + 17);

  const spec = isOrig ? null : REBOOT_BIOME_SPECS[rbTheme] || REBOOT_BIOME_SPECS.mist;

  // 1. Deep Recessed Dark Mortar Core Cylinder (#050710 in Mist, slight lighthouse upward taper!)
  const mortarColor = isOrig ? pal.mortar || '#08112b' : spec.mortar || pal.mortar || '#050710';
  const coreMat = new THREE.MeshStandardMaterial({
    color: mortarColor,
    roughness: 0.98,
    metalness: 0.02,
  });
  if (!isOrig && spec.coreGlow) {
    coreMat.emissive = new THREE.Color(spec.coreGlow[0]);
    coreMat.emissiveIntensity = spec.coreGlow[1];
  }
  const coreTopR = isOrig ? R - 0.038 : R - 0.072;
  const coreBotR = isOrig ? R - 0.038 : R - 0.022;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(coreTopR, coreBotR, totalH + 0.24, 32, 1, false),
    coreMat
  );
  core.position.y = totalH * 0.5;
  core.castShadow = true;
  core.receiveShadow = true;
  core.userData.keepInReflection = true;
  group.add(core);

  // Dark 3D void boxes behind every doorway opening (batched into 1 InstancedMesh!)
  if (holes.length > 0) {
    const recessMat = new THREE.MeshBasicMaterial({ color: '#03060e' });
    const recessInst = new THREE.InstancedMesh(G.recessVoid, recessMat, holes.length);
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      _e.set(0, h.a, 0);
      _q.setFromEuler(_e);
      _pos.set(0, h.y1 + 0.04, 0);
      _scl.set(Math.max(0.5, (h.w * 2.35) / 0.32), h.y1 - h.y0 + 0.1, 1);
      _m4.compose(_pos, _q, _scl);
      recessInst.setMatrixAt(i, _m4);
    }
    recessInst.instanceMatrix.needsUpdate = true;
    group.add(recessInst);
  }

  // 2. Individually-Cut, Curved, Beveled 3D InstancedMesh Wall Blocks (Partitioned into Vertical Row Bands!)
  const rivetsList = [];
  const mossList = [];
  const barnacleList = [];
  const crystalList = [];
  const icicleList = [];
  const louverBodyList = [];
  const louverGlowList = [];
  const gaugeBodyList = [];
  const gaugeFaceList = [];
  const canisterList = [];

  if (isOrig) {
    // 2007-2010 XBLA HD Crisp Glossy Chamfered 3D Arcade Bricks (lean 24 tris/brick + 16-row bands for 60fps!)
    const N = isRealOrig ? 18 : 20;
    const blockA = TWO_PI / N;
    const courseH = isRealOrig ? fh : fh * 0.25;
    const bev = 0.021;
    const brickHt = Math.max(0.08, courseH - 0.028);
    const jointW = 0.046;
    const r1 = R + BRICK_PROUD - bev;
    const capA = (blockA * (R + BRICK_PROUD) - jointW - 2 * bev) / r1;

    const brickGeo = arcSlab(R - 0.022, r1, capA, brickHt, bev, 1, 1, 0, R - 0.005);
    brickGeo.translate(0, brickHt, 0);

    const courses = Math.ceil(totalH / courseH);
    const brickMat = createBlockMaterial({
      color: '#ffffff',
      surface: 'orig_arcade',
      tile: 0.65,
      roughness: 0.24,
      metalness: 0.16,
      normalScale: 0.55,
      hi: pal.ledgeTop || '#e0f2fe',
      brickHalf: [(capA * r1) * 0.5 + bev, brickHt * 0.5],
      edgeDarken: 0.22,
      angular: true,
      wetStrength: 0.25,
    });
    stoneMats.push(brickMat);

    const colA = new THREE.Color(pal.brickA || '#1d4ed8');
    const colB = new THREE.Color(pal.brickB || '#2563eb');
    const half = (capA * r1 + 2 * bev) * 0.5 / (R + BRICK_PROUD);
    const joint = jointW / (R + BRICK_PROUD);
    const wallEntries = [];

    const placeOrig = (a0, a1, y0) => {
      const sp = a1 - a0;
      if (sp < blockA * 0.12) return;
      _e.set(0, (a0 + a1) * 0.5, 0);
      _q.setFromEuler(_e);
      _pos.set(0, y0 + 0.014, 0);
      _scl.set(1, 1, 1);
      const m = new THREE.Matrix4().compose(_pos, _q, _scl);
      const c = colA.clone().lerp(colB, rnd() * 0.85).multiplyScalar(1.06 + (rnd() - 0.5) * 0.1);
      wallEntries.push({
        m,
        c,
        span: Math.max(0.12, sp / (half * 2)),
        y: y0 + courseH * 0.5,
      });
    };

    for (let c = 0; c < courses; c++) {
      const y0 = c * courseH;
      const stagger = (c % 2) * 0.5;
      const rowHoles = holes.filter((h) => y0 + courseH > h.y0 && y0 < h.y1);
      for (let b = 0; b < N; b++) {
        const a = (b + stagger) * blockA;
        let a0 = a - half;
        let a1 = a + half;
        let skip = false;
        for (const h of rowHoles) {
          const d0 = angDist(a0, h.a);
          const d1 = angDist(a1, h.a);
          if (d0 >= h.w || d1 <= -h.w) continue;
          if (d0 >= -h.w && d1 <= h.w) {
            skip = true;
            break;
          }
          if (d0 < -h.w && d1 > h.w) {
            placeOrig(a0, h.a - h.w - joint * 0.5, y0);
            placeOrig(h.a + h.w + joint * 0.5, a1, y0);
            skip = true;
            break;
          }
          if (d0 < -h.w) a1 = h.a - h.w - joint * 0.5;
          else a0 = h.a + h.w + joint * 0.5;
        }
        if (!skip) placeOrig(a0, a1, y0);
      }
    }

    materializeWallBands(group, bandedMeshes, brickGeo, brickMat, wallEntries, bandSpanY, true, false, true);
  } else {
    // REBOOT: 8 Distinct 3D Extruded Block Geometries & 1024x1024 PBR Surfaces (~3.6-4 tight courses/floor on T1!)
    const N = spec.around;
    const blockA = TWO_PI / N;
    const courseUnit = rbTheme === 'mist' ? fh * 0.155 : fh * 0.165;
    const baseH = spec.rows[0] * courseUnit;
    const bev = spec.bevel;
    const blockHt = Math.max(0.08, baseH - spec.joint * 0.55);
    const r1 = R + BRICK_PROUD - bev;
    const rf = R + BRICK_PROUD;
    const capA = Math.max(0.04, (blockA * rf - spec.joint - 2 * bev) / r1);
    const isHex = spec.shape === 'hexBasalt';

    let blockGeo;
    let hexHalfA = 0;
    if (isHex) {
      const hexR = (blockA * rf) * 0.54;
      hexHalfA = hexR / rf;
      blockGeo = buildHexBasaltGeo(hexR, baseH - 0.014, rf, bev);
    } else {
      blockGeo = arcSlab(
        R - 0.045,
        r1,
        capA,
        blockHt,
        bev,
        1,
        1,
        0,
        R - 0.012
      );
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
      brickHalf: [(capA * r1) * 0.5 + bev, blockHt * 0.5],
      edgeDarken: spec.edgeDarken,
      emissive: spec.blockGlow ? spec.blockGlow[0] : '#000000',
      emissiveIntensity: spec.blockGlow ? spec.blockGlow[1] : 0,
      angular: !isHex,
      wetStrength: rbTheme === 'foundry' ? 0.35 : 0.88,
      useMetalMap: Boolean(spec.useMetalMap),
      wallAoTex,
      totalH,
    });
    stoneMats.push(blockMat);

    const basePaletteCols = spec.colors.map((hex) => new THREE.Color(hex));
    const palLerp = rbTheme === 'mist' ? 0.06 : 0.2;
    if (pal.brickA) {
      const pA = new THREE.Color(pal.brickA);
      for (let i = 0; i < basePaletteCols.length; i += 2) basePaletteCols[i].lerp(pA, palLerp);
    }
    if (pal.brickB) {
      const pB = new THREE.Color(pal.brickB);
      for (let i = 1; i < basePaletteCols.length; i += 2) basePaletteCols[i].lerp(pB, palLerp);
    }
    const bandCol = spec.bands ? new THREE.Color(spec.bands.color) : null;
    const mossHexes = ['#1e3819', '#26451f', '#172c13', '#2e5225'];
    const barnacleHexes = ['#434a4d', '#50585a', '#3b4245', '#4b5255'];
    const crystalHexes = rbTheme === 'apex' ? ['#fbbf24', '#10b981', '#f59e0b'] : ['#c084fc', '#e879f9', '#a855f7'];

    const half = (capA * r1 + 2 * bev) * 0.5 / rf;
    const jointA = spec.joint / rf;
    const wallEntries = [];
    let isBand = false;

    const placeBlock = (a0, a1, y0, hr) => {
      const sp = a1 - a0;
      if (sp < blockA * 0.12 || hr < 0.06) return;
      const midA = (a0 + a1) * 0.5;
      const inShaft = y0 >= -0.05 && isInElevatorShaft(midA, y0 + hr * 0.5, shafts, 0.015);
      // Deeply recessed vertical stone elevator channel (-13.5cm) matching reference photo upper-right!
      const shaftDelta = inShaft ? -0.135 : 0;

      // Lighthouse batter: flared cyclopean surf foundation (y < 1.45 down to -1.35) + slight upward fortress taper
      const flareBase = y0 < 1.45 ? Math.pow(Math.max(0, 1.45 - y0) / 2.8, 1.45) * 0.22 : 0;
      const upperTaper = y0 > 0 ? -0.048 * Math.min(1, y0 / Math.max(10, totalH)) : 0;

      const proudAmt = isBand ? spec.bands.proud : spec.proud;
      const stoneRelief = isBand ? proudAmt : (rnd() - 0.45) * 2.1 * proudAmt;
      const radialOut = 1 + (shaftDelta + flareBase + upperTaper + stoneRelief) / R;
      const sy = isHex ? hr / blockHt : Math.max(0.15, (hr - spec.joint * 0.55) / blockHt);

      _e.set(
        (rnd() - 0.5) * 0.016,
        midA,
        (rnd() - 0.5) * 0.016
      );
      _q.setFromEuler(_e);
      _pos.set(0, y0 + 0.01, 0);
      _scl.set(radialOut, sy, radialOut);
      const m = new THREE.Matrix4().compose(_pos, _q, _scl);

      const c = new THREE.Color();
      if (isBand && bandCol) {
        c.copy(bandCol).multiplyScalar(1.02 * (0.9 + rnd() * 0.18));
      } else {
        c
          .copy(basePaletteCols[Math.floor(rnd() * basePaletteCols.length)])
          .multiplyScalar(1.08 * (0.86 + rnd() * 0.26));
      }
      if (inShaft) c.multiplyScalar(0.52);

      wallEntries.push({
        m,
        c,
        span: !isHex ? Math.max(0.12, sp / (half * 2)) : 1,
        y: Math.max(0, y0 + hr * 0.5),
        phi: ((midA % TWO_PI) + TWO_PI) % TWO_PI,
      });

      // Collect per-biome 3D extruded wall details right on the stone/plate joints!
      if (!inShaft && sp > blockA * 0.42 && y0 > -0.4 && y0 < totalH - 0.35) {
        const surfR = rf + (radialOut - 1) * R;
        if (spec.rivets) {
          const rCount = 2;
          for (let j = 0; j < rCount; j++) {
            const ra = a0 + sp * (j === 0 ? 0.18 : 0.82);
            pushInstance(rivetsList, Math.sin(ra) * (surfR + 0.004), y0 + 0.025 + hr * 0.14, Math.cos(ra) * (surfR + 0.004), 0, ra, 0, 1, 1, 1);
            pushInstance(rivetsList, Math.sin(ra) * (surfR + 0.004), y0 + 0.012 + hr * 0.84, Math.cos(ra) * (surfR + 0.004), 0, ra, 0, 1, 1, 1);
          }
        }
        if (rbTheme === 'foundry' && !isBand && rnd() < 0.09 && hr > 0.24) {
          pushInstance(
            louverBodyList,
            Math.sin(midA) * (surfR + 0.018),
            y0 + hr * 0.5,
            Math.cos(midA) * (surfR + 0.018),
            0,
            midA,
            0,
            1,
            1,
            1
          );
          pushInstance(
            louverGlowList,
            Math.sin(midA) * (surfR + 0.056),
            y0 + hr * 0.5,
            Math.cos(midA) * (surfR + 0.056),
            0,
            midA,
            0,
            1,
            1,
            1
          );
        } else if (rbTheme === 'mist' && !isBand) {
          // Creeping dark-green moss patches (#2d4d24) along damp vertical crevices + pale crusty barnacles near surf!
          const mossVein = Math.sin(midA * 5.0 + 0.9) > 0.42 ? 0.22 : 0.075;
          if (rnd() < mossVein) {
            const ma = a0 + sp * (0.2 + rnd() * 0.6);
            pushInstance(
              mossList,
              Math.sin(ma) * (surfR + 0.008),
              y0 + 0.015,
              Math.cos(ma) * (surfR + 0.008),
              (rnd() - 0.5) * 0.35,
              ma,
              (rnd() - 0.5) * 0.45,
              0.75 + rnd() * 0.85,
              0.75 + rnd() * 0.75,
              0.78 + rnd() * 0.4,
              mossHexes[Math.floor(rnd() * mossHexes.length)]
            );
          } else if (y0 < 4.2 && rnd() < 0.14) {
            const ba = a0 + sp * (0.2 + rnd() * 0.6);
            pushInstance(
              barnacleList,
              Math.sin(ba) * (surfR + 0.003),
              y0 + hr * (0.2 + rnd() * 0.6),
              Math.cos(ba) * (surfR + 0.003),
              0,
              ba,
              rnd() * TWO_PI,
              0.85 + rnd() * 0.65,
              0.85 + rnd() * 0.65,
              0.85 + rnd() * 0.45,
              barnacleHexes[Math.floor(rnd() * barnacleHexes.length)]
            );
          }
        } else if (rbTheme === 'sinking' && rnd() < (y0 < totalH * 0.45 ? 0.22 : 0.08)) {
          const ba = a0 + sp * (0.2 + rnd() * 0.6);
          pushInstance(
            barnacleList,
            Math.sin(ba) * (surfR + 0.003),
            y0 + hr * (0.25 + rnd() * 0.5),
            Math.cos(ba) * (surfR + 0.003),
            0,
            ba,
            rnd() * TWO_PI,
            0.75 + rnd() * 0.65,
            0.75 + rnd() * 0.65,
            0.8 + rnd() * 0.45,
            barnacleHexes[Math.floor(rnd() * barnacleHexes.length)]
          );
        } else if (rbTheme === 'blizzard' && isBand && rnd() < 0.42) {
          pushInstance(
            icicleList,
            Math.sin(midA) * (surfR + 0.025),
            y0 + 0.01,
            Math.cos(midA) * (surfR + 0.025),
            0,
            midA,
            0,
            0.8 + rnd() * 0.5,
            0.85 + rnd() * 0.65,
            0.8 + rnd() * 0.5
          );
        } else if ((rbTheme === 'prism' || rbTheme === 'apex') && !isBand && rnd() < 0.065) {
          pushInstance(
            crystalList,
            Math.sin(midA) * (surfR + 0.01),
            y0 + hr * 0.45,
            Math.cos(midA) * (surfR + 0.01),
            0,
            midA,
            (rnd() - 0.5) * 0.6,
            0.75 + rnd() * 0.55,
            0.75 + rnd() * 0.65,
            0.75 + rnd() * 0.55,
            crystalHexes[Math.floor(rnd() * crystalHexes.length)]
          );
        }
      }
    };

    const gapV = Math.max(0.018, spec.joint * 0.52);
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

    // Start 3D battered stone courses below y = 0 (-1.85m) so real cyclopean 3D stones plunge below deepest wave troughs!
    let y0 = isHex ? 0 : -1.85;
    for (let r = 0; y0 < totalH + (isHex ? baseH : 0); r++) {
      const hr = (isHex ? spec.rows[0] : spec.rows[Math.floor(rnd() * spec.rows.length)]) * courseUnit;
      isBand = !isHex && y0 > 0.5 && Boolean(spec.bands) && r % spec.bands.every === spec.bands.every - 1;
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

    // `core` (64 tris) casts the solid tower cylinder shadow; 8 whole-height 45° sectors cull 3/8 unseen rear bricks (`-10k` more tris, 0px visual change!)
    materializeWallBands(group, bandedMeshes, blockGeo, blockMat, wallEntries, PROP_SPAN_Y, !isHex, false, false, 8);

    // 3. Biome-Specific Clustered Flanged Boiler Pipes, Steam Canisters, Brass Gauges & Valves
    const pipeSegs = [];
    const flangeSegs = [];
    const valveSegs = [];
    const sconceSegs = [];
    const hazardRails = [];
    const energySpines = [];

    const candidatePipeCols = [0.85, 2.35, 5.85, 8.85, 11.85, 14.65];
    for (const cVal of candidatePipeCols) {
      const phi = cVal * COL_ANGLE;
      if (isInElevatorShaft(phi, totalH * 0.5, shafts, 0.22)) continue;

      const segStep = 1.25;
      for (let sy = 0.35; sy < totalH - 0.6; sy += segStep) {
        const midY = sy + segStep * 0.5;
        if (isNearOpening(phi, midY, pipeAvoidHoles, 0.16, 0.25)) continue;
        const taperOff = -0.048 * Math.min(1, midY / Math.max(10, totalH));
        const pr = R + BRICK_PROUD + 0.052 + taperOff;

        if (rbTheme === 'apex' || rbTheme === 'prism') {
          pushInstance(
            energySpines,
            Math.sin(phi) * (pr - 0.015),
            midY,
            Math.cos(phi) * (pr - 0.015),
            0,
            phi,
            0,
            0.85,
            segStep * 0.94,
            0.85
          );
        }

        pushInstance(
          pipeSegs,
          Math.sin(phi) * pr,
          midY,
          Math.cos(phi) * pr,
          0,
          phi,
          0,
          rbTheme === 'blizzard' ? 1.45 : rbTheme === 'foundry' || rbTheme === 'piston' ? 1.25 : 1.05,
          segStep,
          rbTheme === 'blizzard' ? 1.2 : 1.05
        );

        // Clustered twin & triple companion boiler pipes in 'mist' / 'foundry' (matching reference photo!)
        if (rbTheme === 'mist' || rbTheme === 'foundry') {
          const phi2 = phi + 0.044;
          if (!isNearOpening(phi2, midY, pipeAvoidHoles, 0.14, 0.2)) {
            pushInstance(
              pipeSegs,
              Math.sin(phi2) * (pr - 0.008),
              midY,
              Math.cos(phi2) * (pr - 0.008),
              0,
              phi2,
              0,
              0.76,
              segStep,
              0.76
            );
            if (Math.floor(sy / segStep) % 2 === 1) {
              pushInstance(flangeSegs, Math.sin(phi2) * (pr - 0.008), sy + 0.18, Math.cos(phi2) * (pr - 0.008), 0, phi2, 0, 0.78, 0.9, 0.78);
            }
          }
          if (Math.round(cVal) % 3 === 2 && sy > 1.5 && sy < totalH - 2.5) {
            const phi3 = phi - 0.042;
            if (!isNearOpening(phi3, midY, pipeAvoidHoles, 0.14, 0.2)) {
              pushInstance(pipeSegs, Math.sin(phi3) * (pr - 0.012), midY, Math.cos(phi3) * (pr - 0.012), 0, phi3, 0, 0.62, segStep, 0.62);
            }
          }
        }

        // Bolted pipe flange collars every ~1.25-2.5 floors
        pushInstance(
          flangeSegs,
          Math.sin(phi) * pr,
          sy + 0.08,
          Math.cos(phi) * pr,
          0,
          phi,
          0,
          1.05,
          1,
          1.05
        );
      }

      // Wrought-iron steam-trap canisters, junction boxes, 6-spoke valve wheels & brass pressure gauges!
      if (rbTheme === 'mist' || rbTheme === 'foundry' || rbTheme === 'piston') {
        let idxStation = 0;
        for (let vy = 1.9; vy < totalH - 1.4; vy += 3.6, idxStation++) {
          const vPhi = phi + 0.072;
          if (isNearOpening(vPhi, vy, pipeAvoidHoles, 0.22, 0.45) || isInElevatorShaft(vPhi, vy, shafts, 0.24)) {
            continue;
          }
          const taperOff = -0.048 * Math.min(1, vy / Math.max(10, totalH));
          const sr = R + BRICK_PROUD + 0.055 + taperOff;

          if (idxStation % 2 === 0) {
            pushInstance(canisterList, Math.sin(vPhi) * (sr + 0.02), vy, Math.cos(vPhi) * (sr + 0.02), 0, vPhi, 0, 1, 1, 1);
          } else {
            pushInstance(sconceSegs, Math.sin(vPhi) * sr, vy, Math.cos(vPhi) * sr, 0, vPhi, 0, 1, 1, 1);
          }

          pushInstance(
            valveSegs,
            Math.sin(phi) * (sr + 0.055),
            vy - 0.34,
            Math.cos(phi) * (sr + 0.055),
            0,
            phi,
            0,
            1,
            1,
            1
          );

          // Tarnished-brass steam pressure gauge with vintage dial face!
          const gPhi = phi - 0.055;
          const gy = vy + 0.26;
          if (!isNearOpening(gPhi, gy, pipeAvoidHoles, 0.18, 0.35)) {
            const gx = Math.sin(gPhi) * (sr + 0.015);
            const gz = Math.cos(gPhi) * (sr + 0.015);
            pushInstance(gaugeBodyList, gx, gy, gz, 0, gPhi, 0, 1, 1, 1);
            pushInstance(gaugeFaceList, gx, gy, gz, 0, gPhi, 0, 1, 1, 1);
          }
        }
      }
    }

    // Piston Rig ('piston') 3D worn hazard-stripe bumper bands
    if (rbTheme === 'piston') {
      for (let hy = 3.0; hy < totalH - 1.0; hy += 4.0) {
        for (let hc = 0; hc < COLS; hc += 2) {
          const hPhi = (hc + 0.5) * COL_ANGLE;
          if (isNearOpening(hPhi, hy, holes, 0.24, 0.4) || isInElevatorShaft(hPhi, hy, shafts, 0.22)) {
            continue;
          }
          pushInstance(
            hazardRails,
            Math.sin(hPhi) * (R + 0.34),
            hy,
            Math.cos(hPhi) * (R + 0.34),
            0,
            hPhi,
            0,
            1,
            1.15,
            0.52
          );
        }
      }
    }

    // Materialize all batched 3D biome wall accents
    const ironPipeMat = attachWaterlineShader(
      new THREE.MeshStandardMaterial({
        color: spec.pipeColor,
        roughness: rbTheme === 'blizzard' ? 0.78 : 0.42,
        metalness: rbTheme === 'blizzard' ? 0.12 : 0.82,
      }),
      0.6
    );
    const rustAccentMat = attachWaterlineShader(
      new THREE.MeshStandardMaterial({
        color: spec.rustColor,
        roughness: 0.48,
        metalness: rbTheme === 'prism' || rbTheme === 'apex' ? 0.65 : 0.72,
      }),
      0.5
    );
    stoneMats.push(ironPipeMat, rustAccentMat);

    buildBandedInstancedFromList(group, bandedMeshes, G.pipeSegment, ironPipeMat, pipeSegs, PROP_SPAN_Y, {
      castShadow: false,
    });
    buildBandedInstancedFromList(group, bandedMeshes, G.pipeFlange, rustAccentMat, flangeSegs, PROP_SPAN_Y);
    buildBandedInstancedFromList(group, bandedMeshes, G.wallSconceBox, ironPipeMat, sconceSegs, PROP_SPAN_Y);
    buildBandedInstancedFromList(group, bandedMeshes, G.steamCanister, ironPipeMat, canisterList, PROP_SPAN_Y);
    buildBandedInstancedFromList(group, bandedMeshes, G.valveWheel, rustAccentMat, valveSegs, PROP_SPAN_Y);

    if (gaugeBodyList.length) {
      const brassGaugeMat = attachWaterlineShader(
        new THREE.MeshStandardMaterial({
          color: '#b88632',
          roughness: 0.28,
          metalness: 0.88,
        }),
        0.5
      );
      const dialFaceMat = new THREE.MeshStandardMaterial({
        map: T.gaugeDial,
        roughness: 0.25,
        metalness: 0.1,
      });
      stoneMats.push(brassGaugeMat);
      buildBandedInstancedFromList(group, bandedMeshes, G.brassGauge, brassGaugeMat, gaugeBodyList, PROP_SPAN_Y);
      buildBandedInstancedFromList(group, bandedMeshes, G.gaugeFace, dialFaceMat, gaugeFaceList, PROP_SPAN_Y, {
        receiveShadow: false,
      });
    }

    if (rivetsList.length) {
      const rivMat = new THREE.MeshStandardMaterial({
        color: spec.rivets,
        roughness: 0.28,
        metalness: 0.88,
      });
      buildBandedInstancedFromList(group, bandedMeshes, G.rivetDome, rivMat, rivetsList, PROP_SPAN_Y);
    }

    if (louverBodyList.length) {
      const lvGlowMat = new THREE.MeshBasicMaterial({ color: '#ff6a00' });
      buildBandedInstancedFromList(group, bandedMeshes, G.louverHood, ironPipeMat, louverBodyList, PROP_SPAN_Y);
      buildBandedInstancedFromList(group, bandedMeshes, G.louverGlow, lvGlowMat, louverGlowList, PROP_SPAN_Y, {
        receiveShadow: false,
      });
    }

    // Wall moss & barnacles are merged into the ledge/door moss & barnacle InstancedMeshes (1 draw call each)
    // by `buildDetailedTowerGroup` via the returned `mossList` / `barnacleList`.

    if (icicleList.length) {
      const icMat = new THREE.MeshStandardMaterial({
        color: '#e0f7ff',
        emissive: '#38bdf8',
        emissiveIntensity: 0.2,
        roughness: 0.08,
        metalness: 0.12,
        transparent: true,
        opacity: 0.88,
      });
      buildBandedInstancedFromList(group, bandedMeshes, G.icicleCluster, icMat, icicleList, PROP_SPAN_Y);
    }

    if (crystalList.length) {
      const crMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: rbTheme === 'apex' ? '#f59e0b' : '#a855f7',
        emissiveIntensity: 0.82,
        roughness: 0.12,
        metalness: 0.28,
      });
      buildBandedInstancedFromList(group, bandedMeshes, G.crystalCluster, crMat, crystalList, PROP_SPAN_Y);
    }

    if (energySpines.length) {
      const spMat = new THREE.MeshStandardMaterial({
        color: rbTheme === 'apex' ? '#fef08a' : '#f5d0fe',
        emissive: rbTheme === 'apex' ? '#10b981' : '#c084fc',
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.5,
      });
      buildBandedInstancedFromList(group, bandedMeshes, G.pipeSegment, spMat, energySpines, PROP_SPAN_Y);
    }

    if (hazardRails.length) {
      const hzMat = new THREE.MeshStandardMaterial({ map: T.hazard, roughness: 0.45, metalness: 0.35 });
      buildBandedInstancedFromList(group, bandedMeshes, G.convHazard, hzMat, hazardRails, PROP_SPAN_Y);
    }
  }

  // 4. Crown Battlements + Biome Finials / Smokestacks + Summit Brazier + Sea Plinth
  const crownColor = isOrig ? pal.brickA || '#1d4ed8' : spec.crown;
  const crownHi = isOrig ? pal.ledgeTop || '#e0f2fe' : spec.hi;
  const crownMat = createBlockMaterial({
    color: crownColor,
    surface: isOrig ? 'orig_arcade' : spec.surface,
    tile: 0.55,
    roughness: isOrig ? 0.24 : spec.roughness,
    metalness: isOrig ? 0.18 : spec.metalness,
    normalScale: isOrig ? 0.5 : spec.normalScale,
    hi: crownHi,
    angular: false,
    wetStrength: 0,
  });

  const crownMinY = totalH - 0.2;
  const crownMaxY = totalH + 1.8;

  const capRing = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.12, R + 0.04, 0.14, 32),
    crownMat
  );
  capRing.position.y = totalH + 0.07;
  capRing.castShadow = true;
  capRing.receiveShadow = true;
  capRing.userData = { bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 0.5 };
  group.add(capRing);
  bandedMeshes.push(capRing);

  const segA = TWO_PI / MERLONS;
  const parapetGeo = arcSlab(R - 0.12, R + 0.11, segA * 0.98, 0.28, 0.024, 2, 1, 0, R - 0.005);
  const parapetInst = new THREE.InstancedMesh(parapetGeo, crownMat, MERLONS);

  let merlonGeo;
  if (!isOrig && rbTheme === 'foundry') {
    // Riveted industrial smokestack chimneys
    const stack = new THREE.CylinderGeometry(0.11, 0.145, 0.68, 8);
    stack.translate(0, -0.34, R);
    const lip = new THREE.CylinderGeometry(0.155, 0.13, 0.09, 8);
    lip.translate(0, -0.045, R);
    merlonGeo = mergeGeometries([stack, lip]);
  } else if (!isOrig && rbTheme === 'blackout') {
    // Pointed copper lightning-rod finials
    const base = arcSlab(R - 0.1, R + 0.1, segA * 0.46, 0.28, 0.02, 2, 1, 0);
    base.translate(0, -0.36, 0);
    const rod = new THREE.ConeGeometry(0.055, 0.52, 6);
    rod.translate(0, -0.1, R);
    merlonGeo = mergeGeometries([base, rod]);
  } else if (!isOrig && (rbTheme === 'prism' || rbTheme === 'apex')) {
    // Faceted crystal / alien obelisk crown spires
    const spire = new THREE.ConeGeometry(0.14, 0.58, 6);
    spire.translate(0, -0.29, R);
    merlonGeo = spire;
  } else {
    merlonGeo = arcSlab(R - 0.12, R + 0.11, segA * 0.54, 0.34, 0.026, 2, 1, 0.02, R - 0.005);
  }

  const merlonMat =
    !isOrig && rbTheme === 'blackout'
      ? new THREE.MeshStandardMaterial({ color: '#d97736', metalness: 0.88, roughness: 0.22 })
      : crownMat;
  const merlonInst = new THREE.InstancedMesh(merlonGeo, merlonMat, MERLONS);

  for (let b = 0; b < MERLONS; b++) {
    _e.set(0, b * segA, 0);
    _q.setFromEuler(_e);
    _pos.set(0, totalH + 0.14 + 0.28, 0);
    _scl.set(1, 1, 1);
    _m4.compose(_pos, _q, _scl);
    parapetInst.setMatrixAt(b, _m4);

    _pos.set(0, totalH + 0.42 + (rbTheme === 'foundry' ? 0.68 : 0.34), 0);
    _m4.compose(_pos, _q, _scl);
    merlonInst.setMatrixAt(b, _m4);
  }
  parapetInst.receiveShadow = true;
  merlonInst.receiveShadow = true;
  parapetInst.userData = { bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 0.5 };
  merlonInst.userData = { bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 0.5 };
  group.add(parapetInst, merlonInst);
  bandedMeshes.push(parapetInst, merlonInst);

  // Summit Brazier
  const brazierMat = new THREE.MeshStandardMaterial({ color: '#1e2433', metalness: 0.82, roughness: 0.36 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.28, 0.28, 14), brazierMat);
  bowl.position.y = totalH + 0.26;
  bowl.userData = { bandMinY: crownMinY, bandMaxY: crownMaxY, bandMidY: totalH + 0.5 };
  group.add(bowl);
  bandedMeshes.push(bowl);

  const crownFlames = [];
  const glowHex = pal.glow || (spec ? spec.accentGlow : '#38bdf8');
  for (let i = 0; i < 4; i++) {
    const fl = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: T.glowDot,
        color: i % 2 === 0 ? glowHex : '#ffd166',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    fl.position.y = totalH + 0.56;
    group.add(fl);
    crownFlames.push(fl);
  }

  // Recessed Wet Cyclopean Sea-Foundation Sub-Core below y = -0.35 (sits behind real 3D battered surf stones!)
  const plinthMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: isOrig ? pal.brickA || '#1e3a8a' : mortarColor,
      roughness: isOrig ? 0.24 : 0.86,
      metalness: isOrig ? 0.18 : 0.04,
    }),
    0.65
  );
  stoneMats.push(plinthMat);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(isOrig ? R + 0.04 : R - 0.02, isOrig ? R + 0.34 : R + 0.24, 2.2, 24),
    plinthMat
  );
  plinth.position.y = -1.45;
  plinth.receiveShadow = true;
  plinth.userData = { keepInReflection: true, bandMinY: -2.6, bandMaxY: 0.2, bandMidY: -1.1 };
  group.add(plinth);
  bandedMeshes.push(plinth);

  return { coreMat, crownFlames, totalH, mossList, barnacleList };
}

// ============================================================================
// 9. EXTERIOR RUNE-DOOR CLUE STELES (`tower.runeDoors` + `door.clue` + `tower.clue`)
//    Sculpted Carved-Obsidian & Forged-Brass Illuminated Clue Tablets mounted
//    proud (`r = TOWER_RADIUS + 0.45`) directly above every Rune Door (`y = (floor + 1.85) * fh`),
//    auto-shifting `+1` col with a forged-brass cantilever sign-arm ONLY when a ledge/box
//    occupies `door.floor + 1.5..2.5`. Each stele renders in strictly 2 draw calls!
// ============================================================================

let CLUE_FRAME_MAT = null;
function getClueFrameMaterial() {
  if (CLUE_FRAME_MAT) return CLUE_FRAME_MAT;
  CLUE_FRAME_MAT = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.72,
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

function collectTowerClueEntries(tower, isRealOrig = false) {
  if (!tower || isRealOrig) return [];
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
          const pDiff =
            door.puzzleDifficulty ??
            (tower.casual ? 0.3 : Math.min(0.85, 0.25 + ((Number(tower.id) || 1) - 1) * 0.08));
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
  ctx.fillStyle = '#050b16';
  ctx.fillRect(0, 0, W, H);

  if (clue.kind === 'lights') {
    const n = clue.n || 3;
    const pad = 34;
    const inner = W - pad * 2;
    const step = inner / n;
    const gap = n >= 4 ? 10 : 13;

    // Outer forged-brass & cyan rune border
    ctx.strokeStyle = '#d49b2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    ctx.strokeStyle = 'rgba(94, 242, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Subtle North / Back-Wall orientation chevron at top center
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(W * 0.5, 6);
    ctx.lineTo(W * 0.5 + 12, 20);
    ctx.lineTo(W * 0.5 - 12, 20);
    ctx.closePath();
    ctx.fill();

    // Subtle forged-brass grid divider lines
    ctx.strokeStyle = 'rgba(212, 155, 42, 0.35)';
    ctx.lineWidth = 2;
    for (let k = 1; k < n; k++) {
      const p = pad + k * step;
      ctx.beginPath();
      ctx.moveTo(p, pad);
      ctx.lineTo(p, W - pad);
      ctx.moveTo(pad, p);
      ctx.lineTo(W - pad, p);
      ctx.stroke();
    }

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

          ctx.strokeStyle = '#e6ffff';
          ctx.lineWidth = n >= 4 ? 4.5 : 6;
          ctx.strokeRect(x0 + 3, y0 + 3, cs - 6, cs - 6);

          // Bold white etched Runic Diamond + Cross relief
          const dr = cs * 0.29;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = n >= 4 ? 5.5 : 7.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx, cy - dr);
          ctx.lineTo(cx + dr, cy);
          ctx.lineTo(cx, cy + dr);
          ctx.lineTo(cx - dr, cy);
          ctx.closePath();
          ctx.moveTo(cx - dr * 0.52, cy);
          ctx.lineTo(cx + dr * 0.52, cy);
          ctx.moveTo(cx, cy - dr * 0.52);
          ctx.lineTo(cx, cy + dr * 0.52);
          ctx.stroke();
        } else {
          // Deep recessed dark-obsidian socket (#08111f) + clear #2b4a6b border so 3x3 / 4x4 grid counts cleanly!
          ctx.fillStyle = '#08111f';
          ctx.fillRect(x0, y0, cs, cs);
          ctx.strokeStyle = '#03060d';
          ctx.lineWidth = 5;
          ctx.strokeRect(x0 + 2.5, y0 + 2.5, cs - 5, cs - 5);
          ctx.strokeStyle = '#2d4e70';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(x0 + 5, y0 + 5, cs - 10, cs - 10);

          ctx.fillStyle = '#1b334c';
          ctx.beginPath();
          ctx.arc(cx, cy, cs * 0.065, 0, TWO_PI);
          ctx.fill();
        }
      }
    }
    return;
  }

  if (clue.kind === 'bells') {
    const cols = clue.colors?.length ? clue.colors : ['#ff4f64', '#ffb02e', '#3fe07e'];
    const n = Math.max(1, cols.length);
    const crestH = Math.round(H * 0.76); // Top 76% (v = 0.24..1.0) = crest face; Bottom 24% (v = 0.0..0.24) = 3D bell swatches!

    ctx.fillStyle = '#070e1c';
    ctx.fillRect(0, 0, W, crestH);
    ctx.strokeStyle = '#d49b2a';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, crestH - 16);
    ctx.strokeStyle = 'rgba(94, 242, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(19, 19, W - 38, crestH - 34);

    // Subtle Left-to-Right strike-order arrow across top frieze
    ctx.strokeStyle = '#eab308';
    ctx.fillStyle = '#eab308';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(42, 30);
    ctx.lineTo(W - 46, 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - 32, 30);
    ctx.lineTo(W - 50, 22);
    ctx.lineTo(W - 50, 38);
    ctx.closePath();
    ctx.fill();

    const padX = 28;
    const slotW = (W - padX * 2) / n;

    for (let k = 0; k < n; k++) {
      const hex = cols[k] || '#5efce8';
      const cx = padX + slotW * (k + 0.5);

      // 1..N Strike-Order Pip Dots + Crisp Numeral Badge directly above Bell k!
      const pipCount = k + 1;
      const pipSpacing = Math.min(16, (slotW - 18) / Math.max(1, pipCount));
      const pipStart = cx - ((pipCount - 1) * pipSpacing) * 0.5;
      for (let p = 0; p < pipCount; p++) {
        const px = pipStart + p * pipSpacing;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, 56, 5.2, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = hex;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }

      ctx.fillStyle = '#101b30';
      ctx.strokeStyle = hex;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, 88, 17, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), cx, 89);

      // Brass suspension loop tick down to the hanging 3D bell (`y = 108..134`), then clear dark gap (`216..248`) above swallowtail pennant!
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, 108);
      ctx.lineTo(cx, 136);
      ctx.stroke();

      // Compact Heraldic Swallowtail Pennant cleanly separated below the 3D Bell & Clapper!
      const bw = Math.min(44, slotW * 0.44);
      const bx0 = cx - bw * 0.5;
      const by0 = 252;
      const by1 = crestH - 28;
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(bx0 + bw, by0);
      ctx.lineTo(bx0 + bw, by1);
      ctx.lineTo(cx, by1 - 20);
      ctx.lineTo(bx0, by1);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.fillRect(cx - bw * 0.16, by0 + 6, bw * 0.32, Math.max(8, by1 - by0 - 30));
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bottom UV swatch (`y = crestH .. H`, i.e. `v = 0 .. 0.24`) for the 3D protruding bell mesh!
      const sx0 = (k * W) / n;
      const sw = W / n;
      const bGrd = ctx.createLinearGradient(sx0, crestH, sx0 + sw, crestH);
      bGrd.addColorStop(0.0, hex);
      bGrd.addColorStop(0.45, '#ffffff');
      bGrd.addColorStop(0.62, hex);
      bGrd.addColorStop(1.0, hex);
      ctx.fillStyle = bGrd;
      ctx.fillRect(sx0, crestH, sw, H - crestH);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(sx0, crestH, sw, 12);
      ctx.fillRect(sx0, H - 14, sw, 14);
    }
    return;
  }

  // Iconic Medallions for `'beam'` (Prism Beam) and `'blocks'` (Stone Plates) Rune Doors
  ctx.strokeStyle = '#d49b2a';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.strokeStyle = '#5ef2ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, W - 52, H - 52);

  if (clue.kind === 'beam') {
    // Refracting cyan laser zig-zagging off 2 forged-brass prism mirrors into a star crystal!
    ctx.strokeStyle = '#5ef2ff';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(96, 396);
    ctx.lineTo(196, 176);
    ctx.lineTo(344, 316);
    ctx.lineTo(404, 124);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    for (const [mx, my, ang] of [
      [196, 176, 0.55],
      [344, 316, -0.55],
    ]) {
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 4;
      ctx.fillRect(-34, -9, 68, 18);
      ctx.strokeRect(-34, -9, 68, 18);
      ctx.restore();
    }

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#5ef2ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(404, 78);
    ctx.lineTo(436, 124);
    ctx.lineTo(404, 170);
    ctx.lineTo(372, 124);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // `'blocks'`: Carved golden monolith blocks + cyan push arrows -> glowing pressure plates!
    for (const [bx, by, tx, ty] of [
      [104, 138, 318, 138],
      [318, 294, 104, 294],
    ]) {
      ctx.strokeStyle = '#5ef2ff';
      ctx.fillStyle = '#0c233b';
      ctx.lineWidth = 6;
      ctx.fillRect(tx, ty, 88, 88);
      ctx.strokeRect(tx, ty, 88, 88);

      ctx.fillStyle = '#d49b2a';
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 5;
      ctx.fillRect(bx, by, 88, 88);
      ctx.strokeRect(bx, by, 88, 88);

      const xStart = bx < tx ? bx + 104 : bx - 16;
      const xEnd = bx < tx ? tx - 18 : tx + 106;
      const midY = by + 44;
      ctx.strokeStyle = '#67f5ff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(xStart, midY);
      ctx.lineTo(xEnd, midY);
      ctx.stroke();
    }
  }
}

function buildSingleClueStele(entry, fh, ownedTextures) {
  const { clue, colCenter, floorY, colOffset } = entry;
  const g = new THREE.Group();
  const cluePhi = colCenter * COL_ANGLE;
  const clueY = floorY * fh;
  g.rotation.y = cluePhi;
  g.position.y = clueY;

  const steleR = TOWER_RADIUS + 0.45;
  const isBells = clue.kind === 'bells';
  const bellCount = isBells ? Math.max(3, clue.colors?.length || clue.order?.length || 3) : 0;
  const steleW = isBells ? Math.max(1.36, bellCount * 0.31 + 0.22) : clue.kind === 'lights' ? 1.2 : 1.12;
  const steleH = isBells ? 1.08 : clue.kind === 'lights' ? 1.2 : 1.12;

  // Draw Call 1: Merged Vertex-Colored 3D Carved Obsidian Slab + Forged-Brass Frame & Wall Cantilever Brackets!
  const frameParts = [];
  const obsidianHex = '#101829';
  const brassHex = '#e0a628';
  const ironHex = '#232b3d';

  const slab = new RoundedBoxGeometry(steleW, steleH, 0.085, 1, 0.016);
  slab.translate(0, 0, steleR - 0.042);
  frameParts.push(paintGeoVertexColor(slab, obsidianHex));

  const railT = 0.048;
  const railD = 0.105;
  const topRail = new THREE.BoxGeometry(steleW + 0.08, railT, railD);
  topRail.translate(0, steleH * 0.5 + railT * 0.35, steleR - 0.025);
  const botRail = new THREE.BoxGeometry(steleW + 0.08, railT, railD);
  botRail.translate(0, -steleH * 0.5 - railT * 0.35, steleR - 0.025);
  const leftRail = new THREE.BoxGeometry(railT, steleH + 0.04, railD);
  leftRail.translate(-steleW * 0.5 - railT * 0.35, 0, steleR - 0.025);
  const rightRail = new THREE.BoxGeometry(railT, steleH + 0.04, railD);
  rightRail.translate(steleW * 0.5 + railT * 0.35, 0, steleR - 0.025);
  const pediment = new THREE.ConeGeometry(0.16, 0.13, 4);
  pediment.rotateY(Math.PI * 0.25);
  pediment.scale(1.8, 1, 0.55);
  pediment.translate(0, steleH * 0.5 + 0.095, steleR - 0.015);
  frameParts.push(
    paintGeoVertexColor(topRail, brassHex),
    paintGeoVertexColor(botRail, brassHex),
    paintGeoVertexColor(leftRail, brassHex),
    paintGeoVertexColor(rightRail, brassHex),
    paintGeoVertexColor(pediment, brassHex)
  );

  // Twin heavy wall-anchor cantilever arms from masonry wall (`TOWER_RADIUS - 0.04`) out to `steleR - 0.05`
  const armLen = steleR - TOWER_RADIUS + 0.02;
  const armMidZ = (TOWER_RADIUS - 0.03 + steleR - 0.05) * 0.5;
  for (const sx of [-steleW * 0.34, steleW * 0.34]) {
    const arm = new THREE.BoxGeometry(0.065, 0.075, armLen);
    arm.translate(sx, steleH * 0.28, armMidZ);
    const strut = new THREE.BoxGeometry(0.05, 0.055, armLen * 1.08);
    strut.rotateX(0.46);
    strut.translate(sx, -steleH * 0.16, armMidZ);
    frameParts.push(paintGeoVertexColor(arm, ironHex), paintGeoVertexColor(strut, brassHex));
  }

  // If shifted beside a blocking upper ledge (`colOffset !== 0`), connect back toward the Rune Door arch with a brass sign-arm!
  if (colOffset !== 0) {
    const reachX = -Math.sign(colOffset) * Math.min(1.35, Math.abs(colOffset) * (TOWER_RADIUS + 0.32) * COL_ANGLE * 0.82);
    const hArm = new THREE.BoxGeometry(Math.abs(reachX), 0.055, 0.06);
    hArm.translate(reachX * 0.5, -steleH * 0.38, steleR - 0.06);
    const dBrace = new THREE.BoxGeometry(Math.abs(reachX) * 0.82, 0.042, 0.048);
    dBrace.rotateZ(Math.sign(reachX) * 0.42);
    dBrace.translate(reachX * 0.45, -steleH * 0.56, steleR - 0.08);
    frameParts.push(paintGeoVertexColor(hArm, brassHex), paintGeoVertexColor(dBrace, brassHex));
  }

  if (isBells) {
    const rod = new THREE.CylinderGeometry(0.022, 0.022, steleW * 0.92, 8);
    rod.rotateZ(Math.PI * 0.5);
    rod.translate(0, 0.155, steleR + 0.058);
    frameParts.push(paintGeoVertexColor(rod, brassHex));
  }

  const frameMesh = new THREE.Mesh(mergeGeometries(frameParts), getClueFrameMaterial());
  g.add(frameMesh);

  // Draw Call 2: Sculpted 3D Protruding Rune/Bell Relief + High-DPI 512x512 Unlit Emissive Stele Face!
  const steleTex = createClueSteleCanvasTex(clue, ownedTextures);
  const faceParts = [];
  const faceW = steleW - 0.04;
  const faceH = steleH - 0.04;

  if (isBells) {
    // Crest backing plane mapped to top 76% (`v = 0.24..1.0`) of `steleTex`
    const backing = remapGeoUvRect(new THREE.PlaneGeometry(faceW, faceH), 0, 0.24, 1, 1);
    backing.translate(0, 0, steleR + 0.004);
    faceParts.push(backing);

    // 3D Flared Miniature Colored Bells (true flared bell lip + shoulder dome + hanging golden clapper) in strict Left-to-Right strike order!
    const bellProf = [
      new THREE.Vector2(0.0, -0.095),
      new THREE.Vector2(0.108, -0.095),
      new THREE.Vector2(0.114, -0.072),
      new THREE.Vector2(0.078, -0.025),
      new THREE.Vector2(0.062, 0.045),
      new THREE.Vector2(0.044, 0.082),
      new THREE.Vector2(0.0, 0.092),
    ];
    const padFrac = 28 / 512;
    const usableW = faceW * (1 - padFrac * 2);
    const slotW = usableW / bellCount;
    for (let k = 0; k < bellCount; k++) {
      const bx = -usableW * 0.5 + slotW * (k + 0.5);
      const u0 = (k + 0.08) / bellCount;
      const u1 = (k + 0.92) / bellCount;

      const bellBody = remapGeoUvRect(new THREE.LatheGeometry(bellProf, 12), u0, 0.01, u1, 0.23);
      bellBody.translate(bx, 0.065, steleR + 0.066);
      const shackle = remapGeoUvRect(new THREE.TorusGeometry(0.022, 0.007, 5, 10), u0, 0.005, u1, 0.02);
      shackle.translate(bx, 0.162, steleR + 0.064);
      const clapper = remapGeoUvRect(new THREE.SphereGeometry(0.026, 7, 5), u0, 0.005, u1, 0.02);
      clapper.translate(bx, -0.045, steleR + 0.068);
      faceParts.push(bellBody, shackle, clapper);
    }
  } else {
    const backing = new THREE.PlaneGeometry(faceW, faceH);
    backing.translate(0, 0, steleR + 0.004);
    faceParts.push(backing);

    if (clue.kind === 'lights' && clue.n && Array.isArray(clue.pattern)) {
      // Extrude every LIT rune cell (`pattern[r * n + c] === 1`) +3.2cm forward in real 3D!
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
          const raised = remapGeoUvRect(new THREE.BoxGeometry(cellW, cellH, 0.032), u0, vBot, u1, vTop);
          raised.translate(cx, cy, steleR + 0.02);
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
  const faceMesh = new THREE.Mesh(mergeGeometries(faceParts), faceMat);
  g.add(faceMesh);

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

function buildAllTowerClueSteles(tower, fh, isRealOrig, group, cullableNodes, ownedTextures) {
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
        if (o.material && o.material.map && !o.material.map.userData?.shared) {
          o.material.map.dispose();
        }
      });
    }
    for (let i = cullableNodes.length - 1; i >= 0; i--) {
      if (cullableNodes[i].isClueStele) cullableNodes.splice(i, 1);
    }

    const entries = collectTowerClueEntries(liveTower, isRealOrig);
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
      // Hot-sync if `game.js` / `levels.js` attached or mutated `door.clue` / `tower.clue` after build!
      if (liveTower && (liveTower.clue || liveTower.runeDoors || liveTower.doors)) {
        const checkEntries = collectTowerClueEntries(liveTower, isRealOrig);
        const nextSig = computeClueEntriesSignature(checkEntries);
        if (nextSig !== activeSig) {
          rebuildFromTower(liveTower);
        }
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
          b.faceMat.color.setRGB(0.76, 0.96, 0.86);
        } else {
          const pulse = 0.94 + 0.06 * Math.sin(t * 2.8 + i);
          b.faceMat.color.setScalar(pulse);
        }
      }
    },
  };
}

// ============================================================================
// 10. INTERACTIVE STATIONS: SWITCHES, TINKER WORKBENCH & TREASURE CHEST
// ============================================================================

export function buildSwitchMesh(mode = 'toggle') {
  const g = new THREE.Group();
  const G = getSharedArchGeometries();
  const ironMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.78, roughness: 0.32 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.22 });

  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.18, 10), ironMat);
  ped.position.y = 0.09;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 16), brassMat);
  collar.rotation.x = Math.PI * 0.5;
  collar.position.y = 0.18;
  g.add(ped, collar);

  const orbMat = new THREE.MeshStandardMaterial({
    color: '#fb7185',
    emissive: '#e11d48',
    emissiveIntensity: 1.15,
    roughness: 0.14,
  });

  let wheel = null;
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.145, 0), orbMat);
  orb.position.y = 0.32;
  g.add(orb);

  if (mode === 'drainValve') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), brassMat);
    stem.position.set(0, 0.24, 0.08);
    stem.rotation.x = Math.PI * 0.35;
    wheel = new THREE.Mesh(G.valveWheel, brassMat);
    wheel.position.set(0, 0.31, 0.14);
    wheel.scale.setScalar(1.35);
    g.add(stem, wheel);
  }

  g.userData = { orb, orbMat, wheel, mode };
  return g;
}

export function buildWorkbenchMesh() {
  const g = new THREE.Group();
  const T = getDetailTextures();
  const timberMat = new THREE.MeshStandardMaterial({ color: '#6b4429', roughness: 0.72, metalness: 0.1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: '#242938', roughness: 0.4, metalness: 0.8 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.22, metalness: 0.88 });

  const top = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.075, 0.45, 1, 0.012), timberMat);
  top.position.y = 0.36;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const legGeo = new THREE.BoxGeometry(0.058, 0.35, 0.058);
  for (const lx of [-0.32, 0.32]) {
    for (const lz of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(legGeo, ironMat);
      leg.position.set(lx, 0.175, lz);
      g.add(leg);
    }
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.05), ironMat);
  crossbar.position.set(0, 0.12, 0);
  g.add(crossbar);

  // Horned Cast-Iron Tinker Anvil
  const anvilBase = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.11, 0.12, 1, 0.014), ironMat);
  anvilBase.position.set(-0.21, 0.45, 0.04);
  const anvilHorn = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.13, 8), ironMat);
  anvilHorn.rotation.z = Math.PI * 0.5;
  anvilHorn.position.set(-0.33, 0.46, 0.04);
  g.add(anvilBase, anvilHorn);

  // Glowing Cyan Blueprint Scroll + Brass Gooseneck Lamp
  const blueprint = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.19),
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#06b6d4',
      emissiveIntensity: 1.15,
      roughness: 0.25,
    })
  );
  blueprint.rotation.x = -Math.PI * 0.5;
  blueprint.position.set(0.16, 0.402, 0.03);
  g.add(blueprint);

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.3, 8), brassMat);
  lampStem.position.set(0.28, 0.54, -0.1);
  const lampArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), brassMat);
  lampArm.position.set(0.22, 0.68, -0.05);
  lampArm.rotation.z = -0.22;
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.095, 10), brassMat);
  lampShade.position.set(0.16, 0.64, -0.01);
  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#fef08a' })
  );
  lampBulb.position.set(0.16, 0.6, -0.01);
  const lampGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: T.glowDot,
      color: '#5efce8',
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  lampGlow.scale.set(0.85, 0.75, 1);
  lampGlow.position.set(0.06, 0.56, 0.04);
  g.add(lampStem, lampArm, lampShade, lampBulb, lampGlow);

  // Holographic Dynamo Ghost -> Crafted Spinning Golden-Emerald Dynamo
  const dynamoGroup = new THREE.Group();
  dynamoGroup.position.set(-0.01, 0.54, 0.02);
  const holoMat = new THREE.MeshBasicMaterial({
    color: '#5efce8',
    wireframe: true,
    transparent: true,
    opacity: 0.52,
  });
  const holoGhost = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), holoMat);

  const craftedGroup = new THREE.Group();
  craftedGroup.visible = false;
  const dynamoCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.13, 0),
    new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#10b981',
      emissiveIntensity: 1.35,
      roughness: 0.12,
    })
  );
  const dynamoCoil = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 8, 20), brassMat);
  craftedGroup.add(dynamoCore, dynamoCoil);

  dynamoGroup.add(holoGhost, craftedGroup);
  g.add(dynamoGroup);
  g.userData = { dynamoGroup, holoGhost, holoMat, craftedGroup, dynamoCoil, lampGlow };
  return g;
}

export function buildTreasureChestMesh() {
  const g = new THREE.Group();
  const T = getDetailTextures();
  const oakMat = new THREE.MeshStandardMaterial({ color: '#5c3419', roughness: 0.66, metalness: 0.14 });
  const bandMat = new THREE.MeshStandardMaterial({ color: '#262e42', roughness: 0.36, metalness: 0.82 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#fde047',
    emissive: '#d97706',
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.88,
  });

  const box = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.25, 0.38, 1, 0.014), oakMat);
  box.position.y = 0.125;
  box.castShadow = true;
  box.receiveShadow = true;
  g.add(box);

  for (const bx of [-0.21, 0, 0.21]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.265, 0.4), bandMat);
    strap.position.set(bx, 0.128, 0);
    g.add(strap);
  }
  const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.032), goldMat);
  lockPlate.position.set(0, 0.19, 0.195);
  g.add(lockPlate);

  const hoardGroup = new THREE.Group();
  hoardGroup.position.y = 0.24;
  const goldPile = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#f59e0b',
      emissiveIntensity: 1.1,
      metalness: 0.78,
      roughness: 0.16,
    })
  );
  goldPile.scale.set(1.15, 0.36, 0.72);
  const cyanGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.065, 0),
    new THREE.MeshBasicMaterial({ color: '#5efce8' })
  );
  cyanGem.position.set(-0.09, 0.07, 0.03);
  const emeraldGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.06, 0),
    new THREE.MeshBasicMaterial({ color: '#34d399' })
  );
  emeraldGem.position.set(0.1, 0.065, -0.02);
  hoardGroup.add(goldPile, cyanGem, emeraldGem);
  g.add(hoardGroup);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.25, -0.19);
  const lidGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.58, 12, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI * 0.5);
  const lidWood = new THREE.Mesh(lidGeo, oakMat);
  lidWood.position.set(0, 0, 0.19);
  lidPivot.add(lidWood);

  for (const bx of [-0.21, 0, 0.21]) {
    const lidBandGeo = new THREE.CylinderGeometry(0.202, 0.202, 0.06, 12, 1, false, 0, Math.PI);
    lidBandGeo.rotateZ(Math.PI * 0.5);
    const lidBand = new THREE.Mesh(lidBandGeo, bx === 0 ? goldMat : bandMat);
    lidBand.position.set(bx, 0, 0.19);
    lidPivot.add(lidBand);
  }
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
  treasureGlow.scale.set(1.25, 1.15, 1);
  treasureGlow.position.set(0, 0.42, 0.04);
  g.add(treasureGlow);

  g.userData = { lidPivot, hoardGroup, treasureGlow, openLerp: 0 };
  return g;
}

// ============================================================================
// 11. MAIN BUILDER: `buildDetailedTowerGroup(tower, era, glbAssets)`
// ============================================================================

export function buildDetailedTowerGroup(tower, era = 'reboot', glbAssets = {}) {
  const isOrig = era === 'original';
  const isRealOrig = Boolean(isOrig && tower?.real);
  const fh = getTowerStepHeight(tower, isOrig, glbAssets?.fh);
  const rbTheme = isOrig ? 'classic' : resolveRebootTheme(tower);
  const spec = isOrig ? null : REBOOT_BIOME_SPECS[rbTheme] || REBOOT_BIOME_SPECS.mist;
  const pal = tower?.palette || {};

  const R = TOWER_RADIUS;
  const group = new THREE.Group();
  const G = getSharedArchGeometries();
  const T = getDetailTextures();
  const stoneMats = [];

  const corbelGlb = glbAssets?.corbel_ledge || glbAssets?.corbelLedge || null;
  const cageLiftGlb = glbAssets?.cage_elevator || glbAssets?.cageElevator || null;

  // Mark shared external GLB geometries, materials & textures so disposeTowerArchitecture() never frees them!
  const markSharedSubtree = (rootObj) => {
    if (!rootObj) return;
    rootObj.traverse((o) => {
      if (o.geometry) {
        o.geometry.userData = o.geometry.userData || {};
        o.geometry.userData.shared = true;
      }
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (!m) continue;
        m.userData = m.userData || {};
        m.userData.shared = true;
        for (const tk of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
          if (m[tk]) {
            m[tk].userData = m[tk].userData || {};
            m[tk].userData.shared = true;
          }
        }
      }
    });
  };
  markSharedSubtree(corbelGlb);
  markSharedSubtree(cageLiftGlb);

  // Compute 3D doorway openings & recessed elevator shaft channels BEFORE laying masonry!
  const doorH = isRealOrig ? 2.78 * fh : 0.88;
  const halfDoorAngle = (DOOR_W * 0.5) / (R + BRICK_PROUD);
  const holes = (tower?.doors || []).map((d) => ({
    a: (d.col + 0.5) * COL_ANGLE,
    w: halfDoorAngle,
    y0: d.floor * fh + 0.01,
    y1: d.floor * fh + doorH - 0.01,
  }));

  const shafts = !isOrig
    ? (tower?.elevators || []).map((el) => ({
        a: (el.col + 0.5) * COL_ANGLE,
        w: COL_ANGLE * 0.44,
        y0: el.minFloor * fh - 0.15,
        y1: (el.maxFloor + 1.35) * fh,
      }))
    : [];

  // 1. Build 3D InstancedMesh Masonry Wall, Biome Extruded Accents, Crown & Plinth (Partitioned into Vertical Row Bands!)
  const bandedMeshes = [];
  const bandSpanY = isRealOrig ? 15 * fh : 7 * fh;
  const cullableNodes = [];
  const totalH = (tower?.floors || 18) * fh;
  const initialClueEntries = collectTowerClueEntries(tower, isRealOrig);
  const pipeAvoidHoles = holes.concat(
    initialClueEntries.map((ce) => ({
      a: ce.colCenter * COL_ANGLE,
      w: COL_ANGLE * 0.65,
      y0: (ce.floorY - 0.72) * fh,
      y1: (ce.floorY + 0.72) * fh,
    }))
  );
  const wallAoTex = buildWallAoLightTexture(tower, fh, totalH, isOrig, initialClueEntries);
  const ownedTextures = wallAoTex && !wallAoTex.userData?.shared ? [wallAoTex] : [];

  const bodyInfo = buildTowerMasonryAndAccents(
    group,
    tower,
    era,
    rbTheme,
    fh,
    isRealOrig,
    holes,
    shafts,
    stoneMats,
    bandedMeshes,
    bandSpanY,
    wallAoTex,
    pipeAvoidHoles
  );

  // 2. Exterior Rune-Door Clue Steles (`tower.runeDoors`, `door.clue` & `tower.clue` above every Rune Door!)
  const builtClues = buildAllTowerClueSteles(tower, fh, isRealOrig, group, cullableNodes, ownedTextures);
  const clueUpdater = builtClues.update;

  // 3. Doors: Thick Ashlar Lintels/Jambs, Soft Mist-Lit Passages, Protruding Barrel `sparkArch` w/ 90° Manifold Pipes
  const mistSprites = [];
  const sparkEmitters = [];
  const sparkInstancers = [];
  const exitRings = [];
  const runeDoors = [];
  const portalMats = [];
  const forgeLights = [];

  const useExternalVfx = Boolean(glbAssets?.useOceanVfx);
  const ashlarInstances = [];
  const doorMossBatch = [];
  const doorBarnacleBatch = [];
  const portalBuckets = new Map();
  const staticDarkIronParts = [];
  const staticIronRibParts = [];
  const staticEmberSillParts = [];
  const staticAshlarCanopyParts = [];
  const staticHaloParts = [];

  const ashlarMat = createBlockMaterial({
    color: isOrig ? pal.ledge || '#60a5fa' : spec.ledgeBody || '#464e63',
    surface: isOrig ? 'orig_arcade' : spec.surface === 'foundry_iron' ? 'foundry_iron' : 'mist_slate',
    tile: 0.58,
    roughness: isOrig ? 0.24 : 0.76,
    metalness: isOrig ? 0.18 : Math.min(0.28, spec.metalness),
    normalScale: isOrig ? 0.4 : 1.15,
    hi: isOrig ? '#ffffff' : spec.hi,
    angular: false,
    wetStrength: 0.86,
    wallAoTex,
    totalH,
  });
  stoneMats.push(ashlarMat);

  const darkIronMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: '#202430',
      roughness: 0.44,
      metalness: 0.84,
    }),
    0.75
  );
  const ironRibMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: !isOrig ? spec.pipeColor : '#334155',
      roughness: 0.4,
      metalness: 0.84,
    }),
    0.7
  );
  stoneMats.push(darkIronMat, ironRibMat);

  const sharedMistMat =
    !isOrig && !useExternalVfx
      ? new THREE.SpriteMaterial({
          map: T.mist,
          color: '#dbeafe',
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        })
      : null;

  let sparkPointLightAssigned = false;

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
    const isSparkArch =
      !isOrig && door.tunnelStyle === 'sparkArch' && !isExitDoor && !isVaultDoor && !isRuneDoor;
    const isMistStoneDoor =
      !isOrig && !isSparkArch && !isRuneDoor && !isVaultDoor && !isExitDoor;
    const doorCenterY = door.floor * fh + doorH * 0.5;

    // Atmospheric mist-lit stone passage for Reboot stone doors vs arcane/fiery vortex for special portals!
    const pGlow = isExitDoor && !isRealOrig
      ? '#ffb020'
      : isRuneDoor
      ? '#2dd4bf'
      : isVaultDoor
      ? '#c084fc'
      : isSparkArch
      ? '#ff6b18'
      : isOrig
      ? pal.glow || '#38bdf8'
      : '#050912';
    const pGlow2 = isExitDoor && !isRealOrig
      ? '#fff3b0'
      : isRuneDoor
      ? '#99f6e4'
      : isVaultDoor
      ? '#fde047'
      : isSparkArch
      ? '#ffd166'
      : isOrig
      ? '#bae6fd'
      : '#395b78';
    const pKey = `${pGlow}_${pGlow2}_${isMistStoneDoor ? 'M' : 'V'}`;
    let pBucket = portalBuckets.get(pKey);
    if (!pBucket) {
      pBucket = { pGlow, pGlow2, isMist: isMistStoneDoor, parts: [] };
      portalBuckets.set(pKey, pBucket);
    }
    const pQuad = new THREE.PlaneGeometry(DOOR_W * 0.96, doorH * 0.98);
    pQuad.translate(0, 0, isMistStoneDoor ? -0.012 : isSparkArch ? 0.04 : -0.018);
    pBucket.parts.push(transformDoorGeo(pQuad, phi, doorCenterY));

    const needsDoorGroup =
      isRuneDoor || isVaultDoor || (isExitDoor && !isRealOrig) || (!useExternalVfx && !isRealOrig && !isOrig);
    const dg = needsDoorGroup ? new THREE.Group() : null;
    if (dg) {
      dg.position.set(R * Math.sin(phi), doorCenterY, R * Math.cos(phi));
      dg.rotation.y = phi;
    }

    if (isSparkArch) {
      sparkEmitters.push({ col: door.col, floor: door.floor, y: door.floor * fh, ang: phi });

      // Protruding Barrel-Vaulted Riveted Stone-and-Iron Furnace Pipe Tunnel (front mouth at R + 0.43m, 1:1 w/ oceanVfx!)
      const archRad = 0.41;
      const archDepth = 0.48;
      const archMidZ = 0.19;
      const legH = Math.max(0.28, doorH * 0.56);

      const vaultGeo = new THREE.CylinderGeometry(archRad, archRad, archDepth, 12, 1, false, 0, Math.PI);
      vaultGeo.rotateZ(Math.PI * 0.5);
      vaultGeo.rotateY(Math.PI * 0.5);
      vaultGeo.translate(0, 0.04, archMidZ);
      const wallL = new THREE.BoxGeometry(0.105, legH, archDepth);
      wallL.translate(-archRad + 0.035, -doorH * 0.5 + legH * 0.5, archMidZ);
      const wallR = new THREE.BoxGeometry(0.105, legH, archDepth);
      wallR.translate(archRad - 0.035, -doorH * 0.5 + legH * 0.5, archMidZ);
      staticDarkIronParts.push(
        transformDoorGeo(vaultGeo, phi, doorCenterY),
        transformDoorGeo(wallL, phi, doorCenterY),
        transformDoorGeo(wallR, phi, doorCenterY)
      );

      // 3 Heavy riveted barrel-vault ribs + twin 90°-elbow flanged cast-iron manifold pipes plunging into walkway!
      for (const rz of [0.06, 0.23, 0.40]) {
        const rib = new THREE.TorusGeometry(archRad + 0.016, 0.035, 6, 12, Math.PI);
        rib.translate(0, 0.04, rz);
        staticIronRibParts.push(transformDoorGeo(rib, phi, doorCenterY));
      }
      for (const [mIdx, mx, mz] of [
        [0, archRad + 0.11, 0.21],
        [1, archRad + 0.20, 0.14],
      ]) {
        const pH = mIdx === 0 ? 0.36 : 0.46;
        const vertP = new THREE.CylinderGeometry(0.042, 0.042, pH, 7);
        vertP.translate(mx, -doorH * 0.5 + pH * 0.5, mz);
        const horizP = new THREE.CylinderGeometry(0.04, 0.04, 0.16, 7);
        horizP.rotateZ(Math.PI * 0.5);
        horizP.translate(mx - 0.07, -doorH * 0.5 + pH, mz);
        const flg = new THREE.CylinderGeometry(0.074, 0.074, 0.05, 8);
        flg.translate(mx, -doorH * 0.5 + pH * 0.62, mz);
        staticIronRibParts.push(
          transformDoorGeo(vertP, phi, doorCenterY),
          transformDoorGeo(horizP, phi, doorCenterY),
          transformDoorGeo(flg, phi, doorCenterY)
        );
      }

      // Draped dark-green moss over the protruding barrel roof (exact match to photo lower-left!)
      if (rbTheme === 'mist' || rbTheme === 'sinking') {
        const mx = Math.sin(phi) * (R + 0.24) - Math.cos(phi) * 0.12;
        const mz = Math.cos(phi) * (R + 0.24) + Math.sin(phi) * 0.12;
        pushInstance(doorMossBatch, mx, doorCenterY + archRad + 0.045, mz, 0.18, phi, -0.22, 1.3, 0.65, 1.35, '#223f1c');
      }

      const sillGeo = new THREE.BoxGeometry(0.66, 0.055, archDepth * 0.88);
      sillGeo.translate(0, -doorH * 0.5 + 0.03, archMidZ + 0.02);
      const throatGrate = new THREE.BoxGeometry(0.64, 0.42, 0.04);
      throatGrate.translate(0, -doorH * 0.18, 0.01);
      staticEmberSillParts.push(
        transformDoorGeo(sillGeo, phi, doorCenterY),
        transformDoorGeo(throatGrate, phi, doorCenterY)
      );

      if (!useExternalVfx && dg) {
        if (!sparkPointLightAssigned) {
          sparkPointLightAssigned = true;
          const forgeLight = new THREE.PointLight('#ff8524', 1.25, 3.8);
          forgeLight.position.set(0, -doorH * 0.18, 0.36);
          dg.add(forgeLight);
          forgeLights.push(forgeLight);
        }

        const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const sparkInst = new THREE.InstancedMesh(G.sparkCube, sparkMat, 14);
        sparkInst.frustumCulled = false;
        const sparkMeta = [];
        const cHot = new THREE.Color('#fff5b8');
        const cAmb = new THREE.Color('#ff9824');
        for (let s = 0; s < 14; s++) {
          sparkInst.setColorAt(s, s % 3 === 0 ? cHot : cAmb);
          sparkMeta.push({
            vx: (((s * 37) % 100) / 100 - 0.5) * 0.82,
            vy: 0.25 + (((s * 61) % 100) / 100) * 0.78,
            vz: 0.42 + (((s * 83) % 100) / 100) * 0.65,
            phase: s / 14,
            floorLocalY: -doorH * 0.5 + 0.035,
          });
        }
        if (sparkInst.instanceColor) sparkInst.instanceColor.needsUpdate = true;
        dg.add(sparkInst);
        sparkInstancers.push({ inst: sparkInst, meta: sparkMeta });
      }
    } else if (!isRealOrig) {
      // Thick Weathered Storm-Grey Ashlar Stone Jambs (deep 3D tunnel reveals!) + Monolithic Horizontal Lintel Beam!
      const hScale = doorH / 0.88;
      const taperOff = !isOrig ? -0.048 * Math.min(1, doorCenterY / Math.max(10, totalH)) : 0;
      const ashlarTints = ['#dce4f2', '#c8d2e4', '#eef3fa', '#bfc9dc'];
      let ashIdx = 0;
      const toWorldAshlar = (lx, ly, lz, sx, sy, sz) => {
        const wx = Math.sin(phi) * (R + lz + taperOff) + Math.cos(phi) * lx;
        const wz = Math.cos(phi) * (R + lz + taperOff) - Math.sin(phi) * lx;
        const tint = !isOrig ? ashlarTints[ashIdx++ % ashlarTints.length] : null;
        pushInstance(ashlarInstances, wx, doorCenterY + ly, wz, 0, phi, 0, sx, sy, sz, tint);
      };

      // 4 chunky weathered jamb blocks per side extending deep into the recessed stone doorway throat!
      for (let q = 0; q < 4; q++) {
        const qw = q % 2 === 0 ? 0.195 : 0.165;
        const qy = (-0.31 + q * 0.208) * hScale;
        toWorldAshlar(-0.415 - (qw - 0.165) * 0.35, qy, 0.015, qw, 0.195 * hScale, 0.30);
        toWorldAshlar(0.415 + (qw - 0.165) * 0.35, qy, 0.015, qw, 0.195 * hScale, 0.30);
      }
      // Heavy monolithic weathered horizontal stone lintel beam + recessed soffit + worn threshold sill!
      toWorldAshlar(0, doorH * 0.5 + 0.088, 0.028, 1.06, 0.185, 0.32);
      toWorldAshlar(0, -doorH * 0.5 + 0.024, 0.025, 0.94, 0.062, 0.30);

      // Low-profile crusty coastal barnacles & damp moss right beside lower doorways (matches photo center-left!)
      if (!isOrig && (rbTheme === 'mist' || rbTheme === 'sinking') && door.floor <= 3) {
        for (const [bxOff, byOff, sc, bHex] of [
          [-0.62, -doorH * 0.34, 1.15, '#485053'],
          [-0.57, -doorH * 0.14, 0.92, '#3f474a'],
          [-0.66, -doorH * 0.42, 1.02, '#50585b'],
        ]) {
          const bwx = Math.sin(phi) * (R + BRICK_PROUD + 0.01) + Math.cos(phi) * bxOff;
          const bwz = Math.cos(phi) * (R + BRICK_PROUD + 0.01) - Math.sin(phi) * bxOff;
          pushInstance(doorBarnacleBatch, bwx, doorCenterY + byOff, bwz, 0, phi, bxOff * 2.1, sc, sc, sc * 0.85, bHex);
        }
        const mwx = Math.sin(phi) * (R + BRICK_PROUD + 0.012) + Math.cos(phi) * 0.58;
        const mwz = Math.cos(phi) * (R + BRICK_PROUD + 0.012) - Math.sin(phi) * 0.58;
        pushInstance(doorMossBatch, mwx, doorCenterY + doorH * 0.45, mwz, 0.18, phi, 0.12, 0.9, 1.15, 0.72, '#213c1b');
      }

      if (!isOrig && !useExternalVfx && dg && sharedMistMat) {
        const mist = new THREE.Sprite(sharedMistMat);
        mist.scale.set(1.08, 0.76, 1);
        const baseX = 0;
        const baseY = -doorH * 0.2;
        mist.position.set(baseX, baseY, 0.2);
        dg.add(mist);
        mistSprites.push({ sprite: mist, phase: door.col * 0.8, baseX, baseY });
      }
    }

    // Special Doorway Crowns & Glyphs: Rune Sanctum, Astrolabe Vault & Summit Exit
    if (isRuneDoor && dg) {
      const ringMat = new THREE.MeshStandardMaterial({
        color: '#5efce8',
        emissive: '#14b8a6',
        emissiveIntensity: 1.45,
        roughness: 0.2,
      });
      const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.032, 6, 20), ringMat);
      ringMesh.position.set(0, 0.04, 0.12);

      const gemMat = new THREE.MeshStandardMaterial({
        color: '#5efce8',
        emissive: '#0d9488',
        emissiveIntensity: 1.55,
        roughness: 0.14,
      });
      const keystoneGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.078, 0), gemMat);
      keystoneGem.position.set(0, doorH * 0.5 + 0.09, 0.22);

      const sigilMat = new THREE.MeshBasicMaterial({
        map: T.runeSigil,
        color: '#5efce8',
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sigilMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), sigilMat);
      sigilMesh.position.set(0, 0.04, 0.138);

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
    } else if (isVaultDoor && dg) {
      const goldLockMat = new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#d97706',
        emissiveIntensity: 1.25,
        metalness: 0.88,
        roughness: 0.18,
      });
      const violetLockMat = new THREE.MeshStandardMaterial({
        color: '#c084fc',
        emissive: '#9333ea',
        emissiveIntensity: 1.15,
        metalness: 0.65,
        roughness: 0.22,
      });
      const outerLock = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.034, 6, 20), goldLockMat);
      outerLock.position.set(0, 0.03, 0.13);
      const innerLock = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.026, 6, 16), violetLockMat);
      innerLock.position.set(0, 0.03, 0.145);
      dg.add(outerLock, innerLock);
      exitRings.push(outerLock, innerLock);
    } else if (isExitDoor && !isRealOrig && dg) {
      // Gilded Summit Crown + Halo Ring + Upward Beacon Shaft (5 tines merged into 1 draw call!)
      const goldCrownMat = new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#f59e0b',
        emissiveIntensity: 1.4,
        metalness: 0.9,
        roughness: 0.18,
      });
      const exitHalo = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 6, 20), goldCrownMat);
      exitHalo.rotation.x = Math.PI * 0.5;
      exitHalo.position.set(0, doorH * 0.5 + 0.36, 0.14);

      const crownGrp = new THREE.Group();
      crownGrp.position.set(0, doorH * 0.5 + 0.36, 0.14);
      crownGrp.add(new THREE.Mesh(G.exitCrownTines, goldCrownMat));

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.34, 3.0, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#fde68a',
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      beam.position.set(0, doorH * 0.5 + 1.55, 0.12);
      dg.add(exitHalo, crownGrp, beam);
      exitRings.push(crownGrp);
    }

    if (dg) {
      group.add(dg);
      cullableNodes.push({ node: dg, phi, y: doorCenterY });
    }
  }

  for (const bucket of portalBuckets.values()) {
    const pMat = createPortalMaterial(bucket.pGlow, bucket.pGlow2, doorH / DOOR_W, bucket.isMist);
    portalMats.push(pMat);
    const mergedPortals = new THREE.Mesh(mergeGeometries(bucket.parts), pMat);
    group.add(mergedPortals);
  }

  if (staticEmberSillParts.length) {
    const emberSillMat = new THREE.MeshStandardMaterial({
      color: '#3b1506',
      emissive: '#ff7b1c',
      emissiveIntensity: 1.75,
      roughness: 0.55,
    });
    group.add(new THREE.Mesh(mergeGeometries(staticEmberSillParts), emberSillMat));
  }

  // 4. Elevators: Recessed Stone Shaft Reveal Pilasters + Sculpted Semicircular Stone Hood + #ffaa33 Golden Halo + Cage Lift
  const elevatorPods = [];
  const cableMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.88, roughness: 0.18 });
  const brassCageMat = new THREE.MeshStandardMaterial({ color: '#b88438', metalness: 0.86, roughness: 0.26 });
  const sharedHaloMat = new THREE.MeshStandardMaterial({
    color: '#ffbe55',
    emissive: '#ff9e1b',
    emissiveIntensity: 2.45,
    roughness: 0.12,
  });
  const origFootMat = isOrig
    ? new THREE.MeshStandardMaterial({
        color: pal.ledge || '#60a5fa',
        roughness: 0.26,
        metalness: 0.2,
      })
    : null;
  const origCapMat = isOrig
    ? new THREE.MeshStandardMaterial({
        color: pal.ledgeTop || '#e0f2fe',
        emissive: pal.glow || '#38bdf8',
        emissiveIntensity: 0.28,
        roughness: 0.2,
        metalness: 0.24,
      })
    : null;
  const origLiftTrackParts = [];
  let cagePointLightAssigned = false;

  for (const el of tower?.elevators || []) {
    const phi = (el.col + 0.5) * COL_ANGLE;
    const liftR = isOrig ? R + 0.38 : R + 0.33;

    if (isOrig) {
      const baseFootY = el.minFloor * fh - (isRealOrig ? 0.65 * fh : 0.18) - 0.1;

      const baseDiscG = G.liftBase.clone();
      baseDiscG.userData = {};
      baseDiscG.translate(0, baseFootY, liftR);
      baseDiscG.rotateY(phi);
      const bracketG = arcSlab(R - 0.03, liftR + 0.04, COL_ANGLE * 0.34, 0.14, 0.018, 2, 1, 0.018, R - 0.005);
      bracketG.translate(0, baseFootY, 0);
      bracketG.rotateY(phi);
      origLiftTrackParts.push(baseDiscG, bracketG);

      const pod = new THREE.Group();
      const podOffsetY = -0.13;
      const topCap = new THREE.Mesh(G.liftTop, origCapMat);
      topCap.castShadow = true;
      topCap.receiveShadow = true;
      pod.add(topCap);

      const discH = 0.155;
      const colBottomY = baseFootY + 0.11;
      const maxDiscs = Math.max(4, Math.ceil(((el.maxFloor - el.minFloor + 2) * fh) / discH) + 2);
      const discCol = new THREE.InstancedMesh(G.liftDisc, origFootMat, maxDiscs);
      discCol.frustumCulled = false;
      discCol.castShadow = true;
      discCol.receiveShadow = true;
      pod.add(discCol);

      let lastPodY = null;
      const syncDiscs = () => {
        if (pod.position.y === lastPodY) return;
        lastPodY = pod.position.y;
        const spanLen = Math.max(0, pod.position.y - colBottomY);
        const cnt = Math.min(maxDiscs, Math.ceil(spanLen / discH));
        for (let d = 0; d < cnt; d++) {
          const wy = Math.max(colBottomY, pod.position.y - (d + 1) * discH);
          _m4.makeTranslation(0, wy - pod.position.y, 0);
          discCol.setMatrixAt(d, _m4);
        }
        discCol.count = cnt;
        discCol.instanceMatrix.needsUpdate = true;
      };

      pod.position.set(liftR * Math.sin(phi), el.startFloor * fh + podOffsetY, liftR * Math.cos(phi));
      pod.rotation.y = phi;
      pod.userData = {
        podOffsetY,
        update: syncDiscs,
        phi,
        minY: baseFootY,
        maxY: (el.maxFloor + 1.5) * fh,
      };
      syncDiscs();
      group.add(pod);
      elevatorPods.push(pod);
    } else {
      const topHoodY = (el.maxFloor + 1.32) * fh;
      const botShaftY = el.minFloor * fh - 0.14;
      const guideH = Math.max(0.8, topHoodY - botShaftY);

      // Chiseled vertical stone reveal pilasters framing the recessed elevator niche!
      for (let py = botShaftY + 0.35; py < topHoodY - 0.15; py += 0.55) {
        const taperOff = -0.048 * Math.min(1, py / Math.max(10, totalH));
        for (const sxSign of [-1, 1]) {
          const pAng = phi + sxSign * COL_ANGLE * 0.48;
          pushInstance(
            ashlarInstances,
            Math.sin(pAng) * (R + 0.03 + taperOff),
            py,
            Math.cos(pAng) * (R + 0.03 + taperOff),
            0,
            pAng,
            0,
            0.13,
            0.52,
            0.22
          );
        }
      }

      // Thin outer shaft guide rails + recessed bronze/iron backplate spine merged into `staticDarkIronParts`
      for (const gxOff of [-0.39, 0.39]) {
        const gWire = new THREE.CylinderGeometry(0.011, 0.011, guideH, 4);
        const tx = Math.cos(phi) * gxOff;
        const tz = -Math.sin(phi) * gxOff;
        gWire.translate(
          (liftR - 0.22) * Math.sin(phi) + tx,
          (topHoodY + botShaftY) * 0.5,
          (liftR - 0.22) * Math.cos(phi) + tz
        );
        staticDarkIronParts.push(gWire);
      }

      // Sculpted 2-Tier Semicircular Romanesque Stone Canopy Hood & Glowing #ffaa33 Ceiling Ring (Photo Upper-Right!)
      _e.set(0, phi, 0);
      _q.setFromEuler(_e);
      _pos.set(R * Math.sin(phi), topHoodY, R * Math.cos(phi));
      _scl.set(1, 1, 1);
      _m4.compose(_pos, _q, _scl);

      const canopyLower = arcSlab(R - 0.12, liftR + 0.44, COL_ANGLE * 1.02, 0.15, 0.026, 3, 1, 0.035, R - 0.02);
      canopyLower.translate(0, 0.15, -R);
      canopyLower.applyMatrix4(_m4);
      const canopyUpper = arcSlab(R - 0.12, liftR + 0.36, COL_ANGLE * 0.90, 0.16, 0.024, 3, 1, 0.03, R - 0.02);
      canopyUpper.translate(0, 0.30, -R);
      canopyUpper.applyMatrix4(_m4);
      staticAshlarCanopyParts.push(canopyLower, canopyUpper);

      const strutL = new THREE.BoxGeometry(0.055, 0.34, 0.055);
      strutL.rotateX(0.52);
      strutL.translate(-0.34, 0.24, 0.14);
      strutL.applyMatrix4(_m4);
      const strutR = new THREE.BoxGeometry(0.055, 0.34, 0.055);
      strutR.rotateX(0.52);
      strutR.translate(0.34, 0.24, 0.14);
      strutR.applyMatrix4(_m4);
      staticDarkIronParts.push(strutL, strutR);

      const haloG = G.elevatorHalo.clone();
      haloG.userData = {};
      haloG.translate(0, -0.02, liftR - R);
      haloG.applyMatrix4(_m4);
      staticHaloParts.push(haloG);

      const cablesMesh = new THREE.Mesh(G.twinHoistCables, cableMat);
      cablesMesh.rotation.y = phi;
      group.add(cablesMesh);

      const pod = new THREE.Group();
      const podOffsetY = -0.1;

      if (cageLiftGlb) {
        const glbCar = cageLiftGlb.clone(true);
        glbCar.scale.set(1, 1.06, 1);
        let carShadowSet = false;
        glbCar.traverse((o) => {
          if (o.isMesh) {
            const isGlow = (o.material?.emissiveIntensity || 0) > 0.25;
            o.castShadow = !carShadowSet && !isGlow;
            if (o.castShadow) carShadowSet = true;
            o.receiveShadow = !isGlow;
          }
        });
        markSharedSubtree(glbCar);
        pod.add(glbCar);
      } else {
        const ironParts = [];
        const brassParts = [];

        const floorBox = new RoundedBoxGeometry(0.92, 0.09, 0.68, 1, 0.016);
        floorBox.translate(0, 0.045, 0);
        const roofBox = new RoundedBoxGeometry(0.94, 0.09, 0.7, 1, 0.016);
        roofBox.translate(0, 0.96, 0);
        ironParts.push(floorBox, roofBox);

        for (const [cx, cz] of [
          [-0.4, -0.28],
          [0.4, -0.28],
          [-0.4, 0.28],
          [0.4, 0.28],
        ]) {
          const post = new THREE.BoxGeometry(0.048, 0.88, 0.048);
          post.translate(cx, 0.5, cz);
          ironParts.push(post);
        }

        const brassPlate = new RoundedBoxGeometry(0.82, 0.024, 0.58, 1, 0.006);
        brassPlate.translate(0, 0.098, 0);
        const roofCrown = new RoundedBoxGeometry(0.66, 0.055, 0.48, 1, 0.01);
        roofCrown.translate(0, 1.02, 0);
        brassParts.push(brassPlate, roofCrown);

        for (const [bx, bz] of [
          [-0.2, -0.29],
          [0, -0.29],
          [0.2, -0.29],
          [-0.41, -0.1],
          [-0.41, 0.1],
          [0.41, -0.1],
          [0.41, 0.1],
        ]) {
          const bar = new THREE.CylinderGeometry(0.013, 0.013, 0.84, 5);
          bar.translate(bx, 0.5, bz);
          brassParts.push(bar);
        }

        const ironCar = new THREE.Mesh(mergeGeometries(ironParts), darkIronMat);
        ironCar.castShadow = true;
        const brassCar = new THREE.Mesh(mergeGeometries(brassParts), brassCageMat);
        const lanternPanel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.042, 0.34), sharedHaloMat);
        lanternPanel.position.y = 0.9;
        pod.add(ironCar, brassCar, lanternPanel);
      }

      if (!cagePointLightAssigned) {
        cagePointLightAssigned = true;
        const cageLight = new THREE.PointLight('#ffb84d', 1.85, 5.4);
        cageLight.position.set(0, 0.62, 0.16);
        pod.add(cageLight);
      }

      let lastPodY = null;
      const syncHoistCables = () => {
        if (pod.position.y === lastPodY) return;
        lastPodY = pod.position.y;
        const attachY = pod.position.y + 1.02;
        const len = Math.max(0.12, topHoodY - attachY);
        const midY = (topHoodY + attachY) * 0.5;
        cablesMesh.position.set(liftR * Math.sin(phi), midY, liftR * Math.cos(phi));
        cablesMesh.scale.set(1, len, 1);
      };

      pod.position.set(liftR * Math.sin(phi), el.startFloor * fh + podOffsetY, liftR * Math.cos(phi));
      pod.rotation.y = phi;
      pod.userData = {
        podOffsetY,
        update: syncHoistCables,
        cablesMesh,
        phi,
        minY: botShaftY,
        maxY: topHoodY,
      };
      syncHoistCables();
      group.add(pod);
      elevatorPods.push(pod);
    }
  }

  buildBandedInstancedFromList(group, bandedMeshes, G.ashlarBlock, ashlarMat, ashlarInstances, PROP_SPAN_Y, {
    castShadow: false,
    keepInReflection: false,
  });

  if (staticDarkIronParts.length) {
    const mergedIron = new THREE.Mesh(mergeGeometries(staticDarkIronParts), darkIronMat);
    mergedIron.castShadow = !isOrig;
    mergedIron.receiveShadow = true;
    group.add(mergedIron);
  }
  if (staticIronRibParts.length) {
    const mergedRibs = new THREE.Mesh(mergeGeometries(staticIronRibParts), ironRibMat);
    mergedRibs.castShadow = false;
    mergedRibs.receiveShadow = true;
    group.add(mergedRibs);
  }
  if (staticAshlarCanopyParts.length) {
    const mergedCanopy = new THREE.Mesh(mergeGeometries(staticAshlarCanopyParts), ashlarMat);
    mergedCanopy.castShadow = !isOrig;
    mergedCanopy.receiveShadow = true;
    group.add(mergedCanopy);
  }
  if (staticHaloParts.length) {
    group.add(new THREE.Mesh(mergeGeometries(staticHaloParts), sharedHaloMat));
  }
  if (origLiftTrackParts.length && origFootMat) {
    group.add(new THREE.Mesh(mergeGeometries(origLiftTrackParts), origFootMat));
  }

  // 5. Ledges: Chipped Irregular Flagstones + Smooth Curved Romanesque S-Scroll Corbels + Bolted Iron Brackets + Surf Stairs!
  const walkableSet = new Set();
  for (const l of tower?.ledges || []) {
    if (l.type !== 'box' && l.type !== 'pillar' && l.type !== 'laserGate') {
      walkableSet.add(`${((l.col % COLS) + COLS) % COLS}_${l.floor}`);
    }
  }

  const ledgeBodyMat = createBlockMaterial({
    color: isOrig ? pal.ledge || '#60a5fa' : pal.ledge || spec.ledgeBody,
    surface: isOrig ? 'orig_arcade' : spec.surface,
    tile: 0.6,
    roughness: isOrig ? 0.24 : Math.min(0.82, spec.roughness + 0.06),
    metalness: isOrig ? 0.2 : spec.metalness,
    normalScale: isOrig ? 0.45 : spec.normalScale,
    hi: isOrig ? '#ffffff' : spec.hi,
    angular: false,
    wetStrength: 0.9,
    wallAoTex,
    totalH,
  });
  const ledgeTopMat = createBlockMaterial({
    color: isOrig ? pal.ledgeTop || '#bfdbfe' : pal.ledgeTop || spec.ledgeTop,
    surface: isOrig ? 'orig_arcade' : spec.surface,
    tile: 0.6,
    roughness: isOrig ? 0.18 : Math.max(0.32, spec.roughness - 0.14),
    metalness: isOrig ? 0.22 : spec.metalness,
    normalScale: isOrig ? 0.4 : spec.normalScale * 0.9,
    hi: isOrig ? '#ffffff' : spec.hi,
    angular: false,
    wetStrength: 0.9,
    wallAoTex,
    totalH,
  });
  const corbelMaps = getSurfaceMaps1024(isOrig ? 'orig_arcade' : spec.surface, 0.65);
  const corbelMat = attachWaterlineShader(
    new THREE.MeshStandardMaterial({
      color: isOrig ? pal.ledge || '#4b5563' : spec ? spec.ledgeBody : '#363d52',
      map: corbelMaps.map,
      roughnessMap: corbelMaps.ormMap,
      aoMap: corbelMaps.ormMap,
      aoMapIntensity: 0.9,
      roughness: isOrig ? 0.28 : 0.78,
      metalness: isOrig ? 0.18 : Math.min(0.25, spec.metalness),
    }),
    0.85
  );
  stoneMats.push(ledgeBodyMat, ledgeTopMat, corbelMat);

  const iceMat = new THREE.MeshStandardMaterial({
    color: '#93d5fd',
    map: T.frost,
    emissive: '#0284c7',
    emissiveIntensity: 0.26,
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
  const convMatR = new THREE.MeshStandardMaterial({
    map: isOrig ? T.origConvR : T.convR,
    roughness: 0.36,
    metalness: 0.35,
  });
  const convMatL = new THREE.MeshStandardMaterial({
    map: isOrig ? T.origConvL : T.convL,
    roughness: 0.36,
    metalness: 0.35,
  });
  const hazardMat = new THREE.MeshStandardMaterial({ map: T.hazard, roughness: 0.46 });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: pal.ledgeTop || '#94a3b8',
    emissive: pal.glow || '#38bdf8',
    emissiveIntensity: 0.15,
    roughness: 0.2,
    metalness: 0.78,
  });
  const sharedBoxMat = new THREE.MeshStandardMaterial({
    color: isOrig ? '#fde047' : '#64748b',
    emissive: isOrig ? '#f59e0b' : '#d97706',
    emissiveMap: T.runeBox,
    emissiveIntensity: isOrig ? 1.15 : 0.75,
    roughness: isOrig ? 0.18 : 0.32,
    metalness: isOrig ? 0.35 : 0.55,
  });
  const sharedBoxCoreMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
  const sharedCrumbleIdleMat = new THREE.MeshStandardMaterial({
    color: isOrig ? '#f59e0b' : '#57534e',
    emissive: '#ea580c',
    emissiveMap: T.cracks,
    emissiveIntensity: 0.65,
    roughness: isOrig ? 0.24 : 0.68,
    metalness: 0.12,
  });
  const sharedCrumbleActiveMat = new THREE.MeshStandardMaterial({
    color: isOrig ? '#f59e0b' : '#57534e',
    emissive: '#ef4444',
    emissiveMap: T.cracks,
    emissiveIntensity: 1.35,
    roughness: isOrig ? 0.24 : 0.68,
    metalness: 0.12,
  });

  const solidTopBatch = [];
  const solidBodyBatch = [];
  const corbelBatch = [];
  const ironBracketBatch = [];
  const stairBodyBatch = [];
  const stairCapBatch = [];
  const ledgeIcicleBatch = [];
  const ledgeMossBatch = doorMossBatch;
  const ledgeBarnacleBatch = doorBarnacleBatch;
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
  const ledgeR = R + 0.34;
  const ledgeWidth = R * COL_ANGLE * 1.1;
  const realSlabScaleY = isRealOrig ? (0.65 * fh) / 0.28 : 1.0;

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
    const phi = (l.col + 0.5) * COL_ANGLE;
    const isBox = l.type === 'box';
    const isPillar = l.type === 'pillar';

    let y = l.floor * fh;
    let blockH = 0.54;
    if (isPillar) {
      blockH = Math.max(1, l.h || 1) * fh;
      y = l.floor * fh + blockH * 0.5;
    } else if (isBox) {
      blockH = l.h ? Math.max(1, l.h) * fh * 0.96 : 0.54;
      y = l.h ? l.floor * fh + blockH * 0.5 + 0.008 : l.floor * fh + 0.27;
    }

    if (l.type === 'solid') {
      const batchRefs = [];
      const wJoin = !isOrig ? 1.04 : 1.0;
      const iBody = pushInstance(
        solidBodyBatch,
        ledgeR * Math.sin(phi),
        y,
        ledgeR * Math.cos(phi),
        0,
        phi,
        0,
        wJoin,
        isRealOrig ? realSlabScaleY : 1,
        1
      );
      const iTop = pushInstance(
        solidTopBatch,
        ledgeR * Math.sin(phi),
        y,
        ledgeR * Math.cos(phi),
        0,
        phi,
        0,
        wJoin,
        1,
        1
      );
      batchRefs.push(solidBodyBatch[iBody], solidTopBatch[iTop]);

      if (!isOrig) {
        // Smoothly curved Romanesque S-scroll tapered stone corbels (ZERO Minecraft stepped cubes!)
        pushInstance(corbelBatch, ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi), 0, phi, 0, 1, 1, 1);

        // Bolted wrought-iron diagonal support gusset brackets under industrial & alternating castle ledges!
        if (rbTheme === 'foundry' || rbTheme === 'piston' || (l.col + l.floor) % 3 === 0) {
          pushInstance(ironBracketBatch, ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi), 0, phi, 0, 1, 1, 1);
        }

        // Draped 3D dark-emerald moss clumps overhanging ledge joints + crusty barnacles near surf!
        if (rbTheme === 'mist' || rbTheme === 'sinking') {
          if ((l.col + l.floor) % 2 === 0) {
            const mOff = ((l.col * 7) % 2 === 0 ? -1 : 1) * 0.36;
            const mx = (ledgeR + 0.22) * Math.sin(phi) + Math.cos(phi) * mOff;
            const mz = (ledgeR + 0.22) * Math.cos(phi) - Math.sin(phi) * mOff;
            pushInstance(
              ledgeMossBatch,
              mx,
              y - 0.008,
              mz,
              0.15,
              phi,
              0,
              0.92,
              0.68,
              0.95,
              pal.moss || '#2d4d24'
            );
          }
          if (l.floor <= 3 && (l.col + l.floor) % 3 === 1) {
            const bx = (ledgeR - 0.12) * Math.sin(phi) + Math.cos(phi) * 0.22;
            const bz = (ledgeR - 0.12) * Math.cos(phi) - Math.sin(phi) * 0.22;
            pushInstance(ledgeBarnacleBatch, bx, y - 0.15, bz, 0.2, phi, 0.4, 0.95, 0.95, 0.85, '#6e7569');
          }
        }

        // Chiseled multi-step stone stair treads when adjacent col steps down by 1 floor (matches right-flank stair in photo!)
        const leftCol = ((l.col - 1) % COLS + COLS) % COLS;
        const rightCol = ((l.col + 1) % COLS + COLS) % COLS;
        for (const [adjCol, sideSign] of [
          [leftCol, -1],
          [rightCol, 1],
        ]) {
          if (walkableSet.has(`${adjCol}_${l.floor - 1}`)) {
            for (const stepIdx of [1, 2]) {
              const frac = stepIdx / 3;
              const stPhi = phi + sideSign * COL_ANGLE * frac;
              const sx = ledgeR * Math.sin(stPhi);
              const sz = ledgeR * Math.cos(stPhi);
              const stepY = y - fh * frac;
              pushInstance(stairBodyBatch, sx, stepY, sz, 0, stPhi, 0, 0.86, 0.92, 1);
              pushInstance(stairCapBatch, sx, stepY + 0.006, sz, 0, stPhi, 0, 0.88, 1, 1);
            }
          }
        }

        if (rbTheme === 'blizzard' && l.col % 2 === 0) {
          pushInstance(
            ledgeIcicleBatch,
            (ledgeR + 0.22) * Math.sin(phi),
            y - 0.14,
            (ledgeR + 0.22) * Math.cos(phi),
            0,
            phi,
            0,
            1,
            1,
            1
          );
        }
      }

      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, batchRefs));
      continue;
    }

    if (isPillar) {
      // Batched into InstancedMeshes (`pillarShaftBatch` + `pillarCollarBatch`) for 2 draw calls across whole tower!
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const colCapH = Math.min(0.08, blockH * 0.12);
      const s1 = pushInstance(pillarShaftBatch, lx, y, lz, 0, phi, 0, 1, blockH * 0.94, 1);
      const c1 = pushInstance(
        pillarCollarBatch,
        lx,
        y + blockH * 0.5 - colCapH * 0.5,
        lz,
        0,
        phi,
        0,
        1,
        colCapH / 0.08,
        1
      );
      const c2 = pushInstance(
        pillarCollarBatch,
        lx,
        y - blockH * 0.5 + colCapH * 0.5,
        lz,
        0,
        phi,
        0,
        1,
        colCapH / 0.08,
        1
      );
      ledgeMeshes.push(
        makeStaticProxy(phi, y, l.type, [
          pillarShaftBatch[s1],
          pillarCollarBatch[c1],
          pillarCollarBatch[c2],
        ])
      );
      continue;
    }

    if (l.type === 'ice' || l.type === 'slideR' || l.type === 'slideL') {
      // Batched into InstancedMeshes (`iceSlabBatch` + `iceCap`/`slideCap` + `ledgeIcicleBatch`)!
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const b1 = pushInstance(iceSlabBatch, lx, y, lz, 0, phi, 0, 1, isRealOrig ? realSlabScaleY : 1, 1);
      const targetCapBatch = l.type === 'slideR' ? slideRCapBatch : l.type === 'slideL' ? slideLCapBatch : iceCapBatch;
      const b2 = pushInstance(targetCapBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const refs = [iceSlabBatch[b1], targetCapBatch[b2]];
      if (!isRealOrig) {
        const b3 = pushInstance(
          ledgeIcicleBatch,
          (ledgeR + 0.22) * Math.sin(phi),
          y - 0.15,
          (ledgeR + 0.22) * Math.cos(phi),
          0,
          phi,
          0,
          1,
          1,
          1
        );
        refs.push(ledgeIcicleBatch[b3]);
      }
      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, refs));
      continue;
    }

    if (isBox) {
      // Batched into whole-tower `boxCrateBatch` + `boxCoreBatch` (2 draw calls total, toggled via `_zeroMatrix` on `l.gone`!)
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const sy = blockH / 0.54;
      const b1 = pushInstance(boxCrateBatch, lx, y, lz, 0, phi, 0, 1, sy, 1);
      const b2 = pushInstance(boxCoreBatch, lx, y, lz, 0, phi, 0, 1, sy, 1);
      ledgeMeshes.push(makeStaticProxy(phi, y, l.type, [boxCrateBatch[b1], boxCoreBatch[b2]]));
      continue;
    }

    // Dynamic Ledges (`crumble`, `conveyor*`, `laserGate`, `phaseBlock`, `piston`, `steamVent`)
    const node = new THREE.Group();
    node.position.set(ledgeR * Math.sin(phi), y, ledgeR * Math.cos(phi));
    node.rotation.y = phi;

    if (l.type === 'crumble') {
      const pieceMesh = new THREE.Mesh(G.crumbleTriple, sharedCrumbleIdleMat);
      if (isRealOrig) pieceMesh.scale.y = realSlabScaleY;
      pieceMesh.castShadow = false;
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
      const beamMat = new THREE.MeshBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.9,
      });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, ledgeWidth * 0.9, 6),
        beamMat
      );
      beam.rotation.z = Math.PI * 0.5;
      beam.position.y = 0.2;
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
        opacity: 0.8,
        roughness: 0.14,
      });
      const slab = new THREE.Mesh(G.iceSlab, holoMat);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(ledgeWidth * 0.96, 0.18, 0.68),
        new THREE.MeshBasicMaterial({
          color: isRed ? '#fda4af' : '#bae6fd',
          wireframe: true,
          transparent: true,
          opacity: 0.4,
        })
      );
      frame.position.y = -0.08;
      node.add(slab, frame);
      node.userData = { baseR: ledgeR, baseY: y, phi, type: l.type, slab };
    } else if (l.type === 'piston') {
      const rams = new THREE.Mesh(G.pistonRams, cableMat);
      const deck = new THREE.Mesh(G.ledgeBodyCourse, ledgeBodyMat);
      const cap = new THREE.Mesh(G.ledgeTopCourse, ledgeTopMat);
      const haz = new THREE.Mesh(G.convHazard, hazardMat);
      haz.position.y = -0.02;
      node.add(rams, deck, cap, haz);
      node.userData = { baseR: ledgeR, baseY: y, phi, type: l.type };
    } else if (l.type === 'steamVent') {
      const lx = ledgeR * Math.sin(phi);
      const lz = ledgeR * Math.cos(phi);
      const s1 = pushInstance(steamDeckBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const s2 = pushInstance(steamCapBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const s3 = pushInstance(steamNozzleBatch, lx, y, lz, 0, phi, 0, 1, 1, 1);
      const warnRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.02, 5, 14),
        new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.2 })
      );
      warnRing.rotation.x = Math.PI * 0.5;
      warnRing.position.y = 0.14;
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 1.7, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#e2e8f0',
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      plume.rotation.x = Math.PI;
      plume.position.y = 0.96;
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

  // Basal Crashing-Surf Spiral Stone Staircase descending from lowest ledge into the sea (Photo Lower-Right!)
  if (!isOrig) {
    const spawnCol = tower?.spawn?.col ?? 0;
    let anchorCol = (spawnCol + 1) % COLS;
    let anchorFloor = 0;
    for (const l of tower?.ledges || []) {
      if (l.type === 'solid' && l.floor === 0) {
        anchorCol = l.col;
        anchorFloor = 0;
        break;
      }
    }
    for (let s = 1; s <= 5; s++) {
      const stPhi = (anchorCol + 0.45 + s * 0.30) * COL_ANGLE;
      const sy = anchorFloor * fh - s * 0.18;
      const sr = ledgeR + (s === 5 ? 0.16 : 0.03);
      const sx = sr * Math.sin(stPhi);
      const sz = sr * Math.cos(stPhi);
      const wScale = s === 5 ? 1.95 : 1.15;
      pushInstance(stairBodyBatch, sx, sy, sz, 0, stPhi, 0, wScale, 1.12, 1.08);
      pushInstance(stairCapBatch, sx, sy + 0.008, sz, 0, stPhi, 0, wScale, 1.0, 1.08);
      if (s >= 3 && (rbTheme === 'mist' || rbTheme === 'sinking')) {
        pushInstance(ledgeMossBatch, sx, sy + 0.02, sz, 0.1, stPhi, 0, 1.25, 0.55, 1.15, pal.moss || '#213c1b');
        if (s === 4) {
          pushInstance(ledgeBarnacleBatch, sx * 0.94, sy + 0.06, sz * 0.94, 0, stPhi, 0.3, 1.1, 1.1, 0.9, '#6c7368');
        }
      }
    }
  }

  // Materialize all static & specialty ledge InstancedMeshes into vertical row bands (`castShadow`/`receiveShadow` enabled!)
  const solidBodyGeo = isRealOrig ? G.origRealSlab : !isOrig ? G.rebootFlagstoneBed : G.ledgeBodyCourse;
  const solidTopGeo = isRealOrig ? G.origRealCap : !isOrig ? G.rebootFlagstoneTop : G.ledgeTopCourse;
  buildBandedInstancedFromList(group, bandedMeshes, solidBodyGeo, ledgeBodyMat, solidBodyBatch, PROP_SPAN_Y, {
    castShadow: false,
    keepInReflection: false,
  });
  buildBandedInstancedFromList(group, bandedMeshes, solidTopGeo, ledgeTopMat, solidTopBatch, PROP_SPAN_Y, {
    castShadow: true,
    keepInReflection: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.corbelPair, corbelMat, corbelBatch, PROP_SPAN_Y, {
    castShadow: false,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.ironGussetBracket, darkIronMat, ironBracketBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.stairBody, ledgeBodyMat, stairBodyBatch, PROP_SPAN_Y, {
    castShadow: false,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.stairCap, ledgeTopMat, stairCapBatch, PROP_SPAN_Y, {
    castShadow: false,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.icicleCluster, iceMat, ledgeIcicleBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceSlab, iceMat, iceSlabBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceCap, iceTopMat, iceCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceCap, slideMatR, slideRCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.iceCap, slideMatL, slideLCapBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.flutedPillar, pillarMat, pillarShaftBatch, PROP_SPAN_Y, {
    castShadow: true,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.pillarCollar, ledgeTopMat, pillarCollarBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.energyBox, sharedBoxMat, boxCrateBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.energyCore, sharedBoxCoreMat, boxCoreBatch, PROP_SPAN_Y, {
    receiveShadow: false,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.convBase, darkIronMat, convBaseBatch, PROP_SPAN_Y, {
    castShadow: !isOrig,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.convHazard, hazardMat, convHazBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.rollerTrio, cableMat, convRollerBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.ledgeBodyCourse, ledgeBodyMat, steamDeckBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.ledgeTopCourse, ledgeTopMat, steamCapBatch, PROP_SPAN_Y, {
    castShadow: !isOrig,
  });
  buildBandedInstancedFromList(group, bandedMeshes, G.steamNozzle, brassCageMat, steamNozzleBatch, PROP_SPAN_Y);
  buildBandedInstancedFromList(group, bandedMeshes, G.laserEmitters, brassCageMat, laserEmitterBatch, PROP_SPAN_Y);

  for (const m of bodyInfo.mossList || []) ledgeMossBatch.push(m);
  for (const b of bodyInfo.barnacleList || []) ledgeBarnacleBatch.push(b);

  if (ledgeMossBatch.length) {
    const lmMat = attachWaterlineShader(
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0.02 }),
      0.7
    );
    stoneMats.push(lmMat);
    buildBandedInstancedFromList(group, bandedMeshes, G.mossCluster, lmMat, ledgeMossBatch, PROP_SPAN_Y);
  }
  if (ledgeBarnacleBatch.length) {
    const lbMat = attachWaterlineShader(
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.88,
        metalness: 0.04,
        side: THREE.DoubleSide,
      }),
      0.72
    );
    stoneMats.push(lbMat);
    buildBandedInstancedFromList(group, bandedMeshes, G.barnacleCluster, lbMat, ledgeBarnacleBatch, PROP_SPAN_Y);
  }

  // 6. Embedded 3D Tower Switches, Tinker Workbench & Sunken Treasure Chest (Workbench/Chest allocated lazily only when present!)
  const switchNodes = [];
  for (const sw of tower?.switches || []) {
    const sm = buildSwitchMesh(sw.mode);
    const sPhi = (sw.col + 0.5) * COL_ANGLE;
    const sr = R + 0.34;
    sm.position.set(sr * Math.sin(sPhi), sw.floor * fh, sr * Math.cos(sPhi));
    sm.rotation.y = sPhi;
    group.add(sm);
    switchNodes.push(sm);
  }

  let workbenchProp = null;
  if (tower?.workbench) {
    workbenchProp = buildWorkbenchMesh();
    const wPhi = (tower.workbench.col + 0.5) * COL_ANGLE;
    const wr = R + 0.36;
    workbenchProp.position.set(wr * Math.sin(wPhi), tower.workbench.floor * fh, wr * Math.cos(wPhi));
    workbenchProp.rotation.y = wPhi;
    group.add(workbenchProp);
  }

  let treasureChestProp = null;
  if (tower?.treasureChest) {
    treasureChestProp = buildTreasureChestMesh();
    const cPhi = (tower.treasureChest.col + 0.5) * COL_ANGLE;
    const cr = R + 0.36;
    treasureChestProp.position.set(cr * Math.sin(cPhi), tower.treasureChest.floor * fh, cr * Math.cos(cPhi));
    treasureChestProp.rotation.y = cPhi;
    group.add(treasureChestProp);
  }

  const _reflSavedVis = [];

  const cached = {
    group,
    tower,
    era,
    theme: rbTheme,
    fh,
    isRealOrig,
    totalH: bodyInfo.totalH,
    coreMat: bodyInfo.coreMat,
    cylMat: stoneMats[0] || bodyInfo.coreMat,
    crownFlames: bodyInfo.crownFlames,
    bandedMeshes,
    cullableNodes,
    sharedBoxMat,
    sharedBoxCoreMat,
    ledgeMeshes,
    elevatorPods,
    conveyorRollers,
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
    _lastWaterY: -0.55,
    _inReflection: false,
    setReflectionPass(isRefl) {
      const on = Boolean(isRefl);
      if (cached._inReflection === on) return;
      cached._inReflection = on;
      const kids = group.children;
      if (on) {
        _reflSavedVis.length = kids.length;
        const maxReflY = cached._lastWaterY + 4.2;
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
      const on = Boolean(active);
      if (cached._externalVfxActive === on) return;
      cached._externalVfxActive = on;
      for (let i = 0; i < mistSprites.length; i++) mistSprites[i].sprite.visible = !on;
      for (let i = 0; i < sparkInstancers.length; i++) sparkInstancers[i].inst.visible = !on;
      for (let i = 0; i < forgeLights.length; i++) forgeLights[i].visible = !on;
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

  const isOrig = cachedTower.era === 'original';
  const fh = cachedTower.fh || FLOOR_HEIGHT;
  const tower = state?.tower || cachedTower.tower || {};
  const T = getDetailTextures();

  // Camera horizon & vertical frustum window for zero-visual-loss occlusion/altitude culling
  const fullTowerView = Boolean(state?.topple?.active || state?.cutsceneCam?.active);
  const camFloor =
    state?.camFloor != null
      ? state.camFloor
      : state?.player?.floor != null
      ? state.player.floor
      : 2;
  const camY = camFloor * fh + (cachedTower.isRealOrig ? 0.85 : 1.15);
  const effCamAngle =
    cachedTower.group.rotation.y !== 0
      ? -cachedTower.group.rotation.y
      : state?.camCol != null
      ? state.camCol * COL_ANGLE
      : 0;

  // 0. Vertical Row-Band & Back-Wall Sector Frustum Culling (`bandedMeshes`)
  const banded = cachedTower.bandedMeshes;
  if (banded) {
    // Matches renderer's widened Reboot camera (FOV 52, camZ ~19.8 => ~±8.2m visible on the tower face)
    const minVisY = camY - (isOrig ? 8.3 : 6.5);
    const maxVisY = camY + (isOrig ? 8.7 : 6.5);
    for (let i = 0; i < banded.length; i++) {
      const bm = banded[i];
      const ud = bm.userData;
      const altOk = ud.bandMaxY >= minVisY && ud.bandMinY <= maxVisY;
      // 45° sectors (`sectorPhi`): when `cos < -0.38` (`> 112.3°`), closest brick edge is `>= 89.8° > 82.5°` cylinder horizon behind solid `core`!
      const angOk = ud.sectorPhi === undefined || Math.cos(ud.sectorPhi - effCamAngle) >= -0.38;
      bm.visible = fullTowerView || (altOk && angOk);
    }
  }

  // Horizon & altitude cull special doorway ornaments & clue plaques
  const cullNodes = cachedTower.cullableNodes;
  if (cullNodes) {
    for (let i = 0; i < cullNodes.length; i++) {
      const cn = cullNodes[i];
      cn.node.visible =
        fullTowerView ||
        (Math.cos(cn.phi - effCamAngle) >= -0.28 && Math.abs(cn.y - camY) <= 6.5);
    }
  }

  // 1. Update Dynamic Waterline Wetness (`uWaterY`) + Active Tower AO (`uWallAoMap`) across pooled masonry materials
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
    const totH = Math.max(2.0, cachedTower.totalH || 20.0);
    for (let i = 0; i < stoneMats.length; i++) {
      const u = stoneMats[i].userData;
      if (!u) continue;
      if (u.waterY) u.waterY.value = waterY;
      if (u.wallAoUniform) u.wallAoUniform.value = aoTex;
      if (u.totalHUniform) u.totalHUniform.value = totH;
    }
  }

  // 2. Scroll Conveyor & Directional Slide Sheen Textures + Shared `8Hz` Energy Box Strobe
  const activeConvR = isOrig ? T.origConvR : T.convR;
  const activeConvL = isOrig ? T.origConvL : T.convL;
  activeConvR.offset.x = -(time * 1.4) % 1;
  activeConvL.offset.x = (time * 1.4) % 1;
  T.slideR.offset.x = -(time * 1.15) % 1;
  T.slideL.offset.x = (time * 1.15) % 1;

  if (cachedTower.sharedBoxMat) {
    if (isOrig) {
      const flash = Math.sin(time * TWO_PI * 8) > 0;
      cachedTower.sharedBoxMat.color.set(flash ? '#fde047' : '#38bdf8');
      cachedTower.sharedBoxMat.emissive.set(flash ? '#f59e0b' : '#0284c7');
      if (cachedTower.sharedBoxCoreMat) {
        cachedTower.sharedBoxCoreMat.color.set(flash ? '#ffffff' : '#fef08a');
      }
    } else {
      const flash = Math.sin(time * 9) > 0;
      cachedTower.sharedBoxMat.emissive.set(flash ? '#f59e0b' : '#b45309');
    }
  }

  // 3. Summit Crown Brazier Flames & Portal Vortex Uniforms
  if (cachedTower.crownFlames) {
    const showCrownFlames = fullTowerView || Math.abs(cachedTower.totalH + 0.5 - camY) <= 6.5;
    for (let i = 0; i < cachedTower.crownFlames.length; i++) {
      const fl = cachedTower.crownFlames[i];
      fl.visible = showCrownFlames;
      if (!showCrownFlames) continue;
      const k = (time * 1.35 + i * 0.25) % 1;
      fl.position.y = cachedTower.totalH + 0.46 + k * 0.85;
      fl.scale.setScalar((0.88 - k * 0.55) * (1 + Math.sin(time * 12 + i) * 0.1));
      fl.material.opacity = Math.sin(k * Math.PI) * 0.85;
    }
  }
  if (cachedTower.portalMats) {
    for (let i = 0; i < cachedTower.portalMats.length; i++) {
      cachedTower.portalMats[i].uniforms.uTime.value = time;
    }
  }

  // 4. Exterior Rune Chamber Clue Plaque Animation & Dynamic Clue Sync
  if (cachedTower.clueUpdater) {
    cachedTower.clueUpdater(time, state, tower);
  }

  // 5. Secret Rune Doors (`solved` dim vs unsolved pulse) & Summit/Vault Rings
  if (cachedTower.runeDoors && cachedTower.runeDoors.length > 0) {
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
        rd.ringMat.emissiveIntensity = 0.16;
        rd.gemMat.emissiveIntensity = 0.14;
        rd.sigilMat.opacity = 0.15;
      } else {
        rd.ringMat.color.set('#5efce8');
        rd.ringMat.emissive.set('#14b8a6');
        rd.ringMat.emissiveIntensity = 1.25 + 0.35 * Math.sin(time * 3.1);
        rd.gemMat.emissiveIntensity = 1.35 + 0.3 * Math.cos(time * 2.7);
        rd.sigilMat.opacity = 0.78 + 0.18 * Math.sin(time * 2.5);
        rd.sigilMesh.position.y = 0.04 + Math.sin(time * 2.1) * 0.025;
        rd.ringMesh.rotation.z = Math.sin(time * 0.9) * 0.12;
      }
    }
  }

  for (let i = 0; i < cachedTower.exitRings.length; i++) {
    const er = cachedTower.exitRings[i];
    if (er.isGroup) er.rotation.y = time * 1.4;
    else er.rotation.z = time * (i % 2 === 0 ? 1.8 : -2.4);
  }

  if (state?.useOceanVfx !== undefined && cachedTower.setExternalVfxActive) {
    cachedTower.setExternalVfxActive(state.useOceanVfx);
  }

  // 6. Volumetric Doorway Mist & Ballistic Ledge-Bouncing `sparkArch` Welding Sparks (skipped when external oceanVfx active)
  if (!cachedTower._externalVfxActive) {
    for (let i = 0; i < cachedTower.mistSprites.length; i++) {
      const ms = cachedTower.mistSprites[i];
      ms.sprite.position.x = ms.baseX + Math.sin(time * 1.2 + ms.phase) * 0.09;
      ms.sprite.position.y = ms.baseY + Math.cos(time * 0.95 + ms.phase) * 0.04;
    }

    for (let i = 0; i < cachedTower.forgeLights.length; i++) {
      cachedTower.forgeLights[i].intensity =
        1.15 + 0.35 * Math.sin(time * 19.3 + i) + 0.2 * Math.cos(time * 31.7);
    }

    if (cachedTower.sparkInstancers) {
      _q.identity();
      for (let eIdx = 0; eIdx < cachedTower.sparkInstancers.length; eIdx++) {
        const { inst, meta } = cachedTower.sparkInstancers[eIdx];
        for (let s = 0; s < meta.length; s++) {
          const u = meta[s];
          const life = (time * 1.95 + u.phase) % 1;
          let py = -0.06 + u.vy * life - 1.55 * life * life;
          if (py < u.floorLocalY) {
            py = u.floorLocalY + Math.abs(u.floorLocalY - py) * 0.45;
          }
          const fade = Math.max(0.15, 1 - life * 0.72);
          _pos.set(u.vx * life, py, 0.16 + u.vz * life);
          _scl.set(fade * 0.85, fade * 0.85, fade * 1.45);
          _m4.compose(_pos, _q, _scl);
          inst.setMatrixAt(s, _m4);
        }
        inst.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // 7. Dynamic Ledges (`crumble`, `8Hz box`, `conveyor*`, `laserGate`, `phaseBlock`, `piston`, `steamVent`) w/ Horizon + Altitude Culling!
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
      (Math.cos(ud.phi - effCamAngle) >= -0.28 && Math.abs(ud.baseY - camY) <= 6.5);
    node.visible = inView;
    if (!inView) continue;

    if (l.type === 'crumble' && ud.pieceMesh) {
      const wantMat = l.crumbling ? ud.activeMat : ud.idleMat;
      if (ud.pieceMesh.material !== wantMat) ud.pieceMesh.material = wantMat;
      ud.pieceMesh.castShadow = !isOrig && Math.abs(ud.baseY - camY) <= 6.2;
      node.position.y = ud.baseY + (l.shake ? Math.sin(time * 55) * 0.045 : 0);
    } else if ((l.type === 'conveyorR' || l.type === 'conveyorL') && ud.treadMesh) {
      const wantDir = l.type === 'conveyorR' ? 1 : -1;
      const wantMat = wantDir > 0 ? ud.convMatR : ud.convMatL;
      if (ud.treadMesh.material !== wantMat) {
        ud.treadMesh.material = wantMat;
      }
    } else if (l.type === 'laserGate' && ud.beam) {
      ud.beam.visible = l.active !== false;
      const pulse = 0.85 + 0.2 * Math.sin(time * 28);
      ud.beam.scale.set(pulse, 1, pulse);
    } else if (l.type === 'phaseBlock' && ud.slab) {
      ud.slab.visible = l.active !== false;
    } else if (l.type === 'piston') {
      const ext = l.pistonExt != null ? l.pistonExt : 1;
      const rad = TOWER_RADIUS - 0.24 + ext * 0.58;
      node.position.x = rad * Math.sin(ud.phi);
      node.position.z = rad * Math.cos(ud.phi);
    } else if (l.type === 'steamVent' && ud.plume) {
      ud.plume.visible = Boolean(l.steamActive);
      if (ud.warnRing) {
        ud.warnRing.material.opacity = l.steamWarn ? 0.55 + 0.35 * Math.sin(time * 24) : 0.15;
      }
      if (ud.plume.visible) {
        ud.plume.scale.set(0.85 + Math.sin(time * 32) * 0.2, 0.9 + Math.cos(time * 24) * 0.15, 1);
      }
    }
  }

  // 8. Elevator Cage / Telescoping Pods + Dynamic Hoist Cable Tension (Horizon & Altitude Culled!)
  const elevators = state?.elevators || tower?.elevators || [];
  for (let i = 0; i < elevators.length; i++) {
    const pod = cachedTower.elevatorPods[i];
    if (!pod) continue;
    const pUd = pod.userData;
    const elFloor = elevators[i].floor != null ? elevators[i].floor : elevators[i].startFloor || 0;
    const podY = elFloor * fh + (pUd.podOffsetY ?? -0.1);
    pod.position.y = podY;

    const onFront = fullTowerView || Math.cos(pUd.phi - effCamAngle) >= -0.28;
    const podInAlt = fullTowerView || Math.abs(podY + 0.45 - camY) <= 7.2;
    pod.visible = onFront && podInAlt;

    if (pUd.cablesMesh) {
      const cablesInAlt = fullTowerView || (podY <= camY + 6.5 && pUd.maxY >= camY - 6.5);
      pUd.cablesMesh.visible = onFront && cablesInAlt;
      if (pUd.cablesMesh.visible && pUd.update) pUd.update();
    } else if (pod.visible && pUd.update) {
      pUd.update();
    }
  }

  // 9. Embedded Switches (`drainValve` wheel spin + crystal orb state color — Horizon & Altitude Culled!)
  const switches = state?.switches || tower?.switches || [];
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
      (Math.cos(sPhi - effCamAngle) >= -0.28 && Math.abs(sy - camY) <= 6.5);
    sm.visible = swInView;
    if (!swInView) continue;

    const sr = TOWER_RADIUS + 0.34;
    sm.position.set(sr * Math.sin(sPhi), sy, sr * Math.cos(sPhi));
    sm.rotation.y = sPhi;

    const u = sm.userData;
    u.orb.rotation.y = time * 2.8;
    if (u.wheel) {
      u.wheel.rotation.z = sw.active ? time * 5.2 : Math.sin(time * 1.4) * 0.15;
    }
    const baseHex = sw.mode === 'drainValve' ? '#fbbf24' : sw.group === 'cyan' ? '#38bdf8' : '#fb7185';
    const activeHex = sw.active ? '#4ade80' : baseHex;
    u.orbMat.color.set(activeHex);
    u.orbMat.emissive.set(activeHex);
  }

  // 10. Embedded Casual Expedition Stations (`workbench` & `treasureChest` — Lazily Built & Horizon/Altitude Culled!)
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
      (Math.cos(wPhi - effCamAngle) >= -0.28 && Math.abs(wy - camY) <= 6.5);
    wbProp.visible = wbVis;
    if (wbVis) {
      const wr = TOWER_RADIUS + 0.36;
      wbProp.position.set(wr * Math.sin(wPhi), wy, wr * Math.cos(wPhi));
      wbProp.rotation.y = wPhi;

      const wUd = wbProp.userData;
      const isCrafted = Boolean(wb.crafted);
      wUd.holoGhost.visible = !isCrafted;
      wUd.craftedGroup.visible = isCrafted;
      wUd.dynamoGroup.rotation.y = time * (isCrafted ? 3.4 : 1.8);
      wUd.dynamoGroup.position.y = 0.54 + Math.sin(time * 3.0) * 0.025;
      if (isCrafted) {
        wUd.dynamoCoil.rotation.x = time * 4.2;
        wUd.lampGlow.material.color.set('#fde047');
        wUd.lampGlow.material.opacity = 0.68;
      } else {
        wUd.holoMat.opacity = 0.38 + 0.2 * Math.sin(time * 3.6);
        wUd.lampGlow.material.color.set('#5efce8');
        wUd.lampGlow.material.opacity = 0.46 + 0.1 * Math.sin(time * 2.5);
      }
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
      (Math.cos(cPhi - effCamAngle) >= -0.28 && Math.abs(cy - camY) <= 6.5);
    chestProp.visible = chestVis;
    if (chestVis) {
      const cr = TOWER_RADIUS + 0.36;
      chestProp.position.set(cr * Math.sin(cPhi), cy, cr * Math.cos(cPhi));
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
  if (Array.isArray(cachedTower.ownedTextures)) {
    for (let i = 0; i < cachedTower.ownedTextures.length; i++) {
      const t = cachedTower.ownedTextures[i];
      if (t && !t.userData?.shared) t.dispose();
    }
    cachedTower.ownedTextures.length = 0;
  }
  cachedTower.wallAoTex = null;
  // Dispose all per-tower GPU vertex/index buffers (`obj.geometry`), while keeping compiled WebGLPrograms
  // alive across `GameRenderer.webgl.compile()` `KHR_parallel_shader_compile` polls (`0` `glGetProgramiv` warnings!).
  cachedTower.group.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData?.shared) {
      obj.geometry.dispose();
    }
  });
}
