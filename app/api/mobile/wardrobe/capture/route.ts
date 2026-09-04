import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { getServerEnv } from "@/lib/env";
import { assertFeatureLabelsAccess, FeatureAccessError } from "@/lib/domain/entitlements/service";
import { callPipelineService } from "@/lib/domain/ingestion/client";
import {
  createDraftsFromPipelineResult,
  createGarmentSource,
  createManualPhotoReviewDraft
} from "@/lib/domain/ingestion/service";

export const dynamic = "force-dynamic";

/**
 * One-photo capture for the native app: upload -> gated pipeline analysis ->
 * draft(s), returned inline so the client can show a review screen without a
 * second round-trip. Mirrors /api/pipeline/batch's per-photo logic (same
 * paid-plan gate via assertFeatureLabelsAccess, same manual-draft fallback
 * when it isn't entitled) but synchronous and single-file, since a phone
 * capture is one photo at a time rather than a 30-photo batch.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };

    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
    }

    const { sourceId, storagePath } = await createGarmentSource({ file }, ctx);

    let entitled = true;
    try {
      await assertFeatureLabelsAccess(ctx);
    } catch (error) {
      if (error instanceof FeatureAccessError) {
        entitled = false;
      } else {
        throw error;
      }
    }

    if (!entitled) {
      const draftId = await createManualPhotoReviewDraft({ sourceId, fileName: file.name }, ctx);
      const draft = await fetchDraft(supabase, draftId);
      return NextResponse.json({ drafts: draft ? [draft] : [] });
    }

    const { data: signedUrlData } = await supabase.storage
      .from("garment-originals")
      .createSignedUrl(storagePath, 5 * 60);

    if (!signedUrlData?.signedUrl) {
      return NextResponse.json({ error: "Failed to prepare the uploaded photo." }, { status: 500 });
    }

    const pipelineResult = await callPipelineService({
      serviceUrl: getServerEnv().PIPELINE_SERVICE_URL,
      imageUrl: signedUrlData.signedUrl
    });

    const draftIds = await createDraftsFromPipelineResult(
      { sourceId, storagePath, result: pipelineResult },
      ctx
    );

    if (draftIds.length === 0) {
      const draftId = await createManualPhotoReviewDraft({ sourceId, fileName: file.name }, ctx);
      const draft = await fetchDraft(supabase, draftId);
      return NextResponse.json({ drafts: draft ? [draft] : [] });
    }

    const drafts = (
      await Promise.all(draftIds.map((id) => fetchDraft(supabase, id)))
    ).filter((d): d is NonNullable<typeof d> => d !== null);

    return NextResponse.json({ drafts });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Capture failed" },
      { status: 500 }
    );
  }
}

async function fetchDraft(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  draftId: string
) {
  const { data } = await supabase
    .from("garment_drafts")
    .select("id, source_id, draft_payload_json, confidence")
    .eq("id", draftId)
    .single();
  return data ?? null;
}
