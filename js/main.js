import { simulate, compareRegions, whatIf, STAGES, STAGE_LABEL, START_YEAR, HORIZON, N_UNIVERSES } from './engine.js';
import { Matcher, label, VERTICALS } from './matcher.js';
import { V } from './taxonomy.js';
import { initThemeToggle, isDark } from './theme.js';
import { payoutStats, winnersReport, whereNow, obituaryUniverse, bestLifeUniverse, quipFor, startupName, PAYOUT_BUCKETS, versionReport, neighbourNiches } from './insights.js';
import { Multiverse, drawGrid } from './viz.js';
import { drawCard, shareText } from './share.js';
import { CONFIG } from './config.js';
import { resolveDeals, fundersFor, whyLine, fundersCSV, stageWeight, TYPE_LABEL } from './investors.js';

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'href') { if (/^(https?:\/\/|mailto:)/.test(v) || v.startsWith('#') || v.endsWith('.html')) n.setAttribute('href', v); }
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}
const money = (x) => {
  if (x === null || x === undefined || isNaN(x)) return '—';
  if (x >= 1e9) return '$' + (x / 1e9).toFixed(x >= 1e10 ? 0 : 1) + 'B';
  if (x >= 1e6) return '$' + (x / 1e6).toFixed(x >= 1e8 ? 0 : 1) + 'M';
  if (x >= 1e3) return '$' + Math.round(x / 1e3) + 'K';
  return '$' + Math.round(x);
};
const yearOf = (t) => START_YEAR + Math.floor(t / 12);
const flag = (cc) => (cc && cc.length === 2) ? cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : '🌐';
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2200); }
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch (e) { toast('Copy failed — select and copy manually'); } }

export const REGION_NAME = {
  north_america: 'US & Canada', europe: 'Continental Europe', uk: 'United Kingdom', israel: 'Israel', india: 'India',
  china: 'China', east_asia: 'Japan & Korea', sea: 'Southeast Asia', latam: 'Latin America', mena: 'Middle East & N. Africa',
  africa: 'Sub-Saharan Africa', oceania: 'Australia & NZ',
};
const COUNTRIES = [
  ['US', 'United States', 'north_america'], ['CA', 'Canada', 'north_america'], ['GB', 'United Kingdom', 'uk'],
  ['ES', 'Spain', 'europe'], ['DE', 'Germany', 'europe'], ['FR', 'France', 'europe'], ['NL', 'Netherlands', 'europe'],
  ['SE', 'Sweden', 'europe'], ['IT', 'Italy', 'europe'], ['PT', 'Portugal', 'europe'], ['IE', 'Ireland', 'europe'],
  ['PL', 'Poland', 'europe'], ['CH', 'Switzerland', 'europe'], ['EE', 'Estonia', 'europe'], ['TR', 'Turkey', 'europe'],
  ['IL', 'Israel', 'israel'], ['IN', 'India', 'india'], ['CN', 'China', 'china'], ['JP', 'Japan', 'east_asia'],
  ['KR', 'South Korea', 'east_asia'], ['SG', 'Singapore', 'sea'], ['ID', 'Indonesia', 'sea'], ['VN', 'Vietnam', 'sea'],
  ['TH', 'Thailand', 'sea'], ['PH', 'Philippines', 'sea'], ['MY', 'Malaysia', 'sea'], ['BR', 'Brazil', 'latam'],
  ['MX', 'Mexico', 'latam'], ['CO', 'Colombia', 'latam'], ['AR', 'Argentina', 'latam'], ['CL', 'Chile', 'latam'],
  ['AE', 'United Arab Emirates', 'mena'], ['SA', 'Saudi Arabia', 'mena'], ['EG', 'Egypt', 'mena'],
  ['NG', 'Nigeria', 'africa'], ['KE', 'Kenya', 'africa'], ['ZA', 'South Africa', 'africa'],
  ['AU', 'Australia', 'oceania'], ['NZ', 'New Zealand', 'oceania'],
];
const COUNTRY = Object.fromEntries(COUNTRIES.map(([c, n, r]) => [c, { code: c, name: n, region: r }]));

const PRESETS = [
  { label: 'Airbnb', year: 2008, idea: 'Rent an air mattress in a stranger’s apartment when the hotels are sold out', market: 'US', stage: 'pre_seed' },
  { label: 'SpaceX', year: 2002, idea: 'A private company building reusable rockets to make humanity multiplanetary', market: 'US', stage: 'pre_seed', moon: true },
  { label: 'Homejoy', year: 2012, idea: 'Book a vetted home cleaner online in 60 seconds', market: 'US', stage: 'seed' },
  { label: 'Glovo', year: 2015, idea: 'An app that delivers anything in your city in under 30 minutes', market: 'ES', stage: 'pre_seed' },
  { label: 'Webvan', year: 1999, idea: 'Order groceries online and get them delivered to your door the same day', market: 'US', stage: 'seed' },
  { label: 'Quibi', year: 2018, idea: 'Premium 10-minute shows from Hollywood studios, made only for phones', market: 'US', stage: 'A' },
  { label: 'Juicero', year: 2016, idea: 'A Wi-Fi connected juicer that presses subscription juice packs', market: 'US', stage: 'seed' },
  { label: 'Zepto', year: 2021, idea: 'Groceries delivered in 10 minutes from dark stores', market: 'IN', stage: 'seed' },
];

// ---------- state ----------
const S = { bundle: null, matcher: null, stage: 'pre_seed', moonTouched: false, run: null, viz: null, speed: 1, card: 'story', cof: 2, salary: 150000 };

function showScreen(id) {
  for (const s of ['pitch', 'reading', 'sim']) $('#' + s).hidden = s !== id;
  if (id !== 'sim') $('#results').hidden = true;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------- init ----------
// the 1,000-dot grid beside the verdict (re-drawn when the theme changes)
function redrawGrid() {
  if (!S.run || !S.run.result) return;
  const gc = $('#gridCanvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  gc.width = 480 * dpr; gc.height = 300 * dpr;
  const gctx = gc.getContext('2d'); gctx.setTransform(dpr, 0, 0, dpr, 0, 0); gctx.clearRect(0, 0, 480, 300);
  drawGrid(gctx, 0, 0, 480, 300, S.run.result.universes, { cols: 40, light: !isDark() });
}

async function init() {
  for (const el of document.querySelectorAll('[data-fix]')) { const href = CONFIG.correctionHref(el.dataset.fix); if (href) { el.href = href; el.closest('[data-fix-wrap]').hidden = false; } }
  initThemeToggle(() => {
    if (S.viz) S.viz.draw(); // repaint the simulation in the new palette, even when paused or finished
    if (!$('#results').hidden) redrawGrid();
  });
  const res = await fetch('data/bundle.json');
  S.bundle = await res.json();
  S.matcher = new Matcher(S.bundle.companies, S.bundle.labels || {});
  S.deals = resolveDeals(S.bundle); // after the matcher, so known companies carry its labels
  S.byId = Object.fromEntries(S.bundle.companies.map((c) => [c.id, c]));

  const sel = $('#market');
  const groups = {};
  for (const c of COUNTRIES) (groups[c[2]] = groups[c[2]] || []).push(c);
  for (const [r, list] of Object.entries(groups)) {
    const og = h('optgroup', { label: REGION_NAME[r] });
    list.forEach(([code, name]) => og.append(h('option', { value: code }, `${flag(code)}  ${name}`)));
    sel.append(og);
  }
  sel.value = 'US';

  const chips = $('#presetChips');
  PRESETS.forEach((p) => chips.append(h('button', {
    class: 'chip', type: 'button', onclick: () => {
      $('#idea').value = p.idea; $('#market').value = p.market; setStage(p.stage);
      $('#moon').checked = !!p.moon; S.moonTouched = false; updateCount(); // presets set the switch but don't lock it
      start({ presetLabel: `${p.label}, ${p.year}` });
    },
  }, h('b', {}, p.label), ` ${p.year}`)));

  $('#stageSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setStage(b.dataset.v); });
  $('#speedSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.speed = +b.dataset.v; if (S.viz) S.viz.speed = S.speed;
    [...$('#speedSeg').children].forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#idea').addEventListener('input', () => { updateCount(); detectMoon(); });
  // Enter runs it from anywhere on the pitch screen (idea box, name, dropdowns, or nothing focused);
  // Shift+Enter still makes a new line, and nothing fires while an input method is composing text
  const enterRuns = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    if ($('#pitch').hidden || document.querySelector('dialog[open]')) return;
    const t = e.target;
    if (t.tagName === 'BUTTON' && t.closest('#presetChips, .seg')) return; // Enter presses that button instead
    e.preventDefault();
    $('#pitchForm').requestSubmit();
  };
  $('#pitchForm').addEventListener('keydown', enterRuns);
  document.addEventListener('keydown', (e) => { if (e.target === document.body) enterRuns(e); });
  $('#moon').addEventListener('change', () => { S.moonTouched = true; });
  $('#pitchForm').addEventListener('submit', (e) => { e.preventDefault(); start(); });
  $('#btnPause').addEventListener('click', togglePause);
  $('#btnSkip').addEventListener('click', () => S.viz && S.viz.skip());
  $('#scrub').addEventListener('input', (e) => {
    if (!S.viz || S.viz.phase === 'reveal') return;
    S.viz.seek(+e.target.value);
    if (S.viz.phase !== 'done') $('#btnPause').textContent = 'Play';
  });
  document.addEventListener('keydown', (e) => {
    if ($('#sim').hidden || /input|textarea|select/i.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 's' || e.key === 'S') S.viz && S.viz.skip();
    else if (['1', '2', '4'].includes(e.key)) $(`#speedSeg button[data-v="${e.key}"]`).click();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (!S.viz || S.viz.phase === 'reveal') return;
      e.preventDefault();
      S.viz.seek(S.viz.t + (e.key === 'ArrowRight' ? 6 : -6));
      if (S.viz.phase !== 'done') $('#btnPause').textContent = 'Play';
    }
  });
  $('#btnReplay').addEventListener('click', () => replay());
  $('#btnNew').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    // a new idea starts clean: moonshot auto-detect back on, no hand-picked space
    S.moonTouched = false; S.force = null; $('#moon').checked = false; $('#startupName').value = '';
    $('#idea').value = ''; updateCount(); detectMoon();
    showScreen('pitch'); $('#idea').focus();
  });
  $('#btnShare').addEventListener('click', () => openShare('story'));
  $('#btnShare2').addEventListener('click', () => openShare('story'));
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', () => openShare(b.dataset.share)));
  $('#cofSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !S.run) return;
    S.cof = +b.dataset.v; [...$('#cofSeg').children].forEach((x) => x.classList.toggle('on', x === b));
    renderTake(); renderBecame(); renderLives(); renderQuestions();
  });
  let salTimer;
  $('#salary').addEventListener('input', () => { clearTimeout(salTimer); salTimer = setTimeout(() => { S.salary = Math.max(0, +$('#salary').value || 0); if (S.run) renderTake(); }, 200); });
  $('#btnChallenge').addEventListener('click', challenge);
  $('#dlgClose').addEventListener('click', () => $('#dlg').close());
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  for (const d of document.querySelectorAll('dialog')) d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $('#cardSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.card = b.dataset.v; [...$('#cardSeg').children].forEach((x) => x.classList.toggle('on', x === b)); renderCard();
  });
  $('#btnDownload').addEventListener('click', downloadCard);
  $('#btnCopyLink').addEventListener('click', () => copy(location.href));
  $('#btnCopyText').addEventListener('click', () => copy($('#shareText').textContent));
  document.querySelector('a[data-scroll]').addEventListener('click', (e) => {
    if ($('#results').hidden) { e.preventDefault(); toast('Run a simulation first, then the method appears under your results.'); }
  });

  // shared link → replay the exact multiverse
  const q = new URLSearchParams(location.search);
  if (q.get('i')) {
    $('#idea').value = q.get('i').slice(0, 220);
    if (COUNTRY[q.get('m')]) $('#market').value = q.get('m');
    if (STAGES.includes(q.get('st'))) setStage(q.get('st'));
    if (['first', 'repeat_win', 'repeat_fail'].includes(q.get('f'))) $('#founders').value = q.get('f');
    $('#moon').checked = q.get('mo') === '1'; S.moonTouched = false;
    if (q.get('sp')) S.force = { idea: $('#idea').value.trim().replace(/\s+/g, ' '), space: q.get('sp') };
    if (q.get('nm')) $('#startupName').value = q.get('nm').slice(0, 40);
    updateCount();
    start({ fromLink: true });
  }
}

function setStage(v) {
  S.stage = v;
  [...$('#stageSeg').children].forEach((b) => b.classList.toggle('on', b.dataset.v === v));
}
function updateCount() { $('#ideaCount').textContent = `${$('#idea').value.length}/220`; }

let moonTimer;
function detectMoon() {
  clearTimeout(moonTimer);
  moonTimer = setTimeout(() => {
    const a = S.matcher.analyze($('#idea').value);
    const hint = $('#moonHint');
    if (a.moonScore >= 55) {
      hint.textContent = `looks like a moonshot (${a.moonScore}/100)`; hint.classList.add('hot');
      if (!S.moonTouched) $('#moon').checked = true;
    } else {
      hint.textContent = 'auto-detects crazy ideas'; hint.classList.remove('hot');
      if (!S.moonTouched) $('#moon').checked = false;
    }
  }, 250);
}

// ---------- run ----------
function readProfile() {
  const market = $('#market').value;
  return {
    idea: $('#idea').value.trim().replace(/\s+/g, ' '),
    market, region: COUNTRY[market].region, stage: S.stage,
    founders: $('#founders').value, moonshot: $('#moon').checked,
    name: $('#startupName').value.trim().slice(0, 40),
  };
}

function setLink(p) {
  const o = { i: p.idea, m: p.market, st: p.stage, f: p.founders, mo: p.moonshot ? '1' : '0' };
  if (S.force && S.force.idea === p.idea) o.sp = S.force.space;
  if (p.name) o.nm = p.name;
  history.replaceState(null, '', '?' + new URLSearchParams(o).toString());
}

async function start(opts = {}) {
  const base = readProfile();
  if (base.idea.length < 4) { $('#idea').focus(); toast('Describe your idea in a line first'); return; }
  // a space the user picked by hand sticks to that exact idea only
  if (S.force && S.force.idea !== base.idea) S.force = null;
  const analysis = S.matcher.analyze(base.idea, { force: S.force ? S.force.space : null });
  const profile = Object.assign({}, base, {
    sector: analysis.sector, vertical: analysis.vertical, subvertical: analysis.subvertical,
    related: analysis.vertical ? V[analysis.vertical].related : [], hardware: analysis.flags.hardware, comps: analysis.comps,
  });
  setLink(base);
  const result = simulate(profile, S.bundle);
  S.run = { profile, analysis, result, opts };
  if (!opts.skipReading) {
    showScreen('reading');
    await reading(profile, analysis, result, opts);
  }
  runSim();
}

function reading(profile, analysis, result, opts) {
  $('#readIdea').textContent = `“${profile.idea}”`;
  const ol = $('#readLines'); ol.innerHTML = '';
  const comps = analysis.comps.slice(0, 5);
  const glyph = (o) => ({ dead: '✝', acquihire: '↘', acquired: '→', ipo: '▲', private_unicorn: '▲', active: '•' }[o] || '•');
  const rec = { dead: 0, sold: 0, won: 0 };
  analysis.comps.forEach(({ c }) => { if (c.out === 'dead') rec.dead++; else if (c.out === 'acquired' || c.out === 'acquihire') rec.sold++; else rec.won++; });
  const ev = result.params.evidence;
  const c = COUNTRY[profile.market];
  const f = analysis.flags;
  const signals = [...analysis.terms.filter((t) => !t.startsWith('(')).slice(0, 4),
    f.hardware ? 'hardware' : 'software', f.b2b ? 'B2B' : f.b2c ? 'consumer' : null, f.lowCost ? 'low-cost' : null,
    ...(analysis.anchors || []).map((n) => `like ${n}`)].filter(Boolean);
  const niche = analysis.nicheCount;
  const lines = [
    ['Space', analysis.spaceLabel + (analysis.forced ? '  (your pick)' : analysis.second ? `  + ${label(analysis.second.v, analysis.second.sv)}` : '')],
    ['Niche signals', signals.join(' · ') || '—'],
    ['Closest companies', comps.length
      ? (niche ? '' : 'none in this exact niche yet · from the wider space: ') + comps.map(({ c }) => `${c.n} ${glyph(c.out)}`).join('  ·  ')
      : 'nothing in this space yet; using base rates only'],
    ['Their record', analysis.comps.length ? `${rec.dead} died · ${rec.sold} sold · ${rec.won} won or still going` : '—'],
    ['Market', `${flag(c.code)} ${c.name} → ${REGION_NAME[profile.region]} base rates`],
    ['Evidence', ev.n ? `similar companies did ${ev.mult >= 1.03 ? 'better' : ev.mult <= 0.97 ? 'worse' : 'about the same'} than average → odds ×${ev.mult.toFixed(2)}` : 'no close comps, odds = base rates'],
    ['Moonshot score', `${analysis.moonScore}/100 · ${profile.moonshot ? 'moonshot physics ON: fatter tails, longer timelines' : 'normal startup physics'}`],
    ['Universes', `spinning up ${N_UNIVERSES.toLocaleString()}…`],
  ];
  if (opts.presetLabel) lines.unshift(['Pitch', `${opts.presetLabel}, launched in ${START_YEAR} instead`]);
  return new Promise((resolve) => {
    let i = 0, done = false;
    const finish = () => { if (done) return; done = true; document.removeEventListener('click', skip); resolve(); };
    const skip = () => { while (i < lines.length) add(); setTimeout(finish, 250); };
    const add = () => {
      const [k, v] = lines[i++];
      ol.append(h('li', {}, h('span', {}, k), h('span', { class: 'v' }, v)));
    };
    setTimeout(() => document.addEventListener('click', skip), 0); // not the click that started the run
    const tick = () => {
      if (done) return;
      if (i < lines.length) { add(); setTimeout(tick, 430); } else setTimeout(finish, 650);
    };
    tick();
  });
}

function runSim() {
  const { profile, result } = S.run;
  showScreen('sim');
  $('#results').hidden = true;
  const c = COUNTRY[profile.market];
  $('#simMeta').textContent = `${flag(c.code)} ${c.name} · ${STAGE_LABEL[profile.stage]} · ${S.run.analysis.spaceLabel}${profile.moonshot ? ' · Moonshot' : ''}`;
  $('#simIdea').textContent = `“${profile.idea}”`;
  $('#ticker').innerHTML = '';
  $('#btnPause').textContent = 'Pause';
  S.tick = { deaths: 0, unis: new Set(), acq: 0, moonIdx: 0, winter: false };
  S.resultsShown = false;
  const W = result.params.sharedWinter;
  const scrub = $('#scrub');
  scrub.value = 0;
  scrub.style.setProperty('--w0', W ? `${(W.start / HORIZON) * 100}%` : '0%');
  scrub.style.setProperty('--w1', W ? `${((W.start + W.len) / HORIZON) * 100}%` : '0%');
  $('#winterFlash').hidden = true;
  updateCounters(0, { alive: N_UNIVERSES, dead: 0, exited: 0, unicorn: 0 });
  if (!S.viz) {
    S.viz = new Multiverse($('#mv'), {
      onTick: (t, cnt, seeking) => updateCounters(t, cnt, seeking),
      onEvent: tickerEvent,
      onRevealStart: () => { $('#btnPause').textContent = 'Pause'; $('#winterFlash').hidden = true; },
      onDone: () => { $('#year').textContent = START_YEAR + 10; $('#btnPause').textContent = 'Replay'; if (!S.resultsShown) { S.resultsShown = true; showResults(); } },
      onHover: hoverTip,
      onSelect: (u) => openUniverse(u),
    });
  }
  S.viz.speed = S.speed;
  requestAnimationFrame(() => { S.viz.load(result); setTimeout(() => S.viz.play(), 300); });
}

function updateCounters(t, cnt, seeking) {
  $('#year').textContent = t >= HORIZON - 0.01 ? START_YEAR + 10 : yearOf(t);
  $('#cAlive').textContent = cnt.alive; $('#cDead').textContent = cnt.dead;
  $('#cExit').textContent = cnt.exited; $('#cUni').textContent = cnt.unicorn;
  if (!seeking || S.viz.phase !== 'done') $('#scrub').value = t;
  const W = S.run.result.params.sharedWinter;
  const inW = !!W && t >= W.start && t <= W.start + W.len;
  const flash = $('#winterFlash');
  if (inW) {
    flash.textContent = window.innerWidth < 640
      ? `❄ Funding winter ${yearOf(W.start)}–${yearOf(W.start + W.len)}`
      : `❄  Funding winter · ${yearOf(W.start)}–${yearOf(W.start + W.len)} · rounds dry up, shutdowns spike`;
    flash.hidden = false;
    if (!S.tick.winter && !seeking) {
      S.tick.winter = true;
      const li = h('li', {}, h('span', { class: 'yr' }, yearOf(W.start)), h('span', { class: 'm' }, '❄ A funding winter hits.'), ' Fewer rounds get done and more companies shut down for about 20 months.');
      $('#ticker').prepend(li);
    }
  } else flash.hidden = true;
}

function togglePause() {
  const v = S.viz;
  if (!v || v.phase === 'reveal') return;
  if (v.phase === 'done') { replay(); return; }
  if (v.playing) { v.pause(); $('#btnPause').textContent = 'Play'; }
  else { v.play(); $('#btnPause').textContent = 'Pause'; }
}
function replay() { $('#results').hidden = true; runSim(); window.scrollTo({ top: 0 }); }

// ---------- ticker ----------
function causeShort(id) { const c = S.bundle.causes[id]; return c ? c.short : id; }
function echoBit(id) {
  const c = S.byId[id];
  if (!c) return null;
  return h('a', { onclick: () => openCompany(c.id) }, `${c.n} (${c.e || c.f || ''})`);
}
function tickerEvent(u, e, silent) {
  if (silent) return;
  const T = S.tick; let li = null;
  const yr = h('span', { class: 'yr' }, yearOf(e.t));
  const id = `#${u.index + 1}`;
  if (e.type === 'dead') {
    T.deaths++;
    if (T.deaths <= 3 || T.deaths % 41 === 0) {
      const echo = e.echo ? echoBit(e.echo) : null;
      li = h('li', {}, yr, h('span', { class: 'd' }, `${id} died at ${STAGE_LABEL[e.stage]}`), ` · ${causeShort(e.cause)}${e.winter ? ' in a funding winter' : ''}`, echo ? [' — like ', echo] : '');
    }
  } else if (e.type === 'raise' && e.post >= 1e9 && !T.unis.has(u.index)) {
    T.unis.add(u.index);
    if (T.unis.size <= 6 || T.unis.size % 5 === 0) li = h('li', {}, yr, h('span', { class: 'g' }, `${id} became a unicorn`), ` at ${STAGE_LABEL[e.stage]} · ${money(e.post)}`);
  } else if (e.type === 'ipo') {
    li = h('li', {}, yr, h('span', { class: 'g' }, `${id} went public`), ` at ${money(e.value)}`);
  } else if (e.type === 'acquired' || e.type === 'acquihire') {
    T.acq++;
    if (T.acq === 1 || e.value >= 1e9 || T.acq % 37 === 0) li = h('li', {}, yr, h('span', { class: 'a' }, `${id} ${e.type === 'acquihire' ? 'sold in a fire sale' : 'was acquired'}`), ` for ${money(e.value)}`);
  } else if (e.type === 'near_death') {
    T.near = (T.near || 0) + 1;
    if (T.near > 3 && T.near % 12 !== 0) return;
    const nd = nearDeathStories();
    const st = nd.length ? nd[T.moonIdx++ % nd.length] : null;
    li = h('li', {}, yr, h('span', { class: 'm' }, `${id} nearly died at ${STAGE_LABEL[e.stage]} and survived`), st ? [' — like ', h('a', { onclick: () => openCompany(st.c.id) }, `${st.c.n}, ${st.nd.year}`)] : '');
  }
  if (li) {
    const tk = $('#ticker');
    tk.prepend(li);
    while (tk.children.length > 8) tk.lastChild.remove();
  }
}

// near-death moments of companies that went on to survive (an echo for a universe that survived one)
function nearDeathStories() {
  if (S._nd) return S._nd;
  const out = [];
  for (const c of S.bundle.companies) {
    if (c.out === 'dead' || c.out === 'acquihire') continue;
    for (const nd of (c.near || [])) out.push({ c, nd });
  }
  return (S._nd = out);
}

function hoverTip(u, x, y) {
  const tip = $('#tip');
  if (!u) { tip.hidden = true; return; }
  const last = u.events[u.events.length - 1];
  let line;
  if (u.outcome === 'dead') line = `Died at ${STAGE_LABEL[last.stage]} in ${yearOf(last.t)} · ${causeShort(u.cause)}`;
  else if (u.outcome === 'ipo') line = `IPO in ${yearOf(last.t)} at ${money(u.exitValue)}`;
  else if (u.outcome === 'acquired' || u.outcome === 'acquihire') line = `${u.outcome === 'acquihire' ? 'Fire sale' : 'Acquired'} in ${yearOf(last.t)} for ${money(u.exitValue)}`;
  else line = `Still going in ${START_YEAR + 10} · ${STAGE_LABEL[u.stageReached]} · ${money(u.post)}`;
  tip.innerHTML = '';
  tip.append(h('b', {}, `Universe #${u.index + 1}`), h('br'), line, h('br'), h('span', { style: 'color:var(--ink-3)' }, 'click for its full life'));
  tip.hidden = false;
  const W = $('.stage-wrap').clientWidth;
  tip.style.left = Math.min(W - 270, x + 14) + 'px';
  tip.style.top = Math.max(8, y - 70) + 'px';
}

// ---------- results ----------
function buckets(universes) {
  const b = { gold: 0, sold: 0, going: 0, dead: 0 };
  for (const u of universes) {
    if (u.everUnicorn) b.gold++;
    else if (u.outcome === 'dead') b.dead++;
    else if (u.outcome === 'acquired' || u.outcome === 'acquihire') b.sold++;
    else b.going++;
  }
  return b;
}

// A one-word personality for the idea: the line people repeat ("my idea is a Cash Furnace")
const ARCHETYPES = {
  moonshot: ['🚀', 'Moonshot', 'Most futures crash. The few that fly go very, very high.'],
  factory: ['🦄', 'Unicorn Factory', 'Far more $1B futures than a typical startup at this stage.'],
  furnace: ['🔥', 'Cash Furnace', 'It dies by burning money: the unit economics never close.'],
  knife: ['⚔️', 'Knife Fight', 'The market is real, and so are the rivals. Most futures lose the fight.'],
  regulator: ['🏛️', 'Regulator Magnet', 'Rules, licences and lawsuits do most of the killing.'],
  early: ['⏳', 'Ahead of Its Time', 'Right idea, wrong decade in too many futures.'],
  ghost: ['👻', 'Nobody Asked', 'Its top killer is no market need. Prove demand before anything else.'],
  graveyard: ['⚰️', 'Graveyard Regular', 'Dies more often than a typical startup at this stage.'],
  exit: ['🤝', 'Exit Artist', 'Gets bought more often than it gets big.'],
  cockroach: ['🪳', 'Cockroach', 'Hard to kill: far more futures are still standing in 2036.'],
  grinder: ['⚙️', 'The Grinder', 'Typical odds. This one lives or dies on execution.'],
};
const CAUSE_ARCHETYPE = { bad_unit_economics: 'furnace', scaled_too_fast: 'furnace', outcompeted: 'knife', regulatory: 'regulator', legal_ip: 'regulator', too_early: 'early', no_market_need: 'ghost' };

function archetypeOf(R, typ) {
  const s = R.result.summary, b = R.buckets;
  const top = Object.entries(s.causes).sort((x, y) => y[1] - x[1])[0];
  const topShare = top ? top[1] / Math.max(1, s.count.dead) : 0;
  let key = 'grinder';
  if (R.profile.moonshot && (s.decacorns >= 2 || b.gold >= typ.unicorns)) key = 'moonshot';
  else if (b.gold >= Math.max(25, typ.unicorns * 2.2)) key = 'factory';
  else if (top && topShare >= (top[0] === 'too_early' || top[0] === 'regulatory' ? 0.2 : 0.28) && CAUSE_ARCHETYPE[top[0]]) key = CAUSE_ARCHETYPE[top[0]];
  else if (b.dead >= typ.dead + 40) key = 'graveyard';
  else if (b.sold >= 80) key = 'exit';
  else if (b.dead <= typ.dead - 40) key = 'cockroach';
  const [em, name, line] = ARCHETYPES[key];
  return { key, em, name, line };
}

function countUp(el, to, ms = 900) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showResults() {
  const R = S.run;
  const { profile, analysis, result } = R;
  const s = result.summary;
  R.buckets = buckets(result.universes);
  const regions = Object.keys(REGION_NAME).filter((r) => S.bundle.ladders[r]);
  R.regions = compareRegions(profile, S.bundle, regions.length ? regions : [profile.region]);

  $('#results').hidden = false;
  countUp($('#vNum'), s.unicorns);
  const b = R.buckets;
  $('#vEyebrow').textContent = `${STAGE_LABEL[profile.stage]} · ${COUNTRY[profile.market].name} · ${START_YEAR}–${START_YEAR + 10}`;
  $('#vLine').textContent = s.unicorns === 1 ? 'future reached a $1B valuation.' : 'futures reached a $1B valuation.';
  const typ = whatIf(Object.assign({}, profile, { sector: '__baseline', comps: [], moonshot: false, founders: 'first' }), S.bundle);
  const vs = typ.unicorns;
  const avg = whatIf(profile, S.bundle).unicorns;
  R.arch = archetypeOf(R, typ); // used on the share card only
  R.typical = vs;
  R.longRun = avg;
  const r1 = (x) => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : Math.round(x));
  const stats = $('#vStats'); stats.innerHTML = '';
  const pill = (color, text) => h('span', { class: 'pill' }, h('i', { style: `background:${color}` }), text);
  stats.append(
    pill('var(--dead)', `${b.dead} died`),
    pill('var(--acq)', `${b.sold} sold`),
    pill('#8fa3bf', `${b.going} still going in ${START_YEAR + 10}`),
    pill('var(--gold)', `long-run average for this idea: ${r1(avg)}/1,000`),
    pill('var(--ink-3)', `typical ${STAGE_LABEL[profile.stage].toLowerCase()} startup: ${r1(vs)}/1,000`),
  );
  if (s.decacorns) stats.append(pill('var(--gold)', `${s.decacorns} became decacorns ($10B+)`));
  const W = result.params.sharedWinter;
  if (W) stats.append(pill('#82b4ff', `❄ funding winter ${yearOf(W.start)}–${yearOf(W.start + W.len)} in this run`));
  if (profile.moonshot && s.nearDeathSurvivors) stats.append(pill('var(--moon)', `${s.nearDeathSurvivors} survived a near-death moment`));
  $('#vFine').textContent = `A model, not a forecast: published base rates for a ${STAGE_LABEL[profile.stage].toLowerCase()} startup in ${REGION_NAME[profile.region]}, adjusted by the real companies above. Seeded, so this link always replays these exact 1,000 futures.`;
  redrawGrid();

  R.name = profile.name || startupName(profile.idea, analysis);
  renderTake(); renderBecame(); renderLives(); renderWhy(); renderQuestions(); renderTriedSummary(); renderVersion();
  S.fund = { mode: 'fit', place: 'any', all: false }; renderFunders();
  renderKillers(); renderMarkets(); renderTiming(); renderMoon(); renderComps(); renderGrave(); renderPivots(); renderMethod();
  renderBrief();
  setTimeout(() => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 500);
}

function topKiller() {
  const s = S.run.result.summary;
  const top = Object.entries(s.causes).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const echoes = Object.entries(s.echoesByCause[top[0]] || {}).sort((a, b) => b[1] - a[1]);
  const c = echoes.length ? S.byId[echoes[0][0]] : null;
  return S.bundle.causes[top[0]].label + (c ? ` (like ${c.n})` : '');
}

function renderKillers() {
  const s = S.run.result.summary;
  const box = $('#killers'); box.innerHTML = '';
  const deaths = s.count.dead || 1;
  const top = Object.entries(s.causes).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length) { box.append(h('p', {}, 'None of your futures died. Either a remarkable idea, or a bug. Check the data room.')); return; }
  for (const [id, n] of top) {
    const cause = S.bundle.causes[id] || { label: id, desc: '' };
    const echoes = Object.entries(s.echoesByCause[id] || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cid]) => S.byId[cid]).filter(Boolean);
    box.append(h('div', { class: 'killer' },
      h('div', { class: 'pct' }, pct(n, deaths)),
      h('div', {},
        h('h4', {}, cause.label),
        h('div', { class: 'bar' }, h('i', { style: `width:${(n / top[0][1]) * 100}%` })),
        h('p', {}, cause.desc, cause.src ? [' ', h('a', { href: cause.src, target: '_blank', rel: 'noopener', style: 'color:var(--ink-3)' }, '[source]')] : ''),
        h('div', { class: 'echoes' }, echoes.sort((a, b) => (a.v !== S.run.profile.vertical) - (b.v !== S.run.profile.vertical)).map((c) => coChip(c, true))),
      )));
  }
}

function coChip(c, markAdjacent) {
  const o = { dead: `✝ ${c.e || ''}`, acquihire: 'fire sale', acquired: 'acquired', ipo: 'IPO', private_unicorn: 'unicorn', active: 'active' }[c.out] || c.out;
  const adj = markAdjacent && S.run && c.v !== S.run.profile.vertical;
  return h('button', { class: 'co-chip' + (adj ? ' adj' : ''), type: 'button', onclick: () => openCompany(c.id), title: adj ? `Adjacent space: ${label(c.v, c.sv)}` : null },
    `${flag(c.cc)} ${c.n}`, h('span', { class: 'o' }, adj ? `${o} · adjacent` : o));
}

function renderMarkets() {
  const R = S.run;
  const box = $('#markets'); box.innerHTML = '';
  // markets where something close to this idea actually happened, plus home, plus "everywhere else"
  const lived = new Map();
  for (const { c, sim } of R.analysis.comps) if (sim >= 0.25) (lived.get(c.r) || lived.set(c.r, []).get(c.r)).push(c);
  const rows = R.regions.filter((r) => lived.has(r.region) || r.region === R.profile.region);
  const rest = R.regions.filter((r) => !lived.has(r.region) && r.region !== R.profile.region);
  if (rest.length) rows.push(Object.assign({}, rest[0], { region: '_rest', restCount: rest.length }));
  rows.sort((a, b) => b.unicorns - a.unicorns);
  const max = Math.max(1, ...rows.map((r) => r.unicorns));
  const fmt1 = (x) => (x < 10 ? x.toFixed(1) : Math.round(x)).toString().replace(/\.0$/, '');
  box.append(h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:var(--gold)' }), '$1B+ futures per 1,000'), h('span', {}, h('i', { style: 'background:rgba(196,222,255,.3)' }), 'didn’t die (any outcome)')));
  for (const r of rows) {
    const home = r.region === R.profile.region;
    const name = r.region === '_rest' ? `Everywhere else (${r.restCount} markets)` : REGION_NAME[r.region] + (home ? '  (you)' : '');
    const cos = lived.get(r.region) || [];
    box.append(h('div', { class: 'mrow' + (home ? ' home' : '') },
      h('span', { class: 'nm' }, name),
      h('span', { class: 'track' }, h('s', { style: `width:${r.survived / 10}%` }), h('i', { style: `width:${Math.max(0.6, (r.unicorns / max) * 100)}%; opacity:${r.unicorns ? 1 : 0.25}` })),
      h('span', { class: 'val' }, `${fmt1(r.unicorns)}/1k · ${Math.round(r.survived / 10)}% live`),
    ));
    if (cos.length) box.append(h('div', { class: 'echoes', style: 'margin:2px 0 10px 0' }, cos.slice(0, 5).map((c) => coChip(c))));
  }
  const proxied = (S.bundle.meta.proxiedRegions || []).length;
  if (proxied) box.append(h('p', { class: 'fine' }, `So far only US base rates are sourced (graduation odds, valuations, timing). Until each region's own numbers are added, differences between markets here come from what happened to the closest real companies in each market.`));
  // twin stories touching this idea
  const tw = $('#twins'); tw.innerHTML = '';
  const groups = new Map();
  for (const { c } of R.analysis.comps) if (c.twin && S.bundle.twins[c.twin]) groups.set(c.twin, S.bundle.twins[c.twin]);
  for (const g of [...groups.values()].slice(0, 4)) {
    const members = g.members.map((id) => S.byId[id]).filter(Boolean);
    if (members.length < 2) continue;
    tw.append(h('div', { class: 'twin' },
      h('h4', {}, g.idea),
      h('p', {}, g.lesson || ''),
      h('div', { class: 'echoes' }, members.map((c) => coChip(c)))));
  }
}

function svgCurve(curve) {
  const pts = curve.points.filter((p) => p[1] > 0);
  if (pts.length < 2) return null;
  const W = 460, H = 220, P = 34;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => Math.log10(p[1]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (x) => P + ((x - x0) / Math.max(1, x1 - x0)) * (W - P * 2);
  const Y = (y) => H - P - ((y - y0) / Math.max(0.0001, y1 - y0)) * (H - P * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(Math.log10(p[1])).toFixed(1)}`).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${curve.label}">
    <path d="${d}" fill="none" stroke="#b69cff" stroke-width="2.5"/>
    ${pts.map((p) => `<circle cx="${X(p[0])}" cy="${Y(Math.log10(p[1]))}" r="3.5" fill="#b69cff"/>`).join('')}
    <text x="${X(pts[0][0])}" y="${Y(Math.log10(pts[0][1])) - 10}" fill="#aab3c5" font-size="12" font-family="JetBrains Mono">${pts[0][0]}: ${fmtUnit(pts[0][1], curve.unit)}</text>
    <text x="${X(pts[pts.length - 1][0])}" y="${Y(Math.log10(pts[pts.length - 1][1])) + 22}" fill="#eef1f8" font-size="12" font-family="JetBrains Mono" text-anchor="end">${pts[pts.length - 1][0]}: ${fmtUnit(pts[pts.length - 1][1], curve.unit)}</text>
    <text x="${P}" y="${H - 8}" fill="#6f7a8f" font-size="11" font-family="JetBrains Mono">log scale</text></svg>`;
  const wrap = h('div'); wrap.innerHTML = svg; return wrap.firstChild;
}
function fmtUnit(v, unit) {
  const n = v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'K' : v >= 1 ? v.toFixed(v >= 100 ? 0 : 1) : v.toPrecision(2);
  return /usd|\$/i.test(unit || '') ? '$' + n : n + ' ' + (unit || '');
}

function renderTiming() {
  const R = S.run;
  const box = $('#timing'); box.innerHTML = '';
  const M = S.bundle.moonshots || {};
  const compIds = new Set(R.analysis.comps.map((x) => x.c.id));
  let shown = false;
  const pairs = (M.tooEarly || []).filter((p) => compIds.has(p.early_id) || compIds.has(p.later_id)).slice(0, 2);
  for (const p of pairs) {
    const a = S.byId[p.early_id], b = S.byId[p.later_id];
    box.append(h('div', { class: 'timing-pair', style: 'margin-bottom:18px' },
      h('div', { class: 'twin' }, h('h4', {}, a ? a.n : p.early_name || p.early_id), h('p', {}, a ? `${a.f}–${a.e || ''} · ${a.out}` : ''), a ? coChip(a) : ''),
      h('div', { class: 'arrow' }, `${p.gap_years || '?'} years later →`),
      h('div', { class: 'twin' }, h('h4', {}, b ? b.n : p.later_name || p.later_id), h('p', {}, p.what_changed || ''), b ? coChip(b) : '')));
    shown = true;
  }
  const curve = pickCurve(R);
  if (curve) {
    const chart = svgCurve(curve);
    if (chart) {
      const first = curve.points[0], last = curve.points[curve.points.length - 1];
      const drop = first[1] > last[1] ? `${Math.round((1 - last[1] / first[1]) * 100)}% cheaper` : `${(last[1] / first[1]).toFixed(0)}× more`;
      box.append(h('div', { class: 'curve-wrap' }, chart, h('div', {},
        h('p', { class: 'eyebrow' }, 'Why now'),
        h('h4', { style: 'font-size:20px;margin:0 0 8px' }, `${curve.label}: ${drop} since ${first[0]}`),
        h('p', { style: 'color:var(--ink-2)' }, `Moonshots usually become possible when a cost curve crosses a line. This one unlocks: ${(curve.unlocks || []).join(', ')}.`),
        curve.source ? h('a', { href: curve.source, target: '_blank', rel: 'noopener', style: 'color:var(--ink-3);font-size:13px' }, 'Source') : '')));
      shown = true;
    }
  }
  $('#timingTitle').textContent = pairs.length ? 'Too early, or right on time?' : 'Why now?';
  $('#pTiming').hidden = !shown;
}

function pickCurve(R) {
  const curves = (S.bundle.moonshots && S.bundle.moonshots.curves) || [];
  if (!curves.length || !R.analysis.enabler) return null;
  if (!(R.profile.moonshot || R.analysis.moonScore >= 40)) return null;
  return curves.find((c) => (c.id + ' ' + c.label).toLowerCase().includes(R.analysis.enabler)) || null;
}

function renderMoon() {
  const R = S.run;
  const show = R.profile.moonshot || R.analysis.moonScore >= 55;
  $('#pMoon').hidden = !show;
  if (!show) return;
  const box = $('#moonStories'); box.innerHTML = '';
  const M = S.bundle.moonshots || {};
  const vert = R.profile.vertical;
  const seen = new Set();
  const nd = nearDeathStories().slice().sort((a, b) => (b.c.v === vert) - (a.c.v === vert))
    .filter(({ c }) => !seen.has(c.id) && seen.add(c.id));
  for (const { c, nd: n } of nd.slice(0, 3)) {
    box.append(h('div', { class: 'story' }, h('span', { class: 'k' }, `Near death · ${n.year}`), h('h4', {}, c.n), h('p', {}, n.what), h('button', { class: 'co-chip', style: 'margin-top:10px', onclick: () => openCompany(c.id) }, 'Full story + sources')));
  }
  // three different famous passes, rotated by idea so each idea shows a different set
  const anti = (M.anti || []).filter((a, i, arr) => arr.findIndex((b) => b.investor === a.investor && b.company === a.company) === i);
  const off = R.profile.idea.length % Math.max(1, anti.length);
  for (let k = 0; k < Math.min(3, anti.length); k++) {
    const a = anti[(off + k) % anti.length];
    box.append(h('div', { class: 'story' }, h('span', { class: 'k' }, `Passed on it · ${a.year || ''}`), h('h4', {}, `${a.investor} passed on ${a.company}`), h('p', {}, a.why_passed || ''), a.source ? h('a', { href: a.source, target: '_blank', rel: 'noopener' }, 'Source') : ''));
  }
  for (const f of (M.deeptech || []).slice(0, 2)) {
    box.append(h('div', { class: 'story' }, h('span', { class: 'k' }, 'Moonshot math'), h('h4', {}, f.metric), h('p', {}, `${f.value_text || f.value}${f.note ? ' — ' + f.note : ''}`), f.source ? h('a', { href: f.source, target: '_blank', rel: 'noopener' }, 'Source') : ''));
  }
}

function spacePicker(A) {
  const sel = h('select', { id: 'spaceSel', 'aria-label': 'Change the space this idea is compared against' },
    h('option', { value: '' }, 'Not right? Pick the right space…'));
  for (const v of VERTICALS) {
    const og = h('optgroup', { label: v.label });
    og.append(h('option', { value: v.id }, `${v.label} (any)`));
    for (const s of v.subs) og.append(h('option', { value: `${v.id}/${s.id}` }, s.label));
    sel.append(og);
  }
  sel.addEventListener('change', () => {
    if (!sel.value) return;
    S.force = { idea: S.run.profile.idea, space: sel.value };
    start({ skipReading: true });
  });
  return h('div', { class: 'space-bar' },
    h('span', { class: 'space-k' }, A.forced ? 'Compared as (your pick)' : 'We read this as'),
    h('b', { class: 'space-v' }, A.spaceLabel),
    A.inferred ? h('span', { class: 'space-note' }, '(inferred from the closest companies)') : '',
    sel);
}

function compCard({ c, tier }) {
  return h('button', { class: 'comp', type: 'button', onclick: () => openCompany(c.id) },
    h('div', { class: 'top' }, h('b', {}, c.n), h('span', { class: `badge b-${c.out}` }, outcomeLabel(c))),
    h('div', { class: 'meta' }, `${flag(c.cc)} ${c.cc} · ${c.f || '?'}${c.e ? '–' + c.e : ''} · raised ${money(c.raised)}`),
    h('div', { class: 'match m' + tier }, tier === 1 ? 'same niche' : tier === 2 ? `same space · ${label(c.v, c.sv).split(' › ').pop()}` : `adjacent · ${label(c.v, c.sv)}`),
    h('p', {}, c.o));
}

function renderComps() {
  const A = S.run.analysis;
  const box = $('#comps'); box.innerHTML = '';
  const panel = $('#pComps');
  const old = panel.querySelector('.space-bar'); if (old) old.remove();
  panel.insertBefore(spacePicker(A), box);
  const comps = A.comps.slice(0, 12);
  if (!comps.length) {
    box.append(h('p', { class: 'niche-note' }, `Nothing in our dataset is in ${A.spaceLabel} yet, so this run uses base rates only. If that's the wrong space, pick the right one above.`));
  } else if (!A.nicheCount) {
    box.append(h('p', { class: 'niche-note' }, `No company in our dataset does exactly this yet (${A.spaceLabel}). These are the closest from the wider ${A.verticalLabel} space, so they count for less in the simulation.`));
  }
  // show the closest six; the rest are one tap away so the questions below stay in view
  const SHOW = 6;
  comps.forEach((x, i) => { const card = compCard(x); if (i >= SHOW) card.hidden = true; box.append(card); });
  if (comps.length > SHOW) {
    const more = h('button', { type: 'button', class: 'ghost show-more' }, `Show all ${comps.length} companies`);
    more.onclick = () => { box.querySelectorAll('.comp[hidden]').forEach((c) => { c.hidden = false; }); more.remove(); };
    box.append(more);
  }
  if (A.adjacent.length && A.nicheCount < 4) {
    box.append(h('p', { class: 'eyebrow', style: 'grid-column:1/-1;margin:14px 0 2px' }, 'Adjacent spaces (shown for context, not used in the simulation)'));
    for (const x of A.adjacent.slice(0, 4)) box.append(compCard(x));
  }
}
const outcomeLabel = (c) => ({ dead: 'DIED', acquihire: 'FIRE SALE', acquired: 'ACQUIRED', ipo: 'IPO', private_unicorn: 'UNICORN', active: 'ACTIVE' }[c.out] || c.out);

function renderPivots() {
  const R = S.run;
  const box = $('#pivots'); box.innerHTML = '';
  const base = whatIf(R.profile, S.bundle);
  const opts = [];
  const best = R.regions.find((r) => r.region !== R.profile.region);
  if (best && best.unicorns > R.regions.find((r) => r.region === R.profile.region).unicorns) {
    const cc = COUNTRIES.find((c) => c[2] === best.region);
    opts.push({ label: `Launch in ${REGION_NAME[best.region]} instead`, change: { market: cc[0], region: best.region } });
  }
  if (R.profile.founders !== 'repeat_win') opts.push({ label: 'Bring a co-founder who has had an exit', change: { founders: 'repeat_win' } });
  const si = STAGES.indexOf(R.profile.stage);
  if (si < 3) opts.push({ label: `Start from a closed ${STAGE_LABEL[STAGES[si + 1]]}`, change: { stage: STAGES[si + 1] } });
  opts.push(R.profile.moonshot ? { label: 'Play it safe: normal startup physics', change: { moonshot: false } } : { label: 'Swing for the fences: moonshot mode', change: { moonshot: true } });
  for (const o of opts) {
    const alt = whatIf(Object.assign({}, R.profile, o.change), S.bundle);
    const d = alt.unicorns - base.unicorns, dDead = alt.dead - base.dead;
    const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + (Math.abs(x) < 10 ? Math.abs(x).toFixed(1).replace(/\.0$/, '') : Math.round(Math.abs(x)));
    box.append(h('button', { class: 'pivot', type: 'button', onclick: () => applyPivot(o.change) },
      h('div', { class: 'lbl' }, o.label),
      h('div', { class: 'delta ' + (d > 0.4 ? 'up' : d < -0.4 ? 'down' : 'flat') }, `${sgn(d)} unicorn futures`),
      h('div', { class: 'sub' }, `${sgn(dDead)} deaths per 1,000 · tap to watch it`)));
  }
}

function applyPivot(ch) {
  if (ch.market) $('#market').value = ch.market;
  if (ch.stage) setStage(ch.stage);
  if (ch.founders) $('#founders').value = ch.founders;
  if (ch.moonshot !== undefined) { $('#moon').checked = ch.moonshot; S.moonTouched = true; }
  start({ skipReading: true });
}

function renderMethod() {
  const B = S.bundle, m = B.meta;
  const box = $('#methodText'); box.innerHTML = '';
  const ev = S.run.result.params.evidence;
  [
    `Each of the 1,000 universes starts where you are today (${STAGE_LABEL[S.run.profile.stage]}, ${START_YEAR}) and plays out month by month for ten years. At every round it can raise the next one, get acquired, or shut down. The odds, the months between rounds, and the round sizes and valuations come from published data for your region and the current era (${m.ladderSources} sources, listed in the data room).`,
    `The idea reader placed your pitch in ${S.run.analysis.spaceLabel}, one of ${VERTICALS.reduce((n, v) => n + v.subs.length, 0)} niches across ${VERTICALS.length} verticals, and compared it only with real companies from that niche (${S.run.analysis.nicheCount}) and the wider ${S.run.analysis.verticalLabel} space (${S.run.analysis.verticalCount}), out of ${m.companies.toLocaleString()} companies in ${m.countries} countries. Companies from other spaces are never used as evidence, however similar the wording. If we read your idea wrong, pick the right space under "Your closest real companies".`,
    `Those companies' real outcomes nudged your odds (×${ev.mult.toFixed(2)}). Niche matches count fully, wider-space ones partly. The nudge is corrected for our dataset's bias toward famous companies and capped, so a handful of stories can't overrule the base rates.`,
    `When a universe dies, its cause is drawn from the published mix of startup failure causes, reweighted for your sector, for its stage (early deaths skew to "no market need", later ones to unit economics and funding crunches), and for how your closest real companies actually died. The real company named next to each death died of that cause.`,
    `Moonshot mode uses slower, harder early rounds and fatter-tailed outcomes, calibrated on deep-tech and moonshot histories. Universes can survive one near-death moment, as SpaceX did in 2008.`,
    `What it can't know: you, your team, your timing luck, and the next decade's markets. Use it to find the ways your idea is most likely to die, and kill those first.`,
  ].forEach((t) => box.append(h('p', {}, t)));
}

// ---------- take-home ----------
const pctOf = (k, n = 1000) => { const p = (100 * k) / n; return (p > 0 && p < 1 ? p.toFixed(1) : Math.round(p)) + '%'; };
const cash$ = (x) => (x == null || x < 1e4 ? '$0' : money(x));

function renderTake() {
  const R = S.run;
  const st = payoutStats(R.result.universes, S.cof, S.salary);
  R.take = st;
  R.takeLine = `💸 Median take-home: ${cash$(st.median)} · $1M+ in ${pctOf(st.over1m)} of futures`;
  const tile = (big, label, note, cls) => h('div', { class: 'tstat ' + (cls || '') }, h('b', {}, big), h('span', {}, label), note ? h('small', {}, note) : '');
  const box = $('#takeStats'); box.innerHTML = '';
  box.append(
    tile(cash$(st.median), 'median take-home', `per founder, split ${S.cof} way${S.cof > 1 ? 's' : ''}`, st.median < 1e4 ? 'zero' : ''),
    tile(pctOf(st.zero), 'walk away with nothing', 'died, or investors took the whole sale'),
    tile(pctOf(st.over1m), 'make $1M or more', 'in cash, from a sale or IPO'),
    tile(pctOf(st.over10m), 'make $10M or more', st.over100m ? `${pctOf(st.over100m)} make $100M+` : ''),
    tile(pctOf(st.beatJob), 'beat 10 years at your job', `cash ≥ ${money(st.jobTotal)}`),
  );
  const bars = $('#takeBars'); bars.innerHTML = '';
  const max = Math.max(...st.buckets.map((b) => b.cash + b.paper), 1);
  bars.append(h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:var(--gold)' }), 'cash (sale or IPO)'), h('span', {}, h('i', { style: 'background:#8fa3bf' }), 'paper only (still private in 2036)')));
  for (const b of st.buckets) {
    const tot = b.cash + b.paper;
    bars.append(h('div', { class: 'tbar' },
      h('span', { class: 'nm' }, b.label),
      h('span', { class: 'track' }, h('i', { class: 'c', style: `width:${(b.cash / max) * 100}%` }), h('i', { class: 'p', style: `width:${(b.paper / max) * 100}%` })),
      h('span', { class: 'val' }, `${tot} futures`)));
  }
  const trap = $('#takeTrap'); trap.innerHTML = '';
  if (st.trap) {
    const u = st.trap.u, last = u.events[u.events.length - 1];
    trap.append(h('p', { class: 'eyebrow' }, 'The preference trap'),
      h('p', { class: 'trap-line' }, `In universe #${u.index + 1} the company sold for ${money(u.exitValue)} in ${yearOf(last.t)}. Investors had put in ${money(u.prefStack)} with 1x preferences, so they were paid first and took ${money(u.investorsTake)}. Each founder got ${cash$(st.trap.cash)}.`),
      h('p', { class: 'fine' }, `In ${st.trappedCount} of the ${st.sales} sales across your 1,000 futures, the founders got less than 10% of the price. A big sale is not a big payout.`));
  }
  const own = $('#takeOwn'); own.innerHTML = '';
  if (st.ownership.length) {
    own.append(h('p', { class: 'eyebrow' }, 'How the founders’ stake shrinks (median, whole founding team)'),
      h('div', { class: 'own-path' }, st.ownership.map((o, i) => [i ? h('span', { class: 'arr' }, '→') : '', h('span', { class: 'own-step' }, h('b', {}, `${Math.round(o.pct * 100)}%`), ` after ${STAGE_LABEL[o.stage]}`)])));
  }
  $('#takeFine').textContent = `Assumptions: each round dilutes everyone by its size ÷ post-money (this reproduces Carta's 2026 medians of ~19% at seed and ~19% at Series A); an option pool topped up to 10% at the first priced round and +5% at Series A; standard 1x non-participating preferences, all investors equal. Founders split equally. Excludes salaries, taxes, secondaries and retention packages. Paper value of still-private companies is not cash.`;
}

// ---------- the two lives ----------
function lifeCards(R) {
  const U = R.result.universes;
  const ob = obituaryUniverse(U);
  let obit = null;
  if (ob) {
    const u = ob.u, last = u.events[u.events.length - 1];
    const echo = S.byId[u.echo];
    obit = {
      name: R.name, startYear: START_YEAR, endYear: yearOf(last.t), stageLabel: STAGE_LABEL[last.stage],
      causeLabel: (S.bundle.causes[u.cause] || { label: u.cause }).label, quip: quipFor(u.cause),
      raised: money(u.raised), peak: money(u.peak), echo: echo ? `${echo.n.replace(/\s*\(.*\)/, '')} (${echo.e || echo.f || ''})` : null,
      sameWay: ob.sameWay, totalDead: ob.totalDead, idea: R.profile.idea, index: u.index + 1,
    };
  }
  const bu = bestLifeUniverse(U), last = bu.events[bu.events.length - 1];
  const tl = bu.events.filter((e) => e.type === 'start' || e.type === 'raise').map((e) => ({
    year: yearOf(e.t), text: e.type === 'start' ? `${STAGE_LABEL[e.stage]} · valued ${money(e.post)}` : `${STAGE_LABEL[e.stage]} · ${money(e.round)} at ${money(e.post)}`,
  }));
  let headline, value;
  if (bu.outcome === 'ipo') { headline = `Went public in ${yearOf(last.t)}`; value = money(bu.exitValue); tl.push({ year: yearOf(last.t), text: `IPO at ${money(bu.exitValue)}` }); }
  else if (bu.outcome === 'acquired' || bu.outcome === 'acquihire') { headline = `Sold in ${yearOf(last.t)}`; value = money(bu.exitValue); tl.push({ year: yearOf(last.t), text: `Acquired for ${money(bu.exitValue)}` }); }
  else if (bu.outcome === 'dead') { headline = `Peaked, then died in ${yearOf(last.t)}`; value = money(bu.peak); tl.push({ year: yearOf(last.t), text: 'Shut down' }); }
  else { headline = `Still private in ${START_YEAR + 10}`; value = money(bu.post); tl.push({ year: START_YEAR + 10, text: `Valued at ${money(bu.post)}` }); }
  const take = (bu.teamCash + bu.teamPaper) / S.cof;
  // the lesson: where this future got ahead of the typical one
  let lesson = null, best$ = 0;
  for (const e of bu.events) {
    if (e.type !== 'raise') continue;
    const p = R.became && R.became.pace.find((x) => x.stage === e.stage);
    if (!p) continue;
    const ahead = p.aYear - (START_YEAR + e.t / 12);
    if (ahead > best$) { best$ = ahead; lesson = `It closed its ${STAGE_LABEL[e.stage]} in ${yearOf(e.t)}, ${ahead.toFixed(1)} years ahead of the typical future, at ${(e.post / p.aPost).toFixed(1)}× the typical valuation.`; }
  }
  const rounds = bu.events.filter((e) => e.type === 'raise').length;
  if (!lesson || best$ < 0.4) lesson = `It raised ${rounds} round${rounds === 1 ? '' : 's'} in ${((last.t || 1) / 12).toFixed(0)} years and never stalled long enough to die.`;
  const best = {
    name: R.name, index: bu.index + 1, value, headline, timeline: tl, take: cash$(take), idea: R.profile.idea, lesson,
    takeNote: `Founders’ share: ${cash$(take)} each${bu.teamPaper > 0 && !bu.teamCash ? ' on paper' : ''} (owned ${Math.round(bu.founderPct * 100)}%, split ${S.cof} way${S.cof > 1 ? 's' : ''})`,
    odds: '1 in 1,000 futures. Most look nothing like this.',
  };
  return { obit, best, obitU: ob && ob.u, bestU: bu };
}

function renderLives() {
  const R = S.run;
  R.lives = lifeCards(R); // the obituary and best-life cards live in the share dialog
}

// ---------- what it became ----------
const humanize = (d) => String(d).replace(/_/g, ' ').replace(/\bai\b/gi, 'AI');
function renderBecame() {
  const R = S.run;
  const W = winnersReport(R.result.universes, R.result.params.sharedWinter);
  R.became = W;
  $('#becameSub').textContent = W.count
    ? `In ${W.count} of 1,000 futures this idea reached a $1B valuation. Here's what those futures turned into, how fast they got there, and the pace you'd have to keep.`
    : `None of the 1,000 futures reached $1B. The furthest one (universe #${W.closest.index + 1}) peaked at ${money(W.closest.peak)}. The pace below is what every future that raised each round did.`;
  const end = $('#becameEndings'); end.innerHTML = '';
  if (W.count) {
    const chip = (n, label, color) => (n ? h('span', { class: 'pill' }, h('i', { style: `background:${color}` }), `${n} ${label}`) : '');
    end.append(h('div', { class: 'stat-row' },
      chip(W.endings.ipo, 'went public', 'var(--gold)'), chip(W.endings.bigSale, 'sold for $1B+', 'var(--acq)'),
      chip(W.endings.private, 'still private unicorns in 2036', '#c4deff'), chip(W.endings.sold, 'sold later for less than $1B', 'var(--fire)'),
      chip(W.endings.fell, 'hit $1B, then died', 'var(--dead)')));
    const facts = [];
    if (W.fastest) facts.push(`Fastest to $1B: ${(W.fastest.t / 12).toFixed(1)} years (universe #${W.fastest.u.index + 1}).`);
    if (W.typicalYears) facts.push(`Typical: ${W.typicalYears.toFixed(1)} years, after raising about ${money(W.raisedAtUnicorn)}.`);
    if (W.winterNote) facts.push(`${W.winterNote.through} of the ${W.winterNote.total} unicorn futures were already alive when the ${W.winterNote.start}–${W.winterNote.end} funding winter hit, and made it through.`);
    if (W.nearDeath) facts.push(`${W.nearDeath} of them nearly died first.`);
    end.append(h('p', { class: 'became-facts' }, facts.join(' ')));
  }
  $('#paceSub').textContent = 'When the unicorn futures raised each round, and at what valuation, compared with every future that raised it. Falling behind this pace is the earliest warning sign.';
  const pace = $('#becamePace'); pace.innerHTML = '';
  const yr = (y) => (y == null ? '—' : (Math.floor(y) + (y % 1 >= 0.5 ? ' (H2)' : ' (H1)')));
  pace.append(h('div', { class: 'pace-row head' }, h('span', {}, 'Round'), h('span', {}, 'Unicorn futures'), h('span', {}, 'All futures that raised it')));
  for (const p of W.pace) {
    pace.append(h('div', { class: 'pace-row' }, h('span', {}, h('b', {}, STAGE_LABEL[p.stage])),
      h('span', { class: 'g' }, p.wYear ? `${yr(p.wYear)} · ${money(p.wPost)}` : '—'),
      h('span', {}, `${yr(p.aYear)} · ${money(p.aPost)}`, h('small', {}, ` · ${p.all} futures`))));
  }
  renderWhere();
}

// ---------- evidence labels ----------
// how much a section's evidence can bear, said plainly
function evidence(el, n, unit) {
  if (!el) return '';
  const q = n < 5 ? 'anecdotal' : n < 15 ? 'small sample' : '';
  el.textContent = `${n} ${unit}${q ? ' · ' + q : ''}`;
  el.className = 'evidence' + (n < 5 ? ' thin' : '');
  el.hidden = !n && n !== 0;
  return q;
}

// ---------- the graveyard ----------
const DEATH_RE = /\b(shut|shuttered|closed|collaps|bankrupt|insolv|wound down|wind down|folded|ceased|liquidat|went under|died|fire sale|sold (?:its|the) (?:assets|remains)|laid off|filed for|went dark|discontinu)/i;
function deathLine(c) {
  const sents = (c.story || '').split(/(?<=[.!?])\s+(?=[A-Z0-9“"])/);
  const hits = sents.filter((x) => DEATH_RE.test(x));
  return (hits.length ? hits[hits.length - 1] : sents[sents.length - 1] || c.o || '').trim();
}
function gravePool() {
  const R = S.run, A = R.analysis;
  const dead = (c) => c.out === 'dead' || c.out === 'acquihire';
  const sims = S.matcher.similarities(R.profile.idea);
  const order = (l) => l.sort((a, b) => (sims.get(b.id) || 0) - (sims.get(a.id) || 0) || (b.e || 0) - (a.e || 0));
  const niche = order(S.bundle.companies.filter((c) => dead(c) && c.v === A.vertical && A.subvertical && c.sv === A.subvertical));
  const vert = order(S.bundle.companies.filter((c) => dead(c) && c.v === A.vertical && !niche.includes(c)));
  return { niche, vert, list: niche.length >= 3 ? niche : niche.concat(vert) };
}
function renderGrave() {
  const R = S.run, A = R.analysis;
  const panel = $('#pGrave');
  if (!A.vertical) { panel.hidden = true; return; }
  panel.hidden = false;
  const G = gravePool();
  R.grave = G;
  const box = $('#graves'); box.innerHTML = '';
  const cz = $('#graveCauses'); cz.innerHTML = '';
  const nicheShort = A.spaceLabel.split(' › ').pop();
  evidence($('#graveEv'), G.list.length, G.list.length === 1 ? 'death' : 'deaths');
  if (!G.list.length) {
    $('#graveSub').textContent = `No company in ${A.verticalLabel} has a documented death in our data yet. That usually means a young space, not a safe one.`;
    return;
  }
  const young = S.bundle.companies.filter((c) => c.v === A.vertical && c.sv === A.subvertical);
  const medianFounded = young.length ? young.map((c) => c.f || 0).sort((a, b) => a - b)[Math.floor(young.length / 2)] : null;
  $('#graveSub').textContent = G.niche.length >= 3
    ? `${G.niche.length} companies in ${nicheShort} died or were sold for parts. This is how, in their sources' words. It's the part of the story funding databases leave out.`
    : `${G.niche.length ? `Only ${G.niche.length} documented death${G.niche.length === 1 ? '' : 's'} in ${nicheShort}` : `No documented deaths in ${nicheShort} yet`}${medianFounded && medianFounded >= START_YEAR - 6 ? ` (most companies here were founded after ${medianFounded - 1}, so the space is young)` : ''}, so this includes deaths from across ${A.verticalLabel}. Read them as warnings, not as a pattern.`;
  // how they died, by cause
  const tally = {};
  for (const c of G.list) for (const x of (c.causes || []).slice(0, 2)) tally[x] = (tally[x] || 0) + 1;
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [id, n] of top) cz.append(h('span', { class: 'cause-chip' }, h('b', {}, (S.bundle.causes[id] || { label: id }).label), ` ${n} of ${G.list.length}`));
  R.graveTop = top[0] ? { id: top[0][0], n: top[0][1], of: G.list.length } : null;
  const SHOW = 6;
  G.list.slice(0, 18).forEach((c, i) => {
    const src = (c.src || [])[0];
    const card = h('div', { class: 'grave' + (c.sv === A.subvertical ? '' : ' wider') },
      h('div', { class: 'top' }, h('button', { type: 'button', class: 'grave-name', onclick: () => openCompany(c.id) }, c.n.replace(/\s*\(.*\)/, '')),
        h('span', { class: `badge b-${c.out}` }, c.out === 'dead' ? `DIED ${c.e || ''}`.trim() : 'FIRE SALE')),
      h('div', { class: 'meta' }, `${flag(c.cc)} ${c.cc} · ${c.f || '?'}–${c.e || '?'}${c.f && c.e ? ` · lasted ${c.e - c.f} yr${c.e - c.f === 1 ? '' : 's'}` : ''}${c.raised ? ` · raised ${money(c.raised)}` : ''}${c.sv === A.subvertical ? '' : ` · ${label(c.v, c.sv).split(' › ').pop()}`}`),
      (c.causes || []).length ? h('div', { class: 'grave-cause' }, c.causes.slice(0, 2).map((x) => (S.bundle.causes[x] || { label: x }).label).join(' · ')) : '',
      h('p', {}, deathLine(c)),
      src ? h('a', { class: 'grave-src', href: src, target: '_blank', rel: 'noopener' }, `${new URL(src).hostname.replace(/^www\./, '')} ↗`) : '');
    if (i >= SHOW) card.hidden = true;
    box.append(card);
  });
  if (Math.min(G.list.length, 18) > SHOW) {
    const more = h('button', { type: 'button', class: 'ghost show-more' }, `Show all ${Math.min(G.list.length, 18)}`);
    more.onclick = () => { box.querySelectorAll('.grave[hidden]').forEach((c) => { c.hidden = false; }); more.remove(); };
    box.append(more);
  }
}

// ---------- the brief ----------
function renderBrief() {
  const R = S.run, A = R.analysis, p = R.profile, s = R.result.summary;
  $('#briefEyebrow').textContent = `The brief · ${STAGE_LABEL[p.stage]} · ${COUNTRY[p.market].name}`;
  $('#briefIdea').textContent = `“${p.idea}”`;
  $('#briefSpace').textContent = A.vertical ? A.spaceLabel : 'Space not recognised: pick one in “Who already tried this” for sharper results.';
  const grid = $('#briefGrid'); grid.innerHTML = '';
  const tile = (k, v, d, target, cls) => grid.append(h('button', { type: 'button', class: 'brief-tile' + (cls ? ' ' + cls : ''), onclick: () => $(target).scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    h('span', { class: 'k' }, k), h('b', {}, v), d ? h('span', { class: 'd' }, d) : ''));
  const rec = compRecord(A.comps);
  tile('Tried before', rec.n ? `${rec.n} compan${rec.n === 1 ? 'y' : 'ies'}` : 'Nobody we know of',
    rec.n ? `${rec.dead} died · ${rec.sold} sold · ${rec.won} won or still going` : 'Very original, or too vague: say who it’s for', '#pComps');
  const G = R.grave;
  if (!A.vertical) { /* unknown space: nothing honest to say about deaths or winners yet */ }
  else if (G && G.list.length && R.graveTop) {
    const c = S.bundle.causes[R.graveTop.id] || { label: R.graveTop.id };
    tile('How they died', c.label, `${R.graveTop.n} of ${R.graveTop.of} documented deaths${G.niche.length >= 3 ? '' : ` across ${A.verticalLabel}`}`, '#pGrave');
  } else tile('How they died', 'No documented deaths', 'A young space, not necessarily a safe one', '#pGrave');
  if (R.version) {
    const V2 = R.version, n = V2.won.length + V2.lost.length;
    tile('What won', V2.thin ? 'Too few finished stories' : (V2.verdicts[0] ? V2.verdicts[0].headline : 'No single pattern'),
      `${V2.won.length} won · ${V2.lost.length} died${V2.scope === 'vertical' ? ` across ${A.verticalLabel}` : ''}${n < 5 ? ' · anecdotal' : n < 15 ? ' · small sample' : ''}`, '#pVersion');
  }
  if (R.funders && R.funders.main.length) {
    const F = R.funders;
    const R1 = F.repeaters.length;
    tile('Who funds it', F.main.slice(0, 3).map((x) => x.n).join(', '),
      `${R1 ? `${R1} repeat backer${R1 === 1 ? '' : 's'} at your stage` : 'Single bets only at your stage so far'} · ${F.inNiche ? `${F.inNiche} in this niche, ` : ''}${F.list.length} across ${A.verticalLabel}`, '#pFunders');
  }
  if (R.questions && R.questions[0]) tile('Be ready for', R.questions[0].q, R.questions[0].why, '#pQuestions', 'wide');
  tile('The simulation', `${s.unicorns} in 1,000 reach $1B`, `vs ${Math.round(R.typical)} for a typical ${STAGE_LABEL[p.stage].toLowerCase()} startup · a model, not a forecast`, '#pSim', 'model');
}

// ---------- who funds this ----------
function fundersNow() {
  const R = S.run, A = R.analysis, p = R.profile;
  const ctx = {
    v: A.vertical, sv: A.subvertical, related: A.vertical ? V[A.vertical].related : [],
    comps: new Set(A.comps.filter((x) => x.tier === 1 || x.sim >= 0.3).map((x) => x.c.id)),
    stage: p.stage, region: p.region, mode: S.fund.mode, onlyRegion: S.fund.place === 'region',
    verticalLabel: A.verticalLabel, nicheLabel: A.spaceLabel,
  };
  return { ctx, res: fundersFor(S.deals, S.bundle.investors || {}, ctx) };
}

function dealLine(d, role) {
  const nm = d.n.replace(/\s*\(.*\)/, '');
  const name = d.company ? h('a', { onclick: () => openCompany(d.co) }, nm) : h('b', {}, nm);
  return h('li', {}, name, h('span', { class: 'fd-meta' }, ` ${flag(d.cc)} ${STAGE_LABEL[d.st]} · ${d.y || '?'}${d.amt ? ' · ' + money(d.amt) : ''}`),
    h('em', { class: role === 'led' ? 'led' : '' }, role),
    d.src ? h('a', { class: 'fd-src', href: d.src, target: '_blank', rel: 'noopener', title: 'Open the source' }, 'source ↗') : '');
}

function renderFunders() {
  const R = S.run, A = R.analysis, p = R.profile;
  const panel = $('#pFunders');
  if (!A.vertical) { panel.hidden = true; return; }
  panel.hidden = false;
  const { ctx, res } = fundersNow();
  const nextStage = STAGES[Math.min(STAGES.indexOf(p.stage) + 1, STAGES.length - 1)];
  const where = res.scope === 'niche' ? A.spaceLabel : A.verticalLabel;
  $('#fundFitBtn').textContent = `Your ${STAGE_LABEL[nextStage]} round`;
  $('#fundRegionBtn').textContent = `Backed in ${REGION_NAME[p.region]}`;
  for (const [seg, key] of [['#fundStage', 'mode'], ['#fundPlace', 'place']]) {
    $(seg).querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.v === (key === 'mode' ? S.fund.mode : S.fund.place));
      b.onclick = () => { S.fund[key] = b.dataset.v; S.fund.all = false; renderFunders(); };
    });
  }
  const box = $('#funders'); box.innerHTML = '';
  const cov = res.coverage;
  if (!cov.vertical) {
    $('#fundHeadline').textContent = `We haven't sourced funding rounds in ${A.verticalLabel} yet.`;
    $('#fundSub').textContent = 'This list fills in as the research grows. The data room shows what we have so far.';
    $('#fundControls').hidden = true; $('#btnFundCSV').hidden = true; $('#btnFundCopy').hidden = true; $('#btnFundMore').hidden = true;
    $('#fundNote').textContent = '';
    return;
  }
  $('#fundControls').hidden = false; $('#btnFundCSV').hidden = false; $('#btnFundCopy').hidden = false;
  const L = res.list;
  // conviction first: two or more sourced rounds in this space, or a round in one of your closest comparables;
  // in "your next round" mode they also need at least one round at or next to your stage
  const repeat = (x) => x.vertical >= 2 || x.comps.length > 0;
  // "your next round" means they actually wrote a check at the stage you're at or raising next
  const atStage = (x) => S.fund.mode === 'all' || x.deals.some(({ d }) => stageWeight(d.st, p.stage) >= 0.85);
  const repeaters = L.filter((x) => repeat(x) && atStage(x))
    .sort((a, b) => (b.vertical >= 2) - (a.vertical >= 2) || b.score - a.score); // proven repeat conviction before a single comparable
  const single = L.filter((x) => !repeat(x) && atStage(x));
  const offStage = L.filter((x) => !atStage(x));
  const noRepeat = !repeaters.length;
  const main = repeaters.concat(single); // repeat backers always rank above single bets
  const others = offStage;
  const isRepeat = new Set(repeaters.map((x) => x.id));
  R.funders = { list: L, main, repeaters, others, inNiche: L.filter((x) => x.niche > 0).length };
  evidence($('#fundEv'), res.scope === 'niche' ? cov.niche : cov.vertical, 'sourced rounds');
  const top3 = (repeaters.length ? repeaters : main).slice(0, 3).map((x) => x.n);
  const andList = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0]);
  const lc = (s) => (/^[A-Z0-9]{2}/.test(s) ? s : s[0].toLowerCase() + s.slice(1));
  const nicheShort = lc(A.spaceLabel.split(' › ').pop()), vertShort = lc(A.verticalLabel);
  const inNiche = L.filter((x) => x.niche > 0).length;
  const inPlace = S.fund.place === 'region' ? ` in ${REGION_NAME[p.region]}` : '';
  const count = (n) => `${n} investor${n === 1 ? ' has' : 's have'}`;
  $('#fundHeadline').textContent = !L.length
    ? `No investor in our data has backed ${vertShort} companies in ${REGION_NAME[p.region]} yet.`
    : `${res.scope === 'niche' && inNiche ? `${count(inNiche)} backed ${nicheShort}${inPlace}, and ${L.length} across ${vertShort}.` : `${count(L.length)} backed ${vertShort}${inPlace}.`} ${!main.length ? `None of them has written a ${STAGE_LABEL[nextStage]} check here in our data.`
      : S.fund.mode === 'all' ? `The most consistent backers: ${andList(top3)}.`
      : repeaters.length >= 3 ? `For a ${STAGE_LABEL[nextStage]} raise, start with ${andList(top3)}.`
      : repeaters.length ? `${andList(top3)} ${repeaters.length === 1 ? 'is the only repeat backer' : 'are the only repeat backers'} at your stage; ${single.length} more made a single bet.`
      : `Nobody has backed this space twice at your stage yet; ${single.length} investor${single.length === 1 ? '' : 's'} made a single bet.`}`;
  $('#fundSub').textContent = noRepeat
    ? `No investor has more than one sourced round in ${A.verticalLabel} at your stage yet, so these are single bets: every name led or joined one real round here. Treat them as leads to research, not a shortlist.`
    : `Repeat backers first: firms with two or more sourced rounds in ${A.verticalLabel}, or a round in one of your closest comparables${S.fund.mode === 'fit' ? `, that have written ${STAGE_LABEL[p.stage] === STAGE_LABEL[nextStage] ? STAGE_LABEL[p.stage] : `${STAGE_LABEL[p.stage]} or ${STAGE_LABEL[nextStage]}`} checks` : ''}. Then firms that made a single bet here, marked as such. Recent rounds count most.`;
  const labels = { niche: A.spaceLabel, vertical: A.verticalLabel };
  const show = S.fund.all ? main : main.slice(0, 8);
  show.forEach((x, i) => {
    const stages = STAGES.filter((s) => x.stages.has(s)).map((s) => STAGE_LABEL[s]);
    const fits = x.stages.has(nextStage) || x.stages.has(p.stage);
    box.append(h('div', { class: 'fund-card' },
      h('div', { class: 'top' }, h('span', { class: 'rank' }, i + 1),
        h('button', { type: 'button', class: 'fund-name', onclick: () => openInvestor(x.id) }, x.n),
        x.t ? h('span', { class: 'ftype' }, TYPE_LABEL[x.t]) : ''),
      h('p', { class: 'why' }, whyLine(x, ctx, labels)),
      h('div', { class: 'fund-tags' },
        h('span', { class: isRepeat.has(x.id) ? 'conv' : 'single' }, isRepeat.has(x.id) ? (x.comps.length && x.vertical < 2 ? 'backed a comparable' : `repeat backer · ${x.vertical} rounds`) : 'one round here'),
        h('span', { class: fits ? 'fit' : '' }, stages.join(' · ')),
        h('span', {}, [...x.regions].map((r) => REGION_NAME[r] || r).slice(0, 3).join(' · ')),
        x.last ? h('span', {}, `last round ${x.last}`) : ''),
      h('ul', { class: 'fund-deals' }, x.deals.slice(0, 3).map(({ d, role }) => dealLine(d, role))),
      x.deals.length > 3 ? h('button', { type: 'button', class: 'linkish', onclick: () => openInvestor(x.id) }, `+${x.deals.length - 3} more round${x.deals.length - 3 === 1 ? '' : 's'} →`) : ''));
  });
  const more = $('#btnFundMore');
  more.hidden = main.length <= 8;
  more.textContent = S.fund.all ? 'Show the top 8' : `Show all ${main.length}`;
  // single bets and other-stage backers, compact
  const also = $('#alsoSeen'); also.innerHTML = '';
  const chipGroup = (title, xs, key) => {
    if (!xs.length) return;
    also.append(h('p', { class: 'eyebrow' }, `${title} · ${xs.length}`));
    const wrap = h('div', { class: 'also-list' });
    xs.slice(0, S.fund[key] ? xs.length : 12).forEach((x) => {
      const { d, role } = x.deals[0];
      wrap.append(h('button', { type: 'button', class: 'also-chip', onclick: () => openInvestor(x.id) }, h('b', {}, x.n),
        ` ${role} ${d.n.replace(/\s*\(.*\)/, '')} · ${STAGE_LABEL[d.st]} ${d.y || ''}`.trimEnd()));
    });
    also.append(wrap);
    if (xs.length > 12) {
      const b = h('button', { type: 'button', class: 'linkish' }, S.fund[key] ? 'Show fewer' : `Show all ${xs.length}`);
      b.onclick = () => { S.fund[key] = !S.fund[key]; renderFunders(); };
      also.append(b);
    }
  };
  chipGroup('Backers at other stages', offStage, 'allOff');
  more.onclick = () => { S.fund.all = !S.fund.all; renderFunders(); };
  const slug = (A.subvertical || A.vertical).replace(/_/g, '-');
  $('#btnFundCSV').onclick = () => {
    const csv = fundersCSV(main.concat(others), ctx, STAGE_LABEL, money, isRepeat);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `who-funds-${slug}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Downloaded');
  };
  $('#btnFundCopy').onclick = () => copy([`Who funds ${where} (1,000 Futures, from public funding rounds):`,
    ...main.slice(0, 15).map((x, i) => `${i + 1}. ${x.n}${x.t ? ` (${TYPE_LABEL[x.t]})` : ''}: ${x.deals.slice(0, 2).map(({ d, role }) => `${role} ${d.n.replace(/\s*\(.*\)/, '')} ${STAGE_LABEL[d.st]} ${d.y || ''}`.trim()).join('; ')}`)].join('\n'));
  const span = cov.from && cov.to ? (cov.from === cov.to ? ` from ${cov.to}` : ` from ${cov.from} to ${cov.to}`) : '';
  $('#fundNote').textContent = `${res.scope === 'vertical' ? `Only ${cov.niche} sourced round${cov.niche === 1 ? '' : 's'} in ${A.spaceLabel} so far, so this list covers all of ${A.verticalLabel}. ` : ''}Built from ${cov.vertical} sourced rounds in ${A.verticalLabel}${span}, ${cov.recent} of them in the last three years. It's a sample, not every investor: a missing name means we haven't sourced their rounds yet, not that they don't invest here. Not an endorsement or an introduction.`;
}

function openInvestor(id) {
  const inv = (S.bundle.investors || {})[id]; if (!inv) return;
  const mine = S.deals.filter((d) => d.L.includes(id) || d.I.includes(id))
    .sort((a, b) => (b.y || 0) - (a.y || 0));
  const byV = new Map();
  for (const d of mine) { const k = d.v ? label(d.v, d.sv) : 'Other'; (byV.get(k) || byV.set(k, []).get(k)).push(d); }
  const body = $('#dlgBody'); body.innerHTML = '';
  body.append(
    h('p', { class: 'eyebrow' }, inv.t ? TYPE_LABEL[inv.t] : 'Investor'),
    h('h3', {}, inv.n),
    h('div', { class: 'sub' }, `${mine.length} sourced round${mine.length === 1 ? '' : 's'} in our data · led ${mine.filter((d) => d.L.includes(id)).length}`),
  );
  for (const [k, ds] of [...byV.entries()].sort((a, b) => b[1].length - a[1].length)) {
    body.append(h('p', { class: 'eyebrow inv-h' }, `${k} · ${ds.length}`), h('ul', { class: 'fund-deals wide' }, ds.map((d) => dealLine(d, d.L.includes(id) ? 'led' : 'joined'))));
  }
  body.append(h('p', { class: 'fund-note' }, 'From public funding announcements we could source. Not every round this investor has done.'), fixLink(inv.n));
  const d = $('#dlg');
  if (!d.open) d.showModal();
}

// ---------- what version of this idea wins ----------
function renderVersion() {
  const R = S.run, A = R.analysis;
  if (!A.vertical) { $('#pVersion').hidden = true; return; }
  $('#pVersion').hidden = false;
  const rep = versionReport(S.bundle.companies, A.vertical, A.subvertical, S.bundle.causes);
  const W = rep.won.length, L = rep.lost.length, O = rep.open.length;
  rep.thin = W < 3 || L < 3; // a "pattern" from two winners is two anecdotes
  R.version = rep;
  evidence($('#versionEv'), W + L, 'finished stories');
  const top = rep.thin ? null : rep.verdicts[0];
  if (rep.thin) rep.verdicts = [];
  $('#versionHeadline').textContent = top ? top.headline
    : rep.thin ? (W ? `Too few finished stories to call a pattern: ${W} won, ${L} died. Read them one by one.` : 'Nobody has clearly won this space yet.')
    : !W ? 'Nobody has clearly won this space yet.'
    : 'No single pattern separates the winners here. Study what each one did.';
  const vl = $('#versionVerdicts'); vl.innerHTML = '';
  rep.verdicts.forEach((v) => vl.append(h('li', {}, v.text)));
  const where = rep.scope === 'niche'
    ? `Comparing the ${W} companies that won in ${A.spaceLabel} with the ${L} that died.`
    : `Your exact niche has ${rep.nicheSize} compan${rep.nicheSize === 1 ? 'y' : 'ies'}, not enough wins and failures to compare yet, so this compares ${W} winners and ${L} failures across all of ${A.verticalLabel}.`;
  $('#versionSub').textContent = `${where} ${O} more are still in play and not counted. A win here means an IPO, a sale for at least what was raised, or a $1B+ valuation held for more than five years.`;
  // the comparison table
  const tb = $('#versionTable'); tb.innerHTML = '';
  if (rep.rows.length && !rep.thin) {
    const regionNames = (rs) => rs.map((r) => REGION_NAME[r] || r).join(', ');
    tb.append(h('div', { class: 'vs-row head' }, h('span', {}, ''), h('span', { class: 'w' }, `Winners (${W})`), h('span', { class: 'l' }, `Died (${L})`)));
    for (const r of rep.rows) {
      const fmt = (x) => (r.money ? money(x) : r.regions ? regionNames(x) : x);
      tb.append(h('div', { class: 'vs-row' }, h('span', { class: 'k' }, r.k, r.note ? h('small', {}, r.note) : ''), h('span', { class: 'w' }, fmt(r.w)), h('span', { class: 'l' }, fmt(r.l))));
    }
  }
  // what the winners did
  const wb = $('#versionWinners'); wb.innerHTML = '';
  if (!rep.winnersDid.length) wb.append(h('p', { class: 'niche-note' }, `No clear winners in our data for ${A.spaceLabel} yet. That's either a warning or an opening.`));
  for (const c of rep.winnersDid) {
    wb.append(h('button', { class: 'winner', type: 'button', onclick: () => openCompany(c.id) },
      h('div', { class: 'top' }, h('b', {}, c.n.replace(/\s*\(.*\)/, '')), h('span', { class: `badge b-${c.out}` }, outcomeLabel(c))),
      h('div', { class: 'meta' }, `${flag(c.cc)} ${c.cc} · founded ${c.f || '?'} · ${label(c.v, c.sv).split(' › ').pop()}`),
      h('div', { class: 'drivers' }, c.drivers.slice(0, 3).map((d) => h('span', { class: 'drv' }, humanize(d)))),
      h('p', {}, (c.story || '').split(/(?<=\.)\s/)[0])));
  }
  // how the others died
  const db = $('#versionDied'); db.innerHTML = '';
  if (!rep.causes.length) db.append(h('p', { class: 'niche-note' }, 'No documented failures in this space in our data yet.'));
  for (const cz of rep.causes) {
    db.append(h('div', { class: 'died-row' }, h('b', {}, cz.label), h('div', { class: 'echoes' }, cz.companies.slice(0, 5).map((c) => coChip(c)))));
  }
  // better neighbours (async: each one re-runs the idea there)
  const nb = $('#versionNeighbours'); nb.innerHTML = '';
  const sims = S.matcher.similarities(R.profile.idea);
  const N = neighbourNiches(S.bundle.companies, A.vertical, A.subvertical, V[A.vertical].related, (c) => sims.get(c.id) || 0);
  if (!N.list.length) {
    nb.append(h('p', { class: 'niche-note' }, `No neighbouring niche in our data has a clearly better record than ${A.spaceLabel}${N.here.won.length + N.here.lost.length ? ` (${N.here.won.length} won, ${N.here.lost.length} died here)` : ''}.`));
    return;
  }
  const size = (c) => c.exitV || c.peak || c.raised || 0;
  const cards = N.list.map((g) => {
    const odds = h('div', { class: 'nb-odds' }, 'Re-running your idea there…');
    const btn = h('button', { type: 'button', class: 'ghost' }, 'Re-run my idea in this niche →');
    btn.onclick = () => { S.force = { idea: R.profile.idea, space: `${g.v}/${g.sv}` }; start({ skipReading: true }); };
    const card = h('div', { class: 'nb-card' },
      h('p', { class: 'eyebrow' }, g.sameVertical ? 'Same space, different niche' : 'Next door'),
      h('h4', {}, label(g.v, g.sv)),
      h('p', { class: 'nb-record' }, h('b', { class: 'g' }, `${g.won.length} won`), ' · ', h('b', { class: 'r' }, `${g.lost.length} died`), g.open.length ? ` · ${g.open.length} still in play` : ''),
      h('div', { class: 'echoes' }, g.won.slice().sort((a, b) => size(b) - size(a)).slice(0, 3).map((c) => coChip(c))),
      odds, btn);
    return { g, card, odds };
  });
  cards.forEach((x) => nb.append(x.card));
  setTimeout(() => {
    const here = Math.round(whatIf(R.profile, S.bundle).unicorns);
    for (const { g, odds } of cards) {
      const fa = S.matcher.analyze(R.profile.idea, { force: `${g.v}/${g.sv}` });
      const prof = Object.assign({}, R.profile, { sector: fa.sector, vertical: fa.vertical, subvertical: fa.subvertical, related: V[fa.vertical].related, comps: fa.comps });
      const there = Math.round(whatIf(prof, S.bundle).unicorns);
      odds.innerHTML = '';
      if (Math.abs(there - here) < 2) {
        odds.append('Simulated odds there are about the same (', h('b', {}, `${there}/1,000`), '). The edge is the real track record above.');
      } else {
        odds.append('Your idea there: ', h('b', {}, `${there}/1,000`), ` vs ${here} in your niche (long-run average)`);
      }
    }
  }, 30);
}

// ---------- why this number? ----------
function compRecord(comps) {
  const r = { n: comps.length, dead: 0, sold: 0, won: 0 };
  for (const { c } of comps) {
    if (c.out === 'dead') r.dead++;
    else if (c.out === 'acquired' || c.out === 'acquihire') r.sold++;
    else r.won++;
  }
  return r;
}

function renderWhy() {
  const R = S.run, p = R.profile, A = R.analysis;
  const headline = R.result.summary.unicorns;
  const base = Object.assign({}, p, { sector: '__baseline', comps: [], moonshot: false, founders: 'first' });
  const chain = [
    base,
    Object.assign({}, base, { sector: p.sector }),
    Object.assign({}, base, { sector: p.sector, comps: p.comps }),
    Object.assign({}, base, { sector: p.sector, comps: p.comps, founders: p.founders }),
    p,
  ].map((prof) => Math.round(whatIf(prof, S.bundle).unicorns));
  const rec = compRecord(A.comps);
  const founderLabel = { first: 'first-time founders', repeat_win: 'repeat founders with an exit', repeat_fail: 'repeat founders, last one failed' }[p.founders];
  const rows = [
    { k: `A typical ${STAGE_LABEL[p.stage].toLowerCase()} startup in ${REGION_NAME[p.region]}`, v: chain[0], base: true,
      d: 'Sourced base rates for today: how often startups at your stage raise their next round, sell or shut down.' },
    { k: `Your space: ${A.spaceLabel}`, v: chain[1] - chain[0],
      d: chain[1] === chain[0] ? 'No sector-specific valuation or timing data for this space yet, so no change.' : 'Valuation and timing differences for this sector, such as the AI valuation premium.' },
    { k: `How the ${rec.n} closest real companies did`, v: chain[2] - chain[1],
      d: rec.n ? `${rec.dead} died, ${rec.sold} sold, ${rec.won} won or are still going, compared with the average company in our data. Young companies that simply haven't died yet count for less.` : 'No close real companies yet, so no change.' },
    { k: `Your team: ${founderLabel}`, v: chain[3] - chain[2],
      d: p.founders === 'first' ? 'The baseline. Founders with a past exit succeed more often (Gompers et al., NBER).' : 'From research on repeat founders (Gompers et al., NBER).' },
    { k: `Moonshot mode ${p.moonshot ? 'on' : 'off'}`, v: chain[4] - chain[3],
      d: p.moonshot ? 'Harder early rounds and longer timelines, but much fatter tails.' : 'Normal startup odds.' },
    { k: 'This run’s luck', v: headline - chain[4],
      d: `The long-run average for this idea is ${chain[4]} in 1,000. These particular 1,000 futures landed ${Math.abs(headline - chain[4])} ${headline - chain[4] >= 0 ? 'above' : 'below'} that. This part is pure chance: another roll of the same dice would move it.` },
  ];
  $('#whyTitle').textContent = `Why ${headline}?`;
  const box = $('#whyRows'); box.innerHTML = '';
  const fmtD = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '±0');
  for (const r of rows) {
    box.append(h('div', { class: 'why-row' + (r.base ? ' base' : '') + (!r.base && r.v === 0 ? ' flat' : '') },
      h('div', {}, h('b', {}, r.k), h('p', {}, r.d)),
      h('span', { class: 'why-v ' + (r.base ? '' : r.v > 0 ? 'up' : r.v < 0 ? 'down' : '') }, r.base ? String(r.v) : fmtD(r.v))));
  }
  box.append(h('div', { class: 'why-row total' }, h('div', {}, h('b', {}, 'Futures that reached $1B in this run')), h('span', { class: 'why-v' }, `= ${headline}`)));
  $('#whyNote').textContent = 'Your idea’s wording changes the odds only through which real companies it matches. The simulator can’t see your team, traction, product or market size, and those decide more than anything on this page. Treat this as a reality check on the space, not a forecast for you.';
}

// ---------- who already tried this ----------
function renderTriedSummary() {
  const A = S.run.analysis, rec = compRecord(A.comps);
  evidence($('#compsEv'), rec.n, rec.n === 1 ? 'company' : 'companies');
  $('#triedSub').textContent = rec.n
    ? `${rec.n} real companies: ${A.nicheCount ? `${A.nicheCount} in ${A.spaceLabel}${A.verticalCount ? `, ${A.verticalCount} more from the wider ${A.verticalLabel} space` : ''}` : `all from the wider ${A.verticalLabel} space (none in this exact niche yet)`}. ${rec.dead} died, ${rec.sold} sold, ${rec.won} won or are still going. Tap any one for its rounds, its story and the sources.`
    : `No real companies in our data are close to this yet. That's either very original or very vague; try adding who it's for and how it makes money.`;
}

// ---------- questions investors will ask you ----------
const QUESTIONS = {
  no_market_need: ['What proof do you have that customers will pay, and how many already have?', 'died because not enough people needed it'],
  ran_out_of_cash: ['How many months of runway do you have, and which milestone gets you the next round?', 'ran out of money before its next round'],
  funding_crunch: ['Could you survive 18 months without raising a cent?', 'was caught when investors stopped writing cheques'],
  outcompeted: ['Who else is building this, and why do you win if they raise more than you?', 'was beaten by better-funded rivals'],
  bad_unit_economics: ['What does one customer cost you to win and serve, and what do they pay you?', 'lost money on every sale'],
  regulatory: ['Which rules or licences could shut you down, and what is your plan?', 'was killed by regulation'],
  legal_ip: ['Do you own your IP outright, and who could sue you?', 'was sunk by lawsuits'],
  fraud: ['How will an investor verify your numbers?', 'collapsed when its numbers turned out not to be real'],
  team_conflict: ['How do you and your co-founders split equity and make the big decisions?', 'fell apart at the top'],
  product_tech_failure: ['What is your riskiest technical assumption, and when will you know if it holds?', 'never got the product to work well enough'],
  too_early: ['What changed in the last two years that makes this work now?', 'was right, but too early'],
  scaled_too_fast: ['What has to be true in one market before you expand to the next?', 'expanded before the model worked'],
  failed_pivot: ['What would make you pivot, and how much runway would you have left?', 'pivoted until it ran out of road'],
  platform_dependency: ['What happens if the platform you depend on changes its rules?', 'depended on a platform that changed the rules'],
  lost_key_customer: ['How much of your revenue comes from your biggest customer?', 'lost the customer it depended on'],
  hardware_supply_chain: ['What does one unit cost to build today, and at 10,000 units?', 'was crushed by manufacturing and supply costs'],
  local_incumbent: ['Why won’t the local market leader just copy you?', 'lost to a local champion'],
  wrong_market_fit: ['Why this market first, and what is different about it?', 'picked the wrong market'],
  acquired_and_shut: ['Who would buy you, and would they keep it running?', 'was bought and switched off'],
  founder_burnout: ['Are you ready to do this for ten years if that’s what it takes?', 'ran out of founder energy before it ran out of money'],
};

function buildQuestions() {
  const R = S.run, A = R.analysis, s = R.result.summary;
  const deaths = Math.max(1, s.count.dead);
  const out = [];
  const used = new Set();
  const realDead = A.comps.filter((x) => x.c.out === 'dead' || x.c.out === 'acquihire').map((x) => x.c);
  for (const [cause, n] of Object.entries(s.causes).sort((a, b) => b[1] - a[1])) {
    if (out.length >= 4) break;
    const q = QUESTIONS[cause];
    if (!q || used.has(q[0])) continue;
    used.add(q[0]);
    let co = realDead.find((c) => (c.causes || []).includes(cause));
    if (!co) {
      const ech = Object.entries(s.echoesByCause[cause] || {}).sort((a, b) => b[1] - a[1]).map(([id]) => S.byId[id]).find((c) => c && c.v === R.profile.vertical);
      co = ech || null;
    }
    const share = Math.round((100 * n) / deaths);
    out.push({
      q: q[0], company: co,
      why: co ? `${co.n.replace(/\s*\(.*\)/, '')} (${co.e || co.f || ''}) ${q[1]}. It's behind ${share}% of the deaths in your 1,000 futures.`
              : `“${(S.bundle.causes[cause] || { label: cause }).label}” is behind ${share}% of the deaths in your 1,000 futures.`,
    });
  }
  // what the winners in the space had
  const W = A.comps.find((x) => (x.c.out === 'ipo' || x.c.out === 'private_unicorn') && (x.c.drivers || []).length);
  if (W) out.push({ q: 'What is your unfair advantage, specifically?', company: W.c, why: `${W.c.n.replace(/\s*\(.*\)/, '')}’s edge, from its story: ${W.c.drivers.slice(0, 2).map(humanize).join('; ')}. What is yours?` });
  // the pace
  const si = STAGES.indexOf(R.profile.stage);
  const nextP = R.became && R.became.pace.find((x) => STAGES.indexOf(x.stage) === si + 1 && x.wYear);
  if (nextP) out.push({ q: `When will you raise your ${STAGE_LABEL[nextP.stage]}, and at what valuation?`, why: `The futures that became unicorns closed it around ${Math.round(nextP.wYear)} at about ${money(nextP.wPost)}. Falling behind that pace is the earliest warning sign.` });
  // the money
  const own = R.take && R.take.ownership.find((o) => o.stage === 'A');
  if (own && R.take.sales) out.push({ q: 'How much are you raising, and what will you own afterwards?', why: `At typical dilution the founding team owns about ${Math.round(own.pct * 100)}% after Series A, and in ${R.take.trappedCount} of ${R.take.sales} simulated sales investor preferences left the founders with under 10% of the price.` });
  return out.slice(0, 7);
}

function renderQuestions() {
  const qs = buildQuestions();
  S.run.questions = qs;
  const ol = $('#questions'); ol.innerHTML = '';
  for (const x of qs) {
    ol.append(h('li', {}, h('b', {}, x.q), h('p', {}, x.why, x.company ? [' ', h('a', { class: 'q-co', onclick: () => openCompany(x.company.id) }, `See ${x.company.n.replace(/\s*\(.*\)/, '')}’s story →`)] : '')));
  }
  $('#btnCopyQs').onclick = () => copy(`Questions investors will ask about: “${S.run.profile.idea}”\n\n` + qs.map((x, i) => `${i + 1}. ${x.q}\n   Why: ${x.why}`).join('\n\n') + `\n\nFrom 1,000 Futures · ${location.href}`);
}

function renderWhere() {
  const R = S.run;
  const box = $('#whereBox'); box.innerHTML = '';
  const startIdx = STAGES.indexOf(R.profile.stage);
  const defStage = STAGES[Math.min(STAGES.length - 1, startIdx + 1)];
  const defPost = Math.round((S.bundle.ladders[R.profile.region] || S.bundle.ladders.global)[defStage].post / 1e6);
  const stageSel = h('select', { id: 'wStage' }, STAGES.slice(startIdx).map((s) => h('option', { value: s, selected: s === defStage ? 'selected' : null }, STAGE_LABEL[s])));
  const yearSel = h('select', { id: 'wYear' }, Array.from({ length: 10 }, (_, i) => START_YEAR + i + 1).map((y) => h('option', { value: y, selected: y === START_YEAR + 2 ? 'selected' : null }, y)));
  const val = h('input', { id: 'wPost', type: 'number', min: 0, step: 1, value: defPost, class: 'text-in', inputmode: 'numeric' });
  const out = h('p', { class: 'where-out', 'aria-live': 'polite' });
  const run = () => {
    const w = whereNow(R.result.universes, stageSel.value, +yearSel.value, (+val.value || 0) * 1e6, S.cof);
    out.innerHTML = '';
    if (w.n < 8) {
      out.append(`Only ${w.n} of your 1,000 futures were at ${STAGE_LABEL[stageSel.value]} with a ${money(+val.value * 1e6)}+ valuation by ${yearSel.value}. If that's you, you're ahead of almost every version of this idea.`);
      return;
    }
    out.append(h('b', {}, `${w.n} futures`), ` looked like you by ${yearSel.value}. `,
      h('b', { class: 'g' }, `${pctOf(w.unicorn, w.n)} of them became unicorns`), ` (vs ${pctOf(w.baseUnicorn * 1000)} of all futures), `,
      h('b', { class: 'r' }, `${pctOf(w.dead, w.n)} still died`), `, and the median founder took home ${cash$(w.medianCash)}.`);
  };
  [stageSel, yearSel, val].forEach((x) => x.addEventListener('input', run));
  box.append(h('p', { class: 'eyebrow' }, 'Where are you now?'),
    h('p', { class: 'panel-sub small' }, 'Come back as you grow. Tell us where you are, and we’ll show what happened to the futures that looked like you then.'),
    h('div', { class: 'where-form' },
      h('label', {}, h('span', { class: 'field-label' }, 'Reached'), stageSel),
      h('label', {}, h('span', { class: 'field-label' }, 'By'), yearSel),
      h('label', {}, h('span', { class: 'field-label' }, 'Valued at ($M)'), val)),
    out);
  run();
}

// ---------- dialogs ----------
function openUniverse(u) {
  const body = $('#dlgBody'); body.innerHTML = '';
  const label = { dead: 'Died', acquihire: 'Fire sale', acquired: 'Acquired', ipo: 'IPO', unicorn: 'Private unicorn, still going', alive: 'Still going' }[u.outcome];
  body.append(h('p', { class: 'eyebrow' }, `Universe #${u.index + 1} of 1,000`), h('h3', {}, label), h('div', { class: 'sub' }, `Raised ${money(u.raised)} in total · peak valuation ${money(u.peak)}`));
  const ul = h('ol', { class: 'timeline' });
  for (const e of u.events) {
    const when = h('span', { class: 'when' }, `${yearOf(e.t)}${e.t ? ` · month ${Math.round(e.t)}` : ''}`);
    if (e.type === 'start') ul.append(h('li', {}, when, `Today: you're at ${STAGE_LABEL[e.stage]}, valued about ${money(e.post)} post-money.`));
    else if (e.type === 'raise') ul.append(h('li', { class: e.post >= 1e9 ? 'gold' : '' }, when, `Raised a ${STAGE_LABEL[e.stage]}: ${money(e.round)} at ${money(e.post)} post-money.${e.post >= 1e9 ? ' 🦄 Unicorn.' : ''}`));
    else if (e.type === 'near_death') ul.append(h('li', { class: 'moon' }, when, 'Nearly died: out of runway, then rescued at the last minute. Moonshots often get one of these.'));
    else if (e.type === 'ipo') ul.append(h('li', { class: 'gold' }, when, `Went public at a ${money(e.value)} market cap.`));
    else if (e.type === 'acquired' || e.type === 'acquihire') ul.append(h('li', { class: 'acq' }, when, e.type === 'acquihire' ? `Sold for ${money(e.value)}, less than it raised: investors with liquidation preferences get paid first.` : `Acquired for ${money(e.value)}.`));
    else if (e.type === 'dead') {
      const cause = S.bundle.causes[e.cause] || { label: e.cause, desc: '' };
      const echo = S.byId[e.echo];
      ul.append(h('li', { class: 'dead' }, when, h('b', {}, `Shut down at ${STAGE_LABEL[e.stage]}: ${cause.label}.`), e.winter ? ' A funding winter made it worse.' : '', h('br'), cause.desc,
        echo ? h('div', { style: 'margin-top:8px' }, 'Real-world echo: ', coChip(echo), h('div', { style: 'color:var(--ink-2);font-size:13.5px;margin-top:6px' }, echo.story || '')) : ''));
    }
  }
  if (u.outcome === 'alive' || u.outcome === 'unicorn') ul.append(h('li', { class: u.outcome === 'unicorn' ? 'gold' : '' }, h('span', { class: 'when' }, START_YEAR + 10), `Still going at ${STAGE_LABEL[u.stageReached]}, last valued at ${money(u.post)}.`));
  body.append(ul);
  $('#dlg').showModal();
}

// "Suggest a correction": shown only when CONFIG.corrections is set
function fixLink(subject) {
  const href = CONFIG.correctionHref(subject);
  return href ? h('p', { class: 'fix-link' }, h('a', { href, target: '_blank', rel: 'noopener' }, `Something wrong about ${subject}? Suggest a correction →`)) : '';
}

function openCompany(id) {
  const c = S.byId[id]; if (!c) return;
  const body = $('#dlgBody'); body.innerHTML = '';
  body.append(
    h('p', { class: 'eyebrow' }, `${flag(c.cc)} ${c.city ? c.city + ', ' : ''}${c.cc} · ${label(c.v, c.sv)}`),
    h('h3', {}, c.n, ' ', h('span', { class: `badge b-${c.out}`, style: 'vertical-align:middle;font-size:12px' }, outcomeLabel(c))),
    h('div', { class: 'sub' }, `${c.f || '?'}${c.e ? '–' + c.e : '–today'} · raised ${money(c.raised)}${c.peak ? ' · peak valuation ' + money(c.peak) : ''}${c.exitV ? ' · exit ' + money(c.exitV) : ''}`),
    h('p', {}, c.o), c.story ? h('p', { style: 'color:var(--ink-2)' }, c.story) : '',
  );
  if (c.causes && c.causes.length) body.append(h('p', {}, h('b', {}, 'Why it died: '), c.causes.map((x) => (S.bundle.causes[x] || { label: x }).label).join(' · ')));
  if (c.drivers && c.drivers.length) body.append(h('p', {}, h('b', {}, 'What drove it: '), c.drivers.map((x) => x.replace(/_/g, ' ')).join(' · ')));
  for (const n of (c.near || [])) body.append(h('p', {}, h('b', { style: 'color:var(--moon)' }, `Near death, ${n.year}: `), n.what));
  if (c.rounds && c.rounds.length) {
    body.append(h('table', { class: 'rounds' },
      h('tr', {}, h('th', {}, 'Round'), h('th', {}, 'Year'), h('th', {}, 'Amount'), h('th', {}, 'Post-money'), h('th', {}, 'Lead')),
      c.rounds.map((r) => h('tr', {}, h('td', {}, STAGE_LABEL[r.stage] || r.stage), h('td', {}, r.year || ''), h('td', {}, money(r.amount_usd)), h('td', {}, money(r.post_money_usd)), h('td', {}, r.lead || '')))));
  }
  if (c.twin && S.bundle.twins[c.twin]) {
    const g = S.bundle.twins[c.twin];
    body.append(h('p', {}, h('b', {}, 'Same idea elsewhere: '), g.lesson || g.idea), h('div', { class: 'echoes' }, g.members.map((m) => S.byId[m]).filter((x) => x && x.id !== c.id).map((x) => coChip(x))));
  }
  body.append(h('div', { class: 'sources' }, h('p', { class: 'eyebrow', style: 'margin-top:18px' }, `Sources · confidence: ${c.conf || 'medium'}`),
    (c.src || []).map((u) => h('div', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, u)))), fixLink(c.n.replace(/\s*\(.*\)/, '')));
  const d = $('#dlg');
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}

// ---------- sharing ----------
function shareData() {
  const R = S.run;
  const best = R.regions && R.regions[0];
  return {
    idea: R.profile.idea, summary: R.result.summary, universes: R.result.universes, buckets: R.buckets,
    killer: topKiller(), bestMarket: best ? `${REGION_NAME[best.region]} (${Math.round(best.unicorns)}/1,000)` : null,
    archetype: R.arch, obit: R.lives && R.lives.obit, best: R.lives && R.lives.best, takeLine: R.takeLine,
    tried: compRecord(R.analysis.comps), space: R.analysis.spaceLabel,
  };
}
async function openShare(kind) {
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  if (typeof kind === 'string') {
    S.card = kind;
    [...$('#cardSeg').children].forEach((x) => x.classList.toggle('on', x.dataset.v === kind));
  }
  renderCard();
  $('#shareText').textContent = shareText(shareData(), location.href);
  $('#shareDlg').showModal();
}
function renderCard() { drawCard($('#shareCanvas'), S.card, shareData()); }
function downloadCard() {
  $('#shareCanvas').toBlob((blob) => {
    const a = h('a', {}); a.href = URL.createObjectURL(blob); a.download = `1000-futures-${S.card}.png`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
async function challenge() {
  const text = shareText(shareData(), location.href);
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ } }
  copy(text);
}

init().catch((e) => {
  console.error(e);
  document.body.append(h('p', { style: 'padding:20px;color:#ff8a80' }, 'Could not load the dataset (data/bundle.json). Run scripts/build_data.py, then serve the site folder.'));
});
