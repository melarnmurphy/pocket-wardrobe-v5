//
//  TrendsView.swift
//  Pocket Wardrobe — editorial signal radar.
//

import SwiftUI

struct TrendsView: View {
    @State private var activeCategory: Category = .all
    @State private var selectedSignal: TrendSignal? = nil

    enum Category: Hashable, CaseIterable {
        case all, colour, garment, silhouette, material, aesthetic

        var label: String {
            switch self {
            case .all:         return "Overall"
            case .colour:      return "Colour"
            case .garment:     return "Garment"
            case .silhouette:  return "Silhouette"
            case .material:    return "Material"
            case .aesthetic:   return "Aesthetic"
            }
        }

        func matches(_ signal: TrendSignal) -> Bool {
            switch self {
            case .all:        return true
            case .colour:     return signal.category == .colour
            case .garment:    return signal.category == .garment
            case .silhouette: return signal.category == .silhouette
            case .material:   return signal.category == .material
            case .aesthetic:  return signal.category == .aesthetic
            }
        }
    }

    private var featured: TrendSignal? {
        SampleData.trendSignals.first(where: \.isSignalOfWeek)
    }

    private var filtered: [TrendSignal] {
        SampleData.trendSignals.filter { activeCategory.matches($0) && !$0.isSignalOfWeek }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 12) {
                    EyebrowLabel(text: "Global signals · Week of April 20, 2026")
                    (
                        Text("Trends").foregroundColor(PWColor.ink) +
                        Text(".").foregroundColor(PWColor.ink)
                    )
                    .font(PWFont.display(size: 44))

                    Text("47 normalized signals · 18 match your wardrobe · 6 flagged as missing pieces")
                        .caption(size: 14)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Category chips — edge-to-edge
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Category.allCases, id: \.self) { cat in
                            FilterChip(label: cat.label,
                                       count: cat == .all ? SampleData.trendSignals.count :
                                                            SampleData.trendSignals.filter { cat.matches($0) }.count,
                                       isActive: activeCategory == cat) {
                                withAnimation(.easeInOut(duration: 0.15)) { activeCategory = cat }
                            }
                        }
                    }
                    .padding(.horizontal, PWSpacing.pageGutter)
                }
                .padding(.top, 24)

                // Signal of the week
                if let f = featured, activeCategory == .all || activeCategory.matches(f) {
                    featuredCard(f)
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 32)
                        .onTapGesture { selectedSignal = f }
                }

                // Section heading
                VStack(alignment: .leading, spacing: 6) {
                    EyebrowLabel(text: "This week · \(filtered.count) signals")
                    Text("Matches in your wardrobe.")
                        .font(PWFont.display(size: 24))
                        .foregroundStyle(PWColor.ink)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 40)

                // Cards
                VStack(spacing: 14) {
                    ForEach(filtered) { signal in
                        TrendCardView(signal: signal) {
                            selectedSignal = signal
                        }
                    }
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)

                // Not-a-match yet
                VStack(alignment: .leading, spacing: 6) {
                    EyebrowLabel(text: "Signals without matches in your wardrobe")
                    Text("Noticing, not pushing.")
                        .font(PWFont.display(size: 22))
                        .foregroundStyle(PWColor.ink)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 48)

                VStack(spacing: 10) {
                    ForEach(SampleData.unmatchedSignals) { unmatched in
                        unmatchedCard(unmatched)
                    }
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 16)

                Spacer(minLength: 56)
            }
            .border(Color.red, width: 2)   // DEBUG: delete me — shows VStack bounds
        }
        .background(PWColor.ivory)
        .sheet(item: $selectedSignal) { signal in
            TrendDetailSheet(signal: signal)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Featured "Signal of the week"

    private func featuredCard(_ signal: TrendSignal) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Image mosaic
            HStack(spacing: 2) {
                AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80")) { phase in
                    switch phase {
                    case .success(let image): image.resizable().aspectRatio(contentMode: .fill)
                    default: PWColor.haze
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .clipped()

                AsyncImage(url: URL(string: "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?auto=format&fit=crop&w=600&q=80")) { phase in
                    switch phase {
                    case .success(let image): image.resizable().aspectRatio(contentMode: .fill)
                    default: PWColor.haze
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 180)
                .clipped()
            }

            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 10) {
                    EyebrowLabel(text: "Signal of the week")
                    MatchBadge(kind: .exact)
                }

                (
                    Text("Soft white neutrals, ").foregroundColor(PWColor.ink) +
                    Text("deep olive, ").foregroundColor(PWColor.ink) +
                    Text("relaxed tailoring.").italic().foregroundColor(PWColor.ink)
                )
                .font(PWFont.display(size: 30))

                Text(signal.summary)
                    .font(PWFont.body(size: 13))
                    .foregroundStyle(PWColor.ink70)
                    .lineSpacing(3)

                HStack(spacing: 24) {
                    metric("Confidence", "High")
                    metric("Sources", "\(signal.sourcesCount)")
                    metric("Your pieces", "\(signal.matchCount)")
                }

                PWButton(title: "Style from this", style: .primary)
            }
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PWColor.paper)
        }
        .overlay(
            RoundedRectangle(cornerRadius: PWRadius.md)
                .stroke(PWColor.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            EyebrowLabel(text: label, color: PWColor.ink40)
            Text(value)
                .font(PWFont.display(size: 20))
                .foregroundStyle(PWColor.ink)
        }
    }

    // MARK: - Unmatched

    private func unmatchedCard(_ unmatched: UnmatchedSignal) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                EyebrowLabel(text: unmatched.category.rawValue)
                Text(unmatched.title)
                    .font(PWFont.display(size: 17))
                    .foregroundStyle(PWColor.ink)
                Text("\(unmatched.sourcesCount) sources · \(unmatched.confidence.label)")
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink60)
            }
            Spacer()
            HStack(spacing: 2) {
                ForEach(0..<3) { i in
                    Capsule()
                        .fill(i < unmatched.confidence.bars ? PWColor.ink70 : PWColor.line)
                        .frame(width: 3, height: 7 + CGFloat(i) * 2)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(
            RoundedRectangle(cornerRadius: PWRadius.sm)
                .stroke(PWColor.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
    }
}

#Preview {
    TrendsView()
}
