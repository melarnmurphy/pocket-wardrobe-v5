//
//  Garment.swift
//  Pocket Wardrobe — a single piece you own.
//
//  Mirrors the `garments` + `garment_images` tables in the Supabase schema but
//  collapsed for UI consumption.
//

import Foundation

struct Garment: Identifiable, Hashable {
    let id: UUID
    let name: String              // "Totême blazer", "Acne trouser"
    let brand: String?
    let category: Category
    let colourName: String        // "Sand", "Oxblood"
    let colourHex: UInt32         // for swatch display
    let imageURL: URL             // placeholder Unsplash URL
    let costPerWear: Double       // dollars
    let timesWorn: Int
    let match: MatchKind?         // nil if not relevant in current context
    let season: Season
    let tags: [String]
    let isFavourite: Bool

    enum Category: String, CaseIterable, Hashable {
        case outerwear  = "Outerwear"
        case top        = "Top"
        case bottom     = "Bottom"
        case dress      = "Dress"
        case footwear   = "Footwear"
        case bag        = "Bag"
        case accessory  = "Accessory"
    }

    enum Season: String, Hashable {
        case allYear       = "All year"
        case winter        = "Winter"
        case transitional  = "Transitional"
        case summer        = "Summer"
    }
}
