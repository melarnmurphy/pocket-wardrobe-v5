import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { listUserTrendMatchesWithSignals } from "@/lib/domain/outfits/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const matches = await listUserTrendMatchesWithSignals({ supabase, userId: user.id });
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
