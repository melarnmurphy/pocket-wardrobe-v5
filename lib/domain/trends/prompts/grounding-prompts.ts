/**
 * Gemini Google-Grounding scanner prompts for the trends engine.
 *
 * Mirrors the maci watchlist pattern (`lib/watch-runner.ts:435-816` in the
 * maci repo): a grounded search call returns snippets + citations from
 * Google's index, which are then handed to the existing structured
 * extraction step (`lib/domain/trends/extraction.ts:buildExtractionPrompt`).
 *
 * Why grounding instead of fetching publisher HTML directly:
 *   - Vogue, Harper's Bazaar, WWD have restrictive robots.txt that block
 *     direct article fetches from our crawler.
 *   - Google's index already has indexing permission from these publishers.
 *   - Gemini returns Google-served snippets + the canonical URL, so we get
 *     the signal without ever hitting the publisher's server.
 *
 * NOTE: This module defines prompts + scanner config only. The adapter that
 * actually invokes Gemini and bridges the output into
 * `processExtractionJob()` is not yet wired up — see the design notes in
 * the README/conversation thread.
 */

import { TREND_TYPES, type TrendType } from "../index";

export type ScannerArchetype =
  | "editorial"
  | "runway"
  | "street_social"
  | "colour_authority"
  | "design_house"
  | "fashion_week"
  | "it_girl_discovery";

export interface GroundingScanner {
  archetype: ScannerArchetype;
  /** Trend types this scanner is responsible for surfacing. */
  targetTrendTypes: readonly TrendType[];
  /** Domains to bias the grounded search toward via `site:` operators. */
  preferredSites: readonly string[];
  /** Per-domain authority score baseline; aligns with the RSS adapter scoring. */
  authorityByDomain: Readonly<Record<string, number>>;
  /** How often this scanner is expected to run, in days. */
  defaultCadenceDays: number;
  /** How far back the grounded search query should look. */
  recencyWindowDays: number;
  /** Builds the natural-language query handed to Gemini's `googleSearch` tool. */
  buildGroundingQuery: (input: ScannerRunInput) => string;
}

export interface ScannerRunInput {
  /** ISO timestamp of "now" — anchors the `after:` date filter. */
  now: string;
  /** Optional explicit season override, e.g. "FW26", "SS26". */
  season?: string;
  /** Optional region scope, e.g. "Milan", "New York". */
  region?: string;
  /** Canonical labels we've already extracted in the last N runs.
   *  Passed into the prompt so the LLM can flag delta="new"|"intensifying"|"fading"
   *  rather than re-extracting the same trends every cycle. */
  previousLabels?: readonly string[];
}

const isoDaysAgo = (now: string, days: number): string => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const formatPreviousLabels = (labels?: readonly string[]): string => {
  if (!labels || labels.length === 0) return "  (none — this is the first run)";
  return labels
    .slice(0, 50)
    .map((l) => `  - ${l}`)
    .join("\n");
};

const formatSiteFilter = (sites: readonly string[]): string =>
  sites.map((s) => `site:${s}`).join(" OR ");

/**
 * Editorial scanner — feature writing in the major fashion editorials.
 * Cadence: weekly. Targets the "softer" trend types where narrative matters.
 */
const editorialScanner: GroundingScanner = {
  archetype: "editorial",
  targetTrendTypes: ["aesthetic", "styling", "occasion", "era_influence"],
  preferredSites: [
    "vogue.com",
    "harpersbazaar.com",
    "wwd.com",
    "businessoffashion.com",
    "elle.com"
  ],
  authorityByDomain: {
    "vogue.com": 0.85,
    "harpersbazaar.com": 0.8,
    "wwd.com": 0.9,
    "businessoffashion.com": 0.9,
    "elle.com": 0.7
  },
  defaultCadenceDays: 7,
  recencyWindowDays: 7,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 7);
    const sites = formatSiteFilter([
      "vogue.com",
      "harpersbazaar.com",
      "wwd.com",
      "businessoffashion.com",
      "elle.com"
    ]);
    return [
      `fashion trend OR aesthetic OR styling (${sites}) after:${sinceDate}`,
      input.season ? `${input.season} season` : null,
      input.region ? `${input.region}` : null,
      "Summarise the concrete trends being called out this week.",
      "Cite the originating article URL for each claim."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

/**
 * Runway scanner — show reviews, look-by-look coverage, designer notes.
 * Cadence: daily during fashion weeks (Feb, Sep), weekly otherwise.
 */
const runwayScanner: GroundingScanner = {
  archetype: "runway",
  targetTrendTypes: ["silhouette", "garment", "material", "pattern", "colour"],
  preferredSites: [
    "vogue.com/fashion-shows",
    "tagwalk.com",
    "wwd.com",
    "hypebeast.com",
    "showstudio.com"
  ],
  authorityByDomain: {
    "vogue.com": 0.95, // runway coverage = primary source
    "tagwalk.com": 0.9,
    "wwd.com": 0.9,
    "hypebeast.com": 0.7,
    "showstudio.com": 0.85
  },
  defaultCadenceDays: 1,
  recencyWindowDays: 3,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 3);
    const sites = formatSiteFilter([
      "vogue.com",
      "tagwalk.com",
      "wwd.com",
      "showstudio.com"
    ]);
    return [
      `runway review OR collection OR show (${sites}) after:${sinceDate}`,
      input.season ? `${input.season}` : "current season",
      input.region ?? "",
      "List the recurring silhouettes, fabrics, prints, and colours seen across multiple shows.",
      "Cite the originating review URL for each."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

/**
 * Street/social scanner — viral or emerging signals from street style and
 * editorial social accounts. Avoids direct TikTok/IG scraping; relies on
 * Google's index of recap/round-up coverage.
 */
const streetSocialScanner: GroundingScanner = {
  archetype: "street_social",
  targetTrendTypes: ["garment", "styling", "aesthetic"],
  preferredSites: [
    "vogue.com/article/street-style",
    "harpersbazaar.com",
    "highsnobiety.com",
    "i-d.co",
    "dazeddigital.com"
  ],
  authorityByDomain: {
    "vogue.com": 0.8,
    "harpersbazaar.com": 0.75,
    "highsnobiety.com": 0.7,
    "i-d.co": 0.75,
    "dazeddigital.com": 0.7
  },
  defaultCadenceDays: 1,
  recencyWindowDays: 7,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 7);
    const sites = formatSiteFilter([
      "highsnobiety.com",
      "i-d.co",
      "dazeddigital.com",
      "vogue.com",
      "harpersbazaar.com"
    ]);
    return [
      `street style OR viral OR tiktok fashion trend (${sites}) after:${sinceDate}`,
      input.region ?? "",
      "Surface micro-trends and emerging garment categories that are spreading right now.",
      "Cite the originating article URL for each."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

/**
 * Colour-authority scanner — Pantone, WGSN-adjacent, dedicated colour reports.
 * Cadence: monthly. Bias-weighted heavily for the `colour` trend type.
 */
const colourAuthorityScanner: GroundingScanner = {
  archetype: "colour_authority",
  targetTrendTypes: ["colour"],
  preferredSites: [
    "pantone.com",
    "wgsn.com",
    "vogue.com",
    "businessoffashion.com",
    "wwd.com"
  ],
  authorityByDomain: {
    "pantone.com": 0.95,
    "wgsn.com": 0.9,
    "vogue.com": 0.85,
    "businessoffashion.com": 0.9,
    "wwd.com": 0.85
  },
  defaultCadenceDays: 30,
  recencyWindowDays: 45,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 45);
    const sites = formatSiteFilter([
      "pantone.com",
      "vogue.com",
      "businessoffashion.com",
      "wwd.com"
    ]);
    return [
      `colour trend OR colour of the season OR palette (${sites}) after:${sinceDate}`,
      input.season ?? "",
      "Identify the colours being called out as ascendant for this season.",
      "Where possible, include hex codes or Pantone references and cite the source URL."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

/**
 * Design house scanner — collection drops and releases from established designers.
 * Cadence: weekly. Targets garment, material, silhouette, aesthetic, pattern types.
 */
const designHouseScanner: GroundingScanner = {
  archetype: "design_house",
  targetTrendTypes: ["garment", "material", "silhouette", "aesthetic", "pattern"],
  preferredSites: [
    "vogue.com",
    "wwd.com",
    "businessoffashion.com",
    "hypebeast.com",
    "ssense.com"
  ],
  authorityByDomain: {
    "vogue.com": 0.9,
    "wwd.com": 0.9,
    "businessoffashion.com": 0.9,
    "hypebeast.com": 0.75,
    "ssense.com": 0.8
  },
  defaultCadenceDays: 7,
  recencyWindowDays: 14,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 14);
    const sites = formatSiteFilter([
      "vogue.com",
      "wwd.com",
      "businessoffashion.com",
      "hypebeast.com"
    ]);
    return [
      `fashion house collection OR new release OR design house drop (${sites}) after:${sinceDate}`,
      input.season ?? "current season",
      "For each trend or look mentioned, name the specific design house (e.g. Prada, Bottega Veneta, Celine, Acne Studios).",
      "Extract the key garments, materials, and silhouettes per house. Cite the source URL."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

/**
 * Fashion week scanner — show reviews and runway coverage during fashion weeks.
 * Cadence: daily during fashion weeks (Feb, Sep), weekly otherwise.
 * Targets silhouette, garment, material, pattern, colour types.
 */
const fashionWeekScanner: GroundingScanner = {
  archetype: "fashion_week",
  targetTrendTypes: ["silhouette", "garment", "material", "pattern", "colour"],
  preferredSites: [
    "vogue.com/fashion-shows",
    "tagwalk.com",
    "wwd.com",
    "showstudio.com",
    "vogue.co.uk"
  ],
  authorityByDomain: {
    "vogue.com": 0.95,
    "tagwalk.com": 0.9,
    "wwd.com": 0.9,
    "showstudio.com": 0.85,
    "vogue.co.uk": 0.85
  },
  defaultCadenceDays: 1,
  recencyWindowDays: 7,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 7);
    const sites = formatSiteFilter([
      "vogue.com",
      "tagwalk.com",
      "wwd.com",
      "showstudio.com"
    ]);
    return [
      `fashion week runway show collection review (${sites}) after:${sinceDate}`,
      input.season ?? "current season",
      input.region ?? "",
      "Name the design house for each look. Surface repeated silhouettes, fabrics, prints across shows.",
      "Include specific looks like 'transparent denim at Coperni'. Cite source URLs."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

/**
 * It-girl discovery scanner — best-dressed and style icon coverage.
 * Cadence: every 3 days. Targets styling, garment, aesthetic types.
 */
const itGirlDiscoveryScanner: GroundingScanner = {
  archetype: "it_girl_discovery",
  targetTrendTypes: ["styling", "garment", "aesthetic"],
  preferredSites: [
    "vogue.com",
    "harpersbazaar.com",
    "whowhatwear.com",
    "elle.com",
    "i-d.co"
  ],
  authorityByDomain: {
    "vogue.com": 0.85,
    "harpersbazaar.com": 0.8,
    "whowhatwear.com": 0.8,
    "elle.com": 0.75,
    "i-d.co": 0.75
  },
  defaultCadenceDays: 3,
  recencyWindowDays: 14,
  buildGroundingQuery: (input) => {
    const sinceDate = isoDaysAgo(input.now, 14);
    const sites = formatSiteFilter([
      "vogue.com",
      "harpersbazaar.com",
      "whowhatwear.com",
      "elle.com"
    ]);
    return [
      `best dressed OR it girl OR style icon OR street style (${sites}) after:${sinceDate}`,
      "Name the specific people being called out as style references (models, actresses, socialites, musicians).",
      "For each person, note what they wore — specific garments, styling choices, brands.",
      "Cite the source URL for each."
    ]
      .filter(Boolean)
      .join(" ");
  }
};

export const SCANNERS: readonly GroundingScanner[] = [
  editorialScanner,
  runwayScanner,
  streetSocialScanner,
  colourAuthorityScanner,
  designHouseScanner,
  fashionWeekScanner,
  itGirlDiscoveryScanner
] as const;

export const SCANNER_BY_ARCHETYPE: Readonly<Record<ScannerArchetype, GroundingScanner>> =
  {
    editorial: editorialScanner,
    runway: runwayScanner,
    street_social: streetSocialScanner,
    colour_authority: colourAuthorityScanner,
    design_house: designHouseScanner,
    fashion_week: fashionWeekScanner,
    it_girl_discovery: itGirlDiscoveryScanner
  };

/**
 * Builds the second-stage extraction prompt that turns grounded snippets
 * into ExtractedSignal records. Wraps the existing `buildExtractionPrompt`
 * with previously-seen-label context so the LLM can flag deltas.
 *
 * Use the returned string as the `excerpt` field (or as a wrapping prompt)
 * when calling into `extraction.ts:processExtractionJob`.
 */
export function buildScannerExtractionContext(args: {
  scanner: GroundingScanner;
  groundingSummary: string;
  citations: readonly { title: string; url: string }[];
  previousLabels?: readonly string[];
}): string {
  const allowedTypes = args.scanner.targetTrendTypes.join(", ");
  const validTypes = TREND_TYPES.join(", ");
  const seen = formatPreviousLabels(args.previousLabels);
  const cites = args.citations
    .map((c, i) => `  [${i + 1}] ${c.title} — ${c.url}`)
    .join("\n");

  return `Scanner: ${args.scanner.archetype}
Target trend types for this scanner (prioritise these): ${allowedTypes}
Valid trend_type values overall: ${validTypes}

Previously surfaced labels (do NOT re-surface as "new"; if they appear
again, mark delta="intensifying"; if they're notably absent, ignore):
${seen}

Grounded summary from Google index:
${args.groundingSummary}

Citations:
${cites}

Extract concrete trend signals from the summary above. For each, return:
  trend_type, label, normalized_attributes, season, region, confidence,
  delta ("new" | "intensifying" | "fading"),
  source_citation_index (1-based index into Citations above)

Skip vague claims. Empty array if nothing concrete.`;
}
