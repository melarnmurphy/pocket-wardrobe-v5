import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("analyzePipelineAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success with draftIds on successful pipeline call", async () => {
    const { analyzePipelineAction } = await import("@/app/wardrobe/actions");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draftIds: ["draft-1", "draft-2"], garmentCount: 2 }),
    });

    const formData = new FormData();
    formData.set("source_id", "00000000-0000-0000-0000-000000000001");

    const result = await analyzePipelineAction(
      { status: "idle", message: null },
      formData
    );

    expect(result.status).toBe("success");
    expect(result.draftIds).toEqual(["draft-1", "draft-2"]);
    expect(result.message).toContain("2 garments detected");
  });

  it("returns error if source_id is missing", async () => {
    const { analyzePipelineAction } = await import("@/app/wardrobe/actions");

    const result = await analyzePipelineAction(
      { status: "idle", message: null },
      new FormData()
    );

    expect(result.status).toBe("error");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns error if pipeline responds non-ok", async () => {
    const { analyzePipelineAction } = await import("@/app/wardrobe/actions");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal error" }),
    });

    const formData = new FormData();
    formData.set("source_id", "00000000-0000-0000-0000-000000000001");

    const result = await analyzePipelineAction(
      { status: "idle", message: null },
      formData
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("Internal error");
  });

  it("surfaces premium gating errors from the analysis API", async () => {
    const { analyzePipelineAction } = await import("@/app/wardrobe/actions");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error:
          "Automatic photo feature labelling is a Premium feature. You can still upload the photo and fill in the garment details manually."
      }),
    });

    const formData = new FormData();
    formData.set("source_id", "00000000-0000-0000-0000-000000000001");

    const result = await analyzePipelineAction(
      { status: "idle", message: null },
      formData
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("Premium feature");
  });
});

describe("deleteGarmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status 'blocked' instead of deleting when the piece is used elsewhere", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return {
        ...actual,
        getGarmentUsageBlockers: vi.fn(async () => ({ activeOutfitCount: 2, activeListingId: null })),
        deleteGarment: vi.fn()
      };
    });
    const { deleteGarmentAction } = await import("@/app/wardrobe/actions");
    const { deleteGarment } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("garment_id", "33333333-3333-3333-3333-333333333333");

    const result = await deleteGarmentAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("blocked");
    expect(result.blocked?.activeOutfitCount).toBe(2);
    expect(deleteGarment).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});

describe("bulkDeleteGarmentsAction", () => {
  it("deletes every garment id it is given and reports the count", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return {
        ...actual,
        getGarmentUsageBlockers: vi.fn(async () => ({ activeOutfitCount: 0, activeListingId: null })),
        deleteGarment: vi.fn(async () => {})
      };
    });
    const { bulkDeleteGarmentsAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    formData.append("garment_id", "44444444-4444-4444-4444-444444444444");
    formData.append("garment_id", "55555555-5555-5555-5555-555555555555");

    const result = await bulkDeleteGarmentsAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(result.message).toContain("2");
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});

describe("createCollectionAction", () => {
  it("creates a collection with the given name and garment ids", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, createCollection: vi.fn(async () => ({ id: "collection-1" })) };
    });
    const { createCollectionAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    formData.set("name", "Capsule");
    formData.append("garment_id", "88888888-8888-8888-8888-888888888888");

    const result = await createCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });

  it("rejects an empty name", async () => {
    const { createCollectionAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("name", "");

    const result = await createCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
  });
});

function fileOfType(type: string, size: number, name = "photo") {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("createPhotoDraftAction validation", () => {
  it("rejects a HEIC file before attempting to upload it", async () => {
    const { createPhotoDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("image", fileOfType("image/heic", 1000));

    const result = await createPhotoDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("unsupported_format");
  });

  it("rejects a file over the size cap", async () => {
    const { createPhotoDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("image", fileOfType("image/jpeg", 21 * 1024 * 1024));

    const result = await createPhotoDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("too_large");
  });
});

describe("addGarmentImageAction validation", () => {
  it("rejects a HEIC file before attempting to upload it", async () => {
    const { addGarmentImageAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("garment_id", "00000000-0000-0000-0000-000000000001");
    formData.set("image", fileOfType("image/heic", 1000));

    const result = await addGarmentImageAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("unsupported_format");
  });
});

describe("createReceiptDraftAction validation", () => {
  it("rejects an unsupported receipt file type", async () => {
    const { createReceiptDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("receipt", fileOfType("image/heic", 1000, "receipt"));

    const result = await createReceiptDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("unsupported_format");
  });
});

describe("createProductUrlDraftAction dead link handling", () => {
  it("returns a dead_url error instead of creating a draft when the fetch failed", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/ingestion/extractors", async () => {
      const actual = await vi.importActual("@/lib/domain/ingestion/extractors");
      return {
        ...actual,
        extractProductMetadataFromUrl: vi.fn(async () => ({
          title: null, brand: null, category: null, colour: null, fit: null,
          material: null, retailer: "example.com", description: null, price: null,
          currency: null, image_url: null, attributes: [], styling_suggestions: [],
          fetch_failed: true
        }))
      };
    });
    // createProductUrlSource hits Supabase; stub just that export so this test
    // stays hermetic and exercises the fetch_failed branch deterministically.
    vi.doMock("@/lib/domain/ingestion/service", async () => {
      const actual = await vi.importActual("@/lib/domain/ingestion/service");
      return {
        ...actual,
        createProductUrlSource: vi.fn(async () => ({ sourceId: "00000000-0000-0000-0000-0000000000aa" }))
      };
    });
    const { createProductUrlDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("product_url", "https://example.com/dead-product");

    const result = await createProductUrlDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("dead_url");
    vi.doUnmock("@/lib/domain/ingestion/extractors");
    vi.doUnmock("@/lib/domain/ingestion/service");
  });
});
