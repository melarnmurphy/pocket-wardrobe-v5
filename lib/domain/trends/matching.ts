import type { TrendSignalWithColour, TrendMatchReasoning, UserTrendMatch } from "./index";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import { rankExamplesForUser, type RankedExample } from "./entities";
import {
  enrichRecipePiece,
  extractRecipePieces,
  extractRequiredCategories,
  garmentCoversRecipeCategory,
  garmentCoversRecipePiece,
  RECIPE_WARDROBE_CATEGORIES,
  type RecipeWardrobeCategory
} from "./styling-recipe";

export { canonicalizeLabel } from "./labels";

export function computeRecencyWeight(lastSeenAt: string | null | undefined): number {
  if (!lastSeenAt) return 1.0;
  const daysSince = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 0) return 1.0;
  if (daysSince >= 90) return 0.5;
  return 1.0 - (daysSince / 90) * 0.5;
}

export function computeAttributeOverlap(
  signalAttrs: Record<string, unknown>,
  garmentAttrs: Record<string, unknown>
): number {
  const keys = Object.keys(signalAttrs);
  if (keys.length === 0) return 0;
  const matches = keys.filter(
    (k) => garmentAttrs[k] !== undefined && garmentAttrs[k] === signalAttrs[k]
  );
  return matches.length / keys.length;
}

interface MatchInput {
  signals: TrendSignalWithColour[];
  garments: GarmentListItem[];
  compatibleColourFamilies: Map<string, Set<string>>;
  userLocation?: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeBaseScore(signal: TrendSignalWithColour, overlapRatio: number): number {
  const recency = computeRecencyWeight(signal.last_seen_at ?? null);
  return overlapRatio * (signal.confidence_score ?? 0.7) * (signal.authority_score ?? 0.7) * recency;
}

function matchColourSignal(
  signal: TrendSignalWithColour,
  garments: GarmentListItem[],
  compatibleColourFamilies: Map<string, Set<string>>
): UserTrendMatch {
  const attrs = signal.normalized_attributes_json as { family?: string };
  const trendFamily = attrs.family ?? null;

  if (!trendFamily) {
    return buildMissingPiece(signal, [], "No colour family specified in signal");
  }

  const exactGarments = garments.filter((g) => g.primary_colour_family === trendFamily);
  if (exactGarments.length > 0) {
    const score = clamp(computeBaseScore(signal, 1.0), 0.85, 1.0);
    return buildMatch(signal, "exact_match", score, {
      signal_label: signal.label,
      match_reason: `You own garments in ${trendFamily}`,
      matched_garment_ids: exactGarments.map((g) => g.id as string),
      attributes_matched: ["colour_family"],
      attributes_adjacent: []
    });
  }

  const compatibleFamilies = compatibleColourFamilies.get(trendFamily) ?? new Set<string>();
  const adjacentGarments = garments.filter(
    (g) => g.primary_colour_family && compatibleFamilies.has(g.primary_colour_family)
  );
  if (adjacentGarments.length > 0) {
    const score = clamp(computeBaseScore(signal, 0.65), 0.5, 0.84);
    return buildMatch(signal, "adjacent_match", score, {
      signal_label: signal.label,
      match_reason: `You own garments in a compatible colour (${adjacentGarments[0].primary_colour_family})`,
      matched_garment_ids: adjacentGarments.map((g) => g.id as string),
      attributes_matched: [],
      attributes_adjacent: ["colour_family"]
    });
  }

  return buildMissingPiece(signal, [], `No garments found in ${trendFamily} or compatible colours`);
}

function matchGarmentSignal(
  signal: TrendSignalWithColour,
  garments: GarmentListItem[]
): UserTrendMatch {
  const attrs = signal.normalized_attributes_json as Record<string, unknown>;
  const category =
    typeof attrs.category === "string" &&
    RECIPE_WARDROBE_CATEGORIES.includes(attrs.category as RecipeWardrobeCategory)
      ? (attrs.category as RecipeWardrobeCategory)
      : null;
  const piece = enrichRecipePiece({
    piece: signal.label,
    category,
    last: typeof attrs.last === "string" ? attrs.last : null,
    vibe: typeof attrs.vibe === "string" ? attrs.vibe : null,
    silhouette: typeof attrs.silhouette === "string" ? attrs.silhouette : null,
    closure: typeof attrs.closure === "string" ? attrs.closure : null,
    hem: typeof attrs.hem === "string" ? attrs.hem : null,
    archetype: typeof attrs.archetype === "string" ? attrs.archetype : null
  });

  if (piece.last || piece.archetype || piece.vibe || piece.closure) {
    const covering = garments.filter((g) => garmentCoversRecipePiece(g, piece));
    if (covering.length === 0) {
      return buildMissingPiece(signal, [], `No ${piece.piece} in the wardrobe`);
    }
    return buildMatch(signal, "exact_match", clamp(computeBaseScore(signal, 1), 0.85, 1.0), {
      signal_label: signal.label,
      match_reason: `You own a ${piece.piece}`,
      matched_garment_ids: covering.map((g) => g.id as string),
      attributes_matched: [piece.last ?? piece.archetype ?? "piece"],
      attributes_adjacent: []
    });
  }

  const attrRecord = attrs as {
    category?: string;
    subcategory?: string;
    fit?: string;
    material?: string;
  };

  const signalAttrs: Record<string, unknown> = {
    ...(attrRecord.category ? { category: attrRecord.category } : {}),
    ...(attrRecord.subcategory ? { subcategory: attrRecord.subcategory } : {}),
    ...(attrRecord.fit ? { fit: attrRecord.fit } : {}),
    ...(attrRecord.material ? { material: attrRecord.material } : {})
  };

  const toGarmentAttrs = (g: GarmentListItem): Record<string, unknown> => ({
    ...(attrRecord.category !== undefined ? { category: g.category } : {}),
    ...(attrRecord.subcategory !== undefined ? { subcategory: g.subcategory ?? undefined } : {}),
    ...(attrRecord.fit !== undefined ? { fit: g.fit ?? undefined } : {}),
    ...(attrRecord.material !== undefined ? { material: g.material ?? undefined } : {})
  });

  let bestGarment: GarmentListItem | null = null;
  let bestOverlap = 0;

  for (const g of garments) {
    const overlap = computeAttributeOverlap(signalAttrs, toGarmentAttrs(g));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestGarment = g;
    }
  }

  if (!bestGarment || bestOverlap === 0) {
    return buildMissingPiece(signal, [], `No garments found matching ${signal.label}`);
  }

  const garmentAttrs = toGarmentAttrs(bestGarment);
  const matchedKeys = Object.keys(signalAttrs).filter((k) => garmentAttrs[k] === signalAttrs[k]);
  const adjacentKeys = Object.keys(signalAttrs).filter((k) => garmentAttrs[k] !== signalAttrs[k]);

  if (bestOverlap >= 0.85) {
    return buildMatch(signal, "exact_match", clamp(computeBaseScore(signal, bestOverlap), 0.85, 1.0), {
      signal_label: signal.label,
      match_reason: `You own ${bestGarment.title ?? bestGarment.category}`,
      matched_garment_ids: [bestGarment.id as string],
      attributes_matched: matchedKeys,
      attributes_adjacent: adjacentKeys
    });
  }

  return buildMatch(signal, "adjacent_match", clamp(computeBaseScore(signal, bestOverlap), 0.5, 0.84), {
    signal_label: signal.label,
    match_reason: `You own a similar item (${bestGarment.title ?? bestGarment.category})`,
    matched_garment_ids: [bestGarment.id as string],
    attributes_matched: matchedKeys,
    attributes_adjacent: adjacentKeys
  });
}

function matchStylingSignal(
  signal: TrendSignalWithColour,
  garments: GarmentListItem[]
): UserTrendMatch {
  const attrs = signal.normalized_attributes_json as Record<string, unknown>;
  const pieces = extractRecipePieces(attrs).filter((piece) => piece.category);

  if (pieces.length >= 2) {
    const missingPieces = pieces.filter(
      (piece) => !garments.some((g) => garmentCoversRecipePiece(g, piece))
    );
    if (missingPieces.length > 0) {
      return buildMissingPiece(
        signal,
        [],
        `Missing ${missingPieces.map((piece) => piece.piece).join(", ")}`
      );
    }
    const matchedIds = pieces.flatMap((piece) =>
      garments.filter((g) => garmentCoversRecipePiece(g, piece)).map((g) => g.id as string)
    );
    return buildMatch(signal, "styling_match", clamp(computeBaseScore(signal, 1), 0.6, 0.8), {
      signal_label: signal.label,
      match_reason: `Your wardrobe covers ${pieces.map((piece) => piece.piece).join(" + ")}`,
      matched_garment_ids: [...new Set(matchedIds)],
      attributes_matched: pieces.map((piece) => piece.last ?? piece.category ?? piece.piece),
      attributes_adjacent: []
    });
  }

  const required = extractRequiredCategories(attrs);

  if (required.length === 0) {
    return buildMissingPiece(signal, [], "No pairing categories defined in signal");
  }

  const covered = required.filter((cat) =>
    garments.some((g) => garmentCoversRecipeCategory(g, cat))
  );
  const missing = required.filter((cat) => !covered.includes(cat));

  if (missing.length > 0) {
    return buildMissingPiece(signal, [], `Missing categories: ${missing.join(", ")}`);
  }

  const overlapRatio = covered.length / required.length;
  const score = clamp(computeBaseScore(signal, overlapRatio), 0.6, 0.8);
  const matchedIds = required.flatMap((cat) =>
    garments
      .filter((g) => garmentCoversRecipeCategory(g, cat))
      .map((g) => g.id as string)
  );

  return buildMatch(signal, "styling_match", score, {
    signal_label: signal.label,
    match_reason: `Your wardrobe covers the required pieces for ${signal.label}`,
    matched_garment_ids: matchedIds,
    attributes_matched: covered,
    attributes_adjacent: []
  });
}

function matchGenericSignal(
  signal: TrendSignalWithColour,
  garments: GarmentListItem[]
): UserTrendMatch {
  const attrs = signal.normalized_attributes_json as Record<string, unknown>;
  const relevantFields: Record<string, (g: GarmentListItem) => unknown> = {
    material: (g) => g.material,
    pattern: (g) => g.pattern,
    fit: (g) => g.fit,
    formality: (g) => g.formality_level,
    dress_code: (g) => g.formality_level,
    category: (g) => g.category
  };

  const signalAttrs: Record<string, unknown> = {};
  for (const key of Object.keys(attrs)) {
    if (key in relevantFields && typeof attrs[key] === "string") {
      signalAttrs[key] = attrs[key];
    }
  }

  if (Object.keys(signalAttrs).length === 0) {
    return buildMissingPiece(signal, [], "No matchable attributes in signal");
  }

  let bestGarment: GarmentListItem | null = null;
  let bestOverlap = 0;

  for (const g of garments) {
    const garmentAttrs: Record<string, unknown> = {};
    for (const key of Object.keys(signalAttrs)) {
      if (key in relevantFields) garmentAttrs[key] = relevantFields[key](g);
    }
    const overlap = computeAttributeOverlap(signalAttrs, garmentAttrs);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestGarment = g;
    }
  }

  if (!bestGarment || bestOverlap === 0) {
    return buildMissingPiece(signal, [], "No garments matched signal attributes");
  }

  if (bestOverlap >= 0.85) {
    return buildMatch(signal, "exact_match", clamp(computeBaseScore(signal, bestOverlap), 0.85, 1.0), {
      signal_label: signal.label,
      match_reason: `Your ${bestGarment.title ?? bestGarment.category} matches this trend`,
      matched_garment_ids: [bestGarment.id as string],
      attributes_matched: Object.keys(signalAttrs),
      attributes_adjacent: []
    });
  }

  return buildMatch(signal, "adjacent_match", clamp(computeBaseScore(signal, bestOverlap), 0.5, 0.84), {
    signal_label: signal.label,
    match_reason: "Your wardrobe partially matches this trend",
    matched_garment_ids: [bestGarment.id as string],
    attributes_matched: [],
    attributes_adjacent: Object.keys(signalAttrs)
  });
}

function buildMissingPiece(
  signal: TrendSignalWithColour,
  matchedIds: string[],
  reason: string
): UserTrendMatch {
  const score = clamp(
    (signal.authority_score ?? 0.5) *
      (signal.confidence_score ?? 0.5) *
      computeRecencyWeight(signal.last_seen_at ?? null),
    0,
    0.4
  );
  return buildMatch(signal, "missing_piece", score, {
    signal_label: signal.label,
    match_reason: reason,
    matched_garment_ids: matchedIds,
    attributes_matched: [],
    attributes_adjacent: []
  });
}

function buildMatch(
  signal: TrendSignalWithColour,
  matchType: UserTrendMatch["match_type"],
  score: number,
  reasoning: TrendMatchReasoning
): UserTrendMatch {
  return {
    user_id: "",
    trend_signal_id: signal.id!,
    match_type: matchType,
    score: Math.round(score * 100) / 100,
    reasoning_json: reasoning as unknown as Record<string, unknown>
  };
}

export function trendSectionOrder(): Array<
  "exact_match" | "adjacent_match" | "styling_match" | "missing_piece"
> {
  return ["exact_match", "adjacent_match", "styling_match", "missing_piece"];
}

function examplesFromSignal(signal: TrendSignalWithColour): RankedExample[] {
  return (signal.entities ?? [])
    .filter((entity) => entity.entity_type === "brand")
    .map((entity) => {
      const meta = (entity.metadata_json ?? {}) as Record<string, unknown>;
      return {
        label: entity.label,
        tier: meta.tier === "heritage" ? "heritage" : "emerging",
        city: typeof meta.city === "string" ? meta.city : null,
        region: typeof meta.region === "string" ? meta.region : null,
        local: false
      };
    });
}

function withCitedExample(
  signal: TrendSignalWithColour,
  match: UserTrendMatch,
  userLocation?: string | null
): UserTrendMatch {
  if (match.match_type !== "missing_piece") return match;
  const ranked = rankExamplesForUser(examplesFromSignal(signal), userLocation ?? null);
  if (!ranked) return match;
  const previous = match.reasoning_json as unknown as TrendMatchReasoning;
  const reasoning: TrendMatchReasoning = {
    ...previous,
    cited_example: ranked,
    match_reason: ranked.local
      ? `${previous.match_reason}. Cited nearby: ${ranked.label}`
      : `${previous.match_reason}. Cited: ${ranked.label}`
  };
  return {
    ...match,
    score: ranked.local ? Math.min(match.score + 0.05, 0.45) : match.score,
    reasoning_json: reasoning as unknown as Record<string, unknown>
  };
}

export function computeUserTrendMatches(input: MatchInput): UserTrendMatch[] {
  const { signals, garments, compatibleColourFamilies, userLocation } = input;
  const activeGarments = garments.filter((g) => g.wardrobe_status === "active");

  return signals.map((signal) => {
    let match: UserTrendMatch;
    switch (signal.trend_type) {
      case "colour":
        match = matchColourSignal(signal, activeGarments, compatibleColourFamilies);
        break;
      case "garment":
        match = matchGarmentSignal(signal, activeGarments);
        break;
      case "styling":
        match = matchStylingSignal(signal, activeGarments);
        break;
      default:
        match = matchGenericSignal(signal, activeGarments);
    }
    return withCitedExample(signal, match, userLocation);
  });
}
