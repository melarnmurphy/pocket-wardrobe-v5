import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { listSavedOutfits } from "@/lib/domain/outfits/service";

export const dynamic = "force-dynamic";

// "Times worn" / "last worn" per outfit isn't tracked anywhere yet (web's own
// outfit gallery doesn't show it either — see the comment on listSavedOutfits) —
// wear_events does have a nullable outfit_id, so this aggregates it here rather
// than inventing a number.
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };
    const outfits = await listSavedOutfits(ctx);

    const outfitIds = outfits.map((o) => o.id);
    const wearStatsByOutfitId = new Map<string, { timesWorn: number; lastWornAt: string | null }>();
    if (outfitIds.length > 0) {
      const { data: wearEvents, error: wearError } = await supabase
        .from("wear_events")
        .select("outfit_id,worn_at")
        .eq("user_id", user.id)
        .in("outfit_id", outfitIds);
      if (wearError) throw new Error(wearError.message);

      for (const row of (wearEvents ?? []) as Array<{ outfit_id: string | null; worn_at: string }>) {
        if (!row.outfit_id) continue;
        const existing = wearStatsByOutfitId.get(row.outfit_id) ?? { timesWorn: 0, lastWornAt: null };
        existing.timesWorn += 1;
        if (!existing.lastWornAt || row.worn_at > existing.lastWornAt) {
          existing.lastWornAt = row.worn_at;
        }
        wearStatsByOutfitId.set(row.outfit_id, existing);
      }
    }

    const outfitsWithWear = outfits.map((outfit) => ({
      ...outfit,
      times_worn: wearStatsByOutfitId.get(outfit.id)?.timesWorn ?? 0,
      last_worn_at: wearStatsByOutfitId.get(outfit.id)?.lastWornAt ?? null
    }));

    return NextResponse.json({ outfits: outfitsWithWear });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load saved outfits" },
      { status: 500 }
    );
  }
}
