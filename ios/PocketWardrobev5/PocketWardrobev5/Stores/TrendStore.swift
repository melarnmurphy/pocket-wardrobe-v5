// Stores/TrendStore.swift
//
// Maps /api/mobile/trends (a UserTrendMatch joined with its TrendSignal) onto
// the UI-facing TrendSignal model. Several fields the web mockup expects
// (long-form editorial `detail`, `sourceKinds`, `canonicalPalette` swatches,
// `isSignalOfWeek`) aren't in this payload yet — they come from separate
// tables (trend_sources, the story-generation cron) nothing here queries.
// Documented gap, not a silent stub: those render empty/false rather than
// fabricated data.

import Foundation

struct TrendSignalRow: Decodable {
    let id: String
    let trendType: String
    let label: String
    let canonicalLabel: String?
    let sourceCount: Int
    let confidenceScore: Double?
    let trendConfidence: Double?

    enum CodingKeys: String, CodingKey {
        case id, label
        case trendType = "trend_type"
        case canonicalLabel = "canonical_label"
        case sourceCount = "source_count"
        case confidenceScore = "confidence_score"
        case trendConfidence = "trend_confidence"
    }
}

struct TrendMatchReasoning: Decodable {
    let matchReason: String?
    let matchedGarmentIds: [String]?

    enum CodingKeys: String, CodingKey {
        case matchReason = "match_reason"
        case matchedGarmentIds = "matched_garment_ids"
    }
}

struct UserTrendMatchRow: Decodable {
    let matchType: String
    let reasoningJSON: TrendMatchReasoning?
    let trendSignal: TrendSignalRow

    enum CodingKeys: String, CodingKey {
        case matchType = "match_type"
        case reasoningJSON = "reasoning_json"
        case trendSignal = "trend_signal"
    }
}

private struct TrendsResponse: Decodable {
    let matches: [UserTrendMatchRow]
}

@Observable
@MainActor
final class TrendStore {
    var signals: [TrendSignal] = []
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: TrendsResponse = try await MobileAPIClient.get("/api/mobile/trends")
            signals = response.matches.compactMap(Self.map)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    static func map(_ row: UserTrendMatchRow) -> TrendSignal? {
        guard let id = UUID(uuidString: row.trendSignal.id) else { return nil }

        let reason = row.reasoningJSON?.matchReason
        let matchedIDs = (row.reasoningJSON?.matchedGarmentIds ?? []).compactMap(UUID.init(uuidString:))

        return TrendSignal(
            id: id,
            category: category(for: row.trendSignal.trendType),
            title: row.trendSignal.label,
            summary: row.trendSignal.canonicalLabel ?? row.trendSignal.label,
            detail: reason ?? "\(row.trendSignal.sourceCount) source\(row.trendSignal.sourceCount == 1 ? " is" : "s are") tracking this signal.",
            swatches: [],
            sourcesCount: row.trendSignal.sourceCount,
            sourceKinds: [],
            confidence: confidence(for: row.trendSignal.confidenceScore ?? row.trendSignal.trendConfidence),
            matchKind: matchKind(for: row.matchType),
            matchCount: matchedIDs.count,
            matchedPieceIDs: matchedIDs,
            canonicalPalette: [],
            reasons: reason.map { [$0] } ?? [],
            isSignalOfWeek: false
        )
    }

    static func category(for trendType: String) -> TrendSignal.Category {
        switch trendType {
        case "colour":     return .colour
        case "garment":    return .garment
        case "silhouette": return .silhouette
        case "material":   return .material
        case "pattern":    return .pattern
        default:           return .aesthetic  // styling / occasion / era_influence
        }
    }

    static func confidence(for score: Double?) -> TrendSignal.Confidence {
        guard let score else { return .medium }
        if score >= 0.75 { return .high }
        if score >= 0.4 { return .medium }
        return .low
    }

    static func matchKind(for matchType: String) -> MatchKind {
        switch matchType {
        case "exact_match":     return .exact
        case "adjacent_match":  return .adjacent
        case "missing_piece":   return .missing
        default:                return .styling  // styling_match
        }
    }
}
