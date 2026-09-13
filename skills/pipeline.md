---
description: "The unattended content loop: a scheduled dispatcher that reads the current state, runs exactly the next due step, and stops at a human gate. Idea → gate 1 → creation → gate 2 → publish, with state held in the repo."
---

# /pipeline — the unattended content loop

Runs content operations as a **dispatcher on a schedule** instead of a person typing commands.
Each run reads the current state, executes **exactly one** due step, and notifies a human only
when a gate is waiting on them.

`$ARGUMENTS`: `auto` (default — decide and run the next due step), `status` (report state, change
nothing), `<step>` (force one step: `reconcile` | `ideation` | `creation` | `publish` | `report`).

> This skill is the shape of the loop, not a product integration. Where it says *tracker*,
> *chat*, or *notify*, wire your own. The one thing that is **not** interchangeable is where the
> state lives — see "State lives in the repo".

## Operating model

Schedule `/pipeline auto` headless, twice a day, with cron or Claude Code's `/schedule`:

```bash
0 7,13 * * *  claude -p "/pipeline auto"
```

```
        ┌──────────── DISPATCHER (scheduled, headless) ────────────┐
        ▼                                                           │
  [content merged outside the loop?] → RECONCILE (sync state)       │
  [no ideas for this period?] ───────→ IDEATION → 🔔 gate 1 waiting │
  [approved ideas without a draft?] ─→ CREATION → 🔔 gate 2 waiting │
  [approved finals?] ────────────────→ PUBLISH  → 🔔 live           │
  [end of period?] ──────────────────→ REPORT + next-period plan    │
  [otherwise] ───────────────────────→ exit quietly                 │
```

**One step per run.** The first matching check runs, then the process ends. Never let a run
sprint through the whole chain — the gates exist precisely to interrupt it, and a run that
"finishes everything" has skipped a human.

**Exit quietly when nothing is due.** A dispatcher that reports "nothing to do" twice a day
trains everyone to ignore its notifications, which is how a real gate alert gets missed.

## The two gates

Everything else is automated. Exactly two decisions belong to a human:

| Gate | Decision | Where it lives |
|---|---|---|
| **Gate 1** | Is this idea worth making? | Wherever the reviewer already is — chat, an issue, a card. One reaction, ✅ or ❌. |
| **Gate 2** | Is this finished piece good enough to ship? | **The pull request**, reviewed on the rendered result, not a Markdown diff. |

Everything the reviewer needs must be *in* the gate. A gate-1 card carries the four lines from
[`/ideation`](ideation.md); a gate-2 PR carries the rendered page or the final image, because a
reviewer approving text they have not seen rendered is not reviewing the thing you will ship.

## State lives in the repo

Keep pipeline state in a **versioned JSON file in this repo** — one record per piece, keyed by
`type + slug`. See [`pipeline/state.example.json`](../pipeline/state.example.json).

This is the one design decision worth defending. A hosted tracker (Notion, Airtable, a board)
is fine as a *view*, and terrible as the *source of truth*:

- It has limits you will hit at the worst moment, and its outage stops your loop.
- Its history is not diffable, so "who changed this and why" is unanswerable in review.
- It puts the gate-2 decision in a second place, next to the pull request that already carries
  the same decision — and then the two disagree.

With state in the repo, a chat outage makes the loop *inconvenient* (commit the decision by
hand) instead of *stopped*. Mirror to a tracker if people want a board; write back to the repo.

## Dispatcher checks, in order

### 0 — Reconcile
**Due when** content reached the live site through a path the loop did not drive — a directly
merged PR, a hand-edit, someone else's commit.

List merges into the main branch since the last reconcile that touched content paths, and for
each piece that has no state record, create one with its real status. Without this the loop
believes it owns the site, then proposes work that already shipped and deduplicates against a
picture of the world that is missing entries.

### 1 — Ideation
**Due when** the current period has no idea records. Run [`/ideation`](ideation.md) and post
the surviving candidates as gate-1 cards. **At most three**, zero allowed.

Post only cards not yet posted — a record that already carries a gate-1 reference is in the
reviewer's queue. Re-posting the same card every run makes it impossible to tell which one is
live. Always support a dry run that prints the cards without sending them.

### 2 — Creation
**Due when** records sit at "approved idea" without a finished piece. Produce the final format —
article, post, page — and open the PR.

**Hard rule: no piece enters gate 2 without its final asset.** If the piece ships with an image,
the image is rendered and embedded before review. Text-only approval followed by "and here is
the graphic" is how a claim gets approved in prose and contradicted in the picture.
*The exception is the refresh class below, which carries no new claim.*

### 3 — Publish
**Due when** a piece has passed gate 2. Merge, deploy, request indexing, schedule the social
slots, and write the live URL back into the state record.

### 4 — Report
**Due at** the end of the period. Output what shipped, what did not, and — separately — **why**:

- **Production deficit**: the automation could not produce it.
- **Gate deficit**: the decision never came.

Booking both as one "missed quota" number hides the cause. A period that produced nothing
because 23 cards sat unreviewed is not a throughput problem, and treating it as one leads to
building more capacity in front of a closed gate.

## Throughput rules for the gates

A stalled pipeline is almost never a production problem. These six rules exist because the
queue in front of a human is the real bottleneck:

1. **The pull request *is* the gate-2 review** for anything that ships as code. Do not also
   require a status flip in a tracker: that is one decision in two places, and it will drift.
   PR approved or merged = gate 2 passed; the loop updates state itself.
2. **Batch the review.** At most **10** items per period, as **one** decision-ready stack,
   oldest first. Each entry: title, the embedded final asset, its claims **with qualifiers**,
   and a **recommendation** (`ship` / `reject` + reason). Anything not in the stack is **not
   re-diagnosed** — re-analysing the same backlog every run burns budget and produces nothing.
3. **Auto-reject on hard evidence only.** The loop may reject by itself, with the evidence
   written into the record, in exactly three cases: **(a) cannibalisation** — a live URL already
   answers the same intent with HTTP 200; **(b) a refuted core claim**; **(c) a duplicate**.
   Anything softer goes into the stack as a recommendation, never as an action.
4. **Expiry.** An item awaiting gate 2 for more than **21 days** is rejected with the reason
   "gate expiry". Report it on its own line — never book it as "handled".
5. **The refresh class skips gate 2.** Title/description/snippet updates, internal linking, and
   fact corrections to live content go **straight into the PR**: no separate review, **no
   graphics requirement** (rule in step 2 covers pieces carrying a *new claim*). Without this
   carve-out, refresh work can never satisfy "no review without a final asset" and silently
   jams the queue forever.
6. **Overflow becomes refresh work.** When the gate-2 queue is deep, spend the rest of the
   period's capacity on refresh and correction instead of new pieces. Output stays constant;
   the reviewer's load does not grow.

**A rejection is memory, never a deletion.** Keep rejected records forever with their reason —
they are what stops the loop proposing the same idea next period. Any rejection can be reversed
later if the facts change; a deleted record cannot.

## Refresh is a type, not an idea

Work **on** an existing page is not a proposal **for** a new one. Give it its own type
(`refresh`), prefix the slug, and point a `target` field at the live route.

This is not bookkeeping pedantry. File a refresh as a normal idea carrying the existing page's
slug and the deduplication check will reject it — **correctly**, because that slug answers live
with HTTP 200. The automation is right and the filing is wrong, and it will happen again on
every single run until the type exists.

## status

Print, changing nothing: counts per state, the gate-1 queue, the gate-2 queue with the age of
the oldest item, anything past the 21-day expiry, and which check the next scheduled run would
fire. If a queue is deeper than its rule allows, say so — that is the finding, not the counts.
