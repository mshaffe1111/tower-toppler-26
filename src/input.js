// Multi-source Input Controller: floating analog thumbstick + action buttons + on-canvas gestures + keyboard + gamepad.
// Every action is held by a *set of sources* (a key, a pointer, the gamepad...), so releasing one source
// never cancels another one that is still holding the same action (no more "stuck" or "dropped" inputs).
import { settings } from './settings.js';

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'rewind'];

// Stick feel presets: dead = centre deadzone, full = how far (fraction of the rim) gives full speed
const SENSITIVITY = {
  low: { dead: 0.22, full: 0.95 },
  medium: { dead: 0.18, full: 0.8 },
  high: { dead: 0.13, full: 0.62 },
};
// Gesture pad tuning
const SWIPE_PX = 22; // movement that turns a touch into a swipe
const HOLD_MS = 140; // a still touch longer than this becomes a held (charging) FIRE

export class InputController {
  constructor() {
    this.state = {};
    this.justPressed = {};
    this._sources = {};
    for (const a of ACTIONS) {
      this.state[a] = false;
      this.justPressed[a] = false;
      this._sources[a] = new Set();
    }
    this.state.axisX = 0; // analog horizontal from the thumbstick (-1..1); 0 = use digital left/right
    this._activePointers = new Map(); // pointerId -> { type: 'stick'|'action'|'canvas', ... }
    this._zoneEl = null;
    this._baseEl = null;
    this._knobEl = null;
    this._dpadBtns = new Map(); // direction -> highlight element
    this._pulseTimers = new Map();
    this._padPrev = {};
    this.onPause = null; // set by main.js; fired by Esc / P / gamepad Start
    this.lastDevice = 'touch';

    this._bindTouch();
    this._bindKeyboard();
    this._bindLifecycle();
  }

  haptic(ms = 12) {
    if (this.hapticsEnabled === false) return;
    if (navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  }

  // Press / release an action on behalf of a specific source.
  _hold(action, source, pressed) {
    if (!action || !this._sources[action]) return;
    const set = this._sources[action];
    const before = set.size > 0;
    if (pressed) set.add(source);
    else set.delete(source);
    const after = set.size > 0;
    this.state[action] = after;
    if (after && !before) {
      this.justPressed[action] = true;
      if (source.startsWith('ptr') || source.startsWith('pulse')) {
        this.haptic(action === 'jump' || action === 'fire' ? 14 : 6);
      }
    }
    const btn = this._dpadBtns.get(action);
    if (btn) btn.classList.toggle('active', after);
  }

  _pulseAction(action, durationMs = 140) {
    const src = `pulse:${action}`;
    this._hold(action, src, true);
    if (this._pulseTimers.has(action)) clearTimeout(this._pulseTimers.get(action));
    const timer = setTimeout(() => {
      this._pulseTimers.delete(action);
      this._hold(action, src, false);
    }, durationMs);
    this._pulseTimers.set(action, timer);
  }

  releaseAll() {
    for (const a of ACTIONS) {
      this._sources[a].clear();
      this.state[a] = false;
      const btn = this._dpadBtns.get(a);
      if (btn) btn.classList.remove('active');
    }
    for (const el of document.querySelectorAll('.action-btn.active')) el.classList.remove('active');
    this._activePointers.clear();
    this.state.axisX = 0;
    this._setKnob(0, 0);
    this._zoneEl?.classList.remove('engaged');
    this._restStick();
  }

  consumeJustPressed(action) {
    const val = this.justPressed[action];
    this.justPressed[action] = false;
    return val;
  }

  clearFrame() {
    for (const a of ACTIONS) this.justPressed[a] = false;
  }

  // ---------- Floating analog thumbstick ----------

  _stickRadius() {
    return this._baseEl ? this._baseEl.offsetWidth * 0.36 : 44;
  }

  // The stick's home spot (fractions of the zone, measured from the outer edge), set by the layout
  setStickHome(home) {
    this._home = home;
    if (![...this._activePointers.values()].some((e) => e.type === 'stick')) this._restStick();
  }

  _homePoint() {
    const zw = this._zoneEl.clientWidth;
    const zh = this._zoneEl.clientHeight;
    const h = this._home || { x: 0.5, y: 0.65 };
    const fx = settings.stickSide === 'left' ? 1 - h.x : h.x;
    return { x: zw * fx, y: zh * h.y };
  }

  // Park the stick at its home spot when no thumb is down
  _restStick() {
    if (!this._zoneEl) return;
    const p = this._homePoint();
    return this._placeBase(p.x, p.y);
  }

  _placeBase(x, y) {
    // x, y relative to the zone's top-left; base is centred on that point
    if (!this._baseEl || !this._zoneEl) return;
    const zw = this._zoneEl.clientWidth;
    const zh = this._zoneEl.clientHeight;
    const half = this._baseEl.offsetWidth * 0.5;
    const cx = Math.max(half * 0.6, Math.min(zw - half * 0.6, x));
    const cy = Math.max(half * 0.55, Math.min(zh - half * 0.55, y));
    this._baseEl.style.transform = `translate(${(cx - zw / 2).toFixed(1)}px, ${(cy - zh / 2).toFixed(1)}px)`;
    return { cx, cy };
  }

  _setKnob(dx, dy) {
    if (this._knobEl) this._knobEl.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }

  _updateStick(entry, clientX, clientY) {
    const rect = this._zoneEl.getBoundingClientRect();
    const R = this._stickRadius();
    let dx = clientX - (rect.left + entry.cx);
    let dy = clientY - (rect.top + entry.cy);
    let dist = Math.hypot(dx, dy);
    // Floating stick: drag past the rim and the whole stick follows your thumb (no "dead" thumb
    // positions). A fixed stick stays put; pushing past the rim just means full deflection.
    const follow = R * 1.35;
    if (!entry.fixed && dist > follow) {
      const k = (dist - follow) / dist;
      const moved = this._placeBase(entry.cx + dx * k, entry.cy + dy * k);
      entry.cx = moved.cx;
      entry.cy = moved.cy;
      dx = clientX - (rect.left + entry.cx);
      dy = clientY - (rect.top + entry.cy);
      dist = Math.hypot(dx, dy);
    }
    const clamped = Math.min(dist, R);
    const kx = dist > 0 ? (dx / dist) * clamped : 0;
    const ky = dist > 0 ? (dy / dist) * clamped : 0;
    this._setKnob(kx, ky);

    const nx = kx / R;
    const ny = ky / R;
    const c = settings.controls || {};
    const { dead, full } = SENSITIVITY[c.sensitivity] || SENSITIVITY.medium;
    // Proportional walk speed with a small deadzone, rescaled to 0..1
    const ax = Math.abs(nx) < dead ? 0 : Math.sign(nx) * Math.min(1, (Math.abs(nx) - dead) / (full - dead));
    this.state.axisX = ax;

    const dirs = [];
    if (ax > 0) dirs.push('right');
    else if (ax < 0) dirs.push('left');
    // Up/down need a deliberate push so walking never accidentally triggers doors or lifts
    const up = Math.max(0.35, Math.min(0.8, c.upThreshold ?? 0.55));
    if (ny < -up && Math.abs(ny) > Math.abs(nx) * 0.7) dirs.push('up');
    else if (ny > up + 0.05 && Math.abs(ny) > Math.abs(nx) * 0.7) dirs.push('down');
    this._setStickDirs(entry, dirs);
  }

  _setStickDirs(entry, dirs) {
    const src = `ptr:${entry.id}`;
    const prev = entry.dirs || [];
    let changed = false;
    for (const d of prev) if (!dirs.includes(d)) { this._hold(d, src, false); changed = true; }
    for (const d of dirs) if (!prev.includes(d)) { this._hold(d, src, true); changed = true; }
    if (changed && dirs.length) this.haptic(5);
    entry.dirs = dirs;
  }

  _releasePointer(pointerId) {
    const entry = this._activePointers.get(pointerId);
    if (!entry) return;
    this._activePointers.delete(pointerId);
    const src = `ptr:${pointerId}`;
    if (entry.type === 'stick') {
      for (const d of entry.dirs || []) this._hold(d, src, false);
      this.state.axisX = 0;
      this._setKnob(0, 0);
      this._zoneEl?.classList.remove('engaged');
      this._restStick();
    } else if (entry.type === 'action') {
      this._hold(entry.action, src, false);
      entry.el?.classList.remove('active');
    } else if (entry.type === 'canvas' && entry.action) {
      this._hold(entry.action, src, false);
    } else if (entry.type === 'gesture') {
      clearTimeout(entry.timer);
      if (entry.state === 'pending') this._pulseAction('fire', 70); // quick tap = snowball
      else if (entry.state === 'fire') this._hold('fire', src, false); // release = throw the charge
      else if (entry.state === 'jump') this._hold('jump', src, false);
      this._gestureFx(entry, 'end');
    }
  }

  // ---------- Gesture pad (alternative to the JUMP / FIRE buttons) ----------
  // Swipe up = jump (hold your finger down for a full-height jump), tap = snowball,
  // touch and hold = charge a mega-snowball (release to throw), swipe down = ground-pound / go down.
  _bindGesturePad() {
    const pad = document.getElementById('gesture-pad');
    if (!pad) return;
    this._padEl = pad;
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.lastDevice = 'touch';
      const r = pad.getBoundingClientRect();
      const entry = { type: 'gesture', id: e.pointerId, x0: e.clientX, y0: e.clientY, rx: e.clientX - r.left, ry: e.clientY - r.top, state: 'pending' };
      entry.timer = setTimeout(() => {
        if (entry.state !== 'pending' || !this._activePointers.has(e.pointerId)) return;
        entry.state = 'fire';
        this._hold('fire', `ptr:${e.pointerId}`, true);
        this._gestureFx(entry, 'hold');
      }, HOLD_MS);
      this._activePointers.set(e.pointerId, entry);
      this._gestureFx(entry, 'down');
      try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    });
    pad.addEventListener('pointermove', (e) => {
      const entry = this._activePointers.get(e.pointerId);
      if (!entry || entry.type !== 'gesture' || entry.state !== 'pending') return;
      e.preventDefault();
      const dx = e.clientX - entry.x0;
      const dy = e.clientY - entry.y0;
      if (Math.hypot(dx, dy) < SWIPE_PX) return;
      clearTimeout(entry.timer);
      const src = `ptr:${e.pointerId}`;
      if (-dy > Math.abs(dx) * 0.7) {
        entry.state = 'jump';
        this._hold('jump', src, true);
        this._gestureFx(entry, 'up');
      } else if (dy > Math.abs(dx) * 0.7) {
        entry.state = 'down';
        this._pulseAction('down', 160);
        this._gestureFx(entry, 'dn');
      } else {
        entry.state = 'none'; // sideways drag: ignore (thumb sliding around)
      }
    });
    const onUp = (e) => {
      const entry = this._activePointers.get(e.pointerId);
      if (!entry || entry.type !== 'gesture') return;
      e.preventDefault();
      this._releasePointer(e.pointerId);
    };
    pad.addEventListener('pointerup', onUp);
    pad.addEventListener('pointercancel', onUp);
    pad.addEventListener('lostpointercapture', onUp);
  }

  // Touch feedback on the pad: a ring where the finger landed, tinted by what it became
  _gestureFx(entry, kind) {
    const pad = this._padEl;
    if (!pad) return;
    if (kind === 'down') {
      const ring = document.createElement('span');
      ring.className = 'gp-ring';
      ring.style.left = `${entry.rx}px`;
      ring.style.top = `${entry.ry}px`;
      pad.appendChild(ring);
      entry.ring = ring;
      return;
    }
    const ring = entry.ring;
    if (!ring) return;
    if (kind === 'end') {
      ring.classList.add('out');
      setTimeout(() => ring.remove(), 320);
      entry.ring = null;
    } else {
      ring.classList.add(`gp-${kind}`);
      this.haptic(kind === 'hold' ? 8 : 12);
    }
  }

  _bindTouch() {
    this._zoneEl = document.getElementById('stick-zone');
    this._baseEl = document.getElementById('stick-base');
    this._knobEl = document.getElementById('stick-knob');
    document.querySelectorAll('.stick-arrow').forEach((el) => {
      if (el.dataset.dir) this._dpadBtns.set(el.dataset.dir, el);
    });

    if (this._zoneEl) {
      requestAnimationFrame(() => this._restStick());
      window.addEventListener('resize', () => requestAnimationFrame(() => this._restStick()));
      this._zoneEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // One thumb per stick
        for (const ent of this._activePointers.values()) if (ent.type === 'stick') return;
        this.lastDevice = 'touch';
        const rect = this._zoneEl.getBoundingClientRect();
        const fixed = settings.controls?.stickMode === 'fixed';
        // Floating: the stick appears under your thumb. Fixed: it stays home and reads the
        // direction from home to your thumb, wherever in the zone you touch.
        const placed = fixed ? this._restStick() : this._placeBase(e.clientX - rect.left, e.clientY - rect.top);
        const entry = { type: 'stick', id: e.pointerId, dirs: [], cx: placed.cx, cy: placed.cy, fixed };
        this._activePointers.set(e.pointerId, entry);
        this._zoneEl.classList.add('engaged');
        this._updateStick(entry, e.clientX, e.clientY);
        try { this._zoneEl.setPointerCapture(e.pointerId); } catch (_) {}
      });
      this._zoneEl.addEventListener('pointermove', (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'stick') return;
        e.preventDefault();
        this._updateStick(entry, e.clientX, e.clientY);
      });
      const onStickUp = (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'stick') return;
        e.preventDefault();
        this._releasePointer(e.pointerId);
      };
      this._zoneEl.addEventListener('pointerup', onStickUp);
      this._zoneEl.addEventListener('pointercancel', onStickUp);
      this._zoneEl.addEventListener('lostpointercapture', onStickUp);
    }

    const bindAction = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.lastDevice = 'touch';
        this._activePointers.set(e.pointerId, { type: 'action', action, el });
        el.classList.add('active');
        this._hold(action, `ptr:${e.pointerId}`, true);
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      const onUp = (e) => {
        e.preventDefault();
        this._releasePointer(e.pointerId);
      };
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('lostpointercapture', onUp);
    };
    bindAction('btn-jump', 'jump');
    bindAction('btn-fire', 'fire');
    bindAction('btn-rewind', 'rewind');
    this._bindGesturePad();

    // Touch camera: drag anywhere on the open play area to look around the tower and up/down
    // (great for planning a route). The view glides back when you let go.
    this.look = { active: false, dx: 0, dy: 0, w: 1, h: 1 };
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.lastDevice = 'touch';
        for (const ent of this._activePointers.values()) if (ent.type === 'look') return;
        const r = canvas.getBoundingClientRect();
        this._activePointers.set(e.pointerId, { type: 'look', x0: e.clientX, y0: e.clientY });
        this.look.active = true;
        this.look.dx = 0;
        this.look.dy = 0;
        this.look.w = r.width;
        this.look.h = r.height;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      });
      canvas.addEventListener('pointermove', (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'look') return;
        e.preventDefault();
        this.look.dx = e.clientX - entry.x0;
        this.look.dy = e.clientY - entry.y0;
      });
      const onUp = (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'look') return;
        this._activePointers.delete(e.pointerId);
        this.look.active = false;
      };
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('lostpointercapture', onUp);
    }

    const touchBar = document.getElementById('touch-controls');
    if (touchBar) {
      touchBar.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      touchBar.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  // ---------- Keyboard ----------

  _bindKeyboard() {
    const map = {
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
      KeyJ: 'fire',
      Enter: 'fire',
      ShiftLeft: 'fire',
      KeyR: 'rewind',
      Backspace: 'rewind',
    };
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLSelectElement) return;
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        this.onPause?.();
        return;
      }
      const action = map[e.code];
      if (action) {
        e.preventDefault();
        this.lastDevice = 'keyboard';
        this._hold(action, `key:${e.code}`, true);
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = map[e.code];
      if (action) {
        e.preventDefault();
        this._hold(action, `key:${e.code}`, false);
      }
    });
  }

  // Drop every held input when the page loses focus, otherwise a key released while the
  // window was in the background stays "held" forever.
  _bindLifecycle() {
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  // ---------- Gamepad (polled once per frame) ----------

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    const src = 'pad';
    if (!pad) {
      if (this._padWasConnected) {
        for (const a of ACTIONS) this._hold(a, src, false);
        this._padWasConnected = false;
      }
      return;
    }
    this._padWasConnected = true;
    const btn = (i) => Boolean(pad.buttons[i] && pad.buttons[i].pressed);
    const ax = pad.axes[0] || 0;
    const ay = pad.axes[1] || 0;
    const dead = 0.38;
    // Analog stick drives proportional walking speed too
    this._padAxis = Math.abs(ax) > dead ? Math.sign(ax) * Math.min(1, (Math.abs(ax) - dead) / (0.9 - dead)) : 0;
    if (!this._activePointers.size) this.state.axisX = btn(14) || btn(15) ? 0 : this._padAxis;
    const next = {
      left: btn(14) || ax < -dead,
      right: btn(15) || ax > dead,
      up: btn(12) || ay < -0.55,
      down: btn(13) || ay > 0.55,
      jump: btn(0) || btn(1),
      fire: btn(2) || btn(3) || btn(5) || btn(7),
      rewind: btn(4) || btn(6) || btn(8),
    };
    let any = false;
    for (const a of ACTIONS) {
      if (next[a] !== Boolean(this._padPrev[a])) this._hold(a, src, next[a]);
      if (next[a]) any = true;
    }
    if (any) this.lastDevice = 'gamepad';
    this._padPrev = next;
    const start = btn(9);
    if (start && !this._padStartPrev) this.onPause?.();
    this._padStartPrev = start;
  }
}
