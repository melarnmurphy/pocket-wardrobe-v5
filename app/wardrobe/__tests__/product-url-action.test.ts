import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient
}));

const createGarment = vi.fn();
const addGarmentImageFromUrl = vi.fn();
const setGarmentPrimaryColourFamily = vi.fn();

vi.mock("@/lib/domain/wardrobe/service", () => ({
  createGarment,
  addGarmentImageFromUrl,
  addGarmentImage: vi.fn(),
  deleteGarment: vi.fn(),
  setGarmentPrimaryColourFamily,
  toggleGarmentFavourite: vi.fn(),
  updateGarment: vi.fn()
}));

const createProductUrlSource = vi.fn();
const createManualReviewDraft = vi.fn();

vi.mock("@/lib/domain/ingestion/service", () => ({
  createGarmentSource: vi.fn(),
  createDraftsFromPipelineResult: vi.fn(),
  createManualPhotoReviewDraft: vi.fn(),
  createManualReviewDraft,
  createProductUrlSource,
  createReceiptSource: vi.fn()
}));

const extractProductMetadataFromUrl = vi.fn();

vi.mock("@/lib/domain/ingestion/extractors", () => ({
  extractProductMetadataFromUrl,
  extractSizeFromNotes: vi.fn(),
  parseReceiptDraftCandidates: vi.fn(),
  readReceiptTextFromFile: vi.fn()
}));

vi.mock("@/lib/domain/ingestion/client", () => ({
  callPipelineService: vi.fn(),
  callReceiptOcrService: vi.fn()
}));

vi.mock("@/lib/domain/entitlements/service", () => ({
  canUseFeatureLabels: vi.fn()
}));

vi.mock("@/lib/domain/wear-events/service", () => ({
  logWearEvent: vi.fn()
}));

const getServerEnv = vi.fn();

vi.mock("@/lib/env", () => ({
  getServerEnv
}));

describe("createProductUrlDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const eq = vi.fn().mockResolvedValue({ data: null, error: null });
    mockCreateClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq
        })
      })
    });

    createProductUrlSource.mockResolvedValue({
      sourceId: "11111111-1111-4111-8111-111111111111"
    });
    createManualReviewDraft.mockResolvedValue("33333333-3333-4333-8333-333333333333");
    getServerEnv.mockReturnValue({});
    createGarment.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222"
    });
    addGarmentImageFromUrl.mockResolvedValue({
      storagePath: "user/garment/product-image.jpg",
      featureStoragePath: "user/garment/product-image-feature.jpg",
      colourAnalysis: {
        dominantHex: "#f4f0e6",
        inferredFamily: "white",
        lightnessBand: "high",
        relativeLuminance: 0.88
      }
    });
    extractProductMetadataFromUrl.mockResolvedValue({
      title: "Ivory Trench Coat",
      brand: "Test Brand",
      category: "coat",
      colour: "ivory",
      fit: null,
      material: null,
      retailer: "Example",
      description: "Lightweight trench coat",
      price: "249.00",
      currency: "AUD",
      image_url: "https://cdn.example.com/trench.jpg",
      attributes: [],
      styling_suggestions: []
    });
  });

  it("creates a product URL source and review draft without creating a final garment", async () => {
    const { createProductUrlDraftAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    formData.set("product_url", "https://example.com/products/ivory-trench");

    const result = await createProductUrlDraftAction(
      { status: "idle", message: null },
      formData
    );

    expect(result.status).toBe("success");
    expect(result.nextPath).toBe("/wardrobe/review");
    expect(result.draftIds).toEqual(["33333333-3333-4333-8333-333333333333"]);
    expect(result.garmentId).toBeUndefined();
    expect(result.message).toContain("Review");
    expect(createProductUrlSource).toHaveBeenCalledWith({
      url: "https://example.com/products/ivory-trench"
    });
    expect(createManualReviewDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "11111111-1111-4111-8111-111111111111",
        sourceType: "product_url",
        title: "Ivory Trench Coat",
        category: "coat",
        colour: "ivory",
        brand: "Test Brand",
        confidence: 0.72,
        metadata: expect.objectContaining({
          extracted_image_url: "https://cdn.example.com/trench.jpg"
        })
      })
    );
    expect(createGarment).not.toHaveBeenCalled();
    expect(addGarmentImageFromUrl).not.toHaveBeenCalled();
    expect(setGarmentPrimaryColourFamily).not.toHaveBeenCalled();
  });
});
