import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import { createGarmentSource, createGarmentSourceFromStorage } from "@/lib/domain/ingestion/service";
import {
  appendBatchFailure,
  createPhotoBatch,
  enqueuePhotoBatchItem,
  finishBatchIfReady
} from "@/lib/domain/ingestion/batch";
import { userFacingError } from "@/lib/ui/user-facing-error";
import { logger } from "@/lib/observability/logger";

const MAX_PHOTOS_PER_BATCH = 100;
const directUploadSchema = z.object({
  uploads: z.array(z.object({
    storagePath: z.string().min(1),
    fileName: z.string().min(1).max(255),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    size: z.number().int().positive().max(20 * 1024 * 1024),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
  })).min(1).max(MAX_PHOTOS_PER_BATCH)
});
type DirectUpload = z.infer<typeof directUploadSchema>["uploads"][number];
type BatchUpload = DirectUpload | { file: File };

/**
 * 14a → 14b batch add. Uploads are persisted first, then each photo is
 * represented by a durable processing job. A worker owns analysis so the
 * request lifecycle is never responsible for completing the batch.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getRequiredUser();
    const contentType = request.headers.get("content-type") ?? "";
    const directUploads = contentType.includes("application/json");
    const uploads: BatchUpload[] = directUploads
      ? directUploadSchema.parse(await request.json()).uploads
      : (await request.formData()).getAll("photos")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0)
        .map((file) => ({ file }));

    if (!uploads.length) {
      return NextResponse.json({ error: "Choose at least one photo." }, { status: 400 });
    }

    if (uploads.length > MAX_PHOTOS_PER_BATCH) {
      return NextResponse.json(
        { error: `Batches are limited to ${MAX_PHOTOS_PER_BATCH} photos at a time.` },
        { status: 400 }
      );
    }

    const batchId = await createPhotoBatch(uploads.length);

    await Promise.all(uploads.map(async (upload) => {
      try {
        if ("storagePath" in upload) {
            if (!upload.storagePath.startsWith(`${user.id}/pipeline-uploads/`)) {
              throw new Error("This photo upload does not belong to the signed-in user.");
            }
            const source = await createGarmentSourceFromStorage({ userId: user.id, ...upload });
            await enqueuePhotoBatchItem({
              batchId,
              sourceId: source.sourceId,
              storagePath: upload.storagePath,
              fileName: upload.fileName,
              userId: user.id
            });
            return;
        }

        const source = await createGarmentSource({ file: upload.file });
        await enqueuePhotoBatchItem({
          batchId,
          sourceId: source.sourceId,
          storagePath: source.storagePath,
          fileName: upload.file.name,
          userId: user.id
        });
      } catch (error) {
        await appendBatchFailure(
          batchId,
          `${"storagePath" in upload ? upload.fileName : upload.file.name} could not be uploaded. Try it again.`
        );
        logger.error("photo_batch_queue_failed", error, { fileName: "storagePath" in upload ? upload.fileName : upload.file.name });
      }
    }));

    await finishBatchIfReady(batchId);

    return NextResponse.json({ batchId, totalCount: uploads.length });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const message = userFacingError(error, "we couldn't start those photos. check your connection and try again.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
