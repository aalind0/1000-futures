// Idea reader: vertical → sub-vertical → niche, then the closest real companies from the SAME space.
// Tiers: 1 = same sub-vertical (niche), 2 = same vertical, 3 = related vertical (shown as "adjacent", never used
// as evidence). Companies from unrelated verticals are never shown, however similar their wording is.

import { classify, businessFlags, tokenize, stem, V, SV, TAXONOMY, SECTOR_TO_VERTICAL, label } from './taxonomy.js';

export { stem, tokenize, label };
export const sectorLabel = (s) => s;
export const VERTICALS = TAXONOMY.map((v) => ({ id: v.id, label: v.label, subs: v.subs.map((s) => ({ id: s.id, label: s.label })) }));

const MOON_WORDS = ['mars', 'multiplanetary', 'interplanetary', 'fusion', 'agi', 'superintelligence', 'immortality', 'teleport',
  'space elevator', 'asteroid', 'reverse aging', 'brain computer interface', 'quantum'];

const ENABLER_BY_SUB = {
  launch: 'launch', sat_comms: 'launch', in_space: 'launch', sat_hardware: 'launch', earth_obs: 'launch',
  batteries: 'battery', evs: 'battery', ev_charging: 'battery', renewables: 'solar',
  gene_cell: 'sequenc', bio_tools: 'sequenc', longevity: 'sequenc', drug_discovery: 'sequenc',
  foundation_models: 'token', ai_agents: 'token', ai_infra: 'token', ai_coding: 'token', genai_media: 'token',
  autonomous_vehicles: 'lidar', drones: 'drone', air_mobility: 'drone', ai_chips: 'compute',
  humanoids: 'robot', manipulation: 'robot', robot_learning: 'robot', industrial: 'robot',
};

// Famous companies people name in pitches ("Neuralink but…", "like Waymo") that may not be in the dataset
const FAMOUS = {
  neuralink: 'health/neurotech', synchron: 'health/neurotech', anthropic: 'ai/foundation_models', 'openai': 'ai/foundation_models',
  chatgpt: 'ai/ai_agents', perplexity: 'ai/ai_agents', midjourney: 'ai/genai_media', elevenlabs: 'ai/genai_media', runway: 'ai/genai_media',
  nvidia: 'semis/ai_chips', cerebras: 'semis/ai_chips', groq: 'semis/ai_chips', waymo: 'mobility/autonomous_vehicles', zipline: 'robotics/drones',
  'boston dynamics': 'robotics/humanoids', 'optimus': 'robotics/humanoids', 'figure ai': 'robotics/humanoids', 'unitree': 'robotics/humanoids',
  'physical intelligence': 'robotics/robot_learning', roomba: 'robotics/home_robots', irobot: 'robotics/home_robots',
  'rocket lab': 'space/launch', 'planet labs': 'space/earth_obs', 'blue origin': 'space/launch', anduril: 'defense/defense_autonomy',
  duolingo: 'edtech/language', coursera: 'edtech/upskilling', tinder: 'social/dating', bumble: 'social/dating', hinge: 'social/dating',
  netflix: 'media/streaming', youtube: 'media/creator', tiktok: 'social/social_network', snapchat: 'social/social_network', reddit: 'social/communities',
  peloton: 'health/fitness', oura: 'hardware/wearables', robinhood: 'fintech/wealth', venmo: 'fintech/payments', 'cash app': 'fintech/payments',
  notion: 'work/collaboration', shein: 'commerce/fashion_beauty', temu: 'commerce/general_marketplace', etsy: 'commerce/general_marketplace',
  'impossible foods': 'food/alt_protein', 'ginkgo': 'bio/synbio', 'altos labs': 'bio/longevity', 'helion': 'climate/fusion_nuclear',
  'commonwealth fusion': 'climate/fusion_nuclear', 'climeworks': 'climate/carbon', 'joby': 'mobility/air_mobility', 'rent the runway': 'commerce/fashion_beauty',
  turo: 'mobility/car_commerce', getaround: 'mobility/car_commerce', 'door dash': 'delivery/food_delivery', 'uber eats': 'delivery/food_delivery',
};
// dataset names that are ordinary words and must not be read as a company mention
const COMMON_NAMES = new Set(('fast mint wave secret frank forward handy dash bolt lime bird kite pollen okra sonder hike slack wise alan chime ' +
  'cruise convoy pebble essential humane sidecar oscar pandora tabby tier fabric wish atrium color element ola koo nuri wave ' +
  'uber amazon apple meta tesla ocado opendoor flix').split(/\s+/));

export class Matcher {
  constructor(companies, overrides = {}) {
    this.companies = companies;
    // name index for "Neuralink but…" style pitches
    this.names = [];
    for (const c of companies) {
      const base = (c.n || '').replace(/\s*\(.*\)\s*/, '').trim().toLowerCase();
      const alias = ((c.n || '').match(/\(([^)]+)\)/) || [])[1];
      for (const nm of [base, alias && !/^formerly/i.test(alias) ? alias.toLowerCase() : null]) {
        if (nm && nm.length >= 4 && !COMMON_NAMES.has(nm)) this.names.push([nm, c]);
      }
    }
    for (const c of companies) {
      const o = overrides[c.id];
      if (o && V[o.v]) { c.v = o.v; c.sv = o.sv || null; c.labelSrc = 'manual'; }
      else if (c.v && V[c.v]) { c.labelSrc = 'research'; }
      else {
        const prior = {};
        for (const v of SECTOR_TO_VERTICAL[c.s] || []) prior[v] = 1.5;
        // "Rocket Internet" (a venture builder) is not a rocket company
        const story = (c.story || '').replace(/rocket internet/gi, 'venture builder');
        const r = classify([[c.o || '', 1], [(c.t || []).join(', '), 1], [c.n || '', 0.6], [story, 0.35]], prior);
        c.v = r.vertical || (SECTOR_TO_VERTICAL[c.s] || ['saas'])[0];
        c.sv = r.vertical === c.v ? r.subvertical : null;
        c.labelSrc = 'auto';
      }
      if (c.sv && !SV[c.v + '/' + c.sv]) c.sv = null;
      c.flags = businessFlags([c.o, (c.t || []).join(' ')].join(' '));
    }
    // TF-IDF over name, tags, one-liner and story (wording similarity, used only *within* a space)
    const docs = companies.map((c) => {
      const toks = tokenize([c.n, (c.t || []).join(' '), (c.t || []).join(' '), c.o, c.o, c.story || ''].join(' '));
      const tf = {};
      for (const t of toks) tf[t] = (tf[t] || 0) + 1;
      return tf;
    });
    const df = {};
    for (const tf of docs) for (const t of Object.keys(tf)) df[t] = (df[t] || 0) + 1;
    this.N = docs.length;
    this.idf = {};
    for (const [t, d] of Object.entries(df)) this.idf[t] = Math.log((this.N + 1) / (d + 0.5));
    this.vecs = docs.map((tf) => this.vec(tf));
  }

  vec(tf) {
    const v = {}; let norm = 0;
    for (const [t, n] of Object.entries(tf)) {
      const w = (1 + Math.log(n)) * (this.idf[t] || Math.log(this.N + 1));
      v[t] = w; norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const t of Object.keys(v)) v[t] /= norm;
    return v;
  }

  // wording similarity of every company to a pitch, by company id
  similarities(idea) {
    const tf = {};
    for (const t of tokenize(idea)) tf[t] = (tf[t] || 0) + 1;
    const q = this.vec(tf);
    const out = new Map();
    this.companies.forEach((c, i) => {
      let s = 0;
      for (const [t, w] of Object.entries(q)) if (this.vecs[i][t]) s += w * this.vecs[i][t];
      out.set(c.id, s);
    });
    return out;
  }

  // opts.force = 'vertical/sub' (user corrected the classification)
  // companies named in the pitch, except in "X for Y" form (there Y, not X, is the space)
  anchors(idea) {
    const raw = ' ' + (idea || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const found = [];
    // a named company steers the space only when it's the model ("Neuralink but…", "like Waymo"),
    // not when it's the template ("Uber for…") or the customer/platform ("for Shopify stores", "on WhatsApp")
    const seen = (name) => {
      const i = raw.indexOf(' ' + name + ' ');
      if (i < 0 || raw.startsWith(' for ', i + name.length + 1)) return false;
      const before = raw.slice(0, i).trim().split(' ').pop();
      return !['for', 'on', 'with', 'to', 'into', 'from', 'via', 'inside', 'through', 'over'].includes(before);
    };
    for (const [nm, key] of Object.entries(FAMOUS)) if (seen(nm)) found.push({ name: nm, key });
    for (const [nm, c] of this.names) if (c.v && seen(nm)) found.push({ name: nm, key: c.v + '/' + (c.sv || ''), company: c });
    return found;
  }

  analyze(idea, opts = {}) {
    const anchors = this.anchors(idea);
    const vPrior = {}, svPrior = {};
    for (const a of anchors) {
      const [av, asv] = a.key.split('/');
      vPrior[av] = (vPrior[av] || 0) + 2;
      if (asv) svPrior[av + '/' + asv] = (svPrior[av + '/' + asv] || 0) + 3;
    }
    let cls = classify([[idea || '', 1]], vPrior, svPrior);
    if (opts.force) {
      const [fv, fsv] = opts.force.split('/');
      if (V[fv]) cls = Object.assign({}, cls, { vertical: fv, subvertical: fsv && SV[fv + '/' + fsv] ? fsv : null, forced: true, second: null });
    }
    const flags = businessFlags(idea);
    const tf = {};
    for (const t of tokenize(idea)) tf[t] = (tf[t] || 0) + 1;
    const q = this.vec(tf);
    const texts = this.companies.map((c, i) => {
      let text = 0;
      for (const [t, w] of Object.entries(q)) if (this.vecs[i][t]) text += w * this.vecs[i][t];
      return text;
    });
    // Fallback when the words name no niche: let the most similar real companies vote (≥2 must agree)
    let inferred = null;
    const vote = (pool, minSim, key) => {
      const top = pool.filter((i) => texts[i] >= minSim).sort((a, b) => texts[b] - texts[a]).slice(0, 6);
      const tally = {};
      for (const i of top) { const k = key(this.companies[i]); if (k) (tally[k] = tally[k] || { w: 0, n: 0 }), tally[k].w += texts[i], tally[k].n++; }
      const best = Object.entries(tally).sort((a, b) => b[1].w - a[1].w)[0];
      return best && best[1].n >= 2 ? best[0] : null;
    };
    if (!opts.force && cls.vertical && !cls.subvertical) {
      const pool = this.companies.map((c, i) => i).filter((i) => this.companies[i].v === cls.vertical && this.companies[i].sv);
      const k = vote(pool, 0.12, (c) => c.sv);
      if (k) { cls = Object.assign({}, cls, { subvertical: k }); inferred = 'subvertical'; }
    } else if (!opts.force && !cls.vertical) {
      const k = vote(this.companies.map((c, i) => i), 0.22, (c) => c.v + '/' + (c.sv || ''));
      if (k) { const [kv, ksv] = k.split('/'); cls = Object.assign({}, cls, { vertical: kv, subvertical: ksv || null, score: 2 }); inferred = 'vertical'; }
    }
    const v = cls.vertical, sv = cls.subvertical;
    const related = v ? V[v].related : [];
    const scored = this.companies.map((c, i) => {
      const text = texts[i];
      let tier = 9;
      if (v) {
        if (sv && c.v === v && c.sv === sv) tier = 1;
        else if (cls.second && c.v === cls.second.v && c.sv === cls.second.sv) tier = 1;
        else if (c.v === v) tier = 2;
        else if (related.includes(c.v)) tier = 3;
      } else if (text >= 0.2) tier = 2; // unclassified idea: fall back to wording only, conservatively
      const model = (flags.hardware === c.flags.hardware ? 0.06 : 0) + (flags.b2b && c.flags.b2b ? 0.04 : 0) + (flags.b2c && c.flags.b2c ? 0.04 : 0);
      return { c, text, tier, score: ({ 1: 1, 2: 0.5, 3: 0 }[tier] ?? -1) + 0.9 * text + model };
    });
    const closest = scored.filter((x) => x.tier <= 2).sort((a, b) => b.score - a.score).slice(0, 14);
    const adjacent = scored.filter((x) => x.tier === 3 && x.text >= 0.18).sort((a, b) => b.text - a.text).slice(0, 6);
    // evidence weight: niche matches count fully, same-vertical ones partly
    const maxText = Math.max(0.15, ...closest.map((x) => x.text));
    const comps = closest.map((x) => ({
      c: x.c, tier: x.tier, text: x.text,
      sim: x.tier === 1 ? 0.6 + 0.4 * Math.min(1, x.text / maxText) : 0.18 + 0.3 * Math.min(1, x.text / maxText),
    }));

    // moonshot score from the space itself, not from single words
    const raw = ' ' + (idea || '').toLowerCase() + ' ';
    const moonHits = MOON_WORDS.filter((w) => raw.includes(w));
    let moon = v ? Math.round(100 * (sv ? SV[v + '/' + sv].moon : V[v].moon * 0.85)) : 10;
    if (v && cls.score < 3) moon = Math.round(moon * 0.75);
    moon = Math.min(100, moon + moonHits.length * 12);

    return {
      vertical: v, subvertical: sv, second: cls.second, forced: !!cls.forced, inferred, anchors: anchors.map((a) => a.name),
      spaceLabel: v ? label(v, sv) : 'Unclassified', verticalLabel: v ? V[v].label : 'Unclassified',
      sector: v ? V[v].sector : 'saas_b2b', confidence: cls.score, terms: cls.terms, flags, alternatives: cls.subs,
      comps, adjacent, nicheCount: closest.filter((x) => x.tier === 1).length, verticalCount: closest.filter((x) => x.tier === 2).length,
      moonScore: moon, moonHits, enabler: ENABLER_BY_SUB[sv] || null,
      // kept for older callers
      sectorRanked: cls.rankedV.slice(0, 3), tokens: tokenize(idea),
    };
  }
}
