// Web Audio API Retro-Modern Synthesizer for Tower Toppler '26
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freqStart, freqEnd, duration, type = 'square', gainVal = 0.12, delay = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  _noise(duration, gainVal = 0.12, filterFreq = 800) {
    if (this.muted || !this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
  }

  jump() {
    this._tone(240, 560, 0.12, 'square', 0.1);
  }

  stepUp() {
    this._tone(320, 480, 0.08, 'triangle', 0.1);
  }

  snowball() {
    this._tone(880, 320, 0.09, 'sine', 0.11);
  }

  bubble() {
    this._tone(360, 740, 0.11, 'sine', 0.1);
  }

  hitEnemy() {
    this._tone(520, 140, 0.14, 'sawtooth', 0.12);
  }

  stunEnemy() {
    this._tone(660, 880, 0.08, 'triangle', 0.1);
  }

  catchFish() {
    this._tone(523, 784, 0.08, 'triangle', 0.12, 0);
    this._tone(784, 1046, 0.12, 'triangle', 0.12, 0.07);
  }

  crumble() {
    this._noise(0.16, 0.11, 650);
  }

  door() {
    this._tone(220, 440, 0.1, 'sine', 0.1, 0);
    this._tone(440, 220, 0.1, 'sine', 0.1, 0.09);
  }

  elevator() {
    this._tone(150, 210, 0.07, 'triangle', 0.06);
  }

  splash() {
    this._noise(0.35, 0.18, 900);
    this._tone(280, 80, 0.25, 'sine', 0.12);
  }

  hurt() {
    this._tone(300, 90, 0.24, 'sawtooth', 0.14);
  }

  towerTopple() {
    this._noise(0.9, 0.22, 420);
    this._tone(440, 880, 0.14, 'square', 0.1, 0);
    this._tone(554, 1108, 0.14, 'square', 0.1, 0.12);
    this._tone(659, 1318, 0.22, 'square', 0.12, 0.24);
  }

  extraLife() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, idx) => this._tone(n, n, 0.09, 'square', 0.1, idx * 0.08));
  }
}

export const sound = new SoundEngine();
