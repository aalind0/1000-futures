#!/usr/bin/env python3
"""Point the site at its real address before deploying.

    python3 -I scripts/set_domain.py futures.example.com [--handle @you] [--corrections you@example.com|https://form...]

Writes the domain into site/js/config.js (share cards), and absolute URLs into the link-preview tags in
site/index.html (LinkedIn, X and Slack need an absolute og:image URL). Safe to run again with a new domain.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(argv):
    if not argv or argv[0].startswith('-'):
        sys.exit(__doc__)
    domain = re.sub(r'^https?://', '', argv[0]).strip('/')
    opts = dict(zip(argv[1::2], argv[2::2]))
    base = 'https://' + domain
    cfg = os.path.join(ROOT, 'site', 'js', 'config.js')
    s = io.open(cfg, encoding='utf-8').read()
    s = re.sub(r"domain: '[^']*'", "domain: '%s'" % domain, s, count=1)
    if '--handle' in opts:
        s = re.sub(r"handle: '[^']*'", "handle: '%s'" % opts['--handle'], s, count=1)
    if '--corrections' in opts:
        s = re.sub(r"corrections: '[^']*'", "corrections: '%s'" % opts['--corrections'], s, count=1)
    io.open(cfg, 'w', encoding='utf-8').write(s)
    page = os.path.join(ROOT, 'site', 'index.html')
    h = io.open(page, encoding='utf-8').read()
    h = re.sub(r'(<meta property="og:url" content=")[^"]*', r'\g<1>' + base + '/', h)
    h = re.sub(r'(<meta property="og:image" content=")[^"]*', r'\g<1>' + base + '/og.png', h)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', r'\g<1>' + base + '/', h)
    io.open(page, 'w', encoding='utf-8').write(h)
    print('Set domain to %s (config.js, og:url, og:image, canonical).' % base)


if __name__ == '__main__':
    main(sys.argv[1:])
