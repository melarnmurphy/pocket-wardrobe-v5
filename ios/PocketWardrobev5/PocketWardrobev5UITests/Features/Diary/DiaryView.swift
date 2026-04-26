//
//  DiaryView.swift
//  Pocket Wardrobe — month-view diary of outfits worn.
//

import SwiftUI

struct DiaryView: View {

    // MARK: - State

    @State private var visibleMonth: Date = SampleData.today
    @State private var selectedEvent: WearEvent? = nil
    @State private var logDate: IdentifiedDate? = nil

    // MARK: - Calendar

    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Amsterdam")!
        c.firstWeekday = 2   // Monday start
        return c
    }

    private var monthTitle: String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Amsterdam")
        f.dateFormat = "MMMM yyyy"
        return f.string(from: visibleMonth)
    }

    /// Returns a flat array of 42 (6 weeks × 7 days) tagged with whether each is
    /// in the currently-visible month.
    private struct CellData: Identifiable {
        let id: UUID = UUID()
        let date: Date
        let inMonth: Bool
    }

    private var cells: [CellData] {
        let comps = cal.dateComponents([.year, .month], from: visibleMonth)
        guard let monthStart = cal.date(from: comps) else { return [] }

        // Find the Monday on or before monthStart.
        var gridStart = monthStart
        while cal.component(.weekday, from: gridStart) != cal.firstWeekday {
            gridStart = cal.date(byAdding: .day, value: -1, to: gridStart)!
        }

        return (0..<42).map { offset in
            let d = cal.date(byAdding: .day, value: offset, to: gridStart)!
            let inMonth = cal.isDate(d, equalTo: monthStart, toGranularity: .month)
            return CellData(date: d, inMonth: inMonth)
        }
    }

    private func event(for date: Date) -> WearEvent? {
        SampleData.wearEvents.first { cal.isDate($0.date, inSameDayAs: date) }
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 12) {
                    EyebrowLabel(text: "Worn · looked at · remembered")
                    HStack(spacing: 16) {
                        Button {
                            shiftMonth(by: -1)
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(PWColor.ink70)

                        Text("\(monthComponent(.month)) \(monthComponent(.yearItalic)).")
                            .font(PWFont.display(size: 38))
                            .foregroundStyle(PWColor.ink)

                        Button {
                            shiftMonth(by: 1)
                        } label: {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .medium))
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(PWColor.ink70)
                    }
                    Text(statsLine)
                        .caption(size: 13)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Log today button
                HStack {
                    Spacer()
                    PWButton(title: "Log today's outfit", style: .primary, icon: "plus") {
                        logDate = IdentifiedDate(date: SampleData.today)
                    }
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 20)

                // Weekday row
                HStack(spacing: 0) {
                    ForEach(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], id: \.self) { d in
                        Text(d)
                            .font(PWFont.body(size: 10, weight: .medium))
                            .tracking(10 * 0.14)
                            .textCase(.uppercase)
                            .foregroundStyle(PWColor.ink40)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 28)
                .padding(.bottom, 10)

                // Grid
                monthGrid
                    .padding(.horizontal, PWSpacing.pageGutter)

                // Stats strip
                statsStrip
                    .padding(.horizontal, PWSpacing.pageGutter)
                    .padding(.top, 36)
                    .padding(.bottom, 40)
            }
        }
        .background(PWColor.ivory)
        .sheet(item: $selectedEvent) { event in
            DayDetailSheet(event: event)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $logDate) { id in
            LogOutfitSheet(date: id.date)
        }
    }

    // MARK: - Month grid

    private var monthGrid: some View {
        VStack(spacing: 1) {
            // 6 rows × 7 columns. We use our own cell rendering (not LazyVGrid) so
            // we can give the active photo cells proper full-bleed imagery.
            ForEach(0..<6, id: \.self) { row in
                HStack(spacing: 1) {
                    ForEach(0..<7, id: \.self) { col in
                        let cell = cells[row * 7 + col]
                        dayCell(cell)
                    }
                }
            }
        }
        .background(PWColor.line)          // gives a hairline between cells
        .overlay(
            RoundedRectangle(cornerRadius: PWRadius.sm)
                .stroke(PWColor.line, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
    }

    @ViewBuilder
    private func dayCell(_ cell: CellData) -> some View {
        let event = event(for: cell.date)
        let isToday = cal.isDateInToday(cell.date) || cal.isDate(cell.date, inSameDayAs: SampleData.today)
        let dayNum = cal.component(.day, from: cell.date)

        Button {
            if let event {
                selectedEvent = event
            } else if cell.inMonth {
                logDate = IdentifiedDate(date: cell.date)
            }
        } label: {
            ZStack(alignment: .topLeading) {
                if let event {
                    // Full-bleed photo
                    AsyncImage(url: event.photoURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            PWColor.mist
                        }
                    }
                    .clipped()

                    // Gradient overlay
                    LinearGradient(
                        colors: [Color.black.opacity(0.5), .clear, .clear, Color.black.opacity(0.35)],
                        startPoint: .top, endPoint: .bottom
                    )

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(dayNum)")
                            .font(PWFont.mono(size: 11))
                            .foregroundStyle(.white)
                        if event.isFavourite {
                            Image(systemName: "heart.fill")
                                .font(.system(size: 9))
                                .foregroundStyle(.white.opacity(0.9))
                        }
                    }
                    .padding(6)

                } else {
                    // Empty cell
                    Rectangle()
                        .fill(cell.inMonth ? PWColor.paper : PWColor.mist.opacity(0.5))
                    VStack(alignment: .leading) {
                        Text("\(dayNum)")
                            .font(PWFont.mono(size: 11))
                            .foregroundStyle(cell.inMonth
                                             ? (isToday ? PWColor.ink : PWColor.ink40)
                                             : PWColor.ink20)
                        Spacer()
                        if cell.inMonth && !isToday {
                            Image(systemName: "plus")
                                .font(.system(size: 10, weight: .regular))
                                .foregroundStyle(PWColor.ink40.opacity(0.6))
                        }
                    }
                    .padding(6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }

                // Today ring
                if isToday {
                    RoundedRectangle(cornerRadius: 0)
                        .strokeBorder(PWColor.ink, lineWidth: 2)
                }
            }
            .aspectRatio(0.8, contentMode: .fit)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Stats strip

    private var statsStrip: some View {
        let worn = SampleData.wearEvents.count
        let favs = SampleData.wearEvents.filter(\.isFavourite).count
        let uniquePieces = Set(SampleData.wearEvents.flatMap(\.pieceIDs)).count
        let avgC = SampleData.wearEvents.map(\.weatherC).reduce(0, +) / max(1, worn)

        return HStack(spacing: 0) {
            statCell("\(worn)", "outfits")
            Divider().frame(height: 42).background(PWColor.line)
            statCell("\(uniquePieces)", "pieces")
            Divider().frame(height: 42).background(PWColor.line)
            statCell("\(favs)", "favourites")
            Divider().frame(height: 42).background(PWColor.line)
            statCell("\(avgC)°", "avg weather")
        }
        .padding(.vertical, 18)
        .overlay(
            Rectangle().fill(PWColor.line).frame(height: 1),
            alignment: .top
        )
        .overlay(
            Rectangle().fill(PWColor.line).frame(height: 1),
            alignment: .bottom
        )
    }

    private func statCell(_ n: String, _ label: String) -> some View {
        VStack(alignment: .center, spacing: 4) {
            Text(n)
                .font(PWFont.display(size: 26))
                .foregroundStyle(PWColor.ink)
            EyebrowLabel(text: label, color: PWColor.ink40)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Helpers

    private var statsLine: String {
        let worn = SampleData.wearEvents.count
        let favs = SampleData.wearEvents.filter(\.isFavourite).count
        return "\(worn) outfits logged · \(favs) new favourites · avg $4.20 per wear"
    }

    private enum MonthPart { case month, yearItalic }

    private func monthComponent(_ part: MonthPart) -> String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Amsterdam")
        switch part {
        case .month:      f.dateFormat = "MMMM"; return f.string(from: visibleMonth)
        case .yearItalic: f.dateFormat = "yyyy"; return f.string(from: visibleMonth)
        }
    }

    private func shiftMonth(by delta: Int) {
        if let newDate = cal.date(byAdding: .month, value: delta, to: visibleMonth) {
            withAnimation(.easeInOut(duration: 0.2)) { visibleMonth = newDate }
        }
    }
}

/// Wrap a raw Date in an Identifiable for .sheet(item:) plumbing.
private struct IdentifiedDate: Identifiable {
    let id: UUID = UUID()
    let date: Date
}

#Preview {
    DiaryView()
}
