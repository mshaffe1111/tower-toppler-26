// Persistent player settings + progress (medals, ghost runs, skins). Everything lives in
// localStorage and every access is guarded, so private mode / blocked storage just means
// "nothing is remembered" rather than a crash.

const SETTINGS_KEY = 'tt26_settings_v2';
const PROGRESS_KEY = 'tt26_progress_v2';

const DEFAULT_SETTINGS = {
  stickSide: 'right', // 'right' | 'left'
  controls: {
    scheme: 'slide', // 'slide' (one thumb anywhere: move + slide up to jump) | 'buttons' | 'gesture'
    stickMode: 'floating', // 'floating' (appears under your thumb) | 'fixed'
    sensitivity: 'medium', // 'low' | 'medium' | 'high' — how far you push for full speed
    upThreshold: 0.55, // how far up/down the stick must go for doors & lifts (0.4 .. 0.75)
    opacity: 1, // 0.4 .. 1
    layout: null, // { portrait: {split, jump:{x,y,s}, fire, rewind, stick}, landscape: {...} } — see controls.js
  },
  musicVolume: 0.8, // 0..1
  sfxVolume: 1, // 0..1
  classic: false, // original rules: no edge guard, no rewind, no checkpoints
  assist: false, // infinite lives + unlimited rewind
  gameSpeed: 1, // 0.6 .. 1
  clock: true, // false = no countdown (relaxed); flood / collapse towers still rise
  reducedMotion: false, // no screen shake / flashes / camera punch
  mirror: false, // mirror every tower
  quality: 'auto', // 'auto' | 'low' | 'medium' | 'high'
  diorama: true, // tilt-shift "toy diorama" look
  skin: 'classic',
  ghosts: true,
  haptics: true,
  autoFullscreen: true, // phones: go full screen when a game starts (hides the browser bars)
};

const DEFAULT_PROGRESS = {
  medals: {}, // towerKey -> { time, nohit, secrets, bestTime }
  ghosts: {}, // towerKey -> { t: duration, d: [col, floor, facing, ...] at 15Hz }
  bestScores: {}, // mode -> score
  dailyBest: {}, // seed -> score
  endlessBestTower: 0,
  towersCleared: 0,
};

function load(key, defaults) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(defaults);
    return { ...structuredClone(defaults), ...JSON.parse(raw) };
  } catch (_) {
    return structuredClone(defaults);
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

export const settings = load(SETTINGS_KEY, DEFAULT_SETTINGS);
settings.controls = { ...structuredClone(DEFAULT_SETTINGS.controls), ...(settings.controls || {}) };
// One-time move to the Slide controls (the player's preferred style); Options can switch back
if (!settings.controls.slideIntro) {
  settings.controls.scheme = 'slide';
  settings.controls.slideIntro = true;
  save(SETTINGS_KEY, settings);
}

export function setControl(key, value) {
  settings.controls = { ...settings.controls, [key]: value };
  save(SETTINGS_KEY, settings);
  for (const fn of listeners) fn('controls', settings.controls);
}

export const DEFAULT_CONTROLS = DEFAULT_SETTINGS.controls;
export const progress = load(PROGRESS_KEY, DEFAULT_PROGRESS);

// Migrate the old stick-side key from the previous version
try {
  const oldSide = localStorage.getItem('tt26_stick_side');
  if (oldSide && !localStorage.getItem(SETTINGS_KEY)) settings.stickSide = oldSide;
} catch (_) {}

const listeners = new Set();
export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSetting(key, value) {
  settings[key] = value;
  save(SETTINGS_KEY, settings);
  for (const fn of listeners) fn(key, value);
}

export function saveProgress() {
  save(PROGRESS_KEY, progress);
}

// ---------- Medals ----------
export function towerKey(mode, tower, mirror) {
  if (mode === 'daily') return `d${tower.seed ?? tower.id}`;
  if (mode === 'endless') return null;
  // the real 1987 towers get their own key (old 'o' ghosts were recorded on a generated layout)
  if (mode === 'original') return `${tower.real ? 'or' : 'o'}${tower.id}${mirror ? 'm' : ''}`;
  return `c${tower.id}${mirror ? 'm' : ''}`;
}

export function getMedals(key) {
  return (key && progress.medals[key]) || { time: false, nohit: false, secrets: false, bestTime: null };
}

// Merges newly earned medals; returns which ones are new this run
// Medals per tower. The Original has 5, built on its own end-of-climb tally (Time, Technique,
// Extras); the Reboot has 5 for different play styles.
export const MEDALS = {
  original: [
    { id: 'time', icon: '⏱️', name: 'SPEED', desc: 'Topple it with 40% of the clock left' },
    { id: 'nohit', icon: '🛡️', name: 'UNTOUCHED', desc: 'Never get knocked down' },
    { id: 'survivor', icon: '🐸', name: 'SURVIVOR', desc: "Don't lose a life on this tower" },
    { id: 'marksman', icon: '🎯', name: 'MARKSMAN', desc: 'Destroy every flashing block and bouncing ball' },
    { id: 'perfect', icon: '👑', name: 'PERFECT', desc: 'All four in a single climb' },
  ],
  reboot: [
    { id: 'time', icon: '⏱️', name: 'SPEED', desc: 'Speedrunner: topple it with 40% of the clock left' },
    { id: 'nohit', icon: '🛡️', name: 'NO HITS', desc: 'Careful: never get hit' },
    { id: 'secrets', icon: '⭐', name: 'EXPLORER', desc: 'Explorer: find every hidden star-fish' },
    { id: 'purist', icon: '⏪', name: 'PURIST', desc: 'Purist: never rewind' },
    { id: 'combo', icon: '🔥', name: 'COMBO', desc: 'Aggressive: land a 4x combo' },
  ],
};

export function awardMedals(key, earned, timeTaken) {
  if (!key) return {};
  const prev = getMedals(key);
  const fresh = {};
  const next = { ...prev };
  for (const [id, got] of Object.entries(earned)) {
    fresh[id] = Boolean(got) && !prev[id];
    next[id] = Boolean(prev[id] || got);
  }
  next.bestTime = prev.bestTime == null ? timeTaken : Math.min(prev.bestTime, timeTaken);
  progress.medals[key] = next;
  saveProgress();
  return fresh;
}

export function totalMedals() {
  let n = 0;
  for (const m of Object.values(progress.medals)) for (const [k, v] of Object.entries(m)) if (k !== 'bestTime' && v === true) n++;
  return n;
}

// ---------- Ghost runs ----------
export function getGhost(key) {
  return (key && progress.ghosts[key]) || null;
}

export function saveGhostIfBest(key, duration, data) {
  if (!key || !data || data.length < 6) return false;
  const prev = progress.ghosts[key];
  if (prev && prev.t <= duration) return false;
  progress.ghosts[key] = { t: Math.round(duration * 100) / 100, d: data };
  saveProgress();
  return true;
}

// ---------- Skins (unlocked by total medals) ----------
export const SKINS = [
  { id: 'classic', name: 'Classic Pogo', body: '#5ee08a', emissive: '#15803d', boots: '#3fca76', hat: null, need: 0 },
  { id: 'arctic', name: 'Arctic', body: '#93c5fd', emissive: '#0284c7', boots: '#7dd3fc', hat: 'beanie', need: 3 },
  { id: 'ember', name: 'Ember', body: '#fb923c', emissive: '#c2410c', boots: '#f97316', hat: 'horns', need: 6 },
  { id: 'neon', name: 'Neon Night', body: '#f9a8d4', emissive: '#db2777', boots: '#f472b6', hat: 'visor', need: 10 },
  { id: 'chrome', name: 'Chrome Bot', body: '#cbd5e1', emissive: '#475569', boots: '#94a3b8', hat: 'antenna', need: 15, metal: true },
  { id: 'royal', name: 'Royal Toppler', body: '#fde047', emissive: '#a16207', boots: '#facc15', hat: 'crown', need: 24 },
];

export function skinUnlocked(skin) {
  return totalMedals() >= skin.need;
}

export function currentSkin() {
  const s = SKINS.find((k) => k.id === settings.skin);
  return s && skinUnlocked(s) ? s : SKINS[0];
}
