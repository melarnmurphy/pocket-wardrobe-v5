//
//  PlannerView.swift
//  Pocket Wardrobe — weekly outfit planner with variant tabs + context cards.
//

import SwiftUI

struct PlannerView: View {
    @State private var selectedDate: Date = SampleData.today
    @State private var activeVariant: Outfit.Variant = .safe
    @State private var showingGenerator: Bool = false

    private var currentOutfit: Outfit {
        SampleData.tuesdayOutfits.first(where: { $0.variant == activeVariant })
            ?? SampleData.tuesdayOutfits[0]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 12) {
                    EyebrowLabel(text: "Week of April 20 — April 26, 2026")
                    (
                        Text("This ").foregroundColor(PWColor.ink) +
                        Text("week").italic().foregroundColor(PWColor.ink) +
                        Text(".").foregroundColor(PWColor.ink)
                    )
                    .font(PWFont.display(size: 44))

                    Text("5 days planned · 2 open · Amsterdam · 13°–19° · partly cloudy")
                        .caption(size: 14)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Generate CTA
                HStack(spacing: 10) {
                    Spacer()
                    PWButton(title: "Preferences", style: .outline, icon: "slider.horizontal.3") {
                        showingGenerator = true
                    }
                    PWButton(title: "Generate the week", style: .primary) {
                        showingGenerator = true
                    }
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)

                // Week strip
                WeekStrip(days: SampleData.weekPlan, selectedDate: $selectedDate)
                    .padding(.top, 24)

                // Variant tabs
                variantTabs
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 28)

                // Outfit hero
                OutfitHero(outfit: currentOutfit)
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 20)

                // Context cards
                VStack(spacing: 16) {
                    weatherCard
                    occasionCard
                    availabilityCard
                    alternativesCard
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Saved outfits
                savedSection
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 48)

                Spacer(minLength: 56)
            }
        }
        .background(PWColor.ivory)
        .sheet(isPresented: $showingGenerator) {
            GeneratorSettingsSheet()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    // MARK: - Variant tabs

    private var variantTabs: some View {
        HStack(spacing: 20) {
            ForEach(Outfit.Variant.allCases, id: \.self) { variant in
                Button {
                    withAnimation(.easeInOut(duration: 0.15)) { activeVariant = variant }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(variant.rawValue)
                            .font(PWFont.display(size: 15))
                            .foregroundStyle(activeVariant == variant ? PWColor.ink : PWColor.ink40)
                        Text(variant.caption)
                            .font(PWFont.body(size: 10))
                            .foregroundStyle(PWColor.ink40)
                    }
                    .padding(.bottom, 10)
                    .overlay(alignment: .bottom) {
                        Rectangle()
                            .fill(activeVariant == variant ? PWColor.ink : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    // MARK: - Weather card

    private var weatherCard: some View {
        let w = currentOutfit.weather
        return VStack(alignment: .leading, spacing: 14) {
            EyebrowLabel(text: "Tuesday · Amsterdam")

            HStack(alignment: .center, spacing: 18) {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(w.celsius)")
                        .font(PWFont.display(size: 62))
                        .foregroundStyle(PWColor.ink)
                    Text("°")
                        .font(PWFont.display(size: 32))
                        .foregroundStyle(PWColor.ink60)
                }
                Spacer()
                Image(systemName: w.symbol)
                    .font(.system(size: 28, weight: .light))
                    .foregroundStyle(PWColor.ink70)
                    .frame(width: 64, height: 64)
                    .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
            }

            Text(w.summary)
                .font(PWFont.body(size: 12))
                .foregroundStyle(PWColor.ink60)
                .lineSpacing(3)

            HStack(spacing: 0) {
                metric("Low", "\(w.low)°")
                Divider().frame(height: 34).background(PWColor.line)
                metric("High", "\(w.high)°")
                Divider().frame(height: 34).background(PWColor.line)
                metric("Rain", "\(w.rainProbability)%")
            }
            .padding(.top, 8)
            .padding(.vertical, 10)
            .overlay(Rectangle().fill(PWColor.lineSoft).frame(height: 1), alignment: .top)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            EyebrowLabel(text: label, color: PWColor.ink40)
            Text(value).font(PWFont.display(size: 20)).foregroundStyle(PWColor.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
    }

    // MARK: - Occasion card

    private var occasionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                EyebrowLabel(text: "Occasion")
                Spacer()
                Text("Change")
                    .font(PWFont.body(size: 11, weight: .medium))
                    .underline()
                    .foregroundStyle(PWColor.ink70)
            }
            Text("Workwear — studio")
                .font(PWFont.display(size: 20))
                .foregroundStyle(PWColor.ink)
            Text("Creative office. Smart casual expected, closed shoes, blazer optional but you usually wear one.")
                .font(PWFont.body(size: 12))
                .foregroundStyle(PWColor.ink60)
                .lineSpacing(3)

            HStack(spacing: 8) {
                ForEach(["Closed-toe", "Tailored", "Neutral palette"], id: \.self) { text in
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 9, weight: .semibold))
                        Text(text)
                            .font(PWFont.body(size: 11))
                    }
                    .foregroundStyle(PWColor.ink70)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(PWColor.mist)
                    .clipShape(RoundedRectangle(cornerRadius: PWRadius.pill))
                }
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    // MARK: - Availability card

    private var availabilityCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                EyebrowLabel(text: "Availability")
                Spacer()
                Text("2 pieces unavailable")
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink60)
            }
            Text("Your Burberry trench is out this week (rainproofing) and the black slip is packed for Friday's event.")
                .font(PWFont.body(size: 12))
                .foregroundStyle(PWColor.ink60)
                .lineSpacing(3)

            HStack(spacing: 6) {
                laundryBar(state: .on)
                laundryBar(state: .on)
                laundryBar(state: .on)
                laundryBar(state: .on)
                laundryBar(state: .off)
                laundryBar(state: .warn)
            }
            .padding(.top, 4)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    private enum LaundryState { case on, off, warn }

    private func laundryBar(state: LaundryState) -> some View {
        let color: Color = {
            switch state {
            case .on: return PWColor.ink
            case .off: return PWColor.line
            case .warn: return PWColor.oxblood
            }
        }()
        return Capsule().fill(color).frame(height: 4).frame(maxWidth: .infinity)
    }

    // MARK: - Alternatives

    private var alternativesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                EyebrowLabel(text: "Try instead")
                Spacer()
                Text("See all")
                    .font(PWFont.body(size: 11, weight: .medium))
                    .underline()
                    .foregroundStyle(PWColor.ink70)
            }
            VStack(spacing: 0) {
                ForEach(Array(SampleData.alternatives.enumerated()), id: \.element.id) { idx, alt in
                    altRow(alt)
                    if idx < SampleData.alternatives.count - 1 {
                        HairlineDivider(color: PWColor.lineSoft)
                    }
                }
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    private func altRow(_ alt: OutfitAlternative) -> some View {
        HStack(spacing: 14) {
            // 2x2 thumbnail grid
            LazyVGrid(columns: [GridItem(.fixed(34), spacing: 2), GridItem(.fixed(34), spacing: 2)], spacing: 2) {
                ForEach(Array(alt.thumbnailURLs.prefix(4).enumerated()), id: \.offset) { _, url in
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            PWColor.mist
                        }
                    }
                    .frame(width: 34, height: 34)
                    .clipped()
                }
            }
            .frame(width: 70, height: 70)
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))

            VStack(alignment: .leading, spacing: 3) {
                Text(alt.title)
                    .font(PWFont.display(size: 16))
                    .foregroundStyle(PWColor.ink)
                Text(alt.caption)
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink60)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(PWColor.ink40)
        }
        .padding(.vertical, 12)
    }

    // MARK: - Saved outfits

    private var savedSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                EyebrowLabel(text: "Saved · 42 outfits · 9 this month")
                Text("Outfits you love.")
                    .font(PWFont.display(size: 24))
                    .foregroundStyle(PWColor.ink)
            }

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 14),
                GridItem(.flexible(), spacing: 14)
            ], spacing: 14) {
                ForEach(SampleData.savedOutfits) { saved in
                    savedCard(saved)
                }
            }
        }
    }

    private func savedCard(_ saved: SavedOutfit) -> some View {
        let pieces = saved.pieceIDs.compactMap { SampleData.garment($0) }
        return VStack(alignment: .leading, spacing: 0) {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 2), GridItem(.flexible(), spacing: 2)], spacing: 2) {
                ForEach(pieces.prefix(4)) { piece in
                    AsyncImage(url: piece.imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            PWColor.mist
                        }
                    }
                    .frame(height: 76)
                    .clipped()
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                EyebrowLabel(text: "\(saved.kind) · worn \(saved.timesWorn)×", color: PWColor.ink40)
                Text(saved.title)
                    .font(PWFont.display(size: 16))
                    .foregroundStyle(PWColor.ink)
                    .lineLimit(1)
                Text("Last worn \(shortDate(saved.lastWorn))")
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink60)
            }
            .padding(14)
        }
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.sm).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
    }

    private func shortDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Amsterdam")
        f.dateFormat = "MMM d"
        return f.string(from: date)
    }
}

#Preview {
    PlannerView()
}
