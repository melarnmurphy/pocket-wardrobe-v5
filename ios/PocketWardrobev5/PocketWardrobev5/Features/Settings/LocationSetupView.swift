//
//  LocationSetupView.swift
//  Pocket Wardrobe — one-time prompt for a weather location, shown after
//  sign-in when the account has none set yet (nothing else in this app's
//  sign-up flow collects it, and Planner weather has nowhere else to
//  resolve a location from).
//

import SwiftUI

struct LocationSetupView: View {
    @Environment(AccountStore.self) private var accountStore

    @State private var location: String = ""
    @State private var isSaving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Spacer()

            VStack(alignment: .leading, spacing: 10) {
                EyebrowLabel(text: "One quick thing")
                Text("Where are you?")
                    .font(PWFont.display(size: 32))
                    .foregroundStyle(PWColor.ink)
                Text("So the Planner can show real local weather.")
                    .font(PWFont.body(size: 14))
                    .foregroundStyle(PWColor.ink60)
            }

            TextField("Suburb, city, or postcode", text: $location)
                .textFieldStyle(EditorialTextFieldStyle())
                .textInputAutocapitalization(.words)

            if let error = accountStore.saveError {
                Text(error).font(PWFont.body(size: 12)).foregroundStyle(PWColor.oxblood)
            }

            PWButton(title: "Continue", style: .primary) {
                Task { await save() }
            }
            .disabled(location.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)

            Spacer()
            Spacer()
        }
        .padding(.horizontal, PWSpacing.pageGutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PWColor.ivory)
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        await accountStore.save(
            displayName: accountStore.profile?.displayName,
            preferredLocation: location,
            region: accountStore.profile?.region,
            temperatureUnit: accountStore.profile?.temperatureUnit,
            currencyUnit: accountStore.profile?.currencyUnit
        )
    }
}

#Preview {
    LocationSetupView()
        .environment(AccountStore())
}
