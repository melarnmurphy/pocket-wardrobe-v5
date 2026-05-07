//
//  LookbookCard.swift
//  Pocket Wardrobe — one saved reference image.
//

import SwiftUI

struct LookbookCardView: View {
    let entry: LookbookEntry
    var aspect: CGFloat = 0.72       // mild variance via caller for masonry feel
    var onTap: (() -> Void) = {}

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 10) {
                ZStack(alignment: .topTrailing) {
                    Color.clear
                        .aspectRatio(aspect, contentMode: .fit)
                        .overlay(
                            AsyncImage(url: entry.imageURL) { phase in
                                switch phase {
                                case .success(let image):
                                    image.resizable().aspectRatio(contentMode: .fill)
                                default:
                                    PWColor.mist
                                }
                            }
                        )
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))

                    if entry.matchKind == .missing {
                        HStack(spacing: 4) {
                            Circle().fill(PWColor.oxblood).frame(width: 5, height: 5)
                            Text("Missing")
                                .font(PWFont.body(size: 9, weight: .medium))
                                .tracking(9 * 0.14)
                                .textCase(.uppercase)
                        }
                        .foregroundStyle(PWColor.oxblood)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(PWColor.paper.opacity(0.92))
                        .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
                        .padding(10)
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    EyebrowLabel(text: entry.board, color: PWColor.ink40)
                    Text(entry.title)
                        .font(PWFont.display(size: 16))
                        .foregroundStyle(PWColor.ink)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2, reservesSpace: true)
                }
                .padding(.horizontal, 2)
            }
        }
        .buttonStyle(.plain)
    }
}
