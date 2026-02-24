/**
 * WebDAW — Step Sequencer & Master Clock
 * 16-adımlı step sequencer, BPM kontrolü, swing
 */

class Sequencer {
  constructor(engine) {
    this.engine = engine;
    this.bpm = 128;
    this.steps = 16;
    this.swing = 0;
    this.isPlaying = false;
    this.currentStep = 0;
    this.nextStepTime = 0;
    this.timerWorker = null;
    this.scheduleAheadTime = 0.1;
    this.lookahead = 25; // ms

    this.channels = [];
    this.patterns = [];
    this.currentPatternIdx = 0;
    this.soloChannel = null;

    this._elapsedTime = 0;
    this._playStartTime = 0;
    this._timerInterval = null;

    this._initDefaultChannels();
    this._initDefaultPatterns();
  }

  get stepInterval() {
    // 1 beat = 60/BPM sec, 1 step = 1 sixteenth note
    return (60 / this.bpm) / 4;
  }

  get currentPattern() {
    return this.patterns[this.currentPatternIdx];
  }

  _initDefaultChannels() {
    const defaults = [
      { name: 'Kick',     color: '#ff4444', sampleId: 'kick' },
      { name: 'Snare',    color: '#ff8800', sampleId: 'snare' },
      { name: 'Hi-Hat',   color: '#ffdd00', sampleId: 'hihat' },
      { name: 'Open Hat', color: '#88ff00', sampleId: 'hihat_open' },
      { name: 'Tom',      color: '#00e5ff', sampleId: 'tom' },
      { name: 'Clap',     color: '#c800ff', sampleId: 'clap' },
      { name: 'Bass',     color: '#ff0088', sampleId: 'bass' },
      { name: 'Crash',    color: '#00ffaa', sampleId: 'crash' },
    ];

    defaults.forEach((d, i) => {
      this.channels.push({
        id: `ch_${i}`,
        name: d.name,
        color: d.color,
        sampleId: d.sampleId,
        volume: 1.0,
        pan: 0,
        muted: false,
        soloed: false,
      });
    });
  }

  _initDefaultPatterns() {
    const emptySteps = () => new Array(this.steps).fill(false);

    const pat1 = {
      id: 'pat_0',
      name: 'Pattern 1',
      steps: {}
    };
    // Default beat
    this.channels.forEach(ch => {
      pat1.steps[ch.id] = emptySteps();
    });
    // Classic 4-on-the-floor
    if (this.channels[0]) {
      pat1.steps[this.channels[0].id] = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(Boolean);
    }
    if (this.channels[1]) {
      pat1.steps[this.channels[1].id] = [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(Boolean);
    }
    if (this.channels[2]) {
      pat1.steps[this.channels[2].id] = [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0].map(Boolean);
    }

    this.patterns.push(pat1);
    this.currentPatternIdx = 0;
  }

  addPattern() {
    const idx = this.patterns.length;
    const pat = {
      id: `pat_${Date.now()}`,
      name: `Pattern ${idx + 1}`,
      steps: {}
    };
    this.channels.forEach(ch => {
      pat.steps[ch.id] = new Array(this.steps).fill(false);
    });
    this.patterns.push(pat);
    return pat;
  }

  addChannel(name = null, color = null) {
    const id = `ch_${Date.now()}`;
    const colors = ['#ff4444','#ff8800','#ffdd00','#88ff00','#00e5ff','#c800ff','#ff0088','#00ffaa'];
    const ch = {
      id,
      name: name || `Channel ${this.channels.length + 1}`,
      color: color || colors[this.channels.length % colors.length],
      sampleId: id,
      volume: 1.0,
      pan: 0,
      muted: false,
      soloed: false,
    };
    this.channels.push(ch);
    // Add steps to all patterns
    this.patterns.forEach(pat => {
      pat.steps[id] = new Array(this.steps).fill(false);
    });
    return ch;
  }

  removeChannel(id) {
    this.channels = this.channels.filter(c => c.id !== id);
    this.patterns.forEach(pat => { delete pat.steps[id]; });
  }

  getSteps(channelId) {
    const pat = this.currentPattern;
    if (!pat || !pat.steps[channelId]) {
      return new Array(this.steps).fill(false);
    }
    return pat.steps[channelId];
  }

  toggleStep(channelId, stepIdx) {
    const pat = this.currentPattern;
    if (!pat.steps[channelId]) {
      pat.steps[channelId] = new Array(this.steps).fill(false);
    }
    pat.steps[channelId][stepIdx] = !pat.steps[channelId][stepIdx];
    return pat.steps[channelId][stepIdx];
  }

  setSteps(n) {
    this.steps = n;
    // Resize all patterns
    this.patterns.forEach(pat => {
      Object.keys(pat.steps).forEach(cid => {
        const old = pat.steps[cid];
        if (old.length < n) {
          pat.steps[cid] = [...old, ...new Array(n - old.length).fill(false)];
        } else {
          pat.steps[cid] = old.slice(0, n);
        }
      });
    });
  }

  // ── CLOCK ──
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this._playStartTime = performance.now();
    this.engine.resume().then(() => {
      this.nextStepTime = this.engine.currentTime;
      this._schedule();
    });
  }

  stop() {
    this.isPlaying = false;
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    this.currentStep = 0;
    this._elapsedTime = 0;
  }

  _schedule() {
    if (!this.isPlaying) return;
    this._timerInterval = setInterval(() => {
      if (!this.isPlaying) { clearInterval(this._timerInterval); return; }
      while (this.nextStepTime < this.engine.currentTime + this.scheduleAheadTime) {
        this._scheduleStep(this.currentStep, this.nextStepTime);
        this._advanceStep();
      }
      // Update elapsed time
      this._elapsedTime = performance.now() - this._playStartTime;
    }, this.lookahead);
  }

  _scheduleStep(step, time) {
    const hasSolo = this.channels.some(c => c.soloed);

    this.channels.forEach(ch => {
      if (ch.muted) return;
      if (hasSolo && !ch.soloed) return;

      const steps = this.getSteps(ch.id);
      if (steps[step]) {
        // Swing offset (only on odd 8ths)
        let swingOffset = 0;
        if (this.swing > 0 && step % 2 === 1) {
          swingOffset = this.stepInterval * (this.swing / 100) * 0.5;
        }
        this.engine.playBuffer(
          ch.sampleId,
          time + swingOffset,
          ch.volume,
          ch.pan
        );
      }
    });
  }

  _advanceStep() {
    this.nextStepTime += this.stepInterval;
    this.currentStep = (this.currentStep + 1) % this.steps;
  }

  getElapsedTime() {
    if (!this.isPlaying) return this._elapsedTime;
    return performance.now() - this._playStartTime;
  }

  // ── SERIALIZATION ──
  toJSON() {
    return {
      project_name: 'WebDAW Project',
      version: '1.0',
      bpm: this.bpm,
      steps: this.steps,
      swing: this.swing,
      channels: this.channels,
      patterns: this.patterns,
      currentPatternIdx: this.currentPatternIdx,
    };
  }

  fromJSON(data) {
    this.bpm = data.bpm || 128;
    this.steps = data.steps || 16;
    this.swing = data.swing || 0;
    this.channels = data.channels || [];
    this.patterns = data.patterns || [];
    this.currentPatternIdx = data.currentPatternIdx || 0;
  }
}

window.sequencer = null; // init in app.js
