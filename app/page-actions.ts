"use server";

import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import { createGarmentSource } from "@/lib/domain/ingestion/service";
import { createDraftsFromPipelineResult } from "@/lib/domain/ingestion/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import { redirect } from "next/navigation";

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
    const { sourceId, storagePath } = await createGarmentSource({ file });

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

    await createDraftsFromPipelineResult({ sourceId, result });
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Upload and analysis failed.",
    };
  }

  // redirect() is outside try/catch so NEXT_REDIRECT propagates correctly.
  redirect("/wardrobe/review");
}
