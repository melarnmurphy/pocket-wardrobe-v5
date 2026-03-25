// lib/domain/style-rules/knowledge/index.ts
// NOTE: Must NOT import from lib/domain/style-rules/index.ts

export type SeedStyleRule = {
  rule_type: string;
  subject_type: string;
  subject_value: string;
  predicate: string;
  object_type: string;
  object_value: string;
  weight: number;           // 0–1 scale
  rule_scope: "global";
  explanation: string;
  constraint_type: "hard" | "soft";
  // active, id, created_at intentionally absent — DB defaults apply
};

export { colourFamilies, inferColourFamilyFromText } from "./colours";
export { weatherProfiles } from "./weather";
export { occasionProfiles } from "./occasions";
export type { ColourFamily } from "./colours";
export type { WeatherProfile } from "./weather";
export type { OccasionProfile } from "./occasions";

import { buildColourRules } from "./colours";
import { buildWeatherRules } from "./weather";
import { buildOccasionRules } from "./occasions";
import { buildSeasonalityRules } from "./seasonality";
import { buildFormalityRules } from "./formality";
import { buildLayeringRules } from "./layering";
import { buildSilhouetteRules } from "./silhouette";
import { buildMaterialRules } from "./materials";
export { materialAliases } from "./materials";

// Keep for backwards compat — used by fashion-knowledge.ts shim
export { normalizeRuleValue, normalizeLooseText } from "./colours";

export function buildSeedStyleRules(): SeedStyleRule[] {
  return [
    ...buildColourRules(),
    ...buildWeatherRules(),
    ...buildOccasionRules(),
    ...buildSeasonalityRules(),
    ...buildFormalityRules(),
    ...buildLayeringRules(),
    ...buildSilhouetteRules(),
    ...buildMaterialRules(),
  ];
}
