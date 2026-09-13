import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError } from "@/lib/auth";
import { getRequiredMobileUser } from "@/lib/auth-mobile";
import { verifyAppleTransaction, isAppleTransactionActive } from "@/lib/domain/billing/apple";
import { syncUserEntitlementsFromBillingEvent } from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { createServiceClient } from "@/lib/supabase/service";

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
    const transactionId = decoded.transactionId;
    if (!transactionId) {
      return NextResponse.json({ error: "Apple returned an incomplete transaction." }, { status: 400 });
    }

    const billingRpc = createServiceClient();
    const { data: claimed, error: claimError } = await billingRpc.rpc(
      "claim_apple_transaction" as never,
      {
        p_transaction_id: transactionId,
        p_user_id: user.id,
        p_original_transaction_id: decoded.originalTransactionId ?? null,
        p_expires_at: decoded.expiresDate ? new Date(decoded.expiresDate).toISOString() : null
      } as never
    );
    if (claimError) throw new Error(claimError.message);
    if (!claimed) {
      const entitlements = await getUserEntitlements({ supabase, userId: user.id });
      return NextResponse.json({ entitlements, duplicate: true });
    }

    try {
      await syncUserEntitlementsFromBillingEvent({
        user_id: user.id,
        plan_tier: isActive ? "premium" : "free",
        billing_provider: "apple",
        billing_customer_id: decoded.originalTransactionId ?? null,
        billing_subscription_id: transactionId,
        billing_status: isActive ? "active" : "lapsed"
      });
      await billingRpc.rpc("finish_apple_transaction" as never, {
        p_transaction_id: transactionId,
        p_status: "succeeded",
        p_error_message: null
      } as never);
    } catch (error) {
      await billingRpc.rpc("finish_apple_transaction" as never, {
        p_transaction_id: transactionId,
        p_status: "failed",
        p_error_message: error instanceof Error ? error.message : "Entitlement sync failed"
      } as never);
      throw error;
    }

    const entitlements = await getUserEntitlements({ supabase, userId: user.id });
    return NextResponse.json({ entitlements });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "We couldn’t verify that purchase right now. Please try again." },
      { status: 500 }
    );
  }
}
