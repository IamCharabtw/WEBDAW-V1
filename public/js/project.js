/**
 * WebDAW — Project Manager
 * JSON kaydetme/yükleme + backend API
 */

class ProjectManager {
  constructor(sequencer) {
    this.seq = sequencer;
    this.backendUrl = window.location.origin; // Node.js backend
    this.currentProject = null;
  }

  // ── LOCAL SAVE (download as file) ──
  saveToFile(name = null) {
    const data = this.seq.toJSON();
    data.project_name = name || data.project_name || 'webdaw-project';
    data.saved_at = new Date().toISOString();

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.project_name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this._showStatus(`Project saved: ${data.project_name}`);
    return data;
  }

  // ── LOCAL LOAD (from file input) ──
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this.seq.fromJSON(data);
          this._showStatus(`Loaded: ${data.project_name}`);
          resolve(data);
        } catch (err) {
          this._showStatus('Error: Invalid project file');
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  // ── BACKEND SAVE ──
  async saveToServer(name = null) {
    try {
      const data = this.seq.toJSON();
      data.project_name = name || data.project_name;

      const res = await fetch(`${this.backendUrl}/api/save-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      this._showStatus(`Saved to server: ${result.id}`);
      return result;
    } catch (err) {
      // Fallback to local save
      console.warn('[Project] Backend unavailable, saving locally');
      return this.saveToFile(name);
    }
  }

  // ── BACKEND LOAD LIST ──
  async getProjectsFromServer() {
    try {
      const res = await fetch(`${this.backendUrl}/api/get-projects`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[Project] Backend unavailable');
      return [];
    }
  }

  // ── BACKEND LOAD SPECIFIC ──
  async loadFromServer(id) {
    try {
      const res = await fetch(`${this.backendUrl}/api/project/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.seq.fromJSON(data);
      this._showStatus(`Loaded from server: ${data.project_name}`);
      return data;
    } catch (err) {
      this._showStatus('Error loading from server');
      throw err;
    }
  }

  _showStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) {
      el.textContent = msg;
      setTimeout(() => {
        el.textContent = 'Ready';
      }, 3000);
    }
  }
}

window.ProjectManager = ProjectManager;
