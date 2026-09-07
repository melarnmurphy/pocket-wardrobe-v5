import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    storage: {
      from: vi.fn()
    }
  })
}));

const createGarmentSource = vi.fn();
const createManualPhotoReviewDraft = vi.fn();
const callPipelineService = vi.fn();
const canUseFeatureLabels = vi.fn();

vi.mock("@/lib/domain/ingestion/service", () => ({
  createGarmentSource,
  createDraftsFromPipelineResult: vi.fn(),
  createManualPhotoReviewDraft,
  createManualReviewDraft: vi.fn(),
  createProductUrlSource: vi.fn(),
  createReceiptSource: vi.fn()
}));

vi.mock("@/lib/domain/ingestion/client", () => ({
  callPipelineService,
  callReceiptOcrService: vi.fn()
}));

vi.mock("@/lib/domain/entitlements/service", () => ({
  canUseFeatureLabels
}));

vi.mock("@/lib/domain/ingestion/extractors", () => ({
  extractProductMetadataFromUrl: vi.fn(),
  parseReceiptDraftCandidates: vi.fn(),
  readReceiptTextFromFile: vi.fn()
}));

describe("createPhotoDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a manual review draft for free users without calling the pipeline", async () => {
    const { createPhotoDraftAction } = await import("@/app/wardrobe/actions");

    canUseFeatureLabels.mockResolvedValue(false);
    createGarmentSource.mockResolvedValue({
      sourceId: "11111111-1111-4111-8111-111111111111",
      storagePath: "user/pipeline-uploads/test-top.jpg"
    });
    createManualPhotoReviewDraft.mockResolvedValue(
      "22222222-2222-4222-8222-222222222222"
    );

    const formData = new FormData();
    formData.set("image", new File(["binary"], "test-top.jpg", { type: "image/jpeg" }));

    const result = await createPhotoDraftAction(
      { status: "idle", message: null },
      formData
    );

    expect(result.status).toBe("success");
    expect(result.nextPath).toBe("/wardrobe/review");
    expect(result.draftIds).toEqual(["22222222-2222-4222-8222-222222222222"]);
    expect(result.message).toContain("manually");
    expect(createManualPhotoReviewDraft).toHaveBeenCalledWith({
      sourceId: "11111111-1111-4111-8111-111111111111",
      fileName: "test-top.jpg"
    });
    expect(callPipelineService).not.toHaveBeenCalled();
  });
});
