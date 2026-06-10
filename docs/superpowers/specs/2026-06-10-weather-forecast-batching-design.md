# Weather forecast batching (Lever B)

**Date:** 2026-06-10
**Status:** Approved design, pending implementation plan

## Problem

The outfit planner renders a 7-day, Monday-anchored week (`createInitialWeek`,
`components/outfit-planner.tsx`). On page load it hydrates weather for every day
whose mode is `auto` and whose location matches the user's preferred location.
That hydration fans out **one HTTP request per day** via
`Promise.all(daysToHydrate.map(...))` (`outfit-planner.tsx:187`), each calling
`GET /api/weather/local` → `getLocalWeather` → an external provider forecast
call.

Observed cost: ~2s per request, fired in parallel (≈4–7 calls for a typical
week). The fan-out is wasteful because a single WeatherAPI / Open-Meteo
`forecast.json` call already returns the whole contiguous future window in one
response. Past days do not hit the forecast API at all — they resolve via the
cached snapshot lookup or the seasonal/historical fallback — so they are already
cheap.

Lever A (already shipped, commit `4572588`) added Data Cache TTLs to the
provider fetches, which fixes repeat loads. Lever B (this spec) eliminates the
first-load fan-out.

## Goal

On page-load hydration, make **one** forecast call for the today+future window
instead of one call per future day, while producing per-day results identical to
today's behavior. The single active-day "Load weather" action is out of scope and
remains unchanged.

## Decisions

- **Beyond-horizon days:** WeatherAPI's forecast horizon depends on plan tier
  (Free = 3 days, paid = 14). Days the provider does not return fall back to the
  existing seasonal/historical fallback (`buildHistoricalFallbackWeatherContext`)
  — the same path past days use. This is plan-agnostic: we map whatever the
  provider returns and fall back for the rest, with no hardcoded day cap.
- **Approach:** dedicated batch service function + dedicated batch route. The
  existing single-date service function and route are preserved.

## Architecture

### 1. Service: `getLocalWeatherForDates`

`lib/domain/weather/service.ts`

```
getLocalWeatherForDates(
  input: {
    location?: string;
    latitude?: number;
    longitude?: number;
    dates: string[];          // ISO yyyy-mm-dd, deduped, capped at 14
    provider?: WeatherProvider;
    profileOverride?: WeatherProfile;
  },
  options?: {
    fetchImpl?: FetchLike;
    supabase?: WeatherSnapshotClient;
    userId?: string | null;
    provider?: WeatherProvider;
  }
): Promise<Record<string, LocalWeatherContext>>   // keyed by ISO date
```

Logic:

1. Resolve provider (`resolveWeatherProvider`) and validate input.
2. Resolve location **once** via `resolveLocation` (geocoding, cached 24h by
   Lever A).
3. Partition `dates` into past vs today/future using `isPastDate`.
4. **Past dates:** resolve each via the existing snapshot lookup
   (`getCachedWeatherSnapshot` → `buildSnapshotWeatherContext`) or
   `buildHistoricalFallbackWeatherContext`. No forecast call. May run as parallel
   DB reads.
5. **Today/future dates:** issue **one** provider forecast request covering
   `days = min(maxFutureDiff + 1, 14)`. Parse the payload into a
   `Map<isoDate, perDayForecast>`. For each requested future date:
   - present in the map → build a live `LocalWeatherContext` (honoring
     `profileOverride` exactly as the single-date path does);
   - absent (beyond the provider's returned horizon) →
     `buildHistoricalFallbackWeatherContext`.
6. Optionally upsert snapshots for the resolved live days (mirrors single-date
   behavior; reuses `upsertWeatherSnapshot`).
7. Return a record covering **every** requested date.

### 2. Provider parsing refactor

The current `fetchWeatherApiWeather` and `fetchForecast` each select a single
forecast day from the payload. Extract the payload→all-days mapping into a shared
core that returns `Map<isoDate, perDayForecast>` (plus the resolved location and
`current` snapshot). The existing single-date functions become thin selectors
over that core, so their external behavior — and the 6 existing weather tests —
remain unchanged.

### 3. Route: `GET /api/weather/local/batch`

`app/api/weather/local/batch/route.ts` (`dynamic = "force-dynamic"`)

- Query params: `location` | (`latitude` + `longitude`), `dates` (comma-separated
  ISO, deduped, max 14), `provider`, `profile_override`.
- Validates with a new `localWeatherBatchLookupSchema` in
  `lib/domain/weather/index.ts` (reuses the base location/coords refinement;
  replaces single `weatherDate` with `dates: string[]`).
- Auth via `getRequiredUser`; same 400 (Zod) / 401 (auth) / 500 handling as the
  single route.
- Response body:
  ```
  {
    provider: WeatherProvider,
    provider_note: string,
    weather_contexts: Record<string /* isoDate */, LocalWeatherContext>
  }
  ```

### 4. Client: `components/outfit-planner.tsx`

Replace the preferred-location hydration fan-out (lines ~187–211):

- Build one request with `dates = daysToHydrate.map(d => d.dateIso).join(",")`
  plus `location` and `provider`, call `/api/weather/local/batch`.
- Distribute results in a single `setDays`: for each hydrated day, apply
  `weather_contexts[day.dateIso]` (set `weatherContext` and, when present,
  `locationQuery = context.location_label`).
- Preserve existing failure handling: on error, clear the
  `hydratedPreferredLocationsRef` entry so a later attempt can retry.
- `fetchLocalWeather` and `loadWeatherForActiveDay` (single active-day action)
  are untouched.

## Data flow

```
page load
  └─ hydration effect collects daysToHydrate (auto + matching location, no context)
       └─ GET /api/weather/local/batch?location&dates=csv&provider
            └─ getLocalWeatherForDates
                 ├─ resolveLocation (once, cached)
                 ├─ past dates  → snapshot / seasonal fallback (no forecast call)
                 └─ future dates → ONE forecast call → map per day
                                    (beyond horizon → seasonal fallback)
       └─ single setDays distributes weather_contexts across days
```

## Error handling

- Invalid/empty `dates`, missing location, or >14 dates → 400 with a clear
  message (Zod).
- Auth failure → 401.
- Provider/geocoding failure → 500; the client clears its hydration marker and
  leaves days un-hydrated (same as today). A provider failure fails the whole
  batch (consistent with the current per-day behavior where a failed day stays
  un-hydrated); we do not partially degrade live days to fallback on provider
  error.

## Testing

Existing 6 weather tests must stay green (guard the single-date path through the
refactor). Add batch-service tests with an injected mock `fetchImpl`:

1. A multi-future-day request issues **exactly one** forecast call.
2. Past dates resolve without any forecast call.
3. Dates beyond the provider's returned horizon get the seasonal fallback
   (`profile_source: "historical_fallback"`).
4. The returned record contains an entry for **every** requested date.
5. `profileOverride` is honored per day, matching single-date behavior.

## Out of scope

- Changing the single active-day "Load weather" action.
- Altering the snapshot cache schema or the seasonal fallback heuristic.
- Client-side caching beyond what Lever A already provides.

## Expected impact

Page-load weather hydration drops from N parallel ~2s forecast calls to a single
forecast call (plus cheap past-day reads), eliminating the first-load fan-out.
Combined with Lever A, repeat loads continue to serve from the Data Cache.
