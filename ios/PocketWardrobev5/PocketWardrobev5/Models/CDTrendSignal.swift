// Models/CDTrendSignal.swift
import SwiftData
import Foundation

@Model
final class CDTrendSignal {
    @Attribute(.unique) var id: String
    var category: String
    var title: String
    var summary: String
    var confidenceScore: Double
    var sourcesCount: Int
    var lastSeenAt: Date
    var cachedAt: Date

    init(
        id: String, category: String, title: String, summary: String,
        confidenceScore: Double, sourcesCount: Int,
        lastSeenAt: Date, cachedAt: Date
    ) {
        self.id = id
        self.category = category
        self.title = title
        self.summary = summary
        self.confidenceScore = confidenceScore
        self.sourcesCount = sourcesCount
        self.lastSeenAt = lastSeenAt
        self.cachedAt = cachedAt
    }
}
