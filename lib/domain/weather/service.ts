import type { Tables, TablesInsert } from "@/types/database";
import { getServerEnv } from "@/lib/env";
import { weatherProfiles } from "@/lib/domain/style-rules/knowledge/weather";
import {
  localWeatherBatchLookupSchema,
  localWeatherContextSchema,
  localWeatherLookupSchema,
  type LocalWeatherBatchLookupInput,
  type LocalWeatherContext,
  type LocalWeatherLookupInput,
  type WeatherProvider,
  type WeatherProfile
} from "@/lib/domain/weather";

const GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHERAPI_BASE_URL = "https://api.weatherapi.com/v1";

// Forecast data moves slowly, so cache provider responses in Next's Data Cache
// rather than hitting the upstream API on every request. A planner view fans out
// one request per day; without this each was a fresh ~2s round-trip on every load.
const WEATHER_FORECAST_REVALIDATE_SECONDS = 30 * 60;
// A location's coordinates never change, so geocoding can be cached aggressively.
const WEATHER_GEOCODE_REVALIDATE_SECONDS = 24 * 60 * 60;

const openMeteoGeocodingSchema = {
  parse(payload: unknown) {
    const data = payload as {
      results?: Array<{
        name?: string;
        country?: string;
        admin1?: string;
        latitude?: number;
        longitude?: number;
        timezone?: string;
      }>;
    };

    return {
      results: Array.isArray(data.results) ? data.results : []
    };
  }
};

const openMeteoForecastSchema = {
  parse(payload: unknown) {
    const data = payload as {
      timezone?: string;
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        weather_code?: number[];
      };
    };

    return {
      timezone: typeof data.timezone === "string" ? data.timezone : "auto",
      current: data.current ?? {},
      daily: data.daily ?? {}
    };
  }
};

type FetchLike = typeof fetch;
export type WeatherSnapshotClient = {
  from: (table: "weather_snapshots") => {
    select: (
      columns: string
    ) => {
      eq: (
        column: "user_id",
        value: string
      ) => {
        eq: (
          column: "location_key",
          value: string
        ) => {
          eq: (
            column: "weather_date",
            value: string
          ) => {
            maybeSingle: () => PromiseLike<{
              data: Tables<"weather_snapshots"> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
    upsert: (
      values: TablesInsert<"weather_snapshots">,
      options: { onConflict: string }
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

type ResolvedLocation = {
  locationLabel: string;
  locationKey: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type DailyForecast = {
  weatherDate: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipitationChance: number | null;
  weatherCode: number | null;
  conditionSummary: string | null;
};

type ProviderForecast = {
  location: ResolvedLocation;
  currentTemperatureC: number | null;
  apparentTemperatureC: number | null;
  windSpeedKph: number | null;
  daysByDate: Map<string, DailyForecast>;
};

function buildLiveWeatherContext(args: {
  location: ResolvedLocation;
  weatherDate: string;
  currentTemperatureC: number | null;
  apparentTemperatureC: number | null;
  windSpeedKph: number | null;
  day: DailyForecast;
  provider: WeatherProvider;
  profileOverride?: WeatherProfile;
}): LocalWeatherContext {
  const liveProfile = normalizeWeatherProfile({
    currentTemperatureC: args.currentTemperatureC,
    apparentTemperatureC: args.apparentTemperatureC,
    tempMinC: args.day.tempMinC,
    tempMaxC: args.day.tempMaxC,
    precipitationChance: args.day.precipitationChance,
    windSpeedKph: args.windSpeedKph,
    weatherCode: args.day.weatherCode
  });
  const profile = args.profileOverride ?? liveProfile;

  return localWeatherContextSchema.parse({
    profile,
    profile_label: weatherProfileLabel(profile),
    profile_source: args.profileOverride ? "manual_override" : "live",
    location_label: args.location.locationLabel,
    location_key: args.location.locationKey,
    latitude: args.location.latitude,
    longitude: args.location.longitude,
    timezone: args.location.timezone,
    weather_date: args.weatherDate,
    current_temperature_c: args.currentTemperatureC,
    apparent_temperature_c: args.apparentTemperatureC,
    temp_min_c: args.day.tempMinC,
    temp_max_c: args.day.tempMaxC,
    precipitation_chance: args.day.precipitationChance,
    wind_speed_kph: args.windSpeedKph,
    weather_code: args.day.weatherCode,
    condition_summary: args.day.conditionSummary,
    provider: args.provider
  });
}

export async function getLocalWeather(
  input: LocalWeatherLookupInput,
  options?: {
    fetchImpl?: FetchLike;
    supabase?: WeatherSnapshotClient;
    userId?: string | null;
    provider?: WeatherProvider;
  }
): Promise<LocalWeatherContext> {
  const values = localWeatherLookupSchema.parse(input);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const provider = resolveWeatherProvider(values.provider ?? options?.provider);

  if (values.weatherDate && isPastDate(values.weatherDate)) {
    const location = await resolveLocation(values, fetchImpl);

    if (options?.supabase && options.userId) {
      const snapshot = await getCachedWeatherSnapshot(
        options.supabase,
        options.userId,
        location.locationKey,
        values.weatherDate
      );

      if (snapshot) {
        return buildSnapshotWeatherContext({
          snapshot,
          location,
          provider
        });
      }
    }

    return buildHistoricalFallbackWeatherContext({
      location,
      weatherDate: values.weatherDate,
      provider
    });
  }

  const resolved = await fetchWeatherFromProvider(provider, values, fetchImpl);
  const context = buildLiveWeatherContext({
    location: resolved.location,
    weatherDate: resolved.weatherDate,
    currentTemperatureC: resolved.currentTemperatureC,
    apparentTemperatureC: resolved.apparentTemperatureC,
    windSpeedKph: resolved.windSpeedKph,
    day: {
      weatherDate: resolved.weatherDate,
      tempMinC: resolved.tempMinC,
      tempMaxC: resolved.tempMaxC,
      precipitationChance: resolved.precipitationChance,
      weatherCode: resolved.weatherCode,
      conditionSummary: resolved.conditionSummary
    },
    provider,
    profileOverride: values.profileOverride
  });

  if (options?.supabase && options.userId) {
    await upsertWeatherSnapshot(options.supabase, options.userId, context);
  }

  return context;
}

export async function getLocalWeatherForDates(
  input: LocalWeatherBatchLookupInput,
  options?: {
    fetchImpl?: FetchLike;
    supabase?: WeatherSnapshotClient;
    userId?: string | null;
    provider?: WeatherProvider;
  }
): Promise<Record<string, LocalWeatherContext>> {
  const values = localWeatherBatchLookupSchema.parse(input);
  const fetchImpl = options?.fetchImpl ?? fetch;
  const provider = resolveWeatherProvider(values.provider ?? options?.provider);

  const pastDates = values.dates.filter((date) => isPastDate(date));
  const futureDates = values.dates.filter((date) => !isPastDate(date));

  const result: Record<string, LocalWeatherContext> = {};

  // Past dates: snapshot or seasonal fallback, no forecast call.
  const pastLocation = pastDates.length
    ? await resolveLocation(
        {
          location: values.location,
          latitude: values.latitude,
          longitude: values.longitude,
          provider: values.provider
        },
        fetchImpl
      )
    : null;

  for (const date of pastDates) {
    const location = pastLocation!;

    let context: LocalWeatherContext | null = null;
    if (options?.supabase && options.userId) {
      const snapshot = await getCachedWeatherSnapshot(
        options.supabase,
        options.userId,
        location.locationKey,
        date
      );
      if (snapshot) {
        context = buildSnapshotWeatherContext({ snapshot, location, provider });
      }
    }

    result[date] =
      context ??
      buildHistoricalFallbackWeatherContext({ location, weatherDate: date, provider });
  }

  if (!futureDates.length) {
    return result;
  }

  // Future dates: one forecast call covering the furthest requested day.
  const furthestDate = futureDates.reduce(
    (max, date) => (date > max ? date : max),
    futureDates[0]
  );
  const forecast = await fetchAllForecast(
    provider,
    {
      location: values.location,
      latitude: values.latitude,
      longitude: values.longitude,
      weatherDate: furthestDate,
      provider: values.provider,
      profileOverride: values.profileOverride
    },
    fetchImpl
  );

  for (const date of futureDates) {
    const day = forecast.daysByDate.get(date);
    if (day) {
      result[date] = buildLiveWeatherContext({
        location: forecast.location,
        weatherDate: date,
        currentTemperatureC: forecast.currentTemperatureC,
        apparentTemperatureC: forecast.apparentTemperatureC,
        windSpeedKph: forecast.windSpeedKph,
        day,
        provider,
        profileOverride: values.profileOverride
      });
    } else {
      result[date] = buildHistoricalFallbackWeatherContext({
        location: forecast.location,
        weatherDate: date,
        provider
      });
    }

    if (options?.supabase && options.userId && result[date].profile_source === "live") {
      await upsertWeatherSnapshot(options.supabase, options.userId, result[date]);
    }
  }

  return result;
}

export function resolveWeatherProvider(preferred?: WeatherProvider): WeatherProvider {
  if (preferred) {
    return preferred;
  }

  const env = getServerEnv();

  if (env.WEATHER_PROVIDER_DEFAULT) {
    return env.WEATHER_PROVIDER_DEFAULT;
  }

  if (env.WEATHERAPI_KEY) {
    return "weatherapi";
  }

  return "open-meteo";
}

export function normalizeWeatherProfile(input: {
  currentTemperatureC: number | null;
  apparentTemperatureC: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipitationChance: number | null;
  windSpeedKph: number | null;
  weatherCode: number | null;
}): WeatherProfile {
  const effectiveTemperature =
    input.apparentTemperatureC ?? input.currentTemperatureC ?? input.tempMaxC ?? input.tempMinC;
  const precipitationChance = input.precipitationChance ?? 0;
  const windSpeedKph = input.windSpeedKph ?? 0;

  if (isWetWeatherCode(input.weatherCode) || precipitationChance >= 45) {
    return "cold_rain";
  }

  if (effectiveTemperature !== null && effectiveTemperature >= 24) {
    return "warm_sun";
  }

  if (
    (effectiveTemperature !== null && effectiveTemperature <= 16) ||
    windSpeedKph >= 24
  ) {
    return "cool_breeze";
  }

  return "mild_clear";
}

export function weatherProfileLabel(profile: WeatherProfile) {
  switch (profile) {
    case "warm_sun":
      return "Warm sun";
    case "mild_clear":
      return "Mild clear";
    case "cool_breeze":
      return "Cool breeze";
    case "cold_rain":
      return "Cold rain";
  }
}

export function describeWeatherCode(code: number | null): string | null {
  if (code === null || Number.isNaN(code)) {
    return null;
  }

  const descriptions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
  };

  return descriptions[code] ?? "Unspecified conditions";
}

export function buildLocationKey(latitude: number, longitude: number) {
  return `geo:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

async function resolveLocation(
  input: LocalWeatherLookupInput,
  fetchImpl: FetchLike
): Promise<ResolvedLocation> {
  if (typeof input.latitude === "number" && typeof input.longitude === "number") {
    return {
      locationLabel: input.location?.trim() || formatCoordinateLabel(input.latitude, input.longitude),
      locationKey: buildLocationKey(input.latitude, input.longitude),
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: "auto"
    };
  }

  const url = new URL(GEOCODING_API_URL);
  url.searchParams.set("name", input.location as string);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetchImpl(url, {
    next: { revalidate: WEATHER_GEOCODE_REVALIDATE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`Weather geocoding failed: ${response.status} ${response.statusText}`);
  }

  const payload = openMeteoGeocodingSchema.parse(await response.json());
  const match = payload.results[0];

  if (!match) {
    throw new Error("No weather location match found.");
  }

  const latitude = Number(match.latitude);
  const longitude = Number(match.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Weather geocoding returned invalid coordinates.");
  }

  const locationLabel = [match.name, match.admin1, match.country]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");

  return {
    locationLabel,
    locationKey: buildLocationKey(latitude, longitude),
    latitude,
    longitude,
    timezone: typeof match.timezone === "string" && match.timezone.trim().length > 0
      ? match.timezone
      : "auto"
  };
}

async function fetchWeatherFromProvider(
  provider: WeatherProvider,
  input: LocalWeatherLookupInput,
  fetchImpl: FetchLike
) {
  const forecast = await fetchAllForecast(provider, input, fetchImpl);
  const targetDate = selectForecastDate(forecast, input.weatherDate);
  const day =
    (targetDate ? forecast.daysByDate.get(targetDate) : undefined) ?? {
      weatherDate: input.weatherDate ?? new Date().toISOString().slice(0, 10),
      tempMinC: null,
      tempMaxC: null,
      precipitationChance: null,
      weatherCode: null,
      conditionSummary: null
    };

  return {
    location: forecast.location,
    weatherDate: day.weatherDate,
    currentTemperatureC: forecast.currentTemperatureC,
    apparentTemperatureC: forecast.apparentTemperatureC,
    tempMinC: day.tempMinC,
    tempMaxC: day.tempMaxC,
    precipitationChance: day.precipitationChance,
    windSpeedKph: forecast.windSpeedKph,
    weatherCode: day.weatherCode,
    conditionSummary: day.conditionSummary
  };
}

async function fetchAllForecast(
  provider: WeatherProvider,
  input: LocalWeatherLookupInput,
  fetchImpl: FetchLike
): Promise<ProviderForecast> {
  if (provider === "weatherapi") {
    return fetchWeatherApiForecastAll(input, fetchImpl);
  }

  const location = await resolveLocation(input, fetchImpl);
  return fetchOpenMeteoForecastAll(location, input, fetchImpl);
}

async function fetchOpenMeteoForecastAll(
  location: ResolvedLocation,
  input: LocalWeatherLookupInput,
  fetchImpl: FetchLike
): Promise<ProviderForecast> {
  const url = new URL(FORECAST_API_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", location.timezone);
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  );
  url.searchParams.set("forecast_days", String(resolveForecastDays(input.weatherDate)));

  const response = await fetchImpl(url, {
    next: { revalidate: WEATHER_FORECAST_REVALIDATE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`Weather forecast failed: ${response.status} ${response.statusText}`);
  }

  const payload = openMeteoForecastSchema.parse(await response.json());
  const currentCode = firstInteger(payload.current.weather_code);
  const times = Array.isArray(payload.daily.time) ? payload.daily.time : [];
  const daysByDate = new Map<string, DailyForecast>();

  times.forEach((date, index) => {
    if (typeof date !== "string") {
      return;
    }
    const weatherCode = selectIntegerAtIndex(payload.daily.weather_code, index) ?? currentCode;
    daysByDate.set(date, {
      weatherDate: date,
      tempMinC: selectNumberAtIndex(payload.daily.temperature_2m_min, index),
      tempMaxC: selectNumberAtIndex(payload.daily.temperature_2m_max, index),
      precipitationChance: selectNumberAtIndex(payload.daily.precipitation_probability_max, index),
      weatherCode,
      conditionSummary: describeWeatherCode(weatherCode)
    });
  });

  return {
    location,
    currentTemperatureC: coerceNumber(payload.current.temperature_2m),
    apparentTemperatureC: coerceNumber(payload.current.apparent_temperature),
    windSpeedKph: coerceNumber(payload.current.wind_speed_10m),
    daysByDate
  };
}

async function fetchWeatherApiForecastAll(
  input: LocalWeatherLookupInput,
  fetchImpl: FetchLike
): Promise<ProviderForecast> {
  const env = getServerEnv();

  if (!env.WEATHERAPI_KEY) {
    throw new Error("WEATHERAPI_KEY is not configured.");
  }

  const query =
    typeof input.latitude === "number" && typeof input.longitude === "number"
      ? `${input.latitude},${input.longitude}`
      : input.location;

  if (!query) {
    throw new Error("WeatherAPI requires a location query.");
  }

  const url = new URL(`${WEATHERAPI_BASE_URL}/forecast.json`);
  url.searchParams.set("key", env.WEATHERAPI_KEY);
  url.searchParams.set("q", query);
  url.searchParams.set("days", String(resolveForecastDays(input.weatherDate)));
  url.searchParams.set("aqi", "no");
  url.searchParams.set("alerts", "no");

  const response = await fetchImpl(url, {
    next: { revalidate: WEATHER_FORECAST_REVALIDATE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`WeatherAPI forecast failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    location?: {
      name?: string;
      region?: string;
      country?: string;
      lat?: number;
      lon?: number;
      tz_id?: string;
    };
    current?: {
      temp_c?: number;
      feelslike_c?: number;
      wind_kph?: number;
      condition?: { text?: string; code?: number };
    };
    forecast?: {
      forecastday?: Array<{
        date?: string;
        day?: {
          maxtemp_c?: number;
          mintemp_c?: number;
          daily_chance_of_rain?: number;
          condition?: { text?: string; code?: number };
        };
      }>;
    };
  };

  const apiLocation = payload.location;
  const forecastDays = Array.isArray(payload.forecast?.forecastday)
    ? payload.forecast.forecastday
    : [];

  if (!apiLocation || !forecastDays.length) {
    throw new Error("WeatherAPI returned an incomplete forecast payload.");
  }

  const latitude = coerceNumber(apiLocation.lat);
  const longitude = coerceNumber(apiLocation.lon);

  if (latitude === null || longitude === null) {
    throw new Error("WeatherAPI returned invalid coordinates.");
  }

  const locationLabel = [apiLocation.name, apiLocation.region, apiLocation.country]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");

  const location: ResolvedLocation = {
    locationLabel,
    locationKey: buildLocationKey(latitude, longitude),
    latitude,
    longitude,
    timezone:
      typeof apiLocation.tz_id === "string" && apiLocation.tz_id.trim().length > 0
        ? apiLocation.tz_id
        : "auto"
  };

  const currentConditionCode = coerceNumber(payload.current?.condition?.code);
  const currentConditionText =
    typeof payload.current?.condition?.text === "string"
      ? payload.current.condition.text
      : null;

  const daysByDate = new Map<string, DailyForecast>();
  for (const forecastDay of forecastDays) {
    if (typeof forecastDay.date !== "string") {
      continue;
    }
    const weatherCode = mapWeatherApiConditionToWmo(
      currentConditionCode ?? coerceNumber(forecastDay.day?.condition?.code)
    );
    const dayConditionText =
      typeof forecastDay.day?.condition?.text === "string"
        ? forecastDay.day.condition.text
        : null;
    daysByDate.set(forecastDay.date, {
      weatherDate: forecastDay.date,
      tempMinC: coerceNumber(forecastDay.day?.mintemp_c),
      tempMaxC: coerceNumber(forecastDay.day?.maxtemp_c),
      precipitationChance: coerceNumber(forecastDay.day?.daily_chance_of_rain),
      weatherCode,
      conditionSummary: currentConditionText ?? dayConditionText ?? describeWeatherCode(weatherCode)
    });
  }

  return {
    location,
    currentTemperatureC: coerceNumber(payload.current?.temp_c),
    apparentTemperatureC: coerceNumber(payload.current?.feelslike_c),
    windSpeedKph: coerceNumber(payload.current?.wind_kph),
    daysByDate
  };
}

function selectForecastDate(forecast: ProviderForecast, requestedDate?: string): string | null {
  if (requestedDate && forecast.daysByDate.has(requestedDate)) {
    return requestedDate;
  }
  const first = forecast.daysByDate.keys().next();
  return first.done ? null : first.value;
}

async function upsertWeatherSnapshot(
  supabase: WeatherSnapshotClient,
  userId: string,
  context: LocalWeatherContext
) {
  const row: TablesInsert<"weather_snapshots"> = {
    user_id: userId,
    location_key: context.location_key,
    weather_date: context.weather_date,
    temp_min: context.temp_min_c,
    temp_max: context.temp_max_c,
    conditions: context.profile,
    precipitation_chance: context.precipitation_chance
  };

  const { error } = await supabase
    .from("weather_snapshots")
    .upsert(row, { onConflict: "user_id,location_key,weather_date" });

  if (error) {
    throw new Error(`Unable to cache weather snapshot: ${error.message}`);
  }
}

async function getCachedWeatherSnapshot(
  supabase: WeatherSnapshotClient,
  userId: string,
  locationKey: string,
  weatherDate: string
) {
  const { data, error } = await supabase
    .from("weather_snapshots")
    .select("id,user_id,location_key,weather_date,temp_min,temp_max,conditions,precipitation_chance,created_at")
    .eq("user_id", userId)
    .eq("location_key", locationKey)
    .eq("weather_date", weatherDate)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to read cached weather snapshot: ${error.message}`);
  }

  return data;
}

function buildSnapshotWeatherContext({
  snapshot,
  location,
  provider
}: {
  snapshot: Tables<"weather_snapshots">;
  location: ResolvedLocation;
  provider: WeatherProvider;
}): LocalWeatherContext {
  const profile = normalizeSnapshotProfile(snapshot);

  return localWeatherContextSchema.parse({
    profile,
    profile_label: weatherProfileLabel(profile),
    profile_source: "snapshot",
    location_label: location.locationLabel,
    location_key: location.locationKey,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    weather_date: snapshot.weather_date,
    current_temperature_c: null,
    apparent_temperature_c: null,
    temp_min_c: snapshot.temp_min,
    temp_max_c: snapshot.temp_max,
    precipitation_chance: snapshot.precipitation_chance,
    wind_speed_kph: null,
    weather_code: null,
    condition_summary: null,
    provider
  });
}

function buildHistoricalFallbackWeatherContext({
  location,
  weatherDate,
  provider
}: {
  location: ResolvedLocation;
  weatherDate: string;
  provider: WeatherProvider;
}): LocalWeatherContext {
  const profile = inferSeasonalFallbackProfile(location.latitude, weatherDate);

  return localWeatherContextSchema.parse({
    profile,
    profile_label: weatherProfileLabel(profile),
    profile_source: "historical_fallback",
    location_label: location.locationLabel,
    location_key: location.locationKey,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    weather_date: weatherDate,
    current_temperature_c: null,
    apparent_temperature_c: null,
    temp_min_c: null,
    temp_max_c: null,
    precipitation_chance: null,
    wind_speed_kph: null,
    weather_code: null,
    condition_summary: "Historical fallback for an unavailable past-day forecast.",
    provider
  });
}

function normalizeSnapshotProfile(snapshot: Tables<"weather_snapshots">) {
  if (snapshot.conditions && weatherProfiles.includes(snapshot.conditions as WeatherProfile)) {
    return snapshot.conditions as WeatherProfile;
  }

  return normalizeWeatherProfile({
    currentTemperatureC: null,
    apparentTemperatureC: null,
    tempMinC: snapshot.temp_min,
    tempMaxC: snapshot.temp_max,
    precipitationChance: snapshot.precipitation_chance,
    windSpeedKph: null,
    weatherCode: null
  });
}

function inferSeasonalFallbackProfile(latitude: number, weatherDate: string): WeatherProfile {
  const target = new Date(weatherDate);
  const month = target.getUTCMonth() + 1;
  const isNorthernHemisphere = latitude >= 0;

  const season =
    month === 12 || month <= 2
      ? isNorthernHemisphere
        ? "winter"
        : "summer"
      : month >= 3 && month <= 5
        ? isNorthernHemisphere
          ? "spring"
          : "autumn"
        : month >= 6 && month <= 8
          ? isNorthernHemisphere
            ? "summer"
            : "winter"
          : isNorthernHemisphere
            ? "autumn"
            : "spring";

  switch (season) {
    case "summer":
      return "warm_sun";
    case "winter":
      return "cool_breeze";
    default:
      return "mild_clear";
  }
}

function isPastDate(weatherDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(weatherDate);

  if (Number.isNaN(target.getTime())) {
    return false;
  }

  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

function isWetWeatherCode(code: number | null) {
  if (code === null) {
    return false;
  }

  return [45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code);
}

function formatCoordinateLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
}

function coerceNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveForecastDays(requestedDate?: string) {
  if (!requestedDate) {
    return 1;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(requestedDate);

  if (Number.isNaN(target.getTime())) {
    return 1;
  }

  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86400000);

  return Math.max(1, diffDays + 1);
}

function selectNumberAtIndex(values: unknown, index: number) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  return coerceNumber(values[index]);
}

function selectIntegerAtIndex(values: unknown, index: number) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const value = values[index];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function firstInteger(values: unknown) {
  const value = Array.isArray(values) ? values[0] : values;

  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function mapWeatherApiConditionToWmo(code: number | null) {
  if (code === null) {
    return null;
  }

  if ([1000].includes(code)) return 0;
  if ([1003].includes(code)) return 2;
  if ([1006, 1009].includes(code)) return 3;
  if ([1030, 1135, 1147].includes(code)) return 45;
  if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) return 63;
  if ([1066, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) return 73;
  if ([1069, 1072, 1168, 1171, 1198, 1201, 1204, 1207, 1249, 1252, 1261, 1264].includes(code)) return 66;
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return 95;

  return null;
}
