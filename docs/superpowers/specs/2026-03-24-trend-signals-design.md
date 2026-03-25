# Trend Signals — Ingestion and Matching Design

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Global trend ingestion pipeline + per-user matching logic

---

## Overview

The trend system has two independent pipelines that share `trend_ingestion_jobs` as the coordination layer.

1. **Global ingestion pipeline** — fetches RSS feeds from fashion publications, extracts structured trend signals via LLM, aggregates and scores them globally.
2. **User matching pipeline** — on-demand, compares a user's wardrobe against active trend signals using pure attribute comparison (no LLM), writes results to `user_trend_matches`.

---

## Constraints

- Never store full article bodies (IP/copyright). Store only: source URL, title, author, publish date, raw excerpt (≤ 500 chars).
- LLM is used only at extraction time, once per source article, deduplicated by source URL.
- User matching uses no LLM — pure structured attribute comparison to minimize cost.
- User-facing output is normalized facts, tags, scores — not article substitutes.
- Respect robots.txt and source terms. Prefer RSS and sitemap endpoints over scraping.

---

## Architecture

**Option chosen:** Next.js API routes as job runners (Option A).

Pipeline stages run as internal POST routes. Each stage reads queued jobs from `trend_ingestion_jobs`, processes them, and updates job status. A Vercel cron (added later) will call the ingest route on a schedule. For MVP, ingestion is triggered manually or via admin action.

---

## Pipeline 1: Global Ingestion

### Stages

```
POST /api/trends/ingest       POST /api/trends/extract
        ↓                              ↓
 [source_ingestion]           [signal_extraction]
  fetch RSS feed               pick up queued jobs
  parse entries                send excerpt to Claude
  dedup by source_url          structured output
  write trend_sources          write trend_signals
  queue extract jobs           write trend_colours (colour signals)
                               link trend_signal_sources
                               update source_count + scores
```

### Stage 1 — Source ingestion (`source_ingestion` job)

- Fetches the configured RSS feed URL via the adapter.
- Parses feed entries: title, URL, author/byline, publish date, description/excerpt.
- Deduplicates by `source_url`. A unique constraint on `trend_sources.source_url` is required (add via migration before first ingestion run). In the absence of the constraint, deduplication is a serialized check-then-insert — query for existing row first, skip insert if found.
- Writes new rows to `trend_sources`: title, source_url, author, publish_date, raw_text_excerpt (≤ 500 chars), source_type, source_name, authority_score (set by adapter).
- Queues one `signal_extraction` job per new source entry via `trend_ingestion_jobs`.
- Records the source ingestion job outcome in `trend_ingestion_jobs`.

### Stage 2 — Signal extraction (`signal_extraction` job)

- Picks up queued `signal_extraction` jobs one at a time.
- Sends `{ title, excerpt, author, publish_date, source_name }` to Claude using structured output (tool use).
- Prompt instructs Claude to:
  - Extract only concrete trend claims, not general themes. "Editors loved the oversized blazer" → signal. "It was a good season" → skip.
  - Constrain output values to the known enum sets defined below (category, subcategory, fit, colour family, pattern, material). Pass these enum sets in the prompt.
- Claude returns an array of signals per article:

```ts
Array<{
  trend_type: TrendType        // colour | garment | silhouette | material | pattern | styling | occasion | aesthetic | era_influence
  label: string                // human-readable label
  normalized_attributes: Record<string, unknown>  // typed per trend_type, constrained to known enums
  season: string | null
  region: string | null
  confidence: number           // 0–1, model's own estimate
}>
```

**Signal deduplication / upsert:**
Labels from LLM output are inherently inconsistent ("Wide-leg trousers" vs "Wide leg trousers"). Before upsert, canonicalize the label: lowercase, trim whitespace, collapse multiple spaces, replace hyphens with spaces. Use `(trend_type, canonical_label)` as the logical dedup key. If a matching signal exists, increment `source_count`, update `last_seen_at`, and recalculate `authority_score` as a weighted average. If no match, insert a new `trend_signals` row.

**Colour signals — write to `trend_colours`:**
For signals with `trend_type = 'colour'`, after writing the `trend_signals` row, also write a `trend_colours` row. The `trend_colours` table is the authoritative store for colour data on colour-type trend signals. Extraction must produce:
- `canonical_hex` — derived from the colour label/family using the app's colour system
- `canonical_rgb`, `canonical_lab`, `canonical_lch` — computed from hex
- `family`, `undertone`, `saturation_band`, `lightness_band` — from `normalized_attributes`
- `importance_score` — from the signal's `confidence` × adapter `authority_score`
- `source_name`, `source_url`, `source_label`, `observed_at` — from the source record

For non-colour trend signals, `trend_colours` is not written. The `normalized_attributes_json` on `trend_signals` is sufficient.

- Links via `trend_signal_sources` with `evidence_json` containing the source excerpt used.
- Marks job `succeeded` or `failed`. The `cancelled` status exists in the schema but is out of scope for MVP — no code path sets it.

### Source adapter interface

Each publication implements:

```ts
interface TrendSourceAdapter {
  sourceName: string
  sourceType: TrendSourceType
  authorityScore: number         // base authority score for this publication (0–1)
  feedUrl: string
  parseEntry(entry: RSSEntry): TrendSourceInsert
}
```

MVP ships with:
- `adapters/rss.ts` — generic RSS parser (xml2js or similar)
- `adapters/vogue.ts` — Vogue-specific field mapping; editor bylines receive a higher base authority score than contributor bylines

Additional publications slot in by implementing the adapter interface.

---

## Normalized Attributes Schema (per trend_type)

These shapes are the contract between extraction and matching. Claude outputs them constrained to known enum values; the matcher reads them.

### Enum constraints passed to Claude at extraction time

These must match the app's canonical values exactly to enable reliable matching:

**colour.family** — must be one of the `WardrobeColourFamily` values from `lib/domain/wardrobe/colours.ts` (e.g. `black`, `white`, `beige`, `navy`, `brown`, `grey`, `red`, `pink`, `orange`, `yellow`, `green`, `blue`, `purple`, `cream`). Pass the full list in the prompt.

**garment.category / garment.subcategory** — must match values from the `garments.category` and `garments.subcategory` columns. Pass the known set in the prompt.

**garment.fit / silhouette.fit** — must match the `garments.fit` column values. The value space is the same for both `trend_type`s.

**garment.material / material.material** — must match the `garments.material` column values.

**garment.pattern / pattern.pattern** — must match the `garments.pattern` column values.

### Attribute shapes per trend_type

| trend_type | key attributes |
|---|---|
| `colour` | `family` (WardrobeColourFamily), `undertone` (`warm`\|`cool`\|`neutral`), `lightness_band` (`low`\|`medium`\|`high`) |
| `garment` | `category` (garments enum), `subcategory` (garments enum), `fit` (garments enum), `material` (garments enum) |
| `silhouette` | `fit` (garments enum), `structure` (`relaxed`\|`structured`\|`semi-structured`), `length` (`mini`\|`midi`\|`maxi`\|`cropped`\|`standard`) |
| `material` | `material` (garments enum), `texture` (free text, short) |
| `pattern` | `pattern` (garments enum), `scale` (`small`\|`medium`\|`large`) |
| `styling` | `principle` (free text), `required_categories` (array of garment categories), `colour_constraint` (`monochrome`\|`tonal`\|`complementary`\|`neutral`\|null) |
| `aesthetic` | `formality` (garments formality_level enum), `descriptors` (string array, ≤ 5 items) |
| `occasion` | `dress_code` (garments formality_level enum), `key_pieces` (array of garment categories) |
| `era_influence` | `era` (free text, e.g. `"1990s"`), `key_characteristics` (string array, ≤ 5 items) |

---

## Pipeline 2: User Matching

### Trigger

On-demand. Fires when a user visits `/trends`. The server action `getUserTrendMatches()` in `app/trends/actions.ts` calls `service.ts` directly — no intermediate API route. This matches the pattern used by the wardrobe service.

**Staleness gate:** Query `max(created_at)` across all `user_trend_matches` rows for the user. If the result is within the last 24 hours, return cached matches. Otherwise run the matching service and upsert fresh results before returning.

Edge case acknowledged (not fixed in MVP): if new `trend_signals` are added after the user's last match run but within the 24-hour window, the cached matches will not include them. This is acceptable for MVP; a future improvement is to also check `max(trend_signals.created_at)` and invalidate if newer than the match cache.

### Matching service

Pure functions in `matching.ts`. No DB calls. The service layer in `service.ts` handles reads and writes.

```
Input:  TrendSignal[]     (all active signals, joined with trend_colours for colour signals)
        GarmentListItem[] (user's active wardrobe, with primary_colour_family, primary_colour_hex)
Output: UserTrendMatch[]
```

For each trend signal, the matcher selects the typed handler for that `trend_type`, scores each garment against `normalized_attributes`, determines match type, and emits a match record.

### Match type determination

Match type is determined first by attribute overlap ratio, then score is computed within that bucket.

| match_type | condition | score range |
|---|---|---|
| `exact_match` | attribute_overlap ≥ 0.85 | 0.85–1.0 |
| `adjacent_match` | 0.50 ≤ attribute_overlap < 0.85 | 0.50–0.84 |
| `styling_match` | multi-garment look, no single garment is an exact hit but wardrobe has required components | 0.60–0.80 |
| `missing_piece` | attribute_overlap = 0, no garment matches; signal is high-authority | 0.0–0.40 (opportunity score) |

`styling_match` is assessed separately from single-garment matching: check whether the user's wardrobe contains garments covering all `required_categories` in the signal's `normalized_attributes`.

### Colour matching

For `colour` trend signals, the matcher reads from `trend_colours` (not only `normalized_attributes_json`) to access `canonical_hex` and perceptual colour space data.

**Join path for adjacent colour matching via `colour_relationships`:**
1. From the trend signal's `trend_colours` row, get `family`.
2. Look up the `colours` row where `colours.family = trend_colours.family`.
3. Query `colour_relationships` for rows where `colour_id_a = colours.id` OR `colour_id_b = colours.id` with a compatible relationship type.
4. From the user's garments, get `primary_colour_family` → look up the matching `colours` row.
5. If the garment's colour ID appears in the compatible set from step 3 → `adjacent_match`.

**Match levels:**
- **Exact:** garment's `primary_colour_family` equals trend signal's `family` attribute.
- **Adjacent:** garment's colour is compatible via `colour_relationships` (step 3–5 above).
- **Missing piece:** no garment matches or is adjacent to the trend colour family.

For `garment` trend signals that carry a colour attribute, the matcher checks `category/subcategory` and `colour` independently, allowing the UI to surface: *"You have the silhouette, but you're missing the colour story."*

### Scoring formula

```
score = attribute_overlap_ratio
      * signal.confidence_score
      * signal.authority_score
      * recency_weight(signal.last_seen_at)
```

`recency_weight` decays linearly from 1.0 (seen today) to 0.5 (90+ days ago). Score is clamped to the declared range for the determined `match_type`.

### reasoning_json shape

```json
{
  "signal_label": "Wide-leg trousers",
  "match_reason": "You own navy wool wide-leg trousers",
  "matched_garment_ids": ["uuid"],
  "attributes_matched": ["category", "subcategory"],
  "attributes_adjacent": ["fit"]
}
```

---

## Service Layer (`service.ts`) — Key Functions

```ts
// Load all active trend signals. Joins trend_colours for colour-type signals.
// Filters: no region filter for MVP (global signals only).
getTrendSignals(): Promise<TrendSignalWithColour[]>

// On-demand match flow. Applies staleness gate.
// Reads user's garments (via wardrobe service), runs matching.ts,
// upserts results via ON CONFLICT (user_id, trend_signal_id, match_type) DO UPDATE.
getUserTrendMatches(userId: string): Promise<UserTrendMatch[]>

// Write match results. Upserts on unique key (user_id, trend_signal_id, match_type).
// Replaces score, reasoning_json, and created_at on conflict.
upsertUserTrendMatches(matches: UserTrendMatchInsert[]): Promise<void>
```

---

## File Structure

```
lib/domain/trends/
  index.ts              existing — extend with full schemas + types for all trend tables
  service.ts            getTrendSignals, getUserTrendMatches, upsertUserTrendMatches
  ingestion.ts          RSS fetch, dedup, job queueing
  extraction.ts         LLM call, structured output parsing, signal + trend_colours writes
  matching.ts           pure matching functions, scoring, reasoning (no DB)
  adapters/
    rss.ts              generic RSS parser
    vogue.ts            Vogue field mapping + authority score

app/api/trends/
  ingest/route.ts       POST: trigger source ingestion job
  extract/route.ts      POST: process queued signal extraction jobs

app/trends/
  page.tsx              user-facing trends + matches UI
  actions.ts            server actions: getUserTrendMatches()
```

Note: no `app/api/trends/match/route.ts` — user matching is invoked directly from the server action into `service.ts`, consistent with the wardrobe service pattern.

---

## Required Migration

Before first ingestion run, add a unique constraint:

```sql
alter table public.trend_sources
  add constraint trend_sources_source_url_unique unique (source_url);
```

---

## Job State Flow

All stages write to `trend_ingestion_jobs`:

```
queued → running → succeeded
                 → failed     (retryable — re-queue with backoff)
```

The `cancelled` status exists in the schema but is out of scope for MVP. No code path sets it.

The ingest route creates jobs with status `queued`. The extract route sets `running` before processing and `succeeded`/`failed` after. Failed jobs log error detail in `metadata_json.error`. A future cron can pick up and retry failed jobs.

---

## What is not in scope (MVP)

- Supabase Edge Functions for any pipeline stage
- Scheduled Vercel cron (wired in after MVP — the route handlers are already cron-compatible)
- `cancelled` job status
- New-signal cache invalidation within the 24-hour staleness window
- Pantone or licensed colour swatch libraries
- Storing full article bodies
- Social feed or influencer signal sources
- Autonomous shopping recommendations from trend matches
