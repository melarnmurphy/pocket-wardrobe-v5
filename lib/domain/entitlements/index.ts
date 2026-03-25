import { z } from "zod";

export const planTierSchema = z.enum(["free", "pro", "premium"]);

export const userEntitlementsSchema = z.object({
  user_id: z.string().uuid(),
  plan_tier: planTierSchema,
  feature_labels_enabled: z.boolean(),
  receipt_ocr_enabled: z.boolean(),
  product_url_ingestion_enabled: z.boolean(),
  outfit_decomposition_enabled: z.boolean(),
  billing_provider: z.string().nullable(),
  billing_customer_id: z.string().nullable(),
  billing_subscription_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export type PlanTier = z.infer<typeof planTierSchema>;
export type UserEntitlements = z.infer<typeof userEntitlementsSchema>;

export const entitlementFeatures = {
  featureLabels: "feature_labels_enabled",
  receiptOcr: "receipt_ocr_enabled",
  productUrlIngestion: "product_url_ingestion_enabled",
  outfitDecomposition: "outfit_decomposition_enabled"
} as const;

export type EntitlementFeature =
  (typeof entitlementFeatures)[keyof typeof entitlementFeatures];
