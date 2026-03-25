import { createServiceClient as createClient } from "@/lib/supabase/service";
import { fetchRSSEntries } from "./adapters/rss";
import type { TrendSourceAdapter } from "./adapters/rss";
import { fetchArticleContent } from "./content";
import type { TablesInsert } from "@/types/database";

type TrendSourceInsert = TablesInsert<"trend_sources">;
type TrendIngestionJobInsert = TablesInsert<"trend_ingestion_jobs">;

export async function runSourceIngestion(adapter: TrendSourceAdapter): Promise<{
  newSourceCount: number;
  queuedJobCount: number;
}> {
  const supabase = createClient();

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
    const relevantEntries = entries.filter(
      (entry) => adapter.shouldProcess?.(entry) ?? true
    );
    let newSourceCount = 0;
    let queuedJobCount = 0;

    for (const entry of relevantEntries) {
      if (!entry.link) continue;

      const { data: existing } = await supabase
        .from("trend_sources")
        .select("id")
        .eq("source_url", entry.link)
        .maybeSingle();

      if (existing) continue;

      const articleText = await fetchArticleContent(entry.link!);
      await new Promise((r) => setTimeout(r, 500)); // rate limit

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
        raw_text_excerpt: articleText || payload.raw_text_excerpt,
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
