# Hybrid Trend Scoring Implementation Plan

**Date:** 2026-03-26
**Goal:** Extend the current trend pipeline so Pocket Wardrobe can normalize editorial language into broad trend categories, confirm trend status with measurable evidence, and render a 30-day trend view.

**Spec:** [2026-03-26-hybrid-trend-scoring-design.md](/Users/melarnmurphy/play-projects/fashionapp5/docs/superpowers/specs/2026-03-26-hybrid-trend-scoring-design.md)

---

## Current State

Already implemented:

- `trend_sources` + `trend_signal_sources` provenance
- `trend_signals` extraction and rendering
- `trend_colours`
- source links on `/trends`
- semantic signal matching for wardrobe relevance via embeddings

Current gaps:

- broad taxonomy fields are not first-class
- example entities are not modeled separately
- source-derived editorial phrases can still become trend labels too directly
- no daily metrics layer for 30-day visualization
- no explicit `rising / flat / cooling` state
- no sparkline-ready data on the trends page

---

## Implementation Order

### Phase 1: Taxonomy foundation

#### 1. Extend `trend_signals`

Add migration to support broad user-facing trend semantics.

Suggested columns:

- `canonical_label text`
- `vertical text`
- `family text`
- `subfamily text`
- `micro_signal text`
- `trend_status text`
- `trend_confidence numeric(5,2)`
- `score_30d_delta numeric(8,4)`

Files:

- `schema.sql`
- `supabase/migrations/<new_migration>.sql`
- `types/database.ts` after regeneration

#### 2. Add `trend_entities`

Concrete example records linked to a broader trend.

Suggested columns:

- `id uuid`
- `trend_signal_id uuid`
- `entity_type text`
- `label text`
- `normalized_label text`
- `brand text`
- `source_count integer`
- `first_seen_at timestamptz`
- `last_seen_at timestamptz`
- `metadata_json jsonb`
- `created_at timestamptz`

Indexes:

- `(trend_signal_id)`
- `(normalized_label)`

Files:

- `schema.sql`
- `supabase/migrations/<new_migration>.sql`
- `lib/domain/trends/index.ts`

#### 3. Add `trend_signal_metrics`

Daily trend metrics table for 30-day rendering and scoring.

Suggested columns:

- `id uuid`
- `trend_signal_id uuid`
- `metric_date date`
- `search_interest numeric(8,4)`
- `search_velocity numeric(8,4)`
- `editorial_mentions integer`
- `editorial_source_count integer`
- `commerce_signal numeric(8,4)`
- `retailer_count integer`
- `resale_signal numeric(8,4)`
- `runway_signal numeric(8,4)`
- `entity_count integer`
- `composite_score numeric(8,4)`
- `confidence numeric(8,4)`
- `status text`
- `created_at timestamptz`

Indexes:

- unique `(trend_signal_id, metric_date)`
- `(trend_signal_id, metric_date desc)`

Files:

- `schema.sql`
- `supabase/migrations/<new_migration>.sql`
- `lib/domain/trends/index.ts`

---

### Phase 2: Taxonomy mapping pipeline

#### 4. Add canonical taxonomy helpers

Create a dedicated taxonomy module to avoid hardcoding category logic into the service layer.

Suggested file:

- `lib/domain/trends/taxonomy.ts`

Responsibilities:

- canonical labels
- aliases
- normalized footwear/apparel categories
- helper functions for broad category mapping
- trend-family seed examples

#### 5. Add mention extraction model

Create a distinct mention type separate from final trend signals.

Suggested file:

- `lib/domain/trends/mentions.ts`

Responsibilities:

- parse extracted phrases from source context
- carry sentence context
- carry brand/entity references
- carry season or runway cues

This can initially be in-memory and not persisted if the pipeline is still maturing.

#### 6. Add embedding-assisted candidate retrieval

Use the existing embedding direction in the repo to create a taxonomy retrieval path.

Suggested files:

- `lib/domain/trends/retrieval.ts`
- `lib/domain/trends/index.ts`

Responsibilities:

- build taxonomy embedding text
- embed candidate mentions
- retrieve top `k` broad trend candidates
- return similarity scores

If implemented in Postgres, reuse pgvector with HNSW indexing.

#### 7. Add structured reranker

Suggested file:

- `lib/domain/trends/reranking.ts`

Responsibilities:

- combine similarity with feature overlap
- score candidate mappings
- expose a debug-friendly breakdown

Suggested features:

- cosine similarity
- keyword overlap
- brand/entity overlap
- colour/material overlap
- runway/source context
- season compatibility

The reranker should return:

- `mapped_signal`
- `score`
- `feature_breakdown`
- `confidence_bucket`

---

### Phase 3: Statistical scoring

#### 8. Add metric collectors

Create a metrics module that accepts external or manually curated measurements.

Suggested file:

- `lib/domain/trends/metrics.ts`

Responsibilities:

- normalize search signals
- normalize editorial counts
- normalize commerce/resale values
- write `trend_signal_metrics`

For MVP, this can support:

- editorial counts from internal source tables
- manually seeded search/commerce signals

Then later plug in external providers.

#### 9. Add composite-score computation

Suggested file:

- `lib/domain/trends/scoring.ts`

Responsibilities:

- compute daily composite score
- compute source diversity bonus
- compute confidence cap
- classify `candidate`, `emerging`, `confirmed`, `dominant`, `cooling`

Recommended initial formula:

```text
composite_score =
  0.30 * search_interest_score +
  0.30 * commerce_score +
  0.20 * editorial_score +
  0.20 * runway_score
```

#### 10. Add 30-day momentum calculations

Same module or adjacent helper:

- EWMA over 7 and 30 days
- 30-day delta
- `rising / flat / cooling`

Store results:

- latest `trend_status`
- `trend_confidence`
- `score_30d_delta`

on `trend_signals` for easy page rendering

---

### Phase 4: Service and UI integration

#### 11. Extend trend service types

Update:

- `lib/domain/trends/index.ts`
- `lib/domain/trends/service.ts`

Add:

- `trend_entities`
- `trend_signal_metrics`
- latest-metric summary
- sparkline-ready 30-day series

#### 12. Update `/trends` route

Update:

- `app/trends/page.tsx`

Render:

- broad canonical label
- status badge
- 30-day sparkline
- confidence
- evidence summary
- example entities
- source links

Important:

- use broad category wording on cards
- keep specific models as examples
- keep source phrases out of the main title

#### 13. Add sparkline component

Suggested file:

- `components/trend-sparkline.tsx`

Responsibilities:

- lightweight 30-day mini chart
- support `rising / flat / cooling` color treatment
- no heavy chart dependency unless already justified

---

## Low-Cost Strategy

### Keep LLM use narrow

Use no LLM for:

- daily score computation
- trend status classification
- source count aggregation
- sparkline generation
- most entity extraction for known brands/models

Use LLM only for:

- unresolved editorial phrases
- low-confidence taxonomy mapping fallback
- optional short summaries

### Prefer scheduled enrichment

Do not block `/trends` page loads on live external lookups.

Instead:

- scheduled or admin-triggered enrichment job writes metrics
- page reads already-computed trend status and 30-day history

---

## Suggested Milestones

### Milestone 1

- add schema for taxonomy fields, entities, and metrics
- update Zod types
- expose broad canonical fields in service responses

### Milestone 2

- add taxonomy helpers
- add mention mapping using embedding retrieval + reranking
- update ingestion flow to write broad categories and entities

### Milestone 3

- add metric ingestion and 30-day scoring
- write latest trend status back to `trend_signals`

### Milestone 4

- add sparkline UI
- update `/trends` cards with evidence + 30-day movement

---

## Validation and Tests

Add tests for:

- taxonomy mapping of editorial phrases to broad signals
- reranker score thresholds
- entity extraction
- 30-day EWMA calculations
- `rising / flat / cooling` classification
- trends page service output shape

Suggested files:

- `lib/domain/trends/__tests__/taxonomy.test.ts`
- `lib/domain/trends/__tests__/retrieval.test.ts`
- `lib/domain/trends/__tests__/reranking.test.ts`
- `lib/domain/trends/__tests__/scoring.test.ts`
- `lib/domain/trends/__tests__/service.test.ts`

---

## Recommended First Build Slice

The smallest useful implementation is:

1. add `trend_entities`
2. add `trend_signal_metrics`
3. store `canonical_label`, `family`, and `subfamily`
4. update `/trends` to show broad labels and example entities
5. store a synthetic 30-day metric series
6. render a sparkline and status badge

That gives the product immediate user-facing improvement before external metrics are fully automated.

---

## Decision Summary

Implement the trend engine as:

- taxonomy-first normalization
- HNSW-assisted candidate retrieval
- feature-based reranking
- EWMA-based 30-day status scoring
- source-linked evidence rendering

This keeps the system:

- faster than LLM-heavy classification
- more precise than raw embeddings alone
- more adaptable than pure keyword rules
- more defensible than editorial article summaries

