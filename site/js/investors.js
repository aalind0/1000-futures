// "Who funds this": rank real investors for an idea from sourced rounds (bundle.deals).
// Every investor shown is backed by at least one round in the same vertical; the score only orders them.
import { STAGES, START_YEAR } from './engine.js';
import { V } from './taxonomy.js';

export const TYPE_LABEL = {
  vc: 'VC', cvc: 'Corporate', growth: 'Growth fund', sov: 'Sovereign fund', acc: 'Accelerator', angel: 'Angel / family office', pe: 'Private equity',
};

// how much a round counts, by how recent it is: founders need investors who are writing checks now
export function recencyWeight(y, now = START_YEAR) {
  if (!y) return 0.3;
  const a = now - y;
  return a <= 1 ? 1 : a === 2 ? 0.85 : a === 3 ? 0.7 : a <= 5 ? 0.5 : a <= 8 ? 0.3 : 0.15;
}

// the round you're raising next counts most, the one you just closed nearly as much
export function stageWeight(dealStage, profileStage) {
  const di = STAGES.indexOf(dealStage), si = STAGES.indexOf(profileStage);
  if (di < 0 || si < 0) return 0.3;
  const next = Math.min(si + 1, STAGES.length - 1);
  if (di === next) return 1;
  if (di === si) return 0.85;
  const dist = Math.min(Math.abs(di - si), Math.abs(di - next));
  return dist === 1 ? 0.45 : dist === 2 ? 0.2 : 0.08;
}

// Resolve each deal's space: a deal for a company we know takes that company's label (the matcher's),
// otherwise the research label, if it's a real taxonomy id.
export function resolveDeals(bundle) {
  const byId = new Map(bundle.companies.map((c) => [c.id, c]));
  return (bundle.deals || []).map((d) => {
    const co = d.co ? byId.get(d.co) : null;
    let v = co && co.v ? co.v : d.v, sv = co && co.v ? co.sv : d.sv;
    if (!V[v]) { v = null; sv = null; } else if (sv && !V[v].subs.some((s) => s.id === sv)) sv = null;
    return { ...d, v, sv, L: d.L || [], I: d.I || [], company: co };
  });
}

/**
 * @param deals    resolveDeals(bundle)
 * @param ctx      { v, sv, related: [vertical ids], comps: Set(company ids), stage, region, mode: 'fit'|'all', onlyRegion: bool }
 */
export function fundersFor(deals, investors, ctx) {
  const { v, sv, related = [], comps = new Set(), stage, region, mode = 'fit', onlyRegion = false } = ctx;
  if (!v) return { list: [], coverage: { niche: 0, vertical: 0, investors: 0 }, scope: 'none' };
  const inNiche = (d) => d.v === v && sv && d.sv === sv;
  const nicheDeals = deals.filter(inNiche);
  const vertDeals = deals.filter((d) => d.v === v);
  const scope = nicheDeals.length >= 5 ? 'niche' : 'vertical';
  const by = new Map();
  for (const d of deals) {
    const comp = d.co && comps.has(d.co);
    let w = comp ? 1.25 : inNiche(d) ? 1 : d.v === v ? (scope === 'niche' ? 0.25 : 0.45) : related.includes(d.v) ? 0.05 : 0;
    if (!w) continue;
    w *= recencyWeight(d.y);
    if (mode === 'fit') w *= stageWeight(d.st, stage);
    if (region && d.r === region) w *= 1.3;
    for (const [ids, role] of [[d.L, 'led'], [d.I, 'joined']]) {
      for (const id of ids) {
        let x = by.get(id);
        if (!x) by.set(id, (x = { id, n: (investors[id] || {}).n || id, t: (investors[id] || {}).t, score: 0, deals: [], niche: 0, nicheLed: 0, vertical: 0, led: 0, comps: [], regions: new Set(), stages: new Set(), last: 0 }));
        const dw = w * (role === 'led' ? 1 : 0.5);
        x.score += dw;
        if (d.v !== v) continue; // related-vertical rounds only nudge the order; they're never shown as proof
        x.deals.push({ d, role, w: dw });
        x.vertical += 1;
        if (inNiche(d)) { x.niche += 1; if (role === 'led') x.nicheLed += 1; }
        if (role === 'led') x.led += 1;
        if (comp && !x.comps.includes(d.n)) x.comps.push(d.n);
        if (d.r) x.regions.add(d.r);
        x.stages.add(d.st);
        if (d.y && d.y > x.last) x.last = d.y;
      }
    }
  }
  let list = [...by.values()].filter((x) => x.vertical > 0);
  if (onlyRegion && region) list = list.filter((x) => x.regions.has(region));
  for (const x of list) x.deals.sort((a, b) => b.w - a.w || (b.d.y || 0) - (a.d.y || 0));
  list.sort((a, b) => b.score - a.score || b.vertical - a.vertical || a.n.localeCompare(b.n));
  const years = vertDeals.map((d) => d.y).filter(Boolean);
  return {
    list, scope,
    coverage: {
      niche: nicheDeals.length, vertical: vertDeals.length, investors: list.length,
      from: years.length ? Math.min(...years) : null, to: years.length ? Math.max(...years) : null,
      recent: vertDeals.filter((d) => d.y && d.y >= START_YEAR - 3).length,
    },
  };
}

// one plain sentence on why this investor is on the list, from the rounds alone
export function whyLine(x, ctx, labels) {
  if (x.comps.length) {
    const names = x.comps.slice(0, 2).join(' and ');
    return `Backed ${names}, ${x.comps.length === 1 ? 'one of your closest comparables' : 'two of your closest comparables'}. They know the space; ask early about conflicts.`;
  }
  const niche = x.niche > 0;
  const n = niche ? x.niche : x.vertical, led = niche ? x.nicheLed : x.led, joined = n - led;
  const where = (niche ? labels.niche : labels.vertical).split(' › ').pop();
  const rounds = (k) => `${k} round${k === 1 ? '' : 's'}`;
  const did = led && joined ? `Led ${led} and joined ${rounds(joined)}` : led ? `Led ${rounds(led)}` : `Joined ${rounds(joined)}`;
  const pool = x.deals.filter(({ d }) => !niche || (d.v === ctx.v && d.sv === ctx.sv)).sort((a, b) => (b.d.y || 0) - (a.d.y || 0));
  const last = pool[0] && pool[0].d.y ? `, most recently ${pool[0].d.n.replace(/\s*\(.*\)/, '')} in ${pool[0].d.y}` : '';
  return `${did} in ${where}${last}.`;
}

const csvCell = (s) => {
  const t = String(s === null || s === undefined ? '' : s);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export function fundersCSV(list, ctx, stageLabel, money, repeatIds = new Set()) {
  const head = ['Rank', 'Investor', 'Backer', 'Type', 'Rounds in your niche', `Rounds in ${ctx.verticalLabel}`, 'Led', 'Stages', 'Most recent', 'Rounds (company · stage · year · amount · role)', 'Sources'];
  const rows = list.map((x, i) => [
    i + 1, x.n, repeatIds.has(x.id) ? 'repeat backer' : 'single bet or other stage', TYPE_LABEL[x.t] || '', x.niche, x.vertical, x.led,
    STAGES.filter((s) => x.stages.has(s)).map((s) => stageLabel[s]).join(' / '), x.last || '',
    x.deals.map(({ d, role }) => `${d.n} · ${stageLabel[d.st]} · ${d.y || '?'} · ${d.amt ? money(d.amt) : '?'} · ${role}`).join('; '),
    [...new Set(x.deals.map(({ d }) => d.src || (d.company && d.company.src && d.company.src[0]) || '').filter(Boolean))].join(' '),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}
