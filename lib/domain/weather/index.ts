import { z } from "zod";
import { weatherProfiles } from "@/lib/domain/style-rules/knowledge/weather";

export const weatherProfileSchema = z.enum(weatherProfiles);
export const weatherProviderSchema = z.enum(["weatherapi", "open-meteo"]);

export const localWeatherLookupSchema = z
  .object({
    location: z.string().trim().min(1).max(160).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
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

export const localWeatherContextSchema = z.object({
  profile: weatherProfileSchema,
  profile_label: z.string().min(1),
  profile_source: z.enum(["live", "manual_override"]),
  location_label: z.string().min(1),
  location_key: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
  weather_date: z.string().date(),
  current_temperature_c: z.number().nullable(),
  apparent_temperature_c: z.number().nullable(),
  temp_min_c: z.number().nullable(),
  temp_max_c: z.number().nullable(),
  precipitation_chance: z.number().min(0).max(100).nullable(),
  wind_speed_kph: z.number().nullable(),
  weather_code: z.number().int().nullable(),
  condition_summary: z.string().nullable(),
  provider: weatherProviderSchema
});

export type WeatherProfile = z.infer<typeof weatherProfileSchema>;
export type WeatherProvider = z.infer<typeof weatherProviderSchema>;
export type LocalWeatherLookupInput = z.infer<typeof localWeatherLookupSchema>;
export type LocalWeatherContext = z.infer<typeof localWeatherContextSchema>;
