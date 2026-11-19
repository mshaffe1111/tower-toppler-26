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
      ...(extra.h !== undefined ? { h: extra.h } : {})
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
    ...(extra.h !== undefined ? { h: extra.h } : {})
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
  // Base landing lead-in (2 cols: startCol - stepSign, startCol)
  tile(ledges, startCol - stepSign, startFloor, type);
  tile(ledges, startCol, startFloor, type, { stairDir: stepSign });

  for (let s = 1; s < steps; s++) {
    tile(ledges, startCol + stepSign * s, startFloor + s, type, { stairDir: stepSign });
  }

  // Top landing terrace starting at startCol + stepSign * steps on floor startFloor + steps
  const topAnchor = startCol + stepSign * steps;
  const terraceStart = stepSign === 1 ? topAnchor : topAnchor - (topLandingLen - 1);
  span(ledges, startFloor + steps, terraceStart, topLandingLen, type);
  return {
    topFloor: startFloor + steps,
    endCol: wrapCol(topAnchor + stepSign * (topLandingLen - 1)),
    midCol: wrapCol(topAnchor + stepSign * Math.floor(topLandingLen / 2))
  };
}

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
  return {
    type: canonical,
    col: ((Number(en.col) % COLS) + COLS) % COLS,
    floor: Number(en.floor),
    dir: en.dir === -1 ? -1 : 1,
    speed: Number(en.speed ?? (canonical === 'barnacle_mortar' ? 0 : canonical === 'siphon_warden' ? 2.1 : 1.65)),
    amp: Number(en.amp ?? defaultAmp),
    axis: en.axis || (en.type === 'robotV' || canonical === 'vent_stalker' ? 'v' : 'h'),
    hp: Number(en.hp ?? (canonical === 'siphon_warden' ? 3 : 1)),
    maxHp: Number(en.maxHp ?? en.hp ?? (canonical === 'siphon_warden' ? 3 : 1)),
    firePeriod: Number(en.firePeriod ?? 3.4),
    phaseOffset: Number(en.phaseOffset ?? (idx * 1.17) % 6.28),
    minFloor: en.minFloor !== undefined && en.minFloor !== null ? Number(en.minFloor) : null,
    maxFloor: en.maxFloor !== undefined && en.maxFloor !== null ? Number(en.maxFloor) : null,
    ...(en.harmless ? { harmless: true } : {}),
    ...(en.bossTitle ? { bossTitle: String(en.bossTitle) } : {}),
    ...(en.isLockKeeper ? { isLockKeeper: true } : {}),
    ...(en.sealId ? { sealId: String(en.sealId) } : {}),
    ...(en.minCol !== undefined ? { minCol: wrapCol(en.minCol) } : {}),
    ...(en.maxCol !== undefined ? { maxCol: wrapCol(en.maxCol) } : {})
  };
}

function computeLedgeSpanAt(ledges, col, floor) {
  const hasTile = (c) => {
    const wc = wrapCol(c);
    const blocked = ledges.some(
      (b) =>
        (b.type === 'box' || b.type === 'pillar' || b.type === 'laserGate') &&
        wrapCol(b.col) === wc &&
        (b.h ? b.floor < floor + 1.2 && b.floor + b.h > floor + 0.15 : Math.abs(b.floor - floor) < 0.5)
    );
    if (blocked) return false;
    return ledges.some(
      (l) =>
        l.type !== 'box' &&
        l.type !== 'pillar' &&
        l.type !== 'laserGate' &&
        l.type !== 'phaseBlock' &&
        Math.abs(l.floor - floor) < 0.25 &&
        wrapCol(l.col) === wc
    );
  };
  const startTile = Math.floor(wrapFloatCol(col));
  if (!hasTile(startTile)) {
    return { onRealTile: false, startCol: startTile, length: 0 };
  }
  let leftSteps = 0;
  while (leftSteps < COLS - 1 && hasTile(startTile - leftSteps - 1)) leftSteps++;
  let rightSteps = 0;
  while (rightSteps < COLS - 1 - leftSteps && hasTile(startTile + rightSteps + 1)) rightSteps++;
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
      // Keep Siphon Warden at a fair initial angular offset from spawn/exit door
      const exitD = doors.find((d) => d.isExit);
      if (exitD && Math.abs(en.floor - exitD.floor) < 1.5 && Math.abs(colDist(en.col, exitD.col + 0.5)) < 4.5) {
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

    const bestColForFloor = (testFloor) => {
      const rel = relevantForFloor(testFloor);
      if (rel.length === 0) return { col: en.col, minDist: Infinity };
      const curMin = rel.reduce((m, a) => Math.min(m, Math.abs(colDist(en.col, a.col))), Infinity);
      if (curMin >= 3.2) return { col: en.col, minDist: curMin };

      let bestCol = en.col;
      let bestMin = curMin;
      for (let step = 0; step < 40; step++) {
        const cand = (((en.col + 4 + step * 0.5) % COLS) + COLS) % COLS;
        const dMin = rel.reduce((m, a) => Math.min(m, Math.abs(colDist(cand, a.col))), Infinity);
        if (dMin > bestMin + 1e-6) {
          bestMin = dMin;
          bestCol = cand;
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
  const blockedOverhead = new Set();

  for (const el of normElevators) {
    for (let f = Math.round(el.minFloor); f <= Math.round(el.maxFloor); f++) {
      blockedOverhead.add(`${el.col}:${f}`);
    }
  }

  for (const l of sortedLedges) {
    if (l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate') {
      const h = Math.max(1, Math.round(l.h || 1));
      for (let k = 0; k <= h; k++) {
        blockedOverhead.add(`${l.col}:${l.floor + k}`);
      }
      continue;
    }
    walkableAt.set(`${l.col}:${l.floor}`, l);
  }

  for (const l of sortedLedges) {
    if (l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate') continue;
    const cPlus = wrapCol(l.col + 1);
    const cMinus = wrapCol(l.col - 1);
    const upPlus =
      walkableAt.has(`${cPlus}:${l.floor + 1}`) &&
      !walkableAt.has(`${l.col}:${l.floor + 1}`) &&
      !blockedOverhead.has(`${l.col}:${l.floor + 1}`);
    const upMinus =
      walkableAt.has(`${cMinus}:${l.floor + 1}`) &&
      !walkableAt.has(`${l.col}:${l.floor + 1}`) &&
      !blockedOverhead.has(`${l.col}:${l.floor + 1}`);

    const downPlus =
      walkableAt.has(`${cPlus}:${l.floor - 1}`) && !walkableAt.has(`${cPlus}:${l.floor}`);
    const downMinus =
      walkableAt.has(`${cMinus}:${l.floor - 1}`) && !walkableAt.has(`${cMinus}:${l.floor}`);

    if (l.stairDir === undefined) {
      if (upPlus && !upMinus) l.stairDir = 1;
      else if (upMinus && !upPlus) l.stairDir = -1;
      else if (upPlus) l.stairDir = 1;
      else l.stairDir = 0;
    }
    l.stairDownDir = downPlus ? 1 : downMinus ? -1 : 0;
    l.isStair = Boolean(l.stairDir !== 0 || l.stairDownDir !== 0);
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
  palette,
  mechanics = {},
  ledges = [],
  elevators = [],
  doors = [],
  switches = [],
  wallStrips = [],
  grappleRings = [],
  collectibles = [],
  enemies = [],
  crownSeals = []
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

  const byCoord = new Map();
  for (const raw of ledges) {
    const c = wrapCol(raw.col);
    const f = Math.round(Number(raw.floor));
    const t = raw.type || 'solid';
    const isBarrier = t === 'box' || t === 'pillar' || t === 'laserGate';
    if (!isBarrier) {
      const inShaft = normElevators.some((el) => el.col === c && f >= el.minFloor && f <= el.maxFloor);
      if (inShaft) continue;
      const inStripMid = normWallStrips.some((ws) => ws.col === c && f > ws.minFloor && f <= ws.maxFloor);
      if (inStripMid) continue;
    }
    const slotKey = isBarrier ? `${c}:${f}:${t}` : `${c}:${f}:step`;
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
      ...(raw.h !== undefined ? { h: Number(raw.h) } : {})
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
    collectibles: normCollectibles,
    enemies: normEnemies
  };
}

// ============================================================================
// 10 HANDCRAFTED CAMPAIGN SPIRES ACROSS EARTH'S 5 WATER BIOMES (COLS = 20)
// ============================================================================

export function createCampaignTowers() {
  // Helper defining the 3 mandatory Crown Seals every Campaign Spire requires!
  const makeThreeSeals = ({ s1Label, s1Hint, s2Label, s2Hint, s2DoorId, s3Label, s3Hint, s3SwitchId }) => [
    {
      id: 'seal_1',
      index: 1,
      label: s1Label,
      shortLabel: `Seal 1: ${s1Label}`,
      hint: s1Hint,
      kind: 'pipe_valves',
      pipeGroup: 'pipeA'
    },
    {
      id: 'seal_2',
      index: 2,
      label: s2Label,
      shortLabel: `Seal 2: ${s2Label}`,
      hint: s2Hint,
      kind: 'sanctum',
      doorId: s2DoorId
    },
    {
      id: 'seal_3',
      index: 3,
      label: s3Label,
      shortLabel: `Seal 3: ${s3Label}`,
      hint: s3Hint,
      kind: 'upper_sluice',
      switchId: s3SwitchId
    }
  ];

  // --------------------------------------------------------------------------
  // ACT I — REDWOOD CANYON RIVERS ('canyon_river', Spires 1 & 2)
  // --------------------------------------------------------------------------

  // SPIRE 1: SUNLIT GORGE SLUICE (20 floors — True 360° Cylindrical Puzzle Fortress:
  // Max 1F stepped accent, TWO +10-col Cross-Tower Interior Tunnels forced by stone bulkheads,
  // Dead-end fork, Snap-Crab Springboard Valve Loft (Seal 1), Mandatory Rotary Pipes Sanctum
  // + Mid-Spire Siphon Barrier (Seal 2), Canyon Lock-Keeper & Upper Sluice (Seal 3))
  const s1Ledges = [];
  span(s1Ledges, 0, 18, 4, 'solid');                    // Spawn Quay [18,19,0,1]
  span(s1Ledges, 1, 15, 2, 'solid');                    // Dead-end left decoy fork [15,16] at f=1 (Gear + one-way drop!)
  stairFlight(s1Ledges, 0, 2, 1, 1, 3, 'solid');        // Short 1F stepped accent onto [3,4,5] at f=1
  tile(s1Ledges, 6, 1, 'pillar', { h: 3 });             // Exterior Stone Bulkhead forces Cross-Tower Tunnel #1 (5 -> 15)!
  // Opposite side of spire (f=1): [14,15,16] blocked right by bulkhead at col 17
  span(s1Ledges, 1, 14, 3, 'solid');
  tile(s1Ledges, 17, 1, 'pillar', { h: 3 });
  // Jump left across dead elevator shaft col 13 onto Snap-Crab Courtyard [7..12] at f=2!
  span(s1Ledges, 2, 7, 6, 'solid');                     // [7,8,9,10,11,12] at f=2
  tile(s1Ledges, 8, 2, 'box');                          // Siphon Clamp Box guarding Pipe-Valve 1 at col 7
  // High Valve Loft at f=5 (+3F above f=2 — requires flipping Snap-Crab & bouncing off carapace!)
  span(s1Ledges, 5, 8, 4, 'solid');                     // [8,9,10,11] at f=5 (clear of col 13 lift shaft!)
  tile(s1Ledges, 9, 5, 'box');                          // Siphon Clamp Box guarding Pipe-Valve 2 at col 10
  // Unpowered Main Lift s1_lift1 at col 13 (f=2..9) -> Mid-Spire Aqueduct Ring at f=9
  span(s1Ledges, 9, 9, 4, 'solid');                     // Sanctum Courtyard [9,10,11,12] at f=9
  span(s1Ledges, 8, 6, 2, 'solid');                     // Left one-way drop scout spur [6,7] at f=8 (Gear + Rail-Skater)
  span(s1Ledges, 9, 14, 5, 'solid');                    // East Mid-Spire Deck [14,15,16,17,18] at f=9
  // Mid-Spire Full Siphon Barrier (retracted ONLY when Inner Aqueduct Sanctum Seal 2 is solved!)
  tile(s1Ledges, 18, 9, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s1Ledges, 10, 19, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Spire Strategic Ascent (broken chasms, crumble bridge, Cross-Tower Tunnel #2, Counterweight Lift)
  span(s1Ledges, 10, 1, 3, 'solid');                    // [1,2,3] at f=10
  span(s1Ledges, 11, 5, 2, 'crumble');                  // Crumbling bridge [5,6] at f=11 (1-col running jump over col 4!)
  span(s1Ledges, 12, 8, 3, 'solid');                    // [8,9,10] at f=12 (1-col jump / Grapple Ring across col 7!)
  tile(s1Ledges, 11, 12, 'pillar', { h: 3 });           // Bulkhead forces Cross-Tower Tunnel #2 (10 -> 0 on f=12)!
  span(s1Ledges, 12, 19, 4, 'solid');                   // Opposite side [19,0,1,2] at f=12
  tile(s1Ledges, 2, 12, 'steamVent', { phasePeriod: 3.1, phaseOffset: 0.0 }); // Timed Hydro-Geyser + Lift s1_lift2 at col 3!
  // Summit Crown Arena at f=16: [4..12]
  span(s1Ledges, 16, 4, 9, 'solid');                    // [4,5,6,7,8,9,10,11,12] at f=16
  span(s1Ledges, 17, 13, 2, 'solid');                   // Bonus Harmonic Seed perch [13,14] at f=17

  const t1 = finalizeTower({
    id: 1,
    act: 1,
    key: 'spire_1',
    name: 'SUNLIT GORGE SLUICE',
    subtitle: 'ACT I • REDWOOD CANYON RIVERS',
    theme: 'canyon_river',
    floors: 20,
    timeLimit: 260,
    parTime: 115,
    spawn: { col: 0, floor: 0 },
    ledges: s1Ledges,
    elevators: [
      { id: 's1_lift1', col: 13, minFloor: 2, maxFloor: 9, startFloor: 2, speed: 1.9, pipeGroup: 'pipeA', powered: false },
      { id: 's1_lift2', col: 3, minFloor: 12, maxFloor: 16, startFloor: 12, speed: 1.95 }
    ],
    doors: [
      { id: 's1_t1a', col: 5, floor: 1, targetId: 's1_t1b', tunnelStyle: 'stone' },
      { id: 's1_t1b', col: 15, floor: 1, targetId: 's1_t1a', tunnelStyle: 'stone' },
      { id: 's1_t2a', col: 10, floor: 12, targetId: 's1_t2b', tunnelStyle: 'stone' },
      { id: 's1_t2b', col: 0, floor: 12, targetId: 's1_t2a', tunnelStyle: 'stone' },
      { id: 's1_sanctum', col: 10, floor: 9, isRune: true, puzzleType: 'pipes', puzzleSeed: 11011, puzzleDifficulty: 0.3, sealId: 'seal_2' },
      { id: 's1_crown', col: 10, floor: 16, isExit: true }
    ],
    switches: [
      { id: 's1_pipe1', col: 7, floor: 2, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's1_pipe2', col: 10, floor: 5, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's1_seal3_sluice', col: 5, floor: 16, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    grappleRings: [
      { id: 's1_ring1', col: 7.0, floor: 12.6 }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Pipe-Valve Pressure',
      s1Hint: 'Tunnel across spire, flip Snap-Crab & spin both Copper Pipe-Valves',
      s2Label: 'Inner Aqueduct Sanctum',
      s2Hint: 'Solve the Mid-Spire Rotary Pipe Sanctum to retract the Siphon Barrier',
      s2DoorId: 's1_sanctum',
      s3Label: 'Upper Sluice Guardian',
      s3Hint: 'Defeat the Canyon Lock-Keeper & pull the Upper Sluice Lever',
      s3SwitchId: 's1_seal3_sluice'
    }),
    collectibles: [
      { id: 's1_g1', col: 15, floor: 1, type: 'gear' },
      { id: 's1_g2', col: 8, floor: 5, type: 'gear' },
      { id: 's1_g3', col: 6, floor: 8, type: 'gear' },
      { id: 's1_g4', col: 1, floor: 12, type: 'gear' },
      { id: 's1_g5', col: 7, floor: 16, type: 'gear' },
      { id: 's1_log', col: 9, floor: 9, type: 'relic', relicId: 'relic_t1' },
      { id: 's1_seed', col: 13, floor: 17, type: 'starCore' },
      { id: 's1_cr1', col: 11, floor: 5, type: 'critter_pod', critterId: 'critter_s1_1', species: 'River Otter', biome: 'canyon_river' },
      { id: 's1_cr2', col: 11, floor: 9, type: 'critter_pod', critterId: 'critter_s1_2', species: 'River Otter', biome: 'canyon_river' },
      { id: 's1_cr3', col: 14, floor: 17, type: 'critter_pod', critterId: 'critter_s1_3', species: 'River Otter', biome: 'canyon_river' }
    ],
    enemies: [
      { type: 'snap_crab', col: 9.5, floor: 2, dir: 1, speed: 1.35 },
      { type: 'gulp_hopper', col: 15.5, floor: 9, dir: -1, speed: 1.45 },
      { type: 'rail_skater', col: 6.5, floor: 8, dir: 1, speed: 1.5, axis: 'h' },
      { type: 'volt_eel', col: 2.5, floor: 11.4, dir: 1, speed: 1.65, amp: 0.3 },
      { type: 'siphon_warden', col: 8.5, floor: 16.4, dir: -1, speed: 1.85, hp: 2, maxHp: 2, isLockKeeper: true, bossTitle: 'CANYON LOCK-KEEPER', sealId: 'seal_3' }
    ]
  });

  // SPIRE 2: REDWOOD CATARACT DAM (21 floors — Act I Boss: Floodgate Swim + Cross-Tower Tunnel + Crab Loft,
  // Mandatory Tide-Locks Sanctum + Siphon Barrier, Act I Redwood Siphon Warden & Upper Sluice)
  const s2Ledges = [];
  span(s2Ledges, 0, 18, 4, 'solid');                    // Spawn [18,19,0,1]
  stairFlight(s2Ledges, 0, 2, 2, 1, 5, 'solid');        // 2F stepped rise onto [4,5,6,7,8] at f=2 (FloodValve 6, Crab 5.5)
  span(s2Ledges, 5, 6, 3, 'solid');                     // High Valve Loft [6,7,8] at f=5 (Crab Springboard!)
  tile(s2Ledges, 7, 5, 'box');                          // Crate guarding Pipe-Valve 2 at col 8
  span(s2Ledges, 3, 9, 2, 'crumble');                   // Floodgate crumble crossing [9,10] at f=3
  span(s2Ledges, 3, 11, 5, 'solid');                    // [11,12,13,14,15] at f=3 (Pipe-Valve 1 at 14)
  // Pipe-powered Dam Lift s2_lift_pipe at col 16 (f=3..9)
  span(s2Ledges, 9, 17, 6, 'solid');                    // Mid-Spire Dam Plaza [17,18,19,0,1,2] at f=9 (Core Vault at 19)
  span(s2Ledges, 9, 12, 4, 'solid');                    // Sanctum Spur [12,13,14,15] at f=9
  tile(s2Ledges, 2, 9, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s2Ledges, 10, 3, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  span(s2Ledges, 10, 5, 4, 'solid');                    // [5,6,7,8] at f=10
  tile(s2Ledges, 9, 10, 'pillar', { h: 3 });            // Bulkhead forces Cross-Tower Tunnel (8 -> 18 on f=10)!
  span(s2Ledges, 10, 17, 3, 'solid');                   // Opposite side [17,18,19] at f=10 -> dead-end fork left [15,16] at f=11!
  span(s2Ledges, 11, 15, 2, 'solid');
  span(s2Ledges, 11, 1, 2, 'crumble');                  // Jump across col 0 -> crumble [1,2] at f=11 -> [4,5,6] at f=12
  span(s2Ledges, 12, 4, 3, 'solid');
  stairFlight(s2Ledges, 12, 7, 2, 1, 4, 'solid');       // Short 2F accent onto [9,10,11,12] at f=14
  tile(s2Ledges, 12, 14, 'steamVent', { phasePeriod: 3.1, phaseOffset: 0.2 });
  // Counterweight Lift s2_lift2 at col 13 (f=14..18)
  span(s2Ledges, 18, 14, 9, 'solid');                   // Crown Dam Arena [14,15,16,17,18,19,0,1,2] at f=18!
  span(s2Ledges, 19, 3, 2, 'solid');                    // Bonus perch [3,4] at f=19

  const t2 = finalizeTower({
    id: 2,
    act: 1,
    key: 'spire_2',
    name: 'REDWOOD CATARACT DAM',
    subtitle: 'ACT I BOSS • RIVER FLOODGATE CITADEL',
    theme: 'canyon_river',
    floors: 21,
    timeLimit: 280,
    parTime: 125,
    spawn: { col: 0, floor: 0 },
    ledges: s2Ledges,
    elevators: [
      { id: 's2_lift_pipe', col: 16, minFloor: 3, maxFloor: 9, startFloor: 3, speed: 1.9, pipeGroup: 'pipeA', powered: false },
      { id: 's2_lift2', col: 13, minFloor: 14, maxFloor: 18, startFloor: 14, speed: 2.0 }
    ],
    doors: [
      { id: 's2_t1a', col: 8, floor: 10, targetId: 's2_t1b', tunnelStyle: 'stone' },
      { id: 's2_t1b', col: 18, floor: 10, targetId: 's2_t1a', tunnelStyle: 'stone' },
      { id: 's2_sanctum', col: 13, floor: 9, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 22022, puzzleDifficulty: 0.35, sealId: 'seal_2' },
      { id: 's2_vault', col: 19, floor: 9, isVault: true },
      { id: 's2_crown', col: 1, floor: 18, isExit: true }
    ],
    switches: [
      { id: 's2_flood1', col: 6, floor: 2, group: 'flood', mode: 'floodValve', targetWaterFloor: 2.35 },
      { id: 's2_pipe1', col: 14, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's2_pipe2', col: 8, floor: 5, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's2_seal3_sluice', col: 15, floor: 18, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    grappleRings: [
      { id: 's2_ring1', col: 9.5, floor: 3.9 },
      { id: 's2_ring2', col: 16.0, floor: 10.2 }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Dam Pipe Pressure',
      s1Hint: 'Open Floodgate, bounce up to Valve 2 & pressurize the Dam Lift',
      s2Label: 'Tide-Lock Sanctum',
      s2Hint: 'Balance the Mid-Spire Tide-Lock Chambers to retract the Dam Gate',
      s2DoorId: 's2_sanctum',
      s3Label: 'Redwood Warden Seal',
      s3Hint: 'Defeat the Redwood Siphon Warden & pull the Upper Sluice Lever',
      s3SwitchId: 's2_seal3_sluice'
    }),
    collectibles: [
      { id: 's2_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's2_g2', col: 13, floor: 3, type: 'gear' },
      { id: 's2_g3', col: 15, floor: 11, type: 'gear' },
      { id: 's2_g4', col: 10, floor: 14, type: 'gear' },
      { id: 's2_g5', col: 18, floor: 18, type: 'gear' },
      { id: 's2_log', col: 18, floor: 9, type: 'relic', relicId: 'relic_t2' },
      { id: 's2_seed', col: 3, floor: 19, type: 'starCore' },
      { id: 's2_cr1', col: 7, floor: 2, type: 'critter_pod', critterId: 'critter_s2_1', species: 'River Otter', biome: 'canyon_river' },
      { id: 's2_cr2', col: 14, floor: 9, type: 'critter_pod', critterId: 'critter_s2_2', species: 'River Otter', biome: 'canyon_river' },
      { id: 's2_cr3', col: 4, floor: 19, type: 'critter_pod', critterId: 'critter_s2_3', species: 'River Otter', biome: 'canyon_river' }
    ],
    enemies: [
      { type: 'snap_crab', col: 5.5, floor: 2, dir: 1, speed: 1.45 },
      { type: 'snap_crab', col: 12.5, floor: 3, dir: -1, speed: 1.55 },
      { type: 'barnacle_mortar', col: 1.0, floor: 9, dir: -1, firePeriod: 3.5 },
      { type: 'rail_skater', col: 10.5, floor: 14, dir: 1, speed: 1.7, axis: 'h' },
      { type: 'siphon_warden', col: 18.5, floor: 18.3, dir: -1, speed: 2.0, hp: 3, maxHp: 3, isLockKeeper: true, bossTitle: 'REDWOOD SIPHON WARDEN', sealId: 'seal_3' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT II — CRYSTAL ALPINE LAKES ('alpine_lake', Spires 3 & 4)
  // --------------------------------------------------------------------------

  // SPIRE 3: MIRROR TARN AQUEDUCT (21 floors — Running Jumps + Gecko Crystal Strips + Cross-Tower +10 Tunnel,
  // Mandatory Harmonic Bells Sanctum, Alpine Lock-Keeper)
  const s3Ledges = [];
  span(s3Ledges, 0, 18, 4, 'solid');
  stairFlight(s3Ledges, 0, 2, 2, 1, 3, 'solid');        // 2F accent onto [4,5,6] at f=2
  span(s3Ledges, 3, 8, 3, 'solid');                     // 1-col jump gap at col 7 -> [8,9,10] at f=3 (Pipe-Valve 1 at 9)
  // Gecko Crystal Wall-Strip at col 11 (f=3..7) -> High Glacier Terrace [12..16] at f=7
  span(s3Ledges, 7, 12, 5, 'ice');
  tile(s3Ledges, 12, 7, 'solid');
  tile(s3Ledges, 15, 7, 'solid');                       // Pipe-Valve 2 at (15, 7)
  // Pipe-powered Lift s3_lift1 at col 17 (f=7..11) -> Mid-Spire Tarn Plaza [18..2] at f=11
  span(s3Ledges, 11, 18, 5, 'solid');                   // [18,19,0,1,2] at f=11 (Bells Sanctum at 19)
  tile(s3Ledges, 2, 11, 'pillar', { h: 3 });            // Exterior Bulkhead forces +10 Cross-Tower Tunnel (1 -> 11 on f=11)!
  span(s3Ledges, 11, 10, 4, 'solid');                   // Opposite side [10,11,12,13] at f=11
  span(s3Ledges, 12, 7, 2, 'solid');                    // Dead-end west scout ledge [7,8] at f=12 (Gear)
  // Mid-Spire Siphon Barrier (Seal 2) on opposite side col 13 -> Sanctum-Powered Lift s3_lift2 at col 15 (f=12..16)!
  tile(s3Ledges, 13, 11, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s3Ledges, 12, 14, 1, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Spire (f=16..18): arrives from Sanctum-Powered Lift s3_lift2 at col 15!
  span(s3Ledges, 16, 16, 4, 'solid');                   // [16,17,18,19] at f=16
  stairFlight(s3Ledges, 16, 0, 2, 1, 7, 'solid');       // 2F accent -> Crown Aqueduct [2,3,4,5,6,7,8] at f=18!
  span(s3Ledges, 19, 9, 2, 'solid');                    // Bonus perch [9,10] at f=19

  const t3 = finalizeTower({
    id: 3,
    act: 2,
    key: 'spire_3',
    name: 'MIRROR TARN AQUEDUCT',
    subtitle: 'ACT II • CRYSTAL ALPINE LAKES',
    theme: 'alpine_lake',
    floors: 21,
    timeLimit: 280,
    parTime: 125,
    spawn: { col: 0, floor: 0 },
    ledges: s3Ledges,
    elevators: [
      { id: 's3_lift1', col: 17, minFloor: 7, maxFloor: 11, startFloor: 7, speed: 1.9, pipeGroup: 'pipeA', powered: false },
      { id: 's3_lift2', col: 15, minFloor: 12, maxFloor: 16, startFloor: 12, speed: 1.95, pipeGroup: 'seal_2', powered: false }
    ],
    wallStrips: [
      { id: 's3_gecko1', col: 11, minFloor: 3, maxFloor: 7 }
    ],
    doors: [
      { id: 's3_t1a', col: 1, floor: 11, targetId: 's3_t1b', tunnelStyle: 'stone' },
      { id: 's3_t1b', col: 11, floor: 11, targetId: 's3_t1a', tunnelStyle: 'stone' },
      { id: 's3_sanctum', col: 19, floor: 11, isRune: true, puzzleType: 'bells', puzzleSeed: 33033, puzzleDifficulty: 0.38, sealId: 'seal_2' },
      { id: 's3_crown', col: 7, floor: 18, isExit: true }
    ],
    switches: [
      { id: 's3_pipe1', col: 9, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's3_pipe2', col: 15, floor: 7, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's3_seal3_sluice', col: 3, floor: 18, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Glacier Pipe Pressure',
      s1Hint: 'Jump chasm to Valve 1, Gecko-Scamper Crystal Vein & spin Valve 2',
      s2Label: 'Harmonic Bells Sanctum',
      s2Hint: 'Solve Mid-Spire Water-Bells, tunnel across spire & ride the Glacier Lift',
      s2DoorId: 's3_sanctum',
      s3Label: 'Alpine Lock-Keeper',
      s3Hint: 'Defeat the Alpine Lock-Keeper & pull the Upper Sluice Lever',
      s3SwitchId: 's3_seal3_sluice'
    }),
    collectibles: [
      { id: 's3_g1', col: 8, floor: 3, type: 'gear' },
      { id: 's3_g2', col: 14, floor: 7, type: 'gear' },
      { id: 's3_g3', col: 7, floor: 12, type: 'gear' },
      { id: 's3_g4', col: 18, floor: 16, type: 'gear' },
      { id: 's3_g5', col: 5, floor: 18, type: 'gear' },
      { id: 's3_log', col: 18, floor: 11, type: 'relic', relicId: 'relic_t3' },
      { id: 's3_seed', col: 9, floor: 19, type: 'starCore' },
      { id: 's3_cr1', col: 10, floor: 3, type: 'critter_pod', critterId: 'critter_s3_1', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's3_cr2', col: 13, floor: 7, type: 'critter_pod', critterId: 'critter_s3_2', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's3_cr3', col: 10, floor: 19, type: 'critter_pod', critterId: 'critter_s3_3', species: 'Alpine Newt', biome: 'alpine_lake' }
    ],
    enemies: [
      { type: 'gulp_hopper', col: 5.5, floor: 2, dir: -1, speed: 1.6 },
      { type: 'vent_stalker', col: 13.5, floor: 8.0, dir: 1, speed: 1.8, axis: 'v', minFloor: 6.8, maxFloor: 9.4 },
      { type: 'snap_crab', col: 11.5, floor: 11, dir: 1, speed: 1.65 },
      { type: 'rail_skater', col: 17.5, floor: 16, dir: -1, speed: 1.75, axis: 'h' },
      { type: 'siphon_warden', col: 5.5, floor: 18.4, dir: 1, speed: 1.95, hp: 2, maxHp: 2, isLockKeeper: true, bossTitle: 'ALPINE LOCK-KEEPER', sealId: 'seal_3' }
    ]
  });

  // SPIRE 4: ALPENGLOW SPILLWAY SPIRE (22 floors — Act II Boss: Mountain Wind + Crab Springboard,
  // Grapple Chasm, +10 Cross-Tower Tunnel, Mandatory Sea-Glass Prism Sanctum, Glacier Siphon Warden)
  const s4Ledges = [];
  span(s4Ledges, 0, 18, 4, 'solid');
  stairFlight(s4Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent onto [4,5] at f=2
  span(s4Ledges, 3, 6, 4, 'solid');                     // Step/jump up to [6,7,8,9] at f=3 (Snap-Crab 6.5, ice at 8)
  tile(s4Ledges, 8, 3, 'ice');
  span(s4Ledges, 6, 7, 3, 'solid');                     // High Valve Loft [7,8,9] at f=6 (Crab Springboard bounce!)
  tile(s4Ledges, 7, 6, 'box');
  span(s4Ledges, 3, 11, 1, 'solid');                    // Grapple stepping stone [11] at f=3
  span(s4Ledges, 4, 12, 4, 'solid');                    // [12,13,14,15] at f=4 (Pipe-Valve 1 at 14)
  // Pipe-powered Lift s4_lift1 at col 16 (f=4..10) -> Mid-Spire Spillway Plaza [17..3] at f=10
  span(s4Ledges, 10, 17, 7, 'solid');                   // [17,18,19,0,1,2,3] at f=10
  tile(s4Ledges, 3, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s4Ledges, 11, 4, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  span(s4Ledges, 11, 6, 4, 'solid');                    // [6,7,8,9] at f=11
  // Counterweight Lift s4_lift2 at col 10 (f=11..15)
  span(s4Ledges, 15, 11, 4, 'ice');                     // [11,12,13,14] at f=15
  tile(s4Ledges, 12, 15, 'solid');
  tile(s4Ledges, 14, 15, 'solid');
  tile(s4Ledges, 15, 15, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (14 -> 4 on f=15)!
  span(s4Ledges, 15, 3, 3, 'solid');                    // Opposite side [3,4,5] at f=15
  // Counterweight Lift s4_lift3 at col 6 (f=15..19) -> Crown Spillway Arena [7..13] at f=19!
  span(s4Ledges, 19, 7, 7, 'solid');                    // [7,8,9,10,11,12,13] at f=19
  span(s4Ledges, 20, 14, 2, 'solid');                   // Bonus perch [14,15] at f=20

  const t4 = finalizeTower({
    id: 4,
    act: 2,
    key: 'spire_4',
    name: 'ALPENGLOW SPILLWAY SPIRE',
    subtitle: 'ACT II BOSS • GLACIAL GALE MONOLITH',
    theme: 'alpine_lake',
    floors: 22,
    timeLimit: 290,
    parTime: 130,
    spawn: { col: 0, floor: 0 },
    mechanics: { windForce: 0.40, windPeriod: 6.2 },
    ledges: s4Ledges,
    elevators: [
      { id: 's4_lift1', col: 16, minFloor: 4, maxFloor: 10, startFloor: 4, speed: 1.95, pipeGroup: 'pipeA', powered: false },
      { id: 's4_lift2', col: 10, minFloor: 11, maxFloor: 15, startFloor: 11, speed: 2.0 },
      { id: 's4_lift3', col: 6, minFloor: 15, maxFloor: 19, startFloor: 15, speed: 2.0 }
    ],
    grappleRings: [
      { id: 's4_ring1', col: 10.5, floor: 4.5 },
      { id: 's4_ring2', col: 9.5, floor: 12.6 }
    ],
    doors: [
      { id: 's4_t1a', col: 14, floor: 15, targetId: 's4_t1b', tunnelStyle: 'stone' },
      { id: 's4_t1b', col: 4, floor: 15, targetId: 's4_t1a', tunnelStyle: 'stone' },
      { id: 's4_sanctum', col: 18, floor: 10, isRune: true, puzzleType: 'beam', puzzleSeed: 44044, puzzleDifficulty: 0.42, sealId: 'seal_2' },
      { id: 's4_vault', col: 0, floor: 10, isVault: true },
      { id: 's4_crown', col: 12, floor: 19, isExit: true }
    ],
    switches: [
      { id: 's4_pipe1', col: 14, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's4_pipe2', col: 8, floor: 6, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's4_seal3_sluice', col: 8, floor: 19, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Spillway Pressure',
      s1Hint: 'Crab-bounce onto High Balcony Valve 2 & spin Spillway Valve 1',
      s2Label: 'Sea-Glass Prism Sanctum',
      s2Hint: 'Route the Prism Beam inside the Mid-Spire Sanctum to lower the Gate',
      s2DoorId: 's4_sanctum',
      s3Label: 'Glacier Warden Seal',
      s3Hint: 'Defeat the Glacier Siphon Warden & pull the Upper Sluice Lever',
      s3SwitchId: 's4_seal3_sluice'
    }),
    collectibles: [
      { id: 's4_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's4_g2', col: 13, floor: 4, type: 'gear' },
      { id: 's4_g3', col: 2, floor: 10, type: 'gear' },
      { id: 's4_g4', col: 3, floor: 15, type: 'gear' },
      { id: 's4_g5', col: 10, floor: 19, type: 'gear' },
      { id: 's4_log', col: 19, floor: 10, type: 'relic', relicId: 'relic_t4' },
      { id: 's4_seed', col: 14, floor: 20, type: 'starCore' },
      { id: 's4_cr1', col: 15, floor: 4, type: 'critter_pod', critterId: 'critter_s4_1', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's4_cr2', col: 1, floor: 10, type: 'critter_pod', critterId: 'critter_s4_2', species: 'Alpine Newt', biome: 'alpine_lake' },
      { id: 's4_cr3', col: 15, floor: 20, type: 'critter_pod', critterId: 'critter_s4_3', species: 'Alpine Newt', biome: 'alpine_lake' }
    ],
    enemies: [
      { type: 'snap_crab', col: 6.5, floor: 3, dir: 1, speed: 1.55 },
      { type: 'vent_stalker', col: 18.5, floor: 11.2, dir: -1, speed: 1.9, axis: 'v', minFloor: 10.0, maxFloor: 12.6 },
      { type: 'barnacle_mortar', col: 7.5, floor: 11, dir: -1, firePeriod: 3.3 },
      { type: 'gulp_hopper', col: 12.5, floor: 15, dir: -1, speed: 1.8 },
      { type: 'siphon_warden', col: 10.5, floor: 19.3, dir: 1, speed: 2.1, hp: 3, maxHp: 3, isLockKeeper: true, bossTitle: 'GLACIER SIPHON WARDEN', sealId: 'seal_3' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT III — EMERALD MIST BAYOUS ('mist_bayou', Spires 5 & 6)
  // --------------------------------------------------------------------------

  // SPIRE 5: FIREFLY CYPRESS RELIQUARY (22 floors — Red Phase Bridge + 2 Pipe Valves,
  // +10 Cross-Tower Tunnel + Mandatory Hydro-Mosaic Sanctum, Bayou Lock-Keeper)
  const s5Ledges = [];
  span(s5Ledges, 0, 18, 4, 'solid');
  stairFlight(s5Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent -> [4,5] at f=2
  span(s5Ledges, 3, 6, 3, 'solid');                     // Step up to [6,7,8] at f=3 (Pipe-Valve 1 at 6, Red Switch at 7)
  span(s5Ledges, 4, 9, 2, 'phaseBlock', { switchGroup: 'red', inverted: false });
  span(s5Ledges, 4, 11, 4, 'solid');                    // [11,12,13,14] at f=4 (Pipe-Valve 2 at 13)
  // Pipe-powered Lift s5_lift1 at col 15 (f=4..10) -> Mid-Spire Cypress Deck [16..19] at f=10
  span(s5Ledges, 10, 16, 4, 'solid');
  tile(s5Ledges, 19, 10, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (18 -> 8 on f=10)!
  span(s5Ledges, 10, 7, 5, 'solid');                    // Opposite Sanctum Courtyard [7,8,9,10,11] at f=10!
  span(s5Ledges, 11, 4, 2, 'solid');                    // Left decoy spur [4,5] at f=11 (Gear)
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s5_lift2 at col 14 (f=11..15)!
  tile(s5Ledges, 11, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s5Ledges, 11, 12, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Sanctum-Powered Lift s5_lift2 at col 14 (f=11..15) -> Upper Deck [15..1] at f=15
  span(s5Ledges, 15, 15, 7, 'solid');                   // [15,16,17,18,19,0,1] at f=15
  // Vine Gecko Wall-Strip at col 2 (f=15..18)
  span(s5Ledges, 18, 3, 3, 'solid');                    // [3,4,5] at f=18
  stairFlight(s5Ledges, 18, 6, 2, 1, 7, 'solid');       // 2F accent -> Crown Cypress Arena [8,9,10,11,12,13,14] at f=20!
  span(s5Ledges, 21, 15, 2, 'solid');                   // Bonus perch [15,16] at f=21

  const t5 = finalizeTower({
    id: 5,
    act: 3,
    key: 'spire_5',
    name: 'FIREFLY CYPRESS RELIQUARY',
    subtitle: 'ACT III • EMERALD MIST BAYOUS',
    theme: 'mist_bayou',
    floors: 22,
    timeLimit: 295,
    parTime: 130,
    spawn: { col: 0, floor: 0 },
    ledges: s5Ledges,
    elevators: [
      { id: 's5_lift1', col: 15, minFloor: 4, maxFloor: 10, startFloor: 4, speed: 1.95, pipeGroup: 'pipeA', powered: false },
      { id: 's5_lift2', col: 14, minFloor: 11, maxFloor: 15, startFloor: 11, speed: 1.95, pipeGroup: 'seal_2', powered: false }
    ],
    wallStrips: [
      { id: 's5_gecko1', col: 2, minFloor: 15, maxFloor: 18 }
    ],
    doors: [
      { id: 's5_d1a', col: 18, floor: 10, targetId: 's5_d1b', tunnelStyle: 'stone' },
      { id: 's5_d1b', col: 8, floor: 10, targetId: 's5_d1a', tunnelStyle: 'stone' },
      { id: 's5_sanctum', col: 9, floor: 10, isRune: true, puzzleType: 'lights', puzzleSeed: 55055, puzzleDifficulty: 0.45, sealId: 'seal_2' },
      { id: 's5_crown', col: 13, floor: 20, isExit: true }
    ],
    switches: [
      { id: 's5_pipe1', col: 6, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's5_sw_red', col: 7, floor: 3, group: 'red', mode: 'toggle' },
      { id: 's5_pipe2', col: 13, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's5_seal3_sluice', col: 9, floor: 20, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Bayou Pipe Pressure',
      s1Hint: 'Open Red Sluice Bridge & spin both Copper Pipe-Valves for the Lift',
      s2Label: 'Hydro-Mosaic Sanctum',
      s2Hint: 'Cross the +10 Rock Tunnel & solve the Mid-Spire Mosaic Sanctum',
      s2DoorId: 's5_sanctum',
      s3Label: 'Bayou Lock-Keeper',
      s3Hint: 'Defeat the Bayou Lock-Keeper & pull the Upper Sluice Lever',
      s3SwitchId: 's5_seal3_sluice'
    }),
    collectibles: [
      { id: 's5_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's5_g2', col: 12, floor: 4, type: 'gear' },
      { id: 's5_g3', col: 4, floor: 11, type: 'gear' },
      { id: 's5_g4', col: 19, floor: 15, type: 'gear' },
      { id: 's5_g5', col: 11, floor: 20, type: 'gear' },
      { id: 's5_log', col: 0, floor: 15, type: 'relic', relicId: 'relic_t5' },
      { id: 's5_seed', col: 15, floor: 21, type: 'starCore' },
      { id: 's5_cr1', col: 14, floor: 4, type: 'critter_pod', critterId: 'critter_s5_1', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's5_cr2', col: 16, floor: 15, type: 'critter_pod', critterId: 'critter_s5_2', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's5_cr3', col: 16, floor: 21, type: 'critter_pod', critterId: 'critter_s5_3', species: 'Bayou Axolotl', biome: 'mist_bayou' }
    ],
    enemies: [
      { type: 'volt_eel', col: 12.5, floor: 4.5, dir: -1, speed: 1.8, amp: 0.35 },
      { type: 'barnacle_mortar', col: 17.5, floor: 15, dir: -1, firePeriod: 3.3 },
      { type: 'snap_crab', col: 19.5, floor: 15, dir: 1, speed: 1.75 },
      { type: 'gulp_hopper', col: 4.5, floor: 18, dir: 1, speed: 1.85 },
      { type: 'siphon_warden', col: 11.5, floor: 20.4, dir: -1, speed: 2.0, hp: 2, maxHp: 2, isLockKeeper: true, bossTitle: 'BAYOU LOCK-KEEPER', sealId: 'seal_3' }
    ]
  });

  // SPIRE 6: SUNKEN LOTUS FLOODGATE (23 floors — Act III Boss: Rising Bayou Surge + Crab Springboard,
  // Mandatory Tide-Locks Sanctum + +10 Cross-Tower Tunnel, Act III Bayou Siphon Warden)
  const s6Ledges = [];
  span(s6Ledges, 0, 18, 4, 'solid');
  stairFlight(s6Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent -> [4,5] at f=2
  span(s6Ledges, 3, 6, 4, 'solid');                     // [6,7,8,9] at f=3 (Pipe-Valve 1 at 6, Drain 1 at 8, Snap-Crab 7.5)
  span(s6Ledges, 6, 7, 3, 'solid');                     // High Valve Loft [7,8,9] at f=6 (Crab Springboard!)
  tile(s6Ledges, 8, 6, 'box');
  // Pipe-powered Lift s6_lift1 at col 10 (f=3..10) -> Mid-Spire Delta Plaza [11..17] at f=10
  span(s6Ledges, 10, 11, 7, 'solid');                   // [11,12,13,14,15,16,17] at f=10
  tile(s6Ledges, 17, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s6Ledges, 11, 18, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  span(s6Ledges, 11, 0, 3, 'solid');                    // [0,1,2] at f=11
  span(s6Ledges, 12, 3, 3, 'conveyorR');                // Lotus Current [3,4,5] at f=12
  span(s6Ledges, 13, 7, 3, 'solid');                    // 1-col jump gap col 6 -> [7,8,9] at f=13
  tile(s6Ledges, 10, 13, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (9 -> 19 on f=13)!
  span(s6Ledges, 13, 18, 3, 'solid');                   // Opposite side [18,19,0] at f=13
  stairFlight(s6Ledges, 13, 1, 2, 1, 4, 'solid');       // 2F accent -> [3,4,5,6] at f=15 (Drain Valve 3 at 5)
  // Counterweight Lift s6_lift2 at col 7 (f=15..20)
  span(s6Ledges, 20, 8, 8, 'solid');                    // Crown Lotus Arena [8,9,10,11,12,13,14,15] at f=20!
  span(s6Ledges, 21, 16, 2, 'solid');                   // Bonus perch [16,17] at f=21

  const t6 = finalizeTower({
    id: 6,
    act: 3,
    key: 'spire_6',
    name: 'SUNKEN LOTUS FLOODGATE',
    subtitle: 'ACT III BOSS • RISING DELTA SLUICE',
    theme: 'mist_bayou',
    floors: 23,
    timeLimit: 305,
    parTime: 135,
    spawn: { col: 0, floor: 0 },
    mechanics: { waterRiseRate: 0.085 },
    ledges: s6Ledges,
    elevators: [
      { id: 's6_lift1', col: 10, minFloor: 3, maxFloor: 10, startFloor: 3, speed: 2.0, pipeGroup: 'pipeA', powered: false },
      { id: 's6_lift2', col: 7, minFloor: 15, maxFloor: 20, startFloor: 15, speed: 2.05 }
    ],
    doors: [
      { id: 's6_t1a', col: 9, floor: 13, targetId: 's6_t1b', tunnelStyle: 'stone' },
      { id: 's6_t1b', col: 19, floor: 13, targetId: 's6_t1a', tunnelStyle: 'stone' },
      { id: 's6_sanctum', col: 13, floor: 10, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 66066, puzzleDifficulty: 0.48, sealId: 'seal_2' },
      { id: 's6_vault', col: 15, floor: 10, isVault: true },
      { id: 's6_crown', col: 14, floor: 20, isExit: true }
    ],
    switches: [
      { id: 's6_pipe1', col: 6, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's6_drain1', col: 8, floor: 3, group: 'drain', mode: 'drainValve' },
      { id: 's6_pipe2', col: 9, floor: 6, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's6_drain2', col: 16, floor: 10, group: 'drain', mode: 'drainValve' },
      { id: 's6_drain3', col: 5, floor: 15, group: 'drain', mode: 'drainValve' },
      { id: 's6_seal3_sluice', col: 9, floor: 20, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Delta Pipe Pressure',
      s1Hint: 'Vent surge, Crab-bounce to Balcony Valve 2 & pressurize Delta Lift',
      s2Label: 'Lotus Tide-Lock Sanctum',
      s2Hint: 'Balance the Mid-Spire Sluice Chambers to open the Delta Gate',
      s2DoorId: 's6_sanctum',
      s3Label: 'Bayou Warden Seal',
      s3Hint: 'Defeat the Bayou Siphon Warden & pull the Upper Sluice Lever',
      s3SwitchId: 's6_seal3_sluice'
    }),
    collectibles: [
      { id: 's6_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's6_g2', col: 12, floor: 10, type: 'gear' },
      { id: 's6_g3', col: 1, floor: 11, type: 'gear' },
      { id: 's6_g4', col: 18, floor: 13, type: 'gear' },
      { id: 's6_g5', col: 11, floor: 20, type: 'gear' },
      { id: 's6_log', col: 14, floor: 10, type: 'relic', relicId: 'relic_t6' },
      { id: 's6_seed', col: 16, floor: 21, type: 'starCore' },
      { id: 's6_cr1', col: 9, floor: 3, type: 'critter_pod', critterId: 'critter_s6_1', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's6_cr2', col: 4, floor: 15, type: 'critter_pod', critterId: 'critter_s6_2', species: 'Bayou Axolotl', biome: 'mist_bayou' },
      { id: 's6_cr3', col: 17, floor: 21, type: 'critter_pod', critterId: 'critter_s6_3', species: 'Bayou Axolotl', biome: 'mist_bayou' }
    ],
    enemies: [
      { type: 'snap_crab', col: 7.5, floor: 3, dir: 1, speed: 1.6 },
      { type: 'barnacle_mortar', col: 14.5, floor: 10, dir: -1, firePeriod: 3.1 },
      { type: 'volt_eel', col: 4.5, floor: 12.4, dir: 1, speed: 1.9, amp: 0.35 },
      { type: 'gulp_hopper', col: 4.5, floor: 15, dir: -1, speed: 1.85 },
      { type: 'siphon_warden', col: 12.0, floor: 20.3, dir: -1, speed: 2.15, hp: 3, maxHp: 3, isLockKeeper: true, bossTitle: 'BAYOU SIPHON WARDEN', sealId: 'seal_3' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT IV — SUNLIT CORAL SEAS ('coral_sea', Spires 7 & 8)
  // --------------------------------------------------------------------------

  // SPIRE 7: MOTHER-OF-PEARL ATOLL SPIRE (23 floors — Lagoon Geyser + Grapple + +10 Cross-Tower Tunnel,
  // Mandatory Sluice Basins Blocks Sanctum + Siphon Barrier, Atoll Lock-Keeper)
  const s7Ledges = [];
  span(s7Ledges, 0, 18, 4, 'solid');
  stairFlight(s7Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent -> [4,5] at f=2
  span(s7Ledges, 3, 6, 3, 'solid');                     // [6,7,8] at f=3 (Pipe-Valve 1 at 6, Lagoon Geyser at 8 -> launches to f=6!)
  tile(s7Ledges, 8, 3, 'steamVent', { phasePeriod: 3.1, phaseOffset: 0.0 });
  span(s7Ledges, 6, 9, 4, 'solid');                     // [9,10,11,12] at f=6 (Pipe-Valve 2 at 11)
  span(s7Ledges, 6, 14, 2, 'crumble');                  // Grapple Arch crossing [14,15] at f=6 (gap at 13 & 16!)
  span(s7Ledges, 7, 17, 5, 'solid');                    // [17,18,19,0,1] at f=7
  // Pipe-powered Lift s7_lift1 at col 2 (f=7..12) -> Mid-Spire Atoll Plaza [3..8] at f=12
  span(s7Ledges, 12, 3, 6, 'solid');                    // [3,4,5,6,7,8] at f=12
  tile(s7Ledges, 8, 12, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s7Ledges, 13, 9, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  span(s7Ledges, 13, 11, 3, 'solid');                   // [11,12,13] at f=13
  tile(s7Ledges, 14, 13, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (13 -> 3 on f=13)!
  span(s7Ledges, 13, 2, 3, 'solid');                    // Opposite side [2,3,4] at f=13
  stairFlight(s7Ledges, 13, 5, 2, 1, 4, 'solid');       // 2F accent -> [7,8,9,10] at f=15
  // Sea-Glass Gecko Strip at col 11 (f=15..19)
  span(s7Ledges, 19, 12, 3, 'solid');                   // [12,13,14] at f=19
  stairFlight(s7Ledges, 19, 15, 2, 1, 7, 'solid');      // 2F accent -> Crown Atoll Arena [17,18,19,0,1,2,3] at f=21!
  span(s7Ledges, 22, 4, 2, 'solid');                    // Bonus perch [4,5] at f=22

  const t7 = finalizeTower({
    id: 7,
    act: 4,
    key: 'spire_7',
    name: 'MOTHER-OF-PEARL ATOLL SPIRE',
    subtitle: 'ACT IV • SUNLIT CORAL SEAS',
    theme: 'coral_sea',
    floors: 23,
    timeLimit: 305,
    parTime: 135,
    spawn: { col: 0, floor: 0 },
    ledges: s7Ledges,
    elevators: [
      { id: 's7_lift1', col: 2, minFloor: 7, maxFloor: 12, startFloor: 7, speed: 2.0, pipeGroup: 'pipeA', powered: false }
    ],
    wallStrips: [
      { id: 's7_gecko1', col: 11, minFloor: 15, maxFloor: 19 }
    ],
    grappleRings: [
      { id: 's7_ring1', col: 15.8, floor: 7.6 }
    ],
    doors: [
      { id: 's7_t1a', col: 13, floor: 13, targetId: 's7_t1b', tunnelStyle: 'stone' },
      { id: 's7_t1b', col: 3, floor: 13, targetId: 's7_t1a', tunnelStyle: 'stone' },
      { id: 's7_sanctum', col: 5, floor: 12, isRune: true, puzzleType: 'blocks', puzzleSeed: 77077, puzzleDifficulty: 0.48, sealId: 'seal_2' },
      { id: 's7_crown', col: 2, floor: 21, isExit: true }
    ],
    switches: [
      { id: 's7_pipe1', col: 6, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's7_pipe2', col: 11, floor: 6, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's7_seal3_sluice', col: 18, floor: 21, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Atoll Pipe Pressure',
      s1Hint: 'Ride Lagoon Geyser & spin both Copper Pipe-Valves to power Atoll Lift',
      s2Label: 'Sluice Basins Sanctum',
      s2Hint: 'Slide the Sluice Stones inside the Mid-Spire Sanctum to lower the Gate',
      s2DoorId: 's7_sanctum',
      s3Label: 'Atoll Lock-Keeper',
      s3Hint: 'Defeat the Atoll Lock-Keeper & pull the Upper Sluice Lever',
      s3SwitchId: 's7_seal3_sluice'
    }),
    collectibles: [
      { id: 's7_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's7_g2', col: 10, floor: 6, type: 'gear' },
      { id: 's7_g3', col: 6, floor: 12, type: 'gear' },
      { id: 's7_g4', col: 9, floor: 15, type: 'gear' },
      { id: 's7_g5', col: 0, floor: 21, type: 'gear' },
      { id: 's7_log', col: 4, floor: 12, type: 'relic', relicId: 'relic_t7' },
      { id: 's7_seed', col: 4, floor: 22, type: 'starCore' },
      { id: 's7_cr1', col: 12, floor: 6, type: 'critter_pod', critterId: 'critter_s7_1', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's7_cr2', col: 7, floor: 12, type: 'critter_pod', critterId: 'critter_s7_2', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's7_cr3', col: 5, floor: 22, type: 'critter_pod', critterId: 'critter_s7_3', species: 'Sea Turtle', biome: 'coral_sea' }
    ],
    enemies: [
      { type: 'snap_crab', col: 10.0, floor: 6, dir: -1, speed: 1.8 },
      { type: 'rail_skater', col: 19.0, floor: 7, dir: 1, speed: 1.9, axis: 'h' },
      { type: 'gulp_hopper', col: 8.5, floor: 15, dir: 1, speed: 1.9 },
      { type: 'barnacle_mortar', col: 13.5, floor: 19, dir: -1, firePeriod: 3.1 },
      { type: 'siphon_warden', col: 0.5, floor: 21.4, dir: -1, speed: 2.05, hp: 2, maxHp: 2, isLockKeeper: true, bossTitle: 'ATOLL LOCK-KEEPER', sealId: 'seal_3' }
    ]
  });

  // SPIRE 8: PELAGIC REEF CONDUIT (24 floors — Act IV Boss: Coral Pistons + 2 Pipe Valves,
  // +10 Cross-Tower Tunnel + Mandatory Rotary Pipes Sanctum, Act IV Coral Siphon Warden)
  const s8Ledges = [];
  span(s8Ledges, 0, 18, 4, 'solid');
  stairFlight(s8Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent -> [4,5] at f=2
  span(s8Ledges, 3, 6, 3, 'solid');                     // [6,7,8] at f=3 (Pipe-Valve 1 at 7)
  span(s8Ledges, 4, 9, 2, 'piston', { phasePeriod: 3.2, phaseOffset: 0.0 });
  span(s8Ledges, 5, 11, 4, 'solid');                    // [11,12,13,14] at f=5 (Pipe-Valve 2 at 13)
  // Pipe-powered Lift s8_lift1 at col 15 (f=5..11) -> Mid-Spire Reef Deck [16..19] at f=11
  span(s8Ledges, 11, 16, 4, 'solid');                   // [16,17,18,19] (Flume Flip Switch at 18)
  tile(s8Ledges, 0, 11, 'pillar', { h: 3 });            // Bulkhead forces +10 Cross-Tower Tunnel (19 -> 9 on f=11)!
  span(s8Ledges, 11, 8, 5, 'solid');                    // Opposite Sanctum Courtyard [8,9,10,11,12] at f=11!
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s8_lift_mid at col 14 (f=12..15)!
  tile(s8Ledges, 12, 11, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s8Ledges, 12, 13, 1, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Spire (f=15..22): Reversible Coral Flume at f=15 + Pistons + Counterweight Lift!
  span(s8Ledges, 15, 15, 3, 'conveyorL');               // Reversible Coral Flume [15,16,17] at f=15
  stairFlight(s8Ledges, 15, 18, 2, 1, 5, 'solid');      // 2F accent -> [0,1,2,3,4] at f=17 (Core Vault at 2)
  span(s8Ledges, 18, 6, 2, 'piston', { phasePeriod: 3.0, phaseOffset: 0.8 }); // 1-col jump col 5 -> Pistons [6,7] at f=18
  span(s8Ledges, 19, 8, 3, 'solid');                    // [8,9,10] at f=19
  // Counterweight Lift s8_lift2 at col 11 (f=19..22)
  span(s8Ledges, 22, 12, 8, 'solid');                   // Crown Reef Arena [12,13,14,15,16,17,18,19] at f=22!
  span(s8Ledges, 23, 0, 2, 'solid');                    // Bonus perch [0,1] at f=23

  const t8 = finalizeTower({
    id: 8,
    act: 4,
    key: 'spire_8',
    name: 'PELAGIC REEF CONDUIT',
    subtitle: 'ACT IV BOSS • OFFSHORE CORAL SIPHON',
    theme: 'coral_sea',
    floors: 24,
    timeLimit: 315,
    parTime: 140,
    spawn: { col: 0, floor: 0 },
    ledges: s8Ledges,
    elevators: [
      { id: 's8_lift1', col: 15, minFloor: 5, maxFloor: 11, startFloor: 5, speed: 2.0, pipeGroup: 'pipeA', powered: false },
      { id: 's8_lift_mid', col: 14, minFloor: 12, maxFloor: 15, startFloor: 12, speed: 2.0, pipeGroup: 'seal_2', powered: false },
      { id: 's8_lift2', col: 11, minFloor: 19, maxFloor: 22, startFloor: 19, speed: 2.05 }
    ],
    doors: [
      { id: 's8_t1a', col: 19, floor: 11, targetId: 's8_t1b', tunnelStyle: 'stone' },
      { id: 's8_t1b', col: 9, floor: 11, targetId: 's8_t1a', tunnelStyle: 'stone' },
      { id: 's8_sanctum', col: 10, floor: 11, isRune: true, puzzleType: 'pipes', puzzleSeed: 88088, puzzleDifficulty: 0.55, sealId: 'seal_2' },
      { id: 's8_vault', col: 2, floor: 17, isVault: true },
      { id: 's8_crown', col: 17, floor: 22, isExit: true }
    ],
    switches: [
      { id: 's8_pipe1', col: 7, floor: 3, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's8_pipe2', col: 13, floor: 5, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's8_conv1', col: 18, floor: 11, group: 'conv', mode: 'conveyorFlip' },
      { id: 's8_seal3_sluice', col: 13, floor: 22, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Reef Conduit Pressure',
      s1Hint: 'Cross Coral Pistons & spin both Copper Pipe-Valves to power Reef Lift',
      s2Label: 'Coral Conduit Sanctum',
      s2Hint: 'Tunnel across spire & solve the Mid-Spire Rotary Pipe Sanctum',
      s2DoorId: 's8_sanctum',
      s3Label: 'Coral Warden Seal',
      s3Hint: 'Defeat the Coral Siphon Warden & pull the Upper Sluice Lever',
      s3SwitchId: 's8_seal3_sluice'
    }),
    collectibles: [
      { id: 's8_g1', col: 6, floor: 3, type: 'gear' },
      { id: 's8_g2', col: 12, floor: 5, type: 'gear' },
      { id: 's8_g3', col: 17, floor: 11, type: 'gear' },
      { id: 's8_g4', col: 4, floor: 17, type: 'gear' },
      { id: 's8_g5', col: 15, floor: 22, type: 'gear' },
      { id: 's8_log', col: 1, floor: 17, type: 'relic', relicId: 'relic_t8' },
      { id: 's8_seed', col: 0, floor: 23, type: 'starCore' },
      { id: 's8_cr1', col: 14, floor: 5, type: 'critter_pod', critterId: 'critter_s8_1', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's8_cr2', col: 3, floor: 17, type: 'critter_pod', critterId: 'critter_s8_2', species: 'Sea Turtle', biome: 'coral_sea' },
      { id: 's8_cr3', col: 1, floor: 23, type: 'critter_pod', critterId: 'critter_s8_3', species: 'Sea Turtle', biome: 'coral_sea' }
    ],
    enemies: [
      { type: 'rail_skater', col: 12.5, floor: 5, dir: 1, speed: 1.9, axis: 'h' },
      { type: 'snap_crab', col: 17.0, floor: 11, dir: -1, speed: 1.85 },
      { type: 'vent_stalker', col: 0.5, floor: 18.2, dir: 1, speed: 2.0, axis: 'v', minFloor: 17.0, maxFloor: 19.4 },
      { type: 'barnacle_mortar', col: 9.5, floor: 19, dir: -1, firePeriod: 3.0 },
      { type: 'siphon_warden', col: 15.5, floor: 22.3, dir: 1, speed: 2.2, hp: 3, maxHp: 3, isLockKeeper: true, bossTitle: 'CORAL SIPHON WARDEN', sealId: 'seal_3' }
    ]
  });

  // --------------------------------------------------------------------------
  // ACT V — POLAR & TEMPEST OCEANS ('storm_ocean', Spires 9 & 10)
  // --------------------------------------------------------------------------

  // SPIRE 9: AURORA ICEBERG BASTION (24 floors — Polar Tempest + Gecko Crystal Strip + +10 Cross-Tower Tunnel,
  // Mandatory Sea-Glass Prism Sanctum + Siphon Barrier, Polar Lock-Keeper)
  const s9Ledges = [];
  span(s9Ledges, 0, 18, 4, 'solid');
  stairFlight(s9Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent -> [4,5] at f=2
  span(s9Ledges, 3, 7, 2, 'crumble');                   // Running jump col 6 -> crumble [7,8] at f=3
  span(s9Ledges, 4, 9, 3, 'solid');                     // [9,10,11] at f=4 (Pipe-Valve 1 at 10, ice at 9)
  tile(s9Ledges, 9, 4, 'ice');
  // Glacier Gecko Strip at col 12 (f=4..8) -> [13,14,15,16] at f=8 (Pipe-Valve 2 at 15)
  span(s9Ledges, 8, 13, 4, 'solid');
  // Pipe-powered Lift s9_lift1 at col 17 (f=8..13) -> Mid-Spire Aurora Plaza [18..2] at f=13
  span(s9Ledges, 13, 18, 5, 'solid');                   // [18,19,0,1,2] at f=13 (Prism Sanctum at 0)
  tile(s9Ledges, 2, 13, 'pillar', { h: 3 });            // Bulkhead forces +10 Cross-Tower Tunnel (1 -> 11 on f=13)!
  span(s9Ledges, 13, 10, 4, 'solid');                   // Opposite side [10,11,12,13] at f=13
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s9_lift2 at col 15 (f=14..18)!
  tile(s9Ledges, 13, 13, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s9Ledges, 14, 14, 1, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Spire (f=18..22): arrives from Sanctum-Powered Lift s9_lift2 at col 15!
  span(s9Ledges, 18, 16, 4, 'ice');                     // [16,17,18,19] at f=18
  tile(s9Ledges, 17, 18, 'solid');
  // Counterweight Lift s9_lift3 at col 0 (f=18..22) -> Crown Aurora Arena [1..7] at f=22!
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
    timeLimit: 320,
    parTime: 142,
    spawn: { col: 0, floor: 0 },
    mechanics: { windForce: 0.36, windPeriod: 6.4, lightningInterval: 7.5 },
    ledges: s9Ledges,
    elevators: [
      { id: 's9_lift1', col: 17, minFloor: 8, maxFloor: 13, startFloor: 8, speed: 2.05, pipeGroup: 'pipeA', powered: false },
      { id: 's9_lift2', col: 15, minFloor: 14, maxFloor: 18, startFloor: 14, speed: 2.1, pipeGroup: 'seal_2', powered: false },
      { id: 's9_lift3', col: 0, minFloor: 18, maxFloor: 22, startFloor: 18, speed: 2.1 }
    ],
    wallStrips: [
      { id: 's9_gecko1', col: 12, minFloor: 4, maxFloor: 8 }
    ],
    grappleRings: [
      { id: 's9_ring1', col: 14.5, floor: 15.2 }
    ],
    doors: [
      { id: 's9_t1a', col: 1, floor: 13, targetId: 's9_t1b', tunnelStyle: 'stone' },
      { id: 's9_t1b', col: 11, floor: 13, targetId: 's9_t1a', tunnelStyle: 'stone' },
      { id: 's9_sanctum', col: 0, floor: 13, isRune: true, puzzleType: 'beam', puzzleSeed: 99099, puzzleDifficulty: 0.62, sealId: 'seal_2' },
      { id: 's9_crown', col: 6, floor: 22, isExit: true }
    ],
    switches: [
      { id: 's9_pipe1', col: 10, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's9_pipe2', col: 15, floor: 8, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's9_seal3_sluice', col: 2, floor: 22, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Aurora Pipe Pressure',
      s1Hint: 'Leap crumble ice, climb Glacier Vein & spin both Copper Pipe-Valves',
      s2Label: 'Aurora Prism Sanctum',
      s2Hint: 'Solve Mid-Spire Prism Sanctum & tunnel across to ride Polar Lift',
      s2DoorId: 's9_sanctum',
      s3Label: 'Polar Lock-Keeper',
      s3Hint: 'Defeat the Polar Lock-Keeper & pull the Upper Sluice Lever',
      s3SwitchId: 's9_seal3_sluice'
    }),
    collectibles: [
      { id: 's9_g1', col: 5, floor: 2, type: 'gear' },
      { id: 's9_g2', col: 14, floor: 8, type: 'gear' },
      { id: 's9_g3', col: 18, floor: 13, type: 'gear' },
      { id: 's9_g4', col: 18, floor: 18, type: 'gear' },
      { id: 's9_g5', col: 4, floor: 22, type: 'gear' },
      { id: 's9_log', col: 19, floor: 13, type: 'relic', relicId: 'relic_t9' },
      { id: 's9_seed', col: 8, floor: 23, type: 'starCore' },
      { id: 's9_cr1', col: 16, floor: 8, type: 'critter_pod', critterId: 'critter_s9_1', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's9_cr2', col: 19, floor: 18, type: 'critter_pod', critterId: 'critter_s9_2', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's9_cr3', col: 9, floor: 23, type: 'critter_pod', critterId: 'critter_s9_3', species: 'Polar Puffin', biome: 'storm_ocean' }
    ],
    enemies: [
      { type: 'snap_crab', col: 14.5, floor: 8, dir: 1, speed: 1.9 },
      { type: 'volt_eel', col: 18.5, floor: 13.5, dir: -1, speed: 2.0, amp: 0.36 },
      { type: 'vent_stalker', col: 17.5, floor: 19.2, dir: 1, speed: 2.05, axis: 'v', minFloor: 18.0, maxFloor: 20.6 },
      { type: 'barnacle_mortar', col: 18.5, floor: 18, dir: -1, firePeriod: 2.95 },
      { type: 'siphon_warden', col: 4.5, floor: 22.4, dir: -1, speed: 2.15, hp: 3, maxHp: 3, isLockKeeper: true, bossTitle: 'POLAR LOCK-KEEPER', sealId: 'seal_3' }
    ]
  });

  // SPIRE 10: THE MOTHER SIPHON CITADEL (26 floors — Grand Finale: Rising Storm Tide + Crab Springboard,
  // +10 Cross-Tower Tunnel + Mandatory Grand Tide-Locks Sanctum, Mother Siphon Prime & Final Sluice)
  const s10Ledges = [];
  span(s10Ledges, 0, 18, 4, 'solid');
  stairFlight(s10Ledges, 0, 2, 2, 1, 2, 'solid');        // 2F accent -> [4,5] at f=2
  span(s10Ledges, 3, 7, 1, 'crumble');                  // Running jump over col 6 -> crumble [7] at f=3
  span(s10Ledges, 4, 8, 6, 'solid');                    // [8,9,10,11,12,13] at f=4 (Pipe-Valve 1 at 8, Drain 1 at 10, Snap-Crab 11.5)
  span(s10Ledges, 7, 11, 3, 'solid');                   // High Valve Loft [11,12,13] at f=7 (Crab Springboard!)
  tile(s10Ledges, 12, 7, 'box');
  // Pipe-powered Lift s10_lift1 at col 14 (f=4..10) -> Mid-Spire Citadel Plaza [15..0] at f=10
  span(s10Ledges, 10, 15, 6, 'solid');                  // [15,16,17,18,19,0] at f=10
  // Mid-Spire Siphon Barrier (Seal 2) -> Sanctum-Powered Lift s10_lift_mid at col 3 (f=11..14)!
  tile(s10Ledges, 0, 10, 'laserGate', { switchGroup: 'seal_2', h: 3 });
  span(s10Ledges, 11, 1, 2, 'phaseBlock', { switchGroup: 'seal_2', inverted: false });
  // Upper Spire (f=14..24): arrives from Sanctum-Powered Lift s10_lift_mid at col 3!
  span(s10Ledges, 14, 4, 4, 'solid');                   // [4,5,6,7] at f=14 (Core Vault at 5)
  tile(s10Ledges, 8, 14, 'pillar', { h: 3 });           // Bulkhead forces +10 Cross-Tower Tunnel (7 -> 17 on f=14)!
  span(s10Ledges, 14, 16, 3, 'solid');                  // Opposite side [16,17,18] at f=14 (+4F above f=10, zero bypass!)
  stairFlight(s10Ledges, 14, 19, 2, 1, 3, 'solid');     // 2F accent -> [1,2,3] at f=16
  // Gecko Crystal Strip at col 4 (f=16..18)
  span(s10Ledges, 18, 5, 4, 'solid');                   // [5,6,7,8] at f=18 (Geyser at 8)
  tile(s10Ledges, 8, 18, 'steamVent', { phasePeriod: 3.1, phaseOffset: 0.4 });
  stairFlight(s10Ledges, 18, 9, 2, 1, 4, 'solid');      // 2F accent -> [11,12,13,14] at f=20 (Drain Valve 3 at 13)
  // Counterweight Lift s10_lift2 at col 15 (f=20..24)
  span(s10Ledges, 24, 16, 9, 'solid');                  // Grand Nexus Crown Arena [16,17,18,19,0,1,2,3,4] at f=24!
  span(s10Ledges, 25, 5, 2, 'solid');                   // Bonus perch [5,6] at f=25

  const t10 = finalizeTower({
    id: 10,
    act: 5,
    key: 'spire_10',
    name: 'THE MOTHER SIPHON CITADEL',
    subtitle: 'GRAND FINALE • PLANETARY HYDRO-NEXUS',
    theme: 'storm_ocean',
    floors: 26,
    timeLimit: 340,
    parTime: 150,
    spawn: { col: 0, floor: 0 },
    mechanics: {
      waterRiseRate: 0.08,
      windForce: 0.38,
      windPeriod: 6.2,
      lightningInterval: 7.2
    },
    ledges: s10Ledges,
    elevators: [
      { id: 's10_lift1', col: 14, minFloor: 4, maxFloor: 10, startFloor: 4, speed: 2.1, pipeGroup: 'pipeA', powered: false },
      { id: 's10_lift_mid', col: 3, minFloor: 11, maxFloor: 14, startFloor: 11, speed: 2.1, pipeGroup: 'seal_2', powered: false },
      { id: 's10_lift2', col: 15, minFloor: 20, maxFloor: 24, startFloor: 20, speed: 2.2 }
    ],
    wallStrips: [
      { id: 's10_gecko1', col: 4, minFloor: 16, maxFloor: 18 }
    ],
    grappleRings: [
      { id: 's10_ring1', col: 2.0, floor: 12.2 }
    ],
    doors: [
      { id: 's10_t1a', col: 7, floor: 14, targetId: 's10_t1b', tunnelStyle: 'stone' },
      { id: 's10_t1b', col: 17, floor: 14, targetId: 's10_t1a', tunnelStyle: 'stone' },
      { id: 's10_sanctum', col: 18, floor: 10, isRune: true, puzzleType: 'tide_locks', puzzleSeed: 101010, puzzleDifficulty: 0.72, sealId: 'seal_2' },
      { id: 's10_vault', col: 5, floor: 14, isVault: true },
      { id: 's10_crown', col: 2, floor: 24, isExit: true }
    ],
    switches: [
      { id: 's10_pipe1', col: 8, floor: 4, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's10_drain1', col: 10, floor: 4, group: 'drain', mode: 'drainValve' },
      { id: 's10_pipe2', col: 13, floor: 7, group: 'pipeA', pipeGroup: 'pipeA', mode: 'pipeValve', sealId: 'seal_1' },
      { id: 's10_drain2', col: 19, floor: 10, group: 'drain', mode: 'drainValve' },
      { id: 's10_drain3', col: 13, floor: 20, group: 'drain', mode: 'drainValve' },
      { id: 's10_seal3_sluice', col: 17, floor: 24, group: 'seal_3', mode: 'sluiceSeal', sealId: 'seal_3', requiresLockKeeper: true }
    ],
    crownSeals: makeThreeSeals({
      s1Label: 'Citadel Pipe Pressure',
      s1Hint: 'Crab-bounce onto High Balcony Valve 2 & spin both Citadel Pipe-Valves',
      s2Label: 'Grand Tide-Lock Sanctum',
      s2Hint: 'Solve the Mid-Spire Grand Tide-Locks to retract the Citadel Barrier',
      s2DoorId: 's10_sanctum',
      s3Label: 'Mother Siphon Prime',
      s3Hint: 'Defeat Mother Siphon Prime & pull the Grand Sluice Lever',
      s3SwitchId: 's10_seal3_sluice'
    }),
    collectibles: [
      { id: 's10_g1', col: 12, floor: 4, type: 'gear' },
      { id: 's10_g2', col: 16, floor: 10, type: 'gear' },
      { id: 's10_g3', col: 6, floor: 14, type: 'gear' },
      { id: 's10_g4', col: 6, floor: 18, type: 'gear' },
      { id: 's10_g5', col: 12, floor: 20, type: 'gear' },
      { id: 's10_g6', col: 19, floor: 24, type: 'gear' },
      { id: 's10_log', col: 3, floor: 24, type: 'relic', relicId: 'relic_t10' },
      { id: 's10_seed', col: 5, floor: 25, type: 'starCore' },
      { id: 's10_cr1', col: 9, floor: 4, type: 'critter_pod', critterId: 'critter_s10_1', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's10_cr2', col: 7, floor: 18, type: 'critter_pod', critterId: 'critter_s10_2', species: 'Polar Puffin', biome: 'storm_ocean' },
      { id: 's10_cr3', col: 6, floor: 25, type: 'critter_pod', critterId: 'critter_s10_3', species: 'Polar Puffin', biome: 'storm_ocean' }
    ],
    enemies: [
      { type: 'snap_crab', col: 11.5, floor: 4, dir: 1, speed: 1.85 },
      { type: 'gulp_hopper', col: 16.5, floor: 10, dir: -1, speed: 1.95 },
      { type: 'volt_eel', col: 6.5, floor: 18.4, dir: 1, speed: 2.1, amp: 0.4 },
      { type: 'barnacle_mortar', col: 14.5, floor: 20, dir: -1, firePeriod: 2.85 },
      { type: 'vent_stalker', col: 1.5, floor: 16.2, dir: 1, speed: 2.15, axis: 'v', minFloor: 15.0, maxFloor: 17.6 },
      { type: 'siphon_warden', col: 0.5, floor: 24.3, dir: -1, speed: 2.3, hp: 4, maxHp: 4, isLockKeeper: true, bossTitle: 'MOTHER SIPHON PRIME', sealId: 'seal_3' }
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

function isLaserBlockingAt(laserLedges, col, minF, maxF, mask) {
  const c = wrapCol(col);
  for (const lg of laserLedges) {
    if (lg.col !== c) continue;
    const active = lg.switchGroup
      ? lg.inverted
        ? isSwitchGroupOn(mask, lg.switchGroup)
        : !isSwitchGroupOn(mask, lg.switchGroup)
      : true;
    const lgTop = lg.floor + Math.max(0.8, Number(lg.h || 1) - 0.1);
    if (active && lgTop >= minF - 0.5 && lg.floor <= maxF + 0.8) {
      return true;
    }
  }
  return false;
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
  const enforceSeals = opts.enforceSeals !== false;
  const allowSanctumSolve = opts.allowSanctumSolve !== false;
  if (!tower || !Array.isArray(tower.ledges) || !Array.isArray(tower.doors)) {
    return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: 0 };
  }

  const exitDoors = tower.doors.filter((d) => d.isExit);
  if (exitDoors.length === 0) {
    return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: 0 };
  }

  const crownSeals = Array.isArray(tower.crownSeals) ? tower.crownSeals : [];
  let requiredSealMask = 0;
  if (enforceSeals && crownSeals.length > 0) {
    for (const cs of crownSeals) {
      const bit = GROUP_BITS[cs.id] || 0;
      if (bit) requiredSealMask |= bit;
    }
  }

  const laserLedges = tower.ledges.filter((l) => l.type === 'laserGate');
  const pillarLedges = tower.ledges.filter((l) => l.type === 'pillar');
  const isPillarBlockingAt = (col, minF, maxF) => {
    const c = wrapCol(col);
    for (const pl of pillarLedges) {
      if (pl.col !== c) continue;
      const top = pl.floor + Math.max(1, Number(pl.h || 1)) - 0.1;
      if (top >= minF + 0.1 && pl.floor <= maxF + 0.5) return true;
    }
    return false;
  };

  const supportNodes = [];
  const nodeIndicesByCoord = new Map();
  const nodesByCol = Array.from({ length: COLS }, () => []);

  const registerNode = (node) => {
    const idx = supportNodes.length;
    supportNodes.push(node);
    nodesByCol[node.col].push(idx);
    const key = `${node.col}:${node.floor}`;
    if (!nodeIndicesByCoord.has(key)) nodeIndicesByCoord.set(key, []);
    nodeIndicesByCoord.get(key).push(idx);
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
    for (let f = minF; f <= maxF; f++) {
      registerNode({
        col: c,
        floor: f,
        kind: 'elevator',
        ledge: null,
        elevatorId: elIdx,
        pipeGroup: el.powered === false && el.pipeGroup ? el.pipeGroup : null
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

  const hasCeilingAt = (col, floor, mask) => {
    const indices = nodeIndicesByCoord.get(`${wrapCol(col)}:${floor}`);
    if (!indices) return false;
    return indices.some((idx) => {
      const n = supportNodes[idx];
      return n.kind === 'ledge' && isNodeActive(n, mask);
    });
  };

  const spawnCol = wrapCol(tower.spawn?.col ?? 0);
  const spawnFloor = Math.round(tower.spawn?.floor ?? 0);
  const startCandidates = (nodeIndicesByCoord.get(`${spawnCol}:${spawnFloor}`) || []).filter((idx) =>
    isNodeActive(supportNodes[idx], 0)
  );
  if (startCandidates.length === 0) {
    return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: crownSeals.length };
  }

  const doorById = new Map(tower.doors.map((d) => [d.id, d]));
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
  const crabSpringCoords = new Set();
  for (const en of enemies) {
    if (en.type !== 'snap_crab') continue;
    const f = Math.round(en.floor);
    const sp = computeLedgeSpanAt(tower.ledges, en.col, f);
    if (sp.onRealTile) {
      for (let i = 0; i < sp.length; i++) {
        crabSpringCoords.add(`${wrapCol(sp.startCol + i)}:${f}`);
      }
    }
  }

  const isGoalNode = (node, mask) =>
    (mask & requiredSealMask) === requiredSealMask &&
    exitDoors.some((d) => wrapCol(d.col) === node.col && Math.abs(d.floor - node.floor) <= 0.5);

  const visited = new Map();
  const queue = [];

  for (const idx of startCandidates) {
    const key = `${idx}|0`;
    visited.set(key, 0);
    queue.push({ idx, mask: 0, steps: 0 });
  }

  let head = 0;
  while (head < queue.length) {
    const { idx, mask, steps } = queue[head++];
    const cur = supportNodes[idx];

    if (isGoalNode(cur, mask)) {
      return { solvable: true, minSteps: steps, reachableExit: true, crownSealsTotal: crownSeals.length };
    }

    const pushState = (nextIdx, nextMask, stepCost = 1) => {
      const k = `${nextIdx}|${nextMask}`;
      if (!visited.has(k)) {
        visited.set(k, steps + stepCost);
        queue.push({ idx: nextIdx, mask: nextMask, steps: steps + stepCost });
      }
    };

    // 1. Toggle switches, spin Pipe-Valves (multi-valve groups!), or pull Upper Sluice Levers
    for (const sw of switches) {
      const grpKey = sw.pipeGroup || sw.group;
      const dc = colDist(cur.col, sw.col);
      const sameFloor = Math.abs(sw.floor - cur.floor) <= 0.6;
      if (!sameFloor || Math.abs(dc) > 6) continue;

      let blocked = false;
      const stepDir = Math.sign(dc);
      for (let s = 1; s <= Math.abs(dc); s++) {
        const checkCol = wrapCol(cur.col + stepDir * s);
        if (
          isLaserBlockingAt(laserLedges, checkCol, cur.floor, cur.floor, mask) ||
          isPillarBlockingAt(checkCol, cur.floor, cur.floor)
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
      for (const d of tower.doors) {
        if (wrapCol(d.col) !== cur.col || Math.abs(d.floor - cur.floor) > 0.5) continue;
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
          const destIndices =
            nodeIndicesByCoord.get(`${wrapCol(target.col)}:${Math.round(target.floor)}`) || [];
          for (const destIdx of destIndices) {
            if (isNodeActive(supportNodes[destIdx], mask)) {
              pushState(destIdx, mask, 1);
            }
          }
        }
      }
    }

    // 3. Steam/Hydro-Geyser OR Flipped Snap-Crab Springboard vertical launch (+3 floors)
    const canSpringLaunch =
      cur.kind === 'ledge' &&
      (cur.ledge?.type === 'steamVent' || crabSpringCoords.has(`${cur.col}:${cur.floor}`));
    if (canSpringLaunch) {
      for (let dc = -2; dc <= 2; dc++) {
        const tc = wrapCol(cur.col + dc);
        for (const nextIdx of nodesByCol[tc]) {
          const nxt = supportNodes[nextIdx];
          if (!isNodeActive(nxt, mask)) continue;
          const df = nxt.floor - cur.floor;
          if (df >= 1 && df <= 3) {
            if (
              !isLaserBlockingAt(laserLedges, tc, cur.floor, nxt.floor, mask) &&
              !isLaserBlockingAt(laserLedges, cur.col, cur.floor, nxt.floor, mask)
            ) {
              pushState(nextIdx, mask, 1);
            }
          }
        }
      }
    }

    // 4. Tail-Grapple Swing Rings across chasms (3..4 col span)
    for (const ring of grappleRings) {
      const distToRing = colDist(cur.col, ring.col);
      const dfRing = ring.floor - cur.floor;
      if (Math.abs(distToRing) >= 1 && Math.abs(distToRing) <= 2.4 && dfRing >= -0.5 && dfRing <= 2.2) {
        const swingDir = Math.sign(distToRing) || 1;
        for (let spanStep = 1; spanStep <= 2; spanStep++) {
          const landCol = wrapCol(Math.round(ring.col + swingDir * spanStep));
          for (const nextIdx of nodesByCol[landCol]) {
            const nxt = supportNodes[nextIdx];
            if (!isNodeActive(nxt, mask)) continue;
            if (
              nxt.floor >= cur.floor - 2 &&
              nxt.floor <= cur.floor + 2 &&
              !isLaserBlockingAt(laserLedges, landCol, Math.min(cur.floor, nxt.floor), Math.max(cur.floor, nxt.floor), mask)
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
              if (hasCeilingAt(cur.col, f, mask) || isLaserBlockingAt(laserLedges, cur.col, f, f, mask)) {
                intercepted = true;
                break;
              }
            }
            if (!intercepted && !isLaserBlockingAt(laserLedges, nxt.col, nxt.floor, cur.floor, mask)) {
              pushState(nextIdx, mask, 1);
            }
          }
          continue;
        }

        if (absDc === 1) {
          const minF = Math.min(cur.floor, nxt.floor);
          const maxF = Math.max(cur.floor, nxt.floor);
          if (
            isLaserBlockingAt(laserLedges, cur.col, minF, maxF, mask) ||
            isLaserBlockingAt(laserLedges, nxt.col, minF, maxF, mask) ||
            isPillarBlockingAt(nxt.col, minF, maxF)
          ) {
            continue;
          }
          if (df === 1) {
            if (!hasCeilingAt(cur.col, cur.floor + 1, mask)) {
              pushState(nextIdx, mask, 1);
            }
          } else if (df === 0) {
            pushState(nextIdx, mask, 1);
          } else if (df < 0) {
            let blockedDrop = false;
            for (let f = cur.floor; f > nxt.floor; f--) {
              if (hasCeilingAt(nxt.col, f, mask) || isLaserBlockingAt(laserLedges, nxt.col, f, f, mask)) {
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
            isLaserBlockingAt(laserLedges, cur.col, minF, maxF, mask) ||
            isLaserBlockingAt(laserLedges, midCol, minF, maxF, mask) ||
            isLaserBlockingAt(laserLedges, nxt.col, minF, maxF, mask) ||
            isPillarBlockingAt(midCol, minF, maxF) ||
            isPillarBlockingAt(nxt.col, minF, maxF)
          ) {
            continue;
          }
          if (hasCeilingAt(cur.col, cur.floor + 1, mask)) continue;
          if (df >= 0 && hasCeilingAt(midCol, cur.floor + 1, mask)) continue;

          pushState(nextIdx, mask, 1);
        }
      }
    }
  }

  return { solvable: false, minSteps: -1, reachableExit: false, crownSealsTotal: crownSeals.length };
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

function findReachableSolidCandidates(tower) {
  const occupied = new Set();
  for (const d of tower.doors) occupied.add(`${d.col}:${d.floor}`);
  for (const sw of tower.switches) occupied.add(`${sw.col}:${sw.floor}`);
  for (const c of tower.collectibles) occupied.add(`${c.col}:${Math.round(c.floor)}`);
  occupied.add(`${tower.spawn.col}:${tower.spawn.floor}`);

  const candidates = [];
  const solidSteps = tower.ledges.filter(
    (l) => l.type === 'solid' && l.floor >= 2 && l.floor <= tower.exitFloor
  );
  for (const l of solidSteps) {
    const k = `${l.col}:${l.floor}`;
    if (occupied.has(k)) continue;
    const probe = {
      ...tower,
      doors: [
        ...tower.doors.map((d) => ({ ...d, isExit: false })),
        {
          id: '__probe__',
          col: l.col,
          floor: l.floor,
          targetId: null,
          isExit: true,
          isVault: false,
          isRune: false,
          tunnelStyle: 'stone'
        }
      ]
    };
    if (verifyTowerSolvable(probe).solvable) {
      candidates.push({ col: l.col, floor: l.floor });
      occupied.add(k);
    }
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
    mechanics.waterRiseRate = Number(Math.min(0.42, 0.24 + (depth - 1) * 0.035).toFixed(3));
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
  const collectibles = [];
  const enemies = [];

  span(ledges, 0, 18, 4, 'solid');
  let curCol = 1;
  let curFloor = 0;
  let dir = rng() < 0.5 ? 1 : -1;
  if (dir === -1) curCol = 18;

  let doorSeq = 1;
  let switchSeq = 1;
  let gearSeq = 1;
  let secretPlaced = false;
  let usedPipeA = false;
  const switchStateTracker = { red: false, cyan: false };

  const gearMult = dailyModifier?.mechanicsPatch?.doubleGears ? 2 : 1;
  const addGear = (col, floor) => {
    for (let g = 0; g < gearMult; g++) {
      collectibles.push({
        id: `${key}_g${gearSeq++}`,
        col: wrapCol(col + g),
        floor,
        type: 'gear'
      });
    }
  };

  const ENEMY_ROTATION = ['snap_crab', 'gulp_hopper', 'volt_eel', 'rail_skater', 'barnacle_mortar', 'vent_stalker'];
  const addEnemy = (en) => {
    if (!isSanctum) enemies.push(en);
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

  while (curFloor < exitFloor - 2) {
    const remaining = exitFloor - curFloor;

    if (mechanics.waterRiseRate > 0 && curFloor > 2 && curFloor % 5 <= 1) {
      switches.push({
        id: `${key}_drain_${switchSeq++}`,
        col: wrapCol(curCol),
        floor: curFloor,
        group: 'drain',
        mode: 'drainValve'
      });
    }

    const chunkPool = ['realStairFlight', 'realStairFlight', 'grappleChasm', 'conveyorFlume'];
    if (remaining >= 4) {
      chunkPool.push('geckoWallClimb', 'mechLiftShaft', 'conduitArchWarp');
      if (!usedPipeA) chunkPool.push('pipeValveLift');
    }
    if (remaining >= 3) {
      chunkPool.push('geyserUpdraftTier', 'switchPhaseSluice');
      if (isSanctum) {
        chunkPool.push('switchPhaseSluice', 'pipeValveLift', 'reversibleFlumePuzzle');
      }
      if (isFloodRush) {
        chunkPool.push('geyserUpdraftTier', 'geckoWallClimb', 'grappleChasm');
      }
    }

    const chunk = pick(chunkPool);

    // 1. Pipe-Valve Powered Mechanical Elevator
    if (chunk === 'pipeValveLift' && !usedPipeA && remaining >= 4) {
      const valveCol = wrapCol(curCol);
      const shaftCol = wrapCol(valveCol + dir * 2);
      const conflict = elevators.some((e) => e.col === shaftCol && curFloor <= e.maxFloor + 1);
      if (!conflict) {
        usedPipeA = true;
        const baseStart = dir === 1 ? wrapCol(valveCol - 1) : wrapCol(valveCol - 1);
        span(ledges, curFloor, baseStart, 3, 'solid');
        switches.push({
          id: `${key}_pipe_${switchSeq++}`,
          col: valveCol,
          floor: curFloor,
          group: 'pipeA',
          pipeGroup: 'pipeA',
          mode: 'pipeValve'
        });
        const spanH = Math.min(4, remaining - 1);
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
        const topStart = dir === 1 ? wrapCol(shaftCol + 1) : wrapCol(shaftCol - 3);
        span(ledges, curFloor + spanH, topStart, 3, 'solid');
        addGear(wrapCol(shaftCol + dir * 2), curFloor + spanH);
        curFloor += spanH;
        curCol = dir === 1 ? wrapCol(topStart + 2) : topStart;
        continue;
      }
    }

    // 2. Gecko Crystal/Moss Wall-Scamper Strip
    if (chunk === 'geckoWallClimb' && remaining >= 4) {
      const stripCol = wrapCol(curCol + dir);
      const conflict =
        elevators.some((e) => e.col === stripCol) || wallStrips.some((w) => w.col === stripCol);
      if (!conflict) {
        const climbH = Math.min(3, remaining - 1);
        tile(ledges, curCol, curFloor, 'solid');
        tile(ledges, stripCol, curFloor, 'solid');
        wallStrips.push({
          id: `${key}_gecko_${wallStrips.length + 1}`,
          col: stripCol,
          minFloor: curFloor,
          maxFloor: curFloor + climbH
        });
        const topStart = dir === 1 ? wrapCol(stripCol + 1) : wrapCol(stripCol - 3);
        span(ledges, curFloor + climbH, topStart, 3, 'solid');
        addGear(stripCol, curFloor + Math.ceil(climbH / 2));
        curFloor += climbH;
        curCol = dir === 1 ? wrapCol(topStart + 2) : topStart;
        continue;
      }
    }

    // 3. Tail-Grapple Swing Ring Chasm (+ safe stepping backup)
    if (chunk === 'grappleChasm' && remaining >= 2) {
      const launchStart = dir === 1 ? wrapCol(curCol - 1) : wrapCol(curCol - 1);
      span(ledges, curFloor, launchStart, 3, 'solid');
      const ringCol = ((curCol + dir * 2 + COLS) % COLS) + 0.2 * dir;
      grappleRings.push({
        id: `${key}_ring_${grappleRings.length + 1}`,
        col: ringCol,
        floor: curFloor + 1.4
      });
      tile(ledges, wrapCol(curCol + dir * 2), curFloor, 'crumble');
      const landCol = wrapCol(curCol + dir * 3);
      const landStart = dir === 1 ? landCol : wrapCol(landCol - 2);
      span(ledges, curFloor + 1, landStart, 3, 'solid');
      addGear(wrapCol(curCol + dir * 2), curFloor + 2);
      curFloor += 1;
      curCol = dir === 1 ? wrapCol(landStart + 2) : landStart;
      continue;
    }

    // 4. Hydro-Geyser Updraft Launch Tier
    if (chunk === 'geyserUpdraftTier' && remaining >= 3) {
      const ventCol = wrapCol(curCol + dir);
      tile(ledges, curCol, curFloor, 'solid');
      tile(ledges, ventCol, curFloor, 'steamVent', {
        phasePeriod: 3.1,
        phaseOffset: Number((rng() * 1.5).toFixed(2))
      });
      const upperStart = dir === 1 ? wrapCol(ventCol + 1) : wrapCol(ventCol - 3);
      span(ledges, curFloor + 2, upperStart, 3, 'solid');
      addGear(ventCol, curFloor + 2);
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(upperStart + 2) : upperStart;
      continue;
    }

    // 5. Standard Mechanical Elevator Shaft
    if (chunk === 'mechLiftShaft' && remaining >= 4) {
      const liftSpan = Math.min(4, remaining - 1);
      const shaftCol = wrapCol(curCol + dir);
      const conflict = elevators.some((e) => e.col === shaftCol && curFloor <= e.maxFloor + 1);
      if (!conflict) {
        elevators.push({
          id: `${key}_lift_${elevators.length + 1}`,
          col: shaftCol,
          minFloor: curFloor,
          maxFloor: curFloor + liftSpan,
          startFloor: curFloor,
          speed: Number((1.75 + Math.min(0.6, diff * 0.08)).toFixed(2))
        });
        const landStart = dir === 1 ? wrapCol(shaftCol + 1) : wrapCol(shaftCol - 3);
        span(ledges, curFloor + liftSpan, landStart, 3, 'solid');
        curFloor += liftSpan;
        curCol = dir === 1 ? wrapCol(landStart + 2) : landStart;
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

    // 6. Conduit Archway Shortcut
    if (chunk === 'conduitArchWarp' && remaining >= 4) {
      const enterCol = wrapCol(curCol);
      const exitCol = wrapCol(enterCol + 9 + randInt(0, 2));
      const jumpFloors = Math.min(3, remaining - 1);
      const targetFloor = curFloor + jumpFloors;
      const dA = `${key}_d${doorSeq}a`;
      const dB = `${key}_d${doorSeq}b`;
      doorSeq++;

      span(ledges, curFloor, dir === 1 ? wrapCol(enterCol - 1) : enterCol, 2, 'solid');
      const platStart = dir === 1 ? wrapCol(exitCol - 1) : wrapCol(exitCol - 2);
      span(ledges, targetFloor, platStart, 4, 'solid');

      doors.push(
        { id: dA, col: enterCol, floor: curFloor, targetId: dB, tunnelStyle: 'sparkArch' },
        { id: dB, col: exitCol, floor: targetFloor, targetId: dA, tunnelStyle: 'sparkArch' }
      );

      if (rng() < 0.4) dir = -dir;
      curFloor = targetFloor;
      curCol = dir === 1 ? wrapCol(platStart + 3) : platStart;
      continue;
    }

    // 7. Switch + Phase Sluice Bridge
    if (chunk === 'switchPhaseSluice' && remaining >= 3) {
      const group = switchSeq % 2 === 1 ? 'red' : 'cyan';
      const swCol = wrapCol(curCol);
      span(ledges, curFloor, dir === 1 ? wrapCol(swCol - 1) : swCol, 2, 'solid');
      switches.push({
        id: `${key}_sw_${switchSeq++}`,
        col: swCol,
        floor: curFloor,
        group,
        mode: 'toggle'
      });
      const nextGroupState = !switchStateTracker[group];
      switchStateTracker[group] = nextGroupState;

      const brStart = dir === 1 ? wrapCol(swCol + 1) : wrapCol(swCol - 2);
      span(ledges, curFloor + 1, brStart, 2, 'phaseBlock', {
        switchGroup: group,
        inverted: !nextGroupState
      });
      const brEnd = dir === 1 ? wrapCol(brStart + 1) : brStart;
      const destStart = dir === 1 ? wrapCol(brEnd + 1) : wrapCol(brEnd - 3);
      span(ledges, curFloor + 2, destStart, 3, 'solid');
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(destStart + 2) : destStart;
      addGear(brEnd, curFloor - 1);
      continue;
    }

    // 8. Reversible Hydro-Flume Puzzle
    if ((chunk === 'reversibleFlumePuzzle' || chunk === 'conveyorFlume') && remaining >= 2) {
      const swCol = wrapCol(curCol);
      span(ledges, curFloor, dir === 1 ? wrapCol(swCol - 1) : swCol, 2, 'solid');
      if (chunk === 'reversibleFlumePuzzle') {
        switches.push({
          id: `${key}_conv_${switchSeq++}`,
          col: swCol,
          floor: curFloor,
          group: 'conv',
          mode: 'conveyorFlip'
        });
      }
      const flumeType =
        chunk === 'reversibleFlumePuzzle'
          ? dir === 1
            ? 'conveyorL'
            : 'conveyorR'
          : dir === 1
          ? 'conveyorR'
          : 'conveyorL';
      const cStart = dir === 1 ? wrapCol(curCol + 1) : wrapCol(curCol - 3);
      span(ledges, curFloor + 1, cStart, 3, flumeType);
      const endCol = dir === 1 ? wrapCol(cStart + 2) : cStart;
      const nextStart = dir === 1 ? wrapCol(endCol + 1) : wrapCol(endCol - 3);
      span(ledges, curFloor + 2, nextStart, 3, 'solid');
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(nextStart + 2) : nextStart;
      continue;
    }

    // Default: Smooth Multi-Tread Real Staircase Flight! (Always 'solid' so 3D 5-riser stairs match physics 1:1!)
    const flightSteps = Math.min(3, remaining);
    const res = stairFlight(ledges, curFloor, wrapCol(curCol + dir), flightSteps, dir, 3, 'solid');
    curFloor = res.topFloor;
    curCol = res.endCol;
    addGear(res.midCol, curFloor);

    if (curFloor > 2 && rng() < 0.7) {
      addEnemy({
        type: ENEMY_ROTATION[(depth + curFloor) % ENEMY_ROTATION.length],
        col: wrapCol(res.midCol + 9) + 0.5,
        floor: curFloor,
        dir,
        speed: Number((1.65 + Math.min(0.7, diff * 0.08)).toFixed(2))
      });
    }

    if (!secretPlaced && curFloor >= Math.floor(exitFloor * 0.45) && curFloor <= exitFloor - 3) {
      const sideCol = wrapCol(curCol + dir * 2);
      const starCol = wrapCol(curCol + dir * 3);
      tile(ledges, wrapCol(curCol + dir), curFloor, 'solid');
      span(ledges, curFloor, dir === 1 ? sideCol : starCol, 2, 'solid');
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

  while (curFloor < exitFloor) {
    const res = stairFlight(ledges, curFloor, wrapCol(curCol + dir), 1, dir, 3, 'solid');
    curFloor = res.topFloor;
    curCol = res.endCol;
  }

  const summitStart = wrapCol(curCol - 2);
  span(ledges, exitFloor, summitStart, 5, 'solid');
  const exitCol = wrapCol(summitStart + 2);
  doors.push({
    id: `${key}_crown`,
    col: exitCol,
    floor: exitFloor,
    isExit: true
  });
  addGear(wrapCol(summitStart + 4), exitFloor);

  if (!secretPlaced) {
    const bonusStart = dir === 1 ? wrapCol(curCol + 3) : wrapCol(curCol - 4);
    const bonusDoorCol = dir === 1 ? wrapCol(curCol + 3) : wrapCol(curCol - 3);
    const bonusStarCol = dir === 1 ? wrapCol(curCol + 4) : wrapCol(curCol - 4);
    tile(ledges, wrapCol(curCol + dir * 2), exitFloor, 'solid');
    span(ledges, exitFloor, bonusStart, 2, 'solid');
    pushSecretDoor(bonusDoorCol, exitFloor);
    collectibles.push({ id: `${key}_seed`, col: bonusStarCol, floor: exitFloor, type: 'starCore' });
  }

  // Expedition boss encounter every 3rd spire!
  if (isExpedition && depth % 3 === 0) {
    addEnemy({
      type: 'siphon_warden',
      col: wrapCol(exitCol + 10) + 0.5,
      floor: exitFloor - 0.2,
      dir: -1,
      speed: 2.1,
      hp: 3
    });
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
    palette,
    mechanics,
    ledges,
    elevators,
    doors,
    switches,
    wallStrips,
    grappleRings,
    collectibles,
    enemies
  });

  const check = verifyTowerSolvable(tower);
  const secretDoor = tower.doors.find((d) => d.isRune || d.isVault);
  const secretReachable =
    !secretDoor ||
    verifyTowerSolvable({
      ...tower,
      doors: tower.doors.map((d) => ({ ...d, isExit: d.id === secretDoor.id }))
    }).solvable;

  if (!check.solvable || !secretReachable) {
    tower = repairProceduralTower(tower, exitCol, exitFloor);
  }

  if (isSanctum && missionType) {
    const reachSpots = findReachableSolidCandidates(tower);
    const pickAtFrac = (frac, usedIdx) => {
      if (!reachSpots.length) return { col: wrapCol(exitCol - 1), floor: exitFloor };
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
      tower.casualMission = {
        type: 'puzzle_architect',
        title: 'AQUEDUCT SANCTUM TRIAL',
        subtitle: 'Route Multi-Valve Conduits & Solve the Interior Aqueduct Sanctum',
        targetCount: 1,
        requiresRune: true
      };
    }
  }

  return tower;
}

function repairProceduralTower(tower, exitCol, exitFloor) {
  const repairMap = new Map();
  for (const l of tower.ledges) {
    const isBarrier = l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate';
    repairMap.set(isBarrier ? `${l.col}:${l.floor}:${l.type}` : `${l.col}:${l.floor}:step`, { ...l });
  }

  let elevators = [...tower.elevators];
  let wallStrips = [...(tower.wallStrips || [])];
  let switches = [...tower.switches];
  let doors = tower.doors.map((d) => ({ ...d }));

  const dropVerticalAt = (wc) => {
    elevators = elevators.filter((e) => wrapCol(e.col) !== wc);
    wallStrips = wallStrips.filter((w) => wrapCol(w.col) !== wc);
  };

  const placeSolidAt = (col, fl) => {
    const wc = wrapCol(col);
    dropVerticalAt(wc);
    repairMap.delete(`${wc}:${fl}:laserGate`);
    repairMap.set(`${wc}:${fl}:step`, {
      col: wc,
      floor: fl,
      type: 'solid',
      switchGroup: null,
      pipeGroup: null,
      inverted: false,
      phasePeriod: 3.2,
      phaseOffset: 0
    });
  };

  const forceClearStepAndLaser = (col, fl) => {
    const wc = wrapCol(col);
    repairMap.delete(`${wc}:${fl}:step`);
    repairMap.delete(`${wc}:${fl}:laserGate`);
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

  // Build a guaranteed 2-column-wide non-overlapping +1 spiral staircase ending directly at (exitCol, exitFloor)
  const sf = Math.round(tower.spawn.floor);
  const stairPairAt = new Map();
  for (let f = exitFloor; f >= sf; f--) {
    const d = exitFloor - f;
    stairPairAt.set(f, [wrapCol(exitCol - 2 * d - 1), wrapCol(exitCol - 2 * d)]);
  }

  const [startStairBack] = stairPairAt.get(sf);
  let hc = wrapCol(tower.spawn.col);
  placeSolidAt(hc, sf);
  while (hc !== startStairBack) {
    const d = colDist(hc, startStairBack);
    hc = wrapCol(hc + Math.sign(d));
    placeSolidAt(hc, sf);
  }
  placeSolidAt(wrapCol(hc + 1), sf);

  for (let f = sf; f <= exitFloor; f++) {
    const [cBack, cFront] = stairPairAt.get(f);
    placeSolidAt(cBack, f);
    placeSolidAt(cFront, f);
    if (f < exitFloor) {
      forceClearStepAndLaser(cBack, f + 1);
      forceClearStepAndLaser(cFront, f + 1);
    }
  }

  let secretOffset = 2;
  for (const sd of doors) {
    if (!sd.isRune && !sd.isVault) continue;
    const targetSecretCol = wrapCol(exitCol + secretOffset);
    for (let s = 1; s <= secretOffset + 1; s++) {
      placeSolidAt(wrapCol(exitCol + s), exitFloor);
    }
    sd.col = targetSecretCol;
    sd.floor = exitFloor;
    delete sd.clueColOffset;
    secretOffset += 2;
  }

  return finalizeTower({
    ...tower,
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
      casualMission: { type: 'puzzle_architect', title: 'DUAL FLOODGATE MASTER', subtitle: 'Raise Both Glacial Floodgates • Crack Core Vault • Reach Crown', targetCount: 1, requiresRune: true }
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
      casualMission: { type: 'puzzle_architect', title: 'FLIP-CRAB VAULT', subtitle: 'Tail-Whip Training Crabs into Springboards • Vault to Core Chamber', targetCount: 1, requiresRune: true }
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
    span(L, 12, 14, 4, 'solid'); // [14,15,16,17] f=12 (Bells Sanctum at 16)
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
      casualMission: { type: 'puzzle_architect', title: 'CORAL LOCKS', subtitle: 'Pressurize Pipe A & B • Harmonize Coral Bells Sanctum', targetCount: 1, requiresRune: true }
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
      hp: 4, speed: 2.05, windForce: 0, lightningInterval: 0
    },
    {
      act: 2, theme: 'alpine_lake', name: 'ACT II • GLACIER CRYO-WARDEN',
      subtitle: 'WARDEN GAUNTLET 2/5 • ALPINE ARENA', bossTitle: 'GLACIER CRYO-WARDEN',
      hp: 4, speed: 2.15, windForce: 0.28, lightningInterval: 0
    },
    {
      act: 3, theme: 'mist_bayou', name: 'ACT III • BAYOU MIRE-HYDRA',
      subtitle: 'WARDEN GAUNTLET 3/5 • BAYOU ARENA', bossTitle: 'BAYOU MIRE-HYDRA',
      hp: 5, speed: 2.25, windForce: 0, lightningInterval: 9.0
    },
    {
      act: 4, theme: 'coral_sea', name: 'ACT IV • CORAL REEF TYRANT',
      subtitle: 'WARDEN GAUNTLET 4/5 • CORAL ARENA', bossTitle: 'CORAL REEF TYRANT',
      hp: 5, speed: 2.35, windForce: 0.25, lightningInterval: 0
    },
    {
      act: 5, theme: 'storm_ocean', name: 'ACT V • MOTHER SIPHON PRIME',
      subtitle: 'WARDEN GAUNTLET 5/5 • APEX LEVIATHAN', bossTitle: 'MOTHER SIPHON PRIME',
      hp: 6, speed: 2.5, windForce: 0.36, lightningInterval: 6.8
    }
  ];

  return specs.map((sp) => {
    const L = [];
    // Continuous circular lower combat ring (f=1) + twin stairways up to upper tactical decks (f=4) + geysers & grapple rings!
    span(L, 1, 0, 20, 'solid');
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
