// Turning 1,000 simulated lives into things a founder can use: take-home pay, what the winners became,
// the pace they kept, "where are you now?", and the two shareable lives (obituary + best life).

import { STAGES, HORIZON, START_YEAR } from './engine.js';
import { hashString } from './rng.js';

const median = (arr) => {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const medianInt = (arr) => { const m = median(arr); return m == null ? null : Math.round(m); };
const yearAt = (t) => START_YEAR + t / 12;
export const yearOf = (t) => START_YEAR + Math.floor(t / 12);

// ---------------- take-home ----------------
export const PAYOUT_BUCKETS = [
  { id: 'zero', label: 'Nothing', max: 1e4 },
  { id: 'lt1m', label: 'Under $1M', max: 1e6 },
  { id: '1to10', label: '$1M–10M', max: 1e7 },
  { id: '10to100', label: '$10M–100M', max: 1e8 },
  { id: '100plus', label: '$100M+', max: Infinity },
];

export function payoutStats(universes, nFounders = 2, salary = 150000) {
  const n = universes.length;
  const per = universes.map((u) => ({ u, cash: u.teamCash / nFounders, paper: u.teamPaper / nFounders }));
  const value = (x) => x.cash + x.paper;
  const buckets = PAYOUT_BUCKETS.map((b) => ({ ...b, cash: 0, paper: 0 }));
  for (const x of per) {
    const v = value(x);
    const b = buckets.find((bb) => v < bb.max);
    if (x.paper > 0 && x.cash === 0) b.paper++; else b.cash++;
  }
  const cashes = per.map((x) => x.cash);
  const ten = salary * 10;
  const sales = per.filter((x) => x.u.outcome === 'acquired' || x.u.outcome === 'acquihire');
  // the starkest "sold, but the founders got (almost) nothing" universe
  const trapped = sales.filter((x) => x.u.exitValue > 0 && x.cash * nFounders < 0.1 * x.u.exitValue)
    .sort((a, b) => b.u.exitValue - a.u.exitValue);
  const best = per.slice().sort((a, b) => value(b) - value(a))[0];
  return {
    n, nFounders, salary,
    buckets,
    zero: per.filter((x) => value(x) < 1e4).length,
    median: median(per.map(value)),
    ev: cashes.reduce((a, b) => a + b, 0) / n,
    over1m: per.filter((x) => x.cash >= 1e6).length,
    over10m: per.filter((x) => x.cash >= 1e7).length,
    over100m: per.filter((x) => x.cash >= 1e8).length,
    beatJob: per.filter((x) => x.cash >= ten).length,
    jobTotal: ten,
    sales: sales.length,
    trappedCount: trapped.length,
    trap: trapped[0] || null,
    best,
    ownership: ownershipPath(universes),
  };
}

// median founder ownership right after each round (only universes that raised it)
export function ownershipPath(universes) {
  const at = {};
  for (const u of universes) for (const e of u.events) {
    if ((e.type === 'start' || e.type === 'raise') && e.founderPct != null) (at[e.stage] = at[e.stage] || []).push(e.founderPct);
  }
  return STAGES.filter((s) => at[s] && at[s].length >= 5).map((s) => ({ stage: s, pct: median(at[s]), n: at[s].length }));
}

// ---------------- what it became ----------------
function unicornTime(u) {
  for (const e of u.events) {
    if ((e.post || 0) >= 1e9 || ((e.type === 'ipo' || e.type === 'acquired') && e.value >= 1e9)) return e.t;
  }
  return null;
}

export function winnersReport(universes, winter) {
  const W = universes.filter((u) => u.everUnicorn);
  const endings = { ipo: 0, bigSale: 0, private: 0, fell: 0, sold: 0 };
  for (const u of W) {
    if (u.outcome === 'ipo') endings.ipo++;
    else if (u.outcome === 'acquired' || u.outcome === 'acquihire') (u.exitValue >= 1e9 ? endings.bigSale++ : endings.sold++);
    else if (u.outcome === 'dead') endings.fell++;
    else endings.private++;
  }
  const times = W.map(unicornTime).filter((t) => t != null);
  const fastest = W.map((u) => ({ u, t: unicornTime(u) })).filter((x) => x.t != null).sort((a, b) => a.t - b.t)[0] || null;
  const raisedAtUni = W.map((u) => {
    const t = unicornTime(u);
    let r = u.events[0].raised || 0;
    for (const e of u.events) if (e.t <= t && e.raised) r = e.raised;
    return r;
  });
  // pace: when (and at what valuation) winners vs everyone raised each round
  const pace = [];
  for (const s of STAGES) {
    const w = [], all = [];
    for (const u of universes) for (const e of u.events) {
      if (e.type === 'raise' && e.stage === s) { all.push(e); if (u.everUnicorn) w.push(e); }
    }
    if (all.length >= 5) {
      pace.push({
        stage: s, winners: w.length, all: all.length,
        wYear: w.length >= 2 ? median(w.map((e) => yearAt(e.t))) : null, aYear: median(all.map((e) => yearAt(e.t))),
        wPost: w.length >= 2 ? median(w.map((e) => e.post)) : null, aPost: median(all.map((e) => e.post)),
      });
    }
  }
  let winterNote = null;
  if (winter && W.length) {
    const through = W.filter((u) => u.events[0].t <= winter.start && (u.endT >= winter.start + winter.len)).length;
    winterNote = { through, total: W.length, start: yearOf(winter.start), end: yearOf(winter.start + winter.len) };
  }
  return {
    count: W.length, endings, fastest, typicalYears: times.length ? median(times) / 12 : null,
    raisedAtUnicorn: median(raisedAtUni), pace, winterNote,
    nearDeath: W.filter((u) => u.nearDeath).length,
    closest: W.length ? null : universes.slice().sort((a, b) => b.peak - a.peak)[0],
  };
}

// "Where are you now?" — condition the multiverse on what you've actually reached
export function stateAt(u, t) {
  let stage = u.events[0].stage, post = u.events[0].post, ended = null;
  for (const e of u.events) {
    if (e.t > t) break;
    if (e.type === 'raise') { stage = e.stage; post = e.post; }
    if (e.type === 'dead' || e.type === 'acquired' || e.type === 'acquihire' || e.type === 'ipo') ended = e.type;
  }
  return { stage, post, ended };
}

export function whereNow(universes, stage, year, minPost, nFounders = 2) {
  const t = Math.max(0, Math.min(HORIZON, (year - START_YEAR) * 12 + 6));
  const si = STAGES.indexOf(stage);
  const like = universes.filter((u) => {
    const st = stateAt(u, t);
    return !st.ended && STAGES.indexOf(st.stage) >= si && st.post >= (minPost || 0);
  });
  const all = universes.filter((u) => !stateAt(u, t).ended);
  return {
    n: like.length, alive: all.length,
    unicorn: like.filter((u) => u.everUnicorn).length,
    dead: like.filter((u) => u.outcome === 'dead').length,
    medianCash: median(like.map((u) => u.teamCash / nFounders)),
    p10m: like.filter((u) => u.teamCash / nFounders >= 1e7).length,
    baseUnicorn: universes.filter((u) => u.everUnicorn).length / universes.length,
  };
}

// ---------------- what version of this idea wins ----------------
// Real companies only. A "win" is an IPO, a $1B+ private valuation, or a sale for at least what was raised.
export function fate(c) {
  if (c.out === 'ipo') return 'won';
  // a $1B valuation on a company founded in the last five years is a bet still in play, not a proven win
  if (c.out === 'private_unicorn') return (c.f || 0) >= START_YEAR - 5 ? 'open' : 'won';
  if (c.out === 'acquired') return !c.raised || !c.exitV || c.exitV >= c.raised ? 'won' : 'open';
  if (c.out === 'dead' || c.out === 'acquihire') return 'lost';
  return 'open';
}

const share = (list, f) => {
  const known = list.filter((c) => f(c) !== null);
  return known.length ? { pct: Math.round((100 * known.filter((c) => f(c)).length) / known.length), n: known.length } : null;
};

// pick the tightest pool with enough decided companies: niche → vertical
export function versionPool(companies, v, sv) {
  const niche = companies.filter((c) => c.v === v && sv && c.sv === sv);
  const dec = (l) => ({ won: l.filter((c) => fate(c) === 'won'), lost: l.filter((c) => fate(c) === 'lost'), open: l.filter((c) => fate(c) === 'open') });
  const n = dec(niche);
  if (n.won.length >= 2 && n.lost.length >= 2) return { scope: 'niche', all: niche, ...n };
  const vert = companies.filter((c) => c.v === v);
  return { scope: 'vertical', nicheSize: niche.length, all: vert, ...dec(vert) };
}

export function versionReport(companies, v, sv, causesMeta) {
  const P = versionPool(companies, v, sv);
  const W = P.won, L = P.lost;
  const rows = [];
  const verdicts = [];
  const enough = W.length >= 2 && L.length >= 2;
  const b2b = (c) => (c.flags.b2b ? true : c.flags.b2c ? false : null);
  const hw = (c) => !!c.flags.hardware;
  const pair = (f) => [share(W, f), share(L, f)];
  const [bw, bl] = pair(b2b), [hww, hwl] = pair(hw);
  const informative = (a, b) => Math.abs(a.pct - b.pct) >= 8; // "100% vs 100%" teaches nothing
  if (bw && bl && informative(bw, bl)) {
    rows.push({ k: 'Sold to businesses (vs consumers)', w: `${bw.pct}%`, l: `${bl.pct}%`, gap: bw.pct - bl.pct });
    if (enough && Math.abs(bw.pct - bl.pct) >= 25) verdicts.push({ strength: Math.abs(bw.pct - bl.pct), headline: bw.pct > bl.pct ? 'The winners sold to businesses.' : 'The winners sold to consumers.', text: `${bw.pct}% of the winners sold to businesses, against ${bl.pct}% of the ones that died.` });
  }
  if (hww && hwl && informative(hww, hwl)) {
    rows.push({ k: 'Sold hardware (vs software only)', w: `${hww.pct}%`, l: `${hwl.pct}%`, gap: hww.pct - hwl.pct });
    if (enough && Math.abs(hww.pct - hwl.pct) >= 25) verdicts.push({ strength: Math.abs(hww.pct - hwl.pct), headline: hww.pct > hwl.pct ? 'The winners built the hardware.' : 'The winners sold software, not hardware.', text: `${hww.pct}% of the winners sold hardware, against ${hwl.pct}% of the ones that died.` });
  }
  const fy = (l) => medianInt(l.map((c) => c.f).filter(Boolean));
  const fyW = fy(W), fyL = fy(L);
  if (fyW && fyL && fyW !== fyL) {
    rows.push({ k: 'Typical founding year', w: String(fyW), l: String(fyL), gap: fyW - fyL });
    if (enough && Math.abs(fyW - fyL) >= 4) verdicts.push({ strength: 20 + Math.abs(fyW - fyL), headline: fyW > fyL ? 'Timing mattered: the early attempts died.' : 'The early movers won; later entrants died.', text: `The winners were typically founded around ${fyW}; the ones that died around ${fyL}.` });
  }
  const raisedW = median(W.map((c) => c.raised).filter(Boolean)), raisedL = median(L.map((c) => c.raised).filter(Boolean));
  if (raisedW && raisedL) rows.push({ k: 'Money raised in total', w: raisedW, l: raisedL, money: true, note: 'survivors keep raising, so this follows success as much as it causes it' });
  const yrs = (l) => medianInt(l.filter((c) => c.f && c.e).map((c) => c.e - c.f));
  const yW = yrs(W), yL = yrs(L);
  if (yW != null && yL != null) rows.push({ k: 'Years from founding to the outcome', w: `${yW}`, l: `${yL}` });
  const topRegions = (l) => {
    const t = {};
    for (const c of l) t[c.r] = (t[c.r] || 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r);
  };
  const rW = topRegions(W), rL = topRegions(L);
  if (rW.length && rL.length) rows.push({ k: 'Where most were based', w: rW, l: rL, regions: true });
  // what the winners did (their own drivers, biggest outcomes first), and how the rest died
  const size = (c) => c.exitV || c.peak || c.raised || 0;
  const winnersDid = W.filter((c) => (c.drivers || []).length).sort((a, b) => size(b) - size(a)).slice(0, 4);
  const cz = {};
  for (const c of L) for (const x of (c.causes || []).slice(0, 2)) (cz[x] = cz[x] || []).push(c);
  const causes = Object.entries(cz).sort((a, b) => b[1].length - a[1].length).slice(0, 4).map(([id, cs]) => ({ id, label: (causesMeta[id] || { label: id }).label, companies: cs }));
  verdicts.sort((a, b) => b.strength - a.strength);
  return { ...P, rows, verdicts, winnersDid, causes, enough };
}

// Adjacent niches where real companies did better. Same vertical first; another vertical only when its
// companies are genuinely close to the idea in what they do (simOf = wording similarity to the pitch).
export function neighbourNiches(companies, v, sv, related = [], simOf = () => 0) {
  const groups = {};
  for (const c of companies) {
    if (!c.sv || (c.v === v && c.sv === sv)) continue;
    if (c.v !== v && !related.includes(c.v)) continue;
    const k = c.v + '/' + c.sv;
    const g = (groups[k] = groups[k] || { v: c.v, sv: c.sv, won: [], lost: [], open: [], near: [] });
    g[fate(c)].push(c);
    g.near.push(simOf(c));
  }
  const score = (g) => (g.won.length + 1) / (g.won.length + g.lost.length + 2); // smoothed: tiny groups can't top the list
  const here = companies.filter((c) => c.v === v && c.sv === sv);
  const hereG = { won: here.filter((c) => fate(c) === 'won'), lost: here.filter((c) => fate(c) === 'lost'), open: here.filter((c) => fate(c) === 'open') };
  const hereScore = score(hereG);
  const list = Object.values(groups)
    .map((g) => {
      const top = g.near.slice().sort((a, b) => b - a);
      return { ...g, score: score(g), sameVertical: g.v === v, nearness: (top[0] || 0) + (top[1] || 0) / 2 };
    })
    .filter((g) => g.won.length + g.lost.length >= 3 && g.score > hereScore && (g.sameVertical || g.nearness >= 0.18))
    .sort((a, b) => (b.sameVertical - a.sameVertical) * 0.2 + (b.score - a.score) + 0.3 * (b.nearness - a.nearness));
  return { here: { ...hereG, score: hereScore }, list: list.slice(0, 4) };
}

// ---------------- the two lives ----------------
export function obituaryUniverse(universes) {
  const dead = universes.filter((u) => u.outcome === 'dead');
  if (!dead.length) return null;
  const groups = {};
  for (const u of dead) (groups[u.cause + '|' + u.stageReached] = groups[u.cause + '|' + u.stageReached] || []).push(u);
  const biggest = Object.values(groups).sort((a, b) => b.length - a.length)[0];
  const byTime = biggest.slice().sort((a, b) => a.endT - b.endT);
  return { u: byTime[Math.floor(byTime.length / 2)], sameWay: biggest.length, totalDead: dead.length };
}

export function bestLifeUniverse(universes) {
  const score = (u) => (u.outcome === 'dead' ? u.peak * 0.01 : Math.max(u.exitValue || 0, u.post || 0)) + u.teamCash * 0.001;
  return universes.slice().sort((a, b) => score(b) - score(a))[0];
}

const QUIPS = {
  no_market_need: 'Built it. They didn’t come.',
  ran_out_of_cash: 'Ran out of runway with the next term sheet “basically agreed”.',
  funding_crunch: 'Picked the one year nobody was writing cheques.',
  outcompeted: 'Someone with more money built it faster.',
  bad_unit_economics: 'Lost a little on every customer and tried to make it up in volume.',
  regulatory: 'The regulators read the pitch deck too.',
  legal_ip: 'Lawyered to death.',
  fraud: 'The numbers were more optimistic than the founders.',
  team_conflict: 'The co-founders stopped agreeing on anything, including the company.',
  product_tech_failure: 'The demo worked. The product didn’t.',
  too_early: 'Right idea. Wrong decade.',
  scaled_too_fast: 'Opened in twelve cities before it worked in one.',
  failed_pivot: 'Pivoted until it ran out of directions.',
  platform_dependency: 'Built on someone else’s platform. They changed the rules.',
  lost_key_customer: 'Its biggest customer was also its only customer.',
  hardware_supply_chain: 'Hardware is hard. The factory agreed.',
  local_incumbent: 'The local champion knew the market better.',
  wrong_market_fit: 'Great product. Wrong country.',
  acquired_and_shut: 'Bought, then quietly switched off.',
  founder_burnout: 'The founders burned out before the money did.',
};
export const quipFor = (cause) => QUIPS[cause] || 'It tried.';

// a plausible startup name from the idea, stable for the same pitch
const SUFFIX = {
  robotics: ['Dynamics', 'Robotics', 'Motion'], ai: ['AI', 'Labs', 'Intelligence'], space: ['Space', 'Orbital', 'Aerospace'],
  bio: ['Bio', 'Therapeutics', 'Biosciences'], health: ['Health', 'Care', 'Medical'], climate: ['Energy', 'Power', 'Climate'],
  fintech: ['Pay', 'Money', 'Capital'], semis: ['Silicon', 'Compute', 'Quantum'], mobility: ['Mobility', 'Motors', 'Go'],
  devtools: ['Dev', 'Stack', 'Code'], _: ['ly', 'ify', 'Labs', 'HQ', 'Co'],
};
export function startupName(idea, analysis) {
  const STOPISH = new Set('startup company platform app cheap the that make makes help for with and robot robots ai software new better'.split(' '));
  const words = (analysis.terms || []).join(' ').split(/\s+/).concat((idea || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/))
    .filter((w) => w.length >= 4 && !STOPISH.has(w));
  const base = words[0] || 'Nova';
  const list = SUFFIX[analysis.vertical] || SUFFIX._;
  const sfx = list[hashString(idea || '') % list.length];
  const cap = base.charAt(0).toUpperCase() + base.slice(1);
  return /^[a-z]/.test(sfx) ? cap.replace(/[aeiouy]$/, '') + sfx : `${cap} ${sfx}`;
}
