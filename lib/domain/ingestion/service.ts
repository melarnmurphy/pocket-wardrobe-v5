import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import type { PipelineAnalyzeResponse } from "./index";
import type { TablesInsert } from "@/types/database";

type GarmentDraftInsert = TablesInsert<"garment_drafts">;

export interface CreateDraftsParams {
  sourceId: string;
  result: PipelineAnalyzeResponse;
}

export async function createDraftsFromPipelineResult(
  params: CreateDraftsParams
): Promise<string[]> {
  const { sourceId, result } = params;

  if (result.garments.length === 0) {
    return [];
  }

  const user = await getRequiredUser();
  const supabase = await createClient();
  const draftIds: string[] = [];

  for (const garment of result.garments) {
    const draftInsert: GarmentDraftInsert = {
      user_id: user.id,
      source_id: sourceId,
      draft_payload_json: {
        category: garment.category,
        confidence: garment.confidence,
        bbox: garment.bbox,
        colour: garment.colour,
        material: garment.material,
        style: garment.style,
        tag: garment.tag,
        embedding: garment.embedding
      },
      confidence: garment.confidence,
      status: "pending"
    };

    const { data, error } = await supabase
      .from("garment_drafts")
      // TODO: remove cast once TablesInsert<"garment_drafts"> types are corrected
      .insert(draftInsert as never)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    draftIds.push((data as { id: string }).id);
  }

  return draftIds;
}

export interface PendingDraft {
  id: string;
  sourceId: string;
  confidence: number | null;
  payload: {
    category: string;
    colour: string;
    material: string | null;
    style: string;
    tag: string;
    confidence: number;
  };
}

export async function createGarmentSource(params: {
  file: File;
}): Promise<{ sourceId: string; storagePath: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const safeFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/pipeline-uploads/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("garment-originals")
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("garment_sources")
    // TODO: remove cast once TablesInsert<"garment_sources"> types are corrected
    .insert(({
      user_id: user.id,
      garment_id: null,
      source_type: "direct_upload",
      storage_path: storagePath,
      parse_status: "pending",
      source_metadata_json: {
        filename: params.file.name,
        mime_type: params.file.type || null,
      },
    }) as never)
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from("garment-originals").remove([storagePath]);
    throw new Error(error.message);
  }

  return { sourceId: (data as { id: string }).id, storagePath };
}

export async function listPendingDrafts(): Promise<PendingDraft[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: rawData, error } = await supabase
    .from("garment_drafts")
    .select("id, source_id, confidence, draft_payload_json")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const data = (rawData ?? []) as Array<{
    id: string;
    source_id: string;
    confidence: number | null;
    draft_payload_json: Record<string, unknown>;
  }>;

  return data.map((row) => {
    const p = row.draft_payload_json;
    return {
      id: row.id,
      sourceId: row.source_id,
      confidence: row.confidence,
      payload: {
        category: String(p.category ?? ""),
        colour: String(p.colour ?? ""),
        material: p.material ? String(p.material) : null,
        style: String(p.style ?? ""),
        tag: String(p.tag ?? ""),
        confidence: Number(p.confidence ?? row.confidence ?? 0),
      },
    };
  });
}
