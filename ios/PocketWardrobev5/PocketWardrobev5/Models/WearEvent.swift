//
//  WearEvent.swift
//  Pocket Wardrobe — a diary entry: what you wore on a given day.
//
//  Maps to the `wear_events` table + the outfit you wore, flattened for UI.
//

import Foundation

struct WearEvent: Identifiable, Hashable {
    let id: UUID
    let date: Date
    let title: String              // "Workwear, the tonal one"
    let occasion: String           // "Workwear · studio"
    // wear_events has no weather columns — real entries always have those
    // nil rather than a fabricated value. photoURL is real: it comes from
    // wear_events.photo_storage_path (LogOutfitSheet's capture flow),
    // resolved server-side to a signed URL, and is nil only for entries
    // logged without a photo.
    let photoURL: URL?
    let pieceIDs: [UUID]            // references into Garment seed
    let note: String?
    let isFavourite: Bool
    let weatherC: Int?              // degrees celsius
    let weatherSummary: String?     // "cloudy, light wind"
    let source: Source             // how it got into the diary

    enum Source: String, Hashable {
        case planner       = "Linked to a saved outfit"
        case manualPhoto   = "Photo only"
        case pickFromCloset = "Picked from closet"
    }
}
