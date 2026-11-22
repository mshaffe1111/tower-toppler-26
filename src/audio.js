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

// Aqueduct Sanctum Bronze Temple Bell Pentatonic Tuning (C5, D5, E5, G5, A5)
// Distinct, warm, resonant harmonic intervals with zero harsh >5kHz buzz.
const TEMPLE_BELL_PENTATONIC_HZ = Object.freeze([
  523.25, // 0: C5 (Coral)
  587.33, // 1: D5 (Gold)
  659.25, // 2: E5 (Emerald)
  783.99, // 3: G5 (Azure)
  880.00, // 4: A5 (Violet)
]);
const TEMPLE_BELL_SEMITONES = Object.freeze([0, 2, 4, 7, 9]);

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
    this.playbackRate = 1.0;
  }

  setPlaybackRate(rate = 1.0, rampSec = 0.45) {
    const clamped = clamp(rate, 0.82, 1.18);
    this.playbackRate = clamped;
    const ctx = this.engine.ctx;
    if (!ctx || ctx.state !== 'running' || !this.activeVoice?.src?.playbackRate) return;
    try {
      this.activeVoice.src.playbackRate.setTargetAtTime(clamped, ctx.currentTime, Math.max(0.05, rampSec * 0.35));
    } catch {
      // Ignore rate schedule errors
    }
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

  _disconnectVoice(voice) {
    if (!voice) return;
    this.fadingVoices.delete(voice);
    try {
      voice.src.onended = null;
      voice.src.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    try {
      voice.gain.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }

  _trimFadingVoices(maxConcurrent = 4) {
    while (this.fadingVoices.size > maxConcurrent) {
      const oldest = this.fadingVoices.values().next().value;
      if (!oldest) break;
      try {
        oldest.src.stop();
      } catch {
        // Ignore already-stopped source errors
      }
      this._disconnectVoice(oldest);
    }
  }

  _scheduleEqualPowerOut(voice, now, durationSec) {
    if (!voice) return;
    const ctx = this.engine.ctx;
    if (!ctx || ctx.state !== 'running') {
      try {
        voice.src.stop();
      } catch {
        // Ignore already-stopped source errors
      }
      this._disconnectVoice(voice);
      return;
    }

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
      this._disconnectVoice(voice);
      return;
    }

    this.fadingVoices.add(voice);
    this._trimFadingVoices(4);
    voice.src.onended = () => {
      this._disconnectVoice(voice);
    };
  }

  transitionTo(filename, crossfadeSec = CROSSFADE_SECONDS, onStarted = null) {
    this.targetFilename = filename;
    const ctx = this.engine.ctx;
    const dest = this.getDestNode();
    if (!ctx || ctx.state === 'closed' || !dest || !filename) return;

    if (this.activeVoice && this.activeVoice.filename === filename) {
      if (onStarted) onStarted(true);
      return;
    }

    const token = ++this.requestToken;
    this.engine._loadAudioBuffer(filename).then((buffer) => {
      if (token !== this.requestToken || this.targetFilename !== filename) return;
      const liveCtx = this.engine.ctx;
      const liveDest = this.getDestNode();
      if (!liveCtx || liveCtx.state === 'closed' || !liveDest || !buffer) return;
      if (this.activeVoice && this.activeVoice.filename === filename) {
        if (onStarted) onStarted(true);
        return;
      }

      const now = liveCtx.currentTime;
      const hadPrevious = Boolean(this.activeVoice);
      if (this.activeVoice) {
        this._scheduleEqualPowerOut(this.activeVoice, now, crossfadeSec);
        this.activeVoice = null;
      }

      const src = liveCtx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.setValueAtTime(this.playbackRate || 1.0, now);

      const gain = liveCtx.createGain();
      const fadeDur = hadPrevious ? crossfadeSec : Math.min(1.35, crossfadeSec);
      this._scheduleEqualPowerIn(gain.gain, now, fadeDur, 1.0);

      src.connect(gain);
      gain.connect(liveDest);

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
    const ctx = this.engine.ctx;
    const now = ctx ? ctx.currentTime : 0;

    if (this.activeVoice) {
      const v = this.activeVoice;
      this.activeVoice = null;
      this._scheduleEqualPowerOut(v, now, fadeSec);
    }

    // Also expedite any lingering fading voices so mute/stop never leaks audio tails
    if (this.fadingVoices.size > 0) {
      const existing = [...this.fadingVoices];
      for (const fv of existing) {
        if (!ctx || ctx.state !== 'running') {
          try {
            fv.src.stop();
          } catch {
            // Ignore
          }
          this._disconnectVoice(fv);
        } else {
          try {
            const gParam = fv.gain.gain;
            const cur = Math.max(0.0001, gParam.value);
            const quick = Math.max(0.08, Math.min(fadeSec, 0.45));
            gParam.cancelScheduledValues(now);
            gParam.setValueAtTime(cur, now);
            gParam.linearRampToValueAtTime(0.0001, now + quick);
            fv.src.stop(now + quick + 0.04);
          } catch {
            this._disconnectVoice(fv);
          }
        }
      }
    }
  }
}

export class SoundEngine {
  constructor() {
    // Public state & 3-Channel Independent Studio Mixer
    this.muted = false;
    this.musicEnabled = true;
    this.ambienceEnabled = true;
    this.sfxEnabled = true;
    this.voiceEnabled = true;
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
    this.musicLPF = null;
    this.musicHighShelf = null;
    this.musicReverbSend = null;
    this.ambienceBus = null;
    this.ambienceLPF = null;
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
    this._activeFallbackVoice = null;
    this._musicBufferReady = false;

    // Continuous 60fps-safe updraft/dive wind bed (Frill-Glide) & mini-game ambience beds
    // (reef_swim underwater current, core_descent turbine whoosh, rapids_surf whitewater rush)
    this._windLevel = 0;
    this._glideWindNodes = null;
    this._modeBedNodes = null; // { mode, src, lfo, lfoGain, filter, gain }

    // Bulletproof zero-warning user-gesture unlock & voice/bell diagnostics
    this._unlockedOnce = false;
    this._hasUserGesture = false;
    this._pendingUnlock = false;
    this._unlockEvents = null;
    this._onUnlockGesture = null;
    this._activeSfxVoices = 0;
    this._lastBellPitchHz = 0;
    this._lastBellIndex = -1;
    this._lastTriggerMap = new Map();

    this._bindAutoUnlock();
  }

  _hasGestureActivation() {
    if (this._hasUserGesture) return true;
    if (typeof navigator !== 'undefined' && navigator.userActivation) {
      return Boolean(navigator.userActivation.hasBeenActive);
    }
    return true;
  }

  _unbindAutoUnlock() {
    if (typeof window === 'undefined' || !this._unlockEvents || !this._onUnlockGesture) return;
    for (const ev of this._unlockEvents) {
      window.removeEventListener(ev, this._onUnlockGesture, true);
    }
    this._unlockEvents = null;
    this._onUnlockGesture = null;
  }

  _bindAutoUnlock() {
    if (typeof window === 'undefined') return;

    const events = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
    const onGesture = () => {
      this._hasUserGesture = true;
      this.unlock(true);
      if (this.ctx && this.ctx.state === 'running') {
        this._unbindAutoUnlock();
      }
    };

    this._unlockEvents = events;
    this._onUnlockGesture = onGesture;
    for (const ev of events) {
      window.addEventListener(ev, onGesture, { capture: true, passive: true });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.visibilityState === 'hidden') {
          this._stopGlideWind();
          this._stopModeBed();
          return;
        }
        if (document.visibilityState === 'visible' && !this.muted) {
          if (
            (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') &&
            this._hasGestureActivation()
          ) {
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
        this._unbindAutoUnlock();
        this._syncPlayback();
        if (this._windLevel > 0.005) {
          this.setWind(this._windLevel);
        }
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
    this.antiFatigueLPF.frequency.value = 7600;
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

    // 4. Independent 3-Channel Studio Mixer Buses (Music w/ Act-Consistent Adaptive Filter/Reverb / Water Ambience / Organic SFX)
    this.musicBus = ctx.createGain();
    this.musicLPF = ctx.createBiquadFilter();
    this.musicLPF.type = 'lowpass';
    this.musicLPF.frequency.value = 18000;
    this.musicLPF.Q.value = 0.72;

    this.musicHighShelf = ctx.createBiquadFilter();
    this.musicHighShelf.type = 'highshelf';
    this.musicHighShelf.frequency.value = 6000;
    this.musicHighShelf.gain.value = 0;

    this.musicReverbSend = ctx.createGain();
    this.musicReverbSend.gain.value = 0.04;

    this.musicBus.connect(this.musicLPF);
    this.musicLPF.connect(this.musicHighShelf);
    this.musicHighShelf.connect(this.masterGain);
    this.musicLPF.connect(this.musicReverbSend);
    this.musicReverbSend.connect(this.reverbHPF);

    this.ambienceBus = ctx.createGain();
    this.ambienceLPF = ctx.createBiquadFilter();
    this.ambienceLPF.type = 'lowpass';
    this.ambienceLPF.frequency.value = 18000;
    this.ambienceLPF.Q.value = 0.68;
    this.ambienceBus.connect(this.ambienceLPF);
    this.ambienceLPF.connect(this.masterGain);

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
    const actMusic = MUSIC_STEMS[activeBiome] || MUSIC_STEMS.canyon_river;

    if (this.miniGameMode === 'core_descent') {
      return {
        harmonyKey: 'core_descent',
        musicFile: MUSIC_STEMS.core_descent,
        ambienceFile: AMBIENCE_STEMS.core_descent,
        crossfadeSec: 1.2,
      };
    }
    // Act-Consistent Mini-Game Remixes: preserve the current Act's musical score via bookmark
    // while smoothly reshaping filter, playback energy, reverb send, and water ambience!
    if (this.miniGameMode === 'reef_swim') {
      return {
        harmonyKey: activeBiome,
        musicFile: actMusic,
        ambienceFile: AMBIENCE_STEMS.coral_sea,
        crossfadeSec: 1.4,
      };
    }
    if (this.miniGameMode === 'rapids_surf') {
      return {
        harmonyKey: activeBiome,
        musicFile: actMusic,
        ambienceFile: AMBIENCE_STEMS.canyon_river,
        crossfadeSec: 1.4,
      };
    }
    if (this.miniGameMode === 'frill_glide') {
      return {
        harmonyKey: activeBiome,
        musicFile: actMusic,
        ambienceFile: AMBIENCE_STEMS.alpine_lake,
        crossfadeSec: 1.5,
      };
    }
    if (this.miniGameMode === 'aqueduct_sanctum') {
      return {
        harmonyKey: activeBiome,
        musicFile: actMusic,
        ambienceFile: AMBIENCE_STEMS[activeBiome] || AMBIENCE_STEMS.mist_bayou,
        crossfadeSec: 1.4,
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
        crossfadeSec: 1.25,
      };
    }

    if (this.gameMode === 'flood_rush' || this.theme === 'core_descent') {
      return {
        harmonyKey: 'core_descent',
        musicFile: MUSIC_STEMS.core_descent,
        ambienceFile: AMBIENCE_STEMS[activeBiome] || AMBIENCE_STEMS.core_descent,
        crossfadeSec: 1.35,
      };
    }

    if (this.theme === 'sanctum_menu') {
      return {
        harmonyKey: 'sanctum_menu',
        musicFile: MUSIC_STEMS.sanctum_menu,
        ambienceFile: AMBIENCE_STEMS.alpine_lake,
        crossfadeSec: 1.8,
      };
    }

    if (this.zenMode || this.gameMode === 'sanctum_trials') {
      return {
        harmonyKey: activeBiome,
        musicFile: actMusic,
        ambienceFile: AMBIENCE_STEMS[activeBiome],
        crossfadeSec: 1.8,
      };
    }

    return {
      harmonyKey: activeBiome,
      musicFile: actMusic,
      ambienceFile: AMBIENCE_STEMS[activeBiome],
      crossfadeSec: CROSSFADE_SECONDS,
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

  unlock(fromGesture = false) {
    if (fromGesture) {
      this._hasUserGesture = true;
    }
    // Never create an AudioContext before user activation (eliminates Chromium autoplay warnings)
    if (!this.ctx && !this._hasGestureActivation()) {
      this._pendingUnlock = true;
      return false;
    }

    this._pendingUnlock = false;
    this._initGraph();
    if (!this.ctx) return false;

    if (!this._unlockedOnce && this._silentBuf) {
      try {
        const s = this.ctx.createBufferSource();
        s.buffer = this._silentBuf;
        s.connect(this.masterGain);
        s.onended = () => {
          try {
            s.disconnect();
          } catch {
            // Ignore
          }
        };
        s.start(0);
        this._unlockedOnce = true;
      } catch {
        // Ignore pre-resume restriction
      }
    }

    if (
      (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') &&
      this._hasGestureActivation()
    ) {
      this.ctx
        .resume()
        .then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            this._unbindAutoUnlock();
          }
          this._syncPlayback();
        })
        .catch(() => {});
    } else if (this.ctx.state === 'running') {
      this._unbindAutoUnlock();
    }
    this._syncPlayback();
    return this.ctx.state === 'running';
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
    if (next === null) {
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
    if (this.muted) {
      this._stopGlideWind();
      this._stopModeBed();
    }
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
    if (!this.ambienceEnabled) this._stopModeBed();
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

  toggleVoice() {
    return this.setVoiceEnabled(!this.voiceEnabled);
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = Boolean(enabled);
    return this.voiceEnabled;
  }

  isVoiceEnabled() {
    return Boolean(this.voiceEnabled);
  }

  setMusicActive(active) {
    const next = Boolean(active);
    if (this.musicActive === next) return;
    this.musicActive = next;
    if (!this.musicActive) {
      this._stopGlideWind();
      this._stopModeBed();
    }
    this._syncPlayback();
  }

  _syncPlayback() {
    if (!this.ctx || this.ctx.state !== 'running') {
      this._stopFallbackPad();
      this._stopModeBed();
      return;
    }

    const { musicFile, ambienceFile, crossfadeSec } = this._resolveDesiredStems();
    const fadeSec = crossfadeSec || CROSSFADE_SECONDS;
    const wantMusic = Boolean(
      this.musicActive && this.musicEnabled && !this.muted && this.musicVolume > 0.002
    );
    const wantAmbience = Boolean(
      this.musicActive && this.ambienceEnabled && !this.muted && this.ambienceVolume > 0.002
    );

    const now = this.ctx.currentTime;

    // Smooth Act-consistent adaptive music contour (zero jarring track jumps between Spire & Mini-Games!)
    let targetMusicCutoff = 18000;
    let targetMusicShelfDb = 0.0;
    let targetMusicRev = 0.05;
    let targetRate = 1.0;

    if (this.miniGameMode === 'reef_swim') {
      targetMusicCutoff = 2400;
      targetMusicShelfDb = -1.5;
      targetMusicRev = 0.16;
      targetRate = 0.98;
    } else if (this.miniGameMode === 'rapids_surf') {
      targetMusicCutoff = 18000;
      targetMusicShelfDb = 1.8;
      targetMusicRev = 0.05;
      targetRate = 1.06;
    } else if (this.miniGameMode === 'frill_glide') {
      targetMusicCutoff = 18000;
      targetMusicShelfDb = 3.0;
      targetMusicRev = 0.22;
      targetRate = 1.02;
    } else if (this.miniGameMode === 'aqueduct_sanctum') {
      targetMusicCutoff = 1850;
      targetMusicShelfDb = -1.2;
      targetMusicRev = 0.24;
      targetRate = 0.96;
    } else if (this.miniGameMode === 'core_descent') {
      targetMusicCutoff = 18000;
      targetMusicShelfDb = 1.5;
      targetMusicRev = 0.12;
      targetRate = 1.04;
    } else if (this.zenMode || this.gameMode === 'sanctum_trials') {
      targetMusicCutoff = 3800;
      targetMusicRev = 0.16;
      targetRate = 0.97;
    }

    if (this.musicLPF) {
      this.musicLPF.frequency.setTargetAtTime(targetMusicCutoff, now, 0.32);
    }
    if (this.musicHighShelf) {
      this.musicHighShelf.gain.setTargetAtTime(targetMusicShelfDb, now, 0.35);
    }
    if (this.musicReverbSend) {
      this.musicReverbSend.gain.setTargetAtTime(targetMusicRev, now, 0.35);
    }
    this._musicDeck.setPlaybackRate(targetRate, 0.45);

    // Smooth underwater low-pass contour for `reef_swim` vs crisp open-air ambience
    if (this.ambienceLPF) {
      const targetCutoff = this.miniGameMode === 'reef_swim' ? 680 : 18000;
      this.ambienceLPF.frequency.setTargetAtTime(targetCutoff, now, 0.38);
    }

    if (wantMusic) {
      if (!this._bufferCache.has(musicFile)) {
        this._musicBufferReady = false;
        this._startFallbackPad();
      } else {
        this._musicBufferReady = true;
        this._stopFallbackPad();
      }
      this._musicDeck.transitionTo(musicFile, fadeSec, () => {
        this._musicBufferReady = true;
        this._stopFallbackPad();
      });
    } else {
      this._stopFallbackPad();
      this._musicDeck.fadeOutAll(0.75);
    }

    if (wantAmbience) {
      this._ambienceDeck.transitionTo(ambienceFile, fadeSec);
      this._syncModeBed();
    } else {
      this._ambienceDeck.fadeOutAll(0.85);
      this._stopModeBed();
    }
  }

  /**
   * Leak-free continuous mini-game acoustic texture bed routed into `ambienceBus`:
   * - `reef_swim`: warm submerged ocean current (low-passed pink noise + 0.18 Hz swell LFO)
   * - `core_descent`: pulsing hydro-reactor turbine whoosh (bandpass 260 Hz + 1.45 Hz blade LFO)
   * - `rapids_surf`: crisp canyon whitewater rush (velvet air bandpass 620 Hz + 0.42 Hz wave LFO)
   */
  _syncModeBed() {
    const mode = this.miniGameMode;
    const wantBed =
      mode === 'reef_swim' || mode === 'core_descent' || mode === 'rapids_surf';

    if (
      !wantBed ||
      !this.ctx ||
      this.ctx.state !== 'running' ||
      !this.ambienceBus ||
      this.muted ||
      !this.ambienceEnabled ||
      !this.musicActive ||
      this.ambienceVolume <= 0.002
    ) {
      this._stopModeBed();
      return;
    }

    if (this._modeBedNodes && this._modeBedNodes.mode === mode) {
      return;
    }

    this._stopModeBed();

    const buf = mode === 'rapids_surf' ? this._softAirBuf : this._pinkNoiseBuf;
    if (!buf) return;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    let targetGain = 0.045;
    if (mode === 'reef_swim') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, now);
      filter.Q.setValueAtTime(0.85, now);
      lfo.frequency.setValueAtTime(0.18, now);
      lfoGain.gain.setValueAtTime(55, now);
      targetGain = 0.068;
    } else if (mode === 'core_descent') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(265, now);
      filter.Q.setValueAtTime(1.55, now);
      lfo.frequency.setValueAtTime(1.45, now);
      lfoGain.gain.setValueAtTime(95, now);
      targetGain = 0.056;
    } else {
      // rapids_surf whitewater rush
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(620, now);
      filter.Q.setValueAtTime(0.95, now);
      lfo.frequency.setValueAtTime(0.42, now);
      lfoGain.gain.setValueAtTime(185, now);
      targetGain = 0.046;
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(targetGain, now + 0.55);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceBus);

    src.start(now, Math.random() * Math.max(0.1, buf.duration - 0.5));
    lfo.start(now);

    this._modeBedNodes = { mode, src, lfo, lfoGain, filter, gain };
  }

  _stopModeBed() {
    const n = this._modeBedNodes;
    if (!n) return;
    this._modeBedNodes = null;

    const disconnectAll = () => {
      try {
        n.src.onended = null;
        n.src.disconnect();
        n.lfo.disconnect();
        n.lfoGain.disconnect();
        n.filter.disconnect();
        n.gain.disconnect();
      } catch {
        // Ignore teardown errors
      }
    };

    if (!this.ctx || this.ctx.state !== 'running') {
      try {
        n.src.stop();
        n.lfo.stop();
      } catch {
        // Ignore
      }
      disconnectAll();
      return;
    }

    const now = this.ctx.currentTime;
    try {
      n.gain.gain.cancelScheduledValues(now);
      n.gain.gain.setValueAtTime(Math.max(0.0001, n.gain.gain.value), now);
      n.gain.gain.linearRampToValueAtTime(0.0001, now + 0.32);
      n.src.onended = disconnectAll;
      n.src.stop(now + 0.35);
      n.lfo.stop(now + 0.35);
    } catch {
      disconnectAll();
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
      const voice = { oscs, lp, env };
      this._activeFallbackVoice = voice;
      if (oscs.length > 0) {
        oscs[0].onended = () => {
          if (this._activeFallbackVoice === voice) {
            this._activeFallbackVoice = null;
          }
          try {
            for (const o of oscs) o.disconnect();
            lp.disconnect();
            env.disconnect();
          } catch {
            // Ignore
          }
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
    const fv = this._activeFallbackVoice;
    if (fv && this.ctx) {
      this._activeFallbackVoice = null;
      const now = this.ctx.currentTime;
      try {
        fv.env.gain.cancelScheduledValues(now);
        fv.env.gain.setValueAtTime(Math.max(0.0001, fv.env.gain.value), now);
        fv.env.gain.linearRampToValueAtTime(0.0001, now + 0.25);
        for (const o of fv.oscs) {
          o.stop(now + 0.28);
        }
      } catch {
        // Ignore already-stopped oscillators
      }
    }
  }

  // --- Organic Acoustic Foley Synthesis Primitives (Strictly Warm & Non-Fatiguing) ---

  _canPlay(key, minGap = 0.025) {
    if (this.muted || !this.sfxEnabled || this.sfxVolume <= 0.002 || !this.ctx || !this.sfxGain) {
      return false;
    }
    if (this.ctx.state === 'suspended' && this._hasGestureActivation()) {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx.state !== 'running') return false;
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

    this._activeSfxVoices++;
    osc1.onended = () => {
      this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
      try {
        osc1.disconnect();
        osc2.disconnect();
        g2.disconnect();
        bodyLPF.disconnect();
        out.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Ignore teardown errors
      }
    };

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.025);
    osc2.stop(now + dur + 0.025);
  }

  /**
   * Authentic cast-bronze temple bell synthesizer for the Aqueduct Sanctum `bells` puzzle.
   * Pure sine partials only (0.5x hum + 1.0x/1.0018x beating strike + 1.498x quint + 2.0x tierce
   * + damped 2.756x nominal), routed through a warm silk low-pass filter (<= 3,400 Hz, ZERO >5kHz buzz)
   * with gentle clapper weight and leak-free `onended` teardown.
   */
  _bronzeTempleBell(
    freq,
    { duration = 1.32, gainVal = 0.068, delay = 0, pan = 0, sendReverb = true } = {}
  ) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + Math.max(0, delay);
    const f0 = clamp(freq, 220, 1760);
    const dur = Math.max(0.35, duration);
    const peak = clamp(gainVal, 0.0002, 0.22);

    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.linearRampToValueAtTime(peak, now + 0.006);
    out.gain.exponentialRampToValueAtTime(peak * 0.42, now + dur * 0.32);
    out.gain.exponentialRampToValueAtTime(0.0002, now + dur);

    // Warm resonant bronze bell filter — strictly below 3,400 Hz (zero metallic harshness!)
    const warmLPF = this.ctx.createBiquadFilter();
    warmLPF.type = 'lowpass';
    warmLPF.frequency.setValueAtTime(Math.min(3400, f0 * 3.85), now);
    warmLPF.frequency.exponentialRampToValueAtTime(Math.min(1850, f0 * 2.1), now + dur * 0.68);
    warmLPF.Q.value = 0.72;

    warmLPF.connect(out);
    const panner = this._connectSfx(out, sendReverb, pan);

    const partials = [
      // Hum sub-octave (deep temple bronze foundation)
      { ratio: 0.5, amp: 0.34, decayMul: 1.04 },
      // Strike fundamental + subtle twin chorus partial for organic bronze shimmer
      { ratio: 1.0, amp: 0.72, decayMul: 0.96 },
      { ratio: 1.0018, amp: 0.28, decayMul: 0.88 },
      // Warm fifth (quint) & octave overtones
      { ratio: 1.498, amp: 0.16, decayMul: 0.58 },
      { ratio: 2.0, amp: 0.2, decayMul: 0.48 },
      // Soft struck nominal partial (decays quickly into singing fundamental)
      { ratio: 2.756, amp: 0.09, decayMul: 0.22 },
    ];

    const oscs = [];
    const gains = [];
    let longestStop = now + dur + 0.03;

    for (const p of partials) {
      const pf = f0 * p.ratio;
      if (pf > 3550) continue; // Strictly cap every partial well below 5kHz
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pf, now);

      const g = this.ctx.createGain();
      const pDur = Math.max(0.14, dur * p.decayMul);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(p.amp, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0002, now + pDur);

      osc.connect(g);
      g.connect(warmLPF);

      const stopAt = now + Math.min(dur + 0.04, pDur + 0.03);
      if (stopAt > longestStop) longestStop = stopAt;
      osc.start(now);
      osc.stop(stopAt);
      oscs.push(osc);
      gains.push(g);
    }

    // Attach teardown to the longest-running partial (hum tone, index 0)
    const anchorOsc = oscs[0];
    if (anchorOsc) {
      this._activeSfxVoices++;
      anchorOsc.onended = () => {
        this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
        try {
          for (const o of oscs) o.disconnect();
          for (const g of gains) g.disconnect();
          warmLPF.disconnect();
          out.disconnect();
          if (panner) panner.disconnect();
        } catch {
          // Ignore teardown errors
        }
      };
    }

    // Soft wooden/bronze clapper strike transient + delicate sanctuary water resonance
    this._warmBodyTone(195, 96, 0.036, peak * 0.42, delay, 'sine', 340, false, pan);
    this._waterDrop(Math.min(1850, f0 * 1.498), 0.13, peak * 0.26, delay + 0.012, pan * 0.8, true);
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
    this._activeSfxVoices++;
    osc.onended = () => {
      this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
      try {
        osc.disconnect();
        gain.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Ignore teardown errors
      }
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

    this._activeSfxVoices++;
    osc.onended = () => {
      this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Ignore teardown errors
      }
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

    this._activeSfxVoices++;
    src.onended = () => {
      this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
      try {
        src.disconnect();
        bp.disconnect();
        gain.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Ignore teardown errors
      }
    };

    const offset = Math.random() * Math.max(0.01, buf.duration - dur - 0.04);
    src.start(now, offset, dur + 0.02);
  }

  // --- 5-Material True Surface-Aware Footsteps & Landing Foley ---

  _normalizeSurface(surface = 'stone') {
    const s = String(surface || 'stone').trim().toLowerCase();
    if (s.includes('ice') || s.includes('crystal') || s.includes('frost') || s.includes('glacier')) return 'ice';
    if (s.includes('wood') || s.includes('plank') || s.includes('raft') || s.includes('timber') || s.includes('dock')) return 'wood';
    if (s.includes('water') || s.includes('puddle') || s.includes('splash') || s.includes('shallow') || s.includes('wet')) return 'water';
    if (s.includes('bronze') || s.includes('metal') || s.includes('lift') || s.includes('elev') || s.includes('brass') || s.includes('valve')) return 'bronze';
    return 'stone';
  }

  _noiseBurst(dur = 0.05, gainVal = 0.03, filterType = 'bandpass', fStart = 1200, fEnd = 900, q = 2.0, delay = 0, pan = 0, sendReverb = false, usePink = true) {
    if (!this.ctx || !this.sfxGain || this._activeSfxVoices > 28) return;
    const buf = usePink ? this._pinkNoiseBuf : this._softAirBuf;
    if (!buf) return;
    const now = this.ctx.currentTime + Math.max(0, delay);
    const d = Math.max(0.012, dur);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filt = this.ctx.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.setValueAtTime(clamp(fStart, 60, 12000), now);
    if (Math.abs(fEnd - fStart) > 2) {
      filt.frequency.exponentialRampToValueAtTime(clamp(fEnd, 60, 12000), now + d);
    }
    filt.Q.setValueAtTime(clamp(q, 0.4, 14), now);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, gainVal), now + Math.min(0.006, d * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now + d);

    src.connect(filt);
    filt.connect(g);
    const panner = this._connectSfx(g, sendReverb, pan);

    this._activeSfxVoices++;
    src.onended = () => {
      this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
      try {
        src.disconnect();
        filt.disconnect();
        g.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Ignore teardown errors
      }
    };
    const offset = Math.random() * Math.max(0.01, buf.duration - d - 0.04);
    src.start(now, offset, d + 0.018);
  }

  stepSurface(surface = 'stone', intensity = 0.72) {
    if (!this._canPlay('step', 0.068)) return;
    if (!this.ctx || !this.sfxGain) return;
    const mat = this._normalizeSurface(surface);
    const vel = clamp(intensity, 0.25, 1.15);
    const stepAdvance = Math.random() < 0.28 ? 2 : 1;
    this._footstepIdx = (this._footstepIdx + stepAdvance) % 6;
    const pan = (this._footstepIdx % 2 === 0 ? -0.075 : 0.075) + (Math.random() * 2 - 1) * 0.03;

    if (mat === 'ice') {
      // Crystalline glacier step: tight brittle pop + dual glass-chime shimmer + skate-scrape hiss
      this._warmBodyTone(this._vary(225, 0.06), 148, 0.024, 0.034 * vel, 0, 'sine', 640, false, pan);
      this._warmBodyTone(this._vary(2820, 0.06), this._vary(2650, 0.05), 0.045, 0.013 * vel, 0.003, 'sine', 4800, true, pan);
      this._warmBodyTone(this._vary(4380, 0.06), this._vary(4100, 0.05), 0.036, 0.008 * vel, 0.006, 'sine', 5800, true, -pan);
      this._noiseBurst(0.045, 0.022 * vel, 'highpass', this._vary(5100, 0.06), 4400, 0.9, 0.004, pan, false, false);
      return;
    }

    if (mat === 'wood') {
      // Redwood dock / raft step: warm hollow timber resonance + dry plank knock + fiber friction
      this._warmBodyTone(this._vary(118, 0.06), 78, 0.048, 0.054 * vel, 0, 'sine', 300, false, pan);
      this._noiseBurst(0.034, 0.038 * vel, 'bandpass', this._vary(520, 0.06), 420, 4.5, 0.002, pan, true, true);
      if (vel > 0.72) {
        this._warmBodyTone(this._vary(295, 0.06), 240, 0.042, 0.014 * vel, 0.012, 'triangle', 680, false, pan);
      }
      return;
    }

    if (mat === 'water') {
      // Flooded quay / shallow puddle step: buoyant bloop + wet palm-slap splash + droplet spray
      this._warmBodyTone(this._vary(260, 0.06), this._vary(425, 0.06), 0.052, 0.034 * vel, 0, 'sine', 960, true, pan);
      this._noiseBurst(0.062, 0.034 * vel, 'bandpass', this._vary(920, 0.06), this._vary(1920, 0.06), 1.6, 0.004, pan, true, true);
      this._noiseBurst(0.082, 0.018 * vel, 'highpass', 3200, 2600, 0.85, 0.012, pan, true, false);
      this._waterDrop(this._vary(580, 0.08), 0.085, 0.022 * vel, 0.014, pan, true);
      return;
    }

    if (mat === 'bronze') {
      // Pelagian elevator / brass deck step: metallic gong-plate thump + inharmonic 1:1.75 ring + boot clink
      const fBase = this._vary(680, 0.055);
      this._warmBodyTone(this._vary(142, 0.05), 88, 0.055, 0.048 * vel, 0, 'sine', 360, false, pan);
      this._warmBodyTone(fBase, fBase * 0.992, 0.095, 0.018 * vel, 0.002, 'triangle', 2600, true, pan);
      this._warmBodyTone(fBase * 1.75, fBase * 1.74, 0.082, 0.012 * vel, 0.004, 'sine', 3400, true, -pan);
      this._noiseBurst(0.024, 0.016 * vel, 'bandpass', this._vary(3400, 0.06), 2900, 3.2, 0, pan, false, true);
      return;
    }

    // Default 'stone': crisp mineral click + dry stone tap BPF + faint gritty sand-grain scuff
    this._warmBodyTone(this._vary(160, 0.06), 74, 0.028, 0.042 * vel, 0, 'sine', 340, false, pan);
    this._noiseBurst(0.026, 0.034 * vel, 'bandpass', this._vary(1150, 0.06), 920, 3.2, 0.002, pan, false, true);
    this._noiseBurst(0.02, 0.012 * vel, 'highpass', this._vary(3600, 0.06), 3100, 1.0, 0.004, pan, false, false);
    if (this._footstepVariations && this._footstepVariations.length > 0) {
      const buf = this._footstepVariations[this._footstepIdx % this._footstepVariations.length];
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.setValueAtTime(this._vary(1.0, 0.05), now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this._vary(0.034 * vel, 0.08), now);
      src.connect(gain);
      const panner = this._connectSfx(gain, false, pan);
      this._activeSfxVoices++;
      src.onended = () => {
        this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
        try {
          src.disconnect();
          gain.disconnect();
          if (panner) panner.disconnect();
        } catch {
          // Ignore
        }
      };
      src.start(now);
    }
  }

  landSurface(surface = 'stone', impact = 0.65) {
    if (!this._canPlay('land', 0.045)) return;
    if (!this.ctx || !this.sfxGain) return;
    const mat = this._normalizeSurface(surface);
    const imp = clamp(impact, 0.18, 1.1);

    if (mat === 'ice') {
      // Frost-crystal CRACK-TINK landing
      this._warmBodyTone(this._vary(155, 0.05), 68, 0.085, 0.058 * imp, 0, 'sine', 420, false);
      this._warmBodyTone(this._vary(2680, 0.06), 2400, 0.11, 0.024 * imp, 0.006, 'sine', 5200, true, -0.08);
      this._warmBodyTone(this._vary(4220, 0.06), 3800, 0.095, 0.016 * imp, 0.014, 'sine', 6200, true, 0.08);
      this._noiseBurst(0.075, 0.034 * imp, 'highpass', 4600, 3200, 1.2, 0.004, 0, true, false);
      return;
    }

    if (mat === 'wood') {
      // Resonant dock-plank THUMP-CREAK landing
      this._warmBodyTone(this._vary(98, 0.05), 52, 0.12, 0.082 * imp, 0, 'sine', 240, true);
      this._noiseBurst(0.055, 0.046 * imp, 'bandpass', this._vary(460, 0.06), 320, 4.2, 0.004, 0, true, true);
      this._warmBodyTone(this._vary(245, 0.06), 192, 0.085, 0.022 * imp, 0.028, 'triangle', 580, false);
      return;
    }

    if (mat === 'water') {
      // Lush dual-stage KER-SPLASH + trailing water drips
      this._warmBodyTone(this._vary(145, 0.06), 46, 0.16, 0.076 * imp, 0, 'sine', 300, true);
      this._noiseBurst(0.24, 0.062 * imp, 'bandpass', 1240, 380, 1.1, 0.002, 0, true, true);
      this._noiseBurst(0.18, 0.032 * imp, 'highpass', 3000, 2100, 0.9, 0.022, 0, true, false);
      this._waterDrop(this._vary(440, 0.08), 0.11, 0.03 * imp, 0.035, -0.14, true);
      this._waterDrop(this._vary(640, 0.08), 0.095, 0.024 * imp, 0.095, 0.14, true);
      return;
    }

    if (mat === 'bronze') {
      // Heavy Pelagian elevator CLANG-HISS landing
      const fBase = this._vary(540, 0.05);
      this._warmBodyTone(this._vary(118, 0.05), 54, 0.13, 0.086 * imp, 0, 'sine', 280, true);
      this._warmBodyTone(fBase, fBase * 0.985, 0.22, 0.03 * imp, 0.004, 'triangle', 2400, true, -0.06);
      this._warmBodyTone(fBase * 1.75, fBase * 1.73, 0.18, 0.02 * imp, 0.008, 'sine', 3400, true, 0.06);
      this._noiseBurst(0.12, 0.024 * imp, 'bandpass', 2400, 1400, 1.6, 0.02, 0, true, false);
      return;
    }

    // Default 'stone': deeper hollow temple-stone thud + tiny pebble rattle
    this._warmBodyTone(this._vary(96, 0.05), 40, 0.1, 0.054 + imp * 0.052, 0, 'sine', 240, false);
    this._noiseBurst(0.058, 0.038 * imp, 'bandpass', this._vary(980, 0.06), 440, 2.2, 0.004, 0, true, true);
    if (imp > 0.5) {
      this._noiseBurst(0.032, 0.018 * imp, 'highpass', 3400, 2600, 1.4, 0.028, 0.09, false, true);
      this._waterDrop(this._vary(480, 0.09), 0.08, 0.016 * imp, 0.016, 0, true);
    }
  }

  step(surface = 'stone') {
    this.stepSurface(surface, 0.72);
  }

  footstep(surface = 'stone') {
    this.stepSurface(surface, 0.72);
  }

  stepUp(surface = 'stone') {
    this.stepSurface(surface, 0.68);
    if (this._canPlay('stepAir', 0.09)) {
      this._silkyWhoosh(0.075, 0.016, 360, 680, 1.1, 0.005, 0, false, false);
    }
  }

  jump() {
    if (!this._canPlay('jump', 0.045)) return;
    // Soft wet-stone push-off + silky upward air/frill whoosh + delicate water-bead lift + subtle Gateway chirp
    this._warmBodyTone(this._vary(132, 0.04), 58, 0.068, 0.068, 0, 'sine', 280, false);
    this._silkyWhoosh(0.17, 0.046, 290, 1080, 1.15, 0.006, 0, true, false);
    this._waterDrop(this._scaleFreq(2, 0), 0.11, 0.024, 0.015, 0.06, true);
    this.playGatewayVoice('jump', { gainScale: 0.72 });
  }

  doubleJump() {
    if (!this._canPlay('doubleJump', 0.045)) return;
    this._silkyWhoosh(0.21, 0.054, 380, 1380, 1.2, 0, 0, true, true);
    this._waterDrop(this._scaleFreq(4, 0), 0.12, 0.034, 0.008, -0.08, true);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.24, 0.032, 0.03, 0.08, true);
    this.playGatewayVoice('doubleJump', { gainScale: 0.85 });
  }

  land(intensity = 0.6, surface = 'stone') {
    this.landSurface(surface, intensity);
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

  tailWhip(overcharged = false) {
    if (!this._canPlay('tailWhip', 0.055)) return;
    // Supple 360-degree Lizard Tail-Whip: stereo silky water-ribbon swoosh + liquid scatter + energetic yip
    this._warmBodyTone(this._vary(158, 0.04), 66, 0.095, 0.068, 0, 'sine', 320, false);
    this._silkyWhoosh(0.22, 0.062, 260, 1280, 1.15, 0, -0.25, true, false);
    this._silkyWhoosh(0.18, 0.045, 1180, 380, 1.2, 0.05, 0.28, true, true);
    this._waterDrop(this._scaleFreq(2, 0), 0.11, 0.03, 0.035, -0.15, true);
    this._waterDrop(this._scaleFreq(4, 0), 0.12, 0.026, 0.075, 0.18, true);
    if (overcharged) {
      this._kalimbaChime(this._scaleFreq(6, 0), 0.26, 0.034, 0.02, 0, true);
    }
    this.playGatewayVoice('whip', { overcharged, gainScale: 0.78 });
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
    this.pulseSonarMusicBloom();
    // Deep Pelagian underwater sonar ping with warm stereo sub-aquatic echoes (< 2.4kHz)
    const f = clamp(this._scaleFreq(5, 0), 620, 1180);
    this._warmBodyTone(f, f * 1.008, 0.52, 0.052, 0, 'sine', 2100, true, 0);
    this._warmBodyTone(f * 0.5, f * 0.5, 0.46, 0.024, 0, 'sine', 900, true, 0);
    // Two gentle stereo-bouncing reef cavern echo returns
    this._warmBodyTone(f * 1.002, f * 0.996, 0.44, 0.026, 0.22, 'sine', 1450, true, -0.26);
    this._warmBodyTone(f * 0.998, f * 0.992, 0.38, 0.015, 0.46, 'sine', 1050, true, 0.28);
    this._waterDrop(Math.min(1450, f * 1.25), 0.13, 0.024, 0.02, 0.12, true);
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
    this.playEnemySfx('snap_crab', 'flip');
  }

  springBounce() {
    if (!this._canPlay('springBounce', 0.05)) return;
    this._warmBodyTone(118, 245, 0.16, 0.082, 0, 'sine', 560, true);
    this._silkyWhoosh(0.22, 0.048, 320, 1280, 1.2, 0.01, 0, true, false);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.3, 0.045, 0.02, 0, true);
    this.playGatewayVoice('whee', { gainScale: 0.85 });
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
    // Soft muffled water-impact thud (warm low-passed resonance) + empathetic Gateway squeak
    this._warmBodyTone(162, 44, 0.24, 0.11 * scale, 0, 'sine', 280, true);
    this._warmBodyTone(240, 110, 0.2, 0.055 * scale, 0.015, 'triangle', 480, true);
    this._silkyWhoosh(0.18, 0.045 * scale, 640, 180, 1.0, 0, 0, true, true);
    this.playGatewayVoice('hurt', { gainScale: 0.85 * scale });
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
    // Joyful hidden Earth Water-Critter pod release: ascending water-droplet & kalimba bloom + Gateway rescue trill!
    this._waterDrop(this._scaleFreq(2, 0), 0.11, 0.04, 0, -0.14, true);
    [0, 2, 4, 5, 7].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.36, 0.046, 0.02 + idx * 0.052, (idx - 2) * 0.1, true);
    });
    this.playGatewayVoice('rescue', { gainScale: 0.92 });
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

    if (this.ctx.state === 'suspended' && this._hasGestureActivation()) {
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

    const disconnectAll = () => {
      try {
        n.src.onended = null;
        n.src.disconnect();
        n.bp.disconnect();
        n.gain.disconnect();
      } catch {
        // Ignore teardown errors
      }
    };

    if (!this.ctx || this.ctx.state !== 'running') {
      try {
        n.src.stop();
      } catch {
        // Ignore
      }
      disconnectAll();
      return;
    }

    const now = this.ctx.currentTime;
    try {
      n.gain.gain.cancelScheduledValues(now);
      n.gain.gain.setValueAtTime(Math.max(0.0001, n.gain.gain.value), now);
      n.gain.gain.linearRampToValueAtTime(0.0001, now + 0.09);
      n.src.onended = disconnectAll;
      n.src.stop(now + 0.11);
    } catch {
      disconnectAll();
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

  /**
   * Resolves a canonical Aqueduct Sanctum temple bell pitch (C5, D5, E5, G5, A5).
   * Supports both `puzzleBell(b.note, b.color)` from `puzzleRoom.js` AND direct bell index `0..4`.
   */
  resolveTempleBellPitch(semitoneOrIndex = 0, colorIdx = undefined) {
    if (typeof colorIdx === 'number' && Number.isFinite(colorIdx)) {
      const idx = clamp(Math.floor(colorIdx), 0, TEMPLE_BELL_PENTATONIC_HZ.length - 1);
      return {
        index: idx,
        freqHz: TEMPLE_BELL_PENTATONIC_HZ[idx],
        pan: (idx - 2) * 0.14,
      };
    }
    const val = Number(semitoneOrIndex) || 0;
    const exactSemiIdx = TEMPLE_BELL_SEMITONES.indexOf(val);
    if (exactSemiIdx >= 0) {
      return {
        index: exactSemiIdx,
        freqHz: TEMPLE_BELL_PENTATONIC_HZ[exactSemiIdx],
        pan: (exactSemiIdx - 2) * 0.14,
      };
    }
    const semi = clamp(val, -12, 24);
    const freqHz = Number((523.25 * Math.pow(2, semi / 12)).toFixed(2));
    return {
      index: clamp(Math.floor(semi), 0, 4),
      freqHz,
      pan: 0,
    };
  }

  puzzleBell(semitone = 0, colorIdx = undefined, opts = undefined) {
    const resolved = this.resolveTempleBellPitch(semitone, colorIdx);
    const delay = Math.max(0, Number(opts?.delay) || 0);
    const gainScale = clamp(opts?.gainScale ?? 1, 0.25, 1.35);
    const debounceKey = `puzzleBell_${resolved.index}_${Math.round(resolved.freqHz)}`;
    if (delay <= 0) {
      if (!this._canPlay(debounceKey, 0.025)) return resolved.freqHz;
    } else if (
      this.muted ||
      !this.sfxEnabled ||
      this.sfxVolume <= 0.002 ||
      !this.ctx ||
      this.ctx.state !== 'running' ||
      !this.sfxGain
    ) {
      return resolved.freqHz;
    }

    this._lastBellPitchHz = resolved.freqHz;
    this._lastBellIndex = resolved.index;
    this._bronzeTempleBell(resolved.freqHz, {
      duration: opts?.duration ?? 1.34,
      gainVal: 0.068 * gainScale,
      delay,
      pan: opts?.pan ?? resolved.pan,
      sendReverb: true,
    });
    return resolved.freqHz;
  }

  puzzleBellByIndex(bellIndex = 0, opts = undefined) {
    const idx = clamp(Math.floor(Number(bellIndex) || 0), 0, TEMPLE_BELL_PENTATONIC_HZ.length - 1);
    return this.puzzleBell(TEMPLE_BELL_SEMITONES[idx], idx, opts);
  }

  /**
   * Plays a full Aqueduct Sanctum musical bell clue sequence using identical bronze temple bell
   * pitches (`C5, D5, E5, G5, A5`) scheduled sample-accurately on the WebAudio clock.
   */
  puzzleBellClueSequence(order = [], opts = {}) {
    if (!Array.isArray(order) || order.length === 0) return [];
    const stepSec = clamp(opts.stepSec ?? 0.44, 0.18, 1.2);
    const gainScale = clamp(opts.gainScale ?? 0.88, 0.3, 1.2);
    const pitches = [];
    order.forEach((entry, i) => {
      const idx =
        typeof entry === 'object' && entry !== null
          ? Number(entry.color ?? entry.index ?? 0)
          : Number(entry) || 0;
      const safeIdx = clamp(Math.floor(idx), 0, TEMPLE_BELL_PENTATONIC_HZ.length - 1);
      const hz = this.puzzleBell(TEMPLE_BELL_SEMITONES[safeIdx], safeIdx, {
        delay: i * stepSec,
        gainScale,
        duration: 1.15,
      });
      pitches.push(hz);
    });
    return pitches;
  }

  playBellClue(order = [], opts = {}) {
    return this.puzzleBellClueSequence(order, opts);
  }

  puzzleNote(semitone = 0, colorIdx = undefined, opts = undefined) {
    return this.puzzleBell(semitone, colorIdx, opts);
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
    this.playGatewayVoice('victory', { gainScale: 0.9 });
  }

  // --- Gateway 2.0 Adorable Dual-Formant Pelagian Vocal Synth ---

  /**
   * Dual-formant resonant bandpass vocal synthesizer for Gateway 2.0
   * (0.72 triangle + 0.28 sawtooth glottal exciter, organic micro-vibrato, parallel F1/F2 vowel
   * formants, plus delicate wet aquatic bubble over-sparkle!).
   */
  _playFormantSyllable({
    fStart = 660,
    fEnd = 880,
    dur = 0.11,
    f1Start = 680,
    f1End = 960,
    f2Start = 1950,
    f2End = 2550,
    gainVal = 0.055,
    delay = 0,
    vibRate = 17,
    vibDepthHz = 7,
    sparkleHz = 2850,
    pan = 0,
    breathy = false,
  }) {
    if (!this.ctx || !this.sfxGain || !this.voiceEnabled || this._activeSfxVoices > 28) return;
    const now = this.ctx.currentTime + Math.max(0, delay);
    const d = Math.max(0.035, dur);

    const oscTri = this.ctx.createOscillator();
    oscTri.type = 'triangle';
    const oscSaw = this.ctx.createOscillator();
    oscSaw.type = 'sawtooth';

    const f0 = clamp(fStart, 120, 3200);
    const f1 = clamp(fEnd, 120, 3400);
    oscTri.frequency.setValueAtTime(f0, now);
    oscSaw.frequency.setValueAtTime(f0, now);
    if (Math.abs(f1 - f0) > 1) {
      oscTri.frequency.exponentialRampToValueAtTime(f1, now + d * 0.88);
      oscSaw.frequency.exponentialRampToValueAtTime(f1, now + d * 0.88);
    }

    const vib = this.ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.setValueAtTime(vibRate, now);
    const vibGain = this.ctx.createGain();
    vibGain.gain.setValueAtTime(vibDepthHz, now);
    vib.connect(vibGain);
    vibGain.connect(oscTri.frequency);
    vibGain.connect(oscSaw.frequency);

    const triMix = this.ctx.createGain();
    triMix.gain.setValueAtTime(0.72, now);
    const sawMix = this.ctx.createGain();
    sawMix.gain.setValueAtTime(0.28, now);

    const f1Filter = this.ctx.createBiquadFilter();
    f1Filter.type = 'bandpass';
    f1Filter.frequency.setValueAtTime(clamp(f1Start, 240, 2600), now);
    f1Filter.frequency.exponentialRampToValueAtTime(clamp(f1End, 240, 2600), now + d);
    f1Filter.Q.setValueAtTime(4.5, now);

    const f2Filter = this.ctx.createBiquadFilter();
    f2Filter.type = 'bandpass';
    f2Filter.frequency.setValueAtTime(clamp(f2Start, 800, 4200), now);
    f2Filter.frequency.exponentialRampToValueAtTime(clamp(f2End, 800, 4200), now + d);
    f2Filter.Q.setValueAtTime(5.5, now);

    const env = this.ctx.createGain();
    const peak = Math.max(0.0005, gainVal);
    const attack = Math.min(0.016, d * 0.22);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + attack);
    env.gain.exponentialRampToValueAtTime(peak * 0.65, now + d * 0.62);
    env.gain.exponentialRampToValueAtTime(0.0001, now + d);

    oscTri.connect(triMix);
    oscSaw.connect(sawMix);
    triMix.connect(f1Filter);
    triMix.connect(f2Filter);
    sawMix.connect(f1Filter);
    sawMix.connect(f2Filter);
    f1Filter.connect(env);
    f2Filter.connect(env);
    const panner = this._connectSfx(env, true, pan);

    this._activeSfxVoices++;
    oscTri.onended = () => {
      this._activeSfxVoices = Math.max(0, this._activeSfxVoices - 1);
      try {
        oscTri.disconnect();
        oscSaw.disconnect();
        vib.disconnect();
        vibGain.disconnect();
        triMix.disconnect();
        sawMix.disconnect();
        f1Filter.disconnect();
        f2Filter.disconnect();
        env.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Ignore teardown errors
      }
    };

    oscTri.start(now);
    oscSaw.start(now);
    vib.start(now);
    const stopAt = now + d + 0.02;
    oscTri.stop(stopAt);
    oscSaw.stop(stopAt);
    vib.stop(stopAt);

    // Subtle 8% wet sea-dragon aquatic bubble chirp sparkle
    if (sparkleHz > 0) {
      this._warmBodyTone(
        this._vary(sparkleHz, 0.05),
        this._vary(sparkleHz * 1.18, 0.05),
        Math.min(0.065, d * 0.65),
        peak * 0.14,
        delay + 0.008,
        'sine',
        4400,
        true,
        pan
      );
    }
    if (breathy) {
      this._noiseBurst(Math.min(0.08, d), peak * 0.28, 'bandpass', 2200, 2900, 4.5, delay, pan, false, false);
    }
  }

  /**
   * Expressive Gateway 2.0 vocalization cues:
   * 'jump' | 'doubleJump' | 'whip' | 'teeter' | 'rescue' | 'wetShake' | 'hurt' | 'victory' | 'whee' | 'trick' | 'wave' | 'hop'
   */
  playGatewayVoice(cue = 'jump', opts = {}) {
    if (!this.voiceEnabled || !this.ctx || !this.sfxGain) return false;
    const raw = String(cue || 'jump').trim().toLowerCase().replace(/[\s_-]+/g, '');
    const gainScale = clamp(opts?.gainScale ?? 1.0, 0.2, 1.35);

    if (raw === 'jump' || raw === 'hopshort') {
      if (!this._canPlay('gv_jump', 0.13)) return false;
      this._playFormantSyllable({
        fStart: this._vary(784, 0.04),
        fEnd: this._vary(1046, 0.04),
        dur: 0.095,
        f1Start: 680,
        f1End: 980,
        f2Start: 1950,
        f2End: 2550,
        gainVal: 0.042 * gainScale,
        vibRate: 16,
        vibDepthHz: 5,
        sparkleHz: 2800,
      });
      return true;
    }

    if (raw === 'doublejump' || raw === 'airjump') {
      if (!this._canPlay('gv_djump', 0.14)) return false;
      this._playFormantSyllable({
        fStart: this._vary(988, 0.04),
        fEnd: this._vary(1244, 0.04),
        dur: 0.072,
        f1Start: 760,
        f1End: 1020,
        f2Start: 2100,
        f2End: 2700,
        gainVal: 0.04 * gainScale,
        sparkleHz: 3100,
        pan: -0.06,
      });
      this._playFormantSyllable({
        fStart: this._vary(1174, 0.04),
        fEnd: this._vary(1396, 0.04),
        dur: 0.085,
        delay: 0.058,
        f1Start: 860,
        f1End: 1120,
        f2Start: 2300,
        f2End: 2850,
        gainVal: 0.044 * gainScale,
        sparkleHz: 3400,
        pan: 0.06,
      });
      return true;
    }

    if (raw === 'whip' || raw === 'tailwhip' || raw === 'whipyip') {
      if (!this._canPlay('gv_whip', 0.18)) return false;
      const overcharged = Boolean(opts?.overcharged);
      this._playFormantSyllable({
        fStart: this._vary(587, 0.04),
        fEnd: this._vary(overcharged ? 988 : 880, 0.04),
        dur: 0.11,
        f1Start: 820,
        f1End: 1080,
        f2Start: 2300,
        f2End: 2750,
        gainVal: 0.048 * gainScale,
        vibRate: 20,
        vibDepthHz: 8,
        sparkleHz: overcharged ? 3600 : 2700,
        breathy: true,
      });
      return true;
    }

    if (raw === 'teeter' || raw === 'edgeteeter' || raw === 'teetergasp' || raw === 'oops') {
      if (!this._canPlay('gv_teeter', 0.9)) return false;
      this._playFormantSyllable({
        fStart: this._vary(880, 0.04),
        fEnd: this._vary(740, 0.04),
        dur: 0.075,
        f1Start: 620,
        f1End: 560,
        f2Start: 1850,
        f2End: 1700,
        gainVal: 0.042 * gainScale,
        breathy: true,
        pan: -0.05,
      });
      this._playFormantSyllable({
        fStart: this._vary(740, 0.04),
        fEnd: this._vary(988, 0.04),
        dur: 0.095,
        delay: 0.072,
        f1Start: 700,
        f1End: 940,
        f2Start: 2050,
        f2End: 2600,
        gainVal: 0.045 * gainScale,
        vibRate: 22,
        vibDepthHz: 11,
        breathy: true,
        pan: 0.05,
      });
      return true;
    }

    if (raw === 'rescue' || raw === 'rescuetrill' || raw === 'critter') {
      if (!this._canPlay('gv_rescue', 0.45)) return false;
      const notes = [1046.5, 1318.5, 1568.0, 1318.5, 1760.0];
      notes.forEach((hz, idx) => {
        this._playFormantSyllable({
          fStart: hz * 0.97,
          fEnd: hz * 1.02,
          dur: 0.068,
          delay: idx * 0.044,
          f1Start: 780,
          f1End: 1020,
          f2Start: 2200,
          f2End: 2800,
          gainVal: 0.04 * gainScale,
          vibRate: 18,
          vibDepthHz: 6,
          sparkleHz: 3200,
          pan: (idx - 2) * 0.08,
        });
      });
      // Tiny high-pitched rescued Critter Chirp answer 165ms later!
      this._playFormantSyllable({
        fStart: 1397,
        fEnd: 1760,
        dur: 0.095,
        delay: 0.26,
        f1Start: 950,
        f1End: 1150,
        f2Start: 2550,
        f2End: 2950,
        gainVal: 0.032 * gainScale,
        sparkleHz: 3500,
        pan: 0.16,
      });
      return true;
    }

    if (raw === 'wetshake' || raw === 'shake') {
      if (!this._canPlay('gv_wetshake', 0.45)) return false;
      for (let i = 0; i < 4; i++) {
        const up = i % 2 === 0;
        this._playFormantSyllable({
          fStart: up ? 660 : 790,
          fEnd: up ? 810 : 640,
          dur: 0.062,
          delay: i * 0.058,
          f1Start: 620,
          f1End: 880,
          f2Start: 1950,
          f2End: 2450,
          gainVal: 0.036 * gainScale,
          sparkleHz: 2900 + i * 220,
          pan: up ? -0.14 : 0.14,
        });
        this._waterDrop(this._vary(620 + i * 110, 0.1), 0.075, 0.022, i * 0.065, up ? -0.18 : 0.18, true);
      }
      this._noiseBurst(0.28, 0.028 * gainScale, 'highpass', 3000, 2200, 0.9, 0.01, 0, true, false);
      return true;
    }

    if (raw === 'hurt' || raw === 'bump') {
      if (!this._canPlay('gv_hurt', 0.32)) return false;
      this._playFormantSyllable({
        fStart: this._vary(659, 0.04),
        fEnd: this._vary(440, 0.04),
        dur: 0.18,
        f1Start: 680,
        f1End: 520,
        f2Start: 1650,
        f2End: 1420,
        gainVal: 0.048 * gainScale,
        vibRate: 14,
        vibDepthHz: 5,
        sparkleHz: 0,
      });
      return true;
    }

    if (raw === 'whee' || raw === 'bounce' || raw === 'spring') {
      if (!this._canPlay('gv_whee', 0.35)) return false;
      this._playFormantSyllable({
        fStart: this._vary(698, 0.04),
        fEnd: this._vary(1480, 0.04),
        dur: 0.25,
        f1Start: 680,
        f1End: 1120,
        f2Start: 1950,
        f2End: 2850,
        gainVal: 0.048 * gainScale,
        vibRate: 19,
        vibDepthHz: 11,
        sparkleHz: 3300,
      });
      return true;
    }

    if (raw === 'trick' || raw === 'wave' || raw === 'hop' || raw === 'titlehop') {
      if (!this._canPlay('gv_trick', 0.24)) return false;
      this._playFormantSyllable({
        fStart: this._vary(880, 0.04),
        fEnd: this._vary(1046, 0.04),
        dur: 0.085,
        f1Start: 720,
        f1End: 960,
        f2Start: 2050,
        f2End: 2600,
        gainVal: 0.044 * gainScale,
        sparkleHz: 3000,
        pan: -0.06,
      });
      this._playFormantSyllable({
        fStart: this._vary(1046, 0.04),
        fEnd: this._vary(1318, 0.04),
        dur: 0.115,
        delay: 0.075,
        f1Start: 820,
        f1End: 1080,
        f2Start: 2250,
        f2End: 2850,
        gainVal: 0.048 * gainScale,
        vibRate: 19,
        vibDepthHz: 8,
        sparkleHz: 3450,
        pan: 0.06,
      });
      return true;
    }

    if (raw === 'victory' || raw === 'celebrate') {
      if (!this._canPlay('gv_victory', 0.45)) return false;
      const degs = [0, 2, 4, 7];
      degs.forEach((d, idx) => {
        const hz = clamp(this._scaleFreq(d, 1), 520, 1760);
        const isLast = idx === degs.length - 1;
        this._playFormantSyllable({
          fStart: hz * 0.96,
          fEnd: hz * (isLast ? 1.02 : 1.0),
          dur: isLast ? 0.28 : 0.11,
          delay: 0.04 + idx * 0.11,
          f1Start: 760,
          f1End: 1060,
          f2Start: 2150,
          f2End: 2800,
          gainVal: (isLast ? 0.052 : 0.042) * gainScale,
          vibRate: isLast ? 18 : 14,
          vibDepthHz: isLast ? 12 : 5,
          sparkleHz: 3300,
          pan: (idx - 1.5) * 0.1,
        });
      });
      return true;
    }

    return false;
  }

  // Named convenience aliases for Gateway 2.0 voice cues
  gatewayJump(doubleJump = false) { return this.playGatewayVoice(doubleJump ? 'doubleJump' : 'jump'); }
  gatewayWhipYip(overcharged = false) { return this.playGatewayVoice('whip', { overcharged }); }
  gatewayTeeterGasp() { return this.playGatewayVoice('teeter'); }
  gatewayWhee() { return this.playGatewayVoice('whee'); }
  gatewayBounceWhee() { return this.playGatewayVoice('whee'); }
  gatewayTrickChirp() { return this.playGatewayVoice('trick'); }
  gatewayWaveChirp() { return this.playGatewayVoice('wave'); }
  gatewayWetShake() { return this.playGatewayVoice('wetShake'); }
  gatewayHurt() { return this.playGatewayVoice('hurt'); }
  gatewayOops() { return this.playGatewayVoice('teeter'); }
  gatewayRescueTrill() { return this.playGatewayVoice('rescue'); }
  gatewayVictorySong() { return this.playGatewayVoice('victory'); }
  gatewayCelebrate() { return this.playGatewayVoice('victory'); }

  // --- All 7 Enemy Personality Foley Cues (`playEnemySfx(kind, event)` + Named Aliases) ---

  /**
   * Plays comical, readable WebAudio foley for all 7 enemy archetypes.
   * Accepts either `playEnemySfx('crab_clack')` OR `playEnemySfx('snap_crab', 'clack')`.
   */
  playEnemySfx(kindOrCue = '', event = '') {
    if (!this.ctx || !this.sfxGain) return false;
    const rawKind = String(kindOrCue || '').trim().toLowerCase();
    const rawEvent = String(event || '').trim().toLowerCase();
    const combined = rawEvent ? `${rawKind}_${rawEvent}` : rawKind;

    // 1. SNAP-CRAB (`crab_clack`, `crab_aggro`, `crab_flip`, `crab_boing`, `crab_bonk`, `crab_punt`)
    if (combined.includes('crab') || combined.includes('clack') || combined.includes('punt')) {
      if (combined.includes('punt') || combined.includes('shell')) {
        if (!this._canPlay('en_crab_punt', 0.08)) return false;
        this._warmBodyTone(185, 92, 0.14, 0.085, 0, 'triangle', 680, true);
        this._noiseBurst(0.16, 0.048, 'bandpass', 1800, 900, 2.4, 0.01, 0, true, true);
        this._kalimbaChime(this._vary(980, 0.06), 0.16, 0.036, 0.01, 0, true);
        return true;
      }
      if (combined.includes('boing') || combined.includes('bounce') || combined.includes('spring')) {
        if (!this._canPlay('en_crab_boing', 0.08)) return false;
        this._warmBodyTone(180, 620, 0.13, 0.075, 0, 'triangle', 1400, true);
        this._warmBodyTone(620, 310, 0.16, 0.056, 0.11, 'sine', 1200, true);
        this._waterDrop(this._vary(720, 0.08), 0.11, 0.032, 0.03, 0, true);
        return true;
      }
      if (combined.includes('flip')) {
        if (!this._canPlay('en_crab_flip', 0.07)) return false;
        this._warmBodyTone(150, 480, 0.11, 0.072, 0, 'triangle', 1200, true, -0.06);
        this._warmBodyTone(460, 260, 0.14, 0.048, 0.09, 'sine', 920, true, 0.06);
        this._noiseBurst(0.08, 0.028, 'bandpass', 1650, 1200, 3.8, 0.04, 0, false, true);
        return true;
      }
      if (combined.includes('bonk') || combined.includes('huff')) {
        if (!this._canPlay('en_crab_bonk', 0.12)) return false;
        this._warmBodyTone(260, 96, 0.14, 0.078, 0, 'triangle', 620, true);
        this._noiseBurst(0.18, 0.036, 'highpass', 2400, 1200, 1.4, 0.07, 0, true, false);
        return true;
      }
      if (combined.includes('aggro') || combined.includes('bark') || combined.includes('charge')) {
        if (!this._canPlay('en_crab_aggro', 0.14)) return false;
        this._warmBodyTone(240, 420, 0.09, 0.058, 0, 'sawtooth', 1100, false);
        this._noiseBurst(0.036, 0.046, 'bandpass', 1550, 2100, 5.5, 0.05, -0.08, false, true);
        this._noiseBurst(0.036, 0.046, 'bandpass', 1950, 2400, 5.5, 0.095, 0.08, false, true);
        return true;
      }
      // Default crab_clack: twin crisp ceramic-shell pincer snaps 42ms apart!
      if (!this._canPlay('en_crab_clack', 0.11)) return false;
      this._noiseBurst(0.028, 0.046, 'bandpass', this._vary(1450, 0.05), 1100, 6.2, 0, -0.06, false, true);
      this._warmBodyTone(this._vary(1450, 0.05), 980, 0.028, 0.03, 0, 'triangle', 2600, false, -0.06);
      this._noiseBurst(0.028, 0.046, 'bandpass', this._vary(2100, 0.05), 1650, 6.2, 0.042, 0.06, false, true);
      this._warmBodyTone(this._vary(2100, 0.05), 1420, 0.028, 0.028, 0.042, 'triangle', 3200, false, 0.06);
      return true;
    }

    // 2. GULP-HOPPER (`frog_gulp`, `frog_croak`, `frog_boing`, `frog_slam`, `frog_pop`)
    if (combined.includes('frog') || combined.includes('hopper') || combined.includes('gulp')) {
      if (combined.includes('pop') || combined.includes('belly')) {
        if (!this._canPlay('en_frog_pop', 0.09)) return false;
        this._warmBodyTone(340, 88, 0.14, 0.088, 0, 'sine', 900, true);
        this._noiseBurst(0.14, 0.062, 'bandpass', 1800, 480, 1.4, 0.008, 0, true, true);
        this._waterDrop(680, 0.11, 0.038, 0.02, -0.14, true);
        this._waterDrop(920, 0.095, 0.034, 0.06, 0.14, true);
        return true;
      }
      if (combined.includes('slam') || combined.includes('land')) {
        if (!this._canPlay('en_frog_slam', 0.11)) return false;
        this._warmBodyTone(88, 36, 0.24, 0.11, 0, 'sine', 220, true);
        this._warmBodyTone(195, 118, 0.18, 0.054, 0.015, 'triangle', 520, true);
        this._noiseBurst(0.16, 0.046, 'bandpass', 620, 220, 1.5, 0.01, 0, true, true);
        return true;
      }
      if (combined.includes('boing') || combined.includes('leap')) {
        if (!this._canPlay('en_frog_boing', 0.1)) return false;
        this._warmBodyTone(135, 390, 0.16, 0.072, 0, 'sine', 960, true);
        this._waterDrop(480, 0.1, 0.03, 0.02, 0, true);
        return true;
      }
      if (combined.includes('croak')) {
        if (!this._canPlay('en_frog_croak', 0.16)) return false;
        this._warmBodyTone(122, 168, 0.11, 0.062, 0, 'sawtooth', 480, true);
        this._warmBodyTone(158, 108, 0.14, 0.052, 0.095, 'sawtooth', 420, true);
        return true;
      }
      // Default frog_gulp: swelling bubbly throat-sac sweep
      if (!this._canPlay('en_frog_gulp', 0.14)) return false;
      this._warmBodyTone(140, 340, 0.19, 0.066, 0, 'sine', 820, true);
      this._waterDrop(this._vary(340, 0.08), 0.12, 0.036, 0.06, 0, true);
      return true;
    }

    // 3. VOLT-EEL (`eel_hum`, `eel_zap`, `eel_short`)
    if (combined.includes('eel') || combined.includes('volt') || combined.includes('zap')) {
      if (combined.includes('short') || combined.includes('exhaust') || combined.includes('down')) {
        if (!this._canPlay('en_eel_short', 0.14)) return false;
        this._warmBodyTone(760, 120, 0.28, 0.056, 0, 'sawtooth', 1600, true);
        this._noiseBurst(0.16, 0.032, 'bandpass', 2800, 620, 2.5, 0.04, 0, true, true);
        return true;
      }
      if (combined.includes('hum') || combined.includes('charge') || combined.includes('coil')) {
        if (!this._canPlay('en_eel_hum', 0.15)) return false;
        this._warmBodyTone(185, 420, 0.24, 0.046, 0, 'sawtooth', 1400, true);
        this._noiseBurst(0.05, 0.026, 'bandpass', 3600, 5200, 4.0, 0.04, -0.08, false, true);
        this._noiseBurst(0.05, 0.026, 'bandpass', 4200, 5800, 4.0, 0.14, 0.08, false, true);
        return true;
      }
      // Default eel_zap: FM-style electric arc discharge
      if (!this._canPlay('en_eel_zap', 0.1)) return false;
      this._warmBodyTone(220, 310, 0.18, 0.062, 0, 'sawtooth', 2400, true);
      this._warmBodyTone(298, 170, 0.16, 0.048, 0.02, 'triangle', 2800, true);
      this._noiseBurst(0.14, 0.052, 'bandpass', 3400, 5800, 2.8, 0, 0, true, true);
      return true;
    }

    // 4. RAIL-SKATER (`skater_rev`, `skater_brake`, `skater_windup`, `skater_crash`)
    if (combined.includes('skater') || combined.includes('rail')) {
      if (combined.includes('brake') || combined.includes('screech') || combined.includes('skid')) {
        if (!this._canPlay('en_skater_brake', 0.14)) return false;
        this._noiseBurst(0.24, 0.048, 'bandpass', 2400, 1450, 5.0, 0, 0, true, true);
        this._warmBodyTone(1180, 640, 0.18, 0.026, 0.01, 'triangle', 2600, true);
        return true;
      }
      if (combined.includes('wind') || combined.includes('ratchet')) {
        if (!this._canPlay('en_skater_wind', 0.14)) return false;
        for (let i = 0; i < 4; i++) {
          this._noiseBurst(0.022, 0.036, 'bandpass', 1800 + i * 260, 2200 + i * 240, 6.5, i * 0.048, (i - 1.5) * 0.06, false, true);
        }
        this._kalimbaChime(1320, 0.2, 0.032, 0.2, 0, true);
        return true;
      }
      if (combined.includes('crash') || combined.includes('tumble')) {
        if (!this._canPlay('en_skater_crash', 0.1)) return false;
        this._warmBodyTone(520, 210, 0.18, 0.062, 0, 'triangle', 2200, true);
        this._warmBodyTone(910, 380, 0.14, 0.034, 0.02, 'sine', 3000, true);
        this._noiseBurst(0.14, 0.042, 'bandpass', 2200, 900, 2.2, 0, 0, true, true);
        return true;
      }
      // Default skater_rev: turbo spin-up whirr
      if (!this._canPlay('en_skater_rev', 0.14)) return false;
      this._warmBodyTone(260, 620, 0.22, 0.044, 0, 'triangle', 1800, true);
      this._noiseBurst(0.22, 0.036, 'bandpass', 1200, 3100, 3.2, 0, 0, true, false);
      return true;
    }

    // 5. BARNACLE MORTAR (`mortar_charge`, `mortar_pop`, `mortar_hide`, `mortar_reflect`)
    if (combined.includes('mortar') || combined.includes('barnacle') || combined.includes('reflect')) {
      if (combined.includes('reflect') || combined.includes('bat') || combined.includes('homerun')) {
        if (!this._canPlay('en_mortar_reflect', 0.07)) return false;
        // Crunchy aluminum-bat home-run PING-CRACK!
        this._warmBodyTone(1680, 1620, 0.26, 0.056, 0, 'sine', 4200, true, -0.06);
        this._warmBodyTone(2890, 2790, 0.2, 0.036, 0.004, 'sine', 5200, true, 0.06);
        this._warmBodyTone(240, 88, 0.09, 0.088, 0, 'triangle', 680, false);
        this._noiseBurst(0.05, 0.055, 'bandpass', 2600, 1400, 2.2, 0, 0, true, true);
        return true;
      }
      if (combined.includes('hide') || combined.includes('clang') || combined.includes('shut')) {
        if (!this._canPlay('en_mortar_hide', 0.12)) return false;
        this._warmBodyTone(340, 180, 0.11, 0.07, 0, 'triangle', 1200, true);
        this._warmBodyTone(595, 520, 0.14, 0.032, 0.006, 'sine', 2200, true);
        return true;
      }
      if (combined.includes('charge') || combined.includes('swell') || combined.includes('whistle')) {
        if (!this._canPlay('en_mortar_charge', 0.14)) return false;
        this._warmBodyTone(180, 520, 0.24, 0.044, 0, 'sine', 1200, true);
        this._noiseBurst(0.22, 0.026, 'bandpass', 600, 1900, 4.2, 0, 0, true, false);
        return true;
      }
      // Default mortar_pop: hollow pressurized cork-cannon POP-THOOMP!
      if (!this._canPlay('en_mortar_pop', 0.1)) return false;
      this._warmBodyTone(120, 285, 0.14, 0.086, 0, 'sine', 680, true);
      this._waterDrop(480, 0.12, 0.038, 0.025, 0, true);
      this._noiseBurst(0.085, 0.044, 'bandpass', 920, 360, 2.0, 0.004, 0, true, true);
      return true;
    }

    // 6. VENT-STALKER (`stalker_whistle`, `stalker_hiss`, `stalker_erupt`, `stalker_pant`)
    if (combined.includes('stalker') || combined.includes('vent') || combined.includes('kettle')) {
      if (combined.includes('erupt') || combined.includes('geyser')) {
        if (!this._canPlay('en_stalker_erupt', 0.12)) return false;
        this._warmBodyTone(165, 62, 0.26, 0.088, 0, 'sine', 380, true);
        this._noiseBurst(0.38, 0.068, 'bandpass', 1800, 740, 1.2, 0.01, 0, true, true);
        return true;
      }
      if (combined.includes('pant') || combined.includes('cool')) {
        if (!this._canPlay('en_stalker_pant', 0.18)) return false;
        this._noiseBurst(0.11, 0.03, 'bandpass', 1400, 720, 2.4, 0, 0, true, false);
        this._noiseBurst(0.11, 0.026, 'bandpass', 1250, 620, 2.4, 0.14, 0, true, false);
        return true;
      }
      // Default stalker_hiss / kettle whistle: rising bronze tea-kettle whistle!
      if (!this._canPlay('en_stalker_hiss', 0.14)) return false;
      this._warmBodyTone(920, 1980, 0.3, 0.032, 0, 'sine', 3200, true);
      this._noiseBurst(0.32, 0.046, 'highpass', 1400, 4600, 2.2, 0, 0, true, false);
      return true;
    }

    // 7. SIPHON WARDEN (`warden_horn`, `warden_crack`, `warden_beam`, `warden_slam`, `warden_defeat`)
    if (combined.includes('warden') || combined.includes('boss')) {
      if (combined.includes('crack') || combined.includes('shield')) {
        if (!this._canPlay('en_warden_crack', 0.1)) return false;
        this._warmBodyTone(1420, 980, 0.24, 0.052, 0, 'triangle', 3800, true, -0.1);
        this._warmBodyTone(2180, 1640, 0.2, 0.038, 0.02, 'sine', 4600, true, 0.1);
        this._warmBodyTone(136, 52, 0.22, 0.095, 0, 'sine', 320, true);
        this._noiseBurst(0.18, 0.06, 'highpass', 2400, 4800, 1.4, 0.005, 0, true, true);
        return true;
      }
      if (combined.includes('beam') || combined.includes('roar')) {
        if (!this._canPlay('en_warden_beam', 0.15)) return false;
        this._warmBodyTone(110, 240, 0.38, 0.072, 0, 'sawtooth', 780, true);
        this._noiseBurst(0.42, 0.062, 'bandpass', 960, 2400, 1.8, 0.02, 0, true, true);
        return true;
      }
      if (combined.includes('slam') || combined.includes('tentacle')) {
        if (!this._canPlay('en_warden_slam', 0.14)) return false;
        this._warmBodyTone(76, 30, 0.34, 0.125, 0, 'sine', 190, true);
        this._noiseBurst(0.24, 0.066, 'bandpass', 520, 140, 1.3, 0.01, 0, true, true);
        return true;
      }
      if (combined.includes('defeat') || combined.includes('collapse')) {
        if (!this._canPlay('en_warden_defeat', 0.25)) return false;
        this._warmBodyTone(260, 42, 0.65, 0.11, 0, 'sawtooth', 620, true);
        this._noiseBurst(0.55, 0.065, 'bandpass', 1400, 260, 1.2, 0.04, 0, true, true);
        this.playGatewayVoice('victory', { gainScale: 0.9 });
        return true;
      }
      // Default warden_horn: deep theatrical Pelagian brass foghorn BWOOOOM!
      if (!this._canPlay('en_warden_horn', 0.25)) return false;
      this._warmBodyTone(92, 86, 0.68, 0.095, 0, 'sawtooth', 420, true, -0.08);
      this._warmBodyTone(138, 130, 0.64, 0.068, 0.02, 'sawtooth', 580, true, 0.08);
      this._warmBodyTone(46, 44, 0.72, 0.085, 0, 'sine', 160, true, 0);
      return true;
    }

    return false;
  }

  // Named convenience aliases for all 7 Enemy Personality cues
  crabClack() { return this.playEnemySfx('snap_crab', 'clack'); }
  crabAggroBark() { return this.playEnemySfx('snap_crab', 'aggro'); }
  crabBonk() { return this.playEnemySfx('snap_crab', 'bonk'); }
  crabBoing() { return this.playEnemySfx('snap_crab', 'boing'); }
  crabPunt() { return this.playEnemySfx('snap_crab', 'punt'); }
  hopperInflate() { return this.playEnemySfx('gulp_hopper', 'gulp'); }
  hopperCroak() { return this.playEnemySfx('gulp_hopper', 'croak'); }
  hopperBoing() { return this.playEnemySfx('gulp_hopper', 'boing'); }
  hopperSlam() { return this.playEnemySfx('gulp_hopper', 'slam'); }
  hopperBellyPop() { return this.playEnemySfx('gulp_hopper', 'pop'); }
  eelChargeHum() { return this.playEnemySfx('volt_eel', 'hum'); }
  eelZapDischarge() { return this.playEnemySfx('volt_eel', 'zap'); }
  eelShortCircuit() { return this.playEnemySfx('volt_eel', 'short'); }
  skaterZoom() { return this.playEnemySfx('rail_skater', 'rev'); }
  skaterBrakeScreech() { return this.playEnemySfx('rail_skater', 'brake'); }
  skaterRatchetWindup() { return this.playEnemySfx('rail_skater', 'windup'); }
  mortarChargeWhistle() { return this.playEnemySfx('barnacle_mortar', 'charge'); }
  mortarThoomp() { return this.playEnemySfx('barnacle_mortar', 'pop'); }
  mortarClangHide() { return this.playEnemySfx('barnacle_mortar', 'hide'); }
  baseballReflectCrack() { return this.playEnemySfx('barnacle_mortar', 'reflect'); }
  stalkerKettleWhistle() { return this.playEnemySfx('vent_stalker', 'hiss'); }
  stalkerSteamErupt() { return this.playEnemySfx('vent_stalker', 'erupt'); }
  stalkerPantCooldown() { return this.playEnemySfx('vent_stalker', 'pant'); }
  wardenHornIntro() { return this.playEnemySfx('siphon_warden', 'horn'); }
  wardenShieldCrack() { return this.playEnemySfx('siphon_warden', 'crack'); }
  wardenBeamCharge() { return this.playEnemySfx('siphon_warden', 'beam'); }
  wardenBeamRoar() { return this.playEnemySfx('siphon_warden', 'beam'); }
  wardenTentacleSlam() { return this.playEnemySfx('siphon_warden', 'slam'); }
  wardenDefeatCollapse() { return this.playEnemySfx('siphon_warden', 'defeat'); }

  // --- Cohesive World Transitions, Hydro-Rings, Floodgate Surge & Sonar Bloom ---

  pulseSonarMusicBloom() {
    if (!this.ctx || !this.musicLPF || this.miniGameMode !== 'reef_swim') return;
    const now = this.ctx.currentTime;
    try {
      this.musicLPF.frequency.cancelScheduledValues(now);
      this.musicLPF.frequency.setTargetAtTime(7500, now, 0.14);
      this.musicLPF.frequency.setTargetAtTime(2400, now + 1.35, 0.65);
    } catch {
      // Ignore
    }
  }

  hydroRingChime(combo = 0) {
    if (!this._canPlay('hydroRing', 0.03)) return;
    const step = clamp(Math.floor(Number(combo) || 0), 0, 8);
    const f = this._scaleFreq(step, 0);
    this._kalimbaChime(f, 0.42, 0.052, 0, -0.08, true);
    this._kalimbaChime(Math.min(2800, f * 1.498), 0.36, 0.036, 0.04, 0.1, true);
    this._waterDrop(Math.min(2400, f * 2.0), 0.11, 0.024, 0.015, 0, true);
    this._silkyWhoosh(0.18, 0.032, 420, 1480, 1.3, 0, 0, true, false);
  }

  playFloodgateSurge() {
    if (!this._canPlay('floodgateSurge', 0.25)) return;
    // Deep hydraulic WHOOSH-CLANK + pressurized water-jet surge + rising marimba restoration chord!
    this._warmBodyTone(92, 44, 0.46, 0.11, 0, 'sine', 260, true);
    this._warmBodyTone(340, 185, 0.14, 0.068, 0.04, 'triangle', 1200, true);
    this._silkyWhoosh(0.92, 0.085, 240, 1420, 1.05, 0.05, 0, true, true);
    [0, 2, 4, 5, 7].forEach((d, idx) => {
      this._kalimbaChime(this._scaleFreq(d, 0), 0.55, 0.048, 0.12 + idx * 0.075, (idx - 2) * 0.12, true);
    });
    this.playGatewayVoice('victory', { gainScale: 0.78 });
  }

  playTransitionRipple() {
    if (!this._canPlay('transitionRipple', 0.14)) return;
    this._silkyWhoosh(0.32, 0.038, 320, 1340, 1.35, 0, 0, true, false);
    this._waterDrop(this._scaleFreq(3, 0), 0.12, 0.026, 0.03, -0.1, true);
    this._kalimbaChime(this._scaleFreq(5, 0), 0.28, 0.032, 0.07, 0.1, true);
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

  // --- Wave 4: Cutscene Musical Voice-Syllable Cadences, Bio-Skill Tree & Critter Sonar ---

  /**
   * Ori / Celeste inspired melodic character speech murmurs for cutscene typewriter ticks.
   * Speakers: 'gateway' | 'naiad' | 'guardian' | 'warden' (warm, non-fatiguing, toggleable).
   */
  voiceBlip(speaker = 'gateway', charIndex = 0) {
    if (!this.voiceEnabled || !this._canPlay('voiceBlip', 0.052)) return;
    const raw = String(speaker || 'gateway').trim().toLowerCase();
    const idx = Math.max(0, Math.floor(Number(charIndex) || 0));
    // Natural phrase cadence contour (gentle lyrical rise-and-fall across words)
    const phrasePos = (idx + Math.floor(idx / 4) * 2) % 6;
    const pan = ((idx % 2 === 0 ? -1 : 1) * 0.06);

    if (raw.includes('warden') || raw.includes('syndicate') || raw.includes('boss')) {
      // Siphon Wardens: deep resonant brass / cello sub-cadence (warm < 700 Hz)
      const semis = [0, 3, 2, 5, 0, -2];
      const f = this._vary(130.81 * Math.pow(2, semis[phrasePos] / 12), 0.018);
      this._warmBodyTone(f, f * 0.96, 0.135, 0.048, 0, 'triangle', 580, true, pan);
      this._warmBodyTone(f * 2.0, f * 1.96, 0.095, 0.022, 0.006, 'sine', 680, true, pan);
      return;
    }

    if (raw.includes('naiad') || raw.includes('ai') || raw.includes('nav')) {
      // Naiad: soft harmonic bell-synth shimmer
      const semis = [0, 4, 7, 9, 7, 4];
      const f = this._vary(587.33 * Math.pow(2, semis[phrasePos] / 12), 0.012);
      this._warmBodyTone(f, f * 1.006, 0.09, 0.032, 0, 'sine', 2400, true, pan);
      this._warmBodyTone(f * 1.498, f * 1.5, 0.075, 0.016, 0.008, 'sine', 2800, true, -pan);
      return;
    }

    if (raw.includes('guardian') || raw.includes('elder') || raw.includes('otter') || raw.includes('turtle')) {
      // Earth's Water Guardians: warm mahogany wooden kalimba syllables
      const semis = [0, 2, 4, 7, 4, 2];
      const f = this._vary(349.23 * Math.pow(2, semis[phrasePos] / 12), 0.018);
      this._kalimbaChime(f, 0.125, 0.038, 0, pan, true);
      this._warmBodyTone(260, 220, 0.045, 0.018, 0, 'sine', 420, false, pan);
      return;
    }

    // Gateway (default): crystalline glass-marimba & breathy flute syllable
    const semis = [0, 2, 4, 7, 9, 7];
    const f = this._vary(523.25 * Math.pow(2, semis[phrasePos] / 12), 0.016);
    this._kalimbaChime(f, 0.11, 0.034, 0, pan, true);
    this._warmBodyTone(f * 0.992, f * 1.01, 0.095, 0.022, 0.006, 'sine', 2200, true, pan);
    this._silkyWhoosh(0.055, 0.01, 780, 1380, 1.8, 0, pan, false, false);
  }

  cutsceneVoice(speaker = 'gateway', charIndex = 0) {
    this.voiceBlip(speaker, charIndex);
  }

  /**
   * Permanent Pelagian Bio-Skill Tree unlock harmonic bloom (scales gently with rank 1..3).
   */
  skillUnlock(rank = 1) {
    if (!this._canPlay('skillUnlock', 0.09)) return;
    const r = clamp(Math.floor(Number(rank) || 1), 1, 4) - 1;
    this._warmBodyTone(this._scaleFreq(0, -1), this._scaleFreq(0, -1), 0.48, 0.06, 0, 'sine', 380, true);
    this._silkyWhoosh(0.32, 0.044, 340, 1280, 1.25, 0, 0, true, false);
    [0, 2, 4, 7].forEach((deg, idx) => {
      const f = this._scaleFreq(deg + r, 0);
      this._kalimbaChime(f, 0.46, 0.048, idx * 0.055, (idx - 1.5) * 0.14, true);
    });
    this._waterDrop(this._scaleFreq(5 + r, 0), 0.14, 0.03, 0.18, 0, true);
  }

  /**
   * Gentle Critter Sonar proximity pulse when Gateway nears a hidden Earth Water-Critter pod.
   * proximity: 0 (far edge of sensor) .. 1 (right beside pod).
   */
  critterRadarPing(proximity = 0.5) {
    if (!this._canPlay('critterRadarPing', 0.28)) return;
    const p = clamp(proximity, 0, 1);
    const deg = p > 0.68 ? 5 : p > 0.35 ? 4 : 2;
    const f = this._scaleFreq(deg, 0);
    const vol = 0.024 + p * 0.018;
    this._waterDrop(f, 0.13, vol, 0, -0.06, true);
    this._kalimbaChime(f, 0.32, vol * 0.9, 0.015, 0.06, true);
    if (p > 0.62) {
      this._waterDrop(this._scaleFreq(deg + 2, 0), 0.11, vol * 0.78, 0.11, 0.08, true);
    }
  }

  /**
   * Diagnostic snapshot for automated QA verification (node-leak checks, active stems, bell tuning).
   */
  getDiagnostics() {
    const stems = this._resolveDesiredStems();
    return {
      ctxState: this.ctx ? this.ctx.state : 'uninitialized',
      muted: this.muted,
      musicActive: this.musicActive,
      biome: this.biome,
      theme: this.theme,
      gameMode: this.gameMode,
      miniGameMode: this.miniGameMode,
      bossActive: this.bossActive,
      desiredMusic: stems.musicFile,
      desiredAmbience: stems.ambienceFile,
      activeMusicStem: this._musicDeck.activeVoice?.filename || null,
      activeAmbienceStem: this._ambienceDeck.activeVoice?.filename || null,
      fadingMusicVoices: this._musicDeck.fadingVoices.size,
      fadingAmbienceVoices: this._ambienceDeck.fadingVoices.size,
      activeSfxVoices: this._activeSfxVoices,
      modeBed: this._modeBedNodes?.mode || null,
      windActive: Boolean(this._glideWindNodes),
      ambienceCutoffHz: this.ambienceLPF ? Math.round(this.ambienceLPF.frequency.value) : 0,
      musicCutoffHz: this.musicLPF ? Math.round(this.musicLPF.frequency.value) : 0,
      musicPlaybackRate: this._musicDeck?.playbackRate ?? 1.0,
      lastBellPitchHz: this._lastBellPitchHz,
      lastBellIndex: this._lastBellIndex,
      bellPentatonicHz: TEMPLE_BELL_PENTATONIC_HZ,
    };
  }
}

export const sound = new SoundEngine();
