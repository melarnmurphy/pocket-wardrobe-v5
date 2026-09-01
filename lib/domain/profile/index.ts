import { z } from "zod";

export const SIZE_SYSTEM_VALUES = ["AU", "UK", "US", "EU"] as const;
export const sizeSystemSchema = z.enum(SIZE_SYSTEM_VALUES);
export type SizeSystem = z.infer<typeof sizeSystemSchema>;

const nullableTrimmed = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
    z.string().max(max).nullable()
  );

export const updateProfileSchema = z.object({
  local_name: nullableTrimmed(80),
  suburb: nullableTrimmed(120)
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const sizesSchema = z.object({
  tops_size: nullableTrimmed(20),
  bottoms_size: nullableTrimmed(20),
  shoes_size: nullableTrimmed(20),
  tops_size_system: sizeSystemSchema.default("AU"),
  bottoms_size_system: sizeSystemSchema.default("AU"),
  shoes_size_system: sizeSystemSchema.default("AU"),
  height_cm: z.coerce.number().int().positive().max(299).nullable(),
  one_size_either_way: z.boolean().default(false)
});
export type SizesInput = z.infer<typeof sizesSchema>;

export const localPrivacySchema = z.object({
  show_suburb: z.boolean(),
  show_wear_count: z.boolean()
});
export type LocalPrivacyInput = z.infer<typeof localPrivacySchema>;

export const profileSchema = updateProfileSchema
  .merge(sizesSchema)
  .merge(localPrivacySchema)
  .extend({
    user_id: z.string().uuid(),
    suburb_lat: z.coerce.number().nullable(),
    suburb_lng: z.coerce.number().nullable(),
    radius_km: z.number().int().min(5).max(100).default(30),
    created_at: z.string(),
    updated_at: z.string()
  });
export type Profile = z.infer<typeof profileSchema>;

/**
 * 17a / w3e's "what other people see" — DATA_MODEL.md's PublicProfile.
 * Never exposed: surname, email, phone, street address, purchase prices,
 * wear dates, the rest of the wardrobe, or any piece not on a live listing.
 */
export type PublicProfilePreview = {
  userId: string;
  localName: string | null;
  suburb: string | null;
  avatarUri: string | null;
  joinedAt: string | null;
  handoverCount: number;
  listedCount: number;
};
