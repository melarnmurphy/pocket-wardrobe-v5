import { describe, expect, it } from "vitest";
import {
  buildLocationKey,
  describeWeatherCode,
  normalizeWeatherProfile,
  weatherProfileLabel
} from "@/lib/domain/weather/service";

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
