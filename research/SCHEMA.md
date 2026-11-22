# 1,000 Futures — research data schema

Every research agent writes into `research/` using these exact shapes, so the files can be merged
into the site dataset by a script. Write incrementally (append to .jsonl as you go) so work survives.

## 1. Companies — `research/companies_<region-group>.jsonl` (one JSON object per line)

```json
{
  "id": "glovo",                       // lowercase slug, unique
  "name": "Glovo",
  "country": "ES",                     // ISO-3166 alpha-2 of HQ / main market
  "region": "europe",                  // see Regions
  "city": "Barcelona",
  "sector": "quick_commerce_delivery", // see Sectors (one primary)
  "tags": ["delivery","courier","food","on-demand","marketplace"], // 5-12 matching keywords
  "one_liner": "On-demand courier app delivering anything in under 30 minutes",
  "founded": 2015,
  "ended": null,                       // year it died / was acquired / IPO'd, else null
  "outcome": "acquired",               // dead | acquihire | acquired | ipo | private_unicorn | active
  "total_raised_usd": 1200000000,
  "peak_valuation_usd": 2600000000,    // null if unknown
  "exit_value_usd": 2600000000,        // acquisition price / IPO market cap, null if none
  "rounds": [
    {"stage": "seed", "year": 2015, "amount_usd": 2200000, "post_money_usd": null, "lead": "Bonsai Partners"},
    {"stage": "A",    "year": 2016, "amount_usd": 5000000, "post_money_usd": null, "lead": null}
  ],                                   // stages: pre_seed | seed | A | B | C | D | E+ | growth | debt | ipo
  "causes": [],                        // for dead / acquihire: Death causes (1-3, most important first)
  "drivers": ["local_density","first_mover"], // for winners: free-text short snake_case reasons (1-3)
  "story": "2-3 factual sentences: what it tried, what happened, why.",
  "twin_group": "anything_delivery",   // optional: id of a twin group (same idea, other markets)
  "sources": ["https://..."],          // >= 1 URL that backs the key numbers / outcome
  "confidence": "high"                 // high (multiple / primary sources) | medium
}
```

Rules: USD amounts as plain integers (convert local currency at the rate of that year, note it in `story`
if material). Unknown numbers = `null`, never guessed. Only real companies with a verifiable source.

## 2. Twin groups — `research/twins_<region-group>.json` (array)

Same idea, different market / timing, different outcome. This powers "it died in the US but worked in Spain".

```json
{"id": "anything_delivery", "idea": "On-demand delivery of anything from local stores",
 "members": ["postmates","glovo","rappi","dunzo"], "lesson": "One factual sentence on what made the difference."}
```

Members are company ids (they may live in another agent's file; use the obvious slug: lowercase, hyphens).

## 3. Base rates — `research/base_rates.json` (single object, every number has a source)

```json
{
  "graduation":          [{"region","period","from_stage","to_stage","prob","within_months","source","note"}],
  "time_between_rounds": [{"region","period","from_stage","to_stage","median_months","source"}],
  "valuations":          [{"region","year","stage","median_pre_money_usd","median_post_money_usd","median_round_usd","source"}],
  "outcomes":            [{"region","cohort","horizon_years","shutdown_pct","acquired_pct","ipo_pct","still_private_pct","source"}],
  "failure_causes":      [{"cause","pct","sample","source"}],
  "sector_modifiers":    [{"sector","metric","value","source","note"}],
  "dilution":            [{"stage","median_pct","period","source"}],
  "region_notes":        [{"region","fact","source"}]
}
```

`region` uses the Regions list, or `global`. `source` is a URL. If a figure is derived, say how in `note`.

## 4. Moonshot layer — `research/moonshots.json` (single object)

Moonshots don't follow average base rates: more die, but the winners are enormous, timelines are longer,
and "everyone said it was crazy" is normal. This file grounds the visionary side of the simulation.

```json
{
  "companies": [  // same shape as section 1, plus these optional fields
    {"id": "spacex", "...": "...", "moonshot": true,
     "near_death": [{"year": 2008, "what": "Third Falcon 1 failure; cash for one more launch"}],
     "dismissed_by": [{"who": "role or named public source", "quote_or_fact": "...", "source": "https://..."}],
     "enabler": "launch_cost"}   // id of an enabling cost curve below, if any
  ],
  "too_early_pairs": [ {"early_id": "general-magic", "later_id": "apple-iphone", "gap_years": 17,
                        "what_changed": "one sentence", "sources": ["https://..."]} ],
  "anti_portfolio": [ {"investor": "Bessemer Venture Partners", "company": "Airbnb", "year": 2008,
                       "why_passed": "...", "outcome": "...", "source": "https://..."} ],
  "cost_curves": [ {"id": "launch_cost", "label": "Cost to launch 1 kg to low Earth orbit", "unit": "USD/kg",
                    "points": [[1981, 54500], [2018, 1400]], "source": "https://...",
                    "unlocks": ["satellite internet", "space manufacturing"]} ],
  "deeptech_base_rates": [ {"metric": "...", "value": 0.0, "note": "...", "source": "https://..."} ]
}
```

## Regions
north_america, europe, uk, israel, india, china, east_asia (JP/KR/TW), sea (SG/ID/VN/TH/PH/MY),
latam, mena, africa, oceania

## Sectors (pick one primary)
fintech, crypto_web3, ecommerce_marketplace, quick_commerce_delivery, mobility_transport, proptech_realestate,
healthtech, biotech, edtech, saas_b2b, devtools_infra, ai_ml, consumer_social, media_content, gaming, foodtech,
hardware_iot, climate_energy, logistics_supplychain, hrtech_work, travel_hospitality, legal_govtech, insurtech,
agritech, deeptech_space, security, adtech_martech, retail_d2c, gig_services_ondemand

## Death causes (use these exact ids)
no_market_need, ran_out_of_cash, funding_crunch, outcompeted, bad_unit_economics, regulatory, legal_ip, fraud,
team_conflict, product_tech_failure, too_early, scaled_too_fast, failed_pivot, platform_dependency,
lost_key_customer, hardware_supply_chain, local_incumbent, wrong_market_fit, acquired_and_shut, founder_burnout

## 5. Deals (research/deals_<group>.jsonl) — powers "Who funds this"

One funding round per line. Every line must come from a search result you actually saw; `source` is that result's URL.

```json
{"company": "Skild AI", "country": "US", "year": 2024, "month": 7, "stage": "A",
 "amount_usd": 300000000, "post_money_usd": 1500000000,
 "leads": ["Lightspeed Venture Partners", "Coatue", "SoftBank"],
 "investors": ["Felicis", "Sequoia Capital", "Amazon", "Jeff Bezos"],
 "v": "robotics", "sv": "robot_learning",
 "one_liner": "Foundation model that lets any robot learn new tasks",
 "source": "https://...", "confidence": "high"}
```

- `stage`: one of pre_seed, seed, A, B, C, growth (D and later = growth). Unlabelled rounds: best guess from size, confidence "medium".
- `leads`: the investors the source says led. Empty list if the source doesn't say. Never guess a lead.
- `investors`: other named participants (institutions and notable angels), as written in the source.
- `v`/`sv`: taxonomy ids from site/js/taxonomy.js.
- `month`: optional. `post_money_usd`: null when not reported.
- `confidence`: high = named in a primary/news source with the lead; medium = snippet only or stage inferred.
