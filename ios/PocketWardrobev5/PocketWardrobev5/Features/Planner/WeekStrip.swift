//
//  WeekStrip.swift
//  Pocket Wardrobe — horizontal scroll of the 7-day week.
//

import SwiftUI

struct WeekStrip: View {
    let days: [DayPlan]
    @Binding var selectedDate: Date

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(days) { day in
                    dayCard(day)
                        .onTapGesture {
                            withAnimation(.easeInOut(duration: 0.15)) { selectedDate = day.date }
                        }
                }
            }
            .padding(.horizontal, PWSpacing.pageGutter)
        }
    }

    private func dayCard(_ day: DayPlan) -> some View {
        let isSelected = Calendar.current.isDate(day.date, inSameDayAs: selectedDate)

        return VStack(alignment: .leading, spacing: 8) {
            Text(day.weekday.uppercased())
                .font(PWFont.body(size: 9, weight: .medium))
                .tracking(9 * 0.18)
                .foregroundStyle(isSelected ? PWColor.ivory : PWColor.ink40)

            Text("\(day.dayNumber)")
                .font(PWFont.display(size: 30))
                .foregroundStyle(isSelected ? PWColor.ivory : PWColor.ink)

            HStack(spacing: 4) {
                Image(systemName: day.weatherSymbol)
                    .font(.system(size: 10))
                Text("\(day.weatherC)° · \(day.weatherSummary)")
                    .font(PWFont.body(size: 10))
            }
            .foregroundStyle(isSelected ? PWColor.ivory.opacity(0.75) : PWColor.ink60)

            Text(day.occasion)
                .font(PWFont.body(size: 10, weight: .medium))
                .tracking(10 * 0.10)
                .textCase(.uppercase)
                .foregroundStyle(isSelected ? PWColor.ivory : PWColor.ink70)

            HStack(spacing: 2) {
                ForEach(0..<3) { _ in
                    Capsule()
                        .fill(isSelected ? PWColor.ivory.opacity(0.6) :
                              (day.isPlanned ? PWColor.ink70 : PWColor.line))
                        .frame(height: 2)
                }
            }
            .padding(.top, 4)
        }
        .padding(14)
        .frame(width: 140, alignment: .leading)
        .background(isSelected ? PWColor.ink : PWColor.paper)
        .overlay(
            RoundedRectangle(cornerRadius: PWRadius.sm)
                .stroke(isSelected ? PWColor.ink : PWColor.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
    }
}
