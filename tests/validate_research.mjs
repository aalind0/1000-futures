// Validates research/companies_*.jsonl before they go into the site: JSON, required fields, outcome values,
// taxonomy ids, sources, duplicates.  Run:  node tests/validate_research.mjs [file-glob-substring]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { V, SV } from '../site/js/taxonomy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(here, '..', 'research');
const only = process.argv[2] || '';
const OUTCOMES = new Set(['dead', 'acquihire', 'acquired', 'ipo', 'private_unicorn', 'active']);
const files = fs.readdirSync(RES).filter((f) => /^companies_.*\.jsonl$/.test(f));
const seen = new Map();
let total = 0;
for (const f of files) {
  const lines = fs.readFileSync(path.join(RES, f), 'utf8').split('\n').filter((l) => l.trim());
  const issues = { badJson: 0, noName: 0, badOutcome: [], badVertical: [], badSub: [], noSource: [], noNumbers: 0 };
  let n = 0;
  const byOut = {}, bySub = {};
  for (const line of lines) {
    let c;
    try { c = JSON.parse(line); } catch (e) { issues.badJson++; continue; }
    n++;
    if (!c.name || !c.id) { issues.noName++; continue; }
    const prev = seen.get(c.id);
    seen.set(c.id, (prev ? prev + ', ' : '') + f.replace(/^companies_|\.jsonl$/g, ''));
    if (!OUTCOMES.has(c.outcome)) issues.badOutcome.push(`${c.id}:${c.outcome}`);
    if (c.vertical && !V[c.vertical]) issues.badVertical.push(`${c.id}:${c.vertical}`);
    if (c.vertical && c.subvertical && !SV[c.vertical + '/' + c.subvertical]) issues.badSub.push(`${c.id}:${c.vertical}/${c.subvertical}`);
    if (!(c.sources || []).some((s) => /^https?:\/\//.test(s))) issues.noSource.push(c.id);
    if (c.total_raised_usd == null && c.peak_valuation_usd == null && !(c.rounds || []).length) issues.noNumbers++;
    byOut[c.outcome] = (byOut[c.outcome] || 0) + 1;
    if (c.vertical) bySub[`${c.vertical}/${c.subvertical}`] = (bySub[`${c.vertical}/${c.subvertical}`] || 0) + 1;
  }
  total += n;
  if (only && !f.includes(only)) continue;
  console.log(`\n${f}: ${n} records · outcomes ${JSON.stringify(byOut)}`);
  if (Object.keys(bySub).length) console.log('  niches:', Object.entries(bySub).sort().map(([k, v]) => `${k} ${v}`).join(' · '));
  for (const [k, v] of Object.entries(issues)) {
    const count = Array.isArray(v) ? v.length : v;
    if (count) console.log(`  ! ${k}: ${count}${Array.isArray(v) ? ' → ' + v.slice(0, 12).join(', ') : ''}`);
  }
}
const dupes = [...seen.entries()].filter(([, w]) => w.includes(','));
console.log(`\n${total} records across ${files.length} files · ids appearing more than once: ${dupes.length}`);
if (dupes.length) console.log('  ' + dupes.slice(0, 25).map(([id, w]) => `${id} (${w})`).join('; '));
