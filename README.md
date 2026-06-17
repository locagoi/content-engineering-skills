# geo-toolkit

[![test](https://github.com/locagoi/content-engineering-skills/actions/workflows/test.yml/badge.svg)](https://github.com/locagoi/content-engineering-skills/actions/workflows/test.yml)

A self-contained **GEO** (Generative Engine Optimization) toolkit for [Claude Code](https://claude.com/claude-code) — get your site **surfaced and cited by AI answer engines** (ChatGPT, Perplexity, Google AI Overviews, Claude), not just ranked in classic search.

It's the **whole loop, automatable**: `analytics → gaps → content → measure`. Clone it, point it at your site/analytics, and grow your AI-search visibility on a schedule.

> Built for a real content stack, released as a clone-and-adapt template. Org-specific values are `YOUR_*` placeholders.

## The loop

```
/geo            ← orchestrator: runs the whole loop end to end (schedule it → GEO on autopilot)
 ├─ /scan          ← audit a site's AI-friendliness (30 checks → score + fixes)   [no key, no deps]
 ├─ /demand        ← analytics: GSC search demand + GA4 engagement + Clarity behavior
 ├─ /ai-visibility ← measure: ask AI engines your buyer questions, get citation rate + run-over-run delta
 │   └─ gaps.mjs   ← merge demand + citation gaps → one ranked content backlog
 └─ /longtail      ← content: write the data-rich, citable article for each top backlog item
```

**analytics → gaps → content → measure → repeat.** See [GEO-PLAYBOOK.md](GEO-PLAYBOOK.md) for the why behind every check.

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
Then: `/geo full`, or step by step `/scan`, `/demand`, `/ai-visibility`, `/longtail`.

Set `PROJECTS_DIR` and clone into `$PROJECTS_DIR/content-engineering-skills` so the skills find the bundled scripts:
```bash
export PROJECTS_DIR="$HOME/Projects"     # macOS/Linux  (Windows: setx PROJECTS_DIR "%USERPROFILE%\Projects")
```

## What's in the box

| Path | What | Needs |
|---|---|---|
| `scanner/check.mjs` | 30-check AI-friendliness scanner | nothing |
| `geo/citation-check.mjs` | citation tracker + run-over-run delta | OpenRouter key |
| `geo/demand.mjs` | GSC + GA4 demand puller | `npm install` + Google service account |
| `geo/gaps.mjs` | merges demand + citation gaps → ranked backlog | nothing |
| `geo/lib.mjs` + `test/run.mjs` | pure, unit-tested helpers (`npm test`) | nothing |
| `skills/*.md` | the slash-commands: `geo`, `scan`, `demand`, `ai-visibility`, `longtail` | — |
| `GEO-PLAYBOOK.md`, `STRATEGY.md`, `CONVENTIONS.md` | the why + your templates | — |

## What you bring (per step)

| Step | Provide |
|---|---|
| `/scan` | nothing |
| `/ai-visibility` | an [OpenRouter](https://openrouter.ai) key (`OPENROUTER_API_KEY`); verify model ids in `geo/prompts.json` |
| `/demand` | Google service account (`GSC_CREDENTIALS_FILE`, `GSC_SITE`, optional `GA4_PROPERTY_ID`) + a Clarity MCP |
| `/longtail` | your own site (assumes Astro) + a publishing path |

Secrets go in env vars or a folder **outside** the repo — nothing here reads a hard-coded key.

## Run it automatically

Schedule `/geo full` (weekly is plenty) with Claude Code's `/schedule` or any cron. Each run audits, pulls demand, measures citations, and produces a ranked backlog + a citation delta — so you write for the next gaps and watch them close. Keep a human gate on publishing, or auto-draft and review.

## Notes

- Skills are written in **German** (the original stack is DACH-focused) — adapt the language. The scanner/scripts and this README are English.
- `geo/runs/`, `data/`, `logs/` are runtime output (gitignored).

## License

MIT — see [LICENSE](LICENSE).
