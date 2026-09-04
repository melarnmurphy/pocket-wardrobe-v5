import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { listUserTrendMatchesWithSignals } from "@/lib/domain/outfits/service";
import { getUserTrendMatches } from "@/lib/domain/trends/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const ctx = { supabase, userId: user.id };
    // Mobile has no equivalent of app/trends/actions.ts's server action, which
    // is what triggers the web's staleness-gated match recompute — without
    // this call, a mobile-only user would never get a user_trend_matches row
    // for signals discovered since their last recompute.
    await getUserTrendMatches(user.id, ctx, user);
    const matches = await listUserTrendMatchesWithSignals(ctx);
    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load trends" },
      { status: 500 }
    );
  }
}
