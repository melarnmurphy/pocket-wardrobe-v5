import { canonicalizeLabel } from "./matching";

export interface TrendTaxonomyFields {
  canonical_label: string;
  vertical: string | null;
  family: string | null;
  subfamily: string | null;
  micro_signal: string | null;
}

interface TrendTaxonomyInput {
  label: string;
  trendType: string;
  attributes?: Record<string, unknown>;
}

const SHOE_FAMILY = "sneakers";
const SHOE_VERTICAL = "shoes";

function hasMatch(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function resolveTrendTaxonomy({
  label,
  trendType,
  attributes = {}
}: TrendTaxonomyInput): TrendTaxonomyFields {
  const canonicalSource = canonicalizeLabel(label);
  const category = typeof attributes.category === "string" ? canonicalizeLabel(attributes.category) : "";
  const subcategory =
    typeof attributes.subcategory === "string" ? canonicalizeLabel(attributes.subcategory) : "";
  const haystack = [canonicalSource, category, subcategory].filter(Boolean).join(" ");

  if (trendType === "colour") {
    return {
      canonical_label: titleCase(label),
      vertical: "colour",
      family: typeof attributes.family === "string" ? canonicalizeLabel(attributes.family) : null,
      subfamily: null,
      micro_signal: canonicalSource
    };
  }

  if (hasMatch(haystack, [/samba/, /onitsuka/, /mexico 66/, /retro suede/, /retro runner/, /slim runner/])) {
    return {
      canonical_label: "Slim Retro Sneakers",
      vertical: SHOE_VERTICAL,
      family: SHOE_FAMILY,
      subfamily: "slim retro sneakers",
      micro_signal: canonicalSource
    };
  }

  if (hasMatch(haystack, [/speedcat/, /ballet sneaker/, /ballet flat/, /ballerina/])) {
    return {
      canonical_label: "Ballet Sneaker Hybrids",
      vertical: SHOE_VERTICAL,
      family: SHOE_FAMILY,
      subfamily: "ballet sneaker hybrids",
      micro_signal: canonicalSource
    };
  }

  if (hasMatch(haystack, [/plimsoll/, /canvas lace/, /white leather lace/, /minimal white sneaker/])) {
    return {
      canonical_label: "Low-Profile White Sneakers",
      vertical: SHOE_VERTICAL,
      family: SHOE_FAMILY,
      subfamily: "low-profile white sneakers",
      micro_signal: canonicalSource
    };
  }

  if (hasMatch(haystack, [/gum sole/, /gummy sole/, /skater/, /skate/])) {
    return {
      canonical_label: "Skate-Inspired Gum-Sole Sneakers",
      vertical: SHOE_VERTICAL,
      family: SHOE_FAMILY,
      subfamily: "skate-inspired gum-sole sneakers",
      micro_signal: canonicalSource
    };
  }

  if (hasMatch(haystack, [/fancy sneaker/, /embellish/, /beading/, /sequin/, /embroider/])) {
    return {
      canonical_label: "Embellished Sneakers",
      vertical: SHOE_VERTICAL,
      family: SHOE_FAMILY,
      subfamily: "embellished sneakers",
      micro_signal: canonicalSource
    };
  }

  if (hasMatch(haystack, [/rainbow bright/, /saturated colour/, /bright sneaker/])) {
    return {
      canonical_label: "Bright Fashion Sneakers",
      vertical: SHOE_VERTICAL,
      family: SHOE_FAMILY,
      subfamily: "bright fashion sneakers",
      micro_signal: canonicalSource
    };
  }

  return {
    canonical_label: titleCase(label),
    vertical: inferVertical(category, subcategory, canonicalSource),
    family: inferFamily(category, subcategory, canonicalSource),
    subfamily: null,
    micro_signal: canonicalSource
  };
}

function inferVertical(category: string, subcategory: string, label: string) {
  if ([category, subcategory, label].some((value) => value.includes("shoe") || value.includes("sneaker"))) {
    return SHOE_VERTICAL;
  }
  if ([category, subcategory].some((value) => value.includes("dress"))) return "dresses";
  if ([category, subcategory].some((value) => value.includes("bag"))) return "bags";
  return null;
}

function inferFamily(category: string, subcategory: string, label: string) {
  if ([category, subcategory, label].some((value) => value.includes("sneaker") || value.includes("runner"))) {
    return SHOE_FAMILY;
  }
  if ([category, subcategory].some((value) => value.includes("heel"))) return "heels";
  if ([category, subcategory].some((value) => value.includes("flat"))) return "flats";
  return null;
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
