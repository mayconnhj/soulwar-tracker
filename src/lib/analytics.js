// Helpers de parsing/formatacao + calculo de analytics da Soulwar.
// Extraidos do App.jsx pra serem testaveis isoladamente.

export const BASE_DIVISOR = 7;       // divisor de drops para quests sem dados de presenca (legacy)
const SVC_DIV_DEFAULT = 5;            // divisor padrao do service quando o time nao tem fixos definidos

export function parseDate(d) {
  if (!d) return null;
  const [dd, mm, yy] = String(d).split('/');
  if (!dd || !mm || !yy) return null;
  return new Date(Number(yy), Number(mm) - 1, Number(dd));
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
 * Distribui uma quest entre seus recipientes:
 *  - recipientesLootSvc: quem recebe loot e service (fixos presentes +
 *    suplentes que substituem fixos ausentes).
 *  - recipientesDrops: quem recebe share dos drops (recipientes loot/svc
 *    + suplentes em vagas extras + donos ausentes cujo boneco rolou).
 *  - divisorDrops: tamanho de recipientesDrops.
 *  - divisorService: numero de fixos do time (regra do user: service / 5
 *    sempre, mesmo com presenca menor).
 *
 * Detecta quest LEGADA (sem dados de presenca) e usa fallback compativel
 * com o calculo antigo: BASE_DIVISOR=7 nos drops, todos os fixos do time
 * recebem loot/service.
 */
export function questDistribution(q, teamFixos) {
  const fixos = Array.isArray(teamFixos) ? teamFixos : [];
  const ausentesSet = new Set(q.ausentes || []);
  const sups = (q.suplentes || []).filter(s => s.nome);
  const bonecosPil = q.bonecosPilotados || [];

  const isLegacy = ausentesSet.size === 0 && sups.length === 0 && bonecosPil.length === 0;

  if (isLegacy) {
    return {
      isLegacy: true,
      recipientesLootSvc: [...fixos],
      recipientesDrops: [...fixos],
      divisorDrops: BASE_DIVISOR,
      divisorService: fixos.length || SVC_DIV_DEFAULT,
      ausentesComBonecoPilotado: [],
    };
  }

  const presentesFixos = fixos.filter(f => !ausentesSet.has(f));
  const supsSubstituindo = sups.filter(s => s.lugarDe);  // s.lugarDe = nome de fixo
  const supsExtras = sups.filter(s => !s.lugarDe);

  const recipientesLootSvc = [
    ...presentesFixos,
    ...supsSubstituindo.map(s => s.nome),
  ];

  // Donos que estao em ausentes E tiveram seu boneco pilotado por outro.
  const donosAusenteComBoneco = [...new Set(
    bonecosPil
      .filter(b => b.dono && ausentesSet.has(b.dono) && b.piloto && b.piloto !== b.dono)
      .map(b => b.dono)
  )];

  const recipientesDrops = [
    ...recipientesLootSvc,
    ...supsExtras.map(s => s.nome),
    ...donosAusenteComBoneco,
  ];

  return {
    isLegacy: false,
    recipientesLootSvc,
    recipientesDrops,
    divisorDrops: recipientesDrops.length,
    divisorService: fixos.length || SVC_DIV_DEFAULT,
    ausentesComBonecoPilotado: donosAusenteComBoneco,
  };
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
  if (aMonth) {
    questData = questData.filter(q => {
      const dt = parseDate(q.dropDate); if (!dt) return false;
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` === aMonth;
    });
  }

  const allDrops = questData.flatMap(q => (q.drops || []).map(d => ({
    ...d, questTeam: q.team, questDate: q.dropDate,
  })));

  // ── Buckets por time ──────────────────────────────────────────────
  const byTeamMap = {};
  function bucketTeam(id) {
    if (!byTeamMap[id]) {
      const t = teamById(id);
      byTeamMap[id] = {
        id,
        name: (t && t.name) || (id ? `Time ${id}` : '—'),
        color: (t && t.color) || '#8b949e',
        numFixos: (t && t.fixos && t.fixos.length) || SVC_DIV_DEFAULT,
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
    const teamFixos = (team && team.fixos) || [];
    const dist = questDistribution(q, teamFixos);

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

    // Quests presentes/ausentes por fixo
    if (teamFixos.length) {
      const ausentesSet = new Set(q.ausentes || []);
      teamFixos.forEach(f => {
        if (ausentesSet.has(f)) bucketFixo(f, teamId).questsAusente++;
        else bucketFixo(f, teamId).questsPresente++;
      });
    }

    // Drops vendidos
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
      const sKK = kk / div, sTC = tc / div;
      b.shareKK += sKK; b.shareTC += sTC;

      dist.recipientesDrops.forEach(nome => {
        bucketFixo(nome, dropTeam).dropKK += sKK;
        bucketFixo(nome, dropTeam).dropTC += sTC;
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
