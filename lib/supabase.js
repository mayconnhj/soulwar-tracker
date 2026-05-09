import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import {
  validateQuestPayload, validateQuestUpdatePayload,
  validateDropSalePayload, validateConfigPayload
} from './validate.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorios!');
  console.error('   Crie um arquivo .env com essas variaveis.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

const BCRYPT_ROUNDS = 10;
// Strings que comecam com $2a$, $2b$ ou $2y$ ja sao hashes bcrypt.
const isBcryptHash = (s) => typeof s === 'string' && /^\$2[aby]\$/.test(s);

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), BCRYPT_ROUNDS);
}

// ── Helpers de id ──────────────────────────────────────────────────
function genId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Quests CRUD (com drops aninhadas) ──────────────────────────────

/**
 * Retorna todas as quests com seus drops aninhados.
 * Saida: [{id, dropDate, pagante, team, suplentes, loot, servicePrice, tempo, createdAt, drops: [...]}]
 */
export async function getQuests() {
  const [{ data: quests, error: qe }, { data: drops, error: de }] = await Promise.all([
    supabase.from('quests').select('*').order('created_at', { ascending: false }),
    supabase.from('drops').select('*').order('created_at', { ascending: true })
  ]);
  if (qe) throw qe;
  if (de) throw de;

  const byQuest = {};
  for (const d of drops) {
    const qid = d.quest_id || '';
    if (!qid) continue;
    if (!byQuest[qid]) byQuest[qid] = [];
    byQuest[qid].push(formatDropOut(d));
  }

  return quests.map(q => ({
    ...formatQuestOut(q),
    drops: byQuest[q.id] || []
  }));
}

/**
 * Cria UMA quest com 0..N drops vinculados.
 * Body esperado:
 * { dropDate, pagante, team, suplentes, loot, servicePrice, tempo,
 *   drops: [{item, boss, char, dropador}] }
 */
export async function addQuest(rawPayload) {
  const payload = validateQuestPayload(rawPayload);
  const questId = genId();
  const questRow = {
    id: questId,
    drop_date: payload.dropDate,
    pagante: payload.pagante,
    team: payload.team,
    suplentes: payload.suplentes,
    loot: payload.loot,
    service_price: payload.servicePrice,
    tempo: payload.tempo
  };

  const { data: quest, error: qe } = await supabase
    .from('quests').insert(questRow).select().single();
  if (qe) throw qe;

  const drops = payload.drops.map(d => ({
    id: genId('d'),
    quest_id: questId,
    item: d.item,
    boss: d.boss,
    char: d.char,
    dropador: d.dropador,
    sold_price: d.soldPrice,
    sold_date: d.soldDate
  }));

  let savedDrops = [];
  if (drops.length > 0) {
    const { data, error: de } = await supabase
      .from('drops').insert(drops).select();
    if (de) throw de;
    savedDrops = data;
  }

  return {
    ...formatQuestOut(quest),
    drops: savedDrops.map(formatDropOut)
  };
}

/**
 * Atualiza UMA quest e sincroniza seus drops:
 * - drops com `id` existente em payload.drops viram update
 * - drops sem `id` viram insert
 * - drops que estavam no DB mas nao vieram no payload viram delete
 *
 * Body: mesmo formato de addQuest, com cada drop podendo carregar `id`.
 */
export async function updateQuest(id, rawPayload) {
  const payload = validateQuestUpdatePayload(rawPayload);
  // 1) Atualiza campos da quest
  const questRow = {};
  if (payload.dropDate !== undefined) questRow.drop_date = payload.dropDate;
  if (payload.pagante !== undefined) questRow.pagante = payload.pagante;
  if (payload.team !== undefined) questRow.team = payload.team;
  if (payload.suplentes !== undefined) questRow.suplentes = payload.suplentes;
  if (payload.loot !== undefined) questRow.loot = payload.loot;
  if (payload.servicePrice !== undefined) questRow.service_price = payload.servicePrice;
  if (payload.tempo !== undefined) questRow.tempo = payload.tempo;

  if (Object.keys(questRow).length > 0) {
    const { error } = await supabase.from('quests').update(questRow).eq('id', id);
    if (error) throw error;
  }

  // 2) Sincroniza drops, se vieram no payload
  if (Array.isArray(payload.drops)) {
    const { data: existing, error: ex } = await supabase
      .from('drops').select('id').eq('quest_id', id);
    if (ex) throw ex;
    const existingIds = new Set((existing || []).map(d => d.id));

    // Coleta os IDs que o cliente mandou e que NAO sao desta quest.
    // Se algum desses ja existir em outra quest no DB, rejeita o request
    // (evita "roubo" de drop via upsert sobrescrevendo quest_id).
    const foreignIds = (payload.drops || [])
      .filter(d => d.id && !existingIds.has(d.id))
      .map(d => d.id);
    if (foreignIds.length > 0) {
      const { data: clash, error: ce } = await supabase
        .from('drops').select('id,quest_id').in('id', foreignIds);
      if (ce) throw ce;
      const stolen = (clash || []).find(c => c.quest_id && c.quest_id !== id);
      if (stolen) {
        const e = new Error(`drop ${stolen.id} pertence a outra quest`);
        e.code = 'INVALID_INPUT';
        throw e;
      }
    }

    const toUpsert = [];
    const incomingIds = new Set();

    for (const d of payload.drops) {
      const dropId = d.id || genId('d');
      incomingIds.add(dropId);
      toUpsert.push({
        id: dropId,
        quest_id: id,
        item: d.item,
        boss: d.boss,
        char: d.char,
        dropador: d.dropador,
        sold_price: d.soldPrice,
        sold_date: d.soldDate
      });
    }

    // remove drops que existiam mas sairam
    const toDelete = [...existingIds].filter(eid => !incomingIds.has(eid));
    if (toDelete.length > 0) {
      const { error } = await supabase.from('drops').delete().in('id', toDelete);
      if (error) throw error;
    }

    if (toUpsert.length > 0) {
      // Limpa undefineds (Supabase nao gosta) e usa upsert
      const cleaned = toUpsert.map(r => {
        const c = {};
        for (const k of Object.keys(r)) if (r[k] !== undefined) c[k] = r[k];
        return c;
      });
      const { error } = await supabase.from('drops').upsert(cleaned);
      if (error) throw error;
    }
  }

  return getQuestById(id);
}

export async function getQuestById(id) {
  const { data: quest, error } = await supabase
    .from('quests').select('*').eq('id', id).single();
  if (error) throw error;

  const { data: drops, error: de } = await supabase
    .from('drops').select('*').eq('quest_id', id).order('created_at');
  if (de) throw de;

  return {
    ...formatQuestOut(quest),
    drops: (drops || []).map(formatDropOut)
  };
}

export async function deleteQuest(id) {
  // remove drops da quest primeiro
  const { error: de } = await supabase.from('drops').delete().eq('quest_id', id);
  if (de) throw de;
  const { error } = await supabase.from('quests').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

// ── Drops: marcar venda individual ──────────────────────────────────

export async function updateDropSale(dropId, rawPayload) {
  const payload = validateDropSalePayload(rawPayload);
  const row = {};
  if (payload.soldPrice !== undefined) row.sold_price = payload.soldPrice;
  if (payload.soldDate !== undefined) row.sold_date = payload.soldDate;

  const { data, error } = await supabase
    .from('drops').update(row).eq('id', dropId).select().single();
  if (error) throw error;
  return formatDropOut(data);
}

// ── Config ─────────────────────────────────────────────────────────

export async function getConfig() {
  const { data, error } = await supabase
    .from('config').select('*').eq('id', 1).single();
  if (error) throw error;
  return formatConfigOut(data);
}

export async function saveConfig(rawConfig) {
  // Whitelist: 'password' NAO entra por aqui. Use changePassword().
  const config = validateConfigPayload(rawConfig);
  const row = {
    bosses: config.bosses,
    fixos: config.fixos,
    bonecos: config.bonecos,
    items: config.items,
    team_a: config.teamA,
    team_b: config.teamB,
    team_c: config.teamC,
    tc_price_real: config.tcPriceReal,
    tc_price_kk: config.tcPriceKK,
    tc_qty: config.tcQty,
    removed_bosses: config.removedBosses,
    removed_fixos: config.removedFixos,
    removed_items: config.removedItems,
  };

  const { data, error } = await supabase
    .from('config').update(row).eq('id', 1).select().single();
  if (error) throw error;
  return formatConfigOut(data);
}

export async function checkPassword(password) {
  const { data, error } = await supabase
    .from('config').select('password').eq('id', 1).single();
  if (error) throw error;

  const stored = data.password || '';
  if (!stored) return false;

  if (isBcryptHash(stored)) {
    return bcrypt.compare(String(password), stored);
  }

  // Migracao transparente: senha legada em texto puro.
  // Se bater, re-hasha de imediato e atualiza no banco. Login bem-sucedido
  // ja deixa o registro seguro pra proxima vez.
  if (stored === password) {
    try {
      const hashed = await hashPassword(password);
      await supabase.from('config').update({ password: hashed }).eq('id', 1);
    } catch (e) {
      console.error('Falha ao re-hashar senha legada:', e);
    }
    return true;
  }
  return false;
}

/**
 * Troca a senha admin exigindo a senha atual como prova.
 * Incrementa auth_version pra invalidar todos os tokens existentes.
 */
export async function changePassword(currentPassword, newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < 4) {
    const e = new Error('Nova senha precisa ter no minimo 4 caracteres');
    e.code = 'WEAK_PASSWORD';
    throw e;
  }
  const ok = await checkPassword(currentPassword);
  if (!ok) {
    const e = new Error('Senha atual incorreta');
    e.code = 'BAD_CURRENT_PASSWORD';
    throw e;
  }
  const hashed = await hashPassword(newPassword);
  const currentVersion = await getAuthVersion();
  const { error } = await supabase
    .from('config').update({ password: hashed, auth_version: currentVersion + 1 }).eq('id', 1);
  if (error) throw error;
  return { ok: true };
}

// auth_version: incrementada em cada change-password pra invalidar tokens.
export async function getAuthVersion() {
  const { data, error } = await supabase
    .from('config').select('auth_version').eq('id', 1).single();
  if (error) throw error;
  return Number(data.auth_version || 0);
}

// ── Formatters (snake_case do DB → camelCase do frontend) ──────────

function formatQuestOut(row) {
  return {
    id: row.id,
    dropDate: row.drop_date || '',
    pagante: row.pagante || '',
    team: row.team || '',
    suplentes: row.suplentes || [],
    loot: row.loot || '',
    servicePrice: row.service_price || '',
    tempo: row.tempo || '',
    createdAt: row.created_at
  };
}

function formatDropOut(row) {
  return {
    id: row.id,
    questId: row.quest_id || '',
    item: row.item || '',
    boss: row.boss || '',
    char: row.char || '',
    dropador: row.dropador || '',
    soldPrice: row.sold_price || '',
    soldDate: row.sold_date || '',
    createdAt: row.created_at
  };
}

function formatConfigOut(row) {
  return {
    password: row.password,
    bosses: row.bosses || [],
    fixos: row.fixos || [],
    bonecos: row.bonecos || [],
    items: row.items || {},
    teamA: row.team_a || [],
    teamB: row.team_b || [],
    teamC: row.team_c || [],
    tcPriceReal: row.tc_price_real || '',
    tcPriceKK: row.tc_price_kk || '',
    tcQty: row.tc_qty || '',
    removedBosses: row.removed_bosses || [],
    removedFixos: row.removed_fixos || [],
    removedItems: row.removed_items || [],
  };
}
