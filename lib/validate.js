// Validacao leve de payloads dos endpoints write.
// Filosofia: rejeita inputs claramente errados (tipo, tamanho excessivo)
// e devolve um objeto sanitizado (trim, fields desconhecidos descartados).
// Erros levantados aqui carregam code 'INVALID_INPUT' -> 400 no handler.

function bad(msg) {
  const e = new Error(msg);
  e.code = 'INVALID_INPUT';
  return e;
}

// String: forca string, trim, limita tamanho. Vazio = ''.
function str(value, fieldName, { max = 200, optional = true } = {}) {
  if (value === undefined || value === null) {
    if (optional) return '';
    throw bad(`${fieldName} é obrigatório`);
  }
  if (typeof value !== 'string') {
    if (typeof value === 'number') value = String(value);
    else throw bad(`${fieldName} deve ser texto`);
  }
  const v = value.trim();
  if (v.length > max) throw bad(`${fieldName} excede ${max} caracteres`);
  return v;
}

function arr(value, fieldName, { max = 100, optional = true } = {}) {
  if (value === undefined || value === null) {
    if (optional) return [];
    throw bad(`${fieldName} é obrigatório`);
  }
  if (!Array.isArray(value)) throw bad(`${fieldName} deve ser uma lista`);
  if (value.length > max) throw bad(`${fieldName} excede ${max} itens`);
  return value;
}

function arrOfStrings(value, fieldName, { max = 200, itemMax = 120 } = {}) {
  return arr(value, fieldName, { max }).map((v, i) =>
    str(v, `${fieldName}[${i}]`, { max: itemMax })
  );
}

function suplentes(value) {
  return arr(value, 'suplentes', { max: 20 }).map((s, i) => {
    if (!s || typeof s !== 'object') throw bad(`suplentes[${i}] deve ser objeto`);
    return {
      nome: str(s.nome, `suplentes[${i}].nome`, { max: 80 }),
      lugarDe: str(s.lugarDe, `suplentes[${i}].lugarDe`, { max: 80 }),
      // boneco opcional: se preenchido, indica que esse suplente pilotou
      // o boneco do fixo lugarDe (ativando regra do divisor 8 nos drops).
      boneco: str(s.boneco, `suplentes[${i}].boneco`, { max: 120 }),
    };
  });
}

// team agora aceita qualquer id curto (A, B, C, D, "alpha", etc).
// Validacao de id existente fica no front via teamsData.
function team(value) {
  return str(value, 'team', { max: 30 });
}

function bonecosPilotados(value) {
  return arr(value, 'bonecosPilotados', { max: 30 }).map((b, i) => {
    if (!b || typeof b !== 'object') throw bad(`bonecosPilotados[${i}] deve ser objeto`);
    return {
      char: str(b.char, `bonecosPilotados[${i}].char`, { max: 120 }),
      dono: str(b.dono, `bonecosPilotados[${i}].dono`, { max: 80 }),
      piloto: str(b.piloto, `bonecosPilotados[${i}].piloto`, { max: 80 }),
    };
  });
}

function teamsData(value) {
  return arr(value, 'teamsData', { max: 30 }).map((t, i) => {
    if (!t || typeof t !== 'object') throw bad(`teamsData[${i}] deve ser objeto`);
    return {
      id: str(t.id, `teamsData[${i}].id`, { max: 30 }),
      name: str(t.name, `teamsData[${i}].name`, { max: 60 }),
      color: str(t.color, `teamsData[${i}].color`, { max: 20 }),
      fixos: arrOfStrings(t.fixos, `teamsData[${i}].fixos`, { max: 30, itemMax: 80 }),
      bonecos: arr(t.bonecos, `teamsData[${i}].bonecos`, { max: 50 }).map((b, j) => {
        if (!b || typeof b !== 'object') throw bad(`teamsData[${i}].bonecos[${j}] deve ser objeto`);
        return {
          char: str(b.char, `teamsData[${i}].bonecos[${j}].char`, { max: 120 }),
          dono: str(b.dono, `teamsData[${i}].bonecos[${j}].dono`, { max: 80 }),
        };
      }),
    };
  });
}

function dropEntry(d, idx) {
  if (!d || typeof d !== 'object') throw bad(`drops[${idx}] deve ser objeto`);
  return {
    ...(d.id !== undefined ? { id: str(d.id, `drops[${idx}].id`, { max: 50 }) } : {}),
    item: str(d.item, `drops[${idx}].item`, { max: 120 }),
    boss: str(d.boss, `drops[${idx}].boss`, { max: 120 }),
    char: str(d.char, `drops[${idx}].char`, { max: 120 }),
    dropador: str(d.dropador, `drops[${idx}].dropador`, { max: 120 }),
    soldPrice: str(d.soldPrice, `drops[${idx}].soldPrice`, { max: 30 }),
    soldDate: str(d.soldDate, `drops[${idx}].soldDate`, { max: 12 }),
  };
}

export function validateQuestPayload(payload) {
  if (!payload || typeof payload !== 'object') throw bad('payload inválido');
  return {
    dropDate: str(payload.dropDate, 'dropDate', { max: 12 }),
    pagante: str(payload.pagante, 'pagante', { max: 80 }),
    team: team(payload.team),
    suplentes: suplentes(payload.suplentes),
    loot: str(payload.loot, 'loot', { max: 30 }),
    servicePrice: str(payload.servicePrice, 'servicePrice', { max: 30 }),
    tempo: str(payload.tempo, 'tempo', { max: 10 }),
    ausentes: arrOfStrings(payload.ausentes, 'ausentes', { max: 30, itemMax: 80 }),
    bonecosPilotados: bonecosPilotados(payload.bonecosPilotados),
    drops: arr(payload.drops, 'drops', { max: 50 }).map(dropEntry),
  };
}

// Versao parcial: so valida campos PRESENTES no payload, preservando
// undefined nos demais (semantica de "nao tocar este campo").
export function validateQuestUpdatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw bad('payload inválido');
  const out = {};
  if (payload.dropDate !== undefined) out.dropDate = str(payload.dropDate, 'dropDate', { max: 12 });
  if (payload.pagante !== undefined) out.pagante = str(payload.pagante, 'pagante', { max: 80 });
  if (payload.team !== undefined) out.team = team(payload.team);
  if (payload.suplentes !== undefined) out.suplentes = suplentes(payload.suplentes);
  if (payload.loot !== undefined) out.loot = str(payload.loot, 'loot', { max: 30 });
  if (payload.servicePrice !== undefined) out.servicePrice = str(payload.servicePrice, 'servicePrice', { max: 30 });
  if (payload.tempo !== undefined) out.tempo = str(payload.tempo, 'tempo', { max: 10 });
  if (payload.ausentes !== undefined) out.ausentes = arrOfStrings(payload.ausentes, 'ausentes', { max: 30, itemMax: 80 });
  if (payload.bonecosPilotados !== undefined) out.bonecosPilotados = bonecosPilotados(payload.bonecosPilotados);
  if (payload.drops !== undefined) {
    out.drops = arr(payload.drops, 'drops', { max: 50 }).map(dropEntry);
  }
  return out;
}

export function validateDropSalePayload(payload) {
  if (!payload || typeof payload !== 'object') throw bad('payload inválido');
  const out = {};
  if (payload.soldPrice !== undefined) out.soldPrice = str(payload.soldPrice, 'soldPrice', { max: 30 });
  if (payload.soldDate !== undefined) out.soldDate = str(payload.soldDate, 'soldDate', { max: 12 });
  return out;
}

export function validateConfigPayload(payload) {
  if (!payload || typeof payload !== 'object') throw bad('payload inválido');
  // Valida items: object {nome: url}
  let items = {};
  if (payload.items !== undefined) {
    if (typeof payload.items !== 'object' || Array.isArray(payload.items)) {
      throw bad('items deve ser objeto');
    }
    const keys = Object.keys(payload.items);
    if (keys.length > 500) throw bad('items excede 500 entradas');
    for (const k of keys) {
      const name = str(k, 'items.<key>', { max: 120 });
      const url = str(payload.items[k], `items["${name}"]`, { max: 500 });
      items[name] = url;
    }
  }
  return {
    bosses: arrOfStrings(payload.bosses, 'bosses'),
    fixos: arrOfStrings(payload.fixos, 'fixos'),
    bonecos: arrOfStrings(payload.bonecos, 'bonecos'),
    items,
    teamA: arrOfStrings(payload.teamA, 'teamA', { max: 50 }),
    teamB: arrOfStrings(payload.teamB, 'teamB', { max: 50 }),
    teamC: arrOfStrings(payload.teamC, 'teamC', { max: 50 }),
    teamsData: teamsData(payload.teamsData),
    tcPriceReal: str(payload.tcPriceReal, 'tcPriceReal', { max: 20 }),
    tcPriceKK: str(payload.tcPriceKK, 'tcPriceKK', { max: 20 }),
    tcQty: str(payload.tcQty, 'tcQty', { max: 20 }),
    removedBosses: arrOfStrings(payload.removedBosses, 'removedBosses'),
    removedFixos: arrOfStrings(payload.removedFixos, 'removedFixos'),
    removedItems: arrOfStrings(payload.removedItems, 'removedItems'),
  };
}

// ── Mapping centralizado de err.code -> HTTP status ────────────────
export function sendApiError(res, err, contextLabel = '') {
  const code = err && err.code;
  if (code === 'INVALID_INPUT') return res.status(400).json({ error: err.message });
  if (code === 'WEAK_PASSWORD') return res.status(400).json({ error: err.message });
  if (code === 'BAD_CURRENT_PASSWORD') return res.status(401).json({ error: err.message });
  if (code === 'PGRST116') return res.status(404).json({ error: 'Recurso não encontrado' });
  if (contextLabel) console.error(`${contextLabel} error:`, err);
  return res.status(500).json({ error: err && err.message ? err.message : 'Erro interno' });
}
