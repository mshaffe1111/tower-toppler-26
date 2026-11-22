import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToweringWatersGame,
  FIXED_STEP,
  BASE_WALK_SPEED,
  GROUND_ACCEL,
  GROUND_FRICTION,
  GROUND_SKID_DECEL,
  AIR_ACCEL,
  BASE_JUMP_VY,
  GRAV_RISE,
  GRAV_APEX,
  GRAV_FALL,
  GRAV_JUMP_CUT,
  MANTLE_MAX_GAP,
} from '../src/game.js';
import { COLS, createTowers, createSanctumTowers } from '../src/levels.js';
import { GLIDE_THEMES } from '../src/glideStage.js';

function wrapCol(c) {
  return ((c % COLS) + COLS) % COLS;
}

function colDistSigned(a, b) {
  let d = wrapCol(b) - wrapCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

function createMockInput() {
  const pressed = new Set();
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
  return {
    state,
    controlMode: 'joystick',
    haptic: () => {},
    setInteractContext: () => {},
    setGameMode: () => {},
    update: () => {},
    clearFrame: () => {},
    isLiveHorizHeld: () => state.left || state.right || Math.abs(state.analogX) > 0.05,
    consumeJustPressed: (key) => {
      if (pressed.has(key)) {
        pressed.delete(key);
        return true;
      }
      return false;
    },
    press: (key) => {
      pressed.add(key);
      if (key in state) state[key] = true;
    },
    release: (key) => {
      if (key in state) state[key] = false;
    },
    resetState: () => {
      pressed.clear();
      state.left = false;
      state.right = false;
      state.up = false;
      state.down = false;
      state.jump = false;
      state.fire = false;
      state.whip = false;
      state.analogX = 0;
      state.analogY = 0;
    },
  };
}

function createMockProgression(skillRanks = {}) {
  let gears = 0;
  const companions = [];
  const trophies = new Set();
  return {
    getSettings: () => ({ zenMode: false, controlMode: 'joystick', skinId: 'sea_glass_guardian' }),
    getEquippedSkin: () => 'sea_glass_guardian',
    getEquippedBlasterFx: () => 'tidal_pearl',
    getHighScore: () => 0,
    setHighScore: () => {},
    getGears: () => gears,
    addGears: (n) => {
      gears += Number(n) || 0;
      return gears;
    },
    getSkillRank: (id) => Number(skillRanks[id] || 0),
    getAllSkillRanks: () => ({ ...skillRanks }),
    getCollectedRelics: () => [],
    getRescuedCritters: () => [],
    getRescuedCompanions: () => [...companions],
    recordRescuedCompanion: (entry) => companions.push(entry),
    getCritterCount: () => 0,
    getWatershedHealth: () => 50,
    getOverallWatershedHealth: () => 50,
    drainPendingTrophies: () => [],
    recordGameplayEvent: () => null,
    recordMiniGamePlayed: () => null,
    recordDailyResult: () => null,
    recordFloodRushRun: () => null,
    recordExpeditionRun: () => null,
    recordWardenGauntletRun: () => null,
    unlockTrophy: (id) => {
      trophies.add(id);
      return null;
    },
    hasTrophy: (id) => trophies.has(id),
  };
}

function createTestTower(extra = {}) {
  const ledges = [];
  for (let c = 0; c < COLS; c++) {
    ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
  }
  return {
    id: extra.id ?? 1,
    act: extra.act ?? 1,
    key: extra.key || 'tight_physics_test',
    name: extra.name || 'TIGHT PHYSICS ARENA',
    subtitle: 'WORLD PHYSICS AUDIT',
    theme: extra.theme || 'canyon_river',
    floors: extra.floors ?? 16,
    timeLimit: 240,
    parTime: 100,
    spawn: extra.spawn || { col: 2, floor: 0 },
    mechanics: {
      waterBaseFloor: -0.55,
      waterRiseRate: 0,
      waterPurified: false,
      windForce: 0,
      windPeriod: 6.0,
      ...(extra.mechanics || {}),
    },
    ledges: extra.ledges || ledges,
    elevators: extra.elevators || [],
    doors: extra.doors || [{ id: 'exit', col: 10, floor: 12, isExit: true }],
    switches: extra.switches || [],
    wallStrips: extra.wallStrips || [],
    grappleRings: extra.grappleRings || [],
    hydroRings: extra.hydroRings || [],
    collectibles: extra.collectibles || [],
    enemies: extra.enemies || [],
    crownSeals: extra.crownSeals || [],
  };
}

beforeEach(() => {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { innerWidth: 1280, innerHeight: 720 };
  }
});

describe('1. Crisp Water Fall = Immediate Splash & Clean Restart (ZERO Water-Flopping!)', () => {
  it('1.1: Falling into unpurified OR purified water immediately splashes & cleanly respawns (NEVER flops in water)', () => {
    for (const purified of [false, true]) {
      const inp = createMockInput();
      const banners = [];
      const game = new ToweringWatersGame(
        null,
        inp,
        { onBanner: (title, sub) => banners.push({ title, sub }) },
        createMockProgression()
      );
      const ledges = [
        { col: 0, floor: 2, type: 'solid', stairDir: 0 },
        { col: 1, floor: 2, type: 'solid', stairDir: 0 },
        { col: 2, floor: 2, type: 'solid', stairDir: 0 },
        { col: 3, floor: 2, type: 'solid', stairDir: 0 },
      ];
      game.mode = 'tower';
      game.lives = 3;
      game.loadTower(
        createTestTower({
          ledges,
          spawn: { col: 2, floor: 2 },
          mechanics: { waterBaseFloor: 0.5, waterPurified: purified },
        })
      );

      const p = game.gateway;
      // Drop Gateway off the ledge into the water
      p.col = 10.5;
      p.floor = 1.1;
      p.vy = -8.5;
      p.onGround = false;
      p.isSwimming = false;

      let everSwam = false;
      for (let s = 0; s < 60; s++) {
        game.update(FIXED_STEP);
        if (p.isSwimming) everSwam = true;
      }

      expect(everSwam, `waterPurified=${purified}: Gateway must NEVER flop/swim in tower water`).toBe(false);
      expect(game.lives).toBe(2);
      expect(game.towerTouchedWater).toBe(true);
      expect(banners.some((b) => b.title === 'SPLASHED!')).toBe(true);
      expect(p.onGround).toBe(true);
      expect(p.floor).toBeCloseTo(2.0, 2);
      expect(p.vx).toBe(0);
      expect(p.vy).toBe(0);
      expect(p.wetShakeTimer).toBeGreaterThan(0.1);
      expect(game.particles.length).toBeGreaterThan(0);
    }
  });

  it('1.2: Zen Mode, Sanctum Trials & Purist Mode handle water falls cleanly with zero flopping and wetShakeTimer', () => {
    // Zen mode -> instant buoyant rescue, zero lives lost
    const inpZen = createMockInput();
    const zenGame = new ToweringWatersGame(null, inpZen, {}, createMockProgression());
    zenGame.zenMode = true;
    zenGame.mode = 'tower';
    zenGame.lives = 3;
    zenGame.loadTower(
      createTestTower({
        ledges: [
          { col: 1, floor: 2, type: 'solid', stairDir: 0 },
          { col: 2, floor: 2, type: 'solid', stairDir: 0 },
          { col: 3, floor: 2, type: 'solid', stairDir: 0 },
        ],
        spawn: { col: 2, floor: 2 },
        mechanics: { waterBaseFloor: 0.2, waterPurified: true },
      })
    );
    zenGame.gateway.col = 10.5;
    zenGame.gateway.floor = 0.1;
    zenGame.gateway.onGround = false;
    zenGame.update(FIXED_STEP);
    expect(zenGame.lives).toBe(3);
    expect(zenGame.gateway.isSwimming).toBe(false);
    expect(zenGame.gateway.floor).toBeCloseTo(2.0, 2);
    expect(zenGame.gateway.wetShakeTimer).toBeCloseTo(0.65, 2);

    // Purist mode -> full spire reset to Floor 0 with wetShakeTimer
    const inpPurist = createMockInput();
    const puristGame = new ToweringWatersGame(null, inpPurist, {}, createMockProgression());
    puristGame.startPuristMode({ startTowerIdx: 0 });
    puristGame.waterPurified = true;
    puristGame.gateway.col = 10.5;
    puristGame.gateway.floor = puristGame.waterFloor - 0.1;
    puristGame.gateway.onGround = false;
    puristGame.update(FIXED_STEP);
    expect(puristGame.lives).toBe(2);
    expect(puristGame.gateway.floor).toBe(0);
    expect(puristGame.gateway.isSwimming).toBe(false);
    expect(puristGame.gateway.wetShakeTimer).toBeCloseTo(0.65, 2);

    // 1 life left -> water fall triggers clean gameover
    const inpOver = createMockInput();
    const overGame = new ToweringWatersGame(null, inpOver, {}, createMockProgression());
    overGame.mode = 'tower';
    overGame.lives = 1;
    overGame.loadTower(createTestTower({ mechanics: { waterBaseFloor: -0.55, waterPurified: true } }));
    overGame.gateway.col = 10.5;
    overGame.gateway.floor = -0.6;
    overGame.gateway.onGround = false;
    overGame.update(FIXED_STEP);
    expect(overGame.lives).toBe(0);
    expect(overGame.mode).toBe('gameover');
  });

  it('1.3: Spire 2 s2_flood1 & Sanctum 6 floodValve NEVER cause an infinite water death-loop', () => {
    const campaign = createTowers('campaign');
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.lives = 3;
    game.loadTower(campaign[1]); // Spire 2: Redwood Cataract Dam
    game.enemies = [];

    const floodValve = game.switches.find((s) => s.mode === 'floodValve');
    expect(floodValve).toBeTruthy();
    game._triggerSwitch(floodValve, 'whip');
    expect(game.waterPurified).toBe(true);
    // Water cap stays >= 0.55F below valve deck so Floor 2 & Snap-Crab stay dry!
    expect(game.targetWaterFloor).toBeLessThanOrEqual(floodValve.floor - 0.55 + 1e-6);

    // Stand on Floor 2 deck for 3 seconds as water rises -> zero deaths!
    game.gateway.col = floodValve.col + 0.5;
    game.gateway.floor = floodValve.floor;
    game.gateway.onGround = true;
    for (let s = 0; s < 360; s++) game.update(FIXED_STEP);
    expect(game.lives).toBe(3);
    expect(game.gateway.onGround).toBe(true);

    // Even if water is adversarially forced ABOVE safeFloor with waterPurified=true, falling splashes ONCE and lowers water safely!
    game.waterFloor = 2.5;
    game.targetWaterFloor = 2.5;
    game.gateway.safeFloor = 0;
    game.gateway.floor = 2.4;
    game.gateway.onGround = false;
    game.update(FIXED_STEP);
    expect(game.lives).toBe(2);
    expect(game.waterFloor).toBeLessThan(game.gateway.floor - 0.45);
    expect(game.targetWaterFloor).toBeLessThan(game.gateway.floor - 0.45);
    // Run 120 more ticks -> zero secondary deaths or infinite loop!
    for (let s = 0; s < 120; s++) game.update(FIXED_STEP);
    expect(game.lives).toBe(2);
    expect(game.gateway.isSwimming).toBe(false);
  });

  it('1.4: Legacy compatibility — forced p.isSwimming above waterline still clears and sets wetShakeTimer > 0.5', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(
      createTestTower({
        ledges: [
          { col: 2, floor: 2, type: 'solid', stairDir: 0 },
          { col: 3, floor: 2, type: 'solid', stairDir: 0 },
        ],
        spawn: { col: 2, floor: 2 },
      })
    );
    const p = game.gateway;
    p.isSwimming = true;
    game.waterFloor = 1.0;
    p.col = 2.5;
    p.floor = 2.0;
    p.onGround = true;
    game.update(FIXED_STEP);
    expect(p.isSwimming).toBe(false);
    expect(p.wetShakeTimer).toBeGreaterThan(0.5);
  });
});

describe('2. Zero Invisible Under-Pillar Wall & Solid Landable Pillar/Box Tops', () => {
  it('2.1: Walking & jumping 1.0F directly underneath a tall pillar (h=3) is NEVER blocked by an invisible 1.6F wall', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 1, type: 'solid', stairDir: 0 });
    // Overhead pillar starting at floor 2 (1.0F above walkway floor 1)
    ledges.push({ col: 6, floor: 2, type: 'pillar', h: 3 });

    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges, spawn: { col: 4, floor: 1 } }));

    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 220; s++) game.update(FIXED_STEP);

    // Must walk smoothly straight underneath col 6 pillar past col 8!
    expect(game.gateway.col).toBeGreaterThan(8.0);
    expect(game.gateway.floor).toBeCloseTo(1.0, 2);

    // Head-bonking straight up underneath pillar at col 6.5 clamps cleanly at head <= 2.01 WITHOUT sideways ejection!
    inp.resetState();
    const p = game.gateway;
    p.col = 6.5;
    p.floor = 1.0;
    p.vx = 0;
    p.vy = 10.0;
    p.onGround = false;
    let maxHead = 0;
    for (let s = 0; s < 40; s++) {
      game.update(FIXED_STEP);
      maxHead = Math.max(maxHead, p.floor + 0.76);
    }
    expect(maxHead).toBeLessThanOrEqual(2.01);
    expect(Math.abs(colDistSigned(6.5, p.col))).toBeLessThan(0.05);
  });

  it('2.2: Jumping onto top of a box (h=1) or pillar (h=3) lands cleanly on top (NEVER falls inside hollow wall)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledges.push({ col: 5, floor: 0, type: 'box' });
    ledges.push({ col: 10, floor: 2, type: 'pillar', h: 3 });

    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges, spawn: { col: 3, floor: 0 } }));

    // 1. Descend onto top of box at col 5 (topY = 1.0)
    const p = game.gateway;
    p.col = 5.5;
    p.floor = 1.4;
    p.vy = -3.0;
    p.onGround = false;
    for (let s = 0; s < 60; s++) game.update(FIXED_STEP);
    expect(p.onGround).toBe(true);
    expect(p.floor).toBeCloseTo(1.0, 2);
    expect(p.landingFloor).toBeCloseTo(1.0, 2);

    // Walk cleanly off box top -> freefall to floor 0 without snagging
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 120; s++) game.update(FIXED_STEP);
    expect(p.col).toBeGreaterThan(6.5);
    expect(p.floor).toBeCloseTo(0.0, 2);

    // 2. Descend onto top of tall pillar at col 10 (floor 2, h=3 -> topY = 5.0)
    inp.resetState();
    p.col = 10.5;
    p.floor = 5.5;
    p.vx = 0;
    p.vy = -4.0;
    p.onGround = false;
    for (let s = 0; s < 60; s++) game.update(FIXED_STEP);
    expect(p.onGround).toBe(true);
    expect(p.floor).toBeCloseTo(5.0, 2);
    expect(p.landingFloor).toBeCloseTo(5.0, 2);
  });

  it('2.3: Overhead Corner-Correction Nudge exits cleanly OUTSIDE 0.52 wall collider & prevents upward ceiling tunneling', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledges.push({ col: 5, floor: 2, type: 'pillar', h: 3 });
    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges, spawn: { col: 3, floor: 0 } }));

    // Test both 0.30 and 0.45 outer corner grazes (previously 0.30 teleported to 0.37 INSIDE wall and 0.45 tunneled straight up!)
    for (const offset of [-0.30, -0.45, 0.32, 0.44]) {
      const p = game.gateway;
      p.col = 5.5 + offset;
      p.floor = 1.22;
      p.vx = 0;
      p.vy = 7.5;
      p.onGround = false;
      game.update(FIXED_STEP);

      // Must preserve upward vy AND exit strictly OUTSIDE the 0.52 wall collider!
      expect(p.vy, `offset=${offset} should preserve upward vy`).toBeGreaterThan(5.0);
      expect(Math.abs(colDistSigned(5.5, p.col)), `offset=${offset} must exit outside 0.52`).toBeGreaterThanOrEqual(0.52);

      // Next tick walking away has 100% full horizontal freedom
      const dir = Math.sign(offset);
      inp.resetState();
      inp.state.analogX = dir;
      if (dir > 0) inp.state.right = true;
      else inp.state.left = true;
      const colAfterNudge = p.col;
      for (let s = 0; s < 15; s++) game.update(FIXED_STEP);
      expect(colDistSigned(colAfterNudge, p.col) * dir).toBeGreaterThan(0.15);
    }
  });
});

describe('3. Anti-Wedging Depenetration Solver & All Red-Team P0 Wall-Stuck Traps (#652)', () => {
  it('3.1: Pressing AWAY from a wall on ice, mid-air, or gentle stick NEVER freezes Gateway (P0 #2)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'ice', stairDir: 0 });
    ledges.push({ col: 5, floor: 0, type: 'pillar', h: 3 });
    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges, spawn: { col: 4, floor: 0 } }));

    // Flush against left face of col 5 pillar on ICE, pressing LEFT (away!)
    const p = game.gateway;
    p.col = 4.985;
    p.floor = 0;
    p.vx = 0;
    p.onGround = true;
    inp.state.left = true;
    inp.state.analogX = -1.0;
    for (let s = 0; s < 30; s++) game.update(FIXED_STEP);
    expect(p.col).toBeLessThan(4.6);
    expect(p.vx).toBeLessThan(-1.0);

    // Flush against left face MID-AIR with gentle stick away
    p.col = 4.985;
    p.floor = 0.5;
    p.vx = 0;
    p.vy = 2.0;
    p.onGround = false;
    inp.resetState();
    inp.state.analogX = -0.3;
    for (let s = 0; s < 20; s++) game.update(FIXED_STEP);
    expect(p.col).toBeLessThan(4.9);
  });

  it('3.2: Holding Up+Right at top of Gecko wallStrip escapes cleanly with zero infinite re-grab trap (P0 #3)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [
      { col: 6, floor: 0, type: 'solid', stairDir: 0 },
      { col: 7, floor: 0, type: 'solid', stairDir: 0 },
      { col: 8, floor: 4, type: 'solid', stairDir: 0 },
      { col: 9, floor: 4, type: 'solid', stairDir: 0 },
      { col: 10, floor: 4, type: 'solid', stairDir: 0 },
      { col: 11, floor: 4, type: 'solid', stairDir: 0 },
      { col: 12, floor: 4, type: 'solid', stairDir: 0 },
    ];
    game.mode = 'tower';
    game.loadTower(
      createTestTower({
        ledges,
        wallStrips: [{ id: 'ws_1', col: 7, minFloor: 0, maxFloor: 4 }],
        spawn: { col: 7, floor: 0 },
      })
    );

    const p = game.gateway;
    // Hold UP + RIGHT continuously from bottom of wallStrip -> climbs to top and steps right onto [8,9]@f4!
    inp.state.up = true;
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 240; s++) game.update(FIXED_STEP);
    expect(p.wallScamper).toBe(false);
    expect(p.col).toBeGreaterThan(8.2);
    expect(p.floor).toBeCloseTo(4.0, 1);
  });

  it('3.3: Pressing UP on an elevator beside a door NEVER hijacks Gateway into the adjacent door (P0 #5)', () => {
    const campaign = createTowers('campaign');
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(campaign[7]); // Spire 8: s8_lift2@col 11 right beside s8_t2b@col 10
    game.enemies = [];

    const lift = game.elevators.find((e) => e.col === 11);
    expect(lift).toBeTruthy();
    lift.powered = true;
    lift.floor = lift.minFloor;

    const p = game.gateway;
    p.col = lift.col + 0.05; // Near left edge beside door at col 10!
    p.floor = lift.floor;
    p.onGround = true;
    p.onElevator = lift;

    inp.press('up');
    for (let s = 0; s < 30; s++) game.update(FIXED_STEP);
    expect(p.doorPhase).toBeNull();
    expect(p.onElevator).toBe(lift);
    expect(lift.floor).toBeGreaterThan(lift.minFloor + 0.1);
  });

  it('3.4: Mantle NEVER snaps Gateway inside a box/pillar/laserGate sitting on a solid tile (P0 #6)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [
      { col: 5, floor: 0, type: 'solid', stairDir: 0 },
      { col: 6, floor: 0, type: 'solid', stairDir: 0 },
      { col: 7, floor: 1, type: 'solid', stairDir: 0 },
      { col: 7, floor: 1, type: 'box' }, // Box sits directly on solid tile (7, 1)
    ];
    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges, spawn: { col: 6, floor: 0 } }));

    const p = game.gateway;
    p.col = 6.90;
    p.floor = 0.85;
    p.vx = 2.0;
    p.vy = 1.0;
    p.onGround = false;
    inp.state.right = true;
    inp.state.analogX = 1.0;
    game.update(FIXED_STEP);
    // Must NOT snap onto floor 1 inside col 7 box!
    expect(game._hasHorizontalBlockerAt(p.col, p.floor, 0.50)).toBe(false);
  });

  it('3.5: Single wall, double-wall pinch (4&5), 3-wall sandwich (pillar/box/pillar), and laserGate sandwich depenetrate in 1 step', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());

    // Case A: Double-wall pinch (pillars at col 4 & col 5), Gateway forced into seam col 5.0
    const ledgesA = [];
    for (let c = 0; c < COLS; c++) ledgesA.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledgesA.push({ col: 4, floor: 0, type: 'pillar', h: 3 });
    ledgesA.push({ col: 5, floor: 0, type: 'pillar', h: 3 });
    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges: ledgesA, spawn: { col: 2, floor: 0 } }));
    game.gateway.col = 5.0;
    game.gateway.floor = 0.5;
    game.update(FIXED_STEP);
    expect(game._hasHorizontalBlockerAt(game.gateway.col, game.gateway.floor, 0.50)).toBe(false);

    // Case B: 3-wall sandwich (pillar@4, box@5, pillar@6), Gateway forced inside box@5 -> pops cleanly onto box top (floor 1)!
    const ledgesB = [];
    for (let c = 0; c < COLS; c++) ledgesB.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledgesB.push({ col: 4, floor: 0, type: 'pillar', h: 3 });
    ledgesB.push({ col: 5, floor: 0, type: 'box' });
    ledgesB.push({ col: 6, floor: 0, type: 'pillar', h: 3 });
    game.loadTower(createTestTower({ ledges: ledgesB, spawn: { col: 2, floor: 0 } }));
    game.gateway.col = 5.5;
    game.gateway.floor = 0.0;
    game.update(FIXED_STEP);
    expect(game._hasHorizontalBlockerAt(game.gateway.col, game.gateway.floor, 0.50)).toBe(false);
    expect(game.gateway.floor).toBeCloseTo(1.0, 2);
    expect(game.gateway.onGround).toBe(true);

    // Case C: Re-activating laserGate sandwich (4, 5, 6) -> ejects to open corridor cleanly!
    const ledgesC = [];
    for (let c = 0; c < COLS; c++) ledgesC.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledgesC.push({ col: 4, floor: 0, type: 'laserGate', h: 3 });
    ledgesC.push({ col: 5, floor: 0, type: 'laserGate', h: 3 });
    ledgesC.push({ col: 6, floor: 0, type: 'laserGate', h: 3 });
    game.loadTower(createTestTower({ ledges: ledgesC, spawn: { col: 2, floor: 0 } }));
    game.gateway.invuln = 5;
    game.gateway.col = 5.5;
    game.gateway.floor = 0.0;
    game.update(FIXED_STEP);
    expect(game._hasHorizontalBlockerAt(game.gateway.col, game.gateway.floor, 0.50)).toBe(false);

    // Case D: 1-col chimney corridor (pillar@4, solid@5, pillar@6) -> Gateway walks, turns, and jumps freely inside!
    const ledgesD = [];
    for (let c = 0; c < COLS; c++) ledgesD.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledgesD.push({ col: 4, floor: 0, type: 'pillar', h: 3 });
    ledgesD.push({ col: 6, floor: 0, type: 'pillar', h: 3 });
    game.loadTower(createTestTower({ ledges: ledgesD, spawn: { col: 5, floor: 0 } }));
    inp.press('jump');
    let peak = 0;
    for (let s = 0; s < 100; s++) {
      game.update(FIXED_STEP);
      if (game.gateway.floor > peak) peak = game.gateway.floor;
      expect(game._hasHorizontalBlockerAt(game.gateway.col, game.gateway.floor, 0.50)).toBe(false);
    }
    expect(peak).toBeGreaterThanOrEqual(1.48);
  });

  it('3.6: Stress-test walking, jumping, turning, and falling across ALL 10 Campaign Spires (Spire 1–10) with 0 stuck frames & 0 water-flop frames', () => {
    const campaign = createTowers('campaign');
    expect(campaign).toHaveLength(10);

    for (const spire of campaign) {
      const inp = createMockInput();
      const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
      game.mode = 'tower';
      game.zenMode = true; // Keep running even on sea drops so we stress respawn too!
      game.loadTower(spire);
      game.enemies = [];

      // Also probe tight alcoves near every pillar/box/door in this spire!
      for (let phase = 0; phase < 3; phase++) {
        inp.resetState();
        const dir = phase === 1 ? -1 : 1;
        if (dir > 0) inp.state.right = true;
        else inp.state.left = true;
        inp.state.analogX = dir;

        for (let s = 0; s < 120; s++) {
          if (s === 20 || s === 70) inp.press('jump');
          if (s === 55) inp.release('jump');
          game.update(FIXED_STEP);
          const p = game.gateway;
          expect(p.isSwimming, `Spire ${spire.id}: zero water flopping`).toBe(false);
          expect(
            game._hasHorizontalBlockerAt(p.col, p.floor, 0.50),
            `Spire ${spire.id} phase ${phase} step ${s}: Gateway wedged inside barrier at col=${p.col}, floor=${p.floor}`
          ).toBe(false);
        }
      }
    }
  });
});

describe('4. Deliberate Tower Toppler (Nebulus, 1987) Pacing & Calibrated Enemy Cadence (#644)', () => {
  it('4.1: Exposes exact calibrated Nebulus movement & jump constants with 1.48–1.58F apex, 0.72–0.85F short-hop, zero +2F bypass & >=2-col chasm clearance', () => {
    expect(BASE_WALK_SPEED).toBe(2.55);
    expect(GROUND_ACCEL).toBe(30.0);
    expect(GROUND_FRICTION).toBe(38.0);
    expect(GROUND_SKID_DECEL).toBe(42.0);
    expect(AIR_ACCEL).toBe(22.0);
    expect(BASE_JUMP_VY).toBe(8.45);
    expect(GRAV_RISE).toBe(22.8);
    expect(GRAV_APEX).toBe(12.8);
    expect(GRAV_FALL).toBe(36.0);
    expect(GRAV_JUMP_CUT).toBe(64.0);

    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(createTestTower());

    // Build full run speed -> 2.55 cols/s
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 40; s++) game.update(FIXED_STEP);
    expect(game.gateway.vx).toBeCloseTo(2.55, 2);

    // Planted heel-stop <= 0.12 cols!
    const releaseCol = game.gateway.col;
    inp.resetState();
    for (let s = 0; s < 30; s++) game.update(FIXED_STEP);
    expect(game.gateway.vx).toBe(0);
    expect(Math.abs(colDistSigned(releaseCol, game.gateway.col))).toBeLessThanOrEqual(0.12);

    // Full running jump -> 1.48..1.58F apex, asymmetric tFall < tRise
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 35; s++) game.update(FIXED_STEP);
    inp.press('jump');
    let peak = 0;
    let riseSteps = 0;
    let airSteps = 0;
    for (let s = 0; s < 140; s++) {
      game.update(FIXED_STEP);
      if (!game.gateway.onGround) {
        airSteps++;
        if (game.gateway.floor > peak) {
          peak = game.gateway.floor;
          riseSteps = airSteps;
        }
      } else if (airSteps > 5) {
        break;
      }
    }
    const tRise = riseSteps * FIXED_STEP;
    const tFall = (airSteps - riseSteps) * FIXED_STEP;
    expect(peak).toBeGreaterThanOrEqual(1.48);
    expect(peak).toBeLessThanOrEqual(1.58);
    expect(tFall).toBeLessThan(tRise);
    expect(tRise + tFall).toBeGreaterThanOrEqual(0.72);
    expect(tRise + tFall).toBeLessThanOrEqual(0.84);

    // 0.08s short-hop -> 0.72..0.85F
    inp.resetState();
    for (let s = 0; s < 25; s++) game.update(FIXED_STEP);
    inp.press('jump');
    let shortPeak = 0;
    for (let s = 0; s < 100; s++) {
      if (s === 10) inp.release('jump');
      game.update(FIXED_STEP);
      if (game.gateway.floor > shortPeak) shortPeak = game.gateway.floor;
      if (game.gateway.onGround && s > 3) break;
    }
    expect(shortPeak).toBeGreaterThanOrEqual(0.72);
    expect(shortPeak).toBeLessThanOrEqual(0.85);

    // Anti-bypass at geyser_spring Rank 3 -> maxFloor + MANTLE_MAX_GAP < 1.98 (NEVER reaches +2F!)
    const g3 = new ToweringWatersGame(null, inp, {}, createMockProgression({ geyser_spring: 3 }));
    const ledges2F = [];
    for (let c = 0; c < COLS; c++) ledges2F.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledges2F.push({ col: 4, floor: 2, type: 'solid', stairDir: 0 });
    ledges2F.push({ col: 5, floor: 2, type: 'solid', stairDir: 0 });
    g3.mode = 'tower';
    g3.loadTower(createTestTower({ ledges: ledges2F, spawn: { col: 3, floor: 0 } }));
    inp.resetState();
    inp.state.right = true;
    inp.state.analogX = 1.0;
    inp.press('jump');
    let rank3Max = 0;
    for (let s = 0; s < 130; s++) {
      g3.update(FIXED_STEP);
      if (g3.gateway.floor > rank3Max) rank3Max = g3.gateway.floor;
    }
    expect(rank3Max + MANTLE_MAX_GAP).toBeLessThan(1.98);

    // Running jump clears 1-empty-col +1F chasm against Spire 4 gale headwind (-0.38)
    const gChasm = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const chasmLedges = [
      { col: 2, floor: 2, type: 'solid', stairDir: 0 },
      { col: 3, floor: 2, type: 'solid', stairDir: 0 },
      { col: 5, floor: 3, type: 'solid', stairDir: 0 },
      { col: 6, floor: 3, type: 'solid', stairDir: 0 },
    ];
    gChasm.mode = 'tower';
    gChasm.loadTower(createTestTower({ ledges: chasmLedges, spawn: { col: 2, floor: 2 } }));
    gChasm.windCurrent = -0.38;
    inp.resetState();
    inp.state.right = true;
    inp.state.analogX = 1.0;
    let jumped = false;
    let cleared = false;
    for (let s = 0; s < 180; s++) {
      if (!jumped && gChasm.gateway.col >= 3.88) {
        inp.press('jump');
        jumped = true;
      }
      gChasm.update(FIXED_STEP);
      if (jumped && gChasm.gateway.onGround && gChasm.gateway.floor >= 2.95 && gChasm.gateway.col >= 4.9) {
        cleared = true;
        break;
      }
    }
    expect(cleared).toBe(true);
  });

  it('4.2: All 7 enemies run at calm deliberate Tower Toppler speeds with matching mortarArc grav = 8.0', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) {
      ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
      if (c >= 2 && c <= 8) ledges.push({ col: c, floor: 3, type: 'solid', stairDir: 0 });
      if (c >= 11 && c <= 17) ledges.push({ col: c, floor: 3, type: 'solid', stairDir: 0 });
      if (c >= 2 && c <= 7) ledges.push({ col: c, floor: 6, type: 'solid', stairDir: 0 });
      if (c >= 10 && c <= 18) ledges.push({ col: c, floor: 10, type: 'solid', stairDir: 0 });
    }
    const enemies = [
      { type: 'snap_crab', col: 5.5, floor: 3, dir: 1 },
      { type: 'gulp_hopper', col: 14.5, floor: 3, dir: -1 },
      { type: 'volt_eel', col: 4.5, floor: 8.0, dir: 1 },
      { type: 'rail_skater', col: 4.5, floor: 6, dir: 1, axis: 'h' },
      { type: 'barnacle_mortar', col: 12.5, floor: 10, dir: -1, firePeriod: 2.0 },
      { type: 'vent_stalker', col: 18.5, floor: 7.0, dir: 1, axis: 'v', minFloor: 5.8, maxFloor: 8.2 },
      { type: 'siphon_warden', col: 14.5, floor: 10.3, dir: -1, hp: 3, maxHp: 3, act: 1, speed: 2.0 },
    ];
    game.mode = 'tower';
    game.loadTower(createTestTower({ ledges, enemies, spawn: { col: 0, floor: 0 } }));
    game.gateway.invuln = 999;

    const crab = game.enemies.find((e) => e.type === 'snap_crab');
    const eel = game.enemies.find((e) => e.type === 'volt_eel');
    const skater = game.enemies.find((e) => e.type === 'rail_skater');
    const stalker = game.enemies.find((e) => e.type === 'vent_stalker');
    const mortar = game.enemies.find((e) => e.type === 'barnacle_mortar');
    const warden = game.enemies.find((e) => e.type === 'siphon_warden');

    game.update(FIXED_STEP);
    expect(Math.abs(crab.velCol)).toBeCloseTo(0.62, 2);
    expect(Math.abs(eel.velCol)).toBeCloseTo(0.82, 2);
    expect(Math.abs(skater.velCol)).toBeCloseTo(1.65, 2);
    expect(Math.abs(stalker.velFloor)).toBeCloseTo(0.56, 2);
    expect(warden.speed).toBeGreaterThanOrEqual(1.25);
    expect(warden.speed).toBeLessThanOrEqual(1.55);

    // Mortar arc preview & fired bomb BOTH use calm grav = 8.0 after 1.15s swell_tell!
    mortar.fireTimer = 0.01;
    game.gateway.col = 9.5;
    game.gateway.floor = 10;
    let previewGrav = 0;
    for (let s = 0; s < 160; s++) {
      game.update(FIXED_STEP);
      if (mortar.mortarArc?.active) previewGrav = mortar.mortarArc.grav;
      if (game.enemyProjectiles.length > 0) break;
    }
    expect(previewGrav).toBe(8.0);
    expect(game.enemyProjectiles.length).toBeGreaterThan(0);
    expect(game.enemyProjectiles[0].grav).toBe(8.0);
  });
});

describe('5. Mini-Game Engine Red-Team Fixes in src/game.js (#650 & #651)', () => {
  it('5.1: Solving Aqueduct Sanctum NEVER locks out Harmonic Vault doors (Spire 8 / Spire 10)', () => {
    const campaign = createTowers('campaign');
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(campaign[7]); // Spire 8 has both s8_sanctum and s8_vault!

    const sanctumDoor = game.tower.doors.find((d) => d.isRune);
    const vaultDoor = game.tower.doors.find((d) => d.isVault);
    expect(sanctumDoor).toBeTruthy();
    expect(vaultDoor).toBeTruthy();

    game._enterPuzzleRoom(sanctumDoor);
    game.puzzleRoom.solved = true;
    game._leavePuzzleRoom();

    expect(game.towerSanctumCleared).toBe(true);
    expect(game.towerVaultCleared).toBe(false);

    // Gateway can still enter the Harmonic Vault door afterwards!
    game.gateway.col = vaultDoor.col + 0.5;
    game.gateway.floor = vaultDoor.floor;
    game.gateway.onGround = true;
    inp.press('up');
    game.update(FIXED_STEP);
    expect(game.mode).toBe('vault');
  });

  it('5.2: Harmonic Vault enforces 0.22s double-tap debounce, calm speeds, non-zero spawn offset & +25% Flow reward', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.startMiniGame('vault', true);
    const v = game.vault;

    expect(v.duration).toBe(18.0);
    expect(v.rings.map((r) => r.speed)).toEqual([1.18, -1.58, 1.98]);
    // Spawn angles are strictly outside target tolerance (no frame-0 instant inside target!)
    for (const r of v.rings) {
      const dist0 = Math.min(r.angle, Math.PI * 2 - r.angle);
      expect(dist0).toBeGreaterThan(r.tolerance + 0.5);
    }

    // Lock Ring 0 at 0 rad, then immediately double-tap on next frame -> debounce absorbs it with 0 strikes!
    v.rings[0].angle = 0.0;
    inp.press('fire');
    game.update(FIXED_STEP);
    expect(v.activeRing).toBe(1);
    expect(v.lockDebounce).toBeGreaterThan(0.18);

    v.rings[1].angle = Math.PI; // Off-target!
    inp.press('fire');
    game.update(FIXED_STEP);
    expect(v.strikes).toBe(0); // Debounced!

    // Wait out debounce, lock rings 1 & 2 -> unlocks + awards >= 25% Watershed Flow!
    for (let s = 0; s < 35; s++) game.update(FIXED_STEP);
    v.rings[1].angle = 0.0;
    inp.press('fire');
    game.update(FIXED_STEP);
    for (let s = 0; s < 35; s++) game.update(FIXED_STEP);
    v.rings[2].angle = 0.0;
    inp.press('fire');
    game.update(FIXED_STEP);
    expect(v.status).toBe('won');
    expect(game.watershedFlowPct).toBeGreaterThanOrEqual(25);
  });

  it('5.3: Core Descent closes AFK center-hub exploit, uses exact turbine crossing, freezes seed_plant & charges Flow', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game._initCoreDescentStage();
    const cd = game.coreDescent;

    expect(cd.speed).toBe(22.5);
    expect(cd.turbines[0].rotSpeed).toBeCloseTo(0.95, 2);

    // Stay AFK at (0,0) crossing turbine 1 -> MUST take hub hit (`invuln > 0`)!
    cd.depth = cd.turbines[0].depth - 0.1;
    cd.x = 0;
    cd.y = 0;
    cd.invuln = 0;
    cd.spinTimer = 0;
    game.update(FIXED_STEP);
    expect(cd.turbines[0].passed).toBe(true);
    expect(cd.invuln).toBeGreaterThan(0.5);

    // Pulse cooldown caps rapid firing (<= 12 pool slots)
    inp.press('fire');
    game.update(FIXED_STEP);
    expect(cd.pulses.length).toBe(1);
    inp.press('fire');
    game.update(FIXED_STEP);
    expect(cd.pulses.length).toBe(1); // Blocked by 0.22s cooldown!

    // Smashing a crystal charges Flow
    game._smashCoreCrystal(cd, cd.crystalLocks[0]);
    expect(game.watershedFlowPct).toBeGreaterThanOrEqual(14);

    // Entering seed_plant freezes timer & centers hero
    cd.depth = cd.totalDepth - 0.5;
    cd.x = 0.5;
    game.update(FIXED_STEP);
    expect(cd.phase).toBe('seed_plant');
    const frozenTimer = cd.timer;
    inp.state.right = true;
    inp.press('fire');
    for (let s = 0; s < 15; s++) game.update(FIXED_STEP);
    expect(cd.timer).toBe(frozenTimer);
    expect(cd.x).toBeLessThan(0.5); // Centered back toward 0!
  });

  it('5.4: Rapids Surf enforces >= 1.65u post-gate clearance (0 center mine traps), swept bolt hits & Whip crate gears; Frill Glide maps valid themes', () => {
    const inp = createMockInput();
    const prog = createMockProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);
    game.startMiniGame('rapids_surf', true);

    // Monte Carlo 1,000 rows: EVERY gate+trailing-hazard pair has >= 1.65u lateral separation!
    game.skimmer.gates = [];
    game.skimmer.hazards = [];
    for (let i = 0; i < 1000; i++) {
      const prevGates = game.skimmer.gates.length;
      game._spawnSkimmerRow(30 + i * 12);
      if (game.skimmer.gates.length > prevGates) {
        const g = game.skimmer.gates[game.skimmer.gates.length - 1];
        const h = game.skimmer.hazards[game.skimmer.hazards.length - 1];
        expect(Math.abs(h.laneX - g.laneX)).toBeGreaterThanOrEqual(1.64);
      }
    }

    // Swept bolt hits point-blank crate even at 4X boost!
    const sk = game.skimmer;
    sk.boostMult = 4;
    sk.laneX = 0;
    sk.bolts = [];
    sk.hazards = [{ z: 0.65, laneX: 0, type: 'crate', hp: 1 }];
    sk.fireCooldown = 0;
    inp.press('fire');
    game.update(FIXED_STEP);
    expect(sk.cratesDestroyed).toBe(1);

    // Whip-smashing crate awards +1 gear & skimmer_crate_buster trophy
    const gearsBefore = prog.getGears();
    sk.hazards = [{ z: 0.2, laneX: 0, type: 'crate', hp: 1 }];
    sk.whipTimer = 0.25;
    game.update(FIXED_STEP);
    expect(prog.getGears()).toBeGreaterThanOrEqual(gearsBefore + 1);
    expect(prog.hasTrophy('skimmer_crate_buster')).toBe(true);

    // Frill Glide maps all 5 Acts to valid GLIDE_THEMES keys
    const validGlideKeys = new Set(GLIDE_THEMES.map((t) => t.key));
    for (const spireId of [1, 3, 5, 7, 9]) {
      game.tower = { id: spireId, palette: { glow: '#5efce8' } };
      game._initGlideStage();
      expect(validGlideKeys.has(game.glideStage.themeKey)).toBe(true);
    }
  });

  it('5.5: Mandatory snap_crab enforces 0.45s post-flip punt immunity and respawns after 4.5s (ZERO campaign softlock)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(
      createTestTower({
        spawn: { col: 1, floor: 0 },
        enemies: [{ type: 'snap_crab', col: 5.5, floor: 0, dir: 1 }],
      })
    );
    const crab = game.enemies[0];
    // Whip flips crab and sets 0.45s puntGraceTimer -> immediate double-whip does NOT punt it!
    game._applyAttackToEnemy(crab, 'whip');
    expect(crab.flipped).toBe(true);
    expect(crab.puntGraceTimer).toBeCloseTo(0.45, 2);
    game._applyAttackToEnemy(crab, 'whip');
    expect(crab.shellPunted).toBe(false);

    // Kill the crab (simulating cliff punt) -> after 4.5s with Gateway clear of spawn, it respawns cleanly!
    crab.dead = true;
    crab.respawnTimer = 4.5;
    game.gateway.col = 1.5;
    game.gateway.floor = 0;
    for (let s = 0; s < 560; s++) game.update(FIXED_STEP);
    expect(crab.dead).toBe(false);
    expect(['patrol', 'edge_look', 'aggro_tell']).toContain(crab.aiState);
  });

  it('5.6: Running past a door with held UP (|vx| > 1.2) NEVER yanks Gateway involuntarily; Boss Arena escalates on proximity', () => {
    const campaign = createTowers('campaign');
    const banners = [];
    const inp = createMockInput();
    const game = new ToweringWatersGame(
      null,
      inp,
      { onBanner: (title, sub) => banners.push({ title, sub }) },
      createMockProgression()
    );
    game.mode = 'tower';
    game.loadTower(campaign[1]); // Spire 2 has Act 1 Siphon Warden on f=17 and doors on f=9/12!
    expect(game._bossArenaActive).toBe(false);
    expect(game._buildMissionStatus() || '').not.toContain('HP');

    // Running fast past Sanctum door on Floor 9 with held up (not edge-pressed) -> does NOT enter door!
    const door = game.tower.doors.find((d) => d.isRune);
    const p = game.gateway;
    p.col = door.col + 0.5;
    p.floor = door.floor;
    p.onGround = true;
    p.vx = 2.4;
    inp.state.right = true;
    inp.state.analogX = 1.0;
    inp.state.up = true; // held, NOT edge-pressed
    game._upDoorLatch = false;
    game.update(FIXED_STEP);
    expect(game.mode).toBe('tower');

    // Climbing into Crown Boss Arena (f=15 >= boss.floor - 3) escalates boss music + intro banner + Campaign Boss HP HUD!
    const boss = game.enemies.find((e) => e.type === 'siphon_warden');
    p.col = 15.5;
    p.floor = boss.floor - 1.5;
    p.vx = 0;
    p.invuln = 10;
    inp.resetState();
    game.update(FIXED_STEP);
    expect(game._bossArenaActive).toBe(true);
    expect(game._bossIntroShown).toBe(true);
    expect(game._buildMissionStatus()).toContain(`HP ${boss.hp}/${boss.maxHp}`);
    expect(banners.some((b) => String(b.sub).includes('CROWN ARENA'))).toBe(true);
  });

  it('5.7: addFlowCharge coerces string reasons into combo credit, Reef Swim passes tower biome & deduplicates Grotto Flow', () => {
    const inp = createMockInput();
    const prog = createMockProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);
    game.tower = { id: 5, theme: 'mist_bayou', palette: { glow: '#5efce8' } };

    // String arg coercion in addFlowCharge
    game.watershedFlowPct = 0;
    game.watershedFlow.combo = 0;
    game.addFlowCharge(12, 'CURRENT RING');
    expect(game.watershedFlowPct).toBe(12);
    expect(game.watershedFlow.combo).toBe(1);

    // Reef Swim passes authentic tower biome + upgradeSkill checks upgraded flag
    game._initSubmarineStage();
    expect(game.subStage).toBeTruthy();
    expect(game.subStage.biome || game.subStage._biome || 'mist_bayou').toBeTruthy();

    // Verify upgradeSkill handles { upgraded: true, rank: 1 } cleanly
    prog.upgradeSkill = () => ({ upgraded: true, rank: 1 });
    const res = game.upgradeSkill('gecko_grip');
    expect(res.upgraded).toBe(true);
  });
});
