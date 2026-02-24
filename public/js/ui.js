/**
 * WebDAW — UI Module
 * Sequencer render, browser, pattern tabs vs.
 */

class DAWui {
  constructor(seq, mixer, pianoRoll, engine) {
    this.seq = seq;
    this.mixer = mixer;
    this.pianoRoll = pianoRoll;
    this.engine = engine;
    this.contextTarget = null;
    this.visAnimFrame = null;

    // Browser sample library
    this.library = {
      drums: [
        { name: 'Kick 808',     id: 'kick',       icon: '🥁' },
        { name: 'Kick Dry',     id: 'kick_dry',   icon: '🥁' },
        { name: 'Snare Main',   id: 'snare',      icon: '🪘' },
        { name: 'Snare Rimshot',id: 'snare_rim',  icon: '🪘' },
        { name: 'Hi-Hat Closed',id: 'hihat',      icon: '🎵' },
        { name: 'Hi-Hat Open',  id: 'hihat_open', icon: '🎵' },
        { name: 'Tom High',     id: 'tom',        icon: '🥁' },
        { name: 'Clap',         id: 'clap',       icon: '👏' },
        { name: 'Crash',        id: 'crash',      icon: '✨' },
        { name: 'Ride',         id: 'ride',       icon: '✨' },
      ],
      synth: [
        { name: 'Synth Lead',   id: 'synth_lead', icon: '🎹' },
        { name: 'Synth Pad',    id: 'synth_pad',  icon: '🎹' },
        { name: 'Arp',          id: 'arp',        icon: '🎹' },
      ],
      bass: [
        { name: 'Bass 808',     id: 'bass',       icon: '🎸' },
        { name: 'Bass Sub',     id: 'bass_sub',   icon: '🎸' },
        { name: 'Bass Pluck',   id: 'bass_pluck', icon: '🎸' },
      ],
      fx: [
        { name: 'Riser',        id: 'riser',      icon: '⬆️' },
        { name: 'Down Sweep',   id: 'down_sweep', icon: '⬇️' },
        { name: 'Noise Burst',  id: 'noise',      icon: '💥' },
      ],
      user: []
    };
    this.activeCategory = 'drums';
  }

  // ── SEQUENCER RENDER ──
  renderSequencer() {
    this._renderStepHeader();
    this._renderChannels();
  }

  _renderStepHeader() {
    const header = document.getElementById('seq-steps-header');
    if (!header) return;
    header.innerHTML = '';
    for (let i = 0; i < this.seq.steps; i++) {
      const span = document.createElement('span');
      span.className = `step-num ${i % 4 === 0 ? 'beat' : ''}`;
      span.textContent = i + 1;
      header.appendChild(span);
    }
  }

  _renderChannels() {
    const container = document.getElementById('seq-channels');
    if (!container) return;
    container.innerHTML = '';

    this.seq.channels.forEach(ch => {
      const row = this._buildChannelRow(ch);
      container.appendChild(row);
    });
  }

  _buildChannelRow(ch) {
    const row = document.createElement('div');
    row.className = 'seq-channel';
    row.dataset.chId = ch.id;

    // Color strip
    const colorStrip = document.createElement('div');
    colorStrip.className = 'ch-color';
    colorStrip.style.background = ch.color;

    // Info section
    const info = document.createElement('div');
    info.className = 'ch-info';

    const muteBtn = document.createElement('button');
    muteBtn.className = `ch-mute ${ch.muted ? 'muted' : ''}`;
    muteBtn.textContent = 'M';
    muteBtn.title = 'Mute';
    muteBtn.addEventListener('click', () => {
      ch.muted = !ch.muted;
      muteBtn.classList.toggle('muted', ch.muted);
    });

    const soloBtn = document.createElement('button');
    soloBtn.className = `ch-solo ${ch.soloed ? 'soloed' : ''}`;
    soloBtn.textContent = 'S';
    soloBtn.title = 'Solo';
    soloBtn.addEventListener('click', () => {
      ch.soloed = !ch.soloed;
      soloBtn.classList.toggle('soloed', ch.soloed);
    });

    const nameWrap = document.createElement('div');
    nameWrap.className = 'ch-name-wrap';
    const nameEl = document.createElement('div');
    nameEl.className = 'ch-name';
    nameEl.textContent = ch.name;
    nameEl.addEventListener('dblclick', () => this._renameChannel(ch, nameEl));
    const sampleTag = document.createElement('div');
    sampleTag.className = 'ch-sample-tag';
    sampleTag.textContent = ch.sampleId;
    nameWrap.appendChild(nameEl);
    nameWrap.appendChild(sampleTag);

    info.appendChild(colorStrip);
    info.appendChild(muteBtn);
    info.appendChild(soloBtn);
    info.appendChild(nameWrap);

    // Right-click context menu
    row.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.contextTarget = ch;
      this._showContextMenu(e.clientX, e.clientY);
    });

    // Steps
    const stepsDiv = document.createElement('div');
    stepsDiv.className = 'ch-steps';
    stepsDiv.dataset.chId = ch.id;

    const steps = this.seq.getSteps(ch.id);
    for (let i = 0; i < this.seq.steps; i++) {
      const btn = document.createElement('button');
      btn.className = `step-btn ${steps[i] ? 'on' : ''} ${i % 4 === 0 ? 'beat-1' : ''}`;
      btn.dataset.step = i;
      btn.addEventListener('click', () => {
        const on = this.seq.toggleStep(ch.id, i);
        btn.classList.toggle('on', on);
        if (on) {
          this.engine.resume().then(() => {
            this.engine.playBuffer(ch.sampleId, 0, ch.volume, ch.pan);
            this.mixer.triggerMeter(ch.id);
          });
        }
      });
      // Drag to draw
      btn.addEventListener('mouseenter', e => {
        if (e.buttons === 1) {
          const on = this.seq.toggleStep(ch.id, i);
          btn.classList.toggle('on', on);
        }
      });
      stepsDiv.appendChild(btn);
    }

    // Channel controls
    const controls = document.createElement('div');
    controls.className = 'ch-controls';

    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'ch-vol';
    volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.01;
    volSlider.value = ch.volume;
    volSlider.addEventListener('input', e => { ch.volume = parseFloat(e.target.value); });

    const panSlider = document.createElement('input');
    panSlider.type = 'range';
    panSlider.className = 'ch-pan';
    panSlider.min = -1; panSlider.max = 1; panSlider.step = 0.01;
    panSlider.value = ch.pan;
    panSlider.addEventListener('input', e => { ch.pan = parseFloat(e.target.value); });

    controls.appendChild(volSlider);
    controls.appendChild(panSlider);

    row.appendChild(info);
    row.appendChild(stepsDiv);
    row.appendChild(controls);

    // Drag & drop sample from browser
    row.addEventListener('dragover', e => {
      e.preventDefault();
      row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drop-target');
      const sampleId = e.dataTransfer.getData('sampleId');
      const sampleName = e.dataTransfer.getData('sampleName');
      if (sampleId) {
        ch.sampleId = sampleId;
        sampleTag.textContent = sampleId;
        this._setStatus(`Assigned "${sampleName}" to "${ch.name}"`);
      }
    });

    return row;
  }

  _renameChannel(ch, el) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = ch.name;
    input.style.cssText = 'background:#111;border:1px solid #ff6b00;color:#fff;font-size:12px;width:100px;padding:1px 4px;border-radius:2px;';
    el.replaceWith(input);
    input.focus();
    input.select();
    const done = () => {
      ch.name = input.value || ch.name;
      input.replaceWith(el);
      el.textContent = ch.name;
      this.mixer.render();
    };
    input.addEventListener('blur', done);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
  }

  // ── STEP PLAYBACK HIGHLIGHT ──
  updatePlayhead(step) {
    // Clear all playing states
    document.querySelectorAll('.step-btn.playing').forEach(b => b.classList.remove('playing'));
    // Set current step
    document.querySelectorAll(`.step-btn[data-step="${step}"]`).forEach(b => {
      b.classList.add('playing');
    });
    // Update bar:beat display
    const beat = Math.floor(step / 4) + 1;
    const sixteenth = (step % 4) + 1;
    const el = document.getElementById('bar-beat');
    if (el) el.textContent = `BAR ${Math.ceil(beat/4)} : BEAT ${((beat-1)%4)+1}.${sixteenth}`;
  }

  // ── BROWSER ──
  renderBrowser(category = null) {
    if (category) this.activeCategory = category;
    const list = document.getElementById('browser-list');
    if (!list) return;
    list.innerHTML = '';

    const items = this.library[this.activeCategory] || [];
    const searchVal = (document.getElementById('browser-search')?.value || '').toLowerCase();

    items
      .filter(item => !searchVal || item.name.toLowerCase().includes(searchVal))
      .forEach(item => {
        const div = document.createElement('div');
        div.className = 'browser-item';
        div.draggable = true;
        div.innerHTML = `<span class="browser-item-icon">${item.icon}</span> ${item.name}`;
        div.addEventListener('click', () => {
          // Preview sound
          this.engine.resume().then(() => {
            this.engine.playBuffer(item.id, 0, 0.8);
          });
          this._setStatus(`Preview: ${item.name}`);
        });
        div.addEventListener('dragstart', e => {
          e.dataTransfer.setData('sampleId', item.id);
          e.dataTransfer.setData('sampleName', item.name);
          div.classList.add('dragging');
        });
        div.addEventListener('dragend', () => div.classList.remove('dragging'));
        list.appendChild(div);
      });
  }

  // ── PATTERN TABS ──
  renderPatternTabs() {
    const container = document.getElementById('pattern-tabs');
    if (!container) return;
    container.innerHTML = '';

    this.seq.patterns.forEach((pat, i) => {
      const tab = document.createElement('button');
      tab.className = `pattern-tab ${i === this.seq.currentPatternIdx ? 'active' : ''}`;
      tab.textContent = pat.name;
      tab.addEventListener('click', () => {
        this.seq.currentPatternIdx = i;
        this.renderPatternTabs();
        this.renderSequencer();
      });
      tab.addEventListener('dblclick', () => {
        const name = prompt('Pattern name:', pat.name);
        if (name) { pat.name = name; this.renderPatternTabs(); }
      });
      container.appendChild(tab);
    });
  }

  // ── CONTEXT MENU ──
  _showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
  }

  hideContextMenu() {
    document.getElementById('context-menu')?.classList.add('hidden');
  }

  // ── VISUALIZER ──
  startVisualizer() {
    const canvas = document.getElementById('visualizer-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      this.visAnimFrame = requestAnimationFrame(draw);
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;

      ctx.fillStyle = '#16161b';
      ctx.fillRect(0, 0, W, H);

      const data = this.engine.getFrequencyData();
      const barW = W / data.length * 2.5;
      const gradient = ctx.createLinearGradient(0, H, 0, 0);
      gradient.addColorStop(0, '#00e676');
      gradient.addColorStop(0.6, '#ffd740');
      gradient.addColorStop(1, '#ff3d3d');

      data.forEach((val, i) => {
        const x = i * (barW + 1);
        const h = (val / 255) * H;
        ctx.fillStyle = gradient;
        ctx.fillRect(x, H - h, barW, h);
      });

      // Waveform overlay
      const wave = this.engine.getAnalyserData();
      ctx.strokeStyle = 'rgba(0,200,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      wave.forEach((v, i) => {
        const x = (i / wave.length) * W;
        const y = ((v - 128) / 128) * (H * 0.4) + H * 0.5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    };
    draw();
  }

  // ── TIMER DISPLAY ──
  updateTimer() {
    const ms = this.seq.getElapsedTime();
    const total_s = Math.floor(ms / 1000);
    const min = Math.floor(total_s / 60);
    const sec = total_s % 60;
    const centis = Math.floor((ms % 1000) / 10);
    const el = document.getElementById('timer-display');
    if (el) el.textContent = `${min}:${String(sec).padStart(2,'0')}.${String(centis).padStart(2,'0')}`;
  }

  _setStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
  }
}

window.DAWui = DAWui;
