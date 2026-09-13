# geo-toolkit

[![test](https://github.com/locagoi/content-engineering-skills/actions/workflows/test.yml/badge.svg)](https://github.com/locagoi/content-engineering-skills/actions/workflows/test.yml)

A self-contained **content-engineering** toolkit for [Claude Code](https://claude.com/claude-code): run content as an unattended loop, and get your site **surfaced and cited by AI answer engines** (ChatGPT, Perplexity, Google AI Overviews, Claude) — not just ranked in classic search.

Two loops, one repo:

- **The GEO loop** — `analytics → gaps → content → measure`. Point it at your site and grow AI-search visibility on a schedule.
- **The pipeline loop** — `idea → gate → creation → gate → publish`. A scheduled dispatcher runs the next due step and stops at the two decisions a human actually owns.

> Built for a real content stack, released as a clone-and-adapt template. Org-specific values are `YOUR_*` placeholders,
> and a CI guard keeps it that way — see [CONTRIBUTING.md](CONTRIBUTING.md) before adding anything.

## The loop

```
/pipeline       ← dispatcher: runs the next due step on a schedule, stops at the human gates
 ├─ /ideation      ← turn signals into ARTEFACTS (matrix, flow, template) — not "insights"
 │                    → 🔔 gate 1: is this idea worth making?
 ├─ /geo           ← orchestrator for the GEO loop below (schedule it → GEO on autopilot)
 │   ├─ /scan          ← audit a site's AI-friendliness (30 checks → score + fixes) [no key, no deps]
 │   ├─ /demand        ← analytics: GSC search demand + GA4 engagement + Clarity behavior
 │   ├─ /ai-visibility ← measure: citation rate + run-over-run delta + per-lane sensor health
 │   │   └─ gaps.mjs   ← merge demand + citation gaps → one ranked content backlog
 │   └─ /longtail      ← content: write the data-rich, citable article for each backlog item
 └─ publish        ← 🔔 gate 2: review the RENDERED piece in the PR → merge, index, measure
```

**analytics → gaps → content → measure → repeat**, with two human gates around it. See
[GEO-PLAYBOOK.md](GEO-PLAYBOOK.md) for the why behind every check, and
[skills/pipeline.md](skills/pipeline.md) for why the gate rules look the way they do.

## Quick start (zero setup — the scanner needs no key, no deps)

```bash
git clone https://github.com/locagoi/content-engineering-skills.git
cd content-engineering-skills
node scanner/check.mjs stripe.com        # → Score: 87/100 (Good) + ranked fixes
npm test                                 # → unit tests for the GEO helpers
```
(Behind a TLS-inspecting proxy? Prefix with `NODE_OPTIONS=--use-system-ca`.)

## Install the skills in Claude Code

```bash
./setup.sh        # macOS/Linux — symlinks skills/*.md into ~/.claude/commands
```
```powershell
.\setup.ps1       # Windows — hardlinks skills/*.md into ~/.claude/commands (no admin on NTFS)
```
Then: `/pipeline auto` for the full loop, `/geo full` for just the GEO half, or step by step
`/ideation`, `/scan`, `/demand`, `/ai-visibility`, `/longtail`.

Set `PROJECTS_DIR` and clone into `$PROJECTS_DIR/content-engineering-skills` so the skills find the bundled scripts:
```bash
export PROJECTS_DIR="$HOME/Projects"     # macOS/Linux  (Windows: setx PROJECTS_DIR "%USERPROFILE%\Projects")
```

## What's in the box

| Path | What | Needs |
|---|---|---|
| `scanner/check.mjs` | 30-check AI-friendliness scanner | nothing |
| `geo/citation-check.mjs` | citation tracker + delta + **per-lane sensor health** | OpenRouter key |
| `geo/demand.mjs` | GSC + GA4 demand puller | `npm install` + Google service account |
| `geo/gaps.mjs` | merges demand + citation gaps → ranked backlog | nothing |
| `geo/lib.mjs` + `test/run.mjs` | pure, unit-tested helpers (`npm test`) | nothing |
| `pipeline/state.example.json` | the pipeline state schema (copy it, commit your `state.json`) | nothing |
| `longtail.config.example.json` | seeds, topic scope and site settings for `/longtail` (copy to `longtail.config.json`, gitignored) | nothing |
| `scripts/check-generic.mjs` | template guard — fails CI on anything org-specific | nothing |
| `skills/*.md` | the slash-commands: `pipeline`, `ideation`, `geo`, `scan`, `demand`, `ai-visibility`, `longtail` | — |
| `GEO-PLAYBOOK.md`, `STRATEGY.md`, `CONVENTIONS.md` | the why + your templates | — |

## What you bring (per step)

| Step | Provide |
|---|---|
| `/ideation` | your own buyer questions (reply threads, tickets, call notes) |
| `/pipeline` | a git repo for the content, a place to post gate-1 cards, a scheduler |
| `/scan` | nothing |
| `/ai-visibility` | an [OpenRouter](https://openrouter.ai) key (`OPENROUTER_API_KEY`); verify model ids in `geo/prompts.json` |
| `/demand` | Google service account (`GSC_CREDENTIALS_FILE`, `GSC_SITE`, optional `GA4_PROPERTY_ID`) + a Clarity MCP |
| `/longtail` | your own site (assumes Astro) + a publishing path + `CONTENT_CONFIG_DIR` (see below) |

Secrets go in env vars or a folder **outside** the repo — nothing here reads a hard-coded key.

**Your own values live outside the repo too.** Copy `longtail.config.example.json` somewhere private, fill it in, and point `CONTENT_CONFIG_DIR` at that directory:

```bash
mkdir -p ~/my-content-config
cp longtail.config.example.json ~/my-content-config/longtail.config.json
export CONTENT_CONFIG_DIR="$HOME/my-content-config"
```

Seeds, topic scope and site settings are your content strategy and your competitor watchlist — they are not template content. Outside the tree, not gitignored inside it: a path outside is a property, `.gitignore` is a promise. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Run it automatically

Schedule `/geo full` (weekly is plenty) with Claude Code's `/schedule` or any cron. Each run audits, pulls demand, measures citations, and produces a ranked backlog + a citation delta — so you write for the next gaps and watch them close. Keep a human gate on publishing, or auto-draft and review.

## Notes

- All skills are English except `skills/longtail.md`, which is still German from the original DACH stack — adapt or translate it.
- **`/ai-visibility` reports sensor health before it reports a rate.** An engine can answer HTTP 200 with an empty body; scored naively that reads as "we were not cited" and silently drags the rate down. Empty and errored asks are excluded from the denominator and reported separately, and any dead lane marks the whole run `UNTRUSTWORTHY`. Never report a rate from a run with a dead lane as a trend.
- `geo/runs/`, `data/`, `logs/` are runtime output (gitignored).

## License

MIT — see [LICENSE](LICENSE).
