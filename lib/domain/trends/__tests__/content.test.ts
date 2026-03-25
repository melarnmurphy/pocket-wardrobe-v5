import { describe, it, expect } from "vitest";
import { extractColoursFromText, scoreChunkRelevance, chunkText, isFashionRelevant } from "../content";

describe("isFashionRelevant", () => {
  it("allows Fashion category", () => {
    expect(isFashionRelevant(["Fashion", "Fashion / Trends"])).toBe(true);
  });
  it("allows Runway category", () => {
    expect(isFashionRelevant(["Runway"])).toBe(true);
  });
  it("blocks Culture/Music", () => {
    expect(isFashionRelevant(["Culture/Music"])).toBe(false);
  });
  it("blocks Living/Royals", () => {
    expect(isFashionRelevant(["Living/Royals"])).toBe(false);
  });
  it("blocks Beauty/Wellness", () => {
    expect(isFashionRelevant(["Beauty/Wellness"])).toBe(false);
  });
  it("returns false for empty categories", () => {
    expect(isFashionRelevant([])).toBe(false);
  });
});

describe("extractColoursFromText", () => {
  it("extracts canonical colour families from synonyms", () => {
    const results = extractColoursFromText("A camel trench coat paired with a navy blazer and ivory shirt.");
    const families = results.map((r) => r.family);
    expect(families).toContain("beige"); // camel → beige
    expect(families).toContain("blue");  // navy → blue
    expect(families).toContain("white"); // ivory → white
  });

  it("counts frequency correctly", () => {
    const results = extractColoursFromText("red bag, red shoes, red dress — red is everywhere");
    const red = results.find((r) => r.family === "red");
    expect(red?.count).toBe(4);
  });

  it("returns empty array for non-colour text", () => {
    expect(extractColoursFromText("Jennifer Lopez attended the gala.")).toHaveLength(0);
  });

  it("handles multi-word synonyms", () => {
    const results = extractColoursFromText("The dusty rose gown was spectacular.");
    expect(results.find((r) => r.family === "pink")?.term).toBe("dusty rose");
  });
});

describe("scoreChunkRelevance", () => {
  it("scores high for fashion-dense text", () => {
    const text = "The key silhouette this season is a directional tailoring aesthetic with proportion as the defining element.";
    expect(scoreChunkRelevance(text)).toBeGreaterThan(0.15);
  });

  it("scores low for non-fashion text", () => {
    const text = "Jennifer Aniston shared her morning routine and favourite snacks in a new interview.";
    expect(scoreChunkRelevance(text)).toBeLessThan(0.1);
  });

  it("returns 0 for very short chunks", () => {
    expect(scoreChunkRelevance("Short.")).toBe(0);
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const text = "a".repeat(500);
    expect(chunkText(text)).toHaveLength(1);
  });

  it("produces overlapping chunks for long text", () => {
    const text = "a".repeat(2000);
    const chunks = chunkText(text, 800, 150);
    expect(chunks.length).toBeGreaterThan(1);
    // Verify overlap: end of chunk 0 overlaps start of chunk 1
    expect(chunks[0].slice(-150)).toBe(chunks[1].slice(0, 150));
  });

  it("skips chunks below minSize", () => {
    const text = "a".repeat(900); // 800 + 100 remaining — 100 < 200 min
    expect(chunkText(text, 800, 150, 200)).toHaveLength(1);
  });
});
