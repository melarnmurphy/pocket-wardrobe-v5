import type { OutfitItemRole } from "@/lib/domain/outfits";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import type { GeneratedOutfit, FiredRule, OutfitGarmentPreview } from "@/lib/domain/outfits";

const ROLE_KEYWORDS: Array<[OutfitItemRole, string[]]> = [
  ["dress",     ["dress", "jumpsuit", "playsuit"]],
  ["top",       ["shirt", "blouse", "top", "tee", "t-shirt", "knitwear", "jumper", "sweater", "cardigan", "turtleneck", "tank", "bodysuit", "crop"]],
  ["bottom",    ["trouser", "jean", "skirt", "short", "chino", "legging", "pant"]],
  ["outerwear", ["coat", "jacket", "blazer", "waistcoat", "vest", "puffer", "trench", "anorak", "mac"]],
  ["shoes",     ["shoe", "boot", "trainer", "sandal", "loafer", "heel", "flat", "mule", "sneaker"]],
  ["bag",       ["bag", "handbag", "clutch", "tote", "backpack", "purse"]],
  ["accessory", ["scarf", "belt", "hat", "cap", "glove", "sunglasses", "tie", "watch"]],
  ["jewellery", ["necklace", "ring", "earring", "bracelet", "pendant", "chain"]],
];

export function categoryToRole(category: string): OutfitItemRole {
  const lower = category.toLowerCase();
  for (const [role, keywords] of ROLE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return role;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Rules engine types & helpers
// ---------------------------------------------------------------------------

// Internal augmented type: StyleRuleListItem doesn't expose constraint_type in
// its public schema, but DB rows carry the column. We cast locally where needed.
type RuleWithConstraint = StyleRuleListItem & { constraint_type?: string };

const OPTIONAL_ROLES: OutfitItemRole[] = ["outerwear", "shoes", "accessory", "bag", "jewellery"];
const OPTIONAL_ROLE_THRESHOLD = 0.2;
const RECENCY_PENALTY = 0.3;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type GeneratorInput = {
  mode: "plan" | "surprise" | "trend";
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  trendSignal: UserTrendMatchWithSignal | null;
  dress_code?: string;
  weather?: string;
  occasion?: string;
};

type ScoringContext = {
  dress_code?: string | null;
  weather?: string | null;
  occasion?: string | null;
};

/** Remove garments blocked by hard constraint rules for the given dress code. */
export function applyHardFilters(
  garments: GarmentListItem[],
  rules: StyleRuleListItem[],
  dress_code: string | undefined
): GarmentListItem[] {
  if (!dress_code) return garments;
  const hardAvoid = (rules as RuleWithConstraint[]).filter(
    r => r.constraint_type === "hard" && r.predicate === "avoid_with" && r.object_value === dress_code
  );
  if (hardAvoid.length === 0) return garments;
  return garments.filter(g => {
    const cat = g.category.toLowerCase();
    return !hardAvoid.some(r => cat.includes(r.subject_value.toLowerCase()));
  });
}

/** Score a single garment against soft rules for the given context. */
export function scoreGarment(
  garment: GarmentListItem,
  rules: StyleRuleListItem[],
  ctx: ScoringContext
): number {
  const cat = garment.category.toLowerCase();
  let score = 0;
  for (const rule of rules as RuleWithConstraint[]) {
    if (rule.constraint_type !== "soft" || !rule.active) continue;
    if (!cat.includes(rule.subject_value.toLowerCase())) continue;
    if (rule.predicate === "appropriate_for" || rule.predicate === "occasion_fit") {
      if (ctx.dress_code && rule.object_value === ctx.dress_code) score += rule.weight;
      else if (ctx.occasion && rule.object_value === ctx.occasion) score += rule.weight;
    } else if (rule.predicate === "works_in_weather") {
      if (ctx.weather && rule.object_value === ctx.weather) score += rule.weight;
    } else if (rule.predicate === "works_in_season") {
      score += rule.weight * 0.5;
    } else {
      score += rule.weight * 0.3;
    }
  }
  return score;
}

/** Apply trend boost: garments matching the trend signal's normalized_attributes get a multiplier. */
export function applyTrendBoost(score: number, garment: GarmentListItem, signal: UserTrendMatchWithSignal): number {
  const attrs = signal.trend_signal.normalized_attributes_json as Record<string, unknown>;
  const cat = garment.category.toLowerCase();
  const category = typeof attrs["category"] === "string" ? attrs["category"].toLowerCase() : null;
  const requiredCats = Array.isArray(attrs["required_categories"])
    ? (attrs["required_categories"] as string[]).map(c => c.toLowerCase())
    : null;
  if (category && cat.includes(category)) return score * (1 + signal.score);
  if (requiredCats && requiredCats.some(c => cat.includes(c))) return score * (1 + signal.score * 0.5);
  return score;
}

/** Main entry point: generate an outfit from wardrobe + rules + input. */
export function generateOutfit(input: GeneratorInput): GeneratedOutfit {
  const { mode, garments, styleRules, trendSignal, dress_code, weather, occasion } = input;
  const ctx: ScoringContext = { dress_code, weather, occasion };

  // Hard filter
  const eligible = applyHardFilters(garments, styleRules, dress_code);

  // Group by role
  const byRole = new Map<OutfitItemRole, GarmentListItem[]>();
  for (const g of eligible) {
    const role = categoryToRole(g.category);
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(g);
  }

  const now = Date.now();
  const selectedGarments: OutfitGarmentPreview[] = [];
  const firedRules: FiredRule[] = [];

  for (const [role, candidates] of byRole) {
    if (candidates.length === 0) continue;

    // Score each candidate
    const scored = candidates.map(g => {
      let score = scoreGarment(g, styleRules, ctx);
      if (mode === "surprise" && g.last_worn_at) {
        const wornAt = new Date(g.last_worn_at).getTime();
        if (now - wornAt < RECENCY_WINDOW_MS) score -= RECENCY_PENALTY;
      }
      if (mode === "trend" && trendSignal) {
        score = applyTrendBoost(score, g, trendSignal);
      }
      return { garment: g, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Omit optional roles below threshold
    if (OPTIONAL_ROLES.includes(role) && best.score < OPTIONAL_ROLE_THRESHOLD) continue;

    const g = best.garment;
    selectedGarments.push({
      id: g.id as string,
      title: g.title ?? null,
      category: g.category,
      role,
      preview_url: g.preview_url ?? null
    });

    // Collect fired rules for this garment
    const fired = (styleRules as RuleWithConstraint[]).filter(r => {
      if (r.constraint_type !== "soft" || !r.active) return false;
      return g.category.toLowerCase().includes(r.subject_value.toLowerCase());
    });
    for (const r of fired) {
      firedRules.push({ description: r.explanation || r.predicate, garment_ids: [g.id as string] });
    }
  }

  return { garments: selectedGarments, firedRules, explanation: null };
}
