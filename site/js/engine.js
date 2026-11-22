// 1,000 Futures: Monte Carlo over the funding ladder.
// Every rate comes from data/bundle.json (built from research/ by scripts/build_data.py).

import { mulberry32, hashString, normal, lognormal, pickWeighted, clamp } from './rng.js';
import { newCapTable, applyRound, waterfall, totalPreference } from './captable.js';

export const STAGES = ['pre_seed', 'seed', 'A', 'B', 'C', 'growth'];
export const STAGE_LABEL = { pre_seed: 'Pre-seed', seed: 'Seed', A: 'Series A', B: 'Series B', C: 'Series C', growth: 'Growth' };
export const HORIZON = 120; // months simulated (10 years)
export const START_YEAR = 2026;
export const N_UNIVERSES = 1000;

export const OUTCOMES = {
  dead:      { label: 'Died',               color: '#ff5a4e' },
  acquihire: { label: 'Fire sale / acquihire', color: '#d9893a' },
  acquired:  { label: 'Acquired',           color: '#ffb547' },
  ipo:       { label: 'IPO',                color: '#ffe066' },
  unicorn:   { label: 'Private $1B+',       color: '#ffd84d' },
  alive:     { label: 'Still going',        color: '#8fa3bf' },
};

// ---------- parameter assembly ----------

function successShare(list, w) {
  // share of weighted comps ({c, sim}) that did not die (acquired at a profit, IPO, unicorn, active)
  let tot = 0, ok = 0;
  list.forEach((x, i) => {
    const wt = w(x, i);
    if (wt <= 0) return;
    tot += wt;
    if (x.c.out !== 'dead' && x.c.out !== 'acquihire') ok += wt;
  });
  return { tot, share: tot > 0 ? ok / tot : null };
}

// How much the closest real companies shift the odds, corrected for the corpus's own selection bias
// (our curated list over-represents famous wins and famous deaths) and shrunk toward the base rate.
export function evidenceMultiplier(comps, region, bundle) {
  const PRIOR = bundle.model.evidencePrior; // pseudo-count of the base rate
  const corpus = bundle.corpus;
  // one global yardstick: the regional mix of our corpus reflects how it was researched, not reality
  const regionBase = corpus.successShare;
  // a young company that simply hasn't died yet is weak evidence (it hasn't had time to fail)
  const young = (c) => c.out === 'active' && (c.f || 0) >= START_YEAR - 5;
  const weight = (x) => x.sim * (x.c.r === region ? 1 : bundle.model.otherRegionWeight) * (young(x.c) ? 0.3 : 1);
  const { tot, share } = successShare(comps, weight);
  if (share === null) return { mult: 1, n: 0, share: null, base: regionBase };
  // compare like with like: famous moonshots are judged against the moonshot part of the corpus
  let bw = 0, bs = 0;
  for (const x of comps) {
    const w = weight(x);
    bw += w; bs += w * (x.c.moon && corpus.moonShare !== null ? corpus.moonShare : regionBase);
  }
  const base = bw > 0 ? bs / bw : regionBase;
  const shrunk = (share * tot + base * PRIOR) / (tot + PRIOR);
  const mult = clamp(shrunk / base, bundle.model.evidenceMin, bundle.model.evidenceMax);
  return { mult, n: tot, share, base };
}

export function buildParams(profile, bundle) {
  const region = bundle.ladders[profile.region] ? profile.region : 'global';
  const ladder = {};
  for (const s of STAGES) {
    ladder[s] = Object.assign({}, bundle.ladders.global[s], (bundle.ladders[region] || {})[s] || {});
  }
  const sm = bundle.sectorMods[profile.sector] || {};
  const fm = (bundle.founderMods[profile.founders] || { pNext: 1 }).pNext;
  const ev = evidenceMultiplier(profile.comps || [], region, bundle);
  const moon = profile.moonshot ? bundle.moonshotModel : null;

  // The evidence multiplier acts on overall survival; spread it across the rungs still ahead.
  const startIdx = STAGES.indexOf(profile.stage);
  const rungsAhead = Math.max(1, STAGES.length - 1 - startIdx);
  const perRungEv = Math.pow(ev.mult, 1 / rungsAhead);

  const pNextMult = {};
  STAGES.forEach((s, i) => {
    let m = (sm.pNext || 1) * fm * perRungEv;
    if (moon) m *= i <= 2 ? moon.pNextEarly : moon.pNextLate;
    pNextMult[s] = m;
  });

  return {
    region, sector: profile.sector, stageIdx: Math.max(0, startIdx), ladder, pNextMult,
    deadMult: moon ? moon.dead : 1,
    dilution: bundle.dilution,
    stall: bundle.model.stall || { next: 0.5, dead: 1.6 },
    monthsMult: (sm.months || 1) * (moon ? moon.months : 1),
    valMult: (sm.val || 1) * (moon ? moon.val : 1),
    roundMult: (sm.val || 1) * (moon ? moon.round : 1),
    sigma: moon ? moon.sigma : bundle.model.sigma,
    qualityWeight: bundle.model.qualityWeight,
    exits: bundle.exits,
    acqMult: sm.acq || 1,
    moonshot: !!moon, nearDeathSave: moon ? moon.nearDeathSave : 0,
    winter: bundle.winter,
    causeWeights: causeWeightsFor(profile, bundle),
    echoPools: echoPoolsFor(profile, bundle),
    evidence: ev,
  };
}

// cause mix = global distribution x sector reweighting x matched dead comps
function causeWeightsFor(profile, bundle) {
  const w = {};
  for (const [id, c] of Object.entries(bundle.causes)) w[id] = c.weight;
  // how companies in the same vertical actually died (falls back to the coarse research sector)
  let sec = {};
  if (profile.vertical) {
    for (const c of bundle.companies) {
      if (c.v !== profile.vertical || (c.out !== 'dead' && c.out !== 'acquihire')) continue;
      for (const id of c.causes || []) sec[id] = (sec[id] || 0) + 1;
    }
  }
  if (!Object.keys(sec).length) sec = bundle.sectorCauses[profile.sector] || {};
  const secTot = Object.values(sec).reduce((a, b) => a + b, 0);
  if (secTot > 0) {
    for (const id of Object.keys(w)) w[id] *= 1 + 1.5 * ((sec[id] || 0) / secTot);
  }
  for (const { c, sim } of (profile.comps || [])) {
    if (c.out !== 'dead' && c.out !== 'acquihire') continue;
    (c.causes || []).forEach((id, k) => { if (w[id] !== undefined) w[id] *= 1 + sim * (k === 0 ? 1.0 : 0.5); });
  }
  return w;
}

function echoPoolsFor(profile, bundle) {
  const compIds = new Set((profile.comps || []).map((x) => x.c.id));
  const dead = bundle.companies.filter((c) => (c.out === 'dead' || c.out === 'acquihire') && c.causes && c.causes.length);
  // outside the closest comps and the same sector, only echo companies of the same kind (moonshot or not)
  const kind = dead.filter((c) => !!c.moon === !!profile.moonshot);
  // Echoes: the closest comps, then the same vertical, then related verticals with the same kind of business
  // (hardware with hardware). Never a random company: a death with no fitting echo is shown without one.
  if (!profile.vertical) {
    return { comps: dead.filter((c) => compIds.has(c.id)), sector: dead.filter((c) => c.s === profile.sector), region: [], all: [] };
  }
  const related = new Set(profile.related || []);
  const sameKind = (c) => profile.hardware === undefined || !!(c.flags && c.flags.hardware) === !!profile.hardware;
  return {
    comps: dead.filter((c) => compIds.has(c.id)),
    sector: dead.filter((c) => c.v === profile.vertical),
    region: [],
    all: kind.filter((c) => related.has(c.v) && sameKind(c)),
  };
}

const EARLY_CAUSES = { no_market_need: 1.6, team_conflict: 1.4, founder_burnout: 1.4, product_tech_failure: 1.2, failed_pivot: 1.3 };
const LATE_CAUSES = { bad_unit_economics: 1.6, scaled_too_fast: 1.7, funding_crunch: 1.4, outcompeted: 1.3, fraud: 1.4, regulatory: 1.2, lost_key_customer: 1.2 };
// moonshots die of physics, timing and capital more than of "nobody wanted it"
const MOON_CAUSES = { too_early: 2.2, product_tech_failure: 2.0, hardware_supply_chain: 1.8, ran_out_of_cash: 1.3, regulatory: 1.2, no_market_need: 0.6 };

function pickCause(rng, P, stage, inWinter) {
  const late = STAGES.indexOf(stage) >= 3;
  const entries = Object.entries(P.causeWeights).map(([id, w]) => {
    let x = w * ((late ? LATE_CAUSES[id] : EARLY_CAUSES[id]) || 1) * (P.moonshot ? (MOON_CAUSES[id] || 1) : 1);
    if (id === 'funding_crunch' && inWinter) x *= 4;
    if (id === 'acquired_and_shut') x = 0;
    return [id, x];
  });
  return pickWeighted(rng, entries);
}

function pickEcho(rng, P, cause) {
  for (const pool of [P.echoPools.comps, P.echoPools.sector, P.echoPools.region, P.echoPools.all]) {
    const hits = pool.filter((c) => c.causes.includes(cause));
    if (hits.length) return hits[Math.floor(rng() * hits.length)].id;
  }
  return null;
}

// ---------- one universe ----------

// median dilution for a round at this stage; capital-hungry spaces (bigger rounds than valuations) dilute more
function dilutionFor(P, stage) {
  const base = (P.dilution && P.dilution[stage]) || ({ pre_seed: 0.07, seed: 0.19, A: 0.19, B: 0.13, C: 0.1, growth: 0.075 })[stage];
  return clamp(base * Math.max(1, P.roundMult / P.valMult), 0.02, 0.4);
}

function drawWinter(rng, W) {
  return rng() < W.prob ? { start: 12 + rng() * (HORIZON - 36), len: W.lenMonths } : null;
}

function runUniverse(rng, P, index) {
  let stageIdx = P.stageIdx;
  let s = STAGES[stageIdx];
  const L0 = P.ladder[s];
  const q = normal(rng); // latent quality: good companies tend to keep doing well
  let post = L0.post * P.valMult * Math.exp(P.sigma * 0.5 * q);
  // the founders' cap table: earlier rounds at median terms, then today's round
  const ct = newCapTable();
  let raised = 0;
  for (let k = 0; k < stageIdx; k++) {
    const sk = STAGES[k], kPost = P.ladder[sk].post * P.valMult, kRound = kPost * dilutionFor(P, sk);
    applyRound(ct, sk, kRound, kPost);
    raised += kRound;
  }
  const r0 = post * dilutionFor(P, s);
  applyRound(ct, s, r0, post);
  raised += r0;
  let peak = post, t = 0, nearDeath = false;
  const events = [{ t: 0, type: 'start', stage: s, post, founderPct: ct.founders, raised }];
  // one market for the whole multiverse (a visible "winter hits" moment) — or, for long-run
  // averages, every universe gets its own macro history
  const winter = P.winterEach ? drawWinter(rng, P.winter) : P.sharedWinter;
  let outcome = 'alive', exitValue = null, cause = null, echo = null, stalled = false;
  let stallPenalty = { next: 1, dead: 1 };

  for (let guard = 0; guard < 40; guard++) {
    s = STAGES[stageIdx];
    const L = P.ladder[s];
    const dt = Math.max(3, lognormal(rng, L.mNext * P.monthsMult, 0.4));
    if (t + dt > HORIZON) break; // still going at the horizon
    t += dt;
    const inWinter = !!winter && t >= winter.start && t <= winter.start + winter.len;
    const qShift = Math.exp(P.qualityWeight * q);
    let pNext = clamp(L.pNext * P.pNextMult[s] * qShift * (inWinter ? P.winter.mult : 1) * stallPenalty.next, 0.005, 0.96);
    let pAcq = clamp(L.pAcq * P.acqMult, 0, 0.6);
    let pDead = clamp(L.pDead * P.deadMult / Math.sqrt(qShift) * (inWinter ? P.winter.deadMult : 1) * stallPenalty.dead, 0.01, 0.9);
    let pIpo = 0;
    if (s === 'growth') {
      pIpo = clamp(L.pIpo * Math.sqrt(qShift) * (post >= 1e9 ? 1.3 : 0.7) * (inWinter ? 0.3 : 1), 0, 0.6);
    }
    const tot = pNext + pAcq + pIpo + pDead;
    if (tot > 0.995) { const k = 0.995 / tot; pNext *= k; pAcq *= k; pIpo *= k; pDead *= k; }
    const r = rng();
    // the remainder (1 - all of the above) neither raises, sells nor dies: it stalls.
    // A stalled company gets one more roll later, with worse odds; if it stalls again it's a zombie.
    if (r >= pIpo + pNext + pAcq + pDead) {
      if (stalled) { events.push({ t, type: 'stall', stage: s }); break; }
      stalled = true;
      stallPenalty = P.stall;
      continue;
    }

    if (r < pIpo) {
      exitValue = post * lognormal(rng, P.exits.ipoToLastPost, 0.45);
      outcome = 'ipo'; peak = Math.max(peak, exitValue);
      events.push({ t, type: 'ipo', stage: s, value: exitValue });
      break;
    }
    if (r < pIpo + pNext) {
      const nextIdx = Math.min(stageIdx + 1, STAGES.length - 1);
      const nxt = STAGES[nextIdx];
      const Ln = P.ladder[nxt];
      const z = 0.7 * q + 0.71 * normal(rng);
      let newPost = Ln.post * P.valMult * Math.exp(P.sigma * z);
      if (nxt === 'growth' && stageIdx === nextIdx) newPost = post * lognormal(rng, 1.5, 0.35); // another growth round
      newPost = Math.max(newPost, post * 0.6); // down rounds exist, but not unbounded in the model
      // round size scales with the valuation: dilution is drawn around the stage's median
      const round = newPost * clamp(lognormal(rng, dilutionFor(P, nxt), 0.3), 0.02, 0.45);
      applyRound(ct, nxt, round, newPost);
      raised += round; post = newPost; peak = Math.max(peak, post); stageIdx = nextIdx;
      stalled = false; stallPenalty = { next: 1, dead: 1 };
      events.push({ t, type: 'raise', stage: nxt, round, post, founderPct: ct.founders, raised });
      continue;
    }
    if (r < pIpo + pNext + pAcq) {
      exitValue = post * lognormal(rng, P.exits.acqToLastPost, 0.9);
      outcome = exitValue < Math.max(raised, P.exits.acquihireFloor) ? 'acquihire' : 'acquired';
      events.push({ t, type: outcome, stage: s, value: exitValue });
      break;
    }
    // would die here; moonshots sometimes survive one near-death moment
    if (P.moonshot && !nearDeath && rng() < P.nearDeathSave) {
      nearDeath = true;
      events.push({ t, type: 'near_death', stage: s });
      continue;
    }
    cause = pickCause(rng, P, s, inWinter);
    echo = pickEcho(rng, P, cause);
    outcome = 'dead';
    events.push({ t, type: 'dead', stage: s, cause, echo, winter: inWinter });
    break;
  }

  if (outcome === 'alive' && post >= 1e9) outcome = 'unicorn';
  // what the founding team walks away with
  let teamCash = 0, teamPaper = 0, investorsTake = 0;
  if (outcome === 'acquired' || outcome === 'acquihire') {
    const w = waterfall(ct, exitValue);
    teamCash = w.founders; investorsTake = w.investors;
  } else if (outcome === 'ipo') {
    teamCash = ct.founders * exitValue; // preferred converts at IPO; shares unlock after the lock-up
  } else if (outcome === 'alive' || outcome === 'unicorn') {
    teamPaper = ct.founders * post; // still private: paper value only
  }
  return {
    index, outcome, events, stageReached: STAGES[stageIdx], raised, post, peak, exitValue, cause, echo,
    founderPct: ct.founders, prefStack: totalPreference(ct), teamCash, teamPaper, investorsTake,
    everUnicorn: peak >= 1e9, decacorn: peak >= 1e10, nearDeath, winterHit: !!winter, stalled,
    endT: outcome === 'alive' || outcome === 'unicorn' ? HORIZON : events[events.length - 1].t,
  };
}

// ---------- public API ----------

export function seedFor(profile) {
  return hashString([profile.idea || '', profile.region, profile.stage, profile.founders, profile.moonshot ? 'm' : ''].join('|').toLowerCase());
}

export function simulate(profile, bundle, n = N_UNIVERSES, seedOverride, opts = {}) {
  const P = buildParams(profile, bundle);
  const seed = seedOverride !== undefined ? seedOverride : seedFor(profile);
  P.winterEach = !!opts.winterEach;
  P.sharedWinter = drawWinter(mulberry32((seed ^ 0x5bd1e995) >>> 0), bundle.winter);
  const universes = [];
  // one RNG per universe (common random numbers): changing a setting changes decisions, not the dice,
  // so "what if" comparisons aren't drowned in sampling noise
  for (let i = 0; i < n; i++) universes.push(runUniverse(mulberry32((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0), P, i));
  return { params: P, universes, summary: summarize(universes) };
}

export function summarize(universes) {
  const n = universes.length;
  const count = {};
  for (const k of Object.keys(OUTCOMES)) count[k] = 0;
  const causes = {}, echoesByCause = {}, deathsByYear = new Array(11).fill(0), deathsByStage = {};
  let unicorns = 0, decacorns = 0, nearDeathSurvivors = 0;
  for (const u of universes) {
    count[u.outcome]++;
    if (u.everUnicorn) unicorns++;
    if (u.decacorn) decacorns++;
    if (u.nearDeath && u.outcome !== 'dead') nearDeathSurvivors++;
    if (u.outcome === 'dead') {
      causes[u.cause] = (causes[u.cause] || 0) + 1;
      (echoesByCause[u.cause] = echoesByCause[u.cause] || {});
      if (u.echo) echoesByCause[u.cause][u.echo] = (echoesByCause[u.cause][u.echo] || 0) + 1;
      deathsByYear[Math.min(10, Math.floor(u.endT / 12))]++;
      deathsByStage[u.stageReached] = (deathsByStage[u.stageReached] || 0) + 1;
    }
  }
  const survived = n - count.dead - count.acquihire;
  return { n, count, unicorns, decacorns, survived, nearDeathSurvivors, causes, echoesByCause, deathsByYear, deathsByStage };
}

// Same idea, every market: which one gives it the best odds? (results scaled to per-1,000)
export function compareRegions(profile, bundle, regions, n = 4000) {
  const seed = seedFor(Object.assign({}, profile, { region: 'any' }));
  const k = 1000 / n;
  return regions.map((region) => {
    const { summary, params } = simulate(Object.assign({}, profile, { region }), bundle, n, seed, { winterEach: true });
    return { region, unicorns: summary.unicorns * k, survived: summary.survived * k, dead: summary.count.dead * k, evidence: params.evidence };
  }).sort((a, b) => (b.unicorns - a.unicorns) || (b.survived - a.survived));
}

// A "what if" on the same dice: per-1,000 numbers from a bigger run so small effects are visible
export function whatIf(profile, bundle, n = 4000) {
  const { summary } = simulate(profile, bundle, n, seedFor(Object.assign({}, profile, { region: 'any', founders: '', moonshot: false, stage: '' })), { winterEach: true });
  const k = 1000 / n;
  return { unicorns: summary.unicorns * k, dead: summary.count.dead * k, survived: summary.survived * k };
}
