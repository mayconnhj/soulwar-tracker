-- =====================================================================
-- MIGRATION 003 — Times dinamicos + presenca/ausencia em quests
-- =====================================================================
-- Objetivo:
--  1. team_config.teams_data — array de subteams com fixos+bonecos+cor.
--     Substitui team_a/team_b/team_c (que ficam pra retrocompat).
--  2. quests.ausentes — fixos do time que nao foram nessa quest.
--  3. quests.bonecos_pilotados — bonecos que rolaram (snapshot dono+piloto).
--
-- Idempotente. Aditiva. Nao remove nada — campos antigos seguem lado a lado.
-- =====================================================================

-- 1) teams_data nas DUAS tabelas de config (config = legada, team_config = nova).
-- A Fase 2.5/3 ainda le da tabela 'config', mantendo team_config sincronizada
-- pra quando a Fase 3 migrar a leitura.
ALTER TABLE config      ADD COLUMN IF NOT EXISTS teams_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE team_config ADD COLUMN IF NOT EXISTS teams_data JSONB DEFAULT '[]'::jsonb;

-- 2) quests.ausentes + quests.bonecos_pilotados
ALTER TABLE quests ADD COLUMN IF NOT EXISTS ausentes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS bonecos_pilotados JSONB DEFAULT '[]'::jsonb;

-- 3) Popular teams_data nas duas tabelas a partir do team_a/b/c + fixos.
-- Idempotente: so popula se teams_data esta vazio.
DO $$
DECLARE
  cfg_row RECORD;
  bonecos_a JSONB;
  bonecos_b JSONB;
  bonecos_c JSONB;
  payload JSONB;
BEGIN
  SELECT fixos, team_a, team_b, team_c, teams_data
  INTO cfg_row
  FROM config WHERE id = 1;

  IF cfg_row IS NULL THEN
    RAISE NOTICE 'config(id=1) nao existe — pule esta migration';
    RETURN;
  END IF;

  IF cfg_row.teams_data IS NOT NULL AND cfg_row.teams_data <> '[]'::jsonb THEN
    RAISE NOTICE 'config.teams_data ja populado — pulando';
    RETURN;
  END IF;

  -- Converte cada team_X (array de strings) em [{char, dono:''}]
  SELECT COALESCE(jsonb_agg(jsonb_build_object('char', value, 'dono', '')), '[]'::jsonb)
  INTO bonecos_a
  FROM jsonb_array_elements_text(COALESCE(cfg_row.team_a, '[]'::jsonb));

  SELECT COALESCE(jsonb_agg(jsonb_build_object('char', value, 'dono', '')), '[]'::jsonb)
  INTO bonecos_b
  FROM jsonb_array_elements_text(COALESCE(cfg_row.team_b, '[]'::jsonb));

  SELECT COALESCE(jsonb_agg(jsonb_build_object('char', value, 'dono', '')), '[]'::jsonb)
  INTO bonecos_c
  FROM jsonb_array_elements_text(COALESCE(cfg_row.team_c, '[]'::jsonb));

  payload := jsonb_build_array(
    jsonb_build_object(
      'id', 'A', 'name', 'Time A', 'color', '#58a6ff',
      'fixos', COALESCE(cfg_row.fixos, '[]'::jsonb),
      'bonecos', bonecos_a
    ),
    jsonb_build_object(
      'id', 'B', 'name', 'Time B', 'color', '#da3633',
      'fixos', COALESCE(cfg_row.fixos, '[]'::jsonb),
      'bonecos', bonecos_b
    ),
    jsonb_build_object(
      'id', 'C', 'name', 'Time C', 'color', '#d29922',
      'fixos', COALESCE(cfg_row.fixos, '[]'::jsonb),
      'bonecos', bonecos_c
    )
  );

  UPDATE config      SET teams_data = payload WHERE id = 1;
  UPDATE team_config SET teams_data = payload WHERE team_id = 'default';
END $$;

-- 4) Conferencia (rode depois pra validar):
-- SELECT team_id, jsonb_array_length(teams_data) AS n_subteams,
--        jsonb_array_length(teams_data->0->'fixos') AS time_a_fixos,
--        jsonb_array_length(teams_data->0->'bonecos') AS time_a_bonecos
-- FROM team_config;
--
-- SELECT count(*) AS quests_total,
--        count(*) FILTER (WHERE ausentes <> '[]'::jsonb) AS quests_com_ausentes,
--        count(*) FILTER (WHERE bonecos_pilotados <> '[]'::jsonb) AS quests_com_bonecos_pilotados
-- FROM quests;
