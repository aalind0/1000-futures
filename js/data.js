import { Matcher, label, VERTICALS } from './matcher.js';
import { initThemeToggle } from './theme.js';
import { STAGES, STAGE_LABEL } from './engine.js';
import { resolveDeals, TYPE_LABEL } from './investors.js';
import { CONFIG } from './config.js';

const $ = (s) => document.querySelector(s);
function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'href') { if (/^(https?:\/\/|mailto:)/.test(v) || v.startsWith('#')) n.setAttribute('href', v); }
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid instanceof Node ? kid : String(kid));
  return n;
}
const money = (x) => (x === null || x === undefined || isNaN(x)) ? '—' : x >= 1e9 ? '$' + (x / 1e9).toFixed(1) + 'B' : x >= 1e6 ? '$' + (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? '$' + Math.round(x / 1e3) + 'K' : '$' + x;
const pct = (x) => (x === null || x === undefined) ? '—' : (x * 100).toFixed(1).replace(/\.0$/, '') + '%';
const REGION_NAME = { north_america: 'US & Canada', europe: 'Continental Europe', uk: 'United Kingdom', israel: 'Israel', india: 'India', china: 'China', east_asia: 'Japan & Korea', sea: 'Southeast Asia', latam: 'Latin America', mena: 'Middle East & N. Africa', africa: 'Sub-Saharan Africa', oceania: 'Australia & NZ', global: 'Global' };
const OUT = { dead: 'Died', acquihire: 'Fire sale', acquired: 'Acquired', ipo: 'IPO', private_unicorn: 'Unicorn', active: 'Active' };
const flag = (cc) => (cc && cc.length === 2) ? cc.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : '';

// turn "text (https://…)" or a bare URL into a link + text
function srcNode(s) {
  if (!s) return h('span', { class: 'cell-src' }, 'no source');
  const m = String(s).match(/https?:\/\/[^\s)]+/);
  const assumed = /^(assumption|derived)/i.test(s);
  return h('span', { class: 'cell-src' }, assumed ? h('span', { class: 'flagged' }, s.split(':')[0] + ' · ') : '', m ? h('a', { href: m[0], target: '_blank', rel: 'noopener' }, new URL(m[0]).hostname.replace(/^www\./, '')) : '', ' ', String(s).replace(m ? m[0] : '', '').replace(/\(\s*\)/g, '').replace(/^(assumption|derived):?/i, '').slice(0, 220));
}

async function init() {
  initThemeToggle();
  for (const el of document.querySelectorAll('[data-fix]')) { const href = CONFIG.correctionHref(el.dataset.fix); if (href) { el.href = href; el.closest('[data-fix-wrap]').hidden = false; } }
  const B = await (await fetch('data/bundle.json')).json();
  new Matcher(B.companies, B.labels || {}); // labels every company with vertical / sub-vertical
  const M = B.meta;
  const k = (n, l) => h('div', { class: 'kpi' }, h('b', {}, n), h('span', {}, l));
  $('#kpis').append(
    k(M.companies, 'real companies'), k(M.countries, 'countries'), k(M.outcomes.dead || 0, 'documented deaths'),
    k(Object.keys(B.twins).length, 'twin stories'), k((B.deals || []).length, 'funding rounds'), k(Object.keys(B.investors || {}).length, 'investors'),
    k(M.ladderSources, 'base-rate sources'), k(M.built.slice(0, 10), 'last built'));

  // ladder
  const regions = Object.keys(B.ladders).filter((r) => !(M.proxiedRegions || []).includes(r));
  $('#ladderSub').textContent = `At each round a universe raises the next one, gets acquired, shuts down, or stalls. Sourced regions: ${regions.map((r) => REGION_NAME[r] || r).join(', ')}. Still using these numbers as a stand-in: ${(M.proxiedRegions || []).map((r) => REGION_NAME[r]).join(', ') || 'none'}. Era adjustments applied for ${'2026'}: ${(M.eraApplied || []).join(', ') || 'none'}.`;
  for (const r of regions.filter((x) => x !== 'global')) {
    const L = B.ladders[r], S = B.ladderSources[r] || {};
    const t = h('table', { class: 't' }, h('tr', {}, ['Stage', 'Raise next', 'Acquired', 'Shut down', 'Months to next', 'Median post-money', 'Median round'].map((x) => h('th', {}, x))));
    for (const st of STAGES) {
      const l = L[st] || {}, s = S[st] || {};
      const cell = (v, key, f) => h('td', {}, h('span', { class: 'num' }, f(v)), srcNode(s[key]));
      t.append(h('tr', {}, h('td', {}, h('b', {}, STAGE_LABEL[st])),
        cell(l.pNext, 'pNext', pct), cell(l.pAcq, 'pAcq', pct), cell(l.pDead, 'pDead', pct),
        cell(l.mNext, 'mNext', (v) => (v ? v.toFixed(1) : '—')), cell(l.post, 'post', money), cell(l.round, 'round', money)));
      if (st === 'growth' && l.pIpo) t.append(h('tr', {}, h('td', {}, 'Growth → IPO'), h('td', { colspan: 6 }, h('span', { class: 'num' }, pct(l.pIpo)), srcNode(s.pIpo))));
    }
    $('#ladderTbl').append(h('p', { class: 'eyebrow', style: 'margin-top:8px' }, REGION_NAME[r] || r), t);
  }

  // model choices
  const mb = $('#modelBox');
  const a = (title, text) => mb.append(h('p', { class: 'assume' }, h('b', {}, title + ': '), text));
  for (const [key, note] of Object.entries(B.model._notes || {})) a('Model · ' + key, note);
  for (const [key, note] of Object.entries(B.exits._notes || {})) a('Exits · ' + key, note);
  a('Funding winters', B.winter._note);
  a('Founder experience', B.founderMods._note + ' ' + B.founderMods._source);
  a('Moonshot mode', B.moonshotModel._note);
  a('Take-home (cap table)', 'Each round dilutes all existing holders by its size ÷ post-money, using the round size and valuation the simulation drew (medians reproduce Carta 2026 dilution: seed ~19%, Series A ~19%, B ~13%, C ~10%; see Raw base-rate tables › dilution). Assumption: option pool topped up to 10% at the first priced round and by 5% at Series A, pre-money. Assumption: every round has a standard 1x non-participating liquidation preference, all series pari passu; at a sale each series takes the better of its money back or converting, and founders get the rest. At an IPO preferred converts. Founders split equally. Excludes salaries, taxes, secondary sales and retention packages; still-private companies are paper value only.');
  for (const [sec, notes] of Object.entries(B.sectorNotes || {})) a('Sector · ' + sec, notes.map(([kk, v, s]) => `${kk} ×${v} (${s || 'no source'})`).join('; '));

  // causes
  const ct = h('table', { class: 't' }, h('tr', {}, ['Cause', 'Base weight', 'What it means', 'Source'].map((x) => h('th', {}, x))));
  Object.entries(B.causes).sort((x, y) => y[1].weight - x[1].weight).forEach(([id, c]) => {
    ct.append(h('tr', {}, h('td', {}, h('b', {}, c.label)), h('td', { class: 'num' }, c.weight), h('td', {}, c.desc),
      h('td', {}, c.src ? h('a', { href: c.src, target: '_blank', rel: 'noopener', class: 'srcs' }, new URL(c.src).hostname) : '', h('div', { class: /pending|derived/.test(c.note) ? 'flagged' : 'srcs' }, c.note))));
  });
  $('#causeTbl').append(ct);

  // companies
  const fill = (sel, label, opts) => { sel.append(h('option', { value: '' }, label)); opts.forEach(([v, t]) => sel.append(h('option', { value: v }, t))); };
  fill($('#fOut'), 'All outcomes', Object.entries(OUT));
  fill($('#fReg'), 'All regions', Object.entries(REGION_NAME).filter(([r]) => r !== 'global'));
  fill($('#fSec'), 'All spaces', VERTICALS.map((v) => [v.id, v.label]));
  let sortKey = 'n', sortDir = 1, open = null;
  const cols = [['n', 'Company'], ['cc', 'Country'], ['v', 'Space'], ['f', 'Founded'], ['e', 'Ended'], ['out', 'Outcome'], ['raised', 'Raised'], ['causes', 'Why it died / drivers']];
  const renderCos = () => {
    const q = $('#q').value.toLowerCase().trim(), fo = $('#fOut').value, fr = $('#fReg').value, fs = $('#fSec').value;
    const rows = B.companies.filter((c) => (!fo || c.out === fo) && (!fr || c.r === fr) && (!fs || c.v === fs) &&
      (!q || [c.n, c.o, c.story, (c.t || []).join(' '), c.cc].join(' ').toLowerCase().includes(q)))
      .sort((x, y) => { const a1 = x[sortKey] ?? '', b1 = y[sortKey] ?? ''; return (a1 > b1 ? 1 : a1 < b1 ? -1 : 0) * sortDir; });
    const t = $('#coTbl'); t.innerHTML = '';
    t.append(h('tr', {}, cols.map(([kk, l]) => h('th', { onclick: () => { sortDir = sortKey === kk ? -sortDir : 1; sortKey = kk; renderCos(); } }, l + (sortKey === kk ? (sortDir > 0 ? ' ↑' : ' ↓') : '')))));
    for (const c of rows) {
      t.append(h('tr', { class: 'co', onclick: () => { open = open === c.id ? null : c.id; renderCos(); } },
        h('td', {}, h('b', {}, c.n), h('div', { class: 'srcs' }, c.o)), h('td', {}, `${flag(c.cc)} ${c.cc}`), h('td', {}, label(c.v, c.sv), c.labelSrc === 'manual' ? h('div', { class: 'srcs' }, 'label reviewed') : ''),
        h('td', { class: 'num' }, c.f || ''), h('td', { class: 'num' }, c.e || ''), h('td', {}, h('span', { class: `badge b-${c.out}` }, OUT[c.out] || c.out)),
        h('td', { class: 'num' }, money(c.raised)), h('td', { class: 'srcs' }, (c.causes.length ? c.causes.map((x) => (B.causes[x] || { label: x }).label) : (c.drivers || []).map((x) => String(x).replace(/_/g, ' '))).join(', '))));
      if (open === c.id) {
        t.append(h('tr', { class: 'detail' }, h('td', { colspan: cols.length },
          h('p', {}, c.story), (c.near || []).map((n) => h('p', {}, h('b', {}, `Near death ${n.year}: `), n.what)),
          c.rounds && c.rounds.length ? h('p', { class: 'num' }, c.rounds.map((r) => `${STAGE_LABEL[r.stage] || r.stage} ${r.year || ''}: ${money(r.amount_usd)}${r.post_money_usd ? ' @ ' + money(r.post_money_usd) : ''}`).join('  ·  ')) : '',
          h('div', { class: 'srcs' }, `Confidence: ${c.conf}. Sources: `, (c.src || []).map((u, i) => [i ? ' · ' : '', h('a', { href: u, target: '_blank', rel: 'noopener' }, u)])))));
      }
    }
    if (!rows.length) t.append(h('tr', {}, h('td', { colspan: cols.length }, 'No companies match.')));
  };
  ['#q', '#fOut', '#fReg', '#fSec'].forEach((s) => $(s).addEventListener('input', renderCos));
  renderCos();

  // investors
  const deals = resolveDeals(B);
  const inv = new Map();
  for (const d of deals) {
    for (const [ids, role] of [[d.L, 'led'], [d.I, 'joined']]) {
      for (const id of ids) {
        const x = inv.get(id) || inv.set(id, { id, n: (B.investors[id] || {}).n || id, t: (B.investors[id] || {}).t, deals: [], led: 0, last: 0, vs: new Map() }).get(id);
        x.deals.push({ d, role });
        if (role === 'led') x.led++;
        if (d.y > x.last) x.last = d.y;
        if (d.v) x.vs.set(d.v, (x.vs.get(d.v) || 0) + 1);
      }
    }
  }
  const invList = [...inv.values()].sort((a, b) => b.deals.length - a.deals.length || a.n.localeCompare(b.n));
  $('#invSub').textContent = `${invList.length} investors named in ${deals.length} sourced funding rounds, merged across spellings (a16z and Andreessen Horowitz are one firm). Tap a row for its rounds and sources. This powers "Who funds this". It's a sample of public announcements, not every round each firm has done.`;
  fill($('#iSec'), 'All spaces', VERTICALS.map((v) => [v.id, v.label]));
  let openInv = null;
  const renderInv = () => {
    const q = $('#iq').value.toLowerCase().trim(), fs = $('#iSec').value;
    const rows = invList.filter((x) => (!fs || x.vs.has(fs)) && (!q || [x.n, ...((B.investors[x.id] || {}).a || []), ...x.deals.map(({ d }) => d.n)].join(' ').toLowerCase().includes(q)));
    const t = $('#invTbl'); t.innerHTML = '';
    t.append(h('tr', {}, ['Investor', 'Type', 'Rounds', 'Led', 'Most active in', 'Most recent'].map((x) => h('th', {}, x))));
    for (const x of rows.slice(0, 300)) {
      const top = [...x.vs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${(VERTICALS.find((z) => z.id === v) || { label: v }).label} (${n})`).join(', ');
      t.append(h('tr', { class: 'co', onclick: () => { openInv = openInv === x.id ? null : x.id; renderInv(); } },
        h('td', {}, h('b', {}, x.n)), h('td', { class: 'srcs' }, TYPE_LABEL[x.t] || ''), h('td', { class: 'num' }, x.deals.length), h('td', { class: 'num' }, x.led),
        h('td', { class: 'srcs' }, top), h('td', { class: 'num' }, x.last || '')));
      if (openInv === x.id) {
        t.append(h('tr', { class: 'detail' }, h('td', { colspan: 6 },
          x.deals.slice().sort((a, b) => (b.d.y || 0) - (a.d.y || 0)).map(({ d, role }) => h('div', { class: 'srcs', style: 'margin-bottom:4px' },
            h('b', {}, d.n), ` · ${flag(d.cc)} ${STAGE_LABEL[d.st]} ${d.y || ''}${d.amt ? ' · ' + money(d.amt) : ''} · ${role} · ${d.v ? label(d.v, d.sv) : ''} · `,
            d.src ? h('a', { href: d.src, target: '_blank', rel: 'noopener' }, new URL(d.src).hostname.replace(/^www\./, '')) : (d.company && d.company.src && d.company.src[0] ? h('a', { href: d.company.src[0], target: '_blank', rel: 'noopener' }, 'company sources') : 'no source'))))));
      }
    }
    if (rows.length > 300) t.append(h('tr', {}, h('td', { colspan: 6, class: 'srcs' }, `${rows.length - 300} more. Search to narrow it down.`)));
    if (!rows.length) t.append(h('tr', {}, h('td', { colspan: 6 }, 'No investors match.')));
  };
  ['#iq', '#iSec'].forEach((s) => $(s).addEventListener('input', renderInv));
  renderInv();

  // twins
  const byId = Object.fromEntries(B.companies.map((c) => [c.id, c]));
  for (const g of Object.values(B.twins)) {
    $('#twinBox').append(h('div', { class: 'twin' }, h('h4', {}, g.idea || g.id), g.lesson ? h('p', {}, g.lesson) : '',
      h('div', { class: 'echoes' }, g.members.map((m) => byId[m]).filter(Boolean).map((c) => h('span', { class: 'co-chip' }, `${flag(c.cc)} ${c.n}`, h('span', { class: 'o' }, OUT[c.out]))))));
  }

  // moonshots
  const mo = B.moonshots, box = $('#moonBox');
  if (mo.tooEarly.length) {
    const t = h('table', { class: 't' }, h('tr', {}, ['Too early', 'Won later', 'Gap', 'What changed', 'Status'].map((x) => h('th', {}, x))));
    mo.tooEarly.forEach((p) => t.append(h('tr', {}, h('td', {}, p.early_name || p.early_id), h('td', {}, p.later_name || p.later_id), h('td', { class: 'num' }, p.gap_years ? p.gap_years + ' yrs' : ''), h('td', {}, p.what_changed || ''),
      h('td', {}, p.verified === false ? h('span', { class: 'flagged' }, 'unverified') : (p.sources || []).slice(0, 2).map((u) => h('a', { href: u, target: '_blank', rel: 'noopener', class: 'srcs' }, 'source '))))));
    box.append(h('p', { class: 'eyebrow' }, 'Too-early pairs'), h('div', { class: 'tbl-wrap' }, t));
  }
  if (mo.anti.length) {
    const t = h('table', { class: 't' }, h('tr', {}, ['Investor', 'Passed on', 'Year', 'Why', 'Source'].map((x) => h('th', {}, x))));
    mo.anti.forEach((x) => t.append(h('tr', {}, h('td', {}, x.investor), h('td', {}, h('b', {}, x.company)), h('td', { class: 'num' }, x.year || ''), h('td', {}, x.why_passed || ''),
      h('td', {}, x.source ? h('a', { href: x.source, target: '_blank', rel: 'noopener', class: 'srcs' }, new URL(x.source).hostname) : h('span', { class: 'flagged' }, 'unverified')))));
    box.append(h('p', { class: 'eyebrow', style: 'margin-top:20px' }, 'Anti-portfolio: famous passes'), h('div', { class: 'tbl-wrap' }, t));
  }
  if (!mo.curves.length) box.append(h('p', { class: 'flagged', style: 'margin-top:16px' }, 'Enabling cost curves (launch cost, battery $/kWh, sequencing cost, token prices…) are not loaded yet.'));

  // raw tables
  const raw = B.baseRates || {};
  for (const [key, rows] of Object.entries(raw)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((x) => x !== 'source' && x !== 'note');
    const t = h('table', { class: 't' }, h('tr', {}, [...keys, 'source / note'].map((x) => h('th', {}, x))));
    rows.forEach((r) => t.append(h('tr', {}, keys.map((kk) => h('td', { class: typeof r[kk] === 'number' ? 'num' : '' }, r[kk] === null || r[kk] === undefined ? '' : String(r[kk]))), h('td', {}, srcNode(r.source || r.note)))));
    $('#rawBox').append(h('p', { class: 'eyebrow', style: 'margin-top:18px' }, key.replace(/_/g, ' ')), h('div', { class: 'tbl-wrap', style: 'max-height:420px' }, t));
  }

  // gaps
  const gaps = [];
  if ((M.proxiedRegions || []).length) gaps.push(`Regional base rates are not sourced yet for ${M.proxiedRegions.length} regions (${M.proxiedRegions.map((r) => REGION_NAME[r]).join(', ')}); they use the US ladder, and market differences come only from real companies in each market.`);
  if (!mo.curves.length) gaps.push('Enabling cost curves for the "Why now?" panel are not loaded yet.');
  if (!(mo.deeptech || []).length) gaps.push('Deep-tech base rates are missing, so moonshot mode runs on documented assumptions (see Modelling choices).');
  const pending = Object.values(B.causes).filter((c) => /pending/.test(c.note)).length;
  if (pending) gaps.push(`${pending} failure-cause weights come from the widely cited CB Insights post-mortem study and are pending re-verification against the report itself.`);
  const unv = mo.tooEarly.filter((p) => p.verified === false).length;
  if (unv) gaps.push(`${unv} too-early pairs are unverified.`);
  gaps.push('Curated companies over-represent famous wins and famous deaths; the simulator corrects for this when it uses them as evidence.');
  {
    const per = new Map(); for (const d of deals) if (d.v && d.sv) per.set(d.v + '/' + d.sv, (per.get(d.v + '/' + d.sv) || 0) + 1);
    const allNiches = VERTICALS.flatMap((v) => v.subs.map((s) => v.id + '/' + s.id));
    const thin = allNiches.filter((k) => (per.get(k) || 0) < 3).length;
    gaps.push(`"Who funds this" draws on ${deals.length} sourced rounds, mostly announced in 2025–26 and collected from news snippets. ${thin} of ${allNiches.length} niches have fewer than three sourced rounds, so their lists fall back to the wider space.`);
  }
  gaps.forEach((g) => $('#gapList').append(h('li', {}, g)));
}
init();
