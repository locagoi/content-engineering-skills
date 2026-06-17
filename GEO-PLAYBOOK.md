# GEO Playbook — making a site citable by AI engines

GEO (Generative Engine Optimization) is getting your site **surfaced and cited** by AI answer engines — ChatGPT, Perplexity, Google AI Overviews, Claude — not just ranked in the ten blue links. Two jobs: make the site **machine-readable** (`/scan`), and make the content **worth citing** (`/longtail`), then **measure** whether engines actually cite you (`/ai-visibility`).

This file is the fix reference for the scanner. Each `/scan` FAIL maps to one of these.

## Crawl & access — can the engines get in?

- **Don't block AI crawlers.** In `robots.txt`, allow `GPTBot`, `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot`, `Google-Extended`, `CCBot`. A blanket `Disallow: /` for these = invisible to AI search.
- **Ship `llms.txt`** at the root — a Markdown map of your most important pages for LLMs ([llmstxt.org](https://llmstxt.org)). Emerging, low-cost, high-signal.
- **`sitemap.xml`** + reference it in `robots.txt`.
- **Content in the initial HTML.** Most AI crawlers don't execute JS. If your content only appears after client-side rendering, they see an empty page. Server-render or pre-render the substantive text.
- **HTTPS**, real `200`s, no login wall on public content.

## Structured data & semantics — can they parse it?

- **JSON-LD** (`<script type="application/ld+json">`) with the right `@type`: `Organization`/`WebSite` site-wide, `Article`/`FAQPage`/`Product` per page. This is the single highest-leverage GEO fix.
- **`sameAs`** linking your entity to Wikipedia/LinkedIn/Crunchbase — entity disambiguation is how engines trust "who" you are.
- **Semantic HTML**: one `<h1>`, real `<h2>` sectioning, `<main>`/`<article>`/`<nav>`, `lang` on `<html>`, a `<link rel="canonical">`.
- **Open Graph** tags so shared/quoted snippets render correctly.

## Metadata quality

- **Title** 10–70 chars, keyword front-loaded. **Meta description** 50–160 chars, a complete sentence. **Viewport** meta for mobile-first crawling.

## Content clarity — is it worth citing?

- **Depth + specificity.** AI engines cite content with concrete numbers, named methods, and clear claims — not thin marketing copy. Original data you alone can publish is the strongest citation magnet.
- **Q&A structure.** Phrase headings as the questions buyers ask; back them with `FAQPage` schema. Answer engines lift Q&A blocks directly.
- **Authorship + recency** (`author`, `datePublished`/`dateModified`) — freshness and provenance raise citation odds.
- **Descriptive link text and image `alt`** — both are machine-readable context, not decoration.

## The loop (analytics → gaps → content → measure)

Run by `/geo`, or step by step:

1. **Audit** — `/scan yourdomain.com` → fix every FAIL until ≥ 90. The site has to be machine-readable before content can get cited.
2. **Analytics** — `/demand` → GSC search demand + GA4 engagement + Clarity behavior. This is *what people actually want* and where you're already close (striking distance).
3. **Measure citations** — `/ai-visibility yourdomain.com` → the buyer prompts where competitors get cited and you don't, plus the delta vs your last run.
4. **Gaps** — `geo/gaps.mjs` merges 2 + 3 into one ranked backlog: citation gaps first, then high-demand striking-distance queries.
5. **Content** — `/longtail` → write the data-rich page that answers each top gap; publish; request indexing.
6. **Measure again** — re-run step 3 after a re-crawl window; the delta shows which gaps closed. Then loop.

GEO is a closed loop, not a one-time audit — and `/geo` can run it on a schedule.
