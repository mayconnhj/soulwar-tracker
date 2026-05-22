// Helpers de parsing/formatacao + calculo de analytics da Soulwar.
// Extraidos do App.jsx pra serem testaveis isoladamente.

export const BASE_DIVISOR = 7;       // divisor de drops para quests sem dados de presenca (legacy)
const SVC_DIV_DEFAULT = 5;            // divisor padrao do service quando o time nao tem fixos definidos
const VAGAS_EXTRAS_DEFAULT = 2;       // vagas além dos 5 fixos (= 2 emprestantes implícitos pra A/B)

// Normaliza um fixo: aceita string ou {nome, peso}. Retorna sempre objeto.
// Peso default = 1. Time C tem fixos com peso 2 (Raaro, Starcall).
export function normFixo(f) {
  if (typeof f === 'string') return { nome: f, peso: 1 };
  if (f && typeof f === 'object') {
    return { nome: f.nome || '', peso: Number(f.peso) > 0 ? Number(f.peso) : 1 };
  }
  return { nome: '', peso: 1 };
}

// Lista de fixos normalizada (sempre objetos {nome, peso}).
export function teamFixosObjs(team) {
  return ((team && team.fixos) || []).map(normFixo).filter(f => f.nome);
}

// Mapa { nome.lowercase -> peso } pra lookup rápido.
function buildPesoMap(fixosObjs) {
  const m = {};
  fixosObjs.forEach(f => { m[f.nome.toLowerCase()] = f.peso; });
  return m;
}

export function parseDate(d) {
  if (!d) return null;
  const [dd, mm, yy] = String(d).split('/');
  if (!dd || !mm || !yy) return null;
  return new Date(Number(yy), Number(mm) - 1, Number(dd));
}

// ── Filtro de data unificado (Análise, Fixo, Histórico) ────────────
const MESES = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, 'março': 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

export function monthFromName(s) {
  if (!s) return null;
  const k = String(s).toLowerCase().trim();
  return MESES[k] || null;
}

function normYear(y) {
  return y < 100 ? 2000 + y : y;
}

/**
 * Interpreta o texto de filtro de data em vários formatos BR.
 * Retorna { day?, month?, year? } ou null se vazio/não reconhecido.
 *
 *  "abril" / "abr" / "ABRIL"   -> { month: 4 }
 *  "04" / "4"                  -> { month: 4 }
 *  "2026"                      -> { year: 2026 }
 *  "04/2026" / "abril 2026"    -> { month: 4, year: 2026 }
 *  "12/04/2026" (BR)           -> { day: 12, month: 4, year: 2026 }
 *  "2026-04" (input month)     -> { year: 2026, month: 4 }
 */
export function parseDateFilter(text) {
  if (!text) return null;
  const s = String(text).trim().toLowerCase();
  if (!s) return null;

  let m;
  // Data completa BR: DD/MM/YYYY (/, - ou .)
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) return { day: +m[1], month: +m[2], year: normYear(+m[3]) };

  // Mês/ano numérico: MM/YYYY
  m = s.match(/^(\d{1,2})[/\-.](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { month: +m[1], year: +m[2] };

  // Nome do mês + ano: "abril 2026" / "abril/2026"
  m = s.match(/^([a-zç]+)[\s/\-.]+(\d{4})$/);
  if (m) {
    const mo = monthFromName(m[1]);
    if (mo) return { month: mo, year: +m[2] };
  }

  // Input month nativo: YYYY-MM
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return { year: +m[1], month: +m[2] };

  // Só ano: 2026
  m = s.match(/^(\d{4})$/);
  if (m) return { year: +m[1] };

  // Só número do mês: 1-12
  m = s.match(/^(\d{1,2})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { month: +m[1] };

  // Só nome do mês: "abril"
  const mo = monthFromName(s);
  if (mo) return { month: mo };

  return null; // não reconhecido — tratado como "sem filtro" (passa tudo)
}

/**
 * True se a data BR (DD/MM/YYYY) bate com o filtro de texto.
 * Filtro vazio ou não reconhecido = passa tudo (true).
 */
export function dateMatchesFilter(dateBR, filterText) {
  const f = parseDateFilter(filterText);
  if (!f) return true;
  const dt = parseDate(dateBR);
  if (!dt) return false;
  if (f.year !== undefined && dt.getFullYear() !== f.year) return false;
  if (f.month !== undefined && (dt.getMonth() + 1) !== f.month) return false;
  if (f.day !== undefined && dt.getDate() !== f.day) return false;
  return true;
}

export function fromIso(iso) {
  if (!iso) return '';
  const [yy, mm, dd] = String(iso).split('-');
  if (!yy || !mm || !dd) return '';
  return `${dd}/${mm}/${yy}`;
}

export function fmtMin(m) {
  if (!m && m !== 0) return '—';
  const v = parseInt(m);
  if (isNaN(v)) return String(m);
  const h = Math.floor(v / 60), r = v % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h${r}m`;
}

export function parseSold(p) {
  if (!p) return { kk: 0, tc: 0 };
  const s = String(p).toLowerCase().trim();
  const num = parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (s.includes('tc')) return { kk: 0, tc: isNaN(num) ? 0 : num };
  return { kk: isNaN(num) ? 0 : num, tc: 0 };
}

// Hint visual no input de venda: mostra como o valor vai ser interpretado.
// error=true bloqueia o save (no front); warn=true so alerta sem bloquear.
export function saleHint(s) {
  if (!s || !String(s).trim()) return null;
  const t = String(s).toLowerCase();
  const hasUnit = t.includes('kk') || t.includes('tc');
  const { kk, tc } = parseSold(s);
  if (kk === 0 && tc === 0) return { text: 'valor não reconhecido', error: true };
  if (!hasUnit) return { text: '⚠️ Adicione "kk" ou "tc" — sem unidade não dá pra salvar', error: true };
  return { text: kk ? `→ ${kk}kk` : `→ ${tc}tc`, warn: false };
}

// Helper pro frontend: true se o valor de venda esta valido pra salvar.
export function isValidSalePrice(s) {
  const h = saleHint(s);
  return !h || !h.error;
}

// Agrega rows case-insensitive: "Maycon"/"maycon" viram a mesma entrada,
// exibindo o label do registro mais frequente.
export function aggregateCi(rows, getKey) {
  const buckets = {};
  rows.forEach(d => {
    const raw = getKey(d); if (!raw) return;
    const k = String(raw).toLowerCase();
    if (!buckets[k]) buckets[k] = { count: 0, labels: {} };
    buckets[k].count++;
    buckets[k].labels[raw] = (buckets[k].labels[raw] || 0) + 1;
  });
  return Object.values(buckets)
    .map(b => ({
      name: Object.entries(b.labels).sort((a, b) => b[1] - a[1])[0][0],
      count: b.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Distribui uma quest entre seus recipientes com PESOS.
 *
 * 3 modos:
 *  1. LEGACY (sem dados): assume fixos presentes, divisor=BASE_DIVISOR=7.
 *  2. bonecosPilotados (formato 2.5f): retrocompat de quests gravadas.
 *  3. SUPLENTES (modo principal): deriva de q.suplentes + team config.
 *
 * Pesos:
 *  - Cada fixo do time tem um peso (default 1).
 *  - Suplente cobrindo X HERDA o peso de X.
 *  - Suplente em vaga extra ou vaga anônima: peso 1.
 *  - Ausente com boneco pilotado: +1 share peso 1 (regra "+1").
 *
 * Vagas extras:
 *  - team.vagasExtras (default 2). Quantos emprestantes implícitos.
 *  - Suplentes em vaga extra OCUPAM essas vagas. Se sobram vagas
 *    não cobertas, viram "vagas anônimas" (peso 1, somam no divisor mas
 *    não distribuem pra ninguém — representam emprestantes não registrados).
 *
 * Loot/Service: NÃO usam pesos. Cada recipiente loot/svc recebe q.loot
 * inteiro (igual antes); service / num_fixos do time.
 *
 * @param {object} q - quest
 * @param {object|array} team - objeto team completo OU array de fixos legado
 */
export function questDistribution(q, team) {
  // Aceita array (compat) ou objeto.
  const teamObj = Array.isArray(team) ? { fixos: team } : (team || {});
  const fixosObjs = teamFixosObjs(teamObj);
  const fixos = fixosObjs.map(f => f.nome);
  const fixosLowerSet = new Set(fixos.map(f => f.toLowerCase()));
  const pesoMap = buildPesoMap(fixosObjs);
  const _ve = teamObj.vagasExtras;
  const vagasExtras = (_ve !== undefined && _ve !== null && Number.isFinite(Number(_ve)) && Number(_ve) >= 0)
    ? Number(_ve) : VAGAS_EXTRAS_DEFAULT;

  const bonecosPil = q.bonecosPilotados || [];
  const sups = (q.suplentes || []).filter(s => s.nome);
  const ausentesQ = q.ausentes || [];
  const pesoOf = nome => (pesoMap[String(nome).toLowerCase()] || 1);

  // ── LEGACY ────────────────────────────────────────────────────────
  if (bonecosPil.length === 0 && sups.length === 0 && ausentesQ.length === 0) {
    const pesos = {};
    fixos.forEach(f => { pesos[f] = pesoOf(f); });
    const sumFixos = fixos.reduce((s, f) => s + pesoOf(f), 0);
    // Divisor de drops = config do time = soma dos pesos dos fixos +
    // vagas extras. NUNCA recalculado por quantidade de bonecos.
    // Ex Time C: 3×1 + 2×2 + 3 vagas = 10. Time A: 5×1 + 2 = 7.
    // Só cai no BASE_DIVISOR (7) se o time não tem fixos cadastrados.
    const divisorLegacy = sumFixos > 0 ? (sumFixos + vagasExtras) : BASE_DIVISOR;
    return {
      isLegacy: true, mode: 'legacy',
      recipientesLootSvc: [...fixos],
      recipientesDrops: [...fixos],
      dropsPesos: pesos,
      divisorDrops: divisorLegacy,
      divisorService: fixos.length || SVC_DIV_DEFAULT,
      ausentes: [],
      ausentesComBonecoPilotado: [],
      pilotosNaoFixos: [],
      vagasExtras,
      sumPesosFixos: sumFixos,
    };
  }

  // ── 2.5f retrocompat ─────────────────────────────────────────────
  if (bonecosPil.length > 0) {
    const pilotos = [...new Set(bonecosPil.map(b => b.piloto).filter(Boolean))];
    const pilotosLowerSet = new Set(pilotos.map(p => p.toLowerCase()));
    const ausentes = fixos.filter(f => !pilotosLowerSet.has(f.toLowerCase()));
    const ausentesLowerSet = new Set(ausentes.map(a => a.toLowerCase()));
    const ausentesComBoneco = [...new Set(
      bonecosPil
        .filter(b => b.dono && ausentesLowerSet.has(b.dono.toLowerCase())
                    && b.piloto && b.piloto.toLowerCase() !== b.dono.toLowerCase())
        .map(b => b.dono)
    )];
    const recipientesLootSvc = pilotos;
    const recipientesDrops = [...pilotos, ...ausentesComBoneco];
    const pilotosNaoFixos = pilotos.filter(p => !fixosLowerSet.has(p.toLowerCase()));
    const dropsPesos = {};
    pilotos.forEach(p => { dropsPesos[p] = pesoOf(p); });
    ausentesComBoneco.forEach(a => { dropsPesos[a] = 1; });  // share extra peso 1
    return {
      isLegacy: false, mode: 'bonecosPilotados',
      recipientesLootSvc, recipientesDrops,
      dropsPesos,
      divisorDrops: Object.values(dropsPesos).reduce((s, p) => s + p, 0),
      divisorService: fixos.length || SVC_DIV_DEFAULT,
      ausentes, ausentesComBonecoPilotado: ausentesComBoneco,
      pilotosNaoFixos, vagasExtras,
      sumPesosFixos: fixos.reduce((s, f) => s + pesoOf(f), 0),
    };
  }

  // ── MODO SUPLENTES (principal) ────────────────────────────────────
  const ausentesFromSups = sups.map(s => s.lugarDe).filter(Boolean);
  const ausentesAll = [...new Set([...ausentesQ, ...ausentesFromSups])];
  const ausentesSetLower = new Set(ausentesAll.map(a => String(a).toLowerCase()));
  const presentesFixos = fixos.filter(f => !ausentesSetLower.has(f.toLowerCase()));
  const supsExtras = sups.filter(s => !s.lugarDe);
  const supsCovering = sups.filter(s => s.lugarDe);
  // Caso especial +1 share: SO ativa quando o suplente pilotou o BONECO
  // PROPRIO do fixo coberto. Se o boneco e emprestado (nao cadastrado em
  // team.bonecos como sendo do lugarDe), o fixo coberto NAO recebe drop —
  // o boneco proprio dele nao esta na quest.
  const teamBonecos = (teamObj && teamObj.bonecos) || [];
  const ehBonecoDoFixo = (bonecoNome, fixoNome) => {
    if (!bonecoNome || !fixoNome) return false;
    const b = String(bonecoNome).toLowerCase();
    const f = String(fixoNome).toLowerCase();
    return teamBonecos.some(tb =>
      tb.char && tb.char.toLowerCase() === b &&
      tb.dono && tb.dono.toLowerCase() === f
    );
  };
  const ausentesComBoneco = [...new Set(
    sups
      .filter(s => s.lugarDe && s.boneco && ehBonecoDoFixo(s.boneco, s.lugarDe))
      .map(s => s.lugarDe)
  )];

  // Pesos por recipiente em DROPS:
  //  - Fixos presentes: peso configurado.
  //  - Suplente cobrindo X: peso de X.
  //  - Suplente em vaga extra: peso 1.
  //  - Ausentes com boneco: +1 share peso 1.
  //  - Vagas anônimas (vagas extras não preenchidas por suplentes):
  //    cada uma soma 1 ao divisor mas NÃO distribui (representa
  //    emprestantes não registrados).
  const dropsPesos = {};
  presentesFixos.forEach(f => { dropsPesos[f] = pesoOf(f); });
  supsCovering.forEach(s => { dropsPesos[s.nome] = pesoOf(s.lugarDe); });
  supsExtras.forEach(s => { dropsPesos[s.nome] = 1; });
  ausentesComBoneco.forEach(a => { dropsPesos[a] = 1; });

  const sumPesosRecipientes = Object.values(dropsPesos).reduce((s, p) => s + p, 0);
  const vagasAnonimasCount = Math.max(0, vagasExtras - supsExtras.length);
  const divisorDrops = sumPesosRecipientes + vagasAnonimasCount;

  // Recipientes loot/svc (sem peso — todos recebem q.loot inteiro,
  // e service / num_fixos)
  const recipientesLootSvc = [
    ...presentesFixos,
    ...sups.map(s => s.nome),
  ];
  const recipientesDrops = Object.keys(dropsPesos);
  const pilotosNaoFixos = sups
    .map(s => s.nome)
    .filter(n => !fixosLowerSet.has(n.toLowerCase()));

  return {
    isLegacy: false, mode: 'suplentes',
    recipientesLootSvc, recipientesDrops, dropsPesos,
    divisorDrops,
    divisorService: fixos.length || SVC_DIV_DEFAULT,
    ausentes: ausentesAll,
    ausentesComBonecoPilotado: ausentesComBoneco,
    pilotosNaoFixos, vagasExtras,
    vagasAnonimasCount,
    sumPesosFixos: fixos.reduce((s, f) => s + pesoOf(f), 0),
  };
}

/**
 * Contador de "dry" (quests sem drop) por boneco, derivado do histórico.
 *
 * Percorre as quests em ordem cronológica. Pra cada boneco que participou
 * de uma quest (= boneco do time daquela quest, ou que aparece em algum
 * drop dela):
 *   - Se dropou nessa quest → fecha um ciclo (attemptsBeforeDrop = dry+1,
 *     contando a quest do drop), salva no histórico de ciclos e zera o
 *     contador.
 *   - Se NÃO dropou → +1 no contador (dry streak).
 *
 * Tudo derivado dos dados brutos: editar/excluir quest recalcula sozinho.
 *
 * @param {array} quests
 * @param {array} teams - [{id, bonecos: [{char, dono}]}]
 * @param {string} dateFilter - opcional, filtra quests pelo período
 * @returns array ordenado por currentDry desc:
 *   [{ char, teamId, currentDry, totalDrops, totalQuests, cycles,
 *      avgAttempts, lastDropDate, lastDropItem, maxDry }]
 */
export function computeDryStreaks(quests, teams, dateFilter) {
  let qs = Array.isArray(quests) ? quests : [];
  if (dateFilter) qs = qs.filter(q => dateMatchesFilter(q.dropDate, dateFilter));

  // Ordena cronológico (mais antiga -> mais nova). Sem data vai pro fim.
  const sorted = [...qs].sort((a, b) => {
    const da = parseDate(a.dropDate), db = parseDate(b.dropDate);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity);
  });

  const teamsArr = Array.isArray(teams) ? teams : [];
  const teamById = id => teamsArr.find(t => t.id === id) || null;

  const stats = {}; // char.lower -> bucket
  function bucket(char) {
    const k = String(char).toLowerCase();
    if (!stats[k]) {
      stats[k] = {
        char, teamId: null,
        currentDry: 0, totalDrops: 0, totalQuests: 0, maxDry: 0,
        cycles: [],
      };
    }
    return stats[k];
  }

  for (const q of sorted) {
    const team = teamById(q.team);
    const teamBonecos = (team && team.bonecos ? team.bonecos : [])
      .map(b => b.char).filter(Boolean);

    // Drops dessa quest, agrupados por boneco.
    const dropsByChar = {};
    (q.drops || []).forEach(d => {
      if (d.char) {
        const k = d.char.toLowerCase();
        (dropsByChar[k] = dropsByChar[k] || []).push(d.item || '');
      }
    });

    // Participantes = bonecos do time ∪ bonecos que dropram (caso fora do time).
    const partKeys = new Set([
      ...teamBonecos.map(c => c.toLowerCase()),
      ...Object.keys(dropsByChar),
    ]);

    for (const ck of partKeys) {
      const charName =
        teamBonecos.find(c => c.toLowerCase() === ck) ||
        ((q.drops || []).find(d => d.char && d.char.toLowerCase() === ck) || {}).char ||
        ck;
      const b = bucket(charName);
      if (team && !b.teamId) b.teamId = team.id;
      b.totalQuests++;

      const dropped = dropsByChar[ck];
      if (dropped && dropped.length) {
        dropped.forEach(item => {
          b.totalDrops++;
          b.cycles.push({
            attemptsBeforeDrop: b.currentDry + 1, // inclui a quest do drop
            dropDate: q.dropDate,
            itemName: item,
            questId: q.id,
          });
          b.currentDry = 0;
        });
      } else {
        b.currentDry++;
        if (b.currentDry > b.maxDry) b.maxDry = b.currentDry;
      }
    }
  }

  return Object.values(stats).map(b => {
    const avgAttempts = b.cycles.length
      ? b.cycles.reduce((s, c) => s + c.attemptsBeforeDrop, 0) / b.cycles.length
      : null;
    const last = b.cycles[b.cycles.length - 1];
    return {
      ...b,
      avgAttempts,
      lastDropDate: last ? last.dropDate : null,
      lastDropItem: last ? last.itemName : null,
    };
  }).sort((a, b) => b.currentDry - a.currentDry);
}

/**
 * Calcula todos os agregados que a aba Analise mostra.
 *
 * @param {object} args
 *   - quests: array de quests sorted (filtro aMonth aplicado dentro)
 *   - aMonth: "YYYY-MM" pra filtrar por mes, ou "" pra todos
 *   - tcKK: cotacao 1tc -> K (ex: 39 = 39 mil tibianos)
 *   - tcReal: cotacao tcQty TC -> R$ (ex: 53)
 *   - tcQty: quantidade TC do par (ex: 250)
 *   - teams: array de {id, name, color, fixos, bonecos} (opcional)
 *   - getTeam: (charName) -> 'A'|'B'|'C'|null  (fallback caso quest.team vazio)
 */
export function computeAnalytics({ quests, aMonth, tcKK, tcReal, tcQty, teams, getTeam }) {
  const _kkToReal = kk => { const tcFromKK = (kk * 1000) / tcKK; return (tcFromKK / tcQty) * tcReal; };
  const _tcToReal = tc => (tc / tcQty) * tcReal;
  const teamsArr = Array.isArray(teams) ? teams : [];
  const teamById = id => teamsArr.find(t => t.id === id) || null;

  // Filtro por mes
  let questData = Array.isArray(quests) ? quests : [];
  // aMonth aceita texto livre: "abril", "04", "2026", "04/2026",
  // "12/04/2026", ou "2026-04" (compat input month).
  if (aMonth) {
    questData = questData.filter(q => dateMatchesFilter(q.dropDate, aMonth));
  }

  const allDrops = questData.flatMap(q => (q.drops || []).map(d => ({
    ...d, questTeam: q.team, questDate: q.dropDate,
  })));

  // ── Buckets por time ──────────────────────────────────────────────
  const byTeamMap = {};
  function bucketTeam(id) {
    if (!byTeamMap[id]) {
      const t = teamById(id);
      const numFixos = teamFixosObjs(t).length;
      byTeamMap[id] = {
        id,
        name: (t && t.name) || (id ? `Time ${id}` : '—'),
        color: (t && t.color) || '#8b949e',
        numFixos: numFixos || SVC_DIV_DEFAULT,
        // Loot
        lootSomado: 0,           // soma simples de q.loot (== loot que cada recipiente recebeu somado)
        lootTotal: 0,            // sum q.loot * num_recipientes (loot total circulado no time)
        // Service
        svcSomado: 0,            // sum servicePrice
        svcShareTC: 0,           // svcSomado / divisorService
        // Drops vendidos
        soldKK: 0, soldTC: 0, nSold: 0,
        // Shares de drops (somatorio de soldPrice / divisorDrops por drop)
        shareKK: 0, shareTC: 0,
        // Quests
        nQuests: 0,
      };
    }
    return byTeamMap[id];
  }

  // ── Buckets por fixo (caso individual — alimentar aba "Fixos") ────
  const byFixoMap = {};
  function bucketFixo(nome, teamId) {
    const key = `${teamId || ''}/${String(nome || '').toLowerCase()}`;
    if (!byFixoMap[key]) {
      byFixoMap[key] = {
        nome, teamId,
        questsPresente: 0, questsAusente: 0,
        lootKK: 0, svcTC: 0,
        dropKK: 0, dropTC: 0,
        isSuplente: false,  // marcado true se a pessoa apareceu como piloto sem ser fixo
      };
    }
    return byFixoMap[key];
  }

  // ── Globais ───────────────────────────────────────────────────────
  let totalLoot = 0, totalSvcTC = 0, soldKK = 0, soldTC = 0, totalTempo = 0;
  let unmatchedSales = 0, unmatchedKK = 0, unmatchedTC = 0;

  // ── Loop principal das quests ─────────────────────────────────────
  questData.forEach(q => {
    const teamId = q.team || '';
    const team = teamId ? teamById(teamId) : null;
    const teamFixos = teamFixosObjs(team).map(f => f.nome);
    // Passa o team completo pra questDistribution (pra ter acesso a pesos
    // e vagasExtras). Cai no fallback se team não existe.
    const dist = questDistribution(q, team || { fixos: teamFixos });

    if (teamId) {
      const b = bucketTeam(teamId);
      b.nQuests++;
    }

    // Loot
    const lootVal = q.loot ? parseFloat(String(q.loot).replace(',', '.')) : NaN;
    if (!isNaN(lootVal) && lootVal > 0) {
      totalLoot += lootVal;
      if (teamId) {
        const b = bucketTeam(teamId);
        b.lootSomado += lootVal;
        b.lootTotal += lootVal * (dist.recipientesLootSvc.length || 0);
      }
      dist.recipientesLootSvc.forEach(nome => {
        bucketFixo(nome, teamId).lootKK += lootVal;
      });
    }

    // Service
    const svcVal = q.servicePrice ? parseFloat(String(q.servicePrice).replace(',', '.')) : NaN;
    if (!isNaN(svcVal) && svcVal > 0) {
      totalSvcTC += svcVal;
      const sharePerRecipient = dist.divisorService > 0 ? (svcVal / dist.divisorService) : 0;
      if (teamId) {
        const b = bucketTeam(teamId);
        b.svcSomado += svcVal;
        b.svcShareTC += sharePerRecipient;
      }
      dist.recipientesLootSvc.forEach(nome => {
        bucketFixo(nome, teamId).svcTC += sharePerRecipient;
      });
    }

    // Tempo
    const tempoVal = q.tempo ? parseInt(q.tempo) : NaN;
    if (!isNaN(tempoVal)) totalTempo += tempoVal;

    // Quests presentes/ausentes por fixo. Conta TODOS os recipientes
    // (fixos + suplentes/emprestantes) como presentes. Conta os ausentes
    // separadamente. Marca isSuplente quando o piloto não é fixo do time.
    if (teamId) {
      const fixosLowerSet = new Set(teamFixos.map(f => String(f).toLowerCase()));
      // Presentes = todos que apareceram em recipientesLootSvc
      [...new Set(dist.recipientesLootSvc)].forEach(nome => {
        const b = bucketFixo(nome, teamId);
        b.questsPresente++;
        if (!fixosLowerSet.has(String(nome).toLowerCase())) b.isSuplente = true;
      });
      // Ausentes = fixos que faltaram (deduzido pelo dist)
      (dist.ausentes || []).forEach(f => {
        bucketFixo(f, teamId).questsAusente++;
      });
    }

    // Drops vendidos — distribui POR PESO. Recipiente recebe valor*(peso/divisor).
    // Vagas anonimas (parte do divisor) consomem o resto, mas não distribuem
    // pra ninguém.
    (q.drops || []).filter(d => d.soldPrice).forEach(d => {
      const { kk, tc } = parseSold(d.soldPrice);
      soldKK += kk; soldTC += tc;

      const dropTeam = teamId || (getTeam ? getTeam(d.char) : null);
      if (!dropTeam) {
        unmatchedSales++;
        unmatchedKK += kk;
        unmatchedTC += tc;
        return;
      }

      const b = bucketTeam(dropTeam);
      b.soldKK += kk; b.soldTC += tc; b.nSold++;
      const div = dist.divisorDrops || BASE_DIVISOR;
      // shareKK/TC do time = valor unitário por peso 1 (= drop/divisor).
      // Cada fixo com peso N recebe N x esse valor.
      b.shareKK += kk / div;
      b.shareTC += tc / div;
      // Distribui pra cada recipiente segundo seu peso.
      const pesos = dist.dropsPesos || {};
      Object.entries(pesos).forEach(([nome, peso]) => {
        bucketFixo(nome, dropTeam).dropKK += (kk * peso) / div;
        bucketFixo(nome, dropTeam).dropTC += (tc * peso) / div;
      });
    });
  });

  const unmatchedRealVal = _kkToReal(unmatchedKK) + _tcToReal(unmatchedTC);

  // ── Pos-processa byTeam: calcula valores em R$ e medias ───────────
  const byTeam = Object.values(byTeamMap).map(b => {
    const lootSomadoReal = _kkToReal(b.lootSomado);
    const svcShareReal = _tcToReal(b.svcShareTC);
    const shareKKReal = _kkToReal(b.shareKK);
    const shareTCReal = _tcToReal(b.shareTC);
    const totalRealPerFixo = lootSomadoReal + svcShareReal + shareKKReal + shareTCReal;
    return {
      ...b,
      lootSomadoReal, svcShareReal, shareKKReal, shareTCReal,
      totalRealPerFixo,
    };
  });

  // ── Rankings ──────────────────────────────────────────────────────
  const dropsComItem = allDrops.filter(d => d.item);
  const itemRank = aggregateCi(dropsComItem, d => d.item);
  const charRank = aggregateCi(dropsComItem, d => d.char);
  const dropadorRank = aggregateCi(dropsComItem, d => d.dropador);

  // ── Globais agregados ─────────────────────────────────────────────
  const grandTotalReal = byTeam.reduce((s, t) => s + t.totalRealPerFixo, 0);

  // ── Retrocompat: campos antigos tA/tB/tC/uA/uB/uC etc derivados ──
  const tA = byTeamMap['A'];
  const tB = byTeamMap['B'];
  const tC = byTeamMap['C'];
  const z = { soldKK: 0, soldTC: 0, nSold: 0, shareKK: 0, shareTC: 0,
              lootSomado: 0, svcSomado: 0, svcShareTC: 0 };
  const xA = tA || z, xB = tB || z, xC = tC || z;

  return {
    // ── Globais ──
    totalLoot, totalSvcTC, soldKK, soldTC,
    totalQuests: questData.length,
    totalDrops: dropsComItem.length,
    totalSold: allDrops.filter(d => d.soldPrice).length,
    totalTempo,
    itemRank, charRank, dropadorRank,
    unmatchedSales, unmatchedKK, unmatchedTC, unmatchedRealVal,

    // ── Novo: arrays dinamicos ──
    byTeam,
    byFixo: Object.values(byFixoMap),

    // ── Retrocompat campos antigos (zero quando time nao existe) ──
    tAkk: xA.soldKK, tAtc: xA.soldTC, tAn: xA.nSold,
    uAkk: xA.shareKK, uAtc: xA.shareTC,
    tBkk: xB.soldKK, tBtc: xB.soldTC, tBn: xB.nSold,
    uBkk: xB.shareKK, uBtc: xB.shareTC,
    tCkk: xC.soldKK, tCtc: xC.soldTC, tCn: xC.nSold,
    uCkk: xC.shareKK, uCtc: xC.shareTC,
    lootQuestA: xA.lootSomado, lootQuestB: xB.lootSomado, lootQuestC: xC.lootSomado,
    svcQuestA: xA.svcSomado,   svcQuestB: xB.svcSomado,   svcQuestC: xC.svcSomado,
    lootQuestARealVal: _kkToReal(xA.lootSomado),
    lootQuestBRealVal: _kkToReal(xB.lootSomado),
    lootQuestCRealVal: _kkToReal(xC.lootSomado),
    svcQuestARealVal: _tcToReal(xA.svcSomado),
    svcQuestBRealVal: _tcToReal(xB.svcSomado),
    svcQuestCRealVal: _tcToReal(xC.svcSomado),
    svcQuestAShareTC: xA.svcShareTC,
    svcQuestBShareTC: xB.svcShareTC,
    svcQuestCShareTC: xC.svcShareTC,
    svcQuestAShareReal: _tcToReal(xA.svcShareTC),
    svcQuestBShareReal: _tcToReal(xB.svcShareTC),
    svcQuestCShareReal: _tcToReal(xC.svcShareTC),
    unitARealVal: _kkToReal(xA.shareKK) + _tcToReal(xA.shareTC),
    unitBRealVal: _kkToReal(xB.shareKK) + _tcToReal(xB.shareTC),
    unitCRealVal: _kkToReal(xC.shareKK) + _tcToReal(xC.shareTC),
    totalUnitKK: xA.shareKK + xB.shareKK + xC.shareKK,
    totalUnitTC: xA.shareTC + xB.shareTC + xC.shareTC,
    totalUnitReal: byTeam.reduce((s, t) => s + t.shareKKReal + t.shareTCReal, 0),
    totalSvcAll: xA.svcSomado + xB.svcSomado + xC.svcSomado,
    grandTotalReal,
  };
}
