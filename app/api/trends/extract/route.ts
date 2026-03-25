import { NextResponse } from "next/server";
import { createServiceClient as createClient } from "@/lib/supabase/service";
import { processExtractionJob } from "@/lib/domain/trends/extraction";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 5;

export async function POST() {
  const supabase = createClient();

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
