//
//  GeneratorSettingsSheet.swift
//  Pocket Wardrobe — "Generate the week" modal.
//

import SwiftUI

struct GeneratorSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var week: String = "This week · Apr 20 – 26"
    @State private var location: String = "Amsterdam, NL"
    @State private var occasions: [String: String] = [
        "Mon": "Workwear — studio",
        "Tue": "Workwear — studio",
        "Wed": "Client lunch",
        "Thu": "Workwear — studio",
        "Fri": "Evening event",
        "Sat": "None · skip",
        "Sun": "None · skip",
    ]
    @State private var liftUnderworn = true
    @State private var avoidRepeat = true
    @State private var laundryAware = true
    @State private var trendWeight: Double = 0.5

    private let days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    private let dates = ["Apr 20", "Apr 21", "Apr 22", "Apr 23", "Apr 24", "Apr 25", "Apr 26"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: "Plan your week")
                        Text("Generate outfits.")
                            .font(PWFont.display(size: 28))
                            .foregroundStyle(PWColor.ink)
                        Text("We'll generate a safe, elevated, and trend-forward option for each planned day. You can still swap and regenerate any look.")
                            .font(PWFont.body(size: 13))
                            .foregroundStyle(PWColor.ink70)
                            .lineSpacing(3)
                    }

                    // Week + Location
                    HStack(spacing: 14) {
                        pickerField(label: "Week", value: $week,
                                    options: ["This week · Apr 20 – 26", "Next week · Apr 27 – May 3"])
                        pickerField(label: "Location", value: $location,
                                    options: ["Amsterdam, NL", "London, UK", "Paris, FR"])
                    }

                    HairlineDivider()

                    // Occasion per day
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Occasion per day")
                        VStack(spacing: 0) {
                            ForEach(Array(days.enumerated()), id: \.offset) { idx, day in
                                dayRow(day: day, date: dates[idx])
                                if idx < days.count - 1 {
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
                                   caption: "9 pieces in your wardrobe have been worn fewer than 3 times.",
                                   isOn: $liftUnderworn)
                        HairlineDivider(color: PWColor.lineSoft)
                        prefToggle(title: "Avoid repeating pieces",
                                   caption: "Don't show any single piece twice in a row.",
                                   isOn: $avoidRepeat)
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
                            Text("Boost looks aligned with this week's top signals.")
                                .font(PWFont.body(size: 12))
                                .foregroundStyle(PWColor.ink60)
                            Slider(value: $trendWeight, in: 0...1)
                                .tint(PWColor.ink)
                        }
                        .padding(.vertical, 10)

                        HairlineDivider(color: PWColor.lineSoft)
                        prefToggle(title: "Laundry-aware",
                                   caption: "Skip pieces marked unavailable or in laundry.",
                                   isOn: $laundryAware)
                    }

                    HairlineDivider()

                    // Excludes
                    VStack(alignment: .leading, spacing: 10) {
                        EyebrowLabel(text: "Exclude these pieces")
                        HStack(spacing: 8) {
                            TagChip(text: "Burberry trench × ", style: .solid)
                            TagChip(text: "Black slip × ", style: .solid)
                            TagChip(text: "+ Add", style: .plain)
                        }
                    }

                    // Actions
                    VStack(spacing: 10) {
                        PWButton(title: "Generate 5 outfits", style: .primary) { dismiss() }
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
    }

    private var trendWeightLabel: String {
        switch trendWeight {
        case 0.0..<0.34:  return "Low"
        case 0.34..<0.67: return "Medium"
        default:          return "High"
        }
    }

    // MARK: - Small sub-views

    private func pickerField(label: String, value: Binding<String>, options: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            EyebrowLabel(text: label)
            Menu {
                ForEach(options, id: \.self) { opt in
                    Button(opt) { value.wrappedValue = opt }
                }
            } label: {
                HStack {
                    Text(value.wrappedValue)
                        .font(PWFont.body(size: 13))
                        .foregroundStyle(PWColor.ink)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(PWColor.ink40)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(PWColor.ivory)
                .overlay(RoundedRectangle(cornerRadius: PWRadius.xs).stroke(PWColor.line, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func dayRow(day: String, date: String) -> some View {
        HStack {
            Text(day.uppercased())
                .font(PWFont.body(size: 10, weight: .medium))
                .tracking(10 * 0.18)
                .foregroundStyle(PWColor.ink60)
                .frame(width: 36, alignment: .leading)
            Text(date)
                .font(PWFont.display(size: 15))
                .foregroundStyle(PWColor.ink)
            Spacer()
            Menu {
                ForEach(["Workwear — studio", "Client meeting", "Client lunch", "Evening event",
                         "Weekend casual", "Travel", "None · skip"], id: \.self) { opt in
                    Button(opt) { occasions[day] = opt }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(occasions[day] ?? "")
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
}

#Preview {
    GeneratorSettingsSheet()
}
