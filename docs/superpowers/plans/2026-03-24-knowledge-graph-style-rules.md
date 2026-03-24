# Knowledge Graph — Style Rules Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the fashion knowledge graph with seasonality, formality, layering, silhouette, and material rules; add `constraint_type` (hard/soft) to the schema; refactor the monolithic `fashion-knowledge.ts` into focused per-category modules; and seed the complete ~112-rule set via a new migration.

**Architecture:** Knowledge rules live in focused per-category TypeScript modules under `lib/domain/style-rules/knowledge/`, aggregated by an `index.ts`. The `style_rules` table gains a `constraint_type` column (hard/soft, default soft). A new migration 004 adds the column, a partial unique index on global rules, deletes 5 stale legacy rows, and inserts the full seed set. `fashion-knowledge.ts` becomes a thin re-export shim for backwards compatibility.

**Tech Stack:** TypeScript, Zod, Supabase (Postgres), Vitest, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-03-24-knowledge-graph-style-rules-design.md`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `lib/domain/style-rules/knowledge/index.ts` | Create | `SeedStyleRule` type + `buildSeedStyleRules()` aggregator |
| `lib/domain/style-rules/knowledge/colours.ts` | Create | Colour families, synonyms, `inferColourFamilyFromText`, colour rules |
| `lib/domain/style-rules/knowledge/weather.ts` | Create | Weather profiles + weather_fit rules |
| `lib/domain/style-rules/knowledge/occasions.ts` | Create | Occasion profiles + occasion_fit rules |
| `lib/domain/style-rules/knowledge/seasonality.ts` | Create | Seasonality rules (15 rows) |
| `lib/domain/style-rules/knowledge/formality.ts` | Create | Formality/dress-code rules (18 rows, 8 hard + 10 soft) |
| `lib/domain/style-rules/knowledge/layering.ts` | Create | Layering rules (12 rows) |
| `lib/domain/style-rules/knowledge/silhouette.ts` | Create | Silhouette balancing rules (8 rows) |
| `lib/domain/style-rules/knowledge/materials.ts` | Create | Material/texture rules (~12 rows) |
| `lib/domain/style-rules/__tests__/knowledge.test.ts` | Create | Contract tests for `buildSeedStyleRules()` output |
| `lib/domain/style-rules/__tests__/schema.test.ts` | Create | Tests for `styleRuleSchema` with `constraint_type` |
| `lib/domain/style-rules/fashion-knowledge.ts` | Modify | Thin re-export shim |
| `lib/domain/style-rules/index.ts` | Modify | Add `constraint_type` to `styleRuleSchema` |
| `lib/domain/style-rules/service.ts` | Modify | Select projections, payload fix, omit schemas |
| `supabase/migrations/004_seed_style_rules.sql` | Create | Column + partial index + delete legacy + seed |

---

## Task 1: Write failing contract tests for the knowledge graph

Tests are written against the final expected output of `buildSeedStyleRules()`. They will fail until Tasks 2–11 are complete. This is intentional — the tests define the contract.

**Files:**
- Create: `lib/domain/style-rules/__tests__/knowledge.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// lib/domain/style-rules/__tests__/knowledge.test.ts
import { describe, it, expect } from "vitest";
import { buildSeedStyleRules } from "../knowledge/index";

describe("buildSeedStyleRules", () => {
  it("returns an array of rules", () => {
    const rules = buildSeedStyleRules();
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it("produces at least 100 rules", () => {
    const rules = buildSeedStyleRules();
    expect(rules.length).toBeGreaterThanOrEqual(100);
  });

  it("every rule has required fields with non-empty strings", () => {
    const rules = buildSeedStyleRules();
    for (const rule of rules) {
      expect(rule.rule_type.length).toBeGreaterThan(0);
      expect(rule.subject_type.length).toBeGreaterThan(0);
      expect(rule.subject_value.length).toBeGreaterThan(0);
      expect(rule.predicate.length).toBeGreaterThan(0);
      expect(rule.object_type.length).toBeGreaterThan(0);
      expect(rule.object_value.length).toBeGreaterThan(0);
      expect(rule.explanation.length).toBeGreaterThan(0);
      expect(rule.rule_scope).toBe("global");
    }
  });

  it("all weights are on the 0-1 scale", () => {
    const rules = buildSeedStyleRules();
    for (const rule of rules) {
      expect(rule.weight).toBeGreaterThan(0);
      expect(rule.weight).toBeLessThanOrEqual(1);
    }
  });

  it("every rule has constraint_type of 'hard' or 'soft'", () => {
    const rules = buildSeedStyleRules();
    for (const rule of rules) {
      expect(["hard", "soft"]).toContain(rule.constraint_type);
    }
  });

  it("hard rules only use required_for or avoid_with predicates", () => {
    const rules = buildSeedStyleRules();
    const hardRules = rules.filter((r) => r.constraint_type === "hard");
    expect(hardRules.length).toBeGreaterThan(0);
    for (const rule of hardRules) {
      expect(["required_for", "avoid_with"]).toContain(rule.predicate);
    }
  });

  it("soft formality rules do not use required_for or avoid_with predicates", () => {
    // Note: avoid_with is valid for soft rules in other contexts (e.g. weather_fit).
    // Only formality rules use hard constraint_type — this test validates that boundary.
    const rules = buildSeedStyleRules();
    const softFormality = rules.filter(
      (r) => r.constraint_type === "soft" && r.rule_type === "formality"
    );
    for (const rule of softFormality) {
      expect(rule.predicate).not.toBe("required_for");
      expect(rule.predicate).not.toBe("avoid_with");
    }
  });

  it("seasonality rules have atomic object_value (no commas)", () => {
    const rules = buildSeedStyleRules();
    const seasonalityRules = rules.filter((r) => r.rule_type === "seasonality");
    expect(seasonalityRules.length).toBeGreaterThan(0);
    for (const rule of seasonalityRules) {
      expect(rule.object_value).not.toContain(",");
      expect(["spring", "summer", "autumn", "winter"]).toContain(rule.object_value);
    }
  });

  it("produces exactly 15 seasonality rules", () => {
    const rules = buildSeedStyleRules();
    const seasonalityRules = rules.filter((r) => r.rule_type === "seasonality");
    expect(seasonalityRules.length).toBe(15);
  });

  it("produces 32 colour rules (complement + analogous + triadic)", () => {
    const rules = buildSeedStyleRules();
    const colourRules = rules.filter((r) =>
      ["colour_complement", "colour_analogous", "colour_triadic"].includes(r.rule_type)
    );
    expect(colourRules.length).toBe(32);
  });

  it("formality hard rules target dress_code object type", () => {
    const rules = buildSeedStyleRules();
    const hardRules = rules.filter((r) => r.constraint_type === "hard");
    for (const rule of hardRules) {
      expect(rule.object_type).toBe("dress_code");
    }
  });

  it("dress_code values use snake_case (no hyphens)", () => {
    const rules = buildSeedStyleRules();
    const dressCodes = rules.filter((r) => r.object_type === "dress_code");
    for (const rule of dressCodes) {
      expect(rule.object_value).not.toContain("-");
    }
  });

  it("no two global rules share the same (rule_type, subject_type, subject_value, predicate, object_type, object_value) tuple", () => {
    const rules = buildSeedStyleRules();
    const keys = rules.map(
      (r) =>
        `${r.rule_type}|${r.subject_type}|${r.subject_value}|${r.predicate}|${r.object_type}|${r.object_value}`
    );
    const unique = new Set(keys);
    expect(unique.size).toBe(rules.length);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (module not found)**

```bash
npx vitest run lib/domain/style-rules/__tests__/knowledge.test.ts
```

Expected: **FAIL** — `Cannot find module '../knowledge/index'`

- [ ] **Step 3: Commit the failing test**

```bash
git add lib/domain/style-rules/__tests__/knowledge.test.ts
git commit -m "test: add failing contract tests for buildSeedStyleRules"
```

---

## Task 2: Create `knowledge/index.ts` — SeedStyleRule type + stub aggregator

**Files:**
- Create: `lib/domain/style-rules/knowledge/index.ts`

- [ ] **Step 1: Create the file with the type and a stub that returns an empty array**

```typescript
// lib/domain/style-rules/knowledge/index.ts
// NOTE: This file must NOT import from lib/domain/style-rules/index.ts
// SeedStyleRule is a plain insert-only type with no Zod dependency.

export type SeedStyleRule = {
  rule_type: string;
  subject_type: string;
  subject_value: string;
  predicate: string;
  object_type: string;
  object_value: string;
  weight: number;           // 0–1 scale
  rule_scope: "global";
  explanation: string;
  constraint_type: "hard" | "soft";
  // active, id, created_at intentionally absent — DB defaults apply
};

export function buildSeedStyleRules(): SeedStyleRule[] {
  return [];
}
```

- [ ] **Step 2: Run the test — expect it to fail on count assertions**

```bash
npx vitest run lib/domain/style-rules/__tests__/knowledge.test.ts
```

Expected: **FAIL** — "expected 0 to be greater than or equal to 100"

---

## Task 3: Create `knowledge/colours.ts`

Move all colour logic from `fashion-knowledge.ts`. No imports from parent `index.ts`.

**Files:**
- Create: `lib/domain/style-rules/knowledge/colours.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/domain/style-rules/knowledge/colours.ts
import type { SeedStyleRule } from "./index";

export const colourFamilies = [
  "black", "white", "grey", "blue", "red", "green",
  "yellow", "orange", "purple", "pink", "brown", "beige"
] as const;

export type ColourFamily = (typeof colourFamilies)[number];

const colourSynonyms: Record<ColourFamily, string[]> = {
  black: ["black", "onyx", "ebony", "midnight", "jet", "charcoal", "noir", "ink"],
  white: ["white", "ivory", "eggshell", "snow", "pearl", "alabaster", "off-white", "cream"],
  grey: ["grey", "gray", "heather", "slate", "silver", "anthracite", "steel", "dove", "cloud"],
  blue: ["blue", "navy", "denim", "sky", "azure", "cobalt", "indigo", "cyan", "cerulean", "marine"],
  red: ["red", "burgundy", "crimson", "scarlet", "wine", "bordeaux", "cherry", "brick", "oxblood"],
  green: ["green", "olive", "emerald", "forest", "sage", "mint", "khaki", "army", "pine", "lime"],
  yellow: ["yellow", "gold", "mustard", "lemon", "ochre", "canary", "saffron", "amber"],
  orange: ["orange", "rust", "coral", "terracotta", "peach", "apricot", "burnt orange", "tangerine"],
  purple: ["purple", "lavender", "violet", "plum", "mauve", "lilac", "grape", "eggplant", "amethyst"],
  pink: ["pink", "rose", "fuchsia", "blush", "magenta", "dusty rose", "bubblegum", "salmon"],
  brown: ["brown", "camel", "tan", "chocolate", "espresso", "cognac", "mocha", "toffee", "umber"],
  beige: ["beige", "sand", "oatmeal", "stone", "taupe", "ecru", "nude", "champagne"]
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeRuleValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeLooseText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function inferColourFamilyFromText(text: string | null | undefined): ColourFamily | null {
  const normalized = (text ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const entries = Object.entries(colourSynonyms) as Array<[ColourFamily, string[]]>;
  for (const [family, synonyms] of entries) {
    for (const synonym of synonyms.sort((a, b) => b.length - a.length)) {
      const pattern = new RegExp(
        `(^|[^a-z])${escapeRegExp(synonym.toLowerCase())}([^a-z]|$)`,
        "i"
      );
      if (pattern.test(normalized)) return family;
    }
  }
  return null;
}

const complementaryPairs: Array<[ColourFamily, ColourFamily, string]> = [
  ["blue", "orange", "Blue and orange create a high-contrast pairing that reads bold and intentional."],
  ["green", "red", "Green and red can create a sharp, editorial contrast when the tones are controlled."],
  ["purple", "yellow", "Purple and yellow create vivid contrast that feels directional rather than safe."],
  ["black", "white", "Black and white delivers a clear high-contrast look with very low styling friction."]
];

const analogousPairs: Array<[ColourFamily, ColourFamily, string]> = [
  ["blue", "purple", "Blue and purple sit close on the colour wheel, which makes them feel tonal and smooth."],
  ["red", "pink", "Red and pink read as adjacent shades, producing a soft but still polished tonal story."],
  ["yellow", "orange", "Yellow and orange produce warmth and a cohesive sunlit palette."],
  ["green", "yellow", "Green and yellow feel fresh and adjacent, especially in spring and summer dressing."],
  ["beige", "brown", "Beige and brown create depth within a neutral palette without losing harmony."],
  ["grey", "black", "Grey and black create restrained tonal contrast that stays clean and urban."]
];

const triadicGroups: Array<[ColourFamily, ColourFamily, ColourFamily, string]> = [
  ["blue", "red", "yellow", "Blue, red, and yellow form a classic triadic palette with balanced energy."],
  ["green", "orange", "purple", "Green, orange, and purple create a lively but stable triadic story."]
];

export function buildColourRules(): SeedStyleRule[] {
  const rules: SeedStyleRule[] = [];

  for (const [left, right, explanation] of complementaryPairs) {
    rules.push(
      { rule_type: "colour_complement", subject_type: "colour_family", subject_value: left, predicate: "pairs_with", object_type: "colour_family", object_value: right, weight: 0.96, rule_scope: "global", explanation, constraint_type: "soft" },
      { rule_type: "colour_complement", subject_type: "colour_family", subject_value: right, predicate: "pairs_with", object_type: "colour_family", object_value: left, weight: 0.96, rule_scope: "global", explanation, constraint_type: "soft" }
    );
  }

  for (const [left, right, explanation] of analogousPairs) {
    rules.push(
      { rule_type: "colour_analogous", subject_type: "colour_family", subject_value: left, predicate: "pairs_with", object_type: "colour_family", object_value: right, weight: 0.88, rule_scope: "global", explanation, constraint_type: "soft" },
      { rule_type: "colour_analogous", subject_type: "colour_family", subject_value: right, predicate: "pairs_with", object_type: "colour_family", object_value: left, weight: 0.88, rule_scope: "global", explanation, constraint_type: "soft" }
    );
  }

  for (const [a, b, c, explanation] of triadicGroups) {
    const edges: Array<[ColourFamily, ColourFamily]> = [[a,b],[a,c],[b,a],[b,c],[c,a],[c,b]];
    for (const [left, right] of edges) {
      rules.push({ rule_type: "colour_triadic", subject_type: "colour_family", subject_value: left, predicate: "pairs_with", object_type: "colour_family", object_value: right, weight: 0.8, rule_scope: "global", explanation, constraint_type: "soft" });
    }
  }

  return rules;
}
```

---

## Task 4: Create `knowledge/weather.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/weather.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/domain/style-rules/knowledge/weather.ts
import type { SeedStyleRule } from "./index";

export const weatherProfiles = ["warm_sun", "mild_clear", "cool_breeze", "cold_rain"] as const;
export type WeatherProfile = (typeof weatherProfiles)[number];

export function buildWeatherRules(): SeedStyleRule[] {
  return [
    { rule_type: "weather_fit", subject_type: "category", subject_value: "sandals", predicate: "avoid_with", object_type: "weather", object_value: "cold_rain", weight: 0.99, rule_scope: "global", explanation: "Sandals are generally a poor choice in cold rainy weather.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "coat", predicate: "works_in_weather", object_type: "weather", object_value: "cold_rain", weight: 0.95, rule_scope: "global", explanation: "A coat is one of the safest outer layers for cold rainy conditions.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "boots", predicate: "works_in_weather", object_type: "weather", object_value: "cold_rain", weight: 0.94, rule_scope: "global", explanation: "Boots usually handle wet streets and lower temperatures better than open footwear.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "knitwear", predicate: "works_in_weather", object_type: "weather", object_value: "cool_breeze", weight: 0.9, rule_scope: "global", explanation: "Knitwear adds insulation without the weight of a full coat in cooler breezy weather.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "linen trousers", predicate: "works_in_weather", object_type: "weather", object_value: "warm_sun", weight: 0.92, rule_scope: "global", explanation: "Linen trousers breathe well and stay comfortable in warmer sunny weather.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "t-shirt", predicate: "works_in_weather", object_type: "weather", object_value: "warm_sun", weight: 0.88, rule_scope: "global", explanation: "A t-shirt is a reliable warm-weather base because it is breathable and easy to layer lightly.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "blazer", predicate: "works_in_weather", object_type: "weather", object_value: "mild_clear", weight: 0.78, rule_scope: "global", explanation: "A blazer is often most comfortable in mild weather when outerwear is optional.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "loafer", predicate: "works_in_weather", object_type: "weather", object_value: "mild_clear", weight: 0.82, rule_scope: "global", explanation: "Loafers work best in dry mild weather where a polished low-profile shoe is practical.", constraint_type: "soft" },
  ];
}
```

---

## Task 5: Create `knowledge/occasions.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/occasions.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/domain/style-rules/knowledge/occasions.ts
import type { SeedStyleRule } from "./index";

export const occasionProfiles = ["casual", "business_casual", "evening"] as const;
export type OccasionProfile = (typeof occasionProfiles)[number];

export function buildOccasionRules(): SeedStyleRule[] {
  return [
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "white shirt", predicate: "appropriate_for", object_type: "occasion", object_value: "business_casual", weight: 0.95, rule_scope: "global", explanation: "A white shirt is a strong business-casual base layer.", constraint_type: "soft" },
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "blazer", predicate: "appropriate_for", object_type: "occasion", object_value: "business_casual", weight: 0.92, rule_scope: "global", explanation: "A blazer makes business-casual outfits feel intentional without forcing full suiting.", constraint_type: "soft" },
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "tailored trousers", predicate: "appropriate_for", object_type: "occasion", object_value: "business_casual", weight: 0.9, rule_scope: "global", explanation: "Tailored trousers anchor business-casual outfits with structure.", constraint_type: "soft" },
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "sneakers", predicate: "appropriate_for", object_type: "occasion", object_value: "casual", weight: 0.9, rule_scope: "global", explanation: "Sneakers are a safe casual footwear base for everyday dressing.", constraint_type: "soft" },
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "denim jacket", predicate: "appropriate_for", object_type: "occasion", object_value: "casual", weight: 0.82, rule_scope: "global", explanation: "A denim jacket usually reads casual and relaxed.", constraint_type: "soft" },
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "dress", predicate: "appropriate_for", object_type: "occasion", object_value: "evening", weight: 0.86, rule_scope: "global", explanation: "A dress often transitions easily into evening dressing depending on fabrication and styling.", constraint_type: "soft" },
    { rule_type: "occasion_fit", subject_type: "category", subject_value: "heels", predicate: "appropriate_for", object_type: "occasion", object_value: "evening", weight: 0.84, rule_scope: "global", explanation: "Heels often elevate a look for evening settings.", constraint_type: "soft" },
  ];
}
```

---

## Task 6: Create `knowledge/seasonality.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/seasonality.ts`

- [ ] **Step 1: Create the file (15 rules — one row per season, all soft)**

```typescript
// lib/domain/style-rules/knowledge/seasonality.ts
import type { SeedStyleRule } from "./index";

type Season = "spring" | "summer" | "autumn" | "winter";

function season(
  subject_value: string,
  subject_type: "category" | "material",
  seasons: Season[],
  weight: number,
  explanation: string
): SeedStyleRule[] {
  return seasons.map((s) => ({
    rule_type: "seasonality",
    subject_type,
    subject_value,
    predicate: "works_in_season",
    object_type: "season",
    object_value: s,
    weight,
    rule_scope: "global" as const,
    explanation,
    constraint_type: "soft" as const,
  }));
}

export function buildSeasonalityRules(): SeedStyleRule[] {
  return [
    ...season("linen trousers", "category", ["summer"], 0.92, "Linen trousers breathe well and are best suited to summer heat."),
    ...season("heavy wool coat", "category", ["autumn", "winter"], 0.95, "Heavy wool coats provide the insulation needed in autumn and winter."),
    ...season("trench coat", "category", ["spring", "autumn"], 0.88, "A trench coat handles transitional weather in spring and autumn well."),
    ...season("sandals", "category", ["spring", "summer"], 0.9, "Sandals are suited to warmer spring and summer conditions."),
    ...season("knitwear", "category", ["autumn", "winter"], 0.9, "Knitwear provides warmth that is most useful in autumn and winter."),
    ...season("t-shirt", "category", ["spring", "summer"], 0.88, "A t-shirt is a practical lightweight layer for spring and summer."),
    ...season("puffer jacket", "category", ["winter"], 0.96, "A puffer jacket delivers maximum insulation for winter conditions."),
    ...season("cotton shirt", "category", ["spring", "summer", "autumn"], 0.85, "A cotton shirt is breathable and suitable across spring, summer, and autumn."),
  ];
}
```

- [ ] **Step 2: Verify the helper produces 15 rows**

Count: 1+2+2+2+2+2+1+3 = **15**. Check matches the spec.

---

## Task 7: Create `knowledge/formality.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/formality.ts`

- [ ] **Step 1: Create the file (18 rules: 8 hard + 10 soft)**

```typescript
// lib/domain/style-rules/knowledge/formality.ts
import type { SeedStyleRule } from "./index";

type DressCode = "casual" | "smart_casual" | "business_casual" | "formal" | "black_tie";

function hard(
  subject_value: string,
  predicate: "required_for" | "avoid_with",
  dressCodes: DressCode[],
  weight: number,
  explanation: string
): SeedStyleRule[] {
  return dressCodes.map((dc) => ({
    rule_type: "formality",
    subject_type: "category",
    subject_value,
    predicate,
    object_type: "dress_code",
    object_value: dc,
    weight,
    rule_scope: "global" as const,
    explanation,
    constraint_type: "hard" as const,
  }));
}

function soft(
  subject_value: string,
  dressCodes: DressCode[],
  weight: number,
  explanation: string
): SeedStyleRule[] {
  return dressCodes.map((dc) => ({
    rule_type: "formality",
    subject_type: "category",
    subject_value,
    predicate: "appropriate_for",
    object_type: "dress_code",
    object_value: dc,
    weight,
    rule_scope: "global" as const,
    explanation,
    constraint_type: "soft" as const,
  }));
}

export function buildFormalityRules(): SeedStyleRule[] {
  return [
    // Hard rules (8 rows)
    ...hard("suit", "required_for", ["black_tie", "formal"], 0.99, "A suit is a non-negotiable requirement at black tie and formal occasions."),
    ...hard("jeans", "avoid_with", ["black_tie", "formal"], 0.99, "Jeans are too casual and should be avoided at black tie and formal events."),
    ...hard("open-toe shoes", "avoid_with", ["formal"], 0.95, "Open-toe shoes are generally inappropriate for formal occasions."),
    ...hard("trainers", "avoid_with", ["business_casual", "formal", "black_tie"], 0.97, "Trainers are too casual for business-casual settings and above."),
    // Soft rules (10 rows)
    ...soft("loafers", ["smart_casual", "business_casual"], 0.82, "Loafers are a versatile shoe that works well for smart-casual and business-casual dress codes."),
    ...soft("dress shirt", ["business_casual", "formal"], 0.9, "A dress shirt is a reliable choice for business-casual and formal occasions."),
    ...soft("chinos", ["smart_casual", "business_casual"], 0.85, "Chinos sit comfortably in smart-casual and business-casual dress codes."),
    ...soft("polo shirt", ["smart_casual", "casual"], 0.78, "A polo shirt reads polished enough for smart-casual and relaxed enough for casual."),
    ...soft("evening dress", ["formal", "black_tie"], 0.92, "An evening dress is well-suited to formal and black-tie events."),
  ];
}
```

---

## Task 8: Create `knowledge/layering.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/layering.ts`

- [ ] **Step 1: Create the file (12 rules total)**

```typescript
// lib/domain/style-rules/knowledge/layering.ts
import type { SeedStyleRule } from "./index";

function layer(subject: string, object: string, weight: number, explanation: string): SeedStyleRule {
  return {
    rule_type: "layering",
    subject_type: "category",
    subject_value: subject,
    predicate: "layerable_with",
    object_type: "category",
    object_value: object,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildLayeringRules(): SeedStyleRule[] {
  return [
    layer("knitwear", "coat", 0.9, "Knitwear often layers well with coats in cooler weather."),
    layer("shirt", "blazer", 0.92, "A shirt under a blazer is a classic layering combination for structured looks."),
    layer("t-shirt", "cardigan", 0.85, "A t-shirt under a cardigan creates an easy layered casual look."),
    layer("turtleneck", "coat", 0.88, "A turtleneck under a coat adds warmth and a strong visual layer in cold weather."),
    layer("shirt", "waistcoat", 0.84, "A shirt under a waistcoat gives a smart, layered finish without a jacket."),
    layer("base-layer", "puffer", 0.93, "A base layer under a puffer is the most practical winter layering combination."),
    layer("tank", "shirt", 0.78, "A tank under an open shirt creates an effortless layered look."),
    layer("dress", "denim jacket", 0.8, "A dress with a denim jacket over it adds casual contrast and warmth."),
    layer("bodysuit", "trousers", 0.82, "A bodysuit tucked into trousers gives a clean, smooth layered silhouette."),
    layer("shirt", "knitwear", 0.86, "A collared shirt under a knit is a classic smart-casual layering move."),
    layer("vest", "blazer", 0.83, "A vest under a blazer adds texture and depth to a tailored look."),
    layer("turtleneck", "blazer", 0.87, "A turtleneck under a blazer creates a sleek modern alternative to a shirt and tie."),
  ];
}
```

---

## Task 9: Create `knowledge/silhouette.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/silhouette.ts`

- [ ] **Step 1: Create the file (8 rules total)**

```typescript
// lib/domain/style-rules/knowledge/silhouette.ts
import type { SeedStyleRule } from "./index";

function sil(subject: string, object: string, weight: number, explanation: string): SeedStyleRule {
  return {
    rule_type: "silhouette",
    subject_type: "category",
    subject_value: subject,
    predicate: "pairs_with",
    object_type: "category",
    object_value: object,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildSilhouetteRules(): SeedStyleRule[] {
  return [
    sil("wide_leg_trousers", "fitted_top", 0.85, "Wide-leg trousers usually balance well with a more fitted top."),
    sil("slim_fit_trousers", "oversized_top", 0.84, "Slim-fit trousers balance an oversized top by keeping the lower half streamlined."),
    sil("midi_skirt", "fitted_top", 0.83, "A midi skirt pairs well with a fitted top to keep the silhouette from reading bulky."),
    sil("cropped_jacket", "high_waist_bottom", 0.86, "A cropped jacket works best with a high-waist bottom that meets the hem cleanly."),
    sil("straight_leg_trousers", "tucked_shirt", 0.82, "A tucked shirt with straight-leg trousers creates a clean, elongated line."),
    sil("maxi_skirt", "fitted_top", 0.81, "A fitted top keeps the silhouette controlled when wearing a voluminous maxi skirt."),
    sil("fitted_dress", "structured_outerwear", 0.88, "A fitted dress reads polished under structured outerwear like a tailored coat."),
    sil("relaxed_trousers", "structured_blazer", 0.84, "Relaxed trousers balance a structured blazer by adding ease at the bottom."),
  ];
}
```

---

## Task 10: Create `knowledge/materials.ts`

**Files:**
- Create: `lib/domain/style-rules/knowledge/materials.ts`

- [ ] **Step 1: Create the file (~12 rules)**

```typescript
// lib/domain/style-rules/knowledge/materials.ts
import type { SeedStyleRule } from "./index";

function mat(
  subject: string,
  predicate: string,
  objectType: string,
  object: string,
  weight: number,
  explanation: string
): SeedStyleRule {
  return {
    rule_type: "material",
    subject_type: "material",
    subject_value: subject,
    predicate,
    object_type: objectType,
    object_value: object,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildMaterialRules(): SeedStyleRule[] {
  return [
    mat("linen", "works_in_weather", "weather", "warm_sun", 0.93, "Linen is highly breathable and one of the best fabrics for warm sunny weather."),
    mat("wool", "works_in_weather", "weather", "cold_rain", 0.9, "Wool provides warmth and some moisture resistance in cold rainy conditions."),
    mat("wool", "works_in_weather", "weather", "cool_breeze", 0.88, "Wool is well suited to cool breezy weather as a mid or outer layer."),
    mat("cotton", "works_in_weather", "weather", "mild_clear", 0.85, "Cotton is a versatile breathable fabric that works well in mild clear conditions."),
    mat("cotton", "works_in_weather", "weather", "warm_sun", 0.82, "Cotton breathes reasonably well in warm weather though linen is preferable."),
    mat("cashmere", "works_in_weather", "weather", "cool_breeze", 0.9, "Cashmere is light enough not to overheat but warm enough for cool breezy weather."),
    mat("cashmere", "works_in_weather", "weather", "cold_rain", 0.78, "Cashmere provides warmth in cold rain though it should be protected from moisture."),
    mat("nylon", "works_in_weather", "weather", "cold_rain", 0.88, "Nylon and technical fabrics are water-resistant and reliable in cold rainy weather."),
    mat("leather", "avoid_layering_with", "material", "leather", 0.85, "Layering leather on leather creates a tone-on-tone clash that reads heavy rather than intentional."),
    mat("silk", "avoid_layering_with", "material", "silk", 0.8, "Silk on silk tends to slip and create static, making it a poor layering combination."),
    mat("denim", "texture_contrast_with", "material", "silk", 0.82, "Denim and silk create a productive contrast between rough and refined textures."),
    mat("tweed", "texture_contrast_with", "material", "cotton", 0.78, "Tweed and cotton pair well by contrasting structured texture against a clean base."),
  ];
}
```

---

## Task 11: Wire the aggregator — `knowledge/index.ts`

Wire all modules into `buildSeedStyleRules()`. Run the tests. They should pass.

**Files:**
- Modify: `lib/domain/style-rules/knowledge/index.ts`

- [ ] **Step 1: Update `index.ts` to import and aggregate all modules**

```typescript
// lib/domain/style-rules/knowledge/index.ts
// NOTE: Must NOT import from lib/domain/style-rules/index.ts

export type SeedStyleRule = {
  rule_type: string;
  subject_type: string;
  subject_value: string;
  predicate: string;
  object_type: string;
  object_value: string;
  weight: number;           // 0–1 scale
  rule_scope: "global";
  explanation: string;
  constraint_type: "hard" | "soft";
  // active, id, created_at intentionally absent — DB defaults apply
};

export { colourFamilies, inferColourFamilyFromText } from "./colours";
export { weatherProfiles } from "./weather";
export { occasionProfiles } from "./occasions";
export type { ColourFamily } from "./colours";
export type { WeatherProfile } from "./weather";
export type { OccasionProfile } from "./occasions";

import { buildColourRules } from "./colours";
import { buildWeatherRules } from "./weather";
import { buildOccasionRules } from "./occasions";
import { buildSeasonalityRules } from "./seasonality";
import { buildFormalityRules } from "./formality";
import { buildLayeringRules } from "./layering";
import { buildSilhouetteRules } from "./silhouette";
import { buildMaterialRules } from "./materials";

// Keep for backwards compat — used by fashion-knowledge.ts shim
export { normalizeRuleValue, normalizeLooseText } from "./colours";

export function buildSeedStyleRules(): SeedStyleRule[] {
  return [
    ...buildColourRules(),
    ...buildWeatherRules(),
    ...buildOccasionRules(),
    ...buildSeasonalityRules(),
    ...buildFormalityRules(),
    ...buildLayeringRules(),
    ...buildSilhouetteRules(),
    ...buildMaterialRules(),
  ];
}
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run lib/domain/style-rules/__tests__/knowledge.test.ts
```

Expected: **ALL PASS**

- [ ] **Step 3: Run the TypeScript check**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/domain/style-rules/knowledge/ lib/domain/style-rules/__tests__/knowledge.test.ts
git commit -m "feat: add knowledge graph modules (seasonality, formality, layering, silhouette, materials)"
```

---

## Task 12: Replace `fashion-knowledge.ts` with a re-export shim

The original file had all the logic. Now it becomes a thin barrel that re-exports everything from the knowledge modules. This preserves all existing import paths.

**Files:**
- Modify: `lib/domain/style-rules/fashion-knowledge.ts`

- [ ] **Step 1: Replace the file contents with the shim**

```typescript
// lib/domain/style-rules/fashion-knowledge.ts
// Re-export shim — all logic has moved to lib/domain/style-rules/knowledge/
// This file is kept for backwards compatibility. Do not add logic here.

export {
  buildSeedStyleRules,
  colourFamilies,
  weatherProfiles,
  occasionProfiles,
  inferColourFamilyFromText,
  normalizeRuleValue,
  normalizeLooseText,
} from "./knowledge/index";

export type {
  SeedStyleRule,
  ColourFamily,
  WeatherProfile,
  OccasionProfile,
} from "./knowledge/index";
```

- [ ] **Step 2: Run the TypeScript check to confirm no broken imports**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/domain/style-rules/fashion-knowledge.ts
git commit -m "refactor: replace fashion-knowledge.ts with re-export shim"
```

---

## Task 13: Add `constraint_type` to `styleRuleSchema` + write schema tests

**Files:**
- Modify: `lib/domain/style-rules/index.ts`
- Create: `lib/domain/style-rules/__tests__/schema.test.ts`

- [ ] **Step 1: Write the failing schema test first**

```typescript
// lib/domain/style-rules/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import { styleRuleSchema } from "../index";

describe("styleRuleSchema", () => {
  it("accepts valid constraint_type values", () => {
    const base = {
      rule_type: "test",
      subject_type: "category",
      subject_value: "blazer",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "shirt",
      weight: 0.9,
      rule_scope: "global",
    };
    expect(() => styleRuleSchema.parse({ ...base, constraint_type: "hard" })).not.toThrow();
    expect(() => styleRuleSchema.parse({ ...base, constraint_type: "soft" })).not.toThrow();
  });

  it("rejects invalid constraint_type values", () => {
    const base = {
      rule_type: "test",
      subject_type: "category",
      subject_value: "blazer",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "shirt",
      weight: 0.9,
      rule_scope: "global",
    };
    expect(() => styleRuleSchema.parse({ ...base, constraint_type: "medium" })).toThrow();
  });

  it("defaults constraint_type to 'soft' when absent", () => {
    const result = styleRuleSchema.parse({
      rule_type: "test",
      subject_type: "category",
      subject_value: "blazer",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "shirt",
      weight: 0.9,
      rule_scope: "global",
    });
    expect(result.constraint_type).toBe("soft");
  });
});
```

- [ ] **Step 2: Run the test — expect it to fail**

```bash
npx vitest run lib/domain/style-rules/__tests__/schema.test.ts
```

Expected: **FAIL** — `constraint_type` not in schema

- [ ] **Step 3: Add `constraint_type` to `styleRuleSchema`**

Open `lib/domain/style-rules/index.ts`. Add `constraint_type` to the schema object:

```typescript
// lib/domain/style-rules/index.ts
import { z } from "zod";

export const styleRuleSchema = z.object({
  id: z.string().uuid().optional(),
  rule_type: z.string().trim().min(1).max(100),
  subject_type: z.string().trim().min(1).max(100),
  subject_value: z.string().trim().min(1).max(200),
  predicate: z.string().trim().min(1).max(100),
  object_type: z.string().trim().min(1).max(100),
  object_value: z.string().trim().min(1).max(200),
  weight: z.number().min(0).max(100).default(1),
  rule_scope: z.enum(["global", "user"]).default("global"),
  user_id: z.string().uuid().nullable().optional(),
  explanation: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().default(true),
  constraint_type: z.enum(["hard", "soft"]).default("soft"),
});

export type StyleRule = z.infer<typeof styleRuleSchema>;
```

- [ ] **Step 4: Run the schema tests**

```bash
npx vitest run lib/domain/style-rules/__tests__/schema.test.ts
```

Expected: **ALL PASS**

- [ ] **Step 5: Run all tests + typecheck**

```bash
npx vitest run && npm run typecheck
```

Expected: all pass, no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add lib/domain/style-rules/index.ts lib/domain/style-rules/__tests__/schema.test.ts
git commit -m "feat: add constraint_type to styleRuleSchema"
```

---

## Task 14: Update `service.ts`

Three changes: select projection, create payload, omit schemas.

**Files:**
- Modify: `lib/domain/style-rules/service.ts`

- [ ] **Step 1: Add `constraint_type` to all three select projections**

Find the select string in `listStyleRules`, `createUserStyleRule`, and `updateUserStyleRule`. In all three, replace:

```
"id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,created_at"
```

with:

```
"id,rule_type,subject_type,subject_value,predicate,object_type,object_value,weight,rule_scope,user_id,explanation,active,constraint_type,created_at"
```

`deleteUserStyleRule` has no select — leave it unchanged.

- [ ] **Step 2: Omit `constraint_type` from create/update schemas**

```typescript
const createUserStyleRuleSchema = styleRuleSchema.omit({
  id: true,
  user_id: true,
  rule_scope: true,
  constraint_type: true,   // users cannot create hard rules
});
const updateUserStyleRuleSchema = createUserStyleRuleSchema;
```

- [ ] **Step 3: Explicitly set `constraint_type: "soft"` in the create payload**

In `createUserStyleRule`, update the payload construction:

```typescript
const payload: StyleRuleInsert = {
  ...parsed,
  rule_scope: "user",
  user_id: user.id,
  constraint_type: "soft",
};
```

`updateUserStyleRule` does NOT set `constraint_type` in its payload — this is intentional. A SQL UPDATE that omits a column leaves the existing DB value unchanged, so users can never modify `constraint_type` on their rules.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. Note: the generated `@/types/database` types will only reflect `constraint_type` after migration 004 is applied and types are regenerated. The `satisfies` cast in the service uses `as never` which will suppress type errors until then.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/style-rules/service.ts
git commit -m "feat: add constraint_type to style rules service"
```

---

## Task 15: Write migration `004_seed_style_rules.sql`

**Files:**
- Create: `supabase/migrations/004_seed_style_rules.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 004_seed_style_rules.sql
-- Adds constraint_type column, partial unique index on global rules,
-- removes 5 legacy hand-coded seed rows from 001, and inserts full seed set.

begin;

-- Step 1: Add constraint_type column
alter table public.style_rules
  add column if not exists constraint_type text not null default 'soft'
    check (constraint_type in ('hard', 'soft'));

-- Step 2: Partial unique index on global rules only.
-- Prevents duplicate global seeds on re-run. Does NOT block two different
-- users from each holding the same semantic rule as a personal override.
create unique index if not exists idx_style_rules_global_unique
  on public.style_rules (rule_type, subject_type, subject_value, predicate, object_type, object_value)
  where rule_scope = 'global';

-- Step 3: Delete the 5 legacy rows from migration 001.
-- The beige/navy row (colour_pairing) is not re-inserted — it is replaced
-- by the beige/brown analogous pair from buildSeedStyleRules().
-- The other 4 are re-inserted in step 4 with correct constraint_type.
delete from public.style_rules
where rule_scope = 'global'
  and (rule_type, subject_type, subject_value, predicate, object_type, object_value) in (
    ('colour_pairing', 'colour_family', 'beige',           'pairs_with',      'colour_family', 'navy'),
    ('occasion_fit',   'category',      'white shirt',     'appropriate_for', 'occasion',      'business_casual'),
    ('weather_fit',    'category',      'sandals',         'avoid_with',      'weather',       'cold_rain'),
    ('layering',       'category',      'knitwear',        'layerable_with',  'category',      'coat'),
    ('silhouette',     'category',      'wide_leg_trousers','pairs_with',     'category',      'fitted_top')
  );

-- Step 4: Insert full seed set (~112 rules).
-- ON CONFLICT DO NOTHING makes this re-runnable safely.
insert into public.style_rules
  (rule_type, subject_type, subject_value, predicate, object_type, object_value, weight, rule_scope, explanation, constraint_type)
values
  -- COLOUR: complementary (8 rows)
  ('colour_complement','colour_family','blue','pairs_with','colour_family','orange',0.96,'global','Blue and orange create a high-contrast pairing that reads bold and intentional.','soft'),
  ('colour_complement','colour_family','orange','pairs_with','colour_family','blue',0.96,'global','Blue and orange create a high-contrast pairing that reads bold and intentional.','soft'),
  ('colour_complement','colour_family','green','pairs_with','colour_family','red',0.96,'global','Green and red can create a sharp, editorial contrast when the tones are controlled.','soft'),
  ('colour_complement','colour_family','red','pairs_with','colour_family','green',0.96,'global','Green and red can create a sharp, editorial contrast when the tones are controlled.','soft'),
  ('colour_complement','colour_family','purple','pairs_with','colour_family','yellow',0.96,'global','Purple and yellow create vivid contrast that feels directional rather than safe.','soft'),
  ('colour_complement','colour_family','yellow','pairs_with','colour_family','purple',0.96,'global','Purple and yellow create vivid contrast that feels directional rather than safe.','soft'),
  ('colour_complement','colour_family','black','pairs_with','colour_family','white',0.96,'global','Black and white delivers a clear high-contrast look with very low styling friction.','soft'),
  ('colour_complement','colour_family','white','pairs_with','colour_family','black',0.96,'global','Black and white delivers a clear high-contrast look with very low styling friction.','soft'),
  -- COLOUR: analogous (12 rows)
  ('colour_analogous','colour_family','blue','pairs_with','colour_family','purple',0.88,'global','Blue and purple sit close on the colour wheel, which makes them feel tonal and smooth.','soft'),
  ('colour_analogous','colour_family','purple','pairs_with','colour_family','blue',0.88,'global','Blue and purple sit close on the colour wheel, which makes them feel tonal and smooth.','soft'),
  ('colour_analogous','colour_family','red','pairs_with','colour_family','pink',0.88,'global','Red and pink read as adjacent shades, producing a soft but still polished tonal story.','soft'),
  ('colour_analogous','colour_family','pink','pairs_with','colour_family','red',0.88,'global','Red and pink read as adjacent shades, producing a soft but still polished tonal story.','soft'),
  ('colour_analogous','colour_family','yellow','pairs_with','colour_family','orange',0.88,'global','Yellow and orange produce warmth and a cohesive sunlit palette.','soft'),
  ('colour_analogous','colour_family','orange','pairs_with','colour_family','yellow',0.88,'global','Yellow and orange produce warmth and a cohesive sunlit palette.','soft'),
  ('colour_analogous','colour_family','green','pairs_with','colour_family','yellow',0.88,'global','Green and yellow feel fresh and adjacent, especially in spring and summer dressing.','soft'),
  ('colour_analogous','colour_family','yellow','pairs_with','colour_family','green',0.88,'global','Green and yellow feel fresh and adjacent, especially in spring and summer dressing.','soft'),
  ('colour_analogous','colour_family','beige','pairs_with','colour_family','brown',0.88,'global','Beige and brown create depth within a neutral palette without losing harmony.','soft'),
  ('colour_analogous','colour_family','brown','pairs_with','colour_family','beige',0.88,'global','Beige and brown create depth within a neutral palette without losing harmony.','soft'),
  ('colour_analogous','colour_family','grey','pairs_with','colour_family','black',0.88,'global','Grey and black create restrained tonal contrast that stays clean and urban.','soft'),
  ('colour_analogous','colour_family','black','pairs_with','colour_family','grey',0.88,'global','Grey and black create restrained tonal contrast that stays clean and urban.','soft'),
  -- COLOUR: triadic (12 rows)
  ('colour_triadic','colour_family','blue','pairs_with','colour_family','red',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','blue','pairs_with','colour_family','yellow',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','red','pairs_with','colour_family','blue',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','red','pairs_with','colour_family','yellow',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','yellow','pairs_with','colour_family','blue',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','yellow','pairs_with','colour_family','red',0.8,'global','Blue, red, and yellow form a classic triadic palette with balanced energy.','soft'),
  ('colour_triadic','colour_family','green','pairs_with','colour_family','orange',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','green','pairs_with','colour_family','purple',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','orange','pairs_with','colour_family','green',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','orange','pairs_with','colour_family','purple',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','purple','pairs_with','colour_family','green',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  ('colour_triadic','colour_family','purple','pairs_with','colour_family','orange',0.8,'global','Green, orange, and purple create a lively but stable triadic story.','soft'),
  -- WEATHER (8 rows)
  ('weather_fit','category','sandals','avoid_with','weather','cold_rain',0.99,'global','Sandals are generally a poor choice in cold rainy weather.','soft'),
  ('weather_fit','category','coat','works_in_weather','weather','cold_rain',0.95,'global','A coat is one of the safest outer layers for cold rainy conditions.','soft'),
  ('weather_fit','category','boots','works_in_weather','weather','cold_rain',0.94,'global','Boots usually handle wet streets and lower temperatures better than open footwear.','soft'),
  ('weather_fit','category','knitwear','works_in_weather','weather','cool_breeze',0.9,'global','Knitwear adds insulation without the weight of a full coat in cooler breezy weather.','soft'),
  ('weather_fit','category','linen trousers','works_in_weather','weather','warm_sun',0.92,'global','Linen trousers breathe well and stay comfortable in warmer sunny weather.','soft'),
  ('weather_fit','category','t-shirt','works_in_weather','weather','warm_sun',0.88,'global','A t-shirt is a reliable warm-weather base because it is breathable and easy to layer lightly.','soft'),
  ('weather_fit','category','blazer','works_in_weather','weather','mild_clear',0.78,'global','A blazer is often most comfortable in mild weather when outerwear is optional.','soft'),
  ('weather_fit','category','loafer','works_in_weather','weather','mild_clear',0.82,'global','Loafers work best in dry mild weather where a polished low-profile shoe is practical.','soft'),
  -- OCCASION (7 rows)
  ('occasion_fit','category','white shirt','appropriate_for','occasion','business_casual',0.95,'global','A white shirt is a strong business-casual base layer.','soft'),
  ('occasion_fit','category','blazer','appropriate_for','occasion','business_casual',0.92,'global','A blazer makes business-casual outfits feel intentional without forcing full suiting.','soft'),
  ('occasion_fit','category','tailored trousers','appropriate_for','occasion','business_casual',0.9,'global','Tailored trousers anchor business-casual outfits with structure.','soft'),
  ('occasion_fit','category','sneakers','appropriate_for','occasion','casual',0.9,'global','Sneakers are a safe casual footwear base for everyday dressing.','soft'),
  ('occasion_fit','category','denim jacket','appropriate_for','occasion','casual',0.82,'global','A denim jacket usually reads casual and relaxed.','soft'),
  ('occasion_fit','category','dress','appropriate_for','occasion','evening',0.86,'global','A dress often transitions easily into evening dressing depending on fabrication and styling.','soft'),
  ('occasion_fit','category','heels','appropriate_for','occasion','evening',0.84,'global','Heels often elevate a look for evening settings.','soft'),
  -- SEASONALITY (15 rows)
  ('seasonality','category','linen trousers','works_in_season','season','summer',0.92,'global','Linen trousers breathe well and are best suited to summer heat.','soft'),
  ('seasonality','category','heavy wool coat','works_in_season','season','autumn',0.95,'global','Heavy wool coats provide the insulation needed in autumn and winter.','soft'),
  ('seasonality','category','heavy wool coat','works_in_season','season','winter',0.95,'global','Heavy wool coats provide the insulation needed in autumn and winter.','soft'),
  ('seasonality','category','trench coat','works_in_season','season','spring',0.88,'global','A trench coat handles transitional weather in spring and autumn well.','soft'),
  ('seasonality','category','trench coat','works_in_season','season','autumn',0.88,'global','A trench coat handles transitional weather in spring and autumn well.','soft'),
  ('seasonality','category','sandals','works_in_season','season','spring',0.9,'global','Sandals are suited to warmer spring and summer conditions.','soft'),
  ('seasonality','category','sandals','works_in_season','season','summer',0.9,'global','Sandals are suited to warmer spring and summer conditions.','soft'),
  ('seasonality','category','knitwear','works_in_season','season','autumn',0.9,'global','Knitwear provides warmth that is most useful in autumn and winter.','soft'),
  ('seasonality','category','knitwear','works_in_season','season','winter',0.9,'global','Knitwear provides warmth that is most useful in autumn and winter.','soft'),
  ('seasonality','category','t-shirt','works_in_season','season','spring',0.88,'global','A t-shirt is a practical lightweight layer for spring and summer.','soft'),
  ('seasonality','category','t-shirt','works_in_season','season','summer',0.88,'global','A t-shirt is a practical lightweight layer for spring and summer.','soft'),
  ('seasonality','category','puffer jacket','works_in_season','season','winter',0.96,'global','A puffer jacket delivers maximum insulation for winter conditions.','soft'),
  ('seasonality','category','cotton shirt','works_in_season','season','spring',0.85,'global','A cotton shirt is breathable and suitable across spring, summer, and autumn.','soft'),
  ('seasonality','category','cotton shirt','works_in_season','season','summer',0.85,'global','A cotton shirt is breathable and suitable across spring, summer, and autumn.','soft'),
  ('seasonality','category','cotton shirt','works_in_season','season','autumn',0.85,'global','A cotton shirt is breathable and suitable across spring, summer, and autumn.','soft'),
  -- FORMALITY: hard (8 rows)
  ('formality','category','suit','required_for','dress_code','black_tie',0.99,'global','A suit is a non-negotiable requirement at black tie and formal occasions.','hard'),
  ('formality','category','suit','required_for','dress_code','formal',0.99,'global','A suit is a non-negotiable requirement at black tie and formal occasions.','hard'),
  ('formality','category','jeans','avoid_with','dress_code','black_tie',0.99,'global','Jeans are too casual and should be avoided at black tie and formal events.','hard'),
  ('formality','category','jeans','avoid_with','dress_code','formal',0.99,'global','Jeans are too casual and should be avoided at black tie and formal events.','hard'),
  ('formality','category','open-toe shoes','avoid_with','dress_code','formal',0.95,'global','Open-toe shoes are generally inappropriate for formal occasions.','hard'),
  ('formality','category','trainers','avoid_with','dress_code','business_casual',0.97,'global','Trainers are too casual for business-casual settings and above.','hard'),
  ('formality','category','trainers','avoid_with','dress_code','formal',0.97,'global','Trainers are too casual for business-casual settings and above.','hard'),
  ('formality','category','trainers','avoid_with','dress_code','black_tie',0.97,'global','Trainers are too casual for business-casual settings and above.','hard'),
  -- FORMALITY: soft (10 rows)
  ('formality','category','loafers','appropriate_for','dress_code','smart_casual',0.82,'global','Loafers are a versatile shoe that works well for smart-casual and business-casual dress codes.','soft'),
  ('formality','category','loafers','appropriate_for','dress_code','business_casual',0.82,'global','Loafers are a versatile shoe that works well for smart-casual and business-casual dress codes.','soft'),
  ('formality','category','dress shirt','appropriate_for','dress_code','business_casual',0.9,'global','A dress shirt is a reliable choice for business-casual and formal occasions.','soft'),
  ('formality','category','dress shirt','appropriate_for','dress_code','formal',0.9,'global','A dress shirt is a reliable choice for business-casual and formal occasions.','soft'),
  ('formality','category','chinos','appropriate_for','dress_code','smart_casual',0.85,'global','Chinos sit comfortably in smart-casual and business-casual dress codes.','soft'),
  ('formality','category','chinos','appropriate_for','dress_code','business_casual',0.85,'global','Chinos sit comfortably in smart-casual and business-casual dress codes.','soft'),
  ('formality','category','polo shirt','appropriate_for','dress_code','smart_casual',0.78,'global','A polo shirt reads polished enough for smart-casual and relaxed enough for casual.','soft'),
  ('formality','category','polo shirt','appropriate_for','dress_code','casual',0.78,'global','A polo shirt reads polished enough for smart-casual and relaxed enough for casual.','soft'),
  ('formality','category','evening dress','appropriate_for','dress_code','formal',0.92,'global','An evening dress is well-suited to formal and black-tie events.','soft'),
  ('formality','category','evening dress','appropriate_for','dress_code','black_tie',0.92,'global','An evening dress is well-suited to formal and black-tie events.','soft'),
  -- LAYERING (12 rows)
  ('layering','category','knitwear','layerable_with','category','coat',0.9,'global','Knitwear often layers well with coats in cooler weather.','soft'),
  ('layering','category','shirt','layerable_with','category','blazer',0.92,'global','A shirt under a blazer is a classic layering combination for structured looks.','soft'),
  ('layering','category','t-shirt','layerable_with','category','cardigan',0.85,'global','A t-shirt under a cardigan creates an easy layered casual look.','soft'),
  ('layering','category','turtleneck','layerable_with','category','coat',0.88,'global','A turtleneck under a coat adds warmth and a strong visual layer in cold weather.','soft'),
  ('layering','category','shirt','layerable_with','category','waistcoat',0.84,'global','A shirt under a waistcoat gives a smart, layered finish without a jacket.','soft'),
  ('layering','category','base-layer','layerable_with','category','puffer',0.93,'global','A base layer under a puffer is the most practical winter layering combination.','soft'),
  ('layering','category','tank','layerable_with','category','shirt',0.78,'global','A tank under an open shirt creates an effortless layered look.','soft'),
  ('layering','category','dress','layerable_with','category','denim jacket',0.8,'global','A dress with a denim jacket over it adds casual contrast and warmth.','soft'),
  ('layering','category','bodysuit','layerable_with','category','trousers',0.82,'global','A bodysuit tucked into trousers gives a clean, smooth layered silhouette.','soft'),
  ('layering','category','shirt','layerable_with','category','knitwear',0.86,'global','A collared shirt under a knit is a classic smart-casual layering move.','soft'),
  ('layering','category','vest','layerable_with','category','blazer',0.83,'global','A vest under a blazer adds texture and depth to a tailored look.','soft'),
  ('layering','category','turtleneck','layerable_with','category','blazer',0.87,'global','A turtleneck under a blazer creates a sleek modern alternative to a shirt and tie.','soft'),
  -- SILHOUETTE (8 rows)
  ('silhouette','category','wide_leg_trousers','pairs_with','category','fitted_top',0.85,'global','Wide-leg trousers usually balance well with a more fitted top.','soft'),
  ('silhouette','category','slim_fit_trousers','pairs_with','category','oversized_top',0.84,'global','Slim-fit trousers balance an oversized top by keeping the lower half streamlined.','soft'),
  ('silhouette','category','midi_skirt','pairs_with','category','fitted_top',0.83,'global','A midi skirt pairs well with a fitted top to keep the silhouette from reading bulky.','soft'),
  ('silhouette','category','cropped_jacket','pairs_with','category','high_waist_bottom',0.86,'global','A cropped jacket works best with a high-waist bottom that meets the hem cleanly.','soft'),
  ('silhouette','category','straight_leg_trousers','pairs_with','category','tucked_shirt',0.82,'global','A tucked shirt with straight-leg trousers creates a clean, elongated line.','soft'),
  ('silhouette','category','maxi_skirt','pairs_with','category','fitted_top',0.81,'global','A fitted top keeps the silhouette controlled when wearing a voluminous maxi skirt.','soft'),
  ('silhouette','category','fitted_dress','pairs_with','category','structured_outerwear',0.88,'global','A fitted dress reads polished under structured outerwear like a tailored coat.','soft'),
  ('silhouette','category','relaxed_trousers','pairs_with','category','structured_blazer',0.84,'global','Relaxed trousers balance a structured blazer by adding ease at the bottom.','soft'),
  -- MATERIALS (12 rows)
  ('material','material','linen','works_in_weather','weather','warm_sun',0.93,'global','Linen is highly breathable and one of the best fabrics for warm sunny weather.','soft'),
  ('material','material','wool','works_in_weather','weather','cold_rain',0.9,'global','Wool provides warmth and some moisture resistance in cold rainy conditions.','soft'),
  ('material','material','wool','works_in_weather','weather','cool_breeze',0.88,'global','Wool is well suited to cool breezy weather as a mid or outer layer.','soft'),
  ('material','material','cotton','works_in_weather','weather','mild_clear',0.85,'global','Cotton is a versatile breathable fabric that works well in mild clear conditions.','soft'),
  ('material','material','cotton','works_in_weather','weather','warm_sun',0.82,'global','Cotton breathes reasonably well in warm weather though linen is preferable.','soft'),
  ('material','material','cashmere','works_in_weather','weather','cool_breeze',0.9,'global','Cashmere is light enough not to overheat but warm enough for cool breezy weather.','soft'),
  ('material','material','cashmere','works_in_weather','weather','cold_rain',0.78,'global','Cashmere provides warmth in cold rain though it should be protected from moisture.','soft'),
  ('material','material','nylon','works_in_weather','weather','cold_rain',0.88,'global','Nylon and technical fabrics are water-resistant and reliable in cold rainy weather.','soft'),
  ('material','material','leather','avoid_layering_with','material','leather',0.85,'global','Layering leather on leather creates a tone-on-tone clash that reads heavy rather than intentional.','soft'),
  ('material','material','silk','avoid_layering_with','material','silk',0.8,'global','Silk on silk tends to slip and create static, making it a poor layering combination.','soft'),
  ('material','material','denim','texture_contrast_with','material','silk',0.82,'global','Denim and silk create a productive contrast between rough and refined textures.','soft'),
  ('material','material','tweed','texture_contrast_with','material','cotton',0.78,'global','Tweed and cotton pair well by contrasting structured texture against a clean base.','soft')
on conflict do nothing;

commit;
```

- [ ] **Step 2: Verify row counts in the SQL**

Count only insert value rows (lines starting with a quoted rule_type string), excluding the DELETE tuple block:

```bash
grep -c "^  ('[a-z]" supabase/migrations/004_seed_style_rules.sql
```

Expected: **112**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_seed_style_rules.sql
git commit -m "feat: migration 004 — add constraint_type, partial unique index, full rule seed"
```

---

## Task 16: Final verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all pass

- [ ] **Step 2: Run the TypeScript check**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: successful build

- [ ] **Step 4: Final commit if any loose files**

```bash
git status
```

If clean, no commit needed. If any files modified during verification, commit them:

```bash
git add -p
git commit -m "chore: final cleanup after knowledge graph expansion"
```
