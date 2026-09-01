import { after, NextRequest, NextResponse } from "next/server";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { canUseFeatureLabels } from "@/lib/domain/entitlements/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import {
  createDraftsFromPipelineResult,
  createGarmentSource,
  createManualPhotoReviewDraft
} from "@/lib/domain/ingestion/service";
import { appendBatchProgress, completeBatch, createPhotoBatch } from "@/lib/domain/ingestion/batch";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTOS_PER_BATCH = 30;

/**
 * 14a → 14b batch add. Responds with a batchId immediately, then keeps
 * working through the photos via next/server's after() — the batch row
 * (processing_jobs) is the durable state, so the client can close the app
 * and find the work finished when it comes back, per BUILD_ORDER phase 3's
 * "done when": twenty photos become twenty reviewable drafts.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await getRequiredUser();

    const formData = await request.formData();
    const files = formData
      .getAll("photos")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!files.length) {
      return NextResponse.json({ error: "Choose at least one photo." }, { status: 400 });
    }

    if (files.length > MAX_PHOTOS_PER_BATCH) {
      return NextResponse.json(
        { error: `Batches are limited to ${MAX_PHOTOS_PER_BATCH} photos at a time.` },
        { status: 400 }
      );
    }

    const featureLabelsEnabled = await canUseFeatureLabels();
    const batchId = await createPhotoBatch(files.length);
    const pipelineServiceUrl = featureLabelsEnabled ? getServerEnv().PIPELINE_SERVICE_URL : null;

    after(async () => {
      for (const file of files) {
        try {
          const { sourceId, storagePath } = await createGarmentSource({ file });

          if (!pipelineServiceUrl) {
            const draftId = await createManualPhotoReviewDraft({ sourceId, fileName: file.name });
            await appendBatchProgress(batchId, [draftId]);
            continue;
          }

          const supabase = await createClient();
          const { data: signedUrlData } = await supabase.storage
            .from("garment-originals")
            .createSignedUrl(storagePath, 5 * 60);

          if (!signedUrlData?.signedUrl) {
            await appendBatchProgress(batchId, []);
            continue;
          }

          const result = await callPipelineService({
            serviceUrl: pipelineServiceUrl,
            imageUrl: signedUrlData.signedUrl
          });

          const draftIds = await createDraftsFromPipelineResult({
            sourceId,
            storagePath,
            result
          });

          await appendBatchProgress(batchId, draftIds);
        } catch {
          // One bad photo shouldn't sink the batch — count it as done with
          // no draft, the reviewer sees the shortfall against total_count.
          await appendBatchProgress(batchId, []);
        }
      }

      await completeBatch(batchId);
    });

    return NextResponse.json({ batchId, totalCount: files.length });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unable to start the batch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
