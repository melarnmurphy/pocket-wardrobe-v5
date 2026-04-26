//
//  LookbookEntrySheet.swift
//  Pocket Wardrobe — one lookbook entry opened for detail + actions.
//

import SwiftUI

struct LookbookEntrySheet: View {
    let entry: LookbookEntry
    @Environment(\.dismiss) private var dismiss

    private var ownedPieces: [Garment] {
        entry.ownedPieceIDs.compactMap { SampleData.garment($0) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // Hero
                    AsyncImage(url: entry.imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            PWColor.mist
                        }
                    }
                    .frame(height: 360)
                    .frame(maxWidth: .infinity)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))

                    // Head
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "\(entry.board) · \(entry.sourceURL)")
                        Text(entry.title)
                            .font(PWFont.display(size: 28))
                            .foregroundStyle(PWColor.ink)
                        HStack(spacing: 6) {
                            ForEach(entry.tags, id: \.self) { tag in
                                TagChip(text: tag, style: .plain)
                            }
                            MatchBadge(kind: entry.matchKind)
                        }
                    }

                    // Pieces you own
                    if !ownedPieces.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            EyebrowLabel(text: "Pieces you own · \(ownedPieces.count)")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(ownedPieces) { piece in
                                        piecePreview(piece)
                                    }
                                }
                            }
                        }
                    }

                    // Missing from wardrobe
                    if let miss = entry.missingPiece {
                        VStack(alignment: .leading, spacing: 12) {
                            EyebrowLabel(text: "Missing from your wardrobe")
                            HStack(alignment: .top, spacing: 12) {
                                Image(systemName: "questionmark.square.dashed")
                                    .font(.system(size: 20, weight: .light))
                                    .foregroundStyle(PWColor.oxblood)
                                    .padding(10)
                                    .background(Circle().stroke(PWColor.line, lineWidth: 1))
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(miss.label)
                                        .font(PWFont.display(size: 17))
                                        .foregroundStyle(PWColor.ink)
                                    Text(miss.reason)
                                        .font(PWFont.body(size: 12))
                                        .foregroundStyle(PWColor.ink60)
                                }
                                Spacer(minLength: 8)
                                MatchBadge(kind: .missing)
                            }
                            .padding(16)
                            .background(
                                RoundedRectangle(cornerRadius: PWRadius.sm)
                                    .stroke(PWColor.line, lineWidth: 1)
                            )
                        }
                    }

                    // Note
                    if let note = entry.note {
                        VStack(alignment: .leading, spacing: 10) {
                            EyebrowLabel(text: "Note to self")
                            Text(note)
                                .font(PWFont.displayItalic(size: 17))
                                .foregroundStyle(PWColor.ink70)
                                .lineSpacing(3)
                        }
                    }

                    // Context rows
                    VStack(spacing: 0) {
                        detailRow("Board", entry.board)
                        detailRow("Source", entry.sourceURL)
                        detailRow("Match", entry.matchKind.label, isLast: true)
                    }

                    // Actions
                    VStack(spacing: 10) {
                        PWButton(title: "Build an outfit from this", style: .primary)
                        HStack(spacing: 10) {
                            PWButton(title: "Link a piece", style: .outline)
                            PWButton(title: "Move board", style: .outline)
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)
            }
            .background(PWColor.paper)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(PWColor.ink)
                    }
                }
            }
        }
    }

    private func piecePreview(_ garment: Garment) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: garment.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    PWColor.mist
                }
            }
            .frame(width: 104, height: 130)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))

            Text(garment.brand ?? "")
                .font(PWFont.body(size: 10, weight: .medium))
                .tracking(10 * 0.14)
                .textCase(.uppercase)
                .foregroundStyle(PWColor.ink40)
            Text(garment.name)
                .font(PWFont.display(size: 12))
                .foregroundStyle(PWColor.ink)
                .lineLimit(2)
        }
        .frame(width: 104)
    }

    private func detailRow(_ label: String, _ value: String, isLast: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(label)
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
                Spacer()
                Text(value)
                    .font(PWFont.body(size: 13))
                    .foregroundStyle(PWColor.ink)
                    .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, 12)
            if !isLast { HairlineDivider(color: PWColor.lineSoft) }
        }
    }
}

#Preview {
    LookbookEntrySheet(entry: SampleData.lookbookEntries[0])
}
