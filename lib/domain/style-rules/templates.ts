import { colourFamilies } from "@/lib/domain/style-rules/knowledge/colours";
import { occasionProfiles } from "@/lib/domain/style-rules/knowledge/occasions";

export type TemplateCategory =
  | "layering"
  | "colour"
  | "occasions"
  | "season"
  | "silhouette";

export type BlankDef =
  | { kind: "text";  label: string; suggestions: string[] }
  | { kind: "pick";  label: string; options: string[] }
  | { kind: "fixed"; value: string };

export type RuleTemplate = {
  id: string;
  category: TemplateCategory;
  sentence: string;
  blanks: [BlankDef, BlankDef];
  rule_type: string;
  subject_type: string;
  predicate: string;
  object_type: string;
};

export const STRENGTH_WEIGHTS = {
  always:    1.0,
  often:     0.75,
  sometimes: 0.5,
  rarely:    0.25,
} as const;

export type Strength = keyof typeof STRENGTH_WEIGHTS;

const GARMENT_CATEGORY_SUGGESTIONS = [
  "t-shirt", "shirt", "blouse", "tank", "turtleneck", "knitwear", "vest",
  "bodysuit", "base-layer", "dress", "blazer", "jacket", "coat",
  "denim jacket", "cardigan", "puffer", "waistcoat", "jeans", "trousers",
  "shorts", "skirt", "leggings", "sneakers", "boots", "loafers", "heels",
  "sandals", "trainers",
];

const garment = (label = "a garment"): BlankDef =>
  ({ kind: "text", label, suggestions: GARMENT_CATEGORY_SUGGESTIONS });

const colour = (label = "a colour"): BlankDef =>
  ({ kind: "text", label, suggestions: [...colourFamilies] });

const occasion = (label = "an occasion"): BlankDef =>
  ({ kind: "text", label, suggestions: [...occasionProfiles] });

const season = (label = "a season"): BlankDef =>
  ({ kind: "text", label, suggestions: ["summer", "winter", "spring", "autumn"] });

const fit = (label = "a fit"): BlankDef =>
  ({ kind: "text", label, suggestions: ["relaxed", "fitted", "oversized", "tailored", "slim", "wide-leg", "straight"] });

export const RULE_TEMPLATES: RuleTemplate[] = [
  // LAYERING
  {
    id: "layering-likes",
    category: "layering",
    sentence: "I like layering ___ under ___",
    blanks: [garment("a base piece"), garment("an outer layer")],
    rule_type: "layering",
    subject_type: "category",
    predicate: "layerable_with",
    object_type: "category",
  },
  {
    id: "layering-avoids",
    category: "layering",
    sentence: "I don't layer ___ under ___",
    blanks: [garment("a base piece"), garment("an outer layer")],
    rule_type: "layering",
    subject_type: "category",
    predicate: "avoid_layering_with",
    object_type: "category",
  },

  // COLOUR
  {
    id: "colour-likes",
    category: "colour",
    sentence: "I like pairing ___ with ___",
    blanks: [colour("a colour"), colour("another colour")],
    rule_type: "colour_pairing",
    subject_type: "colour",
    predicate: "pairs_with",
    object_type: "colour",
  },
  {
    id: "colour-avoids",
    category: "colour",
    sentence: "I avoid wearing ___ with ___",
    blanks: [colour("a colour"), colour("another colour")],
    rule_type: "colour_pairing",
    subject_type: "colour",
    predicate: "avoid_with",
    object_type: "colour",
  },
  {
    id: "colour-style",
    category: "colour",
    sentence: "I prefer ___ outfits",
    blanks: [
      { kind: "fixed", value: "preference" },
      { kind: "pick", label: "colour style", options: ["monochrome", "tonal", "contrasting"] },
    ],
    rule_type: "colour_preference",
    subject_type: "preference",
    predicate: "prefers",
    object_type: "colour_style",
  },

  // OCCASIONS
  {
    id: "occasion-wears",
    category: "occasions",
    sentence: "I wear ___ for ___ occasions",
    blanks: [garment("a garment"), occasion("an occasion")],
    rule_type: "occasion_fit",
    subject_type: "category",
    predicate: "appropriate_for",
    object_type: "occasion",
  },
  {
    id: "occasion-avoids",
    category: "occasions",
    sentence: "I don't wear ___ to ___",
    blanks: [garment("a garment"), occasion("an occasion")],
    rule_type: "occasion_fit",
    subject_type: "category",
    predicate: "avoid_for",
    object_type: "occasion",
  },

  // SEASON
  {
    id: "season-wears",
    category: "season",
    sentence: "I wear ___ in ___",
    blanks: [garment("a garment"), season("a season")],
    rule_type: "seasonality",
    subject_type: "category",
    predicate: "works_in_season",
    object_type: "season",
  },
  {
    id: "season-avoids",
    category: "season",
    sentence: "I avoid ___ in hot weather",
    blanks: [
      garment("a garment"),
      { kind: "fixed", value: "hot_weather" },
    ],
    rule_type: "seasonality",
    subject_type: "category",
    predicate: "avoid_in_season",
    object_type: "season",
  },

  // SILHOUETTE
  {
    id: "silhouette-balance",
    category: "silhouette",
    sentence: "I balance oversized tops with fitted bottoms",
    blanks: [
      { kind: "fixed", value: "oversized" },
      { kind: "fixed", value: "fitted" },
    ],
    rule_type: "silhouette",
    subject_type: "fit",
    predicate: "balances_with",
    object_type: "fit",
  },
  {
    id: "silhouette-prefers",
    category: "silhouette",
    sentence: "I prefer ___ fits",
    blanks: [
      fit("a fit"),
      { kind: "fixed", value: "preference" },
    ],
    rule_type: "silhouette",
    subject_type: "fit",
    predicate: "prefers",
    object_type: "fit",
  },
];
