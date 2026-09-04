// Stores/WeatherStore.swift
//
// Reads the user's stored suburb (profiles.suburb, set during onboarding —
// see supabase/migrations/028_profiles.sql) directly from Supabase, then
// calls GET /api/mobile/weather with it as the location query. No
// CoreLocation integration needed for this pass since the profile already
// has a location; if a user hasn't set one, this surfaces that rather than
// guessing a location.

import Foundation
import Supabase

private struct WeatherContextRow: Decodable {
    let currentTemperatureC: Double?
    let tempMinC: Double?
    let tempMaxC: Double?
    let precipitationChance: Double?
    let weatherCode: Int?
    let conditionSummary: String?
    let locationLabel: String

    enum CodingKeys: String, CodingKey {
        case currentTemperatureC = "current_temperature_c"
        case tempMinC = "temp_min_c"
        case tempMaxC = "temp_max_c"
        case precipitationChance = "precipitation_chance"
        case weatherCode = "weather_code"
        case conditionSummary = "condition_summary"
        case locationLabel = "location_label"
    }
}

private struct WeatherResponse: Decodable {
    let weatherContext: WeatherContextRow
    enum CodingKeys: String, CodingKey { case weatherContext = "weather_context" }
}

struct LocalWeather {
    let locationLabel: String
    let weather: Outfit.Weather
}

@Observable
@MainActor
final class WeatherStore {
    var weather: LocalWeather?
    var state: LoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            guard let suburb = try await fetchSuburb(), !suburb.isEmpty else {
                state = .error("Add your suburb in account settings to see local weather.")
                return
            }
            let encodedLocation = suburb.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? suburb
            let response: WeatherResponse = try await MobileAPIClient.get("/api/mobile/weather?location=\(encodedLocation)")
            weather = Self.map(response.weatherContext)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    private func fetchSuburb() async throws -> String? {
        struct Row: Decodable { let suburb: String? }
        guard let userId = AppSupabase.shared.auth.currentSession?.user.id else { return nil }
        let rows: [Row] = try await AppSupabase.shared
            .from("profiles")
            .select("suburb")
            .eq("user_id", value: userId.uuidString)
            .execute()
            .value
        return rows.first?.suburb
    }

    private static func map(_ row: WeatherContextRow) -> LocalWeather {
        let celsius = Int((row.currentTemperatureC ?? 0).rounded())
        let low = Int((row.tempMinC ?? row.currentTemperatureC ?? 0).rounded())
        let high = Int((row.tempMaxC ?? row.currentTemperatureC ?? 0).rounded())
        let rain = Int((row.precipitationChance ?? 0).rounded())

        return LocalWeather(
            locationLabel: row.locationLabel,
            weather: Outfit.Weather(
                celsius: celsius,
                summary: row.conditionSummary ?? "",
                low: low,
                high: high,
                rainProbability: rain,
                symbol: symbol(forWMOCode: row.weatherCode)
            )
        )
    }

    /// WMO weather-interpretation codes (used by Open-Meteo, this app's
    /// weather providers) mapped to the closest SF Symbol.
    private static func symbol(forWMOCode code: Int?) -> String {
        guard let code else { return "cloud" }
        switch code {
        case 0:            return "sun.max"
        case 1, 2:         return "cloud.sun"
        case 3:            return "cloud"
        case 45, 48:       return "cloud.fog"
        case 51, 53, 55, 56, 57: return "cloud.drizzle"
        case 61, 63, 65, 66, 67: return "cloud.rain"
        case 71, 73, 75, 77:     return "cloud.snow"
        case 80, 81, 82:   return "cloud.heavyrain"
        case 95, 96, 99:   return "cloud.bolt.rain"
        default:           return "cloud"
        }
    }
}
