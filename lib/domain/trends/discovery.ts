import { createServiceClient as createClient } from "@/lib/supabase/service";
import type { TablesInsert } from "@/types/database";
import type {
  GroundingScanner,
  ScannerRunInput
} from "./prompts/grounding-prompts";
import type {
  TrendDiscoveryAdapter,
  TrendDiscoveryResult
} from "./adapters/searxng-search";
import { extractArticleContent } from "./extractors/article-content";

type TrendSourceInsert = TablesInsert<"trend_sources">;
type TrendIngestionJobInsert = TablesInsert<"trend_ingestion_jobs">;

export interface TrendDiscoveryScanResult {
  scannerArchetype: string;
  citationCount: number;
  newSourceCount: number;
  queuedJobCount: number;
  groundingAvailable: boolean;
}

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

export async function runTrendDiscoveryScan(
  scanner: GroundingScanner,
  input: ScannerRunInput,
  opts: {
    adapter: TrendDiscoveryAdapter;
    search?: (prompt: string) => Promise<TrendDiscoveryResult>;
  }
): Promise<TrendDiscoveryScanResult> {
  const supabase = createClient();
  const adapter = opts.adapter;

  const { data: jobData, error: jobError } = await supabase
    .from("trend_ingestion_jobs")
    .insert(({
      job_type: "source_ingestion",
      status: "running",
      metadata_json: {
        adapter: adapter.sourceName,
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
    throw new Error(`Failed to create discovery job: ${jobError.message}`);
  }
  const jobId = (jobData as { id: string }).id;

  try {
    const prompt = scanner.buildGroundingQuery(input);
    const searchResult = await (opts.search ?? adapter.search)(prompt);

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
      const sourceName = extractDomain(citation.url) || adapter.sourceName;
      const extractedContent = await extractArticleContent(citation.url);

      const sourceInsert: TrendSourceInsert = {
        source_name: sourceName,
        source_type: adapter.sourceType,
        source_url: citation.url,
        title: extractedContent?.title || citation.title,
        publish_date: extractedContent?.publishedDate ?? citation.publishedDate ?? null,
        author: extractedContent?.author ?? null,
        region: input.region ?? null,
        season: input.season ?? null,
        raw_text_excerpt: extractedContent?.text || citation.snippet,
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
            source_type: adapter.sourceType,
            scanner_archetype: scanner.archetype,
            scanner_targets: [...scanner.targetTrendTypes],
            authority_score: authorityScore,
            grounding_query: prompt,
            citation_url: citation.url,
            discovery_adapter: adapter.sourceName,
            discovery_engine: citation.engine ?? null,
            discovery_score: citation.score ?? null,
            content_extractor: extractedContent?.extractor ?? "search_snippet"
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
          adapter: adapter.sourceName,
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
          adapter: adapter.sourceName,
          scanner_archetype: scanner.archetype,
          error: String(err)
        }
      } as never))
      .eq("id", jobId);
    throw err;
  }
}
