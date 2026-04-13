import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorios!');
  console.error('   Crie um arquivo .env com essas variaveis.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Drops ──────────────────────────────────────────────────────────

export async function getDrops() {
  const { data, error } = await supabase
    .from('drops')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(formatDropOut);
}

export async function addDrop(drop) {
  const row = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    item: drop.item || '',
    boss: drop.boss || '',
    char: drop.char || '',
    pagante: drop.pagante || '',
    drop_date: drop.dropDate || '',
    dropador: drop.dropador || '',
    suplentes: drop.suplentes || [],
    loot: drop.loot || '',
    service_price: drop.servicePrice || '',
    tempo: drop.tempo || '',
    sold_price: '',
    sold_date: '',
  };

  const { data, error } = await supabase
    .from('drops')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return formatDropOut(data);
}

export async function updateDrop(id, updates) {
  const row = {};
  if (updates.item !== undefined) row.item = updates.item;
  if (updates.boss !== undefined) row.boss = updates.boss;
  if (updates.char !== undefined) row.char = updates.char;
  if (updates.pagante !== undefined) row.pagante = updates.pagante;
  if (updates.dropDate !== undefined) row.drop_date = updates.dropDate;
  if (updates.dropador !== undefined) row.dropador = updates.dropador;
  if (updates.suplentes !== undefined) row.suplentes = updates.suplentes;
  if (updates.loot !== undefined) row.loot = updates.loot;
  if (updates.servicePrice !== undefined) row.service_price = updates.servicePrice;
  if (updates.tempo !== undefined) row.tempo = updates.tempo;
  if (updates.soldPrice !== undefined) row.sold_price = updates.soldPrice;
  if (updates.soldDate !== undefined) row.sold_date = updates.soldDate;

  const { data, error } = await supabase
    .from('drops')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return formatDropOut(data);
}

export async function deleteDrop(id) {
  const { error } = await supabase
    .from('drops')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { ok: true };
}

// ── Config ─────────────────────────────────────────────────────────

export async function getConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return formatConfigOut(data);
}

export async function saveConfig(config) {
  const row = {
    password: config.password,
    bosses: config.bosses || [],
    fixos: config.fixos || [],
    bonecos: config.bonecos || [],
    items: config.items || {},
    team_a: config.teamA || [],
    team_b: config.teamB || [],
    tc_price_real: config.tcPriceReal || '',
    tc_price_kk: config.tcPriceKK || '',
    tc_qty: config.tcQty || '',
    removed_bosses: config.removedBosses || [],
    removed_fixos: config.removedFixos || [],
    removed_items: config.removedItems || [],
  };

  const { data, error } = await supabase
    .from('config')
    .update(row)
    .eq('id', 1)
    .select()
    .single();
  if (error) throw error;
  return formatConfigOut(data);
}

export async function checkPassword(password) {
  const { data, error } = await supabase
    .from('config')
    .select('password')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data.password === password;
}

// ── Helpers (converte snake_case do DB → camelCase do frontend) ────

function formatDropOut(row) {
  return {
    id: row.id,
    item: row.item,
    boss: row.boss,
    char: row.char,
    pagante: row.pagante,
    drop_date: row.drop_date,
    dropador: row.dropador,
    suplentes: row.suplentes || [],
    loot: row.loot,
    service_price: row.service_price,
    tempo: row.tempo,
    sold_price: row.sold_price,
    sold_date: row.sold_date,
    created_at: row.created_at,
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
    tcPriceReal: row.tc_price_real || '',
    tcPriceKK: row.tc_price_kk || '',
    tcQty: row.tc_qty || '',
    removedBosses: row.removed_bosses || [],
    removedFixos: row.removed_fixos || [],
    removedItems: row.removed_items || [],
  };
}
