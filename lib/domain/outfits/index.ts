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

// Role enum re-export for use in generator
export const OUTFIT_ITEM_ROLES = [
  "top", "bottom", "dress", "outerwear",
  "shoes", "accessory", "bag", "jewellery", "other"
] as const;
export type OutfitItemRole = typeof OUTFIT_ITEM_ROLES[number];

// Garment as it appears in a result chip
export const outfitGarmentPreviewSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable().optional(),
  category: z.string(),
  role: z.enum(OUTFIT_ITEM_ROLES),
  preview_url: z.string().nullable().optional()
});
export type OutfitGarmentPreview = z.infer<typeof outfitGarmentPreviewSchema>;

// A fired rule — drives "Why this works" tags
export const firedRuleSchema = z.object({
  description: z.string(), // human-readable, e.g. "Navy and beige are analogous colours"
  garment_ids: z.array(z.string().uuid())
});
export type FiredRule = z.infer<typeof firedRuleSchema>;

// What the generator returns before saving
export const generatedOutfitSchema = z.object({
  garments: z.array(outfitGarmentPreviewSchema),
  firedRules: z.array(firedRuleSchema),
  explanation: z.string().nullable() // null on free tier; Claude prose on Pro
});
export type GeneratedOutfit = z.infer<typeof generatedOutfitSchema>;

// Input to generateOutfitAction
export const generateOutfitInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("plan"),
    occasion: z.string().trim().max(120).nullable().optional(),
    dress_code: z.string().trim().max(120).nullable().optional(),
    weather: z.string().trim().max(80).nullable().optional()
  }),
  z.object({ mode: z.literal("surprise") }),
  z.object({ mode: z.literal("trend"), trend_signal_id: z.string().uuid() })
]);
export type GenerateOutfitInput = z.infer<typeof generateOutfitInputSchema>;

// Input to saveOutfitAction
export const saveOutfitInputSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  occasion: z.string().trim().max(120).nullable().optional(),
  dress_code: z.string().trim().max(120).nullable().optional(),
  weather_context_json: z.record(z.string(), z.unknown()).default({}),
  explanation: z.string().trim().max(4000).nullable().optional(),
  explanation_json: z.record(z.string(), z.unknown()).default({}),
  garments: z.array(z.object({
    garment_id: z.string().uuid(),
    role: z.enum(OUTFIT_ITEM_ROLES)
  }))
});
export type SaveOutfitInput = z.infer<typeof saveOutfitInputSchema>;

// A saved outfit with its items joined for the gallery
export const outfitWithItemsSchema = outfitSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().optional(),
  items: z.array(outfitItemSchema.extend({
    id: z.string().uuid(),
    garment: z.object({
      id: z.string().uuid(),
      title: z.string().nullable().optional(),
      category: z.string(),
      preview_url: z.string().nullable().optional()
    })
  }))
});
export type OutfitWithItems = z.infer<typeof outfitWithItemsSchema>;
