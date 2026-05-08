# iOS Data Layer Design Spec
_2026-05-08_

## Goal

Replace all `SampleData.*` call sites in the iOS app with live Supabase data, backed by a SwiftData cache for offline-safe launch. Priority screens: Wardrobe (read/write), Planner (read/write), Trends (read-only). Diary, Lookbook, and Rules follow in a later cycle.

## Context

- Auth (Phase 1) is handled by `AuthManager` per `docs/superpowers/plans/2026-04-29-ios-auth.md`. The data layer activates only after `AuthManager` confirms a valid session.
- Supabase Swift SDK v2 is installed. `Config.swift` loads credentials from `Secrets.plist`.
- All 16 feature files currently source data from `SampleData`. This spec replaces 10 of them (Wardrobe, Planner, Trends) and leaves Diary, Lookbook, Rules on `SampleData` for now.
- The existing `Garment`, `Outfit`, `TrendSignal`, `DayPlan`, `SavedOutfit` structs remain as UI models. SwiftData uses separate `@Model` classes.

---

## Architecture

Three `@Observable @MainActor` singletons injected via SwiftUI environment:

```
PocketWardrobeApp
  └── .environment(AuthManager)       ← Phase 1 (existing plan)
  └── .environment(GarmentStore)      ← wardrobe + wear logging
  └── .environment(OutfitStore)       ← planner + saved outfits
  └── .environment(TrendStore)        ← trend signals (read-only)
```

### Startup Sequence

1. App opens → `AuthManager` checks session cookie.
2. If session exists: stores call `load()` — read SwiftData cache first (instant, offline-safe), then fetch Supabase in background, merge, update UI.
3. If no session: stores stay empty, `AuthView` is presented.
4. On sign-out: stores call `clear()`, SwiftData cache is wiped.

### Write Strategy

Writes go to Supabase first. On success, the in-memory array and SwiftData cache are updated. No optimistic updates for v1. The calling view owns write error state (`@State var errorMessage: String?`); stores throw on failure.

### Network / Auth Errors

- Supabase 401 → `AuthManager.signOut()`, routes to `AuthView`.
- All other errors → `.error(String)` on store state, shown as banner or retry screen in the view.

---

## Shared Types

### LoadState

```swift
// Stores/LoadState.swift
enum LoadState: Equatable {
    case idle
    case loading
    case loaded
    case error(String)
}
```

### View Loading Behaviour

| State | Cache present | UI |
|---|---|---|
| `.loading` | No | Full-screen skeleton (mist placeholder cards) |
| `.loading` | Yes | Show cache, subtle nav bar spinner |
| `.error` | Yes | Show cache, dismissable error banner |
| `.error` | No | Full-screen error + Retry button |
| `.loaded` | — | Normal content |

---

## GarmentStore

**File:** `Stores/GarmentStore.swift`

```swift
@Observable @MainActor
final class GarmentStore {
    var garments: [Garment] = []
    var state: LoadState = .idle

    func load() async              // SwiftData → Supabase, merges result
    func clear()                   // on sign-out: wipe memory + SwiftData
    func add(_ input: GarmentInput) async throws
    func update(_ garment: Garment) async throws
    func toggleFavourite(_ garment: Garment) async throws
    func logWear(_ garment: Garment) async throws
    func delete(_ garment: Garment) async throws
}
```

### GarmentInput

```swift
// Models/GarmentInput.swift
struct GarmentInput {
    var name: String
    var brand: String
    var category: Garment.Category
    var colourName: String
    var colourHex: UInt32
    var imageURL: URL?
    var purchasePrice: Double
    var season: Garment.Season
    var tags: [String]
}
```

### Supabase Fetch

Single query joining `garments` and `garment_images` (feature image only):

```sql
SELECT g.*, gi.storage_path
FROM garments g
LEFT JOIN garment_images gi ON gi.garment_id = g.id AND gi.is_feature_image = true
WHERE g.user_id = auth.uid()
ORDER BY g.created_at DESC
```

### Field Mapping

| Supabase column | Garment field |
|---|---|
| `id` | `id` |
| `name` | `name` |
| `brand` | `brand` |
| `garment_type` | `category` |
| `primary_colour` | `colourName` |
| derived from `primary_colour` via `PWColor` lookup | `colourHex` |
| `storage_path` (from garment_images) | `imageURL` |
| `purchase_price` / wear count | `costPerWear` |
| wear_events count | `timesWorn` |
| `is_favourite` | `isFavourite` |
| `season` | `season` |
| `tags` | `tags` |

`match: MatchKind?` is always `nil` from `GarmentStore` — set contextually by `OutfitStore`/`TrendStore`.

### SwiftData Model

```swift
// Models/CDGarment.swift
@Model
final class CDGarment {
    @Attribute(.unique) var id: UUID
    var name: String
    var brand: String?
    var category: String
    var colourName: String
    var colourHex: UInt32
    var imageURLString: String?
    var costPerWear: Double
    var timesWorn: Int
    var isFavourite: Bool
    var season: String
    var tags: [String]
    var cachedAt: Date
}
```

### WardrobeView Changes

- Replace `SampleData.garments` with `@Environment(GarmentStore.self) var garmentStore`
- Bind grid to `garmentStore.garments`
- Add/edit sheets call `garmentStore.add()` / `garmentStore.update()`
- Wear logging calls `garmentStore.logWear()`
- Favourite toggle calls `garmentStore.toggleFavourite()`

---

## OutfitStore

**File:** `Stores/OutfitStore.swift`

```swift
@Observable @MainActor
final class OutfitStore {
    var weekPlan: [DayPlan] = []
    var savedOutfits: [SavedOutfit] = []
    var state: LoadState = .idle

    func load() async
    func clear()
    func planOutfit(_ input: OutfitInput, for date: Date) async throws  // OutfitInput: pieceIDs, occasion, variant
    func updatePlan(_ dayPlan: DayPlan) async throws
    func saveOutfit(_ outfit: Outfit) async throws
    func deleteSavedOutfit(_ outfit: SavedOutfit) async throws
}
```

### Data Fetching

- **Week plan:** fetches `outfits` for a rolling 7-day window (today ± 3 days), ordered by date.
- **Saved outfits:** fetches last 30 saved outfits from `outfits` where `is_saved = true`.
- **Garment pieces:** sourced from `GarmentStore.garments` — `OutfitStore` never fetches garments itself.
- **Weather:** unchanged — `PlannerView` continues its existing independent weather fetch.

### Match Context

When `PlannerView` needs to show which garments match a planned outfit, it computes `MatchKind` locally by comparing piece IDs against `GarmentStore.garments`. No extra Supabase call.

### SwiftData Model

```swift
// Models/CDOutfit.swift
@Model
final class CDOutfit {
    @Attribute(.unique) var id: UUID
    var date: Date
    var variantRaw: String
    var title: String
    var occasion: String
    var pieceIDStrings: [String]
    var isSaved: Bool
    var cachedAt: Date
}
```

### PlannerView Changes

- Replace `SampleData.tuesdayOutfits`, `SampleData.weekPlan`, `SampleData.savedOutfits` with reads from `OutfitStore`.
- Generator sheet calls `outfitStore.planOutfit()` on confirm.
- Save button calls `outfitStore.saveOutfit()`.

---

## TrendStore

**File:** `Stores/TrendStore.swift`

```swift
@Observable @MainActor
final class TrendStore {
    var signals: [TrendSignal] = []
    var state: LoadState = .idle

    func load() async
    func clear()
    func refresh() async   // pull-to-refresh: Supabase only, skips cache read
}
```

### Data Fetching

Fetches `trend_signals` ordered by `last_seen_at DESC`, limit 50.

### Field Mapping

| Supabase column | TrendSignal field |
|---|---|
| `label` | `title` |
| `confidence_score` | `confidence` (mapped to `.high/.medium/.low`) |
| `source_count` | `sourcesCount` |
| `trend_type` | `category` |
| `canonical_label` | `summary` |

### Match Context

`matchKind`, `matchCount`, and `matchedPieceIDs` are computed locally by comparing signal labels and trend types against `GarmentStore.garments` tags and categories. No extra query.

### SwiftData Model

```swift
// Models/CDTrendSignal.swift
@Model
final class CDTrendSignal {
    @Attribute(.unique) var id: UUID
    var category: String
    var title: String
    var summary: String
    var confidenceScore: Double
    var sourcesCount: Int
    var lastSeenAt: Date
    var cachedAt: Date
}
```

### TrendsView Changes

- Replace `SampleData.trendSignals` and `SampleData.unmatchedSignals` with `TrendStore.signals`.
- Split signals into matched vs unmatched in the view (`matchCount > 0`).
- Add `.refreshable { await trendStore.refresh() }`.

---

## Files Created / Modified

| File | Action |
|---|---|
| `Stores/LoadState.swift` | Create |
| `Stores/GarmentStore.swift` | Create |
| `Stores/OutfitStore.swift` | Create |
| `Stores/TrendStore.swift` | Create |
| `Models/GarmentInput.swift` | Create |
| `Models/CDGarment.swift` | Create |
| `Models/CDOutfit.swift` | Create |
| `Models/CDTrendSignal.swift` | Create |
| `App/PocketWardrobeApp.swift` | Modify — inject stores into environment |
| `Features/Wardrobe/WardrobeView.swift` | Modify — replace SampleData |
| `Features/Wardrobe/GarmentCard.swift` | Modify — no SampleData, already clean |
| `Features/Wardrobe/GarmentDetailSheet.swift` | Modify — wire edit/wear/delete |
| `Features/Planner/PlannerView.swift` | Modify — replace SampleData |
| `Features/Trends/TrendsView.swift` | Modify — replace SampleData |

---

## Out of Scope

- Diary, Lookbook, Rules — remain on SampleData for this cycle
- Image upload from iOS — garment images set via URL only; camera/photo library upload is a follow-on
- Offline write queuing — writes require connectivity in v1
- Real-time subscriptions — polling + pull-to-refresh only in v1
- Pro/LLM outfit generation — separate feature
