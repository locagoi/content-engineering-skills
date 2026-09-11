---
description: "Turn signals into ideas that survive review: an idea is an ARTEFACT with a nameable shape, not a topic. Four gate questions, four kill criteria, and a hard cap of three candidates per run."
---

# /ideation — from topic to artefact

The step that feeds the pipeline. `/pipeline` decides *when* ideation runs and what happens to
the output; this skill decides *what counts as an idea in the first place*.

`$ARGUMENTS`: optional focus (a cluster, a channel, a customer segment). Empty = open run.

## The problem this exists to solve

A naive ideation step is a quota machine: "produce N article ideas and M post ideas from
whatever signals we have." Such a step usually has a deduplication gate (is it new?) and a
strategy gate (does it serve a goal?) — but **no quality gate**. Nothing asks whether the
idea becomes something a reader keeps.

The symptom is recognisable: a batch of well-researched, provably-true, counterintuitive
pieces that the reviewer rejects as boring, while one piece in the batch gets published
immediately. The difference is almost never the topic. It is the **genre**:

- **Rejected** pieces tend to be *insights*: "everyone believes X, our data says Y."
  True, sourced, surprising — and useless to the reader, who now knows a fact and owns nothing.
- **Accepted** pieces tend to be *artefacts*: a matrix of seven outreach channels with what
  each one legally requires, with citations. A blueprint of six named phases on one page.
  Something you save and use.

A number may live **inside** an artefact. It is never the artefact.

This also matches how buyers actually ask. If you code your own reply threads or support
tickets by question type, the dominant question in most B2B funnels is some form of
**"how does this work"** — well ahead of price and well ahead of proof. Buyers want to be
shown the mechanism, not argued into a position. Explanatory artefacts answer the question
that is really being asked. *(Run that count on your own corpus before quoting it — the
ranking is the point, not any specific number.)*

## The question an idea starts from

Old: *"What signal do we have that we could write about?"*

New: *"What task does someone have in front of them this week that they currently solve
worse — and what thing do I put in their hands for it?"*

The signal **justifies** the artefact. It does not **produce** it. Start with the number and
you land on an insight; start with the task and you land on a tool.

## The gate: four questions, all must be yes

**1. Task.** What concrete job does the reader have? Not the topic — the job.
"Channel choice in outbound" is a topic. "I have to decide which channel I use to contact
200 accounts this week without risking a legal warning" is a job.

**2. Artefact.** What is the thing? The shape must be nameable: a **matrix**, a **flow**,
a **template**, a **decision aid**, a **checklist**, a **calculation**. If you cannot name
the shape, you do not have an idea yet — you have an interest.

**3. Ownership.** What is in it that only you can put there? Your own conversation data, your
own legal review, your own case, your own measurement. Without that it is a summary anyone
could write, and the AI answer engines already have several.

**4. Edge.** Does it contradict what the reader currently believes or does? An artefact
without contradiction is a reference — useful, but nobody passes it on.

## Kill criteria: any single one ends the idea

- **The core sentence is a ratio.** "X vs. Y", "N times more often than M", "our data shows" —
  that is an insight. It may appear *in* the artefact; it is not the artefact.
- **The piece ends in homework.** "Check it in your own numbers", "run the math yourself" —
  the reader leaves with a task instead of a tool.
- **The shape is not nameable.** See gate question 2.
- **It duplicates an artefact you already have.** Deduplicate as `/pipeline` describes, and
  add one rule on top: if you already have a card for the job, it gets **linked and extended**,
  never rebuilt. Two half-answers to the same question cannibalise each other in search and
  give answer engines nothing coherent to cite.

## Cap and ordering

- **At most three candidates per run**, and only those that pass the gate. **Zero is a valid
  result** and better than three waved through. Whatever per-channel quota `/pipeline` carries
  is a **ceiling for the approval gate**, never a target for ideation.
- **Text before graphics.** Render nothing until the text is approved. Rendering assets for
  pieces that are then deleted is pure waste, and it makes the batch *feel* finished, which
  quietly raises the bar for rejecting it.
- **No stockpile scheduling.** Book at most two slots ahead. A reviewer who likes a piece will
  want it out now; a calendar filled three weeks deep forces them to work against their own
  plan instead of with it.

## What a candidate card carries

So the reviewer can decide without a follow-up question, every card carries four lines:

```
Task:      <the reader's job, one sentence>
Artefact:  <the shape: matrix | flow | template | decision aid | checklist | calculation>
Ownership: <what only we can put in, with its source>
Edge:      <what the reader currently believes or does differently>
```

A card missing any of the four is not ready to be shown.

## Where the jobs come from

Research supplies the evidence. The **jobs** come from three sources, in this order:

1. **The questions buyers actually ask.** Code your reply threads, support tickets, or sales-call
   transcripts by question type. Every frequent question is a job, and the answer to it is an
   artefact. A pile of "how does this work" means: explanatory flows.
2. **What goes wrong in a conversation.** The objection log — but read as *"which tool would
   have prevented this?"*, not as a frequency ranking to write a post about.
3. **What you just solved yourself.** Every real decision in the business — a legal review, a
   rebuild, a measurement — leaves an artefact behind that saves someone else the work. This is
   where the best cards come from, because ownership (gate 3) is automatic.

## The test of whether this is working

Not the number of ideas, and not the number of published pieces. The test is:

**How many cards did the reviewer reject at the approval gate?** As long as they are the first
real filter, the gate is missing from this step. Aim for a rejection rate below a third — and
make every rejection produce a reason that gets written back into this file as a fifth criterion.
That feedback loop is the only reason this document improves.
