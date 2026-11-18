// ============================================================================
// Towering Waters: Gateway's Descent — 5-Biome Daylight/Twilight Sky,
// 3D Earth Watershed Vistas, Underwater Reefs, Waterfalls & Living Wildlife
// Module: `src/stormSky.js` (`StormAtmosphere`)
//
// 5 Distinct, Vibrant 3D Earth Water Locations + Ecosystem Healing (`0..1`):
//   1. `'canyon_river'` : Radiant cerulean-to-warm-gold morning sky, blazing sun
//                         disc & volumetric golden god-rays, enclosing layered
//                         red-rock sandstone canyon walls & mesas, 3D redwood/pine
//                         forests, 6 animated 3D cliffside waterfalls with rainbow
//                         plunge mist, & river boulders with frothy V-wakes!
//   2. `'alpine_lake'`  : Brilliant high-altitude azure sky, sunlit white cumulus
//                         clouds, majestic two-tone snow-capped granite peaks
//                         catching warm rose-gold alpenglow, pine-forested rocky
//                         islands, multi-arch stone aqueduct bridges & drifting
//                         alpine blossoms/pine needles!
//   3. `'mist_bayou'`   : Rich amber-violet sunset sky transitioning into warm
//                         twilight, giant arching cypress & mangrove trees with
//                         swaying Spanish moss, sunken ancient temple ruins with
//                         amber lanterns, 220 golden fireflies & 3D floating
//                         emerald lily pads with glowing lotus blossoms!
//   4. `'coral_sea'`    : Dazzling sunlit tropical sky, towering bright-white
//                         cumulus clouds, cream-limestone sea-arches, palm-topped
//                         white-sand atolls, circling seabirds, AND visible 3D
//                         underwater coral reef shelves & gliding manta rays!
//   5. `'storm_ocean'`  : Electric polar tempest sky crowned with shimmering
//                         emerald-violet Polar Aurora curtains, forked lightning,
//                         towering translucent turquoise glacial icebergs &
//                         distant offshore siphon rigs!
//
// Zero per-frame heap/GC allocations; 100% offline procedural textures & meshes.
// ============================================================================

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const DEFAULT_COLS = 20;
const DEFAULT_TOWER_RADIUS = 3.75;
const DEFAULT_FLOOR_HEIGHT = 1.50;

export const BIOME_KEYS = Object.freeze([
  'canyon_river',
  'alpine_lake',
  'mist_bayou',
  'coral_sea',
  'storm_ocean',
]);

const BIOME_ALIAS_LOOKUP = Object.freeze({
  canyon_river: 'canyon_river',
  canyon: 'canyon_river',
  river: 'canyon_river',
  redwood: 'canyon_river',
  rapids: 'canyon_river',
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

export function resolveBiomeKey(raw, towerId = 1) {
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (BIOME_ALIAS_LOOKUP[k]) return BIOME_ALIAS_LOOKUP[k];
  }
  const idx = Math.floor((Math.max(1, Number(towerId) || 1) - 1) / 2) % BIOME_KEYS.length;
  return BIOME_KEYS[idx];
}

const CANONICAL_ATMOSPHERE_PRESETS = {
  canyon_river: Object.freeze({
    vista: 'canyon_river',
    skyMode: 0, // Golden Morning Daylight
    zenith: '#1a62b8',
    midSky: '#4ea8e8',
    horizon: '#f7c278',
    horizonMist: '#fae0aa',
    fogColor: '#ebd0a2',
    bgColor: '#4ea8e8',
    cloudDark: '#8ba8c7',
    cloudMid: '#e8eff7',
    cloudRim: '#fff3cc',
    celestialTint: '#fff6d6',
    corona: '#ffcf6e',
    sunGlow: '#ffb84d',
    mountNear: '#b84b29',
    mountFar: '#d97a4e',
    alpenglow: '#ffd28a',
    beacon: '#ffb02e',
    beaconAlt: '#2ef5c8',
    moteA: '#ffe58f',
    moteB: '#ffd166',
    moteC: '#80ffdb',
    godRayColor: '#ffe299',
    godRays: 0.85,
    rainbowBase: 0.34,
    aurora: 0.0,
    starAmt: 0.0,
    cloudCover: 0.48,
    celestialAmt: 1.25,
    sunDisc: 1.0,
    abyssMist: 0.36,
    blossoms: 0,
    iceCrystals: 0,
    rain: 0.0,
    ambientBolts: 0,
    birds: 1,
    fireflyBoost: 0.55,
  }),

  alpine_lake: Object.freeze({
    vista: 'alpine_lake',
    skyMode: 1, // Crisp High-Altitude Azure & Rose-Gold Alpenglow
    zenith: '#124da0',
    midSky: '#3f93eb',
    horizon: '#e8cde0',
    horizonMist: '#f2dce8',
    fogColor: '#cfe2f5',
    bgColor: '#3f93eb',
    cloudDark: '#8ea8cc',
    cloudMid: '#eef4fc',
    cloudRim: '#ffe4ec',
    celestialTint: '#fffaf5',
    corona: '#ffd6e5',
    sunGlow: '#ffb3c6',
    mountNear: '#586b82',
    mountFar: '#7d93ad',
    alpenglow: '#ffafcc',
    beacon: '#38bdf8',
    beaconAlt: '#fbbf24',
    moteA: '#ffd6e7',
    moteB: '#ffffff',
    moteC: '#9bf6ff',
    godRayColor: '#ffeef5',
    godRays: 0.42,
    rainbowBase: 0.14,
    aurora: 0.0,
    starAmt: 0.0,
    cloudCover: 0.52,
    celestialAmt: 1.18,
    sunDisc: 1.0,
    abyssMist: 0.24,
    blossoms: 1,
    iceCrystals: 0,
    rain: 0.0,
    ambientBolts: 0,
    birds: 1,
    fireflyBoost: 0.48,
  }),

  mist_bayou: Object.freeze({
    vista: 'mist_bayou',
    skyMode: 2, // Rich Amber-Violet Sunset & Bioluminescent Dusk
    zenith: '#231847',
    midSky: '#72336c',
    horizon: '#eb7d3c',
    horizonMist: '#cfa06e',
    fogColor: '#8d6e63',
    bgColor: '#5c2c5d',
    cloudDark: '#3d2247',
    cloudMid: '#9a465c',
    cloudRim: '#ffc978',
    celestialTint: '#ffcf87',
    corona: '#ff8c42',
    sunGlow: '#ff6b35',
    mountNear: '#273b2c',
    mountFar: '#4c5c43',
    alpenglow: '#ff9e5e',
    beacon: '#fbbf24',
    beaconAlt: '#34f5c5',
    moteA: '#ffd147',
    moteB: '#ffb703',
    moteC: '#52ffb8',
    godRayColor: '#ffb566',
    godRays: 0.56,
    rainbowBase: 0.08,
    aurora: 0.0,
    starAmt: 0.42,
    cloudCover: 0.58,
    celestialAmt: 1.15,
    sunDisc: 1.0,
    abyssMist: 0.62,
    blossoms: 0,
    iceCrystals: 0,
    rain: 0.0,
    ambientBolts: 0,
    birds: 1,
    fireflyBoost: 1.38,
  }),

  coral_sea: Object.freeze({
    vista: 'coral_sea',
    skyMode: 3, // Dazzling Sunlit Tropical Noon Lagoon
    zenith: '#0866c6',
    midSky: '#29acef',
    horizon: '#8ef0fc',
    horizonMist: '#c8f8fe',
    fogColor: '#aceefb',
    bgColor: '#29acef',
    cloudDark: '#8cc0de',
    cloudMid: '#f2f9ff',
    cloudRim: '#ffffff',
    celestialTint: '#fffef2',
    corona: '#fff0a8',
    sunGlow: '#ffe07d',
    mountNear: '#dcd0b4',
    mountFar: '#bce3e6',
    alpenglow: '#fff5cc',
    beacon: '#22f5e8',
    beaconAlt: '#ff8fab',
    moteA: '#72efdd',
    moteB: '#fff3b0',
    moteC: '#48bfe3',
    godRayColor: '#fff6cc',
    godRays: 0.64,
    rainbowBase: 0.22,
    aurora: 0.0,
    starAmt: 0.0,
    cloudCover: 0.54,
    celestialAmt: 1.30,
    sunDisc: 1.0,
    abyssMist: 0.18,
    blossoms: 0,
    iceCrystals: 0,
    rain: 0.0,
    ambientBolts: 0,
    birds: 1,
    fireflyBoost: 0.45,
  }),

  storm_ocean: Object.freeze({
    vista: 'storm_ocean',
    skyMode: 4, // Polar Aurora & Electric Tempest Ocean Finale
    zenith: '#0a1f3a',
    midSky: '#154266',
    horizon: '#28728a',
    horizonMist: '#3e8ca3',
    fogColor: '#1f546e',
    bgColor: '#113554',
    cloudDark: '#0d263d',
    cloudMid: '#245273',
    cloudRim: '#bef8ff',
    celestialTint: '#e6fcff',
    corona: '#5eead4',
    sunGlow: '#38bdf8',
    mountNear: '#1c5875',
    mountFar: '#388aa8',
    alpenglow: '#67e8f9',
    beacon: '#00f5c8',
    beaconAlt: '#c084fc',
    moteA: '#00f5c8',
    moteB: '#7dd3fc',
    moteC: '#c084fc',
    godRayColor: '#5efce8',
    godRays: 0.22,
    rainbowBase: 0.0,
    aurora: 1.0,
    starAmt: 0.58,
    cloudCover: 0.74,
    celestialAmt: 1.06,
    sunDisc: 0.0, // crisp polar moon & cloud break
    abyssMist: 0.44,
    blossoms: 0,
    iceCrystals: 1,
    rain: 0.38,
    ambientBolts: 1,
    birds: 0,
    fireflyBoost: 0.85,
  }),
};

export const THEME_ATMOSPHERE_PRESETS = Object.freeze({
  ...CANONICAL_ATMOSPHERE_PRESETS,
  foundry: CANONICAL_ATMOSPHERE_PRESETS.canyon_river,
  piston: CANONICAL_ATMOSPHERE_PRESETS.canyon_river,
  blizzard: CANONICAL_ATMOSPHERE_PRESETS.alpine_lake,
  mist: CANONICAL_ATMOSPHERE_PRESETS.mist_bayou,
  sinking: CANONICAL_ATMOSPHERE_PRESETS.coral_sea,
  prism: CANONICAL_ATMOSPHERE_PRESETS.coral_sea,
  blackout: CANONICAL_ATMOSPHERE_PRESETS.storm_ocean,
  apex: CANONICAL_ATMOSPHERE_PRESETS.storm_ocean,
});

export const BIOME_LIGHTING_PRESETS = Object.freeze({
  canyon_river: Object.freeze({
    isDaylight: true,
    keyColor: '#fff0cc',
    keyIntensity: 2.55,
    hemiSky: '#7cc4f8',
    hemiGround: '#b86236',
    hemiIntensity: 0.92,
    fillColor: '#4fd8c4',
    fillIntensity: 0.58,
    rimColor: '#ffd27d',
    rimIntensity: 1.05,
    fogColor: '#ebd0a2',
    bgColor: '#4ea8e8',
  }),
  alpine_lake: Object.freeze({
    isDaylight: true,
    keyColor: '#fff6ee',
    keyIntensity: 2.60,
    hemiSky: '#78b8ff',
    hemiGround: '#4a6b8a',
    hemiIntensity: 0.96,
    fillColor: '#67e8f9',
    fillIntensity: 0.62,
    rimColor: '#ffc2d4',
    rimIntensity: 1.02,
    fogColor: '#cfe2f5',
    bgColor: '#3f93eb',
  }),
  mist_bayou: Object.freeze({
    isDaylight: false,
    keyColor: '#ffb870',
    keyIntensity: 2.28,
    hemiSky: '#9d5c88',
    hemiGround: '#243b2c',
    hemiIntensity: 0.78,
    fillColor: '#34d399',
    fillIntensity: 0.54,
    rimColor: '#fbbf24',
    rimIntensity: 1.08,
    fogColor: '#8d6e63',
    bgColor: '#5c2c5d',
  }),
  coral_sea: Object.freeze({
    isDaylight: true,
    keyColor: '#fffbe8',
    keyIntensity: 2.72,
    hemiSky: '#68d4ff',
    hemiGround: '#1cc8c0',
    hemiIntensity: 1.05,
    fillColor: '#22f5e8',
    fillIntensity: 0.72,
    rimColor: '#fff0a8',
    rimIntensity: 0.98,
    fogColor: '#aceefb',
    bgColor: '#29acef',
  }),
  storm_ocean: Object.freeze({
    isDaylight: false,
    keyColor: '#d4f4ff',
    keyIntensity: 2.22,
    hemiSky: '#3b82a6',
    hemiGround: '#0c283e',
    hemiIntensity: 0.72,
    fillColor: '#00f5c4',
    fillIntensity: 0.56,
    rimColor: '#a855f7',
    rimIntensity: 1.04,
    fogColor: '#1f546e',
    bgColor: '#113554',
  }),
});

// ============================================================================
// FAST PERIODIC NOISE & HIGH-RES PROCEDURAL TEXTURE BAKERS (ZERO NETWORK I/O)
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

const PERM_A = buildPermTable(20260518);
const PERM_B = buildPermTable(51820269);

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

// 1024x512 Seamless Cumulus, Cirrus, Sedimentary Strata & Aurora Curtain Panorama
function createHighResCloudPanoramaTexture(w = 1024, h = 512) {
  const nCells = w * h;
  const heightField = new Float32Array(nCells);
  const wispField = new Float32Array(nCells);
  const strataField = new Float32Array(nCells);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;

      const wx = fastPeriodicNoise(u, v, 8, 4, PERM_A, 11) - 0.5;
      const wy = fastPeriodicNoise(u, v, 8, 4, PERM_B, 29) - 0.5;
      const uw = u + wx * 0.052 + (v - 0.3) * 0.032;
      const vw = v + wy * 0.042;

      const o1 = fastPeriodicNoise(uw, vw, 4, 2, PERM_A, 3);
      const o2 = 1 - Math.abs(2 * fastPeriodicNoise(uw, vw, 8, 4, PERM_B, 17) - 1);
      const o3 = 1 - Math.abs(2 * fastPeriodicNoise(uw, vw, 16, 8, PERM_A, 43) - 1);
      const o4 = 1 - Math.abs(2 * fastPeriodicNoise(uw, vw, 32, 16, PERM_B, 71) - 1);
      const o5 = fastPeriodicNoise(uw, vw, 64, 32, PERM_A, 109);
      const o6 = fastPeriodicNoise(u, v, 128, 64, PERM_B, 151);

      const macro = o1 * 0.38 + o2 * 0.28 + o3 * 0.17 + o4 * 0.09 + o5 * 0.05 + o6 * 0.03;

      const shearU = u + v * 0.18;
      const f1 = 1 - Math.abs(2 * fastPeriodicNoise(shearU, v, 16, 8, PERM_B, 193) - 1);
      const f2 = fastPeriodicNoise(shearU, v, 32, 16, PERM_A, 211);
      const f3 = fastPeriodicNoise(shearU, v, 64, 32, PERM_B, 239);
      const cascade = fastPeriodicNoise(u * 0.5, v * 2.0, 32, 32, PERM_A, 97);

      const idx = y * w + x;
      heightField[idx] = macro;
      wispField[idx] = Math.max(0, Math.min(1, f1 * 0.44 + f2 * 0.28 + f3 * 0.16 + cascade * 0.12));

      // Horizontal sedimentary canyon strata + vertical waterfall/aurora streaks
      const band = 0.5 + 0.5 * Math.sin(v * 68.0 + wx * 3.2);
      const n2 = fastPeriodicNoise(u, v, 32, 32, PERM_B, 131);
      strataField[idx] = Math.max(0, Math.min(1, band * 0.62 + n2 * 0.38));
    }
  }

  const data = new Uint8Array(nCells * 4);
  for (let y = 0; y < h; y++) {
    const yUp = Math.min(h - 1, y + 2);
    const yDn = Math.max(0, y - 2);
    for (let x = 0; x < w; x++) {
      const xR = (x + 2) & (w - 1);
      const xL = (x - 2 + w) & (w - 1);
      const idx = y * w + x;
      const c = heightField[idx];
      const dx = heightField[y * w + xL] - heightField[y * w + xR];
      const dy = heightField[yDn * w + x] - heightField[yUp * w + x];
      const slope = Math.max(0, Math.min(1, 0.5 + (dx * 1.9 + dy * 2.4)));

      const o4 = idx * 4;
      data[o4] = Math.round(Math.max(0, Math.min(1, c)) * 255);
      data[o4 + 1] = Math.round(slope * 255);
      data[o4 + 2] = Math.round(wispField[idx] * 255);
      data[o4 + 3] = Math.round(strataField[idx] * 255);
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

// 512x512 Dual Celestial Texture: Crisp Lunar/Ice-Moon Relief in RGB + Smooth Disc Alpha
// (In daylight/sunset biomes `uSunDisc > 0.5`, the shader renders a physical radiant solar disc + aureole!)
function createCelestialDiscTexture(size = 512) {
  const data = new Uint8Array(size * size * 4);
  const craters = [];
  let seed = 19690720;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 18; i++) {
    const ang = rnd() * TWO_PI;
    const rad = Math.sqrt(rnd()) * 0.76;
    craters.push([Math.cos(ang) * rad, Math.sin(ang) * rad, 0.045 + rnd() * 0.085, 0.18 + rnd() * 0.22]);
  }

  const half = size * 0.5;
  const discR = half * 0.95;

  for (let py = 0; py < size; py++) {
    const ny = (half - py) / discR;
    for (let px = 0; px < size; px++) {
      const nx = (px - half) / discR;
      const r2 = nx * nx + ny * ny;
      const idx = (py * size + px) * 4;
      if (r2 >= 1.04) {
        data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 0;
        continue;
      }
      const r = Math.sqrt(r2);
      // Smooth anti-aliased atmospheric limb feathering
      const alpha = r <= 0.92 ? 1.0 : Math.pow(Math.max(0, 1.0 - (r - 0.92) / 0.12), 1.6);
      const nz = Math.sqrt(Math.max(0.02, 1.0 - Math.min(1.0, r2)));
      const su = 0.5 + (Math.atan2(nx, nz) / Math.PI) * 0.5;
      const sv = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;
      const reg1 = fastPeriodicNoise(su, sv, 8, 8, PERM_A, 19);
      const reg2 = fastPeriodicNoise(su, sv, 24, 24, PERM_B, 57);
      let shade = 0;
      for (let k = 0; k < craters.length; k++) {
        const [cx, cy, cr, cd] = craters[k];
        const dist = Math.hypot(nx - cx, ny - cy);
        if (dist < cr * 1.25) {
          const q = dist / cr;
          shade += q < 0.85 ? (1.0 - q * q) * -0.025 * cd : Math.sin(((q - 0.85) / 0.40) * Math.PI) * 0.018 * cd;
        }
      }
      // Subtle pearlescent lunar maria (high floor >= 0.82 so moon glows luminous silver, never blotchy grey!)
      const mare = Math.max(0, Math.min(1, (reg1 - 0.46) * 1.15)) * 0.095;
      const limb = 0.90 + 0.10 * Math.pow(nz, 0.32);
      const lum = Math.max(0.82, Math.min(1.0, (0.985 - mare + (reg2 - 0.5) * 0.025 + shade) * limb));
      data[idx] = Math.round(lum * 246);
      data[idx + 1] = Math.round(lum * 252);
      data[idx + 2] = Math.round(Math.min(1, lum * 1.03) * 255);
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
    g.addColorStop(0, `rgba(245, 250, 255, ${a})`);
    g.addColorStop(0.45, `rgba(218, 234, 250, ${a * 0.48})`);
    g.addColorStop(0.8, `rgba(185, 212, 240, ${a * 0.12})`);
    g.addColorStop(1, 'rgba(185, 212, 240, 0)');
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
  g.addColorStop(0.22, 'rgba(250,252,255,0.86)');
  g.addColorStop(0.54, 'rgba(210,240,255,0.28)');
  g.addColorStop(1, 'rgba(210,240,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// MULTI-MATERIAL 3D WATERSHED VISTA BUILDER (1 MERGED DRAW CALL PER BIOME!)
// Attributes:
//   `position` : vec3 world local to waterY
//   `normal`   : vec3 smooth/chiseled surface normal
//   `aVista`   : vec4(layer 0..1, heightRatio 0..1, matKind, detailParam)
//                matKind: 0 = Stratified Rock / Mountain / Beach
//                         1 = Foliage / Redwood / Pine / Cypress / Palm / Moss
//                         2 = Translucent Glacial Iceberg / Sea-Ice
//                         3 = Carved Masonry / Aqueduct / Temple Ruin / Siphon Rig
//                         4 = Emissive Lantern / Beacon / Glowing Lotus Heart
//   `aColor`   : vec3 linear vertex albedo tint
// ============================================================================

const _tmpCol = new THREE.Color();

class WatershedGeometryBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uvs = [];
    this.vista = [];
    this.col = [];
    this.idx = [];
  }

  _pushGeo(geo, mat4, layer, maxH, matKind, detailParam, hexOrCol, topHex = null, uvRect = null) {
    const gPos = geo.attributes.position;
    const gNorm = geo.attributes.normal;
    const gUv = geo.attributes.uv;
    const gIdx = geo.index;
    const baseVertex = this.pos.length / 3;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const normalMat = new THREE.Matrix3().getNormalMatrix(mat4);

    _tmpCol.set(hexOrCol);
    const r0 = _tmpCol.r;
    const g0 = _tmpCol.g;
    const b0 = _tmpCol.b;

    let r1 = r0;
    let g1 = g0;
    let b1 = b0;
    if (topHex) {
      _tmpCol.set(topHex);
      r1 = _tmpCol.r;
      g1 = _tmpCol.g;
      b1 = _tmpCol.b;
    }

    for (let i = 0; i < gPos.count; i++) {
      v.fromBufferAttribute(gPos, i).applyMatrix4(mat4);
      n.fromBufferAttribute(gNorm, i).applyMatrix3(normalMat).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.norm.push(n.x, n.y, n.z);

      let u = gUv ? gUv.getX(i) : 0.5;
      let uvV = gUv ? gUv.getY(i) : 0.5;
      if (uvRect) {
        u = uvRect[0] + u * uvRect[2];
        uvV = uvRect[1] + uvV * uvRect[3];
      }
      this.uvs.push(u, uvV);

      const hr = Math.max(0, Math.min(1, (v.y + 1.2) / Math.max(1.5, maxH)));
      this.vista.push(layer, hr, matKind, detailParam);
      this.col.push(
        r0 + (r1 - r0) * hr,
        g0 + (g1 - g0) * hr,
        b0 + (b1 - b0) * hr
      );
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

  _pushDoubleSidedCard(geo, mat4, layer, maxH, matKind, detailParam, hexOrCol, topHex = null, uvRect = null, crownCenter = null) {
    const gPos = geo.attributes.position;
    const gNorm = geo.attributes.normal;
    const gUv = geo.attributes.uv;
    const gIdx = geo.index;
    const vCount = gPos.count;
    const frontBase = this.pos.length / 3;
    const backBase = frontBase + vCount;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const cDir = new THREE.Vector3();
    const normalMat = new THREE.Matrix3().getNormalMatrix(mat4);

    _tmpCol.set(hexOrCol);
    const r0 = _tmpCol.r;
    const g0 = _tmpCol.g;
    const b0 = _tmpCol.b;
    let r1 = r0;
    let g1 = g0;
    let b1 = b0;
    if (topHex) {
      _tmpCol.set(topHex);
      r1 = _tmpCol.r;
      g1 = _tmpCol.g;
      b1 = _tmpCol.b;
    }

    for (let sidePass = 0; sidePass < 2; sidePass++) {
      const sign = sidePass === 0 ? 1 : -1;
      for (let i = 0; i < vCount; i++) {
        v.fromBufferAttribute(gPos, i).applyMatrix4(mat4);
        n.fromBufferAttribute(gNorm, i).applyMatrix3(normalMat).multiplyScalar(sign).normalize();
        if (crownCenter) {
          cDir.subVectors(v, crownCenter);
          if (cDir.lengthSq() > 1e-4) {
            cDir.normalize();
            n.lerp(cDir, 0.72).normalize();
          }
        }
        this.pos.push(v.x, v.y, v.z);
        this.norm.push(n.x, n.y, n.z);

        let u = gUv ? gUv.getX(i) : 0.5;
        let uvV = gUv ? gUv.getY(i) : 0.5;
        if (uvRect) {
          u = uvRect[0] + u * uvRect[2];
          uvV = uvRect[1] + uvV * uvRect[3];
        }
        this.uvs.push(u, uvV);

        const hr = Math.max(0, Math.min(1, (v.y + 1.2) / Math.max(1.5, maxH)));
        this.vista.push(layer, hr, matKind, detailParam);
        this.col.push(
          r0 + (r1 - r0) * hr,
          g0 + (g1 - g0) * hr,
          b0 + (b1 - b0) * hr
        );
      }
    }

    if (gIdx) {
      for (let i = 0; i < gIdx.count; i += 3) {
        const a = gIdx.getX(i);
        const b = gIdx.getX(i + 1);
        const c = gIdx.getX(i + 2);
        this.idx.push(frontBase + a, frontBase + b, frontBase + c);
        this.idx.push(backBase + a, backBase + c, backBase + b);
      }
    }
    geo.dispose();
  }

  // 1. Layered Red-Rock Sandstone Canyon Mesa & Gorge Wall ('canyon_river')
  addSandstoneMesa(ang, radius, width, height, seedVal, layer, withCrownTrees = true) {
    const buildButte = (offAng, radOff, wS, hS, sOff, baseHex, capHex) => {
      const w = width * wS;
      const h = height * hS;
      // Flat-topped terraced sandstone mesa cylinder (NEVER a pointed cone!)
      const geo = new THREE.CylinderGeometry(w * 0.62, w * 1.12, h, 12, 8, false);
      geo.translate(0, h * 0.5 - 1.2, 0);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let vx = p.getX(i);
        let vy = p.getY(i);
        let vz = p.getZ(i);
        const hFrac = Math.max(0, Math.min(1, (vy + 1.2) / h));
        const theta = Math.atan2(vz, vx);
        const u = (theta + Math.PI) / TWO_PI;
        const n1 = fastPeriodicNoise(u, hFrac * 0.9, 8, 8, PERM_A, (seedVal + sOff) & 255);
        const n2 = fastPeriodicNoise(u, hFrac * 2.2, 16, 16, PERM_B, (seedVal * 3 + sOff) & 255);
        const crag = 1.0 - Math.abs(2.0 * n1 - 1.0);
        // Chiseled sedimentary horizontal sandstone benches & canyon buttresses
        const bench = Math.sin(hFrac * 16.0) * 0.09 + Math.sin(hFrac * 33.0) * 0.04;
        const radialScale = 0.76 + (crag * 0.34 + n2 * 0.16 + bench);
        vx *= radialScale * 1.14;
        vz *= radialScale * 0.80;
        if (hFrac > 0.94) {
          vy = h - 1.2 + (n1 - 0.5) * 0.55;
        }
        p.setXYZ(i, vx, vy, vz);
      }
      geo.computeVertexNormals();
      const a = ang + offAng;
      const r = radius + radOff;
      const m = new THREE.Matrix4()
        .makeTranslation(Math.sin(a) * r, 0, Math.cos(a) * r)
        .multiply(new THREE.Matrix4().makeRotationY(a + sOff * 0.3));
      this._pushGeo(geo, m, layer, h, 0, 0.85, baseHex, capHex);
    };

    // Rich Zion / Sedona crimson-terracotta & fiery Navajo-sandstone palette!
    buildButte(0, 0, 1.0, 1.0, 0, '#7c2012', '#e07238');
    buildButte(0.055, 2.8, 0.78, 0.74, 31, '#6b190d', '#cf5f29');
    buildButte(-0.048, -1.6, 0.66, 0.56, 67, '#8f2916', '#ec8a49');

    if (withCrownTrees) {
      // Towering 4-tier Coast Redwood & Ponderosa Pine forests crowning the canyon rims!
      this.addRedwoodPineCluster(ang, radius, height - 1.35, 7, width * 0.46, 4.2, 7.6, seedVal + 11, layer);
      this.addRedwoodPineCluster(ang + 0.055, radius + 2.5, height * 0.74 - 1.35, 5, width * 0.34, 3.4, 5.8, seedVal + 47, layer);
    }
  }

  // 2. 3D Towering Coast Redwood / Alpine Conifer Forest Cluster (`matKind = 1`)
  addRedwoodPineCluster(ang, radius, baseY, count, spreadR, minH, maxH, seedVal, layer, snowDusted = false) {
    let s = (seedVal * 747796405 + 2891336453) >>> 0;
    const rnd = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const cx = Math.sin(ang) * radius;
    const cz = Math.cos(ang) * radius;

    for (let i = 0; i < count; i++) {
      const oa = rnd() * TWO_PI;
      const or = Math.sqrt(rnd()) * spreadR;
      const tx = cx + Math.cos(oa) * or;
      const tz = cz + Math.sin(oa) * or;
      const th = minH + rnd() * (maxH - minH);
      const tw = th * (0.22 + rnd() * 0.07);
      const ty = baseY - rnd() * 0.45;

      // Rich cinnamon-redwood / mountain bark trunk
      const trunk = new THREE.CylinderGeometry(tw * 0.13, tw * 0.24, th * 0.40, 6, 1, true);
      trunk.translate(0, th * 0.20, 0);
      const mTrunk = new THREE.Matrix4().makeTranslation(tx, ty, tz);
      this._pushGeo(trunk, mTrunk, layer, ty + th, 3, 0.0, '#4f2414', '#703820');

      // 4 stacked lush evergreen bough tiers
      const foliageLow = snowDusted ? '#133b2f' : '#0f3d22';
      const foliageHigh = snowDusted ? '#dff4f8' : '#2e7d3b';
      for (let tier = 0; tier < 4; tier++) {
        const tf = tier / 3;
        const coneH = th * (0.38 - tier * 0.055);
        const coneR = tw * (1.08 - tier * 0.20);
        const coneY = ty + th * (0.26 + tier * 0.19);
        const cone = new THREE.ConeGeometry(coneR, coneH, 7, 1, false);
        cone.translate(0, coneH * 0.5, 0);
        const mCone = new THREE.Matrix4()
          .makeTranslation(tx, coneY, tz)
          .multiply(new THREE.Matrix4().makeRotationY(rnd() * TWO_PI));
        this._pushGeo(
          cone,
          mCone,
          layer,
          ty + th + 1.0,
          1,
          snowDusted ? 0.55 : 0.22,
          foliageLow,
          tf > 0.55 ? foliageHigh : '#1f6332'
        );
      }
    }
  }

  // 3. Majestic Two-Tone Snow-Capped Granite Alpine Peak ('alpine_lake', exposed slate-granite + snowcaps!)
  addAlpineGranitePeak(ang, radius, width, height, seedVal, layer, snowCapped = true) {
    const buildHorn = (offAng, radOff, wS, hS, sOff) => {
      const w = width * wS;
      const h = height * hS;
      const geo = new THREE.CylinderGeometry(w * 0.08, w * 1.18, h, 11, 7, true);
      geo.translate(0, h * 0.5 - 1.3, 0);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let vx = p.getX(i);
        let vy = p.getY(i);
        let vz = p.getZ(i);
        const hFrac = Math.max(0, (vy + 1.3) / h);
        const theta = Math.atan2(vz, vx);
        const u = (theta + Math.PI) / TWO_PI;
        const n1 = fastPeriodicNoise(u, hFrac * 0.85, 8, 8, PERM_A, (seedVal + sOff) & 255);
        const n2 = fastPeriodicNoise(u, hFrac * 1.9, 16, 16, PERM_B, (seedVal * 5 + sOff) & 255);
        // Chiseled glacial arête ridges & granite couloirs
        const arete = 1.0 - Math.abs(2.0 * n1 - 1.0);
        const disp = 0.60 + (Math.pow(arete, 1.4) * 0.72 + n2 * 0.26) * (1.16 - hFrac * 0.30);
        vx = vx * disp + hFrac * w * (((seedVal + sOff) % 5) - 2) * 0.14;
        vz *= disp * 0.82;
        if (hFrac > 0.70) {
          vy += (arete - 0.45) * h * 0.20;
        }
        p.setXYZ(i, vx, vy, vz);
      }
      geo.computeVertexNormals();
      const a = ang + offAng;
      const r = radius + radOff;
      const m = new THREE.Matrix4()
        .makeTranslation(Math.sin(a) * r, 0, Math.cos(a) * r)
        .multiply(new THREE.Matrix4().makeRotationY(a + sOff * 0.35));
      // Rich blue-slate granite rock base ('#2e4057' -> '#5c738f') + snowpack mask when snowCapped = true!
      this._pushGeo(geo, m, layer, h, 0, snowCapped ? 1.0 : 0.25, '#2d3f56', '#607894');
    };

    buildHorn(0, 0, 1.0, 1.0, 0);
    buildHorn(0.048, 2.4, 0.74, 0.72, 29);
    buildHorn(-0.044, -1.6, 0.65, 0.58, 73);
  }

  // 4. Multi-Arch Carved Stone Aqueduct Bridge ('alpine_lake')
  addStoneAqueductBridge(ang, radius, totalSpan, deckH, archCount, layer) {
    const cx = Math.sin(ang) * radius;
    const cz = Math.cos(ang) * radius;
    const mBase = new THREE.Matrix4()
      .makeTranslation(cx, 0, cz)
      .multiply(new THREE.Matrix4().makeRotationY(ang));

    const bayW = totalSpan / archCount;
    const pierW = bayW * 0.24;
    const depth = 1.65;

    // Upper aqueduct water-channel deck & cornice
    const deck = new THREE.BoxGeometry(totalSpan + pierW, deckH * 0.18, depth * 1.15);
    deck.translate(0, deckH * 0.91, 0);
    this._pushGeo(deck, mBase, layer, deckH + 1.5, 3, 0.25, '#b8c4d4', '#e8eef5');

    // Arched piers
    for (let i = 0; i <= archCount; i++) {
      const px = -totalSpan * 0.5 + i * bayW;
      const pier = new THREE.BoxGeometry(pierW, deckH * 0.88, depth);
      pier.translate(px, deckH * 0.44 - 0.5, 0);
      this._pushGeo(pier, mBase, layer, deckH + 1.5, 3, 0.25, '#8a99ad', '#cfd8e6');

      if (i < archCount) {
        const archX = px + bayW * 0.5;
        const arch = new THREE.TorusGeometry(bayW * 0.38, pierW * 0.46, 5, 10, Math.PI);
        arch.translate(archX, deckH * 0.62, 0);
        this._pushGeo(arch, mBase, layer, deckH + 1.5, 3, 0.25, '#9aa8bc', '#dee6f2');
      }
    }
  }

  // 5. Giant Arching Bayou Cypress & Mangrove Tree with Draped Tapered Spanish Moss ('mist_bayou')
  addGiantCypressTree(ang, radius, height, seedVal, layer) {
    const cx = Math.sin(ang) * radius;
    const cz = Math.cos(ang) * radius;
    let s = (seedVal * 1103515245 + 12345) >>> 0;
    const rnd = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };

    // Fluted buttress cypress trunk with organic curve & bark twist
    const trunkR = height * 0.076;
    const trunk = new THREE.CylinderGeometry(trunkR * 0.42, trunkR * 2.15, height * 0.74, 10, 5, true);
    const tp = trunk.attributes.position;
    for (let ti = 0; ti < tp.count; ti++) {
      let vx = tp.getX(ti);
      const vy = tp.getY(ti) + height * 0.37 - 0.8;
      let vz = tp.getZ(ti);
      const hFrac = Math.max(0, (vy + 0.8) / (height * 0.74));
      const th = Math.atan2(vz, vx);
      // Fluted cypress buttress ribs near water base
      const flute = 1.0 + (1.0 - hFrac) * (1.0 - hFrac) * 0.36 * Math.cos(th * 5.0 + seedVal);
      const sway = Math.sin(hFrac * Math.PI * 0.85 + seedVal * 0.3) * height * 0.035;
      tp.setXYZ(ti, vx * flute + sway, vy, vz * flute);
    }
    trunk.computeVertexNormals();
    const mCenter = new THREE.Matrix4().makeTranslation(cx, 0, cz);
    this._pushGeo(trunk, mCenter, layer, height, 3, 0.0, '#261912', '#593c28');

    // Arching mangrove prop roots + cypress knees emerging from bayou water
    for (let rIdx = 0; rIdx < 6; rIdx++) {
      const ra = (rIdx / 6) * TWO_PI + rnd() * 0.35;
      const rootArc = new THREE.TorusGeometry(trunkR * 2.35, trunkR * 0.20, 5, 9, Math.PI * 0.72);
      const mRoot = new THREE.Matrix4()
        .makeTranslation(cx, -0.18, cz)
        .multiply(new THREE.Matrix4().makeRotationY(ra))
        .multiply(new THREE.Matrix4().makeRotationZ(0.28));
      this._pushGeo(rootArc, mRoot, layer, height, 3, 0.0, '#221610', '#4a3222');
    }

    // Sweeping Gnarled Boughs + Layered Tufted Twilight Canopy & Draped S-Curved Spanish Moss!
    const boughs = 7;
    for (let l = 0; l < boughs; l++) {
      const la = (l / boughs) * TWO_PI + rnd() * 0.42;
      const reach = l === 0 ? height * 0.04 : height * (0.16 + rnd() * 0.16);
      const lx = cx + Math.cos(la) * reach;
      const lz = cz + Math.sin(la) * reach;
      const ly = height * (l === 0 ? 0.82 : 0.60 + (l % 3) * 0.08 + rnd() * 0.07);
      const domeR = height * (l === 0 ? 0.25 : 0.17 + rnd() * 0.06);

      // Visible gnarled wooden branch reaching from trunk out to canopy cluster
      if (l > 0) {
        const bLen = Math.hypot(reach, ly - height * 0.50);
        const branch = new THREE.CylinderGeometry(trunkR * 0.16, trunkR * 0.36, bLen, 5, 2, true);
        const mBranch = new THREE.Matrix4()
          .makeTranslation((cx + lx) * 0.5, (height * 0.50 + ly) * 0.5, (cz + lz) * 0.5)
          .multiply(new THREE.Matrix4().makeRotationY(-la))
          .multiply(new THREE.Matrix4().makeRotationZ(-Math.atan2(reach, Math.max(0.5, ly - height * 0.50))));
        this._pushGeo(branch, mBranch, layer, height, 3, 0.0, '#2b1d14', '#5c3f2b');
      }

      // Multi-tiered overlapping organic leaf tufts (rich jade-olive core + warm golden-amber twilight crown!)
      for (let sub = 0; sub < 2; sub++) {
        const subOffA = la + (sub - 0.5) * 0.9;
        const sx = lx + (sub === 0 ? 0 : Math.cos(subOffA) * domeR * 0.48);
        const sz = lz + (sub === 0 ? 0 : Math.sin(subOffA) * domeR * 0.48);
        const sy = ly + sub * domeR * 0.26;
        const sr = domeR * (sub === 0 ? 1.0 : 0.76);

        const canopy = new THREE.IcosahedronGeometry(sr, 2);
        const cp = canopy.attributes.position;
        for (let vi = 0; vi < cp.count; vi++) {
          const vx = cp.getX(vi);
          const vy = cp.getY(vi);
          const vz = cp.getZ(vi);
          const uN = (Math.atan2(vz, vx) + Math.PI) / TWO_PI;
          const vN = (vy / sr) * 0.5 + 0.5;
          const n1 = fastPeriodicNoise(uN, vN, 8, 8, PERM_A, (seedVal + l * 17 + sub * 31) & 255);
          const n2 = fastPeriodicNoise(uN * 2.0, vN * 2.0, 16, 16, PERM_B, (seedVal + l * 9) & 255);
          // Feathered organic foliage tufts (NOT blocky blobs!)
          const tuft = 0.72 + (1.0 - Math.abs(2.0 * n1 - 1.0)) * 0.42 + (n2 - 0.5) * 0.24;
          cp.setXYZ(vi, vx * 1.46 * tuft, vy * 0.54 * tuft, vz * 1.38 * tuft);
        }
        canopy.computeVertexNormals();
        const mCan = new THREE.Matrix4().makeTranslation(sx, sy, sz);
        this._pushGeo(
          canopy,
          mCan,
          layer,
          height + 2.0,
          1,
          0.42,
          sub === 0 ? '#183d24' : '#26542c',
          sub === 0 ? '#5b9444' : '#8ec458'
        );
      }

      // Draped, Curved & Feathered Tapered Spanish Moss Festoons (S-curved catenary curtains, NEVER stiff rectangles!)
      for (let m = 0; m < 3; m++) {
        const ma = la + (m - 1) * 0.72 + rnd() * 0.25;
        const mr = domeR * (0.55 + (m % 2) * 0.34);
        const mx = lx + Math.cos(ma) * mr;
        const mz = lz + Math.sin(ma) * mr;
        const mossLen = height * (0.14 + rnd() * 0.17);
        const topW = 0.20 + rnd() * 0.14;
        // Cone oriented downward: wide feathery attachment under bough tapering to delicate wisp point!
        const moss = new THREE.ConeGeometry(topW, mossLen, 5, 5, true);
        moss.rotateX(Math.PI); // apex at bottom (-mossLen/2), wide base at top (+mossLen/2)
        moss.translate(0, -mossLen * 0.5, 0);
        const mp = moss.attributes.position;
        const drapeAng = ma + 0.6;
        const dx = Math.cos(drapeAng);
        const dz = Math.sin(drapeAng);
        for (let vi = 0; vi < mp.count; vi++) {
          let vx = mp.getX(vi);
          const vy = mp.getY(vi);
          let vz = mp.getZ(vi);
          const dropT = Math.min(1.0, Math.max(0.0, -vy / mossLen)); // 0 at bough -> 1 at tip
          // Graceful S-curve catenary wind drape + scalloped wispy silhouette
          const curve = Math.pow(dropT, 1.7) * (0.42 + (m % 2) * 0.22) + Math.sin(dropT * Math.PI * 2.0 + m) * 0.10;
          const scallop = 0.75 + 0.45 * Math.sin(dropT * 9.0 + vi);
          vx = vx * scallop * 1.15 + dx * curve;
          vz = vz * scallop * 0.55 + dz * curve;
          mp.setXYZ(vi, vx, vy, vz);
        }
        moss.computeVertexNormals();
        const mMoss = new THREE.Matrix4().makeTranslation(mx, ly - domeR * 0.08, mz);
        this._pushGeo(moss, mMoss, layer, height + 2.0, 1, 0.92, '#4c6e3d', '#c5db82');
      }
    }
  }

  // 6. Sunken Ancient Bayou Temple Ruin + Sculpted Stone Shrine Lantern ('mist_bayou')
  addSunkenTempleRuin(ang, radius, scaleH, seedVal, layer) {
    const cx = Math.sin(ang) * radius;
    const cz = Math.cos(ang) * radius;
    const m = new THREE.Matrix4()
      .makeTranslation(cx, 0, cz)
      .multiply(new THREE.Matrix4().makeRotationY(ang + 0.18));

    // Stepped mossy temple plinth emerging from the delta water
    const plinth = new THREE.CylinderGeometry(scaleH * 0.60, scaleH * 0.78, scaleH * 0.30, 8, 1, false);
    plinth.translate(0, scaleH * 0.15 - 0.6, 0);
    this._pushGeo(plinth, m, layer, scaleH, 3, 0.3, '#344535', '#6c7d62');

    // Twin carved fluted stone pillars + stepped lintel beam
    const colSpan = scaleH * 0.35;
    for (const side of [-1, 1]) {
      const hCol = scaleH * 0.78;
      const colGeo = new THREE.CylinderGeometry(scaleH * 0.082, scaleH * 0.105, hCol, 8, 1, false);
      colGeo.translate(side * colSpan, hCol * 0.5 - 0.32, 0);
      this._pushGeo(colGeo, m, layer, scaleH, 3, 0.3, '#465442', '#8e9c7e');
    }
    const lintel = new THREE.BoxGeometry(colSpan * 2.55, scaleH * 0.12, scaleH * 0.24);
    lintel.translate(0, scaleH * 0.78 - 0.28, 0);
    this._pushGeo(lintel, m, layer, scaleH, 3, 0.3, '#4e5c48', '#9dab8b');

    const cap = new THREE.CylinderGeometry(colSpan * 0.95, colSpan * 1.35, scaleH * 0.09, 4, 1, false);
    cap.rotateY(Math.PI * 0.25);
    cap.translate(0, scaleH * 0.87 - 0.28, 0);
    this._pushGeo(cap, m, layer, scaleH, 3, 0.3, '#3f4d3b', '#879678');

    // Compact Carved Stone Pagoda Brazier + Warm Amber Flame Core (NEVER a giant white diamond!)
    for (const side of [-1, 1]) {
      const lx = side * colSpan;
      const ly = scaleH * 0.94 - 0.26;
      const cageRoof = new THREE.ConeGeometry(scaleH * 0.065, scaleH * 0.055, 6, 1, false);
      cageRoof.translate(lx, ly + scaleH * 0.045, 0);
      this._pushGeo(cageRoof, m, layer, scaleH, 3, 0.3, '#2f3b2d', '#6d7a64');

      const flame = new THREE.SphereGeometry(scaleH * 0.028, 6, 5);
      flame.scale(0.85, 1.35, 0.85);
      flame.translate(lx, ly, 0);
      this._pushGeo(flame, m, layer, scaleH, 4, 0.8, '#ff9505', '#ffd166');
    }
  }

  // 7. Sun-Bleached Striated Golden-Cream Karst Sea-Arch & Tropical Jungle Atoll ('coral_sea')
  addTropicalAtollAndArch(ang, radius, scaleW, archH, withArch, palmCount, seedVal, layer) {
    const cx = Math.sin(ang) * radius;
    const cz = Math.cos(ang) * radius;
    let s = (seedVal * 22695477 + 1) >>> 0;
    const rnd = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const mBase = new THREE.Matrix4()
      .makeTranslation(cx, 0, cz)
      .multiply(new THREE.Matrix4().makeRotationY(ang + 0.32));

    // Sunlit scalloped coral-sand atoll beach bar sloping gently into turquoise lagoon water!
    const beach = new THREE.CylinderGeometry(scaleW * 0.74, scaleW * 1.28, 1.45, 16, 1, false);
    const bp = beach.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const bx = bp.getX(i);
      const bz = bp.getZ(i);
      const th = (Math.atan2(bz, bx) + Math.PI) / TWO_PI;
      const scallop = 0.86 + 0.28 * fastPeriodicNoise(th, 0.5, 8, 4, PERM_B, seedVal & 255);
      bp.setXYZ(i, bx * 1.26 * scallop, bp.getY(i), bz * 0.90 * scallop);
    }
    beach.computeVertexNormals();
    beach.translate(0, 0.06, 0);
    this._pushGeo(beach, mBase, layer, archH + 4.0, 0, 0.15, '#e8ce9c', '#fff9e6');

    // Helper: Build an organic, multi-tuft jagged tropical scrub cluster (NEVER squashed green pancakes!)
    const addJungleTuftCluster = (localX, localY, localZ, baseR, count) => {
      for (let tIdx = 0; tIdx < count; tIdx++) {
        const ta = (tIdx / count) * TWO_PI + rnd() * 0.5;
        const tr = tIdx === 0 ? 0 : baseR * (0.45 + rnd() * 0.45);
        const tx = localX + Math.cos(ta) * tr;
        const tz = localZ + Math.sin(ta) * tr * 0.75;
        const ty = localY + (tIdx === 0 ? baseR * 0.22 : (rnd() - 0.3) * baseR * 0.28);
        const tuftR = baseR * (tIdx === 0 ? 0.68 : 0.42 + rnd() * 0.26);

        const tuft = new THREE.IcosahedronGeometry(tuftR, 2);
        const tp = tuft.attributes.position;
        for (let vi = 0; vi < tp.count; vi++) {
          const vx = tp.getX(vi);
          const vy = tp.getY(vi);
          const vz = tp.getZ(vi);
          const uN = (Math.atan2(vz, vx) + Math.PI) / TWO_PI;
          const vN = (vy / tuftR) * 0.5 + 0.5;
          const n = fastPeriodicNoise(uN, vN, 8, 8, PERM_A, (seedVal + tIdx * 23) & 255);
          // Leafy spiky bromeliad/fern ridge lobes
          const spike = 0.68 + Math.pow(1.0 - Math.abs(2.0 * n - 1.0), 0.85) * 0.68;
          tp.setXYZ(vi, vx * 1.18 * spike, vy * (0.78 + vN * 0.32) * spike, vz * 1.08 * spike);
        }
        tuft.computeVertexNormals();
        const mTuft = mBase.clone().multiply(new THREE.Matrix4().makeTranslation(tx, ty, tz));
        this._pushGeo(
          tuft,
          mTuft,
          layer,
          archH + 4.0,
          1,
          0.35,
          tIdx % 2 === 0 ? '#115e32' : '#1e7836',
          tIdx % 2 === 0 ? '#52d669' : '#8ce868'
        );
      }

      // Radiating sword-fern / pandanus frond bursts & draping coastal vines!
      for (let f = 0; f < 5; f++) {
        const fa = (f / 5) * TWO_PI + rnd() * 0.4;
        const blade = new THREE.ConeGeometry(baseR * 0.16, baseR * 1.05, 4, 1, false);
        blade.rotateZ(-0.78 - rnd() * 0.35);
        blade.translate(baseR * 0.35, baseR * 0.22, 0);
        const mBlade = mBase
          .clone()
          .multiply(new THREE.Matrix4().makeTranslation(localX, localY, localZ))
          .multiply(new THREE.Matrix4().makeRotationY(fa));
        this._pushGeo(blade, mBlade, layer, archH + 4.0, 1, 0.65, '#166934', '#7ae56e');
      }
    };

    // Helper: Build a curved coconut/cliff palm at local coordinates relative to `mBase`
    const addCurvedPalmLocal = (lx, ly, lz, palmH, lean, leanYaw, frondScale = 1.0) => {
      const mPalm = mBase
        .clone()
        .multiply(new THREE.Matrix4().makeTranslation(lx, ly, lz))
        .multiply(new THREE.Matrix4().makeRotationY(leanYaw))
        .multiply(new THREE.Matrix4().makeRotationZ(lean));

      const trunk = new THREE.CylinderGeometry(0.10 * frondScale, 0.23 * frondScale, palmH, 6, 4, true);
      const tp = trunk.attributes.position;
      for (let ti = 0; ti < tp.count; ti++) {
        const ty = tp.getY(ti) + palmH * 0.5;
        const bow = Math.pow(ty / palmH, 2.0) * 0.52 * frondScale;
        tp.setXYZ(ti, tp.getX(ti) + bow, ty, tp.getZ(ti));
      }
      trunk.computeVertexNormals();
      this._pushGeo(trunk, mPalm, layer, archH + palmH + 3.0, 3, 0.0, '#6e4b30', '#a67b56');

      const crownX = 0.52 * frondScale;
      const fronds = 8;
      for (let f = 0; f < fronds; f++) {
        const fa = (f / fronds) * TWO_PI + rnd() * 0.20;
        const frondLen = 2.85 * frondScale;
        const frondW = 0.92 * frondScale;
        const frond = new THREE.PlaneGeometry(frondLen, frondW, 6, 2);
        frond.rotateX(-Math.PI * 0.5);
        const fp = frond.attributes.position;
        for (let fi = 0; fi < fp.count; fi++) {
          const uDist = (fp.getX(fi) + frondLen * 0.5) / frondLen;
          const zRaw = fp.getZ(fi);
          const xOut = uDist * frondLen;
          const taperZ = zRaw * Math.sin(Math.max(0.10, uDist) * Math.PI);
          // 3D V-chevron leaflet fold so fronds have thick 3D silhouette from below & edge-on!
          const leafletDrop = Math.abs(taperZ) * 0.55;
          const yArc = (Math.sin(uDist * Math.PI * 0.68) * 0.52 - uDist * uDist * 1.28) * frondScale - leafletDrop;
          fp.setXYZ(fi, xOut, yArc, taperZ);
        }
        frond.computeVertexNormals();
        const mFrond = mPalm
          .clone()
          .multiply(new THREE.Matrix4().makeTranslation(crownX, palmH, 0))
          .multiply(new THREE.Matrix4().makeRotationY(fa));
        this._pushGeo(frond, mFrond, layer, archH + palmH + 3.0, 1, 0.75, '#136e37', '#6fe376');
      }
    };

    if (withArch) {
      // Sculpted Chiseled Striated Golden-Cream Karst Sea-Arch (`detailParam = 0.56` triggers limestone strata + dark wet tidal base!)
      const archRad = scaleW * 0.58;
      const tubeRad = scaleW * 0.22;
      const torus = new THREE.TorusGeometry(archRad, tubeRad, 12, 24, Math.PI);
      const p = torus.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let vx = p.getX(i);
        let vy = p.getY(i) * (archH / Math.max(1.0, archRad + tubeRad));
        let vz = p.getZ(i) * 1.52;
        const uN = (vx + scaleW) / (scaleW * 2.0);
        const vN = Math.max(0, (vy + 2.0) / (archH + 3.0));
        const n1 = fastPeriodicNoise(uN, vN, 8, 8, PERM_A, seedVal & 255);
        const n2 = fastPeriodicNoise(uN * 2.0, vN * 2.0, 16, 16, PERM_B, (seedVal + 37) & 255);
        const crag = 1.0 - Math.abs(2.0 * n1 - 1.0);
        // Stepped horizontal karst limestone ledges & sea-carved tidal undercut near y = 0..2m!
        const strataStep = Math.sin(vy * 2.35 + n2 * 1.8) * 0.24;
        const tidalNotch = vy < 2.2 && vy > -0.6 ? -Math.sin(((vy + 0.6) / 2.8) * Math.PI) * 0.42 : 0.0;
        vx += (crag - 0.45) * scaleW * 0.19 + Math.sign(vx || 1) * (strataStep + tidalNotch * 0.5);
        vy += (n1 - 0.42) * archH * 0.12 - 0.35;
        vz = vz * (0.84 + crag * 0.38) + Math.sign(vz || 1) * strataStep * 0.65;
        p.setXYZ(i, vx, vy, vz);
      }
      torus.computeVertexNormals();
      this._pushGeo(torus, mBase, layer, archH + 2.0, 0, 0.56, '#c79a5b', '#faeac6');

      // Flanking karst sea-stack buttress column for authentic asymmetric Ha Long / Palau silhouette!
      const stackH = archH * 0.68;
      const stack = new THREE.CylinderGeometry(scaleW * 0.14, scaleW * 0.28, stackH, 8, 5, false);
      stack.translate(scaleW * 0.72, stackH * 0.5 - 0.4, -scaleW * 0.15);
      const sp = stack.attributes.position;
      for (let si = 0; si < sp.count; si++) {
        const sy = sp.getY(si);
        const step = 1.0 + 0.14 * Math.sin(sy * 2.6 + si * 0.3);
        sp.setXYZ(si, sp.getX(si) * step, sy, sp.getZ(si) * step);
      }
      stack.computeVertexNormals();
      this._pushGeo(stack, mBase, layer, archH + 2.0, 0, 0.56, '#be9052', '#f7e5bd');

      // Lush organic multi-tuft jungle crown + wind-swept clifftop dwarf palms & hanging vines!
      addJungleTuftCluster(0.0, archH * 0.96, 0.0, scaleW * 0.22, 5);
      addJungleTuftCluster(-scaleW * 0.28, archH * 0.86, 0.12, scaleW * 0.17, 4);
      addJungleTuftCluster(scaleW * 0.30, archH * 0.84, -0.10, scaleW * 0.16, 4);
      addJungleTuftCluster(scaleW * 0.72, stackH - 0.25, -scaleW * 0.15, scaleW * 0.14, 3);

      // 2 Wind-swept clifftop palms crowning the limestone sea-arch!
      addCurvedPalmLocal(-scaleW * 0.10, archH * 0.95, 0.0, 3.2, 0.26, 0.55, 0.76);
      addCurvedPalmLocal(scaleW * 0.22, archH * 0.88, 0.15, 2.7, -0.30, 2.15, 0.68);
    }

    // Beachfront 3D Curved Coconut Palm Trees!
    for (let k = 0; k < palmCount; k++) {
      const pa = (k / Math.max(1, palmCount)) * TWO_PI + seedVal * 0.4;
      const pr = scaleW * (0.28 + (k % 3) * 0.18);
      const lx = Math.cos(pa) * pr;
      const lz = Math.sin(pa) * pr;
      const palmH = 4.4 + ((seedVal + k) % 4) * 0.95;
      const lean = 0.20 + (k % 2) * 0.14;
      addCurvedPalmLocal(lx, 0.55, lz, palmH, lean, pa + 0.4, 1.0);
    }
  }

  // 8. Towering Translucent Turquoise Glacial Iceberg & Dark-Basalt Hydro-Siphon Spire ('storm_ocean')
  addGlacialIceberg(ang, radius, width, height, tabular, seedVal, layer) {
    const buildBerg = (offAng, radOff, wS, hS, sOff) => {
      const w = width * wS;
      const h = height * hS;
      const topScale = tabular ? 0.82 : 0.18;
      const geo = new THREE.CylinderGeometry(w * topScale, w * 1.12, h, 8, 5, false);
      geo.translate(0, h * 0.5 - 1.4, 0);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let vx = p.getX(i);
        let vy = p.getY(i);
        let vz = p.getZ(i);
        const hFrac = Math.max(0, (vy + 1.4) / h);
        const theta = Math.atan2(vz, vx);
        const u = (theta + Math.PI) / TWO_PI;
        const n1 = fastPeriodicNoise(u, hFrac, 8, 8, PERM_A, (seedVal + sOff) & 255);
        const facet = 0.72 + (1.0 - Math.abs(2.0 * n1 - 1.0)) * 0.52;
        vx *= facet * 1.15;
        vz *= facet * 0.82;
        if (tabular && hFrac > 0.92) {
          vy = h - 1.4 + (n1 - 0.5) * 0.8;
        }
        p.setXYZ(i, vx, vy, vz);
      }
      geo.computeVertexNormals();
      const a = ang + offAng;
      const r = radius + radOff;
      const m = new THREE.Matrix4()
        .makeTranslation(Math.sin(a) * r, 0, Math.cos(a) * r)
        .multiply(new THREE.Matrix4().makeRotationY(a + sOff * 0.4));
      this._pushGeo(geo, m, layer, h, 2, 1.0, '#12a8c8', '#effbff');
    };

    buildBerg(0, 0, 1.0, 1.0, 0);
    buildBerg(0.046, 2.2, 0.68, 0.64, 41);
  }

  addDistantSiphonRig(ang, radius, rigH, layer) {
    const cx = Math.sin(ang) * radius;
    const cz = Math.cos(ang) * radius;
    const m = new THREE.Matrix4()
      .makeTranslation(cx, 0, cz)
      .multiply(new THREE.Matrix4().makeRotationY(ang));

    // Sleek Dark-Basalt Hydro-Siphon Spire Silhouette with Glowing Cyan Siphon Conduit & Crown Horns!
    const baseSpan = rigH * 0.20;
    const topSpan = rigH * 0.095;

    // 4 Flared Armored Basalt Buttress Pylons converging upward + cross-brace collar rings
    for (let k = 0; k < 4; k++) {
      const ka = (k / 4) * TWO_PI + Math.PI * 0.25;
      const bx = Math.cos(ka) * baseSpan;
      const bz = Math.sin(ka) * baseSpan;
      const tx = Math.cos(ka) * topSpan;
      const tz = Math.sin(ka) * topSpan;
      const legH = rigH * 0.66;
      const pylon = new THREE.CylinderGeometry(rigH * 0.022, rigH * 0.052, legH, 6, 1, false);
      const mp = m
        .clone()
        .multiply(new THREE.Matrix4().makeTranslation((bx + tx) * 0.5, legH * 0.5 - 0.8, (bz + tz) * 0.5))
        .multiply(new THREE.Matrix4().makeRotationY(-ka))
        .multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(baseSpan - topSpan, legH)));
      this._pushGeo(pylon, mp, layer, rigH + 2.0, 3, 0.0, '#0f1722', '#26384d');
    }

    // Horizontal dark-basalt structural brace rings at lower & mid elevations
    for (const frac of [0.24, 0.46]) {
      const ringR = baseSpan + (topSpan - baseSpan) * (frac / 0.66);
      const brace = new THREE.CylinderGeometry(ringR * 1.08, ringR * 1.14, rigH * 0.038, 8, 1, false);
      brace.translate(0, rigH * frac, 0);
      this._pushGeo(brace, m, layer, rigH + 2.0, 3, 0.0, '#131d2b', '#2f455e');
    }

    // Glowing Vertical Cyan-Aquamarine Plasma Siphon Core Column (`matKind = 4`) plunging into the ocean!
    const coreColumn = new THREE.CylinderGeometry(rigH * 0.030, rigH * 0.044, rigH * 0.88, 8, 1, false);
    coreColumn.translate(0, rigH * 0.42 - 0.6, 0);
    this._pushGeo(coreColumn, m, layer, rigH + 2.0, 4, 2.2, '#00e5ff', '#38f9d7');

    // Tiered Octagonal Dark-Basalt Extractor Chamber & Turbine Shroud (replaces flat grey box!)
    const lowerChamber = new THREE.CylinderGeometry(rigH * 0.14, rigH * 0.10, rigH * 0.12, 8, 1, false);
    lowerChamber.translate(0, rigH * 0.60, 0);
    this._pushGeo(lowerChamber, m, layer, rigH + 2.0, 3, 0.0, '#111b29', '#2b4059');

    const glowCollar = new THREE.CylinderGeometry(rigH * 0.148, rigH * 0.148, rigH * 0.026, 8, 1, false);
    glowCollar.translate(0, rigH * 0.67, 0);
    this._pushGeo(glowCollar, m, layer, rigH + 2.0, 4, 2.2, '#00f5d4', '#72efdd');

    const upperSpire = new THREE.CylinderGeometry(rigH * 0.055, rigH * 0.135, rigH * 0.22, 8, 1, false);
    upperSpire.translate(0, rigH * 0.79, 0);
    this._pushGeo(upperSpire, m, layer, rigH + 2.0, 3, 0.0, '#142030', '#334d69');

    // Twin Curved Dark-Basalt Crown Forks framing the Apex Siphon Beacon!
    for (const side of [-1, 1]) {
      const horn = new THREE.ConeGeometry(rigH * 0.022, rigH * 0.20, 5, 1, false);
      horn.rotateZ(-side * 0.16);
      horn.translate(side * rigH * 0.055, rigH * 0.96, 0);
      this._pushGeo(horn, m, layer, rigH + 2.0, 3, 0.0, '#0d1520', '#293e57');
    }

    // Pulsing Cyan-Emerald Siphon Crown Beacon (`matKind = 4`)
    const beacon = new THREE.SphereGeometry(rigH * 0.028, 8, 6);
    beacon.translate(0, rigH * 1.00, 0);
    this._pushGeo(beacon, m, layer, rigH + 2.0, 4, 2.0, '#00f5d4', '#a5f3fc');
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    geo.setAttribute('aVista', new THREE.Float32BufferAttribute(this.vista, 4));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    return geo;
  }
}

function buildBiomeVistaGeometry(kind) {
  const b = new WatershedGeometryBuilder();

  // Note on Camera Framing:
  // At camCol = 0, camera sits around (0, y, +18) looking toward -Z (`ang = Math.PI`).
  // Flanking hero vistas at `ang = Math.PI ± 0.18 .. ± 1.05` (`r = 34..88m`, heights `14..36m`)
  // frame the spire majestically on BOTH 412x915 portrait & 16:9/20:9 landscape, while full
  // 360-deg coverage (`r >= 34m` so camera at `r ~ 18m` never clips!) wraps the entire world!
  if (kind === 'canyon_river') {
    // Enclosing Layered Red-Rock Sandstone Canyon Walls & Mesas flanking a sunlit river bend!
    // Left canyon wall (`ang = PI + 0.19 .. PI + 0.95`) & Right canyon wall (`ang = PI - 0.19 .. PI - 0.95`)
    // leaving a golden sunlit river-gorge gap right around `ang = PI`!
    b.addSandstoneMesa(Math.PI + 0.24, 42, 7.2, 18.5, 13, 0.20, true);
    b.addSandstoneMesa(Math.PI - 0.24, 44, 7.4, 19.2, 29, 0.22, true);
    b.addSandstoneMesa(Math.PI + 0.44, 54, 9.5, 24.5, 47, 0.45, true);
    b.addSandstoneMesa(Math.PI - 0.45, 56, 9.8, 25.2, 61, 0.48, true);
    b.addSandstoneMesa(Math.PI + 0.68, 48, 8.4, 21.0, 83, 0.35, true);
    b.addSandstoneMesa(Math.PI - 0.68, 50, 8.6, 22.0, 97, 0.38, true);
    // Distant towering golden-haze canyon rim mesas behind the river bend
    b.addSandstoneMesa(Math.PI + 0.11, 82, 11.0, 27.5, 113, 0.85, false);
    b.addSandstoneMesa(Math.PI - 0.12, 85, 11.5, 29.0, 131, 0.88, false);

    // Full 360-deg winding canyon walls & redwood benches
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * TWO_PI + 0.15;
      if (Math.abs(ang - Math.PI) < 0.82) continue;
      if (Math.abs(ang) < 0.22 || Math.abs(ang - TWO_PI) < 0.22) {
        // Distant river outlet gorge behind camera (`r = 74m`)
        b.addSandstoneMesa(ang, 74, 10.2, 23.0, i * 19 + 7, 0.72, true);
        continue;
      }
      const isFar = i % 2 === 1;
      const rad = isFar ? 66 + (i % 3) * 6 : 46 + (i % 3) * 5;
      const h = isFar ? 22.0 + (i % 4) * 3.2 : 16.5 + (i % 3) * 2.8;
      b.addSandstoneMesa(ang, rad, 7.8 + (i % 3) * 1.6, h, i * 23 + 5, isFar ? 0.68 : 0.30, true);
    }
  } else if (kind === 'alpine_lake') {
    // Majestic Snow-Capped Granite Peaks, Pine-Forested Rocky Islands & Stone Aqueduct Bridges!
    b.addAlpineGranitePeak(Math.PI + 0.22, 56, 8.2, 26.5, 17, 0.32);
    b.addAlpineGranitePeak(Math.PI - 0.21, 58, 8.6, 28.0, 31, 0.35);
    b.addAlpineGranitePeak(Math.PI + 0.42, 74, 11.5, 34.0, 53, 0.68);
    b.addAlpineGranitePeak(Math.PI - 0.40, 76, 12.0, 35.5, 71, 0.72);
    b.addAlpineGranitePeak(Math.PI + 0.04, 88, 13.5, 38.0, 89, 0.88);

    // Foregrounds/Midground Pine-Forested Rocky Lake Islands (`r = 35..44m`, exposed granite shore cliffs!)
    const islandAngles = [Math.PI + 0.32, Math.PI - 0.31, Math.PI + 0.85, Math.PI - 0.88, 0.75, TWO_PI - 0.75];
    for (let k = 0; k < islandAngles.length; k++) {
      const ia = islandAngles[k];
      const ir = 35 + (k % 2) * 7;
      b.addAlpineGranitePeak(ia, ir, 4.6, 5.2, 101 + k * 13, 0.12, false);
      b.addRedwoodPineCluster(ia, ir, 2.2, 6, 3.2, 3.2, 5.4, 201 + k * 17, 0.12, true);
    }

    // Distant Multi-Arch Stone Aqueduct Bridges spanning mountain spurs!
    b.addStoneAqueductBridge(Math.PI - 0.27, 48, 16.5, 9.2, 5, 0.28);
    b.addStoneAqueductBridge(Math.PI + 0.58, 58, 19.0, 10.5, 6, 0.45);

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TWO_PI + 0.08;
      if (Math.abs(ang - Math.PI) < 0.52) continue;
      const isFar = i % 2 === 0;
      const rad = isFar ? 78 + (i % 3) * 5 : 58 + (i % 3) * 5;
      const h = isFar ? 25.0 + (i % 4) * 3.8 : 18.0 + (i % 3) * 3.2;
      b.addAlpineGranitePeak(ang, rad, 8.5 + (i % 3) * 1.8, h, i * 29 + 11, isFar ? 0.76 : 0.38);
    }
  } else if (kind === 'mist_bayou') {
    // Giant Arching Cypress & Mangrove Trees with Hanging Spanish Moss + Sunken Ancient Temple Ruins!
    b.addGiantCypressTree(Math.PI + 0.21, 34, 17.5, 13, 0.18);
    b.addGiantCypressTree(Math.PI - 0.22, 35, 18.2, 29, 0.20);
    b.addSunkenTempleRuin(Math.PI + 0.33, 42, 9.8, 41, 0.28);
    b.addSunkenTempleRuin(Math.PI - 0.34, 44, 10.4, 59, 0.30);
    b.addGiantCypressTree(Math.PI + 0.48, 48, 21.0, 73, 0.42);
    b.addGiantCypressTree(Math.PI - 0.49, 50, 20.5, 89, 0.45);
    b.addGiantCypressTree(Math.PI + 0.08, 66, 23.5, 107, 0.72);
    b.addGiantCypressTree(Math.PI - 0.10, 70, 24.0, 127, 0.76);

    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * TWO_PI + 0.11;
      if (Math.abs(ang - Math.PI) < 0.56) continue;
      const isFar = i % 2 === 1;
      const rad = isFar ? 62 + (i % 3) * 6 : 38 + (i % 3) * 5;
      const h = isFar ? 19.5 + (i % 3) * 2.5 : 15.5 + (i % 3) * 2.2;
      b.addGiantCypressTree(ang, rad, h, i * 31 + 17, isFar ? 0.68 : 0.26);
      if (i % 4 === 0) {
        b.addSunkenTempleRuin(ang + 0.12, 44 + (i % 2) * 8, 9.2, i * 19 + 3, 0.34);
      }
    }
  } else if (kind === 'coral_sea') {
    // Cream-Limestone Sea-Arches & White-Sand Palm Atolls!
    b.addTropicalAtollAndArch(Math.PI + 0.23, 40, 8.2, 11.8, true, 4, 19, 0.22);
    b.addTropicalAtollAndArch(Math.PI - 0.24, 42, 7.6, 10.5, false, 5, 37, 0.24);
    b.addTropicalAtollAndArch(Math.PI - 0.42, 54, 9.6, 14.2, true, 4, 53, 0.45);
    b.addTropicalAtollAndArch(Math.PI + 0.46, 56, 8.8, 12.6, false, 5, 71, 0.48);
    b.addTropicalAtollAndArch(Math.PI + 0.06, 76, 11.2, 15.8, true, 3, 97, 0.78);

    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * TWO_PI + 0.14;
      if (Math.abs(ang - Math.PI) < 0.54) continue;
      const isFar = i % 2 === 0;
      const rad = isFar ? 68 + (i % 3) * 6 : 44 + (i % 3) * 5;
      b.addTropicalAtollAndArch(
        ang,
        rad,
        7.5 + (i % 3) * 1.4,
        10.5 + (i % 3) * 2.2,
        i % 3 === 0,
        3 + (i % 3),
        i * 23 + 11,
        isFar ? 0.72 : 0.30
      );
    }
  } else {
    // 'storm_ocean': Towering Translucent Turquoise Glacial Icebergs & Distant Offshore Siphon Rigs!
    b.addGlacialIceberg(Math.PI + 0.22, 42, 6.8, 18.5, true, 17, 0.22);
    b.addGlacialIceberg(Math.PI - 0.23, 44, 6.4, 21.0, false, 31, 0.25);
    b.addDistantSiphonRig(Math.PI - 0.38, 62, 18.5, 0.52);
    b.addGlacialIceberg(Math.PI + 0.44, 58, 9.2, 25.0, true, 59, 0.48);
    b.addDistantSiphonRig(Math.PI + 0.58, 68, 19.5, 0.62);
    b.addGlacialIceberg(Math.PI - 0.05, 80, 11.5, 28.5, false, 83, 0.80);

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * TWO_PI + 0.09;
      if (Math.abs(ang - Math.PI) < 0.50) continue;
      const isFar = i % 2 === 1;
      const rad = isFar ? 74 + (i % 3) * 6 : 46 + (i % 3) * 5;
      const h = isFar ? 21.0 + (i % 4) * 3.0 : 15.0 + (i % 3) * 2.8;
      b.addGlacialIceberg(ang, rad, 6.5 + (i % 3) * 1.6, h, i % 2 === 0, i * 29 + 7, isFar ? 0.75 : 0.30);
      if (i % 6 === 2) {
        b.addDistantSiphonRig(ang + 0.14, 66, 17.8, 0.58);
      }
    }
  }

  return b.build();
}

function createWatershedVistaMaterial(cloudPanoTex) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uTime: { value: 0 },
      uWaterY: { value: -0.82 },
      uSunDir: { value: new THREE.Vector3(0.42, 0.36, -0.83).normalize() },
      uSunColor: { value: new THREE.Color('#fff2cc') },
      uSkyFillColor: { value: new THREE.Color('#4ea8e8') },
      uMistColor: { value: new THREE.Color('#fae0aa') },
      uAlpenglowColor: { value: new THREE.Color('#ffd28a') },
      uBeaconA: { value: new THREE.Color('#ffb02e') },
      uBeaconB: { value: new THREE.Color('#2ef5c8') },
      uBlackout: { value: 0.0 },
      uLightning: { value: 0.0 },
      uPurification: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aVista; // x: layer, y: hRatio, z: matKind, w: detailParam
      attribute vec3 aColor;
      uniform float uTime;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec4 vVista;
      varying vec3 vVertCol;

      void main() {
        vVista = aVista;
        vVertCol = aColor;
        vec3 p = position;

        // Gentle organic wind sway on foliage, palm fronds & draped Spanish moss (matKind == 1)
        if (abs(aVista.z - 1.0) < 0.25 && aVista.w > 0.1) {
          float swayAmp = aVista.w * 0.28;
          p.x += sin(uTime * 1.45 + position.x * 0.35 + position.z * 0.35) * swayAmp;
          p.z += cos(uTime * 1.15 + position.y * 0.45) * swayAmp * 0.65;
        }

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform float uTime;
      uniform float uWaterY;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyFillColor;
      uniform vec3 uMistColor;
      uniform vec3 uAlpenglowColor;
      uniform vec3 uBeaconA;
      uniform vec3 uBeaconB;
      uniform float uBlackout;
      uniform float uLightning;
      uniform float uPurification;

      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec4 vVista;
      varying vec3 vVertCol;

      float hash31(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float rockGrain3D(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i);
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
        return mix(
          mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
          mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
          u.z
        );
      }

      void main() {
        float layer = vVista.x;
        float hRatio = vVista.y;
        float matKind = vVista.z;
        float detailParam = vVista.w;

        // Emissive Shrine Braziers, Lotus Hearts & Siphon Plasma Cores/Beacons (matKind == 4)
        // Saturated emissive values (< 1.25) so cyan & warm-amber glow richly without white-clipping!
        if (matKind > 3.5) {
          float pulse = 0.78 + 0.22 * sin(uTime * 3.0 + vWorldPos.x * 0.3 + vWorldPos.z * 0.3);
          vec3 emCol = detailParam > 1.5
            ? mix(vec3(0.0, 0.90, 0.98), vec3(0.18, 0.98, 0.78), 0.5 + 0.5 * sin(uTime * 2.4 + vWorldPos.y * 0.45))
            : vVertCol;
          gl_FragColor = vec4(emCol * 1.15 * pulse, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        float darkScale = mix(1.0, 0.34, clamp(uBlackout, 0.0, 1.0));
        float hAboveWater = max(0.0, vWorldPos.y - uWaterY);
        float cliffAz = atan(vWorldPos.x, vWorldPos.z) * 0.159154943;
        vec4 tex = texture2D(uPanoTex, vec2(cliffAz * 14.0, clamp(hAboveWater * 0.038, 0.02, 0.98)));

        // High-frequency 3D world-space sandstone/limestone micro-grain for foreground boulders & cliffs!
        float gCoarse = rockGrain3D(vWorldPos * 1.85);
        float gFine = rockGrain3D(vWorldPos * 5.60);
        float rockMicro = gCoarse * 0.62 + gFine * 0.38;

        vec3 n = normalize(
          vNormalW
          + vec3((tex.g - 0.5) * 0.38 + (gFine - 0.5) * 0.28, (tex.b - 0.5) * 0.24 + (gCoarse - 0.5) * 0.20, (tex.r - 0.5) * 0.38 + (gFine - 0.5) * 0.28)
        );
        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndl = max(0.0, dot(n, L));
        float hemi = 0.5 + 0.5 * n.y;

        vec3 alb = vVertCol * (0.76 + 0.28 * tex.r + 0.24 * rockMicro);
        float wetSpec = 0.0;
        vec3 warmBounce = vec3(0.0);
        float aerialScale = 1.0;

        if (matKind < 0.5) {
          // Stratified Rock / Karst Limestone / Canyon Sandstone / Alpine Granite + Snowpack
          if (detailParam > 0.45 && detailParam <= 0.68) {
            // Sun-Bleached Striated Golden-Cream Karst Limestone + Dark Wet Tidal Base ('coral_sea')!
            float karstBand = sin(hAboveWater * 2.45 + tex.a * 2.1 + gFine * 0.9);
            float fineTravertine = sin(hAboveWater * 6.8 + tex.r * 2.6);
            vec3 sunBleachedCream = vec3(1.16, 0.96, 0.62) * (0.90 + 0.18 * gFine);
            vec3 warmOchreTravertine = vec3(0.82, 0.56, 0.28) * (0.86 + 0.22 * gFine);
            alb = mix(warmOchreTravertine, sunBleachedCream, smoothstep(-0.48, 0.48, karstBand * 0.74 + fineTravertine * 0.26));

            // Dark wet mossy-slate & barnacle tidal undercut base right along the lagoon waterline!
            float tideLine = smoothstep(0.35, 2.75, hAboveWater + (tex.r - 0.5) * 0.55);
            vec3 wetTidalRock = mix(vec3(0.09, 0.16, 0.14), vec3(0.22, 0.26, 0.18), gFine);
            alb = mix(wetTidalRock, alb, tideLine);
            wetSpec = (1.0 - tideLine) * 0.65;
            // Warm sunlit coral-sand bounce light keeps sun-shaded limestone golden-cream instead of grey!
            warmBounce = alb * vec3(0.46, 0.34, 0.16) * tideLine;
            aerialScale = 0.42;
          } else if (detailParam > 0.70 && detailParam < 0.92) {
            // Vivid Zion/Sedona Red-Rock Sandstone strata + Glossy Dark Wet-Waterline Skirt on river boulders!
            float strata = sin(hAboveWater * 2.25 + tex.a * 2.6 + gCoarse * 1.9);
            float fineLayer = sin(hAboveWater * 6.8 + gFine * 3.2);
            vec3 fierySandstone = alb * vec3(1.34, 0.90, 0.58);
            vec3 deepTerracotta = alb * vec3(0.68, 0.34, 0.24);
            alb = mix(deepTerracotta, fierySandstone, smoothstep(-0.48, 0.52, strata * 0.72 + fineLayer * 0.28));

            // Dark glossy wet-sandstone skirt on river boulders & cliff bases!
            float wetZone = 1.0 - smoothstep(0.08, 0.68, hAboveWater + (gFine - 0.5) * 0.14);
            alb *= mix(1.0, 0.32, wetZone);
            wetSpec = wetZone * 0.85;
          } else if (detailParam >= 0.95) {
            // True Two-Tone Chiseled Granite + High-Altitude Snowcaps ('alpine_lake')!
            float snowDrivers = hRatio * 0.68 + max(0.0, n.y) * 0.52 + (tex.r - 0.5) * 0.26;
            float snowMask = smoothstep(0.56, 0.78, snowDrivers) * smoothstep(0.24, 0.48, hRatio);
            vec3 snowAlb = mix(vec3(0.74, 0.85, 0.96), vec3(0.96, 0.97, 1.0), ndl);
            snowAlb += uAlpenglowColor * (0.34 * pow(ndl, 1.3) * smoothstep(0.45, 0.90, hRatio));
            alb = mix(alb, snowAlb, snowMask);
          }
        } else if (matKind < 1.5) {
          // Foliage / Redwood / Cypress / Draped Spanish Moss / Tropical Jungle: subsurface scattering + warm twilight rim!
          float leafSss = pow(max(0.0, dot(-V, L) * 0.5 + 0.5), 2.0) * 0.46;
          float rimFres = pow(1.0 - abs(dot(n, V)), 2.1) * (0.35 + 0.65 * max(0.0, n.y + 0.35));
          alb *= (0.88 + 0.28 * gFine) * (1.0 + uPurification * 0.18);
          alb += alb * uSunColor * leafSss + uSunColor * rimFres * (0.12 + detailParam * 0.16);
        } else if (matKind < 2.5) {
          // Translucent Turquoise Glacial Iceberg ('storm_ocean')
          float fresIce = pow(1.0 - max(0.0, dot(n, V)), 2.5);
          float iceSss = pow(max(0.0, dot(-V, L) * 0.5 + 0.5), 2.0);
          float crevasse = smoothstep(0.62, 0.28, tex.r);
          alb = mix(alb, vec3(0.04, 0.42, 0.64), crevasse * 0.55);
          float snowCap = smoothstep(0.58, 0.88, n.y + hRatio * 0.30);
          alb = mix(alb, vec3(0.90, 0.97, 1.0), snowCap * 0.70);
          alb += vec3(0.08, 0.56, 0.72) * (iceSss * 0.48 + fresIce * 0.38);
        }

        // Direct Sun + Sky Hemisphere Fill + Warm Lagoon Bounce + Glossy Wet-Waterline Specular Glint!
        vec3 sunLit = uSunColor * (0.24 + 0.96 * ndl);
        vec3 skyLit = uSkyFillColor * (0.26 + 0.36 * hemi);
        vec3 H = normalize(L + V);
        float specGlint = pow(max(0.0, dot(n, H)), 32.0) * wetSpec;
        vec3 col = (alb * (sunLit + skyLit) + warmBounce + uSunColor * specGlint * 0.75) * darkScale;

        if (uLightning > 0.005) {
          col += vec3(0.24, 0.42, 0.62) * uLightning * (0.3 + 0.7 * max(0.0, n.y));
        }

        // Gentle atmospheric depth cueing preserving rich foreground/midground rock & foliage colors!
        float baseMist = exp(-hAboveWater * 0.42) * 0.18;
        float aerial = clamp((baseMist + layer * layer * 0.40) * aerialScale, 0.0, 0.66);
        col = mix(col, uMistColor * 0.86 * darkScale, aerial);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ============================================================================
// 3D ANIMATED CLIFFSIDE WATERFALLS + FOAMING PLUNGE-POOL MIST (`waterfallGroup`)
// ============================================================================

function buildWaterfallsGeometry(specs) {
  const pos = [];
  const uvs = [];
  const idx = [];
  const segX = 16;
  const segY = 24;

  for (let wIdx = 0; wIdx < specs.length; wIdx++) {
    const { ang, rTop, rBot, yTop, width, seed } = specs[wIdx];
    const baseV = pos.length / 3;
    for (let iy = 0; iy <= segY; iy++) {
      const v = iy / segY; // 0 = plunge pool at waterY, 1 = cliff lip at yTop
      const dropFrac = 1.0 - v;
      // Smooth ballistic trajectory curving gracefully over cliff lip and flaring into plunge pool!
      const lipCurve = Math.pow(dropFrac, 1.55);
      const rCur = rTop + (rBot - rTop) * lipCurve;
      const yCur = -0.25 + v * (yTop + 0.25);
      const flareW = width * (0.92 + dropFrac * 0.78);

      for (let ix = 0; ix <= segX; ix++) {
        const u = ix / segX;
        const a = ang + ((u - 0.5) * flareW) / Math.max(10.0, rCur);
        const archOut = Math.sin(u * Math.PI) * (0.52 + dropFrac * 0.35);
        const rad = rCur - archOut;
        pos.push(Math.sin(a) * rad, yCur, Math.cos(a) * rad);
        uvs.push(u, v, seed, 0.0); // w = 0 -> vertical waterfall curtain
      }
    }
    for (let iy = 0; iy < segY; iy++) {
      for (let ix = 0; ix < segX; ix++) {
        const i0 = baseV + iy * (segX + 1) + ix;
        const i1 = i0 + 1;
        const i2 = i0 + (segX + 1);
        const i3 = i2 + 1;
        idx.push(i0, i2, i1, i1, i2, i3);
      }
    }

    // 1. Horizontal Foaming Plunge-Pool Ring Disc at waterline (`y = 0.08`, `w = 1.0`)
    const poolCx = Math.sin(ang) * (rBot - 0.45);
    const poolCz = Math.cos(ang) * (rBot - 0.45);
    const poolRx = width * 1.35;
    const poolRz = width * 0.95;
    const pBase = pos.length / 3;
    pos.push(poolCx - poolRx, 0.08, poolCz - poolRz);
    pos.push(poolCx + poolRx, 0.08, poolCz - poolRz);
    pos.push(poolCx - poolRx, 0.08, poolCz + poolRz);
    pos.push(poolCx + poolRx, 0.08, poolCz + poolRz);
    uvs.push(0, 0, seed, 1.0, 1, 0, seed, 1.0, 0, 1, seed, 1.0, 1, 1, seed, 1.0);
    idx.push(pBase, pBase + 2, pBase + 1, pBase + 1, pBase + 2, pBase + 3);

    // 2. Soft Radial-Alpha Billowing Plunge Mist Cushion rising above waterline (`w = 2.0`, NEVER hard diamond/quad!)
    const mistH = Math.min(5.2, yTop * 0.42);
    const mistW = width * 1.45;
    const tangX = Math.cos(ang);
    const tangZ = -Math.sin(ang);
    const mCx = Math.sin(ang) * (rBot - 0.75);
    const mCz = Math.cos(ang) * (rBot - 0.75);
    const mBase = pos.length / 3;
    pos.push(mCx - tangX * mistW, -0.15, mCz - tangZ * mistW);
    pos.push(mCx + tangX * mistW, -0.15, mCz + tangZ * mistW);
    pos.push(mCx - tangX * mistW, mistH, mCz - tangZ * mistW);
    pos.push(mCx + tangX * mistW, mistH, mCz + tangZ * mistW);
    uvs.push(0, 0, seed, 2.0, 1, 0, seed, 2.0, 0, 1, seed, 2.0, 1, 1, seed, 2.0);
    idx.push(mBase, mBase + 2, mBase + 1, mBase + 1, mBase + 2, mBase + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aFallUv', new THREE.Float32BufferAttribute(uvs, 4));
  geo.setIndex(idx);
  return geo;
}

function createWaterfallMaterial(cloudPanoTex) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uTime: { value: 0 },
      uFoamColor: { value: new THREE.Color('#f8fdff') },
      uTintColor: { value: new THREE.Color('#5eead4') },
      uRainbowAmt: { value: 0.65 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aFallUv;
      varying vec4 vFuv;
      void main() {
        vFuv = aFallUv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform float uTime;
      uniform vec3 uFoamColor;
      uniform vec3 uTintColor;
      uniform float uRainbowAmt;
      varying vec4 vFuv;

      vec3 spectralRainbow(float t) {
        return clamp(vec3(
          abs(t * 6.0 - 3.0) - 1.0,
          2.0 - abs(t * 6.0 - 2.0),
          2.0 - abs(t * 6.0 - 4.0)
        ), 0.0, 1.0);
      }

      void main() {
        float u = vFuv.x;
        float v = vFuv.y;
        float seed = vFuv.z;
        float kind = vFuv.w;

        // Mode 1: Horizontal Foaming Plunge-Pool Ripple Ring at waterline!
        if (kind > 0.5 && kind < 1.5) {
          vec2 p = (vec2(u, v) - 0.5) * 2.0;
          float r = length(p);
          if (r >= 1.0) discard;
          vec4 n = texture2D(uPanoTex, vec2(u * 1.4 + seed, v * 1.4 - uTime * 0.25));
          float rings = 0.5 + 0.5 * sin(r * 16.0 - uTime * 4.2 + n.r * 3.5);
          float coreFoam = exp(-r * r * 3.2);
          float outerFade = pow(max(0.0, 1.0 - r), 1.65);
          float alpha = clamp((coreFoam * 0.78 + rings * 0.42) * outerFade * (0.55 + 0.45 * n.g), 0.0, 0.85);
          if (alpha < 0.01) discard;
          vec3 col = mix(uTintColor * 0.80, uFoamColor, 0.55 + coreFoam * 0.45);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        // Mode 2: Soft Radial-Alpha Billowing Plunge Mist Cushion (zero hard quad edges!)
        if (kind >= 1.5) {
          vec2 p = (vec2(u, v) - 0.5) * 2.0;
          float r2 = dot(p, p);
          if (r2 >= 1.0) discard;
          float radialSoft = pow(max(0.0, 1.0 - sqrt(r2)), 2.1);
          vec4 m1 = texture2D(uPanoTex, vec2(u * 0.85 + seed, fract(v * 0.85 - uTime * 0.14 + seed)));
          float billow = 0.45 + 0.55 * m1.r;
          vec3 col = mix(uTintColor * 0.85, uFoamColor, 0.72);
          if (uRainbowAmt > 0.01) {
            col += spectralRainbow(clamp(u * 0.9 + 0.05, 0.0, 1.0)) * radialSoft * uRainbowAmt * 0.35;
          }
          float alpha = clamp(radialSoft * billow * 0.62, 0.0, 0.68);
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }

        // Mode 0: Feathered Cascading Waterfall Curtain (organic spray-eroded edges, ZERO zig-zag polygon silhouettes!)
        vec4 s1 = texture2D(uPanoTex, vec2(u * 0.55 + seed * 0.17, fract(v * 0.85 + uTime * 0.74 + seed)));
        vec4 s2 = texture2D(uPanoTex, vec2(u * 1.25 - seed * 0.31, fract(v * 1.75 + uTime * 1.18)));

        // Organic spray-feathered side & bottom/top masks so silhouette is misty & fluid, never polygonal!
        float rawSide = sin(clamp(u, 0.0, 1.0) * 3.14159265);
        float sideFeather = pow(rawSide, 1.85) * smoothstep(0.08, 0.48, rawSide * (0.62 + 0.55 * s1.g));
        float topFade = smoothstep(1.0, 0.86, v);
        float botFade = smoothstep(0.0, 0.14, v);
        float plungeBillow = smoothstep(0.0, 0.32, 1.0 - v);

        float streaks = smoothstep(0.22, 0.78, s1.r * 0.58 + s2.b * 0.42 + plungeBillow * 0.24);
        vec3 col = mix(uTintColor * 0.74, uFoamColor * 0.96, streaks);

        if (v < 0.36 && uRainbowAmt > 0.01) {
          float rMask = (1.0 - v / 0.36) * sideFeather * uRainbowAmt;
          vec3 rb = spectralRainbow(clamp(u * 0.85 + 0.08, 0.0, 1.0));
          col = mix(col, col * 0.80 + rb * 0.52, rMask * 0.62);
        }

        float alpha = clamp(sideFeather * topFade * botFade * (0.36 + 0.58 * streaks + plungeBillow * 0.24), 0.0, 0.90);
        if (alpha < 0.008) discard;

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ============================================================================
// FOREGROUND / MIDGROUND WATER-WORLD & UNDERWATER CORAL REEF BUILDERS
// ============================================================================

function buildCoralReefShelfGeometry() {
  const b = new WatershedGeometryBuilder();
  let seed = 8082026;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 1. Sculpted scalloped white-sand & turquoise coral shoals (`r = 5.2..34m`, `y = -0.68..-1.95m`)
  const reefPatches = 28;
  const coralPalette = [
    ['#e11d48', '#fda4af'], // Vivid Coral-Rose Staghorn
    ['#ea580c', '#fde047'], // Sunburst Brain Coral
    ['#7c3aed', '#e9d5ff'], // Royal Sea-Fan
    ['#0d9488', '#5eead4'], // Turquoise Table Acropora
    ['#15803d', '#86efac'], // Emerald Reef Anemone
  ];

  for (let i = 0; i < reefPatches; i++) {
    const ang = (i / reefPatches) * TWO_PI + rnd() * 0.14;
    const rad = 5.4 + (i % 4) * 5.5 + rnd() * 2.8;
    const shelfY = -0.76 - (i % 3) * 0.26;
    const shelfW = 2.8 + rnd() * 2.4;

    const cx = Math.sin(ang) * rad;
    const cz = Math.cos(ang) * rad;

    // Organic scalloped white-sand reef shelf (zero octagonal straight edges!)
    const shelf = new THREE.CylinderGeometry(shelfW * 0.85, shelfW * 1.22, 0.55, 14, 1, false);
    const sp = shelf.attributes.position;
    for (let si = 0; si < sp.count; si++) {
      const sx = sp.getX(si);
      const sz = sp.getZ(si);
      const uAng = (Math.atan2(sz, sx) + Math.PI) / TWO_PI;
      const sc = 0.78 + 0.42 * fastPeriodicNoise(uAng, 0.4, 8, 4, PERM_A, (i * 17) & 255);
      sp.setXYZ(si, sx * 1.2 * sc, sp.getY(si), sz * 0.92 * sc);
    }
    shelf.computeVertexNormals();
    const mShelf = new THREE.Matrix4()
      .makeTranslation(cx, shelfY - 0.28, cz)
      .multiply(new THREE.Matrix4().makeRotationY(ang));
    b._pushGeo(shelf, mShelf, 0.0, 2.0, 0, 0.0, '#7bd5d4', '#daf6f4');

    const heads = 6;
    for (let h = 0; h < heads; h++) {
      const ha = rnd() * TWO_PI;
      const hr = rnd() * shelfW * 0.68;
      const hx = cx + Math.cos(ha) * hr;
      const hz = cz + Math.sin(ha) * hr;
      const pal = coralPalette[(i + h) % coralPalette.length];
      const kind = (i + h) % 3;

      if (kind === 0) {
        // Ruffled Brain Coral Dome
        const rDome = 0.36 + rnd() * 0.36;
        const dome = new THREE.IcosahedronGeometry(rDome, 2);
        const dp = dome.attributes.position;
        for (let di = 0; di < dp.count; di++) {
          const groove = 0.88 + 0.16 * Math.sin(dp.getX(di) * 18.0 + dp.getZ(di) * 18.0);
          dp.setXYZ(di, dp.getX(di) * 1.2 * groove, dp.getY(di) * 0.75 * groove, dp.getZ(di) * 1.1 * groove);
        }
        dome.computeVertexNormals();
        b._pushGeo(dome, new THREE.Matrix4().makeTranslation(hx, shelfY + rDome * 0.34, hz), 0.0, 1.5, 1, 0.0, pal[0], pal[1]);
      } else if (kind === 1) {
        // Scalloped Table / Sea-Fan Coral
        const rTab = 0.48 + rnd() * 0.42;
        const tab = new THREE.CylinderGeometry(rTab, rTab * 0.26, 0.24, 10, 1, false);
        b._pushGeo(tab, new THREE.Matrix4().makeTranslation(hx, shelfY + 0.22, hz), 0.0, 1.5, 1, 0.0, pal[0], pal[1]);
      } else {
        // Multi-Branching Staghorn Antler Cluster
        for (let br = 0; br < 4; br++) {
          const bh = 0.52 + rnd() * 0.48;
          const stag = new THREE.CylinderGeometry(0.045, 0.10, bh, 5, 1, false);
          stag.translate(0, bh * 0.5, 0);
          const mStag = new THREE.Matrix4()
            .makeTranslation(hx + (br - 1.5) * 0.15, shelfY, hz + ((br % 2) - 0.5) * 0.15)
            .multiply(new THREE.Matrix4().makeRotationY(br * 1.4))
            .multiply(new THREE.Matrix4().makeRotationZ((br - 1.5) * 0.28));
          b._pushGeo(stag, mStag, 0.0, 1.5, 1, 0.0, pal[0], pal[1]);
        }
      }
    }
  }

  return b.build();
}

function buildMantaRayGeometry() {
  // Sculpted 3D Manta Ray: sweeping diamond pectoral wings (`x = -1.6..+1.6`), cephalic horns & whip tail!
  const b = new WatershedGeometryBuilder();
  const idMat = new THREE.Matrix4();

  // Central hydro-fuselage
  const body = new THREE.SphereGeometry(0.42, 10, 8);
  body.scale(0.85, 0.26, 1.65);
  b._pushGeo(body, idMat, 0, 1, 0, 0, '#0c3b5e', '#1e7898');

  // Sweeping left & right diamond pectoral wings
  for (const side of [-1, 1]) {
    const wing = new THREE.ConeGeometry(0.72, 1.55, 4, 3, false);
    wing.rotateZ(-side * Math.PI * 0.5);
    wing.scale(1.0, 0.10, 1.05);
    wing.translate(side * 0.82, 0.0, -0.05);
    b._pushGeo(wing, idMat, 0, 1, 0, 1, '#0e4870', '#5eead4');

    // Forward cephalic horn lobe
    const horn = new THREE.ConeGeometry(0.09, 0.42, 4, 1, false);
    horn.rotateX(Math.PI * 0.5);
    horn.translate(side * 0.22, 0.0, 0.78);
    b._pushGeo(horn, idMat, 0, 1, 0, 0, '#166088', '#bae6fd');
  }

  // Trailing whip tail (extending toward -Z when swimming toward +Z)
  const tail = new THREE.ConeGeometry(0.055, 1.45, 4, 1, false);
  tail.rotateX(-Math.PI * 0.5);
  tail.translate(0, 0, -1.25);
  b._pushGeo(tail, idMat, 0, 1, 0, 0, '#0a2e4a', '#1b5e80');

  return b.build();
}

function createUnderwaterReefMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPurification: { value: 0 },
      uWaterTint: { value: new THREE.Color('#0ea5b8') },
      uSunDir: { value: new THREE.Vector3(0.32, 0.58, -0.75).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute vec4 aVista;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vNormalW;
      varying vec3 vCol;

      void main() {
        vCol = aColor;
        vec3 p = position;
        vLocalPos = p;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        #ifdef USE_INSTANCING
          // Graceful traveling pectoral wingbeat for instanced 3D Manta Rays!
          float span = abs(p.x);
          if (span > 0.15) {
            p.y += sin(uTime * 3.6 - span * 1.9 + float(gl_InstanceID) * 1.3) * (span * 0.24);
          }
          wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vNormalW = normalize(mat3(modelMatrix) * normal);
        #endif
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uPurification;
      uniform vec3 uWaterTint;
      uniform vec3 uSunDir;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vNormalW;
      varying vec3 vCol;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        vec3 n = normalize(vNormalW);
        float ndl = 0.42 + 0.58 * max(0.0, dot(n, normalize(uSunDir)));

        // Bright dancing sunlit underwater caustic webs projected across reef & manta wings!
        vec2 cp = vWorldPos.xz * 1.45;
        float c1 = 1.0 - abs(noise(cp + vec2(uTime * 0.42, -uTime * 0.31)) * 2.0 - 1.0);
        float c2 = 1.0 - abs(noise(cp * 1.65 - vec2(uTime * 0.35, uTime * 0.38)) * 2.0 - 1.0);
        float caust = pow(clamp(c1 * 0.55 + c2 * 0.45, 0.0, 1.0), 3.0);

        vec3 col = vCol * ndl * (1.05 + uPurification * 0.22);
        col += vec3(0.45, 0.98, 0.96) * caust * 0.52;

        // Subtle turquoise lagoon water absorption with distance
        float dist = length(cameraPosition - vWorldPos);
        col = mix(col, uWaterTint * 0.65, clamp(smoothstep(14.0, 48.0, dist), 0.0, 0.82));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function buildRiverBouldersAndWakesGeometry() {
  const boulderBuilder = new WatershedGeometryBuilder();
  const wakePos = [];
  const wakeUv = [];
  const wakeIdx = [];

  let seed = 44112026;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Flow direction matches `water.js` canyon_river `[1.48, 0.36]`
  const fx = 0.971;
  const fz = 0.236;
  const flowYaw = Math.atan2(fx, fz);

  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * TWO_PI + 0.14;
    // Keep front camera sightline (`ang ~ 0`, `|x| < 3.2`) clear so boulders never block low floor-0 camera!
    const rad = Math.abs(Math.sin(ang)) < 0.28 && Math.cos(ang) > 0 ? 22.0 + (i % 3) * 4.0 : 6.4 + (i % 4) * 5.2 + rnd() * 2.4;
    const bx = Math.sin(ang) * rad;
    const bz = Math.cos(ang) * rad;
    const bw = 0.72 + rnd() * 0.85;
    const bh = 0.65 + rnd() * 0.68;

    const rock = new THREE.IcosahedronGeometry(bw, 3);
    const rp = rock.attributes.position;
    for (let ri = 0; ri < rp.count; ri++) {
      const rx = rp.getX(ri);
      const ry = rp.getY(ri);
      const rz = rp.getZ(ri);
      const u = (Math.atan2(rz, rx) + Math.PI) / TWO_PI;
      const v = (ry / bw) * 0.5 + 0.5;
      const n1 = fastPeriodicNoise(u, v, 8, 8, PERM_A, (i * 29 + 7) & 255);
      const n2 = fastPeriodicNoise(u * 2.0, v * 2.0, 16, 16, PERM_B, (i * 13 + 3) & 255);
      // River-rounded sandstone boulder with subtle horizontal sedimentary ledges
      const shelf = 1.0 + 0.11 * Math.sin(v * Math.PI * 5.0 + n2 * 2.0);
      const crag = (0.76 + (1.0 - Math.abs(2.0 * n1 - 1.0)) * 0.36 + (n2 - 0.5) * 0.14) * shelf;
      // Flatten bottom slightly so boulder sits naturally in river bed with broad wet skirt
      const ySculpt = ry < 0 ? ry * 0.68 : ry * (0.86 + 0.18 * n1);
      rp.setXYZ(ri, rx * 1.32 * crag, ySculpt * (bh / bw) * crag, rz * 1.02 * crag);
    }
    rock.computeVertexNormals();
    const mRock = new THREE.Matrix4()
      .makeTranslation(bx, bh * 0.24 - 0.14, bz)
      .multiply(new THREE.Matrix4().makeRotationY(rnd() * TWO_PI));
    boulderBuilder._pushGeo(rock, mRock, 0.06, 2.0, 0, 0.82, '#42160c', '#df6d35');

    // Multi-tuft emerald river-moss cushion on larger boulders
    if (i % 2 === 0) {
      for (let mIdx = 0; mIdx < 2; mIdx++) {
        const moss = new THREE.IcosahedronGeometry(bw * (mIdx === 0 ? 0.54 : 0.38), 2);
        moss.scale(1.18, 0.32, 0.96);
        boulderBuilder._pushGeo(
          moss,
          new THREE.Matrix4().makeTranslation(bx + (mIdx - 0.5) * bw * 0.36, bh * (0.55 - mIdx * 0.06), bz),
          0.06,
          2.0,
          1,
          0.12,
          '#184d28',
          '#55b852'
        );
      }
    }

    // 3D V-Shaped Whitewater Rapids Wake Ribbon streaming downstream from each boulder!
    const baseV = wakePos.length / 3;
    const wakeLen = 2.6 + bw * 2.2;
    const segs = 5;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const along = -bw * 0.35 + t * wakeLen;
      const halfSpread = bw * 0.72 + t * bw * 1.45;
      const px = -fz;
      const pz = fx;
      const cxW = bx + fx * along;
      const czW = bz + fz * along;
      wakePos.push(
        cxW - px * halfSpread, 0.045, czW - pz * halfSpread,
        cxW + px * halfSpread, 0.045, czW + pz * halfSpread
      );
      wakeUv.push(0, t, i * 0.37, 1, t, i * 0.37);
    }
    for (let s = 0; s < segs; s++) {
      const a = baseV + s * 2;
      wakeIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.Float32BufferAttribute(wakePos, 3));
  wakeGeo.setAttribute('aWakeUv', new THREE.Float32BufferAttribute(wakeUv, 3));
  wakeGeo.setIndex(wakeIdx);

  return { boulderGeo: boulderBuilder.build(), wakeGeo, flowYaw };
}

function buildBayouLilyPadsAndLotusGeometry() {
  const b = new WatershedGeometryBuilder();
  let seed = 9928374;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 46 Floating 3D Notched Emerald Lily Pads + 22 Glowing Pink/Gold Lotus Blossoms!
  for (let i = 0; i < 46; i++) {
    const ang = (i / 46) * TWO_PI + rnd() * 0.18;
    const rad = 5.3 + (i % 5) * 4.4 + rnd() * 2.8;
    const lx = Math.sin(ang) * rad;
    const lz = Math.cos(ang) * rad;
    const padR = 0.42 + rnd() * 0.44;

    // Notched circular water-lily pad (`thetaLength = 1.86 * PI`)
    const pad = new THREE.CylinderGeometry(padR, padR * 0.96, 0.035, 9, 1, false, 0, Math.PI * 1.86);
    const mPad = new THREE.Matrix4()
      .makeTranslation(lx, 0.035, lz)
      .multiply(new THREE.Matrix4().makeRotationY(rnd() * TWO_PI));
    b._pushGeo(pad, mPad, 0.05, 1.0, 1, 0.15, '#1d5935', '#4ead5b');

    if (i % 2 === 0) {
      // Sculpted Multi-Petal Lotus Blossom + Bioluminescent Golden Heart (`matKind = 4`)!
      const mLotus = new THREE.Matrix4().makeTranslation(lx, 0.06, lz);
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * TWO_PI;
        const petal = new THREE.ConeGeometry(padR * 0.16, padR * 0.42, 4, 1, false);
        petal.rotateZ(-0.58);
        petal.translate(padR * 0.14, padR * 0.12, 0);
        const mp = mLotus.clone().multiply(new THREE.Matrix4().makeRotationY(pa));
        b._pushGeo(petal, mp, 0.05, 1.0, 1, 0.2, '#e05297', '#ffd6e7');
      }
      const heart = new THREE.OctahedronGeometry(padR * 0.13, 0);
      heart.translate(0, padR * 0.18, 0);
      b._pushGeo(heart, mLotus, 0.05, 1.0, 4, 1.0, '#ffd166', '#fff8d6');
    }
  }

  return b.build();
}

function buildPolarIceFloesGeometry() {
  const b = new WatershedGeometryBuilder();
  let seed = 3141592;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Drifting turquoise sea-ice growlers outside the inner maelstrom funnel (`r = 12..34m`)
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * TWO_PI + rnd() * 0.2;
    const rad = 12.5 + (i % 4) * 5.2 + rnd() * 2.5;
    const fx = Math.sin(ang) * rad;
    const fz = Math.cos(ang) * rad;
    const fw = 1.1 + rnd() * 1.4;
    const fh = 0.45 + rnd() * 0.85;
    const floe = new THREE.CylinderGeometry(fw * 0.85, fw * 1.12, fh, 6, 1, false);
    const mFloe = new THREE.Matrix4()
      .makeTranslation(fx, fh * 0.25 - 0.12, fz)
      .multiply(new THREE.Matrix4().makeRotationY(rnd() * TWO_PI))
      .multiply(new THREE.Matrix4().makeRotationZ((rnd() - 0.5) * 0.16));
    b._pushGeo(floe, mFloe, 0.15, 2.0, 2, 1.0, '#14b8d4', '#f0fcff');
  }
  return b.build();
}

// ============================================================================
// VOLUMETRIC GOLDEN GOD-RAYS, PRISMATIC RAINBOW ARC & SOARING 3D BIRDS
// ============================================================================

function buildGodRaysGeometry() {
  const pos = [];
  const uvs = [];
  const idx = [];
  const beams = [
    { ang: Math.PI - 0.16, r: 58, wTop: 5.5, wBot: 14.5, yTop: 46, yBot: -1.0, slantX: -12.0, seed: 0.1 },
    { ang: Math.PI - 0.30, r: 52, wTop: 4.8, wBot: 12.5, yTop: 44, yBot: -1.0, slantX: -10.5, seed: 0.4 },
    { ang: Math.PI - 0.04, r: 64, wTop: 6.2, wBot: 16.0, yTop: 48, yBot: -1.0, slantX: -13.5, seed: 0.7 },
    { ang: Math.PI + 0.14, r: 60, wTop: 4.5, wBot: 11.8, yTop: 44, yBot: -1.0, slantX: -9.8, seed: 0.9 },
  ];

  for (let i = 0; i < beams.length; i++) {
    const bm = beams[i];
    const baseV = pos.length / 3;
    const cx = Math.sin(bm.ang) * bm.r;
    const cz = Math.cos(bm.ang) * bm.r;
    pos.push(
      cx - bm.wTop * 0.5, bm.yTop, cz,
      cx + bm.wTop * 0.5, bm.yTop, cz,
      cx + bm.slantX - bm.wBot * 0.5, bm.yBot, cz + 4.0,
      cx + bm.slantX + bm.wBot * 0.5, bm.yBot, cz + 4.0
    );
    uvs.push(0, 1, bm.seed, 1, 1, bm.seed, 0, 0, bm.seed, 1, 0, bm.seed);
    idx.push(baseV, baseV + 2, baseV + 1, baseV + 1, baseV + 2, baseV + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aRayUv', new THREE.Float32BufferAttribute(uvs, 3));
  geo.setIndex(idx);
  return geo;
}

function createGodRaysMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uStrength: { value: 0.0 },
      uColor: { value: new THREE.Color('#ffe299') },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aRayUv;
      varying vec3 vRuv;
      void main() {
        vRuv = aRayUv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uStrength;
      uniform vec3 uColor;
      varying vec3 vRuv;
      void main() {
        if (uStrength <= 0.01) discard;
        float side = sin(clamp(vRuv.x, 0.0, 1.0) * 3.14159265);
        float vert = smoothstep(0.0, 0.24, vRuv.y) * smoothstep(1.0, 0.35, vRuv.y);
        float shimmer = 0.72 + 0.28 * sin(uTime * 0.55 + vRuv.z * 12.0 + vRuv.x * 5.0);
        float a = pow(side, 1.6) * vert * shimmer * uStrength * 0.14;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function buildRainbowArcGeometry() {
  // High-arching 3D spectral rainbow spanning proudly above the canyon walls & mountain peaks!
  const geo = new THREE.RingGeometry(27.0, 34.0, 56, 1, 0.06 * Math.PI, 0.88 * Math.PI);
  geo.translate(0, 6.5, -56.0);
  return geo;
}

function createRainbowArcMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uOpacity: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocal;
      void main() {
        vUv = uv;
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vLocal;

      vec3 rainbow(float t) {
        return clamp(vec3(
          abs(t * 6.0 - 3.0) - 1.0,
          2.0 - abs(t * 6.0 - 2.0),
          2.0 - abs(t * 6.0 - 4.0)
        ), 0.0, 1.0);
      }

      void main() {
        if (uOpacity <= 0.005) discard;
        float rad = length(vec2(vLocal.x, vLocal.y - 6.5));
        float bandT = clamp((rad - 27.0) / 7.0, 0.0, 1.0);
        float radialEnv = sin(bandT * 3.14159265);
        float footFade = smoothstep(4.0, 16.0, vLocal.y);
        vec3 col = rainbow(1.0 - bandT);
        float a = pow(radialEnv, 1.25) * footFade * uOpacity * 0.46;
        if (a < 0.002) discard;
        gl_FragColor = vec4(col * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function buildSoaringBirdGeometry() {
  // Graceful 3D cambered gull / canyon hawk with swept elbow-jointed wings & fanned tail (`x` in `-1.05..+1.05`)
  const pos = new Float32Array([
    0.0, 0.01, 0.42,     // 0: beak tip
    0.0, 0.06, 0.08,     // 1: chest / dorsal ridge
    0.0, 0.02, -0.26,    // 2: tail root
    -0.14, 0.03, -0.46,  // 3: tail left
    0.14, 0.03, -0.46,   // 4: tail right
    -0.46, 0.10, 0.06,   // 5: left wing elbow (forward camber)
    -1.05, 0.04, -0.22,  // 6: left swept wingtip
    0.46, 0.10, 0.06,    // 7: right wing elbow (forward camber)
    1.05, 0.04, -0.22,   // 8: right swept wingtip
  ]);
  const idx = [
    0, 1, 5,
    1, 2, 5,
    5, 2, 6,
    0, 7, 1,
    1, 7, 2,
    7, 8, 2,
    2, 3, 4,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function createSoaringBirdMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uBirdColor: { value: new THREE.Color('#f8fafc') },
      uSunRimColor: { value: new THREE.Color('#fff1c2') },
      uSunDir: { value: new THREE.Vector3(0.42, 0.36, -0.83).normalize() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vSpan;
      varying vec3 vNormW;
      void main() {
        vec3 p = position;
        float wingSpan = abs(p.x);
        vSpan = wingSpan;
        if (wingSpan > 0.08) {
          float flap = sin(uTime * 4.8 + float(gl_InstanceID) * 1.9);
          p.y += flap * pow(wingSpan, 1.35) * 0.28;
        }
        vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vNormW = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBirdColor;
      uniform vec3 uSunRimColor;
      uniform vec3 uSunDir;
      varying float vSpan;
      varying vec3 vNormW;
      void main() {
        vec3 n = gl_FrontFacing ? normalize(vNormW) : -normalize(vNormW);
        float sunLit = 0.55 + 0.45 * max(0.0, dot(n, normalize(uSunDir)));
        // Warm golden sunlit plumage + bright translucent primary feather rim (NEVER stark black triangles!)
        vec3 col = mix(uBirdColor * 0.88, uSunRimColor, clamp(sunLit * 0.52 + smoothstep(0.45, 1.0, vSpan) * 0.28, 0.0, 0.88));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

// ============================================================================
// HORIZON MIST RING, POLAR AURORA CURTAINS & MULTI-BIOME SKY DOME SHADERS
// ============================================================================

function createHorizonMistRingMaterial(cloudPanoTex) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uTime: { value: 0 },
      uWaterY: { value: -0.82 },
      uMistColor: { value: new THREE.Color('#fae0aa') },
      uRimColor: { value: new THREE.Color('#fff3cc') },
      uSunDir: { value: new THREE.Vector3(0.42, 0.36, -0.83).normalize() },
      uOpacity: { value: 0.28 },
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
      uniform vec3 uSunDir;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        float hAboveWater = vWorldPos.y - uWaterY;
        if (hAboveWater <= 0.02) discard;

        float vertEnv = smoothstep(0.02, 2.8, hAboveWater) * smoothstep(1.0, 0.38, vUv.y);
        if (vertEnv <= 0.004) discard;

        vec4 n1 = texture2D(uPanoTex, vec2(vUv.x * 3.0 + uTime * 0.005, 0.18 + vUv.y * 0.22));
        vec4 n2 = texture2D(uPanoTex, vec2(vUv.x * 5.0 - uTime * 0.008, 0.42 + vUv.y * 0.18));
        float billow = 0.38 + 0.62 * (n1.r * 0.6 + n2.b * 0.4);

        vec3 rayDir = normalize(vWorldPos - cameraPosition);
        float sunGlow = pow(max(0.0, dot(rayDir, normalize(uSunDir))), 5.0);
        vec3 col = mix(uMistColor * 0.82, uRimColor * 0.92, sunGlow * 0.55 + n1.g * 0.14);
        float alpha = clamp(vertEnv * billow * uOpacity, 0.0, 0.46);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function buildAuroraRibbonsGeometry() {
  const curtains = [
    { r: 66, y0: 15, h: 22, span: 1.65, angCenter: Math.PI + 0.32, waveAmp: 4.8, layer: 0.0 },
    { r: 76, y0: 19, h: 24, span: 1.85, angCenter: Math.PI - 0.20, waveAmp: 5.8, layer: 0.5 },
    { r: 84, y0: 23, h: 20, span: 2.10, angCenter: Math.PI + 0.04, waveAmp: 6.4, layer: 1.0 },
  ];
  const segX = 36;
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
      uColorHigh: { value: new THREE.Color('#a855f7') },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aAuroraUv;
      uniform float uTime;
      varying vec3 vAuv;
      void main() {
        vAuv = aAuroraUv;
        vec3 p = position;
        float sway = sin(uTime * 0.58 + aAuroraUv.x * 12.0 + aAuroraUv.z * 4.0) * (1.4 + aAuroraUv.y * 2.6);
        p.x += sway;
        p.z += cos(uTime * 0.44 + aAuroraUv.x * 9.0) * 1.2;
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
        float horizFade = smoothstep(0.0, 0.16, u) * smoothstep(1.0, 0.84, u);
        float vertCurtain = smoothstep(0.0, 0.15, v) * exp(-max(0.0, v - 0.14) * 3.1);
        vec4 streak = texture2D(uPanoTex, vec2(u * 4.0 + uTime * 0.016 + vAuv.z * 0.31, 0.35 + v * 0.15));
        float rays = 0.38 + 0.62 * pow(streak.g, 1.5) * (0.65 + 0.35 * sin(u * 92.0 + uTime * 1.9));
        vec3 col = mix(uColorLow, uColorHigh, smoothstep(0.14, 0.78, v));
        float alpha = clamp(horizFade * vertCurtain * rays * uStrength * 0.76, 0.0, 0.88);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createBiomeSkyMaterial(cloudPanoTex, celestialTex) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uPanoTex: { value: cloudPanoTex },
      uCelestialTex: { value: celestialTex },
      uTime: { value: 0 },
      uYaw: { value: 0 },
      uSkyMode: { value: 0 },
      uZenithColor: { value: new THREE.Color('#1a62b8') },
      uMidSkyColor: { value: new THREE.Color('#4ea8e8') },
      uHorizonColor: { value: new THREE.Color('#f7c278') },
      uHorizonMistColor: { value: new THREE.Color('#fae0aa') },
      uCloudDark: { value: new THREE.Color('#8ba8c7') },
      uCloudMid: { value: new THREE.Color('#e8eff7') },
      uCloudRim: { value: new THREE.Color('#fff3cc') },
      uCelestialTint: { value: new THREE.Color('#fff6d6') },
      uCoronaColor: { value: new THREE.Color('#ffcf6e') },
      uSunGlowColor: { value: new THREE.Color('#ffb84d') },
      uSunDir: { value: new THREE.Vector3(0.42, 0.36, -0.83).normalize() },
      uBoltDir: { value: new THREE.Vector3(-0.35, 0.32, -0.88).normalize() },
      uCelestialRadius: { value: 0.036 },
      uCelestialAmt: { value: 1.25 },
      uSunDisc: { value: 1.0 },
      uCloudCover: { value: 0.48 },
      uStarAmt: { value: 0.0 },
      uAuroraAmt: { value: 0.0 },
      uBlackout: { value: 0.0 },
      uLightning: { value: 0.0 },
      uPurification: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec3 worldPos = cameraPosition + vDir * 145.0;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uPanoTex;
      uniform sampler2D uCelestialTex;
      uniform float uTime;
      uniform float uYaw;
      uniform float uSkyMode;
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uHorizonMistColor;
      uniform vec3 uCloudDark;
      uniform vec3 uCloudMid;
      uniform vec3 uCloudRim;
      uniform vec3 uCelestialTint;
      uniform vec3 uCoronaColor;
      uniform vec3 uSunGlowColor;
      uniform vec3 uSunDir;
      uniform vec3 uBoltDir;
      uniform float uCelestialRadius;
      uniform float uCelestialAmt;
      uniform float uSunDisc;
      uniform float uCloudCover;
      uniform float uStarAmt;
      uniform float uAuroraAmt;
      uniform float uBlackout;
      uniform float uLightning;
      uniform float uPurification;

      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float uAz = (atan(d.x, d.z) + uYaw) * 0.159154943;
        float darkScale = mix(1.0, 0.28, clamp(uBlackout, 0.0, 1.0));

        // 1. Multi-Stop Rayleigh & Golden-Hour / Alpenglow / Sunset / Lagoon / Polar Gradient
        float tMid = smoothstep(-0.04, 0.28, h);
        float tTop = smoothstep(0.20, 0.80, h);
        vec3 col = mix(uHorizonColor, uMidSkyColor, tMid);
        col = mix(col, uZenithColor, tTop);
        col *= (1.0 + uPurification * 0.08) * darkScale;

        // Warm Mie forward-scattering solar glow across the sunward horizon!
        vec3 sFwd = normalize(uSunDir);
        float sunCos = max(0.0, dot(d, sFwd));
        float mieWide = pow(sunCos, 4.5) * exp(-max(0.0, h) * 2.8);
        col += uSunGlowColor * mieWide * (uSunDisc > 0.5 ? 0.34 : 0.14) * darkScale;

        // Soft horizon haze cushion right along waterline [-0.06..+0.05]
        float shHaze = (h + 0.008) * 17.0;
        col = mix(col, uHorizonMistColor * darkScale * 0.90, exp(-shHaze * shHaze) * 0.42);

        // 2. Twilight / Polar Pinprick Stars (ONLY in Mist Bayou zenith & Polar Storm Ocean!)
        vec3 starContrib = vec3(0.0);
        if (uStarAmt > 0.01 && h > 0.12) {
          vec2 sg = vec2(uAz * 230.0, h * 115.0);
          vec2 si = floor(sg);
          vec2 sf = fract(sg) - 0.5;
          float sr = hash21(si + 5.3);
          if (sr > 0.86) {
            vec2 sj = vec2(hash21(si + 19.1), hash21(si + 41.7)) - 0.5;
            float sd = length(sf - sj * 0.52);
            float stw = 0.65 + 0.35 * sin(uTime * (1.8 + sr * 2.8) + sr * 31.0);
            float sMask = exp(-sd * sd * 145.0) * stw * smoothstep(0.14, 0.42, h);
            starContrib = vec3(0.82, 0.90, 1.0) * sMask * uStarAmt * 0.72 * darkScale;
          }
        }

        // 3. Sky-Dome Polar Aurora Glow Veil ('storm_ocean')
        if (uAuroraAmt > 0.01 && h > 0.04) {
          vec4 aurN = texture2D(uPanoTex, vec2(uAz * 3.0 + uTime * 0.012, clamp(h * 1.4, 0.02, 0.98)));
          float aurBand = smoothstep(0.05, 0.28, h) * smoothstep(0.82, 0.38, h);
          vec3 aurCol = mix(vec3(0.0, 0.88, 0.58), vec3(0.62, 0.24, 0.92), smoothstep(0.18, 0.62, h));
          col += aurCol * pow(aurN.g, 1.6) * aurBand * uAuroraAmt * 0.42 * darkScale;
        }

        // 4. Radiant Volumetric Sun Disc (Daylight / Sunset Biomes) OR Polar Moon ('storm_ocean')
        vec3 sRight = normalize(cross(sFwd, vec3(0.0, 1.0, 0.0)));
        vec3 sUp = cross(sRight, sFwd);
        vec2 sUv = vec2(dot(d, sRight), dot(d, sUp)) / max(0.01, uCelestialRadius);
        float rNorm = dot(d, sFwd) > 0.0 ? length(sUv) : 99.0;
        float celEff = uCelestialAmt * mix(1.0, 0.4, uBlackout);

        float vCoord = clamp((h + 0.05) * 1.16, 0.01, 0.99);
        vec4 p1 = texture2D(uPanoTex, vec2(uAz * 2.0 + uTime * 0.0026, vCoord));
        vec4 p2 = texture2D(uPanoTex, vec2(uAz * 4.0 - uTime * 0.0042 + (p1.r - 0.5) * 0.035, clamp(vCoord * 1.35 - 0.04, 0.01, 0.99)));
        vec4 pWisp = texture2D(uPanoTex, vec2(uAz * 5.0 + uTime * 0.0060, clamp(vCoord * 1.65 + 0.06, 0.01, 0.99)));

        col += starContrib * (1.0 - clamp(exp(-rNorm * 0.8) * 2.0, 0.0, 1.0));

        if (uSunDisc > 0.5) {
          // Physical Solar Disc + Warm Golden Aureole + Subtle Sunburst Rays!
          float rayAng = atan(sUv.y, sUv.x);
          float rays = 0.82 + 0.18 * sin(rayAng * 12.0 + uTime * 0.35) * cos(rayAng * 7.0 - uTime * 0.22);
          float innerHalo = exp(-max(0.0, rNorm - 0.85) * 2.1) * rays;
          float outerHalo = exp(-rNorm * 0.48);
          col += uCoronaColor * (innerHalo * 0.48 + outerHalo * 0.16) * celEff;
          if (rNorm < 1.15) {
            float sunCore = smoothstep(1.08, 0.72, rNorm);
            col = mix(col, uCelestialTint * 1.65 * celEff, sunCore);
          }
        } else {
          // Polar Storm-Break Moon & Cyan-Emerald Corona
          float cInner = exp(-max(0.0, rNorm - 0.95) * 2.5) * (0.55 + 0.65 * pWisp.b);
          float cMid = exp(-rNorm * 0.75) * (0.70 + 0.50 * p1.r);
          col += uCoronaColor * (cInner * 0.26 + cMid * 0.14) * celEff;
          if (rNorm < 1.03) {
            vec2 moonUv = vec2(0.5 + sUv.x * 0.48, 0.5 + sUv.y * 0.48);
            vec4 lunar = texture2D(uCelestialTex, clamp(moonUv, 0.0, 1.0));
            col = mix(col, lunar.rgb * uCelestialTint * 1.08 * celEff, lunar.a);
          }
        }

        // 5. Towering Billowy Sunlit Cumulus, Rose-Gold Alpenglow & Sunset Cloud Banks!
        //    (Capped cleanly below postfx neutral-white bloom threshold so clouds stay crisp & puffy!)
        if (h > -0.04) {
          float vertMask = smoothstep(-0.04, 0.04, h) * (1.0 - smoothstep(0.55, 0.92, h));
          float rawCumulus = p1.r * 0.56 + p2.r * 0.32 + pWisp.b * 0.12;
          float turretNormal = clamp(p1.g * 0.58 + p2.g * 0.42, 0.0, 1.0);

          float sunWindow = smoothstep(0.75, 2.25, rNorm);
          float thresh = mix(0.64, 0.36, clamp(uCloudCover, 0.0, 1.0));
          float mainCloud = smoothstep(thresh, thresh + 0.26, rawCumulus) * vertMask * sunWindow;
          float fineWisps = smoothstep(0.48, 0.84, pWisp.b * 0.64 + p2.b * 0.36) * vertMask * 0.36;
          float cloudDensity = clamp(mainCloud + fineWisps * (1.0 - mainCloud * 0.55), 0.0, 1.0);

          float thinFringe = smoothstep(0.03, 0.30, cloudDensity) * exp(-cloudDensity * 3.4);
          float crestLit = pow(smoothstep(0.38, 0.84, turretNormal), 1.35);
          float sunProx = exp(-rNorm * 0.45) * 1.35 + 0.45;
          float rimGlow = (thinFringe * 1.15 + crestLit * 0.88) * sunProx;

          // Bright sunlit cloud tops vs soft atmospheric shadow bases (NEVER black in daytime!)
          vec3 cBody = mix(uCloudDark, uCloudMid, smoothstep(0.12, 0.72, turretNormal)) * darkScale;
          cBody = mix(cBody, uCloudRim * 0.94, clamp(rimGlow * 0.56, 0.0, 0.92));

          if (uLightning > 0.005) {
            float boltProx = pow(max(dot(d, normalize(uBoltDir)), 0.0), 7.0);
            cBody += vec3(0.36, 0.62, 0.92) * uLightning * (boltProx * 0.85 + 0.12);
          }

          float maxAlpha = rNorm < 1.25 ? 0.35 : 0.92;
          col = mix(col, min(cBody, vec3(1.02)), clamp(cloudDensity * 0.92, 0.0, maxAlpha));
        }

        if (h < -0.02) {
          vec3 waterRefl = mix(uHorizonMistColor * 0.78, uMidSkyColor * 0.65, smoothstep(-0.02, -0.24, h)) * darkScale;
          col = mix(col, waterRefl, smoothstep(-0.02, -0.14, h));
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createFireflyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFocusY: { value: 2.0 },
      uWaterY: { value: -0.82 },
      uCamYaw: { value: 0 },
      uWind: { value: 0 },
      uPixelRatio: { value: 2.0 },
      uColorA: { value: new THREE.Color('#ffd147') },
      uColorB: { value: new THREE.Color('#ffb703') },
      uColorC: { value: new THREE.Color('#52ffb8') },
      uIntensity: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      attribute vec4 aParams;

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

        float rad = aSeed.y + sin(uTime * (spd * 1.3) + phase * 2.1) * 0.28;

        float worldY;
        if (isSurf > 0.5) {
          worldY = uWaterY + 0.16 + fract(aSeed.z + uTime * 0.048) * 2.6 + sin(uTime * 1.8 + phase) * 0.16;
        } else {
          float span = 18.0;
          float localY = mod(aSeed.z * span + uTime * spd * 0.50 + sin(uTime * 1.3 + phase) * 0.35, span) - span * 0.46;
          worldY = max(uWaterY + 0.24, uFocusY + localY);
        }

        vec3 worldPos = vec3(sin(ang) * rad, worldY, cos(ang) * rad);
        vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
        float dist = max(1.5, -mvPosition.z);

        float pulse1 = 0.5 + 0.5 * sin(uTime * (1.7 + spd * 2.2) + phase);
        float pulse2 = 0.5 + 0.5 * cos(uTime * (0.9 + spd * 1.3) - phase * 1.6);
        vTwinkle = 0.36 + 0.64 * pow(pulse1 * 0.65 + pulse2 * 0.35, 1.3);
        vColorMix = aParams.z;
        vDepthFade = smoothstep(46.0, 7.0, dist);

        float basePt = aParams.y * (0.84 + 0.34 * vTwinkle);
        gl_PointSize = clamp(basePt * uPixelRatio * (245.0 / dist), 5.0, 72.0);
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
          col = tint * (softBell * 0.88) + mix(tint, vec3(1.0, 0.96, 0.82), 0.4) * warmCore * 0.52;
          alpha = clamp((softBell * 0.54 + warmCore * 0.32) * vTwinkle * vDepthFade * uIntensity, 0.0, 1.0);
        } else {
          float core = exp(-r2 * 44.0);
          float innerHalo = exp(-r2 * 5.2);
          float outerAura = pow(max(0.0, 1.0 - r), 2.3) * 0.62;
          vec3 coreTint = mix(tint * 1.35, vec3(1.0, 0.98, 0.88), 0.55);
          col = tint * (innerHalo * 0.96 + outerAura * 0.84) + coreTint * core * 1.15;
          alpha = clamp((core * 0.95 + innerHalo * 0.80 + outerAura * 0.72) * vTwinkle * vDepthFade * uIntensity, 0.0, 1.0);
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
      uFoamColor: { value: new THREE.Color('#f4fbff') },
      uShadowColor: { value: new THREE.Color('#4a8db8') },
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
        gl_PointSize = clamp(aSize * uPixelRatio * (225.0 / dist), 2.0, 110.0);
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
    this.cols = opts.cols || DEFAULT_COLS;
    this.colAngle = TWO_PI / this.cols;
    this.era = 'reboot';
    this.currentTheme = resolveBiomeKey(opts.theme || 'canyon_river');
    this._forcedTheme = null;
    this._purification = 0;
    this._purificationTarget = 0;
    this._reflectionPass = false;
    this._disposed = false;

    // Pre-allocated scratch math objects (ZERO per-frame allocations!)
    this.moonDirection = new THREE.Vector3(0.42, 0.36, -0.83).normalize();
    this.sunDirection = this.moonDirection;
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
    this._yAxis = new THREE.Vector3(0, 1, 0);

    this._ownedTextures = [];
    this._ownedGeometries = [];
    this._ownedMaterials = [];

    this.root = new THREE.Group();
    this.root.name = 'StormAtmosphere';
    this.group = this.root;

    this._buildSharedTextures();
    this._buildSkyDome();
    this._buildWatershedVistasAndMist();
    this._buildWaterfallsAndRainbows();
    this._buildForegroundWaterEcosystems();
    this._buildAuroraRibbons();
    this._buildSoaringBirds();
    this._buildFlankMist();
    this._buildFireflies();
    this._buildSeaSprayPlumes();
    this._buildWeatherSystems();
    this._buildLightningBolts();

    this._setVistaKind(this.currentTheme);
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
    this.celestialTex = this._trackTex(createCelestialDiscTexture(512));
    this.wispTex = this._trackTex(createSoftWispTexture());
    this.glowTex = this._trackTex(createRadialGlowTexture(64));
  }

  _buildSkyDome() {
    const skyGeo = this._trackGeo(new THREE.SphereGeometry(145, 28, 18));
    this.skyMat = this._trackMat(createBiomeSkyMaterial(this.cloudPanoTex, this.celestialTex));
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyDome.renderOrder = -1000;
    this.skyDome.frustumCulled = false;
    this.root.add(this.skyDome);
  }

  _buildWatershedVistasAndMist() {
    this.archipelagoGroup = new THREE.Group();
    this.vistaMat = this._trackMat(createWatershedVistaMaterial(this.cloudPanoTex));

    this.vistaMeshes = {};
    for (let i = 0; i < BIOME_KEYS.length; i++) {
      const k = BIOME_KEYS[i];
      const geo = this._trackGeo(buildBiomeVistaGeometry(k));
      const mesh = new THREE.Mesh(geo, this.vistaMat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -500;
      mesh.visible = k === this.currentTheme;
      this.vistaMeshes[k] = mesh;
      this.archipelagoGroup.add(mesh);
    }
    this._activeVistaKey = this.currentTheme;
    this.root.add(this.archipelagoGroup);

    // 2-shell rolling horizon mist ring starting flush at waterY
    const innerCyl = new THREE.CylinderGeometry(64, 66, 9.5, 28, 1, true);
    innerCyl.translate(0, 4.75, 0);
    const outerCyl = new THREE.CylinderGeometry(88, 90, 13.5, 28, 1, true);
    outerCyl.translate(0, 6.75, 0);

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

  _buildWaterfallsAndRainbows() {
    this.waterfallGroup = new THREE.Group();
    this.waterfallMat = this._trackMat(createWaterfallMaterial(this.cloudPanoTex));

    // Canyon River: 6 thundering cliffside waterfalls positioned on the FRONT camera-facing
    // sandstone cliff faces (`rTop = 31.5..43.0 -> rBot = 28.0..38.5`, 100% unoccluded on portrait & wide!)
    const canyonFalls = this._trackGeo(
      buildWaterfallsGeometry([
        { ang: Math.PI + 0.21, rTop: 31.8, rBot: 28.4, yTop: 15.8, width: 3.4, seed: 0.11 },
        { ang: Math.PI - 0.21, rTop: 33.4, rBot: 29.8, yTop: 16.5, width: 3.6, seed: 0.37 },
        { ang: Math.PI + 0.42, rTop: 41.2, rBot: 36.8, yTop: 21.5, width: 4.8, seed: 0.61 },
        { ang: Math.PI - 0.43, rTop: 42.8, rBot: 38.2, yTop: 22.2, width: 5.0, seed: 0.83 },
        { ang: Math.PI + 1.15, rTop: 36.5, rBot: 32.5, yTop: 17.0, width: 3.8, seed: 0.49 },
        { ang: Math.PI - 1.18, rTop: 37.5, rBot: 33.5, yTop: 17.5, width: 3.8, seed: 0.92 },
      ])
    );
    this.canyonWaterfallMesh = new THREE.Mesh(canyonFalls, this.waterfallMat);
    this.canyonWaterfallMesh.frustumCulled = false;
    this.canyonWaterfallMesh.renderOrder = -380;

    // Alpine Lake: 3 high-mountain snowmelt cascades on front granite spurs!
    const alpineFalls = this._trackGeo(
      buildWaterfallsGeometry([
        { ang: Math.PI + 0.20, rTop: 45.2, rBot: 41.0, yTop: 19.5, width: 3.0, seed: 0.22 },
        { ang: Math.PI - 0.19, rTop: 46.8, rBot: 42.5, yTop: 21.0, width: 3.2, seed: 0.55 },
        { ang: Math.PI + 0.88, rTop: 47.0, rBot: 42.8, yTop: 18.0, width: 2.8, seed: 0.77 },
      ])
    );
    this.alpineWaterfallMesh = new THREE.Mesh(alpineFalls, this.waterfallMat);
    this.alpineWaterfallMesh.frustumCulled = false;
    this.alpineWaterfallMesh.renderOrder = -380;

    // Mist Bayou: Soft ancient mossy temple spillways aligned directly with sunken temple ruins!
    const bayouFalls = this._trackGeo(
      buildWaterfallsGeometry([
        { ang: Math.PI + 0.33, rTop: 40.8, rBot: 38.8, yTop: 5.4, width: 1.9, seed: 0.19 },
        { ang: Math.PI - 0.34, rTop: 42.6, rBot: 40.5, yTop: 5.8, width: 2.0, seed: 0.64 },
      ])
    );
    this.bayouWaterfallMesh = new THREE.Mesh(bayouFalls, this.waterfallMat);
    this.bayouWaterfallMesh.frustumCulled = false;
    this.bayouWaterfallMesh.renderOrder = -380;

    this.waterfallGroup.add(this.canyonWaterfallMesh, this.alpineWaterfallMesh, this.bayouWaterfallMesh);
    this.root.add(this.waterfallGroup);

    // Volumetric Golden Morning / Tropical God-Rays
    const rayGeo = this._trackGeo(buildGodRaysGeometry());
    this.godRaysMat = this._trackMat(createGodRaysMaterial());
    this.godRaysMesh = new THREE.Mesh(rayGeo, this.godRaysMat);
    this.godRaysMesh.frustumCulled = false;
    this.godRaysMesh.renderOrder = -320;
    this.root.add(this.godRaysMesh);

    // 3D Spectral Mist & Ecosystem Purification Rainbow Arc
    const rbGeo = this._trackGeo(buildRainbowArcGeometry());
    this.rainbowMat = this._trackMat(createRainbowArcMaterial());
    this.rainbowMesh = new THREE.Mesh(rbGeo, this.rainbowMat);
    this.rainbowMesh.frustumCulled = false;
    this.rainbowMesh.renderOrder = -340;
    this.root.add(this.rainbowMesh);
  }

  _buildForegroundWaterEcosystems() {
    // 1. Above-water / waterline props (`waterWorldGroup`): River Boulders + Wakes, Bayou Lily Pads + Lotus, Polar Floes
    this.waterWorldGroup = new THREE.Group();

    const { boulderGeo, wakeGeo } = buildRiverBouldersAndWakesGeometry();
    this._trackGeo(boulderGeo);
    this._trackGeo(wakeGeo);
    this.riverBouldersMesh = new THREE.Mesh(boulderGeo, this.vistaMat);
    this.riverBouldersMesh.frustumCulled = false;
    this.riverBouldersMesh.renderOrder = -20;

    this.boulderWakeMat = this._trackMat(
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        fog: false,
        uniforms: {
          uPanoTex: { value: this.cloudPanoTex },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          attribute vec3 aWakeUv;
          varying vec3 vWuv;
          void main() {
            vWuv = aWakeUv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D uPanoTex;
          uniform float uTime;
          varying vec3 vWuv;
          void main() {
            float u = vWuv.x;
            float t = vWuv.y;
            float seed = vWuv.z;
            // V-shaped standing Kelvin foam arms on left & right edges of wake!
            float armL = exp(-pow((u - 0.16) / 0.16, 2.0));
            float armR = exp(-pow((u - 0.84) / 0.16, 2.0));
            float centerTurb = (1.0 - t) * sin(clamp(u, 0.0, 1.0) * 3.14159);
            vec4 n = texture2D(uPanoTex, vec2(u * 1.2 + seed, fract(t * 1.4 - uTime * 0.85 + seed)));
            float foam = (armL + armR + centerTurb * 0.55) * (0.45 + 0.65 * n.r) * (1.0 - t * 0.88) * smoothstep(0.0, 0.12, t);
            float a = clamp(foam * 0.82, 0.0, 0.86);
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(0.92, 0.98, 1.0), a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      })
    );
    this.boulderWakeMesh = new THREE.Mesh(wakeGeo, this.boulderWakeMat);
    this.boulderWakeMesh.frustumCulled = false;
    this.boulderWakeMesh.renderOrder = 5;

    const lilyGeo = this._trackGeo(buildBayouLilyPadsAndLotusGeometry());
    this.bayouLilyMesh = new THREE.Mesh(lilyGeo, this.vistaMat);
    this.bayouLilyMesh.frustumCulled = false;
    this.bayouLilyMesh.renderOrder = -18;

    const floeGeo = this._trackGeo(buildPolarIceFloesGeometry());
    this.polarFloesMesh = new THREE.Mesh(floeGeo, this.vistaMat);
    this.polarFloesMesh.frustumCulled = false;
    this.polarFloesMesh.renderOrder = -18;

    this.waterWorldGroup.add(
      this.riverBouldersMesh,
      this.boulderWakeMesh,
      this.bayouLilyMesh,
      this.polarFloesMesh
    );
    this.root.add(this.waterWorldGroup);

    // 2. Underwater Coral Reef Shelves & Gliding 3D Manta Rays (`underwaterGroup`, `y < waterY`, opaque!)
    //    Rendered BEFORE transparent `OceanSurface` so reefs & manta rays shine right through `coral_sea` water!
    this.underwaterGroup = new THREE.Group();
    this.reefMat = this._trackMat(createUnderwaterReefMaterial());

    const reefGeo = this._trackGeo(buildCoralReefShelfGeometry());
    this.coralReefMesh = new THREE.Mesh(reefGeo, this.reefMat);
    this.coralReefMesh.frustumCulled = false;
    this.coralReefMesh.renderOrder = -25;

    const mantaCount = 12;
    this._mantaCount = mantaCount;
    const mantaGeo = this._trackGeo(buildMantaRayGeometry());
    this.mantaInstMesh = new THREE.InstancedMesh(mantaGeo, this.reefMat, mantaCount);
    this.mantaInstMesh.frustumCulled = false;
    this.mantaInstMesh.renderOrder = -24;

    // Pre-allocated Manta Ray orbit parameters: [baseAng, orbitR, depthY, angSpeed, scale, dirSign]
    this._mantaParams = new Float32Array(mantaCount * 6);
    for (let i = 0; i < mantaCount; i++) {
      const k = i * 6;
      this._mantaParams[k] = (i / mantaCount) * TWO_PI + 0.22;
      this._mantaParams[k + 1] = 6.2 + (i % 4) * 3.6;
      this._mantaParams[k + 2] = -0.52 - (i % 3) * 0.22;
      this._mantaParams[k + 3] = 0.12 + (i % 3) * 0.035;
      this._mantaParams[k + 4] = 0.92 + (i % 3) * 0.26;
      this._mantaParams[k + 5] = i % 2 === 0 ? 1 : -1;
    }

    this.underwaterGroup.add(this.coralReefMesh, this.mantaInstMesh);
    this.root.add(this.underwaterGroup);
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

  _buildSoaringBirds() {
    const birdCount = 16;
    this._birdCount = birdCount;
    const birdGeo = this._trackGeo(buildSoaringBirdGeometry());
    this.birdMat = this._trackMat(createSoaringBirdMaterial());
    this.birdsMesh = new THREE.InstancedMesh(birdGeo, this.birdMat, birdCount);
    this.birdsMesh.frustumCulled = false;
    this.birdsMesh.renderOrder = -250;

    // [baseAng, orbitR, altY, speed, scale]
    this._birdParams = new Float32Array(birdCount * 5);
    for (let i = 0; i < birdCount; i++) {
      const k = i * 5;
      this._birdParams[k] = Math.PI + ((i - 8) / 8) * 1.45;
      this._birdParams[k + 1] = 28.0 + (i % 4) * 9.5;
      this._birdParams[k + 2] = 9.0 + (i % 5) * 3.4;
      this._birdParams[k + 3] = (0.14 + (i % 3) * 0.04) * (i % 2 === 0 ? 1 : -1);
      this._birdParams[k + 4] = 0.55 + (i % 3) * 0.16;
    }
    this.root.add(this.birdsMesh);
  }

  _buildFlankMist() {
    const count = 24;
    this._mistCount = count;
    const geo = this._trackGeo(new THREE.PlaneGeometry(1, 1));
    const mat = this._trackMat(
      new THREE.MeshBasicMaterial({
        map: this.wispTex,
        color: '#dbeafe',
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        fog: true,
      })
    );
    this.flankMistMesh = new THREE.InstancedMesh(geo, mat, count);
    this.flankMistMesh.frustumCulled = false;
    this.flankMistMesh.renderOrder = -10;

    this._mistData = new Float32Array(count * 8);
    let seed = 20260808;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const k = i * 8;
      const side = i % 2 === 0 ? -1 : 1;
      this._mistData[k] = side;
      this._mistData[k + 1] = side * (this.towerRadius + 1.2 + rnd() * 3.8);
      this._mistData[k + 2] = -3.4 + rnd() * 2.6;
      this._mistData[k + 3] = (i / count) * 16.0;
      const w = 4.2 + rnd() * 3.2;
      this._mistData[k + 4] = w;
      this._mistData[k + 5] = w * (0.42 + rnd() * 0.14);
      this._mistData[k + 6] = (0.14 + rnd() * 0.18) * (rnd() < 0.5 ? -1 : 1);
      this._mistData[k + 7] = rnd() * TWO_PI;
    }
    this.root.add(this.flankMistMesh);
  }

  _buildFireflies() {
    const count = 220;
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

      if (i >= 165) {
        tier = 1.0; // Low water-surface fireflies hovering right above lily pads & ripples!
        baseAng = (rnd() - 0.5) * TWO_PI;
        radius = this.towerRadius + 0.45 + rnd() * 11.5;
        worldScale = 0.38 + rnd() * 0.36;
      } else if (i >= 130) {
        tier = 2.0; // Soft sunlit bokeh orbs
        const side = i % 2 === 0 ? -1 : 1;
        baseAng = side * (0.42 + rnd() * 1.15);
        radius = this.towerRadius + 1.1 + rnd() * 5.5;
        worldScale = 0.90 + rnd() * 0.72;
      } else if (i < 90) {
        const side = i % 2 === 0 ? -1 : 1;
        baseAng = side * (0.36 + rnd() * 1.20);
        radius = this.towerRadius + 0.55 + rnd() * 6.2;
        worldScale = 0.46 + rnd() * 0.66;
      } else {
        baseAng = ((i - 90) / 40) * TWO_PI + rnd() * 0.35;
        radius = this.towerRadius + 0.6 + rnd() * 6.8;
        worldScale = 0.45 + rnd() * 0.62;
      }

      seeds[i4] = baseAng;
      seeds[i4 + 1] = radius;
      seeds[i4 + 2] = rnd();
      seeds[i4 + 3] = rnd() * TWO_PI;

      params[i4] = 0.20 + rnd() * 0.44;
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
    const count = 88;
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
      const ang = i < 60 ? (i % 2 === 0 ? -1 : 1) * (0.44 + rnd() * 0.88) : (rnd() - 0.5) * 1.25;
      const isDroplet = i >= 62;
      this._sprayState[k] = ang;
      this._sprayState[k + 1] = this.towerRadius + 0.20 + rnd() * (isDroplet ? 2.1 : 1.45);
      this._sprayState[k + 2] = 0.44 + rnd() * 0.36;
      this._sprayState[k + 3] = rnd();
      this._sprayState[k + 4] = isDroplet ? 1.4 + rnd() * 1.5 : 1.05 + rnd() * 1.35;
      this._sprayState[k + 5] = isDroplet ? 0.26 + rnd() * 0.26 : 1.25 + rnd() * 1.35;
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
    // Drifting Alpine Blossoms / Pine Needles ('alpine_lake') & Polar Ice Crystals ('storm_ocean')
    const pCount = 220;
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
      this._weatherPos[i3] = (rnd() - 0.5) * 20.0;
      this._weatherPos[i3 + 1] = (rnd() - 0.5) * 20.0;
      this._weatherPos[i3 + 2] = -2.5 + rnd() * 9.0;
      this._weatherMeta[i3] = 0.75 + rnd() * 1.25;
      this._weatherMeta[i3 + 1] = 0.85 + rnd() * 1.5;
      this._weatherMeta[i3 + 2] = rnd() * TWO_PI;
    }

    const wGeo = this._trackGeo(new THREE.BufferGeometry());
    this._weatherPosAttr = new THREE.BufferAttribute(this._weatherPos, 3);
    wGeo.setAttribute('position', this._weatherPosAttr);

    this.weatherMat = this._trackMat(
      new THREE.PointsMaterial({
        size: 0.15,
        map: this.glowTex,
        color: '#ffd6e7',
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

    const rainN = 96;
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
      this._streakState[k5] = (rnd() - 0.5) * 20.0;
      this._streakState[k5 + 1] = (rnd() - 0.5) * 20.0;
      this._streakState[k5 + 2] = isGust ? this.towerRadius + 0.5 + rnd() * 3.4 : -2.0 + rnd() * 8.5;
      this._streakState[k5 + 3] = isGust ? 1.05 + rnd() * 1.55 : 0.52 + rnd() * 0.36;
      this._streakState[k5 + 4] = isGust ? 8.5 + rnd() * 6.5 : 14.5 + rnd() * 5.0;

      this._streakCol[k6] = isGust ? 0.82 : 0.62;
      this._streakCol[k6 + 1] = isGust ? 0.94 : 0.82;
      this._streakCol[k6 + 2] = 1.0;
      this._streakCol[k6 + 3] = 0.08;
      this._streakCol[k6 + 4] = 0.14;
      this._streakCol[k6 + 5] = 0.20;
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
          uGlowColor: { value: new THREE.Color('#5efce8') },
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
            vec3 col = uGlowColor * halo * 1.15 + uCoreColor * core * 1.9;
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
    this._ambientBoltTimer = 2.4;
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
    const side = this._nextBoltRand() < 0.5 ? -1 : 1;
    const boltZ = -24.0 - this._nextBoltRand() * 6.0;
    const minClearX = aspect < 0.72 ? 6.2 : 8.0;
    const maxSpanX = Math.max(minClearX + 1.5, Math.min(16.0, aspect * 13.5));
    const topX = camX + side * (minClearX + this._nextBoltRand() * (maxSpanX - minClearX) * 0.65);
    const topY = camY + 15.0 + this._nextBoltRand() * 4.0;
    const botY = camY - 2.0 - this._nextBoltRand() * 2.5;

    this._boltDir.set(topX - camX, 8.5, boltZ).normalize();
    this.skyMat.uniforms.uBoltDir.value.copy(this._boltDir);

    const trunkSegs = 14;
    const sp = this._boltSpine;
    let curX = topX;
    for (let i = 0; i <= trunkSegs; i++) {
      const t = i / trunkSegs;
      if (i > 0) curX += (this._nextBoltRand() - 0.48) * 1.15;
      sp[i * 3] = curX;
      sp[i * 3 + 1] = topY + (botY - topY) * t;
      sp[i * 3 + 2] = boltZ;
    }

    let segCursor = 0;
    for (let i = 0; i < trunkSegs; i++) {
      const t0 = i / trunkSegs;
      const t1 = (i + 1) / trunkSegs;
      const w0 = 0.24 * (1 - t0 * 0.55);
      const w1 = 0.24 * (1 - t1 * 0.55);
      this._writeRibbonSeg(
        segCursor++,
        sp[i * 3], sp[i * 3 + 1], sp[i * 3 + 2],
        sp[(i + 1) * 3], sp[(i + 1) * 3 + 1], sp[(i + 1) * 3 + 2],
        w0, w1
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
        const nx = fx + fDir * (0.45 + this._nextBoltRand() * 0.62) + (this._nextBoltRand() - 0.5) * 0.36;
        const ny = fy - (0.60 + this._nextBoltRand() * 0.55);
        const w0 = 0.12 * (1 - s / 6);
        const w1 = 0.12 * (1 - (s + 1) / 6);
        this._writeRibbonSeg(segCursor++, fx, fy, fz, nx, ny, fz, w0, Math.max(0.014, w1));
        fx = nx;
        fy = ny;
      }
    }
    this._boltPosAttr.needsUpdate = true;
  }

  _setVistaKind(kind) {
    const resolved = resolveBiomeKey(kind);
    for (let i = 0; i < BIOME_KEYS.length; i++) {
      const k = BIOME_KEYS[i];
      this.vistaMeshes[k].visible = k === resolved;
    }
    this._activeVistaKey = resolved;

    // Toggle biome-specific waterfalls & foreground water ecosystems!
    this.canyonWaterfallMesh.visible = resolved === 'canyon_river';
    this.alpineWaterfallMesh.visible = resolved === 'alpine_lake';
    this.bayouWaterfallMesh.visible = resolved === 'mist_bayou';

    this.riverBouldersMesh.visible = resolved === 'canyon_river';
    this.boulderWakeMesh.visible = resolved === 'canyon_river';
    this.bayouLilyMesh.visible = resolved === 'mist_bayou';
    this.polarFloesMesh.visible = resolved === 'storm_ocean';
    this.underwaterGroup.visible = resolved === 'coral_sea' && !this._reflectionPass;
  }

  setTheme(theme = null) {
    if (!theme) {
      this._forcedTheme = null;
      return this;
    }
    const resolved = resolveBiomeKey(theme);
    this._forcedTheme = resolved;
    this.currentTheme = resolved;
    this._setVistaKind(resolved);
    return this;
  }

  setEra(_era) {
    this.era = 'reboot';
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

  setReflectionPass(active) {
    const refl = Boolean(active);
    if (refl && !this._reflectionPass) {
      this._savedLightningVis = this.lightningMesh.visible;
      this._savedBirdsVis = this.birdsMesh.visible;
    }
    this._reflectionPass = refl;

    // Keep `archipelagoGroup`, `waterfallGroup`, `auroraMesh`, & `rainbowMesh` VISIBLE during planar
    // reflection so snow-capped alpine peaks, red-rock canyons, waterfalls, cypress trees, sea-arches
    // & glacial icebergs cast crisp mirror reflections onto the lake, river, bayou & sea!
    this.horizonMistRing.visible = !refl;
    this.flankMistMesh.visible = !refl;
    this.underwaterGroup.visible = !refl && this._activeVistaKey === 'coral_sea';
    this.boulderWakeMesh.visible = !refl && this._activeVistaKey === 'canyon_river';

    if (refl) {
      this.weatherPoints.visible = false;
      this.streakLines.visible = false;
      this.lightningMesh.visible = false;
      this.birdsMesh.visible = false;
    } else {
      this.lightningMesh.visible = Boolean(this._savedLightningVis);
      this.birdsMesh.visible = Boolean(this._savedBirdsVis);
    }
  }

  getMoonDirection(out = this._moonDirOut) {
    return out.copy(this.moonDirection);
  }

  getSunDirection(out = this._moonDirOut) {
    return out.copy(this.moonDirection);
  }

  getBiomeLighting(themeOrTower = null) {
    const key = themeOrTower
      ? typeof themeOrTower === 'string'
        ? resolveBiomeKey(themeOrTower)
        : resolveBiomeKey(themeOrTower.theme, themeOrTower.id)
      : this.currentTheme;
    return BIOME_LIGHTING_PRESETS[key] || BIOME_LIGHTING_PRESETS.canyon_river;
  }

  _resolveThemeKey(tower) {
    if (this._forcedTheme) return this._forcedTheme;
    return resolveBiomeKey(tower?.theme, tower?.id);
  }

  update(state, camera, time, dt) {
    if (this._disposed) return;

    const t = Number.isFinite(time) ? time : state?.time || 0;
    const frameDt = Number.isFinite(dt) ? Math.min(0.1, Math.max(0.0, dt)) : 1 / 60;

    const tower = state?.tower || null;
    if (tower?.cols && tower.cols !== this.cols) {
      this.cols = tower.cols;
      this.colAngle = TWO_PI / this.cols;
    }
    const fh = this.floorHeight;

    // Resolve Ecosystem Healing / Spire Purification progress (`0..1`)
    let targetPurify = this._purificationTarget;
    if (state?.purificationProgress !== undefined) {
      targetPurify = Number(state.purificationProgress) || 0;
    } else if (tower?.purificationProgress !== undefined) {
      targetPurify = Number(tower.purificationProgress) || 0;
    } else if (state?.restored || tower?.restored || state?.mode === 'victory') {
      targetPurify = 1.0;
    } else if (state?.cutsceneCam?.active && (state.cutsceneCam.kind === 'purification' || state.cutsceneCam.kind === 'epilogue')) {
      targetPurify = Math.max(0.35, Number(state.cutsceneCam.phase) || 0.75);
    } else if (state?.watershedHealth !== undefined) {
      const wh = Number(state.watershedHealth) || 0;
      targetPurify = wh > 1.001 ? wh * 0.01 : wh;
    } else if (state?.purificationProgress === undefined && tower && !tower.restored) {
      targetPurify = 0.0;
    }
    targetPurify = Math.max(0, Math.min(1, targetPurify));
    this._purification += (targetPurify - this._purification) * Math.min(1, frameDt * 2.5);
    const purify = this._purification;

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
      this._camPos.set(0, (state?.camFloor || 2) * fh + 1.5, 17);
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

    const themeKey = this._resolveThemeKey(tower);
    this.currentTheme = themeKey;
    const preset = CANONICAL_ATMOSPHERE_PRESETS[themeKey] || CANONICAL_ATMOSPHERE_PRESETS.canyon_river;
    this._setVistaKind(themeKey);

    // Sync scene background & atmospheric fog to the sunlit/twilight biome so zero dark #060a14 fog remains!
    if (this.scene && !this._reflectionPass) {
      if (this.scene.background && this.scene.background.isColor) {
        this._tmpColorA.set(preset.bgColor);
        if (blackout > 0.02) this._tmpColorA.multiplyScalar(1.0 - blackout * 0.68);
        this.scene.background.copy(this._tmpColorA);
      }
      if (this.scene.fog && this.scene.fog.color) {
        this._tmpColorB.set(preset.fogColor);
        if (blackout > 0.02) this._tmpColorB.multiplyScalar(1.0 - blackout * 0.68);
        this.scene.fog.color.copy(this._tmpColorB);
      }
    }

    const skyU = this.skyMat.uniforms;
    skyU.uTime.value = t;
    skyU.uYaw.value = -camCol * this.colAngle * 0.25;
    skyU.uSkyMode.value = preset.skyMode;
    skyU.uZenithColor.value.set(preset.zenith);
    skyU.uMidSkyColor.value.set(preset.midSky);
    skyU.uHorizonColor.value.set(preset.horizon);
    skyU.uHorizonMistColor.value.set(preset.horizonMist);
    skyU.uCloudDark.value.set(preset.cloudDark);
    skyU.uCloudMid.value.set(preset.cloudMid);
    skyU.uCloudRim.value.set(preset.cloudRim);
    skyU.uCelestialTint.value.set(preset.celestialTint);
    skyU.uCoronaColor.value.set(preset.corona);
    skyU.uSunGlowColor.value.set(preset.sunGlow);
    skyU.uCelestialAmt.value = preset.celestialAmt;
    skyU.uSunDisc.value = preset.sunDisc;
    skyU.uCloudCover.value = preset.cloudCover * (1.0 - purify * 0.16);
    skyU.uStarAmt.value = preset.starAmt;
    skyU.uAuroraAmt.value = preset.aurora;
    skyU.uBlackout.value = blackout;
    skyU.uPurification.value = purify;

    // Frame the bright Sun (or Polar Moon) cleanly in the upper-right sky corridor across all viewports
    const halfTanY = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
    const halfTanX = halfTanY * aspect;
    const camHorizDist = Math.max(8.5, Math.hypot(this._camPos.x, this._camPos.z));
    const effTowerR = this.towerRadius + (aspect < 0.68 ? 0.18 : 0.08);
    const sinSil = Math.min(0.85, effTowerR / camHorizDist);
    const towerAngHalfW = sinSil / Math.sqrt(Math.max(0.05, 1 - sinSil * sinSil));
    const celRadiusAng = aspect < 0.68 ? 0.025 : aspect < 1.0 ? 0.034 : 0.045;
    skyU.uCelestialRadius.value = celRadiusAng;

    const minRightClear = towerAngHalfW + celRadiusAng * 0.92;
    const maxRightInside = Math.max(minRightClear, halfTanX - celRadiusAng * 1.12);
    const desiredTanX = themeKey === 'canyon_river'
      ? Math.min(maxRightInside, Math.max(minRightClear, halfTanX * 0.42))
      : Math.min(maxRightInside, Math.max(minRightClear, halfTanX * 0.70));
    const elevFactor = themeKey === 'mist_bayou' ? 0.38 : themeKey === 'canyon_river' ? 0.72 : themeKey === 'coral_sea' ? 0.66 : 0.56;
    const desiredTanY = halfTanY * elevFactor;
    const subtleParallaxX = Math.sin(-camCol * this.colAngle * 0.5) * (aspect < 0.68 ? 0.003 : 0.010);

    this.moonDirection
      .copy(this._camFwd)
      .addScaledVector(this._camRight, desiredTanX + subtleParallaxX)
      .addScaledVector(this._camUp, desiredTanY)
      .normalize();
    if (this.moonDirection.y < 0.15) {
      this.moonDirection.y = 0.15;
      this.moonDirection.normalize();
    }
    skyU.uSunDir.value.copy(this.moonDirection);

    // Anchor 3D Watershed Vistas, Waterfalls, God-Rays, Rainbow & Water-World to `waterY` + parallax!
    const vistaYaw = -camCol * this.colAngle * 0.36;
    this.archipelagoGroup.position.set(0, waterY, 0);
    this.archipelagoGroup.rotation.y = vistaYaw;
    this.waterfallGroup.position.set(0, waterY, 0);
    this.waterfallGroup.rotation.y = vistaYaw;
    this.horizonMistRing.position.set(0, waterY, 0);
    this.horizonMistRing.rotation.y = -camCol * this.colAngle * 0.18;

    const waterWorldYaw = -camCol * this.colAngle * 0.85;
    this.waterWorldGroup.position.set(0, waterY, 0);
    this.waterWorldGroup.rotation.y = waterWorldYaw;
    this.underwaterGroup.position.set(0, waterY, 0);
    this.underwaterGroup.rotation.y = waterWorldYaw;

    const vU = this.vistaMat.uniforms;
    vU.uTime.value = t;
    vU.uWaterY.value = waterY;
    vU.uSunDir.value.copy(this.moonDirection);
    vU.uSunColor.value.set(preset.celestialTint);
    vU.uSkyFillColor.value.set(preset.midSky);
    vU.uMistColor.value.set(preset.horizonMist);
    vU.uAlpenglowColor.value.set(preset.alpenglow);
    vU.uBeaconA.value.set(preset.beacon);
    vU.uBeaconB.value.set(preset.beaconAlt);
    vU.uBlackout.value = blackout;
    vU.uPurification.value = purify;

    // Waterfall shader & boulder wake updates
    this.waterfallMat.uniforms.uTime.value = t;
    this.waterfallMat.uniforms.uRainbowAmt.value = Math.min(1.0, (themeKey === 'canyon_river' ? 0.65 : 0.25) + purify * 0.55);
    this.waterfallMat.uniforms.uTintColor.value.set(themeKey === 'mist_bayou' ? '#52b788' : '#5eead4');
    this.boulderWakeMat.uniforms.uTime.value = t;

    // Volumetric Golden God-Rays & Ecosystem Purification Rainbow Arc
    const rayStrength = (preset.godRays + purify * 0.38) * (1.0 - blackout * 0.7);
    this.godRaysMesh.visible = rayStrength > 0.04;
    if (this.godRaysMesh.visible) {
      this.godRaysMesh.position.set(0, waterY, 0);
      this.godRaysMesh.rotation.y = vistaYaw * 0.5;
      this.godRaysMat.uniforms.uTime.value = t;
      this.godRaysMat.uniforms.uStrength.value = rayStrength;
      this.godRaysMat.uniforms.uColor.value.set(preset.godRayColor);
    }

    const rainbowOpacity = Math.min(0.88, preset.rainbowBase + purify * 0.68) * (1.0 - blackout * 0.8);
    this.rainbowMesh.visible = rainbowOpacity > 0.02;
    if (this.rainbowMesh.visible) {
      this.rainbowMesh.position.set(0, Math.max(waterY, focusY * 0.35), 0);
      this.rainbowMat.uniforms.uOpacity.value = rainbowOpacity;
    }

    // Animate 10 Gliding 3D Underwater Manta Rays in `'coral_sea'`!
    if (themeKey === 'coral_sea' && !this._reflectionPass) {
      this.reefMat.uniforms.uTime.value = t;
      this.reefMat.uniforms.uPurification.value = purify;
      this.reefMat.uniforms.uSunDir.value.copy(this.moonDirection);

      for (let i = 0; i < this._mantaCount; i++) {
        const k = i * 6;
        const baseA = this._mantaParams[k];
        const rad = this._mantaParams[k + 1] + Math.sin(t * 0.32 + i) * 1.1;
        const dy = this._mantaParams[k + 2] + Math.sin(t * 0.75 + i * 1.7) * 0.14;
        const spd = this._mantaParams[k + 3] * (1.0 + purify * 0.25);
        const sc = this._mantaParams[k + 4];
        const dir = this._mantaParams[k + 5];

        const curA = baseA + t * spd * dir;
        const mx = Math.sin(curA) * rad;
        const mz = Math.cos(curA) * rad;
        // Tangent heading along circle: d/dA (sin A, cos A) = (cos A, -sin A) * dir
        const headingYaw = Math.atan2(Math.cos(curA) * dir, -Math.sin(curA) * dir);

        this._tmpPos.set(mx, dy, mz);
        this._tmpQuat.setFromAxisAngle(this._yAxis, headingYaw);
        this._tmpScale.setScalar(sc);
        this._tmpMat4.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
        this.mantaInstMesh.setMatrixAt(i, this._tmpMat4);
      }
      this.mantaInstMesh.instanceMatrix.needsUpdate = true;
    }

    // Animate 16 Soaring 3D Seabirds / Canyon Hawks / Bayou Egrets!
    const wantBirds = preset.birds > 0 || purify > 0.35;
    this._savedBirdsVis = wantBirds;
    this.birdsMesh.visible = wantBirds && !this._reflectionPass;
    if (this.birdsMesh.visible) {
      this.birdMat.uniforms.uTime.value = t;
      this.birdMat.uniforms.uSunDir.value.copy(this.moonDirection);
      this.birdMat.uniforms.uBirdColor.value.set(
        themeKey === 'canyon_river' ? '#b86f42' : themeKey === 'mist_bayou' ? '#fff3d6' : '#f8fafc'
      );
      this.birdMat.uniforms.uSunRimColor.value.set(
        themeKey === 'canyon_river' ? '#ffedc2' : themeKey === 'mist_bayou' ? '#ffd28a' : '#ffffff'
      );
      for (let i = 0; i < this._birdCount; i++) {
        const k = i * 5;
        const baseA = this._birdParams[k];
        const rad = this._birdParams[k + 1];
        const altY = waterY + this._birdParams[k + 2] + Math.sin(t * 0.6 + i) * 1.2;
        const spd = this._birdParams[k + 3];
        const sc = this._birdParams[k + 4];

        const curA = baseA + t * spd;
        const bx = Math.sin(curA) * rad;
        const bz = Math.cos(curA) * rad;
        const dir = spd >= 0 ? 1 : -1;
        const yaw = Math.atan2(Math.cos(curA) * dir, -Math.sin(curA) * dir);

        this._tmpPos.set(bx, altY, bz);
        this._tmpQuat.setFromAxisAngle(this._yAxis, yaw);
        this._tmpScale.setScalar(sc);
        this._tmpMat4.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
        this.birdsMesh.setMatrixAt(i, this._tmpMat4);
      }
      this.birdsMesh.instanceMatrix.needsUpdate = true;
    }

    const mRingU = this.horizonMistMat.uniforms;
    mRingU.uTime.value = t;
    mRingU.uWaterY.value = waterY;
    mRingU.uMistColor.value.set(preset.horizonMist);
    mRingU.uRimColor.value.set(preset.cloudRim);
    mRingU.uSunDir.value.copy(this.moonDirection);
    mRingU.uOpacity.value = (0.24 + preset.abyssMist * 0.18) * (1.0 - blackout * 0.55);

    // 3D Multi-Curtain Polar Aurora Ribbons ('storm_ocean')
    const wantAurora = preset.aurora > 0.02;
    this.auroraMesh.visible = wantAurora;
    if (wantAurora) {
      this.auroraMesh.position.set(0, Math.max(waterY, focusY * 0.42), 0);
      this.auroraMesh.rotation.y = -camCol * this.colAngle * 0.25;
      this.auroraMat.uniforms.uTime.value = t;
      this.auroraMat.uniforms.uStrength.value = (preset.aurora + purify * 0.25) * (1.0 - blackout * 0.45);
      this.auroraMat.uniforms.uColorLow.value.set('#00f5a0');
      this.auroraMat.uniforms.uColorHigh.value.set('#a855f7');
    }

    // Forked Lightning Bolts ('storm_ocean')
    const extFlash = Math.max(0, Math.min(1.5, state?.lightningFlash || 0));
    if (preset.ambientBolts && extFlash < 0.05 && purify < 0.85) {
      this._ambientBoltTimer -= frameDt;
      if (this._ambientBoltTimer <= 0) {
        this._ambientBoltTimer = 3.4 + this._nextBoltRand() * 4.0;
        this._ambientBoltFlash = 0.90;
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
    }

    // 3D Spire-Flank Mist Wisps
    this.flankMistMesh.visible = !this._reflectionPass;
    this.flankMistMesh.material.color.set(preset.horizonMist).lerp(skyU.uCloudRim.value, 0.35);
    this.flankMistMesh.material.opacity = (0.09 + preset.abyssMist * 0.08) * (1 - blackout * 0.55);
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

      const swayX = Math.sin(t * 0.28 + ph) * 0.95 + wind * 0.38;
      const wrappedY = ((ySlot - focusY * 0.3 + t * spd * 0.35) % 18.0 + 18.0) % 18.0 - 4.5;
      const wy = Math.max(waterY + 2.5, focusY + wrappedY);

      this._tmpPos.set(this._camPos.x + baseLatX + swayX, wy, depthZ);
      this._tmpQuat.setFromAxisAngle(this._camFwd, side * 0.04 * Math.sin(t * 0.4 + ph));
      this._tmpScale.set(w, h, 1);
      this._tmpMat4.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
      this.flankMistMesh.setMatrixAt(i, this._tmpMat4);
    }
    this.flankMistMesh.instanceMatrix.needsUpdate = true;

    // 220 Warm Golden Fireflies ('mist_bayou'), Sunlit Pollen ('canyon_river') & Lagoon Sparkles
    const ffU = this.fireflyMat.uniforms;
    ffU.uTime.value = t;
    ffU.uFocusY.value = focusY;
    ffU.uWaterY.value = waterY;
    ffU.uCamYaw.value = camCol * this.colAngle;
    ffU.uWind.value = wind;
    ffU.uColorA.value.set(preset.moteA);
    ffU.uColorB.value.set(preset.moteB);
    ffU.uColorC.value.set(preset.moteC);
    ffU.uIntensity.value = preset.fireflyBoost + purify * 0.35;

    // Waterline Spray Plumes
    const sprayScale = themeKey === 'alpine_lake' || themeKey === 'mist_bayou' ? 0.38 : 1.0;
    this._updateSeaSpray(t, frameDt, waterY, focusY, camCol, sprayScale * (1.0 - blackout * 0.5));

    if (this._reflectionPass) return;

    // Drifting Alpine Blossoms / Pine Needles ('alpine_lake') or Polar Ice Crystals ('storm_ocean')
    const showParticulates = preset.blossoms > 0 || preset.iceCrystals > 0;
    this.weatherPoints.visible = showParticulates;
    if (showParticulates) {
      const isBlossoms = preset.blossoms > 0;
      this.weatherMat.color.set(isBlossoms ? '#ffd6e7' : '#e0f2fe');
      this.weatherMat.size = isBlossoms ? 0.16 : 0.14;
      this.weatherMat.opacity = isBlossoms ? 0.78 : 0.84;
      const wp = this._weatherPos;
      const wm = this._weatherMeta;
      const gustPush = wind * 4.8 + (isBlossoms ? 0.65 : 0.0);
      for (let i = 0; i < this._weatherCount; i++) {
        const i3 = i * 3;
        const spdY = wm[i3];
        const freq = wm[i3 + 1];
        const ph = wm[i3 + 2];

        wp[i3 + 1] -= spdY * (isBlossoms ? 0.95 : 1.75) * frameDt;
        wp[i3] += (Math.sin(t * freq + ph) * (isBlossoms ? 0.95 : 0.55) + gustPush) * frameDt;
        if (wp[i3 + 1] < -10.0) wp[i3 + 1] += 20.0;
        if (wp[i3 + 1] > 10.0) wp[i3 + 1] -= 20.0;
        if (wp[i3] < -10.0) wp[i3] += 20.0;
        if (wp[i3] > 10.0) wp[i3] -= 20.0;
      }
      this._weatherPosAttr.needsUpdate = true;
      this.weatherPoints.position.set(this._camPos.x, focusY, 0);
    }

    // Tempest Rain & Wind Gust Streaks
    const absWind = Math.abs(wind);
    const rainStrength = preset.rain * (1.0 - purify * 0.75);
    const gustStrength = absWind > 0.08 ? Math.min(1, absWind / 1.1) : 0;
    const targetStreakOpacity = Math.max(rainStrength * 0.34, gustStrength * 0.46);

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
          if (sy < -10.0) sy += 20.0;
          if (sx < -10.0) sx += 20.0;
          if (sx > 10.0) sx -= 20.0;
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
          sx += windDir * speed * (0.45 + gustStrength * 0.85) * frameDt;
          if (sx > 10.0) sx -= 20.0;
          if (sx < -10.0) sx += 20.0;
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

  _updateSeaSpray(time, dt, waterY, focusY, camCol, scaleAmt) {
    const distAboveWater = focusY - waterY;
    const altFade = 1.0 - Math.max(0, Math.min(1, (distAboveWater - 12.0) / 10.0));
    if (altFade <= 0.01 || scaleAmt <= 0.01) {
      this.seaSprayPoints.visible = false;
      return;
    }
    this.seaSprayPoints.visible = true;
    this.seaSprayMat.uniforms.uGlobalOpacity.value = altFade * scaleAmt;

    const pos = this._sprayPos;
    const alpha = this._sprayAlpha;
    const size = this._spraySize;
    const rot = this._sprayRot;
    const st = this._sprayState;
    const camYaw = camCol * this.colAngle;

    for (let i = 0; i < this._sprayCount; i++) {
      const k = i * 7;
      const i3 = i * 3;
      const baseAng = st[k];
      const baseRad = Math.max(this.towerRadius + 0.18, st[k + 1]);
      const cycSpd = st[k + 2];
      let phase = st[k + 3] + cycSpd * dt;
      if (phase >= 1.0) phase -= Math.floor(phase);
      st[k + 3] = phase;

      const peakH = st[k + 4];
      const baseSize = st[k + 5];
      const rotSpd = st[k + 6];
      const isDroplet = i >= 62;

      const swellGate = 0.55 + 0.45 * Math.sin(time * 1.65 + baseAng * 3.0);
      const ang = baseAng + Math.sin(time * 0.45 + i) * 0.08 - camYaw * 0.12;
      const expandR = baseRad + phase * (isDroplet ? 0.85 : 0.56);

      const arcY = isDroplet
        ? Math.sin(phase * Math.PI) * peakH - phase * phase * 0.18
        : Math.pow(phase, 0.62) * peakH;

      pos[i3] = Math.sin(ang) * expandR;
      pos[i3 + 1] = waterY + 0.05 + arcY * swellGate;
      pos[i3 + 2] = Math.cos(ang) * expandR;

      const lifeCurve = Math.sin(phase * Math.PI);
      alpha[i] = lifeCurve * swellGate * (isDroplet ? 0.66 : 0.46);
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
