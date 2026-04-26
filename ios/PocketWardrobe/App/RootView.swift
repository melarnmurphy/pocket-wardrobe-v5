//
//  RootView.swift
//  Pocket Wardrobe — top-level TabView. Mirrors the 5-item nav on the web.
//

import SwiftUI

struct RootView: View {
    @State private var tab: Tab = .wardrobe

    enum Tab: Hashable { case wardrobe, lookbook, trends, planner, rules }

    var body: some View {
        TabView(selection: $tab) {

            WardrobeView()
                .tabItem {
                    Label("Wardrobe", systemImage: "square.grid.2x2")
                }
                .tag(Tab.wardrobe)

            LookbookView()
                .tabItem {
                    Label("Lookbook", systemImage: "photo.on.rectangle.angled")
                }
                .tag(Tab.lookbook)

            TrendsView()
                .tabItem {
                    Label("Trends", systemImage: "chart.line.uptrend.xyaxis")
                }
                .tag(Tab.trends)

            PlannerContainerView()
                .tabItem {
                    Label("Planner", systemImage: "calendar")
                }
                .tag(Tab.planner)

            RulesView()
                .tabItem {
                    Label("Rules", systemImage: "text.book.closed")
                }
                .tag(Tab.rules)
        }
    }
}

#Preview {
    RootView()
}
