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

// "Striking distance" search demand: queries that already rank on page 1–2 (pos 5–20) with
// real impressions but weak CTR. These are the highest-ROI content opportunities from GSC.
export function strikingDistance(gscRows, { minImpressions = 50, posMin = 5, posMax = 20 } = {}) {
  return (gscRows || [])
    .filter((r) => r.impressions >= minImpressions && r.position >= posMin && r.position <= posMax)
    .map((r) => ({ query: r.query, impressions: r.impressions, position: Math.round(r.position * 10) / 10, ctr: r.ctr }))
    .sort((a, b) => b.impressions - a.impressions);
}

// The "gaps" step: merge AI-citation gaps (where AI engines don't cite you) with search-demand
// gaps (where real traffic exists but you're weak) into ONE ranked content backlog.
// Citation gaps rank highest (being invisible in AI answers is the core GEO problem),
// boosted by how many competitors get cited instead; demand gaps ranked by impressions × position.
export function buildBacklog({ citationGaps = [], gscOpps = [], topN = 25 } = {}) {
  const items = [];
  for (const g of citationGaps) {
    const comp = g.instead || g.competitors || [];
    items.push({
      topic: g.prompt, kind: 'ai-citation-gap', engine: g.engine, competitors: comp, demand: 0,
      score: 1000 + comp.length * 100,
      why: `Not cited by ${g.engine || 'AI'}${comp.length ? `; cited instead: ${comp.slice(0, 3).join(', ')}` : ''}`,
    });
  }
  for (const o of gscOpps) {
    items.push({
      topic: o.query, kind: 'search-demand', impressions: o.impressions, position: o.position, demand: o.impressions,
      score: Math.min(o.impressions, 900) + (20 - Math.min(o.position, 20)) * 5,
      why: `${o.impressions} impressions at avg position ${o.position} — striking distance`,
    });
  }
  return items.sort((a, b) => b.score - a.score).slice(0, topN);
}
