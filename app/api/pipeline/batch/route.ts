import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import { createGarmentSource } from "@/lib/domain/ingestion/service";
import {
  appendBatchFailure,
  createPhotoBatch,
  enqueuePhotoBatchItem,
  finishBatchIfReady
} from "@/lib/domain/ingestion/batch";
import { userFacingError } from "@/lib/ui/user-facing-error";
import { logger } from "@/lib/observability/logger";

const MAX_PHOTOS_PER_BATCH = 30;

/**
 * 14a → 14b batch add. Uploads are persisted first, then each photo is
 * represented by a durable processing job. A worker owns analysis so the
 * request lifecycle is never responsible for completing the batch.
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

    const user = await getRequiredUser();
    const batchId = await createPhotoBatch(files.length);

    for (const file of files) {
      try {
        const source = await createGarmentSource({ file });
        await enqueuePhotoBatchItem({
          batchId,
          sourceId: source.sourceId,
          storagePath: source.storagePath,
          fileName: file.name,
          userId: user.id
        });
      } catch (error) {
        await appendBatchFailure(
          batchId,
          `${file.name} could not be uploaded. Try it again.`
        );
        logger.error("photo_batch_queue_failed", error, { fileName: file.name });
      }
    }

    await finishBatchIfReady(batchId);

    return NextResponse.json({ batchId, totalCount: files.length });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const message = userFacingError(error, "we couldn't start those photos. check your connection and try again.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
