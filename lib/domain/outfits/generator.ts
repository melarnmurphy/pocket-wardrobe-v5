import type { OutfitItemRole } from "@/lib/domain/outfits";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import type {
  GeneratedOutfit,
  FiredRule,
  OutfitGarmentPreview,
  OutfitInsight
} from "@/lib/domain/outfits";
import { expandRulesWithAttributeInference } from "@/lib/domain/style-rules/inference";
import { inferColourFamilyFromText } from "@/lib/domain/style-rules/knowledge/colours";

const ROLE_KEYWORDS: Array<[OutfitItemRole, string[]]> = [
  ["dress",     ["dress", "jumpsuit", "playsuit"]],
  ["top",       ["shirt", "blouse", "top", "tee", "t-shirt", "jumper", "sweater", "turtleneck", "tank", "bodysuit", "crop"]],
  ["bottom",    ["trouser", "jean", "skirt", "short", "chino", "legging", "pant"]],
  ["outerwear", ["coat", "jacket", "blazer", "waistcoat", "vest", "puffer", "trench", "anorak", "mac", "cardigan", "cardi", "knitwear", "knit"]],
  ["shoes",     ["shoe", "boot", "trainer", "sandal", "loafer", "heel", "flat", "mule", "sneaker"]],
  ["bag",       ["bag", "handbag", "clutch", "tote", "backpack", "purse"]],
  ["accessory", ["scarf", "belt", "hat", "cap", "glove", "sunglasses", "tie", "watch"]],
  ["jewellery", ["necklace", "ring", "earring", "bracelet", "pendant", "chain"]],
];

export function categoryToRole(
  category: string,
  subcategory?: string | null,
  title?: string | null
): OutfitItemRole {
  const lower = [category, subcategory, title].filter(Boolean).join(" ").toLowerCase();
  for (const [role, keywords] of ROLE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return role;
  }
  return "other";
}

function isLayeringGarment(
  garment: Pick<GarmentListItem, "category" | "subcategory" | "title">
) {
  const haystack = [garment.category, garment.subcategory, garment.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["cardigan", "cardi", "knitwear", "knit", "waistcoat", "vest", "blazer"].some((term) =>
    haystack.includes(term)
  );
}

export function formatOutfitRoleLabel(
  garment: Pick<OutfitGarmentPreview, "role" | "category" | "title">
) {
  if (garment.role === "outerwear" && isLayeringGarment(garment)) {
    return "Layer";
  }

  if (garment.role === "other") {
    return "Piece";
  }

  return garment.role;
}

function containsCategoryPattern(text: string, pattern: string) {
  const regex = new RegExp(`\\b${pattern.replace(/[-/ ]+/g, "[-/ ]")}\\b`, "i");
  return regex.test(text);
}

function getGarmentCategorySignals(
  garment: Pick<GarmentListItem, "category" | "subcategory" | "title">
) {
  const haystack = [garment.category, garment.subcategory, garment.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const signals = new Set<string>();

  if (garment.category) {
    signals.add(garment.category.toLowerCase());
  }

  for (const [signal, patterns] of CATEGORY_SIGNAL_PATTERNS) {
    if (patterns.some((pattern) => containsCategoryPattern(haystack, pattern))) {
      signals.add(signal);
    }
  }

  return signals;
}

function garmentMatchesCategoryValue(
  garment: Pick<GarmentListItem, "category" | "subcategory" | "title">,
  value: string
) {
  const normalizedValue = value.toLowerCase();
  const signals = getGarmentCategorySignals(garment);

  if (normalizedValue === "shirt" && signals.has("t-shirt")) {
    return false;
  }

  return signals.has(normalizedValue);
}

function describeLayeringSubject(
  garment: Pick<GarmentListItem, "fit" | "category" | "subcategory" | "title">,
  fallback: string
) {
  const normalizedFallback = fallback.toLowerCase();
  const fit = garment.fit?.toLowerCase() ?? null;

  if (fit === "fitted" && normalizedFallback === "t-shirt") {
    return "fitted t-shirt";
  }

  if (fit === "fitted" && normalizedFallback === "shirt") {
    return "fitted shirt";
  }

  return fallback;
}

function customizeLayeringExplanation(
  rule: Pick<RuleWithConstraint, "subject_value" | "object_value" | "explanation" | "predicate">,
  subjectGarment: Pick<GarmentListItem, "fit" | "category" | "subcategory" | "title">
) {
  const base = rule.explanation || rule.predicate;
  const subjectLabel = describeLayeringSubject(subjectGarment, rule.subject_value);
  const replacement = `A ${subjectLabel} under a ${rule.object_value}`;

  return base.replace(
    new RegExp(`^A\\s+${rule.subject_value}\\s+under\\s+a\\s+${rule.object_value}`, "i"),
    replacement
  );
}

function getGarmentColourFamily(
  garment: Pick<GarmentListItem, "primary_colour_family" | "title" | "category" | "subcategory">
) {
  if (garment.primary_colour_family) {
    return garment.primary_colour_family.toLowerCase();
  }

  return inferColourFamilyFromText(
    [garment.title, garment.subcategory, garment.category].filter(Boolean).join(" ")
  );
}

function getGarmentColourDescriptor(
  garment: Pick<GarmentListItem, "title" | "category" | "subcategory">
) {
  return [garment.title, garment.subcategory, garment.category].filter(Boolean).join(" ").toLowerCase();
}

function isNavyLikeGarment(
  garment: Pick<
    GarmentListItem,
    "primary_colour_family" | "primary_colour_hex" | "title" | "category" | "subcategory"
  >
) {
  if (getGarmentColourFamily(garment) !== "blue") {
    return false;
  }

  const descriptor = getGarmentColourDescriptor(garment);
  if (/\b(navy|midnight|marine|ink|deep blue)\b/i.test(descriptor)) {
    return true;
  }

  const luminance = getHexRelativeLuminance(garment.primary_colour_hex);
  return luminance !== null && luminance < 0.16;
}

function getHexRelativeLuminance(hex: string | null | undefined) {
  const normalized = (hex ?? "").trim();
  const match = normalized.match(/^#?([0-9a-f]{6})$/i);

  if (!match) {
    return null;
  }

  const value = match[1];
  const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );

  const [r, g, b] = linear;
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function getDarkPairContrast(
  left: Pick<GarmentListItem, "primary_colour_hex">,
  right: Pick<GarmentListItem, "primary_colour_hex">
) {
  const leftLum = getHexRelativeLuminance(left.primary_colour_hex);
  const rightLum = getHexRelativeLuminance(right.primary_colour_hex);

  if (leftLum === null || rightLum === null) {
    return null;
  }

  return Math.abs(leftLum - rightLum);
}

function collectDarkTonalColourRules(garments: GarmentListItem[]): FiredRule[] {
  const firedRules: FiredRule[] = [];
  const firedRuleKeys = new Set<string>();
  const blackGarments = garments.filter((garment) => getGarmentColourFamily(garment) === "black");
  const navyGarments = garments.filter((garment) => isNavyLikeGarment(garment));

  for (const blackGarment of blackGarments) {
    for (const navyGarment of navyGarments) {
      if (blackGarment.id === navyGarment.id) {
        continue;
      }

      const garmentIds = [blackGarment.id as string, navyGarment.id as string].sort();
      const contrast = getDarkPairContrast(blackGarment, navyGarment);
      const description =
        contrast !== null && contrast < 0.03
          ? "Navy and black are both very dark here, so the pairing needs texture or a clearer shade break to avoid reading accidental."
          : "Navy and black read as an intentional dark-neutral pairing when the contrast is visible.";
      const key = `${description}:${garmentIds.join(":")}`;

      if (firedRuleKeys.has(key)) {
        continue;
      }

      firedRuleKeys.add(key);
      firedRules.push({
        description,
        garment_ids: garmentIds
      });
    }
  }

  return firedRules;
}

export function collectColourFiredRules(
  garments: GarmentListItem[],
  rules: StyleRuleListItem[]
): FiredRule[] {
  const firedRules: FiredRule[] = [];
  const firedRuleKeys = new Set<string>();

  for (const rule of rules as RuleWithConstraint[]) {
    if (rule.constraint_type !== "soft" || rule.active === false) continue;
    if (
      !(
        (rule.subject_type === "colour" || rule.subject_type === "colour_family") &&
        (rule.object_type === "colour" || rule.object_type === "colour_family") &&
        ["pairs_with", "grounds", "grounded_by"].includes(rule.predicate)
      )
    ) {
      continue;
    }

    for (let leftIndex = 0; leftIndex < garments.length; leftIndex += 1) {
      const leftGarment = garments[leftIndex];
      const leftColour = getGarmentColourFamily(leftGarment);
      if (!leftColour || leftColour !== rule.subject_value.toLowerCase()) continue;

      for (let rightIndex = 0; rightIndex < garments.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;

        const rightGarment = garments[rightIndex];
        const rightColour = getGarmentColourFamily(rightGarment);
        if (!rightColour || rightColour !== rule.object_value.toLowerCase()) continue;

        const garmentIds = [leftGarment.id as string, rightGarment.id as string].sort();
        const key = `${rule.explanation || rule.predicate}:${garmentIds.join(":")}`;
        if (firedRuleKeys.has(key)) continue;

        firedRuleKeys.add(key);
        firedRules.push({
          description: rule.explanation || rule.predicate,
          garment_ids: garmentIds
        });
      }
    }
  }

  return firedRules;
}

function buildOutfitInsights(params: {
  firedRules: FiredRule[];
  garments: GarmentListItem[];
  ctx: ScoringContext;
}): OutfitInsight[] {
  const { firedRules, garments, ctx } = params;
  const descriptions = firedRules.map((rule) => rule.description);
  const insights: OutfitInsight[] = [];

  const paletteRules = descriptions.filter((description) =>
    /neutral anchor|triadic|analogous|contrast|pairing|stabilizes|grounds/i.test(description)
  );
  if (paletteRules.length) {
    const hasNeutralAnchor = paletteRules.some((description) => /neutral anchor|grounds/i.test(description));
    const hasTriadic = paletteRules.some((description) => /triadic/i.test(description));
    const hasDarkTonalCaution = paletteRules.some((description) => /too close|clearer shade break|accidental/i.test(description));
    const hasDarkTonalApproval = paletteRules.some((description) => /dark-neutral pairing|contrast is visible/i.test(description));

    insights.push({
      key: "palette",
      title: "Palette Balance",
      body: hasDarkTonalCaution
        ? "This dark pairing is viable, but the navy and black are sitting very close together. It will look better when texture, sheen, or a clearer shade break makes the contrast feel intentional."
        : hasDarkTonalApproval
          ? "Navy and black are working here because the dark tones are still visibly distinct, so the combination reads polished instead of accidental."
          : hasNeutralAnchor && hasTriadic
            ? "The stronger colours are not carrying equal weight: the dark neutral is grounding the outfit, while the brighter colour pairing stays deliberate instead of loud."
            : hasNeutralAnchor
              ? "A dark neutral is stabilizing the stronger tones, which keeps the palette clean and intentional."
              : "The colour relationships are supporting each other rather than competing for equal attention.",
      tags: paletteRules
    });
  }

  const layeringRules = descriptions.filter((description) =>
    /layer|under a|cardigan|blazer|coat|waistcoat|knit/i.test(description)
  );
  if (layeringRules.length) {
    insights.push({
      key: "layering",
      title: "Layering",
      body: "The silhouette works because the base stays lean and the added layer gives the outfit shape without making it feel bulky.",
      tags: layeringRules
    });
  }

  const weatherRules = descriptions.filter((description) =>
    /weather|rain|cold|warm|breeze|sun|temperature/i.test(description)
  );
  if (ctx.weather || weatherRules.length) {
    insights.push({
      key: "weather",
      title: "Weather Fit",
      body: weatherRules.length
        ? "The selected pieces line up with the current weather context, so the outfit reads practical as well as styled."
        : "The outfit is being shaped against the selected weather profile, even if no explicit weather rule fired.",
      tags: weatherRules
    });
  }

  const occasionRules = descriptions.filter((description) =>
    /appropriate|occasion|dress code|formal|casual|workwear|smart/i.test(description)
  );
  if (ctx.occasion || ctx.dress_code || occasionRules.length) {
    insights.push({
      key: "occasion",
      title: "Occasion Fit",
      body: occasionRules.length
        ? "The outfit aligns with the requested occasion and polish level rather than looking like a purely visual match."
        : "The generator is still respecting the requested occasion and dress-code context.",
      tags: occasionRules
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Rules engine types & helpers
// ---------------------------------------------------------------------------

// Internal augmented type: StyleRuleListItem's public Zod schema includes
// constraint_type as an optional field (added by migration 005, types not yet
// regenerated). The select in listStyleRules fetches the column explicitly, so
// it is present on runtime objects even though TypeScript's database.ts doesn't
// list it. The cast here is therefore safe: the field is fetched, just not
// reflected in the generated types yet.
type RuleWithConstraint = StyleRuleListItem & { constraint_type?: string };

const OPTIONAL_ROLES: OutfitItemRole[] = ["outerwear", "shoes", "accessory", "bag", "jewellery"];
const OPTIONAL_ROLE_THRESHOLD = 0.2;
const RECENCY_PENALTY = 0.3;
const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CATEGORY_SIGNAL_PATTERNS: Array<[string, string[]]> = [
  ["t-shirt", ["t-shirt", "tee", "longsleeve tee", "long sleeve tee"]],
  ["shirt", ["shirt", "button-down", "button down", "oxford"]],
  ["cardigan", ["cardigan", "cardi"]],
  ["knitwear", ["knitwear", "knit", "jumper", "sweater", "cardigan", "cardi"]],
  ["blazer", ["blazer"]],
  ["waistcoat", ["waistcoat"]],
  ["jacket", ["jacket"]],
  ["coat", ["coat"]],
  ["turtleneck", ["turtleneck"]],
  ["tank", ["tank", "cami"]],
  ["vest", ["vest"]],
  ["bodysuit", ["bodysuit"]],
  ["dress", ["dress"]],
  ["denim jacket", ["denim jacket"]],
  ["base-layer", ["base layer", "baselayer"]]
];

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
  let score = 0;
  for (const rule of rules as RuleWithConstraint[]) {
    if (rule.constraint_type !== "soft" || !rule.active) continue;
    const subjectMatch =
      rule.subject_type === "category" &&
      garmentMatchesCategoryValue(garment, rule.subject_value);
    const isLayeringObj =
      rule.predicate === "layerable_with" &&
      garmentMatchesCategoryValue(garment, rule.object_value);
    if (!subjectMatch && !isLayeringObj) continue;
    if (rule.predicate === "appropriate_for" || rule.predicate === "occasion_fit") {
      if (subjectMatch) {
        if (ctx.dress_code && rule.object_value === ctx.dress_code) score += rule.weight;
        else if (ctx.occasion && rule.object_value === ctx.occasion) score += rule.weight;
      }
    } else if (rule.predicate === "works_in_weather") {
      if (subjectMatch) {
        if (ctx.weather && rule.object_value === ctx.weather) score += rule.weight;
      }
    } else if (rule.predicate === "works_in_season") {
      if (subjectMatch) score += rule.weight * 0.5;
    } else {
      if (subjectMatch) score += rule.weight * 0.3;
      else if (isLayeringObj) score += rule.weight * 0.15;
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

  const expandedRules = expandRulesWithAttributeInference(styleRules);

  // Hard filter (uses original styleRules — inference only adds soft rules)
  const eligible = applyHardFilters(garments, styleRules, dress_code);

  // Group by role
  const byRole = new Map<OutfitItemRole, GarmentListItem[]>();
  for (const g of eligible) {
    const role = categoryToRole(g.category, g.subcategory, g.title);
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(g);
  }

  const now = Date.now();
  const selectedGarments: OutfitGarmentPreview[] = [];
  const selectedFullGarments: GarmentListItem[] = [];
  const firedRules: FiredRule[] = [];

  for (const [role, candidates] of byRole) {
    if (candidates.length === 0) continue;

    // Score each candidate
    const scored = candidates.map(g => {
      let score = scoreGarment(g, expandedRules, ctx);
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
    if (
      OPTIONAL_ROLES.includes(role) &&
      best.score < OPTIONAL_ROLE_THRESHOLD &&
      !(role === "outerwear" && isLayeringGarment(best.garment))
    ) continue;

    const g = best.garment;
    selectedGarments.push({
      id: g.id as string,
      title: g.title ?? null,
      category: g.category,
      role,
      preview_url: g.preview_url ?? null
    });
    selectedFullGarments.push(g);
  }

  const firedRuleKeys = new Set<string>();

  for (const rule of expandedRules as RuleWithConstraint[]) {
    if (rule.constraint_type !== "soft" || rule.active === false) continue;
    if (rule.id?.startsWith("inferred:")) continue;

    if (
      rule.subject_type === "category" &&
      rule.predicate === "layerable_with"
    ) {
      const subjectGarments = selectedFullGarments.filter((garment) =>
        garmentMatchesCategoryValue(garment, rule.subject_value)
      );
      const objectGarments = selectedFullGarments.filter((garment) =>
        garmentMatchesCategoryValue(garment, rule.object_value)
      );

      for (const subjectGarment of subjectGarments) {
        for (const objectGarment of objectGarments) {
          if (subjectGarment.id === objectGarment.id) continue;

          const garmentIds = [subjectGarment.id as string, objectGarment.id as string].sort();
          const key = `${rule.explanation || rule.predicate}:${garmentIds.join(":")}`;
          if (firedRuleKeys.has(key)) continue;

          firedRuleKeys.add(key);
          firedRules.push({
            description: customizeLayeringExplanation(rule, subjectGarment),
            garment_ids: garmentIds
          });
        }
      }

      continue;
    }

    if (
      rule.subject_type === "category" &&
      (rule.predicate === "appropriate_for" || rule.predicate === "occasion_fit")
    ) {
      const contextValue = ctx.dress_code || ctx.occasion;
      if (!contextValue || rule.object_value !== contextValue) continue;

      for (const garment of selectedFullGarments) {
        if (!garmentMatchesCategoryValue(garment, rule.subject_value)) continue;

        const key = `${rule.explanation || rule.predicate}:${garment.id}`;
        if (firedRuleKeys.has(key)) continue;

        firedRuleKeys.add(key);
        firedRules.push({
          description: rule.explanation || rule.predicate,
          garment_ids: [garment.id as string]
        });
      }

      continue;
    }

    if (
      rule.subject_type === "category" &&
      rule.predicate === "works_in_weather" &&
      ctx.weather &&
      rule.object_value === ctx.weather
    ) {
      for (const garment of selectedFullGarments) {
        if (!garmentMatchesCategoryValue(garment, rule.subject_value)) continue;

        const key = `${rule.explanation || rule.predicate}:${garment.id}`;
        if (firedRuleKeys.has(key)) continue;

        firedRuleKeys.add(key);
        firedRules.push({
          description: rule.explanation || rule.predicate,
          garment_ids: [garment.id as string]
        });
      }
    }

  }

  for (const colourRule of collectColourFiredRules(selectedFullGarments, expandedRules)) {
    const key = `${colourRule.description}:${colourRule.garment_ids.join(":")}`;
    if (firedRuleKeys.has(key)) continue;
    firedRuleKeys.add(key);
    firedRules.push(colourRule);
  }

  for (const tonalRule of collectDarkTonalColourRules(selectedFullGarments)) {
    const key = `${tonalRule.description}:${tonalRule.garment_ids.join(":")}`;
    if (firedRuleKeys.has(key)) continue;
    firedRuleKeys.add(key);
    firedRules.push(tonalRule);
  }

  return {
    garments: selectedGarments,
    firedRules,
    insights: buildOutfitInsights({ firedRules, garments: selectedFullGarments, ctx }),
    explanation: null
  };
}
