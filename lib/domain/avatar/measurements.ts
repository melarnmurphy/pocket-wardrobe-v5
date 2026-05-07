import { z } from "zod";

export const bodyMeasurementSchema = z.object({
  value: z.coerce.number().positive(),
  unit: z.enum(["cm", "mm", "in"])
});

export const avatarBodyMeasurementsSchema = z
  .object({
    height: bodyMeasurementSchema.optional(),
    shoulder_width: bodyMeasurementSchema.optional(),
    chest: bodyMeasurementSchema.optional(),
    bust: bodyMeasurementSchema.optional(),
    waist: bodyMeasurementSchema.optional(),
    hip: bodyMeasurementSchema.optional(),
    inseam: bodyMeasurementSchema.optional(),
    arm_length: bodyMeasurementSchema.optional(),
    neck: bodyMeasurementSchema.optional()
  })
  .passthrough();

export const avatarSkinToneSchema = z
  .object({
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    undertone: z.enum(["warm", "cool", "neutral"]).optional(),
    fitzpatrick_type: z.number().int().min(1).max(6).optional(),
    confidence: z.coerce.number().min(0).max(1).optional()
  })
  .passthrough();

export const avatarShapeProfileSchema = z
  .object({
    silhouette: z.string().min(1).optional(),
    posture_notes: z.string().min(1).optional(),
    fit_priorities: z.array(z.string().min(1)).default([])
  })
  .passthrough();

export const avatarMeasurementSetSchema = z.object({
  body_measurements_json: avatarBodyMeasurementsSchema.default({}),
  shape_profile_json: avatarShapeProfileSchema.default({ fit_priorities: [] }),
  skin_tone_json: avatarSkinToneSchema.default({}),
  measurement_system: z.enum(["metric", "imperial"]).default("metric"),
  capture_method: z.enum(["manual", "photo_estimate", "scan", "partner_import"]).default("manual"),
  source_type: z
    .enum(["user_reported", "camera_capture", "body_scan", "partner_device", "stylist_entry"])
    .default("user_reported"),
  confidence: z.coerce.number().min(0).max(1).nullable().optional(),
  status: z.enum(["draft", "active", "superseded", "archived"]).default("active")
});

export const garment3dAssetSchema = z.object({
  asset_type: z.enum(["model", "texture", "material", "simulation_preset", "thumbnail"]),
  storage_path: z.string().min(1).nullable().optional(),
  file_format: z.string().min(1).nullable().optional(),
  material_profile_json: z.record(z.unknown()).default({}),
  physics_profile_json: z.record(z.unknown()).default({}),
  renderer_metadata_json: z.record(z.unknown()).default({}),
  source_type: z.enum(["manual", "designer_asset", "generated", "partner_import", "scan"]).default("manual"),
  confidence: z.coerce.number().min(0).max(1).nullable().optional(),
  status: z.enum(["draft", "ready", "failed", "archived"]).default("draft")
});

export type AvatarMeasurementSetInput = z.input<typeof avatarMeasurementSetSchema>;
export type Garment3dAssetInput = z.input<typeof garment3dAssetSchema>;
