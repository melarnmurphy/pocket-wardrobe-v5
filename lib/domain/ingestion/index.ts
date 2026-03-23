import { z } from "zod";

export const pipelineGarmentResultSchema = z.object({
  category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]),
  colour: z.string().min(1),
  material: z.string().min(1),
  style: z.string().min(1),
  tag: z.string().min(1),
  embedding: z.array(z.number()).length(768),
});

export const pipelineAnalyzeResponseSchema = z.object({
  garments: z.array(pipelineGarmentResultSchema),
});

export type PipelineGarmentResult = z.infer<typeof pipelineGarmentResultSchema>;
export type PipelineAnalyzeResponse = z.infer<typeof pipelineAnalyzeResponseSchema>;
