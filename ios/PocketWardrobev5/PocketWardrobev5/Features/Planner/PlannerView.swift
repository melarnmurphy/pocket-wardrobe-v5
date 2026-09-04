//
//  PlannerView.swift
//  Pocket Wardrobe — weekly outfit planner with variant tabs + context cards.
//

import SwiftUI

struct PlannerView: View {
    @Environment(OutfitStore.self) private var outfitStore
    @Environment(TrendStore.self) private var trendStore
    @Environment(WeatherStore.self) private var weatherStore
    @Environment(SavedOutfitsStore.self) private var savedOutfitsStore
    @Environment(GarmentStore.self) private var garmentStore

    @State private var selectedDate: Date = Date()
    @State private var activeVariant: Outfit.Variant = .safe
    @State private var showingGenerator: Bool = false

    private var isTodaySelected: Bool {
        Calendar.current.isDate(selectedDate, inSameDayAs: Date())
    }

    private var selectedDateKey: String { OutfitStore.dateKey(selectedDate) }

    /// Today shows whichever of the three explored variants is active
    /// (outfitStore.outfits, from generateAll). Any other day shows its
    /// single week-batch pick (outfitStore.weekOutfits, from generateWeek) —
    /// nil until that day's been planned.
    private var currentOutfit: Outfit? {
        if isTodaySelected, let generated = outfitStore.outfits[activeVariant] {
            return generated
        }
        return outfitStore.weekOutfits[selectedDateKey]
    }

    private var weekDates: [Date] {
        let calendar = Calendar.current
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: Date()) }
    }

    private var weekStripDays: [DayPlan] {
        weekDates.map { date in
            let key = OutfitStore.dateKey(date)
            let outfit = outfitStore.weekOutfits[key]
            let weather = weatherStore.weekWeather[key]
            let calendar = Calendar.current
            let weekdayFormatter = DateFormatter()
            weekdayFormatter.dateFormat = "EEE"
            return DayPlan(
                date: date,
                weekday: weekdayFormatter.string(from: date),
                dayNumber: calendar.component(.day, from: date),
                weatherC: weather?.celsius ?? 0,
                weatherSummary: weather?.summary ?? "",
                weatherSymbol: weather?.symbol ?? "cloud",
                occasion: outfit?.occasion.isEmpty == false ? outfit!.occasion : "Unplanned",
                isPlanned: outfit != nil
            )
        }
    }

    private var plannedCount: Int { weekStripDays.filter(\.isPlanned).count }

    private func generateToday() {
        Task { await outfitStore.generateAll(topTrendSignalID: trendStore.signals.first?.id) }
    }

    private func regenerateSelectedDay() {
        let preset = currentOutfit.flatMap { OccasionPreset(rawValue: $0.occasion) } ?? .workwear
        Task {
            await outfitStore.generateWeek(
                days: [WeekDayPlan(date: selectedDate, occasion: preset)],
                avoidRepeat: true,
                laundryAware: true,
                manualExcludeIDs: []
            )
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                headSection
                generateCTA

                WeekStrip(days: weekStripDays, selectedDate: $selectedDate)
                    .padding(.top, 24)

                if isTodaySelected {
                    variantTabs
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 28)
                }

                errorBanners
                heroSection
                contextCards
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 24)

                savedSection
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 48)

                Spacer(minLength: 56)
            }
        }
        .background(PWColor.ivory)
        .task {
            await weatherStore.load()
            await weatherStore.loadWeek(dates: weekDates)
        }
        .sheet(isPresented: $showingGenerator) {
            GeneratorSettingsSheet()
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }

    private var headSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            EyebrowLabel(text: weekRangeLabel)
            (
                Text("This ").foregroundColor(PWColor.ink) +
                Text("week").italic().foregroundColor(PWColor.ink) +
                Text(".").foregroundColor(PWColor.ink)
            )
            .font(PWFont.display(size: 44))

            Text("\(plannedCount) of \(weekStripDays.count) days planned")
                .caption(size: 14)
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .padding(.top, 24)
    }

    private var generateCTA: some View {
        HStack(spacing: 10) {
            Spacer()
            PWButton(title: "Preferences", style: .outline, icon: "slider.horizontal.3") {
                showingGenerator = true
            }
            PWButton(title: "Generate today", style: .primary) {
                generateToday()
            }
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .padding(.top, 20)
    }

    @ViewBuilder
    private var errorBanners: some View {
        if case .error(let message) = outfitStore.state {
            Text(message)
                .caption(size: 13, color: PWColor.oxblood)
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)
        }
        if case .error(let message) = outfitStore.weekState {
            Text(message)
                .caption(size: 13, color: PWColor.oxblood)
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)
        }
        if let saveError = outfitStore.saveError {
            Text(saveError)
                .caption(size: 13, color: PWColor.oxblood)
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)
        }
    }

    @ViewBuilder
    private var heroSection: some View {
        if let outfit = currentOutfit {
            OutfitHero(outfit: outfit, onSave: {
                Task { await outfitStore.save(outfit) }
            }, onRegenerate: {
                if isTodaySelected {
                    generateToday()
                } else {
                    regenerateSelectedDay()
                }
            })
            .padding(.horizontal, PWSpacing.pageGutter)
            .padding(.top, 20)
            .opacity((outfitStore.state == .loading || outfitStore.weekState == .loading) ? 0.5 : 1)
            .disabled(outfitStore.state == .loading || outfitStore.weekState == .loading)
        } else {
            noOutfitPlaceholder
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)
        }
    }

    @ViewBuilder
    private var contextCards: some View {
        VStack(spacing: 16) {
            weatherCard
            occasionCard
            availabilityCard
            if let outfit = currentOutfit {
                alternativesCard(currentOutfit: outfit)
            }
        }
    }

    private var weekRangeLabel: String {
        guard let first = weekDates.first, let last = weekDates.last else { return "This week" }
        let f = DateFormatter()
        f.dateFormat = "MMMM d"
        return "Week of \(f.string(from: first)) — \(f.string(from: last))"
    }

    private var noOutfitPlaceholder: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(isTodaySelected ? "No outfit generated yet." : "This day isn't planned yet.")
                .font(PWFont.display(size: 18))
                .foregroundStyle(PWColor.ink)
            Text(isTodaySelected
                 ? "Tap \"Generate today\" above, or plan the whole week from Preferences."
                 : "Open Preferences to include this day in your next week plan.")
                .font(PWFont.body(size: 13))
                .foregroundStyle(PWColor.ink60)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
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

    @ViewBuilder
    private var weatherCard: some View {
        if case .error(let message) = weatherStore.state {
            VStack(alignment: .leading, spacing: 8) {
                EyebrowLabel(text: "Weather")
                Text(message).caption(size: 13)
            }
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PWColor.paper)
            .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
        } else if isTodaySelected, let local = weatherStore.weather {
            weatherCardContent(location: local.locationLabel, w: local.weather)
        } else if let w = weatherStore.weekWeather[selectedDateKey] {
            weatherCardContent(location: weatherStore.weather?.locationLabel ?? "your area", w: w)
        } else if let outfit = currentOutfit {
            weatherCardContent(location: "your area", w: outfit.weather)
        } else {
            EmptyView()
        }
    }

    private func weatherCardContent(location: String, w: Outfit.Weather) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            EyebrowLabel(text: location)

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

    @ViewBuilder
    private var occasionCard: some View {
        if let outfit = currentOutfit, !outfit.occasion.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    EyebrowLabel(text: "Occasion")
                    Spacer()
                    Text("Change in Preferences")
                        .font(PWFont.body(size: 11, weight: .medium))
                        .underline()
                        .foregroundStyle(PWColor.ink70)
                        .onTapGesture { showingGenerator = true }
                }
                Text(outfit.occasion)
                    .font(PWFont.display(size: 20))
                    .foregroundStyle(PWColor.ink)
            }
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PWColor.paper)
            .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
        }
    }

    // MARK: - Availability card

    private var unavailableGarments: [Garment] {
        let byID = Dictionary(uniqueKeysWithValues: garmentStore.garments.map { ($0.id, $0) })
        return outfitStore.unavailableGarmentIDs.compactMap { byID[$0] }
    }

    @ViewBuilder
    private var availabilityCard: some View {
        if !unavailableGarments.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    EyebrowLabel(text: "Availability")
                    Spacer()
                    Text("\(unavailableGarments.count) piece\(unavailableGarments.count == 1 ? "" : "s") unavailable")
                        .font(PWFont.body(size: 11))
                        .foregroundStyle(PWColor.ink60)
                }
                Text("Recently worn, so this week's plan left \(unavailableGarments.count == 1 ? "it" : "them") out: \(unavailableGarments.map(\.name).joined(separator: ", ")).")
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
                    .lineSpacing(3)
            }
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(PWColor.paper)
            .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
        }
    }

    // MARK: - Try instead

    /// Real, on-demand alternative — not a precomputed carousel, since the
    /// generator only ever produces one outfit per call. Regenerating the
    /// selected day (excluding today's pieces) is a genuine "try instead."
    private func alternativesCard(currentOutfit: Outfit) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            EyebrowLabel(text: "Try instead")
            Text("Regenerate this day with the same occasion, different pieces.")
                .font(PWFont.body(size: 12))
                .foregroundStyle(PWColor.ink60)
                .lineSpacing(3)
            PWButton(title: "Try another look", style: .outline) {
                if isTodaySelected {
                    generateToday()
                } else {
                    regenerateSelectedDay()
                }
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(PWColor.paper)
        .overlay(RoundedRectangle(cornerRadius: PWRadius.md).stroke(PWColor.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.md))
    }

    // MARK: - Saved outfits

    @ViewBuilder
    private var savedSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                EyebrowLabel(text: "Saved · \(savedOutfitsStore.outfits.count) outfits")
                Text("Outfits you love.")
                    .font(PWFont.display(size: 24))
                    .foregroundStyle(PWColor.ink)
            }

            if case .error(let message) = savedOutfitsStore.state {
                Text(message).caption(size: 13, color: PWColor.oxblood)
            } else if savedOutfitsStore.state == .loading && savedOutfitsStore.outfits.isEmpty {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
            } else if savedOutfitsStore.outfits.isEmpty {
                Text("Outfits you save from the planner show up here.")
                    .caption(size: 13)
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 14),
                    GridItem(.flexible(), spacing: 14)
                ], spacing: 14) {
                    ForEach(savedOutfitsStore.outfits) { saved in
                        savedCard(saved)
                    }
                }
            }
        }
        .task {
            await savedOutfitsStore.load()
        }
    }

    private func savedCard(_ saved: SavedOutfit) -> some View {
        let byID = Dictionary(uniqueKeysWithValues: garmentStore.garments.map { ($0.id, $0) })
        let pieces = saved.pieceIDs.compactMap { byID[$0] }
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
                Text(saved.lastWorn.map { "Last worn \(shortDate($0))" } ?? "Not yet worn")
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
        f.dateFormat = "MMM d"
        return f.string(from: date)
    }
}

#Preview {
    PlannerView()
        .environment(OutfitStore())
        .environment(GarmentStore())
        .environment(TrendStore())
        .environment(WeatherStore())
        .environment(SavedOutfitsStore())
}
