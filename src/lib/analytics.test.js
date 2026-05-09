import { describe, it, expect } from 'vitest';
import {
  parseDate, fromIso, fmtMin, parseSold, saleHint, aggregateCi,
  computeAnalytics, BASE_DIVISOR, isValidSalePrice, questDistribution,
} from './analytics.js';

describe('parseDate', () => {
  it('parses DD/MM/YYYY', () => {
    const d = parseDate('07/05/2026');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-indexed
    expect(d.getDate()).toBe(7);
  });
  it('returns null for empty/invalid', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('abc')).toBeNull();
  });
});

describe('fromIso', () => {
  it('converts YYYY-MM-DD -> DD/MM/YYYY', () => {
    expect(fromIso('2026-05-07')).toBe('07/05/2026');
  });
  it('returns "" for empty', () => {
    expect(fromIso('')).toBe('');
  });
});

describe('fmtMin', () => {
  it('formats minutes', () => {
    expect(fmtMin(0)).toBe('0m');
    expect(fmtMin(30)).toBe('30m');
    expect(fmtMin(60)).toBe('1h');
    expect(fmtMin(90)).toBe('1h30m');
    expect(fmtMin(125)).toBe('2h5m');
  });
  it('handles invalid', () => {
    expect(fmtMin(undefined)).toBe('—');
    expect(fmtMin(null)).toBe('—');
  });
});

describe('parseSold', () => {
  it('reads kk', () => {
    expect(parseSold('100kk')).toEqual({ kk: 100, tc: 0 });
    expect(parseSold('6.5kk')).toEqual({ kk: 6.5, tc: 0 });
  });
  it('reads tc', () => {
    expect(parseSold('250tc')).toEqual({ kk: 0, tc: 250 });
  });
  it('falls back to kk when no unit', () => {
    expect(parseSold('100')).toEqual({ kk: 100, tc: 0 });
  });
  it('handles comma as decimal separator', () => {
    expect(parseSold('6,5kk')).toEqual({ kk: 6.5, tc: 0 });
  });
  it('returns 0/0 for empty/garbage', () => {
    expect(parseSold('')).toEqual({ kk: 0, tc: 0 });
    expect(parseSold('abc')).toEqual({ kk: 0, tc: 0 });
  });
});

describe('saleHint', () => {
  it('errors when no unit (bloqueia salvar)', () => {
    const h = saleHint('100');
    expect(h.error).toBe(true);
    expect(h.text).toMatch(/kk.*tc/i);
  });
  it('shows kk hint', () => {
    expect(saleHint('100kk')).toEqual({ text: '→ 100kk', warn: false });
  });
  it('shows tc hint', () => {
    expect(saleHint('250tc')).toEqual({ text: '→ 250tc', warn: false });
  });
  it('returns null for empty', () => {
    expect(saleHint('')).toBeNull();
    expect(saleHint('   ')).toBeNull();
  });
  it('errors when value not recognized', () => {
    const h = saleHint('abc');
    expect(h.error).toBe(true);
    expect(h.text).toBe('valor não reconhecido');
  });
});

describe('isValidSalePrice', () => {
  it('aceita valores com unidade', () => {
    expect(isValidSalePrice('100kk')).toBe(true);
    expect(isValidSalePrice('250tc')).toBe(true);
  });
  it('rejeita sem unidade', () => {
    expect(isValidSalePrice('100')).toBe(false);
  });
  it('rejeita lixo', () => {
    expect(isValidSalePrice('abc')).toBe(false);
  });
  it('aceita string vazia (deletar venda)', () => {
    expect(isValidSalePrice('')).toBe(true);
    expect(isValidSalePrice('   ')).toBe(true);
  });
});

describe('aggregateCi', () => {
  it('groups case-insensitive and labels with most frequent', () => {
    const rows = [
      { c: 'Maycon' },{ c: 'maycon' },{ c: 'MAYCON' },{ c: 'Jorge' },
    ];
    const out = aggregateCi(rows, r => r.c);
    expect(out).toEqual([
      { name: 'Maycon', count: 3 },
      { name: 'Jorge', count: 1 },
    ]);
  });
  it('ignores empty/null keys', () => {
    expect(aggregateCi([{c:''},{c:null},{c:undefined},{c:'X'}], r=>r.c))
      .toEqual([{ name: 'X', count: 1 }]);
  });
});

describe('computeAnalytics', () => {
  // Setup: 2 quests, 1 com 2 drops vendidos (Time A), outra com 1 drop nao vendido (Time B)
  const quests = [
    {
      id: 'q1', dropDate: '07/05/2026', team: 'A',
      loot: '6', servicePrice: '500', tempo: '60',
      drops: [
        { id: 'd1', item: 'Soulcutter', char: 'Maycon', soldPrice: '100kk' },
        { id: 'd2', item: 'Soulshredder', char: 'maycon', soldPrice: '50kk' },
      ],
    },
    {
      id: 'q2', dropDate: '01/05/2026', team: 'B',
      loot: '4', servicePrice: '250', tempo: '30',
      drops: [
        { id: 'd3', item: 'Soulcutter', char: 'Jorge', soldPrice: '' },
      ],
    },
  ];
  const tcKK = 39, tcReal = 53, tcQty = 250;

  it('counts quests/drops/sold', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    expect(a.totalQuests).toBe(2);
    expect(a.totalDrops).toBe(3);
    expect(a.totalSold).toBe(2);
  });

  it('sums loot per quest, not per drop', () => {
    // q1 tem loot=6 e 2 drops; q2 tem loot=4 e 1 drop. Total deve ser 10, NAO 16.
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    expect(a.totalLoot).toBe(10);
  });

  it('sums service per team', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    expect(a.svcQuestA).toBe(500);
    expect(a.svcQuestB).toBe(250);
    expect(a.totalSvcTC).toBe(750);
  });

  it('sums sold KK by team and computes unit per fixo (÷7)', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    expect(a.tAkk).toBe(150); // 100 + 50
    expect(a.tAn).toBe(2);
    expect(a.uAkk).toBeCloseTo(150 / BASE_DIVISOR, 5);
  });

  it('item rank groups Soulcutter even across teams', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    const sc = a.itemRank.find(r => r.name === 'Soulcutter');
    expect(sc.count).toBe(2);
  });

  it('char rank merges Maycon/maycon (case-insensitive)', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    const m = a.charRank.find(r => r.name.toLowerCase() === 'maycon');
    expect(m.count).toBe(2);
  });

  it('aMonth filters quests by month', () => {
    const aMay = computeAnalytics({ quests, aMonth: '2026-05', tcKK, tcReal, tcQty });
    expect(aMay.totalQuests).toBe(2);
    const aApr = computeAnalytics({ quests, aMonth: '2026-04', tcKK, tcReal, tcQty });
    expect(aApr.totalQuests).toBe(0);
  });

  it('totalTempo sums quest tempo (not per drop)', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    expect(a.totalTempo).toBe(90); // 60 + 30
  });

  it('grand total in R$ combines unit + loot + service share', () => {
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty });
    // Sanity check: deve ser positivo, finito, e maior que so unit alone
    expect(a.grandTotalReal).toBeGreaterThan(a.totalUnitReal);
    expect(Number.isFinite(a.grandTotalReal)).toBe(true);
  });

  it('reporta vendas sem time identificado em vez de ignorar', () => {
    // Drop com soldPrice mas sem team na quest e sem char em getTeam
    const orphans = [{
      id: 'q3', dropDate: '07/05/2026', team: '',
      drops: [{ id: 'd9', item: 'Soulcutter', char: 'Desconhecido', soldPrice: '50kk' }],
    }];
    const a = computeAnalytics({
      quests: orphans, aMonth: '', tcKK, tcReal, tcQty,
      getTeam: () => null,
    });
    expect(a.unmatchedSales).toBe(1);
    expect(a.unmatchedKK).toBe(50);
    expect(a.tAkk).toBe(0); // nao foi pra time A
    expect(a.unmatchedRealVal).toBeGreaterThan(0);
  });

  it('rankings ignoram drops sem item (quests fantasmas)', () => {
    const withGhost = [{
      id: 'qg', dropDate: '07/05/2026', team: 'A',
      drops: [
        { id: 'da', item: 'Soulcutter', char: 'Maycon', dropador: 'Du' },
        { id: 'db', item: '', char: 'Bertolasz', dropador: 'Bertolasz' }, // fantasma
      ],
    }];
    const a = computeAnalytics({ quests: withGhost, aMonth: '', tcKK, tcReal, tcQty });
    expect(a.charRank.find(r => r.name === 'Bertolasz')).toBeUndefined();
    expect(a.charRank.find(r => r.name === 'Maycon').count).toBe(1);
  });
});

describe('questDistribution', () => {
  const fixosA = ['Maycon', 'Jorge', 'Du', 'Jão', 'Mario'];

  it('quest legacy (sem dados de presença) retorna BASE_DIVISOR=7 nos drops', () => {
    const q = { team: 'A', loot: '5.8', servicePrice: '1250' };
    const d = questDistribution(q, fixosA);
    expect(d.isLegacy).toBe(true);
    expect(d.divisorDrops).toBe(BASE_DIVISOR);
    expect(d.recipientesLootSvc).toEqual(fixosA);
  });

  it('quest com 1 ausente sem suplente: divisor de drops = 4 presentes', () => {
    const q = {
      team: 'A',
      ausentes: ['Maycon'],
      suplentes: [],
      bonecosPilotados: [],
    };
    const d = questDistribution(q, fixosA);
    expect(d.isLegacy).toBe(false);
    expect(d.recipientesLootSvc).toEqual(['Jorge', 'Du', 'Jão', 'Mario']);
    expect(d.divisorDrops).toBe(4); // 4 presentes
  });

  it('quest com 1 ausente coberto por suplente: divisor = 5', () => {
    const q = {
      team: 'A',
      ausentes: ['Maycon'],
      suplentes: [{ nome: 'Suplente1', lugarDe: 'Maycon' }],
    };
    const d = questDistribution(q, fixosA);
    expect(d.recipientesLootSvc).toContain('Suplente1');
    expect(d.recipientesLootSvc).not.toContain('Maycon');
    expect(d.divisorDrops).toBe(5); // 4 fixos + 1 suplente
  });

  it('caso especial divisor 8: fixo ausente mas boneco pilotado por outro', () => {
    const q = {
      team: 'A',
      ausentes: ['Maycon'],
      suplentes: [
        { nome: 'Suplente1', lugarDe: 'Maycon' },  // substitui Maycon
        { nome: 'Suplente2', lugarDe: '' },        // vaga extra
        { nome: 'Suplente3', lugarDe: '' },        // vaga extra
      ],
      bonecosPilotados: [
        { char: 'Conopcas', dono: 'Maycon', piloto: 'Suplente1' }, // dono ausente, piloto outro
      ],
    };
    const d = questDistribution(q, fixosA);
    // recipientesLootSvc = 4 fixos presentes + 1 suplente substituto = 5
    expect(d.recipientesLootSvc.length).toBe(5);
    // recipientesDrops = 5 + 2 suplentes extras + 1 dono ausente com boneco = 8
    expect(d.divisorDrops).toBe(8);
    expect(d.recipientesDrops).toContain('Maycon'); // recebe drop mesmo ausente
  });

  it('Maycon ausente recebe DROP mas NÃO recebe loot/service', () => {
    const q = {
      team: 'A',
      ausentes: ['Maycon'],
      bonecosPilotados: [
        { char: 'Conopcas', dono: 'Maycon', piloto: 'Du' },
      ],
    };
    const d = questDistribution(q, fixosA);
    expect(d.recipientesLootSvc).not.toContain('Maycon');
    expect(d.recipientesDrops).toContain('Maycon');
  });

  it('boneco pilotado pelo proprio dono (presente) NÃO ativa divisor extra', () => {
    const q = {
      team: 'A',
      ausentes: [],
      bonecosPilotados: [
        { char: 'Conopcas', dono: 'Maycon', piloto: 'Maycon' }, // dono = piloto
      ],
    };
    const d = questDistribution(q, fixosA);
    expect(d.ausentesComBonecoPilotado.length).toBe(0);
  });
});

describe('computeAnalytics com presença/ausência', () => {
  const teams = [
    { id: 'A', name: 'Time A', color: '#58a6ff',
      fixos: ['Maycon', 'Jorge', 'Du', 'Jão', 'Mario'],
      bonecos: [{ char: 'Conopcas', dono: 'Maycon' }] },
  ];
  const tcKK = 39, tcReal = 53, tcQty = 250;

  it('Maycon ausente: NÃO aparece como presente em loot e service', () => {
    const quests = [{
      id: 'q1', dropDate: '07/05/2026', team: 'A',
      loot: '5.8', servicePrice: '1250',
      ausentes: ['Maycon'],
      suplentes: [],
      bonecosPilotados: [],
    }];
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty, teams });
    const maycon = a.byFixo.find(f => f.nome === 'Maycon');
    const jorge = a.byFixo.find(f => f.nome === 'Jorge');
    expect(maycon.lootKK).toBe(0); // não recebeu
    expect(jorge.lootKK).toBe(5.8); // recebeu
    expect(maycon.questsAusente).toBe(1);
    expect(jorge.questsPresente).toBe(1);
  });

  it('drop com divisor 8: cada share = soldKK/8, 8 recipientes', () => {
    const quests = [{
      id: 'q1', dropDate: '07/05/2026', team: 'A',
      ausentes: ['Maycon'],
      suplentes: [
        { nome: 'S1', lugarDe: 'Maycon' },
        { nome: 'S2', lugarDe: '' },
        { nome: 'S3', lugarDe: '' },
      ],
      bonecosPilotados: [
        { char: 'Conopcas', dono: 'Maycon', piloto: 'S1' },
      ],
      drops: [{ id: 'd1', item: 'Soulcutter', char: 'X', soldPrice: '80kk' }],
    }];
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty, teams });
    const maycon = a.byFixo.find(f => f.nome === 'Maycon');
    const jorge = a.byFixo.find(f => f.nome === 'Jorge');
    const s2 = a.byFixo.find(f => f.nome === 'S2');
    expect(maycon.dropKK).toBeCloseTo(80 / 8, 5); // recebe share mesmo ausente
    expect(jorge.dropKK).toBeCloseTo(80 / 8, 5);
    expect(s2.dropKK).toBeCloseTo(80 / 8, 5);
    // Maycon não recebe loot/service mas recebe drop
    expect(maycon.lootKK).toBe(0);
    expect(maycon.svcTC).toBe(0);
  });

  it('quest legacy (sem dados): mantem comportamento de divisor=7', () => {
    const quests = [{
      id: 'q1', dropDate: '07/05/2026', team: 'A',
      loot: '5', servicePrice: '500',
      drops: [{ id: 'd1', item: 'Soulcutter', char: 'Maycon', soldPrice: '70kk' }],
    }];
    const a = computeAnalytics({ quests, aMonth: '', tcKK, tcReal, tcQty, teams });
    // shareKK por fixo = 70/7 = 10
    expect(a.byTeam[0].shareKK).toBeCloseTo(70 / 7, 5);
    // Loot por fixo = 5 pra cada um dos 5 fixos
    expect(a.byFixo.find(f => f.nome === 'Maycon').lootKK).toBe(5);
    expect(a.byFixo.length).toBe(5); // 5 fixos
  });
});
