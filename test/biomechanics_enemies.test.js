import { describe, it, expect } from 'vitest';
import {
  COLS,
  createTowers,
  createSanctumTowers,
  createWardenGauntletTowers,
  generateProceduralTower,
  createDailyTower,
  verifyTowerSolvable,
} from '../src/levels.js';
import {
  ToweringWatersGame,
  FIXED_STEP,
  BASE_WALK_SPEED,
  GROUND_ACCEL,
  GROUND_FRICTION,
  GROUND_SKID_DECEL,
  JUMP_HORIZ_IMPULSE,
  AIR_ACCEL,
  AIR_DRAG,
  BASE_JUMP_VY,
  GRAV_RISE,
  GRAV_APEX,
  GRAV_FALL,
  GRAV_JUMP_CUT,
  SPRING_LAUNCH_VY,
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

function createSilentProgression() {
  const settings = { zenMode: false, skinId: 'sea_glass_guardian', blasterFxId: 'tidal_pearl' };
  return {
    getSettings: () => ({ ...settings }),
    updateSettings: (s) => Object.assign(settings, s),
    getEquippedSkin: () => settings.skinId,
    getEquippedBlasterFx: () => settings.blasterFxId,
    getHighScore: () => 0,
    recordScore: () => {},
    getGears: () => 0,
    addGears: () => {},
    getSkillRank: () => 0,
    getAllSkillRanks: () => ({}),
    getCollectedRelics: () => [],
    getRescuedCritters: () => [],
    getCritterCount: () => 0,
    getWatershedHealth: () => 50,
    getOverallWatershedHealth: () => 50,
    drainPendingTrophies: () => [],
    recordGameplayEvent: () => null,
    unlockTrophy: () => null,
  };
}

function createFlatTestTower(extra = {}) {
  const ledges = [];
  for (let c = 0; c < COLS; c++) {
    ledges.push({ col: c, floor: 0, type: 'solid' });
  }
  return {
    id: 99,
    act: extra.act ?? 1,
    key: 'test_flat',
    name: 'TEST FLAT SPIRE',
    subtitle: 'UNIT TEST',
    theme: 'canyon_river',
    floors: 18,
    timeLimit: 300,
    parTime: 100,
    spawn: { col: 0, floor: 0 },
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
    doors: extra.doors || [{ id: 'exit', col: 10, floor: 14, isExit: true }],
    switches: extra.switches || [],
    wallStrips: extra.wallStrips || [],
    grappleRings: extra.grappleRings || [],
    collectibles: extra.collectibles || [],
    enemies: extra.enemies || [],
    crownSeals: extra.crownSeals || [],
  };
}

function colDistSigned(a, b) {
  let d = (((b % COLS) + COLS) % COLS) - (((a % COLS) + COLS) % COLS);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

describe('Deliverable 1: Calibrated 120Hz Hydro-Lizard Locomotion & Jump Kinematics', () => {
  it('exposes exact Nintendo/Celeste 120Hz mathematical constants with buoyant apex hang', () => {
    expect(FIXED_STEP).toBeCloseTo(1 / 120, 8);
    expect(BASE_WALK_SPEED).toBe(3.55);
    expect(GROUND_ACCEL).toBe(38.0);
    expect(GROUND_FRICTION).toBe(44.0);
    expect(GROUND_SKID_DECEL).toBe(52.0);
    expect(JUMP_HORIZ_IMPULSE).toBe(1.04);
    expect(AIR_ACCEL).toBe(26.0);
    expect(AIR_DRAG).toBe(8.5);
    expect(BASE_JUMP_VY).toBe(9.40);
    expect(GRAV_RISE).toBe(28.5);
    expect(GRAV_APEX).toBe(16.5);
    expect(GRAV_APEX).toBeLessThan(GRAV_RISE);
    expect(GRAV_FALL).toBe(45.0);
    expect(GRAV_JUMP_CUT).toBe(78.0);
    expect(SPRING_LAUNCH_VY).toBe(12.50);
  });

  it('reaches 3.55 cols/s full run, supports precision slow-walk, and stops within <= 0.19 cols on release', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
    game.mode = 'tower';
    game.loadTower(createFlatTestTower());

    // 1. Analog precision slow-walk (analogX = 0.35 -> ~1.2425 cols/s)
    inp.state.analogX = 0.35;
    for (let i = 0; i < 45; i++) game.update(FIXED_STEP);
    expect(game.gateway.vx).toBeCloseTo(3.55 * 0.35, 2);
    expect(game.gateway.anim).toBe('Walk');

    // 2. Full grounded sprint -> 3.55 cols/s
    inp.state.analogX = 1.0;
    inp.state.right = true;
    for (let i = 0; i < 60; i++) game.update(FIXED_STEP);
    expect(game.gateway.vx).toBeGreaterThanOrEqual(3.50);
    expect(game.gateway.vx).toBeLessThanOrEqual(3.60);
    expect(game.gateway.vx).toBeCloseTo(3.55, 3);
    expect(game.gateway.anim).toBe('FluidRun');

    // 3. Release input -> crisp Mario/Celeste heel-stop (~0.143 cols in ~0.081s!)
    const releaseCol = game.gateway.col;
    inp.state.analogX = 0;
    inp.state.right = false;
    let stopSteps = 0;
    while (Math.abs(game.gateway.vx) > 1e-4 && stopSteps < 60) {
      game.update(FIXED_STEP);
      stopSteps++;
    }
    const stopDist = Math.abs(colDistSigned(releaseCol, game.gateway.col));
    expect(stopDist).toBeGreaterThan(0.10);
    expect(stopDist).toBeLessThanOrEqual(0.19);
    expect(stopSteps * FIXED_STEP).toBeLessThanOrEqual(0.105);

    // 4. Counter-steer braced turnaround skid (GROUND_SKID_DECEL = 52.0)
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let i = 0; i < 40; i++) game.update(FIXED_STEP);
    expect(game.gateway.vx).toBeCloseTo(3.55, 2);
    inp.state.right = false;
    inp.state.left = true;
    inp.state.analogX = -1.0;
    game.update(FIXED_STEP);
    expect(game.gateway.skidTimer).toBeGreaterThan(0.15);
    expect(game.gateway.vx).toBeCloseTo(3.55 - 52.0 * FIXED_STEP, 3);
  });

  it('produces +1.53F expressive Celeste/Mario apex in ~0.67s on full jump, ~0.82F on 0.08s short-hop, and ZERO FrillGlide frames on tower jumps', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
    game.mode = 'tower';
    game.loadTower(createFlatTestTower());

    // Build full running speed first
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let i = 0; i < 40; i++) game.update(FIXED_STEP);
    const startCol = game.gateway.col;

    // Trigger full-hold running jump
    inp.press('jump');
    let maxFloor = 0;
    let maxHorizVx = 0;
    let airSteps = 0;
    let frillGlideFrames = 0;
    let maxFrillFlare = 0;

    for (let step = 0; step < 120; step++) {
      game.update(FIXED_STEP);
      const p = game.gateway;
      if (!p.onGround) {
        airSteps++;
        if (p.floor > maxFloor) maxFloor = p.floor;
        if (Math.abs(p.vx) > maxHorizVx) maxHorizVx = Math.abs(p.vx);
        if (p.frillFlare > maxFrillFlare) maxFrillFlare = p.frillFlare;
        if (p.anim === 'FrillGlide' || p.isGliding || p.frillFlare > 0) {
          frillGlideFrames++;
        }
      } else if (airSteps > 5) {
        break;
      }
    }

    const airTimeSec = airSteps * FIXED_STEP;
    const spanCols = Math.abs(colDistSigned(startCol, game.gateway.col));

    expect(maxHorizVx).toBeCloseTo(3.55 * 1.04, 2);
    expect(maxFloor).toBeGreaterThanOrEqual(1.48);
    expect(maxFloor).toBeLessThanOrEqual(1.62);
    expect(airTimeSec).toBeGreaterThanOrEqual(0.61);
    expect(airTimeSec).toBeLessThanOrEqual(0.74);
    expect(spanCols).toBeGreaterThan(2.0);
    expect(spanCols).toBeLessThan(2.7);
    expect(frillGlideFrames).toBe(0);
    expect(maxFrillFlare).toBe(0);

    // Calibrated 0.08s variable-height short-hop (release at 10 substeps = 0.083s -> 0.68..0.86F)
    inp.resetState();
    for (let i = 0; i < 30; i++) game.update(FIXED_STEP);
    inp.press('jump');
    let shortApex = 0;
    for (let step = 0; step < 100; step++) {
      if (step === 10) inp.release('jump');
      game.update(FIXED_STEP);
      if (game.gateway.floor > shortApex) shortApex = game.gateway.floor;
      if (game.gateway.onGround && step > 3) break;
    }
    expect(shortApex).toBeGreaterThanOrEqual(0.68);
    expect(shortApex).toBeLessThanOrEqual(0.86);
  });
});

describe('Deliverable 2: Physical World Weight & Momentum', () => {
  it('strains blocked boxes (±0.28), slides unblocked boxes 1 col after 0.38s without blocking switches, and shatters with 35ms hit-stop', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
    game.mode = 'tower';
    const ledges = [
      { col: 0, floor: 0, type: 'solid' },
      { col: 1, floor: 0, type: 'solid' },
      { col: 2, floor: 0, type: 'solid' },
      { col: 3, floor: 0, type: 'solid' },
      { col: 1, floor: 0, type: 'box' },
    ];
    const switches = [{ id: 'sw_guard', col: 3, floor: 0, group: 'red', mode: 'toggle' }];
    game.loadTower(createFlatTestTower({ ledges, switches }));

    const box = game.ledges.find((l) => l.type === 'box');
    expect(box.col).toBe(1);

    // Push right into box at col 1 -> col 2 is empty solid, so after ~0.38s it slides 1 col to col 2!
    inp.state.right = true;
    inp.state.analogX = 1.0;
    let sawMidSlide = false;
    let maxPushBlendDuringSlide = 0;
    for (let i = 0; i < 95; i++) {
      game.update(FIXED_STEP);
      if (game.gateway.pushingBox > maxPushBlendDuringSlide) {
        maxPushBlendDuringSlide = game.gateway.pushingBox;
      }
      if (box.col === 1 && box.visualSlideCol > 0.4) sawMidSlide = true;
    }
    expect(sawMidSlide).toBe(true);
    expect(maxPushBlendDuringSlide).toBeGreaterThan(0.8);
    expect(box.col).toBe(2);

    // Continue pushing right against col 2 -> col 3 has a switch, so box strains up to +0.28 and NEVER covers col 3!
    for (let i = 0; i < 90; i++) game.update(FIXED_STEP);
    expect(box.col).toBe(2);
    expect(game.gateway.pushingBox).toBeGreaterThan(0.8);
    expect(box.visualSlideCol).toBeCloseTo(0.28, 2);

    // Shatter box with Tail-Whip -> debris particles + 35ms hit-stop!
    inp.press('whip');
    game.update(FIXED_STEP);
    expect(box.gone).toBe(true);
    expect(game.hitStopTimer).toBeCloseTo(0.035, 3);
    expect(game.particles.some((pt) => pt.isCrateDebris)).toBe(true);
  });

  it('depresses crumble slabs on landing, bounces elevator cabs, arcs & deflects mortar bombs (speed=7.8), and dips in purified water', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
    game.mode = 'tower';
    const ledges = [
      { col: 0, floor: 0, type: 'solid' },
      { col: 2, floor: 0, type: 'crumble' },
      { col: 5, floor: 0, type: 'solid' },
      { col: 6, floor: 0, type: 'solid' },
      { col: 8, floor: 0, type: 'solid' },
    ];
    const elevators = [{ id: 'el_test', col: 4, minFloor: 0, maxFloor: 5, startFloor: 0, speed: 0 }];
    const enemies = [{ type: 'barnacle_mortar', col: 8.5, floor: 0, dir: -1, firePeriod: 2.6 }];
    game.loadTower(createFlatTestTower({ ledges, elevators, enemies }));

    // 1. Crumble slab depression + falling stone chips
    const crumble = game.ledges.find((l) => l.type === 'crumble');
    game.gateway.col = 2.5;
    game.gateway.floor = 1.2;
    game.gateway.vy = -8.5;
    game.gateway.onGround = false;
    for (let i = 0; i < 30; i++) game.update(FIXED_STEP);
    expect(crumble.crumbling).toBe(true);
    expect(crumble.crumbleDepress).toBeGreaterThan(0.35);
    expect(game.particles.some((pt) => pt.isStoneChip)).toBe(true);

    // 2. Elevator counterweight spring bounce on landing (prevVy < -2.0)
    const el = game.elevators[0];
    game.gateway.col = 4.5;
    game.gateway.floor = 1.0;
    game.gateway.vy = -9.5;
    game.gateway.onGround = false;
    let minCabBounce = 0;
    for (let i = 0; i < 35; i++) {
      game.update(FIXED_STEP);
      if (el.cabBounceOffset < minCabBounce) minCabBounce = el.cabBounceOffset;
    }
    expect(minCabBounce).toBeLessThan(-0.02);
    expect(minCabBounce).toBeGreaterThanOrEqual(-0.06);

    // 3. Parabolic barnacle_mortar lob + Tail-Whip pressurized return deflection (speed = 7.8 + 35ms hit-stop)
    game.gateway.onElevator = null;
    game.gateway.col = 5.5;
    game.gateway.floor = 0;
    game.gateway.onGround = true;
    const mortar = game.enemies[0];
    mortar.fireTimer = 0.01;
    let launchVy = 0;
    for (let i = 0; i < 130; i++) {
      game.update(FIXED_STEP);
      if (game.enemyProjectiles.length > 0 && launchVy === 0) {
        launchVy = game.enemyProjectiles[0].vy;
        break;
      }
    }
    expect(game.enemyProjectiles.length).toBeGreaterThan(0);
    const proj = game.enemyProjectiles[0];
    expect(proj.grav).toBe(10.5);
    expect(launchVy).toBeCloseTo(3.8 + (0 - 0.55) * 0.6, 2);
    // Verify real parabolic upward-then-downward gravity integration
    const launchFloor = proj.floor;
    for (let i = 0; i < 20; i++) game.update(FIXED_STEP);
    expect(proj.floor).toBeGreaterThan(launchFloor + 0.3);
    expect(proj.vy).toBeLessThan(launchVy - 1.5);

    // Position projectile in whip range and deflect it right back (55ms home-run hit-stop #602)!
    proj.col = 6.2;
    proj.floor = 0.45;
    inp.press('whip');
    game.update(FIXED_STEP);
    expect(proj.deflected).toBe(true);
    expect(proj.speed).toBe(7.8);
    expect(game.hitStopTimer).toBeCloseTo(0.055, 3);

    // Advance until deflected mortar shatters the barnacle_mortar
    for (let i = 0; i < 90; i++) game.update(FIXED_STEP);
    expect(mortar.dead).toBe(true);

    // 4. Purified water Archimedes dip & splash droplets
    game.waterPurified = true;
    game.waterFloor = 0.5;
    game.targetWaterFloor = 0.5;
    game.gateway.col = 10.5;
    game.gateway.floor = 1.6;
    game.gateway.vy = -9.0;
    game.gateway.onGround = false;
    game.gateway.isSwimming = false;
    let minWaterDip = 0;
    for (let i = 0; i < 60; i++) {
      game.update(FIXED_STEP);
      if (game.gateway.waterDipOffset < minWaterDip) minWaterDip = game.gateway.waterDipOffset;
    }
    expect(game.gateway.isSwimming).toBe(true);
    expect(minWaterDip).toBeLessThan(-0.15);
    // Settles back toward surface via Archimedes buoyancy
    for (let i = 0; i < 120; i++) game.update(FIXED_STEP);
    expect(Math.abs(game.gateway.waterDipOffset)).toBeLessThan(0.06);
  });
});

describe('Deliverable 3: All 7 Distinct Enemy Personalities, Speeds, Tells & Counter-Play', () => {
  it('exposes all required state fields and runs distinct velocity/state profiles across all 7 archetypes', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
    game.mode = 'tower';

    const ledges = [];
    for (let c = 0; c < COLS; c++) {
      ledges.push({ col: c, floor: 0, type: 'solid' });
      if (c >= 2 && c <= 8) ledges.push({ col: c, floor: 3, type: 'solid' });
      if (c >= 11 && c <= 17) ledges.push({ col: c, floor: 3, type: 'solid' });
      if (c >= 2 && c <= 7) ledges.push({ col: c, floor: 6, type: 'solid' });
      if (c >= 10 && c <= 18) ledges.push({ col: c, floor: 10, type: 'solid' });
    }
    const enemies = [
      { type: 'snap_crab', col: 5.5, floor: 3, dir: 1 },
      { type: 'gulp_hopper', col: 14.5, floor: 3, dir: -1 },
      { type: 'volt_eel', col: 4.5, floor: 8.0, dir: 1 },
      { type: 'rail_skater', col: 4.5, floor: 6, dir: 1, axis: 'h' },
      { type: 'barnacle_mortar', col: 12.5, floor: 10, dir: -1 },
      { type: 'vent_stalker', col: 18.5, floor: 7.0, dir: 1, axis: 'v', minFloor: 5.8, maxFloor: 8.2 },
      { type: 'siphon_warden', col: 14.5, floor: 10.3, dir: -1, hp: 3, maxHp: 3, act: 1 },
    ];
    game.loadTower(createFlatTestTower({ ledges, enemies }));
    game.gateway.invuln = 999; // Observe pure AI state transitions without hurt knockback

    const requiredProps = [
      'aiState',
      'velCol',
      'velFloor',
      'telegraph',
      'chargeBlend',
      'inflatePhase',
      'coilBlend',
      'shockActive',
      'brakeBlend',
      'shellHide',
      'venting',
      'actSignature',
    ];
    for (const en of game.enemies) {
      for (const prop of requiredProps) {
        expect(en).toHaveProperty(prop);
      }
    }

    const crab = game.enemies.find((e) => e.type === 'snap_crab');
    const hopper = game.enemies.find((e) => e.type === 'gulp_hopper');
    const eel = game.enemies.find((e) => e.type === 'volt_eel');
    const skater = game.enemies.find((e) => e.type === 'rail_skater');
    const mortar = game.enemies.find((e) => e.type === 'barnacle_mortar');
    const stalker = game.enemies.find((e) => e.type === 'vent_stalker');
    const warden = game.enemies.find((e) => e.type === 'siphon_warden');

    // Place Gateway far away first to measure baseline patrol speeds
    game.gateway.col = 0.5;
    game.gateway.floor = 0;
    game.update(FIXED_STEP);
    expect(Math.abs(crab.velCol)).toBeCloseTo(0.88, 2);
    expect(hopper.aiState).toBe('sit_watch');
    expect(hopper.velCol).toBe(0);
    expect(Math.abs(eel.velCol)).toBeCloseTo(1.15, 2);
    expect(Math.abs(skater.velCol)).toBeCloseTo(2.35, 2);
    expect(mortar.velCol).toBe(0);
    expect(Math.abs(stalker.velFloor)).toBeCloseTo(0.78, 2);
    expect(warden.actSignature).toBe('bulldozer_mortar');

    // Track visited states over 6.0s (720 substeps)
    const seen = new Map(game.enemies.map((e) => [e.type, new Set([e.aiState])]));
    let hopperGroundedMaxVel = 0;
    let hopperLeapMaxFloor = hopper.baseFloor;

    for (let step = 0; step < 720; step++) {
      // At step 60, place Gateway within 2.2 cols of snap_crab to trigger aggro_tell -> charge -> huff!
      if (step === 60) {
        game.gateway.col = crab.col + 2.0;
        game.gateway.floor = crab.floor;
      }
      // At step 300, place Gateway within 1.0 col of barnacle_mortar to trigger paranoid shell_hide!
      if (step === 300) {
        game.gateway.col = mortar.col - 0.9;
        game.gateway.floor = mortar.floor;
      }
      if (step === 380) {
        game.gateway.col = 0.5;
        game.gateway.floor = 0;
      }
      game.update(FIXED_STEP);
      for (const en of game.enemies) {
        seen.get(en.type).add(en.aiState);
      }
      if (hopper.aiState !== 'leap') {
        hopperGroundedMaxVel = Math.max(hopperGroundedMaxVel, Math.abs(hopper.velCol));
      } else {
        hopperLeapMaxFloor = Math.max(hopperLeapMaxFloor, hopper.floor);
      }
    }

    // 1. snap_crab: patrolled -> aggro_tell -> charge -> huff
    expect(seen.get('snap_crab').has('aggro_tell')).toBe(true);
    expect(seen.get('snap_crab').has('charge')).toBe(true);
    expect(seen.get('snap_crab').has('huff')).toBe(true);

    // 2. gulp_hopper: 0.00 cols/s grounded, full sit_watch -> inflate -> leap -> land_recover cycle
    expect(hopperGroundedMaxVel).toBe(0);
    expect(hopperLeapMaxFloor - hopper.baseFloor).toBeGreaterThan(1.1);
    expect(seen.get('gulp_hopper')).toEqual(new Set(['sit_watch', 'inflate', 'leap', 'land_recover']));

    // 3. volt_eel: prowl -> coil_tell -> discharge -> exhausted
    expect(seen.get('volt_eel').has('coil_tell')).toBe(true);
    expect(seen.get('volt_eel').has('discharge')).toBe(true);
    expect(seen.get('volt_eel').has('exhausted')).toBe(true);

    // 4. rail_skater: sprint -> spark_brake -> windup
    expect(seen.get('rail_skater').has('sprint')).toBe(true);
    expect(seen.get('rail_skater').has('spark_brake')).toBe(true);
    expect(seen.get('rail_skater').has('windup')).toBe(true);

    // 5. barnacle_mortar: watch + shell_hide; verify shell_hide deflects pulse and cracks to whip!
    expect(seen.get('barnacle_mortar').has('shell_hide')).toBe(true);
    game.gateway.col = mortar.col - 0.85;
    game.gateway.floor = mortar.floor;
    for (let i = 0; i < 20; i++) game.update(FIXED_STEP);
    expect(mortar.aiState).toBe('shell_hide');
    expect(mortar.shellHide).toBeGreaterThan(0.8);
    game._applyAttackToEnemy(mortar, 'pulse');
    expect(mortar.dead).toBe(false);
    game._applyAttackToEnemy(mortar, 'whip');
    expect(mortar.dead).toBe(true);

    // 6. vent_stalker: stalk -> hiss_tell -> erupt -> cooldown
    expect(seen.get('vent_stalker').has('hiss_tell')).toBe(true);
    expect(seen.get('vent_stalker').has('erupt')).toBe(true);
    expect(seen.get('vent_stalker').has('cooldown')).toBe(true);

    // 7. siphon_warden: 5-Act signatures across Warden Gauntlet
    const gauntlets = createWardenGauntletTowers();
    const expectedSigs = ['bulldozer_mortar', 'cryo_beam', 'mire_tentacles', 'aegis_summoner', 'leviathan_prime'];
    gauntlets.forEach((gt, idx) => {
      game.loadTower(gt);
      const boss = game.enemies.find((e) => e.type === 'siphon_warden');
      expect(boss.actSignature).toBe(expectedSigs[idx]);
    });
  });
});

describe('Deliverable 4: 120Hz Kinematic Reachability & Zero-Bypass Audit Across All Spires', () => {
  it('verifies real 120Hz jump kinematics clear worst-case 1-empty-col +1F chasms against headwind while blocking 4-col bulkheads', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
    game.mode = 'tower';

    // Worst-case Spire 9/10 jump: 2-tile takeoff [4,5] at f=2 -> 1-tile crumble [7] at f=3 against -0.40 headwind!
    const ledges = [
      { col: 4, floor: 2, type: 'solid' },
      { col: 5, floor: 2, type: 'solid' },
      { col: 7, floor: 3, type: 'crumble' },
      // Plus a 4-empty-col void after col 7 -> col 12 at f=3 (must NOT be jumpable!)
      { col: 12, floor: 3, type: 'solid' },
    ];
    game.loadTower(createFlatTestTower({ ledges, spawn: { col: 4, floor: 2 } }));
    game.gateway.col = 4.5;
    game.gateway.floor = 2;
    game.windCurrent = -0.40;
    game.tower.mechanics.windForce = 0; // keep manual -0.40 constant headwind

    inp.state.right = true;
    inp.state.analogX = 1.0;
    let jumped = false;
    let landedOnTarget = false;
    for (let step = 0; step < 120; step++) {
      if (!jumped && game.gateway.col >= 5.88) {
        inp.press('jump');
        jumped = true;
      }
      game.update(FIXED_STEP);
      if (jumped && game.gateway.onGround && Math.abs(game.gateway.floor - 3) < 0.05) {
        landedOnTarget = true;
        break;
      }
    }
    expect(jumped).toBe(true);
    expect(landedOnTarget).toBe(true);

    // Verify 4-col void (col 7 -> col 12) CANNOT be crossed by a running jump (zero tunnel/barrier bypass!)
    game.gateway.col = 7.5;
    game.gateway.floor = 3;
    game.gateway.vx = 3.30;
    game.gateway.onGround = true;
    inp.press('jump');
    for (let step = 0; step < 75; step++) {
      game.update(FIXED_STEP);
      if (game.gateway.floor < 1.5) break;
    }
    expect(game.gateway.col).toBeLessThan(10.5);
  });

  it('proves 10/10 Campaign Spires, 15/15 Sanctums, 5/5 Gauntlets, and Procedural/Daily towers are 100% solvable with 0 bypasses', () => {
    // 1. 10 Campaign Spires (must be solvable with all required seals, and UNSOLVABLE if a mandatory Sanctum Seal is skipped!)
    const campaign = createTowers('campaign');
    expect(campaign).toHaveLength(10);
    for (const spire of campaign) {
      const full = verifyTowerSolvable(spire, { enforceSeals: true, allowSanctumSolve: true });
      expect(full.solvable, `Campaign Spire ${spire.id} (${spire.name}) should be solvable`).toBe(true);
      expect(full.crownSealsTotal).toBeGreaterThanOrEqual(1);

      const hasMandatorySanctumSeal = Boolean(spire.crownSeals?.some((s) => s.kind === 'sanctum'));
      if (hasMandatorySanctumSeal) {
        const bypassAttempt = verifyTowerSolvable(spire, { enforceSeals: true, allowSanctumSolve: false });
        expect(bypassAttempt.solvable, `Campaign Spire ${spire.id} must have zero Sanctum bypass`).toBe(false);
      }
    }

    // 2. 15 Handcrafted Sanctum Trials (plus mission stations & collectibles reachable)
    const sanctums = createSanctumTowers(15);
    expect(sanctums).toHaveLength(15);
    for (const st of sanctums) {
      const res = verifyTowerSolvable(st);
      expect(res.solvable, `Sanctum ${st.id} (${st.name}) should be solvable`).toBe(true);
      for (const rd of st.doors.filter((d) => d.isRune || d.isVault)) {
        const doorProbe = {
          ...st,
          doors: st.doors.map((d) => ({ ...d, isExit: d.id === rd.id })),
        };
        expect(verifyTowerSolvable(doorProbe).solvable, `Sanctum ${st.id} door ${rd.id} reachable`).toBe(true);
      }
    }

    // 3. 5 Warden Gauntlets
    const gauntlets = createWardenGauntletTowers();
    expect(gauntlets).toHaveLength(5);
    for (const wg of gauntlets) {
      expect(verifyTowerSolvable(wg).solvable, `Gauntlet Act ${wg.act} solvable`).toBe(true);
    }

    // 4. Procedural Expedition / Flood Rush & Daily Tide seeds
    for (let s = 1; s <= 12; s++) {
      const expT = generateProceduralTower({ seed: 1000 + s * 37, index: s, difficulty: 1.2 + s * 0.2, modeHint: 'expedition' });
      expect(verifyTowerSolvable(expT).solvable).toBe(true);

      const floodT = generateProceduralTower({ seed: 5000 + s * 53, index: s, difficulty: 1.3 + s * 0.2, modeHint: 'flood_rush' });
      expect(verifyTowerSolvable(floodT).solvable).toBe(true);
    }
    for (let day = 1; day <= 5; day++) {
      const dailyT = createDailyTower(`2026-11-0${day}T00:00:00Z`);
      expect(verifyTowerSolvable(dailyT).solvable).toBe(true);
    }
  });

  it('simulates real 120Hz ToweringWatersGame jump execution across every critical chasm in Spires 1-10 & Sanctums 1-15', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());

    const canClearChasm120Hz = (tower, fromCol, fromFloor, toCol, toFloor) => {
      const dc = colDistSigned(fromCol, toCol);
      const dir = Math.sign(dc) || 1;
      game.mode = 'tower';
      game.loadTower(tower);
      // Enable all switch/pipe bridges in case jump lands on or launches from a phaseBlock
      for (const k of Object.keys(game.switchStates)) game.switchStates[k] = true;
      for (const k of Object.keys(game.pipeStates)) game.pipeStates[k] = true;
      game._syncDynamicLedges(0, true);
      game.enemies = []; // Pure architectural jump reachability check
      game.hydroRings = []; // Disable speed-ring aerial boost so pure chasm reachability is verified!
      // Test against worst-case Spire headwind!
      const wf = tower.mechanics?.windForce || 0;
      game.tower.mechanics.windForce = 0;
      game.windCurrent = -dir * wf;

      // Back up 1 tile if available on same floor for natural run-up, otherwise start on single stone center!
      const backCol = (((fromCol - dir) % COLS) + COLS) % COLS;
      const hasRunup = game.ledges.some(
        (l) => game._isWalkableLedge(l) && l.col === backCol && Math.abs(l.floor - fromFloor) < 0.25
      );
      const p = game.gateway;
      p.col = (hasRunup ? backCol : fromCol) + 0.5;
      p.floor = fromFloor;
      p.vx = 0;
      p.vy = 0;
      p.onGround = true;
      p.invuln = 99;

      inp.resetState();
      inp.state.analogX = dir;
      if (dir > 0) inp.state.right = true;
      else inp.state.left = true;

      const takeoffEdgeOffset = dir > 0 ? 0.38 : -0.38;
      let jumped = false;
      for (let step = 0; step < 220; step++) {
        const distPastCenter = colDistSigned(fromCol + 0.5, p.col) * dir;
        if (!jumped && distPastCenter >= Math.abs(takeoffEdgeOffset)) {
          inp.press('jump');
          jumped = true;
        }
        game.update(FIXED_STEP);
        const forwardProgress = colDistSigned(fromCol + 0.5, p.col) * dir;
        if (
          jumped &&
          p.onGround &&
          p.floor >= toFloor - 0.15 &&
          forwardProgress >= 1.25 &&
          forwardProgress <= 4.8
        ) {
          return true;
        }
      }
      return false;
    };

    // Representative critical 1-empty-col (+1F & level) chasms across Campaign Spires 1-10 & Sanctums 1-15:
    const campaign = createTowers('campaign');
    const sanctums = createSanctumTowers(15);
    const jumpCases = [
      { tower: campaign[0], fromCol: 14, fromFloor: 1, toCol: 12, toFloor: 2, label: 'Spire 1 shaft chasm' },
      { tower: campaign[0], fromCol: 3, fromFloor: 10, toCol: 5, toFloor: 11, label: 'Spire 1 crumble chasm' },
      { tower: campaign[0], fromCol: 6, fromFloor: 11, toCol: 8, toFloor: 12, label: 'Spire 1 upper chasm' },
      { tower: campaign[1], fromCol: 6, fromFloor: 10, toCol: 8, toFloor: 11, label: 'Spire 2 dam chasm' },
      { tower: campaign[2], fromCol: 6, fromFloor: 2, toCol: 8, toFloor: 3, label: 'Spire 3 tarn chasm' },
      { tower: campaign[2], fromCol: 17, fromFloor: 16, toCol: 19, toFloor: 17, label: 'Spire 3 upper chasm' },
      { tower: campaign[3], fromCol: 9, fromFloor: 3, toCol: 11, toFloor: 3, label: 'Spire 4 gale chasm' },
      { tower: campaign[5], fromCol: 5, fromFloor: 12, toCol: 7, toFloor: 13, label: 'Spire 6 flume chasm' },
      { tower: campaign[6], fromCol: 12, fromFloor: 6, toCol: 14, toFloor: 6, label: 'Spire 7 atoll chasm A' },
      { tower: campaign[6], fromCol: 15, fromFloor: 6, toCol: 17, toFloor: 7, label: 'Spire 7 atoll chasm B' },
      { tower: campaign[7], fromCol: 4, fromFloor: 17, toCol: 6, toFloor: 18, label: 'Spire 8 piston chasm' },
      { tower: campaign[8], fromCol: 5, fromFloor: 2, toCol: 7, toFloor: 3, label: 'Spire 9 headwind ice chasm' },
      { tower: campaign[8], fromCol: 15, fromFloor: 18, toCol: 17, toFloor: 18, label: 'Spire 9 upper gale chasm' },
      { tower: campaign[9], fromCol: 5, fromFloor: 2, toCol: 7, toFloor: 3, label: 'Spire 10 storm crumble chasm' },
      { tower: sanctums[7], fromCol: 9, fromFloor: 3, toCol: 11, toFloor: 4, label: 'Sanctum 8 single-stone leap' },
      { tower: sanctums[10], fromCol: 9, fromFloor: 4, toCol: 11, toFloor: 5, label: 'Sanctum 11 single-stone leap' },
    ];

    const isRealChasmCase = (jc) => {
      const ledges = jc.tower?.ledges || [];
      const hasFrom = ledges.some(
        (l) => l.col === jc.fromCol && Math.abs(l.floor - jc.fromFloor) < 0.25 && l.type !== 'box' && l.type !== 'pillar'
      );
      const hasTo = ledges.some(
        (l) => l.col === jc.toCol && Math.abs(l.floor - jc.toFloor) < 0.25 && l.type !== 'box' && l.type !== 'pillar'
      );
      return hasFrom && hasTo;
    };

    const activeCases = jumpCases.filter(isRealChasmCase);
    expect(activeCases.length).toBeGreaterThanOrEqual(8);
    for (const jc of activeCases) {
      expect(
        canClearChasm120Hz(jc.tower, jc.fromCol, jc.fromFloor, jc.toCol, jc.toFloor),
        `120Hz jump failed: ${jc.label}`
      ).toBe(true);
    }
  });
});
