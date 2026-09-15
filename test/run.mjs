// Zero-dependency tests for the pure GEO helpers. Run: npm test
import { domainsIn, computeDelta, strikingDistance, buildBacklog, isEmptyAnswer, engineHealth, citationRate, classify, isMeasured } from '../geo/lib.mjs';

let failed = 0;
const eq = (got, want, msg) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}\n      got:  ${a}\n      want: ${b}`); }
};
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failed++; console.log(`  ✗ ${msg}`); } };

console.log('domainsIn');
eq([...domainsIn('see stripe.com and www.Foo.co.uk, e.g. nope, example.com')].sort(), ['foo.co.uk', 'stripe.com'], 'extracts + dedupes, drops www/noise/example.com');

console.log('computeDelta');
const prev = [{ engine: 'p', prompt: 'A', cited: false, domains: ['x.com'] }, { engine: 'p', prompt: 'B', cited: true, domains: ['me.com'] }];
const curr = [{ engine: 'p', prompt: 'A', cited: true, domains: ['me.com'] }, { engine: 'p', prompt: 'B', cited: false, domains: ['y.com'] }];
const d = computeDelta(prev, curr);
eq([d.prevRate, d.currRate, d.delta], [50, 50, 0], 'rates + delta');
eq([d.closed.length, d.opened.length], [1, 1], 'one closed, one opened');
eq([d.gainedDomains, d.lostDomains], [['y.com'], ['x.com']], 'gained/lost domains');
ok(computeDelta(null, curr) === null, 'null when no previous run');

console.log('strikingDistance');
const rows = [
  { query: 'big demand', impressions: 800, position: 9, ctr: 1.2 },
  { query: 'too high', impressions: 800, position: 2, ctr: 30 },
  { query: 'too few', impressions: 10, position: 8, ctr: 1 },
  { query: 'mid', impressions: 200, position: 14, ctr: 0.8 },
];
eq(strikingDistance(rows).map((r) => r.query), ['big demand', 'mid'], 'keeps pos 5–20 with volume, sorts by impressions');

console.log('buildBacklog');
const bl = buildBacklog({
  citationGaps: [{ prompt: 'best tools for X', engine: 'perplexity', instead: ['a.com', 'b.com'] }],
  gscOpps: [{ query: 'how to do Y', impressions: 500, position: 8 }],
});
eq([bl[0].kind, bl[1].kind], ['ai-citation-gap', 'search-demand'], 'citation gaps outrank demand opps');
ok(bl[0].score === 1200 && bl[1].score === 560, 'deterministic scoring (1000+2*100; 500+(20-8)*5)');

console.log('isEmptyAnswer');
ok(isEmptyAnswer('') && isEmptyAnswer('   \n\t ') && isEmptyAnswer(null) && isEmptyAnswer(undefined), 'blank/whitespace/nullish are empty');
ok(!isEmptyAnswer('a'), 'any real character is an answer');

console.log('engineHealth / citationRate — the dead-lane regression');
// One live lane (measures, cites twice) and one dead lane that answers HTTP 200 with nothing.
// Scored naively, the dead lane reads as "4 prompts where we were not cited" and halves the rate.
const run = [
  { engine: 'perplexity', prompt: 'a', cited: true, domains: ['me.com'] },
  { engine: 'perplexity', prompt: 'b', cited: true, domains: ['me.com'] },
  { engine: 'perplexity', prompt: 'c', cited: false, domains: ['rival.com'] },
  { engine: 'perplexity', prompt: 'd', cited: false, domains: ['rival.com'] },
  { engine: 'chatgpt', prompt: 'a', empty: true },
  { engine: 'chatgpt', prompt: 'b', empty: true },
  { engine: 'chatgpt', prompt: 'c', empty: true },
  { engine: 'chatgpt', prompt: 'd', empty: true },
];
const h = engineHealth(run);
const live = h.find((e) => e.engine === 'perplexity');
const dead = h.find((e) => e.engine === 'chatgpt');
eq([live.measured, live.cited, live.rate, live.healthy], [4, 2, 50, true], 'live lane: 4 measured, 50%, healthy');
eq([dead.measured, dead.empty, dead.rate, dead.healthy], [0, 4, null, false], 'dead lane: 0 measured, rate null, unhealthy');

const cr = citationRate(run);
eq([cr.rate, cr.cited, cr.measured, cr.asked], [50, 2, 4, 8], 'rate is 50% over MEASURED rows, not 25% over asked');
ok(cr.empty === 4 && cr.errors === 0, 'empty answers counted separately, not as evidence');
ok(cr.trustworthy === false, 'a dead lane makes the whole run untrustworthy');

// Errors must not be silently folded into the denominator either.
const errored = [
  { engine: 'x', prompt: 'a', cited: true, domains: ['me.com'] },
  { engine: 'x', prompt: 'b', error: '429 rate limited' },
];
const ce = citationRate(errored, { minMeasuredRatio: 0.5 });
eq([ce.rate, ce.measured, ce.errors], [100, 1, 1], 'errored ask excluded from the rate, reported separately');

// All lanes healthy → trustworthy.
// domains MUST be non-empty here: an answer naming no domain at all is now classified
// as 'unsourced' (the engine did not search), which is not a measurement.
ok(citationRate([{ engine: 'x', prompt: 'a', cited: true, domains: ['me.com'] }]).trustworthy === true, 'fully measured run is trustworthy');

console.log('classify — die vier Arten, nichts gemessen zu haben');
eq(classify({ error: '429' }), 'errored', 'HTTP-Fehler');
eq(classify({ empty: true }), 'empty', 'leerer Body bei HTTP 200');
eq(classify({ truncated: true, domains: [] }), 'truncated', 'am Token-Limit abgerissen');
eq(classify({ domains: [] }), 'unsourced', 'Antwort ganz ohne Domains = ohne Websuche');
eq(classify({ domains: ['rival.com'], cited: false }), 'gap', 'Domains da, wir nicht dabei');
eq(classify({ domains: ['me.com'], cited: true }), 'cited', 'wir sind dabei');
ok(!isMeasured({ domains: [] }) && !isMeasured({ truncated: true }), 'unsourced und truncated sind keine Messung');
ok(isMeasured({ domains: ['x.com'], cited: false }), 'ein echter Gap IST eine Messung');

console.log('citationRate — unsourced darf die Rate nicht druecken');
// Vier Prompts: zweimal zitiert, einmal echter Gap, einmal ohne Websuche beantwortet.
// Naiv gezaehlt waere das 2/4 = 50 %. Richtig ist 2/3 = 67 %, weil die vierte Zeile
// gar keine Beobachtung ueber uns enthaelt — dort wurde NIEMAND zitiert.
const mixed = [
  { engine: 'p', prompt: 'a', cited: true,  domains: ['me.com'] },
  { engine: 'p', prompt: 'b', cited: true,  domains: ['me.com'] },
  { engine: 'p', prompt: 'c', cited: false, domains: ['rival.com'] },
  { engine: 'p', prompt: 'd', cited: false, domains: [] },
];
const cm = citationRate(mixed);
eq([cm.rate, cm.cited, cm.measured, cm.asked], [67, 2, 3, 4], 'Rate 67% ueber 3 gemessene, nicht 50% ueber 4 gefragte');
eq([cm.unsourced, cm.empty, cm.errors], [1, 0, 0], 'die vierte Zeile zaehlt als unsourced');

console.log('citationRate — truncated ebenso');
const cut = citationRate([
  { engine: 'x', prompt: 'a', cited: true, domains: ['me.com'] },
  { engine: 'x', prompt: 'b', cited: false, domains: [], truncated: true },
], { minMeasuredRatio: 0.4 });
eq([cut.rate, cut.measured, cut.truncated], [100, 1, 1], 'abgeschnittene Antwort raus aus dem Nenner');

console.log('computeDelta — eine Rate, nicht zwei');
// Der Regressionsfall: computeDelta trug einen EIGENEN rate()-Helfer, der jede Zeile
// mit boolean `cited` zaehlte. Derselbe Lauf meldete dadurch 67 % in der Kopfzeile
// und 40 % in der Delta-Zeile.
const oneRun = [
  { engine: 'a', prompt: 'p1', cited: true,  domains: ['me.com'] },
  { engine: 'a', prompt: 'p2', cited: false, domains: ['rival.com'] },
  { engine: 'a', prompt: 'p3', cited: true,  domains: ['me.com'] },
  { engine: 'a', prompt: 'p4', cited: false, domains: [] },
  { engine: 'a', prompt: 'p5', cited: false, domains: [], truncated: true },
];
const headline = citationRate(oneRun);
const same = computeDelta(oneRun, oneRun);
eq([same.currRate, same.prevRate], [headline.rate, headline.rate], 'Delta-Zeile meldet dieselbe Rate wie die Kopfzeile');
eq(same.delta, 0, 'identischer Lauf = 0 Punkte Veraenderung');

console.log('computeDelta — unsourced ist kein verlorenes Zitat');
const before = [{ engine: 'a', prompt: 'p1', cited: true, domains: ['me.com'] }];
const after  = [{ engine: 'a', prompt: 'p1', cited: false, domains: [] }];
const moved = computeDelta(before, after);
eq(moved.opened.length, 0, 'zitiert -> unsourced zaehlt NICHT als geoeffneter Gap');
const realLoss = computeDelta(before, [{ engine: 'a', prompt: 'p1', cited: false, domains: ['rival.com'] }]);
eq(realLoss.opened.length, 1, 'zitiert -> echter Gap zaehlt schon');

console.log('computeDelta — unlesbarer Vorlauf wird als solcher gemeldet');
const oldFormat = [{ engine: 'a', prompt: 'p1', cited: true }, { engine: 'a', prompt: 'p2', cited: false }];
const cmp = computeDelta(oldFormat, oneRun);
eq([cmp.comparable, cmp.delta], [false, null], 'Vorlauf ohne domains = nicht vergleichbar, kein erfundener Sprung');
ok(cmp.prevMeasured === 0, 'und der Grund steht im Ergebnis: 0 gemessene Zeilen');

console.log(`\n${failed ? `FAILED: ${failed} assertion(s)` : 'All tests passed'}`);
process.exit(failed ? 1 : 0);
