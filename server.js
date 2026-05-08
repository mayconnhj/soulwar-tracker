import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import {
  getQuests, addQuest, updateQuest, deleteQuest,
  updateDropSale,
  getConfig, saveConfig, checkPassword, changePassword
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

const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Quests CRUD ─────────────────────────────────────────────────────

app.get('/api/quests', async (req, res) => {
  try {
    const data = await getQuests();
    res.json(data);
  } catch (err) {
    console.error('GET /api/quests error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quests', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const quest = await addQuest(req.body);
    res.json(quest);
  } catch (err) {
    console.error('POST /api/quests error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/quests/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const quest = await updateQuest(req.params.id, req.body);
    res.json(quest);
  } catch (err) {
    console.error('PUT /api/quests/:id error:', err);
    if (err.code === 'PGRST116') return res.status(404).json({ error: 'Quest not found' });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/quests/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const result = await deleteQuest(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('DELETE /api/quests/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Drops: venda individual ─────────────────────────────────────────

app.put('/api/drops/:id/sale', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const drop = await updateDropSale(req.params.id, req.body);
    res.json(drop);
  } catch (err) {
    console.error('PUT /api/drops/:id/sale error:', err);
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

app.post('/api/change-password', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const { currentPassword, newPassword } = req.body || {};
    await changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'BAD_CURRENT_PASSWORD') return res.status(401).json({ error: err.message });
    if (err.code === 'WEAK_PASSWORD') return res.status(400).json({ error: err.message });
    console.error('POST /api/change-password error:', err);
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
  console.log(`🗄️  Banco de dados: Supabase (PostgreSQL) - modelo quests + drops`);
});
