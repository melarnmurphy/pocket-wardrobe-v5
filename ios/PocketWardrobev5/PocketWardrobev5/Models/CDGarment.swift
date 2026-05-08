// Models/CDGarment.swift
import SwiftData
import Foundation

private let fallbackImageURL = URL(string: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=680")!

@Model
final class CDGarment {
    @Attribute(.unique) var id: String
    var title: String
    var brand: String?
    var category: String
    var colourName: String
    var colourHex: UInt32
    var imageURLString: String?
    var costPerWear: Double
    var timesWorn: Int
    var isFavourite: Bool
    var seasonality: [String]
    var cachedAt: Date

    init(
        id: String, title: String, brand: String?,
        category: String, colourName: String, colourHex: UInt32,
        imageURLString: String?, costPerWear: Double, timesWorn: Int,
        isFavourite: Bool, seasonality: [String], cachedAt: Date
    ) {
        self.id = id
        self.title = title
        self.brand = brand
        self.category = category
        self.colourName = colourName
        self.colourHex = colourHex
        self.imageURLString = imageURLString
        self.costPerWear = costPerWear
        self.timesWorn = timesWorn
        self.isFavourite = isFavourite
        self.seasonality = seasonality
        self.cachedAt = cachedAt
    }

    func toGarment() -> Garment {
        let resolvedCategory: Garment.Category
        if let cat = Garment.Category(rawValue: category.capitalized) {
            resolvedCategory = cat
        } else {
            #if DEBUG
            print("[CDGarment] Unknown category '\(category)', falling back to .top")
            #endif
            resolvedCategory = .top
        }

        return Garment(
            id: UUID(uuidString: id) ?? UUID(),
            name: title,
            brand: brand,
            category: resolvedCategory,
            colourName: colourName,
            colourHex: colourHex,
            imageURL: imageURLString.flatMap(URL.init(string:)) ?? fallbackImageURL,
            costPerWear: costPerWear,
            timesWorn: timesWorn,
            match: nil,
            season: seasonality.first.flatMap { Garment.Season(rawValue: $0.capitalized) } ?? .allYear,
            tags: [],
            isFavourite: isFavourite
        )
    }
}
