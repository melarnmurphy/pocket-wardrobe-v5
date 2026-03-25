// lib/domain/style-rules/knowledge/silhouette.ts
import type { SeedStyleRule } from "./index";

function sil(subject: string, object: string, weight: number, explanation: string): SeedStyleRule {
  return {
    rule_type: "silhouette",
    subject_type: "category",
    subject_value: subject,
    predicate: "pairs_with",
    object_type: "category",
    object_value: object,
    weight,
    rule_scope: "global",
    explanation,
    constraint_type: "soft",
  };
}

export function buildSilhouetteRules(): SeedStyleRule[] {
  return [
    sil("wide_leg_trousers", "fitted_top", 0.85, "Wide-leg trousers usually balance well with a more fitted top."),
    sil("slim_fit_trousers", "oversized_top", 0.84, "Slim-fit trousers balance an oversized top by keeping the lower half streamlined."),
    sil("midi_skirt", "fitted_top", 0.83, "A midi skirt pairs well with a fitted top to keep the silhouette from reading bulky."),
    sil("cropped_jacket", "high_waist_bottom", 0.86, "A cropped jacket works best with a high-waist bottom that meets the hem cleanly."),
    sil("straight_leg_trousers", "tucked_shirt", 0.82, "A tucked shirt with straight-leg trousers creates a clean, elongated line."),
    sil("maxi_skirt", "fitted_top", 0.81, "A fitted top keeps the silhouette controlled when wearing a voluminous maxi skirt."),
    sil("fitted_dress", "structured_outerwear", 0.88, "A fitted dress reads polished under structured outerwear like a tailored coat."),
    sil("relaxed_trousers", "structured_blazer", 0.84, "Relaxed trousers balance a structured blazer by adding ease at the bottom."),
  ];
}
