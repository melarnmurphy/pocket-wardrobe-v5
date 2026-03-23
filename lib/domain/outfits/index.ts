import { z } from "zod";

export const outfitSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  dress_code: z.string().trim().max(120).nullable().optional(),
  weather_context_json: z.record(z.string(), z.unknown()).default({}),
  explanation: z.string().trim().max(4000).nullable().optional(),
  explanation_json: z.record(z.string(), z.unknown()).default({}),
  source_type: z
    .enum(["generated", "manual", "imported", "planner"])
    .default("generated")
});

export const outfitItemSchema = z.object({
  id: z.string().uuid().optional(),
  outfit_id: z.string().uuid(),
  garment_id: z.string().uuid(),
  role: z.enum([
    "top",
    "bottom",
    "dress",
    "outerwear",
    "shoes",
    "accessory",
    "bag",
    "jewellery",
    "other"
  ])
});

export type Outfit = z.infer<typeof outfitSchema>;
export type OutfitItem = z.infer<typeof outfitItemSchema>;
