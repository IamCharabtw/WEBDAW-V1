/**
 * WebDAW — Mixer Panel
 */

class Mixer {
  constructor(sequencer) {
    this.seq = sequencer;
    this.meterIntervals = {};
    this.fakeLevel = {}; // Simulated meter levels
  }

  render() {
    const container = document.getElementById('mixer-channels');
    if (!container) return;
    container.innerHTML = '';

    this.seq.channels.forEach(ch => {
      const el = this._buildChannel(ch);
      container.appendChild(el);
      this._startMeter(ch.id);
    });
  }

  _buildChannel(ch) {
    const div = document.createElement('div');
    div.className = 'mixer-channel';
    div.dataset.chId = ch.id;

    // Fader
    const faderWrap = document.createElement('div');
    faderWrap.className = 'fader-wrap';
    const fader = document.createElement('input');
    fader.type = 'range';
    fader.className = 'fader-v';
    fader.min = 0; fader.max = 127; fader.value = Math.round(ch.volume * 100);
    fader.setAttribute('orient', 'vertical');
    fader.addEventListener('input', e => {
      ch.volume = parseInt(e.target.value) / 100;
    });
    faderWrap.appendChild(fader);

    // Meter
    const meter = document.createElement('div');
    meter.className = 'channel-meter';
    meter.id = `meter_${ch.id}`;
    const bar = document.createElement('div');
    bar.className = 'meter-bar';
    meter.appendChild(bar);

    // Color dot
    const dot = document.createElement('div');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${ch.color};margin:2px auto;`;

    // Name
    const name = document.createElement('span');
    name.className = 'ch-name';
    name.textContent = ch.name;

    div.appendChild(faderWrap);
    div.appendChild(meter);
    div.appendChild(dot);
    div.appendChild(name);
    return div;
  }

  _startMeter(chId) {
    if (this.meterIntervals[chId]) clearInterval(this.meterIntervals[chId]);
    this.fakeLevel[chId] = 0;
  }

  // Called when a step fires to animate the meter
  triggerMeter(chId) {
    this.fakeLevel[chId] = 90 + Math.random() * 10;
    const bar = document.querySelector(`#meter_${chId} .meter-bar`);
    if (bar) {
      bar.style.height = this.fakeLevel[chId] + '%';
      setTimeout(() => {
        let lv = this.fakeLevel[chId];
        const decay = setInterval(() => {
          lv -= 8;
          if (lv <= 0) { lv = 0; clearInterval(decay); }
          if (bar) bar.style.height = lv + '%';
        }, 30);
      }, 50);
    }
  }

  updateChannel(ch) {
    const el = document.querySelector(`[data-ch-id="${ch.id}"] .fader-v`);
    if (el) el.value = Math.round(ch.volume * 100);
  }

  addChannel(ch) {
    const container = document.getElementById('mixer-channels');
    if (!container) return;
    const el = this._buildChannel(ch);
    container.appendChild(el);
  }

  removeChannel(id) {
    const el = document.querySelector(`.mixer-channel[data-ch-id="${id}"]`);
    if (el) el.remove();
  }
}

window.Mixer = Mixer;
