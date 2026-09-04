// Stores/SavedOutfitsStore.swift
//
// Maps GET /api/mobile/outfits onto SavedOutfit, the model the Planner's
// "Outfits you love" gallery already expects. times_worn/last_worn_at come
// from the mobile route aggregating wear_events by outfit_id — nothing
// tracks that per-outfit anywhere else in the app yet (see the route's own
// comment), so a freshly-saved outfit honestly shows 0 / never worn rather
// than a fabricated number.

import Foundation

struct SavedOutfitItemRow: Decodable {
    let garmentId: String

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
    }
}

struct SavedOutfitRow: Decodable {
    let id: String
    let title: String?
    let occasion: String?
    let items: [SavedOutfitItemRow]
    let timesWorn: Int
    let lastWornAt: String?

    enum CodingKeys: String, CodingKey {
        case id, title, occasion, items
        case timesWorn = "times_worn"
        case lastWornAt = "last_worn_at"
    }
}

private struct SavedOutfitsResponse: Decodable {
    let outfits: [SavedOutfitRow]
}

@Observable
@MainActor
final class SavedOutfitsStore {
    var outfits: [SavedOutfit] = []
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: SavedOutfitsResponse = try await MobileAPIClient.get("/api/mobile/outfits")
            outfits = response.outfits.compactMap(Self.map)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    static func map(_ row: SavedOutfitRow) -> SavedOutfit? {
        guard let id = UUID(uuidString: row.id) else { return nil }
        let pieceIDs = row.items.compactMap { UUID(uuidString: $0.garmentId) }
        let title = row.title?.isEmpty == false ? row.title! : "Untitled outfit"

        return SavedOutfit(
            id: id,
            kind: row.occasion ?? "Outfit",
            title: title,
            timesWorn: row.timesWorn,
            lastWorn: row.lastWornAt.flatMap(parseTimestamp),
            pieceIDs: pieceIDs
        )
    }

    /// Postgres timestamptz comes back as ISO-8601 with fractional seconds
    /// ("2026-04-20T09:15:30.123456+00:00"); fall back to whole-seconds form
    /// since Postgres can omit the fraction entirely for a :00 microsecond value.
    static func parseTimestamp(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: raw) { return date }

        let wholeSeconds = ISO8601DateFormatter()
        wholeSeconds.formatOptions = [.withInternetDateTime]
        return wholeSeconds.date(from: raw)
    }
}
