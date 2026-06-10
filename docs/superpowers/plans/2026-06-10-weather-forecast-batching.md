# Weather Forecast Batching (Lever B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outfit planner's per-day weather fan-out with a single batched forecast request, producing per-day results identical to today's behavior.

**Architecture:** Add a batch service function (`getLocalWeatherForDates`) that resolves location once, makes one provider forecast call for the today+future window, maps each date to its day, and uses the existing snapshot/seasonal-fallback paths for past and beyond-horizon dates. Expose it at a new `GET /api/weather/local/batch` route. The client's page-load hydration calls it once. The single-date function/route and the active-day action are preserved by refactoring the provider parsing into a shared "all days" core that the single-date path also uses.

**Tech Stack:** Next.js App Router (route handlers), TypeScript, Zod, Vitest. Providers: WeatherAPI + Open-Meteo (existing).

**Spec:** `docs/superpowers/specs/2026-06-10-weather-forecast-batching-design.md`

---

## File Structure

- `lib/domain/weather/index.ts` — add `localWeatherBatchLookupSchema` + exported types.
- `lib/domain/weather/service.ts` — add the shared all-days forecast core, refactor single-date path to use it, add `buildLiveWeatherContext`, add `getLocalWeatherForDates`.
- `lib/domain/weather/__tests__/service.test.ts` — characterization test for single-date output + new batch tests.
- `app/api/weather/local/batch/route.ts` — new batch route handler.
- `components/outfit-planner.tsx` — replace hydration fan-out with one batch call.

---

## Task 1: Batch lookup schema

**Files:**
- Modify: `lib/domain/weather/index.ts`
- Test: `lib/domain/weather/__tests__/service.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the bottom of `lib/domain/weather/__tests__/service.test.ts`:

```ts
import { localWeatherBatchLookupSchema } from "@/lib/domain/weather";

describe("localWeatherBatchLookupSchema", () => {
  it("accepts a location with a list of ISO dates", () => {
    const parsed = localWeatherBatchLookupSchema.parse({
      location: "Adelaide",
      dates: ["2026-06-10", "2026-06-11"],
      provider: "weatherapi"
    });
    expect(parsed.dates).toEqual(["2026-06-10", "2026-06-11"]);
  });

  it("deduplicates dates and rejects an empty list", () => {
    expect(
      localWeatherBatchLookupSchema.parse({
        location: "Adelaide",
        dates: ["2026-06-10", "2026-06-10"]
      }).dates
    ).toEqual(["2026-06-10"]);

    expect(() =>
      localWeatherBatchLookupSchema.parse({ location: "Adelaide", dates: [] })
    ).toThrow();
  });

  it("rejects more than 14 dates and requires a location or coordinates", () => {
    const tooMany = Array.from({ length: 15 }, (_, i) =>
      `2026-06-${String(i + 1).padStart(2, "0")}`
    );
    expect(() =>
      localWeatherBatchLookupSchema.parse({ location: "Adelaide", dates: tooMany })
    ).toThrow();

    expect(() =>
      localWeatherBatchLookupSchema.parse({ dates: ["2026-06-10"] })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/weather`
Expected: FAIL — `localWeatherBatchLookupSchema` is not exported.

- [ ] **Step 3: Implement the schema**

In `lib/domain/weather/index.ts`, after `localWeatherLookupSchema` (around line 37) and before `localWeatherContextSchema`, add:

```ts
const isoDateSchema = z.string().date();

export const localWeatherBatchLookupSchema = z
  .object({
    location: z.string().trim().min(1).max(160).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    dates: z
      .array(isoDateSchema)
      .min(1, "Provide at least one date.")
      .max(14, "A batch request supports at most 14 dates.")
      .transform((dates) => Array.from(new Set(dates))),
    profileOverride: weatherProfileSchema.optional(),
    provider: weatherProviderSchema.optional()
  })
  .superRefine((value, context) => {
    const hasCoordinates =
      typeof value.latitude === "number" && typeof value.longitude === "number";

    if (!value.location && !hasCoordinates) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a location name or latitude and longitude."
      });
    }

    if (
      (typeof value.latitude === "number" && typeof value.longitude !== "number") ||
      (typeof value.longitude === "number" && typeof value.latitude !== "number")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude and longitude must be supplied together."
      });
    }
  });
```

Then add the exported type near the other type exports at the bottom of the file:

```ts
export type LocalWeatherBatchLookupInput = z.infer<typeof localWeatherBatchLookupSchema>;
```

Note: `.max(14)` validates before `.transform` dedupes, so 15 distinct dates correctly throws.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/weather`
Expected: PASS (all schema tests green; existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add lib/domain/weather/index.ts lib/domain/weather/__tests__/service.test.ts
git commit -m "feat(weather): add localWeatherBatchLookupSchema"
```

---

## Task 2: Characterization test for single-date output

Locks in the current single-date provider output so the Task 3 refactor cannot change behavior. Uses `open-meteo` with explicit coordinates so `resolveLocation` short-circuits (no geocoding fetch) and the injected `fetchImpl` is called exactly once.

**Files:**
- Test: `lib/domain/weather/__tests__/service.test.ts`

- [ ] **Step 1: Write the characterization test**

Add to `lib/domain/weather/__tests__/service.test.ts`:

```ts
import { getLocalWeather } from "@/lib/domain/weather/service";

// A fixed Open-Meteo forecast payload covering three consecutive days.
function openMeteoPayload() {
  return {
    timezone: "Australia/Adelaide",
    current: {
      temperature_2m: 14,
      apparent_temperature: 13,
      weather_code: 3,
      wind_speed_10m: 20
    },
    daily: {
      time: ["2026-06-10", "2026-06-11", "2026-06-12"],
      temperature_2m_max: [16, 22, 12],
      temperature_2m_min: [8, 12, 6],
      precipitation_probability_max: [10, 5, 70],
      weather_code: [3, 1, 63]
    }
  };
}

function jsonFetch(payload: unknown) {
  return (async () =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => payload
    })) as unknown as typeof fetch;
}

describe("getLocalWeather single-date (characterization)", () => {
  it("returns the live context for the requested future day", async () => {
    const fetchImpl = jsonFetch(openMeteoPayload());
    const context = await getLocalWeather(
      {
        latitude: -34.928,
        longitude: 138.6,
        weatherDate: "2026-06-11",
        provider: "open-meteo"
      },
      { fetchImpl, provider: "open-meteo" }
    );

    expect(context.weather_date).toBe("2026-06-11");
    expect(context.profile_source).toBe("live");
    expect(context.temp_max_c).toBe(22);
    expect(context.temp_min_c).toBe(12);
    expect(context.precipitation_chance).toBe(5);
    expect(context.current_temperature_c).toBe(14);
    expect(context.profile).toBe("mild_clear");
    expect(context.provider).toBe("open-meteo");
  });
});
```

- [ ] **Step 2: Run test to verify it passes (current behavior)**

Run: `npx vitest run lib/domain/weather`
Expected: PASS — this captures existing behavior before refactor.

- [ ] **Step 3: Commit**

```bash
git add lib/domain/weather/__tests__/service.test.ts
git commit -m "test(weather): characterize single-date forecast output"
```

---

## Task 3: Refactor provider parsing into a shared all-days core

Introduce `DailyForecast` / `ProviderForecast` types, a `fetchAllForecast` core that returns every day from one provider call, and a `buildLiveWeatherContext` helper. Refactor the existing single-date `fetchWeatherFromProvider` and the inline context construction in `getLocalWeather` to use them. The Task 2 characterization test guards this.

**Files:**
- Modify: `lib/domain/weather/service.ts`

- [ ] **Step 1: Add shared types and the context builder**

In `lib/domain/weather/service.ts`, add after the `ResolvedLocation` type (around line 102):

```ts
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
```

- [ ] **Step 2: Add the all-days parsers**

Add these functions to `lib/domain/weather/service.ts` (near the existing `fetchWeatherFromProvider`, around line 357):

```ts
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
```

- [ ] **Step 3: Rewrite the single-date `fetchWeatherFromProvider` to use the core**

Replace the existing `fetchWeatherFromProvider` (currently lines ~345-357) with:

```ts
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
```

Then delete the now-unused `fetchWeatherApiWeather`, `fetchForecast`, `selectWeatherApiForecastDay`, and `selectForecastIndex` functions (they are fully replaced by the all-days parsers and `selectForecastDate`). Leave `firstNumber` if still referenced; if it becomes unused, delete it too.

- [ ] **Step 4: Simplify `getLocalWeather`'s live branch to use `buildLiveWeatherContext`**

In `getLocalWeather`, replace the block that builds `liveProfile`/`profile`/`context` from `resolved` (currently lines ~144-175) with:

```ts
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
```

- [ ] **Step 5: Run tests to verify the refactor preserves behavior**

Run: `npx vitest run lib/domain/weather && npx tsc --noEmit`
Expected: PASS — characterization test and all existing tests green; tsc exit 0. If tsc reports an unused function, delete it.

- [ ] **Step 6: Commit**

```bash
git add lib/domain/weather/service.ts
git commit -m "refactor(weather): parse all forecast days through a shared core"
```

---

## Task 4: Implement `getLocalWeatherForDates`

**Files:**
- Modify: `lib/domain/weather/service.ts`
- Test: `lib/domain/weather/__tests__/service.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `lib/domain/weather/__tests__/service.test.ts` (reuses `openMeteoPayload` and `jsonFetch` from Task 2):

```ts
import { getLocalWeatherForDates } from "@/lib/domain/weather/service";

describe("getLocalWeatherForDates", () => {
  it("makes exactly one forecast call for multiple future dates", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => openMeteoPayload()
      };
    }) as unknown as typeof fetch;

    const result = await getLocalWeatherForDates(
      {
        latitude: -34.928,
        longitude: 138.6,
        dates: ["2026-06-10", "2026-06-11", "2026-06-12"],
        provider: "open-meteo"
      },
      { fetchImpl, provider: "open-meteo" }
    );

    expect(calls).toBe(1);
    expect(Object.keys(result).sort()).toEqual([
      "2026-06-10",
      "2026-06-11",
      "2026-06-12"
    ]);
    expect(result["2026-06-11"].temp_max_c).toBe(22);
    expect(result["2026-06-11"].profile_source).toBe("live");
  });

  it("gives a seasonal fallback for dates beyond the returned horizon without extra calls", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => openMeteoPayload() // only covers 06-10..06-12
      };
    }) as unknown as typeof fetch;

    const result = await getLocalWeatherForDates(
      {
        latitude: -34.928,
        longitude: 138.6,
        dates: ["2026-06-11", "2026-06-20"],
        provider: "open-meteo"
      },
      { fetchImpl, provider: "open-meteo" }
    );

    expect(calls).toBe(1);
    expect(result["2026-06-11"].profile_source).toBe("live");
    expect(result["2026-06-20"].profile_source).toBe("historical_fallback");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/domain/weather`
Expected: FAIL — `getLocalWeatherForDates` is not exported.

- [ ] **Step 3: Implement `getLocalWeatherForDates`**

Add to `lib/domain/weather/service.ts`, after `getLocalWeather`:

```ts
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
  for (const date of pastDates) {
    const location = await resolveLocation(
      { ...values, weatherDate: date },
      fetchImpl
    );

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
  const furthestDate = futureDates.reduce((max, date) => (date > max ? date : max), futureDates[0]);
  const forecast = await fetchAllForecast(
    provider,
    { ...values, weatherDate: furthestDate },
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
```

Add `localWeatherBatchLookupSchema` and `LocalWeatherBatchLookupInput` to the existing import from `@/lib/domain/weather` at the top of `service.ts`.

Note: `fetchAllForecast` with the WeatherAPI provider does not call `resolveLocation`; the past-date loop's `resolveLocation` for WeatherAPI still uses Open-Meteo geocoding (same as the existing single-date past-date path — unchanged behavior).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/domain/weather && npx tsc --noEmit`
Expected: PASS; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/weather/service.ts lib/domain/weather/__tests__/service.test.ts
git commit -m "feat(weather): add getLocalWeatherForDates batch lookup"
```

---

## Task 5: Batch route handler

**Files:**
- Create: `app/api/weather/local/batch/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/weather/local/batch/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { localWeatherBatchLookupSchema } from "@/lib/domain/weather";
import { getLocalWeatherForDates, type WeatherSnapshotClient } from "@/lib/domain/weather/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getRequiredUser();
    const supabase = (await createClient()) as unknown as WeatherSnapshotClient;
    const searchParams = request.nextUrl.searchParams;
    const datesParam = searchParams.get("dates") ?? "";
    const dates = datesParam
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const input = localWeatherBatchLookupSchema.parse({
      location: searchParams.get("location") ?? undefined,
      latitude: searchParams.get("latitude") ?? undefined,
      longitude: searchParams.get("longitude") ?? undefined,
      dates,
      profileOverride: searchParams.get("profile_override") ?? undefined,
      provider: searchParams.get("provider") ?? undefined
    });

    const weatherContexts = await getLocalWeatherForDates(input, {
      supabase,
      userId: user?.id ?? null
    });

    const provider = input.provider ?? Object.values(weatherContexts)[0]?.provider ?? "open-meteo";

    return NextResponse.json(
      {
        provider,
        provider_note:
          provider === "weatherapi"
            ? "WeatherAPI is the default free-plan provider when a WeatherAPI key is configured."
            : "Open-Meteo is active as a fallback/dev provider. Review quota and commercial terms before production launch.",
        weather_contexts: weatherContexts
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid weather request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load local weather." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/weather/local/batch/route.ts
git commit -m "feat(weather): add /api/weather/local/batch route"
```

---

## Task 6: Client uses the batch endpoint

**Files:**
- Modify: `components/outfit-planner.tsx` (hydration effect, ~lines 187-211)

- [ ] **Step 1: Add a batch fetch helper**

In `components/outfit-planner.tsx`, add next to `fetchLocalWeather` (around line 248):

```tsx
  async function fetchLocalWeatherBatch(params: URLSearchParams) {
    const response = await fetch(`/api/weather/local/batch?${params.toString()}`, {
      method: "GET"
    });
    const payload = (await response.json()) as {
      error?: string;
      weather_contexts?: Record<string, LocalWeatherContext>;
    };

    if (!response.ok || !payload.weather_contexts) {
      throw new Error(payload.error ?? "Unable to load local weather.");
    }

    return payload.weather_contexts;
  }
```

- [ ] **Step 2: Replace the fan-out with one batch call**

Replace the `void Promise.all(daysToHydrate.map(async (day) => { ... })).catch(...)` block (lines ~187-211) with:

```tsx
    void fetchLocalWeatherBatch(
      new URLSearchParams({
        location: normalizedPreferredLocation,
        dates: daysToHydrate.map((day) => day.dateIso).join(","),
        provider: defaultWeatherProvider
      })
    )
      .then((weatherContexts) => {
        setDays((currentDays) =>
          currentDays.map((currentDay) => {
            const context = weatherContexts[currentDay.dateIso];
            if (!context) {
              return currentDay;
            }
            const matchesHydration = daysToHydrate.some((day) => day.key === currentDay.key);
            if (!matchesHydration) {
              return currentDay;
            }
            return {
              ...currentDay,
              weatherContext: context,
              locationQuery: context.location_label || currentDay.locationQuery
            };
          })
        );
      })
      .catch(() => {
        hydratedPreferredLocationsRef.current.delete(normalizedPreferredLocation);
      });
```

- [ ] **Step 3: Verify typecheck and existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/outfit-planner.tsx
git commit -m "feat(planner): hydrate weather via one batch request"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

- [ ] **Step 2: Manual smoke test**

Run the dev server, open `/outfits`, and confirm in the dev server terminal that a single `GET /api/weather/local/batch?...` request appears on page load (instead of multiple `GET /api/weather/local?...weather_date=...` requests). Confirm each day cell still shows a weather profile, and that past days, today, and future days all render.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "chore(weather): finalize forecast batching"
```

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1), provider-parsing refactor preserving single-date behavior (Tasks 2-3), `getLocalWeatherForDates` with past/future/beyond-horizon handling and one forecast call (Task 4), batch route (Task 5), client fan-out removal (Task 6), tests for one-call / fallback / full coverage (Tasks 2 & 4), final verification (Task 7).
- **Provider-error behavior:** a forecast failure throws and rejects the whole batch (route returns 500; client clears its hydration marker), matching the spec.
- **Snapshot upsert:** retained for resolved live days, matching the spec and single-date behavior.
- **Type consistency:** `DailyForecast` / `ProviderForecast` / `buildLiveWeatherContext` / `fetchAllForecast` / `selectForecastDate` / `getLocalWeatherForDates` / `localWeatherBatchLookupSchema` / `LocalWeatherBatchLookupInput` are defined once and referenced consistently.
