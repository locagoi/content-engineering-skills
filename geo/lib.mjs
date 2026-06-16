// Pure helpers for the GEO citation tracker — kept separate so they're unit-testable
// without an API key. See citation-check.mjs for the runner.

const DOMAIN_RE = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi;
const NOISE = new Set(['e.g', 'i.e', 'etc.com', 'example.com']);

// Extract bare domains mentioned in a block of text.
export function domainsIn(text) {
  const found = new Set();
  for (const m of (text || '').matchAll(DOMAIN_RE)) {
    const d = m[1].toLowerCase().replace(/^www\./, '');
    if (d.includes('.') && !NOISE.has(d) && /\.[a-z]{2,}$/.test(d)) found.add(d);
  }
  return found;
}

const key = (r) => `${r.engine}::${r.prompt}`;
const rate = (rows) => {
  const scored = rows.filter((r) => typeof r.cited === 'boolean');
  return scored.length ? Math.round((scored.filter((r) => r.cited).length / scored.length) * 100) : 0;
};

// Diff two runs' result arrays ([{prompt, engine, cited, domains}]).
// Returns the citation-rate change plus which prompt×engine pairs closed (gap→cited)
// or opened (cited→gap), and competitor domains gained/lost across all answers.
export function computeDelta(prev, curr) {
  if (!prev || !prev.length) return null;
  const prevMap = new Map(prev.map((r) => [key(r), r]));
  const closed = [];
  const opened = [];
  for (const c of curr) {
    const p = prevMap.get(key(c));
    if (!p || typeof p.cited !== 'boolean' || typeof c.cited !== 'boolean') continue;
    if (!p.cited && c.cited) closed.push({ engine: c.engine, prompt: c.prompt });
    if (p.cited && !c.cited) opened.push({ engine: c.engine, prompt: c.prompt });
  }
  const domSet = (rows) => new Set(rows.flatMap((r) => r.domains || []));
  const prevDoms = domSet(prev);
  const currDoms = domSet(curr);
  const gained = [...currDoms].filter((d) => !prevDoms.has(d));
  const lost = [...prevDoms].filter((d) => !currDoms.has(d));
  const prevRate = rate(prev);
  const currRate = rate(curr);
  return { prevRate, currRate, delta: currRate - prevRate, closed, opened, gainedDomains: gained, lostDomains: lost };
}
