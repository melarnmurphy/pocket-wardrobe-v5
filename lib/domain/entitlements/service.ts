import { createClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth";
import type { Database } from "@/types/database";
import {
  entitlementFeatures,
  type EntitlementFeature,
  type PlanTier,
  type UserEntitlements,
  userEntitlementsSchema
} from "@/lib/domain/entitlements";

type UserEntitlementsRow = Database["public"]["Tables"]["user_entitlements"]["Row"];

export class FeatureAccessError extends Error {
  readonly statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = "FeatureAccessError";
  }
}

function buildDefaultEntitlements(userId: string): UserEntitlements {
  const defaultTimestamp = new Date(0).toISOString();

  return {
    user_id: userId,
    plan_tier: "free",
    feature_labels_enabled: false,
    receipt_ocr_enabled: false,
    product_url_ingestion_enabled: false,
    outfit_decomposition_enabled: false,
    billing_provider: null,
    billing_customer_id: null,
    billing_subscription_id: null,
    created_at: defaultTimestamp,
    updated_at: defaultTimestamp
  };
}

export async function getUserEntitlements(): Promise<UserEntitlements> {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_entitlements")
    .select(
      "user_id,plan_tier,feature_labels_enabled,receipt_ocr_enabled,product_url_ingestion_enabled,outfit_decomposition_enabled,billing_provider,billing_customer_id,billing_subscription_id,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return buildDefaultEntitlements(user.id);
  }

  return userEntitlementsSchema.parse(data satisfies UserEntitlementsRow);
}

export function isFeatureEnabled(
  entitlements: UserEntitlements,
  feature: EntitlementFeature
) {
  return Boolean(entitlements[feature]);
}

export async function getPlanTier(): Promise<PlanTier> {
  const entitlements = await getUserEntitlements();
  return entitlements.plan_tier;
}

export async function canUseFeatureLabels(): Promise<boolean> {
  const entitlements = await getUserEntitlements();
  return isFeatureEnabled(entitlements, entitlementFeatures.featureLabels);
}

export function hasPaidPlan(entitlements: UserEntitlements) {
  return entitlements.plan_tier === "pro" || entitlements.plan_tier === "premium";
}

export async function assertPaidPlanAccess(featureName: string): Promise<UserEntitlements> {
  const entitlements = await getUserEntitlements();

  if (!hasPaidPlan(entitlements)) {
    throw new FeatureAccessError(
      `${featureName} is available on paid plans. Upgrade to Pro or Premium to unlock it.`
    );
  }

  return entitlements;
}

export async function assertFeatureLabelsAccess(): Promise<UserEntitlements> {
  const entitlements = await getUserEntitlements();

  if (!isFeatureEnabled(entitlements, entitlementFeatures.featureLabels)) {
    throw new FeatureAccessError(
      "Automatic photo feature labelling is a Premium feature. You can still upload the photo and fill in the garment details manually."
    );
  }

  return entitlements;
}
