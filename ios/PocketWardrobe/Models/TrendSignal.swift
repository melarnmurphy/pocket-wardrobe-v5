//
//  TrendSignal.swift
//  Pocket Wardrobe — a normalised signal from editorial / runway / press / brand.
//
//  Mirrors the `trend_signals` table collapsed for UI. Every signal has a
//  category, a confidence level, and a match against the user's wardrobe.
//

import Foundation

struct TrendSignal: Identifiable, Hashable {
    let id: UUID
    let category: Category
    let title: String              // "Soft white neutrals"
    let summary: String            // one-liner for cards
    let detail: String             // longer paragraph for the sheet
    let swatches: [UInt32]         // palette swatches (hex)
    let sourcesCount: Int
    let sourceKinds: [String]      // ["Publications", "Runway"]
    let confidence: Confidence
    let matchKind: MatchKind
    let matchCount: Int            // pieces you own that map
    let matchedPieceIDs: [UUID]    // references to your Garments
    let canonicalPalette: [PaletteSwatch]
    let reasons: [String]          // "Why it matters" bullets
    let isSignalOfWeek: Bool

    enum Category: String, CaseIterable, Hashable {
        case colour      = "Colour"
        case garment     = "Garment"
        case silhouette  = "Silhouette"
        case material    = "Material"
        case aesthetic   = "Aesthetic"
        case pattern     = "Pattern"
    }

    enum Confidence: Hashable {
        case low, medium, high

        var label: String {
            switch self {
            case .low:     return "Low confidence"
            case .medium:  return "Medium confidence"
            case .high:    return "High confidence"
            }
        }

        var bars: Int {
            switch self {
            case .low: return 1; case .medium: return 2; case .high: return 3
            }
        }
    }

    struct PaletteSwatch: Hashable {
        let hex: UInt32
        let name: String           // "Ivory"
    }
}

/// "Noticing, not pushing" — unmatched signals shown in the secondary grid.
struct UnmatchedSignal: Identifiable, Hashable {
    let id: UUID
    let category: TrendSignal.Category
    let title: String
    let sourcesCount: Int
    let confidence: TrendSignal.Confidence
}
