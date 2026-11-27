// Keyboard + pointer input. The game polls edge-triggered actions each frame;
// holding a key never repeats a lane change, and blur clears stuck keys.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.queue = []; // 'left' | 'right' | 'jump' | 'slide'
    this.paused = false;
    this.muted = false;
    this.onPause = null;
    this.onMute = null;
    this.onAnyGesture = null;
    this._canvas = canvas;
    this._pointerDownX = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this._gesture();
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') { this.queue.push('left'); e.preventDefault(); }
      else if (code === 'ArrowRight' || code === 'KeyD') { this.queue.push('right'); e.preventDefault(); }
      else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') { this.queue.push('jump'); e.preventDefault(); }
      else if (code === 'ArrowDown' || code === 'KeyS') { this.queue.push('slide'); e.preventDefault(); }
      else if (code === 'KeyP' || code === 'Escape') { this.paused = !this.paused; if (this.onPause) this.onPause(this.paused); }
      else if (code === 'KeyM') { this.muted = !this.muted; if (this.onMute) this.onMute(this.muted); }
      else if (code === 'Enter') { this.queue.push('confirm'); }
      this.keys.add(code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => {
      this._gesture();
      this._pointerDownX = e.clientX;
    });
    canvas.addEventListener('pointerup', (e) => {
      if (this._pointerDownX === null) return;
      const dx = e.clientX - this._pointerDownX;
      this._pointerDownX = null;
      if (Math.abs(dx) > 24) this.queue.push(dx > 0 ? 'right' : 'left');
      else if (e.clientY < window.innerHeight * 0.4) this.queue.push('jump');
      else this.queue.push(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    });
  }

  _gesture() {
    if (this.onAnyGesture) this.onAnyGesture();
  }

  /** Drain queued actions since the last frame. */
  takeActions() {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
