// Zero-dependency tests for the pure GEO helpers. Run: npm test
import { domainsIn, computeDelta, strikingDistance, buildBacklog } from '../geo/lib.mjs';

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

console.log(`\n${failed ? `FAILED: ${failed} assertion(s)` : 'All tests passed'}`);
process.exit(failed ? 1 : 0);
