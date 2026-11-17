// Principal Environment, Sky, 3D Archipelago Horizon & Weather Shader System (`StormAtmosphere`)
// - High-Resolution Baked Textures (zero blurry low-freq noise, zero artificial blobs):
//   1. `1024x512` RGBA Seamless Multi-Octave Ridged/Worley Cumulonimbus Panorama (`uCloudPanoTex`):
//      R = towering billowy cumulonimbus cloud banks, G = directional crest lighting normal for crisp
//      silver-blue moonlit edges, B = feathery translucent cloud filaments & diagonal virga rain shafts,
//      A = cosmic nebula dust & fine star clusters.
//   2. `512x512` RGBA Photographic Cratered Full Moon Texture (`uMoonTex`):
//      True near-side Lunar Maria (Imbrium, Procellarum, Serenitatis, Tranquillitatis, Crisium),
//      68 multi-scale ringed impact craters + Tycho/Copernicus rays, veiled naturally ONLY by delicate
//      translucent wispy cloud filaments (`uCloudPanoTex.b`).
//   3. `512x256` RGBA Turbulent Gas-Giant Banded Texture (`uPlanetTex`) + Cassini Ring Shader for
//      Original '87 Mode (3D spherical terminator, Rayleigh limb glow, ring shadow on planet & rings).
// - Real 3D Layered Archipelago Horizon Silhouettes & Rolling Sea-Mist (`r = 52..86m`):
//   4 distinct merged single-draw-call 3D biome horizon vistas (Coastal Sea-Stacks/Arches/Sister
//   Watchtowers for T1-T2; Volcanic Calderas & Smoking Smelters/Rigs for T3/T6; Arctic Glacier Horns &
//   Tabular Icebergs + 3D Multi-Curtain Boreal Aurora Ribbons for T4; Fractured Crystal Obelisks &
//   7 Maelstrom Monolith Spires for T5/T7/T8; Alien Peaks for Original '87) + 3D Rolling Sea-Fog Ring
//   eliminating any 1px CG horizon seam!
// - 144 Multi-Scale Bioluminescent Cyan-Emerald Fireflies/Bokeh, 84 Wave-Synced Sea-Spray Plumes,
//   Particulate Snow/Embers, Wind/Rain Streaks, and 3D Tapered Forked Lightning Bolts.
// - Strict zero per-frame heap/GC allocations (`Float32Array` & pre-allocated scratch structs only).

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const DEFAULT_COLS = 16;
const COL_ANGLE = TWO_PI / DEFAULT_COLS;
const DEFAULT_TOWER_RADIUS = 2.55;
const DEFAULT_FLOOR_HEIGHT = 1.0;
const STEP_ORIGINAL = 0.43;

export const THEME_ATMOSPHERE_PRESETS = Object.freeze({
  mist: Object.freeze({
    vista: 'coastal',
    zenith: '#030712',
    midSky: '#0b182c',
    horizon: '#162b44',
    horizonMist: '#1f3b58',
    cloudDark: '#050b16',
    cloudMid: '#12243b',
    cloudRim: '#dceeff',
    moonTint: '#eef6ff',
    corona: '#8cc4ff',
    mountNear: '#060e1b',
    mountFar: '#12263d',
    beacon: '#ffaa33',
    beaconAlt: '#00f5c8',
    moteA: '#00f5c8',
    moteB: '#0ee876',
    moteC: '#00d4ff',
    aurora: 0.0,
    nebula: 0.0,
    smog: 0.0,
    maelstrom: 0.0,
    virga: 0.35,
    abyssMist: 0.28,
    cloudCover: 0.82,
    moonAmt: 1.02,
    snow: 0,
    embers: 0,
    rain: 0.0,
    ambientBolts: 0,
  }),
  sinking: Object.freeze({
    vista: 'coastal',
    zenith: '#030b13',
    midSky: '#08222e',
    horizon: '#123e4a',
    horizonMist: '#1c5863',
    cloudDark: '#041018',
    cloudMid: '#143844',
    cloudRim: '#bdf5f0',
    moonTint: '#e4fcfc',
    corona: '#67e8f9',
    mountNear: '#051219',
    mountFar: '#0f2f38',
    beacon: '#00f5c8',
    beaconAlt: '#ffaa33',
    moteA: '#00f5c8',
    moteB: '#0ee876',
    moteC: '#00e5ff',
    aurora: 0.0,
    nebula: 0.0,
    smog: 0.0,
    maelstrom: 0.0,
    virga: 0.42,
    abyssMist: 0.92,
    cloudCover: 0.85,
    moonAmt: 0.96,
    snow: 0,
    embers: 0,
    rain: 0.24,
    ambientBolts: 0,
  }),
  foundry: Object.freeze({
    vista: 'volcanic',
    zenith: '#08060b',
    midSky: '#1b1218',
    horizon: '#3d1d13',
    horizonMist: '#5c2916',
    cloudDark: '#0b080b',
    cloudMid: '#2c1d21',
    cloudRim: '#fed7aa',
    moonTint: '#ffedd5',
    corona: '#fdba74',
    mountNear: '#0b0709',
    mountFar: '#281513',
    beacon: '#ff6a14',
    beaconAlt: '#fbbf24',
    moteA: '#ff7b00',
    moteB: '#ffc300',
    moteC: '#00f5c8',
    aurora: 0.0,
    nebula: 0.0,
    smog: 1.0,
    maelstrom: 0.0,
    virga: 0.18,
    abyssMist: 0.22,
    cloudCover: 0.88,
    moonAmt: 0.86,
    snow: 0,
    embers: 1,
    rain: 0.0,
    ambientBolts: 0,
  }),
  blizzard: Object.freeze({
    vista: 'glacial',
    zenith: '#030917',
    midSky: '#0a2039',
    horizon: '#1c405f',
    horizonMist: '#2d5a7b',
    cloudDark: '#061222',
    cloudMid: '#1d3a58',
    cloudRim: '#e0f2fe',
    moonTint: '#f0f9ff',
    corona: '#7dd3fc',
    mountNear: '#0c1e33',
    mountFar: '#214463',
    beacon: '#00e5ff',
    beaconAlt: '#ffaa33',
    moteA: '#00f5c8',
    moteB: '#00d4ff',
    moteC: '#0ee876',
    aurora: 1.0,
    nebula: 0.0,
    smog: 0.0,
    maelstrom: 0.0,
    virga: 0.30,
    abyssMist: 0.34,
    cloudCover: 0.72,
    moonAmt: 1.04,
    snow: 1,
    embers: 0,
    rain: 0.0,
    ambientBolts: 0,
  }),
  prism: Object.freeze({
    vista: 'maelstrom',
    zenith: '#050313',
    midSky: '#160e32',
    horizon: '#2a184d',
    horizonMist: '#3c2266',
    cloudDark: '#080518',
    cloudMid: '#251846',
    cloudRim: '#f0abfc',
    moonTint: '#fae8ff',
    corona: '#c084fc',
    mountNear: '#09061b',
    mountFar: '#21133e',
    beacon: '#e879f9',
    beaconAlt: '#00f5c8',
    moteA: '#00f5c8',
    moteB: '#d946ef',
    moteC: '#0ee876',
    aurora: 0.18,
    nebula: 1.0,
    smog: 0.0,
    maelstrom: 0.15,
    virga: 0.12,
    abyssMist: 0.25,
    cloudCover: 0.75,
    moonAmt: 0.98,
    snow: 0,
    embers: 0,
    rain: 0.0,
    ambientBolts: 0,
  }),
  piston: Object.freeze({
    vista: 'volcanic',
    zenith: '#040912',
    midSky: '#102234',
    horizon: '#1e384c',
    horizonMist: '#284960',
    cloudDark: '#060f1b',
    cloudMid: '#1b3146',
    cloudRim: '#cbe3ff',
    moonTint: '#e8f3ff',
    corona: '#7dd3fc',
    mountNear: '#07101a',
    mountFar: '#162a3d',
    beacon: '#fbbf24',
    beaconAlt: '#ef4444',
    moteA: '#00f5c8',
    moteB: '#0ee876',
    moteC: '#00d4ff',
    aurora: 0.0,
    nebula: 0.0,
    smog: 0.24,
    maelstrom: 0.0,
    virga: 0.65,
    abyssMist: 0.32,
    cloudCover: 0.88,
    moonAmt: 0.92,
    snow: 0,
    embers: 0,
    rain: 0.44,
    ambientBolts: 0,
  }),
  blackout: Object.freeze({
    vista: 'volcanic',
    zenith: '#02050d',
    midSky: '#091325',
    horizon: '#14233c',
    horizonMist: '#1e3250',
    cloudDark: '#040912',
    cloudMid: '#14243b',
    cloudRim: '#c7e0ff',
    moonTint: '#e2eeff',
    corona: '#7dd3fc',
    mountNear: '#040912',
    mountFar: '#0f1d32',
    beacon: '#38bdf8',
    beaconAlt: '#ffaa33',
    moteA: '#00f5c8',
    moteB: '#0ee876',
    moteC: '#00d4ff',
    aurora: 0.0,
    nebula: 0.0,
    smog: 0.0,
    maelstrom: 0.35,
    virga: 0.85,
    abyssMist: 0.28,
    cloudCover: 0.93,
    moonAmt: 0.90,
    snow: 0,
    embers: 0,
    rain: 0.65,
    ambientBolts: 1,
  }),
  apex: Object.freeze({
    vista: 'maelstrom',
    zenith: '#05030f',
    midSky: '#180f2b',
    horizon: '#2c1838',
    horizonMist: '#3e2246',
    cloudDark: '#070512',
    cloudMid: '#251738',
    cloudRim: '#e0e7ff',
    moonTint: '#eef2ff',
    corona: '#a5b4fc',
    mountNear: '#080512',
    mountFar: '#1f122e',
    beacon: '#fbbf24',
    beaconAlt: '#e879f9',
    moteA: '#00f5c8',
    moteB: '#0ee876',
    moteC: '#fbbf24',
    aurora: 0.38,
    nebula: 0.65,
    smog: 0.30,
    maelstrom: 1.0,
    virga: 0.62,
    abyssMist: 0.34,
    cloudCover: 0.91,
    moonAmt: 0.94,
    snow: 0,
    embers: 0,
    rain: 0.58,
    ambientBolts: 1,
  }),
});

// ============================================================================
// FAST BITWISE-PERIODIC NOISE & HIGH-RES TEXTURE BAKERS (ZERO EXTERNAL DEPS)
// ============================================================================

function buildPermTable(seed = 1337) {
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
}

const PERM_A = buildPermTable(20261987);
const PERM_B = buildPermTable(87192026);

// Power-of-two periodic value noise (pxMask = periodX - 1, pyMask = periodY - 1) — ultra-fast in V8!
function fastPeriodicNoise(u, v, px, py, perm, offsetSeed) {
  const x = u * px;
  const y = v * py;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const mx0 = (ix & (px - 1)) & 255;
  const mx1 = ((ix + 1) & (px - 1)) & 255;
  const my0 = ((iy & (py - 1)) + offsetSeed) & 255;
  const my1 = (((iy + 1) & (py - 1)) + offsetSeed) & 255;

  const a = perm[mx0 + perm[my0]];
  const b = perm[mx1 + perm[my0]];
  const c = perm[mx0 + perm[my1]];
  const d = perm[mx1 + perm[my1]];

  return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * (1 / 255);
}

// High-Resolution 1024x512 Seamless Cumulonimbus Storm Panorama
// R: Multi-octave billowy cumulonimbus cloud density
// G: Directional cloud-top / moonward illumination relief slope (chiseled silver-blue rims!)
// B: High-frequency feathery wispy cloud filaments + diagonal virga rain shafts
// A: Cosmic nebula dust + crisp star clusters
function createHighResCloudPanoramaTexture(w = 1024, h = 512) {
  const nCells = w * h;
  const heightField = new Float32Array(nCells);
  const wispField = new Float32Array(nCells);
  const nebField = new Float32Array(nCells);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;

      // Subtle domain warp for wind-sheared storm anvils
      const wx = fastPeriodicNoise(u, v, 8, 4, PERM_A, 11) - 0.5;
      const wy = fastPeriodicNoise(u, v, 8, 4, PERM_B, 29) - 0.5;
      const uw = u + wx * 0.055 + (v - 0.3) * 0.04;
      const vw = v + wy * 0.045;

      // 6-octave ridged + billowy cumulonimbus synthesis
      const o1 = fastPeriodicNoise(uw, vw, 4, 2, PERM_A, 3);
      const o2 = 1 - Math.abs(2 * fastPeriodicNoise(uw, vw, 8, 4, PERM_B, 17) - 1);
      const o3 = 1 - Math.abs(2 * fastPeriodicNoise(uw, vw, 16, 8, PERM_A, 43) - 1);
      const o4 = 1 - Math.abs(2 * fastPeriodicNoise(uw, vw, 32, 16, PERM_B, 71) - 1);
      const o5 = fastPeriodicNoise(uw, vw, 64, 32, PERM_A, 109);
      const o6 = fastPeriodicNoise(u, v, 128, 64, PERM_B, 151);

      const macro = o1 * 0.38 + o2 * 0.28 + o3 * 0.17 + o4 * 0.09 + o5 * 0.05 + o6 * 0.03;

      // Feathery high-altitude wisps + slanted virga streaks
      const shearU = u + v * 0.22;
      const f1 = 1 - Math.abs(2 * fastPeriodicNoise(shearU, v, 16, 8, PERM_B, 193) - 1);
      const f2 = fastPeriodicNoise(shearU, v, 32, 16, PERM_A, 211);
      const f3 = fastPeriodicNoise(shearU, v, 64, 32, PERM_B, 239);
      const virga = fastPeriodicNoise(u + v * 0.38, v * 0.5, 64, 8, PERM_A, 97);

      const idx = y * w + x;
      heightField[idx] = macro;
      wispField[idx] = Math.max(0, Math.min(1, f1 * 0.44 + f2 * 0.28 + f3 * 0.16 + virga * 0.12));

      // Nebula filament lane
      const n1 = 1 - Math.abs(2 * fastPeriodicNoise(u + wy * 0.08, v + wx * 0.08, 8, 4, PERM_A, 61) - 1);
      const n2 = fastPeriodicNoise(u, v, 32, 16, PERM_B, 131);
      nebField[idx] = Math.max(0, Math.min(1, Math.pow(n1, 1.8) * 0.72 + n2 * 0.28));
    }
  }

  // Second pass: bake crisp finite-difference cloud-top normal slope into Channel G
  const data = new Uint8Array(nCells * 4);
  for (let y = 0; y < h; y++) {
    const yUp = Math.min(h - 1, y + 2);
    const yDn = Math.max(0, y - 2);
    for (let x = 0; x < w; x++) {
      const xR = (x + 2) & (w - 1);
      const xL = (x - 2 + w) & (w - 1);
      const idx = y * w + x;
      const c = heightField[idx];
      // Slope facing upper-right moon (+x, +y) -> chiseled silver-lit turret crests!
      const dx = heightField[y * w + xL] - heightField[y * w + xR];
      const dy = heightField[yDn * w + x] - heightField[yUp * w + x];
      const slope = Math.max(0, Math.min(1, 0.5 + (dx * 1.9 + dy * 2.4)));

      const o4 = idx * 4;
      data[o4] = Math.round(Math.max(0, Math.min(1, c)) * 255);
      data[o4 + 1] = Math.round(slope * 255);
      data[o4 + 2] = Math.round(wispField[idx] * 255);
      data[o4 + 3] = Math.round(nebField[idx] * 255);
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Photographic 512x512 Cratered Full Moon Texture (authentic near-side Lunar Maria + 68 ringed craters + rays)
function createDetailedMoonTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);

  // Deterministic crater list: [cx, cy, radius, depth, hasRays]
  const craters = [];
  let seed = 19690720;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Hero ray craters (Tycho in south, Copernicus & Kepler in mid-west)
  craters.push([-0.14, -0.56, 0.085, 0.95, 1]);
  craters.push([-0.28, 0.12, 0.105, 0.88, 1]);
  craters.push([-0.52, 0.06, 0.068, 0.82, 1]);
  craters.push([0.34, -0.28, 0.092, 0.78, 0]);
  craters.push([-0.18, 0.54, 0.082, 0.75, 0]);
  for (let i = 0; i < 64; i++) {
    const ang = rnd() * TWO_PI;
    const rad = Math.sqrt(rnd()) * 0.88;
    craters.push([Math.cos(ang) * rad, Math.sin(ang) * rad, 0.018 + rnd() * 0.055, 0.35 + rnd() * 0.55, 0]);
  }

  // Authentic Lunar Maria centers: [mx, my, rx, ry, rot, darkness]
  const maria = [
    [-0.26, 0.30, 0.34, 0.28, 0.2, 0.54],  // Mare Imbrium
    [-0.54, 0.04, 0.28, 0.44, -0.15, 0.48], // Oceanus Procellarum
    [0.16, 0.28, 0.22, 0.20, 0.1, 0.52],   // Mare Serenitatis
    [0.34, 0.04, 0.25, 0.20, -0.3, 0.49],  // Mare Tranquillitatis
    [0.64, 0.20, 0.13, 0.16, 0.0, 0.55],   // Mare Crisium
    [0.44, -0.18, 0.18, 0.16, 0.2, 0.44],  // Mare Fecunditatis
    [-0.24, -0.26, 0.22, 0.18, -0.2, 0.42], // Mare Nubium
    [-0.48, -0.34, 0.15, 0.14, 0.0, 0.46], // Mare Humorum
  ];

  const half = size * 0.5;
  const discR = half * 0.96;

  for (let py = 0; py < size; py++) {
    const ny = (half - py) / discR;
    for (let px = 0; px < size; px++) {
      const nx = (px - half) / discR;
      const r2 = nx * nx + ny * ny;
      const idx = (py * size + px) * 4;
      if (r2 >= 1.03) {
        data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 0;
        continue;
      }

      const r = Math.sqrt(r2);
      const alpha = r <= 0.975 ? 1.0 : Math.max(0, 1.0 - (r - 0.975) / 0.055);
      const nz = Math.sqrt(Math.max(0.01, 1.0 - Math.min(1.0, r2)));

      // Spherical UV for multi-octave highland regolith micro-grain
      const su = 0.5 + Math.atan2(nx, nz) / Math.PI * 0.5;
      const sv = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;
      const reg1 = fastPeriodicNoise(su, sv, 16, 16, PERM_A, 19);
      const reg2 = fastPeriodicNoise(su, sv, 64, 64, PERM_B, 57);
      const reg3 = fastPeriodicNoise(su, sv, 128, 128, PERM_A, 113);
      const grain = reg1 * 0.5 + reg2 * 0.32 + reg3 * 0.18;

      // Sculpt ragged volcanic Mare shorelines
      let mareAmt = 0.0;
      for (let m = 0; m < maria.length; m++) {
        const [mx, my, rx, ry, rot, dark] = maria[m];
        const dx = nx - mx;
        const dy = ny - my;
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const ex = (dx * c - dy * s) / rx;
        const ey = (dx * s + dy * c) / ry;
        const dEll = Math.sqrt(ex * ex + ey * ey) + (reg1 - 0.5) * 0.36 + (reg2 - 0.5) * 0.16;
        const mask = Math.max(0, Math.min(1, (1.05 - dEll) * 2.4));
        mareAmt = Math.max(mareAmt, mask * dark);
      }

      // Accumulate crisp ringed craters + ejecta rays
      let craterShade = 0.0;
      let rayBright = 0.0;
      for (let k = 0; k < craters.length; k++) {
        const [cx, cy, cr, cd, rays] = craters[k];
        const dx = nx - cx;
        const dy = ny - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < cr * 1.45) {
          const q = dist / cr;
          if (q < 0.82) {
            // Depressed bowl + subtle directional upper-left sun relief
            const bowl = (1.0 - (q / 0.82) * (q / 0.82)) * -0.14 * cd;
            const innerSlope = ((dx * -0.65 + dy * 0.65) / Math.max(0.005, cr)) * 0.11 * cd;
            craterShade += bowl + innerSlope;
          } else if (q < 1.35) {
            // Bright raised crater rim
            const rim = Math.sin(((q - 0.82) / 0.53) * Math.PI);
            const rimLight = 0.09 + 0.08 * ((dx * -0.65 + dy * 0.65) / Math.max(0.005, dist));
            craterShade += rim * rimLight * cd;
          }
        }
        if (rays && dist > cr * 0.9 && dist < cr * 8.5) {
          const ang = Math.atan2(dy, dx);
          const streak = fastPeriodicNoise((ang + Math.PI) / TWO_PI, dist * 0.5, 32, 4, PERM_B, 201);
          const falloff = Math.exp(-(dist - cr) * 2.1);
          if (streak > 0.56) {
            rayBright += (streak - 0.56) * 1.45 * falloff * cd;
          }
        }
      }

      // Combine lunar highland ivory-silver vs refined slate-blue mare basalt + Oren-Nayar limb
      const limb = 0.76 + 0.24 * Math.pow(nz, 0.36);
      const softMare = mareAmt * 0.72;
      const baseAlb = (0.88 + (grain - 0.5) * 0.13) * (1.0 - softMare) + (0.48 + (reg2 - 0.5) * 0.07) * softMare;
      const lum = Math.max(0.24, Math.min(1.0, (baseAlb + craterShade * 0.82 + rayBright * 0.78) * limb));

      // Cool silver-blue tint in maria, luminous ivory-silver in highlands
      const rCol = lum * (1.0 - softMare * 0.14);
      const gCol = lum * (1.0 - softMare * 0.05);
      const bCol = Math.min(1.0, lum * (1.02 + softMare * 0.10));

      data[idx] = Math.round(rCol * 255);
      data[idx + 1] = Math.round(gCol * 255);
      data[idx + 2] = Math.round(bCol * 255);
      data[idx + 3] = Math.round(alpha * 255);
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createSoftWispTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);
  const puffs = [
    [76, 64, 34, 0.44],
    [118, 58, 40, 0.58],
    [158, 64, 36, 0.48],
    [186, 68, 24, 0.30],
    [56, 68, 22, 0.28],
    [128, 70, 34, 0.40],
  ];
  for (let i = 0; i < puffs.length; i++) {
    const [x, y, r, a] = puffs[i];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(214, 232, 255, ${a})`);
    g.addColorStop(0.45, `rgba(168, 198, 232, ${a * 0.48})`);
    g.addColorStop(0.8, `rgba(120, 156, 196, ${a * 0.12})`);
    g.addColorStop(1, 'rgba(120, 156, 196, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }
  const img = ctx.getImageData(0, 0, 256, 128);
  const d = img.data;
  for (let y = 0; y < 128; y++) {
    const ny = (y - 64) / 56;
    for (let x = 0; x < 256; x++) {
      const nx = (x - 128) / 118;
      const rr = Math.hypot(nx, ny);
      const env = rr >= 1 ? 0 : Math.pow(1 - rr * rr, 1.6);
      d[(y * 256 + x) * 4 + 3] = Math.round(d[(y * 256 + x) * 4 + 3] * env);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRadialGlowTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const half = size * 0.5;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(235,250,255,0.88)');
  g.addColorStop(0.5, 'rgba(170,225,255,0.28)');
  g.addColorStop(1, 'rgba(170,225,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// PROCEDURAL 3D ARCHIPELAGO HORIZON GEOMETRY BUILDER (MERGED 1-CALL VISTAS)
// ============================================================================

class HorizonGeometryBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.attr = []; // vec4: [depthLayer (0=near,1=far), heightRatio (0..1), emissiveKind (0=none,1=beaconA,2=beaconB,3=lava/crystal), snowMask]
    this.idx = [];
  }

  _pushTransformed(geo, mat4, layer, maxH, emissiveKind = 0, snowMask = 0) {
    const gPos = geo.attributes.position;
    const gNorm = geo.attributes.normal;
    const gIdx = geo.index;
    const baseVertex = this.pos.length / 3;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const normalMat = new THREE.Matrix3().getNormalMatrix(mat4);

    for (let i = 0; i < gPos.count; i++) {
      v.fromBufferAttribute(gPos, i).applyMatrix4(mat4);
      n.fromBufferAttribute(gNorm, i).applyMatrix3(normalMat).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.norm.push(n.x, n.y, n.z);
      const hr = Math.max(0, Math.min(1, (v.y + 1.5) / Math.max(2.0, maxH)));
      this.attr.push(layer, hr, emissiveKind, snowMask);
    }

    if (gIdx) {
      for (let i = 0; i < gIdx.count; i++) {
        this.idx.push(baseVertex + gIdx.getX(i));
      }
    } else {
      for (let i = 0; i < gPos.count; i++) {
        this.idx.push(baseVertex + i);
      }
    }
    geo.dispose();
  }

  // Sculpted craggy multi-spire sea-stack / jagged cliff / glacier peak / crystal obelisk
  addCraggyPeak(ang, radius, width, height, segsRad, segsH, cragAmt, seedVal, layer, snowMask = 0, sharpCrystal = false, spireCount = 3) {
    const buildSpire = (offAng, radOff, wScale, hScale, sOff) => {
      const w = width * wScale;
      const h = height * hScale;
      const geo = new THREE.CylinderGeometry(w * (sharpCrystal ? 0.06 : 0.11), w * 1.12, h, segsRad, segsH, true);
      geo.translate(0, h * 0.5 - 1.4, 0);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let vx = p.getX(i);
        let vy = p.getY(i);
        let vz = p.getZ(i);
        const hFrac = Math.max(0, (vy + 1.4) / h);
        const theta = Math.atan2(vz, vx);
        const u = (theta + Math.PI) / TWO_PI;
        const n1 = fastPeriodicNoise(u, hFrac * 0.8, 8, 8, PERM_A, (seedVal + sOff) & 255);
        const n2 = fastPeriodicNoise(u, hFrac * 1.6, 16, 16, PERM_B, (seedVal * 3 + sOff) & 255);
        const ridge = 1.0 - Math.abs(2.0 * n1 - 1.0);
        const stepTerrace = Math.sin(hFrac * (sharpCrystal ? 11.0 : 14.0)) * (sharpCrystal ? 0.09 : 0.06);
        const disp = sharpCrystal
          ? 0.56 + (Math.pow(ridge, 1.3) * 0.78 + n2 * 0.34 + stepTerrace) * (cragAmt * 1.15)
          : 0.58 + (Math.pow(ridge, 1.35) * 0.72 + n2 * 0.28 + stepTerrace) * cragAmt * (1.2 - hFrac * 0.4);
        // Asymmetric sheer sea-cliff lean + organic crag shoulders (never smooth straight cones!)
        vx = vx * disp + hFrac * w * (((seedVal + sOff) % 5) - 2) * 0.16 + Math.sin(hFrac * 7.5 + sOff) * w * 0.10;
        vz *= disp * (0.68 + ((seedVal + sOff) % 4) * 0.11);
        if (hFrac > 0.68) {
          vy += (ridge - 0.48) * h * 0.26 * ((Math.round(u * 5) % 2 === 0) ? 1.0 : -0.35);
        }
        p.setXYZ(i, vx, vy, vz);
      }
      geo.computeVertexNormals();

      const a = ang + offAng;
      const r = radius + radOff;
      const m = new THREE.Matrix4();
      const rotY = new THREE.Matrix4().makeRotationY(a + ((seedVal + sOff) % 7) * 0.4);
      if (sharpCrystal) {
        rotY.multiply(new THREE.Matrix4().makeRotationZ((((seedVal + sOff) % 5) - 2) * 0.12));
      }
      m.makeTranslation(Math.sin(a) * r, 0, Math.cos(a) * r).multiply(rotY);
      this._pushTransformed(geo, m, layer, h, 0, snowMask);
    };

    // Main crag + asymmetric flanking sub-peaks for organic jagged island silhouettes (never single cones!)
    buildSpire(0, 0, 1.0, 1.0, 0);
    buildSpire(0.032, 1.8, 0.72, 0.66, 37);
    if (spireCount >= 3) {
      buildSpire(-0.028, -1.2, 0.62, 0.52, 83);
    }
  }

  // Sculpted 3D Natural Stone Sea-Arch bridging out of the waves
  addSeaArch(ang, radius, spanW, archH, seedVal, layer, snowMask = 0) {
    const torus = new THREE.TorusGeometry(spanW * 0.5, spanW * 0.17, 5, 10, Math.PI);
    const p = torus.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let vx = p.getX(i);
      let vy = p.getY(i) * (archH / (spanW * 0.5));
      let vz = p.getZ(i) * 1.35;
      const n = fastPeriodicNoise((vx + spanW) / (spanW * 2), (vy + 2) / 12, 8, 8, PERM_A, seedVal & 255);
      vx += (n - 0.5) * spanW * 0.14;
      vy += (n - 0.45) * archH * 0.16 - 0.8;
      p.setXYZ(i, vx, vy, vz);
    }
    torus.computeVertexNormals();

    const m = new THREE.Matrix4();
    // Orient arch broadside tangential/angled so its opening is clearly visible!
    m.makeTranslation(Math.sin(ang) * radius, 0, Math.cos(ang) * radius);
    m.multiply(new THREE.Matrix4().makeRotationY(ang + 0.42));
    this._pushTransformed(torus, m, layer, archH, 0, snowMask);
  }

  // Distant Silhouetted Sister Watchtower / Smelter Monolith + Crown Beacon Pinpoint
  addSisterWatchtower(ang, radius, baseR, towerH, beaconKind, layer) {
    // Rocky island plinth
    this.addCraggyPeak(ang, radius, baseR * 2.5, towerH * 0.24, 6, 2, 0.55, Math.round(ang * 97), layer, 0, false, 2);

    const m = new THREE.Matrix4().makeTranslation(Math.sin(ang) * radius, 0, Math.cos(ang) * radius);

    // Tapered cylindrical masonry shaft
    const shaft = new THREE.CylinderGeometry(baseR * 0.78, baseR, towerH, 8, 1, true);
    shaft.translate(0, towerH * 0.5 - 0.5, 0);
    this._pushTransformed(shaft, m, layer, towerH + 2.0, 0, 0);

    // Stepped crown cornice / lantern gallery
    const crown = new THREE.CylinderGeometry(baseR * 0.96, baseR * 0.82, towerH * 0.08, 8, 1, false);
    crown.translate(0, towerH - 0.35, 0);
    this._pushTransformed(crown, m, layer, towerH + 2.0, 0, 0);

    // Tiny glowing beacon lantern orb at crown summit
    const beacon = new THREE.OctahedronGeometry(baseR * 0.30, 0);
    beacon.translate(0, towerH + 0.35, 0);
    this._pushTransformed(beacon, m, layer, towerH + 2.0, beaconKind, 0);
  }

  // Glowing Lava / Arcane Fissure Vein on Volcanic or Crystal Spires
  addGlowingVent(ang, radius, yHeight, scaleW, scaleH, layer) {
    const vent = new THREE.OctahedronGeometry(1, 0);
    vent.scale(scaleW, scaleH, scaleW * 0.6);
    vent.translate(0, yHeight, 0);
    const m = new THREE.Matrix4()
      .makeTranslation(Math.sin(ang) * radius, 0, Math.cos(ang) * radius)
      .multiply(new THREE.Matrix4().makeRotationY(ang));
    this._pushTransformed(vent, m, layer, yHeight + 4.0, 3, 0);
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    geo.setAttribute('aVista', new THREE.Float32BufferAttribute(this.attr, 4));
    geo.setIndex(this.idx);
    return geo;
  }
}

function buildVistaGeometry(kind) {
  const b = new HorizonGeometryBuilder();

  // Key azimuths around -Z (angle = PI in sin(a),cos(a)):
  // At camCol = 0, camera looks toward -Z (`ang = PI`).
  // Left flank corridor on 430x932 portrait & 16:9 is `ang = PI + 0.16 .. PI + 0.52`,
  // Right flank corridor is `ang = PI - 0.16 .. PI - 0.52`, plus full 360-deg coverage!
  if (kind === 'coastal') {
    // Distant craggy sea-stacks, broken stone sea-arches & silhouetted Sister Watchtowers (r = 68..88m)
    b.addSeaArch(Math.PI + 0.21, 70, 7.2, 5.4, 17, 0.25, 0);
    b.addCraggyPeak(Math.PI + 0.255, 83, 5.6, 8.8, 7, 3, 0.80, 23, 0.72, 0, false, 3);
    b.addSisterWatchtower(Math.PI - 0.20, 76, 1.15, 11.2, 1, 0.45);
    b.addCraggyPeak(Math.PI - 0.255, 84, 5.4, 8.6, 7, 3, 0.78, 29, 0.75, 0, false, 3);
    b.addCraggyPeak(Math.PI + 0.34, 78, 5.2, 8.2, 7, 3, 0.78, 31, 0.5, 0, false, 3);
    b.addCraggyPeak(Math.PI - 0.32, 68, 4.2, 6.4, 7, 3, 0.82, 47, 0.2, 0, false, 3);
    b.addSisterWatchtower(Math.PI + 0.45, 84, 1.25, 12.6, 2, 0.75);
    b.addSeaArch(Math.PI - 0.43, 80, 8.2, 6.0, 63, 0.6, 0);

    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * TWO_PI + 0.09;
      if (Math.abs(ang - Math.PI) < 0.50) continue;
      const isFar = i % 2 === 1;
      const rad = isFar ? 82 + (i % 3) * 4 : 68 + (i % 4) * 3;
      const h = isFar ? 7.2 + (i % 4) * 2.2 : 4.8 + (i % 3) * 2.0;
      b.addCraggyPeak(ang, rad, 3.8 + (i % 3) * 1.4, h, 6, 3, 0.76, i * 19 + 7, isFar ? 0.8 : 0.3, 0, false, 2);
      if (i % 6 === 2) {
        b.addSisterWatchtower(ang + 0.11, 78, 1.18, 11.2 + (i % 3) * 1.6, (i % 2) + 1, 0.55);
      } else if (i % 7 === 5) {
        b.addSeaArch(ang + 0.08, 72, 7.2, 5.4, i * 29, 0.35, 0);
      }
    }
  } else if (kind === 'volcanic') {
    b.addCraggyPeak(Math.PI + 0.23, 72, 6.4, 10.2, 7, 3, 0.68, 13, 0.3, 0, false, 3);
    b.addGlowingVent(Math.PI + 0.23, 70.2, 7.8, 0.95, 0.48, 0.3);
    b.addSisterWatchtower(Math.PI - 0.20, 72, 1.32, 12.4, 1, 0.35);
    b.addSisterWatchtower(Math.PI - 0.34, 84, 1.15, 10.6, 2, 0.7);
    b.addCraggyPeak(Math.PI - 0.28, 78, 5.8, 8.2, 7, 3, 0.72, 41, 0.55, 0, false, 3);
    b.addSisterWatchtower(Math.PI + 0.42, 82, 1.3, 13.0, 1, 0.65);

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TWO_PI + 0.12;
      if (Math.abs(ang - Math.PI) < 0.46) continue;
      const isFar = i % 2 === 0;
      const rad = isFar ? 83 + (i % 3) * 4 : 69 + (i % 3) * 3;
      const h = 6.5 + (i % 4) * 2.6;
      b.addCraggyPeak(ang, rad, 4.8 + (i % 3) * 1.5, h, 6, 3, 0.68, i * 23 + 5, isFar ? 0.8 : 0.3, 0, false, 2);
      if (i % 5 === 0) {
        b.addGlowingVent(ang, rad - 1.5, h * 0.70, 0.85, 0.42, isFar ? 0.8 : 0.3);
      }
      if (i % 6 === 3) {
        b.addSisterWatchtower(ang + 0.1, 76, 1.25, 12.0, (i % 2) + 1, 0.5);
      }
    }
  } else if (kind === 'glacial') {
    b.addCraggyPeak(Math.PI + 0.21, 68, 4.8, 11.0, 7, 3, 0.85, 11, 0.25, 1.0, false, 3);
    b.addSeaArch(Math.PI - 0.21, 68, 7.2, 5.8, 29, 0.2, 1.0);
    b.addCraggyPeak(Math.PI - 0.32, 80, 5.8, 12.8, 7, 3, 0.82, 53, 0.65, 1.0, false, 3);
    b.addSisterWatchtower(Math.PI + 0.35, 80, 1.18, 11.6, 1, 0.6);
    b.addCraggyPeak(Math.PI + 0.45, 74, 4.8, 8.8, 7, 3, 0.82, 71, 0.4, 1.0, false, 3);

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TWO_PI + 0.07;
      if (Math.abs(ang - Math.PI) < 0.48) continue;
      const isFar = i % 2 === 1;
      const rad = isFar ? 82 + (i % 3) * 4 : 67 + (i % 4) * 3;
      const h = isFar ? 8.8 + (i % 4) * 2.6 : 5.8 + (i % 3) * 2.2;
      b.addCraggyPeak(ang, rad, 4.2 + (i % 3) * 1.3, h, 6, 3, 0.82, i * 17 + 3, isFar ? 0.8 : 0.25, 1.0, false, 2);
    }
  } else if (kind === 'alien_orig') {
    // Original '87 HD Horizon: Chiseled alien mountain peaks & crystal spires framed inside BOTH
    // the narrow 18-deg telephoto portrait sky corridors (ang = PI +- 0.095..0.16) AND full 360-deg!
    b.addCraggyPeak(Math.PI + 0.096, 68, 1.55, 7.4, 6, 3, 0.56, 17, 0.20, 0, true, 3);
    b.addCraggyPeak(Math.PI + 0.124, 80, 2.20, 10.6, 6, 3, 0.62, 43, 0.68, 0, true, 3);
    b.addSisterWatchtower(Math.PI - 0.104, 78, 0.68, 8.8, 2, 0.55);
    b.addCraggyPeak(Math.PI - 0.094, 67, 1.45, 6.2, 6, 3, 0.58, 29, 0.18, 0, true, 3);
    b.addCraggyPeak(Math.PI - 0.128, 82, 2.35, 9.8, 6, 3, 0.60, 71, 0.74, 0, true, 3);

    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * TWO_PI + 0.15;
      if (Math.abs(ang - Math.PI) < 0.155) continue;
      const isFar = i % 2 === 1;
      const rad = isFar ? 80 + (i % 3) * 4 : 68 + (i % 3) * 3;
      const h = isFar ? 8.0 + (i % 4) * 2.4 : 5.4 + (i % 3) * 2.0;
      b.addCraggyPeak(ang, rad, 2.2 + (i % 3) * 0.9, h, 6, 3, 0.58, i * 23 + 11, isFar ? 0.75 : 0.25, 0, true, 2);
      if (i % 5 === 2) {
        b.addSisterWatchtower(ang + 0.07, 76, 0.95, 9.6, (i % 2) + 1, 0.50);
      }
    }
  } else {
    b.addCraggyPeak(Math.PI + 0.20, 69, 2.5, 12.2, 6, 3, 0.58, 19, 0.25, 0, true, 3);
    b.addGlowingVent(Math.PI + 0.20, 67.6, 6.2, 0.42, 2.0, 0.25);
    b.addSisterWatchtower(Math.PI - 0.20, 74, 1.18, 12.6, 1, 0.35);
    b.addCraggyPeak(Math.PI - 0.31, 68, 2.3, 10.4, 6, 3, 0.62, 37, 0.25, 0, true, 3);
    b.addCraggyPeak(Math.PI + 0.35, 82, 4.0, 13.5, 6, 3, 0.62, 61, 0.7, 0, true, 3);

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TWO_PI + 0.11;
      if (Math.abs(ang - Math.PI) < 0.42) continue;
      const isFar = i % 2 === 0;
      const rad = isFar ? 82 + (i % 3) * 4 : 68 + (i % 3) * 3;
      const h = 7.4 + (i % 4) * 2.8;
      b.addCraggyPeak(ang, rad, 2.6 + (i % 3) * 1.0, h, 6, 3, 0.58, i * 31 + 9, isFar ? 0.75 : 0.3, 0, true, 2);
      if (i % 3 === 0) {
        b.addSisterWatchtower(ang + 0.12, 78, 1.18, 12.4, (i % 2) + 1, 0.55);
      }
    }
  }

  return b.build();
}

function createArchipelagoVistaMaterial(cloudPanoTex) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uTime: { value: 0 },
      uWaterY: { value: -0.55 },
      uOrig: { value: 0 },
      uNearColor: { value: new THREE.Color('#060e1b') },
      uFarColor: { value: new THREE.Color('#12263d') },
      uMistColor: { value: new THREE.Color('#1f3b58') },
      uRimColor: { value: new THREE.Color('#dceeff') },
      uBeaconA: { value: new THREE.Color('#ffaa33') },
      uBeaconB: { value: new THREE.Color('#00f5c8') },
      uVentColor: { value: new THREE.Color('#ff5500') },
      uMoonDir: { value: new THREE.Vector3(0.42, 0.26, -0.87).normalize() },
      uBlackout: { value: 0.0 },
      uLightning: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aVista; // x: layer, y: heightRatio, z: emissiveKind, w: snowMask
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec4 vVista;
      void main() {
        vVista = aVista;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform float uTime;
      uniform float uWaterY;
      uniform float uOrig;
      uniform vec3 uNearColor;
      uniform vec3 uFarColor;
      uniform vec3 uMistColor;
      uniform vec3 uRimColor;
      uniform vec3 uBeaconA;
      uniform vec3 uBeaconB;
      uniform vec3 uVentColor;
      uniform vec3 uMoonDir;
      uniform float uBlackout;
      uniform float uLightning;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec4 vVista;

      void main() {
        float layer = vVista.x;
        float hRatio = vVista.y;
        float emKind = vVista.z;
        float snowMask = vVista.w;

        if (emKind > 0.5) {
          float pulse = 0.68 + 0.32 * sin(uTime * 3.1 + vWorldPos.x * 0.4 + vWorldPos.z * 0.4);
          vec3 emCol = emKind < 1.5 ? uBeaconA : (emKind < 2.5 ? uBeaconB : uVentColor);
          vec3 finalEm = emCol * (emKind > 2.5 ? 1.25 : 1.75) * pulse;
          gl_FragColor = vec4(finalEm, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        if (uOrig > 0.5) {
          float cliffAzO = atan(vWorldPos.x, vWorldPos.z) * 0.159154943;
          vec4 oDet = texture2D(uPanoTex, vec2(cliffAzO * 14.0, clamp((vWorldPos.y - uWaterY) * 0.08, 0.02, 0.98)));
          vec3 origBase = mix(vec3(0.006, 0.014, 0.044), vec3(0.018, 0.040, 0.105), layer) * (0.78 + 0.44 * oDet.r);
          vec3 viewDirO = normalize(cameraPosition - vWorldPos);
          float fresO = pow(1.0 - max(0.0, dot(vNormalW, viewDirO)), 2.2);
          float origRim = (pow(max(0.0, vNormalW.y * 0.65 + 0.35), 2.0) * 0.65 + fresO * 0.75) * smoothstep(0.08, 0.78, hRatio);
          vec3 origCol = origBase + (uBeaconB * 0.38 + vec3(0.08, 0.16, 0.42)) * origRim * (0.68 - layer * 0.22);
          float hSeaO = max(0.0, vWorldPos.y - uWaterY);
          origCol = mix(origCol, vec3(0.032, 0.048, 0.125), exp(-hSeaO * 0.38) * 0.52);
          gl_FragColor = vec4(origCol, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        float darkScale = mix(1.0, 0.26, clamp(uBlackout, 0.0, 1.0));
        // Procedural basalt cliff striations & craggy micro-relief sampled from 1024x512 uPanoTex
        float cliffAz = atan(vWorldPos.x, vWorldPos.z) * 0.159154943;
        vec4 rockDetail = texture2D(uPanoTex, vec2(cliffAz * 12.0, clamp((vWorldPos.y - uWaterY) * 0.06, 0.02, 0.98)));
        vec3 n = normalize(vNormalW + vec3((rockDetail.g - 0.5) * 0.65, (rockDetail.b - 0.5) * 0.45, (rockDetail.r - 0.5) * 0.65));
        vec3 mDir = normalize(uMoonDir);

        // Moody dark basalt silhouette (never pale grey clay!)
        vec3 baseRock = mix(uNearColor * 0.75, uFarColor * 0.68, layer) * (0.72 + 0.52 * rockDetail.r) * darkScale;

        // Chiseled silver-blue moonlight grazing cliff arrises
        float ndl = max(0.0, dot(n, mDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnelRim = pow(1.0 - max(0.0, dot(n, viewDir)), 3.0);
        float moonRim = (pow(ndl, 1.8) * 0.65 + fresnelRim * 0.45) * smoothstep(0.12, 0.72, hRatio);
        vec3 col = baseRock + uRimColor * moonRim * (0.11 * (1.0 - layer * 0.45));

        if (snowMask > 0.1) {
          float snowSlope = smoothstep(0.28, 0.72, n.y + hRatio * 0.38);
          vec3 snowTint = mix(uMistColor, uRimColor, 0.55) * 0.42 * darkScale;
          col = mix(col, snowTint, snowSlope * snowMask * 0.76);
        }

        if (uLightning > 0.005) {
          col += vec3(0.16, 0.26, 0.44) * uLightning * (0.25 + 0.75 * max(0.0, n.y));
        }

        // Dark moody atmospheric sea-mist wrapping island bases (matches dark ocean, zero grey floor!)
        float hAboveSea = max(0.0, vWorldPos.y - uWaterY);
        float seaFog = exp(-hAboveSea * 0.34) * 0.68 + layer * 0.28;
        col = mix(col, uMistColor * darkScale * 0.44, clamp(seaFog, 0.0, 0.85));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// Rolling 360-deg Horizon Sea-Fog Ring (zero-alpha at uWaterY -> ZERO Z-cut seam against Ocean!)
function createHorizonMistRingMaterial(cloudPanoTex) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uTime: { value: 0 },
      uWaterY: { value: -0.55 },
      uMistColor: { value: new THREE.Color('#1f3b58') },
      uRimColor: { value: new THREE.Color('#dceeff') },
      uMoonDir: { value: new THREE.Vector3(0.42, 0.26, -0.87).normalize() },
      uOpacity: { value: 0.34 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform float uTime;
      uniform float uWaterY;
      uniform vec3 uMistColor;
      uniform vec3 uRimColor;
      uniform vec3 uMoonDir;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        float hAboveWater = vWorldPos.y - uWaterY;
        if (hAboveWater <= 0.02) discard;

        // Strictly 0.0 at waterline (zero intersection line with sea!) -> soft swell -> 0.0 at top!
        float vertEnv = smoothstep(0.02, 2.4, hAboveWater) * smoothstep(1.0, 0.42, vUv.y);
        if (vertEnv <= 0.004) discard;

        vec4 n1 = texture2D(uPanoTex, vec2(vUv.x * 3.0 + uTime * 0.005, 0.18 + vUv.y * 0.22));
        vec4 n2 = texture2D(uPanoTex, vec2(vUv.x * 5.0 - uTime * 0.008, 0.42 + vUv.y * 0.18));
        float billow = 0.35 + 0.65 * (n1.r * 0.6 + n2.b * 0.4);

        vec3 rayDir = normalize(vWorldPos - cameraPosition);
        float moonGlow = pow(max(0.0, dot(rayDir, normalize(uMoonDir))), 7.0);
        vec3 col = mix(uMistColor * 0.38, uRimColor * 0.28, moonGlow * 0.55 + n1.g * 0.14);
        float alpha = clamp(vertEnv * billow * uOpacity, 0.0, 0.52);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// 3D Shimmering Multi-Curtain Boreal Aurora Ribbons ('blizzard' / 'apex' / 'prism')
function buildAuroraRibbonsGeometry() {
  const curtains = [
    { r: 68, y0: 15, h: 20, span: 1.45, angCenter: Math.PI + 0.32, waveAmp: 4.5, layer: 0.0 },
    { r: 78, y0: 19, h: 22, span: 1.65, angCenter: Math.PI - 0.18, waveAmp: 5.5, layer: 0.5 },
    { r: 84, y0: 23, h: 18, span: 1.90, angCenter: Math.PI + 0.05, waveAmp: 6.2, layer: 1.0 },
  ];
  const segX = 32;
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let c = 0; c < curtains.length; c++) {
    const { r, y0, h, span, angCenter, waveAmp, layer } = curtains[c];
    const baseV = pos.length / 3;
    for (let ix = 0; ix <= segX; ix++) {
      const u = ix / segX;
      const ang = angCenter + (u - 0.5) * span;
      const fold = Math.sin(u * Math.PI * 5.0 + c * 2.1) * waveAmp + Math.cos(u * Math.PI * 9.0) * (waveAmp * 0.4);
      const rad = r + fold;
      const x = Math.sin(ang) * rad;
      const z = Math.cos(ang) * rad;
      pos.push(x, y0, z, x * 1.04, y0 + h, z * 1.04);
      uvs.push(u, 0, layer, u, 1, layer);
    }
    for (let ix = 0; ix < segX; ix++) {
      const a = baseV + ix * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aAuroraUv', new THREE.Float32BufferAttribute(uvs, 3));
  geo.setIndex(idx);
  return geo;
}

function createAuroraRibbonMaterial(cloudPanoTex) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uTime: { value: 0 },
      uStrength: { value: 0.0 },
      uColorLow: { value: new THREE.Color('#00f5a0') },
      uColorHigh: { value: new THREE.Color('#9333ea') },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aAuroraUv;
      uniform float uTime;
      varying vec3 vAuv;
      void main() {
        vAuv = aAuroraUv;
        vec3 p = position;
        float sway = sin(uTime * 0.55 + aAuroraUv.x * 12.0 + aAuroraUv.z * 4.0) * (1.2 + aAuroraUv.y * 2.4);
        p.x += sway;
        p.z += cos(uTime * 0.42 + aAuroraUv.x * 9.0) * 1.1;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uColorLow;
      uniform vec3 uColorHigh;
      varying vec3 vAuv;
      void main() {
        float u = vAuv.x;
        float v = vAuv.y;
        float horizFade = smoothstep(0.0, 0.18, u) * smoothstep(1.0, 0.82, u);
        float vertCurtain = smoothstep(0.0, 0.16, v) * exp(-max(0.0, v - 0.14) * 3.4);
        vec4 streak = texture2D(uPanoTex, vec2(u * 4.0 + uTime * 0.015 + vAuv.z * 0.31, 0.35 + v * 0.15));
        float rays = 0.35 + 0.65 * pow(streak.g, 1.6) * (0.65 + 0.35 * sin(u * 95.0 + uTime * 1.8));
        vec3 col = mix(uColorLow, uColorHigh, smoothstep(0.12, 0.78, v));
        float alpha = clamp(horizFade * vertCurtain * rays * uStrength * 0.68, 0.0, 0.85);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ============================================================================
// HIGH-RES CUMULONIMBUS STORM SKY DOME & PHOTOGRAPHIC CRATERED MOON SHADER
// ============================================================================

function createStormSkyMaterial(cloudPanoTex, moonTex) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uMoonTex: { value: moonTex },
      uTime: { value: 0 },
      uYaw: { value: 0 },
      uOrig: { value: 0 },
      uZenithColor: { value: new THREE.Color('#030712') },
      uMidSkyColor: { value: new THREE.Color('#0b182c') },
      uHorizonColor: { value: new THREE.Color('#162b44') },
      uHorizonMistColor: { value: new THREE.Color('#1f3b58') },
      uCloudDark: { value: new THREE.Color('#050b16') },
      uCloudMid: { value: new THREE.Color('#12243b') },
      uCloudRim: { value: new THREE.Color('#dceeff') },
      uMoonTint: { value: new THREE.Color('#eef6ff') },
      uCoronaColor: { value: new THREE.Color('#8cc4ff') },
      uBeaconColor: { value: new THREE.Color('#38bdf8') },
      uMoonDir: { value: new THREE.Vector3(0.42, 0.26, -0.87).normalize() },
      uBoltDir: { value: new THREE.Vector3(-0.35, 0.32, -0.88).normalize() },
      uMoonRadius: { value: 0.032 },
      uMoonAmt: { value: 1.0 },
      uCloudCover: { value: 0.82 },
      uAuroraAmt: { value: 0.0 },
      uNebulaAmt: { value: 0.0 },
      uSmogAmt: { value: 0.0 },
      uMaelstromAmt: { value: 0.0 },
      uVirgaAmt: { value: 0.35 },
      uAbyssMistAmt: { value: 0.28 },
      uBlackout: { value: 0.0 },
      uLightning: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec3 worldPos = cameraPosition + vDir * 135.0;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform sampler2D uMoonTex;
      uniform float uTime;
      uniform float uYaw;
      uniform float uOrig;
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uHorizonMistColor;
      uniform vec3 uCloudDark;
      uniform vec3 uCloudMid;
      uniform vec3 uCloudRim;
      uniform vec3 uMoonTint;
      uniform vec3 uCoronaColor;
      uniform vec3 uBeaconColor;
      uniform vec3 uMoonDir;
      uniform vec3 uBoltDir;
      uniform float uMoonRadius;
      uniform float uMoonAmt;
      uniform float uCloudCover;
      uniform float uAuroraAmt;
      uniform float uNebulaAmt;
      uniform float uSmogAmt;
      uniform float uMaelstromAmt;
      uniform float uVirgaAmt;
      uniform float uAbyssMistAmt;
      uniform float uBlackout;
      uniform float uLightning;

      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        // Seamless normalized azimuth [0..1)
        float uAz = (atan(d.x, d.z) + uYaw) * 0.159154943;

        if (uOrig > 0.5) {
          // ====================================================================
          // ORIGINAL '87 ERA: Crisp 1024x512 Starfield + Colorful Space Nebula
          // ====================================================================
          float hb = clamp(h, 0.0, 1.0);
          vec3 col = mix(vec3(0.014, 0.032, 0.098), vec3(0.002, 0.005, 0.022), smoothstep(0.0, 0.62, hb));

          // Colorful cosmic space nebula across the starry sky (sampled from 1024x512 uPanoTex)
          if (h > -0.02) {
            vec4 neb1 = texture2D(uPanoTex, vec2(uAz * 3.0 + 0.18, clamp(h * 1.45 + 0.10, 0.02, 0.98)));
            vec4 neb2 = texture2D(uPanoTex, vec2(uAz * 5.0 - 0.31 + uTime * 0.0015, clamp(h * 2.15 + 0.14, 0.02, 0.98)));
            float nebMask = smoothstep(0.28, 0.78, neb1.a * 0.58 + neb2.b * 0.42) * smoothstep(-0.01, 0.14, h) * (1.0 - smoothstep(0.58, 0.94, h));
            vec3 nebCol = mix(vec3(0.32, 0.04, 0.48), vec3(0.03, 0.28, 0.52), neb2.r);
            nebCol = mix(nebCol, vec3(0.46, 0.10, 0.26), smoothstep(0.48, 0.85, neb1.g));
            col += nebCol * nebMask * 0.88;
          }

          // Vibrant royal twilight horizon glow (subtle, letting crisp alien silhouettes stand out!)
          float duskBand = exp(-max(0.0, h + 0.01) * 16.5) * step(-0.05, h);
          col += mix(vec3(0.14, 0.04, 0.18), uBeaconColor * 0.24 + vec3(0.03, 0.08, 0.22), smoothstep(0.0, 0.12, hb)) * duskBand * 0.62;

          // Multi-layer crisp HD diamond starfield (sharp under both 18-deg telephoto & 48-deg wide!)
          if (h > 0.0) {
            for (int layer = 0; layer < 2; layer++) {
              float freq = layer == 0 ? 320.0 : 500.0;
              vec2 sg = vec2(uAz * freq, h * (freq * 0.5));
              vec2 si = floor(sg);
              vec2 sf = fract(sg) - 0.5;
              float rnd = hash21(si + float(layer) * 37.0);
              float cutoff = layer == 0 ? 0.78 : 0.86;
              if (rnd > cutoff) {
                vec2 jitter = vec2(hash21(si + 13.1), hash21(si + 29.7)) - 0.5;
                float dist = length(sf - jitter * 0.56);
                float tw = 0.68 + 0.32 * sin(uTime * (2.0 + rnd * 4.2) + rnd * 43.0);
                float sharpness = layer == 0 ? 380.0 : 540.0;
                float star = exp(-dist * dist * sharpness) * tw * smoothstep(0.0, 0.07, h);
                vec3 sCol = mix(vec3(0.95, 0.98, 1.0), vec3(0.45, 0.88, 1.0), step(0.89, rnd));
                sCol = mix(sCol, vec3(1.0, 0.84, 0.42), step(0.95, rnd));
                sCol = mix(sCol, vec3(0.98, 0.58, 0.92), step(0.982, rnd));
                col += sCol * star * (layer == 0 ? 1.55 : 0.95);
              }
            }
          }

          if (h < 0.0) {
            col = mix(col, vec3(0.004, 0.009, 0.028), smoothstep(0.0, -0.18, h));
          }

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        // ======================================================================
        // REBOOT ERA: 1024x512 Cumulonimbus Storm Sky & 512x512 Cratered Moon
        // ======================================================================
        float darkScale = mix(1.0, 0.25, clamp(uBlackout, 0.0, 1.0));

        // 1. Deep midnight-indigo zenith -> storm-slate horizon (extending cleanly below h=0 so zero black horizon band!)
        float tMid = smoothstep(-0.04, 0.30, h);
        float tTop = smoothstep(0.18, 0.78, h);
        vec3 col = mix(uHorizonColor, uMidSkyColor, tMid);
        col = mix(col, uZenithColor, tTop);
        col *= darkScale;

        // Soft rolling sea-haze cushion at waterline [-0.07..+0.05] (leaves sky above watchtowers rich with clouds!)
        float shHaze = (h + 0.008) * 18.0;
        float seaHaze = exp(-shHaze * shHaze);
        col = mix(col, uHorizonMistColor * darkScale * 0.82, seaHaze * 0.44);

        if (uAbyssMistAmt > 0.01) {
          float abMist = exp(-max(0.0, h + 0.03) * 9.5) * step(-0.10, h);
          col += vec3(0.008, 0.075, 0.072) * abMist * uAbyssMistAmt * darkScale;
        }
        if (uSmogAmt > 0.01) {
          float smogGlow = exp(-max(0.0, h + 0.02) * 8.0) * step(-0.10, h);
          col += vec3(0.18, 0.042, 0.008) * smogGlow * uSmogAmt;
        }

        // 2. Pinprick stars peeking ONLY through high clear-sky gaps
        vec3 starContrib = vec3(0.0);
        if (h > 0.08) {
          vec2 sg = vec2(uAz * 220.0, h * 110.0);
          vec2 si = floor(sg);
          vec2 sf = fract(sg) - 0.5;
          float sr = hash21(si + 5.3);
          if (sr > 0.87) {
            vec2 sj = vec2(hash21(si + 19.1), hash21(si + 41.7)) - 0.5;
            float sd = length(sf - sj * 0.52);
            float stw = 0.65 + 0.35 * sin(uTime * (1.7 + sr * 3.0) + sr * 31.0);
            float sMask = exp(-sd * sd * 135.0) * stw * smoothstep(0.08, 0.26, h);
            starContrib = vec3(0.62, 0.78, 0.98) * sMask * 0.55 * darkScale;
          }
        }

        // 3. Twilight Crystal Nebula ('prism') & Colossal Maelstrom Vortex ('apex')
        if (uNebulaAmt > 0.01 && h > 0.01) {
          vec4 nebA = texture2D(uPanoTex, vec2(uAz * 2.0 + 0.12, clamp(h * 1.25 + 0.06, 0.02, 0.98)));
          vec4 nebB = texture2D(uPanoTex, vec2(uAz * 4.0 - uTime * 0.003, clamp(h * 1.85 + 0.08, 0.02, 0.98)));
          float rift = smoothstep(0.34, 0.82, nebA.a * 0.65 + nebB.b * 0.35) * smoothstep(0.01, 0.18, h) * (1.0 - smoothstep(0.55, 0.88, h));
          vec3 nebCol = mix(vec3(0.24, 0.04, 0.40), vec3(0.04, 0.20, 0.38), nebB.r);
          col += nebCol * rift * uNebulaAmt * 0.62;
        }
        if (uMaelstromAmt > 0.01 && h > 0.04) {
          // Colossal spiraling abyssal cloud-vortex overhead in T8 Apex!
          float twist = uAz * 3.0 + h * 1.8 - uTime * 0.022;
          vec4 vor = texture2D(uPanoTex, vec2(twist, clamp(h * 1.3 + 0.1, 0.02, 0.98)));
          float vBand = smoothstep(0.08, 0.35, h) * smoothstep(0.92, 0.45, h);
          col += mix(vec3(0.18, 0.05, 0.26), vec3(0.28, 0.12, 0.04), vor.g) * vor.r * vBand * uMaelstromAmt * 0.42;
        }

        // 4. Photographic 512x512 Cratered Full Moon & Cloud-Scattered Silver-Blue Corona
        vec3 mFwd = normalize(uMoonDir);
        vec3 mRight = normalize(cross(mFwd, vec3(0.0, 1.0, 0.0)));
        vec3 mUp = cross(mRight, mFwd);
        float mCos = dot(d, mFwd);
        vec2 mUv = vec2(dot(d, mRight), dot(d, mUp)) / max(0.01, uMoonRadius);
        float rNorm = mCos > 0.0 ? length(mUv) : 99.0;
        float moonEff = uMoonAmt * mix(1.0, 0.35, uBlackout);

        float vCoord = clamp((h + 0.05) * 1.18, 0.01, 0.99);
        vec4 p1 = texture2D(uPanoTex, vec2(uAz * 2.0 + uTime * 0.0028, vCoord));
        vec4 p2 = texture2D(uPanoTex, vec2(uAz * 4.0 - uTime * 0.0046 + (p1.r - 0.5) * 0.035, clamp(vCoord * 1.35 - 0.04, 0.01, 0.99)));
        vec4 pWisp = texture2D(uPanoTex, vec2(uAz * 5.0 + uTime * 0.0065, clamp(vCoord * 1.65 + 0.06, 0.01, 0.99)));

        float cInner = exp(-max(0.0, rNorm - 0.96) * 2.6) * (0.55 + 0.65 * pWisp.b);
        float cMid = exp(-rNorm * 0.78) * (0.70 + 0.50 * p1.r);
        float cOuter = exp(-rNorm * 0.32);
        col += starContrib * (1.0 - clamp(cMid * 2.0, 0.0, 1.0));
        col += uCoronaColor * (cInner * 0.22 + cMid * 0.12 + cOuter * 0.032) * moonEff;

        // Sample 512x512 baked Lunar Maria & Ringed Impact Craters (uMoonTex is SRGB8_ALPHA8 -> already linear in WebGL2!)
        if (rNorm < 1.03) {
          vec2 moonTexUv = vec2(0.5 + mUv.x * 0.48, 0.5 + mUv.y * 0.48);
          vec4 lunarSample = texture2D(uMoonTex, clamp(moonTexUv, 0.0, 1.0));
          vec3 lunarLinear = lunarSample.rgb * uMoonTint * 1.04 * moonEff;
          col = mix(col, lunarLinear, lunarSample.a);
        }

        // 5. High-Resolution 1024x512 Billowy Cumulonimbus Storm Panorama + Delicate Wispy Moon Filaments
        if (h > -0.06) {
          float vertMask = smoothstep(-0.06, 0.02, h) * (1.0 - smoothstep(0.52, 0.90, h));

          float rawCumulus = p1.r * 0.56 + p2.r * 0.32 + pWisp.b * 0.12;
          float turretNormal = clamp(p1.g * 0.58 + p2.g * 0.42, 0.0, 1.0);

          // Carve deep midnight-indigo sky rifts between towering storm-cloud banks (never a wall-to-wall grey sheet!)
          float moonWindow = smoothstep(0.60, 2.05, rNorm);
          float thresh = mix(0.60, 0.35, clamp(uCloudCover, 0.0, 1.0));
          float mainCloud = smoothstep(thresh, thresh + 0.25, rawCumulus) * vertMask * moonWindow;

          // Delicate feathery wispy filaments drifting across both the moon and open sky rifts
          float fineWisps = smoothstep(0.46, 0.82, pWisp.b * 0.64 + p2.b * 0.36) * vertMask * 0.42;
          float cloudDensity = clamp(mainCloud + fineWisps * (1.0 - mainCloud * 0.55), 0.0, 1.0);

          // Diagonal virga rain shafts hanging subtly under storm cloud bases (h = 0.0..0.22)
          if (uVirgaAmt > 0.01 && h > -0.02 && h < 0.24) {
            float virgaBand = smoothstep(-0.02, 0.05, h) * smoothstep(0.24, 0.09, h);
            float virga = smoothstep(0.54, 0.85, pWisp.b) * smoothstep(0.40, 0.74, p1.r) * virgaBand * uVirgaAmt;
            col = mix(col, uMidSkyColor * 1.12 * darkScale, virga * 0.28);
          }

          // Dramatic chiseled silver-blue moonlit cloud turret edges vs deep slate-charcoal storm bellies
          float thinFringe = smoothstep(0.03, 0.28, cloudDensity) * exp(-cloudDensity * 3.6);
          float crestLit = pow(smoothstep(0.46, 0.84, turretNormal), 1.60) * (1.0 - cloudDensity * 0.42);
          float moonProx = exp(-rNorm * 0.55) * 1.85 + exp(-rNorm * 0.18) * 0.42 + 0.22;
          float silverRim = (thinFringe * 1.28 + crestLit * 0.96) * moonProx * moonEff;

          vec3 cBody = mix(uCloudMid * 0.90, uCloudDark, smoothstep(0.10, 0.60, cloudDensity)) * darkScale;
          cBody += uMidSkyColor * crestLit * 0.30 * darkScale;
          cBody += uCloudRim * silverRim * 0.76;

          // Across the lunar disc itself, feathery wispy cloud filaments veil the moon subtly in cool storm-slate!
          if (rNorm < 1.35) {
            float overMoon = 1.0 - smoothstep(0.85, 1.35, rNorm);
            cBody = mix(cBody, uCloudMid * 1.05 + uCloudRim * 0.22 * moonEff, overMoon * 0.55);
          }

          // Foundry volcanic/furnace ember under-lit clouds
          if (uSmogAmt > 0.01) {
            float underSlope = 1.0 - turretNormal;
            float underLit = underSlope * exp(-max(0.0, h) * 6.2) * uSmogAmt;
            cBody += vec3(0.42, 0.10, 0.016) * underLit * (0.42 + 0.58 * cloudDensity);
          }

          // Internal thunderhead lightning scattering
          if (uLightning > 0.005) {
            float boltProx = pow(max(dot(d, normalize(uBoltDir)), 0.0), 8.0);
            cBody += vec3(0.34, 0.52, 0.86) * uLightning * (boltProx * 0.88 + 0.10) * (1.0 - cloudDensity * 0.45);
          }

          float moonLimbVeil = mix(0.24, 0.52, smoothstep(0.35, 0.98, rNorm));
          float maxAlpha = rNorm < 1.15 ? moonLimbVeil : 0.95;
          float cloudAlpha = clamp(cloudDensity * 0.95, 0.0, maxAlpha);
          col = mix(col, cBody, cloudAlpha);
        }

        if (h < -0.02) {
          vec3 deepSea = mix(uHorizonMistColor * 0.55, uZenithColor * 0.75, smoothstep(-0.02, -0.22, h)) * darkScale;
          col = mix(col, deepSea, smoothstep(-0.02, -0.14, h));
        }

        if (uLightning > 0.005) {
          col += vec3(0.055, 0.09, 0.15) * uLightning * smoothstep(-0.02, 0.55, h);
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// High-Detail Shaded Gas-Giant & Cassini Ring Shaders for Original '87 Mode
function createOriginalPlanetMaterials(cloudPanoTex) {
  const sunDir = new THREE.Vector3(-0.48, 0.44, 0.76).normalize();
  const ringNormal = new THREE.Vector3(0.0, Math.sin(Math.PI * 0.36), Math.cos(Math.PI * 0.36)).normalize();

  const planetMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uSpin: { value: 0 },
      uSunDir: { value: sunDir },
      uRingNormal: { value: ringNormal },
      uAtmosColor: { value: new THREE.Color('#38bdf8') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalGroup;
      varying vec3 vPosGroup;
      varying vec3 vNormalView;
      void main() {
        vNormalGroup = normalize(normal);
        vPosGroup = position;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform float uSpin;
      uniform vec3 uSunDir;
      uniform vec3 uRingNormal;
      uniform vec3 uAtmosColor;
      varying vec3 vNormalGroup;
      varying vec3 vPosGroup;
      varying vec3 vNormalView;

      void main() {
        // Infinite-resolution seamless 3D spherical gas-giant zonal belts + Kelvin-Helmholtz eddies!
        vec3 P = normalize(vPosGroup);
        float lon = atan(P.x, P.z) * 0.159154943 + 0.5 + uSpin;
        float lat = clamp(P.y * 0.5 + 0.5, 0.01, 0.99);

        vec4 turb1 = texture2D(uPanoTex, vec2(lon * 2.0, lat));
        vec4 turb2 = texture2D(uPanoTex, vec2(lon * 5.0 - uSpin * 1.6, clamp(lat * 1.4 - 0.15, 0.02, 0.98)));
        float eddy = (turb1.r - 0.5) * 0.065 + (turb2.b - 0.5) * 0.032 + sin(lon * 18.8495 + lat * 22.0) * 0.010;
        float bLat = clamp(lat + eddy, 0.0, 1.0);

        // Luminous multi-belt Nebulus / Saturn-Neptune cosmic palette (linear RGB)
        vec3 cPolar   = vec3(0.025, 0.085, 0.34);
        vec3 cCyan    = vec3(0.08,  0.48,  0.88);
        vec3 cCream   = vec3(0.92,  0.78,  0.48);
        vec3 cAmber   = vec3(0.76,  0.30,  0.10);
        vec3 cIce     = vec3(0.38,  0.76,  0.96);

        float zWave = sin(bLat * 25.0);
        float dBand1 = (bLat - 0.54) / 0.11;
        float dBand2 = (bLat - 0.41) / 0.065;
        float dBand3 = (bLat - 0.29) / 0.055;
        vec3 alb = mix(cPolar, cCyan, smoothstep(0.06, 0.24, bLat) * smoothstep(0.94, 0.76, bLat));
        alb = mix(alb, cIce, smoothstep(0.15, 0.75, zWave) * 0.78);
        alb = mix(alb, cCream, exp(-dBand1 * dBand1) * 0.88);
        alb = mix(alb, cAmber, exp(-dBand2 * dBand2) * 0.85);
        alb = mix(alb, cCream, exp(-dBand3 * dBand3) * 0.72);
        alb *= (0.86 + 0.28 * turb2.g);

        // Swirling Great Golden-Cyan Storm Vortex on sunlit front-left hemisphere!
        float dLon = fract(lon - uSpin - 0.44 + 0.5) - 0.5;
        float dLat = lat - 0.42;
        float stormR2 = (dLon / 0.095) * (dLon / 0.095) + (dLat / 0.065) * (dLat / 0.065);
        float stormEye = exp(-stormR2 * 1.5);
        float dStormRing = stormR2 - 0.48;
        float stormRing = exp(-dStormRing * dStormRing * 5.0);
        alb = mix(alb, mix(vec3(0.98, 0.62, 0.26), vec3(0.75, 0.95, 1.0), stormRing), stormEye * 0.78);

        vec3 L = normalize(uSunDir);
        float ndl = dot(normalize(vNormalGroup), L);
        float diff = smoothstep(-0.22, 0.76, ndl);

        // Cast crisp Cassini-divided ring shadow across the planet's upper sunlit hemisphere!
        float ringShadow = 1.0;
        float denom = dot(L, uRingNormal);
        if (abs(denom) > 0.02) {
          float tHit = -dot(vPosGroup, uRingNormal) / denom;
          if (tHit > 0.0) {
            vec3 hitPt = vPosGroup + L * tHit;
            float rHit = length(hitPt);
            if (rHit > 1.30 && rHit < 2.12) {
              float uRing = (rHit - 1.30) / (2.12 - 1.30);
              float dCasS = (uRing - 0.58) / 0.05;
              float cassini = 1.0 - 0.88 * exp(-dCasS * dCasS);
              ringShadow = 1.0 - 0.58 * cassini;
            }
          }
        }

        // Rayleigh cyan atmospheric limb glow + subtle night-side rim
        float viewZ = clamp(vNormalView.z, 0.0, 1.0);
        float limb = pow(max(0.0, 1.0 - viewZ), 2.4) * (0.22 + 0.78 * smoothstep(-0.32, 0.55, ndl));

        vec3 col = alb * (0.05 + 1.15 * diff * ringShadow) + uAtmosColor * limb * 0.78;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const ringMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: sunDir },
      uTint: { value: new THREE.Color('#e0f2fe') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uTint;
      varying vec3 vLocalPos;
      void main() {
        float r = length(vLocalPos.xy);
        float t = clamp((r - 1.30) / (2.12 - 1.30), 0.0, 1.0);
        float edgeFade = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.90, t);
        if (edgeFade <= 0.004) discard;

        // Multi-ring structure + crisp Cassini & Encke divisions (100% NaN-safe x*x!)
        float dCas = (t - 0.58) / 0.038;
        float dEnc = (t - 0.84) / 0.018;
        float cassini = 1.0 - 0.92 * exp(-dCas * dCas);
        float encke = 1.0 - 0.58 * exp(-dEnc * dEnc);
        float ringlets = 0.74 + 0.26 * sin(t * 78.0) * cos(t * 31.0);

        // Planet shadow cast onto back-right half of rings (matching ringMesh.rotation.x = -0.36 * PI)
        vec3 wp = vec3(vLocalPos.x, vLocalPos.y * 0.4258, -vLocalPos.y * 0.9048);
        vec3 L = normalize(uSunDir);
        float proj = dot(wp, L);
        float perp2 = dot(wp, wp) - proj * proj;
        float planetShadow = proj < 0.0 ? smoothstep(0.88, 1.06, sqrt(max(0.0, perp2))) : 1.0;

        vec3 innerGold = vec3(0.96, 0.84, 0.62);
        vec3 outerIce = mix(vec3(0.45, 0.82, 1.0), uTint, 0.55);
        vec3 col = mix(innerGold, outerIce, smoothstep(0.15, 0.72, t)) * ringlets * (0.14 + 0.95 * planetShadow);
        float alpha = edgeFade * cassini * encke * (0.45 + 0.46 * ringlets);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  return { planetMat, ringMat };
}

function createFireflyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFocusY: { value: 2.0 },
      uWaterY: { value: -0.55 },
      uCamYaw: { value: 0 },
      uWind: { value: 0 },
      uPixelRatio: { value: 2.0 },
      uColorA: { value: new THREE.Color('#00f5c8') },
      uColorB: { value: new THREE.Color('#0ee876') },
      uColorC: { value: new THREE.Color('#00d4ff') },
      uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;   // x: baseAngle, y: radius, z: ySpanOffset, w: phase
      attribute vec4 aParams; // x: speed, y: sizeScale, z: colorMix, w: tier (0=flank, 1=waterSpore, 2=bokehOrb)

      uniform float uTime;
      uniform float uFocusY;
      uniform float uWaterY;
      uniform float uCamYaw;
      uniform float uWind;
      uniform float uPixelRatio;

      varying float vTwinkle;
      varying float vColorMix;
      varying float vDepthFade;
      varying float vTier;

      void main() {
        float phase = aSeed.w;
        float spd = aParams.x;
        float tier = aParams.w;
        vTier = tier;

        float isSurf = step(0.5, tier) * (1.0 - step(1.5, tier));
        float isBokeh = step(1.5, tier);

        float yawFollow = isSurf > 0.5 ? 0.82 : (isBokeh > 0.5 ? 0.22 : 0.36);
        float ang = aSeed.x - uCamYaw * yawFollow
          + sin(uTime * spd + phase) * (isBokeh > 0.5 ? 0.16 : 0.34)
          + cos(uTime * spd * 0.61 + phase * 1.7) * 0.14
          + uWind * 0.08;

        float rad = aSeed.y + sin(uTime * (spd * 1.3) + phase * 2.1) * 0.26;

        float worldY;
        if (isSurf > 0.5) {
          worldY = uWaterY + 0.14 + fract(aSeed.z + uTime * 0.055) * 2.25 + sin(uTime * 1.9 + phase) * 0.14;
        } else {
          float span = 14.8;
          float localY = mod(aSeed.z * span + uTime * spd * 0.52 + sin(uTime * 1.4 + phase) * 0.32, span) - span * 0.47;
          worldY = max(uWaterY + 0.24, uFocusY + localY);
        }

        vec3 worldPos = vec3(sin(ang) * rad, worldY, cos(ang) * rad);
        vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
        float dist = max(1.5, -mvPosition.z);

        float pulse1 = 0.5 + 0.5 * sin(uTime * (1.7 + spd * 2.3) + phase);
        float pulse2 = 0.5 + 0.5 * cos(uTime * (0.9 + spd * 1.3) - phase * 1.6);
        vTwinkle = 0.38 + 0.62 * pow(pulse1 * 0.65 + pulse2 * 0.35, 1.3);
        vColorMix = aParams.z;
        vDepthFade = smoothstep(38.0, 6.5, dist);

        float basePt = aParams.y * (0.84 + 0.34 * vTwinkle);
        gl_PointSize = clamp(basePt * uPixelRatio * (235.0 / dist), 6.0, 74.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform float uIntensity;

      varying float vTwinkle;
      varying float vColorMix;
      varying float vDepthFade;
      varying float vTier;

      void main() {
        vec2 uv = (gl_PointCoord - 0.5) * 2.0;
        float r2 = dot(uv, uv);
        if (r2 > 1.0) discard;
        float r = sqrt(r2);

        vec3 tint = vColorMix < 0.5
          ? mix(uColorA, uColorB, vColorMix * 2.0)
          : mix(uColorB, uColorC, (vColorMix - 0.5) * 2.0);

        vec3 col;
        float alpha;
        if (vTier > 1.5) {
          float softBell = exp(-r2 * 3.4) * pow(max(0.0, 1.0 - r), 1.35);
          float warmCore = exp(-r2 * 14.0);
          col = tint * (softBell * 0.88) + mix(tint, vec3(0.25, 1.05, 0.88), 0.4) * warmCore * 0.52;
          alpha = clamp((softBell * 0.56 + warmCore * 0.34) * vTwinkle * vDepthFade * uIntensity, 0.0, 1.0);
        } else {
          float core = exp(-r2 * 46.0);
          float innerHalo = exp(-r2 * 5.2);
          float outerAura = pow(max(0.0, 1.0 - r), 2.3) * 0.64;

          vec3 coreTint = mix(tint * 1.35, vec3(0.32, 1.18, 0.98), 0.55);
          col = tint * (innerHalo * 0.96 + outerAura * 0.85) + coreTint * core * 1.15;
          alpha = clamp((core * 0.95 + innerHalo * 0.82 + outerAura * 0.74) * vTwinkle * vDepthFade * uIntensity, 0.0, 1.0);
        }

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createSeaSprayMaterial(wispTex) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uMap: { value: wispTex },
      uPixelRatio: { value: 2.0 },
      uFoamColor: { value: new THREE.Color('#dceeff') },
      uShadowColor: { value: new THREE.Color('#1d3852') },
      uGlobalOpacity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      attribute float aRot;

      uniform float uPixelRatio;

      varying float vAlpha;
      varying float vRot;

      void main() {
        vAlpha = aAlpha;
        vRot = aRot;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = max(2.0, -mvPosition.z);
        gl_PointSize = clamp(aSize * uPixelRatio * (210.0 / dist), 2.0, 110.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uFoamColor;
      uniform vec3 uShadowColor;
      uniform float uGlobalOpacity;

      varying float vAlpha;
      varying float vRot;

      void main() {
        if (vAlpha <= 0.004) discard;
        vec2 centered = gl_PointCoord - 0.5;
        float r2 = dot(centered, centered);
        if (r2 > 0.25) discard;

        float c = cos(vRot);
        float s = sin(vRot);
        vec2 rotUv = vec2(centered.x * c - centered.y * s, centered.x * s + centered.y * c) + 0.5;
        vec4 tex = texture2D(uMap, rotUv);
        float radialMask = pow(max(0.0, 1.0 - sqrt(r2) * 2.0), 1.45);
        float a = tex.a * radialMask * vAlpha * uGlobalOpacity;
        if (a <= 0.004) discard;

        vec3 sprayCol = mix(uShadowColor, uFoamColor, smoothstep(0.75, 0.15, gl_PointCoord.y));
        gl_FragColor = vec4(sprayCol, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ============================================================================
// MAIN EXPORTED CLASS: `StormAtmosphere`
// ============================================================================

export class StormAtmosphere {
  constructor(scene, opts = {}) {
    this.scene = scene || null;
    this.towerRadius = opts.towerRadius || DEFAULT_TOWER_RADIUS;
    this.floorHeight = opts.floorHeight || DEFAULT_FLOOR_HEIGHT;
    this.era = 'reboot';
    this._reflectionPass = false;
    this._disposed = false;

    // Pre-allocated scratch math objects (ZERO per-frame allocations!)
    this.moonDirection = new THREE.Vector3(0.42, 0.26, -0.87).normalize();
    this._moonDirOut = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camFwd = new THREE.Vector3(0, 0, -1);
    this._camRight = new THREE.Vector3(1, 0, 0);
    this._camUp = new THREE.Vector3(0, 1, 0);
    this._boltDir = new THREE.Vector3(-0.32, 0.34, -0.88).normalize();
    this._tmpColorA = new THREE.Color();
    this._tmpColorB = new THREE.Color();
    this._tmpMat4 = new THREE.Matrix4();
    this._tmpPos = new THREE.Vector3();
    this._tmpQuat = new THREE.Quaternion();
    this._tmpScale = new THREE.Vector3();

    this._ownedTextures = [];
    this._ownedGeometries = [];
    this._ownedMaterials = [];

    this.root = new THREE.Group();
    this.root.name = 'StormAtmosphere';
    this.group = this.root;

    this._buildSharedTextures();
    this._buildSkyDome();
    this._buildArchipelagoVistasAndSeaFog();
    this._buildAuroraRibbons();
    this._buildRebootFlankMist();
    this._buildFireflies();
    this._buildSeaSprayPlumes();
    this._buildWeatherSystems();
    this._buildLightningBolts();
    this._buildOriginalArcadeSkyExtras();

    this.setEra('reboot');
    if (this.scene) {
      this.scene.add(this.root);
    }
  }

  _trackTex(t) {
    this._ownedTextures.push(t);
    return t;
  }

  _trackGeo(g) {
    this._ownedGeometries.push(g);
    return g;
  }

  _trackMat(m) {
    this._ownedMaterials.push(m);
    return m;
  }

  _buildSharedTextures() {
    this.cloudPanoTex = this._trackTex(createHighResCloudPanoramaTexture(1024, 512));
    this.moonTex = this._trackTex(createDetailedMoonTexture(512));
    this.wispTex = this._trackTex(createSoftWispTexture());
    this.glowTex = this._trackTex(createRadialGlowTexture(64));
  }

  _buildSkyDome() {
    // 24x16 sphere (720 tris vs 2,976 tris) — vDir is normalized per-fragment so 0px difference!
    const skyGeo = this._trackGeo(new THREE.SphereGeometry(135, 24, 16));
    this.skyMat = this._trackMat(createStormSkyMaterial(this.cloudPanoTex, this.moonTex));
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyDome.renderOrder = -1000;
    this.skyDome.frustumCulled = false;
    this.root.add(this.skyDome);
  }

  // 3D Archipelago Horizon Vistas (1 merged draw call active at a time!) + Rolling Horizon Sea-Fog Ring (1 draw call)
  _buildArchipelagoVistasAndSeaFog() {
    this.archipelagoGroup = new THREE.Group();
    this.vistaMat = this._trackMat(createArchipelagoVistaMaterial(this.cloudPanoTex));

    const vistaTypes = ['coastal', 'volcanic', 'glacial', 'maelstrom', 'alien_orig'];
    this.vistaMeshes = {};
    for (let i = 0; i < vistaTypes.length; i++) {
      const k = vistaTypes[i];
      const geo = this._trackGeo(buildVistaGeometry(k));
      const mesh = new THREE.Mesh(geo, this.vistaMat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -500;
      mesh.visible = k === 'coastal';
      this.vistaMeshes[k] = mesh;
      this.archipelagoGroup.add(mesh);
    }
    this._activeVistaKey = 'coastal';
    this.root.add(this.archipelagoGroup);

    // Concentric 2-shell rolling horizon sea-fog ring starting flush at waterY (28 radial segs = 112 tris, zero below-sea Z-cut!)
    const innerCyl = new THREE.CylinderGeometry(64, 66, 9.5, 28, 1, true);
    innerCyl.translate(0, 4.75, 0);
    const outerCyl = new THREE.CylinderGeometry(86, 88, 13.0, 28, 1, true);
    outerCyl.translate(0, 6.5, 0);

    // Merge both open cylinders into 1 single draw call
    const p1 = innerCyl.attributes.position.array;
    const u1 = innerCyl.attributes.uv.array;
    const i1 = innerCyl.index.array;
    const p2 = outerCyl.attributes.position.array;
    const u2 = outerCyl.attributes.uv.array;
    const i2 = outerCyl.index.array;
    const vCount1 = p1.length / 3;

    const mPos = new Float32Array(p1.length + p2.length);
    mPos.set(p1, 0);
    mPos.set(p2, p1.length);
    const mUv = new Float32Array(u1.length + u2.length);
    mUv.set(u1, 0);
    mUv.set(u2, u1.length);
    const mIdx = new Uint16Array(i1.length + i2.length);
    mIdx.set(i1, 0);
    for (let j = 0; j < i2.length; j++) mIdx[i1.length + j] = i2[j] + vCount1;

    innerCyl.dispose();
    outerCyl.dispose();

    const mistRingGeo = this._trackGeo(new THREE.BufferGeometry());
    mistRingGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    mistRingGeo.setAttribute('uv', new THREE.BufferAttribute(mUv, 2));
    mistRingGeo.setIndex(new THREE.BufferAttribute(mIdx, 1));

    this.horizonMistMat = this._trackMat(createHorizonMistRingMaterial(this.cloudPanoTex));
    this.horizonMistRing = new THREE.Mesh(mistRingGeo, this.horizonMistMat);
    this.horizonMistRing.frustumCulled = false;
    this.horizonMistRing.renderOrder = -450;
    this.root.add(this.horizonMistRing);
  }

  _buildAuroraRibbons() {
    const geo = this._trackGeo(buildAuroraRibbonsGeometry());
    this.auroraMat = this._trackMat(createAuroraRibbonMaterial(this.cloudPanoTex));
    this.auroraMesh = new THREE.Mesh(geo, this.auroraMat);
    this.auroraMesh.frustumCulled = false;
    this.auroraMesh.renderOrder = -600;
    this.auroraMesh.visible = false;
    this.root.add(this.auroraMesh);
  }

  _buildRebootFlankMist() {
    const count = 22;
    this._mistCount = count;
    const geo = this._trackGeo(new THREE.PlaneGeometry(1, 1));
    const mat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.wispTex,
        color: '#8fb4dc',
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        fog: true,
      })
    );
    this.flankMistMesh = new THREE.InstancedMesh(geo, mat, count);
    this.flankMistMesh.frustumCulled = false;
    this.flankMistMesh.renderOrder = -10;

    this._mistData = new Float32Array(count * 8);
    let seed = 19872026;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const k = i * 8;
      const side = i % 2 === 0 ? -1 : 1;
      this._mistData[k] = side;
      this._mistData[k + 1] = side * (this.towerRadius + 0.85 + rnd() * 2.8);
      this._mistData[k + 2] = -2.8 + rnd() * 2.2;
      this._mistData[k + 3] = (i / count) * 12.0;
      const w = 3.4 + rnd() * 2.6;
      this._mistData[k + 4] = w;
      this._mistData[k + 5] = w * (0.42 + rnd() * 0.14);
      this._mistData[k + 6] = (0.14 + rnd() * 0.18) * (rnd() < 0.5 ? -1 : 1);
      this._mistData[k + 7] = rnd() * TWO_PI;
    }
    this.root.add(this.flankMistMesh);
  }

  _buildFireflies() {
    const count = 144;
    this._fireflyCount = count;
    const dummyPos = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 4);
    const params = new Float32Array(count * 4);

    let seed = 4206913;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      const i4 = i * 4;
      let tier = 0.0;
      let baseAng;
      let radius;
      let worldScale;

      if (i >= 116) {
        tier = 1.0;
        baseAng = (rnd() - 0.5) * 1.55;
        radius = this.towerRadius + 0.28 + rnd() * 2.25;
        worldScale = 0.36 + rnd() * 0.34;
      } else if (i >= 94) {
        tier = 2.0;
        const side = i % 2 === 0 ? -1 : 1;
        baseAng = side * (0.46 + rnd() * 0.96);
        radius = this.towerRadius + 0.85 + rnd() * 3.8;
        worldScale = 0.92 + rnd() * 0.72;
      } else if (i < 68) {
        const side = i % 2 === 0 ? -1 : 1;
        baseAng = side * (0.40 + rnd() * 1.05);
        radius = this.towerRadius + 0.42 + rnd() * 4.4;
        worldScale = 0.48 + rnd() * 0.68;
      } else {
        baseAng = ((i - 68) / 26) * TWO_PI + rnd() * 0.35;
        radius = this.towerRadius + 0.45 + rnd() * 4.8;
        worldScale = 0.46 + rnd() * 0.64;
      }

      seeds[i4] = baseAng;
      seeds[i4 + 1] = radius;
      seeds[i4 + 2] = rnd();
      seeds[i4 + 3] = rnd() * TWO_PI;

      params[i4] = 0.20 + rnd() * 0.46;
      params[i4 + 1] = worldScale;
      params[i4 + 2] = rnd();
      params[i4 + 3] = tier;
    }

    const geo = this._trackGeo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute('aParams', new THREE.BufferAttribute(params, 4));

    this.fireflyMat = this._trackMat(createFireflyMaterial());
    this.fireflyPoints = new THREE.Points(geo, this.fireflyMat);
    this.fireflyPoints.frustumCulled = false;
    this.fireflyPoints.renderOrder = 4;
    this.root.add(this.fireflyPoints);
  }

  _buildSeaSprayPlumes() {
    const count = 84;
    this._sprayCount = count;
    this._sprayPos = new Float32Array(count * 3);
    this._sprayAlpha = new Float32Array(count);
    this._spraySize = new Float32Array(count);
    this._sprayRot = new Float32Array(count);
    this._sprayState = new Float32Array(count * 7);

    let seed = 88172645;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < count; i++) {
      const k = i * 7;
      let ang;
      if (i < 58) {
        const side = i % 2 === 0 ? -1 : 1;
        ang = side * (0.46 + rnd() * 0.82);
      } else {
        ang = (rnd() - 0.5) * 1.15;
      }
      const isDroplet = i >= 60;
      this._sprayState[k] = ang;
      this._sprayState[k + 1] = this.towerRadius + 0.16 + rnd() * (isDroplet ? 1.65 : 1.15);
      this._sprayState[k + 2] = 0.44 + rnd() * 0.36;
      this._sprayState[k + 3] = rnd();
      this._sprayState[k + 4] = isDroplet ? 1.25 + rnd() * 1.35 : 0.92 + rnd() * 1.25;
      this._sprayState[k + 5] = isDroplet ? 0.24 + rnd() * 0.24 : 1.15 + rnd() * 1.20;
      this._sprayState[k + 6] = (rnd() - 0.5) * 1.2;
    }

    const geo = this._trackGeo(new THREE.BufferGeometry());
    this._sprayPosAttr = new THREE.BufferAttribute(this._sprayPos, 3);
    this._sprayAlphaAttr = new THREE.BufferAttribute(this._sprayAlpha, 1);
    this._spraySizeAttr = new THREE.BufferAttribute(this._spraySize, 1);
    this._sprayRotAttr = new THREE.BufferAttribute(this._sprayRot, 1);
    geo.setAttribute('position', this._sprayPosAttr);
    geo.setAttribute('aAlpha', this._sprayAlphaAttr);
    geo.setAttribute('aSize', this._spraySizeAttr);
    geo.setAttribute('aRot', this._sprayRotAttr);

    this.seaSprayMat = this._trackMat(createSeaSprayMaterial(this.wispTex));
    this.seaSprayPoints = new THREE.Points(geo, this.seaSprayMat);
    this.seaSprayPoints.frustumCulled = false;
    this.seaSprayPoints.renderOrder = 3;
    this.root.add(this.seaSprayPoints);
  }

  _buildWeatherSystems() {
    const pCount = 240;
    this._weatherCount = pCount;
    this._weatherPos = new Float32Array(pCount * 3);
    this._weatherMeta = new Float32Array(pCount * 3);

    let seed = 7731901;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < pCount; i++) {
      const i3 = i * 3;
      this._weatherPos[i3] = (rnd() - 0.5) * 16.0;
      this._weatherPos[i3 + 1] = (rnd() - 0.5) * 18.0;
      this._weatherPos[i3 + 2] = -1.5 + rnd() * 7.2;
      this._weatherMeta[i3] = 0.85 + rnd() * 1.45;
      this._weatherMeta[i3 + 1] = 0.9 + rnd() * 1.6;
      this._weatherMeta[i3 + 2] = rnd() * TWO_PI;
    }

    const wGeo = this._trackGeo(new THREE.BufferGeometry());
    this._weatherPosAttr = new THREE.BufferAttribute(this._weatherPos, 3);
    wGeo.setAttribute('position', this._weatherPosAttr);

    this.weatherMat = this._trackMat(
      new THREE.PointsMaterial({
        size: 0.14,
        map: this.glowTex,
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.weatherPoints = new THREE.Points(wGeo, this.weatherMat);
    this.weatherPoints.frustumCulled = false;
    this.weatherPoints.visible = false;
    this.root.add(this.weatherPoints);

    const rainN = 100;
    const gustN = 44;
    this._rainN = rainN;
    this._gustN = gustN;
    const totalSegs = rainN + gustN;
    this._streakPos = new Float32Array(totalSegs * 6);
    this._streakCol = new Float32Array(totalSegs * 6);
    this._streakState = new Float32Array(totalSegs * 5);

    for (let i = 0; i < totalSegs; i++) {
      const k5 = i * 5;
      const k6 = i * 6;
      const isGust = i >= rainN;
      this._streakState[k5] = (rnd() - 0.5) * 17.0;
      this._streakState[k5 + 1] = (rnd() - 0.5) * 17.0;
      this._streakState[k5 + 2] = isGust ? this.towerRadius + 0.35 + rnd() * 2.8 : -1.5 + rnd() * 7.0;
      this._streakState[k5 + 3] = isGust ? 0.95 + rnd() * 1.45 : 0.48 + rnd() * 0.34;
      this._streakState[k5 + 4] = isGust ? 8.5 + rnd() * 6.5 : 14.5 + rnd() * 5.0;

      this._streakCol[k6] = isGust ? 0.78 : 0.58;
      this._streakCol[k6 + 1] = isGust ? 0.92 : 0.74;
      this._streakCol[k6 + 2] = 1.0;
      this._streakCol[k6 + 3] = 0.05;
      this._streakCol[k6 + 4] = 0.09;
      this._streakCol[k6 + 5] = 0.15;
    }

    const sGeo = this._trackGeo(new THREE.BufferGeometry());
    this._streakPosAttr = new THREE.BufferAttribute(this._streakPos, 3);
    sGeo.setAttribute('position', this._streakPosAttr);
    sGeo.setAttribute('color', new THREE.BufferAttribute(this._streakCol, 3));

    this.streakMat = this._trackMat(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.streakLines = new THREE.LineSegments(sGeo, this.streakMat);
    this.streakLines.frustumCulled = false;
    this.streakLines.visible = false;
    this.root.add(this.streakLines);
  }

  _buildLightningBolts() {
    const maxSegs = 32;
    this._boltMaxSegs = maxSegs;
    this._boltPos = new Float32Array(maxSegs * 4 * 3);
    this._boltUv = new Float32Array(maxSegs * 4 * 2);
    const indices = new Uint16Array(maxSegs * 6);
    for (let s = 0; s < maxSegs; s++) {
      const v0 = s * 4;
      const i0 = s * 6;
      indices[i0] = v0;
      indices[i0 + 1] = v0 + 1;
      indices[i0 + 2] = v0 + 2;
      indices[i0 + 3] = v0 + 2;
      indices[i0 + 4] = v0 + 1;
      indices[i0 + 5] = v0 + 3;

      const u0 = s * 8;
      this._boltUv[u0] = 0;
      this._boltUv[u0 + 1] = 0;
      this._boltUv[u0 + 2] = 1;
      this._boltUv[u0 + 3] = 0;
      this._boltUv[u0 + 4] = 0;
      this._boltUv[u0 + 5] = 1;
      this._boltUv[u0 + 6] = 1;
      this._boltUv[u0 + 7] = 1;
    }

    const boltGeo = this._trackGeo(new THREE.BufferGeometry());
    this._boltPosAttr = new THREE.BufferAttribute(this._boltPos, 3);
    boltGeo.setAttribute('position', this._boltPosAttr);
    boltGeo.setAttribute('uv', new THREE.BufferAttribute(this._boltUv, 2));
    boltGeo.setIndex(new THREE.BufferAttribute(indices, 1));

    this.boltMat = this._trackMat(
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uFlash: { value: 0 },
          uCoreColor: { value: new THREE.Color('#f8fafc') },
          uGlowColor: { value: new THREE.Color('#7dd3fc') },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uFlash;
          uniform vec3 uCoreColor;
          uniform vec3 uGlowColor;
          varying vec2 vUv;
          void main() {
            float d = abs(vUv.x - 0.5) * 2.0;
            float core = exp(-d * d * 16.0);
            float halo = pow(max(0.0, 1.0 - d), 2.2);
            vec3 col = uGlowColor * halo * 1.1 + uCoreColor * core * 1.9;
            float alpha = clamp((core + halo * 0.65) * uFlash, 0.0, 1.0);
            gl_FragColor = vec4(col * alpha, alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      })
    );

    this.lightningMesh = new THREE.Mesh(boltGeo, this.boltMat);
    this.lightningMesh.frustumCulled = false;
    this.lightningMesh.visible = false;
    this.lightningMesh.renderOrder = -5;
    this.root.add(this.lightningMesh);

    this._boltSpine = new Float32Array(16 * 3);
    this._boltSeed = 13579;
    this._prevFlash = 0;
    this._ambientBoltTimer = 1.8;
    this._ambientBoltFlash = 0;
  }

  _nextBoltRand() {
    this._boltSeed = (Math.imul(this._boltSeed, 1664525) + 1013904223) >>> 0;
    return this._boltSeed / 4294967296;
  }

  _writeRibbonSeg(segIdx, x0, y0, z0, x1, y1, z1, halfW0, halfW1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.max(1e-4, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const o = segIdx * 12;
    const p = this._boltPos;

    p[o] = x0 - nx * halfW0;
    p[o + 1] = y0 - ny * halfW0;
    p[o + 2] = z0;

    p[o + 3] = x0 + nx * halfW0;
    p[o + 4] = y0 + ny * halfW0;
    p[o + 5] = z0;

    p[o + 6] = x1 - nx * halfW1;
    p[o + 7] = y1 - ny * halfW1;
    p[o + 8] = z1;

    p[o + 9] = x1 + nx * halfW1;
    p[o + 10] = y1 + ny * halfW1;
    p[o + 11] = z1;
  }

  _regenerateLightningGeometry(camX, camY, aspect) {
    const side = -1;
    const boltZ = -18.5 - this._nextBoltRand() * 4.5;
    const minClearX = aspect < 0.72 ? 4.8 : 6.2;
    const maxSpanX = Math.max(minClearX + 1.2, Math.min(13.5, aspect * 11.2));
    const topX = camX + side * (minClearX + this._nextBoltRand() * (maxSpanX - minClearX) * 0.65);
    const topY = camY + 12.0 + this._nextBoltRand() * 3.0;
    const botY = camY - 1.5 - this._nextBoltRand() * 2.0;

    this._boltDir.set(topX - camX, 7.5, boltZ).normalize();
    this.skyMat.uniforms.uBoltDir.value.copy(this._boltDir);

    const trunkSegs = 14;
    const sp = this._boltSpine;
    let curX = topX;
    for (let i = 0; i <= trunkSegs; i++) {
      const t = i / trunkSegs;
      if (i > 0) curX += (this._nextBoltRand() - 0.48) * 1.05;
      sp[i * 3] = curX;
      sp[i * 3 + 1] = topY + (botY - topY) * t;
      sp[i * 3 + 2] = boltZ;
    }

    let segCursor = 0;
    for (let i = 0; i < trunkSegs; i++) {
      const t0 = i / trunkSegs;
      const t1 = (i + 1) / trunkSegs;
      const w0 = 0.22 * (1 - t0 * 0.55);
      const w1 = 0.22 * (1 - t1 * 0.55);
      this._writeRibbonSeg(
        segCursor++,
        sp[i * 3],
        sp[i * 3 + 1],
        sp[i * 3 + 2],
        sp[(i + 1) * 3],
        sp[(i + 1) * 3 + 1],
        sp[(i + 1) * 3 + 2],
        w0,
        w1
      );
    }

    const forkNodes = [3, 6, 9];
    for (let f = 0; f < 3; f++) {
      const nIdx = forkNodes[f];
      let fx = sp[nIdx * 3];
      let fy = sp[nIdx * 3 + 1];
      const fz = sp[nIdx * 3 + 2];
      const fDir = f % 2 === 0 ? 1 : -1;
      for (let s = 0; s < 6; s++) {
        const nx = fx + fDir * (0.42 + this._nextBoltRand() * 0.58) + (this._nextBoltRand() - 0.5) * 0.35;
        const ny = fy - (0.55 + this._nextBoltRand() * 0.52);
        const w0 = 0.11 * (1 - s / 6);
        const w1 = 0.11 * (1 - (s + 1) / 6);
        this._writeRibbonSeg(segCursor++, fx, fy, fz, nx, ny, fz, w0, Math.max(0.012, w1));
        fx = nx;
        fy = ny;
      }
    }

    this._boltPosAttr.needsUpdate = true;
  }

  // Original '87 Mode: 240 Parallax Stars + High-Detail Shaded Ringed Gas-Giant Planet
  _buildOriginalArcadeSkyExtras() {
    this.origGroup = new THREE.Group();
    this.origGroup.visible = false;

    const sCount = 240;
    const sPos = new Float32Array(sCount * 3);
    const sCol = new Float32Array(sCount * 3);
    let seed = 19870780;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    const cWhite = new THREE.Color('#f8fafc');
    const cCyan = new THREE.Color('#67e8f9');
    const cGold = new THREE.Color('#fde68a');

    for (let i = 0; i < sCount; i++) {
      const ang = rnd() * TWO_PI;
      const dist = 34 + rnd() * 26;
      sPos[i * 3] = Math.sin(ang) * dist;
      sPos[i * 3 + 1] = -8 + rnd() * 40;
      sPos[i * 3 + 2] = Math.cos(ang) * dist - 8;
      const c = i % 5 === 0 ? cCyan : i % 11 === 0 ? cGold : cWhite;
      sCol[i * 3] = c.r;
      sCol[i * 3 + 1] = c.g;
      sCol[i * 3 + 2] = c.b;
    }

    const starGeo = this._trackGeo(new THREE.BufferGeometry());
    starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    const starMat = this._trackMat(
      new THREE.PointsMaterial({
        size: 0.11,
        map: this.glowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.90,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.origStarPoints = new THREE.Points(starGeo, starMat);
    this.origStarPoints.frustumCulled = false;
    this.origGroup.add(this.origStarPoints);

    // Unit-radius (r = 1.0) shaded Gas Giant + Cassini Rings (dynamically scaled for both 18-deg & 48-deg FOV!)
    this.origPlanetGroup = new THREE.Group();
    const { planetMat, ringMat } = createOriginalPlanetMaterials(this.cloudPanoTex);
    this.origPlanetMat = this._trackMat(planetMat);
    this.origRingMat = this._trackMat(ringMat);

    const planetGeo = this._trackGeo(new THREE.SphereGeometry(1.0, 36, 28));
    this.origPlanetMesh = new THREE.Mesh(planetGeo, this.origPlanetMat);

    const ringGeo = this._trackGeo(new THREE.RingGeometry(1.30, 2.12, 72));
    const ringMesh = new THREE.Mesh(ringGeo, this.origRingMat);
    ringMesh.rotation.x = -Math.PI * 0.36;

    const haloGeo = this._trackGeo(new THREE.PlaneGeometry(3.5, 3.5));
    const haloMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.glowTex,
        color: '#38bdf8',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    this.origPlanetHalo = new THREE.Mesh(haloGeo, haloMat);
    this.origPlanetHalo.position.set(0, 0, -0.2);

    // Keep origPlanetGroup.renderOrder === 0 so its children share groupOrder 0 with skyDome (-1000)
    // and render AFTER skyDome instead of being painted over by skyDome!
    this.origPlanetGroup.add(this.origPlanetHalo, this.origPlanetMesh, ringMesh);
    this.origPlanetHalo.renderOrder = -701;
    this.origPlanetMesh.renderOrder = -700;
    ringMesh.renderOrder = -699;
    this.origGroup.add(this.origPlanetGroup);

    this.root.add(this.origGroup);
  }

  _setVistaKind(kind) {
    if (this._activeVistaKey === kind) return;
    const keys = Object.keys(this.vistaMeshes);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      this.vistaMeshes[k].visible = k === kind;
    }
    this._activeVistaKey = kind;
  }

  setEra(era) {
    const isOrig = era === 'original' || era === true;
    this.era = isOrig ? 'original' : 'reboot';
    this.skyMat.uniforms.uOrig.value = isOrig ? 1.0 : 0.0;
    this.vistaMat.uniforms.uOrig.value = isOrig ? 1.0 : 0.0;
    this.origGroup.visible = isOrig;
    this.flankMistMesh.visible = !isOrig;
    this.fireflyPoints.visible = !isOrig;
    if (isOrig) {
      this._setVistaKind('alien_orig'); // Crisp chiseled alien spire peaks on Original '87 horizon
      this.auroraMesh.visible = false;
      this.weatherPoints.visible = false;
      this.streakLines.visible = false;
      this.lightningMesh.visible = false;
    }
  }

  setReflectionPass(active) {
    const refl = Boolean(active);
    if (refl && !this._reflectionPass) {
      this._savedAuroraVis = this.auroraMesh.visible;
      this._savedLightningVis = this.lightningMesh.visible;
    }
    this._reflectionPass = refl;
    this.archipelagoGroup.visible = !refl;
    this.horizonMistRing.visible = !refl;
    if (this.era === 'reboot') {
      this.flankMistMesh.visible = !refl;
      if (refl) {
        this.weatherPoints.visible = false;
        this.streakLines.visible = false;
        this.auroraMesh.visible = false;
        this.lightningMesh.visible = false;
      } else {
        this.auroraMesh.visible = Boolean(this._savedAuroraVis);
        this.lightningMesh.visible = Boolean(this._savedLightningVis);
      }
    } else if (this.origStarPoints) {
      this.origStarPoints.visible = !refl;
    }
  }

  getMoonDirection(out = this._moonDirOut) {
    return out.copy(this.moonDirection);
  }

  _resolveThemeKey(tower) {
    const raw = tower?.theme;
    if (raw && THEME_ATMOSPHERE_PRESETS[raw]) return raw;
    const keys = ['mist', 'sinking', 'foundry', 'blizzard', 'prism', 'piston', 'blackout', 'apex'];
    const idx = Math.max(0, (Number(tower?.id) || 1) - 1) % keys.length;
    return keys[idx];
  }

  update(state, camera, time, dt) {
    if (this._disposed) return;

    const t = Number.isFinite(time) ? time : state?.time || 0;
    const frameDt = Number.isFinite(dt) ? Math.min(0.1, Math.max(0.0, dt)) : 1 / 60;

    const nextEra = state?.era || (state?.original ? 'original' : this.era);
    if (nextEra !== this.era) {
      this.setEra(nextEra);
    }
    const isOrig = this.era === 'original';

    const tower = state?.tower || null;
    const pal = tower?.palette || null;
    const isRealOrig = isOrig && Boolean(tower?.real);
    const fh = isRealOrig ? STEP_ORIGINAL : this.floorHeight;

    let aspect = 0.66;
    let fovDeg = 48;
    if (camera) {
      camera.updateMatrixWorld();
      this._camPos.copy(camera.position);
      camera.matrixWorld.extractBasis(this._camRight, this._camUp, this._camFwd);
      this._camFwd.negate();
      aspect = camera.aspect || 0.66;
      fovDeg = camera.fov || 48;
    } else {
      this._camPos.set(0, (state?.camFloor || 2) * fh + 1.15, 12);
      this._camFwd.set(0, 0, -1);
      this._camRight.set(1, 0, 0);
      this._camUp.set(0, 1, 0);
    }

    const dpr = Math.min(2.5, Math.max(1.0, (typeof window !== 'undefined' && window.devicePixelRatio) || 2.0));
    this.fireflyMat.uniforms.uPixelRatio.value = dpr;
    this.seaSprayMat.uniforms.uPixelRatio.value = dpr;

    const camCol = state?.camCol || 0;
    const focusY = this._camPos.y;
    const waterFloor = state?.waterFloor !== undefined ? state.waterFloor : tower?.mechanics?.waterBaseFloor ?? -0.55;
    const waterY = waterFloor * fh;
    const wind = state?.windCurrent || 0;
    const blackout = Math.max(0, Math.min(1, state?.blackoutFactor || 0));

    const skyU = this.skyMat.uniforms;
    skyU.uTime.value = t;
    skyU.uYaw.value = -camCol * COL_ANGLE * 0.22;

    // Anchor 3D Archipelago Vistas & Rolling Sea-Fog Ring to live waterline & subtle camera-rotation parallax
    this.archipelagoGroup.visible = !this._reflectionPass;
    this.horizonMistRing.visible = !this._reflectionPass;
    this.archipelagoGroup.position.set(0, waterY, 0);
    this.archipelagoGroup.rotation.y = -camCol * COL_ANGLE * 0.34;
    this.horizonMistRing.position.set(0, waterY, 0);
    this.horizonMistRing.rotation.y = -camCol * COL_ANGLE * 0.18;

    const vU = this.vistaMat.uniforms;
    vU.uTime.value = t;
    vU.uWaterY.value = waterY;

    const mRingU = this.horizonMistMat.uniforms;
    mRingU.uTime.value = t;
    mRingU.uWaterY.value = waterY;

    if (isOrig) {
      this._setVistaKind('alien_orig');
      skyU.uBeaconColor.value.set(pal?.glow || '#38bdf8');
      vU.uBeaconB.value.set(pal?.glow || '#38bdf8');
      vU.uBeaconA.value.set('#fbbf24');
      mRingU.uMistColor.value.set('#08142e');
      mRingU.uRimColor.value.set(pal?.glow || '#38bdf8');
      mRingU.uOpacity.value = 0.14;

      this.origStarPoints.rotation.y = -camCol * COL_ANGLE * 0.16;
      this.origStarPoints.position.y = focusY - 12.0;

      // Exact camera-basis ray framing so the Shaded Ringed Gas-Giant Planet sits majestically inside
      // the upper-right sky corridor (behind distant r=84m alien peaks, well inside camera.far=220m)
      // in BOTH 18-deg telephoto ('87 real, portrait & 16:9) AND 48-deg wide!
      const halfTanY = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
      const halfTanX = halfTanY * aspect;
      const camHorizDist = Math.max(9.6, Math.hypot(this._camPos.x, this._camPos.z));
      const sinSil = Math.min(0.85, (this.towerRadius + 0.10) / camHorizDist);
      const towerAngW = sinSil / Math.sqrt(Math.max(0.05, 1 - sinSil * sinSil));

      const pDistAlongRay = 152.0;
      const availRightSpan = Math.max(0.018, halfTanX - towerAngW);
      const desiredRingHalfAng = aspect < 0.72
        ? Math.min(halfTanY * 0.24, Math.max(availRightSpan * 1.26, halfTanX * 0.36))
        : Math.min(halfTanY * 0.25, availRightSpan * 0.36);
      const planetScale = Math.max(0.65, Math.min(6.2, (desiredRingHalfAng * pDistAlongRay) / 2.12));
      this.origPlanetGroup.scale.setScalar(planetScale);

      const centerTanX = aspect < 0.72
        ? towerAngW + availRightSpan * 0.48
        : towerAngW + availRightSpan * 0.45;
      const centerTanY = halfTanY * (aspect < 0.72 ? 0.58 : 0.53);
      this.origPlanetGroup.position
        .copy(this._camPos)
        .addScaledVector(this._camFwd, pDistAlongRay)
        .addScaledVector(this._camRight, centerTanX * pDistAlongRay)
        .addScaledVector(this._camUp, centerTanY * pDistAlongRay);
      this.origPlanetGroup.lookAt(this._camPos);
      this.origPlanetGroup.rotateZ(-0.22);
      this.origPlanetMat.uniforms.uSpin.value = t * 0.025;
      if (pal?.glow) {
        this.origPlanetHalo.material.color.set(pal.glow);
        this.origPlanetMat.uniforms.uAtmosColor.value.set(pal.glow);
      }

      this._updateSeaSpray(t, frameDt, waterY, focusY, camCol, 0.32);
      return;
    }

    // ========================================================================
    // REBOOT ERA ATMOSPHERE, 3D ARCHIPELAGO VISTA & WEATHER UPDATE
    // ========================================================================
    const themeKey = this._resolveThemeKey(tower);
    const preset = THEME_ATMOSPHERE_PRESETS[themeKey];
    this._setVistaKind(preset.vista);

    skyU.uZenithColor.value.set(preset.zenith);
    if (pal?.skyTop) {
      this._tmpColorA.set(pal.skyTop);
      skyU.uZenithColor.value.lerp(this._tmpColorA, 0.30);
    }
    skyU.uMidSkyColor.value.set(preset.midSky);
    if (pal?.skyMid) {
      this._tmpColorA.set(pal.skyMid);
      skyU.uMidSkyColor.value.lerp(this._tmpColorA, 0.30);
    }
    skyU.uHorizonColor.value.set(preset.horizon);
    skyU.uHorizonMistColor.value.set(preset.horizonMist);
    if (pal?.fog) {
      this._tmpColorA.set(pal.fog);
      skyU.uHorizonMistColor.value.lerp(this._tmpColorA, 0.25);
    }
    skyU.uCloudDark.value.set(preset.cloudDark);
    skyU.uCloudMid.value.set(preset.cloudMid);
    skyU.uCloudRim.value.set(preset.cloudRim);
    skyU.uMoonTint.value.set(preset.moonTint);
    skyU.uCoronaColor.value.set(preset.corona);
    skyU.uBeaconColor.value.set(pal?.glow || preset.beacon);

    skyU.uMoonAmt.value = preset.moonAmt;
    skyU.uCloudCover.value = preset.cloudCover;
    skyU.uAuroraAmt.value = preset.aurora;
    skyU.uNebulaAmt.value = preset.nebula;
    skyU.uSmogAmt.value = preset.smog;
    skyU.uMaelstromAmt.value = preset.maelstrom;
    skyU.uVirgaAmt.value = preset.virga;
    skyU.uAbyssMistAmt.value = preset.abyssMist;
    skyU.uBlackout.value = blackout;

    // Frame the detailed 512x512 cratered moon cleanly in the upper-right sky
    const halfTanY = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
    const halfTanX = halfTanY * aspect;
    const camHorizDist = Math.max(6.5, Math.hypot(this._camPos.x, this._camPos.z));
    const effTowerR = this.towerRadius + (aspect < 0.68 ? 0.14 : 0.05);
    const sinSil = Math.min(0.85, effTowerR / camHorizDist);
    const towerAngHalfW = sinSil / Math.sqrt(Math.max(0.05, 1 - sinSil * sinSil));
    const moonRadiusAng = aspect < 0.68 ? 0.023 : aspect < 1.0 ? 0.032 : 0.044;
    skyU.uMoonRadius.value = moonRadiusAng;

    const minRightClear = towerAngHalfW + moonRadiusAng * 0.90;
    const maxRightInside = Math.max(minRightClear, halfTanX - moonRadiusAng * 1.12);
    const desiredTanX = Math.min(maxRightInside, Math.max(minRightClear, halfTanX * 0.72));
    const isTitleShowcase = Boolean(state?.titleShowcase);
    const desiredTanY = halfTanY * (isTitleShowcase ? 0.52 : aspect < 0.68 ? 0.62 : 0.58);
    const subtleParallaxX = Math.sin(-camCol * COL_ANGLE * 0.5) * (aspect < 0.68 ? 0.002 : 0.008);

    this.moonDirection
      .copy(this._camFwd)
      .addScaledVector(this._camRight, desiredTanX + subtleParallaxX)
      .addScaledVector(this._camUp, desiredTanY)
      .normalize();
    if (this.moonDirection.y < 0.14) {
      this.moonDirection.y = 0.14;
      this.moonDirection.normalize();
    }
    skyU.uMoonDir.value.copy(this.moonDirection);

    // Sync 3D Archipelago Vistas & Rolling Sea-Fog Ring uniforms
    vU.uNearColor.value.set(preset.mountNear);
    vU.uFarColor.value.set(preset.mountFar);
    vU.uMistColor.value.copy(skyU.uHorizonMistColor.value);
    vU.uRimColor.value.set(preset.cloudRim);
    vU.uBeaconA.value.set(preset.beacon);
    vU.uBeaconB.value.set(preset.beaconAlt);
    vU.uVentColor.value.set(themeKey === 'foundry' ? '#ff5500' : themeKey === 'prism' ? '#e879f9' : '#fbbf24');
    vU.uMoonDir.value.copy(this.moonDirection);
    vU.uBlackout.value = blackout;

    mRingU.uMistColor.value.copy(skyU.uHorizonMistColor.value);
    mRingU.uRimColor.value.set(preset.cloudRim);
    mRingU.uMoonDir.value.copy(this.moonDirection);
    mRingU.uOpacity.value = (0.32 + preset.abyssMist * 0.16) * (1.0 - blackout * 0.55);

    // 3D Multi-Curtain Boreal Aurora Ribbons ('blizzard', 'apex', 'prism')
    const wantAurora = preset.aurora > 0.02;
    this._savedAuroraVis = wantAurora;
    this.auroraMesh.visible = wantAurora && !this._reflectionPass;
    if (wantAurora) {
      this.auroraMesh.position.set(0, Math.max(waterY, focusY * 0.45), 0);
      this.auroraMesh.rotation.y = -camCol * COL_ANGLE * 0.25;
      this.auroraMat.uniforms.uTime.value = t;
      this.auroraMat.uniforms.uStrength.value = preset.aurora * (1.0 - blackout * 0.5);
      this.auroraMat.uniforms.uColorLow.value.set(themeKey === 'apex' ? '#c084fc' : '#00f5a0');
      this.auroraMat.uniforms.uColorHigh.value.set(themeKey === 'apex' ? '#fbbf24' : '#9333ea');
    }

    // Lightning Bolts & Supercell Flash
    let extFlash = Math.max(0, Math.min(1.5, state?.lightningFlash || 0));
    if (preset.ambientBolts && extFlash < 0.05) {
      this._ambientBoltTimer -= frameDt;
      if (this._ambientBoltTimer <= 0) {
        this._ambientBoltTimer = 3.2 + this._nextBoltRand() * 3.8;
        this._ambientBoltFlash = 0.92;
        this._regenerateLightningGeometry(this._camPos.x, focusY, aspect);
      }
    }
    if (this._ambientBoltFlash > 0) {
      this._ambientBoltFlash = Math.max(0, this._ambientBoltFlash - frameDt * 3.8);
    }
    if (extFlash > this._prevFlash + 0.15) {
      this._regenerateLightningGeometry(this._camPos.x, focusY, aspect);
    }
    this._prevFlash = extFlash;

    const totalFlash = Math.max(extFlash, this._ambientBoltFlash);
    skyU.uLightning.value = totalFlash;
    vU.uLightning.value = totalFlash;
    const wantLightning = totalFlash > 0.04;
    this._savedLightningVis = wantLightning;
    this.lightningMesh.visible = wantLightning && !this._reflectionPass;
    if (wantLightning) {
      this.boltMat.uniforms.uFlash.value = Math.min(1.25, totalFlash * 1.15);
      this.boltMat.uniforms.uGlowColor.value.set(themeKey === 'apex' ? '#c084fc' : '#7dd3fc');
    }

    // 3D Tower-Shoulder Mist Wisps
    this.flankMistMesh.visible = !this._reflectionPass;
    this.flankMistMesh.material.color.copy(skyU.uMidSkyColor.value).lerp(skyU.uCloudRim.value, 0.34);
    this.flankMistMesh.material.opacity = (0.125 + preset.abyssMist * 0.05) * (1 - blackout * 0.55);
    const md = this._mistData;
    for (let i = 0; i < this._mistCount; i++) {
      const k = i * 8;
      const side = md[k];
      const baseLatX = md[k + 1];
      const depthZ = md[k + 2];
      const ySlot = md[k + 3];
      const w = md[k + 4];
      const h = md[k + 5];
      const spd = md[k + 6];
      const ph = md[k + 7];

      const swayX = Math.sin(t * 0.28 + ph) * 0.85 + wind * 0.35;
      const wrappedY = ((ySlot - focusY * 0.3 + t * spd * 0.35) % 12.0 + 12.0) % 12.0 - 3.2;
      const wy = Math.max(waterY + 2.35, focusY + wrappedY);

      this._tmpPos.set(this._camPos.x + baseLatX + swayX, wy, depthZ);
      this._tmpQuat.setFromAxisAngle(this._camFwd, side * 0.04 * Math.sin(t * 0.4 + ph));
      this._tmpScale.set(w, h, 1);
      this._tmpMat4.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
      this.flankMistMesh.setMatrixAt(i, this._tmpMat4);
    }
    this.flankMistMesh.instanceMatrix.needsUpdate = true;

    // 144 Bioluminescent Fireflies & Basal Water Spores
    const ffU = this.fireflyMat.uniforms;
    ffU.uTime.value = t;
    ffU.uFocusY.value = focusY;
    ffU.uWaterY.value = waterY;
    ffU.uCamYaw.value = camCol * COL_ANGLE;
    ffU.uWind.value = wind;
    ffU.uColorA.value.set(preset.moteA);
    ffU.uColorB.value.set(preset.moteB);
    ffU.uColorC.value.set(preset.moteC);
    ffU.uIntensity.value = themeKey === 'blizzard' ? 0.68 : 1.0;

    // Crashing White Sea-Spray Mist Plumes at `waterFloor`
    this._updateSeaSpray(t, frameDt, waterY, focusY, camCol, 1.0 - blackout * 0.5);

    if (this._reflectionPass) return;

    // Particulate Weather (Blizzard Snow Squalls or Foundry Furnace Embers)
    const showParticulates = preset.snow > 0 || preset.embers > 0;
    this.weatherPoints.visible = showParticulates;
    if (showParticulates) {
      const isEmbers = preset.embers > 0;
      this.weatherMat.color.set(isEmbers ? '#fb923c' : '#e0f2fe');
      this.weatherMat.size = isEmbers ? 0.12 : 0.15;
      this.weatherMat.opacity = isEmbers ? 0.88 : 0.82;
      const wp = this._weatherPos;
      const wm = this._weatherMeta;
      const gustPush = wind * 5.2;
      for (let i = 0; i < this._weatherCount; i++) {
        const i3 = i * 3;
        const spdY = wm[i3];
        const freq = wm[i3 + 1];
        const ph = wm[i3 + 2];

        if (isEmbers) {
          wp[i3 + 1] += spdY * 1.35 * frameDt;
          wp[i3] += (Math.sin(t * freq + ph) * 0.65 + gustPush * 0.5) * frameDt;
        } else {
          wp[i3 + 1] -= spdY * 1.85 * frameDt;
          wp[i3] += (Math.sin(t * freq + ph) * 0.55 + gustPush) * frameDt;
        }
        if (wp[i3 + 1] < -9.0) wp[i3 + 1] += 18.0;
        if (wp[i3 + 1] > 9.0) wp[i3 + 1] -= 18.0;
        if (wp[i3] < -8.0) wp[i3] += 16.0;
        if (wp[i3] > 8.0) wp[i3] -= 16.0;
      }
      this._weatherPosAttr.needsUpdate = true;
      this.weatherPoints.position.set(this._camPos.x, focusY, 0);
    }

    // Slanted Storm Rain & Crosswind Gust Ribbons
    const absWind = Math.abs(wind);
    const rainStrength = preset.rain;
    const gustStrength = absWind > 0.06 ? Math.min(1, absWind / 1.1) : 0;
    const targetStreakOpacity = Math.max(rainStrength * 0.36, gustStrength * 0.52);

    this.streakMat.opacity += (targetStreakOpacity - this.streakMat.opacity) * Math.min(1, frameDt * 8.0);
    this.streakLines.visible = this.streakMat.opacity > 0.012;
    if (this.streakLines.visible) {
      const sp = this._streakPos;
      const ss = this._streakState;
      const windDir = wind >= 0 ? 1 : -1;
      const rainSlantX = wind * 0.22 + 0.06;

      for (let i = 0; i < this._rainN + this._gustN; i++) {
        const k5 = i * 5;
        const k6 = i * 6;
        let sx = ss[k5];
        let sy = ss[k5 + 1];
        const sz = ss[k5 + 2];
        const len = ss[k5 + 3];
        const speed = ss[k5 + 4];

        if (i < this._rainN) {
          if (rainStrength <= 0.01) {
            sp[k6] = sp[k6 + 3] = 0;
            sp[k6 + 1] = sp[k6 + 4] = -999;
            sp[k6 + 2] = sp[k6 + 5] = 0;
            continue;
          }
          sy -= speed * frameDt;
          sx += wind * 3.8 * frameDt;
          if (sy < -8.5) sy += 17.0;
          if (sx < -8.5) sx += 17.0;
          if (sx > 8.5) sx -= 17.0;
          ss[k5] = sx;
          ss[k5 + 1] = sy;

          sp[k6] = sx;
          sp[k6 + 1] = sy;
          sp[k6 + 2] = sz;
          sp[k6 + 3] = sx - rainSlantX;
          sp[k6 + 4] = sy + len;
          sp[k6 + 5] = sz;
        } else {
          if (gustStrength <= 0.02) {
            sp[k6] = sp[k6 + 3] = 0;
            sp[k6 + 1] = sp[k6 + 4] = -999;
            sp[k6 + 2] = sp[k6 + 5] = 0;
            continue;
          }
          const v = windDir * speed * (0.45 + gustStrength * 0.85);
          sx += v * frameDt;
          if (sx > 8.5) sx -= 17.0;
          if (sx < -8.5) sx += 17.0;
          ss[k5] = sx;

          const effLen = len * (0.4 + gustStrength * 0.75);
          sp[k6] = sx;
          sp[k6 + 1] = sy;
          sp[k6 + 2] = sz;
          sp[k6 + 3] = sx - windDir * effLen;
          sp[k6 + 4] = sy + effLen * 0.05;
          sp[k6 + 5] = sz;
        }
      }
      this._streakPosAttr.needsUpdate = true;
      this.streakLines.position.set(this._camPos.x, focusY, 0);
    }
  }

  _updateSeaSpray(time, dt, waterY, focusY, camCol, eraScale) {
    const distAboveWater = focusY - waterY;
    const altFade = 1.0 - Math.max(0, Math.min(1, (distAboveWater - 9.0) / 8.0));
    if (altFade <= 0.01 || eraScale <= 0.01) {
      this.seaSprayPoints.visible = false;
      return;
    }
    this.seaSprayPoints.visible = true;
    this.seaSprayMat.uniforms.uGlobalOpacity.value = altFade * eraScale;

    const pos = this._sprayPos;
    const alpha = this._sprayAlpha;
    const size = this._spraySize;
    const rot = this._sprayRot;
    const st = this._sprayState;
    const camYaw = camCol * COL_ANGLE;

    for (let i = 0; i < this._sprayCount; i++) {
      const k = i * 7;
      const i3 = i * 3;
      const baseAng = st[k];
      const baseRad = st[k + 1];
      const cycSpd = st[k + 2];
      let phase = st[k + 3] + cycSpd * dt;
      if (phase >= 1.0) phase -= Math.floor(phase);
      st[k + 3] = phase;

      const peakH = st[k + 4];
      const baseSize = st[k + 5];
      const rotSpd = st[k + 6];
      const isDroplet = i >= 60;

      const swellGate = 0.55 + 0.45 * Math.sin(time * 1.65 + baseAng * 3.0);
      const ang = baseAng + Math.sin(time * 0.45 + i) * 0.08 - camYaw * 0.12;
      const expandR = baseRad + phase * (isDroplet ? 0.72 : 0.48);

      const arcY = isDroplet
        ? Math.sin(phase * Math.PI) * peakH - phase * phase * 0.18
        : Math.pow(phase, 0.62) * peakH;

      pos[i3] = Math.sin(ang) * expandR;
      pos[i3 + 1] = waterY + 0.04 + arcY * swellGate;
      pos[i3 + 2] = Math.cos(ang) * expandR;

      const lifeCurve = Math.sin(phase * Math.PI);
      alpha[i] = lifeCurve * swellGate * (isDroplet ? 0.68 : 0.48);
      size[i] = baseSize * (0.78 + phase * 0.72);
      rot[i] = phase * rotSpd * 3.0 + i * 0.7;
    }

    this._sprayPosAttr.needsUpdate = true;
    this._sprayAlphaAttr.needsUpdate = true;
    this._spraySizeAttr.needsUpdate = true;
    this._sprayRotAttr.needsUpdate = true;
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
    for (let i = 0; i < this._ownedGeometries.length; i++) {
      this._ownedGeometries[i].dispose();
    }
    for (let i = 0; i < this._ownedMaterials.length; i++) {
      this._ownedMaterials[i].dispose();
    }
    for (let i = 0; i < this._ownedTextures.length; i++) {
      this._ownedTextures[i].dispose();
    }
    this._ownedGeometries.length = 0;
    this._ownedMaterials.length = 0;
    this._ownedTextures.length = 0;
  }
}
