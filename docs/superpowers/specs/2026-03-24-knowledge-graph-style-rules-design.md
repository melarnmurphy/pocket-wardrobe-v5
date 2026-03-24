---
title: Knowledge Graph — Style Rules Expansion
date: 2026-03-24
status: approved
---

# Knowledge Graph — Style Rules Expansion

## Overview

Expand the fashion knowledge graph by adding new rule categories (seasonality, formality, layering, silhouette, materials), refactoring the monolithic `fashion-knowledge.ts` into focused per-category modules, adding a `constraint_type` field to the `style_rules` schema, and seeding the complete rule set via a new migration.

## Context

The existing system has:
- `style_rules` table: flat subject/predicate/object triples with `weight`, `rule_scope` (global/user), and `active`
- `lib/domain/style-rules/fashion-knowledge.ts`: ~400-line file containing colour families, synonyms, and `buildSeedStyleRules()` which produces ~50 rules covering colour pairings, basic weather fit, a handful of occasion rules, one layering rule, one silhouette rule
- `supabase/migrations/001_initial.sql`: only seeds 5 hard-coded rows — the full output of `buildSeedStyleRules()` is never actually inserted
- No mechanism to distinguish hard constraints (must wear a suit at black-tie regardless of temperature) from soft preferences (linen is comfortable in warm weather)

## Problem

1. `fashion-knowledge.ts` is a god file that will become unmaintainable as rule categories grow
2. Seasonality, formality, expanded layering, expanded silhouette, and material/texture rules do not exist
3. Formality and weather rules interact: formality acts as a hard constraint that weather/comfort rules cannot override (a suit is required at black-tie whether it is -20°C or +40°C)
4. The migration seed gap means the DB has only 5 global rules — the knowledge graph is effectively empty in practice

## Design

### Schema change — `constraint_type`

Add a column to `style_rules`:

```sql
constraint_type text not null default 'soft'
  check (constraint_type in ('hard', 'soft'))
```

**`hard`** — the rule is a non-negotiable filter. The outfit evaluator must honour it regardless of other scores. Examples: suit `required_for` black-tie, jeans `avoid_with` black-tie, open-toe shoes `avoid_with` formal.

**`soft`** — the rule is a scored preference. The outfit evaluator uses it for ranking. Examples: linen `works_in_weather` warm_sun, wide-leg trousers `pairs_with` fitted top, knitwear `layerable_with` coat.

The formality/weather interaction is resolved at the evaluator level: `hard` rules act as hard filters applied first; `soft` rules score the remaining valid set. The linen-shirt-in-a-warm-office scenario is handled at runtime by composing soft rules (linen `works_in_weather` warm_sun + jacket `layerable_with` shirt) — no special rule type is needed for context-dependent layering.

### Module structure

`fashion-knowledge.ts` is refactored into focused modules:

```
lib/domain/style-rules/knowledge/
  colours.ts       — colour families, synonyms, inferColourFamilyFromText, complementary/analogous/triadic rules
  weather.ts       — weather profiles + weather_fit rules
  occasions.ts     — occasion profiles + occasion_fit rules
  seasonality.ts   — NEW: seasonality rules (works_in_season / avoid_in_season)
  formality.ts     — NEW: formality/dress-code rules (required_for / avoid_with)
  layering.ts      — NEW: expanded layering rules (~12 rules)
  silhouette.ts    — NEW: expanded silhouette balancing rules (~8 rules)
  materials.ts     — NEW: material/texture rules (~12 rules)
  index.ts         — aggregates all into buildSeedStyleRules()
```

`lib/domain/style-rules/fashion-knowledge.ts` becomes a thin re-export shim pointing to `./knowledge/index.ts` for backwards compatibility.

### New rule categories

#### Seasonality (~16 rules, soft)
Predicate: `works_in_season` / `avoid_in_season`
Subject types: `category`, `material`
Object type: `season` (spring | summer | autumn | winter)

Examples:
- linen trousers `works_in_season` summer
- heavy wool coat `works_in_season` autumn, winter
- trench coat `works_in_season` spring, autumn
- sandals `works_in_season` spring, summer
- knitwear `works_in_season` autumn, winter
- t-shirt `works_in_season` spring, summer
- puffer jacket `works_in_season` winter
- cotton shirt `works_in_season` spring, summer, autumn

#### Formality (~14 rules, hard)
Predicate: `required_for`, `appropriate_for`, `avoid_with`
Subject types: `category`, `garment_combo`
Object type: `dress_code` (casual | smart-casual | business-casual | formal | black-tie)

Examples (hard):
- suit `required_for` black-tie, formal
- jeans `avoid_with` black-tie, formal
- open-toe shoes `avoid_with` formal
- trainers `avoid_with` business-casual, formal, black-tie

Examples (soft, via `appropriate_for`):
- loafers `appropriate_for` smart-casual, business-casual
- dress shirt `appropriate_for` business-casual, formal
- chinos `appropriate_for` smart-casual, business-casual
- polo shirt `appropriate_for` smart-casual, casual
- evening dress `appropriate_for` formal, black-tie

Formality rules are marked `constraint_type = 'hard'` where the predicate is `required_for` or `avoid_with`; `soft` where the predicate is `appropriate_for`.

#### Layering expanded (~12 rules, soft)
Predicate: `layerable_with`
Subject/object types: `category`

Examples:
- shirt `layerable_with` blazer
- t-shirt `layerable_with` cardigan
- turtleneck `layerable_with` coat
- shirt `layerable_with` waistcoat
- base-layer `layerable_with` puffer
- tank `layerable_with` shirt (open/unbuttoned)
- dress `layerable_with` denim jacket
- bodysuit `layerable_with` trousers

#### Silhouette expanded (~8 rules, soft)
Predicate: `pairs_with`
Subject/object types: `silhouette` or `category`

Examples:
- slim-fit trousers `pairs_with` oversized top
- midi skirt `pairs_with` fitted top
- cropped jacket `pairs_with` high-waist bottom
- straight-leg trousers `pairs_with` tucked shirt
- wide-leg trousers `pairs_with` fitted top (existing rule, preserved)
- maxi skirt `pairs_with` fitted top
- fitted dress `pairs_with` structured outerwear
- relaxed trousers `pairs_with` structured blazer

#### Materials (~12 rules, soft)
Predicate: `works_in_weather`, `texture_contrast_with`, `avoid_layering_with`
Subject/object types: `material`, `category`

Examples:
- linen `works_in_weather` warm_sun
- wool `works_in_weather` cold_rain, cool_breeze
- cotton `works_in_weather` mild_clear, warm_sun
- leather `avoid_layering_with` leather (same-material tone clash)
- denim `texture_contrast_with` silk (productive texture contrast)
- cashmere `works_in_weather` cool_breeze, cold_rain
- silk `avoid_layering_with` silk (low-grip, static)
- nylon / technical fabric `works_in_weather` cold_rain

### Migration — `004_seed_style_rules.sql`

1. Add `constraint_type` column to `style_rules` (default `'soft'`)
2. Add unique constraint on `(rule_type, subject_type, subject_value, predicate, object_type, object_value, rule_scope)` to make seeding idempotent
3. Delete the 5 existing hard-coded global seed rows from migration 001 (safe — no user data)
4. Insert the complete rule set (~112 rules) using `INSERT ... ON CONFLICT DO NOTHING`

### `styleRuleSchema` update

Add `constraint_type` to the Zod schema in `lib/domain/style-rules/index.ts`:

```ts
constraint_type: z.enum(["hard", "soft"]).default("soft")
```

The service layer (`service.ts`) and UI (`app/style-rules/page.tsx`) require no changes — `constraint_type` is included in the select projection and displayed where relevant.

## Rule counts

| Category | New rules | constraint_type |
|---|---|---|
| Colour (complementary, analogous, triadic) | ~50 | soft |
| Weather fit | ~8 | soft |
| Occasion fit | ~7 | soft |
| Seasonality | ~16 | soft |
| Formality (hard) | ~8 | hard |
| Formality (soft) | ~6 | soft |
| Layering | ~12 | soft |
| Silhouette | ~8 | soft |
| Materials | ~12 | soft |
| **Total** | **~127** | |

## Files changed

| File | Action |
|---|---|
| `lib/domain/style-rules/knowledge/colours.ts` | Create (moved from fashion-knowledge.ts) |
| `lib/domain/style-rules/knowledge/weather.ts` | Create (moved) |
| `lib/domain/style-rules/knowledge/occasions.ts` | Create (moved) |
| `lib/domain/style-rules/knowledge/seasonality.ts` | Create (new) |
| `lib/domain/style-rules/knowledge/formality.ts` | Create (new) |
| `lib/domain/style-rules/knowledge/layering.ts` | Create (new) |
| `lib/domain/style-rules/knowledge/silhouette.ts` | Create (new) |
| `lib/domain/style-rules/knowledge/materials.ts` | Create (new) |
| `lib/domain/style-rules/knowledge/index.ts` | Create (aggregator) |
| `lib/domain/style-rules/fashion-knowledge.ts` | Edit (thin re-export shim) |
| `lib/domain/style-rules/index.ts` | Edit (add constraint_type to schema) |
| `supabase/migrations/004_seed_style_rules.sql` | Create (column + unique constraint + full seed) |

## Out of scope

- Rule evaluator / outfit engine integration (Phase 3 per agents.md)
- UI changes to display constraint_type prominently
- User-facing rule creation form changes (constraint_type defaults to soft for user rules)
