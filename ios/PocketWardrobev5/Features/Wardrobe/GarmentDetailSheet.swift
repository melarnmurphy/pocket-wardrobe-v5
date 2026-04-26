//
//  GarmentDetailSheet.swift
//  Pocket Wardrobe — per-garment detail presented as a sheet.
//

import SwiftUI

struct GarmentDetailSheet: View {
    let garment: Garment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Hero image
                AsyncImage(url: garment.imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        PWColor.mist
                    }
                }
                .frame(height: 440)
                .frame(maxWidth: .infinity)
                .clipped()

                VStack(alignment: .leading, spacing: 0) {

                    // Brand + name + match
                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: garment.brand ?? "—")
                        Text(garment.name)
                            .display(size: 34)
                        if let match = garment.match {
                            MatchBadge(kind: match)
                                .padding(.top, 4)
                        }
                    }
                    .padding(.top, 28)
                    .padding(.horizontal, PWSpacing.pageGutter)

                    // Stats row
                    HStack(spacing: 0) {
                        statCell("Times worn",  "\(garment.timesWorn)")
                        Divider().background(PWColor.line)
                        statCell("$/wear",      String(format: "$%.2f", garment.costPerWear))
                        Divider().background(PWColor.line)
                        statCell("Season",      garment.season.rawValue)
                    }
                    .frame(height: 72)
                    .overlay(
                        Rectangle().fill(PWColor.line).frame(height: 1),
                        alignment: .top
                    )
                    .overlay(
                        Rectangle().fill(PWColor.line).frame(height: 1),
                        alignment: .bottom
                    )
                    .padding(.top, 28)

                    // Colour
                    VStack(alignment: .leading, spacing: 12) {
                        EyebrowLabel(text: "Colour")
                        HStack(spacing: 12) {
                            Circle()
                                .fill(Color(hex: garment.colourHex))
                                .frame(width: 36, height: 36)
                                .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                            Text(garment.colourName)
                                .font(PWFont.display(size: 20))
                                .foregroundStyle(PWColor.ink)
                            Spacer()
                        }
                    }
                    .padding(.top, 28)
                    .padding(.horizontal, PWSpacing.pageGutter)

                    // Tags
                    if !garment.tags.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            EyebrowLabel(text: "Tags")
                            FlexibleTagRow(tags: garment.tags)
                        }
                        .padding(.top, 24)
                        .padding(.horizontal, PWSpacing.pageGutter)
                    }

                    // Actions
                    HStack(spacing: 10) {
                        PWButton(title: "Style an outfit", style: .primary,
                                 icon: "sparkles")
                        PWButton(title: "View outfits", style: .outline)
                    }
                    .padding(.top, 32)
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.bottom, 40)
                }
            }
        }
        .background(PWColor.paper)
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .foregroundStyle(PWColor.ink)
                    .background(PWColor.paper.opacity(0.9))
                    .clipShape(Circle())
                    .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
            }
            .padding(.top, 12)
            .padding(.trailing, 16)
        }
        .ignoresSafeArea(edges: .top)
    }

    private func statCell(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            EyebrowLabel(text: label, color: PWColor.ink40)
            Text(value)
                .font(PWFont.display(size: 22))
                .foregroundStyle(PWColor.ink)
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A tag row that wraps instead of truncating.
struct FlexibleTagRow: View {
    let tags: [String]

    var body: some View {
        // Simple flow — 2-4 tags is typical; using a HStack + wrapping via LazyVGrid
        // style won't flow, so we fake it with a wrapped FlowLayout.
        FlowLayout(spacing: 8, runSpacing: 8) {
            ForEach(tags, id: \.self) { TagChip(text: $0) }
        }
    }
}

/// Minimal wrap-layout for chips. iOS 16+ has `Layout`.
struct FlowLayout: Layout {
    var spacing: CGFloat
    var runSpacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var origin = CGPoint.zero
        var lineHeight: CGFloat = 0
        var totalHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if origin.x + size.width > width {
                origin.x = 0
                origin.y += lineHeight + runSpacing
                lineHeight = 0
            }
            lineHeight = max(lineHeight, size.height)
            origin.x += size.width + spacing
            totalHeight = origin.y + lineHeight
        }

        return CGSize(width: width.isInfinite ? origin.x : width,
                      height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize,
                       subviews: Subviews, cache: inout ()) {
        let width = bounds.width
        var origin = CGPoint(x: bounds.minX, y: bounds.minY)
        var lineHeight: CGFloat = 0

        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if origin.x + size.width > bounds.minX + width {
                origin.x = bounds.minX
                origin.y += lineHeight + runSpacing
                lineHeight = 0
            }
            view.place(at: origin, proposal: ProposedViewSize(size))
            lineHeight = max(lineHeight, size.height)
            origin.x += size.width + spacing
        }
    }
}

#Preview {
    GarmentDetailSheet(garment: SampleData.garments[0])
}
