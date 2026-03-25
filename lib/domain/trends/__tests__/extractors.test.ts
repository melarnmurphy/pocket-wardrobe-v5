import { describe, it, expect } from "vitest";
import { canonicalizeLabel } from "../matching";
import { buildExtractionPrompt } from "../extraction";

describe("buildExtractionPrompt", () => {
  it("includes the source title in the prompt", () => {
    const prompt = buildExtractionPrompt({
      title: "The Return of the Power Suit",
      excerpt: "Editors are calling it: structured tailoring is back.",
      author: "Sarah Mower",
      publishDate: "2026-03-10",
      sourceName: "Vogue"
    });
    expect(prompt).toContain("The Return of the Power Suit");
    expect(prompt).toContain("Sarah Mower");
    expect(prompt).toContain("Vogue");
  });

  it("includes colour family enum values in the prompt", () => {
    const prompt = buildExtractionPrompt({
      title: "Test",
      excerpt: "Test excerpt.",
      author: null,
      publishDate: null,
      sourceName: "Vogue"
    });
    expect(prompt).toContain("beige");
    expect(prompt).toContain("blue");
    expect(prompt).toContain("black");
    expect(prompt).toContain("brown");
    expect(prompt).toContain("white");
  });

  it("includes all TREND_TYPES in the prompt", () => {
    const prompt = buildExtractionPrompt({ title: "T", excerpt: null, author: null, publishDate: null, sourceName: "S" });
    expect(prompt).toContain("colour");
    expect(prompt).toContain("silhouette");
    expect(prompt).toContain("era_influence");
  });
});

describe("canonicalizeLabel (used in extraction upsert)", () => {
  it("wide-leg trousers and Wide Leg Trousers produce same key", () => {
    expect(canonicalizeLabel("wide-leg trousers")).toBe(canonicalizeLabel("Wide Leg Trousers"));
  });

  it("dedup key is consistent for LLM variants", () => {
    expect(canonicalizeLabel("Butter Yellow")).toBe(canonicalizeLabel("butter yellow"));
    expect(canonicalizeLabel("Over-sized Blazer")).toBe(canonicalizeLabel("over-sized blazer"));
  });
});
