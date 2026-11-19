// ============================================================================
// Towering Waters: Gateway's Descent — Multi-Biome Waterline Rapids, Maelstrom
// Surf, Volumetric Sanctum Mist, Geyser Vents & Conduit Sparks (`src/oceanVfx.js`)
//
// Exports `TowerFluidAndSparkVFX`:
//   - constructor(scene, opts)
//   - setTheme(theme)
//   - setEra(_era)
//   - setPurification(progress) / setRestored(restored)
//   - rebuildForTower(tower, fh, towerRadius)
//   - update(state, camCol, time, dt)
//   - setVisible(visible)
//   - dispose()
//
// Scaled for V3 AAA World (`COLS = 20`, `TOWER_RADIUS = 3.75`, `FLOOR_HEIGHT = 1.50`)
// across all 5 Earth Water Biomes (`canyon_river`, `alpine_lake`, `mist_bayou`,
// `coral_sea`, `storm_ocean`) with ZERO per-frame heap/GC allocations!
// ============================================================================

import * as THREE from 'three';

const DEFAULT_COLS = 20;
const MAX_COLS = 32;
const TWO_PI = Math.PI * 2;
const DEFAULT_TOWER_RADIUS = 3.75;
const DEFAULT_FH = 1.50;

// Pre-allocated GPU pool capacities (7-8 draw calls total, < 5.6k tris total!)
const SURF_CREST_COUNT = 64;
const MAX_SURF_PLUMES = 96;
const MAX_SEA_DROPLETS = 520;
const MAX_MIST_WISPS = 256;
const SEA_MIST_SLOTS = 64;
const MAX_STEAM_PUFFS = 128;
const MAX_SPARKS = 720;
const MAX_SPARK_GLOWS = 36;
const SPARK_LIGHT_POOL = 2;

const MAX_DOOR_EMITTERS = 32;
const MAX_LEDGE_MIST_EMITTERS = 28;
const MAX_SPARK_ARCH_EMITTERS = 12;
const MAX_STEAM_VENT_EMITTERS = 16;
const MAX_GRID_FLOORS = 128;

const VFX_BIOME_MAP = Object.freeze({
  canyon_river: 'canyon_river',
  canyon: 'canyon_river',
  river: 'canyon_river',
  redwood: 'canyon_river',
  foundry: 'canyon_river',
  piston: 'canyon_river',

  alpine_lake: 'alpine_lake',
  alpine: 'alpine_lake',
  lake: 'alpine_lake',
  glacier: 'alpine_lake',
  blizzard: 'alpine_lake',

  mist_bayou: 'mist_bayou',
  bayou: 'mist_bayou',
  delta: 'mist_bayou',
  swamp: 'mist_bayou',
  mist: 'mist_bayou',
  dusk: 'mist_bayou',

  coral_sea: 'coral_sea',
  coral: 'coral_sea',
  reef: 'coral_sea',
  lagoon: 'coral_sea',
  sea: 'coral_sea',
  sinking: 'coral_sea',
  prism: 'coral_sea',
  day: 'coral_sea',

  storm_ocean: 'storm_ocean',
  ocean: 'storm_ocean',
  polar: 'storm_ocean',
  tempest: 'storm_ocean',
  maelstrom: 'storm_ocean',
  blackout: 'storm_ocean',
  apex: 'storm_ocean',
  moonlit_storm: 'storm_ocean',
  storm: 'storm_ocean',
});

const CANONICAL_BIOMES = ['canyon_river', 'alpine_lake', 'mist_bayou', 'coral_sea', 'storm_ocean'];

export function resolveVfxBiome(raw, towerId = 1) {
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (VFX_BIOME_MAP[k]) return VFX_BIOME_MAP[k];
  }
  const idx = Math.floor((Math.max(1, Number(towerId) || 1) - 1) / 2) % CANONICAL_BIOMES.length;
  return CANONICAL_BIOMES[idx];
}

function wrapAngle(a) {
  let r = a % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  if (r < -Math.PI) r += TWO_PI;
  return r;
}

function wrapPositiveAngle(a) {
  let r = a % TWO_PI;
  if (r < 0) r += TWO_PI;
  return r;
}

function wrapColIndex(c, cols) {
  return ((c % cols) + cols) % cols;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createPeriodicNoise2D(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rng();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const hash = (ix, iy, px, py) => {
    const wx = ((ix % px) + px) % px;
    const wy = ((iy % py) + py) % py;
    return vals[perm[(wx & 255) + perm[wy & 255]]];
  };

  const noise = (x, y, px, py) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(x0, y0, px, py);
    const b = hash(x0 + 1, y0, px, py);
    const c = hash(x0, y0 + 1, px, py);
    const d = hash(x0 + 1, y0 + 1, px, py);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  const fbm = (u, v, baseFreq = 4, octaves = 4) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let freq = baseFreq;
    for (let o = 0; o < octaves; o++) {
      sum += noise(u * freq, v * freq, freq, freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  };

  return { noise, fbm };
}

// 1. Seamless Tileable Cellular Voronoi Lacy Whitewater Foam + FBM Billow Texture (128x128 fast bake)
function createLacyFoamTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const rng = mulberry32(90210);
  const { fbm } = createPeriodicNoise2D(42427);

  const cellGridA = 7;
  const ptsAx = new Float32Array(cellGridA * cellGridA);
  const ptsAy = new Float32Array(cellGridA * cellGridA);
  for (let cy = 0; cy < cellGridA; cy++) {
    for (let cx = 0; cx < cellGridA; cx++) {
      const idx = cy * cellGridA + cx;
      ptsAx[idx] = cx + 0.14 + rng() * 0.72;
      ptsAy[idx] = cy + 0.14 + rng() * 0.72;
    }
  }

  const cellGridB = 14;
  const ptsBx = new Float32Array(cellGridB * cellGridB);
  const ptsBy = new Float32Array(cellGridB * cellGridB);
  for (let cy = 0; cy < cellGridB; cy++) {
    for (let cx = 0; cx < cellGridB; cx++) {
      const idx = cy * cellGridB + cx;
      ptsBx[idx] = cx + 0.12 + rng() * 0.76;
      ptsBy[idx] = cy + 0.12 + rng() * 0.76;
    }
  }

  const voronoiEdge = (u, v, g, px, py) => {
    const gx = u * g;
    const gy = v * g;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    let d1 = 99;
    let d2 = 99;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const nx = ix + ox;
        const ny = iy + oy;
        const wx = ((nx % g) + g) % g;
        const wy = ((ny % g) + g) % g;
        const id = wy * g + wx;
        const fx = px[id] + (nx - wx);
        const fy = py[id] + (ny - wy);
        const dx = gx - fx;
        const dy = gy - fy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
        } else if (dist < d2) {
          d2 = dist;
        }
      }
    }
    const border = 1.0 - Math.min(1.0, (d2 - d1) * 2.65);
    return border * border;
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const warpX = fbm(u, v, 4, 3) - 0.5;
      const warpY = fbm(v + 0.37, u + 0.19, 4, 3) - 0.5;
      const wu = (((u + warpX * 0.11) % 1) + 1) % 1;
      const wv = (((v + warpY * 0.11) % 1) + 1) % 1;

      const laceMacro = voronoiEdge(wu, wv, cellGridA, ptsAx, ptsAy);
      const laceMicro = voronoiEdge(wu, wv, cellGridB, ptsBx, ptsBy);
      const body = fbm(wu, wv, 5, 4);
      const spume = fbm(u, v, 16, 2);

      const lace = Math.min(1.0, laceMacro * 0.72 + laceMicro * 0.52 + Math.max(0, body - 0.46) * 0.78);
      const softBody = Math.min(1.0, Math.max(0.0, (body - 0.20) * 1.42));
      const sparkle = Math.min(1.0, Math.pow(Math.max(0, spume), 2.1) * 1.6);

      const i4 = (y * size + x) * 4;
      data[i4] = Math.round(lace * 255);
      data[i4 + 1] = Math.round(softBody * 255);
      data[i4 + 2] = Math.round(sparkle * 255);
      data[i4 + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

// 2. 2x2 Quadrant Domain-Warped FBM Volumetric Mist Wisp Atlas (128x128 fast bake)
function createVolumetricWispAtlas(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const half = size >> 1;
  const qCenter = half * 0.5;
  const maxSafeR = qCenter * 0.73;

  const generators = [
    createPeriodicNoise2D(1031),
    createPeriodicNoise2D(2053),
    createPeriodicNoise2D(3079),
    createPeriodicNoise2D(4099),
  ];

  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      const qIdx = qy * 2 + qx;
      const { fbm } = generators[qIdx];
      const ox = qx * half;
      const oy = qy * half;

      for (let ly = 0; ly < half; ly++) {
        for (let lx = 0; lx < half; lx++) {
          const dx = (lx + 0.5 - qCenter) / maxSafeR;
          const stretchY = qIdx % 2 === 1 ? 1.14 : 1.0;
          const dy = ((ly + 0.5 - qCenter) / maxSafeR) * stretchY;
          const r = Math.sqrt(dx * dx + dy * dy);

          const px = ox + lx;
          const py = oy + ly;
          const i4 = (py * size + px) * 4;

          if (r >= 1.0) {
            data[i4] = 255;
            data[i4 + 1] = 255;
            data[i4 + 2] = 255;
            data[i4 + 3] = 0;
            continue;
          }

          const u = lx / half;
          const v = ly / half;
          const wx = fbm(u + 0.13 * qIdx, v + 0.29 * qIdx, 3, 4) - 0.5;
          const wy = fbm(v + 0.41 * qIdx, u + 0.71 * qIdx, 3, 4) - 0.5;
          const n1 = fbm(
            (((u + wx * 0.38) % 1) + 1) % 1,
            (((v + wy * 0.38) % 1) + 1) % 1,
            4,
            4
          );
          const n2 = fbm(
            (((u * 1.5 - wy * 0.24) % 1) + 1) % 1,
            (((v * 1.5 + wx * 0.24) % 1) + 1) % 1,
            6,
            3
          );

          const falloff = Math.pow(1.0 - r * r, 2.15);
          const wispy = Math.max(0.0, Math.min(1.0, (n1 * 0.68 + n2 * 0.32 - 0.16) * 1.68));
          const alpha = Math.min(1.0, falloff * (0.34 + 0.66 * wispy) * wispy * 1.42);

          const rimLift = Math.max(0.72, Math.min(1.0, 0.88 - dy * 0.14 + dx * 0.06 + n2 * 0.14));
          const lum = Math.round(rimLift * 255);

          data[i4] = lum;
          data[i4 + 1] = Math.min(255, lum + 4);
          data[i4 + 2] = 255;
          data[i4 + 3] = Math.round(alpha * 255);
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

// 3. 2x2 Quadrant Water-Spray Droplet & Spume Shred Atlas (256x256)
function createSpumeDropletAtlas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const half = size >> 1;
  const rng = mulberry32(771239);

  for (let qy = 0; qy < 2; qy++) {
    for (let qx = 0; qx < 2; qx++) {
      const qIdx = qy * 2 + qx;
      const cx = qx * half + half * 0.5;
      const cy = qy * half + half * 0.5;

      ctx.save();
      ctx.beginPath();
      ctx.rect(qx * half + 10, qy * half + 10, half - 20, half - 20);
      ctx.clip();

      for (let m = 0; m < 3; m++) {
        const ox = (rng() - 0.5) * 18;
        const oy = (rng() - 0.5) * 16;
        const mr = 15 + rng() * 15;
        ctx.save();
        ctx.translate(cx + ox, cy + oy);
        ctx.rotate(-0.45 + rng() * 0.9);
        ctx.scale(1.45, 0.72);
        const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, mr);
        mg.addColorStop(0.0, 'rgba(235, 250, 255, 0.28)');
        mg.addColorStop(0.55, 'rgba(195, 238, 255, 0.11)');
        mg.addColorStop(1.0, 'rgba(160, 220, 252, 0.0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(0, 0, mr, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      ctx.lineCap = 'round';
      const shredCount = 3 + (qIdx % 2);
      for (let f = 0; f < shredCount; f++) {
        const sx = cx + (rng() - 0.5) * 26;
        const sy = cy + 6 + (rng() - 0.5) * 18;
        const dirAng = -Math.PI * 0.5 + (rng() - 0.5) * 0.85;
        const len = 11 + rng() * 19;
        const lg = ctx.createLinearGradient(sx, sy, sx + Math.cos(dirAng) * len, sy + Math.sin(dirAng) * len);
        const aPeak = 0.34 + rng() * 0.32;
        lg.addColorStop(0.0, 'rgba(186, 230, 253, 0.0)');
        lg.addColorStop(0.45, `rgba(245, 253, 255, ${aPeak.toFixed(3)})`);
        lg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1.8 + rng() * 2.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(
          sx + Math.cos(dirAng + 0.22) * len * 0.55,
          sy + Math.sin(dirAng + 0.22) * len * 0.55,
          sx + Math.cos(dirAng) * len,
          sy + Math.sin(dirAng) * len
        );
        ctx.stroke();
      }

      const dropCount = 5 + qIdx;
      for (let d = 0; d < dropCount; d++) {
        const dx = cx + (rng() - 0.5) * 38 * Math.sqrt(rng());
        const dy = cy + (rng() - 0.5) * 38 * Math.sqrt(rng());
        const dr = d === 0 ? 4.8 + rng() * 3.0 : 2.0 + rng() * 3.4;
        const stretch = 1.15 + rng() * 1.15;
        const rot = -Math.PI * 0.45 + (rng() - 0.5) * 0.9;

        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(rot);
        ctx.scale(stretch, 1.0);

        const dg = ctx.createRadialGradient(dr * 0.2, 0, 0, 0, 0, dr);
        const peakA = d === 0 ? 0.94 : 0.58 + rng() * 0.38;
        dg.addColorStop(0.0, `rgba(255, 255, 255, ${peakA.toFixed(3)})`);
        dg.addColorStop(0.45, `rgba(235, 250, 255, ${(peakA * 0.72).toFixed(3)})`);
        dg.addColorStop(0.80, `rgba(182, 232, 255, ${(peakA * 0.22).toFixed(3)})`);
        dg.addColorStop(1.0, 'rgba(155, 218, 252, 0.0)');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(0, 0, dr, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function buildSurfApronGeometry(angSegs = 72, radSegs = 4) {
  const vertCount = (angSegs + 1) * (radSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  let vPtr = 0;
  let uPtr = 0;
  for (let r = 0; r <= radSegs; r++) {
    const rt = r / radSegs;
    for (let a = 0; a <= angSegs; a++) {
      const at = a / angSegs;
      const phi = at * TWO_PI;
      positions[vPtr++] = Math.sin(phi);
      positions[vPtr++] = rt;
      positions[vPtr++] = Math.cos(phi);

      uvs[uPtr++] = at * 7.0;
      uvs[uPtr++] = rt;
    }
  }

  for (let r = 0; r < radSegs; r++) {
    for (let a = 0; a < angSegs; a++) {
      const i0 = r * (angSegs + 1) + a;
      const i1 = i0 + 1;
      const i2 = i0 + (angSegs + 1);
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildSurfCrestTongueGeometry(uSegs = 5, vSegs = 4) {
  const vertCount = (uSegs + 1) * (vSegs + 1);
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];

  let pPtr = 0;
  let uvPtr = 0;
  for (let iv = 0; iv <= vSegs; iv++) {
    const v = iv / vSegs;
    const radialOut = (1.0 - v) * 0.30 + Math.sin(v * Math.PI) * 0.15 + v * v * 0.62;
    const heightY = -0.06 + v * 1.08;

    for (let iu = 0; iu <= uSegs; iu++) {
      const u = iu / uSegs;
      const centeredU = (u - 0.5) * 2.0;
      const crown = Math.max(0.18, 1.0 - centeredU * centeredU * 0.54);
      const fanSpread = 0.52 + v * 0.38;
      positions[pPtr++] = centeredU * fanSpread;
      positions[pPtr++] = heightY * crown;
      positions[pPtr++] = radialOut + Math.abs(centeredU) * 0.12 * v;

      uvs[uvPtr++] = u;
      uvs[uvPtr++] = v;
    }
  }

  for (let iv = 0; iv < vSegs; iv++) {
    for (let iu = 0; iu < uSegs; iu++) {
      const i0 = iv * (uSegs + 1) + iu;
      const i1 = i0 + 1;
      const i2 = i0 + (uSegs + 1);
      const i3 = i2 + 1;
      indices.push(i0, i1, i2, i1, i3, i2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export class TowerFluidAndSparkVFX {
  constructor(scene = null, opts = {}) {
    this.scene = scene;
    this.era = 'reboot';
    this.cols = opts.cols || DEFAULT_COLS;
    this.colAngle = TWO_PI / this.cols;
    this.fh = opts.fh || opts.floorHeight || DEFAULT_FH;
    this.towerRadius = opts.towerRadius || DEFAULT_TOWER_RADIUS;
    this._tower = null;
    this._towerFloors = 18;
    this._theme = resolveVfxBiome(opts.theme || 'canyon_river');
    this._forcedTheme = null;
    this._purification = 0;
    this._purificationTarget = 0;
    this._disposed = false;

    // Biome kinetics tuned per watershed
    this._biomeSurgeScale = 1.15;
    this._biomeMistRateScale = 1.0;
    this._biomeFlowDrift = 1.25;
    this._biomeVortexSpin = 0.0;

    this.group = new THREE.Group();
    this.group.name = 'TowerFluidAndSparkVFX';

    this.waterlineGroup = new THREE.Group();
    this.waterlineGroup.name = 'WatershedSurfAndSprayGroup';

    this.towerVfxGroup = new THREE.Group();
    this.towerVfxGroup.name = 'SpireMistSparkSteamGroup';

    this.group.add(this.waterlineGroup, this.towerVfxGroup);
    if (this.scene && typeof this.scene.add === 'function') {
      this.scene.add(this.group);
    }

    this._textures = [];
    this._geometries = [];
    this._materials = [];

    this.lacyFoamTex = createLacyFoamTexture(256);
    this.wispAtlasTex = createVolumetricWispAtlas(256);
    this.spumeDropTex = createSpumeDropletAtlas(256);
    this._textures.push(this.lacyFoamTex, this.wispAtlasTex, this.spumeDropTex);

    this._rngState = 0x51f15e26;
    this._prevToppleDropY = 0;

    this._basalStepBoost = new Float32Array(MAX_COLS);

    this._doorEmitterCount = 0;
    this._doorEmitterData = new Float32Array(MAX_DOOR_EMITTERS * 5);

    this._ledgeMistCount = 0;
    this._ledgeMistData = new Float32Array(MAX_LEDGE_MIST_EMITTERS * 4);

    this._sparkArchCount = 0;
    this._sparkArchData = new Float32Array(MAX_SPARK_ARCH_EMITTERS * 7);

    this._steamVentCount = 0;
    this._steamVentData = new Float32Array(MAX_STEAM_VENT_EMITTERS * 6);

    this._ledgeSurfaceGrid = new Float32Array(MAX_COLS * MAX_GRID_FLOORS);
    this._ledgeIndexGrid = new Int16Array(MAX_COLS * MAX_GRID_FLOORS);
    this._ledgeSurfaceGrid.fill(-1e6);
    this._ledgeIndexGrid.fill(-1);

    this._initSurfApron();
    this._initSurfCrests();
    this._initSurfPlumes();
    this._initSeaDroplets();
    this._initVolumetricMist();
    this._initSteamPlumes();
    this._initSparkStreaksAndGlows();

    this._applyThemePalette(this._theme);
  }

  _rand() {
    let x = this._rngState | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this._rngState = x;
    return (x >>> 0) / 4294967296;
  }

  _initSurfApron() {
    const geo = buildSurfApronGeometry(72, 4);
    this._geometries.push(geo);

    this.surfApronUniforms = {
      uTime: { value: 0 },
      uTowerRadius: { value: this.towerRadius },
      uSurge: { value: 1.0 },
      uSpinSpeed: { value: 0.0 },
      uFoamMap: { value: this.lacyFoamTex },
      uBrightColor: { value: new THREE.Color('#f4fcff') },
      uMidColor: { value: new THREE.Color('#6ee7d8') },
      uDeepTint: { value: new THREE.Color('#14b8a6') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.surfApronUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uTowerRadius;
        uniform float uSurge;
        varying vec2 vUv;
        varying float vRadial;
        varying float vWaveRunup;

        void main() {
          vec2 dir = normalize(position.xz);
          float rt = position.y;
          float phi = atan(dir.x, dir.y);

          float runup =
            sin(phi * 3.0 + uTime * 2.65) * 0.52 +
            cos(phi * 5.0 - uTime * 2.05) * 0.34 +
            sin(phi * 9.0 + uTime * 3.8) * 0.18;

          float span = 2.65 * (0.78 + 0.38 * uSurge);
          float r = (uTowerRadius - 0.12) + rt * span + max(0.0, runup) * 0.28 * (1.0 - rt * 0.45);

          float innerClimb = (1.0 - smoothstep(0.0, 0.36, rt)) * (0.08 + max(0.0, runup + 0.38) * 0.30 * uSurge);
          float outerChop = smoothstep(0.14, 0.9, rt) * (
            sin(dir.x * r * 0.55 + uTime * 3.1) * 0.14 +
            cos(dir.y * r * 0.68 + uTime * 2.5) * 0.09
          ) * clamp(uSurge, 0.35, 1.5);

          vec3 localPos = vec3(dir.x * r, 0.04 + innerClimb + outerChop, dir.y * r);
          vUv = uv;
          vRadial = rt;
          vWaveRunup = runup;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(localPos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSurge;
        uniform float uSpinSpeed;
        uniform sampler2D uFoamMap;
        uniform vec3 uBrightColor;
        uniform vec3 uMidColor;
        uniform vec3 uDeepTint;
        varying vec2 vUv;
        varying float vRadial;
        varying float vWaveRunup;

        void main() {
          float spinOff = uTime * (0.032 + uSpinSpeed * 0.14);
          vec2 uvA = vec2(vUv.x + spinOff, vRadial * 1.45 - uTime * 0.15);
          vec2 uvB = vec2(vUv.x * 1.33 - spinOff * 0.75 + 0.37, vRadial * 1.95 + uTime * 0.095);

          vec3 texA = texture2D(uFoamMap, uvA).rgb;
          vec3 texB = texture2D(uFoamMap, uvB).rgb;

          float lace = texA.r * 0.64 + texB.r * 0.56;
          float body = texA.g * 0.55 + texB.g * 0.45;
          float glint = texA.b * texB.b;

          float waveLobe = pow(clamp(0.52 + 0.48 * vWaveRunup, 0.0, 1.0), 1.35);
          float outerLimit = clamp(0.26 + waveLobe * 0.66 + (body - 0.5) * 0.38, 0.20, 0.96);
          float radialMask = 1.0 - smoothstep(outerLimit * 0.34, outerLimit, vRadial);

          float wallCollar = (1.0 - smoothstep(0.0, 0.28, vRadial)) * (0.64 + 0.36 * body);
          float lacyWeb = smoothstep(0.22 + vRadial * 0.42, 0.90, lace * 0.88 + body * 0.50) * (1.0 - vRadial * 0.38);

          float rawAlpha = (wallCollar * 0.84 + lacyWeb * 0.66) * radialMask;
          rawAlpha *= clamp(uSurge * 0.88, 0.36, 1.45);

          if (rawAlpha < 0.008) discard;

          vec3 col = mix(uDeepTint, uMidColor, clamp(body * 1.18, 0.0, 1.0));
          col = mix(col, uBrightColor, clamp(wallCollar * 0.88 + lace * 0.68 + glint * 1.45, 0.0, 1.0));

          gl_FragColor = vec4(col, clamp(rawAlpha, 0.0, 0.86));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(mat);

    this.surfApronMesh = new THREE.Mesh(geo, mat);
    this.surfApronMesh.frustumCulled = false;
    this.surfApronMesh.renderOrder = 6;
    this.waterlineGroup.add(this.surfApronMesh);
  }

  _initSurfCrests() {
    const baseGeo = buildSurfCrestTongueGeometry(5, 4);
    const instGeo = new THREE.InstancedBufferGeometry();
    instGeo.index = baseGeo.index;
    instGeo.attributes.position = baseGeo.attributes.position;
    instGeo.attributes.uv = baseGeo.attributes.uv;
    instGeo.instanceCount = SURF_CREST_COUNT;
    baseGeo.dispose();

    this._crestXformBuf = new Float32Array(SURF_CREST_COUNT * 4);
    this._crestStateBuf = new Float32Array(SURF_CREST_COUNT * 4);

    this._crestSim = new Float32Array(SURF_CREST_COUNT * 5);
    for (let i = 0; i < SURF_CREST_COUNT; i++) {
      const idx5 = i * 5;
      const jitter = (this._rand() - 0.5) * (TWO_PI / SURF_CREST_COUNT) * 0.65;
      this._crestSim[idx5] = wrapPositiveAngle((i / SURF_CREST_COUNT) * TWO_PI + jitter);
      this._crestSim[idx5 + 1] = 0.48 + this._rand() * 0.38;
      this._crestSim[idx5 + 2] = this._rand();
      this._crestSim[idx5 + 3] = this._rand();
      this._crestSim[idx5 + 4] = 0;
    }

    this._crestXformAttr = new THREE.InstancedBufferAttribute(this._crestXformBuf, 4);
    this._crestXformAttr.setUsage(THREE.DynamicDrawUsage);
    this._crestStateAttr = new THREE.InstancedBufferAttribute(this._crestStateBuf, 4);
    this._crestStateAttr.setUsage(THREE.DynamicDrawUsage);

    instGeo.setAttribute('aCrestXform', this._crestXformAttr);
    instGeo.setAttribute('aCrestState', this._crestStateAttr);
    this._geometries.push(instGeo);

    this.surfCrestUniforms = {
      uTime: { value: 0 },
      uTowerRadius: { value: this.towerRadius },
      uFoamMap: { value: this.lacyFoamTex },
      uCrestBright: { value: new THREE.Color('#f4fcff') },
      uCrestShadow: { value: new THREE.Color('#4fd8c8') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.surfCrestUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: /* glsl */ `
        uniform float uTowerRadius;
        attribute vec4 aCrestXform;
        attribute vec4 aCrestState;
        varying vec2 vUv;
        varying float vErode;
        varying float vAlpha;
        varying float vSeed;
        varying float vGrazing;

        void main() {
          float phiCenter = aCrestXform.x;
          float widthArc = aCrestXform.y;
          float heightScale = aCrestXform.z;
          float radialFlare = aCrestXform.w;

          float phi = phiCenter + position.x * widthArc;
          float r = uTowerRadius + 0.03 + position.z * radialFlare;
          float y = position.y * heightScale;

          vec3 cylPos = vec3(sin(phi) * r, y, cos(phi) * r);
          vec4 mvPos = modelViewMatrix * vec4(cylPos, 1.0);
          vec3 mvNormal = normalize(mat3(modelViewMatrix) * vec3(sin(phi), 0.28, cos(phi)));
          vec3 viewDir = normalize(-mvPos.xyz);

          vUv = uv;
          vErode = aCrestState.y;
          vAlpha = aCrestState.z;
          vSeed = aCrestState.w;
          vGrazing = smoothstep(0.08, 0.48, abs(dot(mvNormal, viewDir)));

          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uFoamMap;
        uniform vec3 uCrestBright;
        uniform vec3 uCrestShadow;
        varying vec2 vUv;
        varying float vErode;
        varying float vAlpha;
        varying float vSeed;
        varying float vGrazing;

        void main() {
          if (vAlpha <= 0.005 || vGrazing <= 0.01) discard;

          vec2 uv1 = vec2(vUv.x * 0.95 + vSeed * 3.1, vUv.y * 1.15 - uTime * 0.26 + vSeed);
          vec2 uv2 = vec2(vUv.x * 1.75 - vSeed * 1.7, vUv.y * 1.95 - uTime * 0.42);
          vec3 f1 = texture2D(uFoamMap, uv1).rgb;
          vec3 f2 = texture2D(uFoamMap, uv2).rgb;

          float foamDensity = f1.r * 0.58 + f2.r * 0.36 + f1.g * 0.44;
          float flankFade = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265);
          float baseFade = smoothstep(0.0, 0.16, vUv.y);
          float topFeather = 1.0 - smoothstep(0.22, 0.92, vUv.y);

          float envelope = flankFade * baseFade * topFeather * (0.28 + 0.72 * vGrazing);
          float threshold = vErode + (1.0 - envelope) * 0.58;
          float mask = smoothstep(threshold - 0.18, threshold + 0.22, foamDensity);

          float a = mask * envelope * vAlpha;
          if (a < 0.008) discard;

          float tipWhiteness = clamp(vUv.y * 0.78 + f1.r * 0.48 + f2.b * 0.36, 0.0, 1.0);
          vec3 col = mix(uCrestShadow, uCrestBright, tipWhiteness);

          gl_FragColor = vec4(col, clamp(a, 0.0, 0.44));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(mat);

    this.surfCrestMesh = new THREE.Mesh(instGeo, mat);
    this.surfCrestMesh.frustumCulled = false;
    this.surfCrestMesh.renderOrder = 7;
    this.waterlineGroup.add(this.surfCrestMesh);
  }

  _initSurfPlumes() {
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const instGeo = new THREE.InstancedBufferGeometry();
    instGeo.index = baseQuad.index;
    instGeo.attributes.position = baseQuad.attributes.position;
    instGeo.attributes.uv = baseQuad.attributes.uv;
    instGeo.instanceCount = MAX_SURF_PLUMES;
    baseQuad.dispose();

    this._plumePosBuf = new Float32Array(MAX_SURF_PLUMES * 4);
    this._plumeMetaBuf = new Float32Array(MAX_SURF_PLUMES * 4);

    this._plumeSim = new Float32Array(MAX_SURF_PLUMES * 15);
    for (let i = 0; i < MAX_SURF_PLUMES; i++) {
      this._plumeSim[i * 15 + 6] = 999;
      this._plumeSim[i * 15 + 7] = 1.0;
    }
    this._plumeCursor = 0;
    this._plumeAccum = 0;

    this._plumePosAttr = new THREE.InstancedBufferAttribute(this._plumePosBuf, 4);
    this._plumePosAttr.setUsage(THREE.DynamicDrawUsage);
    this._plumeMetaAttr = new THREE.InstancedBufferAttribute(this._plumeMetaBuf, 4);
    this._plumeMetaAttr.setUsage(THREE.DynamicDrawUsage);

    instGeo.setAttribute('aPlumePosScale', this._plumePosAttr);
    instGeo.setAttribute('aPlumeMeta', this._plumeMetaAttr);
    this._geometries.push(instGeo);

    this.surfPlumeUniforms = {
      uWispMap: { value: this.wispAtlasTex },
      uFoamMap: { value: this.lacyFoamTex },
      uTopFoam: { value: new THREE.Color('#f4fcff') },
      uShadowFoam: { value: new THREE.Color('#38b2ac') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.surfPlumeUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec4 aPlumePosScale;
        attribute vec4 aPlumeMeta;
        varying vec2 vUv;
        varying vec2 vLocal;
        varying float vAlpha;
        varying float vAtlas;
        varying float vSeed;

        void main() {
          vAlpha = aPlumeMeta.y;
          if (vAlpha <= 0.003) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          float rot = aPlumeMeta.x;
          vAtlas = aPlumeMeta.z;
          vSeed = aPlumeMeta.w;

          vec4 mvCenter = modelViewMatrix * vec4(aPlumePosScale.xyz, 1.0);
          float c = cos(rot);
          float s = sin(rot);
          vec2 corner = position.xy * aPlumePosScale.w;
          vec2 rotCorner = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
          mvCenter.xy += rotCorner;

          vUv = clamp(uv, 0.04, 0.96);
          vLocal = rotCorner / max(0.01, aPlumePosScale.w);
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uWispMap;
        uniform sampler2D uFoamMap;
        uniform vec3 uTopFoam;
        uniform vec3 uShadowFoam;
        varying vec2 vUv;
        varying vec2 vLocal;
        varying float vAlpha;
        varying float vAtlas;
        varying float vSeed;

        void main() {
          float idx = floor(vAtlas + 0.5);
          vec2 cellOffset = vec2(mod(idx, 2.0), floor(idx * 0.5)) * 0.5;
          vec4 wisp = texture2D(uWispMap, cellOffset + vUv * 0.5);
          vec3 foam = texture2D(uFoamMap, vUv * 1.55 + vec2(vSeed * 2.3, vSeed * 1.7)).rgb;
          float froth = wisp.a * (0.52 + 0.68 * foam.r + 0.25 * foam.b);

          float a = clamp(froth * vAlpha, 0.0, 0.74);
          if (a < 0.005) discard;

          float sunLit = clamp(0.58 + vLocal.y * 0.55 + vLocal.x * 0.28 + foam.r * 0.34, 0.0, 1.0);
          vec3 col = mix(uShadowFoam, uTopFoam, sunLit);

          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(mat);

    this.surfPlumeMesh = new THREE.Mesh(instGeo, mat);
    this.surfPlumeMesh.frustumCulled = false;
    this.surfPlumeMesh.renderOrder = 8;
    this.waterlineGroup.add(this.surfPlumeMesh);
  }

  _initSeaDroplets() {
    const geo = new THREE.BufferGeometry();

    this._dropPosBuf = new Float32Array(MAX_SEA_DROPLETS * 3);
    this._dropMetaBuf = new Float32Array(MAX_SEA_DROPLETS * 4);

    this._dropSim = new Float32Array(MAX_SEA_DROPLETS * 12);
    for (let i = 0; i < MAX_SEA_DROPLETS; i++) {
      this._dropSim[i * 12 + 6] = 999;
      this._dropSim[i * 12 + 7] = 1.0;
    }
    this._dropCursor = 0;
    this._dropSpawnAccum = 0;

    this._dropPosAttr = new THREE.BufferAttribute(this._dropPosBuf, 3);
    this._dropPosAttr.setUsage(THREE.DynamicDrawUsage);
    this._dropMetaAttr = new THREE.BufferAttribute(this._dropMetaBuf, 4);
    this._dropMetaAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('position', this._dropPosAttr);
    geo.setAttribute('aDropMeta', this._dropMetaAttr);
    this._geometries.push(geo);

    this.seaDropletUniforms = {
      uSpumeMap: { value: this.spumeDropTex },
      uBeadColor: { value: new THREE.Color('#f8fdff') },
      uHaloColor: { value: new THREE.Color('#7dd3fc') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.seaDropletUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec4 aDropMeta;
        varying float vAlpha;
        varying float vRot;
        varying float vAtlas;

        void main() {
          vAlpha = aDropMeta.y;
          vRot = aDropMeta.z;
          vAtlas = aDropMeta.w;

          if (vAlpha <= 0.003) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float projScale = projectionMatrix[1][1] * 210.0;
          gl_PointSize = clamp(aDropMeta.x * projScale / max(0.85, -mvPosition.z), 2.2, 78.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSpumeMap;
        uniform vec3 uBeadColor;
        uniform vec3 uHaloColor;
        varying float vAlpha;
        varying float vRot;
        varying float vAtlas;

        void main() {
          vec2 centered = gl_PointCoord - 0.5;
          float r2 = dot(centered, centered);
          if (r2 > 0.23) discard;

          float c = cos(vRot);
          float s = sin(vRot);
          vec2 rotUv = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + 0.5;
          rotUv = clamp(rotUv, 0.06, 0.94);

          float idx = floor(vAtlas + 0.5);
          vec2 cellOffset = vec2(mod(idx, 2.0), floor(idx * 0.5)) * 0.5;
          vec4 texel = texture2D(uSpumeMap, cellOffset + rotUv * 0.5);

          float a = texel.a * vAlpha;
          if (a < 0.006) discard;

          vec3 col = mix(uHaloColor, uBeadColor, clamp(texel.a * 1.45, 0.0, 1.0));
          gl_FragColor = vec4(col, clamp(a, 0.0, 0.90));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(mat);

    this.seaSprayPoints = new THREE.Points(geo, mat);
    this.seaSprayPoints.frustumCulled = false;
    this.seaSprayPoints.renderOrder = 10;
    this.waterlineGroup.add(this.seaSprayPoints);
  }

  _initVolumetricMist() {
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const instGeo = new THREE.InstancedBufferGeometry();
    instGeo.index = baseQuad.index;
    instGeo.attributes.position = baseQuad.attributes.position;
    instGeo.attributes.uv = baseQuad.attributes.uv;
    instGeo.instanceCount = MAX_MIST_WISPS;
    baseQuad.dispose();

    this._mistPosBuf = new Float32Array(MAX_MIST_WISPS * 4);
    this._mistMetaBuf = new Float32Array(MAX_MIST_WISPS * 4);

    this._mistSim = new Float32Array(MAX_MIST_WISPS * 16);
    for (let i = 0; i < MAX_MIST_WISPS; i++) {
      this._mistSim[i * 16 + 6] = 999;
      this._mistSim[i * 16 + 7] = 1.0;
    }
    this._seaMistCursor = 0;
    this._doorMistCursor = SEA_MIST_SLOTS;
    this._seaMistAccum = 0;
    this._doorMistAccum = 0;
    this._ledgeMistAccum = 0;

    this._mistPosAttr = new THREE.InstancedBufferAttribute(this._mistPosBuf, 4);
    this._mistPosAttr.setUsage(THREE.DynamicDrawUsage);
    this._mistMetaAttr = new THREE.InstancedBufferAttribute(this._mistMetaBuf, 4);
    this._mistMetaAttr.setUsage(THREE.DynamicDrawUsage);

    instGeo.setAttribute('aWispPosScale', this._mistPosAttr);
    instGeo.setAttribute('aWispMeta', this._mistMetaAttr);
    this._geometries.push(instGeo);

    this.mistUniforms = {
      uWispMap: { value: this.wispAtlasTex },
      uStoneMistColor: { value: new THREE.Color('#fef3c7') },
      uRuneMistColor: { value: new THREE.Color('#5efce8') },
      uWarmMistColor: { value: new THREE.Color('#fde68a') },
      uSeaMistColor: { value: new THREE.Color('#e0f7fa') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.mistUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec4 aWispPosScale;
        attribute vec4 aWispMeta;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vAtlas;
        varying float vTintId;

        void main() {
          vAlpha = aWispMeta.y;
          if (vAlpha <= 0.002) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          float rot = aWispMeta.x;
          vAtlas = aWispMeta.z;
          vTintId = floor(aWispMeta.w + 0.001);
          float aspectX = fract(aWispMeta.w) * 2.0 + 0.9;

          vec4 mvCenter = modelViewMatrix * vec4(aWispPosScale.xyz, 1.0);
          float c = cos(rot);
          float s = sin(rot);
          vec2 localCorner = vec2(position.x * aspectX, position.y) * aWispPosScale.w;
          vec2 rotatedCorner = vec2(
            localCorner.x * c - localCorner.y * s,
            localCorner.x * s + localCorner.y * c
          );

          mvCenter.xy += rotatedCorner;
          vUv = clamp(uv, 0.04, 0.96);
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uWispMap;
        uniform vec3 uStoneMistColor;
        uniform vec3 uRuneMistColor;
        uniform vec3 uWarmMistColor;
        uniform vec3 uSeaMistColor;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vAtlas;
        varying float vTintId;

        void main() {
          float idx = floor(vAtlas + 0.5);
          vec2 cellOffset = vec2(mod(idx, 2.0), floor(idx * 0.5)) * 0.5;
          vec4 wisp = texture2D(uWispMap, cellOffset + vUv * 0.5);

          float a = min(0.22, wisp.a * vAlpha);
          if (a < 0.003) discard;

          vec3 baseCol = uStoneMistColor;
          if (vTintId > 2.5) {
            baseCol = uSeaMistColor;
          } else if (vTintId > 1.5) {
            baseCol = uWarmMistColor;
          } else if (vTintId > 0.5) {
            baseCol = uRuneMistColor;
          }

          vec3 col = baseCol * (0.94 + 0.30 * wisp.r);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(mat);

    this.mistWispsMesh = new THREE.Mesh(instGeo, mat);
    this.mistWispsMesh.frustumCulled = false;
    this.mistWispsMesh.renderOrder = 9;
    this.towerVfxGroup.add(this.mistWispsMesh);
  }

  _initSteamPlumes() {
    const baseQuad = new THREE.PlaneGeometry(1, 1);
    const instGeo = new THREE.InstancedBufferGeometry();
    instGeo.index = baseQuad.index;
    instGeo.attributes.position = baseQuad.attributes.position;
    instGeo.attributes.uv = baseQuad.attributes.uv;
    instGeo.instanceCount = MAX_STEAM_PUFFS;
    baseQuad.dispose();

    this._steamPosBuf = new Float32Array(MAX_STEAM_PUFFS * 4);
    this._steamMetaBuf = new Float32Array(MAX_STEAM_PUFFS * 4);

    this._steamSim = new Float32Array(MAX_STEAM_PUFFS * 15);
    for (let i = 0; i < MAX_STEAM_PUFFS; i++) {
      this._steamSim[i * 15 + 6] = 999;
      this._steamSim[i * 15 + 7] = 1.0;
    }
    this._steamCursor = 0;

    this._steamPosAttr = new THREE.InstancedBufferAttribute(this._steamPosBuf, 4);
    this._steamPosAttr.setUsage(THREE.DynamicDrawUsage);
    this._steamMetaAttr = new THREE.InstancedBufferAttribute(this._steamMetaBuf, 4);
    this._steamMetaAttr.setUsage(THREE.DynamicDrawUsage);

    instGeo.setAttribute('aSteamPosScale', this._steamPosAttr);
    instGeo.setAttribute('aSteamMeta', this._steamMetaAttr);
    this._geometries.push(instGeo);

    this.steamUniforms = {
      uWispMap: { value: this.wispAtlasTex },
      uCoolSteam: { value: new THREE.Color('#e0f7fa') },
      uWarmSteam: { value: new THREE.Color('#fde68a') },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.steamUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec4 aSteamPosScale;
        attribute vec4 aSteamMeta;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vAtlas;
        varying float vHeat;

        void main() {
          vAlpha = aSteamMeta.y;
          if (vAlpha <= 0.003) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          float rot = aSteamMeta.x;
          vAtlas = aSteamMeta.z;
          vHeat = aSteamMeta.w;

          vec4 mvCenter = modelViewMatrix * vec4(aSteamPosScale.xyz, 1.0);
          float c = cos(rot);
          float s = sin(rot);
          vec2 corner = position.xy * aSteamPosScale.w;
          mvCenter.xy += vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);

          vUv = clamp(uv, 0.04, 0.96);
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uWispMap;
        uniform vec3 uCoolSteam;
        uniform vec3 uWarmSteam;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vAtlas;
        varying float vHeat;

        void main() {
          float idx = floor(vAtlas + 0.5);
          vec2 cellOffset = vec2(mod(idx, 2.0), floor(idx * 0.5)) * 0.5;
          vec4 wisp = texture2D(uWispMap, cellOffset + vUv * 0.5);

          float a = clamp(wisp.a * vAlpha, 0.0, 0.44);
          if (a < 0.004) discard;

          vec3 col = mix(uCoolSteam, uWarmSteam, clamp(vHeat, 0.0, 1.0)) * (0.88 + 0.24 * wisp.r);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(mat);

    this.steamPlumeMesh = new THREE.Mesh(instGeo, mat);
    this.steamPlumeMesh.frustumCulled = false;
    this.steamPlumeMesh.renderOrder = 9;
    this.steamPlumeMesh.visible = false;
    this.towerVfxGroup.add(this.steamPlumeMesh);
  }

  _initSparkStreaksAndGlows() {
    const sparkQuad = new THREE.PlaneGeometry(1, 1);
    const sparkGeo = new THREE.InstancedBufferGeometry();
    sparkGeo.index = sparkQuad.index;
    sparkGeo.attributes.position = sparkQuad.attributes.position;
    sparkGeo.attributes.uv = sparkQuad.attributes.uv;
    sparkGeo.instanceCount = MAX_SPARKS;
    sparkQuad.dispose();

    this._sparkPosBuf = new Float32Array(MAX_SPARKS * 4);
    this._sparkVelBuf = new Float32Array(MAX_SPARKS * 4);

    this._sparkSim = new Float32Array(MAX_SPARKS * 12);
    for (let i = 0; i < MAX_SPARKS; i++) {
      this._sparkSim[i * 12 + 6] = 999;
      this._sparkSim[i * 12 + 7] = 1.0;
    }
    this._sparkCursor = 0;

    this._sparkPosAttr = new THREE.InstancedBufferAttribute(this._sparkPosBuf, 4);
    this._sparkPosAttr.setUsage(THREE.DynamicDrawUsage);
    this._sparkVelAttr = new THREE.InstancedBufferAttribute(this._sparkVelBuf, 4);
    this._sparkVelAttr.setUsage(THREE.DynamicDrawUsage);

    sparkGeo.setAttribute('aSparkPosSize', this._sparkPosAttr);
    sparkGeo.setAttribute('aSparkVelHeat', this._sparkVelAttr);
    this._geometries.push(sparkGeo);

    const sparkMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec4 aSparkPosSize;
        attribute vec4 aSparkVelHeat;
        varying vec2 vUv;
        varying float vHeat;

        void main() {
          vHeat = aSparkVelHeat.w;
          if (vHeat <= 0.005 || aSparkPosSize.w <= 0.0005) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          vec4 mvPos = modelViewMatrix * vec4(aSparkPosSize.xyz, 1.0);
          vec3 mvVel = mat3(modelViewMatrix) * aSparkVelHeat.xyz;

          float speed2D = length(mvVel.xy);
          vec2 dir = speed2D > 0.002 ? (mvVel.xy / speed2D) : vec2(1.0, 0.0);
          vec2 perp = vec2(-dir.y, dir.x);

          float size = aSparkPosSize.w;
          float streakLen = size * (1.05 + clamp(speed2D * 0.86, 0.0, 3.85));
          float thickness = size * 0.92;

          float along = (position.x - 0.22) * streakLen;
          float across = position.y * thickness;
          mvPos.xy += dir * along + perp * across;

          vUv = uv;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vHeat;

        void main() {
          float u = vUv.x;
          float v = (vUv.y - 0.5) * 2.0;

          float headMask = smoothstep(0.0, 0.72, u) * (1.0 - smoothstep(0.72, 1.0, u));
          float taperWidth = mix(0.30, 1.0, smoothstep(0.0, 0.76, u));
          float vn = v / max(0.24, taperWidth);

          float spine = exp(-vn * vn * 7.6) * headMask;
          float headCore = exp(-(vn * vn * 11.5 + pow((u - 0.70) * 4.6, 2.0)));
          float softHalo = exp(-(vn * vn * 2.0 + pow((u - 0.66) * 2.0, 2.0))) * 0.65;
          float intensity = spine + softHalo + headCore * 0.55;

          if (intensity < 0.012) discard;

          vec3 emberAqua = vec3(0.12, 0.72, 0.88);
          vec3 sparkGold = vec3(1.00, 0.68, 0.16);
          vec3 whiteGoldCore = vec3(1.00, 0.96, 0.72);

          float h = clamp(vHeat, 0.0, 1.0);
          vec3 bodyCol = mix(emberAqua, sparkGold, smoothstep(0.15, 0.75, h));
          vec3 finalCol = mix(bodyCol, whiteGoldCore, clamp(headCore * h * 1.25, 0.0, 1.0));

          float lumScale = (0.58 + 1.38 * h) * intensity;
          gl_FragColor = vec4(finalCol * lumScale, clamp(intensity * h, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(sparkMat);

    this.sparkStreaksMesh = new THREE.Mesh(sparkGeo, sparkMat);
    this.sparkStreaksMesh.frustumCulled = false;
    this.sparkStreaksMesh.renderOrder = 12;
    this.towerVfxGroup.add(this.sparkStreaksMesh);

    const glowQuad = new THREE.PlaneGeometry(1, 1);
    const glowGeo = new THREE.InstancedBufferGeometry();
    glowGeo.index = glowQuad.index;
    glowGeo.attributes.position = glowQuad.attributes.position;
    glowGeo.attributes.uv = glowQuad.attributes.uv;
    glowGeo.instanceCount = MAX_SPARK_GLOWS;
    glowQuad.dispose();

    this._glowPosBuf = new Float32Array(MAX_SPARK_GLOWS * 4);
    this._glowScaleBuf = new Float32Array(MAX_SPARK_GLOWS * 4);

    this._glowPosAttr = new THREE.InstancedBufferAttribute(this._glowPosBuf, 4);
    this._glowPosAttr.setUsage(THREE.DynamicDrawUsage);
    this._glowScaleAttr = new THREE.InstancedBufferAttribute(this._glowScaleBuf, 4);
    this._glowScaleAttr.setUsage(THREE.DynamicDrawUsage);

    glowGeo.setAttribute('aGlowPos', this._glowPosAttr);
    glowGeo.setAttribute('aGlowScale', this._glowScaleAttr);
    this._geometries.push(glowGeo);

    const glowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      side: THREE.DoubleSide,
      fog: false,
      vertexShader: /* glsl */ `
        attribute vec4 aGlowPos;
        attribute vec4 aGlowScale;
        varying vec2 vUv;
        varying float vIntensity;
        varying float vMode;

        void main() {
          vIntensity = aGlowScale.z;
          vMode = aGlowScale.w;
          if (vIntensity <= 0.003) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
          }

          vUv = uv;
          if (vMode > 0.5) {
            vec4 mvCenter = modelViewMatrix * vec4(aGlowPos.xyz, 1.0);
            mvCenter.xy += position.xy * aGlowScale.xy;
            gl_Position = projectionMatrix * mvCenter;
          } else {
            float yaw = aGlowPos.w;
            float c = cos(yaw);
            float s = sin(yaw);
            float lx = position.x * aGlowScale.x;
            float lz = position.y * aGlowScale.y;
            vec3 worldOff = vec3(lx * c + lz * s, 0.0, -lx * s + lz * c);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(aGlowPos.xyz + worldOff, 1.0);
          }
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vIntensity;
        varying float vMode;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float d2 = dot(p, p);
          if (d2 >= 1.0) discard;

          float falloff = exp(-d2 * 3.1) * pow(1.0 - d2, 1.5);
          vec3 outerAmber = vec3(0.20, 0.75, 0.90);
          vec3 innerGold = vec3(1.0, 0.82, 0.35);
          vec3 col = mix(outerAmber, innerGold, falloff);

          float gain = falloff * vIntensity * (vMode > 0.5 ? 0.50 : 0.70);
          if (gain < 0.003) discard;

          gl_FragColor = vec4(col * gain, gain);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this._materials.push(glowMat);

    this.sparkGlowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.sparkGlowMesh.frustumCulled = false;
    this.sparkGlowMesh.renderOrder = 11;
    this.towerVfxGroup.add(this.sparkGlowMesh);

    // Keep sparkLights empty so toggling `oceanVfx.setVisible()` never mutates scene
    // `NUM_POINT_LIGHTS` mid-climb (which would trigger full-scene ANGLE D3D11 shader recompiles!).
    this.sparkLights = [];
  }

  setEra(_era) {
    this.era = 'reboot';
    return this;
  }

  setTheme(theme = null) {
    if (!theme) {
      this._forcedTheme = null;
      return this;
    }
    const resolved = resolveVfxBiome(theme);
    this._forcedTheme = resolved;
    this._theme = resolved;
    this._applyThemePalette(resolved);
    return this;
  }

  setPurification(progress = 0) {
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    this._purificationTarget = p;
    this._purification = p;
    return this;
  }

  setRestored(restored = true) {
    return this.setPurification(restored ? 1 : 0);
  }

  _applyThemePalette(rawTheme) {
    const theme = resolveVfxBiome(rawTheme, this._tower?.id);
    this._theme = theme;

    switch (theme) {
      case 'canyon_river':
        // Sunlit Emerald-Teal Whitewater Rapids & Warm Golden Morning Mist
        this._biomeSurgeScale = 1.22;
        this._biomeMistRateScale = 1.05;
        this._biomeFlowDrift = 1.45;
        this._biomeVortexSpin = 0.0;
        this.surfApronUniforms.uSpinSpeed.value = 0.12;
        this.surfApronUniforms.uBrightColor.value.set('#f8fdff');
        this.surfApronUniforms.uMidColor.value.set('#5eead4');
        this.surfApronUniforms.uDeepTint.value.set('#0d9488');
        this.surfCrestUniforms.uCrestBright.value.set('#ffffff');
        this.surfCrestUniforms.uCrestShadow.value.set('#34d399');
        this.surfPlumeUniforms.uTopFoam.value.set('#fffbeb');
        this.surfPlumeUniforms.uShadowFoam.value.set('#2dd4bf');
        this.seaDropletUniforms.uBeadColor.value.set('#fffdf5');
        this.seaDropletUniforms.uHaloColor.value.set('#5eead4');
        this.mistUniforms.uStoneMistColor.value.set('#fef3c7');
        this.mistUniforms.uSeaMistColor.value.set('#ecfdf5');
        break;

      case 'alpine_lake':
        // Tranquil Glassy Turquoise-Cobalt Mirror Lake & Crisp Mountain Mist
        this._biomeSurgeScale = 0.46;
        this._biomeMistRateScale = 0.85;
        this._biomeFlowDrift = 0.15;
        this._biomeVortexSpin = 0.0;
        this.surfApronUniforms.uSpinSpeed.value = 0.0;
        this.surfApronUniforms.uBrightColor.value.set('#f4faff');
        this.surfApronUniforms.uMidColor.value.set('#93c5fd');
        this.surfApronUniforms.uDeepTint.value.set('#38bdf8');
        this.surfCrestUniforms.uCrestBright.value.set('#f8fcff');
        this.surfCrestUniforms.uCrestShadow.value.set('#7dd3fc');
        this.surfPlumeUniforms.uTopFoam.value.set('#f8fafc');
        this.surfPlumeUniforms.uShadowFoam.value.set('#60a5fa');
        this.seaDropletUniforms.uBeadColor.value.set('#ffffff');
        this.seaDropletUniforms.uHaloColor.value.set('#93c5fd');
        this.mistUniforms.uStoneMistColor.value.set('#e0f2fe');
        this.mistUniforms.uSeaMistColor.value.set('#fce7f3');
        break;

      case 'mist_bayou':
        // Calm Jade-Amber Bayou Eddies & Lush Glowing Twilight Mist Ribbons
        this._biomeSurgeScale = 0.40;
        this._biomeMistRateScale = 1.68;
        this._biomeFlowDrift = 0.28;
        this._biomeVortexSpin = 0.0;
        this.surfApronUniforms.uSpinSpeed.value = 0.04;
        this.surfApronUniforms.uBrightColor.value.set('#fef3c7');
        this.surfApronUniforms.uMidColor.value.set('#6ee7b7');
        this.surfApronUniforms.uDeepTint.value.set('#10b981');
        this.surfCrestUniforms.uCrestBright.value.set('#fef9c3');
        this.surfCrestUniforms.uCrestShadow.value.set('#34d399');
        this.surfPlumeUniforms.uTopFoam.value.set('#fef3c7');
        this.surfPlumeUniforms.uShadowFoam.value.set('#2f855a');
        this.seaDropletUniforms.uBeadColor.value.set('#fef08a');
        this.seaDropletUniforms.uHaloColor.value.set('#6ee7b7');
        this.mistUniforms.uStoneMistColor.value.set('#fde68a');
        this.mistUniforms.uSeaMistColor.value.set('#d1fae5');
        break;

      case 'coral_sea':
        // Sparkling Tropical Turquoise Lagoon Surf & Pure White Coral Foam
        this._biomeSurgeScale = 0.90;
        this._biomeMistRateScale = 0.78;
        this._biomeFlowDrift = 0.35;
        this._biomeVortexSpin = 0.0;
        this.surfApronUniforms.uSpinSpeed.value = 0.05;
        this.surfApronUniforms.uBrightColor.value.set('#ffffff');
        this.surfApronUniforms.uMidColor.value.set('#22f5e8');
        this.surfApronUniforms.uDeepTint.value.set('#06b6d4');
        this.surfCrestUniforms.uCrestBright.value.set('#ffffff');
        this.surfCrestUniforms.uCrestShadow.value.set('#2dd4bf');
        this.surfPlumeUniforms.uTopFoam.value.set('#ffffff');
        this.surfPlumeUniforms.uShadowFoam.value.set('#14b8a6');
        this.seaDropletUniforms.uBeadColor.value.set('#ffffff');
        this.seaDropletUniforms.uHaloColor.value.set('#67e8f9');
        this.mistUniforms.uStoneMistColor.value.set('#cffafe');
        this.mistUniforms.uSeaMistColor.value.set('#ecfeff');
        break;

      default:
        // 'storm_ocean': Polar Tempest & Colossal Swirling Maelstrom Vortex!
        this._biomeSurgeScale = 1.45;
        this._biomeMistRateScale = 1.25;
        this._biomeFlowDrift = 0.55;
        this._biomeVortexSpin = 2.85;
        this.surfApronUniforms.uSpinSpeed.value = 1.0;
        this.surfApronUniforms.uBrightColor.value.set('#f0fdff');
        this.surfApronUniforms.uMidColor.value.set('#67e8f9');
        this.surfApronUniforms.uDeepTint.value.set('#0284c7');
        this.surfCrestUniforms.uCrestBright.value.set('#f0fdfa');
        this.surfCrestUniforms.uCrestShadow.value.set('#38bdf8');
        this.surfPlumeUniforms.uTopFoam.value.set('#ecfeff');
        this.surfPlumeUniforms.uShadowFoam.value.set('#0ea5e9');
        this.seaDropletUniforms.uBeadColor.value.set('#f0fdff');
        this.seaDropletUniforms.uHaloColor.value.set('#5eead4');
        this.mistUniforms.uStoneMistColor.value.set('#bae6fd');
        this.mistUniforms.uSeaMistColor.value.set('#ccfbf1');
        break;
    }
  }

  rebuildForTower(tower, fh = DEFAULT_FH, towerRadius = DEFAULT_TOWER_RADIUS) {
    if (!tower || this._disposed) return;

    const resolvedFh = Number.isFinite(fh) && fh > 0 ? fh : DEFAULT_FH;
    const resolvedRadius = Number.isFinite(towerRadius) && towerRadius > 0.5 ? towerRadius : DEFAULT_TOWER_RADIUS;
    const resolvedCols = Math.min(MAX_COLS, Math.max(8, Number(tower.cols) || DEFAULT_COLS));

    this._tower = tower;
    this.cols = resolvedCols;
    this.colAngle = TWO_PI / resolvedCols;
    this.fh = resolvedFh;
    this.towerRadius = resolvedRadius;
    this._towerFloors = Math.max(8, Number(tower.floors) || 18);

    const nextTheme = this._forcedTheme || resolveVfxBiome(tower.theme, tower.id);
    this.surfApronUniforms.uTowerRadius.value = resolvedRadius;
    this.surfCrestUniforms.uTowerRadius.value = resolvedRadius;
    this._applyThemePalette(nextTheme);

    this._basalStepBoost.fill(0);
    this._doorEmitterCount = 0;
    this._ledgeMistCount = 0;
    this._sparkArchCount = 0;
    this._steamVentCount = 0;
    this._ledgeSurfaceGrid.fill(-1e6);
    this._ledgeIndexGrid.fill(-1);

    for (let i = 0; i < MAX_SURF_PLUMES; i++) this._plumeSim[i * 15 + 6] = 999;
    for (let i = 0; i < MAX_SEA_DROPLETS; i++) this._dropSim[i * 12 + 6] = 999;
    for (let i = 0; i < MAX_MIST_WISPS; i++) this._mistSim[i * 16 + 6] = 999;
    for (let i = 0; i < MAX_STEAM_PUFFS; i++) this._steamSim[i * 15 + 6] = 999;
    for (let i = 0; i < MAX_SPARKS; i++) this._sparkSim[i * 12 + 6] = 999;
    this._glowScaleBuf.fill(0);

    const towerSeed = ((Number(tower.id) || 1) * 2654435761) ^ 0x3c6ef372;
    this._rngState = towerSeed || 0x51f15e26;

    const baseWaterFloor = tower.mechanics?.waterBaseFloor ?? -0.55;
    const doorWorldH = 0.92 * resolvedFh;

    const ledges = tower.ledges || [];
    for (let i = 0; i < ledges.length; i++) {
      const l = ledges[i];
      if (!l) continue;
      const col = wrapColIndex(Math.round(l.col), resolvedCols);
      const fl = Math.round(l.floor);
      const lType = l.type || 'solid';

      const isWalkableSlab = lType !== 'box' && lType !== 'pillar' && lType !== 'laserGate';

      if (isWalkableSlab && fl >= 0 && fl < MAX_GRID_FLOORS) {
        const cell = fl * resolvedCols + col;
        this._ledgeSurfaceGrid[cell] = l.floor * resolvedFh + 0.02;
        this._ledgeIndexGrid[cell] = i;

        const distFromWater = l.floor - baseWaterFloor;
        if (distFromWater >= -0.4 && distFromWater <= 2.4) {
          const boost = Math.max(0.20, 1.15 - Math.abs(distFromWater - 0.65) * 0.44);
          if (boost > this._basalStepBoost[col]) {
            this._basalStepBoost[col] = boost;
          }
          const leftC = wrapColIndex(col - 1, resolvedCols);
          const rightC = wrapColIndex(col + 1, resolvedCols);
          if (boost * 0.65 > this._basalStepBoost[leftC]) this._basalStepBoost[leftC] = boost * 0.65;
          if (boost * 0.65 > this._basalStepBoost[rightC]) this._basalStepBoost[rightC] = boost * 0.65;
        }
      }

      if ((lType === 'steamVent' || lType === 'geyser') && this._steamVentCount < MAX_STEAM_VENT_EMITTERS) {
        const base = this._steamVentCount * 6;
        this._steamVentData[base] = (col + 0.5) * this.colAngle;
        this._steamVentData[base + 1] = l.floor * resolvedFh + 0.14;
        this._steamVentData[base + 2] = Math.max(1.5, Number(l.phasePeriod) || 3.4);
        this._steamVentData[base + 3] = Number(l.phaseOffset) || 0;
        this._steamVentData[base + 4] = i;
        this._steamVentData[base + 5] = 0;
        this._steamVentCount++;
      }
    }

    const doors = tower.doors || [];
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (!d) continue;
      const col = wrapColIndex(Math.round(d.col), resolvedCols);
      const fl = Math.round(d.floor);
      const phi = (d.col + 0.5) * this.colAngle;
      const floorY = d.floor * resolvedFh;
      const isRune = Boolean(d.isRune || d.rune || d.isSanctum);
      const isSparkArch =
        (d.tunnelStyle === 'sparkArch' || d.sparkArch === true) &&
        !d.isExit &&
        !d.isVault &&
        !isRune;

      if (isSparkArch && this._sparkArchCount < MAX_SPARK_ARCH_EMITTERS) {
        let plusScore = 0;
        let minusScore = 0;
        if (fl >= 0 && fl < MAX_GRID_FLOORS) {
          for (let step = 1; step <= 3; step++) {
            const weight = 4 - step;
            if (this._ledgeSurfaceGrid[fl * resolvedCols + wrapColIndex(col + step, resolvedCols)] > -1e5) {
              plusScore += weight;
            }
            if (this._ledgeSurfaceGrid[fl * resolvedCols + wrapColIndex(col - step, resolvedCols)] > -1e5) {
              minusScore += weight;
            }
          }
        }
        const tangDir = plusScore > minusScore ? 1.0 : minusScore > plusScore ? -1.0 : 0.0;

        const sBase = this._sparkArchCount * 7;
        this._sparkArchData[sBase] = phi;
        this._sparkArchData[sBase + 1] = floorY;
        this._sparkArchData[sBase + 2] = doorWorldH;
        this._sparkArchData[sBase + 3] = tangDir;
        this._sparkArchData[sBase + 4] = (i + 1) * 1.73 + col * 0.41;
        this._sparkArchData[sBase + 5] = floorY <= baseWaterFloor * resolvedFh ? 1 : 0;
        this._sparkArchData[sBase + 6] = 0;
        this._sparkArchCount++;

        if (this._doorEmitterCount < MAX_DOOR_EMITTERS) {
          const mBase = this._doorEmitterCount * 5;
          this._doorEmitterData[mBase] = phi;
          this._doorEmitterData[mBase + 1] = floorY;
          this._doorEmitterData[mBase + 2] = doorWorldH;
          this._doorEmitterData[mBase + 3] = 2;
          this._doorEmitterData[mBase + 4] = 0.72;
          this._doorEmitterCount++;
        }
      } else if (this._doorEmitterCount < MAX_DOOR_EMITTERS) {
        const mBase = this._doorEmitterCount * 5;
        this._doorEmitterData[mBase] = phi;
        this._doorEmitterData[mBase + 1] = floorY;
        this._doorEmitterData[mBase + 2] = doorWorldH;
        this._doorEmitterData[mBase + 3] = isRune ? 1 : d.isVault ? 2 : 0;
        this._doorEmitterData[mBase + 4] = 1.0;
        this._doorEmitterCount++;
      }
    }

    const elevators = tower.elevators || [];
    for (let e = 0; e < elevators.length && this._ledgeMistCount < MAX_LEDGE_MIST_EMITTERS; e++) {
      const el = elevators[e];
      if (!el) continue;
      const lBase = this._ledgeMistCount * 4;
      this._ledgeMistData[lBase] = (el.col + 0.5) * this.colAngle;
      this._ledgeMistData[lBase + 1] = this.colAngle * 1.65;
      this._ledgeMistData[lBase + 2] = el.minFloor * resolvedFh + 0.08;
      this._ledgeMistData[lBase + 3] = 1.35;
      this._ledgeMistCount++;
    }

    const maxCheckFloors = Math.min(MAX_GRID_FLOORS, this._towerFloors + 1);
    const floorStride = Math.max(1, Math.floor(maxCheckFloors / 14));
    for (let fl = 1; fl < maxCheckFloors && this._ledgeMistCount < MAX_LEDGE_MIST_EMITTERS; fl += floorStride) {
      let bestStart = -1;
      let bestLen = 0;
      let runStart = -1;
      let runLen = 0;
      for (let c = 0; c < resolvedCols; c++) {
        if (this._ledgeSurfaceGrid[fl * resolvedCols + c] > -1e5) {
          if (runLen === 0) runStart = c;
          runLen++;
          if (runLen > bestLen) {
            bestLen = runLen;
            bestStart = runStart;
          }
        } else {
          runLen = 0;
        }
      }
      if (bestLen >= 2) {
        const midCol = bestStart + bestLen * 0.5;
        const lBase = this._ledgeMistCount * 4;
        this._ledgeMistData[lBase] = midCol * this.colAngle;
        this._ledgeMistData[lBase + 1] = Math.min(4, bestLen) * this.colAngle * 0.92;
        this._ledgeMistData[lBase + 2] = fl * resolvedFh + 0.06;
        this._ledgeMistData[lBase + 3] = 1.0;
        this._ledgeMistCount++;
      }
    }

    this.surfPlumeMesh.visible = false;
    this.mistWispsMesh.visible = true;
    this.steamPlumeMesh.visible = this._steamVentCount > 0;
    this.sparkStreaksMesh.visible = this._sparkArchCount > 0;
    this.sparkGlowMesh.visible = this._sparkArchCount > 0;
    if (this.seaDropletsMesh) this.seaDropletsMesh.visible = false;
    if (this._sparkArchCount === 0) {
      for (let i = 0; i < this.sparkLights.length; i++) {
        this.sparkLights[i].intensity = 0;
      }
    }

    // Pre-warm 2.0s (40 steps x 0.05s) so Frame 0 already has active rapids, mist & sparks!
    const initCamCol = Number(tower.spawn?.col) || 0;
    const preWaterY = baseWaterFloor * resolvedFh;
    for (let step = 0; step < 40; step++) {
      const simT = step * 0.05;
      this._stepSurfAndSpray(preWaterY, initCamCol, 0, simT, 0.05, this._biomeSurgeScale, null);
      this._stepDoorAndLedgeMist(preWaterY, initCamCol, 0, simT, 0.05, 0);
      this._stepSparksAndGlows(preWaterY, initCamCol, 0, simT, 0.05, null);
      if (this._steamVentCount > 0) {
        this._stepSteamVents(preWaterY, 0, simT, 0.05, null);
      }
    }
    this._uploadBuffers();
  }

  update(state, camCol = 0, time = 0, dt = 1 / 60) {
    if (this._disposed || !state) return;

    const inferredFh = this.fh || DEFAULT_FH;
    if (state.tower && state.tower !== this._tower) {
      this.rebuildForTower(state.tower, inferredFh, this.towerRadius);
    } else if (state.tower && !this._forcedTheme) {
      const wantBiome = resolveVfxBiome(state.tower.theme, state.tower.id);
      if (wantBiome !== this._theme) {
        this._applyThemePalette(wantBiome);
      }
    }

    const effCamCol = camCol !== undefined && camCol !== null ? Number(camCol) || 0 : Number(state.camCol) || 0;
    const t = Number(time) || 0;
    const rawDt = Number(dt);
    const stepDt = Number.isFinite(rawDt) ? Math.min(0.05, Math.max(0.0, rawDt)) : 1 / 60;

    // Ecosystem Purification progress (`0..1`)
    let targetPurify = this._purificationTarget;
    if (state.purificationProgress !== undefined) {
      targetPurify = Number(state.purificationProgress) || 0;
    } else if (state.tower?.purificationProgress !== undefined) {
      targetPurify = Number(state.tower.purificationProgress) || 0;
    } else if (state.restored || state.tower?.restored || state.mode === 'victory') {
      targetPurify = 1.0;
    }
    targetPurify = Math.max(0, Math.min(1, targetPurify));
    this._purification += (targetPurify - this._purification) * Math.min(1, stepDt * 2.5);

    const fh = this.fh;
    const waterFloor = state.waterFloor != null ? Number(state.waterFloor) : -0.55;
    const waterY = waterFloor * fh;
    const wind = Number(state.windCurrent) || 0;
    const liveLedges = state.ledges || null;

    const yaw = -effCamCol * this.colAngle;
    const topple = state.topple;
    const toppleActive = Boolean(topple && topple.active);
    let toppleDropY = 0;
    let surgeFactor = this._biomeSurgeScale * (state.titleShowcase ? 1.12 : 1.0) * (1.0 + this._purification * 0.15);

    if (toppleActive) {
      const p = Math.max(0, Math.min(1, Number(topple.progress) || 0));
      toppleDropY = -p * this._towerFloors * fh * 1.05;
      const shakeX = Math.sin(t * 48) * 0.18 * (1 - p);
      const tiltZ = Math.sin(t * 38) * 0.045 * (1 - p) + p * 0.14;
      this.towerVfxGroup.position.set(shakeX, toppleDropY, 0);
      this.towerVfxGroup.rotation.set(0, yaw, tiltZ);
      this.waterlineGroup.position.set(shakeX * 0.35, waterY, 0);
      surgeFactor = 1.35 + Math.sin(p * Math.PI) * 1.55;
    } else {
      this.towerVfxGroup.position.set(0, 0, 0);
      this.towerVfxGroup.rotation.set(0, yaw, 0);
      this.waterlineGroup.position.set(0, waterY, 0);
      if (waterFloor > -0.25) {
        surgeFactor = Math.max(surgeFactor, 1.25);
      }
    }
    this.waterlineGroup.rotation.set(0, yaw, 0);

    const localWaterY = waterY - toppleDropY;
    const toppleDeltaY = toppleDropY - this._prevToppleDropY;
    this._prevToppleDropY = toppleDropY;

    this.surfApronUniforms.uTime.value = t;
    this.surfApronUniforms.uSurge.value = surgeFactor;
    this.surfCrestUniforms.uTime.value = t;

    const hero = state.gateway || state.player || null;
    this._stepSurfAndSpray(localWaterY, effCamCol, wind, t, stepDt, surgeFactor, hero);
    this._stepDoorAndLedgeMist(localWaterY, effCamCol, wind, t, stepDt, toppleDeltaY);
    this._stepSparksAndGlows(localWaterY, effCamCol, wind, t, stepDt, liveLedges);
    if (this._steamVentCount > 0 || this.steamPlumeMesh.visible) {
      this._stepSteamVents(localWaterY, wind, t, stepDt, liveLedges);
    }

    this._uploadBuffers();
  }

  _uploadBuffers() {
    this._crestXformAttr.needsUpdate = true;
    this._crestStateAttr.needsUpdate = true;
    this._dropPosAttr.needsUpdate = true;
    this._dropMetaAttr.needsUpdate = true;
    this._plumePosAttr.needsUpdate = true;
    this._plumeMetaAttr.needsUpdate = true;
    this._mistPosAttr.needsUpdate = true;
    this._mistMetaAttr.needsUpdate = true;

    if (this.sparkStreaksMesh.visible) {
      this._sparkPosAttr.needsUpdate = true;
      this._sparkVelAttr.needsUpdate = true;
    }
    if (this.sparkGlowMesh.visible) {
      this._glowPosAttr.needsUpdate = true;
      this._glowScaleAttr.needsUpdate = true;
    }
    if (this.steamPlumeMesh.visible) {
      this._steamPosAttr.needsUpdate = true;
      this._steamMetaAttr.needsUpdate = true;
    }
  }

  _stepSurfAndSpray(localWaterY, camCol, wind, time, dt, surgeFactor, hero) {
    const R = this.towerRadius;
    const camPhi = camCol * this.colAngle;
    const cols = this.cols;
    const vortexSpin = this._biomeVortexSpin;
    const flowDrift = this._biomeFlowDrift;

    for (let i = 0; i < SURF_CREST_COUNT; i++) {
      const s5 = i * 5;
      const basePhi = wrapPositiveAngle(this._crestSim[s5] + time * vortexSpin * 0.14);
      const speed = this._crestSim[s5 + 1];
      const phase = this._crestSim[s5 + 2];
      const seed = this._crestSim[s5 + 3];
      const prevLife = this._crestSim[s5 + 4];

      const rawCycle = (time * speed + phase) % 1.0;
      const life = rawCycle < 0 ? rawCycle + 1.0 : rawCycle;
      this._crestSim[s5 + 4] = life;

      const col = wrapColIndex(Math.floor(basePhi / this.colAngle), cols);
      const stairBoost = this._basalStepBoost[col];

      const relAng = Math.abs(wrapAngle(basePhi - camPhi));
      const flankSine = Math.sin(Math.min(Math.PI, relAng));
      const flankBoost = flankSine * flankSine * 0.85;

      const swellMod =
        0.78 +
        0.34 * Math.sin(basePhi * 2.0 + time * 1.45) +
        0.22 * Math.cos(basePhi * 3.0 - time * 1.05);
      const amp = swellMod * surgeFactor * (1.0 + stairBoost * 0.42 + flankBoost * 0.58);

      let heightCurve;
      if (life < 0.26) {
        const u = life / 0.26;
        heightCurve = 1.0 - (1.0 - u) * (1.0 - u);
      } else {
        const u = (life - 0.26) / 0.74;
        heightCurve = Math.max(0.0, Math.cos(u * Math.PI * 0.5));
      }

      const curPhi = basePhi + Math.sin(time * 0.65 + seed * TWO_PI) * 0.045;
      const arcWidth = (0.24 + seed * 0.12) * (0.95 + 0.35 * heightCurve);
      // Tuck surf collar strictly under Floor 0 stone walkway deck (`max Y <= waterY + 0.62 < 0.0`)
      const crestH = Math.min(0.62, (0.26 + seed * 0.24) * amp * (0.24 + 0.76 * heightCurve));
      const radialFlare = (0.34 + flankBoost * 0.42 + seed * 0.20) * (0.35 + 0.65 * heightCurve);

      const erode = 0.20 + Math.pow(life, 1.25) * 0.56;
      const alpha =
        Math.sin(Math.min(1.0, life * 1.05) * Math.PI) *
        Math.min(0.42, (0.26 + stairBoost * 0.08 + flankBoost * 0.08) * Math.min(1.15, surgeFactor));

      const x4 = i * 4;
      this._crestXformBuf[x4] = curPhi;
      this._crestXformBuf[x4 + 1] = arcWidth;
      this._crestXformBuf[x4 + 2] = crestH;
      this._crestXformBuf[x4 + 3] = radialFlare;

      this._crestStateBuf[x4] = life;
      this._crestStateBuf[x4 + 1] = erode;
      this._crestStateBuf[x4 + 2] = alpha;
      this._crestStateBuf[x4 + 3] = seed;

      if (dt > 0 && prevLife < 0.16 && life >= 0.16 && surgeFactor > 0.35) {
        const burstCount = amp > 1.35 ? 4 : amp > 0.85 ? 2 : 1;
        for (let b = 0; b < burstCount; b++) {
          this._spawnSeaDroplet(
            curPhi,
            crestH * 0.45,
            R + 0.16 + this._rand() * 0.42,
            amp * 1.08,
            wind + flowDrift * 0.35 + vortexSpin * 0.4
          );
        }
        if (flankBoost > 0.25 || stairBoost > 0.25 || seed > 0.48) {
          this._spawnSurfPlume(curPhi, R + 0.20 + flankBoost * 0.24, amp, wind + flowDrift * 0.3 + vortexSpin * 0.5);
        }
      }
    }

    if (dt > 0) {
      this._plumeAccum += 36.0 * surgeFactor * dt;
      while (this._plumeAccum >= 1.0) {
        this._plumeAccum -= 1.0;
        let pPhi;
        if (this._rand() < 0.70) {
          const side = this._rand() < 0.5 ? -1.0 : 1.0;
          pPhi = wrapPositiveAngle(camPhi + side * (0.50 + this._rand() * 0.90));
        } else {
          pPhi = this._rand() * TWO_PI;
        }
        const col = wrapColIndex(Math.floor(pPhi / this.colAngle), cols);
        const energy = (0.85 + this._basalStepBoost[col] * 0.50) * surgeFactor;
        this._spawnSurfPlume(pPhi, R + 0.18 + this._rand() * 0.50, energy, wind + flowDrift * 0.3 + vortexSpin * 0.5);
      }

      const dropRate = 140 * surgeFactor;
      this._dropSpawnAccum += dropRate * dt;
      while (this._dropSpawnAccum >= 1.0) {
        this._dropSpawnAccum -= 1.0;
        let rPhi;
        if (this._rand() < 0.68) {
          const side = this._rand() < 0.5 ? -1.0 : 1.0;
          rPhi = wrapPositiveAngle(camPhi + side * (0.42 + this._rand() * 0.98));
        } else {
          rPhi = this._rand() * TWO_PI;
        }
        const col = wrapColIndex(Math.floor(rPhi / this.colAngle), cols);
        const boost = 1.0 + this._basalStepBoost[col] * 0.50;
        this._spawnSeaDroplet(
          rPhi,
          0.12 + this._rand() * 0.38,
          R + 0.12 + this._rand() * 0.72,
          surgeFactor * boost,
          wind + flowDrift * 0.35 + vortexSpin * 0.4
        );
      }
    }

    // Gateway waterline splash & Tail-Whip spray interaction!
    if (dt > 0 && hero && !hero.hidden) {
      const pY = (Number(hero.floor) || 0) * this.fh;
      const whipActive = (Number(hero.tailWhipTimer) || Number(hero.whipTimer) || 0) > 0.01;
      if (Math.abs(pY - localWaterY) < 0.55 && (Math.abs(Number(hero.vy) || 0) > 1.5 || whipActive)) {
        const pPhi = wrapPositiveAngle((Number(hero.col) || 0) * this.colAngle);
        this._spawnSeaDroplet(pPhi, 0.26, R + 0.45, 1.6, wind);
        this._spawnSurfPlume(pPhi, R + 0.42, 1.5, wind);
      }
    }

    for (let i = 0; i < MAX_SURF_PLUMES; i++) {
      const b15 = i * 15;
      let age = this._plumeSim[b15 + 6];
      const maxAge = this._plumeSim[b15 + 7];

      if (age >= maxAge) {
        this._plumeMetaBuf[i * 4 + 1] = 0;
        continue;
      }

      if (dt > 0) {
        age += dt;
        this._plumeSim[b15 + 6] = age;
        if (age >= maxAge) {
          this._plumeMetaBuf[i * 4 + 1] = 0;
          continue;
        }

        let phi = this._plumeSim[b15];
        let y = this._plumeSim[b15 + 1];
        let r = this._plumeSim[b15 + 2];
        let vTang = this._plumeSim[b15 + 3];
        let vy = this._plumeSim[b15 + 4];
        let vRad = this._plumeSim[b15 + 5];

        const drag = Math.max(0.0, 1.0 - 1.45 * dt);
        vy = vy * drag - 2.65 * dt;
        vRad *= Math.max(0.0, 1.0 - 1.15 * dt);
        vTang = (vTang + (wind * 0.42 + vortexSpin * 0.65) * dt) * drag;

        y = Math.max(-0.08, y + vy * dt);
        r = Math.max(R + 0.08, r + vRad * dt);
        phi = wrapPositiveAngle(phi + (vTang / Math.max(2.0, r)) * dt);

        this._plumeSim[b15] = phi;
        this._plumeSim[b15 + 1] = y;
        this._plumeSim[b15 + 2] = r;
        this._plumeSim[b15 + 3] = vTang;
        this._plumeSim[b15 + 4] = vy;
        this._plumeSim[b15 + 5] = vRad;
        this._plumeSim[b15 + 11] += this._plumeSim[b15 + 12] * dt;
      }

      const life = age / maxAge;
      const curPhi = this._plumeSim[b15];
      const curY = this._plumeSim[b15 + 1];
      const curR = this._plumeSim[b15 + 2];
      const s0 = this._plumeSim[b15 + 8];
      const s1 = this._plumeSim[b15 + 9];
      const peakA = this._plumeSim[b15 + 10];

      const fadeIn = Math.sin(Math.min(1.0, life / 0.20) * Math.PI * 0.5);
      const fadeOut = Math.pow(Math.max(0.0, 1.0 - life), 1.25);

      const p4 = i * 4;
      this._plumePosBuf[p4] = Math.sin(curPhi) * curR;
      this._plumePosBuf[p4 + 1] = curY;
      this._plumePosBuf[p4 + 2] = Math.cos(curPhi) * curR;
      this._plumePosBuf[p4 + 3] = s0 + (s1 - s0) * Math.sqrt(life);

      this._plumeMetaBuf[p4] = this._plumeSim[b15 + 11];
      this._plumeMetaBuf[p4 + 1] = peakA * fadeIn * fadeOut;
      this._plumeMetaBuf[p4 + 2] = this._plumeSim[b15 + 13];
      this._plumeMetaBuf[p4 + 3] = this._plumeSim[b15 + 14];
    }

    const grav = 7.4;
    for (let i = 0; i < MAX_SEA_DROPLETS; i++) {
      const b12 = i * 12;
      let age = this._dropSim[b12 + 6];
      const maxAge = this._dropSim[b12 + 7];

      if (age >= maxAge) {
        this._dropMetaBuf[i * 4 + 1] = 0;
        continue;
      }

      if (dt > 0) {
        age += dt;
        this._dropSim[b12 + 6] = age;
        if (age >= maxAge) {
          this._dropMetaBuf[i * 4 + 1] = 0;
          continue;
        }

        let phi = this._dropSim[b12];
        let y = this._dropSim[b12 + 1];
        let r = this._dropSim[b12 + 2];
        let vTang = this._dropSim[b12 + 3];
        let vy = this._dropSim[b12 + 4];
        let vRad = this._dropSim[b12 + 5];

        const drag = Math.max(0.0, 1.0 - 1.15 * dt);
        vTang = (vTang + (wind * 0.55 + vortexSpin * 0.75) * dt) * drag;
        vRad *= drag;
        vy -= grav * dt;

        r += vRad * dt;
        if (r < R + 0.08) {
          r = R + 0.08;
          vRad = Math.abs(vRad) * 0.42;
        }
        phi = wrapPositiveAngle(phi + (vTang / Math.max(2.0, r)) * dt);
        y += vy * dt;

        if (y < -0.06 && vy < 0) {
          this._dropSim[b12 + 6] = maxAge + 1;
          this._dropMetaBuf[i * 4 + 1] = 0;
          continue;
        }

        this._dropSim[b12] = phi;
        this._dropSim[b12 + 1] = y;
        this._dropSim[b12 + 2] = r;
        this._dropSim[b12 + 3] = vTang;
        this._dropSim[b12 + 4] = vy;
        this._dropSim[b12 + 5] = vRad;
        this._dropSim[b12 + 9] += this._dropSim[b12 + 10] * dt;
      }

      const life = age / maxAge;
      const curPhi = this._dropSim[b12];
      const curY = this._dropSim[b12 + 1];
      const curR = this._dropSim[b12 + 2];
      const baseSize = this._dropSim[b12 + 8];

      const p3 = i * 3;
      this._dropPosBuf[p3] = Math.sin(curPhi) * curR;
      this._dropPosBuf[p3 + 1] = curY;
      this._dropPosBuf[p3 + 2] = Math.cos(curPhi) * curR;

      const fadeIn = Math.min(1.0, life * 7.5);
      const fadeOut = 1.0 - life * life;
      const m4 = i * 4;
      this._dropMetaBuf[m4] = baseSize * (0.88 + 0.34 * life);
      this._dropMetaBuf[m4 + 1] = fadeIn * fadeOut * 0.90;
      this._dropMetaBuf[m4 + 2] = this._dropSim[b12 + 9];
      this._dropMetaBuf[m4 + 3] = this._dropSim[b12 + 11];
    }

    if (dt > 0) {
      this._seaMistAccum += Math.min(34.0, 22.0 * this._biomeMistRateScale) * dt;
      while (this._seaMistAccum >= 1.0) {
        this._seaMistAccum -= 1.0;
        const slot = this._seaMistCursor;
        this._seaMistCursor = (this._seaMistCursor + 1) % SEA_MIST_SLOTS;

        const side = this._rand() < 0.5 ? -1.0 : 1.0;
        const mPhi =
          this._rand() < 0.75
            ? wrapPositiveAngle(camPhi + side * (0.55 + this._rand() * 0.90))
            : this._rand() * TWO_PI;
        const b16 = slot * 16;

        this._mistSim[b16] = mPhi;
        this._mistSim[b16 + 1] = localWaterY + 0.35 + this._rand() * 1.65;
        this._mistSim[b16 + 2] = R + 0.38 + this._rand() * 1.25;
        this._mistSim[b16 + 3] = (this._rand() - 0.5) * 0.35 + wind * 0.35 + flowDrift * 0.18;
        this._mistSim[b16 + 4] = 0.24 + this._rand() * 0.42;
        this._mistSim[b16 + 5] = 0.12 + this._rand() * 0.26;
        this._mistSim[b16 + 6] = 0;
        this._mistSim[b16 + 7] = 2.0 + this._rand() * 1.4;
        this._mistSim[b16 + 8] = 1.45 + this._rand() * 1.15;
        this._mistSim[b16 + 9] = 0.15 + this._rand() * 0.055;
        this._mistSim[b16 + 10] = this._rand() * TWO_PI;
        this._mistSim[b16 + 11] = (this._rand() - 0.5) * 0.34;
        this._mistSim[b16 + 12] = Math.floor(this._rand() * 4);
        this._mistSim[b16 + 13] = 3;
        this._mistSim[b16 + 14] = localWaterY;
        this._mistSim[b16 + 15] = 0;
      }
    }
  }

  _spawnSurfPlume(phi, r, energy, wind) {
    const idx = this._plumeCursor;
    this._plumeCursor = (this._plumeCursor + 1) % MAX_SURF_PLUMES;
    const b15 = idx * 15;
    const e = Math.min(1.85, Math.max(0.45, energy));

    this._plumeSim[b15] = wrapPositiveAngle(phi + (this._rand() - 0.5) * 0.12);
    this._plumeSim[b15 + 1] = 0.12 + this._rand() * 0.38;
    this._plumeSim[b15 + 2] = r;
    this._plumeSim[b15 + 3] = (this._rand() - 0.5) * 0.65 + wind * 0.42;
    this._plumeSim[b15 + 4] = (1.60 + this._rand() * 2.15) * e;
    this._plumeSim[b15 + 5] = (0.38 + this._rand() * 0.95) * e;
    this._plumeSim[b15 + 6] = 0;
    this._plumeSim[b15 + 7] = 0.72 + this._rand() * 0.58;
    this._plumeSim[b15 + 8] = (0.75 + this._rand() * 0.46) * Math.sqrt(e);
    this._plumeSim[b15 + 9] = (1.65 + this._rand() * 0.92) * Math.sqrt(e);
    this._plumeSim[b15 + 10] = Math.min(0.68, 0.36 + this._rand() * 0.24 * e);
    this._plumeSim[b15 + 11] = this._rand() * TWO_PI;
    this._plumeSim[b15 + 12] = (this._rand() - 0.5) * 1.35;
    this._plumeSim[b15 + 13] = Math.floor(this._rand() * 4);
    this._plumeSim[b15 + 14] = this._rand();
  }

  _spawnSeaDroplet(phi, y, r, energy, wind) {
    const idx = this._dropCursor;
    this._dropCursor = (this._dropCursor + 1) % MAX_SEA_DROPLETS;
    const b12 = idx * 12;
    const e = Math.min(1.38, Math.max(0.45, energy));

    this._dropSim[b12] = wrapPositiveAngle(phi + (this._rand() - 0.5) * 0.16);
    this._dropSim[b12 + 1] = Math.min(1.25, y);
    this._dropSim[b12 + 2] = r;
    this._dropSim[b12 + 3] = (this._rand() - 0.5) * 1.25 + wind * 0.48;
    this._dropSim[b12 + 4] = (1.65 + this._rand() * 2.55) * e;
    this._dropSim[b12 + 5] = (0.24 + this._rand() * 1.08) * e;
    this._dropSim[b12 + 6] = 0;
    this._dropSim[b12 + 7] = 0.52 + this._rand() * 0.54;
    this._dropSim[b12 + 8] = 0.12 + this._rand() * 0.15;
    this._dropSim[b12 + 9] = this._rand() * TWO_PI;
    this._dropSim[b12 + 10] = (this._rand() - 0.5) * 2.4;
    this._dropSim[b12 + 11] = Math.floor(this._rand() * 4);
  }

  _stepDoorAndLedgeMist(localWaterY, _camCol, wind, time, dt, toppleDeltaY = 0) {
    const R = this.towerRadius;
    const doorMistCap = MAX_MIST_WISPS - SEA_MIST_SLOTS;

    if (dt > 0) {
      if (this._doorEmitterCount > 0) {
        const doorRate = Math.min(44.0, this._doorEmitterCount * 5.6 * this._biomeMistRateScale);
        this._doorMistAccum += doorRate * dt;
        while (this._doorMistAccum >= 1.0) {
          this._doorMistAccum -= 1.0;
          const eIdx = Math.floor(this._rand() * this._doorEmitterCount);
          const eBase = eIdx * 5;
          const dPhi = this._doorEmitterData[eBase];
          const dFloorY = this._doorEmitterData[eBase + 1];
          const dH = this._doorEmitterData[eBase + 2];
          const tintType = this._doorEmitterData[eBase + 3];
          const rateWeight = this._doorEmitterData[eBase + 4];

          if (dFloorY + dH * 0.4 <= localWaterY) continue;
          if (rateWeight < 0.9 && this._rand() > rateWeight) continue;

          const slot = this._doorMistCursor;
          this._doorMistCursor = SEA_MIST_SLOTS + ((slot - SEA_MIST_SLOTS + 1) % doorMistCap);
          const b16 = slot * 16;

          const isSillMist = tintType === 2 && rateWeight < 0.85;
          this._mistSim[b16] = wrapPositiveAngle(dPhi + (this._rand() - 0.5) * 0.08);
          this._mistSim[b16 + 1] = isSillMist
            ? dFloorY + 0.10 + this._rand() * 0.22
            : dFloorY + dH * (0.12 + this._rand() * 0.62);
          this._mistSim[b16 + 2] = isSillMist ? R + 0.34 + this._rand() * 0.18 : R + 0.22 + this._rand() * 0.18;
          this._mistSim[b16 + 3] = (this._rand() - 0.5) * 0.28 + wind * 0.18;
          this._mistSim[b16 + 4] = -0.04 - this._rand() * 0.08;
          this._mistSim[b16 + 5] = 0.09 + this._rand() * 0.18;
          this._mistSim[b16 + 6] = 0;
          this._mistSim[b16 + 7] = 2.0 + this._rand() * 1.25;
          this._mistSim[b16 + 8] = isSillMist ? 0.68 + this._rand() * 0.34 : 0.92 + this._rand() * 0.56;
          this._mistSim[b16 + 9] = isSillMist ? 0.14 + this._rand() * 0.045 : 0.17 + this._rand() * 0.04;
          this._mistSim[b16 + 10] = this._rand() * TWO_PI;
          this._mistSim[b16 + 11] = (this._rand() - 0.5) * 0.24;
          this._mistSim[b16 + 12] = Math.floor(this._rand() * 4);
          this._mistSim[b16 + 13] = tintType;
          this._mistSim[b16 + 14] = dFloorY + 0.10;
          this._mistSim[b16 + 15] = 1;
        }
      }

      if (this._ledgeMistCount > 0) {
        const ledgeRate = Math.min(26.0, this._ledgeMistCount * 2.4 * this._biomeMistRateScale);
        this._ledgeMistAccum += ledgeRate * dt;
        while (this._ledgeMistAccum >= 1.0) {
          this._ledgeMistAccum -= 1.0;
          const lIdx = Math.floor(this._rand() * this._ledgeMistCount);
          const lBase = lIdx * 4;
          const phiMid = this._ledgeMistData[lBase];
          const spanRad = this._ledgeMistData[lBase + 1];
          const surfY = this._ledgeMistData[lBase + 2];
          const sizeMult = this._ledgeMistData[lBase + 3];

          if (surfY <= localWaterY + 0.08) continue;

          const slot = this._doorMistCursor;
          this._doorMistCursor = SEA_MIST_SLOTS + ((slot - SEA_MIST_SLOTS + 1) % doorMistCap);
          const b16 = slot * 16;

          const sideDir = this._rand() < 0.5 ? -1 : 1;
          this._mistSim[b16] = wrapPositiveAngle(phiMid + (this._rand() - 0.5) * spanRad);
          this._mistSim[b16 + 1] = surfY + 0.10 + this._rand() * 0.38;
          this._mistSim[b16 + 2] = R + 0.46 + this._rand() * 0.72;
          this._mistSim[b16 + 3] = sideDir * (0.12 + this._rand() * 0.26) + wind * 0.26;
          this._mistSim[b16 + 4] = -0.02 + this._rand() * 0.09;
          this._mistSim[b16 + 5] = 0.10 + this._rand() * 0.22;
          this._mistSim[b16 + 6] = 0;
          this._mistSim[b16 + 7] = 2.2 + this._rand() * 1.45;
          this._mistSim[b16 + 8] = (1.15 + this._rand() * 0.85) * sizeMult;
          this._mistSim[b16 + 9] = 0.14 + this._rand() * 0.065;
          this._mistSim[b16 + 10] = this._rand() * TWO_PI;
          this._mistSim[b16 + 11] = (this._rand() - 0.5) * 0.22;
          this._mistSim[b16 + 12] = Math.floor(this._rand() * 4);
          this._mistSim[b16 + 13] = 0;
          this._mistSim[b16 + 14] = surfY + 0.08;
          this._mistSim[b16 + 15] = 2;
        }
      }
    }

    for (let i = 0; i < MAX_MIST_WISPS; i++) {
      const b16 = i * 16;
      let age = this._mistSim[b16 + 6];
      const maxAge = this._mistSim[b16 + 7];

      if (age >= maxAge) {
        this._mistMetaBuf[i * 4 + 1] = 0;
        continue;
      }

      if (dt > 0) {
        age += dt;
        this._mistSim[b16 + 6] = age;
        if (age >= maxAge) {
          this._mistMetaBuf[i * 4 + 1] = 0;
          continue;
        }

        let phi = this._mistSim[b16];
        let y = this._mistSim[b16 + 1];
        let r = this._mistSim[b16 + 2];
        let vTang = this._mistSim[b16 + 3];
        let vy = this._mistSim[b16 + 4];
        let vRad = this._mistSim[b16 + 5];
        const floorY = this._mistSim[b16 + 14];
        const kind = this._mistSim[b16 + 15];

        const curl = Math.sin(time * 1.15 + i * 0.73) * 0.08;
        vTang += (wind * 0.18 + curl) * dt;
        vTang *= Math.max(0.0, 1.0 - 0.52 * dt);
        vRad *= Math.max(0.0, 1.0 - 0.58 * dt);

        y += vy * dt;
        r += vRad * dt;

        if (kind >= 1) {
          if (r < R + 1.15 && y < floorY) {
            y = floorY;
            vy = 0.015;
            vTang += (vTang >= 0 ? 1 : -1) * 0.18 * dt;
          } else if (r >= R + 1.15) {
            vy = Math.max(-0.16, vy - 0.06 * dt);
          }
        } else {
          if (i < SEA_MIST_SLOTS && toppleDeltaY !== 0) {
            y -= toppleDeltaY;
          }
          vy *= Math.max(0.0, 1.0 - 0.58 * dt);
          if (y < localWaterY + 0.08) y = localWaterY + 0.08;
        }

        phi = wrapPositiveAngle(phi + (vTang / Math.max(2.0, r)) * dt);

        this._mistSim[b16] = phi;
        this._mistSim[b16 + 1] = y;
        this._mistSim[b16 + 2] = r;
        this._mistSim[b16 + 3] = vTang;
        this._mistSim[b16 + 4] = vy;
        this._mistSim[b16 + 5] = vRad;
        this._mistSim[b16 + 10] += this._mistSim[b16 + 11] * dt;
      }

      const life = age / maxAge;
      const curPhi = this._mistSim[b16];
      const curY = this._mistSim[b16 + 1];
      const curR = this._mistSim[b16 + 2];
      const baseSize = this._mistSim[b16 + 8];
      const peakAlpha = this._mistSim[b16 + 9];
      const tintId = this._mistSim[b16 + 13];
      const kind = this._mistSim[b16 + 15];

      const fadeIn = Math.sin(Math.min(1.0, life / 0.22) * Math.PI * 0.5);
      const fadeOut = life > 0.36 ? Math.cos(((life - 0.36) / 0.64) * Math.PI * 0.5) : 1.0;
      const alpha = Math.min(0.22, peakAlpha * fadeIn * fadeOut);

      const aspectFrac = kind === 2 ? 0.32 : kind === 1 ? 0.24 : 0.18;

      const p4 = i * 4;
      this._mistPosBuf[p4] = Math.sin(curPhi) * curR;
      this._mistPosBuf[p4 + 1] = curY;
      this._mistPosBuf[p4 + 2] = Math.cos(curPhi) * curR;
      this._mistPosBuf[p4 + 3] = baseSize * (0.80 + 0.55 * life);

      this._mistMetaBuf[p4] = this._mistSim[b16 + 10];
      this._mistMetaBuf[p4 + 1] = alpha;
      this._mistMetaBuf[p4 + 2] = this._mistSim[b16 + 12];
      this._mistMetaBuf[p4 + 3] = tintId + aspectFrac;
    }
  }

  _stepSparksAndGlows(localWaterY, camCol, wind, time, dt, liveLedges) {
    const archCount = this._sparkArchCount;
    if (archCount === 0) return;

    const R = this.towerRadius;
    const cols = this.cols;
    const camPhi = camCol * this.colAngle;

    let bestIdx0 = -1;
    let bestScore0 = -1;
    let bestGlow0 = 0;
    let bestIdx1 = -1;
    let bestScore1 = -1;
    let bestGlow1 = 0;

    let glowSlot = 0;

    for (let a = 0; a < archCount; a++) {
      const sBase = a * 7;
      const phi = this._sparkArchData[sBase];
      const floorY = this._sparkArchData[sBase + 1];
      const doorH = this._sparkArchData[sBase + 2];
      const tangDir = this._sparkArchData[sBase + 3];
      const seed = this._sparkArchData[sBase + 4];
      const wasSub = this._sparkArchData[sBase + 5];

      const submerged = floorY + 0.15 <= localWaterY;
      if (submerged) {
        if (wasSub < 0.5 && dt > 0) {
          this._sparkArchData[sBase + 5] = 1;
          this.steamPlumeMesh.visible = true;
          for (let q = 0; q < 10; q++) {
            this._spawnSteamPuff(
              phi + (this._rand() - 0.5) * 0.16,
              localWaterY + 0.08,
              R + 0.45 + this._rand() * 0.35,
              3.8 + this._rand() * 2.8,
              0.38,
              1.05,
              0.36,
              0.58,
              wind
            );
          }
        }
        continue;
      }
      this._sparkArchData[sBase + 5] = 0;

      const w1 = Math.sin(time * 7.3 + seed);
      const w2 = Math.sin(time * 19.1 + seed * 2.3);
      const w3 = Math.cos(time * 34.7 - seed * 1.7);
      const rawSpike = Math.max(0.0, w1 * 0.45 + w2 * 0.35 + w3 * 0.20 + 0.38);
      const sputter = Math.min(1.0, Math.pow(rawSpike, 1.85) * 1.48);
      const flicker = 0.54 + 0.46 * sputter;

      const angDelta = Math.abs(wrapAngle(phi - camPhi));
      const inFront = angDelta < 1.95;
      if (dt > 0) {
        const rate = inFront ? 120.0 + sputter * 200.0 : 26.0 + sputter * 40.0;
        let accum = this._sparkArchData[sBase + 6] + rate * dt;
        while (accum >= 1.0) {
          accum -= 1.0;
          this._spawnConduitSpark(phi, floorY, doorH, tangDir, sputter);
        }
        this._sparkArchData[sBase + 6] = accum;
      }

      if (glowSlot + 2 < MAX_SPARK_GLOWS) {
        const poolPhi = phi + (tangDir * 0.56) / R;
        const poolR = R + 0.62;
        const g0 = glowSlot * 4;
        this._glowPosBuf[g0] = Math.sin(poolPhi) * poolR;
        this._glowPosBuf[g0 + 1] = floorY + 0.03;
        this._glowPosBuf[g0 + 2] = Math.cos(poolPhi) * poolR;
        this._glowPosBuf[g0 + 3] = poolPhi;
        this._glowScaleBuf[g0] = 1.75 + sputter * 0.40;
        this._glowScaleBuf[g0 + 1] = 0.95 + sputter * 0.20;
        this._glowScaleBuf[g0 + 2] = 0.72 + flicker * 0.62;
        this._glowScaleBuf[g0 + 3] = 0;
        glowSlot++;

        const mouthPoolPhi = phi + (tangDir * 0.24) / R;
        const mouthPoolR = R + 0.56;
        const g1 = glowSlot * 4;
        this._glowPosBuf[g1] = Math.sin(mouthPoolPhi) * mouthPoolR;
        this._glowPosBuf[g1 + 1] = floorY + 0.032;
        this._glowPosBuf[g1 + 2] = Math.cos(mouthPoolPhi) * mouthPoolR;
        this._glowPosBuf[g1 + 3] = mouthPoolPhi;
        this._glowScaleBuf[g1] = 0.92 + sputter * 0.26;
        this._glowScaleBuf[g1 + 1] = 0.68 + sputter * 0.14;
        this._glowScaleBuf[g1 + 2] = 0.85 + flicker * 0.68;
        this._glowScaleBuf[g1 + 3] = 0;
        glowSlot++;

        const hearthR = R + 0.34;
        const g2 = glowSlot * 4;
        this._glowPosBuf[g2] = Math.sin(phi) * hearthR;
        this._glowPosBuf[g2 + 1] = floorY + 0.22;
        this._glowPosBuf[g2 + 2] = Math.cos(phi) * hearthR;
        this._glowPosBuf[g2 + 3] = phi;
        this._glowScaleBuf[g2] = 0.62;
        this._glowScaleBuf[g2 + 1] = 0.42;
        this._glowScaleBuf[g2 + 2] = 0.56 + flicker * 0.52;
        this._glowScaleBuf[g2 + 3] = 1;
        glowSlot++;
      }

      const visScore = Math.cos(Math.min(Math.PI, angDelta)) + 1.05;
      if (visScore > bestScore0) {
        bestIdx1 = bestIdx0;
        bestScore1 = bestScore0;
        bestGlow1 = bestGlow0;
        bestIdx0 = a;
        bestScore0 = visScore;
        bestGlow0 = flicker;
      } else if (visScore > bestScore1) {
        bestIdx1 = a;
        bestScore1 = visScore;
        bestGlow1 = flicker;
      }
    }

    for (let g = glowSlot; g < MAX_SPARK_GLOWS; g++) {
      this._glowScaleBuf[g * 4 + 2] = 0;
    }

    for (let li = 0; li < this.sparkLights.length; li++) {
      const light = this.sparkLights[li];
      if (!light) continue;
      const chosenIdx = li === 0 ? bestIdx0 : bestIdx1;
      const chosenFlicker = li === 0 ? bestGlow0 : bestGlow1;
      const chosenScore = li === 0 ? bestScore0 : bestScore1;
      if (chosenIdx >= 0 && chosenScore > 0.25) {
        const sb = chosenIdx * 7;
        const lPhi = this._sparkArchData[sb] + (this._sparkArchData[sb + 3] * 0.52) / R;
        const lY = this._sparkArchData[sb + 1] + 0.42;
        const lR = R + 0.85;
        light.position.set(Math.sin(lPhi) * lR, lY, Math.cos(lPhi) * lR);
        const hemiWeight = Math.min(1.0, Math.max(0.0, (chosenScore - 0.22) * 0.88));
        light.intensity = (1.65 + chosenFlicker * 2.35) * hemiWeight;
      } else {
        light.intensity = 0;
      }
    }

    const sparkGrav = 9.2;
    const fh = this.fh;

    for (let i = 0; i < MAX_SPARKS; i++) {
      const b12 = i * 12;
      let age = this._sparkSim[b12 + 6];
      const maxAge = this._sparkSim[b12 + 7];

      if (age >= maxAge) {
        this._sparkVelBuf[i * 4 + 3] = 0;
        continue;
      }

      if (dt > 0) {
        age += dt;
        this._sparkSim[b12 + 6] = age;
        if (age >= maxAge) {
          this._sparkVelBuf[i * 4 + 3] = 0;
          continue;
        }

        let phi = this._sparkSim[b12];
        const prevY = this._sparkSim[b12 + 1];
        let y = prevY;
        let r = this._sparkSim[b12 + 2];
        let vTang = this._sparkSim[b12 + 3];
        let vy = this._sparkSim[b12 + 4];
        let vRad = this._sparkSim[b12 + 5];
        let heatBoost = this._sparkSim[b12 + 9];

        const airDrag = Math.max(0.0, 1.0 - 1.05 * dt);
        vTang = (vTang + wind * 0.32 * dt) * airDrag;
        vRad *= airDrag;
        vy -= sparkGrav * dt;
        heatBoost = Math.max(0.0, heatBoost - 2.8 * dt);

        y += vy * dt;
        r += vRad * dt;

        if (r < R + 0.10 && age > 0.06) {
          r = R + 0.10;
          vRad = Math.abs(vRad) * 0.52 + 0.16;
          vTang *= 0.84;
        }

        phi = wrapPositiveAngle(phi + (vTang / Math.max(2.0, r)) * dt);

        if (y <= localWaterY + 0.02) {
          this._sparkSim[b12 + 6] = maxAge + 1;
          this._sparkVelBuf[i * 4 + 3] = 0;
          continue;
        }

        if (vy < -0.04 && r >= R + 0.02 && r <= R + 1.38) {
          const col = wrapColIndex(Math.floor(phi / this.colAngle), cols);
          const approxFl = Math.round((y + 0.10) / fh);
          if (approxFl >= 0 && approxFl < MAX_GRID_FLOORS) {
            const cell = approxFl * cols + col;
            const surfY = this._ledgeSurfaceGrid[cell];
            if (surfY > -1e5 && prevY >= surfY - 0.08 && y <= surfY + 0.02) {
              let slabSolid = true;
              if (liveLedges) {
                const lIdx = this._ledgeIndexGrid[cell];
                if (lIdx >= 0 && lIdx < liveLedges.length) {
                  const liveL = liveLedges[lIdx];
                  if (liveL && (liveL.gone || liveL.active === false)) {
                    slabSolid = false;
                  }
                }
              }

              if (slabSolid) {
                const bounces = this._sparkSim[b12 + 10];
                const restitution = 0.35 + this._rand() * 0.26;
                const impactSpeed = -vy;

                y = surfY + 0.02;
                vy = impactSpeed * restitution;
                vTang = vTang * 0.78 + (this._rand() - 0.46) * Math.min(1.9, impactSpeed * 0.45);
                vRad = vRad * 0.76 + (this._rand() - 0.42) * Math.min(1.5, impactSpeed * 0.38);
                heatBoost = Math.min(0.55, 0.26 + impactSpeed * 0.08);
                this._sparkSim[b12 + 10] = bounces + 1;

                if (bounces < 1.5 && impactSpeed > 1.2 && this._rand() < 0.65) {
                  this._spawnBounceMicroSpark(phi, y + 0.01, r, vTang, vy, vRad);
                }
              }
            }
          }
        }

        this._sparkSim[b12] = phi;
        this._sparkSim[b12 + 1] = y;
        this._sparkSim[b12 + 2] = r;
        this._sparkSim[b12 + 3] = vTang;
        this._sparkSim[b12 + 4] = vy;
        this._sparkSim[b12 + 5] = vRad;
        this._sparkSim[b12 + 9] = heatBoost;
      }

      const life = age / maxAge;
      const curPhi = this._sparkSim[b12];
      const curY = this._sparkSim[b12 + 1];
      const curR = this._sparkSim[b12 + 2];
      const vTang = this._sparkSim[b12 + 3];
      const vy = this._sparkSim[b12 + 4];
      const vRad = this._sparkSim[b12 + 5];
      const size = this._sparkSim[b12 + 8];
      const heatBoost = this._sparkSim[b12 + 9];

      const sinP = Math.sin(curPhi);
      const cosP = Math.cos(curPhi);
      const vx = cosP * vTang + sinP * vRad;
      const vz = -sinP * vTang + cosP * vRad;

      const cooling = Math.pow(1.0 - life, 1.25);
      const heat = Math.min(1.0, cooling + heatBoost);

      const p4 = i * 4;
      this._sparkPosBuf[p4] = sinP * curR;
      this._sparkPosBuf[p4 + 1] = curY;
      this._sparkPosBuf[p4 + 2] = cosP * curR;
      this._sparkPosBuf[p4 + 3] = size * (0.72 + 0.42 * cooling);

      this._sparkVelBuf[p4] = vx;
      this._sparkVelBuf[p4 + 1] = vy;
      this._sparkVelBuf[p4 + 2] = vz;
      this._sparkVelBuf[p4 + 3] = heat;
    }
  }

  _spawnConduitSpark(archPhi, floorY, doorH, tangDir, sputter) {
    const idx = this._sparkCursor;
    this._sparkCursor = (this._sparkCursor + 1) % MAX_SPARKS;
    const b12 = idx * 12;
    const R = this.towerRadius;

    const dirBias = tangDir !== 0 ? tangDir : this._rand() < 0.5 ? -1 : 1;
    const speedScale = 0.92 + sputter * 0.62;
    const isDeepJet = this._rand() < 0.24;

    this._sparkSim[b12] = wrapPositiveAngle(
      archPhi + (isDeepJet ? 0 : dirBias * 0.042) + (this._rand() - 0.5) * 0.08
    );
    this._sparkSim[b12 + 1] = floorY + 0.08 + this._rand() * Math.min(0.45, doorH * 0.42);
    this._sparkSim[b12 + 2] = isDeepJet ? R + 0.36 + this._rand() * 0.18 : R + 0.54 + this._rand() * 0.18;

    this._sparkSim[b12 + 3] = isDeepJet
      ? (dirBias * (0.75 + this._rand() * 1.25) + (this._rand() - 0.5) * 0.6) * speedScale
      : (dirBias * (1.50 + this._rand() * 2.85) + (this._rand() - 0.45) * 0.9) * speedScale;
    this._sparkSim[b12 + 4] = (0.28 + this._rand() * 2.25) * speedScale;
    this._sparkSim[b12 + 5] = isDeepJet
      ? (1.60 + this._rand() * 1.80) * speedScale
      : (0.16 + this._rand() * 0.95) * speedScale;

    this._sparkSim[b12 + 6] = 0;
    this._sparkSim[b12 + 7] = 0.52 + this._rand() * 0.64;
    this._sparkSim[b12 + 8] = 0.046 + Math.pow(this._rand(), 1.35) * 0.054;
    this._sparkSim[b12 + 9] = 0.28;
    this._sparkSim[b12 + 10] = 0;
    this._sparkSim[b12 + 11] = this._rand();
  }

  _spawnBounceMicroSpark(phi, y, r, parentVT, parentVY, parentVR) {
    const idx = this._sparkCursor;
    this._sparkCursor = (this._sparkCursor + 1) % MAX_SPARKS;
    const b12 = idx * 12;

    this._sparkSim[b12] = phi;
    this._sparkSim[b12 + 1] = y;
    this._sparkSim[b12 + 2] = r;
    this._sparkSim[b12 + 3] = parentVT * 0.62 + (this._rand() - 0.5) * 1.95;
    this._sparkSim[b12 + 4] = Math.max(0.45, parentVY * (0.62 + this._rand() * 0.58));
    this._sparkSim[b12 + 5] = parentVR * 0.58 + (this._rand() - 0.45) * 1.35;
    this._sparkSim[b12 + 6] = 0;
    this._sparkSim[b12 + 7] = 0.26 + this._rand() * 0.30;
    this._sparkSim[b12 + 8] = 0.030 + this._rand() * 0.025;
    this._sparkSim[b12 + 9] = 0.38;
    this._sparkSim[b12 + 10] = 2;
    this._sparkSim[b12 + 11] = this._rand();
  }

  _stepSteamVents(localWaterY, wind, time, dt, liveLedges) {
    const R = this.towerRadius;

    if (dt > 0 && this._steamVentCount > 0) {
      for (let v = 0; v < this._steamVentCount; v++) {
        const vBase = v * 6;
        const phi = this._steamVentData[vBase];
        const surfY = this._steamVentData[vBase + 1];
        const period = this._steamVentData[vBase + 2];
        const offset = this._steamVentData[vBase + 3];
        const ledgeIdx = this._steamVentData[vBase + 4];

        if (surfY <= localWaterY) continue;

        let steamActive = false;
        let steamWarn = false;
        let ledgeGone = false;

        if (liveLedges && ledgeIdx >= 0 && ledgeIdx < liveLedges.length) {
          const ll = liveLedges[ledgeIdx];
          if (ll) {
            ledgeGone = Boolean(ll.gone);
            if (ll.steamActive !== undefined || ll.steamWarn !== undefined) {
              steamActive = Boolean(ll.steamActive);
              steamWarn = Boolean(ll.steamWarn);
            } else {
              const u = ((((time + offset) % period) + period) % period) / period;
              steamWarn = u >= 0.52 && u < 0.74;
              steamActive = u >= 0.74 && u < 0.96;
            }
          }
        } else {
          const u = ((((time + offset) % period) + period) % period) / period;
          steamWarn = u >= 0.52 && u < 0.74;
          steamActive = u >= 0.74 && u < 0.96;
        }

        if (ledgeGone) continue;

        const emitRate = steamActive ? 68.0 : steamWarn ? 24.0 : 4.5;
        let accum = this._steamVentData[vBase + 5] + emitRate * dt;
        while (accum >= 1.0) {
          accum -= 1.0;
          if (steamActive) {
            this._spawnSteamPuff(
              phi + (this._rand() - 0.5) * 0.05,
              surfY + 0.05,
              R + 0.48 + (this._rand() - 0.5) * 0.10,
              6.2 + this._rand() * 3.2,
              0.30 + this._rand() * 0.12,
              0.92 + this._rand() * 0.34,
              0.34,
              0.32,
              wind
            );
          } else if (steamWarn) {
            this._spawnSteamPuff(
              phi + (this._rand() - 0.5) * 0.08,
              surfY + 0.04,
              R + 0.48 + (this._rand() - 0.5) * 0.14,
              1.65 + this._rand() * 1.35,
              0.22 + this._rand() * 0.10,
              0.56 + this._rand() * 0.18,
              0.24,
              0.68,
              wind
            );
          } else {
            this._spawnSteamPuff(
              phi + (this._rand() - 0.5) * 0.06,
              surfY + 0.04,
              R + 0.48,
              0.65 + this._rand() * 0.40,
              0.20,
              0.48,
              0.08,
              0.22,
              wind
            );
          }
        }
        this._steamVentData[vBase + 5] = accum;
      }
    }

    let anyAlive = false;
    for (let i = 0; i < MAX_STEAM_PUFFS; i++) {
      const b15 = i * 15;
      let age = this._steamSim[b15 + 6];
      const maxAge = this._steamSim[b15 + 7];

      if (age >= maxAge) {
        this._steamMetaBuf[i * 4 + 1] = 0;
        continue;
      }

      if (dt > 0) {
        age += dt;
        this._steamSim[b15 + 6] = age;
        if (age >= maxAge) {
          this._steamMetaBuf[i * 4 + 1] = 0;
          continue;
        }

        let phi = this._steamSim[b15];
        let y = this._steamSim[b15 + 1];
        let r = this._steamSim[b15 + 2];
        let vTang = this._steamSim[b15 + 3];
        let vy = this._steamSim[b15 + 4];
        let vRad = this._steamSim[b15 + 5];

        const drag = Math.max(0.0, 1.0 - 2.25 * dt);
        vy = vy * drag + 0.48 * dt;
        vTang = (vTang + wind * 0.48 * dt + Math.sin(time * 9.0 + i) * 0.35 * dt) * drag;
        vRad *= drag;

        y += vy * dt;
        r = Math.max(R + 0.15, r + vRad * dt);
        phi = wrapPositiveAngle(phi + (vTang / Math.max(2.0, r)) * dt);

        this._steamSim[b15] = phi;
        this._steamSim[b15 + 1] = y;
        this._steamSim[b15 + 2] = r;
        this._steamSim[b15 + 3] = vTang;
        this._steamSim[b15 + 4] = vy;
        this._steamSim[b15 + 5] = vRad;
        this._steamSim[b15 + 11] += this._steamSim[b15 + 12] * dt;
      }

      anyAlive = true;
      const life = age / maxAge;
      const curPhi = this._steamSim[b15];
      const curY = this._steamSim[b15 + 1];
      const curR = this._steamSim[b15 + 2];
      const startSize = this._steamSim[b15 + 8];
      const endSize = this._steamSim[b15 + 9];
      const peakAlpha = this._steamSim[b15 + 10];
      const baseHeat = this._steamSim[b15 + 14];

      const fadeIn = Math.min(1.0, life * 7.0);
      const fadeOut = Math.cos(life * Math.PI * 0.5);

      const p4 = i * 4;
      this._steamPosBuf[p4] = Math.sin(curPhi) * curR;
      this._steamPosBuf[p4 + 1] = curY;
      this._steamPosBuf[p4 + 2] = Math.cos(curPhi) * curR;
      this._steamPosBuf[p4 + 3] = startSize + (endSize - startSize) * Math.sqrt(life);

      this._steamMetaBuf[p4] = this._steamSim[b15 + 11];
      this._steamMetaBuf[p4 + 1] = peakAlpha * fadeIn * fadeOut;
      this._steamMetaBuf[p4 + 2] = this._steamSim[b15 + 13];
      this._steamMetaBuf[p4 + 3] = baseHeat * (1.0 - life * 0.85);
    }

    if (this._steamVentCount === 0 && !anyAlive) {
      this.steamPlumeMesh.visible = false;
    }
  }

  _spawnSteamPuff(phi, y, r, vy, startSize, endSize, peakAlpha, heat, wind) {
    const idx = this._steamCursor;
    this._steamCursor = (this._steamCursor + 1) % MAX_STEAM_PUFFS;
    const b15 = idx * 15;

    this._steamSim[b15] = wrapPositiveAngle(phi);
    this._steamSim[b15 + 1] = y;
    this._steamSim[b15 + 2] = r;
    this._steamSim[b15 + 3] = (this._rand() - 0.5) * 0.52 + wind * 0.28;
    this._steamSim[b15 + 4] = vy;
    this._steamSim[b15 + 5] = (this._rand() - 0.42) * 0.48;
    this._steamSim[b15 + 6] = 0;
    this._steamSim[b15 + 7] = 0.40 + this._rand() * 0.36;
    this._steamSim[b15 + 8] = startSize;
    this._steamSim[b15 + 9] = endSize;
    this._steamSim[b15 + 10] = peakAlpha;
    this._steamSim[b15 + 11] = this._rand() * TWO_PI;
    this._steamSim[b15 + 12] = (this._rand() - 0.5) * 2.4;
    this._steamSim[b15 + 13] = Math.floor(this._rand() * 4);
    this._steamSim[b15 + 14] = heat;
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }

    for (let i = 0; i < this.sparkLights.length; i++) {
      const l = this.sparkLights[i];
      if (l.parent) l.parent.remove(l);
      if (typeof l.dispose === 'function') l.dispose();
    }
    this.sparkLights.length = 0;

    for (let i = 0; i < this._geometries.length; i++) {
      this._geometries[i].dispose();
    }
    this._geometries.length = 0;

    for (let i = 0; i < this._materials.length; i++) {
      this._materials[i].dispose();
    }
    this._materials.length = 0;

    for (let i = 0; i < this._textures.length; i++) {
      this._textures[i].dispose();
    }
    this._textures.length = 0;

    this._tower = null;
    this.scene = null;
  }
}

export default TowerFluidAndSparkVFX;
