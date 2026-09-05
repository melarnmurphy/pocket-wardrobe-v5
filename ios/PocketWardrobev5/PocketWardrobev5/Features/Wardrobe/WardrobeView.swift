//
//  WardrobeView.swift
//  Pocket Wardrobe — main wardrobe grid.
//

import SwiftUI

struct WardrobeView: View {
    @Environment(GarmentStore.self) private var garmentStore
    @Environment(NotificationsStore.self) private var notificationsStore

    @State private var selectedFilter: Garment.Category? = nil
    @State private var selectedGarment: Garment? = nil
    @State private var showingCapture = false
    @State private var showingSettings = false
    @State private var showingNotifications = false

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    private var garments: [Garment] { garmentStore.garments }

    private var filteredGarments: [Garment] {
        if let selectedFilter {
            return garments.filter { $0.category == selectedFilter }
        }
        return garments
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Head
                VStack(alignment: .leading, spacing: 10) {
                    EyebrowLabel(text: "\(garments.count) piece\(garments.count == 1 ? "" : "s") · curated")
                    HStack(alignment: .firstTextBaseline) {
                        Text("Wardrobe.")
                            .display(size: 44)
                        Spacer()
                        Button {
                            showingSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                                .font(.system(size: 22))
                                .foregroundStyle(PWColor.ink70)
                        }
                        Button {
                            showingNotifications = true
                        } label: {
                            Image(systemName: notificationsStore.unreadCount > 0 ? "bell.badge.fill" : "bell")
                                .font(.system(size: 20))
                                .foregroundStyle(PWColor.ink70)
                                .overlay(alignment: .topTrailing) {
                                    if notificationsStore.unreadCount > 0 {
                                        Circle()
                                            .fill(PWColor.oxblood)
                                            .frame(width: 8, height: 8)
                                            .offset(x: 3, y: -2)
                                    }
                                }
                        }
                        Button {
                            showingCapture = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(PWColor.ink)
                        }
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
                            label: "All", count: garments.count,
                            isActive: selectedFilter == nil
                        ) { selectedFilter = nil }

                        ForEach(Garment.Category.allCases, id: \.self) { cat in
                            let count = garments.filter { $0.category == cat }.count
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

                if case .error(let message) = garmentStore.state {
                    Text(message)
                        .caption(size: 13, color: PWColor.oxblood)
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 24)
                } else if garmentStore.state == .loading && garments.isEmpty {
                    ProgressView()
                        .padding(.top, 64)
                        .frame(maxWidth: .infinity)
                } else if garments.isEmpty {
                    Text("No pieces yet. Add your first garment to get started.")
                        .caption(size: 14)
                        .padding(.horizontal, PWSpacing.pageGutter)
                        .padding(.top, 24)
                } else {
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
        }
        .background(PWColor.ivory)
        .task {
            await garmentStore.load()
        }
        .refreshable {
            await garmentStore.load()
        }
        .sheet(item: $selectedGarment) { garment in
            GarmentDetailSheet(garment: garment)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showingCapture) {
            CaptureView()
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView()
        }
        .sheet(isPresented: $showingNotifications) {
            NotificationsView()
        }
    }
}

#Preview {
    WardrobeView()
        .environment(GarmentStore())
        .environment(NotificationsStore())
}
