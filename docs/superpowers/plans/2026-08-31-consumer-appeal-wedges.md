# Consumer Appeal Wedges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five consumer wedges — wear-tomorrow, owned-trend, neglected cost-per-wear, unlock score, and chip-only explanations — on top of the existing rule engine without adding a chatbot.

**Architecture:** Keep outfit logic in pure domain functions (`ranking.ts`, `today.ts`, `unlock.ts`) that wrap `generateOutfit`. UI only renders those payloads. No new tables. No LLM in the ranking path.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Vitest, existing Supabase services (`listWardrobeGarments`, `generateOutfit`, `getUserTrendMatches`, weather lookup).

**Spec:** `docs/superpowers/specs/2026-08-31-consumer-appeal-wedges-design.md`

## Global Constraints

- Structured rules over LLM-only outfit logic (PRD 3.1).
- Wardrobe and lookbook stay separate tables.
- Store trend signals, not publisher article bodies or images.
- Explainability is mandatory and machine-readable.
- Tests: `npx vitest run <file>` then `npx tsc --noEmit` after UI tasks.
- Do not invent schema; do not add chat UI.

---

## File map

| File | Responsibility |
| --- | --- |
| `lib/domain/outfits/ranking.ts` | `valueNeglect`, `costPerWearBoost`, recency penalty helpers |
| `lib/domain/outfits/today.ts` | `suggestTodayOutfit` |
| `lib/domain/outfits/unlock.ts` | combo count + unlock scoring |
| `lib/domain/outfits/generator.ts` | apply boosts, recency always, `mustIncludeGarmentIds` |
| `lib/domain/outfits/index.ts` | zod/types for today + unlock payloads |
| `components/reason-strip.tsx` | max-3 explanation chips |
| `components/today-outfit-card.tsx` | Closet/Planner hero |
| `app/wardrobe/(closet)/page.tsx` | load today + owned trend + unlock |
| `app/wardrobe/today-actions.ts` | save-to-tomorrow server action |
| `components/wardrobe-shop.tsx` | `neglected` sort + chip |
| `app/trends/page.tsx` | On you first; unlock count on missing pieces |
| `components/outfit-planner.tsx` | compact today card + action-first headline |

---

### Task 1: Cost-per-wear ranking helpers

**Files:**
- Create: `lib/domain/outfits/ranking.ts`
- Test: `lib/domain/outfits/__tests__/ranking.test.ts`

**Interfaces:**
- Consumes: `GarmentListItem` fields `purchase_price`, `wear_count`, `last_worn_at`
- Produces:

```ts
export function valueNeglect(garment: {
  purchase_price: number | null | undefined;
  wear_count: number;
}): number | null;

export function costPerWearBoost(garment: {
  purchase_price: number | null | undefined;
  wear_count: number;
}): number;

export function recencyPenalty(
  lastWornAt: string | null | undefined,
  nowMs: number,
  windowMs?: number
): number;
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { costPerWearBoost, recencyPenalty, valueNeglect } from "../ranking";

describe("valueNeglect", () => {
  it("is null when price is missing", () => {
    expect(valueNeglect({ purchase_price: null, wear_count: 0 })).toBeNull();
  });

  it("is purchase_price when never worn", () => {
    expect(valueNeglect({ purchase_price: 400, wear_count: 0 })).toBe(400);
  });

  it("divides by wear_count once worn", () => {
    expect(valueNeglect({ purchase_price: 400, wear_count: 4 })).toBe(100);
  });
});

describe("costPerWearBoost", () => {
  it("is 0 without a price", () => {
    expect(costPerWearBoost({ purchase_price: null, wear_count: 0 })).toBe(0);
  });

  it("boosts an expensive unworn piece more than a cheap weekly tee", () => {
    const blazer = costPerWearBoost({ purchase_price: 400, wear_count: 0 });
    const tee = costPerWearBoost({ purchase_price: 20, wear_count: 12 });
    expect(blazer).toBeGreaterThan(tee);
    expect(blazer).toBeLessThanOrEqual(1.5);
  });
});

describe("recencyPenalty", () => {
  it("penalizes wears inside 7 days", () => {
    const now = Date.parse("2026-08-31T00:00:00Z");
    expect(recencyPenalty("2026-08-29T00:00:00Z", now)).toBe(0.3);
    expect(recencyPenalty("2026-08-01T00:00:00Z", now)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/ranking.test.ts`
Expected: FAIL — cannot find module `../ranking`

- [ ] **Step 3: Write minimal implementation**

```ts
const RECENCY_PENALTY = 0.3;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function valueNeglect(garment: {
  purchase_price: number | null | undefined;
  wear_count: number;
}): number | null {
  if (garment.purchase_price == null) return null;
  return garment.purchase_price / Math.max(garment.wear_count, 1);
}

export function costPerWearBoost(garment: {
  purchase_price: number | null | undefined;
  wear_count: number;
}): number {
  const neglect = valueNeglect(garment);
  if (neglect == null) return 0;
  const logged = Math.log10(1 + neglect) * 0.35;
  const unusedBonus = garment.wear_count === 0 ? 0.25 : 0;
  return Math.min(1.5, logged + unusedBonus);
}

export function recencyPenalty(
  lastWornAt: string | null | undefined,
  nowMs: number,
  windowMs = RECENCY_WINDOW_MS
): number {
  if (!lastWornAt) return 0;
  const wornAt = Date.parse(lastWornAt);
  if (Number.isNaN(wornAt)) return 0;
  return nowMs - wornAt < windowMs ? RECENCY_PENALTY : 0;
}
```

- [ ] **Step 4: Run tests and make sure they pass**

Run: `npx vitest run lib/domain/outfits/__tests__/ranking.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/ranking.ts lib/domain/outfits/__tests__/ranking.test.ts
git commit -m "$(cat <<'EOF'
Add deterministic cost-per-wear and recency ranking helpers.

EOF
)"
```

---

### Task 2: Apply ranking inside generateOutfit

**Files:**
- Modify: `lib/domain/outfits/generator.ts` (`GeneratorInput`, scoring loop ~399–520)
- Modify: `lib/domain/outfits/__tests__/generator.test.ts`
- Re-export ranking from `lib/domain/outfits/index.ts` only if other modules need it; prefer importing `ranking.ts` directly.

**Interfaces:**
- Consumes: `costPerWearBoost`, `recencyPenalty` from Task 1
- Produces: updated `GeneratorInput`:

```ts
export type GeneratorInput = {
  mode: "plan" | "surprise" | "trend";
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  trendSignal: UserTrendMatchWithSignal | null;
  dress_code?: string;
  weather?: string;
  occasion?: string;
  mustIncludeGarmentIds?: string[];
  nowMs?: number;
};
```

When `mustIncludeGarmentIds` is set, after picking the best candidate per role, if a must-include garment is eligible and its role was filled by someone else, replace that role with the must-include garment (if it passed `applyHardFilters`). If its role is empty, insert it. If it failed hard filters, omit it and continue.

Always apply recency penalty (remove the `mode === "surprise"` guard). Always add `costPerWearBoost`.

Add an insight when a selected garment has `valueNeglect >= 100`:

```ts
{ key: "occasion", title: "Neglected value", body: `${title} is costing $${cost} per wear.`, tags: ["cost-per-wear"] }
```

Use existing `outfitInsightSchema` keys only (`palette` | `layering` | `weather` | `occasion`). Do not extend the enum in this task.

- [ ] **Step 1: Write the failing test** (append to generator tests, reuse `makeGarment` / `makeRule` already in that file)

```ts
it("prefers an expensive unworn blazer over a cheap frequently worn one in the same role", () => {
  const garments = [
    makeGarment({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      category: "blazer",
      purchase_price: 20,
      wear_count: 12,
      last_worn_at: "2026-08-30T00:00:00Z"
    }),
    makeGarment({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
      category: "blazer",
      purchase_price: 400,
      wear_count: 0
    })
  ];
  const result = generateOutfit({
    mode: "plan",
    garments,
    styleRules: [],
    trendSignal: null,
    nowMs: Date.parse("2026-08-31T00:00:00Z")
  });
  expect(result.garments.find((g) => g.role === "outerwear")?.id).toBe(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"
  );
});

it("keeps must-include garments that pass hard filters", () => {
  const garments = [
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt", title: "White shirt" }),
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "shirt", title: "Blue shirt" })
  ];
  const result = generateOutfit({
    mode: "trend",
    garments,
    styleRules: [],
    trendSignal: null,
    mustIncludeGarmentIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"]
  });
  expect(result.garments.map((g) => g.id)).toContain(
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/generator.test.ts`
Expected: FAIL on blazer id and/or must-include

- [ ] **Step 3: Write minimal implementation**

In the scored map:

```ts
const now = input.nowMs ?? Date.now();
let score = scoreGarment(g, expandedRules, ctx);
score += costPerWearBoost(g);
score -= recencyPenalty(g.last_worn_at, now);
```

After the role loop, apply must-include replacement as specified.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/domain/outfits/__tests__/generator.test.ts lib/domain/outfits/__tests__/ranking.test.ts`
Expected: PASS. Fix any existing surprise-mode tests that assumed recency was surprise-only — recency now always applies; update fixtures' `last_worn_at` rather than weakening the new behavior.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/generator.ts lib/domain/outfits/__tests__/generator.test.ts
git commit -m "$(cat <<'EOF'
Rank outfits with neglected value, recency, and must-include garments.

EOF
)"
```

---

### Task 3: suggestTodayOutfit

**Files:**
- Create: `lib/domain/outfits/today.ts`
- Test: `lib/domain/outfits/__tests__/today.test.ts`

**Interfaces:**
- Consumes: `generateOutfit` from Task 2
- Produces:

```ts
export type TodayOutfitInput = {
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  weather?: string;
  occasion?: string | null;
  dress_code?: string | null;
  recentOutfitGarmentIds?: string[];
  nowMs?: number;
};

export function suggestTodayOutfit(input: TodayOutfitInput): GeneratedOutfit;
```

`recentOutfitGarmentIds`: treat those ids as worn just now for recency by cloning garments and setting `last_worn_at` to `new Date(nowMs).toISOString()` before calling `generateOutfit`. Do not mutate the original array.

If after generation there is no top+bottom or dress, still return the result (UI handles emptiness). Do not throw.

- [ ] **Step 1: Write the failing test**

```ts
it("returns a plan-mode outfit using weather context", () => {
  const result = suggestTodayOutfit({
    garments: [
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "trouser" }),
      makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "loafer" })
    ],
    styleRules: [],
    weather: "mild_clear"
  });
  expect(result.garments.length).toBeGreaterThanOrEqual(2);
});

it("suppresses garments from recent saved outfits", () => {
  const shirtA = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt", title: "A" });
  const shirtB = makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "shirt", title: "B", purchase_price: 10, wear_count: 0 });
  const result = suggestTodayOutfit({
    garments: [shirtA, shirtB, makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "trouser" })],
    styleRules: [],
    recentOutfitGarmentIds: [shirtA.id as string],
    nowMs: Date.parse("2026-08-31T00:00:00Z")
  });
  expect(result.garments.find((g) => g.role === "top")?.id).toBe(shirtB.id);
});
```

Copy `makeGarment` into this test file (do not import a non-exported helper from the other test).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/today.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
export function suggestTodayOutfit(input: TodayOutfitInput): GeneratedOutfit {
  const nowMs = input.nowMs ?? Date.now();
  const recent = new Set(input.recentOutfitGarmentIds ?? []);
  const iso = new Date(nowMs).toISOString();
  const garments = input.garments.map((g) =>
    recent.has(g.id as string) ? { ...g, last_worn_at: iso } : g
  );
  return generateOutfit({
    mode: "plan",
    garments,
    styleRules: input.styleRules,
    trendSignal: null,
    weather: input.weather,
    occasion: input.occasion ?? undefined,
    dress_code: input.dress_code ?? undefined,
    nowMs
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/domain/outfits/__tests__/today.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/today.ts lib/domain/outfits/__tests__/today.test.ts
git commit -m "$(cat <<'EOF'
Add a weather-aware today outfit suggestion helper.

EOF
)"
```

---

### Task 4: Unlock score

**Files:**
- Create: `lib/domain/outfits/unlock.ts`
- Test: `lib/domain/outfits/__tests__/unlock.test.ts`

**Interfaces:**
- Consumes: `categoryToRole`, `applyHardFilters` from generator
- Produces:

```ts
export type UnlockCandidate = {
  id: string;
  label: string;
  source: "trend" | "lookbook";
  synthetic: Pick<GarmentListItem, "id" | "title" | "category" | "subcategory" | "primary_colour_family">;
};

export type UnlockScore = {
  id: string;
  label: string;
  source: "trend" | "lookbook";
  unlock_count: number;
  reasoning: string;
};

export function countRoleCompleteCombos(
  garments: GarmentListItem[],
  styleRules: StyleRuleListItem[],
  dressCode?: string
): number;

export function scoreUnlockCandidates(
  garments: GarmentListItem[],
  styleRules: StyleRuleListItem[],
  candidates: UnlockCandidate[],
  dressCode?: string
): UnlockScore[];
```

Enumeration rules from the spec: required sets are `dress+shoes` OR `top+bottom+shoes`. Optional roles are ignored for the count. Per role take at most 8 garments (highest `costPerWearBoost` then title). If product of list lengths > 400, still cap by the 8-per-role rule (8×8×8 = 512 → take 8×8×6 or reduce shoes first until ≤ 400).

`scoreUnlockCandidates` returns all candidates with `unlock_count > 0`, sorted desc, sliced to 3.

Reasoning string exactly:

`Adds ${unlock_count} outfit${unlock_count === 1 ? "" : "s"} by filling ${synthetic.category}.`

- [ ] **Step 1: Write the failing test**

```ts
it("counts zero combos without a complete set", () => {
  expect(
    countRoleCompleteCombos(
      [makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" })],
      []
    )
  ).toBe(0);
});

it("scores a missing bottom that pairs with existing tops and shoes", () => {
  const wardrobe = [
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "loafer" })
  ];
  const scores = scoreUnlockCandidates(wardrobe, [], [
    {
      id: "cand-1",
      label: "Navy trousers",
      source: "trend",
      synthetic: {
        id: "synthetic-1",
        title: "Navy trousers",
        category: "trouser",
        subcategory: null,
        primary_colour_family: "navy"
      }
    }
  ]);
  expect(scores[0]?.unlock_count).toBeGreaterThanOrEqual(1);
  expect(scores[0]?.reasoning).toContain("trouser");
});
```

Use a local `makeGarment` (same shape as generator tests). Synthetic must be spread into a full `GarmentListItem` inside `unlock.ts` with unused fields nulled.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/unlock.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement** `countRoleCompleteCombos` and `scoreUnlockCandidates` per the spec. Do not call `generateOutfit` inside the combo counter (too slow / wrong metric). Nested loops over role buckets only.

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/domain/outfits/__tests__/unlock.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/unlock.ts lib/domain/outfits/__tests__/unlock.test.ts
git commit -m "$(cat <<'EOF'
Score missing pieces by how many complete outfits they unlock.

EOF
)"
```

---

### Task 5: ReasonStrip

**Files:**
- Create: `components/reason-strip.tsx`
- Test: `components/__tests__/reason-strip.test.ts` (pure helper, not RTL unless already used)

**Interfaces:**
- Consumes: `GeneratedOutfit`
- Produces:

```ts
export type ReasonChip = { label: string };

export function chipsFromOutfit(outfit: GeneratedOutfit, extra?: string[]): ReasonChip[];

export function ReasonStrip(props: { chips: ReasonChip[] }): JSX.Element;
```

`chipsFromOutfit` takes at most: first weather insight title, first firedRule description truncated to 48 chars, first extra string, then stops at 3. Empty insights/rules yield fewer chips. Never invent copy.

- [ ] **Step 1: Write the failing test**

```ts
it("returns at most three chips and prefers weather then a fired rule", () => {
  const chips = chipsFromOutfit({
    garments: [],
    firedRules: [{ description: "Navy pairs with beige", garment_ids: [] }],
    insights: [{ key: "weather", title: "Mild clear", body: "", tags: [] }],
    explanation: null
  }, ["Unworn blazer"]);
  expect(chips.map((c) => c.label)).toEqual([
    "Mild clear",
    "Navy pairs with beige",
    "Unworn blazer"
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/__tests__/reason-strip.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement** helper + component using existing `pw-chip` class. No emoji. No chatbot CTA.

- [ ] **Step 4: Run tests**

Run: `npx vitest run components/__tests__/reason-strip.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/reason-strip.tsx components/__tests__/reason-strip.test.ts
git commit -m "$(cat <<'EOF'
Add a three-chip explanation strip for outfit reasons.

EOF
)"
```

---

### Task 6: Closet hero — today, owned trend, unlock

**Files:**
- Create: `lib/domain/outfits/appeal.ts` — assemble page payload (pure-ish; I/O stays in the page)
- Create: `app/wardrobe/today-actions.ts`
- Create: `components/today-outfit-card.tsx`
- Create: `components/owned-trend-card.tsx`
- Create: `components/unlock-card.tsx`
- Modify: `app/wardrobe/(closet)/page.tsx`
- Modify: `lib/domain/outfits/service.ts` only if saving tomorrow needs a helper already there (`saveOutfit` exists)

**Interfaces:**
- Consumes: Tasks 3–5, `listStyleRules`, `listUserTrendMatchesWithSignals`, `listSavedOutfits`, `listLookbookEntries`, weather via `resolveWeatherProvider` + existing local weather fetch used by planner (do not add a new provider)
- Produces: `saveTodayOutfitAction` calling `saveOutfit` with `planned_for` = tomorrow (local `YYYY-MM-DD`). If today local hour < 20, use today instead of tomorrow (same rule as spec).

Payload builder (keep fetch in the page, mapping in `appeal.ts`):

```ts
export function pickOwnedTrend(
  matches: UserTrendMatchWithSignal[]
): UserTrendMatchWithSignal | null; // exact first, else adjacent, else null

export function lookbookUnlockCandidates(
  entries: LookbookListItem[]
): UnlockCandidate[];
```

Trend unlock candidates: `missing_piece` matches → synthetic category from `normalized_attributes_json.category` or `label`.

Weather: if `preferred_location` is set, reuse planner’s batch lookup pattern from `app/api/weather/local/batch/route.ts` **or** pass `weather` as `null` and still generate (rules simply skip weather scores). Prefer calling existing `lib/domain/weather/service.ts` functions already used by the planner rather than duplicating fetch logic. If that requires a new exported helper, extract from the planner’s weather effect — do not copy-paste 200 lines into the page.

UI: Closet items page, above `WardrobeShop`, stack: TodayOutfitCard, OwnedTrendCard (if match), UnlockCard (if top unlock_count ≥ 3). Signed-out path unchanged (`AuthRequiredCard`).

TodayOutfitCard primary button: form action `saveTodayOutfitAction`. Secondary: link `/outfits?item=<firstGarmentId>`.

OwnedTrendCard: link `/outfits?mode=trend` is insufficient — pass `item` as first matched garment id. Later planner already opens generate dialog via `focusGarmentId`. Also pass trend via search param `trend=<uuid>` and wire Planner in Task 8.

- [ ] **Step 1: Write failing tests for `pickOwnedTrend` and `lookbookUnlockCandidates`** in `lib/domain/outfits/__tests__/appeal.test.ts`

```ts
it("prefers exact_match over adjacent_match", () => {
  const exact = { match_type: "exact_match", score: 0.5 } as UserTrendMatchWithSignal;
  const adjacent = { match_type: "adjacent_match", score: 0.9 } as UserTrendMatchWithSignal;
  expect(pickOwnedTrend([adjacent, exact])?.match_type).toBe("exact_match");
});
```

Use realistic fixture objects (copy fields from `lib/domain/trends/__tests__/matching.test.ts` as needed).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/outfits/__tests__/appeal.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement appeal helpers, cards, page load, save action**

`saveTodayOutfitAction` must call `revalidatePath("/wardrobe")`, `revalidatePath("/outfits")`, `revalidatePath("/calendar")`.

- [ ] **Step 4: Verify**

Run: `npx vitest run lib/domain/outfits/__tests__/appeal.test.ts && npx tsc --noEmit`
Browser: signed-in Closet shows hero or empty complete-set message; signed-out still auth card. Click Wear this and confirm calendar gets `planned_for`.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/appeal.ts lib/domain/outfits/__tests__/appeal.test.ts \
  app/wardrobe/today-actions.ts components/today-outfit-card.tsx \
  components/owned-trend-card.tsx components/unlock-card.tsx \
  app/wardrobe/\(closet\)/page.tsx
git commit -m "$(cat <<'EOF'
Surface today outfit, owned trends, and unlock score on Closet.

EOF
)"
```

---

### Task 7: Neglected sort and garment chips

**Files:**
- Modify: `components/wardrobe-shop.tsx` sort switch (~249) and sort `<select>` options (~598)
- Test: add cases if a shop sort helper can be extracted; otherwise extract:

```ts
export function compareNeglected(
  left: Pick<GarmentListItem, "purchase_price" | "wear_count">,
  right: Pick<GarmentListItem, "purchase_price" | "wear_count">
): number;
```

into `lib/domain/outfits/ranking.ts` (null prices sort last) and test it next to Task 1 tests.

Chip on card: if `wear_count === 0 && purchase_price != null`, show `Unworn · {currency}{price}` using existing chip class. Do not add emoji.

- [ ] **Step 1: Extend ranking tests**

```ts
it("sorts neglected priced items above unpriced", () => {
  const priced = { purchase_price: 400, wear_count: 0 };
  const unpriced = { purchase_price: null, wear_count: 0 };
  expect(compareNeglected(priced, unpriced)).toBeLessThan(0);
});
```

- [ ] **Step 2: Fail then implement `compareNeglected`** (desc valueNeglect; both null → 0)

- [ ] **Step 3: Wire `sortBy === "neglected"` and option label `Neglected value`**

Keep `cost_desc` as cost-per-wear; neglected is the new default-recommended sort only as an option, not a silent default.

- [ ] **Step 4: Run** `npx vitest run lib/domain/outfits/__tests__/ranking.test.ts && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/ranking.ts lib/domain/outfits/__tests__/ranking.test.ts components/wardrobe-shop.tsx
git commit -m "$(cat <<'EOF'
Sort and label neglected high-cost garments in the closet.

EOF
)"
```

---

### Task 8: Trends page + Planner quiet UX

**Files:**
- Modify: `app/trends/page.tsx` — render exact/adjacent (“On you”) before missing pieces; show `unlock_count` from Task 4 on missing-piece cards. Load unlock scores in `app/trends/actions.ts` `loadTrendsPageData`.
- Modify: `components/outfit-planner.tsx` — if `focusGarmentId` or new `searchParams.trend`, set generate dialog open (already partly done). Headline: when `days` has a generated outfit for today, kicker stays, h1 becomes `Tomorrow is already dressed.` (or `Today is already dressed.` before 20:00). Render `TodayOutfitCard` compact above the week grid using the same payload as Closet only if passed as optional prop `todayOutfit` — **do not re-fetch inside the client**. Pass from `app/outfits/page.tsx`.
- Modify: `app/outfits/page.tsx` to accept `trend?: string` and pass into planner; compute today outfit server-side (same helpers as Closet) so Closet and Planner stay consistent.
- Use `ReasonStrip` on `OutfitExplanationSummary` instead of long prose when chips exist.

No new chat. No “Ask AI”. Pro `explanation` string, if present, stays in a `<details>` labeled “Notes”, not as the primary UI.

- [ ] **Step 1: Add a unit test for grouping order** in `app/trends/__tests__/grouping.test.ts` if you extract:

```ts
export function trendSectionOrder(): Array<"exact_match" | "adjacent_match" | "styling_match" | "missing_piece"> {
  return ["exact_match", "adjacent_match", "styling_match", "missing_piece"];
}
```

Put that helper in `lib/domain/trends/matching.ts` or `app/trends/grouping.ts`. Trends page must iterate this order (it currently builds a `grouped` object — change iteration order to this array).

- [ ] **Step 2: Fail on wrong order if tests currently assume missing-piece first** — update assertions toward “On you” first.

- [ ] **Step 3: Implement UI copy and ReasonStrip wiring**

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Browser: Closet → Wear this → Calendar; Closet owned-trend → Planner generate dialog; Trends missing piece shows unlock count; Planner h1 changes when today is planned; no chat control added.

- [ ] **Step 5: Commit**

```bash
git add app/trends/page.tsx app/trends/actions.ts app/outfits/page.tsx \
  components/outfit-planner.tsx lib/domain/trends/matching.ts
git commit -m "$(cat <<'EOF'
Lead trends with owned matches and quiet planner explanations.

EOF
)"
```

---

## Self-review

- Spec wedges 1–5 each have tasks: 3+6 (tomorrow), 2+6+8 (owned trend), 1+2+7 (cost), 4+6+8 (unlock), 5+8 (quiet UX).
- No TBD placeholders. Signatures are named and reused.
- `mustIncludeGarmentIds` and `nowMs` are introduced in Task 2 and used in Tasks 3 and 6.
- Unlock does not use the LLM extraction path.

## Execution notes

Closet and Planner both need today-outfit data: compute once per page in server components; do not fetch from a client effect. If weather lookup fails, still suggest with `weather` omitted.
