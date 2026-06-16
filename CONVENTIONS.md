# Content & Engineering Conventions

> Single source of truth for the content and script skills. The skills reference this file; fill it with **your** house rules. The points below are the defaults the skills assume.

## 1. HTTPS behind a corporate TLS proxy

If your machine runs a TLS-inspecting proxy/antivirus, Node's `fetch` may fail with `unable to verify the first certificate`. Run HTTPS-making scripts with the system CA store:

```bash
NODE_OPTIONS=--use-system-ca node script.mjs
```

Drop this if you don't have an intercepting proxy.

## 2. Internal links: trailing slash

If your site builds with `trailingSlash: 'always'` (default for some Astro setups), every internal Markdown link needs a trailing slash or it 404s in dev / redirects in prod:

- ✅ `[Text](/section/slug/)`
- ❌ `[Text](/section/slug)`

Adjust to your site's setting.

## 3. SEO meta limits

- **`title`** ≤ ~58 chars, keyword front-loaded (full `<title>` ≤ ~70 chars or it truncates in SERPs). Account for any suffix your template appends.
- **`description`** ≤ ~160 chars, a complete sentence, keyword/intent-rich.

## 4. Keep proprietary architecture out of public content

Public content (articles, posts) describes **what** a system achieves and the outcomes — never the internal build: tool registries, schemas, exact job schedules, infrastructure code. Outcome and proof, not mechanics. Define your own confidentiality line here.

## 5. Naming competitors: stay within the law

Comparative advertising is allowed in most jurisdictions only when it is **factual, verifiable, and non-disparaging** (e.g. §6 UWG in Germany). Name only verifiable providers with a public source, mark your own claims as such, and add a transparency note. Replace this with your jurisdiction's rules.

## 6. Search indexing

- Credentials are read from an env var (e.g. `GSC_CREDENTIALS_FILE`) — never hard-coded.
- Submit URLs with a trailing slash if your site uses `trailingSlash: 'always'`.

## 7. Notion content pipeline

Central DB: data source `YOUR_NOTION_DATA_SOURCE_ID`. Every published piece gets one entry (`Type`, `Channels`, `Status`, `Week`, `Slug`, `Cluster`, `Data source`, `Live URL`, `Published at`). Match the property names to your own Notion schema.

## 8. Data integrity

- Never invent metrics, customers, logos, or IDs. Use only what really exists.
- Anonymise anything not cleared for publication.
