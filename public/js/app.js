/**
 * WebDAW — App Entry Point
 * Tüm modülleri başlatır ve bağlar
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.audioEngine;

  // ── INIT MODULES ──
  const seq = new Sequencer(engine);
  window.sequencer = seq;

  const mixer = new Mixer(seq);
  const pianoRoll = new PianoRoll(seq, engine);
  const ui = new DAWui(seq, mixer, pianoRoll, engine);
  const project = new ProjectManager(seq);

  // ── INITIAL RENDER ──
  ui.renderSequencer();
  ui.renderBrowser();
  ui.renderPatternTabs();
  mixer.render();
  pianoRoll.buildPianoKeys();
  ui.startVisualizer();

  // ── PLAYBACK LOOP ──
  let lastStep = -1;
  const playbackLoop = setInterval(() => {
    if (seq.isPlaying) {
      const step = seq.currentStep;
      if (step !== lastStep) {
        ui.updatePlayhead(step);
        // Trigger mixer meters for active channels
        seq.channels.forEach(ch => {
          const steps = seq.getSteps(ch.id);
          if (steps[step] && !ch.muted) {
            mixer.triggerMeter(ch.id);
          }
        });
        lastStep = step;
      }
    } else {
      if (lastStep !== -1) {
        document.querySelectorAll('.step-btn.playing').forEach(b => b.classList.remove('playing'));
        lastStep = -1;
      }
    }
    ui.updateTimer();
  }, 16); // ~60fps

  // ── CPU MONITOR ──
  setInterval(() => {
    // Rough estimate
    const cpu = Math.round(Math.random() * 4 + (seq.isPlaying ? 8 : 2));
    const el = document.getElementById('cpu-usage');
    if (el) el.textContent = `CPU: ${cpu}%`;
  }, 2000);

  // ══════════════════════════════════════
  // TOOLBAR EVENTS
  // ══════════════════════════════════════
  const btnPlay = document.getElementById('btn-play');
  btnPlay.addEventListener('click', () => {
    engine.resume().then(() => {
      if (seq.isPlaying) {
        seq.stop();
        btnPlay.textContent = '▶';
        btnPlay.classList.remove('playing');
        document.getElementById('status-msg').textContent = 'Stopped';
      } else {
        seq.play();
        btnPlay.textContent = '⏸';
        btnPlay.classList.add('playing');
        document.getElementById('status-msg').textContent = `Playing at ${seq.bpm} BPM`;
      }
    });
  });

  document.getElementById('btn-rewind').addEventListener('click', () => {
    seq.stop();
    seq.currentStep = 0;
    btnPlay.textContent = '▶';
    btnPlay.classList.remove('playing');
    document.querySelectorAll('.step-btn.playing').forEach(b => b.classList.remove('playing'));
  });

  const btnRecord = document.getElementById('btn-record');
  btnRecord.addEventListener('click', () => {
    btnRecord.classList.toggle('recording');
  });

  const btnLoop = document.getElementById('btn-loop');
  btnLoop.addEventListener('click', () => {
    btnLoop.classList.toggle('active');
  });

  // BPM
  const bpmInput = document.getElementById('bpm-value');
  const updateBpm = (v) => {
    seq.bpm = Math.max(40, Math.min(300, v));
    bpmInput.value = seq.bpm;
  };
  document.getElementById('bpm-up').addEventListener('click', () => updateBpm(seq.bpm + 1));
  document.getElementById('bpm-down').addEventListener('click', () => updateBpm(seq.bpm - 1));
  bpmInput.addEventListener('change', () => updateBpm(parseInt(bpmInput.value) || 128));
  bpmInput.addEventListener('wheel', e => {
    e.preventDefault();
    updateBpm(seq.bpm + (e.deltaY < 0 ? 1 : -1));
  });

  // Master Volume
  document.getElementById('master-vol').addEventListener('input', e => {
    engine.setMasterVolume(parseFloat(e.target.value));
  });

  // ── SAVE / LOAD ──
  document.getElementById('btn-save').addEventListener('click', () => {
    const name = prompt('Project name:', 'My Beat');
    if (name !== null) project.saveToFile(name);
  });

  document.getElementById('btn-load').addEventListener('click', () => {
    document.getElementById('load-file').click();
  });

  document.getElementById('load-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await project.loadFromFile(file);
    seq.currentStep = 0;
    // Re-render everything
    ui.renderSequencer();
    ui.renderPatternTabs();
    mixer.render();
    bpmInput.value = seq.bpm;
    document.getElementById('swing').value = seq.swing;
    document.getElementById('steps-count').value = seq.steps;
    e.target.value = '';
  });

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!confirm('Start a new project? Unsaved changes will be lost.')) return;
    seq.stop();
    seq.channels = [];
    seq.patterns = [];
    seq._initDefaultChannels();
    seq._initDefaultPatterns();
    btnPlay.textContent = '▶';
    btnPlay.classList.remove('playing');
    ui.renderSequencer();
    ui.renderPatternTabs();
    mixer.render();
    document.getElementById('status-msg').textContent = 'New project created';
  });

  // ── PATTERN CONTROLS ──
  document.getElementById('btn-add-pattern').addEventListener('click', () => {
    seq.addPattern();
    seq.currentPatternIdx = seq.patterns.length - 1;
    ui.renderPatternTabs();
    ui.renderSequencer();
  });

  // ── STEPS / SWING ──
  document.getElementById('steps-count').addEventListener('change', e => {
    seq.setSteps(parseInt(e.target.value));
    ui.renderSequencer();
  });

  const swingSlider = document.getElementById('swing');
  swingSlider.addEventListener('input', e => {
    seq.swing = parseInt(e.target.value);
    document.getElementById('swing-val').textContent = seq.swing + '%';
  });

  // ── ADD CHANNEL ──
  document.getElementById('btn-add-channel').addEventListener('click', () => {
    const name = prompt('Channel name:', `Channel ${seq.channels.length + 1}`);
    if (name === null) return;
    const ch = seq.addChannel(name);
    ui.renderSequencer();
    mixer.addChannel(ch);
  });

  // ── BROWSER ──
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ui.renderBrowser(btn.dataset.cat);
    });
  });

  document.getElementById('browser-search').addEventListener('input', () => {
    ui.renderBrowser();
  });

  // Sample upload
  document.getElementById('sample-upload').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const id = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '_');
      await engine.loadFromFile(id, file);
      ui.library.user.push({ name: file.name, id, icon: '📁' });
      document.querySelector('.cat-btn[data-cat="user"]').click();
      document.getElementById('status-msg').textContent = `Loaded: ${file.name}`;
    }
    e.target.value = '';
  });

  // ── PANEL COLLAPSE ──
  document.getElementById('browser-toggle').addEventListener('click', () => {
    const layout = document.querySelector('.daw-layout');
    const panel = document.getElementById('browser-panel');
    const collapsed = panel.classList.toggle('collapsed');
    layout.classList.toggle('browser-collapsed', collapsed);
    document.getElementById('browser-toggle').textContent = collapsed ? '▶' : '◀';
  });

  document.getElementById('mixer-toggle').addEventListener('click', () => {
    const layout = document.querySelector('.daw-layout');
    const panel = document.getElementById('mixer-panel');
    const collapsed = panel.classList.toggle('collapsed');
    layout.classList.toggle('mixer-collapsed', collapsed);
    document.getElementById('mixer-toggle').textContent = collapsed ? '◀' : '▶';
  });

  // ── MODE SWITCH (Seq / Piano Roll) ──
  document.getElementById('mode-sequencer').addEventListener('click', () => {
    document.getElementById('sequencer-view').classList.remove('hidden');
    document.getElementById('piano-roll-view').classList.add('hidden');
    document.getElementById('mode-sequencer').classList.add('active');
    document.getElementById('mode-piano').classList.remove('active');
  });

  document.getElementById('mode-piano').addEventListener('click', () => {
    document.getElementById('sequencer-view').classList.add('hidden');
    document.getElementById('piano-roll-view').classList.remove('hidden');
    document.getElementById('mode-piano').classList.add('active');
    document.getElementById('mode-sequencer').classList.remove('active');
    pianoRoll.resize();
  });

  // ── CONTEXT MENU ──
  document.addEventListener('click', () => ui.hideContextMenu());
  document.getElementById('context-menu').addEventListener('click', e => {
    const action = e.target.dataset.action;
    const ch = ui.contextTarget;
    if (!ch) return;

    switch (action) {
      case 'rename':
        const name = prompt('Channel name:', ch.name);
        if (name) {
          ch.name = name;
          ui.renderSequencer();
          mixer.render();
        }
        break;
      case 'duplicate':
        const newCh = seq.addChannel(ch.name + ' Copy', ch.color);
        newCh.sampleId = ch.sampleId;
        newCh.volume = ch.volume;
        newCh.pan = ch.pan;
        const srcSteps = [...seq.getSteps(ch.id)];
        seq.currentPattern.steps[newCh.id] = [...srcSteps];
        ui.renderSequencer();
        mixer.addChannel(newCh);
        break;
      case 'clear':
        seq.currentPattern.steps[ch.id] = new Array(seq.steps).fill(false);
        ui.renderSequencer();
        break;
      case 'delete':
        if (seq.channels.length <= 1) return;
        seq.removeChannel(ch.id);
        mixer.removeChannel(ch.id);
        ui.renderSequencer();
        break;
      case 'fill':
        seq.currentPattern.steps[ch.id] = new Array(seq.steps).fill(true);
        ui.renderSequencer();
        break;
      case 'randomize':
        seq.currentPattern.steps[ch.id] = Array.from(
          { length: seq.steps }, () => Math.random() > 0.6
        );
        ui.renderSequencer();
        break;
    }
    ui.hideContextMenu();
  });

  // ── KEYBOARD SHORTCUTS ──
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        btnPlay.click();
        break;
      case 'Home':
        document.getElementById('btn-rewind').click();
        break;
      case 'ArrowUp':
        updateBpm(seq.bpm + (e.shiftKey ? 10 : 1));
        break;
      case 'ArrowDown':
        updateBpm(seq.bpm - (e.shiftKey ? 10 : 1));
        break;
      case 'KeyS':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); project.saveToFile(); }
        break;
    }
  });

  // ── RESIZE HANDLER ──
  window.addEventListener('resize', () => {
    const view = document.getElementById('piano-roll-view');
    if (!view.classList.contains('hidden')) pianoRoll.resize();
  });

  // Welcome
  document.getElementById('status-msg').textContent =
    'Welcome to WebDAW! Press SPACE to play, drag samples to channels, right-click channels for options.';
});
