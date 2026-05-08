// Models/GarmentInput.swift
import Foundation

struct GarmentInput {
    var name: String = ""
    var brand: String = ""
    var category: Garment.Category = .top
    var colourName: String = ""
    var colourHex: UInt32 = 0xC9B893
    var purchasePrice: Double = 0
    var season: Garment.Season = .allYear
    var tags: [String] = []
}
