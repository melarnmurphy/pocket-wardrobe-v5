//
//  Outfit.swift
//  Pocket Wardrobe — a composed outfit (Planner + Saved).
//
//  Mirrors `outfits` table + the per-day Planner materialised view. Each outfit is
//  a set of garments with roles, a reasoning list, and a variant tag.
//

import Foundation

struct Outfit: Identifiable, Hashable {
    let id: UUID
    let date: Date                 // the day the variant is for
    let variant: Variant
    let title: String              // "Beige, taupe, a quiet ivory blouse."
    let occasion: String           // "Workwear · studio"
    let pieces: [Piece]            // ordered: anchor first, then support
    let signalsMatched: Int        // count of trend signals matched
    let reasons: [Reason]          // "Why this outfit" editorial bullets
    let weather: Weather

    enum Variant: String, CaseIterable, Hashable {
        case safe       = "Safe"
        case elevated   = "Elevated"
        case trend      = "Trend-forward"

        var caption: String {
            switch self {
            case .safe:     return "reliable"
            case .elevated: return "a little more"
            case .trend:    return "aligned with signals"
            }
        }
    }

    struct Piece: Identifiable, Hashable {
        let id: UUID               // matches Garment.id
        let role: Role             // "Blazer · Anchor", "Top", "Trouser"
        let isAnchor: Bool

        enum Role: String, Hashable {
            case anchor  = "Anchor"
            case top     = "Top"
            case bottom  = "Trouser"
            case shoes   = "Shoes"
            case bag     = "Bag"
            case layer   = "Layer"
            case outer   = "Outer"
            case dress   = "Dress"
        }
    }

    struct Reason: Identifiable, Hashable {
        let id = UUID()
        let icon: String           // SF Symbol
        let headline: String       // "Tonal palette — bone, sand, umber."
        let body: String
    }

    struct Weather: Hashable {
        let celsius: Int
        let summary: String        // "cloudy, light wind"
        let low: Int
        let high: Int
        let rainProbability: Int   // percent
        let symbol: String         // SF Symbol: "cloud.fill", "sun.max.fill"
    }
}

/// One day in the week strip at the top of the Planner.
struct DayPlan: Identifiable, Hashable {
    let id = UUID()
    let date: Date
    let weekday: String            // "Mon", "Tue"
    let dayNumber: Int
    let weatherC: Int
    let weatherSummary: String
    let weatherSymbol: String
    let occasion: String           // "Workwear", "Client lunch", "Unplanned"
    let isPlanned: Bool
}

/// Saved outfit "you love", shown in the Planner bottom section.
struct SavedOutfit: Identifiable, Hashable {
    let id: UUID
    let kind: String               // "Workwear", "Evening"
    let title: String              // "The tonal blazer"
    let timesWorn: Int
    let lastWorn: Date
    let pieceIDs: [UUID]
}

/// A one-line alternative shown in the Planner right column.
struct OutfitAlternative: Identifiable, Hashable {
    let id = UUID()
    let title: String              // "Knit & denim"
    let caption: String            // "Softer, more casual · 4 pieces"
    let thumbnailURLs: [URL]       // up to 4 previews
}
