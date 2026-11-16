// OPTIONS menu: every setting in one place, grouped into tabs, rendered from one schema so every
// row looks and behaves the same (segmented choices, toggles, sliders, action buttons).
import { settings, setSetting, setControl } from './settings.js';

// key 'controls.x' -> settings.controls.x
function getVal(key) {
  if (key.startsWith('controls.')) return settings.controls[key.slice(9)];
  return settings[key];
}
function setVal(key, v) {
  if (key.startsWith('controls.')) setControl(key.slice(9), v);
  else setSetting(key, v);
}

const ONOFF = [
  [false, 'Off'],
  [true, 'On'],
];

export const OPTION_TABS = [
  {
    id: 'controls',
    label: 'Controls',
    icon: '🎮',
    rows: [
      {
        key: 'controls.scheme',
        label: 'Control style',
        desc: 'Slide: one thumb anywhere moves you, slide up to jump (or go through a door). Buttons: joystick + JUMP. Gesture pad: swipe to jump.',
        options: [
          ['slide', 'Slide'],
          ['buttons', 'Buttons'],
          ['gesture', 'Gesture'],
        ],
      },
      {
        key: 'stickSide',
        label: 'Joystick side',
        options: [
          ['left', 'Left'],
          ['right', 'Right'],
        ],
      },
      {
        key: 'controls.stickMode',
        label: 'Joystick type',
        desc: 'Floating appears wherever your thumb lands · Fixed stays in one spot',
        options: [
          ['floating', 'Floating'],
          ['fixed', 'Fixed'],
        ],
      },
      {
        key: 'controls.sensitivity',
        label: 'Joystick sensitivity',
        desc: 'How far you push for full walking speed',
        options: [
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
        ],
      },
      {
        key: 'controls.upThreshold',
        label: 'Doors & lifts push',
        desc: 'How firmly to push ▲ / ▼ to go through doors and ride lifts',
        options: [
          [0.42, 'Light'],
          [0.55, 'Normal'],
          [0.7, 'Firm'],
        ],
      },
      { key: 'haptics', label: 'Vibration', options: ONOFF },
      { action: 'edit-layout', label: 'Button layout', desc: 'Move and resize every button and the joystick, set transparency', button: '✎ EDIT LAYOUT' },
    ],
  },
  {
    id: 'gameplay',
    label: 'Gameplay',
    icon: '🗼',
    rows: [
      { key: 'assist', label: 'Assist mode', desc: 'Infinite lives and unlimited rewind', options: ONOFF },
      { key: 'classic', label: 'Classic rules', desc: 'Like 1987: no edge guard, rewind or checkpoints', options: ONOFF },
      {
        key: 'gameSpeed',
        label: 'Game speed',
        desc: 'Slower is easier',
        options: [
          [0.6, '60%'],
          [0.7, '70%'],
          [0.85, '85%'],
          [1, '100%'],
        ],
      },
      {
        key: 'clock',
        label: 'Clock',
        desc: 'Off: no countdown and no time bonus. Flood and collapsing towers still rise',
        options: [
          [true, 'On'],
          [false, 'Off'],
        ],
      },
      { key: 'mirror', label: 'Mirror mode', desc: 'Every tower flipped left-to-right', options: ONOFF },
      { key: 'ghosts', label: 'Ghost runs', desc: 'Race a replay of your best climb', options: ONOFF },
      { action: 'reset-hints', label: 'Tutorial hints', desc: 'Show the first-time tips again', button: '💡 REPLAY HINTS' },
    ],
  },
  {
    id: 'video',
    label: 'Video',
    icon: '✨',
    rows: [
      {
        key: 'quality',
        label: 'Graphics',
        desc: 'Auto adapts to your device to keep a smooth frame rate',
        options: [
          ['auto', 'Auto'],
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
        ],
      },
      { key: 'diorama', label: 'Diorama focus', desc: 'Tilt-shift depth of field, like a toy model', options: ONOFF },
      { key: 'reducedMotion', label: 'Reduced motion', desc: 'No screen shake, flashes or camera swoops', options: ONOFF },
    ],
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: '🔊',
    rows: [
      { key: 'musicVolume', label: 'Music', slider: true },
      { key: 'sfxVolume', label: 'Sound effects', slider: true },
    ],
  },
];

export class OptionsMenu {
  // onChange(key, value) runs after a setting is saved; onAction(name) for action rows
  constructor({ tabsEl, bodyEl, onChange, onAction, tap }) {
    this.tabsEl = tabsEl;
    this.bodyEl = bodyEl;
    this.onChange = onChange;
    this.onAction = onAction;
    this.tap = tap || (() => {});
    this.tab = 'controls';
    this._renderTabs();
    this.render();
  }

  show(tab) {
    if (tab) this.tab = tab;
    this._renderTabs();
    this.render();
  }

  _renderTabs() {
    this.tabsEl.innerHTML = '';
    for (const t of OPTION_TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `opt-tab${t.id === this.tab ? ' on' : ''}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t.id === this.tab));
      b.innerHTML = `<span class="opt-tab-ico">${t.icon}</span><span class="opt-tab-lbl">${t.label}</span>`;
      b.addEventListener('click', () => {
        if (this.tab === t.id) return;
        this.tap();
        this.tab = t.id;
        this._renderTabs();
        this.render();
      });
      this.tabsEl.appendChild(b);
    }
  }

  render(keepScroll = false) {
    const tab = OPTION_TABS.find((t) => t.id === this.tab) || OPTION_TABS[0];
    const top = this.bodyEl.scrollTop;
    this.bodyEl.innerHTML = '';
    for (const row of tab.rows) this.bodyEl.appendChild(this._row(row));
    this.bodyEl.scrollTop = keepScroll ? top : 0;
  }

  _row(row) {
    const el = document.createElement('div');
    el.className = 'opt-row';
    const text = document.createElement('div');
    text.className = 'opt-text';
    text.innerHTML = `<strong>${row.label}</strong>${row.desc ? `<small>${row.desc}</small>` : ''}`;
    el.appendChild(text);

    if (row.action) {
      el.classList.add('opt-row-action');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt-action';
      b.textContent = row.button;
      b.addEventListener('click', () => {
        this.tap();
        this.onAction?.(row.action, b);
      });
      el.appendChild(b);
      return el;
    }

    if (row.slider) {
      el.classList.add('opt-row-slider');
      const wrap = document.createElement('div');
      wrap.className = 'opt-slider';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '100';
      input.step = '5';
      input.value = String(Math.round((getVal(row.key) ?? 1) * 100));
      const out = document.createElement('output');
      const label = () => {
        const v = Number(input.value);
        out.textContent = v === 0 ? 'Off' : `${v}%`;
        input.style.setProperty('--fill', `${v}%`);
      };
      label();
      input.addEventListener('input', () => {
        label();
        setVal(row.key, Number(input.value) / 100);
        this.onChange?.(row.key, Number(input.value) / 100);
      });
      input.addEventListener('change', () => this.tap());
      wrap.append(input, out);
      el.appendChild(wrap);
      return el;
    }

    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', row.label);
    const cur = getVal(row.key);
    for (const [value, label] of row.options) {
      const b = document.createElement('button');
      b.type = 'button';
      const on = typeof value === 'number' ? Math.abs(Number(cur) - value) < 1e-6 : cur === value || (value === false && !cur);
      b.className = on ? 'on' : '';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      b.textContent = label;
      b.addEventListener('click', () => {
        if (b.classList.contains('on')) return;
        this.tap();
        setVal(row.key, value);
        this.onChange?.(row.key, value);
        this.render(true); // re-render: some settings switch others off (assist vs classic)
      });
      seg.appendChild(b);
    }
    el.appendChild(seg);
    return el;
  }
}
