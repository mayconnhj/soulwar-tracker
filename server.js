import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import {
  getDrops, addDrop, updateDrop, deleteDrop,
  getConfig, saveConfig, checkPassword
} from './lib/supabase.js';
import { createToken, requireAuth } from './lib/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files from Vite build in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Drops CRUD ──────────────────────────────────────────────────────

app.get('/api/drops', async (req, res) => {
  try {
    const drops = await getDrops();
    res.json(drops);
  } catch (err) {
    console.error('GET /api/drops error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drops', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const drop = await addDrop(req.body);
    res.json(drop);
  } catch (err) {
    console.error('POST /api/drops error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drops/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const drop = await updateDrop(req.params.id, req.body);
    res.json(drop);
  } catch (err) {
    console.error('PUT /api/drops error:', err);
    if (err.code === 'PGRST116') return res.status(404).json({ error: 'Drop not found' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drops/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const result = await deleteDrop(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('DELETE /api/drops error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Config ──────────────────────────────────────────────────────────

app.get('/api/config', async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    console.error('GET /api/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/config', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const config = await saveConfig(req.body);
    res.json(config);
  } catch (err) {
    console.error('PUT /api/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const ok = await checkPassword(req.body.password);
    if (ok) {
      res.json({ ok: true, token: createToken() });
    } else {
      res.status(401).json({ error: 'Senha incorreta' });
    }
  } catch (err) {
    console.error('POST /api/login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── SPA fallback ────────────────────────────────────────────────────
if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Soulwar Tracker API rodando em http://localhost:${PORT}`);
  console.log(`🗄️  Banco de dados: Supabase (PostgreSQL)`);
});
