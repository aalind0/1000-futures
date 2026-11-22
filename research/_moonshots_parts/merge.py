"""Merge research/_moonshots_parts/* into research/moonshots.json (SCHEMA.md section 4).

Run: python3 -I "research/_moonshots_parts/merge.py"   (from the project root or anywhere)
Inputs (all optional except companies_*.jsonl):
  companies_*.jsonl      one company per line (section 1 shape + moonshot fields)
  too_early_pairs.json   array
  anti_portfolio.json    array
  cost_curves.json       array
  deeptech_base_rates.json array
"""
import glob, io, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "moonshots.json")

REQUIRED = ["id", "name", "country", "region", "city", "sector", "tags", "one_liner", "founded", "ended",
            "outcome", "total_raised_usd", "peak_valuation_usd", "exit_value_usd", "rounds", "causes",
            "drivers", "story", "twin_group", "sources", "confidence", "moonshot", "near_death",
            "dismissed_by", "enabler"]


def load_json(name):
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        return []
    return json.load(io.open(p, encoding="utf-8"))


companies, seen = [], set()
for f in sorted(glob.glob(os.path.join(HERE, "companies_*.jsonl"))):
    for n, line in enumerate(io.open(f, encoding="utf-8"), 1):
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        missing = [k for k in REQUIRED if k not in d]
        if missing:
            raise SystemExit("%s:%d %s missing %s" % (f, n, d.get("id"), missing))
        if d["id"] in seen:
            continue
        seen.add(d["id"])
        companies.append(d)

out = {
    "_meta": {
        "status": "partial",
        "note": "Items with \"verified\": false were written from model knowledge with canonical source URLs "
                "that were not fetched in the collection session; verify before shipping. Company records are "
                "sourced from search-result summaries (confidence medium) unless marked high.",
    },
    "companies": companies,
    "too_early_pairs": load_json("too_early_pairs.json"),
    "anti_portfolio": load_json("anti_portfolio.json"),
    "cost_curves": load_json("cost_curves.json"),
    "deeptech_base_rates": load_json("deeptech_base_rates.json"),
}
io.open(OUT, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
print({k: len(v) for k, v in out.items() if isinstance(v, list)})
