---
description: "Run the full GEO loop end to end: analytics → gaps → content → measure. The entry point to grow GEO on autopilot."
---

# /geo — the GEO loop orchestrator

Drives the whole loop so a site grows its AI-search visibility continuously: **analytics → gaps → content → measure**. Run it on a schedule (see below) and GEO compounds without manual steps.

`$ARGUMENTS`: `full` (default — the whole loop), `audit` (just scan+fix), `status` (last backlog + last citation delta).

## The loop

All paths are under `$PROJECTS_DIR/content-engineering-skills`. Prefix Node calls with `NODE_OPTIONS=--use-system-ca` only behind a TLS-inspecting proxy.

### 1. Audit & fix (technical GEO)
```
node scanner/check.mjs <yourdomain>
```
Report the score; for each FAIL, propose the fix from [GEO-PLAYBOOK.md](../GEO-PLAYBOOK.md). Site must be machine-readable before content can get cited.

### 2. Analytics → demand (what people want)
Run `/demand` (`node geo/demand.mjs`) + pull Clarity via its MCP. Surfaces search demand, striking-distance opportunities, what already engages, and friction.

### 3. Measure citations → citation gaps (where AI ignores you)
Run `/ai-visibility <yourdomain>` (`node geo/citation-check.mjs`). Surfaces the prompts where competitors get cited and you don't — plus the run-over-run delta if a prior run exists.

### 4. Gaps → ranked backlog (the merge)
```
node geo/gaps.mjs
```
Merges demand (step 2) + citation gaps (step 3) into one ranked `geo/runs/backlog-<ts>.json`: citation gaps first (core GEO problem), then high-demand striking-distance queries.

### 5. Content (fill the top gaps)
For the top N backlog items, run the `/longtail` flow — write data-rich, citable articles to the bar in [STRATEGY.md](../STRATEGY.md) and GEO-PLAYBOOK.md, publish to the site, and request indexing.

### 6. Measure (did it work?)
After publish + a re-crawl window, re-run step 3. The citation **delta** shows which gaps closed. Closed → archive; still open → keep or rewrite. Then loop.

## Run it automatically

GEO compounds when the loop runs unattended. Schedule `/geo full` (e.g. weekly) with your scheduler of choice, or Claude Code's `/schedule`. A scheduled run does steps 1–4 + 6 autonomously and leaves a ranked backlog + a citation delta report; step 5 (writing/publishing) is where you keep a human gate — or auto-draft and review. Each cycle: measure what changed, write for the next gaps, re-measure.

## status

Show the newest `geo/runs/backlog-*.json` (current priorities) and the `delta` from the newest citation `summary.json` (last measured movement).
