import { z } from "zod";

const optionalTimestampInputSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString();
}, z.string().min(1).optional());

export const wearEventSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  garment_id: z.string().uuid(),
  worn_at: optionalTimestampInputSchema,
  occasion: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  outfit_id: z.string().uuid().nullable().optional()
});

export const createWearEventSchema = wearEventSchema.omit({
  id: true,
  user_id: true
});

export type WearEvent = z.infer<typeof wearEventSchema>;
export type CreateWearEventInput = z.infer<typeof createWearEventSchema>;
