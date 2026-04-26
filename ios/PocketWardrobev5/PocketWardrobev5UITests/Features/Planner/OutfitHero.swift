//
//  OutfitHero.swift
//  Pocket Wardrobe — the main composed outfit card on the Planner.
//

import SwiftUI

struct OutfitHero: View {
    let outfit: Outfit

    private var pieces: [(Outfit.Piece, Garment)] {
        outfit.pieces.compactMap { p in
            guard let g = SampleData.garment(p.id) else { return nil }
            return (p, g)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {

            // Stage — piece mosaic (hero + satellites)
            stage
                .padding(20)
                .background(
                    RadialGradient(
                        colors: [Color.white.opacity(0), PWColor.haze.opacity(0.4)],
                        center: .top, startRadius: 40, endRadius: 280
                    )
                    .background(PWColor.paper)
                )
                .overlay(alignment: .bottom) {
                    Rectangle().fill(PWColor.line).frame(height: 1)
                }

            // Body
            VStack(alignment: .leading, spacing: 20) {

                // Title + match badge
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        EyebrowLabel(text: "\(outfit.variant.rawValue) · \(weekdayTitle)")
                        Text(outfit.title)
                            .font(PWFont.display(size: 24))
                            .foregroundStyle(PWColor.ink)
                            .lineSpacing(2)
                    }
                    Spacer(minLength: 10)
                    if outfit.signalsMatched > 0 {
                        MatchBadge(kind: .exact)
                    }
                }

                // Reasoning
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(outfit.reasons) { reason in
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: reason.icon)
                                .font(.system(size: 14))
                                .foregroundStyle(PWColor.ink70)
                                .frame(width: 22)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(reason.headline)
                                    .font(PWFont.body(size: 13, weight: .medium))
                                    .foregroundStyle(PWColor.ink)
                                Text(reason.body)
                                    .font(PWFont.body(size: 12))
                                    .foregroundStyle(PWColor.ink60)
                                    .lineSpacing(3)
                            }
                        }
                    }
                }

                // Actions
                VStack(spacing: 10) {
                    PWButton(title: "Wear this today", style: .primary)
                    HStack(spacing: 10) {
                        PWButton(title: "Save outfit", style: .outline)
                        PWButton(title: "Regenerate", style: .outline, icon: "arrow.clockwise")
                    }
                }
            }
            .padding(22)
        }
        .background(PWColor.paper)
        .overlay(
            RoundedRectangle(cornerRadius: PWRadius.md)
                .stroke(PWColor.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    // MARK: - Stage grid

    private var stage: some View {
        // First piece is the anchor (large, top-left). Up to 4 others in a grid.
        let anchor = pieces.first
        let rest = Array(pieces.dropFirst())

        return VStack(spacing: 8) {
            if let (piece, garment) = anchor {
                tile(piece: piece, garment: garment, large: true)
                    .frame(height: 180)
            }

            if !rest.isEmpty {
                HStack(spacing: 8) {
                    ForEach(rest.prefix(4), id: \.1.id) { p, g in
                        tile(piece: p, garment: g, large: false)
                            .frame(height: 108)
                    }
                }
            }
        }
    }

    private func tile(piece: Outfit.Piece, garment: Garment, large: Bool) -> some View {
        ZStack(alignment: .topLeading) {
            AsyncImage(url: garment.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    PWColor.mist
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()

            Text(piece.role.rawValue.uppercased())
                .font(PWFont.body(size: 9, weight: .medium))
                .tracking(9 * 0.18)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .foregroundStyle(PWColor.ink70)
                .background(PWColor.ivory.opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
                .padding(8)
        }
        .frame(maxWidth: .infinity)
        .background(PWColor.mist)
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
        .overlay(
            RoundedRectangle(cornerRadius: PWRadius.xs)
                .stroke(PWColor.lineSoft, lineWidth: 1)
        )
    }

    private var weekdayTitle: String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Amsterdam")
        f.dateFormat = "EEEE"
        return f.string(from: outfit.date)
    }
}
