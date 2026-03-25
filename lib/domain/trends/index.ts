import { z } from "zod";

export const trendSignalSchema = z.object({
  id: z.string().uuid().optional(),
  trend_type: z.enum([
    "colour",
    "garment",
    "silhouette",
    "material",
    "pattern",
    "styling",
    "occasion",
    "aesthetic",
    "era_influence"
  ]),
  label: z.string().trim().min(1).max(200),
  normalized_attributes_json: z.record(z.string(), z.unknown()).default({}),
  season: z.string().trim().max(80).nullable().optional(),
  year: z.number().int().nullable().optional(),
  region: z.string().trim().max(80).nullable().optional()
});

export type TrendSignal = z.infer<typeof trendSignalSchema>;

export const userTrendMatchSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  trend_signal_id: z.string().uuid(),
  match_type: z.enum(["exact_match", "adjacent_match", "styling_match", "missing_piece"]),
  score: z.number().min(0).max(100),
  reasoning_json: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().optional()
});

export type UserTrendMatch = z.infer<typeof userTrendMatchSchema>;

export const userTrendMatchWithSignalSchema = userTrendMatchSchema.extend({
  trend_signal: trendSignalSchema
});
export type UserTrendMatchWithSignal = z.infer<typeof userTrendMatchWithSignalSchema>;
