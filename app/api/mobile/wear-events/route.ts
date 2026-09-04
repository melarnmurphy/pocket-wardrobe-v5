import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { logWearEvent } from "@/lib/domain/wear-events/service";

export const dynamic = "force-dynamic";

const logWearEventsInputSchema = z.object({
  garment_ids: z.array(z.string().uuid()).min(1).max(20),
  worn_at: z.string().trim().min(1).optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

// The Diary's "what you wore" log has no single-outfit concept the way the
// Planner does (it's a multi-piece pick, not necessarily a saved outfit), so
// this logs one wear_events row per selected garment rather than requiring
// an outfit_id — garments.wear_count/last_worn_at/cost_per_wear all update
// via the existing sync_garment_wear_stats_from_events() trigger regardless.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rawInput = await request.json();
    const parsed = logWearEventsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const ctx = { supabase, userId: user.id };
    const logged = await Promise.all(
      parsed.data.garment_ids.map((garment_id) =>
        logWearEvent(
          {
            garment_id,
            worn_at: parsed.data.worn_at,
            occasion: parsed.data.occasion,
            notes: parsed.data.notes
          },
          ctx
        )
      )
    );

    return NextResponse.json({ logged: logged.length });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to log wear" },
      { status: 500 }
    );
  }
}
