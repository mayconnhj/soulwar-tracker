-- =====================================================================
-- MIGRATION 002 — Preparacao multi-tenant (Fase 2)
-- =====================================================================
-- Idempotente: pode ser rodada multiplas vezes sem efeito colateral.
-- Aditiva: nao remove nada, nao muda comportamento existente.
--
-- O que faz:
--  1. Cria tabelas teams, team_members, team_config (vazias).
--  2. Adiciona team_id em quests e drops (DEFAULT 'default').
--  3. Cria a team 'default' e migra todos os dados atuais pra ela.
--  4. Migra config(id=1) -> team_config(team_id='default').
--  5. RLS aberta nessas tabelas novas (a Fase 4 fechara).
--
-- Como rodar:
--  Supabase Dashboard > SQL Editor > New query > cole tudo > Run.
--
-- Como reverter (caso necessario, antes da Fase 3):
--  DROP TABLE IF EXISTS team_config CASCADE;
--  DROP TABLE IF EXISTS team_members CASCADE;
--  DROP TABLE IF EXISTS teams CASCADE;
--  ALTER TABLE quests DROP COLUMN IF EXISTS team_id;
--  ALTER TABLE drops  DROP COLUMN IF EXISTS team_id;
-- =====================================================================

-- ── 1) Tabela teams ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  owner_user_id UUID,            -- futuro: auth.users(id) na Fase 3
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2) Tabela team_members (papéis dentro de um time) ───────────────
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,         -- futuro: auth.users(id)
  role TEXT NOT NULL DEFAULT 'viewer'
       CHECK (role IN ('owner','admin','viewer')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ── 3) Tabela team_config (config por team — substitui config id=1) ─
CREATE TABLE IF NOT EXISTS team_config (
  team_id TEXT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  bosses JSONB DEFAULT '[]'::jsonb,
  fixos JSONB DEFAULT '[]'::jsonb,
  bonecos JSONB DEFAULT '[]'::jsonb,
  items JSONB DEFAULT '{}'::jsonb,
  team_a JSONB DEFAULT '[]'::jsonb,
  team_b JSONB DEFAULT '[]'::jsonb,
  team_c JSONB DEFAULT '[]'::jsonb,
  tc_price_real TEXT DEFAULT '53',
  tc_price_kk TEXT DEFAULT '39',
  tc_qty TEXT DEFAULT '250',
  removed_bosses JSONB DEFAULT '[]'::jsonb,
  removed_fixos JSONB DEFAULT '[]'::jsonb,
  removed_items JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4) Adicionar team_id em quests e drops ──────────────────────────
ALTER TABLE quests ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT 'default';
ALTER TABLE drops  ADD COLUMN IF NOT EXISTS team_id TEXT DEFAULT 'default';

-- ── 5) Criar a team default ─────────────────────────────────────────
INSERT INTO teams (id, name, slug)
VALUES ('default', 'Time Default', 'default')
ON CONFLICT (id) DO NOTHING;

-- ── 6) Migrar dados existentes pra team 'default' ───────────────────
UPDATE quests SET team_id='default' WHERE team_id IS NULL OR team_id='';
UPDATE drops  SET team_id='default' WHERE team_id IS NULL OR team_id='';

-- ── 7) Migrar config(id=1) -> team_config(team_id='default') ────────
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

-- ── 8) Indexes pra leitura por team ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quests_team_id ON quests(team_id);
CREATE INDEX IF NOT EXISTS idx_drops_team_id  ON drops(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ── 9) RLS aberta nas tabelas novas (Fase 4 vai fechar) ─────────────
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

-- ── 10) Conferencia (rode esses SELECTs depois pra validar) ─────────
-- SELECT count(*) AS quests_total, count(*) FILTER (WHERE team_id='default') AS quests_default FROM quests;
-- SELECT count(*) AS drops_total,  count(*) FILTER (WHERE team_id='default') AS drops_default  FROM drops;
-- SELECT * FROM teams;
-- SELECT * FROM team_config;
