# Hybrid Trend Scoring and 30-Day Momentum Design

**Date:** 2026-03-26
**Status:** Proposed
**Scope:** Trend normalization, semantic candidate retrieval, statistical confirmation, and 30-day trend visualization

---

## Overview

Pocket Wardrobe should not treat a single editorial article as a final user-facing trend. Editorial coverage is a useful seed, but the app must normalize trend language into broad fashion categories, attach provenance, and then confirm whether something is actually rising using measurable signals.

This design extends the existing trend ingestion pipeline with a hybrid system:

1. **Editorial ingestion** creates candidate mentions and source provenance.
2. **Taxonomy normalization** maps volatile editorial phrasing into stable internal categories.
3. **Semantic retrieval** uses embeddings to find likely taxonomy matches quickly.
4. **Structured reranking** improves precision and keeps decisions explainable.
5. **Statistical scoring** confirms whether a signal is rising, flat, or cooling over the last 30 days.
6. **UI evidence rendering** shows broad trends, supporting examples, source links, and 30-day movement.

This is intentionally not an article summarizer. It is a trend intelligence layer.

---

## Problem Statement

The current system can extract signals from sources and render source links, but it is still too easy for publisher phrasing to leak into product taxonomy.

Example:

- Raw source phrase: `white plimsolls`
- Current risk: user sees `white plimsolls` as if it were the canonical trend
- Desired outcome:
  - `vertical`: `shoes`
  - `family`: `sneakers`
  - `subfamily`: `low-profile white sneakers`
  - `micro_signal`: `white plimsolls`

Similarly:

- `Adidas Samba` is not the final trend label
- `Puma Speedcat Ballet` is not the final trend label
- `Onitsuka Tiger Mexico 66` is not the final trend label

Those are example entities contributing to broader categories like:

- `slim retro sneakers`
- `ballet sneaker hybrids`
- `embellished sneakers`
- `bright fashion sneakers`

The product must be able to say:

- what the broad trend is
- why the trend exists
- which entities exemplify it
- whether it is actually rising over the last 30 days

without copying editorial prose word for word.

---

## Design Goals

1. Keep editorial language flexible without letting it become canonical taxonomy.
2. Minimize LLM spend by preferring deterministic extraction, semantic retrieval, and numeric scoring.
3. Keep speed high enough for scheduled jobs and on-demand trend page loads.
4. Keep precision high enough that broad trend cards remain defensible.
5. Preserve machine-readable provenance and explainability.
6. Support a 30-day trend view that is based on metrics, not vibes.

---

## Non-Goals

- Building a full market-intelligence warehouse in MVP
- Predicting exact purchase volume across all retailers
- Turning Pocket Wardrobe into a publisher-content digest
- Using LLMs as the primary trend classifier for every article

---

## Proposed System

### 1. Taxonomy-first trend model

The app should classify sources into stable categories first, then keep exact editorial language as evidence.

Recommended normalized shape for footwear examples:

```json
{
  "vertical": "shoes",
  "family": "sneakers",
  "subfamily": "slim retro sneakers",
  "micro_signal": "white plimsolls",
  "canonical_label": "Slim Retro Sneakers"
}
```

Other examples:

```json
{
  "vertical": "shoes",
  "family": "sneakers",
  "subfamily": "ballet sneaker hybrids",
  "micro_signal": "fancy sneakers",
  "canonical_label": "Ballet Sneaker Hybrids"
}
```

```json
{
  "vertical": "shoes",
  "family": "sneakers",
  "subfamily": "embellished sneakers",
  "micro_signal": "fancy sneakers",
  "canonical_label": "Embellished Sneakers"
}
```

The editorial phrase remains stored for provenance, but the app surfaces the broad category.

### 2. Three distinct data layers

#### Layer A: Source evidence

Already present:

- `trend_sources`
- `trend_signal_sources`

Purpose:

- preserve title, URL, publisher, date, excerpt
- preserve source links for UI
- preserve the evidence trail for auditing

#### Layer B: Normalized trend signal

Already present:

- `trend_signals`

Needs extension:

- broad taxonomy fields
- canonical label fields
- status fields suitable for UI

#### Layer C: Entities and metrics

New supporting layers:

- `trend_entities`
  - concrete examples such as `Adidas Samba`, `Onitsuka Tiger Mexico 66`, `Puma Speedcat Ballet`
- `trend_signal_metrics`
  - daily metric snapshots for the last 30+ days

These layers let the app show both:

- the broad trend
- the concrete models/examples contributing to it

---

## Algorithm Choice

### Why not rules alone

Fashion editorial language drifts too quickly:

- `white plimsolls`
- `canvas lace-ups`
- `gummy-soled skater sneakers`
- `fancy sneakers`

Pure keyword dictionaries will become brittle and expensive to maintain.

### Why not embeddings alone

Embeddings help with fuzzy language, but on their own they are:

- hard to debug
- hard to calibrate
- weak as a final source of truth
- bad at proving whether something is actually trending

### Chosen approach: hybrid retrieval + reranking + metrics

The best speed/precision tradeoff for this product is:

1. **Approximate nearest-neighbor retrieval** over a curated taxonomy embedding index
2. **Structured reranking** over the top candidates
3. **Threshold-based mapping**
4. **30-day statistical scoring** after mapping

This keeps semantic flexibility while preserving deterministic product behavior.

---

## Candidate Mapping Pipeline

### Stage 1: Candidate mention extraction

From each source, extract:

- raw phrase
- source sentence or short context window
- named entities
- season references
- product/model references
- brand/runway references

This stage should remain mostly deterministic:

- regex
- phrase dictionaries
- simple NER-style extraction where helpful
- source adapters for publication quirks

Use LLM only as fallback for low-confidence cases.

### Stage 2: Vector retrieval

Each candidate mention is embedded and compared against a taxonomy index of:

- canonical trend labels
- aliases
- previously accepted mention phrases
- curated example entities

Recommended retrieval algorithm:

- **HNSW**

Why HNSW:

- fast ANN retrieval
- high recall
- strong production behavior for modest-to-medium taxonomy sizes
- compatible with pgvector and the repo’s existing embedding direction

Output:

- top `k` candidate taxonomy matches
- cosine similarity per candidate

### Stage 3: Structured reranking

Rerank the top retrieved candidates using cheap explicit features:

- embedding similarity
- keyword overlap
- colour attribute overlap
- silhouette/material overlap
- brand/entity overlap
- runway/source-context overlap
- season match
- source-type weight

Recommended reranker:

- weighted linear score in code
- or logistic regression later if labeled data exists

Weighted linear score is the right MVP choice because it is:

- transparent
- cheap
- easy to tune
- easy to log and debug

### Stage 4: Thresholding

Apply confidence buckets:

- `score >= 0.85` → auto-map
- `0.65 <= score < 0.85` → map as low-confidence and retain reviewability
- `score < 0.65` → new candidate / unresolved alias

This lets the system learn new fashion phrasing without trusting it blindly.

---

## 30-Day Trend Confirmation Model

Mapping a phrase to a broad taxonomy bucket is not enough. The app must separately decide whether the trend is currently rising.

### Signal families

Each trend should aggregate evidence from multiple signal families:

1. **Search**
   - Google Trends relative interest
   - related rising queries
   - 30-day search slope

2. **Editorial**
   - distinct publisher count
   - mention velocity
   - source authority weighting

3. **Commerce**
   - retailer assortment count
   - marketplace/resale signal presence
   - item/model count growth

4. **Runway / assortment**
   - repeated brand/runway references
   - recurring seasonal presence

No single family should be sufficient to mark a trend as confirmed.

### Daily metric snapshots

Store one row per signal per date in `trend_signal_metrics`.

Recommended fields:

- `trend_signal_id`
- `metric_date`
- `search_interest`
- `search_velocity`
- `editorial_mentions`
- `editorial_source_count`
- `commerce_signal`
- `retailer_count`
- `resale_signal`
- `runway_signal`
- `entity_count`
- `composite_score`
- `confidence`
- `status`

### Composite score

Recommended baseline formula:

```text
composite_score =
  0.30 * search_interest_score +
  0.30 * commerce_score +
  0.20 * editorial_score +
  0.20 * runway_score
```

Supporting adjustments:

- source diversity bonus
- recency bonus
- confidence cap when only one source family is present

### Momentum model

For the last 30 days, calculate:

- 7-day EWMA
- 30-day EWMA
- 7-day vs prior-23-day delta
- source family coverage

Recommended classification:

- `rising`
  - positive 30-day slope and positive short-term delta
- `flat`
  - low variance and low slope
- `cooling`
  - negative short-term delta and decelerating EWMA

EWMA is preferred over a raw average because it:

- handles noisy daily inputs better
- weights recent movement more strongly
- remains easy to compute and explain

---

## Data Signals by Example

### Example 1: `white plimsolls`

Source phrase should not become the main trend card.

Instead:

- `canonical_label`: `Low-Profile White Sneakers`
- `micro_signal`: `white plimsolls`
- `entities`: maybe `Celine white lace-ups`, similar models

Confirmation signals:

- search growth for white low-profile sneaker terms
- additional editorial references beyond Vogue
- retailer assortment counts for similar items

### Example 2: `Adidas Samba`

Should be an entity example within:

- `Slim Retro Sneakers`

Status depends on:

- sustained search interest
- whether adjacent retro models are also rising
- whether it is still expanding or merely saturated

### Example 3: `Puma Speedcat Ballet`

Should contribute to:

- `Ballet Sneaker Hybrids`

Potential supporting data:

- rising related search terms
- editorial agreement around ballet sneaker hybrids
- commerce signal from live listings or assortment growth

### Example 4: `fancy sneakers`

Publisher phrasing should normalize to:

- `Embellished Sneakers`

Attributes:

- `embroidery`
- `beading`
- `sequins`

Supporting examples:

- `Valentino`
- `Adidas x Wales Bonner`

---

## Recommended Schema Changes

This design should extend the current schema rather than replace it.

### Extend `trend_signals`

Add fields such as:

- `vertical`
- `family`
- `subfamily`
- `micro_signal`
- `canonical_label`
- `trend_status`
- `trend_confidence`
- `score_30d_delta`

Alternatively, keep some of these in `normalized_attributes_json` for MVP, but `canonical_label`, `trend_status`, and `trend_confidence` are worth first-class columns.

### Add `trend_entities`

Purpose:

- store concrete models, brands, or examples linked to broad signals

Suggested fields:

- `id`
- `trend_signal_id`
- `entity_type` (`brand`, `model`, `collaboration`, `runway_reference`, `retailer_example`)
- `label`
- `normalized_label`
- `brand`
- `source_count`
- `first_seen_at`
- `last_seen_at`
- `metadata_json`

### Add `trend_signal_metrics`

Purpose:

- store daily time-series data for 30-day charting and scoring

Suggested fields:

- `id`
- `trend_signal_id`
- `metric_date`
- `search_interest`
- `search_velocity`
- `editorial_mentions`
- `editorial_source_count`
- `commerce_signal`
- `retailer_count`
- `resale_signal`
- `runway_signal`
- `entity_count`
- `composite_score`
- `confidence`
- `status`
- `created_at`

Indexes:

- `(trend_signal_id, metric_date desc)`
- `(metric_date desc)`

---

## UI Changes for `/trends`

Each trend card should render:

- broad trend title
- status badge: `rising`, `flat`, `cooling`
- confidence
- 30-day sparkline
- evidence summary
- concrete examples
- source links

Example:

- `Slim Retro Sneakers`
- `Rising`
- `Confidence: medium`
- `30-day score: +12%`
- `Evidence: search + editorial + commerce`
- `Examples: Adidas Samba, Onitsuka Tiger Mexico 66`
- `Sources: Vogue, corroborating publishers, runway references`

This preserves editorial usefulness without republishing article content.

---

## LLM Cost Strategy

The trend engine should not call an LLM for every trend decision.

### Prefer no-LLM steps

- source fetch and dedup
- mention extraction where patterns work
- entity extraction for known brand/model patterns
- taxonomy retrieval via embeddings
- reranking
- metric aggregation
- status scoring

### Allow small LLM calls only for:

- low-confidence taxonomy mapping fallback
- odd editorial phrasing that fails deterministic extraction
- optional one-sentence UI summaries

### Cost principle

One article can create multiple candidate mentions, but the pipeline should still:

- avoid one LLM call per mention
- avoid one LLM call per displayed card
- avoid running LLM classification where vector retrieval + reranking is enough

---

## Recommended Status Model

Suggested separation:

- `candidate`
  - seeded from one source family
- `emerging`
  - confirmed by at least two families
- `confirmed`
  - strong multi-signal agreement
- `dominant`
  - sustained high composite score
- `cooling`
  - declining recent momentum

Do not show `confirmed` if only one publisher is the evidence base.

---

## Risks and Controls

### Risk: taxonomy explosion

If every phrase becomes a new subfamily, the UI becomes incoherent.

Control:

- broad `canonical_label`
- entity examples as separate records
- unresolved phrases retained as aliases, not new cards

### Risk: embedding fuzziness

Nearest-neighbor retrieval can over-merge adjacent concepts.

Control:

- reranker
- hard thresholds
- attribute-aware features
- low-confidence bucket

### Risk: weak external metrics

Search interest alone can mislead if a trend is news-driven rather than adoption-driven.

Control:

- require at least two signal families
- cap confidence without source diversity

### Risk: IP leakage

Long editorial paraphrases can drift into the UI.

Control:

- show facts, tags, score, sources
- keep editorial wording as internal evidence only

---

## Decision Summary

Pocket Wardrobe should implement trend normalization as:

- **taxonomy-first**
- **embedding-assisted**
- **reranker-controlled**
- **metrics-confirmed**
- **source-linked**

Recommended core algorithms:

- **HNSW** for semantic candidate retrieval
- **weighted linear reranking** for mapping precision
- **EWMA + momentum scoring** for 30-day trend status

This gives the product the right balance of:

- speed
- precision
- explainability
- cost control
- editorial adaptability

