// Multi-Touch Mobile Input Controller + Analog Thumbstick Puck + On-Canvas Gestures + Keyboard Fallback
export class InputController {
  constructor() {
    this.state = {
      left: false,
      right: false,
      up: false,
      down: false,
      jump: false,
      fire: false,
    };
    this.justPressed = {
      up: false,
      down: false,
      jump: false,
      fire: false,
    };
    this._activePointers = new Map(); // pointerId -> { type: 'dpad'|'action'|'canvas', ... }
    this._dpadEl = null;
    this._puckEl = null;
    this._dpadBtns = new Map();
    this._pulseTimers = new Map();
    this._bindTouch();
    this._bindKeyboard();
  }

  haptic(ms = 12) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  }

  _setAction(action, pressed, el = null) {
    if (!action) return;
    const prev = this.state[action];
    this.state[action] = pressed;
    if (pressed && !prev) {
      if (action in this.justPressed) {
        this.justPressed[action] = true;
      }
      this.haptic(action === 'jump' || action === 'fire' ? 16 : 8);
    }
    if (el) {
      el.classList.toggle('active', pressed);
    }
  }

  _pulseAction(action, durationMs = 140) {
    this._setAction(action, true);
    if (this._pulseTimers.has(action)) {
      clearTimeout(this._pulseTimers.get(action));
    }
    const timer = setTimeout(() => {
      this._pulseTimers.delete(action);
      this._setAction(action, false);
    }, durationMs);
    this._pulseTimers.set(action, timer);
  }

  consumeJustPressed(action) {
    const val = this.justPressed[action];
    this.justPressed[action] = false;
    return val;
  }

  clearFrame() {
    this.justPressed.up = false;
    this.justPressed.down = false;
    this.justPressed.jump = false;
    this.justPressed.fire = false;
  }

  _updatePuckOffset(dx, dy, maxRadius = 22) {
    if (!this._puckEl) return;
    const dist = Math.hypot(dx, dy);
    let px = dx;
    let py = dy;
    if (dist > maxRadius && dist > 0) {
      const scale = maxRadius / dist;
      px = dx * scale;
      py = dy * scale;
    }
    this._puckEl.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
  }

  _resolveDpadDir(clientX, clientY) {
    if (!this._dpadEl) return null;
    const rect = this._dpadEl.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    this._updatePuckOffset(dx, dy, rect.width * 0.19);

    const deadzone = Math.min(rect.width, rect.height) * 0.11;
    if (dx * dx + dy * dy < deadzone * deadzone) {
      return null;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx < 0 ? 'left' : 'right';
    }
    return dy < 0 ? 'up' : 'down';
  }

  _updateDpadPointer(pointerId, clientX, clientY) {
    const entry = this._activePointers.get(pointerId);
    if (!entry || entry.type !== 'dpad') return;
    const nextDir = this._resolveDpadDir(clientX, clientY);
    if (nextDir === entry.action) return;

    if (entry.action) {
      this._setAction(entry.action, false, this._dpadBtns.get(entry.action) || null);
    }
    entry.action = nextDir;
    entry.el = nextDir ? (this._dpadBtns.get(nextDir) || null) : null;
    if (nextDir) {
      this._setAction(nextDir, true, entry.el);
    }
  }

  _releasePointer(pointerId) {
    const entry = this._activePointers.get(pointerId);
    if (!entry) return;
    this._activePointers.delete(pointerId);
    if (entry.type === 'dpad') {
      this._updatePuckOffset(0, 0);
    }
    if (entry.action) {
      this._setAction(entry.action, false, entry.el);
    }
  }

  _bindTouch() {
    this._dpadEl = document.getElementById('dpad');
    this._puckEl = document.getElementById('dpad-puck');
    document.querySelectorAll('.dpad-btn').forEach((btn) => {
      const dir = btn.dataset.dir;
      if (dir) {
        this._dpadBtns.set(dir, btn);
      }
    });

    if (this._dpadEl) {
      this._dpadEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const resolvedDir = this._resolveDpadDir(e.clientX, e.clientY);
        const dirBtn = e.target.closest('.dpad-btn');
        const initialDir = (dirBtn && dirBtn.dataset.dir) || resolvedDir;
        const el = initialDir ? (this._dpadBtns.get(initialDir) || null) : null;
        this._activePointers.set(e.pointerId, { type: 'dpad', action: initialDir, el });
        if (initialDir) {
          this._setAction(initialDir, true, el);
        }
        if (this._dpadEl.setPointerCapture) {
          try { this._dpadEl.setPointerCapture(e.pointerId); } catch (_) {}
        }
      });

      this._dpadEl.addEventListener('pointermove', (e) => {
        if (!this._activePointers.has(e.pointerId)) return;
        e.preventDefault();
        this._updateDpadPointer(e.pointerId, e.clientX, e.clientY);
      });

      const onDpadUp = (e) => {
        if (!this._activePointers.has(e.pointerId)) return;
        e.preventDefault();
        this._releasePointer(e.pointerId);
      };
      this._dpadEl.addEventListener('pointerup', onDpadUp);
      this._dpadEl.addEventListener('pointercancel', onDpadUp);
      this._dpadEl.addEventListener('lostpointercapture', onDpadUp);
    }

    const bindAction = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onDown = (e) => {
        e.preventDefault();
        this._activePointers.set(e.pointerId, { type: 'action', action, el });
        this._setAction(action, true, el);
        if (el.setPointerCapture) {
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
        }
      };
      const onUp = (e) => {
        e.preventDefault();
        this._releasePointer(e.pointerId);
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('lostpointercapture', onUp);
    };

    bindAction('btn-jump', 'jump');
    bindAction('btn-fire', 'fire');

    // Optional On-Canvas Touch Gestures: horizontal drag = walk, swipe up = jump + up, quick tap = fire
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._activePointers.set(e.pointerId, {
          type: 'canvas',
          startX: e.clientX,
          startY: e.clientY,
          startTime: performance.now(),
          action: null,
          swipedUp: false,
          moved: false,
        });
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        }
      });

      canvas.addEventListener('pointermove', (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'canvas') return;
        e.preventDefault();
        const dx = e.clientX - entry.startX;
        const dy = e.clientY - entry.startY;
        if (Math.hypot(dx, dy) > 10) {
          entry.moved = true;
        }

        // Swipe up triggers jump + up (door/elevator/hop)
        if (!entry.swipedUp && dy < -28 && Math.abs(dy) > Math.abs(dx) * 0.85) {
          entry.swipedUp = true;
          this._pulseAction('jump', 180);
          this._pulseAction('up', 180);
        }

        // Horizontal drag walks left / right
        let nextHoriz = null;
        if (Math.abs(dx) > 14) {
          nextHoriz = dx < 0 ? 'left' : 'right';
        }
        if (nextHoriz !== entry.action) {
          if (entry.action) {
            this._setAction(entry.action, false);
          }
          entry.action = nextHoriz;
          if (nextHoriz) {
            this._setAction(nextHoriz, true);
          }
        }
      });

      const onCanvasUp = (e) => {
        const entry = this._activePointers.get(e.pointerId);
        if (!entry || entry.type !== 'canvas') return;
        e.preventDefault();
        const elapsed = performance.now() - entry.startTime;
        if (!entry.moved && !entry.swipedUp && elapsed < 260) {
          this._pulseAction('fire', 120);
        }
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
      KeyX: 'fire',
      Enter: 'fire',
    };
    window.addEventListener('keydown', (e) => {
      const action = map[e.code];
      if (action) {
        e.preventDefault();
        this._setAction(action, true);
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = map[e.code];
      if (action) {
        e.preventDefault();
        this._setAction(action, false);
      }
    });
  }
}
