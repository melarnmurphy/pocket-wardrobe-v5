// Stores/OutfitStore.swift
//
// Calls POST /api/mobile/outfits/generate (mode "surprise" — no occasion/dress
// code/weather params) and maps the result onto the Outfit model. The web
// generator returns ONE outfit per call; it has no concept of the Planner
// mockup's three simultaneous Safe/Elevated/Trend-forward variants or a
// batched "generate the week" — those are UI concepts nothing server-side
// produces yet. This wires the real, single-outfit generation path; the
// variant tabs, weather/occasion/availability context cards, "alternatives,"
// and saved-outfits gallery in PlannerView stay on SampleData until that
// larger product question (batched week generation, saved-outfit storage,
// laundry tracking) gets its own design pass.

import Foundation

private struct GenerateOutfitRequest: Encodable {
    let mode = "surprise"
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

@Observable
@MainActor
final class OutfitStore {
    var current: Outfit?
    var state: LoadState = .idle

    func generateSurprise() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: GenerateOutfitResponse = try await MobileAPIClient.post(
                "/api/mobile/outfits/generate",
                body: GenerateOutfitRequest()
            )
            current = Self.map(response.outfit)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private static func map(_ row: GeneratedOutfitRow) -> Outfit {
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
            variant: .safe,
            title: row.garments.compactMap(\.title).joined(separator: ", "),
            occasion: "",
            pieces: pieces,
            signalsMatched: 0,
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
