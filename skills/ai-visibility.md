---
description: "GEO citation tracking — ask AI engines your target prompts and measure whether your domain gets cited."
---

# /ai-visibility — AI Citation Tracker (GEO)

Measures how often AI engines cite **your** domain for the buyer questions you care about (the "are we surfaced in AI answers?" half of GEO). Uses the bundled `geo/citation-check.mjs`, which routes every engine through the **OpenRouter API** (no browser, no Playwright).

## Setup (once)

1. Copy `geo/prompts.example.json` → `geo/prompts.json` and edit the `prompts` (your buyer questions) and `engines` (OpenRouter model ids).
2. Get an OpenRouter key → set `OPENROUTER_API_KEY` (env var or your secrets file).

## Arguments

`$ARGUMENTS`:
- `<domain>` — run all prompts × all engines for that domain
- `--limit N` — only the first N prompts
- `--engine perplexity` — a single engine

## Run

```
OPENROUTER_API_KEY=... NODE_OPTIONS=--use-system-ca node "$PROJECTS_DIR/content-engineering-skills/geo/citation-check.mjs" $ARGUMENTS
```

> `NODE_OPTIONS=--use-system-ca` only matters behind a TLS-inspecting proxy.

## After running

Read the latest `geo/runs/<timestamp>/summary.json` and show the user:

- **Citation rate** — how often the domain appeared in answers.
- **Change vs previous run** (`summary.delta`) — the rate Δ in points, which prompts **closed** (became cited) or **opened** (lost citation), and new competitor domains. This is how you prove that filling a gap worked. The first run is the baseline (no delta).
- **Most-cited domains** — who AI engines surface instead (your real GEO competitors).
- **Gaps** — prompts where you were absent and who was cited instead. **Each gap is a content brief** → feed it to `/longtail`, publish, then re-run this to measure the lift.

Optionally post the summary to Slack via `mcp__claude_ai_Slack__slack_send_message` (channel `YOUR_SLACK_CHANNEL_ID`).

## Notes

- Perplexity-style "online" models cite live sources — they're the most representative of real AI-search behavior. Plain chat models reflect training-data recall.
- Model ids drift; keep them current in `geo/prompts.json`.
- The loop is GEO's feedback engine: **measure citation gaps → write data-rich content for them (`/longtail`) → re-measure.**
