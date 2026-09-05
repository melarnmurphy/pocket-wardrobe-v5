import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { getAccountProfile, updateAccountProfile } from "@/lib/domain/account/service";
import { getUserEntitlements, hasPaidPlan, isBillingLapsed } from "@/lib/domain/entitlements/service";

export const dynamic = "force-dynamic";

const updateAccountInputSchema = z.object({
  display_name: z.string().trim().max(80).nullable(),
  preferred_location: z.string().trim().max(160).nullable(),
  region: z.enum(["AU", "NZ"]).optional(),
  temperature_unit: z.enum(["C", "F"]).optional(),
  currency_unit: z.enum(["AUD", "NZD"]).optional()
});

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const [profile, entitlements] = await Promise.all([
      getAccountProfile(user),
      getUserEntitlements({ supabase, userId: user.id })
    ]);

    return NextResponse.json({
      profile,
      plan: {
        tier: entitlements.plan_tier,
        is_paid: hasPaidPlan(entitlements),
        billing_lapsed: isBillingLapsed(entitlements)
      }
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load account" },
      { status: 500 }
    );
  }
}

// POST rather than PATCH: every other mobile-mutating route in this app
// (outfits/save, outfits/generate-week, wear-events) uses POST, so the iOS
// MobileAPIClient only implements GET/POST — matching that instead of
// adding a one-off HTTP verb to the client for this single endpoint.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rawInput = await request.json();
    const parsed = updateAccountInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const profile = await updateAccountProfile(parsed.data, { supabase, userId: user.id });
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update account" },
      { status: 500 }
    );
  }
}
