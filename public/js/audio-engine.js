/**
 * WebDAW — Audio Engine
 * Web Audio API tabanlı ses motoru
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.compressor = null;
    this.buffers = {};        // sampleId -> AudioBuffer
    this.channelNodes = {};   // channelId -> { gain, pan }
    this.isReady = false;
    this.scheduledSources = [];

    // Built-in drum synthesizer için
    this._initOnUserGesture();
  }

  _initOnUserGesture() {
    const init = () => {
      if (!this.isReady) this._setup();
      document.removeEventListener('click', init);
      document.removeEventListener('keydown', init);
    };
    document.addEventListener('click', init);
    document.addEventListener('keydown', init);
  }

  _setup() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -6;
      this.compressor.knee.value = 3;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.1;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.isReady = true;
      console.log('[AudioEngine] Ready. Sample rate:', this.ctx.sampleRate);
    } catch (e) {
      console.error('[AudioEngine] Init failed:', e);
    }
  }

  // AudioContext resume (bazı browserlar suspend eder)
  async resume() {
    if (!this.isReady) this._setup();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // ── BUFFER PLAYER ──
  async loadFromUrl(id, url) {
    await this.resume();
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(ab);
      this.buffers[id] = buf;
      return buf;
    } catch (e) {
      console.warn('[AudioEngine] loadFromUrl failed:', url, e);
      return null;
    }
  }

  async loadFromFile(id, file) {
    await this.resume();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const ab = e.target.result;
          const buf = await this.ctx.decodeAudioData(ab);
          this.buffers[id] = buf;
          resolve(buf);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Bir buffer oynat
   * @param {string} id - buffer id
   * @param {number} when - AudioContext zamanı
   * @param {number} volume - 0..1
   * @param {number} pan - -1..1
   * @param {number} pitch - cents (yarım ton = 100)
   */
  playBuffer(id, when = 0, volume = 1, pan = 0, pitch = 0) {
    if (!this.isReady || !this.buffers[id]) {
      // Fallback: sentetik ses çal
      this._playSyntheticHit(id, when, volume);
      return;
    }

    const buf = this.buffers[id];
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (pitch !== 0) {
      src.detune.value = pitch;
    }

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume;

    const panNode = this.ctx.createStereoPanner();
    panNode.pan.value = pan;

    src.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(this.masterGain);

    src.start(when > 0 ? when : this.ctx.currentTime);
    src.onended = () => {
      src.disconnect();
      gainNode.disconnect();
      panNode.disconnect();
    };
    return src;
  }

  /**
   * Built-in drum synthesizer (sample olmadan çalar)
   */
  _playSyntheticHit(id, when, volume = 0.8) {
    if (!this.isReady) return;
    const t = when > 0 ? when : this.ctx.currentTime;
    const name = id.toLowerCase();

    if (name.includes('kick') || name.includes('bass')) {
      this._synthKick(t, volume);
    } else if (name.includes('snare') || name.includes('clap')) {
      this._synthSnare(t, volume);
    } else if (name.includes('hat') || name.includes('hi')) {
      this._synthHihat(t, volume, name.includes('open'));
    } else if (name.includes('tom')) {
      this._synthTom(t, volume);
    } else if (name.includes('crash') || name.includes('ride')) {
      this._synthCymbal(t, volume);
    } else if (name.includes('bass') || name.includes('sub')) {
      this._synthBass(t, volume);
    } else {
      this._synthBeep(t, volume);
    }
  }

  _synthKick(t, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.35);
  }

  _synthSnare(t, vol) {
    // Tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(vol * 0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(oscGain); oscGain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.15);
    // Noise
    const buf = this._createNoiseBuffer(0.2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const noiseGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    noiseGain.gain.setValueAtTime(vol, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(filter); filter.connect(noiseGain); noiseGain.connect(this.masterGain);
    src.start(t); src.stop(t + 0.2);
  }

  _synthHihat(t, vol, isOpen = false) {
    const dur = isOpen ? 0.4 : 0.08;
    const buf = this._createNoiseBuffer(dur);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    gain.gain.setValueAtTime(vol * 0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    src.start(t); src.stop(t + dur);
  }

  _synthTom(t, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  _synthCymbal(t, vol) {
    const frequencies = [205, 311, 405, 534, 708, 947];
    frequencies.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(vol / frequencies.length, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(t); osc.stop(t + 0.8);
    });
  }

  _synthBass(t, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.4);
  }

  _synthBeep(t, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(vol * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + 0.1);
  }

  _createNoiseBuffer(duration) {
    const sampleRate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    return buf;
  }

  // ── MASTER VOLUME ──
  setMasterVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
    }
  }

  // ── ANALYSER DATA ──
  getAnalyserData() {
    if (!this.analyser) return new Uint8Array(128).fill(0);
    this.analyser.getByteTimeDomainData(this.analyserData);
    return this.analyserData;
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(128).fill(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}

window.audioEngine = new AudioEngine();
