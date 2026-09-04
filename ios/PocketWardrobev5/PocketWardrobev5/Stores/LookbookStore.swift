// Stores/LookbookStore.swift
//
// Maps /api/mobile/lookbook onto the LookbookEntry/LookbookBoard models. The
// real lookbook_entries/lookbook_items schema has no "board" concept and no
// match scoring — both are derived here, clearly marked as presentational:
//   - board: the entry's first aesthetic tag, or "Unfiled" if it has none
//   - matchKind: .exact if it has an owned piece linked, .missing if it has
//     a desired_item_json with no garment_id, .styling otherwise
// Neither is a real feature (grouping, or a matching algorithm) — they're
// stand-ins so the existing UI (built against a richer mockup) has something
// honest to show rather than nothing.

import Foundation

private struct LookbookItemRow: Decodable {
    let garmentId: String?
    let desiredItemJSON: [String: AnyDecodableValue]?

    enum CodingKeys: String, CodingKey {
        case garmentId = "garment_id"
        case desiredItemJSON = "desired_item_json"
    }
}

private struct LookbookEntryRow: Decodable {
    let id: String
    let title: String?
    let description: String?
    let sourceUrl: String?
    let aestheticTags: [String]
    let occasionTags: [String]
    let previewUrl: String?
    let items: [LookbookItemRow]

    enum CodingKeys: String, CodingKey {
        case id, title, description, items
        case sourceUrl = "source_url"
        case aestheticTags = "aesthetic_tags"
        case occasionTags = "occasion_tags"
        case previewUrl = "preview_url"
    }
}

private struct LookbookResponse: Decodable {
    let entries: [LookbookEntryRow]
}

/// Decodes any JSON value just far enough to pull a couple of best-effort
/// string fields out of desired_item_json, which has no fixed schema.
private struct AnyDecodableValue: Decodable {
    let stringValue: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        stringValue = try? container.decode(String.self)
    }
}

private let fallbackImageURL = URL(string: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=680")!

@Observable
@MainActor
final class LookbookStore {
    var entries: [LookbookEntry] = []
    var boards: [LookbookBoard] = []
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: LookbookResponse = try await MobileAPIClient.get("/api/mobile/lookbook")
            entries = response.entries.compactMap(Self.mapEntry)
            boards = Self.deriveBoards(from: entries)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private static func mapEntry(_ row: LookbookEntryRow) -> LookbookEntry? {
        guard let id = UUID(uuidString: row.id) else { return nil }

        let ownedPieceIDs = row.items.compactMap { $0.garmentId.flatMap(UUID.init(uuidString:)) }
        let missingItem = row.items.first { $0.garmentId == nil && $0.desiredItemJSON != nil }
        let missingPiece: LookbookEntry.MissingPiece? = missingItem.map { item in
            let label = item.desiredItemJSON?["label"]?.stringValue
                ?? item.desiredItemJSON?["title"]?.stringValue
                ?? "An item for this look"
            let reason = item.desiredItemJSON?["reason"]?.stringValue ?? "Not yet in your wardrobe."
            return LookbookEntry.MissingPiece(label: label, reason: reason)
        }

        let matchKind: MatchKind = !ownedPieceIDs.isEmpty ? .exact : (missingPiece != nil ? .missing : .styling)

        return LookbookEntry(
            id: id,
            title: row.title ?? "Untitled",
            imageURL: row.previewUrl.flatMap(URL.init(string:)) ?? fallbackImageURL,
            board: row.aestheticTags.first ?? "Unfiled",
            tags: row.aestheticTags + row.occasionTags,
            sourceURL: row.sourceUrl ?? "",
            ownedPieceIDs: ownedPieceIDs,
            missingPiece: missingPiece,
            matchKind: matchKind,
            note: row.description
        )
    }

    private static func deriveBoards(from entries: [LookbookEntry]) -> [LookbookBoard] {
        let grouped = Dictionary(grouping: entries, by: \.board)
        let largest = grouped.max { $0.value.count < $1.value.count }?.key

        return grouped.map { name, entriesInBoard in
            LookbookBoard(
                id: UUID(),
                name: name,
                count: entriesInBoard.count,
                isFeatured: name == largest,
                heroURL: entriesInBoard.first?.imageURL,
                ownedCount: entriesInBoard.filter { !$0.ownedPieceIDs.isEmpty }.count,
                missingCount: entriesInBoard.filter { $0.missingPiece != nil }.count
            )
        }
        .sorted { $0.count > $1.count }
    }
}
