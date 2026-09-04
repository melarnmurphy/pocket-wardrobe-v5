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
    // wear_events has no photo/weather columns — real entries always have
    // these nil rather than a fabricated value. Diary logging has no photo
    // storage yet either (see LogOutfitSheet), so this stays nil in practice.
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
