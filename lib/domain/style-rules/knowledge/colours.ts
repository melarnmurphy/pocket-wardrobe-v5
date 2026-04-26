// lib/domain/style-rules/knowledge/colours.ts
import type { SeedStyleRule } from "./index";

export const colourFamilies = [
  "black", "white", "grey", "blue", "red", "green",
  "yellow", "orange", "purple", "pink", "brown", "beige"
] as const;

export type ColourFamily = (typeof colourFamilies)[number];

const colourSynonyms: Record<ColourFamily, string[]> = {
  black: ["black", "onyx", "ebony", "midnight", "jet", "charcoal", "noir", "ink"],
  white: ["white", "ivory", "eggshell", "snow", "pearl", "alabaster", "off-white", "cream"],
  grey: ["grey", "gray", "heather", "slate", "silver", "anthracite", "steel", "dove", "cloud"],
  blue: ["blue", "navy", "denim", "sky", "azure", "cobalt", "indigo", "cyan", "cerulean", "marine"],
  red: ["red", "burgundy", "crimson", "scarlet", "wine", "bordeaux", "cherry", "brick", "oxblood"],
  green: ["green", "olive", "emerald", "forest", "sage", "mint", "khaki", "army", "pine", "lime"],
  yellow: ["yellow", "gold", "mustard", "lemon", "ochre", "canary", "saffron", "amber"],
  orange: ["orange", "rust", "coral", "terracotta", "peach", "apricot", "burnt orange", "tangerine"],
  purple: ["purple", "lavender", "violet", "plum", "mauve", "lilac", "grape", "eggplant", "amethyst"],
  pink: ["pink", "rose", "fuchsia", "blush", "magenta", "dusty rose", "bubblegum", "salmon"],
  brown: ["brown", "camel", "tan", "chocolate", "espresso", "cognac", "mocha", "toffee", "umber"],
  beige: ["beige", "sand", "oatmeal", "stone", "taupe", "ecru", "nude", "champagne"]
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeRuleValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeLooseText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function inferColourFamilyFromText(text: string | null | undefined): ColourFamily | null {
  const normalized = (text ?? "").trim().toLowerCase();
  if (!normalized) return null;
  const entries = Object.entries(colourSynonyms) as Array<[ColourFamily, string[]]>;
  for (const [family, synonyms] of entries) {
    for (const synonym of synonyms.sort((a, b) => b.length - a.length)) {
      const pattern = new RegExp(
        `(^|[^a-z])${escapeRegExp(synonym.toLowerCase())}([^a-z]|$)`,
        "i"
      );
      if (pattern.test(normalized)) return family;
    }
  }
  return null;
}

const complementaryPairs: Array<[ColourFamily, ColourFamily, string]> = [
  ["blue", "orange", "Blue and orange create a high-contrast pairing that reads bold and intentional."],
  ["green", "red", "Green and red can create a sharp, editorial contrast when the tones are controlled."],
  ["purple", "yellow", "Purple and yellow create vivid contrast that feels directional rather than safe."],
  ["black", "white", "Black and white delivers a clear high-contrast look with very low styling friction."]
];

const analogousPairs: Array<[ColourFamily, ColourFamily, string]> = [
  ["blue", "purple", "Blue and purple sit close on the colour wheel, which makes them feel tonal and smooth."],
  ["red", "pink", "Red and pink read as adjacent shades, producing a soft but still polished tonal story."],
  ["yellow", "orange", "Yellow and orange produce warmth and a cohesive sunlit palette."],
  ["green", "yellow", "Green and yellow feel fresh and adjacent, especially in spring and summer dressing."],
  ["beige", "brown", "Beige and brown create depth within a neutral palette without losing harmony."],
  ["grey", "black", "Grey and black create restrained tonal contrast that stays clean and urban."]
];

const triadicGroups: Array<[ColourFamily, ColourFamily, ColourFamily, string]> = [
  ["blue", "red", "yellow", "Blue, red, and yellow form a classic triadic palette with balanced energy."],
  ["green", "orange", "purple", "Green, orange, and purple create a lively but stable triadic story."]
];

const neutralAnchorPairs: Array<[ColourFamily, ColourFamily, string]> = [
  ["black", "blue", "Black acts as a neutral anchor for blue, giving stronger colour contrast a cleaner base."],
  ["black", "red", "Black acts as a neutral anchor for red, which keeps bold colour from feeling noisy or overworked."],
  ["black", "green", "Black grounds green and makes the palette feel sharper and more controlled."],
  ["black", "yellow", "Black gives yellow a crisp, graphic edge that reads intentional rather than chaotic."],
  ["black", "orange", "Black anchors orange and helps high-energy colour feel more directional."],
  ["black", "purple", "Black stabilizes purple and gives the pairing more depth."],
  ["black", "pink", "Black sharpens pink and keeps the palette from reading overly sweet."]
];

export function buildColourRules(): SeedStyleRule[] {
  const rules: SeedStyleRule[] = [];

  for (const [left, right, explanation] of complementaryPairs) {
    rules.push(
      { rule_type: "colour_complement", subject_type: "colour_family", subject_value: left, predicate: "pairs_with", object_type: "colour_family", object_value: right, weight: 0.96, rule_scope: "global", explanation, constraint_type: "soft" },
      { rule_type: "colour_complement", subject_type: "colour_family", subject_value: right, predicate: "pairs_with", object_type: "colour_family", object_value: left, weight: 0.96, rule_scope: "global", explanation, constraint_type: "soft" }
    );
  }

  for (const [left, right, explanation] of analogousPairs) {
    rules.push(
      { rule_type: "colour_analogous", subject_type: "colour_family", subject_value: left, predicate: "pairs_with", object_type: "colour_family", object_value: right, weight: 0.88, rule_scope: "global", explanation, constraint_type: "soft" },
      { rule_type: "colour_analogous", subject_type: "colour_family", subject_value: right, predicate: "pairs_with", object_type: "colour_family", object_value: left, weight: 0.88, rule_scope: "global", explanation, constraint_type: "soft" }
    );
  }

  for (const [a, b, c, explanation] of triadicGroups) {
    const edges: Array<[ColourFamily, ColourFamily]> = [[a,b],[a,c],[b,a],[b,c],[c,a],[c,b]];
    for (const [left, right] of edges) {
      rules.push({ rule_type: "colour_triadic", subject_type: "colour_family", subject_value: left, predicate: "pairs_with", object_type: "colour_family", object_value: right, weight: 0.8, rule_scope: "global", explanation, constraint_type: "soft" });
    }
  }

  for (const [neutral, accent, explanation] of neutralAnchorPairs) {
    rules.push(
      { rule_type: "colour_neutral_anchor", subject_type: "colour_family", subject_value: neutral, predicate: "grounds", object_type: "colour_family", object_value: accent, weight: 0.72, rule_scope: "global", explanation, constraint_type: "soft" },
      { rule_type: "colour_neutral_anchor", subject_type: "colour_family", subject_value: accent, predicate: "grounded_by", object_type: "colour_family", object_value: neutral, weight: 0.72, rule_scope: "global", explanation, constraint_type: "soft" }
    );
  }

  return rules;
}
