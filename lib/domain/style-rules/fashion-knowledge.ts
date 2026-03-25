// lib/domain/style-rules/fashion-knowledge.ts
// Re-export shim — all logic has moved to lib/domain/style-rules/knowledge/
// This file is kept for backwards compatibility. Do not add logic here.

export {
  buildSeedStyleRules,
  colourFamilies,
  weatherProfiles,
  occasionProfiles,
  inferColourFamilyFromText,
  normalizeRuleValue,
  normalizeLooseText,
} from "./knowledge/index";

export type {
  SeedStyleRule,
  ColourFamily,
  WeatherProfile,
  OccasionProfile,
} from "./knowledge/index";
