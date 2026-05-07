//
//  PocketWardrobeApp.swift
//  Pocket Wardrobe — app entry point.
//

import SwiftUI

@main
struct PocketWardrobeApp: App {
    init() {
        // Ivory tab bar, hairline line, ink-tinted selection — match the editorial palette.
        styleTabBar()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(PWColor.ink)
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
