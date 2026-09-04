import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { generateWeekOfOutfits } from "@/lib/domain/outfits/service";

export const dynamic = "force-dynamic";

const generateWeekInputSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        occasion: z.string().trim().max(120).nullable().optional(),
        dress_code: z.string().trim().max(120).nullable().optional()
      })
    )
    .min(1)
    .max(7)
});

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rawInput = await request.json();
    const parsed = generateWeekInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    // isPro is false for this iteration, matching the single-outfit route.
    const week = await generateWeekOfOutfits(parsed.data.days, false, { supabase, userId: user.id });
    return NextResponse.json({ week: week.days, unavailable_garment_ids: week.unavailableGarmentIds });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Week generation failed" },
      { status: 500 }
    );
  }
}
