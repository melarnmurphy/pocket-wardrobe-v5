"use server";

import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { createGarment } from "@/lib/domain/wardrobe/service";
import { getCanonicalWardrobeColour } from "@/lib/domain/wardrobe/colours";

export type DraftActionResult =
  | { status: "success"; garmentId?: string }
  | { status: "error"; message: string };

export async function acceptDraftAction(draftId: string): Promise<DraftActionResult> {
  try {
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, draft_payload_json, status")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) return { status: "error", message: "Draft not found." };

    // Stale page guard: already actioned
    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const p = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
    const colour = p.colour ? String(p.colour) : null;
    const canonicalColour = getCanonicalWardrobeColour(colour);

    const garment = await createGarment(
      {
        category: String(p.category ?? ""),
        title: String(p.tag ?? ""),
        material: p.material ? String(p.material) : undefined,
      },
      { primaryColourFamily: canonicalColour ? canonicalColour.family : null }
    );

    const { error: updateError } = await supabase
      .from("garment_drafts")
      .update({ status: "confirmed" } as never) // supabase generated types are overly strict here
      .eq("id", draftId)
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

    const { error: updateError } = await supabase
      .from("garment_drafts")
      .update({ status: "rejected" } as never) // supabase generated types are overly strict here
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
