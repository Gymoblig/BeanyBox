// Generic HTML-email string transforms for the raw HTML body content Gmail's
// API hands back — plain-text fallback / sanitizing / inline image discovery.

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u0020',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122', shy: '\u00AD',
  middot: '\u00B7', bull: '\u2022', deg: '\u00B0', times: '\u00D7', divide: '\u00F7',
};

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (m, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch (e) { return ''; }
    })
    .replace(/&#(\d+);/g, (m, dec) => {
      try { return String.fromCodePoint(Number(dec)); } catch (e) { return ''; }
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m));
}

// Marketing/notification HTML often pads with runs of invisible or
// barely-visible spacing characters (figure spaces, soft hyphens, zero-width
// joiners) to defeat inbox preview-text clipping. Once decoded these are
// either invisible junk or wide blank space -- neither is useful in a plain
// text reader, so we drop or collapse them.
function stripInvisibles(str) {
  return str
    // soft hyphen, combining grapheme joiner, zero-width space/non-joiner/joiner, word joiner, BOM
    .replace(/[\u00AD\u034F\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    // runs of 2+ Unicode space-separator characters (incl. figure space U+2007) collapse to one
    .replace(/[\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]{2,}/g, ' ');
}

function stripHtml(html) {
  let out = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Keep link text, drop tracking-link noise, append the URL in parens.
  out = out.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (/^mailto:/i.test(href)) return text;
    return `${text} (${href})`;
  });

  out = out
    .replace(/<img[^>]*>/gi, '') // decorative/inline images add noise, not content
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  out = stripInvisibles(decodeEntities(out));

  return out
    .replace(/[ \t]+\n/g, '\n')
    // whitespace-only lines (common between empty table-spacer rows) count
    // as "blank" too, not just truly-empty ones, so the collapse below
    // actually catches runs of them instead of leaving a wall of near-blank lines
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractImgSrcs(html) {
  const out = [];
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

// Rendered inside a sandboxed iframe with no allow-scripts, so <script> can't
// execute regardless — this strip is defense in depth, and also removes
// inline event-handler attributes (onclick, onerror, ...) for good measure.
function sanitizeForRender(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=("[^"]*"|'[^']*')/gi, '');
}

module.exports = { stripHtml, extractImgSrcs, sanitizeForRender };
