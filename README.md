# geo-skills

A small, **self-contained GEO toolkit** for [Claude Code](https://claude.com/claude-code) — Generative Engine Optimization, i.e. getting your site **surfaced and cited by AI answer engines** (ChatGPT, Perplexity, Google AI Overviews, Claude), not just ranked in classic search.

Three slash-commands plus two zero-dependency Node scripts. Clone it, run it, adapt it.

> Built for a real content stack and released as a clone-and-adapt template. Org-specific values are `YOUR_*` placeholders.

## The loop

```
/scan          ← audit a site's AI-friendliness (30 checks → score + fixes)   [no API key]
/ai-visibility ← ask AI engines your buyer questions, measure your citation rate + gaps  [OpenRouter key]
/longtail      ← turn a citation gap / search gap into a data-rich, citable article
```

GEO is a closed loop: **scan → fix → measure citations → write for the gaps → re-measure.** See [GEO-PLAYBOOK.md](GEO-PLAYBOOK.md).

## Quick start (no setup, no key)

The scanner runs standalone:

```bash
git clone https://github.com/locagoi/content-engineering-skills.git
cd content-engineering-skills
node scanner/check.mjs stripe.com
```

```
Score: 87/100  (26/30 checks)   Level: Good
Top fixes (see GEO-PLAYBOOK.md):
  • [Structured data] Exactly one <h1> — found 2
  • [Content clarity] Author/date metadata — …
```

(Behind a TLS-inspecting proxy/antivirus? Prefix with `NODE_OPTIONS=--use-system-ca`.)

## Install the skills in Claude Code

```powershell
# from the repo root
.\setup.ps1     # hardlinks skills/*.md into ~/.claude/commands (no admin on NTFS)
```

Then in Claude Code: `/scan yourdomain.com`, `/ai-visibility yourdomain.com`, `/longtail`.

Set `PROJECTS_DIR` so the skills can find the bundled scripts:
```powershell
[Environment]::SetEnvironmentVariable("PROJECTS_DIR", "$HOME/Projects", "User")  # Windows
```
```bash
export PROJECTS_DIR="$HOME/Projects"   # macOS/Linux
```
(Clone this repo into `$PROJECTS_DIR/content-engineering-skills`.)

## What's in the box

| Path | What |
|---|---|
| `scanner/check.mjs` | 30-check AI-friendliness scanner. **No dependencies, no key.** |
| `geo/citation-check.mjs` | Citation tracker — queries AI engines via OpenRouter, reports your citation rate, gaps, and the **run-over-run change** (which gaps closed/opened after you published). |
| `geo/lib.mjs` | Pure, unit-tested helpers (domain extraction, run-over-run delta). |
| `geo/prompts.example.json` | Copy to `prompts.json`; your buyer questions + engine model ids. |
| `skills/scan.md` · `skills/ai-visibility.md` · `skills/longtail.md` | The Claude Code slash-commands. |
| `GEO-PLAYBOOK.md` | Fix reference: every scanner check → why it matters → how to fix. |
| `STRATEGY.md` · `CONVENTIONS.md` | Templates: your GEO goals and house rules (read by `/longtail`). |

## What you bring

| Need it for | Provide |
|---|---|
| `/ai-visibility` | An [OpenRouter](https://openrouter.ai) API key (`OPENROUTER_API_KEY`) |
| `/longtail` | Your own site (this assumes an Astro site) + Google Search Console access |
| Notifications (optional) | A Slack MCP + channel id |

Secrets go in env vars or a folder **outside** the repo — nothing here reads a hard-coded key.

## Notes

- The skills are written in **German** (the original stack is DACH-focused) — adapt the language.
- `geo/runs/`, `data/`, `logs/` are runtime output (gitignored).

## License

MIT — see [LICENSE](LICENSE).
