// Brand settings shown on share cards. Set `domain` to the site's real domain before launch.
export const CONFIG = {
  domain: 'aalind0.github.io/1000-futures',            // e.g. 'futures.yourbrand.com'
  handle: '',            // e.g. '@yourhandle' — appears on share cards when set
  corrections: 'https://github.com/aalind0/1000-futures/issues/new',       // where "Suggest a correction" goes: an email address or a form URL. Links stay hidden while empty.
  // href for a correction about one company / investor / page, or null when no destination is set
  correctionHref(subject) {
    const c = (this.corrections || '').trim();
    if (!c) return null;
    const page = typeof location !== 'undefined' ? location.href : '';
    const body = `What's wrong, and a source if you have one:\n\n\nPage: ${page}`;
    if (/\/issues\/new\/?$/.test(c)) return `${c}?title=${encodeURIComponent('Correction: ' + subject)}&body=${encodeURIComponent(body)}`; // GitHub issue, pre-filled
    if (/^https?:\/\//.test(c)) return c;
    return `mailto:${c}?subject=${encodeURIComponent('Correction: ' + subject)}&body=${encodeURIComponent(body)}`;
  },
  siteLabel() {
    if (this.domain) return this.domain + (this.handle ? '  ·  ' + this.handle : '');
    const h = typeof location !== 'undefined' ? location.host : '';
    return (h || 'set domain in js/config.js') + (this.handle ? '  ·  ' + this.handle : '');
  },
};
