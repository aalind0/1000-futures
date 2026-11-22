# 1,000 Futures

A reality check for startup ideas. Type an idea and see the real companies that tried something like it,
how they died or won, who funds the space, and the questions investors will ask. Then watch the idea play
out 1,000 times on published base rates.

**Live site:** https://aalind0.github.io/1000-futures/

> Beta. Not financial, investment, legal or tax advice. The data is a sample of companies and funding
> rounds, not the whole market, and may contain errors. Every number links to its source in the data room.

## What's in here

- `site/`: the static site (vanilla JS, no build step). `site/data/bundle.json` is the built dataset.
- `research/`: the sourced research (companies, funding rounds, investors, base rates) the dataset is built from.
- `scripts/build_data.py`: rebuilds `site/data/bundle.json` from `research/`.
- `tests/`: idea-matching and cap-table tests.

## Run it locally

```bash
node server.js            # http://localhost:8000
python3 -I scripts/build_data.py   # after changing research/
node tests/matching.test.mjs && node tests/captable.test.mjs
```

## Publish

The live site is the `site/` folder, served by GitHub Pages from the `gh-pages` branch. After committing
changes to `main`, run `sh scripts/publish.sh`.

## Corrections

Spot something wrong about a company or investor? Open an issue with a source.

## License

MIT, see [LICENSE](LICENSE). Feel free to build on top. The research data is compiled from public sources;
each record links to its source, so cite those when you reuse it.
