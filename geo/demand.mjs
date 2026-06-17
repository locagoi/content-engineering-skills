#!/usr/bin/env node
// Analytics → demand signals. Pulls Google Search Console (what people search and where you're
// weak) + GA4 (what content actually engages) so the loop writes for REAL interest, not guesses.
// Clarity behavior signals come via the Clarity MCP inside the /demand skill (can't bundle an MCP).
//
// Needs `npm install` (googleapis) + a Google service-account JSON with GSC + GA4 read access.
// Env: GSC_CREDENTIALS_FILE (path to SA json), GSC_SITE (e.g. https://example.com/), GA4_PROPERTY_ID (optional).
// Usage: NODE_OPTIONS=--use-system-ca node geo/demand.mjs [--days 28]

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { strikingDistance } from './lib.mjs';

let google;
try { ({ google } = await import('googleapis')); }
catch { console.error('Missing dependency: run `npm install` first (needs googleapis).'); process.exit(2); }

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const days = Number((args.find((a) => a.startsWith('--days')) || '').split(/[ =]/)[1]) || 28;
const KEY = process.env.GSC_CREDENTIALS_FILE;
const SITE = process.env.GSC_SITE;
const GA4 = process.env.GA4_PROPERTY_ID;

if (!KEY) { console.error('Set GSC_CREDENTIALS_FILE to your Google service-account JSON path.'); process.exit(2); }
if (!SITE) { console.error('Set GSC_SITE to your verified property (e.g. https://example.com/).'); process.exit(2); }

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const auth = new google.auth.GoogleAuth({
  keyFile: KEY,
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'],
});

async function gscQueries() {
  const sc = google.searchconsole({ version: 'v1', auth });
  const res = await sc.searchanalytics.query({
    siteUrl: SITE,
    requestBody: { startDate: isoDaysAgo(days + 2), endDate: isoDaysAgo(2), dimensions: ['query'], rowLimit: 500 },
  });
  return (res.data.rows || []).map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10 }));
}

async function ga4Pages() {
  if (!GA4) return null;
  const data = google.analyticsdata({ version: 'v1beta', auth });
  const res = await data.properties.runReport({
    property: `properties/${GA4}`,
    requestBody: {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'engagementRate' }, { name: 'conversions' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 25,
    },
  });
  return (res.data.rows || []).map((r) => ({ page: r.dimensionValues[0].value, views: Number(r.metricValues[0].value), engagementRate: Math.round(Number(r.metricValues[1].value) * 100), conversions: Number(r.metricValues[2].value || 0) }));
}

async function main() {
  console.log(`\nDemand signals for ${SITE} — last ${days} days\n`);
  const queries = await gscQueries().catch((e) => { console.error('GSC error:', e.message); return []; });
  const opportunities = strikingDistance(queries);
  const pages = await ga4Pages().catch((e) => { console.error('GA4 error:', e.message); return null; });

  console.log(`Top search demand (by impressions):`);
  for (const q of queries.slice(0, 10)) console.log(`  • "${q.query}" — ${q.impressions} impr, pos ${q.position}, CTR ${q.ctr}%`);
  console.log(`\nStriking-distance opportunities (pos 5–20, real volume → write/improve these):`);
  for (const o of opportunities.slice(0, 15)) console.log(`  ◆ "${o.query}" — ${o.impressions} impr @ pos ${o.position}`);
  if (pages) {
    console.log(`\nTop engaging pages (GA4 — what already resonates):`);
    for (const p of pages.slice(0, 10)) console.log(`  • ${p.page} — ${p.views} views, ${p.engagementRate}% engaged${p.conversions ? `, ${p.conversions} conv` : ''}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync(join(HERE, 'runs'), { recursive: true });
  const out = join(HERE, 'runs', `demand-${stamp}.json`);
  writeFileSync(out, JSON.stringify({ site: SITE, days, queries, opportunities, pages, ranAt: stamp }, null, 2));
  console.log(`\nSaved: geo/runs/demand-${stamp}.json`);
  console.log(`Next: node geo/gaps.mjs  → merges these with AI-citation gaps into a ranked backlog.\n`);
}

main().catch((e) => { console.error('DEMAND_ERROR:', e.message); process.exit(2); });
