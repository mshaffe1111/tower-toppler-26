// Touch-control layout engine + on-screen layout editor.
//
// Every touch control is data, not CSS: the JUMP / FIRE / REWIND buttons (centre + size), the
// thumbstick's home spot and size, and the split between the button side and the stick side.
// Layouts are stored per orientation (a thumb rests in a different place when the phone is held
// sideways) in settings.controls.layout, and applyControls() turns them into pixels.
//
// Coordinates are fractions of the control's region, measured from the OUTER edge of its side, so
// a layout mirrors cleanly when the player puts the stick on the left.
import { settings, setControl } from './settings.js';

export const BUTTONS = ['jump', 'fire', 'rewind'];
const ITEMS = [...BUTTONS, 'stick'];
const LABEL = { jump: 'JUMP', fire: 'FIRE', rewind: 'REWIND', stick: 'JOYSTICK' };
const SIZE_RANGE = { jump: [0.7, 1.5], fire: [0.7, 1.5], rewind: [0.7, 1.6], stick: [0.75, 1.35] };

const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 540px)';

export const DEFAULT_LAYOUTS = {
  portrait: {
    split: 0.5, // fraction of the deck width given to the stick side
    jump: { x: 0.3, y: 0.7, s: 1 },
    fire: { x: 0.8, y: 0.5, s: 1 },
    rewind: { x: 0.3, y: 0.23, s: 1 },
    stick: { x: 0.5, y: 0.62, s: 1 },
  },
  landscape: {
    split: 0.28, // fraction of the screen width given to the stick zone
    jump: { x: 0.24, y: 0.84, s: 1 },
    fire: { x: 0.6, y: 0.72, s: 1 },
    rewind: { x: 0.24, y: 0.56, s: 1 },
    stick: { x: 0.55, y: 0.7, s: 1 },
  },
};
const SPLIT_RANGE = { portrait: [0.36, 0.64], landscape: [0.2, 0.4] };

export function orientKey() {
  try {
    return window.matchMedia(LANDSCAPE_QUERY).matches ? 'landscape' : 'portrait';
  } catch (_) {
    return 'portrait';
  }
}

// Base sizes (px at scale 1) — smaller on short screens
function basePx(key) {
  const h = window.innerHeight;
  if (key === 'landscape') {
    return h <= 360 ? { jump: 66, fire: 54, rewind: 38, stick: 108 } : { jump: 76, fire: 58, rewind: 42, stick: 120 };
  }
  return h <= 700 ? { jump: 76, fire: 58, rewind: 42, stick: 116 } : { jump: 86, fire: 66, rewind: 46, stick: 126 };
}

export function getLayout(key = orientKey()) {
  const saved = settings.controls.layout?.[key] || {};
  const d = DEFAULT_LAYOUTS[key];
  const out = { split: saved.split ?? d.split };
  for (const k of ITEMS) out[k] = { ...d[k], ...(saved[k] || {}) };
  return out;
}

function saveLayout(key, layout) {
  setControl('layout', { ...(settings.controls.layout || {}), [key]: layout });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = (id) => document.getElementById(id);

// Pixel centre of a button inside its region (clamped so it never leaves the region)
function buttonCentre(item, size, W, H, swapped) {
  const pad = 6;
  const fx = swapped ? 1 - item.x : item.x;
  return {
    cx: clamp(fx * W, size / 2 + pad, Math.max(size / 2 + pad, W - size / 2 - pad)),
    cy: clamp(item.y * H, size / 2 + pad, Math.max(size / 2 + pad, H - size / 2 - pad)),
  };
}

let inputRef = null;
export function bindControlsInput(input) {
  inputRef = input;
}

// Apply a layout (default: the saved one for the current orientation) to the DOM.
export function applyControls(layout = null) {
  const tc = $('touch-controls');
  if (!tc) return;
  const key = orientKey();
  const L = layout || getLayout(key);
  const c = settings.controls;
  const swapped = settings.stickSide === 'left';
  tc.classList.toggle('swapped', swapped);
  tc.classList.toggle('scheme-gesture', c.scheme === 'gesture');
  tc.classList.toggle('stick-fixed', c.stickMode === 'fixed');
  tc.dataset.orient = key;
  tc.style.setProperty('--split', String(L.split));
  tc.style.setProperty('--ctl-opacity', String(c.opacity ?? 1));

  const region = tc.querySelector('.action-cluster');
  const W = region?.clientWidth || 200;
  const H = region?.clientHeight || 180;
  const px = basePx(key);
  const placed = {};
  for (const b of BUTTONS) {
    const el = $(`btn-${b}`);
    if (!el) continue;
    const size = Math.round(px[b] * L[b].s);
    const { cx, cy } = buttonCentre(L[b], size, W, H, swapped);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${(cx - size / 2).toFixed(1)}px`;
    el.style.top = `${(cy - size / 2).toFixed(1)}px`;
    el.style.setProperty('--sz', `${size}px`);
    el.classList.toggle('compact', size < 46);
    placed[b] = { cx, cy, r: size / 2 };
  }

  const base = $('stick-base');
  const knob = $('stick-knob');
  if (base) {
    const ss = Math.round(px.stick * L.stick.s);
    base.style.width = `${ss}px`;
    base.style.height = `${ss}px`;
    base.style.margin = `${-ss / 2}px 0 0 ${-ss / 2}px`;
    if (knob) {
      const ks = Math.round(ss * 0.46);
      knob.style.width = `${ks}px`;
      knob.style.height = `${ks}px`;
      knob.style.margin = `${-ks / 2}px 0 0 ${-ks / 2}px`;
    }
  }
  inputRef?.setStickHome?.(L.stick);
  return placed;
}

// ---------------------------------------------------------------------------------------------
// Layout editor: drag/resize everything on top of the real game (which stays visible behind), so
// the player sees exactly what their layout covers. Changes are live and saved on DONE.
// ---------------------------------------------------------------------------------------------
export class ControlEditor {
  constructor({ input, onClose, tap }) {
    this.input = input;
    this.onClose = onClose;
    this.tap = tap || (() => {});
    this.open_ = false;
    this.layer = $('ctl-edit-layer');
    this.bar = $('ctl-editor');
    this.sizeEl = $('ctl-ed-size');
    this.sizeOut = $('ctl-ed-size-val');
    this.opEl = $('ctl-ed-opacity');
    this.opOut = $('ctl-ed-opacity-val');
    this.selName = $('ctl-ed-sel');
    this.warnEl = $('ctl-ed-warn');
    this.orientEl = $('ctl-ed-orient');
    this.drag = null;
    this.sel = 'jump';
    this._bind();
  }

  get isOpen() {
    return this.open_;
  }

  open() {
    if (!this.layer || !this.bar) return;
    this.key = orientKey();
    this.L = structuredClone(getLayout(this.key));
    this.opacity = settings.controls.opacity ?? 1;
    this.open_ = true;
    this.input.releaseAll();
    $('touch-controls').classList.add('editing');
    document.body.classList.add('editing-controls');
    this.bar.classList.remove('hidden');
    this.layer.classList.remove('hidden');
    this._select(this.sel);
    this._refresh();
  }

  close(save = true) {
    if (!this.open_) return;
    if (save) {
      saveLayout(this.key, this.L);
      setControl('opacity', this.opacity);
    }
    this.open_ = false;
    this.drag = null;
    $('touch-controls').classList.remove('editing');
    document.body.classList.remove('editing-controls');
    this.bar.classList.add('hidden');
    this.layer.classList.add('hidden');
    for (const el of document.querySelectorAll('.ed-selected, .ed-overlap')) el.classList.remove('ed-selected', 'ed-overlap');
    applyControls();
    this.onClose?.();
  }

  // Rotating the phone mid-edit: keep what was done for the old orientation, edit the new one
  onResize() {
    if (!this.open_) return;
    const k = orientKey();
    if (k !== this.key) {
      saveLayout(this.key, this.L);
      this.key = k;
      this.L = structuredClone(getLayout(k));
    }
    this._refresh();
  }

  _refresh() {
    const tc = $('touch-controls');
    tc.style.setProperty('--ctl-opacity', String(this.opacity));
    const placed = applyControls(this.L) || {};
    tc.style.setProperty('--ctl-opacity', String(this.opacity));
    // Overlap warning: two buttons closer than a finger-width apart get mashed together
    const tooClose = new Set();
    const bs = BUTTONS.filter((b) => !(settings.controls.scheme === 'gesture' && b !== 'rewind'));
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = placed[bs[i]];
        const b = placed[bs[j]];
        if (!a || !b) continue;
        if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r + 10) {
          tooClose.add(bs[i]);
          tooClose.add(bs[j]);
        }
      }
    }
    for (const b of BUTTONS) $(`btn-${b}`)?.classList.toggle('ed-overlap', tooClose.has(b));
    if (this.warnEl) this.warnEl.classList.toggle('show', tooClose.size > 0);
    if (this.orientEl) this.orientEl.textContent = this.key === 'landscape' ? 'LANDSCAPE LAYOUT' : 'PORTRAIT LAYOUT';
    this._placeSplitHandle();
    const item = this.L[this.sel];
    const pct = Math.round(item.s * 100);
    if (this.sizeEl) {
      const [lo, hi] = SIZE_RANGE[this.sel];
      this.sizeEl.min = String(Math.round(lo * 100));
      this.sizeEl.max = String(Math.round(hi * 100));
      this.sizeEl.value = String(pct);
    }
    if (this.sizeOut) this.sizeOut.textContent = `${pct}%`;
    if (this.opEl) this.opEl.value = String(Math.round(this.opacity * 100));
    if (this.opOut) this.opOut.textContent = `${Math.round(this.opacity * 100)}%`;
    for (const el of [this.sizeEl, this.opEl]) {
      if (!el) continue;
      const f = (Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min) || 1);
      el.style.setProperty('--fill', `${(f * 100).toFixed(1)}%`);
    }
  }

  _placeSplitHandle() {
    const h = $('ctl-split');
    const zone = $('stick-zone');
    if (!h || !zone) return;
    const tc = $('touch-controls').getBoundingClientRect();
    const z = zone.getBoundingClientRect();
    const swapped = settings.stickSide === 'left';
    const x = (swapped ? z.right : z.left) - tc.left;
    h.style.left = `${x.toFixed(1)}px`;
    h.style.top = `${(z.top - tc.top).toFixed(1)}px`;
    h.style.height = `${z.height.toFixed(1)}px`;
  }

  _select(name) {
    this.sel = name;
    for (const k of ITEMS) {
      const el = k === 'stick' ? $('stick-base') : $(`btn-${k}`);
      el?.classList.toggle('ed-selected', k === name);
    }
    if (this.selName) this.selName.textContent = LABEL[name];
    for (const chip of document.querySelectorAll('[data-ed-select]')) chip.classList.toggle('on', chip.dataset.edSelect === name);
  }

  _hit(x, y) {
    // 1) a button's own circle, 2) the split line, 3) a button's finger margin, 4) the stick
    const scheme = settings.controls.scheme;
    const buttons = ['rewind', 'fire', 'jump'].filter((b) => scheme !== 'gesture' || b === 'rewind');
    const inButton = (pad) => {
      for (const b of buttons) {
        const r = $(`btn-${b}`)?.getBoundingClientRect();
        if (!r || !r.width) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (Math.hypot(x - cx, y - cy) <= r.width / 2 + pad) return b;
      }
      return null;
    };
    const direct = inButton(0);
    if (direct) return direct;
    const h = $('ctl-split')?.getBoundingClientRect();
    if (h && Math.abs(x - h.left) <= 14 && y >= h.top && y <= h.bottom) return 'split';
    const near = inButton(10);
    if (near) return near;
    const s = $('stick-base')?.getBoundingClientRect();
    if (s && x >= s.left - 8 && x <= s.right + 8 && y >= s.top - 8 && y <= s.bottom + 8) return 'stick';
    // Anywhere else in the stick zone also grabs the stick
    const z = $('stick-zone')?.getBoundingClientRect();
    if (z && x >= z.left && x <= z.right && y >= z.top && y <= z.bottom) return 'stick';
    return null;
  }

  _bind() {
    if (!this.layer) return;
    const swappedX = (fx) => (settings.stickSide === 'left' ? 1 - fx : fx);
    this.layer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const target = this._hit(e.clientX, e.clientY);
      if (!target) return;
      if (target !== 'split') this._select(target);
      this.tap();
      let ox = 0;
      let oy = 0;
      if (target === 'stick') {
        const r = $('stick-base').getBoundingClientRect();
        ox = e.clientX - (r.left + r.width / 2);
        oy = e.clientY - (r.top + r.height / 2);
      } else if (target !== 'split') {
        const r = $(`btn-${target}`).getBoundingClientRect();
        ox = e.clientX - (r.left + r.width / 2);
        oy = e.clientY - (r.top + r.height / 2);
      }
      this.drag = { id: e.pointerId, target, ox, oy };
      try { this.layer.setPointerCapture(e.pointerId); } catch (_) {}
    });
    this.layer.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      e.preventDefault();
      if (d.target === 'split') {
        const tc = $('touch-controls').getBoundingClientRect();
        let f = (e.clientX - tc.left) / tc.width;
        // split is the stick side's share, measured from the stick's outer edge
        f = settings.stickSide === 'left' ? f : 1 - f;
        const [lo, hi] = SPLIT_RANGE[this.key];
        this.L.split = clamp(f, lo, hi);
      } else if (d.target === 'stick') {
        const z = $('stick-zone').getBoundingClientRect();
        const fx = (e.clientX - d.ox - z.left) / z.width;
        const fy = (e.clientY - d.oy - z.top) / z.height;
        this.L.stick.x = clamp(swappedX(fx), 0.12, 0.88);
        this.L.stick.y = clamp(fy, 0.2, 0.88);
      } else {
        const region = $('touch-controls').querySelector('.action-cluster').getBoundingClientRect();
        const fx = (e.clientX - d.ox - region.left) / region.width;
        const fy = (e.clientY - d.oy - region.top) / region.height;
        this.L[d.target].x = clamp(swappedX(fx), 0, 1);
        this.L[d.target].y = clamp(fy, 0, 1);
      }
      this._refresh();
    });
    const end = (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.drag = null;
      this._refresh();
    };
    this.layer.addEventListener('pointerup', end);
    this.layer.addEventListener('pointercancel', end);
    this.layer.addEventListener('lostpointercapture', end);

    this.sizeEl?.addEventListener('input', () => {
      this.L[this.sel].s = Number(this.sizeEl.value) / 100;
      this._refresh();
    });
    this.opEl?.addEventListener('input', () => {
      this.opacity = Number(this.opEl.value) / 100;
      this._refresh();
    });
    $('ctl-ed-reset')?.addEventListener('click', () => {
      this.tap();
      this.L = structuredClone(DEFAULT_LAYOUTS[this.key]);
      this.opacity = 1;
      this._refresh();
    });
    $('ctl-ed-done')?.addEventListener('click', () => {
      this.tap();
      this.close(true);
    });
    // Quick-select chips (handy for the stick, which is big and easy to grab by accident)
    for (const chip of document.querySelectorAll('[data-ed-select]')) {
      chip.addEventListener('click', () => {
        this.tap();
        this._select(chip.dataset.edSelect);
        this._refresh();
      });
    }
  }
}
