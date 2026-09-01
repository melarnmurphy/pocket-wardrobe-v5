import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import type { TablesInsert, TablesUpdate } from "@/types/database";

type ProcessingJobInsert = TablesInsert<"processing_jobs">;
type ProcessingJobUpdate = TablesUpdate<"processing_jobs">;

const batchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  done_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  draft_ids: z.array(z.string().uuid()),
  error_message: z.string().nullable().optional(),
  created_at: z.string()
});

export type PhotoBatch = z.infer<typeof batchSchema>;

/**
 * 14a → 14b: one row per batch, tracking progress so the work is found
 * finished even if the user closes the app mid-batch — see
 * app/api/pipeline/batch/route.ts, which processes photos after the
 * response is sent via next/server's after().
 */
export async function createPhotoBatch(totalCount: number): Promise<string> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const insert: ProcessingJobInsert = {
    user_id: user.id,
    job_type: "photo_batch",
    status: "running",
    total_count: totalCount,
    done_count: 0,
    draft_ids: []
  };

  const { data, error } = await supabase
    .from("processing_jobs")
    .insert(insert as never)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to start the batch.");
  }

  return (data as { id: string }).id;
}

/**
 * Called once per photo as the batch works through it, from inside after().
 * done_count tracks photos processed, not drafts created — one photo can
 * split into several drafts (garment-splitting), so draftIds is an array.
 */
export async function appendBatchProgress(batchId: string, draftIds: string[]) {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("processing_jobs")
    .select("done_count, draft_ids")
    .eq("id", batchId)
    .single();

  if (fetchError || !current) {
    return;
  }

  const row = current as { done_count: number; draft_ids: string[] };
  const update: ProcessingJobUpdate = {
    done_count: row.done_count + 1,
    draft_ids: [...row.draft_ids, ...draftIds]
  };

  await supabase.from("processing_jobs").update(update as never).eq("id", batchId);
}

export async function completeBatch(batchId: string, errorMessage?: string) {
  const supabase = await createClient();
  const update: ProcessingJobUpdate = {
    status: errorMessage ? "failed" : "succeeded",
    error_message: errorMessage ?? null
  };

  await supabase.from("processing_jobs").update(update as never).eq("id", batchId);
}

export async function getPhotoBatch(batchId: string): Promise<PhotoBatch | null> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(batchId);

  const { data, error } = await supabase
    .from("processing_jobs")
    .select("id,status,done_count,total_count,draft_ids,error_message,created_at")
    .eq("id", parsedId)
    .eq("user_id", user.id)
    .eq("job_type", "photo_batch")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return batchSchema.parse(data);
}

/** For a "finish your batch" resume prompt on the wardrobe page. */
export async function listUnfinishedPhotoBatches(): Promise<PhotoBatch[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("processing_jobs")
    .select("id,status,done_count,total_count,draft_ids,error_message,created_at")
    .eq("user_id", user.id)
    .eq("job_type", "photo_batch")
    .in("status", ["running", "succeeded"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (error || !data) {
    return [];
  }

  const batches = z.array(batchSchema).parse(data);

  // "Unfinished" beyond the job's own status: succeeded batches whose drafts
  // still have a pending one somewhere are still mid-review.
  return batches;
}
