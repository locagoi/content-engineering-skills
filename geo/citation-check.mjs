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
import { domainsIn, computeDelta } from './lib.mjs';

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

// OpenRouter model ids. Override via geo/prompts.json "engines". "online" models (Perplexity) cite live sources.
const DEFAULT_ENGINES = {
  perplexity: 'perplexity/llama-3.1-sonar-large-128k-online',
  chatgpt: 'openai/gpt-4o-search-preview',
  gemini: 'google/gemini-2.0-flash-001',
  claude: 'anthropic/claude-3.5-sonnet',
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
  return { text: j.choices?.[0]?.message?.content || '' };
}

async function main() {
  console.log(`\nGEO citation check for "${target}" — ${prompts.length} prompts × ${Object.keys(engines).length} engines\n`);
  const previous = loadPreviousResults();
  const results = [];
  const competitorTally = {};
  let cited = 0, asked = 0;

  for (const prompt of prompts) {
    for (const [name, model] of Object.entries(engines)) {
      asked++;
      const { text, error } = await ask(model, prompt);
      if (error) { console.log(`  ! ${name}: ${error}`); results.push({ prompt, engine: name, error }); continue; }
      const domains = domainsIn(text);
      const hit = [...domains].some((d) => d === target || d.endsWith('.' + target));
      if (hit) cited++;
      for (const d of domains) if (d !== target && !d.endsWith('.' + target)) competitorTally[d] = (competitorTally[d] || 0) + 1;
      console.log(`  ${hit ? '✓' : '·'} [${name}] ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`);
      results.push({ prompt, engine: name, cited: hit, domains: [...domains].slice(0, 10) });
    }
  }

  const topDomains = Object.entries(competitorTally).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const gaps = results.filter((r) => r.cited === false).map((r) => ({ prompt: r.prompt, engine: r.engine, instead: (r.domains || []).slice(0, 3) }));
  const rate = asked ? Math.round((cited / asked) * 100) : 0;

  console.log(`\n────────────────────────────────────────`);
  console.log(`Citation rate for ${target}: ${cited}/${asked} (${rate}%)`);
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
  const summary = { target, rate, cited, asked, topDomains, gaps, delta, results, ranAt: stamp };
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nSaved: geo/runs/${stamp}/summary.json\n`);
}

main().catch((e) => { console.error('CITATION_ERROR:', e.message); process.exit(2); });
