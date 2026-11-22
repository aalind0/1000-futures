// Founder cap table and exit waterfall for one simulated universe.
//
// Dilution per round = round size / post-money (the simulation draws both; their medians reproduce Carta's
// 2026 dilution medians). Assumptions, shown in the data room: an option pool topped up to 10% at the first
// priced round and +5% at Series A (pre-money, so it dilutes existing holders only), and standard
// 1x non-participating preferred, all series pari passu.

export const POOL_TOPUP = { seed: 0.10, A: 0.05 };

export function newCapTable() {
  return { founders: 1, pool: 0, series: [] };
}

export function applyRound(ct, stage, amount, post) {
  const top = POOL_TOPUP[stage] || 0;
  if (top && !ct.toppedUp?.[stage]) {
    const k = 1 - top;
    ct.founders *= k; ct.pool = ct.pool * k + top;
    for (const s of ct.series) s.pct *= k;
    ct.toppedUp = Object.assign({}, ct.toppedUp, { [stage]: true });
  }
  const d = Math.min(0.6, Math.max(0, amount / Math.max(post, amount)));
  const k = 1 - d;
  ct.founders *= k; ct.pool *= k;
  for (const s of ct.series) s.pct *= k;
  ct.series.push({ stage, inv: amount, pct: d });
}

export function totalPreference(ct) {
  return ct.series.reduce((a, s) => a + s.inv, 0);
}

// Sale for `value`: returns cash to { founders, pool, investors }.
// Each series takes the better of its 1x preference or converting to common.
export function waterfall(ct, value) {
  const series = ct.series;
  const common = ct.founders + ct.pool;
  if (!(value > 0)) return { founders: 0, pool: 0, investors: 0 };
  const takesPref = new Set();
  for (let guard = 0; guard <= series.length; guard++) {
    const prefPaid = series.reduce((a, s, i) => a + (takesPref.has(i) ? s.inv : 0), 0);
    if (prefPaid >= value) return { founders: 0, pool: 0, investors: value };
    const remaining = value - prefPaid;
    const convPct = common + series.reduce((a, s, i) => a + (takesPref.has(i) ? 0 : s.pct), 0);
    // the series that gains most by taking its preference switches first; repeat until stable
    let worst = -1, worstRatio = 1;
    series.forEach((s, i) => {
      if (takesPref.has(i)) return;
      const asCommon = (s.pct / convPct) * remaining;
      const ratio = s.inv / Math.max(asCommon, 1e-9);
      if (ratio > worstRatio) { worstRatio = ratio; worst = i; }
    });
    if (worst < 0) {
      const perPct = remaining / convPct;
      const investors = prefPaid + series.reduce((a, s, i) => a + (takesPref.has(i) ? 0 : s.pct * perPct), 0);
      return { founders: ct.founders * perPct, pool: ct.pool * perPct, investors };
    }
    takesPref.add(worst);
  }
  return { founders: 0, pool: 0, investors: value };
}
