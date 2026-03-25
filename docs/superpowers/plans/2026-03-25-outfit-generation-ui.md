# Outfit Generation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/outfits` page where users generate complete outfits from their wardrobe using a rules engine (free) or Claude hybrid (Pro), edit the result by swapping garments, and save to a persistent gallery.

**Architecture:** A Next.js server component page loads wardrobe, style rules, trend signals, and saved outfits then passes them to a client-side `OutfitGenerator` component. The rules engine (`generator.ts`) is a set of pure functions — no DB, no LLM — that scores garments against style rules and returns a ranked outfit. The service layer (`service.ts`) handles all Supabase reads and writes.

**Tech Stack:** Next.js 14 (App Router), Supabase, TypeScript, Zod, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/domain/outfits/index.ts` | Modify | Add new Zod schemas and types |
| `lib/domain/trends/index.ts` | Modify | Add `UserTrendMatchWithSignal` composite type |
| `lib/domain/outfits/generator.ts` | Create | Pure outfit generation engine — no DB, no LLM |
| `lib/domain/outfits/__tests__/generator.test.ts` | Create | Unit tests for generator |
| `lib/domain/outfits/service.ts` | Create | DB operations: generate (orchestration), save, list |
| `app/outfits/actions.ts` | Create | Server actions: generate, get swap candidates, save |
| `app/outfits/page.tsx` | Create | Server component — data loading, renders generator + gallery |
| `components/outfit-gallery.tsx` | Create | Saved outfits grid (server-renderable) |
| `components/outfit-generator.tsx` | Create | Client component — tabs, forms, result panel, swap dropdown |
| `app/wardrobe/page.tsx` | Modify | Add "Generate outfit" link on garment detail panel |

---

## Task 1: Extend domain types

**Files:**
- Modify: `lib/domain/outfits/index.ts`
- Modify: `lib/domain/trends/index.ts`

No tests for pure type/schema additions — TypeScript compilation is the verification.

- [ ] **Step 1: Add new schemas to `lib/domain/outfits/index.ts`**

Append to the end of the existing file (after the `OutfitItem` export):

```typescript
// Role enum re-export for use in generator
export const OUTFIT_ITEM_ROLES = [
  "top", "bottom", "dress", "outerwear",
  "shoes", "accessory", "bag", "jewellery", "other"
] as const;
export type OutfitItemRole = typeof OUTFIT_ITEM_ROLES[number];

// Garment as it appears in a result chip
export const outfitGarmentPreviewSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable().optional(),
  category: z.string(),
  role: z.enum(["top", "bottom", "dress", "outerwear", "shoes", "accessory", "bag", "jewellery", "other"]),
  preview_url: z.string().nullable().optional()
});
export type OutfitGarmentPreview = z.infer<typeof outfitGarmentPreviewSchema>;

// A fired rule — drives "Why this works" tags
export const firedRuleSchema = z.object({
  description: z.string(), // human-readable, e.g. "Navy and beige are analogous colours"
  garment_ids: z.array(z.string().uuid())
});
export type FiredRule = z.infer<typeof firedRuleSchema>;

// What the generator returns before saving
export const generatedOutfitSchema = z.object({
  garments: z.array(outfitGarmentPreviewSchema),
  firedRules: z.array(firedRuleSchema),
  explanation: z.string().nullable() // null on free tier; Claude prose on Pro
});
export type GeneratedOutfit = z.infer<typeof generatedOutfitSchema>;

// Input to generateOutfitAction
export const generateOutfitInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("plan"),
    occasion: z.string().trim().max(120).nullable().optional(),
    dress_code: z.string().trim().max(120).nullable().optional(),
    weather: z.string().trim().max(80).nullable().optional()
  }),
  z.object({ mode: z.literal("surprise") }),
  z.object({ mode: z.literal("trend"), trend_signal_id: z.string().uuid() })
]);
export type GenerateOutfitInput = z.infer<typeof generateOutfitInputSchema>;

// Input to saveOutfitAction
export const saveOutfitInputSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  dress_code: z.string().trim().max(120).nullable().optional(),
  weather_context_json: z.record(z.string(), z.unknown()).default({}),
  explanation: z.string().trim().max(4000).nullable().optional(),
  explanation_json: z.record(z.string(), z.unknown()).default({}),
  garments: z.array(z.object({
    garment_id: z.string().uuid(),
    role: z.enum(["top", "bottom", "dress", "outerwear", "shoes", "accessory", "bag", "jewellery", "other"])
  }))
});
export type SaveOutfitInput = z.infer<typeof saveOutfitInputSchema>;

// A saved outfit with its items joined for the gallery
export const outfitWithItemsSchema = outfitSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().optional(),
  items: z.array(outfitItemSchema.extend({
    id: z.string().uuid(),
    garment: z.object({
      id: z.string().uuid(),
      title: z.string().nullable().optional(),
      category: z.string(),
      preview_url: z.string().nullable().optional()
    })
  }))
});
export type OutfitWithItems = z.infer<typeof outfitWithItemsSchema>;
```

- [ ] **Step 2: Add `UserTrendMatchWithSignal` to `lib/domain/trends/index.ts`**

Append after the `UserTrendMatch` export (after line 75):

```typescript
export const userTrendMatchWithSignalSchema = userTrendMatchSchema.extend({
  trend_signal: trendSignalSchema
});
export type UserTrendMatchWithSignal = z.infer<typeof userTrendMatchWithSignalSchema>;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add lib/domain/outfits/index.ts lib/domain/trends/index.ts
git commit -m "feat: add outfit generation domain types"
```

---

## Task 2: Category-to-role mapper

**Files:**
- Create: `lib/domain/outfits/generator.ts`
- Create: `lib/domain/outfits/__tests__/generator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/domain/outfits/__tests__/generator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { categoryToRole } from "../generator";

describe("categoryToRole", () => {
  it("maps shirt to top", () => {
    expect(categoryToRole("shirt")).toBe("top");
  });
  it("maps Knitwear to top (case-insensitive)", () => {
    expect(categoryToRole("Knitwear")).toBe("top");
  });
  it("maps trousers to bottom", () => {
    expect(categoryToRole("wide-leg trousers")).toBe("bottom");
  });
  it("maps jeans to bottom", () => {
    expect(categoryToRole("jeans")).toBe("bottom");
  });
  it("maps dress to dress", () => {
    expect(categoryToRole("midi dress")).toBe("dress");
  });
  it("maps coat to outerwear", () => {
    expect(categoryToRole("wool coat")).toBe("outerwear");
  });
  it("maps blazer to outerwear", () => {
    expect(categoryToRole("blazer")).toBe("outerwear");
  });
  it("maps trainers to shoes", () => {
    expect(categoryToRole("trainers")).toBe("shoes");
  });
  it("maps loafers to shoes", () => {
    expect(categoryToRole("white loafers")).toBe("shoes");
  });
  it("maps tote bag to bag", () => {
    expect(categoryToRole("tote bag")).toBe("bag");
  });
  it("maps earrings to jewellery", () => {
    expect(categoryToRole("gold earrings")).toBe("jewellery");
  });
  it("maps unknown category to other", () => {
    expect(categoryToRole("mystery item")).toBe("other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/domain/outfits/__tests__/generator.test.ts
```

Expected: FAIL — "Cannot find module '../generator'"

- [ ] **Step 3: Implement `categoryToRole` in `generator.ts`**

Create `lib/domain/outfits/generator.ts`:

```typescript
import type { OutfitItemRole } from "@/lib/domain/outfits";

const ROLE_KEYWORDS: Array<[OutfitItemRole, string[]]> = [
  ["dress",     ["dress", "jumpsuit", "playsuit"]],
  ["top",       ["shirt", "blouse", "top", "tee", "t-shirt", "knitwear", "jumper", "sweater", "cardigan", "turtleneck", "tank", "bodysuit", "crop"]],
  ["bottom",    ["trouser", "jean", "skirt", "short", "chino", "legging", "pant"]],
  ["outerwear", ["coat", "jacket", "blazer", "waistcoat", "vest", "puffer", "trench", "anorak", "mac"]],
  ["shoes",     ["shoe", "boot", "trainer", "sandal", "loafer", "heel", "flat", "mule", "sneaker"]],
  ["bag",       ["bag", "handbag", "clutch", "tote", "backpack", "purse"]],
  ["accessory", ["scarf", "belt", "hat", "cap", "glove", "sunglasses", "tie", "watch"]],
  ["jewellery", ["necklace", "ring", "earring", "bracelet", "pendant", "chain"]],
];

export function categoryToRole(category: string): OutfitItemRole {
  const lower = category.toLowerCase();
  for (const [role, keywords] of ROLE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return role;
  }
  return "other";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/domain/outfits/__tests__/generator.test.ts
```

Expected: all 12 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/generator.ts lib/domain/outfits/__tests__/generator.test.ts
git commit -m "feat: add categoryToRole mapper"
```

---

## Task 3: Outfit generator — scoring engine

**Files:**
- Modify: `lib/domain/outfits/generator.ts`
- Modify: `lib/domain/outfits/__tests__/generator.test.ts`

The generator takes wardrobe garments + style rules + input, groups garments by role, scores them, selects the best candidate per role, and collects fired rules.

**Scoring:** A garment's score is the sum of weights of all active `soft` style rules that fire for it given the context. Hard constraint rules only filter (Task 2 already handles `categoryToRole`; hard filter is a separate pass).

- [ ] **Step 1: Write the failing tests**

Append to `lib/domain/outfits/__tests__/generator.test.ts`. **Important:** Move the new import statements to the top of the file (before the existing `categoryToRole` imports), not inline after the existing describe blocks — Vitest requires all imports at the top of the module.

```typescript
import {
  applyHardFilters,
  scoreGarment,
  generateOutfit,
  type GeneratorInput
} from "../generator";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";

// Minimal garment fixture helper
function makeGarment(overrides: Partial<GarmentListItem> & { id: string; category: string }): GarmentListItem {
  return {
    user_id: "user-1",
    title: null,
    description: null,
    brand: null,
    subcategory: null,
    pattern: null,
    material: null,
    size: null,
    fit: null,
    formality_level: null,
    seasonality: null,
    wardrobe_status: "active",
    purchase_price: null,
    purchase_currency: null,
    purchase_date: null,
    retailer: null,
    favourite_score: null,
    wear_count: 0,
    last_worn_at: null,
    cost_per_wear: null,
    extraction_metadata_json: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    primary_colour_family: null,
    primary_colour_hex: null,
    preview_url: null,
    images: [],
    ...overrides
  };
}

// Minimal style rule fixture helper
function makeRule(overrides: Partial<StyleRuleListItem> & {
  predicate: string;
  subject_value: string;
  object_value: string;
}): StyleRuleListItem {
  return {
    id: "rule-" + Math.random(),
    rule_type: "occasion_fit",
    subject_type: "category",
    object_type: "dress_code",
    weight: 0.8,
    rule_scope: "global",
    user_id: null,
    explanation: "",
    active: true,
    constraint_type: "soft",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides
  };
}

describe("applyHardFilters", () => {
  it("removes garments with avoid_with hard rule matching dress code", () => {
    const jeans = makeGarment({ id: "g1", category: "jeans" });
    const shirt = makeGarment({ id: "g2", category: "shirt" });
    const rule = makeRule({
      predicate: "avoid_with",
      subject_value: "jeans",
      object_value: "formal",
      constraint_type: "hard"
    });
    const result = applyHardFilters([jeans, shirt], [rule], "formal");
    expect(result.map(g => g.id)).toEqual(["g2"]);
  });

  it("does not filter when dress code is undefined", () => {
    const jeans = makeGarment({ id: "g1", category: "jeans" });
    const rule = makeRule({
      predicate: "avoid_with",
      subject_value: "jeans",
      object_value: "formal",
      constraint_type: "hard"
    });
    const result = applyHardFilters([jeans], [rule], undefined);
    expect(result).toHaveLength(1);
  });
});

describe("scoreGarment", () => {
  it("sums weights of firing soft rules for category match", () => {
    const chinos = makeGarment({ id: "g1", category: "chinos" });
    const rule = makeRule({
      predicate: "appropriate_for",
      subject_value: "chinos",
      object_value: "smart_casual",
      weight: 0.9,
      constraint_type: "soft"
    });
    const score = scoreGarment(chinos, [rule], { dress_code: "smart_casual" });
    expect(score).toBeCloseTo(0.9);
  });

  it("ignores hard constraint rules in scoring", () => {
    const jeans = makeGarment({ id: "g1", category: "jeans" });
    const rule = makeRule({
      predicate: "avoid_with",
      subject_value: "jeans",
      object_value: "formal",
      weight: 0.99,
      constraint_type: "hard"
    });
    const score = scoreGarment(jeans, [rule], { dress_code: "formal" });
    expect(score).toBe(0);
  });
});

describe("generateOutfit", () => {
  it("selects a garment for each role with matching garments", () => {
    const garments = [
      makeGarment({ id: "top-1",    category: "shirt" }),
      makeGarment({ id: "bottom-1", category: "chinos" }),
    ];
    const input: GeneratorInput = { mode: "surprise", garments, styleRules: [], trendSignal: null };
    const result = generateOutfit(input);
    const roles = result.garments.map(g => g.role);
    expect(roles).toContain("top");
    expect(roles).toContain("bottom");
  });

  it("applies recency penalty in surprise mode", () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    const staleDate  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const recentShirt = makeGarment({ id: "recent", category: "shirt", last_worn_at: recentDate });
    const staleShirt  = makeGarment({ id: "stale",  category: "shirt", last_worn_at: staleDate });
    const input: GeneratorInput = { mode: "surprise", garments: [recentShirt, staleShirt], styleRules: [], trendSignal: null };
    const result = generateOutfit(input);
    const topGarment = result.garments.find(g => g.role === "top");
    expect(topGarment?.id).toBe("stale");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/domain/outfits/__tests__/generator.test.ts
```

Expected: FAIL — "applyHardFilters is not exported from '../generator'"

- [ ] **Step 3: Implement `applyHardFilters`, `scoreGarment`, `generateOutfit`**

Append to `lib/domain/outfits/generator.ts` (after `categoryToRole`):

```typescript
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import type { GeneratedOutfit, FiredRule, OutfitGarmentPreview } from "@/lib/domain/outfits";

const OPTIONAL_ROLES: OutfitItemRole[] = ["outerwear", "shoes", "accessory", "bag", "jewellery"];
const OPTIONAL_ROLE_THRESHOLD = 0.2;
const RECENCY_PENALTY = 0.3;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type GeneratorInput = {
  mode: "plan" | "surprise" | "trend";
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  trendSignal: UserTrendMatchWithSignal | null;
  dress_code?: string;
  weather?: string;
  occasion?: string;
};

type ScoringContext = {
  dress_code?: string | null;
  weather?: string | null;
  occasion?: string | null;
};

/** Remove garments blocked by hard constraint rules for the given dress code. */
export function applyHardFilters(
  garments: GarmentListItem[],
  rules: StyleRuleListItem[],
  dress_code: string | undefined
): GarmentListItem[] {
  if (!dress_code) return garments;
  const hardAvoid = rules.filter(
    r => r.constraint_type === "hard" && r.predicate === "avoid_with" && r.object_value === dress_code
  );
  if (hardAvoid.length === 0) return garments;
  return garments.filter(g => {
    const cat = g.category.toLowerCase();
    return !hardAvoid.some(r => cat.includes(r.subject_value.toLowerCase()));
  });
}

/** Score a single garment against soft rules for the given context. */
export function scoreGarment(
  garment: GarmentListItem,
  rules: StyleRuleListItem[],
  ctx: ScoringContext
): number {
  const cat = garment.category.toLowerCase();
  let score = 0;
  for (const rule of rules) {
    if (rule.constraint_type !== "soft" || !rule.active) continue;
    if (!cat.includes(rule.subject_value.toLowerCase())) continue;
    if (rule.predicate === "appropriate_for" || rule.predicate === "occasion_fit") {
      if (ctx.dress_code && rule.object_value === ctx.dress_code) score += rule.weight;
      else if (ctx.occasion && rule.object_value === ctx.occasion) score += rule.weight;
    } else if (rule.predicate === "works_in_weather") {
      if (ctx.weather && rule.object_value === ctx.weather) score += rule.weight;
    } else if (rule.predicate === "works_in_season") {
      // Season matching is best-effort: season not in scope for this feature but rules exist
      score += rule.weight * 0.5;
    } else {
      // layerable_with, pairs_with, texture_contrast_with — add base weight
      score += rule.weight * 0.3;
    }
  }
  return score;
}

/** Apply trend boost: garments matching the trend signal's normalized_attributes get a multiplier. */
function applyTrendBoost(score: number, garment: GarmentListItem, signal: UserTrendMatchWithSignal): number {
  const attrs = signal.trend_signal.normalized_attributes_json as Record<string, unknown>;
  const cat = garment.category.toLowerCase();
  const category = typeof attrs["category"] === "string" ? attrs["category"].toLowerCase() : null;
  const requiredCats = Array.isArray(attrs["required_categories"])
    ? (attrs["required_categories"] as string[]).map(c => c.toLowerCase())
    : null;
  if (category && cat.includes(category)) return score * (1 + signal.score);
  if (requiredCats && requiredCats.some(c => cat.includes(c))) return score * (1 + signal.score * 0.5);
  return score;
}

/** Main entry point: generate an outfit from wardrobe + rules + input. */
export function generateOutfit(input: GeneratorInput): GeneratedOutfit {
  const { mode, garments, styleRules, trendSignal, dress_code, weather, occasion } = input;
  const ctx: ScoringContext = { dress_code, weather, occasion };

  // Hard filter
  const eligible = applyHardFilters(garments, styleRules, dress_code);

  // Group by role
  const byRole = new Map<OutfitItemRole, GarmentListItem[]>();
  for (const g of eligible) {
    const role = categoryToRole(g.category);
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(g);
  }

  const now = Date.now();
  const selectedGarments: OutfitGarmentPreview[] = [];
  const firedRules: FiredRule[] = [];

  for (const [role, candidates] of byRole) {
    if (candidates.length === 0) continue;

    // Score each candidate
    const scored = candidates.map(g => {
      let score = scoreGarment(g, styleRules, ctx);
      if (mode === "surprise" && g.last_worn_at) {
        const wornAt = new Date(g.last_worn_at).getTime();
        if (now - wornAt < RECENCY_WINDOW_MS) score -= RECENCY_PENALTY;
      }
      if (mode === "trend" && trendSignal) {
        score = applyTrendBoost(score, g, trendSignal);
      }
      return { garment: g, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Omit optional roles below threshold
    if (OPTIONAL_ROLES.includes(role) && best.score < OPTIONAL_ROLE_THRESHOLD) continue;

    const g = best.garment;
    selectedGarments.push({
      id: g.id,
      title: g.title ?? null,
      category: g.category,
      role,
      preview_url: (g as GarmentListItem & { preview_url?: string | null }).preview_url ?? null
    });

    // Collect fired rules for this garment
    const fired = styleRules.filter(r => {
      if (r.constraint_type !== "soft" || !r.active) return false;
      return g.category.toLowerCase().includes(r.subject_value.toLowerCase());
    });
    for (const r of fired) {
      firedRules.push({ description: r.explanation || r.predicate, garment_ids: [g.id] });
    }
  }

  return { garments: selectedGarments, firedRules, explanation: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/domain/outfits/__tests__/generator.test.ts
```

Expected: all tests pass

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add lib/domain/outfits/generator.ts lib/domain/outfits/__tests__/generator.test.ts
git commit -m "feat: add outfit generator rules engine"
```

---

## Task 4: Outfit service

**Files:**
- Create: `lib/domain/outfits/service.ts`

The service orchestrates the generator, reads the wardrobe + style rules from Supabase, handles the Pro path (stub for now — just calls generator), and writes outfits to DB.

- [ ] **Step 1: Create `lib/domain/outfits/service.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { generateOutfit } from "@/lib/domain/outfits/generator";
import {
  outfitWithItemsSchema,
  type GenerateOutfitInput,
  type GeneratedOutfit,
  type OutfitWithItems,
  type SaveOutfitInput
} from "@/lib/domain/outfits";
import {
  userTrendMatchWithSignalSchema,
  type UserTrendMatchWithSignal
} from "@/lib/domain/trends";
import type { TablesInsert } from "@/types/database";
import { z } from "zod";

type OutfitInsert = TablesInsert<"outfits">;
type OutfitItemInsert = TablesInsert<"outfit_items">;

export async function listUserTrendMatchesWithSignals(): Promise<UserTrendMatchWithSignal[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_trend_matches")
    .select("*, trend_signal:trend_signals(*)")
    .eq("user_id", user.id)
    .order("score", { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(userTrendMatchWithSignalSchema).parse(data ?? []);
}

export async function generateOutfitForUser(
  input: GenerateOutfitInput,
  isPro: boolean
): Promise<GeneratedOutfit> {
  const [garments, styleRules] = await Promise.all([
    listWardrobeGarments(),
    listStyleRules()
  ]);

  let trendSignal: UserTrendMatchWithSignal | null = null;
  if (input.mode === "trend") {
    const matches = await listUserTrendMatchesWithSignals();
    trendSignal = matches.find(m => m.trend_signal_id === input.trend_signal_id) ?? null;
  }

  const dress_code = input.mode === "plan" ? input.dress_code ?? undefined : undefined;
  const weather    = input.mode === "plan" ? input.weather    ?? undefined : undefined;
  const occasion   = input.mode === "plan" ? input.occasion   ?? undefined : undefined;

  // Free + Pro both run the rules engine.
  // Pro path: TODO — pass top 3 candidates per role to Claude. For now, same as free.
  const result = generateOutfit({
    mode: input.mode,
    garments,
    styleRules,
    trendSignal,
    dress_code,
    weather,
    occasion
  });

  // Pro: replace rule tags with Claude prose (stub — not yet wired)
  if (isPro) {
    // Future: call Claude here with top candidates
  }

  return result;
}

export async function saveOutfit(input: SaveOutfitInput): Promise<string> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const outfitInsert: OutfitInsert = {
    user_id: user.id,
    title: input.title ?? null,
    occasion: input.occasion ?? null,
    dress_code: input.dress_code ?? null,
    weather_context_json: input.weather_context_json,
    explanation: input.explanation ?? null,
    explanation_json: input.explanation_json,
    source_type: "generated"
  };

  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .insert(outfitInsert)
    .select("id")
    .single();
  if (outfitError) throw new Error(outfitError.message);

  const items: OutfitItemInsert[] = input.garments.map(g => ({
    outfit_id: outfit.id,
    garment_id: g.garment_id,
    role: g.role
  }));

  const { error: itemsError } = await supabase
    .from("outfit_items")
    .insert(items);
  if (itemsError) throw new Error(itemsError.message);

  return outfit.id;
}

export async function listSavedOutfits(): Promise<OutfitWithItems[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("outfits")
    .select(`
      id, user_id, title, occasion, dress_code, weather_context_json,
      explanation, explanation_json, source_type, created_at,
      items:outfit_items(
        id, outfit_id, garment_id, role, created_at,
        garment:garments(id, title, category, preview_url)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return z.array(outfitWithItemsSchema).parse(data ?? []);
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/domain/outfits/service.ts
git commit -m "feat: add outfit service (generate, save, list)"
```

---

## Task 5: Server actions

**Files:**
- Create: `app/outfits/actions.ts`

- [ ] **Step 1: Create `app/outfits/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import {
  generateOutfitInputSchema,
  saveOutfitInputSchema,
  type GeneratedOutfit
} from "@/lib/domain/outfits";
import {
  generateOutfitForUser,
  saveOutfit,
  listSavedOutfits
} from "@/lib/domain/outfits/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { categoryToRole } from "@/lib/domain/outfits/generator";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

/** Generate an outfit. `isPro` is false for this iteration. */
export async function generateOutfitAction(
  rawInput: unknown
): Promise<{ outfit: GeneratedOutfit } | { error: string }> {
  const parsed = generateOutfitInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.message };
  try {
    const outfit = await generateOutfitForUser(parsed.data, false);
    if (outfit.garments.length < 2) {
      return { error: "Not enough matching garments in your wardrobe. Try a different dress code or add more items." };
    }
    return { outfit };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed" };
  }
}

/** Return wardrobe garments in the same role as the given garment, excluding it. */
export async function getSwapCandidatesAction(
  role: string,
  excludeGarmentId: string
): Promise<GarmentListItem[]> {
  const garments = await listWardrobeGarments();
  return garments.filter(
    g => categoryToRole(g.category) === role && g.id !== excludeGarmentId
  );
}

/** Persist a generated outfit to the DB. */
export async function saveOutfitAction(
  rawInput: unknown
): Promise<{ id: string } | { error: string }> {
  const parsed = saveOutfitInputSchema.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.message };
  try {
    const id = await saveOutfit(parsed.data);
    revalidatePath("/outfits");
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/outfits/actions.ts
git commit -m "feat: add outfit server actions"
```

---

## Task 6: Gallery component

**Files:**
- Create: `components/outfit-gallery.tsx`

A server-renderable component. No client state needed.

- [ ] **Step 1: Create `components/outfit-gallery.tsx`**

```tsx
import type { OutfitWithItems } from "@/lib/domain/outfits";

interface OutfitGalleryProps {
  outfits: OutfitWithItems[];
}

function thumbnailSlots(items: OutfitWithItems["items"]): Array<OutfitWithItems["items"][number] | null> {
  // Slot order: top/dress → bottom → outerwear/shoes → remaining
  const priority: Array<string[]> = [
    ["top", "dress"],
    ["bottom"],
    ["outerwear", "shoes"],
    ["accessory", "bag", "jewellery", "other"]
  ];
  return priority.map(roles => items.find(i => roles.includes(i.role)) ?? null);
}

export function OutfitGallery({ outfits }: OutfitGalleryProps) {
  if (outfits.length === 0) {
    return (
      <p className="rounded-[1.25rem] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
        No saved outfits yet. Generate your first outfit above.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {outfits.map(outfit => {
        const slots = thumbnailSlots(outfit.items);
        return (
          <article
            key={outfit.id}
            className="rounded-[1.4rem] border border-[var(--line)] bg-white overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-0.5 bg-[var(--surface)] p-3">
              {slots.map((item, i) =>
                item ? (
                  <div
                    key={item.id}
                    className="aspect-square rounded-[0.6rem] bg-[var(--line)] overflow-hidden"
                  >
                    {item.garment.preview_url ? (
                      <img
                        src={item.garment.preview_url}
                        alt={item.garment.title ?? item.garment.category}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-content-center" />
                    )}
                  </div>
                ) : (
                  <div key={i} className="aspect-square rounded-[0.6rem] bg-[var(--surface)]" />
                )
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">
                {outfit.title ?? "Outfit"}
              </p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""} ·{" "}
                {new Date(outfit.created_at ?? "").toLocaleDateString()}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/outfit-gallery.tsx
git commit -m "feat: add outfit gallery component"
```

---

## Task 7: Generator client component

**Files:**
- Create: `components/outfit-generator.tsx`

This is the most complex component. Build it in three passes: tabs shell → form panels → result panel.

- [ ] **Step 1: Create the tabs shell**

Create `components/outfit-generator.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import type { GeneratedOutfit } from "@/lib/domain/outfits";
import {
  generateOutfitAction,
  getSwapCandidatesAction,
  saveOutfitAction
} from "@/app/outfits/actions";

type Tab = "plan" | "surprise" | "trend";

interface OutfitGeneratorProps {
  isPro: boolean;
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  trendSignals: UserTrendMatchWithSignal[];
}

export function OutfitGenerator({
  isPro,
  garments,
  styleRules,
  trendSignals
}: OutfitGeneratorProps) {
  const [activeTab, setActiveTab] = useState<Tab>("plan");
  const [pendingResult, setPendingResult] = useState<GeneratedOutfit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plan it form state
  const [occasion, setOccasion] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [weather, setWeather] = useState("");

  // Trend form state
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const DRESS_CODE_OPTIONS = ["Any", "Casual", "Smart casual", "Business casual", "Formal", "Black tie"];
  const WEATHER_OPTIONS = ["Any", "Warm sun", "Cool breeze", "Cold rain", "Mild clear"];
  const DRESS_CODE_VALUES: Record<string, string> = {
    "Any": "", "Casual": "casual", "Smart casual": "smart_casual",
    "Business casual": "business_casual", "Formal": "formal", "Black tie": "black_tie"
  };
  const WEATHER_VALUES: Record<string, string> = {
    "Any": "", "Warm sun": "warm_sun", "Cool breeze": "cool_breeze",
    "Cold rain": "cold_rain", "Mild clear": "mild_clear"
  };

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setPendingResult(null);

    let input: unknown;
    if (activeTab === "plan") {
      input = {
        mode: "plan",
        occasion: occasion || null,
        dress_code: DRESS_CODE_VALUES[dressCode] || null,
        weather: WEATHER_VALUES[weather] || null
      };
    } else if (activeTab === "surprise") {
      input = { mode: "surprise" };
    } else {
      if (!selectedSignalId) { setError("Select a trend signal first."); setIsGenerating(false); return; }
      input = { mode: "trend", trend_signal_id: selectedSignalId };
    }

    const result = await generateOutfitAction(input);
    if ("error" in result) {
      setError(result.error);
    } else {
      setPendingResult(result.outfit);
    }
    setIsGenerating(false);
  }

  async function handleSave() {
    if (!pendingResult) return;
    let title = "";
    let occasion_val: string | null = null;
    let dress_code_val: string | null = null;
    let weather_ctx: Record<string, unknown> = {};

    if (activeTab === "plan") {
      title = [occasion, dressCode].filter(Boolean).join(", ") || "Outfit";
      occasion_val = occasion || null;
      dress_code_val = DRESS_CODE_VALUES[dressCode] || null;
      if (weather) weather_ctx = { weather: WEATHER_VALUES[weather] };
    } else if (activeTab === "surprise") {
      title = `Outfit — ${new Date().toLocaleDateString()}`;
    } else {
      const signal = trendSignals.find(s => s.trend_signal_id === selectedSignalId);
      title = signal?.trend_signal.label ?? "Trend outfit";
    }

    const result = await saveOutfitAction({
      title,
      occasion: occasion_val,
      dress_code: dress_code_val,
      weather_context_json: weather_ctx,
      explanation: pendingResult.explanation,
      explanation_json: { rules: pendingResult.firedRules },
      garments: pendingResult.garments.map(g => ({ garment_id: g.id, role: g.role }))
    });

    if ("error" in result) {
      setError(result.error);
    } else {
      setPendingResult(null);
      setOccasion(""); setDressCode(""); setWeather(""); setSelectedSignalId(null);
    }
  }

  function authorityLabel(score: number | null | undefined): string {
    if (score == null) return "";
    if (score < 0.5) return "low authority";
    if (score < 0.8) return "medium authority";
    return "high authority";
  }

  const MATCH_TYPE_LABEL: Record<string, string> = {
    exact_match: "exact match",
    adjacent_match: "adjacent",
    styling_match: "adjacent",
    missing_piece: "missing piece"
  };

  return (
    <div className="rounded-[1.75rem] border border-[var(--line)] bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-5 pt-4 pb-0 border-b border-[var(--line)]">
        {(["plan", "surprise", "trend"] as Tab[]).map(tab => {
          const labels = { plan: "Plan it", surprise: "Surprise Me", trend: "Trend" };
          const isLocked = !isPro && tab !== "plan";
          return (
            <button
              key={tab}
              onClick={() => !isLocked && setActiveTab(tab)}
              className={`
                px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors
                ${activeTab === tab
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)]"}
                ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:text-[var(--foreground)]"}
              `}
            >
              {labels[tab]}
              {isLocked && (
                <span className="ml-1.5 text-[9px] font-semibold tracking-wide bg-[#e8e0d0] text-[#a08050] px-1.5 py-0.5 rounded">
                  PRO
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto pb-2 text-[10px] text-[var(--muted)]">
          {isPro ? "Pro" : "Free tier"}
        </div>
      </div>

      {/* Form panels */}
      <div className="p-5">
        {activeTab === "plan" && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1.5">Occasion</label>
              <input
                type="text"
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
                placeholder="dinner, work…"
                className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1.5">Dress Code</label>
              <select
                value={dressCode}
                onChange={e => setDressCode(e.target.value)}
                className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--foreground)]"
              >
                {DRESS_CODE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1.5">Weather</label>
              <select
                value={weather}
                onChange={e => setWeather(e.target.value)}
                className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--foreground)]"
              >
                {WEATHER_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === "surprise" && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">✦</div>
            <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Surprise me</p>
            <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
              Pick a complete outfit from your wardrobe using your style rules — no input needed.
            </p>
          </div>
        )}

        {activeTab === "trend" && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2">Pick a trend signal</p>
            {trendSignals.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No active trend signals yet — visit the Trends page to run a match.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {trendSignals.map(match => (
                  <button
                    key={match.trend_signal_id}
                    onClick={() => setSelectedSignalId(match.trend_signal_id)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
                      ${selectedSignalId === match.trend_signal_id
                        ? "border-[var(--foreground)] bg-[var(--surface)]"
                        : "border-[var(--line)] bg-white hover:bg-[var(--surface)]"}
                    `}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        selectedSignalId === match.trend_signal_id
                          ? "bg-[var(--foreground)]"
                          : "bg-[var(--line)]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {match.trend_signal.label}
                      </p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        {match.trend_signal.trend_type} · {match.trend_signal.source_count} sources · {authorityLabel(match.trend_signal.authority_score)}
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded flex-shrink-0">
                      {MATCH_TYPE_LABEL[match.match_type] ?? match.match_type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-10 bg-[var(--foreground)] text-white rounded-xl text-sm font-medium disabled:opacity-60"
        >
          {isGenerating
            ? "Generating…"
            : activeTab === "trend"
            ? "Generate outfit around this trend"
            : "Generate outfit"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Result panel */}
      {pendingResult && (
        <div className="border-t border-[var(--line)] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Generated outfit</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingResult(null)}
                className="px-3 py-1.5 text-xs border border-[var(--line)] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-xs bg-[var(--foreground)] text-white rounded-lg"
              >
                Save outfit
              </button>
            </div>
          </div>

          {/* Garment chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {pendingResult.garments.map(g => (
              <SwapChip
                key={g.id}
                garment={g}
                onSwap={(newGarment) => {
                  // Replace the swapped garment, then re-run the rules engine
                  // client-side using the in-memory garments + styleRules props.
                  // No server round-trip. No Claude call — always shows rule tags after swap.
                  const updatedGarments = pendingResult.garments.map(
                    x => x.id === g.id ? { ...newGarment, role: g.role } : x
                  );
                  // Re-collect fired rules for the new garment set
                  const newFiredRules = updatedGarments.flatMap(ug => {
                    const fullGarment = garments.find(wg => wg.id === ug.id);
                    if (!fullGarment) return [];
                    return styleRules
                      .filter(r => r.constraint_type === "soft" && r.active &&
                        fullGarment.category.toLowerCase().includes(r.subject_value.toLowerCase()))
                      .map(r => ({ description: r.explanation || r.predicate, garment_ids: [ug.id] }));
                  });
                  setPendingResult({
                    garments: updatedGarments,
                    firedRules: newFiredRules,
                    explanation: null // Always rule tags after swap, even on Pro
                  });
                }}
              />
            ))}
          </div>

          {/* Why this works */}
          {pendingResult.explanation ? (
            <p className="text-sm text-[var(--muted)]">{pendingResult.explanation}</p>
          ) : pendingResult.firedRules.length > 0 ? (
            <div className="bg-[var(--surface)] rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Why this works</p>
              <div className="flex flex-wrap gap-1.5">
                {pendingResult.firedRules.map((rule, i) => (
                  <span key={i} className="text-[10px] bg-white border border-[var(--line)] rounded px-2 py-1 text-[var(--muted)]">
                    {rule.description}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---- Swap chip sub-component ----

import type { OutfitGarmentPreview } from "@/lib/domain/outfits";

interface SwapChipProps {
  garment: OutfitGarmentPreview;
  onSwap: (newGarment: OutfitGarmentPreview) => void;
}

function SwapChip({ garment, onSwap }: SwapChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [candidates, setCandidates] = useState<GarmentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function openDropdown() {
    setIsOpen(true);
    if (candidates.length === 0) {
      setIsLoading(true);
      const results = await getSwapCandidatesAction(garment.role, garment.id);
      setCandidates(results);
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-0 border border-[var(--line)] rounded-xl bg-white overflow-hidden">
        <div className="w-11 h-11 bg-[var(--surface)] flex-shrink-0">
          {garment.preview_url && (
            <img src={garment.preview_url} alt={garment.title ?? garment.category} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="px-2.5">
          <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">{garment.role}</p>
          <p className="text-xs font-medium text-[var(--foreground)]">{garment.title ?? garment.category}</p>
        </div>
        <button
          onClick={openDropdown}
          className="px-2 text-[var(--muted)] hover:text-[var(--foreground)] text-base"
          title="Swap garment"
        >
          ⇄
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-56 bg-white border border-[var(--line)] rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {isLoading && <p className="text-xs text-[var(--muted)] px-3 py-2">Loading…</p>}
            {!isLoading && candidates.length === 0 && (
              <p className="text-xs text-[var(--muted)] px-3 py-2">No other options in this role.</p>
            )}
            {candidates.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  onSwap({ id: c.id, title: c.title ?? null, category: c.category, role: garment.role, preview_url: (c as GarmentListItem & { preview_url?: string | null }).preview_url ?? null });
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface)]"
              >
                <div className="w-8 h-8 rounded bg-[var(--surface)] flex-shrink-0 overflow-hidden">
                  {(c as GarmentListItem & { preview_url?: string | null }).preview_url && (
                    <img
                      src={(c as GarmentListItem & { preview_url?: string | null }).preview_url!}
                      alt={c.title ?? c.category}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">{c.title ?? c.category}</p>
                  <p className="text-[10px] text-[var(--muted)] truncate">{c.category}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add components/outfit-generator.tsx
git commit -m "feat: add outfit generator client component"
```

---

## Task 8: Page

**Files:**
- Create: `app/outfits/page.tsx`

- [ ] **Step 1: Create `app/outfits/page.tsx`**

```tsx
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import {
  listSavedOutfits,
  listUserTrendMatchesWithSignals
} from "@/lib/domain/outfits/service";
import { OutfitGenerator } from "@/components/outfit-generator";
import { OutfitGallery } from "@/components/outfit-gallery";

export default async function OutfitsPage() {
  try {
    const [garments, styleRules, trendSignals, savedOutfits] = await Promise.all([
      listWardrobeGarments(),
      listStyleRules(),
      listUserTrendMatchesWithSignals(),
      listSavedOutfits()
    ]);

    // isPro: hardcoded false for this iteration
    const isPro = false;

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted)]">Outfits</p>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold">Your Outfits</h1>
            <span className="text-sm text-[var(--muted)]">{savedOutfits.length} saved</span>
          </div>
        </div>

        <OutfitGenerator
          isPro={isPro}
          garments={garments}
          styleRules={styleRules}
          trendSignals={trendSignals}
        />

        <section>
          <h2 className="text-lg font-semibold mb-4">Saved Outfits</h2>
          <OutfitGallery outfits={savedOutfits} />
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/outfits"
          title="Sign in to use the outfit generator."
          description="Outfits are user-owned records protected by RLS and require an authenticated Supabase session."
        />
      );
    }
    throw error;
  }
}
```

- [ ] **Step 2: Add `/outfits` to the nav**

In `app/layout.tsx` (or wherever the nav links are defined), add a link to `/outfits` alongside the existing wardrobe/lookbook links. Check the existing nav structure first with `Read app/layout.tsx`.

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/outfits/page.tsx app/layout.tsx
git commit -m "feat: add /outfits page"
```

---

## Task 9: Wardrobe entry point

**Files:**
- Modify: `app/wardrobe/page.tsx` or `components/wardrobe-shop.tsx`

Add a "Generate outfit" link on the garment detail panel that navigates to `/outfits?mode=plan&item=<garmentId>`. Check `components/wardrobe-shop.tsx` to find where the garment detail panel is rendered.

- [ ] **Step 1: Read `components/wardrobe-shop.tsx` to find the garment detail panel**

```bash
# Use the Read tool to find where garment detail is rendered
```

- [ ] **Step 2: Add the entry point link**

In the garment detail section, add a link (use Next.js `<Link>`):

```tsx
import Link from "next/link";

// Inside the garment detail panel, after existing actions:
<Link
  href={`/outfits?mode=plan&item=${activeGarment.id}`}
  className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
>
  Generate outfit with this →
</Link>
```

- [ ] **Step 3: Compile check + full test suite**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add components/wardrobe-shop.tsx
git commit -m "feat: add generate outfit entry point on wardrobe garment detail"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — no type errors
- [ ] Run `npx vitest run` — all tests pass
- [ ] Navigate to `/outfits`, generate a Plan it outfit, swap one garment, save — verify it appears in the gallery
- [ ] Confirm free tier shows PRO badge on Surprise Me and Trend tabs
