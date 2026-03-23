import { z } from "zod";

export const lookbookEntrySchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  source_type: z.enum([
    "manual",
    "uploaded_image",
    "editorial_reference",
    "wishlist",
    "ai_generated",
    "outfit_reference"
  ]),
  source_url: z.string().url().nullable().optional(),
  image_path: z.string().trim().nullable().optional(),
  aesthetic_tags: z.array(z.string().trim().min(1)).default([]),
  occasion_tags: z.array(z.string().trim().min(1)).default([])
});

export const createLookbookEntrySchema = lookbookEntrySchema.omit({
  id: true,
  user_id: true
});

const lookbookItemBaseSchema = z.object({
  id: z.string().uuid().optional(),
  lookbook_entry_id: z.string().uuid(),
  garment_id: z.string().uuid().nullable().optional(),
  desired_item_json: z.record(z.string(), z.unknown()).nullable().optional(),
  role: z.string().trim().max(80).nullable().optional()
});

export const lookbookItemSchema = lookbookItemBaseSchema.refine(
  (value) => value.garment_id != null || value.desired_item_json != null,
  "A lookbook item must reference either an owned garment or a desired item."
);

export const createLookbookItemSchema = lookbookItemBaseSchema.omit({
  id: true
}).refine(
  (value) => value.garment_id != null || value.desired_item_json != null,
  "A lookbook item must reference either an owned garment or a desired item."
);

export type LookbookEntry = z.infer<typeof lookbookEntrySchema>;
export type CreateLookbookEntryInput = z.infer<typeof createLookbookEntrySchema>;
export type LookbookItem = z.infer<typeof lookbookItemSchema>;
export type CreateLookbookItemInput = z.infer<typeof createLookbookItemSchema>;
