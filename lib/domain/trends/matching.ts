import type { TrendSignalWithColour, TrendMatchReasoning, UserTrendMatch } from "./index";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

export function canonicalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ").replace(/-/g, " ");
}

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
  const attrs = signal.normalized_attributes_json as {
    category?: string;
    subcategory?: string;
    fit?: string;
    material?: string;
  };

  const signalAttrs: Record<string, unknown> = {
    ...(attrs.category ? { category: attrs.category } : {}),
    ...(attrs.subcategory ? { subcategory: attrs.subcategory } : {}),
    ...(attrs.fit ? { fit: attrs.fit } : {}),
    ...(attrs.material ? { material: attrs.material } : {})
  };

  const toGarmentAttrs = (g: GarmentListItem): Record<string, unknown> => ({
    ...(attrs.category !== undefined ? { category: g.category } : {}),
    ...(attrs.subcategory !== undefined ? { subcategory: g.subcategory ?? undefined } : {}),
    ...(attrs.fit !== undefined ? { fit: g.fit ?? undefined } : {}),
    ...(attrs.material !== undefined ? { material: g.material ?? undefined } : {})
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
  const attrs = signal.normalized_attributes_json as { required_categories?: string[] };
  const required = attrs.required_categories ?? [];

  if (required.length === 0) {
    return buildMissingPiece(signal, [], "No required_categories defined in signal");
  }

  const ownedCategories = new Set(garments.map((g) => g.category));
  const covered = required.filter((cat) => ownedCategories.has(cat));
  const missing = required.filter((cat) => !ownedCategories.has(cat));

  if (missing.length > 0) {
    return buildMissingPiece(signal, [], `Missing categories: ${missing.join(", ")}`);
  }

  const overlapRatio = covered.length / required.length;
  const score = clamp(computeBaseScore(signal, overlapRatio), 0.6, 0.8);
  const matchedIds = required.flatMap((cat) =>
    garments.filter((g) => g.category === cat).map((g) => g.id as string)
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

export function computeUserTrendMatches(input: MatchInput): UserTrendMatch[] {
  const { signals, garments, compatibleColourFamilies } = input;
  const activeGarments = garments.filter((g) => g.wardrobe_status === "active");

  return signals.map((signal) => {
    switch (signal.trend_type) {
      case "colour":
        return matchColourSignal(signal, activeGarments, compatibleColourFamilies);
      case "garment":
        return matchGarmentSignal(signal, activeGarments);
      case "styling":
        return matchStylingSignal(signal, activeGarments);
      default:
        return matchGenericSignal(signal, activeGarments);
    }
  });
}
