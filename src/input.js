// Multi-source Input Controller: floating analog thumbstick + action buttons + on-canvas gestures + keyboard + gamepad.
// Every action is held by a *set of sources* (a key, a pointer, the gamepad...), so releasing one source
// never cancels another one that is still holding the same action (no more "stuck" or "dropped" inputs).
const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'fire', 'rewind'];

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
    if (this._baseEl) this._baseEl.style.transform = '';
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
    // Drag past the rim and the whole stick follows your thumb (no "dead" thumb positions)
    const follow = R * 1.35;
    if (dist > follow) {
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
    const dead = 0.2;
    // Proportional walk speed with a small deadzone, rescaled to 0..1
    const ax = Math.abs(nx) < dead ? 0 : Math.sign(nx) * Math.min(1, (Math.abs(nx) - dead) / (0.85 - dead));
    this.state.axisX = ax;

    const dirs = [];
    if (ax > 0) dirs.push('right');
    else if (ax < 0) dirs.push('left');
    // Up/down need a deliberate push so walking never accidentally triggers doors or lifts
    if (ny < -0.55 && Math.abs(ny) > Math.abs(nx) * 0.7) dirs.push('up');
    else if (ny > 0.6 && Math.abs(ny) > Math.abs(nx) * 0.7) dirs.push('down');
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
      if (this._baseEl) this._baseEl.style.transform = '';
    } else if (entry.type === 'action') {
      this._hold(entry.action, src, false);
      entry.el?.classList.remove('active');
    } else if (entry.type === 'canvas' && entry.action) {
      this._hold(entry.action, src, false);
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
      this._zoneEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        // One thumb per stick
        for (const ent of this._activePointers.values()) if (ent.type === 'stick') return;
        this.lastDevice = 'touch';
        const rect = this._zoneEl.getBoundingClientRect();
        const placed = this._placeBase(e.clientX - rect.left, e.clientY - rect.top);
        const entry = { type: 'stick', id: e.pointerId, dirs: [], cx: placed.cx, cy: placed.cy };
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

    // On-canvas gestures: horizontal drag = walk (relative, re-centres so reversing is instant),
    // swipe up = jump (+ up for doors/lifts), swipe down = down, quick tap = fire.
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.lastDevice = 'touch';
        this._activePointers.set(e.pointerId, {
          type: 'canvas',
          startX: e.clientX,
          startY: e.clientY,
          anchorX: e.clientX,
          anchorY: e.clientY,
          startTime: performance.now(),
          action: null,
          swiped: false,
          moved: false,
        });
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      });

      canvas.addEventListener('pointermove', (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'canvas') return;
        e.preventDefault();
        const totalDx = e.clientX - entry.startX;
        const totalDy = e.clientY - entry.startY;
        if (Math.hypot(totalDx, totalDy) > 10) entry.moved = true;

        // Vertical swipes measured from a moving anchor so you can swipe repeatedly without lifting
        const vdy = e.clientY - entry.anchorY;
        const vdx = e.clientX - entry.anchorX;
        if (vdy < -30 && Math.abs(vdy) > Math.abs(vdx) * 0.9) {
          this._pulseAction('jump', 160);
          this._pulseAction('up', 160);
          entry.swiped = true;
          entry.anchorY = e.clientY;
          entry.anchorX = e.clientX;
        } else if (vdy > 34 && Math.abs(vdy) > Math.abs(vdx) * 0.9) {
          this._pulseAction('down', 220);
          entry.swiped = true;
          entry.anchorY = e.clientY;
          entry.anchorX = e.clientX;
        }

        // Horizontal walk: relative to an anchor that trails the finger, so reversing direction
        // only needs a short drag back rather than all the way past the original touch point.
        const hdx = e.clientX - entry.anchorX;
        let next = entry.action;
        if (hdx > 14) next = 'right';
        else if (hdx < -14) next = 'left';
        if (next === 'right' && hdx > 40) entry.anchorX = e.clientX - 40;
        if (next === 'left' && hdx < -40) entry.anchorX = e.clientX + 40;
        if (next !== entry.action) {
          const src = `ptr:${e.pointerId}`;
          if (entry.action) this._hold(entry.action, src, false);
          entry.action = next;
          if (next) this._hold(next, src, true);
        }
      });

      const onCanvasUp = (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'canvas') return;
        e.preventDefault();
        const elapsed = performance.now() - entry.startTime;
        if (!entry.moved && !entry.swiped && elapsed < 260) this._pulseAction('fire', 120);
        this._releasePointer(e.pointerId);
      };
      canvas.addEventListener('pointerup', onCanvasUp);
      canvas.addEventListener('pointercancel', onCanvasUp);
      canvas.addEventListener('lostpointercapture', onCanvasUp);
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
