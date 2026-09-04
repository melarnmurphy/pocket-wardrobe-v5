import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { listStyleRules } from "@/lib/domain/style-rules/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rules = await listStyleRules({ supabase, userId: user.id });
    return NextResponse.json({ rules });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load style rules" },
      { status: 500 }
    );
  }
}
