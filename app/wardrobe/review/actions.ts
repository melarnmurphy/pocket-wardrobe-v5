"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createGarment } from "@/lib/domain/wardrobe/service";
import { getCanonicalWardrobeColour } from "@/lib/domain/wardrobe/colours";
import { z } from "zod";

export type DraftActionResult =
  | { status: "success"; garmentId?: string }
  | { status: "error"; message: string };

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
  try {
    const draftId = typeof input === "string" ? input : input.draftId;
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, source_id, draft_payload_json, status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) return { status: "error", message: "Draft not found." };

    // Stale page guard: already actioned
    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const p = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
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

    const garment = await createGarment(
      {
        category: values.category,
        title: values.title,
        brand,
        material: values.material?.trim() || (p.material ? String(p.material) : undefined),
        description: values.notes?.trim() || undefined,
        retailer,
        purchase_price: Number.isFinite(purchasePrice) ? purchasePrice : undefined,
        purchase_currency: purchaseCurrency || undefined,
        extraction_metadata_json: {
          draft_source: p.source_type ?? "direct_upload",
          draft_style: values.style?.trim() || p.style || null,
          draft_colour: colour,
          draft_brand: brand ?? null,
          draft_retailer: retailer ?? null
        }
      },
      { primaryColourFamily: canonicalColour ? canonicalColour.family : null }
    );

    const sourceId = (draft as { source_id?: string | null }).source_id;
    if (sourceId) {
      await supabase
        .from("garment_sources")
        .update({ garment_id: garment.id } as never)
        .eq("id", sourceId)
        .eq("user_id", user.id);
    }

    const cropPath = typeof p.crop_path === "string" && p.crop_path ? p.crop_path : null;
    if (cropPath) {
      await supabase
        .from("garment_images")
        .insert({
          garment_id: garment.id,
          image_type: "cropped",
          storage_path: cropPath,
          width: typeof p.crop_width === "number" ? p.crop_width : null,
          height: typeof p.crop_height === "number" ? p.crop_height : null,
        } as never);
    }

    const { error: updateError } = await supabase
      .from("garment_drafts")
      .update({
        status: "confirmed",
        draft_payload_json: {
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
        }
      } as never) // supabase generated types are overly strict here
      .eq("id", values.draftId)
      .eq("user_id", user.id);

    if (updateError) {
      return {
        status: "error",
        message: "Garment created but draft could not be confirmed.",
      };
    }

    revalidatePath("/wardrobe");
    revalidatePath("/wardrobe/review");
    revalidatePath("/");

    return { status: "success", garmentId: garment.id as string };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to accept draft.",
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
      message: error instanceof Error ? error.message : "Failed to reject draft.",
    };
  }
}
