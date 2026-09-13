import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import {
  createDraftsFromPipelineResult,
  createManualPhotoReviewDraft
} from "@/lib/domain/ingestion/service";
import { canUseFeatureLabels } from "@/lib/domain/entitlements/service";
import type { ServiceContext } from "@/lib/domain/service-context";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type WorkerRpc = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

type PhotoJob = {
  id: string;
  user_id: string;
  target_id: string | null;
  input_payload_json: {
    batch_id?: string;
    source_id?: string;
    storage_path?: string;
    file_name?: string;
  };
};

function isAuthorized(request: NextRequest, secret: string | undefined) {
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  if (!isAuthorized(request, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createServiceClient();
  const rpc = supabase as unknown as WorkerRpc;
  const { data: claimed, error: claimError } = await rpc.rpc("claim_photo_batch_item");

  if (claimError) {
    logger.error("photo_job_claim_failed", claimError);
    return NextResponse.json({ error: "Unable to claim a photo job." }, { status: 500 });
  }

  const job = (Array.isArray(claimed) ? claimed[0] : claimed) as PhotoJob | null;
  if (!job) return NextResponse.json({ processed: 0 });

  const payload = job.input_payload_json ?? {};
  const sourceId = payload.source_id;
  const storagePath = payload.storage_path;
  const fileName = payload.file_name ?? "photo upload";
  const batchId = payload.batch_id ?? job.target_id;

  if (!sourceId || !storagePath || !batchId) {
    await rpc.rpc("finish_photo_batch_item", {
      p_item_id: job.id,
      p_draft_ids: [],
      p_error_message: "This photo job is missing its upload details."
    });
    return NextResponse.json({ processed: 1, status: "failed" });
  }

  try {
    const serviceContext = {
      userId: job.user_id,
      supabase: supabase as unknown as ServiceContext["supabase"]
    } satisfies ServiceContext;

    const useAutomaticLabels = await canUseFeatureLabels(serviceContext);
    let draftIds: string[];

    if (!useAutomaticLabels) {
      draftIds = [await createManualPhotoReviewDraft({
        sourceId,
        fileName,
        notes: "Automatic analysis is not enabled for this account. Review this piece manually."
      }, serviceContext)];
    } else {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("garment-originals")
        .createSignedUrl(storagePath, 5 * 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error("The uploaded photo could not be opened for analysis.");
      }

      const result = await callPipelineService({
        serviceUrl: env.PIPELINE_SERVICE_URL,
        imageUrl: signedUrlData.signedUrl
      });

      draftIds = result.garments.length > 0
        ? await createDraftsFromPipelineResult({ sourceId, storagePath, result }, serviceContext)
        : [await createManualPhotoReviewDraft({
            sourceId,
            fileName,
            notes: "The image was uploaded, but automatic detection found no garment. Review this piece manually."
          }, serviceContext)];
    }

    await rpc.rpc("finish_photo_batch_item", {
      p_item_id: job.id,
      p_draft_ids: draftIds,
      p_error_message: null
    });

    return NextResponse.json({ processed: 1, status: "succeeded", draftCount: draftIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo processing failed.";
    const { data: retried } = await rpc.rpc("retry_photo_batch_item", {
      p_item_id: job.id,
      p_error_message: message
    });

    logger.error("photo_job_failed", error, {
      jobId: job.id,
      batchId,
      retried: retried === true
    });

    return NextResponse.json({ processed: 1, status: retried === true ? "retrying" : "failed" });
  }
}
