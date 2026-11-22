// The multiverse: 1,000 particles moving through the funding ladder on a canvas.
// Phases: burst (dots explode out of one point) → play (10 years) → reveal (losers dim, gold pulses).

import { STAGES, STAGE_LABEL, HORIZON, START_YEAR } from './engine.js';

// Two palettes: dark (glowing dots, additive blend) and light (ink on paper, normal blend).
const PAL = {
  dark: {
    alive: [196, 222, 255], dead: [255, 90, 78], deadDim: [140, 46, 42], zombie: [120, 136, 160],
    acquired: [255, 181, 71], acquihire: [217, 137, 58], gold: [255, 216, 77], ipo: [255, 224, 102], moon: [182, 156, 255],
    ink: 'rgba(214,222,240,0.62)', faint: 'rgba(255,255,255,0.035)', winterFaint: 'rgba(160,200,255,0.05)',
    winterTop: 'rgba(130,180,255,0.10)', winterBottom: 'rgba(130,180,255,0.02)', grave: 'rgba(255,90,78,0.05)',
    graveInk: 'rgba(255,120,110,0.75)', tally: 'rgba(255,140,130,0.9)',
    exitInk: { ipo: 'rgba(255,224,102,0.9)', acquired: 'rgba(255,181,71,0.9)', acquihire: 'rgba(217,137,58,0.9)' },
    ring: '#ffffff', ringHover: 'rgba(255,255,255,0.7)', blend: 'lighter', aliveAlpha: 0.55,
    veil: [7, 8, 13], bigInk: [255, 216, 77], subInk: [238, 241, 248], glowShadow: 'rgba(255,216,77,0.45)',
  },
  light: {
    alive: [47, 95, 152], dead: [200, 64, 46], deadDim: [214, 138, 126], zombie: [158, 166, 180],
    acquired: [194, 118, 18], acquihire: [168, 89, 42], gold: [216, 158, 0], ipo: [216, 158, 0], moon: [100, 72, 200],
    ink: 'rgba(77,83,94,0.85)', faint: 'rgba(22,24,29,0.03)', winterFaint: 'rgba(71,120,200,0.05)',
    winterTop: 'rgba(71,120,200,0.10)', winterBottom: 'rgba(71,120,200,0.02)', grave: 'rgba(200,64,46,0.045)',
    graveInk: 'rgba(178,58,42,0.9)', tally: 'rgba(178,58,42,0.95)',
    exitInk: { ipo: 'rgba(168,115,0,0.95)', acquired: 'rgba(194,118,18,0.95)', acquihire: 'rgba(168,89,42,0.95)' },
    ring: '#16181d', ringHover: 'rgba(22,24,29,0.6)', blend: 'source-over', aliveAlpha: 0.5,
    veil: [251, 250, 247], bigInk: [168, 115, 0], subInk: [22, 24, 29], glowShadow: 'rgba(242,193,58,0.35)',
  },
};
const palette = () => (document.documentElement.dataset.theme === 'dark' ? PAL.dark : PAL.light);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const EXIT = new Set(['acquired', 'acquihire', 'ipo']);
const BURST_S = 1.1, REVEAL_S = 2.8;

export class Multiverse {
  constructor(canvas, cb = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = cb;
    this.speed = 1;
    this.playing = false;
    this.t = 0; // months
    this.secondsForFull = 20; // at 1x
    this.hover = -1;
    this.selected = -1;
    this.bursts = [];
    this.clock = 0;
    window.addEventListener('resize', () => { this.layout(true); this.draw(); });
    canvas.addEventListener('mousemove', (e) => this.pointer(e, false));
    canvas.addEventListener('click', (e) => this.pointer(e, true));
    canvas.addEventListener('mouseleave', () => { this.hover = -1; this.cb.onHover && this.cb.onHover(null); if (!this.playing) this.draw(); });
  }

  load(result) {
    cancelAnimationFrame(this.raf);
    this.result = result;
    this.winter = result.params.sharedWinter;
    this.parts = result.universes.map((u, i) => {
      let uniT = Infinity;
      for (const e of u.events) {
        if ((e.post || 0) >= 1e9 || (e.type === 'ipo' && e.value >= 1e9)) { uniT = e.t; break; }
      }
      return { u, i, x: 0, y: 0, home: Math.random(), jx: Math.random(), phase: Math.random() * Math.PI * 2, flash: 0, slot: -1, uniT };
    });
    this.t = 0;
    this.phase = 'idle';
    this.reveal = 0;
    this.selected = -1;
    // pile slots in order of arrival so piles grow realistically
    const byKey = {};
    for (const p of this.parts) {
      const last = p.u.events[p.u.events.length - 1];
      if (last.type === 'dead' || EXIT.has(last.type)) {
        const key = last.type === 'dead' ? 'dead:' + last.stage : last.type;
        (byKey[key] = byKey[key] || []).push(p);
      }
    }
    for (const list of Object.values(byKey)) {
      list.sort((a, b) => a.u.endT - b.u.endT);
      list.forEach((p, k) => { p.slot = k; });
    }
    this.layout(false);
    // everything starts as one point: the idea, before it splits into 1,000 futures
    const o = this.origin();
    for (const p of this.parts) { p.x = o.x + (Math.random() - 0.5) * 2; p.y = o.y + (Math.random() - 0.5) * 2; }
    this.draw();
  }

  origin() {
    const s = this.result.universes[0].events[0].stage;
    return { x: this.cols[STAGES.indexOf(s)], y: (this.top + 26 + this.bandBottom) / 2 };
  }

  layout(snap) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = this.W, H = this.H;
    this.narrow = W < 640;
    this.dot = this.narrow ? 1.6 : 2.1;
    this.gap = this.narrow ? 3.4 : 4.6;
    const left = this.narrow ? 8 : 24, exitW = this.narrow ? 70 : Math.min(190, W * 0.17);
    const right = W - exitW - (this.narrow ? 10 : 28);
    this.colW = (right - left) / STAGES.length;
    this.cols = STAGES.map((s, i) => left + this.colW * (i + 0.5));
    this.top = this.narrow ? 34 : 44;
    this.graveTop = H * 0.70;
    this.bandBottom = this.graveTop - 22;
    this.exitX0 = right + (this.narrow ? 6 : 16);
    this.exitW = exitW;
    const span = H * 0.70 - this.top;
    this.zones = {
      ipo: { y0: this.top + 18, label: 'IPO' },
      acquired: { y0: this.top + 18 + span * 0.34, label: 'Acquired' },
      acquihire: { y0: this.top + 18 + span * 0.67, label: 'Fire sale' },
    };
    if (snap && this.parts) for (const p of this.parts) { const tg = this.target(p, this.t); p.x = tg.x; p.y = tg.y; }
  }

  pileSlot(x0, width, yRef, slot, up) {
    const perRow = Math.max(4, Math.floor(width / this.gap));
    const cx = slot % perRow, cy = Math.floor(slot / perRow);
    return { x: x0 + cx * this.gap + this.gap / 2, y: up ? yRef - cy * this.gap : yRef + cy * this.gap };
  }

  currentEvent(p, t) {
    const ev = p.u.events;
    let k = 0;
    while (k + 1 < ev.length && ev[k + 1].t <= t) k++;
    return ev[k];
  }

  target(p, t) {
    const e = this.currentEvent(p, t);
    if (e.type === 'dead') {
      const c = this.cols[STAGES.indexOf(e.stage)], w = this.colW * 0.86;
      return this.pileSlot(c - w / 2, w, this.H - 10, p.slot, true);
    }
    if (EXIT.has(e.type)) return this.pileSlot(this.exitX0, this.exitW, this.zones[e.type].y0 + 6, p.slot, false);
    const c = this.cols[STAGES.indexOf(e.stage)];
    const wob = this.phase === 'play' ? Math.sin(this.clock * 1.3 + p.phase) * 1.2 : 0;
    return { x: c + (p.jx - 0.5) * this.colW * 0.78 + wob, y: this.top + 26 + p.home * (this.bandBottom - this.top - 30) };
  }

  // ---------- playback ----------
  loop() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.clock += dt;
      if (this.phase === 'burst') {
        this.burstLeft -= dt;
        if (this.burstLeft <= 0) this.phase = 'play';
      } else if (this.phase === 'play' && this.playing) {
        this.advance(dt * this.speed * HORIZON / this.secondsForFull);
        if (this.t >= HORIZON) this.startReveal();
      } else if (this.phase === 'reveal') {
        this.reveal = Math.min(1, (now - this.revealT0) / 1000 / REVEAL_S);
        if (this.reveal >= 1) {
          this.phase = 'done';
          this.draw();
          this.cb.onDone && this.cb.onDone();
          return;
        }
      }
      this.draw();
      if (this.phase === 'done' || (!this.playing && this.phase === 'play')) return;
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  play() {
    if (!this.result) return;
    if (this.phase === 'done' || this.phase === 'reveal') return;
    this.playing = true;
    if (this.phase === 'idle') { this.phase = 'burst'; this.burstLeft = BURST_S; }
    this.loop();
  }

  pause() { this.playing = false; }

  seek(t) {
    if (!this.parts) return;
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.phase !== 'done') this.phase = 'play';
    this.t = Math.max(0, Math.min(HORIZON, t));
    // the end-of-run overlay belongs to the end; scrubbing back shows the plain multiverse
    if (this.phase === 'done') this.reveal = this.t >= HORIZON - 0.01 ? 1 : 0;
    for (const p of this.parts) { const tg = this.target(p, this.t); p.x = tg.x; p.y = tg.y; p.flash = 0; }
    this.cb.onTick && this.cb.onTick(this.t, this.counts(this.t), true);
    this.draw();
  }

  skip() {
    if (!this.parts || this.phase === 'done' || this.phase === 'reveal') return;
    this.advance(HORIZON - this.t + 0.001, true);
    for (const p of this.parts) { const tg = this.target(p, HORIZON); p.x = tg.x; p.y = tg.y; p.flash = 0; }
    this.playing = true;
    this.startReveal(0.4);
  }

  startReveal(head = 0) {
    this.phase = 'reveal';
    this.revealT0 = performance.now() - head * REVEAL_S * 1000;
    this.cb.onRevealStart && this.cb.onRevealStart();
    this.loop();
  }

  advance(dm, silent) {
    const t0 = this.t;
    this.t = Math.min(HORIZON, this.t + dm);
    const fired = [];
    for (const p of this.parts) {
      for (const e of p.u.events) {
        if (e.t > t0 && e.t <= this.t && e.type !== 'start') {
          fired.push({ p, e });
          if (!silent) {
            p.flash = 1;
            const pal = this.pal || palette();
            if (e.type === 'dead') this.bursts.push({ x: p.x, y: p.y, r: 0, c: pal.dead });
            if (p.uniT === e.t) this.bursts.push({ x: p.x, y: p.y, r: 0, c: pal.gold, big: true });
          }
        }
      }
    }
    fired.sort((a, b) => a.e.t - b.e.t);
    if (this.cb.onEvent) fired.forEach((f) => this.cb.onEvent(f.p.u, f.e, silent));
    this.cb.onTick && this.cb.onTick(this.t, this.counts(this.t));
  }

  counts(t) {
    const c = { alive: 0, dead: 0, exited: 0, unicorn: 0 };
    for (const p of this.parts) {
      const e = this.currentEvent(p, t);
      if (e.type === 'dead') c.dead++;
      else if (EXIT.has(e.type)) c.exited++;
      else c.alive++;
      if (p.uniT <= t) c.unicorn++;
    }
    return c;
  }

  winterAt(t) { return !!this.winter && t >= this.winter.start && t <= this.winter.start + this.winter.len; }

  colorOf(p, e, t) {
    const C = this.pal || palette();
    if (e.type === 'dead') return p.flash > 0.05 ? C.dead : C.deadDim;
    if (e.type === 'acquired') return C.acquired;
    if (e.type === 'acquihire') return C.acquihire;
    if (e.type === 'ipo') return p.uniT <= t ? C.gold : C.ipo;
    if (p.uniT <= t) return C.gold;
    if (e.type === 'near_death') return C.moon;
    if (e.type === 'stall') return C.zombie;
    return C.alive;
  }

  // ---------- drawing ----------
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const P = this.pal = palette();
    const ink = P.ink, faint = P.faint;
    const narrow = this.narrow, t = this.t;
    const inWinter = this.winterAt(t);

    if (inWinter) {
      const g = ctx.createLinearGradient(0, 0, 0, this.graveTop);
      g.addColorStop(0, P.winterTop); g.addColorStop(1, P.winterBottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.graveTop);
    }
    ctx.font = `${narrow ? 10 : 12}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    STAGES.forEach((s, i) => {
      const x = this.cols[i];
      ctx.fillStyle = inWinter ? P.winterFaint : faint;
      ctx.fillRect(x - this.colW * 0.45, this.top + 14, this.colW * 0.9, this.bandBottom - this.top - 6);
      ctx.fillStyle = ink;
      const lab = narrow ? { pre_seed: 'Pre', seed: 'Seed', A: 'A', B: 'B', C: 'C', growth: 'Grow' }[s] : STAGE_LABEL[s];
      ctx.fillText(lab.toUpperCase(), x, this.top + 2);
    });
    ctx.fillStyle = P.grave;
    ctx.fillRect(this.cols[0] - this.colW * 0.5, this.graveTop, this.colW * STAGES.length, H - this.graveTop - 2);
    ctx.textAlign = 'left';
    ctx.fillStyle = P.graveInk;
    ctx.fillText(narrow ? 'GRAVEYARD' : 'GRAVEYARD · where they died', this.cols[0] - this.colW * 0.45, this.graveTop + 14);

    if (!this.parts) return;
    // particles
    const deadAt = {}, exitN = { ipo: 0, acquired: 0, acquihire: 0 };
    const rev = this.reveal;
    ctx.globalCompositeOperation = P.blend;
    const k = this.phase === 'burst' ? 0.07 : this.phase === 'play' && this.playing ? 0.14 : 0.2;
    for (const p of this.parts) {
      const tg = this.target(p, t);
      p.x += (tg.x - p.x) * k;
      p.y += (tg.y - p.y) * k;
      const e = this.currentEvent(p, t);
      if (e.type === 'dead') deadAt[e.stage] = (deadAt[e.stage] || 0) + 1;
      if (EXIT.has(e.type)) exitN[e.type]++;
      const c = this.colorOf(p, e, t);
      const isGold = c === P.gold;
      let a = e.type === 'dead' ? 0.85 : isGold ? 1 : e.type === 'stall' ? 0.45 : P.aliveAlpha + Math.min(0.4, Math.log10(Math.max(1, (e.post || 1) / 1e6)) * 0.12);
      if (rev > 0 && !isGold) a *= 1 - 0.75 * Math.min(1, rev * 2.5);
      let r = this.dot * (isGold ? 1.5 : 1) * (1 + p.flash * 1.2);
      if (isGold && rev > 0) r *= 1 + 0.6 * Math.min(1, rev * 3) + 0.25 * Math.sin(this.clock * 6 + p.phase);
      if (isGold) {
        ctx.fillStyle = rgba(c, 0.16 + 0.2 * Math.min(1, rev * 3));
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.2, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = rgba(c, a);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      if (p.flash > 0) p.flash = Math.max(0, p.flash - 0.035 * this.speed);
    }
    for (const b of this.bursts) {
      b.r += b.big ? 1.6 : 1.1;
      const life = 1 - b.r / (b.big ? 42 : 16);
      if (life <= 0) continue;
      ctx.strokeStyle = rgba(b.c, life * 0.7);
      ctx.lineWidth = b.big ? 1.5 : 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.stroke();
    }
    this.bursts = this.bursts.filter((b) => b.r < (b.big ? 42 : 16));
    ctx.globalCompositeOperation = 'source-over';

    // live tallies on the piles
    ctx.font = `${narrow ? 10 : 11.5}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    STAGES.forEach((s, i) => {
      const n = deadAt[s];
      if (!n) return;
      const rows = Math.ceil(n / Math.max(4, Math.floor(this.colW * 0.86 / this.gap)));
      ctx.fillStyle = P.tally;
      ctx.fillText(`✝ ${n}`, this.cols[i], Math.max(this.graveTop + 30, H - 16 - rows * this.gap));
    });
    ctx.textAlign = 'left';
    for (const [key, z] of Object.entries(this.zones)) {
      ctx.fillStyle = P.exitInk[key];
      const lab = narrow ? { ipo: 'IPO', acquired: 'SOLD', acquihire: 'FIRE' }[key] : z.label.toUpperCase();
      ctx.fillText(lab + (exitN[key] ? (narrow ? ` ${exitN[key]}` : ` · ${exitN[key]}`) : ''), this.exitX0, z.y0 - 6);
    }

    // hover / selection rings
    for (const idx of [this.hover, this.selected]) {
      if (idx < 0) continue;
      const p = this.parts[idx];
      ctx.strokeStyle = idx === this.selected ? P.ring : P.ringHover;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 6.283); ctx.stroke();
    }

    if (rev > 0) this.drawReveal(rev);
  }

  drawReveal(rev) {
    const ctx = this.ctx;
    const a = Math.min(1, Math.max(0, (rev - 0.18) * 2.2));
    if (a <= 0) return;
    const n = this.parts.filter((p) => p.uniT <= HORIZON).length;
    const shown = Math.round(n * Math.min(1, (rev - 0.18) * 1.8));
    const cx = (this.cols[0] + this.cols[STAGES.length - 1]) / 2, cy = (this.top + this.bandBottom) / 2;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(160, this.colW * 2.6));
    const P = this.pal || palette(), [vr, vg, vb] = P.veil;
    g.addColorStop(0, `rgba(${vr},${vg},${vb},${0.86 * a})`); g.addColorStop(1, `rgba(${vr},${vg},${vb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.graveTop);
    ctx.textAlign = 'center';
    const big = this.narrow ? 64 : 118;
    ctx.font = `${big}px "Instrument Serif", Georgia, serif`;
    ctx.fillStyle = rgba(P.bigInk, a);
    ctx.shadowColor = P.glowShadow; ctx.shadowBlur = 40 * a;
    ctx.fillText(String(shown), cx, cy + big * 0.32);
    ctx.shadowBlur = 0;
    ctx.font = `${this.narrow ? 13 : 17}px "Inter Tight", system-ui, sans-serif`;
    ctx.fillStyle = rgba(P.subInk, a);
    ctx.fillText(`of 1,000 futures became unicorns`, cx, cy + big * 0.32 + (this.narrow ? 24 : 34));
    ctx.textAlign = 'left';
  }

  pointer(ev, click) {
    if (!this.parts) return;
    const r = this.canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = -1, bd = 100;
    for (const p of this.parts) {
      const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < bd) { bd = d; best = p.i; }
    }
    this.hover = best;
    this.canvas.style.cursor = best >= 0 ? 'pointer' : 'default';
    if (click && best >= 0) { this.selected = best; this.cb.onSelect && this.cb.onSelect(this.parts[best].u); }
    this.cb.onHover && this.cb.onHover(best >= 0 ? this.parts[best].u : null, mx, my);
    if (this.phase === 'done' || (!this.playing && this.phase === 'play')) this.draw();
  }
}

// Static 40x25 grid of all universes coloured by outcome (results header + share card)
export function drawGrid(ctx, x, y, w, h, universes, opts = {}) {
  const cols = opts.cols || 40, rows = Math.ceil(universes.length / cols);
  const order = { ipo: 0, unicorn: 1, acquired: 2, alive: 3, acquihire: 4, dead: 5 };
  const sorted = universes.slice().sort((a, b) => (b.everUnicorn - a.everUnicorn) || (order[a.outcome] - order[b.outcome]) || (b.peak - a.peak));
  const cw = w / cols, ch = h / rows, r = Math.min(cw, ch) * 0.34;
  // on light paper the same hues need more weight to read; share cards (dark) use the original palette
  const colors = opts.light ? {
    dead: 'rgba(200,64,46,0.78)', acquihire: 'rgba(168,89,42,0.8)', acquired: 'rgba(194,118,18,0.85)',
    ipo: '#d9a20b', unicorn: '#d9a20b', alive: 'rgba(110,128,156,0.55)', gold: '#e0a70e', glow: 'rgba(242,193,58,0.28)',
  } : {
    dead: 'rgba(255,90,78,0.85)', acquihire: 'rgba(217,137,58,0.9)', acquired: 'rgba(255,181,71,0.95)',
    ipo: '#ffe066', unicorn: '#ffd84d', alive: 'rgba(143,163,191,0.75)', gold: '#ffd84d', glow: 'rgba(255,216,77,0.22)',
  };
  sorted.forEach((u, i) => {
    const cx = x + (i % cols) * cw + cw / 2, cy = y + Math.floor(i / cols) * ch + ch / 2;
    const gold = u.everUnicorn;
    if (gold) {
      ctx.fillStyle = colors.glow;
      ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = gold ? colors.gold : colors[u.outcome];
    ctx.beginPath(); ctx.arc(cx, cy, gold ? r * 1.25 : r, 0, 6.283); ctx.fill();
  });
}
