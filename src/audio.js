// 2026 Studio-Grade Web Audio Synthesizer for Tower Toppler '26
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.limiter = null;
    this.reverb = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.sfxReverbGain = null;
    this.musicGain = null;
    this.musicReverbGain = null;

    this.muted = false;
    this.musicEnabled = true;
    this.musicActive = false;
    this._grooveTimer = null;
    this._grooveStep = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Master limiter for studio headroom & zero clipping
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -12;
        this.limiter.knee.value = 14;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.004;
        this.limiter.release.value = 0.16;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.92;
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        // Generated 1.3s stereo algorithmic space reverb
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = this._createReverbImpulse(1.3, 2.8);
        const reverbFilter = this.ctx.createBiquadFilter();
        reverbFilter.type = 'lowpass';
        reverbFilter.frequency.value = 3200;
        this.reverb.connect(reverbFilter);
        reverbFilter.connect(this.masterGain);

        // SFX buses (dry + reverb send)
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 1.0;
        this.sfxGain.connect(this.masterGain);

        this.sfxReverbGain = this.ctx.createGain();
        this.sfxReverbGain.gain.value = 0.24;
        this.sfxReverbGain.connect(this.reverb);

        // Music buses (dry + lush reverb send)
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicEnabled ? 0.72 : 0;
        this.musicGain.connect(this.masterGain);

        this.musicReverbGain = this.ctx.createGain();
        this.musicReverbGain.gain.value = this.musicEnabled ? 0.36 : 0;
        this.musicReverbGain.connect(this.reverb);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicActive && this.musicEnabled && !this.muted) {
      this._startGroove();
    }
  }

  _createReverbImpulse(duration = 1.3, decay = 2.8) {
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
        // One-pole lowpass smoothing for warm studio tail
        lp = lp * 0.45 + white * 0.55;
        data[i] = lp * env;
      }
    }
    return impulse;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.92, this.ctx.currentTime, 0.02);
    }
    if (this.muted) {
      this._stopGroove();
    } else if (this.musicActive && this.musicEnabled) {
      this._startGroove();
    }
    return this.muted;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.72 : 0, now, 0.04);
      if (this.musicReverbGain) this.musicReverbGain.gain.setTargetAtTime(this.musicEnabled ? 0.36 : 0, now, 0.04);
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

  _vary(freq, pct = 0.035) {
    return freq * (1 + (Math.random() * 2 - 1) * pct);
  }

  _tone(freqStart, freqEnd, duration, type = 'sine', gainVal = 0.14, delay = 0, filterFreq = null, isMusic = false, sendReverb = true) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(24, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, freqEnd), now + duration);
    }

    const attack = Math.min(0.015, duration * 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    let output = gain;
    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.value = 0.9;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    const dryBus = isMusic ? this.musicGain : this.sfxGain;
    const revBus = isMusic ? this.musicReverbGain : this.sfxReverbGain;
    output.connect(dryBus);
    if (sendReverb && revBus) {
      output.connect(revBus);
    }

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  _fmTone(carrierFreq, modRatio, modDepth, duration, gainVal = 0.12, delay = 0, isMusic = false) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    carrier.type = 'sine';
    mod.type = 'sine';
    carrier.frequency.setValueAtTime(Math.max(24, carrierFreq), now);
    mod.frequency.setValueAtTime(Math.max(24, carrierFreq * modRatio), now);

    modGain.gain.setValueAtTime(modDepth, now);
    modGain.gain.exponentialRampToValueAtTime(0.5, now + duration * 0.75);

    outGain.gain.setValueAtTime(0.0001, now);
    outGain.gain.linearRampToValueAtTime(gainVal, now + 0.008);
    outGain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);

    const dryBus = isMusic ? this.musicGain : this.sfxGain;
    const revBus = isMusic ? this.musicReverbGain : this.sfxReverbGain;
    outGain.connect(dryBus);
    if (revBus) outGain.connect(revBus);

    carrier.start(now);
    mod.start(now);
    carrier.stop(now + duration + 0.03);
    mod.stop(now + duration + 0.03);
  }

  _noise(duration, gainVal = 0.08, freqStart = 1200, freqEnd = 400, filterType = 'bandpass', Q = 1.2, delay = 0, isMusic = false) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const now = this.ctx.currentTime + delay;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, freqStart), now);
    if (freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    filter.Q.value = Q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + Math.min(0.012, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    src.connect(filter);
    filter.connect(gain);

    const dryBus = isMusic ? this.musicGain : this.sfxGain;
    const revBus = isMusic ? this.musicReverbGain : this.sfxReverbGain;
    gain.connect(dryBus);
    if (revBus) gain.connect(revBus);

    src.start(now);
  }

  _padChord(freqs, duration = 2.1, gainVal = 0.032, filterFreq = 720) {
    if (this.muted || !this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq * 0.65, now);
    filter.frequency.linearRampToValueAtTime(filterFreq, now + duration * 0.35);
    filter.frequency.linearRampToValueAtTime(filterFreq * 0.55, now + duration);
    filter.Q.value = 0.8;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(gainVal, now + 0.18);
    env.gain.setValueAtTime(gainVal * 0.85, now + duration * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    filter.connect(env);
    env.connect(this.musicGain);
    if (this.musicReverbGain) env.connect(this.musicReverbGain);

    freqs.forEach((f) => {
      [-0.004, 0.004].forEach((detuneRatio) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f * (1 + detuneRatio), now);
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + duration + 0.05);
      });
    });
  }

  // --- Modern 2026 Chill-Synthwave Soundtrack (~112 BPM) ---
  _startGroove() {
    if (this._grooveTimer || !this.ctx || this.muted || !this.musicEnabled) return;

    // 4-bar chord progression: Am9 -> Fmaj7 -> Dm9 -> Em7 (16 steps per bar = 64 steps)
    const chords = [
      [220.0, 261.63, 329.63, 392.0, 493.88], // Am9
      [174.61, 220.0, 261.63, 329.63],        // Fmaj7
      [146.83, 174.61, 220.0, 261.63, 329.63],// Dm9
      [164.81, 196.0, 246.94, 293.66],        // Em7
    ];
    const barBassRoots = [55.0, 43.65, 73.42, 82.41]; // A1, F1, D2, E2
    const arpNotes = [
      [440, 523.25, 659.25, 493.88],
      [349.23, 440, 523.25, 659.25],
      [293.66, 349.23, 440, 523.25],
      [329.63, 392.0, 493.88, 587.33],
    ];

    const tick = () => {
      if (!this.musicActive || !this.musicEnabled || this.muted || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const step = this._grooveStep % 64;
      const bar = Math.floor(step / 16);
      const beatStep = step % 16;

      // Warm detuned pad chord at start of each bar
      if (beatStep === 0) {
        this._padChord(chords[bar], 2.15, 0.028, 680);
      }

      // Soft electronic kick on 0, 8 (and subtle ghost on 10)
      if (beatStep === 0 || beatStep === 8) {
        this._tone(105, 40, 0.14, 'sine', 0.11, 0, 240, true, false);
      } else if (beatStep === 10) {
        this._tone(95, 42, 0.1, 'sine', 0.055, 0, 220, true, false);
      }

      // Soft brushed hi-hat on off-beats
      if (beatStep % 4 === 2) {
        this._noise(0.032, 0.018, 6800, 5200, 'highpass', 0.8, 0, true);
      }

      // Punchy sidechained sub-bass (ducks slightly on kick beats by delaying 25ms)
      if (beatStep === 0 || beatStep === 3 || beatStep === 6 || beatStep === 8 || beatStep === 12 || beatStep === 14) {
        const root = barBassRoots[bar];
        const freq = beatStep === 14 ? root * 1.5 : root;
        const duckDelay = (beatStep === 0 || beatStep === 8) ? 0.028 : 0;
        this._tone(freq, freq, 0.19, 'triangle', 0.07, duckDelay, 260, true, false);
      }

      // Sparse dreamy FM bell motif
      if (beatStep === 2 || beatStep === 7 || beatStep === 11) {
        const pool = arpNotes[bar];
        const note = pool[(step + bar) % pool.length];
        this._fmTone(note, 2, note * 0.45, 0.28, 0.022, 0, true);
      }

      this._grooveStep = (this._grooveStep + 1) % 64;
    };

    tick();
    this._grooveTimer = setInterval(tick, 134); // ~112 BPM 16th notes
  }

  _stopGroove() {
    if (this._grooveTimer) {
      clearInterval(this._grooveTimer);
      this._grooveTimer = null;
    }
  }

  // --- Studio-Grade 2026 SFX ---
  jump() {
    const f0 = this._vary(210, 0.04);
    const f1 = this._vary(490, 0.04);
    this._tone(f0, f1, 0.13, 'sine', 0.14, 0);
    this._tone(f0 * 1.5, f1 * 1.5, 0.1, 'triangle', 0.055, 0.01, 1400);
    this._noise(0.09, 0.045, 900, 2600, 'bandpass', 1.4);
  }

  land(intensity = 0.6) {
    const clamped = Math.min(1, Math.max(0.2, intensity));
    this._tone(this._vary(115, 0.05), 42, 0.085, 'sine', 0.08 + clamped * 0.07, 0);
    this._noise(0.05, 0.03 * clamped, 420, 160, 'lowpass', 0.8);
  }

  stepUp() {
    const f = this._vary(392, 0.03);
    this._fmTone(f, 2, f * 0.6, 0.11, 0.09, 0);
  }

  snowball() {
    const f = this._vary(1320, 0.05);
    this._fmTone(f, 2.0, f * 0.9, 0.09, 0.085, 0);
    this._noise(0.075, 0.055, 3200, 950, 'bandpass', 1.6);
  }

  bubble() {
    const f = this._vary(340, 0.06);
    this._tone(f, f * 2.35, 0.13, 'sine', 0.11, 0);
    this._fmTone(f * 2, 1.5, f * 0.4, 0.09, 0.045, 0.02);
  }

  hitEnemy() {
    // Punchy sub-drop + warm FM transient + filtered burst
    this._tone(this._vary(180, 0.05), 46, 0.16, 'sine', 0.16, 0);
    this._fmTone(this._vary(520, 0.05), 1.5, 240, 0.12, 0.09, 0);
    this._noise(0.08, 0.06, 1600, 480, 'bandpass', 1.2);
  }

  stunEnemy() {
    const f = this._vary(740, 0.04);
    this._fmTone(f, 2.0, f * 0.8, 0.14, 0.08, 0);
    this._fmTone(f * 1.498, 2.0, f * 0.6, 0.16, 0.06, 0.035);
  }

  catchFish() {
    // Punchy sub-drop + shimmering major-9th bell chord
    this._tone(145, 52, 0.14, 'sine', 0.13, 0);
    const chord = [523.25, 659.25, 783.99, 987.77, 1174.66]; // Cmaj9
    chord.forEach((n, idx) => {
      this._fmTone(this._vary(n, 0.015), 2.0, n * 0.65, 0.28, 0.065, idx * 0.04);
    });
  }

  crumble() {
    this._tone(this._vary(96, 0.06), 36, 0.22, 'sine', 0.13, 0);
    this._noise(0.22, 0.11, 720, 180, 'lowpass', 1.1);
  }

  door() {
    const f = this._vary(293.66, 0.02);
    this._fmTone(f, 2.0, 160, 0.18, 0.08, 0);
    this._fmTone(f * 1.5, 2.0, 200, 0.2, 0.07, 0.06);
    this._tone(f * 2, f, 0.18, 'sine', 0.06, 0.1);
  }

  elevator() {
    const f = this._vary(165, 0.03);
    this._tone(f, f * 1.33, 0.11, 'sine', 0.075, 0);
    this._tone(f * 1.5, f * 2.0, 0.1, 'triangle', 0.035, 0.015, 900);
  }

  splash() {
    this._tone(150, 45, 0.22, 'sine', 0.14, 0);
    this._noise(0.42, 0.14, 1500, 320, 'bandpass', 1.3);
    // Water droplet blips
    this._tone(this._vary(480, 0.1), 760, 0.08, 'sine', 0.055, 0.06);
    this._tone(this._vary(620, 0.1), 940, 0.07, 'sine', 0.045, 0.14);
  }

  hurt() {
    this._tone(190, 44, 0.26, 'sine', 0.17, 0);
    this._tone(260, 110, 0.22, 'triangle', 0.1, 0.01, 680);
    this._noise(0.14, 0.07, 700, 200, 'lowpass', 1.0);
  }

  towerTopple() {
    // Deep cinematic sub-rumble + filtered debris
    this._tone(86, 32, 0.95, 'sine', 0.18, 0);
    this._noise(0.95, 0.14, 620, 160, 'lowpass', 1.0);
    // Warm poly-synth fanfare (Fmaj9 -> G6 -> Cmaj9)
    const chords = [
      { notes: [349.23, 440, 523.25, 659.25], delay: 0.05, dur: 0.32 },
      { notes: [392.0, 493.88, 587.33, 659.25], delay: 0.24, dur: 0.32 },
      { notes: [523.25, 659.25, 783.99, 987.77, 1174.66], delay: 0.44, dur: 0.65 },
    ];
    chords.forEach((c) => {
      c.notes.forEach((n) => {
        this._tone(n, n, c.dur, 'triangle', 0.045, c.delay, 1800);
        this._fmTone(n, 2.0, n * 0.4, c.dur, 0.032, c.delay);
      });
    });
  }

  extraLife() {
    const notes = [523.25, 659.25, 783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((n, idx) => {
      this._fmTone(n, 2.0, n * 0.7, 0.32, 0.075, idx * 0.065);
    });
  }
}

export const sound = new SoundEngine();
