import { z } from "zod";

// Availability (9a) is distinct from wardrobe_status/archival: a piece stays in the
// wardrobe and in counts while merely unavailable. See DATA_MODEL.md "Piece".
export const AVAILABILITY_VALUES = [
  "wearable",
  "in the wash",
  "at the tailor",
  "lent out",
  "packed",
  "listed for sale"
] as const;

export const availabilitySchema = z.enum(AVAILABILITY_VALUES);
export type Availability = z.infer<typeof availabilitySchema>;

// Let-go list (9b) — DATA_MODEL.md "LetGoState".
export const LET_GO_REASON_VALUES = [
  "never worn",
  "does not fit",
  "not me anymore",
  "worn out",
  "duplicate"
] as const;

export const letGoReasonSchema = z.enum(LET_GO_REASON_VALUES);
export type LetGoReason = z.infer<typeof letGoReasonSchema>;

export const garmentSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().min(1).max(100),
  subcategory: z.string().trim().max(100).nullable().optional(),
  pattern: z.string().trim().max(80).nullable().optional(),
  material: z.string().trim().max(120).nullable().optional(),
  size: z.string().trim().max(40).nullable().optional(),
  fit: z.string().trim().max(80).nullable().optional(),
  formality_level: z.string().trim().max(80).nullable().optional(),
  seasonality: z.array(z.string().trim().min(1)).default([]),
  wardrobe_status: z
    .enum([
      "active",
      "archived",
      "in_laundry",
      "packed",
      "sold",
      "donated",
      "unavailable"
    ])
    .default("active"),
  purchase_price: z.coerce.number().nonnegative().nullable().optional(),
  purchase_currency: z.string().trim().length(3).nullable().optional(),
  purchase_date: z.string().date().nullable().optional(),
  retailer: z.string().trim().max(200).nullable().optional(),
  favourite_score: z.coerce.number().min(0).max(1).nullable().optional(),
  extraction_metadata_json: z.record(z.string(), z.unknown()).default({})
});

export const createGarmentSchema = garmentSchema.omit({
  id: true,
  user_id: true
});

export type Garment = z.infer<typeof garmentSchema>;
export type CreateGarmentInput = z.infer<typeof createGarmentSchema>;
