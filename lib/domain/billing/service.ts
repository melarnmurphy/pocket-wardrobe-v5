import { getBillingEnv, getPublicEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
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
  const billingEnv = getBillingEnv();
  const provider = billingEnv.BILLING_PROVIDER ?? null;
  const upgradeUrl = env.NEXT_PUBLIC_PREMIUM_UPGRADE_URL ?? null;

  return {
    provider,
    upgradeUrl,
    syncEnabled: Boolean(billingEnv.BILLING_SYNC_SECRET),
    checkoutEnabled: Boolean(provider && upgradeUrl)
  };
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
    billing_subscription_id: payload.billing_subscription_id ?? null
  };

  const { data, error } = await serviceClient
    .from("user_entitlements")
    .upsert(upsertPayload, { onConflict: "user_id" })
    .select(
      "user_id,plan_tier,feature_labels_enabled,receipt_ocr_enabled,product_url_ingestion_enabled,outfit_decomposition_enabled,billing_provider,billing_customer_id,billing_subscription_id,created_at,updated_at"
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
