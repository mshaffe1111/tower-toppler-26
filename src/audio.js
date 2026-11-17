// Dual-Era Studio-Grade Web Audio Synthesizer for Tower Toppler '26
// Leaf module (zero internal src/ imports) — implements ARCHITECTURE_CONTRACT.md §3.6,
// ORIGINAL_DESIGN.md §3.2 ('original' 2008 XBLA / C64 SID tribute), and
// REBOOT_2026_DESIGN.md ('reboot' 2026 moody next-gen storm-synth & ocean ambience).

const REBOOT_DEFAULT_THEMES = [
  'mist',
  'sinking',
  'foundry',
  'blizzard',
  'prism',
  'piston',
  'blackout',
  'apex',
];

const VALID_THEMES = new Set([
  'mist',
  'sinking',
  'foundry',
  'blizzard',
  'prism',
  'piston',
  'blackout',
  'apex',
  'classic',
]);

const VALID_MINIGAMES = new Set(['submarine', 'skimmer', 'glide', 'puzzle', 'vault']);

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class SoundEngine {
  constructor() {
    // Public contract state
    this.muted = false;
    this.musicEnabled = true;
    this.musicActive = false;
    this.era = 'reboot'; // 'reboot' | 'original'

    // Adaptive context state
    this.towerId = 1;
    this.theme = 'mist';
    this.zenMode = false;
    this.miniGameMode = null; // null | 'submarine' | 'skimmer' | 'glide' | 'puzzle' | 'vault'

    // Web Audio nodes & shared pre-allocated buffers (zero per-hit allocation)
    this.ctx = null;
    this.masterGain = null;
    this.highpass = null;
    this.mudFilter = null;
    this.deHarsher = null;
    this.limiter = null;

    this.reverb = null;
    this.reverbHPF = null;
    this.reverbLPF = null;

    this.sfxGain = null;
    this.sfxReverbGain = null;
    this.musicGain = null;
    this.musicReverbGain = null;

    this._whiteNoiseBuf = null;
    this._pinkNoiseBuf = null;
    this._silentBuf = null;

    // Continuous atmospheric ocean surf & storm wind bed ('reboot' mode) + Glide airspeed wind
    this._ambienceNodes = null;
    this._windLevel = 0;
    this._glideWindNodes = null;

    // Lookahead music scheduler state
    this._grooveTimer = null;
    this._grooveStep = 0;
    this._nextNoteTime = 0;
    this._unlockedOnce = false;

    // Micro-cooldown map to prevent sub-20ms phase-stacking spikes
    this._lastTriggerMap = new Map();

    this._bindAutoUnlock();
  }

  _bindAutoUnlock() {
    if (typeof window === 'undefined') return;

    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
    const onGesture = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        for (const ev of events) {
          window.removeEventListener(ev, onGesture, true);
        }
      }
    };

    for (const ev of events) {
      window.addEventListener(ev, onGesture, { capture: true, passive: true });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.visibilityState === 'visible' && this.musicActive && !this.muted) {
          if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
            this.ctx.resume().catch(() => {});
          }
          this._nextNoteTime = Math.max(this.ctx.currentTime + 0.03, this._nextNoteTime);
        }
      });
    }
  }

  _initGraph() {
    if (this.ctx || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    let ctx;
    try {
      ctx = new AudioCtx({ latencyHint: 'interactive' });
    } catch {
      try {
        ctx = new AudioCtx();
      } catch {
        return;
      }
    }
    this.ctx = ctx;
    ctx.onstatechange = () => {
      if (this.ctx && this.ctx.state === 'running') {
        this._syncPlayback();
      }
    };

    // 1. Master Studio Chain: Gain -> Sub-HPF -> Boxiness Trim -> Mobile De-Harsher -> Limiter -> Destination
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.92;

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 32;
    this.highpass.Q.value = 0.707;

    this.mudFilter = ctx.createBiquadFilter();
    this.mudFilter.type = 'peaking';
    this.mudFilter.frequency.value = 275;
    this.mudFilter.Q.value = 1.15;
    this.mudFilter.gain.value = -1.6;

    this.deHarsher = ctx.createBiquadFilter();
    this.deHarsher.type = 'highshelf';
    this.deHarsher.frequency.value = 3300;
    this.deHarsher.gain.value = -4.2;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 10;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.14;

    this.masterGain.connect(this.highpass);
    this.highpass.connect(this.mudFilter);
    this.mudFilter.connect(this.deHarsher);
    this.deHarsher.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // 2. Pre-allocate shared noise & unlock buffers ONCE (zero per-hit GC/allocation)
    this._silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
    this._whiteNoiseBuf = this._createSeamlessWhiteNoise(2.2);
    this._pinkNoiseBuf = this._createSeamlessPinkNoise(3.2);

    // 3. Stereo Algorithmic Space Convolver with Era-Shaped Pre/Post EQ
    this.reverbHPF = ctx.createBiquadFilter();
    this.reverbHPF.type = 'highpass';
    this.reverbHPF.frequency.value = this.era === 'original' ? 260 : 115;

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._createReverbImpulse(0.92, 3.1);

    this.reverbLPF = ctx.createBiquadFilter();
    this.reverbLPF.type = 'lowpass';
    this.reverbLPF.frequency.value = this.era === 'original' ? 3000 : 2150;

    this.reverbHPF.connect(this.reverb);
    this.reverb.connect(this.reverbLPF);
    this.reverbLPF.connect(this.masterGain);

    // 4. Separate Dry / Wet SFX & Music Buses
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 1.0;
    this.sfxGain.connect(this.masterGain);

    this.sfxReverbGain = ctx.createGain();
    this.sfxReverbGain.connect(this.reverbHPF);

    this.musicGain = ctx.createGain();
    this.musicGain.connect(this.masterGain);

    this.musicReverbGain = ctx.createGain();
    this.musicReverbGain.connect(this.reverbHPF);

    this._syncBusGains(true);
  }

  _createSeamlessWhiteNoise(seconds = 2.2) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const fade = Math.min(2048, Math.floor(len * 0.05));
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    // Crossfade loop seam to eliminate wrap clicks
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      const tailIdx = len - fade + i;
      data[tailIdx] = data[tailIdx] * (1 - a) + data[i] * a;
    }
    return buf;
  }

  _createSeamlessPinkNoise(seconds = 3.2) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const fade = Math.min(4096, Math.floor(len * 0.06));
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);

    // Paul Kellet 6-pole pink noise filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.125;
      b6 = white * 0.115926;
      data[i] = Math.max(-0.98, Math.min(0.98, pink));
    }
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      const tailIdx = len - fade + i;
      data[tailIdx] = data[tailIdx] * (1 - a) + data[i] * a;
    }
    return buf;
  }

  _createReverbImpulse(duration = 0.92, decay = 3.1) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const earlyTaps = [
      { sample: Math.floor(rate * 0.014), amp: 0.42 },
      { sample: Math.floor(rate * 0.027), amp: 0.31 },
      { sample: Math.floor(rate * 0.043), amp: 0.23 },
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.52 + white * 0.48;
        data[i] = lp * env * 0.82;
      }
      for (const tap of earlyTaps) {
        const idx = tap.sample + ch * Math.floor(rate * 0.003);
        if (idx < length) {
          data[idx] += (ch === 0 ? 1 : -1) * tap.amp;
        }
      }
    }
    return impulse;
  }

  _syncBusGains(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isOrig = this.era === 'original';

    const targetMaster = this.muted ? 0 : 0.92;
    const targetSfxWet = isOrig ? 0.05 : 0.18;
    const targetMusicDry = this.musicEnabled ? (isOrig ? 0.70 : 0.66) : 0;
    const targetMusicWet = this.musicEnabled ? (isOrig ? 0.07 : 0.24) : 0;
    const targetRevHPF = isOrig ? 260 : 115;
    const targetRevLPF = isOrig ? 3100 : 2150;

    if (immediate) {
      this.masterGain.gain.setValueAtTime(targetMaster, now);
      this.sfxReverbGain.gain.setValueAtTime(targetSfxWet, now);
      this.musicGain.gain.setValueAtTime(targetMusicDry, now);
      this.musicReverbGain.gain.setValueAtTime(targetMusicWet, now);
      this.reverbHPF.frequency.setValueAtTime(targetRevHPF, now);
      this.reverbLPF.frequency.setValueAtTime(targetRevLPF, now);
    } else {
      this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.025);
      this.sfxReverbGain.gain.setTargetAtTime(targetSfxWet, now, 0.04);
      this.musicGain.gain.setTargetAtTime(targetMusicDry, now, 0.045);
      this.musicReverbGain.gain.setTargetAtTime(targetMusicWet, now, 0.045);
      this.reverbHPF.frequency.setTargetAtTime(targetRevHPF, now, 0.05);
      this.reverbLPF.frequency.setTargetAtTime(targetRevLPF, now, 0.05);
    }

    this._syncAmbienceState();
  }

  // --- Public Control & Mode API ---

  unlock() {
    this._initGraph();
    if (!this.ctx) return;

    // iOS/WebKit silent hardware unlock pulse on first gesture
    if (!this._unlockedOnce && this._silentBuf) {
      try {
        const s = this.ctx.createBufferSource();
        s.buffer = this._silentBuf;
        s.connect(this.masterGain);
        s.start(0);
        this._unlockedOnce = true;
      } catch {
        // Ignore if context forbids before resume
      }
    }

    if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
      this.ctx
        .resume()
        .then(() => {
          this._syncPlayback();
        })
        .catch(() => {});
    }
    this._syncPlayback();
  }

  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    const changed = this.era !== next;
    this.era = next;
    if (changed && this.ctx) {
      // Align next scheduler tick cleanly when switching BPM (112 <-> 128)
      this._grooveStep = 0;
      this._nextNoteTime = this.ctx.currentTime + 0.035;
    }
    this._syncBusGains(false);
    this._syncPlayback();
  }

  setTowerTheme(towerId = 1, theme = undefined) {
    this.towerId = Math.max(1, Math.floor(Number(towerId) || 1));
    if (typeof theme === 'string' && VALID_THEMES.has(theme)) {
      this.theme = theme;
    } else {
      this.theme = REBOOT_DEFAULT_THEMES[(this.towerId - 1) % REBOOT_DEFAULT_THEMES.length];
    }
    this._updateAmbienceTuning();
  }

  setZenMode(zen = false) {
    const next = Boolean(zen);
    if (this.zenMode === next) return;
    this.zenMode = next;
    if (this.ctx) {
      this._nextNoteTime = Math.max(this.ctx.currentTime + 0.03, this._nextNoteTime);
    }
    this._updateAmbienceTuning();
  }

  setMiniGameMode(mode = null) {
    const next = typeof mode === 'string' && VALID_MINIGAMES.has(mode) ? mode : null;
    if (this.miniGameMode === next) return;
    if (this.miniGameMode === 'glide' && next !== 'glide') {
      this.setWind(0);
    }
    this.miniGameMode = next;
    if (this.ctx) {
      this._grooveStep = 0;
      this._nextNoteTime = this.ctx.currentTime + 0.035;
    }
    this._updateAmbienceTuning();
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this._stopGlideWind();
    this._syncBusGains(false);
    this._syncPlayback();
    return this.muted;
  }

  toggleMusic() {
    return this.setMusicEnabled(!this.musicEnabled);
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    this._syncBusGains(false);
    this._syncPlayback();
    return this.musicEnabled;
  }

  setMusicActive(active) {
    const next = Boolean(active);
    if (this.musicActive === next) return;
    this.musicActive = next;
    if (!this.musicActive) this._stopGlideWind();
    this._syncPlayback();
  }

  _syncPlayback() {
    const shouldPlayMusic = Boolean(this.ctx && this.musicActive && this.musicEnabled && !this.muted);
    if (shouldPlayMusic) {
      this._startGroove();
    } else {
      this._stopGroove();
    }
    this._syncAmbienceState();
  }

  // --- Reboot Mode Atmospheric Ocean Surf & Storm Wind Bed (Zero Main-Thread CPU) ---

  _syncAmbienceState() {
    const wantAmbience = Boolean(
      this.ctx &&
        this.ctx.state === 'running' &&
        this.musicActive &&
        !this.muted &&
        this.era === 'reboot'
    );

    if (wantAmbience) {
      if (!this._ambienceNodes) {
        this._startAmbience();
      } else {
        this._updateAmbienceTuning();
      }
    } else if (this._ambienceNodes) {
      this._stopAmbience();
    }
  }

  _getAmbienceProfile() {
    const baseLevel = this.musicEnabled ? 1.0 : 0.65;

    if (this.miniGameMode === 'submarine') {
      return {
        surfFreq: 185,
        surfLfoDepth: 55,
        surfGain: 0.042 * baseLevel,
        windFreq: 320,
        windQ: 2.2,
        windGain: 0.010 * baseLevel,
      };
    }
    if (this.miniGameMode === 'skimmer') {
      return {
        surfFreq: 520,
        surfLfoDepth: 160,
        surfGain: 0.036 * baseLevel,
        windFreq: 940,
        windQ: 1.6,
        windGain: 0.022 * baseLevel,
      };
    }
    if (this.miniGameMode === 'glide') {
      return {
        surfFreq: 250,
        surfLfoDepth: 85,
        surfGain: 0.024 * baseLevel,
        windFreq: 760,
        windQ: 1.75,
        windGain: 0.024 * baseLevel,
      };
    }
    if (this.miniGameMode === 'puzzle') {
      return {
        surfFreq: 135,
        surfLfoDepth: 25,
        surfGain: 0.014 * baseLevel,
        windFreq: 380,
        windQ: 3.0,
        windGain: 0.007 * baseLevel,
      };
    }
    if (this.miniGameMode === 'vault') {
      return {
        surfFreq: 160,
        surfLfoDepth: 30,
        surfGain: 0.015 * baseLevel,
        windFreq: 420,
        windQ: 3.2,
        windGain: 0.006 * baseLevel,
      };
    }
    if (this.zenMode) {
      return {
        surfFreq: 310,
        surfLfoDepth: 110,
        surfGain: 0.040 * baseLevel,
        windFreq: 620,
        windQ: 1.4,
        windGain: 0.014 * baseLevel,
      };
    }

    switch (this.theme) {
      case 'sinking':
        return { surfFreq: 470, surfLfoDepth: 185, surfGain: 0.048 * baseLevel, windFreq: 540, windQ: 2.0, windGain: 0.015 * baseLevel };
      case 'foundry':
        return { surfFreq: 240, surfLfoDepth: 70, surfGain: 0.034 * baseLevel, windFreq: 1280, windQ: 2.8, windGain: 0.014 * baseLevel };
      case 'blizzard':
        return { surfFreq: 290, surfLfoDepth: 95, surfGain: 0.028 * baseLevel, windFreq: 820, windQ: 4.0, windGain: 0.028 * baseLevel };
      case 'prism':
        return { surfFreq: 260, surfLfoDepth: 80, surfGain: 0.025 * baseLevel, windFreq: 980, windQ: 3.6, windGain: 0.012 * baseLevel };
      case 'piston':
        return { surfFreq: 410, surfLfoDepth: 145, surfGain: 0.038 * baseLevel, windFreq: 580, windQ: 2.2, windGain: 0.014 * baseLevel };
      case 'blackout':
        return { surfFreq: 350, surfLfoDepth: 130, surfGain: 0.042 * baseLevel, windFreq: 1120, windQ: 1.3, windGain: 0.024 * baseLevel };
      case 'apex':
        return { surfFreq: 450, surfLfoDepth: 175, surfGain: 0.045 * baseLevel, windFreq: 720, windQ: 2.8, windGain: 0.022 * baseLevel };
      case 'mist':
      default:
        return { surfFreq: 340, surfLfoDepth: 125, surfGain: 0.036 * baseLevel, windFreq: 520, windQ: 2.3, windGain: 0.014 * baseLevel };
    }
  }

  _startAmbience() {
    if (!this.ctx || !this._pinkNoiseBuf || !this._whiteNoiseBuf || this._ambienceNodes) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const prof = this._getAmbienceProfile();

    const bedOut = ctx.createGain();
    bedOut.gain.setValueAtTime(0.0001, now);
    bedOut.gain.setTargetAtTime(1.0, now, 0.25);
    bedOut.connect(this.masterGain);

    // Layer 1: Rolling dark ocean surf (pink noise -> modulated lowpass)
    const surfSrc = ctx.createBufferSource();
    surfSrc.buffer = this._pinkNoiseBuf;
    surfSrc.loop = true;

    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.setValueAtTime(prof.surfFreq, now);
    surfFilter.Q.value = 0.85;

    const surfGain = ctx.createGain();
    surfGain.gain.setValueAtTime(prof.surfGain, now);

    const surfLfo = ctx.createOscillator();
    surfLfo.type = 'sine';
    surfLfo.frequency.setValueAtTime(0.125, now); // ~8s rolling wave period

    const surfLfoDepth = ctx.createGain();
    surfLfoDepth.gain.setValueAtTime(prof.surfLfoDepth, now);

    surfLfo.connect(surfLfoDepth);
    surfLfoDepth.connect(surfFilter.frequency);
    surfSrc.connect(surfFilter);
    surfFilter.connect(surfGain);

    let surfPan = null;
    if (typeof ctx.createStereoPanner === 'function') {
      surfPan = ctx.createStereoPanner();
      surfPan.pan.setValueAtTime(-0.18, now);
      surfGain.connect(surfPan);
      surfPan.connect(bedOut);
    } else {
      surfGain.connect(bedOut);
    }

    // Layer 2: Storm wind / mist / rain air layer (white noise -> modulated bandpass)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this._whiteNoiseBuf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(prof.windFreq, now);
    windFilter.Q.setValueAtTime(prof.windQ, now);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(prof.windGain, now);

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.19, now);

    const windLfoDepth = ctx.createGain();
    windLfoDepth.gain.setValueAtTime(140, now);

    windLfo.connect(windLfoDepth);
    windLfoDepth.connect(windFilter.frequency);
    windSrc.connect(windFilter);
    windFilter.connect(windGain);

    let windPan = null;
    if (typeof ctx.createStereoPanner === 'function') {
      windPan = ctx.createStereoPanner();
      windPan.pan.setValueAtTime(0.22, now);
      windGain.connect(windPan);
      windPan.connect(bedOut);
    } else {
      windGain.connect(bedOut);
    }

    surfSrc.start(now, Math.random() * 1.5);
    windSrc.start(now, Math.random() * 1.0);
    surfLfo.start(now);
    windLfo.start(now);

    this._ambienceNodes = {
      bedOut,
      surfSrc,
      surfFilter,
      surfGain,
      surfLfo,
      surfLfoDepth,
      windSrc,
      windFilter,
      windGain,
      windLfo,
      windLfoDepth,
    };
  }

  _updateAmbienceTuning() {
    if (!this._ambienceNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const prof = this._getAmbienceProfile();
    const n = this._ambienceNodes;

    n.surfFilter.frequency.setTargetAtTime(prof.surfFreq, now, 0.35);
    n.surfLfoDepth.gain.setTargetAtTime(prof.surfLfoDepth, now, 0.35);
    n.surfGain.gain.setTargetAtTime(prof.surfGain, now, 0.35);

    n.windFilter.frequency.setTargetAtTime(prof.windFreq, now, 0.35);
    n.windFilter.Q.setTargetAtTime(prof.windQ, now, 0.35);
    n.windGain.gain.setTargetAtTime(prof.windGain, now, 0.35);
  }

  _stopAmbience() {
    const n = this._ambienceNodes;
    if (!n) return;
    this._ambienceNodes = null;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    try {
      n.bedOut.gain.cancelScheduledValues(now);
      n.bedOut.gain.setValueAtTime(Math.max(0.0001, n.bedOut.gain.value), now);
      n.bedOut.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      const stopAt = now + 0.1;
      n.surfSrc.stop(stopAt);
      n.windSrc.stop(stopAt);
      n.surfLfo.stop(stopAt);
      n.windLfo.stop(stopAt);
      n.surfSrc.onended = () => {
        try {
          n.bedOut.disconnect();
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore teardown errors
    }
  }

  // --- Low-Level Zero-Allocation Synth Primitives ---

  _canPlay(key, minGap = 0.022) {
    if (this.muted || !this.ctx || !this.sfxGain) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    const prev = this._lastTriggerMap.get(key) ?? -1;
    if (now - prev < minGap) return false;
    this._lastTriggerMap.set(key, now);
    return true;
  }

  _vary(freq, pct = 0.03) {
    return freq * (1 + (Math.random() * 2 - 1) * pct);
  }

  _connectToBus(node, isMusic = false, sendReverb = true, pan = 0) {
    const dryBus = isMusic ? this.musicGain : this.sfxGain;
    const wetBus = isMusic ? this.musicReverbGain : this.sfxReverbGain;
    let outNode = node;
    if (pan !== 0 && this.ctx && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(pan, -0.85, 0.85), this.ctx.currentTime);
      node.connect(panner);
      outNode = panner;
    }
    if (dryBus) outNode.connect(dryBus);
    if (sendReverb && wetBus) outNode.connect(wetBus);
    return outNode !== node ? outNode : null;
  }

  _tone(
    freqStart,
    freqEnd,
    duration,
    type = 'sine',
    gainVal = 0.12,
    delayOrTime = 0,
    filterFreq = null,
    isMusic = false,
    sendReverb = true,
    isAbsTime = false,
    filterEndFreq = null
  ) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const dur = Math.max(0.012, duration);
    const now = Math.max(this.ctx.currentTime, isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime);
    const f0 = clamp(freqStart, 22, 14000);
    const f1 = clamp(freqEnd, 22, 14000);
    const peak = clamp(gainVal, 0.0002, 0.6);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now);
    if (Math.abs(f1 - f0) > 0.05) {
      osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
    }

    const attack = Math.min(0.012, dur * 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    let filter = null;
    if (filterFreq) {
      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const cf0 = clamp(filterFreq, 60, 14000);
      filter.frequency.setValueAtTime(cf0, now);
      if (filterEndFreq) {
        filter.frequency.exponentialRampToValueAtTime(clamp(filterEndFreq, 60, 14000), now + dur);
      }
      filter.Q.value = 1.05;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    this._connectToBus(gain, isMusic, sendReverb);
    osc.onended = () => {
      osc.disconnect();
      if (filter) filter.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + dur + 0.025);
  }

  // Stepped multi-pitch oscillator (e.g. authentic C64 SID rapid 3-note triad arpeggio in 1 node!)
  _steppedTone(
    freqs,
    stepSec,
    totalDuration,
    type = 'square',
    gainVal = 0.03,
    delayOrTime = 0,
    filterFreq = 2400,
    isMusic = false,
    sendReverb = true,
    isAbsTime = false
  ) {
    if (this.muted || !this.ctx || !freqs || freqs.length === 0) return;
    const dur = Math.max(0.02, totalDuration);
    const now = Math.max(this.ctx.currentTime, isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime);
    const peak = clamp(gainVal, 0.0002, 0.45);

    const osc = this.ctx.createOscillator();
    osc.type = type;
    const step = Math.max(0.012, stepSec);
    const count = Math.max(1, Math.ceil(dur / step));
    for (let i = 0; i < count; i++) {
      const f = clamp(freqs[i % freqs.length], 24, 14000);
      osc.frequency.setValueAtTime(f, now + i * step);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp(filterFreq || 2600, 120, 14000), now);
    filter.Q.value = 0.9;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.006);
    gain.gain.setValueAtTime(peak * 0.88, now + dur * 0.72);
    gain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    this._connectToBus(gain, isMusic, sendReverb);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  _fmTone(
    carrierFreq,
    modRatio,
    modDepth,
    duration,
    gainVal = 0.1,
    delayOrTime = 0,
    isMusic = false,
    isAbsTime = false,
    sendReverb = true,
    carrierEndFreq = null
  ) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const dur = Math.max(0.015, duration);
    const now = Math.max(this.ctx.currentTime, isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime);
    const cf = clamp(carrierFreq, 24, 12000);
    const peak = clamp(gainVal, 0.0002, 0.5);

    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    carrier.type = 'sine';
    mod.type = 'sine';
    carrier.frequency.setValueAtTime(cf, now);
    mod.frequency.setValueAtTime(clamp(cf * modRatio, 24, 16000), now);
    if (carrierEndFreq && Math.abs(carrierEndFreq - cf) > 0.1) {
      const cfEnd = clamp(carrierEndFreq, 24, 12000);
      carrier.frequency.exponentialRampToValueAtTime(cfEnd, now + dur);
      mod.frequency.exponentialRampToValueAtTime(clamp(cfEnd * modRatio, 24, 16000), now + dur);
    }

    modGain.gain.setValueAtTime(Math.max(0.5, modDepth), now);
    modGain.gain.exponentialRampToValueAtTime(0.4, now + dur * 0.8);

    outGain.gain.setValueAtTime(0.0001, now);
    outGain.gain.linearRampToValueAtTime(peak, now + Math.min(0.008, dur * 0.2));
    outGain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    this._connectToBus(outGain, isMusic, sendReverb);

    carrier.onended = () => {
      mod.disconnect();
      modGain.disconnect();
      carrier.disconnect();
      outGain.disconnect();
    };

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + dur + 0.025);
    mod.stop(now + dur + 0.025);
  }

  _noise(
    duration,
    gainVal = 0.08,
    freqStart = 1200,
    freqEnd = 400,
    filterType = 'bandpass',
    Q = 1.2,
    delayOrTime = 0,
    isMusic = false,
    isAbsTime = false,
    usePink = false,
    sendReverb = true
  ) {
    const buf = usePink ? this._pinkNoiseBuf : this._whiteNoiseBuf;
    if (this.muted || !this.ctx || !this.sfxGain || !buf) return;

    const dur = Math.min(Math.max(0.012, duration), buf.duration - 0.04);
    const now = Math.max(this.ctx.currentTime, isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime);
    const peak = clamp(gainVal, 0.0002, 0.55);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    const f0 = clamp(freqStart, 35, 14000);
    const f1 = clamp(freqEnd, 35, 14000);
    filter.frequency.setValueAtTime(f0, now);
    if (Math.abs(f1 - f0) > 0.5) {
      filter.frequency.exponentialRampToValueAtTime(f1, now + dur);
    }
    filter.Q.value = clamp(Q, 0.2, 12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.01, dur * 0.22));
    gain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    src.connect(filter);
    filter.connect(gain);
    this._connectToBus(gain, isMusic, sendReverb);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    const maxOffset = Math.max(0, buf.duration - dur - 0.03);
    const offset = Math.random() * maxOffset;
    src.start(now, offset, dur + 0.02);
  }

  _padChord(freqs, when, duration = 2.1, gainVal = 0.024, filterFreq = 680, waveType = 'triangle') {
    if (this.muted || !this.ctx || !this.musicGain) return;
    const now = Math.max(this.ctx.currentTime, when);
    const hasPan = typeof this.ctx.createStereoPanner === 'function';

    const filterL = this.ctx.createBiquadFilter();
    filterL.type = 'lowpass';
    filterL.frequency.setValueAtTime(filterFreq * 0.6, now);
    filterL.frequency.linearRampToValueAtTime(filterFreq, now + duration * 0.38);
    filterL.frequency.linearRampToValueAtTime(filterFreq * 0.52, now + duration);
    filterL.Q.value = 0.85;

    const filterR = this.ctx.createBiquadFilter();
    filterR.type = 'lowpass';
    filterR.frequency.setValueAtTime(filterFreq * 0.62, now);
    filterR.frequency.linearRampToValueAtTime(filterFreq * 1.04, now + duration * 0.42);
    filterR.frequency.linearRampToValueAtTime(filterFreq * 0.54, now + duration);
    filterR.Q.value = 0.85;

    const envL = this.ctx.createGain();
    const envR = this.ctx.createGain();
    for (const env of [envL, envR]) {
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(gainVal, now + Math.min(0.24, duration * 0.25));
      env.gain.setValueAtTime(gainVal * 0.82, now + duration * 0.68);
      env.gain.exponentialRampToValueAtTime(0.0002, now + duration);
    }

    filterL.connect(envL);
    filterR.connect(envR);
    const panL = this._connectToBus(envL, true, true, hasPan ? -0.36 : 0);
    const panR = this._connectToBus(envR, true, true, hasPan ? 0.36 : 0);

    const oscs = [];
    for (const f of freqs) {
      const oscL = this.ctx.createOscillator();
      oscL.type = waveType;
      oscL.frequency.setValueAtTime(clamp(f * (1 - 0.0038), 30, 12000), now);
      oscL.connect(filterL);
      oscL.start(now);
      oscL.stop(now + duration + 0.04);
      oscs.push(oscL);

      const oscR = this.ctx.createOscillator();
      oscR.type = waveType;
      oscR.frequency.setValueAtTime(clamp(f * (1 + 0.0038), 30, 12000), now);
      oscR.connect(filterR);
      oscR.start(now);
      oscR.stop(now + duration + 0.04);
      oscs.push(oscR);
    }

    if (oscs.length > 0) {
      oscs[0].onended = () => {
        for (const o of oscs) o.disconnect();
        filterL.disconnect();
        filterR.disconnect();
        envL.disconnect();
        envR.disconnect();
        if (panL) panL.disconnect();
        if (panR) panR.disconnect();
      };
    }
  }

  // --- Zero-Jitter Lookahead Music Sequencer (16th-Note Precision Grid) ---

  _getCurrentStepDuration() {
    let bpm = 112;
    if (this.era === 'original') {
      if (this.miniGameMode === 'submarine') bpm = 132;
      else if (this.miniGameMode === 'skimmer') bpm = 138;
      else if (this.miniGameMode === 'glide') bpm = 134;
      else if (this.miniGameMode === 'puzzle') bpm = 104;
      else if (this.miniGameMode === 'vault') bpm = 120;
      else bpm = 128;
    } else {
      if (this.miniGameMode === 'submarine') bpm = 116;
      else if (this.miniGameMode === 'skimmer') bpm = 136;
      else if (this.miniGameMode === 'glide') bpm = 124;
      else if (this.miniGameMode === 'puzzle') bpm = 96;
      else if (this.miniGameMode === 'vault') bpm = 108;
      else if (this.zenMode) bpm = 92;
      else if (this.theme === 'sinking') bpm = 118;
      else if (this.theme === 'apex') bpm = 120;
      else if (this.theme === 'piston') bpm = 116;
      else if (this.theme === 'foundry' || this.theme === 'prism') bpm = 114;
      else if (this.theme === 'blackout') bpm = 108;
      else bpm = 112;
    }
    return 60 / bpm / 4; // 16th-note step duration in seconds
  }

  _startGroove() {
    if (this._grooveTimer || !this.ctx || this.muted || !this.musicEnabled || !this.musicActive) return;

    this._nextNoteTime = Math.max(this.ctx.currentTime + 0.035, this._nextNoteTime);

    const scheduler = () => {
      if (!this.musicActive || !this.musicEnabled || this.muted || !this.ctx) return;
      if (this.ctx.state !== 'running') return;

      // Guard against background-tab time jump so queued notes never burst
      if (this._nextNoteTime < this.ctx.currentTime - 0.18) {
        this._nextNoteTime = this.ctx.currentTime + 0.025;
      }

      const lookaheadWindow = 0.115;
      while (this._nextNoteTime < this.ctx.currentTime + lookaheadWindow) {
        const stepDur = this._getCurrentStepDuration();
        this._scheduleGrooveStep(this._grooveStep, this._nextNoteTime, stepDur);
        this._nextNoteTime += stepDur;
        this._grooveStep = (this._grooveStep + 1) % 64; // 4 bars of 16th notes
      }
    };

    scheduler();
    this._grooveTimer = setInterval(scheduler, 25);
  }

  _stopGroove() {
    if (this._grooveTimer) {
      clearInterval(this._grooveTimer);
      this._grooveTimer = null;
    }
  }

  _scheduleGrooveStep(step64, when, stepDur) {
    if (this.era === 'original') {
      if (this.miniGameMode === 'submarine') {
        this._scheduleOriginalSubmarineStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'skimmer') {
        this._scheduleOriginalSkimmerStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'glide') {
        this._scheduleOriginalGlideStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'puzzle') {
        this._scheduleOriginalPuzzleStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'vault') {
        this._scheduleOriginalVaultStep(step64, when, stepDur);
      } else {
        this._scheduleOriginalTowerStep(step64, when, stepDur);
      }
    } else {
      if (this.miniGameMode === 'submarine') {
        this._scheduleRebootSubmarineStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'skimmer') {
        this._scheduleRebootSkimmerStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'glide') {
        this._scheduleRebootGlideStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'puzzle') {
        this._scheduleRebootPuzzleStep(step64, when, stepDur);
      } else if (this.miniGameMode === 'vault') {
        this._scheduleRebootVaultStep(step64, when, stepDur);
      } else if (this.zenMode) {
        this._scheduleRebootZenStep(step64, when, stepDur);
      } else {
        this._scheduleRebootTowerStep(step64, when, stepDur);
      }
    }
  }

  // 1. ORIGINAL ERA (128 BPM XBLA Electro-Arcade + C64 SID Rapid 3-Note Arpeggios)
  _scheduleOriginalTowerStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16); // 0..3
    const s = step64 % 16; // 0..15
    const tIdx = ((this.towerId || 1) - 1) % 8;

    // Exact per-tower semitone shift from ORIGINAL_DESIGN.md §3.2.A
    const towerShifts = [0, 2, 3, 5, -2, 4, 7, 5];
    const semi = towerShifts[tIdx];

    // Heroic C minor progression: Cm -> Ab -> Fm -> G7
    const bassMidiRoots = [36, 44, 41, 43]; // C2, Ab2, F2, G2
    const arpTriads = [
      [60, 63, 67], // Cm (0, 3, 7)
      [56, 60, 63], // Ab (0, 4, 7)
      [53, 56, 60], // Fm (0, 3, 7)
      [55, 59, 62], // G  (0, 4, 7)
    ];

    // A. 2008 XBLA Electro-Arcade Drums
    if (s === 0 || s === 8 || (s === 14 && bar === 3)) {
      // Tight pitch-snapped electronic kick (150Hz -> 48Hz in 0.085s)
      this._tone(150, 48, 0.085, 'sine', 0.125, when, 320, true, false, true);
    }
    if (s === 4 || s === 12) {
      // Snappy crisp white-noise arcade snare (bandpass 2200Hz, 0.055s) + body pop
      this._tone(195, 108, 0.045, 'triangle', 0.045, when, 600, true, false, true);
      this._noise(0.055, 0.036, 2200, 1450, 'bandpass', 1.25, when, true, true, false, true);
    }
    if (s % 2 === 0) {
      // Crisp closed chiptune hi-hats (highpass 6500Hz, 0.022s)
      const hatGain = s % 4 === 2 ? 0.02 : 0.011;
      this._noise(0.022, hatGain, 6600, 6500, 'highpass', 0.8, when, true, true, false, false);
    }

    // B. Punchy Octave-Jumping PWM/Saw Bass (cutoff 950Hz -> 280Hz)
    const bassHit = s !== 1 && s !== 5 && s !== 9 && s !== 13;
    if (bassHit) {
      const isOctave = s % 4 === 2 || s === 15;
      const rootMidi = bassMidiRoots[bar] + semi + (isOctave ? 12 : 0);
      const bf = midiToHz(rootMidi);
      const duck = s === 0 || s === 8 ? when + 0.018 : when;
      this._tone(bf, bf, stepDur * 0.82, 'sawtooth', 0.058, duck, 950, true, false, true, 280);
      this._tone(bf * 0.5, bf * 0.5, stepDur * 0.78, 'square', 0.026, duck, 340, true, false, true);
    }

    // C. Signature C64 SID Rapid 3-Note Arpeggio Voice (~50Hz chiptune shimmer in 1 osc!)
    if (s % 2 === 0) {
      const triad = arpTriads[bar].map((m) => midiToHz(m + 12 + semi));
      const rotated = s % 4 === 2 ? [triad[1], triad[2], triad[0]] : triad;
      this._steppedTone(rotated, 0.021, stepDur * 1.82, 'square', 0.024, when, 2400, true, true, true);
    }

    // D. Heroic Retro-HD Lead Motif
    const leadPattern = [
      72, null, null, 75, 74, null, 72, null, 67, null, 70, null, 72, null, null, null,
      68, null, null, 72, 75, null, 72, null, 70, null, 68, null, 67, null, null, null,
      65, null, 68, null, 72, null, 75, null, 74, null, 72, null, 70, null, 68, null,
      67, null, 71, null, 74, null, 79, null, 77, null, 74, null, 71, null, 74, null,
    ];
    const leadMidi = leadPattern[step64];
    if (leadMidi !== null) {
      const lf = midiToHz(leadMidi + semi);
      this._tone(lf, lf, stepDur * 1.65, 'sawtooth', 0.032, when, 2300, true, true, true, 1200);
    }
  }

  // 2. ORIGINAL ERA SUBMARINE (132 BPM Bouncy Major-Key Calypso-Synth Marimba + Bubbly FM Bass)
  _scheduleOriginalSubmarineStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Joyful F major -> C major -> Gm7 -> C7 progression
    const bassRoots = [41, 48, 43, 48]; // F2, C3, G2, C3
    const marimbaPools = [
      [65, 69, 72, 77], // F major
      [60, 64, 67, 72], // C major
      [62, 65, 67, 70], // Gm7
      [60, 64, 67, 70], // C7
    ];

    // Bouncy island-arcade kick & rim
    if (s === 0 || s === 6 || s === 8 || s === 14) {
      this._tone(140, 52, 0.075, 'sine', 0.1, when, 300, true, false, true);
    }
    if (s === 4 || s === 12) {
      this._noise(0.04, 0.025, 2600, 1600, 'bandpass', 1.4, when, true, true, false, true);
    }
    if (s % 2 === 1) {
      this._noise(0.018, 0.012, 6800, 6200, 'highpass', 0.8, when, true, true, false, false);
    }

    // Bubbly FM bass
    if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
      const root = bassRoots[bar] + (s === 6 || s === 14 ? 7 : 0);
      const bf = midiToHz(root);
      this._fmTone(bf, 2.0, bf * 0.85, stepDur * 1.1, 0.068, when, true, true, false);
    }

    // Calypso-synth marimba melody (syncopated Tresillo / Caribbean bounce)
    const calypsoHits = [0, 3, 6, 8, 10, 12, 15];
    if (calypsoHits.includes(s)) {
      const pool = marimbaPools[bar];
      const mf = midiToHz(pool[(s + bar) % pool.length]);
      this._fmTone(mf, 4.0, mf * 0.55, stepDur * 1.15, 0.042, when, true, true, true);
    }
  }

  _scheduleOriginalSkimmerStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    const roots = [40, 48, 45, 47]; // E2, C3, A2, B2
    const triads = [
      [64, 67, 71],
      [60, 64, 67],
      [69, 72, 76],
      [66, 71, 75],
    ];

    if (s % 4 === 0) this._tone(155, 48, 0.08, 'sine', 0.12, when, 320, true, false, true);
    if (s === 4 || s === 12) this._noise(0.05, 0.034, 2400, 1500, 'bandpass', 1.2, when, true, true);
    if (s % 2 === 1) this._noise(0.02, 0.015, 6800, 6400, 'highpass', 0.8, when, true, true, false, false);

    // 16th-note turbo bass
    const bf = midiToHz(roots[bar] + (s % 2 === 1 ? 12 : 0));
    this._tone(bf, bf, stepDur * 0.78, 'sawtooth', 0.055, when, 1050, true, false, true, 320);

    if (s % 2 === 0) {
      const triad = triads[bar].map((m) => midiToHz(m + 12));
      this._steppedTone(triad, 0.02, stepDur * 1.75, 'square', 0.024, when, 2600, true, true, true);
    }
  }

  _scheduleOriginalVaultStep(step64, when, stepDur) {
    const s = step64 % 16;
    const bar = Math.floor(step64 / 16);
    const notes = [62, 65, 69, 70]; // D minor tension
    if (s % 2 === 0) {
      const f = midiToHz(notes[(s / 2 + bar) % notes.length]);
      this._tone(f, f, stepDur * 0.65, 'square', 0.024, when, 1800, true, false, true);
    }
    if (s === 0 || s === 8) {
      this._tone(midiToHz(38), midiToHz(38), stepDur * 2.2, 'triangle', 0.055, when, 320, true, false, true);
    }
  }

  // 3. REBOOT ERA TOWER GROOVE (2026 Moody Storm-Synth Adapting to Theme!)
  _scheduleRebootTowerStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    const tIdx = ((this.towerId || 1) - 1) % 8;
    const towerShifts = [0, -2, 2, 3, 5, -4, 1, 7];
    const semi = towerShifts[tIdx];
    const th = this.theme;

    // Moody Operation Nebulus chord voicings: Am9 -> Fmaj7#11 -> Dm9 -> Em7/E7sus
    const padChordsMidi = [
      [57, 60, 64, 67, 71], // Am9
      [53, 57, 60, 64, 66], // Fmaj7#11
      [50, 53, 57, 60, 64], // Dm9
      [52, 55, 59, 62, 66], // Em9
    ];
    const bassRoots = [45, 41, 38, 40]; // A2, F2, D2, E2
    const arpPools = [
      [69, 72, 76, 79, 83],
      [65, 69, 72, 76, 78],
      [62, 65, 69, 72, 76],
      [64, 67, 71, 74, 78],
    ];

    // 1. Lush Cinematic Pad Swell at start of each bar
    if (s === 0) {
      const chordHz = padChordsMidi[bar].map((m) => midiToHz(m + semi));
      const padCutoff =
        th === 'blizzard' || th === 'prism'
          ? 920
          : th === 'blackout'
          ? 520
          : 690 + (tIdx % 3) * 55;
      const padWave = th === 'apex' || th === 'sinking' ? 'sawtooth' : 'triangle';
      const padGain = padWave === 'sawtooth' ? 0.016 : 0.025;
      this._padChord(chordHz, when, stepDur * 15.6, padGain, padCutoff, padWave);
    }

    // 2. Theme-Adaptive Drums & Percussion
    const isUrgent = th === 'sinking' || th === 'apex';
    const kickSteps = isUrgent ? [0, 6, 8, 14] : th === 'blackout' ? [0, 10] : [0, 8];
    if (kickSteps.includes(s)) {
      this._tone(118, 42, 0.12, 'sine', 0.115, when, 240, true, false, true);
    }

    if (s === 4 || s === 12) {
      if (th === 'foundry' || th === 'piston') {
        // Metallic industrial clang snare / anvil rim
        this._fmTone(290, 2.76, 320, 0.09, 0.038, when, true, true, true);
        this._noise(0.06, 0.026, 2100, 950, 'bandpass', 1.5, when, true, true, true, true);
      } else {
        // Warm damp-stone electronic rim/snare
        this._tone(185, 112, 0.055, 'sine', 0.036, when, 520, true, false, true);
        this._noise(0.05, 0.022, 1850, 1100, 'bandpass', 1.25, when, true, true, false, true);
      }
    }

    // Off-beat hats / pneumatic ticks / industrial clanks
    if (th === 'foundry' && (s === 2 || s === 7 || s === 11 || s === 15)) {
      this._fmTone(540, 3.41, 280, 0.045, 0.018, when, true, true, true);
    } else if (th === 'piston' && (s === 2 || s === 6 || s === 10 || s === 14)) {
      // Hydraulic air-release hat
      this._noise(0.055, 0.018, 3800, 1900, 'bandpass', 1.6, when, true, true, false, true);
    } else if (s % 2 === 1 && th !== 'blackout') {
      this._noise(0.024, 0.011, 5200, 3900, 'bandpass', 0.85, when, true, true, false, false);
    }

    // 3. Theme-Adaptive Moody Dark-Synth Bass
    const bassFreq = midiToHz(bassRoots[bar] + semi);
    if (isUrgent) {
      // Tense pulsing 16th-note flood/apex bassline
      if (s % 2 === 0 || s === 7 || s === 15) {
        const mult = s === 6 || s === 14 ? 2.0 : 1.0;
        const duck = kickSteps.includes(s) ? when + 0.022 : when;
        this._tone(bassFreq * mult, bassFreq * mult, stepDur * 0.85, 'sawtooth', 0.052, duck, 580, true, false, true, 220);
      }
    } else if (th === 'blackout') {
      // Deep brooding storm sub-drone + sparse pulse
      if (s === 0 || s === 10) {
        this._tone(bassFreq, bassFreq, stepDur * 4.5, 'triangle', 0.072, when + 0.02, 290, true, false, true);
      }
    } else {
      // Classic nocturnal 8th-note synthwave groove
      if (s === 0 || s === 4 || s === 6 || s === 8 || s === 12 || s === 14) {
        const mult = s === 14 ? 1.5 : 1.0;
        const duck = s === 0 || s === 8 ? when + 0.024 : when;
        this._tone(bassFreq * mult, bassFreq * mult, stepDur * 1.6, 'triangle', 0.068, duck, 380, true, false, true);
      }
    }

    // 4. Theme-Specific Melodic / Harmonic Color Layer
    const pool = arpPools[bar];
    if (th === 'blizzard' || th === 'prism') {
      // Crystalline shimmer (interlocking glass-bell FM arpeggios)
      if (s % 3 === 0 || s === 14) {
        const noteHz = midiToHz(pool[(s + bar) % pool.length] + semi);
        const ratio = th === 'prism' ? 3.0 : 4.0;
        this._fmTone(noteHz, ratio, noteHz * 0.24, stepDur * 2.4, 0.022, when, true, true, true);
      }
    } else if (th === 'sinking') {
      // Tense submarine/flood warning sonar pulse on beat 2.5 & 4.5
      if (s === 6 || s === 14) {
        const pingHz = midiToHz(pool[0] + 12 + semi);
        this._tone(pingHz, pingHz * 0.995, stepDur * 1.8, 'sine', 0.024, when, 2400, true, true, true);
      }
    } else {
      // Bioluminescent firefly FM bell motif
      if (s === 2 || s === 10 || (s === 6 && bar % 2 === 1)) {
        const noteHz = midiToHz(pool[(step64 + bar + tIdx) % pool.length] + semi);
        this._fmTone(noteHz, 2.0, noteHz * 0.2, stepDur * 2.6, 0.021, when, true, true, true);
      }
    }
  }

  // 4. REBOOT ZEN MODE (92 BPM Soothing Meditative Storm-Pad Sanctuary)
  _scheduleRebootZenStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    const zenChords = [
      [57, 60, 64, 67, 71], // Am9
      [53, 57, 60, 64, 69], // Fmaj13
      [48, 55, 60, 64, 67], // Cmaj7
      [55, 59, 62, 67, 69], // G6/9
    ];
    const pentatonic = [69, 72, 74, 76, 79, 81, 84];

    if (s === 0) {
      const hz = zenChords[bar].map((m) => midiToHz(m));
      this._padChord(hz, when, stepDur * 16.2, 0.028, 620, 'triangle');
      // Warm gentle sub-root breath
      const rootHz = midiToHz(zenChords[bar][0] - 12);
      this._tone(rootHz, rootHz, stepDur * 8.0, 'sine', 0.048, when, 240, true, true, true);
    }

    // Sparse warm celesta / Rhodes droplets
    if (s === 4 || s === 11 || (s === 14 && bar % 2 === 0)) {
      const note = midiToHz(pentatonic[(step64 + bar * 2) % pentatonic.length]);
      this._fmTone(note, 2.0, note * 0.12, stepDur * 3.8, 0.019, when, true, true, true);
    }
  }

  // 5. REBOOT MINI-GAMES ('submarine' | 'skimmer' | 'vault')
  _scheduleRebootSubmarineStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Deep bioluminescent Dorian trench: Dm9 -> Bbmaj7 -> Gm9 -> Asus4
    const chords = [
      [50, 53, 57, 60, 64],
      [46, 50, 53, 57, 62],
      [43, 46, 50, 53, 57],
      [45, 50, 52, 57, 64],
    ];
    const roots = [38, 34, 31, 33];
    const arp = [62, 65, 69, 72, 74, 76];

    if (s === 0) {
      this._padChord(chords[bar].map(midiToHz), when, stepDur * 15.8, 0.024, 560, 'triangle');
    }
    if (s === 0 || s === 10) {
      this._tone(96, 38, 0.14, 'sine', 0.1, when, 200, true, false, true);
    }
    if (s === 0 || s === 6 || s === 8 || s === 12) {
      const bf = midiToHz(roots[bar] + 12);
      this._tone(bf, bf, stepDur * 1.7, 'sine', 0.068, when + 0.015, 300, true, false, true);
    }
    // Echoing abyssal sonar & liquid kalimba plucks
    if (s === 4 && bar % 2 === 0) {
      this._tone(1046.5, 1038, 0.36, 'sine', 0.02, when, 1800, true, true, true);
    }
    if (s === 2 || s === 7 || s === 11 || s === 14) {
      const nf = midiToHz(arp[(s + bar * 2) % arp.length]);
      this._fmTone(nf, 3.0, nf * 0.22, stepDur * 2.1, 0.023, when, true, true, true);
    }
  }

  _scheduleRebootSkimmerStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // High-speed moonlit ocean slalom: Em9 -> Cmaj7 -> D6 -> Bm7
    const chords = [
      [52, 55, 59, 62, 66],
      [48, 52, 55, 59, 64],
      [50, 54, 57, 62, 66],
      [47, 50, 54, 57, 62],
    ];
    const roots = [40, 36, 38, 35];
    const arp = [64, 67, 71, 74, 76, 79];

    if (s === 0) {
      this._padChord(chords[bar].map(midiToHz), when, stepDur * 15.5, 0.022, 860, 'sawtooth');
    }
    // Four-on-the-floor turbo kick & crisp snare
    if (s % 4 === 0) {
      this._tone(132, 44, 0.095, 'sine', 0.12, when, 280, true, false, true);
    }
    if (s === 4 || s === 12) {
      this._tone(195, 115, 0.05, 'triangle', 0.038, when, 580, true, false, true);
      this._noise(0.055, 0.028, 2200, 1250, 'bandpass', 1.2, when, true, true);
    }
    if (s % 2 === 1) {
      this._noise(0.022, 0.014, 5800, 4400, 'bandpass', 0.9, when, true, true, false, false);
    }

    // Driving 16th-note octave-carving synth bass
    const bf = midiToHz(roots[bar] + (s % 2 === 1 ? 12 : 0));
    const duck = s % 4 === 0 ? when + 0.018 : when;
    this._tone(bf, bf, stepDur * 0.8, 'sawtooth', 0.052, duck, 820, true, false, true, 260);

    // Bright wave-crest synth arpeggio
    if (s % 2 === 0) {
      const nf = midiToHz(arp[(s / 2 + bar) % arp.length]);
      this._fmTone(nf, 2.0, nf * 0.3, stepDur * 1.4, 0.024, when, true, true, true);
    }
  }

  _scheduleRebootVaultStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Suspended clockwork heist chamber: Dsus2 -> Bbmaj7#11 -> Gm(maj7) -> A7b9
    const pads = [
      [50, 57, 62, 64],
      [46, 53, 57, 64],
      [43, 50, 55, 62],
      [45, 52, 55, 61],
    ];

    if (s === 0) {
      this._padChord(pads[bar].map(midiToHz), when, stepDur * 15.8, 0.02, 540, 'triangle');
      // Heartbeat sub-throb
      this._tone(73.42, 42, 0.16, 'sine', 0.085, when, 160, true, false, true);
    }
    if (s === 3) {
      this._tone(68, 38, 0.14, 'sine', 0.055, when, 150, true, false, true);
    }

    // Precision brass escapement clockwork ticks
    if (s % 2 === 0) {
      const tickFreq = s % 4 === 0 ? 1180 : 880;
      this._fmTone(tickFreq, 3.14, 180, 0.026, 0.013, when, true, true, false);
    }

    // Shimmering amethyst harmonic droplet on beat 3.5
    if (s === 10) {
      const crystalHz = midiToHz(bar % 2 === 0 ? 74 : 76);
      this._fmTone(crystalHz, 3.0, crystalHz * 0.18, stepDur * 3.2, 0.018, when, true, true, true);
    }
  }

  _scheduleOriginalGlideStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Bright 2008 XBLA sky-flight progression: F -> G -> Em -> Am
    const roots = [41, 43, 40, 45];
    const triads = [
      [65, 69, 72],
      [67, 71, 74],
      [64, 67, 71],
      [69, 72, 76],
    ];

    if (s === 0 || s === 8) this._tone(145, 50, 0.08, 'sine', 0.105, when, 310, true, false, true);
    if (s === 4 || s === 12) this._noise(0.045, 0.028, 2500, 1500, 'bandpass', 1.3, when, true, true);
    if (s % 2 === 1) this._noise(0.02, 0.013, 6600, 6200, 'highpass', 0.8, when, true, true, false, false);

    if (s % 2 === 0) {
      const bf = midiToHz(roots[bar] + (s % 4 === 2 ? 12 : 0));
      this._tone(bf, bf, stepDur * 1.4, 'sawtooth', 0.052, when, 920, true, false, true, 310);
      const triad = triads[bar].map((m) => midiToHz(m + 12));
      this._steppedTone(triad, 0.021, stepDur * 1.75, 'square', 0.022, when, 2600, true, true, true);
    }
  }

  _scheduleOriginalPuzzleStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Mysterious Hewson/Amiga chamber ostinato: Dm -> Am -> Bb -> A
    const roots = [38, 45, 46, 45];
    const arp = [
      [62, 65, 69, 74],
      [60, 64, 69, 72],
      [62, 65, 70, 74],
      [61, 64, 69, 73],
    ];

    if (s === 0) {
      const bf = midiToHz(roots[bar]);
      this._tone(bf, bf, stepDur * 6.0, 'triangle', 0.058, when, 340, true, false, true);
    }
    if (s % 4 === 0 || s === 10 || s === 14) {
      const pool = arp[bar];
      const nf = midiToHz(pool[(s + bar) % pool.length]);
      this._tone(nf, nf, stepDur * 1.2, 'square', 0.02, when, 1750, true, true, true);
    }
  }

  _scheduleRebootGlideStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Soaring Sky-Wing Lydian/Aeolian storm-cloud anthem: Fmaj7#11 -> G6 -> Em9 -> Am9
    const chords = [
      [53, 57, 60, 64, 66],
      [55, 59, 62, 64, 67],
      [52, 55, 59, 62, 66],
      [57, 60, 64, 67, 71],
    ];
    const roots = [41, 43, 40, 45];
    const skyMotif = [72, 74, 76, 79, 81, 83];

    if (s === 0) {
      this._padChord(chords[bar].map(midiToHz), when, stepDur * 15.8, 0.025, 880, 'triangle');
    }
    // Buoyant wind-riding pulse
    if (s === 0 || s === 6 || s === 8) {
      this._tone(116, 44, 0.11, 'sine', 0.1, when, 240, true, false, true);
    }
    if (s === 4 || s === 12) {
      this._noise(0.05, 0.02, 2300, 1250, 'bandpass', 1.3, when, true, true);
    }
    if (s % 2 === 1) {
      this._noise(0.024, 0.011, 5600, 4200, 'bandpass', 0.85, when, true, true, false, false);
    }
    if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) {
      const bf = midiToHz(roots[bar] + (s === 14 ? 12 : 0));
      this._tone(bf, bf, stepDur * 1.5, 'triangle', 0.064, when + 0.015, 420, true, false, true);
    }
    // Soaring lantern-light FM bell arpeggio
    if (s === 0 || s === 3 || s === 6 || s === 10 || s === 13) {
      const nf = midiToHz(skyMotif[(s + bar * 2) % skyMotif.length]);
      this._fmTone(nf, 2.0, nf * 0.22, stepDur * 2.5, 0.022, when, true, true, true);
    }
  }

  _scheduleRebootPuzzleStep(step64, when, stepDur) {
    const bar = Math.floor(step64 / 16);
    const s = step64 % 16;
    // Mystical torch-lit stone chamber: Dm9 -> Am7 -> Bbmaj7#11 -> Asus4 (spacious so bells sing cleanly!)
    const pads = [
      [50, 53, 57, 60, 64],
      [45, 52, 55, 60, 64],
      [46, 53, 57, 60, 64],
      [45, 50, 52, 57, 64],
    ];
    const droplets = [62, 64, 67, 69, 74, 76];

    if (s === 0) {
      this._padChord(pads[bar].map(midiToHz), when, stepDur * 16.0, 0.022, 520, 'triangle');
      // Soft subterranean frame-drum breath on bar downbeat
      this._tone(82.41, 39, 0.18, 'sine', 0.068, when, 175, true, true, true);
    }
    if (s === 6 || (s === 13 && bar % 2 === 1)) {
      const nf = midiToHz(droplets[(step64 + bar) % droplets.length]);
      this._fmTone(nf, 2.0, nf * 0.14, stepDur * 3.4, 0.016, when, true, true, true);
    }
  }

  // --- Core SFX (15 Contract Methods — Dual-Era Voiced!) ---

  jump() {
    if (!this._canPlay('jump', 0.03)) return;
    if (this.era === 'original') {
      // Classic rising arcade square sweep (196Hz -> 587Hz, LPF 2600Hz, 0.115s)
      this._tone(this._vary(196, 0.02), this._vary(587.3, 0.02), 0.115, 'square', 0.085, 0, 2600);
      this._noise(0.035, 0.018, 2200, 3400, 'bandpass', 1.4, 0, false, false, false, false);
      return;
    }

    // 2026 Reboot: Crisp physical push-off transient + athletic air sweep
    const f0 = this._vary(195, 0.035);
    const f1 = this._vary(495, 0.035);
    this._tone(155, 68, 0.055, 'sine', 0.095, 0, 320, false, false); // stone push-off weight
    this._tone(f0, f1, 0.125, 'sine', 0.13, 0.006);
    this._tone(f0 * 1.5, f1 * 1.48, 0.095, 'triangle', 0.048, 0.012, 1550);
    this._noise(0.085, 0.04, 950, 2550, 'bandpass', 1.5, 0.005, false, false, true);
  }

  land(intensity = 0.6) {
    if (!this._canPlay('land', 0.035)) return;
    const imp = clamp(intensity, 0.15, 1.0);

    if (this.era === 'original') {
      // Tight dry low triangle thud (130Hz -> 48Hz, 0.060s)
      this._tone(this._vary(130, 0.03), 48, 0.06, 'triangle', 0.075 + imp * 0.065, 0, 520, false, false);
      return;
    }

    // 2026 Reboot: Heavy damp-stone corbel impact + wet grit
    this._tone(this._vary(118, 0.045), 36, 0.095, 'sine', 0.09 + imp * 0.085, 0, 280, false, false);
    this._noise(0.065, 0.025 + imp * 0.045, 680, 175, 'lowpass', 0.95, 0, false, false, true, true);
    if (imp > 0.55) {
      // Subtle wet-slate pebble/water-film click
      this._fmTone(this._vary(640, 0.08), 2.4, 190, 0.035, 0.024 * imp, 0.008);
    }
  }

  stepUp() {
    if (!this._canPlay('stepUp', 0.035)) return;
    if (this.era === 'original') {
      // Crisp square + triangle blip (330Hz -> 495Hz perfect 5th hop, 0.075s)
      this._tone(330, 495, 0.075, 'square', 0.052, 0, 2200);
      this._tone(330, 495, 0.075, 'triangle', 0.055, 0);
      return;
    }

    // 2026 Reboot: Agile damp-stone stair hop
    const f = this._vary(370, 0.03);
    this._tone(142, 62, 0.042, 'sine', 0.065, 0, 300, false, false);
    this._fmTone(f, 2.0, f * 0.32, 0.09, 0.072, 0.005, false, false, true, f * 1.498);
  }

  snowball() {
    if (!this._canPlay('snowball', 0.03)) return;
    if (this.era === 'original') {
      // Snappy laser-pop square + crisp noise burst (1480Hz -> 360Hz, BPF 2800Hz, 0.080s)
      this._tone(this._vary(1480, 0.03), 360, 0.08, 'square', 0.075, 0, 2800);
      this._noise(0.055, 0.038, 2800, 1100, 'bandpass', 1.5, 0);
      return;
    }

    // 2026 Reboot: Pressurized Cryo-Blaster thump + crystalline ice-bolt shimmer
    const f = this._vary(1320, 0.045);
    this._tone(245, 78, 0.055, 'sine', 0.085, 0, 420, false, false);
    this._fmTone(f, 2.5, f * 0.45, 0.095, 0.078, 0, false, false, true, f * 0.48);
    this._noise(0.075, 0.046, 2750, 920, 'bandpass', 1.45, 0.004);
  }

  bubble() {
    if (!this._canPlay('bubble', 0.03)) return;
    if (this.era === 'original') {
      // Submarine air-torpedo sine pop (310Hz -> 780Hz fast upward bubble chirp, 0.100s)
      this._tone(this._vary(310, 0.04), this._vary(780, 0.04), 0.1, 'sine', 0.115, 0);
      return;
    }

    // 2026 Reboot: Cryo-stasis hydro torpedo
    const f = this._vary(305, 0.05);
    this._tone(135, 58, 0.06, 'sine', 0.07, 0, 260, false, false);
    this._tone(f, f * 2.4, 0.125, 'sine', 0.11, 0.005);
    this._fmTone(f * 2.0, 1.5, f * 0.28, 0.095, 0.045, 0.02);
  }

  hitEnemy() {
    if (!this._canPlay('hitEnemy', 0.025)) return;
    if (this.era === 'original') {
      // Roller cannonball explosion: punchy bass drop (220->42Hz) + metallic FM (440Hz mod 2.5) + noise (0.170s)
      this._tone(220, 42, 0.17, 'sine', 0.155, 0);
      this._fmTone(440, 2.5, 340, 0.14, 0.078, 0);
      this._noise(0.15, 0.062, 1950, 420, 'bandpass', 1.15, 0);
      return;
    }

    // 2026 Reboot: Heavy furnace-sphere / armored crate shatter
    this._tone(this._vary(188, 0.04), 38, 0.18, 'sine', 0.165, 0);
    this._fmTone(this._vary(490, 0.05), 1.41, 260, 0.135, 0.082, 0);
    this._fmTone(this._vary(820, 0.06), 2.73, 210, 0.11, 0.048, 0.015);
    this._noise(0.14, 0.065, 2100, 420, 'bandpass', 1.2, 0, false, false, true);
  }

  stunEnemy() {
    if (!this._canPlay('stunEnemy', 0.025)) return;
    if (this.era === 'original') {
      // Bouncer freeze: dual electric square trill (660Hz / 880Hz 3-step freeze chime, 0.150s)
      this._steppedTone([660, 880, 660, 990], 0.036, 0.15, 'square', 0.065, 0, 2800);
      return;
    }

    // 2026 Reboot: Crystalline frost-shell encase chime
    const f = this._vary(760, 0.035);
    this._fmTone(f, 3.0, f * 0.42, 0.145, 0.072, 0);
    this._fmTone(f * 1.498, 3.0, f * 0.32, 0.165, 0.056, 0.035);
    this._noise(0.065, 0.03, 3300, 1650, 'bandpass', 2.0, 0.008);
  }

  catchFish() {
    if (!this._canPlay('catchFish', 0.03)) return;
    if (this.era === 'original') {
      // Bright 4-note XBLA coin/pickup square fanfare (C5 -> E5 -> G5 -> C6, 0.035s arp, 0.180s)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        this._tone(n, n, 0.09, 'square', 0.055, idx * 0.035, 2900);
        this._tone(n, n, 0.11, 'triangle', 0.045, idx * 0.035);
      });
      return;
    }

    // 2026 Reboot: Bioluminescent bubble pop + aqueous crystal arpeggio
    this._tone(155, 55, 0.12, 'sine', 0.12, 0);
    this._tone(380, 790, 0.075, 'sine', 0.065, 0.005);
    const chord = [587.33, 739.99, 880.0, 1174.66]; // Dmaj
    chord.forEach((n, idx) => {
      this._fmTone(this._vary(n, 0.012), 2.0, n * 0.25, 0.24, 0.06, idx * 0.038);
    });
  }

  crumble() {
    if (!this._canPlay('crumble', 0.04)) return;
    if (this.era === 'original') {
      // Brittle stepped pitch-drop + dry gravel noise (180Hz -> 60Hz stepped + LPF 900Hz, 0.190s)
      this._steppedTone([180, 135, 96, 62], 0.045, 0.19, 'triangle', 0.11, 0, 1100);
      this._noise(0.19, 0.085, 900, 260, 'lowpass', 1.0, 0);
      return;
    }

    // 2026 Reboot: Fracturing slate corbel & falling rubble
    this._noise(0.045, 0.055, 1650, 720, 'bandpass', 1.8, 0); // initial stone crack
    this._tone(this._vary(98, 0.05), 33, 0.25, 'sine', 0.145, 0.01);
    this._noise(0.26, 0.105, 780, 165, 'lowpass', 1.05, 0.01, false, false, true);
    this._fmTone(240, 2.3, 120, 0.06, 0.035, 0.065);
    this._fmTone(185, 2.6, 95, 0.06, 0.028, 0.125);
  }

  door() {
    if (!this._canPlay('door', 0.05)) return;
    if (this.era === 'original') {
      // Classic 3-note ascending portal square triad (261.6Hz -> 329.6Hz -> 392.0Hz, 0.05s each)
      const triad = [261.63, 329.63, 392.0];
      triad.forEach((n, idx) => {
        this._tone(n, n, 0.065, 'square', 0.062, idx * 0.05, 2400);
      });
      return;
    }

    // 2026 Reboot: Misty carved-stone archway resonance + swirling portal mist
    const f = this._vary(220, 0.02);
    this._tone(f, f * 0.75, 0.24, 'triangle', 0.085, 0, 620);
    this._noise(0.26, 0.055, 580, 1280, 'bandpass', 1.8, 0, false, false, true, true);
    this._fmTone(f * 2.0, 2.0, f * 0.22, 0.22, 0.058, 0.03);
    this._fmTone(f * 3.0, 2.0, f * 0.18, 0.24, 0.046, 0.085);
  }

  elevator() {
    if (!this._canPlay('elevator', 0.04)) return;
    if (this.era === 'original') {
      // Clean servo hum / recall chirp (220Hz -> 330Hz -> 440Hz sawtooth LPF 1400Hz, 0.120s)
      this._steppedTone([220, 330, 440], 0.038, 0.12, 'sawtooth', 0.065, 0, 1400);
      return;
    }

    // 2026 Reboot: Wrought-iron & brass cage latch clank + warm dynamo hum
    this._fmTone(this._vary(315, 0.04), 2.82, 240, 0.065, 0.062, 0); // brass/iron cable latch
    const f = this._vary(146.83, 0.025);
    this._tone(f, f * 1.5, 0.145, 'sawtooth', 0.052, 0.015, 860);
    this._tone(f * 2, f * 2.5, 0.12, 'sine', 0.042, 0.025);
  }

  splash() {
    if (!this._canPlay('splash', 0.06)) return;
    if (this.era === 'original') {
      // Filtered white-noise water plunge (1800->300Hz) + 3 sine pops (420->880Hz, 0.380s)
      this._tone(140, 46, 0.18, 'sine', 0.13, 0);
      this._noise(0.38, 0.115, 1800, 300, 'bandpass', 1.25, 0);
      [0.06, 0.13, 0.21].forEach((delay, idx) => {
        const bf = 420 + idx * 140;
        this._tone(bf, bf * 1.55, 0.065, 'sine', 0.05, delay);
      });
      return;
    }

    // 2026 Reboot: Crashing dark-ocean cavitation plunge + white-foam roar + bubbles
    this._tone(155, 36, 0.26, 'sine', 0.165, 0);
    this._noise(0.48, 0.145, 1650, 250, 'bandpass', 1.15, 0, false, false, true);
    this._noise(0.24, 0.075, 3200, 950, 'bandpass', 1.4, 0.02);
    this._tone(this._vary(410, 0.08), 760, 0.085, 'sine', 0.052, 0.08);
    this._tone(this._vary(540, 0.08), 940, 0.075, 'sine', 0.044, 0.16);
    this._tone(this._vary(660, 0.08), 1080, 0.07, 'sine', 0.036, 0.25);
  }

  hurt() {
    if (!this._canPlay('hurt', 0.06)) return;
    if (this.era === 'original') {
      // Classic descending cartoon-arcade tumble slide (440Hz -> 110Hz wobbly sawtooth, 0.240s)
      this._steppedTone([440, 370, 311, 261.6, 207.6, 164.8, 130.8, 110], 0.03, 0.24, 'sawtooth', 0.082, 0, 1800);
      return;
    }

    // 2026 Reboot: Visceral knockdown impact (softened slightly in Zen Mode)
    const scale = this.zenMode ? 0.65 : 1.0;
    this._tone(188, 40, 0.26, 'sine', 0.165 * scale, 0);
    this._tone(275, 102, 0.22, 'sawtooth', 0.068 * scale, 0.01, 740, false, true, false, 240);
    this._noise(0.15, 0.062 * scale, 780, 190, 'lowpass', 1.05, 0, false, false, true);
  }

  towerTopple() {
    if (!this._canPlay('towerTopple', 0.2)) return;
    if (this.era === 'original') {
      // Sustained rumble + triumphant F -> G -> C bright sawtooth triad (1.100s)
      this._tone(92, 34, 0.95, 'sine', 0.16, 0);
      this._noise(1.05, 0.11, 820, 160, 'lowpass', 1.0, 0);
      const fanfare = [
        { notes: [349.23, 440.0, 523.25], delay: 0.06, dur: 0.22 }, // F
        { notes: [392.0, 493.88, 587.33], delay: 0.28, dur: 0.22 }, // G
        { notes: [523.25, 659.25, 783.99, 1046.5], delay: 0.50, dur: 0.58 }, // C
      ];
      for (const chord of fanfare) {
        for (const n of chord.notes) {
          this._tone(n, n, chord.dur, 'sawtooth', 0.044, chord.delay, 2400);
          this._tone(n, n, chord.dur, 'square', 0.025, chord.delay, 2000);
        }
      }
      return;
    }

    // 2026 Reboot: Colossal seismic monolith collapse + dark-heroic cinematic brass/bell fanfare
    this._tone(92, 28, 1.25, 'sine', 0.185, 0);
    this._noise(1.25, 0.14, 760, 135, 'lowpass', 0.95, 0, false, false, true);
    // Secondary masonry collapse crunches
    this._noise(0.28, 0.085, 1150, 260, 'bandpass', 1.2, 0.22, false, false, true);
    this._noise(0.32, 0.08, 950, 220, 'bandpass', 1.2, 0.54, false, false, true);

    const cinematicChords = [
      { notes: [293.66, 440.0, 587.33, 659.25], delay: 0.06, dur: 0.3 }, // Dsus2
      { notes: [233.08, 349.23, 466.16, 587.33], delay: 0.28, dur: 0.3 }, // Bbadd9
      { notes: [261.63, 392.0, 523.25, 659.25], delay: 0.50, dur: 0.32 }, // C
      { notes: [293.66, 440.0, 587.33, 739.99, 880.0], delay: 0.74, dur: 0.72 }, // D major triumph
    ];
    for (const c of cinematicChords) {
      for (const n of c.notes) {
        this._tone(n, n, c.dur, 'sawtooth', 0.032, c.delay, 1850, false, true, false, 950);
        this._fmTone(n, 2.0, n * 0.24, c.dur, 0.028, c.delay);
      }
    }
  }

  extraLife() {
    if (!this._canPlay('extraLife', 0.1)) return;
    if (this.era === 'original') {
      // Classic 6-note 1-UP arcade jingle: E5-G5-E6-C6-D6-G6 crisp staccato (0.480s)
      const jingle = [659.25, 783.99, 1318.51, 1046.5, 1174.66, 1567.98];
      jingle.forEach((n, idx) => {
        const dur = idx === 5 ? 0.18 : 0.075;
        this._tone(n, n, dur, 'square', 0.058, idx * 0.072, 2900);
        this._fmTone(n, 2.0, n * 0.22, dur + 0.04, 0.042, idx * 0.072);
      });
      return;
    }

    // 2026 Reboot: Radiant 6-note bioluminescent crystal/synth fanfare
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((n, idx) => {
      this._fmTone(n, 2.0, n * 0.28, 0.34, 0.07, idx * 0.065);
      this._tone(n * 0.5, n * 0.5, 0.26, 'triangle', 0.035, idx * 0.065, 1400);
    });
  }

  // --- 2026 Reboot Extended SFX (10 Contract Methods — Dual-Era Voiced!) ---

  collectGear() {
    if (!this._canPlay('collectGear', 0.028)) return;
    if (this.era === 'original') {
      this._tone(987.77, 987.77, 0.055, 'square', 0.055, 0, 3000);
      this._tone(1318.51, 1318.51, 0.13, 'square', 0.06, 0.05, 3000);
      return;
    }

    // Gleaming brass-and-cyan cog click + twin chime
    this._fmTone(this._vary(610, 0.02), 2.42, 220, 0.045, 0.045, 0);
    this._fmTone(880.0, 2.0, 190, 0.14, 0.062, 0.012);
    this._fmTone(1318.51, 2.0, 240, 0.22, 0.068, 0.055);
  }

  collectStar() {
    if (!this._canPlay('collectStar', 0.08)) return;
    if (this.era === 'original') {
      const notes = [523.25, 659.25, 783.99, 987.77, 1318.51];
      notes.forEach((n, i) => {
        this._tone(n, n, 0.14, 'square', 0.055, i * 0.055, 2900);
        this._tone(n * 0.5, n * 0.5, 0.16, 'triangle', 0.042, i * 0.055);
      });
      return;
    }

    // Celestial Star Core Lydian crystal cascade (C5 - E5 - F#5 - B5 - E6)
    this._tone(261.63, 523.25, 0.42, 'triangle', 0.065, 0, 1200);
    const notes = [523.25, 659.25, 739.99, 987.77, 1318.51];
    notes.forEach((n, i) => {
      this._fmTone(n, 3.0, n * 0.26, 0.36, 0.062, i * 0.058);
      this._tone(n, n, 0.28, 'sine', 0.04, i * 0.058);
    });
  }

  switchToggle() {
    if (!this._canPlay('switchToggle', 0.035)) return;
    if (this.era === 'original') {
      this._tone(440, 440, 0.045, 'square', 0.06, 0, 2400);
      this._tone(880, 880, 0.075, 'square', 0.065, 0.045, 2600);
      return;
    }

    // Heavy mechanical resonator latch + plasma conduit chirp
    this._tone(175, 72, 0.06, 'sine', 0.095, 0, 320, false, false);
    this._fmTone(520, 2.65, 260, 0.055, 0.058, 0);
    this._fmTone(587.33, 2.0, 180, 0.13, 0.062, 0.035, false, false, true, 880.0);
  }

  steamBurst() {
    if (!this._canPlay('steamBurst', 0.05)) return;
    if (this.era === 'original') {
      this._tone(240, 95, 0.07, 'triangle', 0.07, 0);
      this._noise(0.24, 0.085, 2600, 980, 'bandpass', 1.3, 0);
      return;
    }

    // Pressurized foundry pipe valve pop + forceful steam eruption
    this._tone(320, 98, 0.075, 'sine', 0.095, 0, 450, false, false);
    this._fmTone(410, 2.7, 220, 0.05, 0.042, 0);
    this._noise(0.34, 0.105, 2300, 920, 'bandpass', 1.15, 0.01, false, false, false);
    this._noise(0.28, 0.065, 820, 320, 'lowpass', 0.9, 0.02, false, false, true);
  }

  thunderCrack() {
    if (!this._canPlay('thunderCrack', 0.12)) return;
    if (this.era === 'original') {
      this._tone(580, 52, 0.22, 'square', 0.07, 0, 1600);
      this._noise(0.45, 0.1, 1250, 160, 'lowpass', 1.0, 0);
      return;
    }

    // Forked lightning arc snap + tearing sky crack + deep rolling storm thunder
    this._noise(0.065, 0.11, 3100, 950, 'bandpass', 1.5, 0);
    this._noise(0.26, 0.125, 1450, 240, 'lowpass', 1.1, 0.02, false, false, false);
    this._noise(0.92, 0.135, 360, 68, 'lowpass', 0.9, 0.05, false, false, true, true);
    this._tone(74, 30, 0.85, 'sine', 0.145, 0.04);
  }

  boostGate(mult = 1) {
    if (!this._canPlay('boostGate', 0.04)) return;
    const m = Math.round(clamp(mult, 1, 4));
    const semis = [0, 3, 5, 7][m - 1];
    const ratio = Math.pow(2, semis / 12);

    if (this.era === 'original') {
      const base = [392.0, 523.25, 659.25, 783.99].map((f) => f * ratio);
      base.forEach((n, idx) => {
        this._tone(n, n * 1.06, 0.085, 'square', 0.055, idx * 0.03, 2800);
      });
      return;
    }

    // Hydro-Skimmer plasma slalom gate: turbine whoosh + pitch-escalating chord surge
    const root = 329.63 * ratio;
    this._noise(0.22, 0.07, 700 * ratio, 2400, 'bandpass', 1.6, 0, false, false, true);
    this._tone(root * 0.5, root, 0.22, 'sawtooth', 0.065, 0, 1900);
    this._fmTone(root, 2.0, root * 0.3, 0.24, 0.062, 0.015, false, false, true, root * 1.5);
    this._fmTone(root * 1.5, 2.0, root * 0.25, 0.26, 0.052, 0.045, false, false, true, root * 2.0);
  }

  vaultTick(locked = false) {
    if (!this._canPlay(locked ? 'vaultLock' : 'vaultTick', locked ? 0.03 : 0.02)) return;

    if (this.era === 'original') {
      if (!locked) {
        // Crisp brass pin miss/ricochet blip
        this._tone(420, 210, 0.065, 'square', 0.062, 0, 2400, false, false);
        this._tone(960, 640, 0.035, 'triangle', 0.045, 0, 2600, false, false);
      } else {
        this._tone(587.33, 587.33, 0.06, 'square', 0.065, 0, 2800);
        this._tone(1174.66, 1174.66, 0.13, 'square', 0.07, 0.05, 2800);
      }
      return;
    }

    if (!locked) {
      // Crisp metallic brass pin deflection / strike clack
      this._tone(215, 92, 0.075, 'sine', 0.09, 0, 380, false, false);
      this._fmTone(this._vary(780, 0.03), 2.78, 280, 0.065, 0.068, 0, false, false, true, 460);
    } else {
      // Satisfying heavy brass-and-amethyst tumbler lock engagement!
      this._tone(168, 62, 0.085, 'sine', 0.115, 0, 320, false, false);
      this._fmTone(440, 2.6, 240, 0.06, 0.06, 0);
      this._fmTone(587.33, 2.0, 180, 0.16, 0.068, 0.02);
      this._fmTone(880.0, 3.0, 210, 0.22, 0.065, 0.065);
    }
  }

  vaultUnlock() {
    if (!this._canPlay('vaultUnlock', 0.1)) return;
    if (this.era === 'original') {
      const fanfare = [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66];
      fanfare.forEach((n, idx) => {
        this._tone(n, n, 0.13, 'square', 0.058, idx * 0.052, 2900);
        this._tone(n * 0.5, n * 0.5, 0.14, 'triangle', 0.042, idx * 0.052);
      });
      return;
    }

    // Heavy ancient vault seal release + golden-amethyst Star Core cascade
    this._tone(132, 46, 0.24, 'sine', 0.14, 0);
    this._noise(0.22, 0.06, 1400, 480, 'bandpass', 1.5, 0.01, false, false, true);
    const notes = [587.33, 739.99, 880.0, 1108.73, 1174.66, 1479.98]; // Dmaj7#11/maj9
    notes.forEach((n, idx) => {
      this._fmTone(n, 2.0, n * 0.26, 0.36, 0.065, 0.04 + idx * 0.055);
      this._tone(n * 0.5, n * 0.5, 0.28, 'triangle', 0.036, 0.04 + idx * 0.055, 1600);
    });
  }

  vaultFail() {
    if (!this._canPlay('vaultFail', 0.06)) return;
    if (this.era === 'original') {
      this._tone(246.94, 233.08, 0.11, 'sawtooth', 0.07, 0, 1400);
      this._tone(146.83, 123.47, 0.22, 'sawtooth', 0.078, 0.1, 1200);
      return;
    }

    // Jammed tumbler clack + descending dark-brass strike
    this._fmTone(285, 2.38, 290, 0.08, 0.075, 0);
    this._tone(220, 196, 0.14, 'sawtooth', 0.068, 0.015, 780);
    this._tone(155.56, 123.47, 0.26, 'sawtooth', 0.075, 0.11, 620);
  }

  trophyUnlock() {
    if (!this._canPlay('trophyUnlock', 0.12)) return;
    if (this.era === 'original') {
      const notes = [659.25, 987.77, 1318.51, 1567.98];
      notes.forEach((n, idx) => {
        this._fmTone(n, 2.0, n * 0.3, 0.28, 0.065, idx * 0.06);
        this._tone(n, n, 0.18, 'square', 0.035, idx * 0.06, 3000);
      });
      return;
    }

    // Prestige Achievement Toast fanfare (Eb5 - G5 - Bb5 - D6 - F6)
    const notes = [622.25, 783.99, 932.33, 1174.66, 1396.91];
    notes.forEach((n, idx) => {
      this._fmTone(n, 3.0, n * 0.24, 0.42, 0.064, idx * 0.062);
      this._tone(n * 0.5, n * 0.5, 0.34, 'triangle', 0.038, idx * 0.062, 1800);
    });
  }

  // --- Optional Classic / Gameplay Convenience Cues (ORIGINAL_DESIGN.md §3.2.B) ---

  hitBlock() {
    if (!this._canPlay('hitBlock', 0.025)) return;
    if (this.era === 'original') {
      this._tone(523.25, 523.25, 0.055, 'square', 0.062, 0, 2600);
      this._tone(783.99, 783.99, 0.075, 'square', 0.062, 0.05, 2600);
      this._noise(0.12, 0.058, 1800, 500, 'bandpass', 1.2, 0);
      return;
    }
    this._tone(165, 48, 0.13, 'sine', 0.14, 0);
    this._fmTone(580, 2.2, 240, 0.11, 0.07, 0);
    this._noise(0.11, 0.058, 1900, 480, 'bandpass', 1.25, 0, false, false, true);
  }

  deflect() {
    if (!this._canPlay('deflect', 0.025)) return;
    if (this.era === 'original') {
      this._fmTone(1180, 3.41, 420, 0.07, 0.062, 0, false, false, true, 1760);
      return;
    }
    this._fmTone(this._vary(1080, 0.05), 3.41, 360, 0.085, 0.06, 0, false, false, true, 1580);
  }

  timerTick(urgent = false) {
    if (!this._canPlay('timerTick', 0.15)) return;
    const f = urgent ? 987.77 : 783.99;
    if (this.era === 'original') {
      this._tone(f, f, 0.045, 'square', 0.038, 0, 2400, false, false);
    } else {
      this._fmTone(f, 2.0, 90, 0.06, 0.036, 0, false, false, true);
    }
  }

  // --- The Glide (3D Sky-Wing Mini-Game) Acoustic Cues (ORIGIN_INTEGRATION_PLAN.md §3.2.3) ---

  /** Continuous 60Hz-safe airspeed & dive wind controller (zero per-frame node allocation). */
  setWind(level = 0) {
    const w = clamp(level, 0, 1);
    this._windLevel = w;

    if (w <= 0.004 || this.muted || !this.ctx || !this.sfxGain || !this._pinkNoiseBuf) {
      this._stopGlideWind();
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const targetFreq = 280 + w * 960;
    const targetQ = 1.65 - w * 0.55;
    const targetGain = w * (this.era === 'original' ? 0.045 : 0.082);

    if (!this._glideWindNodes) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._pinkNoiseBuf;
      src.loop = true;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(targetFreq, now);
      bp.Q.setValueAtTime(targetQ, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setTargetAtTime(targetGain, now, 0.06);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.sfxGain);
      if (this.era === 'reboot' && this.sfxReverbGain) {
        gain.connect(this.sfxReverbGain);
      }

      src.start(now, Math.random() * 1.2);
      this._glideWindNodes = { src, bp, gain };
    } else {
      const n = this._glideWindNodes;
      n.bp.frequency.setTargetAtTime(targetFreq, now, 0.05);
      n.bp.Q.setTargetAtTime(targetQ, now, 0.05);
      n.gain.gain.setTargetAtTime(targetGain, now, 0.05);
    }
  }

  _stopGlideWind() {
    const n = this._glideWindNodes;
    if (!n) return;
    this._glideWindNodes = null;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    try {
      n.gain.gain.cancelScheduledValues(now);
      n.gain.gain.setValueAtTime(Math.max(0.0001, n.gain.gain.value), now);
      n.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      n.src.stop(now + 0.095);
      n.src.onended = () => {
        try {
          n.src.disconnect();
          n.bp.disconnect();
          n.gain.disconnect();
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }
  }

  glideFlap() {
    if (!this._canPlay('glideFlap', 0.06)) return;
    if (this.era === 'original') {
      this._tone(240, 520, 0.13, 'triangle', 0.07, 0, 2200);
      this._noise(0.16, 0.065, 420, 1380, 'bandpass', 1.1, 0);
      return;
    }

    // Canvas sail air-pocket whump + warm thermal lift harmonic
    this._tone(132, 58, 0.12, 'sine', 0.095, 0, 240, false, false);
    this._noise(0.14, 0.065, 190, 80, 'lowpass', 0.85, 0, false, false, true, false);
    this._noise(0.22, 0.085, 290, 960, 'bandpass', 0.95, 0.008, false, false, true, true);
    this._tone(this._vary(320, 0.03), 555, 0.15, 'sine', 0.045, 0.018);
  }

  ringChime(step = 0) {
    if (!this._canPlay('ringChime', 0.025)) return;
    const k = clamp(Math.floor(Number(step) || 0), 0, 14);
    const f = 587.33 * Math.pow(2, k / 12);

    if (this.era === 'original') {
      [1.0, 1.25, 1.5].forEach((mult, idx) => {
        this._tone(f * mult, f * mult, 0.1, 'square', 0.052, idx * 0.035, 3200);
      });
      return;
    }

    // Ascending crystalline harmonic gate chime + airy pass whoosh
    this._fmTone(f, 3.0, f * 0.45, 0.42, 0.062, 0);
    this._fmTone(f * 1.498, 2.0, f * 0.28, 0.38, 0.046, 0.055);
    this._tone(f * 2.0, f * 2.01, 0.44, 'sine', 0.026, 0.1);
    this._noise(0.24, 0.035, 1800, 4800, 'bandpass', 1.2, 0, false, false, false, true);
  }

  gust() {
    if (!this._canPlay('gust', 0.08)) return;
    if (this.era === 'original') {
      this._noise(0.26, 0.068, 420, 1550, 'bandpass', 1.5, 0);
      return;
    }

    // Swirling storm wind-shear gust
    this._tone(108, 52, 0.22, 'sine', 0.065, 0, 220, false, false);
    this._noise(0.36, 0.082, 310, 1180, 'bandpass', 1.75, 0, false, false, true, true);
    this._noise(0.24, 0.045, 1180, 420, 'bandpass', 1.5, 0.12, false, false, false, true);
  }

  thunderClap() {
    if (!this._canPlay('thunderClap', 0.12)) return;
    if (this.era === 'original') {
      this._tone(640, 48, 0.22, 'square', 0.075, 0, 1800);
      this._noise(0.48, 0.11, 1600, 150, 'lowpass', 0.95, 0);
      return;
    }

    // Close-range storm cloud lightning crack & rolling sub-boom
    this._noise(0.15, 0.135, 4200, 1050, 'lowpass', 0.85, 0, false, false, false, false);
    this._noise(0.95, 0.14, 720, 95, 'lowpass', 0.9, 0.03, false, false, true, true);
    this._tone(72, 32, 0.85, 'sine', 0.14, 0.01);
  }

  glideWhoosh() {
    if (!this._canPlay('glideWhoosh', 0.06)) return;
    this._noise(0.28, 0.072, 520, 2450, 'bandpass', 1.45, 0, false, false, true, true);
  }

  // --- Rune-Door Secret Chambers Acoustic Cues (ORIGIN_INTEGRATION_PLAN.md §3.2.3) ---

  puzzleEnter() {
    if (!this._canPlay('puzzleEnter', 0.12)) return;
    if (this.era === 'original') {
      const notes = [392.0, 329.63, 293.66, 261.63];
      notes.forEach((n, idx) => {
        this._tone(n, n, 0.09, 'square', 0.055, idx * 0.055, 2200);
      });
      this._tone(96, 48, 0.18, 'triangle', 0.09, 0.2);
      return;
    }

    // Heavy stone slab rumbling shut + torch-lit chamber air chord
    this._noise(0.55, 0.085, 220, 420, 'lowpass', 1.05, 0, false, false, true, true);
    this._tone(68, 42, 0.38, 'sine', 0.13, 0.34);
    const chord = [196.0, 293.66, 392.0, 493.88];
    chord.forEach((f, idx) => {
      this._tone(f, f, 0.85, 'triangle', 0.026, 0.18 + idx * 0.045, 1600);
    });
  }

  puzzleLeave() {
    if (!this._canPlay('puzzleLeave', 0.1)) return;
    if (this.era === 'original') {
      [392.0, 493.88, 587.33].forEach((n, idx) => {
        this._tone(n, n, 0.08, 'square', 0.058, idx * 0.05, 2500);
      });
      return;
    }

    // Rising moonlit breeze + stone archway portal shimmer
    this._noise(0.42, 0.058, 320, 1950, 'bandpass', 1.15, 0, false, false, true, true);
    this._tone(392.0, 783.99, 0.34, 'sine', 0.045, 0.06);
    this._fmTone(587.33, 2.0, 140, 0.32, 0.04, 0.1);
  }

  puzzleTile(lit = 1) {
    const isLit = Boolean(lit);
    if (!this._canPlay(isLit ? 'puzzleTileOn' : 'puzzleTileOff', 0.025)) return;

    if (this.era === 'original') {
      const f0 = isLit ? 523.25 : 392.0;
      const f1 = isLit ? 783.99 : 261.63;
      this._tone(f0, f1, 0.085, 'square', 0.058, 0, 2500);
      return;
    }

    // Resonant carved rune-stone stomp + cyan sigil ignite / dim
    this._tone(145, 66, 0.075, 'sine', 0.09, 0, 300, false, false);
    if (isLit) {
      this._fmTone(523.25, 2.0, 160, 0.22, 0.062, 0.01, false, false, true, 783.99);
    } else {
      this._tone(392.0, 261.63, 0.16, 'triangle', 0.052, 0.01, 1100);
    }
  }

  puzzleBell(semitone = 0) {
    const semi = clamp(Number(semitone) || 0, -12, 24);
    if (!this._canPlay(`puzzleBell_${semi}`, 0.025)) return;
    const f = 392.0 * Math.pow(2, semi / 12);

    if (this.era === 'original') {
      this._fmTone(f, 2.0, f * 0.45, 0.45, 0.072, 0);
      this._tone(f * 2.0, f * 2.0, 0.28, 'triangle', 0.032, 0, 2800);
      return;
    }

    // Multi-partial struck bronze-and-crystal pentatonic chamber bell
    this._noise(0.04, 0.032, 4200, 2100, 'bandpass', 1.8, 0, false, false, false, false);
    this._fmTone(f, 1.414, f * 1.1, 0.92, 0.068, 0);
    this._fmTone(f, 3.0, f * 0.55, 0.52, 0.034, 0);
    this._tone(f * 0.5, f * 0.5, 0.95, 'sine', 0.042, 0);
    this._tone(f * 2.756, f * 2.756, 0.36, 'sine', 0.018, 0);
  }

  puzzleMirror() {
    if (!this._canPlay('puzzleMirror', 0.03)) return;
    if (this.era === 'original') {
      this._tone(660, 990, 0.065, 'square', 0.055, 0, 2800);
      this._fmTone(1318.51, 2.0, 220, 0.14, 0.045, 0.04);
      return;
    }

    // Brass gear ratchet click + rotating crystal prism shimmer
    this._fmTone(this._vary(580, 0.03), 2.65, 250, 0.055, 0.058, 0, false, false, false);
    this._fmTone(987.77, 3.0, 240, 0.22, 0.048, 0.025, false, false, true, 1318.51);
  }

  puzzleBlock() {
    if (!this._canPlay('puzzleBlock', 0.05)) return;
    if (this.era === 'original') {
      this._noise(0.18, 0.075, 420, 240, 'lowpass', 1.1, 0);
      this._tone(95, 55, 0.12, 'triangle', 0.095, 0.14);
      return;
    }

    // Heavy ashlar rune-block slide across stone floor + settle thud
    this._noise(0.22, 0.095, 260, 490, 'lowpass', 1.2, 0, false, false, true, true);
    this._tone(84, 54, 0.16, 'sine', 0.12, 0.16, 240, false, false);
  }

  puzzlePlate() {
    if (!this._canPlay('puzzlePlate', 0.05)) return;
    if (this.era === 'original') {
      this._tone(110, 65, 0.14, 'triangle', 0.09, 0);
      [523.25, 783.99, 1046.5].forEach((n, i) => {
        this._tone(n, n, 0.12, 'square', 0.052, 0.04 + i * 0.05, 2800);
      });
      return;
    }

    // Sunken stone pressure-plate lock + 3-note radiant confirmation
    this._tone(98, 58, 0.24, 'sine', 0.135, 0);
    [523.25, 783.99, 1046.5].forEach((n, i) => {
      this._fmTone(n, 2.0, 190, 0.36, 0.05, 0.045 + i * 0.06);
    });
  }

  puzzleUndo() {
    if (!this._canPlay('puzzleUndo', 0.04)) return;
    if (this.era === 'original') {
      this._steppedTone([880, 659.25, 440], 0.04, 0.13, 'triangle', 0.065, 0, 2400);
      return;
    }

    // Reverse-swept crystalline time-step whoosh
    this._noise(0.2, 0.055, 2200, 520, 'bandpass', 1.35, 0, false, false, false, true);
    this._fmTone(880.0, 2.0, 160, 0.18, 0.048, 0.01, false, false, true, 440.0);
  }

  puzzleWrong() {
    if (!this._canPlay('puzzleWrong', 0.06)) return;
    if (this.era === 'original') {
      this._tone(311.13, 293.66, 0.11, 'sawtooth', 0.065, 0, 1400);
      this._tone(207.65, 185.0, 0.2, 'sawtooth', 0.072, 0.09, 1200);
      return;
    }

    // Gentle dissonant bronze-bell reset hum + muted stone thud
    this._tone(130.81, 82.41, 0.22, 'sine', 0.095, 0);
    this._fmTone(311.13, 1.414, 180, 0.28, 0.055, 0, false, false, true, 207.65);
  }

  puzzleSolve() {
    if (!this._canPlay('puzzleSolve', 0.15)) return;
    const run = [0, 4, 7, 9, 12, 16, 19, 24];

    if (this.era === 'original') {
      run.forEach((semi, idx) => {
        const f = 392.0 * Math.pow(2, semi / 12);
        this._tone(f, f, 0.13, 'square', 0.052, idx * 0.055, 3000);
        this._tone(f * 0.5, f * 0.5, 0.14, 'triangle', 0.038, idx * 0.055);
      });
      return;
    }

    // Glorious 8-note chamber-bell cascade blooming into Gmaj9 chord
    run.forEach((semi, idx) => {
      const f = 392.0 * Math.pow(2, semi / 12);
      this._fmTone(f, 1.414, f * 0.65, 0.68, 0.048, idx * 0.065);
    });
    const bloomDelay = run.length * 0.065;
    this._tone(98.0, 98.0, 0.9, 'sine', 0.11, bloomDelay);
    [196.0, 246.94, 293.66, 392.0, 493.88, 587.33].forEach((f) => {
      this._tone(f, f, 0.95, 'triangle', 0.028, bloomDelay, 2200);
    });
  }

  // --- Companion Cues Invoked Directly by GlideStage & PuzzleRoom ---

  puzzleBump() {
    if (!this._canPlay('puzzleBump', 0.05)) return;
    this._tone(118, 72, 0.085, 'sine', 0.085, 0, 260, false, false);
    this._noise(0.055, 0.035, 680, 260, 'lowpass', 0.9, 0, false, false, true, false);
  }

  footstep(surface = 'stone') {
    if (!this._canPlay('footstep', 0.06)) return;
    const base = surface === 'ice' ? 620 : 140;
    this._tone(this._vary(base, 0.06), base * 0.52, 0.045, 'sine', 0.042, 0, 420, false, false);
    this._noise(0.035, 0.022, surface === 'ice' ? 2400 : 540, 220, 'lowpass', 0.9, 0, false, false, true, false);
  }

  collect(step = 0) {
    if (!this._canPlay('collect', 0.022)) return;
    const pent = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const idx = clamp(Math.floor(Number(step) || 0), 0, pent.length - 1);
    const f = 523.25 * Math.pow(2, pent[idx] / 12);

    if (this.era === 'original') {
      this._tone(f, f * 1.02, 0.09, 'square', 0.052, 0, 3000);
      return;
    }
    this._fmTone(this._vary(f, 0.01), 2.0, f * 0.28, 0.24, 0.058, 0);
  }

  secret() {
    if (!this._canPlay('secret', 0.08)) return;
    const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98];
    notes.forEach((n, i) => {
      this._fmTone(n, 3.0, n * 0.24, 0.34, 0.055, i * 0.05);
    });
  }

  jellyZap() {
    if (!this._canPlay('jellyZap', 0.06)) return;
    this._fmTone(230, 5.4, 920, 0.24, 0.085, 0, false, false, true, 120);
    this._noise(0.22, 0.075, 3400, 1400, 'bandpass', 1.4, 0);
  }

  pistonWarn() {
    if (!this._canPlay('pistonWarn', 0.08)) return;
    this._fmTone(1174.66, 2.0, 180, 0.09, 0.048, 0, false, false, true, 1567.98);
  }

  pogoCheer() {
    if (!this._canPlay('pogoCheer', 0.12)) return;
    if (this.era === 'original') {
      [523.25, 659.25, 1046.5].forEach((n, i) => {
        this._tone(n, n * 1.06, 0.085, 'square', 0.052, i * 0.055, 2800);
      });
      return;
    }
    // Expressive two-syllable happy amphibian chirp + crystal sparkle
    this._tone(480, 680, 0.11, 'triangle', 0.065, 0, 1850);
    this._tone(640, 960, 0.16, 'triangle', 0.072, 0.12, 2100);
    this._fmTone(1318.51, 2.0, 220, 0.24, 0.036, 0.14);
  }

  uiTap() {
    if (!this._canPlay('uiTap', 0.02)) return;
    this._fmTone(1174.66, 2.0, 110, 0.055, 0.038, 0, false, false, false);
  }

  uiBack() {
    if (!this._canPlay('uiBack', 0.025)) return;
    this._tone(880.0, 880.0, 0.045, 'sine', 0.038, 0, null, false, false);
    this._tone(587.33, 587.33, 0.07, 'sine', 0.038, 0.045, null, false, false);
  }
}

export const sound = new SoundEngine();
