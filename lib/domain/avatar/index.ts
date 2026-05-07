import { z } from "zod";

export const avatarSlotSchema = z.enum(["accessory", "top", "pants", "shoes"]);

export const avatarTilePositionSchema = z.object({
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  scale: z.coerce.number().min(0.5).max(1.8)
});

export const avatarLayoutSchema = z.object({
  garment_positions: z
    .record(avatarSlotSchema, z.record(z.string().uuid(), avatarTilePositionSchema))
    .default({})
});

export type AvatarSlot = z.infer<typeof avatarSlotSchema>;
export type AvatarTilePosition = z.infer<typeof avatarTilePositionSchema>;
export type AvatarLayout = z.infer<typeof avatarLayoutSchema>;

export const defaultAvatarTilePositions: Record<AvatarSlot, AvatarTilePosition> = {
  accessory: { x: 17, y: 26, scale: 1 },
  top: { x: 77, y: 31, scale: 1 },
  pants: { x: 20, y: 70, scale: 1 },
  shoes: { x: 78, y: 77, scale: 1 }
};

export function normalizeAvatarLayout(input: unknown): AvatarLayout {
  return avatarLayoutSchema.parse(input ?? {});
}

export * from "@/lib/domain/avatar/measurements";
