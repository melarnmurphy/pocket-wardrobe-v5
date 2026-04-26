import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  resolveColourInput,
  resolveGarmentCategoryInput,
  resolveOccasionInput,
  resolveSeasonInput,
  resolveSemanticSuggestion
} from "@/lib/domain/style-rules/semantic-matching";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 0 when vectors are incompatible", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe("resolveSemanticSuggestion", () => {
  it("uses exact normalized matches before embeddings", async () => {
    const embed = async () => {
      throw new Error("embedding should not run for exact matches");
    };

    const result = await resolveSemanticSuggestion({
      input: "  Denim-Jacket ",
      suggestions: ["shirt", "denim jacket", "coat"],
      embed
    });

    expect(result).toEqual({
      input: "  Denim-Jacket ",
      resolved: "denim jacket",
      method: "exact",
      score: 1
    });
  });

  it("returns the closest semantic match above threshold", async () => {
    const embed = async (inputs: string[]) =>
      inputs.map((input) => {
        if (input === "button down") return [0.98, 0.02];
        if (input === "shirt") return [1, 0];
        if (input === "blazer") return [0, 1];
        return [0.5, 0.5];
      });

    const result = await resolveSemanticSuggestion({
      input: "button down",
      suggestions: ["shirt", "blazer"],
      embed,
      threshold: 0.7
    });

    expect(result?.resolved).toBe("shirt");
    expect(result?.method).toBe("semantic");
    expect(result?.score).toBeGreaterThan(0.9);
  });

  it("returns null when similarity stays below threshold", async () => {
    const embed = async (inputs: string[]) =>
      inputs.map((input) => {
        if (input === "umbrella") return [0.3, 0.7];
        if (input === "shirt") return [1, 0];
        if (input === "blazer") return [0.8, 0.2];
        return [0.5, 0.5];
      });

    const result = await resolveSemanticSuggestion({
      input: "umbrella",
      suggestions: ["shirt", "blazer"],
      embed,
      threshold: 0.95
    });

    expect(result).toBeNull();
  });
});

describe("resolveGarmentCategoryInput", () => {
  it("maps garment-like free text to a canonical category suggestion", async () => {
    const embed = async (inputs: string[]) =>
      inputs.map((input) => {
        if (input === "button down") return [0.98, 0.02];
        if (input === "shirt") return [1, 0];
        return [0, 1];
      });

    const result = await resolveGarmentCategoryInput("button down", {
      embed,
      threshold: 0.7
    });

    expect(result?.resolved).toBe("shirt");
  });
});

describe("resolveColourInput", () => {
  it("maps colour synonyms to canonical colour families", async () => {
    const result = await resolveColourInput("navy blue");

    expect(result).toEqual({
      input: "navy blue",
      resolved: "blue",
      method: "exact",
      score: 1
    });
  });
});

describe("resolveOccasionInput", () => {
  it("maps common occasion aliases to canonical occasion profiles", async () => {
    const result = await resolveOccasionInput("business casual");

    expect(result).toEqual({
      input: "business casual",
      resolved: "business_casual",
      method: "exact",
      score: 1
    });
  });
});

describe("resolveSeasonInput", () => {
  it("maps season aliases like fall to canonical season values", async () => {
    const result = await resolveSeasonInput("fall");

    expect(result).toEqual({
      input: "fall",
      resolved: "autumn",
      method: "exact",
      score: 1
    });
  });
});
