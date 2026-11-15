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
    this._noiseBuffer = null;

    this.muted = false;
    this.musicEnabled = true;
    this.musicActive = false;
    this._grooveTimer = null;
    this._grooveStep = 0;
    this._nextNoteTime = 0;
    this._bindAutoUnlock();
  }

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
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Master limiter + gentle mobile-speaker highshelf de-harshing
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -12;
        this.limiter.knee.value = 14;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.004;
        this.limiter.release.value = 0.16;

        const speakerTone = this.ctx.createBiquadFilter();
        speakerTone.type = 'highshelf';
        speakerTone.frequency.value = 3400;
        speakerTone.gain.value = -4;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.92;
        this.masterGain.connect(speakerTone);
        speakerTone.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        // Pre-allocate shared 1.5s white noise buffer (zero per-hit allocation)
        const noiseLen = Math.floor(this.ctx.sampleRate * 1.5);
        this._noiseBuffer = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
        const noiseData = this._noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) {
          noiseData[i] = Math.random() * 2 - 1;
        }

        // Tight 0.55s stereo algorithmic space reverb
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = this._createReverbImpulse(0.55, 3.2);
        const reverbFilter = this.ctx.createBiquadFilter();
        reverbFilter.type = 'lowpass';
        reverbFilter.frequency.value = 2200;
        this.reverb.connect(reverbFilter);
        reverbFilter.connect(this.masterGain);

        // SFX buses (dry + light reverb send)
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 1.0;
        this.sfxGain.connect(this.masterGain);

        this.sfxReverbGain = this.ctx.createGain();
        this.sfxReverbGain.gain.value = 0.14;
        this.sfxReverbGain.connect(this.reverb);

        // Music buses (dry + light reverb send)
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicEnabled ? 0.72 : 0;
        this.musicGain.connect(this.masterGain);

        this.musicReverbGain = this.ctx.createGain();
        this.musicReverbGain.gain.value = this.musicEnabled ? 0.18 : 0;
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
      if (this.musicReverbGain) this.musicReverbGain.gain.setTargetAtTime(this.musicEnabled ? 0.18 : 0, now, 0.04);
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

  _tone(freqStart, freqEnd, duration, type = 'sine', gainVal = 0.14, delayOrTime = 0, filterFreq = null, isMusic = false, sendReverb = true, isAbsTime = false) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime;
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
    gain.connect(dryBus);
    if (sendReverb && revBus) {
      gain.connect(revBus);
    }

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  _fmTone(carrierFreq, modRatio, modDepth, duration, gainVal = 0.12, delayOrTime = 0, isMusic = false, isAbsTime = false) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const outGain = this.ctx.createGain();

    carrier.type = 'sine';
    mod.type = 'sine';
    carrier.frequency.setValueAtTime(Math.max(24, carrierFreq), now);
    mod.frequency.setValueAtTime(Math.max(24, carrierFreq * modRatio), now);

    modGain.gain.setValueAtTime(Math.max(0.5, modDepth), now);
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

  _noise(duration, gainVal = 0.08, freqStart = 1200, freqEnd = 400, filterType = 'bandpass', Q = 1.2, delayOrTime = 0, isMusic = false, isAbsTime = false) {
    if (this.muted || !this.ctx || !this.sfxGain || !this._noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;

    const now = isAbsTime ? delayOrTime : this.ctx.currentTime + delayOrTime;
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
    src.stop(now + Math.min(duration + 0.02, this._noiseBuffer.duration));
  }

  _padChord(freqs, when, duration = 2.1, gainVal = 0.026, filterFreq = 680) {
    if (this.muted || !this.ctx || !this.musicGain) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq * 0.65, when);
    filter.frequency.linearRampToValueAtTime(filterFreq, when + duration * 0.35);
    filter.frequency.linearRampToValueAtTime(filterFreq * 0.55, when + duration);
    filter.Q.value = 0.8;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(gainVal, when + 0.18);
    env.gain.setValueAtTime(gainVal * 0.85, when + duration * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0005, when + duration);

    filter.connect(env);
    env.connect(this.musicGain);
    if (this.musicReverbGain) env.connect(this.musicReverbGain);

    freqs.forEach((f) => {
      [-0.0035, 0.0035].forEach((detuneRatio) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f * (1 + detuneRatio), when);
        osc.connect(filter);
        osc.start(when);
        osc.stop(when + duration + 0.05);
      });
    });
  }

  // --- Modern 2026 Chill-Synthwave Soundtrack (Lookahead 8th-Note Groove @ ~112 BPM) ---
  _startGroove() {
    if (this._grooveTimer || !this.ctx || this.muted || !this.musicEnabled) return;

    // 4-bar chord progression: Am9 -> Fmaj7 -> Dm9 -> Em7 (8 eighth-notes per bar = 32 steps)
    const chords = [
      [220.0, 261.63, 329.63, 392.0, 493.88],  // Am9
      [174.61, 220.0, 261.63, 329.63],         // Fmaj7
      [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
      [164.81, 196.0, 246.94, 293.66],         // Em7
    ];
    // +1 octave bass roots so warm bass is clearly audible on phone speakers
    const barBassRoots = [110.0, 87.31, 73.42, 82.41]; // A2, F2, D2, E2
    const arpNotes = [
      [440, 523.25, 659.25, 493.88],
      [349.23, 440, 523.25, 659.25],
      [293.66, 349.23, 440, 523.25],
      [329.63, 392.0, 493.88, 587.33],
    ];

    const stepDur = 60 / 112 / 2; // ~0.2678s per 8th note
    this._nextNoteTime = this.ctx.currentTime + 0.04;

    const scheduleStep = (stepIdx, when) => {
      const step = stepIdx % 32;
      const bar = Math.floor(step / 8);
      const beatStep = step % 8;

      // Warm detuned pad chord at start of each bar
      if (beatStep === 0) {
        this._padChord(chords[bar], when, 2.1, 0.026, 680);
      }

      // Tight electronic kick on beats 1 & 3 (steps 0, 4)
      if (beatStep === 0 || beatStep === 4) {
        this._tone(115, 44, 0.11, 'sine', 0.11, when, 240, true, false, true);
      }

      // Crisp, warm electronic snare/rim on beats 2 & 4 (steps 2, 6)
      if (beatStep === 2 || beatStep === 6) {
        this._tone(195, 125, 0.05, 'sine', 0.032, when, 500, true, false, true);
        this._noise(0.045, 0.022, 1900, 1200, 'bandpass', 1.2, when, true, true);
      }

      // Soft brushed hi-hat on off-beats (steps 1, 3, 5, 7)
      if (beatStep % 2 === 1) {
        this._noise(0.026, 0.013, 5000, 3800, 'bandpass', 0.8, when, true, true);
      }

      // Punchy sidechained bass on 8th-note groove
      if (beatStep === 0 || beatStep === 2 || beatStep === 3 || beatStep === 4 || beatStep === 6 || beatStep === 7) {
        const root = barBassRoots[bar];
        const freq = beatStep === 7 ? root * 1.5 : root;
        const duckTime = (beatStep === 0 || beatStep === 4) ? when + 0.026 : when;
        this._tone(freq, freq, 0.17, 'triangle', 0.07, duckTime, 360, true, false, true);
      }

      // Sparse dreamy soft FM bell motif
      if (beatStep === 1 || beatStep === 5) {
        const pool = arpNotes[bar];
        const note = pool[(step + bar) % pool.length];
        this._fmTone(note, 2, note * 0.18, 0.28, 0.02, when, true, true);
      }
    };

    const scheduler = () => {
      if (!this.musicActive || !this.musicEnabled || this.muted || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      // Catch up if tab was backgrounded
      if (this._nextNoteTime < this.ctx.currentTime - 0.2) {
        this._nextNoteTime = this.ctx.currentTime + 0.02;
      }
      while (this._nextNoteTime < this.ctx.currentTime + 0.1) {
        scheduleStep(this._grooveStep, this._nextNoteTime);
        this._nextNoteTime += stepDur;
        this._grooveStep = (this._grooveStep + 1) % 32;
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
}

export const sound = new SoundEngine();
