// Models/CDOutfit.swift
import SwiftData
import Foundation

@Model
final class CDOutfit {
    @Attribute(.unique) var id: String
    var title: String
    var occasion: String?
    var pieceIDStrings: [String]
    var isSaved: Bool
    var plannedFor: Date?
    var cachedAt: Date

    init(
        id: String, title: String, occasion: String?,
        pieceIDStrings: [String], isSaved: Bool,
        plannedFor: Date?, cachedAt: Date
    ) {
        self.id = id; self.title = title; self.occasion = occasion
        self.pieceIDStrings = pieceIDStrings; self.isSaved = isSaved
        self.plannedFor = plannedFor; self.cachedAt = cachedAt
    }
}
