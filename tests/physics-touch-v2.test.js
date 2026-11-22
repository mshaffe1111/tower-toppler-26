import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { COLS, createTowers } from '../src/levels.js';
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
  MANTLE_MAX_GAP,
  CRAB_BOUNCE_PEAK_F,
  GEYSER_BASE_PEAK_F,
  solveSpringVy,
} from '../src/game.js';
import { InputController } from '../src/input.js';
import { DEFAULT_SETTINGS, ProgressionManager } from '../src/progression.js';

function colDistSigned(a, b) {
  let d = (((b % COLS) + COLS) % COLS) - (((a % COLS) + COLS) % COLS);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

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
    controlMode: 'joystick',
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

function createMockProgression(skillRanks = {}) {
  const settings = { ...DEFAULT_SETTINGS, zenMode: false };
  let gears = 0;
  const companions = [];
  return {
    getSettings: () => ({ ...settings }),
    updateSettings: (s) => Object.assign(settings, s),
    getEquippedSkin: () => settings.skinId,
    getEquippedBlasterFx: () => settings.blasterFxId,
    getHighScore: () => 0,
    recordScore: () => {},
    getGears: () => gears,
    addGears: (n) => {
      gears += Number(n) || 0;
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
    unlockTrophy: () => null,
  };
}

function createFlatTower(extra = {}) {
  const ledges = [];
  for (let c = 0; c < COLS; c++) {
    ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
  }
  return {
    id: extra.id ?? 1,
    act: extra.act ?? 1,
    key: 'test_v2',
    name: 'PHYSICS V2 TEST SPIRE',
    subtitle: 'UNIT TEST',
    theme: 'canyon_river',
    floors: 20,
    timeLimit: 240,
    parTime: 100,
    spawn: extra.spawn || { col: 2, floor: 0 },
    mechanics: {
      waterBaseFloor: -1.0,
      waterRiseRate: 0,
      waterPurified: false,
      windForce: 0,
      windPeriod: 6.0,
      ...(extra.mechanics || {}),
    },
    ledges: extra.ledges || ledges,
    elevators: extra.elevators || [],
    doors: extra.doors || [{ id: 'exit', col: 10, floor: 16, isExit: true }],
    switches: extra.switches || [],
    wallStrips: extra.wallStrips || [],
    grappleRings: extra.grappleRings || [],
    hydroRings: extra.hydroRings || [],
    collectibles: extra.collectibles || [],
    enemies: extra.enemies || [],
    crownSeals: extra.crownSeals || [],
  };
}

function createMockElement(id, tag = 'div', rect = { left: 0, top: 0, width: 430, height: 932 }) {
  const classes = new Set();
  const attrs = new Map();
  const style = {};
  const dataset = {};
  const el = {
    id,
    tagName: tag.toUpperCase(),
    dataset,
    style,
    parentElement: null,
    classList: {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      toggle: (name, force) => {
        if (force === undefined) {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
        } else if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
    },
    setAttribute: (k, v) => attrs.set(k, String(v)),
    getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    getBoundingClientRect: () => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    }),
    matches: (selector) => {
      return selector.split(',').some((raw) => {
        const sel = raw.trim();
        if (sel.startsWith('#')) return el.id === sel.slice(1);
        if (sel.startsWith('.')) return classes.has(sel.slice(1));
        if (sel === 'button') return el.tagName === 'BUTTON';
        return false;
      });
    },
    closest: (selector) => {
      let cur = el;
      while (cur) {
        if (cur.matches(selector)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    setPointerCapture: () => {},
    getContext: () => null,
  };
  return el;
}

function setupTouchDomEnv() {
  const listeners = new Map();
  const body = createMockElement('body', 'body');
  const app = createMockElement('app', 'div');
  const stageWrap = createMockElement('stage-wrap', 'main');
  const gameCanvas = createMockElement('game-canvas', 'canvas');
  const slashCanvas = createMockElement('slash-vfx-canvas', 'canvas');
  const touchControls = createMockElement('touch-controls', 'footer');
  const actionCluster = createMockElement('action-cluster', 'div', { left: 250, top: 760, width: 175, height: 150 });
  actionCluster.classList.add('touch-right');

  const btnWhip = createMockElement('btn-whip', 'button', { left: 266, top: 838, width: 54, height: 54 });
  const btnFire = createMockElement('btn-fire', 'button', { left: 302, top: 768, width: 54, height: 54 });
  const btnJump = createMockElement('btn-jump', 'button', { left: 350, top: 822, width: 68, height: 68 });
  const btnInteract = createMockElement('btn-interact', 'button', { left: 358, top: 744, width: 52, height: 52 });
  for (const b of [btnWhip, btnFire, btnJump, btnInteract]) b.classList.add('action-btn');

  const joystickZone = createMockElement('joystick-zone', 'div', { left: 16, top: 790, width: 120, height: 120 });
  const joystickPuck = createMockElement('joystick-puck', 'div', { left: 54, top: 828, width: 44, height: 44 });
  const dpad = createMockElement('dpad', 'div', { left: 16, top: 790, width: 120, height: 120 });
  const tiltBar = createMockElement('tilt-bar', 'div', { left: 16, top: 860, width: 140, height: 24 });

  app.parentElement = body;
  stageWrap.parentElement = app;
  gameCanvas.parentElement = stageWrap;
  slashCanvas.parentElement = stageWrap;
  touchControls.parentElement = app;
  actionCluster.parentElement = touchControls;
  btnWhip.parentElement = actionCluster;
  btnFire.parentElement = actionCluster;
  btnJump.parentElement = actionCluster;
  btnInteract.parentElement = actionCluster;
  joystickZone.parentElement = touchControls;
  joystickPuck.parentElement = joystickZone;
  dpad.parentElement = touchControls;
  tiltBar.parentElement = touchControls;

  const byId = new Map([
    ['app', app],
    ['stage-wrap', stageWrap],
    ['game-canvas', gameCanvas],
    ['slash-vfx-canvas', slashCanvas],
    ['touch-controls', touchControls],
    ['action-cluster', actionCluster],
    ['btn-whip', btnWhip],
    ['btn-fire', btnFire],
    ['btn-jump', btnJump],
    ['btn-interact', btnInteract],
    ['joystick-zone', joystickZone],
    ['joystick-puck', joystickPuck],
    ['dpad', dpad],
    ['tilt-bar', tiltBar],
  ]);

  const mockWindow = {
    innerWidth: 430,
    innerHeight: 932,
    devicePixelRatio: 1,
    DeviceOrientationEvent: function DeviceOrientationEvent() {},
    DeviceMotionEvent: function DeviceMotionEvent() {},
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: (type, fn) => {
      const arr = listeners.get(type);
      if (!arr) return;
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    },
    dispatchEvent: (type, evt) => {
      const arr = listeners.get(type) || [];
      arr.forEach((fn) => fn(evt));
    },
    getComputedStyle: (el) => ({
      display: el.style.display || 'flex',
      visibility: el.style.visibility || 'visible',
      pointerEvents: el.style.pointerEvents || 'auto',
      opacity: el.style.opacity ?? '1',
      position: 'relative',
      transform: 'none',
    }),
  };

  const mockDocument = {
    body,
    hidden: false,
    getElementById: (id) => byId.get(id) || null,
    querySelector: (sel) => (sel.includes('.touch-right') ? actionCluster : null),
    querySelectorAll: () => [],
    addEventListener: () => {},
  };

  globalThis.Element = Object;
  globalThis.window = mockWindow;
  globalThis.document = mockDocument;
  Object.defineProperty(globalThis, 'navigator', {
    value: { vibrate: () => true, userActivation: { hasBeenActive: true } },
    configurable: true,
    writable: true,
  });

  const firePointer = (
    type,
    { pointerId = 1, clientX = 200, clientY = 500, timeStamp = 100, target = gameCanvas } = {}
  ) => {
    mockWindow.dispatchEvent(type, {
      pointerId,
      pointerType: 'touch',
      button: 0,
      clientX,
      clientY,
      timeStamp,
      target,
      cancelable: true,
      preventDefault: () => {},
    });
  };

  return {
    mockWindow,
    elements: { app, gameCanvas, btnJump, btnFire, btnWhip, btnInteract, joystickZone, joystickPuck },
    firePointer,
  };
}

describe('1. Expressive Nintendo/Celeste Jump Arc, Anti-Bypass, Corner-Correction & Continuous Stairs (#603)', () => {
  it('1.1 & 1.2: Full jump hits 1.48..1.62F with asymmetric rise/fall (t_fall < t_rise) and 0.08s short-hop hits 0.68..0.86F', () => {
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
    expect(MANTLE_MAX_GAP).toBe(0.30);

    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(createFlatTower());

    // Full running jump
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let i = 0; i < 40; i++) game.update(FIXED_STEP);
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
    expect(peak).toBeLessThanOrEqual(1.62);
    expect(tRise).toBeGreaterThanOrEqual(0.33);
    expect(tRise).toBeLessThanOrEqual(0.39);
    expect(tFall).toBeGreaterThanOrEqual(0.28);
    expect(tFall).toBeLessThanOrEqual(0.35);
    expect(tFall).toBeLessThan(tRise);

    // 0.08s short-hop
    inp.resetState();
    for (let i = 0; i < 30; i++) game.update(FIXED_STEP);
    inp.press('jump');
    let shortPeak = 0;
    for (let s = 0; s < 100; s++) {
      if (s === 10) inp.release('jump');
      game.update(FIXED_STEP);
      if (game.gateway.floor > shortPeak) shortPeak = game.gateway.floor;
      if (game.gateway.onGround && s > 3) break;
    }
    expect(shortPeak).toBeGreaterThanOrEqual(0.68);
    expect(shortPeak).toBeLessThanOrEqual(0.86);
  });

  it('1.3: Anti-bypass invariant — even at geyser_spring Rank 3, full jump + MANTLE_MAX_GAP NEVER bypasses +2F', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression({ geyser_spring: 3 }));
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledges.push({ col: 4, floor: 2, type: 'solid', stairDir: 0 });
    ledges.push({ col: 5, floor: 2, type: 'solid', stairDir: 0 });
    game.mode = 'tower';
    game.loadTower(createFlatTower({ ledges, spawn: { col: 3, floor: 0 } }));

    game.gateway.col = 3.55;
    inp.state.right = true;
    inp.state.analogX = 1.0;
    inp.press('jump');
    let maxFloor = 0;
    let reachedTwo = false;
    for (let s = 0; s < 130; s++) {
      game.update(FIXED_STEP);
      if (game.gateway.floor > maxFloor) maxFloor = game.gateway.floor;
      if (game.gateway.onGround && game.gateway.floor >= 1.95) reachedTwo = true;
    }
    expect(maxFloor + MANTLE_MAX_GAP).toBeLessThan(1.98);
    expect(reachedTwo).toBe(false);
  });

  it('1.4: Overhead corner-correction nudge slides Gateway cleanly around an upper box edge without killing upward vy', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    // Overhead solid box at col 5, floor 2 (occupies [5.0, 6.0])
    ledges.push({ col: 5, floor: 2, type: 'box' });
    game.mode = 'tower';
    game.loadTower(createFlatTower({ ledges, spawn: { col: 4, floor: 0 } }));

    // Position hero grazing outer left edge of col 5 box (hero at col 4.78 -> offset from box center 5.5 is -0.72, overlap ~0.04 inside outer nudge zone)
    const p = game.gateway;
    p.col = 4.76;
    p.floor = 1.15;
    p.vy = 6.5;
    p.onGround = false;
    game.update(FIXED_STEP);
    expect(p.vy).toBeGreaterThan(4.0);
    expect(p.col).toBeLessThan(4.76);
  });

  it('1.5: Continuous linear staircase surface produces strictly smooth monotonic floor & camera climb (0 stair-snap jitter)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < 4; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    // 5-tile canonical staircase from col 4 (f=0) up to col 8 (f=4), landing at col 9 (f=5)
    for (let i = 0; i < 5; i++) {
      ledges.push({ col: 4 + i, floor: i, type: 'solid', stairDir: 1, isExplicitStair: true, explicitStairDir: 1 });
    }
    for (let c = 9; c <= 12; c++) ledges.push({ col: c, floor: 5, type: 'solid', stairDir: 0 });
    game.mode = 'tower';
    game.loadTower(createFlatTower({ ledges, spawn: { col: 3, floor: 0 } }));

    inp.state.right = true;
    inp.state.analogX = 1.0;
    let prevFloor = game.gateway.floor;
    let floorDrops = 0;
    let maxStepJump = 0;
    for (let s = 0; s < 300; s++) {
      game.update(FIXED_STEP);
      const curFloor = game.gateway.floor;
      const df = curFloor - prevFloor;
      if (df < -0.01) floorDrops++;
      if (df > maxStepJump) maxStepJump = df;
      prevFloor = curFloor;
      if (game.gateway.col >= 10.0) break;
    }
    expect(floorDrops).toBe(0);
    expect(maxStepJump).toBeLessThan(0.08);
    expect(game.gateway.floor).toBeCloseTo(5.0, 2);
  });
});

describe('2. Reconciled Snap-Crab Bounce & Hydro-Geyser Calibration (#602 + #603)', () => {
  it('2.1: Zero accidental crab bounce — respects 0.22s arming delay, ignores flat walks, and ignores |dc| = 0.72', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        spawn: { col: 4, floor: 0 },
        enemies: [{ type: 'snap_crab', col: 6.5, floor: 0, dir: -1 }],
      })
    );
    const crab = game.enemies[0];
    game._applyAttackToEnemy(crab, 'whip');
    expect(crab.flipped).toBe(true);
    expect(crab.springArmTimer).toBeCloseTo(0.22, 2);

    // 1. Immediate aerial drop during 0.22s arming delay MUST NOT catapult!
    const p = game.gateway;
    p.col = crab.col;
    p.floor = 0.25;
    p.vy = -1.5;
    p.onGround = false;
    game.update(FIXED_STEP);
    expect(p.steamBoostActive).toBe(false);
    expect(p.vy).toBeLessThanOrEqual(0);

    // Let arming timer expire while Gateway stands safely away
    p.col = 4.0;
    p.floor = 0;
    p.onGround = true;
    for (let i = 0; i < 35; i++) game.update(FIXED_STEP);
    expect(crab.springArmTimer).toBe(0);

    // 2. Flat walking directly past flipped crab (onGround = true, no jump) MUST NOT catapult!
    p.col = 5.2;
    p.floor = 0;
    p.onGround = true;
    inp.state.right = true;
    inp.state.analogX = 1.0;
    let stayedGrounded = true;
    for (let i = 0; i < 120; i++) {
      game.update(FIXED_STEP);
      if (!p.onGround || p.vy > 0.1) stayedGrounded = false;
    }
    expect(stayedGrounded).toBe(true);
    expect(p.col).toBeGreaterThan(7.5);

    // 3. Airborne pass at |dc| = 0.72 MUST NOT trigger carapace spring!
    inp.resetState();
    p.col = crab.col + 0.72;
    p.floor = 0.22;
    p.vy = -1.0;
    p.onGround = false;
    game.update(FIXED_STEP);
    expect(p.steamBoostActive).toBe(false);
  });

  it('2.2: Altitude-compensated Snap-Crab bounce hits +3.185F ± 0.05F across contactElev {0, 0.25, 0.50} & supports Down-cut', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    expect(CRAB_BOUNCE_PEAK_F).toBeGreaterThanOrEqual(3.18);
    expect(solveSpringVy(3.185)).toBeGreaterThan(10.0);

    for (const contactElev of [0.0, 0.25, 0.50]) {
      game.mode = 'tower';
      game.loadTower(
        createFlatTower({
          spawn: { col: 3, floor: 0 },
          enemies: [{ type: 'snap_crab', col: 6.5, floor: 0, dir: -1 }],
        })
      );
      const crab = game.enemies[0];
      game._applyAttackToEnemy(crab, 'whip');
      for (let i = 0; i < 35; i++) game.update(FIXED_STEP);

      const p = game.gateway;
      p.col = crab.col;
      p.floor = crab.floor + contactElev;
      p.vx = 0;
      p.vy = contactElev === 0 ? 0 : -1.0;
      p.onGround = contactElev === 0;
      inp.resetState();
      if (contactElev === 0) inp.press('jump');

      let peak = 0;
      let sawSomersault = false;
      for (let s = 0; s < 160; s++) {
        game.update(FIXED_STEP);
        if (p.floor > peak) peak = p.floor;
        if (p.springSomersault) sawSomersault = true;
        if (p.onGround && s > 15) break;
      }
      expect(sawSomersault).toBe(true);
      expect(peak - crab.floor).toBeGreaterThanOrEqual(3.13);
      expect(peak - crab.floor).toBeLessThanOrEqual(3.25);
    }

    // Active Down-cut shortens crab spring hop cleanly
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        spawn: { col: 3, floor: 0 },
        enemies: [{ type: 'snap_crab', col: 6.5, floor: 0, dir: -1 }],
      })
    );
    const crab = game.enemies[0];
    game._applyAttackToEnemy(crab, 'whip');
    for (let i = 0; i < 35; i++) game.update(FIXED_STEP);
    const p = game.gateway;
    p.col = crab.col;
    p.floor = 0.25;
    p.vy = -1.0;
    p.onGround = false;
    inp.resetState();
    let downPeak = 0;
    for (let s = 0; s < 120; s++) {
      if (s === 12) inp.state.down = true;
      game.update(FIXED_STEP);
      if (p.floor > downPeak) downPeak = p.floor;
      if (p.onGround && s > 15) break;
    }
    expect(downPeak).toBeLessThan(2.65);
  });

  it('2.3: Hydro-Geyser peak is calibrated to 3.78..3.96F base and strictly <= 4.25F at max skill Rank 3', () => {
    expect(GEYSER_BASE_PEAK_F).toBeGreaterThanOrEqual(3.85);
    for (const rank of [0, 3]) {
      const inp = createMockInput();
      const game = new ToweringWatersGame(null, inp, {}, createMockProgression({ geyser_spring: rank }));
      const ledges = [];
      for (let c = 0; c < COLS; c++) {
        ledges.push({
          col: c,
          floor: 0,
          type: c === 6 ? 'steamVent' : 'solid',
          phasePeriod: 3.1,
          phaseOffset: 2.3,
          stairDir: 0,
        });
      }
      game.mode = 'tower';
      game.loadTower(createFlatTower({ ledges, spawn: { col: 4, floor: 0 } }));

      const p = game.gateway;
      p.col = 6.5;
      p.floor = 0.05;
      p.onGround = true;
      let peak = 0;
      for (let s = 0; s < 220; s++) {
        game.update(FIXED_STEP);
        if (p.floor > peak) peak = p.floor;
        if (p.onGround && s > 20) break;
      }
      if (rank === 0) {
        expect(peak).toBeGreaterThanOrEqual(3.78);
        expect(peak).toBeLessThanOrEqual(3.98);
      } else {
        expect(peak).toBeGreaterThanOrEqual(3.95);
        expect(peak).toBeLessThanOrEqual(4.25);
      }
    }
  });
});

describe('3. Reactive Enemy Combat & Counter-Play (#602)', () => {
  it('3.1: Flipped-Crab Shell Punt launches shell at 8.5 cols/s, shattering crates & bowling through enemies', () => {
    const inp = createMockInput();
    const prog = createMockProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledges.push({ col: 8, floor: 0, type: 'box' });
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        ledges,
        spawn: { col: 5, floor: 0 },
        enemies: [
          { type: 'snap_crab', col: 6.3, floor: 0, dir: -1 },
          { type: 'gulp_hopper', col: 10.2, floor: 0, dir: -1 },
        ],
      })
    );
    const crab = game.enemies[0];
    const hopper = game.enemies[1];
    const crate = game.ledges.find((l) => l.type === 'box');

    // First whip flips the crab; second whip punts the shell right at 8.5 cols/s!
    game.gateway.facing = 1;
    game._applyAttackToEnemy(crab, 'whip');
    expect(crab.flipped).toBe(true);
    expect(crab.shellPunted).toBe(false);

    game._applyAttackToEnemy(crab, 'whip');
    expect(crab.shellPunted).toBe(true);
    expect(Math.abs(crab.velCol)).toBeCloseTo(8.5, 1);

    for (let s = 0; s < 120; s++) game.update(FIXED_STEP);
    expect(crate.gone).toBe(true);
    expect(hopper.dead).toBe(true);
    expect(prog.getGears()).toBeGreaterThanOrEqual(2);
  });

  it('3.2: Gulp-Hopper slam spawns jumpable ground shockwave (slamWaveProgress) & inflated whip triggers Belly-Pop Pinata', () => {
    const inp = createMockInput();
    const prog = createMockProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        spawn: { col: 2, floor: 0 },
        enemies: [{ type: 'gulp_hopper', col: 9.5, floor: 0, dir: -1 }],
      })
    );
    const hopper = game.enemies[0];
    let sawWave = false;
    for (let s = 0; s < 420; s++) {
      game.update(FIXED_STEP);
      if ((hopper.slamWaveProgress || 0) > 0.05) {
        sawWave = true;
        break;
      }
    }
    expect(sawWave).toBe(true);

    // Belly-Pop Pinata when whipping inflated hopper!
    hopper.aiState = 'inflate';
    hopper.inflatePhase = 0.85;
    const gearsBefore = prog.getGears();
    game._applyAttackToEnemy(hopper, 'whip');
    expect(hopper.dead).toBe(true);
    expect(prog.getGears()).toBeGreaterThanOrEqual(gearsBefore + 2);
  });

  it('3.3 & 3.4: Barnacle Mortar exposes dotted mortarArc & 55ms Home-Run Reflect; Stun-Kick Finisher kicks stunned foes', () => {
    const inp = createMockInput();
    const prog = createMockProgression();
    const game = new ToweringWatersGame(null, inp, {}, prog);
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        spawn: { col: 4, floor: 0 },
        enemies: [
          { type: 'barnacle_mortar', col: 8.5, floor: 0, dir: -1, firePeriod: 2.2 },
          { type: 'rail_skater', col: 14.5, floor: 0, dir: -1 },
        ],
      })
    );
    const mortar = game.enemies[0];
    const skater = game.enemies[1];
    mortar.fireTimer = 0.01;
    let sawArc = false;
    for (let s = 0; s < 120; s++) {
      game.update(FIXED_STEP);
      if (
        mortar.aiState === 'swell_tell' &&
        mortar.mortarArc?.active &&
        Array.isArray(mortar.mortarArc.points) &&
        mortar.mortarArc.points.length >= 4
      ) {
        sawArc = true;
      }
      if (game.enemyProjectiles.length > 0) break;
    }
    expect(sawArc).toBe(true);
    expect(game.enemyProjectiles.length).toBeGreaterThan(0);

    // Home-Run Reflect with 55ms hit-stop!
    const proj = game.enemyProjectiles[0];
    game.gateway.col = 5.5;
    game.gateway.facing = 1;
    proj.col = 6.2;
    proj.floor = 0.45;
    inp.press('whip');
    game.update(FIXED_STEP);
    expect(proj.deflected).toBe(true);
    expect(game.hitStopTimer).toBeCloseTo(0.055, 3);

    // Stun-Kick Finisher on walk-into!
    game.hitStopTimer = 0;
    skater.stunTimer = 2.0;
    game.gateway.col = skater.col - 0.35;
    game.gateway.floor = skater.floor;
    game.gateway.vx = 2.5;
    game.gateway.facing = 1;
    game.gateway.onGround = true;
    const livesBefore = game.lives;
    game.update(FIXED_STEP);
    expect(skater.dead).toBe(true);
    expect(game.lives).toBe(livesBefore);
  });
});

describe('4. Critically Damped Camera & Gateway 2.0 Personality (#602 + #603)', () => {
  it('4.1 & 4.2: Vertical platform-snap deadzone keeps camFloor rock-steady on normal jump; horizontal feedforward leads >= +0.35 cols', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.mode = 'tower';
    game.loadTower(createFlatTower({ spawn: { col: 3, floor: 0 } }));

    // Settle camera at floor 0
    for (let i = 0; i < 30; i++) game.update(FIXED_STEP);
    const camStartFloor = game.camFloor;

    // Normal jump on flat ground -> |camFloor_peak - camFloor_start| < 0.05F
    inp.press('jump');
    let maxCamFloorDrift = 0;
    for (let s = 0; s < 110; s++) {
      game.update(FIXED_STEP);
      maxCamFloorDrift = Math.max(maxCamFloorDrift, Math.abs(game.camFloor - camStartFloor));
      if (game.gateway.onGround && s > 10) break;
    }
    expect(maxCamFloorDrift).toBeLessThan(0.05);

    // Running right for 1.0s -> smooth horizontal lead >= +0.35 cols
    inp.resetState();
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 120; s++) game.update(FIXED_STEP);
    const lead = colDistSigned(game.gateway.col, game.camCol);
    expect(lead).toBeGreaterThanOrEqual(0.35);
    expect(lead).toBeLessThanOrEqual(0.65);
  });

  it('4.3: Drives Gateway 2.0 mood, edgeTeeter, wetShakeTimer, lookTarget & surfaceMaterial', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [
      { col: 2, floor: 2, type: 'solid', stairDir: 0 },
      { col: 3, floor: 2, type: 'ice', stairDir: 0 },
    ];
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        ledges,
        spawn: { col: 2, floor: 2 },
        enemies: [{ type: 'snap_crab', col: 3.5, floor: 2, dir: -1 }],
      })
    );
    const p = game.gateway;
    // Standing on ice near edge with nearby enemy (ramp smoothly over ~0.12s = 15 substeps)
    p.col = 3.84;
    p.floor = 2;
    p.onGround = true;
    p.vx = 0;
    p.invuln = 10;
    for (let s = 0; s < 15; s++) game.update(FIXED_STEP);
    expect(p.surfaceMaterial).toBe('ice');
    expect(p.edgeTeeter).toBeGreaterThan(0.35);
    expect(p.lookTarget).toBeTruthy();
    expect(typeof p.lookTarget.dTheta).toBe('number');
    expect(typeof p.lookTarget.yaw).toBe('number');
    expect(p.mood).toBe('surprised');

    // Water exit sets wetShakeTimer = 0.65
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

describe('5. Watershed Flow Perks, Hydro-Rings, Supply Crates, Floodgate Surge & 13.5s Core Descent (#601)', () => {
  it('5.1: Watershed Flow (35/70/100%) unlocks Tidal Aegis, Pressurized Sluice (+20s + pipeA lift) & Hydro-Overcharge (25s)', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    game.addFlowCharge(35, { combo: true });
    expect(game._pendingSpirePerks.tidalAegis).toBe(true);
    game.addFlowCharge(35, { combo: true });
    expect(game._pendingSpirePerks.pressurizedSluice).toBe(true);
    game.addFlowCharge(30, { combo: true });
    expect(game._pendingSpirePerks.hydroOvercharge).toBe(true);
    expect(game.watershedFlowPct).toBe(100);

    // Load a spire with a pipeA elevator -> all 3 perks activate automatically!
    const tower = createFlatTower({
      elevators: [{ id: 'el_pipe', col: 5, minFloor: 0, maxFloor: 6, startFloor: 0, speed: 1.5, pipeGroup: 'pipeA' }],
      switches: [{ id: 'sw_pipe', col: 3, floor: 0, pipeGroup: 'pipeA', mode: 'valve' }],
    });
    game.mode = 'tower';
    game.loadTower(tower);

    expect(game.activeSpirePerks.tidalAegis).toBe(true);
    expect(game.gateway.shield).toBe(true);
    expect(game.activeSpirePerks.pressurizedSluice).toBe(true);
    expect(game.timer).toBe(260); // 240 + 20s Pressurized Sluice bonus!
    expect(game.pipeStates.pipeA).toBe(true);
    expect(game.elevators[0].powered).toBe(true);
    expect(game.activeSpirePerks.hydroOvercharge).toBe(true);
    expect(game.activeSpirePerks.hydroOverchargeTimer).toBeCloseTo(25.0, 1);

    // Hydro-Overcharge grants +15% run speed!
    inp.state.right = true;
    inp.state.analogX = 1.0;
    for (let s = 0; s < 40; s++) game.update(FIXED_STEP);
    expect(game.gateway.vx).toBeGreaterThan(BASE_WALK_SPEED * 1.12);
  });

  it('5.2: Hydro-Rings grant speed burst + combo and destructible Supply Crates drop real power-ups', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const ledges = [];
    for (let c = 0; c < COLS; c++) ledges.push({ col: c, floor: 0, type: 'solid', stairDir: 0 });
    ledges.push({ col: 4, floor: 0, type: 'box', powerUp: 'hydro_magnet' });
    ledges.push({ col: 6, floor: 0, type: 'box', powerUp: 'turbo_current' });
    game.mode = 'tower';
    game.loadTower(
      createFlatTower({
        ledges,
        spawn: { col: 3, floor: 0 },
        hydroRings: [{ id: 'hr_1', col: 8, floor: 0.4 }],
        collectibles: [{ id: 'g_far', type: 'gear', col: 5.8, floor: 0.6 }],
      })
    );

    // Whip hydro_magnet crate -> activates hydro_magnet and pulls nearby gear!
    game.gateway.col = 3.4;
    game.gateway.facing = 1;
    inp.press('whip');
    game.update(FIXED_STEP);
    expect(game.activePowerUp?.type).toBe('hydro_magnet');
    for (let s = 0; s < 45; s++) game.update(FIXED_STEP);
    expect(game.collectibles[0].collected).toBe(true);

    // Fly through Hydro-Ring -> collected + speed burst!
    game.gateway.col = 8.45;
    game.gateway.floor = 0.4;
    game.update(FIXED_STEP);
    expect(game.hydroRings[0].collected).toBe(true);
    expect(game.gateway.hydroRingBoostTimer).toBeGreaterThan(2.0);
  });

  it('5.3: Solved Sanctum return triggers 1.85s Exterior Floodgate Surge; Core Descent is tightened to 13.5s; HUD payload exposes all V2 fields', () => {
    const inp = createMockInput();
    const game = new ToweringWatersGame(null, inp, {}, createMockProgression());
    const spireWithSanctum = createTowers('campaign').find((t) => t.doors?.some((d) => d.isRune));
    expect(spireWithSanctum).toBeTruthy();
    game.mode = 'tower';
    game.loadTower(spireWithSanctum);

    const sanctumDoor = game.tower.doors.find((d) => d.isRune);
    expect(sanctumDoor).toBeTruthy();
    game._enterPuzzleRoom(sanctumDoor);
    expect(game.mode).toBe('aqueduct_sanctum');
    game.puzzleRoom.solved = true;
    game._leavePuzzleRoom();

    expect(game.mode).toBe('tower');
    expect(game.floodgateSurgeTimer).toBeCloseTo(1.85, 2);
    expect(game.spireFloodgateSurgeFx.active).toBe(true);

    const hud = game.getHudState();
    expect(hud).toHaveProperty('gatewayMood');
    expect(hud).toHaveProperty('watershedFlowPct');
    expect(hud).toHaveProperty('activeSpirePerks');
    expect(hud).toHaveProperty('activePowerUp');
    expect(hud.floodgateSurgeTimer).toBeCloseTo(1.85, 2);
    expect(Array.isArray(hud.rescuedCritterEscorts)).toBe(true);

    // Tightened 13.5s Core Descent!
    game._initCoreDescentStage();
    expect(game.mode).toBe('core_descent');
    expect(game.coreDescent.totalDepth).toBe(360);
    expect(game.coreDescent.duration).toBe(13.5);
  });
});

describe('6. Gold-Standard Mobile Touch Controls (#603 Assertions 10–14)', () => {
  let env;
  let input;

  beforeEach(() => {
    env = setupTouchDomEnv();
    input = new InputController();
  });

  afterEach(() => {
    input?.resetState();
  });

  it('6.1: Default control mode is "joystick" across DEFAULT_SETTINGS, ProgressionManager, and InputController', () => {
    expect(DEFAULT_SETTINGS.controlMode).toBe('joystick');
    const prog = new ProgressionManager();
    expect(prog.getSettings().controlMode).toBe('joystick');
    expect(input.controlMode).toBe('joystick');
  });

  it('6.2: Dynamic Floating Thumbstick spawns under thumb, leashes within 54px, reverses in < 50ms, and enforces strict ±38° tower vertical cone', () => {
    input.setGameMode('tower');
    input.clearFrame();

    // Touch down at (90, 620) -> spawns floating stick centered at (90, 620)
    env.firePointer('pointerdown', { pointerId: 30, clientX: 90, clientY: 620, timeStamp: 1000 });
    expect(input.floatingStickState.active).toBe(true);
    expect(input.floatingStickState.originX).toBe(90);
    expect(input.floatingStickState.originY).toBe(620);

    // Drag right 120px to (210, 620) -> anchor leashes smoothly within 54px!
    env.firePointer('pointermove', { pointerId: 30, clientX: 210, clientY: 620, timeStamp: 1080 });
    expect(input.state.right).toBe(true);
    expect(input.state.analogX).toBeCloseTo(1.0, 2);
    expect(Math.abs(210 - input.floatingStickState.originX)).toBeLessThanOrEqual(54.1);

    // Reverse left 35px to (175, 620) within 32ms -> immediately flips to analogX < 0 (< 50ms)!
    env.firePointer('pointermove', { pointerId: 30, clientX: 175, clientY: 620, timeStamp: 1112 });
    expect(input.state.analogX).toBeLessThan(0);
    expect(input.state.left).toBe(true);
    env.firePointer('pointerup', { pointerId: 30, clientX: 175, clientY: 620, timeStamp: 1130 });

    // Strict ±38° tower vertical cone: shallow diagonal (dx = +50, dy = -22, ~24°) MUST NOT trigger up!
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 31, clientX: 100, clientY: 620, timeStamp: 1200 });
    env.firePointer('pointermove', { pointerId: 31, clientX: 150, clientY: 598, timeStamp: 1230 });
    expect(input.state.right).toBe(true);
    expect(input.state.up).toBe(false);

    // Pure upward pull inside cone (dx = +10, dy = -48) DOES trigger up!
    env.firePointer('pointermove', { pointerId: 31, clientX: 110, clientY: 572, timeStamp: 1260 });
    expect(input.state.up).toBe(true);
    env.firePointer('pointerup', { pointerId: 31, clientX: 110, clientY: 572, timeStamp: 1280 });

    // Mini-game 2D isotropic adapter in reef_swim: diagonal outputs smooth analogX AND analogY!
    input.setGameMode('reef_swim');
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 32, clientX: 100, clientY: 620, timeStamp: 1400 });
    env.firePointer('pointermove', { pointerId: 32, clientX: 135, clientY: 585, timeStamp: 1430 });
    expect(input.state.analogX).toBeGreaterThan(0.5);
    expect(input.state.analogY).toBeLessThan(-0.5);
    env.firePointer('pointerup', { pointerId: 32, clientX: 135, clientY: 585, timeStamp: 1450 });
  });

  it('6.3: Locked Right-Thumb Action Buttons never slide-hijack and empty right-side glass never misfires Pulse/Jump', () => {
    input.setControlMode('joystick');
    input.setGameMode('tower');
    input.clearFrame();

    // Press #btn-jump center (384, 856) and roll thumb 20px toward #btn-fire -> jump stays held, fire stays false!
    env.firePointer('pointerdown', {
      pointerId: 40,
      clientX: 384,
      clientY: 856,
      timeStamp: 2000,
      target: env.elements.btnJump,
    });
    expect(input.state.jump).toBe(true);
    expect(input.justPressed.jump).toBe(true);

    input.clearFrame();
    env.firePointer('pointermove', {
      pointerId: 40,
      clientX: 364,
      clientY: 836,
      timeStamp: 2040,
      target: env.elements.btnFire,
    });
    expect(input.state.jump).toBe(true);
    expect(input.justPressed.fire).toBe(false);
    expect(input.state.fire).toBe(false);
    env.firePointer('pointerup', { pointerId: 40, clientX: 364, clientY: 836, timeStamp: 2080 });
    expect(input.state.jump).toBe(false);

    // Tapping blank right-half glass away from action buttons in joystick mode MUST NOT misfire fire or jump!
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 41, clientX: 350, clientY: 420, timeStamp: 2200 });
    env.firePointer('pointerup', { pointerId: 41, clientX: 350, clientY: 420, timeStamp: 2240 });
    expect(input.justPressed.fire).toBe(false);
    expect(input.justPressed.jump).toBe(false);
  });

  it('6.4: Repaired gesture mode tolerates 8px jitter, preserves jump+run across 80ms mid-air pause, adds Down-Flick Whip & glass reticle', () => {
    input.setControlMode('gesture');
    input.setGameMode('tower');
    input.clearFrame();

    // Slide right 60px -> full run, then 8px thumb recoil jitter -> MUST NOT stall run!
    env.firePointer('pointerdown', { pointerId: 50, clientX: 120, clientY: 600, timeStamp: 3000 });
    expect(input.gestureReticle.active).toBe(true);
    env.firePointer('pointermove', { pointerId: 50, clientX: 180, clientY: 600, timeStamp: 3120 });
    expect(input.state.analogX).toBeCloseTo(1.0, 2);

    env.firePointer('pointermove', { pointerId: 50, clientX: 172, clientY: 601, timeStamp: 3160 });
    expect(input.state.analogX).toBeGreaterThan(0.5);
    expect(input.state.right).toBe(true);

    // Upward diagonal flick -> jump! Then hold thumb stationary for 80ms (ZERO 32ms jump-kill!)
    env.firePointer('pointermove', { pointerId: 50, clientX: 178, clientY: 552, timeStamp: 3200 });
    expect(input.justPressed.jump).toBe(true);
    expect(input.state.jump).toBe(true);

    for (let i = 0; i < 5; i++) input.update(0.016); // 80ms stationary mid-air hold
    expect(input.state.jump).toBe(true);
    expect(input.state.right).toBe(true);
    env.firePointer('pointerup', { pointerId: 50, clientX: 178, clientY: 552, timeStamp: 3300 });
    expect(input.gestureReticle.active).toBe(false);

    // Down-Flick -> Tail-Whip!
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 51, clientX: 200, clientY: 520, timeStamp: 3500 });
    env.firePointer('pointermove', { pointerId: 51, clientX: 202, clientY: 568, timeStamp: 3540 });
    expect(input.justPressed.whip).toBe(true);
    env.firePointer('pointerup', { pointerId: 51, clientX: 202, clientY: 572, timeStamp: 3560 });
  });

  it('6.5: Repaired tilt mode supports true holdable right-half variable Jump alongside left-half Pulse & wrist/slash Whip', () => {
    input.setControlMode('tilt');
    input.setGameMode('tower');
    input.clearFrame();

    env.firePointer('pointerdown', { pointerId: 60, clientX: 360, clientY: 600, timeStamp: 4000 });
    expect(input.justPressed.jump).toBe(true);
    expect(input.state.jump).toBe(true);
    input.update(0.12);
    expect(input.state.jump).toBe(true);
    env.firePointer('pointerup', { pointerId: 60, clientX: 362, clientY: 600, timeStamp: 4160 });
    expect(input.state.jump).toBe(false);
    expect(input.justPressed.fire).toBe(false);
  });
});
