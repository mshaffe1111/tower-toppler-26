// Towering Waters: Gateway's Descent — 5 Earth Water Biomes, 10 Handcrafted Campaign Spires,
// Real Walkable Staircases, Pipe-Valve Routing, Gecko Wall-Strips, Grapple Rings,
// 7 Siphon Syndicate Enemies & Verified Procedural/Daily/Sanctum/Flood/Expedition Composer
// Pure leaf module (zero internal imports)

export const COLS = 20;

export function wrapCol(c) {
  return ((Math.round(c) % COLS) + COLS) % COLS;
}

function wrapFloatCol(c) {
  return (((Number(c) || 0) % COLS) + COLS) % COLS;
}

function floatColDist(a, b) {
  let d = wrapFloatCol(b) - wrapFloatCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

export function colDist(a, b) {
  let d = wrapCol(b) - wrapCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

/**
 * Deterministic 32-bit PRNG returning () => float in [0, 1).
 * @param {number} seed
 */
export function mulberry32(seed) {
  let a = (Number(seed) || 0) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns UTC daily challenge seed & ISO date key: { seed: 20261118, dateKey: '2026-11-18' }.
 * @param {Date|number|string} [date=new Date()]
 */
export function getDailySeed(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const valid = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = valid.getUTCFullYear();
  const month = valid.getUTCMonth() + 1;
  const day = valid.getUTCDate();
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    seed: year * 10000 + month * 100 + day,
    dateKey: `${year}-${mm}-${dd}`
  };
}

// ============================================================================
// 5 EARTH WATERSHED ACTS (WORLD MAP METADATA)
// ============================================================================

export const BIOME_THEMES = [
  'canyon_river',
  'alpine_lake',
  'mist_bayou',
  'coral_sea',
  'storm_ocean'
];

export const SECTOR_WORLDS = [
  {
    id: 1,
    act: 1,
    key: 'act_1',
    biome: 'canyon_river',
    theme: 'canyon_river',
    skyTheme: 'canyon_river',
    code: 'ACT I',
    name: 'REDWOOD CANYON RIVERS',
    subtitle: 'ACT I • SUNLIT GORGE & WHITEWATER CATARACTS',
    guardian: 'Elder Oakhaven',
    lore: 'Golden morning sunlight pours into red-rock sandstone gorges where giant Siphon dams choke roaring redwood waterfalls.',
    blurb: 'Golden morning sunlight pours into red-rock sandstone gorges where giant Siphon dams choke roaring redwood waterfalls.',
    accentColor: '#2dd4bf',
    towerIds: [1, 2],
    towers: [1, 2],
    routeType: 'rapids_surf',
    exitRouteType: 'frill_glide',
    intraRoute: {
      type: 'rapids_surf',
      mode: 'rapids_surf',
      badge: 'SURF',
      label: 'GORGE RAPIDS • WHITEWATER TAIL-SURF',
      title: 'Whitewater Rapids Tail-Surf'
    },
    summitRoute: {
      type: 'frill_glide',
      mode: 'frill_glide',
      badge: 'GLIDE',
      label: 'CANYON UPDRAFT • FRILL-GLIDE',
      title: 'Canyon Updraft Frill-Glide'
    }
  },
  {
    id: 2,
    act: 2,
    key: 'act_2',
    biome: 'alpine_lake',
    theme: 'alpine_lake',
    skyTheme: 'alpine_lake',
    code: 'ACT II',
    name: 'CRYSTAL ALPINE LAKES',
    subtitle: 'ACT II • MIRROR TARNS & ALPENGLOW PEAKS',
    guardian: 'Spirit Lumi',
    lore: 'Snow-capped silver-granite peaks reflect in glassy turquoise mountain tarns locked behind brass cryo-spillways.',
    blurb: 'Snow-capped silver-granite peaks reflect in glassy turquoise mountain tarns locked behind brass cryo-spillways.',
    accentColor: '#38bdf8',
    towerIds: [3, 4],
    towers: [3, 4],
    routeType: 'reef_swim',
    exitRouteType: 'frill_glide',
    intraRoute: {
      type: 'reef_swim',
      mode: 'reef_swim',
      badge: 'SWIM',
      label: 'LAKEBED DIVE • CRYSTAL TARN FREE-SWIM',
      title: 'Alpine Lakebed Free-Swim'
    },
    summitRoute: {
      type: 'frill_glide',
      mode: 'frill_glide',
      badge: 'GLIDE',
      label: 'ALPENGLOW RIDGE • FRILL-GLIDE',
      title: 'Alpenglow Ridge Frill-Glide'
    }
  },
  {
    id: 3,
    act: 3,
    key: 'act_3',
    biome: 'mist_bayou',
    theme: 'mist_bayou',
    skyTheme: 'mist_bayou',
    code: 'ACT III',
    name: 'EMERALD MIST BAYOUS',
    subtitle: 'ACT III • FIREFLY CYPRESS & SUNKEN TEMPLES',
    guardian: 'Keeper Mossback',
    lore: 'Warm amber twilight glows through moss-draped cypress arches, glowing lotus channels, and ancient river-delta sanctums.',
    blurb: 'Warm amber twilight glows through moss-draped cypress arches, glowing lotus channels, and ancient river-delta sanctums.',
    accentColor: '#fbbf24',
    towerIds: [5, 6],
    towers: [5, 6],
    routeType: 'rapids_surf',
    exitRouteType: 'reef_swim',
    intraRoute: {
      type: 'rapids_surf',
      mode: 'rapids_surf',
      badge: 'SURF',
      label: 'BAYOU CHANNEL • LOTUS WAKE SURF',
      title: 'Bayou Firefly Tail-Surf'
    },
    summitRoute: {
      type: 'reef_swim',
      mode: 'reef_swim',
      badge: 'SWIM',
      label: 'ESTUARY CROSSING • MANGROVE FREE-SWIM',
      title: 'Estuary Mangrove Free-Swim'
    }
  },
  {
    id: 4,
    act: 4,
    key: 'act_4',
    biome: 'coral_sea',
    theme: 'coral_sea',
    skyTheme: 'coral_sea',
    code: 'ACT IV',
    name: 'SUNLIT CORAL SEAS',
    subtitle: 'ACT IV • TURQUOISE ATOLLS & LIVING REEFS',
    guardian: 'Matriarch Aurelia',
    lore: 'Dazzling tropical lagoons reveal living coral gardens and gliding manta rays beneath sun-bleached sea-glass spires.',
    blurb: 'Dazzling tropical lagoons reveal living coral gardens and gliding manta rays beneath sun-bleached sea-glass spires.',
    accentColor: '#f472b6',
    towerIds: [7, 8],
    towers: [7, 8],
    routeType: 'reef_swim',
    exitRouteType: 'frill_glide',
    intraRoute: {
      type: 'reef_swim',
      mode: 'reef_swim',
      badge: 'SWIM',
      label: 'CORAL LAGOON • REEF GUARDIAN SWIM',
      title: 'Sunlit Coral Reef Free-Swim'
    },
    summitRoute: {
      type: 'frill_glide',
      mode: 'frill_glide',
      badge: 'GLIDE',
      label: 'TRADEWIND ARCHES • FRILL-GLIDE',
      title: 'Tropical Tradewind Frill-Glide'
    }
  },
  {
    id: 5,
    act: 5,
    key: 'act_5',
    biome: 'storm_ocean',
    theme: 'storm_ocean',
    skyTheme: 'storm_ocean',
    code: 'ACT V',
    name: 'POLAR & TEMPEST OCEANS',
    subtitle: 'ACT V • AURORA ICEBERGS & THE MOTHER SIPHON',
    guardian: 'Oracle Borealis',
    lore: 'Shimmering polar auroras crown towering turquoise icebergs where the Mother Siphon churns the deep ocean into a maelstrom.',
    blurb: 'Shimmering polar auroras crown towering turquoise icebergs where the Mother Siphon churns the deep ocean into a maelstrom.',
    accentColor: '#5efce8',
    towerIds: [9, 10],
    towers: [9, 10],
    routeType: 'rapids_surf',
    exitRouteType: null,
    intraRoute: {
      type: 'rapids_surf',
      mode: 'rapids_surf',
      badge: 'SURF',
      label: 'MAELSTROM RUN • GLACIAL SURGE SURF',
      title: 'Maelstrom Surge Tail-Surf'
    },
    summitRoute: null
  }
];

export const WATERSHED_ACTS = SECTOR_WORLDS;

export const BIOME_PALETTES = {
  canyon_river: {
    brickA: '#9a4a2e',
    brickB: '#b85d3b',
    mortar: '#4a2114',
    ledge: '#c98a5b',
    ledgeTop: '#e8b98a',
    glow: '#2dd4bf',
    moss: '#2f7a4f',
    pipe: '#b86b35',
    skyTop: '#1e6fa8',
    skyMid: '#f4b166',
    fog: '#d99b66',
    water: '#0e7490',
    foam: '#ecfeff'
  },
  alpine_lake: {
    brickA: '#64748b',
    brickB: '#7c8ea6',
    mortar: '#293548',
    ledge: '#cbd5e1',
    ledgeTop: '#f8fafc',
    glow: '#38bdf8',
    moss: '#3b7a75',
    pipe: '#b58d3d',
    skyTop: '#0284c7',
    skyMid: '#bae6fd',
    fog: '#93c5fd',
    water: '#0369a1',
    foam: '#f0f9ff'
  },
  mist_bayou: {
    brickA: '#3f4f42',
    brickB: '#526654',
    mortar: '#1c261e',
    ledge: '#78866b',
    ledgeTop: '#a3b18a',
    glow: '#fbbf24',
    moss: '#2d6a4f',
    pipe: '#8c6d3f',
    skyTop: '#4c1d95',
    skyMid: '#d97706',
    fog: '#785a46',
    water: '#115e59',
    foam: '#d1fae5'
  },
  coral_sea: {
    brickA: '#d6c2a8',
    brickB: '#e7d8c3',
    mortar: '#7c6853',
    ledge: '#5eead4',
    ledgeTop: '#ccfbf1',
    glow: '#f472b6',
    moss: '#14b8a6',
    pipe: '#2da89b',
    skyTop: '#0ea5e9',
    skyMid: '#7dd3fc',
    fog: '#67e8f9',
    water: '#0891b2',
    foam: '#ffffff'
  },
  storm_ocean: {
    brickA: '#1e293b',
    brickB: '#334155',
    mortar: '#0f172a',
    ledge: '#475569',
    ledgeTop: '#94a3b8',
    glow: '#5efce8',
    moss: '#0d9488',
    pipe: '#475569',
    skyTop: '#09152b',
    skyMid: '#1e3a5f',
    fog: '#162c4a',
    water: '#0c4a6e',
    foam: '#cffafe'
  }
};

export const DAILY_TIDE_MODIFIERS = [
  {
    id: 'geyser_bloom',
    name: 'Spring Geyser Bloom',
    badge: 'GEYSER SURGE',
    description: 'Pressurized thermal vents erupt more frequently, launching Gateway +3.4 floors skyward.',
    mechanicsPatch: { geyserMult: 1.25 }
  },
  {
    id: 'feather_mist',
    name: 'Buoyant Canyon Mist',
    badge: 'UPDRAFT MIST',
    description: 'Warm rising mist softens gravity at jump apex for extended horizontal chasm leaps.',
    mechanicsPatch: { lowGravApex: true }
  },
  {
    id: 'golden_eddy',
    name: 'Gilded Tide Eddy',
    badge: '2X HYDRO-GEARS',
    description: 'Harmonic currents wash double golden Hydro-Gears onto spire terraces.',
    mechanicsPatch: { doubleGears: true }
  },
  {
    id: 'tradewind_gale',
    name: 'Tradewind Squall',
    badge: 'RHYTHMIC BREEZE',
    description: 'Brisk coastal tradewinds sweep around the spire in 6.5-second cadences.',
    mechanicsPatch: { windForce: 0.34, windPeriod: 6.5 }
  },
  {
    id: 'rising_spring',
    name: 'Surging Spring Tide',
    badge: 'RISING TIDE',
    description: 'A steady tide climbs the lower spire—spin brass Drain Valves to vent head pressure!',
    mechanicsPatch: { waterRiseRate: 0.14 }
  }
];

const DEFAULT_MECHANICS = Object.freeze({
  waterBaseFloor: -0.55,
  waterRiseRate: 0,
  waterPurified: false,
  windForce: 0,
  windPeriod: 6.0,
  blackoutCycle: 0,
  lightningInterval: 0
});

const CANONICAL_ENEMY_MAP = {
  snap_crab: 'snap_crab',
  gulp_hopper: 'gulp_hopper',
  volt_eel: 'volt_eel',
  rail_skater: 'rail_skater',
  barnacle_mortar: 'barnacle_mortar',
  vent_stalker: 'vent_stalker',
  siphon_warden: 'siphon_warden',
  // Legacy compatibility mapping -> 7 original Siphon Syndicate foes
  roller: 'snap_crab',
  bouncer: 'gulp_hopper',
  molecule: 'volt_eel',
  robotH: 'rail_skater',
  robotV: 'vent_stalker',
  eye: 'barnacle_mortar'
};

// ============================================================================
// SHARED BUILDERS & STAIRCASE / MECHANISM HELPERS
// ============================================================================

function isBarrierLedgeType(type) {
  return type === 'box' || type === 'pillar' || type === 'laserGate';
}

function isSolidStairMasonryType(type) {
  return type === 'solid' || type === 'stair' || type === 'stairR' || type === 'stairL';
}

const VALID_BOX_POWERUPS = new Set(['turbo_current', 'bubble_shield', 'hydro_magnet']);

function span(ledges, floor, startCol, count, type = 'solid', extra = {}) {
  for (let i = 0; i < count; i++) {
    ledges.push({
      col: wrapCol(startCol + i),
      floor,
      type,
      switchGroup: extra.switchGroup ?? null,
      pipeGroup: extra.pipeGroup ?? null,
      inverted: Boolean(extra.inverted),
      phasePeriod: extra.phasePeriod ?? 3.2,
      phaseOffset: extra.phaseOffset ?? 0,
      ...(extra.stairDir !== undefined ? { stairDir: extra.stairDir } : {}),
      ...(extra.isExplicitStair
        ? {
            isExplicitStair: true,
            explicitStairDir: Number(extra.explicitStairDir ?? extra.stairDir ?? 0)
          }
        : {}),
      ...(extra.h !== undefined ? { h: extra.h } : {}),
      ...(extra.powerUp && VALID_BOX_POWERUPS.has(extra.powerUp) ? { powerUp: String(extra.powerUp) } : {})
    });
  }
}

function tile(ledges, col, floor, type = 'solid', extra = {}) {
  ledges.push({
    col: wrapCol(col),
    floor,
    type,
    switchGroup: extra.switchGroup ?? null,
    pipeGroup: extra.pipeGroup ?? null,
    inverted: Boolean(extra.inverted),
    phasePeriod: extra.phasePeriod ?? 3.2,
    phaseOffset: extra.phaseOffset ?? 0,
    ...(extra.stairDir !== undefined ? { stairDir: extra.stairDir } : {}),
    ...(extra.isExplicitStair
      ? {
          isExplicitStair: true,
          explicitStairDir: Number(extra.explicitStairDir ?? extra.stairDir ?? 0)
        }
      : {}),
    ...(extra.h !== undefined ? { h: extra.h } : {}),
    ...(extra.powerUp && VALID_BOX_POWERUPS.has(extra.powerUp) ? { powerUp: String(extra.powerUp) } : {})
  });
}

/**
 * Builds an engineered ascending staircase flight where Gateway runs smoothly up & down
 * real 5-riser treads without needing to jump!
 * Places a base landing, `steps` ascending stair treads (+1 floor per column in `dir`),
 * and a wide `topLandingLen`-column terrace at `startFloor + steps`.
 */
function stairFlight(ledges, startFloor, startCol, steps, dir = 1, topLandingLen = 3, type = 'solid') {
  const stepSign = dir >= 0 ? 1 : -1;
  const nSteps = Math.max(0, Math.round(Number(steps) || 0));
  const stairMeta = isSolidStairMasonryType(type)
    ? { stairDir: stepSign, isExplicitStair: true, explicitStairDir: stepSign }
    : {};

  // Base landing lead-in on startFloor before the first ascending step at startCol
  tile(ledges, startCol - stepSign, startFloor, type);
  for (let s = 0; s < nSteps; s++) {
    tile(ledges, startCol + stepSign * s, startFloor + s, type, stairMeta);
  }

  // Top landing terrace starting at startCol + stepSign * nSteps on floor startFloor + nSteps
  const topAnchor = startCol + stepSign * nSteps;
  const terraceStart = stepSign === 1 ? topAnchor : topAnchor - (topLandingLen - 1);
  span(ledges, startFloor + nSteps, terraceStart, topLandingLen, type);
  return {
    topFloor: startFloor + nSteps,
    endCol: wrapCol(topAnchor + stepSign * (topLandingLen - 1)),
    midCol: wrapCol(topAnchor + stepSign * Math.floor(topLandingLen / 2))
  };
}

/**
 * Canonical 1:1 Staircase Step Predicate shared across level validation, physics (`game.js`),
 * and 3D staircase mesh baking (`towerArchitecture.js`).
 * Returns true iff `(col, floor)` climbs via an explicit 5-riser stone staircase in `dir` (-1 | +1)
 * to `(wrapCol(col + dir), floor + 1)` with solid-to-solid masonry, zero flat bridge at `(c1, floor)`,
 * zero overhead ceiling/barrier, and zero elevator shaft obstruction.
 */
export function isCanonicalStairStep(ledges, elevators = [], col, floor, dir) {
  if (!Array.isArray(ledges) || (dir !== 1 && dir !== -1)) return false;
  const c0 = wrapCol(col);
  const f0 = Math.round(Number(floor) || 0);
  const c1 = wrapCol(c0 + dir);
  const f1 = f0 + 1;

  let l0 = null;
  let l1 = null;

  for (const b of ledges) {
    if (!b || b.gone) continue;
    const bc = wrapCol(b.col);
    const bf = Math.round(Number(b.floor) || 0);
    const bType = b.type || 'solid';

    if (isBarrierLedgeType(bType)) {
      const bh = Math.max(1, Math.round(Number(b.h) || 1));
      const bMax = bf + bh - 1;
      if (bc === c0 && ((f0 >= bf && f0 <= bMax) || (f1 >= bf && f1 <= bMax))) return false;
      if (bc === c1 && f1 >= bf && f1 <= bMax) return false;
      continue;
    }

    if (bc === c1 && bf === f0) return false; // Flat bridge of any walkable ledge type
    if (bc === c0 && bf === f1) return false; // Ceiling directly above lower step
    if (bc === c0 && bf === f0) l0 = b;
    else if (bc === c1 && bf === f1) l1 = b;
  }

  if (!l0 || !l1 || l0.active === false || l1.active === false) return false;
  if (!isSolidStairMasonryType(l0.type || 'solid') || !isSolidStairMasonryType(l1.type || 'solid')) {
    return false;
  }

  const typeIntent = l0.type === (dir === 1 ? 'stairR' : 'stairL');
  const explicitIntent =
    l0.stairDir !== undefined
      ? Number(l0.stairDir) === dir
      : l0.isExplicitStair === true && Number(l0.explicitStairDir) === dir;
  if (!typeIntent && !explicitIntent) return false;

  if (Array.isArray(elevators)) {
    for (const el of elevators) {
      if (!el) continue;
      const ec = wrapCol(el.col);
      if (ec !== c0 && ec !== c1) continue;
      const minF = Math.round(Number(el.minFloor) || 0);
      const maxF = Math.round(Number(el.maxFloor) || 0);
      if (f1 >= minF && f1 <= maxF) return false;
      if (ec === c0 && f0 >= minF && f0 <= maxF) return false;
    }
  }

  return true;
}

const ARCHETYPE_ENEMY_SPEEDS = Object.freeze({
  snap_crab: 0.88,
  gulp_hopper: 0.0,
  volt_eel: 1.15,
  rail_skater: 2.35,
  barnacle_mortar: 0.0,
  vent_stalker: 0.78,
  siphon_warden: 2.05
});

function normalizeEnemy(en, idx = 0) {
  const canonical = CANONICAL_ENEMY_MAP[en.type] || 'snap_crab';
  const defaultAmp =
    canonical === 'gulp_hopper'
      ? 0.78
      : canonical === 'volt_eel'
      ? 0.36
      : canonical === 'siphon_warden'
      ? 0.55
      : 0.22;
  const resolvedSpeed =
    canonical === 'siphon_warden'
      ? Math.max(1.85, Math.min(2.35, Number(en.speed ?? ARCHETYPE_ENEMY_SPEEDS.siphon_warden)))
      : ARCHETYPE_ENEMY_SPEEDS[canonical];
  return {
    type: canonical,
    col: ((Number(en.col) % COLS) + COLS) % COLS,
    floor: Number(en.floor),
    dir: en.dir === -1 ? -1 : 1,
    speed: resolvedSpeed,
    amp: Number(en.amp ?? defaultAmp),
    axis: en.axis || (en.type === 'robotV' || canonical === 'vent_stalker' ? 'v' : 'h'),
    hp: Number(en.hp ?? (canonical === 'siphon_warden' ? 3 : 1)),
    maxHp: Number(en.maxHp ?? en.hp ?? (canonical === 'siphon_warden' ? 3 : 1)),
    firePeriod: Number(en.firePeriod ?? 3.4),
    phaseOffset: Number(en.phaseOffset ?? (idx * 1.17) % 6.28),
    minFloor: en.minFloor !== undefined && en.minFloor !== null ? Number(en.minFloor) : null,
    maxFloor: en.maxFloor !== undefined && en.maxFloor !== null ? Number(en.maxFloor) : null,
    ...(en.act !== undefined ? { act: Number(en.act) } : {}),
    ...(en.harmless ? { harmless: true } : {}),
    ...(en.bossTitle ? { bossTitle: String(en.bossTitle) } : {}),
    ...(en.isLockKeeper ? { isLockKeeper: true } : {}),
    ...(en.sealId ? { sealId: String(en.sealId) } : {}),
    ...(en.minCol !== undefined ? { minCol: wrapCol(en.minCol) } : {}),
    ...(en.maxCol !== undefined ? { maxCol: wrapCol(en.maxCol) } : {})
  };
}

function computeLedgeSpanAt(ledges, col, floor) {
  let walkMask = 0;
  let blockMask = 0;
  for (let i = 0; i < ledges.length; i++) {
    const l = ledges[i];
    const t = l.type;
    if (t === 'box' || t === 'pillar' || t === 'laserGate') {
      const hit = l.h ? l.floor < floor + 1.2 && l.floor + l.h > floor + 0.15 : Math.abs(l.floor - floor) < 0.5;
      if (hit) blockMask |= 1 << wrapCol(l.col);
    } else if (t !== 'phaseBlock' && Math.abs(l.floor - floor) < 0.25) {
      walkMask |= 1 << wrapCol(l.col);
    }
  }
  const validMask = walkMask & ~blockMask;
  const startTile = Math.floor(wrapFloatCol(col));
  if (!(validMask & (1 << startTile))) {
    return { onRealTile: false, startCol: startTile, length: 0 };
  }
  let leftSteps = 0;
  while (leftSteps < COLS - 1 && (validMask & (1 << wrapCol(startTile - leftSteps - 1)))) leftSteps++;
  let rightSteps = 0;
  while (rightSteps < COLS - 1 - leftSteps && (validMask & (1 << wrapCol(startTile + rightSteps + 1)))) rightSteps++;
  return {
    onRealTile: true,
    startCol: wrapCol(startTile - leftSteps),
    length: Math.max(1, leftSteps + 1 + rightSteps)
  };
}

function enemyVertEnvelope(en) {
  if (en.axis === 'v' || en.type === 'vent_stalker') {
    return [en.minFloor ?? en.floor - 1.4, en.maxFloor ?? en.floor + 1.4];
  }
  if (en.type === 'volt_eel' || en.type === 'siphon_warden') {
    const amp = en.amp || 0.4;
    return [en.floor - amp, en.floor + amp];
  }
  if (en.type === 'gulp_hopper') {
    const amp = en.amp || 0.78;
    return [en.floor, en.floor + amp];
  }
  return [en.floor, en.floor];
}

function sanitizeEnemySpawns(enemies, doors, elevators, spawn, ledges, totalFloors) {
  const anchors = [{ col: wrapCol(spawn.col) + 0.5, floor: spawn.floor }];
  for (const d of doors) {
    // Allow Act Bosses (`siphon_warden`) to orbit near the upper tiers while keeping spawn & mid doors safe
    if (!d.isExit) {
      anchors.push({ col: wrapCol(d.col) + 0.5, floor: d.floor });
    }
  }
  for (const el of elevators) {
    const ec = wrapCol(el.col) + 0.5;
    const minF = Math.round(el.minFloor);
    const maxF = Math.round(el.maxFloor);
    for (let f = minF; f <= maxF; f++) {
      anchors.push({ col: ec, floor: f });
    }
  }

  return enemies.map((orig) => {
    const en = { ...orig };
    if (en.type === 'siphon_warden') {
      // Keep Siphon Warden / Lock-Keeper cleanly over its Crown Arena span (never yeeting it into offscreen void!)
      const exitD = doors.find((d) => d.isExit);
      const arenaFloor = Math.round(en.floor);
      let arenaSpan = computeLedgeSpanAt(ledges, en.col, arenaFloor);
      if (!arenaSpan.onRealTile && exitD && Math.abs(arenaFloor - exitD.floor) <= 1) {
        arenaSpan = computeLedgeSpanAt(ledges, exitD.col + 0.5, exitD.floor);
      }
      if (arenaSpan.onRealTile && arenaSpan.length < COLS && arenaSpan.length >= 3) {
        en.arenaStartCol = arenaSpan.startCol;
        en.arenaLen = arenaSpan.length;
        const margin = Math.min(1.1, arenaSpan.length * 0.25);
        const midCol = wrapFloatCol(arenaSpan.startCol + arenaSpan.length * 0.5);
        // Place boss inside the Crown Arena at a fair offset (>= 1.8 cols) from the Exit Door
        if (exitD && Math.abs(en.floor - exitD.floor) < 1.5 && Math.abs(floatColDist(en.col, exitD.col + 0.5)) < 1.8) {
          const leftCand = wrapFloatCol(arenaSpan.startCol + margin);
          const rightCand = wrapFloatCol(arenaSpan.startCol + arenaSpan.length - margin);
          const dLeft = Math.abs(floatColDist(leftCand, exitD.col + 0.5));
          const dRight = Math.abs(floatColDist(rightCand, exitD.col + 0.5));
          const dMid = Math.abs(floatColDist(midCol, exitD.col + 0.5));
          en.col = Number((dMid >= 2.0 ? midCol : dLeft >= dRight ? leftCand : rightCand).toFixed(2));
        } else {
          // Ensure en.col is inside [arenaSpan.startCol + margin, arenaSpan.startCol + arenaSpan.length - margin]
          const rel = ((wrapFloatCol(en.col) - arenaSpan.startCol) % COLS + COLS) % COLS;
          if (rel < margin || rel > arenaSpan.length - margin) {
            en.col = Number(midCol.toFixed(2));
          }
        }
      } else if (exitD && Math.abs(en.floor - exitD.floor) < 1.5 && Math.abs(colDist(en.col, exitD.col + 0.5)) < 4.5) {
        en.col = wrapCol(exitD.col + 9) + 0.5;
      }
      return en;
    }

    const relevantForFloor = (testFloor) => {
      const probe = { ...en, floor: testFloor };
      const [minY, maxY] = enemyVertEnvelope(probe);
      return anchors.filter((a) => {
        const rawDf = Math.abs(testFloor - a.floor);
        const oscDf = a.floor < minY ? minY - a.floor : a.floor > maxY ? a.floor - maxY : 0;
        return rawDf < 0.95 || oscDf < 0.72;
      });
    };

    const isTerraceEnemy =
      en.type === 'snap_crab' ||
      en.type === 'barnacle_mortar' ||
      en.type === 'gulp_hopper' ||
      (en.type === 'rail_skater' && en.axis !== 'v');

    if (isTerraceEnemy) {
      const fRound = Math.round(en.floor);
      const minSafeDist = 1.65;
      const rel = relevantForFloor(fRound);
      const spHere = computeLedgeSpanAt(ledges, en.col, fRound);
      const curDist = rel.reduce((m, a) => Math.min(m, Math.abs(floatColDist(en.col, a.col))), Infinity);

      if (spHere.onRealTile && (en.type !== 'rail_skater' || spHere.length >= 2) && curDist >= minSafeDist) {
        en.floor = fRound;
        en.col = Number(wrapFloatCol(en.col).toFixed(2));
        return en;
      }

      // Search real walkable tiles on fRound first, then nearby floors if needed, NEVER placing in mid-air!
      let bestPick = null;
      for (const df of [0, 1, -1, 2, -2, 3, -3]) {
        const tf = fRound + df;
        if (tf < 1 || tf > totalFloors - 2) continue;
        const relTf = relevantForFloor(tf);
        for (let step = 0; step < COLS; step++) {
          const tileCol = wrapCol(Math.floor(wrapFloatCol(en.col)) + step);
          const cand = tileCol + 0.5;
          const sp = computeLedgeSpanAt(ledges, cand, tf);
          if (!sp.onRealTile) continue;
          if ((en.type === 'rail_skater' || en.type === 'snap_crab') && sp.length < 2 && df !== 0) continue;
          const dMin = relTf.reduce((m, a) => Math.min(m, Math.abs(floatColDist(cand, a.col))), Infinity);
          if (!bestPick || dMin > bestPick.minDist + 1e-6) {
            bestPick = { col: cand, floor: tf, minDist: dMin };
            if (df === 0 && dMin >= 2.2) break;
          }
        }
        if (bestPick && bestPick.minDist >= 2.0) break;
      }

      if (bestPick) {
        en.col = Number(bestPick.col.toFixed(2));
        en.floor = bestPick.floor;
      }
      return en;
    }

    const barrierLedges = ledges.filter((l) => isBarrierLedgeType(l.type));
    const isClearOfBarriers = (testCol, testFloor) => {
      const probe = { ...en, floor: testFloor };
      const [minY, maxY] = enemyVertEnvelope(probe);
      for (let i = 0; i < barrierLedges.length; i++) {
        const b = barrierLedges[i];
        const bh = Math.max(1, Number(b.h || 1));
        const vHit = maxY + 0.55 > b.floor && minY - 0.35 < b.floor + bh;
        if (!vHit) continue;
        if (Math.abs(floatColDist(testCol, wrapCol(b.col) + 0.5)) < 1.05) return false;
      }
      return true;
    };

    const bestColForFloor = (testFloor) => {
      const rel = relevantForFloor(testFloor);
      const curClear = isClearOfBarriers(en.col, testFloor);
      if (rel.length === 0 && curClear) return { col: en.col, minDist: Infinity };
      const curMin = curClear
        ? rel.reduce((m, a) => Math.min(m, Math.abs(colDist(en.col, a.col))), Infinity)
        : -1;
      if (curClear && curMin >= 3.2) return { col: en.col, minDist: curMin };

      let bestCol = en.col;
      let bestMin = curMin;
      for (let step = 0; step < 40; step++) {
        const cand = (((en.col + 4 + step * 0.5) % COLS) + COLS) % COLS;
        if (!isClearOfBarriers(cand, testFloor)) continue;
        const dMin = rel.length === 0 ? Infinity : rel.reduce((m, a) => Math.min(m, Math.abs(colDist(cand, a.col))), Infinity);
        if (dMin > bestMin + 1e-6) {
          bestMin = dMin;
          bestCol = cand;
          if (bestMin === Infinity) break;
        }
      }
      return { col: bestCol, minDist: bestMin };
    };

    let pick = bestColForFloor(en.floor);
    if (pick.minDist < 3.2 && en.axis !== 'v') {
      for (const df of [1, -1, 2, -2]) {
        const nf = en.floor + df;
        if (nf < 1.5 || nf > totalFloors - 2.2) continue;
        const alt = bestColForFloor(nf);
        if (alt.minDist > pick.minDist + 0.25) {
          en.floor = Number(nf.toFixed(2));
          pick = alt;
          if (pick.minDist >= 3.5) break;
        }
      }
    }
    en.col = Number(pick.col.toFixed(2));
    return en;
  });
}

// ============================================================================
// DETERMINISTIC EXTERIOR SANCTUM-DOOR CLUE DERIVATION (1:1 WITH src/puzzleRoom.js)
// ============================================================================

const RUNE_PUZZLE_TYPES = new Set(['lights', 'bells', 'beam', 'blocks', 'pipes', 'tide_locks']);
const RUNE_BELL_COLORS = ['#ff4f64', '#ffb02e', '#3fe07e', '#3ab0ff', '#c77dff'];
const RUNE_BELL_COLOR_NAMES = ['CORAL', 'GOLD', 'EMERALD', 'AZURE', 'VIOLET'];

function hashPuzzleSeed(seed, salt) {
  let h = 2166136261 >>> 0;
  const s = `${seed}|${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function shuffleWithRng(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function applyRuneLightsPress(lit, n, idx) {
  const x = idx % n;
  const y = (idx / n) | 0;
  lit[idx] ^= 1;
  if (x > 0) lit[idx - 1] ^= 1;
  if (x < n - 1) lit[idx + 1] ^= 1;
  if (y > 0) lit[idx - n] ^= 1;
  if (y < n - 1) lit[idx + n] ^= 1;
  return lit;
}

export function deriveRuneDoorClue({
  puzzleType = 'lights',
  puzzleSeed = 10101,
  puzzleDifficulty = 0.4,
  col = 0,
  floor = 0,
  clueColOffset = 0,
  doorId = null
} = {}) {
  const type = RUNE_PUZZLE_TYPES.has(puzzleType) ? puzzleType : 'lights';
  const d = Math.max(0, Math.min(1, Number(puzzleDifficulty) || 0));
  const rng = mulberry32(hashPuzzleSeed(puzzleSeed, type));
  const dc = wrapCol(col);
  const df = Math.round(Number(floor) || 0);

  if (type === 'lights') {
    const n = d < 0.45 ? 3 : 4;
    const N = n * n;
    const k = Math.max(2, Math.min(N - 2, 2 + Math.round(d * 5)));
    let target = new Array(N).fill(0);
    let presses = [];
    for (let attempt = 0; attempt < 200; attempt++) {
      target = new Array(N).fill(0);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < Math.ceil(n / 2); x++) {
          const on = rng() < 0.5 ? 1 : 0;
          target[y * n + x] = on;
          target[y * n + (n - 1 - x)] = on;
        }
      }
      const litCount = target.reduce((a, b) => a + b, 0);
      if (litCount < Math.ceil(N * 0.3) || litCount > Math.floor(N * 0.65)) continue;
      const cells = shuffleWithRng(rng, [...Array(N).keys()]);
      presses = cells.slice(0, k).sort((a, b) => a - b);
      const start = target.slice();
      for (const p of presses) applyRuneLightsPress(start, n, p);
      let diff = 0;
      for (let i = 0; i < N; i++) diff += start[i] !== target[i] ? 1 : 0;
      if (diff < 3) continue;
      break;
    }
    const parMoves = Math.max(6, (presses.length || 3) * 4 + 4);
    return {
      kind: 'lights',
      type: 'lights',
      n,
      pattern: target.slice(),
      col: dc,
      floor: df,
      clueColOffset,
      ...(doorId ? { doorId: String(doorId) } : {}),
      seed: puzzleSeed,
      difficulty: d,
      parMoves
    };
  }

  if (type === 'bells') {
    const count = Math.max(3, Math.min(5, 3 + Math.round(d * 2.2)));
    const bellColors = shuffleWithRng(rng, [0, 1, 2, 3, 4]).slice(0, count);
    const order = shuffleWithRng(rng, [...Array(count).keys()]);
    if (d > 0.65) {
      let extra;
      do extra = Math.floor(rng() * count);
      while (extra === order[order.length - 1]);
      order.push(extra);
    }
    const colorOrder = order.map((b) => bellColors[b]);
    const hexColors = colorOrder.map((ci) => RUNE_BELL_COLORS[ci]);
    const colorNames = colorOrder.map((ci) => RUNE_BELL_COLOR_NAMES[ci]);
    const parMoves = Math.max(8, (order.length || 3) * 4 + 4);
    return {
      kind: 'bells',
      type: 'bells',
      order: colorOrder,
      colors: hexColors,
      bellIndices: order.slice(),
      colorNames,
      col: dc,
      floor: df,
      clueColOffset,
      ...(doorId ? { doorId: String(doorId) } : {}),
      seed: puzzleSeed,
      difficulty: d,
      parMoves
    };
  }

  if (type === 'pipes') {
    const n = 3;
    const minLen = d < 0.4 ? 4 : 5;
    const maxLen = d < 0.4 ? 6 : 7;
    const DX = [1, 0, -1, 0];
    const DY = [0, 1, 0, -1];
    const randIntLocal = (a, b) => a + Math.floor(rng() * (b - a + 1));
    let path = null;
    for (let attempt = 0; attempt < 250 && !path; attempt++) {
      const sx = randIntLocal(0, 2);
      const visited = new Set([`0,${sx}`]);
      const cur = [[sx, 0]];
      const dfs = (x, y) => {
        if (y === 2 && cur.length >= minLen && cur.length <= maxLen) return true;
        if (cur.length >= maxLen) return false;
        const dirs = shuffleWithRng(rng, [0, 1, 2, 3]);
        for (const k of dirs) {
          const nx = x + DX[k];
          const ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx > 2 || ny > 2) continue;
          const key = `${ny},${nx}`;
          if (visited.has(key)) continue;
          visited.add(key);
          cur.push([nx, ny]);
          if (dfs(nx, ny)) return true;
          cur.pop();
          visited.delete(key);
        }
        return false;
      };
      if (dfs(sx, 0)) path = cur;
    }
    if (!path) path = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]];
    const sourceX = 1 + path[0][0];
    const targetX = 1 + path[path.length - 1][0];
    const pattern = new Array(n * n).fill(0);
    for (const [gx, gy] of path) pattern[gy * n + gx] = 1;
    return {
      kind: 'pipes',
      type: 'pipes',
      n,
      sourceX,
      targetX,
      pattern,
      col: dc,
      floor: df,
      clueColOffset,
      ...(doorId ? { doorId: String(doorId) } : {}),
      seed: puzzleSeed,
      difficulty: d
    };
  }

  if (type === 'tide_locks') {
    const maxLevel = 3;
    const count = d < 0.5 ? 3 : 4;
    const targets = [];
    for (let i = 0; i < count; i++) {
      targets.push(1 + Math.floor(rng() * maxLevel));
    }
    return {
      kind: 'tide_locks',
      type: 'tide_locks',
      count,
      targets,
      maxLevel,
      col: dc,
      floor: df,
      clueColOffset,
      ...(doorId ? { doorId: String(doorId) } : {}),
      seed: puzzleSeed,
      difficulty: d
    };
  }

  return {
    kind: type,
    type,
    col: dc,
    floor: df,
    clueColOffset,
    ...(doorId ? { doorId: String(doorId) } : {}),
    seed: puzzleSeed,
    difficulty: d
  };
}

function resolveClueColOffset(dc, df, sortedLedges, normElevators) {
  const isBlockedAt = (testCol) => {
    const tc = wrapCol(testCol);
    for (const el of normElevators) {
      if (el.col === tc && el.minFloor <= df + 2.5 && el.maxFloor >= df + 1.2) {
        return true;
      }
    }
    for (const l of sortedLedges) {
      if (l.col !== tc) continue;
      if (l.type === 'pillar' || l.type === 'box') {
        const h = Math.max(1, Number(l.h) || 1);
        if (l.floor < df + 2.5 && l.floor + h > df + 1.2) return true;
      } else if (l.floor >= df + 1 && l.floor <= df + 2) {
        return true;
      }
    }
    return false;
  };
  if (!isBlockedAt(dc)) return 0;
  if (!isBlockedAt(dc + 1)) return 1;
  if (!isBlockedAt(dc - 1)) return -1;
  return 0;
}

function annotateStairDirections(sortedLedges, normElevators) {
  const walkableAt = new Map();
  const barrierCells = new Set();
  const shaftCells = new Set();

  for (const el of normElevators) {
    const ec = wrapCol(el.col);
    for (let f = Math.round(el.minFloor); f <= Math.round(el.maxFloor); f++) {
      shaftCells.add(`${ec}:${f}`);
    }
  }

  for (const l of sortedLedges) {
    if (isBarrierLedgeType(l.type)) {
      const h = Math.max(1, Math.round(l.h || 1));
      for (let k = 0; k < h; k++) {
        barrierCells.add(`${l.col}:${l.floor + k}`);
      }
      continue;
    }
    walkableAt.set(`${l.col}:${l.floor}`, l);
  }

  const canClimbInDir = (l, dir) => {
    if (dir !== 1 && dir !== -1) return false;
    if (!isSolidStairMasonryType(l.type)) return false;
    const c0 = l.col;
    const f0 = l.floor;
    const c1 = wrapCol(c0 + dir);
    const f1 = f0 + 1;

    const l1 = walkableAt.get(`${c1}:${f1}`);
    if (!l1 || !isSolidStairMasonryType(l1.type)) return false;
    if (walkableAt.has(`${c1}:${f0}`)) return false; // Flat bridge of any walkable ledge type
    if (walkableAt.has(`${c0}:${f1}`)) return false; // Ceiling directly above lower step
    if (barrierCells.has(`${c0}:${f0}`) || barrierCells.has(`${c0}:${f1}`) || barrierCells.has(`${c1}:${f1}`)) {
      return false;
    }
    if (shaftCells.has(`${c0}:${f0}`) || shaftCells.has(`${c0}:${f1}`) || shaftCells.has(`${c1}:${f1}`)) {
      return false;
    }
    return true;
  };

  for (const l of sortedLedges) {
    if (isBarrierLedgeType(l.type)) continue;
    let candidateDir = 0;
    if (l.type === 'stairR') {
      candidateDir = 1;
    } else if (l.type === 'stairL') {
      candidateDir = -1;
    } else if (l.isExplicitStair && (l.explicitStairDir === 1 || l.explicitStairDir === -1)) {
      candidateDir = l.explicitStairDir;
    } else if (l.stairDir === 1 || l.stairDir === -1) {
      candidateDir = l.stairDir;
    }

    if (candidateDir !== 0 && canClimbInDir(l, candidateDir)) {
      l.stairDir = candidateDir;
      l.isExplicitStair = true;
      l.explicitStairDir = candidateDir;
    } else {
      l.stairDir = 0;
      l.isExplicitStair = false;
      l.explicitStairDir = 0;
    }
  }

  for (const l of sortedLedges) {
    if (isBarrierLedgeType(l.type)) continue;
    const lowLeft = walkableAt.get(`${wrapCol(l.col - 1)}:${l.floor - 1}`);
    const lowRight = walkableAt.get(`${wrapCol(l.col + 1)}:${l.floor - 1}`);
    if (lowRight && lowRight.stairDir === -1) l.stairDownDir = 1;
    else if (lowLeft && lowLeft.stairDir === 1) l.stairDownDir = -1;
    else l.stairDownDir = 0;
    l.isStair = Boolean(l.stairDir !== 0);
  }
}

function finalizeTower({
  id,
  key,
  act = 1,
  casual = false,
  casualMission = null,
  dailyModifier = null,
  workbench = null,
  treasureChest = null,
  cacheKey = null,
  name,
  subtitle = '',
  theme = 'canyon_river',
  floors = 18,
  exitFloor = null,
  timeLimit = 100,
  parTime = 38,
  spawn = { col: 0, floor: 0 },
  spawnDir = null,
  palette,
  mechanics = {},
  ledges = [],
  elevators = [],
  doors = [],
  switches = [],
  wallStrips = [],
  grappleRings = [],
  hydroRings = [],
  collectibles = [],
  enemies = [],
  crownSeals = [],
  proceduralChunks = null
}) {
  const normElevators = elevators.map((el, idx) => ({
    id: String(el.id || `lift_${idx + 1}`),
    col: wrapCol(el.col),
    minFloor: Number(el.minFloor),
    maxFloor: Number(el.maxFloor),
    startFloor: Number(el.startFloor ?? el.minFloor),
    speed: Number(el.speed ?? 1.75),
    pipeGroup: el.pipeGroup ? String(el.pipeGroup) : null,
    powered: el.powered !== undefined ? Boolean(el.powered) : !el.pipeGroup
  }));

  const normWallStrips = (wallStrips || []).map((ws, idx) => ({
    id: String(ws.id || `strip_${idx + 1}`),
    col: wrapCol(ws.col),
    minFloor: Math.round(Number(ws.minFloor)),
    maxFloor: Math.round(Number(ws.maxFloor))
  }));

  const normGrappleRings = (grappleRings || []).map((gr, idx) => ({
    id: String(gr.id || `ring_${idx + 1}`),
    col: ((Number(gr.col) % COLS) + COLS) % COLS,
    floor: Number(gr.floor)
  }));

  const normHydroRings = (hydroRings || []).map((hr, idx) => ({
    id: String(hr.id || `hring_${idx + 1}`),
    col: Number(wrapFloatCol(hr.col).toFixed(2)),
    floor: Number((Number(hr.floor) || 0).toFixed(2)),
    ...(hr.chainId ? { chainId: String(hr.chainId) } : {}),
    ...(hr.chainIndex !== undefined ? { chainIndex: Number(hr.chainIndex) } : {})
  }));

  const byCoord = new Map();
  for (const raw of ledges) {
    const c = wrapCol(raw.col);
    const f = Math.round(Number(raw.floor));
    const t = raw.type || 'solid';
    const isBarrier = isBarrierLedgeType(t);
    if (!isBarrier) {
      const inShaft = normElevators.some((el) => el.col === c && f >= el.minFloor && f <= el.maxFloor);
      if (inShaft) continue;
      const inStripMid = normWallStrips.some((ws) => ws.col === c && f > ws.minFloor && f <= ws.maxFloor);
      if (inStripMid) continue;
    }
    const slotKey = isBarrier ? `${c}:${f}:${t}` : `${c}:${f}:step`;
    const prev = isBarrier ? null : byCoord.get(slotKey);
    const explicitStairDir =
      !isBarrier && isSolidStairMasonryType(t)
        ? raw.isExplicitStair && (Number(raw.explicitStairDir) === 1 || Number(raw.explicitStairDir) === -1)
          ? Number(raw.explicitStairDir)
          : t === 'stairR'
          ? 1
          : t === 'stairL'
          ? -1
          : raw.stairDir === 1 || raw.stairDir === -1
          ? Number(raw.stairDir)
          : prev?.isExplicitStair && (prev.explicitStairDir === 1 || prev.explicitStairDir === -1)
          ? prev.explicitStairDir
          : 0
        : 0;
    byCoord.set(slotKey, {
      col: c,
      floor: f,
      type: t,
      switchGroup: raw.switchGroup ?? null,
      pipeGroup: raw.pipeGroup ?? null,
      inverted: Boolean(raw.inverted),
      phasePeriod: Number(raw.phasePeriod ?? 3.2),
      phaseOffset: Number(raw.phaseOffset ?? 0),
      ...(raw.stairDir !== undefined ? { stairDir: Number(raw.stairDir) } : {}),
      ...(explicitStairDir !== 0 ? { isExplicitStair: true, explicitStairDir } : {}),
      ...(raw.h !== undefined ? { h: Number(raw.h) } : {}),
      ...(t === 'box' && raw.powerUp && VALID_BOX_POWERUPS.has(raw.powerUp) ? { powerUp: String(raw.powerUp) } : {})
    });
  }

  // Ensure bottom pad exists at base of every Gecko Wall-Strip
  for (const ws of normWallStrips) {
    if (!byCoord.has(`${ws.col}:${ws.minFloor}:step`)) {
      const inShaft = normElevators.some((el) => el.col === ws.col && ws.minFloor >= el.minFloor && ws.minFloor <= el.maxFloor);
      if (!inShaft) {
        byCoord.set(`${ws.col}:${ws.minFloor}:step`, {
          col: ws.col,
          floor: ws.minFloor,
          type: 'solid',
          switchGroup: null,
          pipeGroup: null,
          inverted: false,
          phasePeriod: 3.2,
          phaseOffset: 0
        });
      }
    }
  }

  const spawnCol = wrapCol(spawn.col);
  const spawnFloor = Math.round(Number(spawn.floor));
  if (!byCoord.has(`${spawnCol}:${spawnFloor}:step`)) {
    byCoord.set(`${spawnCol}:${spawnFloor}:step`, {
      col: spawnCol,
      floor: spawnFloor,
      type: 'solid',
      switchGroup: null,
      pipeGroup: null,
      inverted: false,
      phasePeriod: 3.2,
      phaseOffset: 0
    });
  }

  const normDoors = doors.map((d) => {
    const dc = wrapCol(d.col);
    const df = Math.round(Number(d.floor));
    if (!byCoord.has(`${dc}:${df}:step`)) {
      byCoord.set(`${dc}:${df}:step`, {
        col: dc,
        floor: df,
        type: 'solid',
        switchGroup: null,
        pipeGroup: null,
        inverted: false,
        phasePeriod: 3.2,
        phaseOffset: 0
      });
    }
    const isExit = Boolean(d.isExit);
    const isVault = Boolean(d.isVault);
    const isRune = Boolean(d.isRune);
    const resolvedPuzzleType = isRune
      ? RUNE_PUZZLE_TYPES.has(d.puzzleType)
        ? String(d.puzzleType)
        : 'lights'
      : d.puzzleType
      ? String(d.puzzleType)
      : undefined;
    const resolvedPuzzleSeed = isRune
      ? d.puzzleSeed !== undefined && d.puzzleSeed !== null
        ? Number(d.puzzleSeed) >>> 0 || 10101
        : (((Number(id) || 1) * 2654435761 + dc * 7919 + df * 104729) >>> 0) || 10101
      : undefined;
    const resolvedPuzzleDifficulty = isRune
      ? d.puzzleDifficulty !== undefined && d.puzzleDifficulty !== null
        ? Math.max(0, Math.min(1, Number(d.puzzleDifficulty)))
        : casual
        ? 0.3
        : 0.4
      : undefined;
    return {
      id: String(d.id),
      col: dc,
      floor: df,
      targetId: isExit || isVault || isRune ? null : d.targetId ?? null,
      isExit,
      isVault,
      isRune,
      decoy: false,
      ...(resolvedPuzzleType !== undefined ? { puzzleType: resolvedPuzzleType } : {}),
      ...(resolvedPuzzleSeed !== undefined ? { puzzleSeed: resolvedPuzzleSeed } : {}),
      ...(resolvedPuzzleDifficulty !== undefined ? { puzzleDifficulty: resolvedPuzzleDifficulty } : {}),
      ...(d.clueColOffset !== undefined ? { clueColOffset: Number(d.clueColOffset) } : {}),
      ...(d.sealId ? { sealId: String(d.sealId) } : {}),
      tunnelStyle: d.tunnelStyle === 'sparkArch' ? 'sparkArch' : 'stone'
    };
  });

  const normSwitches = switches.map((sw, idx) => {
    const sc = wrapCol(sw.col);
    const sf = Math.round(Number(sw.floor));
    if (!byCoord.has(`${sc}:${sf}:step`)) {
      byCoord.set(`${sc}:${sf}:step`, {
        col: sc,
        floor: sf,
        type: 'solid',
        switchGroup: null,
        pipeGroup: null,
        inverted: false,
        phasePeriod: 3.2,
        phaseOffset: 0
      });
    }
    return {
      id: String(sw.id || `sw_${idx + 1}`),
      col: sc,
      floor: sf,
      group: sw.group || sw.pipeGroup || 'red',
      pipeGroup: sw.pipeGroup || (sw.mode === 'pipeValve' ? sw.group || 'pipeA' : null),
      mode: sw.mode || 'toggle',
      ...(sw.sealId ? { sealId: String(sw.sealId) } : {}),
      ...(sw.requiresLockKeeper ? { requiresLockKeeper: true } : {}),
      ...(sw.targetWaterFloor !== undefined ? { targetWaterFloor: Number(sw.targetWaterFloor) } : {})
    };
  });

  const VALID_COLLECTIBLE_TYPES = new Set([
    'gear',
    'starCore',
    'relic',
    'salvage_part',
    'compass_key',
    'curio',
    'critter_pod'
  ]);

  const normCollectibles = collectibles.map((c, idx) => {
    const cType = VALID_COLLECTIBLE_TYPES.has(c.type) ? c.type : 'gear';
    return {
      id: String(c.id || `col_${idx + 1}`),
      col: wrapCol(c.col),
      floor: Number(c.floor),
      type: cType,
      ...(c.relicId ? { relicId: String(c.relicId) } : {}),
      ...(c.curioId ? { curioId: String(c.curioId) } : {}),
      ...(c.critterId ? { critterId: String(c.critterId) } : {}),
      ...(c.species ? { species: String(c.species) } : {}),
      ...(c.biome ? { biome: String(c.biome) } : {}),
      ...(c.partIndex !== undefined ? { partIndex: Number(c.partIndex) } : {}),
      ...(c.keyIndex !== undefined ? { keyIndex: Number(c.keyIndex) } : {}),
      ...(c.label ? { label: String(c.label) } : {})
    };
  });

  const exitDoor = normDoors.find((d) => d.isExit);
  const computedExitFloor =
    exitFloor !== null ? Number(exitFloor) : exitDoor ? exitDoor.floor : Math.max(1, floors - 2);

  const sortedLedges = Array.from(byCoord.values()).sort((a, b) => a.floor - b.floor || a.col - b.col);
  annotateStairDirections(sortedLedges, normElevators);

  const clampedFloors = Math.max(8, Math.round(Number(floors)));

  for (const nd of normDoors) {
    if (!nd.isRune) continue;
    const offset =
      nd.clueColOffset !== undefined
        ? Number(nd.clueColOffset)
        : resolveClueColOffset(nd.col, nd.floor, sortedLedges, normElevators);
    nd.clueColOffset = offset;
    nd.clue = deriveRuneDoorClue({
      puzzleType: nd.puzzleType,
      puzzleSeed: nd.puzzleSeed,
      puzzleDifficulty: nd.puzzleDifficulty,
      col: nd.col,
      floor: nd.floor,
      clueColOffset: offset,
      doorId: nd.id
    });
  }

  const runeDoors = normDoors.filter((d) => d.isRune);
  const vaultDoor = normDoors.find((d) => d.isVault) || null;
  const primaryClue =
    runeDoors.find((d) => d.puzzleType === 'lights' || d.puzzleType === 'bells')?.clue ||
    runeDoors[0]?.clue ||
    null;

  const sourceEnemies = casual ? enemies.filter((e) => Boolean(e && e.harmless)) : enemies;
  const normEnemies = sanitizeEnemySpawns(
    sourceEnemies.map((e, i) => normalizeEnemy(e, i)),
    normDoors,
    normElevators,
    { col: spawnCol, floor: spawnFloor },
    sortedLedges,
    clampedFloors
  );

  const resolvedTheme = BIOME_PALETTES[theme] ? theme : 'canyon_river';
  const resolvedPalette = palette || BIOME_PALETTES[resolvedTheme];

  const normCrownSeals = (crownSeals || []).map((s, idx) => ({
    id: String(s.id || `seal_${idx + 1}`),
    index: Number(s.index ?? idx + 1),
    label: String(s.label || `Seal ${idx + 1}`),
    shortLabel: String(s.shortLabel || `Seal ${idx + 1}: ${s.label || 'Lock'}`),
    hint: String(s.hint || ''),
    kind: String(s.kind || (idx === 0 ? 'pipe_valves' : idx === 1 ? 'sanctum' : 'upper_sluice')),
    ...(s.pipeGroup ? { pipeGroup: String(s.pipeGroup) } : {}),
    ...(s.doorId ? { doorId: String(s.doorId) } : {}),
    ...(s.switchId ? { switchId: String(s.switchId) } : {})
  }));

  return {
    id: Number(id),
    act: Number(act || Math.min(5, Math.ceil(Number(id || 1) / 2))),
    key: String(key),
    ...(cacheKey ? { cacheKey: String(cacheKey) } : {}),
    real: false,
    casual: Boolean(casual),
    casualMission: casualMission ? { ...casualMission } : null,
    dailyModifier: dailyModifier ? { ...dailyModifier } : null,
    crownSeals: normCrownSeals,
    crownSealsTotal: normCrownSeals.length,
    clue: primaryClue,
    runeDoors,
    vaultDoor,
    workbench: workbench
      ? {
          col: wrapCol(workbench.col),
          floor: Math.round(Number(workbench.floor)),
          crafted: Boolean(workbench.crafted),
          ...(workbench.label ? { label: String(workbench.label) } : {})
        }
      : null,
    treasureChest: treasureChest
      ? {
          col: wrapCol(treasureChest.col),
          floor: Math.round(Number(treasureChest.floor)),
          opened: Boolean(treasureChest.opened),
          ...(treasureChest.curioId ? { curioId: String(treasureChest.curioId) } : {}),
          ...(treasureChest.gearReward !== undefined ? { gearReward: Number(treasureChest.gearReward) } : {})
        }
      : null,
    era: 'reboot',
    biome: resolvedTheme,
    name: String(name),
    subtitle: String(subtitle),
    theme: resolvedTheme,
    floors: clampedFloors,
    exitFloor: computedExitFloor,
    timeLimit: Math.max(45, Math.round(Number(timeLimit))),
    parTime: Math.max(15, Math.round(Number(parTime))),
    spawn: { col: spawnCol, floor: spawnFloor },
    spawnDir: (() => {
      if (spawnDir === -1 || spawnDir === 1) return spawnDir;
      let bestDir = 1;
      let bestDist = Infinity;
      for (const l of sortedLedges) {
        if (l.floor !== spawnFloor || !l.stairDir) continue;
        const d = colDist(spawnCol, l.col);
        const ad = Math.abs(d);
        if (ad < bestDist) {
          bestDist = ad;
          bestDir = d === 0 ? l.stairDir : Math.sign(d) || l.stairDir;
        }
      }
      return bestDir === -1 ? -1 : 1;
    })(),
    palette: { ...resolvedPalette },
    mechanics: {
      ...DEFAULT_MECHANICS,
      ...mechanics
    },
    ledges: sortedLedges,
    elevators: normElevators,
    doors: normDoors,
    switches: normSwitches,
    wallStrips: normWallStrips,
    grappleRings: normGrappleRings,
    hydroRings: normHydroRings,
    ...(Array.isArray(proceduralChunks) ? { proceduralChunks: proceduralChunks.slice() } : {}),
    collectibles: normCollectibles,
    enemies: normEnemies
  };
}

// ============================================================================
// 10 HANDCRAFTED CAMPAIGN SPIRES ACROSS EARTH'S 5 WATER BIOMES (COLS = 20)
// ============================================================================

export function createCampaignTowers() {
  // Flexible Spire Seal builder (1..3 bespoke seals per Spire — abolishing the uniform 3-seal mold!)
  const makeSeals = (defs) =>
    defs.map((d, idx) => ({
      id: d.id || `seal_${idx + 1}`,
      index: idx + 1,
      label: d.label,
      shortLabel: `Seal ${idx + 1}: ${d.label}`,
      hint: d.hint,
      kind: d.kind,
      ...(d.pipeGroup ? { pipeGroup: d.pipeGroup } : {}),
      ...(d.doorId ? { doorId: d.doorId } : {}),
      ...(d.switchId ? { switchId: d.switchId } : {})
    }));

  // Expressive Hydro-Ring Speed Line builder for flowing jump, stair, grapple & geyser arcs
  const makeHydroRings = (prefix, pts) =>
    pts.map(([col, floor, chainId], idx) => ({
      id: `${prefix}_hr_${idx + 1}`,
      col,
      floor,
      ...(chainId ? { chainId } : {}),
      chainIndex: idx
    }));

  // --------------------------------------------------------------------------
  // ACT I — REDWOOD CANYON RIVERS ('canyon_river', Spires 1 & 2)
  // --------------------------------------------------------------------------

  // SPIRE 1: SUNLIT GORGE SLUICE (15 floors, 1 Seal, NO Boss — Joyous, Breezy Onboarding Sprint!
  // Flowing 1:1 stairs, 1 crisp Copper Pipe-Valve powering the Gorge Lift, optional Snap-Crab Loft
  // with Turbo Current Supply Crate, optional bonus Pipe Sanctum, 1 exhilarating +10 Cross-Tower
  // Tunnel, Bubble Shield Supply Crate, and a sweeping Hydro-Ring summit sprint!)
  const s1Ledges = [];
  span(s1Ledges, 0, 18, 4, 'solid');                    // Spawn Quay [18,19,0,1]
  stairFlight(s1Ledges, 0, 2, 2, 1, 8, 'solid');        // Breezy 2F stair flow -> wide courtyard [4..11] at f=2!
  // Optional Snap-Crab Springboard Loft at f=5 (+3F above Crab 9.5 — 4 open cols [7,8,9,11] clear of crate at 10!)
  span(s1Ledges, 5, 7, 5, 'solid');                     // [7,8,9,10,11] at f=5
  tile(s1Ledges, 10, 5, 'box', { powerUp: 'turbo_current' }); // Glowing Turbo Current Supply Crate!
  // Pipe-powered Gorge Lift s1_lift1 at col 12 (f=2..7) — energized by 1 crisp Pipe-Valve at (7, 2)!
  span(s1Ledges, 7, 13, 5, 'solid');                    // Sunlit Mid Overlook [13,14,15,16,17] at f=7 (Optional Sanctum at 15)
  tile(s1Ledges, 18, 7, 'pillar', { h: 3 });            // Stone Bulkhead forces Cross-Tower Tunnel (17,7 -> 7,8)!
  span(s1Ledges, 8, 5, 4, 'solid');                     // Opposite Gorge Balcony [5,6,7,8] at f=8 (+3F clear above f=5 loft!)
  stairFlight(s1Ledges, 8, 9, 3, 1, 5, 'solid');        // Sweeping 3F stair flight -> [12,13,14,15,16] at f=11
  tile(s1Ledges, 14, 11, 'box', { powerUp: 'bubble_shield' }); // Glowing Bubble Shield Supply Crate!
  stairFlight(s1Ledges, 11, 17, 2, 1, 7, 'solid');      // Joyous Summit Stair Sprint -> Crown Terrace [19,0,1,2,3,4,5] at f=13!
  span(s1Ledges, 14, 6, 2, 'solid');                    // Bonus Harmonic Seed perch [6,7] at f=14

  const t1 = finalizeTower({
    id: 1,
    act: 1,
    key: 'spire_1',
    name: 'SUNLIT GORGE SLUICE',
    subtitle: 'ACT I • REDWOOD CANYON RIVERS',
    theme: 'canyon_river',
    floors: 15,
    timeLimit: 220,
    parTime: 75,
    spawn: { col: 0, floor: 0 },
    ledges: s1Ledges,
    elevators: [
      { id: 's1_lift1', col: 12, minFloor: 2, maxFloor: 7, startFloor: 2, speed: 2.0, pipeGroup: 'pipeA', powered: false }
    ],
    doors: [
      { id: 's1_t1a', col: 17, floor: 7, targetId: 's1_t1b', tunnelStyle: 'stone' },
      { id: 's1_t1b', col: 7, floor: 8, targetId: 's1_t1a', tunnelStyle: 'stone' },
      { id: 's1_sanctum', col: 15, floor: 7, isRune: true, puzzleType: 'pipes', puzzleSeed: 11011, puzzleDifficulty: 0.25 },
      { id: 's1_crown', col: 3, floor: 13, isExit: true }
    ],
    switches: [
      { id: 's1_pipe1', col: 7, floor: 2, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' }
    ],
    hydroRings: makeHydroRings('s1', [
      [2.5, 0.8, 'open'],
      [3.5, 1.8, 'open'],
      [5.0, 2.3, 'open'],
      [9.5, 8.8, 'climb'],
      [10.5, 9.8, 'climb'],
      [11.5, 10.8, 'climb'],
      [17.5, 11.8, 'summit']
    ]),
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Gorge Valve Pressure',
        hint: 'Climb sunlit stairs & spin the Copper Pipe-Valve to power the Gorge Lift',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      }
    ]),
    collectibles: [
      { id: 's1_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's1_g2', col: 8, floor: 5, type: 'gear' },
      { id: 's1_g3', col: 6, floor: 8, type: 'gear' },
      { id: 's1_g4', col: 13, floor: 11, type: 'gear' },
      { id: 's1_g5', col: 0, floor: 13, type: 'gear' },
      { id: 's1_log', col: 5, floor: 8, type: 'relic', relicId: 'relic_t1' },
      { id: 's1_seed', col: 6, floor: 14, type: 'starCore' },
      { id: 's1_cr1', col: 11, floor: 5, type: 'critter_pod', critterId: 'critter_s1_1', species: 'River Otter', biome: 'canyon_river' },
      { id: 's1_cr2', col: 16, floor: 7, type: 'critter_pod', critterId: 'critter_s1_2', species: 'River Otter', biome: 'canyon_river' },
      { id: 's1_cr3', col: 7, floor: 14, type: 'critter_pod', critterId: 'critter_s1_3', species: 'River Otter', biome: 'canyon_river' }
    ],
    enemies: [
      { type: 'snap_crab', col: 9.5, floor: 2, dir: 1, speed: 1.35 },
      { type: 'gulp_hopper', col: 14.5, floor: 7, dir: -1, speed: 1.45 },
      { type: 'volt_eel', col: 6.5, floor: 9.4, dir: 1, speed: 1.55, amp: 0.28 },
      { type: 'rail_skater', col: 1.0, floor: 13, dir: 1, speed: 1.55, axis: 'h' }
    ]
  });

  // SPIRE 2: REDWOOD CATARACT DAM (19 floors, 2 Seals + Act I Boss:
  // Spring Floodgate rising clean-water swim + Snap-Crab Loft + Hydro-Wheel stair climb +
  // +10 Cross-Tower Tunnel + optional Tide-Locks Sanctum & Vault + Redwood Siphon Warden duel!)
  const s2Ledges = [];
  span(s2Ledges, 0, 18, 4, 'solid');                    // Spawn [18,19,0,1]
  stairFlight(s2Ledges, 0, 2, 2, 1, 5, 'solid');        // 2F rise -> Floodgate Deck [4,5,6,7,8] at f=2 (FloodValve 6, Crab 5.5)
  span(s2Ledges, 5, 5, 4, 'solid');                     // High Valve Loft [5,6,7,8] at f=5 (open [5,6,8] above Crab 5.5!)
  tile(s2Ledges, 7, 5, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Supply Crate guarding Pipe-Valve 2 at col 8
  span(s2Ledges, 3, 10, 2, 'crumble');                  // Floodgate swim/grapple crossing [10,11] at f=3 (1-col gap over 9!)
  span(s2Ledges, 3, 12, 4, 'solid');                    // Dam Valve Terrace [12,13,14,15] at f=3 (Pipe-Valve 1 at 14)
  // Pipe-powered Dam Lift s2_lift_pipe at col 16 (f=3..9)
  span(s2Ledges, 9, 17, 6, 'solid');                    // Mid-Spire Dam Plaza [17,18,19,0,1,2] at f=9 (Optional Vault 19 & Sanctum 0)
  tile(s2Ledges, 18, 9, 'box', { powerUp: 'hydro_magnet' }); // Hydro-Magnet Supply Crate!
  stairFlight(s2Ledges, 9, 3, 2, 1, 4, 'solid');        // Hydro-Wheel vertical rise -> [5,6,7,8] at f=11
  span(s2Ledges, 12, 10, 3, 'solid');                   // 1-col grapple leap over col 9 -> [10,11,12] at f=12
  tile(s2Ledges, 13, 12, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (12 -> 2 on f=12)!
  span(s2Ledges, 12, 1, 3, 'solid');                    // Opposite side [1,2,3] at f=12
  stairFlight(s2Ledges, 12, 0, 2, -1, 4, 'solid');      // Counter-clockwise 2F rise -> [15,16,17,18] at f=14
  tile(s2Ledges, 15, 14, 'steamVent', { phasePeriod: 3.1, phaseOffset: 0.2 }); // Express Hydro-Geyser beside Lift 2!
  // Counterweight Lift s2_lift2 at col 14 (f=14..17)
  span(s2Ledges, 17, 15, 9, 'solid');                   // Crown Dam Boss Arena [15,16,17,18,19,0,1,2,3] at f=17!
  span(s2Ledges, 18, 4, 2, 'solid');                    // Bonus perch [4,5] at f=18

  const t2 = finalizeTower({
    id: 2,
    act: 1,
    key: 'spire_2',
    name: 'REDWOOD CATARACT DAM',
    subtitle: 'ACT I BOSS • RIVER FLOODGATE CITADEL',
    theme: 'canyon_river',
    floors: 19,
    timeLimit: 255,
    parTime: 105,
    spawn: { col: 0, floor: 0 },
    ledges: s2Ledges,
    elevators: [
      { id: 's2_lift_pipe', col: 16, minFloor: 3, maxFloor: 9, startFloor: 3, speed: 1.95, pipeGroup: 'pipeA', powered: false },
      { id: 's2_lift2', col: 14, minFloor: 14, maxFloor: 17, startFloor: 14, speed: 2.0 }
    ],
    doors: [
      { id: 's2_t1a', col: 12, floor: 12, targetId: 's2_t1b', tunnelStyle: 'stone' },
      { id: 's2_t1b', col: 2, floor: 12, targetId: 's2_t1a', tunnelStyle: 'stone' },
      { id: 's2_sanctum', col: 0, floor: 9, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 22022, puzzleDifficulty: 0.35 },
      { id: 's2_vault', col: 19, floor: 9, isVault: true },
      { id: 's2_crown', col: 2, floor: 17, isExit: true }
    ],
    switches: [
      { id: 's2_flood1', col: 6, floor: 2, group: 'flood', mode: 'floodValve', targetWaterFloor: 2.35 },
      { id: 's2_pipe1', col: 14, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's2_pipe2', col: 8, floor: 5, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's2_seal2_sluice', col: 16, floor: 17, group: 'seal_2', mode: 'sluiceSeal', sealId: 'seal_2', requiresLockKeeper: true }
    ],
    grappleRings: [
      { id: 's2_ring1', col: 9.5, floor: 3.9 },
      { id: 's2_ring2', col: 9.0, floor: 12.4 }
    ],
    hydroRings: makeHydroRings('s2', [
      [9.0, 3.2, 'basin'],
      [10.5, 3.6, 'basin'],
      [3.5, 9.8, 'wheel'],
      [4.5, 10.8, 'wheel'],
      [9.0, 12.2, 'arch'],
      [19.5, 12.8, 'upper'],
      [18.5, 13.8, 'upper']
    ]),
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Dam Pipe Pressure',
        hint: 'Open Floodgate, bounce up to Valve 2 & spin both Dam Valves to power the Lift',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Redwood Warden Seal',
        hint: 'Defeat the Act I Redwood Siphon Warden & pull the Crown Dam Sluice Lever',
        kind: 'upper_sluice',
        switchId: 's2_seal2_sluice'
      }
    ]),
    collectibles: [
      { id: 's2_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's2_g2', col: 13, floor: 3, type: 'gear' },
      { id: 's2_g3', col: 6, floor: 11, type: 'gear' },
      { id: 's2_g4', col: 17, floor: 14, type: 'gear' },
      { id: 's2_g5', col: 19, floor: 17, type: 'gear' },
      { id: 's2_log', col: 1, floor: 9, type: 'relic', relicId: 'relic_t2' },
      { id: 's2_seed', col: 4, floor: 18, type: 'starCore' },
      { id: 's2_cr1', col: 7, floor: 2, type: 'critter_pod', critterId: 'critter_s2_1', species: 'River Otter', biome: 'canyon_river' },
      { id: 's2_cr2', col: 17, floor: 9, type: 'critter_pod', critterId: 'critter_s2_2', species: 'River Otter', biome: 'canyon_river' },
      { id: 's2_cr3', col: 5, floor: 18, type: 'critter_pod', critterId: 'critter_s2_3', species: 'River Otter', biome: 'canyon_river' }
    ],
    enemies: [
      { type: 'snap_crab', col: 5.5, floor: 2, dir: 1, speed: 1.45 },
      { type: 'snap_crab', col: 12.5, floor: 3, dir: -1, speed: 1.55 },
      { type: 'barnacle_mortar', col: 7.5, floor: 11, dir: -1, firePeriod: 3.4 },
      { type: 'rail_skater', col: 17.0, floor: 14, dir: 1, speed: 1.7, axis: 'h' },
      { type: 'siphon_warden', col: 19.0, floor: 17.3, dir: -1, speed: 2.0, hp: 3, maxHp: 3, act: 1, isLockKeeper: true, bossTitle: 'REDWOOD SIPHON WARDEN', sealId: 'seal_2' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT II — CRYSTAL ALPINE LAKES ('alpine_lake', Spires 3 & 4)
  // --------------------------------------------------------------------------

  // SPIRE 3: MIRROR TARN AQUEDUCT (20 floors, 2 Seals, NO Boss — Glacier Ice-Slide Momentum
  // Runs + Gecko Crystal Wall-Scamper Cliffs + Mandatory Harmonic Bells Sanctum + Ice-Ring Climax!)
  const s3Ledges = [];
  span(s3Ledges, 0, 18, 4, 'solid');
  stairFlight(s3Ledges, 0, 2, 2, 1, 3, 'solid');        // 2F accent -> [4,5,6] at f=2
  span(s3Ledges, 3, 8, 3, 'solid');                     // 1-col jump over col 7 -> [8,9,10] at f=3 (Pipe-Valve 1 at 9)
  tile(s3Ledges, 8, 3, 'ice');                          // Glacier Ice approach tile!
  // Gecko Crystal Wall-Strip at col 11 (f=3..7) -> High Glacier Ice-Slide Runway [12..16] at f=7
  span(s3Ledges, 7, 12, 5, 'ice');
  tile(s3Ledges, 12, 7, 'solid');
  tile(s3Ledges, 14, 7, 'solid');
  tile(s3Ledges, 14, 7, 'box', { powerUp: 'turbo_current' }); // Turbo Current Supply Crate guarding Valve 2!
  tile(s3Ledges, 15, 7, 'solid');                       // Pipe-Valve 2 at (15, 7)
  // Pipe-powered Lift s3_lift1 at col 17 (f=7..11) -> Mid-Spire Tarn Plaza [18..1] at f=11
  span(s3Ledges, 11, 18, 4, 'solid');                   // [18,19,0,1] at f=11 (Bells Sanctum at 19)
  tile(s3Ledges, 1, 11, 'pillar', { h: 3 });            // Exterior Bulkhead forces +10 Cross-Tower Tunnel (0 -> 10 on f=11)!
  span(s3Ledges, 11, 7, 5, 'solid');                    // Opposite side [7,8,9,10,11] at f=11 (4-col void to Lift 1!)
  tile(s3Ledges, 8, 11, 'box', { powerUp: 'hydro_magnet' }); // Hydro-Magnet Supply Crate!
  span(s3Ledges, 12, 5, 2, 'solid');                    // West scout spur [5,6] at f=12 (Gear)
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Glacier Lift s3_lift2 at col 13 (f=12..16)!
  tile(s3Ledges, 11, 11, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s3Ledges, 12, 12, 1, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // High-Speed Glacier Summit Run (f=16..18 — pure ice-to-ring momentum sprint, NO boss speedbump!)
  span(s3Ledges, 16, 14, 4, 'ice');                     // Glacier Ice-Slide [14,15,16,17] at f=16
  tile(s3Ledges, 14, 16, 'solid');
  tile(s3Ledges, 17, 16, 'solid');
  span(s3Ledges, 17, 19, 2, 'solid');                   // 1-col Grapple/Ice leap over 18 -> [19,0] at f=17
  stairFlight(s3Ledges, 17, 1, 1, 1, 7, 'solid');       // 1F rise -> Summit Tarn Runway [2,3,4,5,6,7,8] at f=18!
  span(s3Ledges, 18, 4, 2, 'ice');                      // Fast ice-slide dash strip [4,5] straight to Crown Valve 7!
  span(s3Ledges, 19, 9, 2, 'solid');                    // Bonus perch [9,10] at f=19

  const t3 = finalizeTower({
    id: 3,
    act: 2,
    key: 'spire_3',
    name: 'MIRROR TARN AQUEDUCT',
    subtitle: 'ACT II • CRYSTAL ALPINE LAKES',
    theme: 'alpine_lake',
    floors: 20,
    timeLimit: 255,
    parTime: 105,
    spawn: { col: 0, floor: 0 },
    ledges: s3Ledges,
    elevators: [
      { id: 's3_lift1', col: 17, minFloor: 7, maxFloor: 11, startFloor: 7, speed: 1.95, pipeGroup: 'pipeA', powered: false },
      { id: 's3_lift2', col: 13, minFloor: 12, maxFloor: 16, startFloor: 12, speed: 2.0, pipeGroup: 'seal_2', powered: false }
    ],
    wallStrips: [
      { id: 's3_gecko1', col: 11, minFloor: 3, maxFloor: 7 }
    ],
    grappleRings: [
      { id: 's3_ring1', col: 18.0, floor: 17.4 }
    ],
    hydroRings: makeHydroRings('s3', [
      [13.0, 7.6, 'glacier'],
      [14.5, 7.6, 'glacier'],
      [16.0, 7.6, 'glacier'],
      [15.0, 16.6, 'summit'],
      [16.5, 16.6, 'summit'],
      [18.0, 17.3, 'summit'],
      [1.5, 17.8, 'summit'],
      [4.5, 18.6, 'summit']
    ]),
    doors: [
      { id: 's3_t1a', col: 0, floor: 11, targetId: 's3_t1b', tunnelStyle: 'stone' },
      { id: 's3_t1b', col: 10, floor: 11, targetId: 's3_t1a', tunnelStyle: 'stone' },
      { id: 's3_sanctum', col: 19, floor: 11, isRune: true, puzzleType: 'bells', puzzleSeed: 33033, puzzleDifficulty: 0.38, sealId: 'seal_2' },
      { id: 's3_crown', col: 7, floor: 18, isExit: true }
    ],
    switches: [
      { id: 's3_pipe1', col: 9, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's3_pipe2', col: 15, floor: 7, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Glacier Pipe Pressure',
        hint: 'Leap tarn chasm to Valve 1, Gecko-Scamper Crystal Cliff & spin Valve 2',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Harmonic Bells Sanctum',
        hint: 'Harmonize the Mid-Spire Water-Bells to retract the Glacier Gate & race to Crown',
        kind: 'sanctum',
        doorId: 's3_sanctum'
      }
    ]),
    collectibles: [
      { id: 's3_g1', col: 8, floor: 3, type: 'gear' },
      { id: 's3_g2', col: 13, floor: 7, type: 'gear' },
      { id: 's3_g3', col: 5, floor: 12, type: 'gear' },
      { id: 's3_g4', col: 16, floor: 16, type: 'gear' },
      { id: 's3_g5', col: 4, floor: 18, type: 'gear' },
      { id: 's3_log', col: 18, floor: 11, type: 'relic', relicId: 'relic_t3' },
      { id: 's3_seed', col: 9, floor: 19, type: 'starCore' },
      { id: 's3_cr1', col: 10, floor: 3, type: 'critter_pod', critterId: 'critter_s3_1', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's3_cr2', col: 16, floor: 7, type: 'critter_pod', critterId: 'critter_s3_2', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's3_cr3', col: 10, floor: 19, type: 'critter_pod', critterId: 'critter_s3_3', species: 'Alpine Newt', biome: 'alpine_lake' }
    ],
    enemies: [
      { type: 'gulp_hopper', col: 5.5, floor: 2, dir: -1, speed: 1.6 },
      { type: 'vent_stalker', col: 13.5, floor: 8.4, dir: 1, speed: 1.8, axis: 'v', minFloor: 7.4, maxFloor: 9.8 },
      { type: 'snap_crab', col: 9.5, floor: 11, dir: 1, speed: 1.65 },
      { type: 'rail_skater', col: 15.5, floor: 16, dir: -1, speed: 1.75, axis: 'h' },
      { type: 'rail_skater', col: 4.5, floor: 18, dir: 1, speed: 1.85, axis: 'h' }
    ]
  });

  // SPIRE 4: ALPENGLOW SPILLWAY SPIRE (21 floors, 3 Seals + Act II Boss:
  // Dynamic Alpine Gale timing + Snap-Crab Loft + Sea-Glass Prism Sanctum +
  // Triple Sequential Tail-Grapple Sky-Chasm Chain + Glacier Siphon Warden!)
  const s4Ledges = [];
  span(s4Ledges, 0, 18, 4, 'solid');
  stairFlight(s4Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F rise -> [4,5] at f=2
  span(s4Ledges, 3, 6, 4, 'solid');                     // Step/jump up to [6,7,8,9] at f=3 (Snap-Crab 6.5, ice at 8)
  tile(s4Ledges, 8, 3, 'ice');
  span(s4Ledges, 6, 6, 4, 'solid');                     // High Valve Loft [6,7,8,9] at f=6 (open [6,7,9] above Crab 6.5!)
  tile(s4Ledges, 8, 6, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Supply Crate guarding Valve 2!
  span(s4Ledges, 3, 11, 1, 'solid');                    // Lower Grapple stepping stone [11] at f=3
  span(s4Ledges, 4, 12, 4, 'solid');                    // [12,13,14,15] at f=4 (Pipe-Valve 1 at 14)
  // Pipe-powered Lift s4_lift1 at col 16 (f=4..10) -> Mid-Spire Spillway Plaza [17..3] at f=10
  span(s4Ledges, 10, 17, 7, 'solid');                   // [17,18,19,0,1,2,3] at f=10 (Prism Sanctum 18, Vault 0)
  tile(s4Ledges, 3, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s4Ledges, 11, 4, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  span(s4Ledges, 11, 6, 3, 'solid');                    // Sky-Chain Launchpad [6,7,8] at f=11
  tile(s4Ledges, 7, 11, 'box', { powerUp: 'turbo_current' }); // Turbo Current Supply Crate before Triple Grapple Chain!
  // TRIPLE SEQUENTIAL TAIL-GRAPPLE SKY-CHASM CHAIN (each 1 empty col + 1F rise!)
  span(s4Ledges, 12, 10, 2, 'solid');                   // Sky Island 1 [10,11] at f=12 (Grapple 2 over col 9)
  span(s4Ledges, 13, 13, 2, 'solid');                   // Sky Island 2 [13,14] at f=13 (Grapple 3 over col 12)
  span(s4Ledges, 14, 16, 4, 'solid');                   // Upper Ice Overlook [16,17,18,19] at f=14 (Grapple 4 over col 15)
  tile(s4Ledges, 17, 14, 'ice');
  tile(s4Ledges, 0, 14, 'pillar', { h: 3 });            // Bulkhead forces +10 Upward Cross-Tower Tunnel (19,14 -> 9,15)!
  span(s4Ledges, 15, 8, 3, 'solid');                    // Opposite side [8,9,10] at f=15 (3F clear above f=12 -> ZERO bypass!)
  // Counterweight Lift s4_lift2 at col 7 (f=15..19) -> Act II Boss Crown Arena [8..14] at f=19!
  span(s4Ledges, 19, 8, 7, 'solid');                    // [8,9,10,11,12,13,14] at f=19
  span(s4Ledges, 20, 15, 2, 'solid');                   // Bonus perch [15,16] at f=20

  const t4 = finalizeTower({
    id: 4,
    act: 2,
    key: 'spire_4',
    name: 'ALPENGLOW SPILLWAY SPIRE',
    subtitle: 'ACT II BOSS • GLACIAL GALE MONOLITH',
    theme: 'alpine_lake',
    floors: 21,
    timeLimit: 280,
    parTime: 120,
    spawn: { col: 0, floor: 0 },
    mechanics: { windForce: 0.38, windPeriod: 6.2 },
    ledges: s4Ledges,
    elevators: [
      { id: 's4_lift1', col: 16, minFloor: 4, maxFloor: 10, startFloor: 4, speed: 1.95, pipeGroup: 'pipeA', powered: false },
      { id: 's4_lift2', col: 7, minFloor: 15, maxFloor: 19, startFloor: 15, speed: 2.05 }
    ],
    grappleRings: [
      { id: 's4_ring1', col: 10.5, floor: 4.5 },
      { id: 's4_ring2', col: 9.0, floor: 12.5 },
      { id: 's4_ring3', col: 12.0, floor: 13.5 },
      { id: 's4_ring4', col: 15.0, floor: 14.5 }
    ],
    hydroRings: makeHydroRings('s4', [
      [10.5, 3.8, 'lower'],
      [11.5, 4.4, 'lower'],
      [9.0, 12.0, 'skychain'],
      [10.5, 12.6, 'skychain'],
      [12.0, 13.0, 'skychain'],
      [13.5, 13.6, 'skychain'],
      [15.0, 14.0, 'skychain'],
      [16.5, 14.6, 'skychain']
    ]),
    doors: [
      { id: 's4_t1a', col: 19, floor: 14, targetId: 's4_t1b', tunnelStyle: 'stone' },
      { id: 's4_t1b', col: 9, floor: 15, targetId: 's4_t1a', tunnelStyle: 'stone' },
      { id: 's4_sanctum', col: 18, floor: 10, isRune: true, puzzleType: 'beam', puzzleSeed: 44044, puzzleDifficulty: 0.42, sealId: 'seal_2' },
      { id: 's4_vault', col: 0, floor: 10, isVault: true },
      { id: 's4_crown', col: 13, floor: 19, isExit: true }
    ],
    switches: [
      { id: 's4_pipe1', col: 14, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's4_pipe2', col: 9, floor: 6, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's4_seal3_sluice', col: 9, floor: 19, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Spillway Pressure',
        hint: 'Crab-bounce onto High Balcony Valve 2 & spin Spillway Valve 1',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Sea-Glass Prism Sanctum',
        hint: 'Route the Prism Beam inside the Mid-Spire Sanctum & soar the Triple Grapple Chain',
        kind: 'sanctum',
        doorId: 's4_sanctum'
      },
      {
        id: 'seal_3',
        label: 'Glacier Warden Seal',
        hint: 'Defeat the Act II Glacier Siphon Warden & pull the Upper Sluice Lever',
        kind: 'upper_sluice',
        switchId: 's4_seal3_sluice'
      }
    ]),
    collectibles: [
      { id: 's4_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's4_g2', col: 13, floor: 4, type: 'gear' },
      { id: 's4_g3', col: 2, floor: 10, type: 'gear' },
      { id: 's4_g4', col: 18, floor: 14, type: 'gear' },
      { id: 's4_g5', col: 11, floor: 19, type: 'gear' },
      { id: 's4_log', col: 19, floor: 10, type: 'relic', relicId: 'relic_t4' },
      { id: 's4_seed', col: 15, floor: 20, type: 'starCore' },
      { id: 's4_cr1', col: 15, floor: 4, type: 'critter_pod', critterId: 'critter_s4_1', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's4_cr2', col: 1, floor: 10, type: 'critter_pod', critterId: 'critter_s4_2', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's4_cr3', col: 16, floor: 20, type: 'critter_pod', critterId: 'critter_s4_3', species: 'Alpine Newt', biome: 'alpine_lake' }
    ],
    enemies: [
      { type: 'snap_crab', col: 6.5, floor: 3, dir: 1, speed: 1.55 },
      { type: 'vent_stalker', col: 18.5, floor: 11.2, dir: -1, speed: 1.9, axis: 'v', minFloor: 10.0, maxFloor: 12.6 },
      { type: 'barnacle_mortar', col: 13.5, floor: 13, dir: -1, firePeriod: 3.3 },
      { type: 'gulp_hopper', col: 17.5, floor: 14, dir: -1, speed: 1.8 },
      { type: 'siphon_warden', col: 11.5, floor: 19.3, dir: 1, speed: 2.1, hp: 3, maxHp: 3, act: 2, isLockKeeper: true, bossTitle: 'GLACIER SIPHON WARDEN', sealId: 'seal_3' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT III — EMERALD MIST BAYOUS ('mist_bayou', Spires 5 & 6)
  // --------------------------------------------------------------------------

  // SPIRE 5: FIREFLY CYPRESS RELIQUARY (21 floors, 2 Seals, NO Boss — Twilight Bayou Labyrinth!
  // Dual Red & Cyan Phase Bridges + Firefly Volt-Eel ambushes + 3 glowing Supply Crates +
  // +10 Cypress Tunnel + Mandatory Hydro-Mosaic Sanctum + Vine Gecko Canopy Sprint!)
  const s5Ledges = [];
  span(s5Ledges, 0, 18, 4, 'solid');
  stairFlight(s5Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F rise -> [4,5] at f=2
  span(s5Ledges, 3, 6, 3, 'solid');                     // [6,7,8] at f=3 (Pipe-Valve 1 at 6, Red Switch at 7)
  span(s5Ledges, 4, 9, 2, 'phaseBlock', { switchGroup: 'red', inverted: false });
  span(s5Ledges, 4, 11, 4, 'solid');                    // Bayou Isle [11,12,13,14] at f=4 (Crate 12, Cyan Switch 13)
  tile(s5Ledges, 12, 4, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Supply Crate!
  span(s5Ledges, 5, 15, 2, 'phaseBlock', { switchGroup: 'cyan', inverted: false });
  span(s5Ledges, 5, 17, 3, 'solid');                    // Valve Perch [17,18,19] at f=5 (Pipe-Valve 2 at 18)
  // Pipe-powered Lift s5_lift1 at col 0 (f=5..10) -> Mid Cypress Deck [1..4] at f=10
  span(s5Ledges, 10, 1, 4, 'solid');                    // [1,2,3,4] at f=10
  tile(s5Ledges, 4, 10, 'pillar', { h: 3 });            // Bulkhead forces +10 Cross-Tower Tunnel (3 -> 13 on f=10)!
  span(s5Ledges, 10, 11, 5, 'solid');                   // Opposite Sanctum Courtyard [11,12,13,14,15] at f=10!
  tile(s5Ledges, 11, 10, 'box', { powerUp: 'hydro_magnet' }); // Hydro-Magnet Supply Crate (open neighbor 12!)
  span(s5Ledges, 11, 9, 2, 'solid');                    // West scout spur [9,10] at f=11 (Gear)
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s5_lift2 at col 18 (f=11..15)!
  tile(s5Ledges, 15, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s5Ledges, 11, 16, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Firefly Canopy (f=15..19 — NO boss! Pure twilight flow!)
  span(s5Ledges, 15, 19, 7, 'solid');                   // [19,0,1,2,3,4,5] at f=15
  tile(s5Ledges, 2, 15, 'box', { powerUp: 'turbo_current' }); // Turbo Current Supply Crate!
  // Vine Gecko Wall-Strip at col 6 (f=15..18)
  span(s5Ledges, 18, 7, 3, 'solid');                    // [7,8,9] at f=18
  stairFlight(s5Ledges, 18, 10, 1, 1, 7, 'solid');      // 1F rise -> Crown Cypress Reliquary [11..17] at f=19!
  span(s5Ledges, 20, 18, 2, 'solid');                   // Bonus perch [18,19] at f=20

  const t5 = finalizeTower({
    id: 5,
    act: 3,
    key: 'spire_5',
    name: 'FIREFLY CYPRESS RELIQUARY',
    subtitle: 'ACT III • EMERALD MIST BAYOUS',
    theme: 'mist_bayou',
    floors: 21,
    timeLimit: 265,
    parTime: 110,
    spawn: { col: 0, floor: 0 },
    ledges: s5Ledges,
    elevators: [
      { id: 's5_lift1', col: 0, minFloor: 5, maxFloor: 10, startFloor: 5, speed: 1.95, pipeGroup: 'pipeA', powered: false },
      { id: 's5_lift2', col: 18, minFloor: 11, maxFloor: 15, startFloor: 11, speed: 2.0, pipeGroup: 'seal_2', powered: false }
    ],
    wallStrips: [
      { id: 's5_gecko1', col: 6, minFloor: 15, maxFloor: 18 }
    ],
    grappleRings: [
      { id: 's5_ring1', col: 10.0, floor: 19.4 }
    ],
    hydroRings: makeHydroRings('s5', [
      [9.5, 4.6, 'phase'],
      [15.5, 5.6, 'phase'],
      [0.5, 15.6, 'canopy'],
      [3.0, 15.6, 'canopy'],
      [8.0, 18.6, 'canopy'],
      [10.5, 18.8, 'canopy'],
      [13.0, 19.6, 'canopy']
    ]),
    doors: [
      { id: 's5_d1a', col: 3, floor: 10, targetId: 's5_d1b', tunnelStyle: 'stone' },
      { id: 's5_d1b', col: 13, floor: 10, targetId: 's5_d1a', tunnelStyle: 'stone' },
      { id: 's5_sanctum', col: 12, floor: 10, isRune: true, puzzleType: 'lights', puzzleSeed: 55055, puzzleDifficulty: 0.45, sealId: 'seal_2' },
      { id: 's5_crown', col: 15, floor: 19, isExit: true }
    ],
    switches: [
      { id: 's5_pipe1', col: 6, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's5_sw_red', col: 7, floor: 3, group: 'red', mode: 'toggle' },
      { id: 's5_sw_cyan', col: 13, floor: 4, group: 'cyan', mode: 'toggle' },
      { id: 's5_pipe2', col: 18, floor: 5, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Bayou Phase Pressure',
        hint: 'Activate Red & Cyan Lantern Bridges & spin both Copper Pipe-Valves',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Hydro-Mosaic Sanctum',
        hint: 'Cross the +10 Cypress Tunnel, solve the Mosaic Sanctum & climb the Firefly Canopy',
        kind: 'sanctum',
        doorId: 's5_sanctum'
      }
    ]),
    collectibles: [
      { id: 's5_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's5_g2', col: 14, floor: 4, type: 'gear' },
      { id: 's5_g3', col: 9, floor: 11, type: 'gear' },
      { id: 's5_g4', col: 1, floor: 15, type: 'gear' },
      { id: 's5_g5', col: 13, floor: 19, type: 'gear' },
      { id: 's5_log', col: 19, floor: 15, type: 'relic', relicId: 'relic_t5' },
      { id: 's5_seed', col: 18, floor: 20, type: 'starCore' },
      { id: 's5_cr1', col: 17, floor: 5, type: 'critter_pod', critterId: 'critter_s5_1', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's5_cr2', col: 3, floor: 15, type: 'critter_pod', critterId: 'critter_s5_2', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's5_cr3', col: 19, floor: 20, type: 'critter_pod', critterId: 'critter_s5_3', species: 'Bayou Axolotl', biome: 'mist_bayou' }
    ],
    enemies: [
      { type: 'volt_eel', col: 10.0, floor: 4.8, dir: -1, speed: 1.8, amp: 0.32 },
      { type: 'volt_eel', col: 16.0, floor: 5.8, dir: 1, speed: 1.85, amp: 0.32 },
      { type: 'snap_crab', col: 0.5, floor: 15, dir: 1, speed: 1.7 },
      { type: 'barnacle_mortar', col: 4.5, floor: 15, dir: -1, firePeriod: 3.3 },
      { type: 'gulp_hopper', col: 8.5, floor: 18, dir: 1, speed: 1.85 },
      { type: 'volt_eel', col: 13.5, floor: 19.6, dir: -1, speed: 1.9, amp: 0.34 }
    ]
  });

  // SPIRE 6: SUNKEN LOTUS FLOODGATE (23 floors, 2 Seals + Act III Boss:
  // High-tension Rising Bayou Surge with 3 Drain Valves + Snap-Crab Loft + Branching Vertical
  // Geyser Escape Chimney + Lotus Current Flumes + Act III Bayou Siphon Warden!)
  const s6Ledges = [];
  span(s6Ledges, 0, 18, 4, 'solid');
  stairFlight(s6Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F rise -> [4,5] at f=2
  span(s6Ledges, 3, 6, 4, 'solid');                     // [6,7,8,9] at f=3 (Pipe-Valve 1 at 6, Drain 1 at 8, Snap-Crab 7.5)
  span(s6Ledges, 6, 6, 4, 'solid');                     // High Valve Loft [6,7,8,9] at f=6 (open [6,7,9] above Crab 7.5!)
  tile(s6Ledges, 8, 6, 'box', { powerUp: 'turbo_current' }); // Turbo Current Supply Crate!
  // Pipe-powered Lift s6_lift1 at col 10 (f=3..10) -> Mid-Spire Delta Plaza [11..17] at f=10
  span(s6Ledges, 10, 11, 7, 'solid');                   // [11,12,13,14,15,16,17] at f=10 (Optional Sanctum 13 & Vault 15, Drain 2 at 16)
  tile(s6Ledges, 17, 10, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.0 }); // Branching Escape Geyser Chimney straight to f=13!
  // Main Lotus Current Escape Route (converges with Escape Geyser at [17..19] f=13!)
  span(s6Ledges, 11, 18, 5, 'solid');                   // [18,19,0,1,2] at f=11
  span(s6Ledges, 12, 3, 3, 'conveyorR');                // Lotus Current [3,4,5] at f=12
  span(s6Ledges, 13, 7, 3, 'solid');                    // 1-col jump / Grapple gap col 6 -> [7,8,9] at f=13
  tile(s6Ledges, 10, 13, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (9 -> 19 on f=13)!
  span(s6Ledges, 13, 17, 3, 'solid');                   // Converged Upper Escape Deck [17,18,19] at f=13!
  tile(s6Ledges, 18, 13, 'box', { powerUp: 'turbo_current' }); // Clutch Surge-Escape Turbo Crate!
  stairFlight(s6Ledges, 13, 16, 2, -1, 3, 'solid');     // Counter-clockwise 2F rise -> [12,13,14] at f=15 (Drain 3 at 13)
  tile(s6Ledges, 12, 15, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Crate before Boss Lift!
  // Counterweight Lift s6_lift2 at col 11 (f=15..20)
  span(s6Ledges, 20, 12, 8, 'solid');                   // Crown Lotus Boss Arena [12..19] at f=20!
  span(s6Ledges, 21, 0, 2, 'solid');                    // Bonus perch [0,1] at f=21

  const t6 = finalizeTower({
    id: 6,
    act: 3,
    key: 'spire_6',
    name: 'SUNKEN LOTUS FLOODGATE',
    subtitle: 'ACT III BOSS • RISING DELTA SLUICE',
    theme: 'mist_bayou',
    floors: 23,
    timeLimit: 280,
    parTime: 120,
    spawn: { col: 0, floor: 0 },
    mechanics: { waterRiseRate: 0.088 },
    ledges: s6Ledges,
    elevators: [
      { id: 's6_lift1', col: 10, minFloor: 3, maxFloor: 10, startFloor: 3, speed: 2.05, pipeGroup: 'pipeA', powered: false },
      { id: 's6_lift2', col: 11, minFloor: 15, maxFloor: 20, startFloor: 15, speed: 2.1 }
    ],
    grappleRings: [
      { id: 's6_ring1', col: 6.0, floor: 13.5 }
    ],
    hydroRings: makeHydroRings('s6', [
      [17.0, 11.2, 'chimney'],
      [17.5, 12.2, 'chimney'],
      [3.5, 12.6, 'flume'],
      [5.0, 12.6, 'flume'],
      [6.2, 13.4, 'flume'],
      [16.5, 13.8, 'escape'],
      [15.5, 14.8, 'escape'],
      [14.0, 15.6, 'escape']
    ]),
    doors: [
      { id: 's6_t1a', col: 9, floor: 13, targetId: 's6_t1b', tunnelStyle: 'stone' },
      { id: 's6_t1b', col: 19, floor: 13, targetId: 's6_t1a', tunnelStyle: 'stone' },
      { id: 's6_sanctum', col: 13, floor: 10, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 66066, puzzleDifficulty: 0.48 },
      { id: 's6_vault', col: 15, floor: 10, isVault: true },
      { id: 's6_crown', col: 18, floor: 20, isExit: true }
    ],
    switches: [
      { id: 's6_pipe1', col: 6, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's6_drain1', col: 8, floor: 3, group: 'drain', mode: 'drainValve' },
      { id: 's6_pipe2', col: 9, floor: 6, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's6_drain2', col: 16, floor: 10, group: 'drain', mode: 'drainValve' },
      { id: 's6_drain3', col: 13, floor: 15, group: 'drain', mode: 'drainValve' },
      { id: 's6_seal2_sluice', col: 13, floor: 20, group: 'seal_2', mode: 'sluiceSeal', sealId: 'seal_2', requiresLockKeeper: true }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Delta Pipe Pressure',
        hint: 'Vent the rising surge, Crab-bounce to Valve 2 & pressurize the Delta Lift',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Bayou Warden Seal',
        hint: 'Outrun the tide via Geyser Chimney or Tunnel, defeat Bayou Siphon Warden & pull Sluice',
        kind: 'upper_sluice',
        switchId: 's6_seal2_sluice'
      }
    ]),
    collectibles: [
      { id: 's6_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's6_g2', col: 12, floor: 10, type: 'gear' },
      { id: 's6_g3', col: 1, floor: 11, type: 'gear' },
      { id: 's6_g4', col: 17, floor: 13, type: 'gear' },
      { id: 's6_g5', col: 15, floor: 20, type: 'gear' },
      { id: 's6_log', col: 14, floor: 10, type: 'relic', relicId: 'relic_t6' },
      { id: 's6_seed', col: 0, floor: 21, type: 'starCore' },
      { id: 's6_cr1', col: 9, floor: 3, type: 'critter_pod', critterId: 'critter_s6_1', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's6_cr2', col: 14, floor: 15, type: 'critter_pod', critterId: 'critter_s6_2', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's6_cr3', col: 1, floor: 21, type: 'critter_pod', critterId: 'critter_s6_3', species: 'Bayou Axolotl', biome: 'mist_bayou' }
    ],
    enemies: [
      { type: 'snap_crab', col: 7.5, floor: 3, dir: 1, speed: 1.6 },
      { type: 'barnacle_mortar', col: 14.5, floor: 10, dir: -1, firePeriod: 3.1 },
      { type: 'volt_eel', col: 4.5, floor: 12.4, dir: 1, speed: 1.9, amp: 0.35 },
      { type: 'gulp_hopper', col: 14.0, floor: 15, dir: -1, speed: 1.85 },
      { type: 'siphon_warden', col: 15.5, floor: 20.3, dir: -1, speed: 2.15, hp: 3, maxHp: 3, act: 3, isLockKeeper: true, bossTitle: 'BAYOU SIPHON WARDEN', sealId: 'seal_2' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT IV — SUNLIT CORAL SEAS ('coral_sea', Spires 7 & 8)
  // --------------------------------------------------------------------------

  // SPIRE 7: MOTHER-OF-PEARL ATOLL SPIRE (22 floors, 2 Seals, NO Boss — Vertical Lagoon
  // Geyser Slingshot Chains + Timed Coral Pistons + Sluice Blocks Sanctum!)
  const s7Ledges = [];
  span(s7Ledges, 0, 18, 4, 'solid');
  stairFlight(s7Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F rise -> [4,5] at f=2
  // Stacked Vertical Lagoon Geyser Slingshot Chain (f=3 -> f=6 -> f=9!)
  span(s7Ledges, 3, 6, 3, 'solid');                     // [6,7,8] at f=3 (Pipe-Valve 1 at 6, Geyser 1 at 8)
  tile(s7Ledges, 8, 3, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.0 });
  span(s7Ledges, 6, 9, 4, 'solid');                     // [9,10,11,12] at f=6 (Snap-Crab 10, Geyser 2 at 12)
  tile(s7Ledges, 12, 6, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.45 });
  span(s7Ledges, 9, 13, 4, 'solid');                    // [13,14,15,16] at f=9 (Hydro-Magnet Crate 14, Pipe-Valve 2 at 15)
  tile(s7Ledges, 14, 9, 'box', { powerUp: 'hydro_magnet' });
  span(s7Ledges, 9, 17, 2, 'piston', { phasePeriod: 3.2, phaseOffset: 0.0 }); // Timed Coral Pistons [17,18] at f=9!
  span(s7Ledges, 9, 19, 3, 'solid');                    // [19,0,1] at f=9 -> Pipe-Powered Lift 1 at col 2!
  // Pipe-powered Lift s7_lift1 at col 2 (f=9..13) -> Mid-Spire Atoll Plaza [3..8] at f=13
  span(s7Ledges, 13, 3, 6, 'solid');                    // [3,4,5,6,7,8] at f=13 (Blocks Sanctum 5, Optional Vault 7)
  tile(s7Ledges, 8, 13, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s7Ledges, 14, 9, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  span(s7Ledges, 14, 11, 2, 'piston', { phasePeriod: 3.1, phaseOffset: 0.35 }); // Upper Coral Pistons [11,12] at f=14!
  span(s7Ledges, 15, 13, 3, 'solid');                   // [13,14,15] at f=15
  tile(s7Ledges, 14, 15, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Supply Crate guarding Tunnel!
  tile(s7Ledges, 16, 15, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (15 -> 5 on f=15)!
  span(s7Ledges, 15, 4, 5, 'solid');                    // Opposite side [4,5,6,7,8] at f=15 (+2F above f=13 -> ZERO bypass!)
  tile(s7Ledges, 7, 15, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.2 }); // Lagoon Geyser #3 parallel slingshot to f=18!
  // Sea-Glass Gecko Strip at col 3 (f=15..18) + Geyser #3 -> Upper Deck [4,5,6] at f=18!
  span(s7Ledges, 18, 4, 3, 'solid');                    // [4,5,6] at f=18
  stairFlight(s7Ledges, 18, 7, 2, 1, 7, 'solid');       // 2F rise -> Crown Atoll Terrace [9..15] at f=20 (NO boss!)
  span(s7Ledges, 21, 16, 2, 'solid');                   // Bonus perch [16,17] at f=21

  const t7 = finalizeTower({
    id: 7,
    act: 4,
    key: 'spire_7',
    name: 'MOTHER-OF-PEARL ATOLL SPIRE',
    subtitle: 'ACT IV • SUNLIT CORAL SEAS',
    theme: 'coral_sea',
    floors: 22,
    timeLimit: 270,
    parTime: 115,
    spawn: { col: 0, floor: 0 },
    ledges: s7Ledges,
    elevators: [
      { id: 's7_lift1', col: 2, minFloor: 9, maxFloor: 13, startFloor: 9, speed: 2.05, pipeGroup: 'pipeA', powered: false }
    ],
    wallStrips: [
      { id: 's7_gecko1', col: 3, minFloor: 15, maxFloor: 18 }
    ],
    grappleRings: [
      { id: 's7_ring1', col: 17.5, floor: 10.4 }
    ],
    hydroRings: makeHydroRings('s7', [
      [8.2, 4.2, 'geyser1'],
      [8.6, 5.2, 'geyser1'],
      [12.2, 7.2, 'geyser2'],
      [12.6, 8.2, 'geyser2'],
      [17.5, 9.7, 'piston'],
      [11.5, 14.7, 'piston'],
      [7.0, 16.2, 'geyser3'],
      [6.5, 17.2, 'geyser3'],
      [7.5, 18.8, 'summit']
    ]),
    doors: [
      { id: 's7_t1a', col: 15, floor: 15, targetId: 's7_t1b', tunnelStyle: 'stone' },
      { id: 's7_t1b', col: 5, floor: 15, targetId: 's7_t1a', tunnelStyle: 'stone' },
      { id: 's7_sanctum', col: 5, floor: 13, isRune: true, puzzleType: 'blocks', puzzleSeed: 77077, puzzleDifficulty: 0.48, sealId: 'seal_2' },
      { id: 's7_vault', col: 7, floor: 13, isVault: true },
      { id: 's7_crown', col: 14, floor: 20, isExit: true }
    ],
    switches: [
      { id: 's7_pipe1', col: 6, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's7_pipe2', col: 15, floor: 9, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Atoll Geyser Pressure',
        hint: 'Ride the Stacked Lagoon Geysers & spin both Atoll Pipe-Valves',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Sluice Basins Sanctum',
        hint: 'Slide the Sluice Stones inside the Atoll Sanctum & ride Pistons to the Crown',
        kind: 'sanctum',
        doorId: 's7_sanctum'
      }
    ]),
    collectibles: [
      { id: 's7_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's7_g2', col: 10, floor: 6, type: 'gear' },
      { id: 's7_g3', col: 16, floor: 9, type: 'gear' },
      { id: 's7_g4', col: 6, floor: 15, type: 'gear' },
      { id: 's7_g5', col: 11, floor: 20, type: 'gear' },
      { id: 's7_log', col: 4, floor: 13, type: 'relic', relicId: 'relic_t7' },
      { id: 's7_seed', col: 16, floor: 21, type: 'starCore' },
      { id: 's7_cr1', col: 11, floor: 6, type: 'critter_pod', critterId: 'critter_s7_1', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's7_cr2', col: 6, floor: 13, type: 'critter_pod', critterId: 'critter_s7_2', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's7_cr3', col: 17, floor: 21, type: 'critter_pod', critterId: 'critter_s7_3', species: 'Sea Turtle', biome: 'coral_sea' }
    ],
    enemies: [
      { type: 'snap_crab', col: 10.0, floor: 6, dir: -1, speed: 1.75 },
      { type: 'rail_skater', col: 0.0, floor: 9, dir: 1, speed: 1.9, axis: 'h' },
      { type: 'gulp_hopper', col: 6.5, floor: 15, dir: 1, speed: 1.9 },
      { type: 'barnacle_mortar', col: 5.5, floor: 18, dir: -1, firePeriod: 3.0 },
      { type: 'barnacle_mortar', col: 11.5, floor: 20, dir: -1, firePeriod: 3.1 }
    ]
  });

  // SPIRE 8: PELAGIC REEF CONDUIT (24 floors, 3 Seals + Act IV Boss:
  // Coral Pistons + Reversible Aqua-Flume Speed Gauntlets + Dual-Path Tunnels (stone + sparkArch) +
  // Mandatory Rotary Pipes Sanctum + Act IV Coral Siphon Warden!)
  const s8Ledges = [];
  span(s8Ledges, 0, 18, 4, 'solid');
  stairFlight(s8Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F rise -> [4,5] at f=2
  span(s8Ledges, 3, 6, 3, 'solid');                     // [6,7,8] at f=3 (Pipe-Valve 1 at 7, Turbo Crate at 8)
  tile(s8Ledges, 8, 3, 'box', { powerUp: 'turbo_current' });
  span(s8Ledges, 4, 9, 2, 'piston', { phasePeriod: 3.2, phaseOffset: 0.0 });
  span(s8Ledges, 5, 11, 4, 'solid');                    // [11,12,13,14] at f=5 (Pipe-Valve 2 at 13)
  // Pipe-powered Lift s8_lift1 at col 15 (f=5..11) -> Mid-Spire Reef Deck [16..19] at f=11
  span(s8Ledges, 11, 16, 4, 'solid');                   // [16,17,18,19] (Flume Flip Switch at 18)
  tile(s8Ledges, 0, 11, 'pillar', { h: 3 });            // Bulkhead forces +10 Stone Tunnel #1 (19 -> 9 on f=11)!
  span(s8Ledges, 11, 8, 5, 'solid');                    // Opposite Sanctum Courtyard [8,9,10,11,12] at f=11!
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s8_lift_mid at col 14 (f=12..15)!
  tile(s8Ledges, 12, 11, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s8Ledges, 12, 13, 1, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Reversible Aqua-Flume Speed Gauntlet + Dual-Path Upper Spark-Arch Tunnel (f=15..19)!
  stairFlight(s8Ledges, 15, 19, 2, 1, 5, 'solid');      // Base 18,15 -> stairs -> [1,2,3,4,5] at f=17 (Vault 2, SparkArch 3, Crate 4)
  span(s8Ledges, 15, 15, 3, 'conveyorL');               // Long 3-col Reversible Flume [15,16,17] at f=15 (clear of stair base 18!)
  tile(s8Ledges, 4, 17, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Supply Crate!
  span(s8Ledges, 18, 7, 2, 'piston', { phasePeriod: 3.0, phaseOffset: 0.8 }); // Grapple/Jump over col 6 -> Pistons [7,8] at f=18
  span(s8Ledges, 19, 9, 2, 'solid');                    // Converged Deck [9,10] at f=19 (SparkArch #2 exit at 10!)
  // Counterweight Lift s8_lift2 at col 11 (f=19..22)
  span(s8Ledges, 22, 12, 8, 'solid');                   // Crown Reef Boss Arena [12..19] at f=22!
  span(s8Ledges, 23, 0, 2, 'solid');                    // Bonus perch [0,1] at f=23

  const t8 = finalizeTower({
    id: 8,
    act: 4,
    key: 'spire_8',
    name: 'PELAGIC REEF CONDUIT',
    subtitle: 'ACT IV BOSS • OFFSHORE CORAL SIPHON',
    theme: 'coral_sea',
    floors: 24,
    timeLimit: 310,
    parTime: 135,
    spawn: { col: 0, floor: 0 },
    ledges: s8Ledges,
    elevators: [
      { id: 's8_lift1', col: 15, minFloor: 5, maxFloor: 11, startFloor: 5, speed: 2.0, pipeGroup: 'pipeA', powered: false },
      { id: 's8_lift_mid', col: 14, minFloor: 12, maxFloor: 15, startFloor: 12, speed: 2.0, pipeGroup: 'seal_2', powered: false },
      { id: 's8_lift2', col: 11, minFloor: 19, maxFloor: 22, startFloor: 19, speed: 2.05 }
    ],
    grappleRings: [
      { id: 's8_ring1', col: 6.0, floor: 18.6 }
    ],
    hydroRings: makeHydroRings('s8', [
      [9.5, 4.6, 'lower'],
      [10.5, 4.8, 'lower'],
      [15.5, 15.6, 'flume'],
      [16.8, 15.6, 'flume'],
      [19.5, 15.8, 'flume'],
      [0.5, 16.8, 'flume'],
      [6.0, 18.4, 'upper'],
      [7.5, 18.6, 'upper']
    ]),
    doors: [
      { id: 's8_t1a', col: 19, floor: 11, targetId: 's8_t1b', tunnelStyle: 'stone' },
      { id: 's8_t1b', col: 9, floor: 11, targetId: 's8_t1a', tunnelStyle: 'stone' },
      { id: 's8_t2a', col: 3, floor: 17, targetId: 's8_t2b', tunnelStyle: 'sparkArch' },
      { id: 's8_t2b', col: 10, floor: 19, targetId: 's8_t2a', tunnelStyle: 'sparkArch' },
      { id: 's8_sanctum', col: 10, floor: 11, isRune: true, puzzleType: 'pipes', puzzleSeed: 88088, puzzleDifficulty: 0.55, sealId: 'seal_2' },
      { id: 's8_vault', col: 2, floor: 17, isVault: true },
      { id: 's8_crown', col: 18, floor: 22, isExit: true }
    ],
    switches: [
      { id: 's8_pipe1', col: 7, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's8_pipe2', col: 13, floor: 5, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's8_conv1', col: 18, floor: 11, group: 'conv', mode: 'conveyorFlip' },
      { id: 's8_seal3_sluice', col: 13, floor: 22, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Reef Conduit Pressure',
        hint: 'Cross Coral Pistons & spin both Copper Pipe-Valves to power Reef Lift',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Coral Conduit Sanctum',
        hint: 'Flip the Flume Switch, tunnel across & solve the Mid-Spire Rotary Pipe Sanctum',
        kind: 'sanctum',
        doorId: 's8_sanctum'
      },
      {
        id: 'seal_3',
        label: 'Coral Warden Seal',
        hint: 'Defeat the Act IV Coral Siphon Warden & pull the Upper Sluice Lever',
        kind: 'upper_sluice',
        switchId: 's8_seal3_sluice'
      }
    ]),
    collectibles: [
      { id: 's8_g1', col: 6, floor: 3, type: 'gear' },
      { id: 's8_g2', col: 12, floor: 5, type: 'gear' },
      { id: 's8_g3', col: 17, floor: 11, type: 'gear' },
      { id: 's8_g4', col: 5, floor: 17, type: 'gear' },
      { id: 's8_g5', col: 15, floor: 22, type: 'gear' },
      { id: 's8_log', col: 1, floor: 17, type: 'relic', relicId: 'relic_t8' },
      { id: 's8_seed', col: 0, floor: 23, type: 'starCore' },
      { id: 's8_cr1', col: 14, floor: 5, type: 'critter_pod', critterId: 'critter_s8_1', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's8_cr2', col: 9, floor: 19, type: 'critter_pod', critterId: 'critter_s8_2', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's8_cr3', col: 1, floor: 23, type: 'critter_pod', critterId: 'critter_s8_3', species: 'Sea Turtle', biome: 'coral_sea' }
    ],
    enemies: [
      { type: 'rail_skater', col: 12.5, floor: 5, dir: 1, speed: 1.9, axis: 'h' },
      { type: 'snap_crab', col: 17.0, floor: 11, dir: -1, speed: 1.85 },
      { type: 'vent_stalker', col: 1.5, floor: 18.2, dir: 1, speed: 2.0, axis: 'v', minFloor: 17.0, maxFloor: 19.4 },
      { type: 'barnacle_mortar', col: 9.5, floor: 19, dir: -1, firePeriod: 3.0 },
      { type: 'siphon_warden', col: 15.5, floor: 22.3, dir: 1, speed: 2.2, hp: 3, maxHp: 3, act: 4, isLockKeeper: true, bossTitle: 'CORAL SIPHON WARDEN', sealId: 'seal_3' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT V — POLAR & TEMPEST OCEANS ('storm_ocean', Spires 9 & 10)
  // --------------------------------------------------------------------------

  // SPIRE 9: AURORA ICEBERG BASTION (24 floors, 3 Seals + Polar Lock-Keeper:
  // Tempest Lightning Cadence + Multi-Tier Dual Glacier Gecko Scamper + Gale Chasms + Prism Sanctum!)
  const s9Ledges = [];
  span(s9Ledges, 0, 18, 4, 'solid');
  stairFlight(s9Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F rise -> [4,5] at f=2
  span(s9Ledges, 3, 7, 2, 'crumble');                   // Gale running jump col 6 -> crumble [7,8] at f=3
  span(s9Ledges, 4, 9, 3, 'solid');                     // [9,10,11] at f=4 (Pipe-Valve 1 at 10, ice at 9)
  tile(s9Ledges, 9, 4, 'ice');
  // Glacier Gecko Wall-Scamper Tier #1 at col 12 (f=4..8) -> [13,14,15,16] at f=8
  span(s9Ledges, 8, 13, 4, 'solid');
  tile(s9Ledges, 14, 8, 'box', { powerUp: 'bubble_shield' }); // Bubble Shield Crate (storm lightning buffer!)
  // Pipe-powered Lift s9_lift1 at col 17 (f=8..13) -> Mid-Spire Aurora Plaza [18..1] at f=13
  span(s9Ledges, 13, 18, 4, 'solid');                   // [18,19,0,1] at f=13 (Prism Sanctum at 19)
  tile(s9Ledges, 1, 13, 'pillar', { h: 3 });            // Bulkhead forces +10 Cross-Tower Tunnel (0 -> 10 on f=13)!
  span(s9Ledges, 13, 8, 4, 'solid');                    // Opposite side [8,9,10,11] at f=13 (4-col void to Lift 1!)
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s9_lift2 at col 13 (f=14..18)!
  tile(s9Ledges, 11, 13, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s9Ledges, 14, 12, 1, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Gale Chasm + Glacier Gecko Wall-Scamper Tier #2 (col 0, f=18..22)!
  span(s9Ledges, 18, 14, 2, 'solid');                   // [14,15] at f=18 -> Grapple Ring / jump across col 16!
  span(s9Ledges, 18, 17, 3, 'solid');                   // [17,18,19] at f=18 (ice at 18, Turbo Crate at 17!)
  tile(s9Ledges, 18, 18, 'ice');
  tile(s9Ledges, 17, 18, 'box', { powerUp: 'turbo_current' });
  // Glacier Gecko Tier #2 at col 0 (f=18..22) -> Crown Aurora Arena [1..7] at f=22!
  span(s9Ledges, 22, 1, 7, 'solid');                    // [1,2,3,4,5,6,7] at f=22
  span(s9Ledges, 23, 8, 2, 'solid');                    // Bonus perch [8,9] at f=23

  const t9 = finalizeTower({
    id: 9,
    act: 5,
    key: 'spire_9',
    name: 'AURORA ICEBERG BASTION',
    subtitle: 'ACT V • POLAR & TEMPEST OCEANS',
    theme: 'storm_ocean',
    floors: 24,
    timeLimit: 315,
    parTime: 138,
    spawn: { col: 0, floor: 0 },
    mechanics: { windForce: 0.36, windPeriod: 6.4, lightningInterval: 7.4 },
    ledges: s9Ledges,
    elevators: [
      { id: 's9_lift1', col: 17, minFloor: 8, maxFloor: 13, startFloor: 8, speed: 2.05, pipeGroup: 'pipeA', powered: false },
      { id: 's9_lift2', col: 13, minFloor: 14, maxFloor: 18, startFloor: 14, speed: 2.1, pipeGroup: 'seal_2', powered: false }
    ],
    wallStrips: [
      { id: 's9_gecko1', col: 12, minFloor: 4, maxFloor: 8 },
      { id: 's9_gecko2', col: 0, minFloor: 18, maxFloor: 22 }
    ],
    grappleRings: [
      { id: 's9_ring1', col: 16.0, floor: 19.2 }
    ],
    hydroRings: makeHydroRings('s9', [
      [6.0, 3.2, 'gale'],
      [7.5, 3.6, 'gale'],
      [12.5, 6.2, 'gecko1'],
      [13.5, 8.6, 'gecko1'],
      [16.0, 19.0, 'upper'],
      [18.0, 18.6, 'upper'],
      [0.0, 19.5, 'gecko2'],
      [0.0, 21.0, 'gecko2'],
      [1.5, 22.6, 'gecko2']
    ]),
    doors: [
      { id: 's9_t1a', col: 0, floor: 13, targetId: 's9_t1b', tunnelStyle: 'stone' },
      { id: 's9_t1b', col: 10, floor: 13, targetId: 's9_t1a', tunnelStyle: 'stone' },
      { id: 's9_sanctum', col: 19, floor: 13, isRune: true, puzzleType: 'beam', puzzleSeed: 99099, puzzleDifficulty: 0.62, sealId: 'seal_2' },
      { id: 's9_crown', col: 6, floor: 22, isExit: true }
    ],
    switches: [
      { id: 's9_pipe1', col: 10, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's9_pipe2', col: 15, floor: 8, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's9_seal3_sluice', col: 2, floor: 22, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Aurora Pipe Pressure',
        hint: 'Leap storm ice, scamper Glacier Cliff 1 & spin both Aurora Pipe-Valves',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Aurora Prism Sanctum',
        hint: 'Solve Mid-Spire Prism Sanctum & tunnel across to ride the Polar Lift',
        kind: 'sanctum',
        doorId: 's9_sanctum'
      },
      {
        id: 'seal_3',
        label: 'Polar Lock-Keeper',
        hint: 'Scamper Glacier Cliff 2, defeat the Polar Lock-Keeper & pull the Upper Sluice',
        kind: 'upper_sluice',
        switchId: 's9_seal3_sluice'
      }
    ]),
    collectibles: [
      { id: 's9_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's9_g2', col: 13, floor: 8, type: 'gear' },
      { id: 's9_g3', col: 9, floor: 13, type: 'gear' },
      { id: 's9_g4', col: 19, floor: 18, type: 'gear' },
      { id: 's9_g5', col: 4, floor: 22, type: 'gear' },
      { id: 's9_log', col: 18, floor: 13, type: 'relic', relicId: 'relic_t9' },
      { id: 's9_seed', col: 8, floor: 23, type: 'starCore' },
      { id: 's9_cr1', col: 16, floor: 8, type: 'critter_pod', critterId: 'critter_s9_1', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's9_cr2', col: 18, floor: 18, type: 'critter_pod', critterId: 'critter_s9_2', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's9_cr3', col: 9, floor: 23, type: 'critter_pod', critterId: 'critter_s9_3', species: 'Polar Puffin', biome: 'storm_ocean' }
    ],
    enemies: [
      { type: 'snap_crab', col: 15.5, floor: 8, dir: 1, speed: 1.9 },
      { type: 'volt_eel', col: 18.5, floor: 13.5, dir: -1, speed: 2.0, amp: 0.36 },
      { type: 'vent_stalker', col: 15.0, floor: 19.2, dir: 1, speed: 2.05, axis: 'v', minFloor: 18.0, maxFloor: 20.6 },
      { type: 'barnacle_mortar', col: 19.0, floor: 18, dir: -1, firePeriod: 2.95 },
      { type: 'siphon_warden', col: 4.5, floor: 22.4, dir: -1, speed: 2.15, hp: 3, maxHp: 3, act: 5, isLockKeeper: true, bossTitle: 'POLAR LOCK-KEEPER', sealId: 'seal_3' }
    ]
  });

  // SPIRE 10: THE MOTHER SIPHON CITADEL (27 floors, 3 Grand Seals + 4-HP Mother Siphon Prime:
  // Epic 4-Act Vertical Gauntlet weaving EVERY mastered mechanic: Opening Hydro-Ring Launchway,
  // Snap-Crab High Valve Loft, Rising Surge + 3 Drain Valves, Grand Tide-Locks Sanctum, Core Vault,
  // +10 Tunnel, Ice-Slide -> Grapple -> Coral Pistons, Glacier Gecko Scamper, Thermal Geyser Chimney,
  // ALL 3 Supply Crate Power-Ups, 12 Hydro-Rings & Mother Siphon Prime Finale!)
  const s10Ledges = [];
  span(s10Ledges, 0, 18, 4, 'solid');
  stairFlight(s10Ledges, 0, 2, 2, 1, 2, 'solid');        // Act 1 Launchway -> [4,5] at f=2
  span(s10Ledges, 3, 7, 1, 'crumble');                  // Gale jump over col 6 -> crumble [7] at f=3
  span(s10Ledges, 4, 8, 6, 'solid');                    // [8,9,10,11,12,13] at f=4 (Valve 1 at 8, Drain 1 at 10, Crab 11.5)
  span(s10Ledges, 7, 10, 4, 'solid');                   // High Valve Loft [10,11,12,13] at f=7 (open [10,11,13] above Crab 11.5!)
  tile(s10Ledges, 12, 7, 'box', { powerUp: 'turbo_current' }); // Supply Crate #1: Turbo Current!
  // Pipe-powered Lift s10_lift1 at col 14 (f=4..10) -> Act 2 Citadel Plaza [15..0] at f=10
  span(s10Ledges, 10, 15, 6, 'solid');                  // [15,16,17,18,19,0] at f=10 (Grand Tide-Locks 18, Drain 2 at 19)
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s10_lift_mid at col 3 (f=11..14)!
  tile(s10Ledges, 0, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s10Ledges, 11, 1, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Act 3 Multi-Biome Gauntlet (f=14..21): Core Vault + Tunnel + Ice-Slide -> Grapple -> Pistons -> Gecko -> Stairs -> Geyser!
  span(s10Ledges, 14, 4, 4, 'solid');                   // [4,5,6,7] at f=14 (Core Vault 5, Bubble Shield Crate 6, Tunnel 7)
  tile(s10Ledges, 6, 14, 'box', { powerUp: 'bubble_shield' }); // Supply Crate #2: Bubble Shield!
  tile(s10Ledges, 8, 14, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (7 -> 17 on f=14)!
  span(s10Ledges, 14, 16, 4, 'solid');                  // Opposite Ice-Slide Runway [16,17,18,19] at f=14 (+4F above f=10!)
  span(s10Ledges, 14, 18, 2, 'ice');                    // Ice launch pad [18,19] -> Grapple Ring over col 0!
  span(s10Ledges, 15, 1, 2, 'piston', { phasePeriod: 3.0, phaseOffset: 0.2 }); // Coral Pistons [1,2] at f=15!
  span(s10Ledges, 16, 3, 3, 'solid');                   // [3,4,5] at f=16 -> Glacier Gecko Strip col 6 (f=16..19)!
  span(s10Ledges, 19, 7, 4, 'solid');                   // [7,8,9,10] at f=19
  stairFlight(s10Ledges, 19, 11, 2, 1, 5, 'solid');     // 2F rise -> [13,14,15,16,17] at f=21 (Drain 3 at 14, Crate 16, Geyser 17)
  tile(s10Ledges, 16, 21, 'box', { powerUp: 'hydro_magnet' }); // Supply Crate #3: Hydro-Magnet!
  tile(s10Ledges, 17, 21, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.3 }); // Thermal Geyser Chimney beside Crown Lift!
  // Counterweight Lift s10_lift2 at col 18 (f=21..25)
  span(s10Ledges, 25, 19, 9, 'solid');                  // Act 4 Grand Nexus Crown Arena [19,0,1,2,3,4,5,6,7] at f=25!
  span(s10Ledges, 26, 8, 2, 'solid');                   // Bonus perch [8,9] at f=26

  const t10 = finalizeTower({
    id: 10,
    act: 5,
    key: 'spire_10',
    name: 'THE MOTHER SIPHON CITADEL',
    subtitle: 'GRAND FINALE • PLANETARY HYDRO-NEXUS',
    theme: 'storm_ocean',
    floors: 27,
    timeLimit: 350,
    parTime: 155,
    spawn: { col: 0, floor: 0 },
    mechanics: {
      waterRiseRate: 0.075,
      windForce: 0.36,
      windPeriod: 6.2,
      lightningInterval: 7.5
    },
    ledges: s10Ledges,
    elevators: [
      { id: 's10_lift1', col: 14, minFloor: 4, maxFloor: 10, startFloor: 4, speed: 2.1, pipeGroup: 'pipeA', powered: false },
      { id: 's10_lift_mid', col: 3, minFloor: 11, maxFloor: 14, startFloor: 11, speed: 2.1, pipeGroup: 'seal_2', powered: false },
      { id: 's10_lift2', col: 18, minFloor: 21, maxFloor: 25, startFloor: 21, speed: 2.2 }
    ],
    wallStrips: [
      { id: 's10_gecko1', col: 6, minFloor: 16, maxFloor: 19 }
    ],
    grappleRings: [
      { id: 's10_ring1', col: 0.0, floor: 15.6 }
    ],
    hydroRings: makeHydroRings('s10', [
      [2.5, 0.8, 'act1'],
      [3.5, 1.8, 'act1'],
      [6.0, 3.2, 'act1'],
      [18.5, 14.6, 'act3'],
      [0.0, 15.5, 'act3'],
      [1.5, 15.6, 'act3'],
      [6.0, 17.5, 'act3'],
      [8.5, 19.6, 'act3'],
      [11.5, 19.8, 'act3'],
      [12.5, 20.8, 'act3'],
      [17.0, 22.5, 'chimney'],
      [17.5, 24.0, 'chimney']
    ]),
    doors: [
      { id: 's10_t1a', col: 7, floor: 14, targetId: 's10_t1b', tunnelStyle: 'stone' },
      { id: 's10_t1b', col: 17, floor: 14, targetId: 's10_t1a', tunnelStyle: 'stone' },
      { id: 's10_sanctum', col: 18, floor: 10, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 101010, puzzleDifficulty: 0.72, sealId: 'seal_2' },
      { id: 's10_vault', col: 5, floor: 14, isVault: true },
      { id: 's10_crown', col: 6, floor: 25, isExit: true }
    ],
    switches: [
      { id: 's10_pipe1', col: 8, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's10_drain1', col: 10, floor: 4, group: 'drain', mode: 'drainValve' },
      { id: 's10_pipe2', col: 13, floor: 7, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's10_drain2', col: 19, floor: 10, group: 'drain', mode: 'drainValve' },
      { id: 's10_drain3', col: 14, floor: 21, group: 'drain', mode: 'drainValve' },
      { id: 's10_seal3_sluice', col: 0, floor: 25, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeSeals([
      {
        id: 'seal_1',
        label: 'Citadel Pipe Pressure',
        hint: 'Crab-bounce onto High Balcony Valve 2 & spin both Citadel Pipe-Valves',
        kind: 'pipe_valves',
        pipeGroup: 'pipeA'
      },
      {
        id: 'seal_2',
        label: 'Grand Tide-Lock Sanctum',
        hint: 'Solve the Mid-Spire Grand Tide-Locks & conquer the Multi-Biome Citadel Gauntlet',
        kind: 'sanctum',
        doorId: 's10_sanctum'
      },
      {
        id: 'seal_3',
        label: 'Mother Siphon Prime',
        hint: 'Defeat Mother Siphon Prime & pull the Grand Nexus Sluice Lever',
        kind: 'upper_sluice',
        switchId: 's10_seal3_sluice'
      }
    ]),
    collectibles: [
      { id: 's10_g1', col: 12, floor: 4, type: 'gear' },
      { id: 's10_g2', col: 16, floor: 10, type: 'gear' },
      { id: 's10_g3', col: 4, floor: 14, type: 'gear' },
      { id: 's10_g4', col: 8, floor: 19, type: 'gear' },
      { id: 's10_g5', col: 15, floor: 21, type: 'gear' },
      { id: 's10_g6', col: 2, floor: 25, type: 'gear' },
      { id: 's10_log', col: 4, floor: 25, type: 'relic', relicId: 'relic_t10' },
      { id: 's10_seed', col: 8, floor: 26, type: 'starCore' },
      { id: 's10_cr1', col: 9, floor: 4, type: 'critter_pod', critterId: 'critter_s10_1', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's10_cr2', col: 9, floor: 19, type: 'critter_pod', critterId: 'critter_s10_2', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's10_cr3', col: 9, floor: 26, type: 'critter_pod', critterId: 'critter_s10_3', species: 'Polar Puffin', biome: 'storm_ocean' }
    ],
    enemies: [
      { type: 'snap_crab', col: 11.5, floor: 4, dir: 1, speed: 1.85 },
      { type: 'gulp_hopper', col: 16.5, floor: 10, dir: -1, speed: 1.95 },
      { type: 'volt_eel', col: 8.5, floor: 19.6, dir: 1, speed: 2.1, amp: 0.36 },
      { type: 'barnacle_mortar', col: 13.5, floor: 21, dir: -1, firePeriod: 2.85 },
      { type: 'vent_stalker', col: 4.5, floor: 17.2, dir: 1, speed: 2.15, axis: 'v', minFloor: 16.0, maxFloor: 18.6 },
      { type: 'siphon_warden', col: 3.5, floor: 25.3, dir: -1, speed: 2.3, hp: 4, maxHp: 4, act: 5, isLockKeeper: true, bossTitle: 'MOTHER SIPHON PRIME', sealId: 'seal_3' }
    ]
  });

  return [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10];
}

export const createRebootTowers = createCampaignTowers;

/**
 * Dispatcher returning the 10 handcrafted Watershed Campaign Spires (or mode-specific list).
 */
export function createTowers(mode = 'campaign') {
  if (mode === 'sanctum_trials') {
    return createSanctumTowers();
  }
  if (mode === 'warden_gauntlet') {
    return createWardenGauntletTowers();
  }
  return createCampaignTowers();
}

// ============================================================================
// STATE-SPACE BFS SOLVABILITY VERIFIER (COLS = 20, STAIRS, VALVES, WALL-STRIPS, GRAPPLES)
// ============================================================================

const GROUP_BITS = {
  red: 1,
  cyan: 2,
  conv: 4,
  pipeA: 8,
  pipeB: 16,
  seal_1: 32,
  seal_2: 64,
  seal_3: 128
};

function isSwitchGroupOn(mask, group) {
  const bit = GROUP_BITS[group] || 0;
  return bit ? Boolean(mask & bit) : false;
}

function isLedgeSupportActive(ledge, mask) {
  if (!ledge || ledge.type === 'box' || ledge.type === 'pillar' || ledge.type === 'laserGate') return false;
  if (ledge.type === 'phaseBlock' && ledge.switchGroup) {
    const groupOn = isSwitchGroupOn(mask, ledge.switchGroup);
    return ledge.inverted ? !groupOn : groupOn;
  }
  return true;
}

function runTowerReachabilityBfs(tower, opts = {}) {
  const enforceSeals = opts.enforceSeals !== false;
  const allowSanctumSolve = opts.allowSanctumSolve !== false;
  const collectAll = Boolean(opts.collectAll);
  const reachableCoords = new Set();

  if (!tower || !Array.isArray(tower.ledges) || !Array.isArray(tower.doors)) {
    return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: 0, reachableCoords };
  }

  const exitDoors = tower.doors.filter((d) => d.isExit);
  if (exitDoors.length === 0 && !collectAll) {
    return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: 0, reachableCoords };
  }

  const crownSeals = Array.isArray(tower.crownSeals) ? tower.crownSeals : [];
  let requiredSealMask = 0;
  if (enforceSeals && crownSeals.length > 0) {
    for (const cs of crownSeals) {
      const bit = GROUP_BITS[cs.id] || 0;
      if (bit) requiredSealMask |= bit;
    }
  }

  const laserByCol = Array.from({ length: COLS }, () => []);
  const pillarByCol = Array.from({ length: COLS }, () => []);
  let relevantGroupMask = requiredSealMask;

  for (const l of tower.ledges) {
    if (l.switchGroup && GROUP_BITS[l.switchGroup]) {
      relevantGroupMask |= GROUP_BITS[l.switchGroup];
    }
    if (l.type === 'laserGate') {
      laserByCol[wrapCol(l.col)].push(l);
    } else if (l.type === 'pillar') {
      pillarByCol[wrapCol(l.col)].push(l);
    }
  }

  const isLaserColBlocking = (c, minF, maxF, mask) => {
    const arr = laserByCol[c];
    for (let i = 0; i < arr.length; i++) {
      const lg = arr[i];
      const active = lg.switchGroup
        ? lg.inverted
          ? isSwitchGroupOn(mask, lg.switchGroup)
          : !isSwitchGroupOn(mask, lg.switchGroup)
        : true;
      if (!active) continue;
      const lgTop = lg.floor + Math.max(0.8, Number(lg.h || 1) - 0.1);
      if (lgTop >= minF - 0.5 && lg.floor <= maxF + 0.8) return true;
    }
    return false;
  };

  const isPillarColBlocking = (c, minF, maxF) => {
    const arr = pillarByCol[c];
    for (let i = 0; i < arr.length; i++) {
      const pl = arr[i];
      const top = pl.floor + Math.max(1, Number(pl.h || 1)) - 0.1;
      if (top >= minF + 0.1 && pl.floor <= maxF + 0.5) return true;
    }
    return false;
  };

  const coordInt = (c, f) => c * 128 + (f + 16);
  const supportNodes = [];
  const nodeIndicesByCoord = new Map();
  const nodesByCol = Array.from({ length: COLS }, () => []);

  const registerNode = (node) => {
    const idx = supportNodes.length;
    supportNodes.push(node);
    nodesByCol[node.col].push(idx);
    const key = coordInt(node.col, node.floor);
    let bucket = nodeIndicesByCoord.get(key);
    if (!bucket) {
      bucket = [];
      nodeIndicesByCoord.set(key, bucket);
    }
    bucket.push(idx);
    return idx;
  };

  for (const l of tower.ledges) {
    if (l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate') continue;
    registerNode({
      col: wrapCol(l.col),
      floor: Math.round(l.floor),
      kind: 'ledge',
      ledge: l,
      elevatorId: -1,
      pipeGroup: null
    });
  }

  const elevators = Array.isArray(tower.elevators) ? tower.elevators : [];
  elevators.forEach((el, elIdx) => {
    const c = wrapCol(el.col);
    const minF = Math.round(el.minFloor);
    const maxF = Math.round(el.maxFloor);
    const pg = el.powered === false && el.pipeGroup ? el.pipeGroup : null;
    if (pg && GROUP_BITS[pg]) relevantGroupMask |= GROUP_BITS[pg];
    for (let f = minF; f <= maxF; f++) {
      registerNode({
        col: c,
        floor: f,
        kind: 'elevator',
        ledge: null,
        elevatorId: elIdx,
        pipeGroup: pg
      });
    }
  });

  const wallStrips = Array.isArray(tower.wallStrips) ? tower.wallStrips : [];
  wallStrips.forEach((ws, wsIdx) => {
    const c = wrapCol(ws.col);
    for (let f = Math.round(ws.minFloor); f <= Math.round(ws.maxFloor); f++) {
      registerNode({
        col: c,
        floor: f,
        kind: 'wallStrip',
        ledge: null,
        elevatorId: -100 - wsIdx,
        pipeGroup: null
      });
    }
  });

  const isNodeActive = (node, mask) => {
    if (node.kind === 'elevator') {
      if (node.pipeGroup) return isSwitchGroupOn(mask, node.pipeGroup);
      return true;
    }
    if (node.kind === 'wallStrip') return true;
    return isLedgeSupportActive(node.ledge, mask);
  };

  const hasCeilingAtCol = (c, floor, mask) => {
    const indices = nodeIndicesByCoord.get(coordInt(c, floor));
    if (!indices) return false;
    for (let i = 0; i < indices.length; i++) {
      const n = supportNodes[indices[i]];
      if (n.kind === 'ledge' && isNodeActive(n, mask)) return true;
    }
    return false;
  };

  const spawnCol = wrapCol(tower.spawn?.col ?? 0);
  const spawnFloor = Math.round(tower.spawn?.floor ?? 0);
  const startCandidates = (nodeIndicesByCoord.get(coordInt(spawnCol, spawnFloor)) || []).filter((idx) =>
    isNodeActive(supportNodes[idx], 0)
  );
  if (startCandidates.length === 0) {
    return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: crownSeals.length, reachableCoords };
  }

  const doorById = new Map(tower.doors.map((d) => [d.id, d]));
  const doorsByCoord = new Map();
  for (const d of tower.doors) {
    const dk = coordInt(wrapCol(d.col), Math.round(d.floor));
    let arr = doorsByCoord.get(dk);
    if (!arr) {
      arr = [];
      doorsByCoord.set(dk, arr);
    }
    arr.push(d);
  }
  const switches = Array.isArray(tower.switches) ? tower.switches : [];
  const grappleRings = Array.isArray(tower.grappleRings) ? tower.grappleRings : [];
  const enemies = Array.isArray(tower.enemies) ? tower.enemies : [];

  // Map multi-valve pipeGroups to individual valve bit flags above bit 8 so ALL valves must be spun!
  const pipeValvesByGroup = new Map();
  const pipeValveBitById = new Map();
  let nextValveBit = 256;
  for (const sw of switches) {
    if (sw.mode === 'pipeValve') {
      const grp = sw.pipeGroup || sw.group || 'pipeA';
      if (!pipeValvesByGroup.has(grp)) pipeValvesByGroup.set(grp, []);
      pipeValvesByGroup.get(grp).push(sw);
      pipeValveBitById.set(sw.id, nextValveBit);
      nextValveBit <<= 1;
    }
  }

  // Precompute Snap-Crab springboard terraces so BFS recognizes +3F carapace bounces!
  const crabSpringSet = new Set();
  for (const en of enemies) {
    if (en.type !== 'snap_crab') continue;
    const f = Math.round(en.floor);
    const sp = computeLedgeSpanAt(tower.ledges, en.col, f);
    if (sp.onRealTile) {
      for (let i = 0; i < sp.length; i++) {
        crabSpringSet.add(coordInt(wrapCol(sp.startCol + i), f));
      }
    }
  }

  const exitCoordSet = new Set(exitDoors.map((d) => coordInt(wrapCol(d.col), Math.round(d.floor))));
  const isGoalNode = (node, mask) =>
    exitCoordSet.size > 0 &&
    (mask & requiredSealMask) === requiredSealMask &&
    exitCoordSet.has(coordInt(node.col, node.floor));

  const numNodes = supportNodes.length;
  const visited = new Set();
  const qIdx = [];
  const qMask = [];
  const qSteps = [];

  for (const idx of startCandidates) {
    visited.add(idx);
    qIdx.push(idx);
    qMask.push(0);
    qSteps.push(0);
  }

  const recordedReachable = new Uint8Array(COLS * 128);
  let bestExitSteps = -1;
  let head = 0;
  while (head < qIdx.length) {
    const idx = qIdx[head];
    const mask = qMask[head];
    const steps = qSteps[head];
    head++;
    const cur = supportNodes[idx];

    if (cur.kind === 'ledge') {
      const rk = coordInt(cur.col, cur.floor);
      if (!recordedReachable[rk]) {
        recordedReachable[rk] = 1;
        reachableCoords.add(`${cur.col}:${cur.floor}`);
      }
    }

    if (isGoalNode(cur, mask)) {
      if (bestExitSteps < 0 || steps < bestExitSteps) bestExitSteps = steps;
      if (!collectAll) {
        return { solvable: true, minSteps: steps, reachableExit: true, crownSealsTotal: crownSeals.length, reachableCoords };
      }
    }

    const pushState = (nextIdx, nextMask, stepCost = 1) => {
      const stateKey = nextMask * numNodes + nextIdx;
      if (!visited.has(stateKey)) {
        visited.add(stateKey);
        qIdx.push(nextIdx);
        qMask.push(nextMask);
        qSteps.push(steps + stepCost);
      }
    };

    // 1. Toggle switches, spin Pipe-Valves (multi-valve groups!), or pull Upper Sluice Levers
    for (let sIdx = 0; sIdx < switches.length; sIdx++) {
      const sw = switches[sIdx];
      const sameFloor = Math.abs(sw.floor - cur.floor) <= 0.6;
      if (!sameFloor) continue;
      const dc = colDist(cur.col, sw.col);
      if (Math.abs(dc) > 6) continue;

      const grpKey = sw.pipeGroup || sw.group;
      if (sw.mode !== 'pipeValve' && sw.mode !== 'sluiceSeal') {
        const bit = GROUP_BITS[grpKey] || 0;
        if (!(bit & relevantGroupMask)) continue;
      }

      let blocked = false;
      const stepDir = Math.sign(dc);
      for (let s = 1; s <= Math.abs(dc); s++) {
        const checkCol = wrapCol(cur.col + stepDir * s);
        if (
          isLaserColBlocking(checkCol, cur.floor, cur.floor, mask) ||
          isPillarColBlocking(checkCol, cur.floor, cur.floor)
        ) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      if (sw.mode === 'pipeValve') {
        const vBit = pipeValveBitById.get(sw.id) || 0;
        let nextMask = mask | vBit;
        const grpValves = pipeValvesByGroup.get(grpKey) || [];
        const allSpun = grpValves.every((v) => Boolean(nextMask & (pipeValveBitById.get(v.id) || 0)));
        if (allSpun) {
          nextMask |= GROUP_BITS[grpKey] || 0;
          if (sw.sealId && GROUP_BITS[sw.sealId]) {
            nextMask |= GROUP_BITS[sw.sealId];
          }
        }
        if (nextMask !== mask) pushState(idx, nextMask, 1);
      } else if (sw.mode === 'sluiceSeal') {
        const sBit = GROUP_BITS[sw.sealId || sw.group] || 0;
        if (sBit && !(mask & sBit)) {
          pushState(idx, mask | sBit, 1);
        }
      } else {
        const bit = GROUP_BITS[grpKey] || 0;
        if (bit) {
          pushState(idx, mask ^ bit, 1);
        }
      }
    }

    // 2. Interior through-spire portals AND Mandatory Mid-Spire Inner Aqueduct Sanctums (`isRune`)
    if (cur.kind === 'ledge') {
      const localDoors = doorsByCoord.get(coordInt(cur.col, cur.floor));
      if (localDoors) {
        for (let di = 0; di < localDoors.length; di++) {
          const d = localDoors[di];
          if (d.isRune && allowSanctumSolve && d.sealId && GROUP_BITS[d.sealId]) {
            const sBit = GROUP_BITS[d.sealId];
            if (!(mask & sBit)) {
              pushState(idx, mask | sBit, 1);
            }
            continue;
          }
          if (d.isExit || d.isVault || d.isRune || !d.targetId) continue;
          const target = doorById.get(d.targetId);
          if (target) {
            const destIndices = nodeIndicesByCoord.get(coordInt(wrapCol(target.col), Math.round(target.floor))) || [];
            for (let k = 0; k < destIndices.length; k++) {
              const destIdx = destIndices[k];
              if (isNodeActive(supportNodes[destIdx], mask)) {
                pushState(destIdx, mask, 1);
              }
            }
          }
        }
      }
    }

    // 3. Steam/Hydro-Geyser OR Flipped Snap-Crab Springboard vertical launch (+3 floors)
    const canSpringLaunch =
      cur.kind === 'ledge' &&
      (cur.ledge?.type === 'steamVent' || crabSpringSet.has(coordInt(cur.col, cur.floor)));
    if (canSpringLaunch) {
      for (let dc = -2; dc <= 2; dc++) {
        const tc = wrapCol(cur.col + dc);
        const tcNodes = nodesByCol[tc];
        for (let k = 0; k < tcNodes.length; k++) {
          const nextIdx = tcNodes[k];
          const nxt = supportNodes[nextIdx];
          if (!isNodeActive(nxt, mask)) continue;
          const df = nxt.floor - cur.floor;
          if (df >= 1 && df <= 3) {
            if (
              !isLaserColBlocking(tc, cur.floor, nxt.floor, mask) &&
              !isLaserColBlocking(cur.col, cur.floor, nxt.floor, mask)
            ) {
              pushState(nextIdx, mask, 1);
            }
          }
        }
      }
    }

    // 4. Tail-Grapple Swing Rings across chasms (3..4 col span)
    for (let ri = 0; ri < grappleRings.length; ri++) {
      const ring = grappleRings[ri];
      const dfRing = ring.floor - cur.floor;
      if (dfRing < -0.5 || dfRing > 2.2) continue;
      const distToRing = colDist(cur.col, ring.col);
      if (Math.abs(distToRing) >= 1 && Math.abs(distToRing) <= 2.4) {
        const swingDir = Math.sign(distToRing) || 1;
        for (let spanStep = 1; spanStep <= 2; spanStep++) {
          const landCol = wrapCol(Math.round(ring.col + swingDir * spanStep));
          const landNodes = nodesByCol[landCol];
          for (let k = 0; k < landNodes.length; k++) {
            const nextIdx = landNodes[k];
            const nxt = supportNodes[nextIdx];
            if (!isNodeActive(nxt, mask)) continue;
            if (
              nxt.floor >= cur.floor - 2 &&
              nxt.floor <= cur.floor + 2 &&
              !isLaserColBlocking(landCol, Math.min(cur.floor, nxt.floor), Math.max(cur.floor, nxt.floor), mask)
            ) {
              pushState(nextIdx, mask, 1);
            }
          }
        }
      }
    }

    // 5. Conservative physical moves (stairs, walks, jumps, elevators & Gecko wall-strips [-2..+2])
    for (let dc = -2; dc <= 2; dc++) {
      const targetCol = wrapCol(cur.col + dc);
      const absDc = Math.abs(dc);
      const colCandidates = nodesByCol[targetCol];

      for (let k = 0; k < colCandidates.length; k++) {
        const nextIdx = colCandidates[k];
        if (nextIdx === idx) continue;
        const nxt = supportNodes[nextIdx];
        if (!isNodeActive(nxt, mask)) continue;

        const df = nxt.floor - cur.floor;
        if (df > 1 || df < -6) continue;

        if (
          absDc === 0 &&
          ((cur.kind === 'elevator' && nxt.kind === 'elevator') ||
            (cur.kind === 'wallStrip' && nxt.kind === 'wallStrip')) &&
          cur.elevatorId === nxt.elevatorId
        ) {
          if (Math.abs(df) === 1) {
            pushState(nextIdx, mask, 1);
          }
          continue;
        }

        if (absDc === 0) {
          if (df === 0 && cur.kind !== nxt.kind) {
            pushState(nextIdx, mask, 0);
          } else if (df < 0) {
            let intercepted = false;
            for (let f = cur.floor - 1; f > nxt.floor; f--) {
              if (hasCeilingAtCol(cur.col, f, mask) || isLaserColBlocking(cur.col, f, f, mask)) {
                intercepted = true;
                break;
              }
            }
            if (!intercepted && !isLaserColBlocking(nxt.col, nxt.floor, cur.floor, mask)) {
              pushState(nextIdx, mask, 1);
            }
          }
          continue;
        }

        if (absDc === 1) {
          const minF = Math.min(cur.floor, nxt.floor);
          const maxF = Math.max(cur.floor, nxt.floor);
          if (
            isLaserColBlocking(cur.col, minF, maxF, mask) ||
            isLaserColBlocking(nxt.col, minF, maxF, mask) ||
            isPillarColBlocking(nxt.col, minF, maxF)
          ) {
            continue;
          }
          if (df === 1) {
            if (!hasCeilingAtCol(cur.col, cur.floor + 1, mask)) {
              pushState(nextIdx, mask, 1);
            }
          } else if (df === 0) {
            pushState(nextIdx, mask, 1);
          } else if (df < 0) {
            let blockedDrop = false;
            for (let f = cur.floor; f > nxt.floor; f--) {
              if (hasCeilingAtCol(nxt.col, f, mask) || isLaserColBlocking(nxt.col, f, f, mask)) {
                blockedDrop = true;
                break;
              }
            }
            if (!blockedDrop) {
              pushState(nextIdx, mask, 1);
            }
          }
          continue;
        }

        if (absDc === 2) {
          if (df < -3) continue;
          const midCol = wrapCol(cur.col + Math.sign(dc));
          const minF = Math.min(cur.floor, nxt.floor);
          const maxF = Math.max(cur.floor, nxt.floor);

          if (
            isLaserColBlocking(cur.col, minF, maxF, mask) ||
            isLaserColBlocking(midCol, minF, maxF, mask) ||
            isLaserColBlocking(nxt.col, minF, maxF, mask) ||
            isPillarColBlocking(midCol, minF, maxF) ||
            isPillarColBlocking(nxt.col, minF, maxF)
          ) {
            continue;
          }
          if (hasCeilingAtCol(cur.col, cur.floor + 1, mask)) continue;
          if (df >= 0 && hasCeilingAtCol(midCol, cur.floor + 1, mask)) continue;

          pushState(nextIdx, mask, 1);
        }
      }
    }
  }

  return {
    solvable: bestExitSteps >= 0,
    minSteps: bestExitSteps,
    reachableExit: bestExitSteps >= 0,
    crownSealsTotal: crownSeals.length,
    reachableCoords
  };
}

/**
 * Verifies 100% reachability across ledges, staircases, jumps, pipe-valve elevators (including
 * multi-valve pressure groups), Snap-Crab springboard bounces, Gecko wall-scamper strips,
 * grapple rings, interior portals, mandatory Inner Aqueduct Sanctum seals, and switches.
 * @param {object} tower
 * @param {{ enforceSeals?: boolean, allowSanctumSolve?: boolean }} [opts]
 * @returns {{ solvable: boolean, minSteps: number, reachableExit: boolean, crownSealsTotal: number }}
 */
export function verifyTowerSolvable(tower, opts = {}) {
  const { solvable, minSteps, reachableExit, crownSealsTotal } = runTowerReachabilityBfs(tower, {
    ...opts,
    collectAll: false
  });
  return { solvable, minSteps, reachableExit, crownSealsTotal };
}

// ============================================================================
// PROCEDURAL COMPOSER FOR FLOOD RUSH, EXPEDITION, SANCTUM TRIALS & DAILY TIDE
// ============================================================================

const PROC_PUZZLE_TYPES = ['lights', 'bells', 'beam', 'blocks', 'pipes', 'tide_locks'];
const SANCTUM_MISSIONS = ['puzzle_architect', 'tower_repair', 'treasure_hunt', 'curio_survey'];
const CURIO_IDS = [
  'curio_astrolabe',
  'curio_nautilus',
  'curio_chronometer',
  'curio_prism_lens',
  'curio_compass',
  'curio_automaton_heart',
  'curio_frost_orchid',
  'curio_thunder_glass'
];

const BIOME_ADJECTIVES = {
  canyon_river: ['REDWOOD', 'SUNLIT', 'CATARACT', 'COPPER', 'WHITEWATER'],
  alpine_lake: ['ALPENGLOW', 'MIRROR', 'GLACIAL', 'SILVER', 'CRYSTAL'],
  mist_bayou: ['FIREFLY', 'EMERALD', 'CYPRESS', 'LOTUS', 'TWILIGHT'],
  coral_sea: ['TURQUOISE', 'PEARL', 'PELAGIC', 'ATOLL', 'LAGOON'],
  storm_ocean: ['AURORA', 'TEMPEST', 'POLAR', 'MAELSTROM', 'LEVIATHAN']
};

const SPIRE_NOUNS = [
  'SLUICE',
  'AQUEDUCT',
  'SPILLWAY',
  'RELIQUARY',
  'FLOODGATE',
  'CONDUIT',
  'SANCTUM',
  'CITADEL',
  'SPIRE',
  'BASTION'
];

export const PROCEDURAL_SET_PIECE_CHUNKS = Object.freeze([
  'realStairFlight',
  'pipePoweredLift',
  'geckoScamperWall',
  'grappleChasm',
  'geyserUpdraftTier',
  'crabSpringVault',
  'mechLiftShaft',
  'conduitArchWarp',
  'switchPhaseSluice',
  'reversibleFlumePuzzle',
  'conveyorFlume',
  'stairwayWithGate',
  'hydroRingExpress',
  'supplyCrateVault',
  'splitPathFork',
  'spiralGeyserChimney',
  'directionSwitchback',
  'iceSlideExpress',
  'grappleSkyChain',
  'coralPistonBridge',
  'ambushTerraceArena'
]);

const SUPPLY_CRATE_POWERUPS = Object.freeze(['turbo_current', 'bubble_shield', 'hydro_magnet']);

const BIOME_CHUNK_AFFINITY = Object.freeze({
  canyon_river: ['hydroRingExpress', 'supplyCrateVault', 'crabSpringVault', 'splitPathFork'],
  alpine_lake: ['iceSlideExpress', 'grappleSkyChain', 'geckoScamperWall', 'hydroRingExpress'],
  mist_bayou: ['switchPhaseSluice', 'splitPathFork', 'directionSwitchback', 'supplyCrateVault'],
  coral_sea: ['spiralGeyserChimney', 'coralPistonBridge', 'reversibleFlumePuzzle', 'hydroRingExpress'],
  storm_ocean: ['grappleSkyChain', 'ambushTerraceArena', 'iceSlideExpress', 'directionSwitchback']
});

function findReachableSolidCandidates(tower, precomputedReachable = null) {
  const occupied = new Set();
  for (const d of tower.doors) occupied.add(`${d.col}:${d.floor}`);
  for (const sw of tower.switches) occupied.add(`${sw.col}:${sw.floor}`);
  for (const c of tower.collectibles) occupied.add(`${c.col}:${Math.round(c.floor)}`);
  for (const l of tower.ledges) {
    if (isBarrierLedgeType(l.type)) {
      const h = Math.max(1, Math.round(l.h || 1));
      for (let k = 0; k < h; k++) occupied.add(`${l.col}:${l.floor + k}`);
    }
  }
  occupied.add(`${tower.spawn.col}:${tower.spawn.floor}`);

  const reachable =
    precomputedReachable ||
    runTowerReachabilityBfs(tower, { enforceSeals: false, allowSanctumSolve: true, collectAll: true })
      .reachableCoords;

  const candidates = [];
  for (const l of tower.ledges) {
    if (l.type !== 'solid' || l.floor < 2 || l.floor > tower.exitFloor) continue;
    const k = `${l.col}:${l.floor}`;
    if (occupied.has(k) || !reachable.has(k)) continue;
    candidates.push({ col: l.col, floor: l.floor });
    occupied.add(k);
  }
  return candidates;
}

/**
 * Generates a verified-solvable COLS=20 Spire tailored for:
 * - 'flood_rush' (tall vertical escape with geysers, grapple rings, gecko strips & drain valves)
 * - 'sanctum_trials' (`casual: true` / `modeHint: 'sanctum_trials'`, timer-free multi-valve & sanctum logic)
 * - 'expedition' (rotating 5 biomes with dynamic enemy squads, pipe-valves & boss encounters)
 * - 'daily_tide' (deterministic UTC daily challenge + daily tide modifier)
 */
export function generateProceduralTower({
  seed = 1,
  index = 1,
  difficulty = 1,
  modeHint = 'expedition',
  casual = false,
  themeOverride = null,
  dailyModifier = null,
  keyOverride = null,
  nameOverride = null,
  subtitleOverride = null,
  floorsOverride = null
} = {}) {
  const cleanSeed = (Number(seed) || 1) >>> 0;
  const rng = mulberry32(cleanSeed);
  const isSanctum = Boolean(casual || modeHint === 'sanctum_trials');
  const isFloodRush = modeHint === 'flood_rush';
  const isExpedition = modeHint === 'expedition';

  const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const depth = Math.max(1, Math.floor(Number(index) || 1));
  const diff = Math.max(1, Number(difficulty) || 1);

  const baseH = isFloodRush ? 22 : isSanctum ? 18 : 19;
  const dynamicHeight = baseH + Math.floor((depth - 1) * 1.5) + Math.floor(diff * 0.9) + randInt(0, 2);
  const floors = floorsOverride
    ? Math.max(16, Math.round(floorsOverride))
    : Math.max(18, Math.min(34, dynamicHeight));
  const exitFloor = floors - 2;

  const theme =
    themeOverride && BIOME_PALETTES[themeOverride]
      ? themeOverride
      : BIOME_THEMES[(depth - 1 + cleanSeed) % BIOME_THEMES.length];

  const palette = BIOME_PALETTES[theme];

  const mechanics = { ...DEFAULT_MECHANICS };
  if (isFloodRush) {
    mechanics.waterRiseRate = Number(Math.min(0.28, 0.14 + depth * 0.018).toFixed(3));
  } else if (!isSanctum) {
    if (theme === 'alpine_lake') {
      mechanics.windForce = 0.30;
      mechanics.windPeriod = 6.5;
    } else if (theme === 'storm_ocean') {
      mechanics.windForce = 0.34;
      mechanics.windPeriod = 6.2;
      mechanics.lightningInterval = 8.0;
    } else if (theme === 'mist_bayou' && rng() < 0.5) {
      mechanics.waterRiseRate = 0.12;
    }
  }
  if (dailyModifier?.mechanicsPatch) {
    Object.assign(mechanics, dailyModifier.mechanicsPatch);
  }

  const missionType = isSanctum
    ? SANCTUM_MISSIONS[(depth - 1 + Math.floor(rng() * SANCTUM_MISSIONS.length)) % SANCTUM_MISSIONS.length]
    : null;

  const adjPool = BIOME_ADJECTIVES[theme] || BIOME_ADJECTIVES.canyon_river;
  const name = nameOverride || `${pick(adjPool)} ${pick(SPIRE_NOUNS)}`;
  const subtitle =
    subtitleOverride ||
    (isFloodRush
      ? `FLASH-FLOOD SURGE ${depth} • OUTRUN THE TIDE`
      : isSanctum
      ? `SANCTUM TRIAL ${depth} • ${missionType.replace('_', ' ').toUpperCase()}`
      : isExpedition
      ? `WATERSHED EXPEDITION • SPIRE ${depth}`
      : `WATERSHED SECTOR ${depth}`);
  const key = keyOverride || `${modeHint}_${depth}_${cleanSeed}`;

  const useRuneSecret = isSanctum ? true : rng() < 0.6;
  const procPuzzleType = PROC_PUZZLE_TYPES[(depth - 1 + randInt(0, 3)) % PROC_PUZZLE_TYPES.length];
  const procPuzzleSeed = ((cleanSeed ^ 0x9e3779b9) + depth * 7919) >>> 0;

  const ledges = [];
  const elevators = [];
  const doors = [];
  const switches = [];
  const wallStrips = [];
  const grappleRings = [];
  const hydroRings = [];
  const collectibles = [];
  const enemies = [];
  const usedChunkTypes = [];
  let hydroRingSeq = 1;
  let supplyCrateCount = 0;

  const addHydroRing = (col, floor, chainId = null) => {
    hydroRings.push({
      id: `${key}_hr_${hydroRingSeq++}`,
      col: Number(wrapFloatCol(col).toFixed(2)),
      floor: Number(floor.toFixed(2)),
      ...(chainId ? { chainId } : {}),
      chainIndex: hydroRingSeq - 2
    });
  };

  const walkableMap = new Map();
  const barrierSet = new Set();
  const stairSolidCells = new Set();
  const stairAirCells = new Set();

  const hasShaftOrStripAt = (col, minF, maxF) => {
    const wc = wrapCol(col);
    for (const el of elevators) {
      if (wrapCol(el.col) === wc && maxF >= el.minFloor && minF <= el.maxFloor) return true;
    }
    for (const ws of wallStrips) {
      if (wrapCol(ws.col) === wc && maxF > ws.minFloor && minF <= ws.maxFloor) return true;
    }
    return false;
  };

  const canPlaceSolid = (col, fl) => {
    const wc = wrapCol(col);
    const k = `${wc}:${fl}`;
    if (stairAirCells.has(k) || barrierSet.has(k)) return false;
    if (hasShaftOrStripAt(wc, fl, fl)) return false;
    return true;
  };

  const canPlaceNonSolid = (col, fl) => {
    const wc = wrapCol(col);
    const k = `${wc}:${fl}`;
    if (stairSolidCells.has(k)) return false;
    return canPlaceSolid(wc, fl);
  };

  const canPlaceSolidRun = (fl, anchorCol, count, stepDir) => {
    const s = stepDir >= 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      if (!canPlaceSolid(anchorCol + s * i, fl)) return false;
    }
    return true;
  };

  const canPlaceNonSolidRun = (fl, anchorCol, count, stepDir) => {
    const s = stepDir >= 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      if (!canPlaceNonSolid(anchorCol + s * i, fl)) return false;
    }
    return true;
  };

  const canPlaceVerticalShaft = (col, minF, maxF) => {
    const wc = wrapCol(col);
    if (
      elevators.some((e) => wrapCol(e.col) === wc && minF <= e.maxFloor + 1 && maxF >= e.minFloor - 1) ||
      wallStrips.some((w) => wrapCol(w.col) === wc && minF <= w.maxFloor + 1 && maxF >= w.minFloor - 1)
    ) {
      return false;
    }
    for (let f = minF; f <= maxF; f++) {
      const k = `${wc}:${f}`;
      if (stairSolidCells.has(k) || stairAirCells.has(k) || barrierSet.has(k)) return false;
    }
    return true;
  };

  const putTile = (col, fl, type = 'solid', extra = {}) => {
    const wc = wrapCol(col);
    const k = `${wc}:${fl}`;
    tile(ledges, wc, fl, type, extra);
    if (isBarrierLedgeType(type)) {
      const h = Math.max(1, Math.round(extra.h || 1));
      for (let step = 0; step < h; step++) {
        barrierSet.add(`${wc}:${fl + step}`);
      }
    } else {
      walkableMap.set(k, type);
    }
  };

  const putSpanDir = (fl, anchorCol, count, stepDir, type = 'solid', extra = {}) => {
    const s = stepDir >= 0 ? 1 : -1;
    for (let i = 0; i < count; i++) {
      putTile(anchorCol + s * i, fl, type, extra);
    }
    return wrapCol(anchorCol + s * (count - 1));
  };

  const canPlaceStairFlight = (startFloor, startCol, steps, stepDir, topLandingLen = 3) => {
    const s = stepDir >= 0 ? 1 : -1;
    const nSteps = Math.max(1, Math.round(steps));
    if (!canPlaceSolid(startCol - s, startFloor)) return false;
    for (let k = 0; k < nSteps; k++) {
      const sc = wrapCol(startCol + s * k);
      const sf = startFloor + k;
      const nc = wrapCol(sc + s);
      if (!canPlaceSolid(sc, sf) || !canPlaceSolid(nc, sf + 1)) return false;
      if (walkableMap.has(`${nc}:${sf}`) || hasShaftOrStripAt(nc, sf, sf)) return false;
      if (k > 0 && walkableMap.has(`${nc}:${sf - 1}`)) return false;
      if (
        walkableMap.has(`${sc}:${sf + 1}`) ||
        barrierSet.has(`${sc}:${sf + 1}`) ||
        hasShaftOrStripAt(sc, sf + 1, sf + 1)
      ) {
        return false;
      }
      if (barrierSet.has(`${nc}:${sf + 1}`) || hasShaftOrStripAt(nc, sf + 1, sf + 1)) return false;
    }
    for (let i = 0; i < topLandingLen; i++) {
      if (!canPlaceSolid(startCol + s * (nSteps + i), startFloor + nSteps)) return false;
    }
    return true;
  };

  const placeStairFlight = (startFloor, startCol, steps, stepDir, topLandingLen = 3) => {
    const s = stepDir >= 0 ? 1 : -1;
    const nSteps = Math.max(1, Math.round(steps));
    const res = stairFlight(ledges, startFloor, startCol, nSteps, s, topLandingLen, 'solid');
    walkableMap.set(`${wrapCol(startCol - s)}:${startFloor}`, 'solid');
    for (let k = 0; k < nSteps; k++) {
      const sc = wrapCol(startCol + s * k);
      const sf = startFloor + k;
      const nc = wrapCol(sc + s);
      walkableMap.set(`${sc}:${sf}`, 'solid');
      walkableMap.set(`${nc}:${sf + 1}`, 'solid');
      stairSolidCells.add(`${sc}:${sf}`);
      stairSolidCells.add(`${nc}:${sf + 1}`);
      stairAirCells.add(`${nc}:${sf}`);
      stairAirCells.add(`${sc}:${sf + 1}`);
      if (k > 0) stairAirCells.add(`${nc}:${sf - 1}`);
    }
    for (let i = 0; i < topLandingLen; i++) {
      const tc = wrapCol(startCol + s * (nSteps + i));
      walkableMap.set(`${tc}:${startFloor + nSteps}`, 'solid');
    }
    return res;
  };

  const isClearVerticalAir = (col, minF, maxF) => {
    const wc = wrapCol(col);
    if (hasShaftOrStripAt(wc, minF, maxF)) return false;
    for (let f = minF; f <= maxF; f++) {
      const k = `${wc}:${f}`;
      if (walkableMap.has(k) || barrierSet.has(k)) return false;
    }
    return true;
  };

  // Safe 5-column Spawn Quay [18, 19, 0, 1, 2] centered on { col: 0, floor: 0 }
  const spawnDir = rng() < 0.5 ? 1 : -1;
  let dir = spawnDir;
  for (let i = 0; i < 5; i++) {
    putTile(18 + i, 0, 'solid');
  }
  const firstStartCol = spawnDir > 0 ? 3 : 17;
  const openSteps = rng() < 0.35 ? 3 : 2;
  const openRes = placeStairFlight(0, firstStartCol, openSteps, dir, 3);
  let curFloor = openRes.topFloor;
  let curCol = openRes.endCol;
  // Opening Hydro-Ring ribbon soaring up the spawn staircase!
  for (let s = 0; s < openSteps; s++) {
    addHydroRing(wrapFloatCol(firstStartCol + dir * s + 0.5), s + 0.85, 'spawn_launch');
  }

  let doorSeq = 1;
  let switchSeq = 1;
  let gearSeq = 1;
  let secretPlaced = false;
  let usedPipeA = false;
  let usedSwitchback = false;
  let usedSplitFork = false;
  const switchStateTracker = { red: false, cyan: false, conv: false };
  const isDailyTide = modeHint === 'daily_tide';

  const canPlaceSafeBox = (col, fl) => {
    const wc = wrapCol(col);
    const k = `${wc}:${fl}`;
    if (stairSolidCells.has(k) || stairAirCells.has(k) || barrierSet.has(k)) return false;
    if (stairSolidCells.has(`${wc}:${fl - 1}`)) return false;
    if (hasShaftOrStripAt(wc, fl, fl)) return false;
    if (doors.some((d) => wrapCol(d.col) === wc && Math.round(d.floor) === fl)) return false;
    if (switches.some((s) => wrapCol(s.col) === wc && Math.round(s.floor) === fl)) return false;
    return true;
  };

  const pickPowerUp = () => {
    if (isFloodRush && rng() < 0.55) return 'turbo_current';
    return SUPPLY_CRATE_POWERUPS[(supplyCrateCount + randInt(0, 2)) % SUPPLY_CRATE_POWERUPS.length];
  };

  const gearMult = dailyModifier?.mechanicsPatch?.doubleGears ? 2 : 1;
  const addGear = (col, floor) => {
    for (let g = 0; g < gearMult; g++) {
      collectibles.push({
        id: `${key}_g${gearSeq++}`,
        col: wrapCol(col + g * dir),
        floor,
        type: 'gear'
      });
    }
  };
  addGear(openRes.midCol, curFloor);

  const ENEMY_ROTATION = ['snap_crab', 'gulp_hopper', 'volt_eel', 'rail_skater', 'barnacle_mortar', 'vent_stalker'];
  const addEnemy = (en) => {
    if (!isSanctum || en.harmless) enemies.push(en);
  };

  const pushSecretDoor = (col, floor) => {
    if (useRuneSecret) {
      doors.push({
        id: `${key}_sanctum`,
        col: wrapCol(col),
        floor,
        isRune: true,
        puzzleType: procPuzzleType,
        puzzleSeed: procPuzzleSeed
      });
    } else {
      doors.push({
        id: `${key}_vault`,
        col: wrapCol(col),
        floor,
        isVault: true
      });
    }
  };

  let loopGuard = 0;
  while (curFloor < exitFloor - 2 && loopGuard++ < 64) {
    const remaining = exitFloor - curFloor;

    if (mechanics.waterRiseRate > 0 && curFloor >= 3 && switches.filter((s) => s.mode === 'drainValve').length < 2) {
      const targetFirstDrain = Math.max(3, Math.floor(exitFloor * 0.32));
      const targetSecondDrain = Math.max(targetFirstDrain + 4, Math.floor(exitFloor * 0.66));
      const drainCount = switches.filter((s) => s.mode === 'drainValve').length;
      if (
        (drainCount === 0 && curFloor >= targetFirstDrain) ||
        (drainCount === 1 && curFloor >= targetSecondDrain)
      ) {
        const dCol = wrapCol(curCol - dir);
        if (!switches.some((s) => s.col === dCol && s.floor === curFloor)) {
          switches.push({
            id: `${key}_drain_${switchSeq++}`,
            col: dCol,
            floor: curFloor,
            group: 'drain',
            mode: 'drainValve'
          });
        }
      }
    }

    const chunkPool = [
      'realStairFlight',
      'hydroRingExpress',
      'grappleChasm',
      'conveyorFlume',
      'iceSlideExpress',
      'coralPistonBridge'
    ];
    if (remaining >= 5) {
      chunkPool.push('spiralGeyserChimney');
    }
    if (remaining >= 4) {
      chunkPool.push(
        'geckoScamperWall',
        'mechLiftShaft',
        'conduitArchWarp',
        'crabSpringVault',
        'supplyCrateVault',
        'splitPathFork',
        'directionSwitchback',
        'grappleSkyChain',
        'ambushTerraceArena'
      );
      if (!usedPipeA) chunkPool.push('pipePoweredLift');
    }
    if (remaining >= 3) {
      chunkPool.push('geyserUpdraftTier', 'switchPhaseSluice', 'stairwayWithGate', 'reversibleFlumePuzzle');
      // Biome-flavored weighting so each Earth Water Biome feels architecturally distinct!
      const biomeFavs = BIOME_CHUNK_AFFINITY[theme] || [];
      for (const fav of biomeFavs) {
        if (fav === 'spiralGeyserChimney' && remaining < 5) continue;
        if (
          (fav === 'supplyCrateVault' ||
            fav === 'splitPathFork' ||
            fav === 'directionSwitchback' ||
            fav === 'grappleSkyChain' ||
            fav === 'ambushTerraceArena' ||
            fav === 'crabSpringVault' ||
            fav === 'geckoScamperWall') &&
          remaining < 4
        ) {
          continue;
        }
        chunkPool.push(fav);
      }
      if (isSanctum) {
        chunkPool.push('switchPhaseSluice', 'pipePoweredLift', 'reversibleFlumePuzzle', 'splitPathFork');
      }
      if (isFloodRush) {
        chunkPool.push('geyserUpdraftTier', 'spiralGeyserChimney', 'hydroRingExpress', 'grappleSkyChain', 'directionSwitchback');
      }
      if (isDailyTide) {
        chunkPool.push('hydroRingExpress', 'supplyCrateVault', 'splitPathFork', 'directionSwitchback');
      }
    }

    // Mode showcase guarantees (no repetition on daily_tide / flood_rush / expedition!)
    let chunk = pick(chunkPool);
    if (isDailyTide && !usedSplitFork && remaining >= 4 && curFloor >= 5) {
      chunk = 'splitPathFork';
    } else if (supplyCrateCount === 0 && remaining >= 4 && curFloor >= 4 && rng() < 0.45) {
      chunk = 'supplyCrateVault';
    } else if (!usedSwitchback && remaining >= 4 && curFloor >= Math.floor(exitFloor * 0.45) && rng() < 0.45) {
      chunk = 'directionSwitchback';
    }

    // 1. Pipe-Valve Powered Mechanical Elevator (valve safely on interior of 3-col solid terrace)
    if (chunk === 'pipePoweredLift' && !usedPipeA && remaining >= 4) {
      const valveCol = wrapCol(curCol - dir);
      const shaftCol = wrapCol(curCol + dir);
      const spanH = Math.min(4, remaining - 1);
      const topStart = wrapCol(shaftCol + dir);
      if (
        !switches.some((s) => s.col === valveCol && s.floor === curFloor) &&
        canPlaceVerticalShaft(shaftCol, curFloor, curFloor + spanH) &&
        canPlaceSolidRun(curFloor + spanH, topStart, 3, dir)
      ) {
        usedPipeA = true;
        usedChunkTypes.push('pipePoweredLift');
        switches.push({
          id: `${key}_pipe_${switchSeq++}`,
          col: valveCol,
          floor: curFloor,
          group: 'pipeA',
          pipeGroup: 'pipeA',
          mode: 'pipeValve'
        });
        elevators.push({
          id: `${key}_lift_pipe`,
          col: shaftCol,
          minFloor: curFloor,
          maxFloor: curFloor + spanH,
          startFloor: curFloor,
          speed: 1.95,
          pipeGroup: 'pipeA',
          powered: false
        });
        const nextEnd = putSpanDir(curFloor + spanH, topStart, 3, dir, 'solid');
        addGear(wrapCol(topStart + dir), curFloor + spanH);
        curFloor += spanH;
        curCol = nextEnd;
        continue;
      }
    }

    // 2. Gecko Crystal/Moss Wall-Scamper Strip
    if (chunk === 'geckoScamperWall' && remaining >= 4) {
      const stripCol = wrapCol(curCol + dir);
      const climbH = Math.min(3, remaining - 1);
      const topStart = wrapCol(stripCol + dir);
      if (
        canPlaceSolid(stripCol, curFloor) &&
        canPlaceVerticalShaft(stripCol, curFloor, curFloor + climbH) &&
        canPlaceSolidRun(curFloor + climbH, topStart, 3, dir)
      ) {
        usedChunkTypes.push('geckoScamperWall');
        putTile(stripCol, curFloor, 'solid');
        wallStrips.push({
          id: `${key}_gecko_${wallStrips.length + 1}`,
          col: stripCol,
          minFloor: curFloor,
          maxFloor: curFloor + climbH
        });
        const nextEnd = putSpanDir(curFloor + climbH, topStart, 3, dir, 'solid');
        addGear(stripCol, curFloor + Math.ceil(climbH / 2));
        addHydroRing(stripCol + 0.5, curFloor + climbH - 0.5, 'gecko');
        curFloor += climbH;
        curCol = nextEnd;
        continue;
      }
    }

    // 3. Tail-Grapple Swing Ring Chasm (3-col solid run-up + 1-col chasm + grapple ring -> +1F 3-col solid landing)
    if (chunk === 'grappleChasm' && remaining >= 2) {
      const gapCol = wrapCol(curCol + dir);
      const landStart = wrapCol(curCol + dir * 2);
      if (
        isClearVerticalAir(gapCol, curFloor, curFloor + 1) &&
        isClearVerticalAir(curCol, curFloor + 1, curFloor + 1) &&
        canPlaceSolidRun(curFloor + 1, landStart, 3, dir)
      ) {
        usedChunkTypes.push('grappleChasm');
        const ringCol = wrapFloatCol(curCol + 0.5 + dir * 1.2);
        grappleRings.push({
          id: `${key}_ring_${grappleRings.length + 1}`,
          col: Number(ringCol.toFixed(2)),
          floor: Number((curFloor + 1.45).toFixed(2))
        });
        addHydroRing(ringCol, curFloor + 1.15, 'grapple');
        const nextEnd = putSpanDir(curFloor + 1, landStart, 3, dir, 'solid');
        addGear(gapCol, curFloor + 2);
        curFloor += 1;
        curCol = nextEnd;
        continue;
      }
    }

    // 4. Hydro-Geyser Updraft Launch Tier (same-floor steamVent -> +2..3F 3-col solid terrace)
    if (chunk === 'geyserUpdraftTier' && remaining >= 3) {
      const ventCol = wrapCol(curCol + dir);
      const upH = remaining >= 4 ? 3 : 2;
      const upperStart = wrapCol(ventCol + dir);
      if (
        canPlaceNonSolid(ventCol, curFloor) &&
        isClearVerticalAir(ventCol, curFloor + 1, curFloor + upH) &&
        canPlaceSolidRun(curFloor + upH, upperStart, 3, dir)
      ) {
        usedChunkTypes.push('geyserUpdraftTier');
        putTile(ventCol, curFloor, 'steamVent', {
          phasePeriod: 3.1,
          phaseOffset: Number((rng() * 1.5).toFixed(2))
        });
        addHydroRing(ventCol + 0.5, curFloor + 1.2, 'geyser');
        addHydroRing(ventCol + 0.5 + dir * 0.3, curFloor + upH - 0.5, 'geyser');
        const nextEnd = putSpanDir(curFloor + upH, upperStart, 3, dir, 'solid');
        addGear(ventCol, curFloor + upH);
        curFloor += upH;
        curCol = nextEnd;
        continue;
      }
    }

    // 5. Flip-Crab Springboard + Backup Geyser Vault (+3F launch to upper loft)
    if (chunk === 'crabSpringVault' && remaining >= 4) {
      const c1 = wrapCol(curCol + dir);
      const c2 = wrapCol(curCol + dir * 2);
      const ventCol = wrapCol(curCol + dir * 3);
      const upperStart = wrapCol(ventCol + dir);
      if (
        canPlaceSolidRun(curFloor, c1, 2, dir) &&
        canPlaceNonSolid(ventCol, curFloor) &&
        isClearVerticalAir(c1, curFloor + 1, curFloor + 3) &&
        isClearVerticalAir(c2, curFloor + 1, curFloor + 3) &&
        isClearVerticalAir(ventCol, curFloor + 1, curFloor + 3) &&
        canPlaceSolidRun(curFloor + 3, upperStart, 3, dir)
      ) {
        usedChunkTypes.push('crabSpringVault');
        putSpanDir(curFloor, c1, 2, dir, 'solid');
        putTile(ventCol, curFloor, 'steamVent', {
          phasePeriod: 3.1,
          phaseOffset: Number((rng() * 1.4).toFixed(2))
        });
        addEnemy({
          type: 'snap_crab',
          col: c1 + 0.5,
          floor: curFloor,
          dir: -dir,
          ...(isSanctum ? { harmless: true } : {})
        });
        const nextEnd = putSpanDir(curFloor + 3, upperStart, 3, dir, 'solid');
        addGear(c2, curFloor + 3);
        curFloor += 3;
        curCol = nextEnd;
        continue;
      }
    }

    // 6. Standard Mechanical Elevator Shaft
    if (chunk === 'mechLiftShaft' && remaining >= 4) {
      const liftSpan = Math.min(4, remaining - 1);
      const shaftCol = wrapCol(curCol + dir);
      const landStart = wrapCol(shaftCol + dir);
      if (
        canPlaceVerticalShaft(shaftCol, curFloor, curFloor + liftSpan) &&
        canPlaceSolidRun(curFloor + liftSpan, landStart, 3, dir)
      ) {
        usedChunkTypes.push('mechLiftShaft');
        elevators.push({
          id: `${key}_lift_${elevators.length + 1}`,
          col: shaftCol,
          minFloor: curFloor,
          maxFloor: curFloor + liftSpan,
          startFloor: curFloor,
          speed: Number((1.75 + Math.min(0.6, diff * 0.08)).toFixed(2))
        });
        const nextEnd = putSpanDir(curFloor + liftSpan, landStart, 3, dir, 'solid');
        curFloor += liftSpan;
        curCol = nextEnd;
        addEnemy({
          type: ENEMY_ROTATION[(depth + curFloor) % ENEMY_ROTATION.length],
          col: wrapCol(shaftCol + 10) + 0.5,
          floor: curFloor,
          dir: -dir,
          speed: 1.75
        });
        continue;
      }
    }

    // 7. Conduit Archway Shortcut (+9..11 col cross-spire warp onto 4-col solid terrace)
    if (chunk === 'conduitArchWarp' && remaining >= 4) {
      const enterCol = wrapCol(curCol - dir);
      const nextDir = rng() < 0.45 ? -dir : dir;
      const platStart = wrapCol(enterCol + 9 + randInt(0, 2));
      const jumpFloors = Math.min(3, remaining - 1);
      const targetFloor = curFloor + jumpFloors;
      if (
        !doors.some((d) => d.col === enterCol && d.floor === curFloor) &&
        !switches.some((s) => s.col === enterCol && s.floor === curFloor) &&
        !barrierSet.has(`${enterCol}:${curFloor}`) &&
        canPlaceSolidRun(targetFloor, platStart, 4, nextDir)
      ) {
        usedChunkTypes.push('conduitArchWarp');
        const dA = `${key}_d${doorSeq}a`;
        const dB = `${key}_d${doorSeq}b`;
        doorSeq++;
        const exitPortalCol = wrapCol(platStart + nextDir);
        const nextEnd = putSpanDir(targetFloor, platStart, 4, nextDir, 'solid');
        doors.push(
          { id: dA, col: enterCol, floor: curFloor, targetId: dB, tunnelStyle: 'sparkArch' },
          { id: dB, col: exitPortalCol, floor: targetFloor, targetId: dA, tunnelStyle: 'sparkArch' }
        );
        dir = nextDir;
        curFloor = targetFloor;
        curCol = nextEnd;
        continue;
      }
    }

    // 8. Switch + Same-Floor Phase Sluice Bridge -> Canonical Stair Flight (100% single-polarity, zero fake stairs, zero double-toggle!)
    if (chunk === 'switchPhaseSluice' && remaining >= 3) {
      const availGroup = !switchStateTracker.red ? 'red' : !switchStateTracker.cyan ? 'cyan' : null;
      const swCol = wrapCol(curCol - dir);
      const brStart = wrapCol(curCol + dir);
      const exitStart = wrapCol(curCol + dir * 3);
      const stairStart = wrapCol(curCol + dir * 6);
      const flightSteps = Math.min(2, remaining - 1);
      if (
        availGroup &&
        !switches.some((s) => s.col === swCol && s.floor === curFloor) &&
        !doors.some((d) => d.col === swCol && d.floor === curFloor) &&
        !barrierSet.has(`${swCol}:${curFloor}`) &&
        canPlaceNonSolidRun(curFloor, brStart, 2, dir) &&
        canPlaceSolidRun(curFloor, exitStart, 3, dir) &&
        canPlaceStairFlight(curFloor, stairStart, flightSteps, dir, 3)
      ) {
        usedChunkTypes.push('switchPhaseSluice');
        switchStateTracker[availGroup] = true;
        switches.push({
          id: `${key}_sw_${switchSeq++}`,
          col: swCol,
          floor: curFloor,
          group: availGroup,
          mode: 'toggle'
        });
        putSpanDir(curFloor, brStart, 2, dir, 'phaseBlock', {
          switchGroup: availGroup,
          inverted: false
        });
        putSpanDir(curFloor, exitStart, 3, dir, 'solid');
        addGear(wrapCol(brStart + dir), curFloor);
        const res = placeStairFlight(curFloor, stairStart, flightSteps, dir, 3);
        curFloor = res.topFloor;
        curCol = res.endCol;
        continue;
      }
    }

    // 9. Same-Floor Reversible / Booster Hydro-Flume -> Canonical Stair or Chasm Leap (zero fake stairs!)
    if ((chunk === 'reversibleFlumePuzzle' || chunk === 'conveyorFlume') && remaining >= 2) {
      if (chunk === 'reversibleFlumePuzzle' && !switchStateTracker.conv) {
        const swCol = wrapCol(curCol - dir);
        const flumeStart = wrapCol(curCol + dir);
        const exitStart = wrapCol(curCol + dir * 4);
        const stairStart = wrapCol(curCol + dir * 7);
        const flightSteps = Math.min(2, remaining - 1);
        if (
          flightSteps >= 1 &&
          !switches.some((s) => s.col === swCol && s.floor === curFloor) &&
          !doors.some((d) => d.col === swCol && d.floor === curFloor) &&
          !barrierSet.has(`${swCol}:${curFloor}`) &&
          canPlaceNonSolidRun(curFloor, flumeStart, 3, dir) &&
          canPlaceSolidRun(curFloor, exitStart, 3, dir) &&
          canPlaceStairFlight(curFloor, stairStart, flightSteps, dir, 3)
        ) {
          usedChunkTypes.push('reversibleFlumePuzzle');
          switchStateTracker.conv = true;
          switches.push({
            id: `${key}_conv_${switchSeq++}`,
            col: swCol,
            floor: curFloor,
            group: 'conv',
            mode: 'conveyorFlip'
          });
          // Starts opposing before swCol; flips to boosting +dir when Gateway steps on swCol!
          const flumeType = dir === 1 ? 'conveyorL' : 'conveyorR';
          putSpanDir(curFloor, flumeStart, 3, dir, flumeType);
          putSpanDir(curFloor, exitStart, 3, dir, 'solid');
          addGear(wrapCol(flumeStart + dir), curFloor);
          const res = placeStairFlight(curFloor, stairStart, flightSteps, dir, 3);
          curFloor = res.topFloor;
          curCol = res.endCol;
          continue;
        }
      } else {
        // Booster conveyorFlume on curFloor launching across a 1-col chasm onto a +1F 3-col solid terrace!
        const flumeStart = wrapCol(curCol + dir);
        const gapCol = wrapCol(curCol + dir * 3);
        const landStart = wrapCol(curCol + dir * 4);
        if (
          canPlaceNonSolidRun(curFloor, flumeStart, 2, dir) &&
          isClearVerticalAir(gapCol, curFloor, curFloor + 1) &&
          isClearVerticalAir(wrapCol(curCol + dir * 2), curFloor + 1, curFloor + 1) &&
          canPlaceSolidRun(curFloor + 1, landStart, 3, dir)
        ) {
          usedChunkTypes.push('conveyorFlume');
          const boostType = switchStateTracker.conv
            ? dir === 1
              ? 'conveyorL'
              : 'conveyorR'
            : dir === 1
            ? 'conveyorR'
            : 'conveyorL';
          putSpanDir(curFloor, flumeStart, 2, dir, boostType);
          const nextEnd = putSpanDir(curFloor + 1, landStart, 3, dir, 'solid');
          addGear(gapCol, curFloor + 1);
          curFloor += 1;
          curCol = nextEnd;
          continue;
        }
      }
    }

    // 10. Stairway With Switch-Retracted Siphon Gate (100% single-polarity, gate on flat terrace clear of stairs!)
    if (chunk === 'stairwayWithGate' && remaining >= 3) {
      const availGroup = !switchStateTracker.red ? 'red' : !switchStateTracker.cyan ? 'cyan' : null;
      const swCol = wrapCol(curCol - dir);
      const gateCol = wrapCol(curCol + dir);
      const leadCol = wrapCol(curCol + dir * 2);
      const stairStart = wrapCol(curCol + dir * 3);
      const flightSteps = Math.min(2, remaining - 1);
      if (
        availGroup &&
        !switches.some((s) => s.col === swCol && s.floor === curFloor) &&
        !doors.some((d) => d.col === swCol && d.floor === curFloor) &&
        !barrierSet.has(`${swCol}:${curFloor}`) &&
        canPlaceNonSolid(gateCol, curFloor) &&
        isClearVerticalAir(gateCol, curFloor + 1, curFloor + 2) &&
        canPlaceSolid(leadCol, curFloor) &&
        canPlaceStairFlight(curFloor, stairStart, flightSteps, dir, 3)
      ) {
        usedChunkTypes.push('stairwayWithGate');
        switchStateTracker[availGroup] = true;
        switches.push({
          id: `${key}_sw_${switchSeq++}`,
          col: swCol,
          floor: curFloor,
          group: availGroup,
          mode: 'toggle'
        });
        putTile(gateCol, curFloor, 'solid');
        putTile(gateCol, curFloor, 'laserGate', {
          switchGroup: availGroup,
          inverted: false,
          h: 2
        });
        putTile(leadCol, curFloor, 'solid');
        const res = placeStairFlight(curFloor, stairStart, flightSteps, dir, 3);
        addGear(res.midCol, res.topFloor);
        curFloor = res.topFloor;
        curCol = res.endCol;
        continue;
      }
    }

    // 11. NEW: Hydro-Ring Express (Sweeping 5-Ring Stair-to-Chasm Aerial Speed Line!)
    if (chunk === 'hydroRingExpress' && remaining >= 3) {
      const stairStart = wrapCol(curCol + dir);
      const steps = Math.min(2, remaining - 2);
      const topFl = curFloor + steps;
      const topEnd = wrapCol(stairStart + dir * (steps + 1));
      const gapCol = wrapCol(topEnd + dir);
      const landStart = wrapCol(gapCol + dir);
      if (
        steps >= 1 &&
        canPlaceStairFlight(curFloor, stairStart, steps, dir, 2) &&
        isClearVerticalAir(gapCol, topFl, topFl + 1) &&
        isClearVerticalAir(topEnd, topFl + 1, topFl + 1) &&
        canPlaceSolidRun(topFl + 1, landStart, 3, dir)
      ) {
        usedChunkTypes.push('hydroRingExpress');
        placeStairFlight(curFloor, stairStart, steps, dir, 2);
        const chainTag = `express_${hydroRingSeq}`;
        for (let s = 0; s < steps; s++) {
          addHydroRing(wrapFloatCol(stairStart + dir * s + 0.5), curFloor + s + 0.85, chainTag);
        }
        addHydroRing(wrapFloatCol(topEnd + 0.5), topFl + 0.65, chainTag);
        addHydroRing(wrapFloatCol(gapCol + 0.5), topFl + 1.35, chainTag);
        addHydroRing(wrapFloatCol(landStart + 0.5), topFl + 1.6, chainTag);
        const nextEnd = putSpanDir(topFl + 1, landStart, 3, dir, 'solid');
        addGear(wrapCol(landStart + dir), topFl + 1);
        curFloor = topFl + 1;
        curCol = nextEnd;
        continue;
      }
    }

    // 12. NEW: Supply Crate Vault (Guarded Glowing Power-Up Supply Crate Alcove -> Canonical Stair Flight!)
    if (chunk === 'supplyCrateVault' && remaining >= 3) {
      const pStart = wrapCol(curCol + dir);
      const crateCol = wrapCol(curCol + dir * 2);
      const guardCol = wrapCol(curCol + dir * 4);
      const stairStart = wrapCol(curCol + dir * 6);
      const steps = Math.min(2, remaining - 1);
      if (
        canPlaceSolidRun(curFloor, pStart, 5, dir) &&
        canPlaceSafeBox(crateCol, curFloor) &&
        canPlaceStairFlight(curFloor, stairStart, steps, dir, 3)
      ) {
        usedChunkTypes.push('supplyCrateVault');
        putSpanDir(curFloor, pStart, 5, dir, 'solid');
        const pUp = pickPowerUp();
        putTile(crateCol, curFloor, 'box', { powerUp: pUp });
        supplyCrateCount++;
        addGear(wrapCol(curCol + dir * 3), curFloor);
        addEnemy({
          type: rng() < 0.5 ? 'snap_crab' : 'barnacle_mortar',
          col: guardCol + 0.5,
          floor: curFloor,
          dir: -dir,
          speed: 1.55
        });
        const res = placeStairFlight(curFloor, stairStart, steps, dir, 3);
        addHydroRing(wrapFloatCol(stairStart + 0.5), curFloor + 0.85, 'vault_out');
        curFloor = res.topFloor;
        curCol = res.endCol;
        continue;
      }
    }

    // 13. NEW: Split-Path Fork (Safe Canonical Staircase Low-Road vs Elevated Grapple/Crate High-Road!)
    if (chunk === 'splitPathFork' && remaining >= 4) {
      const stairStart = wrapCol(curCol + dir);
      const topFl = curFloor + 2;
      const highBalconyStart = wrapCol(stairStart + dir * 3);
      const highCrateCol = wrapCol(highBalconyStart + dir);
      if (
        canPlaceStairFlight(curFloor, stairStart, 2, dir, 4) &&
        isClearVerticalAir(highBalconyStart, topFl + 1, topFl + 1) &&
        canPlaceSolidRun(topFl + 1, highBalconyStart, 3, dir) &&
        canPlaceSafeBox(highCrateCol, topFl + 1)
      ) {
        usedChunkTypes.push('splitPathFork');
        usedSplitFork = true;
        const res = placeStairFlight(curFloor, stairStart, 2, dir, 4);
        // Elevated Risk/Reward High-Road Balcony overlooking the rejoin landing (steps cleanly down onto landing!)
        putSpanDir(topFl + 1, highBalconyStart, 3, dir, 'solid');
        putTile(highCrateCol, topFl + 1, 'box', { powerUp: pickPowerUp() });
        supplyCrateCount++;
        const ringCol = wrapFloatCol(stairStart + dir * 2 + 0.5);
        grappleRings.push({
          id: `${key}_ring_${grappleRings.length + 1}`,
          col: Number(ringCol.toFixed(2)),
          floor: Number((topFl + 1.25).toFixed(2))
        });
        addHydroRing(ringCol, topFl + 0.9, 'fork_high');
        addHydroRing(wrapFloatCol(highBalconyStart + 0.5), topFl + 1.65, 'fork_high');
        addGear(wrapCol(highBalconyStart + dir * 2), topFl + 1);
        curFloor = res.topFloor;
        curCol = res.endCol;
        continue;
      }
    }

    // 14. NEW: Spiral Geyser Chimney (Twin Stacked Vertical Launchpads Ringed With Hydro-Rings!)
    if (chunk === 'spiralGeyserChimney' && remaining >= 5) {
      const vent1 = wrapCol(curCol + dir);
      const midStart = wrapCol(vent1 + dir);
      const vent2 = wrapCol(midStart + dir * 3);
      const topStart = wrapCol(vent2 + dir);
      const up1 = 2;
      const up2 = remaining >= 6 ? 3 : 2;
      if (
        canPlaceNonSolid(vent1, curFloor) &&
        isClearVerticalAir(vent1, curFloor + 1, curFloor + up1) &&
        canPlaceSolidRun(curFloor + up1, midStart, 3, dir) &&
        canPlaceNonSolid(vent2, curFloor + up1) &&
        isClearVerticalAir(vent2, curFloor + up1 + 1, curFloor + up1 + up2) &&
        canPlaceSolidRun(curFloor + up1 + up2, topStart, 3, dir)
      ) {
        usedChunkTypes.push('spiralGeyserChimney');
        putTile(vent1, curFloor, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.0 });
        putSpanDir(curFloor + up1, midStart, 3, dir, 'solid');
        putTile(vent2, curFloor + up1, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.45 });
        const nextEnd = putSpanDir(curFloor + up1 + up2, topStart, 3, dir, 'solid');
        const tag = `chimney_${hydroRingSeq}`;
        addHydroRing(vent1 + 0.5, curFloor + 1.2, tag);
        addHydroRing(midStart + 0.5, curFloor + up1 + 0.6, tag);
        addHydroRing(vent2 + 0.5, curFloor + up1 + 1.2, tag);
        addHydroRing(vent2 + 0.5, curFloor + up1 + up2 - 0.3, tag);
        addGear(wrapCol(midStart + dir), curFloor + up1);
        curFloor += up1 + up2;
        curCol = nextEnd;
        continue;
      }
    }

    // 15. NEW: Direction Switchback (Breaks Monotonic Spiral Walking! Panoramic Geyser Lift + Reversed Ascent!)
    if (chunk === 'directionSwitchback' && remaining >= 4) {
      const ventCol = wrapCol(curCol + dir);
      const newDir = -dir;
      const topFl = curFloor + 2;
      const deckStart = wrapCol(ventCol + newDir);
      if (
        canPlaceNonSolid(ventCol, curFloor) &&
        isClearVerticalAir(ventCol, curFloor + 1, topFl) &&
        canPlaceSolidRun(topFl, deckStart, 4, newDir)
      ) {
        usedChunkTypes.push('directionSwitchback');
        usedSwitchback = true;
        putTile(ventCol, curFloor, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.15 });
        const nextEnd = putSpanDir(topFl, deckStart, 4, newDir, 'solid');
        addHydroRing(ventCol + 0.5, curFloor + 1.15, 'switchback');
        addHydroRing(deckStart + 0.5, topFl + 0.65, 'switchback');
        addGear(wrapCol(deckStart + newDir), topFl);
        dir = newDir;
        curFloor = topFl;
        curCol = nextEnd;
        continue;
      }
    }

    // 16. NEW: Ice-Slide Express (Glacier Momentum Runway -> Chasm Leap With Hydro-Ring Arc!)
    if (chunk === 'iceSlideExpress' && remaining >= 2) {
      const iceStart = wrapCol(curCol + dir);
      const gapCol = wrapCol(curCol + dir * 4);
      const landStart = wrapCol(curCol + dir * 5);
      if (
        canPlaceNonSolidRun(curFloor, iceStart, 3, dir) &&
        isClearVerticalAir(gapCol, curFloor, curFloor + 1) &&
        isClearVerticalAir(wrapCol(curCol + dir * 3), curFloor + 1, curFloor + 1) &&
        canPlaceSolidRun(curFloor + 1, landStart, 3, dir)
      ) {
        usedChunkTypes.push('iceSlideExpress');
        putSpanDir(curFloor, iceStart, 3, dir, 'ice');
        const nextEnd = putSpanDir(curFloor + 1, landStart, 3, dir, 'solid');
        const tag = `ice_${hydroRingSeq}`;
        addHydroRing(wrapFloatCol(iceStart + 0.5), curFloor + 0.65, tag);
        addHydroRing(wrapFloatCol(iceStart + dir * 2 + 0.5), curFloor + 0.75, tag);
        addHydroRing(wrapFloatCol(gapCol + 0.5), curFloor + 1.35, tag);
        addHydroRing(wrapFloatCol(landStart + 0.5), curFloor + 1.65, tag);
        addGear(gapCol, curFloor + 1);
        if (rng() < 0.65) {
          addEnemy({
            type: 'rail_skater',
            col: wrapCol(iceStart + dir) + 0.5,
            floor: curFloor,
            dir: -dir,
            speed: 1.85,
            axis: 'h'
          });
        }
        curFloor += 1;
        curCol = nextEnd;
        continue;
      }
    }

    // 17. NEW: Grapple Sky-Chain (Twin Sequential Tail-Grapple Sky-Chasms With Aerial Hydro-Rings!)
    if (chunk === 'grappleSkyChain' && remaining >= 3) {
      const gap1 = wrapCol(curCol + dir);
      const midStart = wrapCol(curCol + dir * 2);
      const midEnd = wrapCol(curCol + dir * 3);
      const gap2 = wrapCol(curCol + dir * 4);
      const landStart = wrapCol(curCol + dir * 5);
      if (
        isClearVerticalAir(gap1, curFloor, curFloor + 1) &&
        isClearVerticalAir(curCol, curFloor + 1, curFloor + 1) &&
        canPlaceSolidRun(curFloor + 1, midStart, 2, dir) &&
        isClearVerticalAir(gap2, curFloor + 1, curFloor + 2) &&
        isClearVerticalAir(midEnd, curFloor + 2, curFloor + 2) &&
        canPlaceSolidRun(curFloor + 2, landStart, 3, dir)
      ) {
        usedChunkTypes.push('grappleSkyChain');
        putSpanDir(curFloor + 1, midStart, 2, dir, 'solid');
        const nextEnd = putSpanDir(curFloor + 2, landStart, 3, dir, 'solid');
        const r1Col = wrapFloatCol(gap1 + 0.5);
        const r2Col = wrapFloatCol(gap2 + 0.5);
        grappleRings.push(
          { id: `${key}_ring_${grappleRings.length + 1}`, col: Number(r1Col.toFixed(2)), floor: Number((curFloor + 1.45).toFixed(2)) },
          { id: `${key}_ring_${grappleRings.length + 2}`, col: Number(r2Col.toFixed(2)), floor: Number((curFloor + 2.45).toFixed(2)) }
        );
        const tag = `skychain_${hydroRingSeq}`;
        addHydroRing(r1Col, curFloor + 1.15, tag);
        addHydroRing(wrapFloatCol(midStart + 0.5), curFloor + 1.65, tag);
        addHydroRing(r2Col, curFloor + 2.15, tag);
        addHydroRing(wrapFloatCol(landStart + 0.5), curFloor + 2.65, tag);
        addGear(midEnd, curFloor + 1);
        curFloor += 2;
        curCol = nextEnd;
        continue;
      }
    }

    // 18. NEW: Coral Piston Bridge (Timed Staggered Coral Pistons + Supply Crate Landing!)
    if (chunk === 'coralPistonBridge' && remaining >= 2) {
      const p1 = wrapCol(curCol + dir);
      const p2 = wrapCol(curCol + dir * 2);
      const landStart = wrapCol(curCol + dir * 3);
      if (
        isClearVerticalAir(curCol, curFloor + 1, curFloor + 1) &&
        canPlaceNonSolidRun(curFloor + 1, p1, 2, dir) &&
        canPlaceSolidRun(curFloor + 1, landStart, 4, dir)
      ) {
        usedChunkTypes.push('coralPistonBridge');
        putTile(p1, curFloor + 1, 'piston', { phasePeriod: 3.1, phaseOffset: 0.0 });
        putTile(p2, curFloor + 1, 'piston', { phasePeriod: 3.1, phaseOffset: 0.35 });
        const nextEnd = putSpanDir(curFloor + 1, landStart, 4, dir, 'solid');
        if (canPlaceSafeBox(landStart, curFloor + 1) && rng() < 0.6) {
          putTile(landStart, curFloor + 1, 'box', { powerUp: pickPowerUp() });
          supplyCrateCount++;
        }
        addHydroRing(wrapFloatCol(p1 + 0.5), curFloor + 1.65, 'piston');
        addHydroRing(wrapFloatCol(p2 + 0.5), curFloor + 1.65, 'piston');
        addGear(wrapCol(landStart + dir), curFloor + 1);
        curFloor += 1;
        curCol = nextEnd;
        continue;
      }
    }

    // 19. NEW: Ambush Terrace Arena (6-Col Battle Parapet + Contrasting Foes + Supply Crate + Celebration Stair!)
    if (chunk === 'ambushTerraceArena' && remaining >= 4) {
      const aStart = wrapCol(curCol + dir);
      const crateCol = wrapCol(curCol + dir * 2);
      const foe1Col = wrapCol(curCol + dir * 4);
      const stairStart = wrapCol(curCol + dir * 7);
      const steps = Math.min(2, remaining - 1);
      if (
        canPlaceSolidRun(curFloor, aStart, 6, dir) &&
        canPlaceSafeBox(crateCol, curFloor) &&
        canPlaceStairFlight(curFloor, stairStart, steps, dir, 3)
      ) {
        usedChunkTypes.push('ambushTerraceArena');
        putSpanDir(curFloor, aStart, 6, dir, 'solid');
        putTile(crateCol, curFloor, 'box', { powerUp: pickPowerUp() });
        supplyCrateCount++;
        addGear(wrapCol(curCol + dir * 3), curFloor);
        addGear(wrapCol(curCol + dir * 5), curFloor);
        addEnemy({
          type: rng() < 0.5 ? 'snap_crab' : 'gulp_hopper',
          col: foe1Col + 0.5,
          floor: curFloor,
          dir: -dir,
          speed: 1.65
        });
        addEnemy({
          type: 'volt_eel',
          col: wrapCol(curCol + dir * 5) + 0.5,
          floor: curFloor + 0.85,
          dir: -dir,
          speed: 1.85,
          amp: 0.32
        });
        const res = placeStairFlight(curFloor, stairStart, steps, dir, 3);
        const tag = `arena_${hydroRingSeq}`;
        for (let s = 0; s < steps; s++) {
          addHydroRing(wrapFloatCol(stairStart + dir * s + 0.5), curFloor + s + 0.85, tag);
        }
        curFloor = res.topFloor;
        curCol = res.endCol;
        continue;
      }
    }

    // Default: Smooth Multi-Tread Real Staircase Flight! (Always 'solid' so 3D 5-riser stairs match physics 1:1!)
    const flightSteps = Math.min(3, remaining - 1);
    let placedDefault = false;
    for (let pad = 0; pad <= 3; pad++) {
      if (pad > 0) {
        const padCol = wrapCol(curCol + dir);
        if (!canPlaceSolid(padCol, curFloor)) break;
        putTile(padCol, curFloor, 'solid');
        curCol = padCol;
      }
      const stairStart = wrapCol(curCol + dir);
      if (canPlaceStairFlight(curFloor, stairStart, flightSteps, dir, 3)) {
        usedChunkTypes.push('realStairFlight');
        const res = placeStairFlight(curFloor, stairStart, flightSteps, dir, 3);
        curFloor = res.topFloor;
        curCol = res.endCol;
        addGear(res.midCol, curFloor);
        if (hydroRings.length < 6) {
          addHydroRing(wrapFloatCol(stairStart + 0.5), res.topFloor - flightSteps + 0.85, 'stairs');
        }
        placedDefault = true;

        if (curFloor > 2 && rng() < 0.7) {
          addEnemy({
            type: ENEMY_ROTATION[(depth + curFloor) % ENEMY_ROTATION.length],
            col: wrapCol(res.midCol + 9) + 0.5,
            floor: curFloor,
            dir,
            speed: Number((1.65 + Math.min(0.7, diff * 0.08)).toFixed(2))
          });
        }
        break;
      }
    }

    if (!placedDefault) {
      // Safe shaft fallback if columns ahead had prior vertical obstacles
      for (let step = 1; step <= COLS; step++) {
        const shaftCol = wrapCol(curCol + dir * step);
        const topStart = wrapCol(shaftCol + dir);
        const spanH = Math.min(3, remaining - 1);
        if (step > 1 && !canPlaceSolid(wrapCol(curCol + dir * (step - 1)), curFloor)) break;
        if (step > 1) putTile(wrapCol(curCol + dir * (step - 1)), curFloor, 'solid');
        if (
          canPlaceVerticalShaft(shaftCol, curFloor, curFloor + spanH) &&
          canPlaceSolidRun(curFloor + spanH, topStart, 3, dir)
        ) {
          elevators.push({
            id: `${key}_lift_${elevators.length + 1}`,
            col: shaftCol,
            minFloor: curFloor,
            maxFloor: curFloor + spanH,
            startFloor: curFloor,
            speed: 1.9
          });
          curCol = putSpanDir(curFloor + spanH, topStart, 3, dir, 'solid');
          curFloor += spanH;
          break;
        }
      }
    }

    if (!secretPlaced && curFloor >= Math.floor(exitFloor * 0.45) && curFloor <= exitFloor - 3) {
      const bridgeCol = wrapCol(curCol + dir);
      const sideCol = wrapCol(curCol + dir * 2);
      const starCol = wrapCol(curCol + dir * 3);
      if (canPlaceSolidRun(curFloor, bridgeCol, 3, dir)) {
        putSpanDir(curFloor, bridgeCol, 3, dir, 'solid');
        pushSecretDoor(sideCol, curFloor);
        collectibles.push({
          id: `${key}_seed`,
          col: starCol,
          floor: curFloor,
          type: 'starCore'
        });
        curCol = starCol;
        secretPlaced = true;
      }
    }
  }

  let finishGuard = 0;
  while (curFloor < exitFloor && finishGuard++ < 12) {
    const stepCount = Math.min(2, exitFloor - curFloor);
    const stairStart = wrapCol(curCol + dir);
    if (canPlaceStairFlight(curFloor, stairStart, stepCount, dir, 3)) {
      const res = placeStairFlight(curFloor, stairStart, stepCount, dir, 3);
      curFloor = res.topFloor;
      curCol = res.endCol;
    } else {
      const shaftCol = wrapCol(curCol + dir);
      const rem = exitFloor - curFloor;
      const topStart = wrapCol(shaftCol + dir);
      if (canPlaceVerticalShaft(shaftCol, curFloor, exitFloor)) {
        elevators.push({
          id: `${key}_lift_crown`,
          col: shaftCol,
          minFloor: curFloor,
          maxFloor: exitFloor,
          startFloor: curFloor,
          speed: 1.95
        });
        curCol = putSpanDir(exitFloor, topStart, 3, dir, 'solid');
        curFloor = exitFloor;
      } else {
        const res = stairFlight(ledges, curFloor, stairStart, rem, dir, 3, 'solid');
        curFloor = res.topFloor;
        curCol = res.endCol;
      }
    }
  }

  // Extend Crown Summit Terrace strictly forward in `dir` so incoming staircase behind curCol stays untouched!
  let crownEnd = curCol;
  for (let i = 1; i <= 2; i++) {
    const cNext = wrapCol(curCol + dir * i);
    if (canPlaceSolid(cNext, exitFloor)) {
      putTile(cNext, exitFloor, 'solid');
      crownEnd = cNext;
    } else {
      break;
    }
  }
  const exitCol = curCol;
  doors.push({
    id: `${key}_crown`,
    col: exitCol,
    floor: exitFloor,
    isExit: true
  });
  addGear(crownEnd, exitFloor);

  if (!secretPlaced) {
    const spur1 = wrapCol(crownEnd + dir);
    const spur2 = wrapCol(crownEnd + dir * 2);
    const spur3 = wrapCol(crownEnd + dir * 3);
    if (canPlaceSolidRun(exitFloor, spur1, 3, dir)) {
      putSpanDir(exitFloor, spur1, 3, dir, 'solid');
      pushSecretDoor(spur2, exitFloor);
      collectibles.push({ id: `${key}_seed`, col: spur3, floor: exitFloor, type: 'starCore' });
      secretPlaced = true;
    } else {
      const backDoorCol = wrapCol(exitCol - dir);
      const backStarCol = wrapCol(exitCol - dir * 2);
      pushSecretDoor(backDoorCol, exitFloor);
      collectibles.push({ id: `${key}_seed`, col: backStarCol, floor: exitFloor, type: 'starCore' });
      secretPlaced = true;
    }
  }

  // Expedition boss encounter every 3rd spire!
  if (isExpedition && depth % 3 === 0) {
    addEnemy({
      type: 'siphon_warden',
      col: wrapCol(exitCol - dir) + 0.5,
      floor: exitFloor - 0.2,
      dir: -dir,
      speed: 2.1,
      hp: 3
    });
  }

  // Guarantee >= 1 safe glowing Siphon Supply Crate & >= 4 Hydro-Rings on every procedural spire!
  if (supplyCrateCount === 0) {
    for (let li = 0; li < ledges.length; li++) {
      const l = ledges[li];
      if (!l || l.type !== 'solid' || l.floor < 3 || l.floor >= exitFloor) continue;
      if (!canPlaceSafeBox(l.col, l.floor)) continue;
      const openAdj = [-1, 1].some((dc) => {
        const nc = wrapCol(l.col + dc);
        return walkableMap.has(`${nc}:${l.floor}`) && !barrierSet.has(`${nc}:${l.floor}`);
      });
      if (!openAdj) continue;
      const nearEnemy = enemies.some(
        (en) => Math.abs(en.floor - l.floor) < 1.1 && Math.abs(floatColDist(en.col, l.col + 0.5)) < 1.2
      );
      if (nearEnemy) continue;
      putTile(l.col, l.floor, 'box', { powerUp: pickPowerUp() });
      supplyCrateCount++;
      break;
    }
  }
  if (hydroRings.length < 4) {
    addHydroRing(wrapFloatCol(exitCol - dir * 1.5 + 0.5), exitFloor + 0.65, 'crown_finish');
    addHydroRing(wrapFloatCol(exitCol - dir * 0.5 + 0.5), exitFloor + 0.65, 'crown_finish');
  }

  const timeLimit = Math.min(185, 95 + Math.round((floors - 16) * 4.5));
  const parTime = Math.max(30, Math.round(timeLimit * 0.38));

  let tower = finalizeTower({
    id: depth,
    act: Math.min(5, ((depth - 1) % 5) + 1),
    key,
    casual: isSanctum,
    dailyModifier,
    name,
    subtitle,
    theme,
    floors,
    timeLimit,
    parTime,
    spawn: { col: 0, floor: 0 },
    spawnDir,
    palette,
    mechanics,
    ledges,
    elevators,
    doors,
    switches,
    wallStrips,
    grappleRings,
    hydroRings,
    proceduralChunks: usedChunkTypes,
    collectibles,
    enemies
  });

  // Single-pass state-space BFS verifies exit solvability, secret door reachability, AND candidate spots in < 0.2ms!
  let bfsResult = runTowerReachabilityBfs(tower, {
    enforceSeals: true,
    allowSanctumSolve: true,
    collectAll: true
  });
  const secretDoor = tower.doors.find((d) => d.isRune || d.isVault);
  const secretReachable =
    !secretDoor || bfsResult.reachableCoords.has(`${wrapCol(secretDoor.col)}:${Math.round(secretDoor.floor)}`);

  if (!bfsResult.solvable || !secretReachable) {
    tower = repairProceduralTower(tower, exitCol, exitFloor);
    bfsResult = runTowerReachabilityBfs(tower, {
      enforceSeals: true,
      allowSanctumSolve: true,
      collectAll: true
    });
  }

  // Guarantee >= 2 reachable drainValve wheels on every rising-tide spire (especially Flood Rush!)
  if (tower.mechanics.waterRiseRate > 0) {
    const reachableDrains = tower.switches.filter(
      (sw) => sw.mode === 'drainValve' && bfsResult.reachableCoords.has(`${sw.col}:${sw.floor}`)
    );
    if (reachableDrains.length < 2) {
      const drainSpots = findReachableSolidCandidates(tower, bfsResult.reachableCoords);
      const needed = 2 - reachableDrains.length;
      const fracs = needed === 2 ? [0.32, 0.68] : [0.58];
      const usedDrainIdx = new Set();
      for (const f of fracs) {
        if (!drainSpots.length) break;
        let idx = Math.min(drainSpots.length - 1, Math.floor(drainSpots.length * f));
        while (usedDrainIdx.has(idx) && idx + 1 < drainSpots.length) idx++;
        while (usedDrainIdx.has(idx) && idx - 1 >= 0) idx--;
        if (usedDrainIdx.has(idx)) continue;
        usedDrainIdx.add(idx);
        const sp = drainSpots[idx];
        tower.switches.push({
          id: `${key}_drain_${switchSeq++}`,
          col: wrapCol(sp.col),
          floor: Math.round(sp.floor),
          group: 'drain',
          pipeGroup: null,
          mode: 'drainValve'
        });
      }
    }
  }

  if (isSanctum && missionType) {
    const reachSpots = findReachableSolidCandidates(tower, bfsResult.reachableCoords);
    const pickAtFrac = (frac, usedIdx) => {
      if (!reachSpots.length) return { col: wrapCol(exitCol - dir), floor: exitFloor };
      let idx = Math.min(reachSpots.length - 1, Math.floor(reachSpots.length * frac));
      while (usedIdx.has(idx) && idx + 1 < reachSpots.length) idx++;
      while (usedIdx.has(idx) && idx - 1 >= 0) idx--;
      usedIdx.add(idx);
      return reachSpots[idx];
    };

    const used = new Set();
    if (missionType === 'tower_repair') {
      const partNames = ['Copper Impeller', 'Sea-Glass Lens', 'Redwood Shaft'];
      for (let i = 0; i < 3; i++) {
        const spot = pickAtFrac(0.16 + i * 0.22, used);
        tower.collectibles.push({
          id: `${key}_part_${i + 1}`,
          col: spot.col,
          floor: spot.floor,
          type: 'salvage_part',
          partIndex: i,
          label: partNames[i]
        });
      }
      const wbSpot = pickAtFrac(0.76, used);
      tower.workbench = {
        col: wbSpot.col,
        floor: wbSpot.floor,
        crafted: false,
        label: 'Hydro-Workbench'
      };
      tower.casualMission = {
        type: 'tower_repair',
        title: 'RESTORE THE SLUICE',
        subtitle: 'Gather 3 Hydro-Parts • Craft Sluice Dynamo at Workbench • Open Crown Valve',
        targetCount: 3,
        requiresWorkbench: true
      };
    } else if (missionType === 'treasure_hunt') {
      const keyNames = ['River Key', 'Tide Key', 'Aurora Key'];
      for (let i = 0; i < 3; i++) {
        const spot = pickAtFrac(0.18 + i * 0.24, used);
        tower.collectibles.push({
          id: `${key}_key_${i + 1}`,
          col: spot.col,
          floor: spot.floor,
          type: 'compass_key',
          keyIndex: i,
          label: keyNames[i]
        });
      }
      const chestSpot = pickAtFrac(0.88, used);
      const curioId = CURIO_IDS[(cleanSeed + depth) % CURIO_IDS.length];
      tower.treasureChest = {
        col: chestSpot.col,
        floor: chestSpot.floor,
        opened: false,
        curioId,
        gearReward: 15
      };
      tower.casualMission = {
        type: 'treasure_hunt',
        title: 'SUNKEN RELIQUARY',
        subtitle: 'Find 3 Wayfinder Keys • Unlock the Reliquary Chest Near the Crown',
        targetCount: 3,
        curioId
      };
    } else if (missionType === 'curio_survey') {
      for (let i = 0; i < 4; i++) {
        const spot = pickAtFrac(0.15 + i * 0.22, used);
        const curioId = CURIO_IDS[(cleanSeed + depth + i * 3) % CURIO_IDS.length];
        tower.collectibles.push({
          id: `${key}_curio_${i + 1}`,
          col: spot.col,
          floor: spot.floor,
          type: 'curio',
          curioId
        });
      }
      tower.casualMission = {
        type: 'curio_survey',
        title: 'WATERSHED SURVEY',
        subtitle: 'Catalog 4 Ancient Water Curios Across the Spire',
        targetCount: 4
      };
    } else {
      const spot = pickAtFrac(0.68, used);
      const curioId = CURIO_IDS[(cleanSeed + depth) % CURIO_IDS.length];
      tower.collectibles.push({
        id: `${key}_curio_1`,
        col: spot.col,
        floor: spot.floor,
        type: 'curio',
        curioId
      });
      const hasRune = tower.runeDoors && tower.runeDoors.length > 0;
      tower.casualMission = {
        type: 'puzzle_architect',
        title: 'AQUEDUCT SANCTUM TRIAL',
        subtitle: 'Route Multi-Valve Conduits & Solve the Interior Aqueduct Sanctum',
        targetCount: 1,
        requiresRune: hasRune,
        ...(hasRune ? {} : { requiresVault: Boolean(tower.vaultDoor) })
      };
    }
  }

  return tower;
}

function repairProceduralTower(tower, exitCol, exitFloor) {
  const rDir = tower.spawnDir === -1 ? -1 : 1;
  const repairMap = new Map();
  for (const l of tower.ledges) {
    const isBarrier = isBarrierLedgeType(l.type);
    repairMap.set(isBarrier ? `${l.col}:${l.floor}:${l.type}` : `${l.col}:${l.floor}:step`, {
      ...l,
      ...(isBarrier ? {} : { stairDir: 0, isExplicitStair: false, explicitStairDir: 0 })
    });
  }

  let elevators = [...tower.elevators];
  let wallStrips = [...(tower.wallStrips || [])];
  let switches = [...tower.switches];
  let doors = tower.doors.map((d) => ({ ...d }));

  const dropVerticalAt = (wc) => {
    elevators = elevators.filter((e) => wrapCol(e.col) !== wc);
    wallStrips = wallStrips.filter((w) => wrapCol(w.col) !== wc);
  };

  const placeSolidAt = (col, fl, asStair = false) => {
    const wc = wrapCol(col);
    dropVerticalAt(wc);
    repairMap.delete(`${wc}:${fl}:laserGate`);
    repairMap.delete(`${wc}:${fl}:pillar`);
    repairMap.delete(`${wc}:${fl}:box`);
    repairMap.set(`${wc}:${fl}:step`, {
      col: wc,
      floor: fl,
      type: 'solid',
      switchGroup: null,
      pipeGroup: null,
      inverted: false,
      phasePeriod: 3.2,
      phaseOffset: 0,
      ...(asStair ? { stairDir: rDir, isExplicitStair: true, explicitStairDir: rDir } : {})
    });
  };

  const forceClearAirAt = (col, fl) => {
    const wc = wrapCol(col);
    dropVerticalAt(wc);
    repairMap.delete(`${wc}:${fl}:step`);
    repairMap.delete(`${wc}:${fl}:laserGate`);
    repairMap.delete(`${wc}:${fl}:pillar`);
    repairMap.delete(`${wc}:${fl}:box`);
    switches = switches.filter((sw) => !(wrapCol(sw.col) === wc && Math.round(sw.floor) === fl));
    const victimIds = new Set(
      doors
        .filter((d) => !d.isExit && !d.isRune && !d.isVault && wrapCol(d.col) === wc && Math.round(d.floor) === fl)
        .map((d) => d.id)
    );
    if (victimIds.size > 0) {
      doors = doors.filter((d) => !victimIds.has(d.id) && !victimIds.has(d.targetId));
    }
  };

  // Build a guaranteed 2-column-wide non-overlapping canonical staircase spiral in `rDir` ending at (exitCol, exitFloor)
  const sf = Math.round(tower.spawn.floor);
  const stairPairAt = new Map();
  for (let f = exitFloor; f >= sf; f--) {
    const d = exitFloor - f;
    stairPairAt.set(f, [wrapCol(exitCol - rDir * (2 * d + 1)), wrapCol(exitCol - rDir * (2 * d))]);
  }

  // Ensure safe 5-col spawn quay on sf
  for (let k = -2; k <= 2; k++) {
    placeSolidAt(wrapCol(tower.spawn.col + k), sf, false);
  }
  const [startStairBack] = stairPairAt.get(sf);
  let hc = wrapCol(tower.spawn.col);
  while (hc !== startStairBack) {
    hc = wrapCol(hc + rDir);
    placeSolidAt(hc, sf, false);
  }

  for (let f = sf; f <= exitFloor; f++) {
    const [cBack, cFront] = stairPairAt.get(f);
    placeSolidAt(cBack, f, false);
    placeSolidAt(cFront, f, f < exitFloor);
    if (f < exitFloor) {
      forceClearAirAt(wrapCol(cFront + rDir), f); // No flat bridge
      forceClearAirAt(cBack, f + 1);
      forceClearAirAt(cFront, f + 1); // No ceiling above stair step
    }
  }

  let secretOffset = 1;
  for (const sd of doors) {
    if (!sd.isRune && !sd.isVault) continue;
    const targetSecretCol = wrapCol(exitCol + rDir * (secretOffset + 1));
    for (let s = 1; s <= secretOffset + 2; s++) {
      placeSolidAt(wrapCol(exitCol + rDir * s), exitFloor, false);
    }
    sd.col = targetSecretCol;
    sd.floor = exitFloor;
    delete sd.clueColOffset;
    secretOffset += 2;
  }

  return finalizeTower({
    ...tower,
    spawnDir: rDir,
    elevators,
    wallStrips,
    switches,
    doors,
    ledges: Array.from(repairMap.values())
  });
}

/**
 * Builds 15 Handcrafted Architectural Puzzle Spires across all 5 Earth Water Biomes
 * for `sanctum_trials` (progressive mastery: Multi-Pipe Relays, Dual Floodgate Sluices,
 * Flip-Crab Springboard Vaults, Grapple-Chain Chasms, Counterweight Lifts, Reversible Flumes,
 * Phase Bridges & the Grand Aqueduct Citadel).
 */
export function createSanctumTowers(count = 15) {
  const handcrafted = [];

  const pushSanctum = (spec) => {
    const t = finalizeTower({
      act: Math.min(5, Math.ceil(spec.id / 3)),
      casual: true,
      timeLimit: 180,
      parTime: 65,
      spawn: { col: 0, floor: 0 },
      ...spec
    });
    handcrafted.push(t);
  };

  // SANCTUM 1 (canyon_river): Gorge Sluice Relay — Pipe-Valve Lift + Mosaic Sanctum
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 3, 1, 4, 'solid'); // [5,6,7,8] f=3 (PipeA valve at 7)
    span(L, 8, 10, 4, 'solid'); // [10,11,12,13] f=8 (Mosaic Sanctum at 12)
    stairFlight(L, 8, 14, 3, 1, 5, 'solid'); // [17,18,19,0,1] f=11 Crown
    pushSanctum({
      id: 1, key: 'sanctum_1', theme: 'canyon_river', floors: 14,
      name: 'GORGE SLUICE RELAY', subtitle: 'SANCTUM TRIAL 01 • PIPE-VALVE LIFT',
      ledges: L,
      elevators: [{ id: 'st1_liftA', col: 9, minFloor: 3, maxFloor: 8, startFloor: 3, speed: 1.9, pipeGroup: 'pipeA', powered: false }],
      switches: [{ id: 'st1_pipeA', col: 7, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve' }],
      doors: [
        { id: 'st1_rune', col: 12, floor: 8, isRune: true, puzzleType: 'lights', puzzleSeed: 70101, puzzleDifficulty: 0.25 },
        { id: 'st1_exit', col: 19, floor: 11, isExit: true }
      ],
      collectibles: [
        { id: 'st1_g1', col: 6, floor: 3, type: 'gear' },
        { id: 'st1_curio', col: 11, floor: 8, type: 'curio', curioId: 'curio_astrolabe' },
        { id: 'st1_seed', col: 1, floor: 11, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'PIPE-VALVE RELAY', subtitle: 'Spin Pipe-Valve A • Harmonize Water-Tile Sanctum • Reach Crown', targetCount: 1, requiresRune: true }
    });
  }

  // SANCTUM 2 (canyon_river): Twin-Pipe Aqueduct — Dual PipeA + PipeB Multi-Pipe Relay Lifts
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 4, 'solid'); // [4,5,6,7] f=2 (PipeA valve at 6)
    span(L, 6, 9, 4, 'solid'); // [9,10,11,12] f=6 (PipeB valve at 11)
    span(L, 11, 14, 4, 'solid'); // [14,15,16,17] f=11
    stairFlight(L, 11, 18, 2, 1, 5, 'solid'); // [0,1,2,3,4] f=13 Crown
    pushSanctum({
      id: 2, key: 'sanctum_2', theme: 'canyon_river', floors: 16,
      name: 'TWIN-PIPE AQUEDUCT', subtitle: 'SANCTUM TRIAL 02 • MULTI-PIPE RELAYS',
      ledges: L,
      elevators: [
        { id: 'st2_liftA', col: 8, minFloor: 2, maxFloor: 6, startFloor: 2, speed: 1.9, pipeGroup: 'pipeA', powered: false },
        { id: 'st2_liftB', col: 13, minFloor: 6, maxFloor: 11, startFloor: 6, speed: 1.95, pipeGroup: 'pipeB', powered: false }
      ],
      switches: [
        { id: 'st2_pipeA', col: 6, floor: 2, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve' },
        { id: 'st2_pipeB', col: 11, floor: 6, group: 'pipeB', pipeGroup: 'pipeB', mode: 'pipeValve' }
      ],
      doors: [
        { id: 'st2_vault', col: 16, floor: 11, isVault: true },
        { id: 'st2_exit', col: 2, floor: 13, isExit: true }
      ],
      collectibles: [
        { id: 'st2_p1', col: 5, floor: 2, type: 'salvage_part', partIndex: 0, label: 'Copper Impeller' },
        { id: 'st2_p2', col: 10, floor: 6, type: 'salvage_part', partIndex: 1, label: 'Sea-Glass Lens' },
        { id: 'st2_p3', col: 15, floor: 11, type: 'salvage_part', partIndex: 2, label: 'Redwood Shaft' },
        { id: 'st2_seed', col: 4, floor: 13, type: 'starCore' }
      ],
      workbench: { col: 0, floor: 13, label: 'Hydro-Workbench' },
      casualMission: { type: 'tower_repair', title: 'TWIN-PIPE REPAIR', subtitle: 'Route Pipe A & B • Gather 3 Parts • Craft Sluice Dynamo', targetCount: 3, requiresWorkbench: true }
    });
  }

  // SANCTUM 3 (canyon_river): Redwood Floodgate Basin — Floodgate Sluice Swim + Grapple
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 4, 'solid'); // [4,5,6,7] f=2 (FloodValve at 6 -> clean water to f=2.3)
    span(L, 3, 9, 2, 'solid'); // [9,10] f=3 stepping pad over flood basin
    span(L, 3, 12, 4, 'solid'); // [12,13,14,15] f=3
    stairFlight(L, 3, 16, 4, 1, 4, 'solid'); // [0,1,2,3] f=7
    stairFlight(L, 7, 4, 4, 1, 5, 'solid'); // [8,9,10,11,12] f=11 Crown
    pushSanctum({
      id: 3, key: 'sanctum_3', theme: 'canyon_river', floors: 14,
      name: 'REDWOOD FLOODGATE BASIN', subtitle: 'SANCTUM TRIAL 03 • FLOODGATE SLUICE',
      ledges: L,
      switches: [{ id: 'st3_flood', col: 6, floor: 2, group: 'flood', mode: 'floodValve', targetWaterFloor: 2.35 }],
      grappleRings: [{ id: 'st3_ring1', col: 10.5, floor: 4.1 }],
      doors: [
        { id: 'st3_rune', col: 2, floor: 7, isRune: true, puzzleType: 'bells', puzzleSeed: 70303, puzzleDifficulty: 0.3 },
        { id: 'st3_exit', col: 10, floor: 11, isExit: true }
      ],
      collectibles: [
        { id: 'st3_g1', col: 13, floor: 3, type: 'gear' },
        { id: 'st3_curio', col: 1, floor: 7, type: 'curio', curioId: 'curio_nautilus' },
        { id: 'st3_seed', col: 12, floor: 11, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'FLOODGATE BASIN', subtitle: 'Open Spring Floodgate • Swim or Grapple Basin • Solve Bells Sanctum', targetCount: 1, requiresRune: true }
    });
  }

  // SANCTUM 4 (alpine_lake): Glacier Mirror Bells — Twin Gecko Wall-Scamper Columns
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 3, 'solid'); // [4,5,6] f=2
    span(L, 6, 8, 4, 'solid'); // [8,9,10,11] f=6 (Bells Sanctum at 10)
    span(L, 10, 13, 4, 'solid'); // [13,14,15,16] f=10
    stairFlight(L, 10, 17, 3, 1, 5, 'solid'); // [0,1,2,3,4] f=13 Crown
    pushSanctum({
      id: 4, key: 'sanctum_4', theme: 'alpine_lake', floors: 16,
      name: 'GLACIER MIRROR BELLS', subtitle: 'SANCTUM TRIAL 04 • GECKO CRYSTAL COLUMNS',
      ledges: L,
      wallStrips: [
        { id: 'st4_ws1', col: 7, minFloor: 2, maxFloor: 6 },
        { id: 'st4_ws2', col: 12, minFloor: 6, maxFloor: 10 }
      ],
      doors: [
        { id: 'st4_rune', col: 10, floor: 6, isRune: true, puzzleType: 'bells', puzzleSeed: 70404, puzzleDifficulty: 0.35 },
        { id: 'st4_exit', col: 2, floor: 13, isExit: true }
      ],
      collectibles: [
        { id: 'st4_c1', col: 5, floor: 2, type: 'curio', curioId: 'curio_frost_orchid' },
        { id: 'st4_c2', col: 9, floor: 6, type: 'curio', curioId: 'curio_prism_lens' },
        { id: 'st4_c3', col: 15, floor: 10, type: 'curio', curioId: 'curio_chronometer' },
        { id: 'st4_c4', col: 4, floor: 13, type: 'curio', curioId: 'curio_compass' },
        { id: 'st4_seed', col: 3, floor: 13, type: 'starCore' }
      ],
      casualMission: { type: 'curio_survey', title: 'ALPINE CRYSTAL SURVEY', subtitle: 'Scamper Both Crystal Columns • Catalog 4 Alpine Curios', targetCount: 4 }
    });
  }

  // SANCTUM 5 (alpine_lake): Counterweight Tarn — Synchronized Counterweight Lifts + Prism Sanctum
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 3, 'solid'); // [4,5,6] f=2
    span(L, 7, 8, 4, 'solid'); // [8,9,10,11] f=7
    span(L, 7, 13, 3, 'solid'); // [13,14,15] f=7 (Prism Sanctum at 14)
    span(L, 12, 17, 5, 'solid'); // [17,18,19,0,1] f=12 Crown
    pushSanctum({
      id: 5, key: 'sanctum_5', theme: 'alpine_lake', floors: 15,
      name: 'COUNTERWEIGHT TARN', subtitle: 'SANCTUM TRIAL 05 • COUNTERWEIGHT LIFTS',
      ledges: L,
      elevators: [
        { id: 'st5_cw1', col: 7, minFloor: 2, maxFloor: 7, startFloor: 2, speed: 1.95 },
        { id: 'st5_cw2', col: 12, minFloor: 7, maxFloor: 12, startFloor: 12, speed: 1.95 },
        { id: 'st5_cw3', col: 16, minFloor: 7, maxFloor: 12, startFloor: 7, speed: 2.0 }
      ],
      doors: [
        { id: 'st5_rune', col: 14, floor: 7, isRune: true, puzzleType: 'beam', puzzleSeed: 70505, puzzleDifficulty: 0.35 },
        { id: 'st5_exit', col: 19, floor: 12, isExit: true }
      ],
      collectibles: [
        { id: 'st5_k1', col: 5, floor: 2, type: 'compass_key', keyIndex: 0, label: 'Tarn Key' },
        { id: 'st5_k2', col: 10, floor: 7, type: 'compass_key', keyIndex: 1, label: 'Granite Key' },
        { id: 'st5_k3', col: 15, floor: 7, type: 'compass_key', keyIndex: 2, label: 'Summit Key' },
        { id: 'st5_seed', col: 1, floor: 12, type: 'starCore' }
      ],
      treasureChest: { col: 17, floor: 12, curioId: 'curio_chronometer', gearReward: 15 },
      casualMission: { type: 'treasure_hunt', title: 'COUNTERWEIGHT RELIQUARY', subtitle: 'Ride Counterweight Shafts • Gather 3 Keys • Unlock Reliquary Chest', targetCount: 3 }
    });
  }

  // SANCTUM 6 (alpine_lake): Alpenglow Dual-Sluice — Dual Floodgate Sluices + Pipe Valve
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 4, 'solid'); // [4,5,6,7] f=2 (FloodValve 1 -> f=2.3)
    span(L, 3, 9, 2, 'solid');
    span(L, 3, 12, 4, 'solid'); // [12,13,14,15] f=3 (PipeA Valve at 14)
    span(L, 8, 17, 4, 'solid'); // [17,18,19,0] f=8 (FloodValve 2 -> f=8.3)
    span(L, 9, 2, 2, 'solid');
    stairFlight(L, 9, 4, 4, 1, 5, 'solid'); // [8,9,10,11,12] f=13 Crown
    pushSanctum({
      id: 6, key: 'sanctum_6', theme: 'alpine_lake', floors: 16,
      name: 'ALPENGLOW DUAL-SLUICE', subtitle: 'SANCTUM TRIAL 06 • DUAL FLOODGATE SLUICES',
      ledges: L,
      elevators: [{ id: 'st6_liftA', col: 16, minFloor: 3, maxFloor: 8, startFloor: 3, speed: 1.9, pipeGroup: 'pipeA', powered: false }],
      switches: [
        { id: 'st6_flood1', col: 6, floor: 2, group: 'flood', mode: 'floodValve', targetWaterFloor: 2.3 },
        { id: 'st6_pipeA', col: 14, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve' },
        { id: 'st6_flood2', col: 19, floor: 8, group: 'flood', mode: 'floodValve', targetWaterFloor: 8.3 }
      ],
      doors: [
        { id: 'st6_vault', col: 18, floor: 8, isVault: true },
        { id: 'st6_exit', col: 10, floor: 13, isExit: true }
      ],
      collectibles: [
        { id: 'st6_g1', col: 13, floor: 3, type: 'gear' },
        { id: 'st6_g2', col: 0, floor: 8, type: 'gear' },
        { id: 'st6_seed', col: 12, floor: 13, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'DUAL FLOODGATE MASTER', subtitle: 'Raise Both Glacial Floodgates • Crack Core Vault • Reach Crown', targetCount: 1, requiresVault: true, requiresRune: false }
    });
  }

  // SANCTUM 7 (mist_bayou): Cypress Current Switch — Reversible Flume Conveyors + Sluice Blocks
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 4, 'solid'); // [4,5,6,7] f=2 (Conveyor flip at 6)
    span(L, 3, 8, 4, 'conveyorL'); // [8,9,10,11] f=3
    span(L, 4, 12, 4, 'solid'); // [12,13,14,15] f=4 (Red switch at 14)
    span(L, 5, 16, 3, 'phaseBlock', { switchGroup: 'red', inverted: false });
    stairFlight(L, 5, 19, 4, 1, 5, 'solid'); // [3,4,5,6,7] f=9 (Blocks Sanctum at 5)
    stairFlight(L, 9, 8, 4, 1, 5, 'solid'); // [12,13,14,15,16] f=13 Crown
    pushSanctum({
      id: 7, key: 'sanctum_7', theme: 'mist_bayou', floors: 16,
      name: 'CYPRESS CURRENT SWITCH', subtitle: 'SANCTUM TRIAL 07 • REVERSIBLE FLUMES',
      ledges: L,
      switches: [
        { id: 'st7_conv', col: 6, floor: 2, group: 'conv', mode: 'conveyorFlip' },
        { id: 'st7_red', col: 14, floor: 4, group: 'red', mode: 'toggle' }
      ],
      doors: [
        { id: 'st7_rune', col: 5, floor: 9, isRune: true, puzzleType: 'blocks', puzzleSeed: 70707, puzzleDifficulty: 0.4 },
        { id: 'st7_exit', col: 14, floor: 13, isExit: true }
      ],
      collectibles: [
        { id: 'st7_g1', col: 13, floor: 4, type: 'gear' },
        { id: 'st7_curio', col: 6, floor: 9, type: 'curio', curioId: 'curio_automaton_heart' },
        { id: 'st7_seed', col: 16, floor: 13, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'CURRENT ARCHITECT', subtitle: 'Reverse Bayou Flumes • Unlock Phase Bridge • Solve Sluice Blocks', targetCount: 1, requiresRune: true }
    });
  }

  // SANCTUM 8 (mist_bayou): Firefly Grapple Crossing — Triple Grapple-Chain Chasms
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 3, 1, 3, 'solid'); // [5,6,7] f=3
    // Grapple Chain 1 across 8..10 (safe stepping pad at 9, f=3)
    span(L, 3, 9, 1, 'solid');
    span(L, 4, 11, 3, 'solid'); // [11,12,13] f=4
    // Grapple Chain 2 across 14..16 (safe pad at 15, f=5)
    span(L, 5, 15, 1, 'solid');
    span(L, 6, 17, 4, 'solid'); // [17,18,19,0] f=6
    // Gecko strip col 1 (f=6..10)
    span(L, 10, 2, 4, 'solid'); // [2,3,4,5] f=10
    // Grapple Chain 3 across 6..8 (safe pad at 7, f=11)
    span(L, 11, 7, 1, 'solid');
    span(L, 12, 9, 5, 'solid'); // [9,10,11,12,13] f=12 Crown
    pushSanctum({
      id: 8, key: 'sanctum_8', theme: 'mist_bayou', floors: 15,
      name: 'FIREFLY GRAPPLE CROSSING', subtitle: 'SANCTUM TRIAL 08 • GRAPPLE-CHAIN CHASMS',
      ledges: L,
      wallStrips: [{ id: 'st8_ws1', col: 1, minFloor: 6, maxFloor: 10 }],
      grappleRings: [
        { id: 'st8_r1', col: 9.0, floor: 4.1 },
        { id: 'st8_r2', col: 15.0, floor: 6.1 },
        { id: 'st8_r3', col: 7.0, floor: 12.1 }
      ],
      doors: [
        { id: 'st8_rune', col: 4, floor: 10, isRune: true, puzzleType: 'pipes', puzzleSeed: 70808, puzzleDifficulty: 0.45 },
        { id: 'st8_exit', col: 11, floor: 12, isExit: true }
      ],
      collectibles: [
        { id: 'st8_g1', col: 12, floor: 4, type: 'gear' },
        { id: 'st8_g2', col: 19, floor: 6, type: 'gear' },
        { id: 'st8_seed', col: 13, floor: 12, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'GRAPPLE-CHAIN CHASMS', subtitle: 'Swing All 3 Firefly Grapple Rings • Harmonize Temple Sanctum', targetCount: 1, requiresRune: true }
    });
  }

  // SANCTUM 9 (mist_bayou): Bayou Springboard Vault — Flip-Crab Springboard Vault (Harmless Training Crabs!)
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 5, 'solid'); // [4,5,6,7,8] f=2 (Harmless Flip-Crab Springboard #1!)
    tile(L, 8, 2, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.0 }); // Fallback geyser + crab bounce to f=5!
    span(L, 5, 9, 5, 'solid'); // [9,10,11,12,13] f=5 (Harmless Flip-Crab Springboard #2!)
    tile(L, 13, 5, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.4 });
    span(L, 8, 14, 5, 'solid'); // [14,15,16,17,18] f=8 (Core Vault at 16!)
    stairFlight(L, 8, 19, 4, 1, 5, 'solid'); // [3,4,5,6,7] f=12 Crown
    pushSanctum({
      id: 9, key: 'sanctum_9', theme: 'mist_bayou', floors: 15,
      name: 'BAYOU SPRINGBOARD VAULT', subtitle: 'SANCTUM TRIAL 09 • FLIP-CRAB SPRINGBOARDS',
      ledges: L,
      doors: [
        { id: 'st9_vault', col: 16, floor: 8, isVault: true },
        { id: 'st9_exit', col: 5, floor: 12, isExit: true }
      ],
      enemies: [
        { type: 'snap_crab', col: 6.5, floor: 2, dir: 1, speed: 1.1, harmless: true },
        { type: 'snap_crab', col: 11.5, floor: 5, dir: -1, speed: 1.1, harmless: true }
      ],
      collectibles: [
        { id: 'st9_g1', col: 5, floor: 2, type: 'gear' },
        { id: 'st9_g2', col: 10, floor: 5, type: 'gear' },
        { id: 'st9_seed', col: 7, floor: 12, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'FLIP-CRAB VAULT', subtitle: 'Tail-Whip Training Crabs into Springboards • Vault to Core Chamber', targetCount: 1, requiresVault: true, requiresRune: false }
    });
  }

  // SANCTUM 10 (coral_sea): Lagoon Prism Arch — Dual Red/Cyan Phase Bridges + Crystal Prism Sanctum
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 3, 1, 4, 'solid'); // [5,6,7,8] f=3 (Red Switch at 7)
    span(L, 4, 9, 3, 'phaseBlock', { switchGroup: 'red', inverted: false });
    span(L, 4, 12, 4, 'solid'); // [12,13,14,15] f=4 (Cyan Switch at 14)
    span(L, 5, 16, 3, 'phaseBlock', { switchGroup: 'cyan', inverted: false });
    stairFlight(L, 5, 19, 4, 1, 5, 'solid'); // [3,4,5,6,7] f=9 (Prism Sanctum at 5)
    stairFlight(L, 9, 8, 4, 1, 5, 'solid'); // [12,13,14,15,16] f=13 Crown
    pushSanctum({
      id: 10, key: 'sanctum_10', theme: 'coral_sea', floors: 16,
      name: 'LAGOON PRISM ARCH', subtitle: 'SANCTUM TRIAL 10 • DUAL-PHASE BRIDGES',
      ledges: L,
      switches: [
        { id: 'st10_red', col: 7, floor: 3, group: 'red', mode: 'toggle' },
        { id: 'st10_cyan', col: 14, floor: 4, group: 'cyan', mode: 'toggle' }
      ],
      doors: [
        { id: 'st10_rune', col: 5, floor: 9, isRune: true, puzzleType: 'beam', puzzleSeed: 71010, puzzleDifficulty: 0.5 },
        { id: 'st10_exit', col: 14, floor: 13, isExit: true }
      ],
      collectibles: [
        { id: 'st10_p1', col: 6, floor: 3, type: 'salvage_part', partIndex: 0, label: 'Coral Impeller' },
        { id: 'st10_p2', col: 13, floor: 4, type: 'salvage_part', partIndex: 1, label: 'Lagoon Prism' },
        { id: 'st10_p3', col: 7, floor: 9, type: 'salvage_part', partIndex: 2, label: 'Pearl Shaft' },
        { id: 'st10_seed', col: 16, floor: 13, type: 'starCore' }
      ],
      workbench: { col: 12, floor: 13, label: 'Reef Workbench' },
      casualMission: { type: 'tower_repair', title: 'PRISM ARCH RESTORATION', subtitle: 'Activate Red & Cyan Bridges • Craft Reef Dynamo • Open Crown', targetCount: 3, requiresWorkbench: true }
    });
  }

  // SANCTUM 11 (coral_sea): Reef Grapple-Chain — High-Altitude Coral Swings + Conduit Warp
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 3, 1, 3, 'solid'); // [5,6,7] f=3
    span(L, 4, 9, 1, 'solid');
    span(L, 5, 11, 4, 'solid'); // [11,12,13,14] f=5 (Conduit A at 13 -> Conduit B at 18, f=10)
    span(L, 10, 17, 4, 'solid'); // [17,18,19,0] f=10
    span(L, 11, 2, 1, 'solid');
    span(L, 12, 4, 4, 'solid'); // [4,5,6,7] f=12
    stairFlight(L, 12, 8, 3, 1, 5, 'solid'); // [11,12,13,14,15] f=15 Crown
    pushSanctum({
      id: 11, key: 'sanctum_11', theme: 'coral_sea', floors: 18,
      name: 'REEF GRAPPLE-CHAIN', subtitle: 'SANCTUM TRIAL 11 • ATOLL SWING RINGS',
      ledges: L,
      grappleRings: [
        { id: 'st11_r1', col: 9.0, floor: 4.8 },
        { id: 'st11_r2', col: 2.0, floor: 11.8 }
      ],
      doors: [
        { id: 'st11_c1a', col: 13, floor: 5, targetId: 'st11_c1b', tunnelStyle: 'sparkArch' },
        { id: 'st11_c1b', col: 18, floor: 10, targetId: 'st11_c1a', tunnelStyle: 'sparkArch' },
        { id: 'st11_vault', col: 6, floor: 12, isVault: true },
        { id: 'st11_exit', col: 13, floor: 15, isExit: true }
      ],
      collectibles: [
        { id: 'st11_k1', col: 12, floor: 5, type: 'compass_key', keyIndex: 0, label: 'Coral Key' },
        { id: 'st11_k2', col: 19, floor: 10, type: 'compass_key', keyIndex: 1, label: 'Atoll Key' },
        { id: 'st11_k3', col: 5, floor: 12, type: 'compass_key', keyIndex: 2, label: 'Lagoon Key' },
        { id: 'st11_seed', col: 15, floor: 15, type: 'starCore' }
      ],
      treasureChest: { col: 11, floor: 15, curioId: 'curio_nautilus', gearReward: 15 },
      casualMission: { type: 'treasure_hunt', title: 'ATOLL RELIQUARY', subtitle: 'Chain Grapple Swings & Spark Conduits • Unlock Reef Chest', targetCount: 3 }
    });
  }

  // SANCTUM 12 (coral_sea): Coral Counterweight Lock — Dual Pipe-Valves + Dual Counterweight Lifts
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 4, 'solid'); // [4,5,6,7] f=2 (PipeA valve at 6)
    span(L, 7, 9, 4, 'solid'); // [9,10,11,12] f=7 (PipeB valve at 11)
    span(L, 12, 14, 4, 'solid'); // [14,15,16,17] f=12 (Tide-Locks Sanctum at 16)
    span(L, 16, 19, 5, 'solid'); // [19,0,1,2,3] f=16 Crown
    pushSanctum({
      id: 12, key: 'sanctum_12', theme: 'coral_sea', floors: 19,
      name: 'CORAL COUNTERWEIGHT LOCK', subtitle: 'SANCTUM TRIAL 12 • DUAL PIPE COUNTERWEIGHTS',
      ledges: L,
      elevators: [
        { id: 'st12_lA', col: 8, minFloor: 2, maxFloor: 7, startFloor: 2, speed: 1.95, pipeGroup: 'pipeA', powered: false },
        { id: 'st12_lB', col: 13, minFloor: 7, maxFloor: 12, startFloor: 7, speed: 2.0, pipeGroup: 'pipeB', powered: false },
        { id: 'st12_lC', col: 18, minFloor: 12, maxFloor: 16, startFloor: 16, speed: 2.0 }
      ],
      switches: [
        { id: 'st12_pA', col: 6, floor: 2, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve' },
        { id: 'st12_pB', col: 11, floor: 7, group: 'pipeB', pipeGroup: 'pipeB', mode: 'pipeValve' }
      ],
      doors: [
        { id: 'st12_rune', col: 16, floor: 12, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 71212, puzzleDifficulty: 0.55 },
        { id: 'st12_exit', col: 1, floor: 16, isExit: true }
      ],
      collectibles: [
        { id: 'st12_g1', col: 10, floor: 7, type: 'gear' },
        { id: 'st12_g2', col: 15, floor: 12, type: 'gear' },
        { id: 'st12_seed', col: 3, floor: 16, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'CORAL LOCKS', subtitle: 'Pressurize Pipe A & B • Harmonize Coral Tide-Locks Sanctum', targetCount: 1, requiresRune: true }
    });
  }

  // SANCTUM 13 (storm_ocean): Tempest Springboard Spire — Flip-Crab Vault + Geyser Updrafts
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 5, 'solid'); // [4,5,6,7,8] f=2 (Training crab #1 + geyser)
    tile(L, 8, 2, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.0 });
    span(L, 5, 9, 5, 'solid'); // [9,10,11,12,13] f=5 (Gecko Strip at 14 f=5..9)
    span(L, 9, 15, 5, 'solid'); // [15,16,17,18,19] f=9 (Training crab #2 + geyser)
    tile(L, 19, 9, 'steamVent', { phasePeriod: 3.0, phaseOffset: 0.3 });
    span(L, 12, 0, 5, 'solid'); // [0,1,2,3,4] f=12 (Blocks Sanctum at 2)
    stairFlight(L, 12, 5, 4, 1, 5, 'solid'); // [9,10,11,12,13] f=16 Crown
    pushSanctum({
      id: 13, key: 'sanctum_13', theme: 'storm_ocean', floors: 19,
      name: 'TEMPEST SPRINGBOARD SPIRE', subtitle: 'SANCTUM TRIAL 13 • CARAPACE & GEYSER VAULT',
      ledges: L,
      wallStrips: [{ id: 'st13_ws1', col: 14, minFloor: 5, maxFloor: 9 }],
      doors: [
        { id: 'st13_rune', col: 2, floor: 12, isRune: true, puzzleType: 'blocks', puzzleSeed: 71313, puzzleDifficulty: 0.6 },
        { id: 'st13_exit', col: 11, floor: 16, isExit: true }
      ],
      enemies: [
        { type: 'snap_crab', col: 6.5, floor: 2, dir: 1, speed: 1.2, harmless: true },
        { type: 'snap_crab', col: 17.5, floor: 9, dir: -1, speed: 1.2, harmless: true }
      ],
      collectibles: [
        { id: 'st13_c1', col: 5, floor: 2, type: 'curio', curioId: 'curio_thunder_glass' },
        { id: 'st13_c2', col: 11, floor: 5, type: 'curio', curioId: 'curio_frost_orchid' },
        { id: 'st13_c3', col: 4, floor: 12, type: 'curio', curioId: 'curio_astrolabe' },
        { id: 'st13_c4', col: 13, floor: 16, type: 'curio', curioId: 'curio_prism_lens' },
        { id: 'st13_seed', col: 12, floor: 16, type: 'starCore' }
      ],
      casualMission: { type: 'curio_survey', title: 'TEMPEST SPRINGBOARD SURVEY', subtitle: 'Bounce Across Carapace Vaults • Catalog 4 Polar Curios', targetCount: 4 }
    });
  }

  // SANCTUM 14 (storm_ocean): Aurora Phase Labyrinth — Dual-Polarity Sluice Gates + Wall-Scamper
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 3, 1, 4, 'solid'); // [5,6,7,8] f=3 (Red Switch at 7)
    span(L, 4, 9, 2, 'phaseBlock', { switchGroup: 'red', inverted: false });
    span(L, 4, 11, 4, 'solid'); // [11,12,13,14] f=4 (PipeA valve at 13)
    span(L, 9, 16, 4, 'solid'); // [16,17,18,19] f=9 (Cyan Switch at 18)
    span(L, 10, 0, 3, 'phaseBlock', { switchGroup: 'cyan', inverted: false });
    span(L, 10, 3, 4, 'solid'); // [3,4,5,6] f=10 (Mosaic Sanctum at 5)
    // Gecko Strip col 7 (f=10..14)
    span(L, 14, 8, 4, 'solid'); // [8,9,10,11] f=14
    stairFlight(L, 14, 12, 3, 1, 5, 'solid'); // [15,16,17,18,19] f=17 Crown
    pushSanctum({
      id: 14, key: 'sanctum_14', theme: 'storm_ocean', floors: 20,
      name: 'AURORA PHASE LABYRINTH', subtitle: 'SANCTUM TRIAL 14 • POLARITY PHASE MAZE',
      ledges: L,
      elevators: [{ id: 'st14_lA', col: 15, minFloor: 4, maxFloor: 9, startFloor: 4, speed: 2.0, pipeGroup: 'pipeA', powered: false }],
      wallStrips: [{ id: 'st14_ws1', col: 7, minFloor: 10, maxFloor: 14 }],
      switches: [
        { id: 'st14_red', col: 7, floor: 3, group: 'red', mode: 'toggle' },
        { id: 'st14_pipeA', col: 13, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve' },
        { id: 'st14_cyan', col: 18, floor: 9, group: 'cyan', mode: 'toggle' }
      ],
      doors: [
        { id: 'st14_rune', col: 5, floor: 10, isRune: true, puzzleType: 'pipes', puzzleSeed: 71414, puzzleDifficulty: 0.65 },
        { id: 'st14_exit', col: 17, floor: 17, isExit: true }
      ],
      collectibles: [
        { id: 'st14_g1', col: 12, floor: 4, type: 'gear' },
        { id: 'st14_g2', col: 10, floor: 14, type: 'gear' },
        { id: 'st14_seed', col: 19, floor: 17, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'AURORA LABYRINTH', subtitle: 'Master Red/Cyan Bridges & Pipe Lifts • Harmonize Polar Mosaic', targetCount: 1, requiresRune: true }
    });
  }

  // SANCTUM 15 (storm_ocean): Grand Aqueduct Citadel — Master Finale Combining EVERY Puzzle Mechanic!
  {
    const L = [];
    span(L, 0, 18, 4, 'solid');
    stairFlight(L, 0, 2, 2, 1, 4, 'solid'); // [4,5,6,7] f=2 (FloodValve at 6 -> f=2.35)
    span(L, 3, 9, 1, 'solid'); // Stepping stone + Grapple Ring 1 across 8..10
    span(L, 3, 11, 4, 'solid'); // [11,12,13,14] f=3 (PipeA valve at 13)
    span(L, 8, 16, 4, 'solid'); // [16,17,18,19] f=8 (Red Switch at 18, Mosaic Sanctum at 17)
    span(L, 9, 0, 2, 'phaseBlock', { switchGroup: 'red', inverted: false });
    span(L, 9, 2, 4, 'solid'); // [2,3,4,5] f=9 (PipeB valve at 4)
    span(L, 14, 7, 4, 'solid'); // [7,8,9,10] f=14 (Prism Sanctum at 9, Gecko strip col 11 f=14..18)
    span(L, 18, 12, 4, 'solid'); // [12,13,14,15] f=18 (Core Vault at 14)
    stairFlight(L, 18, 16, 3, 1, 6, 'solid'); // [19,0,1,2,3,4] f=21 Grand Crown Citadel!
    pushSanctum({
      id: 15, key: 'sanctum_15', theme: 'storm_ocean', floors: 24,
      name: 'GRAND AQUEDUCT CITADEL', subtitle: 'SANCTUM TRIAL 15 • MASTER ARCHITECT FINALE',
      ledges: L,
      elevators: [
        { id: 'st15_lA', col: 15, minFloor: 3, maxFloor: 8, startFloor: 3, speed: 2.0, pipeGroup: 'pipeA', powered: false },
        { id: 'st15_lB', col: 6, minFloor: 9, maxFloor: 14, startFloor: 9, speed: 2.05, pipeGroup: 'pipeB', powered: false }
      ],
      wallStrips: [{ id: 'st15_ws1', col: 11, minFloor: 14, maxFloor: 18 }],
      grappleRings: [{ id: 'st15_r1', col: 9.0, floor: 4.1 }],
      switches: [
        { id: 'st15_flood', col: 6, floor: 2, group: 'flood', mode: 'floodValve', targetWaterFloor: 2.35 },
        { id: 'st15_pA', col: 13, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve' },
        { id: 'st15_red', col: 18, floor: 8, group: 'red', mode: 'toggle' },
        { id: 'st15_pB', col: 4, floor: 9, group: 'pipeB', pipeGroup: 'pipeB', mode: 'pipeValve' }
      ],
      doors: [
        { id: 'st15_rune1', col: 17, floor: 8, isRune: true, puzzleType: 'lights', puzzleSeed: 71501, puzzleDifficulty: 0.65 },
        { id: 'st15_rune2', col: 9, floor: 14, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 71502, puzzleDifficulty: 0.7 },
        { id: 'st15_vault', col: 14, floor: 18, isVault: true },
        { id: 'st15_exit', col: 2, floor: 21, isExit: true }
      ],
      collectibles: [
        { id: 'st15_g1', col: 12, floor: 3, type: 'gear' },
        { id: 'st15_g2', col: 3, floor: 9, type: 'gear' },
        { id: 'st15_g3', col: 13, floor: 18, type: 'gear' },
        { id: 'st15_seed', col: 4, floor: 21, type: 'starCore' }
      ],
      casualMission: { type: 'puzzle_architect', title: 'GRAND AQUEDUCT CITADEL', subtitle: 'Master Every Mechanism • Solve Both Sanctums & Core Vault • Crown the Citadel', targetCount: 2, requiresRune: true }
    });
  }

  return handcrafted.slice(0, Math.max(1, Math.min(handcrafted.length, Number(count) || 15)));
}

/**
 * Builds 5 Handcrafted Boss Arena Spires across Earth's 5 Water Biomes for
 * `'warden_gauntlet'` (5-Act Siphon Warden Boss Rush Mode)!
 */
export function createWardenGauntletTowers() {
  const specs = [
    {
      act: 1, theme: 'canyon_river', name: 'ACT I • REDWOOD DREDGE-LORD',
      subtitle: 'WARDEN GAUNTLET 1/5 • CANYON ARENA', bossTitle: 'REDWOOD DREDGE-LORD',
      hp: 4, speed: 1.85, windForce: 0, lightningInterval: 0
    },
    {
      act: 2, theme: 'alpine_lake', name: 'ACT II • GLACIER CRYO-WARDEN',
      subtitle: 'WARDEN GAUNTLET 2/5 • ALPINE ARENA', bossTitle: 'GLACIER CRYO-WARDEN',
      hp: 4, speed: 1.98, windForce: 0.28, lightningInterval: 0
    },
    {
      act: 3, theme: 'mist_bayou', name: 'ACT III • BAYOU MIRE-HYDRA',
      subtitle: 'WARDEN GAUNTLET 3/5 • BAYOU ARENA', bossTitle: 'BAYOU MIRE-HYDRA',
      hp: 5, speed: 2.10, windForce: 0, lightningInterval: 9.0
    },
    {
      act: 4, theme: 'coral_sea', name: 'ACT IV • CORAL REEF TYRANT',
      subtitle: 'WARDEN GAUNTLET 4/5 • CORAL ARENA', bossTitle: 'CORAL REEF TYRANT',
      hp: 5, speed: 2.22, windForce: 0.25, lightningInterval: 0
    },
    {
      act: 5, theme: 'storm_ocean', name: 'ACT V • MOTHER SIPHON PRIME',
      subtitle: 'WARDEN GAUNTLET 5/5 • APEX LEVIATHAN', bossTitle: 'MOTHER SIPHON PRIME',
      hp: 6, speed: 2.35, windForce: 0.36, lightningInterval: 6.8
    }
  ];

  return specs.map((sp) => {
    const L = [];
    // Lower combat ring segments (f=1, clear beneath cols 3..4 & 13..14 grand stairways!) + twin stairways to f=4 + geysers & grapple rings!
    span(L, 1, 15, 8, 'solid'); // [15,16,17,18,19,0,1,2]
    span(L, 1, 5, 8, 'solid');  // [5,6,7,8,9,10,11,12]
    tile(L, 5, 1, 'steamVent', { phasePeriod: 3.2, phaseOffset: 0.0 });
    tile(L, 15, 1, 'steamVent', { phasePeriod: 3.2, phaseOffset: 1.6 });
    stairFlight(L, 1, 2, 3, 1, 5, 'solid');  // Upper Deck A [5,6,7,8,9] at f=4
    stairFlight(L, 1, 12, 3, 1, 5, 'solid'); // Upper Deck B [15,16,17,18,19] at f=4
    // Summit Victory Crown Shrine at f=7 (connected by lifts at col 10 & col 0)
    span(L, 7, 17, 6, 'solid'); // [17,18,19,0,1,2] f=7

    return finalizeTower({
      id: sp.act,
      act: sp.act,
      key: `gauntlet_act_${sp.act}`,
      name: sp.name,
      subtitle: sp.subtitle,
      theme: sp.theme,
      floors: 10,
      timeLimit: 95,
      parTime: 40,
      spawn: { col: 0, floor: 1 },
      mechanics: {
        windForce: sp.windForce,
        windPeriod: 6.4,
        lightningInterval: sp.lightningInterval
      },
      ledges: L,
      elevators: [
        { id: `wg${sp.act}_l1`, col: 10, minFloor: 1, maxFloor: 4, startFloor: 1, speed: 2.1 },
        { id: `wg${sp.act}_l2`, col: 0, minFloor: 4, maxFloor: 7, startFloor: 4, speed: 2.1 }
      ],
      grappleRings: [
        { id: `wg${sp.act}_r1`, col: 11.5, floor: 5.2 },
        { id: `wg${sp.act}_r2`, col: 1.5, floor: 5.2 }
      ],
      doors: [
        { id: `wg${sp.act}_crown`, col: 19, floor: 7, isExit: true }
      ],
      switches: [],
      collectibles: [
        { id: `wg${sp.act}_g1`, col: 7, floor: 4, type: 'gear' },
        { id: `wg${sp.act}_g2`, col: 17, floor: 4, type: 'gear' },
        { id: `wg${sp.act}_seed`, col: 1, floor: 7, type: 'starCore' }
      ],
      enemies: [
        { type: 'snap_crab', col: 7.5, floor: 4, dir: 1, speed: 1.6 },
        { type: 'siphon_warden', col: 10.5, floor: 4.2, dir: -1, speed: sp.speed, hp: sp.hp, maxHp: sp.hp, bossTitle: sp.bossTitle }
      ]
    });
  });
}

/**
 * Builds today's deterministic 22-floor UTC Daily Tide Spire + Daily Tide Modifier.
 * @param {Date|number|string} [date=new Date()]
 */
export function createDailyTower(date = new Date()) {
  const { seed, dateKey } = getDailySeed(date);
  const mod = DAILY_TIDE_MODIFIERS[seed % DAILY_TIDE_MODIFIERS.length];
  const theme = BIOME_THEMES[(seed >>> 3) % BIOME_THEMES.length];
  return generateProceduralTower({
    seed,
    index: 1,
    difficulty: 2.4,
    modeHint: 'daily_tide',
    themeOverride: theme,
    dailyModifier: mod,
    keyOverride: `daily_${seed}`,
    nameOverride: `DAILY TIDE SPIRE ${dateKey}`,
    subtitleOverride: `UTC DAILY TIDE • ${mod.badge} • ${dateKey}`,
    floorsOverride: 22
  });
}
