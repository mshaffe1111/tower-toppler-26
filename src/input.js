// Towering Waters: Gateway's Descent — 4-Mode Precision Touch, Tail-Whip, Context-Aware Sanctum & Keyboard Controller
// Leaf module: zero internal src/ imports.

export const CONTROL_MODES = ['gesture', 'joystick', 'dpad', 'tilt'];

const MODE_ALIASES = {
  hybrid: 'joystick',
  buttons: 'dpad',
};

// Strict Precision Gesture Tuning Constants (Real-Device Playtest Calibrated — #270)
const GESTURE_HORIZ_DEADZONE_PX = 15;
const GESTURE_SECONDARY_HORIZ_DEADZONE_PX = 22;
const GESTURE_HORIZ_FULL_SPAN_PX = 40;
const GESTURE_HORIZ_MAX_LEASH_PX = 54;
const GESTURE_RECOIL_STOP_PX = 5; // pulling thumb back >= 5px brakes horizDir -> 0 immediately
const GESTURE_REVERSAL_PX = 16; // continuing past brake zone reverses direction cleanly
const GESTURE_STOP_SPEED_PX = 45; // px/s — mid-air post-flick horizontal stop threshold
const GESTURE_MIDAIR_STOP_IDLE_MS = 32;
// Natural human thumb horizontal sweep arcs ±25° (~tan 25.2° = 0.47)
const GESTURE_HORIZ_ARC_SLOPE = 0.47;

// Context-aware doorway / lift interaction thresholds
const GESTURE_INTERACT_UP_PX = -16;
const GESTURE_INTERACT_MAX_DX_PX = 22;
const GESTURE_INTERACT_DOMINANCE = 1.15;
const GESTURE_INTERACT_LATCH_MS = 180;
const GESTURE_CENTER_TAP_MOVE_PX = 14;

// Non-doorway controlled vertical slide thresholds
const GESTURE_SLIDE_UP_PX = -26;
const GESTURE_SLIDE_UP_MAX_SPEED = 540; // px/s (raised from 290 so lift climbs never misfire jump)
const GESTURE_SLIDE_UP_HOLD_MS = 65; // reduced from 135ms -> 65ms
const GESTURE_SLIDE_DOWN_PX = 26;
const GESTURE_VERT_RELEASE_PX = 14;
const GESTURE_VERT_REVERSAL_PX = 18;
const GESTURE_VERT_MAX_LEASH_PX = 60;
const GESTURE_VERT_DOMINANCE = 1.12;

// Standstill upward jump flick thresholds (away from doorways — #323 confident standard flick)
const GESTURE_FLICK_DY_PX = -26;
const GESTURE_FLICK_MAX_MS = 135;
const GESTURE_FLICK_VELOCITY_Y = -430; // px/s (upward is negative)

// Running / diagonal upward jump flick thresholds (#323: |dy| >= 20..22px fires confident standard jump!)
const GESTURE_RUN_FLICK_DY_PX = -20;
const GESTURE_RUN_FLICK_MAX_MS = 140;
const GESTURE_RUN_FLICK_VELOCITY_Y = -290; // px/s
const GESTURE_RUN_FLICK_MIN_SLOPE = 0.50; // >= 26.5° upward elevation
const GESTURE_DIAG_FLICK_MIN_DX_PX = 11; // away from doors, >=11px diagonal flick commits horizontal jump drive

// Confident 2-tier flick jump holds (#323: eliminates starved 85ms stubby tier!)
const GESTURE_FLICK_STD_MS = 185; // Normal flick (20..45px) -> 185ms standard jump (clears +1F & 1-col gaps from stone center!)
const GESTURE_FLICK_LONG_DY_PX = 46; // >= 46px -> full 245ms jump
const GESTURE_FLICK_LONG_MS = 245;

// Proportional post-flick ballistic horizontal commit targets (measured from lastFlickTime; paired with isLiveHorizHeld=false & Smart Island Brake!)
const GESTURE_FLICK_COMMIT_STD_MS = 565;
const GESTURE_FLICK_COMMIT_LONG_MS = 620;
const GESTURE_HORIZ_CARRY_MS = 36;
const GESTURE_FLICK_REARM_PX = 14;
const GESTURE_FLICK_REARM_MS = 145;

// Capacitive glass quick-tap tolerances (absorbs 6-15px thumb-pad roll jitter cleanly)
const GESTURE_TAP_MAX_MS = 210;
const GESTURE_TAP_MAX_MOVE_PX = 16;
const GESTURE_FIRE_PULSE_MS = 110;

// Tilt Constants
const TILT_DEADZONE_DEG = 2.5;
const TILT_BASE_FULL_DEG = 16.0;
const TILT_EMA_ALPHA = 0.55;

// Standard Gamepad Constants (W3C Standard Mapping)
const GAMEPAD_STICK_DEADZONE = 0.18;
const GAMEPAD_TRIGGER_THRESHOLD = 0.35;

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
      whip: false,
      analogX: 0,
      analogY: 0,
    };

    this.justPressed = {
      up: false,
      down: false,
      jump: false,
      fire: false,
      whip: false,
    };
    this._justPressed = this.justPressed;

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

    // Context-aware interaction & active game-mode state (synced via game.js / main.js / #app[data-game-mode])
    this._canInteract = false;
    this._interactKind = '';
    this.canInteract = false;
    this.interactKind = '';
    this._gameMode = '';
    this.gameMode = 'tower';
    this.isLiveHorizHeld = false;

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
    this._heldKeyCodes = new Set();
    this._keyMap = {
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
      KeyC: 'whip',
      KeyL: 'whip',
      KeyE: 'whip',
      ShiftLeft: 'whip',
      ShiftRight: 'whip',
    };
    this._gamepadConnected = false;
    this._gpActive = false;
    this._gpState = {
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
    this._leftPulseActive = false;
    this._leftPulseTimer = null;
    this._rightPulseActive = false;
    this._rightPulseTimer = null;
    this._upPulseActive = false;
    this._upPulseTimer = null;
    this._downPulseActive = false;
    this._downPulseTimer = null;
    this._firePulseActive = false;
    this._firePulseTimer = null;
    this._whipPulseActive = false;
    this._whipPulseTimer = null;
    this._jumpPulseActive = false;
    this._jumpPulseRemainingSec = 0;
    this._jumpPulseTimer = null;
    this._horizCarryDir = 0;
    this._horizCarryAnalogX = 0;
    this._horizCarryRemainingSec = 0;
    this._horizCarryTimer = null;
    this._puckCenteredCache = new WeakMap();

    this._initializedMode = false;
    this.controlMode = 'gesture';
    const initialMode = options.mode || options.controlMode || 'gesture';
    this.setControlMode(initialMode);

    this._bindEvents();
  }

  /** Returns current aggregated input state snapshot. */
  getState() {
    return this.state;
  }

  /** Per-frame tick hook called by game.update(dt) — polls gamepads, detects stationary post-flick thumb stops & expires ballistic carry deterministically. */
  update(dt = 0) {
    const stepDt = Number.isFinite(dt) && dt > 0 ? Math.min(0.05, dt) : 0;
    let changed = false;

    if (this._pollGamepad()) {
      changed = true;
    }

    if (stepDt > 0) {
      if (this._horizCarryDir !== 0 && this._horizCarryRemainingSec > 0) {
        this._horizCarryRemainingSec -= stepDt;
        if (this._horizCarryRemainingSec <= 0) {
          this._clearHorizCarry();
          changed = true;
        }
      }
      if (this._jumpPulseActive && this._jumpPulseRemainingSec > 0) {
        this._jumpPulseRemainingSec -= stepDt;
        if (this._jumpPulseRemainingSec <= 0) {
          this._cancelJumpPulse();
          changed = true;
        }
      }
    }

    if (this._activeGameMode() === 'tower') {
      for (const entry of this._activePointers.values()) {
        if (entry.type !== 'gesture') continue;
        if (stepDt > 0 && entry.jumpHeld && entry.jumpHoldRemainingSec > 0) {
          entry.jumpHoldRemainingSec -= stepDt;
          if (entry.jumpHoldRemainingSec <= 0) {
            entry.jumpHoldRemainingSec = 0;
            entry.jumpHeld = false;
            if (entry.jumpTimer !== null) {
              clearTimeout(entry.jumpTimer);
              entry.jumpTimer = null;
            }
            changed = true;
          }
        }
        if (entry.movedThisFrame) {
          entry.movedThisFrame = false;
        } else if (stepDt > 0) {
          entry.idleHorizSec = (entry.idleHorizSec || 0) + stepDt;
        }
        if (
          (entry.flickLatched || entry.postFlickActive) &&
          entry.horizDir !== 0 &&
          entry.idleHorizSec >= GESTURE_MIDAIR_STOP_IDLE_MS / 1000
        ) {
          entry.horizDir = 0;
          entry.postFlickActive = false;
          entry.lastFlickHoldMs = 0;
          entry.left = false;
          entry.right = false;
          entry.analogX = 0;
          entry.anchorX = entry.lastX;
          entry.extremeX = entry.lastX;
          this._releaseGestureJumpHold(entry);
          if (entry.midAirStopTimer !== null) {
            clearTimeout(entry.midAirStopTimer);
            entry.midAirStopTimer = null;
          }
          changed = true;
        }
      }
    }

    if (changed) {
      this._recomputeState(true);
    }
  }

  /**
   * Explicitly sets active game mode ('tower' | 'submarine' | 'skimmer' | 'glide' | 'puzzle' | 'vault' | 'title');
   * also auto-reads document.getElementById('app').dataset.gameMode when unset.
   */
  setGameMode(mode = 'tower') {
    const next = String(mode || '');
    this._gameMode = next;
    this.gameMode = next || 'tower';
    if (next && next !== 'tower') {
      this.setInteractContext(false, '');
    }
    return this.gameMode;
  }

  _activeGameMode() {
    if (this._gameMode) return this._gameMode;
    if (typeof document !== 'undefined') {
      const dm = document.getElementById('app')?.dataset?.gameMode;
      if (dm) return dm;
    }
    return 'tower';
  }

  /**
   * Updates context-aware doorway / lift / interactable proximity from game.js / main.js.
   * @param {boolean} [canInteract=false]
   * @param {string} [kind=''] - 'door' | 'lift' | 'fire' | ''
   */
  setInteractContext(canInteract = false, kind = '') {
    const active = Boolean(canInteract);
    const normKind = active ? String(kind || 'door') : '';
    this._canInteract = active;
    this._interactKind = normKind;
    this.canInteract = active;
    this.interactKind = normKind;
  }

  /**
   * Fires an immediate context interaction (from tapping #action-prompt or tapping Gateway/doorway center zone).
   * @param {string} [action='up'] - 'up' | 'fire' | 'whip' | 'down'
   */
  triggerInteract(action = '') {
    const resolved =
      action ||
      (this._interactKind === 'whip'
        ? 'whip'
        : this._interactKind === 'fire'
        ? 'fire'
        : 'up');
    this._cancelJumpPulse();
    this._clearHorizCarry();

    if (resolved === 'whip') {
      this._triggerWhipPulse(135);
      return true;
    }
    if (resolved === 'fire') {
      this._triggerFirePulse(125);
      return true;
    }
    if (resolved === 'down') {
      this._triggerDownPulse(165);
      return true;
    }
    this._triggerUpPulse(170);
    return true;
  }

  /** Triggers a crisp 360° Tail-Whip input pulse programmatically or via UI button. */
  triggerWhip(durationMs = 125) {
    this._triggerWhipPulse(durationMs);
    return true;
  }

  /** Switches active touch control scheme and sets document.getElementById('app').dataset.controlMode = mode. */
  setControlMode(mode) {
    const mapped = MODE_ALIASES[mode] || mode;
    const validMode = CONTROL_MODES.includes(mapped) ? mapped : 'gesture';
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
    this.justPressed.whip = false;
  }

  /** Clears all held directions/buttons (called on pause / overlay transitions). */
  resetState() {
    if (this._leftPulseTimer !== null) {
      clearTimeout(this._leftPulseTimer);
      this._leftPulseTimer = null;
    }
    if (this._rightPulseTimer !== null) {
      clearTimeout(this._rightPulseTimer);
      this._rightPulseTimer = null;
    }
    if (this._upPulseTimer !== null) {
      clearTimeout(this._upPulseTimer);
      this._upPulseTimer = null;
    }
    if (this._downPulseTimer !== null) {
      clearTimeout(this._downPulseTimer);
      this._downPulseTimer = null;
    }
    if (this._firePulseTimer !== null) {
      clearTimeout(this._firePulseTimer);
      this._firePulseTimer = null;
    }
    if (this._whipPulseTimer !== null) {
      clearTimeout(this._whipPulseTimer);
      this._whipPulseTimer = null;
    }
    if (this._jumpPulseTimer !== null) {
      clearTimeout(this._jumpPulseTimer);
      this._jumpPulseTimer = null;
    }
    this._leftPulseActive = false;
    this._rightPulseActive = false;
    this._upPulseActive = false;
    this._downPulseActive = false;
    this._firePulseActive = false;
    this._whipPulseActive = false;
    this._jumpPulseActive = false;
    this._jumpPulseRemainingSec = 0;
    this._clearHorizCarry();

    for (const entry of this._activePointers.values()) {
      this._cleanupPointerTimers(entry);
      if (entry.el) entry.el.classList.remove('active');
      if (entry.zoneEl) entry.zoneEl.classList.remove('active');
      if (entry.dpadEl) entry.dpadEl.classList.remove('active');
    }
    this._activePointers.clear();
    this._heldKeys.clear();
    this._heldKeyCodes.clear();

    this._gpActive = false;
    this._gpState.left = false;
    this._gpState.right = false;
    this._gpState.up = false;
    this._gpState.down = false;
    this._gpState.jump = false;
    this._gpState.fire = false;
    this._gpState.whip = false;
    this._gpState.analogX = 0;
    this._gpState.analogY = 0;

    this._tiltLeft = false;
    this._tiltRight = false;
    this._tiltAnalogX = 0;

    if (typeof document !== 'undefined') {
      document
        .querySelectorAll(
          '.dpad-btn.active, #btn-jump.active, #btn-fire.active, #btn-whip.active, #dpad.active, #joystick-zone.active, #joystick-puck.active, #tilt-bar.active, #tilt-puck.active'
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
    this.state.whip = false;
    this.state.analogX = 0;
    this.state.analogY = 0;
    this.isLiveHorizHeld = false;

    this.clearFrame();
  }

  /** Triggers subtle mobile vibration if hapticsEnabled is true and user has interacted with frame. */
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

  _isDoorOrLiftContext() {
    return (
      this._canInteract &&
      (this._interactKind === 'door' || this._interactKind === 'lift' || this._interactKind === '')
    );
  }

  _isInCenterInteractZone(clientX, clientY) {
    let left = 0;
    let top = 0;
    let vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 430;
    let vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 932;

    if (typeof document !== 'undefined') {
      const stageEl = document.getElementById('game-canvas') || document.getElementById('stage-wrap');
      if (stageEl && typeof stageEl.getBoundingClientRect === 'function') {
        const r = stageEl.getBoundingClientRect();
        if (r.width > 40 && r.height > 40) {
          left = r.left;
          top = r.top;
          vw = r.width;
          vh = r.height;
        }
      }
    }

    const nx = (clientX - left) / Math.max(1, vw);
    const ny = (clientY - top) / Math.max(1, vh);
    // Middle 36% horizontally ([0.32..0.68]), middle 54% vertically ([0.24..0.78], matching closer #304 phone/tablet camera!)
    return nx >= 0.32 && nx <= 0.68 && ny >= 0.24 && ny <= 0.78;
  }

  _resolveFlickHoldMs(dyUp) {
    const absDy = Math.abs(dyUp);
    if (absDy >= GESTURE_FLICK_LONG_DY_PX) return GESTURE_FLICK_LONG_MS;
    return GESTURE_FLICK_STD_MS;
  }

  _releaseGestureJumpHold(entry) {
    if (entry) {
      if (entry.jumpTimer !== undefined && entry.jumpTimer !== null) {
        clearTimeout(entry.jumpTimer);
        entry.jumpTimer = null;
      }
      entry.jumpHeld = false;
      entry.jumpHoldRemainingSec = 0;
    }
    this._cancelJumpPulse();
  }

  _latchHorizCarry(dir, analogX, durationMs = GESTURE_HORIZ_CARRY_MS) {
    this._clearHorizCarry();
    if (!dir || durationMs <= 0) return;
    this._horizCarryDir = dir;
    this._horizCarryAnalogX = analogX;
    this._horizCarryRemainingSec = durationMs / 1000;
    this._horizCarryTimer = setTimeout(() => {
      this._horizCarryTimer = null;
      this._horizCarryDir = 0;
      this._horizCarryAnalogX = 0;
      this._horizCarryRemainingSec = 0;
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
    this._horizCarryRemainingSec = 0;
  }

  _cancelJumpPulse() {
    if (this._jumpPulseTimer !== null) {
      clearTimeout(this._jumpPulseTimer);
      this._jumpPulseTimer = null;
    }
    this._jumpPulseActive = false;
    this._jumpPulseRemainingSec = 0;
  }

  _pollGamepad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return false;
    }
    let pads;
    try {
      pads = navigator.getGamepads();
    } catch (_) {
      return false;
    }
    if (!pads || pads.length === 0) {
      if (!this._gpActive) return false;
      this._gpActive = false;
      const g = this._gpState;
      g.left = g.right = g.up = g.down = g.jump = g.fire = g.whip = false;
      g.analogX = 0;
      g.analogY = 0;
      return true;
    }

    let left = false;
    let right = false;
    let up = false;
    let down = false;
    let jump = false;
    let fire = false;
    let whip = false;
    let ax = 0;
    let ay = 0;
    let foundPad = false;

    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      if (!pad || !pad.connected) continue;
      foundPad = true;
      const btns = pad.buttons || [];
      const axes = pad.axes || [];
      const pressed = (idx) => {
        const b = btns[idx];
        return Boolean(b && (b.pressed || b.value >= GAMEPAD_TRIGGER_THRESHOLD));
      };

      // D-Pad (standard W3C indices 12..15)
      if (pressed(14)) left = true;
      if (pressed(15)) right = true;
      if (pressed(12)) up = true;
      if (pressed(13)) down = true;

      // Left Analog Stick (axes 0, 1) with clean radial deadzone & smooth rescaling
      const rawX = Number(axes[0]) || 0;
      const rawY = Number(axes[1]) || 0;
      const mag = Math.hypot(rawX, rawY);
      if (mag > GAMEPAD_STICK_DEADZONE) {
        const scaled = Math.min(1, (mag - GAMEPAD_STICK_DEADZONE) / (1 - GAMEPAD_STICK_DEADZONE));
        const sx = (rawX / mag) * scaled;
        const sy = (rawY / mag) * scaled;
        if (Math.abs(sx) > Math.abs(ax)) ax = sx;
        if (Math.abs(sy) > Math.abs(ay)) ay = sy;
      }

      // Action buttons: A/Cross = Jump, X/Square or RT = Pulse, B/Circle or Y/Triangle or RB = Tail-Whip
      if (pressed(0)) jump = true;
      if (pressed(2) || pressed(7)) fire = true;
      if (pressed(1) || pressed(3) || pressed(5)) whip = true;
    }

    this._gamepadConnected = foundPad;
    if (!foundPad && !this._gpActive) return false;

    if (ax < -0.22) left = true;
    if (ax > 0.22) right = true;
    if (ay < -0.35) up = true;
    if (ay > 0.35) down = true;
    if (left && !right && ax === 0) ax = -1;
    if (right && !left && ax === 0) ax = 1;
    if (up && !down && ay === 0) ay = -1;
    if (down && !up && ay === 0) ay = 1;

    const g = this._gpState;
    const anyNow = left || right || up || down || jump || fire || whip || Math.abs(ax) > 0.01 || Math.abs(ay) > 0.01;
    const changed =
      anyNow !== this._gpActive ||
      left !== g.left ||
      right !== g.right ||
      up !== g.up ||
      down !== g.down ||
      jump !== g.jump ||
      fire !== g.fire ||
      whip !== g.whip ||
      Math.abs(ax - g.analogX) > 0.01 ||
      Math.abs(ay - g.analogY) > 0.01;

    if (!changed) return false;

    this._gpActive = anyNow;
    g.left = left;
    g.right = right;
    g.up = up;
    g.down = down;
    g.jump = jump;
    g.fire = fire;
    g.whip = whip;
    g.analogX = ax;
    g.analogY = ay;
    if (left || right) this._clearHorizCarry();
    return true;
  }

  _recomputeState(suppressEdgeHaptic = false) {
    let left = this._heldKeys.has('left') || this._leftPulseActive;
    let right = this._heldKeys.has('right') || this._rightPulseActive;
    let up = this._heldKeys.has('up') || this._upPulseActive;
    let down = this._heldKeys.has('down') || this._downPulseActive;
    let jump = this._heldKeys.has('jump') || this._jumpPulseActive;
    let fire = this._heldKeys.has('fire') || this._firePulseActive;
    let whip = this._heldKeys.has('whip') || this._whipPulseActive;
    let liveHorizHeld = this._heldKeys.has('left') || this._heldKeys.has('right');

    let analogX = (right ? 1 : 0) - (left ? 1 : 0);
    let analogY = (down ? 1 : 0) - (up ? 1 : 0);

    // Merge W3C Standard Gamepad state cleanly without clobbering touch/keyboard
    if (this._gpActive) {
      const g = this._gpState;
      if (g.left) {
        left = true;
        liveHorizHeld = true;
      }
      if (g.right) {
        right = true;
        liveHorizHeld = true;
      }
      if (g.up) up = true;
      if (g.down) down = true;
      if (g.jump) jump = true;
      if (g.fire) fire = true;
      if (g.whip) whip = true;
      if (Math.abs(g.analogX) > Math.abs(analogX)) analogX = g.analogX;
      if (Math.abs(g.analogY) > Math.abs(analogY)) analogY = g.analogY;
    }

    for (const entry of this._activePointers.values()) {
      if (entry.type === 'button') {
        if (entry.action === 'jump') jump = true;
        else if (entry.action === 'fire') fire = true;
        else if (entry.action === 'whip') whip = true;
      } else if (entry.type === 'dpad') {
        if (entry.dir === 'left') {
          left = true;
          liveHorizHeld = true;
          analogX = -1;
        } else if (entry.dir === 'right') {
          right = true;
          liveHorizHeld = true;
          analogX = 1;
        } else if (entry.dir === 'up') {
          up = true;
          analogY = -1;
        } else if (entry.dir === 'down') {
          down = true;
          analogY = 1;
        }
      } else if (entry.type === 'joystick') {
        if (entry.left) {
          left = true;
          liveHorizHeld = true;
        }
        if (entry.right) {
          right = true;
          liveHorizHeld = true;
        }
        if (entry.up) up = true;
        if (entry.down) down = true;
        if (Math.abs(entry.analogX) > Math.abs(analogX)) analogX = entry.analogX;
        if (Math.abs(entry.analogY) > Math.abs(analogY)) analogY = entry.analogY;
      } else if (entry.type === 'gesture') {
        if (entry.left) {
          left = true;
          liveHorizHeld = true;
        }
        if (entry.right) {
          right = true;
          liveHorizHeld = true;
        }
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
      if (this._tiltLeft) {
        left = true;
        liveHorizHeld = true;
      }
      if (this._tiltRight) {
        right = true;
        liveHorizHeld = true;
      }
      if (Math.abs(this._tiltAnalogX) > Math.abs(analogX)) {
        analogX = this._tiltAnalogX;
      }
    }

    this.isLiveHorizHeld = Boolean(liveHorizHeld);

    // Apply post-flick ballistic horizontal commit ONLY when no live pointer/key overrides
    if (!left && !right && this._horizCarryDir !== 0) {
      if (this._horizCarryDir < 0) left = true;
      else if (this._horizCarryDir > 0) right = true;
      analogX = this._horizCarryAnalogX;
    }

    const prevUp = this.state.up;
    const prevDown = this.state.down;
    const prevJump = this.state.jump;
    const prevFire = this.state.fire;
    const prevWhip = this.state.whip;

    this.state.left = left;
    this.state.right = right;
    this.state.up = up;
    this.state.down = down;
    this.state.jump = jump;
    this.state.fire = fire;
    this.state.whip = whip;
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
    if (whip && !prevWhip) {
      this.justPressed.whip = true;
      if (!suppressEdgeHaptic) this.haptic(16);
    }
  }

  _triggerLeftPulse(durationMs = 95) {
    if (this._leftPulseTimer !== null) clearTimeout(this._leftPulseTimer);
    this._leftPulseActive = true;
    this.haptic(8);
    this._recomputeState(true);
    this._leftPulseTimer = setTimeout(() => {
      this._leftPulseTimer = null;
      this._leftPulseActive = false;
      this._recomputeState(true);
    }, durationMs);
  }

  _triggerRightPulse(durationMs = 95) {
    if (this._rightPulseTimer !== null) clearTimeout(this._rightPulseTimer);
    this._rightPulseActive = true;
    this.haptic(8);
    this._recomputeState(true);
    this._rightPulseTimer = setTimeout(() => {
      this._rightPulseTimer = null;
      this._rightPulseActive = false;
      this._recomputeState(true);
    }, durationMs);
  }

  _triggerUpPulse(durationMs = GESTURE_INTERACT_LATCH_MS) {
    if (this._upPulseTimer !== null) {
      clearTimeout(this._upPulseTimer);
    }
    this._cancelJumpPulse();
    this._upPulseActive = true;
    this.justPressed.up = true;
    this.haptic(10);
    this._recomputeState(true);

    this._upPulseTimer = setTimeout(() => {
      this._upPulseTimer = null;
      this._upPulseActive = false;
      this._recomputeState(true);
    }, durationMs);
  }

  _triggerDownPulse(durationMs = 165) {
    if (this._downPulseTimer !== null) {
      clearTimeout(this._downPulseTimer);
    }
    this._cancelJumpPulse();
    this._downPulseActive = true;
    this.justPressed.down = true;
    this.haptic(10);
    this._recomputeState(true);

    this._downPulseTimer = setTimeout(() => {
      this._downPulseTimer = null;
      this._downPulseActive = false;
      this._recomputeState(true);
    }, durationMs);
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

  _triggerWhipPulse(durationMs = 125) {
    if (this._whipPulseTimer !== null) {
      clearTimeout(this._whipPulseTimer);
    }
    this._whipPulseActive = true;
    this.justPressed.whip = true;
    this.haptic(16);
    this._recomputeState(true);

    this._whipPulseTimer = setTimeout(() => {
      this._whipPulseTimer = null;
      this._whipPulseActive = false;
      this._recomputeState(true);
    }, durationMs);
  }

  _triggerJumpPulse(durationMs = GESTURE_FLICK_STD_MS, extendOnly = false) {
    if (this._jumpPulseTimer !== null) {
      clearTimeout(this._jumpPulseTimer);
    }
    this._jumpPulseActive = true;
    this._jumpPulseRemainingSec = durationMs / 1000;
    if (!extendOnly) {
      this.justPressed.jump = true;
      this.haptic(14);
    }
    this._recomputeState(true);

    this._jumpPulseTimer = setTimeout(() => {
      this._jumpPulseTimer = null;
      this._jumpPulseActive = false;
      this._jumpPulseRemainingSec = 0;
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
    if (entry.midAirStopTimer !== undefined && entry.midAirStopTimer !== null) {
      clearTimeout(entry.midAirStopTimer);
      entry.midAirStopTimer = null;
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
  // Direct Action Button Halo & Slide-Press Helper (#btn-fire <-> #btn-jump <-> #btn-whip)
  // ===========================================================================

  _isActionBtnVisible(btn) {
    if (!btn || typeof btn.getBoundingClientRect !== 'function') return false;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const cs = window.getComputedStyle(btn);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') {
        return false;
      }
    }
    const r = btn.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  _findActionButtonHalo(clientX, clientY, padPx = 12) {
    if (typeof document === 'undefined') return null;

    const touchRoot = document.getElementById('touch-controls');
    if (touchRoot && typeof window !== 'undefined' && window.getComputedStyle) {
      const tcs = window.getComputedStyle(touchRoot);
      // Note: #touch-controls intentionally uses pointer-events: none as a pass-through flex container;
      // check display, visibility, and opacity to detect when overlays/cutscenes hide touch controls.
      if (
        tcs.display === 'none' ||
        tcs.visibility === 'hidden' ||
        Number(tcs.opacity) <= 0.02
      ) {
        return null;
      }
    }

    const candidates = [
      document.getElementById('btn-jump'),
      document.getElementById('btn-fire'),
      document.getElementById('btn-whip'),
    ];
    let bestBtn = null;
    let bestDist = Infinity;

    for (const btn of candidates) {
      if (!this._isActionBtnVisible(btn)) continue;
      const r = btn.getBoundingClientRect();
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
    const insideRect = (btn, pad = 2) => {
      if (!this._isActionBtnVisible(btn)) return false;
      const r = btn.getBoundingClientRect();
      return (
        clientX >= r.left - pad &&
        clientX <= r.right + pad &&
        clientY >= r.top - pad &&
        clientY <= r.bottom + pad
      );
    };

    // Stay locked to the currently pressed button while the thumb remains inside it (+3px hysteresis).
    // Prevents accidental JUMP <-> PULSE hijacking across tight 8px mobile button gaps on 412x915 Portrait!
    if (entry.el && insideRect(entry.el, 3)) {
      return;
    }

    const candidates = [
      { action: 'jump', el: document.getElementById('btn-jump') },
      { action: 'fire', el: document.getElementById('btn-fire') },
      { action: 'whip', el: document.getElementById('btn-whip') },
    ];

    let nextAction = entry.action;
    let nextEl = entry.el;
    let bestDist = Infinity;

    for (const c of candidates) {
      if (c.action === entry.action || !insideRect(c.el, 2)) continue;
      const r = c.el.getBoundingClientRect();
      const d = Math.hypot(clientX - (r.left + r.width * 0.5), clientY - (r.top + r.height * 0.5));
      if (d < bestDist) {
        bestDist = d;
        nextAction = c.action;
        nextEl = c.el;
      }
    }

    if (nextAction !== entry.action) {
      const prevEl = entry.el;
      entry.action = nextAction;
      entry.el = nextEl;
      if (prevEl && !this._hasOtherPointerOnEl(entry, prevEl)) {
        prevEl.classList.remove('active');
      }
      if (entry.el) entry.el.classList.add('active');
      this.justPressed[nextAction] = true;
      this.haptic(nextAction === 'whip' ? 16 : nextAction === 'jump' ? 14 : 12);
      this._recomputeState(true);
    }
  }

  _hasOtherPointerOnEl(excludeEntry, el) {
    if (!el) return false;
    for (const other of this._activePointers.values()) {
      if (other !== excludeEntry && other.el === el) return true;
    }
    return false;
  }

  // ===========================================================================
  // Mode 1: Precision Gesture & Context-Aware Doorway Logic ('gesture')
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
      lastMoveTime: ts.now,
      lastHorizMoveTime: ts.now,
      idleHorizSec: 0,
      movedThisFrame: true,
      recentVx: 0,
      maxDist: 0,

      // Horizontal dynamic anchor state
      anchorX: x,
      extremeX: x,
      horizDir: 0,
      horizStartTime: 0,
      wasRunningBeforeFlick: false,
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
      flickHoldMs: 0,
      flickPeakY: y,
      flickLatchTime: 0,
      postFlickActive: false,
      lastFlickTime: 0,
      lastFlickHoldMs: 0,
      jumpHeld: false,
      jumpHoldRemainingSec: 0,
      jumpTimer: null,
      upHoldTimer: null,
      midAirStopTimer: null,

      samples: [{ x, y, t: ts.now }],
    };
  }

  _scheduleMidAirStopWatchdog(entry) {
    if (entry.midAirStopTimer !== null) {
      clearTimeout(entry.midAirStopTimer);
      entry.midAirStopTimer = null;
    }
    if ((!entry.flickLatched && !entry.postFlickActive) || entry.horizDir === 0) return;
    entry.midAirStopTimer = setTimeout(() => {
      entry.midAirStopTimer = null;
      if ((entry.flickLatched || entry.postFlickActive) && entry.horizDir !== 0) {
        entry.horizDir = 0;
        entry.postFlickActive = false;
        entry.lastFlickHoldMs = 0;
        entry.left = false;
        entry.right = false;
        entry.analogX = 0;
        entry.anchorX = entry.lastX;
        entry.extremeX = entry.lastX;
        this._releaseGestureJumpHold(entry);
        this._recomputeState(true);
      }
    }, GESTURE_MIDAIR_STOP_IDLE_MS);
  }

  _updateGesturePointer(entry, e) {
    const now = this._resolveTimestampMs(e, entry);
    const x = e.clientX;
    const y = e.clientY;
    const prevX = entry.lastX;
    const prevY = entry.lastY;
    const prevMoveTime = entry.lastMoveTime;
    const gapMs = now - prevMoveTime;
    const dtStepSec = Math.max(0.004, gapMs / 1000);
    const dxStep = x - prevX;
    const dyStep = y - prevY;
    const instVx = dxStep / dtStepSec;

    // If finger sat motionless on glass (>45ms with zero pointermove events) before starting an upward flick,
    // anchor upOnset to the stationary point right before this new stroke (~16ms ago) instead of stale pre-hold time!
    if (!entry.flickLatched && entry.vertDir === null && gapMs > 45 && Math.abs(entry.upOnsetY - prevY) < 5) {
      const onsetTs = now - Math.min(18, gapMs);
      entry.upOnsetX = prevX;
      entry.upOnsetY = prevY;
      entry.upOnsetTime = onsetTs;
      entry.samples.push({ x: prevX, y: prevY, t: onsetTs });
    }

    entry.lastX = x;
    entry.lastY = y;
    entry.lastMoveTime = now;
    entry.movedThisFrame = true;
    entry.recentVx = instVx;
    if (Math.abs(instVx) >= GESTURE_STOP_SPEED_PX || dyStep <= -2.5) {
      entry.lastHorizMoveTime = now;
      entry.idleHorizSec = 0;
    } else {
      entry.idleHorizSec = (entry.idleHorizSec || 0) + dtStepSec;
    }

    const distFromStart = Math.hypot(x - entry.startX, y - entry.startY);
    if (distFromStart > entry.maxDist) {
      entry.maxDist = distFromStart;
    }

    // Maintain short rolling velocity window (~130ms)
    entry.samples.push({ x, y, t: now });
    while (entry.samples.length > 10 || (entry.samples.length > 2 && now - entry.samples[0].t > 130)) {
      entry.samples.shift();
    }

    const gmode = this._activeGameMode();
    if (
      gmode === 'core_descent' ||
      gmode === 'reef_swim' ||
      gmode === 'submarine' ||
      gmode === 'frill_glide' ||
      gmode === 'glide' ||
      gmode === 'aqueduct_sanctum' ||
      gmode === 'puzzle' ||
      gmode === 'rapids_surf' ||
      gmode === 'skimmer' ||
      gmode === 'vault'
    ) {
      this._updateMiniGameGesturePointer(entry, x, y, now, gmode);
      return;
    }

    // -------------------------------------------------------------------------
    // 1. Precision Horizontal Drag with Recoil Brake & Instant Reversal
    //    - >= 5px recoil from extremeX drops horizDir -> 0 immediately (zero sticky coast!)
    //    - >= 16px recoil reverses direction cleanly in one fluid motion
    //    - Post-flick stationary thumb (< 45 px/s) drops horizDir -> 0 immediately mid-air
    // -------------------------------------------------------------------------
    const activeHorizDeadzone =
      entry.horizDir === 0 && this._hasOtherGestureHorizPointer(entry)
        ? GESTURE_SECONDARY_HORIZ_DEADZONE_PX
        : GESTURE_HORIZ_DEADZONE_PX;

    let dx = x - entry.anchorX;
    const isSteepVertStep = Math.abs(dyStep) > Math.abs(dxStep) * 1.35 && Math.abs(dyStep) > 3;

    if (entry.horizDir === 1 || dx > activeHorizDeadzone) {
      if (x > entry.extremeX) entry.extremeX = x;
      const recoil = entry.extremeX - x;
      if (!isSteepVertStep && recoil > GESTURE_REVERSAL_PX) {
        // Full leftward reversal!
        entry.anchorX = x + (activeHorizDeadzone + 3);
        entry.extremeX = x;
        entry.horizDir = -1;
        dx = x - entry.anchorX;
      } else if (!isSteepVertStep && recoil >= GESTURE_RECOIL_STOP_PX) {
        // Deliberate thumb recoil brake -> immediate neutral stop & early jump release!
        if (entry.flickLatched || entry.postFlickActive) {
          this._releaseGestureJumpHold(entry);
        }
        entry.anchorX = x;
        entry.extremeX = x;
        entry.horizDir = 0;
        entry.postFlickActive = false;
        entry.lastFlickHoldMs = 0;
        dx = 0;
      } else if (dx > GESTURE_HORIZ_MAX_LEASH_PX) {
        entry.anchorX = x - GESTURE_HORIZ_MAX_LEASH_PX;
        dx = GESTURE_HORIZ_MAX_LEASH_PX;
      }
    } else if (entry.horizDir === -1 || dx < -activeHorizDeadzone) {
      if (x < entry.extremeX) entry.extremeX = x;
      const recoil = x - entry.extremeX;
      if (!isSteepVertStep && recoil > GESTURE_REVERSAL_PX) {
        // Full rightward reversal!
        entry.anchorX = x - (activeHorizDeadzone + 3);
        entry.extremeX = x;
        entry.horizDir = 1;
        dx = x - entry.anchorX;
      } else if (!isSteepVertStep && recoil >= GESTURE_RECOIL_STOP_PX) {
        // Deliberate thumb recoil brake -> immediate neutral stop & early jump release!
        if (entry.flickLatched || entry.postFlickActive) {
          this._releaseGestureJumpHold(entry);
        }
        entry.anchorX = x;
        entry.extremeX = x;
        entry.horizDir = 0;
        entry.postFlickActive = false;
        entry.lastFlickHoldMs = 0;
        dx = 0;
      } else if (dx < -GESTURE_HORIZ_MAX_LEASH_PX) {
        entry.anchorX = x + GESTURE_HORIZ_MAX_LEASH_PX;
        dx = -GESTURE_HORIZ_MAX_LEASH_PX;
      }
    }

    // Mid-air post-flick thumb stop: if finger stops moving horizontally after flick, brake & drop immediately
    if (
      (entry.flickLatched || entry.postFlickActive) &&
      entry.horizDir !== 0 &&
      Math.abs(instVx) < GESTURE_STOP_SPEED_PX &&
      now - entry.lastHorizMoveTime >= 24 &&
      dyStep > -2.5
    ) {
      entry.anchorX = x;
      entry.extremeX = x;
      entry.horizDir = 0;
      entry.postFlickActive = false;
      entry.lastFlickHoldMs = 0;
      this._releaseGestureJumpHold(entry);
      dx = 0;
    }

    if (Math.abs(dx) > activeHorizDeadzone) {
      this._clearHorizCarry();
      const nextHorizDir = dx < 0 ? -1 : 1;
      if (nextHorizDir !== entry.horizDir) {
        entry.horizStartTime = now;
      }
      entry.horizDir = nextHorizDir;
      const rawMag = Math.min(1, (Math.abs(dx) - activeHorizDeadzone) / GESTURE_HORIZ_FULL_SPAN_PX);
      const baseMag = 0.28 + 0.72 * rawMag;
      const mag = entry.flickLatched || entry.postFlickActive ? Math.max(0.98, baseMag) : baseMag;
      entry.analogX = entry.horizDir * mag;
      entry.left = entry.horizDir < 0;
      entry.right = entry.horizDir > 0;
      if (entry.flickLatched || entry.postFlickActive) {
        this._scheduleMidAirStopWatchdog(entry);
      }
    } else if ((entry.flickLatched || entry.postFlickActive) && entry.horizDir !== 0) {
      // Preserve committed diagonal flick horizontal drive even when |dx| was 11..15px!
      this._clearHorizCarry();
      entry.analogX = entry.horizDir;
      entry.left = entry.horizDir < 0;
      entry.right = entry.horizDir > 0;
      this._scheduleMidAirStopWatchdog(entry);
    } else {
      entry.horizDir = 0;
      entry.horizStartTime = 0;
      entry.postFlickActive = false;
      entry.lastFlickHoldMs = 0;
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
        // Upgrade jump hold smoothly if user continues pulling into a longer power-flick
        const upgradedHold = this._resolveFlickHoldMs(y - entry.upOnsetY);
        if (upgradedHold > entry.flickHoldMs) {
          const elapsedFlick = Math.max(0, now - entry.flickLatchTime);
          const extra = upgradedHold - elapsedFlick;
          entry.flickHoldMs = upgradedHold;
          entry.lastFlickHoldMs = upgradedHold;
          if (extra > 12) {
            entry.jumpHeld = true;
            entry.jumpHoldRemainingSec = extra / 1000;
            if (entry.jumpTimer !== null) {
              clearTimeout(entry.jumpTimer);
            }
            entry.jumpTimer = setTimeout(() => {
              entry.jumpTimer = null;
              entry.jumpHeld = false;
              entry.jumpHoldRemainingSec = 0;
              this._recomputeState(true);
            }, extra);
            this._triggerJumpPulse(extra, true);
          }
        }
      }
      if (
        y - entry.flickPeakY >= GESTURE_FLICK_REARM_PX ||
        (now - entry.flickLatchTime >= GESTURE_FLICK_REARM_MS && dyStep >= -0.8)
      ) {
        entry.flickLatched = false;
        entry.flickHoldMs = 0;
        entry.anchorY = y;
        entry.extremeY = y;
        entry.vertOnsetX = x;
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
    } else if (entry.vertDir === null) {
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
        if (entry.anchorY < entry.startY) {
          entry.anchorY = Math.min(y, entry.startY);
          entry.vertOnsetX = x;
        }
      } else if (
        (entry.upOnsetY - y < 4 && dyStep >= -1.0) ||
        (entry.upOnsetY - y < 5 && now - entry.upOnsetTime > 95)
      ) {
        entry.upOnsetX = x;
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
    }

    const { vx, vy } = this._computeGestureVelocity(entry, x, y, now);
    const dxUp = x - entry.upOnsetX;
    const dyUp = y - entry.upOnsetY;
    const dtUpMs = Math.max(0, now - entry.upOnsetTime);
    const dyAnchor = y - entry.anchorY;

    // -------------------------------------------------------------------------
    // 3A. CONTEXT-AWARE DOORWAY / LIFT PRIORITY (#270 CRITICAL FIX)
    //     When Gateway stands at an enterable Doorway, Sanctum Door, Vault Door, Exit, or Lift,
    //     ANY vertical upward swipe/pull (dy <= -16px, REGARDLESS of swipe velocity!)
    //     enters the doorway / rides the lift and MUST NEVER trigger jump!
    //     (Diagonal jump-away swipes with |dxUp| >= 22px and |dxUp| > |dyUp| * 0.85 still jump!)
    // -------------------------------------------------------------------------
    if (
      !entry.flickLatched &&
      this._isDoorOrLiftContext() &&
      (dyAnchor <= GESTURE_INTERACT_UP_PX || dyUp <= GESTURE_INTERACT_UP_PX)
    ) {
      const smallHorizIntent =
        (entry.horizDir === 0 || Math.abs(vx) < 220) &&
        Math.abs(dxUp) < GESTURE_INTERACT_MAX_DX_PX &&
        Math.abs(Math.min(dyAnchor, dyUp)) >= Math.abs(dxUp) * GESTURE_INTERACT_DOMINANCE;

      if (smallHorizIntent) {
        if (entry.upHoldTimer !== null) {
          clearTimeout(entry.upHoldTimer);
          entry.upHoldTimer = null;
        }
        this._clearHorizCarry();
        this._cancelJumpPulse();
        entry.horizDir = 0;
        entry.postFlickActive = false;
        entry.lastFlickHoldMs = 0;
        entry.left = false;
        entry.right = false;
        entry.analogX = 0;
        entry.anchorX = x;
        entry.extremeX = x;
        if (entry.vertDir !== 'up') {
          entry.vertDir = 'up';
          entry.extremeY = y;
          entry.analogY = -1;
          this._triggerUpPulse(GESTURE_INTERACT_LATCH_MS);
        } else {
          if (y < entry.extremeY) entry.extremeY = y;
          entry.analogY = -1;
          this._recomputeState(true);
        }
        return;
      }
    }

    // -------------------------------------------------------------------------
    // 3B. Confident 2-Tier Upward FLICK -> Standard / Full Jump (#323)
    //     - Normal flick (20..45px) -> 185ms hold + 430ms ballistic commit
    //     - Long flick (>= 46px) -> 245ms full hold + 485ms ballistic commit
    // -------------------------------------------------------------------------
    const hasOtherWalk = this._hasOtherGestureHorizPointer(entry);
    const isDiagonalAwayFromDoor =
      this._isDoorOrLiftContext() &&
      Math.abs(dxUp) >= GESTURE_INTERACT_MAX_DX_PX &&
      Math.abs(dxUp) > Math.abs(dyUp) * 0.85;

    const isRunningStroke =
      entry.horizDir !== 0 ||
      (!this._isDoorOrLiftContext() && Math.abs(dxUp) >= GESTURE_DIAG_FLICK_MIN_DX_PX) ||
      isDiagonalAwayFromDoor;
    const standstillFlick =
      !this._isDoorOrLiftContext() &&
      !isRunningStroke &&
      !hasOtherWalk &&
      dyUp <= GESTURE_FLICK_DY_PX &&
      dtUpMs <= GESTURE_FLICK_MAX_MS &&
      vy <= GESTURE_FLICK_VELOCITY_Y &&
      Math.abs(vy) > Math.abs(vx) * 0.85;

    const secondaryThumbFlick =
      hasOtherWalk &&
      !this._isDoorOrLiftContext() &&
      dyUp <= GESTURE_RUN_FLICK_DY_PX &&
      dtUpMs <= GESTURE_RUN_FLICK_MAX_MS &&
      vy <= GESTURE_RUN_FLICK_VELOCITY_Y &&
      Math.abs(vy) >= Math.abs(vx) * 0.65;

    const runningDiagFlick =
      isRunningStroke &&
      (!this._isDoorOrLiftContext() || Math.abs(dxUp) >= GESTURE_INTERACT_MAX_DX_PX || Math.abs(vx) >= 220) &&
      dyUp <= GESTURE_RUN_FLICK_DY_PX &&
      dtUpMs <= GESTURE_RUN_FLICK_MAX_MS &&
      vy <= GESTURE_RUN_FLICK_VELOCITY_Y &&
      Math.abs(vy) >= Math.abs(vx) * GESTURE_RUN_FLICK_MIN_SLOPE &&
      Math.abs(dyUp) >= Math.abs(dxUp) * GESTURE_RUN_FLICK_MIN_SLOPE;

    if (
      !entry.flickLatched &&
      entry.vertDir !== 'up' &&
      (standstillFlick || runningDiagFlick || secondaryThumbFlick)
    ) {
      if (entry.upHoldTimer !== null) {
        clearTimeout(entry.upHoldTimer);
        entry.upHoldTimer = null;
      }
      if (entry.jumpTimer !== null) {
        clearTimeout(entry.jumpTimer);
      }

      const holdMs = this._resolveFlickHoldMs(dyUp);
      const alreadyWalking = entry.horizDir !== 0 && entry.horizStartTime > 0 && now - entry.horizStartTime >= 75;
      if (
        !this._isDoorOrLiftContext() &&
        !hasOtherWalk &&
        entry.horizDir === 0 &&
        Math.abs(dxUp) >= GESTURE_DIAG_FLICK_MIN_DX_PX
      ) {
        entry.horizDir = dxUp < 0 ? -1 : 1;
        entry.horizStartTime = now;
        entry.extremeX = x;
      }
      if (entry.horizDir !== 0) {
        entry.left = entry.horizDir < 0;
        entry.right = entry.horizDir > 0;
        entry.analogX = entry.horizDir * Math.max(0.98, Math.abs(entry.analogX));
      }
      entry.wasRunningBeforeFlick = alreadyWalking;
      entry.flickLatched = true;
      entry.flickHoldMs = holdMs;
      entry.flickPeakY = y;
      entry.flickLatchTime = now;
      entry.postFlickActive = true;
      entry.lastFlickTime = now;
      entry.lastFlickHoldMs = holdMs;
      entry.idleHorizSec = 0;
      entry.lastHorizMoveTime = now;
      entry.vertDir = null;
      entry.analogY = 0;
      entry.jumpHeld = true;
      entry.jumpHoldRemainingSec = holdMs / 1000;

      this._triggerJumpPulse(holdMs);
      this._scheduleMidAirStopWatchdog(entry);

      entry.jumpTimer = setTimeout(() => {
        entry.jumpTimer = null;
        entry.jumpHeld = false;
        entry.jumpHoldRemainingSec = 0;
        this._recomputeState(true);
      }, holdMs);
      return;
    }

    // -------------------------------------------------------------------------
    // 4. Controlled Slide UP / DOWN -> Doors, Lifts, Sub & Glide ONLY (NEVER jumps!)
    // -------------------------------------------------------------------------
    if (!entry.flickLatched) {
      let dy = y - entry.anchorY;

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

  /**
   * Dedicated touch-feel handler for all 5 Gateway Mini-Games ('core_descent', 'reef_swim', 'frill_glide', 'aqueduct_sanctum', 'rapids_surf', 'vault'):
   * - core_descent / reef_swim / frill_glide: <=10px X & <=12px Y smooth 2D analog steering (zero jump-flick hijacking)
   * - aqueduct_sanctum / puzzle: 16px crisp 4-way cardinal tile-stepping (fast upward swipe steps UP, never misfires jump/stomp)
   * - rapids_surf / skimmer: 10px smooth continuous lane carving + <=-18px upward swipe wave-hop
   * - vault: instant zero-latency tap-anywhere tumbler lock
   */
  _updateMiniGameGesturePointer(entry, x, y, now, gmode) {
    if (gmode === 'vault') {
      this._recomputeState();
      return;
    }

    if (gmode === 'puzzle' || gmode === 'aqueduct_sanctum') {
      const stepThresh = 15;
      const leash = 32;
      const recoilReverse = 14;
      let dx = x - entry.anchorX;
      let dy = y - entry.anchorY;

      // Instant 180-degree recoil reversal along the active cardinal axis
      if (entry.horizDir === 1) {
        if (x > entry.extremeX) entry.extremeX = x;
        if (entry.extremeX - x >= recoilReverse) {
          entry.anchorX = x + stepThresh + 1;
          entry.anchorY = y;
          entry.extremeX = x;
          entry.extremeY = y;
          dx = x - entry.anchorX;
          dy = 0;
        }
      } else if (entry.horizDir === -1) {
        if (x < entry.extremeX) entry.extremeX = x;
        if (x - entry.extremeX >= recoilReverse) {
          entry.anchorX = x - stepThresh - 1;
          entry.anchorY = y;
          entry.extremeX = x;
          entry.extremeY = y;
          dx = x - entry.anchorX;
          dy = 0;
        }
      } else if (entry.vertDir === 'down') {
        if (y > entry.extremeY) entry.extremeY = y;
        if (entry.extremeY - y >= recoilReverse) {
          entry.anchorY = y + stepThresh + 1;
          entry.anchorX = x;
          entry.extremeY = y;
          entry.extremeX = x;
          dy = y - entry.anchorY;
          dx = 0;
        }
      } else if (entry.vertDir === 'up') {
        if (y < entry.extremeY) entry.extremeY = y;
        if (y - entry.extremeY >= recoilReverse) {
          entry.anchorY = y - stepThresh - 1;
          entry.anchorX = x;
          entry.extremeY = y;
          entry.extremeX = x;
          dy = y - entry.anchorY;
          dx = 0;
        }
      }

      if (Math.hypot(dx, dy) < stepThresh) {
        entry.horizDir = 0;
        entry.left = false;
        entry.right = false;
        entry.analogX = 0;
        entry.vertDir = null;
        entry.analogY = 0;
        entry.extremeX = x;
        entry.extremeY = y;
      } else if (Math.abs(dx) >= Math.abs(dy)) {
        const nextH = dx < 0 ? -1 : 1;
        if (entry.horizDir !== nextH) {
          entry.extremeX = x;
        } else {
          entry.extremeX = nextH > 0 ? Math.max(entry.extremeX, x) : Math.min(entry.extremeX, x);
        }
        entry.vertDir = null;
        entry.analogY = 0;
        entry.horizDir = nextH;
        entry.left = nextH < 0;
        entry.right = nextH > 0;
        entry.analogX = entry.horizDir;
        entry.puzzleSwipeDir = nextH < 0 ? 'left' : 'right';
        if (Math.abs(dx) > leash) entry.anchorX = x - Math.sign(dx) * leash;
        // Track orthogonal axis cleanly so immediate 90-degree turns (e.g. Right -> Up) respond in ~15px!
        entry.anchorY += (y - entry.anchorY) * 0.65;
        entry.extremeY = y;
      } else {
        const nextV = dy < 0 ? 'up' : 'down';
        if (entry.vertDir !== nextV) {
          entry.extremeY = y;
        } else {
          entry.extremeY = nextV === 'down' ? Math.max(entry.extremeY, y) : Math.min(entry.extremeY, y);
        }
        entry.horizDir = 0;
        entry.left = false;
        entry.right = false;
        entry.analogX = 0;
        entry.vertDir = nextV;
        entry.analogY = nextV === 'up' ? -1 : 1;
        entry.puzzleSwipeDir = entry.vertDir;
        if (Math.abs(dy) > leash) entry.anchorY = y - Math.sign(dy) * leash;
        entry.anchorX += (x - entry.anchorX) * 0.65;
        entry.extremeX = x;
      }
      this._recomputeState();
      return;
    }

    // Smooth X steering for submarine, glide & skimmer (10px deadzone, dynamic 14px reversal)
    const xDead = 10;
    const xSpan = 38;
    let dx = x - entry.anchorX;
    if (entry.horizDir === 1 || dx > xDead) {
      if (x > entry.extremeX) entry.extremeX = x;
      if (entry.extremeX - x > 14) {
        entry.anchorX = x + (xDead + 3);
        entry.extremeX = x;
        entry.horizDir = -1;
        dx = x - entry.anchorX;
      } else if (dx > 52) {
        entry.anchorX = x - 52;
        dx = 52;
      }
    } else if (entry.horizDir === -1 || dx < -xDead) {
      if (x < entry.extremeX) entry.extremeX = x;
      if (x - entry.extremeX > 14) {
        entry.anchorX = x - (xDead + 3);
        entry.extremeX = x;
        entry.horizDir = 1;
        dx = x - entry.anchorX;
      } else if (dx < -52) {
        entry.anchorX = x + 52;
        dx = -52;
      }
    }

    if (Math.abs(dx) > xDead) {
      entry.horizDir = dx < 0 ? -1 : 1;
      const mag = 0.24 + 0.76 * Math.min(1, (Math.abs(dx) - xDead) / xSpan);
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

    if (gmode === 'skimmer' || gmode === 'rapids_surf') {
      // Rapids Tail-Surf: upward swipe <= -18px triggers crisp wave-hop jump while maintaining lateral carve!
      if (entry.flickLatched) {
        if (y < entry.flickPeakY) entry.flickPeakY = y;
        if (y - entry.flickPeakY >= 14 || now - entry.flickLatchTime >= 180) {
          entry.flickLatched = false;
          entry.upOnsetY = y;
          entry.upOnsetTime = now;
        }
      } else if (y > entry.upOnsetY) {
        entry.upOnsetY = y;
        entry.upOnsetTime = now;
      }
      if (!entry.flickLatched && y - entry.upOnsetY <= -18) {
        entry.flickLatched = true;
        entry.flickPeakY = y;
        entry.flickLatchTime = now;
        this._triggerJumpPulse(120);
        return;
      }
      this._recomputeState();
      return;
    }

    // Submarine & Sky-Wing Glide: <= 12px vertical deadzone with dynamic 14px Y reversal!
    const yDead = 12;
    const ySpan = 38;
    let dy = y - entry.anchorY;
    if (entry.vertDir === 'down' || dy > yDead) {
      if (y > entry.extremeY) entry.extremeY = y;
      if (entry.extremeY - y > 14) {
        entry.anchorY = y + (yDead + 3);
        entry.extremeY = y;
        entry.vertDir = 'up';
        dy = y - entry.anchorY;
      } else if (dy > 52) {
        entry.anchorY = y - 52;
        dy = 52;
      }
    } else if (entry.vertDir === 'up' || dy < -yDead) {
      if (y < entry.extremeY) entry.extremeY = y;
      if (y - entry.extremeY > 14) {
        entry.anchorY = y - (yDead + 3);
        entry.extremeY = y;
        entry.vertDir = 'down';
        dy = y - entry.anchorY;
      } else if (dy < -52) {
        entry.anchorY = y + 52;
        dy = -52;
      }
    }

    if (Math.abs(dy) > yDead) {
      entry.vertDir = dy < 0 ? 'up' : 'down';
      const mag = 0.24 + 0.76 * Math.min(1, (Math.abs(dy) - yDead) / ySpan);
      entry.analogY = (dy < 0 ? -1 : 1) * mag;
    } else {
      entry.vertDir = null;
      entry.extremeY = y;
      entry.analogY = 0;
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

    if (entry.vaultFiredOnDown) {
      return;
    }

    const gmode = this._activeGameMode();
    if (!isCancel && (gmode === 'puzzle' || gmode === 'aqueduct_sanctum') && entry.puzzleSwipeDir && duration <= 180) {
      // Ensure quick <180ms cardinal swipes in Aqueduct Sanctums hold long enough for 1 exact tile step
      if (entry.puzzleSwipeDir === 'left') this._triggerLeftPulse(85);
      else if (entry.puzzleSwipeDir === 'right') this._triggerRightPulse(85);
      else if (entry.puzzleSwipeDir === 'up') this._triggerUpPulse(85);
      else if (entry.puzzleSwipeDir === 'down') this._triggerDownPulse(85);
      return;
    }

    // Confident remaining ballistic horizontal commit from lastFlickTime (#323: 430ms normal / 485ms long;
    // paired with input.isLiveHorizHeld = false so Smart Descending Island Brake settles cleanly onto 1-col & 2-col islands!)
    if (
      !isCancel &&
      gmode === 'tower' &&
      (entry.flickLatched || entry.postFlickActive) &&
      entry.horizDir !== 0 &&
      (entry.idleHorizSec || 0) < GESTURE_MIDAIR_STOP_IDLE_MS / 1000
    ) {
      const holdMs = entry.lastFlickHoldMs || entry.flickHoldMs || GESTURE_FLICK_STD_MS;
      const baseCommitMs =
        holdMs >= GESTURE_FLICK_LONG_MS ? GESTURE_FLICK_COMMIT_LONG_MS : GESTURE_FLICK_COMMIT_STD_MS;
      const targetCommitMs = entry.wasRunningBeforeFlick ? baseCommitMs - 70 : baseCommitMs;
      const elapsedSinceFlick = Math.max(0, now - (entry.lastFlickTime || entry.flickLatchTime || now));
      const carryMs = Math.round(Math.max(0, targetCommitMs - elapsedSinceFlick));
      const carryAnalogX = entry.horizDir * Math.max(0.98, Math.abs(entry.analogX || 1));
      if (carryMs > 0) this._latchHorizCarry(entry.horizDir, carryAnalogX, carryMs);
      else this._clearHorizCarry();
      return;
    }

    this._clearHorizCarry();

    // 5. Quick Stationary TAP:
    //    - If _canInteract && inside middle 36%x50% Gateway/doorway zone (<=14px move) -> triggerInteract!
    //    - Otherwise (<=16px capacitive wobble) -> 110ms Fire Pulse!
    if (
      !isCancel &&
      !entry.flickLatched &&
      !entry.postFlickActive &&
      entry.vertDir === null &&
      !entry.puzzleSwipeDir &&
      duration <= GESTURE_TAP_MAX_MS &&
      entry.maxDist <= GESTURE_TAP_MAX_MOVE_PX
    ) {
      if (
        gmode === 'tower' &&
        this._canInteract &&
        entry.maxDist <= GESTURE_CENTER_TAP_MOVE_PX &&
        this._isInCenterInteractZone(entry.startX, entry.startY)
      ) {
        this.triggerInteract(
          this._interactKind === 'whip'
            ? 'whip'
            : this._interactKind === 'fire'
            ? 'fire'
            : 'up'
        );
      } else {
        this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
      }
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

    const gmode = this._activeGameMode();
    if (gmode === 'puzzle' || gmode === 'aqueduct_sanctum') {
      // Crisp symmetric 4-way cardinal mapping inside Aqueduct Sanctums
      const cardDead = entry.up || entry.down || entry.left || entry.right ? 0.22 : 0.28;
      if (Math.hypot(nx, ny) < cardDead) {
        entry.left = entry.right = entry.up = entry.down = false;
        entry.analogX = 0;
        entry.analogY = 0;
      } else if (Math.abs(px) >= Math.abs(py)) {
        entry.left = nx < 0;
        entry.right = nx > 0;
        entry.up = false;
        entry.down = false;
        entry.analogX = Math.sign(nx);
        entry.analogY = 0;
      } else {
        entry.left = false;
        entry.right = false;
        entry.up = ny < 0;
        entry.down = ny > 0;
        entry.analogX = 0;
        entry.analogY = Math.sign(ny);
      }
    } else {
      const upT = entry.up ? -0.40 : this._isDoorOrLiftContext() ? -0.44 : -0.56;
      const dnT = entry.down ? 0.40 : 0.56;
      const vDom = Math.abs(py) >= Math.abs(px) * (entry.up || entry.down ? 0.58 : 0.80);
      entry.up = ny <= upT && vDom;
      entry.down = ny >= dnT && vDom;
    }

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
      flickHoldMs: 0,
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

    if (entry.flickLatched) {
      if (y < entry.flickPeakY) entry.flickPeakY = y;
      if (
        y - entry.flickPeakY >= GESTURE_FLICK_REARM_PX ||
        (now - entry.flickLatchTime >= GESTURE_FLICK_REARM_MS && dyStep >= -0.8)
      ) {
        entry.flickLatched = false;
        entry.flickHoldMs = 0;
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
    const dxUp = x - entry.upOnsetX;
    const dyUp = y - entry.upOnsetY;
    const dtUpMs = Math.max(0, now - entry.upOnsetTime);
    const dyAnchor = y - entry.anchorY;

    // Context-aware doorway/lift swipe in Tilt mode -> enters doorway cleanly without jumping!
    if (
      entry.type === 'tiltTouch' &&
      !entry.flickLatched &&
      this._isDoorOrLiftContext() &&
      (dyAnchor <= GESTURE_INTERACT_UP_PX || dyUp <= GESTURE_INTERACT_UP_PX) &&
      Math.abs(dxUp) < GESTURE_INTERACT_MAX_DX_PX &&
      Math.abs(Math.min(dyAnchor, dyUp)) >= Math.abs(dxUp) * GESTURE_INTERACT_DOMINANCE
    ) {
      if (entry.upHoldTimer !== null) {
        clearTimeout(entry.upHoldTimer);
        entry.upHoldTimer = null;
      }
      this._cancelJumpPulse();
      if (entry.vertDir !== 'up') {
        entry.vertDir = 'up';
        entry.extremeY = y;
        entry.analogY = -1;
        this._triggerUpPulse(GESTURE_INTERACT_LATCH_MS);
      } else {
        entry.analogY = -1;
        this._recomputeState(true);
      }
      return;
    }

    // Proportional upward flick -> Jump
    const flickDyReq = entry.type === 'rightPad' ? -24 : GESTURE_FLICK_DY_PX;
    const flickVyReq = entry.type === 'rightPad' ? -380 : GESTURE_FLICK_VELOCITY_Y;
    if (
      !entry.flickLatched &&
      entry.vertDir !== 'up' &&
      dyUp <= flickDyReq &&
      dtUpMs <= GESTURE_FLICK_MAX_MS &&
      vy <= flickVyReq &&
      Math.abs(vy) > Math.abs(vx) * 0.65
    ) {
      if (entry.upHoldTimer !== null) {
        clearTimeout(entry.upHoldTimer);
        entry.upHoldTimer = null;
      }
      if (entry.jumpTimer !== null) clearTimeout(entry.jumpTimer);
      const holdMs = this._resolveFlickHoldMs(dyUp);
      entry.flickLatched = true;
      entry.flickHoldMs = holdMs;
      entry.flickPeakY = y;
      entry.flickLatchTime = now;
      entry.vertDir = null;
      entry.analogY = 0;
      entry.jumpHeld = true;
      this._triggerJumpPulse(holdMs);
      entry.jumpTimer = setTimeout(() => {
        entry.jumpTimer = null;
        entry.jumpHeld = false;
        this._recomputeState(true);
      }, holdMs);
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
      if (
        this._canInteract &&
        entry.maxDist <= GESTURE_CENTER_TAP_MOVE_PX &&
        this._isInCenterInteractZone(entry.startX, entry.startY)
      ) {
        this.triggerInteract(
          this._interactKind === 'whip'
            ? 'whip'
            : this._interactKind === 'fire'
            ? 'fire'
            : 'up'
        );
      } else if (entry.type === 'rightPad') {
        this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
      } else {
        const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 400;
        if (entry.startX < vw * 0.5) {
          this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
        } else {
          this._triggerJumpPulse(GESTURE_FLICK_STD_MS);
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

      // Never intercept modal overlays or puzzle HUD widgets
      if (target.closest('.overlay:not(.hidden), #puzzle-hud')) return;

      // Tappable #action-prompt badge: trigger frame-1 interact AND let main.js listener run cleanly
      if (target.closest('#action-prompt')) {
        if (this._canInteract) {
          this.triggerInteract(
            this._interactKind === 'whip'
              ? 'whip'
              : this._interactKind === 'fire'
              ? 'fire'
              : 'up'
          );
        }
        return;
      }

      // Calibrate button in tilt bar: allow native click + ensure neutral calibration
      if (target.closest('#btn-calibrate-tilt')) {
        this.calibrateTilt();
        return;
      }

      // Never intercept HUD chrome buttons/controls
      if (target.closest('#hud button, #hud a, #hud select, #hud input')) return;

      // 1. Direct Action Buttons (#btn-jump, #btn-fire, #btn-whip active across ALL 4 modes, multi-touch + slide + 12px halo)
      //    Checked BEFORE clearing horizontal carry so tapping JUMP/WHIP/PULSE never kills slide momentum!
      let jumpBtn = target.closest('#btn-jump');
      let fireBtn = target.closest('#btn-fire');
      let whipBtn = target.closest('#btn-whip');
      if (!jumpBtn && !fireBtn && !whipBtn && !target.closest('button, select, input, a, #dpad, #joystick-zone')) {
        const nearActionBtn = this._findActionButtonHalo(e.clientX, e.clientY, 12);
        if (nearActionBtn?.id === 'btn-jump') jumpBtn = nearActionBtn;
        else if (nearActionBtn?.id === 'btn-fire') fireBtn = nearActionBtn;
        else if (nearActionBtn?.id === 'btn-whip') whipBtn = nearActionBtn;
      }
      if (jumpBtn || fireBtn || whipBtn) {
        if (e.cancelable) e.preventDefault();
        const el = jumpBtn || fireBtn || whipBtn;
        const action = jumpBtn ? 'jump' : fireBtn ? 'fire' : 'whip';
        el.classList.add('active');
        this._activePointers.set(e.pointerId, { type: 'button', action, el });
        this.justPressed[action] = true;
        this.haptic(action === 'whip' ? 16 : action === 'jump' ? 14 : 12);
        this._tryPointerCapture(el, e.pointerId);
        this._recomputeState(true);
        return;
      }

      // Any new directional / stage touch cancels stale ballistic horizontal carry
      this._clearHorizCarry();

      // 2. Virtual Joystick Widget (#joystick-zone) — single-pointer ownership prevents thumb stealing
      const joystickEl = target.closest('#joystick-zone');
      if (joystickEl && !this._hasPointerOfType('joystick')) {
        if (e.cancelable) e.preventDefault();
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

      // Core Astrolabe Vault: tap ANYWHERE on screen across ALL 4 control modes locks ring with 0ms latency!
      if (this._activeGameMode() === 'vault') {
        if (e.cancelable) e.preventDefault();
        const entry = this._createGestureEntry(e);
        entry.vaultFiredOnDown = true;
        this._activePointers.set(e.pointerId, entry);
        this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
        return;
      }

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
        if (entry.el && !this._hasOtherPointerOnEl(entry, entry.el)) {
          entry.el.classList.remove('active');
        }
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

    // Full Keyboard Fallback across all 4 control modes (tracks physical key codes so releasing ArrowRight while holding KeyD never drops 'right'!)
    const keyMap = this._keyMap;
    const syncHeldActionsFromCodes = () => {
      this._heldKeys.clear();
      for (const code of this._heldKeyCodes) {
        const act = keyMap[code];
        if (act) this._heldKeys.add(act);
      }
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
      this._heldKeyCodes.add(e.code);
      syncHeldActionsFromCodes();
      if (action in this.justPressed) {
        this.justPressed[action] = true;
      }
      this._recomputeState();
    };

    this._onKeyUp = (e) => {
      const action = keyMap[e.code];
      if (!action) return;
      this._heldKeyCodes.delete(e.code);
      syncHeldActionsFromCodes();
      this._recomputeState();
    };

    this._onWindowBlur = () => {
      this.resetState();
    };

    this._onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        this.resetState();
      }
    };

    this._onGamepadConnected = () => {
      this._gamepadConnected = true;
    };

    this._onGamepadDisconnected = () => {
      if (this._pollGamepad()) {
        this._recomputeState(true);
      }
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onWindowBlur);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  _tryPointerCapture(el, pointerId) {
    if (el && typeof el.setPointerCapture === 'function') {
      try {
        el.setPointerCapture(pointerId);
      } catch (_) {}
    }
  }
}
