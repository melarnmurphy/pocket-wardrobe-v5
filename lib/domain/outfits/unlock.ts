import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import { applyHardFilters, categoryToRole } from "@/lib/domain/outfits/generator";
import { costPerWearBoost } from "@/lib/domain/outfits/ranking";

const ROLE_CAP = 8;
const COMBO_CAP = 400;

export type UnlockCandidate = {
  id: string;
  label: string;
  source: "trend" | "lookbook";
  synthetic: Pick<GarmentListItem, "id" | "title" | "category" | "subcategory" | "primary_colour_family">;
};

export type UnlockScore = {
  id: string;
  label: string;
  source: "trend" | "lookbook";
  unlock_count: number;
  reasoning: string;
};

type RequiredRole = "top" | "bottom" | "dress" | "shoes";

function toSyntheticGarment(
  synthetic: UnlockCandidate["synthetic"]
): GarmentListItem {
  return {
    ...synthetic,
    user_id: "synthetic",
    description: null,
    brand: null,
    pattern: null,
    material: null,
    size: null,
    fit: null,
    formality_level: null,
    seasonality: [],
    wardrobe_status: "active",
    purchase_price: null,
    purchase_currency: null,
    purchase_date: null,
    retailer: null,
    favourite_score: null,
    wear_count: 0,
    last_worn_at: null,
    cost_per_wear: null,
    extraction_metadata_json: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    primary_colour_hex: null,
    preview_url: null,
    images: [],
    three_d_assets: [],
    recent_wear_events: []
  } as GarmentListItem;
}

function compareForRoleSample(a: GarmentListItem, b: GarmentListItem) {
  const boostDelta = costPerWearBoost(b) - costPerWearBoost(a);
  if (boostDelta !== 0) return boostDelta;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

export function countRoleCompleteCombos(
  garments: GarmentListItem[],
  styleRules: StyleRuleListItem[],
  dressCode?: string
): number {
  const eligible = applyHardFilters(garments, styleRules, dressCode);
  const buckets: Record<RequiredRole, GarmentListItem[]> = {
    top: [],
    bottom: [],
    dress: [],
    shoes: []
  };

  for (const garment of eligible) {
    const role = categoryToRole(garment.category, garment.subcategory, garment.title);
    if (role === "top" || role === "bottom" || role === "dress" || role === "shoes") {
      buckets[role].push(garment);
    }
  }

  for (const role of Object.keys(buckets) as RequiredRole[]) {
    buckets[role].sort(compareForRoleSample);
    buckets[role] = buckets[role].slice(0, ROLE_CAP);
  }

  while (
    buckets.top.length > 0 &&
    buckets.bottom.length > 0 &&
    buckets.shoes.length > 0 &&
    buckets.top.length * buckets.bottom.length * buckets.shoes.length > COMBO_CAP
  ) {
    buckets.shoes.pop();
  }

  const dressCombos = buckets.dress.length * buckets.shoes.length;
  const separatedCombos = buckets.top.length * buckets.bottom.length * buckets.shoes.length;
  return dressCombos + separatedCombos;
}

export function scoreUnlockCandidates(
  garments: GarmentListItem[],
  styleRules: StyleRuleListItem[],
  candidates: UnlockCandidate[],
  dressCode?: string
): UnlockScore[] {
  const baseline = countRoleCompleteCombos(garments, styleRules, dressCode);

  return candidates
    .map((candidate) => {
      const unlock_count =
        countRoleCompleteCombos(
          [...garments, toSyntheticGarment(candidate.synthetic)],
          styleRules,
          dressCode
        ) - baseline;
      return {
        id: candidate.id,
        label: candidate.label,
        source: candidate.source,
        unlock_count,
        reasoning: `Adds ${unlock_count} outfit${unlock_count === 1 ? "" : "s"} by filling ${candidate.synthetic.category}.`
      };
    })
    .filter((score) => score.unlock_count > 0)
    .sort((a, b) => b.unlock_count - a.unlock_count)
    .slice(0, 3);
}
