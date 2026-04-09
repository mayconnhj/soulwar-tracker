import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Serve static files from Vite build in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ── JSON File Database ──────────────────────────────────────────────
const DB_FILE = join(__dirname, 'database.json');

function loadDB() {
  if (!existsSync(DB_FILE)) {
    const initial = {
      drops: [],
      config: {
        password: 'soulwar2026',
        bosses: [],
        fixos: [],
        bonecos: [],
        items: {},
        teamA: ['Conopcas', 'Verfix', 'Obonitao Lindão', 'Mad Tian'],
        teamB: ['Lark Zepin', 'Abel Shaene', 'Brabubagore', 'Sokon Eltanke'],
        tcPriceReal: '53',
        tcPriceKK: '39',
        tcQty: '250',
        removedBosses: [],
        removedFixos: [],
        removedItems: []
      }
    };
    writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  return JSON.parse(readFileSync(DB_FILE, 'utf-8'));
}

function saveDB(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Initialize
let database = loadDB();

// ── Drops CRUD ──────────────────────────────────────────────────────

// GET all drops
app.get('/api/drops', (req, res) => {
  database = loadDB();
  res.json(database.drops);
});

// POST new drop
app.post('/api/drops', (req, res) => {
  database = loadDB();
  const { item, boss, char, pagante, dropDate, dropador, suplentes, loot, servicePrice, tempo } = req.body;
  const drop = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    item,
    boss: boss || '',
    char,
    pagante: pagante || '',
    drop_date: dropDate || '',
    dropador: dropador || '',
    suplentes: suplentes || [],
    loot: loot || '',
    service_price: servicePrice || '',
    tempo: tempo || '',
    sold_price: '',
    sold_date: '',
    created_at: new Date().toISOString()
  };
  database.drops.unshift(drop);
  saveDB(database);
  res.json(drop);
});

// PUT update drop
app.put('/api/drops/:id', (req, res) => {
  database = loadDB();
  const idx = database.drops.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Drop not found' });

  const { item, boss, char, pagante, dropDate, dropador, suplentes, loot, servicePrice, tempo, soldPrice, soldDate } = req.body;
  const existing = database.drops[idx];

  if (item !== undefined) existing.item = item;
  if (boss !== undefined) existing.boss = boss;
  if (char !== undefined) existing.char = char;
  if (pagante !== undefined) existing.pagante = pagante;
  if (dropDate !== undefined) existing.drop_date = dropDate;
  if (dropador !== undefined) existing.dropador = dropador;
  if (suplentes !== undefined) existing.suplentes = suplentes;
  if (loot !== undefined) existing.loot = loot;
  if (servicePrice !== undefined) existing.service_price = servicePrice;
  if (tempo !== undefined) existing.tempo = tempo;
  if (soldPrice !== undefined) existing.sold_price = soldPrice;
  if (soldDate !== undefined) existing.sold_date = soldDate;

  database.drops[idx] = existing;
  saveDB(database);
  res.json(existing);
});

// DELETE drop
app.delete('/api/drops/:id', (req, res) => {
  database = loadDB();
  const len = database.drops.length;
  database.drops = database.drops.filter(d => d.id !== req.params.id);
  if (database.drops.length === len) return res.status(404).json({ error: 'Drop not found' });
  saveDB(database);
  res.json({ ok: true });
});

// ── Config ──────────────────────────────────────────────────────────

// GET config
app.get('/api/config', (req, res) => {
  database = loadDB();
  res.json(database.config);
});

// PUT config
app.put('/api/config', (req, res) => {
  database = loadDB();
  database.config = req.body;
  saveDB(database);
  res.json(req.body);
});

// POST login
app.post('/api/login', (req, res) => {
  database = loadDB();
  if (req.body.password === database.config.password) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
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
  console.log(`📦 Banco de dados: ${DB_FILE}`);
});
