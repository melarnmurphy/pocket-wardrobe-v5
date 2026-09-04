import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { saveOutfitInputSchema } from "@/lib/domain/outfits";
import { saveOutfit } from "@/lib/domain/outfits/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rawInput = await request.json();
    const parsed = saveOutfitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const outfitId = await saveOutfit(parsed.data, { supabase, userId: user.id });
    return NextResponse.json({ outfit_id: outfitId });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save outfit" },
      { status: 500 }
    );
  }
}
