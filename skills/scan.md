---
description: Scan a website for AI-friendliness (GEO). Runs 30 checks and reports a score with concrete fixes.
---

# /scan — AI-Friendliness Scanner (GEO)

Run the bundled scanner against the domain in `$ARGUMENTS` (default `example.com`). The scanner has **no dependencies** — Node 18+ with built-in `fetch`.

```
NODE_OPTIONS=--use-system-ca node "$PROJECTS_DIR/content-engineering-skills/scanner/check.mjs" $ARGUMENTS
```

> `NODE_OPTIONS=--use-system-ca` is only needed behind a TLS-inspecting proxy/antivirus (otherwise `fetch` fails with "unable to verify the first certificate"). Drop it otherwise.

## After running

1. Show the score (`/100`), the level, and the per-category results.
2. List the FAIL items and, for each, give a concrete fix referencing [`GEO-PLAYBOOK.md`](../GEO-PLAYBOOK.md).
3. If a previous score for this domain is known, note the delta.

## What it checks (30 checks, 5 categories)

- **Crawl & access** — 200/HTTPS, robots.txt, AI bots (GPTBot/ClaudeBot/PerplexityBot/CCBot) not blocked, llms.txt, sitemap, content in raw HTML (not JS-only).
- **Structured data & semantics** — JSON-LD, Organization/WebSite schema, Open Graph, `<main>`/`<article>`/`<nav>`, single `<h1>`, heading depth, `lang`, canonical, favicon, feed.
- **Metadata quality** — title presence/length, meta description presence/length, viewport.
- **Content clarity for LLMs** — text volume, image alt text, descriptive link text, author/date, FAQ/Q&A structure.
- **GEO specifics** — entity links (`sameAs`), content not gated behind login.

The scanner also prints a JSON summary to stderr (`{origin, score, level, fails}`) so you can pipe it into other tools.
