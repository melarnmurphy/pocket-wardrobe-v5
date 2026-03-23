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
