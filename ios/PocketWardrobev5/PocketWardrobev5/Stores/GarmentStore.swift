// Stores/GarmentStore.swift
import Foundation
import Supabase
import SwiftData

// MARK: - Supabase row decoders

private struct GarmentRow: Decodable {
    let id: UUID
    let title: String?
    let brand: String?
    let category: String
    let wearCount: Int
    let costPerWear: Double?
    let favouriteScore: Double?
    let seasonality: [String]

    enum CodingKeys: String, CodingKey {
        case id, title, brand, category, seasonality
        case wearCount = "wear_count"
        case costPerWear = "cost_per_wear"
        case favouriteScore = "favourite_score"
    }
}

private struct GarmentImageRow: Decodable {
    let garmentId: UUID
    let storagePath: String

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case storagePath = "storage_path"
    }
}

private struct GarmentColourRow: Decodable {
    let garmentId: UUID
    let isPrimary: Bool
    let colour: ColourDetail?

    struct ColourDetail: Decodable {
        let hex: String
        let family: String
    }

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case isPrimary = "is_primary"
        case colour = "colours"
    }
}

// MARK: - Store

@Observable
@MainActor
final class GarmentStore {
    var garments: [Garment] = []
    var state: LoadState = .idle

    private var modelContext: ModelContext?

    func setContext(_ context: ModelContext) {
        self.modelContext = context
    }

    // MARK: - Load

    func load() async {
        guard state != .loading else { return }
        state = .loading
        loadFromCache()
        await fetchFromSupabase()
    }

    func clear() {
        garments = []
        state = .idle
        guard let ctx = modelContext else { return }
        try? ctx.delete(model: CDGarment.self)
    }

    // MARK: - Cache

    private func loadFromCache() {
        guard let ctx = modelContext else { return }
        let cached = (try? ctx.fetch(FetchDescriptor<CDGarment>(
            sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
        ))) ?? []
        if !cached.isEmpty {
            garments = cached.map { $0.toGarment() }
        }
    }

    private func fetchFromSupabase() async {
        do {
            let client = AppSupabase.shared

            let rows: [GarmentRow] = try await client
                .from("garments")
                .select("id, title, brand, category, wear_count, cost_per_wear, favourite_score, seasonality")
                .order("created_at", ascending: false)
                .execute()
                .value

            let garmentIds = rows.map { $0.id.uuidString }

            let colourRows: [GarmentColourRow] = garmentIds.isEmpty ? [] :
                try await client
                    .from("garment_colours")
                    .select("garment_id, is_primary, colours(hex, family)")
                    .in("garment_id", values: garmentIds)
                    .eq("is_primary", value: true)
                    .execute()
                    .value

            let colourByGarment = Dictionary(
                colourRows.compactMap { row -> (String, GarmentColourRow.ColourDetail)? in
                    guard let c = row.colour else { return nil }
                    return (row.garmentId.uuidString, c)
                },
                uniquingKeysWith: { first, _ in first }
            )

            let imageRows: [GarmentImageRow] = garmentIds.isEmpty ? [] :
                try await client
                    .from("garment_images")
                    .select("garment_id, storage_path")
                    .in("garment_id", values: garmentIds)
                    .eq("image_type", value: "original")
                    .execute()
                    .value

            let imageByGarment = Dictionary(
                imageRows.map { ($0.garmentId.uuidString, $0.storagePath) },
                uniquingKeysWith: { first, _ in first }
            )

            var signedURLByGarment: [String: URL] = [:]
            for (garmentId, path) in imageByGarment {
                if let url = try? await client.storage
                    .from("garment-originals")
                    .createSignedURL(path: path, expiresIn: 3600) {
                    signedURLByGarment[garmentId] = url
                }
            }

            let now = Date()
            guard let ctx = modelContext else { return }

            var built: [Garment] = []
            for row in rows {
                let idStr = row.id.uuidString
                let colour = colourByGarment[idStr]
                let colourName = colour?.family ?? "Unknown"
                let colourHex = colour.flatMap {
                    UInt32($0.hex.replacingOccurrences(of: "#", with: ""), radix: 16)
                } ?? 0xC9B893
                let imageURL = signedURLByGarment[idStr]
                let isFavourite = (row.favouriteScore ?? 0) >= 0.7

                let garment = Garment(
                    id: row.id,
                    name: row.title ?? "Untitled",
                    brand: row.brand,
                    category: Garment.Category(rawValue: row.category.capitalized) ?? .top,
                    colourName: colourName,
                    colourHex: colourHex,
                    imageURL: imageURL ?? URL(string: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=680")!,
                    costPerWear: row.costPerWear ?? 0,
                    timesWorn: row.wearCount,
                    match: nil,
                    season: row.seasonality.first.flatMap {
                        Garment.Season(rawValue: $0.capitalized)
                    } ?? .allYear,
                    tags: [],
                    isFavourite: isFavourite
                )
                built.append(garment)

                let existing = try? ctx.fetch(
                    FetchDescriptor<CDGarment>(predicate: #Predicate { $0.id == idStr })
                ).first

                if let cd = existing {
                    cd.title = garment.name
                    cd.brand = garment.brand
                    cd.category = row.category
                    cd.colourName = colourName
                    cd.colourHex = colourHex
                    cd.imageURLString = imageURL?.absoluteString
                    cd.costPerWear = garment.costPerWear
                    cd.timesWorn = garment.timesWorn
                    cd.isFavourite = isFavourite
                    cd.seasonality = row.seasonality
                    cd.cachedAt = now
                } else {
                    ctx.insert(CDGarment(
                        id: idStr, title: garment.name, brand: garment.brand,
                        category: row.category, colourName: colourName,
                        colourHex: colourHex, imageURLString: imageURL?.absoluteString,
                        costPerWear: garment.costPerWear, timesWorn: garment.timesWorn,
                        isFavourite: isFavourite, seasonality: row.seasonality, cachedAt: now
                    ))
                }
            }
            try? ctx.save()

            garments = built
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    // MARK: - Writes

    func add(_ input: GarmentInput) async throws {
        struct Insert: Encodable {
            let title, brand, category: String
            let purchasePrice: Double
            let seasonality: [String]
            enum CodingKeys: String, CodingKey {
                case title, brand, category
                case purchasePrice = "purchase_price"
                case seasonality
            }
        }
        try await AppSupabase.shared.from("garments").insert(Insert(
            title: input.name,
            brand: input.brand,
            category: input.category.rawValue.lowercased(),
            purchasePrice: input.purchasePrice,
            seasonality: [input.season.rawValue.lowercased()]
        )).execute()
        await fetchFromSupabase()
    }

    func update(_ garment: Garment) async throws {
        struct Patch: Encodable {
            let title: String
            let brand: String?
        }
        try await AppSupabase.shared
            .from("garments")
            .update(Patch(title: garment.name, brand: garment.brand))
            .eq("id", value: garment.id.uuidString)
            .execute()
        if let idx = garments.firstIndex(where: { $0.id == garment.id }) {
            garments[idx] = garment
        }
        updateCache(garment)
    }

    func toggleFavourite(_ garment: Garment) async throws {
        let newScore: Double = garment.isFavourite ? 0.0 : 1.0
        struct Patch: Encodable {
            let favouriteScore: Double
            enum CodingKeys: String, CodingKey {
                case favouriteScore = "favourite_score"
            }
        }
        try await AppSupabase.shared
            .from("garments")
            .update(Patch(favouriteScore: newScore))
            .eq("id", value: garment.id.uuidString)
            .execute()
        let updated = Garment(
            id: garment.id, name: garment.name, brand: garment.brand,
            category: garment.category, colourName: garment.colourName,
            colourHex: garment.colourHex, imageURL: garment.imageURL,
            costPerWear: garment.costPerWear, timesWorn: garment.timesWorn,
            match: garment.match, season: garment.season, tags: garment.tags,
            isFavourite: !garment.isFavourite
        )
        if let idx = garments.firstIndex(where: { $0.id == garment.id }) {
            garments[idx] = updated
        }
        updateCache(updated)
    }

    func logWear(_ garment: Garment) async throws {
        let client = AppSupabase.shared
        struct WearInsert: Encodable {
            let garmentId: UUID
            enum CodingKeys: String, CodingKey {
                case garmentId = "garment_id"
            }
        }
        try await client.from("wear_events")
            .insert(WearInsert(garmentId: garment.id))
            .execute()
        let newCount = garment.timesWorn + 1
        struct WearPatch: Encodable {
            let wearCount: Int
            enum CodingKeys: String, CodingKey {
                case wearCount = "wear_count"
            }
        }
        try await client.from("garments")
            .update(WearPatch(wearCount: newCount))
            .eq("id", value: garment.id.uuidString)
            .execute()
        let updated = Garment(
            id: garment.id, name: garment.name, brand: garment.brand,
            category: garment.category, colourName: garment.colourName,
            colourHex: garment.colourHex, imageURL: garment.imageURL,
            costPerWear: garment.costPerWear, timesWorn: newCount,
            match: garment.match, season: garment.season, tags: garment.tags,
            isFavourite: garment.isFavourite
        )
        if let idx = garments.firstIndex(where: { $0.id == garment.id }) {
            garments[idx] = updated
        }
        updateCache(updated)
    }

    func delete(_ garment: Garment) async throws {
        try await AppSupabase.shared
            .from("garments")
            .delete()
            .eq("id", value: garment.id.uuidString)
            .execute()
        garments.removeAll { $0.id == garment.id }
        guard let ctx = modelContext else { return }
        let idStr = garment.id.uuidString
        if let cd = try? ctx.fetch(FetchDescriptor<CDGarment>(
            predicate: #Predicate { $0.id == idStr }
        )).first {
            ctx.delete(cd)
            try? ctx.save()
        }
    }

    // MARK: - Cache helpers

    private func updateCache(_ garment: Garment) {
        guard let ctx = modelContext else { return }
        let idStr = garment.id.uuidString
        if let cd = try? ctx.fetch(FetchDescriptor<CDGarment>(
            predicate: #Predicate { $0.id == idStr }
        )).first {
            cd.title = garment.name
            cd.brand = garment.brand
            cd.timesWorn = garment.timesWorn
            cd.isFavourite = garment.isFavourite
            cd.cachedAt = Date()
            try? ctx.save()
        }
    }
}
