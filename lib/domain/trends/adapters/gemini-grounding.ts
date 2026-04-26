/**
 * Gemini Google-Grounding adapter for the trends engine.
 *
 * Ports the maci watchlist pattern (`lib/watch-runner.ts:435-816`,
 * `lib/tool-executor.ts:553-711` in the maci repo) onto fashionapp5's
 * existing trend ingestion pipeline.
 *
 * Flow (mirrors `ingestion.ts:runSourceIngestion` but sourced from Gemini
 * rather than an RSS feed):
 *   1. Create a trend_ingestion_jobs row of type "source_ingestion".
 *   2. Call Gemini 2.5-flash with the googleSearch tool using the scanner's
 *      buildGroundingQuery() prompt.
 *   3. Parse groundingMetadata.groundingChunks into {title, url, snippet}.
 *   4. For each chunk: dedupe against trend_sources by URL, insert a new
 *      row with the grounded snippet as raw_text_excerpt, queue a
 *      signal_extraction job whose metadata carries scanner + authority.
 *   5. Mark the ingestion job succeeded/failed.
 *
 * Why this bypasses robots.txt cleanly:
 *   - We never fetch vogue.com / harpersbazaar.com / wwd.com HTML directly.
 *   - Gemini returns snippets from Google's index (Google has indexing
 *     permission from those publishers).
 *   - We store snippet text + the canonical URL as a citation link.
 *
 * REQUIRED INSTALL BEFORE RUNNING:
 *   pnpm add @google/generative-ai
 *
 * REQUIRED ENV (add to lib/env.ts serverEnvSchema):
 *   GEMINI_API_KEY            – Google AI Studio key
 *   GEMINI_SEARCH_MODEL_ID    – optional, defaults to "gemini-2.5-flash"
 */

import { createServiceClient as createClient } from "@/lib/supabase/service";
import type { TablesInsert } from "@/types/database";
import type {
  GroundingScanner,
  ScannerRunInput
} from "../prompts/grounding-prompts";

type TrendSourceInsert = TablesInsert<"trend_sources">;
type TrendIngestionJobInsert = TablesInsert<"trend_ingestion_jobs">;

/**
 * One cited result extracted from Gemini's groundingMetadata.
 * Equivalent to maci's groundingChunks[i].web shape.
 */
export interface GroundingCitation {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Flat summary of a grounded search call, ready to hand to the extraction
 * stage. Mirrors maci's `searchWeb()` return shape from tool-executor.ts:645.
 */
export interface GroundingSearchResult {
  query: string;
  summary: string;
  citations: GroundingCitation[];
  groundingAvailable: boolean;
}

export interface GroundingScanResult {
  scannerArchetype: string;
  citationCount: number;
  newSourceCount: number;
  queuedJobCount: number;
  groundingAvailable: boolean;
}

// -------------------------------------------------------------------------
// Gemini client seam
// -------------------------------------------------------------------------

/**
 * Thin wrapper around Gemini's generateContent call with the googleSearch
 * tool attached. Isolated so it's easy to mock in tests.
 *
 * The `@google/generative-ai` import is intentionally dynamic — the package
 * isn't yet a dependency of fashionapp5. Add it before first run:
 *   pnpm add @google/generative-ai
 */
/**
 * Structural view of the slice of @google/generative-ai we call. Defined
 * locally so the typechecker doesn't demand the package be installed.
 */
interface GenAIModuleShape {
  GoogleGenerativeAI: new (apiKey: string) => {
    getGenerativeModel: (cfg: {
      model: string;
      tools?: unknown[];
      generationConfig?: { temperature?: number; maxOutputTokens?: number };
    }) => {
      generateContent: (prompt: string) => Promise<{
        response: {
          text: () => string;
          candidates?: Array<{
            groundingMetadata?: GroundingMetadataShape;
          }>;
        };
      }>;
    };
  };
}

async function callGeminiWithGrounding(
  prompt: string,
  opts: { apiKey: string; modelId: string }
): Promise<GroundingSearchResult> {
  // Dynamic import so the project still compiles before the package is
  // installed. Install with: `npm install @google/generative-ai`.
  // The string is assembled at runtime so TS doesn't try to resolve it.
  const moduleName = ["@google", "generative-ai"].join("/");
  let genAIModule: GenAIModuleShape | null = null;
  try {
    genAIModule = (await import(moduleName)) as GenAIModuleShape;
  } catch {
    genAIModule = null;
  }

  if (!genAIModule) {
    throw new Error(
      "Gemini grounding adapter requires `@google/generative-ai`. " +
        "Run: npm install @google/generative-ai"
    );
  }

  const { GoogleGenerativeAI } = genAIModule;
  const client = new GoogleGenerativeAI(opts.apiKey);

  const model = client.getGenerativeModel({
    model: opts.modelId,
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024
    }
  });

  const result = await model.generateContent(prompt);
  const response = result.response;
  const summary = response.text() ?? "";

  const candidate = response.candidates?.[0];
  const grounding = candidate?.groundingMetadata ?? undefined;

  const citations = extractGroundingCitations(summary, grounding);

  return {
    query: prompt,
    summary,
    citations,
    groundingAvailable: Boolean(grounding)
  };
}

/**
 * Shape of the fields we care about on groundingMetadata. Typed loosely
 * because the SDK's exported types have been in flux.
 */
interface GroundingMetadataShape {
  groundingChunks?: Array<{
    web?: { uri?: string; title?: string };
  }>;
  groundingSupports?: Array<{
    segment?: { startIndex?: number; endIndex?: number; text?: string };
    groundingChunkIndices?: number[];
  }>;
  citationMetadata?: {
    citationSources?: Array<{ uri?: string; title?: string }>;
  };
}

/**
 * Extract {title, url, snippet} triples from Gemini's grounding metadata.
 * Mirrors maci's citation-extraction logic in tool-executor.ts:645-687.
 *
 * Priority order:
 *   1. groundingChunks[].web (primary)
 *   2. citationMetadata.citationSources (fallback)
 *
 * The snippet text is assembled by joining the groundingSupports segments
 * that point at each chunk. If no segment maps to a chunk, we fall back
 * to a per-chunk slice of the overall summary.
 */
export function extractGroundingCitations(
  summary: string,
  grounding: GroundingMetadataShape | undefined
): GroundingCitation[] {
  const citations: GroundingCitation[] = [];
  const seenUrls = new Set<string>();

  if (grounding?.groundingChunks?.length) {
    const supportsByChunk = new Map<number, string[]>();
    for (const support of grounding.groundingSupports ?? []) {
      const text = support.segment?.text ?? "";
      if (!text) continue;
      for (const idx of support.groundingChunkIndices ?? []) {
        const arr = supportsByChunk.get(idx) ?? [];
        arr.push(text);
        supportsByChunk.set(idx, arr);
      }
    }

    grounding.groundingChunks.forEach((chunk, idx) => {
      const url = chunk.web?.uri?.trim();
      const title = chunk.web?.title?.trim() ?? "";
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);

      const segments = supportsByChunk.get(idx);
      const snippet =
        segments && segments.length
          ? segments.join(" ").slice(0, 1200)
          : summary.slice(0, 400);

      citations.push({ title: title || url, url, snippet });
    });
  }

  // Fallback path — citationMetadata on candidates
  for (const src of grounding?.citationMetadata?.citationSources ?? []) {
    const url = src.uri?.trim();
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    citations.push({
      title: src.title?.trim() || url,
      url,
      snippet: summary.slice(0, 400)
    });
  }

  return citations;
}

// -------------------------------------------------------------------------
// Authority scoring
// -------------------------------------------------------------------------

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function authorityScoreFor(
  scanner: GroundingScanner,
  url: string
): number {
  const domain = extractDomain(url);
  if (!domain) return 0.6;

  // Exact match first (e.g. "vogue.com" key hits "vogue.com" hostname)
  const exact = scanner.authorityByDomain[domain];
  if (typeof exact === "number") return exact;

  // Suffix match for subdomains / path-prefixed keys like "vogue.com/fashion-shows"
  for (const [key, score] of Object.entries(scanner.authorityByDomain)) {
    const keyDomain = key.split("/")[0];
    if (keyDomain && domain.endsWith(keyDomain)) return score;
  }

  return 0.6; // unknown domain still has some signal
}

// -------------------------------------------------------------------------
// Main entry — runGroundingScan
// -------------------------------------------------------------------------

export async function runGroundingScan(
  scanner: GroundingScanner,
  input: ScannerRunInput,
  opts?: {
    /** Injected for tests; defaults to real Gemini call. */
    search?: (prompt: string) => Promise<GroundingSearchResult>;
  }
): Promise<GroundingScanResult> {
  const supabase = createClient();

  const { data: jobData, error: jobError } = await supabase
    .from("trend_ingestion_jobs")
    .insert(({
      job_type: "source_ingestion",
      status: "running",
      metadata_json: {
        adapter: "gemini_grounding",
        scanner_archetype: scanner.archetype,
        scanner_targets: [...scanner.targetTrendTypes],
        query_window_days: scanner.recencyWindowDays,
        season: input.season ?? null,
        region: input.region ?? null
      }
    } satisfies Partial<TrendIngestionJobInsert>) as never)
    .select("id")
    .single();

  if (jobError) {
    throw new Error(`Failed to create grounding job: ${jobError.message}`);
  }
  const jobId = (jobData as { id: string }).id;

  try {
    // 1. Grounded search
    const search =
      opts?.search ??
      (async (p: string) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY is not set — grounding disabled");
        }
        const modelId =
          process.env.GEMINI_SEARCH_MODEL_ID ?? "gemini-2.5-flash";
        return callGeminiWithGrounding(p, { apiKey, modelId });
      });

    const prompt = scanner.buildGroundingQuery(input);
    const searchResult = await search(prompt);

    let newSourceCount = 0;
    let queuedJobCount = 0;

    // 2. For each citation, dedupe by URL, insert trend_source + queue extraction
    for (const citation of searchResult.citations) {
      if (!citation.url || !citation.snippet) continue;

      const { data: existing } = await supabase
        .from("trend_sources")
        .select("id")
        .eq("source_url", citation.url)
        .maybeSingle();

      if (existing) continue;

      const authorityScore = authorityScoreFor(scanner, citation.url);
      const sourceName = extractDomain(citation.url) || "gemini_grounded";

      const sourceInsert: TrendSourceInsert = {
        source_name: sourceName,
        // Tag as grounded so downstream filters can distinguish from RSS sources.
        source_type: "gemini_grounded",
        source_url: citation.url,
        title: citation.title,
        publish_date: null, // Gemini doesn't surface pub dates in groundingChunks
        author: null,
        region: input.region ?? null,
        season: input.season ?? null,
        raw_text_excerpt: citation.snippet,
        ingestion_timestamp: new Date().toISOString()
      };

      const { data: sourceData, error: sourceError } = await supabase
        .from("trend_sources")
        .insert(sourceInsert as never)
        .select("id")
        .single();

      if (sourceError) {
        if (sourceError.code === "23505") continue; // race on unique URL — skip
        throw new Error(
          `Failed to insert grounded trend source: ${sourceError.message}`
        );
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
            source_name: sourceName,
            source_type: "gemini_grounded",
            scanner_archetype: scanner.archetype,
            scanner_targets: [...scanner.targetTrendTypes],
            authority_score: authorityScore,
            grounding_query: prompt,
            citation_url: citation.url
          }
        } satisfies Partial<TrendIngestionJobInsert>) as never);

      if (extractJobError) {
        throw new Error(
          `Failed to queue extraction job for grounded source: ${extractJobError.message}`
        );
      }

      queuedJobCount++;
    }

    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        metadata_json: {
          adapter: "gemini_grounding",
          scanner_archetype: scanner.archetype,
          citation_count: searchResult.citations.length,
          new_sources: newSourceCount,
          grounding_available: searchResult.groundingAvailable
        }
      } as never))
      .eq("id", jobId);

    return {
      scannerArchetype: scanner.archetype,
      citationCount: searchResult.citations.length,
      newSourceCount,
      queuedJobCount,
      groundingAvailable: searchResult.groundingAvailable
    };
  } catch (err) {
    await supabase
      .from("trend_ingestion_jobs")
      .update(({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata_json: {
          adapter: "gemini_grounding",
          scanner_archetype: scanner.archetype,
          error: String(err)
        }
      } as never))
      .eq("id", jobId);
    throw err;
  }
}
