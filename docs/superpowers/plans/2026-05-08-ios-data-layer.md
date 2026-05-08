# iOS Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all SampleData call sites in WardrobeView, PlannerView, and TrendsView with live Supabase queries backed by a SwiftData cache, so the iOS app shows real user data with offline-safe startup.

**Architecture:** Three `@Observable @MainActor` store singletons (GarmentStore, OutfitStore, TrendStore) injected via SwiftUI environment. Each store reads its SwiftData cache on launch (instant, offline-safe), then fetches Supabase in background and merges. Writes go to Supabase first, then update the in-memory array and cache. A shared Supabase client singleton (`Supabase.client`) is used by all stores and AuthManager.

**Tech Stack:** SwiftUI iOS 17+, Supabase Swift SDK v2 (`supabase-swift`), SwiftData, `@Observable` macro, `async/await`. Storage bucket: `"garment-originals"`.

**Prerequisite:** Phase 1 auth plan (`2026-04-29-ios-auth.md`) should be completed first, but stores are written to work independently — they use `Supabase.client` directly and check `supabase.auth.session` to gate loads.

---

## Schema Reference

Key Supabase columns used by this plan:

```
garments:        id, title, brand, category, subcategory, seasonality[], wear_count,
                 cost_per_wear, favourite_score, created_at
garment_images:  garment_id, storage_path, image_type ('original','cutout','thumbnail')
garment_colours: garment_id, is_primary, colours(hex, family)
wear_events:     id, garment_id, worn_at, occasion
outfits:         id, title, occasion, source_type, planned_for (added in Task 2), created_at
outfit_items:    outfit_id, garment_id, role
trend_signals:   id, trend_type, label, canonical_label, confidence_score, source_count,
                 trend_status, last_seen_at
```

---

## File Map

| File | Action |
|---|---|
| `Stores/LoadState.swift` | Create |
| `Stores/Supabase.swift` | Create — shared client singleton |
| `Stores/GarmentStore.swift` | Create |
| `Stores/OutfitStore.swift` | Create |
| `Stores/TrendStore.swift` | Create |
| `Models/GarmentInput.swift` | Create |
| `Models/CDGarment.swift` | Create — SwiftData |
| `Models/CDOutfit.swift` | Create — SwiftData |
| `Models/CDTrendSignal.swift` | Create — SwiftData |
| `supabase/migrations/019_outfits_planned_for.sql` | Create |
| `App/PocketWardrobeApp.swift` | Modify — ModelContainer + store env |
| `Features/Wardrobe/WardrobeView.swift` | Modify |
| `Features/Wardrobe/GarmentDetailSheet.swift` | Modify |
| `Features/Planner/PlannerView.swift` | Modify |
| `Features/Trends/TrendsView.swift` | Modify |

All iOS file paths are relative to `ios/PocketWardrobev5/PocketWardrobev5/`.

---

### Task 1: Foundation — LoadState, Supabase singleton, SwiftData models

**Files:**
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Stores/LoadState.swift`
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Stores/Supabase.swift`
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Models/CDGarment.swift`
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Models/CDOutfit.swift`
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Models/CDTrendSignal.swift`

- [ ] **Step 1: Create LoadState.swift**

In Xcode, right-click the `PocketWardrobev5` group → New Group → name it `Stores`. Then New File → Swift File → `LoadState.swift`. Add to `PocketWardrobev5` target.

```swift
// Stores/LoadState.swift
enum LoadState: Equatable {
    case idle
    case loading
    case loaded
    case error(String)
}
```

- [ ] **Step 2: Create Supabase.swift**

New File → `Stores/Supabase.swift`. Add to `PocketWardrobev5` target.

```swift
// Stores/Supabase.swift
import Supabase

enum AppSupabase {
    static let shared = Supabase.SupabaseClient(
        supabaseURL: URL(string: Config.supabaseURL)!,
        supabaseKey: Config.supabaseAnonKey
    )
}
```

> Note: `Config.supabaseURL` and `Config.supabaseAnonKey` are defined in `Config/Config.swift` and load from `Secrets.plist`. Do not rename or move those.

- [ ] **Step 3: Create CDGarment.swift**

New File → `Models/CDGarment.swift`. Add to `PocketWardrobev5` target.

```swift
// Models/CDGarment.swift
import SwiftData
import Foundation

@Model
final class CDGarment {
    @Attribute(.unique) var id: String
    var title: String
    var brand: String?
    var category: String
    var colourName: String
    var colourHex: UInt32
    var imageURLString: String?
    var costPerWear: Double
    var timesWorn: Int
    var isFavourite: Bool
    var seasonality: [String]
    var cachedAt: Date

    init(
        id: String, title: String, brand: String?,
        category: String, colourName: String, colourHex: UInt32,
        imageURLString: String?, costPerWear: Double, timesWorn: Int,
        isFavourite: Bool, seasonality: [String], cachedAt: Date
    ) {
        self.id = id; self.title = title; self.brand = brand
        self.category = category; self.colourName = colourName
        self.colourHex = colourHex; self.imageURLString = imageURLString
        self.costPerWear = costPerWear; self.timesWorn = timesWorn
        self.isFavourite = isFavourite; self.seasonality = seasonality
        self.cachedAt = cachedAt
    }

    func toGarment() -> Garment {
        Garment(
            id: UUID(uuidString: id) ?? UUID(),
            name: title,
            brand: brand,
            category: Garment.Category(rawValue: category.capitalized) ?? .top,
            colourName: colourName,
            colourHex: colourHex,
            imageURL: imageURLString.flatMap(URL.init(string:)) ?? URL(string: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=680")!,
            costPerWear: costPerWear,
            timesWorn: timesWorn,
            match: nil,
            season: seasonality.first.flatMap { Garment.Season(rawValue: $0.capitalized) } ?? .allYear,
            tags: [],
            isFavourite: isFavourite
        )
    }
}
```

- [ ] **Step 4: Create CDOutfit.swift**

```swift
// Models/CDOutfit.swift
import SwiftData
import Foundation

@Model
final class CDOutfit {
    @Attribute(.unique) var id: String
    var title: String
    var occasion: String?
    var pieceIDStrings: [String]
    var isSaved: Bool
    var plannedFor: Date?
    var cachedAt: Date

    init(
        id: String, title: String, occasion: String?,
        pieceIDStrings: [String], isSaved: Bool,
        plannedFor: Date?, cachedAt: Date
    ) {
        self.id = id; self.title = title; self.occasion = occasion
        self.pieceIDStrings = pieceIDStrings; self.isSaved = isSaved
        self.plannedFor = plannedFor; self.cachedAt = cachedAt
    }
}
```

- [ ] **Step 5: Create CDTrendSignal.swift**

```swift
// Models/CDTrendSignal.swift
import SwiftData
import Foundation

@Model
final class CDTrendSignal {
    @Attribute(.unique) var id: String
    var category: String
    var title: String
    var summary: String
    var confidenceScore: Double
    var sourcesCount: Int
    var lastSeenAt: Date
    var cachedAt: Date

    init(
        id: String, category: String, title: String, summary: String,
        confidenceScore: Double, sourcesCount: Int,
        lastSeenAt: Date, cachedAt: Date
    ) {
        self.id = id; self.category = category; self.title = title
        self.summary = summary; self.confidenceScore = confidenceScore
        self.sourcesCount = sourcesCount; self.lastSeenAt = lastSeenAt
        self.cachedAt = cachedAt
    }
}
```

- [ ] **Step 6: Build (⌘B) — expect success**

All five files are pure Swift with no external dependencies beyond SwiftData and Foundation. Fix any syntax errors.

- [ ] **Step 7: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Stores/LoadState.swift \
        ios/PocketWardrobev5/PocketWardrobev5/Stores/Supabase.swift \
        ios/PocketWardrobev5/PocketWardrobev5/Models/CDGarment.swift \
        ios/PocketWardrobev5/PocketWardrobev5/Models/CDOutfit.swift \
        ios/PocketWardrobev5/PocketWardrobev5/Models/CDTrendSignal.swift
git commit -m "feat(ios): add LoadState, Supabase singleton, SwiftData cache models"
```

---

### Task 2: Migration — add planned_for to outfits

**Files:**
- Create: `supabase/migrations/019_outfits_planned_for.sql`

The `outfits` table has no date column for planned outfits. The planner needs to query outfits by date.

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/019_outfits_planned_for.sql
-- Adds a nullable planned_for date to outfits so the iOS planner
-- can store and query outfits by their intended wear date.
alter table public.outfits
  add column if not exists planned_for date;

create index if not exists outfits_planned_for_idx
  on public.outfits (user_id, planned_for)
  where planned_for is not null;
```

- [ ] **Step 2: Apply to Supabase**

```bash
npx supabase db push
```

Expected output:
```
Applying migration 019_outfits_planned_for.sql...
Finished supabase db push.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/019_outfits_planned_for.sql
git commit -m "feat(schema): add planned_for date to outfits for iOS planner"
```

---

### Task 3: GarmentStore

**Files:**
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Stores/GarmentStore.swift`
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Models/GarmentInput.swift`

- [ ] **Step 1: Create GarmentInput.swift**

```swift
// Models/GarmentInput.swift
import Foundation

struct GarmentInput {
    var name: String = ""
    var brand: String = ""
    var category: Garment.Category = .top
    var colourName: String = ""
    var colourHex: UInt32 = 0xC9B893
    var purchasePrice: Double = 0
    var season: Garment.Season = .allYear
    var tags: [String] = []
}
```

- [ ] **Step 2: Create GarmentStore.swift**

New File → `Stores/GarmentStore.swift`. Add to `PocketWardrobev5` target.

```swift
// Stores/GarmentStore.swift
import Foundation
import Supabase
import SwiftData

// MARK: - Supabase row decoders

private struct GarmentRow: Decodable {
    let id: UUID
    let title: String?
    let brand: String?
    let category: String
    let wearCount: Int
    let costPerWear: Double?
    let favouriteScore: Double?
    let seasonality: [String]

    enum CodingKeys: String, CodingKey {
        case id, title, brand, category, seasonality
        case wearCount = "wear_count"
        case costPerWear = "cost_per_wear"
        case favouriteScore = "favourite_score"
    }
}

private struct GarmentImageRow: Decodable {
    let garmentId: UUID
    let storagePath: String

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case storagePath = "storage_path"
    }
}

private struct GarmentColourRow: Decodable {
    let garmentId: UUID
    let isPrimary: Bool
    let colour: ColourDetail?

    struct ColourDetail: Decodable {
        let hex: String
        let family: String
    }

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case isPrimary = "is_primary"
        case colour = "colours"
    }
}

// MARK: - Store

@Observable
@MainActor
final class GarmentStore {
    var garments: [Garment] = []
    var state: LoadState = .idle

    private var modelContext: ModelContext?

    func setContext(_ context: ModelContext) {
        self.modelContext = context
    }

    // MARK: - Load

    func load() async {
        guard state != .loading else { return }
        state = .loading
        loadFromCache()
        await fetchFromSupabase()
    }

    func clear() {
        garments = []
        state = .idle
        guard let ctx = modelContext else { return }
        try? ctx.delete(model: CDGarment.self)
    }

    // MARK: - Cache

    private func loadFromCache() {
        guard let ctx = modelContext else { return }
        let cached = (try? ctx.fetch(FetchDescriptor<CDGarment>(
            sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
        ))) ?? []
        if !cached.isEmpty {
            garments = cached.map { $0.toGarment() }
        }
    }

    private func fetchFromSupabase() async {
        do {
            let client = AppSupabase.shared

            // 1. Fetch garment rows
            let rows: [GarmentRow] = try await client
                .from("garments")
                .select("id, title, brand, category, wear_count, cost_per_wear, favourite_score, seasonality")
                .order("created_at", ascending: false)
                .execute()
                .value

            // 2. Fetch primary colours for all garments
            let garmentIds = rows.map { $0.id.uuidString }
            let colourRows: [GarmentColourRow] = (garmentIds.isEmpty ? [] :
                try await client
                    .from("garment_colours")
                    .select("garment_id, is_primary, colours(hex, family)")
                    .in("garment_id", values: garmentIds)
                    .eq("is_primary", value: true)
                    .execute()
                    .value)

            let colourByGarment = Dictionary(
                colourRows.map { ($0.garmentId.uuidString, $0.colour) },
                uniquingKeysWith: { first, _ in first }
            )

            // 3. Fetch thumbnail images
            let imageRows: [GarmentImageRow] = (garmentIds.isEmpty ? [] :
                try await client
                    .from("garment_images")
                    .select("garment_id, storage_path")
                    .in("garment_id", values: garmentIds)
                    .eq("image_type", value: "original")
                    .execute()
                    .value)

            let imageByGarment = Dictionary(
                imageRows.map { ($0.garmentId.uuidString, $0.storagePath) },
                uniquingKeysWith: { first, _ in first }
            )

            // 4. Build signed URLs (batch)
            var signedURLByGarment: [String: URL] = [:]
            for (garmentId, path) in imageByGarment {
                if let url = try? await client.storage
                    .from("garment-originals")
                    .createSignedURL(path: path, expiresIn: 3600) {
                    signedURLByGarment[garmentId] = url
                }
            }

            // 5. Map to Garment structs and update cache
            let now = Date()
            guard let ctx = modelContext else { return }

            var built: [Garment] = []
            for row in rows {
                let idStr = row.id.uuidString
                let colour = colourByGarment[idStr]
                let colourName = colour?.family ?? "Unknown"
                let colourHex = colour.flatMap { UInt32($0.hex.replacingOccurrences(of: "#", with: ""), radix: 16) } ?? 0xC9B893
                let imageURL = signedURLByGarment[idStr]
                let isFavourite = (row.favouriteScore ?? 0) >= 0.7

                let garment = Garment(
                    id: row.id,
                    name: row.title ?? "Untitled",
                    brand: row.brand,
                    category: Garment.Category(rawValue: row.category.capitalized) ?? .top,
                    colourName: colourName,
                    colourHex: colourHex,
                    imageURL: imageURL ?? URL(string: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=680")!,
                    costPerWear: row.costPerWear ?? 0,
                    timesWorn: row.wearCount,
                    match: nil,
                    season: row.seasonality.first.flatMap { Garment.Season(rawValue: $0.capitalized) } ?? .allYear,
                    tags: [],
                    isFavourite: isFavourite
                )
                built.append(garment)

                // Upsert into SwiftData cache
                let existing = try? ctx.fetch(
                    FetchDescriptor<CDGarment>(
                        predicate: #Predicate { $0.id == idStr }
                    )
                ).first
                if let cd = existing {
                    cd.title = garment.name
                    cd.brand = garment.brand
                    cd.category = row.category
                    cd.colourName = colourName
                    cd.colourHex = colourHex
                    cd.imageURLString = imageURL?.absoluteString
                    cd.costPerWear = garment.costPerWear
                    cd.timesWorn = garment.timesWorn
                    cd.isFavourite = isFavourite
                    cd.seasonality = row.seasonality
                    cd.cachedAt = now
                } else {
                    ctx.insert(CDGarment(
                        id: idStr, title: garment.name, brand: garment.brand,
                        category: row.category, colourName: colourName,
                        colourHex: colourHex, imageURLString: imageURL?.absoluteString,
                        costPerWear: garment.costPerWear, timesWorn: garment.timesWorn,
                        isFavourite: isFavourite, seasonality: row.seasonality, cachedAt: now
                    ))
                }
            }
            try? ctx.save()

            garments = built
            state = .loaded
        } catch {
            state = garments.isEmpty ? .error(error.localizedDescription) : .error(error.localizedDescription)
        }
    }

    // MARK: - Writes

    func add(_ input: GarmentInput) async throws {
        let client = AppSupabase.shared
        struct Insert: Encodable {
            let title, brand, category: String
            let purchasePrice: Double
            let seasonality: [String]
            enum CodingKeys: String, CodingKey {
                case title, brand, category
                case purchasePrice = "purchase_price"
                case seasonality
            }
        }
        try await client.from("garments").insert(Insert(
            title: input.name,
            brand: input.brand,
            category: input.category.rawValue.lowercased(),
            purchasePrice: input.purchasePrice,
            seasonality: [input.season.rawValue.lowercased()]
        )).execute()
        await fetchFromSupabase()
    }

    func update(_ garment: Garment) async throws {
        struct Patch: Encodable {
            let title: String
            let brand: String?
        }
        try await AppSupabase.shared
            .from("garments")
            .update(Patch(title: garment.name, brand: garment.brand))
            .eq("id", value: garment.id.uuidString)
            .execute()
        if let idx = garments.firstIndex(where: { $0.id == garment.id }) {
            garments[idx] = garment
        }
        updateCache(garment)
    }

    func toggleFavourite(_ garment: Garment) async throws {
        let newScore: Double = garment.isFavourite ? 0.0 : 1.0
        struct Patch: Encodable {
            let favouriteScore: Double
            enum CodingKeys: String, CodingKey { case favouriteScore = "favourite_score" }
        }
        try await AppSupabase.shared
            .from("garments")
            .update(Patch(favouriteScore: newScore))
            .eq("id", value: garment.id.uuidString)
            .execute()
        var updated = garment
        updated = Garment(
            id: garment.id, name: garment.name, brand: garment.brand,
            category: garment.category, colourName: garment.colourName,
            colourHex: garment.colourHex, imageURL: garment.imageURL,
            costPerWear: garment.costPerWear, timesWorn: garment.timesWorn,
            match: garment.match, season: garment.season, tags: garment.tags,
            isFavourite: !garment.isFavourite
        )
        if let idx = garments.firstIndex(where: { $0.id == garment.id }) {
            garments[idx] = updated
        }
        updateCache(updated)
    }

    func logWear(_ garment: Garment) async throws {
        let client = AppSupabase.shared
        struct WearInsert: Encodable {
            let garmentId: UUID
            enum CodingKeys: String, CodingKey { case garmentId = "garment_id" }
        }
        try await client.from("wear_events")
            .insert(WearInsert(garmentId: garment.id))
            .execute()
        let newCount = garment.timesWorn + 1
        struct Patch: Encodable {
            let wearCount: Int
            enum CodingKeys: String, CodingKey { case wearCount = "wear_count" }
        }
        try await client.from("garments")
            .update(Patch(wearCount: newCount))
            .eq("id", value: garment.id.uuidString)
            .execute()
        let updated = Garment(
            id: garment.id, name: garment.name, brand: garment.brand,
            category: garment.category, colourName: garment.colourName,
            colourHex: garment.colourHex, imageURL: garment.imageURL,
            costPerWear: garment.costPerWear, timesWorn: newCount,
            match: garment.match, season: garment.season, tags: garment.tags,
            isFavourite: garment.isFavourite
        )
        if let idx = garments.firstIndex(where: { $0.id == garment.id }) {
            garments[idx] = updated
        }
        updateCache(updated)
    }

    func delete(_ garment: Garment) async throws {
        try await AppSupabase.shared
            .from("garments")
            .delete()
            .eq("id", value: garment.id.uuidString)
            .execute()
        garments.removeAll { $0.id == garment.id }
        guard let ctx = modelContext else { return }
        let idStr = garment.id.uuidString
        if let cd = try? ctx.fetch(FetchDescriptor<CDGarment>(
            predicate: #Predicate { $0.id == idStr }
        )).first {
            ctx.delete(cd)
            try? ctx.save()
        }
    }

    // MARK: - Private helpers

    private func updateCache(_ garment: Garment) {
        guard let ctx = modelContext else { return }
        let idStr = garment.id.uuidString
        if let cd = try? ctx.fetch(FetchDescriptor<CDGarment>(
            predicate: #Predicate { $0.id == idStr }
        )).first {
            cd.title = garment.name
            cd.brand = garment.brand
            cd.timesWorn = garment.timesWorn
            cd.isFavourite = garment.isFavourite
            cd.cachedAt = Date()
            try? ctx.save()
        }
    }
}
```

- [ ] **Step 3: Build (⌘B)**

Expected: success. Common issues:
- `Garment` struct doesn't have `isFavourite` — it was added in the iOS UI alignment plan. If missing, the iOS UI alignment plan must be applied first.
- `SupabaseClient` name conflict — the file uses `AppSupabase.shared` but imports `Supabase` which also defines `SupabaseClient`. Fix: rename the enum in `Supabase.swift` to `AppSupabase` (already done in this plan).

- [ ] **Step 4: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Stores/GarmentStore.swift \
        ios/PocketWardrobev5/PocketWardrobev5/Models/GarmentInput.swift
git commit -m "feat(ios): add GarmentStore with Supabase fetch and SwiftData cache"
```

---

### Task 4: OutfitStore

**Files:**
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Stores/OutfitStore.swift`

- [ ] **Step 1: Create OutfitStore.swift**

```swift
// Stores/OutfitStore.swift
import Foundation
import Supabase
import SwiftData

private struct OutfitRow: Decodable {
    let id: UUID
    let title: String?
    let occasion: String?
    let plannedFor: String?
    let sourceType: String

    enum CodingKeys: String, CodingKey {
        case id, title, occasion
        case plannedFor = "planned_for"
        case sourceType = "source_type"
    }
}

private struct OutfitItemRow: Decodable {
    let outfitId: UUID
    let garmentId: UUID
    let role: String

    enum CodingKeys: String, CodingKey {
        case outfitId = "outfit_id"
        case garmentId = "garment_id"
        case role
    }
}

struct OutfitInput {
    var title: String
    var occasion: String
    var pieceIDs: [UUID]
    var plannedFor: Date?
}

@Observable
@MainActor
final class OutfitStore {
    var weekPlan: [DayPlan] = []
    var savedOutfits: [SavedOutfit] = []
    var state: LoadState = .idle

    private var modelContext: ModelContext?

    func setContext(_ context: ModelContext) {
        self.modelContext = context
    }

    func load() async {
        guard state != .loading else { return }
        state = .loading
        loadFromCache()
        await fetchFromSupabase()
    }

    func clear() {
        weekPlan = []
        savedOutfits = []
        state = .idle
        guard let ctx = modelContext else { return }
        try? ctx.delete(model: CDOutfit.self)
    }

    private func loadFromCache() {
        guard let ctx = modelContext else { return }
        let cached = (try? ctx.fetch(FetchDescriptor<CDOutfit>())) ?? []
        buildPlans(from: cached)
    }

    private func fetchFromSupabase() async {
        do {
            let client = AppSupabase.shared
            let now = Date()
            let calendar = Calendar.current
            let weekStart = calendar.date(byAdding: .day, value: -3, to: now)!
            let weekEnd = calendar.date(byAdding: .day, value: 3, to: now)!
            let dateFormatter = ISO8601DateFormatter()
            dateFormatter.formatOptions = [.withFullDate]

            // Fetch week plan outfits
            let weekRows: [OutfitRow] = try await client
                .from("outfits")
                .select("id, title, occasion, planned_for, source_type")
                .gte("planned_for", value: dateFormatter.string(from: weekStart))
                .lte("planned_for", value: dateFormatter.string(from: weekEnd))
                .order("planned_for", ascending: true)
                .execute()
                .value

            // Fetch saved outfits (source_type = 'manual', no planned_for)
            let savedRows: [OutfitRow] = try await client
                .from("outfits")
                .select("id, title, occasion, planned_for, source_type")
                .eq("source_type", value: "manual")
                .is("planned_for", value: "null")
                .order("created_at", ascending: false)
                .limit(30)
                .execute()
                .value

            let allRows = weekRows + savedRows
            let allIds = allRows.map { $0.id.uuidString }

            // Fetch outfit items
            let itemRows: [OutfitItemRow] = allIds.isEmpty ? [] :
                try await client
                    .from("outfit_items")
                    .select("outfit_id, garment_id, role")
                    .in("outfit_id", values: allIds)
                    .execute()
                    .value

            let itemsByOutfit = Dictionary(grouping: itemRows, by: { $0.outfitId.uuidString })

            // Cache
            guard let ctx = modelContext else { return }
            for row in allRows {
                let idStr = row.id.uuidString
                let pieceIDs = (itemsByOutfit[idStr] ?? []).map { $0.garmentId.uuidString }
                let plannedDate = row.plannedFor.flatMap { dateFormatter.date(from: $0) }
                let isSaved = row.sourceType == "manual" && plannedDate == nil
                let existing = try? ctx.fetch(FetchDescriptor<CDOutfit>(
                    predicate: #Predicate { $0.id == idStr }
                )).first
                if let cd = existing {
                    cd.title = row.title ?? "Outfit"
                    cd.occasion = row.occasion
                    cd.pieceIDStrings = pieceIDs
                    cd.isSaved = isSaved
                    cd.plannedFor = plannedDate
                    cd.cachedAt = now
                } else {
                    ctx.insert(CDOutfit(
                        id: idStr, title: row.title ?? "Outfit",
                        occasion: row.occasion, pieceIDStrings: pieceIDs,
                        isSaved: isSaved, plannedFor: plannedDate, cachedAt: now
                    ))
                }
            }
            try? ctx.save()
            buildPlans(from: (try? ctx.fetch(FetchDescriptor<CDOutfit>())) ?? [])
            state = .loaded
        } catch {
            state = (weekPlan.isEmpty && savedOutfits.isEmpty) ? .error(error.localizedDescription) : .error(error.localizedDescription)
        }
    }

    private func buildPlans(from cached: [CDOutfit]) {
        let calendar = Calendar.current
        let now = Date()
        // Build 7-day week plan
        var plans: [DayPlan] = []
        for offset in -3...3 {
            guard let date = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
            let plan = DayPlan(
                date: date,
                weekday: shortWeekday(date),
                dayNumber: calendar.component(.day, from: date),
                weatherC: 15, weatherSummary: "—", weatherSymbol: "cloud",
                occasion: "—", isPlanned: false
            )
            plans.append(plan)
        }
        weekPlan = plans
        savedOutfits = cached
            .filter { $0.isSaved }
            .map { cd in
                SavedOutfit(
                    id: UUID(uuidString: cd.id) ?? UUID(),
                    kind: "Saved",
                    title: cd.title,
                    timesWorn: 0,
                    lastWorn: cd.cachedAt,
                    pieceIDs: cd.pieceIDStrings.compactMap(UUID.init)
                )
            }
    }

    func planOutfit(_ input: OutfitInput, for date: Date) async throws {
        let client = AppSupabase.shared
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]
        struct OutfitInsert: Encodable {
            let title, occasion: String
            let sourceType, plannedFor: String
            enum CodingKeys: String, CodingKey {
                case title, occasion
                case sourceType = "source_type"
                case plannedFor = "planned_for"
            }
        }
        struct ItemInsert: Encodable {
            let outfitId: UUID
            let garmentId: UUID
            let role: String
            enum CodingKeys: String, CodingKey {
                case outfitId = "outfit_id"
                case garmentId = "garment_id"
                case role
            }
        }
        struct OutfitIdRow: Decodable { let id: UUID }
        let outfitRow: OutfitIdRow = try await client.from("outfits")
            .insert(OutfitInsert(
                title: input.title, occasion: input.occasion,
                sourceType: "planner", plannedFor: dateFormatter.string(from: date)
            ))
            .select("id")
            .single()
            .execute()
            .value
        let items = input.pieceIDs.map { ItemInsert(outfitId: outfitRow.id, garmentId: $0, role: "other") }
        if !items.isEmpty {
            try await client.from("outfit_items").insert(items).execute()
        }
        await fetchFromSupabase()
    }

    func saveOutfit(_ outfit: Outfit) async throws {
        let client = AppSupabase.shared
        struct OutfitInsert: Encodable {
            let title, occasion, sourceType: String
            enum CodingKeys: String, CodingKey {
                case title, occasion
                case sourceType = "source_type"
            }
        }
        struct ItemInsert: Encodable {
            let outfitId: UUID; let garmentId: UUID; let role: String
            enum CodingKeys: String, CodingKey {
                case outfitId = "outfit_id"; case garmentId = "garment_id"; case role
            }
        }
        struct OutfitIdRow: Decodable { let id: UUID }
        let outfitRow: OutfitIdRow = try await client.from("outfits")
            .insert(OutfitInsert(title: outfit.title, occasion: outfit.occasion, sourceType: "manual"))
            .select("id").single().execute().value
        let items = outfit.pieces.map {
            ItemInsert(outfitId: outfitRow.id, garmentId: $0.id, role: $0.role.rawValue)
        }
        if !items.isEmpty {
            try await client.from("outfit_items").insert(items).execute()
        }
        await fetchFromSupabase()
    }

    func deleteSavedOutfit(_ outfit: SavedOutfit) async throws {
        try await AppSupabase.shared
            .from("outfits").delete()
            .eq("id", value: outfit.id.uuidString)
            .execute()
        savedOutfits.removeAll { $0.id == outfit.id }
    }

    private func shortWeekday(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "EEE"
        return f.string(from: date)
    }
}
```

- [ ] **Step 2: Build (⌘B)**

Expected: success. If `Outfit.pieces[].role` type doesn't have a `rawValue`, adapt accordingly by checking the `Outfit` model definition.

- [ ] **Step 3: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Stores/OutfitStore.swift
git commit -m "feat(ios): add OutfitStore with week plan and saved outfits"
```

---

### Task 5: TrendStore

**Files:**
- Create: `ios/PocketWardrobev5/PocketWardrobev5/Stores/TrendStore.swift`

- [ ] **Step 1: Create TrendStore.swift**

```swift
// Stores/TrendStore.swift
import Foundation
import Supabase
import SwiftData

private struct TrendSignalRow: Decodable {
    let id: UUID
    let trendType: String
    let label: String
    let canonicalLabel: String?
    let confidenceScore: Double?
    let sourceCount: Int
    let lastSeenAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case trendType = "trend_type"
        case label
        case canonicalLabel = "canonical_label"
        case confidenceScore = "confidence_score"
        case sourceCount = "source_count"
        case lastSeenAt = "last_seen_at"
    }
}

@Observable
@MainActor
final class TrendStore {
    var signals: [TrendSignal] = []
    var state: LoadState = .idle

    private var modelContext: ModelContext?

    func setContext(_ context: ModelContext) {
        self.modelContext = context
    }

    func load() async {
        guard state != .loading else { return }
        state = .loading
        loadFromCache()
        await fetchFromSupabase()
    }

    func clear() {
        signals = []
        state = .idle
        guard let ctx = modelContext else { return }
        try? ctx.delete(model: CDTrendSignal.self)
    }

    func refresh() async {
        state = .loading
        await fetchFromSupabase()
    }

    private func loadFromCache() {
        guard let ctx = modelContext else { return }
        let cached = (try? ctx.fetch(FetchDescriptor<CDTrendSignal>(
            sortBy: [SortDescriptor(\.lastSeenAt, order: .reverse)]
        ))) ?? []
        if !cached.isEmpty {
            signals = cached.map { mapCached($0) }
        }
    }

    private func fetchFromSupabase() async {
        do {
            let rows: [TrendSignalRow] = try await AppSupabase.shared
                .from("trend_signals")
                .select("id, trend_type, label, canonical_label, confidence_score, source_count, last_seen_at")
                .order("last_seen_at", ascending: false)
                .limit(50)
                .execute()
                .value

            let now = Date()
            let isoFormatter = ISO8601DateFormatter()
            guard let ctx = modelContext else { return }

            var built: [TrendSignal] = []
            for row in rows {
                let lastSeen = row.lastSeenAt.flatMap { isoFormatter.date(from: $0) } ?? now
                let idStr = row.id.uuidString
                let existing = try? ctx.fetch(FetchDescriptor<CDTrendSignal>(
                    predicate: #Predicate { $0.id == idStr }
                )).first
                let summary = row.canonicalLabel ?? row.label
                let confidence = row.confidenceScore ?? 0.5

                if let cd = existing {
                    cd.title = row.label
                    cd.summary = summary
                    cd.confidenceScore = confidence
                    cd.sourcesCount = row.sourceCount
                    cd.lastSeenAt = lastSeen
                    cd.cachedAt = now
                } else {
                    ctx.insert(CDTrendSignal(
                        id: idStr, category: row.trendType,
                        title: row.label, summary: summary,
                        confidenceScore: confidence, sourcesCount: row.sourceCount,
                        lastSeenAt: lastSeen, cachedAt: now
                    ))
                }
                built.append(TrendSignal(
                    id: row.id,
                    category: TrendSignal.Category(rawValue: row.trendType) ?? .garment,
                    title: row.label,
                    summary: summary,
                    detail: summary,
                    swatches: [],
                    sourcesCount: row.sourceCount,
                    sourceKinds: [],
                    confidence: confidenceLevel(confidence),
                    matchKind: .missing,
                    matchCount: 0,
                    matchedPieceIDs: [],
                    canonicalPalette: [],
                    reasons: [],
                    isSignalOfWeek: false
                ))
            }
            try? ctx.save()
            signals = built
            state = .loaded
        } catch {
            state = signals.isEmpty ? .error(error.localizedDescription) : .error(error.localizedDescription)
        }
    }

    private func mapCached(_ cd: CDTrendSignal) -> TrendSignal {
        TrendSignal(
            id: UUID(uuidString: cd.id) ?? UUID(),
            category: TrendSignal.Category(rawValue: cd.category) ?? .garment,
            title: cd.title,
            summary: cd.summary,
            detail: cd.summary,
            swatches: [],
            sourcesCount: cd.sourcesCount,
            sourceKinds: [],
            confidence: confidenceLevel(cd.confidenceScore),
            matchKind: .missing,
            matchCount: 0,
            matchedPieceIDs: [],
            canonicalPalette: [],
            reasons: [],
            isSignalOfWeek: false
        )
    }

    private func confidenceLevel(_ score: Double) -> TrendSignal.Confidence {
        switch score {
        case 0.75...: return .high
        case 0.5..<0.75: return .medium
        default: return .low
        }
    }
}
```

- [ ] **Step 2: Build (⌘B)**

Expected: success. If `TrendSignal.Category` or `TrendSignal.Confidence` don't match, check the `TrendSignal` model in `Models/TrendSignal.swift` and adjust the raw values or enum names accordingly.

- [ ] **Step 3: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Stores/TrendStore.swift
git commit -m "feat(ios): add TrendStore with Supabase fetch and SwiftData cache"
```

---

### Task 6: Wire stores into PocketWardrobeApp

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/App/PocketWardrobeApp.swift`

- [ ] **Step 1: Replace PocketWardrobeApp.swift**

In Xcode, open `App/PocketWardrobeApp.swift` and replace its entire contents with:

```swift
//
//  PocketWardrobeApp.swift
//  Pocket Wardrobe — app entry point.
//

import SwiftUI
import SwiftData

@main
struct PocketWardrobeApp: App {
    let garmentStore = GarmentStore()
    let outfitStore = OutfitStore()
    let trendStore = TrendStore()

    let modelContainer: ModelContainer = {
        let schema = Schema([CDGarment.self, CDOutfit.self, CDTrendSignal.self])
        return try! ModelContainer(for: schema)
    }()

    init() {
        styleTabBar()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(PWColor.ink)
                .environment(garmentStore)
                .environment(outfitStore)
                .environment(trendStore)
                .onAppear {
                    let ctx = ModelContext(modelContainer)
                    garmentStore.setContext(ctx)
                    outfitStore.setContext(ctx)
                    trendStore.setContext(ctx)
                    Task {
                        async let g: () = garmentStore.load()
                        async let o: () = outfitStore.load()
                        async let t: () = trendStore.load()
                        await (g, o, t)
                    }
                }
        }
        .modelContainer(modelContainer)
    }

    private func styleTabBar() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(PWColor.paper)
        appearance.shadowColor = UIColor(PWColor.line)
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(PWColor.ink40)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(PWColor.ink40),
            .font: UIFont.systemFont(ofSize: 10, weight: .medium),
            .kern: 1.0
        ]
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(PWColor.ink)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(PWColor.ink),
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
            .kern: 1.0
        ]
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}
```

- [ ] **Step 2: Build (⌘B)**

Expected: success. The stores are now injected into every view in the hierarchy.

- [ ] **Step 3: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/App/PocketWardrobeApp.swift
git commit -m "feat(ios): inject GarmentStore, OutfitStore, TrendStore into app environment"
```

---

### Task 7: Wire WardrobeView

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Features/Wardrobe/WardrobeView.swift`

- [ ] **Step 1: Replace WardrobeView.swift**

```swift
//
//  WardrobeView.swift
//  Pocket Wardrobe — main wardrobe grid.
//

import SwiftUI

struct WardrobeView: View {
    @Environment(GarmentStore.self) private var garmentStore
    @State private var selectedFilter: Garment.Category? = nil
    @State private var selectedGarment: Garment? = nil

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private var filteredGarments: [Garment] {
        if let selectedFilter {
            return garmentStore.garments.filter { $0.category == selectedFilter }
        }
        return garmentStore.garments
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 10) {
                    EyebrowLabel(text: "\(garmentStore.garments.count) pieces · curated")
                    HStack(alignment: .firstTextBaseline) {
                        Text("Wardrobe.")
                            .display(size: 44)
                        Spacer()
                    }
                    Text("Every piece, how much you've worn it, and whether it earns its space.")
                        .caption(size: 14)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(
                            label: "All", count: garmentStore.garments.count,
                            isActive: selectedFilter == nil
                        ) { selectedFilter = nil }

                        ForEach(Garment.Category.allCases, id: \.self) { cat in
                            let count = garmentStore.garments.filter { $0.category == cat }.count
                            if count > 0 {
                                FilterChip(
                                    label: cat.rawValue, count: count,
                                    isActive: selectedFilter == cat
                                ) { selectedFilter = cat }
                            }
                        }
                    }
                    .padding(.horizontal, PWSpacing.pageGutter)
                }
                .padding(.top, 20)
                .padding(.bottom, 8)

                HairlineDivider()
                    .padding(.top, 8)

                // Loading / error states
                switch garmentStore.state {
                case .loading where garmentStore.garments.isEmpty:
                    loadingPlaceholder
                case .error(let msg) where garmentStore.garments.isEmpty:
                    errorView(msg)
                default:
                    garmentGrid
                }
            }
        }
        .background(PWColor.ivory)
        .sheet(item: $selectedGarment) { garment in
            GarmentDetailSheet(garment: garment)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    private var garmentGrid: some View {
        LazyVGrid(columns: columns, spacing: 28) {
            ForEach(filteredGarments) { garment in
                Button {
                    selectedGarment = garment
                } label: {
                    GarmentCard(garment: garment)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .padding(.top, 28)
        .padding(.bottom, 48)
    }

    private var loadingPlaceholder: some View {
        LazyVGrid(columns: columns, spacing: 28) {
            ForEach(0..<6, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 10) {
                    RoundedRectangle(cornerRadius: PWRadius.sm)
                        .fill(PWColor.mist)
                        .aspectRatio(4.0/5.0, contentMode: .fit)
                    RoundedRectangle(cornerRadius: 2).fill(PWColor.mist).frame(height: 12).frame(maxWidth: .infinity)
                    RoundedRectangle(cornerRadius: 2).fill(PWColor.mist).frame(height: 18).frame(maxWidth: 140)
                }
            }
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .padding(.top, 28)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Text("Couldn't load wardrobe")
                .font(PWFont.display(size: 22))
                .foregroundStyle(PWColor.ink)
            Text(message)
                .font(PWFont.body(size: 13))
                .foregroundStyle(PWColor.ink60)
                .multilineTextAlignment(.center)
            PWButton(title: "Retry") {
                Task { await garmentStore.load() }
            }
        }
        .padding(PWSpacing.pageGutter)
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}
```

- [ ] **Step 2: Build (⌘B) and run in simulator**

Launch in iPhone simulator. WardrobeView should show a skeleton while loading, then populate with real garments from Supabase (or an empty grid if no garments exist for the logged-in user).

- [ ] **Step 3: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Features/Wardrobe/WardrobeView.swift
git commit -m "feat(ios): wire WardrobeView to GarmentStore — replace SampleData"
```

---

### Task 8: Wire GarmentDetailSheet

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Features/Wardrobe/GarmentDetailSheet.swift`

The detail sheet needs Log Wear, Toggle Favourite, and Delete actions wired to the store.

- [ ] **Step 1: Add store + action state to GarmentDetailSheet**

Open `GarmentDetailSheet.swift` and add at the top of the struct body (after `let garment: Garment`):

```swift
@Environment(GarmentStore.self) private var garmentStore
@Environment(\.dismiss) private var dismiss
@State private var errorMessage: String? = nil
@State private var showDeleteConfirm = false
```

- [ ] **Step 2: Add action buttons to the sheet**

Find the end of the `VStack` in the sheet body (before the closing brace of `ScrollView`) and add:

```swift
// Action buttons
VStack(spacing: 12) {
    if let err = errorMessage {
        Text(err)
            .font(PWFont.body(size: 12))
            .foregroundStyle(PWColor.oxblood)
            .padding(.horizontal, PWSpacing.pageGutter)
    }

    HStack(spacing: 12) {
        PWButton(title: "Log wear", style: .outline) {
            Task {
                do {
                    try await garmentStore.logWear(garment)
                    dismiss()
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
        PWButton(title: garment.isFavourite ? "Unfavourite" : "Favourite", style: .outline) {
            Task {
                do {
                    try await garmentStore.toggleFavourite(garment)
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }
    .padding(.horizontal, PWSpacing.pageGutter)

    PWButton(title: "Delete", style: .ghost) {
        showDeleteConfirm = true
    }
    .padding(.horizontal, PWSpacing.pageGutter)
    .foregroundStyle(PWColor.oxblood)
}
.padding(.top, 24)
.padding(.bottom, 48)
```

Then add `.confirmationDialog` to the `ScrollView`:
```swift
.confirmationDialog("Delete this garment?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
    Button("Delete", role: .destructive) {
        Task {
            do {
                try await garmentStore.delete(garment)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
    Button("Cancel", role: .cancel) {}
}
```

- [ ] **Step 3: Build (⌘B)**

Expected: success. Test in simulator: open a garment, tap "Log wear" — the wear count should increment and the sheet should dismiss.

- [ ] **Step 4: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Features/Wardrobe/GarmentDetailSheet.swift
git commit -m "feat(ios): wire GarmentDetailSheet actions to GarmentStore"
```

---

### Task 9: Wire PlannerView

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Features/Planner/PlannerView.swift`

- [ ] **Step 1: Replace SampleData references in PlannerView**

Open `PlannerView.swift`. Make these targeted changes:

**Add store environment at top of struct:**
```swift
@Environment(OutfitStore.self) private var outfitStore
@Environment(GarmentStore.self) private var garmentStore
```

**Replace `SampleData.weekPlan` with `outfitStore.weekPlan`:**
Find:
```swift
WeekStrip(days: SampleData.weekPlan, selectedDate: $selectedDate)
```
Replace with:
```swift
WeekStrip(days: outfitStore.weekPlan, selectedDate: $selectedDate)
```

**Replace `SampleData.savedOutfits` with `outfitStore.savedOutfits`:**
Find:
```swift
ForEach(SampleData.savedOutfits) { saved in
```
Replace with:
```swift
ForEach(outfitStore.savedOutfits) { saved in
```

**Replace `SampleData.tuesdayOutfits` with sample outfit for current selection:**
The planner currently shows hardcoded Tuesday outfits. Replace `currentOutfit` computed property:
```swift
private var currentOutfit: Outfit {
    // Until outfit variants are supported from Supabase, show first saved outfit
    // or fall back to the safe sample.
    SampleData.tuesdayOutfits.first(where: { $0.variant == activeVariant })
        ?? SampleData.tuesdayOutfits[0]
}
```
> Note: Outfit variants (safe/elevated/trend) are iOS-only concepts not yet in the DB schema. Keep the SampleData fallback for the variant tab display — only the week strip and saved outfits use live data in v1.

**Replace `SampleData.alternatives` with empty array:**
Find:
```swift
ForEach(Array(SampleData.alternatives.enumerated()), id: \.element.id) { idx, alt in
```
Replace with:
```swift
ForEach(Array(outfitStore.savedOutfits.prefix(3).enumerated()), id: \.offset) { idx, saved in
    altRow(OutfitAlternative(
        title: saved.title,
        caption: "Saved · worn \(saved.timesWorn)×",
        thumbnailURLs: saved.pieceIDs.prefix(4)
            .compactMap { garmentStore.garments.first(where: { $0.id == $0.id })?.imageURL }
    ))
```
> Note: The `altRow` function signature expects `OutfitAlternative` — keep the existing function, just build it from live data.

- [ ] **Step 2: Build (⌘B)**

Expected: success. The week strip and saved outfits section now use live data; variant tabs remain on sample data.

- [ ] **Step 3: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Features/Planner/PlannerView.swift
git commit -m "feat(ios): wire PlannerView week strip and saved outfits to OutfitStore"
```

---

### Task 10: Wire TrendsView + pull-to-refresh

**Files:**
- Modify: `ios/PocketWardrobev5/PocketWardrobev5/Features/Trends/TrendsView.swift`

- [ ] **Step 1: Add store environment**

At the top of `TrendsView`, replace:
```swift
@State private var activeCategory: Category = .all
@State private var selectedSignal: TrendSignal? = nil
```
with:
```swift
@Environment(TrendStore.self) private var trendStore
@State private var activeCategory: Category = .all
@State private var selectedSignal: TrendSignal? = nil
```

- [ ] **Step 2: Replace SampleData signal references**

Replace `SampleData.trendSignals`:
```swift
// OLD
private var featured: TrendSignal? {
    SampleData.trendSignals.first(where: \.isSignalOfWeek)
}
private var filtered: [TrendSignal] {
    SampleData.trendSignals.filter { activeCategory.matches($0) && !$0.isSignalOfWeek }
}

// NEW
private var featured: TrendSignal? {
    trendStore.signals.first(where: \.isSignalOfWeek)
}
private var filtered: [TrendSignal] {
    trendStore.signals.filter { activeCategory.matches($0) && !$0.isSignalOfWeek }
}
```

Replace `SampleData.unmatchedSignals` in the unmatched section:
```swift
// OLD
ForEach(SampleData.unmatchedSignals) { unmatched in

// NEW
ForEach(trendStore.signals.filter { $0.matchCount == 0 }) { signal in
    unmatchedCard(UnmatchedSignal(
        id: signal.id,
        category: signal.category,
        title: signal.title,
        sourcesCount: signal.sourcesCount,
        confidence: signal.confidence
    ))
```

Update the head eyebrow to use live count:
```swift
// OLD
EyebrowLabel(text: "Global signals · Week of April 20, 2026")

// NEW
EyebrowLabel(text: "Global signals · \(trendStore.signals.count) this week")
```

Update the stats caption:
```swift
// OLD
Text("47 normalized signals · 18 match your wardrobe · 6 flagged as missing pieces")

// NEW
let matched = trendStore.signals.filter { $0.matchCount > 0 }.count
Text("\(trendStore.signals.count) signals · \(matched) match your wardrobe")
```

- [ ] **Step 3: Add pull-to-refresh**

Add `.refreshable` to the `ScrollView`:
```swift
ScrollView {
    // ... existing content
}
.background(PWColor.ivory)
.refreshable {
    await trendStore.refresh()
}
.sheet(item: $selectedSignal) { ... }
```

- [ ] **Step 4: Add loading state for empty trends**

Wrap the `VStack` content in the ScrollView with a check:
```swift
if trendStore.state == .loading && trendStore.signals.isEmpty {
    ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 120)
} else {
    // existing VStack content
}
```

- [ ] **Step 5: Build (⌘B) and test pull-to-refresh in simulator**

Pull down on the Trends tab — should trigger a network refresh and update signal count.

- [ ] **Step 6: Commit**

```bash
git add ios/PocketWardrobev5/PocketWardrobev5/Features/Trends/TrendsView.swift
git commit -m "feat(ios): wire TrendsView to TrendStore with pull-to-refresh"
```
