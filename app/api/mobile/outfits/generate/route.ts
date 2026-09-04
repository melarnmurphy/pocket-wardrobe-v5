import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { generateOutfitInputSchema } from "@/lib/domain/outfits";
import { generateOutfitForUser } from "@/lib/domain/outfits/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rawInput = await request.json();
    const parsed = generateOutfitInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    // isPro is false for this iteration, matching app/outfits/actions.ts.
    const outfit = await generateOutfitForUser(parsed.data, false, { supabase, userId: user.id });
    if (outfit.garments.length < 2) {
      return NextResponse.json(
        { error: "Not enough matching garments in your wardrobe. Try a different dress code or add more items." },
        { status: 422 }
      );
    }

    return NextResponse.json({ outfit });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
