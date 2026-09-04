//
//  PocketWardrobev5Tests.swift
//  PocketWardrobev5Tests
//
//  Created by Melarn Murphy on 22/4/2026.
//

import Testing
import Foundation
@testable import PocketWardrobev5

// These exercise the pure mapping/derivation logic inside the mobile stores
// (JSON row -> UI model), not networking or Supabase itself. Each store's row
// decoding types and mapping functions are `internal` (not `private`)
// specifically so they're reachable here via `@testable import`.

@Suite("TrendStore mapping")
@MainActor
struct TrendStoreTests {

    @Test("category maps known trend_type values, defaults unknown to aesthetic")
    func categoryMapping() {
        #expect(TrendStore.category(for: "colour") == .colour)
        #expect(TrendStore.category(for: "garment") == .garment)
        #expect(TrendStore.category(for: "silhouette") == .silhouette)
        #expect(TrendStore.category(for: "material") == .material)
        #expect(TrendStore.category(for: "pattern") == .pattern)
        #expect(TrendStore.category(for: "styling") == .aesthetic)
        #expect(TrendStore.category(for: "occasion") == .aesthetic)
        #expect(TrendStore.category(for: "era_influence") == .aesthetic)
        #expect(TrendStore.category(for: "something_unknown") == .aesthetic)
    }

    @Test("confidence buckets by score, nil defaults to medium")
    func confidenceMapping() {
        #expect(TrendStore.confidence(for: 0.9) == .high)
        #expect(TrendStore.confidence(for: 0.75) == .high)
        #expect(TrendStore.confidence(for: 0.5) == .medium)
        #expect(TrendStore.confidence(for: 0.4) == .medium)
        #expect(TrendStore.confidence(for: 0.1) == .low)
        #expect(TrendStore.confidence(for: nil) == .medium)
    }

    @Test("matchKind maps known match_type values, defaults to styling")
    func matchKindMapping() {
        #expect(TrendStore.matchKind(for: "exact_match") == .exact)
        #expect(TrendStore.matchKind(for: "adjacent_match") == .adjacent)
        #expect(TrendStore.matchKind(for: "missing_piece") == .missing)
        #expect(TrendStore.matchKind(for: "styling_match") == .styling)
        #expect(TrendStore.matchKind(for: "anything_else") == .styling)
    }

    @Test("map builds a TrendSignal from a matched row, including reasoning")
    func mapWithReasoning() {
        let signalID = UUID()
        let garmentID = UUID()
        let row = UserTrendMatchRow(
            matchType: "exact_match",
            reasoningJSON: TrendMatchReasoning(
                matchReason: "Your linen shirt matches this palette.",
                matchedGarmentIds: [garmentID.uuidString]
            ),
            trendSignal: TrendSignalRow(
                id: signalID.uuidString,
                trendType: "colour",
                label: "Sage green",
                canonicalLabel: "Sage",
                sourceCount: 5,
                confidenceScore: 0.8,
                trendConfidence: nil
            )
        )

        let signal = TrendStore.map(row)
        #expect(signal?.id == signalID)
        #expect(signal?.category == .colour)
        #expect(signal?.title == "Sage green")
        #expect(signal?.summary == "Sage")
        #expect(signal?.detail == "Your linen shirt matches this palette.")
        #expect(signal?.sourcesCount == 5)
        #expect(signal?.confidence == .high)
        #expect(signal?.matchKind == .exact)
        #expect(signal?.matchCount == 1)
        #expect(signal?.matchedPieceIDs == [garmentID])
        #expect(signal?.reasons == ["Your linen shirt matches this palette."])
    }

    @Test("map falls back to a source-count sentence when there's no reasoning")
    func mapWithoutReasoning() {
        let row = UserTrendMatchRow(
            matchType: "styling_match",
            reasoningJSON: nil,
            trendSignal: TrendSignalRow(
                id: UUID().uuidString,
                trendType: "silhouette",
                label: "Boxy blazer",
                canonicalLabel: nil,
                sourceCount: 1,
                confidenceScore: nil,
                trendConfidence: 0.5
            )
        )

        let signal = TrendStore.map(row)
        #expect(signal?.detail == "1 source is tracking this signal.")
        #expect(signal?.summary == "Boxy blazer")
        #expect(signal?.matchCount == 0)
        #expect(signal?.reasons == [])
    }

    @Test("map returns nil for an unparsable signal id")
    func mapRejectsInvalidID() {
        let row = UserTrendMatchRow(
            matchType: "exact_match",
            reasoningJSON: nil,
            trendSignal: TrendSignalRow(
                id: "not-a-uuid",
                trendType: "colour",
                label: "Sage",
                canonicalLabel: nil,
                sourceCount: 0,
                confidenceScore: nil,
                trendConfidence: nil
            )
        )
        #expect(TrendStore.map(row) == nil)
    }
}

@Suite("WeatherStore mapping")
@MainActor
struct WeatherStoreTests {

    @Test("symbol maps known WMO codes, defaults unknown/nil to cloud")
    func symbolMapping() {
        #expect(WeatherStore.symbol(forWMOCode: 0) == "sun.max")
        #expect(WeatherStore.symbol(forWMOCode: 2) == "cloud.sun")
        #expect(WeatherStore.symbol(forWMOCode: 3) == "cloud")
        #expect(WeatherStore.symbol(forWMOCode: 45) == "cloud.fog")
        #expect(WeatherStore.symbol(forWMOCode: 55) == "cloud.drizzle")
        #expect(WeatherStore.symbol(forWMOCode: 65) == "cloud.rain")
        #expect(WeatherStore.symbol(forWMOCode: 75) == "cloud.snow")
        #expect(WeatherStore.symbol(forWMOCode: 81) == "cloud.heavyrain")
        #expect(WeatherStore.symbol(forWMOCode: 99) == "cloud.bolt.rain")
        #expect(WeatherStore.symbol(forWMOCode: 12345) == "cloud")
        #expect(WeatherStore.symbol(forWMOCode: nil) == "cloud")
    }

    @Test("map rounds temperatures and falls back sensibly for missing fields")
    func mapRow() {
        let row = WeatherContextRow(
            currentTemperatureC: 18.6,
            tempMinC: 12.4,
            tempMaxC: 21.5,
            precipitationChance: 33.2,
            weatherCode: 61,
            conditionSummary: "Light rain",
            locationLabel: "Fitzroy VIC"
        )
        let local = WeatherStore.map(row)
        #expect(local.locationLabel == "Fitzroy VIC")
        #expect(local.weather.celsius == 19)
        #expect(local.weather.low == 12)
        #expect(local.weather.high == 22)
        #expect(local.weather.rainProbability == 33)
        #expect(local.weather.summary == "Light rain")
        #expect(local.weather.symbol == "cloud.rain")
    }

    @Test("map defaults missing min/max to the current temperature")
    func mapRowWithMissingRange() {
        let row = WeatherContextRow(
            currentTemperatureC: 15,
            tempMinC: nil,
            tempMaxC: nil,
            precipitationChance: nil,
            weatherCode: nil,
            conditionSummary: nil,
            locationLabel: "Unknown"
        )
        let local = WeatherStore.map(row)
        #expect(local.weather.low == 15)
        #expect(local.weather.high == 15)
        #expect(local.weather.rainProbability == 0)
        #expect(local.weather.summary == "")
        #expect(local.weather.symbol == "cloud")
    }
}

@Suite("LookbookStore mapping")
@MainActor
struct LookbookStoreTests {

    @Test("mapEntry derives board from the first aesthetic tag, or Unfiled")
    func boardDerivation() {
        let tagged = LookbookEntryRow(
            id: UUID().uuidString, title: "Look 1", description: nil, sourceUrl: nil,
            aestheticTags: ["Quiet luxury", "Minimal"], occasionTags: [], previewUrl: nil, items: []
        )
        #expect(LookbookStore.mapEntry(tagged)?.board == "Quiet luxury")

        let untagged = LookbookEntryRow(
            id: UUID().uuidString, title: "Look 2", description: nil, sourceUrl: nil,
            aestheticTags: [], occasionTags: [], previewUrl: nil, items: []
        )
        #expect(LookbookStore.mapEntry(untagged)?.board == "Unfiled")
    }

    @Test("mapEntry pulls owned piece ids and flags a missing piece with best-effort label/reason")
    func ownedAndMissingPieces() {
        let ownedID = UUID()
        let row = LookbookEntryRow(
            id: UUID().uuidString, title: "Look 3", description: "Note to self", sourceUrl: "pinterest.com/x",
            aestheticTags: [], occasionTags: [],
            previewUrl: "https://example.com/img.jpg",
            items: [
                LookbookItemRow(garmentId: ownedID.uuidString, desiredItemJSON: nil),
                LookbookItemRow(garmentId: nil, desiredItemJSON: ["label": AnyDecodableValue.fixture("Cream trench")])
            ]
        )
        let entry = LookbookStore.mapEntry(row)
        #expect(entry?.ownedPieceIDs == [ownedID])
        #expect(entry?.missingPiece?.label == "Cream trench")
        #expect(entry?.missingPiece?.reason == "Not yet in your wardrobe.")
        #expect(entry?.matchKind == .exact)
        #expect(entry?.note == "Note to self")
        #expect(entry?.imageURL.absoluteString == "https://example.com/img.jpg")
    }

    @Test("mapEntry flags missing when there's a desired item with no owned piece")
    func missingOnlyMatchKind() {
        let row = LookbookEntryRow(
            id: UUID().uuidString, title: nil, description: nil, sourceUrl: nil,
            aestheticTags: [], occasionTags: [], previewUrl: nil,
            items: [LookbookItemRow(garmentId: nil, desiredItemJSON: [:])]
        )
        let entry = LookbookStore.mapEntry(row)
        #expect(entry?.title == "Untitled")
        #expect(entry?.matchKind == .missing)
        #expect(entry?.missingPiece?.label == "An item for this look")
    }

    @Test("mapEntry falls to styling when there's neither an owned nor a missing piece")
    func stylingMatchKind() {
        let row = LookbookEntryRow(
            id: UUID().uuidString, title: "Look 4", description: nil, sourceUrl: nil,
            aestheticTags: [], occasionTags: [], previewUrl: nil, items: []
        )
        #expect(LookbookStore.mapEntry(row)?.matchKind == .styling)
    }

    @Test("mapEntry returns nil for an unparsable entry id")
    func rejectsInvalidID() {
        let row = LookbookEntryRow(
            id: "not-a-uuid", title: nil, description: nil, sourceUrl: nil,
            aestheticTags: [], occasionTags: [], previewUrl: nil, items: []
        )
        #expect(LookbookStore.mapEntry(row) == nil)
    }

    @Test("deriveBoards groups by board name and features the largest group")
    func boardDerivationFromEntries() {
        func entry(board: String) -> LookbookEntry {
            LookbookEntry(
                id: UUID(), title: "T", imageURL: URL(string: "https://example.com")!,
                board: board, tags: [], sourceURL: "", ownedPieceIDs: [], missingPiece: nil,
                matchKind: .styling, note: nil
            )
        }
        let entries = [entry(board: "A"), entry(board: "A"), entry(board: "B")]
        let boards = LookbookStore.deriveBoards(from: entries)

        #expect(boards.count == 2)
        #expect(boards.first?.name == "A")
        #expect(boards.first?.count == 2)
        #expect(boards.first?.isFeatured == true)
        #expect(boards.last?.isFeatured == false)
    }
}

private extension AnyDecodableValue {
    /// AnyDecodableValue only decodes through `init(from:)`, so tests build one
    /// via a tiny JSON round-trip rather than reimplementing its decoding here.
    static func fixture(_ string: String) -> AnyDecodableValue {
        let data = try! JSONEncoder().encode(string)
        return try! JSONDecoder().decode(AnyDecodableValue.self, from: data)
    }
}

@Suite("OutfitStore mapping")
@MainActor
struct OutfitStoreTests {

    @Test("request builders send the expected mode/dress_code/trend_signal_id")
    func requestBuilders() throws {
        let encoder = JSONEncoder()

        let surprise = try JSONDecoder().decode([String: String?].self, from: encoder.encode(GenerateOutfitRequest.surprise()))
        #expect(surprise["mode"] == "surprise")
        #expect(surprise["dress_code"] == nil)
        #expect(surprise["trend_signal_id"] == nil)

        let plan = try JSONDecoder().decode([String: String?].self, from: encoder.encode(GenerateOutfitRequest.plan(dressCode: "business_casual")))
        #expect(plan["mode"] == "plan")
        #expect(plan["dress_code"] == "business_casual")

        let signalID = UUID()
        let trend = try JSONDecoder().decode([String: String?].self, from: encoder.encode(GenerateOutfitRequest.trend(signalID: signalID)))
        #expect(trend["mode"] == "trend")
        #expect(trend["trend_signal_id"] == signalID.uuidString.lowercased())
    }

    @Test("role(for:) maps known API roles, defaults unknown to layer")
    func roleMapping() {
        #expect(OutfitStore.role(for: "top") == .top)
        #expect(OutfitStore.role(for: "bottom") == .bottom)
        #expect(OutfitStore.role(for: "dress") == .dress)
        #expect(OutfitStore.role(for: "outerwear") == .outer)
        #expect(OutfitStore.role(for: "shoes") == .shoes)
        #expect(OutfitStore.role(for: "bag") == .bag)
        #expect(OutfitStore.role(for: "accessory") == .layer)
        #expect(OutfitStore.role(for: "jewellery") == .layer)
    }

    @Test("apiRole(for:) round-trips role(for:) for every real API role")
    @MainActor
    func apiRoleRoundTrip() {
        let store = OutfitStore()
        let roles: [Outfit.Piece.Role] = [.top, .bottom, .dress, .outer, .shoes, .bag, .layer]
        for role in roles {
            let apiValue = store.apiRole(for: role)
            #expect(OutfitStore.role(for: apiValue) == role)
        }
    }

    @Test("symbol(for:) maps known insight keys, defaults unknown to sparkles")
    func insightSymbolMapping() {
        #expect(OutfitStore.symbol(for: "palette") == "paintpalette")
        #expect(OutfitStore.symbol(for: "layering") == "square.stack")
        #expect(OutfitStore.symbol(for: "weather") == "cloud.sun")
        #expect(OutfitStore.symbol(for: "occasion") == "checkmark.seal")
        #expect(OutfitStore.symbol(for: "unknown_key") == "sparkles")
    }

    @Test("map builds pieces/reasons and only credits a real trend match")
    func mapGeneratedOutfit() {
        let topID = UUID()
        let bottomID = UUID()
        let row = GeneratedOutfitRow(
            garments: [
                GarmentPreviewRow(id: topID.uuidString, title: "Linen shirt", category: "top", role: "top"),
                GarmentPreviewRow(id: bottomID.uuidString, title: "Wide trousers", category: "bottom", role: "bottom")
            ],
            insights: [InsightRow(key: "palette", title: "Tonal", body: "Sits within your usual palette.")]
        )

        let trendOutfit = OutfitStore.map(row, variant: .trend, usedRealTrendMatch: true)
        #expect(trendOutfit.variant == .trend)
        #expect(trendOutfit.pieces.map(\.id) == [topID, bottomID])
        #expect(trendOutfit.pieces.first?.isAnchor == true)
        #expect(trendOutfit.pieces.last?.isAnchor == false)
        #expect(trendOutfit.pieces.first?.role == .top)
        #expect(trendOutfit.title == "Linen shirt, Wide trousers")
        #expect(trendOutfit.signalsMatched == 1)
        #expect(trendOutfit.reasons.first?.icon == "paintpalette")
        #expect(trendOutfit.reasons.first?.headline == "Tonal")

        let fallbackOutfit = OutfitStore.map(row, variant: .trend, usedRealTrendMatch: false)
        #expect(fallbackOutfit.signalsMatched == 0)
    }

    @Test("map skips garments with an unparsable id rather than crashing")
    func mapSkipsInvalidGarmentID() {
        let row = GeneratedOutfitRow(
            garments: [GarmentPreviewRow(id: "not-a-uuid", title: nil, category: "top", role: "top")],
            insights: []
        )
        let outfit = OutfitStore.map(row, variant: .safe, usedRealTrendMatch: false)
        #expect(outfit.pieces.isEmpty)
        #expect(outfit.title == "")
    }
}

@Suite("SavedOutfitsStore mapping")
@MainActor
struct SavedOutfitsStoreTests {

    @Test("map builds a SavedOutfit, falling back to honest defaults")
    func mapRow() {
        let outfitID = UUID()
        let garmentID = UUID()
        let row = SavedOutfitRow(
            id: outfitID.uuidString, title: "The tonal blazer", occasion: "Workwear",
            items: [SavedOutfitItemRow(garmentId: garmentID.uuidString)],
            timesWorn: 3, lastWornAt: "2026-04-20T09:15:30.123456+00:00"
        )
        let saved = SavedOutfitsStore.map(row)
        #expect(saved?.id == outfitID)
        #expect(saved?.kind == "Workwear")
        #expect(saved?.title == "The tonal blazer")
        #expect(saved?.timesWorn == 3)
        #expect(saved?.pieceIDs == [garmentID])
        #expect(saved?.lastWorn != nil)
    }

    @Test("map defaults an empty title and a nil last-worn honestly")
    func mapRowWithMissingFields() {
        let row = SavedOutfitRow(
            id: UUID().uuidString, title: "", occasion: nil,
            items: [], timesWorn: 0, lastWornAt: nil
        )
        let saved = SavedOutfitsStore.map(row)
        #expect(saved?.title == "Untitled outfit")
        #expect(saved?.kind == "Outfit")
        #expect(saved?.lastWorn == nil)
        #expect(saved?.pieceIDs == [])
    }

    @Test("map returns nil for an unparsable outfit id")
    func mapRejectsInvalidID() {
        let row = SavedOutfitRow(
            id: "not-a-uuid", title: nil, occasion: nil, items: [], timesWorn: 0, lastWornAt: nil
        )
        #expect(SavedOutfitsStore.map(row) == nil)
    }

    @Test("parseTimestamp accepts both fractional and whole-second Postgres timestamps")
    func timestampParsing() {
        #expect(SavedOutfitsStore.parseTimestamp("2026-04-20T09:15:30.123456+00:00") != nil)
        #expect(SavedOutfitsStore.parseTimestamp("2026-04-20T09:15:30+00:00") != nil)
        #expect(SavedOutfitsStore.parseTimestamp("not-a-date") == nil)
    }
}

@Suite("RulesStore mapping")
@MainActor
struct RulesStoreTests {

    @Test("map builds a StyleRule, normalising weight from a 0-100 scale")
    func mapRow() {
        let row = StyleRuleRow(
            id: UUID().uuidString, subjectValue: "denim", predicate: "pairs_with", objectValue: "white shirt",
            weight: 80, ruleScope: "canon", explanation: "A reliable pairing.", active: true
        )
        let rule = RulesStore.map(row)
        #expect(rule?.subject == "denim")
        #expect(rule?.predicate == .pairsWith)
        #expect(rule?.object == "white shirt")
        #expect(rule?.weight == 0.8)
        #expect(rule?.scope == .canon)
        #expect(rule?.isActive == true)
        #expect(rule?.rationale == "A reliable pairing.")
    }

    @Test("map scopes user-authored rules to yours")
    func mapUserScope() {
        let row = StyleRuleRow(
            id: UUID().uuidString, subjectValue: "a", predicate: "avoid_with", objectValue: "b",
            weight: 50, ruleScope: "user", explanation: nil, active: false
        )
        #expect(RulesStore.map(row)?.scope == .yours)
        #expect(RulesStore.map(row)?.isActive == false)
    }

    @Test("map clamps out-of-range weights into 0...1")
    func mapClampsWeight() {
        let over = StyleRuleRow(
            id: UUID().uuidString, subjectValue: "a", predicate: "seasonality", objectValue: "b",
            weight: 250, ruleScope: "canon", explanation: nil, active: true
        )
        #expect(RulesStore.map(over)?.weight == 1)

        let under = StyleRuleRow(
            id: UUID().uuidString, subjectValue: "a", predicate: "seasonality", objectValue: "b",
            weight: -40, ruleScope: "canon", explanation: nil, active: true
        )
        #expect(RulesStore.map(under)?.weight == 0)
    }

    @Test("map returns nil for an unknown predicate or an unparsable id")
    func mapRejectsInvalidRows() {
        let unknownPredicate = StyleRuleRow(
            id: UUID().uuidString, subjectValue: "a", predicate: "not_a_real_predicate", objectValue: "b",
            weight: 50, ruleScope: "canon", explanation: nil, active: true
        )
        #expect(RulesStore.map(unknownPredicate) == nil)

        let invalidID = StyleRuleRow(
            id: "not-a-uuid", subjectValue: "a", predicate: "pairs_with", objectValue: "b",
            weight: 50, ruleScope: "canon", explanation: nil, active: true
        )
        #expect(RulesStore.map(invalidID) == nil)
    }
}
