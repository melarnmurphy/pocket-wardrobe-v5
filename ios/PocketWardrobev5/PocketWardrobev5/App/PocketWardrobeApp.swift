//
//  PocketWardrobeApp.swift
//  Pocket Wardrobe — app entry point.
//

import SwiftUI
import SwiftData

@main
struct PocketWardrobeApp: App {
    @State private var authStore = AuthStore()
    @State private var garmentStore = GarmentStore()
    @State private var rulesStore = RulesStore()
    @State private var trendStore = TrendStore()
    @State private var outfitStore = OutfitStore()

    let modelContainer: ModelContainer = {
        let schema = Schema([CDGarment.self, CDOutfit.self, CDTrendSignal.self])
        do {
            return try ModelContainer(for: schema)
        } catch {
            fatalError("Could not create SwiftData ModelContainer: \(error)")
        }
    }()

    init() {
        // Ivory tab bar, hairline line, ink-tinted selection — match the editorial palette.
        styleTabBar()
    }

    var body: some Scene {
        WindowGroup {
            AppGateView()
                .environment(authStore)
                .environment(garmentStore)
                .environment(rulesStore)
                .environment(trendStore)
                .environment(outfitStore)
                .modelContainer(modelContainer)
                .tint(PWColor.ink)
                .task {
                    garmentStore.setContext(modelContainer.mainContext)
                }
        }
    }

    private func styleTabBar() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(PWColor.paper)
        appearance.shadowColor = UIColor(PWColor.line)

        // Unselected
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(PWColor.ink40)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(PWColor.ink40),
            .font: UIFont.systemFont(ofSize: 10, weight: .medium),
            .kern: 1.0
        ]

        // Selected
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(PWColor.ink)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(PWColor.ink),
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold),
            .kern: 1.0
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}
