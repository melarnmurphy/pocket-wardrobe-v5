import { z } from "zod";
import { planTierSchema } from "@/lib/domain/entitlements";

export const billingSyncPayloadSchema = z.object({
  user_id: z.string().uuid(),
  plan_tier: planTierSchema,
  feature_labels_enabled: z.boolean().optional(),
  receipt_ocr_enabled: z.boolean().optional(),
  product_url_ingestion_enabled: z.boolean().optional(),
  outfit_decomposition_enabled: z.boolean().optional(),
  billing_provider: z.string().nullable().optional(),
  billing_customer_id: z.string().nullable().optional(),
  billing_subscription_id: z.string().nullable().optional()
});

export type BillingSyncPayload = z.infer<typeof billingSyncPayloadSchema>;
