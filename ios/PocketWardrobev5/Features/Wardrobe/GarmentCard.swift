//
//  GarmentCard.swift
//  Pocket Wardrobe — editorial card for a single garment.
//

import SwiftUI

struct GarmentCard: View {
    let garment: Garment

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topTrailing) {
                // Image — 4/5 aspect, muted fallback
                AsyncImage(url: garment.imageURL, transaction: .init(animation: .easeIn)) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure(_), .empty:
                        ZStack {
                            PWColor.mist
                            Image(systemName: "photo")
                                .foregroundStyle(PWColor.ink20)
                                .font(.system(size: 22, weight: .light))
                        }
                    @unknown default:
                        PWColor.mist
                    }
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(4.0/5.0, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: PWRadius.sm)
                        .stroke(PWColor.line, lineWidth: 1)
                )

                if let match = garment.match {
                    MatchBadge(kind: match)
                        .padding(10)
                }
            }

            // Brand · name
            VStack(alignment: .leading, spacing: 2) {
                Text(garment.brand ?? "—")
                    .font(PWFont.body(size: 10, weight: .medium))
                    .tracking(10 * 0.14)
                    .textCase(.uppercase)
                    .foregroundStyle(PWColor.ink60)
                Text(garment.name)
                    .font(PWFont.display(size: 18))
                    .foregroundStyle(PWColor.ink)
                    .lineLimit(2)
                    .minimumScaleFactor(0.9)
                    .multilineTextAlignment(.leading)
            }

            HStack(spacing: 8) {
                // Colour swatch + name
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color(hex: garment.colourHex))
                        .frame(width: 10, height: 10)
                        .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                    Text(garment.colourName)
                        .font(PWFont.body(size: 11))
                        .foregroundStyle(PWColor.ink70)
                }
                Spacer(minLength: 0)
                // Cost-per-wear pill
                HStack(spacing: 4) {
                    Text("$\(String(format: "%.2f", garment.costPerWear))")
                        .font(PWFont.mono(size: 11))
                    Text("/ wear")
                        .font(PWFont.body(size: 10))
                        .foregroundStyle(PWColor.ink40)
                }
                .foregroundStyle(PWColor.ink)
            }
        }
    }
}

#Preview {
    GarmentCard(garment: SampleData.garments[0])
        .padding()
        .background(PWColor.ivory)
}
