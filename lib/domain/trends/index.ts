import { z } from "zod";
import type { WardrobeColourFamily } from "@/lib/domain/wardrobe/colours";

export const TREND_TYPES = [
  "colour",
  "garment",
  "silhouette",
  "material",
  "pattern",
  "styling",
  "occasion",
  "aesthetic",
  "era_influence"
] as const;

export type TrendType = (typeof TREND_TYPES)[number];

export const trendSignalSchema = z.object({
  id: z.string().uuid().optional(),
  trend_type: z.enum(TREND_TYPES),
  label: z.string().trim().min(1).max(200),
  normalized_attributes_json: z.record(z.string(), z.unknown()).default({}),
  season: z.string().trim().max(80).nullable().optional(),
  year: z.number().int().nullable().optional(),
  region: z.string().trim().max(80).nullable().optional(),
  source_count: z.number().int().default(0),
  authority_score: z.number().nullable().optional(),
  recency_score: z.number().nullable().optional(),
  confidence_score: z.number().nullable().optional(),
  first_seen_at: z.string().nullable().optional(),
  last_seen_at: z.string().nullable().optional(),
  created_at: z.string().optional()
});

export type TrendSignal = z.infer<typeof trendSignalSchema>;

export const trendColourSchema = z.object({
  id: z.string().uuid().optional(),
  trend_signal_id: z.string().uuid(),
  colour_id: z.string().uuid().nullable().optional(),
  source_name: z.string().min(1),
  source_label: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  canonical_hex: z.string().min(4).max(9),
  canonical_rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  canonical_lab: z.object({ l: z.number(), a: z.number(), b: z.number() }).nullable().optional(),
  canonical_lch: z.object({ l: z.number(), c: z.number(), h: z.number() }).nullable().optional(),
  family: z.string().nullable().optional(),
  undertone: z.enum(["warm", "cool", "neutral"]).nullable().optional(),
  saturation_band: z.enum(["low", "medium", "high"]).nullable().optional(),
  lightness_band: z.enum(["low", "medium", "high"]).nullable().optional(),
  importance_score: z.number().nullable().optional(),
  observed_at: z.string().nullable().optional(),
  created_at: z.string().optional()
});

export type TrendColour = z.infer<typeof trendColourSchema>;

export const trendSignalWithColourSchema = trendSignalSchema.extend({
  trend_colour: trendColourSchema.nullable().optional()
});

export type TrendSignalWithColour = z.infer<typeof trendSignalWithColourSchema>;

export const userTrendMatchSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  trend_signal_id: z.string().uuid(),
  match_type: z.enum(["exact_match", "adjacent_match", "styling_match", "missing_piece"]),
  score: z.number().min(0).max(1),
  reasoning_json: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().optional()
});

export type UserTrendMatch = z.infer<typeof userTrendMatchSchema>;

export const userTrendMatchWithSignalSchema = userTrendMatchSchema.extend({
  trend_signal: trendSignalSchema
});
export type UserTrendMatchWithSignal = z.infer<typeof userTrendMatchWithSignalSchema>;

export const trendIngestionJobSchema = z.object({
  id: z.string().uuid().optional(),
  job_type: z.enum([
    "source_ingestion",
    "signal_extraction",
    "aggregation",
    "scoring",
    "embedding_refresh",
    "user_matching"
  ]),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  started_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
  metadata_json: z.record(z.string(), z.unknown()).default({})
});

export type TrendIngestionJob = z.infer<typeof trendIngestionJobSchema>;

export interface TrendMatchReasoning {
  signal_label: string;
  match_reason: string;
  matched_garment_ids: string[];
  attributes_matched: string[];
  attributes_adjacent: string[];
}

export type ColourAttributes = {
  family: WardrobeColourFamily;
  undertone?: "warm" | "cool" | "neutral";
  lightness_band?: "low" | "medium" | "high";
};

export type GarmentAttributes = {
  category: string;
  subcategory?: string;
  fit?: string;
  material?: string;
};

export type SilhouetteAttributes = {
  fit?: string;
  structure?: "relaxed" | "structured" | "semi-structured";
  length?: "mini" | "midi" | "maxi" | "cropped" | "standard";
};

export type MaterialAttributes = { material: string; texture?: string };
export type PatternAttributes = { pattern: string; scale?: "small" | "medium" | "large" };

export type StylingAttributes = {
  principle: string;
  required_categories: string[];
  colour_constraint?: "monochrome" | "tonal" | "complementary" | "neutral" | null;
};

export type AestheticAttributes = { formality?: string; descriptors: string[] };
export type OccasionAttributes = { dress_code?: string; key_pieces: string[] };
export type EraInfluenceAttributes = { era: string; key_characteristics: string[] };
