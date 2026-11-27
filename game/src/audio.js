// Procedural sound effects with plain WebAudio: no audio files, no network.
// The context is created on the first user gesture, so autoplay rules never block it.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._master = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = 0.35;
      this._master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this._master) this._master.gain.value = muted ? 0 : 0.35;
  }

  _tone(freq0, freq1, dur, type, vol, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this._master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._master);
    src.start(t);
  }

  gobble() {
    // A turkey gobble: four quick descending blips.
    [520, 430, 360, 300].forEach((f, i) => this._tone(f, f * 0.82, 0.09, 'square', 0.16, i * 0.09));
  }

  jump() { this._tone(280, 620, 0.16, 'sine', 0.2); }
  slide() { this._noise(0.18, 0.12, 900); }

  coin() {
    this._tone(880, 880, 0.09, 'sine', 0.22);
    this._tone(1318, 1318, 0.14, 'sine', 0.2, 0.08);
  }

  crash() {
    this._noise(0.25, 0.4, 500);
    this._tone(160, 55, 0.3, 'sawtooth', 0.3);
  }

  farmerYell() {
    this._tone(220, 330, 0.18, 'sawtooth', 0.18);
    this._tone(330, 260, 0.16, 'sawtooth', 0.15, 0.16);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, f, 0.22, 'triangle', 0.22, i * 0.13));
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this._tone(f, f * 0.94, 0.25, 'triangle', 0.2, i * 0.16));
  }

  click() { this._tone(700, 700, 0.05, 'sine', 0.15); }
}
