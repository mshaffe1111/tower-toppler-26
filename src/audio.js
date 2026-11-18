// Studio Acoustic Streaming, Equal-Power Cross-Fade & Organic Foley Engine
// for Towering Waters: Gateway's Descent (Created by Matt Shaffer).
// Leaf module (zero internal src/ imports) — implements ARCHITECTURE_CONTRACT.md §4.6.

const CANONICAL_BIOMES = [
  'canyon_river',
  'alpine_lake',
  'mist_bayou',
  'coral_sea',
  'storm_ocean',
];

const THEME_TO_BIOME = Object.freeze({
  // Canonical 5 Earth Water Biomes + Sanctuary Menu
  sanctum_menu: 'sanctum_menu',
  menu: 'sanctum_menu',
  title: 'sanctum_menu',
  sanctum: 'sanctum_menu',
  cutscene: 'sanctum_menu',

  canyon_river: 'canyon_river',
  river: 'canyon_river',
  canyon: 'canyon_river',
  redwood: 'canyon_river',

  alpine_lake: 'alpine_lake',
  alpine: 'alpine_lake',
  lake: 'alpine_lake',
  mountain: 'alpine_lake',
  blizzard: 'alpine_lake',

  mist_bayou: 'mist_bayou',
  bayou: 'mist_bayou',
  mist: 'mist_bayou',
  delta: 'mist_bayou',
  foundry: 'mist_bayou',

  coral_sea: 'coral_sea',
  coral: 'coral_sea',
  reef: 'coral_sea',
  lagoon: 'coral_sea',
  prism: 'coral_sea',
  piston: 'coral_sea',

  storm_ocean: 'storm_ocean',
  ocean: 'storm_ocean',
  storm: 'storm_ocean',
  tempest: 'storm_ocean',
  sinking: 'storm_ocean',
  blackout: 'storm_ocean',
  apex: 'storm_ocean',

  warden_boss: 'warden_boss',
  warden_gauntlet: 'warden_boss',
  boss: 'warden_boss',
  siphon_warden: 'warden_boss',

  core_descent: 'core_descent',
  descent: 'core_descent',
  flood_rush: 'core_descent',
});

const MINIGAME_ALIASES = Object.freeze({
  core_descent: 'core_descent',
  descent: 'core_descent',
  reef_swim: 'reef_swim',
  submarine: 'reef_swim',
  rapids_surf: 'rapids_surf',
  skimmer: 'rapids_surf',
  frill_glide: 'frill_glide',
  glide: 'frill_glide',
  aqueduct_sanctum: 'aqueduct_sanctum',
  puzzle: 'aqueduct_sanctum',
  vault: 'aqueduct_sanctum',
});

const MUSIC_STEMS = Object.freeze({
  sanctum_menu: 'music_sanctum_menu.ogg',
  canyon_river: 'music_canyon_river.ogg',
  alpine_lake: 'music_alpine_lake.ogg',
  mist_bayou: 'music_mist_bayou.ogg',
  coral_sea: 'music_coral_sea.ogg',
  storm_ocean: 'music_storm_ocean.ogg',
  warden_boss: 'music_warden_boss.ogg',
  core_descent: 'music_core_descent.ogg',
});

const AMBIENCE_STEMS = Object.freeze({
  sanctum_menu: 'amb_alpine_lap.ogg',
  canyon_river: 'amb_river_rapids.ogg',
  alpine_lake: 'amb_alpine_lap.ogg',
  mist_bayou: 'amb_bayou_night.ogg',
  coral_sea: 'amb_coral_surf.ogg',
  storm_ocean: 'amb_ocean_swell.ogg',
  warden_boss: 'amb_ocean_swell.ogg',
  core_descent: 'amb_river_rapids.ogg',
});

// Biome-synchronized musical scales (root Hz + pentatonic/Lydian semitone offsets)
// so pickups, valves, rings, and combos harmonize naturally with each studio .ogg score.
const BIOME_HARMONICS = Object.freeze({
  sanctum_menu: {
    rootHz: 293.66, // D4 (D Lydian: D, E, F#, A, B)
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
    padMidi: [50, 57, 61, 66],
  },
  canyon_river: {
    rootHz: 392.0, // G4 (G Mixolydian / Major Pentatonic: G, A, B, D, E)
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
    padMidi: [55, 59, 62, 67],
  },
  alpine_lake: {
    rootHz: 349.23, // F4 (F Lydian / Major Pentatonic: F, G, A, C, D)
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
    padMidi: [53, 57, 60, 64],
  },
  mist_bayou: {
    rootHz: 329.63, // E4 (E Dorian Pentatonic: E, G, A, B, D)
    scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    padMidi: [52, 55, 59, 62],
  },
  coral_sea: {
    rootHz: 440.0, // A4 (A Major / Lydian Pentatonic: A, B, C#, E, F#)
    scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
    padMidi: [57, 61, 64, 68],
  },
  storm_ocean: {
    rootHz: 261.63, // C4 (C Minor9 / Eb Heroic Pentatonic: C, Eb, F, G, Bb)
    scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    padMidi: [48, 55, 60, 63],
  },
  warden_boss: {
    rootHz: 293.66, // D4 (D Minor / F Heroic Pentatonic: D, F, G, A, C)
    scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    padMidi: [50, 57, 62, 65],
  },
  core_descent: {
    rootHz: 440.0, // A4 (A Dorian / C Lydian Pentatonic: A, C, D, E, G)
    scale: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24],
    padMidi: [57, 60, 64, 67],
  },
});

const CROSSFADE_SECONDS = 2.0;

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function normalizeVolumeInput(v, fallback = 0.8) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1.001) return clamp(n / 100, 0, 1);
  return clamp(n, 0, 1);
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function resolveAudioAssetUrl(filename) {
  try {
    return new URL(`../assets/audio/${filename}`, import.meta.url).href;
  } catch {
    return `./assets/audio/${filename}`;
  }
}

/**
 * Equal-Power Cross-Fading AudioBuffer Deck (2.0s cos/sin cross-fade,
 * zero-gap loop wrap, bookmark phase preservation, and rapid-switch safety).
 */
class EqualPowerStemDeck {
  constructor(engine, getDestNode) {
    this.engine = engine;
    this.getDestNode = getDestNode;
    this.activeVoice = null; // { filename, src, gain, startedAt, startOffset, duration }
    this.fadingVoices = new Set();
    this.bookmarks = new Map();
    this.targetFilename = null;
    this.requestToken = 0;
  }

  _scheduleEqualPowerIn(gainParam, now, durationSec, peak = 1.0) {
    const dur = Math.max(0.08, durationSec);
    const steps = 8;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(0.0001, now);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const val = Math.max(0.0001, Math.sin(u * Math.PI * 0.5) * peak);
      gainParam.linearRampToValueAtTime(val, now + u * dur);
    }
  }

  _scheduleEqualPowerOut(voice, now, durationSec) {
    if (!voice || !this.engine.ctx) return;
    const dur = Math.max(0.08, durationSec);
    const gParam = voice.gain.gain;
    const startVal = Math.max(0.0001, gParam.value);
    const steps = 8;

    try {
      // Save playback phase bookmark so returning to this biome resumes musically mid-score
      if (voice.duration > 1) {
        const elapsed = Math.max(0, now - voice.startedAt);
        const pos = (voice.startOffset + elapsed) % voice.duration;
        this.bookmarks.set(voice.filename, pos);
      }

      gParam.cancelScheduledValues(now);
      gParam.setValueAtTime(startVal, now);
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const val = Math.max(0.0001, startVal * Math.cos(u * Math.PI * 0.5));
        gParam.linearRampToValueAtTime(val, now + u * dur);
      }
      voice.src.stop(now + dur + 0.05);
    } catch {
      // Ignore already-stopped source errors
    }

    this.fadingVoices.add(voice);
    voice.src.onended = () => {
      this.fadingVoices.delete(voice);
      try {
        voice.src.disconnect();
        voice.gain.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    };
  }

  transitionTo(filename, crossfadeSec = CROSSFADE_SECONDS, onStarted = null) {
    this.targetFilename = filename;
    const ctx = this.engine.ctx;
    const dest = this.getDestNode();
    if (!ctx || !dest || !filename) return;

    if (this.activeVoice && this.activeVoice.filename === filename) {
      if (onStarted) onStarted(true);
      return;
    }

    const token = ++this.requestToken;
    this.engine._loadAudioBuffer(filename).then((buffer) => {
      if (token !== this.requestToken || this.targetFilename !== filename) return;
      if (!this.engine.ctx || !buffer) return;
      if (this.activeVoice && this.activeVoice.filename === filename) {
        if (onStarted) onStarted(true);
        return;
      }

      const now = this.engine.ctx.currentTime;
      const hadPrevious = Boolean(this.activeVoice);
      if (this.activeVoice) {
        this._scheduleEqualPowerOut(this.activeVoice, now, crossfadeSec);
        this.activeVoice = null;
      }

      const src = this.engine.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const gain = this.engine.ctx.createGain();
      const fadeDur = hadPrevious ? crossfadeSec : Math.min(1.35, crossfadeSec);
      this._scheduleEqualPowerIn(gain.gain, now, fadeDur, 1.0);

      src.connect(gain);
      gain.connect(dest);

      const savedOffset = this.bookmarks.get(filename) ?? 0;
      const startOffset = buffer.duration > 0.5 ? savedOffset % buffer.duration : 0;
      src.start(now, startOffset);

      this.activeVoice = {
        filename,
        src,
        gain,
        startedAt: now,
        startOffset,
        duration: buffer.duration,
      };

      if (onStarted) onStarted(true);
    });
  }

  fadeOutAll(fadeSec = 0.75) {
    this.targetFilename = null;
    this.requestToken++;
    if (!this.activeVoice || !this.engine.ctx) {
      this.activeVoice = null;
      return;
    }
    const now = this.engine.ctx.currentTime;
    this._scheduleEqualPowerOut(this.activeVoice, now, fadeSec);
    this.activeVoice = null;
  }
}

export class SoundEngine {
  constructor() {
    // Public state & 3-Channel Independent Studio Mixer
    this.muted = false;
    this.musicEnabled = true;
    this.ambienceEnabled = true;
    this.sfxEnabled = true;
    this.musicActive = false;

    this.masterVolume = 0.92;
    this.musicVolume = 0.78;
    this.ambienceVolume = 0.72;
    this.sfxVolume = 0.82;

    // Context & biome tracking
    this.era = 'studio';
    this.towerId = 1;
    this.theme = 'canyon_river';
    this.biome = 'canyon_river';
    this.gameMode = 'campaign';
    this.bossActive = false;
    this.zenMode = false;
    this.miniGameMode = null;

    // Web Audio nodes & pre-allocated buffers
    this.ctx = null;
    this.masterGain = null;
    this.highpass = null;
    this.warmthFilter = null;
    this.antiFatigueLPF = null;
    this.limiter = null;

    this.reverb = null;
    this.reverbHPF = null;
    this.reverbLPF = null;

    this.musicBus = null;
    this.ambienceBus = null;
    this.sfxGain = null;
    this.sfxReverbGain = null;

    this._silentBuf = null;
    this._pinkNoiseBuf = null;
    this._softAirBuf = null;
    this._footstepVariations = null; // 6-variation organic round-robin footsteps
    this._footstepIdx = 0;

    // Decoded .ogg buffer cache & in-flight decode promises
    this._bufferCache = new Map();
    this._decodePromises = new Map();
    this._prefetchStarted = false;

    // Equal-power 2.0s cross-fading decks
    this._musicDeck = new EqualPowerStemDeck(this, () => this.musicBus);
    this._ambienceDeck = new EqualPowerStemDeck(this, () => this.ambienceBus);

    // Ultra-gentle warm breath pad fallback ONLY before initial .ogg finishes decoding
    this._fallbackPadTimer = null;
    this._musicBufferReady = false;

    // Continuous 60fps-safe updraft/dive wind bed (Frill-Glide / Core-Descent)
    this._windLevel = 0;
    this._glideWindNodes = null;

    this._unlockedOnce = false;
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
        if (document.visibilityState === 'visible' && !this.muted) {
          if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
            this.ctx.resume().catch(() => {});
          }
          this._syncPlayback();
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

    // 1. Studio Master Chain: Master Gain -> Sub HPF (30Hz) -> Warmth Trim -> Anti-Fatigue Silk LPF (5400Hz) -> Limiter
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;

    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 30;
    this.highpass.Q.value = 0.707;

    this.warmthFilter = ctx.createBiquadFilter();
    this.warmthFilter.type = 'peaking';
    this.warmthFilter.frequency.value = 270;
    this.warmthFilter.Q.value = 1.1;
    this.warmthFilter.gain.value = -1.4;

    this.antiFatigueLPF = ctx.createBiquadFilter();
    this.antiFatigueLPF.type = 'lowpass';
    this.antiFatigueLPF.frequency.value = 5400;
    this.antiFatigueLPF.Q.value = 0.62;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -9.5;
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.005;
    this.limiter.release.value = 0.16;

    this.masterGain.connect(this.highpass);
    this.highpass.connect(this.warmthFilter);
    this.warmthFilter.connect(this.antiFatigueLPF);
    this.antiFatigueLPF.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    // 2. Shared Organic Noise & 6-Variation Round-Robin Footstep Buffers (zero per-hit allocation)
    this._silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
    this._pinkNoiseBuf = this._createSeamlessPinkNoise(3.4);
    this._softAirBuf = this._createSilkyAirNoise(2.6);
    this._footstepVariations = this._createFootstepVariations();

    // 3. Lush Stereo Acoustic Canyon / Sanctuary Convolver for Organic Foley SFX
    this.reverbHPF = ctx.createBiquadFilter();
    this.reverbHPF.type = 'highpass';
    this.reverbHPF.frequency.value = 120;

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._createSanctuaryImpulse(1.35, 3.2);

    this.reverbLPF = ctx.createBiquadFilter();
    this.reverbLPF.type = 'lowpass';
    this.reverbLPF.frequency.value = 2350;

    this.reverbHPF.connect(this.reverb);
    this.reverb.connect(this.reverbLPF);
    this.reverbLPF.connect(this.masterGain);

    // 4. Independent 3-Channel Studio Mixer Buses (Music / Water Ambience / Organic SFX)
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.masterGain);

    this.ambienceBus = ctx.createGain();
    this.ambienceBus.connect(this.masterGain);

    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.masterGain);

    this.sfxReverbGain = ctx.createGain();
    this.sfxReverbGain.connect(this.reverbHPF);

    this._syncBusGains(true);
    this._scheduleBackgroundPrefetch();
  }

  _createSeamlessPinkNoise(seconds = 3.4) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const fade = Math.min(4096, Math.floor(len * 0.06));
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);

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
      data[i] = Math.max(-0.96, Math.min(0.96, pink));
    }
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      const tailIdx = len - fade + i;
      data[tailIdx] = data[tailIdx] * (1 - a) + data[i] * a;
    }
    return buf;
  }

  _createSilkyAirNoise(seconds = 2.6) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const fade = Math.min(3072, Math.floor(len * 0.06));
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    let lp1 = 0;
    let lp2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      lp1 = lp1 * 0.68 + w * 0.32;
      lp2 = lp2 * 0.62 + lp1 * 0.38;
      data[i] = lp2 * 1.35;
    }
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      const tailIdx = len - fade + i;
      data[tailIdx] = data[tailIdx] * (1 - a) + data[i] * a;
    }
    return buf;
  }

  _createSanctuaryImpulse(duration = 1.35, decay = 3.2) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const earlyTaps = [
      { sample: Math.floor(rate * 0.016), amp: 0.32 },
      { sample: Math.floor(rate * 0.029), amp: 0.25 },
      { sample: Math.floor(rate * 0.047), amp: 0.19 },
      { sample: Math.floor(rate * 0.071), amp: 0.14 },
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp = 0;
      let lp2 = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const onset = Math.min(1, i / (rate * 0.012));
        const env = onset * Math.pow(1 - t, decay);
        const white = Math.random() * 2 - 1;
        lp = lp * 0.66 + white * 0.34;
        lp2 = lp2 * 0.58 + lp * 0.42;
        data[i] = lp2 * env * 0.78;
      }
      for (const tap of earlyTaps) {
        const idx = tap.sample + ch * Math.floor(rate * 0.0035);
        if (idx + 12 < length) {
          const sign = ch === 0 ? 1 : -1;
          for (let k = 0; k < 12; k++) {
            const w = Math.sin((Math.PI * (k + 0.5)) / 12);
            data[idx + k] += sign * tap.amp * w * 0.24;
          }
        }
      }
    }
    return impulse;
  }

  /**
   * Pre-synthesizes 6 distinct organic wet-stone / weathered-timber footstep AudioBuffers
   * with subtle water-film brush & micro-droplet texture (zero clicks, zero synth beeps).
   */
  _createFootstepVariations() {
    const rate = this.ctx.sampleRate;
    const variations = [];
    const specs = [
      { stoneHz: 118, woodHz: 215, filmGain: 0.18, dropHz: 0 },
      { stoneHz: 134, woodHz: 248, filmGain: 0.22, dropHz: 590 },
      { stoneHz: 108, woodHz: 196, filmGain: 0.16, dropHz: 0 },
      { stoneHz: 142, woodHz: 262, filmGain: 0.24, dropHz: 710 },
      { stoneHz: 124, woodHz: 228, filmGain: 0.19, dropHz: 0 },
      { stoneHz: 114, woodHz: 206, filmGain: 0.21, dropHz: 640 },
    ];

    for (let v = 0; v < specs.length; v++) {
      const sp = specs[v];
      const dur = 0.095;
      const len = Math.floor(rate * dur);
      const buf = this.ctx.createBuffer(1, len, rate);
      const out = buf.getChannelData(0);

      let lpNoise = 0;
      let hpPrev = 0;
      let phaseStone = 0;
      let phaseWood = 0;
      let phaseDrop = 0;

      for (let i = 0; i < len; i++) {
        const t = i / rate;
        const att = 1 - Math.exp(-t / 0.0045);

        // Soft cushioned sole-on-wet-stone weight (decays smoothly in 36ms)
        const fStone = sp.stoneHz * (1 - 0.34 * Math.min(1, t / 0.045));
        phaseStone += (2 * Math.PI * fStone) / rate;
        const stone = Math.sin(phaseStone) * Math.exp(-t / 0.026) * 0.56;

        // Subtle hollow timber / slate body warmth
        phaseWood += (2 * Math.PI * sp.woodHz) / rate;
        const wood = Math.sin(phaseWood) * Math.exp(-t / 0.015) * 0.22;

        // Delicate wet water-film brush (band-limited 320-1150 Hz soft air/water)
        const white = Math.random() * 2 - 1;
        lpNoise = lpNoise * 0.76 + white * 0.24;
        const band = lpNoise - hpPrev * 0.91;
        hpPrev = lpNoise;
        const filmEnv = Math.sin(Math.PI * Math.min(1, t / 0.068)) * Math.exp(-t / 0.038);
        const film = band * filmEnv * sp.filmGain;

        // Occasional microscopic water-bead release on wet stairs
        let drop = 0;
        if (sp.dropHz > 0 && t > 0.014) {
          const td = t - 0.014;
          const fd = sp.dropHz * (1 + 0.18 * Math.min(1, td / 0.032));
          phaseDrop += (2 * Math.PI * fd) / rate;
          drop = Math.sin(phaseDrop) * Math.exp(-td / 0.018) * (1 - Math.exp(-td / 0.003)) * 0.09;
        }

        out[i] = (stone + wood + film + drop) * att;
      }
      variations.push(buf);
    }
    return variations;
  }

  async _loadAudioBuffer(filename) {
    if (!filename || !this.ctx) return null;
    if (this._bufferCache.has(filename)) {
      return this._bufferCache.get(filename);
    }
    if (this._decodePromises.has(filename)) {
      return this._decodePromises.get(filename);
    }

    const url = resolveAudioAssetUrl(filename);
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${filename}`);
        return res.arrayBuffer();
      })
      .then((arr) => this.ctx.decodeAudioData(arr))
      .then((audioBuf) => {
        this._bufferCache.set(filename, audioBuf);
        this._decodePromises.delete(filename);
        return audioBuf;
      })
      .catch(() => {
        this._decodePromises.delete(filename);
        return null;
      });

    this._decodePromises.set(filename, promise);
    return promise;
  }

  _scheduleBackgroundPrefetch() {
    if (this._prefetchStarted || typeof window === 'undefined') return;
    this._prefetchStarted = true;

    // Prioritize current biome's music + ambience immediately, then gently stage remaining stems
    const { musicFile, ambienceFile } = this._resolveDesiredStems();
    this._loadAudioBuffer(musicFile);
    this._loadAudioBuffer(ambienceFile);

    const allFiles = [
      ...new Set([...Object.values(MUSIC_STEMS), ...Object.values(AMBIENCE_STEMS)]),
    ];
    let idx = 0;
    const stepPrefetch = () => {
      if (idx >= allFiles.length) return;
      const nextFile = allFiles[idx++];
      if (this.ctx) {
        this._loadAudioBuffer(nextFile).finally(() => {
          setTimeout(stepPrefetch, 180);
        });
      }
    };
    setTimeout(stepPrefetch, 450);
  }

  _resolveDesiredStems() {
    const activeBiome = CANONICAL_BIOMES.includes(this.biome) ? this.biome : 'canyon_river';

    if (this.miniGameMode === 'core_descent') {
      return {
        harmonyKey: 'core_descent',
        musicFile: MUSIC_STEMS.core_descent,
        ambienceFile: AMBIENCE_STEMS.core_descent,
      };
    }
    if (this.miniGameMode === 'reef_swim') {
      return {
        harmonyKey: 'coral_sea',
        musicFile: MUSIC_STEMS.coral_sea,
        ambienceFile: AMBIENCE_STEMS.coral_sea,
      };
    }
    if (this.miniGameMode === 'rapids_surf') {
      return {
        harmonyKey: 'canyon_river',
        musicFile: MUSIC_STEMS.canyon_river,
        ambienceFile: AMBIENCE_STEMS.canyon_river,
      };
    }
    if (this.miniGameMode === 'frill_glide') {
      return {
        harmonyKey: 'alpine_lake',
        musicFile: MUSIC_STEMS.alpine_lake,
        ambienceFile: AMBIENCE_STEMS.alpine_lake,
      };
    }
    if (this.miniGameMode === 'aqueduct_sanctum') {
      return {
        harmonyKey: 'sanctum_menu',
        musicFile: MUSIC_STEMS.sanctum_menu,
        ambienceFile: AMBIENCE_STEMS.mist_bayou,
      };
    }

    if (
      this.bossActive ||
      this.gameMode === 'warden_gauntlet' ||
      this.theme === 'warden_boss'
    ) {
      return {
        harmonyKey: 'warden_boss',
        musicFile: MUSIC_STEMS.warden_boss,
        ambienceFile: AMBIENCE_STEMS[activeBiome] || AMBIENCE_STEMS.warden_boss,
      };
    }

    if (this.gameMode === 'flood_rush' || this.theme === 'core_descent') {
      return {
        harmonyKey: 'core_descent',
        musicFile: MUSIC_STEMS.core_descent,
        ambienceFile: AMBIENCE_STEMS[activeBiome] || AMBIENCE_STEMS.core_descent,
      };
    }

    if (this.theme === 'sanctum_menu') {
      return {
        harmonyKey: 'sanctum_menu',
        musicFile: MUSIC_STEMS.sanctum_menu,
        ambienceFile: AMBIENCE_STEMS.alpine_lake,
      };
    }

    if (this.zenMode || this.gameMode === 'sanctum_trials') {
      return {
        harmonyKey: 'sanctum_menu',
        musicFile: MUSIC_STEMS.sanctum_menu,
        ambienceFile: AMBIENCE_STEMS[activeBiome],
      };
    }

    return {
      harmonyKey: activeBiome,
      musicFile: MUSIC_STEMS[activeBiome],
      ambienceFile: AMBIENCE_STEMS[activeBiome],
    };
  }

  _getHarmonics() {
    const { harmonyKey } = this._resolveDesiredStems();
    return BIOME_HARMONICS[harmonyKey] || BIOME_HARMONICS.canyon_river;
  }

  _scaleFreq(degree = 0, octaveShift = 0) {
    const h = this._getHarmonics();
    const len = h.scale.length;
    const d = Math.max(0, Math.floor(Number(degree) || 0));
    const oct = Math.floor(d / len) + octaveShift;
    const semi = h.scale[d % len] + oct * 12;
    return clamp(h.rootHz * Math.pow(2, semi / 12), 55, 3800);
  }

  _syncBusGains(immediate = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const targetMaster = this.muted ? 0 : this.masterVolume;
    const targetMusic = !this.muted && this.musicEnabled ? this.musicVolume * 0.86 : 0;
    const targetAmb = !this.muted && this.ambienceEnabled ? this.ambienceVolume * 0.76 : 0;
    const targetSfxDry = !this.muted && this.sfxEnabled ? this.sfxVolume * 0.88 : 0;
    const targetSfxWet = !this.muted && this.sfxEnabled ? this.sfxVolume * 0.24 : 0;

    if (immediate) {
      this.masterGain.gain.setValueAtTime(targetMaster, now);
      this.musicBus.gain.setValueAtTime(targetMusic, now);
      this.ambienceBus.gain.setValueAtTime(targetAmb, now);
      this.sfxGain.gain.setValueAtTime(targetSfxDry, now);
      this.sfxReverbGain.gain.setValueAtTime(targetSfxWet, now);
    } else {
      this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.035);
      this.musicBus.gain.setTargetAtTime(targetMusic, now, 0.06);
      this.ambienceBus.gain.setTargetAtTime(targetAmb, now, 0.06);
      this.sfxGain.gain.setTargetAtTime(targetSfxDry, now, 0.035);
      this.sfxReverbGain.gain.setTargetAtTime(targetSfxWet, now, 0.04);
    }
  }

  // --- Public Lifecycle, Biome & 3-Channel Mixer API ---

  unlock() {
    this._initGraph();
    if (!this.ctx) return;

    if (!this._unlockedOnce && this._silentBuf) {
      try {
        const s = this.ctx.createBufferSource();
        s.buffer = this._silentBuf;
        s.connect(this.masterGain);
        s.start(0);
        this._unlockedOnce = true;
      } catch {
        // Ignore pre-resume restriction
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

  startMusic(themeOrMode = undefined) {
    if (typeof themeOrMode === 'string' && themeOrMode.trim()) {
      const key = themeOrMode.trim().toLowerCase();
      if (MINIGAME_ALIASES[key]) {
        this.miniGameMode = MINIGAME_ALIASES[key];
      } else {
        this.setTheme(key);
      }
    }
    this.musicActive = true;
    this.unlock();
    this._syncPlayback();
  }

  stopMusic() {
    this.setMusicActive(false);
  }

  playMenuMusic() {
    this.miniGameMode = null;
    this.setTheme('sanctum_menu');
    this.setMusicActive(true);
  }

  startMenuMusic() {
    this.playMenuMusic();
  }

  setEra(_era = 'studio') {
    this.era = 'studio';
    this._syncBusGains(false);
    this._syncPlayback();
  }

  setBiome(biome = 'canyon_river') {
    return this.setTheme(biome);
  }

  setTheme(themeOrTowerId = 'canyon_river', maybeTheme = undefined) {
    if (typeof themeOrTowerId === 'number') {
      return this.setTowerTheme(themeOrTowerId, maybeTheme);
    }
    const raw = String(themeOrTowerId || '').trim().toLowerCase();
    const mapped = THEME_TO_BIOME[raw];
    if (mapped) {
      this.theme = mapped;
      if (CANONICAL_BIOMES.includes(mapped)) {
        this.biome = mapped;
      }
    }
    this._syncPlayback();
    return this.theme;
  }

  setTowerTheme(towerId = 1, theme = undefined) {
    this.towerId = Math.max(1, Math.floor(Number(towerId) || 1));
    if (typeof theme === 'string' && THEME_TO_BIOME[theme.trim().toLowerCase()]) {
      const mapped = THEME_TO_BIOME[theme.trim().toLowerCase()];
      this.theme = mapped;
      if (CANONICAL_BIOMES.includes(mapped)) {
        this.biome = mapped;
      }
    } else {
      const actIdx = Math.min(
        CANONICAL_BIOMES.length - 1,
        Math.floor((this.towerId - 1) / 2)
      );
      this.biome = CANONICAL_BIOMES[actIdx];
      this.theme = this.biome;
    }
    this._syncPlayback();
    return this.theme;
  }

  setGameMode(mode = 'campaign') {
    if (typeof mode === 'string' && mode.trim()) {
      this.gameMode = mode.trim().toLowerCase();
      if (this.gameMode !== 'warden_gauntlet' && this.theme === 'warden_boss') {
        this.theme = this.biome;
      }
      this._syncPlayback();
    }
    return this.gameMode;
  }

  setBossActive(active = false) {
    const next = Boolean(active);
    if (this.bossActive === next) return this.bossActive;
    this.bossActive = next;
    this._syncPlayback();
    return this.bossActive;
  }

  setBossMode(active = false) {
    return this.setBossActive(active);
  }

  setZenMode(zen = false) {
    const next = Boolean(zen);
    if (this.zenMode === next) return;
    this.zenMode = next;
    this._syncPlayback();
  }

  setMiniGameMode(mode = null) {
    const raw = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    const next = raw && MINIGAME_ALIASES[raw] ? MINIGAME_ALIASES[raw] : null;
    if (this.miniGameMode === next) return;
    if (this.miniGameMode === 'frill_glide' && next !== 'frill_glide') {
      this.setWind(0);
    }
    this.miniGameMode = next;
    this._syncPlayback();
  }

  setMusicVolume(v) {
    this.musicVolume = normalizeVolumeInput(v, this.musicVolume);
    this._syncBusGains(false);
    this._syncPlayback();
    return this.musicVolume;
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  setAmbienceVolume(v) {
    this.ambienceVolume = normalizeVolumeInput(v, this.ambienceVolume);
    this._syncBusGains(false);
    this._syncPlayback();
    return this.ambienceVolume;
  }

  getAmbienceVolume() {
    return this.ambienceVolume;
  }

  setSfxVolume(v) {
    this.sfxVolume = normalizeVolumeInput(v, this.sfxVolume);
    this._syncBusGains(false);
    return this.sfxVolume;
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  setMasterVolume(v) {
    this.masterVolume = normalizeVolumeInput(v, this.masterVolume);
    this._syncBusGains(false);
    return this.masterVolume;
  }

  getMasterVolume() {
    return this.masterVolume;
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

  toggleAmbience() {
    return this.setAmbienceEnabled(!this.ambienceEnabled);
  }

  setAmbienceEnabled(enabled) {
    this.ambienceEnabled = Boolean(enabled);
    this._syncBusGains(false);
    this._syncPlayback();
    return this.ambienceEnabled;
  }

  toggleSfx() {
    return this.setSfxEnabled(!this.sfxEnabled);
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = Boolean(enabled);
    if (!this.sfxEnabled) this._stopGlideWind();
    this._syncBusGains(false);
    return this.sfxEnabled;
  }

  setMusicActive(active) {
    const next = Boolean(active);
    if (this.musicActive === next) return;
    this.musicActive = next;
    if (!this.musicActive) this._stopGlideWind();
    this._syncPlayback();
  }

  _syncPlayback() {
    if (!this.ctx || this.ctx.state !== 'running') {
      this._stopFallbackPad();
      return;
    }

    const { musicFile, ambienceFile } = this._resolveDesiredStems();
    const wantMusic = Boolean(
      this.musicActive && this.musicEnabled && !this.muted && this.musicVolume > 0.002
    );
    const wantAmbience = Boolean(
      this.musicActive && this.ambienceEnabled && !this.muted && this.ambienceVolume > 0.002
    );

    if (wantMusic) {
      if (!this._bufferCache.has(musicFile)) {
        this._musicBufferReady = false;
        this._startFallbackPad();
      } else {
        this._musicBufferReady = true;
        this._stopFallbackPad();
      }
      this._musicDeck.transitionTo(musicFile, CROSSFADE_SECONDS, () => {
        this._musicBufferReady = true;
        this._stopFallbackPad();
      });
    } else {
      this._stopFallbackPad();
      this._musicDeck.fadeOutAll(0.75);
    }

    if (wantAmbience) {
      this._ambienceDeck.transitionTo(ambienceFile, CROSSFADE_SECONDS);
    } else {
      this._ambienceDeck.fadeOutAll(0.85);
    }
  }

  // Ultra-gentle filtered warm pad ONLY during initial .ogg decode on slow connections
  _startFallbackPad() {
    if (this._fallbackPadTimer || this._musicBufferReady || !this.ctx || !this.musicBus) return;
    const playWarmBreath = () => {
      if (
        this._musicBufferReady ||
        !this.musicActive ||
        !this.musicEnabled ||
        this.muted ||
        !this.ctx ||
        this.ctx.state !== 'running'
      ) {
        this._stopFallbackPad();
        return;
      }
      const now = this.ctx.currentTime;
      const chord = this._getHarmonics().padMidi;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(410, now);
      lp.Q.value = 0.7;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.016, now + 0.9);
      env.gain.linearRampToValueAtTime(0.012, now + 2.2);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);

      lp.connect(env);
      env.connect(this.musicBus);

      const oscs = [];
      for (const m of chord) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(midiToHz(m), now);
        osc.connect(lp);
        osc.start(now);
        osc.stop(now + 3.45);
        oscs.push(osc);
      }
      if (oscs.length > 0) {
        oscs[0].onended = () => {
          for (const o of oscs) o.disconnect();
          lp.disconnect();
          env.disconnect();
        };
      }
    };

    playWarmBreath();
    this._fallbackPadTimer = setInterval(playWarmBreath, 2800);
  }

  _stopFallbackPad() {
    if (this._fallbackPadTimer) {
      clearInterval(this._fallbackPadTimer);
      this._fallbackPadTimer = null;
    }
  }

  // --- Organic Acoustic Foley Synthesis Primitives (Strictly Warm & Non-Fatiguing) ---

  _canPlay(key, minGap = 0.025) {
    if (this.muted || !this.sfxEnabled || this.sfxVolume <= 0.002 || !this.ctx || !this.sfxGain) {
      return false;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    const prev = this._lastTriggerMap.get(key) ?? -1;
    if (now - prev < minGap) return false;
    this._lastTriggerMap.set(key, now);
    return true;
  }

  _vary(freq, pct = 0.025) {
    return freq * (1 + (Math.random() * 2 - 1) * pct);
  }

  _connectSfx(node, sendReverb = true, pan = 0) {
    let outNode = node;
    if (pan !== 0 && this.ctx && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(pan, -0.75, 0.75), this.ctx.currentTime);
      node.connect(panner);
      outNode = panner;
    }
    if (this.sfxGain) outNode.connect(this.sfxGain);
    if (sendReverb && this.sfxReverbGain) outNode.connect(this.sfxReverbGain);
    return outNode !== node ? outNode : null;
  }

  /**
   * Warm acoustic Kalimba / Rosewood Marimba pluck (1.0 + 2.0 + soft damped 4.0 harmonic,
   * gentle 6ms rounded mallet/tine attack, capped strictly below 3,800 Hz).
   */
  _kalimbaChime(freq, duration = 0.34, gainVal = 0.052, delay = 0, pan = 0, sendReverb = true) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + Math.max(0, delay);
    const f0 = clamp(freq, 85, 2600);
    const dur = Math.max(0.08, duration);
    const peak = clamp(gainVal, 0.0002, 0.25);

    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(peak, now + 0.0065);
    out.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    const bodyLPF = this.ctx.createBiquadFilter();
    bodyLPF.type = 'lowpass';
    bodyLPF.frequency.setValueAtTime(Math.min(3600, f0 * 4.5), now);
    bodyLPF.Q.value = 0.75;

    bodyLPF.connect(out);
    const panner = this._connectSfx(out, sendReverb, pan);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f0 * 1.004, now);
    osc1.frequency.exponentialRampToValueAtTime(f0, now + 0.022);
    osc1.connect(bodyLPF);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(Math.min(3500, f0 * 2.0), now);
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.24, now);
    g2.gain.exponentialRampToValueAtTime(0.01, now + dur * 0.55);
    osc2.connect(g2);
    g2.connect(bodyLPF);

    osc1.onended = () => {
      osc1.disconnect();
      osc2.disconnect();
      g2.disconnect();
      bodyLPF.disconnect();
      out.disconnect();
      if (panner) panner.disconnect();
    };

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.025);
    osc2.stop(now + dur + 0.025);
  }

  /**
   * Physical Minnaert liquid water-droplet chime (upward spherical bubble resonance).
   */
  _waterDrop(freq, duration = 0.14, gainVal = 0.048, delay = 0, pan = 0, sendReverb = true) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + Math.max(0, delay);
    const f0 = clamp(freq, 180, 1950);
    const f1 = clamp(f0 * 1.32, 220, 2450);
    const dur = Math.max(0.05, duration);
    const peak = clamp(gainVal, 0.0002, 0.22);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(f1, now + dur * 0.82);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.0045);
    gain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    osc.connect(gain);
    const panner = this._connectSfx(gain, sendReverb, pan);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      if (panner) panner.disconnect();
    };
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /**
   * Soft low-passed sine/triangle cushion tone (pure warm acoustic waves only).
   */
  _warmBodyTone(
    freqStart,
    freqEnd,
    duration,
    gainVal = 0.08,
    delay = 0,
    wave = 'sine',
    cutoff = 1400,
    sendReverb = false,
    pan = 0
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + Math.max(0, delay);
    const dur = Math.max(0.025, duration);
    const f0 = clamp(freqStart, 28, 3200);
    const f1 = clamp(freqEnd, 28, 3200);
    const peak = clamp(gainVal, 0.0002, 0.28);

    const osc = this.ctx.createOscillator();
    osc.type = wave === 'triangle' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(f0, now);
    if (Math.abs(f1 - f0) > 0.2) {
      osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp(cutoff, 90, 3800), now);
    filter.Q.value = 0.75;

    const gain = this.ctx.createGain();
    const att = Math.min(0.014, dur * 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + att);
    gain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    const panner = this._connectSfx(gain, sendReverb, pan);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      if (panner) panner.disconnect();
    };
    osc.start(now);
    osc.stop(now + dur + 0.025);
  }

  /**
   * Silky contoured water/air whoosh using smoothed pink/velvet air buffer.
   */
  _silkyWhoosh(
    duration = 0.2,
    gainVal = 0.05,
    freqStart = 380,
    freqEnd = 960,
    Q = 1.15,
    delay = 0,
    pan = 0,
    sendReverb = true,
    usePink = false
  ) {
    const buf = usePink ? this._pinkNoiseBuf : this._softAirBuf;
    if (!this.ctx || !this.sfxGain || !buf) return;

    const now = this.ctx.currentTime + Math.max(0, delay);
    const dur = Math.min(Math.max(0.03, duration), buf.duration - 0.05);
    const peak = clamp(gainVal, 0.0002, 0.24);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(clamp(freqStart, 65, 3200), now);
    bp.frequency.exponentialRampToValueAtTime(clamp(freqEnd, 65, 3200), now + dur);
    bp.Q.value = clamp(Q, 0.4, 4.5);

    const gain = this.ctx.createGain();
    const att = Math.min(0.045, dur * 0.34);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + att);
    gain.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    src.connect(bp);
    bp.connect(gain);
    const panner = this._connectSfx(gain, sendReverb, pan);

    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      gain.disconnect();
      if (panner) panner.disconnect();
    };

    const offset = Math.random() * Math.max(0.01, buf.duration - dur - 0.04);
    src.start(now, offset, dur + 0.02);
  }

  // --- 6-Variation Organic Round-Robin Footsteps & Traversal Foley ---

  step(surface = 'stone') {
    if (!this._canPlay('step', 0.068)) return;
    if (!this._footstepVariations || this._footstepVariations.length === 0) return;

    // Non-repeating 6-variation round-robin index with gentle pitch & stereo variation
    const stepAdvance = Math.random() < 0.28 ? 2 : 1;
    this._footstepIdx = (this._footstepIdx + stepAdvance) % this._footstepVariations.length;
    const buf = this._footstepVariations[this._footstepIdx];

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const baseRate =
      surface === 'ice' || surface === 'crystal'
        ? 1.24
        : surface === 'wood'
        ? 1.08
        : surface === 'water'
        ? 0.92
        : 1.0;
    src.playbackRate.setValueAtTime(this._vary(baseRate, 0.045), now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this._vary(0.055, 0.08), now);

    const pan = (this._footstepIdx % 2 === 0 ? -0.07 : 0.07) + (Math.random() * 2 - 1) * 0.03;
    src.connect(gain);
    const panner = this._connectSfx(gain, false, pan);

    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      if (panner) panner.disconnect();
    };
    src.start(now);

    if (surface === 'water') {
      this._waterDrop(this._vary(540, 0.1), 0.085, 0.022, 0.01, pan, true);
    }
  }

  footstep(surface = 'stone') {
    this.step(surface);
  }

  stepUp(surface = 'stone') {
    // Smooth walkable stair tread step (soft stone/wood tap + whisper air brush, NEVER a synth beep!)
    this.step(surface);
    if (this._canPlay('stepAir', 0.09)) {
      this._silkyWhoosh(0.075, 0.016, 360, 680, 1.1, 0.005, 0, false, false);
    }
  }

  jump() {
    if (!this._canPlay('jump', 0.045)) return;
    // Soft wet-stone push-off + silky upward air/frill whoosh + delicate water-bead lift
    this._warmBodyTone(this._vary(132, 0.04), 58, 0.068, 0.068, 0, 'sine', 280, false);
    this._silkyWhoosh(0.17, 0.046, 290, 1080, 1.15, 0.006, 0, true, false);
    this._waterDrop(this._scaleFreq(2, 0), 0.11, 0.024, 0.015, 0.06, true);
  }

  doubleJump() {
    if (!this._canPlay('doubleJump', 0.045)) return;
    this._silkyWhoosh(0.21, 0.054, 380, 1380, 1.2, 0, 0, true, true);
    this._waterDrop(this._scaleFreq(4, 0), 0.12, 0.034, 0.008, -0.08, true);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.24, 0.032, 0.03, 0.08, true);
  }

  land(intensity = 0.6) {
    if (!this._canPlay('land', 0.045)) return;
    const imp = clamp(intensity, 0.15, 1.0);
    this._warmBodyTone(
      this._vary(108, 0.05),
      40,
      0.09,
      0.048 + imp * 0.052,
      0,
      'sine',
      240,
      false
    );
    this._silkyWhoosh(0.085, 0.018 + imp * 0.024, 520, 210, 1.0, 0.004, 0, true, true);
    if (imp > 0.62) {
      this._waterDrop(this._vary(480, 0.09), 0.08, 0.018 * imp, 0.012, 0, true);
    }
  }

  geckoClimb() {
    if (!this._canPlay('geckoClimb', 0.075)) return;
    this._warmBodyTone(this._vary(195, 0.06), 115, 0.045, 0.032, 0, 'sine', 420, false);
    this._waterDrop(this._vary(690, 0.08), 0.065, 0.018, 0.006, 0, false);
  }

  wallScamper() {
    this.geckoClimb();
  }

  grappleSwing() {
    if (!this._canPlay('grappleSwing', 0.07)) return;
    this._warmBodyTone(168, 92, 0.08, 0.058, 0, 'sine', 340, false);
    this._silkyWhoosh(0.28, 0.058, 280, 1240, 1.25, 0.01, 0, true, false);
    this._kalimbaChime(this._scaleFreq(3, 0), 0.32, 0.042, 0.02, 0.12, true);
  }

  grapple() {
    this.grappleSwing();
  }

  // --- Gateway Abilities & Combat (Hydro-Pulse, Tail-Whip, Sea-Glass Bubbles) ---

  tailWhip() {
    if (!this._canPlay('tailWhip', 0.055)) return;
    // Supple 360-degree Lizard Tail-Whip: stereo silky water-ribbon swoosh + liquid scatter
    this._warmBodyTone(this._vary(158, 0.04), 66, 0.095, 0.068, 0, 'sine', 320, false);
    this._silkyWhoosh(0.22, 0.062, 260, 1280, 1.15, 0, -0.25, true, false);
    this._silkyWhoosh(0.18, 0.045, 1180, 380, 1.2, 0.05, 0.28, true, true);
    this._waterDrop(this._scaleFreq(2, 0), 0.11, 0.03, 0.035, -0.15, true);
    this._waterDrop(this._scaleFreq(4, 0), 0.12, 0.026, 0.075, 0.18, true);
  }

  whip() {
    this.tailWhip();
  }

  shoot() {
    if (!this._canPlay('shoot', 0.04)) return;
    // Pressurized liquid Hydro-Pulse orb (soft water release + harmonic droplet, zero laser buzz)
    this._warmBodyTone(this._vary(186, 0.04), 76, 0.07, 0.064, 0, 'sine', 380, false);
    this._silkyWhoosh(0.11, 0.034, 480, 1180, 1.4, 0.004, 0, true, true);
    this._waterDrop(this._scaleFreq(3, 0), 0.14, 0.042, 0.008, 0, true);
  }

  hydroPulse() {
    this.shoot();
  }

  snowball() {
    this.shoot();
  }

  bubble() {
    if (!this._canPlay('bubble', 0.04)) return;
    this._warmBodyTone(128, 62, 0.065, 0.048, 0, 'sine', 260, false);
    this._waterDrop(this._vary(380, 0.08), 0.13, 0.05, 0.005, -0.06, true);
    this._waterDrop(this._vary(590, 0.08), 0.11, 0.032, 0.038, 0.08, true);
  }

  sonarPing() {
    if (!this._canPlay('sonarPing', 0.12)) return;
    const f = this._scaleFreq(5, 0);
    this._kalimbaChime(f, 0.62, 0.048, 0, 0, true);
    this._kalimbaChime(f * 1.5, 0.55, 0.026, 0.08, 0.18, true);
  }

  subSurface() {
    if (!this._canPlay('subSurface', 0.08)) return;
    this._silkyWhoosh(0.26, 0.048, 320, 960, 1.1, 0, 0, true, true);
    this._waterDrop(460, 0.12, 0.035, 0.04, 0, true);
  }

  hit() {
    if (!this._canPlay('hit', 0.035)) return;
    this._warmBodyTone(this._vary(168, 0.05), 42, 0.16, 0.11, 0, 'sine', 340, true);
    this._silkyWhoosh(0.14, 0.048, 920, 280, 1.2, 0.005, 0, true, true);
    this._kalimbaChime(this._scaleFreq(0, 0), 0.18, 0.04, 0.01, 0, true);
  }

  hitEnemy() {
    this.hit();
  }

  subHit() {
    this.hit();
  }

  stunEnemy() {
    if (!this._canPlay('stunEnemy', 0.035)) return;
    // Swirling Sea-Glass Hydro-Bubble encase chime
    this._waterDrop(this._scaleFreq(2, 0), 0.14, 0.044, 0, -0.1, true);
    this._kalimbaChime(this._scaleFreq(4, 0), 0.28, 0.046, 0.035, 0.1, true);
    this._silkyWhoosh(0.14, 0.028, 620, 1420, 1.5, 0.01, 0, true, false);
  }

  crabFlip() {
    if (!this._canPlay('crabFlip', 0.05)) return;
    this._warmBodyTone(145, 86, 0.11, 0.075, 0, 'sine', 380, false);
    this._kalimbaChime(this._scaleFreq(1, 0), 0.22, 0.046, 0.015, -0.08, true);
    this._kalimbaChime(this._scaleFreq(3, 0), 0.26, 0.048, 0.06, 0.08, true);
  }

  springBounce() {
    if (!this._canPlay('springBounce', 0.05)) return;
    this._warmBodyTone(118, 245, 0.16, 0.082, 0, 'sine', 560, true);
    this._silkyWhoosh(0.22, 0.048, 320, 1280, 1.2, 0.01, 0, true, false);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.3, 0.045, 0.02, 0, true);
  }

  deflect() {
    if (!this._canPlay('deflect', 0.035)) return;
    this._waterDrop(this._scaleFreq(4, 0), 0.12, 0.042, 0, -0.08, true);
    this._kalimbaChime(this._scaleFreq(6, 0), 0.22, 0.04, 0.025, 0.08, true);
  }

  hitBlock() {
    if (!this._canPlay('hitBlock', 0.035)) return;
    this._warmBodyTone(148, 48, 0.13, 0.095, 0, 'sine', 320, true);
    this._silkyWhoosh(0.12, 0.042, 780, 260, 1.15, 0.005, 0, true, true);
  }

  crumble() {
    if (!this._canPlay('crumble', 0.05)) return;
    this._warmBodyTone(this._vary(96, 0.05), 36, 0.24, 0.095, 0, 'sine', 240, true);
    this._silkyWhoosh(0.26, 0.058, 680, 170, 0.95, 0.01, 0, true, true);
    this._kalimbaChime(196, 0.09, 0.024, 0.05, -0.14, false);
    this._kalimbaChime(165, 0.09, 0.02, 0.11, 0.14, false);
  }

  splash() {
    if (!this._canPlay('splash', 0.07)) return;
    this._warmBodyTone(138, 38, 0.26, 0.11, 0, 'sine', 280, true);
    this._silkyWhoosh(0.42, 0.085, 1180, 240, 0.95, 0, 0, true, true);
    this._waterDrop(this._vary(390, 0.08), 0.11, 0.038, 0.06, -0.18, true);
    this._waterDrop(this._vary(520, 0.08), 0.1, 0.034, 0.13, 0.16, true);
    this._waterDrop(this._vary(680, 0.08), 0.095, 0.028, 0.21, -0.08, true);
  }

  hurt() {
    if (!this._canPlay('hurt', 0.08)) return;
    const scale = this.zenMode ? 0.65 : 1.0;
    // Soft muffled water-impact thud (warm low-passed resonance)
    this._warmBodyTone(162, 44, 0.24, 0.11 * scale, 0, 'sine', 280, true);
    this._warmBodyTone(240, 110, 0.2, 0.055 * scale, 0.015, 'triangle', 480, true);
    this._silkyWhoosh(0.18, 0.045 * scale, 640, 180, 1.0, 0, 0, true, true);
  }

  jellyZap() {
    if (!this._canPlay('jellyZap', 0.07)) return;
    this._warmBodyTone(220, 96, 0.22, 0.075, 0, 'triangle', 680, true);
    this._waterDrop(340, 0.12, 0.035, 0.03, 0, true);
  }

  // --- Biome-Tuned Kalimba & Water-Drop Pickups, Valves & Sanctum Puzzles ---

  pickup(step = 0) {
    if (!this._canPlay('pickup', 0.025)) return;
    const deg = clamp(Math.floor(Number(step) || 0), 0, 10);
    const f = this._scaleFreq(deg, 0);
    this._kalimbaChime(this._vary(f, 0.008), 0.3, 0.05, 0, 0, true);
    this._waterDrop(Math.min(1800, f * 1.5), 0.1, 0.022, 0.015, 0.1, true);
  }

  collect(step = 0) {
    this.pickup(step);
  }

  collectGear() {
    if (!this._canPlay('collectGear', 0.032)) return;
    const f1 = this._scaleFreq(2, 0);
    const f2 = this._scaleFreq(4, 0);
    this._waterDrop(f1, 0.11, 0.036, 0, -0.08, true);
    this._kalimbaChime(f2, 0.32, 0.052, 0.045, 0.08, true);
  }

  collectStar() {
    if (!this._canPlay('collectStar', 0.08)) return;
    // Warm 5-note biome-scale kalimba & felt-bell bloom
    const degrees = [0, 2, 3, 5, 7];
    this._warmBodyTone(this._scaleFreq(0, -1), this._scaleFreq(0, -1), 0.55, 0.055, 0, 'sine', 420, true);
    degrees.forEach((d, i) => {
      const f = this._scaleFreq(d, 0);
      const pan = -0.24 + i * 0.12;
      this._kalimbaChime(f, 0.44, 0.048, i * 0.062, pan, true);
    });
  }

  catchFish() {
    if (!this._canPlay('catchFish', 0.04)) return;
    // Joyful freed wildlife / reef school warm water-chime arpeggio
    this._waterDrop(420, 0.11, 0.04, 0, -0.1, true);
    [0, 2, 4, 5].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.3, 0.044, 0.02 + idx * 0.048, (idx - 1.5) * 0.1, true);
    });
  }

  rescueCreature() {
    this.catchFish();
  }

  critterRescue() {
    if (!this._canPlay('critterRescue', 0.08)) return;
    // Joyful hidden Earth Water-Critter pod release: ascending water-droplet & kalimba bloom
    this._waterDrop(this._scaleFreq(2, 0), 0.11, 0.04, 0, -0.14, true);
    [0, 2, 4, 5, 7].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.36, 0.046, 0.02 + idx * 0.052, (idx - 2) * 0.1, true);
    });
  }

  pipeValve() {
    if (!this._canPlay('pipeValve', 0.05)) return;
    // Tactile brass rotary valve turn + warm hydro conduit surge + two-note scale confirmation
    this._warmBodyTone(156, 84, 0.085, 0.062, 0, 'sine', 340, false);
    this._silkyWhoosh(0.24, 0.042, 260, 740, 1.3, 0.02, 0, true, true);
    this._kalimbaChime(this._scaleFreq(1, 0), 0.24, 0.04, 0.025, -0.08, true);
    this._kalimbaChime(this._scaleFreq(3, 0), 0.3, 0.044, 0.075, 0.08, true);
  }

  valveTurn() {
    this.pipeValve();
  }

  switchToggle() {
    if (!this._canPlay('switchToggle', 0.032)) return;
    // Gentle tactile wooden/brass tap + soft two-note harmonic (soothing in both gameplay & menus!)
    this._warmBodyTone(165, 92, 0.055, 0.042, 0, 'sine', 320, false);
    this._kalimbaChime(this._scaleFreq(2, 0), 0.18, 0.034, 0.01, -0.05, true);
    this._kalimbaChime(this._scaleFreq(4, 0), 0.22, 0.036, 0.045, 0.05, true);
  }

  steamBurst() {
    if (!this._canPlay('steamBurst', 0.06)) return;
    this._warmBodyTone(185, 68, 0.11, 0.068, 0, 'sine', 340, false);
    this._silkyWhoosh(0.32, 0.065, 980, 380, 1.05, 0.01, 0, true, true);
    this._waterDrop(520, 0.1, 0.028, 0.03, 0, true);
  }

  geyserBurst() {
    this.steamBurst();
  }

  door() {
    if (!this._canPlay('door', 0.06)) return;
    const root = this._scaleFreq(0, -1);
    this._warmBodyTone(root, root * 0.75, 0.28, 0.065, 0, 'triangle', 520, true);
    this._silkyWhoosh(0.28, 0.038, 320, 820, 1.35, 0, 0, true, true);
    this._kalimbaChime(this._scaleFreq(0, 0), 0.32, 0.04, 0.03, -0.1, true);
    this._kalimbaChime(this._scaleFreq(3, 0), 0.36, 0.038, 0.09, 0.1, true);
  }

  elevator() {
    if (!this._canPlay('elevator', 0.05)) return;
    this._warmBodyTone(142, 196, 0.16, 0.052, 0, 'triangle', 480, true);
    this._kalimbaChime(this._scaleFreq(0, 0), 0.2, 0.035, 0.015, 0, true);
  }

  timerTick(urgent = false) {
    if (!this._canPlay('timerTick', 0.18)) return;
    const deg = urgent ? 4 : 2;
    this._kalimbaChime(this._scaleFreq(deg, 0), 0.12, urgent ? 0.032 : 0.022, 0, 0, false);
  }

  pistonWarn() {
    if (!this._canPlay('pistonWarn', 0.09)) return;
    this._kalimbaChime(this._scaleFreq(3, 0), 0.15, 0.034, 0, 0, true);
  }

  thunderCrack() {
    if (!this._canPlay('thunderCrack', 0.16)) return;
    // Deep distant rolling polar thunder (< 950 Hz warm oceanic rumble, zero harsh crack!)
    this._warmBodyTone(72, 30, 0.88, 0.105, 0.02, 'sine', 180, true);
    this._silkyWhoosh(0.92, 0.088, 420, 85, 0.85, 0, 0, true, true);
  }

  thunderClap() {
    this.thunderCrack();
  }

  boostGate(mult = 1) {
    if (!this._canPlay('boostGate', 0.05)) return;
    const m = Math.round(clamp(mult, 1, 4)) - 1;
    this._silkyWhoosh(0.24, 0.048, 360, 1280, 1.25, 0, 0, true, false);
    this._kalimbaChime(this._scaleFreq(m, 0), 0.28, 0.045, 0, -0.12, true);
    this._kalimbaChime(this._scaleFreq(m + 2, 0), 0.32, 0.045, 0.04, 0.12, true);
    this._kalimbaChime(this._scaleFreq(m + 4, 0), 0.36, 0.042, 0.08, 0, true);
  }

  // --- Frill-Glide & Canyon Wind Foley ---

  setWind(level = 0) {
    const w = clamp(level, 0, 1);
    this._windLevel = w;

    if (
      w <= 0.005 ||
      this.muted ||
      !this.sfxEnabled ||
      this.sfxVolume <= 0.002 ||
      !this.ctx ||
      !this.sfxGain ||
      !this._softAirBuf
    ) {
      this._stopGlideWind();
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const targetFreq = 240 + w * 640;
    const targetQ = 1.45 - w * 0.45;
    const targetGain = w * 0.052;

    if (!this._glideWindNodes) {
      const src = this.ctx.createBufferSource();
      src.buffer = this._softAirBuf;
      src.loop = true;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(targetFreq, now);
      bp.Q.setValueAtTime(targetQ, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setTargetAtTime(targetGain, now, 0.08);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.sfxGain);
      if (this.sfxReverbGain) gain.connect(this.sfxReverbGain);

      src.start(now, Math.random() * 1.2);
      this._glideWindNodes = { src, bp, gain };
    } else {
      const n = this._glideWindNodes;
      n.bp.frequency.setTargetAtTime(targetFreq, now, 0.06);
      n.bp.Q.setTargetAtTime(targetQ, now, 0.06);
      n.gain.gain.setTargetAtTime(targetGain, now, 0.06);
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
      n.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      n.src.stop(now + 0.11);
      n.src.onended = () => {
        try {
          n.src.disconnect();
          n.bp.disconnect();
          n.gain.disconnect();
        } catch {
          // Ignore teardown errors
        }
      };
    } catch {
      // Ignore
    }
  }

  glideFlap() {
    if (!this._canPlay('glideFlap', 0.065)) return;
    // Iridescent webbed frill flare catching warm canyon thermal air
    this._warmBodyTone(124, 58, 0.12, 0.068, 0, 'sine', 240, false);
    this._silkyWhoosh(0.24, 0.056, 240, 880, 1.05, 0.008, 0, true, false);
    this._kalimbaChime(this._scaleFreq(2, 0), 0.24, 0.028, 0.02, 0, true);
  }

  ringChime(step = 0) {
    if (!this._canPlay('ringChime', 0.03)) return;
    const k = clamp(Math.floor(Number(step) || 0), 0, 10);
    const f = this._scaleFreq(k, 0);
    this._kalimbaChime(f, 0.45, 0.05, 0, -0.1, true);
    this._kalimbaChime(Math.min(2600, f * 1.498), 0.42, 0.036, 0.055, 0.12, true);
    this._silkyWhoosh(0.22, 0.028, 520, 1480, 1.25, 0, 0, true, false);
  }

  gust() {
    if (!this._canPlay('gust', 0.08)) return;
    this._silkyWhoosh(0.34, 0.054, 260, 960, 1.35, 0, 0, true, false);
  }

  glideWhoosh() {
    if (!this._canPlay('glideWhoosh', 0.06)) return;
    this._silkyWhoosh(0.24, 0.048, 380, 1280, 1.3, 0, 0, true, false);
  }

  whoosh() {
    this.glideWhoosh();
  }

  nearMiss() {
    this.glideWhoosh();
  }

  // --- Aqueduct Sanctum & Vault Harmonic Cues ---

  puzzleEnter() {
    if (!this._canPlay('puzzleEnter', 0.12)) return;
    this._silkyWhoosh(0.45, 0.048, 220, 540, 1.1, 0, 0, true, true);
    this._warmBodyTone(74, 44, 0.36, 0.085, 0.12, 'sine', 200, true);
    [0, 2, 4].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, -1), 0.65, 0.036, 0.14 + idx * 0.06, (idx - 1) * 0.15, true);
    });
  }

  puzzleLeave() {
    if (!this._canPlay('puzzleLeave', 0.1)) return;
    this._silkyWhoosh(0.38, 0.042, 320, 1120, 1.15, 0, 0, true, false);
    this._kalimbaChime(this._scaleFreq(2, 0), 0.36, 0.038, 0.05, -0.08, true);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.42, 0.04, 0.11, 0.08, true);
  }

  puzzleTile(lit = 1) {
    const isLit = Boolean(lit);
    if (!this._canPlay(isLit ? 'puzzleTileOn' : 'puzzleTileOff', 0.03)) return;
    this._warmBodyTone(136, 68, 0.07, 0.055, 0, 'sine', 260, false);
    if (isLit) {
      this._kalimbaChime(this._scaleFreq(3, 0), 0.28, 0.046, 0.012, 0, true);
    } else {
      this._kalimbaChime(this._scaleFreq(0, 0), 0.2, 0.034, 0.012, 0, true);
    }
  }

  puzzleBell(semitone = 0) {
    const semi = clamp(Number(semitone) || 0, -12, 24);
    if (!this._canPlay(`puzzleBell_${semi}`, 0.025)) return;
    const f = 392.0 * Math.pow(2, semi / 12);
    // Warm water-sanctuary bronze & glass bowl resonance
    this._kalimbaChime(f, 0.88, 0.058, 0, 0, true);
    this._warmBodyTone(f * 0.5, f * 0.5, 0.85, 0.036, 0, 'sine', 900, true);
    this._waterDrop(Math.min(1850, f * 1.5), 0.14, 0.024, 0.01, 0.12, true);
  }

  puzzleNote(semitone = 0) {
    this.puzzleBell(semitone);
  }

  puzzleMirror() {
    if (!this._canPlay('puzzleMirror', 0.035)) return;
    this._warmBodyTone(185, 112, 0.055, 0.038, 0, 'sine', 380, false);
    this._kalimbaChime(this._scaleFreq(4, 0), 0.26, 0.04, 0.02, 0, true);
  }

  puzzleBlock() {
    if (!this._canPlay('puzzleBlock', 0.05)) return;
    this._silkyWhoosh(0.2, 0.052, 240, 440, 1.1, 0, 0, true, true);
    this._warmBodyTone(88, 54, 0.15, 0.075, 0.12, 'sine', 220, false);
  }

  puzzlePlate() {
    if (!this._canPlay('puzzlePlate', 0.05)) return;
    this._warmBodyTone(96, 58, 0.22, 0.082, 0, 'sine', 240, true);
    [0, 2, 5].forEach((d, i) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.36, 0.042, 0.04 + i * 0.06, (i - 1) * 0.12, true);
    });
  }

  puzzleUndo() {
    if (!this._canPlay('puzzleUndo', 0.04)) return;
    this._silkyWhoosh(0.18, 0.036, 980, 380, 1.2, 0, 0, true, false);
    this._kalimbaChime(this._scaleFreq(3, 0), 0.18, 0.032, 0, 0.06, true);
    this._kalimbaChime(this._scaleFreq(1, 0), 0.22, 0.032, 0.045, -0.06, true);
  }

  puzzleWrong() {
    if (!this._canPlay('puzzleWrong', 0.06)) return;
    this._warmBodyTone(146, 98, 0.22, 0.058, 0, 'sine', 360, true);
    this._kalimbaChime(220, 0.24, 0.032, 0.04, 0, true);
  }

  puzzleBump() {
    if (!this._canPlay('puzzleBump', 0.05)) return;
    this._warmBodyTone(112, 68, 0.08, 0.052, 0, 'sine', 240, false);
  }

  puzzleSolve() {
    if (!this._canPlay('puzzleSolve', 0.15)) return;
    const run = [0, 1, 2, 3, 4, 5, 7];
    run.forEach((deg, idx) => {
      this._kalimbaChime(
        this._scaleFreq(deg, 0),
        0.62,
        0.046,
        idx * 0.068,
        -0.25 + idx * 0.08,
        true
      );
    });
    const bloomAt = run.length * 0.068;
    this._warmBodyTone(this._scaleFreq(0, -1), this._scaleFreq(0, -1), 0.95, 0.075, bloomAt, 'sine', 420, true);
  }

  vaultTick(locked = false) {
    if (!this._canPlay(locked ? 'vaultLock' : 'vaultTick', 0.03)) return;
    if (!locked) {
      this._warmBodyTone(196, 110, 0.065, 0.046, 0, 'sine', 360, false);
      this._kalimbaChime(this._scaleFreq(1, 0), 0.14, 0.03, 0.008, 0, false);
    } else {
      this._warmBodyTone(158, 72, 0.085, 0.068, 0, 'sine', 320, false);
      this._kalimbaChime(this._scaleFreq(2, 0), 0.24, 0.044, 0.015, -0.08, true);
      this._kalimbaChime(this._scaleFreq(5, 0), 0.32, 0.048, 0.06, 0.08, true);
    }
  }

  vaultUnlock() {
    if (!this._canPlay('vaultUnlock', 0.1)) return;
    this._warmBodyTone(124, 48, 0.26, 0.085, 0, 'sine', 280, true);
    this._silkyWhoosh(0.24, 0.042, 340, 880, 1.2, 0.01, 0, true, true);
    [0, 2, 3, 5, 6, 8].forEach((deg, idx) => {
      this._kalimbaChime(
        this._scaleFreq(deg, 0),
        0.48,
        0.048,
        0.035 + idx * 0.058,
        -0.22 + idx * 0.09,
        true
      );
    });
  }

  vaultFail() {
    if (!this._canPlay('vaultFail', 0.05)) return;
    // Soft, gentle wooden/stone settle (warm low-passed resonance)
    this._warmBodyTone(196, 138, 0.14, 0.044, 0, 'sine', 420, false);
    this._warmBodyTone(138, 104, 0.18, 0.038, 0.065, 'triangle', 360, true);
  }

  // --- Reactor Core Descent, Spire Purification & Celebrations ---

  coreLockBreak(idx = 0) {
    if (!this._canPlay('coreLockBreak', 0.06)) return;
    const base = clamp(Math.floor(Number(idx) || 0), 0, 4);
    this._warmBodyTone(154, 48, 0.2, 0.095, 0, 'sine', 320, true);
    this._silkyWhoosh(0.28, 0.055, 440, 1360, 1.2, 0, 0, true, true);
    this._kalimbaChime(this._scaleFreq(base + 2, 0), 0.36, 0.05, 0.015, -0.14, true);
    this._kalimbaChime(this._scaleFreq(base + 4, 0), 0.42, 0.05, 0.06, 0.14, true);
  }

  spirePurify() {
    if (!this._canPlay('spirePurify', 0.2)) return;
    // Majestic Spire Purification: deep healing water surge + warm 5-voice cathedral harmonic bloom
    this._warmBodyTone(86, 34, 1.15, 0.125, 0, 'sine', 220, true);
    this._silkyWhoosh(1.15, 0.085, 280, 980, 0.9, 0.02, 0, true, true);
    const progression = [
      { degs: [0, 2, 4], delay: 0.06, dur: 0.42 },
      { degs: [1, 3, 5], delay: 0.30, dur: 0.42 },
      { degs: [2, 4, 6], delay: 0.54, dur: 0.45 },
      { degs: [0, 2, 4, 5, 7], delay: 0.80, dur: 0.88 },
    ];
    for (const step of progression) {
      step.degs.forEach((d, idx) => {
        const f = this._scaleFreq(d, 0);
        const pan = (idx - (step.degs.length - 1) * 0.5) * 0.16;
        this._kalimbaChime(f, step.dur, 0.042, step.delay, pan, true);
        this._warmBodyTone(f * 0.5, f * 0.5, step.dur, 0.024, step.delay, 'triangle', 950, true, pan);
      });
    }
  }

  coreSeed() {
    this.spirePurify();
  }

  victory() {
    this.spirePurify();
  }

  towerTopple() {
    this.spirePurify();
  }

  mutationPick() {
    if (!this._canPlay('mutationPick', 0.08)) return;
    this._silkyWhoosh(0.26, 0.042, 340, 1120, 1.2, 0, 0, true, false);
    [0, 2, 4, 7].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.38, 0.046, idx * 0.052, (idx - 1.5) * 0.12, true);
    });
  }

  extraLife() {
    if (!this._canPlay('extraLife', 0.1)) return;
    [0, 2, 4, 5, 7, 9].forEach((d, idx) => {
      const f = this._scaleFreq(d, 0);
      this._kalimbaChime(f, 0.42, 0.048, idx * 0.062, -0.2 + idx * 0.08, true);
    });
  }

  trophyUnlock() {
    if (!this._canPlay('trophyUnlock', 0.12)) return;
    [0, 2, 4, 6, 8].forEach((d, idx) => {
      const f = this._scaleFreq(d, 0);
      this._kalimbaChime(f, 0.46, 0.048, idx * 0.062, -0.2 + idx * 0.1, true);
      this._warmBodyTone(f * 0.5, f * 0.5, 0.36, 0.024, idx * 0.062, 'triangle', 1100, true);
    });
  }

  secret() {
    if (!this._canPlay('secret', 0.08)) return;
    [1, 3, 4, 6, 8].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.4, 0.044, idx * 0.055, (idx - 2) * 0.1, true);
    });
  }

  gatewayCheer() {
    if (!this._canPlay('gatewayCheer', 0.12)) return;
    // Expressive gentle aquatic trill + crystal droplet sparkle
    this._warmBodyTone(420, 590, 0.11, 0.046, 0, 'sine', 1400, true, -0.06);
    this._warmBodyTone(560, 780, 0.15, 0.05, 0.11, 'sine', 1600, true, 0.06);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.3, 0.036, 0.13, 0, true);
  }

  cheer() {
    this.gatewayCheer();
  }

  uiTap() {
    if (!this._canPlay('uiTap', 0.02)) return;
    this._waterDrop(this._scaleFreq(3, 0), 0.075, 0.028, 0, 0, false);
  }

  uiOpen() {
    if (!this._canPlay('uiOpen', 0.03)) return;
    this._kalimbaChime(this._scaleFreq(2, 0), 0.16, 0.03, 0, -0.05, true);
    this._kalimbaChime(this._scaleFreq(4, 0), 0.2, 0.032, 0.04, 0.05, true);
  }

  uiBack() {
    if (!this._canPlay('uiBack', 0.025)) return;
    this._kalimbaChime(this._scaleFreq(2, 0), 0.12, 0.028, 0, 0.04, false);
    this._kalimbaChime(this._scaleFreq(0, 0), 0.15, 0.028, 0.042, -0.04, false);
  }
}

export const sound = new SoundEngine();
