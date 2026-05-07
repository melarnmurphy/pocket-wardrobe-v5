//
//  StyleRule.swift
//  Pocket Wardrobe — the grammar of a wardrobe.
//
//  Each rule is a (subject, predicate, object) triple with a weight and scope. Matches
//  the `style_rules` table.
//

import Foundation
import SwiftUI

struct StyleRule: Identifiable, Hashable {
    let id: UUID
    let subject: String          // human-readable, e.g., "Beige"
    let predicate: Predicate
    let object: String           // "Navy", "workwear", "cold rain"
    var weight: Double           // 0...1
    let scope: Scope
    var isActive: Bool
    let usage: Usage
    let rationale: String?
    let viz: Visualization

    // MARK: - Predicate

    enum Predicate: String, CaseIterable, Hashable {
        case pairsWith       = "pairs_with"
        case appropriateFor  = "appropriate_for"
        case layerableWith   = "layerable_with"
        case avoidWith       = "avoid_with"
        case seasonality     = "seasonality"   // a flavour of appropriate_for

        var verbPhrase: String {
            switch self {
            case .pairsWith:        return "pairs with"
            case .appropriateFor:   return "is appropriate for"
            case .layerableWith:    return "layers with"
            case .avoidWith:        return "avoid with"
            case .seasonality:      return "is appropriate for"
            }
        }

        /// Human-readable section heading.
        var sectionTitle: String {
            switch self {
            case .pairsWith:        return "Colour & material pairings"
            case .appropriateFor:   return "Occasion fit"
            case .layerableWith:    return "Layering"
            case .avoidWith:        return "Avoidances"
            case .seasonality:      return "Seasonality"
            }
        }
    }

    // MARK: - Scope

    enum Scope: Hashable { case canon, yours }

    // MARK: - Usage

    struct Usage: Hashable {
        var firedInOutfits: Int
        var blockedSuggestions: Int

        var summary: String {
            if blockedSuggestions > 0 {
                return "Blocked \(blockedSuggestions) suggestion\(blockedSuggestions == 1 ? "" : "s")"
            }
            return "Fired in \(firedInOutfits) outfits"
        }
    }

    // MARK: - Visualization

    /// Which visual to use on the card. Kept a simple enum so the view layer can switch
    /// on it without introducing view-type coupling here.
    enum Visualization: Hashable {
        case swatchPair(subject: UInt32, object: UInt32)
        case glyph(symbol: String)                 // SF Symbol
        case iconPair(subject: String, connector: String, object: String)
    }
}
