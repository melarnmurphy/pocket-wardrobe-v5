# Consumer appeal wedges — design

Date: 2026-08-31

## Problem

Pocket Wardrobe already has a weekly planner, trend matching, cost-per-wear fields, and fired-rule explanations. Those capabilities are buried in expert surfaces. The product should answer five consumer questions without a chatbot.

## Product questions

1. What do I wear tomorrow?
2. Which trends do I already own?
3. Which expensive pieces am I wasting?
4. What one item would unlock the most outfits?
5. Why is this recommendation true, in three chips or fewer?

## Non-goals

- No chat UI, no “ask the stylist” panel, no LLM-primary outfit logic.
- No shopping marketplace, affiliate grid, or Vogue/Pantone republishing.
- No schema invention: use existing `garments`, `wear_events`, `outfits`, `lookbook_items.desired_item_json`, `user_trend_matches`, `style_rules`.
- Do not merge wardrobe and lookbook.

## Existing foundations

- Outfit engine: `lib/domain/outfits/generator.ts` (`generateOutfit`, hard filters, `firedRules`, `insights`). Recency penalty exists only for `mode === "surprise"`. Cost-per-wear is not in ranking.
- Planner: `components/outfit-planner.tsx` is a week canvas. There is no one-tap today card.
- Trends: `lib/domain/trends/matching.ts` already classifies `exact_match`, `adjacent_match`, `styling_match`, `missing_piece`. The trends page lists them; Closet does not surface “you already own this.”
- Cost per wear: `garments.cost_per_wear` is maintained by wear-event triggers. Wardrobe sort has `cost_desc` / `cost_asc` but no “neglected value” ranking and the generator ignores it.
- Missing pieces: lookbook `desired_item_json` and trend `missing_piece` matches exist as records, not as an unlock-count.

## Design

### Wedge 1 — Wear this tomorrow

Add a pure function `suggestTodayOutfit` that wraps `generateOutfit` in `plan` mode with:

- weather profile for the next local calendar day (or today if before 8pm local)
- optional occasion from the planner day if one is already set
- always-on recency penalty (7-day window)
- cost-per-wear boost (see wedge 3)
- repeat suppression against outfits saved for the last 7 days

UI: a Closet hero card (and a compact duplicate at the top of Planner) with one primary action **Wear this** (save to tomorrow’s calendar slot) and one secondary **See why**. Empty state: “Add a few more pieces” when required roles are missing — never a chat prompt.

### Wedge 2 — You already own this trend

Keep matching as the source of truth. Product change is ranking and routing:

- Closet hero (below today-outfit) shows the highest-scoring `exact_match`, else `adjacent_match`.
- CTA **Style it** calls existing `generateOutfit` `mode: "trend"` with `mustIncludeGarmentIds` from `reasoning_json.matched_garment_ids` (new generator option; hard constraint: those ids stay in the result if they pass hard filters).
- Trends page leads with “On you” (exact + adjacent) before missing pieces.

### Wedge 3 — Cost-per-wear that hurts

Ranking formula (deterministic, documented in tests):

```
valueNeglect = 0 if purchase_price is null
             else purchase_price / max(wear_count, 1)

rankingBoost = min(1.5, log10(1 + valueNeglect) * 0.35)
             + (wear_count === 0 && purchase_price != null ? 0.25 : 0)
```

Apply `score += rankingBoost` in `generateOutfit` for all modes. Wardrobe sort adds `neglected` (desc `valueNeglect`, null prices last). Closet garment cards show cost-per-wear when price exists; neglected items get a quiet chip “Unworn · $X sitting”.

### Wedge 4 — Unlock score

Pure function `scoreUnlockCandidates`:

- Baseline: count *role-complete* outfits the current wardrobe can form under default hard filters (dress+shoes or top+bottom+shoes). Cap enumeration at 400 combinations; if over cap, sample by taking top-N scored garments per role (`N = 8`).
- Candidates: (a) trend `missing_piece` signals converted to a synthetic garment from `normalized_attributes_json`, (b) lookbook `desired_item_json` rows.
- Score = `comboCount(wardrobe + synthetic) - comboCount(wardrobe)`.
- Return top 3 with `unlock_count`, `candidate_label`, `source` (`trend` | `lookbook`), and `reasoning` string like “Adds 11 outfits by filling the missing bottom for existing blazers.”

UI: Trends missing-piece cards show the unlock count; Closet hero can show the #1 unlock if it is ≥ 3. No buy links.

### Wedge 5 — Quiet luxury UX

Shared `ReasonStrip` (max 3 chips) fed only from machine-readable fields:

- weather insight title
- one fired colour/occasion rule
- one cost-per-wear or trend-ownership chip

Ban new chat surfaces. Planner headline becomes action-first (“Tomorrow is already dressed”) when a today-outfit exists. Do not add gradients, emoji status, or chatbot copy.

## Success criteria

- Signed-in user with ≥ 1 complete outfit role set sees a today suggestion in ≤ 1 click from Closet.
- Exact trend matches appear on Closet without opening Trends.
- Generator prefers a $400 never-worn blazer over a $20 weekly tee when both pass hard filters.
- Unlock score is testable with fixtures; no network, no LLM.
- Explanations remain inspectable chips, not paragraphs of model prose (Pro prose may still exist *behind* chips, never instead of them).
