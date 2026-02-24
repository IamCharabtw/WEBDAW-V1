/**
 * WebDAW — Node.js Backend
 * Express + local JSON database
 * 
 * API Endpoints:
 *   POST /api/save-project   → Proje kaydet
 *   GET  /api/get-projects   → Tüm projeleri listele
 *   GET  /api/project/:id    → Tek proje getir
 *   DELETE /api/project/:id  → Proje sil
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { existsSync, mkdirSync } = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, '../data/projects.json');
const DATA_DIR = path.join(__dirname, '../data');

// ── MIDDLEWARE ──
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Logging
app.use((req, res, next) => {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── DATABASE HELPERS ──
async function ensureDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    await fs.writeFile(DB_PATH, JSON.stringify({ projects: [] }, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// ══════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════

/**
 * POST /api/save-project
 * Body: { project_name, bpm, steps, channels, patterns, ... }
 */
app.post('/api/save-project', async (req, res) => {
  try {
    const db = await readDb();
    const project = {
      id: crypto.randomUUID(),
      ...req.body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Eğer aynı isimde proje varsa güncelle
    const existingIdx = db.projects.findIndex(
      p => p.project_name === project.project_name
    );
    if (existingIdx >= 0) {
      project.id = db.projects[existingIdx].id;
      project.created_at = db.projects[existingIdx].created_at;
      db.projects[existingIdx] = project;
    } else {
      db.projects.push(project);
    }

    await writeDb(db);
    res.json({ success: true, id: project.id, message: 'Project saved' });
  } catch (err) {
    console.error('[save-project]', err);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

/**
 * GET /api/get-projects
 * Returns list of projects (without full data)
 */
app.get('/api/get-projects', async (req, res) => {
  try {
    const db = await readDb();
    const list = db.projects.map(p => ({
      id: p.id,
      project_name: p.project_name,
      bpm: p.bpm,
      created_at: p.created_at,
      updated_at: p.updated_at,
      channel_count: p.channels?.length || 0,
    }));
    res.json({ projects: list, total: list.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/project/:id
 * Returns full project data
 */
app.get('/api/project/:id', async (req, res) => {
  try {
    const db = await readDb();
    const project = db.projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * DELETE /api/project/:id
 */
app.delete('/api/project/:id', async (req, res) => {
  try {
    const db = await readDb();
    const before = db.projects.length;
    db.projects = db.projects.filter(p => p.id !== req.params.id);
    if (db.projects.length === before) {
      return res.status(404).json({ error: 'Project not found' });
    }
    await writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), port: PORT });
});

// ── CATCH-ALL: serve index.html ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── START ──
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         WebDAW Server Started         ║
╠═══════════════════════════════════════╣
║  Local:  http://localhost:${PORT}          ║
║  API:    http://localhost:${PORT}/api      ║
╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
