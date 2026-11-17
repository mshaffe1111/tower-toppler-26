// Tower Toppler '26 — Cell-for-Cell 1987 Classic Towers, 8 Reboot Story Monoliths,
// 4-Sector Archipelago World Metadata, Rune Doors, & Verified Procedural/Daily Generator
// Pure leaf module (zero internal imports per ARCHITECTURE_CONTRACT.md §1)

export const COLS = 16;

function wrapCol(c) {
  return ((Math.round(c) % COLS) + COLS) % COLS;
}

function colDist(a, b) {
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
 * Returns UTC daily challenge seed & ISO date key: { seed: 20261116, dateKey: '2026-11-16' }.
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
// 4-SECTOR OPERATION NEBULUS ARCHIPELAGO WORLD MAP METADATA
// ============================================================================

export const SECTOR_WORLDS = [
  {
    id: 1,
    key: 'sector_1',
    code: 'SECTOR I',
    name: 'THE DROWNED WATCH',
    subtitle: 'SECTOR I • STORM APPROACH',
    lore: 'Moonlit watchtowers battered by surging abyssal tides and bioluminescent mist.',
    blurb: 'Moonlit watchtowers battered by surging abyssal tides and bioluminescent mist.',
    skyTheme: 'moonlit_storm',
    accentColor: '#5efce8',
    towerIds: [1, 2],
    towers: [1, 2],
    routeType: 'submarine',
    exitRouteType: 'glide',
    intraRoute: { type: 'submarine', mode: 'submarine', badge: 'SUB', label: 'SEA ROUTE • MK.7 SUB-HUNTER', title: 'MK.7 Sub-Hunter' },
    summitRoute: { type: 'glide', mode: 'glide', badge: 'GLIDE', label: 'SUMMIT SKY-WING • THE GLIDE', title: 'The Glide (Sky-Wing)' }
  },
  {
    id: 2,
    key: 'sector_2',
    code: 'SECTOR II',
    name: 'SMELTER & BOREAL REACH',
    subtitle: 'SECTOR II • FIRE & FROST',
    lore: 'Soot-darkened steam foundries rising into howling gale-force arctic monoliths.',
    blurb: 'Soot-darkened steam foundries rising into howling gale-force arctic monoliths.',
    skyTheme: 'boreal_aurora',
    accentColor: '#67e8f9',
    towerIds: [3, 4],
    towers: [3, 4],
    routeType: 'skimmer',
    exitRouteType: 'glide',
    intraRoute: { type: 'skimmer', mode: 'skimmer', badge: 'SKIM', label: 'STORM SPRINT • HYDRO-SKIMMER', title: 'Hydro-Skimmer Run' },
    summitRoute: { type: 'glide', mode: 'glide', badge: 'GLIDE', label: 'SUMMIT SKY-WING • THE GLIDE', title: 'The Glide (Sky-Wing)' }
  },
  {
    id: 3,
    key: 'sector_3',
    code: 'SECTOR III',
    name: 'ARCANE & HYDRAULIC TRENCH',
    subtitle: 'SECTOR III • PRISM & IRON',
    lore: 'Crystalline laser labyrinths anchored beside colossal offshore hydraulic piston rigs.',
    blurb: 'Crystalline laser labyrinths anchored beside colossal offshore hydraulic piston rigs.',
    skyTheme: 'prism_twilight',
    accentColor: '#e879f9',
    towerIds: [5, 6],
    towers: [5, 6],
    routeType: 'submarine',
    exitRouteType: 'glide',
    intraRoute: { type: 'submarine', mode: 'submarine', badge: 'SUB', label: 'SEA ROUTE • MK.7 SUB-HUNTER', title: 'MK.7 Sub-Hunter' },
    summitRoute: { type: 'glide', mode: 'glide', badge: 'GLIDE', label: 'SUMMIT SKY-WING • THE GLIDE', title: 'The Glide (Sky-Wing)' }
  },
  {
    id: 4,
    key: 'sector_4',
    code: 'SECTOR IV',
    name: 'MAELSTROM CORE',
    subtitle: 'SECTOR IV • ECLIPSED REACTOR',
    lore: 'Blackout thunder-citadels guarding the master Apex reactor at the eye of the maelstrom.',
    blurb: 'Blackout thunder-citadels guarding the master Apex reactor at the eye of the maelstrom.',
    skyTheme: 'maelstrom_storm',
    accentColor: '#fbbf24',
    towerIds: [7, 8],
    towers: [7, 8],
    routeType: 'skimmer',
    exitRouteType: null,
    intraRoute: { type: 'skimmer', mode: 'skimmer', badge: 'SKIM', label: 'STORM SPRINT • HYDRO-SKIMMER', title: 'Hydro-Skimmer Run' },
    summitRoute: null
  }
];

const DEFAULT_MECHANICS = Object.freeze({
  waterBaseFloor: -0.55,
  waterRiseRate: 0,
  windForce: 0,
  windPeriod: 6.0,
  blackoutCycle: 0,
  lightningInterval: 0
});

// ============================================================================
// VERBATIM CELL-FOR-CELL 1987 TOWER DATA (Atari 7800 / Hewson Nebulus)
// ============================================================================

export const REAL_TIME_LIMITS = [100, 120, 140, 160, 180, 200, 220, 240];

export const REAL_TOWER_GRIDS = {
  1: [ // THE TOWER OF EYES (47 rows, 100s)
    "                ",
    "                ",
    " #  T    #      ",
    " #  T    #      ",
    " #  T    #      ",
    " ----    --v6   ",
    "#!      # !     ",
    "#!      # !     ",
    "#!      # !^    ",
    "--   v.-- ------",
    "                ",
    "                ",
    "       1        ",
    "      ---       ",
    "                ",
    "                ",
    "         4      ",
    "                ",
    "    -       --v ",
    "    !       !   ",
    "    !  2    !   ",
    "    -.-------   ",
    "     .          ",
    "     .          ",
    "     ^          ",
    " #   -   #      ",
    " #       #      ",
    " #     4 #  3 ^ ",
    " ->>     ------ ",
    "    >>          ",
    "      >         ",
    "       >    b   ",
    "        >3  b   ",
    "         -----v ",
    "                ",
    "                ",
    "                ",
    "         1    ^ ",
    "        ----v-- ",
    "                ",
    "      #       # ",
    "      #       # ",
    "      # 4   ^ # ",
    "  #   v   # --- ",
    "  #       #     ",
    "  #   ^   #     ",
    "---..------     ",
    "                "
  ],
  2: [ // THE REALM OF ROBOTS (71 rows, 120s)
    "                ",
    "                ",
    "     T          ",
    "     T          ",
    "     T          ",
    "     v          ",
    "                ",
    "                ",
    "                ",
    "    -.-         ",
    "       -        ",
    " 7      ---     ",
    "     ^     -    ",
    "     --     --- ",
    "               -",
    "--         7    ",
    " #-      #      ",
    " # -     #      ",
    " #  -    #      ",
    " .   -----v     ",
    " .              ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "    #       #   ",
    "    #       #   ",
    "    #       #   ",
    "   ---v 6       ",
    " --             ",
    "-              -",
    "          ^  -- ",
    "          ---   ",
    "                ",
    "                ",
    "                ",
    "          4     ",
    "                ",
    "                ",
    "                ",
    "           >>v  ",
    "          -     ",
    "  #      -#     ",
    "  #     - # 4   ",
    "  #   ^-  #     ",
    "  -v  -   --    ",
    "  !       !     ",
    "  !6      !     ",
    "  !       !  ^  ",
    "  !^      ----  ",
    " v---           ",
    "     >          ",
    "      >         ",
    "       >    4   ",
    " ^      -       ",
    " -v  #   -   #  ",
    "     #    -  #  ",
    "     #     - #  ",
    "     --v    --  ",
    "  ^             ",
    " --            -",
    "       ^5v      ",
    "       -        ",
    "                ",
    "         ^      ",
    "-..     --- - --",
    "                "
  ],
  3: [ // TRAP OF TRICKS (49 rows, 140s)
    "                ",
    "                ",
    "    T           ",
    "    T           ",
    "    T           ",
    "   v-      ---  ",
    "                ",
    "                ",
    "       #       #",
    "       #       #",
    "       #       #",
    "       --v      ",
    "    #       #   ",
    "    #    6  #   ",
    "   ^#       # --",
    "   --       --  ",
    "                ",
    "                ",
    "                ",
    "                ",
    "         b      ",
    "         b      ",
    "          ---   ",
    "    6        -  ",
    "              - ",
    "     v-        -",
    "-      - ^      ",
    " -      -- 4    ",
    "  -             ",
    "   -- 4         ",
    "           -v   ",
    "                ",
    "          -     ",
    "     ^          ",
    "     -----      ",
    "     !#       # ",
    "     !#       # ",
    "     !#       # ",
    "  -v-----v      ",
    "                ",
    "                ",
    "                ",
    "        3   ^   ",
    "    -----.  --- ",
    "                ",
    "    #       #   ",
    "    #       #   ",
    "   ^#    ^3 #   ",
    "-  --    -------",
    "                "
  ],
  4: [ // SLIPPERY SLIDE (66 rows, 160s)
    "                ",
    "                ",
    "         T      ",
    "         T      ",
    "         T      ",
    " v-      ---v   ",
    "  !        !    ",
    "  !        !    ",
    "  !  2 2   !    ",
    "  ----.-----    ",
    "      .         ",
    "      .         ",
    "      .         ",
    "      .         ",
    "      .         ",
    "      --..-     ",
    "                ",
    "                ",
    "            ^   ",
    "           --   ",
    "                ",
    " 3              ",
    " ^ -            ",
    " -- -.-         ",
    "       -        ",
    "        -       ",
    "         - 4    ",
    "     -v-  - 4   ",
    "           -    ",
    "       #    -  #",
    "    6  #     - #",
    "       #      -#",
    "   --- ----    -",
    "           -    ",
    "            -   ",
    "                ",
    "    3           ",
    " v---           ",
    "    !-^ 44      ",
    "- # ! -   #     ",
    "  # !     #     ",
    "# # !  -# #     ",
    "#b-v-   # -     ",
    "#     # #-    # ",
    "-b    # -     # ",
    "    3 #       #-",
    " ^  ---       - ",
    " -              ",
    "                ",
    "                ",
    "     #       #  ",
    "#    #  #    #  ",
    "#  ^ #  #    #  ",
    "#  ---  #    -  ",
    "-       -v    -.",
    "  b             ",
    "  b      b      ",
    "  >>>>>v        ",
    " -       ^      ",
    "-        -------",
    "    4           ",
    "                ",
    "   - - ^        ",
    "  -   4-        ",
    " -              ",
    "-   . .    -----",
    "                "
  ],
  5: [ // BROKEN PATH (96 rows, 180s)
    "                ",
    "                ",
    "    -     T     ",
    "     -    T     ",
    "          T     ",
    "    4     -v    ",
    "     4    !     ",
    "          !     ",
    "          !     ",
    "          !     ",
    "  23      !^    ",
    "---------v------",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "       #       #",
    "     7 #       #",
    "  5  # # ^   # #",
    "     # - --- #  ",
    "   # #-    #-#  ",
    "   # -     # -  ",
    " # #-    # #    ",
    " # -     #      ",
    " #-   4# #     #",
    " -     # -     #",
    "     # #-    # #",
    "     # -     #  ",
    "   # #-    # #  ",
    "   # -     #    ",
    "   #-      #    ",
    "   -       v    ",
    "                ",
    "                ",
    "   6-v-         ",
    "                ",
    " -           4  ",
    "  -         5   ",
    "   -   >>       ",
    "    - -         ",
    ">             >>",
    "             -  ",
    "           ^-   ",
    "       4   -    ",
    "                ",
    "                ",
    "   -  #       # ",
    "   v  #       # ",
    "      # --    # ",
    "           v-.. ",
    "       -        ",
    "                ",
    "     b          ",
    "       5        ",
    "-v      - - - --",
    "     ^   4      ",
    "     ---        ",
    "         .      ",
    "                ",
    "                ",
    "    7           ",
    "          -     ",
    "                ",
    "                ",
    "- - - - -v5     ",
    "           ^    ",
    "  -       --    ",
    " . .            ",
    "                ",
    " b              ",
    " b              ",
    " ^ ^            ",
    " ---            ",
    "                ",
    "    7           ",
    "         ^      ",
    "        --      ",
    "       -        ",
    "   #  -    #    ",
    "   # -     #    ",
    "   #-      #    ",
    "   -       -    ",
    "          -     ",
    "         -    3 ",
    "-v      -     --",
    "   4  v-      ! ",
    "      b       ! ",
    "        2     ! ",
    " +--.- -.------ ",
    "                ",
    "                ",
    "                ",
    " ^    ^         ",
    "--    ----      ",
    "                "
  ],
  6: [ // SWIMMER'S DELIGHT (64 rows, 200s)
    "                ",
    "                ",
    "  T             ",
    "  T             ",
    "  T             ",
    "  -             ",
    "          6     ",
    " -              ",
    "    6           ",
    "-               ",
    "            6   ",
    "               -",
    "      6         ",
    "              - ",
    "                ",
    "          -  -  ",
    "       -        ",
    "         b  -   ",
    "                ",
    "      -  v -    ",
    "     -          ",
    "  v--     5     ",
    "           4    ",
    "                ",
    "                ",
    "            4   ",
    "           --v  ",
    "         ^-     ",
    "         -      ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "             ^  ",
    "v    - v------  ",
    "      -         ",
    " #.     -#      ",
    " #   5   #      ",
    "^#.      #      ",
    "--       --5-   ",
    "  .   5^        ",
    "   v----     -  ",
    " #. #    #  #   ",
    " #  #    #  # - ",
    " #^^#    #  #   ",
    "-----    ----  -",
    " -      -       ",
    "       -        ",
    "  b   -         ",
    "- v---        v-",
    " #       #      ",
    " #       #      ",
    " #       #    b ",
    "  ^--v 4 -5     ",
    "  -       -v    ",
    "4               ",
    "              ^ ",
    " - v- --     ---",
    "    !           ",
    "    !b          ",
    "   ^!^  5  ^    ",
    "------------    ",
    "                "
  ],
  7: [ // NASTY ONE (80 rows, 220s — authentically ZERO tunnel doors!)
    "                ",
    "                ",
    " T              ",
    " T              ",
    " T              ",
    " v              ",
    "                ",
    "                ",
    "            2  2",
    "-.       v------",
    "                ",
    "                ",
    "              22",
    "-.        v-----",
    "                ",
    "                ",
    "     2          ",
    " .------v       ",
    "                ",
    "                ",
    "  2             ",
    " ^-- --v        ",
    " -  -           ",
    "                ",
    "                ",
    "                ",
    "                ",
    "    4           ",
    "   4 4          ",
    "                ",
    "       ^^^^     ",
    "  v--------     ",
    "                ",
    "                ",
    "        7       ",
    "                ",
    "           -   -",
    "- ^    -- - - - ",
    " --   v  -   -  ",
    "                ",
    "                ",
    "     6          ",
    "      ^  4      ",
    "    ---         ",
    " - -       - - -",
    ". .       - . . ",
    "         -      ",
    "       v-       ",
    "                ",
    "                ",
    "                ",
    "    6 v         ",
    "       ^        ",
    "       -        ",
    "                ",
    "    6v          ",
    "      ^         ",
    "      -         ",
    "                ",
    "     6          ",
    "     b          ",
    "     b          ",
    "   - ^          ",
    "  - --  v-      ",
    " -        -     ",
    "-          -    ",
    "            ----",
    "     v--.   v   ",
    "                ",
    "                ",
    "              4 ",
    "     +-.b       ",
    "       v     5 5",
    "                ",
    "     6      ^   ",
    "       ^    -   ",
    "   --.--.-   -  ",
    "  -           - ",
    " -   ^  ^      -",
    "-    -----      ",
    "                "
  ],
  8: [ // EDGE OF DOOM (96 rows, 240s — 8-door summit ring #### #T##!)
    "                ",
    "                ",
    " ####    #T##   ",
    " ####    #T##   ",
    " ####    #T##   ",
    "         ----v  ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "   -            ",
    " .  -           ",
    "     -          ",
    "      -      b  ",
    "    4  -        ",
    "- -#    -  #  - ",
    "   #     - #    ",
    "   #      -# b  ",
    "   -  4    -    ",
    "    -        ^ .",
    "     -       -  ",
    "      -v        ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "   v---         ",
    "                ",
    "                ",
    "                ",
    "           6    ",
    "                ",
    "    -    -      ",
    "     - b-       ",
    "      -b        ",
    "       ^        ",
    "--- --------v---",
    "                ",
    "      7         ",
    "                ",
    "                ",
    "   ^            ",
    "   -..------+   ",
    "                ",
    "                ",
    "                ",
    "     1          ",
    "  v --.--       ",
    "#       #       ",
    "#       #       ",
    "#       #1     -",
    "-    ------   - ",
    "             -  ",
    "            .   ",
    "            .   ",
    "            .   ",
    " - #       #.   ",
    " - #   #   #.  #",
    "   #   #   #^  #",
    "  b-v  # - --  #",
    "-      -       -",
    "                ",
    "                ",
    "  b             ",
    "  ^ ^ -   -4-v  ",
    "  ---   -4      ",
    "       4        ",
    "     4          ",
    "                ",
    "     -   - - ^  ",
    "#   -  -#    -  ",
    "#  -    #       ",
    "# -     #       ",
    "--   #  --v  #  ",
    "     #       #  ",
    "     #       #  ",
    "   3 --v  .---  ",
    "  3-            ",
    "3 - -           ",
    "-             3 ",
    " -   -    b   - ",
    "   -        -  -",
    "             -  ",
    "                ",
    "                ",
    "                ",
    "     4          ",
    "    4           ",
    "   4            ",
    "  4    ^  ^     ",
    "--------  -     ",
    "                "
  ]
};

// ============================================================================
// SHARED BUILDERS & NORMALIZATION HELPERS
// ============================================================================

function span(ledges, floor, startCol, count, type = 'solid', extra = {}) {
  for (let i = 0; i < count; i++) {
    ledges.push({
      col: wrapCol(startCol + i),
      floor,
      type,
      switchGroup: extra.switchGroup ?? null,
      inverted: Boolean(extra.inverted),
      phasePeriod: extra.phasePeriod ?? 3.2,
      phaseOffset: extra.phaseOffset ?? 0,
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
    inverted: Boolean(extra.inverted),
    phasePeriod: extra.phasePeriod ?? 3.2,
    phaseOffset: extra.phaseOffset ?? 0,
    ...(extra.h !== undefined ? { h: extra.h } : {})
  });
}

function normalizeEnemy(en) {
  return {
    type: en.type,
    col: ((Number(en.col) % COLS) + COLS) % COLS,
    floor: Number(en.floor),
    dir: en.dir === -1 ? -1 : 1,
    speed: Number(en.speed ?? en.kspeed ?? 1.6),
    amp: Number(en.amp ?? (en.type === 'bouncer' ? 0.65 : en.type === 'molecule' ? 0.4 : 0.25)),
    minFloor: en.minFloor !== undefined && en.minFloor !== null ? Number(en.minFloor) : null,
    maxFloor: en.maxFloor !== undefined && en.maxFloor !== null ? Number(en.maxFloor) : null,
    ...(en.kind !== undefined ? { kind: en.kind } : {}),
    ...(en.kspeed !== undefined ? { kspeed: Number(en.kspeed) } : {}),
    ...(en.spawnKey !== undefined ? { spawnKey: en.spawnKey } : {}),
    ...(en.minCol !== undefined ? { minCol: wrapCol(en.minCol) } : {}),
    ...(en.maxCol !== undefined ? { maxCol: wrapCol(en.maxCol) } : {})
  };
}

function computeLedgeSpanAt(ledges, col, floor) {
  const hasTile = (c) =>
    ledges.some(
      (l) =>
        l.type !== 'box' &&
        l.type !== 'pillar' &&
        l.type !== 'laserGate' &&
        Math.abs(l.floor - floor) < 0.25 &&
        wrapCol(l.col) === wrapCol(c)
    );
  const startTile = Math.floor(wrapCol(col));
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
  if (en.type === 'robotV') {
    return [en.minFloor ?? en.floor - 1.5, en.maxFloor ?? en.floor + 1.5];
  }
  if (en.type === 'molecule') {
    const amp = en.amp || 0.4;
    return [en.floor - amp, en.floor + amp];
  }
  if (en.type === 'bouncer') {
    const amp = en.amp || 0.65;
    return [en.floor, en.floor + amp];
  }
  return [en.floor, en.floor];
}

function sanitizeEnemySpawns(enemies, doors, elevators, spawn, ledges, totalFloors) {
  const anchors = [{ col: wrapCol(spawn.col) + 0.5, floor: spawn.floor }];
  for (const d of doors) {
    anchors.push({ col: wrapCol(d.col) + 0.5, floor: d.floor });
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
    const relevantForFloor = (testFloor) => {
      const probe = { ...en, floor: testFloor };
      const [minY, maxY] = enemyVertEnvelope(probe);
      return anchors.filter((a) => {
        const rawDf = Math.abs(testFloor - a.floor);
        const oscDf = a.floor < minY ? minY - a.floor : a.floor > maxY ? a.floor - maxY : 0;
        return rawDf < 0.95 || oscDf < 0.72;
      });
    };

    if (en.type === 'robotH') {
      const fRound = Math.round(en.floor);
      const sp = computeLedgeSpanAt(ledges, en.col, fRound);
      const rel = relevantForFloor(en.floor);
      let spanUnsafe = !sp.onRealTile || sp.length < 2;
      if (!spanUnsafe && rel.length > 0) {
        for (const a of rel) {
          for (let k = 0; k < sp.length; k++) {
            const tileCenter = wrapCol(sp.startCol + k) + 0.5;
            if (Math.abs(colDist(tileCenter, a.col)) < 1.5) {
              spanUnsafe = true;
              break;
            }
          }
          if (spanUnsafe) break;
        }
      }
      const minAnchorDist = rel.reduce((m, a) => Math.min(m, Math.abs(colDist(en.col, a.col))), Infinity);
      if (spanUnsafe || minAnchorDist < 4.2) {
        en.type = 'roller';
        delete en.minCol;
        delete en.maxCol;
      } else {
        return en;
      }
    }

    const bestColForFloor = (testFloor) => {
      const rel = relevantForFloor(testFloor);
      if (rel.length === 0) return { col: en.col, minDist: Infinity };
      const curMin = rel.reduce((m, a) => Math.min(m, Math.abs(colDist(en.col, a.col))), Infinity);
      if (curMin >= 4.2) return { col: en.col, minDist: curMin };

      let bestCol = en.col;
      let bestMin = curMin;
      for (let step = 0; step < 32; step++) {
        const cand = (((en.col + 5 + step * 0.5) % COLS) + COLS) % COLS;
        const dMin = rel.reduce((m, a) => Math.min(m, Math.abs(colDist(cand, a.col))), Infinity);
        if (dMin > bestMin + 1e-6) {
          bestMin = dMin;
          bestCol = cand;
        }
      }
      return { col: bestCol, minDist: bestMin };
    };

    let pick = bestColForFloor(en.floor);
    if (pick.minDist < 4.2 && en.type !== 'robotV') {
      for (const df of [1, -1, 2, -2]) {
        const nf = en.floor + df;
        if (nf < 1.5 || nf > totalFloors - 2.2) continue;
        const alt = bestColForFloor(nf);
        if (alt.minDist > pick.minDist + 0.25) {
          en.floor = Number(nf.toFixed(2));
          pick = alt;
          if (pick.minDist >= 4.5) break;
        }
      }
    }
    en.col = Number(pick.col.toFixed(2));
    return en;
  });
}

function finalizeTower({
  id,
  key,
  era = 'reboot',
  real = false,
  casual = false,
  casualMission = null,
  workbench = null,
  treasureChest = null,
  cacheKey = null,
  name,
  subtitle = '',
  theme = 'mist',
  floors = 18,
  exitFloor = null,
  timeLimit = 95,
  parTime = 35,
  spawn = { col: 0, floor: 0 },
  palette,
  mechanics = {},
  ledges = [],
  elevators = [],
  doors = [],
  switches = [],
  collectibles = [],
  enemies = []
}) {
  const normElevators = elevators.map((el) => ({
    col: wrapCol(el.col),
    minFloor: Number(el.minFloor),
    maxFloor: Number(el.maxFloor),
    startFloor: Number(el.startFloor ?? el.minFloor),
    speed: Number(el.speed ?? 1.6),
    ...(Array.isArray(el.stops) ? { stops: [...el.stops] } : {}),
    ...(el.rowsPerSec !== undefined ? { rowsPerSec: Number(el.rowsPerSec) } : {})
  }));

  // Keep step ledges separate from body-height barriers ('box' | 'pillar' | 'laserGate')
  // so shooting a 'box' preserves the floor underneath!
  // For non-real (Reboot/Procedural) towers, keep cage-elevator shafts clear of static steps.
  const byCoord = new Map();
  for (const raw of ledges) {
    const c = wrapCol(raw.col);
    const f = Math.round(Number(raw.floor));
    const t = raw.type || 'solid';
    const isBarrier = t === 'box' || t === 'pillar' || t === 'laserGate';
    if (!real && !isBarrier) {
      const inShaft = normElevators.some((el) => el.col === c && f >= el.minFloor && f <= el.maxFloor);
      if (inShaft) continue;
    }
    const slotKey = isBarrier ? `${c}:${f}:${t}` : `${c}:${f}:step`;
    byCoord.set(slotKey, {
      col: c,
      floor: f,
      type: t,
      switchGroup: raw.switchGroup ?? null,
      inverted: Boolean(raw.inverted),
      phasePeriod: Number(raw.phasePeriod ?? 3.2),
      phaseOffset: Number(raw.phaseOffset ?? 0),
      ...(raw.h !== undefined ? { h: Number(raw.h) } : {})
    });
  }

  const spawnCol = wrapCol(spawn.col);
  const spawnFloor = Math.round(Number(spawn.floor));
  if (!real && !byCoord.has(`${spawnCol}:${spawnFloor}:step`)) {
    byCoord.set(`${spawnCol}:${spawnFloor}:step`, {
      col: spawnCol,
      floor: spawnFloor,
      type: 'solid',
      switchGroup: null,
      inverted: false,
      phasePeriod: 3.2,
      phaseOffset: 0
    });
  }

  const normDoors = doors.map((d) => {
    const dc = wrapCol(d.col);
    const df = Math.round(Number(d.floor));
    if (!real && !byCoord.has(`${dc}:${df}:step`)) {
      byCoord.set(`${dc}:${df}:step`, {
        col: dc,
        floor: df,
        type: 'solid',
        switchGroup: null,
        inverted: false,
        phasePeriod: 3.2,
        phaseOffset: 0
      });
    }
    const isExit = Boolean(d.isExit);
    const isVault = Boolean(d.isVault);
    const isRune = Boolean(d.isRune);
    return {
      id: String(d.id),
      col: dc,
      floor: df,
      targetId: isExit || isVault || isRune ? null : d.targetId ?? null,
      isExit,
      isVault,
      isRune,
      decoy: Boolean(d.decoy),
      ...(d.puzzleType ? { puzzleType: String(d.puzzleType) } : {}),
      ...(d.puzzleSeed !== undefined && d.puzzleSeed !== null ? { puzzleSeed: Number(d.puzzleSeed) } : {}),
      tunnelStyle: d.tunnelStyle === 'sparkArch' ? 'sparkArch' : 'stone'
    };
  });

  const normSwitches = switches.map((sw, idx) => {
    const sc = wrapCol(sw.col);
    const sf = Math.round(Number(sw.floor));
    if (!real && !byCoord.has(`${sc}:${sf}:step`)) {
      byCoord.set(`${sc}:${sf}:step`, {
        col: sc,
        floor: sf,
        type: 'solid',
        switchGroup: null,
        inverted: false,
        phasePeriod: 3.2,
        phaseOffset: 0
      });
    }
    return {
      id: String(sw.id || `sw_${idx + 1}`),
      col: sc,
      floor: sf,
      group: sw.group || 'red',
      mode: sw.mode || 'toggle'
    };
  });

  const VALID_COLLECTIBLE_TYPES = new Set([
    'gear',
    'starCore',
    'relic',
    'salvage_part',
    'compass_key',
    'curio'
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
      ...(c.partIndex !== undefined ? { partIndex: Number(c.partIndex) } : {}),
      ...(c.keyIndex !== undefined ? { keyIndex: Number(c.keyIndex) } : {}),
      ...(c.label ? { label: String(c.label) } : {})
    };
  });

  const exitDoor = normDoors.find((d) => d.isExit);
  const computedExitFloor = exitFloor !== null ? Number(exitFloor) : (exitDoor ? exitDoor.floor : Math.max(1, floors - 2));

  const sortedLedges = Array.from(byCoord.values()).sort((a, b) => a.floor - b.floor || a.col - b.col);
  const clampedFloors = Math.max(8, Math.round(Number(floors)));
  const normEnemies = casual
    ? []
    : real
    ? enemies.map(normalizeEnemy)
    : sanitizeEnemySpawns(
        enemies.map(normalizeEnemy),
        normDoors,
        normElevators,
        { col: spawnCol, floor: spawnFloor },
        sortedLedges,
        clampedFloors
      );

  return {
    id: Number(id),
    key: String(key),
    ...(cacheKey ? { cacheKey: String(cacheKey) } : {}),
    real: Boolean(real),
    casual: Boolean(casual),
    casualMission: casualMission ? { ...casualMission } : null,
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
    era: era === 'original' ? 'original' : 'reboot',
    name: String(name),
    subtitle: String(subtitle),
    theme: String(theme),
    floors: clampedFloors,
    exitFloor: computedExitFloor,
    timeLimit: Math.max(30, Math.round(Number(timeLimit))),
    parTime: Math.max(10, Math.round(Number(parTime))),
    spawn: { col: spawnCol, floor: spawnFloor },
    palette: { ...palette },
    mechanics: {
      ...DEFAULT_MECHANICS,
      ...mechanics
    },
    ledges: sortedLedges,
    elevators: normElevators,
    doors: normDoors,
    switches: normSwitches,
    collectibles: normCollectibles,
    enemies: normEnemies
  };
}

// ============================================================================
// ORIGINAL MODE — CELL-FOR-CELL 1987 TOWERS IN 2007–2010 XBLA HD PALETTES
// ============================================================================

const ORIGINAL_PALETTES = [
  // 1. Royal Cobalt Blue / Sky-Blue
  {
    brickA: '#1d4ed8',
    brickB: '#2563eb',
    mortar: '#091536',
    ledge: '#60a5fa',
    ledgeTop: '#bfdbfe',
    glow: '#38bdf8',
    skyTop: '#040b24',
    skyMid: '#0c1f52',
    fog: '#071430',
    water: '#06284d',
    foam: '#bae6fd'
  },
  // 2. Cyber Violet / Electric Cyan
  {
    brickA: '#6d28d9',
    brickB: '#7c3aed',
    mortar: '#1e0b3b',
    ledge: '#22d3ee',
    ledgeTop: '#a5f3fc',
    glow: '#c084fc',
    skyTop: '#0d0626',
    skyMid: '#1e1147',
    fog: '#12092e',
    water: '#0c1e42',
    foam: '#cffafe'
  },
  // 3. Emerald Green / Gold Amber
  {
    brickA: '#047857',
    brickB: '#059669',
    mortar: '#04261c',
    ledge: '#fbbf24',
    ledgeTop: '#fde68a',
    glow: '#34d399',
    skyTop: '#031716',
    skyMid: '#08332c',
    fog: '#05211d',
    water: '#062c30',
    foam: '#d1fae5'
  },
  // 4. Glacier Cerulean / Frost White
  {
    brickA: '#0284c7',
    brickB: '#0ea5e9',
    mortar: '#08263b',
    ledge: '#e0f2fe',
    ledgeTop: '#ffffff',
    glow: '#7dd3fc',
    skyTop: '#041326',
    skyMid: '#0c2c4d',
    fog: '#081f38',
    water: '#072a47',
    foam: '#f0f9ff'
  },
  // 5. Crimson Brick / Pale Coral
  {
    brickA: '#991b1b',
    brickB: '#dc2626',
    mortar: '#260606',
    ledge: '#fca5a5',
    ledgeTop: '#fee2e2',
    glow: '#f87171',
    skyTop: '#1a0509',
    skyMid: '#380d14',
    fog: '#24080d',
    water: '#1f1024',
    foam: '#fecaca'
  },
  // 6. Deep Ocean Teal / Toxic Lime
  {
    brickA: '#0f766e',
    brickB: '#14b8a6',
    mortar: '#042220',
    ledge: '#a3e635',
    ledgeTop: '#ecfccb',
    glow: '#2dd4bf',
    skyTop: '#03171a',
    skyMid: '#093438',
    fog: '#062326',
    water: '#052e33',
    foam: '#d9f99d'
  },
  // 7. Magma Orange / Sulfur Yellow
  {
    brickA: '#c2410c',
    brickB: '#ea580c',
    mortar: '#290f04',
    ledge: '#fde047',
    ledgeTop: '#fef9c3',
    glow: '#fb923c',
    skyTop: '#1c0904',
    skyMid: '#3d1609',
    fog: '#260e06',
    water: '#1f1410',
    foam: '#fef08a'
  },
  // 8. Midnight Maroon / Neon Magenta & Sky
  {
    brickA: '#9d174d',
    brickB: '#db2777',
    mortar: '#240515',
    ledge: '#38bdf8',
    ledgeTop: '#e0f2fe',
    glow: '#f472b6',
    skyTop: '#170414',
    skyMid: '#36092b',
    fog: '#21061b',
    water: '#160d2e',
    foam: '#fbcfe8'
  }
];

const ORIGINAL_META = [
  { id: 1, name: 'THE TOWER OF EYES', subtitle: 'TOWER I • DESTRUCTO INC. OUTPOST' },
  { id: 2, name: 'THE REALM OF ROBOTS', subtitle: 'TOWER II • AUTOMATON GARRISON' },
  { id: 3, name: 'TRAP OF TRICKS', subtitle: 'TOWER III • HALL OF DECEPTION' },
  { id: 4, name: 'SLIPPERY SLIDE', subtitle: 'TOWER IV • GLACIER CITADEL' },
  { id: 5, name: 'BROKEN PATH', subtitle: 'TOWER V • SHATTERED RUINS' },
  { id: 6, name: "SWIMMER'S DELIGHT", subtitle: 'TOWER VI • HIGH-ALTITUDE ABYSS' },
  { id: 7, name: 'NASTY ONE', subtitle: 'TOWER VII • THE GAUNTLET' },
  { id: 8, name: 'EDGE OF DOOM', subtitle: 'TOWER VIII • FINAL DEMOLITION' }
];

const REAL_ENEMY_KIND = {
  1: { kind: 'roll', type: 'roller', kspeed: 2.0 },
  2: { kind: 'bounce', type: 'bouncer', kspeed: 2.0 },
  3: { kind: 'park', type: 'bouncer', kspeed: 0 },
  4: { kind: 'vpat', kspeed: 4.0 },
  5: { kind: 'vpat', kspeed: 8.0 },
  6: { kind: 'hpat', kspeed: 2.0 },
  7: { kind: 'hpat', kspeed: 4.0 }
};

function resolvePatrollerType(towerId, kind) {
  if (kind === 'vpat') {
    return towerId === 2 || towerId === 5 || towerId === 7 ? 'robotV' : 'eye';
  }
  return towerId === 2 || towerId === 6 || towerId === 7 || towerId === 8 ? 'robotH' : 'eye';
}

function buildRealOriginalTower(id, meta) {
  const top = REAL_TOWER_GRIDS[id];
  const rows = top.slice().reverse();
  while (rows.length && !rows[0].trim()) rows.shift();
  const H = rows.length;
  const at = (r, c) => (r >= 0 && r < H ? rows[r][wrapCol(c)] : ' ');

  const ledges = [];
  const doors = [];
  const elevators = [];
  const enemies = [];

  // 1. Walkable step cells ('-', '.', '>', '<') — keep ALL cells intact including under '^' lifts!
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = at(r, c);
      const type =
        ch === '-'
          ? 'solid'
          : ch === '.'
          ? 'crumble'
          : ch === '>'
          ? 'slideR'
          : ch === '<'
          ? 'slideL'
          : null;
      if (type) {
        ledges.push({ col: c, floor: r, type });
      }
    }
  }

  // Helper: scan vertical runs of a symbol in each column
  const scanRuns = (sym) => {
    const out = [];
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < H) {
        if (at(r, c) === sym) {
          let n = 0;
          while (r + n < H && at(r + n, c) === sym) n++;
          out.push({ c, r0: r, n });
          r += n;
        } else {
          r++;
        }
      }
    }
    return out;
  };

  // 2. Solid non-shootable pillars ('!') & shootable flashing blocks ('b') resting on floor = r0 - 1
  for (const { c, r0, n } of scanRuns('!')) {
    ledges.push({ col: c, floor: r0 - 1, type: 'pillar', h: n });
  }
  for (const { c, r0, n } of scanRuns('b')) {
    ledges.push({ col: c, floor: r0 - 1, type: 'box', h: n });
  }

  // 3. 3-row core doors ('#') & summit exit door ('T')
  const idTag = `real${id}`;
  const doorAt = new Map();
  for (const sym of ['#', 'T']) {
    for (const { c, r0, n } of scanRuns(sym)) {
      for (let k = 0; k + 3 <= n; k += 3) {
        const floor = r0 + k - 1;
        const d = {
          id: `${idTag}d${c}f${floor}`,
          col: c,
          floor,
          targetId: null,
          isExit: sym === 'T',
          isVault: false,
          isRune: false,
          decoy: false,
          tunnelStyle: 'stone'
        };
        doors.push(d);
        doorAt.set(`${c},${floor}`, d);
      }
    }
  }

  for (const d of doors) {
    if (d.isExit) continue;
    const far = doorAt.get(`${wrapCol(d.col + 8)},${d.floor}`);
    if (far && !far.isExit) {
      d.targetId = far.id;
      d.decoy = false;
    } else {
      d.targetId = null;
      d.decoy = true;
    }
  }

  // 4. Multi-stop lifts ('^' -> '+' -> 'v')
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < COLS; c++) {
      if (at(r, c) !== '^') continue;
      const stops = [r];
      let topStop = null;
      for (let k = r + 1; k < H; k++) {
        const ch = at(k, c);
        if (ch === '+') stops.push(k);
        else if (ch === 'v') {
          topStop = k;
          break;
        }
      }
      if (topStop === null) continue;
      stops.push(topStop);
      elevators.push({
        col: c,
        minFloor: r,
        maxFloor: topStop,
        startFloor: r,
        stops,
        rowsPerSec: 3.1,
        speed: 3.1
      });
    }
  }

  // 5. 7-code enemy spawn points (codes 1..7)
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < COLS; c++) {
      const code = Number(at(r, c));
      const spec = REAL_ENEMY_KIND[code];
      if (!spec) continue;
      const resolvedType = spec.type || resolvePatrollerType(id, spec.kind);
      enemies.push({
        type: resolvedType,
        kind: spec.kind,
        kspeed: spec.kspeed,
        speed: spec.kspeed,
        col: c + 0.5,
        floor: r - 1,
        // Low spawn-column vertical patrollers start upward so they never dive onto Pogo's (0, 0) spawn
        dir: spec.kind === 'vpat' && c === 0 && r <= 12 ? 1 : (r + c) % 2 ? 1 : -1,
        spawnKey: `${c},${r}`
      });
    }
  }

  const timeLimit = REAL_TIME_LIMITS[id - 1] || 100;
  const parTime = Math.round(timeLimit * 0.4);
  const exitDoor = doors.find((d) => d.isExit);

  // Build initial tower so we can select BFS-verified reachable solid ledges for optional collectibles
  const baseTower = finalizeTower({
    id,
    key: `orig_t${id}`,
    cacheKey: `real${id}`,
    real: true,
    era: 'original',
    name: meta.name,
    subtitle: meta.subtitle,
    theme: 'classic',
    floors: H,
    exitFloor: exitDoor ? exitDoor.floor : H - 4,
    timeLimit,
    parTime,
    spawn: { col: 0, floor: 0 },
    palette: ORIGINAL_PALETTES[id - 1],
    ledges,
    elevators,
    doors,
    switches: [],
    collectibles: [],
    enemies
  });

  // Deterministically place 1 floating Star Core + 3 Golden Gears on verified reachable solid steps
  const solveInfo = solveRealTowerBFS(baseTower);
  const doorCoordSet = new Set(baseTower.doors.map((d) => `${d.col}:${d.floor}`));
  const liftCoordSet = new Set(baseTower.elevators.map((e) => `${e.col}:${e.minFloor - 1}`));
  const candidateCells = baseTower.ledges.filter(
    (l) =>
      l.type === 'solid' &&
      l.floor >= 4 &&
      l.floor <= H - 4 &&
      solveInfo.reached.has(`${l.col}:${l.floor}`) &&
      !doorCoordSet.has(`${l.col}:${l.floor}`) &&
      !liftCoordSet.has(`${l.col}:${l.floor}`)
  );

  const collectibles = [];
  if (candidateCells.length >= 4) {
    const pickAtFrac = (frac) => candidateCells[Math.min(candidateCells.length - 1, Math.floor(candidateCells.length * frac))];
    const g1 = pickAtFrac(0.22);
    const g2 = pickAtFrac(0.50);
    const star = pickAtFrac(0.68);
    const g3 = pickAtFrac(0.86);
    collectibles.push(
      { id: `orig_t${id}_g1`, col: g1.col, floor: g1.floor, type: 'gear' },
      { id: `orig_t${id}_g2`, col: g2.col, floor: g2.floor, type: 'gear' },
      { id: `orig_t${id}_g3`, col: g3.col, floor: g3.floor, type: 'gear' },
      { id: `orig_t${id}_star`, col: star.col, floor: star.floor, type: 'starCore' }
    );
  }

  baseTower.collectibles = collectibles;
  return baseTower;
}

export function createOriginalTowers() {
  return ORIGINAL_META.map((meta) => buildRealOriginalTower(meta.id, meta));
}

// ============================================================================
// REBOOT MODE — ALL 8 "OPERATION NEBULUS" STORY CAMPAIGN TOWERS
// (Odd T1, T3, T5, T7 -> Rune Doors; Even T2, T4, T6, T8 -> Core Lock Vaults)
// ============================================================================

const REBOOT_PALETTES = {
  mist: {
    brickA: '#242544',
    brickB: '#2f325b',
    mortar: '#0d0e1d',
    ledge: '#525b70',
    ledgeTop: '#73809c',
    glow: '#5efce8',
    moss: '#365e30',
    pipe: '#3b3538',
    skyTop: '#060a14',
    skyMid: '#101b30',
    fog: '#0b1526',
    water: '#091926',
    foam: '#e8f6ff'
  },
  sinking: {
    brickA: '#172b3a',
    brickB: '#1f3b4d',
    mortar: '#08131c',
    ledge: '#3f6275',
    ledgeTop: '#6792a8',
    glow: '#22d3ee',
    moss: '#24594c',
    pipe: '#47362b',
    skyTop: '#040c17',
    skyMid: '#0c2238',
    fog: '#091b2e',
    water: '#062030',
    foam: '#d8f3ff'
  },
  foundry: {
    brickA: '#2b2124',
    brickB: '#3b2b2e',
    mortar: '#120c0e',
    ledge: '#5c4942',
    ledgeTop: '#876d62',
    glow: '#f59e0b',
    moss: '#3d3522',
    pipe: '#6e4228',
    skyTop: '#0d080a',
    skyMid: '#241512',
    fog: '#1c1110',
    water: '#171112',
    foam: '#fde68a'
  },
  blizzard: {
    brickA: '#1e2f4d',
    brickB: '#284066',
    mortar: '#0b1526',
    ledge: '#7dd3fc',
    ledgeTop: '#e0f2fe',
    glow: '#67e8f9',
    moss: '#2c4c54',
    pipe: '#3b495c',
    skyTop: '#050d1c',
    skyMid: '#122947',
    fog: '#0f223d',
    water: '#081b2e',
    foam: '#f0f9ff'
  },
  prism: {
    brickA: '#281942',
    brickB: '#38235c',
    mortar: '#10081f',
    ledge: '#5b4b7a',
    ledgeTop: '#8975b0',
    glow: '#e879f9',
    moss: '#2d4739',
    pipe: '#4a3859',
    skyTop: '#090514',
    skyMid: '#1c1036',
    fog: '#140b29',
    water: '#110a24',
    foam: '#f5d0fe'
  },
  piston: {
    brickA: '#1f2d33',
    brickB: '#2b3e47',
    mortar: '#0c1417',
    ledge: '#566b73',
    ledgeTop: '#829ca6',
    glow: '#34d399',
    moss: '#2f6142',
    pipe: '#78552b',
    skyTop: '#050e12',
    skyMid: '#0f262e',
    fog: '#0b1d24',
    water: '#071f24',
    foam: '#d1fae5'
  },
  blackout: {
    brickA: '#1a1d30',
    brickB: '#242942',
    mortar: '#090b14',
    ledge: '#475069',
    ledgeTop: '#6e7b9e',
    glow: '#818cf8',
    moss: '#254238',
    pipe: '#383a4a',
    skyTop: '#03050d',
    skyMid: '#0c1329',
    fog: '#080d1c',
    water: '#060f1c',
    foam: '#e0e7ff'
  },
  apex: {
    brickA: '#211836',
    brickB: '#2f224d',
    mortar: '#0b0714',
    ledge: '#63537a',
    ledgeTop: '#eab308',
    glow: '#fbbf24',
    moss: '#2e473b',
    pipe: '#785027',
    skyTop: '#070412',
    skyMid: '#1d1038',
    fog: '#120a24',
    water: '#0d0921',
    foam: '#fef08a'
  }
};

export function createRebootTowers() {
  // --------------------------------------------------------------------------
  // T1: WATCHTOWER OF THE MIST (Reference Photo Hero + 'lights' Rune Chamber)
  // --------------------------------------------------------------------------
  const r1Ledges = [];
  span(r1Ledges, 0, 1, 2, 'solid');
  span(r1Ledges, 1, 14, 3, 'solid');
  span(r1Ledges, 2, 3, 2, 'solid');
  span(r1Ledges, 3, 13, 2, 'solid');
  span(r1Ledges, 4, 15, 3, 'solid');
  span(r1Ledges, 5, 11, 2, 'solid');
  span(r1Ledges, 6, 3, 5, 'solid');
  span(r1Ledges, 6, 9, 2, 'crumble');
  span(r1Ledges, 7, 11, 2, 'solid');  // Secret Rune Door r_t1_rune at col 12, floor 7!
  span(r1Ledges, 8, 13, 3, 'solid');
  span(r1Ledges, 9, 1, 3, 'solid');
  span(r1Ledges, 10, 4, 5, 'solid');
  tile(r1Ledges, 6, 10, 'box');
  tile(r1Ledges, 6, 12, 'solid');
  span(r1Ledges, 12, 15, 4, 'solid');
  span(r1Ledges, 13, 4, 3, 'solid');
  span(r1Ledges, 16, 8, 5, 'solid');
  tile(r1Ledges, 14, 17, 'solid');

  const r1 = finalizeTower({
    id: 1,
    key: 'reboot_t1',
    era: 'reboot',
    name: 'WATCHTOWER OF THE MIST',
    subtitle: 'SECTOR I • STORM APPROACH',
    theme: 'mist',
    floors: 18,
    timeLimit: 95,
    parTime: 35,
    spawn: { col: 0, floor: 1 },
    palette: REBOOT_PALETTES.mist,
    ledges: r1Ledges,
    elevators: [
      { col: 2, minFloor: 2, maxFloor: 6, startFloor: 2, speed: 1.5 },
      { col: 7, minFloor: 13, maxFloor: 16, startFloor: 13, speed: 1.6 }
    ],
    doors: [
      { id: 'r1_d1a', col: 0, floor: 1, targetId: 'r1_d1b', isExit: false, isVault: false, tunnelStyle: 'stone' },
      { id: 'r1_d1b', col: 0, floor: 4, targetId: 'r1_d1a', isExit: false, isVault: false, tunnelStyle: 'stone' },
      { id: 'r1_spark1a', col: 14, floor: 1, targetId: 'r1_spark1b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r1_spark1b', col: 7, floor: 6, targetId: 'r1_spark1a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r_t1_rune', col: 12, floor: 7, targetId: null, isExit: false, isVault: false, isRune: true, puzzleType: 'lights', puzzleSeed: 10101, tunnelStyle: 'stone' },
      { id: 'r1_spark2a', col: 8, floor: 10, targetId: 'r1_spark2b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r1_spark2b', col: 0, floor: 12, targetId: 'r1_spark2a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r1_exit', col: 10, floor: 16, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [],
    collectibles: [
      { id: 'r1_g1', col: 2, floor: 0, type: 'gear' },
      { id: 'r1_g2', col: 4, floor: 2, type: 'gear' },
      { id: 'r1_g3', col: 11, floor: 5, type: 'gear' },
      { id: 'r1_g4', col: 9, floor: 6, type: 'gear' },
      { id: 'r1_g5', col: 5, floor: 13, type: 'gear' },
      { id: 'r1_relic', col: 13, floor: 3, type: 'relic', relicId: 'relic_t1' },
      { id: 'r1_star', col: 14, floor: 17, type: 'starCore' }
    ],
    enemies: [
      { type: 'eye', col: 13.9, floor: 2.85, dir: -1, speed: 1.5, amp: 0.2 },
      { type: 'molecule', col: 3.1, floor: -0.02, dir: 1, speed: 1.6, amp: 0.2 },
      { type: 'roller', col: 13.5, floor: 6, dir: -1, speed: 1.5 },
      { type: 'bouncer', col: 2.5, floor: 9, dir: 1, speed: 1.5 },
      { type: 'eye', col: 12.0, floor: 12.5, dir: 1, speed: 1.7, amp: 0.25 },
      { type: 'molecule', col: 1.0, floor: 16.5, dir: -1, speed: 1.8, amp: 0.35 }
    ]
  });

  // --------------------------------------------------------------------------
  // T2: THE SINKING RELIQUARY (Rising Sea 0.17 + Drain Valves + Core Lock Vault)
  // --------------------------------------------------------------------------
  const r2Ledges = [];
  span(r2Ledges, 0, 15, 4, 'solid');
  span(r2Ledges, 1, 3, 3, 'solid');
  span(r2Ledges, 2, 7, 2, 'crumble');
  span(r2Ledges, 3, 10, 3, 'solid');
  span(r2Ledges, 4, 13, 3, 'solid');
  span(r2Ledges, 8, 1, 4, 'solid');
  span(r2Ledges, 9, 14, 2, 'solid');
  span(r2Ledges, 9, 6, 2, 'crumble');
  span(r2Ledges, 10, 8, 4, 'solid');
  span(r2Ledges, 13, 2, 4, 'solid');
  span(r2Ledges, 14, 7, 2, 'crumble');
  span(r2Ledges, 15, 10, 3, 'solid');
  span(r2Ledges, 16, 13, 3, 'solid');
  span(r2Ledges, 17, 1, 2, 'crumble');
  span(r2Ledges, 18, 4, 5, 'solid');
  tile(r2Ledges, 10, 19, 'solid');

  const r2 = finalizeTower({
    id: 2,
    key: 'reboot_t2',
    era: 'reboot',
    name: 'THE SINKING RELIQUARY',
    subtitle: 'SECTOR I • RISING ABYSS',
    theme: 'sinking',
    floors: 20,
    timeLimit: 90,
    parTime: 34,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.sinking,
    mechanics: { waterRiseRate: 0.17 },
    ledges: r2Ledges,
    elevators: [{ col: 0, minFloor: 4, maxFloor: 8, startFloor: 4, speed: 1.9 }],
    doors: [
      { id: 'r2_vault', col: 14, floor: 9, targetId: null, isExit: false, isVault: true, tunnelStyle: 'stone' },
      { id: 'r2_s1a', col: 11, floor: 10, targetId: 'r2_s1b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r2_s1b', col: 3, floor: 13, targetId: 'r2_s1a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r2_exit', col: 6, floor: 18, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [
      { id: 'r2_drain1', col: 14, floor: 4, group: 'drain', mode: 'drainValve' },
      { id: 'r2_drain2', col: 9, floor: 10, group: 'drain', mode: 'drainValve' },
      { id: 'r2_drain3', col: 11, floor: 15, group: 'drain', mode: 'drainValve' }
    ],
    collectibles: [
      { id: 'r2_g1', col: 5, floor: 1, type: 'gear' },
      { id: 'r2_g2', col: 15, floor: 9, type: 'gear' },
      { id: 'r2_g3', col: 10, floor: 10, type: 'gear' },
      { id: 'r2_g4', col: 5, floor: 13, type: 'gear' },
      { id: 'r2_g5', col: 8, floor: 18, type: 'gear' },
      { id: 'r2_relic', col: 12, floor: 3, type: 'relic', relicId: 'relic_t2' },
      { id: 'r2_star', col: 10, floor: 19, type: 'starCore' }
    ],
    enemies: [
      { type: 'roller', col: 5.5, floor: 1, dir: 1, speed: 1.7 },
      { type: 'molecule', col: 9.0, floor: 2.5, dir: -1, speed: 1.9, amp: 0.4 },
      { type: 'bouncer', col: 7.5, floor: 8, dir: 1, speed: 1.7 },
      { type: 'eye', col: 4.5, floor: 10.6, dir: -1, speed: 1.9 },
      { type: 'roller', col: 14.5, floor: 16, dir: -1, speed: 1.9 },
      { type: 'molecule', col: 14.5, floor: 18.5, dir: 1, speed: 2.0, amp: 0.35 }
    ]
  });

  // --------------------------------------------------------------------------
  // T3: CLOCKWORK FOUNDRY (steamVent + conveyorFlip + 'bells' Rune Chamber)
  // --------------------------------------------------------------------------
  const r3Ledges = [];
  span(r3Ledges, 0, 14, 5, 'solid');
  span(r3Ledges, 1, 3, 4, 'conveyorL');
  tile(r3Ledges, 2, 0, 'solid');
  tile(r3Ledges, 7, 2, 'steamVent', { phasePeriod: 3.4, phaseOffset: 0.0 });
  span(r3Ledges, 2, 8, 2, 'solid');
  span(r3Ledges, 3, 11, 3, 'solid');
  span(r3Ledges, 5, 6, 2, 'solid');
  span(r3Ledges, 6, 3, 4, 'solid');
  span(r3Ledges, 7, 8, 3, 'conveyorR');
  span(r3Ledges, 8, 11, 3, 'solid');
  tile(r3Ledges, 14, 9, 'steamVent', { phasePeriod: 3.2, phaseOffset: 1.1 });
  span(r3Ledges, 10, 15, 3, 'solid');
  span(r3Ledges, 11, 13, 2, 'solid');
  span(r3Ledges, 14, 3, 4, 'solid');
  span(r3Ledges, 15, 8, 3, 'conveyorL');
  tile(r3Ledges, 11, 16, 'steamVent', { phasePeriod: 3.4, phaseOffset: 0.5 });
  span(r3Ledges, 17, 12, 3, 'solid');
  span(r3Ledges, 18, 0, 5, 'solid');
  tile(r3Ledges, 6, 19, 'solid');

  const r3 = finalizeTower({
    id: 3,
    key: 'reboot_t3',
    era: 'reboot',
    name: 'CLOCKWORK FOUNDRY',
    subtitle: 'SECTOR II • STEAM & IRON',
    theme: 'foundry',
    floors: 20,
    timeLimit: 100,
    parTime: 36,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.foundry,
    ledges: r3Ledges,
    elevators: [{ col: 2, minFloor: 10, maxFloor: 14, startFloor: 10, speed: 1.8 }],
    doors: [
      { id: 'r3_s1a', col: 12, floor: 3, targetId: 'r3_s1b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r3_s1b', col: 4, floor: 6, targetId: 'r3_s1a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r_t3_rune', col: 13, floor: 11, targetId: null, isExit: false, isVault: false, isRune: true, puzzleType: 'bells', puzzleSeed: 30303, tunnelStyle: 'stone' },
      { id: 'r3_exit', col: 2, floor: 18, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [
      { id: 'r3_conv1', col: 2, floor: 0, group: 'conv', mode: 'conveyorFlip' },
      { id: 'r3_conv2', col: 11, floor: 8, group: 'conv', mode: 'conveyorFlip' }
    ],
    collectibles: [
      { id: 'r3_g1', col: 7, floor: 5, type: 'gear' },
      { id: 'r3_g2', col: 9, floor: 7, type: 'gear' },
      { id: 'r3_g3', col: 14, floor: 11, type: 'gear' },
      { id: 'r3_g4', col: 9, floor: 15, type: 'gear' },
      { id: 'r3_g5', col: 4, floor: 18, type: 'gear' },
      { id: 'r3_relic', col: 6, floor: 5, type: 'relic', relicId: 'relic_t3' },
      { id: 'r3_star', col: 6, floor: 19, type: 'starCore' }
    ],
    enemies: [
      { type: 'roller', col: 6.5, floor: 1, dir: -1, speed: 1.8 },
      { type: 'eye', col: 12.5, floor: 6.5, dir: 1, speed: 1.8 },
      { type: 'molecule', col: 5.5, floor: 8.5, dir: -1, speed: 2.0, amp: 0.4 },
      { type: 'robotV', col: 9.5, floor: 14.5, dir: 1, speed: 2.1, amp: 1.4, minFloor: 13.1, maxFloor: 15.9 },
      { type: 'robotH', col: 13.5, floor: 17, dir: 1, speed: 1.7, minCol: 12, maxCol: 14 },
      { type: 'bouncer', col: 10.5, floor: 18, dir: 1, speed: 1.8 }
    ]
  });

  // --------------------------------------------------------------------------
  // T4: BOREAL SPIRE (windForce: 1.35 + Glacier Ice + Core Lock Vault)
  // --------------------------------------------------------------------------
  const r4Ledges = [];
  span(r4Ledges, 0, 14, 5, 'solid');
  span(r4Ledges, 1, 3, 4, 'ice');
  span(r4Ledges, 2, 8, 4, 'ice');
  span(r4Ledges, 3, 12, 3, 'solid');
  span(r4Ledges, 6, 4, 4, 'ice');
  tile(r4Ledges, 5, 6, 'solid');
  span(r4Ledges, 7, 9, 3, 'solid');
  span(r4Ledges, 11, 13, 3, 'ice');
  span(r4Ledges, 12, 9, 3, 'solid');
  span(r4Ledges, 12, 1, 3, 'solid');
  span(r4Ledges, 13, 5, 4, 'ice');
  span(r4Ledges, 14, 10, 3, 'crumble');
  span(r4Ledges, 15, 14, 3, 'solid');
  span(r4Ledges, 19, 2, 5, 'ice');
  tile(r4Ledges, 4, 19, 'solid');
  tile(r4Ledges, 8, 20, 'solid');

  const r4 = finalizeTower({
    id: 4,
    key: 'reboot_t4',
    era: 'reboot',
    name: 'BOREAL SPIRE',
    subtitle: 'SECTOR II • GALE-FORCE MONOLITH',
    theme: 'blizzard',
    floors: 21,
    timeLimit: 105,
    parTime: 38,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.blizzard,
    mechanics: { windForce: 1.35, windPeriod: 6.0 },
    ledges: r4Ledges,
    elevators: [
      { col: 12, minFloor: 7, maxFloor: 11, startFloor: 7, speed: 1.8 },
      { col: 1, minFloor: 15, maxFloor: 19, startFloor: 15, speed: 1.9 }
    ],
    doors: [
      { id: 'r4_d1a', col: 13, floor: 3, targetId: 'r4_d1b', isExit: false, isVault: false, tunnelStyle: 'stone' },
      { id: 'r4_d1b', col: 5, floor: 6, targetId: 'r4_d1a', isExit: false, isVault: false, tunnelStyle: 'stone' },
      { id: 'r4_vault', col: 9, floor: 12, targetId: null, isExit: false, isVault: true, tunnelStyle: 'stone' },
      { id: 'r4_exit', col: 4, floor: 19, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [],
    collectibles: [
      { id: 'r4_g1', col: 5, floor: 1, type: 'gear' },
      { id: 'r4_g2', col: 10, floor: 2, type: 'gear' },
      { id: 'r4_g3', col: 10, floor: 12, type: 'gear' },
      { id: 'r4_g4', col: 7, floor: 13, type: 'gear' },
      { id: 'r4_g5', col: 6, floor: 19, type: 'gear' },
      { id: 'r4_relic', col: 11, floor: 12, type: 'relic', relicId: 'relic_t4' },
      { id: 'r4_star', col: 8, floor: 20, type: 'starCore' }
    ],
    enemies: [
      { type: 'roller', col: 6.5, floor: 1, dir: 1, speed: 1.8 },
      { type: 'molecule', col: 5.5, floor: 2.6, dir: -1, speed: 2.0, amp: 0.4 },
      { type: 'bouncer', col: 1.0, floor: 6, dir: 1, speed: 1.8 },
      { type: 'eye', col: 3.0, floor: 11.5, dir: -1, speed: 2.0 },
      { type: 'bouncer', col: 2.5, floor: 13, dir: -1, speed: 1.9 },
      { type: 'molecule', col: 11.0, floor: 19.6, dir: 1, speed: 2.1, amp: 0.35 }
    ]
  });

  // --------------------------------------------------------------------------
  // T5: PRISM LABYRINTH (Red & Cyan Switches + 'beam' Mirror Rune Chamber)
  // --------------------------------------------------------------------------
  const r5Ledges = [];
  span(r5Ledges, 0, 14, 5, 'solid');
  span(r5Ledges, 1, 3, 3, 'solid');
  span(r5Ledges, 2, 7, 3, 'solid');
  span(r5Ledges, 3, 11, 3, 'solid');
  span(r5Ledges, 4, 15, 4, 'solid');
  tile(r5Ledges, 4, 5, 'phaseBlock', { switchGroup: 'red', inverted: false });
  tile(r5Ledges, 6, 5, 'solid');
  tile(r5Ledges, 7, 5, 'laserGate', { switchGroup: 'red', inverted: false });
  tile(r5Ledges, 7, 7, 'solid');
  span(r5Ledges, 5, 8, 3, 'solid');

  span(r5Ledges, 9, 0, 4, 'solid');
  tile(r5Ledges, 15, 9, 'laserGate', { switchGroup: 'cyan', inverted: false });
  tile(r5Ledges, 15, 11, 'solid');
  span(r5Ledges, 9, 12, 3, 'solid'); // Rune Chamber r_t5_rune at col 13, floor 9!
  span(r5Ledges, 10, 5, 2, 'phaseBlock', { switchGroup: 'cyan', inverted: false });
  span(r5Ledges, 10, 7, 2, 'solid');

  span(r5Ledges, 14, 10, 4, 'solid');
  span(r5Ledges, 15, 15, 2, 'solid');
  tile(r5Ledges, 1, 15, 'laserGate', { switchGroup: 'red', inverted: true });
  tile(r5Ledges, 1, 17, 'solid');
  span(r5Ledges, 15, 2, 3, 'solid');
  span(r5Ledges, 16, 6, 2, 'solid');
  span(r5Ledges, 17, 9, 2, 'crumble');
  span(r5Ledges, 18, 12, 2, 'solid');
  span(r5Ledges, 19, 15, 5, 'solid');
  tile(r5Ledges, 5, 20, 'solid');

  const r5 = finalizeTower({
    id: 5,
    key: 'reboot_t5',
    era: 'reboot',
    name: 'PRISM LABYRINTH',
    subtitle: 'SECTOR III • RESONATOR CORE',
    theme: 'prism',
    floors: 21,
    timeLimit: 110,
    parTime: 40,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.prism,
    ledges: r5Ledges,
    elevators: [{ col: 9, minFloor: 10, maxFloor: 14, startFloor: 10, speed: 1.9 }],
    doors: [
      { id: 'r5_d1a', col: 9, floor: 5, targetId: 'r5_d1b', isExit: false, isVault: false, tunnelStyle: 'stone' },
      { id: 'r5_d1b', col: 1, floor: 9, targetId: 'r5_d1a', isExit: false, isVault: false, tunnelStyle: 'stone' },
      { id: 'r_t5_rune', col: 13, floor: 9, targetId: null, isExit: false, isVault: false, isRune: true, puzzleType: 'beam', puzzleSeed: 50505, tunnelStyle: 'stone' },
      { id: 'r5_exit', col: 1, floor: 19, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [
      { id: 'r5_sw_red1', col: 0, floor: 4, group: 'red', mode: 'toggle' },
      { id: 'r5_sw_cyan1', col: 3, floor: 9, group: 'cyan', mode: 'toggle' },
      { id: 'r5_sw_red2', col: 12, floor: 14, group: 'red', mode: 'toggle' }
    ],
    collectibles: [
      { id: 'r5_g1', col: 8, floor: 2, type: 'gear' },
      { id: 'r5_g2', col: 10, floor: 5, type: 'gear' },
      { id: 'r5_g3', col: 12, floor: 9, type: 'gear' },
      { id: 'r5_g4', col: 4, floor: 15, type: 'gear' },
      { id: 'r5_g5', col: 3, floor: 19, type: 'gear' },
      { id: 'r5_relic', col: 14, floor: 9, type: 'relic', relicId: 'relic_t5' },
      { id: 'r5_star', col: 5, floor: 20, type: 'starCore' }
    ],
    enemies: [
      { type: 'roller', col: 8.5, floor: 2, dir: -1, speed: 1.9 },
      { type: 'molecule', col: 12.5, floor: 3.5, dir: 1, speed: 2.1, amp: 0.4 },
      { type: 'eye', col: 7.5, floor: 8.35, dir: 1, speed: 2.0 },
      { type: 'bouncer', col: 2.5, floor: 14, dir: 1, speed: 1.9 },
      { type: 'robotH', col: 3.5, floor: 15, dir: -1, speed: 1.9, minCol: 2, maxCol: 4 },
      { type: 'molecule', col: 9.5, floor: 19.6, dir: -1, speed: 2.2, amp: 0.4 }
    ]
  });

  // --------------------------------------------------------------------------
  // T6: TIDAL PISTON RIG (Timed Piston Ledges + Dual Lifts + Core Lock Vault)
  // --------------------------------------------------------------------------
  const r6Ledges = [];
  span(r6Ledges, 0, 14, 5, 'solid');
  tile(r6Ledges, 4, 1, 'piston', { phasePeriod: 3.2, phaseOffset: 0.0 });
  span(r6Ledges, 2, 6, 3, 'solid');
  tile(r6Ledges, 10, 3, 'piston', { phasePeriod: 3.2, phaseOffset: 0.9 });
  span(r6Ledges, 4, 12, 3, 'solid');
  span(r6Ledges, 9, 0, 4, 'solid');
  tile(r6Ledges, 5, 10, 'piston', { phasePeriod: 3.0, phaseOffset: 0.4 });
  tile(r6Ledges, 7, 11, 'piston', { phasePeriod: 3.0, phaseOffset: 1.2 });
  span(r6Ledges, 12, 9, 4, 'solid');
  span(r6Ledges, 13, 13, 3, 'solid');
  span(r6Ledges, 15, 2, 4, 'solid');
  tile(r6Ledges, 7, 16, 'piston', { phasePeriod: 3.0, phaseOffset: 0.0 });
  span(r6Ledges, 16, 9, 2, 'solid');
  span(r6Ledges, 20, 12, 5, 'solid');
  tile(r6Ledges, 2, 21, 'solid');

  const r6 = finalizeTower({
    id: 6,
    key: 'reboot_t6',
    era: 'reboot',
    name: 'TIDAL PISTON RIG',
    subtitle: 'SECTOR III • HYDRAULIC DERRICK',
    theme: 'piston',
    floors: 22,
    timeLimit: 110,
    parTime: 40,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.piston,
    mechanics: { windForce: 0.45, windPeriod: 7.0 },
    ledges: r6Ledges,
    elevators: [
      { col: 15, minFloor: 4, maxFloor: 9, startFloor: 4, speed: 2.0 },
      { col: 11, minFloor: 16, maxFloor: 20, startFloor: 16, speed: 2.0 }
    ],
    doors: [
      { id: 'r6_vault', col: 14, floor: 13, targetId: null, isExit: false, isVault: true, tunnelStyle: 'stone' },
      { id: 'r6_s1a', col: 11, floor: 12, targetId: 'r6_s1b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r6_s1b', col: 3, floor: 15, targetId: 'r6_s1a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r6_exit', col: 14, floor: 20, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [],
    collectibles: [
      { id: 'r6_g1', col: 7, floor: 2, type: 'gear' },
      { id: 'r6_g2', col: 2, floor: 9, type: 'gear' },
      { id: 'r6_g3', col: 15, floor: 13, type: 'gear' },
      { id: 'r6_g4', col: 5, floor: 15, type: 'gear' },
      { id: 'r6_g5', col: 0, floor: 20, type: 'gear' },
      { id: 'r6_relic', col: 13, floor: 13, type: 'relic', relicId: 'relic_t6' },
      { id: 'r6_star', col: 2, floor: 21, type: 'starCore' }
    ],
    enemies: [
      { type: 'robotH', col: 7.5, floor: 2, dir: 1, speed: 1.9, minCol: 6, maxCol: 8 },
      { type: 'roller', col: 7.5, floor: 9, dir: 1, speed: 2.0 },
      { type: 'molecule', col: 4.5, floor: 11.2, dir: -1, speed: 2.2, amp: 0.45 },
      { type: 'eye', col: 10.0, floor: 14.85, dir: 1, speed: 2.2 },
      { type: 'robotV', col: 5.5, floor: 17.5, dir: 1, speed: 2.3, amp: 1.2, minFloor: 16.3, maxFloor: 18.7 },
      { type: 'roller', col: 5.0, floor: 20, dir: -1, speed: 2.2 }
    ]
  });

  // --------------------------------------------------------------------------
  // T7: BLACKOUT CITADEL (Storm Blackouts + Lightning + 'blocks' Rune Chamber)
  // --------------------------------------------------------------------------
  const r7Ledges = [];
  span(r7Ledges, 0, 14, 5, 'solid');
  span(r7Ledges, 1, 4, 3, 'ice');
  span(r7Ledges, 2, 8, 2, 'crumble');
  span(r7Ledges, 3, 11, 3, 'solid');
  span(r7Ledges, 6, 3, 4, 'solid');
  span(r7Ledges, 7, 8, 3, 'conveyorR');
  span(r7Ledges, 8, 12, 3, 'solid');
  span(r7Ledges, 13, 0, 4, 'solid');
  span(r7Ledges, 14, 12, 2, 'solid'); // Rune Chamber r_t7_rune at col 12, floor 14!
  tile(r7Ledges, 5, 14, 'phaseBlock', { switchGroup: 'cyan', inverted: false });
  span(r7Ledges, 14, 7, 3, 'solid');
  span(r7Ledges, 17, 15, 4, 'solid');
  span(r7Ledges, 18, 4, 2, 'crumble');
  span(r7Ledges, 19, 7, 3, 'ice');
  span(r7Ledges, 20, 11, 2, 'crumble');
  span(r7Ledges, 21, 14, 5, 'solid');
  tile(r7Ledges, 4, 22, 'solid');

  const r7 = finalizeTower({
    id: 7,
    key: 'reboot_t7',
    era: 'reboot',
    name: 'BLACKOUT CITADEL',
    subtitle: 'SECTOR IV • TEMPEST FORTRESS',
    theme: 'blackout',
    floors: 23,
    timeLimit: 115,
    parTime: 42,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.blackout,
    mechanics: { windForce: 0.6, windPeriod: 6.5, blackoutCycle: 9.0, lightningInterval: 7.5 },
    ledges: r7Ledges,
    elevators: [{ col: 15, minFloor: 8, maxFloor: 13, startFloor: 8, speed: 2.0 }],
    doors: [
      { id: 'r7_s1a', col: 12, floor: 3, targetId: 'r7_s1b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r7_s1b', col: 4, floor: 6, targetId: 'r7_s1a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r_t7_rune', col: 12, floor: 14, targetId: null, isExit: false, isVault: false, isRune: true, puzzleType: 'blocks', puzzleSeed: 70707, tunnelStyle: 'stone' },
      { id: 'r7_s2a', col: 8, floor: 14, targetId: 'r7_s2b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r7_s2b', col: 0, floor: 17, targetId: 'r7_s2a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r7_exit', col: 0, floor: 21, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [{ id: 'r7_sw_cyan', col: 1, floor: 13, group: 'cyan', mode: 'toggle' }],
    collectibles: [
      { id: 'r7_g1', col: 5, floor: 1, type: 'gear' },
      { id: 'r7_g2', col: 9, floor: 7, type: 'gear' },
      { id: 'r7_g3', col: 13, floor: 14, type: 'gear' },
      { id: 'r7_g4', col: 8, floor: 19, type: 'gear' },
      { id: 'r7_g5', col: 2, floor: 21, type: 'gear' },
      { id: 'r7_relic', col: 1, floor: 17, type: 'relic', relicId: 'relic_t7' },
      { id: 'r7_star', col: 4, floor: 22, type: 'starCore' }
    ],
    enemies: [
      { type: 'eye', col: 6.5, floor: 1.6, dir: 1, speed: 2.1 },
      { type: 'bouncer', col: 12.5, floor: 6, dir: -1, speed: 2.0 },
      { type: 'molecule', col: 7.5, floor: 8.5, dir: 1, speed: 2.3, amp: 0.45 },
      { type: 'eye', col: 4.0, floor: 13.6, dir: -1, speed: 2.3 },
      { type: 'molecule', col: 8.5, floor: 17.5, dir: -1, speed: 2.4, amp: 0.4 },
      { type: 'robotH', col: 8.5, floor: 19, dir: 1, speed: 2.0, minCol: 7, maxCol: 9 },
      { type: 'eye', col: 8.5, floor: 21.6, dir: 1, speed: 2.4 }
    ]
  });

  // --------------------------------------------------------------------------
  // T8: APEX OF NEBULUS (Grand Convergence + Core Lock Vault)
  // --------------------------------------------------------------------------
  const r8Ledges = [];
  span(r8Ledges, 0, 14, 5, 'solid');
  span(r8Ledges, 1, 4, 3, 'ice');
  tile(r8Ledges, 8, 2, 'piston', { phasePeriod: 3.0, phaseOffset: 0.0 });
  span(r8Ledges, 3, 10, 3, 'solid');
  tile(r8Ledges, 14, 4, 'phaseBlock', { switchGroup: 'red', inverted: false });
  span(r8Ledges, 4, 0, 2, 'solid');
  span(r8Ledges, 9, 3, 4, 'solid');
  span(r8Ledges, 10, 8, 3, 'conveyorR');
  span(r8Ledges, 11, 12, 3, 'solid');
  span(r8Ledges, 14, 4, 4, 'solid');
  tile(r8Ledges, 3, 14, 'laserGate', { switchGroup: 'cyan', inverted: false });
  tile(r8Ledges, 3, 16, 'solid');
  span(r8Ledges, 14, 1, 2, 'solid');
  tile(r8Ledges, 9, 15, 'phaseBlock', { switchGroup: 'cyan', inverted: false });
  span(r8Ledges, 16, 11, 3, 'solid');
  tile(r8Ledges, 15, 17, 'steamVent', { phasePeriod: 3.2, phaseOffset: 0.6 });
  span(r8Ledges, 18, 1, 2, 'solid');
  span(r8Ledges, 22, 4, 3, 'ice');
  span(r8Ledges, 23, 8, 5, 'solid');
  tile(r8Ledges, 14, 24, 'solid');

  const r8 = finalizeTower({
    id: 8,
    key: 'reboot_t8',
    era: 'reboot',
    name: 'APEX OF NEBULUS',
    subtitle: 'SECTOR IV • ECLIPSED REACTOR',
    theme: 'apex',
    floors: 25,
    timeLimit: 125,
    parTime: 45,
    spawn: { col: 0, floor: 0 },
    palette: REBOOT_PALETTES.apex,
    mechanics: {
      waterRiseRate: 0.14,
      windForce: 1.1,
      windPeriod: 6.0,
      blackoutCycle: 11.0,
      lightningInterval: 8.0
    },
    ledges: r8Ledges,
    elevators: [
      { col: 2, minFloor: 4, maxFloor: 9, startFloor: 4, speed: 2.2 },
      { col: 3, minFloor: 18, maxFloor: 22, startFloor: 18, speed: 2.2 }
    ],
    doors: [
      { id: 'r8_s1a', col: 13, floor: 11, targetId: 'r8_s1b', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r8_s1b', col: 5, floor: 14, targetId: 'r8_s1a', isExit: false, isVault: false, tunnelStyle: 'sparkArch' },
      { id: 'r8_vault', col: 1, floor: 14, targetId: null, isExit: false, isVault: true, tunnelStyle: 'stone' },
      { id: 'r8_exit', col: 10, floor: 23, targetId: null, isExit: true, isVault: false, tunnelStyle: 'stone' }
    ],
    switches: [
      { id: 'r8_drain1', col: 11, floor: 3, group: 'drain', mode: 'drainValve' },
      { id: 'r8_sw_red', col: 12, floor: 3, group: 'red', mode: 'toggle' },
      { id: 'r8_drain2', col: 4, floor: 9, group: 'drain', mode: 'drainValve' },
      { id: 'r8_sw_cyan', col: 6, floor: 14, group: 'cyan', mode: 'toggle' },
      { id: 'r8_drain3', col: 12, floor: 16, group: 'drain', mode: 'drainValve' }
    ],
    collectibles: [
      { id: 'r8_g1', col: 5, floor: 1, type: 'gear' },
      { id: 'r8_g2', col: 9, floor: 10, type: 'gear' },
      { id: 'r8_g3', col: 2, floor: 14, type: 'gear' },
      { id: 'r8_g4', col: 13, floor: 16, type: 'gear' },
      { id: 'r8_g5', col: 5, floor: 22, type: 'gear' },
      { id: 'r8_g6', col: 12, floor: 23, type: 'gear' },
      { id: 'r8_relic', col: 8, floor: 23, type: 'relic', relicId: 'relic_t8' },
      { id: 'r8_star', col: 14, floor: 24, type: 'starCore' }
    ],
    enemies: [
      { type: 'roller', col: 6.5, floor: 1, dir: 1, speed: 2.2 },
      { type: 'bouncer', col: 10.5, floor: 9, dir: -1, speed: 2.1 },
      { type: 'molecule', col: 5.5, floor: 11.5, dir: 1, speed: 2.5, amp: 0.45 },
      { type: 'eye', col: 11.5, floor: 14.6, dir: -1, speed: 2.4 },
      { type: 'robotV', col: 10.5, floor: 15.5, dir: 1, speed: 2.4, amp: 1.5, minFloor: 14.0, maxFloor: 17.0 },
      { type: 'robotH', col: 12.5, floor: 16, dir: -1, speed: 2.2, minCol: 11, maxCol: 13 },
      { type: 'roller', col: 15.0, floor: 23, dir: -1, speed: 2.2 }
    ]
  });

  return [r1, r2, r3, r4, r5, r6, r7, r8];
}

/**
 * Convenience dispatcher returning Original or Reboot campaign towers.
 * @param {string} [era='reboot']
 */
export function createTowers(era = 'reboot') {
  return era === 'original' ? createOriginalTowers() : createRebootTowers();
}

// ============================================================================
// BFS SOLVABILITY VERIFIERS (1987 Real-Grid Solver + Next-Gen State-Space Solver)
// ============================================================================

const REAL_STEP_TYPES = new Set(['solid', 'crumble', 'slideR', 'slideL', 'ice', 'conveyorL', 'conveyorR']);

function solveRealTowerBFS(tower) {
  const H = Math.max(8, Math.round(Number(tower.floors) || 48));
  const platGrid = Array.from({ length: H }, () => Array(COLS).fill(false));
  const crumbleGrid = Array.from({ length: H }, () => Array(COLS).fill(false));
  const pillarGrid = Array.from({ length: H }, () => Array(COLS).fill(false));
  const liftBottomAt = new Map(); // `${c}:${r}` -> elevator
  const doorMap = new Map(); // `${c}:${r}` -> door

  for (const l of tower.ledges) {
    const c = wrapCol(l.col);
    const f = Math.round(l.floor);
    if (REAL_STEP_TYPES.has(l.type)) {
      if (f >= 0 && f < H) {
        platGrid[f][c] = true;
        if (l.type === 'crumble') crumbleGrid[f][c] = true;
      }
    } else if (l.type === 'pillar') {
      const h = Math.max(1, Math.round(l.h || 1));
      for (let k = 1; k <= h; k++) {
        if (f + k >= 0 && f + k < H) pillarGrid[f + k][c] = true;
      }
    }
  }

  for (const el of tower.elevators || []) {
    const c = wrapCol(el.col);
    const minF = Math.round(el.minFloor);
    liftBottomAt.set(`${c}:${minF}`, el);
  }

  for (const d of tower.doors || []) {
    doorMap.set(`${wrapCol(d.col)}:${Math.round(d.floor)}`, d);
  }

  const hasPlat = (c, r) => r >= 0 && r < H && platGrid[r][wrapCol(c)];
  const hasPillar = (c, r) => r >= 0 && r < H && pillarGrid[r][wrapCol(c)];
  const hasLiftBot = (c, r) => liftBottomAt.has(`${wrapCol(c)}:${r}`);

  const standable = (c, r) => {
    if (r < 0 || r >= H) return false;
    if (!hasPlat(c, r) && !hasLiftBot(c, r)) return false;
    if (hasPillar(c, r + 1) || hasPillar(c, r + 2)) return false;
    if (hasLiftBot(c, r + 1)) return false;
    return true;
  };

  // Classic 1987 jump reach: 1.5-col ARC_JUMP clears 1-brick empty gaps (dx<=2) at dy=0,+1
  // (+2 peak onto adjacent lip if clear), ARC_CLIMB steps +1 at dx=1, and gravity drops dy<0 up to dx<=3.
  const realReach = (dx, dy) => {
    if (dx < 1) return false;
    if (dy >= 3) return false;
    if (dy === 2) return dx <= 2;
    if (dy >= 0) return dx <= 2;
    return dx <= 3;
  };

  // Solid slab underside head-bump: a platform 3 rows up blocks jumping
  const ceilingClear = (c0, dir, dx, r) => {
    for (let k = 0; k <= dx; k++) {
      if (hasPlat(c0 + dir * k, r + 3) || hasPillar(c0 + dir * k, r + 3)) return false;
    }
    return true;
  };

  const reached = new Map(); // `${c}:${r}` -> steps
  const queue = [];
  const enqueue = (c, r, steps) => {
    const wc = wrapCol(c);
    const k = `${wc}:${r}`;
    if (!reached.has(k)) {
      reached.set(k, steps);
      queue.push({ c: wc, r, steps });
    }
  };

  const sc = wrapCol(tower.spawn?.col ?? 0);
  const sf = Math.round(tower.spawn?.floor ?? 0);
  if (standable(sc, sf)) {
    enqueue(sc, sf, 0);
  }

  let head = 0;
  let exitSteps = -1;

  const tryDoorAt = (c, r, steps) => {
    const d = doorMap.get(`${wrapCol(c)}:${r}`);
    if (!d) return;
    if (d.isExit) {
      if (exitSteps === -1 || steps < exitSteps) exitSteps = steps;
      return;
    }
    if (d.targetId && !d.decoy) {
      const farCol = wrapCol(c + 8);
      let fr = r;
      while (fr >= 0 && !standable(farCol, fr)) fr--;
      if (fr >= 0) enqueue(farCol, fr, steps + 1);
    }
  };

  while (head < queue.length) {
    const { c, r, steps } = queue[head++];
    tryDoorAt(c, r, steps);

    // Contiguous walkable run on row r (pillars split runs; boxes are shootable)
    let a = c;
    while (standable(a - 1, r) && wrapCol(a - 1) !== c) a--;
    let b = c;
    while (standable(b + 1, r) && wrapCol(b + 1) !== wrapCol(a)) b++;
    for (let k = a; k <= b; k++) {
      enqueue(k, r, steps + (wrapCol(k) === c ? 0 : 1));
    }

    // Standing on a crumbling '.' cell dissolves it in-place (dx = 0 vertical drop!)
    if (r > 0 && crumbleGrid[r][c]) {
      let fr = r - 1;
      while (fr >= 0 && !standable(c, fr)) fr--;
      if (fr >= 0) enqueue(c, fr, steps + 1);
    }

    // Jumps, auto-steps, and drops from both ends of the run
    for (const [end, dir] of [
      [b, 1],
      [a, -1]
    ]) {
      for (let dx = 1; dx <= 3; dx++) {
        for (let dy = -H; dy <= 2; dy++) {
          if (!realReach(dx, dy)) continue;
          if (r + dy < 0 || r + dy >= H) continue;
          if ((dy >= 0 || dx >= 2) && !(dx === 1 && dy === 1) && !ceilingClear(end, dir, dx, r)) continue;
          if (dx === 1 && dy === 1 && (hasPlat(end, r + 3) && hasPillar(end, r + 2))) continue;
          // Ensure vertical drop isn't passing through intermediate platforms at target column
          const tc = end + dir * dx;
          if (dy < 0) {
            let blockedAbove = false;
            for (let midR = r - 1; midR > r + dy; midR--) {
              if (standable(tc, midR)) {
                blockedAbove = true;
                break;
              }
            }
            if (blockedAbove) continue;
          }
          if (standable(tc, r + dy)) {
            enqueue(tc, r + dy, steps + 1);
          }
        }
      }
    }

    // Multi-stop lift traversal from '^' bottom platform
    const lift = liftBottomAt.get(`${c}:${r}`);
    if (lift) {
      const stops = Array.isArray(lift.stops) ? lift.stops : [lift.minFloor, lift.maxFloor];
      for (const s of stops) {
        if (s === r) continue;
        tryDoorAt(c, s, steps + 1);
        for (const dir of [1, -1]) {
          for (let dx = 1; dx <= 3; dx++) {
            for (let dy = -H; dy <= 2; dy++) {
              if (!realReach(dx, dy)) continue;
              if (s + dy < 0 || s + dy >= H) continue;
              if ((dy >= 0 || dx >= 2) && !(dx === 1 && dy === 1) && !ceilingClear(c, dir, dx, s)) continue;
              const tc = c + dir * dx;
              if (dy < 0) {
                let blockedAbove = false;
                for (let midR = s - 1; midR > s + dy; midR--) {
                  if (standable(tc, midR)) {
                    blockedAbove = true;
                    break;
                  }
                }
                if (blockedAbove) continue;
              }
              if (standable(tc, s + dy)) {
                enqueue(tc, s + dy, steps + 2);
              }
            }
          }
        }
      }
    }
  }

  return {
    solvable: exitSteps !== -1,
    minSteps: exitSteps,
    reachableExit: exitSteps !== -1,
    reached
  };
}

const GROUP_BITS = {
  red: 1,
  cyan: 2,
  conv: 4
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
      ? (lg.inverted ? isSwitchGroupOn(mask, lg.switchGroup) : !isSwitchGroupOn(mask, lg.switchGroup))
      : true;
    if (active && lg.floor >= minF - 0.5 && lg.floor <= maxF + 0.8) {
      return true;
    }
  }
  return false;
}

/**
 * Runs BFS reachability verification across ledges, step-ups, jumps, elevators, doors, and switches.
 * Dispatches automatically to the 1987 real-grid solver when `tower.real === true`.
 * @param {object} tower
 * @returns {{ solvable: boolean, minSteps: number, reachableExit: boolean }}
 */
export function verifyTowerSolvable(tower) {
  if (!tower || !Array.isArray(tower.ledges) || !Array.isArray(tower.doors)) {
    return { solvable: false, minSteps: -1, reachableExit: false };
  }

  if (tower.real) {
    const res = solveRealTowerBFS(tower);
    return {
      solvable: res.solvable,
      minSteps: res.minSteps,
      reachableExit: res.reachableExit
    };
  }

  const exitDoors = tower.doors.filter((d) => d.isExit);
  if (exitDoors.length === 0) {
    return { solvable: false, minSteps: -1, reachableExit: false };
  }

  const laserLedges = tower.ledges.filter((l) => l.type === 'laserGate');
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
      elevatorId: -1
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
        elevatorId: elIdx
      });
    }
  });

  const isNodeActive = (node, mask) => {
    if (node.kind === 'elevator') return true;
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
    return { solvable: false, minSteps: -1, reachableExit: false };
  }

  const doorById = new Map(tower.doors.map((d) => [d.id, d]));
  const switches = Array.isArray(tower.switches) ? tower.switches : [];

  const isGoalNode = (node) =>
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

    if (isGoalNode(cur)) {
      return { solvable: true, minSteps: steps, reachableExit: true };
    }

    const pushState = (nextIdx, nextMask, stepCost = 1) => {
      const k = `${nextIdx}|${nextMask}`;
      if (!visited.has(k)) {
        visited.set(k, steps + stepCost);
        queue.push({ idx: nextIdx, mask: nextMask, steps: steps + stepCost });
      }
    };

    // 1. Toggle switches on same ledge or within unobstructed horizontal snowball range
    for (const sw of switches) {
      const bit = GROUP_BITS[sw.group] || 0;
      if (!bit) continue;
      const dc = colDist(cur.col, sw.col);
      const sameFloor = Math.abs(sw.floor - cur.floor) <= 0.5;
      if (!sameFloor || Math.abs(dc) > 6) continue;

      let blocked = false;
      const stepDir = Math.sign(dc);
      for (let s = 1; s <= Math.abs(dc); s++) {
        const checkCol = wrapCol(cur.col + stepDir * s);
        if (isLaserBlockingAt(laserLedges, checkCol, cur.floor, cur.floor, mask)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        pushState(idx, mask ^ bit, 1);
      }
    }

    // 2. Interior through-tower portals
    if (cur.kind === 'ledge') {
      for (const d of tower.doors) {
        if (d.isExit || d.isVault || d.isRune || !d.targetId) continue;
        if (wrapCol(d.col) === cur.col && Math.abs(d.floor - cur.floor) <= 0.5) {
          const target = doorById.get(d.targetId);
          if (target) {
            const destIndices = nodeIndicesByCoord.get(`${wrapCol(target.col)}:${Math.round(target.floor)}`) || [];
            for (const destIdx of destIndices) {
              if (isNodeActive(supportNodes[destIdx], mask)) {
                pushState(destIdx, mask, 1);
              }
            }
          }
        }
      }
    }

    // 3. Conservative physical moves (indexed by column [-2..+2])
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

        if (absDc === 0 && cur.kind === 'elevator' && nxt.kind === 'elevator' && cur.elevatorId === nxt.elevatorId) {
          if (Math.abs(df) === 1) {
            pushState(nextIdx, mask, 1);
          }
          continue;
        }

        if (absDc === 0) {
          if (df < 0) {
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
          if (isLaserBlockingAt(laserLedges, nxt.col, Math.min(cur.floor, nxt.floor), Math.max(cur.floor, nxt.floor), mask)) {
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
            isLaserBlockingAt(laserLedges, midCol, minF, maxF, mask) ||
            isLaserBlockingAt(laserLedges, nxt.col, minF, maxF, mask)
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

  return { solvable: false, minSteps: -1, reachableExit: false };
}

// ============================================================================
// 14-CHUNK PROCEDURAL COMPOSER + ENDLESS CASUAL EXPEDITIONS + SOLVABILITY PASS
// ============================================================================

const REBOOT_THEMES = ['mist', 'sinking', 'foundry', 'blizzard', 'prism', 'piston', 'blackout', 'apex'];
const PROC_PUZZLE_TYPES = ['lights', 'bells', 'beam', 'blocks'];
const CASUAL_MISSIONS = ['tower_repair', 'treasure_hunt', 'curio_survey', 'puzzle_architect'];
const CASUAL_CURIO_IDS = [
  'curio_astrolabe',
  'curio_nautilus',
  'curio_chronometer',
  'curio_prism_lens',
  'curio_compass',
  'curio_automaton_heart',
  'curio_frost_orchid',
  'curio_thunder_glass'
];

const PROCEDURAL_ADJECTIVES = [
  'ABYSSAL',
  'SHATTERED',
  'IRONCLAD',
  'HOWLING',
  'LUMINOUS',
  'SUNKEN',
  'TEMPEST',
  'OBSIDIAN',
  'CYCLONE',
  'ASTRAL',
  'FROSTBOUND',
  'CLOCKWORK',
  'CELESTIAL',
  'VERDIGRIS',
  'SOLSTICE',
  'DRIFTWOOD'
];

const PROCEDURAL_NOUNS = [
  'MONOLITH',
  'WATCHTOWER',
  'RELIQUARY',
  'CITADEL',
  'BASTION',
  'SPIRE',
  'DERRICK',
  'SANCTUM',
  'BEACON',
  'CONDUIT',
  'LIGHTHOUSE',
  'OBSERVATORY'
];

function buildThemeMechanics(theme, difficulty, rng, casual = false) {
  if (casual) {
    // Peaceful exploration: zero lethal rising sea, gentle atmospheric breeze/storm only
    switch (theme) {
      case 'blizzard':
        return { ...DEFAULT_MECHANICS, windForce: 0.38, windPeriod: 7.5 };
      case 'blackout':
        return { ...DEFAULT_MECHANICS, blackoutCycle: 12.0, lightningInterval: 9.5 };
      default:
        return { ...DEFAULT_MECHANICS };
    }
  }
  const diffScale = Math.min(1.6, 0.75 + difficulty * 0.14);
  switch (theme) {
    case 'sinking':
      return { ...DEFAULT_MECHANICS, waterRiseRate: Number((0.12 * diffScale).toFixed(3)) };
    case 'blizzard':
      return { ...DEFAULT_MECHANICS, windForce: Number((1.05 * diffScale).toFixed(2)), windPeriod: 6.0 };
    case 'piston':
      return { ...DEFAULT_MECHANICS, windForce: 0.4, windPeriod: 7.0 };
    case 'blackout':
      return {
        ...DEFAULT_MECHANICS,
        windForce: 0.5,
        windPeriod: 6.5,
        blackoutCycle: Number((9.5 - Math.min(2.5, difficulty * 0.25)).toFixed(1)),
        lightningInterval: Number((7.5 + rng() * 1.5).toFixed(1))
      };
    case 'apex':
      return {
        ...DEFAULT_MECHANICS,
        waterRiseRate: Number((0.10 * diffScale).toFixed(3)),
        windForce: Number((0.9 * diffScale).toFixed(2)),
        windPeriod: 6.0,
        blackoutCycle: 11.0,
        lightningInterval: 8.0
      };
    default:
      return { ...DEFAULT_MECHANICS };
  }
}

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
 * 14-Template Modular Procedural Generator + Endless Casual Expedition Composer.
 * Supports heights `16..36` across the full `2^32` seed space, with 100% BFS-verified solvability.
 */
export function generateProceduralTower({
  seed = 1,
  index = 1,
  difficulty = 1,
  era = 'reboot',
  casual = false,
  keyOverride = null,
  nameOverride = null,
  subtitleOverride = null,
  floorsOverride = null
} = {}) {
  const cleanSeed = (Number(seed) || 1) >>> 0;
  const rng = mulberry32(cleanSeed);
  const isCasual = Boolean(casual);
  const isOrig = !isCasual && era === 'original';

  const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const depth = Math.max(1, Math.floor(Number(index) || 1));
  const diff = Math.max(1, Number(difficulty) || 1);
  const dynamicHeight = 16 + Math.floor((depth - 1) * 1.6) + Math.floor(diff * 1.1) + randInt(0, 3);
  const floors = floorsOverride
    ? Math.max(14, Math.round(floorsOverride))
    : Math.max(16, Math.min(36, dynamicHeight));
  const exitFloor = floors - 2;

  const theme = isOrig
    ? 'classic'
    : REBOOT_THEMES[(depth - 1 + randInt(0, 7)) % REBOOT_THEMES.length];

  const palette = isOrig
    ? ORIGINAL_PALETTES[(cleanSeed + depth) % ORIGINAL_PALETTES.length]
    : REBOOT_PALETTES[theme] || REBOOT_PALETTES.mist;

  const mechanics = isOrig ? { ...DEFAULT_MECHANICS } : buildThemeMechanics(theme, diff, rng, isCasual);

  const missionType = isCasual
    ? CASUAL_MISSIONS[(depth - 1 + Math.floor(rng() * CASUAL_MISSIONS.length)) % CASUAL_MISSIONS.length]
    : null;

  const adj = pick(PROCEDURAL_ADJECTIVES);
  const noun = pick(PROCEDURAL_NOUNS);
  const name = nameOverride || `${adj} ${noun}`;
  const subtitle =
    subtitleOverride ||
    (isCasual
      ? `CASUAL EXPEDITION ${depth} • ${missionType.replace('_', ' ').toUpperCase()}`
      : `SECTOR ${depth} • SEED ${cleanSeed}`);
  const key = keyOverride || `${isCasual ? 'casual' : 'endless'}_${depth}_${cleanSeed}`;

  const useRuneSecret =
    !isOrig && (missionType === 'puzzle_architect' ? true : rng() < 0.5);
  const procPuzzleType = pick(PROC_PUZZLE_TYPES);
  const procPuzzleSeed = ((cleanSeed ^ 0x9e3779b9) + depth * 7919) >>> 0;

  const ledges = [];
  const elevators = [];
  const doors = [];
  const switches = [];
  const collectibles = [];
  const enemies = [];

  span(ledges, 0, 14, 5, 'solid');
  let curCol = 2;
  let curFloor = 0;
  let dir = rng() < 0.5 ? 1 : -1;
  if (dir === -1) curCol = 14;

  let doorSeq = 1;
  let switchSeq = 1;
  let gearSeq = 1;
  let secretPlaced = false;
  const switchStateTracker = { red: false, cyan: false };

  const addGear = (col, floor) => {
    collectibles.push({ id: `${key}_g${gearSeq++}`, col: wrapCol(col), floor, type: 'gear' });
  };

  const addEnemy = (en) => {
    if (!isCasual) enemies.push(en);
  };

  const pushSecretDoor = (col, floor) => {
    if (isOrig) return;
    if (useRuneSecret) {
      doors.push({
        id: `${key}_rune`,
        col: wrapCol(col),
        floor,
        targetId: null,
        isExit: false,
        isVault: false,
        isRune: true,
        puzzleType: procPuzzleType,
        puzzleSeed: procPuzzleSeed,
        tunnelStyle: 'stone'
      });
    } else {
      doors.push({
        id: `${key}_vault`,
        col: wrapCol(col),
        floor,
        targetId: null,
        isExit: false,
        isVault: true,
        isRune: false,
        tunnelStyle: 'stone'
      });
    }
  };

  // Assemble climb from 14 distinct modular puzzle & architectural chunk templates!
  while (curFloor < exitFloor - 1) {
    const remaining = exitFloor - curFloor;

    if (!isOrig && mechanics.waterRiseRate > 0 && curFloor > 2 && curFloor % 5 <= 1) {
      switches.push({
        id: `${key}_drain_${switchSeq++}`,
        col: wrapCol(curCol),
        floor: curFloor,
        group: 'drain',
        mode: 'drainValve'
      });
    }

    const chunkPool = [
      'spiralCorbelRun',
      'crumbleGapCrossing',
      'conveyorMomentum',
      'glacierSwitchbackAlcove'
    ];
    if (remaining >= 4) {
      chunkPool.push('cageLiftShaft', 'sparkTunnelShortcut', 'portalMazeSplit');
    }
    if (remaining >= 6) {
      chunkPool.push('dualLiftRelay');
    }
    if (!isOrig && remaining >= 3) {
      chunkPool.push(
        'switchPhaseBridge',
        'laserGateCorridor',
        'reversibleConveyorPuzzle',
        'pistonRhythmCascade',
        'steamVentBoostTier'
      );
      if (remaining >= 4) chunkPool.push('multiSwitchCascade');
      if (missionType === 'puzzle_architect') {
        chunkPool.push(
          'switchPhaseBridge',
          'multiSwitchCascade',
          'laserGateCorridor',
          'reversibleConveyorPuzzle'
        );
      }
    }

    const chunk = pick(chunkPool);

    // Template 1: dualLiftRelay (staggered 2-shaft elevator relay)
    if (chunk === 'dualLiftRelay' && remaining >= 6) {
      const shaft1 = wrapCol(curCol + dir);
      const shaft2 = wrapCol(shaft1 + dir * 4);
      const conflict1 = elevators.some((e) => e.col === shaft1 && curFloor <= e.maxFloor + 1);
      const conflict2 = elevators.some((e) => e.col === shaft2 && curFloor + 3 <= e.maxFloor + 1);
      if (!conflict1 && !conflict2 && shaft1 !== shaft2) {
        elevators.push({
          col: shaft1,
          minFloor: curFloor,
          maxFloor: curFloor + 3,
          startFloor: curFloor,
          speed: 1.65
        });
        const midStart = dir === 1 ? wrapCol(shaft1 + 1) : wrapCol(shaft1 - 3);
        span(ledges, curFloor + 3, midStart, 3, 'solid');
        elevators.push({
          col: shaft2,
          minFloor: curFloor + 3,
          maxFloor: curFloor + 6,
          startFloor: curFloor + 3,
          speed: 1.75
        });
        const topStart = dir === 1 ? wrapCol(shaft2 + 1) : wrapCol(shaft2 - 3);
        span(ledges, curFloor + 6, topStart, 3, 'solid');
        addGear(wrapCol(shaft1 + dir * 2), curFloor + 3);
        curFloor += 6;
        curCol = dir === 1 ? wrapCol(topStart + 2) : topStart;
        continue;
      }
    }

    // Template 2: cageLiftShaft (single 3..4 floor cage elevator)
    if (chunk === 'cageLiftShaft' && remaining >= 4) {
      const liftSpan = Math.min(4, remaining - 1);
      const shaftCol = wrapCol(curCol + dir);
      const conflict = elevators.some((e) => e.col === shaftCol && curFloor <= e.maxFloor + 1);
      if (!conflict) {
        elevators.push({
          col: shaftCol,
          minFloor: curFloor,
          maxFloor: curFloor + liftSpan,
          startFloor: curFloor,
          speed: Number((1.5 + Math.min(0.8, diff * 0.1)).toFixed(2))
        });
        const landStart = dir === 1 ? wrapCol(shaftCol + 1) : wrapCol(shaftCol - 3);
        span(ledges, curFloor + liftSpan, landStart, 3, 'solid');
        curFloor += liftSpan;
        curCol = dir === 1 ? wrapCol(shaftCol + 3) : wrapCol(shaftCol - 3);

        addEnemy({
          type: 'eye',
          col: wrapCol(shaftCol + 8) + 0.5,
          floor: curFloor + 0.55,
          dir: -dir,
          speed: Number((1.6 + Math.min(1.0, diff * 0.12)).toFixed(2))
        });
        addGear(shaftCol + dir * 2, curFloor);
        continue;
      }
    }

    // Template 3: sparkTunnelShortcut (side-arch or stone tunnel warp)
    if (chunk === 'sparkTunnelShortcut' && remaining >= 4) {
      const enterCol = wrapCol(curCol);
      const exitCol = wrapCol(enterCol + 7 + randInt(0, 2));
      const jumpFloors = Math.min(3, remaining - 1);
      const targetFloor = curFloor + jumpFloors;
      const dA = `${key}_d${doorSeq}a`;
      const dB = `${key}_d${doorSeq}b`;
      doorSeq++;
      const tStyle = !isOrig && rng() < 0.6 ? 'sparkArch' : 'stone';

      tile(ledges, enterCol, curFloor, 'solid');
      const platStart = dir === 1 ? wrapCol(exitCol - 1) : wrapCol(exitCol - 2);
      span(ledges, targetFloor, platStart, 4, 'solid');

      doors.push(
        { id: dA, col: enterCol, floor: curFloor, targetId: dB, isExit: false, isVault: false, isRune: false, tunnelStyle: tStyle },
        { id: dB, col: exitCol, floor: targetFloor, targetId: dA, isExit: false, isVault: false, isRune: false, tunnelStyle: tStyle }
      );

      curFloor = targetFloor;
      curCol = dir === 1 ? wrapCol(platStart + 3) : platStart;
      addEnemy({
        type: 'bouncer',
        col: wrapCol(exitCol + 8) + 0.5,
        floor: curFloor,
        dir,
        speed: Number((1.5 + Math.min(0.8, diff * 0.1)).toFixed(2))
      });
      continue;
    }

    // Template 4: portalMazeSplit (true portal + bonus gear spur)
    if (chunk === 'portalMazeSplit' && remaining >= 4) {
      const baseStart = dir === 1 ? curCol : wrapCol(curCol - 3);
      span(ledges, curFloor, baseStart, 4, 'solid');
      const trueEnter = wrapCol(baseStart + 1);
      const spurCol = wrapCol(baseStart + 3);
      addGear(spurCol, curFloor);

      const exitCol = wrapCol(trueEnter + 8);
      const targetFloor = curFloor + 3;
      const dA = `${key}_d${doorSeq}a`;
      const dB = `${key}_d${doorSeq}b`;
      doorSeq++;

      const platStart = dir === 1 ? wrapCol(exitCol - 1) : wrapCol(exitCol - 2);
      span(ledges, targetFloor, platStart, 4, 'solid');
      doors.push(
        { id: dA, col: trueEnter, floor: curFloor, targetId: dB, isExit: false, isVault: false, isRune: false, tunnelStyle: 'stone' },
        { id: dB, col: exitCol, floor: targetFloor, targetId: dA, isExit: false, isVault: false, isRune: false, tunnelStyle: 'stone' }
      );
      curFloor = targetFloor;
      curCol = dir === 1 ? wrapCol(platStart + 3) : platStart;
      continue;
    }

    // Template 5: multiSwitchCascade (red -> cyan 2-stage phase bridge relay)
    if (chunk === 'multiSwitchCascade' && !isOrig && remaining >= 4) {
      const g1 = 'red';
      const g2 = 'cyan';
      const sw1Col = wrapCol(curCol);
      tile(ledges, sw1Col, curFloor, 'solid');
      switches.push({ id: `${key}_sw_${switchSeq++}`, col: sw1Col, floor: curFloor, group: g1, mode: 'toggle' });
      switchStateTracker[g1] = !switchStateTracker[g1];

      const br1 = wrapCol(sw1Col + dir * 2);
      tile(ledges, br1, curFloor + 1, 'phaseBlock', { switchGroup: g1, inverted: !switchStateTracker[g1] });

      const midStart = dir === 1 ? wrapCol(br1 + 2) : wrapCol(br1 - 3);
      span(ledges, curFloor + 2, midStart, 2, 'solid');
      const sw2Col = dir === 1 ? wrapCol(midStart + 1) : midStart;
      switches.push({ id: `${key}_sw_${switchSeq++}`, col: sw2Col, floor: curFloor + 2, group: g2, mode: 'toggle' });
      switchStateTracker[g2] = !switchStateTracker[g2];

      const br2 = wrapCol(sw2Col + dir * 2);
      tile(ledges, br2, curFloor + 3, 'phaseBlock', { switchGroup: g2, inverted: !switchStateTracker[g2] });

      const destStart = dir === 1 ? wrapCol(br2 + 2) : wrapCol(br2 - 4);
      span(ledges, curFloor + 4, destStart, 3, 'solid');
      addGear(br2, curFloor + 3);
      curFloor += 4;
      curCol = dir === 1 ? wrapCol(destStart + 2) : destStart;
      continue;
    }

    // Template 6: laserGateCorridor (switch deactivating ceiling-capped laserGate)
    if (chunk === 'laserGateCorridor' && !isOrig && remaining >= 3) {
      const group = switchSeq % 2 === 1 ? 'red' : 'cyan';
      const swCol = wrapCol(curCol);
      tile(ledges, swCol, curFloor, 'solid');
      switches.push({ id: `${key}_sw_${switchSeq++}`, col: swCol, floor: curFloor, group, mode: 'toggle' });
      const nextState = !switchStateTracker[group];
      switchStateTracker[group] = nextState;

      const preCol = wrapCol(swCol + dir * 1);
      const gateCol = wrapCol(swCol + dir * 2);
      const postStart = dir === 1 ? wrapCol(swCol + dir * 3) : wrapCol(swCol + dir * 3 - 2);
      tile(ledges, preCol, curFloor + 1, 'solid');
      // In game.js: l.active = l.inverted ? swOn : !swOn -> we want active=false (open) when swOn === nextState!
      tile(ledges, gateCol, curFloor + 1, 'laserGate', {
        switchGroup: group,
        inverted: !nextState
      });
      tile(ledges, gateCol, curFloor + 3, 'solid'); // cap above laserGate
      span(ledges, curFloor + 1, postStart, 3, 'solid');
      const postEnd = dir === 1 ? wrapCol(postStart + 2) : postStart;
      const upStart = dir === 1 ? wrapCol(postEnd + 1) : wrapCol(postEnd - 3);
      span(ledges, curFloor + 2, upStart, 3, 'solid');
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(upStart + 2) : upStart;
      continue;
    }

    // Template 7: switchPhaseBridge (single resonator switch + phaseBlock bridge)
    if (chunk === 'switchPhaseBridge' && !isOrig && remaining >= 3) {
      const group = switchSeq % 2 === 1 ? 'red' : 'cyan';
      const swCol = wrapCol(curCol);
      tile(ledges, swCol, curFloor, 'solid');
      switches.push({
        id: `${key}_sw_${switchSeq++}`,
        col: swCol,
        floor: curFloor,
        group,
        mode: 'toggle'
      });
      const nextGroupState = !switchStateTracker[group];
      switchStateTracker[group] = nextGroupState;

      const bridgeCol = wrapCol(swCol + dir * 2);
      tile(ledges, bridgeCol, curFloor + 1, 'phaseBlock', {
        switchGroup: group,
        inverted: !nextGroupState
      });
      const destStart = dir === 1 ? wrapCol(bridgeCol + 2) : wrapCol(bridgeCol - 4);
      span(ledges, curFloor + 2, destStart, 3, 'solid');

      curFloor += 2;
      curCol = dir === 1 ? wrapCol(destStart + 2) : destStart;
      addGear(bridgeCol, curFloor - 1);
      continue;
    }

    // Template 8: reversibleConveyorPuzzle (conveyorFlip switch + opposing belts)
    if (chunk === 'reversibleConveyorPuzzle' && !isOrig && remaining >= 3) {
      switches.push({
        id: `${key}_conv_${switchSeq++}`,
        col: wrapCol(curCol),
        floor: curFloor,
        group: 'conv',
        mode: 'conveyorFlip'
      });
      const oppType = dir === 1 ? 'conveyorL' : 'conveyorR';
      const cStart = dir === 1 ? wrapCol(curCol + 1) : wrapCol(curCol - 3);
      span(ledges, curFloor + 1, cStart, 3, oppType);
      const endCol = dir === 1 ? wrapCol(cStart + 2) : cStart;
      const nextStart = dir === 1 ? wrapCol(endCol + 2) : wrapCol(endCol - 4);
      span(ledges, curFloor + 2, nextStart, 3, 'solid');
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(nextStart + 2) : nextStart;
      continue;
    }

    // Template 9: pistonRhythmCascade (staggered extending hydraulic pistons)
    if (chunk === 'pistonRhythmCascade' && !isOrig && remaining >= 3) {
      const p1 = wrapCol(curCol + dir * 2);
      const p2 = wrapCol(p1 + dir * 2);
      tile(ledges, p1, curFloor + 1, 'piston', { phasePeriod: 3.1, phaseOffset: 0.0 });
      tile(ledges, p2, curFloor + 2, 'piston', { phasePeriod: 3.1, phaseOffset: 0.9 });
      const aStart = dir === 1 ? wrapCol(p2 + 2) : wrapCol(p2 - 4);
      span(ledges, curFloor + 3, aStart, 3, 'solid');
      addGear(p2, curFloor + 2);
      curFloor += 3;
      curCol = dir === 1 ? wrapCol(aStart + 2) : aStart;
      continue;
    }

    // Template 10: steamVentBoostTier (walkable steam grate + bonus upper perch)
    if (chunk === 'steamVentBoostTier' && !isOrig && remaining >= 3) {
      const vCol = wrapCol(curCol + dir * 2);
      tile(ledges, vCol, curFloor + 1, 'steamVent', { phasePeriod: 3.3, phaseOffset: Number((rng() * 1.4).toFixed(2)) });
      tile(ledges, vCol, curFloor + 3, 'solid'); // high steam-launch bonus perch!
      addGear(vCol, curFloor + 3);
      const aStart = dir === 1 ? wrapCol(vCol + 2) : wrapCol(vCol - 4);
      span(ledges, curFloor + 2, aStart, 3, 'solid');
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(aStart + 2) : aStart;
      continue;
    }

    // Template 11: crumbleGapCrossing (2-tile crumble bridge + solid anchor)
    if (chunk === 'crumbleGapCrossing' && remaining >= 2) {
      const c1 = wrapCol(curCol + dir * 2);
      const cStart = dir === 1 ? c1 : wrapCol(c1 - 1);
      span(ledges, curFloor + 1, cStart, 2, 'crumble');
      const nextAnchor = dir === 1 ? wrapCol(c1 + 3) : wrapCol(c1 - 5);
      span(ledges, curFloor + 2, nextAnchor, 3, 'solid');

      addEnemy({
        type: 'molecule',
        col: wrapCol(c1 + dir * 6) + 0.5,
        floor: curFloor + 1.55,
        dir: -dir,
        speed: Number((1.8 + Math.min(0.9, diff * 0.1)).toFixed(2)),
        amp: 0.4
      });

      curFloor += 2;
      curCol = dir === 1 ? wrapCol(nextAnchor + 2) : nextAnchor;
      addGear(c1, curFloor - 1);
      continue;
    }

    // Template 12: conveyorMomentum (directional belt run)
    if (chunk === 'conveyorMomentum' && remaining >= 2) {
      const convType = dir === 1 ? 'conveyorR' : 'conveyorL';
      const cStart = dir === 1 ? wrapCol(curCol + 1) : wrapCol(curCol - 3);
      span(ledges, curFloor + 1, cStart, 3, convType);
      const endCol = dir === 1 ? wrapCol(cStart + 2) : cStart;
      const anchorStart = dir === 1 ? wrapCol(endCol + 2) : wrapCol(endCol - 4);
      span(ledges, curFloor + 2, anchorStart, 3, 'solid');

      curFloor += 2;
      curCol = dir === 1 ? wrapCol(anchorStart + 2) : anchorStart;
      continue;
    }

    // Template 13: glacierSwitchbackAlcove (ice shelf + solid windbreak spur)
    if (chunk === 'glacierSwitchbackAlcove' && remaining >= 2) {
      const iStart = dir === 1 ? wrapCol(curCol + 2) : wrapCol(curCol - 4);
      span(ledges, curFloor + 1, iStart, 3, 'ice');
      const iEnd = dir === 1 ? wrapCol(iStart + 2) : iStart;
      const aStart = dir === 1 ? wrapCol(iEnd + 2) : wrapCol(iEnd - 4);
      span(ledges, curFloor + 2, aStart, 3, 'solid');
      curFloor += 2;
      curCol = dir === 1 ? wrapCol(aStart + 2) : aStart;
      continue;
    }

    // Template 14: spiralCorbelRun (+2..3 stepped stone floors + optional Secret Alcove)
    const steps = Math.min(3, remaining);
    for (let s = 0; s < steps; s++) {
      curFloor += 1;
      const stepDelta = s % 2 === 0 ? 1 : 2;
      curCol = wrapCol(curCol + dir * stepDelta);
      const runStart = dir === 1 ? curCol : wrapCol(curCol - 2);
      span(ledges, curFloor, runStart, 3, 'solid');
      if (s === 1 && curFloor > 2) {
        const isRob = rng() < 0.35;
        addEnemy({
          type: isRob ? 'robotH' : 'roller',
          col: (isRob ? wrapCol(runStart + 1) : wrapCol(runStart + 8)) + 0.5,
          floor: curFloor,
          dir,
          speed: Number((1.6 + Math.min(0.9, diff * 0.1)).toFixed(2)),
          ...(isRob ? { minCol: runStart, maxCol: wrapCol(runStart + 2) } : {})
        });
      }
      curCol = dir === 1 ? wrapCol(runStart + 2) : runStart;
    }

    if (!secretPlaced && curFloor >= Math.floor(exitFloor * 0.45) && curFloor <= exitFloor - 3) {
      const sideCol = wrapCol(curCol - dir * 4);
      const bStart = dir === 1 ? sideCol : wrapCol(sideCol - 1);
      span(ledges, curFloor, bStart, 2, 'solid');
      tile(ledges, wrapCol(curCol - dir * 2), curFloor, isCasual ? 'solid' : 'crumble');
      pushSecretDoor(sideCol, curFloor);
      collectibles.push({
        id: `${key}_star`,
        col: wrapCol(sideCol + (dir === 1 ? 1 : -1)),
        floor: curFloor,
        type: 'starCore'
      });
      secretPlaced = true;
    }

    if (rng() < 0.3) dir = -dir;
  }

  while (curFloor < exitFloor) {
    curFloor += 1;
    curCol = wrapCol(curCol + dir * 2);
    const sStart = dir === 1 ? curCol : wrapCol(curCol - 2);
    span(ledges, curFloor, sStart, 3, 'solid');
    curCol = dir === 1 ? wrapCol(sStart + 2) : sStart;
  }

  const summitStart = wrapCol(curCol - 1);
  span(ledges, exitFloor, summitStart, 5, 'solid');
  const exitCol = wrapCol(summitStart + 2);
  doors.push({
    id: `${key}_exit`,
    col: exitCol,
    floor: exitFloor,
    targetId: null,
    isExit: true,
    isVault: false,
    isRune: false,
    tunnelStyle: 'stone'
  });
  addGear(wrapCol(summitStart + 4), exitFloor);

  if (!secretPlaced) {
    const bonusCol = wrapCol(summitStart - 2);
    tile(ledges, bonusCol, exitFloor, 'solid');
    pushSecretDoor(bonusCol, exitFloor);
    collectibles.push({ id: `${key}_star`, col: bonusCol, floor: exitFloor, type: 'starCore' });
  }

  const timeLimit = Math.min(180, 85 + Math.round((floors - 16) * 4.5));
  const parTime = Math.max(28, Math.round(timeLimit * 0.36));

  let tower = finalizeTower({
    id: depth,
    key,
    era,
    casual: isCasual,
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
    collectibles,
    enemies
  });

  // Guaranteed Solvability Verification + Deterministic Bridge Repair Pass
  const check = verifyTowerSolvable(tower);
  if (!check.solvable) {
    tower = repairProceduralTower(tower, exitCol, exitFloor);
  }

  // Populate Endless Casual Expedition Objectives onto BFS-Verified Reachable Solid Ledges!
  if (isCasual && missionType) {
    const reachSpots = findReachableSolidCandidates(tower);
    // Guarantee enough spread-out solid stations even on compact layouts
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
      const partNames = ['Copper Coil', 'Prism Lens', 'Brass Shaft'];
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
        label: 'Tinker Workbench'
      };
      tower.casualMission = {
        type: 'tower_repair',
        title: 'FIX THE MONOLITH',
        subtitle: 'Scavenge 3 Salvage Parts • Craft Beacon Dynamo at Workbench • Activate Crown',
        targetCount: 3,
        requiresWorkbench: true
      };
    } else if (missionType === 'treasure_hunt') {
      const keyNames = ['Sun Key', 'Tide Key', 'Star Key'];
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
      const curioId = CASUAL_CURIO_IDS[(cleanSeed + depth) % CASUAL_CURIO_IDS.length];
      tower.treasureChest = {
        col: chestSpot.col,
        floor: chestSpot.floor,
        opened: false,
        curioId,
        gearReward: 15
      };
      tower.casualMission = {
        type: 'treasure_hunt',
        title: 'LOST TREASURE',
        subtitle: 'Find 3 Compass Keys • Unlock the Sunken Chest Near the Summit',
        targetCount: 3,
        curioId
      };
    } else if (missionType === 'curio_survey') {
      for (let i = 0; i < 4; i++) {
        const spot = pickAtFrac(0.15 + i * 0.22, used);
        const curioId = CASUAL_CURIO_IDS[(cleanSeed + depth + i * 3) % CASUAL_CURIO_IDS.length];
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
        title: 'ARTIFACT SURVEY',
        subtitle: 'Recover 4 Ancient Ocean Curios Across the Spire',
        targetCount: 4
      };
    } else {
      const spot = pickAtFrac(0.68, used);
      const curioId = CASUAL_CURIO_IDS[(cleanSeed + depth) % CASUAL_CURIO_IDS.length];
      tower.collectibles.push({
        id: `${key}_curio_1`,
        col: spot.col,
        floor: spot.floor,
        type: 'curio',
        curioId
      });
      tower.casualMission = {
        type: 'puzzle_architect',
        title: 'MASTER PUZZLE SPIRE',
        subtitle: 'Navigate Multi-Switch Conduits & Decipher the Hidden Rune Chamber',
        targetCount: 1,
        requiresRune: true
      };
    }
  }

  return tower;
}

function repairProceduralTower(tower, exitCol, exitFloor) {
  const shaftCols = new Set(tower.elevators.map((e) => e.col));
  let c = wrapCol(tower.spawn.col);
  const repairMap = new Map();
  for (const l of tower.ledges) {
    const isBarrier = l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate';
    repairMap.set(isBarrier ? `${l.col}:${l.floor}:${l.type}` : `${l.col}:${l.floor}:step`, { ...l });
  }

  for (let f = tower.spawn.floor; f <= exitFloor; f++) {
    if (f > tower.spawn.floor) {
      let step = 1;
      if (shaftCols.has(wrapCol(c + 1))) step = 2;
      if (shaftCols.has(wrapCol(c + step))) {
        tower.elevators = tower.elevators.filter((e) => e.col !== wrapCol(c + step));
        shaftCols.delete(wrapCol(c + step));
      }
      repairMap.delete(`${c}:${f}:step`);
      repairMap.delete(`${c}:${f}:laserGate`);
      c = wrapCol(c + step);
    }
    repairMap.delete(`${c}:${f}:laserGate`);
    repairMap.set(`${c}:${f}:step`, {
      col: c,
      floor: f,
      type: 'solid',
      switchGroup: null,
      inverted: false,
      phasePeriod: 3.2,
      phaseOffset: 0
    });
    repairMap.delete(`${c}:${f + 1}:step`);
    repairMap.delete(`${c}:${f + 1}:laserGate`);
  }

  while (c !== exitCol) {
    const d = colDist(c, exitCol);
    c = wrapCol(c + Math.sign(d));
    if (shaftCols.has(c)) {
      tower.elevators = tower.elevators.filter((e) => e.col !== c);
      shaftCols.delete(c);
    }
    repairMap.delete(`${c}:${exitFloor}:laserGate`);
    repairMap.set(`${c}:${exitFloor}:step`, {
      col: c,
      floor: exitFloor,
      type: 'solid',
      switchGroup: null,
      inverted: false,
      phasePeriod: 3.2,
      phaseOffset: 0
    });
  }

  return finalizeTower({
    ...tower,
    ledges: Array.from(repairMap.values())
  });
}

/**
 * Builds today's deterministic 20-floor UTC Daily Challenge Tower.
 * @param {Date|number|string} [date=new Date()]
 */
export function createDailyTower(date = new Date()) {
  const { seed, dateKey } = getDailySeed(date);
  return generateProceduralTower({
    seed,
    index: 1,
    difficulty: 2.5,
    era: 'reboot',
    keyOverride: `daily_${seed}`,
    nameOverride: `DAILY MONOLITH ${dateKey}`,
    subtitleOverride: `UTC DAILY CHALLENGE • ${dateKey}`,
    floorsOverride: 20
  });
}
