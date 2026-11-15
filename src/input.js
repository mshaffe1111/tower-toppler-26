// Multi-Touch Mobile Input Controller + Keyboard Fallback
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
    this._activePointers = new Map(); // pointerId -> actionName
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

  _bindTouch() {
    const dpadBtns = document.querySelectorAll('.dpad-btn');
    dpadBtns.forEach((btn) => {
      const dir = btn.dataset.dir;
      const onDown = (e) => {
        e.preventDefault();
        this._activePointers.set(e.pointerId, { action: dir, el: btn });
        this._setAction(dir, true, btn);
        if (btn.setPointerCapture) {
          try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        }
      };
      const onUp = (e) => {
        e.preventDefault();
        const entry = this._activePointers.get(e.pointerId);
        if (entry) {
          this._activePointers.delete(e.pointerId);
          this._setAction(entry.action, false, entry.el);
        } else {
          this._setAction(dir, false, btn);
        }
      };
      btn.addEventListener('pointerdown', onDown);
      btn.addEventListener('pointerup', onUp);
      btn.addEventListener('pointercancel', onUp);
    });

    const bindAction = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      const onDown = (e) => {
        e.preventDefault();
        this._activePointers.set(e.pointerId, { action, el });
        this._setAction(action, true, el);
        if (el.setPointerCapture) {
          try { el.setPointerCapture(e.pointerId); } catch (_) {}
        }
      };
      const onUp = (e) => {
        e.preventDefault();
        const entry = this._activePointers.get(e.pointerId);
        if (entry) {
          this._activePointers.delete(e.pointerId);
          this._setAction(entry.action, false, entry.el);
        } else {
          this._setAction(action, false, el);
        }
      };
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    };

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
