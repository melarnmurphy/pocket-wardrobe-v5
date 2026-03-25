# Trend Signals: Ingestion and Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global trend ingestion pipeline (RSS → LLM extraction → trend_signals) and per-user matching service (garment attributes vs trend signals, no LLM) with a trends UI page.

**Architecture:** Next.js API routes act as async job runners reading from `trend_ingestion_jobs`. Extraction calls Claude once per source article (deduplicated by URL). User matching is on-demand from a server action, with a 24-hour staleness gate, using pure attribute comparison functions.

**Tech Stack:** Next.js App Router, TypeScript, Supabase/Postgres, Zod, `@anthropic-ai/sdk`, `fast-xml-parser`, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-trend-signals-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/004_trend_sources_url_unique.sql` | Create | Unique constraint on `trend_sources.source_url` |
| `lib/domain/trends/index.ts` | Modify | All Zod schemas + types for trend tables |
| `lib/env.ts` | Modify | Add `ANTHROPIC_API_KEY` to server env schema |
| `lib/domain/trends/adapters/rss.ts` | Create | Generic RSS fetch + XML parse, adapter interface |
| `lib/domain/trends/adapters/vogue.ts` | Create | Vogue-specific feed URL, authority score, field mapping |
| `lib/domain/trends/matching.ts` | Create | Pure matching functions — no DB, fully testable |
| `lib/domain/trends/__tests__/matching.test.ts` | Create | Unit tests for all match types and scoring |
| `lib/domain/trends/ingestion.ts` | Create | Fetch feed via adapter, dedup, write trend_sources, queue jobs |
| `lib/domain/trends/__tests__/ingestion.test.ts` | Create | Unit tests for dedup and job queuing (Supabase mocked) |
| `lib/domain/trends/extraction.ts` | Create | Claude call, parse structured output, write trend_signals + trend_colours |
| `lib/domain/trends/__tests__/extraction.test.ts` | Create | Unit tests for label canonicalization + prompt building |
| `lib/domain/trends/service.ts` | Create | getTrendSignals, getUserTrendMatches (staleness gate), upsertUserTrendMatches |
| `lib/domain/trends/__tests__/service.test.ts` | Create | Unit tests for staleness gate (3 cases) and compatible colour loading |
| `app/api/trends/ingest/route.ts` | Create | POST: create source_ingestion job, trigger ingestion.ts |
| `app/api/trends/extract/route.ts` | Create | POST: pick up queued signal_extraction jobs, trigger extraction.ts |
| `app/trends/actions.ts` | Create | Server action: loadUserTrends() |
| `app/trends/page.tsx` | Create | Trends UI: match cards grouped by match type |

---

## Task 1: Migration — unique constraint on trend_sources.source_url

**Files:**
- Create: `supabase/migrations/004_trend_sources_url_unique.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/004_trend_sources_url_unique.sql
alter table public.trend_sources
  add constraint trend_sources_source_url_unique unique (source_url);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
# or if using local dev:
npx supabase migration up
```

Expected: migration runs without error. Verify in Supabase Studio that `trend_sources` has the unique constraint.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_trend_sources_url_unique.sql
git commit -m "feat: add unique constraint on trend_sources.source_url"
```

---

## Task 2: Extend env.ts and trends/index.ts with types

**Files:**
- Modify: `lib/env.ts`
- Modify: `lib/domain/trends/index.ts`

- [ ] **Step 1: Add ANTHROPIC_API_KEY to server env schema**

In `lib/env.ts`, extend `serverEnvSchema`:

```ts
const serverEnvSchema = publicEnvSchema.extend({
  PIPELINE_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  ANTHROPIC_API_KEY: z.string().min(1)
});
```

Also add `ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY` to the `getServerEnv()` parse call.

- [ ] **Step 2: Extend lib/domain/trends/index.ts**

Replace the file contents with the full schema set:

```ts
import { z } from "zod";
import type { WardrobeColourFamily } from "@/lib/domain/wardrobe/colours";

export const TREND_TYPES = [
  "colour",
  "garment",
  "silhouette",
  "material",
  "pattern",
  "styling",
  "occasion",
  "aesthetic",
  "era_influence"
] as const;

export type TrendType = (typeof TREND_TYPES)[number];

export const trendSignalSchema = z.object({
  id: z.string().uuid().optional(),
  trend_type: z.enum(TREND_TYPES),
  label: z.string().trim().min(1).max(200),
  normalized_attributes_json: z.record(z.string(), z.unknown()).default({}),
  season: z.string().trim().max(80).nullable().optional(),
  year: z.number().int().nullable().optional(),
  region: z.string().trim().max(80).nullable().optional(),
  source_count: z.number().int().default(0),
  authority_score: z.number().nullable().optional(),
  recency_score: z.number().nullable().optional(),
  confidence_score: z.number().nullable().optional(),
  first_seen_at: z.string().nullable().optional(),
  last_seen_at: z.string().nullable().optional(),
  created_at: z.string().optional()
});

export type TrendSignal = z.infer<typeof trendSignalSchema>;

export const trendColourSchema = z.object({
  id: z.string().uuid().optional(),
  trend_signal_id: z.string().uuid(),
  colour_id: z.string().uuid().nullable().optional(),
  source_name: z.string().min(1),
  source_label: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  canonical_hex: z.string().min(4).max(9),
  canonical_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  canonical_lab: z.object({ l: z.number(), a: z.number(), b: z.number() }).nullable().optional(),
  canonical_lch: z.object({ l: z.number(), c: z.number(), h: z.number() }).nullable().optional(),
  family: z.string().nullable().optional(),
  undertone: z.enum(["warm", "cool", "neutral"]).nullable().optional(),
  saturation_band: z.enum(["low", "medium", "high"]).nullable().optional(),
  lightness_band: z.enum(["low", "medium", "high"]).nullable().optional(),
  importance_score: z.number().nullable().optional(),
  observed_at: z.string().nullable().optional(),
  created_at: z.string().optional()
});

export type TrendColour = z.infer<typeof trendColourSchema>;

export const trendSignalWithColourSchema = trendSignalSchema.extend({
  trend_colour: trendColourSchema.nullable().optional()
});

export type TrendSignalWithColour = z.infer<typeof trendSignalWithColourSchema>;

export const userTrendMatchSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  trend_signal_id: z.string().uuid(),
  match_type: z.enum(["exact_match", "adjacent_match", "styling_match", "missing_piece"]),
  score: z.number().min(0).max(1),
  reasoning_json: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().optional()
});

export type UserTrendMatch = z.infer<typeof userTrendMatchSchema>;

export const trendIngestionJobSchema = z.object({
  id: z.string().uuid().optional(),
  job_type: z.enum([
    "source_ingestion",
    "signal_extraction",
    "aggregation",
    "scoring",
    "embedding_refresh",
    "user_matching"
  ]),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  started_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
  metadata_json: z.record(z.string(), z.unknown()).default({})
});

export type TrendIngestionJob = z.infer<typeof trendIngestionJobSchema>;

export interface TrendMatchReasoning {
  signal_label: string;
  match_reason: string;
  matched_garment_ids: string[];
  attributes_matched: string[];
  attributes_adjacent: string[];
}

export type ColourAttributes = {
  family: WardrobeColourFamily;
  undertone?: "warm" | "cool" | "neutral";
  lightness_band?: "low" | "medium" | "high";
};

export type GarmentAttributes = {
  category: string;
  subcategory?: string;
  fit?: string;
  material?: string;
};

export type SilhouetteAttributes = {
  fit?: string;
  structure?: "relaxed" | "structured" | "semi-structured";
  length?: "mini" | "midi" | "maxi" | "cropped" | "standard";
};

export type MaterialAttributes = { material: string; texture?: string };
export type PatternAttributes = { pattern: string; scale?: "small" | "medium" | "large" };

export type StylingAttributes = {
  principle: string;
  required_categories: string[];
  colour_constraint?: "monochrome" | "tonal" | "complementary" | "neutral" | null;
};

export type AestheticAttributes = { formality?: string; descriptors: string[] };
export type OccasionAttributes = { dress_code?: string; key_pieces: string[] };
export type EraInfluenceAttributes = { era: string; key_characteristics: string[] };
```

- [ ] **Step 3: Commit**

```bash
git add lib/env.ts lib/domain/trends/index.ts
git commit -m "feat: extend trend domain types and server env schema"
```

---

## Task 3: RSS adapter (generic + Vogue)

**Files:**
- Create: `lib/domain/trends/adapters/rss.ts`
- Create: `lib/domain/trends/adapters/vogue.ts`

Install `fast-xml-parser` if not already present:

```bash
npm install fast-xml-parser
```

- [ ] **Step 1: Write rss.ts — adapter interface and generic parser**

Note: `canonicalizeLabel` lives in `matching.ts`. Do not duplicate it here.

```ts
// lib/domain/trends/adapters/rss.ts
import { XMLParser } from "fast-xml-parser";

export interface RSSEntry {
  title: string;
  link: string;
  description: string | null;
  author: string | null;
  pubDate: string | null;
}

export interface TrendSourceInsertPayload {
  source_name: string;
  source_type: string;
  source_url: string;
  title: string;
  publish_date: string | null;
  author: string | null;
  region: string | null;
  season: string | null;
  raw_text_excerpt: string | null;
  authority_score: number;
}

export interface TrendSourceAdapter {
  sourceName: string;
  sourceType: string;
  feedUrl: string;
  baseAuthorityScore: number;
  parseEntry(entry: RSSEntry): TrendSourceInsertPayload;
}

export async function fetchRSSEntries(feedUrl: string): Promise<RSSEntry[]> {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "PocketWardrobe/1.0 (+https://pocketwardrobe.app)" },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel ?? parsed?.feed;
  if (!channel) throw new Error("RSS parse failed: no channel or feed element found");

  const items: unknown[] = Array.isArray(channel.item)
    ? channel.item
    : channel.item
      ? [channel.item]
      : Array.isArray(channel.entry)
        ? channel.entry
        : channel.entry
          ? [channel.entry]
          : [];

  return items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const link = String(i.link ?? i.id ?? "");
    const author =
      typeof i.author === "string"
        ? i.author
        : typeof i["dc:creator"] === "string"
          ? i["dc:creator"]
          : null;
    const description =
      typeof i.description === "string"
        ? i.description.replace(/<[^>]+>/g, "").slice(0, 500)
        : typeof i.summary === "string"
          ? i.summary.replace(/<[^>]+>/g, "").slice(0, 500)
          : null;
    return {
      title: String(i.title ?? ""),
      link,
      description,
      author,
      pubDate:
        typeof i.pubDate === "string"
          ? i.pubDate
          : typeof i.published === "string"
            ? i.published
            : null
    };
  });
}
```

- [ ] **Step 2: Write vogue.ts — Vogue adapter**

```ts
// lib/domain/trends/adapters/vogue.ts
import type { TrendSourceAdapter, RSSEntry, TrendSourceInsertPayload } from "./rss";

// Configure via VOGUE_RSS_FEED_URL env var.
// Verify the feed URL is accessible before first ingestion run.
const VOGUE_FEED_URL = process.env.VOGUE_RSS_FEED_URL ?? "https://www.vogue.com/feed/rss";

const SENIOR_EDITOR_BYLINES = [
  "hamish bowles", "anna wintour", "chioma nnadi", "mark holgate",
  "alessandra codinha", "sarah mower", "anders christian madsen"
];

function editorAuthorityScore(author: string | null): number {
  if (!author) return 0.7;
  const normalized = author.toLowerCase();
  return SENIOR_EDITOR_BYLINES.some((name) => normalized.includes(name)) ? 0.95 : 0.75;
}

export const vogueAdapter: TrendSourceAdapter = {
  sourceName: "Vogue",
  sourceType: "fashion_publication",
  feedUrl: VOGUE_FEED_URL,
  baseAuthorityScore: 0.85,

  parseEntry(entry: RSSEntry): TrendSourceInsertPayload {
    return {
      source_name: "Vogue",
      source_type: "fashion_publication",
      source_url: entry.link,
      title: entry.title,
      publish_date: entry.pubDate ? new Date(entry.pubDate).toISOString() : null,
      author: entry.author,
      region: null,
      season: null,
      raw_text_excerpt: entry.description,
      authority_score: editorAuthorityScore(entry.author)
    };
  }
};

export const registeredAdapters: TrendSourceAdapter[] = [vogueAdapter];
```

- [ ] **Step 3: Commit**

```bash
git add lib/domain/trends/adapters/
git commit -m "feat: add RSS adapter interface and Vogue adapter"
```

---

## Task 4: Matching logic + tests (pure functions, no DB)

**Files:**
- Create: `lib/domain/trends/matching.ts`
- Create: `lib/domain/trends/__tests__/matching.test.ts`

Start with the tests — matching.ts is pure functions with no I/O.

- [ ] **Step 1: Write failing tests**

Note: adjacent-match tests use `brown` as a compatible neighbour to `beige` (both are valid WardrobeColourFamily values — warm neutrals). Do not use `cream`; it is not in the colour system.

```ts
// lib/domain/trends/__tests__/matching.test.ts
import { describe, it, expect } from "vitest";
import {
  computeUserTrendMatches,
  canonicalizeLabel,
  computeRecencyWeight,
  computeAttributeOverlap
} from "../matching";
import type { TrendSignalWithColour } from "../index";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

const NOW = new Date().toISOString();
const OLD = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();

function makeSignal(overrides: Partial<TrendSignalWithColour> = {}): TrendSignalWithColour {
  return {
    id: "sig-1",
    trend_type: "colour",
    label: "earthy beige",
    normalized_attributes_json: { family: "beige", undertone: "warm", lightness_band: "high" },
    source_count: 3,
    authority_score: 0.9,
    confidence_score: 0.85,
    last_seen_at: NOW,
    trend_colour: null,
    ...overrides
  };
}

function makeGarment(overrides: Partial<GarmentListItem> = {}): GarmentListItem {
  return {
    id: "g-1",
    user_id: "u-1",
    title: "Beige linen shirt",
    category: "tops",
    subcategory: null,
    pattern: null,
    material: "linen",
    size: null,
    fit: null,
    formality_level: null,
    seasonality: [],
    wardrobe_status: "active",
    purchase_price: null,
    purchase_currency: null,
    purchase_date: null,
    retailer: null,
    favourite_score: null,
    wear_count: 0,
    last_worn_at: null,
    cost_per_wear: null,
    extraction_metadata_json: {},
    created_at: NOW,
    updated_at: NOW,
    images: [],
    preview_url: null,
    recent_wear_events: [],
    primary_colour_family: "beige",
    primary_colour_hex: "#d7c1a1",
    ...overrides
  } as GarmentListItem;
}

describe("canonicalizeLabel", () => {
  it("lowercases, trims, collapses spaces, replaces hyphens", () => {
    expect(canonicalizeLabel("  Wide-Leg Trousers  ")).toBe("wide leg trousers");
    expect(canonicalizeLabel("BUTTER YELLOW")).toBe("butter yellow");
    expect(canonicalizeLabel("over-sized  blazer")).toBe("over sized blazer");
  });
});

describe("computeRecencyWeight", () => {
  it("returns 1.0 for a signal seen today", () => {
    expect(computeRecencyWeight(NOW)).toBeCloseTo(1.0, 1);
  });

  it("returns 0.5 for a signal seen 90+ days ago", () => {
    expect(computeRecencyWeight(OLD)).toBeCloseTo(0.5, 1);
  });

  it("returns 1.0 when last_seen_at is null", () => {
    expect(computeRecencyWeight(null)).toBe(1.0);
  });
});

describe("computeAttributeOverlap", () => {
  it("returns 1.0 when all attributes match", () => {
    const signalAttrs = { category: "tops", fit: "relaxed", material: "linen" };
    const garmentAttrs = { category: "tops", fit: "relaxed", material: "linen" };
    expect(computeAttributeOverlap(signalAttrs, garmentAttrs)).toBe(1.0);
  });

  it("returns 0 when no attributes match", () => {
    const signalAttrs = { category: "trousers", fit: "slim" };
    const garmentAttrs = { category: "tops", fit: "relaxed" };
    expect(computeAttributeOverlap(signalAttrs, garmentAttrs)).toBe(0);
  });

  it("returns 0.5 when half the attributes match", () => {
    const signalAttrs = { category: "tops", fit: "slim" };
    const garmentAttrs = { category: "tops", fit: "relaxed" };
    expect(computeAttributeOverlap(signalAttrs, garmentAttrs)).toBe(0.5);
  });
});

describe("computeUserTrendMatches", () => {
  it("exact_match: colour family matches garment primary_colour_family", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "beige", undertone: "warm" }
    });
    const garment = makeGarment({ primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("exact_match");
    expect(result[0].score).toBeGreaterThanOrEqual(0.85);
  });

  it("adjacent_match: garment colour (brown) is in compatible set for beige signal", () => {
    // brown and beige are both warm neutrals — expected to be compatible in colour_relationships
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "beige", undertone: "warm" }
    });
    const garment = makeGarment({ primary_colour_family: "brown" });
    const compatibleColourFamilies = new Map([["beige", new Set(["brown"])]]);
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies
    });
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("adjacent_match");
    expect(result[0].score).toBeGreaterThanOrEqual(0.5);
    expect(result[0].score).toBeLessThan(0.85);
  });

  it("missing_piece: no garment matches colour signal", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "red" },
      authority_score: 0.9
    });
    const garment = makeGarment({ primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("missing_piece");
    expect(result[0].score).toBeLessThanOrEqual(0.4);
  });

  it("exact_match: garment category and subcategory match garment-type signal", () => {
    const signal = makeSignal({
      trend_type: "garment",
      label: "wide-leg trousers",
      normalized_attributes_json: { category: "trousers", subcategory: "wide-leg" }
    });
    const garment = makeGarment({
      category: "trousers",
      subcategory: "wide-leg",
      primary_colour_family: "navy"
    });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("exact_match");
  });

  it("adjacent_match: category matches but subcategory differs", () => {
    const signal = makeSignal({
      trend_type: "garment",
      normalized_attributes_json: { category: "trousers", subcategory: "wide-leg" }
    });
    const garment = makeGarment({
      category: "trousers",
      subcategory: "straight-leg",
      primary_colour_family: "black"
    });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("adjacent_match");
  });

  it("styling_match: wardrobe covers all required_categories", () => {
    const signal = makeSignal({
      trend_type: "styling",
      label: "tonal dressing",
      normalized_attributes_json: {
        principle: "tonal_dressing",
        required_categories: ["tops", "trousers"],
        colour_constraint: "monochrome"
      }
    });
    const garments = [
      makeGarment({ id: "g-1", category: "tops", primary_colour_family: "beige" }),
      makeGarment({ id: "g-2", category: "trousers", primary_colour_family: "beige" })
    ];
    const result = computeUserTrendMatches({
      signals: [signal],
      garments,
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("styling_match");
  });

  it("includes reasoning_json with matched_garment_ids", () => {
    const signal = makeSignal({
      trend_type: "colour",
      normalized_attributes_json: { family: "beige" }
    });
    const garment = makeGarment({ primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    const reasoning = result[0].reasoning_json as { matched_garment_ids: string[] };
    expect(reasoning.matched_garment_ids).toContain("g-1");
  });

  it("filters out non-active garments", () => {
    const signal = makeSignal({ trend_type: "colour", normalized_attributes_json: { family: "beige" } });
    const garment = makeGarment({ wardrobe_status: "archived", primary_colour_family: "beige" });
    const result = computeUserTrendMatches({
      signals: [signal],
      garments: [garment],
      compatibleColourFamilies: new Map()
    });
    expect(result[0].match_type).toBe("missing_piece");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/domain/trends/__tests__/matching.test.ts
```

Expected: FAIL — module not found or function not defined.

- [ ] **Step 3: Implement matching.ts**

```ts
// lib/domain/trends/matching.ts
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
    reasoning_json: reasoning as Record<string, unknown>
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/domain/trends/__tests__/matching.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/matching.ts lib/domain/trends/__tests__/matching.test.ts
git commit -m "feat: add trend matching pure functions with full test coverage"
```

---

## Task 5: Ingestion service + tests

**Files:**
- Create: `lib/domain/trends/ingestion.ts`
- Create: `lib/domain/trends/__tests__/ingestion.test.ts`

- [ ] **Step 1: Write failing tests**

These tests mock Supabase using the same pattern as `lib/domain/ingestion/__tests__/service.test.ts`.

```ts
// lib/domain/trends/__tests__/ingestion.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock scaffold ---
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom })
}));

// Chain setup helpers
function chainSelect(result: { data: unknown; error: unknown }) {
  mockEq.mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue(result) });
  mockSelect.mockReturnValue({ eq: mockEq });
}

function chainInsertSelect(result: { data: unknown; error: unknown }) {
  mockSingle.mockResolvedValue(result);
  mockSelect.mockReturnValue({ single: mockSingle });
  mockInsert.mockReturnValue({ select: mockSelect });
}

function chainUpdate(result: { error: unknown }) {
  mockEq.mockReturnValue(result);
  mockUpdate.mockReturnValue({ eq: mockEq });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq
  });
});

// --- Adapter stub ---
const stubAdapter = {
  sourceName: "TestSource",
  sourceType: "fashion_publication",
  feedUrl: "https://example.com/rss",
  baseAuthorityScore: 0.8,
  parseEntry: (entry: { title: string; link: string; description: string | null; author: string | null; pubDate: string | null }) => ({
    source_name: "TestSource",
    source_type: "fashion_publication",
    source_url: entry.link,
    title: entry.title,
    publish_date: null,
    author: entry.author,
    region: null,
    season: null,
    raw_text_excerpt: entry.description,
    authority_score: 0.8
  })
};

// Mock fetchRSSEntries
vi.mock("../adapters/rss", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../adapters/rss")>();
  return {
    ...actual,
    fetchRSSEntries: vi.fn()
  };
});

describe("runSourceIngestion", () => {
  it("inserts new source and queues extraction job when URL is not already stored", async () => {
    const { fetchRSSEntries } = await import("../adapters/rss");
    vi.mocked(fetchRSSEntries).mockResolvedValue([
      { title: "Spring Trends 2026", link: "https://example.com/spring-2026", description: "Beige is back.", author: "Editor", pubDate: null }
    ]);

    // Job insert (source_ingestion job)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null }) }) })
    });

    // Dedup check: no existing source
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) })
    });

    // Source insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "src-1" }, error: null }) }) })
    });

    // Extraction job insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null })
    });

    // Job update (succeeded)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    });

    const { runSourceIngestion } = await import("../ingestion");
    const result = await runSourceIngestion(stubAdapter);

    expect(result.newSourceCount).toBe(1);
    expect(result.queuedJobCount).toBe(1);
  });

  it("skips source when URL already exists in trend_sources", async () => {
    const { fetchRSSEntries } = await import("../adapters/rss");
    vi.mocked(fetchRSSEntries).mockResolvedValue([
      { title: "Spring Trends 2026", link: "https://example.com/spring-2026", description: null, author: null, pubDate: null }
    ]);

    // Job insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "job-2" }, error: null }) }) })
    });

    // Dedup check: existing source found
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: "src-existing" }, error: null }) }) })
    });

    // Job update (succeeded)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    });

    const { runSourceIngestion } = await import("../ingestion");
    const result = await runSourceIngestion(stubAdapter);

    expect(result.newSourceCount).toBe(0);
    expect(result.queuedJobCount).toBe(0);
  });

  it("silently skips on unique constraint violation (race condition)", async () => {
    const { fetchRSSEntries } = await import("../adapters/rss");
    vi.mocked(fetchRSSEntries).mockResolvedValue([
      { title: "Race Condition Article", link: "https://example.com/race", description: null, author: null, pubDate: null }
    ]);

    // Job insert
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "job-3" }, error: null }) }) })
    });

    // Dedup check: no existing (passes the check)
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) })
    });

    // Source insert returns 23505 (unique violation from concurrent request)
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } }) }) })
    });

    // Job update (succeeded — only 0 sources inserted but no throw)
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    });

    const { runSourceIngestion } = await import("../ingestion");
    const result = await runSourceIngestion(stubAdapter);
    expect(result.newSourceCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/domain/trends/__tests__/ingestion.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ingestion.ts**

```ts
// lib/domain/trends/ingestion.ts
import { createClient } from "@/lib/supabase/server";
import { fetchRSSEntries } from "./adapters/rss";
import type { TrendSourceAdapter } from "./adapters/rss";
import type { TablesInsert } from "@/types/database";

type TrendSourceInsert = TablesInsert<"trend_sources">;
type TrendIngestionJobInsert = TablesInsert<"trend_ingestion_jobs">;

export async function runSourceIngestion(adapter: TrendSourceAdapter): Promise<{
  newSourceCount: number;
  queuedJobCount: number;
}> {
  const supabase = await createClient();

  const { data: jobData, error: jobError } = await supabase
    .from("trend_ingestion_jobs")
    .insert(({
      job_type: "source_ingestion",
      status: "running",
      metadata_json: { adapter: adapter.sourceName }
    } satisfies Partial<TrendIngestionJobInsert>) as never)
    .select("id")
    .single();

  if (jobError) throw new Error(`Failed to create ingestion job: ${jobError.message}`);
  const jobId = (jobData as { id: string }).id;

  try {
    const entries = await fetchRSSEntries(adapter.feedUrl);
    let newSourceCount = 0;
    let queuedJobCount = 0;

    for (const entry of entries) {
      if (!entry.link) continue;

      const { data: existing } = await supabase
        .from("trend_sources")
        .select("id")
        .eq("source_url", entry.link)
        .maybeSingle();

      if (existing) continue;

      const payload = adapter.parseEntry(entry);
      const sourceInsert: TrendSourceInsert = {
        source_name: payload.source_name,
        source_type: payload.source_type,
        source_url: payload.source_url,
        title: payload.title,
        publish_date: payload.publish_date ? new Date(payload.publish_date) as unknown as string : null,
        author: payload.author,
        region: payload.region,
        season: payload.season,
        raw_text_excerpt: payload.raw_text_excerpt,
        ingestion_timestamp: new Date().toISOString()
      };

      const { data: sourceData, error: sourceError } = await supabase
        .from("trend_sources")
        .insert(sourceInsert as never)
        .select("id")
        .single();

      if (sourceError) {
        if (sourceError.code === "23505") continue; // race condition — skip
        throw new Error(`Failed to insert trend source: ${sourceError.message}`);
      }

      newSourceCount++;
      const sourceId = (sourceData as { id: string }).id;

      const { error: extractJobError } = await supabase
        .from("trend_ingestion_jobs")
        .insert(({
          job_type: "signal_extraction",
          status: "queued",
          metadata_json: {
            source_id: sourceId,
            source_name: payload.source_name,
            authority_score: payload.authority_score
          }
        } satisfies Partial<TrendIngestionJobInsert>) as never);

      if (extractJobError) {
        throw new Error(`Failed to queue extraction job: ${extractJobError.message}`);
      }

      queuedJobCount++;
    }

    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        metadata_json: { adapter: adapter.sourceName, new_sources: newSourceCount }
      } as never))
      .eq("id", jobId);

    return { newSourceCount, queuedJobCount };
  } catch (err) {
    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata_json: { adapter: adapter.sourceName, error: String(err) }
      } as never))
      .eq("id", jobId);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/domain/trends/__tests__/ingestion.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/ingestion.ts lib/domain/trends/__tests__/ingestion.test.ts
git commit -m "feat: add trend source ingestion service"
```

---

## Task 6: Ingest API route

**Files:**
- Create: `app/api/trends/ingest/route.ts`

- [ ] **Step 1: Implement route**

```ts
// app/api/trends/ingest/route.ts
import { NextResponse } from "next/server";
import { runSourceIngestion } from "@/lib/domain/trends/ingestion";
import { registeredAdapters } from "@/lib/domain/trends/adapters/vogue";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await Promise.all(
      registeredAdapters.map((adapter) => runSourceIngestion(adapter))
    );

    const total = results.reduce(
      (acc, r) => ({
        newSourceCount: acc.newSourceCount + r.newSourceCount,
        queuedJobCount: acc.queuedJobCount + r.queuedJobCount
      }),
      { newSourceCount: 0, queuedJobCount: 0 }
    );

    return NextResponse.json({ ok: true, ...total });
  } catch (err) {
    console.error("[trends/ingest]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test manually**

```bash
curl -X POST http://localhost:3000/api/trends/ingest
```

Expected: `{"ok":true,"newSourceCount":N,"queuedJobCount":N}`. Check Supabase Studio for new `trend_sources` rows and queued `trend_ingestion_jobs` rows with `job_type = 'signal_extraction'`.

- [ ] **Step 3: Commit**

```bash
git add app/api/trends/ingest/route.ts
git commit -m "feat: add POST /api/trends/ingest route"
```

---

## Task 7: Extraction service + tests

**Files:**
- Create: `lib/domain/trends/extraction.ts`
- Create: `lib/domain/trends/__tests__/extraction.test.ts`

Install Anthropic SDK if needed:

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 1: Write failing tests**

```ts
// lib/domain/trends/__tests__/extraction.test.ts
import { describe, it, expect } from "vitest";
import { canonicalizeLabel } from "../matching";
import { buildExtractionPrompt } from "../extraction";

describe("buildExtractionPrompt", () => {
  it("includes the source title in the prompt", () => {
    const prompt = buildExtractionPrompt({
      title: "The Return of the Power Suit",
      excerpt: "Editors are calling it: structured tailoring is back.",
      author: "Sarah Mower",
      publishDate: "2026-03-10",
      sourceName: "Vogue"
    });
    expect(prompt).toContain("The Return of the Power Suit");
    expect(prompt).toContain("Sarah Mower");
    expect(prompt).toContain("Vogue");
  });

  it("includes colour family enum values in the prompt", () => {
    const prompt = buildExtractionPrompt({
      title: "Test",
      excerpt: "Test excerpt.",
      author: null,
      publishDate: null,
      sourceName: "Vogue"
    });
    // All valid WardrobeColourFamily values must appear so Claude stays on-schema
    expect(prompt).toContain("beige");
    expect(prompt).toContain("navy");
    expect(prompt).toContain("black");
    expect(prompt).toContain("brown");
    expect(prompt).toContain("white");
  });

  it("includes all TREND_TYPES in the prompt", () => {
    const prompt = buildExtractionPrompt({ title: "T", excerpt: null, author: null, publishDate: null, sourceName: "S" });
    expect(prompt).toContain("colour");
    expect(prompt).toContain("silhouette");
    expect(prompt).toContain("era_influence");
  });
});

describe("canonicalizeLabel (used in extraction upsert)", () => {
  it("wide-leg trousers and Wide Leg Trousers produce same key", () => {
    expect(canonicalizeLabel("wide-leg trousers")).toBe(canonicalizeLabel("Wide Leg Trousers"));
  });

  it("dedup key is consistent for LLM variants", () => {
    expect(canonicalizeLabel("Butter Yellow")).toBe(canonicalizeLabel("butter yellow"));
    expect(canonicalizeLabel("Over-sized Blazer")).toBe(canonicalizeLabel("oversized blazer"));
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/domain/trends/__tests__/extraction.test.ts
```

Expected: FAIL — `buildExtractionPrompt` not found.

- [ ] **Step 3: Implement extraction.ts**

```ts
// lib/domain/trends/extraction.ts
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { canonicalizeLabel } from "./matching";
import { getCanonicalWardrobeColour, canonicalWardrobeColours } from "@/lib/domain/wardrobe/colours";
import { TREND_TYPES, type TrendType } from "./index";
import type { TablesInsert } from "@/types/database";

type TrendSignalInsert = TablesInsert<"trend_signals">;
type TrendColourInsert = TablesInsert<"trend_colours">;
type TrendSignalSourceInsert = TablesInsert<"trend_signal_sources">;

const COLOUR_FAMILIES = canonicalWardrobeColours.map((c) => c.family);

interface SourceContext {
  title: string;
  excerpt: string | null;
  author: string | null;
  publishDate: string | null;
  sourceName: string;
}

interface ExtractedSignal {
  trend_type: TrendType;
  label: string;
  normalized_attributes: Record<string, unknown>;
  season: string | null;
  region: string | null;
  confidence: number;
}

export function buildExtractionPrompt(source: SourceContext): string {
  const colourList = COLOUR_FAMILIES.join(", ");
  const trendTypeList = TREND_TYPES.join(", ");
  return `You are a fashion trend analyst. Extract concrete trend signals from the following article excerpt.

Source: ${source.sourceName}
Title: ${source.title}
${source.author ? `Author: ${source.author}` : ""}
${source.publishDate ? `Published: ${source.publishDate}` : ""}

Excerpt:
${source.excerpt ?? source.title}

Rules:
- Extract ONLY concrete, specific trend claims. Skip vague statements like "it was a great season".
- For trend_type "colour", family MUST be one of: ${colourList}
- Keep labels concise (max 8 words). Examples: "wide-leg trousers", "butter yellow", "quiet luxury aesthetic"
- Set confidence between 0.5 (mentioned once, implicitly) and 1.0 (headline trend, explicitly stated)
- Return an empty array if no concrete trend signals are present

Return a JSON array. Each signal:
{
  "trend_type": one of: ${trendTypeList},
  "label": string,
  "normalized_attributes": object,
  "season": string or null,
  "region": string or null,
  "confidence": number 0-1
}`;
}

async function parseClaudeResponse(content: string): Promise<ExtractedSignal[]> {
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed.filter(
      (s): s is ExtractedSignal =>
        typeof s === "object" &&
        s !== null &&
        "trend_type" in s &&
        "label" in s &&
        TREND_TYPES.includes((s as ExtractedSignal).trend_type)
    );
  } catch {
    return [];
  }
}

async function upsertTrendSignal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  signal: ExtractedSignal,
  authorityScore: number
): Promise<string> {
  const canonical = canonicalizeLabel(signal.label);

  const { data: existing } = await supabase
    .from("trend_signals")
    .select("id, source_count, authority_score")
    .eq("trend_type", signal.trend_type)
    .ilike("label", canonical)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; source_count: number; authority_score: number | null };
    const newCount = row.source_count + 1;
    const newAuthority = row.authority_score
      ? (row.authority_score * row.source_count + authorityScore) / newCount
      : authorityScore;

    await supabase
      .from("trend_signals")
      .update(({
        source_count: newCount,
        authority_score: Math.round(newAuthority * 100) / 100,
        last_seen_at: new Date().toISOString()
      } as never))
      .eq("id", row.id);

    return row.id;
  }

  const insert: TrendSignalInsert = {
    trend_type: signal.trend_type,
    label: signal.label,
    normalized_attributes_json: signal.normalized_attributes as never,
    season: signal.season ?? null,
    year: new Date().getFullYear(),
    region: signal.region ?? null,
    source_count: 1,
    authority_score: authorityScore,
    confidence_score: signal.confidence,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("trend_signals")
    .insert(insert as never)
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert trend signal: ${error.message}`);
  return (data as { id: string }).id;
}

async function upsertTrendColour(
  supabase: Awaited<ReturnType<typeof createClient>>,
  signalId: string,
  signal: ExtractedSignal,
  source: { source_name: string; source_url: string; authority_score: number }
): Promise<void> {
  const attrs = signal.normalized_attributes as { family?: string; undertone?: string; lightness_band?: string };
  const canonical = getCanonicalWardrobeColour(attrs.family ?? null);
  if (!canonical) return;

  const rgb = { r: canonical.rgb_r, g: canonical.rgb_g, b: canonical.rgb_b };

  const insert: TrendColourInsert = {
    trend_signal_id: signalId,
    source_name: source.source_name,
    source_url: source.source_url,
    source_label: signal.label,
    canonical_hex: canonical.hex,
    canonical_rgb: rgb as never,
    family: canonical.family,
    undertone: (attrs.undertone as TrendColourInsert["undertone"]) ?? canonical.undertone ?? null,
    saturation_band: (canonical.saturation_band as TrendColourInsert["saturation_band"]) ?? null,
    lightness_band: (attrs.lightness_band as TrendColourInsert["lightness_band"]) ?? canonical.lightness_band ?? null,
    importance_score: signal.confidence * source.authority_score,
    observed_at: new Date().toISOString()
  };

  const { error } = await supabase.from("trend_colours").insert(insert as never);
  if (error && error.code !== "23505") {
    console.warn("[extraction] Failed to insert trend_colour:", error.message);
  }
}

export async function processExtractionJob(jobId: string): Promise<void> {
  const supabase = await createClient();
  const env = getServerEnv();

  const { data: job, error: jobError } = await supabase
    .from("trend_ingestion_jobs")
    .select("id, metadata_json, status")
    .eq("id", jobId)
    .single();

  if (jobError || !job) throw new Error("Job not found");

  const meta = (job as { metadata_json: Record<string, unknown> }).metadata_json;
  const sourceId = meta.source_id as string;
  const authorityScore = (meta.authority_score as number) ?? 0.7;

  await supabase
    .from("trend_ingestion_jobs")
    .update(({ status: "running" } as never))
    .eq("id", jobId);

  try {
    const { data: source, error: sourceError } = await supabase
      .from("trend_sources")
      .select("id, title, raw_text_excerpt, author, publish_date, source_name, source_url")
      .eq("id", sourceId)
      .single();

    if (sourceError || !source) throw new Error("Source not found");

    const sourceRow = source as {
      id: string; title: string; raw_text_excerpt: string | null;
      author: string | null; publish_date: string | null;
      source_name: string; source_url: string;
    };

    // Use Haiku (cheapest model) for extraction — signal quality over cost
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: buildExtractionPrompt({
        title: sourceRow.title,
        excerpt: sourceRow.raw_text_excerpt,
        author: sourceRow.author,
        publishDate: sourceRow.publish_date,
        sourceName: sourceRow.source_name
      }) }]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const signals = await parseClaudeResponse(text);

    for (const signal of signals) {
      const signalId = await upsertTrendSignal(supabase, signal, authorityScore);

      if (signal.trend_type === "colour") {
        await upsertTrendColour(supabase, signalId, signal, {
          source_name: sourceRow.source_name,
          source_url: sourceRow.source_url,
          authority_score: authorityScore
        });
      }

      const sourceLink: TrendSignalSourceInsert = {
        trend_signal_id: signalId,
        trend_source_id: sourceRow.id,
        evidence_json: { excerpt: sourceRow.raw_text_excerpt?.slice(0, 200) ?? null } as never
      };

      const { error: linkError } = await supabase.from("trend_signal_sources").insert(sourceLink as never);
      if (linkError && linkError.code !== "23505") {
        console.warn("[extraction] Failed to link signal to source:", linkError.message);
      }
    }

    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        metadata_json: { ...meta, signals_extracted: signals.length }
      } as never))
      .eq("id", jobId);
  } catch (err) {
    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata_json: { ...meta, error: String(err) }
      } as never))
      .eq("id", jobId);
    throw err;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/domain/trends/__tests__/extraction.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/extraction.ts lib/domain/trends/__tests__/extraction.test.ts
git commit -m "feat: add signal extraction service with Claude integration"
```

---

## Task 8: Extract API route

**Files:**
- Create: `app/api/trends/extract/route.ts`

- [ ] **Step 1: Implement route**

```ts
// app/api/trends/extract/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processExtractionJob } from "@/lib/domain/trends/extraction";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 5;

export async function POST() {
  const supabase = await createClient();

  const { data: jobs, error } = await supabase
    .from("trend_ingestion_jobs")
    .select("id")
    .eq("job_type", "signal_extraction")
    .eq("status", "queued")
    .order("started_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const jobIds = (jobs ?? []).map((j) => (j as { id: string }).id);
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const jobId of jobIds) {
    try {
      await processExtractionJob(jobId);
      results.push({ id: jobId, ok: true });
    } catch (err) {
      results.push({ id: jobId, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
```

- [ ] **Step 2: Test manually**

```bash
# First run ingest to populate queued jobs
curl -X POST http://localhost:3000/api/trends/ingest
# Then drain the extraction queue
curl -X POST http://localhost:3000/api/trends/extract
```

Expected: jobs move from `queued` to `succeeded`, `trend_signals` rows appear.

- [ ] **Step 3: Commit**

```bash
git add app/api/trends/extract/route.ts
git commit -m "feat: add POST /api/trends/extract route"
```

---

## Task 9: Trend service + staleness gate tests

**Files:**
- Create: `lib/domain/trends/service.ts`
- Create: `lib/domain/trends/__tests__/service.test.ts`

- [ ] **Step 1: Write failing service tests**

These cover the three staleness gate cases and the compatible colour family resolution.

```ts
// lib/domain/trends/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const FRESH_TIMESTAMP = new Date().toISOString();
const STALE_TIMESTAMP = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago

// Mock supabase with configurable responses
const mockSupabaseChain = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  in: vi.fn(),
  upsert: vi.fn()
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseChain)
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-1" })
}));

vi.mock("@/lib/domain/wardrobe/service", () => ({
  listWardrobeGarments: vi.fn().mockResolvedValue([])
}));

vi.mock("../matching", () => ({
  computeUserTrendMatches: vi.fn().mockReturnValue([])
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserTrendMatches staleness gate", () => {
  it("returns cached matches when last match is within 24 hours", async () => {
    const cachedMatch = {
      id: "m-1", user_id: "user-1", trend_signal_id: "sig-1",
      match_type: "exact_match", score: 0.9,
      reasoning_json: {}, created_at: FRESH_TIMESTAMP
    };

    // First call: get latest match (fresh)
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { created_at: FRESH_TIMESTAMP }, error: null }) }) }) }) })
    });

    // Second call: return cached matches
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [cachedMatch], error: null }) }) })
    });

    const { getUserTrendMatches } = await import("../service");
    const { listWardrobeGarments } = await import("@/lib/domain/wardrobe/service");

    const result = await getUserTrendMatches("user-1");

    // Should NOT call listWardrobeGarments — used cached path
    expect(listWardrobeGarments).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("exact_match");
  });

  it("runs fresh matching when last match is older than 24 hours", async () => {
    // Latest match is stale
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { created_at: STALE_TIMESTAMP }, error: null }) }) }) }) })
    });

    // trend_signals query (empty for this test)
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
    });

    // colours query for compatible families
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], error: null })
    });

    // colour_relationships query
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], error: null })
    });

    // upsert (no matches to write)
    mockSupabaseChain.from.mockReturnValueOnce({
      upsert: () => Promise.resolve({ error: null })
    });

    const { getUserTrendMatches } = await import("../service");
    const { listWardrobeGarments } = await import("@/lib/domain/wardrobe/service");

    await getUserTrendMatches("user-1");

    // Should call listWardrobeGarments — triggered fresh matching
    expect(listWardrobeGarments).toHaveBeenCalled();
  });

  it("runs fresh matching when user has no existing matches (first run)", async () => {
    // No existing matches
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) })
    });

    // trend_signals query
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
    });

    // colours query
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], error: null })
    });

    // colour_relationships query
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], error: null })
    });

    // upsert
    mockSupabaseChain.from.mockReturnValueOnce({
      upsert: () => Promise.resolve({ error: null })
    });

    const { getUserTrendMatches } = await import("../service");
    const { listWardrobeGarments } = await import("@/lib/domain/wardrobe/service");

    await getUserTrendMatches("user-1");

    expect(listWardrobeGarments).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run lib/domain/trends/__tests__/service.test.ts
```

Expected: FAIL — `service.ts` module not found.

- [ ] **Step 3: Implement service.ts**

Note on colour_relationships: the query filters on relationship types that indicate colour compatibility. Check the `colour_relationships` table schema for the `relationship_type` column values; update the `in` filter below to match the actual values in your DB (e.g. `['pairs_with', 'complementary', 'analogous']`).

```ts
// lib/domain/trends/service.ts
import { createClient } from "@/lib/supabase/server";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { computeUserTrendMatches } from "./matching";
import {
  trendSignalSchema,
  trendColourSchema,
  userTrendMatchSchema,
  type TrendSignalWithColour,
  type UserTrendMatch
} from "./index";
import { z } from "zod";
import type { TablesInsert } from "@/types/database";

type UserTrendMatchInsert = TablesInsert<"user_trend_matches">;

const STALENESS_MS = 24 * 60 * 60 * 1000;

// Compatible relationship types in colour_relationships table.
// Adjust these values to match the actual relationship_type values in your DB.
const COMPATIBLE_RELATIONSHIP_TYPES = ["pairs_with", "complementary", "analogous"];

export async function getTrendSignals(): Promise<TrendSignalWithColour[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trend_signals")
    .select(
      "id,trend_type,label,normalized_attributes_json,season,year,region,source_count,authority_score,recency_score,confidence_score,first_seen_at,last_seen_at,created_at"
    )
    .order("last_seen_at", { ascending: false });

  if (error) throw new Error(error.message);

  const signals = z.array(trendSignalSchema).parse(data ?? []);

  const colourSignalIds = signals
    .filter((s) => s.trend_type === "colour")
    .map((s) => s.id as string);

  const colourById = new Map<string, z.infer<typeof trendColourSchema>>();

  if (colourSignalIds.length > 0) {
    const { data: colours, error: colourError } = await supabase
      .from("trend_colours")
      .select(
        "id,trend_signal_id,colour_id,source_name,source_label,source_url,canonical_hex,canonical_rgb,canonical_lab,canonical_lch,family,undertone,saturation_band,lightness_band,importance_score,observed_at,created_at"
      )
      .in("trend_signal_id", colourSignalIds);

    if (colourError) throw new Error(colourError.message);

    for (const c of z.array(trendColourSchema).parse(colours ?? [])) {
      colourById.set(c.trend_signal_id, c);
    }
  }

  return signals.map((s) => ({
    ...s,
    trend_colour: colourById.get(s.id as string) ?? null
  }));
}

async function getCompatibleColourFamilies(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<string, Set<string>>> {
  const { data: colours } = await supabase.from("colours").select("id,family");

  // Filter colour_relationships to compatible types only — excludes contrast/clash relationships
  const { data: relationships } = await supabase
    .from("colour_relationships")
    .select("colour_id_a,colour_id_b,relationship_type")
    .in("relationship_type", COMPATIBLE_RELATIONSHIP_TYPES);

  const colourFamilyById = new Map<string, string>();
  for (const c of (colours ?? []) as { id: string; family: string }[]) {
    colourFamilyById.set(c.id, c.family);
  }

  const compatible = new Map<string, Set<string>>();
  for (const rel of (relationships ?? []) as { colour_id_a: string; colour_id_b: string }[]) {
    const familyA = colourFamilyById.get(rel.colour_id_a);
    const familyB = colourFamilyById.get(rel.colour_id_b);
    if (!familyA || !familyB) continue;

    if (!compatible.has(familyA)) compatible.set(familyA, new Set());
    if (!compatible.has(familyB)) compatible.set(familyB, new Set());
    compatible.get(familyA)!.add(familyB);
    compatible.get(familyB)!.add(familyA);
  }

  return compatible;
}

export async function getUserTrendMatches(userId: string): Promise<UserTrendMatch[]> {
  const supabase = await createClient();

  // Staleness gate: max(created_at) across user's existing matches
  const { data: latestMatch } = await supabase
    .from("user_trend_matches")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isStale =
    !latestMatch ||
    Date.now() - new Date((latestMatch as { created_at: string }).created_at).getTime() > STALENESS_MS;

  if (!isStale) {
    const { data: cached, error } = await supabase
      .from("user_trend_matches")
      .select("id,user_id,trend_signal_id,match_type,score,reasoning_json,created_at")
      .eq("user_id", userId)
      .order("score", { ascending: false });

    if (error) throw new Error(error.message);
    return z.array(userTrendMatchSchema).parse(cached ?? []);
  }

  const [signals, garments, compatibleColourFamilies] = await Promise.all([
    getTrendSignals(),
    listWardrobeGarments(),
    getCompatibleColourFamilies(supabase)
  ]);

  const matches = computeUserTrendMatches({ signals, garments, compatibleColourFamilies });
  const matchesWithUser = matches.map((m) => ({ ...m, user_id: userId }));

  await upsertUserTrendMatches(userId, matchesWithUser);

  return z.array(userTrendMatchSchema).parse(matchesWithUser);
}

export async function upsertUserTrendMatches(
  userId: string,
  matches: UserTrendMatch[]
): Promise<void> {
  if (matches.length === 0) return;
  const supabase = await createClient();

  const inserts: UserTrendMatchInsert[] = matches.map((m) => ({
    user_id: userId,
    trend_signal_id: m.trend_signal_id,
    match_type: m.match_type,
    score: m.score,
    reasoning_json: m.reasoning_json as never
  }));

  const { error } = await supabase
    .from("user_trend_matches")
    .upsert(inserts as never, {
      onConflict: "user_id,trend_signal_id,match_type",
      ignoreDuplicates: false
    });

  if (error) throw new Error(`Failed to upsert trend matches: ${error.message}`);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run lib/domain/trends/__tests__/service.test.ts
```

Expected: all 3 staleness gate tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/service.ts lib/domain/trends/__tests__/service.test.ts
git commit -m "feat: add trend service with staleness gate and compatible colour matching"
```

---

## Task 10: Server action + trends page

**Files:**
- Create: `app/trends/actions.ts`
- Create: `app/trends/page.tsx`

- [ ] **Step 1: Write server action**

```ts
// app/trends/actions.ts
"use server";

import { getRequiredUser } from "@/lib/auth";
import { getUserTrendMatches, getTrendSignals } from "@/lib/domain/trends/service";
import type { UserTrendMatch, TrendSignalWithColour } from "@/lib/domain/trends/index";

export interface TrendMatchWithSignal {
  match: UserTrendMatch;
  signal: TrendSignalWithColour;
}

export async function loadUserTrends(): Promise<TrendMatchWithSignal[]> {
  const user = await getRequiredUser();
  const [matches, signals] = await Promise.all([
    getUserTrendMatches(user.id),
    getTrendSignals()
  ]);

  const signalById = new Map(signals.map((s) => [s.id, s]));

  return matches
    .map((match) => {
      const signal = signalById.get(match.trend_signal_id);
      if (!signal) return null;
      return { match, signal };
    })
    .filter((item): item is TrendMatchWithSignal => item !== null)
    .sort((a, b) => b.match.score - a.match.score);
}
```

- [ ] **Step 2: Write trends page**

```tsx
// app/trends/page.tsx
import { loadUserTrends } from "./actions";

const MATCH_LABELS: Record<string, string> = {
  exact_match: "On trend",
  adjacent_match: "Close match",
  styling_match: "Can style it",
  missing_piece: "Missing piece"
};

const MATCH_COLOURS: Record<string, string> = {
  exact_match: "bg-green-50 border-green-200 text-green-800",
  adjacent_match: "bg-blue-50 border-blue-200 text-blue-800",
  styling_match: "bg-purple-50 border-purple-200 text-purple-800",
  missing_piece: "bg-amber-50 border-amber-200 text-amber-800"
};

export default async function TrendsPage() {
  const trendMatches = await loadUserTrends();

  const grouped = {
    exact_match: trendMatches.filter((t) => t.match.match_type === "exact_match"),
    adjacent_match: trendMatches.filter((t) => t.match.match_type === "adjacent_match"),
    styling_match: trendMatches.filter((t) => t.match.match_type === "styling_match"),
    missing_piece: trendMatches.filter((t) => t.match.match_type === "missing_piece")
  };

  if (trendMatches.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 mb-3">Trend Intelligence</h1>
        <p className="text-stone-500 text-sm">
          No trend data yet. Trigger an ingestion run to populate trend signals.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900 mb-1">Trend Intelligence</h1>
      <p className="text-stone-500 text-sm mb-8">How your wardrobe maps to current trends</p>

      {(Object.entries(grouped) as [string, typeof trendMatches][]).map(([matchType, items]) => {
        if (items.length === 0) return null;
        return (
          <section key={matchType} className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-3">
              {MATCH_LABELS[matchType]}
            </h2>
            <div className="grid gap-3">
              {items.map(({ match, signal }) => {
                const reasoning = match.reasoning_json as {
                  match_reason?: string;
                  matched_garment_ids?: string[];
                  attributes_matched?: string[];
                };
                return (
                  <div
                    key={`${match.trend_signal_id}-${match.match_type}`}
                    className={`border rounded-xl p-4 ${MATCH_COLOURS[matchType]}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm capitalize">{signal.label}</p>
                        <p className="text-xs mt-0.5 opacity-75">
                          {signal.trend_type.replace("_", " ")}
                          {signal.season ? ` · ${signal.season}` : ""}
                        </p>
                        {reasoning.match_reason && (
                          <p className="text-xs mt-2 opacity-90">{reasoning.match_reason}</p>
                        )}
                        {reasoning.attributes_matched && reasoning.attributes_matched.length > 0 && (
                          <p className="text-xs mt-1 opacity-70">
                            Matched: {reasoning.attributes_matched.join(", ")}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-mono shrink-0 opacity-60">
                        {Math.round(match.score * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add environment variables to `.env.local`**

```bash
# .env.local (never commit this file)
ANTHROPIC_API_KEY=sk-ant-...
VOGUE_RSS_FEED_URL=https://www.vogue.com/feed/rss
```

Verify the RSS feed URL returns valid XML before running ingestion:

```bash
curl -s https://www.vogue.com/feed/rss | head -20
```

- [ ] **Step 4: Run the full pipeline end-to-end**

```bash
# 1. Ingest sources
curl -X POST http://localhost:3000/api/trends/ingest

# 2. Extract signals (run multiple times to drain queue)
curl -X POST http://localhost:3000/api/trends/extract

# 3. Visit trends page
open http://localhost:3000/trends
```

- [ ] **Step 5: Run all trend module tests**

```bash
npx vitest run lib/domain/trends/
```

Expected: all tests pass across matching, ingestion, extraction, and service.

- [ ] **Step 6: Commit**

```bash
git add app/trends/ app/api/trends/
git commit -m "feat: add trends page, server action, and complete trend pipeline"
```

---

## Summary

| Task | What it delivers |
|---|---|
| 1 | Migration: unique constraint on trend_sources.source_url |
| 2 | Full Zod type schemas for all trend tables; ANTHROPIC_API_KEY in env |
| 3 | RSS adapter interface + Vogue adapter (canonicalizeLabel imported from matching.ts, not duplicated) |
| 4 | Pure matching functions, fully unit-tested — 9 tests, no DB required |
| 5 | Ingestion service: fetch, dedup, queue jobs — 3 mocked tests including race condition |
| 6 | Ingest API route |
| 7 | Extraction service: Claude Haiku call, label canonicalization, signal upsert, trend_colours write |
| 8 | Extract API route |
| 9 | Trend service: getTrendSignals, getUserTrendMatches with staleness gate — 3 staleness tests |
| 10 | Trends page + server action |
