# Pocket Wardrobe — Design Mockups

Interactive HTML mockups for the wardrobe, lookbook, trends, planner, diary, and rules screens.
Cool ivory + editorial black, Farfetch-leaning restraint.

## Files

- `index.html` — Landing page + full style guide (palette, typography, components, patterns)
- `wardrobe.html` — Wardrobe grid · detail modal · add-garment modal · filter drawer
- `lookbook.html` — Lookbook boards · masonry of references · entry detail modal · save-inspiration modal
- `trends.html` — Trend signals · featured signal hero · signal cards · detail modal with sources + matches
- `planner.html` — **Weekly planner (extra polish)** · week strip · outfit hero with reasoning · safe/elevated/trend variants · context panel (weather, occasion, laundry, alternatives) · saved outfits grid · generator settings modal
- `diary.html` — **Month diary view** · what you actually wore · calendar of full-bleed outfit photos · day detail modal · log-today's-outfit modal with photo drop + source picker. Reached via Week/Month toggle from the planner.
- `rules.html` — **Style rules editor** · the grammar of your wardrobe · categorized rule cards (Pairings, Occasion fit, Layering, Avoidances, Seasonality) · weight sliders · active toggles · scope chips (Canon / Yours) · rule detail modal · add-rule modal with predicate picker.
- `styles.css` — Shared design system tokens and components
- `app.js` — Minimal modal, drawer, and tab interactions

## Opening

Open any `.html` file directly in a browser. No build step or server required.
Nav links at the top work across all pages.
Modals open on click; close with the × button, Esc, or click the backdrop.

## Design system summary

**Palette.** Ivory `#FAFAF6`, Paper `#FFFFFF`, Ink `#0B0B0B`, Ink 70 `#3B3832`, Ink 40 `#8F8A82`, Line `#E5E0D4`. Reserved accents: Oxblood `#6E2B2B`, Moss `#3E4A34`, Gold `#B08A3E` — used only for match badges, status, and emphasis.

**Type.** Fraunces (variable serif, weight 300, negative tracking) for display; Inter for body/UI; JetBrains Mono for numbers. Eyebrow labels at 11px caps, 0.18em track.

**Components.** Buttons use 12px caps. Chips at 11px, pill-rounded. Tags are square (radius 2px). Match badges (exact / adjacent / styling / missing) use muted ink washes. Cards are bordered only; elevation is reserved for modals.

**Motion.** cubic-bezier(.22,.61,.36,1) at 160/280/420 ms.

**Layout.** Max width 1440. 4-up grid on desktop, 2-up on mobile. Gallery-grade whitespace; hairline borders.

## Imagery

Uses unsplash.com direct image URLs as placeholders. Replace with real garment cutouts from your `garment-cutouts` bucket when wiring up.

## Information architecture

```
Top nav (5 items):    Wardrobe   Lookbook   Trends   Planner   Rules
                                                       │
                                             ┌─────────┴─────────┐
                                             ▼                   ▼
                                      Week (plan)         Month (diary)
                                      planner.html        diary.html
```

Planner and Diary share a view-toggle pill at the top of the page. The toggle is deliberately
two-way: plan the future in Week, remember the past in Month.

## Data model touched by these screens

- `garments`, `garment_images` (with `image_variant` = original / cutout / cropped / thumbnail)
- `outfits`, `outfit_items`, `wear_events` (diary entries)
- `trend_signals`, `user_trend_matches`
- `style_rules` — subject / predicate / object / weight / scope / active. Predicates in the
  mockup: `pairs_with`, `appropriate_for`, `layerable_with`, `avoid_with`, plus a seasonality
  variant on `appropriate_for`.
