//
//  GeneratorSettingsSheet.swift
//  Pocket Wardrobe — "Generate the week" modal.
//

import SwiftUI

struct GeneratorSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(OutfitStore.self) private var outfitStore
    @Environment(GarmentStore.self) private var garmentStore

    @State private var weekOffset: Int = 0 // 0 = this week, 1 = next week
    @State private var weekDays: [WeekDayPlan] = []
    @State private var avoidRepeat = true
    @State private var laundryAware = true
    @State private var excludedGarmentIDs: [UUID] = []
    @State private var showingExcludePicker = false

    @State private var liftUnderworn = true
    // 0-1. Applies the user's top trend match as a scoring boost on every
    // planned day, regardless of that day's occasion — the generator's
    // trend boost no longer requires "trend" mode (see generator.ts's
    // trendWeight param).
    @State private var trendWeight: Double = 0.5

    private var activeDayCount: Int {
        weekDays.filter { !$0.occasion.isSkipped }.count
    }

    private var excludedGarments: [Garment] {
        let byID = Dictionary(uniqueKeysWithValues: garmentStore.garments.map { ($0.id, $0) })
        return excludedGarmentIDs.compactMap { byID[$0] }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: "Plan your week")
                        Text("Generate outfits.")
                            .font(PWFont.display(size: 28))
                            .foregroundStyle(PWColor.ink)
                        Text("One outfit per planned day, generated in order so the week doesn't repeat a piece you've already worn that week — or recently.")
                            .font(PWFont.body(size: 13))
                            .foregroundStyle(PWColor.ink70)
                            .lineSpacing(3)
                    }

                    Picker("Week", selection: $weekOffset) {
                        Text("This week").tag(0)
                        Text("Next week").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: weekOffset) { _, _ in rebuildWeekDays() }

                    HairlineDivider()

                    // Occasion per day
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Occasion per day")
                        VStack(spacing: 0) {
                            ForEach(Array(weekDays.enumerated()), id: \.element.id) { idx, day in
                                dayRow(day: day, index: idx)
                                if idx < weekDays.count - 1 {
                                    HairlineDivider(color: PWColor.lineSoft)
                                }
                            }
                        }
                    }

                    HairlineDivider()

                    // Ranking preferences
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Ranking preferences")

                        prefToggle(title: "Lift underworn pieces",
                                   caption: "Boost pieces with a high cost-per-wear you haven't worn much.",
                                   isOn: $liftUnderworn)
                        HairlineDivider(color: PWColor.lineSoft)
                        prefToggle(title: "Avoid repeating pieces",
                                   caption: "Don't reuse a piece already picked earlier this week.",
                                   isOn: $avoidRepeat)
                        HairlineDivider(color: PWColor.lineSoft)
                        prefToggle(title: "Laundry-aware",
                                   caption: "Skip pieces you've logged as worn recently.",
                                   isOn: $laundryAware)
                        HairlineDivider(color: PWColor.lineSoft)

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Weigh trend signals")
                                    .font(PWFont.display(size: 15))
                                    .foregroundStyle(PWColor.ink)
                                Spacer()
                                Text(trendWeightLabel)
                                    .font(PWFont.body(size: 11, weight: .medium))
                                    .foregroundStyle(PWColor.ink)
                            }
                            Text("Lean every planned day toward your top trend match.")
                                .font(PWFont.body(size: 12))
                                .foregroundStyle(PWColor.ink60)
                            Slider(value: $trendWeight, in: 0...1)
                                .tint(PWColor.ink)
                        }
                        .padding(.vertical, 10)
                    }

                    HairlineDivider()

                    // Excludes
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Exclude these pieces")
                        HStack(spacing: 8) {
                            ForEach(excludedGarments) { garment in
                                TagChip(text: "\(garment.name) ×", style: .solid)
                                    .onTapGesture {
                                        excludedGarmentIDs.removeAll { $0 == garment.id }
                                    }
                            }
                            TagChip(text: "+ Add", style: .plain)
                                .onTapGesture { showingExcludePicker = true }
                        }
                    }

                    // Actions
                    VStack(spacing: 10) {
                        PWButton(title: "Generate \(activeDayCount) outfit\(activeDayCount == 1 ? "" : "s")", style: .primary) {
                            Task {
                                await outfitStore.generateWeek(
                                    days: weekDays,
                                    avoidRepeat: avoidRepeat,
                                    laundryAware: laundryAware,
                                    manualExcludeIDs: excludedGarmentIDs,
                                    liftUnderworn: liftUnderworn,
                                    trendWeight: trendWeight
                                )
                                dismiss()
                            }
                        }
                        .disabled(activeDayCount == 0)
                        PWButton(title: "Cancel", style: .ghost) { dismiss() }
                    }
                    .padding(.top, 12)
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
        .task {
            if weekDays.isEmpty { rebuildWeekDays() }
        }
        .sheet(isPresented: $showingExcludePicker) {
            excludePickerSheet
        }
    }

    private var trendWeightLabel: String {
        switch trendWeight {
        case 0.0..<0.01:  return "Off"
        case 0.01..<0.34: return "Low"
        case 0.34..<0.67: return "Medium"
        default:          return "High"
        }
    }

    private func rebuildWeekDays() {
        let calendar = Calendar.current
        let base = calendar.date(byAdding: .day, value: weekOffset * 7, to: Date()) ?? Date()
        weekDays = (0..<7).compactMap { offset -> WeekDayPlan? in
            guard let date = calendar.date(byAdding: .day, value: offset, to: base) else { return nil }
            let weekday = calendar.component(.weekday, from: date) // 1 = Sunday
            let isWeekend = weekday == 1 || weekday == 7
            return WeekDayPlan(date: date, occasion: isWeekend ? .weekendCasual : .workwear)
        }
    }

    // MARK: - Small sub-views

    private func dayRow(day: WeekDayPlan, index: Int) -> some View {
        HStack {
            Text(weekdayLabel(day.date))
                .font(PWFont.body(size: 10, weight: .medium))
                .tracking(10 * 0.18)
                .foregroundStyle(PWColor.ink60)
                .frame(width: 36, alignment: .leading)
            Text(dayLabel(day.date))
                .font(PWFont.display(size: 15))
                .foregroundStyle(PWColor.ink)
            Spacer()
            Menu {
                ForEach(OccasionPreset.allCases, id: \.self) { opt in
                    Button(opt.rawValue) { weekDays[index].occasion = opt }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(day.occasion.rawValue)
                        .font(PWFont.body(size: 12))
                        .foregroundStyle(PWColor.ink70)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(PWColor.ink40)
                }
            }
        }
        .padding(.vertical, 12)
    }

    private func weekdayLabel(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "EEE"
        return f.string(from: date).uppercased()
    }

    private func dayLabel(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: date)
    }

    private func prefToggle(title: String, caption: String, isOn: Binding<Bool>) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(PWFont.display(size: 15))
                    .foregroundStyle(PWColor.ink)
                Text(caption)
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
                    .lineSpacing(2)
            }
            Spacer()
            PWSwitch(isOn: isOn)
        }
        .padding(.vertical, 10)
    }

    private var excludePickerSheet: some View {
        NavigationStack {
            List(garmentStore.garments) { garment in
                Button {
                    if !excludedGarmentIDs.contains(garment.id) {
                        excludedGarmentIDs.append(garment.id)
                    }
                    showingExcludePicker = false
                } label: {
                    HStack {
                        Text(garment.name).foregroundStyle(PWColor.ink)
                        Spacer()
                        if excludedGarmentIDs.contains(garment.id) {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }
            .navigationTitle("Exclude a piece")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { showingExcludePicker = false }
                }
            }
        }
    }
}

#Preview {
    GeneratorSettingsSheet()
        .environment(OutfitStore())
        .environment(GarmentStore())
}
