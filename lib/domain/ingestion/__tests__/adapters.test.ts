import { describe, expect, it } from "vitest";
import {
  directUploadAdapter,
  outfitDecompositionAdapter,
  parseProductPrice,
  productUrlAdapter,
  receiptAdapter
} from "@/lib/domain/ingestion/adapters";
import type { ProductMetadata } from "@/lib/domain/ingestion/extractors";

const baseProductMetadata: ProductMetadata = {
  title: "Ivory Trench Coat",
  brand: "Test Brand",
  category: "coat",
  colour: "ivory",
  fit: "relaxed",
  material: "cotton",
  retailer: "example.com",
  description: "Lightweight trench coat",
  price: "AUD 249.00",
  currency: "AUD",
  image_url: "https://cdn.example.com/trench.jpg",
  attributes: [],
  styling_suggestions: []
};

describe("parseProductPrice", () => {
  it("normalizes displayed product prices", () => {
    expect(parseProductPrice("AUD 249.00")).toBe(249);
    expect(parseProductPrice("$1,299.95")).toBe(1299.95);
    expect(parseProductPrice(null)).toBeNull();
  });
});

describe("productUrlAdapter", () => {
  it("builds a review draft payload instead of a final garment payload", () => {
    const draft = productUrlAdapter.buildDraft({
      productUrl: "https://example.com/products/ivory-trench",
      titleHint: "ivory trench",
      extracted: baseProductMetadata
    });

    expect(draft.sourceType).toBe("product_url");
    expect(draft.title).toBe("Ivory Trench Coat");
    expect(draft.category).toBe("coat");
    expect(draft.purchasePrice).toBe(249);
    expect(draft.extractionSource).toBe("retailer metadata");
    expect(draft.metadata.extracted_image_url).toBe("https://cdn.example.com/trench.jpg");
  });
});

describe("directUploadAdapter", () => {
  it("builds a low-confidence manual review draft when no detector result exists", () => {
    const draft = directUploadAdapter.buildDraft({
      fileName: "black-linen-dress.jpg"
    });

    expect(draft.sourceType).toBe("direct_upload");
    expect(draft.title).toBe("black linen dress");
    expect(draft.confidence).toBe(0.05);
    expect(draft.extractionSource).toBe("manual entry");
    expect(draft.fieldConfidence).toBeUndefined();
    expect(draft.fieldProvenance).toBeUndefined();
  });

  it("builds a detector-backed review draft with bbox provenance", () => {
    const draft = directUploadAdapter.buildDraft({
      fileName: "outfit.jpg",
      detected: {
        category: "blazer",
        confidence: 0.88,
        bbox: [10, 20, 100, 180],
        colour: "navy",
        material: "wool",
        style: "tailored",
        tag: "navy wool blazer",
        embedding: Array(768).fill(0.1)
      }
    });

    expect(draft.sourceType).toBe("direct_upload");
    expect(draft.category).toBe("blazer");
    expect(draft.bbox).toEqual([10, 20, 100, 180]);
    expect(draft.extractionSource).toBe("image analysis");
    expect(draft.fieldConfidence?.category).toBe(0.88);
    expect(draft.fieldConfidence?.colour).toBe(0.88);
    expect(draft.fieldConfidence?.material).toBe(0.88);
    expect(draft.fieldConfidence?.style).toBe(0.88);
    expect(draft.fieldConfidence?.title).toBe(0.88);
    expect(draft.fieldProvenance?.category).toBe("ai_vision");
    expect(draft.fieldProvenance?.colour).toBe("ai_vision");
    expect(draft.fieldConfidence?.brand).toBeUndefined();
    expect(draft.fieldConfidence?.retailer).toBeUndefined();
  });
});

describe("receiptAdapter", () => {
  it("builds a review draft from a parsed receipt candidate", () => {
    const draft = receiptAdapter.buildDraft({
      fileName: "receipt.pdf",
      extractionSource: "pasted text",
      candidate: {
        title: "Wool Blazer",
        category: "blazer",
        colour: null,
        brand: "Basque",
        retailer: "Myer",
        price: 179.95,
        currency: "AUD",
        notes: null,
        confidence: 0.74
      }
    });

    expect(draft.sourceType).toBe("receipt");
    expect(draft.title).toBe("Wool Blazer");
    expect(draft.purchasePrice).toBe(179.95);
    expect(draft.metadata.receipt_retailer).toBe("Myer");
  });
});

describe("outfitDecompositionAdapter", () => {
  it("scaffolds an outfit-derived review draft without creating a garment", () => {
    const draft = outfitDecompositionAdapter.buildDraft({
      fileName: "full-look.jpg",
      role: "outerwear"
    });

    expect(draft.sourceType).toBe("outfit_decomposition");
    expect(draft.category).toBe("");
    expect(draft.style).toBe("outerwear");
    expect(draft.extractionSource).toBe("outfit decomposition scaffold");
  });
});
