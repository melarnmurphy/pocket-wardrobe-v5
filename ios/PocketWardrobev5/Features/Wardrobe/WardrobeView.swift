//
//  WardrobeView.swift
//  Pocket Wardrobe — main wardrobe grid.
//

import SwiftUI

struct WardrobeView: View {
    @State private var selectedFilter: Garment.Category? = nil
    @State private var selectedGarment: Garment? = nil

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private var filteredGarments: [Garment] {
        if let selectedFilter {
            return SampleData.garments.filter { $0.category == selectedFilter }
        }
        return SampleData.garments
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 10) {
                    EyebrowLabel(text: "12 pieces · curated")
                    HStack(alignment: .firstTextBaseline) {
                        Text("Wardrobe.")
                            .display(size: 44)
                        Spacer()
                    }
                    Text("Every piece, how much you've worn it, and whether it earns its space.")
                        .caption(size: 14)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)

                // Filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(
                            label: "All", count: SampleData.garments.count,
                            isActive: selectedFilter == nil
                        ) { selectedFilter = nil }

                        ForEach(Garment.Category.allCases, id: \.self) { cat in
                            let count = SampleData.garments.filter { $0.category == cat }.count
                            if count > 0 {
                                FilterChip(
                                    label: cat.rawValue, count: count,
                                    isActive: selectedFilter == cat
                                ) { selectedFilter = cat }
                            }
                        }
                    }
                    .padding(.horizontal, PWSpacing.pageGutter)
                }
                .padding(.top, 20)
                .padding(.bottom, 8)

                HairlineDivider()
                    .padding(.top, 8)

                // Grid
                LazyVGrid(columns: columns, spacing: 28) {
                    ForEach(filteredGarments) { garment in
                        Button {
                            selectedGarment = garment
                        } label: {
                            GarmentCard(garment: garment)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 28)
                .padding(.bottom, 48)
            }
        }
        .background(PWColor.ivory)
        .sheet(item: $selectedGarment) { garment in
            GarmentDetailSheet(garment: garment)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
    }
}

#Preview {
    WardrobeView()
}
