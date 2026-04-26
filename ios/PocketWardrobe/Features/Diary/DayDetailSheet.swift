//
//  DayDetailSheet.swift
//  Pocket Wardrobe — a single diary entry opened as a sheet.
//

import SwiftUI

struct DayDetailSheet: View {
    let event: WearEvent
    @Environment(\.dismiss) private var dismiss

    private var pieces: [Garment] {
        event.pieceIDs.compactMap { SampleData.garment($0) }
    }

    private var dateString: String {
        let f = DateFormatter()
        f.timeZone = TimeZone(identifier: "Europe/Amsterdam")
        f.dateFormat = "EEEE · MMMM d, yyyy"
        return f.string(from: event.date)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero
                ZStack(alignment: .bottomLeading) {
                    AsyncImage(url: event.photoURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default: PWColor.mist
                        }
                    }
                    .frame(height: 460)
                    .frame(maxWidth: .infinity)
                    .clipped()

                    HStack {
                        Text("Your photo")
                            .font(PWFont.body(size: 10, weight: .medium))
                            .tracking(10 * 0.14)
                            .textCase(.uppercase)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .foregroundStyle(PWColor.ivory)
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: PWRadius.xs))
                    }
                    .padding(16)
                }

                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: dateString)
                        Text(event.title).display(size: 34)
                    }
                    .padding(.top, 28)

                    // Tag row
                    FlowLayout(spacing: 8, runSpacing: 8) {
                        TagChip(text: event.occasion)
                        if event.isFavourite {
                            TagChip(text: "♥ Favourite", style: .accent)
                        }
                        TagChip(text: "\(event.weatherC)° · \(event.weatherSummary)")
                    }

                    // Pieces
                    VStack(alignment: .leading, spacing: 12) {
                        EyebrowLabel(text: "Pieces")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(pieces) { piece in
                                    VStack(alignment: .leading, spacing: 6) {
                                        AsyncImage(url: piece.imageURL) { phase in
                                            switch phase {
                                            case .success(let image):
                                                image.resizable().aspectRatio(contentMode: .fill)
                                            default: PWColor.mist
                                            }
                                        }
                                        .frame(width: 90, height: 112)
                                        .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: PWRadius.sm)
                                                .stroke(PWColor.line, lineWidth: 1)
                                        )
                                        Text(piece.name)
                                            .font(PWFont.body(size: 11))
                                            .foregroundStyle(PWColor.ink60)
                                            .lineLimit(1)
                                            .frame(width: 90, alignment: .leading)
                                    }
                                }
                            }
                        }
                    }

                    if let note = event.note {
                        VStack(alignment: .leading, spacing: 10) {
                            EyebrowLabel(text: "Your note")
                            Text("\u{201C}\(note)\u{201D}")
                                .font(PWFont.displayItalic(size: 18))
                                .foregroundStyle(PWColor.ink)
                                .lineSpacing(4)
                        }
                    }

                    // Context
                    VStack(alignment: .leading, spacing: 0) {
                        EyebrowLabel(text: "Context")
                            .padding(.bottom, 6)
                        contextRow("Occasion", event.occasion)
                        contextRow("Weather", "\(event.weatherC)° · \(event.weatherSummary)")
                        contextRow("Source", event.source.rawValue, isLast: true)
                    }

                    HStack(spacing: 10) {
                        PWButton(title: "Re-wear this", style: .primary)
                        PWButton(title: "Replace photo", style: .outline)
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
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

    private func contextRow(_ label: String, _ value: String, isLast: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(label)
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
                Spacer()
                Text(value)
                    .font(PWFont.body(size: 14))
                    .foregroundStyle(PWColor.ink)
            }
            .padding(.vertical, 12)
            if !isLast { HairlineDivider(color: PWColor.lineSoft) }
        }
    }
}

#Preview {
    DayDetailSheet(event: SampleData.wearEvents[7])
}
