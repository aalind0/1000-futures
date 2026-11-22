#!/usr/bin/env bash
# Downloads the open bulk startup datasets for 1,000 Futures into data/raw/<source>/.
# Each source gets its own folder; nothing here is executed, only saved.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"
mkdir -p "$RAW/yc" "$RAW/crunchbase2015" "$RAW/wikidata"

get() { # url, output path
  printf '%-70s ' "$(basename "$2")"
  curl -sS -L --fail --max-time 180 -o "$2" -w "%{http_code} %{size_download} bytes\n" "$1" || echo "FAILED: $1"
}

# 1. Y Combinator directory: every YC company with status Active / Inactive / Acquired / Public,
#    batch, industry, region, one-liner, team size (community mirror of ycombinator.com/companies).
get "https://yc-oss.github.io/api/companies/all.json" "$RAW/yc/all.json"

# 2. Crunchbase open data export (2015 snapshot, ~66k companies worldwide): status
#    (operating / closed / acquired / ipo), country, category, funding rounds, acquisitions.
CB="https://raw.githubusercontent.com/notpeter/crunchbase-data/master"
for f in companies rounds acquisitions investments; do
  get "$CB/$f.csv" "$RAW/crunchbase2015/$f.csv"
done

# 3. Wikidata: companies founded since 1995 that have a dissolution date, with country and industry.
Q='SELECT ?c ?cLabel ?inception ?dissolved ?countryLabel ?industryLabel WHERE {
  ?c wdt:P31/wdt:P279* wd:Q4830453; wdt:P571 ?inception; wdt:P576 ?dissolved.
  FILTER(YEAR(?inception) >= 1995)
  OPTIONAL { ?c wdt:P17 ?country. } OPTIONAL { ?c wdt:P452 ?industry. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 60000'
printf '%-70s ' "defunct_companies.json"
curl -sS -G --fail --max-time 300 "https://query.wikidata.org/sparql" \
  -H "Accept: application/sparql-results+json" -H "User-Agent: 1000-futures-research/0.1" \
  --data-urlencode "query=$Q" -o "$RAW/wikidata/defunct_companies.json" \
  -w "%{http_code} %{size_download} bytes\n" || echo "FAILED: wikidata (optional, safe to ignore)"

echo "Done. Files are in $RAW"
