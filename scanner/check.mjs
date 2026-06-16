#!/usr/bin/env node
// AI-friendliness scanner (GEO / "is this site readable by AI agents and search engines?").
// Zero dependencies — Node 18+ (global fetch). Usage: node scanner/check.mjs example.com
//
// Runs ~30 checks across five categories and prints a score, a level, and per-check results
// with concrete fix hints. Built to be cloned and adapted — see GEO-PLAYBOOK.md for the why.

const AI_BOTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot', 'OAI-SearchBot'];
const TIMEOUT_MS = 15000;
const UA = 'Mozilla/5.0 (compatible; geo-scanner/1.0; +https://github.com/locagoi/content-engineering-skills)';

function normalize(input) {
  let u = (input || 'example.com').trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return new URL(u);
}

async function fetchText(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ac.signal, headers: { 'User-Agent': UA } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, url: res.url, headers: res.headers };
  } catch (e) {
    return { ok: false, status: 0, body: '', error: String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- robots.txt parsing: does a given bot get Disallow: / ? ---
function robotsBlocks(robotsTxt, bot) {
  if (!robotsTxt) return null; // unknown
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  const groups = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^user-agent:\s*(.+)$/i);
    if (m) {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(m[1].toLowerCase());
      continue;
    }
    const d = line.match(/^(dis)?allow:\s*(.*)$/i);
    if (d && cur) cur.rules.push({ allow: !d[1], path: d[2].trim() });
  }
  const pick = groups.find((g) => g.agents.includes(bot.toLowerCase())) || groups.find((g) => g.agents.includes('*'));
  if (!pick) return false; // no matching group → not blocked
  return pick.rules.some((r) => !r.allow && (r.path === '/' || r.path === ''));
}

async function main() {
  const base = normalize(process.argv[2]);
  const origin = base.origin;
  console.log(`\nScanning ${origin} for AI-friendliness (GEO)…\n`);

  const [home, robots, llms, sitemap] = await Promise.all([
    fetchText(origin + '/'),
    fetchText(origin + '/robots.txt'),
    fetchText(origin + '/llms.txt'),
    fetchText(origin + '/sitemap.xml'),
  ]);

  const html = home.body || '';
  const text = stripTags(html);
  const words = text ? text.split(/\s+/).length : 0;
  const robotsTxt = robots.ok ? robots.body : null;
  const has = (re) => re.test(html);
  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);

  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsWithAlt = imgs.filter((i) => /\balt\s*=\s*["'][^"']*\S[^"']*["']/i.test(i)).length;
  const anchors = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1]).toLowerCase().trim()).filter(Boolean);
  const generic = anchors.filter((a) => /^(click here|read more|here|more|link|learn more|weiterlesen|mehr|hier)$/.test(a)).length;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const desc = descMatch ? descMatch[1] : '';
  const botStatus = AI_BOTS.map((b) => ({ bot: b, blocked: robotsBlocks(robotsTxt, b) }));
  const blockedBots = botStatus.filter((b) => b.blocked === true).map((b) => b.bot);

  const checks = [
    // --- A. Crawl & access ---
    ['A', 'Homepage reachable (200)', home.ok, home.ok ? `${home.status}` : `status ${home.status} ${home.error || ''}`],
    ['A', 'Served over HTTPS', (home.url || origin).startsWith('https://'), 'AI crawlers and ranking favor secure origins'],
    ['A', 'robots.txt present', robots.ok, robots.ok ? 'found' : 'add /robots.txt'],
    ['A', 'AI crawlers not blocked', blockedBots.length === 0, blockedBots.length ? `blocked: ${blockedBots.join(', ')}` : 'GPTBot/ClaudeBot/PerplexityBot/CCBot allowed'],
    ['A', 'llms.txt present', llms.ok, llms.ok ? 'found' : 'add /llms.txt (emerging standard: a curated map of your site for LLMs)'],
    ['A', 'sitemap.xml present', sitemap.ok || /sitemap:/i.test(robotsTxt || ''), 'helps engines discover all URLs'],
    ['A', 'Content in initial HTML (not JS-only)', words >= 200, `${words} words in raw HTML — AI crawlers often do not execute JS`],

    // --- B. Structured data & semantics ---
    ['B', 'JSON-LD structured data', jsonLd.length > 0, jsonLd.length ? `${jsonLd.length} block(s)` : 'add schema.org JSON-LD'],
    ['B', 'Organization/WebSite schema', /"@type"\s*:\s*"(Organization|WebSite|LocalBusiness)"/i.test(jsonLd.join(' ')), 'identifies the entity behind the site'],
    ['B', 'Open Graph tags', has(/<meta[^>]+property=["']og:title["']/i) && has(/<meta[^>]+property=["']og:description["']/i), 'og:title + og:description'],
    ['B', 'Semantic landmarks (main/article)', has(/<main[\s>]/i) || has(/<article[\s>]/i), 'use <main>/<article> so agents find the primary content'],
    ['B', 'Navigation landmark (<nav>)', has(/<nav[\s>]/i), 'helps agents understand structure'],
    ['B', 'Exactly one <h1>', (html.match(/<h1[\s>]/gi) || []).length === 1, `found ${(html.match(/<h1[\s>]/gi) || []).length}`],
    ['B', 'Multiple section headings (h2+)', (html.match(/<h2[\s>]/gi) || []).length >= 2, 'clear sectioning improves extraction'],
    ['B', 'html lang attribute', has(/<html[^>]+\blang\s*=/i), 'declare the content language'],
    ['B', 'Canonical URL', has(/<link[^>]+rel=["']canonical["']/i), 'prevents duplicate-content ambiguity'],
    ['B', 'Favicon declared', has(/<link[^>]+rel=["'][^"']*icon[^"']*["']/i), 'minor trust signal'],
    ['B', 'RSS/Atom feed', has(/<link[^>]+type=["']application\/(rss|atom)\+xml["']/i), 'gives engines a fresh-content channel'],

    // --- C. Metadata quality ---
    ['C', 'Title present', title.length > 0, title ? `"${title.slice(0, 60)}"` : 'missing <title>'],
    ['C', 'Title length 10–70 chars', title.length >= 10 && title.length <= 70, `${title.length} chars`],
    ['C', 'Meta description present', desc.length > 0, desc ? `${desc.length} chars` : 'add a meta description'],
    ['C', 'Description length 50–160', desc.length >= 50 && desc.length <= 160, `${desc.length} chars`],
    ['C', 'Mobile viewport meta', has(/<meta[^>]+name=["']viewport["']/i), 'responsive = crawlable on mobile-first'],

    // --- D. Content clarity for LLMs ---
    ['D', 'Substantial text content', words >= 300, `${words} words — thin pages rarely get cited`],
    ['D', 'Images have alt text', imgs.length === 0 || imgsWithAlt / imgs.length >= 0.8, `${imgsWithAlt}/${imgs.length} with alt`],
    ['D', 'Descriptive link text', anchors.length === 0 || generic / anchors.length < 0.2, `${generic}/${anchors.length} generic ("click here" etc.)`],
    ['D', 'Author/date metadata', /datePublished|article:published_time|"author"/i.test(html), 'cite-able content shows authorship + recency'],
    ['D', 'FAQ / Q&A structure', /"@type"\s*:\s*"(FAQPage|QAPage)"/i.test(jsonLd.join(' ')) || /<h[2-4][^>]*>\s*[^<]*\?\s*</i.test(html), 'Q&A blocks are heavily surfaced by AI answers'],

    // --- E. GEO specifics ---
    ['E', 'Entity links (sameAs)', /"sameAs"\s*:/i.test(jsonLd.join(' ')), 'link your entity to Wikipedia/LinkedIn/Crunchbase'],
    ['E', 'Not gated behind login', !/login|signin|sign-in/i.test(new URL(home.url || origin).pathname) && words >= 100, 'AI crawlers cannot read content behind auth'],
  ];

  const byCat = { A: 'Crawl & access', B: 'Structured data & semantics', C: 'Metadata quality', D: 'Content clarity for LLMs', E: 'GEO specifics' };
  let pass = 0;
  const fails = [];
  const grouped = {};
  for (const [cat, name, ok, detail] of checks) {
    (grouped[cat] ||= []).push({ name, ok, detail });
    if (ok) pass++; else fails.push({ cat, name, detail });
  }
  const total = checks.length;
  const score = Math.round((pass / total) * 100);
  const level = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Needs work' : 'Poor';

  for (const cat of Object.keys(byCat)) {
    if (!grouped[cat]) continue;
    console.log(`\n■ ${byCat[cat]}`);
    for (const c of grouped[cat]) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Score: ${score}/100  (${pass}/${total} checks)   Level: ${level}`);
  if (fails.length) {
    console.log(`\nTop fixes (see GEO-PLAYBOOK.md):`);
    for (const f of fails) console.log(`  • [${byCat[f.cat]}] ${f.name} — ${f.detail}`);
  }
  console.log('');

  // machine-readable summary on the last line for piping into other tools
  console.error(JSON.stringify({ origin, score, level, pass, total, fails: fails.map((f) => f.name) }));
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error('SCAN_ERROR:', e.message); process.exit(2); });
