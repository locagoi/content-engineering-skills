---
description: "Pull demand signals (GSC search + GA4 engagement + Clarity behavior) so the GEO loop writes for what people actually want."
---

# /demand — Demand Signals (analytics step of the GEO loop)

Answers "what are people actually interested in, and where am I weak?" by combining three sources. This feeds the **gaps** step (`geo/gaps.mjs`) which merges it with AI-citation gaps into a ranked backlog.

## Setup (bring your own data)

- `npm install` (adds `googleapis`, only needed here).
- A Google **service-account JSON** with read access to your GSC property and GA4. Set `GSC_CREDENTIALS_FILE` (path), `GSC_SITE` (e.g. `https://example.com/`), and optionally `GA4_PROPERTY_ID`.
- For Clarity: a connected **Clarity MCP** (`mcp__clarity__*`).

## Run

```
NODE_OPTIONS=--use-system-ca node "$PROJECTS_DIR/content-engineering-skills/geo/demand.mjs" $ARGUMENTS
```
(`--days 28` by default. `NODE_OPTIONS` only needed behind a TLS-inspecting proxy.)

Then pull **Clarity** behavior for the same period via the MCP:
- `mcp__clarity__query-analytics-dashboard` — top pages, scroll depth, dead/rage clicks (where readers struggle = thin or unclear content).

## After running

Read the saved `geo/runs/demand-<ts>.json` and present:

- **Search demand** — top GSC queries by impressions (what your audience asks).
- **Striking-distance opportunities** — queries at position 5–20 with real volume. These are the fastest GEO wins: you already rank, you're just not winning the citation/click.
- **What resonates** — top GA4 pages by views/engagement/conversions → double down on those topics.
- **Friction** — Clarity dead/rage clicks + shallow scroll → content that needs depth or clarity.

## Next

`node "$PROJECTS_DIR/content-engineering-skills/geo/gaps.mjs"` merges this with the latest `/ai-visibility` run into a ranked backlog → `/longtail` writes the top items.
