//
//  TrendDetailSheet.swift
//  Pocket Wardrobe — one signal opened for full editorial detail.
//

import SwiftUI

struct TrendDetailSheet: View {
    let signal: TrendSignal
    @Environment(\.dismiss) private var dismiss

    private var matchedPieces: [Garment] {
        signal.matchedPieceIDs.compactMap { SampleData.garment($0) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    // Hero
                    ZStack(alignment: .bottomLeading) {
                        AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?auto=format&fit=crop&w=1200&q=85")) { phase in
                            switch phase {
                            case .success(let image): image.resizable().aspectRatio(contentMode: .fill)
                            default: PWColor.haze
                            }
                        }
                        .frame(height: 320)
                        .frame(maxWidth: .infinity)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))

                        if signal.isSignalOfWeek {
                            Text("Signal of the week".uppercased())
                                .font(PWFont.body(size: 10, weight: .medium))
                                .tracking(10 * 0.18)
                                .foregroundStyle(PWColor.ivory)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(PWColor.ink.opacity(0.7))
                                .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
                                .padding(16)
                        }
                    }

                    // Head
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Signal · Week 17, 2026 · \(signal.category.rawValue)")
                        Text(signal.title)
                            .font(PWFont.display(size: 32))
                            .foregroundStyle(PWColor.ink)
                    }

                    // Intro
                    Text(signal.detail)
                        .font(PWFont.body(size: 14))
                        .foregroundStyle(PWColor.ink70)
                        .lineSpacing(4)

                    // Canonical palette
                    if !signal.canonicalPalette.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            EyebrowLabel(text: "Canonical palette")
                            HStack(spacing: 10) {
                                ForEach(Array(signal.canonicalPalette.enumerated()), id: \.offset) { _, sw in
                                    VStack(alignment: .leading, spacing: 6) {
                                        Circle().fill(Color(hex: sw.hex))
                                            .frame(width: 36, height: 36)
                                            .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                                        Text(sw.name)
                                            .font(PWFont.body(size: 10, weight: .medium))
                                            .tracking(10 * 0.10)
                                            .textCase(.uppercase)
                                            .foregroundStyle(PWColor.ink60)
                                    }
                                }
                            }
                            Text("Canonical approximation · not tied to any proprietary colour system.")
                                .font(PWFont.body(size: 11))
                                .foregroundStyle(PWColor.ink40)
                        }
                    }

                    // Your matches
                    if !matchedPieces.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            EyebrowLabel(text: "Your match · \(matchedPieces.count) pieces")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
                                    ForEach(matchedPieces) { piece in
                                        matchedPieceCard(piece, kind: signal.matchKind)
                                    }
                                }
                            }
                        }
                    }

                    // Why it matters
                    if !signal.reasons.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            EyebrowLabel(text: "Why it matters")
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(Array(signal.reasons.enumerated()), id: \.offset) { i, reason in
                                    HStack(alignment: .top, spacing: 12) {
                                        Image(systemName: ["checkmark.circle", "sparkles", "chart.line.uptrend.xyaxis"][i % 3])
                                            .font(.system(size: 15, weight: .regular))
                                            .foregroundStyle(PWColor.ink70)
                                            .frame(width: 22)
                                        Text(reason)
                                            .font(PWFont.body(size: 13))
                                            .foregroundStyle(PWColor.ink70)
                                            .lineSpacing(3)
                                    }
                                }
                            }
                        }
                    }

                    // Sources
                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: "Sources · \(signal.sourcesCount)")
                        ForEach(Array(signal.sourceKinds.enumerated()), id: \.offset) { _, kind in
                            HStack {
                                Text(kind)
                                    .font(PWFont.body(size: 13))
                                    .foregroundStyle(PWColor.ink)
                                Spacer()
                                Text("\(Int.random(in: 2...4))×")
                                    .font(PWFont.mono(size: 11))
                                    .foregroundStyle(PWColor.ink40)
                            }
                            .padding(.vertical, 10)
                            HairlineDivider(color: PWColor.lineSoft)
                        }
                        Text("Links open original sources only · no republished content.")
                            .font(PWFont.body(size: 11))
                            .foregroundStyle(PWColor.ink40)
                            .padding(.top, 4)
                    }

                    // Actions
                    VStack(spacing: 10) {
                        PWButton(title: "Style an outfit", style: .primary)
                        PWButton(title: "Save to lookbook", style: .outline)
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

    private func matchedPieceCard(_ piece: Garment, kind: MatchKind) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            AsyncImage(url: piece.imageURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    PWColor.mist
                }
            }
            .frame(width: 110, height: 138)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))

            Text("\(piece.brand ?? "") \(piece.name)".trimmingCharacters(in: .whitespaces))
                .font(PWFont.body(size: 11))
                .foregroundStyle(PWColor.ink70)
                .lineLimit(2)
            MatchBadge(kind: kind)
        }
        .frame(width: 110)
    }
}

#Preview {
    TrendDetailSheet(signal: SampleData.trendSignals[0])
}
