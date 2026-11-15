// Web Audio API Retro-Modern Synthesizer for Tower Toppler '26
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
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
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 1;
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.musicEnabled ? 0.55 : 0;
        this.musicGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicActive && this.musicEnabled && !this.muted) {
      this._startGroove();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.015);
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
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.55 : 0, this.ctx.currentTime, 0.03);
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

  _vary(freq, pct = 0.04) {
    return freq * (1 + (Math.random() * 2 - 1) * pct);
  }

  _tone(freqStart, freqEnd, duration, type = 'square', gainVal = 0.12, delay = 0, filterFreq = null, targetBus = null) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    const dest = targetBus || this.sfxGain;
    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.value = 1.6;
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  _noise(duration, gainVal = 0.12, filterFreq = 800, filterType = 'lowpass', delay = 0) {
    if (this.muted || !this.ctx || !this.sfxGain) return;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime + delay;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
  }

  _startGroove() {
    if (this._grooveTimer || !this.ctx || this.muted || !this.musicEnabled) return;
    // Subtle retro-synth A-minor / Dorian bass + arpeggio at ~136 BPM (16th-ish 145ms steps)
    const bassPattern = [110, 0, 110, 130.81, 146.83, 0, 130.81, 98, 110, 0, 110, 164.81, 146.83, 0, 130.81, 98];
    const arpPattern = [440, 523.25, 659.25, 523.25, 587.33, 440, 523.25, 659.25, 440, 523.25, 783.99, 659.25, 587.33, 523.25, 440, 392];

    const tick = () => {
      if (!this.musicActive || !this.musicEnabled || this.muted || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const step = this._grooveStep % bassPattern.length;
      const bassFreq = bassPattern[step];
      const arpFreq = arpPattern[step];

      if (bassFreq > 0) {
        this._tone(bassFreq, bassFreq * 0.99, 0.13, 'sawtooth', 0.055, 0, 420, this.musicGain);
      }
      if (step % 2 === 0 && arpFreq > 0) {
        this._tone(arpFreq, arpFreq, 0.11, 'triangle', 0.032, 0.01, 1400, this.musicGain);
      }
      this._grooveStep = (this._grooveStep + 1) % bassPattern.length;
    };

    tick();
    this._grooveTimer = setInterval(tick, 150);
  }

  _stopGroove() {
    if (this._grooveTimer) {
      clearInterval(this._grooveTimer);
      this._grooveTimer = null;
    }
  }

  jump() {
    const f0 = this._vary(240, 0.05);
    const f1 = this._vary(580, 0.05);
    this._tone(f0, f1, 0.12, 'triangle', 0.11, 0, 2400);
    this._tone(f0 * 1.5, f1 * 1.25, 0.09, 'square', 0.045, 0.015, 1900);
  }

  land(intensity = 0.6) {
    const g = 0.04 + Math.min(1, intensity) * 0.05;
    this._tone(this._vary(130, 0.06), 55, 0.07, 'triangle', g, 0, 450);
  }

  stepUp() {
    const f = this._vary(340, 0.04);
    this._tone(f, f * 1.45, 0.08, 'triangle', 0.09, 0, 1800);
  }

  snowball() {
    const f = this._vary(920, 0.06);
    this._tone(f, f * 0.36, 0.09, 'sine', 0.1);
    this._tone(f * 1.5, f * 0.6, 0.06, 'triangle', 0.045, 0, 2600);
    this._noise(0.05, 0.045, 2200, 'bandpass');
  }

  bubble() {
    const f = this._vary(360, 0.07);
    this._tone(f, f * 2.05, 0.11, 'sine', 0.095);
    this._tone(f * 1.5, f * 2.5, 0.08, 'triangle', 0.04, 0.02, 2200);
  }

  hitEnemy() {
    const f = this._vary(520, 0.06);
    this._tone(f, 130, 0.14, 'sawtooth', 0.1, 0, 1600);
    this._tone(f * 1.25, 195, 0.11, 'square', 0.055, 0.01, 1200);
    this._noise(0.07, 0.07, 1100, 'bandpass');
  }

  stunEnemy() {
    const f = this._vary(660, 0.05);
    this._tone(f, f * 1.33, 0.09, 'triangle', 0.095, 0, 2400);
    this._tone(f * 1.5, f * 2.0, 0.09, 'sine', 0.055, 0.025);
  }

  catchFish() {
    const base = this._vary(523.25, 0.03);
    this._tone(base, base * 1.25, 0.08, 'triangle', 0.1, 0, 2600);
    this._tone(base * 1.5, base * 2.0, 0.13, 'triangle', 0.1, 0.065, 2800);
    this._tone(base * 2.0, base * 2.0, 0.14, 'sine', 0.06, 0.11);
  }

  crumble() {
    this._noise(0.18, 0.12, 720, 'bandpass');
    this._tone(this._vary(140, 0.08), 52, 0.16, 'triangle', 0.09, 0, 380);
  }

  door() {
    const f = this._vary(240, 0.03);
    this._tone(f, f * 2, 0.1, 'sine', 0.09, 0);
    this._tone(f * 1.5, f * 3, 0.09, 'triangle', 0.045, 0.01, 2000);
    this._tone(f * 2, f, 0.1, 'sine', 0.08, 0.09);
  }

  elevator() {
    const f = this._vary(155, 0.04);
    this._tone(f, f * 1.35, 0.08, 'triangle', 0.06, 0, 900);
    this._tone(f * 1.5, f * 2.0, 0.06, 'sine', 0.03, 0.01);
  }

  splash() {
    this._noise(0.38, 0.18, 950, 'bandpass');
    this._tone(290, 75, 0.26, 'sine', 0.11);
    this._tone(480, 180, 0.15, 'triangle', 0.06, 0.04, 1500);
  }

  hurt() {
    this._tone(310, 88, 0.24, 'sawtooth', 0.12, 0, 1100);
    this._tone(220, 62, 0.24, 'square', 0.07, 0.015, 700);
    this._noise(0.12, 0.08, 600, 'lowpass');
  }

  towerTopple() {
    this._noise(0.95, 0.22, 460, 'lowpass');
    this._tone(110, 48, 0.65, 'sawtooth', 0.1, 0, 360);
    this._tone(440, 880, 0.15, 'square', 0.085, 0, 2200);
    this._tone(554.37, 1108.73, 0.15, 'square', 0.085, 0.12, 2400);
    this._tone(659.25, 1318.51, 0.24, 'square', 0.1, 0.24, 2600);
    this._tone(880, 880, 0.28, 'triangle', 0.07, 0.34, 2800);
  }

  extraLife() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((n, idx) => {
      this._tone(n, n, 0.09, 'square', 0.08, idx * 0.07, 2400);
      this._tone(n * 0.5, n * 0.5, 0.09, 'triangle', 0.05, idx * 0.07, 1600);
    });
  }
}

export const sound = new SoundEngine();
