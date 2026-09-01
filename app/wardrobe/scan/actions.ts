"use server";

import { getServerEnv } from "@/lib/env";
import { getRequiredUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createGarmentSource } from "@/lib/domain/ingestion/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import { canUseFeatureLabels } from "@/lib/domain/entitlements/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { unlockCountForCandidate } from "@/lib/domain/outfits/unlock";

export type ScanResult =
  | {
      status: "success";
      category: string;
      colour: string;
      unlockCount: number;
      verdict: "buy it" | "maybe" | "you already own this";
    }
  | { status: "error"; message: string };

/**
 * 8a — in-store scan. UnlockScore { subject: { kind: 'scanned' }, ... }.
 * Never enters the wardrobe: the pipeline is only asked "what is this and
 * would it unlock anything", then the upload is deleted — nothing is kept
 * unless the shopper later adds it the normal way (14a/14b, or a receipt).
 */
export async function scanGarmentAction(formData: FormData): Promise<ScanResult> {
  try {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return { status: "error", message: "Take or choose a photo first." };
    }

    if (!(await canUseFeatureLabels())) {
      return { status: "error", message: "In-store scan needs photo analysis, which isn't enabled." };
    }

    await getRequiredUser();
    const { sourceId, storagePath } = await createGarmentSource({ file });
    const supabase = await createClient();

    try {
      const { data: signedUrlData } = await supabase.storage
        .from("garment-originals")
        .createSignedUrl(storagePath, 5 * 60);

      if (!signedUrlData?.signedUrl) {
        return { status: "error", message: "Failed to prepare the photo for scanning." };
      }

      const result = await callPipelineService({
        serviceUrl: getServerEnv().PIPELINE_SERVICE_URL,
        imageUrl: signedUrlData.signedUrl
      });

      const detected = result.garments[0];
      if (!detected) {
        return { status: "error", message: "Couldn't make out a garment in that photo." };
      }

      const [garments, styleRules] = await Promise.all([listWardrobeGarments(), listStyleRules()]);
      const unlockCount = unlockCountForCandidate(garments, styleRules, {
        id: "scanned",
        title: detected.tag,
        category: detected.category,
        subcategory: null,
        primary_colour_family: detected.colour
      });

      const alreadyOwnsSimilar = garments.some(
        (garment) => garment.category === detected.category && garment.primary_colour_family === detected.colour
      );

      return {
        status: "success",
        category: detected.category,
        colour: detected.colour,
        unlockCount,
        verdict: alreadyOwnsSimilar ? "you already own this" : unlockCount > 0 ? "buy it" : "maybe"
      };
    } finally {
      // Scan only — never enters the wardrobe, so nothing is kept.
      await supabase.storage.from("garment-originals").remove([storagePath]);
      await supabase.from("garment_sources").delete().eq("id", sourceId);
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to scan that photo."
    };
  }
}
