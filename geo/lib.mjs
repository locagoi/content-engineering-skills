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

// ── Sensor health ────────────────────────────────────────────────────────────
// An engine can answer HTTP 200 with an empty body. That is NOT "we were not cited",
// it is "we did not measure" — but it looks identical in a naive tally and silently
// drags the citation rate down. Treat a blank answer as unmeasured, never as a data point.
export function isEmptyAnswer(text) {
  return !String(text ?? '').replace(/\s/g, '').length;
}

// Per-engine health over a run's result rows. A row is *measured* only if it carries a
// boolean `cited`; rows with `error` or `empty: true` are failures of the sensor, not
// observations about the target. `rate` is therefore computed over measured rows only.
// `healthy` is false when an engine measured less than `minMeasuredRatio` of its asks —
// that engine's numbers must not be aggregated into a headline rate.
export function engineHealth(results, { minMeasuredRatio = 0.8 } = {}) {
  const byEngine = new Map();
  for (const r of results || []) {
    const e = byEngine.get(r.engine) || { engine: r.engine, asked: 0, measured: 0, empty: 0, errors: 0, cited: 0 };
    e.asked++;
    if (r.error) e.errors++;
    else if (r.empty) e.empty++;
    else if (typeof r.cited === 'boolean') { e.measured++; if (r.cited) e.cited++; }
    byEngine.set(r.engine, e);
  }
  return [...byEngine.values()].map((e) => ({
    ...e,
    rate: e.measured ? Math.round((e.cited / e.measured) * 100) : null,
    healthy: e.asked > 0 && e.measured / e.asked >= minMeasuredRatio,
  }));
}

// Headline citation rate over measured rows only, plus what was thrown away and why.
// `trustworthy` is false as soon as any engine lane is unhealthy: a rate that silently
// averages a dead lane with live ones is a wrong number, not a conservative one.
export function citationRate(results, opts = {}) {
  const health = engineHealth(results, opts);
  const measured = health.reduce((n, e) => n + e.measured, 0);
  const cited = health.reduce((n, e) => n + e.cited, 0);
  return {
    rate: measured ? Math.round((cited / measured) * 100) : 0,
    cited,
    measured,
    asked: health.reduce((n, e) => n + e.asked, 0),
    empty: health.reduce((n, e) => n + e.empty, 0),
    errors: health.reduce((n, e) => n + e.errors, 0),
    health,
    trustworthy: health.length > 0 && health.every((e) => e.healthy),
  };
}
