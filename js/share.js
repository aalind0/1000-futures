// Share cards (9:16 story, 4:5 post, 1.91:1 link) and the emoji-grid text share.

import { drawGrid } from './viz.js';
import { CONFIG } from './config.js';

const SIZES = { story: [1080, 1920], post: [1080, 1350], wide: [1200, 630], obit: [1080, 1920], best: [1080, 1920] };
const SERIF = '"Instrument Serif", Georgia, serif', MONO = '"JetBrains Mono", ui-monospace, monospace', SANS = '"Inter Tight", system-ui, sans-serif';

function centered(ctx, text, y, maxW, lh, maxLines = 3) {
  const lines = wrap(ctx, text, maxW);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…'); }
  lines.forEach((l, i) => ctx.fillText(l, 540, y + i * lh));
  return y + lines.length * lh;
}

function footer(ctx, W, H, idea) {
  ctx.textAlign = 'center';
  ctx.font = `28px ${SANS}`; ctx.fillStyle = '#8b94a7';
  if (idea) centered(ctx, `“${idea}”`, H - 210, W - 200, 38, 2);
  ctx.font = `28px ${MONO}`; ctx.fillStyle = '#6f7a8f';
  ctx.fillText(`Simulate yours → ${CONFIG.siteLabel()}`, W / 2, H - 90);
  ctx.textAlign = 'left';
}

function brandCentered(ctx, W, y) {
  ctx.font = `600 30px ${SANS}`;
  const label = '1,000 FUTURES';
  const w = ctx.measureText(label).width + 30;
  const x0 = W / 2 - w / 2;
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(x0 + 9, y - 10, 9, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#eef1f8'; ctx.textAlign = 'left'; ctx.fillText(label, x0 + 30, y);
}

function drawObit(ctx, W, H, o) {
  ctx.fillStyle = '#06070b'; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, W);
  g.addColorStop(0, 'rgba(120,130,160,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  brandCentered(ctx, W, 120);
  // tombstone
  const x0 = 150, x1 = 930, top = 300, bottom = 1500, r = (x1 - x0) / 2;
  ctx.beginPath();
  ctx.moveTo(x0, bottom); ctx.lineTo(x0, top + r); ctx.arc((x0 + x1) / 2, top + r, r, Math.PI, 0); ctx.lineTo(x1, bottom); ctx.closePath();
  g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#2b2f3a'); g.addColorStop(1, '#171a22');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0 + 30, bottom); ctx.lineTo(x0 + 30, top + r); ctx.arc((x0 + x1) / 2, top + r, r - 30, Math.PI, 0); ctx.lineTo(x1 - 30, bottom); ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = `32px ${MONO}`; ctx.fillStyle = '#9aa3b6'; ctx.fillText('H E R E   L I E S', W / 2, 520);
  ctx.font = `92px ${SERIF}`; ctx.fillStyle = '#f1f3f8';
  let y = centered(ctx, o.name, 640, 660, 96, 2);
  ctx.font = `54px ${SERIF}`; ctx.fillStyle = '#aab3c5'; ctx.fillText(`${o.startYear} – ${o.endYear}`, W / 2, y + 16);
  y += 70;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - 120, y); ctx.lineTo(W / 2 + 120, y); ctx.stroke();
  y += 80;
  ctx.font = `40px ${SANS}`; ctx.fillStyle = '#eef1f8'; ctx.fillText(`Died at ${o.stageLabel}`, W / 2, y);
  ctx.fillStyle = '#ff8a80'; ctx.fillText(`of ${o.causeLabel.toLowerCase()}`, W / 2, y + 54);
  ctx.font = `italic 44px ${SERIF}`; ctx.fillStyle = '#c9cfdc';
  y = centered(ctx, o.quip, y + 150, 640, 56, 3);
  ctx.font = `28px ${MONO}`; ctx.fillStyle = '#8b94a7';
  ctx.fillText(`Raised ${o.raised} · peak value ${o.peak}`, W / 2, y + 40);
  if (o.echo) { ctx.font = `32px ${SANS}`; ctx.fillStyle = '#aab3c5'; ctx.fillText(`Like ${o.echo} before it.`, W / 2, y + 100); }
  // the graveyard it belongs to
  ctx.fillStyle = 'rgba(255,90,78,0.55)';
  for (let i = 0; i < 60; i++) { const xx = 120 + (i % 30) * 29, yy = 1560 + Math.floor(i / 30) * 26; ctx.beginPath(); ctx.arc(xx, yy, 6, 0, 6.283); ctx.fill(); }
  ctx.font = `30px ${MONO}`; ctx.fillStyle = '#ff9d94';
  ctx.fillText(`1 of ${o.totalDead} deaths in 1,000 futures`, W / 2, 1650);
  footer(ctx, W, H, o.idea);
}

function drawBest(ctx, W, H, b) {
  ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, W * 1.1);
  g.addColorStop(0, 'rgba(255,216,77,0.20)'); g.addColorStop(1, 'rgba(255,216,77,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  brandCentered(ctx, W, 120);
  ctx.textAlign = 'center';
  ctx.font = `32px ${MONO}`; ctx.fillStyle = '#ffd84d'; ctx.fillText('T H E   O N E   T H A T   M A D E   I T', W / 2, 250);
  ctx.font = `32px ${SANS}`; ctx.fillStyle = '#8b94a7'; ctx.fillText(`Universe #${b.index} of 1,000`, W / 2, 300);
  ctx.font = `86px ${SERIF}`; ctx.fillStyle = '#f1f3f8';
  let y = centered(ctx, b.name, 420, 900, 90, 2);
  ctx.font = `92px ${SERIF}`; ctx.fillStyle = '#ffd84d';
  ctx.fillText(b.value, W / 2, y + 100);
  ctx.font = `38px ${SANS}`; ctx.fillStyle = '#d6dcea'; ctx.fillText(b.headline, W / 2, y + 160);
  // timeline
  y += 250;
  ctx.textAlign = 'left';
  const steps = b.timeline.slice(-7);
  const x = 210, gap = 78;
  ctx.strokeStyle = 'rgba(255,216,77,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + (steps.length - 1) * gap); ctx.stroke();
  steps.forEach((s, i) => {
    const yy = y + i * gap, last = i === steps.length - 1;
    ctx.fillStyle = last ? '#ffd84d' : '#c4deff';
    ctx.beginPath(); ctx.arc(x, yy, last ? 16 : 10, 0, 6.283); ctx.fill();
    ctx.font = `30px ${MONO}`; ctx.fillStyle = '#8b94a7'; ctx.fillText(String(s.year), x + 40, yy + 10);
    ctx.font = `${last ? '600 ' : ''}34px ${SANS}`; ctx.fillStyle = last ? '#ffd84d' : '#eef1f8'; ctx.fillText(s.text, x + 150, yy + 12);
  });
  y += (steps.length - 1) * gap + 90;
  ctx.textAlign = 'center';
  // the lesson, not the payout, is the point of this card
  ctx.strokeStyle = 'rgba(255,216,77,0.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(130, y - 10, W - 260, 220);
  ctx.font = `30px ${MONO}`; ctx.fillStyle = '#ffd84d'; ctx.fillText('THE PACE IT KEPT', W / 2, y + 40);
  ctx.font = `40px ${SANS}`; ctx.fillStyle = '#eef1f8';
  centered(ctx, b.lesson || '', y + 100, W - 340, 50, 3);
  ctx.font = `28px ${SANS}`; ctx.fillStyle = '#8b94a7'; ctx.fillText(b.takeNote, W / 2, y + 270);
  ctx.font = `30px ${MONO}`; ctx.fillStyle = '#aab3c5'; ctx.fillText(b.odds, W / 2, y + 325);
  footer(ctx, W, H, b.idea);
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/); const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function bg(ctx, W, H) {
  ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W * 0.8, -H * 0.05, 10, W * 0.8, -H * 0.05, W * 1.1);
  g.addColorStop(0, 'rgba(255,216,77,0.16)'); g.addColorStop(1, 'rgba(255,216,77,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(0, H, 10, 0, H, W);
  g.addColorStop(0, 'rgba(182,156,255,0.14)'); g.addColorStop(1, 'rgba(182,156,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function dotLabel(ctx, x, y, color, text) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + 9, y - 10, 9, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#d6dcea'; ctx.fillText(text, x + 30, y);
  return ctx.measureText(text).width + 64;
}

export function drawCard(canvas, kind, data) {
  const [W, H] = SIZES[kind];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (kind === 'obit') { if (data.obit) drawObit(ctx, W, H, data.obit); return; }
  if (kind === 'best') { if (data.best) drawBest(ctx, W, H, data.best); return; }
  bg(ctx, W, H);
  const pad = kind === 'wide' ? 56 : 84;
  const serif = '"Instrument Serif", Georgia, serif', mono = '"JetBrains Mono", ui-monospace, monospace', sans = '"Inter Tight", system-ui, sans-serif';
  const s = data.summary;

  // brand
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(pad + 9, pad + 4, 9, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#eef1f8'; ctx.font = `600 ${kind === 'wide' ? 26 : 32}px ${sans}`;
  ctx.textBaseline = 'middle'; ctx.fillText('1,000 FUTURES', pad + 30, pad + 5); ctx.textBaseline = 'alphabetic';

  if (kind === 'wide') {
    ctx.font = `46px ${serif}`; ctx.fillStyle = '#eef1f8';
    const lines = wrap(ctx, `“${data.idea}”`, 560).slice(0, 4);
    lines.forEach((l, i) => ctx.fillText(l, pad, 150 + i * 52));
    ctx.font = `150px ${serif}`; ctx.fillStyle = '#ffd84d';
    ctx.fillText(String(s.unicorns), pad, 470);
    const nw = ctx.measureText(String(s.unicorns)).width;
    ctx.font = `44px ${serif}`; ctx.fillStyle = '#6f7a8f'; ctx.fillText('/1,000', pad + nw + 10, 470);
    ctx.font = `24px ${sans}`; ctx.fillStyle = '#aab3c5'; ctx.fillText('futures reached a $1B valuation', pad, 512);
    ctx.font = `22px ${mono}`; ctx.fillStyle = '#6f7a8f'; ctx.fillText(`Simulate yours → ${CONFIG.siteLabel()}`, pad, H - 44);
    drawGrid(ctx, 680, 110, 470, 300, data.universes, { cols: 40 });
    ctx.font = `20px ${mono}`;
    let x = 690; const y = 460;
    x += dotLabel(ctx, x, y, '#ff5a4e', `${data.buckets.dead} died`);
    dotLabel(ctx, x, y, '#ffb547', `${data.buckets.sold} sold`);
    if (data.archetype) { ctx.font = `30px ${sans}`; ctx.fillStyle = '#ffd84d'; ctx.fillText(`${data.archetype.em} ${data.archetype.name}`, 690, 520); }
    return;
  }

  const story = kind === 'story';
  let y = story ? 250 : 200;
  ctx.font = `${story ? 30 : 26}px ${mono}`; ctx.fillStyle = '#6f7a8f';
  ctx.fillText('I SIMULATED MY STARTUP 1,000 TIMES', pad, y); y += story ? 80 : 66;
  ctx.font = `${story ? 66 : 56}px ${serif}`; ctx.fillStyle = '#eef1f8';
  const lines = wrap(ctx, `“${data.idea}”`, W - pad * 2);
  const maxLines = 3;
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…”'); }
  lines.forEach((l) => { ctx.fillText(l, pad, y); y += story ? 74 : 62; });
  y += story ? 230 : 160;
  ctx.font = `${story ? 280 : 210}px ${serif}`; ctx.fillStyle = '#ffd84d';
  ctx.shadowColor = 'rgba(255,216,77,0.35)'; ctx.shadowBlur = 60;
  ctx.fillText(String(s.unicorns), pad - 8, y);
  ctx.shadowBlur = 0;
  const nw = ctx.measureText(String(s.unicorns)).width;
  ctx.font = `${story ? 84 : 64}px ${serif}`; ctx.fillStyle = '#6f7a8f'; ctx.fillText('/1,000', pad + nw + 6, y);
  y += story ? 64 : 52;
  ctx.font = `${story ? 40 : 34}px ${sans}`; ctx.fillStyle = '#aab3c5';
  ctx.fillText('futures reached a $1B valuation', pad, y);
  if (data.archetype) {
    y += story ? 76 : 58;
    ctx.font = `600 ${story ? 42 : 34}px ${sans}`; ctx.fillStyle = '#ffd84d';
    ctx.fillText(`${data.archetype.em}  ${data.archetype.name}`, pad, y);
  }
  y += story ? 50 : 34;
  const gh = story ? 470 : 290;
  drawGrid(ctx, pad, y, W - pad * 2, gh, data.universes, { cols: 40 });
  y += gh + (story ? 80 : 56);
  ctx.font = `${story ? 32 : 28}px ${mono}`;
  let x = pad;
  x += dotLabel(ctx, x, y, '#ff5a4e', `${data.buckets.dead} died`);
  x += dotLabel(ctx, x, y, '#ffb547', `${data.buckets.sold} sold`);
  dotLabel(ctx, x, y, '#8fa3bf', `${data.buckets.going} still going`);
  y += story ? 76 : 60;
  ctx.font = `${story ? 34 : 29}px ${sans}`; ctx.fillStyle = '#eef1f8';
  if (data.killer) { wrap(ctx, `#1 killer: ${data.killer}`, W - pad * 2).slice(0, 2).forEach((l) => { ctx.fillText(l, pad, y); y += story ? 46 : 40; }); }
  if (data.tried && data.tried.n && story) { ctx.fillStyle = '#aab3c5'; ctx.fillText(`${data.tried.n} real companies tried this · ${data.tried.dead} died`, pad, y); }
  else if (data.bestMarket && story) { ctx.fillStyle = '#aab3c5'; ctx.fillText(`Best market for it: ${data.bestMarket}`, pad, y); }
  ctx.font = `${story ? 30 : 26}px ${mono}`; ctx.fillStyle = '#6f7a8f';
  ctx.fillText(`Simulate yours → ${CONFIG.siteLabel()}`, pad, H - (story ? 110 : 70));
}

export function shareText(data, link) {
  const b = data.buckets; // { gold, sold, going, dead } — disjoint, sums to 1,000
  const n = 50, per = 1000 / n;
  const cells = [];
  let used = 0;
  for (const [e, v] of [['🟨', b.gold], ['🟧', b.sold], ['⬜', b.going]]) {
    let k = Math.round(v / per);
    if (v > 0) k = Math.max(1, k);
    k = Math.min(k, n - used);
    for (let i = 0; i < k; i++) cells.push(e);
    used += k;
  }
  while (cells.length < n) cells.push('🟥');
  const rows = [];
  for (let i = 0; i < n; i += 10) rows.push(cells.slice(i, i + 10).join(''));
  return [
    data.tried && data.tried.n ? `I checked my startup idea against ${data.tried.n} real companies that tried something like it, then ran it 1,000 times 🌌` : `I ran my startup through 1,000 futures 🌌`,
    `“${data.idea}”`,
    data.archetype ? `Verdict: ${data.archetype.em} ${data.archetype.name}` : null,
    '',
    rows.join('\n'),
    `🟨 ${b.gold} hit $1B · 🟧 ${b.sold} sold · 🟥 ${b.dead} died`,
    data.tried && data.tried.n ? `👀 Of the ${data.tried.n} real ones, ${data.tried.dead} died and ${data.tried.won} won or are still going` : null,
    data.obit ? `🪦 Most likely ending: died at ${data.obit.stageLabel} in ${data.obit.endYear}, ${data.obit.causeLabel.toLowerCase()}` : null,
    data.takeLine || null,
    data.killer ? `#1 killer: ${data.killer}` : '',
    '',
    `Can your idea beat ${b.gold}/1,000? ${link}`,
  ].filter((l) => l !== null).filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}
