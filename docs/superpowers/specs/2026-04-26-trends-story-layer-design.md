# Trends: Story Layer + Tighter Source Scope

**Date:** 2026-04-26  
**Status:** Approved, pending implementation plan

---

## Problem

The current trends feature surfaces atomic signals (single colors, single garments) from Vogue RSS and 4 web-search scanner archetypes (originally Gemini grounding, replaced by Tavily 2026-05-07). The experience lacks:

- Editorial framing that groups related signals into named trend stories (e.g. "Transparent Denim", "Taupe & Persimmon")
- Design house attribution (which house is doing what)
- Fashion show coverage tied to specific shows/seasons
- Emergent "it girl" discovery — who the fashion press is citing as style references right now
- Search momentum headlines (+X% interest) as a confidence signal
- Wardrobe matching at the story level, with a direct path to outfit generation

---

## Goal

Surface trend intelligence as editorial stories — each story groups related signals, attributes them to houses or people, shows search momentum, and connects to the user's specific wardrobe pieces. From there, users can assemble or generate outfits.

---

## Architecture

### New Scanner Archetypes

Three new Gemini grounding scanners added to the existing cron pipeline in `app/api/cron/trend-scanners/route.ts`:

**`design_house`** — 7-day cadence  
Targets: Vogue Runway, WWD, System Magazine, brand editorial pages  
Extracts: collection drops, key looks, materials, silhouettes — all attributed to specific houses  
Output: `TrendSignal` rows with `house_attribution` set

**`fashion_week`** — 1-day cadence during season (Feb/Mar, Sep/Oct), 7-day off-season  
Targets: Show-by-show runway coverage, show notes, key-look recaps  
Extracts: dominant silhouettes, garments, materials, styling moments per show  
Output: `TrendSignal` rows with `house_attribution` and `season` set

**`it_girl_discovery`** — 3-day cadence  
Targets: Street-style recaps, "best dressed" round-ups, editorial features on Vogue, Harper's, Who What Wear  
Extracts: Names being cited as style references (fully emergent — no hardcoded list), and what they're wearing  
Output: `TrendSignal` rows with `person_attribution` set; person names also upserted to a `trend_people` table for longitudinal tracking

### Story Generation Job

A scheduled job runs after signal extraction (triggered by the cron pipeline after each scanner batch). It:

1. Loads recently upserted / updated `TrendSignal` rows (last 24h window)
2. Clusters them by semantic similarity (existing embedding index) + shared attributes (type, colour family, material, house)
3. Calls Claude to: name each cluster as an editorial headline, write a one-line framing sentence, and classify the dominant story type
4. Upserts `TrendStory` rows — creating new stories or merging signals into existing ones
5. Computes `momentum_label` from aggregated `trend_signal_metrics` across constituent signals

---

## Data Model

### New: `trend_stories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `headline` | text | Editorial name, e.g. "Transparent Denim" |
| `framing` | text | One-line story sentence |
| `momentum_label` | text | e.g. "+100% search interest" — derived from metrics |
| `dominant_type` | enum | `colour_combo`, `garment_moment`, `aesthetic`, `it_girl_look`, `runway_moment` |
| `attributed_houses` | text[] | Design house names, extracted by scanner |
| `attributed_people` | text[] | Discovered it-girl names |
| `signal_ids` | uuid[] | FK → `trend_signals` |
| `status` | enum | Reuses existing: `candidate`, `emerging`, `confirmed`, `dominant`, `cooling` |
| `confidence_score` | float | Aggregate of constituent signal confidence scores |
| `created_at` | timestamptz | |
| `refreshed_at` | timestamptz | |

### New: `trend_people`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Normalised name |
| `first_seen_at` | timestamptz | |
| `mention_count` | int | Running count across sources |
| `last_seen_at` | timestamptz | |

### `trend_signals` additions

| Column | Type | Notes |
|---|---|---|
| `house_attribution` | text | Design house name, if set by scanner |
| `person_attribution` | text | It-girl name, if set by scanner |

### `user_trend_matches` additions

| Column | Type | Notes |
|---|---|---|
| `story_id` | uuid | FK → `trend_stories`, nullable — match linked at story level |

---

## Signal → Story Flow

```
Gemini grounding scanner (design_house | fashion_week | it_girl_discovery)
  ↓
trend_sources + trend_ingestion_jobs (existing pipeline)
  ↓
extraction job → trend_signals (with house_attribution / person_attribution)
  ↓
story generation job (new)
  ↓ clusters by embedding similarity + shared attributes
  ↓ Claude names + frames each cluster
trend_stories (upsert)
  ↓
computeUserTrendMatches runs against story's signal_ids
  ↓
user_trend_matches (with story_id)
```

---

## Wardrobe Matching

No change to the core matching algorithm. Stories inherit matches from their constituent signals. The match result for a story is:

- **Matching pieces**: all wardrobe items that matched any signal in `signal_ids`, deduped
- **Best match type**: highest match_type across constituent signal matches (exact > adjacent > styling > missing)
- **Score**: max constituent signal match score

From the trends page, "Generate outfit" passes matching piece IDs to the outfit generator pre-seeded, where style rules apply as normal.

---

## UI

Each `TrendStory` renders as an editorial card:

- **Headline** (bold, large) + **momentum label** (e.g. "+100% search interest")
- **Attribution pills**: house names (e.g. "Coperni") + discovered people names
- **Story framing sentence** (one line)
- **Source evidence trail** (existing — links to articles)
- **Matching wardrobe pieces**: thumbnail strip of user's relevant pieces
- **CTA**: "Generate outfit" → outfit generator pre-seeded with matched pieces

Stories are sorted by confidence_score × recency. No change to the 4-tier match type display — it moves to the individual piece level within the card.

---

## Out of Scope

- Social media API integrations (Instagram, TikTok) — Tavily web search is the source of truth for social signal
- User-curated it-girl lists — discovery is fully automatic
- Story editing by users
- Per-story notifications / alerts

---

## Success Criteria

- At least 3 new story archetypes (`runway_moment`, `it_girl_look`, `garment_moment`) surfaced within 48h of scanner activation
- Design house attribution present on ≥60% of fashion_week scanner signals
- It-girl names discovered without manual seeding within first 7-day window
- Wardrobe match rate for stories ≥ existing signal match rate
- "Generate outfit" CTA reaches outfit generator with pre-seeded pieces
