import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { createGarment } from "@/lib/domain/wardrobe/service";
import { getCanonicalWardrobeColour } from "@/lib/domain/wardrobe/colours";

export const dynamic = "force-dynamic";

const acceptDraftSchema = z.object({
  draft_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  colour: z.string().trim().max(100).optional(),
  brand: z.string().trim().max(120).optional(),
  material: z.string().trim().max(120).optional(),
  style: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional()
});

/**
 * Turns a garment_drafts row into a real garment for the native app's photo
 * capture flow. Ports only the "direct_upload" branch of
 * app/wardrobe/review/actions.ts's acceptDraftAction (that's the only source
 * type a phone camera capture produces) — not the product_url/receipt
 * branches, which don't apply here. Skips purchase-price/retailer fields
 * (mobile capture is "add what I'm wearing," not receipt-driven) — a
 * documented gap, not an oversight.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };

    const rawInput = await request.json();
    const parsed = acceptDraftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const values = parsed.data;

    const { data: draft, error: draftError } = await supabase
      .from("garment_drafts")
      .select("id, source_id, draft_payload_json, status, garment_sources(storage_path, source_type, source_metadata_json)")
      .eq("id", values.draft_id)
      .eq("user_id", user.id)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }
    if ((draft as { status: string }).status !== "pending") {
      return NextResponse.json({ error: "This draft was already actioned." }, { status: 409 });
    }

    const source = (draft as {
      garment_sources?: { storage_path: string | null; source_type: string; source_metadata_json: Record<string, unknown> | null } | null;
    }).garment_sources;
    const p = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;

    const colour = values.colour?.trim() || (p.colour ? String(p.colour) : null);
    const canonicalColour = getCanonicalWardrobeColour(colour);

    const garment = await createGarment(
      {
        category: values.category,
        title: values.title,
        brand: values.brand?.trim() || (p.brand ? String(p.brand) : undefined),
        material: values.material?.trim() || (p.material ? String(p.material) : undefined),
        description: values.notes?.trim() || undefined,
        extraction_metadata_json: {
          draft_source: p.source_type ?? "direct_upload",
          draft_style: values.style?.trim() || p.style || null,
          draft_colour: colour,
          source_id: (draft as { source_id?: string | null }).source_id ?? null
        }
      },
      { primaryColourFamily: canonicalColour ? canonicalColour.family : null },
      ctx
    );

    if (Array.isArray(p.embedding) && p.embedding.length > 0) {
      await supabase
        .from("garments")
        .update({ embedding: p.embedding } as never)
        .eq("id", garment.id as string)
        .eq("user_id", user.id);
    }

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
      await supabase.from("garment_images").insert({
        garment_id: garment.id,
        image_type: "cropped",
        storage_path: cropPath,
        width: typeof p.crop_width === "number" ? p.crop_width : null,
        height: typeof p.crop_height === "number" ? p.crop_height : null
      } as never);
    } else if (source?.source_type === "direct_upload" && source.storage_path) {
      await supabase.from("garment_images").insert({
        garment_id: garment.id,
        image_type: "original",
        storage_path: source.storage_path,
        width: typeof source.source_metadata_json?.width === "number" ? source.source_metadata_json.width : null,
        height: typeof source.source_metadata_json?.height === "number" ? source.source_metadata_json.height : null
      } as never);
    }

    await supabase
      .from("garment_drafts")
      .update({ status: "confirmed" } as never)
      .eq("id", values.draft_id)
      .eq("user_id", user.id);

    return NextResponse.json({ garment_id: garment.id });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save garment" },
      { status: 500 }
    );
  }
}
