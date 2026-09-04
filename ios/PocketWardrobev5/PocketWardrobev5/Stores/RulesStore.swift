// Stores/RulesStore.swift
import Foundation

private struct StyleRuleRow: Decodable {
    let id: String
    let subjectValue: String
    let predicate: String
    let objectValue: String
    let weight: Double
    let ruleScope: String
    let explanation: String?
    let active: Bool

    enum CodingKeys: String, CodingKey {
        case id, predicate, weight, active
        case subjectValue = "subject_value"
        case objectValue = "object_value"
        case ruleScope = "rule_scope"
        case explanation
    }
}

private struct StyleRulesResponse: Decodable {
    let rules: [StyleRuleRow]
}

@Observable
@MainActor
final class RulesStore {
    var rules: [StyleRule] = []
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: StyleRulesResponse = try await MobileAPIClient.get("/api/mobile/style-rules")
            rules = response.rules.compactMap(Self.map)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    // Usage stats (fired-in-outfits, blocked-suggestions) and card visualization
    // aren't in style_rules — they're presentational. Usage is a known gap
    // (nothing tracks it yet, web or mobile); viz is derived here from the
    // predicate so cards still render something sensible.
    private static func map(_ row: StyleRuleRow) -> StyleRule? {
        guard let id = UUID(uuidString: row.id),
              let predicate = StyleRule.Predicate(rawValue: row.predicate) else { return nil }

        return StyleRule(
            id: id,
            subject: row.subjectValue,
            predicate: predicate,
            object: row.objectValue,
            weight: (row.weight / 100).clamped(to: 0...1),
            scope: row.ruleScope == "user" ? .yours : .canon,
            isActive: row.active,
            usage: StyleRule.Usage(firedInOutfits: 0, blockedSuggestions: 0),
            rationale: row.explanation,
            viz: .glyph(symbol: predicate.symbolName)
        )
    }
}

private extension StyleRule.Predicate {
    var symbolName: String {
        switch self {
        case .pairsWith:       return "link"
        case .appropriateFor:  return "checkmark.seal"
        case .layerableWith:   return "square.stack"
        case .avoidWith:       return "xmark.circle"
        case .seasonality:     return "sun.max"
        }
    }
}

private extension Double {
    func clamped(to range: ClosedRange<Double>) -> Double {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
