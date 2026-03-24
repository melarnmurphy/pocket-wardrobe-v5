---
title: Knowledge Graph — Style Rules Expansion
date: 2026-03-24
status: approved
---

# Knowledge Graph — Style Rules Expansion

## Overview

Expand the fashion knowledge graph by adding new rule categories (seasonality, formality, layering, silhouette, materials), refactoring the monolithic `fashion-knowledge.ts` into focused per-category modules, adding a `constraint_type` field to the `style_rules` schema, and seeding the complete rule set (~112 rules) via a new migration.

## Context

The existing system has:
- `style_rules` table: flat subject/predicate/object triples with `weight`, `rule_scope` (global/user), and `active`
- `lib/domain/style-rules/fashion-knowledge.ts`: ~400-line file containing colour families, synonyms, and `buildSeedStyleRules()` which produces ~67 rules (32 colour + 8 weather + 7 occasion + 1 layering + 1 silhouette) — none of which are inserted beyond the 5 hard-coded rows in migration 001
- `supabase/migrations/001_initial.sql`: seeds exactly 5 hard-coded global rows (see Migration section for details)
- Migrations 002 and 003 do not touch `style_rules`
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
  formality.ts     — NEW: formality/dress-code rules (required_for / avoid_with / appropriate_for)
  layering.ts      — NEW: expanded layering rules (12 rules total)
  silhouette.ts    — NEW: expanded silhouette balancing rules (8 rules total)
  materials.ts     — NEW: material/texture rules (~12 rules)
  index.ts         — defines SeedStyleRule type, aggregates all into buildSeedStyleRules()
```

`lib/domain/style-rules/knowledge/index.ts` must not import from `lib/domain/style-rules/index.ts`. `SeedStyleRule` is a plain TypeScript type with no Zod dependency. If knowledge modules need Zod-validated types, they import from `zod` directly, not from the parent schema file.

`lib/domain/style-rules/fashion-knowledge.ts` becomes a thin re-export shim pointing to `./knowledge/index.ts`. It must re-export all currently public exports so that no existing consumers break:
- Functions: `buildSeedStyleRules`, `inferColourFamilyFromText`, `normalizeRuleValue`, `normalizeLooseText`
- Constants: `colourFamilies`, `weatherProfiles`, `occasionProfiles`
- Types: `SeedStyleRule`, `ColourFamily`, `WeatherProfile`, `OccasionProfile`

TypeScript compilation will catch any missing re-exports at build time.

### `SeedStyleRule` type

The `SeedStyleRule` type moves to `lib/domain/style-rules/knowledge/index.ts`. It is an insert-only type — `created_at`, `id`, and `active` are intentionally absent; the DB defaults (`gen_random_uuid()`, `now()`, `true`) apply for all seed rows.

All seed rules use a **0–1 weight scale**, matching the existing seed data in `fashion-knowledge.ts` and migration 001. The `styleRuleSchema` Zod validator has `max(100)` which is a permissive upper bound, not the intended scale — this spec does not change that validator.

```ts
export type SeedStyleRule = {
  rule_type: string;
  subject_type: string;
  subject_value: string;
  predicate: string;
  object_type: string;
  object_value: string;
  weight: number;           // 0–1 scale; matches all existing seed data
  rule_scope: "global";
  explanation: string;
  constraint_type: "hard" | "soft";
};
```

All existing rule-building functions are updated to include `constraint_type: "soft"`. New formality rules with `required_for` or `avoid_with` predicates use `constraint_type: "hard"`.

### New rule categories

#### Seasonality (15 rules, soft)
Predicate: `works_in_season` / `avoid_in_season`
Subject types: `category`, `material`
Object type: `season` — values: `spring`, `summer`, `autumn`, `winter`

Each season mapping is a **separate row** with an atomic `object_value`. A garment that works in two seasons produces two rows.

Examples (rows per item shown in parentheses):
- linen trousers `works_in_season` summer (1)
- heavy wool coat `works_in_season` autumn, winter (2)
- trench coat `works_in_season` spring, autumn (2)
- sandals `works_in_season` spring, summer (2)
- knitwear `works_in_season` autumn, winter (2)
- t-shirt `works_in_season` spring, summer (2)
- puffer jacket `works_in_season` winter (1)
- cotton shirt `works_in_season` spring, summer, autumn (3)

Total: 1+2+2+2+2+2+1+3 = **15 rows**.

#### Formality (18 rules)

**Dimensions:** `occasion` (object_type) and `dress_code` (object_type) are intentionally separate dimensions:
- `occasion_fit` rules (existing, in `occasions.ts`) use `object_type: "occasion"` with values from `occasionProfiles`: `casual`, `business_casual`, `evening`. These represent event types.
- `formality` rules (new, in `formality.ts`) use `object_type: "dress_code"` with values: `casual`, `smart_casual`, `business_casual`, `formal`, `black_tie`. These represent dress code requirements.

Value format: both dimensions use snake_case consistently (e.g. `business_casual` not `business-casual`).

Where both dimensions apply to the same garment (e.g. a blazer `appropriate_for` the `business_casual` occasion AND the `business_casual` dress code), two separate rows exist — one per object_type. The evaluator queries both dimensions using the active context.

Each dress code value in an example list = one row.

Rules with `required_for` or `avoid_with` predicates → `constraint_type: "hard"` (8 rows)
Rules with `appropriate_for` predicate → `constraint_type: "soft"` (10 rows)

Predicate: `required_for`, `appropriate_for`, `avoid_with`
Subject type: `category`
Object type: `dress_code`

Examples (hard, 8 rows):
- suit `required_for` black_tie (1), formal (1)
- jeans `avoid_with` black_tie (1), formal (1)
- open-toe shoes `avoid_with` formal (1)
- trainers `avoid_with` business_casual (1), formal (1), black_tie (1)

Examples (soft, 10 rows):
- loafers `appropriate_for` smart_casual (1), business_casual (1)
- dress shirt `appropriate_for` business_casual (1), formal (1)
- chinos `appropriate_for` smart_casual (1), business_casual (1)
- polo shirt `appropriate_for` smart_casual (1), casual (1)
- evening dress `appropriate_for` formal (1), black_tie (1)

#### Layering expanded (12 rules total, soft)
Predicate: `layerable_with`
Subject/object types: `category`

Includes the 1 existing rule (knitwear + coat) plus:
- shirt `layerable_with` blazer
- t-shirt `layerable_with` cardigan
- turtleneck `layerable_with` coat
- shirt `layerable_with` waistcoat
- base-layer `layerable_with` puffer
- tank `layerable_with` shirt
- dress `layerable_with` denim jacket
- bodysuit `layerable_with` trousers

#### Silhouette expanded (8 rules total, soft)
Predicate: `pairs_with`
Subject/object types: `category`

Includes the 1 existing rule (wide-leg trousers + fitted top) plus:
- slim-fit trousers `pairs_with` oversized top
- midi skirt `pairs_with` fitted top
- cropped jacket `pairs_with` high-waist bottom
- straight-leg trousers `pairs_with` tucked shirt
- maxi skirt `pairs_with` fitted top
- fitted dress `pairs_with` structured outerwear
- relaxed trousers `pairs_with` structured blazer

#### Materials (~12 rules, soft)
Predicate: `works_in_weather`, `texture_contrast_with`, `avoid_layering_with`
Subject/object types: `material`

Examples:
- linen `works_in_weather` warm_sun
- wool `works_in_weather` cold_rain, cool_breeze
- cotton `works_in_weather` mild_clear, warm_sun
- leather `avoid_layering_with` leather
- denim `texture_contrast_with` silk
- cashmere `works_in_weather` cool_breeze, cold_rain
- silk `avoid_layering_with` silk
- nylon `works_in_weather` cold_rain

### Migration — `004_seed_style_rules.sql`

Migrations 002 and 003 do not touch `style_rules`, so this migration has no conflicts with prior migration state.

**The 5 migration 001 rows and their fate:**
| rule_type (001) | subject_value | predicate | object_value | After 004 |
|---|---|---|---|---|
| colour_pairing | beige | pairs_with | navy | Deleted, NOT re-inserted — `buildSeedStyleRules()` has beige/brown (analogous), not beige/navy |
| occasion_fit | white shirt | appropriate_for | business_casual | Deleted and re-inserted with `constraint_type: "soft"` |
| weather_fit | sandals | avoid_with | cold_rain | Deleted and re-inserted |
| layering | knitwear | layerable_with | coat | Deleted and re-inserted |
| silhouette | wide_leg_trousers | pairs_with | fitted_top | Deleted and re-inserted |

The 4 non-colour rows use `rule_type` values identical to those generated by `buildSeedStyleRules()`, so they will be cleanly replaced in step 4.

**Execution order:**

1. Add `constraint_type` column to `style_rules` with `default 'soft'` and check constraint
2. Add a **partial unique index** on global rules only to make seeding idempotent without blocking user rules:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_style_rules_global_unique
   ON public.style_rules (rule_type, subject_type, subject_value, predicate, object_type, object_value)
   WHERE rule_scope = 'global';
   ```
   This allows two different users to hold the same semantic rule as a personal override, while preventing duplicate global seed rows.
3. Delete the 5 legacy rows from migration 001. The DELETE includes `subject_type` and `object_type` to match exactly and remain consistent with the partial index definition:
   ```sql
   DELETE FROM public.style_rules
   WHERE rule_scope = 'global'
     AND (rule_type, subject_type, subject_value, predicate, object_type, object_value) IN (
       ('colour_pairing', 'colour_family', 'beige', 'pairs_with', 'colour_family', 'navy'),
       ('occasion_fit',   'category',      'white shirt', 'appropriate_for', 'occasion', 'business_casual'),
       ('weather_fit',    'category',      'sandals', 'avoid_with', 'weather', 'cold_rain'),
       ('layering',       'category',      'knitwear', 'layerable_with', 'category', 'coat'),
       ('silhouette',     'category',      'wide_leg_trousers', 'pairs_with', 'category', 'fitted_top')
     );
   ```
4. Insert the complete rule set (~112 rules) using `INSERT ... ON CONFLICT DO NOTHING`

The partial unique index (step 2) ensures the migration is re-runnable: a second execution will skip all inserts silently.

### `styleRuleSchema` update

Add `constraint_type` to the Zod schema in `lib/domain/style-rules/index.ts`:

```ts
constraint_type: z.enum(["hard", "soft"]).default("soft")
```

The `.default("soft")` is intentional: it guards against rows parsed before migration 004 runs (e.g. in a partially-migrated environment or in tests) returning `undefined` for the new column. It is not a substitute for including `constraint_type` in the select projection — a missing column in the select string will silently default rather than throw.

Note: the existing `weight` validator (`z.number().min(0).max(100)`) is not changed by this spec. The `max(100)` is a permissive bound, not the target scale — all new seed rules must use 0–1 weights matching the existing seed data.

### `service.ts` update

**Schema inheritance:** `styleRuleListSchema` is built via `styleRuleSchema.extend({...})` and will inherit `constraint_type` automatically — no changes to `styleRuleListSchema` itself are needed. `StyleRuleListItem = z.infer<typeof styleRuleListSchema>` will gain `constraint_type: "hard" | "soft"`. This type change is additive; no existing consumers need updating.

**Select projection:** Add `constraint_type` to the select string in the three read/write queries that return rows (`listStyleRules`, `createUserStyleRule`, `updateUserStyleRule`). `styleRuleListSchema` itself needs no code change, but the select projection strings in all three functions do:

```
"id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,
 rule_scope,user_id,explanation,active,constraint_type,created_at"
```

`deleteUserStyleRule` has no select projection and requires no change.

Note: the Zod `.default("soft")` will silently coerce a missing column rather than throw — so a missing projection will not surface as a TypeScript or runtime error. All three projections must be updated explicitly.

**Create user rule payload:** Since `constraint_type` is omitted from `createUserStyleRuleSchema`, it will not be present in the parsed spread. The payload must explicitly set `constraint_type: "soft"` to avoid passing `undefined` to the insert (which could interact unpredictably with the `as never` cast):

```ts
const payload: StyleRuleInsert = {
  ...parsed,
  rule_scope: "user",
  user_id: user.id,
  constraint_type: "soft"
};
```

**Update user rule payload:** `updateUserStyleRule` passes `updateUserStyleRuleSchema.parse(input)` directly as payload. Since `constraint_type` is omitted from `updateUserStyleRuleSchema`, it will not be included in the UPDATE. This is intentional and safe — a SQL `UPDATE` that omits a column leaves the existing DB value unchanged, so users can never alter `constraint_type` on their rules.

**Omit schemas:** Both `createUserStyleRuleSchema` and `updateUserStyleRuleSchema` must explicitly omit `constraint_type`:

```ts
const createUserStyleRuleSchema = styleRuleSchema.omit({
  id: true,
  user_id: true,
  rule_scope: true,
  constraint_type: true   // users cannot create or modify hard rules
});
const updateUserStyleRuleSchema = createUserStyleRuleSchema;
```

## Rule counts (total in seed set after migration 004)

Colour rules from `buildColourRules()`: 4 complementary pairs × 2 directions = 8, 6 analogous pairs × 2 = 12, 2 triadic groups × 6 directed edges = 12 → **32 colour rules**.

| Category | Rules in seed set | constraint_type |
|---|---|---|
| Colour (complementary, analogous, triadic) | 32 | soft |
| Weather fit | 8 | soft |
| Occasion fit | 7 | soft |
| Seasonality | 15 | soft |
| Formality (hard) | 8 | hard |
| Formality (soft) | 10 | soft |
| Layering | 12 | soft |
| Silhouette | 8 | soft |
| Materials | ~12 | soft |
| **Total** | **~112** | |

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
| `lib/domain/style-rules/knowledge/index.ts` | Create (SeedStyleRule type + aggregator; no import from parent index.ts) |
| `lib/domain/style-rules/fashion-knowledge.ts` | Edit (thin re-export shim of all public exports) |
| `lib/domain/style-rules/index.ts` | Edit (add constraint_type to styleRuleSchema) |
| `lib/domain/style-rules/service.ts` | Edit (add constraint_type to 3 select projections; omit from create/update schemas; explicit constraint_type: "soft" in create payload) |
| `supabase/migrations/004_seed_style_rules.sql` | Create (column + partial unique index + delete legacy rows + full seed) |

## Out of scope

- Rule evaluator / outfit engine integration (Phase 3 per agents.md)
- UI changes to display constraint_type prominently
- User-facing rule creation form changes (constraint_type is omitted from user create/update schemas)
