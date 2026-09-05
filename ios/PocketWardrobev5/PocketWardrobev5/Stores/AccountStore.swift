// Stores/AccountStore.swift
//
// Reads/writes GET+PATCH /api/mobile/account — the account-level settings
// that live in Supabase auth user_metadata (display_name, preferred_location,
// region, temperature_unit, currency_unit), plus real entitlements plan
// status. Distinct from the `profiles` table (local_name, suburb, sizes),
// which is the local-marketplace identity — a feature this app doesn't
// have a mobile surface for yet, so it stays out of scope here.
//
// preferred_location is the field WeatherStore actually needs: the web app
// resolves weather from user_metadata.preferred_location (lib/domain/
// outfits/page.tsx, lib/domain/trends/service.ts), not from profiles.suburb
// — WeatherStore used to read profiles.suburb directly, which was a real,
// undocumented inconsistency (setting your location on web had zero effect
// on iOS weather and vice versa). WeatherStore now takes this store's value
// instead of querying Supabase itself.

import Foundation

struct AccountProfile: Decodable {
    let email: String?
    let displayName: String?
    let preferredLocation: String?
    let region: String
    let temperatureUnit: String
    let currencyUnit: String

    enum CodingKeys: String, CodingKey {
        case email
        case displayName = "display_name"
        case preferredLocation = "preferred_location"
        case region
        case temperatureUnit = "temperature_unit"
        case currencyUnit = "currency_unit"
    }
}

struct PlanStatus: Decodable {
    let tier: String
    let isPaid: Bool
    let billingLapsed: Bool

    enum CodingKeys: String, CodingKey {
        case tier
        case isPaid = "is_paid"
        case billingLapsed = "billing_lapsed"
    }
}

private struct AccountResponse: Decodable {
    let profile: AccountProfile
    let plan: PlanStatus
}

private struct UpdateAccountRequest: Encodable {
    let display_name: String?
    let preferred_location: String?
    let region: String?
    let temperature_unit: String?
    let currency_unit: String?
}

private struct UpdateAccountResponse: Decodable {
    let profile: AccountProfile
}

@Observable
@MainActor
final class AccountStore {
    var profile: AccountProfile?
    var plan: PlanStatus?
    var state: LoadState = .idle
    var saveError: String?

    /// Once loaded, true when the user hasn't set a weather location yet —
    /// AppGateView uses this to prompt for one before showing the main app,
    /// since nothing else in onboarding collects it.
    var needsLocationSetup: Bool {
        guard case .loaded = state else { return false }
        return profile?.preferredLocation?.isEmpty ?? true
    }

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let response: AccountResponse = try await MobileAPIClient.get("/api/mobile/account")
            profile = response.profile
            plan = response.plan
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    @discardableResult
    func save(
        displayName: String?,
        preferredLocation: String?,
        region: String?,
        temperatureUnit: String?,
        currencyUnit: String?
    ) async -> Bool {
        saveError = nil
        do {
            let body = UpdateAccountRequest(
                display_name: displayName?.isEmpty == true ? nil : displayName,
                preferred_location: preferredLocation?.isEmpty == true ? nil : preferredLocation,
                region: region,
                temperature_unit: temperatureUnit,
                currency_unit: currencyUnit
            )
            let response: UpdateAccountResponse = try await MobileAPIClient.post("/api/mobile/account", body: body)
            profile = response.profile
            return true
        } catch {
            saveError = error.localizedDescription
            return false
        }
    }
}
