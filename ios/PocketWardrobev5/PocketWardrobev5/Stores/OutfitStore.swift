// Stores/OutfitStore.swift
//
// Calls POST /api/mobile/outfits/generate for all three Planner variants in
// parallel, using real, distinct generator inputs rather than three copies of
// the same call:
//   - Safe          -> mode "surprise" (no dress-code constraint)
//   - Elevated      -> mode "plan", dress_code "business_casual" (a real
//                      value from lib/domain/style-rules/knowledge/formality.ts —
//                      hard-filters/boosts against actual style rules, not a
//                      cosmetic label)
//   - Trend-forward -> mode "trend" against the caller's top TrendStore match,
//                      falling back to "surprise" if the user has no matches
// This reuses the exact rules engine the web app calls — no new generation
// logic, just three different, real inputs to it.
//
// Still on SampleData (a later, larger design pass, not a wiring gap): the
// batched weekly generation, per-day occasion preferences, weather/occasion
// narrative, laundry-aware ranking, "alternatives," and the saved-outfits
// gallery read.

import Foundation

private struct GenerateOutfitRequest: Encodable {
    let mode: String
    let dress_code: String?
    let trend_signal_id: String?

    static func surprise() -> GenerateOutfitRequest {
        GenerateOutfitRequest(mode: "surprise", dress_code: nil, trend_signal_id: nil)
    }
    static func plan(dressCode: String) -> GenerateOutfitRequest {
        GenerateOutfitRequest(mode: "plan", dress_code: dressCode, trend_signal_id: nil)
    }
    static func trend(signalID: UUID) -> GenerateOutfitRequest {
        GenerateOutfitRequest(mode: "trend", dress_code: nil, trend_signal_id: signalID.uuidString.lowercased())
    }
}

private struct GarmentPreviewRow: Decodable {
    let id: String
    let title: String?
    let category: String
    let role: String
}

private struct InsightRow: Decodable {
    let key: String
    let title: String
    let body: String
}

private struct GeneratedOutfitRow: Decodable {
    let garments: [GarmentPreviewRow]
    let insights: [InsightRow]
}

private struct GenerateOutfitResponse: Decodable {
    let outfit: GeneratedOutfitRow
}

private struct SaveOutfitGarment: Encodable {
    let garment_id: String
    let role: String
}

private struct SaveOutfitRequest: Encodable {
    let title: String?
    let garments: [SaveOutfitGarment]
}

private struct SaveOutfitResponse: Decodable {
    let outfit_id: String
}

@Observable
@MainActor
final class OutfitStore {
    var outfits: [Outfit.Variant: Outfit] = [:]
    var state: LoadState = .idle
    var saveError: String?

    /// Generates all three variants in parallel. Pass the id of the user's
    /// top TrendStore match (if any) so Trend-forward can use it; without
    /// one, that variant falls back to the same "surprise" pick as Safe.
    func generateAll(topTrendSignalID: UUID?) async {
        guard state != .loading else { return }
        state = .loading
        do {
            let trendRequest: GenerateOutfitRequest = topTrendSignalID.map { .trend(signalID: $0) } ?? .surprise()

            async let safe = generate(.surprise(), variant: .safe)
            async let elevated = generate(.plan(dressCode: "business_casual"), variant: .elevated)
            async let trend = generate(trendRequest, variant: .trend)

            outfits = [
                .safe: try await safe,
                .elevated: try await elevated,
                .trend: try await trend
            ]
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func save(_ outfit: Outfit) async {
        saveError = nil
        do {
            let body = SaveOutfitRequest(
                title: outfit.title.isEmpty ? nil : outfit.title,
                garments: outfit.pieces.map {
                    SaveOutfitGarment(garment_id: $0.id.uuidString.lowercased(), role: apiRole(for: $0.role))
                }
            )
            let _: SaveOutfitResponse = try await MobileAPIClient.post("/api/mobile/outfits/save", body: body)
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func generate(_ request: GenerateOutfitRequest, variant: Outfit.Variant) async throws -> Outfit {
        let response: GenerateOutfitResponse = try await MobileAPIClient.post(
            "/api/mobile/outfits/generate",
            body: request
        )
        return Self.map(response.outfit, variant: variant, usedRealTrendMatch: request.mode == "trend")
    }

    private static func map(_ row: GeneratedOutfitRow, variant: Outfit.Variant, usedRealTrendMatch: Bool) -> Outfit {
        let pieces: [Outfit.Piece] = row.garments.enumerated().compactMap { index, g in
            guard let id = UUID(uuidString: g.id) else { return nil }
            return Outfit.Piece(id: id, role: role(for: g.role), isAnchor: index == 0)
        }

        let reasons: [Outfit.Reason] = row.insights.map { insight in
            Outfit.Reason(icon: symbol(for: insight.key), headline: insight.title, body: insight.body)
        }

        return Outfit(
            id: UUID(),
            date: Date(),
            variant: variant,
            title: row.garments.compactMap(\.title).joined(separator: ", "),
            occasion: "",
            pieces: pieces,
            signalsMatched: usedRealTrendMatch ? 1 : 0,
            reasons: reasons,
            weather: Outfit.Weather(celsius: 0, summary: "", low: 0, high: 0, rainProbability: 0, symbol: "cloud")
        )
    }

    private static func role(for apiRole: String) -> Outfit.Piece.Role {
        switch apiRole {
        case "top":        return .top
        case "bottom":     return .bottom
        case "dress":      return .dress
        case "outerwear":  return .outer
        case "shoes":      return .shoes
        case "bag":        return .bag
        default:           return .layer  // accessory / jewellery / other
        }
    }

    private func apiRole(for role: Outfit.Piece.Role) -> String {
        switch role {
        case .anchor:  return "top"       // Piece.role never decodes to .anchor; isAnchor is separate
        case .top:     return "top"
        case .bottom:  return "bottom"
        case .shoes:   return "shoes"
        case .bag:     return "bag"
        case .layer:   return "other"
        case .outer:   return "outerwear"
        case .dress:   return "dress"
        }
    }

    private static func symbol(for insightKey: String) -> String {
        switch insightKey {
        case "palette":  return "paintpalette"
        case "layering": return "square.stack"
        case "weather":  return "cloud.sun"
        case "occasion": return "checkmark.seal"
        default:         return "sparkles"
        }
    }
}
