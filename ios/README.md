# Pocket Wardrobe — iOS

Native SwiftUI app. All five web screens are now ported — Wardrobe, Lookbook, Trends,
Planner (with the Diary inside, matching the web's Week/Month toggle), and Rules. Same
editorial aesthetic as the web mockups in `../design/` — cool ivory + editorial black,
Farfetch-leaning restraint.

**To run on your phone:** see [SETUP.md](./SETUP.md).

## What's here

```
ios/
├── SETUP.md                       ← start here
├── README.md                      ← you are here
└── PocketWardrobe/
    ├── App/
    │   ├── PocketWardrobeApp.swift      app entry
    │   └── RootView.swift               TabView · Wardrobe / Lookbook / Trends / Planner / Rules
    ├── DesignSystem/
    │   ├── PWColor.swift                ivory/ink/line/oxblood etc.
    │   ├── PWFont.swift                 Fraunces/Inter/Mono w/ system fallbacks
    │   ├── PWSpacing.swift              4/8/12/16/24/32/48/64/96
    │   ├── PWComponents.swift           EyebrowLabel, PWButton, TagChip, PWSwitch, etc.
    │   └── MatchBadge.swift             exact / adjacent / styling / missing
    ├── Models/
    │   ├── Garment.swift
    │   ├── StyleRule.swift              subject/predicate/object/weight/scope/active
    │   ├── WearEvent.swift              one diary entry
    │   ├── LookbookEntry.swift          saved reference + board
    │   ├── TrendSignal.swift            normalized signal w/ category + confidence
    │   └── Outfit.swift                 composed look (variants, day plan, saved)
    ├── Data/
    │   └── SampleData.swift             hardcoded seed mirroring the HTML mockups
    ├── Features/
    │   ├── Wardrobe/
    │   │   ├── WardrobeView.swift
    │   │   ├── GarmentCard.swift
    │   │   └── GarmentDetailSheet.swift
    │   ├── Lookbook/
    │   │   ├── LookbookView.swift              board filter + masonry grid
    │   │   ├── LookbookCard.swift
    │   │   └── LookbookEntrySheet.swift        full detail + missing piece card
    │   ├── Trends/
    │   │   ├── TrendsView.swift                Signal of the week + grid + unmatched
    │   │   ├── TrendCard.swift
    │   │   └── TrendDetailSheet.swift          palette + matched pieces + sources
    │   ├── Planner/
    │   │   ├── PlannerContainerView.swift      Week / Month toggle (Month = Diary)
    │   │   ├── PlannerView.swift               week strip · variant tabs · context stack
    │   │   ├── WeekStrip.swift
    │   │   ├── OutfitHero.swift                anchor + 4 satellite tiles
    │   │   └── GeneratorSettingsSheet.swift    per-day occasion + ranking prefs
    │   ├── Diary/
    │   │   ├── DiaryView.swift                 6×7 month grid w/ full-bleed photos
    │   │   ├── DayDetailSheet.swift
    │   │   └── LogOutfitSheet.swift
    │   └── Rules/
    │       ├── RulesView.swift
    │       ├── RuleCard.swift
    │       └── RuleDetailSheet.swift
    └── Resources/
        └── Info-fonts-snippet.plist     ← paste into Info.plist when adding custom fonts
```

## Parity with the web mockups

| Web (`design/*.html`) | iOS (`Features/*`) | Status |
|---|---|---|
| `wardrobe.html` | `Wardrobe/` | ✓ first pass |
| `lookbook.html` | `Lookbook/` | ✓ first pass |
| `trends.html`   | `Trends/`   | ✓ first pass |
| `planner.html`  | `Planner/` (week view) | ✓ first pass |
| `diary.html`    | `Diary/` (inside Planner tab, Month toggle) | ✓ first pass |
| `rules.html`    | `Rules/`    | ✓ first pass |
| `index.html` (style guide) | `DesignSystem/` (as code) | ✓ |

## The Planner tab — Week / Month

The web `planner.html` has a top-level Week / Month toggle where Month = the Diary.
iOS follows the same convention: the `Planner` tab opens into `PlannerContainerView`
which renders a pill-shaped toggle at the top and switches between `PlannerView` (week
plan with variant tabs) and `DiaryView` (month grid).

## Design tokens — source of truth

When we port more screens, tokens must stay in lockstep with `design/styles.css`.
The mapping:

| CSS var | Swift (`PWColor`) |
|---|---|
| `--ivory` | `PWColor.ivory` |
| `--paper` | `PWColor.paper` |
| `--mist` | `PWColor.mist` |
| `--haze` | `PWColor.haze` |
| `--ink` | `PWColor.ink` |
| `--ink-70` | `PWColor.ink70` |
| `--ink-60` | `PWColor.ink60` |
| `--ink-40` | `PWColor.ink40` |
| `--line` | `PWColor.line` |
| `--line-soft` | `PWColor.lineSoft` |
| `--oxblood` | `PWColor.oxblood` |
| `--moss` | `PWColor.moss` |
| `--gold` | `PWColor.gold` |

## What this pass does *not* yet do

- No Supabase wiring — data is hardcoded in `SampleData.swift`. All seed collections
  live there: `garments`, `wearEvents`, `rules`, `lookbookBoards`, `lookbookEntries`,
  `trendSignals`, `unmatchedSignals`, `weekPlan`, `tuesdayOutfits`, `alternatives`,
  `savedOutfits`.
- No auth.
- No camera / PhotoPicker for the "log outfit" flow — the sheet UI is there, but the
  photo source buttons are stubs.
- No haptics, no pull-to-refresh, no launch screen.
- No dark mode (intentional — the design is ivory-on-ink and flips awkwardly without
  a proper dark-mode treatment).
- Trend signal images use fixed placeholder Unsplash URLs; when we wire real data the
  hero mosaic in `TrendsView.featuredCard` should pull from the signal's own media.

These are the obvious next passes.

## Why SwiftUI and not a web wrapper

Decided in conversation: a real native feel for the editorial aesthetic is worth the
rebuild. SwiftUI gets us close to the web mockups in a fraction of the UIKit code, and
the existing Next.js app at `/` still runs on the web.
