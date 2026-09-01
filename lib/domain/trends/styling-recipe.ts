export const RECIPE_WARDROBE_CATEGORIES = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "bags",
  "accessories"
] as const;

export type RecipeWardrobeCategory = (typeof RECIPE_WARDROBE_CATEGORIES)[number];

export type RecipeLast =
  | "vulcanized"
  | "western"
  | "ballet"
  | "runner"
  | "plimsoll"
  | "loafer"
  | "heel"
  | "boot"
  | "sandal";

export type RecipeVibe = "skate";

export interface RecipePiece {
  piece: string;
  category: RecipeWardrobeCategory | null;
  archetype: string | null;
  last: RecipeLast | null;
  vibe: RecipeVibe | null;
  silhouette: string | null;
  closure: string | null;
  hem: string | null;
}

export const PAIRING_SCOUT_INSTRUCTION =
  "Prefer styling recipes (what is worn with what). Keep vibe and last separate: skate-inspired is a vibe (Onitsuka Tigers, Puma ballet flats, and slip-ons can all sit under it). Slip-on is a closure, not a last. Name a last only when the source names one (slim runner, white plimsoll, cowboy boots, vulcanized Vans). Example: mini hem + cowboy boots.";

const CATEGORY_PATTERNS: Array<{ category: RecipeWardrobeCategory; pattern: RegExp }> = [
  {
    category: "shoes",
    pattern:
      /\b(boot|boots|cowboy|western|ballet|heel|heels|flat|flats|loafer|mule|sneaker|trainer|sandal|shoe|plimsoll|runner|slip-?on)\b/i
  },
  {
    category: "bags",
    pattern: /\b(bag|baguette|tote|hobo|clutch|purse)\b/i
  },
  {
    category: "outerwear",
    pattern: /\b(trench|coat|blazer|jacket|cape|shrug|shearling)\b/i
  },
  {
    category: "dresses",
    pattern: /\b(dress|mini hem|micro hem|hemline)\b/i
  },
  {
    category: "bottoms",
    pattern:
      /\b(jean|jeans|trouser|trousers|skirt|short|shorts|kick.?flare|wide.?leg|legging)\b/i
  },
  {
    category: "tops",
    pattern:
      /\b(tee|t-shirt|shirt|blouse|knit|sweater|mock.?neck|bustier|cami|top)\b/i
  },
  {
    category: "accessories",
    pattern: /\b(earphone|scarf|belt|jewellery|jewelry|sunglass)\b/i
  }
];

const LAST_SYNONYMS: Record<RecipeLast, string[]> = {
  vulcanized: ["vans", "waffle", "gum sole", "vulcanized"],
  western: ["cowboy", "western", "cowgirl"],
  ballet: ["ballet", "ballerina", "speedcat"],
  runner: ["runner", "samba", "gazelle", "mexico 66", "onitsuka", "slim runner"],
  plimsoll: ["plimsoll", "keds", "superga", "jack purcell", "tennis shoe"],
  loafer: ["loafer", "penny loafer"],
  heel: ["heel", "pump", "stiletto"],
  boot: ["boot", "boots"],
  sandal: ["sandal", "slide"]
};

const SLIP_ON_TOKENS = ["slip-on", "slip on", "slipon", "loafer", "mule", "ballet", "speedcat"];
const SKATE_VIBE_TOKENS = [
  "skate",
  "skater",
  "vans",
  "onitsuka",
  "mexico 66",
  "speedcat",
  "ballet",
  "gum sole",
  "waffle"
];

export function mapPieceToCategory(piece: string): RecipeWardrobeCategory | null {
  const text = piece.trim();
  if (!text) return null;
  for (const { category, pattern } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function haystackOf(text: string): string {
  return text.toLowerCase();
}

function hasAny(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(term));
}

export function enrichRecipePiece(input: {
  piece: string;
  category?: RecipeWardrobeCategory | null;
  last?: RecipeLast | string | null;
  vibe?: RecipeVibe | string | null;
  silhouette?: string | null;
  closure?: string | null;
  hem?: string | null;
  archetype?: string | null;
}): RecipePiece {
  const raw = input.piece.trim();
  const hay = haystackOf(raw);
  let category = input.category ?? mapPieceToCategory(raw);
  let last = (input.last as RecipeLast | null) ?? null;
  let vibe = (input.vibe as RecipeVibe | null) ?? null;
  let silhouette = input.silhouette ?? null;
  let closure = input.closure ?? null;
  let hem = input.hem ?? null;
  let archetype = input.archetype ?? null;
  const piece = raw;

  if (last === "skate") {
    vibe = vibe ?? "skate";
    last = /vans|waffle|vulcanized|gum/.test(hay) ? "vulcanized" : null;
  }

  if (/skater|skate/.test(hay)) {
    vibe = "skate";
    category = category ?? "shoes";
  }

  if (/slip-?on|slip on/.test(hay)) {
    closure = closure ?? "slip_on";
    category = category ?? "shoes";
  }

  if (/vans/.test(hay) && /slip/.test(hay)) {
    last = last ?? "vulcanized";
    closure = closure ?? "slip_on";
    category = "shoes";
    archetype = archetype ?? "vans_slip_on";
  } else if (/plimsoll|jazz shoe/.test(hay) || (/white/.test(hay) && /canvas/.test(hay) && /lace/.test(hay))) {
    last = "plimsoll";
    silhouette = silhouette ?? "low";
    category = "shoes";
    archetype = "white_plimsoll";
  } else if (
    /slim runners?|samba|gazelle|mexico 66|onitsuka|retro runner/.test(hay)
  ) {
    last = "runner";
    silhouette = silhouette ?? "slim";
    category = "shoes";
    archetype = "slim_runner";
  } else if (/cowboy|western/.test(hay) && /boot/.test(hay)) {
    last = "western";
    category = "shoes";
    archetype = "cowboy_boot";
  } else if (/ballet/.test(hay) && /flat|sneaker|pump|speedcat/.test(hay)) {
    last = "ballet";
    silhouette = silhouette ?? "low";
    category = "shoes";
    archetype = "ballet_flat";
  } else if (/loafer/.test(hay)) {
    last = "loafer";
    closure = closure ?? "slip_on";
    category = "shoes";
    archetype = "loafer";
  }

  if (/mini hem|micro hem|micro-mini|micro mini/.test(hay)) {
    hem = hem ?? "mini";
    category = category ?? "dresses";
    archetype = archetype ?? "mini_hem";
  }

  if (/kick.?flare/.test(hay)) {
    silhouette = silhouette ?? "kick_flare";
    category = category ?? "bottoms";
    archetype = archetype ?? "kick_flare_jean";
  }

  if (!category) category = mapPieceToCategory(piece);

  return {
    piece,
    category,
    archetype,
    last,
    vibe,
    silhouette,
    closure,
    hem
  };
}

function piecesFromPair(value: unknown): RecipePiece[] {
  if (!Array.isArray(value)) return [];
  const pieces: RecipePiece[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      pieces.push(enrichRecipePiece({ piece: entry }));
      continue;
    }
    if (entry && typeof entry === "object") {
      const record = entry as Record<string, unknown>;
      const piece = asString(record.piece) ?? asString(record.label) ?? asString(record.name);
      if (!piece) continue;
      const explicit = asString(record.category);
      const category = RECIPE_WARDROBE_CATEGORIES.includes(explicit as RecipeWardrobeCategory)
        ? (explicit as RecipeWardrobeCategory)
        : mapPieceToCategory(piece);
      pieces.push(
        enrichRecipePiece({
          piece,
          category,
          last: asString(record.last),
          vibe: asString(record.vibe),
          silhouette: asString(record.silhouette),
          closure: asString(record.closure),
          hem: asString(record.hem),
          archetype: asString(record.archetype)
        })
      );
    }
  }
  return pieces;
}

function piecesFromLabel(label: string): RecipePiece[] {
  const parts = label
    .split(/\s+\+\s+|\s+with\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part.length < 60);
  if (parts.length < 2) return [];
  return parts.map((piece) => enrichRecipePiece({ piece }));
}

const RECIPE_ROLE_KEYWORDS: Record<string, string[]> = {
  top: ["shirt", "blouse", "top", "tee", "t-shirt", "jumper", "sweater", "turtleneck", "tank", "bodysuit", "crop"],
  bottom: ["trouser", "jean", "skirt", "short", "chino", "legging", "pant", "bottom"],
  dress: ["dress", "jumpsuit", "playsuit"],
  outerwear: ["coat", "jacket", "blazer", "waistcoat", "vest", "puffer", "trench"],
  shoes: ["shoe", "boot", "trainer", "sandal", "loafer", "heel", "flat", "mule", "sneaker", "plimsoll", "runner"],
  bag: ["bag", "handbag", "clutch", "tote", "backpack", "purse"],
  accessory: ["scarf", "belt", "hat", "cap", "glove", "sunglass", "tie", "watch"]
};

const RECIPE_CATEGORY_TO_ROLE: Record<string, keyof typeof RECIPE_ROLE_KEYWORDS> = {
  tops: "top",
  top: "top",
  bottoms: "bottom",
  bottom: "bottom",
  trousers: "bottom",
  jeans: "bottom",
  dresses: "dress",
  dress: "dress",
  outerwear: "outerwear",
  shoes: "shoes",
  bags: "bag",
  bag: "bag",
  accessories: "accessory",
  accessory: "accessory"
};

export function garmentCoversRecipeCategory(
  garment: { category: string; subcategory?: string | null; title?: string | null },
  recipeCategory: string
): boolean {
  const wanted = recipeCategory.trim().toLowerCase();
  if (!wanted) return false;
  const haystack = [garment.category, garment.subcategory, garment.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (garment.category.toLowerCase() === wanted) return true;
  const role = RECIPE_CATEGORY_TO_ROLE[wanted];
  if (!role) return haystack.includes(wanted);
  return RECIPE_ROLE_KEYWORDS[role].some((keyword) => haystack.includes(keyword));
}

export function garmentCoversRecipePiece(
  garment: {
    category: string;
    subcategory?: string | null;
    title?: string | null;
    brand?: string | null;
  },
  piece: RecipePiece
): boolean {
  if (piece.category && !garmentCoversRecipeCategory(garment, piece.category)) {
    return false;
  }

  const haystack = [garment.category, garment.subcategory, garment.title, garment.brand]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (piece.last) {
    const synonyms = LAST_SYNONYMS[piece.last];
    if (synonyms && !hasAny(haystack, synonyms)) return false;
  }

  if (piece.vibe === "skate" && !hasAny(haystack, SKATE_VIBE_TOKENS)) {
    return false;
  }

  if (piece.closure === "slip_on" && !hasAny(haystack, SLIP_ON_TOKENS) && !hasAny(haystack, ["vans"])) {
    return false;
  }

  if (piece.hem === "mini" && !/mini|micro/.test(haystack) && !/dress/.test(haystack)) {
    return false;
  }

  if (piece.silhouette === "kick_flare" && !/kick.?flare|flare/.test(haystack)) {
    return false;
  }

  if (piece.silhouette === "slim" && piece.last === "runner" && /chunky|dad shoe|triple s/.test(haystack)) {
    return false;
  }

  return true;
}

export function extractRecipePieces(attrs: Record<string, unknown>): RecipePiece[] {
  return piecesFromPair(attrs.pair);
}

export function extractRequiredCategories(attrs: Record<string, unknown>): string[] {
  const fromList = Array.isArray(attrs.required_categories)
    ? attrs.required_categories.filter((value): value is string => typeof value === "string")
    : [];
  if (fromList.length > 0) return [...new Set(fromList)];

  const fromPair = extractRecipePieces(attrs)
    .map((piece) => piece.category)
    .filter((category): category is RecipeWardrobeCategory => Boolean(category));
  return [...new Set(fromPair)];
}

export interface RecipeSignal {
  trend_type: string;
  label: string;
  normalized_attributes: Record<string, unknown>;
}

export function normalizeExtractedSignal<T extends RecipeSignal>(signal: T): T {
  const attrs = { ...signal.normalized_attributes };
  const label = signal.label.trim();

  const fromAttrs = piecesFromPair(attrs.pair);
  const fromAnchor = [
    asString(attrs.anchor),
    asString(attrs.counterweight)
  ].filter((value): value is string => Boolean(value));
  const fromLabel = piecesFromLabel(label);

  let pieces = fromAttrs;
  if (pieces.length < 2 && fromAnchor.length >= 2) {
    pieces = fromAnchor.map((piece) => enrichRecipePiece({ piece }));
  }
  if (pieces.length < 2) {
    pieces = fromLabel;
  }

  const wardrobePieces = pieces.filter((piece) => piece.category);
  const isRecipe = wardrobePieces.length >= 2;
  if (!isRecipe) {
    const profile = enrichRecipePiece({ piece: label, category: mapPieceToCategory(label) });
    return {
      ...signal,
      normalized_attributes: {
        ...attrs,
        ...(profile.archetype ? { archetype: profile.archetype } : {}),
        ...(profile.last ? { last: profile.last } : {}),
        ...(profile.vibe ? { vibe: profile.vibe } : {}),
        ...(profile.silhouette ? { silhouette: profile.silhouette } : {}),
        ...(profile.closure ? { closure: profile.closure } : {}),
        ...(profile.hem ? { hem: profile.hem } : {}),
        ...(profile.category ? { category: profile.category } : {})
      }
    };
  }

  const required = [
    ...new Set(
      wardrobePieces
        .map((piece) => piece.category)
        .filter((category): category is RecipeWardrobeCategory => Boolean(category))
    )
  ];

  const recipeLabel = `${wardrobePieces[0].piece} + ${wardrobePieces[1].piece}`;

  return {
    ...signal,
    trend_type: "styling",
    label: recipeLabel,
    normalized_attributes: {
      ...attrs,
      recipe: true,
      anchor: asString(attrs.anchor) ?? wardrobePieces[0]?.piece ?? null,
      counterweight: asString(attrs.counterweight) ?? wardrobePieces[1]?.piece ?? null,
      pair: wardrobePieces,
      required_categories: required.length > 0 ? required : attrs.required_categories
    }
  };
}

export function normalizeExtractedSignals<T extends RecipeSignal>(signals: T[]): T[] {
  return signals.map((signal) => normalizeExtractedSignal(signal));
}
