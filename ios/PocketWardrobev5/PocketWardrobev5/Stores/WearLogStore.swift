// Stores/WearLogStore.swift
//
// Persists the Diary's "what you wore" log by calling POST
// /api/mobile/wear-events — one real wear_events row per selected garment.
// This is the signal the week planner's laundry-awareness (OutfitStore/
// generateWeekOfOutfits) hard-excludes on; before this, the only way to
// produce it was the web wardrobe closet's "Log Wear" form.

import Foundation

private struct LogWearEventsRequest: Encodable {
    let garment_ids: [String]
    let worn_at: String?
    let occasion: String?
    let notes: String?
}

private struct LogWearEventsResponse: Decodable {
    let logged: Int
}

@Observable
@MainActor
final class WearLogStore {
    var isSaving = false
    var errorMessage: String?

    /// Returns true on success. Callers dismiss their sheet on true and
    /// leave errorMessage displayed on false.
    @discardableResult
    func logWear(garmentIDs: [UUID], date: Date, occasion: String, notes: String) async -> Bool {
        guard !garmentIDs.isEmpty else {
            errorMessage = "Select at least one piece."
            return false
        }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let formatter = ISO8601DateFormatter()
            let body = LogWearEventsRequest(
                garment_ids: garmentIDs.map { $0.uuidString.lowercased() },
                worn_at: formatter.string(from: date),
                occasion: occasion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : occasion,
                notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes
            )
            let _: LogWearEventsResponse = try await MobileAPIClient.post("/api/mobile/wear-events", body: body)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
