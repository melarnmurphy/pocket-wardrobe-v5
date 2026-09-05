// Stores/WearLogStore.swift
//
// Persists the Diary's "what you wore" log by calling POST
// /api/mobile/wear-events — one real wear_events row per selected garment.
// This is the signal the week planner's laundry-awareness (OutfitStore/
// generateWeekOfOutfits) hard-excludes on; before this, the only way to
// produce it was the web wardrobe closet's "Log Wear" form.
//
// Also reads GET /api/mobile/wear-events for the Diary calendar: the route
// returns one row per garment per wear, grouped here into a per-day
// WearEvent — a day can have several pieces logged in one submission.

import Foundation

private struct LogWearEventsRequest: Encodable {
    let garment_ids: [String]
    let worn_at: String?
    let occasion: String?
    let notes: String?
}

private let logWearEventsJSONEncoder = JSONEncoder()

private struct LogWearEventsResponse: Decodable {
    let logged: Int
}

struct WearEventRow: Decodable {
    let id: String
    let garmentId: String
    let wornAt: String
    let occasion: String?
    let notes: String?
    let outfitId: String?
    let garmentTitle: String?
    let garmentCategory: String?
    let garmentPreviewUrl: String?
    let photoUrl: String?

    init(
        id: String,
        garmentId: String,
        wornAt: String,
        occasion: String?,
        notes: String?,
        outfitId: String?,
        garmentTitle: String?,
        garmentCategory: String?,
        garmentPreviewUrl: String?,
        photoUrl: String? = nil
    ) {
        self.id = id
        self.garmentId = garmentId
        self.wornAt = wornAt
        self.occasion = occasion
        self.notes = notes
        self.outfitId = outfitId
        self.garmentTitle = garmentTitle
        self.garmentCategory = garmentCategory
        self.garmentPreviewUrl = garmentPreviewUrl
        self.photoUrl = photoUrl
    }

    enum CodingKeys: String, CodingKey {
        case id
        case garmentId = "garment_id"
        case wornAt = "worn_at"
        case occasion, notes
        case outfitId = "outfit_id"
        case garmentTitle = "garment_title"
        case garmentCategory = "garment_category"
        case garmentPreviewUrl = "garment_preview_url"
        case photoUrl = "photo_url"
    }
}

private struct ListWearEventsResponse: Decodable {
    let events: [WearEventRow]
}

@Observable
@MainActor
final class WearLogStore {
    var isSaving = false
    var errorMessage: String?

    var events: [WearEvent] = []
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: ListWearEventsResponse = try await MobileAPIClient.get("/api/mobile/wear-events")
            events = Self.groupByDay(response.events)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    /// One WearEvent per calendar day, in the device's current timezone.
    static func groupByDay(_ rows: [WearEventRow]) -> [WearEvent] {
        let calendar = Calendar.current
        var byDay: [Date: [WearEventRow]] = [:]
        for row in rows {
            guard let date = SavedOutfitsStore.parseTimestamp(row.wornAt) else { continue }
            let dayStart = calendar.startOfDay(for: date)
            byDay[dayStart, default: []].append(row)
        }

        return byDay.map { day, dayRows in
            let pieceIDs = dayRows.compactMap { UUID(uuidString: $0.garmentId) }
            let titles = dayRows.compactMap { $0.garmentTitle?.isEmpty == false ? $0.garmentTitle : nil }
            let occasion = dayRows.compactMap { $0.occasion?.isEmpty == false ? $0.occasion : nil }.first ?? ""
            let note = dayRows.compactMap { $0.notes?.isEmpty == false ? $0.notes : nil }.first
            let hasLinkedOutfit = dayRows.contains { $0.outfitId != nil }
            // Every row in a day's submission shares the same photo (one
            // selfie per LogOutfitSheet save), so the first non-nil URL is
            // the day's photo.
            let photoURLString = dayRows.compactMap { $0.photoUrl?.isEmpty == false ? $0.photoUrl : nil }.first

            return WearEvent(
                id: UUID(),
                date: day,
                title: titles.isEmpty ? "Untitled" : titles.joined(separator: ", "),
                occasion: occasion,
                photoURL: photoURLString.flatMap(URL.init(string:)),
                pieceIDs: pieceIDs,
                note: note,
                isFavourite: false,
                weatherC: nil,
                weatherSummary: nil,
                source: hasLinkedOutfit ? .planner : .pickFromCloset
            )
        }
        .sorted { $0.date > $1.date }
    }

    /// Returns true on success. Callers dismiss their sheet on true and
    /// leave errorMessage displayed on false. `photoData`, when present, is
    /// the one "photo of you in it" LogOutfitSheet's drop zone captured —
    /// it lands on every wear_events row this submission creates.
    @discardableResult
    func logWear(garmentIDs: [UUID], date: Date, occasion: String, notes: String, photoData: Data? = nil) async -> Bool {
        guard !garmentIDs.isEmpty else {
            errorMessage = "Select at least one piece."
            return false
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let formatter = ISO8601DateFormatter()
        let garmentIdStrings = garmentIDs.map { $0.uuidString.lowercased() }
        let trimmedOccasion = occasion.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedNotes = notes.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            if let photoData {
                guard let garmentIdsJSON = try? logWearEventsJSONEncoder.encode(garmentIdStrings),
                      let garmentIdsField = String(data: garmentIdsJSON, encoding: .utf8) else {
                    errorMessage = "Could not prepare the pieces to log."
                    return false
                }
                var fields: [String: String] = [
                    "garment_ids": garmentIdsField,
                    "worn_at": formatter.string(from: date)
                ]
                if !trimmedOccasion.isEmpty { fields["occasion"] = trimmedOccasion }
                if !trimmedNotes.isEmpty { fields["notes"] = trimmedNotes }

                let _: LogWearEventsResponse = try await MobileAPIClient.uploadMultipart(
                    "/api/mobile/wear-events",
                    fields: fields,
                    imageData: photoData,
                    filename: "wear-event.jpg",
                    mimeType: "image/jpeg"
                )
            } else {
                let body = LogWearEventsRequest(
                    garment_ids: garmentIdStrings,
                    worn_at: formatter.string(from: date),
                    occasion: trimmedOccasion.isEmpty ? nil : trimmedOccasion,
                    notes: trimmedNotes.isEmpty ? nil : trimmedNotes
                )
                let _: LogWearEventsResponse = try await MobileAPIClient.post("/api/mobile/wear-events", body: body)
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
