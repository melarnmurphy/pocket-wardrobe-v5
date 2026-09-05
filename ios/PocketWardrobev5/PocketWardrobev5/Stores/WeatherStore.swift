// Stores/WeatherStore.swift
//
// Calls GET /api/mobile/weather with a location string the caller supplies
// (AccountStore.profile.preferredLocation) — this store used to query
// `profiles.suburb` directly, which is a real but different field: the web
// app resolves weather from user_metadata.preferred_location (lib/domain/
// outfits/page.tsx, lib/domain/trends/service.ts), while profiles.suburb is
// the local-marketplace pickup location, unrelated and unsynced. Reading
// profiles.suburb here meant a location set on web had zero effect on iOS
// weather. No CoreLocation integration needed for this pass since the
// account already has a location once AppGateView's LocationSetupView runs;
// if it's somehow still empty, this surfaces that rather than guessing one.

import Foundation

struct WeatherContextRow: Decodable {
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

    /// Per-day forecast for the WeekStrip, keyed by OutfitStore.dateKey(_:).
    /// Real forecast, not invented — /api/mobile/weather already supports a
    /// weather_date lookup (lib/domain/weather/service.ts's forecast_days),
    /// this just calls it once per date instead of once for "now".
    var weekWeather: [String: Outfit.Weather] = [:]

    func loadWeek(dates: [Date], location: String?) async {
        guard let location, !location.isEmpty else { return }
        let encodedLocation = location.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? location

        let result = await withTaskGroup(of: (String, Outfit.Weather?).self) { group -> [String: Outfit.Weather] in
            for date in dates {
                let key = OutfitStore.dateKey(date)
                group.addTask { @MainActor in
                    do {
                        let response: WeatherResponse = try await MobileAPIClient.get(
                            "/api/mobile/weather?location=\(encodedLocation)&weather_date=\(key)"
                        )
                        return (key, Self.map(response.weatherContext).weather)
                    } catch {
                        return (key, nil)
                    }
                }
            }
            var merged: [String: Outfit.Weather] = [:]
            for await (key, weather) in group {
                if let weather { merged[key] = weather }
            }
            return merged
        }
        weekWeather = result
    }

    func load(location: String?) async {
        guard state != .loading else { return }
        state = .loading
        guard let location, !location.isEmpty else {
            state = .error("Add your location in Settings to see local weather.")
            return
        }
        do {
            let encodedLocation = location.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? location
            let response: WeatherResponse = try await MobileAPIClient.get("/api/mobile/weather?location=\(encodedLocation)")
            weather = Self.map(response.weatherContext)
            state = .loaded
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    static func map(_ row: WeatherContextRow) -> LocalWeather {
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
    static func symbol(forWMOCode code: Int?) -> String {
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
