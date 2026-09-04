//
//  AppGateView.swift
//  Pocket Wardrobe — shows SignInView while signed out, RootView once a session exists.
//

import SwiftUI

struct AppGateView: View {
    @Environment(AuthStore.self) private var authStore

    var body: some View {
        Group {
            if authStore.isBootstrapping {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(PWColor.ivory)
            } else if authStore.isSignedIn {
                RootView()
            } else {
                SignInView()
            }
        }
    }
}

#Preview {
    AppGateView()
        .environment(AuthStore())
        .environment(GarmentStore())
        .environment(RulesStore())
        .environment(TrendStore())
        .environment(OutfitStore())
        .environment(WeatherStore())
        .environment(LookbookStore())
}
