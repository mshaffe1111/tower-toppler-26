// ============================================================================
// Tower Toppler '26 — procedural Web Audio engine (no audio files)
// ============================================================================
//
// Everything here is synthesized at runtime. Signal graph:
//
//   music stems  drums / pad / bass / motif / lead / urgent / summit  (GainNodes)
//        └─> musicIn (musicFilter: danger opening, rewind darkening, summit air)
//               ├─> musicGain ─────────────────────────────┐
//               └─> musicReverbGain ─> reverb ─> revFilter ─┤
//   sfxGain ────┬──────────────────────────────────────────┤
//               ├─> sfxReverbGain ─> reverb                 ├─> mix
//   sfxSpace ───┴─> spaceSend ─> reverb (big one-shots)     │
//   ambGain (wind / creak / rain loops) ────────────────────┘
//
//   mix ─> mixFilter (underwater low-pass) ─> masterGain (mute)
//       ─> speakerTone (phone de-harsh) ─> limiter ─> destination
//
// Music: a 25 ms setInterval lookahead scheduler plays a 32-step (4 bar,
// 8th-note) loop per theme. Each theme (towers 1-8, endless, daily, sub,
// title) has its own key/mode, tempo, chord progression, motif, counter-melody
// and instrument colours. Stems fade in by tower height via per-stem gains;
// setIntensity() only stores numbers, the scheduler reads them.
//
// Tape bend (rewind) is done with one shared ConstantSourceNode whose output
// is wired into the detune param of every music oscillator, so already
// sounding notes bend smoothly too.
//
// Every one-shot voice disconnects its nodes in onended; loops are lazily
// created singletons that are torn down after being silent for a while.
// ============================================================================

const LOOKAHEAD = 0.12; // seconds of music scheduled ahead
const TICK_MS = 25; // scheduler interval
const MASTER_LEVEL = 0.92;
const MUSIC_LEVEL = 0.72;

const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

// ---------------------------------------------------------------------------
// Theme data
// ---------------------------------------------------------------------------
// root:    tonic MIDI note in octave 3 (pad register). Bass plays an octave
//          below, motif an octave above, counter-melody degrees >= 7 sit
//          two octaves above.
// prog:    chord root as scale degree per bar (diatonic stacked thirds).
// motif / counter: [step 0..31, scale degree (rel. to root+12), length steps]
// drums:   8-char per-bar patterns ('x' = hit); fill replaces snare on bar 4.
// bass.pat: per-8th: r root, o octave, f fifth, t third, l lower neighbour.
// perc:    extra percussion that joins with the lead layer.
// bright:  base cutoff of the music bus low-pass (danger opens it further).
// minHeight: floor for the height layering (title/sub play melodic anyway).
const THEMES = {
  1: {
    name: 'Sunrise Steps', bpm: 112, root: 57, scale: SCALES.aeolian, prog: [0, 5, 3, 4], chord: 5,
    pad: { wave: 'triangle', cut: 680, gain: 0.026, atk: 0.18 },
    bass: { pat: 'r.rrr.rf', wave: 'square', cut: 560, gain: 0.05, len: 0.85 },
    drums: { kick: 'x...x...', snare: '..x...x.', hat: '.x.x.x.x', fill: '..x...xx', snareType: 'snare' },
    perc: 'shaker', swing: 0, wet: 0.18, bright: 5200,
    motifVoice: 'bell', motifGain: 0.032,
    motif: [[0, 4, 2], [2, 3, 1], [3, 2, 1], [4, 4, 3], [8, 5, 2], [10, 4, 1], [11, 2, 1], [12, 0, 4],
      [16, 4, 2], [18, 3, 1], [19, 2, 1], [20, 4, 2], [22, 6, 2], [24, 7, 3], [27, 6, 1], [28, 4, 4]],
    counterVoice: 'flute', counterGain: 0.017,
    counter: [[2, 7, 2], [6, 9, 2], [10, 7, 4], [18, 8, 2], [22, 10, 2], [26, 11, 4]],
  },
  2: {
    name: 'Jade Pagoda', bpm: 104, root: 50, scale: SCALES.dorian, prog: [0, 3, 6, 4], chord: 4,
    pad: { wave: 'triangle', cut: 620, gain: 0.024, atk: 0.3, chorus: true },
    bass: { pat: 'r..f.r.o', wave: 'triangle', cut: 700, gain: 0.055, len: 1.4 },
    drums: { kick: 'x.....x.', snare: '....x...', hat: 'x.x.x.x.', fill: '....x.x.', snareType: 'rim' },
    perc: 'woodblock', swing: 0.12, wet: 0.24, bright: 4600,
    motifVoice: 'pluck', motifGain: 0.034,
    motif: [[0, 0, 1], [1, 2, 1], [3, 4, 2], [6, 3, 1], [7, 2, 1], [8, 4, 3], [12, 6, 1], [13, 4, 1], [14, 3, 2],
      [16, 0, 1], [17, 2, 1], [19, 4, 2], [22, 7, 2], [24, 6, 3], [28, 4, 1], [29, 3, 1], [30, 2, 2]],
    counterVoice: 'flute', counterGain: 0.016,
    counter: [[0, 9, 6], [8, 10, 6], [16, 11, 4], [22, 9, 2], [24, 8, 8]],
  },
  3: {
    name: 'Neon Rain', bpm: 118, root: 49, scale: SCALES.aeolian, prog: [0, 5, 6, 4], chord: 4,
    pad: { wave: 'sawtooth', cut: 560, gain: 0.016, atk: 0.12 },
    bass: { pat: 'r.rr.rro', wave: 'sawtooth', cut: 620, gain: 0.048, len: 0.7 },
    drums: { kick: 'x..x..x.', snare: '....x...', hat: 'xxxxxxxx', fill: '....x.xx', snareType: 'clap' },
    perc: 'shaker', swing: 0.04, wet: 0.2, bright: 5600,
    motifVoice: 'square', motifGain: 0.02,
    motif: [[0, 7, 1], [1, 4, 1], [2, 2, 1], [3, 4, 1], [4, 7, 1], [6, 9, 2], [8, 8, 1], [9, 5, 1], [10, 3, 1],
      [11, 5, 1], [12, 8, 1], [14, 7, 2], [16, 7, 1], [17, 4, 1], [18, 2, 1], [19, 4, 1], [20, 7, 1],
      [22, 11, 2], [24, 9, 3], [27, 8, 1], [28, 6, 4]],
    counterVoice: 'saw', counterGain: 0.012,
    counter: [[0, 2, 4], [4, 4, 4], [8, 5, 8], [16, 2, 4], [20, 4, 4], [24, 6, 8]],
  },
  4: {
    name: 'Clockwork Spire', bpm: 120, root: 55, scale: SCALES.mixolydian, prog: [0, 6, 3, 0], chord: 4,
    pad: { wave: 'triangle', cut: 720, gain: 0.022, atk: 0.1 },
    bass: { pat: 'r.o.r.of', wave: 'square', cut: 600, gain: 0.05, len: 0.6 },
    drums: { kick: 'x.x.x.x.', snare: '..x...x.', hat: '.x.x.x.x', fill: '..x.x.xx', snareType: 'snare' },
    perc: 'tick', swing: 0, wet: 0.14, bright: 5800,
    motifVoice: 'clock', motifGain: 0.034,
    motif: [[0, 0, 1], [2, 4, 1], [3, 4, 1], [4, 2, 1], [6, 4, 1], [7, 6, 1], [8, 7, 2], [10, 6, 1], [11, 4, 1],
      [12, 5, 2], [14, 4, 2], [16, 0, 1], [18, 4, 1], [19, 4, 1], [20, 2, 1], [22, 4, 1], [23, 6, 1],
      [24, 9, 2], [26, 7, 1], [27, 6, 1], [28, 7, 4]],
    counterVoice: 'square', counterGain: 0.012,
    counter: [[4, 9, 2], [12, 8, 2], [20, 9, 2], [28, 11, 4]],
  },
  5: {
    name: 'Glass Garden', bpm: 100, root: 51, scale: SCALES.lydian, prog: [0, 1, 5, 4], chord: 5,
    pad: { wave: 'sine', cut: 900, gain: 0.03, atk: 0.45, chorus: true },
    bass: { pat: 'r...f...', wave: 'triangle', cut: 600, gain: 0.055, len: 3.2 },
    drums: { kick: 'x.....x.', snare: '....x...', hat: '..x...x.', fill: '....x..x', snareType: 'rim' },
    perc: 'ride', swing: 0.06, wet: 0.3, bright: 4800,
    motifVoice: 'glass', motifGain: 0.03,
    motif: [[0, 4, 2], [2, 6, 2], [4, 7, 4], [8, 3, 2], [10, 4, 2], [12, 1, 4], [16, 4, 2], [18, 6, 2],
      [20, 8, 2], [22, 9, 2], [24, 7, 6]],
    counterVoice: 'pluck', counterGain: 0.016,
    counter: [[1, 11, 1], [3, 13, 1], [5, 14, 1], [7, 13, 1], [9, 10, 1], [11, 11, 1], [13, 13, 1], [15, 11, 1],
      [17, 11, 1], [19, 13, 1], [21, 14, 1], [23, 15, 1], [25, 14, 1], [27, 13, 1], [29, 11, 1], [31, 9, 1]],
  },
  6: {
    name: 'Ember Heights', bpm: 124, root: 52, scale: SCALES.harmonicMinor, prog: [0, 5, 3, 4], chord: 4,
    pad: { wave: 'sawtooth', cut: 600, gain: 0.016, atk: 0.1 },
    bass: { pat: 'r.rorrfr', wave: 'sawtooth', cut: 650, gain: 0.05, len: 0.7 },
    drums: { kick: 'x..x.x..', snare: '..x...x.', hat: 'xxxxxxxx', fill: '..x.xxxx', snareType: 'snare' },
    perc: 'toms', swing: 0, wet: 0.16, bright: 6000,
    motifVoice: 'saw', motifGain: 0.016,
    motif: [[0, 0, 2], [2, 4, 2], [4, 5, 1], [5, 4, 1], [6, 6, 2], [8, 7, 3], [11, 6, 1], [12, 5, 2], [14, 4, 2],
      [16, 0, 2], [18, 4, 2], [20, 5, 1], [21, 6, 1], [22, 7, 2], [24, 9, 2], [26, 8, 1], [27, 7, 1], [28, 6, 4]],
    counterVoice: 'bell', counterGain: 0.02,
    counter: [[0, 11, 4], [4, 12, 4], [8, 10, 8], [16, 11, 4], [20, 12, 4], [24, 13, 8]],
  },
  7: {
    name: 'Starfall Observatory', bpm: 108, root: 58, scale: SCALES.ionian, prog: [0, 4, 5, 3], chord: 5,
    pad: { wave: 'triangle', cut: 760, gain: 0.024, atk: 0.35, chorus: true },
    bass: { pat: 'r..r..o.', wave: 'square', cut: 520, gain: 0.05, len: 1.6 },
    drums: { kick: 'x...x...', snare: '..x...x.', hat: '.x.x.x.x', fill: '..x..xxx', snareType: 'clap' },
    perc: 'ride', swing: 0.05, wet: 0.28, bright: 5400,
    motifVoice: 'bell', motifGain: 0.03,
    motif: [[0, 0, 1], [1, 4, 1], [2, 7, 2], [4, 6, 1], [5, 4, 1], [6, 2, 2], [8, 1, 1], [9, 4, 1], [10, 6, 2],
      [12, 5, 4], [16, 0, 1], [17, 4, 1], [18, 7, 2], [20, 9, 1], [21, 8, 1], [22, 7, 2], [24, 6, 1],
      [25, 4, 1], [26, 3, 2], [28, 4, 4]],
    counterVoice: 'glass', counterGain: 0.016,
    counter: [[0, 14, 4], [6, 13, 2], [8, 11, 6], [16, 14, 4], [22, 16, 2], [24, 14, 8]],
  },
  8: {
    name: 'Summit of Storms', bpm: 128, root: 50, scale: SCALES.aeolian, prog: [0, 5, 2, 6], chord: 4,
    pad: { wave: 'sawtooth', cut: 760, gain: 0.02, atk: 0.08 },
    bass: { pat: 'rorrorro', wave: 'sawtooth', cut: 700, gain: 0.05, len: 0.6 },
    drums: { kick: 'x.x.x.x.', snare: '..x...x.', hat: 'xxxxxxxx', fill: '..xxxxxx', snareType: 'snare', kickGain: 0.12 },
    perc: 'toms', swing: 0, wet: 0.22, bright: 6400,
    motifVoice: 'brass', motifGain: 0.024,
    motif: [[0, 0, 2], [2, 4, 2], [4, 7, 3], [7, 6, 1], [8, 5, 2], [10, 4, 2], [12, 2, 4], [16, 3, 2],
      [18, 4, 2], [20, 5, 2], [22, 6, 2], [24, 7, 4], [28, 9, 2], [30, 8, 2]],
    counterVoice: 'saw', counterGain: 0.014,
    counter: [[0, 14, 8], [8, 12, 8], [16, 12, 4], [20, 13, 4], [24, 14, 8]],
  },
  endless: {
    name: 'Infinite Ascent', bpm: 116, root: 53, scale: SCALES.dorian, prog: [0, 3, 4, 6], chord: 4,
    pad: { wave: 'triangle', cut: 700, gain: 0.024, atk: 0.2, chorus: true },
    bass: { pat: 'r.r.rorf', wave: 'square', cut: 600, gain: 0.05, len: 0.8 },
    drums: { kick: 'x...x.x.', snare: '..x...x.', hat: '.x.x.x.x', fill: '..x.x.xx', snareType: 'clap' },
    perc: 'shaker', swing: 0.03, wet: 0.2, bright: 5400, evolve: true,
    motifVoice: 'square', motifGain: 0.02,
    motif: [[0, 4, 1], [1, 2, 1], [2, 0, 1], [3, 2, 1], [4, 4, 2], [6, 7, 2], [8, 6, 1], [9, 4, 1], [10, 3, 1],
      [11, 4, 1], [12, 6, 4], [16, 4, 1], [17, 2, 1], [18, 0, 1], [19, 2, 1], [20, 4, 2], [22, 9, 2],
      [24, 8, 2], [26, 7, 2], [28, 4, 4]],
    counterVoice: 'bell', counterGain: 0.018,
    counter: [[0, 11, 4], [8, 13, 4], [16, 14, 4], [24, 11, 8]],
  },
  daily: {
    name: 'Daily Spark', bpm: 122, root: 55, scale: SCALES.ionian, prog: [0, 5, 3, 4], chord: 4,
    pad: { wave: 'triangle', cut: 760, gain: 0.022, atk: 0.12 },
    bass: { pat: 'r.rfr.ro', wave: 'square', cut: 600, gain: 0.05, len: 0.7 },
    drums: { kick: 'x...x...', snare: '..x...x.', hat: 'xxxxxxxx', fill: '..x.x.xx', snareType: 'clap' },
    perc: 'tick', swing: 0.08, wet: 0.18, bright: 5800,
    motifVoice: 'pluck', motifGain: 0.032,
    motif: [[0, 4, 1], [1, 4, 1], [2, 5, 1], [3, 4, 1], [4, 2, 2], [6, 0, 2], [8, 1, 1], [9, 2, 1], [10, 4, 2],
      [12, 2, 4], [16, 4, 1], [17, 4, 1], [18, 5, 1], [19, 7, 1], [20, 9, 2], [22, 7, 2], [24, 8, 1],
      [25, 7, 1], [26, 5, 1], [27, 4, 1], [28, 2, 4]],
    counterVoice: 'bell', counterGain: 0.018,
    counter: [[0, 11, 2], [4, 9, 2], [8, 8, 4], [16, 11, 2], [20, 12, 2], [24, 14, 8]],
  },
  sub: {
    name: 'Abyssal Drift', bpm: 96, root: 49, scale: SCALES.lydian, prog: [0, 1, 5, 4], chord: 5,
    pad: { wave: 'sine', cut: 560, gain: 0.034, atk: 0.7, chorus: true },
    bass: { pat: 'r.....f.', wave: 'triangle', cut: 420, gain: 0.06, len: 3.5 },
    drums: { kick: 'x.....x.', snare: '....x...', hat: '..x...x.', fill: '....x...', snareType: 'rim', kickGain: 0.08 },
    perc: 'bubbles', swing: 0.1, wet: 0.42, bright: 3200, minHeight: 0.2,
    motifVoice: 'bubble', motifGain: 0.034,
    motif: [[0, 4, 3], [3, 6, 1], [4, 7, 4], [8, 6, 2], [10, 4, 2], [12, 2, 4], [16, 4, 3], [19, 6, 1],
      [20, 9, 4], [24, 8, 2], [26, 7, 2], [28, 4, 4]],
    counterVoice: 'glass', counterGain: 0.014,
    counter: [[2, 11, 6], [10, 13, 6], [18, 14, 6], [26, 11, 6]],
  },
  title: {
    name: "Toppler '26", bpm: 100, root: 57, scale: SCALES.aeolian, prog: [5, 6, 0, 0], chord: 5,
    pad: { wave: 'triangle', cut: 720, gain: 0.028, atk: 0.4, chorus: true },
    bass: { pat: 'r...r.f.', wave: 'square', cut: 520, gain: 0.05, len: 1.8 },
    drums: { kick: 'x.....x.', snare: '....x...', hat: '.x.x.x.x', fill: '....x.xx', snareType: 'rim' },
    perc: 'shaker', swing: 0.06, wet: 0.26, bright: 5000, minHeight: 0.5,
    motifVoice: 'bell', motifGain: 0.032,
    motif: [[0, 0, 2], [2, 2, 2], [4, 4, 4], [8, 3, 2], [10, 2, 2], [12, 1, 4], [16, 0, 2], [18, 2, 2],
      [20, 4, 2], [22, 7, 2], [24, 6, 8]],
    counterVoice: 'flute', counterGain: 0.016,
    counter: [[4, 9, 4], [12, 8, 4], [20, 11, 4], [28, 9, 4]],
  },
};

const THEME_ALIASES = { endless: 'endless', daily: 'daily', sub: 'sub', submarine: 'sub', title: 'title', menu: 'title' };
const CUE_TYPES = ['roller', 'bouncer', 'molecule', 'eye', 'boss'];
const AMBIENT_LOOPS = ['wind', 'creak', 'rain'];

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------
const MTOF = new Float32Array(128);
for (let i = 0; i < 128; i++) MTOF[i] = 440 * Math.pow(2, (i - 69) / 12);
const mtof = (m) => MTOF[m < 0 ? 0 : m > 127 ? 127 : m | 0];
// NaN-safe clamps (NaN -> lo / fallback)
const clamp = (x, lo, hi) => (x > lo ? (x < hi ? x : hi) : lo);
const clamp01 = (x) => clamp(x, 0, 1);
const finite = (x, fallback) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const hz = (f) => clamp(f, 20, 20000);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const degMidi = (scale, d, base) => {
  const n = scale.length;
  const o = Math.floor(d / n);
  return base + 12 * o + scale[d - o * n];
};

// Shared option objects (avoid per-note allocation in the scheduler)
const NO = Object.freeze({});
const MO = Object.freeze({ music: true });
const MO_KICK = Object.freeze({ music: true, glide: 0.09, atk: 0.002 });
const MO_KICK2 = Object.freeze({ music: true, glide: 0.04, atk: 0.002 });
const MO_SN = Object.freeze({ music: true, glide: 0.05, atk: 0.002 });
const MO_SHAKE = Object.freeze({ music: true, atk: 0.014 });
const MO_URG = Object.freeze({ music: true, lp: 3200, q: 0.8, atk: 0.003 });
const MO_SQUARE = Object.freeze({ music: true, lp: 2600, q: 0.8, hold: 0.55, atk: 0.008, vib: 5.5, vibD: 9, vibDelay: 0.12 });
const MO_SAW = Object.freeze({ music: true, lp: 2300, q: 0.9, hold: 0.65, atk: 0.025, det: 8 });
const MO_SAW2 = Object.freeze({ music: true, lp: 2300, q: 0.9, hold: 0.65, atk: 0.025, det: -8 });
const MO_FLUTE = Object.freeze({ music: true, atk: 0.05, hold: 0.7, vib: 5, vibD: 12, vibDelay: 0.15 });
const MO_BUBBLE = Object.freeze({ music: true, glide: 0.045, atk: 0.005 });
const MO_BUBBLEPERC = Object.freeze({ music: true, glide: 0.07, atk: 0.003 });
const MO_CRASH = Object.freeze({ music: true, atk: 0.004 });

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.limiter = null;
    this.reverb = null;
    this.mix = null;
    this.mixFilter = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.sfxSpace = null;
    this.sfxReverbGain = null;
    this.musicIn = null;
    this.musicGain = null;
    this.musicReverbGain = null;
    this.ambGain = null;
    this._noiseBuffer = null;
    this._brownBuffer = null;
    this._dropsBuffer = null;
    this._detuneSrc = null;
    this._wobbleGain = null;
    this._stems = null;

    this.muted = false;
    this.musicEnabled = true;
    this.musicActive = false;
    this.towerId = 1;

    // Scheduler state
    this._grooveTimer = null;
    this._grooveStep = 0;
    this._nextNoteTime = 0;
    this._loopCount = 0;
    this._motifVar = 0;
    this._tempoMul = 1;
    this._tickBound = () => this._tick();

    // Adaptive-music inputs (written every frame by setIntensity, read by scheduler)
    this._int = { height: 0, timeLeftFrac: 1, danger: 0, atExit: false, rewinding: false };
    this._lay = { bass: false, motif: false, lead: false };
    this._urgent = false;
    this._summit = null;
    this._rwState = false;
    this._rewindSfx = false;
    this._rewindSafety = null;
    this._filtTarget = 0;
    this._filtQ = 0;

    // Theme
    this._themeKey = null;
    this._theme = null;
    this._tp = null;
    this._bpm = 112;
    this._pendingTheme = null;
    this._applyTheme(this._resolveTheme(1));

    // Loops
    this._loops = { wind: null, creak: null, rain: null, charge: null, rewind: null };
    this._loopLevel = { wind: 0, creak: 0, rain: 0 };
    this._underwater = false;
    this._uwApplied = null;
    this._uwLfo = null;
    this._uwLfoGain = null;
    this._chargeLast = 0;
    this._chargeDog = null;

    // Rate limits
    this._cueLast = { roller: -9, bouncer: -9, molecule: -9, eye: -9, boss: -9 };
    this._lastFootstep = -9;

    this._bindAutoUnlock();
  }

  // =========================================================================
  // Context / graph lifecycle
  // =========================================================================
  _bindAutoUnlock() {
    if (typeof window === 'undefined') return;
    const onFirstGesture = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', onFirstGesture, true);
        window.removeEventListener('touchstart', onFirstGesture, true);
        window.removeEventListener('keydown', onFirstGesture, true);
      }
    };
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, passive: true });
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          this._buildGraph();
        } catch (e) {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
      // iOS reports 'interrupted' after calls / Siri; resume() inside the gesture fixes both.
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    if (this.musicActive && this.musicEnabled && !this.muted) {
      this._startGroove();
    }
  }

  _buildGraph() {
    const ctx = this.ctx;

    // iOS unlock: play a 1-sample silent buffer inside the user gesture.
    try {
      const silent = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = silent;
      s.connect(ctx.destination);
      s.onended = () => s.disconnect();
      s.start(0);
    } catch (e) { /* ignore */ }

    // Master limiter + gentle mobile-speaker highshelf de-harshing
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -12;
    this.limiter.knee.value = 14;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.16;

    const speakerTone = ctx.createBiquadFilter();
    speakerTone.type = 'highshelf';
    speakerTone.frequency.value = 3400;
    speakerTone.gain.value = -4;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : MASTER_LEVEL;
    this.masterGain.connect(speakerTone);
    speakerTone.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // Underwater low-pass over the whole mix (wide open when dry)
    this.mixFilter = ctx.createBiquadFilter();
    this.mixFilter.type = 'lowpass';
    this.mixFilter.frequency.value = 20000;
    this.mixFilter.Q.value = 0.5;
    this.mixFilter.connect(this.masterGain);
    this.mix = ctx.createGain();
    this.mix.connect(this.mixFilter);

    // Noise buffers: white + brown (2s), shared by all hits (zero per-hit allocation)
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 2);
    this._noiseBuffer = ctx.createBuffer(1, len, rate);
    this._brownBuffer = ctx.createBuffer(1, len, rate);
    const wd = this._noiseBuffer.getChannelData(0);
    const bd = this._brownBuffer.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      wd[i] = w;
      b = (b + 0.02 * w) / 1.02;
      bd[i] = b * 3.5;
    }

    // Tight 0.55s stereo algorithmic space reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._createReverbImpulse(0.55, 3.2);
    const reverbFilter = ctx.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 2200;
    this.reverb.connect(reverbFilter);
    reverbFilter.connect(this.mix);

    // SFX buses
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol ?? 1;
    this.sfxGain.connect(this.mix);
    this.sfxReverbGain = ctx.createGain();
    this.sfxReverbGain.gain.value = 0.14;
    this.sfxGain.connect(this.sfxReverbGain);
    this.sfxReverbGain.connect(this.reverb);
    // "Space" bus: SFX with a much bigger reverb send (thunder, fanfares...)
    this.sfxSpace = ctx.createGain();
    this.sfxSpace.connect(this.sfxGain);
    const spaceSend = ctx.createGain();
    spaceSend.gain.value = 0.4;
    this.sfxSpace.connect(spaceSend);
    spaceSend.connect(this.reverb);

    // Ambience bus (persistent loops)
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 1;
    this.ambGain.connect(this.mix);

    // Music bus: stems -> musicFilter -> dry + reverb send
    this.musicIn = ctx.createBiquadFilter();
    this.musicIn.type = 'lowpass';
    this.musicIn.frequency.value = this._theme.bright;
    this.musicIn.Q.value = 0.7;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicEnabled ? MUSIC_LEVEL * (this.musicVol ?? 1) : 0;
    this.musicGain.connect(this.mix);
    this.musicReverbGain = ctx.createGain();
    this.musicReverbGain.gain.value = this._musicWet();
    this.musicReverbGain.connect(this.reverb);
    this.musicIn.connect(this.musicGain);
    this.musicIn.connect(this.musicReverbGain);

    const mkStem = (v) => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.musicIn);
      return { gain: g, target: v, offAt: -99 };
    };
    this._stems = {
      drums: mkStem(1), pad: mkStem(1), bass: mkStem(0), motif: mkStem(0),
      lead: mkStem(0), urgent: mkStem(0), summit: mkStem(1),
    };

    // Tape-bend bus: one ConstantSource feeding every music oscillator's detune.
    if (ctx.createConstantSource) {
      this._detuneSrc = ctx.createConstantSource();
      this._detuneSrc.offset.value = 0;
      const wob = ctx.createOscillator();
      wob.type = 'sine';
      wob.frequency.value = 4.3;
      this._wobbleGain = ctx.createGain();
      this._wobbleGain.gain.value = 0;
      wob.connect(this._wobbleGain);
      this._wobbleGain.connect(this._detuneSrc.offset);
      wob.start();
      this._detuneSrc.start();
    }

    // Apply state chosen before unlock
    if (this._underwater) this.setUnderwater(true);
    this._restoreLoops();
  }

  _createReverbImpulse(duration = 0.55, decay = 3.2) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.45 + white * 0.55;
        data[i] = lp * env;
      }
    }
    return impulse;
  }

  _ok() {
    return this.ctx !== null && !this.muted && this.sfxGain !== null && this.ctx.state !== 'closed';
  }

  _t() {
    return this.ctx.currentTime + 0.005;
  }

  // Freeze an AudioParam at its current value (no jump) before new automation.
  _hold(param, t) {
    if (param.cancelAndHoldAtTime) {
      param.cancelAndHoldAtTime(t);
    } else {
      const v = param.value;
      param.cancelScheduledValues(t);
      param.setValueAtTime(v, t);
    }
  }

  _musicWet() {
    return this.musicEnabled ? (this._theme ? this._theme.wet : 0.18) : 0;
  }

  // =========================================================================
  // Mute / music toggles
  // =========================================================================
  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted) {
    const next = Boolean(muted);
    if (next === this.muted) return this.muted;
    this.muted = next;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : MASTER_LEVEL, this.ctx.currentTime, 0.02);
    }
    if (this.muted) {
      this._stopGroove();
      this._killAllLoops();
    } else {
      if (this.musicActive && this.musicEnabled) this._startGroove();
      this._restoreLoops();
    }
    return this.muted;
  }

  // Volume sliders from the Options menu (0..1 each). Music at 0 stops the groove entirely.
  setVolumes(music, sfx) {
    this.musicVol = Math.max(0, Math.min(1, music));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    const wantMusic = this.musicVol > 0.001;
    if (wantMusic !== this.musicEnabled) this.toggleMusic();
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicEnabled ? MUSIC_LEVEL * this.musicVol : 0, now, 0.04);
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxVol, now, 0.03);
    }
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicEnabled ? MUSIC_LEVEL * (this.musicVol ?? 1) : 0, now, 0.04);
      if (this.musicReverbGain) this.musicReverbGain.gain.setTargetAtTime(this._musicWet(), now, 0.04);
    }
    if (!this.musicEnabled) {
      this._stopGroove();
    } else if (this.musicActive && !this.muted) {
      this._startGroove();
    }
    return this.musicEnabled;
  }

  setMusicActive(active) {
    const next = Boolean(active);
    if (this.musicActive === next) return;
    this.musicActive = next;
    if (this.musicActive && this.musicEnabled && !this.muted) {
      this._startGroove();
    } else {
      this._stopGroove();
    }
  }

  // =========================================================================
  // Themes
  // =========================================================================
  /**
   * Select the music theme: 1..8 (towers), 'endless', 'daily', 'sub', 'title'.
   * While music is playing the switch lands on the next bar line.
   */
  setTowerTheme(towerId = 1) {
    const next = this._resolveTheme(towerId);
    if (next.key === this._themeKey && !this._pendingTheme) return;
    this.towerId = next.id;
    this._int.atExit = false;
    this._int.rewinding = false;
    if (this._grooveTimer) {
      this._pendingTheme = next;
    } else {
      this._applyTheme(next);
    }
  }

  _resolveTheme(id) {
    let key = null;
    if (typeof id === 'string') key = THEME_ALIASES[id.toLowerCase()] || null;
    let num = 1;
    if (!key) {
      num = Math.round(clamp(finite(Number(id), 1), 1, 8));
      key = String(num);
    }
    let tr = 0;
    let bpmAdd = 0;
    if (key === 'daily') {
      // Same tune for everyone on a given day: date-seeded key + tempo.
      const d = new Date();
      const doy = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);
      tr = (doy % 7) - 3;
      bpmAdd = (doy % 3) * 2;
    }
    return { key, id: THEME_ALIASES[key] ? key : num, th: THEMES[key], tr, bpmAdd };
  }

  _applyTheme(next) {
    this._themeKey = next.key;
    this._theme = next.th;
    this._bpm = next.th.bpm + next.bpmAdd;
    this._tp = this._prepTheme(next.th, next.tr);
    this._pendingTheme = null;
    this._grooveStep = 0;
    this._loopCount = 0;
    this._motifVar = 0;
    this._filtTarget = 0; // force filter re-target
    if (this.ctx && this.musicReverbGain) {
      this.musicReverbGain.gain.setTargetAtTime(this._musicWet(), this.ctx.currentTime, 0.5);
    }
  }

  // Pre-compute every frequency the scheduler needs for a theme.
  _prepTheme(th, tr) {
    const sc = th.scale;
    const root = th.root + tr;
    const pad = [];
    const bass = [];
    const arp = [];
    for (let b = 0; b < 4; b++) {
      const d0 = th.prog[b];
      const chord = [];
      for (let k = 0; k < th.chord; k++) {
        let mm = degMidi(sc, d0 + 2 * k, root);
        while (mm > root + 21) mm -= 12;
        chord.push(mtof(mm));
      }
      pad.push(chord);

      let bm = degMidi(sc, d0, root - 12);
      while (bm > root - 5) bm -= 12;
      while (bm < root - 19 || bm < 36) bm += 12;
      const rel = (k) => degMidi(sc, d0 + k, 0) - degMidi(sc, d0, 0);
      bass.push({ r: mtof(bm), o: mtof(bm + 12), f: mtof(bm + rel(4)), t: mtof(bm + rel(2)), l: mtof(bm + rel(-1)) });

      const up = [0, 2, 4, 7].map((k) => mtof(degMidi(sc, d0 + k, root + 12)));
      arp.push([up[0], up[1], up[2], up[3], up[2], up[1]]);
    }
    const variants = th.evolve ? [0, 2, 4, 1] : [0];
    const motif = variants.map((off) => {
      const arr = new Array(32).fill(null);
      for (const [s, d, l] of th.motif) arr[s] = [mtof(degMidi(sc, d + off, root + 12)), l];
      return arr;
    });
    const counter = new Array(32).fill(null);
    for (const [s, d, l] of th.counter) counter[s] = [mtof(degMidi(sc, d, root + 12)), l];

    const summit = [root, root + 7, root + 12, degMidi(sc, 2, root + 12), root + 19].map(mtof);
    const soar = mtof(root + 24);
    const bw = th.bass.wave;
    return {
      root, pad, bass, arp, motif, counter, summit, soar,
      bassO1: { music: true, atk: 0.006, hold: 0.5 },
      bassO2: { music: true, lp: th.bass.cut, fe: th.bass.cut * 0.6, q: 2, atk: 0.006, hold: 0.4 },
      bassWave: bw,
    };
  }

  // =========================================================================
  // Adaptive music input (called every frame — store only, no allocation)
  // =========================================================================
  /**
   * @param {{height?:number,timeLeftFrac?:number,danger?:number,atExit?:boolean,rewinding?:boolean}} o
   */
  setIntensity(o) {
    if (!o) return;
    const I = this._int;
    if (o.height !== undefined) I.height = clamp01(o.height);
    if (o.timeLeftFrac !== undefined) I.timeLeftFrac = finite(o.timeLeftFrac, 1);
    if (o.danger !== undefined) I.danger = clamp01(o.danger);
    if (o.atExit !== undefined) I.atExit = !!o.atExit;
    if (o.rewinding !== undefined) I.rewinding = !!o.rewinding;
  }

  /** Debug/inspection snapshot of the adaptive-music state. */
  getMusicState() {
    const s = this._stems;
    return {
      theme: this._themeKey,
      name: this._theme.name,
      bpm: this._bpm * this._tempoMul,
      urgent: this._urgent,
      summit: !!this._summit,
      rewinding: this._rwState,
      playing: !!this._grooveTimer,
      stems: s ? {
        drums: s.drums.target, pad: s.pad.target, bass: s.bass.target, motif: s.motif.target,
        lead: s.lead.target, urgent: s.urgent.target,
      } : null,
    };
  }

  // =========================================================================
  // Scheduler
  // =========================================================================
  _startGroove() {
    if (this._grooveTimer || !this.ctx || this.muted || !this.musicEnabled) return;
    if (this._pendingTheme) this._applyTheme(this._pendingTheme);
    this._nextNoteTime = this.ctx.currentTime + 0.05;
    this._grooveTimer = setInterval(this._tickBound, TICK_MS);
    this._tick();
  }

  _stopGroove() {
    if (this._grooveTimer) {
      clearInterval(this._grooveTimer);
      this._grooveTimer = null;
    }
    this._summitOff();
    if (this._rwState) this._setRewindBend(false);
    if (this._pendingTheme) this._applyTheme(this._pendingTheme);
  }

  _tick() {
    const ctx = this.ctx;
    if (!this.musicActive || !this.musicEnabled || this.muted || !ctx || ctx.state !== 'running' || !this._stems) return;
    const now = ctx.currentTime;
    this._updateStems(now);
    // Catch up if tab was backgrounded
    if (this._nextNoteTime < now - 0.2) this._nextNoteTime = now + 0.02;
    while (this._nextNoteTime < now + LOOKAHEAD) {
      const target = this._rwState ? 0.72 : (this._urgent ? 1.09 : 1);
      // Per-step smoothing: tempo glides over ~3-4 steps (tape catch-up after rewind is quick).
      this._tempoMul += (target - this._tempoMul) * (target > this._tempoMul ? 0.4 : 0.25);
      const sd = 30 / (this._bpm * this._tempoMul); // one 8th note
      if (this._grooveStep === 0) {
        this._motifVar = this._theme.evolve ? this._loopCount % this._tp.motif.length : 0;
      }
      this._scheduleStep(this._grooveStep, this._nextNoteTime, sd, now);
      this._nextNoteTime += sd;
      this._grooveStep = (this._grooveStep + 1) % 32;
      if (this._grooveStep === 0) this._loopCount++;
      if (this._pendingTheme && (this._grooveStep & 7) === 0) this._applyTheme(this._pendingTheme);
    }
  }

  // Map intensity -> stem gains, filter, summit, rewind bend. Runs every tick.
  _updateStems(now) {
    const I = this._int;
    const S = this._stems;
    const th = this._theme;
    const L = this._lay;
    const h = Math.max(I.height, th.minHeight || 0);
    // Hysteresis so a player hovering on a threshold doesn't flap layers.
    L.bass = L.bass ? h >= 0.17 : h >= 0.2;
    L.motif = L.motif ? h >= 0.42 : h >= 0.45;
    L.lead = L.lead ? h >= 0.72 : h >= 0.75;
    const tl = I.timeLeftFrac;
    this._urgent = tl > 0 && tl < (this._urgent ? 0.22 : 0.2);
    const exit = I.atExit;
    const tau = exit ? 0.35 : 0.9;
    this._setStem(S.drums, exit ? 0 : 1, now, tau);
    this._setStem(S.pad, exit ? 0 : 1, now, tau);
    this._setStem(S.bass, !exit && L.bass ? 1 : 0, now, tau);
    this._setStem(S.motif, !exit && L.motif ? 1 : 0, now, tau);
    this._setStem(S.lead, !exit && L.lead ? 0.9 : 0, now, tau);
    this._setStem(S.urgent, !exit && this._urgent ? 0.85 : 0, now, 0.3);

    if (exit && !this._summit) this._summitOn();
    else if (!exit && this._summit) this._summitOff();

    const rw = I.rewinding || this._rewindSfx;
    if (rw !== this._rwState) this._setRewindBend(rw);

    // Music bus filter: danger opens & adds resonance, rewind darkens, summit airy.
    const dg = I.danger;
    const fT = rw ? 1300 : exit ? 9000 : th.bright * (1 + dg * 1.6);
    const qT = rw ? 2.5 : 0.7 + dg * 3.5;
    if (Math.abs(fT - this._filtTarget) > this._filtTarget * 0.03 || Math.abs(qT - this._filtQ) > 0.1) {
      this._filtTarget = fT;
      this._filtQ = qT;
      this.musicIn.frequency.setTargetAtTime(fT, now, 0.25);
      this.musicIn.Q.setTargetAtTime(qT, now, 0.25);
    }
  }

  _setStem(s, target, now, tau) {
    if (s.target === target) return;
    s.target = target;
    if (target === 0) s.offAt = now;
    s.gain.gain.setTargetAtTime(target, now, tau);
  }

  // Stems keep scheduling notes while fading out, then stop to save CPU.
  _live(s, now) {
    return s.target > 0 || now - s.offAt < 2.5;
  }

  _setRewindBend(on) {
    this._rwState = on;
    if (!this.ctx || !this._detuneSrc) return;
    const t = this.ctx.currentTime;
    this._detuneSrc.offset.setTargetAtTime(on ? -550 : 0, t, on ? 0.25 : 0.12);
    this._wobbleGain.gain.setTargetAtTime(on ? 45 : 0, t, 0.15);
  }

  _scheduleStep(step, when, sd, now) {
    const th = this._theme;
    const tp = this._tp;
    const S = this._stems;
    const bar = step >> 3;
    const bs = step & 7;
    const t = (bs & 1) ? when + th.swing * sd : when;
    const danger = this._int.danger;
    const dr = th.drums;
    const kickHit = dr.kick[bs] === 'x';

    // --- Drums (always) ---
    if (this._live(S.drums, now)) {
      const D = S.drums.gain;
      if (kickHit) this._mKick(t, dr.kickGain || 0.11, D);
      const sn = bar === 3 && dr.fill ? dr.fill : dr.snare;
      if (sn[bs] === 'x') this._mSnare(t, dr.snareType, D);
      if (dr.hat[bs] === 'x') this._mHat(t, 0.012, false, D);
      else if (danger > 0.55) this._mHat(t, 0.007, false, D); // tension: hats fill in
    }

    // --- Pad (always) ---
    if (bs === 0 && this._live(S.pad, now)) {
      const p = th.pad;
      this._mPad(tp.pad[bar], t, sd * 8 + 0.3, p.gain, p.cut * (1 + danger * 0.7), p.wave, p.chorus, p.atk, S.pad.gain);
    }

    // --- Bass (height >= 0.2) ---
    if (this._live(S.bass, now)) {
      const c = th.bass.pat[bs];
      const B = tp.bass[bar];
      if (c !== '.') {
        const f = B[c] || B.r;
        const duck = kickHit ? 0.022 : 0; // pseudo-sidechain: let the kick through
        this._mBass(f, t + duck, sd * th.bass.len, th.bass.gain, S.bass.gain);
      } else if (danger > 0.5) {
        this._mBass(B.r, t, sd * 0.45, th.bass.gain * 0.5, S.bass.gain); // tension pulse
      }
    }

    // --- Motif (height >= 0.45) ---
    if (this._live(S.motif, now)) {
      const ev = tp.motif[this._motifVar][step];
      if (ev) this._mVoice(th.motifVoice, ev[0], t, ev[1] * sd * 0.92, th.motifGain, S.motif.gain);
    }

    // --- Lead: counter-melody + extra percussion (height >= 0.75) ---
    if (this._live(S.lead, now)) {
      const L = S.lead.gain;
      const ev = tp.counter[step];
      if (ev && !(th.evolve && (this._loopCount & 1))) {
        this._mVoice(th.counterVoice, ev[0], t, ev[1] * sd * 0.95, th.counterGain, L);
      }
      this._mPerc(th.perc, step, t, sd, L);
      if (step === 0) this._nv(t, 1.3, 0.016, 6500, 4200, 'highpass', 0.7, L, MO_CRASH);
      if (bs === 7) this._mHat(t, 0.01, true, L);
    }

    // --- Urgency: ticking 16th arpeggio (timeLeftFrac < 0.2) ---
    if (this._live(S.urgent, now)) {
      const U = S.urgent.gain;
      const pool = tp.arp[bar];
      const half = sd * 0.5;
      this._ov('square', pool[(step * 2) % pool.length], 0, when, 0.065, 0.011, U, MO_URG);
      this._ov('square', pool[(step * 2 + 1) % pool.length], 0, when + half, 0.065, 0.009, U, MO_URG);
      if (!(bs & 1)) this._fv(3400, 1.41, 900, when, 0.03, 0.01, U, MO);
    }
  }

  // ---- Music instruments --------------------------------------------------
  _mKick(t, g, D) {
    this._ov('sine', 150, 42, t, 0.17, g, D, MO_KICK);
    this._ov('triangle', 280, 90, t, 0.05, g * 0.3, D, MO_KICK2); // upper thump for phones
    this._nv(t, 0.012, g * 0.22, 3500, 3500, 'highpass', 0.7, D, MO);
  }

  _mSnare(t, type, D) {
    if (type === 'rim') {
      this._ov('triangle', 820, 760, t, 0.035, 0.028, D, MO);
      this._nv(t, 0.025, 0.014, 2600, 2600, 'bandpass', 4, D, MO);
    } else if (type === 'clap') {
      this._nv(t, 0.03, 0.022, 1500, 1200, 'bandpass', 1.6, D, MO);
      this._nv(t + 0.011, 0.03, 0.022, 1500, 1200, 'bandpass', 1.6, D, MO);
      this._nv(t + 0.022, 0.12, 0.024, 1500, 1000, 'bandpass', 1.4, D, MO);
    } else {
      this._ov('sine', 210, 130, t, 0.07, 0.034, D, MO_SN);
      this._nv(t, 0.11, 0.026, 2000, 1300, 'bandpass', 1.1, D, MO);
      this._nv(t, 0.04, 0.011, 6200, 6200, 'highpass', 0.7, D, MO);
    }
  }

  _mHat(t, g, open, D) {
    this._nv(t, open ? 0.2 : 0.03, g, 8000, 7000, 'highpass', 0.7, D, MO);
  }

  _mPad(freqs, t, dur, g, cutoff, wave, chorus, atk, dest) {
    const ctx = this.ctx;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.8;
    filt.frequency.setValueAtTime(cutoff * 0.6, t);
    filt.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.35);
    filt.frequency.linearRampToValueAtTime(cutoff * 0.55, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(g, t + Math.min(atk || 0.18, dur * 0.4));
    env.gain.linearRampToValueAtTime(g * 0.85, t + dur * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    filt.connect(env);
    env.connect(dest);
    const nodes = [filt, env];
    let lg = null;
    if (chorus) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.35;
      lg = ctx.createGain();
      lg.gain.value = 9;
      lfo.connect(lg);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      nodes.push(lfo, lg);
    }
    let last = null;
    for (let i = 0; i < freqs.length; i++) {
      for (let k = 0; k < 2; k++) {
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(freqs[i], t);
        osc.detune.value = k ? 6 : -6;
        this._bend(osc.detune, nodes);
        if (lg) lg.connect(osc.detune);
        osc.connect(filt);
        osc.start(t);
        osc.stop(t + dur + 0.05);
        nodes.push(osc);
        last = osc;
      }
    }
    if (last) last.onended = () => this._free(nodes);
  }

  _mBass(f, t, dur, g, dest) {
    const tp = this._tp;
    this._ov('triangle', f, 0, t, dur, g, dest, tp.bassO1);
    // Brighter layer gives the bass upper harmonics that survive phone speakers.
    this._ov(tp.bassWave, f, 0, t, dur, g * 0.45, dest, tp.bassO2);
  }

  _mVoice(voice, f, t, dur, g, dest) {
    switch (voice) {
      case 'glass':
        this._fv(f, 3.5, f * 0.15, t, dur + 0.6, g, dest, MO);
        this._ov('sine', f * 2, 0, t, dur + 0.3, g * 0.25, dest, MO);
        break;
      case 'pluck':
        this._ov('sawtooth', f, 0, t, Math.min(dur + 0.25, 0.75), g, dest,
          { music: true, lp: Math.min(f * 7, 8000), fe: f * 1.3, ft: 0.22, q: 3, atk: 0.003 });
        break;
      case 'square':
        this._ov('square', f, 0, t, dur + 0.08, g, dest, MO_SQUARE);
        break;
      case 'saw':
        this._ov('sawtooth', f, 0, t, dur + 0.12, g, dest, MO_SAW);
        this._ov('sawtooth', f, 0, t, dur + 0.12, g, dest, MO_SAW2);
        break;
      case 'brass':
        this._brass(f, t, dur + 0.1, g, dest, true);
        break;
      case 'flute':
        this._ov('triangle', f, 0, t, dur + 0.12, g, dest, MO_FLUTE);
        this._ov('sine', f * 2, 0, t, dur + 0.1, g * 0.18, dest, MO);
        this._nv(t, 0.07, g * 0.35, f * 2, f * 2, 'bandpass', 3, dest, MO);
        break;
      case 'bubble':
        this._ov('sine', f * 0.7, f, t, dur + 0.35, g, dest, MO_BUBBLE);
        this._fv(f * 2, 1.5, f * 0.4, t, 0.14, g * 0.3, dest, MO);
        break;
      case 'clock':
        this._fv(f, 3.5, f * 0.8, t, 0.18, g, dest, MO);
        this._nv(t, 0.012, g * 0.5, 5000, 5000, 'highpass', 0.7, dest, MO);
        break;
      case 'bell':
      default:
        this._fv(f, 2, f * 0.3, t, dur + 0.35, g, dest, MO);
        break;
    }
  }

  _mPerc(type, step, t, sd, L) {
    const bs = step & 7;
    switch (type) {
      case 'shaker':
        this._nv(t, 0.045, 0.009, 6500, 6500, 'bandpass', 1.2, L, MO_SHAKE);
        this._nv(t + sd * 0.5, 0.04, 0.005, 6500, 6500, 'bandpass', 1.2, L, MO_SHAKE);
        break;
      case 'toms':
        if (step >= 29) {
          const f = step === 29 ? 220 : step === 30 ? 175 : 135;
          this._ov('sine', f, f * 0.6, t, 0.22, 0.06, L, MO);
          this._ov('triangle', f * 2, f * 1.2, t, 0.08, 0.016, L, MO);
        } else if (bs === 2 || bs === 6) {
          this._nv(t, 0.08, 0.012, 1500, 1100, 'bandpass', 1.6, L, MO);
        }
        break;
      case 'tick':
        this._fv(2800, 1.41, 600, t, 0.025, 0.008, L, MO);
        this._fv(2800, 1.41, 600, t + sd * 0.5, 0.02, 0.005, L, MO);
        break;
      case 'woodblock':
        if (bs === 2 || bs === 5 || bs === 7) {
          const f = bs === 7 ? 1500 : 1180;
          this._ov('sine', f, f * 0.92, t, 0.05, 0.022, L, MO);
          this._nv(t, 0.015, 0.01, f * 1.5, f * 1.5, 'bandpass', 5, L, MO);
        }
        break;
      case 'ride':
        this._fv(560, 2.41, 1800, t, 0.35, 0.005, L, MO);
        this._nv(t, 0.18, 0.005, 7500, 7500, 'highpass', 0.7, L, MO);
        break;
      case 'bubbles':
        if (Math.random() < 0.35) {
          const f = rand(500, 1400);
          this._ov('sine', f, f * 2.2, t + Math.random() * sd, 0.08, 0.014, L, MO_BUBBLEPERC);
        }
        break;
      default:
        break;
    }
  }

  // ---- Summit: everything strips to one soaring sustained chord ---------
  _summitOn() {
    if (this._summit || !this.ctx || !this._stems) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const tp = this._tp;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(1, t + 1.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(450, t);
    lp.frequency.setTargetAtTime(3200, t, 1.0);
    lp.connect(out);
    out.connect(this._stems.summit.gain);
    const nodes = [lp, out];
    const oscs = [];
    const addOsc = (type, f, det, g, vibGain) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      this._bend(o.detune, nodes);
      if (vibGain) vibGain.connect(o.detune);
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og);
      og.connect(lp);
      o.start(t);
      nodes.push(o, og);
      oscs.push(o);
    };
    for (let i = 0; i < tp.summit.length; i++) {
      addOsc('triangle', tp.summit[i], -5, 0.022, null);
      addOsc('sawtooth', tp.summit[i], 5, 0.006, null);
    }
    // Soaring top note with delayed vibrato
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(0, t + 0.9);
    vg.gain.linearRampToValueAtTime(14, t + 2.2);
    vib.connect(vg);
    vib.start(t);
    nodes.push(vib, vg);
    oscs.push(vib);
    addOsc('sawtooth', tp.soar, 0, 0.02, vg);
    addOsc('sine', tp.soar, 3, 0.035, vg);
    addOsc('sine', tp.soar * 1.5, 0, 0.008, vg);
    this._summit = { out, oscs, nodes };
  }

  _summitOff() {
    const s = this._summit;
    if (!s) return;
    this._summit = null;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._hold(s.out.gain, t);
    s.out.gain.setTargetAtTime(0.0001, t, 0.35);
    for (let i = 0; i < s.oscs.length; i++) s.oscs[i].stop(t + 2.2);
    s.oscs[0].onended = () => this._free(s.nodes);
  }

  // =========================================================================
  // Voice primitives (one-shots; all nodes are freed in onended)
  // =========================================================================
  // Connect the tape-bend bus to a detune param; remember it for cleanup.
  _bend(param, nodes) {
    if (!this._detuneSrc) return;
    this._detuneSrc.connect(param);
    nodes.push(param);
  }

  _free(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      try {
        if (typeof AudioParam !== 'undefined' && n instanceof AudioParam) {
          if (this._detuneSrc) this._detuneSrc.disconnect(n);
        } else {
          n.disconnect();
        }
      } catch (e) { /* already disconnected */ }
    }
    nodes.length = 0;
  }

  _env(param, at, dur, g, atk, hold) {
    const a = Math.min(atk !== undefined ? atk : Math.min(0.012, dur * 0.2), dur * 0.9);
    param.setValueAtTime(0.0001, at);
    param.linearRampToValueAtTime(g, at + a);
    if (hold) param.setValueAtTime(g, Math.max(at + a, at + dur * hold));
    param.exponentialRampToValueAtTime(0.0004, at + dur);
  }

  _vibrato(param, at, dur, rate, cents, delay, decay, nodes) {
    const ctx = this.ctx;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lg = ctx.createGain();
    if (decay) {
      lg.gain.setValueAtTime(cents, at);
      lg.gain.exponentialRampToValueAtTime(1, at + dur);
    } else {
      lg.gain.setValueAtTime(0, at);
      lg.gain.setValueAtTime(0, at + delay);
      lg.gain.linearRampToValueAtTime(cents, at + delay + 0.15);
    }
    lfo.connect(lg);
    lg.connect(param);
    lfo.start(at);
    lfo.stop(at + dur + 0.05);
    nodes.push(lfo, lg);
  }

  // Shared post-chain: [filter] -> [AM] -> envelope -> [panner] -> dest
  _chain(head, at, dur, g, dest, o, nodes, ft, f0, f1, fq, fTime) {
    const ctx = this.ctx;
    let type = ft;
    let ff = f0;
    let fe = f1;
    let q = fq;
    let ftm = fTime;
    if (!type) {
      if (o.lp) { type = 'lowpass'; ff = o.lp; } else if (o.hp) { type = 'highpass'; ff = o.hp; } else if (o.bp) { type = 'bandpass'; ff = o.bp; }
      fe = o.fe;
      q = o.q;
      ftm = o.ft;
    }
    if (type) {
      const fl = ctx.createBiquadFilter();
      fl.type = type;
      fl.frequency.setValueAtTime(hz(ff), at);
      if (fe && fe !== ff) fl.frequency.exponentialRampToValueAtTime(hz(fe), at + (ftm || dur));
      fl.Q.value = q !== undefined ? q : (type === 'bandpass' ? 1 : 0.7);
      head.connect(fl);
      head = fl;
      nodes.push(fl);
    }
    if (o.am) {
      const depth = clamp01(o.am.depth);
      const am = ctx.createGain();
      am.gain.value = 1 - depth * 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = o.am.type || 'sine';
      lfo.frequency.value = o.am.rate;
      const lg = ctx.createGain();
      lg.gain.value = depth * 0.5;
      lfo.connect(lg);
      lg.connect(am.gain);
      head.connect(am);
      head = am;
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
      nodes.push(am, lfo, lg);
    }
    const env = ctx.createGain();
    this._env(env.gain, at, dur, g, o.atk, o.hold);
    head.connect(env);
    head = env;
    nodes.push(env);
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(clamp(o.pan, -1, 1), at);
      if (o.pan1 !== undefined) p.pan.linearRampToValueAtTime(clamp(o.pan1, -1, 1), at + dur);
      head.connect(p);
      head = p;
      nodes.push(p);
    }
    head.connect(dest);
  }

  /** Oscillator voice. f1 = glide target (0/undefined = none). */
  _ov(type, f0, f1, at, dur, g, dest, o = NO) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(hz(f0), at);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(hz(f1), at + (o.glide || dur));
    if (o.det) osc.detune.value = o.det;
    const nodes = [osc];
    if (o.music) this._bend(osc.detune, nodes);
    if (o.vib) this._vibrato(osc.detune, at, dur, o.vib, o.vibD || 12, o.vibDelay || 0, o.vibDecay, nodes);
    this._chain(osc, at, dur, g, dest, o, nodes);
    osc.start(at);
    osc.stop(at + dur + 0.05);
    osc.onended = () => this._free(nodes);
  }

  /** Filtered-noise voice. */
  _nv(at, dur, g, f0, f1, ftype, q, dest, o = NO) {
    const ctx = this.ctx;
    const buf = o.brown ? this._brownBuffer : this._noiseBuffer;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (o.rate) src.playbackRate.value = o.rate;
    const nodes = [src];
    if (o.music && src.detune) this._bend(src.detune, nodes);
    this._chain(src, at, dur, g, dest, o, nodes, ftype, f0, f1, q, o.ft);
    let off = 0;
    if (dur + 0.06 < buf.duration) off = Math.random() * (buf.duration - dur - 0.06);
    else src.loop = true;
    src.start(at, off);
    src.stop(at + dur + 0.04);
    src.onended = () => this._free(nodes);
  }

  /** 2-op FM voice. o.f1 glides both operators; o.type sets the carrier wave. */
  _fv(f, ratio, depth, at, dur, g, dest, o = NO) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    car.type = o.type || 'sine';
    car.frequency.setValueAtTime(hz(f), at);
    mod.frequency.setValueAtTime(hz(f * ratio), at);
    if (o.f1) {
      const gt = at + (o.glide || dur);
      car.frequency.exponentialRampToValueAtTime(hz(o.f1), gt);
      mod.frequency.exponentialRampToValueAtTime(hz(o.f1 * ratio), gt);
    }
    mg.gain.setValueAtTime(Math.max(0.5, depth), at);
    mg.gain.exponentialRampToValueAtTime(Math.max(0.5, o.depthEnd || 0.5), at + dur * (o.dd || 0.75));
    mod.connect(mg);
    mg.connect(car.frequency);
    const nodes = [car, mod, mg];
    if (o.music) {
      this._bend(car.detune, nodes);
      this._bend(mod.detune, nodes);
    }
    if (o.vib) this._vibrato(car.detune, at, dur, o.vib, o.vibD || 12, o.vibDelay || 0, o.vibDecay, nodes);
    this._chain(car, at, dur, g, dest, o, nodes);
    car.start(at);
    mod.start(at);
    car.stop(at + dur + 0.05);
    mod.stop(at + dur + 0.05);
    car.onended = () => this._free(nodes);
  }

  /** Brass-ish stab: detuned saws through an opening filter envelope. */
  _brass(f, at, dur, g, dest, music = false) {
    const ctx = this.ctx;
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = 1.4;
    fl.frequency.setValueAtTime(hz(f * 1.2), at);
    fl.frequency.exponentialRampToValueAtTime(hz(f * 6), at + Math.min(0.08, dur * 0.4));
    fl.frequency.exponentialRampToValueAtTime(hz(f * 2.5), at + dur);
    const env = ctx.createGain();
    this._env(env.gain, at, dur, g, 0.03, 0.6);
    fl.connect(env);
    env.connect(dest);
    const nodes = [fl, env];
    let last = null;
    for (let k = -1; k <= 1; k += 2) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(hz(f), at);
      o.detune.value = k * 7;
      if (music) this._bend(o.detune, nodes);
      o.connect(fl);
      o.start(at);
      o.stop(at + dur + 0.05);
      nodes.push(o);
      last = o;
    }
    last.onended = () => this._free(nodes);
  }

  /**
   * Formant "voice" (Pogo noises): saw through two parallel band-passes.
   * fA->fB->fC pitch contour; F1/F2 formant sweeps [start, end].
   */
  _vox(at, dur, g, fA, fB, fC, F1, F2, dest) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fA, at);
    osc.frequency.linearRampToValueAtTime(fB, at + dur * 0.35);
    osc.frequency.linearRampToValueAtTime(fC, at + dur);
    const nodes = [osc];
    this._vibrato(osc.detune, at, dur, 5.5, 18, dur * 0.25, false, nodes);
    const env = ctx.createGain();
    this._env(env.gain, at, dur, g, 0.04, 0.55);
    const mk = (F, q, lvl) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = q;
      bp.frequency.setValueAtTime(F[0], at);
      bp.frequency.linearRampToValueAtTime(F[1], at + dur);
      const bg = ctx.createGain();
      bg.gain.value = lvl;
      osc.connect(bp);
      bp.connect(bg);
      bg.connect(env);
      nodes.push(bp, bg);
    };
    mk(F1, 6, 1);
    mk(F2, 9, 0.6);
    env.connect(dest);
    nodes.push(env);
    osc.start(at);
    osc.stop(at + dur + 0.05);
    osc.onended = () => this._free(nodes);
  }

  // Panned + optionally muffled (behind-tower) send for positional one-shots.
  _spatial(pan, muffled, life) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = muffled ? 520 : 14000;
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = muffled ? 0.42 : 1;
    lp.connect(g);
    let p = null;
    if (ctx.createStereoPanner) {
      p = ctx.createStereoPanner();
      p.pan.value = pan * (muffled ? 0.6 : 1);
      g.connect(p);
      p.connect(this.sfxGain);
    } else {
      g.connect(this.sfxGain);
    }
    setTimeout(() => {
      lp.disconnect();
      g.disconnect();
      if (p) p.disconnect();
    }, (life + 0.4) * 1000);
    return lp;
  }

  // ---- Legacy helpers (kept for compatibility; route through new primitives)
  _vary(freq, pct = 0.035) {
    return freq * (1 + (Math.random() * 2 - 1) * pct);
  }

  _tone(freqStart, freqEnd, duration, type = 'sine', gainVal = 0.14, delayOrTime = 0, filterFreq = null, isMusic = false, sendReverb = true, isAbsTime = false) {
    if (!this._ok()) return;
    const at = isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime;
    this._ov(type, freqStart, freqEnd, at, duration, gainVal, isMusic ? this.musicIn : this.sfxGain,
      filterFreq ? { lp: filterFreq, q: 0.9, atk: Math.min(0.015, duration * 0.2) } : NO);
  }

  _fmTone(carrierFreq, modRatio, modDepth, duration, gainVal = 0.12, delayOrTime = 0, isMusic = false, isAbsTime = false) {
    if (!this._ok()) return;
    const at = isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime;
    this._fv(carrierFreq, modRatio, modDepth, at, duration, gainVal, isMusic ? this.musicIn : this.sfxGain, NO);
  }

  _noise(duration, gainVal = 0.08, freqStart = 1200, freqEnd = 400, filterType = 'bandpass', Q = 1.2, delayOrTime = 0, isMusic = false, isAbsTime = false) {
    if (!this._ok()) return;
    const at = isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime;
    this._nv(at, duration, gainVal, freqStart, freqEnd, filterType, Q, isMusic ? this.musicIn : this.sfxGain, NO);
  }

  _padChord(freqs, when, duration = 2.1, gainVal = 0.026, filterFreq = 680) {
    if (!this._ok() || !this.musicIn) return;
    this._mPad(freqs, when, duration, gainVal, filterFreq, 'triangle', false, 0.18, this.musicIn);
  }

  // =========================================================================
  // Persistent loops (wind / creak / rain / charge hum / rewind whirr)
  // =========================================================================
  /** Wind bed; louder and brighter with height. level 0..1 */
  setWind(level = 0) {
    const lv = clamp01(level);
    this._loopLevel.wind = lv;
    this._setLoop('wind', lv);
  }

  /** Low grinding creak while the tower rotates. speed 0..1 (0 = silent) */
  setTowerCreak(speed = 0) {
    const lv = clamp01(speed);
    this._loopLevel.creak = lv;
    this._setLoop('creak', lv);
  }

  /** Storm rain bed. level 0..1 */
  setRain(level = 0) {
    const lv = clamp01(level);
    this._loopLevel.rain = lv;
    this._setLoop('rain', lv);
  }

  /** Low-pass the whole mix (music + sfx + ambience) for the submarine. */
  setUnderwater(on) {
    const v = !!on;
    this._underwater = v;
    if (!this.ctx || !this.mixFilter || this._uwApplied === v) return;
    this._uwApplied = v;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = this.mixFilter;
    f.frequency.setTargetAtTime(v ? 720 : 20000, t, v ? 0.18 : 0.25);
    f.Q.setTargetAtTime(v ? 4 : 0.5, t, 0.2);
    if (v && !this._uwLfo) {
      // Slow sway of the cutoff: feels like moving water.
      this._uwLfo = ctx.createOscillator();
      this._uwLfo.frequency.value = 0.21;
      this._uwLfoGain = ctx.createGain();
      this._uwLfoGain.gain.value = 0;
      this._uwLfo.connect(this._uwLfoGain);
      this._uwLfoGain.connect(f.frequency);
      this._uwLfo.start();
    }
    if (this._uwLfoGain) this._uwLfoGain.gain.setTargetAtTime(v ? 140 : 0, t, 0.3);
  }

  /** Stop every ambience loop (wind, creak, rain, charge, rewind) and surface. */
  stopAmbience() {
    this._loopLevel.wind = 0;
    this._loopLevel.creak = 0;
    this._loopLevel.rain = 0;
    this._rewindSfx = false;
    if (this._rewindSafety) {
      clearTimeout(this._rewindSafety);
      this._rewindSafety = null;
    }
    this._killAllLoops();
    this.setUnderwater(false);
  }

  _setLoop(key, level) {
    if (!this._ok()) return;
    let L = this._loops[key];
    if (!L) {
      if (level < 0.002) return;
      L = this._loops[key] = this._buildLoop(key);
    }
    if (Math.abs(level - L.last) < 0.008 && !(level < 0.002 && L.last >= 0.002)) return;
    L.last = level;
    L.apply(level, this.ctx.currentTime);
    if (level < 0.002) {
      // Silent for a while -> tear down (re-created lazily on demand).
      if (!L.kill) L.kill = setTimeout(() => this._killLoop(key, 0.05), 2500);
    } else if (L.kill) {
      clearTimeout(L.kill);
      L.kill = null;
    }
  }

  _killLoop(key, tau = 0.12) {
    const L = this._loops[key];
    if (!L) return;
    this._loops[key] = null;
    if (L.kill) clearTimeout(L.kill);
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this._hold(L.out.gain, t);
      L.out.gain.setTargetAtTime(0, t, tau);
      const end = t + tau * 6 + 0.05;
      for (let i = 0; i < L.srcs.length; i++) {
        try { L.srcs[i].stop(end); } catch (e) { /* ignore */ }
      }
    }
    setTimeout(() => this._free(L.nodes), (tau * 6 + 0.35) * 1000);
  }

  _killAllLoops() {
    this._killLoop('wind');
    this._killLoop('creak');
    this._killLoop('rain');
    this._killLoop('charge', 0.04);
    this._killLoop('rewind', 0.04);
    if (this._chargeDog) {
      clearInterval(this._chargeDog);
      this._chargeDog = null;
    }
  }

  _restoreLoops() {
    for (let i = 0; i < AMBIENT_LOOPS.length; i++) {
      const k = AMBIENT_LOOPS[i];
      if (this._loopLevel[k] > 0.002) this._setLoop(k, this._loopLevel[k]);
    }
  }

  _dropsBuf() {
    if (this._dropsBuffer) return this._dropsBuffer;
    // 2s stereo bed of tiny decaying pings = rain drops (generated once).
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 2);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let n = 0; n < 260; n++) {
        const start = Math.floor(Math.random() * (len - 600));
        const f = rand(1400, 5200) / rate;
        const amp = rand(0.08, 0.45);
        const decay = rand(0.985, 0.994);
        let e = amp;
        for (let i = 0; i < 500; i++) {
          d[start + i] += Math.sin(i * f * Math.PI * 2) * e + (Math.random() - 0.5) * e * 0.3;
          e *= decay;
        }
      }
    }
    this._dropsBuffer = buf;
    return buf;
  }

  _buildLoop(key) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0;
    const L = { out, nodes: [out], srcs: [], last: -1, kill: null, apply: null };
    const add = (n) => { L.nodes.push(n); return n; };
    const src = (n) => { L.nodes.push(n); L.srcs.push(n); return n; };
    const noise = (buf, rate) => {
      const s = src(ctx.createBufferSource());
      s.buffer = buf;
      s.loop = true;
      if (rate) s.playbackRate.value = rate;
      return s;
    };
    const osc = (type, f) => {
      const o = src(ctx.createOscillator());
      o.type = type;
      o.frequency.value = f;
      return o;
    };
    const gain = (v) => {
      const g = add(ctx.createGain());
      g.gain.value = v;
      return g;
    };
    const filter = (type, f, q) => {
      const fl = add(ctx.createBiquadFilter());
      fl.type = type;
      fl.frequency.value = f;
      fl.Q.value = q;
      return fl;
    };
    const panner = () => (ctx.createStereoPanner ? add(ctx.createStereoPanner()) : gain(1));

    switch (key) {
      case 'wind': {
        const n = noise(this._noiseBuffer, 0.9);
        const hp = filter('highpass', 140, 0.5);
        const bp = filter('bandpass', 500, 0.9);
        const trem = gain(0.8);
        const pan = panner();
        n.connect(hp); hp.connect(bp); bp.connect(trem); trem.connect(pan); pan.connect(out);
        // Gusting: cutoff sweep + amplitude swell + slow stereo drift
        const l1 = osc('sine', 0.13); const l1g = gain(200); l1.connect(l1g); l1g.connect(bp.frequency);
        const l2 = osc('sine', 0.31); const l2g = gain(0.15); l2.connect(l2g); l2g.connect(trem.gain);
        if (pan.pan) { const l3 = osc('sine', 0.05); const l3g = gain(0.45); l3.connect(l3g); l3g.connect(pan.pan); }
        // High whistle that only appears near the top
        const wh = osc('sine', 1150);
        const whl = osc('sine', 0.4); const whlg = gain(60); whl.connect(whlg); whlg.connect(wh.frequency);
        const whg = gain(0); wh.connect(whg); whg.connect(pan);
        L.apply = (lv, now) => {
          out.gain.setTargetAtTime(0.15 * Math.pow(lv, 1.4), now, 0.35);
          bp.frequency.setTargetAtTime(380 + lv * 1700, now, 0.5);
          bp.Q.setTargetAtTime(0.9 + lv * 1.4, now, 0.5);
          l1g.gain.setTargetAtTime(120 + lv * 600, now, 0.5);
          l2g.gain.setTargetAtTime(0.1 + lv * 0.25, now, 0.5);
          whg.gain.setTargetAtTime(Math.max(0, lv - 0.55) * 0.05, now, 0.6);
        };
        break;
      }
      case 'creak': {
        // Stick-slip grinding: brown noise band + resonant saw, ratcheted by a saw LFO.
        const n = noise(this._brownBuffer, 1);
        const nb = filter('bandpass', 170, 4);
        const saw = osc('sawtooth', 60);
        const sb = filter('bandpass', 420, 7);
        const sg = gain(0.55);
        const am = gain(0.5);
        n.connect(nb); nb.connect(am);
        saw.connect(sb); sb.connect(sg); sg.connect(am);
        am.connect(out);
        const rat = osc('sawtooth', 6); const ratG = gain(0.5); rat.connect(ratG); ratG.connect(am.gain);
        const wob = osc('sine', 0.6); const wobG = gain(6); wob.connect(wobG); wobG.connect(saw.frequency);
        L.apply = (lv, now) => {
          out.gain.setTargetAtTime(0.2 * Math.pow(lv, 0.8), now, 0.15);
          rat.frequency.setTargetAtTime(4 + lv * 9, now, 0.2);
          saw.frequency.setTargetAtTime(52 + lv * 40, now, 0.2);
          sb.frequency.setTargetAtTime(330 + lv * 300, now, 0.2);
          nb.frequency.setTargetAtTime(150 + lv * 120, now, 0.2);
        };
        break;
      }
      case 'rain': {
        const hiss = noise(this._noiseBuffer, 1);
        const hp = filter('highpass', 1100, 0.5);
        const lp = filter('lowpass', 7000, 0.5);
        const hg = gain(0.5);
        hiss.connect(hp); hp.connect(lp); lp.connect(hg); hg.connect(out);
        const body = noise(this._brownBuffer, 1);
        const blp = filter('lowpass', 450, 0.5);
        const bg = gain(0.4);
        body.connect(blp); blp.connect(bg); bg.connect(out);
        const drops = noise(this._dropsBuf(), 1);
        const dhp = filter('highpass', 700, 0.5);
        const dg = gain(0.6);
        drops.connect(dhp); dhp.connect(dg); dg.connect(out);
        L.apply = (lv, now) => {
          out.gain.setTargetAtTime(0.16 * Math.pow(lv, 1.2), now, 0.5);
          hg.gain.setTargetAtTime(0.25 + lv * 0.4, now, 0.5);
          dg.gain.setTargetAtTime(0.7 - lv * 0.25, now, 0.5);
          lp.frequency.setTargetAtTime(4500 + lv * 3500, now, 0.5);
        };
        break;
      }
      case 'charge': {
        // Rising hum: saw + beating sine + sub, resonant low-pass, tremolo.
        const o1 = osc('sawtooth', 110);
        const o2 = osc('sine', 220.6);
        const o3 = osc('sine', 55);
        const lp = filter('lowpass', 400, 6);
        const trem = gain(0.8);
        const g2 = gain(0.6);
        const g3 = gain(0.7);
        o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(trem);
        lp.connect(trem); trem.connect(out);
        const lfo = osc('sine', 6); const lfoG = gain(0.2); lfo.connect(lfoG); lfoG.connect(trem.gain);
        L.apply = (lv, now) => {
          const f = 110 * Math.pow(2, lv * 2);
          o1.frequency.setTargetAtTime(f, now, 0.05);
          o2.frequency.setTargetAtTime(f * 2.006, now, 0.05);
          o3.frequency.setTargetAtTime(f * 0.5, now, 0.05);
          lp.frequency.setTargetAtTime(350 + lv * 3200, now, 0.05);
          lfo.frequency.setTargetAtTime(6 + lv * 16, now, 0.08);
          out.gain.setTargetAtTime(0.05 + lv * 0.05, now, 0.05);
        };
        out.connect(this.sfxGain);
        break;
      }
      case 'rewind': {
        // Tape-shuttle whirr: chattering band of noise + warbling squeal.
        const n = noise(this._noiseBuffer, 1);
        const bp = filter('bandpass', 2200, 3);
        const ch = gain(0.6);
        n.connect(bp); bp.connect(ch); ch.connect(out);
        const fl = osc('sine', 9); const flg = gain(900); fl.connect(flg); flg.connect(bp.frequency);
        const cl = osc('square', 23); const clg = gain(0.35); cl.connect(clg); clg.connect(ch.gain);
        const sq = osc('sine', 620); const sqg = gain(0.25);
        const sl = osc('sawtooth', 6); const slg = gain(220); sl.connect(slg); slg.connect(sq.frequency);
        sq.connect(sqg); sqg.connect(out);
        L.apply = (lv, now) => {
          out.gain.setTargetAtTime(0.045 * lv, now, 0.06);
        };
        out.connect(this.sfxGain);
        break;
      }
      default:
        break;
    }
    if (key !== 'charge' && key !== 'rewind') out.connect(this.ambGain);
    for (let i = 0; i < L.srcs.length; i++) L.srcs[i].start(t);
    return L;
  }

  // =========================================================================
  // Positional enemy cues & footsteps
  // =========================================================================
  /**
   * @param {'roller'|'bouncer'|'molecule'|'eye'|'boss'} type
   * @param {number} pan -1..1
   * @param {boolean} muffled enemy is behind the tower
   */
  enemyCue(type = 'roller', pan = 0, muffled = false) {
    if (!this._ok()) return;
    const k = CUE_TYPES.indexOf(type) >= 0 ? type : 'roller';
    const now = this.ctx.currentTime;
    if (now - this._cueLast[k] < 0.25) return;
    this._cueLast[k] = now;
    const t = now + 0.005;
    const p = clamp(finite(pan, 0), -1, 1);
    const life = { roller: 0.45, bouncer: 0.35, molecule: 0.32, eye: 0.65, boss: 0.55 }[k];
    const D = this._spatial(p, !!muffled, life);
    switch (k) {
      case 'roller': // rolling stone rumble
        this._nv(t, 0.4, 0.1, 280, 200, 'lowpass', 1, D, { brown: true, atk: 0.05, hold: 0.3, am: { rate: 13, depth: 0.85, type: 'triangle' } });
        this._ov('triangle', 76, 68, t, 0.4, 0.05, D, { atk: 0.04, hold: 0.3, am: { rate: 13, depth: 0.7 } });
        this._nv(t, 0.36, 0.03, 620, 520, 'bandpass', 2, D, { atk: 0.04, am: { rate: 13, depth: 0.9, type: 'triangle' } });
        break;
      case 'bouncer': // rubbery boing
        this._ov('sine', 160, 420, t, 0.3, 0.09, D, { glide: 0.06, atk: 0.004, vib: 16, vibD: 90, vibDecay: true });
        this._ov('triangle', 320, 840, t, 0.22, 0.028, D, { glide: 0.06, atk: 0.004, vib: 16, vibD: 90, vibDecay: true });
        this._ov('sine', 110, 60, t, 0.08, 0.06, D);
        break;
      case 'molecule': // buzzing fizz
        this._ov('sawtooth', 190, 215, t, 0.28, 0.04, D, { bp: 1400, fe: 2400, q: 5, atk: 0.02, am: { rate: 34, depth: 0.7 } });
        this._nv(t, 0.26, 0.04, 5000, 7000, 'highpass', 0.7, D, { atk: 0.02, am: { rate: 41, depth: 0.9 } });
        this._ov('square', 380, 400, t, 0.25, 0.012, D, { lp: 2000, atk: 0.02 });
        break;
      case 'eye': // eerie whoosh with beating sines
        this._nv(t, 0.6, 0.06, 500, 2200, 'bandpass', 5, D, { atk: 0.25, ft: 0.4 });
        this._ov('sine', 740, 700, t, 0.6, 0.025, D, { atk: 0.2, vib: 3, vibD: 40 });
        this._ov('sine', 747, 706, t, 0.6, 0.02, D, { atk: 0.25 });
        this._ov('triangle', 1110, 1050, t + 0.05, 0.5, 0.008, D, { atk: 0.2 });
        break;
      case 'boss': // deep growl
        this._fv(62, 0.5, 50, t, 0.5, 0.09, D, { type: 'sawtooth', lp: 600, atk: 0.05, hold: 0.3, am: { rate: 22, depth: 0.5 } });
        this._ov('square', 124, 110, t, 0.45, 0.025, D, { bp: 480, q: 3, atk: 0.05 });
        this._nv(t, 0.45, 0.04, 500, 350, 'bandpass', 3, D, { atk: 0.06, am: { rate: 27, depth: 0.6 } });
        break;
      default:
        break;
    }
  }

  /** @param {'stone'|'ice'|'metal'|'conveyor'|'crumble'|'wood'} surface */
  footstep(surface = 'stone') {
    if (!this._ok()) return;
    const now = this.ctx.currentTime;
    if (now - this._lastFootstep < 0.06) return;
    this._lastFootstep = now;
    const t = now + 0.003;
    const r = rand(0.88, 1.12);
    const g = rand(0.85, 1.1);
    const D = this.sfxGain;
    switch (surface) {
      case 'ice': // crisp squeak
        this._nv(t, 0.035, 0.03 * g, 6000 * r, 4200, 'bandpass', 1.5, D);
        this._ov('sine', 2600 * r, 3100 * r, t, 0.03, 0.008 * g, D);
        break;
      case 'metal': // small clank
        this._fv(520 * r, 3.73, 600, t, 0.08, 0.03 * g, D);
        this._nv(t, 0.02, 0.018 * g, 5000, 5000, 'highpass', 0.7, D);
        break;
      case 'conveyor': // rattle
        this._nv(t, 0.02, 0.025 * g, 1800 * r, 1400, 'bandpass', 2, D);
        this._nv(t + 0.03, 0.02, 0.018 * g, 2200 * r, 1600, 'bandpass', 2, D);
        this._ov('square', 90 * r, 80 * r, t, 0.05, 0.012 * g, D, { lp: 420 });
        break;
      case 'crumble': // gritty
        this._nv(t, 0.09, 0.04 * g, 900 * r, 300, 'lowpass', 0.8, D);
        for (let i = 0; i < 3; i++) {
          this._nv(t + 0.01 + Math.random() * 0.05, 0.012, 0.02 * g, rand(1500, 3500), 1200, 'bandpass', 3, D);
        }
        break;
      case 'wood': // hollow knock
        this._ov('sine', 260 * r, 190 * r, t, 0.06, 0.04 * g, D);
        this._nv(t, 0.03, 0.025 * g, 800 * r, 700, 'bandpass', 4, D);
        break;
      case 'stone':
      default: // soft thud + grit
        this._ov('sine', 150 * r, 70, t, 0.05, 0.045 * g, D);
        this._nv(t, 0.04, 0.03 * g, 1200 * r, 400, 'lowpass', 0.7, D);
        break;
    }
  }

  // =========================================================================
  // Original SFX (unchanged behaviour)
  // =========================================================================
  jump() {
    const f0 = this._vary(210, 0.04);
    const f1 = this._vary(490, 0.04);
    this._tone(f0, f1, 0.13, 'sine', 0.14, 0);
    this._tone(f0 * 1.5, f1 * 1.5, 0.1, 'triangle', 0.055, 0.01, 1400);
    this._noise(0.09, 0.045, 900, 2600, 'bandpass', 1.4);
  }

  land(intensity = 0.6) {
    const clamped = Math.min(1, Math.max(0.2, finite(intensity, 0.6)));
    this._tone(this._vary(115, 0.05), 42, 0.085, 'sine', 0.08 + clamped * 0.07, 0);
    this._noise(0.05, 0.03 * clamped, 420, 160, 'lowpass', 0.8);
  }

  stepUp() {
    const f = this._vary(392, 0.03);
    this._fmTone(f, 2, f * 0.35, 0.11, 0.085, 0);
  }

  snowball() {
    const f = this._vary(1220, 0.05);
    this._fmTone(f, 2.0, f * 0.42, 0.09, 0.085, 0);
    this._noise(0.07, 0.045, 2400, 850, 'bandpass', 1.4);
  }

  bubble() {
    const f = this._vary(340, 0.06);
    this._tone(f, f * 2.35, 0.13, 'sine', 0.11, 0);
    this._fmTone(f * 2, 1.5, f * 0.25, 0.09, 0.045, 0.02);
  }

  hitEnemy() {
    this._tone(this._vary(180, 0.05), 46, 0.16, 'sine', 0.16, 0);
    this._fmTone(this._vary(520, 0.05), 1.5, 160, 0.12, 0.085, 0);
    this._noise(0.08, 0.055, 1600, 480, 'bandpass', 1.2);
  }

  stunEnemy() {
    const f = this._vary(740, 0.04);
    this._fmTone(f, 2.0, f * 0.4, 0.14, 0.075, 0);
    this._fmTone(f * 1.498, 2.0, f * 0.3, 0.16, 0.055, 0.035);
  }

  // Incoming flying nasty: quick rising two-note warble
  flyerWarn() {
    const f = this._vary(880, 0.02);
    this._tone(f, f * 1.5, 0.09, 'square', 0.035, 0, 2400);
    this._tone(f * 1.2, f * 1.8, 0.09, 'square', 0.03, 0.11, 2400);
  }

  // Score tick for climbing to a new floor
  climb() {
    const f = this._vary(1046.5, 0.01);
    this._fmTone(f, 2.0, f * 0.15, 0.08, 0.035, 0);
  }

  catchFish() {
    this._tone(145, 52, 0.14, 'sine', 0.13, 0);
    const chord = [523.25, 659.25, 783.99, 987.77, 1174.66]; // Cmaj9
    chord.forEach((n, idx) => {
      this._fmTone(this._vary(n, 0.015), 2.0, n * 0.28, 0.28, 0.065, idx * 0.04);
    });
  }

  crumble() {
    this._tone(this._vary(96, 0.06), 36, 0.22, 'sine', 0.13, 0);
    this._noise(0.22, 0.1, 720, 180, 'lowpass', 1.1);
  }

  door() {
    const f = this._vary(293.66, 0.02);
    this._fmTone(f, 2.0, f * 0.25, 0.18, 0.08, 0);
    this._fmTone(f * 1.5, 2.0, f * 0.25, 0.2, 0.07, 0.06);
    this._tone(f * 2, f, 0.18, 'sine', 0.06, 0.1);
  }

  elevator() {
    const f = this._vary(165, 0.03);
    this._tone(f, f * 1.33, 0.11, 'sine', 0.075, 0);
    this._tone(f * 1.5, f * 2.0, 0.1, 'triangle', 0.035, 0.015, 900);
  }

  splash() {
    this._tone(150, 45, 0.22, 'sine', 0.14, 0);
    this._noise(0.42, 0.13, 1500, 320, 'bandpass', 1.3);
    this._tone(this._vary(480, 0.1), 760, 0.08, 'sine', 0.055, 0.06);
    this._tone(this._vary(620, 0.1), 940, 0.07, 'sine', 0.045, 0.14);
  }

  hurt() {
    this._tone(190, 44, 0.26, 'sine', 0.17, 0);
    this._tone(260, 110, 0.22, 'triangle', 0.1, 0.01, 680);
    this._noise(0.14, 0.065, 700, 200, 'lowpass', 1.0);
  }

  towerTopple() {
    this._tone(86, 32, 0.95, 'sine', 0.18, 0);
    this._noise(0.95, 0.13, 620, 160, 'lowpass', 1.0);
    const chords = [
      { notes: [349.23, 440, 523.25, 659.25], delay: 0.05, dur: 0.32 },
      { notes: [392.0, 493.88, 587.33, 659.25], delay: 0.24, dur: 0.32 },
      { notes: [523.25, 659.25, 783.99, 987.77, 1174.66], delay: 0.44, dur: 0.65 },
    ];
    chords.forEach((c) => {
      c.notes.forEach((n) => {
        this._tone(n, n, c.dur, 'triangle', 0.045, c.delay, 1800);
        this._fmTone(n, 2.0, n * 0.22, c.dur, 0.032, c.delay);
      });
    });
  }

  extraLife() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((n, idx) => {
      this._fmTone(n, 2.0, n * 0.3, 0.32, 0.075, idx * 0.065);
    });
  }

  // =========================================================================
  // New one-shot SFX
  // =========================================================================
  /** Rising "hurry up" whistle for low time. */
  lowTimeWhistle() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 880, 1760, t, 0.55, 0.07, D, { glide: 0.45, vib: 7, vibD: 25, vibDelay: 0.1, hold: 0.6, atk: 0.04 });
    this._ov('triangle', 1760, 3520, t + 0.03, 0.5, 0.012, D, { glide: 0.42, hold: 0.5, atk: 0.05, lp: 5000 });
    this._nv(t, 0.5, 0.02, 1800, 3600, 'bandpass', 6, D, { atk: 0.05, hold: 0.5 });
    this._ov('square', 1760, 0, t + 0.62, 0.07, 0.018, D, { lp: 3000 });
    this._ov('square', 2093, 0, t + 0.74, 0.1, 0.018, D, { lp: 3000 });
  }

  /** Heavy ground-pound slam. */
  groundPound() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 160, 30, t, 0.5, 0.24, D, { glide: 0.3, atk: 0.002 });
    this._ov('square', 90, 38, t, 0.25, 0.05, D, { glide: 0.2, lp: 420, atk: 0.002 });
    this._fv(70, 1.5, 40, t, 0.4, 0.06, D);
    this._nv(t, 0.4, 0.14, 1400, 120, 'lowpass', 1, this.sfxSpace, { ft: 0.3, atk: 0.002 });
    this._nv(t, 0.035, 0.08, 3000, 3000, 'bandpass', 0.8, D, { atk: 0.001 });
    for (let i = 0; i < 5; i++) {
      this._nv(t + 0.08 + Math.random() * 0.25, 0.03, rand(0.02, 0.04), rand(1200, 2700), 800, 'bandpass', 4, D);
    }
  }

  /** Charging hum; call repeatedly with level 0..1. Auto-stops if calls cease. */
  chargeLevel(level = 0) {
    if (!this._ok()) return;
    const lv = clamp01(level);
    this._chargeLast = Date.now();
    this._setLoop('charge', 0.02 + lv * 0.98);
    if (!this._chargeDog) {
      this._chargeDog = setInterval(() => {
        if (Date.now() - this._chargeLast > 400) this.chargeStop();
      }, 150);
    }
  }

  /** Stop the charge hum (no release sound). */
  chargeStop() {
    if (this._chargeDog) {
      clearInterval(this._chargeDog);
      this._chargeDog = null;
    }
    this._killLoop('charge', 0.04);
  }

  /** Release a charged move; power 0..1. */
  chargeRelease(power = 1) {
    this.chargeStop();
    if (!this._ok()) return;
    const p = clamp01(power);
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sawtooth', 220, 880 + 1400 * p, t, 0.22 + 0.15 * p, 0.05 + 0.04 * p, D, { glide: 0.15, lp: 1500, fe: 6000, ft: 0.15, atk: 0.004 });
    this._nv(t, 0.35 + 0.2 * p, 0.08 + 0.06 * p, 500, 3000 + 3000 * p, 'bandpass', 1.2, D, { ft: 0.25, atk: 0.01 });
    this._ov('sine', 120, 45, t, 0.25, 0.12 + 0.08 * p, D, { atk: 0.002 });
    if (p > 0.75) {
      const ch = [1046.5, 1318.5, 1568];
      for (let i = 0; i < 3; i++) this._fv(ch[i], 2, ch[i] * 0.3, t + 0.06 + i * 0.04, 0.4, 0.03, this.sfxSpace);
    }
  }

  /** Crystalline ice crackle. */
  freeze() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    for (let i = 0; i < 9; i++) {
      const f = rand(2200, 6400);
      this._fv(f, 3.47, f * 0.4, t + i * 0.03 + Math.random() * 0.02, rand(0.12, 0.27), rand(0.016, 0.028), D);
    }
    this._nv(t, 0.35, 0.03, 6000, 9000, 'highpass', 0.7, D, { am: { rate: 55, depth: 0.9, type: 'square' } });
    this._nv(t, 0.08, 0.05, 1200, 600, 'bandpass', 2, D, { atk: 0.002 });
    this._ov('sine', 2637, 1975, t + 0.05, 0.6, 0.02, this.sfxSpace);
    this._ov('triangle', 3520, 2637, t, 0.5, 0.01, D);
  }

  /** Melting / thaw. */
  thaw() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._nv(t, 0.6, 0.05, 2500, 500, 'lowpass', 1, D, { atk: 0.15 });
    this._ov('triangle', 1318.5, 659.25, t, 0.5, 0.022, D, { lp: 2500 });
    for (let i = 0; i < 4; i++) {
      const f = rand(900, 1400);
      this._ov('sine', f, f * 1.8, t + 0.12 + i * 0.13 + Math.random() * 0.05, 0.07, 0.04, D, { glide: 0.05, atk: 0.003 });
    }
  }

  /** Tape-rewind sweep; starts a whirr loop and bends the music until rewindStop(). */
  rewindStart() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._rewindSfx = true;
    this._ov('sawtooth', 1800, 160, t, 0.4, 0.04, D, { glide: 0.38, lp: 3000, fe: 600 });
    this._nv(t, 0.4, 0.05, 4000, 600, 'bandpass', 2.5, D);
    this._setLoop('rewind', 1);
    if (this._rewindSafety) clearTimeout(this._rewindSafety);
    this._rewindSafety = setTimeout(() => this.rewindStop(), 10000); // never stick on
  }

  /** End of rewind: whirr stops with a tape "catch". */
  rewindStop() {
    const wasActive = this._rewindSfx || !!this._loops.rewind;
    this._rewindSfx = false;
    if (this._rewindSafety) {
      clearTimeout(this._rewindSafety);
      this._rewindSafety = null;
    }
    this._killLoop('rewind', 0.04);
    if (!this._ok() || !wasActive) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 200, 720, t, 0.14, 0.05, D, { glide: 0.12 });
    this._nv(t, 0.03, 0.04, 2000, 2000, 'bandpass', 1, D, { atk: 0.001 });
    this._ov('triangle', 360, 540, t + 0.06, 0.1, 0.02, D);
  }

  /** Checkpoint reached. */
  checkpoint() {
    if (!this._ok()) return;
    const t = this._t();
    const notes = [523.25, 783.99, 1046.5, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      this._fv(notes[i], 2, notes[i] * 0.3, t + i * 0.07, 0.4, 0.05, this.sfxSpace);
    }
    this._ov('triangle', 1046.5, 0, t + 0.21, 0.6, 0.02, this.sfxGain, { vib: 6, vibD: 10, atk: 0.03 });
    this._nv(t + 0.2, 0.5, 0.015, 7000, 9000, 'highpass', 0.7, this.sfxGain, { atk: 0.1 });
  }

  /** Sparkly secret-discovered jingle. */
  secret() {
    if (!this._ok()) return;
    const t = this._t();
    const S = this.sfxSpace;
    const base = 659.25;
    const run = [0, 2, 4, 7, 9, 12, 14, 16];
    for (let i = 0; i < run.length; i++) {
      const f = base * Math.pow(2, run[i] / 12);
      this._fv(f, 3, f * 0.2, t + i * 0.055, 0.32, 0.032, S);
      this._ov('sine', f * 2, 0, t + i * 0.055, 0.15, 0.008, this.sfxGain);
    }
    const chord = [12, 16, 19, 23, 26];
    for (let i = 0; i < chord.length; i++) {
      const f = base * Math.pow(2, chord[i] / 12);
      this._fv(f, 2, f * 0.15, t + 0.48 + i * 0.012, 0.9, 0.018, S);
    }
    this._nv(t + 0.4, 0.9, 0.02, 7000, 10000, 'highpass', 0.7, S, { atk: 0.2 });
  }

  /** Pickup chime; i = combo index, pitch climbs a pentatonic ladder. */
  collect(i = 0) {
    if (!this._ok()) return;
    const idx = Math.max(0, Math.floor(finite(i, 0)));
    const penta = [0, 2, 4, 7, 9];
    const semis = Math.min(24, 12 * Math.floor(idx / 5) + penta[idx % 5]);
    const f = 783.99 * Math.pow(2, semis / 12);
    const t = this._t();
    this._fv(f, 2, f * 0.35, t, 0.26, 0.055, this.sfxGain);
    this._ov('sine', f * 2, 0, t + 0.03, 0.18, 0.016, this.sfxGain);
    this._nv(t, 0.06, 0.012, 8000, 8000, 'highpass', 0.7, this.sfxGain);
  }

  /** Medal award; tier 1 (bronze) .. 3 (gold). */
  medal(tier = 1) {
    if (!this._ok()) return;
    const tr = Math.round(clamp(finite(tier, 1), 1, 3));
    const t = this._t();
    const S = this.sfxSpace;
    const base = 523.25;
    const runs = [[0, 4, 7], [0, 4, 7, 12], [0, 4, 7, 12, 16, 19, 24]];
    const run = runs[tr - 1];
    const step = tr === 3 ? 0.06 : 0.08;
    for (let i = 0; i < run.length; i++) {
      const f = base * Math.pow(2, run[i] / 12);
      this._fv(f, 2, f * 0.3, t + i * step, 0.35, 0.05, S);
    }
    const end = t + run.length * step;
    if (tr >= 2) {
      const ch = [12, 16, 19];
      for (let i = 0; i < ch.length; i++) this._ov('triangle', base * Math.pow(2, ch[i] / 12), 0, end, 0.7, 0.02, S, { atk: 0.02, hold: 0.3 });
      this._nv(end, 0.6, 0.015, 7000, 9500, 'highpass', 0.7, S, { atk: 0.05 });
    }
    if (tr === 3) {
      const ch = [0, 4, 7, 12];
      for (let i = 0; i < ch.length; i++) this._brass(base * Math.pow(2, ch[i] / 12), end, 0.8, 0.018, S);
      this._ov('sine', 98, 60, end, 0.4, 0.12, this.sfxGain);
    }
  }

  /** Summit fanfare (~2s), in the key of the current theme. */
  celebrate() {
    if (!this._ok()) return;
    const t = this._t();
    const S = this.sfxSpace;
    let r = this._tp.root;
    while (r < 55) r += 12;
    while (r > 66) r -= 12;
    const chordI = [r, r + 4, r + 7, r + 12];
    const chordIV = [r + 5, r + 9, r + 12, r + 17];
    const chordV = [r + 7, r + 11, r + 14, r + 19];
    const hit = (ch, at, dur, g) => {
      for (let i = 0; i < ch.length; i++) this._brass(mtof(ch[i]), at, dur, g, S);
    };
    // Timpani pickups
    for (let i = 0; i < 3; i++) this._ov('sine', mtof(r - 12), mtof(r - 12) * 0.8, t + i * 0.16, 0.25, 0.08 + i * 0.03, this.sfxGain);
    hit(chordI, t, 0.12, 0.016);
    hit(chordI, t + 0.16, 0.12, 0.016);
    hit(chordI, t + 0.32, 0.14, 0.018);
    hit(chordIV, t + 0.5, 0.32, 0.018);
    hit(chordV, t + 0.88, 0.3, 0.018);
    // Cymbal swell into the final chord
    this._nv(t + 0.85, 0.42, 0.03, 4000, 9000, 'highpass', 0.7, S, { atk: 0.38 });
    const fin = t + 1.22;
    hit([...chordI, r + 16], fin, 0.95, 0.017);
    this._ov('sine', mtof(r - 12), mtof(r - 12) * 0.85, fin, 0.6, 0.16, this.sfxGain);
    this._nv(fin, 1.0, 0.04, 7000, 4500, 'highpass', 0.7, S, { atk: 0.004 });
    // Sparkle arpeggio on top
    const sp = [r + 24, r + 28, r + 31, r + 36];
    for (let i = 0; i < sp.length; i++) this._fv(mtof(sp[i]), 2, mtof(sp[i]) * 0.25, fin + 0.1 + i * 0.09, 0.5, 0.022, S);
  }

  /** Wind gust whoosh sweeping across the stereo field. */
  gust() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    const dir = Math.random() < 0.5 ? -1 : 1;
    this._nv(t, 0.7, 0.09, 300, 1700, 'bandpass', 1.6, D, { atk: 0.3, ft: 0.55, pan: -0.7 * dir, pan1: 0.2 * dir });
    this._nv(t + 0.4, 0.8, 0.08, 1700, 400, 'bandpass', 1.6, D, { atk: 0.15, pan: 0.2 * dir, pan1: 0.8 * dir });
    this._nv(t, 1.1, 0.06, 350, 250, 'lowpass', 0.7, D, { brown: true, atk: 0.4, pan: -0.4 * dir, pan1: 0.4 * dir });
  }

  /** Thunder: distant rumble that rolls in to a near crack and long boom. */
  thunder() {
    if (!this._ok()) return;
    const t = this._t();
    const S = this.sfxSpace;
    const D = this.sfxGain;
    this._nv(t, 2.8, 0.16, 180, 90, 'lowpass', 0.7, S, { brown: true, atk: 0.6, hold: 0.2 });
    this._nv(t + 0.5, 0.6, 0.05, 600, 2400, 'bandpass', 0.8, D, { atk: 0.4 });
    this._nv(t + 1.0, 0.25, 0.16, 3000, 800, 'lowpass', 0.7, S, { atk: 0.003 });
    this._nv(t + 1.0, 2.2, 0.2, 900, 120, 'lowpass', 0.8, S, { brown: true, ft: 1.6, atk: 0.01 });
    this._ov('sine', 60, 32, t + 1.0, 1.6, 0.14, D, { atk: 0.01 });
    this._ov('square', 80, 40, t + 1.0, 0.9, 0.02, D, { lp: 300 });
    for (let i = 0; i < 6; i++) {
      this._nv(t + 1.05 + Math.random() * 0.6, 0.04, rand(0.03, 0.06), rand(1500, 4000), 900, 'bandpass', 2, D);
    }
  }

  /** Piston mechanical clank. */
  piston() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._fv(180, 2.76, 420, t, 0.25, 0.08, D);
    this._fv(410, 3.1, 300, t, 0.15, 0.045, D);
    this._nv(t, 0.06, 0.07, 2500, 800, 'bandpass', 1.5, D, { atk: 0.001 });
    this._ov('sine', 110, 50, t, 0.18, 0.12, D, { atk: 0.002 });
    this._nv(t + 0.05, 0.3, 0.025, 4000, 6000, 'highpass', 0.7, D, { atk: 0.02 });
  }

  /** Piston about to fire: pneumatic hiss + valve whistle + clicks. */
  pistonWarn() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._nv(t, 0.55, 0.045, 3500, 5500, 'highpass', 0.7, D, { atk: 0.25, hold: 0.4 });
    this._ov('sine', 1900, 2300, t + 0.05, 0.45, 0.012, D, { atk: 0.2, vib: 18, vibD: 30 });
    this._ov('square', 1200, 0, t, 0.03, 0.02, D, { lp: 2500 });
    this._ov('square', 1200, 0, t + 0.12, 0.03, 0.02, D, { lp: 2500 });
  }

  /** Rising water: deep bubbling swell. */
  waterRise() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 60, 95, t, 1.6, 0.12, D, { atk: 0.5, hold: 0.4 });
    this._ov('triangle', 120, 190, t, 1.6, 0.03, D, { atk: 0.5, hold: 0.4, lp: 500 });
    this._nv(t, 1.6, 0.07, 300, 700, 'lowpass', 1.2, this.sfxSpace, { brown: true, atk: 0.6, hold: 0.3 });
    for (let i = 0; i < 12; i++) {
      const f = rand(180, 520);
      this._ov('sine', f, f * 2.4, t + Math.random() * 1.4, 0.07, rand(0.025, 0.05), D, { glide: 0.06, atk: 0.004, lp: 1800 });
    }
  }

  /** Long collapsing-masonry rumble. */
  collapseRumble() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._nv(t, 2.0, 0.16, 500, 110, 'lowpass', 0.8, this.sfxSpace, { brown: true, atk: 0.15, ft: 1.8 });
    this._ov('sine', 55, 30, t, 1.8, 0.13, D, { atk: 0.1 });
    this._ov('square', 70, 40, t, 1.2, 0.03, D, { lp: 300, atk: 0.1 });
    for (let i = 0; i < 10; i++) {
      const at = t + Math.random() * 1.6;
      this._nv(at, 0.05, rand(0.03, 0.06), rand(400, 1600), 300, 'bandpass', 3, D);
      this._ov('sine', rand(200, 400), 80, at, 0.08, 0.04, D, { atk: 0.002 });
    }
  }

  /** Boss roar: deep FM growl with throat noise. */
  bossRoar() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._fv(82, 0.5, 70, t, 1.3, 0.11, D, { type: 'sawtooth', f1: 55, lp: 900, fe: 400, atk: 0.15, hold: 0.45, am: { rate: 24, depth: 0.45 } });
    this._ov('square', 164, 110, t, 1.2, 0.035, D, { bp: 520, q: 3, atk: 0.12, hold: 0.4 });
    this._nv(t, 1.2, 0.07, 700, 380, 'bandpass', 2.5, this.sfxSpace, { atk: 0.15, hold: 0.4, am: { rate: 31, depth: 0.6 } });
    this._ov('sine', 55, 40, t, 1.3, 0.12, D, { atk: 0.2, hold: 0.4 });
  }

  /** Boss projectile. */
  bossShot() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('square', 1400, 180, t, 0.22, 0.045, D, { glide: 0.2, lp: 3500, fe: 800, atk: 0.002 });
    this._fv(700, 1.5, 900, t, 0.18, 0.04, D, { f1: 200 });
    this._nv(t, 0.12, 0.05, 3000, 900, 'bandpass', 1.5, D);
  }

  /** Boss takes damage. */
  bossHit() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 130, 40, t, 0.3, 0.2, D, { atk: 0.002 });
    this._fv(240, 2.76, 600, t, 0.45, 0.07, D);
    this._fv(610, 1.41, 500, t, 0.3, 0.04, D);
    this._nv(t, 0.15, 0.1, 2200, 500, 'bandpass', 1.2, D, { atk: 0.001 });
    this._ov('sawtooth', 110, 70, t + 0.04, 0.3, 0.04, D, { lp: 600 });
  }

  /** Boss defeated: chained explosions, falling wail, victory chord. */
  bossDefeat() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    const S = this.sfxSpace;
    for (let i = 0; i < 5; i++) {
      const at = t + i * 0.22 + Math.random() * 0.05;
      this._nv(at, 0.6, 0.14, 2200, 120, 'lowpass', 0.8, S, { brown: i % 2 === 0, atk: 0.003 });
      this._ov('sine', 110 - i * 10, 30, at, 0.5, 0.14, D, { atk: 0.002 });
    }
    this._ov('sawtooth', 440, 55, t, 1.3, 0.04, D, { glide: 1.2, lp: 1800, fe: 300, vib: 9, vibD: 40 });
    const v = t + 1.25;
    const ch = [523.25, 659.25, 783.99, 1046.5, 1174.66];
    for (let i = 0; i < ch.length; i++) {
      this._fv(ch[i], 2, ch[i] * 0.3, v + i * 0.05, 1.0, 0.035, S);
      this._brass(ch[i] / 2, v, 0.9, 0.012, S);
    }
    this._nv(v, 1.0, 0.03, 7000, 4500, 'highpass', 0.7, S, { atk: 0.004 });
  }

  /** Grabbing a ledge. */
  ledgeGrab() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._nv(t, 0.035, 0.05, 900, 500, 'lowpass', 1, D, { atk: 0.002 });
    this._ov('triangle', 420, 300, t, 0.06, 0.04, D);
    this._ov('sine', 160, 90, t, 0.05, 0.05, D, { atk: 0.002 });
  }

  /** Pulling up over a ledge. */
  mantle() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 220, 440, t, 0.18, 0.05, D, { glide: 0.16 });
    this._nv(t, 0.16, 0.03, 600, 2200, 'bandpass', 1.5, D);
    this._ov('triangle', 330, 660, t + 0.03, 0.14, 0.02, D, { lp: 2000 });
  }

  /** UI confirm tap. */
  uiTap() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 1320, 0, t, 0.05, 0.04, D, { atk: 0.002 });
    this._ov('triangle', 2640, 0, t, 0.03, 0.01, D, { atk: 0.002 });
    this._nv(t, 0.01, 0.02, 4000, 4000, 'highpass', 0.7, D, { atk: 0.001 });
  }

  /** UI back / cancel. */
  uiBack() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._ov('sine', 880, 0, t, 0.05, 0.035, D, { atk: 0.002 });
    this._ov('sine', 587.33, 0, t + 0.055, 0.08, 0.035, D, { atk: 0.002 });
  }

  /** Jellyfish electric zap. */
  jellyZap() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._fv(220, 7.3, 1800, t, 0.3, 0.05, D, { type: 'sawtooth', lp: 4000, am: { rate: 38, depth: 0.8, type: 'square' } });
    this._nv(t, 0.28, 0.06, 3500, 2000, 'bandpass', 1.2, D, { am: { rate: 47, depth: 0.9, type: 'square' } });
    this._ov('sine', 1200, 300, t, 0.12, 0.03, D);
  }

  /** Submarine breaks the surface. */
  subSurface() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._nv(t, 0.45, 0.1, 400, 3500, 'bandpass', 1, D, { ft: 0.2, atk: 0.05 });
    this._nv(t + 0.12, 0.35, 0.08, 2500, 700, 'bandpass', 1.2, D);
    for (let i = 0; i < 4; i++) {
      const f = rand(400, 800);
      this._ov('sine', f, f * 2.2, t + 0.05 + i * 0.06 + Math.random() * 0.04, 0.06, 0.04, D, { glide: 0.05, atk: 0.003 });
    }
    this._ov('sine', 523.25, 1046.5, t + 0.15, 0.3, 0.02, D);
    this._fv(1568, 2, 300, t + 0.25, 0.4, 0.02, this.sfxSpace);
  }

  /** Cute idle yawn for Pogo. */
  pogoYawn() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._vox(t, 0.9, 0.05, 300, 420, 260, [750, 450], [1200, 800], D);
    this._nv(t + 0.1, 0.7, 0.012, 1000, 700, 'bandpass', 1.5, D, { atk: 0.2 });
    this._ov('sine', 260, 220, t + 0.95, 0.12, 0.02, D);
  }

  /** Cute "yay!" for Pogo. */
  pogoCheer() {
    if (!this._ok()) return;
    const t = this._t();
    const D = this.sfxGain;
    this._vox(t, 0.16, 0.05, 520, 680, 720, [600, 800], [1800, 2200], D);
    this._vox(t + 0.18, 0.26, 0.055, 660, 950, 990, [650, 850], [1900, 2400], D);
    this._fv(1568, 2, 400, t + 0.2, 0.3, 0.02, this.sfxSpace);
    this._fv(2093, 2, 400, t + 0.26, 0.3, 0.016, this.sfxSpace);
  }
}

export const sound = new SoundEngine();
