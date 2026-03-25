"use client";

import { useState } from "react";
import { showAppToast } from "@/lib/ui/app-toast";
import { weatherProfiles, type WeatherProfile } from "@/lib/domain/style-rules/knowledge/weather";
import type { PlanTier } from "@/lib/domain/entitlements";
import type { LocalWeatherContext } from "@/lib/domain/weather";

const weatherProfileLabels: Record<WeatherProfile, string> = {
  warm_sun: "Warm sun",
  mild_clear: "Mild clear",
  cool_breeze: "Cool breeze",
  cold_rain: "Cold rain"
};

export function OutfitPlanner({
  garmentCount,
  planTier,
  defaultWeatherProvider
}: {
  garmentCount: number;
  planTier: PlanTier;
  defaultWeatherProvider: "weatherapi" | "open-meteo";
}) {
  const [occasion, setOccasion] = useState("");
  const [dressCode, setDressCode] = useState("any");
  const [weatherMode, setWeatherMode] = useState<"manual" | "auto">("manual");
  const [manualWeatherProfile, setManualWeatherProfile] = useState<WeatherProfile>("mild_clear");
  const [locationQuery, setLocationQuery] = useState("");
  const [weatherContext, setWeatherContext] = useState<LocalWeatherContext | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const effectiveWeatherProfile = weatherMode === "auto" && weatherContext
    ? weatherContext.profile
    : manualWeatherProfile;

  async function loadWeatherFromQuery(params: URLSearchParams) {
    setIsLoadingWeather(true);

    try {
      const response = await fetch(`/api/weather/local?${params.toString()}`, {
        method: "GET"
      });
      const payload = (await response.json()) as {
        error?: string;
        weather_context?: LocalWeatherContext;
      };

      if (!response.ok || !payload.weather_context) {
        throw new Error(payload.error ?? "Unable to load local weather.");
      }

      setWeatherContext(payload.weather_context);
      setWeatherMode("auto");
      showAppToast({
        tone: "success",
        message: `Loaded ${payload.weather_context.profile_label.toLowerCase()} for ${payload.weather_context.location_label}.`
      });
    } catch (error) {
      showAppToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to load local weather."
      });
    } finally {
      setIsLoadingWeather(false);
    }
  }

  function handleLocationLookup() {
    if (!locationQuery.trim()) {
      showAppToast({ tone: "error", message: "Enter a city or suburb to load local weather." });
      return;
    }

    const params = new URLSearchParams({
      location: locationQuery.trim(),
      provider: defaultWeatherProvider
    });
    void loadWeatherFromQuery(params);
  }

  function handleCurrentLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      showAppToast({
        tone: "error",
        message: "Geolocation is not available in this browser."
      });
      return;
    }

    setIsLoadingWeather(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams({
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
          provider: defaultWeatherProvider
        });
        void loadWeatherFromQuery(params);
      },
      (error) => {
        setIsLoadingWeather(false);
        showAppToast({
          tone: "error",
          message: error.message || "Unable to access your current location."
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  return (
    <div className="space-y-8">
      <section className="pw-panel overflow-hidden p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="pw-kicker">Outfit Planning</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">
              Build the planning context before the generator selects garments.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Automatic local weather can be loaded into the planning flow, while manual weather
              remains available so the outfit engine still works when live data is unavailable or
              when you want to override it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="pw-chip normal-case tracking-normal">{garmentCount} wardrobe items</span>
            <span className="pw-chip normal-case tracking-normal">
              {planTier === "free" ? "Free plan" : `${planTier} plan`}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="pw-panel p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                Occasion
              </span>
              <input
                value={occasion}
                onChange={(event) => setOccasion(event.target.value)}
                placeholder="Client lunch, travel day, gallery opening"
                className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                Dress Code
              </span>
              <select
                value={dressCode}
                onChange={(event) => setDressCode(event.target.value)}
                className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="any">Any</option>
                <option value="casual">Casual</option>
                <option value="smart_casual">Smart casual</option>
                <option value="business_casual">Business casual</option>
                <option value="formal">Formal</option>
                <option value="black_tie">Black tie</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-[var(--line)] bg-[rgba(255,251,246,0.9)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Weather Source
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Choose a manual weather profile or load live local weather from the active provider.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setWeatherMode("manual")}
                  className={`rounded-full px-4 py-2 text-sm ${weatherMode === "manual" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted)]"}`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setWeatherMode("auto")}
                  className={`rounded-full px-4 py-2 text-sm ${weatherMode === "auto" ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "text-[var(--muted)]"}`}
                >
                  Auto local weather
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Manual Weather
                </span>
                <select
                  value={manualWeatherProfile}
                  onChange={(event) => setManualWeatherProfile(event.target.value as WeatherProfile)}
                  className="w-full rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                >
                  {weatherProfiles.map((profile) => (
                    <option key={profile} value={profile}>
                      {weatherProfileLabels[profile]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[1.2rem] border border-[rgba(23,20,17,0.08)] bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    value={locationQuery}
                    onChange={(event) => setLocationQuery(event.target.value)}
                    placeholder="Enter city or suburb"
                    disabled={isLoadingWeather}
                    className="flex-1 rounded-[1rem] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleLocationLookup}
                    disabled={isLoadingWeather}
                    className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingWeather ? "Loading..." : "Lookup weather"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCurrentLocation}
                    disabled={isLoadingWeather}
                    className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Use current location
                  </button>
                </div>
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {defaultWeatherProvider === "weatherapi"
                    ? "WeatherAPI is the default provider for automatic weather on the free plan when a key is configured. You can still switch back to a manual profile at any time."
                    : "Open-Meteo is currently active as the fallback provider. You can still switch back to a manual profile at any time."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="pw-panel p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              Active Weather Context
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
              {weatherProfileLabels[effectiveWeatherProfile]}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {weatherMode === "auto" && weatherContext
                ? `Live weather from ${weatherContext.location_label} via ${weatherContext.provider}`
                : "Manual weather profile selected"}
            </p>

            {weatherContext && weatherMode === "auto" ? (
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Current" value={formatTemperature(weatherContext.current_temperature_c)} />
                <Metric label="Range" value={`${formatTemperature(weatherContext.temp_min_c)} to ${formatTemperature(weatherContext.temp_max_c)}`} />
                <Metric label="Rain chance" value={weatherContext.precipitation_chance !== null ? `${Math.round(weatherContext.precipitation_chance)}%` : "Unknown"} />
                <Metric label="Conditions" value={weatherContext.condition_summary ?? "Unknown"} />
              </dl>
            ) : (
              <p className="mt-5 rounded-[1rem] bg-[rgba(23,20,17,0.04)] px-4 py-3 text-sm text-[var(--muted)]">
                The selected manual profile will be stored into `weather_context_json` for future outfit generation.
              </p>
            )}
          </div>

          <div className="pw-panel p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
              Generator Payload Preview
            </p>
            <pre className="mt-4 overflow-x-auto rounded-[1rem] bg-[rgba(23,20,17,0.94)] p-4 text-xs leading-6 text-[#f8f1e8]">
{JSON.stringify(
  {
    occasion: occasion || null,
    dress_code: dressCode === "any" ? null : dressCode,
    weather_context_json:
      weatherMode === "auto" && weatherContext
        ? weatherContext
        : {
            profile: manualWeatherProfile,
            profile_label: weatherProfileLabels[manualWeatherProfile],
            profile_source: "manual_override"
          }
  },
  null,
  2
)}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-[rgba(23,20,17,0.04)] px-4 py-3">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function formatTemperature(value: number | null) {
  return value === null ? "Unknown" : `${Math.round(value)}C`;
}
