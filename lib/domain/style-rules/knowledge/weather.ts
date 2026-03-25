// lib/domain/style-rules/knowledge/weather.ts
import type { SeedStyleRule } from "./index";

export const weatherProfiles = ["warm_sun", "mild_clear", "cool_breeze", "cold_rain"] as const;
export type WeatherProfile = (typeof weatherProfiles)[number];

export function buildWeatherRules(): SeedStyleRule[] {
  return [
    { rule_type: "weather_fit", subject_type: "category", subject_value: "sandals", predicate: "avoid_with", object_type: "weather", object_value: "cold_rain", weight: 0.99, rule_scope: "global", explanation: "Sandals are generally a poor choice in cold rainy weather.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "coat", predicate: "works_in_weather", object_type: "weather", object_value: "cold_rain", weight: 0.95, rule_scope: "global", explanation: "A coat is one of the safest outer layers for cold rainy conditions.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "boots", predicate: "works_in_weather", object_type: "weather", object_value: "cold_rain", weight: 0.94, rule_scope: "global", explanation: "Boots usually handle wet streets and lower temperatures better than open footwear.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "knitwear", predicate: "works_in_weather", object_type: "weather", object_value: "cool_breeze", weight: 0.9, rule_scope: "global", explanation: "Knitwear adds insulation without the weight of a full coat in cooler breezy weather.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "linen trousers", predicate: "works_in_weather", object_type: "weather", object_value: "warm_sun", weight: 0.92, rule_scope: "global", explanation: "Linen trousers breathe well and stay comfortable in warmer sunny weather.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "t-shirt", predicate: "works_in_weather", object_type: "weather", object_value: "warm_sun", weight: 0.88, rule_scope: "global", explanation: "A t-shirt is a reliable warm-weather base because it is breathable and easy to layer lightly.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "blazer", predicate: "works_in_weather", object_type: "weather", object_value: "mild_clear", weight: 0.78, rule_scope: "global", explanation: "A blazer is often most comfortable in mild weather when outerwear is optional.", constraint_type: "soft" },
    { rule_type: "weather_fit", subject_type: "category", subject_value: "loafer", predicate: "works_in_weather", object_type: "weather", object_value: "mild_clear", weight: 0.82, rule_scope: "global", explanation: "Loafers work best in dry mild weather where a polished low-profile shoe is practical.", constraint_type: "soft" },
  ];
}
