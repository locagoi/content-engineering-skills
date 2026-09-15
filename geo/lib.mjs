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

// The two outcomes that actually measured visibility. Everything else (errored,
// empty, truncated, unsourced) tells you about the lane, not about the market.
const MEASURED = new Set(['gap', 'cited']);

const key = (r) => `${r.engine}::${r.prompt}`;

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
    if (!p) continue;
    // Only rows that MEASURED something on both sides can have moved. A prompt that
    // was cited last week and came back unsourced this week did not lose a citation;
    // the engine just did not search. Counting it as an opened gap invents a loss.
    const pk = classify(p), ck = classify(c);
    if (!MEASURED.has(pk) || !MEASURED.has(ck)) continue;
    if (pk === 'gap' && ck === 'cited') closed.push({ engine: c.engine, prompt: c.prompt });
    if (pk === 'cited' && ck === 'gap') opened.push({ engine: c.engine, prompt: c.prompt });
  }
  const domSet = (rows) => new Set(rows.flatMap((r) => r.domains || []));
  const prevDoms = domSet(prev);
  const currDoms = domSet(curr);
  const gained = [...currDoms].filter((d) => !prevDoms.has(d));
  const lost = [...prevDoms].filter((d) => !currDoms.has(d));
  // Both rates come from citationRate(), the SAME function that prints the headline.
  // A second, simpler rate helper used to live here and scored every row with a
  // boolean `cited` — so one run reported two different rates: 67 % in the headline
  // and 40 % in the delta line. Whoever read the delta line read the old, wrong
  // denominator, which is exactly the confusion this module exists to remove.
  const prevStats = citationRate(prev);
  const currStats = citationRate(curr);
  // An old summary written before rows carried `domains` re-scores as all-unsourced,
  // i.e. measured === 0. That is not a 0 % citation rate, it is an unreadable run.
  // Say so instead of printing a drop that never happened.
  const comparable = prevStats.measured > 0 && currStats.measured > 0;
  const prevRate = prevStats.rate;
  const currRate = currStats.rate;
  return {
    prevRate, currRate, comparable,
    prevMeasured: prevStats.measured, currMeasured: currStats.measured,
    delta: comparable ? currRate - prevRate : null,
    closed, opened, gainedDomains: gained, lostDomains: lost,
  };
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
    const e = byEngine.get(r.engine) || { engine: r.engine, asked: 0, measured: 0, empty: 0, truncated: 0, unsourced: 0, errors: 0, cited: 0 };
    e.asked++;
    const kind = classify(r);
    if (kind === 'errored') e.errors++;
    else if (kind === 'empty') e.empty++;
    else if (kind === 'truncated') e.truncated++;
    else if (kind === 'unsourced') e.unsourced++;
    else { e.measured++; if (r.cited) e.cited++; }
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
    truncated: health.reduce((n, e) => n + e.truncated, 0),
    unsourced: health.reduce((n, e) => n + e.unsourced, 0),
    errors: health.reduce((n, e) => n + e.errors, 0),
    health,
    trustworthy: health.length > 0 && health.every((e) => e.healthy),
  };
}

// An answer that names NO domain at all is usually not "we were not cited" — it is an
// engine that answered from training recall without searching the web. Nobody is cited in
// such an answer, not even a competitor, so it is not a visibility gap and must not become
// a content task. Distinguishing the two is the difference between a backlog of real gaps
// and a backlog padded with questions that trigger no search at all.
export function classify(row) {
  if (row.error) return 'errored';
  if (row.empty) return 'empty';        // HTTP 200, blank body — the lane measured nothing
  if (row.truncated) return 'truncated'; // hit the token limit; citations may be cut off
  if (!row.domains || row.domains.length === 0) return 'unsourced'; // answered without search
  return row.cited ? 'cited' : 'gap';
}

// Rows that carry a real observation about the target. `unsourced` and `truncated` are
// excluded: in both the engine never produced a citable answer, so counting them as
// "not cited" understates the rate and inflates the gap list.
export function isMeasured(row) {
  const k = classify(row);
  return k === 'cited' || k === 'gap';
}
