#!/usr/bin/env node
// Guard: this repo is a clone-and-adapt TEMPLATE. Nothing org-specific belongs in it.
//
// Runs in CI on every push and via `npm test`. It deliberately knows only STRUCTURAL
// patterns — real email addresses, key shapes, absolute home paths, non-placeholder
// domains. It does NOT carry a list of company or customer names, and it never should:
// a denylist of the names you are protecting would publish them in the act of
// protecting them. Keep name-level checks in whatever private repo the port comes from.
//
// Usage: node scripts/check-generic.mjs [--history]
// Exit 0 = clean, 1 = findings.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const withHistory = process.argv.includes('--history');

// Placeholders the template may use, plus public specs and API endpoints the
// scripts legitimately call. Anything else that looks like a live site fails.
const ALLOWED = /example\.com|example\.org|yourdomain|yoursite|your-site|YOUR_[A-Z0-9_]+|<your[^>]*>|<competitor[^>]*>|<section>|<cluster>|localhost|schema\.org|openrouter\.ai|openai\.com|github\.com|claude\.com|anthropic\.com|google\.com|stripe\.com|npmjs\.com|nodejs\.org|developers\.google\.com|w3\.org|fonts\.g|creativecommons\.org|googleapis\.com|llmstxt\.org|suggestqueries\.google\.com|search\.google\.com|perplexity\.ai|clarity\.microsoft\.com|analytics\.google\.com|json-schema\.org/;

const RULES = [
  {
    name: 'Real email address',
    why: 'Use an example.com address or a placeholder, never a working mailbox.',
    re: /[A-Za-z0-9._%+-]+@(?!example\.(com|org)\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  },
  {
    name: 'Credential-shaped string',
    why: 'Secrets are read from env vars. Nothing key-shaped belongs in the tree.',
    re: /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|sbp_[a-f0-9]{40,}|ntn_[A-Za-z0-9]{30,}|xox[bapr]-[0-9]{9,}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,})\b/,
  },
  {
    name: 'Absolute home path',
    why: 'A path from someone machine leaks a username and does not resolve for a cloner.',
    re: /(\/home\/[a-z][a-z0-9_-]*|\/Users\/[A-Za-z][A-Za-z0-9_-]*|C:\\Users\\[A-Za-z][A-Za-z0-9_-]*)/,
  },
  {
    name: 'Bare UUID',
    why: 'Database, workspace and document ids identify a live system. Use a placeholder.',
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  },
  {
    name: 'Hardcoded non-placeholder domain',
    why: 'Point the template at example.com or a config value, not a live site.',
    re: /https?:\/\/(?!localhost)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/,
  },
];

const BINARY = /\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?)$/i;

// Default target is the WORKING TREE, not a commit: a guard that only reads committed
// state reports "clean" for changes that are staged or merely written to disk — which is
// exactly when you need it. `git ls-files` lists tracked + staged paths; content is read
// from disk. --history switches to scanning every commit instead.
function files(ref) {
  const args = ref === null
    ? ['ls-files', '--cached', '--others', '--exclude-standard']
    : ['ls-tree', '-r', '--name-only', ref];
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n').filter(Boolean).filter((f) => !BINARY.test(f));
}

function show(ref, file) {
  try {
    return ref === null
      ? readFileSync(file, 'utf8')
      : execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch { return ''; }
}

const refs = withHistory
  ? execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  : [null]; // null = working tree

console.log(`Template guard — scanning ${withHistory ? `${refs.length} commits` : 'working tree'}\n`);

const findings = [];
const seen = new Set();
for (const ref of refs) {
  for (const file of files(ref)) {
    // The guard itself and the example config describe the patterns; skip them.
    if (file === 'scripts/check-generic.mjs') continue;
    const text = show(ref, file);
    text.split('\n').forEach((line, i) => {
      for (const rule of RULES) {
        const m = line.match(rule.re);
        if (!m) continue;
        if (ALLOWED.test(m[0])) continue;
        const key = `${rule.name}|${file}|${m[0]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ rule, file, line: i + 1, hit: m[0] });
      }
    });
  }
}

const byRule = new Map();
for (const f of findings) byRule.set(f.rule.name, [...(byRule.get(f.rule.name) || []), f]);

for (const rule of RULES) {
  const hits = byRule.get(rule.name) || [];
  if (!hits.length) { console.log(`  ok    ${rule.name}`); continue; }
  console.log(`  FOUND ${rule.name} — ${hits.length}`);
  console.log(`        ${rule.why}`);
  for (const h of hits.slice(0, 6)) console.log(`        ${h.file}:${h.line}  ${h.hit.slice(0, 80)}`);
  if (hits.length > 6) console.log(`        … and ${hits.length - 6} more`);
}

console.log();
if (findings.length) {
  console.log(`FAILED: ${findings.length} org-specific value(s). Replace with a placeholder or move to config.`);
  process.exit(1);
}
console.log('Clean — nothing org-specific found.');
