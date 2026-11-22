// Towering Waters: Gateway's Descent — 4-Mode Precision Touch, Tail-Whip, Context-Aware Sanctum & Keyboard Controller
// Leaf module: zero internal src/ imports.

export const CONTROL_MODES = ['joystick', 'gesture', 'dpad', 'tilt'];

const MODE_ALIASES = {
  hybrid: 'joystick',
  buttons: 'dpad',
};

// Dynamic Floating Virtual Thumbstick Constants ('joystick' — New Gold-Standard Default!)
const JOYSTICK_MAX_RADIUS = 46;         // Visual ring radius (104px ring / 42px puck)
const JOYSTICK_LEASH_RADIUS = 54;       // 1.17x anti-drift leash so thumb never escapes ring
const JOYSTICK_REVERSAL_PX = 28;        // Deliberate turnaround pull-back flips analogX in < 50ms
const JOYSTICK_TOWER_HDEAD = 0.15;      // ~7 CSS px tower horizontal deadzone

// Strict Precision Gesture Tuning Constants (Repaired 'gesture' Buttonless Glass Mode)
const GESTURE_HORIZ_DEADZONE_PX = 11;
const GESTURE_SECONDARY_HORIZ_DEADZONE_PX = 20;
const GESTURE_HORIZ_FULL_SPAN_PX = 44;  // 11px deadzone + 44px span = 55px full run
const GESTURE_HORIZ_MAX_LEASH_PX = 62;
const GESTURE_RECOIL_STOP_PX = 18;      // Raised 5px -> 18px so thumb-pad jitter NEVER stalls walk!
const GESTURE_REVERSAL_PX = 26;         // Raised 16px -> 26px for intentional fluid reversal
const GESTURE_STOP_SPEED_PX = 45;
// Natural human thumb horizontal sweep arcs ±25° (~tan 25.2° = 0.47)
const GESTURE_HORIZ_ARC_SLOPE = 0.47;

// Buttonless Tail-Whip Gesture Thresholds ('gesture' mode)
const GESTURE_WHIP_SLASH_MAX_MOVE_MS = 125;
const GESTURE_WHIP_SLASH_MAX_LIFT_MS = 135;
const GESTURE_WHIP_SLASH_MIN_DX_PX = 32;
const GESTURE_WHIP_SLASH_MIN_VX = 720;  // px/s
const GESTURE_WHIP_SLASH_DOMINANCE = 1.45;
const GESTURE_DOWN_FLICK_MIN_DY_PX = 36;
const GESTURE_DOWN_FLICK_MIN_VY = 480;  // px/s downward flick -> Tail-Whip!
const GESTURE_TWO_FINGER_TAP_MAX_MS = 210;
const GESTURE_TWO_FINGER_TAP_MAX_MOVE_PX = 22;

// Buttonless Horizontal Slash Tail-Whip Thresholds ('tilt' mode)
const TILT_SLASH_MIN_DX_PX = 26;
const TILT_SLASH_MIN_VX = 420;          // px/s
const TILT_SLASH_DOMINANCE = 1.25;
const TILT_SLASH_REARM_MS = 240;
const TILT_SLASH_REARM_REV_PX = 18;

// Context-aware doorway / lift interaction thresholds
const GESTURE_INTERACT_UP_PX = -16;
const GESTURE_INTERACT_MAX_DX_PX = 22;
const GESTURE_INTERACT_DOMINANCE = 1.15;
const GESTURE_INTERACT_LATCH_MS = 180;
const GESTURE_CENTER_TAP_MOVE_PX = 14;

// Non-doorway controlled vertical slide thresholds
const GESTURE_SLIDE_UP_PX = -26;
const GESTURE_SLIDE_UP_MAX_SPEED = 540; // px/s
const GESTURE_SLIDE_UP_HOLD_MS = 65;
const GESTURE_SLIDE_DOWN_PX = 26;
const GESTURE_VERT_RELEASE_PX = 14;
const GESTURE_VERT_REVERSAL_PX = 18;
const GESTURE_VERT_MAX_LEASH_PX = 60;
const GESTURE_VERT_DOMINANCE = 1.12;

// Standstill upward jump flick thresholds
const GESTURE_FLICK_DY_PX = -26;
const GESTURE_FLICK_MAX_MS = 135;
const GESTURE_FLICK_VELOCITY_Y = -430;  // px/s (upward is negative)

// Running / diagonal upward jump flick thresholds
const GESTURE_RUN_FLICK_DY_PX = -20;
const GESTURE_RUN_FLICK_MAX_MS = 140;
const GESTURE_RUN_FLICK_VELOCITY_Y = -290; // px/s
const GESTURE_RUN_FLICK_MIN_SLOPE = 0.50;
const GESTURE_DIAG_FLICK_MIN_DX_PX = 11;

// Calibrated 2-tier flick jump holds synced to 0.358s expressive Celeste/Mario jump apex
const GESTURE_FLICK_STD_MS = 230;
const GESTURE_FLICK_LONG_DY_PX = 46;
const GESTURE_FLICK_LONG_MS = 355;

// Zero runaway post-release sprint carry: 0ms on grounded release, <=45ms takeoff bridge on diagonal jump flick
const GESTURE_FLICK_TAKEOFF_BRIDGE_MS = 45;
const GESTURE_HORIZ_CARRY_MS = 0;
const GESTURE_FLICK_REARM_PX = 14;
const GESTURE_FLICK_REARM_MS = 145;

// Capacitive glass quick-tap tolerances
const GESTURE_TAP_MAX_MS = 210;
const GESTURE_TAP_MAX_MOVE_PX = 16;
const GESTURE_FIRE_PULSE_MS = 110;

// Tilt & Motion-Sensor Constants (Round 4 Progressive Curve + Wrist-Flick Tail-Whip)
const TILT_DEADZONE_DEG = 2.8;
const TILT_BASE_FULL_DEG = 16.0;
const TILT_ROLL_EXPONENT = 1.35;
const TILT_MIN_ACTIVE_ANALOG = 0.26;
const TILT_EMA_ALPHA = 0.55;

const MOTION_WHIP_LIN_ACCEL_THRESHOLD = 9.5; // m/s^2 linear accel hypot(ax, ay)
const MOTION_WHIP_GRAV_DELTA_THRESHOLD = 10.5; // m/s^2 high-pass delta of accelIncludingGravity
const MOTION_WHIP_GYRO_THRESHOLD = 215; // deg/s sharp wrist twist
const MOTION_WHIP_GYRO_JERK_ACCEL = 3.0; // m/s^2 accompanying linear/gravity jerk
const MOTION_WHIP_GYRO_ANG_ACCEL = 950; // deg/s^2 sharp angular snap acceleration
const MOTION_WHIP_COOLDOWN_MS = 300;
const SLASH_VFX_DURATION_MS = 220;

// Standard Gamepad Constants (W3C Standard Mapping)
const GAMEPAD_STICK_DEADZONE = 0.18;
const GAMEPAD_TRIGGER_THRESHOLD = 0.35;

function smoothstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

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
    this.motionSupported = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
    this.motionPermissionGranted = Boolean(
      this.motionSupported &&
      typeof window.DeviceMotionEvent?.requestPermission !== 'function'
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

    // Internal Tilt & Motion-Sensor Tracking
    this._tiltListenerAttached = false;
    this._motionListenerAttached = false;
    this._hasTiltSample = false;
    this._lastRawRoll = 0;
    this._smoothedRoll = 0;
    this._tiltLeft = false;
    this._tiltRight = false;
    this._tiltAnalogX = 0;
    this._lastCalibrateMs = -1000;
    this._lastMotionWhipMs = -10000;
    this._prevGravSample = null;
    this._prevGyroSample = null;
    this._lastWhipSource = '';
    this._slashArcs = [];
    this._slashVfxRaf = null;
    this._lastSlashVfx = null;

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

    // Live floating thumbstick & glass gesture reticle telemetry for HUD/canvas & QA
    this.floatingStickState = {
      active: false,
      originX: 0,
      originY: 0,
      puckX: 0,
      puckY: 0,
      maxRadius: JOYSTICK_MAX_RADIUS,
      leashRadius: JOYSTICK_LEASH_RADIUS,
    };
    this.gestureReticle = {
      active: false,
      anchorX: 0,
      anchorY: 0,
      thumbX: 0,
      thumbY: 0,
      horizDir: 0,
    };

    this._initializedMode = false;
    this.controlMode = 'joystick';
    const initialMode = options.mode || options.controlMode || 'joystick';
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
        // NOTE: Legacy 32ms mid-air jump-kill watchdog REMOVED (#603)! Pausing thumb after a jump-flick
        // never cuts jumpHeld or kills mid-air horizontal drive.
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

  /** Switches active touch control scheme and syncs data-control-mode across #app, #touch-controls & document.body. */
  setControlMode(mode) {
    const mapped = MODE_ALIASES[mode] || mode;
    const validMode = CONTROL_MODES.includes(mapped) ? mapped : 'joystick';
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
      const touchRoot = document.getElementById('touch-controls');
      if (touchRoot) {
        touchRoot.dataset.controlMode = validMode;
      }
      if (document.body) {
        document.body.dataset.controlMode = validMode;
      }

      // 100% Buttonless Glass in 'gesture' & 'tilt' modes; buttons shown ONLY in 'dpad' & 'joystick'
      const buttonless = validMode === 'gesture' || validMode === 'tilt';
      const clusterEl =
        document.getElementById('action-cluster') ||
        (typeof document.querySelector === 'function'
          ? document.querySelector('#touch-controls .touch-right')
          : null);
      if (clusterEl && clusterEl.style) {
        clusterEl.style.display = buttonless ? 'none' : '';
        clusterEl.style.pointerEvents = buttonless ? 'none' : '';
        clusterEl.setAttribute?.('aria-hidden', buttonless ? 'true' : 'false');
      }
      for (const btnId of ['btn-whip', 'btn-fire', 'btn-jump', 'btn-interact']) {
        const btnEl = document.getElementById(btnId);
        if (btnEl && btnEl.style) {
          btnEl.style.display = buttonless ? 'none' : '';
          btnEl.style.pointerEvents = buttonless ? 'none' : '';
          btnEl.setAttribute?.('aria-hidden', buttonless ? 'true' : 'false');
        }
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

  /** Requests iOS DeviceOrientationEvent + DeviceMotionEvent permissions if required; resolves true when active. */
  async requestTiltPermission() {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      this.tiltSupported = false;
      this.tiltPermissionGranted = false;
      return false;
    }

    this.tiltSupported = true;
    this.motionSupported = 'DeviceMotionEvent' in window;
    const DOE = window.DeviceOrientationEvent;
    const DME = window.DeviceMotionEvent;
    let orientationGranted = true;

    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        orientationGranted = result === 'granted';
      } catch (_) {
        orientationGranted = false;
      }
    }

    if (DME && typeof DME.requestPermission === 'function') {
      try {
        const mResult = await DME.requestPermission();
        this.motionPermissionGranted = mResult === 'granted';
      } catch (_) {
        this.motionPermissionGranted = false;
      }
    } else {
      this.motionPermissionGranted = this.motionSupported;
    }

    if (!orientationGranted) {
      this.tiltPermissionGranted = false;
      return false;
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
    this._prevGravSample = null;
    this._prevGyroSample = null;
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
      if (entry.zoneEl) {
        entry.zoneEl.classList.remove('active', 'floating-active');
        if (entry.zoneEl.style) entry.zoneEl.style.transform = '';
      }
      if (entry.dpadEl) entry.dpadEl.classList.remove('active');
    }
    this._activePointers.clear();
    this._heldKeys.clear();
    this._heldKeyCodes.clear();
    this.floatingStickState.active = false;
    this.floatingStickState.puckX = 0;
    this.floatingStickState.puckY = 0;
    this.gestureReticle.active = false;

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
    this._prevGravSample = null;
    this._prevGyroSample = null;

    if (typeof document !== 'undefined') {
      document
        .querySelectorAll(
          '.dpad-btn.active, #btn-jump.active, #btn-fire.active, #btn-whip.active, #btn-interact.active, #dpad.active, #joystick-zone.active, #joystick-zone.floating-active, #joystick-base.active, #joystick-base.floating-active, #joystick-puck.active, #joystick-knob.active, #tilt-bar.active, #tilt-puck.active'
        )
        .forEach((el) => el.classList.remove('active', 'floating-active'));
      const joyZone = this._getJoystickZoneEl();
      if (joyZone && joyZone.style) joyZone.style.transform = '';
      this._setPuckOffset(document.getElementById('dpad-puck'), 0, 0);
      this._setPuckOffset(this._getJoystickPuckEl(), 0, 0);
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

  _hasOtherGesturePointer(excludeEntry = null) {
    for (const entry of this._activePointers.values()) {
      if (entry !== excludeEntry && entry.type === 'gesture') {
        return true;
      }
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
    // Tight centered hero interact band ([0.36..0.64] horizontally) so right-half jumps never get swallowed!
    return nx >= 0.36 && nx <= 0.64 && ny >= 0.24 && ny <= 0.78;
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
    let startBtn = false;
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
      if (pressed(9)) startBtn = true;
    }

    // Rising-edge Gamepad Start -> Pause & A/B -> Cutscene Advance/Skip callbacks
    if (startBtn && !this._gpStartPrev) {
      this._onGamepadPause?.();
    }
    this._gpStartPrev = startBtn;
    if (jump && !this._gpAPrev) {
      this._onGamepadCutscene?.(false);
    }
    this._gpAPrev = jump;
    if (whip && !this._gpBPrev) {
      this._onGamepadCutscene?.(true);
    }
    this._gpBPrev = whip;

    this._gamepadConnected = foundPad;
    if (!foundPad && !this._gpActive) return false;

    const gmodeGp = this._activeGameMode();
    if (ax < -0.22) left = true;
    if (ax > 0.22) right = true;
    // In tower mode, require deliberate upward stick angle (ay < -0.68 && |ay| > |ax|*1.15) so slight drift while running NEVER enters doors!
    if (gmodeGp === 'tower') {
      if (ay < -0.68 && Math.abs(ay) > Math.abs(ax) * 1.15) up = true;
      if (ay > 0.62 && Math.abs(ay) > Math.abs(ax) * 1.1) down = true;
    } else {
      if (ay < -0.35) up = true;
      if (ay > 0.35) down = true;
    }
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

    const gmodeForTilt = this._activeGameMode();
    const suppressTiltRollForPuzzleTouch =
      (gmodeForTilt === 'puzzle' || gmodeForTilt === 'aqueduct_sanctum') &&
      (up || down || this._hasPointerOfType('gesture'));

    if (this.controlMode === 'tilt' && !left && !right && !suppressTiltRollForPuzzleTouch) {
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

  _triggerWhipPulse(durationMs = 125, opts = null) {
    if (this._whipPulseTimer !== null) {
      clearTimeout(this._whipPulseTimer);
    }
    this._whipPulseActive = true;
    this.justPressed.whip = true;
    this.haptic(opts && opts.hapticPattern ? opts.hapticPattern : 16);
    if (opts && opts.vfx) {
      this._spawnSlashVfx(opts.vfx);
    }
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

  _getJoystickZoneEl() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('joystick-zone') || document.getElementById('joystick-base');
  }

  _getJoystickPuckEl() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('joystick-puck') || document.getElementById('joystick-knob');
  }

  _positionFloatingJoystickZone(zoneEl, originX, originY) {
    if (!zoneEl || !zoneEl.style) return;
    const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 412;
    const vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 915;
    const rect = typeof zoneEl.getBoundingClientRect === 'function' ? zoneEl.getBoundingClientRect() : null;
    const halfW = rect && rect.width > 20 ? rect.width * 0.5 : 52;
    const halfH = rect && rect.height > 20 ? rect.height * 0.5 : 52;
    // Clamp ONLY the visible DOM ring inside the viewport so logical originX stays 100% unclipped on edge reversals!
    const visX = Math.max(halfW + 8, Math.min(vw - halfW - 8, originX));
    const visY = Math.max(halfH + 8, Math.min(vh - halfH - 8, originY));
    zoneEl.style.transform = `translate3d(${(visX - halfW).toFixed(1)}px, ${(visY - halfH).toFixed(1)}px, 0)`;
  }

  _isActionBtnVisible(btn) {
    if (this.controlMode === 'gesture' || this.controlMode === 'tilt') return false;
    if (!btn || typeof btn.getBoundingClientRect !== 'function') return false;
    if (btn.style && (btn.style.display === 'none' || btn.style.pointerEvents === 'none')) {
      return false;
    }
    if (btn.classList?.contains?.('hidden')) return false;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const cs = window.getComputedStyle(btn);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') {
        return false;
      }
    }
    const r = btn.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  _findActionButtonHalo(clientX, clientY, padPx = 10) {
    if (this.controlMode === 'gesture' || this.controlMode === 'tilt') return null;
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

    // Anatomical Right-Thumb Radial-Arc Priority Halos (#603):
    // JUMP gets +16px Priority-1 halo; PULSE & WHIP get +10px; contextual INTERACT gets +8px.
    const candidates = [
      { btn: document.getElementById('btn-jump'), halo: Math.max(16, padPx), priority: 1 },
      { btn: document.getElementById('btn-fire'), halo: Math.max(10, Math.min(12, padPx)), priority: 2 },
      { btn: document.getElementById('btn-whip'), halo: Math.max(10, Math.min(12, padPx)), priority: 2 },
      { btn: this._canInteract ? document.getElementById('btn-interact') : null, halo: 8, priority: 3 },
    ];
    let bestBtn = null;
    let bestScore = Infinity;

    for (const c of candidates) {
      const btn = c.btn;
      if (!this._isActionBtnVisible(btn)) continue;
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.5;
      const maxR = Math.max(r.width, r.height) * 0.5 + c.halo;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d <= maxR) {
        // Give Priority-1 JUMP a crisp 4px tie-break edge against accidental neighboring hits
        const score = d - (c.priority === 1 ? 4 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestBtn = btn;
        }
      }
    }
    return bestBtn;
  }

  // Pointer-locked action buttons (#603): once pressed, a thumb rolling across gaps NEVER hijacks another button!
  _updateButtonSlidePointer(_entry, _clientX, _clientY) {
    return;
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

      // Buttonless Tail-Whip gesture tracking (down-flick, quick horizontal slash & 2-finger tap)
      isSecondaryFinger: false,
      twoFingerWhipConsumed: false,
      downWhipLatched: false,
      peakSlashVx: 0,
      slashCandidate: false,

      samples: [{ x, y, t: ts.now }],
    };
  }

  _syncGestureReticle(entry) {
    if (!entry || entry.type !== 'gesture' || this.controlMode !== 'gesture') {
      this.gestureReticle.active = false;
      return;
    }
    this.gestureReticle.active = true;
    this.gestureReticle.anchorX = entry.anchorX;
    this.gestureReticle.anchorY = entry.anchorY;
    this.gestureReticle.thumbX = entry.lastX;
    this.gestureReticle.thumbY = entry.lastY;
    this.gestureReticle.horizDir = entry.horizDir || 0;
    if (
      typeof document !== 'undefined' &&
      typeof requestAnimationFrame === 'function' &&
      this._slashVfxRaf === null
    ) {
      this._slashVfxRaf = requestAnimationFrame(() => this._renderSlashVfx());
    }
  }

  // Legacy 32ms mid-air jump-kill watchdog REMOVED (#603)!
  _scheduleMidAirStopWatchdog(_entry) {
    return;
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
        // Deliberate >= 18px thumb recoil brake -> neutral stop (preserves active jump arc!)
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
        // Deliberate >= 18px thumb recoil brake -> neutral stop (preserves active jump arc!)
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

    // Track peak horizontal slash velocity during first 125ms for crisp buttonless Tail-Whip slash detection
    const elapsedSinceDownMs = Math.max(0, now - entry.startTime);
    if (
      !entry.flickLatched &&
      entry.vertDir === null &&
      elapsedSinceDownMs <= GESTURE_WHIP_SLASH_MAX_MOVE_MS
    ) {
      const { vx: slashVx } = this._computeSlashVelocity(entry, x, y, now, entry.startX, entry.startY, entry.startTime);
      const bestVx = Math.abs(instVx) > Math.abs(slashVx) ? instVx : slashVx;
      if (Math.abs(bestVx) > Math.abs(entry.peakSlashVx || 0)) {
        entry.peakSlashVx = bestVx;
      }
      const totalDxNow = x - entry.startX;
      const totalDyNow = y - entry.startY;
      if (
        Math.abs(totalDxNow) >= GESTURE_WHIP_SLASH_MIN_DX_PX &&
        Math.abs(entry.peakSlashVx) >= GESTURE_WHIP_SLASH_MIN_VX &&
        Math.abs(totalDxNow) > Math.abs(totalDyNow) * GESTURE_WHIP_SLASH_DOMINANCE
      ) {
        entry.slashCandidate = true;
      }
    }

    if (Math.abs(dx) > activeHorizDeadzone) {
      this._clearHorizCarry();
      const nextHorizDir = dx < 0 ? -1 : 1;
      if (nextHorizDir !== entry.horizDir) {
        entry.horizStartTime = now;
      }
      entry.horizDir = nextHorizDir;
      const rawMag = Math.min(1, (Math.abs(dx) - activeHorizDeadzone) / GESTURE_HORIZ_FULL_SPAN_PX);
      const baseMag = 0.28 + 0.72 * smoothstep01(rawMag);
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
        // Fast Down-Flick Tail-Whip (#603): dy >= 36px & downVy >= 480 px/s away from lift/wall-strip fires Tail-Whip cleanly!
        const downRef = entry.samples.length > 0 ? entry.samples[0] : null;
        const downVelWin =
          downRef && now > downRef.t ? (y - downRef.y) / Math.max(0.012, (now - downRef.t) / 1000) : 0;
        const downVy = Math.max(vy, dyStep / dtStepSec, downVelWin);
        if (
          !entry.downWhipLatched &&
          !this._isDoorOrLiftContext() &&
          dy >= GESTURE_DOWN_FLICK_MIN_DY_PX &&
          downVy >= GESTURE_DOWN_FLICK_MIN_VY &&
          Math.abs(dy) >= dxVert * 1.15
        ) {
          entry.downWhipLatched = true;
          this._lastWhipSource = 'gesture_down_flick';
          this._triggerWhipPulse(135, {
            hapticPattern: [14, 22],
            vfx: {
              kind: 'slash',
              x1: entry.anchorX,
              y1: entry.anchorY,
              x2: x,
              y2: y,
              dir: entry.horizDir || 1,
            },
          });
          this._syncGestureReticle(entry);
          return;
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
        entry.downWhipLatched = false;
      }
    }

    this._syncGestureReticle(entry);
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

  _computeSlashVelocity(entry, x, y, now, onsetX, onsetY, onsetTime) {
    const dtOnsetSec = Math.max(4, now - onsetTime) / 1000;
    const vxChord = (x - onsetX) / dtOnsetSec;
    const vyChord = (y - onsetY) / dtOnsetSec;

    let ref = null;
    for (let i = entry.samples.length - 2; i >= 0; i--) {
      const s = entry.samples[i];
      const dt = now - s.t;
      if (dt >= 12 && (Math.abs(x - s.x) >= 12 || dt >= 24)) {
        ref = s;
        if (dt >= 40) break;
      }
    }

    if (!ref) {
      return { vx: vxChord, vy: vyChord };
    }

    const dtWinSec = Math.max(0.004, (now - ref.t) / 1000);
    const vxWin = (x - ref.x) / dtWinSec;
    const vyWin = (y - ref.y) / dtWinSec;

    if (Math.abs(vxWin) > Math.abs(vxChord)) {
      return { vx: vxWin, vy: vyWin };
    }
    return { vx: vxChord, vy: vyChord };
  }

  _finishGesturePointer(entry, e, isCancel) {
    const now = this._resolveTimestampMs(e, entry);
    const finalX = e && typeof e.clientX === 'number' ? e.clientX : entry.lastX;
    const finalY = e && typeof e.clientY === 'number' ? e.clientY : entry.lastY;
    if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      const finalDist = Math.hypot(finalX - entry.startX, finalY - entry.startY);
      if (finalDist > entry.maxDist) entry.maxDist = finalDist;
    }
    const duration = Math.max(0, now - entry.startTime);

    this._cleanupPointerTimers(entry);
    entry.jumpHeld = false;
    if (!this._hasOtherGesturePointer(entry)) {
      this.gestureReticle.active = false;
    }

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

    // Minimal takeoff bridge (<= 45ms) ONLY on diagonal jump-flick release so real 120Hz physics governs the arc & landing!
    // Grounded releases ALWAYS have 0ms carry (instant crisp stop via game.js GROUND_FRICTION).
    if (
      !isCancel &&
      gmode === 'tower' &&
      (entry.flickLatched || entry.postFlickActive) &&
      entry.horizDir !== 0 &&
      (entry.idleHorizSec || 0) < 0.08
    ) {
      const elapsedSinceFlick = Math.max(0, now - (entry.lastFlickTime || entry.flickLatchTime || now));
      const carryMs = Math.round(Math.max(0, GESTURE_FLICK_TAKEOFF_BRIDGE_MS - elapsedSinceFlick));
      const carryAnalogX = entry.horizDir * Math.max(0.95, Math.abs(entry.analogX || 1));
      if (carryMs > 0) this._latchHorizCarry(entry.horizDir, carryAnalogX, carryMs);
      else this._clearHorizCarry();
      return;
    }

    this._clearHorizCarry();

    if (isCancel || entry.downWhipLatched) {
      return;
    }

    // 5A. Buttonless Two-Finger Tap Anywhere -> 360° Tail-Whip!
    //     Works while holding/sliding thumb 1 to walk (never interrupts thumb 1!) OR simultaneous 2-finger tap!
    const otherGestureActive = this._hasOtherGesturePointer(entry);
    if (
      !entry.flickLatched &&
      !entry.postFlickActive &&
      entry.vertDir === null &&
      !entry.puzzleSwipeDir &&
      !entry.twoFingerWhipConsumed &&
      (entry.isSecondaryFinger || otherGestureActive) &&
      duration < GESTURE_TWO_FINGER_TAP_MAX_MS &&
      entry.maxDist < GESTURE_TWO_FINGER_TAP_MAX_MOVE_PX
    ) {
      // If another pointer is ALSO a fresh simultaneous stationary tap, consume it so lifting it won't fire stray Hydro-Pulse
      for (const other of this._activePointers.values()) {
        if (
          other !== entry &&
          other.type === 'gesture' &&
          other.horizDir === 0 &&
          other.vertDir === null &&
          !other.flickLatched &&
          other.maxDist < GESTURE_TWO_FINGER_TAP_MAX_MOVE_PX &&
          now - other.startTime < GESTURE_TWO_FINGER_TAP_MAX_MS
        ) {
          other.twoFingerWhipConsumed = true;
        }
      }
      this._lastWhipSource = 'gesture_two_finger_tap';
      this._triggerWhipPulse(135, {
        hapticPattern: [14, 22],
        vfx: {
          kind: 'ring',
          x1: entry.startX,
          y1: entry.startY,
          x2: finalX,
          y2: finalY,
          dir: 1,
        },
      });
      return;
    }

    // 5B. Buttonless Quick Horizontal Whip-Slash (crisp <=135ms swipe-and-lift) -> 360° Tail-Whip!
    //     Holding thumb > 135ms walks/runs smoothly with zero conflict!
    const totalDx = finalX - entry.startX;
    const totalDy = finalY - entry.startY;
    const avgVx = totalDx / Math.max(0.004, duration / 1000);
    const effVx = Math.abs(entry.peakSlashVx || 0) > Math.abs(avgVx) ? entry.peakSlashVx : avgVx;
    if (
      !entry.flickLatched &&
      !entry.postFlickActive &&
      entry.vertDir === null &&
      !entry.puzzleSwipeDir &&
      !entry.twoFingerWhipConsumed &&
      duration <= GESTURE_WHIP_SLASH_MAX_LIFT_MS &&
      Math.abs(totalDx) >= GESTURE_WHIP_SLASH_MIN_DX_PX &&
      Math.abs(effVx) >= GESTURE_WHIP_SLASH_MIN_VX &&
      Math.abs(totalDx) > Math.abs(totalDy) * GESTURE_WHIP_SLASH_DOMINANCE
    ) {
      this._clearHorizCarry();
      this._lastWhipSource = 'gesture_slash';
      this._triggerWhipPulse(135, {
        hapticPattern: [14, 22],
        vfx: {
          kind: 'slash',
          x1: entry.startX,
          y1: entry.startY,
          x2: finalX,
          y2: finalY,
          dir: totalDx < 0 ? -1 : 1,
        },
      });
      return;
    }

    // 5C. Quick Stationary Single-Tap (100% reliable for rapid-fire Hydro-Pulse, or Context Interact at Door/Valve;
    // suppressed inside Aqueduct Sanctum so 3D tile raycast tap-to-cast NEVER double-fires & undoes moves!):
    if (
      !entry.flickLatched &&
      !entry.postFlickActive &&
      entry.vertDir === null &&
      !entry.puzzleSwipeDir &&
      !entry.twoFingerWhipConsumed &&
      duration <= GESTURE_TAP_MAX_MS &&
      entry.maxDist <= GESTURE_TAP_MAX_MOVE_PX
    ) {
      if (gmode === 'aqueduct_sanctum' || gmode === 'puzzle') {
        return;
      }
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
  // Mode 2: Dynamic Floating Virtual Thumbstick Logic ('joystick' — Default!)
  // ===========================================================================

  _createJoystickEntry(e, zoneEl, isFloating = true) {
    const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 412;
    const vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 915;
    const maxRadius = JOYSTICK_MAX_RADIUS;
    const leashRadius = JOYSTICK_LEASH_RADIUS;

    // Dynamic floating origin: spawns directly under the left thumb clamped safely inside viewport!
    let originX = Math.max(maxRadius + 14, Math.min(vw * 0.46, e.clientX));
    let originY = Math.max(96 + maxRadius, Math.min(vh - maxRadius - 16, e.clientY));

    if (zoneEl && !isFloating && typeof zoneEl.getBoundingClientRect === 'function') {
      const rect = zoneEl.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        // If touching inside idle corner widget, re-anchor dynamically under thumb too for 0-jump feel
        if (Math.hypot(e.clientX - cx, e.clientY - cy) <= maxRadius * 1.35) {
          originX = Math.max(maxRadius + 14, Math.min(vw * 0.46, e.clientX));
          originY = Math.max(96 + maxRadius, Math.min(vh - maxRadius - 16, e.clientY));
        }
      }
    }

    if (zoneEl) {
      zoneEl.classList.add('active', 'floating-active');
      this._positionFloatingJoystickZone(zoneEl, originX, originY);
    }
    const puckEl = this._getJoystickPuckEl();
    if (puckEl) puckEl.classList.add('active');

    this.floatingStickState.active = true;
    this.floatingStickState.originX = originX;
    this.floatingStickState.originY = originY;
    this.floatingStickState.puckX = 0;
    this.floatingStickState.puckY = 0;
    this.floatingStickState.maxRadius = maxRadius;
    this.floatingStickState.leashRadius = leashRadius;

    const entry = {
      type: 'joystick',
      zoneEl,
      puckEl,
      isFloating: true,
      originX,
      originY,
      extremeX: e.clientX,
      activeHorizSign: 0,
      maxRadius,
      leashRadius,
      rapidsHopLatched: false,
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
    const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 412;
    const vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 915;
    const maxR = entry.maxRadius || JOYSTICK_MAX_RADIUS;
    const leashR = entry.leashRadius || JOYSTICK_LEASH_RADIUS;
    const gmode = this._activeGameMode();

    let dx = clientX - entry.originX;
    let dy = clientY - entry.originY;
    let dist = Math.hypot(dx, dy);

    // 1. Dynamic Anti-Drift Leash (wide logical [0, vw * 0.72] bounds so BOTH left & right edge drags reverse cleanly!)
    if (dist > leashR && dist > 0) {
      const pull = dist - leashR;
      entry.originX = Math.max(0, Math.min(vw * 0.72, entry.originX + (dx / dist) * pull));
      entry.originY = Math.max(88, Math.min(vh - 24, entry.originY + (dy / dist) * pull));
      dx = clientX - entry.originX;
      dy = clientY - entry.originY;
      dist = Math.hypot(dx, dy);
      if (entry.zoneEl) {
        this._positionFloatingJoystickZone(entry.zoneEl, entry.originX, entry.originY);
      }
    }

    // 2. Crisp Turnaround Re-Anchor (Tower & Rapids): pulling back >= 28px from peak reverses analogX in < 50ms!
    // Logical originX uses wide [0, vw * 0.72] bounds (never clamping away from clientX ± 14) while visual DOM clamps cleanly.
    const isHorizMode =
      gmode === 'tower' || gmode === 'rapids_surf' || gmode === 'skimmer';
    if (isHorizMode) {
      if (entry.activeHorizSign > 0) {
        if (clientX > entry.extremeX) entry.extremeX = clientX;
        if (entry.extremeX - clientX >= JOYSTICK_REVERSAL_PX && dx > -maxR * JOYSTICK_TOWER_HDEAD) {
          let nextOriginX = Math.max(0, Math.min(vw * 0.72, clientX + 18));
          if (nextOriginX < clientX + 14) {
            nextOriginX = Math.min(vw - 4, clientX + 18);
          }
          entry.originX = nextOriginX;
          entry.extremeX = clientX;
          entry.activeHorizSign = -1;
          dx = clientX - entry.originX;
          dist = Math.hypot(dx, dy);
          if (entry.zoneEl) {
            this._positionFloatingJoystickZone(entry.zoneEl, entry.originX, entry.originY);
          }
        }
      } else if (entry.activeHorizSign < 0) {
        if (clientX < entry.extremeX) entry.extremeX = clientX;
        if (clientX - entry.extremeX >= JOYSTICK_REVERSAL_PX && dx < maxR * JOYSTICK_TOWER_HDEAD) {
          let nextOriginX = Math.max(0, Math.min(vw * 0.72, clientX - 18));
          if (nextOriginX > clientX - 14) {
            nextOriginX = clientX - 18;
          }
          entry.originX = nextOriginX;
          entry.extremeX = clientX;
          entry.activeHorizSign = 1;
          dx = clientX - entry.originX;
          dist = Math.hypot(dx, dy);
          if (entry.zoneEl) {
            this._positionFloatingJoystickZone(entry.zoneEl, entry.originX, entry.originY);
          }
        }
      }
    }

    // 3. Clamp puck visually inside ring radius maxR
    let px = dx;
    let py = dy;
    if (dist > maxR && dist > 0) {
      const scale = maxR / dist;
      px = dx * scale;
      py = dy * scale;
    }
    this._setPuckOffset(entry.puckEl, px, py);
    this.floatingStickState.originX = entry.originX;
    this.floatingStickState.originY = entry.originY;
    this.floatingStickState.puckX = px;
    this.floatingStickState.puckY = py;

    const nx = px / maxR;
    const ny = py / maxR;
    const normDist = Math.hypot(nx, ny);

    // 4. Mode-Aware Axis Decoding (#603 Section 8.3)
    if (gmode === 'puzzle' || gmode === 'aqueduct_sanctum') {
      // Crisp 4-way cardinal sectors (0.24 deadzone / 0.19 active hysteresis)
      const cardDead = entry.up || entry.down || entry.left || entry.right ? 0.19 : 0.24;
      if (normDist < cardDead) {
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
    } else if (
      gmode === 'core_descent' ||
      gmode === 'reef_swim' ||
      gmode === 'submarine' ||
      gmode === 'frill_glide' ||
      gmode === 'glide'
    ) {
      // Smooth isotropic 360° 2D analog control (radial deadzone = 0.14)
      const rDead = 0.14;
      if (normDist > rDead) {
        const mag = Math.min(1, (normDist - rDead) / (1 - rDead));
        const ux = nx / Math.max(1e-5, normDist);
        const uy = ny / Math.max(1e-5, normDist);
        entry.analogX = ux * mag;
        entry.analogY = uy * mag;
        entry.left = entry.analogX < -0.22;
        entry.right = entry.analogX > 0.22;
        entry.up = entry.analogY < -0.22;
        entry.down = entry.analogY > 0.22;
      } else {
        entry.analogX = 0;
        entry.analogY = 0;
        entry.left = entry.right = entry.up = entry.down = false;
      }
    } else if (gmode === 'rapids_surf' || gmode === 'skimmer') {
      // Smooth analog carving (deadzone 0.12) + crisp upward wave-hop!
      const sDead = 0.12;
      if (Math.abs(nx) > sDead) {
        const t = Math.min(1, (Math.abs(nx) - sDead) / (1 - sDead));
        entry.analogX = Math.sign(nx) * (0.24 + 0.76 * t);
        entry.left = entry.analogX < -0.02;
        entry.right = entry.analogX > 0.02;
        entry.activeHorizSign = Math.sign(nx);
        entry.extremeX = entry.activeHorizSign > 0 ? Math.max(entry.extremeX, clientX) : Math.min(entry.extremeX, clientX);
      } else {
        entry.analogX = 0;
        entry.left = false;
        entry.right = false;
        entry.activeHorizSign = 0;
        entry.extremeX = clientX;
      }
      entry.analogY = 0;
      entry.up = false;
      entry.down = false;
      if (!entry.rapidsHopLatched && ny <= -0.58 && Math.abs(dy) > Math.abs(dx) * 1.1) {
        entry.rapidsHopLatched = true;
        this._triggerJumpPulse(120);
      } else if (entry.rapidsHopLatched && ny > -0.30) {
        entry.rapidsHopLatched = false;
      }
    } else {
      // TOWER MODE: progressive precision walk -> crisp run + strict ±38° vertical cone!
      const hDead = JOYSTICK_TOWER_HDEAD;
      if (Math.abs(nx) > hDead) {
        const t = Math.min(1, (Math.abs(nx) - hDead) / (1 - hDead));
        entry.analogX = Math.sign(nx) * (0.28 + 0.72 * Math.pow(t, 1.15));
        entry.left = entry.analogX < -0.02;
        entry.right = entry.analogX > 0.02;
        const nextSign = Math.sign(nx);
        if (nextSign !== entry.activeHorizSign) {
          entry.activeHorizSign = nextSign;
          entry.extremeX = clientX;
        } else {
          entry.extremeX = nextSign > 0 ? Math.max(entry.extremeX, clientX) : Math.min(entry.extremeX, clientX);
        }
      } else {
        entry.analogX = 0;
        entry.left = false;
        entry.right = false;
        entry.activeHorizSign = 0;
        entry.extremeX = clientX;
      }

      const upThresh = this._isDoorOrLiftContext() ? -0.42 : -0.54;
      const dnThresh = 0.54;
      const vertDominant = Math.abs(dy) >= Math.abs(dx) * (entry.up || entry.down ? 0.85 : 1.15);
      entry.up = ny <= upThresh && vertDominant;
      entry.down = ny >= dnThresh && vertDominant;
      entry.analogY = entry.up || entry.down ? ny : 0;
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
    const gmode = this._activeGameMode();
    const hPriority = gmode === 'tower' ? 1.40 : 1.15;
    if (currentDir === 'left' || currentDir === 'right') {
      if (adx * hPriority >= ady) {
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
    if (typeof window === 'undefined') return;
    if (!this._tiltListenerAttached) {
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

    if (!this._motionListenerAttached) {
      this._motionListenerAttached = true;
      this._onDeviceMotion = (e) => {
        if (!e) return;
        const acc = e.acceleration;
        const accG = e.accelerationIncludingGravity;
        const rot = e.rotationRate;
        const nowMs =
          typeof e.timeStamp === 'number' && Number.isFinite(e.timeStamp) && e.timeStamp > 0
            ? e.timeStamp
            : typeof performance !== 'undefined'
            ? performance.now()
            : Date.now();
        this._handleDeviceMotionSample({
          ax: acc && typeof acc.x === 'number' && Number.isFinite(acc.x) ? acc.x : null,
          ay: acc && typeof acc.y === 'number' && Number.isFinite(acc.y) ? acc.y : null,
          az: acc && typeof acc.z === 'number' && Number.isFinite(acc.z) ? acc.z : null,
          agx: accG && typeof accG.x === 'number' && Number.isFinite(accG.x) ? accG.x : null,
          agy: accG && typeof accG.y === 'number' && Number.isFinite(accG.y) ? accG.y : null,
          agz: accG && typeof accG.z === 'number' && Number.isFinite(accG.z) ? accG.z : null,
          rAlpha: rot && typeof rot.alpha === 'number' && Number.isFinite(rot.alpha) ? rot.alpha : null,
          rBeta: rot && typeof rot.beta === 'number' && Number.isFinite(rot.beta) ? rot.beta : null,
          rGamma: rot && typeof rot.gamma === 'number' && Number.isFinite(rot.gamma) ? rot.gamma : null,
          nowMs,
        });
      };
      window.addEventListener('devicemotion', this._onDeviceMotion, { passive: true });
    }
  }

  /**
   * Public deterministic motion-sensor processor for physical Wrist-Flick / Phone-Snap 360° Tail-Whip in 'tilt' mode.
   * Triggers on:
   *  - Linear acceleration spike hypot(ax, ay) >= 9.5 m/s², OR
   *  - High-pass delta of accelerationIncludingGravity >= 10.5 m/s² (when linear accel is unavailable), OR
   *  - Sharp rotational wrist-snap |rAlpha| >= 215 or |rGamma| >= 215 deg/s accompanied by jerk.
   * Enforces 300ms cooldown and guarantees 0 false triggers on smooth 0..30° tilting.
   */
  _handleDeviceMotionSample({
    ax = null,
    ay = null,
    az = null,
    agx = null,
    agy = null,
    agz = null,
    rAlpha = null,
    rBeta = null,
    rGamma = null,
    nowMs = null,
  } = {}) {
    const now =
      typeof nowMs === 'number' && Number.isFinite(nowMs)
        ? nowMs
        : typeof performance !== 'undefined'
        ? performance.now()
        : Date.now();

    const hasLin =
      (typeof ax === 'number' && Number.isFinite(ax)) ||
      (typeof ay === 'number' && Number.isFinite(ay));
    const linX = typeof ax === 'number' && Number.isFinite(ax) ? ax : 0;
    const linY = typeof ay === 'number' && Number.isFinite(ay) ? ay : 0;
    const linMag = hasLin ? Math.hypot(linX, linY) : 0;

    const hasGrav =
      (typeof agx === 'number' && Number.isFinite(agx)) ||
      (typeof agy === 'number' && Number.isFinite(agy)) ||
      (typeof agz === 'number' && Number.isFinite(agz));
    let gravDelta = 0;
    if (hasGrav) {
      const gx = typeof agx === 'number' && Number.isFinite(agx) ? agx : 0;
      const gy = typeof agy === 'number' && Number.isFinite(agy) ? agy : 0;
      const gz = typeof agz === 'number' && Number.isFinite(agz) ? agz : 0;
      if (this._prevGravSample && now - this._prevGravSample.t <= 240 && now >= this._prevGravSample.t) {
        gravDelta = Math.hypot(
          gx - this._prevGravSample.agx,
          gy - this._prevGravSample.agy,
          gz - this._prevGravSample.agz
        );
      }
      this._prevGravSample = { agx: gx, agy: gy, agz: gz, t: now };
    }

    const hasGyro =
      (typeof rAlpha === 'number' && Number.isFinite(rAlpha)) ||
      (typeof rBeta === 'number' && Number.isFinite(rBeta)) ||
      (typeof rGamma === 'number' && Number.isFinite(rGamma));
    let gyroSnap = false;
    const ra = typeof rAlpha === 'number' && Number.isFinite(rAlpha) ? rAlpha : 0;
    const rb = typeof rBeta === 'number' && Number.isFinite(rBeta) ? rBeta : 0;
    const rg = typeof rGamma === 'number' && Number.isFinite(rGamma) ? rGamma : 0;
    if (hasGyro) {
      const peakRot = Math.max(Math.abs(ra), Math.abs(rg));
      let angAccel = 0;
      if (this._prevGyroSample && now > this._prevGyroSample.t && now - this._prevGyroSample.t <= 240) {
        const dtSec = Math.max(0.008, (now - this._prevGyroSample.t) / 1000);
        angAccel = Math.max(
          Math.abs(ra - this._prevGyroSample.rAlpha) / dtSec,
          Math.abs(rg - this._prevGyroSample.rGamma) / dtSec
        );
      }
      if (
        peakRot >= MOTION_WHIP_GYRO_THRESHOLD &&
        (linMag >= MOTION_WHIP_GYRO_JERK_ACCEL ||
          gravDelta >= MOTION_WHIP_GYRO_JERK_ACCEL ||
          angAccel >= MOTION_WHIP_GYRO_ANG_ACCEL)
      ) {
        gyroSnap = true;
      }
      this._prevGyroSample = { rAlpha: ra, rBeta: rb, rGamma: rg, t: now };
    }

    if (this.controlMode !== 'tilt') {
      return false;
    }

    const linSpike = hasLin && linMag >= MOTION_WHIP_LIN_ACCEL_THRESHOLD;
    const gravSpike = !hasLin && hasGrav && gravDelta >= MOTION_WHIP_GRAV_DELTA_THRESHOLD;
    const triggered = linSpike || gravSpike || gyroSnap;

    if (!triggered || now - this._lastMotionWhipMs < MOTION_WHIP_COOLDOWN_MS) {
      return false;
    }

    this._lastMotionWhipMs = now;
    this._lastWhipSource = 'motion';
    const whipDir =
      Math.abs(linX) > 1
        ? Math.sign(linX)
        : Math.abs(rg) > 20
        ? Math.sign(rg)
        : Math.abs(ra) > 20
        ? Math.sign(ra)
        : 1;
    this._triggerWhipPulse(135, {
      hapticPattern: [14, 24],
      vfx: {
        kind: 'wrist',
        dir: whipDir || 1,
      },
    });
    return true;
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
      const curved = Math.max(TILT_MIN_ACTIVE_ANALOG, Math.pow(norm, TILT_ROLL_EXPONENT));
      this._tiltAnalogX = Math.sign(this._smoothedRoll) * Math.min(1, curved);
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
    const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 412;
    const inCenterDoorTap =
      this._canInteract && this._isInCenterInteractZone(x, y);
    // Repaired 'tilt' mode (#603): touching & holding right zone (x >= 0.56w, outside center door interact) gives TRUE HOLDABLE VARIABLE JUMP,
    // leaving [0.36..0.56] cleanly free for slash-whip & center interact without forcing a jump first!
    const rightHalfJump =
      entryType === 'tiltTouch' &&
      this._activeGameMode() === 'tower' &&
      x >= vw * 0.56 &&
      !inCenterDoorTap;
    return {
      type: entryType,
      startX: x,
      startY: y,
      startTime: ts.now,
      startEventTs: ts.startEventTs,
      startPerfTs: ts.startPerfTs,
      lastX: x,
      lastY: y,
      lastMoveTime: ts.now,
      maxDist: 0,
      anchorY: y,
      extremeY: y,
      upOnsetX: x,
      upOnsetY: y,
      upOnsetTime: ts.now,
      slashOnsetX: x,
      slashOnsetY: y,
      slashOnsetTime: ts.now,
      whipLatched: false,
      whipLatchTime: 0,
      whipPeakX: x,
      whipDir: 0,
      everWhipped: false,
      rightHalfJump,
      vertDir: null,
      analogY: 0,
      flickLatched: false,
      flickHoldMs: 0,
      flickPeakY: y,
      flickLatchTime: 0,
      jumpHeld: rightHalfJump,
      jumpTimer: null,
      upHoldTimer: null,
      samples: [{ x, y, t: ts.now }],
    };
  }

  _updateTiltTouchPointer(entry, e) {
    const now = this._resolveTimestampMs(e, entry);
    const x = e.clientX;
    const y = e.clientY;
    const gmode = this._activeGameMode();
    if (
      entry.type === 'tiltTouch' &&
      (gmode === 'puzzle' ||
        gmode === 'aqueduct_sanctum' ||
        gmode === 'core_descent' ||
        gmode === 'reef_swim' ||
        gmode === 'submarine' ||
        gmode === 'frill_glide' ||
        gmode === 'glide' ||
        gmode === 'rapids_surf' ||
        gmode === 'skimmer')
    ) {
      entry.type = 'gesture';
      entry.anchorX = entry.startX ?? x;
      entry.anchorY = entry.startY ?? y;
      entry.extremeX = x;
      entry.extremeY = y;
      entry.horizDir = 0;
      entry.left = false;
      entry.right = false;
      entry.analogX = 0;
      this._updateMiniGameGesturePointer(entry, x, y, now, gmode);
      return;
    }
    const prevX = entry.lastX;
    const prevY = entry.lastY;
    const gapMs = Math.max(0, now - (entry.lastMoveTime ?? entry.startTime));
    const dxStep = x - prevX;
    const dyStep = y - prevY;
    entry.lastX = x;
    entry.lastY = y;
    entry.lastMoveTime = now;
    const dist = Math.hypot(x - entry.startX, y - entry.startY);
    if (dist > entry.maxDist) entry.maxDist = dist;

    if (!entry.whipLatched && gapMs > 60 && Math.abs(x - entry.slashOnsetX) < 6) {
      entry.slashOnsetX = prevX;
      entry.slashOnsetY = prevY;
      entry.slashOnsetTime = now - Math.min(18, gapMs);
    }

    entry.samples.push({ x, y, t: now });
    while (entry.samples.length > 10 || (entry.samples.length > 2 && now - entry.samples[0].t > 130)) {
      entry.samples.shift();
    }

    // Re-arm horizontal whip slash after 240ms OR >= 18px directional reversal
    if (entry.whipLatched) {
      if (entry.whipDir > 0 && x > entry.whipPeakX) entry.whipPeakX = x;
      else if (entry.whipDir < 0 && x < entry.whipPeakX) entry.whipPeakX = x;
      const revDist = entry.whipDir > 0 ? entry.whipPeakX - x : x - entry.whipPeakX;
      if (now - entry.whipLatchTime >= TILT_SLASH_REARM_MS || revDist >= TILT_SLASH_REARM_REV_PX) {
        entry.whipLatched = false;
        entry.whipDir = 0;
        entry.slashOnsetX = x;
        entry.slashOnsetY = y;
        entry.slashOnsetTime = now;
      }
    } else if (Math.abs(x - entry.slashOnsetX) < 5 && now - entry.slashOnsetTime > 120) {
      entry.slashOnsetX = x;
      entry.slashOnsetY = y;
      entry.slashOnsetTime = now;
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
    const { vx: slashVx } = this._computeSlashVelocity(
      entry,
      x,
      y,
      now,
      entry.slashOnsetX,
      entry.slashOnsetY,
      entry.slashOnsetTime
    );
    const instVx = dxStep / Math.max(0.004, gapMs / 1000);
    const effSlashVx = Math.abs(instVx) > Math.abs(slashVx) ? instVx : slashVx;
    const dxSlash = x - entry.slashOnsetX;
    const dySlash = y - entry.slashOnsetY;

    // Buttonless Horizontal Slash Swipe Anywhere on Glass in 'tilt' mode -> 360° Tail-Whip!
    if (
      entry.type === 'tiltTouch' &&
      !entry.whipLatched &&
      !entry.flickLatched &&
      Math.abs(dxSlash) >= TILT_SLASH_MIN_DX_PX &&
      Math.abs(effSlashVx) >= TILT_SLASH_MIN_VX &&
      Math.abs(dxSlash) > Math.abs(dySlash) * TILT_SLASH_DOMINANCE
    ) {
      entry.whipLatched = true;
      entry.whipLatchTime = now;
      entry.whipPeakX = x;
      entry.whipDir = dxSlash < 0 ? -1 : 1;
      entry.everWhipped = true;
      entry.jumpHeld = false;
      this.justPressed.jump = false;
      entry.vertDir = null;
      entry.analogY = 0;
      this._lastWhipSource = 'tilt_slash';
      this._triggerWhipPulse(135, {
        hapticPattern: [14, 22],
        vfx: {
          kind: 'slash',
          x1: entry.slashOnsetX,
          y1: entry.slashOnsetY,
          x2: x,
          y2: y,
          dir: entry.whipDir,
        },
      });
      return;
    }

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
    const wasRightHalfJump = Boolean(entry.rightHalfJump);
    entry.jumpHeld = false;

    if (
      !isCancel &&
      !wasRightHalfJump &&
      !entry.flickLatched &&
      !entry.whipLatched &&
      !entry.everWhipped &&
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
      } else {
        // Left-half quick tap in 'tilt' mode fires Hydro-Pulse (right half is true holdable variable Jump!)
        this._triggerFirePulse(GESTURE_FIRE_PULSE_MS);
      }
    }
  }

  // ===========================================================================
  // Aqua Water-Arc Slash Ribbon & Wrist-Whip VFX Overlay (Zero-Idle-Cost Canvas)
  // ===========================================================================

  _spawnSlashVfx(spec = {}) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const arc = {
      kind: spec.kind || 'slash',
      x1: Number(spec.x1) || 0,
      y1: Number(spec.y1) || 0,
      x2: Number(spec.x2) || 0,
      y2: Number(spec.y2) || 0,
      dir: spec.dir < 0 ? -1 : 1,
      startMs: now,
      durationMs: Number(spec.durationMs) > 0 ? Number(spec.durationMs) : SLASH_VFX_DURATION_MS,
    };
    this._lastSlashVfx = arc;
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    this._slashArcs.push(arc);
    if (this._slashArcs.length > 6) {
      this._slashArcs.shift();
    }
    if (this._slashVfxRaf === null && typeof requestAnimationFrame === 'function') {
      this._slashVfxRaf = requestAnimationFrame(() => this._renderSlashVfx());
    }
  }

  _renderSlashVfx() {
    this._slashVfxRaf = null;
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      this._slashArcs.length = 0;
      return;
    }
    const canvas = document.getElementById('slash-vfx-canvas');
    if (!canvas || typeof canvas.getContext !== 'function') {
      this._slashArcs.length = 0;
      return;
    }
    let ctx;
    try {
      ctx = canvas.getContext('2d');
    } catch (_) {
      ctx = null;
    }
    if (!ctx) {
      this._slashArcs.length = 0;
      return;
    }

    const vw = window.innerWidth || 430;
    const vh = window.innerHeight || 932;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.max(1, Math.round(vw * dpr));
    const targetH = Math.max(1, Math.round(vh * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const alive = [];

    for (let i = 0; i < this._slashArcs.length; i++) {
      const a = this._slashArcs[i];
      const t = (now - a.startMs) / a.durationMs;
      if (t >= 1) continue;
      alive.push(a);

      const alpha = Math.pow(1 - Math.max(0, t), 1.45);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (a.kind === 'wrist') {
        // Twin glowing sea-glass cyan edge ripple arcs confirming physical phone wrist-whip
        const edgeInset = 18 + t * 54;
        const primaryLeft = a.dir < 0;
        const sides = [
          { x: edgeInset, bow: 44 + t * 28, boost: primaryLeft ? 1.0 : 0.65 },
          { x: vw - edgeInset, bow: -(44 + t * 28), boost: primaryLeft ? 0.65 : 1.0 },
        ];
        for (const s of sides) {
          const yTop = vh * 0.24;
          const yBot = vh * 0.76;
          const midY = vh * 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x, yTop);
          ctx.quadraticCurveTo(s.x + s.bow, midY, s.x, yBot);
          ctx.strokeStyle = `rgba(94, 252, 232, ${(alpha * 0.42 * s.boost).toFixed(3)})`;
          ctx.lineWidth = 14 * (1 - t * 0.5);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(s.x, yTop + 18);
          ctx.quadraticCurveTo(s.x + s.bow * 0.92, midY, s.x, yBot - 18);
          ctx.strokeStyle = `rgba(224, 254, 255, ${(alpha * 0.9 * s.boost).toFixed(3)})`;
          ctx.lineWidth = 4.2 * (1 - t * 0.45);
          ctx.stroke();
        }
      } else if (a.kind === 'button_ripple') {
        // Crisp 160ms expanding aqua feedback ring on Radial-Arc action button press
        const cx = a.x1 || vw * 0.85;
        const cy = a.y1 || vh * 0.85;
        const r = 24 + t * 30;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(94, 252, 232, ${(alpha * 0.72).toFixed(3)})`;
        ctx.lineWidth = 4.0 * (1 - t * 0.65);
        ctx.stroke();
      } else if (a.kind === 'ring') {
        // Expanding 360° sea-glass water-whip ripple ring for 2-finger tap
        const cx = a.x1 || vw * 0.5;
        const cy = a.y1 || vh * 0.55;
        const r = 18 + t * 76;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(94, 252, 232, ${(alpha * 0.55).toFixed(3)})`;
        ctx.lineWidth = 8 * (1 - t * 0.6);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, -0.8 + t * 2.4, 1.9 + t * 2.4);
        ctx.strokeStyle = `rgba(232, 255, 255, ${(alpha * 0.92).toFixed(3)})`;
        ctx.lineWidth = 3.5 * (1 - t * 0.5);
        ctx.stroke();
      } else {
        // Tapered curved aqua water-arc slash ribbon along finger swipe path
        const dx = a.x2 - a.x1;
        const dy = a.y2 - a.y1;
        const len = Math.max(48, Math.hypot(dx, dy));
        const extend = 22 + t * 26;
        const ux = (dx || a.dir) / Math.max(1, Math.hypot(dx, dy));
        const uy = dy / Math.max(1, Math.hypot(dx, dy));
        const sx = a.x1 - ux * 10;
        const sy = a.y1 - uy * 10;
        const ex = a.x2 + ux * extend;
        const ey = a.y2 + uy * extend;
        const bow = Math.min(44, len * 0.32) * (a.dir >= 0 ? -1 : 1);
        const mx = (sx + ex) * 0.5 - uy * bow;
        const my = (sy + ey) * 0.5 + ux * bow;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.strokeStyle = `rgba(56, 238, 224, ${(alpha * 0.45).toFixed(3)})`;
        ctx.lineWidth = 18 * (1 - t * 0.55);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.strokeStyle = `rgba(165, 248, 255, ${(alpha * 0.82).toFixed(3)})`;
        ctx.lineWidth = 8.5 * (1 - t * 0.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx + (ex - sx) * 0.14, sy + (ey - sy) * 0.14);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.96).toFixed(3)})`;
        ctx.lineWidth = 3.2 * (1 - t * 0.45);
        ctx.stroke();

        // Trailing sea-glass water droplets
        for (let d = 1; d <= 4; d++) {
          const u = d / 5;
          const qx = (1 - u) * (1 - u) * sx + 2 * (1 - u) * u * mx + u * u * ex + ux * t * 18;
          const qy = (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * my + u * u * ey + (d % 2 === 0 ? -1 : 1) * t * 14;
          ctx.beginPath();
          ctx.arc(qx, qy, Math.max(1.2, (4.2 - d * 0.6) * (1 - t * 0.5)), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(210, 255, 252, ${(alpha * 0.85).toFixed(3)})`;
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Live semi-transparent glass anchor reticle + thumb vector tether while dragging in 'gesture' mode (#603)
    const drawReticle = this.controlMode === 'gesture' && this.gestureReticle?.active;
    if (drawReticle) {
      const r = this.gestureReticle;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(r.anchorX, r.anchorY, 26, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(94, 252, 232, 0.34)';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r.anchorX, r.anchorY);
      ctx.lineTo(r.thumbX, r.thumbY);
      ctx.strokeStyle = 'rgba(165, 248, 255, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(r.thumbX, r.thumbY, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(94, 252, 232, 0.42)';
      ctx.fill();
      ctx.restore();
    }

    this._slashArcs = alive;
    if ((alive.length > 0 || drawReticle) && typeof requestAnimationFrame === 'function') {
      this._slashVfxRaf = requestAnimationFrame(() => this._renderSlashVfx());
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

      // 1. Direct Action Buttons (#btn-jump, #btn-fire, #btn-whip, #btn-interact ONLY in 'dpad' and 'joystick' modes!)
      //    Strictly bypassed in buttonless 'gesture' & 'tilt' modes so hidden rects NEVER hijack screen touches!
      const buttonsEnabled = this.controlMode === 'dpad' || this.controlMode === 'joystick';
      let jumpBtn = buttonsEnabled ? target.closest('#btn-jump') : null;
      let fireBtn = buttonsEnabled ? target.closest('#btn-fire') : null;
      let whipBtn = buttonsEnabled ? target.closest('#btn-whip') : null;
      let interactBtn = buttonsEnabled ? target.closest('#btn-interact') : null;
      if (
        buttonsEnabled &&
        !jumpBtn &&
        !fireBtn &&
        !whipBtn &&
        !interactBtn &&
        !target.closest('button, select, input, a, #dpad, #joystick-zone, #joystick-base')
      ) {
        const nearActionBtn = this._findActionButtonHalo(e.clientX, e.clientY, 12);
        if (nearActionBtn?.id === 'btn-jump') jumpBtn = nearActionBtn;
        else if (nearActionBtn?.id === 'btn-fire') fireBtn = nearActionBtn;
        else if (nearActionBtn?.id === 'btn-whip') whipBtn = nearActionBtn;
        else if (nearActionBtn?.id === 'btn-interact') interactBtn = nearActionBtn;
      }
      if (interactBtn) {
        if (e.cancelable) e.preventDefault();
        interactBtn.classList.add('active');
        this._activePointers.set(e.pointerId, { type: 'button', action: 'interact', el: interactBtn });
        const r = typeof interactBtn.getBoundingClientRect === 'function' ? interactBtn.getBoundingClientRect() : null;
        this._spawnSlashVfx({
          kind: 'button_ripple',
          x1: r ? r.left + r.width * 0.5 : e.clientX,
          y1: r ? r.top + r.height * 0.5 : e.clientY,
          durationMs: 160,
        });
        this.triggerInteract();
        this._tryPointerCapture(interactBtn, e.pointerId);
        return;
      }
      if (jumpBtn || fireBtn || whipBtn) {
        if (e.cancelable) e.preventDefault();
        const el = jumpBtn || fireBtn || whipBtn;
        const action = jumpBtn ? 'jump' : fireBtn ? 'fire' : 'whip';
        el.classList.add('active');
        this._activePointers.set(e.pointerId, { type: 'button', action, el });
        this.justPressed[action] = true;
        this.haptic(action === 'whip' ? 16 : action === 'jump' ? 12 : 10);
        const r = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
        this._spawnSlashVfx({
          kind: 'button_ripple',
          x1: r ? r.left + r.width * 0.5 : e.clientX,
          y1: r ? r.top + r.height * 0.5 : e.clientY,
          durationMs: 160,
        });
        this._tryPointerCapture(el, e.pointerId);
        this._recomputeState(true);
        return;
      }

      // Any new directional / stage touch cancels stale ballistic horizontal carry
      this._clearHorizCarry();

      // 2. Virtual Joystick Widget (#joystick-zone / #joystick-base) — single-pointer ownership prevents thumb stealing
      const joystickEl = target.closest('#joystick-zone, #joystick-base');
      if (joystickEl && this.controlMode === 'joystick' && !this._hasPointerOfType('joystick')) {
        if (e.cancelable) e.preventDefault();
        const entry = this._createJoystickEntry(e, joystickEl, true);
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

      const activeStageMode = this._activeGameMode();
      const isMiniOrPuzzleStage =
        activeStageMode === 'puzzle' ||
        activeStageMode === 'aqueduct_sanctum' ||
        activeStageMode === 'core_descent' ||
        activeStageMode === 'reef_swim' ||
        activeStageMode === 'submarine' ||
        activeStageMode === 'frill_glide' ||
        activeStageMode === 'glide' ||
        activeStageMode === 'rapids_surf' ||
        activeStageMode === 'skimmer';

      if (this.controlMode === 'gesture' || (this.controlMode === 'tilt' && isMiniOrPuzzleStage)) {
        if (e.cancelable) e.preventDefault();
        const entry = this._createGestureEntry(e);
        if (this._hasOtherGesturePointer(null)) {
          entry.isSecondaryFinger = true;
        }
        this._activePointers.set(e.pointerId, entry);
        this._syncGestureReticle(entry);
        this._tryPointerCapture(target, e.pointerId);
        this._recomputeState();
      } else if (this.controlMode === 'tilt') {
        if (e.cancelable) e.preventDefault();
        const entry = this._createTiltTouchEntry(e, 'tiltTouch');
        this._activePointers.set(e.pointerId, entry);
        this._tryPointerCapture(target, e.pointerId);
        this._recomputeState();
      } else if (this.controlMode === 'joystick') {
        const vw = window.innerWidth || 412;
        if (e.clientX <= vw * 0.50 && e.clientY >= 80 && !this._hasPointerOfType('joystick')) {
          if (e.cancelable) e.preventDefault();
          const zoneEl = this._getJoystickZoneEl();
          const entry = this._createJoystickEntry(e, zoneEl, true);
          this._activePointers.set(e.pointerId, entry);
          this._tryPointerCapture(target, e.pointerId);
          this._recomputeState();
        } else if (
          activeStageMode === 'tower' &&
          this._canInteract &&
          this._isInCenterInteractZone(e.clientX, e.clientY)
        ) {
          // Blank right-half taps NEVER misfire stray Hydro-Pulses; only intentional doorway/valve center tap interacts!
          if (e.cancelable) e.preventDefault();
          this.triggerInteract();
        }
      } else if (this.controlMode === 'dpad') {
        const vw = window.innerWidth || 412;
        const vh = window.innerHeight || 915;
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
        } else if (
          activeStageMode === 'tower' &&
          this._canInteract &&
          this._isInCenterInteractZone(e.clientX, e.clientY)
        ) {
          if (e.cancelable) e.preventDefault();
          this.triggerInteract();
        }
      }
    };

    this._onPointerMove = (e) => {
      const entry = this._activePointers.get(e.pointerId);
      if (!entry) return;
      if (e.cancelable) e.preventDefault();

      if (entry.type === 'button') {
        // Pointer-locked action button: zero slide-between hijacking!
        return;
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
        if (entry.zoneEl) {
          entry.zoneEl.classList.remove('active', 'floating-active');
          if (entry.zoneEl.style) entry.zoneEl.style.transform = '';
        }
        if (entry.puckEl) entry.puckEl.classList.remove('active');
        this._setPuckOffset(entry.puckEl, 0, 0);
        this.floatingStickState.active = false;
        this.floatingStickState.puckX = 0;
        this.floatingStickState.puckY = 0;
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
        e.code === 'Enter' &&
        typeof document !== 'undefined' &&
        document.querySelector('.overlay:not(.hidden)')
      ) {
        return;
      }
      if (
        e.code === 'Space' &&
        target &&
        target.closest('.overlay:not(.hidden)') &&
        target.closest('button, a, [role="button"]')
      ) {
        return;
      }

      // Context-smart KeyE: interact when standing at a door/lift/valve in tower mode, Tail-Whip otherwise!
      if (e.code === 'KeyE' && this._activeGameMode() === 'tower' && this._canInteract) {
        e.preventDefault();
        if (e.repeat) return;
        this.triggerInteract(
          this._interactKind === 'whip'
            ? 'whip'
            : this._interactKind === 'fire'
            ? 'fire'
            : 'up'
        );
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
