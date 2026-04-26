# Trends: Story Layer + Tighter Source Scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new fashion-intelligence scanner archetypes (design_house, fashion_week, it_girl_discovery) and a story-generation layer that groups related signals into named editorial stories, displayed as story cards on the trends page with matching wardrobe pieces and a "Generate outfit" CTA.

**Architecture:** New scanner archetypes extend the existing `SCANNERS` array in `grounding-prompts.ts` and are wired into `vercel.json` crons. A new `generateTrendStories()` function clusters signals by type+family, calls `gpt-4o-mini` to name each cluster editorially, and upserts `trend_stories`. The trends page renders story cards sourced from a new `loadUserTrendStories()` action, with the existing signal view preserved as fallback.

**Tech Stack:** TypeScript, Next.js App Router, Supabase (Postgres + Storage), OpenAI SDK (`gpt-4o-mini`), Gemini grounding adapter, Zod, Vitest

---

### Task 1: DB migration — trend_stories, trend_people, new columns

**Files:**
- Create: `supabase/migrations/012_trend_stories.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/012_trend_stories.sql

create table if not exists public.trend_stories (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  framing text,
  momentum_label text,
  dominant_type text check (
    dominant_type in ('colour_combo', 'garment_moment', 'aesthetic', 'it_girl_look', 'runway_moment')
    or dominant_type is null
  ),
  attributed_houses text[] not null default '{}',
  attributed_people text[] not null default '{}',
  signal_ids uuid[] not null default '{}',
  status text check (
    status in ('candidate', 'emerging', 'confirmed', 'dominant', 'cooling', 'flat', 'rising')
    or status is null
  ),
  confidence_score numeric(5,2),
  created_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create table if not exists public.trend_people (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  first_seen_at timestamptz not null default now(),
  mention_count integer not null default 1,
  last_seen_at timestamptz not null default now()
);

alter table public.trend_signals
  add column if not exists house_attribution text[],
  add column if not exists person_attribution text[];

alter table public.user_trend_matches
  add column if not exists story_id uuid references public.trend_stories(id) on delete set null;

create index if not exists idx_trend_stories_refreshed_at
  on public.trend_stories(refreshed_at desc);
create index if not exists idx_trend_stories_confidence
  on public.trend_stories(confidence_score desc nulls last);
create index if not exists idx_trend_stories_signal_ids
  on public.trend_stories using gin(signal_ids);
create index if not exists idx_user_trend_matches_story_id
  on public.user_trend_matches(story_id);
create index if not exists idx_trend_signals_house_attribution
  on public.trend_signals using gin(house_attribution);
```

- [ ] **Step 2: Apply migration locally**

```bash
npx supabase db push
# or, if using direct SQL:
# psql $DATABASE_URL -f supabase/migrations/012_trend_stories.sql
```

Expected: migration applied with no errors. Verify with:
```bash
npx supabase db diff
# should show no pending changes
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_trend_stories.sql
git commit -m "feat: add trend_stories, trend_people tables and attribution columns"
```

---

### Task 2: Add TrendStory and TrendPerson types to domain index

**Files:**
- Modify: `lib/domain/trends/index.ts`

- [ ] **Step 1: Write a failing test for schema parsing**

Create `lib/domain/trends/__tests__/stories.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { trendStorySchema, trendPersonSchema, STORY_DOMINANT_TYPES } from "../index";

describe("trendStorySchema", () => {
  it("parses a complete story", () => {
    const raw = {
      id: "00000000-0000-0000-0000-000000000001",
      headline: "Transparent Denim",
      framing: "The season's most literal take on exposed dressing.",
      momentum_label: "+100% search interest",
      dominant_type: "garment_moment",
      attributed_houses: ["Coperni", "Acne Studios"],
      attributed_people: [],
      signal_ids: ["00000000-0000-0000-0000-000000000002"],
      status: "emerging",
      confidence_score: 0.82
    };
    const result = trendStorySchema.parse(raw);
    expect(result.headline).toBe("Transparent Denim");
    expect(result.attributed_houses).toEqual(["Coperni", "Acne Studios"]);
    expect(result.signal_ids).toHaveLength(1);
  });

  it("defaults attributed_houses and attributed_people to empty arrays", () => {
    const result = trendStorySchema.parse({
      headline: "Minimal Story",
      signal_ids: []
    });
    expect(result.attributed_houses).toEqual([]);
    expect(result.attributed_people).toEqual([]);
    expect(result.signal_ids).toEqual([]);
  });

  it("rejects unknown dominant_type", () => {
    expect(() =>
      trendStorySchema.parse({ headline: "X", dominant_type: "unknown_type" })
    ).toThrow();
  });
});

describe("trendPersonSchema", () => {
  it("parses a person record", () => {
    const result = trendPersonSchema.parse({ name: "Bella Hadid" });
    expect(result.name).toBe("Bella Hadid");
    expect(result.mention_count).toBe(1);
  });
});

describe("STORY_DOMINANT_TYPES", () => {
  it("contains expected values", () => {
    expect(STORY_DOMINANT_TYPES).toContain("garment_moment");
    expect(STORY_DOMINANT_TYPES).toContain("colour_combo");
    expect(STORY_DOMINANT_TYPES).toContain("it_girl_look");
    expect(STORY_DOMINANT_TYPES).toContain("runway_moment");
    expect(STORY_DOMINANT_TYPES).toContain("aesthetic");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: FAIL — `trendStorySchema` not found in `../index`

- [ ] **Step 3: Add schemas and types to index.ts**

In `lib/domain/trends/index.ts`, add after the `userTrendMatchSchema` block:

```typescript
export const STORY_DOMINANT_TYPES = [
  "colour_combo",
  "garment_moment",
  "aesthetic",
  "it_girl_look",
  "runway_moment"
] as const;

export type StoryDominantType = (typeof STORY_DOMINANT_TYPES)[number];

export const trendStorySchema = z.object({
  id: z.string().uuid().optional(),
  headline: z.string().min(1).max(200),
  framing: z.string().nullable().optional(),
  momentum_label: z.string().nullable().optional(),
  dominant_type: z.enum(STORY_DOMINANT_TYPES).nullable().optional(),
  attributed_houses: z.array(z.string()).default([]),
  attributed_people: z.array(z.string()).default([]),
  signal_ids: z.array(z.string().uuid()).default([]),
  status: z
    .enum(["candidate", "emerging", "confirmed", "dominant", "cooling", "flat", "rising"])
    .nullable()
    .optional(),
  confidence_score: z.number().nullable().optional(),
  created_at: z.string().optional(),
  refreshed_at: z.string().optional()
});

export type TrendStory = z.infer<typeof trendStorySchema>;

export const trendPersonSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  first_seen_at: z.string().optional(),
  mention_count: z.number().int().default(1),
  last_seen_at: z.string().optional()
});

export type TrendPerson = z.infer<typeof trendPersonSchema>;
```

Also update the existing `userTrendMatchSchema` to add the optional `story_id` field. Find the schema in `index.ts` (lines ~140-149) and add:

```typescript
export const userTrendMatchSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  trend_signal_id: z.string().uuid(),
  match_type: z.enum(["exact_match", "adjacent_match", "styling_match", "missing_piece"]),
  score: z.number().min(0).max(1),
  reasoning_json: z.record(z.string(), z.unknown()).default({}),
  story_id: z.string().uuid().nullable().optional(),  // <-- add this line
  created_at: z.string().optional()
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/index.ts lib/domain/trends/__tests__/stories.test.ts
git commit -m "feat: add TrendStory, TrendPerson types and schemas to domain index"
```

---

### Task 3: Add three new scanner archetypes to grounding-prompts.ts

**Files:**
- Modify: `lib/domain/trends/prompts/grounding-prompts.ts`

- [ ] **Step 1: Write a failing test for the new archetypes**

Add to `lib/domain/trends/__tests__/stories.test.ts` (at the end of the file):

```typescript
import { SCANNERS, SCANNER_BY_ARCHETYPE } from "../prompts/grounding-prompts";

describe("new scanner archetypes", () => {
  it("includes design_house, fashion_week, it_girl_discovery in SCANNERS", () => {
    const archetypes = SCANNERS.map((s) => s.archetype);
    expect(archetypes).toContain("design_house");
    expect(archetypes).toContain("fashion_week");
    expect(archetypes).toContain("it_girl_discovery");
  });

  it("SCANNER_BY_ARCHETYPE has entries for new archetypes", () => {
    expect(SCANNER_BY_ARCHETYPE["design_house"]).toBeDefined();
    expect(SCANNER_BY_ARCHETYPE["fashion_week"]).toBeDefined();
    expect(SCANNER_BY_ARCHETYPE["it_girl_discovery"]).toBeDefined();
  });

  it("design_house scanner builds a query mentioning design house", () => {
    const scanner = SCANNER_BY_ARCHETYPE["design_house"];
    const query = scanner.buildGroundingQuery({ now: "2026-04-26T00:00:00Z" });
    expect(query.toLowerCase()).toMatch(/design house|fashion house|collection/);
  });

  it("it_girl_discovery scanner builds a query mentioning style or best dressed", () => {
    const scanner = SCANNER_BY_ARCHETYPE["it_girl_discovery"];
    const query = scanner.buildGroundingQuery({ now: "2026-04-26T00:00:00Z" });
    expect(query.toLowerCase()).toMatch(/best dressed|it girl|style icon|street style/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: FAIL — `SCANNER_BY_ARCHETYPE["design_house"]` is undefined

- [ ] **Step 3: Extend ScannerArchetype type and add scanner definitions**

In `lib/domain/trends/prompts/grounding-prompts.ts`:

**3a.** Update the `ScannerArchetype` type (currently on line 24):

```typescript
export type ScannerArchetype =
  | "editorial"
  | "runway"
  | "street_social"
  | "colour_authority"
  | "design_house"
  | "fashion_week"
  | "it_girl_discovery";
```

**3b.** Add three new scanner definitions before the `export const SCANNERS` line:

```typescript
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
```

**3c.** Update `SCANNERS` and `SCANNER_BY_ARCHETYPE` to include the new scanners:

```typescript
export const SCANNERS: readonly GroundingScanner[] = [
  editorialScanner,
  runwayScanner,
  streetSocialScanner,
  colourAuthorityScanner,
  designHouseScanner,
  fashionWeekScanner,
  itGirlDiscoveryScanner
] as const;

export const SCANNER_BY_ARCHETYPE: Readonly<Record<ScannerArchetype, GroundingScanner>> = {
  editorial: editorialScanner,
  runway: runwayScanner,
  street_social: streetSocialScanner,
  colour_authority: colourAuthorityScanner,
  design_house: designHouseScanner,
  fashion_week: fashionWeekScanner,
  it_girl_discovery: itGirlDiscoveryScanner
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/prompts/grounding-prompts.ts lib/domain/trends/__tests__/stories.test.ts
git commit -m "feat: add design_house, fashion_week, it_girl_discovery scanner archetypes"
```

---

### Task 4: Extend extraction to capture house and person attribution

**Files:**
- Modify: `lib/domain/trends/extraction.ts`

- [ ] **Step 1: Write a failing test for attribution extraction**

Add to `lib/domain/trends/__tests__/stories.test.ts`:

```typescript
import { buildExtractionPrompt } from "../extraction";

describe("buildExtractionPrompt with scanner archetype", () => {
  it("includes house attribution instructions for design_house scanner", () => {
    const prompt = buildExtractionPrompt(
      {
        title: "Prada SS26 Collection Review",
        excerpt: "Prada showed transparent organza with structural jackets.",
        author: null,
        publishDate: null,
        sourceName: "vogue.com"
      },
      "design_house"
    );
    expect(prompt).toContain("house_attribution");
  });

  it("includes person attribution instructions for it_girl_discovery scanner", () => {
    const prompt = buildExtractionPrompt(
      {
        title: "Best Dressed This Week",
        excerpt: "Kendall Jenner stepped out in a trench coat and ballet flats.",
        author: null,
        publishDate: null,
        sourceName: "harpersbazaar.com"
      },
      "it_girl_discovery"
    );
    expect(prompt).toContain("person_attribution");
  });

  it("does not include attribution fields for editorial scanner", () => {
    const prompt = buildExtractionPrompt(
      {
        title: "Spring Trends",
        excerpt: "Quiet luxury continues to dominate.",
        author: null,
        publishDate: null,
        sourceName: "vogue.com"
      },
      "editorial"
    );
    // No house/person attribution for generic editorial
    expect(prompt).not.toContain("house_attribution");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: FAIL — `buildExtractionPrompt` doesn't accept a second argument

- [ ] **Step 3: Extend extraction.ts**

In `lib/domain/trends/extraction.ts`:

**3a.** Add `house_attribution` and `person_attribution` to `ExtractedSignal` (after line 53):

```typescript
interface ExtractedSignal {
  trend_type: TrendType;
  label: string;
  normalized_attributes: Record<string, unknown>;
  season: string | null;
  region: string | null;
  confidence: number;
  delta?: SignalDelta;
  house_attribution?: string[];
  person_attribution?: string[];
}
```

**3b.** Update `buildExtractionPrompt` signature and body to accept optional `scannerArchetype`:

```typescript
export function buildExtractionPrompt(
  source: SourceContext,
  scannerArchetype?: string
): string {
  const colourList = COLOUR_FAMILIES.join(", ");
  const trendTypeList = TREND_TYPES.join(", ");

  const isHouseScanner =
    scannerArchetype === "design_house" || scannerArchetype === "fashion_week";
  const isPersonScanner = scannerArchetype === "it_girl_discovery";

  const attributionFields = isHouseScanner
    ? `  "house_attribution": array of design house names explicitly mentioned (e.g. ["Prada", "Acne Studios"]) — empty array if none,`
    : isPersonScanner
      ? `  "person_attribution": array of person names cited as style references (e.g. ["Kendall Jenner", "Zendaya"]) — empty array if none,`
      : "";

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
  "confidence": number 0-1,
  "delta": "new" | "intensifying" | "fading"  (optional; omit if not determinable)${attributionFields ? `,\n${attributionFields}` : ""}
}`;
}
```

**3c.** Update `upsertTrendSignal` to write `house_attribution` and `person_attribution`. Find the `update` call (around line 176) and the `insert` (around line 197) and add the new fields:

In the **update** block, add to the `.update()` call:
```typescript
...(signal.house_attribution && signal.house_attribution.length > 0
  ? { house_attribution: signal.house_attribution }
  : {}),
...(signal.person_attribution && signal.person_attribution.length > 0
  ? { person_attribution: signal.person_attribution }
  : {})
```

In the **insert** block, add to the `insert` object:
```typescript
house_attribution: signal.house_attribution ?? null,
person_attribution: signal.person_attribution ?? null,
```

**3d.** Update `processExtractionJob` to pass `scanner_archetype` from job metadata into `buildExtractionPrompt`. Find the chunk-processing loop (around line 364):

```typescript
// Change this:
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  max_tokens: 1024,
  messages: [{ role: "user", content: buildExtractionPrompt({
    title: sourceRow.title,
    excerpt: chunk,
    author: sourceRow.author,
    publishDate: sourceRow.publish_date,
    sourceName: sourceRow.source_name
  }) }]
});

// To this:
const scannerArchetype = typeof meta.scanner_archetype === "string" ? meta.scanner_archetype : undefined;
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  max_tokens: 1024,
  messages: [{ role: "user", content: buildExtractionPrompt(
    {
      title: sourceRow.title,
      excerpt: chunk,
      author: sourceRow.author,
      publishDate: sourceRow.publish_date,
      sourceName: sourceRow.source_name
    },
    scannerArchetype
  ) }]
});
```

Also extend `parseClaudeResponse` to pass through `house_attribution` and `person_attribution` (find it around line 89):

```typescript
async function parseClaudeResponse(content: string): Promise<ExtractedSignal[]> {
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed
      .filter(
        (s): s is ExtractedSignal =>
          typeof s === "object" &&
          s !== null &&
          "trend_type" in s &&
          "label" in s &&
          TREND_TYPES.includes((s as ExtractedSignal).trend_type)
      )
      .map((s) => {
        const delta = (s as { delta?: unknown }).delta;
        const houseAttr = (s as { house_attribution?: unknown }).house_attribution;
        const personAttr = (s as { person_attribution?: unknown }).person_attribution;

        const result: ExtractedSignal = { ...(s as ExtractedSignal) };
        if (typeof delta === "string" && VALID_DELTAS.has(delta as SignalDelta)) {
          result.delta = delta as SignalDelta;
        } else {
          delete result.delta;
        }
        result.house_attribution =
          Array.isArray(houseAttr)
            ? (houseAttr as unknown[]).filter((v): v is string => typeof v === "string")
            : undefined;
        result.person_attribution =
          Array.isArray(personAttr)
            ? (personAttr as unknown[]).filter((v): v is string => typeof v === "string")
            : undefined;
        return result;
      });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts lib/domain/trends/__tests__/extractors.test.ts
```

Expected: PASS on stories tests; existing extractor tests should still pass

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/extraction.ts lib/domain/trends/__tests__/stories.test.ts
git commit -m "feat: extend extraction to capture house and person attribution per scanner"
```

---

### Task 5: Story generation service

**Files:**
- Create: `lib/domain/trends/stories.ts`

- [ ] **Step 1: Write failing tests for story generation helpers**

Add to `lib/domain/trends/__tests__/stories.test.ts`:

```typescript
import {
  clusterSignals,
  computeMomentumLabel,
  buildStoryNamingPrompt
} from "../stories";

const makeSignal = (overrides: Partial<{
  id: string;
  label: string;
  canonical_label: string | null;
  trend_type: string;
  family: string | null;
  house_attribution: string[] | null;
  person_attribution: string[] | null;
  confidence_score: number | null;
  score_30d_delta: number | null;
}>) => ({
  id: "00000000-0000-0000-0000-000000000001",
  label: "wide-leg trousers",
  canonical_label: "Wide-Leg Trousers",
  trend_type: "garment",
  family: "trousers",
  house_attribution: null,
  person_attribution: null,
  confidence_score: 0.8,
  score_30d_delta: null,
  ...overrides
});

describe("clusterSignals", () => {
  it("groups signals with same trend_type and family", () => {
    const signals = [
      makeSignal({ id: "1", trend_type: "garment", family: "trousers" }),
      makeSignal({ id: "2", trend_type: "garment", family: "trousers" }),
      makeSignal({ id: "3", trend_type: "colour", family: "orange" })
    ];
    const clusters = clusterSignals(signals);
    expect(clusters).toHaveLength(2);
    const trouserCluster = clusters.find((c) => c.signals[0].family === "trousers");
    expect(trouserCluster?.signals).toHaveLength(2);
  });

  it("signals without family are grouped by canonical_label", () => {
    const signals = [
      makeSignal({ id: "1", family: null, canonical_label: "Quiet Luxury" }),
      makeSignal({ id: "2", family: null, canonical_label: "Quiet Luxury" })
    ];
    const clusters = clusterSignals(signals);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].signals).toHaveLength(2);
  });
});

describe("computeMomentumLabel", () => {
  it("returns null when no deltas available", () => {
    const signals = [makeSignal({ score_30d_delta: null })];
    expect(computeMomentumLabel(signals)).toBeNull();
  });

  it("returns positive label for positive avg delta", () => {
    const signals = [
      makeSignal({ score_30d_delta: 0.5 }),
      makeSignal({ score_30d_delta: 0.7 })
    ];
    const label = computeMomentumLabel(signals);
    expect(label).toMatch(/^\+\d+%/);
  });

  it("returns null when avg delta is below threshold (< 5%)", () => {
    const signals = [makeSignal({ score_30d_delta: 0.02 })];
    expect(computeMomentumLabel(signals)).toBeNull();
  });
});

describe("buildStoryNamingPrompt", () => {
  it("includes cluster label in prompt", () => {
    const clusters = [{
      groupKey: "garment::trousers",
      signals: [makeSignal({ label: "wide-leg trousers", house_attribution: ["Prada"] })]
    }];
    const prompt = buildStoryNamingPrompt(clusters);
    expect(prompt).toContain("wide-leg trousers");
    expect(prompt).toContain("Prada");
  });

  it("lists valid dominant_type values in prompt", () => {
    const clusters = [{ groupKey: "k", signals: [makeSignal({})] }];
    const prompt = buildStoryNamingPrompt(clusters);
    expect(prompt).toContain("garment_moment");
    expect(prompt).toContain("colour_combo");
    expect(prompt).toContain("it_girl_look");
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: FAIL — module `../stories` not found

- [ ] **Step 3: Create lib/domain/trends/stories.ts**

```typescript
import OpenAI from "openai";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { getServerEnv } from "@/lib/env";
import { STORY_DOMINANT_TYPES, type StoryDominantType, type TrendStory } from "./index";

interface SignalRow {
  id: string;
  label: string;
  canonical_label: string | null;
  trend_type: string;
  family: string | null;
  house_attribution: string[] | null;
  person_attribution: string[] | null;
  confidence_score: number | null;
  score_30d_delta: number | null;
}

export interface StoryCluster {
  signals: SignalRow[];
  groupKey: string;
}

export function clusterSignals(signals: SignalRow[]): StoryCluster[] {
  const groups = new Map<string, SignalRow[]>();
  for (const signal of signals) {
    const key = `${signal.trend_type}::${signal.family ?? signal.canonical_label ?? signal.label}`;
    const group = groups.get(key) ?? [];
    group.push(signal);
    groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([groupKey, sigs]) => ({
    groupKey,
    signals: sigs
  }));
}

export function computeMomentumLabel(signals: SignalRow[]): string | null {
  const deltas = signals
    .map((s) => s.score_30d_delta)
    .filter((d): d is number => d != null);
  if (deltas.length === 0) return null;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (Math.abs(avg) < 0.05) return null;
  const pct = Math.round(avg * 100);
  return pct > 0 ? `+${pct}% search interest` : `${pct}% search interest`;
}

export function buildStoryNamingPrompt(clusters: StoryCluster[]): string {
  const clustersText = clusters
    .map((c, i) => {
      const labels = c.signals
        .map((s) => s.canonical_label || s.label)
        .join(", ");
      const houses = [
        ...new Set(c.signals.flatMap((s) => s.house_attribution ?? []))
      ].join(", ");
      const people = [
        ...new Set(c.signals.flatMap((s) => s.person_attribution ?? []))
      ].join(", ");
      return [
        `Cluster ${i + 1}:`,
        `  Labels: ${labels}`,
        `  Type: ${c.signals[0].trend_type} | Family: ${c.signals[0].family ?? "–"}`,
        houses ? `  Houses: ${houses}` : null,
        people ? `  People: ${people}` : null
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return `You are a fashion editorial director. Give each trend cluster a punchy editorial headline (2-4 words), a one-line framing sentence, and classify its dominant type.

Dominant types: ${STORY_DOMINANT_TYPES.join(", ")}

Clusters:
${clustersText}

Return a JSON array (one object per cluster, in order):
[{
  "cluster_index": 1,
  "headline": "Transparent Denim",
  "framing": "The season's most literal take on exposed dressing.",
  "dominant_type": "garment_moment"
}]

Return only the JSON array. No markdown fences.`;
}

interface NamedCluster {
  cluster_index: number;
  headline: string;
  framing: string;
  dominant_type: StoryDominantType;
}

async function nameClustersBatch(
  clusters: StoryCluster[],
  client: OpenAI
): Promise<NamedCluster[]> {
  if (clusters.length === 0) return [];

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    messages: [{ role: "user", content: buildStoryNamingPrompt(clusters) }]
  });

  const text = response.choices[0]?.message?.content ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    return parsed.filter(
      (item): item is NamedCluster =>
        typeof item === "object" &&
        item !== null &&
        "cluster_index" in item &&
        "headline" in item &&
        "dominant_type" in item &&
        STORY_DOMINANT_TYPES.includes((item as NamedCluster).dominant_type)
    );
  } catch {
    return [];
  }
}

async function upsertStory(
  supabase: ReturnType<typeof createClient>,
  story: Omit<TrendStory, "id" | "created_at">
): Promise<void> {
  const { data: existing } = await supabase
    .from("trend_stories")
    .select("id, signal_ids")
    .ilike("headline", story.headline)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; signal_ids: string[] };
    const merged = [...new Set([...row.signal_ids, ...(story.signal_ids ?? [])])];
    await supabase
      .from("trend_stories")
      .update({
        signal_ids: merged,
        attributed_houses: story.attributed_houses,
        attributed_people: story.attributed_people,
        momentum_label: story.momentum_label ?? null,
        framing: story.framing ?? null,
        dominant_type: story.dominant_type ?? null,
        confidence_score: story.confidence_score ?? null,
        refreshed_at: new Date().toISOString()
      } as never)
      .eq("id", row.id);
    return;
  }

  await supabase
    .from("trend_stories")
    .insert({
      headline: story.headline,
      framing: story.framing ?? null,
      momentum_label: story.momentum_label ?? null,
      dominant_type: story.dominant_type ?? null,
      attributed_houses: story.attributed_houses ?? [],
      attributed_people: story.attributed_people ?? [],
      signal_ids: story.signal_ids ?? [],
      status: story.status ?? "candidate",
      confidence_score: story.confidence_score ?? null,
      refreshed_at: new Date().toISOString()
    } as never);
}

export async function generateTrendStories(opts?: {
  lookbackHours?: number;
}): Promise<{ upserted: number; skipped: number }> {
  const supabase = createClient();
  const env = getServerEnv();
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const lookbackHours = opts?.lookbackHours ?? 24;
  const since = new Date();
  since.setUTCHours(since.getUTCHours() - lookbackHours);

  const { data: rawSignals, error } = await supabase
    .from("trend_signals")
    .select(
      "id,label,canonical_label,trend_type,family,house_attribution,person_attribution,confidence_score,score_30d_delta"
    )
    .gte("last_seen_at", since.toISOString())
    .order("confidence_score", { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);

  const signals = (rawSignals ?? []) as SignalRow[];
  if (signals.length === 0) return { upserted: 0, skipped: 0 };

  const clusters = clusterSignals(signals);
  const named = await nameClustersBatch(clusters, client);
  const namedByIndex = new Map(named.map((n) => [n.cluster_index, n]));

  let upserted = 0;

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const naming = namedByIndex.get(i + 1);
    const houses = [
      ...new Set(cluster.signals.flatMap((s) => s.house_attribution ?? []))
    ];
    const people = [
      ...new Set(cluster.signals.flatMap((s) => s.person_attribution ?? []))
    ];
    const momentumLabel = computeMomentumLabel(cluster.signals);
    const avgConf =
      cluster.signals.reduce((a, s) => a + (s.confidence_score ?? 0.5), 0) /
      cluster.signals.length;
    const signalIds = cluster.signals.map((s) => s.id);

    await upsertStory(supabase, {
      headline:
        naming?.headline ??
        (cluster.signals[0].canonical_label || cluster.signals[0].label),
      framing: naming?.framing ?? null,
      momentum_label: momentumLabel,
      dominant_type: naming?.dominant_type ?? null,
      attributed_houses: houses,
      attributed_people: people,
      signal_ids: signalIds,
      status: "candidate",
      confidence_score: Math.round(avgConf * 100) / 100,
      refreshed_at: new Date().toISOString()
    });

    upserted++;
  }

  return { upserted, skipped: 0 };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run lib/domain/trends/__tests__/stories.test.ts
```

Expected: PASS — all tests in stories.test.ts pass

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/stories.ts lib/domain/trends/__tests__/stories.test.ts
git commit -m "feat: add story generation service with signal clustering and editorial naming"
```

---

### Task 6: Story generation cron endpoint

**Files:**
- Create: `app/api/cron/story-generation/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/cron/story-generation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { generateTrendStories } from "@/lib/domain/trends/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(
  request: NextRequest,
  cronSecret: string | undefined
): boolean {
  if (!cronSecret) return false;
  const bearer = request.headers.get("authorization");
  if (bearer && bearer === `Bearer ${cronSecret}`) return true;
  const custom = request.headers.get("x-cron-secret");
  if (custom && custom === cronSecret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const env = getServerEnv();

    if (!isAuthorized(request, env.CRON_SECRET)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const lookbackHours = parseInt(
      url.searchParams.get("lookback_hours") ?? "24",
      10
    );

    const result = await generateTrendStories({ lookbackHours });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/story-generation]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors in the new route file

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/story-generation/route.ts
git commit -m "feat: add story-generation cron endpoint"
```

---

### Task 7: Add getTrendStories and story match queries to service

**Files:**
- Modify: `lib/domain/trends/service.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/domain/trends/__tests__/service.test.ts` additions — add to the existing test file at the end:

```typescript
// In lib/domain/trends/__tests__/service.test.ts, add these describe blocks:

describe("assembleStoryMatches", () => {
  it("maps matching garment IDs from signal reasoning to stories", () => {
    const { assembleStoryMatches } = require("../service");

    const stories = [
      {
        id: "story-1",
        headline: "Transparent Denim",
        signal_ids: ["sig-1", "sig-2"],
        attributed_houses: [],
        attributed_people: []
      }
    ];
    const matches = [
      {
        trend_signal_id: "sig-1",
        match_type: "exact_match",
        score: 0.9,
        reasoning_json: { matched_garment_ids: ["g1", "g2"] }
      },
      {
        trend_signal_id: "sig-2",
        match_type: "adjacent_match",
        score: 0.7,
        reasoning_json: { matched_garment_ids: ["g2", "g3"] }
      }
    ];

    const result = assembleStoryMatches(stories, matches);
    expect(result).toHaveLength(1);
    expect(result[0].matchingGarmentIds).toEqual(expect.arrayContaining(["g1", "g2", "g3"]));
    expect(result[0].matchingGarmentIds).toHaveLength(3); // deduped
    expect(result[0].bestMatchType).toBe("exact_match");
  });
});
```

- [ ] **Step 2: Run to verify test fails**

```bash
pnpm vitest run lib/domain/trends/__tests__/service.test.ts
```

Expected: FAIL — `assembleStoryMatches` not exported from `../service`

- [ ] **Step 3: Add story query and assembly functions to service.ts**

In `lib/domain/trends/service.ts`, add the following imports at the top:

```typescript
import {
  trendStorySchema,
  type TrendStory,
  type UserTrendMatch
} from "./index";
```

(The existing import already has `userTrendMatchSchema` and `UserTrendMatch` — add `trendStorySchema` and `TrendStory` to it.)

Then add these functions after `upsertUserTrendMatches`:

```typescript
export async function getTrendStories(): Promise<TrendStory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trend_stories")
    .select(
      "id,headline,framing,momentum_label,dominant_type,attributed_houses,attributed_people,signal_ids,status,confidence_score,created_at,refreshed_at"
    )
    .order("confidence_score", { ascending: false, nullsFirst: false })
    .order("refreshed_at", { ascending: false });

  if (error) throw new Error(error.message);
  return z.array(trendStorySchema).parse(data ?? []);
}

export interface TrendStoryWithMatches {
  story: TrendStory;
  matchingGarmentIds: string[];
  bestMatchType: UserTrendMatch["match_type"] | null;
  bestScore: number;
}

const MATCH_TYPE_RANK: Record<UserTrendMatch["match_type"], number> = {
  exact_match: 3,
  adjacent_match: 2,
  styling_match: 1,
  missing_piece: 0
};

export function assembleStoryMatches(
  stories: TrendStory[],
  matches: UserTrendMatch[]
): TrendStoryWithMatches[] {
  const matchesBySignalId = new Map<string, UserTrendMatch>();
  for (const m of matches) {
    matchesBySignalId.set(m.trend_signal_id, m);
  }

  return stories.map((story) => {
    const storyMatches = (story.signal_ids ?? [])
      .map((sid) => matchesBySignalId.get(sid))
      .filter((m): m is UserTrendMatch => m != null);

    const garmentIds = [
      ...new Set(
        storyMatches.flatMap((m) => {
          const reasoning = m.reasoning_json as {
            matched_garment_ids?: string[];
          };
          return reasoning.matched_garment_ids ?? [];
        })
      )
    ];

    const bestMatch = [...storyMatches].sort(
      (a, b) =>
        MATCH_TYPE_RANK[b.match_type] - MATCH_TYPE_RANK[a.match_type]
    )[0];

    return {
      story,
      matchingGarmentIds: garmentIds,
      bestMatchType: bestMatch?.match_type ?? null,
      bestScore: bestMatch?.score ?? 0
    };
  });
}

export async function getUserTrendStoryMatches(
  userId: string,
  stories: TrendStory[]
): Promise<TrendStoryWithMatches[]> {
  const matches = await getUserTrendMatches(userId);
  return assembleStoryMatches(stories, matches);
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run lib/domain/trends/__tests__/service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/trends/service.ts lib/domain/trends/__tests__/service.test.ts
git commit -m "feat: add getTrendStories, assembleStoryMatches, getUserTrendStoryMatches to service"
```

---

### Task 8: Update actions to provide story data + garment previews

**Files:**
- Modify: `app/trends/actions.ts`

- [ ] **Step 1: Add loadUserTrendStories action**

Replace the contents of `app/trends/actions.ts` with:

```typescript
"use server";

import { getRequiredUser } from "@/lib/auth";
import {
  getUserTrendMatches,
  getTrendSignals,
  getTrendStories,
  getUserTrendStoryMatches,
  type TrendStoryWithMatches
} from "@/lib/domain/trends/service";
import type { UserTrendMatch, TrendSignalWithColour } from "@/lib/domain/trends/index";
import { createClient } from "@/lib/supabase/server";

export interface TrendMatchWithSignal {
  match: UserTrendMatch;
  signal: TrendSignalWithColour;
}

export interface GarmentPreview {
  id: string;
  title: string;
  preview_url: string | null;
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

export async function loadUserTrendStories(): Promise<{
  storyMatches: TrendStoryWithMatches[];
  garmentPreviews: Record<string, GarmentPreview>;
}> {
  const user = await getRequiredUser();
  const stories = await getTrendStories();
  const storyMatches = await getUserTrendStoryMatches(user.id, stories);

  const allGarmentIds = [
    ...new Set(storyMatches.flatMap((sm) => sm.matchingGarmentIds))
  ];

  const garmentPreviews: Record<string, GarmentPreview> = {};

  if (allGarmentIds.length > 0) {
    const supabase = await createClient();

    const { data: garments } = await supabase
      .from("garments")
      .select(
        "id,title,garment_images(storage_path,image_type,created_at,id,garment_id,width,height)"
      )
      .in("id", allGarmentIds);

    for (const g of (garments ?? []) as Array<{
      id: string;
      title: string;
      garment_images: Array<{
        storage_path: string;
        image_type: string;
        created_at: string;
      }> | null;
    }>) {
      const images = g.garment_images ?? [];
      const featureImage =
        images.find((img) => img.image_type === "cutout") ??
        images.find((img) => img.image_type === "cropped") ??
        images.find((img) => img.image_type === "thumbnail") ??
        images[0];

      let preview_url: string | null = null;
      if (featureImage?.storage_path) {
        const { data: urlData } = supabase.storage
          .from("garment-images")
          .getPublicUrl(featureImage.storage_path);
        preview_url = urlData?.publicUrl ?? null;
      }

      garmentPreviews[g.id] = { id: g.id, title: g.title, preview_url };
    }
  }

  return { storyMatches, garmentPreviews };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no type errors

- [ ] **Step 3: Commit**

```bash
git add app/trends/actions.ts
git commit -m "feat: add loadUserTrendStories action with garment preview data"
```

---

### Task 9: Update trends page to render story cards

**Files:**
- Modify: `app/trends/page.tsx`

- [ ] **Step 1: Replace page.tsx with story-first rendering**

Replace the full contents of `app/trends/page.tsx` with:

```typescript
import { loadUserTrends, loadUserTrendStories } from "./actions";
import { TrendSparkline } from "@/components/trend-sparkline";

const MATCH_LABELS: Record<string, string> = {
  exact_match: "On trend",
  adjacent_match: "Close match",
  styling_match: "Can style it",
  missing_piece: "Missing piece"
};

const MATCH_COLOURS: Record<string, string> = {
  exact_match:
    "border-[rgba(13,255,232,0.28)] bg-[rgba(13,255,232,0.12)] text-[var(--trend-accent-ink)]",
  adjacent_match:
    "border-[rgba(123,92,240,0.22)] bg-[rgba(123,92,240,0.08)] text-[var(--accent-strong)]",
  styling_match:
    "border-[rgba(255,107,157,0.24)] bg-[rgba(255,107,157,0.12)] text-[var(--accent-strong)]",
  missing_piece:
    "border-[rgba(255,209,102,0.26)] bg-[rgba(255,209,102,0.18)] text-[var(--accent-strong)]"
};

export default async function TrendsPage() {
  const [{ storyMatches, garmentPreviews }, trendMatches] = await Promise.all([
    loadUserTrendStories(),
    loadUserTrends()
  ]);

  const hasStories = storyMatches.length > 0;

  if (!hasStories && trendMatches.length === 0) {
    return (
      <main className="pw-trends-shell">
        <div className="pw-shell max-w-5xl py-12">
          <section className="pw-trends-banner pw-fade-up p-8 text-center">
            <p className="pw-kicker text-[var(--trend-accent)]">
              Trend Intelligence
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] leading-[0.95]">
              No trend signals yet.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/76">
              Trigger an ingestion run to populate the global trend dashboard
              and see what your wardrobe already covers.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const grouped = {
    exact_match: trendMatches.filter(
      (t) => t.match.match_type === "exact_match"
    ),
    adjacent_match: trendMatches.filter(
      (t) => t.match.match_type === "adjacent_match"
    ),
    styling_match: trendMatches.filter(
      (t) => t.match.match_type === "styling_match"
    ),
    missing_piece: trendMatches.filter(
      (t) => t.match.match_type === "missing_piece"
    )
  };

  return (
    <main className="pw-trends-shell">
      <div className="pw-shell max-w-6xl space-y-10">
        {/* ── Header banner ── */}
        <section className="pw-trends-banner pw-fade-up overflow-hidden p-7 md:p-8">
          <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
            <div className="max-w-2xl">
              <p className="pw-kicker text-[var(--trend-accent)]">
                Trend Intelligence
              </p>
              <h1 className="mt-4 max-w-[11ch] text-4xl font-semibold tracking-[-0.07em] leading-[0.95] md:text-6xl">
                See what your wardrobe already owns, almost owns, or still
                needs.
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[8px] border border-[rgba(13,255,232,0.2)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/62">
                  Trend Stories
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {storyMatches.length}
                </p>
              </div>
              <div className="rounded-[8px] border border-[rgba(13,255,232,0.2)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/62">
                  Active Matches
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {trendMatches.length}
                </p>
              </div>
              <div className="rounded-[8px] border border-[rgba(13,255,232,0.2)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/62">
                  Evidence Links
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {trendMatches.reduce(
                    (count, { signal }) => count + signal.sources.length,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Story cards ── */}
        {hasStories && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="pw-kicker text-[var(--muted)]">
                  Trend Stories
                </h2>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.07em] text-[var(--foreground)]">
                  What's moving right now.
                </p>
              </div>
              <span className="text-sm text-[var(--muted)]">
                {storyMatches.length} stories
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {storyMatches.map(
                ({ story, matchingGarmentIds, bestMatchType, bestScore }) => {
                  const matchColour =
                    bestMatchType ? MATCH_COLOURS[bestMatchType] : MATCH_COLOURS.missing_piece;
                  const matchLabel =
                    bestMatchType ? MATCH_LABELS[bestMatchType] : null;
                  const previewPieces = matchingGarmentIds
                    .slice(0, 4)
                    .map((id) => garmentPreviews[id])
                    .filter(Boolean);
                  const outfitHref =
                    matchingGarmentIds.length > 0
                      ? `/outfits?pieces=${matchingGarmentIds.slice(0, 5).join(",")}`
                      : "/outfits";

                  return (
                    <div
                      key={story.id ?? story.headline}
                      className={`pw-trends-panel pw-hover-panel pw-fade-up border p-5 ${matchColour}`}
                    >
                      {/* Story headline */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.22em] opacity-65">
                            {story.dominant_type?.replace(/_/g, " ") ?? "trend story"}
                          </p>
                          <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                            {story.headline}
                          </p>
                          {story.momentum_label && (
                            <p className="mt-2 text-sm font-semibold opacity-85">
                              {story.momentum_label}
                            </p>
                          )}
                          {story.framing && (
                            <p className="mt-2 text-sm leading-6 opacity-80">
                              {story.framing}
                            </p>
                          )}
                        </div>
                        {matchLabel && (
                          <span className="shrink-0 rounded-full border border-current/12 px-2.5 py-1 text-xs font-semibold opacity-72">
                            {matchLabel}
                          </span>
                        )}
                      </div>

                      {/* Attribution pills */}
                      {(story.attributed_houses.length > 0 ||
                        story.attributed_people.length > 0) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {story.attributed_houses.map((house) => (
                            <span
                              key={house}
                              className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] opacity-85"
                            >
                              {house}
                            </span>
                          ))}
                          {story.attributed_people.map((person) => (
                            <span
                              key={person}
                              className="rounded-full border border-current/16 bg-white/30 px-2.5 py-1 text-[11px] italic opacity-80"
                            >
                              {person}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Matching wardrobe pieces */}
                      <div className="mt-5">
                        <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                          Your pieces
                        </p>
                        {previewPieces.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {previewPieces.map((piece) => (
                              <div
                                key={piece.id}
                                className="relative h-14 w-14 overflow-hidden rounded-[6px] border border-current/10 bg-white/10"
                                title={piece.title}
                              >
                                {piece.preview_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={piece.preview_url}
                                    alt={piece.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[9px] opacity-50">
                                    {piece.title.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {matchingGarmentIds.length > 4 && (
                              <div className="flex h-14 w-14 items-center justify-center rounded-[6px] border border-current/10 bg-white/10 text-xs opacity-70">
                                +{matchingGarmentIds.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs opacity-70">
                            No matching pieces yet.
                          </p>
                        )}
                      </div>

                      {/* Generate outfit CTA */}
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div className="text-xs opacity-60">
                          {story.signal_ids.length} signal
                          {story.signal_ids.length !== 1 ? "s" : ""}
                          {bestScore > 0
                            ? ` · ${Math.round(bestScore * 100)}% match`
                            : ""}
                        </div>
                        <a
                          href={outfitHref}
                          className="rounded-full border border-current/20 bg-white/10 px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                        >
                          Generate outfit →
                        </a>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}

        {/* ── Per-signal view (preserved below stories) ── */}
        {(
          Object.entries(grouped) as [string, typeof trendMatches][]
        ).map(([matchType, items]) => {
          if (items.length === 0) return null;
          return (
            <section key={matchType} className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="pw-kicker text-[var(--muted)]">
                    {MATCH_LABELS[matchType]}
                  </h2>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.07em] text-[var(--foreground)]">
                    {sectionHeading(matchType)}
                  </p>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {items.length} signals
                </span>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {items.map(({ match, signal }) => {
                  const reasoning = match.reasoning_json as {
                    match_reason?: string;
                    matched_garment_ids?: string[];
                    attributes_matched?: string[];
                  };
                  return (
                    <div
                      key={`${match.trend_signal_id}-${match.match_type}`}
                      className={`pw-trends-panel pw-hover-panel pw-fade-up border p-5 ${MATCH_COLOURS[matchType]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.22em] opacity-65">
                            {signal.family ||
                              signal.trend_type.replace("_", " ")}
                            {signal.season ? ` · ${signal.season}` : ""}
                          </p>
                          <p className="mt-3 text-2xl font-semibold capitalize tracking-[-0.05em]">
                            {signal.canonical_label || signal.label}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {signal.subfamily ? (
                              <span className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] opacity-80">
                                {signal.subfamily}
                              </span>
                            ) : null}
                            {signal.latest_metric?.status ||
                            signal.trend_status ? (
                              <span className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] opacity-80">
                                {signal.latest_metric?.status ||
                                  signal.trend_status}
                              </span>
                            ) : null}
                            {signal.score_30d_delta != null ? (
                              <span className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] opacity-80">
                                {signal.score_30d_delta > 0 ? "+" : ""}
                                {(signal.score_30d_delta * 100).toFixed(1)}%
                                / 30d
                              </span>
                            ) : null}
                          </div>
                          {reasoning.match_reason ? (
                            <p className="mt-3 text-sm leading-6 opacity-90">
                              {reasoning.match_reason}
                            </p>
                          ) : null}
                          {reasoning.attributes_matched &&
                          reasoning.attributes_matched.length > 0 ? (
                            <p className="mt-2 text-xs opacity-72">
                              Matched:{" "}
                              {reasoning.attributes_matched.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border border-current/12 px-2.5 py-1 text-xs font-semibold opacity-72">
                          {Math.round(match.score * 100)}%
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                            30-Day Movement
                          </p>
                          <div className="mt-3">
                            <TrendSparkline
                              values={signal.metrics_30d
                                .map(
                                  (metric) =>
                                    metric.composite_score ??
                                    metric.search_interest ??
                                    null
                                )
                                .filter((value): value is number => value != null)}
                              status={
                                signal.latest_metric?.status ||
                                signal.trend_status
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                            Example Entities
                          </p>
                          {signal.entities.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {signal.entities.map((entity) => (
                                <span
                                  key={
                                    entity.id ??
                                    `${entity.entity_type}-${entity.normalized_label}`
                                  }
                                  className="rounded-full border border-current/12 bg-white/50 px-3 py-1.5 text-xs font-medium opacity-85"
                                >
                                  {entity.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs opacity-70">
                              No example entities yet.
                            </p>
                          )}
                        </div>
                      </div>

                      {signal.trend_colour ? (
                        <div className="mt-5 flex items-center gap-3 rounded-[8px] border border-current/10 bg-white/40 px-4 py-3">
                          <span
                            className="h-8 w-8 rounded-full border border-black/10"
                            style={{
                              backgroundColor:
                                signal.trend_colour.canonical_hex
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                              Colour Direction
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {signal.trend_colour.source_label ||
                                signal.trend_colour.family ||
                                signal.trend_colour.source_name}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                            Source Trail
                          </p>
                          {signal.sources.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {signal.sources.map((source) => (
                                <a
                                  key={source.id ?? source.source_url}
                                  href={source.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-current/12 bg-white/50 px-3 py-1.5 text-xs font-medium opacity-85 transition-opacity hover:opacity-100"
                                  title={source.title}
                                >
                                  {source.source_name}
                                </a>
                              ))}
                            </div>
                          ) : signal.trend_colour?.source_url ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href={signal.trend_colour.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-current/12 bg-white/50 px-3 py-1.5 text-xs font-medium opacity-85 transition-opacity hover:opacity-100"
                              >
                                {signal.trend_colour.source_name}
                              </a>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs opacity-70">
                              No source links yet.
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs opacity-70">
                          {signal.last_seen_at ? (
                            <p>Last seen {formatShortDate(signal.last_seen_at)}</p>
                          ) : null}
                          {signal.source_count ? (
                            <p>{signal.source_count} source hits</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function sectionHeading(matchType: string) {
  switch (matchType) {
    case "exact_match":
      return "You already own the signal.";
    case "adjacent_match":
      return "You are close enough to style into it.";
    case "styling_match":
      return "You can push existing pieces toward the trend.";
    case "missing_piece":
      return "One item would unlock the direction.";
    default:
      return "Trend signals";
  }
}

function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short"
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: no errors in `app/trends/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add app/trends/page.tsx
git commit -m "feat: render trend story cards on trends page with matching pieces and generate CTA"
```

---

### Task 10: Wire up cron schedules in vercel.json

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add new cron entries**

Replace the contents of `vercel.json` with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/trend-scanners?archetype=runway",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/trend-scanners?archetype=fashion_week",
      "schedule": "30 6 * * *"
    },
    {
      "path": "/api/cron/trend-scanners?archetype=street_social",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/cron/trend-scanners?archetype=editorial",
      "schedule": "0 8 * * 1"
    },
    {
      "path": "/api/cron/trend-scanners?archetype=design_house",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/trend-scanners?archetype=it_girl_discovery",
      "schedule": "0 10 * * 2,5"
    },
    {
      "path": "/api/cron/trend-scanners?archetype=colour_authority",
      "schedule": "0 8 1 * *"
    },
    {
      "path": "/api/cron/story-generation",
      "schedule": "0 11 * * *"
    }
  ]
}
```

- [ ] **Step 2: Verify full test suite passes**

```bash
pnpm vitest run
```

Expected: PASS — no regressions

- [ ] **Step 3: Final TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: add cron schedules for design_house, fashion_week, it_girl_discovery scanners and story generation"
```

---

## Self-Review

**Spec coverage check:**
- ✅ New scanner archetypes (design_house, fashion_week, it_girl_discovery) — Task 3
- ✅ Discovered it-girl names (not hardcoded) — Task 3 `itGirlDiscoveryScanner.buildGroundingQuery`
- ✅ TrendStory model with headline, momentum_label, attributed_houses, attributed_people — Tasks 1 + 2
- ✅ house_attribution + person_attribution on trend_signals — Tasks 1 + 4
- ✅ Story generation job (signal clustering + Claude naming) — Task 5
- ✅ Cron endpoint for story generation — Task 6
- ✅ getTrendStories() + assembleStoryMatches() — Task 7
- ✅ loadUserTrendStories() action with garment previews — Task 8
- ✅ Story card UI with headline, momentum, attribution pills, piece thumbnails, Generate CTA — Task 9
- ✅ vercel.json cron schedules — Task 10
- ✅ story_id on user_trend_matches — Task 1 (migration adds column)

**Type consistency:**
- `TrendStory` defined in `index.ts` (Task 2), used in `service.ts` (Task 7), `actions.ts` (Task 8), `page.tsx` (Task 9) — consistent
- `assembleStoryMatches` exported from `service.ts` (Task 7), tested in `service.test.ts` (Task 7) — consistent
- `ScannerArchetype` extended in Task 3, `SCANNER_BY_ARCHETYPE` updated with same keys — consistent
- `buildExtractionPrompt` signature extended in Task 4 with optional second arg — backward compatible

**Placeholder scan:** No TBDs or TODOs. All code steps show complete implementations.
