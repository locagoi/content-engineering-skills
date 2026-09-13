# What belongs in this repo

This is a **public clone-and-adapt template**. It is not a mirror of anyone's working
content stack, and that distinction is the whole point of this file.

## The rule

Everything here must be true for **any** org that clones it. Concretely:

| Belongs | Does not belong |
|---|---|
| The mechanism — how a step works, and why | The values that step runs on |
| `YOUR_*`, `<your category>`, `example.com` | A real domain, key, id, mailbox, or path |
| An example config with placeholder values | The filled-in config |
| "Name your topic clusters here" | A list of actual topic clusters |
| "Include competitor brands if you want their comparison queries" | The actual competitor list |

The last two rows are the ones people get wrong. A keyword seed list or a topic scope
looks harmless, but it **is** a content strategy and a competitor watchlist. Those go in
`longtail.config.json`, which is gitignored. The committed file is
`longtail.config.example.json`, with placeholders only.

## The guard

`npm test` runs the unit tests **and** `scripts/check-generic.mjs`, which fails on:

- a real email address (anything not `example.com` / `example.org`)
- a credential-shaped string (`sk-…`, `ghp_…`, `sbp_…`, `xox…`, JWTs, …)
- an absolute home path (`/home/…`, `/Users/…`, `C:\Users\…`)
- a bare UUID — database, workspace and document ids identify a live system
- a hardcoded non-placeholder domain

CI runs it twice: over the working tree and over **every commit in history**. A public
repo exposes its history, so a clean `HEAD` proves nothing on its own.

The guard scans the **working tree** by default, not the committed state — a check that
only reads what is already committed reports "clean" exactly when you most need it to
fail.

## What the guard deliberately does not do

It carries **no list of company, customer or person names**. A denylist of the names you
are protecting would publish them in the act of protecting them — it is a public file.

Name-level checks belong in whatever private repo a contribution is ported from, and they
run **before** the push, not after. If you maintain such a repo, keep the name list there.

## Porting, not copying

If you bring something over from a private stack: read it, rewrite the org-specific parts
as placeholders or config, then run `npm test`. `cp` is not a port — it is how the values
in the right-hand column above end up here.
