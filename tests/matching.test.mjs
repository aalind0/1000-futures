// Context regression test: every idea must land in the right space, and its "closest companies" must come
// only from that space.  Run:  node tests/matching.test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Matcher } from '../site/js/matcher.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const B = JSON.parse(fs.readFileSync(path.join(here, '..', 'site', 'data', 'bundle.json'), 'utf8'));
const CASES = JSON.parse(fs.readFileSync(path.join(here, 'matching_cases.json'), 'utf8'));
const M = new Matcher(B.companies, B.labels || {});

let exact = 0, vert = 0, leaks = 0;
const fails = [];
for (const [idea, want] of CASES) {
  const a = M.analyze(idea);
  const got = `${a.vertical}/${a.subvertical}`;
  const ok = want.split('|');
  const isExact = ok.includes(got), isVert = ok.some((o) => o.split('/')[0] === a.vertical);
  if (isExact) exact++; if (isVert) vert++;
  // invariant: closest companies never come from outside the idea's vertical (or its declared second space)
  const allowed = new Set([a.vertical, a.second && a.second.v].filter(Boolean));
  const leaked = a.comps.filter((x) => !allowed.has(x.c.v));
  if (leaked.length) leaks++;
  if (!isExact || leaked.length) fails.push(`${isVert ? '~' : 'X'} ${idea}\n    got ${got}, want ${want}${leaked.length ? `\n    leaked comps: ${leaked.map((x) => x.c.n + ' (' + x.c.v + ')').join(', ')}` : ''}`);
}
console.log(fails.join('\n'));
console.log(`\n${CASES.length} ideas · exact niche ${exact}/${CASES.length} · right vertical ${vert}/${CASES.length} · cross-space leaks ${leaks}`);
const pass = vert / CASES.length >= 0.97 && exact / CASES.length >= 0.9 && leaks === 0;
console.log(pass ? 'PASS' : 'FAIL');
process.exit(pass ? 0 : 1);
