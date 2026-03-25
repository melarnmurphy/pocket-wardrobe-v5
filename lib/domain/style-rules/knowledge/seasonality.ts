// lib/domain/style-rules/knowledge/seasonality.ts
import type { SeedStyleRule } from "./index";

type Season = "spring" | "summer" | "autumn" | "winter";

function season(
  subject_value: string,
  subject_type: "category" | "material",
  seasons: Season[],
  weight: number,
  explanation: string
): SeedStyleRule[] {
  return seasons.map((s) => ({
    rule_type: "seasonality",
    subject_type,
    subject_value,
    predicate: "works_in_season",
    object_type: "season",
    object_value: s,
    weight,
    rule_scope: "global" as const,
    explanation,
    constraint_type: "soft" as const,
  }));
}

export function buildSeasonalityRules(): SeedStyleRule[] {
  return [
    ...season("linen trousers", "category", ["summer"], 0.92, "Linen trousers breathe well and are best suited to summer heat."),
    ...season("heavy wool coat", "category", ["autumn", "winter"], 0.95, "Heavy wool coats provide the insulation needed in autumn and winter."),
    ...season("trench coat", "category", ["spring", "autumn"], 0.88, "A trench coat handles transitional weather in spring and autumn well."),
    ...season("sandals", "category", ["spring", "summer"], 0.9, "Sandals are suited to warmer spring and summer conditions."),
    ...season("knitwear", "category", ["autumn", "winter"], 0.9, "Knitwear provides warmth that is most useful in autumn and winter."),
    ...season("t-shirt", "category", ["spring", "summer"], 0.88, "A t-shirt is a practical lightweight layer for spring and summer."),
    ...season("puffer jacket", "category", ["winter"], 0.96, "A puffer jacket delivers maximum insulation for winter conditions."),
    ...season("cotton shirt", "category", ["spring", "summer", "autumn"], 0.85, "A cotton shirt is breathable and suitable across spring, summer, and autumn."),
  ];
}
