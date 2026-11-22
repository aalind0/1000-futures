#!/usr/bin/env python3
"""Build site/data/bundle.json from research/ (and data/raw/ bulk datasets if present).

Run:  python3 -I scripts/build_data.py
Every number that reaches the simulation carries a source URL or an explicit
"derived:" / "assumption:" note, which the Data room page shows.
"""
import collections
import datetime
import glob
import io
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'research')
RAW = os.path.join(ROOT, 'data', 'raw')
OUT = os.path.join(ROOT, 'site', 'data')

STAGES = ['pre_seed', 'seed', 'A', 'B', 'C', 'growth']
REGIONS = ['north_america', 'europe', 'uk', 'israel', 'india', 'china', 'east_asia', 'sea', 'latam', 'mena', 'africa', 'oceania']
OUTCOMES = {'dead', 'acquihire', 'acquired', 'ipo', 'private_unicorn', 'active'}
COUNTRY_REGION = {
    'US': 'north_america', 'CA': 'north_america', 'GB': 'uk', 'UK': 'uk', 'IL': 'israel', 'IN': 'india', 'CN': 'china',
    'HK': 'china', 'JP': 'east_asia', 'KR': 'east_asia', 'TW': 'east_asia', 'SG': 'sea', 'ID': 'sea', 'VN': 'sea',
    'TH': 'sea', 'PH': 'sea', 'MY': 'sea', 'BR': 'latam', 'MX': 'latam', 'CO': 'latam', 'AR': 'latam', 'CL': 'latam',
    'PE': 'latam', 'UY': 'latam', 'AE': 'mena', 'SA': 'mena', 'EG': 'mena', 'JO': 'mena', 'QA': 'mena', 'NG': 'africa',
    'KE': 'africa', 'ZA': 'africa', 'GH': 'africa', 'AU': 'oceania', 'NZ': 'oceania', 'TR': 'europe',
}

CAUSES = {
    'ran_out_of_cash': ('Ran out of cash', 'ran out of cash', 'Couldn’t raise the next round before the money ran out.'),
    'no_market_need': ('No market need', 'nobody needed it', 'Built something people didn’t want badly enough to pay for.'),
    'funding_crunch': ('Funding crunch', 'caught in a funding crunch', 'The market froze: investors stopped writing checks for companies at this stage.'),
    'outcompeted': ('Outcompeted', 'got outcompeted', 'A better-funded or faster rival took the market.'),
    'bad_unit_economics': ('Broken unit economics', 'lost money on every sale', 'Each customer cost more to win and serve than they paid.'),
    'regulatory': ('Regulators', 'killed by regulation', 'Licences, bans or new rules closed the business model.'),
    'legal_ip': ('Lawsuits & IP', 'sued out of existence', 'Litigation or IP disputes consumed the company.'),
    'fraud': ('Fraud', 'collapsed in a fraud scandal', 'Misreported numbers or misconduct came to light.'),
    'team_conflict': ('Team breakdown', 'the team fell apart', 'Founder or investor conflict, or the wrong team for the job.'),
    'product_tech_failure': ('The product didn’t work', 'the product didn’t work', 'The technology or product never got good enough.'),
    'too_early': ('Too early', 'was too early', 'Right idea, wrong decade: the market or enabling tech wasn’t ready.'),
    'scaled_too_fast': ('Scaled too fast', 'scaled too fast', 'Expanded before the model worked, and the burn outran the revenue.'),
    'failed_pivot': ('Pivot gone wrong', 'pivoted into a wall', 'A late change of direction burned the remaining runway.'),
    'platform_dependency': ('Platform risk', 'its platform pulled the rug', 'Depended on a bigger platform that changed the rules.'),
    'lost_key_customer': ('Lost the key customer', 'lost its key customer', 'Too much revenue came from one customer or partner.'),
    'hardware_supply_chain': ('Hardware & supply chain', 'hardware ate the money', 'Manufacturing, recalls or supply chains broke the budget.'),
    'local_incumbent': ('Local incumbent', 'lost to a local champion', 'A local player understood the market better.'),
    'wrong_market_fit': ('Wrong market', 'picked the wrong market', 'The model that worked elsewhere didn’t fit this market.'),
    'acquired_and_shut': ('Bought and shut down', 'was bought and shut down', 'Acquired, then closed by the buyer.'),
    'founder_burnout': ('Founder burnout', 'the founders burned out', 'The founders lost the energy or will to continue.'),
}
CAUSE_ALIASES = {'bad_unit_economics_pricing': 'bad_unit_economics', 'team_conflict_wrong_team': 'team_conflict',
                 'pivot_gone_wrong': 'failed_pivot', 'burnout': 'founder_burnout', 'poor_product': 'product_tech_failure'}


def read_jsonl(path):
    out, bad = [], 0
    with io.open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                bad += 1
    return out, bad


def read_json(path, default=None):
    try:
        with io.open(path, encoding='utf-8') as f:
            return json.load(f)
    except (IOError, ValueError):
        return default


def val(x):
    return x.get('value') if isinstance(x, dict) else x


def src(x):
    return x.get('source') or x.get('note') if isinstance(x, dict) else None


def num(x):
    try:
        if x is None:
            return None
        v = float(x)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None


def score(c):
    filled = sum(1 for v in c.values() if v not in (None, [], '', {}))
    return filled + (5 if c.get('confidence') == 'high' else 0) + len(c.get('sources') or [])


# ---------------------------------------------------------------- companies
def load_companies():
    paths = sorted(glob.glob(os.path.join(RES, 'companies_*.jsonl')) + glob.glob(os.path.join(RES, '_parts_*', '*.jsonl'))
                   + glob.glob(os.path.join(RES, '_moonshots_parts', '*.jsonl')))
    by_id, bad_total = {}, 0
    moon_doc = read_json(os.path.join(RES, 'moonshots.json'), {}) or {}
    records = []
    for p in paths:
        recs, bad = read_jsonl(p)
        bad_total += bad
        records.extend(recs)
    records.extend(moon_doc.get('companies') or [])
    # enrichment lines (no outcome, or no name) add labels/tags/sources/near-death moments to a company
    # that exists elsewhere; they are applied after all full records are loaded
    enrich = []
    for c in records:
        cid = (c.get('id') or '').strip().lower()
        if not cid:
            continue
        cid = re.sub(r'[^a-z0-9]+', '-', cid).strip('-')
        c['id'] = cid
        if not c.get('name') or not c.get('outcome'):
            enrich.append(c)
            continue
        prev = by_id.get(cid)
        if prev is None:
            by_id[cid] = c
        else:  # merge: keep the richer record, union moonshot extras + sources
            keep, other = (c, prev) if score(c) > score(prev) else (prev, c)
            for k in ('moonshot', 'near_death', 'dismissed_by', 'enabler', 'twin_group', 'vertical', 'subvertical'):
                if not keep.get(k) and other.get(k):
                    keep[k] = other[k]
            keep['sources'] = list(dict.fromkeys((keep.get('sources') or []) + (other.get('sources') or [])))
            by_id[cid] = keep
    applied, orphans = 0, []
    for e in enrich:
        base = by_id.get(e['id'])
        if base is None:
            orphans.append(e['id'])
            continue
        for k in ('vertical', 'subvertical', 'moonshot', 'enabler', 'twin_group'):
            if e.get(k) is not None:
                base[k] = e[k]
        if e.get('near_death'):
            base['near_death'] = (base.get('near_death') or []) + [n for n in e['near_death'] if n not in (base.get('near_death') or [])]
        base['tags'] = list(dict.fromkeys((base.get('tags') or []) + (e.get('tags_add') or [])))
        base['sources'] = list(dict.fromkeys((base.get('sources') or []) + (e.get('sources') or []) + (e.get('sources_add') or [])))
        applied += 1
    if orphans:
        bad_total += len(orphans)
    load_companies.enrich_stats = (applied, orphans)
    return list(by_id.values()), bad_total, moon_doc


def compact(c):
    out = c.get('outcome')
    if out not in OUTCOMES:
        out = 'active'
    cc = (c.get('country') or '').upper()[:2]
    region = c.get('region') if c.get('region') in REGIONS else COUNTRY_REGION.get(cc, 'north_america')
    causes = []
    for x in c.get('causes') or []:
        x = CAUSE_ALIASES.get(x, x)
        if x in CAUSES and x not in causes:
            causes.append(x)
    rounds = []
    for r in c.get('rounds') or []:
        if not isinstance(r, dict):
            continue
        rounds.append({k: r.get(k) for k in ('stage', 'year', 'amount_usd', 'post_money_usd', 'lead')})
    near = []
    for n in c.get('near_death') or []:
        if isinstance(n, dict) and n.get('what'):
            near.append({'year': n.get('year'), 'what': n.get('what')})
    d = {
        'id': c['id'], 'n': c.get('name'), 'cc': cc, 'r': region, 'city': c.get('city'),
        's': c.get('sector') or 'saas_b2b', 't': [str(t) for t in (c.get('tags') or [])][:12], 'o': c.get('one_liner') or '',
        'f': c.get('founded'), 'e': c.get('ended'), 'out': out,
        'raised': num(c.get('total_raised_usd')), 'peak': num(c.get('peak_valuation_usd')), 'exitV': num(c.get('exit_value_usd')),
        'rounds': rounds, 'causes': causes, 'drivers': c.get('drivers') or [], 'story': c.get('story') or '',
        'twin': c.get('twin_group'), 'src': [s for s in (c.get('sources') or []) if isinstance(s, str) and s.startswith('http')],
        'conf': c.get('confidence') or 'medium',
    }
    if c.get('moonshot'):
        d['moon'] = True
    if near:
        d['near'] = near
    if c.get('dismissed_by'):
        d['dismissed'] = c['dismissed_by']
    if c.get('enabler'):
        d['enabler'] = c['enabler']
    # research records may arrive already labelled with the site taxonomy
    if c.get('vertical'):
        d['v'] = c['vertical']
        d['sv'] = c.get('subvertical')
    return d


# ---------------------------------------------------------------- base rates
def build_ladders(br):
    lad = (br.get('ladder') or {})
    sources = {}
    ladders = {}
    assumptions = {
        ('pre_seed', 'mNext'): (15.0, 'assumption: no sourced pre-seed→seed timing yet; 15 months used pending data'),
        ('growth', 'mNext'): (24.0, 'assumption: no sourced growth-round timing yet; 24 months used pending data'),
        ('growth', 'pNext'): (0.2, 'assumption: chance of another growth round per step; pending data'),
    }
    era = br.get('era_multipliers') or {}
    ai = era.get('ai_era_2024_2026') or {}
    for region, stages in lad.items():
        if region.startswith('_') or not isinstance(stages, dict):
            continue
        ladders[region], sources[region] = {}, {}
        for st in STAGES:
            row = stages.get(st) or {}
            L, S = {}, {}
            for key, field in (('pNext', 'prob_raise_next'), ('mNext', 'median_months_to_next'), ('post', 'median_post_money_usd'),
                               ('round', 'median_round_usd'), ('pAcq', 'prob_acquired_here'), ('pDead', 'prob_shutdown_here'),
                               ('pIpo', 'prob_ipo_here')):
                v = num(val(row.get(field)))
                if v is None and (st, key) in assumptions:
                    v, s = assumptions[(st, key)]
                else:
                    s = src(row.get(field))
                if v is not None:
                    L[key], S[key] = v, s
            ladders[region][st], sources[region][st] = L, S
    # current era (simulation starts 2026): apply the AI-era graduation and shutdown multipliers to every region
    era_applied = []
    for region in ladders:
        for st, mkey, ekey in (('seed', 'pNext', 'prob_seed_to_A'), ('A', 'pNext', 'prob_A_to_B')):
            m = num(val(ai.get(ekey)))
            if m and mkey in ladders[region].get(st, {}):
                ladders[region][st][mkey] *= m
                sources[region][st][mkey] = '%s × era %s (%s)' % (sources[region][st].get(mkey), m, (ai.get(ekey) or {}).get('note', ''))
                if region == 'north_america':
                    era_applied.append('%s %s ×%s' % (st, mkey, m))
        sh = num(val(ai.get('shutdown')))
        if sh:
            for st in STAGES:
                if 'pDead' in ladders[region].get(st, {}):
                    ladders[region][st]['pDead'] *= sh
            if region == 'north_america':
                era_applied.append('shutdown ×%s' % sh)
    if 'global' not in ladders and 'north_america' in ladders:
        ladders['global'] = json.loads(json.dumps(ladders['north_america']))
        sources['global'] = sources['north_america']
    proxied = []
    for r in REGIONS:
        if r not in ladders and 'global' in ladders:
            ladders[r] = json.loads(json.dumps(ladders['global']))
            sources[r] = {'_proxy': 'No regional base rates sourced yet: uses the US/global ladder. Regional differences in the sim come only from real companies in that region.'}
            proxied.append(r)
    return ladders, sources, proxied, era_applied


def dilution_medians(br, ladders):
    rows = br.get('dilution') or []
    def pick(stage, prefer):
        for p in prefer:
            for r in rows:
                if r.get('stage') == stage and str(r.get('period', '')).startswith(p) and num(r.get('median_pct')):
                    return num(r.get('median_pct')) / 100.0, r.get('source')
        return None, None
    out, src = {}, {}
    for stage, key, prefer in (('seed', 'seed', ['2026']), ('A', 'A', ['2026']), ('B', 'B', ['2026']),
                               ('C', 'C', ['2026', '2025']), ('growth', 'D', ['2025'])):
        v, s = pick(key, prefer)
        if v:
            out[stage], src[stage] = v, s
    pre = (ladders.get('global') or {}).get('pre_seed') or {}
    if pre.get('round') and pre.get('post'):
        out['pre_seed'] = round(pre['round'] / pre['post'], 4)
        src['pre_seed'] = 'derived: median pre-seed round / median pre-seed post-money (funding ladder)'
    out['_sources'] = src
    out['_note'] = 'growth uses the Series D median (7.5%, secondary source citing Carta)'
    return out


def build_sector_mods(br):
    mods = collections.defaultdict(dict)
    notes = collections.defaultdict(list)
    for r in br.get('sector_modifiers') or []:
        sec, metric, v = r.get('sector'), (r.get('metric') or ''), num(r.get('value'))
        if not sec or v is None:
            continue
        if 'pre_money_premium' in metric and ('series_a' in metric or 'seed' in metric):
            mods[sec]['val'] = round((mods[sec].get('val', v) + v) / 2, 3)
            notes[sec].append(('val', v, r.get('source') or r.get('note')))
        elif metric.startswith('months_') and metric.endswith('_multiplier'):
            mods[sec]['months'] = round((mods[sec].get('months', v) + v) / 2, 3)
            notes[sec].append(('months', v, r.get('source') or r.get('note')))
    return dict(mods), dict(notes)


def build_causes(br, companies):
    weights, verified = {}, {}
    for r in br.get('failure_causes') or []:
        cid = CAUSE_ALIASES.get(r.get('cause'), r.get('cause'))
        p = num(r.get('pct'))
        if cid in CAUSES and p:
            weights[cid] = weights.get(cid, 0) + p
            verified[cid] = (r.get('source'), 'not re-verified' not in (r.get('note') or '').lower() and 'not re-verified' not in (r.get('note') or ''))
    # causes with no survey weight get a small weight from how often they appear in the curated dead companies
    dead_counts = collections.Counter(x for c in companies if c['out'] in ('dead', 'acquihire') for x in c['causes'])
    total_dead = float(sum(dead_counts.values()) or 1)
    out = {}
    for cid, (label, short, desc) in CAUSES.items():
        if cid in weights:
            w, s, note = weights[cid], verified[cid][0], ('CB Insights post-mortem survey share' + ('' if verified[cid][1] else ' (pending re-verification)'))
        else:
            w = round(100 * dead_counts.get(cid, 0) / total_dead * 0.5, 2)
            s, note = None, 'derived: half its share of causes among %d curated dead companies (not in the survey)' % int(total_dead)
        out[cid] = {'label': label, 'short': short, 'desc': desc, 'weight': w, 'src': s, 'note': note}
    by_sector = collections.defaultdict(collections.Counter)
    for c in companies:
        if c['out'] in ('dead', 'acquihire'):
            by_sector[c['s']].update(c['causes'])
    return out, {k: dict(v) for k, v in by_sector.items()}


def corpus_stats(companies):
    def share(lst):
        if not lst:
            return None
        return sum(1 for c in lst if c['out'] not in ('dead', 'acquihire')) / float(len(lst))
    by_region = {}
    for r in REGIONS:
        lst = [c for c in companies if c['r'] == r]
        by_region[r] = {'n': len(lst), 'successShare': share(lst)}
    return {'n': len(companies), 'successShare': share(companies), 'byRegion': by_region,
            'moonShare': share([c for c in companies if c.get('moon')])}


# ---------------------------------------------------------------- moonshots
def build_moonshots(doc):
    doc = doc or {}
    curves = []
    for c in doc.get('cost_curves') or []:
        pts = [[p[0], p[1]] for p in (c.get('points') or []) if isinstance(p, (list, tuple)) and len(p) == 2 and num(p[1])]
        if len(pts) >= 2:
            curves.append({'id': c.get('id'), 'label': c.get('label'), 'unit': c.get('unit'), 'points': sorted(pts),
                           'source': c.get('source'), 'unlocks': c.get('unlocks') or []})
    deeptech = []
    for r in doc.get('deeptech_base_rates') or []:
        deeptech.append({'metric': r.get('metric'), 'value': r.get('value'), 'value_text': r.get('value_text'),
                         'note': r.get('note'), 'source': r.get('source')})
    return {
        'tooEarly': doc.get('too_early_pairs') or [],
        'anti': doc.get('anti_portfolio') or [],
        'curves': curves,
        'deeptech': deeptech,
    }


# ---------------------------------------------------------------- investors & deals ("Who funds this")
INV_SUFFIX = re.compile(r'\s+(?:venture partners|venture capital|ventures|venture|capital partners|capital management|capital|partners|'
                        r'management|management company|investments?|holdings|funds?|group|llc|lp|inc|ltd|limited|co|company|vc|asset management)$')
NOT_INVESTOR = re.compile(r'^(?:secondary|direct listing|spac\b|ipo\b|undisclosed|unknown|unnamed|n ?a$|none$|existing|other |others$|'
                          r'various|angel investors|angels$|individual|strategic investors|family offices?$|investors$|government$|crowdfunding|debt\b)')
INV_EXACT = {'google ventures': 'gv', 'gv': 'gv'}
SPLIT = re.compile(r'\s*[;,]\s*|\s+and\s+|\s+&\s+|\s+/\s+|\s*\bwith participation from\b\s*|\s*\bas well as\b\s*')


def inv_key(name):
    s = re.sub(r'\([^)]*\)', ' ', name or '')
    s = s.replace('&', ' and ').lower()
    s = re.sub(r"[’'`.]", '', s)
    s = re.sub(r'[^a-z0-9+]+', ' ', s).strip()
    s = re.sub(r'^(?:led by|the)\s+', '', s)
    if s in INV_EXACT:  # names whose suffix is the whole difference (Google Ventures is GV, not Google)
        return INV_EXACT[s]
    prev = None
    while prev != s:
        prev = s
        s = INV_SUFFIX.sub('', s).strip()
    return s


EUROPE = set('ES DE FR NL SE IT PT IE PL CH EE AT BE DK FI NO CZ RO LT LV LU GR HU HR BG SI SK IS UA'.split())


def region_of(cc):
    return COUNTRY_REGION.get(cc) or ('europe' if cc in EUROPE else None)


def co_key(name):
    s = re.sub(r'\([^)]*\)', ' ', name or '').lower()
    s = re.sub(r'\b(?:inc|ltd|labs?|ai|technologies|technology|robotics|hq)\b\.?', ' ', s)
    return re.sub(r'[^a-z0-9]+', '', s)


def load_registry():
    doc = read_json(os.path.join(RES, 'investors.json'), {}) or {}
    alias, meta = {}, {}
    firms = [f for f in doc.get('firms') or [] if f.get('name')]
    for f in firms:  # a firm's own name always wins over another firm's alias
        iid = re.sub(r'[^a-z0-9]+', '-', inv_key(f['name'])).strip('-')
        meta.setdefault(iid, {'n': f['name'], 't': f.get('type'), 'a': []})
        alias[inv_key(f['name'])] = iid
    for f in firms:
        iid = alias[inv_key(f['name'])]
        for a in f.get('aliases') or []:
            alias.setdefault(inv_key(a), iid)
            if a not in meta[iid]['a']:
                meta[iid]['a'].append(a)  # so a search for "a16z" finds Andreessen Horowitz
    return alias, meta


def build_deals(companies):
    """Deals = every sourced round with named investors: company records' round leads plus research/deals_*.jsonl.
    Investors are merged across spellings (research/investors.json) and referenced by id."""
    alias, meta = load_registry()
    spell = collections.defaultdict(collections.Counter)

    def ids_of(raw):
        items = raw if isinstance(raw, list) else [raw]
        out = []
        for item in items:
            if not isinstance(item, str) or not item.strip():
                continue
            whole = inv_key(item)
            if whole in alias:
                parts = [item]
            elif re.search(r'\b(?:for|of)\b', item):  # "Bank for Reconstruction and Development" is one name
                parts = [p for p in re.split(r'\s*[;,]\s*', item) if p and p.strip()]
            else:
                parts = [p for p in SPLIT.split(item) if p and p.strip()]
            for p in parts:
                p = re.sub(r'\s+', ' ', re.sub(r'\([^)]*\)', ' ', p)).strip(' .')
                k = inv_key(p)
                if not k or len(k) < 2 or NOT_INVESTOR.match(k) or NOT_INVESTOR.match(p.lower()) or re.search(r'secondary sale|tender offer', k):
                    continue
                iid = alias.get(k) or re.sub(r'[^a-z0-9]+', '-', k).strip('-')
                spell[iid][p] += 1
                if iid not in out:
                    out.append(iid)
        return out

    by_name = {co_key(c['n']): c for c in companies}
    deals, index = [], collections.defaultdict(list)

    def add(d, name):
        key = (co_key(name), d['st'])
        for prev in index[key]:
            if not prev.get('_r') and not d.get('_r'):
                continue  # two rounds from the same company record are two real rounds
            if prev['y'] is None or d['y'] is None or abs(prev['y'] - d['y']) <= 1:
                prev['L'] = list(dict.fromkeys(prev['L'] + d['L']))
                prev['I'] = [i for i in dict.fromkeys(prev['I'] + d['I']) if i not in prev['L']]
                for k in ('src', 'amt', 'o', 'v', 'sv', 'mo'):
                    if not prev.get(k) and d.get(k):
                        prev[k] = d[k]
                if d.get('conf') == 'high':
                    prev['conf'] = 'high'
                return
        index[key].append(d)
        deals.append(d)

    # research first (it carries a per-round source URL)
    bad, files = 0, sorted(glob.glob(os.path.join(RES, 'deals_*.jsonl')))
    for p in files:
        recs, b = read_jsonl(p)
        bad += b
        for r in recs:
            name = (r.get('company') or '').strip()
            st = r.get('stage')
            st = {'series_a': 'A', 'series_b': 'B', 'series_c': 'C', 'a': 'A', 'b': 'B', 'c': 'C', 'preseed': 'pre_seed', 'pre-seed': 'pre_seed',
                  'D': 'growth', 'E': 'growth', 'F': 'growth', 'late': 'growth'}.get(st, st)
            if not name or st not in STAGES:
                bad += 1
                continue
            L, I = ids_of(r.get('leads') or []), ids_of(r.get('investors') or [])
            if not L and not I:
                continue
            co = by_name.get(co_key(name))
            src_url = r.get('source') if isinstance(r.get('source'), str) and r.get('source', '').startswith('http') else None
            cc = (r.get('country') or '').upper()[:2] or None
            add({'n': name, 'co': co['id'] if co else None, 'cc': cc, 'r': region_of(cc),
                 'y': int(num(r.get('year'))) if num(r.get('year')) else None, 'mo': r.get('month'), 'st': st,
                 'amt': num(r.get('amount_usd')), 'L': L, 'I': [i for i in I if i not in L],
                 'v': r.get('v'), 'sv': r.get('sv'), 'o': r.get('one_liner') or '', 'src': src_url,
                 'conf': r.get('confidence') or 'medium', '_r': 1}, name)
    research_n = len(deals)
    # then every company round with a named lead
    for c in companies:
        for r in c.get('rounds') or []:
            if not r.get('lead') or r.get('stage') not in STAGES:
                continue
            L = ids_of(r['lead'])
            if not L:
                continue
            add({'n': c['n'], 'co': c['id'], 'cc': c['cc'], 'r': c['r'], 'y': r.get('year'), 'st': r['stage'], 'amt': num(r.get('amount_usd')),
                 'L': L, 'I': [], 'v': c.get('v'), 'sv': c.get('sv'), 'o': c.get('o') or '', 'src': None, 'conf': c.get('conf') or 'medium'}, c['n'])
    for d in deals:  # drop empty keys to keep the bundle small
        for k in [k for k, v in d.items() if v in (None, '', []) or k == '_r']:
            del d[k]
    investors = {}
    for iid, cnt in spell.items():
        m = meta.get(iid)
        investors[iid] = {'n': m['n'] if m else cnt.most_common(1)[0][0]}
        if m and m.get('t'):
            investors[iid]['t'] = m['t']
        if m and m.get('a'):
            investors[iid]['a'] = m['a']
    stats = {'deals': len(deals), 'research': research_n, 'files': len(files), 'bad': bad, 'investors': len(investors)}
    return deals, investors, stats


def main():
    companies_raw, bad, moon_doc = load_companies()
    companies = [compact(c) for c in companies_raw]
    companies.sort(key=lambda c: c['n'].lower())
    ids = {c['id'] for c in companies}

    twins = {}
    for p in sorted(glob.glob(os.path.join(RES, 'twins_*.json'))):
        for g in read_json(p, []) or []:
            gid = g.get('id')
            if not gid:
                continue
            members = [re.sub(r'[^a-z0-9]+', '-', m.lower()).strip('-') for m in g.get('members') or []]
            cur = twins.setdefault(gid, {'id': gid, 'idea': g.get('idea'), 'members': [], 'lesson': g.get('lesson')})
            cur['members'] = list(dict.fromkeys(cur['members'] + members))
            if not cur.get('lesson') and g.get('lesson'):
                cur['lesson'] = g['lesson']
    for c in companies:  # companies can declare membership too
        if c.get('twin'):
            g = twins.setdefault(c['twin'], {'id': c['twin'], 'idea': c['twin'].replace('_', ' ').capitalize(), 'members': [], 'lesson': None})
            if c['id'] not in g['members']:
                g['members'].append(c['id'])
    for g in twins.values():
        g['members'] = [m for m in g['members'] if m in ids]
    twins = {k: v for k, v in twins.items() if len(v['members']) >= 2}

    br = read_json(os.path.join(RES, 'base_rates.json'), {}) or {}
    ladders, ladder_sources, proxied, era_applied = build_ladders(br)
    sector_mods, sector_notes = build_sector_mods(br)
    causes, sector_causes = build_causes(br, companies)
    moon = build_moonshots(moon_doc)

    deals, investors, deal_stats = build_deals(companies)
    growth = ladders.get('global', {}).get('growth', {})
    bundle = {
        'meta': {
            'built': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC'),
            'companies': len(companies), 'countries': len({c['cc'] for c in companies if c['cc']}),
            'twins': len(twins), 'ladderSources': len({v for r in ladder_sources.values() for st in r.values() if isinstance(st, dict) for v in st.values() if v}),
            'proxiedRegions': proxied, 'eraApplied': era_applied, 'badLines': bad,
            'outcomes': dict(collections.Counter(c['out'] for c in companies)),
        },
        'ladders': ladders,
        'ladderSources': ladder_sources,
        'sectorMods': sector_mods,
        'sectorNotes': sector_notes,
        'founderMods': {
            'first': {'pNext': 1.0},
            'repeat_win': {'pNext': round((30.6 / 22.1) ** 0.2, 4)},
            'repeat_fail': {'pNext': round((20.9 / 22.1) ** 0.2, 4)},
            '_source': 'https://www.nber.org/papers/w12592',
            '_note': 'derived: Gompers, Kovner, Lerner & Scharfstein, "Performance Persistence in Entrepreneurship": VC-backed success rates of 30.6% (previously successful founders), 22.1% (first-time), 20.9% (previously failed); spread as a per-round multiplier over 5 rounds.',
        },
        'causes': causes,
        'sectorCauses': sector_causes,
        # per-round dilution medians (round size = post-money x dilution, so hot rounds don't dilute less than they should)
        'dilution': dilution_medians(br, ladders),
        'exits': {
            'acqToLastPost': 0.55, 'ipoToLastPost': 1.0, 'acquihireFloor': 0,
            '_notes': {
                'acqToLastPost': 'derived: Crunchbase sample of 225 acquisitions, ~12% sold below capital raised (research/base_rates.json region_notes); median sale price set so ~12% of simulated acquisitions land below capital raised.',
                'ipoToLastPost': 'assumption: IPO market cap centred on the last private valuation (sd 0.45 in log space), pending data.',
            },
        },
        'winter': {'prob': 0.7, 'lenMonths': 20, 'mult': 0.51, 'deadMult': 1.26,
                   '_note': 'derived: three US venture downturns in 25 years (2001, 2008–09, 2022–23) → ~70% chance of one in a 10-year window; during it seed→A odds ×0.51 and shutdowns ×1.26 (Carta 2022–23 crunch multipliers in research/base_rates.json).'},
        'model': {'evidencePrior': 8, 'otherRegionWeight': 0.35, 'evidenceMin': 0.55, 'evidenceMax': 1.8,
                  'sigma': 0.78, 'qualityWeight': 0.35, 'stall': {'next': 0.0, 'dead': 1.6},
                  '_notes': {'sigma': 'derived: Carta mid-2025 P95 seed valuation $72.2M vs ~$20M median → log-sd ≈ 0.78.',
                             'evidence': 'modelling choice: comps act like 8 pseudo-observations against the base rate, capped to ×0.55–×1.8.',
                             'quality': 'modelling choice: each universe has a hidden quality score so strong companies keep doing well (power law).',
                             'stall': 'modelling choice: a company that neither raises, sells nor dies at a rung (the ladder remainder) gets one more roll later in which it can only sell, shut down (at 1.6x the usual odds) or stay a zombie: the ladder graduation rates are already eventual, so stalls never add extra rounds. Calibrated so ~60-65% of pre-seed universes close within the horizon (Carta 2018 cohort: 61.9% closed after 6.5 years).'}},
        'moonshotModel': {'pNextEarly': 0.65, 'pNextLate': 1.15, 'months': 1.3, 'val': 1.6, 'round': 2.5, 'sigma': 1.2,
                          'dead': 1.6, 'nearDeathSave': 0.3,
                          '_note': 'assumption pending deep-tech base rates: harder early rounds (x0.65), longer gaps (x1.3), 2.5x bigger rounds, fatter-tailed valuations (log-sd 1.2) and one possible near-death rescue (30%). Net effect vs a normal pre-seed startup: more deaths (~76% vs ~73% in 10 years), ~1.4x the unicorns and ~10x the decacorns.'},
        'corpus': corpus_stats(companies),
        'companies': companies,
        'labels': {k: v for k, v in (read_json(os.path.join(RES, 'labels.json'), {}) or {}).items() if not k.startswith('_')},
        'twins': twins,
        'deals': deals,
        'investors': investors,
        'moonshots': moon,
        'baseRates': {k: br.get(k) for k in ('graduation', 'time_between_rounds', 'valuations', 'outcomes', 'failure_causes', 'sector_modifiers', 'dilution', 'region_notes', 'era_multipliers')},
    }
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    with io.open(os.path.join(OUT, 'bundle.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')))
    m = bundle['meta']
    print = lambda s: __builtins__.print(s.encode('ascii', 'replace').decode('ascii'))  # this Python's stdout is ASCII
    print('companies %d (%d countries), twins %d, outcomes %s' % (m['companies'], m['countries'], m['twins'], m['outcomes']))
    print('ladders: %s | proxied: %s | era: %s' % (sorted(k for k in ladders if k not in proxied), proxied, era_applied))
    print('moonshots: tooEarly %d, anti %d, curves %d, deeptech %d' % (len(moon['tooEarly']), len(moon['anti']), len(moon['curves']), len(moon['deeptech'])))
    applied, orphans = getattr(load_companies, 'enrich_stats', (0, []))
    print('enrichment lines applied: %d%s' % (applied, ('; no base record for: ' + ', '.join(orphans)) if orphans else ''))
    print('labelled by research: %d companies' % sum(1 for c in companies if c.get('v')))
    print('deals %(deals)d (%(research)d from %(files)d research files, %(bad)d bad lines), investors %(investors)d' % deal_stats)
    print('bundle size %.0f KB' % (os.path.getsize(os.path.join(OUT, 'bundle.json')) / 1024.0))


if __name__ == '__main__':
    main()
