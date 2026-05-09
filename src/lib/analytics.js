// Helpers de parsing/formatacao + calculo de analytics da Soulwar.
// Extraidos do App.jsx pra serem testaveis isoladamente.

export const BASE_DIVISOR = 7;
const SVC_DIV = 5; // service e dividido por 5 antes de virar share por fixo

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
 * Calcula todos os agregados que a aba Analise mostra.
 *
 * @param {object} args
 *   - quests: array de quests sorted (opcional aMonth filter aplicado fora ou aqui)
 *   - aMonth: "YYYY-MM" pra filtrar por mes, ou "" pra todos
 *   - tcKK: cotacao 1tc -> KK (numero, ex 39)
 *   - tcReal: cotacao tcQty TC -> R$ (numero, ex 53)
 *   - tcQty: quantidade TC do par (ex 250)
 *   - getTeam: (charName) -> 'A'|'B'|'C'|null  (fallback caso quest.team vazio)
 */
export function computeAnalytics({ quests, aMonth, tcKK, tcReal, tcQty, getTeam }) {
  const _kkToReal = kk => { const tcFromKK = (kk * 1000) / tcKK; return (tcFromKK / tcQty) * tcReal; };
  const _tcToReal = tc => (tc / tcQty) * tcReal;

  let questData = quests;
  if (aMonth) {
    questData = questData.filter(q => {
      const dt = parseDate(q.dropDate); if (!dt) return false;
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` === aMonth;
    });
  }

  const allDrops = questData.flatMap(q => (q.drops || []).map(d => ({
    ...d, questTeam: q.team, questDate: q.dropDate,
  })));

  let totalLoot = 0, totalSvcTC = 0, soldKK = 0, soldTC = 0, totalTempo = 0;
  let lootQuestA = 0, lootQuestB = 0, lootQuestC = 0;
  let svcQuestA = 0, svcQuestB = 0, svcQuestC = 0;

  questData.forEach(q => {
    if (q.loot) {
      const v = parseFloat(String(q.loot).replace(',', '.'));
      if (!isNaN(v)) {
        totalLoot += v;
        if (q.team === 'A') lootQuestA += v;
        else if (q.team === 'B') lootQuestB += v;
        else if (q.team === 'C') lootQuestC += v;
      }
    }
    if (q.servicePrice) {
      const v = parseFloat(String(q.servicePrice).replace(',', '.'));
      if (!isNaN(v)) {
        totalSvcTC += v;
        if (q.team === 'A') svcQuestA += v;
        else if (q.team === 'B') svcQuestB += v;
        else if (q.team === 'C') svcQuestC += v;
      }
    }
    if (q.tempo) {
      const v = parseInt(q.tempo);
      if (!isNaN(v)) totalTempo += v;
    }
  });

  const soldData = allDrops.filter(d => d.soldPrice);
  soldData.forEach(d => { const { kk, tc } = parseSold(d.soldPrice); soldKK += kk; soldTC += tc; });

  // Rankings consideram so drops com item — quests "fantasmas" (sem drop,
  // so com pagante/service) nao contam pra "quem mais dropou".
  const dropsComItem = allDrops.filter(d => d.item);
  const itemRank = aggregateCi(dropsComItem, d => d.item);
  const charRank = aggregateCi(dropsComItem, d => d.char);
  const dropadorRank = aggregateCi(dropsComItem, d => d.dropador);

  let tAkk = 0, tAtc = 0, tAn = 0, uAkk = 0, uAtc = 0;
  let tBkk = 0, tBtc = 0, tBn = 0, uBkk = 0, uBtc = 0;
  let tCkk = 0, tCtc = 0, tCn = 0, uCkk = 0, uCtc = 0;
  // Vendas que nao caem em nenhum time (chair sem questTeam e sem match
  // em teamA/B/C). Hoje somem do calculo unitario — vamos avisar visualmente.
  let unmatchedSales = 0, unmatchedKK = 0, unmatchedTC = 0;

  soldData.forEach(d => {
    const team = d.questTeam || (getTeam ? getTeam(d.char) : null);
    const { kk, tc } = parseSold(d.soldPrice);
    if (!team) {
      unmatchedSales++;
      unmatchedKK += kk;
      unmatchedTC += tc;
      return;
    }
    const div = BASE_DIVISOR;

    if (team === 'A') { tAkk += kk; tAtc += tc; tAn++; uAkk += kk / div; uAtc += tc / div; }
    else if (team === 'B') { tBkk += kk; tBtc += tc; tBn++; uBkk += kk / div; uBtc += tc / div; }
    else if (team === 'C') { tCkk += kk; tCtc += tc; tCn++; uCkk += kk / div; uCtc += tc / div; }
  });
  const unmatchedRealVal = _kkToReal(unmatchedKK) + _tcToReal(unmatchedTC);

  const totalUnitKK = uAkk + uBkk + uCkk;
  const totalUnitTC = uAtc + uBtc + uCtc;
  const unitARealVal = _kkToReal(uAkk) + _tcToReal(uAtc);
  const unitBRealVal = _kkToReal(uBkk) + _tcToReal(uBtc);
  const unitCRealVal = _kkToReal(uCkk) + _tcToReal(uCtc);
  const totalUnitReal = unitARealVal + unitBRealVal + unitCRealVal;

  const lootQuestARealVal = _kkToReal(lootQuestA);
  const lootQuestBRealVal = _kkToReal(lootQuestB);
  const lootQuestCRealVal = _kkToReal(lootQuestC);
  const svcQuestARealVal = _tcToReal(svcQuestA);
  const svcQuestBRealVal = _tcToReal(svcQuestB);
  const svcQuestCRealVal = _tcToReal(svcQuestC);

  const svcQuestAShareTC = svcQuestA / SVC_DIV;
  const svcQuestBShareTC = svcQuestB / SVC_DIV;
  const svcQuestCShareTC = svcQuestC / SVC_DIV;
  const svcQuestAShareReal = _tcToReal(svcQuestAShareTC);
  const svcQuestBShareReal = _tcToReal(svcQuestBShareTC);
  const svcQuestCShareReal = _tcToReal(svcQuestCShareTC);

  const totalSvcAll = svcQuestA + svcQuestB + svcQuestC;
  const grandTotalReal = totalUnitReal
    + lootQuestARealVal + lootQuestBRealVal + lootQuestCRealVal
    + svcQuestAShareReal + svcQuestBShareReal + svcQuestCShareReal;

  const totalDropsItems = allDrops.filter(d => d.item).length;

  return {
    totalLoot, totalSvcTC, soldKK, soldTC, itemRank, charRank, dropadorRank,
    totalQuests: questData.length, totalDrops: totalDropsItems, totalSold: soldData.length, totalTempo,
    tAkk, tAtc, tAn, uAkk, uAtc, tBkk, tBtc, tBn, uBkk, uBtc, tCkk, tCtc, tCn, uCkk, uCtc,
    totalUnitKK, totalUnitTC, totalUnitReal, unitARealVal, unitBRealVal, unitCRealVal,
    lootQuestA, lootQuestB, lootQuestC, svcQuestA, svcQuestB, svcQuestC,
    lootQuestARealVal, lootQuestBRealVal, lootQuestCRealVal,
    svcQuestARealVal, svcQuestBRealVal, svcQuestCRealVal,
    svcQuestAShareTC, svcQuestBShareTC, svcQuestCShareTC,
    svcQuestAShareReal, svcQuestBShareReal, svcQuestCShareReal,
    totalSvcAll, grandTotalReal,
    unmatchedSales, unmatchedKK, unmatchedTC, unmatchedRealVal,
  };
}
