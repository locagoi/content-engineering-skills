#!/usr/bin/env node
// GEO citation tracker — ask AI engines your target prompts and measure how often YOUR domain
// gets cited vs competitors. This is the "are we surfaced in AI answers?" half of GEO.
//
// Zero npm deps — Node 18+. Routes every engine through the OpenRouter API.
// Usage:  OPENROUTER_API_KEY=sk-... node geo/citation-check.mjs yourdomain.com [--limit N] [--engine perplexity]
//
// Prompts: geo/prompts.json (copy geo/prompts.example.json). Output: geo/runs/<ts>/summary.json + console.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { domainsIn, computeDelta, isEmptyAnswer, citationRate, classify } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// Load the most recent prior run's results (for run-over-run delta), if any.
function loadPreviousResults() {
  const runsDir = join(HERE, 'runs');
  if (!existsSync(runsDir)) return null;
  const dirs = readdirSync(runsDir).filter((d) => existsSync(join(runsDir, d, 'summary.json'))).sort();
  if (!dirs.length) return null;
  try { return JSON.parse(readFileSync(join(runsDir, dirs[dirs.length - 1], 'summary.json'), 'utf8')).results || null; }
  catch { return null; }
}
const KEY = process.env.OPENROUTER_API_KEY;
const args = process.argv.slice(2);
const target = (args.find((a) => !a.startsWith('--')) || 'example.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
const limit = Number((args.find((a) => a.startsWith('--limit')) || '').split(/[ =]/)[1]) || Infinity;
const onlyEngine = (args.find((a) => a.startsWith('--engine')) || '').split(/[ =]/)[1];

// OpenRouter model ids. Override via geo/prompts.json "engines".
// Model slugs DRIFT — verify current ones at https://openrouter.ai/models.
// Perplexity "sonar" searches the LIVE web (most representative of AI search / GEO);
// plain chat models reflect training-data recall. "-latest" aliases auto-update.
const DEFAULT_ENGINES = {
  perplexity: 'perplexity/sonar',
  chatgpt: 'openai/gpt-5.5',
  gemini: 'google/gemini-flash-latest',
  claude: 'anthropic/claude-sonnet-latest',
};

if (!KEY) { console.error('Missing OPENROUTER_API_KEY (env or your secrets file).'); process.exit(2); }

const cfgPath = existsSync(join(HERE, 'prompts.json')) ? join(HERE, 'prompts.json') : join(HERE, 'prompts.example.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
let engines = cfg.engines || DEFAULT_ENGINES;
if (onlyEngine) engines = { [onlyEngine]: engines[onlyEngine] || DEFAULT_ENGINES[onlyEngine] };
const prompts = (cfg.prompts || []).slice(0, limit);

async function ask(model, prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
  });
  if (!res.ok) return { text: '', error: `${res.status} ${await res.text().catch(() => '')}`.slice(0, 200) };
  const j = await res.json();
  const text = j.choices?.[0]?.message?.content || '';
  // finish_reason 'length' means the answer was cut at the token limit — citations that
  // would have followed are simply missing. Not a measurement either.
  const truncated = j.choices?.[0]?.finish_reason === 'length';
  // HTTP 200 + blank body = the lane answered nothing. Flag it; never score it.
  return { text, empty: isEmptyAnswer(text), truncated };
}

async function main() {
  console.log(`\nGEO citation check for "${target}" — ${prompts.length} prompts × ${Object.keys(engines).length} engines\n`);
  const previous = loadPreviousResults();
  const results = [];
  const competitorTally = {};

  for (const prompt of prompts) {
    for (const [name, model] of Object.entries(engines)) {
      const { text, error, empty, truncated } = await ask(model, prompt);
      if (error) { console.log(`  ! [${name}] ${error}`); results.push({ prompt, engine: name, error }); continue; }
      const domains = [...domainsIn(text)];
      const hit = domains.some((d) => d === target || d.endsWith('.' + target));
      const row = { prompt, engine: name, empty, truncated, cited: hit, domains: domains.slice(0, 10) };
      const kind = classify(row);
      if (kind === 'cited' || kind === 'gap') {
        for (const d of domains) if (d !== target && !d.endsWith('.' + target)) competitorTally[d] = (competitorTally[d] || 0) + 1;
      }
      const mark = { cited: '✓', gap: '·', empty: '?', truncated: '✂', unsourced: '○' }[kind];
      const note = { empty: ' empty answer — not measured', truncated: ' cut at token limit — not measured',
                     unsourced: ' answered without web search — nobody cited, not a gap' }[kind] || '';
      console.log(`  ${mark} [${name}] ${prompt.slice(0, 56)}${prompt.length > 56 ? '…' : ''}${note}`);
      results.push(row);
    }
  }

  const topDomains = Object.entries(competitorTally).sort((a, b) => b[1] - a[1]).slice(0, 10);
  // Only real gaps become content tasks: an unsourced or truncated answer is not evidence
  // that anyone out-ranked you — the engine never produced a citable answer at all.
  const gaps = results.filter((r) => classify(r) === 'gap').map((r) => ({ prompt: r.prompt, engine: r.engine, instead: (r.domains || []).slice(0, 3) }));
  const { rate, cited, measured, asked, empty, truncated, unsourced, errors, health, trustworthy } = citationRate(results);

  console.log(`\n────────────────────────────────────────`);
  console.log(`Sensor health — ${measured}/${asked} prompts measured (${empty} empty, ${truncated} truncated, ${unsourced} unsourced, ${errors} errored)`);
  for (const e of health) {
    const r = e.rate === null ? 'no data' : `${e.rate}%`;
    console.log(`  ${e.healthy ? '✓' : '⚠'} ${e.engine}: measured ${e.measured}/${e.asked}, cited ${e.cited} (${r})${e.healthy ? '' : '  ← LANE DEAD'}`);
  }
  if (!trustworthy) {
    console.log(`\n⚠  At least one lane returned almost nothing. An empty lane is NOT evidence that`);
    console.log(`   you are uncited — it is a broken sensor. Fix the model id or key before reading`);
    console.log(`   the rate below as a measurement, and never report it as a trend.`);
  }
  console.log(`\nCitation rate for ${target}: ${cited}/${measured} measured (${rate}%)${trustworthy ? '' : '  [UNTRUSTWORTHY]'}`);
  console.log(`\nMost-cited domains across answers:`);
  for (const [d, n] of topDomains) console.log(`  • ${d} (${n}×)`);
  if (gaps.length) {
    console.log(`\nGaps (you were not cited) — content opportunities:`);
    for (const g of gaps.slice(0, 15)) console.log(`  • [${g.engine}] ${g.prompt.slice(0, 70)}  → cited instead: ${g.instead.join(', ') || '—'}`);
  }

  const delta = computeDelta(previous, results);
  if (delta) {
    const sign = delta.delta > 0 ? '+' : '';
    console.log(`\nChange vs previous run: ${delta.prevRate}% → ${delta.currRate}%  (${sign}${delta.delta} pts)`);
    if (delta.closed.length) console.log(`  ✓ gaps closed (now cited): ${delta.closed.map((c) => `[${c.engine}] ${c.prompt.slice(0, 50)}`).join(' | ')}`);
    if (delta.opened.length) console.log(`  ✗ gaps opened (lost citation): ${delta.opened.map((c) => `[${c.engine}] ${c.prompt.slice(0, 50)}`).join(' | ')}`);
    if (delta.gainedDomains.length) console.log(`  + new domains in answers: ${delta.gainedDomains.slice(0, 8).join(', ')}`);
  } else {
    console.log(`\n(no previous run to compare — this is your baseline)`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(HERE, 'runs', stamp);
  mkdirSync(outDir, { recursive: true });
  const summary = { target, rate, cited, measured, asked, empty, truncated, unsourced, errors, trustworthy, health, topDomains, gaps, delta, results, ranAt: stamp };
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nSaved: geo/runs/${stamp}/summary.json\n`);
}

main().catch((e) => { console.error('CITATION_ERROR:', e.message); process.exit(2); });
