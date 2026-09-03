import { getBillingEnv, getPublicEnv, getServerEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripeClient } from "@/lib/stripe";
import { getRequiredUser } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import type { Database } from "@/types/database";
import {
  entitlementFeatures,
  type PlanTier
} from "@/lib/domain/entitlements";
import {
  billingSyncPayloadSchema,
  type BillingSyncPayload
} from "@/lib/domain/billing";

type UserEntitlementsInsert = Database["public"]["Tables"]["user_entitlements"]["Insert"];

export function getBillingStatus() {
  const env = getPublicEnv();
  const serverEnv = getServerEnv();
  const billingEnv = getBillingEnv();
  const provider = billingEnv.BILLING_PROVIDER ?? null;
  // Legacy fallback link, from before real Stripe Checkout was wired up.
  // Every current call site already falls back to /account when this is
  // unset, which is what happens everywhere today since this env var was
  // never actually configured — kept only so an external override link
  // remains possible without further code changes.
  const upgradeUrl = env.NEXT_PUBLIC_PREMIUM_UPGRADE_URL ?? null;

  return {
    provider,
    upgradeUrl,
    syncEnabled: Boolean(billingEnv.BILLING_SYNC_SECRET),
    checkoutEnabled: Boolean(provider === "stripe" && serverEnv.STRIPE_PLUS_ANNUAL_PRICE_ID)
  };
}

/**
 * Starts a subscription checkout for the single "plus" plan (A$69/year —
 * the only price with a real purchase button anywhere in the UI; the
 * A$5.75/month figure shown alongside it is informational only). Reuses
 * the caller's existing Stripe customer id if they have one, so a second
 * checkout doesn't create a duplicate customer.
 */
export async function createPlusCheckoutSession(baseUrl: string): Promise<{ url: string }> {
  const user = await getRequiredUser();
  const entitlements = await getUserEntitlements();
  const env = getServerEnv();

  if (!env.STRIPE_PLUS_ANNUAL_PRICE_ID) {
    throw new Error("Plus checkout is not configured: STRIPE_PLUS_ANNUAL_PRICE_ID is unset.");
  }

  const stripe = getStripeClient();
  const existingCustomerId = entitlements.billing_customer_id ?? undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env.STRIPE_PLUS_ANNUAL_PRICE_ID, quantity: 1 }],
    client_reference_id: user.id,
    customer: existingCustomerId,
    customer_email: existingCustomerId ? undefined : user.email ?? undefined,
    subscription_data: { metadata: { supabase_user_id: user.id } },
    success_url: `${baseUrl}/account?checkout=success`,
    cancel_url: `${baseUrl}/account`
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { url: session.url };
}

/**
 * Opens Stripe's self-service Customer Portal, for updating a payment
 * method after a failed charge, or cancelling. Requires an existing Stripe
 * customer — there's nothing to manage for a user who never checked out.
 */
export async function createBillingPortalSession(baseUrl: string): Promise<{ url: string }> {
  const entitlements = await getUserEntitlements();

  if (!entitlements.billing_customer_id) {
    throw new Error("No Stripe customer on this account yet — nothing to manage.");
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: entitlements.billing_customer_id,
    return_url: `${baseUrl}/account`
  });

  return { url: session.url };
}

export function getPremiumFeatureSummary() {
  return [
    "Automatic photo feature labelling",
    "AI-prefilled garment review drafts",
    "Future assisted receipt, URL, and outfit ingestion"
  ] as const;
}

export function deriveFeatureFlagsForPlan(planTier: PlanTier) {
  if (planTier === "premium") {
    return {
      [entitlementFeatures.featureLabels]: true,
      [entitlementFeatures.receiptOcr]: true,
      [entitlementFeatures.productUrlIngestion]: true,
      [entitlementFeatures.outfitDecomposition]: true
    };
  }

  if (planTier === "pro") {
    return {
      [entitlementFeatures.featureLabels]: false,
      [entitlementFeatures.receiptOcr]: false,
      [entitlementFeatures.productUrlIngestion]: true,
      [entitlementFeatures.outfitDecomposition]: false
    };
  }

  return {
    [entitlementFeatures.featureLabels]: false,
    [entitlementFeatures.receiptOcr]: false,
    [entitlementFeatures.productUrlIngestion]: false,
    [entitlementFeatures.outfitDecomposition]: false
  };
}

export async function syncUserEntitlementsFromBillingEvent(rawPayload: unknown) {
  const payload = billingSyncPayloadSchema.parse(rawPayload);
  const serviceClient = createServiceClient();
  const defaults = deriveFeatureFlagsForPlan(payload.plan_tier);

  const upsertPayload: UserEntitlementsInsert = {
    user_id: payload.user_id,
    plan_tier: payload.plan_tier,
    feature_labels_enabled:
      payload.feature_labels_enabled ?? defaults.feature_labels_enabled,
    receipt_ocr_enabled:
      payload.receipt_ocr_enabled ?? defaults.receipt_ocr_enabled,
    product_url_ingestion_enabled:
      payload.product_url_ingestion_enabled ?? defaults.product_url_ingestion_enabled,
    outfit_decomposition_enabled:
      payload.outfit_decomposition_enabled ?? defaults.outfit_decomposition_enabled,
    billing_provider: payload.billing_provider ?? null,
    billing_customer_id: payload.billing_customer_id ?? null,
    billing_subscription_id: payload.billing_subscription_id ?? null,
    billing_status: payload.billing_status ?? null
  };

  const { data, error } = await serviceClient
    .from("user_entitlements")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select(
      "user_id,plan_tier,feature_labels_enabled,receipt_ocr_enabled,product_url_ingestion_enabled,outfit_decomposition_enabled,billing_provider,billing_customer_id,billing_subscription_id,billing_status,created_at,updated_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function resolveUserIdByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const serviceClient = createServiceClient();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw new Error(error.message);
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (match) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  throw new Error(`No Supabase user found for ${normalizedEmail}.`);
}

export async function setUserPasswordById(userId: string, password: string) {
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.auth.admin.updateUserById(userId, {
    password
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}
