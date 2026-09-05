//
//  AppGateView.swift
//  Pocket Wardrobe — shows SignInView while signed out, RootView once a session exists.
//

import SwiftUI

struct AppGateView: View {
    @Environment(AuthStore.self) private var authStore
    @Environment(AccountStore.self) private var accountStore

    var body: some View {
        Group {
            if authStore.isBootstrapping {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(PWColor.ivory)
            } else if authStore.isSignedIn {
                if accountStore.needsLocationSetup {
                    LocationSetupView()
                } else {
                    RootView()
                }
            } else {
                SignInView()
            }
        }
        .task(id: authStore.isSignedIn) {
            if authStore.isSignedIn {
                await accountStore.load()
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
        .environment(SavedOutfitsStore())
        .environment(WearLogStore())
        .environment(AccountStore())
        .environment(NotificationsStore())
}
