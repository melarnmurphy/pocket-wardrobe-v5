import { createServiceClient } from "@/lib/supabase/service";
import { parseReceiptDraftCandidates } from "./extractors";
import { receiptAdapter } from "./adapters";
import type { Json, TablesInsert } from "@/types/database";

type GarmentSourceInsert = TablesInsert<"garment_sources">;
type GarmentDraftInsert = TablesInsert<"garment_drafts">;

/**
 * The webhook path (app/api/receipts/inbound) has no user session — it's a
 * trusted server-to-server call authenticated by a shared secret, so it uses
 * the service-role client with an explicit userId rather than the
 * cookie-derived one the rest of lib/domain/ingestion/service.ts relies on.
 */
export async function createForwardedEmailSourceAndDrafts(params: {
  userId: string;
  fromAddress: string;
  subject: string;
  text: string;
}): Promise<{ sourceId: string; draftIds: string[] }> {
  const supabase = createServiceClient();

  const sourcePayload: GarmentSourceInsert = {
    user_id: params.userId,
    garment_id: null,
    source_type: "forwarded_email",
    original_url: null,
    storage_path: null,
    raw_text: params.text,
    source_metadata_json: {
      from: params.fromAddress,
      subject: params.subject
    } as Json,
    parse_status: "processing",
    confidence: null
  };

  const { data: source, error: sourceError } = await supabase
    .from("garment_sources")
    .insert(sourcePayload as never)
    .select("id")
    .single();

  if (sourceError || !source) {
    throw new Error(sourceError?.message ?? "Unable to record the forwarded email.");
  }

  const sourceId = (source as { id: string }).id;

  const candidates = parseReceiptDraftCandidates({
    receiptText: params.text,
    fallbackTitle: params.subject || "forwarded order email"
  });

  const draftIds: string[] = [];

  for (const candidate of candidates) {
    const draftPayload = receiptAdapter.buildDraft({
      candidate,
      fileName: params.subject || "forwarded order email",
      notes: null,
      extractionSource: "forwarded email"
    });

    const draftInsert: GarmentDraftInsert = {
      user_id: params.userId,
      source_id: sourceId,
      draft_payload_json: {
        title: draftPayload.title,
        category: draftPayload.category ?? "",
        confidence: draftPayload.confidence,
        colour: draftPayload.colour ?? "",
        brand: draftPayload.brand,
        material: draftPayload.material,
        style: draftPayload.style ?? "",
        tag: draftPayload.tag ?? draftPayload.title ?? "forwarded order email",
        source_type: "forwarded_email",
        source_label: draftPayload.sourceLabel,
        notes: draftPayload.notes,
        retailer: draftPayload.retailer,
        purchase_price: draftPayload.purchasePrice,
        purchase_currency: draftPayload.purchaseCurrency,
        extraction_source: draftPayload.extractionSource,
        metadata: draftPayload.metadata as Json,
        field_confidence: draftPayload.fieldConfidence ?? null,
        field_provenance: draftPayload.fieldProvenance ?? null
      } as Json,
      confidence: draftPayload.confidence,
      status: "pending"
    };

    const { data: draft, error: draftError } = await supabase
      .from("garment_drafts")
      .insert(draftInsert as never)
      .select("id")
      .single();

    if (draftError || !draft) {
      continue;
    }

    draftIds.push((draft as { id: string }).id);
  }

  await supabase
    .from("garment_sources")
    .update({
      parse_status: draftIds.length > 0 ? "completed" : "requires_review"
    } as never)
    .eq("id", sourceId);

  return { sourceId, draftIds };
}

/** `u-<uuid>@...` → the target user, decoded with no lookup table needed. */
export function parseForwardingRecipient(toAddress: string): string | null {
  const localPart = toAddress.split("@")[0]?.trim();
  const match = localPart?.match(
    /^u-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  return match ? match[1] : null;
}
