//
//  LookbookEntry.swift
//  Pocket Wardrobe — a single saved reference image in the Lookbook.
//
//  Mirrors the `lookbook_entries` table. A reference is either an outfit from
//  elsewhere (Pinterest, editorial, Instagram) or a styled piece you saw
//  somewhere. Each entry is filed into a board and may link to owned pieces
//  plus flag missing ones.
//

import Foundation

struct LookbookEntry: Identifiable, Hashable {
    let id: UUID
    let title: String              // "Relaxed tailoring"
    let imageURL: URL
    let board: String              // "Summer in Italy"
    let tags: [String]             // ["Tonal", "Tailored"]
    let sourceURL: String          // "pinterest.com/pin/42918"
    let ownedPieceIDs: [UUID]      // garments you already have
    let missingPiece: MissingPiece?
    let matchKind: MatchKind       // summarises coverage vs your wardrobe
    let note: String?

    struct MissingPiece: Hashable {
        let label: String          // "Cream linen camp-collar shirt"
        let reason: String         // "Closest in your wardrobe: oxford shirt in sky"
    }
}

/// A lookbook board — the parent grouping for entries. Doubles as a filter.
struct LookbookBoard: Identifiable, Hashable {
    let id: UUID
    let name: String
    let count: Int
    let isFeatured: Bool
    let heroURL: URL?
    let ownedCount: Int
    let missingCount: Int
}
