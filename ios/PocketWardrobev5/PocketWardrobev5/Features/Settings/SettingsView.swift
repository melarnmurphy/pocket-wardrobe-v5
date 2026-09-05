//
//  SettingsView.swift
//  Pocket Wardrobe — account settings: profile, weather location, plan, sign out.
//

import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AccountStore.self) private var accountStore
    @Environment(AuthStore.self) private var authStore

    @State private var displayName: String = ""
    @State private var preferredLocation: String = ""
    @State private var region: String = "AU"
    @State private var temperatureUnit: String = "C"
    @State private var currencyUnit: String = "AUD"
    @State private var isSaving = false
    @State private var didLoadFields = false

    private let regions = ["AU", "NZ"]
    private let temperatureUnits = ["C", "F"]
    private let currencyUnits = ["AUD", "NZD"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {

                    VStack(alignment: .leading, spacing: 8) {
                        EyebrowLabel(text: "Account")
                        Text("Settings.")
                            .font(PWFont.display(size: 28))
                            .foregroundStyle(PWColor.ink)
                    }

                    if case .error(let message) = accountStore.state {
                        Text(message).caption(size: 13, color: PWColor.oxblood)
                    } else if accountStore.state == .loading && accountStore.profile == nil {
                        ProgressView().frame(maxWidth: .infinity).padding(.vertical, 24)
                    } else {
                        content
                    }

                    if let saveError = accountStore.saveError {
                        Text(saveError).caption(size: 13, color: PWColor.oxblood)
                    }

                    VStack(spacing: 10) {
                        PWButton(title: "Save changes", style: .primary) {
                            Task { await save() }
                        }
                        .disabled(isSaving)
                        PWButton(title: "Sign out", style: .outline) {
                            Task { await authStore.signOut() }
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, PWSpacing.pageGutter)
                .padding(.top, 24)
            }
            .background(PWColor.paper)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(PWColor.ink)
                    }
                }
            }
        }
        .task {
            await accountStore.load()
            loadFieldsFromStoreIfNeeded()
        }
        .onChange(of: accountStore.profile?.email) { _, _ in
            loadFieldsFromStoreIfNeeded()
        }
    }

    private func loadFieldsFromStoreIfNeeded() {
        guard !didLoadFields, let profile = accountStore.profile else { return }
        didLoadFields = true
        displayName = profile.displayName ?? ""
        preferredLocation = profile.preferredLocation ?? ""
        region = profile.region
        temperatureUnit = profile.temperatureUnit
        currencyUnit = profile.currencyUnit
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        let saved = await accountStore.save(
            displayName: displayName,
            preferredLocation: preferredLocation,
            region: region,
            temperatureUnit: temperatureUnit,
            currencyUnit: currencyUnit
        )
        if saved { dismiss() }
    }

    @ViewBuilder
    private var content: some View {
        VStack(alignment: .leading, spacing: 10) {
            EyebrowLabel(text: "Email")
            Text(accountStore.profile?.email ?? "—")
                .font(PWFont.body(size: 14))
                .foregroundStyle(PWColor.ink60)
        }

        VStack(alignment: .leading, spacing: 10) {
            EyebrowLabel(text: "Name")
            TextField("Your name", text: $displayName)
                .textFieldStyle(EditorialTextFieldStyle())
        }

        VStack(alignment: .leading, spacing: 10) {
            EyebrowLabel(text: "Weather location")
            TextField("Suburb, city, or postcode", text: $preferredLocation)
                .textFieldStyle(EditorialTextFieldStyle())
            Text("Used for the Planner's local weather and forecast.")
                .font(PWFont.body(size: 12))
                .foregroundStyle(PWColor.ink60)
        }

        HairlineDivider()

        VStack(alignment: .leading, spacing: 14) {
            EyebrowLabel(text: "Preferences")
            settingRow(label: "Region", value: $region, options: regions)
            settingRow(label: "Temperature", value: $temperatureUnit, options: temperatureUnits, labelled: { $0 == "C" ? "Celsius" : "Fahrenheit" })
            settingRow(label: "Currency", value: $currencyUnit, options: currencyUnits)
        }

        HairlineDivider()

        VStack(alignment: .leading, spacing: 10) {
            EyebrowLabel(text: "Plan")
            if let plan = accountStore.plan {
                HStack {
                    Text(plan.tier.capitalized)
                        .font(PWFont.display(size: 18))
                        .foregroundStyle(PWColor.ink)
                    if plan.billingLapsed {
                        TagChip(text: "Billing issue", style: .accent)
                    }
                    Spacer()
                }
                Text(plan.isPaid
                     ? "Manage your subscription from the web account page."
                     : "Free plan. Upgrade from the web account page.")
                    .font(PWFont.body(size: 12))
                    .foregroundStyle(PWColor.ink60)
            }
        }
    }

    private func settingRow(
        label: String,
        value: Binding<String>,
        options: [String],
        labelled: @escaping (String) -> String = { $0 }
    ) -> some View {
        HStack {
            Text(label)
                .font(PWFont.body(size: 14))
                .foregroundStyle(PWColor.ink)
            Spacer()
            Menu {
                ForEach(options, id: \.self) { option in
                    Button(labelled(option)) { value.wrappedValue = option }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(labelled(value.wrappedValue))
                        .font(PWFont.body(size: 13))
                        .foregroundStyle(PWColor.ink70)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(PWColor.ink40)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    SettingsView()
        .environment(AccountStore())
        .environment(AuthStore())
}
