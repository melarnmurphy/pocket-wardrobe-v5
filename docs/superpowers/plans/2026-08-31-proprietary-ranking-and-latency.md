# Proprietary Ranking and Perceived-Instant Closet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-number outfit ranking with a silent two-score model (style inclusion vs rotation/idle-capital), keep shoes on complete looks, and paint Closet without waiting on unlock enumeration.

**Architecture:** Pure helpers in `ranking.ts` compute `rankingDelta`. `generateOutfit` omits optional roles using `rulesScore` only, then sorts survivors by `rulesScore + rankingDelta - recencyPenalty`. Closet splits unlock scoring into a Suspense child that reuses `react.cache` list functions. No UI copy names the algorithm.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, existing wardrobe/style-rule/lookbook services.

**Spec:** `docs/superpowers/specs/2026-08-31-proprietary-ranking-and-latency-design.md`

## Global Constraints

- No chat UI, no LLM ranking, no schema invention, no in-app “proprietary” / index badges.
- Displayed cost-per-wear stays `purchase_price / max(wear_count, 1)`; closet `neglected` sort still uses `valueNeglect`.
- If `purchase_price` is null: `I = 0`, rotation `R` still applies (never-worn unpriced items rotate). Ignore the spec line that says null price ⇒ `rankingDelta = 0`.
- Constants: `λ = 0.5`, `α = 0.35`, `β = 0.45`, `Δ_max = 1.2`. Recency penalty `0.3` / 7 days subtracts from ranking score only.
- `rankingDelta = Δ_max * (1 - exp(-(R + I)))` with `R = α / (1 + W)` and `I = β * log10(1 + P / (W + λ))` when `P != null`.
- Shoes are not optional-role-omitted. Completeness remains dress+shoes or top+bottom+shoes.
- Do not stage leftover pipeline/atelier/ingestion dirt unless a task file is already among them.
- Tests: `npx vitest run <files>` then `npx tsc --noEmit` after generator/UI tasks.

---

## File map

| File | Responsibility |
| --- | --- |
| `lib/domain/outfits/ranking.ts` | `rankingDelta` (replaces `costPerWearBoost`); keep `valueNeglect`, `compareNeglected`, `recencyPenalty` |
| `lib/domain/outfits/__tests__/ranking.test.ts` | Pin inequalities and null-price rotation |
| `lib/domain/outfits/generator.ts` | Filter optional roles on `rulesScore`, then sort by ranking score; shoes not in `OPTIONAL_ROLES` |
| `lib/domain/outfits/unlock.ts` | Sample-sort with `rankingDelta` |
| `PRD.md` | Internal two-score clause; displayed CPW vs ranking transform |
| `app/wardrobe/(closet)/closet-unlock-section.tsx` | Async unlock card |
| `app/wardrobe/(closet)/page.tsx` | Suspense around unlock; no `scoreUnlockCandidates` on critical path |
| `lib/domain/wardrobe/service.ts` | `cache()` on `listWardrobeGarments` |
| `lib/domain/style-rules/service.ts` | `cache()` on `listStyleRules` |
| `lib/domain/lookbook/service.ts` | `cache()` on `listLookbookEntries` |
| `lib/domain/outfits/service.ts` | `cache()` on `listUserTrendMatchesWithSignals` and `listSavedOutfits` |

---

### Task 1: rankingDelta helper

**Files:**
- Modify: `lib/domain/outfits/ranking.ts`
- Modify: `lib/domain/outfits/__tests__/ranking.test.ts`
- Modify: `lib/domain/outfits/unlock.ts` (import rename only)
- Modify: `PRD.md` sections 12.3 and 14.1

**Interfaces:**
- Consumes: `{ purchase_price?: number | null; wear_count: number }`
- Produces:

```ts
export function rankingDelta(garment: {
  purchase_price?: number | null;
  wear_count: number;
}): number;
```

Remove `costPerWearBoost`. Do not add a re-export alias.

File-level comment in `ranking.ts` (not user-facing): these constants and `rankingDelta` are internal ranking IP; do not surface names or values in UI.

- [ ] **Step 1: Write failing tests** — replace the `costPerWearBoost` describe with:

```ts
describe("rankingDelta", () => {
  it("rotates never-worn unpriced items", () => {
    expect(rankingDelta({ purchase_price: null, wear_count: 0 })).toBeGreaterThan(0);
  });

  it("ranks never-worn 400 above never-worn 40", () => {
    const expensive = rankingDelta({ purchase_price: 400, wear_count: 0 });
    const cheap = rankingDelta({ purchase_price: 40, wear_count: 0 });
    expect(expensive).toBeGreaterThan(cheap);
    expect(expensive).toBeLessThanOrEqual(1.2);
  });

  it("lets never-worn 40 beat 400 worn 20 times", () => {
    const unusedCheap = rankingDelta({ purchase_price: 40, wear_count: 0 });
    const overwornLuxury = rankingDelta({ purchase_price: 400, wear_count: 20 });
    expect(unusedCheap).toBeGreaterThan(overwornLuxury);
  });
});
```

Keep existing `valueNeglect`, `recencyPenalty`, and `compareNeglected` tests.

- [ ] **Step 2: Run** `npx vitest run lib/domain/outfits/__tests__/ranking.test.ts`

Expected: FAIL (`rankingDelta` is not a function / `costPerWearBoost` leftover).

- [ ] **Step 3: Implement**

```ts
const WEAR_PRIOR = 0.5;
const ROTATION_ALPHA = 0.35;
const IDLE_BETA = 0.45;
const DELTA_MAX = 1.2;

export function rankingDelta(garment: NeglectGarment): number {
  const wears = garment.wear_count;
  const rotation = ROTATION_ALPHA / (1 + wears);
  const price = garment.purchase_price;
  const idle =
    price == null ? 0 : IDLE_BETA * Math.log10(1 + price / (wears + WEAR_PRIOR));
  return DELTA_MAX * (1 - Math.exp(-(rotation + idle)));
}
```

In `unlock.ts` `compareForRoleSample`, use `rankingDelta` in place of `costPerWearBoost`.

PRD 12.3 after the example list, add:

```
Outfit ranking uses an internal two-score model: inclusion from style rules, then a rotation and idle-capital delta. Those formulas are proprietary. The product must not surface algorithm names or index values in the UI.
```

PRD 14.1 after the `cost_per_wear` formula, add:

```
Displayed cost per wear remains purchase_price / max(wear_count, 1). Outfit ranking may use a different internal transform; that transform is not shown to users.
```

- [ ] **Step 4: Run** `npx vitest run lib/domain/outfits/__tests__/ranking.test.ts lib/domain/outfits/__tests__/unlock.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit** only ranking, unlock import, ranking tests, PRD.

```bash
git add lib/domain/outfits/ranking.ts lib/domain/outfits/__tests__/ranking.test.ts \
  lib/domain/outfits/unlock.ts PRD.md
git commit -m "$(cat <<'EOF'
Replace cost-per-wear boost with a saturating rotation and idle-capital delta.

EOF
)"
```

---

### Task 2: Generator omit-then-rank and required shoes

**Files:**
- Modify: `lib/domain/outfits/generator.ts` (`OPTIONAL_ROLES` ~393, scoring loop ~560–584)
- Modify: `lib/domain/outfits/__tests__/generator.test.ts`

**Interfaces:**
- Consumes: `rankingDelta`, `recencyPenalty` from Task 1
- Produces: optional roles omitted using `rulesScore` **before** picking a winner; shoes always selected if any candidate passed hard filters

`OPTIONAL_ROLES` must be `["outerwear", "accessory", "bag", "jewellery"]` — no `shoes`.

Scoring loop (replace the current map/sort/omit-on-best):

```ts
const scored = candidates.map((g) => {
  const rulesScore = scoreGarment(g, expandedRules, ctx);
  let rankingScore = rulesScore + rankingDelta(g) - recencyPenalty(g.last_worn_at, now);
  if (mode === "trend" && trendSignal) {
    rankingScore = applyTrendBoost(rankingScore, g, trendSignal);
  }
  return { garment: g, rankingScore, rulesScore };
});

const pool =
  OPTIONAL_ROLES.includes(role)
    ? scored.filter(
        (row) =>
          row.rulesScore >= OPTIONAL_ROLE_THRESHOLD ||
          (role === "outerwear" && isLayeringGarment(row.garment))
      )
    : scored;
if (pool.length === 0) continue;
pool.sort((a, b) => b.rankingScore - a.rankingScore);
const best = pool[0];
```

Keep the existing belt test (`does not promote optional accessories...`). Add:

```ts
it("includes shoes that pass hard filters even with zero rule score", () => {
  const garments = [
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", category: "shirt" }),
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", category: "trouser" }),
    makeGarment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", category: "loafer" })
  ];
  const result = generateOutfit({
    mode: "plan",
    garments,
    styleRules: [],
    trendSignal: null
  });
  expect(result.garments.map((g) => g.role)).toEqual(
    expect.arrayContaining(["top", "bottom", "shoes"])
  );
});
```

- [ ] **Step 1: Add the shoes test (and keep the belt test)**
- [ ] **Step 2: Run** `npx vitest run lib/domain/outfits/__tests__/generator.test.ts`

Expected: shoes test FAIL (loafers omitted as optional).

- [ ] **Step 3: Implement the pool filter + remove shoes from `OPTIONAL_ROLES`; import `rankingDelta` instead of `costPerWearBoost`**
- [ ] **Step 4: Run** `npx vitest run lib/domain/outfits/__tests__/generator.test.ts && npx tsc --noEmit`

Expected: PASS. No new insight copy mentioning delta/λ/index.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/outfits/generator.ts lib/domain/outfits/__tests__/generator.test.ts
git commit -m "$(cat <<'EOF'
Omit optional roles on rule score and always fill shoes.

EOF
)"
```

---

### Task 3: Closet unlock off the critical path

**Files:**
- Create: `app/wardrobe/(closet)/closet-unlock-section.tsx`
- Modify: `app/wardrobe/(closet)/page.tsx` — remove unlock scoring from the page body; wrap `<Suspense fallback={null}>` around the new section
- Modify: wrap these list functions with `react.cache` so the child does not double-hit the database in the same request:
  - `listWardrobeGarments` in `lib/domain/wardrobe/service.ts`
  - `listStyleRules` in `lib/domain/style-rules/service.ts`
  - `listLookbookEntries` in `lib/domain/lookbook/service.ts`
  - `listUserTrendMatchesWithSignals` and `listSavedOutfits` in `lib/domain/outfits/service.ts`

**Interfaces:**
- Consumes: `scoreUnlockCandidates`, `trendUnlockCandidates`, `lookbookUnlockCandidates`, `UnlockCard`
- Produces: Closet first HTML includes shop + today + owned trend without waiting on combo enumeration

```tsx
import { Suspense } from "react";
// in page.tsx hero column:
<TodayOutfitCard outfit={todayOutfit} />
{ownedTrend ? <OwnedTrendCard match={ownedTrend} /> : null}
<Suspense fallback={null}>
  <ClosetUnlockSection />
</Suspense>
```

`closet-unlock-section.tsx`:

```tsx
import { listLookbookEntries } from "@/lib/domain/lookbook/service";
import {
  lookbookUnlockCandidates,
  trendUnlockCandidates
} from "@/lib/domain/outfits/appeal";
import { listUserTrendMatchesWithSignals } from "@/lib/domain/outfits/service";
import { scoreUnlockCandidates } from "@/lib/domain/outfits/unlock";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { UnlockCard } from "@/components/unlock-card";

export async function ClosetUnlockSection() {
  const [garments, styleRules, trendMatches, lookbookEntries] = await Promise.all([
    listWardrobeGarments(),
    listStyleRules(),
    listUserTrendMatchesWithSignals(),
    listLookbookEntries()
  ]);
  const topUnlock = scoreUnlockCandidates(garments, styleRules, [
    ...trendUnlockCandidates(trendMatches),
    ...lookbookUnlockCandidates(lookbookEntries)
  ])[0];
  if (!topUnlock || topUnlock.unlock_count < 3) return null;
  return <UnlockCard score={topUnlock} />;
}
```

Cache wrap pattern (each listed function):

```ts
import { cache } from "react";
export const listWardrobeGarments = cache(async (): Promise<GarmentListItem[]> => {
  // existing body
});
```

Do not client-fetch today outfit. Do not add a weather provider. Do not put algorithm names on `UnlockCard`.

Confirm `app/layout.tsx` still has no `headers()`. Do not change `next.config.ts` unless `staleTimes.dynamic` is below 60 — leave dirty next.config edits unstaged if they are unrelated.

If `app/wardrobe/(closet)/loading.tsx` already exists, do not duplicate it. Do not stage `app/loading.tsx` / calendar / lookbook / trends loading files unless you must edit those routes.

- [ ] **Step 1: Add ClosetUnlockSection + Suspense; wrap the five list functions in `cache`**
- [ ] **Step 2: Run** `npx vitest run && npx tsc --noEmit`

Expected: PASS. Grep `page.tsx` for `scoreUnlockCandidates` — zero matches.

- [ ] **Step 3: Commit** only closet section, page, and the five service files you wrapped.

```bash
git add app/wardrobe/\(closet\)/closet-unlock-section.tsx app/wardrobe/\(closet\)/page.tsx \
  lib/domain/wardrobe/service.ts lib/domain/style-rules/service.ts \
  lib/domain/lookbook/service.ts lib/domain/outfits/service.ts
git commit -m "$(cat <<'EOF'
Stream Closet unlock scoring behind Suspense.

EOF
)"
```

---

## Self-review

- Track 1 scores, shoes, silent UI, PRD, tests → Tasks 1–2.
- Track 2 critical path + cache + no headers / keep staleTimes → Task 3.
- Insights/chips unchanged (no new named-score chip) — no extra task; Task 2 forbids copy.
- `valueNeglect` sort unchanged — Task 1 keeps those tests.
