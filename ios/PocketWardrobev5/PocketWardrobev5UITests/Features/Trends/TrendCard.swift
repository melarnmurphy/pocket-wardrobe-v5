//
//  TrendCard.swift
//  Pocket Wardrobe — one trend signal rendered as a card.
//

import SwiftUI

struct TrendCardView: View {
    let signal: TrendSignal
    var onTap: (() -> Void) = {}

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 14) {

                // Head: category eyebrow + swatches
                HStack(alignment: .top) {
                    EyebrowLabel(text: signal.category.rawValue)
                    Spacer()
                    HStack(spacing: 4) {
                        ForEach(Array(signal.swatches.enumerated()), id: \.offset) { _, hex in
                            Circle()
                                .fill(Color(hex: hex))
                                .frame(width: 16, height: 16)
                                .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                        }
                    }
                }

                Text(signal.title)
                    .font(PWFont.display(size: 22))
                    .foregroundStyle(PWColor.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Text(signal.summary)
                    .font(PWFont.body(size: 13))
                    .foregroundStyle(PWColor.ink70)
                    .lineSpacing(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: 8) {
                    MatchBadge(kind: signal.matchKind)
                    if signal.matchCount > 0 {
                        Text("\(signal.matchCount) piece\(signal.matchCount == 1 ? "" : "s")")
                            .font(PWFont.body(size: 10, weight: .medium))
                            .tracking(10 * 0.10)
                            .textCase(.uppercase)
                            .foregroundStyle(PWColor.ink60)
                    }
                }

                HairlineDivider(color: PWColor.lineSoft)

                HStack(spacing: 12) {
                    HStack(spacing: 6) {
                        Text("\(signal.sourcesCount)")
                            .font(PWFont.mono(size: 12))
                            .foregroundStyle(PWColor.ink)
                        Text("sources")
                            .font(PWFont.body(size: 11))
                            .foregroundStyle(PWColor.ink60)
                    }
                    Spacer()
                    confidenceRow
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PWColor.paper)
            .overlay(
                RoundedRectangle(cornerRadius: PWRadius.md)
                    .stroke(PWColor.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
        }
        .buttonStyle(.plain)
    }

    private var confidenceRow: some View {
        HStack(spacing: 6) {
            HStack(spacing: 2) {
                ForEach(0..<3) { i in
                    Capsule()
                        .fill(i < signal.confidence.bars ? PWColor.ink : PWColor.line)
                        .frame(width: 3, height: 8 + CGFloat(i) * 2)
                }
            }
            Text(signal.confidence.label)
                .font(PWFont.body(size: 10, weight: .medium))
                .tracking(10 * 0.14)
                .textCase(.uppercase)
                .foregroundStyle(PWColor.ink60)
        }
    }
}
