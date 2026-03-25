import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import type { PipelineAnalyzeResponse } from "./index";
import type { TablesInsert } from "@/types/database";

type GarmentDraftInsert = TablesInsert<"garment_drafts">;
type GarmentSourceInsert = TablesInsert<"garment_sources">;

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
  created_at: string;
  source_created_at: string | null;
  confidence: number | null;
  preview_url: string | null;
  preview_kind: "image" | "document" | null;
  source_image_width: number | null;
  source_image_height: number | null;
  payload: {
    title: string;
    category: string;
    colour: string;
    bbox: [number, number, number, number] | null;
    brand: string | null;
    material: string | null;
    style: string;
    tag: string;
    confidence: number;
    source_type: string;
    source_label: string | null;
    notes: string | null;
    retailer: string | null;
    purchase_price: number | null;
    purchase_currency: string | null;
    extraction_source: string | null;
  };
}

export async function createGarmentSource(params: {
  file: File;
  width?: number;
  height?: number;
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
        width: params.width ?? null,
        height: params.height ?? null,
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

export async function createReceiptSource(params: {
  file: File;
  width?: number;
  height?: number;
}): Promise<{ sourceId: string; storagePath: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const safeFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/receipt-uploads/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("receipt-uploads")
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const payload: GarmentSourceInsert = {
    user_id: user.id,
    garment_id: null,
    source_type: "receipt",
    storage_path: storagePath,
    parse_status: "requires_review",
    source_metadata_json: {
      filename: params.file.name,
      mime_type: params.file.type || null,
      width: params.width ?? null,
      height: params.height ?? null
    }
  };

  const { data, error } = await supabase
    .from("garment_sources")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from("receipt-uploads").remove([storagePath]);
    throw new Error(error.message);
  }

  return { sourceId: (data as { id: string }).id, storagePath };
}

export async function createProductUrlSource(params: {
  url: string;
}): Promise<{ sourceId: string }> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const url = new URL(params.url);

  const payload: GarmentSourceInsert = {
    user_id: user.id,
    garment_id: null,
    source_type: "product_url",
    original_url: url.toString(),
    parse_status: "requires_review",
    source_metadata_json: {
      hostname: url.hostname,
      pathname: url.pathname
    }
  };

  const { data, error } = await supabase
    .from("garment_sources")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { sourceId: (data as { id: string }).id };
}

export async function createManualReviewDraft(params: {
  sourceId: string;
  sourceType: "direct_upload" | "product_url" | "receipt";
  title?: string | null;
  category?: string | null;
  colour?: string | null;
  brand?: string | null;
  material?: string | null;
  style?: string | null;
  notes?: string | null;
  sourceLabel?: string | null;
  confidence?: number | null;
  retailer?: string | null;
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
  extractionSource?: string | null;
}): Promise<string> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const payload: GarmentDraftInsert = {
    user_id: user.id,
    source_id: params.sourceId,
    draft_payload_json: {
      title: params.title ?? null,
      category: params.category ?? "",
      colour: params.colour ?? "",
      brand: params.brand ?? null,
      material: params.material ?? null,
      style: params.style ?? "",
      tag: params.title ?? sourceFallbackTag(params.sourceType),
      confidence: params.confidence ?? 0.18,
      source_type: params.sourceType,
      source_label: params.sourceLabel ?? null,
      notes: params.notes ?? null,
      retailer: params.retailer ?? null,
      purchase_price: params.purchasePrice ?? null,
      purchase_currency: params.purchaseCurrency ?? null,
      extraction_source: params.extractionSource ?? null
    },
    confidence: params.confidence ?? 0.18,
    status: "pending"
  };

  const { data, error } = await supabase
    .from("garment_drafts")
    .insert(payload as never)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function createManualPhotoReviewDraft(params: {
  sourceId: string;
  fileName: string;
  notes?: string | null;
}): Promise<string> {
  const normalizedTitle = params.fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return createManualReviewDraft({
    sourceId: params.sourceId,
    sourceType: "direct_upload",
    title: normalizedTitle || "Photo upload",
    category: "",
    colour: "",
    sourceLabel: params.fileName,
    style: "manual photo entry",
    notes:
      params.notes ??
      "Uploaded without assisted feature labelling. Fill in the garment details manually.",
    confidence: 0.05,
    extractionSource: "manual entry"
  });
}

export async function listPendingDrafts(): Promise<PendingDraft[]> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: rawData, error } = await supabase
    .from("garment_drafts")
    .select(
      "id, source_id, created_at, confidence, draft_payload_json, garment_sources(storage_path, source_type, source_metadata_json, created_at)"
    )
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const data = (rawData ?? []) as Array<{
    id: string;
    source_id: string;
    created_at: string;
    confidence: number | null;
    draft_payload_json: Record<string, unknown>;
    garment_sources:
      | {
          storage_path: string | null;
          source_type: string;
          source_metadata_json: Record<string, unknown> | null;
          created_at: string | null;
        }
      | null;
  }>;

  const previewUrlsBySourceId = new Map<string, string | null>();
  const imageSourceIdsByBucket = new Map<string, string[]>();
  const imagePathBySourceId = new Map<string, string>();
  const previewKindBySourceId = new Map<string, "image" | "document" | null>();

  for (const row of data) {
    const source = row.garment_sources;
    const storagePath = source?.storage_path;
    const sourceType = source?.source_type;
    const mimeType =
      source?.source_metadata_json && typeof source.source_metadata_json.mime_type === "string"
        ? source.source_metadata_json.mime_type
        : null;

    if (!storagePath || !sourceType) {
      continue;
    }

    const bucket =
      sourceType === "direct_upload"
        ? "garment-originals"
        : sourceType === "receipt"
          ? "receipt-uploads"
          : null;

    if (!bucket) {
      continue;
    }

    if (mimeType?.startsWith("image/")) {
      const existing = imageSourceIdsByBucket.get(bucket) ?? [];
      existing.push(row.source_id);
      imageSourceIdsByBucket.set(bucket, existing);
      imagePathBySourceId.set(row.source_id, storagePath);
      previewKindBySourceId.set(row.source_id, "image");
    } else {
      previewKindBySourceId.set(row.source_id, "document");
    }
  }

  for (const [bucket, sourceIds] of imageSourceIdsByBucket.entries()) {
    const paths = sourceIds
      .map((sourceId) => imagePathBySourceId.get(sourceId))
      .filter((path): path is string => Boolean(path));

    if (!paths.length) {
      continue;
    }

    const { data: signedUrls, error: signedUrlsError } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 60 * 60);

    if (signedUrlsError) {
      throw new Error(signedUrlsError.message);
    }

    const signedUrlByPath = new Map<string, string | null>();

    for (const signedUrl of signedUrls) {
      if (signedUrl.path) {
        signedUrlByPath.set(signedUrl.path, signedUrl.signedUrl ?? null);
      }
    }

    for (const sourceId of sourceIds) {
      const path = imagePathBySourceId.get(sourceId);
      if (path) {
        previewUrlsBySourceId.set(sourceId, signedUrlByPath.get(path) ?? null);
      }
    }
  }

  return data.map((row) => {
    const p = row.draft_payload_json;
    return {
      id: row.id,
      sourceId: row.source_id,
      created_at: row.created_at,
      source_created_at: row.garment_sources?.created_at ?? null,
      confidence: row.confidence,
      preview_url: previewUrlsBySourceId.get(row.source_id) ?? null,
      preview_kind: previewKindBySourceId.get(row.source_id) ?? null,
      source_image_width:
        row.garment_sources?.source_metadata_json &&
        typeof row.garment_sources.source_metadata_json.width === "number"
          ? row.garment_sources.source_metadata_json.width
          : null,
      source_image_height:
        row.garment_sources?.source_metadata_json &&
        typeof row.garment_sources.source_metadata_json.height === "number"
          ? row.garment_sources.source_metadata_json.height
          : null,
      payload: {
        title: typeof p.title === "string" ? p.title : String(p.tag ?? ""),
        category: String(p.category ?? ""),
        colour: String(p.colour ?? ""),
        bbox:
          Array.isArray(p.bbox) &&
          p.bbox.length === 4 &&
          p.bbox.every((value) => typeof value === "number")
            ? (p.bbox as [number, number, number, number])
            : null,
        brand: typeof p.brand === "string" ? p.brand : null,
        material: p.material ? String(p.material) : null,
        style: String(p.style ?? ""),
        tag: String(p.tag ?? ""),
        confidence: Number(p.confidence ?? row.confidence ?? 0),
        source_type: typeof p.source_type === "string" ? p.source_type : "direct_upload",
        source_label: typeof p.source_label === "string" ? p.source_label : null,
        notes: typeof p.notes === "string" ? p.notes : null,
        retailer: typeof p.retailer === "string" ? p.retailer : null,
        purchase_price:
          typeof p.purchase_price === "number"
            ? p.purchase_price
            : typeof p.purchase_price === "string" && p.purchase_price.trim().length > 0
              ? Number(p.purchase_price)
              : null,
        purchase_currency:
          typeof p.purchase_currency === "string" ? p.purchase_currency : null,
        extraction_source:
          typeof p.extraction_source === "string" ? p.extraction_source : null
      },
    };
  });
}

function sourceFallbackTag(sourceType: "direct_upload" | "product_url" | "receipt") {
  if (sourceType === "direct_upload") {
    return "Photo upload draft";
  }

  return sourceType === "product_url" ? "Product link draft" : "Receipt draft";
}
