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
import { sendApiError } from './lib/validate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '200kb' }));

const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── Quests CRUD ─────────────────────────────────────────────────────

app.get('/api/quests', async (req, res) => {
  try { res.json(await getQuests()); } catch (err) { sendApiError(res, err, 'GET /api/quests'); }
});

app.post('/api/quests', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try { res.json(await addQuest(req.body)); } catch (err) { sendApiError(res, err, 'POST /api/quests'); }
});

app.put('/api/quests/:id', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try { res.json(await updateQuest(req.params.id, req.body)); } catch (err) { sendApiError(res, err, 'PUT /api/quests/:id'); }
});

app.delete('/api/quests/:id', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try { res.json(await deleteQuest(req.params.id)); } catch (err) { sendApiError(res, err, 'DELETE /api/quests/:id'); }
});

// ── Drops: venda individual ─────────────────────────────────────────

app.put('/api/drops/:id/sale', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try { res.json(await updateDropSale(req.params.id, req.body)); } catch (err) { sendApiError(res, err, 'PUT /api/drops/:id/sale'); }
});

// ── Config ──────────────────────────────────────────────────────────

app.get('/api/config', async (req, res) => {
  try { res.json(await getConfig()); } catch (err) { sendApiError(res, err, 'GET /api/config'); }
});

app.put('/api/config', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try { res.json(await saveConfig(req.body)); } catch (err) { sendApiError(res, err, 'PUT /api/config'); }
});

// Verifica se o token salvo no cliente ainda e valido (usado pra
// restaurar isAdmin no reload da pagina).
app.get('/api/me', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  try {
    const ok = await checkPassword(req.body && req.body.password);
    if (ok) res.json({ ok: true, token: await createToken() });
    else res.status(401).json({ error: 'Senha incorreta' });
  } catch (err) { sendApiError(res, err, 'POST /api/login'); }
});

app.post('/api/change-password', async (req, res) => {
  if (!await requireAuth(req, res)) return;
  try {
    const { currentPassword, newPassword } = req.body || {};
    await changePassword(currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err) { sendApiError(res, err, 'POST /api/change-password'); }
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
