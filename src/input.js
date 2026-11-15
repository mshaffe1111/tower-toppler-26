// Multi-Touch Mobile Input Controller + Slide-Tracking D-Pad + Keyboard Fallback
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
    this._activePointers = new Map(); // pointerId -> { type: 'dpad'|'action', action, el }
    this._dpadEl = null;
    this._dpadBtns = new Map();
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

  _resolveDpadDir(clientX, clientY) {
    if (!this._dpadEl) return null;
    const rect = this._dpadEl.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
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
    if (entry.action) {
      this._setAction(entry.action, false, entry.el);
    }
  }

  _bindTouch() {
    this._dpadEl = document.getElementById('dpad');
    document.querySelectorAll('.dpad-btn').forEach((btn) => {
      const dir = btn.dataset.dir;
      if (dir) {
        this._dpadBtns.set(dir, btn);
      }
    });

    if (this._dpadEl) {
      this._dpadEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const dirBtn = e.target.closest('.dpad-btn');
        const initialDir = (dirBtn && dirBtn.dataset.dir) || this._resolveDpadDir(e.clientX, e.clientY);
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

    const touchBar = document.getElementById('touch-controls');
    if (touchBar) {
      touchBar.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      touchBar.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindAction('btn-jump', 'jump');
    bindAction('btn-fire', 'fire');
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
