# Proprietary ranking and perceived-instant navigation — design

Date: 2026-08-31

## Problem

Outfit ranking currently folds style-rule points and `log10(cost-per-wear)` into one number. That let priced accessories clear the optional-role threshold and sit on every look. A follow-on complete-set check then hid **Wear this** when shoes (still optional) dropped out.

Tab switches still feel slow when Closet waits on unlock enumeration (up to 400 combo counts) before painting the shop.

The ranking math should become durable product IP. Users should never see that branding.

## Product decisions (locked)

1. **Two scores, never one soup.** Style rules decide whether a garment *belongs*. Value math only ranks garments that already belong.
2. **Fair rotation first; expensive unused is a bonus.** Never-worn items of any price get a pull. Price magnifies idle capital; it does not replace style.
3. **Shoes are required** for a complete look. They are never omitted because `rulesScore` is below `OPTIONAL_ROLE_THRESHOLD`. Hard filters (weather, occasion) may still drop a specific pair.
4. **Silent UI.** No named index, no “proprietary algorithm” copy, no extra chips. Closet still shows ordinary cost-per-wear and “Unworn · {currency} {price}”.
5. **Document internally.** Spec + `ranking.ts` + tests + a short PRD clause. That is the IP surface.
6. **Latency is perceived-instant tabs**, not zero network. Unlock scoring leaves the Closet critical path. Router cache stays; mutations still `revalidatePath`.

## Non-goals

- No chat, no LLM ranking, no schema invention.
- No in-app “powered by” or score badges.
- No marketplace or buy links.
- Do not merge wardrobe and lookbook.
- Do not claim milliseconds against cold auth/Supabase; claim no duplicate work and no unlock blocking first paint.

## Track 1 — Proprietary ranking (implement first)

### Scores

**InclusionScore** (`rulesScore`): existing `scoreGarment` only (colour, occasion, weather, silhouette rules). Used for:

- optional-role omit: `outerwear`, `accessory`, `bag`, `jewellery` if `rulesScore < 0.2` (keep layering-outerwear exception).
- **not** for shoes.

**RankingScore**: `InclusionScore + rankingDelta - recencyPenalty`. Used only to sort candidates inside a role after omit.

**rankingDelta** (saturating, always in `[0, Δ_max]`):

```
λ = 0.5                         # wear prior (“C lite”)
α = 0.35                        # rotation
β = 0.45                        # idle capital
Δ_max = 1.2

P = purchase_price              # null → rankingDelta = 0 (rotation also 0)
W = wear_count

R = α / (1 + W)                                    # any price, including 0-wear
I = β * log10(1 + P / (W + λ))                     # defined only if P != null
rankingDelta = Δ_max * (1 - exp(-(R + I)))         # if P == null, I = 0 still; if P == null, skip I and still apply R
```

If `purchase_price` is null: `I = 0`, `R` still applies (never-worn unpriced items rotate). Recency penalty stays `0.3` when `last_worn_at` is within 7 days; it subtracts from **RankingScore only**, never from InclusionScore.

`valueNeglect` for **closet sort** stays `P / max(W, 1)` (null prices last). That is the simple, user-explainable sort. It is not the generator delta.

Replace `costPerWearBoost` with `rankingDelta` (rename in `ranking.ts`). Call sites in `generateOutfit` add `rankingDelta` after the optional-role omit decision.

### Shoes and Wear this

Remove `shoes` from `OPTIONAL_ROLES`. Completeness (`isRoleCompleteOutfit`) stays dress+shoes **or** top+bottom+shoes. Generator always fills shoes when a candidate passes hard filters, even if `rulesScore` is 0.

**Wear this** stays hidden only when the *closet* cannot form a complete set, or the generated outfit is incomplete because hard filters removed shoes (not because of threshold omit).

### Insights and chips

Neglected-value insight body stays rounded currency copy (`AUD 133` / `$400`). Do not mention rankingDelta, λ, or “index”. ReasonStrip stays weather + rule + optional extra; no new named-score chip.

React insight keys stay `${insight.key}-${index}`. Do not extend the insight enum.

### PRD

Add under **12.3 Soft ranking**: ranking uses an internal two-score model (inclusion vs rotation/idle-capital). The formulas are proprietary; the product must not surface algorithm names or index values in the UI.

Add under **14.1**: displayed `cost_per_wear` remains `purchase_price / max(wear_count, 1)`. Outfit ranking may use a different internal transform; that transform is not shown to users.

### Tests (pin numbers)

Use fixtures, not snapshots of floats beyond 6 decimal places (`toBeCloseTo`).

- Never-worn $40 vs never-worn $400: both get R; $400 has larger I; $400 ranks higher within role.
- Never-worn $40 vs $400 worn 20 times: rotation can beat idle-on-overworn (assert direction, document expected inequality in the test name).
- Priced bag, `rulesScore` 0: omitted (does not enter the outfit).
- Shoes, `rulesScore` 0, pass hard filters: included; today card may Wear this if top+bottom or dress also present.
- Recency: worn yesterday → RankingScore lower than twin not worn; InclusionScore equal.
- `purchase_price` null, wear_count 0: `rankingDelta > 0` from R only.

## Track 2 — Perceived-instant navigation (after ranking)

### Tab switches

Keep `experimental.staleTimes` (`dynamic` ≥ 60s, `static` ≥ 180s). Do not put `headers()` in the root layout. Keep `react.cache` on `getRequiredUser`, entitlements, account profile.

Route `loading.tsx` files that already exist uncommitted (`app/loading.tsx`, `app/wardrobe` group, calendar, lookbook, trends) may be included **only if** this track touches those routes; do not sweep unrelated atelier/pipeline dirt.

### Closet critical path

`app/wardrobe/(closet)/page.tsx` today waits on `scoreUnlockCandidates` (combo enumeration) before rendering the shop.

Split:

1. **Critical:** garments, entitlements, today outfit, owned trend, shop. Paint this first.
2. **Deferred:** unlock card via a nested Server Component wrapped in `<Suspense>` with a zero-height or slim fallback. Unlock work must not block the shop.

Do not client-fetch today outfit. Do not add a new weather provider.

Trends page may keep scoring **only** `trendUnlockCandidates` (already the case). Closet deferred unlock may still mix trend + lookbook for the hero card.

### Success

- Switching Closet ↔ Planner ↔ Trends after first load does not re-run Closet unlock enumeration (router cache).
- First Closet paint does not wait on unlock combo counts.
- After `Wear this` / garment mutations, `revalidatePath` still refreshes Closet.

## Implementation order

1. Ranking module + generator omit/sort split + shoes required + tests.
2. PRD clauses.
3. Closet Suspense split for unlock.
4. Confirm staleTimes / no `headers()` in root layout; add loading UI only where this track needs it.

## Out of scope leftovers

Uncommitted pipeline, ingestion adapters, Dockerfile, and atelier chrome experiments stay unstaged unless a file in this spec must change.
