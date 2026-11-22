# Putting 1,000 Futures online

The site is static: everything lives in `site/`. No server or build step is needed in production
(`server.js` is only for local development).

1. **Rebuild the data** if research changed: `python3 -I scripts/build_data.py`
2. **Set the real address** (and optionally your handle and where corrections go):
   `python3 -I scripts/set_domain.py futures.yourdomain.com --handle @you --corrections you@yourdomain.com`
   `--corrections` takes an email address or a form URL (Google Forms, Tally). While it's empty, the
   "Suggest a correction" links stay hidden.
3. **GitHub Pages (current setup):** commit, then `sh scripts/publish.sh`. It pushes `site/` to the
   `gh-pages` branch, which GitHub serves at https://aalind0.github.io/1000-futures/.
   **Or deploy the `site/` folder** to any other static host (all have free tiers):
   - Cloudflare Pages: create a project, upload `site/`, and add your domain. Turn on Web Analytics in
     the dashboard for privacy-friendly visit counts without changing any code.
   - Netlify: drag `site/` onto app.netlify.com/drop, then add your domain.
   - Vercel: `npx vercel deploy site --prod`.
4. **Check the link preview** before posting: paste the URL into LinkedIn's Post Inspector
   (linkedin.com/post-inspector). It should show `og.png` with the title.
