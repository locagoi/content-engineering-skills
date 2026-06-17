#!/usr/bin/env node
// The "gaps" step: merge the latest AI-citation run (geo/runs/<ts>/summary.json) with the latest
// demand pull (geo/runs/demand-*.json) into ONE ranked content backlog → geo/runs/backlog-<ts>.json.
// Zero dependencies. Run after /ai-visibility and /demand. Feeds /longtail.

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildBacklog } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const runsDir = join(HERE, 'runs');
const read = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

function latestCitation() {
  if (!existsSync(runsDir)) return null;
  const dirs = readdirSync(runsDir).filter((d) => { try { return statSync(join(runsDir, d)).isDirectory() && existsSync(join(runsDir, d, 'summary.json')); } catch { return false; } }).sort();
  return dirs.length ? read(join(runsDir, dirs[dirs.length - 1], 'summary.json')) : null;
}
function latestDemand() {
  if (!existsSync(runsDir)) return null;
  const files = readdirSync(runsDir).filter((f) => /^demand-.*\.json$/.test(f)).sort();
  return files.length ? read(join(runsDir, files[files.length - 1])) : null;
}

const citation = latestCitation();
const demand = latestDemand();
if (!citation && !demand) { console.error('No runs found. Run /ai-visibility and/or /demand first.'); process.exit(1); }

const backlog = buildBacklog({
  citationGaps: citation?.gaps || [],
  gscOpps: demand?.opportunities || [],
});

console.log(`\nRanked GEO content backlog  (citation gaps: ${citation?.gaps?.length || 0}, demand opps: ${demand?.opportunities?.length || 0})\n`);
backlog.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. [${b.kind}] ${b.topic}\n      → ${b.why}`));

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(join(runsDir, `backlog-${stamp}.json`), JSON.stringify({ backlog, sources: { citation: citation?.ranAt || null, demand: demand?.ranAt || null }, ranAt: stamp }, null, 2));
console.log(`\nSaved: geo/runs/backlog-${stamp}.json`);
console.log(`Next: /longtail writes the top items; then re-run /ai-visibility to measure the lift.\n`);
