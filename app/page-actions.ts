"use server";

import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { createGarmentSource } from "@/lib/domain/ingestion/service";
import { createDraftsFromPipelineResult } from "@/lib/domain/ingestion/service";
import { createManualPhotoReviewDraft } from "@/lib/domain/ingestion/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import { canUseFeatureLabels } from "@/lib/domain/entitlements/service";
import { redirect } from "next/navigation";
import { userFacingError } from "@/lib/ui/user-facing-error";

export type UploadActionResult =
  | { status: "success" }
  | { status: "error"; message: string };

// Called by the UploadCard client component.
// On success, redirect() navigates to /wardrobe/review.
// redirect() must be outside the try/catch so NEXT_REDIRECT is not swallowed.
export async function uploadAndAnalyseAction(
  formData: FormData
): Promise<UploadActionResult> {
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Select an image file to upload." };
  }

  try {
    const cutout = formData.get("cutout");
    const { sourceId, storagePath, cutoutStoragePath, cutoutWidth, cutoutHeight } =
      await createGarmentSource({
        file,
        cutoutFile: cutout instanceof File && cutout.size > 0 ? cutout : null
      });
    const featureLabelsEnabled = await canUseFeatureLabels();

    if (!featureLabelsEnabled) {
      await createManualPhotoReviewDraft({
        sourceId,
        fileName: file.name,
        cutoutStoragePath,
        cutoutWidth,
        cutoutHeight
      });
      redirect("/wardrobe/review");
    }

    const supabase = await createClient();
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(storagePath, 5 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return { status: "error", message: "Failed to prepare image for analysis." };
    }

    const env = getServerEnv();
    const result = await callPipelineService({
      serviceUrl: env.PIPELINE_SERVICE_URL,
      imageUrl: signedUrlData.signedUrl,
    });

    await createDraftsFromPipelineResult({
      sourceId,
      storagePath,
      result,
      cutoutStoragePath,
      cutoutWidth,
      cutoutHeight
    });
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't analyse that photo. try again."),
    };
  }

  // redirect() is outside try/catch so NEXT_REDIRECT propagates correctly.
  redirect("/wardrobe/review");
}
