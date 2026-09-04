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

/// One day's plan in the "Generate the week" sheet — the editable input,
/// distinct from DayPlan below (the WeekStrip's read-only display model).
struct WeekDayPlan: Identifiable, Hashable {
    let id = UUID()
    var date: Date
    var occasion: OccasionPreset
}

/// A fixed catalogue rather than freeform text, so each occasion maps to a
/// real dress_code the generator's style rules actually filter/boost
/// against (see lib/domain/style-rules/knowledge/formality.ts) — "skip"
/// means this day is left out of the week's generate request entirely.
enum OccasionPreset: String, CaseIterable, Hashable {
    case workwear        = "Workwear — studio"
    case clientMeeting   = "Client meeting"
    case clientLunch     = "Client lunch"
    case eveningEvent    = "Evening event"
    case weekendCasual   = "Weekend casual"
    case travel          = "Travel"
    case skip            = "None · skip"

    var dressCode: String? {
        switch self {
        case .workwear, .clientMeeting:  return "business_casual"
        case .clientLunch:               return "smart_casual"
        case .eveningEvent:              return "formal"
        case .weekendCasual, .travel:    return "casual"
        case .skip:                      return nil
        }
    }

    var isSkipped: Bool { self == .skip }
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
    let lastWorn: Date?            // nil until a wear_events row links to this outfit
    let pieceIDs: [UUID]
}
