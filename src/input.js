// Tower Toppler '26 — 4-Mode Concise Touch, Tilt & Keyboard Controller
// Leaf module: zero internal src/ imports.

export const CONTROL_MODES = ['gesture', 'joystick', 'dpad', 'tilt'];

// Strict Gesture Tuning Constants (60Hz Chromium Playtest Calibrated — G01..G32)
const GESTURE_HORIZ_DEADZONE_PX = 15;
const GESTURE_SECONDARY_HORIZ_DEADZONE_PX = 22;
const GESTURE_HORIZ_FULL_SPAN_PX = 42;
const GESTURE_HORIZ_MAX_LEASH_PX = 56;
const GESTURE_REVERSAL_PX = 12;
// Natural human thumb horizontal sweep arcs ±25° (~tan 25.2° = 0.47)
const GESTURE_HORIZ_ARC_SLOPE = 0.47;

const GESTURE_SLIDE_UP_PX = -26;
const GESTURE_SLIDE_UP_MAX_SPEED = 290; // px/s (cleanly separates 220ms doorway slides from 80ms flicks)
const GESTURE_SLIDE_UP_HOLD_MS = 135;
const GESTURE_SLIDE_DOWN_PX = 26;
const GESTURE_VERT_RELEASE_PX = 14;
const GESTURE_VERT_REVERSAL_PX = 18;
const GESTURE_VERT_MAX_LEASH_PX = 60;
const GESTURE_VERT_DOMINANCE = 1.12; // |dy| must exceed |dx_vert| * 1.12 (>48°) to engage up/down

// Standstill upward flick thresholds
const GESTURE_FLICK_DY_PX = -20;
const GESTURE_FLICK_MAX_MS = 115;
const GESTURE_FLICK_VELOCITY_Y = -340; // px/s (upward is negative)

// Running / diagonal upward flick thresholds (e.g. dx=+25..35, dy=-35..-45 in 80..85ms mid-run gap leap)
const GESTURE_RUN_FLICK_DY_PX = -22;
const GESTURE_RUN_FLICK_MAX_MS = 130;
const GESTURE_RUN_FLICK_VELOCITY_Y = -310; // px/s
const GESTURE_RUN_FLICK_MIN_SLOPE = 0.53; // >= 28° upward elevation

// Full-apex jump hold & ballistic horizontal carry across chasms
const GESTURE_FLICK_HOLD_MS = 290;
const GESTURE_FULL_FLICK_DY_PX = -28;
const GESTURE_FULL_FLICK_PULSE_MS = 315;
const GESTURE_HORIZ_CARRY_MS = 260;
const GESTURE_FLICK_REARM_PX = 14;
const GESTURE_FLICK_REARM_MS = 150;

// Capacitive glass quick-tap tolerances (absorbs 6-15px thumb-pad roll jitter cleanly)
const GESTURE_TAP_MAX_MS = 210;
const GESTURE_TAP_MAX_MOVE_PX = 16;
const GESTURE_FIRE_PULSE_MS = 110;

// Tilt Constants
const TILT_DEADZONE_DEG = 2.5;
const TILT_BASE_FULL_DEG = 16.0;
const TILT_EMA_ALPHA = 0.55;

export class InputController {
  /** @param {{ mode?: string, controlMode?: string, hapticsEnabled?: boolean, tiltSensitivity?: number }} [options] */
  constructor(options = {}) {
    this.state = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      fire: false,
      analogX: 0,
      analogY: 0,
    };

    this.justPressed = {
      up: false,
      down: false,
      jump: false,
      fire: false,
    };

    this.hapticsEnabled = options.hapticsEnabled !== undefined ? Boolean(options.hapticsEnabled) : true;
    this.tiltSensitivity = 1.0;
    if (options.tiltSensitivity !== undefined) {
      this.setTiltSensitivity(options.tiltSensitivity);
    }

    this.tiltSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    this.tiltPermissionGranted = Boolean(
      this.tiltSupported &&
      typeof window.DeviceOrientationEvent?.requestPermission !== 'function'
    );
    this.tiltNeutralGamma = 0;

    // Internal Tilt Tracking
    this._tiltListenerAttached = false;
    this._hasTiltSample = false;
    this._lastRawRoll = 0;
    this._smoothedRoll = 0;
    this._tiltLeft = false;
    this._tiltRight = false;
    this._tiltAnalogX = 0;
    this._lastCalibrateMs = -1000;

    // Internal Multi-Source Input Tracking
    this._activePointers = new Map();
    this._heldKeys = new Set();
    this._firePulseActive = false;
    this._firePulseTimer = null;
    this._jumpPulseActive = false;
    this._jumpPulseTimer = null;
    this._horizCarryDir = 0;
    this._horizCarryAnalogX = 0;
    this._horizCarryTimer = null;
    this._puckCenteredCache = new WeakMap();

    this._initializedMode = false;
    this.controlMode = 'gesture';
    const initialMode = options.mode || options.controlMode || 'gesture';
    this.setControlMode(initialMode);

    this._bindEvents();
  }

  /** Switches active touch control scheme and sets document.getElementById('app').dataset.controlMode = mode. */
  setControlMode(mode) {
    const validMode = CONTROL_MODES.includes(mode) ? mode : 'gesture';
    const changed = !this._initializedMode || validMode !== this.controlMode;
    this._initializedMode = true;
    if (changed) {
      this.resetState();
    }
    this.controlMode = validMode;

    if (typeof document !== 'undefined') {
      const appEl = document.getElementById('app');
      if (appEl) {
        appEl.dataset.controlMode = validMode;
      }
    }

    if (validMode === 'tilt' && this.tiltSupported && this.tiltPermissionGranted) {
      this._attachTiltListener();
      if (changed) {
        this._updateTiltPuck(0, false);
      }
    }

    return this.controlMode;
  }

  /** Enables/disables haptic vibration pulses. */
  setHapticsEnabled(enabled) {
    this.hapticsEnabled = Boolean(enabled);
    return this.hapticsEnabled;
  }

  /** Sets tilt sensitivity multiplier (0.5 .. 2.0). */
  setTiltSensitivity(mult) {
    const num = Number(mult);
    this.tiltSensitivity = Number.isFinite(num) ? Math.max(0.5, Math.min(2.0, num)) : 1.0;
    if (this.controlMode === 'tilt' && this._hasTiltSample) {
      this._applyTiltRoll(this._lastRawRoll, true);
    }
    return this.tiltSensitivity;
  }

  /** Requests iOS DeviceOrientationEvent permission if required; resolves true when active. */
  async requestTiltPermission() {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      this.tiltSupported = false;
      this.tiltPermissionGranted = false;
      return false;
    }

    this.tiltSupported = true;
    const DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        if (result === 'granted') {
          this.tiltPermissionGranted = true;
          this._attachTiltListener();
          return true;
        }
        this.tiltPermissionGranted = false;
        return false;
      } catch (_) {
        this.tiltPermissionGranted = false;
        return false;
      }
    }

    this.tiltPermissionGranted = true;
    this._attachTiltListener();
    return true;
  }

  /** Captures current device roll angle as neutral 0° reference and returns it. */
  calibrateTilt() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.tiltNeutralGamma = this._lastRawRoll;
    this._smoothedRoll = 0;
    this._tiltLeft = false;
    this._tiltRight = false;
    this._tiltAnalogX = 0;
    this._updateTiltPuck(0, false);
    this._recomputeState();
    if (now - this._lastCalibrateMs > 60) {
      this._lastCalibrateMs = now;
      this.haptic(10);
    }
    return this.tiltNeutralGamma;
  }

  /** Consumes and resets a single-frame edge trigger ('up' | 'down' | 'jump' | 'fire'). */
  consumeJustPressed(action) {
    if (!(action in this.justPressed)) return false;
    const val = Boolean(this.justPressed[action]);
    this.justPressed[action] = false;
    return val;
  }

  /** Clears all justPressed flags at the end of game.update(dt). */
  clearFrame() {
    this.justPressed.up = false;
    this.justPressed.down = false;
    this.justPressed.jump = false;
    this.justPressed.fire = false;
  }

  /** Clears all held directions/buttons (called on pause / overlay transitions). */
  resetState() {
    if (this._firePulseTimer !== null) {
      clearTimeout(this._firePulseTimer);
      this._firePulseTimer = null;
    }
    if (this._jumpPulseTimer !== null) {
      clearTimeout(this._jumpPulseTimer);
      this._jumpPulseTimer = null;
    }
    this._firePulseActive = false;
    this._jumpPulseActive = false;
    this._clearHorizCarry();

    for (const entry of this._activePointers.values()) {
      this._cleanupPointerTimers(entry);
      if (entry.el) entry.el.classList.remove('active');
      if (entry.zoneEl) entry.zoneEl.classList.remove('active');
      if (entry.dpadEl) entry.dpadEl.classList.remove('active');
    }
    this._activePointers.clear();
    this._heldKeys.clear();

    this._tiltLeft = false;
    this._tiltRight = false;
    this._tiltAnalogX = 0;

    if (typeof document !== 'undefined') {
      document
        .querySelectorAll(
          '.dpad-btn.active, #btn-jump.active, #btn-fire.active, #dpad.active, #joystick-zone.active, #joystick-puck.active, #tilt-bar.active, #tilt-puck.active'
        )
        .forEach((el) => el.classList.remove('active'));
      this._setPuckOffset(document.getElementById('dpad-puck'), 0, 0);
      this._setPuckOffset(document.getElementById('joystick-puck'), 0, 0);
      this._updateTiltPuck(0, false);
    }

    this.state.left = false;
    this.state.right = false;
    this.state.up = false;
    this.state.down = false;
    this.state.jump = false;
    this.state.fire = false;
    this.state.analogX = 0;
    this.state.analogY = 0;

    this.clearFrame();
  }

  /** Triggers subtle mobile vibration if hapticsEnabled is true. */
  haptic(pattern = 12) {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  // ===========================================================================
  // Internal State Aggregation & Pulse / Carry Helpers
  // ===========================================================================

  _hasPointerOfType(type) {
    for (const entry of this._activePointers.values()) {
      if (entry.type === type) return true;
    }
    return false;
  }

  _hasOtherGestureHorizPointer(excludeEntry) {
    for (const entry of this._activePointers.values()) {
      if (entry !== excludeEntry && entry.type === 'gesture' && entry.horizDir !== 0) {
        return true;
      }
    }
    return false;
  }

  _latchHorizCarry(dir, analogX, durationMs = GESTURE_HORIZ_CARRY_MS) {
    this._clearHorizCarry();
    this._horizCarryDir = dir;
    this._horizCarryAnalogX = analogX;
    this._horizCarryTimer = setTimeout(() => {
      this._horizCarryTimer = null;
      this._horizCarryDir = 0;
      this._horizCarryAnalogX = 0;
      this._recomputeState(true);
    }, durationMs);
  }

  _clearHorizCarry() {
    if (this._horizCarryTimer !== null) {
      clearTimeout(this._horizCarryTimer);
      this._horizCarryTimer = null;
    }
    this._horizCarryDir = 0;
    this._horizCarryAnalogX = 0;
  }

  _cancelJumpPulse() {
    if (this._jumpPulseTimer !== null) {
      clearTimeout(this._jumpPulseTimer);
      this._jumpPulseTimer = null;
    }
    this._jumpPulseActive = false;
  }

  _recomputeState(suppressEdgeHaptic = false) {
    let left = this._heldKeys.has('left');
    let right = this._heldKeys.has('right');
    let up = this._heldKeys.has('up');
    let down = this._heldKeys.has('down');
    let jump = this._heldKeys.has('jump') || this._jumpPulseActive;
    let fire = this._heldKeys.has('fire') || this._firePulseActive;

    let analogX = (right ? 1 : 0) - (left ? 1 : 0);
    let analogY = (down ? 1 : 0) - (up ? 1 : 0);

    for (const entry of this._activePointers.values()) {
      if (entry.type === 'button') {
        if (entry.action === 'jump') jump = true;
        else if (entry.action === 'fire') fire = true;
      } else if (entry.type === 'dpad') {
        if (entry.dir === 'left') {
          left = true;
          analogX = -1;
        } else if (entry.dir === 'right') {
          right = true;
          analogX = 1;
        } else if (entry.dir === 'up') {
          up = true;
          analogY = -1;
        } else if (entry.dir === 'down') {
          down = true;
          analogY = 1;
        }
      } else if (entry.type === 'joystick') {
        if (entry.left) left = true;
        if (entry.right) right = true;
        if (entry.up) up = true;
        if (entry.down) down = true;
        if (Math.abs(entry.analogX) > Math.abs(analogX)) analogX = entry.analogX;
        if (Math.abs(entry.analogY) > Math.abs(analogY)) analogY = entry.analogY;
      } else if (entry.type === 'gesture') {
        if (entry.left) left = true;
        if (entry.right) right = true;
        if (entry.vertDir === 'up') up = true;
        if (entry.vertDir === 'down') down = true;
        if (entry.jumpHeld) jump = true;
        if (Math.abs(entry.analogX) > Math.abs(analogX)) analogX = entry.analogX;
        if (Math.abs(entry.analogY) > Math.abs(analogY)) analogY = entry.analogY;
      } else if (entry.type === 'tiltTouch' || entry.type === 'rightPad') {
        if (entry.vertDir === 'up') up = true;
        if (entry.vertDir === 'down') down = true;
        if (entry.jumpHeld) jump = true;
        if (Math.abs(entry.analogY) > Math.abs(analogY)) analogY = entry.analogY;
      }
    }

    if (this.controlMode === 'tilt' && !left && !right) {
      if (this._tiltLeft) left = true;
      if (this._tiltRight) right = true;
      if (Math.abs(this._tiltAnalogX) > Math.abs(analogX)) {
        analogX = this._tiltAnalogX;
      }
    }

    // Apply ballistic horizontal carry after running-flick thumb lift when no active X source overrides
    if (!left && !right && this._horizCarryDir !== 0) {
      if (this._horizCarryDir < 0) left = true;
      else if (this._horizCarryDir > 0) right = true;
      analogX = this._horizCarryAnalogX;
    }

    const prevUp = this.state.up;
    const prevDown = this.state.down;
    const prevJump = this.state.jump;
    const prevFire = this.state.fire;

    this.state.left = left;
    this.state.right = right;
    this.state.up = up;
    this.state.down = down;
    this.state.jump = jump;
    this.state.fire = fire;
    this.state.analogX = Math.max(-1, Math.min(1, analogX));
    this.state.analogY = Math.max(-1, Math.min(1, analogY));

    if (up && !prevUp) {
      this.justPressed.up = true;
      if (!suppressEdgeHaptic) this.haptic(8);
    }
    if (down && !prevDown) {
      this.justPressed.down = true;
      if (!suppressEdgeHaptic) this.haptic(8);
    }
    if (jump && !prevJump) {
      this.justPressed.jump = true;
      if (!suppressEdgeHaptic) this.haptic(14);
    }
    if (fire && !prevFire) {
      this.justPressed.fire = true;
      if (!suppressEdgeHaptic) this.haptic(12);
    }
  }

  _triggerFirePulse(durationMs = GESTURE_FIRE_PULSE_MS) {
    if (this._firePulseTimer !== null) {
      clearTimeout(this._firePulseTimer);
    }
    this._firePulseActive = true;
    this.justPressed.fire = true;
    this.haptic(12);
    this._recomputeState(true);

    this._firePulseTimer = setTimeout(() => {
      this._firePulseTimer = null;
      this._firePulseActive = false;
      this._recomputeState(true);
    }, durationMs);
  }

  _triggerJumpPulse(durationMs = GESTURE_FULL_FLICK_PULSE_MS) {
    if (this._jumpPulseTimer !== null) {
      clearTimeout(this._jumpPulseTimer);
    }
    this._jumpPulseActive = true;
    this.justPressed.jump = true;
    this.haptic(14);
    this._recomputeState(true);

    this._jumpPulseTimer = setTimeout(() => {
      this._jumpPulseTimer = null;
      this._jumpPulseActive = false;
      this._recomputeState(true);
    }, durationMs);
  }

  _cleanupPointerTimers(entry) {
    if (!entry) return;
    if (entry.jumpTimer !== undefined && entry.jumpTimer !== null) {
      clearTimeout(entry.jumpTimer);
      entry.jumpTimer = null;
    }
    if (entry.upHoldTimer !== undefined && entry.upHoldTimer !== null) {
      clearTimeout(entry.upHoldTimer);
      entry.upHoldTimer = null;
    }
  }

  // ===========================================================================
  // Timestamp & Visual Puck Helpers
  // ===========================================================================

  _resolveTimestampMs(e, entry = null) {
    const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const hasEvtTs = e && typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp);
    if (!entry) {
      return {
        now: hasEvtTs ? e.timeStamp : perfNow,
        startEventTs: hasEvtTs ? e.timeStamp : null,
        startPerfTs: perfNow,
      };
    }
    if (hasEvtTs && entry.startEventTs !== null) {
      const dtEvt = e.timeStamp - entry.startEventTs;
      const dtPerf = perfNow - entry.startPerfTs;
      if (dtEvt > 0 || dtPerf <= 0) {
        return entry.startTime + Math.max(0, dtEvt);
      }
      return entry.startTime + Math.max(0, dtPerf);
    }
    return entry.startTime + Math.max(0, perfNow - entry.startPerfTs);
  }

  _setPuckOffset(puckEl, px, py) {
    if (!puckEl) return;
    if (!this._puckCenteredCache.has(puckEl) && typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const cs = window.getComputedStyle(puckEl);
        const usesAbsolutePercentCenter =
          cs.position === 'absolute' &&
          cs.transform &&
          cs.transform !== 'none' &&
          !puckEl.style.transform;
        this._puckCenteredCache.set(puckEl, Boolean(usesAbsolutePercentCenter));
      } catch (_) {
        this._puckCenteredCache.set(puckEl, false);
      }
    }

    const rx = Number(px).toFixed(1);
    const ry = Number(py).toFixed(1);
    if (this._puckCenteredCache.get(puckEl)) {
      puckEl.style.transform = `translate(calc(-50% + ${rx}px), calc(-50% + ${ry}px))`;
    } else {
      puckEl.style.transform = `translate(${rx}px, ${ry}px)`;
    }
  }

  _updateTiltPuck(normX, isActive) {
    if (typeof document === 'undefined') return;
    const puckEl = document.getElementById('tilt-puck');
    const barEl = document.getElementById('tilt-bar');
    if (barEl) barEl.classList.toggle('active', Boolean(isActive));
    if (!puckEl) return;

    puckEl.classList.toggle('active', Boolean(isActive));
    let maxTravel = 44;
    if (barEl && typeof barEl.getBoundingClientRect === 'function') {
      const rect = barEl.getBoundingClientRect();
      if (rect.width > 24) {
        maxTravel = Math.max(16, (rect.width - 16) * 0.46);
      }
    }
    const clamped = Math.max(-1, Math.min(1, normX || 0));
    this._setPuckOffset(puckEl, clamped * maxTravel, 0);
  }

  // ===========================================================================
  // Direct Action Button Halo & Slide-Press Helper (#btn-fire <-> #btn-jump)
  // ===========================================================================

  _findActionButtonHalo(clientX, clientY, padPx = 10) {
    if (typeof document === 'undefined') return null;
    if (this.controlMode !== 'joystick' && this.controlMode !== 'dpad') return null;

    const candidates = [document.getElementById('btn-jump'), document.getElementById('btn-fire')];
    let bestBtn = null;
    let bestDist = Infinity;

    for (const btn of candidates) {
      if (!btn || typeof btn.getBoundingClientRect !== 'function') continue;
      const r = btn.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      const maxR = Math.max(r.width, r.height) * 0.5 + padPx;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d <= maxR && d < bestDist) {
        bestDist = d;
        bestBtn = btn;
      }
    }
    return bestBtn;
  }

  _updateButtonSlidePointer(entry, clientX, clientY) {
    if (typeof document === 'undefined') return;
    const jumpBtn = document.getElementById('btn-jump');
    const fireBtn = document.getElementById('btn-fire');
    const hitButton = (btn) => {
      if (!btn || typeof btn.getBoundingClientRect !== 'function') return false;
      const r = btn.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const pad = 8;
      return (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      );
    };

    let nextAction = entry.action;
    let nextEl = entry.el;
    if (entry.action === 'fire' && hitButton(jumpBtn)) {
      nextAction = 'jump';
      nextEl = jumpBtn;
    } else if (entry.action === 'jump' && hitButton(fireBtn)) {
      nextAction = 'fire';
      nextEl = fireBtn;
    }

    if (nextAction !== entry.action) {
      if (entry.el) entry.el.classList.remove('active');
      entry.action = nextAction;
      entry.el = nextEl;
      if (entry.el) entry.el.classList.add('active');
      this.justPressed[nextAction] = true;
      this.haptic(nextAction === 'jump' ? 14 : 12);
      this._recomputeState(true);
    }
  }

  // ===========================================================================
  // Mode 1: Strict Tuned Gesture Logic ('gesture')
  // ===========================================================================

  _createGestureEntry(e) {
    const ts = this._resolveTimestampMs(e, null);
    const x = e.clientX;
    const y = e.clientY;
    return {
      type: 'gesture',
      startX: x,
      startY: y,
      startTime: ts.now,
      startEventTs: ts.startEventTs,
      startPerfTs: ts.startPerfTs,
      lastX: x,
      lastY: y,
      maxDist: 0,

      // Horizontal dynamic anchor state
      anchorX: x,
      extremeX: x,
      horizDir: 0,
      left: false,
      right: false,
      analogX: 0,

      // Vertical & Flick state
      anchorY: y,
      extremeY: y,
      vertOnsetX: x,
      upOnsetX: x,
      upOnsetY: y,
      upOnsetTime: ts.now,
      vertDir: null, // null | 'up' | 'down'
      analogY: 0,
      flickLatched: false,
      flickPeakY: y,
      flickLatchTime: 0,
      jumpHeld: false,
      jumpTimer: null,
      upHoldTimer: null,

      samples: [{ x, y, t: ts.now }],
    };
  }

  _updateGesturePointer(entry, e) {
    const now = this._resolveTimestampMs(e, entry);
    const x = e.clientX;
    const y = e.clientY;
    const dxStep = x - entry.lastX;
    const dyStep = y - entry.lastY;

    entry.lastX = x;
    entry.lastY = y;
    const distFromStart = Math.hypot(x - entry.startX, y - entry.startY);
    if (distFromStart > entry.maxDist) {
      entry.maxDist = distFromStart;
    }

    // Maintain short rolling velocity window (~130ms)
    entry.samples.push({ x, y, t: now });
    while (entry.samples.length > 10 || (entry.samples.length > 2 && now - entry.samples[0].t > 130)) {
      entry.samples.shift();
    }

    // -------------------------------------------------------------------------
    // 1. Horizontal Drag with Dynamic Reversal Re-Anchoring
    //    - 15px deadzone prevents 6-14.5px backward finger-peel taps from flipping p.facing
    //    - 22px secondary deadzone prevents right-thumb taps from overriding left-thumb walk
    //    - Suppresses reversal during steep vertical strokes so upward flick hooks keep momentum
    // -------------------------------------------------------------------------
    const activeHorizDeadzone =
      entry.horizDir === 0 && this._hasOtherGestureHorizPointer(entry)
        ? GESTURE_SECONDARY_HORIZ_DEADZONE_PX
        : GESTURE_HORIZ_DEADZONE_PX;

    let dx = x - entry.anchorX;
    const isSteepVertStep = Math.abs(dyStep) > Math.abs(dxStep) * 1.35 && Math.abs(dyStep) > 3;

    if (entry.horizDir === 1 || dx > activeHorizDeadzone) {
      if (x > entry.extremeX) entry.extremeX = x;
      if (!isSteepVertStep && entry.extremeX - x > GESTURE_REVERSAL_PX) {
        // Instant leftward reversal past deadzone!
        entry.anchorX = x + (activeHorizDeadzone + 3);
        entry.extremeX = x;
        entry.horizDir = -1;
        dx = x - entry.anchorX;
      } else if (dx > GESTURE_HORIZ_MAX_LEASH_PX) {
        entry.anchorX = x - GESTURE_HORIZ_MAX_LEASH_PX;
        dx = GESTURE_HORIZ_MAX_LEASH_PX;
      }
    } else if (entry.horizDir === -1 || dx < -activeHorizDeadzone) {
      if (x < entry.extremeX) entry.extremeX = x;
      if (!isSteepVertStep && x - entry.extremeX > GESTURE_REVERSAL_PX) {
        // Instant rightward reversal past deadzone!
        entry.anchorX = x - (activeHorizDeadzone + 3);
        entry.extremeX = x;
        entry.horizDir = 1;
        dx = x - entry.anchorX;
      } else if (dx < -GESTURE_HORIZ_MAX_LEASH_PX) {
        entry.anchorX = x + GESTURE_HORIZ_MAX_LEASH_PX;
        dx = -GESTURE_HORIZ_MAX_LEASH_PX;
      }
    }

    if (Math.abs(dx) > activeHorizDeadzone) {
      this._clearHorizCarry();
      entry.horizDir = dx < 0 ? -1 : 1;
      const rawMag = Math.min(1, (Math.abs(dx) - activeHorizDeadzone) / GESTURE_HORIZ_FULL_SPAN_PX);
      const mag = 0.28 + 0.72 * rawMag;
      entry.analogX = entry.horizDir * mag;
      entry.left = entry.horizDir < 0;
      entry.right = entry.horizDir > 0;
    } else {
      entry.horizDir = 0;
      entry.extremeX = x;
      entry.analogX = 0;
      entry.left = false;
      entry.right = false;
    }

    // -------------------------------------------------------------------------
    // 2. Natural Thumb-Arc Tracking, Consecutive Hurdle Re-Arm & Upward Onset
    // -------------------------------------------------------------------------
    if (entry.flickLatched) {
      if (y < entry.flickPeakY) {
        entry.flickPeakY = y;
      }
      if (
        y - entry.flickPeakY >= GESTURE_FLICK_REARM_PX ||
        (now - entry.flickLatchTime >= GESTURE_FLICK_REARM_MS && dyStep >= -0.8)
      ) {
        // Re-arm upward gesture cleanly for consecutive mid-walk hurdles!
        entry.flickLatched = false;
        entry.anchorY = y;
        entry.extremeY = y;
        entry.vertOnsetX = x;
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
    } else if (entry.vertDir === null) {
      // Only glide Y baseline along shallow horizontal arc once genuinely walking horizontally,
      // so ±2.4px X-jitter while standing at a doorway never wipes anchorY!
      const isCommittedWalk =
        entry.horizDir !== 0 || Math.abs(x - entry.startX) > GESTURE_HORIZ_DEADZONE_PX;
      const isShallowHorizDrift =
        isCommittedWalk &&
        Math.abs(dxStep) > 1.2 &&
        Math.abs(dyStep) <= Math.abs(dxStep) * GESTURE_HORIZ_ARC_SLOPE;

      if (isShallowHorizDrift) {
        entry.anchorY = y;
        entry.extremeY = y;
        entry.vertOnsetX = x;
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      } else if (y > entry.upOnsetY) {
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
        // Only recover anchorY back up toward startY if previously pulled above startY;
        // NEVER chase y below startY so slow 60Hz downward slides (+2.5px/frame) accumulate!
        if (entry.anchorY < entry.startY) {
          entry.anchorY = Math.min(y, entry.startY);
          entry.vertOnsetX = x;
        }
      } else if (entry.upOnsetY - y < 5 && now - entry.upOnsetTime > 95) {
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
    }

    // Compute instantaneous/windowed velocity (px/s)
    const { vx, vy } = this._computeGestureVelocity(entry, x, y, now);
    const dxUp = x - entry.upOnsetX;
    const dyUp = y - entry.upOnsetY;
    const dtUpMs = Math.max(0, now - entry.upOnsetTime);

    // -------------------------------------------------------------------------
    // 3. Fast Upward FLICK -> Jump ONLY (Standstill OR Running Diagonal Flick!)
    // -------------------------------------------------------------------------
    const isRunningStroke = entry.horizDir !== 0 || Math.abs(dxUp) >= 14;
    const standstillFlick =
      !isRunningStroke &&
      dyUp <= GESTURE_FLICK_DY_PX &&
      dtUpMs <= GESTURE_FLICK_MAX_MS &&
      vy <= GESTURE_FLICK_VELOCITY_Y &&
      Math.abs(vy) > Math.abs(vx) * 0.85;

    const runningDiagFlick =
      isRunningStroke &&
      dyUp <= GESTURE_RUN_FLICK_DY_PX &&
      dtUpMs <= GESTURE_RUN_FLICK_MAX_MS &&
      vy <= GESTURE_RUN_FLICK_VELOCITY_Y &&
      Math.abs(vy) >= Math.abs(vx) * GESTURE_RUN_FLICK_MIN_SLOPE &&
      Math.abs(dyUp) >= Math.abs(dxUp) * GESTURE_RUN_FLICK_MIN_SLOPE;

    if (!entry.flickLatched && entry.vertDir !== 'up' && (standstillFlick || runningDiagFlick)) {
      if (entry.upHoldTimer !== null) {
        clearTimeout(entry.upHoldTimer);
        entry.upHoldTimer = null;
      }
      if (entry.jumpTimer !== null) {
        clearTimeout(entry.jumpTimer);
      }

      entry.flickLatched = true;
      entry.flickPeakY = y;
      entry.flickLatchTime = now;
      entry.vertDir = null;
      entry.analogY = 0;
      entry.jumpHeld = true;

      if (runningDiagFlick || dyUp <= GESTURE_FULL_FLICK_DY_PX) {
        this._triggerJumpPulse(GESTURE_FULL_FLICK_PULSE_MS);
      } else {
        this.justPressed.jump = true;
        this.haptic(14);
        this._recomputeState(true);
      }

      entry.jumpTimer = setTimeout(() => {
        entry.jumpTimer = null;
        entry.jumpHeld = false;
        this._recomputeState(true);
      }, GESTURE_FLICK_HOLD_MS);
      return;
    }

    // -------------------------------------------------------------------------
    // 4. Controlled Slide UP / DOWN -> Doors, Lifts, Sub & Glide ONLY (NEVER jumps!)
    // -------------------------------------------------------------------------
    if (!entry.flickLatched) {
      let dy = y - entry.anchorY;

      // Dynamic vertical reversal re-anchoring once UP or DOWN is engaged
      if (entry.vertDir === 'up') {
        if (y < entry.extremeY) entry.extremeY = y;
        if (y - entry.extremeY > GESTURE_VERT_REVERSAL_PX) {
          entry.anchorY = entry.extremeY + 4;
          entry.extremeY = y;
          entry.vertOnsetX = x;
          dy = y - entry.anchorY;
        }
      } else if (entry.vertDir === 'down') {
        if (y > entry.extremeY) entry.extremeY = y;
        if (entry.extremeY - y > GESTURE_VERT_REVERSAL_PX) {
          entry.anchorY = entry.extremeY - 4;
          entry.extremeY = y;
          entry.vertOnsetX = x;
          dy = y - entry.anchorY;
        }
      }

      const dxVert = Math.abs(x - entry.vertOnsetX);
      const isVertDominant = Math.abs(dy) >= dxVert * GESTURE_VERT_DOMINANCE;

      if (dy <= GESTURE_SLIDE_UP_PX && (entry.vertDir === 'up' || isVertDominant)) {
        const upwardSpeed = Math.max(0, -vy);
        if (
          entry.vertDir === 'up' ||
          upwardSpeed < GESTURE_SLIDE_UP_MAX_SPEED ||
          dtUpMs >= GESTURE_SLIDE_UP_HOLD_MS
        ) {
          if (entry.upHoldTimer !== null) {
            clearTimeout(entry.upHoldTimer);
            entry.upHoldTimer = null;
          }
          this._clearHorizCarry();
          if (entry.vertDir !== 'up') {
            entry.extremeY = y;
          }
          entry.vertDir = 'up';
          if (dy < -GESTURE_VERT_MAX_LEASH_PX) {
            entry.anchorY = y + GESTURE_VERT_MAX_LEASH_PX;
            dy = -GESTURE_VERT_MAX_LEASH_PX;
          }
          entry.analogY = -Math.min(1, Math.max(0.35, (Math.abs(dy) - 20) / 36));
        } else if (entry.upHoldTimer === null) {
          const remainingMs = Math.max(10, GESTURE_SLIDE_UP_HOLD_MS - dtUpMs);
          entry.upHoldTimer = setTimeout(() => {
            entry.upHoldTimer = null;
            if (!entry.flickLatched && entry.lastY - entry.anchorY <= GESTURE_SLIDE_UP_PX) {
              this._clearHorizCarry();
              entry.vertDir = 'up';
              entry.extremeY = entry.lastY;
              entry.analogY = -Math.min(
                1,
                Math.max(0.35, (Math.abs(entry.lastY - entry.anchorY) - 20) / 36)
              );
              this._recomputeState();
            }
          }, remainingMs);
        }
      } else if (dy >= GESTURE_SLIDE_DOWN_PX && (entry.vertDir === 'down' || isVertDominant)) {
        if (entry.upHoldTimer !== null) {
          clearTimeout(entry.upHoldTimer);
          entry.upHoldTimer = null;
        }
        this._clearHorizCarry();
        this._cancelJumpPulse();
        if (entry.vertDir !== 'down') {
          entry.extremeY = y;
        }
        entry.vertDir = 'down';
        if (dy > GESTURE_VERT_MAX_LEASH_PX) {
          entry.anchorY = y - GESTURE_VERT_MAX_LEASH_PX;
          dy = GESTURE_VERT_MAX_LEASH_PX;
        }
        entry.analogY = Math.min(1, Math.max(0.35, (dy - 20) / 36));
      } else if (dy > -GESTURE_VERT_RELEASE_PX && dy < GESTURE_VERT_RELEASE_PX) {
        if (entry.upHoldTimer !== null) {
          clearTimeout(entry.upHoldTimer);
          entry.upHoldTimer = null;
        }
        entry.vertDir = null;
        entry.extremeY = y;
        entry.vertOnsetX = x;
        entry.analogY = 0;
      }
    }

    this._recomputeState();
  }

  _computeGestureVelocity(entry, x, y, now) {
    const dtOnsetSec = Math.max(1, now - entry.upOnsetTime) / 1000;
    const vyChord = (y - entry.upOnsetY) / dtOnsetSec;
    const vxChord = (x - entry.upOnsetX) / dtOnsetSec;

    let ref = null;
    for (let i = entry.samples.length - 2; i >= 0; i--) {
      const s = entry.samples[i];
      const dt = now - s.t;
      if (dt >= 16 && (Math.abs(y - s.y) >= 14 || dt >= 28)) {
        ref = s;
        if (dt >= 34) break;
      }
    }

    if (!ref) {
      return { vx: vxChord, vy: vyChord };
    }

    const dtWinSec = Math.max(0.001, (now - ref.t) / 1000);
    const vyWin = (y - ref.y) / dtWinSec;
    const vxWin = (x - ref.x) / dtWinSec;

    if (vyWin < vyChord) {
      return { vx: vxWin, vy: vyWin };
    }
    return { vx: vxChord, vy: vyChord };
  }

  _finishGesturePointer(entry, e, isCancel) {
    const now = this._resolveTimestampMs(e, entry);
    if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      const finalDist = Math.hypot(e.clientX - entry.startX, e.clientY - entry.startY);
      if (finalDist > entry.maxDist) entry.maxDist = finalDist;
    }
    const duration = Math.max(0, now - entry.startTime);

    this._cleanupPointerTimers(entry);
    entry.jumpHeld = false;

    // Sustain ballistic horizontal momentum when thumb lifts off at the peak of a running flick!
    if (!isCancel && entry.flickLatched && entry.horizDir !== 0) {
      this._latchHorizCarry(entry.horizDir, entry.analogX, GESTURE_HORIZ_CARRY_MS);
      return;
    }

    // 5. Quick Stationary TAP (tolerates 6-16px capacitive glass wobble) -> 110ms Fire Pulse
    if (
      !isCancel &&
      !entry.flickLatched &&
      entry.vertDir === null &&
      duration <= GESTURE_TAP_MAX_MS &&
      entry.maxDist <= GESTURE_TAP_MAX_MOVE_PX
    ) {
      this._clearHorizCarry();
      this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
    }
  }

  // ===========================================================================
  // Mode 2: Virtual Joystick Logic ('joystick')
  // ===========================================================================

  _createJoystickEntry(e, zoneEl, isFloating = false) {
    let originX = e.clientX;
    let originY = e.clientY;
    let maxRadius = 48;

    if (zoneEl && !isFloating && typeof zoneEl.getBoundingClientRect === 'function') {
      const rect = zoneEl.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        originX = rect.left + rect.width * 0.5;
        originY = rect.top + rect.height * 0.5;
        maxRadius = Math.max(32, Math.min(54, Math.min(rect.width, rect.height) * 0.38));
      }
    }

    if (zoneEl) zoneEl.classList.add('active');
    const puckEl = typeof document !== 'undefined' ? document.getElementById('joystick-puck') : null;
    if (puckEl) puckEl.classList.add('active');

    const entry = {
      type: 'joystick',
      zoneEl,
      puckEl,
      originX,
      originY,
      maxRadius,
      left: false,
      right: false,
      up: false,
      down: false,
      analogX: 0,
      analogY: 0,
    };
    this._updateJoystickPointer(entry, e.clientX, e.clientY, false);
    return entry;
  }

  _updateJoystickPointer(entry, clientX, clientY, recompute = true) {
    const dx = clientX - entry.originX;
    const dy = clientY - entry.originY;
    const dist = Math.hypot(dx, dy);
    const maxR = entry.maxRadius;

    let px = dx;
    let py = dy;
    if (dist > maxR && dist > 0) {
      const scale = maxR / dist;
      px = dx * scale;
      py = dy * scale;
    }
    this._setPuckOffset(entry.puckEl, px, py);

    // Radially clamped normalized vector prevents extended -18° walk drags from spiking ny!
    const nx = px / maxR;
    const ny = py / maxR;
    const deadzone = 0.16;

    if (Math.abs(nx) > deadzone) {
      entry.analogX = Math.sign(nx) * Math.min(1, (Math.abs(nx) - deadzone) / (1 - deadzone));
      entry.left = entry.analogX < -0.02;
      entry.right = entry.analogX > 0.02;
    } else {
      entry.analogX = 0;
      entry.left = false;
      entry.right = false;
    }

    if (Math.abs(ny) > deadzone) {
      entry.analogY = Math.sign(ny) * Math.min(1, (Math.abs(ny) - deadzone) / (1 - deadzone));
    } else {
      entry.analogY = 0;
    }

    // Vertical deflection operates doors & lifts ONLY (with hysteresis + vertical dominance, never jumps)
    const upT = entry.up ? -0.42 : -0.56;
    const dnT = entry.down ? 0.42 : 0.56;
    const vDom = Math.abs(py) >= Math.abs(px) * (entry.up || entry.down ? 0.58 : 0.80);
    entry.up = ny <= upT && vDom;
    entry.down = ny >= dnT && vDom;

    if (recompute) {
      this._recomputeState();
    }
  }

  // ===========================================================================
  // Mode 3: Classic Slide-Between-Directions D-Pad ('dpad')
  // ===========================================================================

  _createDpadEntry(e, dpadEl) {
    if (dpadEl) dpadEl.classList.add('active');
    const puckEl = typeof document !== 'undefined' ? document.getElementById('dpad-puck') : null;
    const entry = {
      type: 'dpad',
      dpadEl,
      puckEl,
      dir: null,
      el: null,
    };

    const targetEl = e.target instanceof Element ? e.target : null;
    const btn = targetEl ? targetEl.closest('.dpad-btn') : null;
    const resolvedDir = this._resolveDpadDir(dpadEl, puckEl, e.clientX, e.clientY, null);
    const initialDir = (btn && btn.dataset?.dir) || resolvedDir;
    this._applyDpadDir(entry, initialDir, false);
    return entry;
  }

  _resolveDpadDir(dpadEl, puckEl, clientX, clientY, currentDir = null) {
    if (!dpadEl || typeof dpadEl.getBoundingClientRect !== 'function') return null;
    const rect = dpadEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const maxR = Math.max(14, Math.min(rect.width, rect.height) * 0.19);
    const dist = Math.hypot(dx, dy);
    let px = dx;
    let py = dy;
    if (dist > maxR && dist > 0) {
      const s = maxR / dist;
      px = dx * s;
      py = dy * s;
    }
    this._setPuckOffset(puckEl, px, py);

    const deadzone = Math.max(10, Math.min(rect.width, rect.height) * 0.11);
    if (dx * dx + dy * dy < deadzone * deadzone) {
      return null;
    }

    // Diagonal hysteresis prevents 43°-47° thumb-roll chatter from dropping walk or misfiring doors
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (currentDir === 'left' || currentDir === 'right') {
      if (adx * 1.30 >= ady) {
        return dx < 0 ? 'left' : 'right';
      }
      return dy < 0 ? 'up' : 'down';
    }
    if (currentDir === 'up' || currentDir === 'down') {
      if (ady * 1.18 >= adx) {
        return dy < 0 ? 'up' : 'down';
      }
      return dx < 0 ? 'left' : 'right';
    }
    if (adx * 1.08 >= ady) {
      return dx < 0 ? 'left' : 'right';
    }
    return dy < 0 ? 'up' : 'down';
  }

  _applyDpadDir(entry, nextDir, recompute = true) {
    if (entry.dir === nextDir) return;
    if (entry.el) entry.el.classList.remove('active');

    entry.dir = nextDir;
    entry.el =
      nextDir && entry.dpadEl
        ? entry.dpadEl.querySelector(`.dpad-btn[data-dir="${nextDir}"]`)
        : null;
    if (entry.el) entry.el.classList.add('active');
    if (recompute) {
      this._recomputeState();
    }
  }

  // ===========================================================================
  // Mode 4: Tilt / Motion Orientation + Tilt/RightPad Touch Actions ('tilt')
  // ===========================================================================

  _attachTiltListener() {
    if (this._tiltListenerAttached || typeof window === 'undefined') return;
    this._tiltListenerAttached = true;
    this._onDeviceOrientation = (e) => {
      const rawRoll = this._extractRollDeg(e);
      if (rawRoll === null) return;
      this._lastRawRoll = rawRoll;
      if (this.controlMode === 'tilt') {
        this._applyTiltRoll(rawRoll, false);
      } else {
        this._hasTiltSample = true;
      }
    };
    window.addEventListener('deviceorientation', this._onDeviceOrientation, { passive: true });
  }

  _extractRollDeg(e) {
    if (!e || typeof e.gamma !== 'number' || Number.isNaN(e.gamma)) {
      return null;
    }
    let angle = 0;
    if (typeof window !== 'undefined') {
      if (window.screen?.orientation && typeof window.screen.orientation.angle === 'number') {
        angle = window.screen.orientation.angle;
      } else if (typeof window.orientation === 'number') {
        angle = window.orientation;
      }
    }

    let roll = e.gamma;
    if (angle === 90 && typeof e.beta === 'number') {
      roll = e.beta;
    } else if ((angle === -90 || angle === 270) && typeof e.beta === 'number') {
      roll = -e.beta;
    } else if (angle === 180) {
      roll = -e.gamma;
    }

    return Math.max(-65, Math.min(65, roll));
  }

  _applyTiltRoll(rawRoll, immediate = false) {
    const delta = rawRoll - this.tiltNeutralGamma;
    if (!this._hasTiltSample || immediate) {
      this._smoothedRoll = delta;
      this._hasTiltSample = true;
    } else {
      this._smoothedRoll += TILT_EMA_ALPHA * (delta - this._smoothedRoll);
    }

    const absRoll = Math.abs(this._smoothedRoll);
    const fullDeg = TILT_BASE_FULL_DEG / this.tiltSensitivity;

    if (absRoll <= TILT_DEADZONE_DEG) {
      this._tiltAnalogX = 0;
      this._tiltLeft = false;
      this._tiltRight = false;
    } else {
      const span = Math.max(2.0, fullDeg - TILT_DEADZONE_DEG);
      const norm = Math.min(1, (absRoll - TILT_DEADZONE_DEG) / span);
      this._tiltAnalogX = Math.sign(this._smoothedRoll) * norm;
      this._tiltLeft = this._tiltAnalogX < -0.04;
      this._tiltRight = this._tiltAnalogX > 0.04;
    }

    const visualNorm = Math.max(-1, Math.min(1, this._smoothedRoll / Math.max(4, fullDeg)));
    this._updateTiltPuck(visualNorm, absRoll > TILT_DEADZONE_DEG);
    this._recomputeState();
  }

  _createTiltTouchEntry(e, entryType = 'tiltTouch') {
    const ts = this._resolveTimestampMs(e, null);
    const x = e.clientX;
    const y = e.clientY;
    return {
      type: entryType,
      startX: x,
      startY: y,
      startTime: ts.now,
      startEventTs: ts.startEventTs,
      startPerfTs: ts.startPerfTs,
      lastX: x,
      lastY: y,
      maxDist: 0,
      anchorY: y,
      extremeY: y,
      upOnsetX: x,
      upOnsetY: y,
      upOnsetTime: ts.now,
      vertDir: null,
      analogY: 0,
      flickLatched: false,
      flickPeakY: y,
      flickLatchTime: 0,
      jumpHeld: false,
      jumpTimer: null,
      upHoldTimer: null,
      samples: [{ x, y, t: ts.now }],
    };
  }

  _updateTiltTouchPointer(entry, e) {
    const now = this._resolveTimestampMs(e, entry);
    const x = e.clientX;
    const y = e.clientY;
    const dyStep = y - entry.lastY;
    entry.lastX = x;
    entry.lastY = y;
    const dist = Math.hypot(x - entry.startX, y - entry.startY);
    if (dist > entry.maxDist) entry.maxDist = dist;

    entry.samples.push({ x, y, t: now });
    while (entry.samples.length > 10 || (entry.samples.length > 2 && now - entry.samples[0].t > 130)) {
      entry.samples.shift();
    }

    // Re-arm after flick & refresh upward onset when thumb rests before flicking
    if (entry.flickLatched) {
      if (y < entry.flickPeakY) entry.flickPeakY = y;
      if (
        y - entry.flickPeakY >= GESTURE_FLICK_REARM_PX ||
        (now - entry.flickLatchTime >= GESTURE_FLICK_REARM_MS && dyStep >= -0.8)
      ) {
        entry.flickLatched = false;
        entry.anchorY = y;
        entry.extremeY = y;
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
    } else if (entry.vertDir === null) {
      if (y > entry.upOnsetY) {
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
        if (entry.anchorY < entry.startY) {
          entry.anchorY = Math.min(y, entry.startY);
        }
      } else if (entry.upOnsetY - y < 5 && now - entry.upOnsetTime > 90) {
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
    }

    const { vx, vy } = this._computeGestureVelocity(entry, x, y, now);
    const dyUp = y - entry.upOnsetY;
    const dtUpMs = Math.max(0, now - entry.upOnsetTime);

    // Fast upward flick -> Jump
    if (
      !entry.flickLatched &&
      entry.vertDir !== 'up' &&
      dyUp <= GESTURE_FLICK_DY_PX &&
      dtUpMs <= GESTURE_FLICK_MAX_MS &&
      vy <= GESTURE_FLICK_VELOCITY_Y &&
      Math.abs(vy) > Math.abs(vx) * 0.65
    ) {
      if (entry.upHoldTimer !== null) {
        clearTimeout(entry.upHoldTimer);
        entry.upHoldTimer = null;
      }
      if (entry.jumpTimer !== null) clearTimeout(entry.jumpTimer);
      entry.flickLatched = true;
      entry.flickPeakY = y;
      entry.flickLatchTime = now;
      entry.vertDir = null;
      entry.analogY = 0;
      entry.jumpHeld = true;
      this._triggerJumpPulse(GESTURE_FULL_FLICK_PULSE_MS);
      entry.jumpTimer = setTimeout(() => {
        entry.jumpTimer = null;
        entry.jumpHeld = false;
        this._recomputeState(true);
      }, GESTURE_FLICK_HOLD_MS);
      return;
    }

    if (entry.type === 'rightPad') {
      this._recomputeState();
      return;
    }

    // Controlled vertical slide -> UP / DOWN (doors, lifts, Sub & Glide) with dynamic Y reversal
    if (!entry.flickLatched) {
      let dy = y - entry.anchorY;
      if (entry.vertDir === 'up') {
        if (y < entry.extremeY) entry.extremeY = y;
        if (y - entry.extremeY > GESTURE_VERT_REVERSAL_PX) {
          entry.anchorY = entry.extremeY + 4;
          entry.extremeY = y;
          dy = y - entry.anchorY;
        }
      } else if (entry.vertDir === 'down') {
        if (y > entry.extremeY) entry.extremeY = y;
        if (entry.extremeY - y > GESTURE_VERT_REVERSAL_PX) {
          entry.anchorY = entry.extremeY - 4;
          entry.extremeY = y;
          dy = y - entry.anchorY;
        }
      }

      if (dy <= GESTURE_SLIDE_UP_PX) {
        const upwardSpeed = Math.max(0, -vy);
        if (
          entry.vertDir === 'up' ||
          upwardSpeed < GESTURE_SLIDE_UP_MAX_SPEED ||
          dtUpMs >= GESTURE_SLIDE_UP_HOLD_MS
        ) {
          if (entry.upHoldTimer !== null) {
            clearTimeout(entry.upHoldTimer);
            entry.upHoldTimer = null;
          }
          if (entry.vertDir !== 'up') entry.extremeY = y;
          entry.vertDir = 'up';
          entry.analogY = -Math.min(1, Math.max(0.35, (Math.abs(dy) - 20) / 36));
        } else if (entry.upHoldTimer === null) {
          const remainingMs = Math.max(10, GESTURE_SLIDE_UP_HOLD_MS - dtUpMs);
          entry.upHoldTimer = setTimeout(() => {
            entry.upHoldTimer = null;
            if (!entry.flickLatched && entry.lastY - entry.anchorY <= GESTURE_SLIDE_UP_PX) {
              entry.vertDir = 'up';
              entry.extremeY = entry.lastY;
              entry.analogY = -0.8;
              this._recomputeState();
            }
          }, remainingMs);
        }
      } else if (dy >= GESTURE_SLIDE_DOWN_PX) {
        if (entry.upHoldTimer !== null) {
          clearTimeout(entry.upHoldTimer);
          entry.upHoldTimer = null;
        }
        this._cancelJumpPulse();
        if (entry.vertDir !== 'down') entry.extremeY = y;
        entry.vertDir = 'down';
        entry.analogY = Math.min(1, Math.max(0.35, (dy - 20) / 36));
      } else if (dy > -GESTURE_VERT_RELEASE_PX && dy < GESTURE_VERT_RELEASE_PX) {
        entry.vertDir = null;
        entry.extremeY = y;
        entry.analogY = 0;
      }
    }

    this._recomputeState();
  }

  _finishTiltTouchPointer(entry, e, isCancel) {
    const now = this._resolveTimestampMs(e, entry);
    if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      const finalDist = Math.hypot(e.clientX - entry.startX, e.clientY - entry.startY);
      if (finalDist > entry.maxDist) entry.maxDist = finalDist;
    }
    const duration = Math.max(0, now - entry.startTime);

    this._cleanupPointerTimers(entry);
    entry.jumpHeld = false;

    if (
      !isCancel &&
      !entry.flickLatched &&
      entry.vertDir === null &&
      duration <= GESTURE_TAP_MAX_MS &&
      entry.maxDist <= GESTURE_TAP_MAX_MOVE_PX
    ) {
      if (entry.type === 'rightPad') {
        this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
      } else {
        const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 400;
        if (entry.startX < vw * 0.5) {
          this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
        } else {
          this._triggerJumpPulse(140);
        }
      }
    }
  }

  // ===========================================================================
  // Unified DOM Pointer & Keyboard Event Wiring
  // ===========================================================================

  _bindEvents() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this._onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      // Never intercept modal overlays
      if (target.closest('.overlay:not(.hidden)')) return;

      // Calibrate button in tilt bar: allow native click + ensure neutral calibration
      if (target.closest('#btn-calibrate-tilt')) {
        this.calibrateTilt();
        return;
      }

      // Never intercept HUD chrome buttons/controls
      if (target.closest('#hud button, #hud a, #hud select, #hud input')) return;

      // 1. Direct Action Buttons (#btn-jump & #btn-fire active across ALL 4 modes, multi-touch + slide + 10px halo)
      let jumpBtn = target.closest('#btn-jump');
      let fireBtn = target.closest('#btn-fire');
      if (!jumpBtn && !fireBtn && !target.closest('button, select, input, a, #dpad, #joystick-zone')) {
        const nearActionBtn = this._findActionButtonHalo(e.clientX, e.clientY, 10);
        if (nearActionBtn?.id === 'btn-jump') jumpBtn = nearActionBtn;
        else if (nearActionBtn?.id === 'btn-fire') fireBtn = nearActionBtn;
      }
      if (jumpBtn || fireBtn) {
        if (e.cancelable) e.preventDefault();
        const el = jumpBtn || fireBtn;
        const action = jumpBtn ? 'jump' : 'fire';
        el.classList.add('active');
        this._activePointers.set(e.pointerId, { type: 'button', action, el });
        this.justPressed[action] = true;
        this.haptic(action === 'jump' ? 14 : 12);
        this._tryPointerCapture(el, e.pointerId);
        this._recomputeState(true);
        return;
      }

      // 2. Virtual Joystick Widget (#joystick-zone) — single-pointer ownership prevents thumb stealing
      const joystickEl = target.closest('#joystick-zone');
      if (joystickEl && !this._hasPointerOfType('joystick')) {
        if (e.cancelable) e.preventDefault();
        this._clearHorizCarry();
        const entry = this._createJoystickEntry(e, joystickEl, false);
        this._activePointers.set(e.pointerId, entry);
        this._tryPointerCapture(joystickEl, e.pointerId);
        this._recomputeState();
        return;
      }

      // 3. Classic D-Pad Widget (#dpad) — single-pointer ownership prevents thumb stealing
      const dpadEl = target.closest('#dpad');
      if (dpadEl && !this._hasPointerOfType('dpad')) {
        if (e.cancelable) e.preventDefault();
        this._clearHorizCarry();
        const entry = this._createDpadEntry(e, dpadEl);
        this._activePointers.set(e.pointerId, entry);
        this._tryPointerCapture(dpadEl, e.pointerId);
        this._recomputeState();
        return;
      }

      // Ignore any other standalone UI interactive elements
      if (target.closest('button, select, input, textarea, a, label, [role="button"]')) return;

      // 4. Full-Bleed Gameplay Stage / Canvas Surface
      if (!target.closest('#game-canvas, #stage-wrap, #touch-controls, #app')) return;

      if (this.controlMode === 'gesture') {
        if (e.cancelable) e.preventDefault();
        const entry = this._createGestureEntry(e);
        this._activePointers.set(e.pointerId, entry);
        this._tryPointerCapture(target, e.pointerId);
        this._recomputeState();
      } else if (this.controlMode === 'tilt') {
        if (e.cancelable) e.preventDefault();
        const entry = this._createTiltTouchEntry(e, 'tiltTouch');
        this._activePointers.set(e.pointerId, entry);
        this._tryPointerCapture(target, e.pointerId);
        this._recomputeState();
      } else if (this.controlMode === 'joystick') {
        const vw = window.innerWidth || 400;
        if (e.clientX < vw * 0.52 && !this._hasPointerOfType('joystick')) {
          if (e.cancelable) e.preventDefault();
          this._clearHorizCarry();
          const zoneEl = document.getElementById('joystick-zone');
          const entry = this._createJoystickEntry(e, zoneEl, true);
          this._activePointers.set(e.pointerId, entry);
          this._tryPointerCapture(target, e.pointerId);
          this._recomputeState();
        } else if (e.clientX >= vw * 0.5) {
          if (e.cancelable) e.preventDefault();
          const entry = this._createTiltTouchEntry(e, 'rightPad');
          this._activePointers.set(e.pointerId, entry);
          this._tryPointerCapture(target, e.pointerId);
          this._recomputeState();
        }
      } else if (this.controlMode === 'dpad') {
        const vw = window.innerWidth || 400;
        const vh = window.innerHeight || 800;
        const dpadFallbackEl = document.getElementById('dpad');
        if (
          dpadFallbackEl &&
          e.clientX < vw * 0.48 &&
          e.clientY > vh * 0.50 &&
          !this._hasPointerOfType('dpad')
        ) {
          if (e.cancelable) e.preventDefault();
          this._clearHorizCarry();
          const entry = this._createDpadEntry(e, dpadFallbackEl);
          this._activePointers.set(e.pointerId, entry);
          this._tryPointerCapture(target, e.pointerId);
          this._recomputeState();
        } else if (e.clientX >= vw * 0.5) {
          if (e.cancelable) e.preventDefault();
          const entry = this._createTiltTouchEntry(e, 'rightPad');
          this._activePointers.set(e.pointerId, entry);
          this._tryPointerCapture(target, e.pointerId);
          this._recomputeState();
        }
      }
    };

    this._onPointerMove = (e) => {
      const entry = this._activePointers.get(e.pointerId);
      if (!entry) return;
      if (e.cancelable) e.preventDefault();

      if (entry.type === 'button') {
        this._updateButtonSlidePointer(entry, e.clientX, e.clientY);
      } else if (entry.type === 'gesture') {
        this._updateGesturePointer(entry, e);
      } else if (entry.type === 'joystick') {
        this._updateJoystickPointer(entry, e.clientX, e.clientY);
      } else if (entry.type === 'dpad') {
        const nextDir = this._resolveDpadDir(entry.dpadEl, entry.puckEl, e.clientX, e.clientY, entry.dir);
        this._applyDpadDir(entry, nextDir);
      } else if (entry.type === 'tiltTouch' || entry.type === 'rightPad') {
        this._updateTiltTouchPointer(entry, e);
      }
    };

    const finishPointer = (e, isCancel) => {
      const entry = this._activePointers.get(e.pointerId);
      if (!entry) return;
      if (e.cancelable) e.preventDefault();
      this._activePointers.delete(e.pointerId);

      if (entry.type === 'button') {
        if (entry.el) entry.el.classList.remove('active');
      } else if (entry.type === 'dpad') {
        if (entry.el) entry.el.classList.remove('active');
        if (entry.dpadEl) entry.dpadEl.classList.remove('active');
        this._setPuckOffset(entry.puckEl, 0, 0);
      } else if (entry.type === 'joystick') {
        if (entry.zoneEl) entry.zoneEl.classList.remove('active');
        if (entry.puckEl) entry.puckEl.classList.remove('active');
        this._setPuckOffset(entry.puckEl, 0, 0);
      } else if (entry.type === 'gesture') {
        this._finishGesturePointer(entry, e, isCancel);
      } else if (entry.type === 'tiltTouch' || entry.type === 'rightPad') {
        this._finishTiltTouchPointer(entry, e, isCancel);
      }

      this._recomputeState();
    };

    this._onPointerUp = (e) => finishPointer(e, false);
    this._onPointerCancel = (e) => finishPointer(e, true);

    window.addEventListener('pointerdown', this._onPointerDown, { capture: true, passive: false });
    window.addEventListener('pointermove', this._onPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', this._onPointerUp, { capture: true, passive: false });
    window.addEventListener('pointercancel', this._onPointerCancel, { capture: true, passive: false });

    // Prevent browser scroll/contextmenu on touch controls & canvas
    window.addEventListener(
      'contextmenu',
      (e) => {
        const t = e.target instanceof Element ? e.target : null;
        if (t && t.closest('#touch-controls, #game-canvas')) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    // Full Keyboard Fallback across all 4 control modes
    const keyMap = {
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      Space: 'jump',
      KeyZ: 'jump',
      KeyK: 'jump',
      KeyX: 'fire',
      Enter: 'fire',
      KeyJ: 'fire',
    };

    this._onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target && target.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (
        (e.code === 'Enter' || e.code === 'Space') &&
        target &&
        target.closest('.overlay:not(.hidden)') &&
        target.closest('button, a, [role="button"]')
      ) {
        return;
      }

      const action = keyMap[e.code];
      if (!action) return;
      e.preventDefault();
      if (e.repeat) return;

      if (action === 'left' || action === 'right') {
        this._clearHorizCarry();
      }
      this._heldKeys.add(action);
      this._recomputeState();
    };

    this._onKeyUp = (e) => {
      const action = keyMap[e.code];
      if (!action) return;
      this._heldKeys.delete(action);
      this._recomputeState();
    };

    this._onWindowBlur = () => {
      this.resetState();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onWindowBlur);
  }

  _tryPointerCapture(el, pointerId) {
    if (el && typeof el.setPointerCapture === 'function') {
      try {
        el.setPointerCapture(pointerId);
      } catch (_) {}
    }
  }
}
