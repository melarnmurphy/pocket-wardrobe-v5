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

const COLOUR_WORDS = [
  "black",
  "white",
  "cream",
  "ivory",
  "grey",
  "gray",
  "navy",
  "blue",
  "red",
  "burgundy",
  "green",
  "olive",
  "brown",
  "tan",
  "beige",
  "camel",
  "pink",
  "yellow",
  "gold",
  "silver"
] as const;

type ProductMetadata = {
  title: string | null;
  brand: string | null;
  category: string | null;
  colour: string | null;
  retailer: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
};

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

export async function extractProductMetadataFromUrl(url: string): Promise<ProductMetadata> {
  const parsedUrl = new URL(url);
  const retailer = sanitizeText(parsedUrl.hostname.replace(/^www\./, ""));

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; PocketWardrobeBot/0.1; +https://example.com/bot)"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        title: deriveTitleFromUrl(parsedUrl),
        brand: null,
        category: deriveCategoryFromText(deriveTitleFromUrl(parsedUrl)),
        colour: deriveColourFromText(deriveTitleFromUrl(parsedUrl)),
        retailer,
        description: null,
        price: null,
        currency: null
      };
    }

    const html = await response.text();
    const adapter = extractRetailerAdapterMetadata(parsedUrl.hostname, html);
    const ogTitle = findMetaContent(html, "property", "og:title");
    const twitterTitle = findMetaContent(html, "name", "twitter:title");
    const ogDescription = findMetaContent(html, "property", "og:description");
    const metaDescription = findMetaContent(html, "name", "description");
    const productBrand =
      adapter.brand ||
      findMetaContent(html, "property", "product:brand") ||
      findJsonLdValue(html, "brand") ||
      findMetaContent(html, "name", "brand") ||
      inferBrandFromHostname(parsedUrl.hostname);
    const productCategory =
      findJsonLdValue(html, "category") || findMetaContent(html, "property", "product:category");
    const productPrice =
      adapter.price ||
      findMetaContent(html, "property", "product:price:amount") ||
      findJsonLdOfferValue(html, "price");
    const productCurrency =
      adapter.currency ||
      findMetaContent(html, "property", "product:price:currency") ||
      findJsonLdOfferValue(html, "priceCurrency");
    const title =
      adapter.title ||
      sanitizeText(ogTitle) ||
      sanitizeText(twitterTitle) ||
      sanitizeText(findTitleTag(html)) ||
      deriveTitleFromUrl(parsedUrl);
    const category = deriveCategoryFromText(productCategory || title);
    const colour = deriveColourFromText(`${title || ""} ${ogDescription || ""}`);

    return {
      title,
      brand: sanitizeText(productBrand),
      category,
      colour,
      retailer,
      description: adapter.description || sanitizeText(ogDescription || metaDescription),
      price: sanitizeText(productPrice),
      currency: normalizeCurrency(productCurrency)
    };
  } catch {
    const fallbackTitle = deriveTitleFromUrl(parsedUrl);

    return {
      title: fallbackTitle,
      brand: null,
      category: deriveCategoryFromText(fallbackTitle),
      colour: deriveColourFromText(fallbackTitle),
      retailer,
      description: null,
      price: null,
      currency: null
    };
  }
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

function deriveTitleFromUrl(url: URL) {
  const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return sanitizeText(slug || url.hostname.replace(/^www\./, ""));
}

function deriveCategoryFromText(value: string | null) {
  const haystack = value?.toLowerCase() || "";
  const match = CLOTHING_KEYWORDS.find((keyword) => haystack.includes(keyword));
  return match ? match.replace("t-shirt", "top") : null;
}

function deriveColourFromText(value: string | null) {
  const haystack = value?.toLowerCase() || "";
  const match = COLOUR_WORDS.find((word) => haystack.includes(word));
  return match === "gray" ? "grey" : match ?? null;
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

function extractRetailerAdapterMetadata(hostname: string, html: string) {
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
      description: sanitizeText(findMetaContent(html, "name", "description"))
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
      description: sanitizeText(findMetaContent(html, "name", "description"))
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
      description: sanitizeText(findMetaContent(html, "name", "description"))
    };
  }

  return {
    title: null,
    brand: null,
    price: null,
    currency: null,
    description: null
  };
}
