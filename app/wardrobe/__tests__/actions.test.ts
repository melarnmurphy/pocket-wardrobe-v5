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
    const createProductUrlSourceSpy = vi.fn(async () => ({
      sourceId: "00000000-0000-0000-0000-0000000000aa"
    }));
    vi.doMock("@/lib/domain/ingestion/service", async () => {
      const actual = await vi.importActual("@/lib/domain/ingestion/service");
      return {
        ...actual,
        createProductUrlSource: createProductUrlSourceSpy
      };
    });
    const { createProductUrlDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("product_url", "https://example.com/dead-product");

    const result = await createProductUrlDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("dead_url");
    // Regression: a dead link must never leave an orphan garment_sources row —
    // the source is only created once extraction has succeeded.
    expect(createProductUrlSourceSpy).not.toHaveBeenCalled();
    vi.doUnmock("@/lib/domain/ingestion/extractors");
    vi.doUnmock("@/lib/domain/ingestion/service");
  });
});

describe("createReceiptDraftAction price matching", () => {
  it("attaches price match candidates to the draft when two or more existing pieces match", async () => {
    vi.resetModules();
    // vi.spyOn on the already-resolved module's own exports, rather than
    // vi.doMock's module-registry interception: "@/lib/domain/wardrobe/service"
    // is also imported for real (via its own mocked dependencies) by the
    // sibling price-match-candidates test file, and registry-level doMock of
    // that same specifier from two files raced intermittently when both
    // suites ran in the same worker. Patching the resolved export in place
    // sidesteps the registry entirely, so it can't collide.
    const wardrobeService = await import("@/lib/domain/wardrobe/service");
    const ingestionService = await import("@/lib/domain/ingestion/service");

    const findGarmentPriceMatchCandidatesSpy = vi
      .spyOn(wardrobeService, "findGarmentPriceMatchCandidates")
      .mockResolvedValue([
        { garment_id: "cccccccc-cccc-cccc-cccc-cccccccccccc", title: "Navy blazer", category: "blazer" },
        { garment_id: "dddddddd-dddd-dddd-dddd-dddddddddddd", title: "Wool blazer", category: "blazer" }
      ]);
    const createReceiptSourceSpy = vi
      .spyOn(ingestionService, "createReceiptSource")
      .mockResolvedValue({
        sourceId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        storagePath: "user/receipt-uploads/receipt.jpg"
      });
    const createManualReviewDraftSpy = vi
      .spyOn(ingestionService, "createManualReviewDraft")
      .mockResolvedValue("ffffffff-ffff-ffff-ffff-ffffffffffff");
    const attachPriceMatchCandidates = vi
      .spyOn(ingestionService, "attachPriceMatchCandidates")
      .mockResolvedValue(undefined);

    const { createReceiptDraftAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    // Named ".pdf" with a text/plain type so isPdf's filename check lets it
    // past the image-only upload-type gate, and readReceiptTextFromFile's own
    // type check treats it as text-readable — giving it a non-null fileText
    // and so skipping the receipt-OCR fallback (which would otherwise need
    // getServerEnv()'s real, here-unset PIPELINE_SERVICE_URL) entirely.
    formData.set(
      "receipt",
      new File(["Blazer $89.00"], "receipt.pdf", { type: "text/plain" })
    );
    formData.set("receipt_text", "Blazer $89.00");

    const result = await createReceiptDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(attachPriceMatchCandidates).toHaveBeenCalled();

    findGarmentPriceMatchCandidatesSpy.mockRestore();
    createReceiptSourceSpy.mockRestore();
    createManualReviewDraftSpy.mockRestore();
    attachPriceMatchCandidates.mockRestore();
  });

  it("never offers the price-match resolver for a candidate with no price", async () => {
    vi.resetModules();
    const wardrobeService = await import("@/lib/domain/wardrobe/service");
    const ingestionService = await import("@/lib/domain/ingestion/service");

    const findGarmentPriceMatchCandidatesSpy = vi
      .spyOn(wardrobeService, "findGarmentPriceMatchCandidates")
      .mockResolvedValue([
        { garment_id: "cccccccc-cccc-cccc-cccc-cccccccccccc", title: "Navy blazer", category: "blazer" },
        { garment_id: "dddddddd-dddd-dddd-dddd-dddddddddddd", title: "Wool blazer", category: "blazer" }
      ]);
    const createReceiptSourceSpy = vi
      .spyOn(ingestionService, "createReceiptSource")
      .mockResolvedValue({
        sourceId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        storagePath: "user/receipt-uploads/receipt.jpg"
      });
    const createManualReviewDraftSpy = vi
      .spyOn(ingestionService, "createManualReviewDraft")
      .mockResolvedValue("ffffffff-ffff-ffff-ffff-ffffffffffff");
    const attachPriceMatchCandidates = vi
      .spyOn(ingestionService, "attachPriceMatchCandidates")
      .mockResolvedValue(undefined);

    const { createReceiptDraftAction } = await import("@/app/wardrobe/actions");

    const formData = new FormData();
    // No price in the receipt text, so the candidate's draft has no purchase
    // price — the resolver sheet must not be offered for it (there is
    // nothing for resolveReceiptMatchAction to attach a price to).
    formData.set(
      "receipt",
      new File(["Blazer"], "receipt.pdf", { type: "text/plain" })
    );
    formData.set("receipt_text", "Blazer");

    const result = await createReceiptDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(findGarmentPriceMatchCandidatesSpy).not.toHaveBeenCalled();
    expect(attachPriceMatchCandidates).not.toHaveBeenCalled();

    findGarmentPriceMatchCandidatesSpy.mockRestore();
    createReceiptSourceSpy.mockRestore();
    createManualReviewDraftSpy.mockRestore();
    attachPriceMatchCandidates.mockRestore();
  });
});

describe("createReceiptDraftAction size cap", () => {
  it("rejects a file over 20MB even when it is renamed to end in .pdf", async () => {
    const { createReceiptDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    // A PDF-named file skips the format allowlist check, but the size cap
    // must still apply unconditionally.
    formData.set("receipt", fileOfType("application/pdf", 21 * 1024 * 1024, "receipt.pdf"));

    const result = await createReceiptDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("too_large");
  });
});
