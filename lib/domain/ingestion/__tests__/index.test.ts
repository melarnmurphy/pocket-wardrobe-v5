import { describe, it, expect } from "vitest";
import {
  pipelineGarmentResultSchema,
  pipelineAnalyzeResponseSchema,
} from "@/lib/domain/ingestion";

const validGarment = {
  category: "shirt/blouse",
  confidence: 0.87,
  bbox: [10, 20, 100, 200] as [number, number, number, number],
  colour: "navy",
  material: "cotton",
  style: "casual",
  tag: "navy cotton shirt/blouse",
  embedding: Array(768).fill(0.1),
};

describe("pipelineGarmentResultSchema", () => {
  it("parses a valid garment result", () => {
    const result = pipelineGarmentResultSchema.parse(validGarment);
    expect(result.category).toBe("shirt/blouse");
    expect(result.embedding).toHaveLength(768);
  });

  it("strips unknown fields (e.g. colour_conf from Modal response)", () => {
    const result = pipelineGarmentResultSchema.parse({
      ...validGarment,
      colour_conf: 0.9,
      material_conf: 0.8,
    });
    expect((result as Record<string, unknown>).colour_conf).toBeUndefined();
  });

  it("rejects if embedding is wrong length", () => {
    expect(() =>
      pipelineGarmentResultSchema.parse({ ...validGarment, embedding: Array(512).fill(0.1) })
    ).toThrow();
  });
});

describe("pipelineAnalyzeResponseSchema", () => {
  it("parses empty garments list", () => {
    const result = pipelineAnalyzeResponseSchema.parse({ garments: [] });
    expect(result.garments).toHaveLength(0);
  });
});
