export const colourFamilies = [
  "black",
  "white",
  "grey",
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "brown",
  "beige"
] as const;

export type ColourFamily = (typeof colourFamilies)[number];

export const weatherProfiles = [
  "warm_sun",
  "mild_clear",
  "cool_breeze",
  "cold_rain"
] as const;

export type WeatherProfile = (typeof weatherProfiles)[number];

export const occasionProfiles = [
  "casual",
  "business_casual",
  "evening"
] as const;

export type OccasionProfile = (typeof occasionProfiles)[number];

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

export type SeedStyleRule = {
  rule_type: string;
  subject_type: string;
  subject_value: string;
  predicate: string;
  object_type: string;
  object_value: string;
  weight: number;
  rule_scope: "global";
  explanation: string;
};

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

const weatherRules: SeedStyleRule[] = [
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "sandals",
    predicate: "avoid_with",
    object_type: "weather",
    object_value: "cold_rain",
    weight: 0.99,
    rule_scope: "global",
    explanation: "Sandals are generally a poor choice in cold rainy weather."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "coat",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "cold_rain",
    weight: 0.95,
    rule_scope: "global",
    explanation: "A coat is one of the safest outer layers for cold rainy conditions."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "boots",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "cold_rain",
    weight: 0.94,
    rule_scope: "global",
    explanation: "Boots usually handle wet streets and lower temperatures better than open footwear."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "knitwear",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "cool_breeze",
    weight: 0.9,
    rule_scope: "global",
    explanation: "Knitwear adds insulation without the weight of a full coat in cooler breezy weather."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "linen trousers",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "warm_sun",
    weight: 0.92,
    rule_scope: "global",
    explanation: "Linen trousers breathe well and stay comfortable in warmer sunny weather."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "t-shirt",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "warm_sun",
    weight: 0.88,
    rule_scope: "global",
    explanation: "A t-shirt is a reliable warm-weather base because it is breathable and easy to layer lightly."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "blazer",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "mild_clear",
    weight: 0.78,
    rule_scope: "global",
    explanation: "A blazer is often most comfortable in mild weather when outerwear is optional."
  },
  {
    rule_type: "weather_fit",
    subject_type: "category",
    subject_value: "loafer",
    predicate: "works_in_weather",
    object_type: "weather",
    object_value: "mild_clear",
    weight: 0.82,
    rule_scope: "global",
    explanation: "Loafers work best in dry mild weather where a polished low-profile shoe is practical."
  }
];

const occasionRules: SeedStyleRule[] = [
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "white shirt",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "business_casual",
    weight: 0.95,
    rule_scope: "global",
    explanation: "A white shirt is a strong business-casual base layer."
  },
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "blazer",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "business_casual",
    weight: 0.92,
    rule_scope: "global",
    explanation: "A blazer makes business-casual outfits feel intentional without forcing full suiting."
  },
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "tailored trousers",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "business_casual",
    weight: 0.9,
    rule_scope: "global",
    explanation: "Tailored trousers anchor business-casual outfits with structure."
  },
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "sneakers",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "casual",
    weight: 0.9,
    rule_scope: "global",
    explanation: "Sneakers are a safe casual footwear base for everyday dressing."
  },
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "denim jacket",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "casual",
    weight: 0.82,
    rule_scope: "global",
    explanation: "A denim jacket usually reads casual and relaxed."
  },
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "dress",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "evening",
    weight: 0.86,
    rule_scope: "global",
    explanation: "A dress often transitions easily into evening dressing depending on fabrication and styling."
  },
  {
    rule_type: "occasion_fit",
    subject_type: "category",
    subject_value: "heels",
    predicate: "appropriate_for",
    object_type: "occasion",
    object_value: "evening",
    weight: 0.84,
    rule_scope: "global",
    explanation: "Heels often elevate a look for evening settings."
  }
];

function buildColourRules(): SeedStyleRule[] {
  const rules: SeedStyleRule[] = [];

  for (const [left, right, explanation] of complementaryPairs) {
    rules.push(
      {
        rule_type: "colour_complement",
        subject_type: "colour_family",
        subject_value: left,
        predicate: "pairs_with",
        object_type: "colour_family",
        object_value: right,
        weight: 0.96,
        rule_scope: "global",
        explanation
      },
      {
        rule_type: "colour_complement",
        subject_type: "colour_family",
        subject_value: right,
        predicate: "pairs_with",
        object_type: "colour_family",
        object_value: left,
        weight: 0.96,
        rule_scope: "global",
        explanation
      }
    );
  }

  for (const [left, right, explanation] of analogousPairs) {
    rules.push(
      {
        rule_type: "colour_analogous",
        subject_type: "colour_family",
        subject_value: left,
        predicate: "pairs_with",
        object_type: "colour_family",
        object_value: right,
        weight: 0.88,
        rule_scope: "global",
        explanation
      },
      {
        rule_type: "colour_analogous",
        subject_type: "colour_family",
        subject_value: right,
        predicate: "pairs_with",
        object_type: "colour_family",
        object_value: left,
        weight: 0.88,
        rule_scope: "global",
        explanation
      }
    );
  }

  for (const [a, b, c, explanation] of triadicGroups) {
    const edges: Array<[ColourFamily, ColourFamily]> = [
      [a, b],
      [a, c],
      [b, a],
      [b, c],
      [c, a],
      [c, b]
    ];

    for (const [left, right] of edges) {
      rules.push({
        rule_type: "colour_triadic",
        subject_type: "colour_family",
        subject_value: left,
        predicate: "pairs_with",
        object_type: "colour_family",
        object_value: right,
        weight: 0.8,
        rule_scope: "global",
        explanation
      });
    }
  }

  return rules;
}

export function buildSeedStyleRules(): SeedStyleRule[] {
  return [
    ...buildColourRules(),
    ...weatherRules,
    ...occasionRules,
    {
      rule_type: "layering",
      subject_type: "category",
      subject_value: "knitwear",
      predicate: "layerable_with",
      object_type: "category",
      object_value: "coat",
      weight: 0.9,
      rule_scope: "global",
      explanation: "Knitwear often layers well with coats in cooler weather."
    },
    {
      rule_type: "silhouette",
      subject_type: "category",
      subject_value: "wide_leg_trousers",
      predicate: "pairs_with",
      object_type: "category",
      object_value: "fitted_top",
      weight: 0.85,
      rule_scope: "global",
      explanation: "Wide-leg trousers usually balance well with a more fitted top."
    }
  ];
}

export function normalizeRuleValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeLooseText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferColourFamilyFromText(text: string | null | undefined): ColourFamily | null {
  const normalized = normalizeLooseText(text);

  if (!normalized) {
    return null;
  }

  const entries = Object.entries(colourSynonyms) as Array<[ColourFamily, string[]]>;

  for (const [family, synonyms] of entries) {
    for (const synonym of synonyms.sort((left, right) => right.length - left.length)) {
      const pattern = new RegExp(`(^|[^a-z])${escapeRegExp(synonym.toLowerCase())}([^a-z]|$)`, "i");
      if (pattern.test(normalized)) {
        return family;
      }
    }
  }

  return null;
}
