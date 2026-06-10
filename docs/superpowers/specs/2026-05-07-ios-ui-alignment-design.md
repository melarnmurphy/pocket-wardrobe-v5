# iOS UI Alignment — Design Spec
_2026-05-07_

## Goal

Make the iOS app feel like the same product as the web app without losing the native iOS character. The planner, trends, and calendar screens on iOS are already well-designed — the fix is foundational (fonts) and targeted (GarmentCard detail). No screen layouts are restructured.

## Problem

Two root causes make the iOS app feel visually disconnected from the web:

1. **Fonts not bundled.** `PWFont.swift` targets Fraunces (display), Inter (body), and JetBrains Mono (numbers) — the same fonts as the web. Without the TTF files in the Xcode bundle, every display heading falls back to NewYork (serif) and every body to SF Pro. This is the single biggest visual difference across all screens.

2. **GarmentCard missing metadata.** The web wardrobe card shows category label, wears count pill, and FAVOURITE tag. The iOS card shows only brand, name, colour, and inline cost-per-wear. Same data model, different detail level.

3. **Debug artifact.** `TrendsView.swift` has a `.border(Color.red, width: 2)` left in from development.

## Approach

Bundle the fonts and fix the card. Do not restructure any screen layouts — the design system and component patterns are already correct.

---

## Section 1 — Font Bundling

### Fonts required

| File | PostScript name | Used by |
|---|---|---|
| `Fraunces-Light.ttf` | `Fraunces-Light` | `PWFont.display()` |
| `Fraunces-LightItalic.ttf` | `Fraunces-LightItalic` | `PWFont.displayItalic()` |
| `Inter-Regular.ttf` | `Inter-Regular` | `PWFont.body()` |
| `Inter-Medium.ttf` | `Inter-Medium` | `PWFont.body(weight: .medium)` |
| `Inter-SemiBold.ttf` | `Inter-SemiBold` | `PWFont.body(weight: .semibold)` |
| `Inter-Bold.ttf` | `Inter-Bold` | `PWFont.body(weight: .bold)` |
| `JetBrainsMono-Regular.ttf` | `JetBrainsMono-Regular` | `PWFont.mono()` |

7 files total. Source: Google Fonts (open licence, no additional licensing needed for App Store distribution).

### Integration steps

1. Create `ios/PocketWardrobev5/PocketWardrobev5/Fonts/` directory.
2. Add all 7 TTF files to the Xcode project under that group, ticking **"Add to target: PocketWardrobev5"** so they appear in Copy Bundle Resources.
3. Add `UIAppFonts` array to `Info.plist` listing all 7 PostScript names.
4. No changes to `PWFont.swift` — the `isRegistered()` checks will pass automatically.

### Verification

In `#Preview` for any view: if the display heading renders with serifs and variable weight (not NewYork's bold slab look), fonts are live.

---

## Section 2 — GarmentCard Enhancement

### Current structure

```
[4:5 image]
BRAND (uppercase, ink60)
Garment Name (Fraunces 18)
● colour     $X.XX / wear
```

### Updated structure

```
CATEGORY  ← EyebrowLabel (new)
[4:5 image]
BRAND · subcategory (uppercase, ink60)  ← subcategory appended
Garment Name (Fraunces 18)
● colour
[AUD X.XX/wear]  [N WEARS]  [FAVOURITE]  ← pill row (new)
```

### Component mapping

| Element | Component | Style |
|---|---|---|
| Category label | `EyebrowLabel` | existing, ink60 |
| Brand · subcategory | `Text` | existing pattern, append `" · \(garment.subcategory)"` |
| Cost-per-wear pill | `TagChip` | `.solid` (ink bg, ivory text) |
| Wears count pill | `TagChip` | `.plain` (mist bg, ink70 text) |
| FAVOURITE tag | `TagChip` | `.plain`, shown only when `garment.isFavourite` |

All components exist in `PWComponents.swift`. No new components needed.

### Currency formatting

Use `"AUD"` prefix matching the web (not `"$"`). Format: `"AUD \(String(format: "%.2f", garment.costPerWear))/wear"`.

### Pill row layout

`HStack(spacing: 6)` left-aligned, wrapping not needed (pills are short). FAVOURITE pill is conditional — only rendered when `garment.isFavourite == true`.

---

## Section 3 — Debug Cleanup

Remove from `TrendsView.swift`:
```swift
.border(Color.red, width: 2)   // DEBUG: delete me — shows VStack bounds
```

---

## Files Changed

| File | Change |
|---|---|
| `ios/.../Fonts/*.ttf` (×7) | New — font files added to bundle |
| `ios/.../PocketWardrobev5/Info.plist` | Add `UIAppFonts` array |
| `ios/.../Features/Wardrobe/GarmentCard.swift` | Add category eyebrow, brand·subcategory, pill row |
| `ios/.../Features/Trends/TrendsView.swift` | Remove debug border |

## Out of Scope

- Any changes to the web app
- Screen layout restructuring on iOS
- New components or design tokens
- Navigation shell changes
- Other iOS screens (planner, trends, diary, lookbook) — they are already well-designed; font bundling alone will significantly improve their appearance
