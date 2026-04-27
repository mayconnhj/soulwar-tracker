-- ============================================
-- SOULWAR TRACKER - SETUP SUPABASE
-- ============================================
-- Execute este SQL no Supabase:
-- Dashboard > SQL Editor > New Query > Cole tudo > Run
-- ============================================

-- Tabela de drops (cada item dropado)
CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL DEFAULT '',
  boss TEXT DEFAULT '',
  char TEXT DEFAULT '',
  pagante TEXT DEFAULT '',
  drop_date TEXT DEFAULT '',
  dropador TEXT DEFAULT '',
  suplentes JSONB DEFAULT '[]'::jsonb,
  loot TEXT DEFAULT '',
  service_price TEXT DEFAULT '',
  tempo TEXT DEFAULT '',
  sold_price TEXT DEFAULT '',
  sold_date TEXT DEFAULT '',
  team TEXT DEFAULT '',
  quest_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adiciona coluna team se a tabela ja existe
ALTER TABLE drops ADD COLUMN IF NOT EXISTS team TEXT DEFAULT '';

-- Adiciona coluna quest_id (agrupa drops da mesma soulwar) se ja existe
ALTER TABLE drops ADD COLUMN IF NOT EXISTS quest_id TEXT DEFAULT '';

-- Adiciona coluna team_c se a tabela config ja existe
ALTER TABLE config ADD COLUMN IF NOT EXISTS team_c JSONB DEFAULT '[]'::jsonb;

-- Tabela de configuracao (uma unica linha)
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password TEXT DEFAULT 'soulwar2026',
  bosses JSONB DEFAULT '[]'::jsonb,
  fixos JSONB DEFAULT '[]'::jsonb,
  bonecos JSONB DEFAULT '[]'::jsonb,
  items JSONB DEFAULT '{}'::jsonb,
  team_a JSONB DEFAULT '["Conopcas","Verfix","Obonitao Lindão","Mad Tian"]'::jsonb,
  team_b JSONB DEFAULT '["Lark Zepin","Abel Shaene","Brabubagore","Sokon Eltanke"]'::jsonb,
  team_c JSONB DEFAULT '[]'::jsonb,
  tc_price_real TEXT DEFAULT '53',
  tc_price_kk TEXT DEFAULT '39',
  tc_qty TEXT DEFAULT '250',
  removed_bosses JSONB DEFAULT '[]'::jsonb,
  removed_fixos JSONB DEFAULT '[]'::jsonb,
  removed_items JSONB DEFAULT '[]'::jsonb
);

-- Insere config padrao se nao existir
INSERT INTO config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Desativa RLS para simplificar (o app ja tem senha propria)
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Politicas permissivas (acesso via service_role key)
CREATE POLICY "Allow all on drops" ON drops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on config" ON config FOR ALL USING (true) WITH CHECK (true);

-- Indice para ordenar drops por data de criacao
CREATE INDEX IF NOT EXISTS idx_drops_created_at ON drops (created_at DESC);
