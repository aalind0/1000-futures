// Unit tests for the founder cap table and liquidation waterfall.  Run: node tests/captable.test.mjs
import { newCapTable, applyRound, waterfall, totalPreference } from '../site/js/captable.js';

let fails = 0;
const eq = (name, got, want, tol = 1e-6) => {
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got.toFixed(4)}${ok ? '' : ' (want ' + want + ')'}`);
};

// 1. hand-built table: founders 60%, pool 20%, one series with 20% for $10M
const ct = { founders: 0.6, pool: 0.2, series: [{ stage: 'A', inv: 10, pct: 0.2 }] };
eq('exit 20: investor takes 1x pref, founders get 0.6/0.8 of the remaining 10', waterfall(ct, 20).founders, 7.5);
eq('exit 5 (below preference): founders get nothing', waterfall(ct, 5).founders, 0);
eq('exit 5: investors get all 5', waterfall(ct, 5).investors, 5);
eq('exit 100: investor converts, founders get 60%', waterfall(ct, 100).founders, 60);
eq('exit 50: converting (10) equals pref (10), founders get 30', waterfall(ct, 50).founders, 30);
const w = waterfall(ct, 37);
eq('money is conserved', w.founders + w.pool + w.investors, 37);

// 2. two series: seed $4M for 20%, A $15M for 20% (founders 48%, pool 12%)
const ct2 = { founders: 0.48, pool: 0.12, series: [{ stage: 'seed', inv: 4, pct: 0.2 }, { stage: 'A', inv: 15, pct: 0.2 }] };
// exit 30: as common A would get 6 < 15 → takes pref 15; remaining 15 split by 0.8 → seed gets 3.75 < 4 → takes pref
// → remaining 11 split among common 0.6 → founders 0.48/0.6*11 = 8.8
eq('two series, exit 30: both take prefs, founders get 8.8', waterfall(ct2, 30).founders, 8.8);
eq('two series, exit 19 (= total prefs): founders get 0', waterfall(ct2, 19).founders, 0);
const w2 = waterfall(ct2, 300);
eq('two series, exit 300: everyone converts, founders 48%', w2.founders, 144);
eq('two series conserve money at 30', (() => { const x = waterfall(ct2, 30); return x.founders + x.pool + x.investors; })(), 30);

// 3. applyRound: dilution = round / post, pool top-ups at seed (10%) and A (+5%)
const c = newCapTable();
applyRound(c, 'pre_seed', 0.66, 10);      // 6.6% dilution, no pool
eq('after pre-seed founders own 93.4%', c.founders, 0.934);
applyRound(c, 'seed', 4, 24);             // pool to 10% pre-money, then 16.67% dilution
eq('after seed founders own 0.934*0.9*(1-4/24)', c.founders, 0.934 * 0.9 * (1 - 4 / 24));
applyRound(c, 'A', 13.35, 62.65);
const sum = c.founders + c.pool + c.series.reduce((a, s) => a + s.pct, 0);
eq('ownership always sums to 100%', sum, 1);
eq('total preference = money raised', totalPreference(c), 0.66 + 4 + 13.35);

console.log(fails ? `\n${fails} FAILED` : '\nall cap-table tests pass');
process.exit(fails ? 1 : 0);
