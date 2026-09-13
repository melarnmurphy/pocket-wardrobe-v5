"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  addGarmentImageFromUrl,
  acceptGarmentDraftTransaction,
  setGarmentPrimaryColourFamily,
  setGarmentPriceManually
} from "@/lib/domain/wardrobe/service";
import { getCanonicalWardrobeColour } from "@/lib/domain/wardrobe/colours";
import { z } from "zod";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { categoryToRole, evaluateOutfitComposition } from "@/lib/domain/outfits/generator";
import { saveOutfit } from "@/lib/domain/outfits/service";
import { userFacingError } from "@/lib/ui/user-facing-error";

const RECEIPT_LIKE_SOURCE_TYPES = new Set([
  "receipt",
  "forwarded_email",
  "read_email",
  "docket_photo",
  "pdf",
  "screenshot"
]);

export type DraftActionResult =
  | { status: "success"; garmentId?: string }
  | { status: "error"; message: string };

const saveImportedOutfitSchema = z.object({
  garmentIds: z.array(z.string().uuid()).min(2).max(20),
  sourceId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).default("Imported look")
});

export async function saveImportedOutfitAction(
  input: unknown
): Promise<{ status: "success"; outfitId: string; firedRuleCount: number } | { status: "error"; message: string }> {
  try {
    const values = saveImportedOutfitSchema.parse(input);
    const garments = (await listWardrobeGarments()).filter((garment) =>
      values.garmentIds.includes(garment.id as string)
    );
    if (garments.length !== values.garmentIds.length) {
      return { status: "error", message: "Some accepted garments could not be found." };
    }

    let provenance: Record<string, unknown> = {};
    if (values.sourceId) {
      const supabase = await createClient();
      const { data: source, error: sourceError } = await supabase
        .from("garment_sources")
        .select("id, source_type, storage_path, source_metadata_json")
        .eq("id", values.sourceId)
        .eq("user_id", (await getRequiredUser()).id)
        .maybeSingle();
      if (sourceError) throw new Error(sourceError.message);
      const sourceRecord = source as {
        id: string;
        source_type: string;
        storage_path: string | null;
        source_metadata_json: Record<string, unknown> | null;
      } | null;
      if (sourceRecord) {
        provenance = {
          source_id: sourceRecord.id,
          source_type: sourceRecord.source_type,
          storage_path: sourceRecord.storage_path,
          source_metadata: sourceRecord.source_metadata_json
        };
      }
    }

    const styleRules = await listStyleRules();
    const evaluation = evaluateOutfitComposition({ garments, styleRules });
    const outfitId = await saveOutfit({
      title: values.title,
      source_type: "imported",
      weather_context_json: {},
      explanation: "Imported from an outfit image.",
      explanation_json: {
        provenance,
        fired_rules: evaluation.firedRules,
        insights: evaluation.insights
      },
      garments: garments.map((garment) => ({
        garment_id: garment.id as string,
        role: categoryToRole(garment.category, garment.subcategory, garment.title)
      }))
    });

    revalidatePath("/outfits");
    revalidatePath("/wardrobe/review");
    return { status: "success", outfitId, firedRuleCount: evaluation.firedRules.length };
  } catch (error) {
    return { status: "error", message: userFacingError(error, "we couldn't save that look. try again.") };
  }
}

const acceptDraftSchema = z.object({
  draftId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  colour: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(120).optional(),
  material: z.string().trim().max(120).optional(),
  style: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  retailer: z.string().trim().max(200).optional(),
  purchase_price: z.coerce.number().nonnegative().optional(),
  purchase_currency: z.string().trim().length(3).optional()
});

export async function acceptDraftAction(
  input:
    | string
    | {
        draftId: string;
        title: string;
        category: string;
        colour?: string;
        brand?: string;
        material?: string;
        style?: string;
        notes?: string;
        retailer?: string;
        purchase_price?: number;
        purchase_currency?: string;
      }
): Promise<DraftActionResult> {
  let createdSourceId: string | null = null;

  try {
    const draftId = typeof input === "string" ? input : input.draftId;
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, source_id, draft_payload_json, status, garment_sources(storage_path, source_type, source_metadata_json)")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) return { status: "error", message: "Draft not found." };

    // Stale page guard: already actioned
    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const source = (draft as {
      garment_sources?: {
        storage_path: string | null;
        source_type: string;
        source_metadata_json: Record<string, unknown> | null;
      } | null;
    }).garment_sources;
    createdSourceId = (draft as { source_id?: string | null }).source_id ?? null;
    const p = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
    const draftMetadata =
      p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
        ? (p.metadata as Record<string, unknown>)
        : {};
    const values = acceptDraftSchema.parse({
      draftId,
      title: typeof input === "string" ? String(p.title ?? p.tag ?? "") : input.title,
      category: typeof input === "string" ? String(p.category ?? "") : input.category,
      colour: typeof input === "string" ? String(p.colour ?? "") : input.colour,
      brand: typeof input === "string" ? String(p.brand ?? "") : input.brand,
      material: typeof input === "string" ? String(p.material ?? "") : input.material,
      style: typeof input === "string" ? String(p.style ?? "") : input.style,
      notes: typeof input === "string" ? String(p.notes ?? "") : input.notes,
      retailer: typeof input === "string" ? String(p.retailer ?? "") : input.retailer,
      purchase_price:
        typeof input === "string"
          ? p.purchase_price == null || p.purchase_price === ""
            ? undefined
            : Number(p.purchase_price)
          : input.purchase_price,
      purchase_currency:
        typeof input === "string"
          ? p.purchase_currency
            ? String(p.purchase_currency)
            : undefined
          : input.purchase_currency
    });
    const colour = values.colour?.trim() || (p.colour ? String(p.colour) : null);
    const canonicalColour = getCanonicalWardrobeColour(colour);
    const brand = values.brand?.trim() || (p.brand ? String(p.brand) : undefined);
    const retailer =
      values.retailer?.trim() || (p.retailer ? String(p.retailer) : undefined);
    const purchasePrice =
      values.purchase_price ??
      (p.purchase_price == null || p.purchase_price === ""
        ? undefined
        : Number(p.purchase_price));
    const purchaseCurrency =
      values.purchase_currency?.trim() ||
      (p.purchase_currency ? String(p.purchase_currency) : undefined);

    const sourceId = createdSourceId;
    if (!sourceId) throw new Error("Draft provenance is missing. Try uploading it again.");
    const sourceType = typeof p.source_type === "string" ? p.source_type : null;
    const priceSource = Number.isFinite(purchasePrice)
      ? sourceType && RECEIPT_LIKE_SOURCE_TYPES.has(sourceType)
        ? "receipt"
        : sourceType === "product_url" || sourceType === "website_image"
          ? "store"
          : "manual"
      : null;
    const updatedDraftPayload = {
      ...p,
      title: values.title,
      tag: values.title,
      category: values.category,
      colour,
      brand: brand ?? null,
      material: values.material?.trim() || null,
      style: values.style?.trim() || null,
      notes: values.notes?.trim() || null,
      retailer: retailer ?? null,
      purchase_price: Number.isFinite(purchasePrice) ? purchasePrice : null,
      purchase_currency: purchaseCurrency || null
    };
    const cropPath = typeof p.crop_path === "string" && p.crop_path ? p.crop_path : null;
    const imagePath = cropPath || (source?.source_type === "direct_upload" ? source.storage_path : null);
    const garmentId = await acceptGarmentDraftTransaction({
      userId: user.id,
      draftId: values.draftId,
      title: values.title,
      category: values.category,
      brand: brand ?? null,
      material: values.material?.trim() || (p.material ? String(p.material) : null),
      description: values.notes?.trim() || null,
      retailer: retailer ?? null,
      purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : null,
      purchaseCurrency: purchaseCurrency || null,
      priceSource,
      colourFamily: canonicalColour?.family ?? null,
      embedding: Array.isArray(p.embedding)
        ? p.embedding.filter((value): value is number => typeof value === "number")
        : null,
      extractionMetadata: {
        draft_source: typeof p.source_type === "string" ? p.source_type : "direct_upload",
        draft_style: values.style?.trim() || (typeof p.style === "string" ? p.style : null),
        draft_colour: colour,
        draft_brand: brand ?? null,
        draft_retailer: retailer ?? null,
        source_id: sourceId,
        ...draftMetadata
      },
      sourceId,
      imageType: cropPath ? "cropped" : imagePath ? "original" : null,
      imagePath,
      imageWidth: cropPath && typeof p.crop_width === "number"
        ? p.crop_width
        : source?.source_metadata_json && typeof source.source_metadata_json.width === "number"
          ? source.source_metadata_json.width
          : null,
      imageHeight: cropPath && typeof p.crop_height === "number"
        ? p.crop_height
        : source?.source_metadata_json && typeof source.source_metadata_json.height === "number"
          ? source.source_metadata_json.height
          : null,
      draftPayload: updatedDraftPayload
    });
    if (
      p.source_type === "product_url" &&
      typeof draftMetadata.extracted_image_url === "string" &&
      draftMetadata.extracted_image_url.length > 0
    ) {
      try {
        const uploadedImage = await addGarmentImageFromUrl({
          garmentId,
          imageUrl: draftMetadata.extracted_image_url,
          fileNameHint: values.title.replace(/\s+/g, "-").toLowerCase(),
          cropBox: null
        });

        if (!canonicalColour && uploadedImage.colourAnalysis.inferredFamily) {
          await setGarmentPrimaryColourFamily({
            garmentId,
            primaryColourFamily: uploadedImage.colourAnalysis.inferredFamily
          });
        }
      } catch {
        // Product images are useful provenance, but a failed remote fetch should
        // not block saving an already-reviewed garment.
      }
    }

    revalidatePath("/wardrobe");
    revalidatePath("/wardrobe/review");
    revalidatePath("/");

    return { status: "success", garmentId };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't add that piece yet. your draft is still safe to review."),
    };
  }
}

/**
 * MODALS.md §3 — the resolver for "this receipt matches three pieces".
 * `garmentId: null` means "none of these": fall through to the normal
 * accept-as-new path. Otherwise the draft's price moves onto the chosen
 * existing piece and the draft itself is discarded, since its other fields
 * would just duplicate a garment that already exists.
 */
export async function resolveReceiptMatchAction(
  draftId: string,
  garmentId: string | null
): Promise<DraftActionResult> {
  if (!garmentId) {
    return acceptDraftAction(draftId);
  }

  try {
    const parsedGarmentId = z.string().uuid().parse(garmentId);
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, status, draft_payload_json")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) {
      return { status: "error", message: "Draft not found." };
    }

    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const payload = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
    const priceRaw = payload.purchase_price;
    const price = priceRaw == null || priceRaw === "" ? null : Number(priceRaw);

    if (price === null || !Number.isFinite(price)) {
      return { status: "error", message: "This draft has no price to attach." };
    }

    const currency = typeof payload.purchase_currency === "string" ? payload.purchase_currency : "AUD";

    const { data: existingGarment, error: existingGarmentError } = await supabase
      .from("garments")
      .select("id, purchase_price, purchase_currency, price_source")
      .eq("id", parsedGarmentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingGarmentError) throw new Error(existingGarmentError.message);
    if (!existingGarment) return { status: "error", message: "That wardrobe piece is no longer available." };

    await setGarmentPriceManually({
      garmentId: parsedGarmentId,
      priceCents: Math.round(price * 100),
      currency,
      priceSource: "receipt"
    });

    const { error: rejectError } = await supabase
      .from("garment_drafts")
      .update({ status: "rejected" } as never)
      .eq("id", draftId)
      .eq("user_id", user.id);

    if (rejectError) {
      await supabase
        .from("garments")
        .update({
          purchase_price: (existingGarment as { purchase_price: number | null }).purchase_price,
          purchase_currency: (existingGarment as { purchase_currency: string | null }).purchase_currency,
          price_source: (existingGarment as { price_source: string | null }).price_source
        } as never)
        .eq("id", parsedGarmentId)
        .eq("user_id", user.id);
      return { status: "error", message: rejectError.message };
    }

    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${parsedGarmentId}`);
    revalidatePath("/wardrobe/review");

    return { status: "success", garmentId: parsedGarmentId };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't attach that price. the receipt is still waiting for review.")
    };
  }
}

export async function rejectDraftAction(draftId: string): Promise<DraftActionResult> {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error: fetchError } = await supabase
      .from("garment_drafts")
      .select("status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !draft) {
      return { status: "error", message: "Draft not found." };
    }

    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const { error: updateError } = await supabase
      .from("garment_drafts")
      .update({ status: "rejected" } as never)
      .eq("id", draftId)
      .eq("user_id", user.id);

    if (updateError) {
      return { status: "error", message: updateError.message };
    }

    revalidatePath("/");
    revalidatePath("/wardrobe/review");

    return { status: "success" };
  } catch (error) {
    return {
      status: "error",
      message: userFacingError(error, "we couldn't dismiss that draft. try again.")
    };
  }
}
