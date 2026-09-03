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

describe("setSeasonalStorageAction", () => {
  it("stores a piece for the season", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, setGarmentSeasonalStorage: vi.fn(async () => {}) };
    });
    const { setSeasonalStorageAction } = await import("@/app/wardrobe/actions");
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("garment_id", "66666666-6666-6666-6666-666666666666");
    formData.set("stored", "true");

    const result = await setSeasonalStorageAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(setGarmentSeasonalStorage).toHaveBeenCalledWith(
      "66666666-6666-6666-6666-666666666666",
      true
    );
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });

  it("brings a piece back from seasonal storage", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, setGarmentSeasonalStorage: vi.fn(async () => {}) };
    });
    const { setSeasonalStorageAction } = await import("@/app/wardrobe/actions");
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("garment_id", "66666666-6666-6666-6666-666666666666");
    formData.set("stored", "false");

    const result = await setSeasonalStorageAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(setGarmentSeasonalStorage).toHaveBeenCalledWith(
      "66666666-6666-6666-6666-666666666666",
      false
    );
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});

describe("renameCollectionAction", () => {
  it("renames the collection", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, renameCollection: vi.fn(async () => {}) };
    });
    const { renameCollectionAction } = await import("@/app/wardrobe/actions");
    const { renameCollection } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("collection_id", "99999999-9999-9999-9999-999999999999");
    formData.set("name", "weekend capsule");

    const result = await renameCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(renameCollection).toHaveBeenCalledWith({
      collectionId: "99999999-9999-9999-9999-999999999999",
      name: "weekend capsule"
    });
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });

  it("rejects an empty name", async () => {
    const { renameCollectionAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("collection_id", "99999999-9999-9999-9999-999999999999");
    formData.set("name", "");

    const result = await renameCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
  });
});

describe("deleteCollectionAction", () => {
  it("deletes the collection and reports the pieces are unaffected", async () => {
    vi.resetModules();
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return { ...actual, deleteCollection: vi.fn(async () => {}) };
    });
    const { deleteCollectionAction } = await import("@/app/wardrobe/actions");
    const { deleteCollection } = await import("@/lib/domain/wardrobe/service");

    const formData = new FormData();
    formData.set("collection_id", "99999999-9999-9999-9999-999999999999");

    const result = await deleteCollectionAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(deleteCollection).toHaveBeenCalledWith("99999999-9999-9999-9999-999999999999");
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});
