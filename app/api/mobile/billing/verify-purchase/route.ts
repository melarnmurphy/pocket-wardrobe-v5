import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { verifyAppleTransaction, isAppleTransactionActive } from "@/lib/domain/billing/apple";
import { syncUserEntitlementsFromBillingEvent } from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";

export const dynamic = "force-dynamic";

const BUNDLE_ID = "com.melandwes.PocketWardrobev5";

const verifyPurchaseInputSchema = z.object({
  signed_transaction: z.string().min(1)
});

/**
 * Mirrors what the Stripe webhook does for web (app/api/webhooks/stripe/
 * route.ts -> syncUserEntitlementsFromBillingEvent), but for a StoreKit 2
 * purchase made on the phone: the app calls this right after StoreKit
 * reports Transaction.updates/purchase() as verified, handing over the raw
 * JWS so it gets verified again here — a client can't be trusted to just
 * assert "I paid," the signature has to check out against Apple's own root
 * certificate (lib/domain/billing/apple.ts).
 *
 * The purchase's appAccountToken (set by the iOS app to the signed-in
 * user's own Supabase id — see BillingStore.swift) is what ties a verified
 * Apple transaction to a specific account: nothing else in Apple's payload
 * carries a Supabase user id, so without this check a verified transaction
 * from user A's device could otherwise be replayed to credit user B.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getRequiredMobileUser(request);
    const rawInput = await request.json();
    const parsed = verifyPurchaseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const decoded = await verifyAppleTransaction(parsed.data.signed_transaction);

    if (decoded.bundleId !== BUNDLE_ID) {
      return NextResponse.json({ error: "Transaction is for a different app." }, { status: 400 });
    }
    if (decoded.appAccountToken && decoded.appAccountToken !== user.id) {
      return NextResponse.json({ error: "Transaction does not belong to this account." }, { status: 400 });
    }

    const isActive = isAppleTransactionActive(decoded);

    await syncUserEntitlementsFromBillingEvent({
      user_id: user.id,
      plan_tier: isActive ? "premium" : "free",
      billing_provider: "apple",
      billing_customer_id: decoded.originalTransactionId ?? null,
      billing_subscription_id: decoded.transactionId ?? null,
      billing_status: isActive ? "active" : "lapsed"
    });

    const entitlements = await getUserEntitlements({ supabase, userId: user.id });
    return NextResponse.json({ entitlements });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify purchase" },
      { status: 500 }
    );
  }
}
