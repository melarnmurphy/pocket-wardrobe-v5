---
title: Outfit Generation UI
date: 2026-03-25
status: draft
---

# Outfit Generation UI

## Overview

A new `/outfits` page where users generate complete outfits from their wardrobe, edit the result, and save to a persistent gallery. Generation is powered by the style rules engine on free tier and Claude (hybrid) on paid tier. Entry points also exist from the wardrobe and trends pages.

---

## Tier model

| Tier | Modes available | Generation engine | Explanation |
|---|---|---|---|
| Free | Plan it | Rules engine only | Rule tags (human-readable) |
| Pro | Plan it, Surprise Me, Trend | Rules engine → Claude hybrid | Claude prose |

The tier indicator in the generator panel reads "Free tier" or "Pro" — no mention of the underlying technology.

---

## Page — `/outfits`

A single page with two sections:

1. **Generator panel** — always visible at the top; three mode tabs (free users see Plan it active, Surprise Me and Trend locked with a "Pro" badge)
2. **Saved outfits gallery** — grid of saved outfit cards below the generator

### URL entry points from other pages

| Source | URL | Effect |
|---|---|---|
| Wardrobe garment detail | `/outfits?mode=plan&item=<garmentId>` | Plan it tab pre-filled, that garment locked in |
| Trends match card | `/outfits?mode=trend&signal=<signalId>` | Trend tab pre-selected, that signal highlighted |

---

## Generation modes

### Plan it (free + Pro)

User provides: occasion (free text), dress code (select), weather (select). All fields optional — omitting a field removes that constraint from the engine.

**Dress code options:** Any, Casual, Smart casual, Business casual, Formal, Black tie

**Weather options:** Any, Warm sun, Cool breeze, Cold rain, Mild clear

### Surprise Me (Pro only)

No user input. Claude picks a complete outfit from the wardrobe scored by style rules and recency (avoids recently worn garments). Single "Generate outfit" button.

### Trend (Pro only)

User selects one active trend signal from their matched trend signals list. The list is loaded from `user_trend_matches` joined to `trend_signals` for the current user. Each row shows: trend label, trend type, source count, `authority_score` displayed as a discretized label (< 0.5 = "low authority", 0.5–0.8 = "medium authority", > 0.8 = "high authority"), and match type (exact match / adjacent / missing piece). The engine weights garments that match the trend's `normalized_attributes_json` field higher during selection. Button reads "Generate outfit around this trend."

---

## Architecture

### Data flow

```
User submits form
  → generateOutfitAction(input: GenerateOutfitInput)
  → lib/domain/outfits/service.ts: generateOutfit(userId, input)
      Free: generator.ts rules engine
      Pro:  generator.ts → top 3 candidates per role → Claude hybrid
  → returns GeneratedOutfit { garments[], explanation, firedRules[] }

User taps swap (⇄) on a garment chip
  → getSwapCandidatesAction(role, excludeGarmentId, outfitContext)
  → wardrobe service: list garments filtered by role, scored for context
  → returns GarmentListItem[]

User saves
  → saveOutfitAction(outfitData: SaveOutfitInput)
  → service.ts: insert outfits row + outfit_items rows
  → page revalidates gallery
```

### New files

| File | Purpose |
|---|---|
| `app/outfits/page.tsx` | Server component — loads saved outfits, active trend signals (from `user_trend_matches` joined to `trend_signals`), wardrobe garments, and active style rules; passes all four to the generator component |
| `app/outfits/actions.ts` | `generateOutfitAction`, `getSwapCandidatesAction`, `saveOutfitAction` |
| `lib/domain/outfits/service.ts` | `generateOutfit`, `saveOutfit`, `listOutfits` |
| `lib/domain/outfits/generator.ts` | Pure rules engine — no DB calls, no LLM |
| `components/outfit-generator.tsx` | Client component — tabs, forms, result panel, swap dropdown |
| `components/outfit-gallery.tsx` | Saved outfits grid |

### Existing files touched

| File | Change |
|---|---|
| `lib/domain/outfits/index.ts` | Add `GenerateOutfitInput`, `GeneratedOutfit`, `SaveOutfitInput` Zod schemas |
| `lib/domain/trends/index.ts` | Add `UserTrendMatchWithSignal` composite type: `UserTrendMatch & { trend_signal: TrendSignal }` |
| `app/wardrobe/page.tsx` | Add "Generate outfit" entry point on garment detail |

Note: `app/trends/page.tsx` does not yet exist. The trends entry point link (`/outfits?mode=trend&signal=<signalId>`) is out of scope for this spec — it will be added when the trends page is built.

---

## Generator component — `outfit-generator.tsx`

Client component. Receives the following props from the server component:
- `isPro: boolean` — hardcoded to `false` for this iteration (paid tier gating is out of scope; all users see free tier behaviour until the gating mechanism is built)
- `garments: GarmentListItem[]` — full wardrobe, used for swap candidate listing and client-side rule re-evaluation after swaps
- `styleRules: StyleRuleListItem[]` — active rules, used for client-side rule re-evaluation after swaps
- `trendSignals: UserTrendMatchWithSignal[]` — matched trend signals for the Trend tab picker
- `savedOutfits: OutfitWithItems[]` — initial gallery data (gallery also revalidates on save)

State:
- `activeTab: 'plan' | 'surprise' | 'trend'`
- `formValues: PlanItForm | SurpriseForm | TrendForm`
- `pendingResult: GeneratedOutfit | null`
- `isGenerating: boolean`

Renders:
1. Tab bar — Plan it always enabled; Surprise Me and Trend show "Pro" badge and are non-interactive when `isPro` is false
2. Active mode form
3. Result panel (shown when `pendingResult` is set)
4. Save / Discard buttons on the result panel

---

## Result panel

Shown inline below the form after generation. Contains:

**Garment chips** — one per role (top, bottom, outerwear, shoes, etc.). Each chip shows:
- Garment thumbnail (40×40)
- Role label (e.g. "Top", "Shoes")
- Garment name
- Swap button (⇄)

**"Why this works" section:**
- Free: rule tags rendered as human-readable sentences (no underscores, full words). Examples: "Navy and beige are analogous colours", "Chinos work for smart casual", "A trench coat suits autumn weather"
- Pro: Claude prose explanation (1–3 sentences)

**Actions:** "Save outfit" (primary) and "Discard" (secondary). Saving inserts into `outfits` + `outfit_items` and revalidates the page; discarding clears `pendingResult`.

---

## Swap dropdown

Anchored to the garment chip. Opens on ⇄ click. Lists wardrobe items filtered by the same role, excluding the current garment, sorted by style-rule score for the current outfit context. Selecting an item replaces the chip and re-evaluates the "Why this works" tags client-side — the rules engine re-runs in the browser using the wardrobe data and style rules already in memory (no new server action call, no new Claude call). On the Pro hybrid path, swapped results always show rule tags, not Claude prose. Closing without selecting keeps the original.

---

## Category-to-role mapping

The garments `category` field is free text. The generator maps category strings to outfit roles using case-insensitive keyword matching. A garment matches the first role whose keywords appear in the category value.

| Role | Category keywords |
|---|---|
| `dress` | dress, jumpsuit, playsuit |
| `top` | shirt, blouse, top, tee, t-shirt, knitwear, jumper, sweater, cardigan, turtleneck, tank, bodysuit, crop |
| `bottom` | trouser, jean, skirt, short, chino, legging, pant |
| `outerwear` | coat, jacket, blazer, waistcoat, vest, puffer, trench, anorak, mac |
| `shoes` | shoe, boot, trainer, sandal, loafer, heel, flat, mule, sneaker |
| `bag` | bag, handbag, clutch, tote, backpack, purse |
| `accessory` | scarf, belt, hat, cap, glove, sunglasses, tie, watch |
| `jewellery` | necklace, ring, earring, bracelet, pendant, chain |

Garments that do not match any keyword fall into `other`. The mapping is a pure function `categoryToRole(category: string): OutfitItemRole` in `generator.ts`.

---

## Generator logic — `generator.ts`

Pure functions, no DB calls, no LLM. Takes: wardrobe `GarmentListItem[]`, active style rules `StyleRuleListItem[]`, and a `GenerateOutfitInput`. Returns: `GeneratedOutfit`.

### Algorithm

1. **Hard filter** — remove garments with a `hard` constraint rule matching `avoid_with` for the requested dress code (e.g. jeans excluded when dress code is `formal`)
2. **Score per role** — for each role (top, bottom, outerwear, shoes), score remaining garments against active soft rules: colour compatibility, occasion fit, weather fit, seasonality, silhouette pairing
3. **Trend boost** (Trend mode) — garments whose attributes match the selected trend signal's `normalized_attributes` receive a score multiplier
4. **Recency penalty** (Surprise Me) — garments worn in the last 7 days receive a score penalty
5. **Select** — highest-scoring candidate per role; omit optional roles (outerwear, shoes) if no candidates score above a minimum threshold of 0.2 (a constant to be confirmed during implementation)
6. **Collect fired rules** — record which rules contributed to each selection for the explanation tags

### Pro hybrid path

After step 5, pass the top 3 candidates per role (with their scores and fired rules) to Claude alongside the occasion/weather/trend context. Claude makes the final selection and returns explanation prose. If Claude is unavailable, fall back silently to the rules engine result and render rule tags instead.

---

## Gallery — `outfit-gallery.tsx`

Grid of saved outfit cards. Each card:
- 2×2 thumbnail grid of the outfit's garment images (top-left: top/dress, top-right: bottom, bottom-left: outerwear/shoes, bottom-right: remaining). Empty slots (e.g. a dress-only outfit with no bottom) are rendered as a plain background placeholder — no garment image, no error state.
- Title (stored in `outfits.title` at save time: Plan it → "\<occasion\>, \<dress code\>"; Trend → the trend signal's label; Surprise Me → "Outfit — \<date\>"). No new column is needed — `outfits.title` is already nullable text.
- Item count and date saved

---

## Error states

| Condition | Message |
|---|---|
| Wardrobe has fewer than 2 garments | "Add more items to your wardrobe to generate outfits" |
| No garments pass hard filters | "None of your wardrobe items fit this dress code — try relaxing the filter" |
| Claude unavailable (Pro hybrid path) | Silent fallback to rules engine; rule tags shown instead of prose |
| No trend signals matched | "No active trend signals yet — visit the Trends page to run a match" |

---

## Testing

- Unit tests for `generator.ts`: hard filter removes correct garments; soft scoring ranks correctly; Trend mode boosts correct items; Surprise Me applies recency penalty
- Unit tests for `saveOutfitAction`: inserts correct `outfits` + `outfit_items` rows
- Unit tests for `getSwapCandidatesAction`: filters by role and excludes current garment
- Integration: generate an outfit for a known wardrobe fixture and assert the expected roles are filled

---

## Out of scope

- Outfit scheduling / calendar (planner source type exists in schema, not built here)
- Sharing outfits externally
- Outfit versioning / history
- User-defined outfit names (title stored from occasion, editable post-save in a future iteration)
- Paid tier gating mechanism (Pro badge is rendered; actual subscription check is a separate concern)
