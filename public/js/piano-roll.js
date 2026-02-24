/**
 * WebDAW — Piano Roll
 * Canvas tabanlı MIDI piano roll editörü
 */

class PianoRoll {
  constructor(sequencer, engine) {
    this.seq = sequencer;
    this.engine = engine;
    this.canvas = document.getElementById('roll-canvas');
    this.ctx2d = this.canvas ? this.canvas.getContext('2d') : null;
    this.notes = []; // { pitch, beat, duration, velocity }
    this.zoom = { x: 60, y: 20 }; // px per beat, px per note
    this.scrollX = 0;
    this.scrollY = 0;
    this.totalBeats = 32;
    this.isDragging = false;
    this.dragNote = null;

    // MIDI note names
    this.noteNames = [];
    for (let n = 127; n >= 0; n--) {
      const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
      const oct = Math.floor(n / 12) - 1;
      this.noteNames.push(names[n % 12] + oct);
    }

    if (this.canvas) this._bindEvents();
  }

  resize() {
    const container = document.getElementById('roll-grid');
    if (!container || !this.canvas) return;
    this.canvas.width = Math.max(container.clientWidth, this.totalBeats * this.zoom.x);
    this.canvas.height = 128 * this.zoom.y;
    this.draw();
  }

  draw() {
    if (!this.ctx2d) return;
    const ctx = this.ctx2d;
    const W = this.canvas.width;
    const H = this.canvas.height;

    // Background
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(0, 0, W, H);

    // Row backgrounds (black/white keys)
    for (let n = 0; n < 128; n++) {
      const y = n * this.zoom.y;
      const pitch = 127 - n;
      const isBlack = [1,3,6,8,10].includes(pitch % 12);
      ctx.fillStyle = isBlack ? '#161620' : '#202028';
      ctx.fillRect(0, y, W, this.zoom.y);

      // C lines
      if (pitch % 12 === 0) {
        ctx.fillStyle = 'rgba(255,107,0,0.15)';
        ctx.fillRect(0, y, W, 1);
      }
    }

    // Grid lines (beats)
    for (let b = 0; b <= this.totalBeats; b++) {
      const x = b * this.zoom.x;
      const isBar = b % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(255,107,0,0.3)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
      ctx.stroke();

      // 16th subdivisions
      for (let s = 1; s < 4; s++) {
        const sx = x + (s / 4) * this.zoom.x;
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
        ctx.stroke();
      }
    }

    // Notes
    this.notes.forEach(note => {
      const x = note.beat * this.zoom.x;
      const y = (127 - note.pitch) * this.zoom.y;
      const w = Math.max(note.duration * this.zoom.x - 2, 4);
      const h = this.zoom.y - 1;
      const vel = (note.velocity || 100) / 127;

      const r = Math.round(255 * vel);
      const g = Math.round(107 * vel);
      ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
      ctx.shadowColor = 'rgba(255,107,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, w, h, 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Playhead
    if (this.seq && this.seq.isPlaying) {
      const playX = this.seq.currentStep * (this.zoom.x / 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0); ctx.lineTo(playX, H);
      ctx.stroke();
    }
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => { this.isDragging = false; this.dragNote = null; });
    this.canvas.addEventListener('contextmenu', e => { e.preventDefault(); this._removeNote(e); });
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      beat: (e.clientX - rect.left) / this.zoom.x,
      pitch: 127 - Math.floor((e.clientY - rect.top) / this.zoom.y)
    };
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const { beat, pitch } = this._getPos(e);
    const snapBeat = Math.floor(beat * 4) / 4;

    // Check if clicking existing note
    const existing = this.notes.find(n =>
      n.pitch === pitch &&
      snapBeat >= n.beat &&
      snapBeat < n.beat + n.duration
    );

    if (existing) {
      this.isDragging = true;
      this.dragNote = existing;
    } else {
      const note = { pitch, beat: snapBeat, duration: 0.25, velocity: 100 };
      this.notes.push(note);
      this.isDragging = true;
      this.dragNote = note;
      // Preview sound
      this.engine.resume().then(() => {
        this._playPreviewNote(pitch);
      });
    }
    this.draw();
  }

  _onMouseMove(e) {
    if (!this.isDragging || !this.dragNote) return;
    const { beat } = this._getPos(e);
    const dur = Math.max(0.25, Math.round((beat - this.dragNote.beat) * 4) / 4);
    this.dragNote.duration = dur;
    this.draw();
  }

  _removeNote(e) {
    const { beat, pitch } = this._getPos(e);
    this.notes = this.notes.filter(n =>
      !(n.pitch === pitch && beat >= n.beat && beat < n.beat + n.duration)
    );
    this.draw();
  }

  _playPreviewNote(pitch) {
    if (!this.engine.isReady) return;
    const freq = 440 * Math.pow(2, (pitch - 69) / 12);
    const osc = this.engine.ctx.createOscillator();
    const gain = this.engine.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, this.engine.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.engine.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.engine.masterGain);
    osc.start();
    osc.stop(this.engine.ctx.currentTime + 0.3);
  }

  buildPianoKeys() {
    const container = document.getElementById('piano-keys');
    if (!container) return;
    container.innerHTML = '';
    for (let p = 127; p >= 0; p--) {
      const div = document.createElement('div');
      const isBlack = [1,3,6,8,10].includes(p % 12);
      div.className = `piano-key ${isBlack ? 'black' : 'white'}`;
      div.style.height = this.zoom.y + 'px';
      if (p % 12 === 0) div.textContent = `C${Math.floor(p/12)-1}`;
      div.addEventListener('click', () => this._playPreviewNote(p));
      container.appendChild(div);
    }
  }
}

window.PianoRoll = PianoRoll;
