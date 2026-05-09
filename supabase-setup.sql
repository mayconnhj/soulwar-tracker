-- ============================================
-- SOULWAR TRACKER - SETUP SUPABASE
-- ============================================
-- Execute este SQL no Supabase:
-- Dashboard > SQL Editor > New Query > Cole tudo > Run
-- ============================================

-- ── Tabela de drops (item dropado) ────────────────────────────────────
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

ALTER TABLE drops ADD COLUMN IF NOT EXISTS team TEXT DEFAULT '';
ALTER TABLE drops ADD COLUMN IF NOT EXISTS quest_id TEXT DEFAULT '';

-- ── Tabela de quests (uma execucao da soulwar) ────────────────────────
CREATE TABLE IF NOT EXISTS quests (
  id TEXT PRIMARY KEY,
  drop_date TEXT DEFAULT '',
  pagante TEXT DEFAULT '',
  team TEXT DEFAULT '',
  suplentes JSONB DEFAULT '[]'::jsonb,
  loot TEXT DEFAULT '',
  service_price TEXT DEFAULT '',
  tempo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quests' AND policyname='Allow all on quests') THEN
    CREATE POLICY "Allow all on quests" ON quests FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── MIGRACAO de dados existentes em drops -> quests ───────────────────
-- Garante que toda drop tenha um quest_id
UPDATE drops SET quest_id = id WHERE COALESCE(quest_id, '') = '';

-- Cria 1 linha em quests para cada quest_id existente em drops.
-- Quando varias drops compartilham o mesmo quest_id, prefere a linha
-- que ja tinha loot/service/tempo preenchidos (era a "primeira drop").
INSERT INTO quests (id, drop_date, pagante, team, suplentes, loot, service_price, tempo, created_at)
SELECT DISTINCT ON (quest_id)
  quest_id, drop_date, pagante, team, suplentes, loot, service_price, tempo, created_at
FROM drops
WHERE quest_id IS NOT NULL AND quest_id != ''
ORDER BY quest_id,
  (CASE WHEN COALESCE(loot,'')!='' OR COALESCE(service_price,'')!='' OR COALESCE(tempo,'')!='' THEN 0 ELSE 1 END),
  created_at
ON CONFLICT (id) DO NOTHING;

-- ── Tabela de configuracao ────────────────────────────────────────────
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
  teams_data JSONB DEFAULT '[]'::jsonb,
  tc_price_real TEXT DEFAULT '53',
  tc_price_kk TEXT DEFAULT '39',
  tc_qty TEXT DEFAULT '250',
  removed_bosses JSONB DEFAULT '[]'::jsonb,
  removed_fixos JSONB DEFAULT '[]'::jsonb,
  removed_items JSONB DEFAULT '[]'::jsonb
);
ALTER TABLE config ADD COLUMN IF NOT EXISTS team_c JSONB DEFAULT '[]'::jsonb;
ALTER TABLE config ADD COLUMN IF NOT EXISTS teams_data JSONB DEFAULT '[]'::jsonb;
-- auth_version invalida tokens antigos quando a senha admin e trocada.
ALTER TABLE config ADD COLUMN IF NOT EXISTS auth_version INT DEFAULT 0;

INSERT INTO config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='drops' AND policyname='Allow all on drops') THEN
    CREATE POLICY "Allow all on drops" ON drops FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='config' AND policyname='Allow all on config') THEN
    CREATE POLICY "Allow all on config" ON config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drops_created_at ON drops (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drops_quest_id ON drops (quest_id);
CREATE INDEX IF NOT EXISTS idx_quests_created_at ON quests (created_at DESC);

-- ============================================
-- FASE 2 — PREPARACAO MULTI-TENANT (aditivo)
-- Tudo aqui tambem esta em migrations/002_multi_tenant_prep.sql
-- ============================================

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  owner_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
       CHECK (role IN ('owner','admin','viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_config (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  bosses JSONB DEFAULT '[]'::jsonb,
  fixos JSONB DEFAULT '[]'::jsonb,
  bonecos JSONB DEFAULT '[]'::jsonb,
  items JSONB DEFAULT '{}'::jsonb,
  team_a JSONB DEFAULT '[]'::jsonb,
  team_b JSONB DEFAULT '[]'::jsonb,
  team_c JSONB DEFAULT '[]'::jsonb,
  teams_data JSONB DEFAULT '[]'::jsonb,
  tc_price_real TEXT DEFAULT '53',
  tc_price_kk TEXT DEFAULT '39',
  tc_qty TEXT DEFAULT '250',
  removed_bosses JSONB DEFAULT '[]'::jsonb,
  removed_fixos JSONB DEFAULT '[]'::jsonb,
  removed_items JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quests ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT 'default';
ALTER TABLE drops  ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT 'default';
ALTER TABLE quests ADD COLUMN IF NOT EXISTS ausentes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS bonecos_pilotados JSONB DEFAULT '[]'::jsonb;
ALTER TABLE team_config ADD COLUMN IF NOT EXISTS teams_data JSONB DEFAULT '[]'::jsonb;

INSERT INTO teams (id, name, slug)
VALUES ('default', 'Time Default', 'default')
ON CONFLICT (id) DO NOTHING;

UPDATE quests SET team_id='default' WHERE team_id IS NULL OR team_id='';
UPDATE drops  SET team_id='default' WHERE team_id IS NULL OR team_id='';

INSERT INTO team_config (
  team_id, bosses, fixos, bonecos, items,
  team_a, team_b, team_c,
  tc_price_real, tc_price_kk, tc_qty,
  removed_bosses, removed_fixos, removed_items
)
SELECT
  'default', bosses, fixos, bonecos, items,
  team_a, team_b, team_c,
  tc_price_real, tc_price_kk, tc_qty,
  removed_bosses, removed_fixos, removed_items
FROM config WHERE id=1
ON CONFLICT (team_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_quests_team_id ON quests(team_id);
CREATE INDEX IF NOT EXISTS idx_drops_team_id  ON drops(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_config  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='teams' AND policyname='Allow all on teams') THEN
    CREATE POLICY "Allow all on teams" ON teams FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_members' AND policyname='Allow all on team_members') THEN
    CREATE POLICY "Allow all on team_members" ON team_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='team_config' AND policyname='Allow all on team_config') THEN
    CREATE POLICY "Allow all on team_config" ON team_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
