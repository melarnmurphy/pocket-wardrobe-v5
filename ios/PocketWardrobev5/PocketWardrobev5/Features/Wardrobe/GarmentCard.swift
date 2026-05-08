//
//  GarmentCard.swift
//  Pocket Wardrobe — editorial card for a single garment.
//

import SwiftUI

struct GarmentCard: View {
    let garment: Garment

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {

            // Category eyebrow
            EyebrowLabel(text: garment.category.rawValue)

            // Image — 4/5 aspect box, image fills + clips
            Color.clear
                .aspectRatio(4.0/5.0, contentMode: .fit)
                .overlay(
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
                )
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: PWRadius.sm))
                .overlay(
                    RoundedRectangle(cornerRadius: PWRadius.sm)
                        .stroke(PWColor.line, lineWidth: 1)
                )

            // Brand · subcategory + name
            VStack(alignment: .leading, spacing: 2) {
                if let brand = garment.brand {
                    Text("\(brand) · \(garment.category.rawValue.lowercased())")
                        .font(PWFont.body(size: 10, weight: .medium))
                        .tracking(10 * 0.14)
                        .textCase(.uppercase)
                        .foregroundStyle(PWColor.ink60)
                } else {
                    Text(garment.category.rawValue.lowercased())
                        .font(PWFont.body(size: 10, weight: .medium))
                        .tracking(10 * 0.14)
                        .textCase(.uppercase)
                        .foregroundStyle(PWColor.ink60)
                }
                Text(garment.name)
                    .font(PWFont.display(size: 18))
                    .foregroundStyle(PWColor.ink)
                    .lineLimit(2, reservesSpace: true)
                    .minimumScaleFactor(0.9)
                    .multilineTextAlignment(.leading)
            }

            // Colour swatch
            HStack(spacing: 6) {
                Circle()
                    .fill(Color(hex: garment.colourHex))
                    .frame(width: 10, height: 10)
                    .overlay(Circle().stroke(PWColor.line, lineWidth: 1))
                Text(garment.colourName)
                    .font(PWFont.body(size: 11))
                    .foregroundStyle(PWColor.ink70)
            }

            // Pill row: cost-per-wear · wears count · favourite
            HStack(spacing: 6) {
                TagChip(
                    text: "AUD \(String(format: "%.2f", garment.costPerWear))/wear",
                    style: .solid
                )
                TagChip(
                    text: "\(garment.timesWorn) wears",
                    style: .plain
                )
                if garment.isFavourite {
                    TagChip(text: "Favourite", style: .plain)
                }
            }
        }
    }
}

#Preview {
    GarmentCard(garment: SampleData.garments[0])
        .padding()
        .background(PWColor.ivory)
}
