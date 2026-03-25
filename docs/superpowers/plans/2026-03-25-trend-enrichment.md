# Trend Enrichment: Article Fetching, Local Extraction, Chunking & Embeddings

**Goal:** Maximise signal quality and minimise LLM cost by (1) fetching full article bodies instead of RSS teasers, (2) pre-filtering irrelevant articles, (3) extracting colours/seasons locally, (4) chunking articles so LLM sees focused text, and (5) generating vector embeddings on `trend_signals` for semantic garment matching.

**Spec:** This plan is self-contained — no external spec document.

---

## Design decisions

### Season calendar (publish_date as anchor, not runtime)

```
Jan–Jun  → SS{2-digit-year}   e.g. published 2027-03-15 → SS27
Jul–Dec  → AW{2-digit-year}   e.g. published 2027-09-01 → AW27
```

Explicit text mentions always beat date inference. `seasons.ts` takes `(text, publishDate)` — never `new Date()`.

### Category allowlist

RSS `<category>` tags filter articles before any HTTP fetch. Only process:
- any category containing `"fashion"` or `"runway"` (case-insensitive)
- `"shopping"` only if it also contains `"fashion"`

Skip: Culture, Living, Business, Beauty/Wellness, Photovogue, Royals, Music, etc.

### Local extractors (zero LLM cost)

| Extractor | Output | Coverage |
|---|---|---|
| `extractColoursFromText` | `Array<{family, term, confidence}>` | ~80 colour synonyms → 12 canonical families |
| `resolveSeasonYear` | `{season, year}` | Regex + date fallback |

Colour signals from local extraction are written directly to DB — no LLM needed. LLM handles aesthetics, silhouettes, styling, era influence, and garments it didn't miss.

### Chunking

- Size: 800 chars, overlap: 150 chars, min chunk: 200 chars
- Relevance pre-filter: keyword density score > 0.15 before sending to GPT
- Trend verbs: `emerging, returning, key, directional, everywhere, back, season's`
- Fashion nouns: `silhouette, proportion, tailoring, drape, fabric, texture, cut, palette, aesthetic`

### Embeddings

- Model: `text-embedding-3-small` (1536 dims, $0.00002/1K tokens)
- Signal embedding text: `"${label} | ${trend_type} | ${JSON.stringify(normalized_attributes_json)}"`
- Garment embedding text: `"${title} ${category} ${subcategory} ${material} ${fit} ${primary_colour_family}"` (null fields skipped)
- Batch: all signals from one article in a single OpenAI call; all garments from one wardrobe in a single call
- Cache: skip embedding if `embedding IS NOT NULL` already

### Semantic match blending

- Phase 1 (unchanged): attribute matching
- Phase 2: for signals still returning `missing_piece`, embed all garments (one batched API call), query `match_trend_signals` RPC per garment
- Upgrade rule: if semantic similarity ≥ 0.75 → `exact_match` at `similarity * 0.9`; ≥ 0.60 → `adjacent_match` at `similarity * 0.8`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/005_trend_signal_embeddings.sql` | Create | pgvector ext, `embedding vector(1536)`, HNSW index, `match_trend_signals` RPC |
| `lib/domain/trends/seasons.ts` | Create | Season/year extraction from text + date inference |
| `lib/domain/trends/__tests__/seasons.test.ts` | Create | Unit tests — regex cases, date inference cases, explicit-beats-inferred |
| `lib/domain/trends/content.ts` | Create | Article HTML fetch + readability parse, colour synonym map, `extractColoursFromText`, `scoreChunkRelevance` |
| `lib/domain/trends/__tests__/content.test.ts` | Create | Unit tests for colour extractor and chunk scorer |
| `lib/domain/trends/adapters/rss.ts` | Modify | Add `categories: string[]` to `RSSEntry`; extract from `<category>` tags |
| `lib/domain/trends/adapters/vogue.ts` | Modify | Add `isFashionRelevant(categories)` — used by ingestion to skip articles |
| `lib/domain/trends/ingestion.ts` | Modify | Category filter before dedup; `fetchArticleContent` call; store full text in `raw_text_excerpt` |
| `lib/domain/trends/extraction.ts` | Modify | Local colour extraction + season resolve; `chunkText`; chunk relevance filter; batch embedding after upserts |
| `lib/domain/trends/service.ts` | Modify | Batch-embed garments; `match_trend_signals` RPC; semantic upgrade pass |

---

## Task 1: Migration — pgvector + embedding column

**File:** `supabase/migrations/005_trend_signal_embeddings.sql`

```sql
-- supabase/migrations/005_trend_signal_embeddings.sql

create extension if not exists vector;

alter table public.trend_signals
  add column if not exists embedding vector(1536);

create index if not exists trend_signals_embedding_hnsw_idx
  on public.trend_signals
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create or replace function match_trend_signals(
  query_embedding vector(1536),
  match_threshold float default 0.6,
  match_count int default 10
)
returns table (
  id uuid,
  trend_type text,
  label text,
  normalized_attributes_json jsonb,
  season text,
  year int,
  region text,
  source_count int,
  authority_score float,
  confidence_score float,
  last_seen_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    id, trend_type, label, normalized_attributes_json,
    season, year, region, source_count,
    authority_score::float, confidence_score::float, last_seen_at,
    1 - (embedding <=> query_embedding) as similarity
  from public.trend_signals
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

Apply: `npx supabase db push`

---

## Task 2: Season utility + tests

**File:** `lib/domain/trends/seasons.ts`

```ts
// lib/domain/trends/seasons.ts

export interface SeasonYear {
  season: string; // e.g. "SS26", "AW27"
  year: number;   // e.g. 2026
}

// Regex patterns — explicit always beats inferred
const EXPLICIT_PATTERNS: Array<{ re: RegExp; parse: (m: RegExpMatchArray) => SeasonYear | null }> = [
  {
    // SS26, AW25, FW26
    re: /\b(SS|AW|FW|PF|RE)\s*(\d{2})\b/gi,
    parse: (m) => {
      const prefix = m[1].toUpperCase();
      const yr = parseInt(m[2], 10) + 2000;
      const season = prefix === "FW" ? "AW" : prefix;
      return { season: `${season}${m[2]}`, year: yr };
    }
  },
  {
    // Spring/Summer 2026, Fall/Winter 2025, Autumn/Winter 2026
    re: /\b(spring[\s/]*summer|fall[\s/]*winter|autumn[\s/]*winter|pre[- ]fall|resort)\s+(\d{4})\b/gi,
    parse: (m) => {
      const label = m[1].toLowerCase();
      const yr = parseInt(m[2], 10);
      const twoDigit = String(yr).slice(2);
      if (label.includes("spring") || label.includes("summer")) return { season: `SS${twoDigit}`, year: yr };
      if (label.includes("fall") || label.includes("winter") || label.includes("autumn")) return { season: `AW${twoDigit}`, year: yr };
      if (label.includes("pre") || label.includes("resort")) return { season: `PF${twoDigit}`, year: yr };
      return null;
    }
  },
  {
    // Spring 2026, Fall 2025, Summer 2026, Winter 2025
    re: /\b(spring|fall|autumn|summer|winter)\s+(\d{4})\b/gi,
    parse: (m) => {
      const label = m[1].toLowerCase();
      const yr = parseInt(m[2], 10);
      const twoDigit = String(yr).slice(2);
      if (label === "spring" || label === "summer") return { season: `SS${twoDigit}`, year: yr };
      return { season: `AW${twoDigit}`, year: yr };
    }
  }
];

export function extractSeasonFromText(text: string): SeasonYear | null {
  for (const { re, parse } of EXPLICIT_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(text);
    if (match) {
      const result = parse(match);
      if (result) return result;
    }
  }
  return null;
}

export function inferSeasonFromDate(publishDate: string | null): SeasonYear | null {
  if (!publishDate) return null;
  const d = new Date(publishDate);
  if (isNaN(d.getTime())) return null;
  const month = d.getMonth() + 1; // 1-12
  const yr = d.getFullYear();
  const twoDigit = String(yr).slice(2);
  // Jan–Jun → SS; Jul–Dec → AW
  const season = month <= 6 ? `SS${twoDigit}` : `AW${twoDigit}`;
  return { season, year: yr };
}

/** Explicit text extraction beats date inference. */
export function resolveSeasonYear(text: string, publishDate: string | null): SeasonYear | null {
  return extractSeasonFromText(text) ?? inferSeasonFromDate(publishDate);
}
```

**File:** `lib/domain/trends/__tests__/seasons.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { extractSeasonFromText, inferSeasonFromDate, resolveSeasonYear } from "../seasons";

describe("extractSeasonFromText", () => {
  it("extracts SS shorthand", () => {
    expect(extractSeasonFromText("The SS26 collections were bold")?.season).toBe("SS26");
  });
  it("extracts AW shorthand", () => {
    expect(extractSeasonFromText("AW25 is all about quiet luxury")?.season).toBe("AW25");
  });
  it("maps FW to AW", () => {
    expect(extractSeasonFromText("FW26 runways")?.season).toBe("AW26");
  });
  it("extracts Spring/Summer long form", () => {
    const r = extractSeasonFromText("Spring/Summer 2027 key pieces");
    expect(r?.season).toBe("SS27");
    expect(r?.year).toBe(2027);
  });
  it("extracts Fall/Winter long form", () => {
    expect(extractSeasonFromText("Fall/Winter 2026 collections")?.season).toBe("AW26");
  });
  it("extracts Autumn/Winter long form", () => {
    expect(extractSeasonFromText("Autumn/Winter 2025")?.season).toBe("AW25");
  });
  it("extracts single word Spring", () => {
    expect(extractSeasonFromText("Spring 2026 trend report")?.season).toBe("SS26");
  });
  it("returns null when no season present", () => {
    expect(extractSeasonFromText("Jennifer Lopez wore a pencil skirt")).toBeNull();
  });
});

describe("inferSeasonFromDate", () => {
  it("Jan → SS same year", () => {
    const r = inferSeasonFromDate("2027-01-15");
    expect(r?.season).toBe("SS27");
    expect(r?.year).toBe(2027);
  });
  it("Jun → SS same year", () => {
    expect(inferSeasonFromDate("2027-06-30")?.season).toBe("SS27");
  });
  it("Jul → AW same year", () => {
    expect(inferSeasonFromDate("2027-07-01")?.season).toBe("AW27");
  });
  it("Dec → AW same year", () => {
    expect(inferSeasonFromDate("2027-12-31")?.season).toBe("AW27");
  });
  it("returns null for null input", () => {
    expect(inferSeasonFromDate(null)).toBeNull();
  });
});

describe("resolveSeasonYear", () => {
  it("explicit text beats date inference", () => {
    // Article published in Jan (would infer SS27) but explicitly says AW26
    const r = resolveSeasonYear("AW26 runway recap", "2027-01-20");
    expect(r?.season).toBe("AW26");
  });
  it("falls back to date when no explicit season", () => {
    const r = resolveSeasonYear("Jennifer Lopez wore a pencil skirt", "2027-09-10");
    expect(r?.season).toBe("AW27");
  });
  it("returns null when no text season and no publish date", () => {
    expect(resolveSeasonYear("no season here", null)).toBeNull();
  });
});
```

---

## Task 3: Content utility + tests

Install dependencies:
```bash
npm install @mozilla/readability linkedom
npm install --save-dev @types/mozilla-readability
```

**File:** `lib/domain/trends/content.ts`

```ts
// lib/domain/trends/content.ts
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { WardrobeColourFamily } from "@/lib/domain/wardrobe/colours";

export const USER_AGENT = "PocketWardrobe/1.0 (+https://pocketwardrobe.app)";
export const MAX_ARTICLE_CHARS = 5000;

// ─── Article fetching ────────────────────────────────────────────────────────

export async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return "";
    const html = await res.text();
    const { document } = parseHTML(html);
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();
    const text = article?.textContent ?? "";
    return text.replace(/\s+/g, " ").trim().slice(0, MAX_ARTICLE_CHARS);
  } catch {
    return "";
  }
}

// ─── Category filter ─────────────────────────────────────────────────────────

const FASHION_TERMS = ["fashion", "runway", "style", "trend", "wear", "clothing", "apparel"];
const SKIP_TERMS = ["beauty/wellness", "culture/music", "living/royals", "culture/tv", "business/", "photovogue", "culture/books"];

export function isFashionRelevant(categories: string[]): boolean {
  const lower = categories.map((c) => c.toLowerCase());
  if (lower.some((c) => SKIP_TERMS.some((s) => c.includes(s)))) return false;
  return lower.some((c) => FASHION_TERMS.some((f) => c.includes(f)));
}

// ─── Colour extraction ────────────────────────────────────────────────────────

export const COLOUR_SYNONYMS: Record<string, WardrobeColourFamily> = {
  // black
  black: "black", jet: "black", ebony: "black", noir: "black", onyx: "black",
  // white
  white: "white", ivory: "white", "off-white": "white", pearl: "white", chalk: "white",
  ecru: "white", snow: "white",
  // grey
  grey: "grey", gray: "grey", silver: "grey", slate: "grey", ash: "grey",
  pewter: "grey", charcoal: "grey", stone: "grey",
  // blue
  blue: "blue", navy: "blue", cobalt: "blue", azure: "blue", cerulean: "blue",
  indigo: "blue", sapphire: "blue", denim: "blue", "powder blue": "blue",
  "midnight blue": "blue", teal: "blue",
  // red
  red: "red", crimson: "red", scarlet: "red", ruby: "red", wine: "red",
  burgundy: "red", cherry: "red", "deep red": "red", tomato: "red",
  // green
  green: "green", olive: "green", sage: "green", forest: "green", emerald: "green",
  mint: "green", khaki: "green", army: "green", hunter: "green", "forest green": "green",
  "olive green": "green",
  // yellow
  yellow: "yellow", mustard: "yellow", lemon: "yellow", golden: "yellow",
  butter: "yellow", canary: "yellow", ochre: "yellow",
  // orange
  orange: "orange", terracotta: "orange", rust: "orange", copper: "orange",
  pumpkin: "orange", amber: "orange", "burnt orange": "orange",
  // purple
  purple: "purple", violet: "purple", lavender: "purple", lilac: "purple",
  plum: "purple", mauve: "purple", grape: "purple", amethyst: "purple",
  // pink
  pink: "pink", blush: "pink", rose: "pink", fuchsia: "pink", "hot pink": "pink",
  "dusty rose": "pink", salmon: "pink", magenta: "pink", "powder pink": "pink",
  // brown
  brown: "brown", caramel: "brown", chocolate: "brown", tan: "brown",
  cognac: "brown", mocha: "brown", chestnut: "brown", mahogany: "brown",
  sienna: "brown", umber: "brown",
  // beige
  beige: "beige", sand: "beige", nude: "beige", taupe: "beige", camel: "beige",
  oatmeal: "beige", latte: "beige", champagne: "beige", wheat: "beige",
  natural: "beige", cream: "beige"
};

export interface ExtractedColour {
  family: WardrobeColourFamily;
  term: string;
  count: number;
}

export function extractColoursFromText(text: string): ExtractedColour[] {
  const lower = text.toLowerCase();
  const counts = new Map<WardrobeColourFamily, { term: string; count: number }>();

  // Multi-word synonyms first (longest match wins)
  const sortedSynonyms = Object.entries(COLOUR_SYNONYMS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [synonym, family] of sortedSynonyms) {
    const re = new RegExp(`\\b${synonym.replace(/[-/]/g, "[- /]")}\\b`, "gi");
    const matches = lower.match(re);
    if (matches) {
      const existing = counts.get(family);
      if (!existing || matches.length > existing.count) {
        counts.set(family, { term: synonym, count: matches.length });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([family, { term, count }]) => ({ family, term, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Chunk relevance scoring ─────────────────────────────────────────────────

const TREND_VERBS = ["emerging", "returning", "key", "directional", "everywhere", "season's", "back", "dominant", "defining", "staple", "essential", "statement"];
const FASHION_NOUNS = ["silhouette", "proportion", "tailoring", "drape", "fabric", "texture", "cut", "palette", "aesthetic", "look", "collection", "runway", "trend", "style", "wear"];

export function scoreChunkRelevance(chunk: string): number {
  const lower = chunk.toLowerCase();
  const wordCount = chunk.split(/\s+/).length;
  if (wordCount < 20) return 0;

  let hits = 0;
  for (const word of [...TREND_VERBS, ...FASHION_NOUNS]) {
    if (lower.includes(word)) hits++;
  }

  return hits / (TREND_VERBS.length + FASHION_NOUNS.length);
}

// ─── Chunking ────────────────────────────────────────────────────────────────

export function chunkText(
  text: string,
  size = 800,
  overlap = 150,
  minSize = 200
): string[] {
  if (text.length <= size) return text.length >= minSize ? [text] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + size);
    if (chunk.length >= minSize) chunks.push(chunk);
    i += size - overlap;
  }
  return chunks;
}
```

**File:** `lib/domain/trends/__tests__/content.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { extractColoursFromText, scoreChunkRelevance, chunkText, isFashionRelevant } from "../content";

describe("isFashionRelevant", () => {
  it("allows Fashion category", () => {
    expect(isFashionRelevant(["Fashion", "Fashion / Trends"])).toBe(true);
  });
  it("allows Runway category", () => {
    expect(isFashionRelevant(["Runway"])).toBe(true);
  });
  it("blocks Culture/Music", () => {
    expect(isFashionRelevant(["Culture/Music"])).toBe(false);
  });
  it("blocks Living/Royals", () => {
    expect(isFashionRelevant(["Living/Royals"])).toBe(false);
  });
  it("blocks Beauty/Wellness", () => {
    expect(isFashionRelevant(["Beauty/Wellness"])).toBe(false);
  });
  it("returns false for empty categories", () => {
    expect(isFashionRelevant([])).toBe(false);
  });
});

describe("extractColoursFromText", () => {
  it("extracts canonical colour families from synonyms", () => {
    const results = extractColoursFromText("A camel trench coat paired with a navy blazer and ivory shirt.");
    const families = results.map((r) => r.family);
    expect(families).toContain("beige"); // camel → beige
    expect(families).toContain("blue");  // navy → blue
    expect(families).toContain("white"); // ivory → white
  });

  it("counts frequency correctly", () => {
    const results = extractColoursFromText("red bag, red shoes, red dress — red is everywhere");
    const red = results.find((r) => r.family === "red");
    expect(red?.count).toBe(4);
  });

  it("returns empty array for non-colour text", () => {
    expect(extractColoursFromText("Jennifer Lopez attended the gala.")).toHaveLength(0);
  });

  it("handles multi-word synonyms", () => {
    const results = extractColoursFromText("The dusty rose gown was spectacular.");
    expect(results.find((r) => r.family === "pink")?.term).toBe("dusty rose");
  });
});

describe("scoreChunkRelevance", () => {
  it("scores high for fashion-dense text", () => {
    const text = "The key silhouette this season is a directional tailoring aesthetic with proportion as the defining element.";
    expect(scoreChunkRelevance(text)).toBeGreaterThan(0.15);
  });

  it("scores low for non-fashion text", () => {
    const text = "Jennifer Aniston shared her morning routine and favourite snacks in a new interview.";
    expect(scoreChunkRelevance(text)).toBeLessThan(0.1);
  });

  it("returns 0 for very short chunks", () => {
    expect(scoreChunkRelevance("Short.")).toBe(0);
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const text = "a".repeat(500);
    expect(chunkText(text)).toHaveLength(1);
  });

  it("produces overlapping chunks for long text", () => {
    const text = "a".repeat(2000);
    const chunks = chunkText(text, 800, 150);
    expect(chunks.length).toBeGreaterThan(1);
    // Verify overlap: end of chunk 0 overlaps start of chunk 1
    expect(chunks[0].slice(-150)).toBe(chunks[1].slice(0, 150));
  });

  it("skips chunks below minSize", () => {
    const text = "a".repeat(900); // 800 + 100 remaining — 100 < 200 min
    expect(chunkText(text, 800, 150, 200)).toHaveLength(1);
  });
});
```

---

## Task 4: RSS adapter — add categories

**Modify:** `lib/domain/trends/adapters/rss.ts`

Add `categories: string[]` to `RSSEntry` and extract from `<category>` tags in the item map:

```ts
export interface RSSEntry {
  title: string;
  link: string;
  description: string | null;
  author: string | null;
  pubDate: string | null;
  categories: string[]; // NEW
}
```

In the `items.map(...)`:
```ts
const categories: string[] = Array.isArray(i.category)
  ? (i.category as unknown[]).map(String)
  : typeof i.category === "string"
    ? [i.category]
    : [];
return { title, link, description, author, pubDate, categories };
```

**Modify:** `lib/domain/trends/adapters/vogue.ts`

Add to the adapter interface a method `isFashionRelevant` and import from `content.ts`:

```ts
import { isFashionRelevant } from "@/lib/domain/trends/content";

// Add to TrendSourceAdapter in rss.ts:
shouldProcess?(entry: RSSEntry): boolean;

// Implement on vogueAdapter:
shouldProcess(entry: RSSEntry): boolean {
  return isFashionRelevant(entry.categories);
}
```

Update `TrendSourceAdapter` interface in `rss.ts` to add optional `shouldProcess`.

---

## Task 5: Ingestion — category filter + article fetch

**Modify:** `lib/domain/trends/ingestion.ts`

Key changes:
1. After fetching RSS entries, filter with `adapter.shouldProcess?.(entry) ?? true`
2. After dedup check (entry not already stored), call `fetchArticleContent(entry.link)` with a rate-limit delay between fetches
3. Use full article text (or RSS description as fallback) for `raw_text_excerpt`
4. Add 500ms delay between article fetches to be respectful

```ts
import { fetchArticleContent } from "./content";

// In the loop, after dedup check:
const articleText = await fetchArticleContent(entry.link);
await new Promise((r) => setTimeout(r, 500)); // rate limit

const payload = adapter.parseEntry(entry);
const sourceInsert: TrendSourceInsert = {
  ...
  raw_text_excerpt: articleText || payload.raw_text_excerpt // full article or fallback to RSS desc
};
```

---

## Task 6: Extraction — chunking + local pre-extraction + embeddings

**Modify:** `lib/domain/trends/extraction.ts`

Key changes:

1. Import `chunkText`, `scoreChunkRelevance`, `extractColoursFromText` from `./content`
2. Import `resolveSeasonYear` from `./seasons`
3. Resolve season/year once per job from `(sourceRow.raw_text_excerpt, sourceRow.publish_date)`
4. Run `extractColoursFromText` on full text → upsert colour signals directly (no LLM)
5. Chunk text with `chunkText(text, 800, 150)`
6. Filter chunks: `chunks.filter(c => scoreChunkRelevance(c) > 0.15)`
7. For each relevant chunk: call OpenAI, collect signals
8. Dedup all LLM signals by canonical label across chunks
9. After all upserts: batch-embed new signals in a single OpenAI call

New function signatures:
```ts
function buildSignalEmbeddingText(label: string, trendType: string, attrs: Record<string, unknown>): string
async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]>
async function storeEmbeddingsForSignals(supabase, signalIds: string[], label+attrs): Promise<void>
```

Season/year from `resolveSeasonYear` is passed into `upsertTrendSignal` — the insert uses it, and the update also refreshes `season`/`year` on the existing row if they were null.

---

## Task 7: Service — semantic matching

**Modify:** `lib/domain/trends/service.ts`

New function:
```ts
async function getSemanticUpgrades(
  supabase,
  garments: GarmentListItem[],
  existingMatches: UserTrendMatch[]
): Promise<UserTrendMatch[]>
```

Flow:
1. Find signals with `missing_piece` in `existingMatches`
2. If none, return `[]`
3. Build garment embedding texts
4. Batch-embed all garments (single OpenAI call)
5. For each garment embedding: call `match_trend_signals` RPC (threshold 0.6, limit 10)
6. For each RPC result: if that signal currently has `missing_piece` → upgrade to `adjacent_match` (sim ≥ 0.60) or `exact_match` (sim ≥ 0.75)
7. Return upgraded matches

In `getUserTrendMatches`, after computing attribute matches:
```ts
const semanticUpgrades = await getSemanticUpgrades(supabase, garments, matches);
const finalMatches = mergeMatches(matches, semanticUpgrades); // higher score wins
```

---

## Run order

```bash
# 1. Apply migration
npx supabase db push

# 2. Run all trend tests
npx vitest run lib/domain/trends/

# 3. Re-run pipeline end to end
curl -X POST http://localhost:3000/api/trends/ingest
curl -X POST http://localhost:3000/api/trends/extract
```

Expected improvements:
- Ingestion: only fashion/runway articles proceed to article fetch (~40-60% of Vogue feed)
- Article content: full body text stored (~500-3000 chars meaningful fashion copy)
- Extraction: 3-5x more signals per article, colour signals extracted free
- Signals: all have `season`/`year` set, embeddings stored
- Matching: `missing_piece` count drops significantly for users with active wardrobes
