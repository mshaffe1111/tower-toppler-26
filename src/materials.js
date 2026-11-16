// Procedural PBR stone for the towers and ledges.
// One shared "structure" (height field of irregular cut-stone courses with bevelled, chipped edges
// and weathered faces) is generated once; from it we derive a normal map, an AO/roughness map, a
// neutral stone albedo (for ledges, tinted by material colour) and per-tower tinted albedos.
// The tile covers 4×4 world units (128 px per unit), so materials use repeat = size / 4.
import * as THREE from 'three';

const SIZE = 512;
const COURSE_PX = 64; // half a floor per course of stones

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

// Tileable value noise lattice with period `p` cells over the tile
function makeNoise(p, rand) {
  const g = new Float32Array(p * p);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return (x, y) => {
    // x, y in [0, SIZE)
    const fx = (x / SIZE) * p;
    const fy = (y / SIZE) * p;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const ux = tx * tx * (3 - 2 * tx);
    const uy = ty * ty * (3 - 2 * ty);
    const x0 = ((ix % p) + p) % p;
    const x1 = (x0 + 1) % p;
    const y0 = ((iy % p) + p) % p;
    const y1 = (y0 + 1) % p;
    const a = g[y0 * p + x0];
    const b = g[y0 * p + x1];
    const c = g[y1 * p + x0];
    const d = g[y1 * p + x1];
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  };
}

let BASE = null;

function buildBase() {
  if (BASE) return BASE;
  const rand = mulberry32(1987);
  const n8 = makeNoise(8, rand);
  const n16 = makeNoise(16, rand);
  const n32 = makeNoise(32, rand);
  const n64 = makeNoise(64, rand);
  const n128 = makeNoise(128, rand);
  const fbm = (x, y) => n8(x, y) * 0.4 + n16(x, y) * 0.27 + n32(x, y) * 0.17 + n64(x, y) * 0.1 + n128(x, y) * 0.06;

  // Courses of stones with random widths that wrap exactly around the tile
  const rows = SIZE / COURSE_PX;
  const courses = [];
  for (let r = 0; r < rows; r++) {
    const edges = [];
    let x = Math.floor(rand() * 90);
    const start = x;
    while (x < start + SIZE) {
      edges.push(x);
      x += 70 + Math.floor(rand() * 95);
    }
    // close the loop: last edge must be start + SIZE
    if (start + SIZE - edges[edges.length - 1] < 50) edges.pop();
    edges.push(start + SIZE);
    const blocks = [];
    for (let i = 0; i < edges.length - 1; i++) {
      blocks.push({
        x0: edges[i],
        x1: edges[i + 1],
        tone: rand(),
        hueJ: rand() - 0.5,
        tilt: (rand() - 0.5) * 0.25,
        chip: rand(),
        id: r * 64 + i,
      });
    }
    courses.push({ blocks, sag: (rand() - 0.5) * 6 });
  }

  const height = new Float32Array(SIZE * SIZE);
  const blockTone = new Float32Array(SIZE * SIZE);
  const blockHue = new Float32Array(SIZE * SIZE);
  const isMortar = new Uint8Array(SIZE * SIZE);
  const surf = new Float32Array(SIZE * SIZE);

  const gap = 3.2;
  const bevel = 11;
  for (let y = 0; y < SIZE; y++) {
    const r = Math.floor(y / COURSE_PX);
    const course = courses[r];
    const ly = y - r * COURSE_PX;
    for (let x = 0; x < SIZE; x++) {
      const idx = y * SIZE + x;
      // find block (x may need +SIZE to fall inside [start, start+SIZE))
      let xx = x;
      const b0 = course.blocks[0].x0;
      if (xx < b0) xx += SIZE;
      let blk = course.blocks[course.blocks.length - 1];
      for (const b of course.blocks) {
        if (xx >= b.x0 && xx < b.x1) {
          blk = b;
          break;
        }
      }
      const f = fbm(x, y);
      const wobble = (n32(x, y) - 0.5) * 5;
      const dx = Math.min(xx - blk.x0, blk.x1 - xx) + wobble;
      const dyTop = ly + (n16(x, y) - 0.5) * 4;
      const dyBot = COURSE_PX - ly + (n16(x + 97, y) - 0.5) * 4;
      const d = Math.min(dx, dyTop, dyBot) - gap;
      const fine = n128(x, y);
      surf[idx] = f;
      if (d <= 0) {
        isMortar[idx] = 1;
        height[idx] = 0.08 + fine * 0.06;
      } else {
        const t = Math.min(1, d / bevel);
        const rounded = Math.sin(t * Math.PI * 0.5);
        // weathered face: low-frequency bulge + pitting
        let h = 0.45 + rounded * 0.4 + (f - 0.5) * 0.22 + (fine - 0.5) * 0.06 + blk.tilt * ((ly / COURSE_PX) - 0.5);
        // chipped corners / pits
        const pit = n64(x + blk.id * 13, y);
        if (pit > 0.78 && blk.chip > 0.4) h -= (pit - 0.78) * 1.4 * (1 - t * 0.5);
        height[idx] = h;
      }
      blockTone[idx] = blk.tone;
      blockHue[idx] = blk.hueJ;
    }
  }

  // Normal map (central differences, wrapping) + AO + roughness
  const normalImg = new ImageData(SIZE, SIZE);
  const ormImg = new ImageData(SIZE, SIZE); // R = AO, G = roughness, B = metalness(0)
  const strength = 5.5;
  for (let y = 0; y < SIZE; y++) {
    const ym = ((y - 1 + SIZE) % SIZE) * SIZE;
    const yp = ((y + 1) % SIZE) * SIZE;
    for (let x = 0; x < SIZE; x++) {
      const xm = (x - 1 + SIZE) % SIZE;
      const xp = (x + 1) % SIZE;
      const idx = y * SIZE + x;
      const hx = height[y * SIZE + xp] - height[y * SIZE + xm];
      const hy = height[yp + x] - height[ym + x];
      let nx = -hx * strength;
      let ny = hy * strength; // canvas y down -> tangent-space y up
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i4 = idx * 4;
      normalImg.data[i4] = ((nx / len) * 0.5 + 0.5) * 255;
      normalImg.data[i4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normalImg.data[i4 + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      normalImg.data[i4 + 3] = 255;
      const h = height[idx];
      const ao = isMortar[idx] ? 0.45 : Math.min(1, 0.55 + h * 0.6);
      const rough = isMortar[idx] ? 0.95 : 0.7 + (1 - surf[idx]) * 0.25;
      ormImg.data[i4] = ao * 255;
      ormImg.data[i4 + 1] = Math.min(1, rough) * 255;
      ormImg.data[i4 + 2] = 0;
      ormImg.data[i4 + 3] = 255;
    }
  }

  BASE = { height, blockTone, blockHue, isMortar, surf, normalImg, ormImg };
  return BASE;
}

function canvasFrom(img) {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function texFrom(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let SHARED = null;
function sharedMaps() {
  if (SHARED) return SHARED;
  const b = buildBase();
  SHARED = { normalMap: texFrom(canvasFrom(b.normalImg), false), ormMap: texFrom(canvasFrom(b.ormImg), false) };
  return SHARED;
}

// Albedo: blend of neutral weathered stone and the tower's palette
function albedoCanvas(colA, colB, mortarCol, tintAmount, seed) {
  const b = buildBase();
  const img = new ImageData(SIZE, SIZE);
  const A = new THREE.Color(colA);
  const B = new THREE.Color(colB);
  const M = new THREE.Color(mortarCol);
  const stoneA = new THREE.Color('#8a8f98');
  const stoneB = new THREE.Color('#6f7179');
  const tmp = new THREE.Color();
  const tmp2 = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  const rand = mulberry32(seed);
  const speck = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < speck.length; i++) speck[i] = rand();
  // Work in sRGB space for the canvas
  const toSRGB = (c) => c; // THREE.Color stores linear; we convert with getStyle-less math below
  for (let i = 0; i < SIZE * SIZE; i++) {
    const i4 = i * 4;
    if (b.isMortar[i]) {
      tmp.copy(M).lerp(tmp2.set('#2a2c33'), 0.35);
      const k = 0.8 + b.surf[i] * 0.4;
      tmp.multiplyScalar(k);
    } else {
      const t = b.blockTone[i];
      tmp.copy(stoneA).lerp(stoneB, t);
      tmp2.copy(A).lerp(B, t);
      tmp.lerp(tmp2, tintAmount);
      tmp.getHSL(hsl);
      tmp.setHSL(hsl.h + b.blockHue[i] * 0.03, hsl.s * (0.85 + b.blockHue[i] * 0.3), hsl.l * (0.82 + t * 0.3));
      // weathering: face mottling + fine speckle + darker in pits
      const mott = 0.72 + b.surf[i] * 0.5;
      const sp = speck[i] > 0.985 ? 1.25 : speck[i] < 0.02 ? 0.7 : 1;
      const pit = Math.min(1, Math.max(0.55, b.height[i] * 1.25));
      tmp.multiplyScalar(mott * sp * pit);
    }
    tmp.toArray(img.data, i4); // linear floats; convert below
    const r = Math.pow(Math.min(1, Math.max(0, img.data[i4] / 1)), 1 / 2.2);
    img.data[i4] = Math.min(255, tmp.r <= 0 ? 0 : Math.pow(tmp.r, 1 / 2.2) * 255);
    img.data[i4 + 1] = Math.min(255, tmp.g <= 0 ? 0 : Math.pow(tmp.g, 1 / 2.2) * 255);
    img.data[i4 + 2] = Math.min(255, tmp.b <= 0 ? 0 : Math.pow(tmp.b, 1 / 2.2) * 255);
    img.data[i4 + 3] = 255;
    void r;
    void toSRGB;
  }
  return canvasFrom(img);
}

// Sparse glowing glyphs set into a few mortar joints (the towers are alien machines)
function runeCanvas(glow, seed) {
  const b = buildBase();
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const rand = mulberry32(seed * 31 + 5);
  ctx.strokeStyle = glow;
  ctx.lineWidth = 2;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 6;
  // A few small carved glyphs (ring-and-dot / diamond / crescent), not arrows
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(rand() * SIZE);
    const row = Math.floor(rand() * (SIZE / COURSE_PX));
    const y = row * COURSE_PX + 24 + Math.floor(rand() * 16);
    if (b.isMortar[y * SIZE + x]) continue;
    const kind = k % 3;
    ctx.beginPath();
    if (kind === 0) {
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.moveTo(x + 1.5, y);
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    } else if (kind === 1) {
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
    } else {
      ctx.arc(x, y, 6, Math.PI * 0.2, Math.PI * 1.8);
    }
    ctx.stroke();
  }
  return c;
}

const towerCache = new Map();

// Material for the tower body (cylinder). Wet, algae-stained stone near the waterline is added
// in the shader using world height.
export function createTowerStoneMaterial(pal, towerId, floors) {
  const maps = sharedMaps();
  const key = `${pal.brickA}|${pal.brickB}|${pal.mortar}`;
  let albedo = towerCache.get(key);
  if (!albedo) {
    albedo = texFrom(albedoCanvas(pal.brickA, pal.brickB, pal.mortar, 0.55, towerId * 977 + 3), true);
    towerCache.set(key, albedo);
  }
  const runes = texFrom(runeCanvas(pal.glow, towerId), true);
  const circumference = 2 * Math.PI * 2.55;
  const rep = new THREE.Vector2(Math.round(circumference / 4), floors / 4);
  const map = albedo.clone();
  map.repeat.copy(rep);
  map.needsUpdate = true;
  const normalMap = maps.normalMap.clone();
  normalMap.repeat.copy(rep);
  normalMap.needsUpdate = true;
  const orm = maps.ormMap.clone();
  orm.repeat.copy(rep);
  orm.needsUpdate = true;
  runes.repeat.copy(rep);

  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    aoMap: orm,
    aoMapIntensity: 1,
    roughnessMap: orm,
    roughness: 1,
    metalness: 0,
    emissive: new THREE.Color(pal.glow),
    emissiveMap: runes,
    emissiveIntensity: 0.6,
  });
  addWaterlineWetness(mat);
  return mat;
}

// Neutral stone for ledges; tint with material.color
export function createLedgeStoneMaterial(color, { roughness = 1, emissive = '#000000', emissiveIntensity = 0 } = {}) {
  const maps = sharedMaps();
  if (!SHARED.neutralAlbedo) SHARED.neutralAlbedo = texFrom(albedoCanvas('#9aa0aa', '#7d828c', '#3a3d44', 0, 4242), true);
  const rep = new THREE.Vector2(0.25, 0.25);
  const map = SHARED.neutralAlbedo.clone();
  map.repeat.copy(rep);
  map.needsUpdate = true;
  const normalMap = maps.normalMap.clone();
  normalMap.repeat.copy(rep);
  normalMap.needsUpdate = true;
  const orm = maps.ormMap.clone();
  orm.repeat.copy(rep);
  orm.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    color,
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: orm,
    roughness,
    metalness: 0,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  });
  addWaterlineWetness(mat);
  return mat;
}

// Darkens + glosses the stone just above the sea, with a green-brown algae band
function addWaterlineWetness(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.waterY = mat.userData.waterY || (mat.userData.waterY = { value: -0.62 });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosW;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 wpW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wpW = instanceMatrix * wpW;
        #endif
        vWorldPosW = (modelMatrix * wpW).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosW;\nuniform float waterY;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float wetK = 1.0 - smoothstep(waterY + 0.1, waterY + 1.6, vWorldPosW.y);
        float algae = wetK * smoothstep(0.35, 0.75, fract(sin(dot(floor(vWorldPosW.xz * 6.0 + vWorldPosW.y * 3.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.4 + 0.45);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.5, 0.4), wetK * 0.75);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.14, 0.07), algae * 0.35);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, (1.0 - smoothstep(waterY + 0.1, waterY + 1.4, vWorldPosW.y)) * 0.85);`
      );
  };
  mat.customProgramCacheKey = () => 'wetstone';
}

export function setWaterlineY(materials, y) {
  for (const m of materials) if (m.userData.waterY) m.userData.waterY.value = y;
}

// ---------------------------------------------------------------------------------------------
// Brick: fired-clay face texture for the instanced brick towers. The albedo is near-white with
// mottling and sand grains (each brick's colour comes from its instance colour); the normal map is
// fine pitting. Every instance samples a different part of the tile so no two bricks repeat, and
// faces turning away from the camera darken a little so the cylinder reads as round.
// ---------------------------------------------------------------------------------------------
const BRICK_TEX = 256;
let BRICK_MAPS = null;
function brickMaps() {
  if (BRICK_MAPS) return BRICK_MAPS;
  const N = BRICK_TEX;
  const rand = mulberry32(4711);
  const lat = (p) => {
    const g = new Float32Array(p * p);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const fx = (x / N) * p;
      const fy = (y / N) * p;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const ux = tx * tx * (3 - 2 * tx);
      const uy = ty * ty * (3 - 2 * ty);
      const x0 = ix % p;
      const x1 = (x0 + 1) % p;
      const y0 = iy % p;
      const y1 = (y0 + 1) % p;
      const a = g[y0 * p + x0];
      const b = g[y0 * p + x1];
      const c = g[y1 * p + x0];
      const d = g[y1 * p + x1];
      return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
    };
  };
  const n4 = lat(4);
  const n8 = lat(8);
  const n16 = lat(16);
  const n32 = lat(32);
  const n64 = lat(64);
  const h = new Float32Array(N * N);
  const alb = new ImageData(N, N);
  const orm = new ImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const broad = n4(x, y) * 0.5 + n8(x, y) * 0.5;
      const mid = n16(x, y);
      const fine = n32(x, y) * 0.6 + n64(x, y) * 0.4;
      const grain = rand();
      // pits: sharp little dents
      const pit = Math.max(0, n64(x + 31, y + 17) - 0.84) * 3.2;
      h[i] = broad * 0.35 + mid * 0.2 + fine * 0.18 - pit * 0.35 + (grain - 0.5) * 0.04;
      // albedo: firing variation (darker clouds), sand grains, a few dark flecks
      let v = 0.88 + (broad - 0.5) * 0.16 + (mid - 0.5) * 0.06 + (grain - 0.5) * 0.05;
      if (grain > 0.996) v *= 0.7;
      v *= 1 - pit * 0.15;
      const c = Math.max(0, Math.min(1, v));
      alb.data[i * 4] = c * 255;
      alb.data[i * 4 + 1] = c * 0.985 * 255;
      alb.data[i * 4 + 2] = c * 0.97 * 255;
      alb.data[i * 4 + 3] = 255;
      orm.data[i * 4] = 255;
      orm.data[i * 4 + 1] = Math.min(1, 0.78 + fine * 0.18 + pit * 0.1) * 255;
      orm.data[i * 4 + 2] = 0;
      orm.data[i * 4 + 3] = 255;
    }
  }
  const nrm = new ImageData(N, N);
  const k = 3.2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
      const hy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
      const nx = -hx * k;
      const ny = hy * k;
      const l = Math.hypot(nx, ny, 1);
      nrm.data[i * 4] = ((nx / l) * 0.5 + 0.5) * 255;
      nrm.data[i * 4 + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      nrm.data[i * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nrm.data[i * 4 + 3] = 255;
    }
  }
  const cv = (img) => {
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  };
  BRICK_MAPS = { map: texFrom(cv(alb), true), normalMap: texFrom(cv(nrm), false), orm: texFrom(cv(orm), false) };
  return BRICK_MAPS;
}

// ---------------------------------------------------------------------------------------------
// Reboot wall surfaces: one tileable set of maps per material (stone, wood grain, brushed metal,
// marble veins, crystal facets, glassy obsidian). u runs round the tower, v runs up it.
// ---------------------------------------------------------------------------------------------
const SURFACE_MAPS = {};
export function surfaceMaps(kind) {
  if (SURFACE_MAPS[kind]) return SURFACE_MAPS[kind];
  const N = 256;
  const rand = mulberry32({ stone: 11, wood: 23, brushed: 37, marble: 41, crystal: 53, glass: 67, straw: 71, bamboo: 79, strata: 83, patina: 89, frost: 97, paint: 101 }[kind] || 7);
  // tileable value noise with separate x and y frequencies (px, py cells across the tile)
  const lat = (px, py = px) => {
    const g = new Float32Array(px * py);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const fx = (((x / N) * px) % px + px) % px;
      const fy = (((y / N) * py) % py + py) % py;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const ux = tx * tx * (3 - 2 * tx);
      const uy = ty * ty * (3 - 2 * ty);
      const x1 = (ix + 1) % px;
      const y1 = (iy + 1) % py;
      const a = g[iy * px + ix];
      const b = g[iy * px + x1];
      const c = g[y1 * px + ix];
      const d = g[y1 * px + x1];
      return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
    };
  };
  // tileable Voronoi: nearest and second-nearest feature point, and the nearest cell's id
  const voronoi = (G) => {
    const pts = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + 0.15 + rand() * 0.7) / G, (j + 0.15 + rand() * 0.7) / G, rand(), rand(), rand()]);
    return (x, y) => {
      const u = x / N;
      const v = y / N;
      const ci = Math.floor(u * G);
      const cj = Math.floor(v * G);
      let d1 = 9;
      let d2 = 9;
      let best = null;
      let bdx = 0;
      let bdy = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = ci + di;
          const jj = cj + dj;
          const P = pts[(((jj % G) + G) % G) * G + (((ii % G) + G) % G)];
          const px = P[0] + Math.floor(ii / G);
          const py = P[1] + Math.floor(jj / G);
          const dx = u - px;
          const dy = v - py;
          const d = Math.hypot(dx, dy) * G;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = P;
            bdx = dx * G;
            bdy = dy * G;
          } else if (d < d2) d2 = d;
        }
      return { d1, d2, cell: best, dx: bdx, dy: bdy };
    };
  };
  const h = new Float32Array(N * N);
  const alb = new ImageData(N, N);
  const orm = new ImageData(N, N);
  const nrmDirect = kind === 'crystal' ? new Float32Array(N * N * 2) : null;
  const n4 = lat(4);
  const n8 = lat(8);
  const n16 = lat(16);
  const n32 = lat(32);
  const n64 = lat(64);
  const streak = lat(3, 128); // long horizontal streaks
  const streak2 = lat(6, 256);
  const scr = lat(4, 192); // the odd long scratch
  const vor = kind === 'crystal' ? voronoi(5) : kind === 'glass' ? voronoi(4) : kind === 'stone' ? voronoi(6) : kind === 'frost' ? voronoi(5) : null;
  const fib = lat(96, 4); // vertical fibres (straw)
  const fib2 = lat(160, 8);
  const band = lat(2, 24); // horizontal strata (sandstone)
  const blot = lat(6); // patina blotches
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const broad = n4(x, y) * 0.5 + n8(x, y) * 0.5;
      const mid = n16(x, y);
      const fine = n32(x, y) * 0.6 + n64(x, y) * 0.4;
      const grain = rand();
      let ht = 0;
      let r = 1;
      let g = 1;
      let b = 1;
      let rough = 1;
      let metal = 1;
      if (kind === 'stone') {
        // rough-hewn: big soft lumps, chisel pits, hairline cracks along cell edges, pale lichen
        const V = vor(x, y);
        const crack = 1 - Math.min(1, (V.d2 - V.d1) / 0.05);
        const pit = Math.max(0, n64(x + 31, y + 17) - 0.78) * 3;
        ht = broad * 0.5 + mid * 0.3 + fine * 0.25 - pit * 0.5 - crack * 0.35 + (grain - 0.5) * 0.06;
        let v = 0.8 + (broad - 0.5) * 0.35 + (mid - 0.5) * 0.12 + (grain - 0.5) * 0.08 - crack * 0.3 - pit * 0.12;
        r = g = b = v;
        const lichen = Math.max(0, n16(x + 7, y + 3) * 0.6 + n64(x, y) * 0.4 - 0.66) * 4;
        r += lichen * 0.12;
        g += lichen * 0.16;
        b -= lichen * 0.02;
        rough = 0.9 + fine * 0.1;
      } else if (kind === 'wood') {
        // planks: grain running round the tower, warped growth rings, darker late-wood streaks, knots
        const warp = n4(x, y) * 3 + n16(x, y) * 0.6;
        const ring = 0.5 + 0.5 * Math.sin(((y / N) * 18 + warp) * Math.PI * 2);
        const st = streak(x, y);
        const st2 = streak2(x, y);
        const k = n8(x + 13, y + 29);
        const knot = Math.max(0, k - 0.8) * 5;
        ht = ring * 0.18 + st * 0.25 + st2 * 0.15 - knot * 0.4 + (grain - 0.5) * 0.03;
        const v = 0.78 + (ring - 0.5) * 0.22 + (st - 0.5) * 0.18 + (st2 - 0.5) * 0.1 - knot * 0.35;
        r = v * 1.02;
        g = v * 0.97;
        b = v * 0.92;
        rough = 0.75 + st2 * 0.25;
      } else if (kind === 'brushed') {
        // brushed plate: fine horizontal lines, a few scratches, soft grime clouds
        const st = streak2(x, y);
        const scratch = Math.max(0, scr(x, y) - 0.86) * 5;
        const grime = Math.max(0, broad - 0.55) * 1.4;
        ht = st * 0.12 - scratch * 0.2 + (grain - 0.5) * 0.02;
        const v = 0.92 + (st - 0.5) * 0.12 - grime * 0.22 + scratch * 0.08;
        r = g = b = v;
        rough = 0.55 + st * 0.25 + grime * 0.5;
      } else if (kind === 'marble') {
        // polished marble: turbulent grey veins with the odd gold thread
        let turb = 0;
        turb += Math.abs(n4(x, y) - 0.5) * 1;
        turb += Math.abs(n8(x, y) - 0.5) * 0.5;
        turb += Math.abs(n16(x, y) - 0.5) * 0.25;
        turb += Math.abs(n32(x, y) - 0.5) * 0.125;
        const vein = Math.abs(Math.sin(((x / N) * 2 + (y / N) * 1 + turb * 2.2) * Math.PI * 2));
        const dark = 1 - Math.min(1, vein / 0.14);
        const thin = 1 - Math.min(1, Math.abs(Math.sin(((x / N) * 3 - (y / N) * 2 + turb * 3) * Math.PI * 2)) / 0.04);
        ht = -dark * 0.05 + (grain - 0.5) * 0.01;
        const v = 0.95 + (broad - 0.5) * 0.06 - dark * 0.42;
        r = v - thin * 0.05 + thin * 0.08;
        g = v - thin * 0.1 + thin * 0.04;
        b = v - thin * 0.25;
        rough = 0.35 + dark * 0.4;
      } else if (kind === 'paint') {
        // painted boards: the grain shows faintly through the paint
        const warp = n4(x, y) * 3;
        const ring = 0.5 + 0.5 * Math.sin(((y / N) * 18 + warp) * Math.PI * 2);
        const st = streak2(x, y);
        ht = st * 0.1 + ring * 0.06;
        const v = 0.94 + (st - 0.5) * 0.06 + (ring - 0.5) * 0.04 - Math.max(0, broad - 0.62) * 0.25;
        r = g = b = v;
        rough = 0.6 + st * 0.2;
      } else if (kind === 'straw') {
        // thatch: bundles of straw fibres running up the tower, darker in the gaps
        const f1 = fib(x, y);
        const f2 = fib2(x, y);
        const gap = Math.max(0, 0.35 - f1) * 2;
        ht = f1 * 0.45 + f2 * 0.3 + (grain - 0.5) * 0.08;
        const v = 0.8 + (f1 - 0.5) * 0.35 + (f2 - 0.5) * 0.2 - gap * 0.45 + (broad - 0.5) * 0.1;
        r = v * 1.03;
        g = v;
        b = v * 0.9;
        rough = 1;
      } else if (kind === 'bamboo') {
        // glossy culm: fine lengthwise fibres
        const f2 = fib2(x, y);
        ht = f2 * 0.08;
        const v = 0.9 + (f2 - 0.5) * 0.1 + (broad - 0.5) * 0.1;
        r = g = b = v;
        rough = 0.4 + f2 * 0.2;
      } else if (kind === 'strata') {
        // sandstone: wavy bedding layers, sand grains, soft erosion
        const layer = band(x + n16(x, y) * 30, y + n8(x, y) * 14);
        const pit = Math.max(0, n64(x + 9, y + 5) - 0.8) * 2.5;
        ht = layer * 0.4 + fine * 0.15 - pit * 0.3 + (grain - 0.5) * 0.08;
        const v = 0.8 + (layer - 0.5) * 0.4 + (fine - 0.5) * 0.08 + (grain - 0.5) * 0.08 - pit * 0.1;
        r = v * 1.02;
        g = v * 0.98;
        b = v * 0.94;
        rough = 1;
      } else if (kind === 'patina') {
        // copper going green: verdigris blooms over the brushed metal (not metallic where green)
        const st = streak2(x, y);
        const bl = blot(x, y) * 0.55 + n16(x, y) * 0.3 + n64(x, y) * 0.15;
        const green = Math.max(0, Math.min(1, (bl - 0.5) * 5));
        ht = st * 0.1 + green * 0.25 + (grain - 0.5) * 0.03 * green;
        const cu = [0.82, 0.5, 0.34];
        const vg = [0.36, 0.7, 0.6];
        const k2 = 0.95 + (st - 0.5) * 0.1;
        r = (cu[0] + (vg[0] - cu[0]) * green) * k2;
        g = (cu[1] + (vg[1] - cu[1]) * green) * k2;
        b = (cu[2] + (vg[2] - cu[2]) * green) * k2;
        rough = 0.35 + green * 0.6;
        metal = 1 - green;
      } else if (kind === 'frost') {
        // ice: cloudy depths, white fracture lines, tiny bubbles
        const V = vor(x, y);
        const crack = 1 - Math.min(1, (V.d2 - V.d1) / 0.025);
        const bubble = grain > 0.993 ? 1 : 0;
        ht = -crack * 0.2 + mid * 0.1;
        const v = 0.82 + (mid - 0.5) * 0.2 + (broad - 0.5) * 0.12 + crack * 0.3 + bubble * 0.2;
        r = v * 0.97;
        g = v;
        b = Math.min(1, v * 1.04);
        rough = 0.12 + crack * 0.5 + (fine > 0.68 ? 0.25 : 0);
      } else if (kind === 'crystal') {
        // facets: flat planes with sharp bright edges and cloudy inclusions
        const V = vor(x, y);
        const edge = 1 - Math.min(1, (V.d2 - V.d1) / 0.06);
        const c = V.cell;
        nrmDirect[i * 2] = (c[2] - 0.5) * 0.9;
        nrmDirect[i * 2 + 1] = (c[3] - 0.5) * 0.9;
        const v = 0.86 + (c[4] - 0.5) * 0.18 + edge * 0.25 + (mid - 0.5) * 0.08;
        r = v * 0.97;
        g = v;
        b = Math.min(1.2, v * 1.03);
        rough = 0.25 + (mid > 0.62 ? 0.4 : 0) + edge * 0.2;
      } else if (kind === 'glass') {
        // volcanic glass: conchoidal ripples round each fracture, glassy smooth
        const V = vor(x, y);
        const ripple = Math.sin(V.d1 * 26) * Math.exp(-V.d1 * 1.5);
        const edge = 1 - Math.min(1, (V.d2 - V.d1) / 0.04);
        ht = ripple * 0.09 + V.d1 * 0.2 - edge * 0.2;
        const v = 0.9 + ripple * 0.06 + (broad - 0.5) * 0.1 - edge * 0.2;
        r = g = b = v;
        rough = 0.3 + edge * 0.4 + (fine > 0.7 ? 0.3 : 0);
      }
      h[i] = ht;
      alb.data[i * 4] = Math.max(0, Math.min(1, r)) * 255;
      alb.data[i * 4 + 1] = Math.max(0, Math.min(1, g)) * 255;
      alb.data[i * 4 + 2] = Math.max(0, Math.min(1, b)) * 255;
      alb.data[i * 4 + 3] = 255;
      orm.data[i * 4] = 255;
      orm.data[i * 4 + 1] = Math.max(0, Math.min(1, rough)) * 255;
      orm.data[i * 4 + 2] = Math.max(0, Math.min(1, metal)) * 255;
      orm.data[i * 4 + 3] = 255;
    }
  }
  const nrm = new ImageData(N, N);
  const k = { stone: 4, wood: 2.4, brushed: 1.6, marble: 1, crystal: 1, glass: 2.4, straw: 3.4, bamboo: 1, strata: 3, patina: 1.6, frost: 1.4, paint: 1.2 }[kind] || 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      let nx;
      let ny;
      if (nrmDirect) {
        nx = nrmDirect[i * 2];
        ny = nrmDirect[i * 2 + 1];
      } else {
        const hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
        const hy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
        nx = -hx * k;
        ny = hy * k;
      }
      const l = Math.hypot(nx, ny, 1);
      nrm.data[i * 4] = ((nx / l) * 0.5 + 0.5) * 255;
      nrm.data[i * 4 + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      nrm.data[i * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nrm.data[i * 4 + 3] = 255;
    }
  }
  const cv = (img) => {
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  };
  SURFACE_MAPS[kind] = { map: texFrom(cv(alb), true), normalMap: texFrom(cv(nrm), false), orm: texFrom(cv(orm), false), metalMap: kind === 'patina' };
  return SURFACE_MAPS[kind];
}

// hi: colour the lit (top/left) bevels shift toward; brickHalf: [half width, half height] of one
// brick in its local space, for the per-brick face gradient
export function createBrickMaterial(
  color = '#ffffff',
  { roughness = 1, emissive = '#000000', emissiveIntensity = 0, edgeDarken = 0.32, hi = '#ffffff', brickHalf = [0.24, 0.11], surface = null, tile = 0.7, angular = false } = {}
) {
  const M = surface ? surfaceMaps(surface) : brickMaps();
  // ~1 tile per 1.4 world units: grains ~5 mm at brick scale
  const rep = new THREE.Vector2(tile, tile);
  const tex = (t) => {
    const c = t.clone();
    c.repeat.copy(rep);
    c.needsUpdate = true;
    return c;
  };
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: tex(M.map),
    normalMap: tex(M.normalMap),
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap: tex(M.orm),
    roughness,
    metalness: 0,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  });
  if (M.metalMap) mat.metalnessMap = mat.roughnessMap;
  addWaterlineWetness(mat);
  const wet = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    wet(shader, r);
    shader.uniforms.edgeDarken = { value: edgeDarken };
    shader.uniforms.brickHi = { value: new THREE.Color(hi) };
    shader.uniforms.brickHalf = { value: new THREE.Vector2(brickHalf[0], brickHalf[1]) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrickN;\nvarying vec2 vBrickP;' + (angular ? '\nattribute float aSpan;' : ''))
      .replace(
        '#include <begin_vertex>',
        angular
          ? `#include <begin_vertex>
        {
          // stretch the block round the tower (not straight sideways), so long boards stay curved
          float rr = length(transformed.xz);
          float aa = atan(transformed.x, transformed.z) * aSpan;
          transformed.x = sin(aa) * rr;
          transformed.z = cos(aa) * rr;
        }`
          : '#include <begin_vertex>'
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        ${
          angular
            ? `{
          float dA = atan(position.x, position.z) * (aSpan - 1.0);
          float cd = cos(dA);
          float sd = sin(dA);
          objectNormal.xz = vec2(objectNormal.x * cd + objectNormal.z * sd, objectNormal.z * cd - objectNormal.x * sd);
        }`
            : ''
        }
        // the normal and position in the wall's own frame (across, up, out), so long curved
        // blocks shade like small ones
        {
          vec2 rad = length(position.xz) > 1e-4 ? normalize(position.xz) : vec2(0.0, 1.0);
          vec2 tng = vec2(rad.y, -rad.x);
          vBrickN = vec3(dot(objectNormal.xz, tng), objectNormal.y, dot(objectNormal.xz, rad));
          vBrickP = vec2(atan(position.x, position.z) * length(position.xz), position.y);
        }`
      )
      .replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      #ifdef USE_INSTANCING
        vec2 brickUvOff = fract(vec2(float(gl_InstanceID) * 0.6180339, float(gl_InstanceID) * 0.3819660)) * 7.0;
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
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float waterY;', 'uniform float waterY;\nuniform float edgeDarken;\nuniform vec3 brickHi;\nuniform vec2 brickHalf;\nvarying vec3 vBrickN;\nvarying vec2 vBrickP;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        #ifdef USE_INSTANCING
        {
          // Every brick reads on its own, like the 1987 bricks: the top and left bevels catch a
          // bright warm highlight, the bottom and right bevels fall into shadow, and the face
          // itself is a touch lighter toward its top-left corner.
          vec3 bn = normalize(vBrickN);
          float hiK = clamp(smoothstep(0.25, 0.8, bn.y) + 0.65 * smoothstep(0.25, 0.8, -bn.x), 0.0, 1.0);
          float loK = clamp(smoothstep(0.25, 0.8, -bn.y) + 0.65 * smoothstep(0.25, 0.8, bn.x), 0.0, 1.0);
          vec2 fp = clamp(vec2(vBrickP.x / brickHalf.x, (vBrickP.y - brickHalf.y) / brickHalf.y), -1.0, 1.0);
          float grad = fp.y * 0.6 - fp.x * 0.4;
          diffuseColor.rgb *= 1.0 + grad * 0.1;
          vec3 lum = vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15)));
          diffuseColor.rgb = mix(diffuseColor.rgb, brickHi * max(lum * 2.4, vec3(0.4)), hiK * 0.75);
          diffuseColor.rgb *= 1.0 - loK * 0.65;
        }
        #endif`
      )
      .replace(
        '#include <opaque_fragment>',
        `{
          // a little bounce light so bricks in a ledge's shadow still read as coloured brick
          outgoingLight += diffuseColor.rgb * 0.07;
          float ndv = abs(dot(normalize(vNormal), normalize(vViewPosition)));
          outgoingLight *= mix(1.0 - edgeDarken, 1.0, smoothstep(0.08, 0.75, ndv));
        }
        #include <opaque_fragment>`
      );
  };
  mat.customProgramCacheKey = () => (angular ? 'wetbrickA' : 'wetbrick');
  if (surface) mat.userData.surface = surface;
  return mat;
}
