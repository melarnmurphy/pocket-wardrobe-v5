import {
  extractGarmentAttributesFromText,
  type GarmentAttribute,
} from "./garment-attributes";

const CLOTHING_KEYWORDS = [
  "dress",
  "shirt",
  "top",
  "tee",
  "t-shirt",
  "blazer",
  "coat",
  "jacket",
  "trouser",
  "trousers",
  "pant",
  "pants",
  "jean",
  "jeans",
  "skirt",
  "knit",
  "sweater",
  "cardigan",
  "hoodie",
  "jumper",
  "short",
  "shorts",
  "shoe",
  "shoes",
  "loafer",
  "heel",
  "bag",
  "scarf",
  "tank",
  "cami",
  "sandal",
  "boot"
] as const;

const PRIORITY_CATEGORY_KEYWORDS: Array<{
  category: string;
  keywords: string[];
}> = [
  {
    category: "shoes",
    keywords: ["sneaker", "sneakers", "trainer", "trainers", "shoe", "shoes", "loafer", "loafers", "boot", "boots", "sandals", "sandal", "footwear"]
  },
  {
    category: "dress",
    keywords: ["dress", "midi", "maxi", "mini"]
  },
  {
    category: "outerwear",
    keywords: ["coat", "jacket", "blazer", "cardigan", "trench", "parka", "duffle", "puffer"]
  },
  {
    category: "bottom",
    keywords: ["trouser", "trousers", "pant", "pants", "jean", "jeans", "skirt", "short", "shorts"]
  },
  {
    category: "top",
    keywords: ["top", "tee", "t-shirt", "shirt", "blouse", "tank", "cami", "bodysuit"]
  }
];

const COLOUR_WORDS = [
  { token: "black", value: "black" },
  { token: "white", value: "white" },
  { token: "cream", value: "cream" },
  { token: "ivory", value: "ivory" },
  { token: "grey", value: "grey" },
  { token: "gray", value: "grey" },
  { token: "navy", value: "navy" },
  { token: "blue", value: "blue" },
  { token: "red", value: "red" },
  { token: "burgundy", value: "burgundy" },
  { token: "green", value: "green" },
  { token: "olive", value: "olive" },
  { token: "brown", value: "brown" },
  { token: "tan", value: "tan" },
  { token: "beige", value: "beige" },
  { token: "camel", value: "camel" },
  { token: "hazelnut", value: "hazelnut" },
  { token: "pink", value: "pink" },
  { token: "yellow", value: "yellow" },
  { token: "gold", value: "gold" },
  { token: "silver", value: "silver" }
] as const;

const PRODUCT_METADATA_FETCH_TIMEOUT_MS = 2000;

export type { GarmentAttribute };

export type StylingSuggestion = {
  predicate: "pairs_with" | "layer_with";
  terms: string[];
  raw_text: string;
  source: "retailer_copy";
};

type ProductMetadata = {
  title: string | null;
  brand: string | null;
  category: string | null;
  colour: string | null;
  /** Normalised fit descriptor extracted from product copy, e.g. "oversized" */
  fit: string | null;
  /** Fabric composition or primary material, e.g. "53% Cotton, 45% Nylon" */
  material: string | null;
  retailer: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  image_url: string | null;
  /**
   * Structured attributes with knowledge-graph mappings.
   * Stored in extraction_metadata_json.attributes on the garment row.
   */
  attributes: GarmentAttribute[];
  styling_suggestions: StylingSuggestion[];
};

type RetailerAdapterMetadata = Partial<
  Pick<
    ProductMetadata,
    "title" | "brand" | "price" | "currency" | "description" | "image_url" | "colour"
  >
>;

export type ReceiptDraftCandidate = {
  title: string;
  category: string | null;
  colour: string | null;
  brand: string | null;
  retailer: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
  confidence: number;
};

export async function extractProductMetadataFromUrl(
  url: string,
  options?: { preRenderedHtml?: string }
): Promise<ProductMetadata> {
  const parsedUrl = new URL(url);
  const retailer = sanitizeText(parsedUrl.hostname.replace(/^www\./, ""));

  try {
    let html: string;

    if (options?.preRenderedHtml) {
      html = options.preRenderedHtml;
    } else {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; PocketWardrobeBot/0.1; +https://example.com/bot)"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(PRODUCT_METADATA_FETCH_TIMEOUT_MS)
      });

      if (!response.ok) {
        return {
          title: deriveTitleFromUrl(parsedUrl),
          brand: null,
          category: deriveCategoryFromText(deriveTitleFromUrl(parsedUrl)),
          colour: deriveColourFromText(deriveTitleFromUrl(parsedUrl)),
          fit: null,
          material: null,
          retailer,
          description: null,
          price: null,
          currency: null,
          image_url: null,
          attributes: [],
          styling_suggestions: [],
        };
      }

      html = await response.text();
    }
    const adapter = extractRetailerAdapterMetadata(parsedUrl.hostname, html);
    const ogTitle = findMetaContent(html, "property", "og:title");
    const twitterTitle = findMetaContent(html, "name", "twitter:title");
    const ogDescription = findMetaContent(html, "property", "og:description");
    const metaDescription = findMetaContent(html, "name", "description");
    const ogImage = findMetaContent(html, "property", "og:image");
    const twitterImage = findMetaContent(html, "name", "twitter:image");
    const productBrand =
      adapter.brand ||
      findMetaContent(html, "property", "product:brand") ||
      findJsonLdValue(html, "brand") ||
      findMetaContent(html, "name", "brand") ||
      inferBrandFromHostname(parsedUrl.hostname);
    const productCategory =
      findJsonLdValue(html, "category") || findMetaContent(html, "property", "product:category");
    const explicitProductColour =
      sanitizeText(findJsonLdValue(html, "color")) ||
      sanitizeText(findJsonLdValue(html, "colour")) ||
      sanitizeText(findMetaContent(html, "property", "product:color")) ||
      sanitizeText(findMetaContent(html, "property", "product:colour")) ||
      sanitizeText(findMetaContent(html, "name", "color")) ||
      sanitizeText(findMetaContent(html, "name", "colour"));
    const productPrice =
      adapter.price ||
      findMetaContent(html, "property", "product:price:amount") ||
      findJsonLdOfferValue(html, "price");
    const productCurrency =
      adapter.currency ||
      findMetaContent(html, "property", "product:price:currency") ||
      findJsonLdOfferValue(html, "priceCurrency");
    const rawTitle =
      adapter.title ||
      sanitizeText(ogTitle) ||
      sanitizeText(twitterTitle) ||
      sanitizeText(findTitleTag(html)) ||
      deriveTitleFromUrl(parsedUrl);
    const title = cleanProductTitle(rawTitle, sanitizeText(productBrand));
    const category = deriveProductCategory({
      url: parsedUrl,
      title,
      productCategory,
      description: adapter.description || sanitizeText(ogDescription || metaDescription)
    });
    const description = adapter.description || sanitizeText(ogDescription || metaDescription);
    const bodyText = extractBodyDescriptionText(html);
    const colour = deriveProductColour({
      explicitColour: adapter.colour || explicitProductColour,
      url: parsedUrl,
      title,
      description,
      bodyText
    });
    const imageUrl = resolveAbsoluteUrl(
      parsedUrl,
      adapter.image_url || sanitizeText(ogImage) || sanitizeText(twitterImage) || findJsonLdImageValue(html)
    );
    // Body text often contains richer fit/fabric detail than meta descriptions,
    // but also retailer styling advice. Strip styling sentences out before
    // extracting garment facts so "pair with denim" does not become material.
    const stylingSuggestions = extractStylingSuggestionsFromText(bodyText);
    const factualBodyText = removeStylingSentences(bodyText);
    const attributeText = [factualBodyText, description, title].filter(Boolean).join(" ");
    const extracted = extractGarmentAttributesFromText(attributeText);
    const compositionMaterial = extractCompositionMaterialFromHtml(html);

    return {
      title,
      brand: sanitizeText(productBrand),
      category,
      colour,
      fit: extracted.fit,
      material: extracted.material || compositionMaterial,
      retailer,
      description,
      price: sanitizeText(productPrice),
      currency: normalizeCurrency(productCurrency),
      image_url: imageUrl,
      attributes: extracted.attributes,
      styling_suggestions: stylingSuggestions,
    };
  } catch {
    const fallbackTitle = deriveTitleFromUrl(parsedUrl);

    return {
      title: fallbackTitle,
      brand: null,
      category: deriveCategoryFromText(fallbackTitle),
      colour: deriveColourFromText(fallbackTitle),
      fit: null,
      material: null,
      retailer,
      description: null,
      price: null,
      currency: null,
      image_url: null,
      attributes: [],
      styling_suggestions: [],
    };
  }
}

/**
 * Extract a size hint from free-text notes.
 * Conservative — only matches explicit letter sizes, system-prefixed
 * numerics (AU 10, US 6), or numbers preceded by the word "size".
 * Avoids false matches on prices, dates, etc.
 */
export function extractSizeFromNotes(text: string | null | undefined): string | null {
  if (!text) return null;

  // Standard letter sizes — word boundary required on both sides
  const letterMatch = /\b(XXS|XS|(?<![A-Z])S(?![A-Z])|(?<![A-Z])M(?![A-Z])|(?<![A-Z])L(?![A-Z])|XL|XXL|XXXL|3XL)\b/i.exec(text);
  if (letterMatch) return letterMatch[1].toUpperCase();

  // System-prefixed numeric: "AU 10", "US 6", "UK 8", "EU 36"
  const systemMatch = /\b(AU|US|UK|EU|IT)\s*(\d{1,3}(?:\.\d)?)\b/i.exec(text);
  if (systemMatch) return `${systemMatch[1].toUpperCase()} ${systemMatch[2]}`;

  // Explicit keyword: "size 10", "size: 12", "I'm a size 10"
  const sizeKeywordMatch = /\bsize\s*:?\s*(\d{1,3}(?:\.\d)?)\b/i.exec(text);
  if (sizeKeywordMatch) return sizeKeywordMatch[1];

  return null;
}

export function parseReceiptDraftCandidates(params: {
  receiptText: string;
  fallbackTitle?: string | null;
}): ReceiptDraftCandidate[] {
  const normalizedText = params.receiptText.trim();

  if (!normalizedText) {
    return params.fallbackTitle
      ? [
          {
            title: params.fallbackTitle,
            category: deriveCategoryFromText(params.fallbackTitle),
            colour: deriveColourFromText(params.fallbackTitle),
            brand: null,
            retailer: null,
            price: null,
            currency: null,
            notes: null,
            confidence: 0.12
          }
        ]
      : [];
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const inferredRetailer = inferReceiptRetailer(lines);
  const inferredBrand = inferBrandFromReceiptText(normalizedText);
  const inferredCurrency = inferReceiptCurrency(normalizedText);

  const candidates = lines
    .filter((line) => looksLikeReceiptItem(line))
    .map((line) => {
      const cleaned = cleanReceiptLine(line) || line.trim();
      const price = parseReceiptLinePrice(line);
      const parsedLine = parseReceiptLineMetadata({
        cleanedLine: cleaned,
        retailer: inferredRetailer,
        fallbackBrand: inferredBrand
      });

      return {
        title: parsedLine.title,
        category: deriveCategoryFromText(parsedLine.title),
        colour: deriveColourFromText(parsedLine.title),
        brand: parsedLine.brand,
        retailer: inferredRetailer,
        price,
        currency: inferredCurrency,
        notes: null,
        confidence: price != null ? 0.38 : 0.32
      } satisfies ReceiptDraftCandidate;
    });

  if (candidates.length) {
    return candidates.slice(0, 6);
  }

  return params.fallbackTitle
    ? [
        {
          title: params.fallbackTitle,
          category: deriveCategoryFromText(params.fallbackTitle),
          colour: deriveColourFromText(params.fallbackTitle),
          brand: inferredBrand,
          retailer: inferredRetailer,
          price: null,
          currency: inferredCurrency,
          notes: normalizedText.slice(0, 300),
          confidence: 0.16
        }
      ]
    : [];
}

export async function readReceiptTextFromFile(file: File): Promise<string | null> {
  const lowerName = file.name.toLowerCase();

  if (file.type.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".csv")) {
    return sanitizeText(await file.text());
  }

  return null;
}

function findMetaContent(html: string, attrName: string, attrValue: string) {
  const pattern = new RegExp(
    `<meta[^>]*${attrName}=["']${escapeRegExp(attrValue)}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return pattern.exec(html)?.[1] ?? null;
}

function findTitleTag(html: string) {
  return /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
}

function findJsonLdValue(html: string, field: string) {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

  for (const script of scripts) {
    const raw = script
      .replace(/<script[^>]*>/i, "")
      .replace(/<\/script>/i, "")
      .trim();

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        const value = node[field];

        if (typeof value === "string") {
          return value;
        }

        if (field === "brand" && value && typeof value === "object" && "name" in value) {
          const nested = (value as { name?: unknown }).name;

          if (typeof nested === "string") {
            return nested;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findJsonLdOfferValue(html: string, field: string) {
  const scripts =
    html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    ) ?? [];

  for (const script of scripts) {
    const raw = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        const offers = node.offers;
        const offerNodes = Array.isArray(offers) ? offers : offers ? [offers] : [];

        for (const offer of offerNodes) {
          if (offer && typeof offer === "object" && field in offer) {
            const value = (offer as Record<string, unknown>)[field];

            if (typeof value === "string" || typeof value === "number") {
              return String(value);
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findJsonLdImageValue(html: string) {
  const scripts =
    html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    ) ?? [];

  for (const script of scripts) {
    const raw = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown> | Record<string, unknown>[];
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        const image = node.image;

        if (typeof image === "string") {
          return image;
        }

        if (Array.isArray(image)) {
          const firstString = image.find((value): value is string => typeof value === "string");
          if (firstString) {
            return firstString;
          }
        }

        if (image && typeof image === "object" && "url" in image) {
          const url = (image as { url?: unknown }).url;
          if (typeof url === "string") {
            return url;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function deriveTitleFromUrl(url: URL) {
  const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return sanitizeText(slug || url.hostname.replace(/^www\./, ""));
}

function deriveCategoryFromText(value: string | null) {
  const haystack = value?.toLowerCase() || "";

  for (const entry of PRIORITY_CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => hasWholeWordMatch(haystack, keyword))) {
      return entry.category;
    }
  }

  const match = CLOTHING_KEYWORDS.find((keyword) => hasWholeWordMatch(haystack, keyword));
  if (!match) return null;
  if (match === "t-shirt" || match === "tee") return "top";
  return match;
}

function deriveProductCategory(params: {
  url: URL;
  title: string | null;
  productCategory: string | null;
  description: string | null;
}) {
  const combinedText = [
    params.productCategory,
    params.title,
    params.description,
    params.url.pathname.replace(/[-_/]+/g, " ")
  ]
    .filter(Boolean)
    .join(" ");

  return deriveCategoryFromText(combinedText) || "top";
}

function deriveProductColour(params: {
  explicitColour: string | null;
  url: URL;
  title: string | null;
  description: string | null;
  bodyText: string | null;
}) {
  return (
    deriveColourFromText(params.explicitColour) ||
    deriveColourFromText(deriveTitleFromUrl(params.url)) ||
    deriveColourFromText(params.title) ||
    deriveColourFromText(params.description) ||
    deriveColourFromText(params.bodyText)
  );
}

function deriveColourFromText(value: string | null) {
  const haystack = value?.toLowerCase() || "";

  for (const colour of COLOUR_WORDS) {
    if (hasWholeWordMatch(haystack, colour.token)) {
      return colour.value;
    }
  }

  return null;
}

function hasWholeWordMatch(haystack: string, token: string) {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(haystack);
}

function looksLikeReceiptItem(line: string) {
  const normalized = line.toLowerCase();

  if (normalized.length < 4) {
    return false;
  }

  if (/subtotal|total|tax|gst|visa|eftpos|change|receipt|invoice|auth|terminal/.test(normalized)) {
    return false;
  }

  const hasCurrencyTail = /(\$|aud|usd|eur)?\s?\d+[.,]\d{2}$/i.test(normalized);
  const mentionsClothing = CLOTHING_KEYWORDS.some((keyword) => normalized.includes(keyword));

  return hasCurrencyTail || mentionsClothing;
}

function cleanReceiptLine(line: string) {
  return sanitizeText(
    line
      .replace(/(\$|aud|usd|eur)\s?\d+[.,]\d{2}$/gi, "")
      .replace(/\bqty\b.*$/i, "")
      .replace(/\s{2,}/g, " ")
  );
}

function parseReceiptLinePrice(line: string) {
  const match = line.match(/(?:\$|aud|usd|eur)?\s?(\d+[.,]\d{2})$/i);

  if (!match?.[1]) {
    return null;
  }

  const normalized = Number(match[1].replace(",", "."));
  return Number.isFinite(normalized) ? normalized : null;
}

function sanitizeText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCurrency(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length === 3 ? normalized : null;
}

function resolveAbsoluteUrl(baseUrl: URL, candidate: string | null | undefined) {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

function inferReceiptCurrency(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes(" aud") || lower.includes("$")) {
    return "AUD";
  }

  if (lower.includes(" usd")) {
    return "USD";
  }

  if (lower.includes(" eur") || lower.includes("€")) {
    return "EUR";
  }

  return null;
}

function inferReceiptRetailer(lines: string[]) {
  const candidate = lines.find((line) => {
    const normalized = line.toLowerCase();
    return (
      normalized.length >= 3 &&
      normalized.length <= 50 &&
      !/subtotal|total|tax|gst|visa|eftpos|change|receipt|invoice|auth|terminal/.test(
        normalized
      ) &&
      !/\d+[.,]\d{2}/.test(normalized)
    );
  });

  return normalizeReceiptMerchantLabel(candidate);
}

function inferBrandFromReceiptLine(line: string) {
  const trimmed = sanitizeText(line);

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^([A-Z][A-Z& ]{2,30})\b/);

  if (!match?.[1]) {
    return null;
  }

  const value = sanitizeText(match[1]);
  return value && value.length >= 3 ? value : null;
}

function parseReceiptLineMetadata(params: {
  cleanedLine: string;
  retailer: string | null;
  fallbackBrand: string | null;
}) {
  const retailer = params.retailer?.toLowerCase() || "";
  const cleanedLine = sanitizeText(params.cleanedLine) || "";

  if (retailer.includes("viktoria & woods")) {
    const title = cleanedLine
      .replace(/^viktoria\s*&\s*woods\b[:\-\s]*/i, "")
      .trim();

    return {
      title: title || cleanedLine,
      brand: "Viktoria & Woods"
    };
  }

  if (retailer.includes("myer")) {
    const tokens = cleanedLine.split(/\s+/).filter(Boolean);
    const brand = sanitizeText(tokens[0]) || params.fallbackBrand;
    const title = brand
      ? cleanedLine.replace(new RegExp(`^${escapeRegExp(brand)}\\s+`, "i"), "").trim()
      : cleanedLine;

    return {
      title: title || cleanedLine,
      brand
    };
  }

  return {
    title: cleanedLine,
    brand: inferBrandFromReceiptLine(cleanedLine) || params.fallbackBrand
  };
}

function inferBrandFromReceiptText(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("reformation")) {
    return "Reformation";
  }

  if (lower.includes("farfetch")) {
    return "Farfetch";
  }

  if (lower.includes("viktoria") && lower.includes("woods")) {
    return "Viktoria & Woods";
  }

  if (lower.includes("david jones")) {
    return "David Jones";
  }

  if (lower.includes("myer")) {
    return "Myer";
  }

  if (lower.includes("the iconic")) {
    return "The Iconic";
  }

  return null;
}

function normalizeReceiptMerchantLabel(value: string | null | undefined) {
  const normalized = sanitizeText(value);

  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();

  if (lower.includes("viktoria") && lower.includes("woods")) {
    return "Viktoria & Woods";
  }

  if (lower.includes("myer")) {
    return "Myer";
  }

  if (lower.includes("david jones")) {
    return "David Jones";
  }

  if (lower.includes("farfetch")) {
    return "Farfetch";
  }

  if (lower.includes("reformation")) {
    return "Reformation";
  }

  if (lower.includes("the iconic")) {
    return "The Iconic";
  }

  return normalized;
}

/**
 * Body text extraction for rich attribute parsing.
 *
 * Meta descriptions are often too short to contain fit/fabric vocabulary.
 * This function extracts fuller product description text from the HTML body
 * by trying structured markup first (itemprop), then common class patterns
 * used by Shopify, WooCommerce, Net-a-Porter, ASOS, and similar platforms.
 *
 * Result is used for attribute extraction only — not stored as garment.description.
 */
function extractBodyDescriptionText(html: string): string | null {
  // 1. itemprop="description" — reliable structured markup, used by many retailers
  const itempropText = extractElementByAttribute(html, "itemprop", "description");
  if (itempropText && itempropText.length > 30) return itempropText.slice(0, 3000);

  // 2. Common product description class fragments across platforms, ordered by reliability
  const classFragments = [
    // Shopify themes
    "product__description",
    "product-single__description",
    "product__synopsis",
    "product__info-description",
    // Generic / WooCommerce / custom
    "product-description",
    "product-details__description",
    "product-detail__description",
    "product__content",
    "product__body",
    "pdp-description",
    "pdp__description",
    "item-description",
    // Net-a-Porter / MrPorter
    "product-details__description",
    "editorial-description",
    // ASOS
    "product-description__heading",
  ];

  for (const fragment of classFragments) {
    const text = extractElementByClassFragment(html, fragment);
    if (text && text.length > 30) return text.slice(0, 3000);
  }

  return null;
}

function removeStylingSentences(text: string | null) {
  if (!text) {
    return null;
  }

  const sentences = splitIntoSentences(text).filter((sentence) => !isStylingSentence(sentence));
  return sentences.length ? sentences.join(" ") : null;
}

function extractStylingSuggestionsFromText(text: string | null): StylingSuggestion[] {
  if (!text) {
    return [];
  }

  const suggestions: StylingSuggestion[] = [];

  for (const sentence of splitIntoSentences(text)) {
    const normalizedSentence = sentence.trim();

    if (!normalizedSentence || !isStylingSentence(normalizedSentence)) {
      continue;
    }

    const pairMatch = /\bpair(?:ed)?(?:\s+\w+){0,3}\s+with\s+(.+)$/i.exec(normalizedSentence);
    if (pairMatch?.[1]) {
      const terms = normalizeStylingTerms(
        pairMatch[1].replace(/\b(?:,?\s*or\s+)?layer(?:ed|ing)?(?:\s+\w+){0,3}\s+with\s+.+$/i, "")
      );
      if (terms.length) {
        suggestions.push({
          predicate: "pairs_with",
          terms,
          raw_text: normalizedSentence,
          source: "retailer_copy"
        });
      }
    }

    const layerMatch = /\blayer(?:ed|ing)?(?:\s+\w+){0,3}\s+with\s+(.+)$/i.exec(normalizedSentence);
    if (layerMatch?.[1]) {
      const terms = normalizeStylingTerms(layerMatch[1]);
      if (terms.length) {
        suggestions.push({
          predicate: "layer_with",
          terms,
          raw_text: normalizedSentence,
          source: "retailer_copy"
        });
      }
    }
  }

  return suggestions;
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sanitizeText(sentence))
    .filter((sentence): sentence is string => Boolean(sentence));
}

function isStylingSentence(sentence: string) {
  return /\b(pair|style|wear|layer)(?:ed|ing)?\b/i.test(sentence);
}

function normalizeStylingTerms(value: string) {
  return value
    .replace(/[.;:]+$/g, "")
    .split(/\b(?:,|and|or)\b/i)
    .map((term) =>
      sanitizeText(
        term
          .replace(/\b(?:casually|easily|effortlessly|simply|perfectly|beautifully|well)\b/gi, "")
          .replace(/\b(?:with|into|over|under)\b/gi, "")
      )
    )
    .filter((term): term is string => Boolean(term));
}

function extractElementByAttribute(html: string, attr: string, value: string): string | null {
  const openTagRe = new RegExp(
    `<(\\w+)[^>]*\\b${escapeRegExp(attr)}=["']${escapeRegExp(value)}["'][^>]*>`,
    "i"
  );
  const openMatch = openTagRe.exec(html);
  if (!openMatch) return null;

  const tagName = openMatch[1].toLowerCase();
  const contentStart = openMatch.index + openMatch[0].length;
  const closeRe = new RegExp(`</${escapeRegExp(tagName)}>`, "i");
  const closeMatch = closeRe.exec(html.slice(contentStart));
  if (!closeMatch) return null;

  return stripHtmlTags(html.slice(contentStart, contentStart + closeMatch.index));
}

function extractElementByClassFragment(html: string, classFragment: string): string | null {
  const openTagRe = new RegExp(
    `<(\\w+)[^>]*class=["'][^"']*${escapeRegExp(classFragment)}[^"']*["'][^>]*>`,
    "i"
  );
  const openMatch = openTagRe.exec(html);
  if (!openMatch) return null;

  const tagName = openMatch[1].toLowerCase();
  const contentStart = openMatch.index + openMatch[0].length;
  const closeRe = new RegExp(`</${escapeRegExp(tagName)}>`, "i");
  const closeMatch = closeRe.exec(html.slice(contentStart));
  if (!closeMatch) return null;

  return stripHtmlTags(html.slice(contentStart, contentStart + closeMatch.index));
}

function extractCompositionMaterialFromHtml(html: string): string | null {
  const text = stripHtmlTags(html);

  const mainAndLiningMatch =
    /main\s*:?\s*((?:\d+%\s*[a-z]+(?:\s*,?\s*|\s+)){1,8})\s+lining\s*:?\s*((?:\d+%\s*[a-z]+(?:\s*,?\s*|\s+)){1,8})/i.exec(
      text
    );

  if (mainAndLiningMatch?.[1]) {
    const main = normalizeCompositionSegment(mainAndLiningMatch[1]);
    const lining = normalizeCompositionSegment(mainAndLiningMatch[2]);

    return lining ? `${main}; Lining: ${lining}` : main;
  }

  const mainOnlyMatch =
    /main\s*:?\s*((?:\d+%\s*[a-z]+(?:\s*,?\s*|\s+)){1,8})/i.exec(text);
  if (mainOnlyMatch?.[1]) {
    return normalizeCompositionSegment(mainOnlyMatch[1]);
  }

  const compositionOnlyMatch =
    /((?:\d+%\s*[a-z]+(?:\s*,?\s*|\s+)){2,8})/i.exec(text);
  if (compositionOnlyMatch?.[1]) {
    return normalizeCompositionSegment(compositionOnlyMatch[1]);
  }

  return null;
}

function normalizeCompositionSegment(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parts = value.match(/\d+%\s*[A-Za-z]+/g) ?? [];
  if (!parts.length) {
    return null;
  }

  return parts.map((part) => part.replace(/\s+/g, " ").trim()).join(", ");
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Noise phrases that appear at the start of page <title> tags on some retailers
const TITLE_NOISE_PREFIXES = [
  /^garment\s+detail\s*/i,
  /^product\s+detail\s*/i,
  /^shop\s+/i,
  /^buy\s+/i,
];

/**
 * Clean a raw page title into a concise product name.
 *
 * Handles three common retail patterns:
 *   1. Pipe-delimited nav breadcrumbs: "Product | Category | Brand" → "Product"
 *   2. Dash-delimited brand suffix: "Product - Brand Name" → "Product"
 *   3. ALL CAPS titles → converted to Title Case
 *   4. Leading noise prefixes ("GARMENT DETAIL ", "SHOP ") → stripped
 */
function cleanProductTitle(raw: string | null, brand?: string | null): string | null {
  if (!raw) return null;

  let title = raw.trim();

  // Strip pipe-delimited site-structure suffixes — take only the first segment
  const pipeParts = title.split(/\s*\|\s*/);
  if (pipeParts.length > 1) {
    title = pipeParts[0].trim();
  }

  // Strip dash-delimited brand suffix when the brand is known
  if (brand) {
    const dashBrandRe = new RegExp(`\\s*[-–]\\s*${escapeRegExp(brand)}\\s*$`, "i");
    title = title.replace(dashBrandRe, "").trim();
  }

  // Strip known leading noise phrases
  for (const prefix of TITLE_NOISE_PREFIXES) {
    title = title.replace(prefix, "").trim();
  }

  // Convert ALL CAPS to Title Case (common on Australian fashion retailers)
  if (title.length > 2 && title === title.toUpperCase()) {
    title = toTitleCase(title);
  }

  return sanitizeText(title);
}

const TITLE_CASE_LOWERCASE = new Set([
  "a", "an", "the", "in", "on", "at", "for", "of", "and", "but", "or", "nor", "with",
]);

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word, i) =>
      i === 0 || !TITLE_CASE_LOWERCASE.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(" ");
}

function inferBrandFromHostname(hostname: string) {
  const host = hostname.replace(/^www\./, "").toLowerCase();

  if (host.includes("thereformation") || host.includes("reformation")) {
    return "Reformation";
  }

  if (host.includes("viktoriaandwoods")) {
    return "Viktoria & Woods";
  }

  return null;
}

function extractRetailerAdapterMetadata(
  hostname: string,
  html: string
): RetailerAdapterMetadata {
  const host = hostname.replace(/^www\./, "").toLowerCase();

  if (host.includes("farfetch")) {
    return {
      title:
        sanitizeText(findMetaContent(html, "property", "og:title")) ||
        sanitizeText(/"name":"([^"]+)"/i.exec(html)?.[1]),
      brand:
        sanitizeText(/"designerName":"([^"]+)"/i.exec(html)?.[1]) ||
        sanitizeText(findJsonLdValue(html, "brand")),
      price:
        sanitizeText(/"price":"([^"]+)"/i.exec(html)?.[1]) ||
        sanitizeText(findJsonLdOfferValue(html, "price")),
      currency:
        normalizeCurrency(/"currency":"([^"]+)"/i.exec(html)?.[1]) ||
        normalizeCurrency(findJsonLdOfferValue(html, "priceCurrency")),
      description: sanitizeText(findMetaContent(html, "name", "description")),
      image_url:
        sanitizeText(findMetaContent(html, "property", "og:image")) ||
        sanitizeText(/"images"\s*:\s*\["([^"]+)"/i.exec(html)?.[1]) ||
        findJsonLdImageValue(html)
    };
  }

  if (host.includes("theiconic")) {
    return {
      title:
        sanitizeText(findMetaContent(html, "property", "og:title")) ||
        sanitizeText(/"name":"([^"]+)"/i.exec(html)?.[1]),
      brand:
        sanitizeText(/"brand":"([^"]+)"/i.exec(html)?.[1]) ||
        sanitizeText(findJsonLdValue(html, "brand")),
      price:
        sanitizeText(/"price":"([^"]+)"/i.exec(html)?.[1]) ||
        sanitizeText(findJsonLdOfferValue(html, "price")),
      currency:
        normalizeCurrency(/"priceCurrency":"([^"]+)"/i.exec(html)?.[1]) ||
        normalizeCurrency(findJsonLdOfferValue(html, "priceCurrency")),
      description: sanitizeText(findMetaContent(html, "name", "description")),
      image_url:
        sanitizeText(findMetaContent(html, "property", "og:image")) ||
        findJsonLdImageValue(html)
    };
  }

  if (
    host.includes("reformation") ||
    host.includes("viktoriaandwoods") ||
    host.includes("davidjones") ||
    host.includes("myer")
  ) {
    return {
      title: sanitizeText(findMetaContent(html, "property", "og:title")) || sanitizeText(findTitleTag(html)),
      brand:
        sanitizeText(findJsonLdValue(html, "brand")) ||
        sanitizeText(findMetaContent(html, "property", "product:brand")) ||
        inferBrandFromHostname(hostname),
      price:
        sanitizeText(findMetaContent(html, "property", "product:price:amount")) ||
        sanitizeText(findJsonLdOfferValue(html, "price")),
      currency:
        normalizeCurrency(findMetaContent(html, "property", "product:price:currency")) ||
        normalizeCurrency(findJsonLdOfferValue(html, "priceCurrency")),
      description: sanitizeText(findMetaContent(html, "name", "description")),
      image_url:
        sanitizeText(findMetaContent(html, "property", "og:image")) ||
        sanitizeText(findMetaContent(html, "name", "twitter:image")) ||
        findJsonLdImageValue(html)
    };
  }

  return {
    title: null,
    brand: null,
    price: null,
    currency: null,
    description: null,
    image_url: null
  };
}
