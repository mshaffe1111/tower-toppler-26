import { describe, it, expect, vi } from 'vitest';
import {
  COLS,
  createTowers,
  createSanctumTowers,
  createWardenGauntletTowers,
  generateProceduralTower,
  createDailyTower,
} from '../src/levels.js';
import {
  ToweringWatersGame,
  FIXED_STEP,
  BASE_WALK_SPEED,
} from '../src/game.js';

function createMockInput() {
  const state = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    fire: false,
    whip: false,
    analogX: 0,
    analogY: 0,
  };
  const edges = {
    jump: false,
    fire: false,
    whip: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };
  return {
    controlMode: 'gesture',
    state,
    edges,
    press(key) {
      state[key] = true;
      edges[key] = true;
    },
    release(key) {
      state[key] = false;
    },
    consumeJustPressed(key) {
      const v = Boolean(edges[key]);
      edges[key] = false;
      return v;
    },
    isLiveHorizHeld() {
      return Boolean(state.left || state.right || Math.abs(state.analogX || 0) > 0.05);
    },
    update() {},
    clearFrame() {},
    resetState() {
      for (const k of Object.keys(state)) state[k] = typeof state[k] === 'number' ? 0 : false;
      for (const k of Object.keys(edges)) edges[k] = false;
    },
    setGameMode() {},
    setInteractContext() {},
    haptic() {},
  };
}

function createTrackingProgression() {
  let gears = 0;
  const hiScores = {};
  const settings = { zenMode: false, skinId: 'sea_glass_guardian', blasterFxId: 'tidal_pearl' };
  const skillRanks = {};
  return {
    dailyResults: [],
    floodRuns: [],
    expeditionRuns: [],
    gauntletRuns: [],
    masterClears: [],
    towerClears: [],
    sanctumClears: [],
    skillRanks,
    getSettings: () => ({ ...settings }),
    updateSettings: (s) => Object.assign(settings, s),
    getEquippedSkin: () => settings.skinId,
    getEquippedBlasterFx: () => settings.blasterFxId,
    getHighScore: (b) => hiScores[b] || 0,
    recordScore: (b, s) => {
      hiScores[b] = Math.max(hiScores[b] || 0, s);
    },
    getGears: () => gears,
    addGears: (n) => {
      gears += n;
    },
    getSkillRank: (id) => skillRanks[id] || 0,
    getAllSkillRanks: () => ({ ...skillRanks }),
    getCollectedRelics: () => [],
    getRescuedCritters: () => [],
    getCritterCount: () => 0,
    getWatershedHealth: () => 50,
    getOverallWatershedHealth: () => 50,
    drainPendingTrophies: () => [],
    recordGameplayEvent: () => null,
    unlockTrophy: () => null,
    recordMiniGamePlayed: () => null,
    recordDailyResult(res) {
      this.dailyResults.push(res);
    },
    recordFloodRushRun(res) {
      this.floodRuns.push(res);
    },
    recordExpeditionRun(res) {
      this.expeditionRuns.push(res);
    },
    recordWardenGauntletRun(res) {
      this.gauntletRuns.push(res);
    },
    recordMasterWatershedClear(res) {
      this.masterClears.push(res);
      return null;
    },
    recordSanctumSpireClear(id) {
      this.sanctumClears.push(id);
    },
    recordCasualExpedition: () => null,
    recordTowerClear(payload) {
      this.towerClears.push(payload);
      return {
        stars: { count: 3, clear: true, vault: Boolean(payload.vault), speed: Boolean(payload.speed) },
        watershedBefore: 50,
        watershedAfter: 100,
        overallWatershedHealth: 60,
      };
    },
  };
}

function colDistSigned(a, b) {
  let d = (((b % COLS) + COLS) % COLS) - (((a % COLS) + COLS) % COLS);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

function fastForwardCoreDescentAndTopple(game, maxSteps = 5000) {
  for (let i = 0; i < maxSteps; i++) {
    if (game.mode !== 'core_descent' && game.mode !== 'topple') break;
    if (game.mode === 'core_descent' && game.coreDescent) {
      // Smash all crystal locks cleanly while diving
      for (const cl of game.coreDescent.crystalLocks) {
        if (!cl.shattered) game._smashCoreCrystal(game.coreDescent, cl);
      }
      game.coreDescent.invuln = 2.0;
    }
    game.update(FIXED_STEP);
  }
}

describe('Round 5 Deliverable 1: Solid Stationary Unpowered Elevator Cabs', () => {
  it('supports walking onto, standing on, walking/jumping off, landing on, and pressurizing unpowered elevators without falling through', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);

    const campaign = createTowers('campaign');
    const sanctums = createSanctumTowers(15);

    // 1. Verify across Spire 1, Spire 5, Spire 10, and Sanctum 1 (col 9, floor 3)
    const unpoweredCases = [
      { tower: campaign[0], label: 'Spire 1' },
      { tower: campaign[4], label: 'Spire 5' },
      { tower: campaign[9], label: 'Spire 10' },
      { tower: sanctums[0], label: 'Sanctum 1' },
    ];

    for (const { tower, label } of unpoweredCases) {
      game.mode = 'tower';
      game.loadTower(tower);
      game.enemies = [];

      const el = game.elevators.find((e) => e.powered === false);
      expect(el, `${label} should have an unpowered elevator`).toBeTruthy();

      // Drop Gateway from 0.8F above the unpowered cab -> must land solidly on cab deck (hitEl) & project landing shadow!
      const p = game.gateway;
      p.col = el.col + 0.5;
      p.floor = el.floor + 0.8;
      p.vy = -4.0;
      p.vx = 0;
      p.onGround = false;
      p.onElevator = null;

      expect(game._computeLandingFloor(p.col, p.floor)).toBeCloseTo(el.floor, 3);

      for (let step = 0; step < 60; step++) {
        game.update(FIXED_STEP);
        if (p.onGround) break;
      }

      expect(p.onGround, `${label}: must land solidly on unpowered cab`).toBe(true);
      expect(p.onElevator, `${label}: must stand on unpowered cab`).toBe(el);
      expect(p.floor).toBeCloseTo(el.floor, 3);

      // HUD must prompt SPIN PIPE-VALVES TO PRESSURIZE LIFT & NOT hijack lift gesture interact kind
      const hud = game.getHudState();
      expect(hud.actionPrompt).toBe('SPIN PIPE-VALVES TO PRESSURIZE LIFT');
      expect(game._evaluateInteractContext().kind).not.toBe('lift');

      // Pressing UP/DOWN on an unpowered cab must NOT move el.floor
      const startElFloor = el.floor;
      inp.state.up = true;
      for (let step = 0; step < 30; step++) game.update(FIXED_STEP);
      expect(el.floor).toBe(startElFloor);
      inp.state.up = false;
      inp.state.down = true;
      for (let step = 0; step < 30; step++) game.update(FIXED_STEP);
      expect(el.floor).toBe(startElFloor);
      inp.state.down = false;

      // Off-center standing on unpowered cab must NOT center-lock / magnetize Gateway
      p.col = el.col + 0.5 + 0.28;
      p.vx = 0;
      for (let step = 0; step < 25; step++) game.update(FIXED_STEP);
      expect(p.col).toBeCloseTo(el.col + 0.78, 3);
      expect(p.onGround).toBe(true);
    }

    // 2. Test walking onto unpowered cab from left ledge, walking across onto right ledge (0 freefall frames), jumping off, and pressurizing!
    const synthTower = {
      id: 901,
      name: 'UNPOWERED CAB TEST',
      floors: 12,
      spawn: { col: 7, floor: 3 },
      mechanics: { waterBaseFloor: -0.55 },
      ledges: [
        { col: 7, floor: 3, type: 'solid', stairDir: 0 },
        { col: 8, floor: 3, type: 'solid', stairDir: 0 },
        // col 9 is unpowered elevator at floor 3!
        { col: 10, floor: 3, type: 'solid', stairDir: 0 },
        { col: 11, floor: 3, type: 'solid', stairDir: 0 },
      ],
      elevators: [
        { id: 'lift_test', col: 9, minFloor: 3, maxFloor: 8, startFloor: 3, speed: 2.2, pipeGroup: 'pipeA', powered: false },
      ],
      switches: [
        { id: 'v1', col: 7, floor: 3, pipeGroup: 'pipeA', mode: 'pipeValve' },
        { id: 'v2', col: 11, floor: 3, pipeGroup: 'pipeA', mode: 'pipeValve' },
      ],
      doors: [{ id: 'exit', col: 10, floor: 9, isExit: true }],
    };

    game.mode = 'tower';
    game.loadTower(synthTower);
    const p = game.gateway;
    p.col = 8.4;
    p.floor = 3;

    // Walk across col 8 -> unpowered cab at col 9 -> col 10 with ZERO freefall dips!
    inp.state.right = true;
    inp.state.analogX = 1.0;
    let touchedUnpoweredCab = false;
    let airFramesWhileCrossing = 0;
    for (let step = 0; step < 120; step++) {
      game.update(FIXED_STEP);
      if (p.onElevator) touchedUnpoweredCab = true;
      if (!p.onGround) airFramesWhileCrossing++;
      if (p.col >= 10.5) break;
    }
    inp.resetState();
    expect(touchedUnpoweredCab).toBe(true);
    expect(airFramesWhileCrossing).toBe(0);
    expect(p.onElevator).toBeNull();
    expect(p.onGround).toBe(true);
    expect(p.floor).toBe(3);

    // Walk back onto unpowered cab and jump cleanly off it
    p.col = 9.5;
    p.vx = 0;
    game.update(FIXED_STEP);
    expect(p.onElevator).toBe(game.elevators[0]);
    inp.press('jump');
    game.update(FIXED_STEP);
    expect(p.onElevator).toBeNull();
    expect(p.onGround).toBe(false);
    expect(p.vy).toBeGreaterThan(10.5);
    inp.resetState();
    for (let step = 0; step < 80; step++) game.update(FIXED_STEP);
    expect(p.onGround).toBe(true);
    expect(p.onElevator).toBe(game.elevators[0]);

    // Spin both pipe-valves -> lift pressurizes immediately and rides upward!
    for (const sw of game.switches) game._triggerSwitch(sw);
    expect(game.elevators[0].powered).toBe(true);
    expect(game.getHudState().actionPrompt).toBe('▲▼ MECHANICAL ELEVATOR');
    for (let step = 0; step < 60; step++) game.update(FIXED_STEP);
    expect(p.floor).toBeGreaterThan(3.8);
  });
});

describe('Round 5 Deliverable 2: 1:1 Canonical Stair Physics Parity & Handoffs', () => {
  it('enforces explicit stairDir, rejects flat bridges/blockers/shafts/non-solid tiles, supports mock towers, and snaps top/bottom landings with 0 freefall dips', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());
    game.mode = 'tower';

    // 1. Annotated tower: stairDir === 0 terrace jump step MUST NOT create an invisible physics ramp!
    game.loadTower({
      id: 902,
      name: 'STAIR INVARIANT TEST',
      floors: 12,
      spawn: { col: 0, floor: 0 },
      ledges: [
        // Non-stair terrace step (stairDir: 0)
        { col: 2, floor: 0, type: 'solid', stairDir: 0 },
        { col: 3, floor: 1, type: 'solid', stairDir: 0 },
        // Fake stair to OFF phaseBlock (must be rejected!)
        { col: 5, floor: 0, type: 'solid', stairDir: 1 },
        { col: 6, floor: 1, type: 'phaseBlock', switchGroup: 'red', stairDir: 0 },
        // Stair blocked by inactive phaseBlock flat bridge at (9, 0) (must be rejected!)
        { col: 8, floor: 0, type: 'solid', stairDir: 1 },
        { col: 9, floor: 0, type: 'phaseBlock', switchGroup: 'red', stairDir: 0 },
        { col: 9, floor: 1, type: 'solid', stairDir: 0 },
        // Stair blocked by elevator shaft at col 12 (must be rejected!)
        { col: 11, floor: 0, type: 'solid', stairDir: 1 },
        { col: 12, floor: 1, type: 'solid', stairDir: 0 },
        // Stair blocked by overhead pillar at (14, 1) (must be rejected!)
        { col: 14, floor: 0, type: 'solid', stairDir: 1 },
        { col: 14, floor: 1, type: 'pillar', h: 2 },
        { col: 15, floor: 1, type: 'solid', stairDir: 0 },
        // Valid canonical 2-step right flight (17,0)->(18,1)->(19,2) + wrap to (0,3)!
        { col: 16, floor: 0, type: 'solid', stairDir: 0 },
        { col: 17, floor: 0, type: 'solid', stairDir: 1 },
        { col: 18, floor: 1, type: 'solid', stairDir: 1 },
        { col: 19, floor: 2, type: 'solid', stairDir: 1 },
        { col: 0, floor: 3, type: 'solid', stairDir: 0 },
        { col: 1, floor: 3, type: 'solid', stairDir: 0 },
      ],
      elevators: [{ id: 'shaft_block', col: 12, minFloor: 0, maxFloor: 4, startFloor: 0, speed: 0 }],
      doors: [{ id: 'exit', col: 1, floor: 3, isExit: true }],
    });

    expect(game._sampleStairSurface(3.0, 0.5)).toBeNull(); // stairDir: 0 terrace step
    expect(game._sampleStairSurface(6.0, 0.5)).toBeNull(); // upper phaseBlock
    expect(game._sampleStairSurface(9.0, 0.5)).toBeNull(); // flat bridge (even phased-out!)
    expect(game._sampleStairSurface(12.0, 0.5)).toBeNull(); // elevator shaft
    expect(game._sampleStairSurface(15.0, 0.5)).toBeNull(); // overhead pillar
    expect(game._sampleStairSurface(18.0, 0.5)).not.toBeNull(); // valid canonical stair!

    // Climb full 3-step wrap-around staircase (16,0) -> (0,3) -> (1,3) and verify ZERO freefall frames at top landing!
    const p = game.gateway;
    p.col = 16.5;
    p.floor = 0;
    p.onGround = true;
    inp.state.right = true;
    inp.state.analogX = 1.0;

    let freefallFramesUp = 0;
    let sawOnStairs = false;
    for (let step = 0; step < 260; step++) {
      game.update(FIXED_STEP);
      if (p.onStairs) sawOnStairs = true;
      if (!p.onGround) freefallFramesUp++;
      if (p.floor === 3 && Math.abs(colDistSigned(p.col, 1.3)) < 0.15) break;
    }
    expect(sawOnStairs).toBe(true);
    expect(freefallFramesUp).toBe(0);
    expect(p.floor).toBe(3);
    expect(p.onGround).toBe(true);

    // Now walk BACK DOWN (1,3) -> (16,0) leftwards and verify ZERO freefall frames at top/bottom handoffs!
    inp.resetState();
    inp.state.left = true;
    inp.state.analogX = -1.0;
    let freefallFramesDown = 0;
    for (let step = 0; step < 260; step++) {
      game.update(FIXED_STEP);
      if (!p.onGround) freefallFramesDown++;
      if (p.floor === 0 && Math.abs(colDistSigned(p.col, 16.6)) < 0.15) break;
    }
    expect(freefallFramesDown).toBe(0);
    expect(p.floor).toBe(0);
    expect(p.onGround).toBe(true);

    // 2. Synthetic unit-test mock tower WITHOUT stairDir annotations (stairDir === undefined) falls back safely!
    inp.resetState();
    game.loadTower({
      id: 903,
      name: 'SYNTHETIC UNANNOTATED STAIR',
      floors: 8,
      spawn: { col: 0, floor: 0 },
      ledges: [
        { col: 0, floor: 0, type: 'solid' },
        { col: 1, floor: 1, type: 'solid' },
      ],
      doors: [{ id: 'exit', col: 1, floor: 1, isExit: true }],
    });
    expect(game._sampleStairSurface(1.0, 0.5)).not.toBeNull();
  });
});

describe('Round 5 Deliverable 3: Zero Idle Dry-Stone Wind Slip', () => {
  it('holds 0.000 col horizontal drift for 10.0s idle on narrow dry-stone ledges in wind while preserving air & ice wind push', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());

    const campaign = createTowers('campaign');
    const gauntlets = createWardenGauntletTowers();

    // Find a daily_tide date with tradewind_gale or construct daily gale spire
    let galeDaily = null;
    for (let day = 1; day <= 25; day++) {
      const d = createDailyTower(`2026-11-${String(day).padStart(2, '0')}T00:00:00Z`);
      if (d.dailyModifier?.id === 'tradewind_gale' || (d.mechanics?.windForce || 0) > 0) {
        galeDaily = d;
        break;
      }
    }
    expect(galeDaily).toBeTruthy();

    const windySpires = [
      { tower: galeDaily, label: 'Daily Tide Tradewind Gale' },
      { tower: campaign[3], label: 'Campaign Spire 4' },
      { tower: campaign[8], label: 'Campaign Spire 9' },
      { tower: campaign[9], label: 'Campaign Spire 10' },
      { tower: gauntlets[4], label: 'Warden Gauntlet Act 5' },
    ];

    for (const { tower, label } of windySpires) {
      game.mode = 'tower';
      game.loadTower(tower);
      game.enemies = [];
      game.waterSurgeDelay = 999;

      const p = game.gateway;

      // A) 10.0s completely idle right at spawn!
      const spawnStartCol = p.col;
      const spawnStartFloor = p.floor;
      inp.resetState();
      for (let step = 0; step < 1200; step++) {
        game.update(FIXED_STEP);
      }
      expect(Math.abs(colDistSigned(spawnStartCol, p.col)), `${label} spawn idle drift`).toBe(0);
      expect(p.floor, `${label} spawn 0 falls`).toBe(spawnStartFloor);

      // B) 10.0s completely idle on a narrow 2-col dry-stone ledge away from any elevator shaft or shelter!
      let freeCol = 4;
      for (let c = 0; c < COLS; c++) {
        const cNext = (c + 1) % COLS;
        const hasShaft = game.elevators.some((el) => el.col === c || el.col === cNext);
        if (!hasShaft) {
          freeCol = c;
          break;
        }
      }
      const testFloor = (tower.floors || 18) + 2;
      game.ledges.push(
        {
          col: freeCol,
          floor: testFloor,
          origType: 'solid',
          type: 'solid',
          active: true,
          gone: false,
          stairDir: 0,
        },
        {
          col: (freeCol + 1) % COLS,
          floor: testFloor,
          origType: 'solid',
          type: 'solid',
          active: true,
          gone: false,
          stairDir: 0,
        }
      );
      p.col = freeCol + 0.5;
      p.floor = testFloor;
      p.vx = 0;
      p.vy = 0;
      p.onGround = true;
      p.onElevator = null;
      inp.resetState();

      const startCol = p.col;
      for (let step = 0; step < 1200; step++) {
        game.update(FIXED_STEP);
      }
      expect(Math.abs(colDistSigned(startCol, p.col)), `${label} must have 0.000 col idle drift`).toBe(0);
      expect(p.floor, `${label} must have 0 falls`).toBe(testFloor);
      expect(p.onGround).toBe(true);
    }

    // Verify wind STILL slides Gateway on slippery ice & in mid-air!
    game.mode = 'tower';
    game.loadTower({
      id: 904,
      name: 'ICE & AIR WIND CHECK',
      floors: 10,
      spawn: { col: 5, floor: 0 },
      mechanics: { windForce: 0.65, windPeriod: 4.0, waterBaseFloor: -0.55 },
      ledges: [
        { col: 4, floor: 0, type: 'ice', stairDir: 0 },
        { col: 5, floor: 0, type: 'ice', stairDir: 0 },
        { col: 6, floor: 0, type: 'ice', stairDir: 0 },
        { col: 7, floor: 0, type: 'ice', stairDir: 0 },
      ],
      doors: [{ id: 'exit', col: 5, floor: 8, isExit: true }],
    });
    game.time = 0.5; // positive rightward gust phase
    for (let step = 0; step < 60; step++) game.update(FIXED_STEP);
    expect(game.gateway.col).toBeGreaterThan(5.6); // Slid right on glacier ice!

    // Mid-air wind drift check
    game.time = 0.5;
    game.gateway.col = 5.5;
    game.gateway.vx = 0;
    inp.press('jump');
    for (let step = 0; step < 30; step++) game.update(FIXED_STEP);
    expect(game.gateway.col).toBeGreaterThan(5.53); // Pushed right in mid-air!
  });
});

describe('Round 5 Deliverable 4: Smart Spawn Facing, Objective dirHint & Loop-Proof Checkpoints', () => {
  it('orients p.facing safely away from spawn cliffs across 30 UTC Daily Tide dates and updates objective-aware dirHint', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());

    // 1. Explicit spawnDir = -1 orienting Gateway LEFT & dirHint = '◀' even when exitDoor is to the RIGHT
    game.mode = 'tower';
    game.loadTower({
      id: 905,
      name: 'CCW PROCEDURAL SPAWN',
      floors: 20,
      spawn: { col: 0, floor: 0 },
      spawnDir: -1,
      ledges: [
        { col: 18, floor: 0, type: 'solid', stairDir: 0 },
        { col: 19, floor: 0, type: 'solid', stairDir: 0 },
        { col: 0, floor: 0, type: 'solid', stairDir: 0 },
        { col: 1, floor: 0, type: 'solid', stairDir: 0 },
        { col: 2, floor: 0, type: 'solid', stairDir: 0 },
        { col: 17, floor: 1, type: 'solid', stairDir: -1 },
      ],
      doors: [{ id: 'exit', col: 4, floor: 18, isExit: true }],
    });
    expect(game.gateway.facing).toBe(-1);
    expect(game.getHudState().dirHint).toBe('◀');

    // 2. Across 30 UTC Daily Tide dates (including 2026-11-19), p.facing points toward real ascent & walking forward from spawn never drops into an immediate sea cliff!
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-11-${String(day).padStart(2, '0')}T00:00:00Z`;
      game.startDailyChallenge(dateStr);
      game.enemies = [];
      const initFacing = game.gateway.facing;
      expect([1, -1]).toContain(initFacing);

      // Verify there is walkable ground + ascent route in initFacing within 1..3 columns of spawn!
      const spawnTile = Math.floor(game.gateway.col);
      const step1Col = (((spawnTile + initFacing) % COLS) + COLS) % COLS;
      const step2Col = (((spawnTile + initFacing * 2) % COLS) + COLS) % COLS;
      const hasRouteAhead =
        game.ledges.some(
          (l) =>
            game._isWalkableLedge(l) &&
            (l.col === step1Col || l.col === step2Col) &&
            l.floor >= 0 &&
            l.floor <= 2
        ) ||
        game.tower.doors.some((d) => d.targetId && (d.col === step1Col || d.col === step2Col) && d.floor === 0);
      expect(hasRouteAhead, `Daily ${dateStr} facing=${initFacing} must face valid route`).toBe(true);

      // Walk forward 0.35s (~1.1 cols) in initFacing from spawn: zero falls, stays grounded on >= Floor 0!
      inp.resetState();
      if (initFacing > 0) inp.state.right = true;
      else inp.state.left = true;
      inp.state.analogX = initFacing;
      for (let step = 0; step < 42; step++) {
        game.update(FIXED_STEP);
      }
      expect(
        game.towerDeathsHere,
        `Daily ${dateStr} facing=${initFacing} must not walk off immediate spawn sea cliff`
      ).toBe(0);
      expect(game.gateway.floor).toBeGreaterThanOrEqual(0);
    }

    // 3. Campaign Spire 1 objective-aware dirHint tracks unbroken seals in sequence
    inp.resetState();
    game.startGame('campaign', { startTowerIdx: 0 });
    const p = game.gateway;
    p.col = 10.5;
    p.floor = 2;
    const unspunValve = game.switches.find((s) => s.mode === 'pipeValve' && !s.active);
    const expectedSeal1Hint = colDistSigned(p.col, unspunValve.col + 0.5) > 0 ? '▶' : '◀';
    expect(game.getHudState().dirHint).toBe(expectedSeal1Hint);
  });

  it('saves safeCol only on interior solid stones (never crumble/submerged) and breaks >=2 consecutive fall loops', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());
    game.mode = 'tower';

    // Floor 0 spawn quay [0,1,2,3], Floor 4 wide terrace [8,9,10,11], plus crumble at col 13
    game.loadTower({
      id: 906,
      name: 'CHECKPOINT GUARD TEST',
      floors: 12,
      spawn: { col: 1, floor: 0 },
      ledges: [
        { col: 0, floor: 0, type: 'solid', stairDir: 0 },
        { col: 1, floor: 0, type: 'solid', stairDir: 0 },
        { col: 2, floor: 0, type: 'solid', stairDir: 0 },
        { col: 3, floor: 0, type: 'solid', stairDir: 0 },
        { col: 8, floor: 4, type: 'solid', stairDir: 0 },
        { col: 9, floor: 4, type: 'solid', stairDir: 0 },
        { col: 10, floor: 4, type: 'solid', stairDir: 0 },
        { col: 11, floor: 4, type: 'solid', stairDir: 0 },
        { col: 13, floor: 4, type: 'crumble', stairDir: 0 },
      ],
      doors: [{ id: 'exit', col: 10, floor: 10, isExit: true }],
    });
    game.lives = 5;

    // Touching cliff-edge col 8 of [8,9,10,11] saves interior col 9.5 (NOT cliff edge 8.5!)
    const edgeLedge = game.ledges.find((l) => l.col === 8 && l.floor === 4);
    game._registerLedgeStand(edgeLedge);
    expect(game.gateway.safeCol).toBeCloseTo(9.5, 3);
    expect(game.gateway.safeFloor).toBe(4);

    // Touching crumble tile NEVER overwrites safeCol!
    const crumbleLedge = game.ledges.find((l) => l.type === 'crumble');
    game._registerLedgeStand(crumbleLedge);
    expect(game.gateway.safeCol).toBeCloseTo(9.5, 3);

    // Corrupt safeCol onto a precarious spot & simulate 2 consecutive surge falls -> snaps to center of [8..11] (10.0) with invuln=2.5!
    game.gateway.safeCol = 15.5;
    game.gateway.safeFloor = 4;
    game.gateway.floor = -1.0;
    game._loseLife('SIPHON SURGE!');
    expect(game.consecutiveRespawnFalls).toBe(1);

    game.gateway.floor = -1.0;
    game._loseLife('SIPHON SURGE!');
    expect(game.consecutiveRespawnFalls).toBe(2);
    expect(game.gateway.col).toBeCloseTo(10.0, 2);
    expect(game.gateway.floor).toBe(4);
    expect(game.gateway.vx).toBe(0);
    expect(game.gateway.vy).toBe(0);
    expect(game.gateway.invuln).toBe(2.5);
  });
});

describe('Round 5 Deliverable 5: All 8 Game Modes End-to-End Loops', () => {
  it('1 & 8. campaign & master_watershed: 3-Seal lock, Core Descent, Purification, 2x NG+ yield, and 1.18x tempo', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    let purifiedData = null;
    const game = new ToweringWatersGame(
      null,
      inp,
      {
        onSpirePurified: (info, proceed) => {
          purifiedData = info;
          proceed();
        },
      },
      prog
    );

    // Campaign Spire 1: locked exit until all 3 seals broken -> Core Descent -> Purification -> Transit -> Spire 2
    game.startGame('campaign', { startTowerIdx: 0 });
    expect(game.crownSealsTotal).toBe(3);
    expect(game._isCrownLocked()).toBe(true);

    // Break all 3 seals via game mechanics
    for (const sw of game.switches.filter((s) => s.mode === 'pipeValve')) game._triggerSwitch(sw);
    expect(game.crownSealsBroken).toBe(1);

    const runeDoor = game.tower.doors.find((d) => d.isRune);
    game._enterPuzzleRoom(runeDoor);
    game.puzzleRoom.solved = true;
    game._leavePuzzleRoom();
    expect(game.crownSealsBroken).toBe(2);

    for (const en of game.enemies) {
      if (en.isLockKeeper || en.type === 'siphon_warden') en.dead = true;
    }
    const sluiceSw = game.switches.find((s) => s.mode === 'sluiceSeal');
    game._triggerSwitch(sluiceSw);
    expect(game.crownSealsBroken).toBe(3);
    expect(game._isCrownLocked()).toBe(false);

    game._enterCrownValve();
    expect(game.mode).toBe('core_descent');
    fastForwardCoreDescentAndTopple(game);
    expect(purifiedData?.towerId).toBe(1);
    expect(['rapids_surf', 'reef_swim', 'frill_glide']).toContain(game.mode);
    game._finishTransitionMiniGame();
    expect(game.mode).toBe('tower');
    expect(game.towerIndex).toBe(1);

    // Master Watershed NG+: 2x score, 2x gears, 1.18x enemy tempo, +1 Warden HP, Spire 10 victory
    const gearsBeforeNg = prog.getGears();
    game.startGame('master_watershed', { startTowerIdx: 9 });
    expect(game.runType).toBe('master_watershed');
    expect(game.zenMode).toBe(false);
    expect(game.enemies.some((e) => !e.harmless && e.ngScale === 1.18)).toBe(true);
    const score0 = game.score;
    game.addScore(100);
    expect(game.score - score0).toBe(200);
    game._awardGears(3);
    expect(prog.getGears() - gearsBeforeNg).toBeGreaterThanOrEqual(6);

    for (const seal of game.sealObjectives) game._breakCrownSeal(seal.id);
    game._enterCrownValve();
    fastForwardCoreDescentAndTopple(game);
    expect(game.mode).toBe('victory');
    expect(prog.masterClears.some((c) => c.fullCampaignClear)).toBe(true);
  });

  it('2. purist: enforces 0 skill boosts, 1-hit KO Floor 0 reset, and fast arcade spire advance', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    prog.skillRanks.tidal_aegis = 3;
    prog.skillRanks.streamlined_scales = 3;
    const game = new ToweringWatersGame(null, inp, {}, prog);

    game.startGame('purist', { startTowerIdx: 0 });
    expect(game.runType).toBe('purist');
    expect(game.getSkillRank('streamlined_scales')).toBe(0);
    expect(game.gateway.shield).toBe(false);

    // Move Gateway up to Floor 5, then trigger hazard hit -> 1-hit KO resets to Floor 0!
    game.gateway.floor = 5;
    game.gateway.safeFloor = 5;
    game.gateway.invuln = 0;
    const livesBefore = game.lives;
    game._applyHazardHit(game.gateway.col + 1);
    expect(game.lives).toBe(livesBefore - 1);
    expect(game.gateway.floor).toBe(game.tower.spawn?.floor ?? 0);

    // Break seals & enter Crown Valve -> skips Core Descent straight to topple -> Spire 2!
    for (const seal of game.sealObjectives) game._breakCrownSeal(seal.id);
    game._enterCrownValve();
    expect(game.mode).toBe('topple');
    fastForwardCoreDescentAndTopple(game);
    expect(game.mode).toBe('tower');
    expect(game.towerIndex).toBe(1);
  });

  it('3. flood_rush: enforces >=3.5s spawn surge grace on Spire 1 & Spire 2, drainValve drop, and endless ascent', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);

    game.startGame('flood_rush', { seed: 424242 });
    expect(game.runType).toBe('flood_rush');
    expect(game.waterSurgeDelay).toBeGreaterThanOrEqual(3.5);

    // Water does NOT rise during the first 3.4s of orientation grace
    const initialWater = game.waterFloor;
    for (let step = 0; step < 400; step++) game.update(FIXED_STEP); // 3.33s
    expect(game.waterFloor).toBe(initialWater);

    // After 3.5s, surge rises; drainValve drops water and grants 2.5s delay
    for (let step = 0; step < 120; step++) game.update(FIXED_STEP);
    expect(game.waterFloor).toBeGreaterThan(initialWater);
    const raisedWater = game.waterFloor;
    const drainSw = { id: 'dv_test', col: 0, floor: 0, mode: 'drainValve', cooldown: 0 };
    game._triggerSwitch(drainSw);
    expect(game.waterFloor).toBeLessThan(raisedWater);
    expect(game.waterSurgeDelay).toBeGreaterThanOrEqual(2.5);

    // Clearing Spire 1 advances directly to Spire 2 with fresh >= 3.5s surge grace!
    game._enterCrownValve();
    fastForwardCoreDescentAndTopple(game);
    expect(game.mode).toBe('tower');
    expect(game.endlessDepth).toBe(1);
    expect(game.waterSurgeDelay).toBeGreaterThanOrEqual(3.5);
  });

  it('4. sanctum_trials: Vault-based Sanctums 6 & 9 display accurate Vault HUD prompts and clear skip gate once cracked', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);

    for (const sanctumIdx of [5, 8]) {
      // Sanctum 6 (idx 5) & Sanctum 9 (idx 8)
      game.startGame('sanctum_trials', { startTowerIdx: sanctumIdx });
      expect(game.zenMode).toBe(true);
      expect(game.getHudState().missionStatus).toBe('SANCTUM TRIAL -> UNLOCK HARMONIC VAULT');

      // Attempting exit before cracking vault triggers optionalIncomplete confirmation banner
      const exitDoor = game.tower.doors.find((d) => d.isExit);
      game.gateway.col = exitDoor.col + 0.5;
      game.gateway.floor = exitDoor.floor;
      game.gateway.onGround = true;
      inp.press('up');
      game.update(FIXED_STEP);
      inp.release('up');
      expect(game.mode).toBe('tower');
      expect(game._casualSkipConfirmTimer).toBeGreaterThan(0);
      game._casualSkipConfirmTimer = 0;

      // Crack the Harmonic Vault -> status updates to 'VAULT UNLOCKED -> CROWN VALVE' and exit opens immediately!
      const vaultDoor = game.tower.doors.find((d) => d.isVault);
      expect(vaultDoor).toBeTruthy();
      game.vaultReturnState = { col: vaultDoor.col + 0.5, floor: vaultDoor.floor, doorId: vaultDoor.id };
      game.startMiniGame('vault', false);
      for (let ringIdx = 0; ringIdx < game.vault.rings.length; ringIdx++) {
        game.vault.rings[ringIdx].angle = game.vault.rings[ringIdx].targetAngle;
        inp.press('fire');
        game.update(FIXED_STEP);
        inp.release('fire');
      }
      expect(game.vault.status).toBe('won');
      for (let i = 0; i < 200; i++) {
        if (game.mode === 'tower') break;
        game.update(FIXED_STEP);
      }
      expect(game.mode).toBe('tower');
      expect(game.gateway.onGround).toBe(true);
      expect(game.getHudState().missionStatus).toBe('VAULT UNLOCKED -> CROWN VALVE');

      // Entering exit door now goes straight into Core Descent without TRIAL INCOMPLETE prompt!
      game.gateway.col = exitDoor.col + 0.5;
      game.gateway.floor = exitDoor.floor;
      game._upDoorLatch = false;
      inp.press('up');
      game.update(FIXED_STEP);
      inp.release('up');
      expect(game.mode).toBe('core_descent');
    }
  });

  it('5. expedition: aliases hydro_jet <-> hydro_double_jump and runs Spire 1 -> mutation_draft -> transit -> Spire 2', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    let draftedChoices = null;
    let pickFn = null;
    const game = new ToweringWatersGame(
      null,
      inp,
      {
        onMutationDraft: (choices, onPick) => {
          draftedChoices = choices;
          pickFn = onPick;
        },
      },
      prog
    );

    game.startGame('expedition', { seed: 77777 });
    expect(game.runType).toBe('expedition');

    // Clear Spire 1 -> enters mutation_draft with 3 choices
    game._enterCrownValve();
    fastForwardCoreDescentAndTopple(game);
    expect(game.mode).toBe('mutation_draft');
    expect(draftedChoices).toHaveLength(3);
    expect(typeof pickFn).toBe('function');

    // Pass legacy alias 'hydro_jet' into draft callback -> canonicalizes & enables mid-air double jump on Spire 2!
    pickFn('hydro_jet');
    expect(game.hasMutation('hydro_jet')).toBe(true);
    expect(game.hasMutation('hydro_double_jump')).toBe(true);
    expect(['rapids_surf', 'reef_swim', 'frill_glide']).toContain(game.mode);

    // Complete transit mini-game -> loads Spire 2 with active double jump!
    game._finishTransitionMiniGame();
    expect(game.mode).toBe('tower');
    expect(game.endlessDepth).toBe(1);
    expect(game.gateway.airJumpsLeft).toBe(1);

    // Verify actual mid-air double jump works in Spire 2
    inp.press('jump');
    game.update(FIXED_STEP);
    inp.release('jump');
    for (let i = 0; i < 12; i++) game.update(FIXED_STEP);
    expect(game.gateway.onGround).toBe(false);
    const vyBeforeDouble = game.gateway.vy;
    inp.press('jump');
    game.update(FIXED_STEP);
    inp.release('jump');
    expect(game.gateway.airJumpsLeft).toBe(0);
    expect(game.gateway.vy).toBeGreaterThan(vyBeforeDouble + 3.0);
  });

  it('6 & 7. daily_tide & warden_gauntlet: Daily Spire victory recording and 5-Act Sovereign Boss Rush clear', () => {
    const inp = createMockInput();
    const prog = createTrackingProgression();
    const onGameOver = vi.fn();
    const game = new ToweringWatersGame(null, inp, { onGameOver }, prog);

    // Daily Tide: 2026-11-19 climb -> Core Descent -> Victory + recordDailyResult
    game.startDailyChallenge('2026-11-19T00:00:00Z');
    expect(game.runType).toBe('daily_tide');
    for (let i = 0; i < 30; i++) game.update(FIXED_STEP);
    game._enterCrownValve();
    expect(game.mode).toBe('core_descent');
    fastForwardCoreDescentAndTopple(game);
    expect(game.mode).toBe('victory');
    expect(prog.dailyResults).toHaveLength(1);
    expect(prog.dailyResults[0].completed).toBe(true);
    expect(prog.dailyResults[0].dateKey).toBe('2026-11-19');

    // Warden Gauntlet: Act 1 -> Act 5 boss defeats -> Victory + recordWardenGauntletRun
    game.startGame('warden_gauntlet');
    expect(game.runType).toBe('warden_gauntlet');
    expect(game.towers).toHaveLength(5);

    for (let actIdx = 0; actIdx < 5; actIdx++) {
      expect(game.towerIndex).toBe(actIdx);
      expect(game.mode).toBe('tower');
      const boss = game.enemies.find((e) => e.type === 'siphon_warden');
      expect(boss).toBeTruthy();
      boss.shielded = false;
      boss.coreExposed = true;
      boss.bossPhase = 'vulnerable';
      boss.hp = 1;
      boss.bossHitCooldown = 0;
      game._applyAttackToEnemy(boss, 'whip');
      expect(boss.dead).toBe(true);
      expect(game.mode).toBe('topple');
      fastForwardCoreDescentAndTopple(game);
    }

    expect(game.mode).toBe('victory');
    expect(prog.gauntletRuns).toHaveLength(1);
    expect(prog.gauntletRuns[0].cleared).toBe(true);
    expect(prog.gauntletRuns[0].bossesDefeated).toBe(5);
  });
});

describe('Round 5 Addendum (#573): Exhaustive Soft-Lock & Edge-Case Guards', () => {
  it('1. Crab-Springboard & Geyser launches vault straight through overhead +3F Valve Lofts without bonking while hard pillars still block', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());
    const campaign = createTowers('campaign');
    const sanctums = createSanctumTowers(15);

    const springCases = [
      { tower: campaign[0], crabFloor: 2, loftFloor: 5, steerDir: 0, label: 'Spire 1 High Valve Loft (overhead box)' },
      { tower: campaign[5], crabFloor: 3, loftFloor: 6, steerDir: 0, label: 'Spire 6 High Valve Loft' },
      { tower: campaign[9], crabFloor: 4, loftFloor: 7, steerDir: 0, label: 'Spire 10 Citadel Balcony' },
      { tower: sanctums[8], crabFloor: 2, loftFloor: 5, steerDir: 1, label: 'Sanctum 9 Flip-Crab Vault' },
    ];

    for (const { tower, crabFloor, loftFloor, steerDir, label } of springCases) {
      game.mode = 'tower';
      game.loadTower(tower);
      const crab = game.enemies.find((e) => e.type === 'snap_crab' && Math.abs(e.floor - crabFloor) < 0.5);
      expect(crab, `${label} crab exists`).toBeTruthy();

      game._applyAttackToEnemy(crab, 'whip');
      expect(crab.flipped).toBe(true);

      const p = game.gateway;
      p.col = steerDir > 0 ? 7.6 : crab.col;
      if (steerDir > 0) crab.col = 7.6;
      p.floor = crab.floor + 0.2;
      p.vx = 0;
      p.vy = -1.0;
      p.onGround = false;
      inp.resetState();
      if (steerDir !== 0) {
        inp.state.analogX = steerDir;
        inp.state.right = steerDir > 0;
      }

      let landedLoft = false;
      for (let step = 0; step < 140; step++) {
        game.update(FIXED_STEP);
        if (p.onGround && Math.abs(p.floor - loftFloor) < 0.05) {
          landedLoft = true;
          break;
        }
      }
      expect(landedLoft, `${label}: crab bounce must land on f=${loftFloor} without ceiling bonk`).toBe(true);
    }

    // Hard overhead pillar MUST still block upward head collision!
    game.mode = 'tower';
    game.loadTower({
      id: 907,
      name: 'PILLAR CEILING CHECK',
      floors: 10,
      spawn: { col: 3, floor: 0 },
      ledges: [
        { col: 3, floor: 0, type: 'solid', stairDir: 0 },
        { col: 3, floor: 2, type: 'pillar', h: 2 },
      ],
      doors: [{ id: 'exit', col: 3, floor: 8, isExit: true }],
    });
    game.gateway.vy = 18.0;
    game.gateway.steamBoostActive = true;
    game.gateway.onGround = false;
    let maxHeadFloor = 0;
    for (let step = 0; step < 60; step++) {
      game.update(FIXED_STEP);
      maxHeadFloor = Math.max(maxHeadFloor, game.gateway.floor + 0.76);
    }
    expect(maxHeadFloor).toBeLessThanOrEqual(2.01);
  });

  it('2. Single-polarity phase bridges NEVER self-shut on step/whip (Spire 5 & Sanctum 7), and dual-polarity switches debounce post-whip step-on for 1.2s', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());
    const campaign = createTowers('campaign');

    // Spire 5: s5_pipe1 at col 6, s5_sw_red at col 7, phaseBlock [9,10] at f=4
    game.mode = 'tower';
    game.loadTower(campaign[4]);
    game.enemies = [];

    const p = game.gateway;
    p.col = 6.5;
    p.floor = 3;
    p.onGround = true;

    // Whipping s5_pipe1 at col 6.5 also hits s5_sw_red at col 7.5 -> opens red bridge!
    inp.press('whip');
    game.update(FIXED_STEP);
    inp.release('whip');
    for (let i = 0; i < 8; i++) game.update(FIXED_STEP); // clear 35ms hit-stop if any
    expect(game.switchStates.red).toBe(true);

    // Walking right across col 7.5 immediately afterward MUST NOT shut the single-polarity red bridge!
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let step = 0; step < 75; step++) {
      game.update(FIXED_STEP);
      if (p.col >= 8.4) break;
    }
    inp.resetState();
    expect(game.switchStates.red).toBe(true);
    expect(game.ledges.filter((l) => l.switchGroup === 'red').every((l) => l.active)).toBe(true);

    // Dual-polarity switch test: whipping toggles ON, walking over within 0.4s is debounced, stepping after 1.3s toggles OFF!
    game.mode = 'tower';
    game.loadTower({
      id: 908,
      name: 'DUAL POLARITY DEBOUNCE',
      floors: 10,
      spawn: { col: 1, floor: 0 },
      ledges: [
        { col: 1, floor: 0, type: 'solid', stairDir: 0 },
        { col: 2, floor: 0, type: 'solid', stairDir: 0 },
        { col: 3, floor: 0, type: 'solid', stairDir: 0 },
        { col: 4, floor: 0, type: 'phaseBlock', switchGroup: 'red', inverted: false, stairDir: 0 },
        { col: 8, floor: 4, type: 'phaseBlock', switchGroup: 'red', inverted: true, stairDir: 0 },
      ],
      switches: [{ id: 'dual_sw', col: 2, floor: 0, group: 'red', mode: 'toggle' }],
      doors: [{ id: 'exit', col: 8, floor: 8, isExit: true }],
    });

    // Whip from col 1.5 -> opens dual_sw at col 2.5 and arms 1.2s step-on debounce!
    inp.press('whip');
    game.update(FIXED_STEP);
    inp.release('whip');
    expect(game.switchStates.red).toBe(true);

    // Walk across col 2.5 within ~0.55s -> stays true!
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let step = 0; step < 68; step++) game.update(FIXED_STEP);
    inp.resetState();
    expect(game.gateway.col).toBeGreaterThan(2.7);
    expect(game.switchStates.red).toBe(true);

    // Wait 1.3s for debounce to expire, then walk back onto col 2.5 -> toggles to false!
    for (let step = 0; step < 160; step++) game.update(FIXED_STEP);
    inp.state.left = true;
    inp.state.analogX = -1.0;
    for (let step = 0; step < 68; step++) game.update(FIXED_STEP);
    inp.resetState();
    expect(game.switchStates.red).toBe(false);
  });

  it('3. sluiceSeal auto-unlocks when standing on it at Lock-Keeper death, UP triggers nearby valves/levers, and tunnels grant >=1.0s exit invuln', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createTrackingProgression());
    const campaign = createTowers('campaign');

    // A) Standing on s1_seal3_sluice when Lock-Keeper dies auto-breaks Seal 3!
    game.mode = 'tower';
    game.loadTower(campaign[0]);
    const sluice = game.switches.find((s) => s.mode === 'sluiceSeal');
    const keeper = game.enemies.find((e) => e.isLockKeeper);
    const p = game.gateway;
    p.col = sluice.col + 0.5;
    p.floor = sluice.floor;
    p.onGround = true;
    p.invuln = 10;

    // Step 1 while keeper is alive -> denied
    game.update(FIXED_STEP);
    expect(sluice.active).toBe(false);

    // Defeat keeper while Gateway remains standing on sluiceSeal -> next tick auto-pulls lever!
    keeper.shielded = false;
    keeper.coreExposed = true;
    keeper.bossPhase = 'vulnerable';
    keeper.hp = 1;
    keeper.bossHitCooldown = 0;
    game._applyAttackToEnemy(keeper, 'pulse');
    expect(keeper.dead).toBe(true);

    game.update(FIXED_STEP);
    expect(sluice.active).toBe(true);
    expect(game.sealObjectives.find((s) => s.id === 'seal_3').broken).toBe(true);

    // B) UP interact triggers nearby pipeValve within 0.85 cols
    const valve1 = game.switches.find((s) => s.mode === 'pipeValve' && !s.active);
    p.col = valve1.col + 0.5 + 0.72; // outside 0.58 step-on, inside 0.85 UP interact!
    p.floor = valve1.floor;
    p.onGround = true;
    game._upDoorLatch = false;
    inp.press('up');
    game.update(FIXED_STEP);
    inp.release('up');
    expect(valve1.active).toBe(true);

    // C) Cross-Tower Tunnel exit grants >= 1.0s invulnerability against patrolling enemies on exit terrace!
    const entryDoor = game.tower.doors.find((d) => d.targetId);
    const exitTarget = game.tower.doors.find((d) => d.id === entryDoor.targetId);
    game.enemies.push(
      game._instantiateEnemy({ type: 'snap_crab', col: exitTarget.col + 0.5, floor: exitTarget.floor, dir: 1 }, 99)
    );
    p.col = entryDoor.col + 0.5;
    p.floor = entryDoor.floor;
    p.onGround = true;
    p.invuln = 0;
    const hurtBefore = game.towerHurtCount;
    game._upDoorLatch = false;
    inp.press('up');
    for (let step = 0; step < 95; step++) {
      game.update(FIXED_STEP);
      inp.release('up');
    }
    expect(p.doorPhase).toBeNull();
    expect(Math.abs(colDistSigned(p.col, exitTarget.col + 0.5))).toBeLessThan(0.2);
    expect(p.invuln).toBeGreaterThanOrEqual(1.0);
    expect(game.towerHurtCount).toBe(hurtBefore);
  });
});
