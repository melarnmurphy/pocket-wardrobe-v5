import { describe, expect, it } from "vitest";
import {
  buildLocationKey,
  describeWeatherCode,
  getLocalWeather,
  getLocalWeatherForDates,
  normalizeWeatherProfile,
  weatherProfileLabel
} from "@/lib/domain/weather/service";

function isoOffsetFromToday(offsetDays: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
      time: [isoOffsetFromToday(0), isoOffsetFromToday(1), isoOffsetFromToday(2)],
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
import { localWeatherBatchLookupSchema } from "@/lib/domain/weather";

describe("normalizeWeatherProfile", () => {
  it("maps warm clear conditions to warm_sun", () => {
    expect(
      normalizeWeatherProfile({
        currentTemperatureC: 27,
        apparentTemperatureC: 29,
        tempMinC: 19,
        tempMaxC: 30,
        precipitationChance: 5,
        windSpeedKph: 10,
        weatherCode: 1
      })
    ).toBe("warm_sun");
  });

  it("maps wet conditions to cold_rain", () => {
    expect(
      normalizeWeatherProfile({
        currentTemperatureC: 18,
        apparentTemperatureC: 17,
        tempMinC: 12,
        tempMaxC: 19,
        precipitationChance: 70,
        windSpeedKph: 14,
        weatherCode: 63
      })
    ).toBe("cold_rain");
  });

  it("maps cool or windy dry conditions to cool_breeze", () => {
    expect(
      normalizeWeatherProfile({
        currentTemperatureC: 15,
        apparentTemperatureC: 14,
        tempMinC: 10,
        tempMaxC: 16,
        precipitationChance: 10,
        windSpeedKph: 18,
        weatherCode: 2
      })
    ).toBe("cool_breeze");
  });

  it("maps moderate dry conditions to mild_clear", () => {
    expect(
      normalizeWeatherProfile({
        currentTemperatureC: 21,
        apparentTemperatureC: 21,
        tempMinC: 16,
        tempMaxC: 22,
        precipitationChance: 15,
        windSpeedKph: 12,
        weatherCode: 3
      })
    ).toBe("mild_clear");
  });
});

describe("weather helpers", () => {
  it("builds stable rounded location keys", () => {
    expect(buildLocationKey(-34.928499, 138.600701)).toBe("geo:-34.928,138.601");
  });

  it("returns readable weather labels and summaries", () => {
    expect(weatherProfileLabel("warm_sun")).toBe("Warm sun");
    expect(describeWeatherCode(63)).toBe("Moderate rain");
    expect(describeWeatherCode(null)).toBeNull();
  });
});

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

  it("rejects latitude supplied without longitude", () => {
    expect(() =>
      localWeatherBatchLookupSchema.parse({ latitude: -34.9, dates: ["2026-06-10"] })
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

describe("getLocalWeather single-date (characterization)", () => {
  it("returns the live context for the requested future day", async () => {
    const fetchImpl = jsonFetch(openMeteoPayload());
    const context = await getLocalWeather(
      {
        latitude: -34.928,
        longitude: 138.6,
        weatherDate: isoOffsetFromToday(1),
        provider: "open-meteo"
      },
      { fetchImpl, provider: "open-meteo" }
    );

    expect(context.weather_date).toBe(isoOffsetFromToday(1));
    expect(context.profile_source).toBe("live");
    expect(context.temp_max_c).toBe(22);
    expect(context.temp_min_c).toBe(12);
    expect(context.precipitation_chance).toBe(5);
    expect(context.current_temperature_c).toBe(14);
    // apparent_temperature 13 (<=16) -> cool_breeze per normalizeWeatherProfile
    expect(context.profile).toBe("cool_breeze");
    expect(context.provider).toBe("open-meteo");
  });
});

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
        dates: [isoOffsetFromToday(0), isoOffsetFromToday(1), isoOffsetFromToday(2)],
        provider: "open-meteo"
      },
      { fetchImpl, provider: "open-meteo" }
    );

    expect(calls).toBe(1);
    expect(Object.keys(result).sort()).toEqual(
      [isoOffsetFromToday(0), isoOffsetFromToday(1), isoOffsetFromToday(2)].sort()
    );
    expect(result[isoOffsetFromToday(1)].temp_max_c).toBe(22);
    expect(result[isoOffsetFromToday(1)].profile_source).toBe("live");
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
        dates: [isoOffsetFromToday(1), isoOffsetFromToday(10)],
        provider: "open-meteo"
      },
      { fetchImpl, provider: "open-meteo" }
    );

    expect(calls).toBe(1);
    expect(result[isoOffsetFromToday(1)].profile_source).toBe("live");
    expect(result[isoOffsetFromToday(10)].profile_source).toBe("historical_fallback");
  });
});
