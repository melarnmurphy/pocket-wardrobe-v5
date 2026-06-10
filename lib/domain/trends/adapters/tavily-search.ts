import { createServiceClient as createClient } from "@/lib/supabase/service";
import type { TablesInsert } from "@/types/database";
import type {
  GroundingScanner,
  ScannerRunInput
} from "../prompts/grounding-prompts";

type TrendSourceInsert = TablesInsert<"trend_sources">;
type TrendIngestionJobInsert = TablesInsert<"trend_ingestion_jobs">;

export interface GroundingCitation {
  title: string;
  url: string;
  snippet: string;
}

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
// Tavily search seam
// -------------------------------------------------------------------------

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  results: TavilyResult[];
}

async function callTavilySearch(
  query: string,
  opts: { apiKey: string }
): Promise<GroundingSearchResult> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: opts.apiKey,
      query,
      search_depth: "advanced",
      max_results: 10,
      include_answer: false
    })
  });

  if (!response.ok) {
    throw new Error(
      `Tavily search failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as TavilyResponse;

  const citations: GroundingCitation[] = (data.results ?? [])
    .filter((r) => r.url && r.content)
    .map((r) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.content.slice(0, 1200)
    }));

  return {
    query,
    summary: citations.map((c) => c.snippet).join(" "),
    citations,
    groundingAvailable: citations.length > 0
  };
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

function authorityScoreFor(scanner: GroundingScanner, url: string): number {
  const domain = extractDomain(url);
  if (!domain) return 0.6;

  const exact = scanner.authorityByDomain[domain];
  if (typeof exact === "number") return exact;

  for (const [key, score] of Object.entries(scanner.authorityByDomain)) {
    const keyDomain = key.split("/")[0];
    if (keyDomain && domain.endsWith(keyDomain)) return score;
  }

  return 0.6;
}

// -------------------------------------------------------------------------
// Main entry — runGroundingScan
// -------------------------------------------------------------------------

export async function runGroundingScan(
  scanner: GroundingScanner,
  input: ScannerRunInput,
  opts?: {
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
        adapter: "tavily_search",
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
    const search =
      opts?.search ??
      (async (p: string) => {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          throw new Error("TAVILY_API_KEY is not set — web search disabled");
        }
        return callTavilySearch(p, { apiKey });
      });

    const prompt = scanner.buildGroundingQuery(input);
    const searchResult = await search(prompt);

    let newSourceCount = 0;
    let queuedJobCount = 0;

    for (const citation of searchResult.citations) {
      if (!citation.url || !citation.snippet) continue;

      const { data: existing } = await supabase
        .from("trend_sources")
        .select("id")
        .eq("source_url", citation.url)
        .maybeSingle();

      if (existing) continue;

      const authorityScore = authorityScoreFor(scanner, citation.url);
      const sourceName = extractDomain(citation.url) || "tavily_search";

      const sourceInsert: TrendSourceInsert = {
        source_name: sourceName,
        source_type: "tavily_search",
        source_url: citation.url,
        title: citation.title,
        publish_date: null,
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
        if (sourceError.code === "23505") continue;
        throw new Error(
          `Failed to insert trend source: ${sourceError.message}`
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
            source_type: "tavily_search",
            scanner_archetype: scanner.archetype,
            scanner_targets: [...scanner.targetTrendTypes],
            authority_score: authorityScore,
            grounding_query: prompt,
            citation_url: citation.url
          }
        } satisfies Partial<TrendIngestionJobInsert>) as never);

      if (extractJobError) {
        throw new Error(
          `Failed to queue extraction job: ${extractJobError.message}`
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
          adapter: "tavily_search",
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
          adapter: "tavily_search",
          scanner_archetype: scanner.archetype,
          error: String(err)
        }
      } as never))
      .eq("id", jobId);
    throw err;
  }
}
