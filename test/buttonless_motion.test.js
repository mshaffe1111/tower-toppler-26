import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { InputController } from '../src/input.js';

// Lightweight deterministic DOM harness (zero external jsdom dependency)
function createMockElement(id, tag = 'div', rect = { left: 0, top: 0, width: 430, height: 932 }) {
  const classes = new Set();
  const attrs = new Map();
  const style = {};
  const dataset = {};
  const children = [];

  const el = {
    id,
    tagName: tag.toUpperCase(),
    dataset,
    style,
    parentElement: null,
    children,
    classList: {
      add: (...names) => names.forEach((n) => classes.add(n)),
      remove: (...names) => names.forEach((n) => classes.delete(n)),
      toggle: (name, force) => {
        if (force === undefined) {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
        } else if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
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
      const parts = selector.split(',').map((s) => s.trim());
      return parts.some((sel) => {
        if (sel.startsWith('#')) return el.id === sel.slice(1);
        if (sel.startsWith('.')) return classes.has(sel.slice(1));
        if (sel.includes(':not(.hidden)')) {
          const base = sel.split(':not(')[0];
          return base.startsWith('.') && classes.has(base.slice(1)) && !classes.has('hidden');
        }
        if (sel === 'button') return el.tagName === 'BUTTON';
        if (sel === 'input') return el.tagName === 'INPUT';
        if (sel === 'select') return el.tagName === 'SELECT';
        if (sel === 'textarea') return el.tagName === 'TEXTAREA';
        if (sel === 'a') return el.tagName === 'A';
        if (sel === 'label') return el.tagName === 'LABEL';
        if (sel === '[role="button"]') return attrs.get('role') === 'button';
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

function setupMockEnv() {
  const listeners = new Map();
  const docListeners = new Map();
  const vibrateCalls = [];

  const body = createMockElement('body', 'body');
  const app = createMockElement('app', 'div');
  const stageWrap = createMockElement('stage-wrap', 'main');
  const gameCanvas = createMockElement('game-canvas', 'canvas');
  const slashCanvas = createMockElement('slash-vfx-canvas', 'canvas');
  const touchControls = createMockElement('touch-controls', 'footer');
  const actionCluster = createMockElement('action-cluster', 'div', { left: 260, top: 820, width: 160, height: 80 });
  actionCluster.classList.add('touch-right');

  const btnWhip = createMockElement('btn-whip', 'button', { left: 265, top: 840, width: 50, height: 50 });
  const btnFire = createMockElement('btn-fire', 'button', { left: 320, top: 830, width: 50, height: 50 });
  const btnJump = createMockElement('btn-jump', 'button', { left: 372, top: 835, width: 60, height: 60 });
  btnWhip.classList.add('action-btn');
  btnFire.classList.add('action-btn');
  btnJump.classList.add('action-btn');

  const tiltBar = createMockElement('tilt-bar', 'div', { left: 16, top: 860, width: 140, height: 24 });
  const tiltPuck = createMockElement('tilt-puck', 'div', { left: 79, top: 865, width: 14, height: 14 });
  const dpad = createMockElement('dpad', 'div', { left: 16, top: 790, width: 120, height: 120 });
  const joystickZone = createMockElement('joystick-zone', 'div', { left: 16, top: 790, width: 116, height: 116 });

  app.parentElement = body;
  stageWrap.parentElement = app;
  gameCanvas.parentElement = stageWrap;
  slashCanvas.parentElement = stageWrap;
  touchControls.parentElement = app;
  actionCluster.parentElement = touchControls;
  btnWhip.parentElement = actionCluster;
  btnFire.parentElement = actionCluster;
  btnJump.parentElement = actionCluster;
  tiltBar.parentElement = touchControls;
  dpad.parentElement = touchControls;
  joystickZone.parentElement = touchControls;

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
    ['tilt-bar', tiltBar],
    ['tilt-puck', tiltPuck],
    ['dpad', dpad],
    ['joystick-zone', joystickZone],
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
    querySelector: (sel) => {
      if (sel.includes('.touch-right')) return actionCluster;
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
  };

  const mockNavigator = {
    vibrate: (pattern) => {
      vibrateCalls.push(pattern);
      return true;
    },
    userActivation: { hasBeenActive: true },
  };

  globalThis.Element = Object;
  globalThis.window = mockWindow;
  globalThis.document = mockDocument;
  Object.defineProperty(globalThis, 'navigator', {
    value: mockNavigator,
    configurable: true,
    writable: true,
  });

  const firePointer = (type, { pointerId = 1, clientX = 200, clientY = 500, timeStamp = 100, target = gameCanvas } = {}) => {
    const evt = {
      pointerId,
      pointerType: 'touch',
      button: 0,
      clientX,
      clientY,
      timeStamp,
      target,
      cancelable: true,
      preventDefault: () => {},
    };
    mockWindow.dispatchEvent(type, evt);
  };

  return {
    mockWindow,
    mockDocument,
    vibrateCalls,
    elements: {
      body,
      app,
      gameCanvas,
      slashCanvas,
      touchControls,
      actionCluster,
      btnWhip,
      btnFire,
      btnJump,
    },
    firePointer,
  };
}

describe('Round 4 Buttonless Glass, Motion-Sensor Wrist-Whip & Gesture Controls', () => {
  let env;
  let input;

  beforeEach(() => {
    env = setupMockEnv();
    input = new InputController({ mode: 'gesture', hapticsEnabled: true });
  });

  afterEach(() => {
    input?.resetState();
    vi.restoreAllMocks();
  });

  it('1. Hides all action buttons (0 visible) in gesture & tilt modes and shows them ONLY in dpad & joystick modes', () => {
    const { body, app, touchControls, actionCluster, btnWhip, btnFire, btnJump } = env.elements;

    for (const buttonlessMode of ['gesture', 'tilt']) {
      input.setControlMode(buttonlessMode);
      expect(app.dataset.controlMode).toBe(buttonlessMode);
      expect(touchControls.dataset.controlMode).toBe(buttonlessMode);
      expect(body.dataset.controlMode).toBe(buttonlessMode);

      expect(actionCluster.style.display).toBe('none');
      expect(actionCluster.style.pointerEvents).toBe('none');
      for (const btn of [btnWhip, btnFire, btnJump]) {
        expect(btn.style.display).toBe('none');
        expect(btn.style.pointerEvents).toBe('none');
        expect(input._isActionBtnVisible(btn)).toBe(false);
      }
      // Touching the exact old coordinates of #btn-whip / #btn-jump returns null halo in buttonless modes
      expect(input._findActionButtonHalo(290, 865, 12)).toBeNull();
      expect(input._findActionButtonHalo(402, 865, 12)).toBeNull();
    }

    for (const buttonMode of ['dpad', 'joystick']) {
      input.setControlMode(buttonMode);
      expect(app.dataset.controlMode).toBe(buttonMode);
      expect(touchControls.dataset.controlMode).toBe(buttonMode);
      expect(body.dataset.controlMode).toBe(buttonMode);

      expect(actionCluster.style.display).toBe('');
      for (const btn of [btnWhip, btnFire, btnJump]) {
        expect(btn.style.display).toBe('');
        expect(input._isActionBtnVisible(btn)).toBe(true);
      }
      expect(input._findActionButtonHalo(290, 865, 12)).toBe(btnWhip);
      expect(input._findActionButtonHalo(402, 865, 12)).toBe(btnJump);
    }
  });

  it('2. Stylesheet & HTML enforce buttonless glass, slash VFX canvas, and updated Motion/Touch control guides', () => {
    const rootDir = path.resolve(import.meta.dirname, '..');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');

    expect(html).toContain('id="slash-vfx-canvas"');
    expect(html).toContain('id="action-cluster"');
    expect(html).toContain('Tilt: Walk/Run • Wrist-Flick or Swipe Sideways: Tail-Whip • Flick Up: Jump • Tap: Hydro-Pulse');
    expect(html).toContain('Slide &amp; Hold: Walk/Run • Quick Side-Slash or 2-Finger Tap: Tail-Whip • Flick Up: Jump • Tap: Hydro-Pulse');

    expect(css).toContain('#app[data-control-mode="gesture"] #action-cluster');
    expect(css).toContain('#app[data-control-mode="tilt"] #action-cluster');
    expect(css).toContain('#app[data-control-mode="tilt"] #btn-whip');
    expect(css).toContain('display: none !important;');
    expect(css).toContain('pointer-events: none !important;');
    expect(css).toContain('#app:has(#trophy-toast:not(.hidden)) .stage-banner');
    expect(css).toContain('rgba(7, 19, 30, 0.84)');
    expect(css).toContain('backdrop-filter: blur(6px)');
  });

  it('3. requestTiltPermission() requests both DeviceOrientationEvent and DeviceMotionEvent permissions gracefully', async () => {
    const orientReq = vi.fn().mockResolvedValue('granted');
    const motionReq = vi.fn().mockResolvedValue('granted');
    env.mockWindow.DeviceOrientationEvent.requestPermission = orientReq;
    env.mockWindow.DeviceMotionEvent.requestPermission = motionReq;

    const granted = await input.requestTiltPermission();
    expect(granted).toBe(true);
    expect(orientReq).toHaveBeenCalledTimes(1);
    expect(motionReq).toHaveBeenCalledTimes(1);
    expect(input.tiltPermissionGranted).toBe(true);
    expect(input.motionPermissionGranted).toBe(true);
  });

  it('4. tilt mode: devicemotion wrist-flick triggers Tail-Whip with 300ms cooldown; smooth 0..30° roll NEVER false-triggers whip', () => {
    input.setControlMode('tilt');
    input.clearFrame();

    // Smooth phone roll from 0° -> 30° across 30 frames (normal < 100 deg/s roll rate, gentle gravity drift)
    let t = 1000;
    for (let deg = 0; deg <= 30; deg += 1) {
      const rad = (deg * Math.PI) / 180;
      input._applyTiltRoll(deg, deg === 0);
      const fired = input._handleDeviceMotionSample({
        ax: 0.25,
        ay: 0.15,
        az: 0.1,
        agx: 9.81 * Math.sin(rad),
        agy: 9.81 * Math.cos(rad),
        agz: 0,
        rAlpha: 12,
        rBeta: 8,
        rGamma: 62,
        nowMs: t,
      });
      expect(fired).toBe(false);
      t += 16;
    }
    expect(input.justPressed.whip).toBe(false);
    expect(input.state.whip).toBe(false);
    expect(input.state.right).toBe(true);
    expect(input.state.analogX).toBeCloseTo(1.0, 2);

    // Verify progressive tilt curve: deadzone <= 2.8°, slow walk at 5°, full run at 16°+
    input._applyTiltRoll(2.5, true);
    expect(input.state.analogX).toBe(0);
    expect(input.state.right).toBe(false);

    input._applyTiltRoll(5.5, true);
    expect(input.state.right).toBe(true);
    expect(input.state.analogX).toBeGreaterThanOrEqual(0.26);
    expect(input.state.analogX).toBeLessThan(0.5);

    input._applyTiltRoll(16.5, true);
    expect(input.state.analogX).toBeCloseTo(1.0, 2);

    // Crisp wrist-flick linear accel spike >= 9.5 m/s² -> triggers Tail-Whip + haptic [14, 24] + wrist VFX!
    env.vibrateCalls.length = 0;
    const flick1 = input._handleDeviceMotionSample({ ax: 10.4, ay: 1.2, nowMs: 2000 });
    expect(flick1).toBe(true);
    expect(input.justPressed.whip).toBe(true);
    expect(input.state.whip).toBe(true);
    expect(env.vibrateCalls).toContainEqual([14, 24]);
    expect(input._lastSlashVfx?.kind).toBe('wrist');

    // Cooldown (< 300ms) suppresses immediate bounce trigger
    input.clearFrame();
    const bounce = input._handleDeviceMotionSample({ ax: -11.2, ay: 0.8, nowMs: 2150 });
    expect(bounce).toBe(false);
    expect(input.justPressed.whip).toBe(false);

    // Budget sensor fallback: null linear accel, high-pass accelerationIncludingGravity delta >= 10.5 m/s² after cooldown
    input._handleDeviceMotionSample({ agx: 0.0, agy: 9.8, agz: 0, nowMs: 2450 });
    const flickGrav = input._handleDeviceMotionSample({ agx: 11.4, agy: 9.6, agz: 0.2, nowMs: 2470 });
    expect(flickGrav).toBe(true);
    expect(input.justPressed.whip).toBe(true);

    // Sharp gyro twist >= 215 deg/s with jerk after cooldown
    input.clearFrame();
    input._handleDeviceMotionSample({ rGamma: 10, nowMs: 2900 });
    const flickGyro = input._handleDeviceMotionSample({ rGamma: 245, nowMs: 2925 });
    expect(flickGyro).toBe(true);
    expect(input.justPressed.whip).toBe(true);
  });

  it('5. tilt mode: horizontal slash swipe fires Tail-Whip; single tap anywhere fires Hydro-Pulse; upward flick jumps', () => {
    input.setControlMode('tilt');
    input.clearFrame();

    // Horizontal slash swipe anywhere on screen -> Tail-Whip + aqua slash arc VFX
    env.firePointer('pointerdown', { pointerId: 10, clientX: 120, clientY: 500, timeStamp: 1000 });
    env.firePointer('pointermove', { pointerId: 10, clientX: 162, clientY: 504, timeStamp: 1045 });
    expect(input.justPressed.whip).toBe(true);
    expect(input.state.whip).toBe(true);
    expect(input._lastSlashVfx?.kind).toBe('slash');
    env.firePointer('pointerup', { pointerId: 10, clientX: 170, clientY: 505, timeStamp: 1060 });

    // Single tap on RIGHT half of screen -> Hydro-Pulse (fire), NOT jump!
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 11, clientX: 360, clientY: 520, timeStamp: 1500 });
    env.firePointer('pointerup', { pointerId: 11, clientX: 362, clientY: 521, timeStamp: 1555 });
    expect(input.justPressed.fire).toBe(true);
    expect(input.justPressed.jump).toBe(false);

    // Single tap on LEFT half of screen -> Hydro-Pulse (fire)
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 12, clientX: 70, clientY: 520, timeStamp: 1700 });
    env.firePointer('pointerup', { pointerId: 12, clientX: 71, clientY: 522, timeStamp: 1750 });
    expect(input.justPressed.fire).toBe(true);

    // Upward flick anywhere -> Jump
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 13, clientX: 210, clientY: 540, timeStamp: 2000 });
    env.firePointer('pointermove', { pointerId: 13, clientX: 212, clientY: 495, timeStamp: 2045 });
    expect(input.justPressed.jump).toBe(true);
    env.firePointer('pointerup', { pointerId: 13, clientX: 212, clientY: 490, timeStamp: 2060 });
  });

  it('6. gesture mode: 0ms grounded post-release carry, smooth walk-to-run curve, and <=45ms diagonal jump takeoff bridge', () => {
    input.setControlMode('gesture');
    input.clearFrame();

    // Small slide (18px) -> gentle slow walk analog magnitude
    env.firePointer('pointerdown', { pointerId: 20, clientX: 100, clientY: 600, timeStamp: 1000 });
    env.firePointer('pointermove', { pointerId: 20, clientX: 118, clientY: 601, timeStamp: 1120 });
    expect(input.state.right).toBe(true);
    expect(input.state.analogX).toBeGreaterThanOrEqual(0.28);
    expect(input.state.analogX).toBeLessThan(0.5);

    // Full slide (60px) held > 150ms -> full run without false whip
    env.firePointer('pointermove', { pointerId: 20, clientX: 160, clientY: 601, timeStamp: 1260 });
    expect(input.state.right).toBe(true);
    expect(input.state.analogX).toBeCloseTo(1.0, 2);

    // Release thumb -> IMMEDIATE grounded stop (state.left === false && state.right === false, 0ms runaway carry!)
    env.firePointer('pointerup', { pointerId: 20, clientX: 160, clientY: 601, timeStamp: 1320 });
    expect(input.state.left).toBe(false);
    expect(input.state.right).toBe(false);
    expect(input.state.analogX).toBe(0);
    expect(input.justPressed.whip).toBe(false);

    // Diagonal jump-flick release -> bridge is <= 45ms (clears completely after 0.05s update!)
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 21, clientX: 150, clientY: 600, timeStamp: 2000 });
    env.firePointer('pointermove', { pointerId: 21, clientX: 184, clientY: 560, timeStamp: 2050 });
    expect(input.justPressed.jump).toBe(true);
    env.firePointer('pointerup', { pointerId: 21, clientX: 188, clientY: 552, timeStamp: 2060 });
    expect(input._horizCarryRemainingSec).toBeLessThanOrEqual(0.045);
    input.update(0.05);
    expect(input.state.right).toBe(false);
    expect(input.state.left).toBe(false);
  });

  it('7. gesture mode: quick horizontal slash & 2-finger tap fire Tail-Whip while rapid single-taps fire Hydro-Pulse every time', () => {
    input.setControlMode('gesture');
    input.clearFrame();

    // A. Quick Horizontal Whip-Slash (dt <= 125ms, |dx| >= 32px, |vx| >= 720px/s, lifted <= 135ms)
    env.firePointer('pointerdown', { pointerId: 30, clientX: 140, clientY: 540, timeStamp: 1000 });
    env.firePointer('pointermove', { pointerId: 30, clientX: 192, clientY: 544, timeStamp: 1050 });
    env.firePointer('pointerup', { pointerId: 30, clientX: 198, clientY: 545, timeStamp: 1065 });
    expect(input.justPressed.whip).toBe(true);
    expect(input.state.whip).toBe(true);
    expect(input.state.right).toBe(false); // horizontal walk carry cancelled!
    expect(input._lastSlashVfx?.kind).toBe('slash');

    // B. Two-Finger Tap while holding/walking with thumb 1 -> fires Tail-Whip WITHOUT interrupting thumb 1 walk!
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 31, clientX: 100, clientY: 620, timeStamp: 2000 });
    env.firePointer('pointermove', { pointerId: 31, clientX: 155, clientY: 620, timeStamp: 2150 });
    expect(input.state.right).toBe(true);

    env.firePointer('pointerdown', { pointerId: 32, clientX: 310, clientY: 580, timeStamp: 2200 });
    env.firePointer('pointerup', { pointerId: 32, clientX: 313, clientY: 582, timeStamp: 2270 });
    expect(input.justPressed.whip).toBe(true);
    expect(input.state.right).toBe(true); // thumb 1 walk uninterrupted!
    expect(input._lastSlashVfx?.kind).toBe('ring');
    env.firePointer('pointerup', { pointerId: 31, clientX: 155, clientY: 620, timeStamp: 2400 });
    expect(input.state.right).toBe(false);

    // C. Rapid Single-Taps (5 rapid taps in a row) -> fire Hydro-Pulse EVERY SINGLE TIME with 0 false whip!
    let ts = 3000;
    for (let i = 0; i < 5; i++) {
      input.clearFrame();
      env.firePointer('pointerdown', { pointerId: 40 + i, clientX: 220, clientY: 560, timeStamp: ts });
      env.firePointer('pointerup', { pointerId: 40 + i, clientX: 223, clientY: 562, timeStamp: ts + 45 });
      expect(input.justPressed.fire).toBe(true);
      expect(input.justPressed.whip).toBe(false);
      ts += 95;
    }

    // D. Simultaneous 2-finger tap (both fingers down & up quickly) -> fires exactly 1 whip and 0 stray Hydro-Pulses
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 50, clientX: 140, clientY: 550, timeStamp: 4000 });
    env.firePointer('pointerdown', { pointerId: 51, clientX: 280, clientY: 550, timeStamp: 4015 });
    env.firePointer('pointerup', { pointerId: 50, clientX: 142, clientY: 551, timeStamp: 4070 });
    expect(input.justPressed.whip).toBe(true);
    expect(input.justPressed.fire).toBe(false);
    input.clearFrame();
    env.firePointer('pointerup', { pointerId: 51, clientX: 281, clientY: 552, timeStamp: 4085 });
    expect(input.justPressed.whip).toBe(false);
    expect(input.justPressed.fire).toBe(false);
  });

  it('8. tilt mode: horizontal slash re-arms on reversal, context center tap interacts, downward slide crouches, and non-tilt ignores devicemotion', () => {
    input.setControlMode('tilt');
    input.clearFrame();

    // Slash right -> whip; reverse left >= 18px & slash left -> second whip!
    env.firePointer('pointerdown', { pointerId: 60, clientX: 160, clientY: 500, timeStamp: 1000 });
    env.firePointer('pointermove', { pointerId: 60, clientX: 205, clientY: 502, timeStamp: 1040 });
    expect(input.justPressed.whip).toBe(true);
    input.clearFrame();
    // Moving further right while latched does NOT spam
    env.firePointer('pointermove', { pointerId: 60, clientX: 225, clientY: 502, timeStamp: 1080 });
    expect(input.justPressed.whip).toBe(false);
    // Reversing >= 18px re-arms, then fast left slash triggers 2nd whip
    env.firePointer('pointermove', { pointerId: 60, clientX: 200, clientY: 502, timeStamp: 1120 });
    env.firePointer('pointermove', { pointerId: 60, clientX: 162, clientY: 503, timeStamp: 1160 });
    expect(input.justPressed.whip).toBe(true);
    env.firePointer('pointerup', { pointerId: 60, clientX: 162, clientY: 503, timeStamp: 1180 });

    // Center tap at doorway context -> triggers interact (up), not fire
    input.clearFrame();
    input.setInteractContext(true, 'door');
    env.firePointer('pointerdown', { pointerId: 61, clientX: 215, clientY: 466, timeStamp: 2000 });
    env.firePointer('pointerup', { pointerId: 61, clientX: 216, clientY: 467, timeStamp: 2050 });
    expect(input.justPressed.up).toBe(true);
    expect(input.justPressed.fire).toBe(false);
    input.setInteractContext(false, '');

    // Downward slide -> state.down = true
    input.clearFrame();
    env.firePointer('pointerdown', { pointerId: 62, clientX: 215, clientY: 466, timeStamp: 2500 });
    env.firePointer('pointermove', { pointerId: 62, clientX: 215, clientY: 506, timeStamp: 2590 });
    expect(input.state.down).toBe(true);
    env.firePointer('pointerup', { pointerId: 62, clientX: 215, clientY: 506, timeStamp: 2630 });

    // Non-tilt modes NEVER fire motion whip
    for (const m of ['gesture', 'dpad', 'joystick']) {
      input.setControlMode(m);
      input.clearFrame();
      expect(input._handleDeviceMotionSample({ ax: 16, ay: 4, nowMs: 5000 })).toBe(false);
      expect(input.justPressed.whip).toBe(false);
    }
  });

  it('9. Aqua water-arc slash ribbon VFX renders safely for slash, wrist & ring kinds and auto-stops after 220ms', () => {
    const strokes = [];
    const mockCtx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(() => strokes.push(1)),
      fill: vi.fn(),
      lineCap: '',
      lineJoin: '',
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
    };
    env.elements.slashCanvas.getContext = () => mockCtx;

    const rafCallbacks = [];
    globalThis.requestAnimationFrame = (cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };

    input._spawnSlashVfx({ kind: 'slash', x1: 100, y1: 400, x2: 200, y2: 405, dir: 1 });
    input._spawnSlashVfx({ kind: 'wrist', dir: -1 });
    input._spawnSlashVfx({ kind: 'ring', x1: 200, y1: 500, dir: 1 });
    expect(rafCallbacks.length).toBeGreaterThan(0);

    // Run one render tick -> draws ribbons cleanly
    const cb = rafCallbacks.shift();
    cb();
    expect(strokes.length).toBeGreaterThanOrEqual(5);

    // Expire arcs past 220ms -> render clears canvas and stops scheduling rAF
    input._slashArcs.forEach((a) => {
      a.startMs -= 300;
    });
    const beforeCount = rafCallbacks.length;
    input._renderSlashVfx();
    expect(input._slashArcs.length).toBe(0);
    expect(rafCallbacks.length).toBe(beforeCount);
  });
});
