---
description: "Analyse GSC-Daten, finde Keyword-Lücken, schreibe /wissen/ Artikel für example.com"
---

# /longtail — Programmatic SEO Artikel Generator (v3)

> **Vor Code + Content: [`CONVENTIONS.md`](../CONVENTIONS.md) beachten** — Norton-TLS (`NODE_OPTIONS=--use-system-ca` vor JEDEM Node-Script, sonst `fetch failed`), Trailing-Slash bei internen Links (`/wissen/slug/`), SEO-Meta-Limits (Titel ≤58 Z / Description ≤160 Z), YOUR_PRODUCT-Architektur vertraulich, Indexing-/SA-Owner-Caveat.

Du bist ein SEO-Content-Generator für example.com. Deine Aufgabe: Basierend auf GSC-Daten, Google Autocomplete und einem Volumen-Proxy-Score neue `/wissen/`-Artikel identifizieren und schreiben.

## Ablauf

### Schritt 1: GSC-Daten abrufen

```bash
cd "$PROJECTS_DIR/your-site" && node -e "
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GSC_CREDENTIALS_FILE,
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
});
async function run() {
  const client = await auth.getClient();
  const sc = google.searchconsole({ version: 'v1', auth: client });
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const res = await sc.searchanalytics.query({
    siteUrl: 'sc-domain:example.com',
    requestBody: {
      startDate, endDate,
      dimensions: ['query'],
      rowLimit: 1000,
    },
  });
  console.log(JSON.stringify(res.data.rows || []));
}
run().catch(e => console.error(e.message));
"
```

### Schritt 2: Google Autocomplete — Neue Keywords entdecken

Expandiere Seed-Keywords über Google Autocomplete. Findet Keywords wo example.com NOCH KEINE Impressions hat.

```bash
cd "$PROJECTS_DIR/your-site" && node -e "
const https = require('https');
function fetchSuggestions(query) {
  return new Promise((resolve, reject) => {
    const url = 'https://suggestqueries.google.com/complete/search?q=' + encodeURIComponent(query) + '&client=firefox&hl=de';
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)[1]); } catch(e) { resolve([]); } });
    }).on('error', reject);
  });
}
async function run() {
  const seeds = [
    'b2b kaltakquise', 'cold email', 'b2b leadgenerierung',
    'b2b vertrieb', 'outbound sales', 'clay crm',
    'instantly email', 'linkedin outreach', 'ki vertrieb',
    'dsgvo kaltakquise', 'sales automation', 'b2b pipeline',
    'heyreach', 'lemlist', 'apollo io',
    'ai lead generation', 'gtm engineering', 'revenue operations'
  ];
  const allSuggestions = new Map();
  for (const seed of seeds) {
    const base = await fetchSuggestions(seed);
    base.forEach(s => allSuggestions.set(s, { seed, source: 'base' }));
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const l of letters) {
      const sug = await fetchSuggestions(seed + ' ' + l);
      sug.forEach(s => { if (!allSuggestions.has(s)) allSuggestions.set(s, { seed, source: 'alpha-' + l }); });
      await new Promise(r => setTimeout(r, 50));
    }
  }
  const result = [];
  for (const [kw, meta] of allSuggestions) {
    result.push({ keyword: kw, seed: meta.seed, source: meta.source });
  }
  console.log(JSON.stringify(result));
}
run().catch(e => console.error(e.message));
"
```

**Hinweis:** Dauert 2-3 Minuten (18 Seeds × 27 Requests). Nutze `timeout: 300000`.

### Schritt 3: Google Trends — Seed-Volumen messen

Messe das **relative Suchvolumen aller Seed-Keywords** mit einem gemeinsamen Anker für Cross-Batch-Normalisierung.

**Methode:** Batches von max 5 Keywords, jeder Batch enthält den Anker "b2b vertrieb" als Position 0. Anker = 100, alle anderen relativ dazu.

```bash
cd "$PROJECTS_DIR/your-site" && node -e "
const googleTrends = require('google-trends-api');
async function run() {
  const anchor = 'b2b vertrieb';
  const seeds = ['b2b kaltakquise','cold email','b2b leadgenerierung','outbound sales',
    'clay crm','instantly email','linkedin outreach','ki vertrieb',
    'dsgvo kaltakquise','sales automation','b2b pipeline',
    'heyreach','lemlist','apollo io','ai lead generation','gtm engineering','revenue operations'];
  const results = {};
  for (let i = 0; i < seeds.length; i += 4) {
    const batch = [anchor, ...seeds.slice(i, i + 4)].slice(0, 5);
    try {
      const r = await googleTrends.interestOverTime({ keyword: batch, geo: 'DE', startTime: new Date(Date.now() - 365*86400000) });
      const data = JSON.parse(r);
      const tl = data.default.timelineData;
      batch.forEach((kw, idx) => {
        const avg = tl.reduce((s,t) => s + t.value[idx], 0) / tl.length;
        const recent = tl.slice(-12);
        const recentAvg = recent.reduce((s,t) => s + t.value[idx], 0) / recent.length;
        if (!results[kw] || kw !== anchor) results[kw] = { avg: Math.round(avg), recent: Math.round(recentAvg) };
      });
    } catch(e) { /* skip failed batch */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  const anchorAvg = results[anchor]?.avg || 1;
  const seedVolumes = {};
  Object.entries(results).forEach(([kw, d]) => {
    seedVolumes[kw] = Math.round(d.avg / anchorAvg * 100);
    const trend = d.recent > d.avg * 1.2 ? 'UP' : d.recent < d.avg * 0.8 ? 'DOWN' : 'STABLE';
    console.log(kw + ' | rel:' + seedVolumes[kw] + ' | ' + trend);
  });
}
run();
"
```

**Ergebnis:** Eine `seedVolumes`-Map (z.B. `{ 'sales automation': 967, 'revenue operations': 800, ... }`). Diese wird in Schritt 5 gebraucht.

### Schritt 4: Bestehende /wissen/ Artikel lesen

```bash
ls "$PROJECTS_DIR/your-site/src/content/wissen/"
```

### Schritt 5: Volumen-Proxy-Scoring + Themen-Gruppierung

**Das Kernstück:** Kombiniere Seed-Volumen × Autocomplete-Position zu einem geschätzten Suchvolumen pro Keyword, dann gruppiere nach Artikel-Themen.

#### 5a. Volumen-Proxy-Formel

```
geschätztes_volumen = seed_trends_volumen × ac_positions_gewicht
```

**AC-Positions-Gewichte** (Google sortiert Autocomplete nach Popularität):
| Position | Gewicht | Begründung |
|----------|---------|------------|
| `base` (Top 10 Suggestions) | 1.0 | Höchstes Volumen |
| `alpha-a` bis `alpha-e` | 0.5–0.3 | Erste Buchstaben = mehr Traffic |
| `alpha-f` bis `alpha-z` | 0.2 | Long-Tail |

**GSC-Keywords:** `geschätztes_volumen = impressions × 10` (Normalisierung auf Trends-Skala)

#### 5b. Themen-Gruppierung

Gruppiere ALLE Keywords (GSC + AC) nach potentiellen Artikeln. Jedes Keyword gehört zu maximal einem Thema. Pro Thema summiere die geschätzten Volumen aller zugehörigen Keywords.

**WICHTIG — Fallen erkennen:**
- **Brand-Searches ignorieren:** Keywords wie "lemlist login", "heyreach api", "apollo io pricing" sind Brand-Traffic → dafür rankt nur die offizielle Site. KEIN Artikel schreiben.
- **Firmennamen-Noise:** "sales automation gmbh", "sales automation labs ug" = Firmen, nicht Themen
- **Job-Keywords filtern:** "... manager", "... salary", "... jobs" = kein Content-Intent

#### 5c. Relevanz-Filter

**NUR Keywords zu diesen Themen:**
- B2B Outbound / Kaltakquise / Cold Email
- Leadgenerierung / Pipeline
- KI/AI im Vertrieb / Sales Automation
- Tools: Clay, Instantly, Lemlist, HeyReach, n8n, HubSpot, Apollo
- LinkedIn Outreach / Authority
- DACH-Compliance / DSGVO
- AI Search Visibility / GEO / LLM Optimierung
- Revenue Operations / GTM Engineering

**Für Autocomplete: Sprach-Filter anwenden:**
- Deutsche Keywords → immer relevant (passen zur Zielgruppe)
- Englische Keywords → NUR wenn expliziter B2B/Sales-Kontext (nicht "cold email for job application")

### Schritt 5b: Prioritäten aus dem GEO-Backlog (empfohlen)

Bevorzugte Eingabe ist der **gemergte Backlog** aus dem `gaps`-Schritt (`/geo` Schritt 4) — er kombiniert Search-Demand (GSC/GA4 via `/demand`) mit AI-Citation-Gaps (`/ai-visibility`):

```bash
LATEST=$(ls "$PROJECTS_DIR/content-engineering-skills/geo/runs/" | grep '^backlog-' | sort | tail -1)
cat "$PROJECTS_DIR/content-engineering-skills/geo/runs/$LATEST"
```

**Nutze den Backlog so:**
- Schreibe die **Top-Items** zuerst — `ai-citation-gap` (AI-Engines zitieren dich nicht) vor `search-demand` (echtes Volumen, schwache Position).
- Pro Item: zeige `why`, und bei Citation-Gaps die **Competitor-Domains**, die stattdessen zitiert werden — schreib besser als die.
- Markiere in der Themen-Tabelle Quelle (`ai-citation-gap` / `search-demand`) + Demand.

Falls kein Backlog existiert: nutze ersatzweise das neueste `summary.json` (Citation-Gaps) bzw. `demand-*.json` direkt, oder überspringe.

### Schritt 6: Top 10 vorschlagen

Präsentiere die Top 10 **Artikel-Themen** (nicht einzelne Keywords!) sortiert nach Gesamt-Proxy-Volumen:

| # | Slug | Est. Volumen | Keywords | Quellen | Trend | AI Visibility | Winkel |

**Legende:**
- `Est. Volumen` = Summe der Proxy-Volumen aller Keywords im Thema
- `Keywords` = Anzahl der zugeordneten Keywords
- `Quellen` = GSC / AC / GT (Google Trends)
- `Trend` = UP / STABLE / DOWN (aus Trends-Daten des Seed-Keywords)
- `AI Visibility` = zitiert / nicht zitiert + Top-Competitor / kein Test (aus dem GEO-Backlog)

**Warte auf Bestätigung des Users bevor du weitermachst.**

### Schritt 7: Artikel schreiben

Für jeden bestätigten Artikel:
- Schreibe eine Markdown-Datei in `src/content/wissen/`
- Schema: title, description, cluster (outbound|tools|ai-vertrieb|dach-compliance|roi-strategie), tags, relatedSlugs, faq, publishedAt
- 3-5 FAQ-Einträge mit konkreten Antworten
- relatedSlugs: Verlinke auf bestehende /wissen/ Artikel
- Content: Substanziell, mit Tabellen, konkreten Zahlen, Vergleichen
- Ton: Professionell, direkt, keine Marketing-Floskeln
- Sprache: Deutsch (außer Keyword ist explizit Englisch)

**GEO-Struktur-Vorgaben:** Strukturiere den Artikel wie die Seiten, die AI-Engines bereits zitieren:
- Vergleichstabelle einbauen, wo ein Vergleich naheliegt
- Konkrete Preis-/Kosten-Informationen, wo relevant
- Daten-Tabellen statt Fließtext für Zahlen
- Ausführlich (2000+ Wörter), wenn das Thema es trägt
- Praxis-Beispiele / Mini-Case-Studies mit echten Zahlen

Das sind die Signale, die in AI-Antworten überproportional zitiert werden (siehe GEO-PLAYBOOK.md).

### Schritt 8: Build, Commit, PR

```bash
cd "$PROJECTS_DIR/your-site"
git checkout dev
npm run build
git add src/content/wissen/
git commit -m "feat: add X new /wissen/ articles (batch N)"
git push origin dev
gh pr create --base main --head dev --title "feat: X neue /wissen/ Artikel" --body "..."
```

### Schritt 9: Google Indexing nach Merge

Nach dem Merge auf main (Render deployt automatisch), neue Artikel an Google melden:

```bash
cd "$PROJECTS_DIR/your-site" && npm run index -- --new
```

## Wichtige Regeln
- **IMMER auf dev Branch arbeiten**, nie auf main
- **Keine Repo-Scans** — du weißt wo alles liegt
- **Keine irrelevanten Keywords** — nur YOUR_BRAND-relevante Themen
- **Brand-Searches sind keine Artikel-Kandidaten** — "lemlist login" rankt nur lemlist.com
- **Volumen-Proxy > Keyword-Anzahl** — 5 Keywords mit hohem Seed-Volumen schlagen 100 Keywords mit Seed-Volumen 0
- **Bestehende Artikel nicht überschreiben**
- **User muss Artikel-Liste bestätigen** bevor geschrieben wird
- **Trends-Daten sind optional** — wenn die API fehlt oder Fehler wirft, trotzdem weitermachen
- **google-trends-api muss installiert sein** — `npm install --save-dev google-trends-api` falls nicht vorhanden
