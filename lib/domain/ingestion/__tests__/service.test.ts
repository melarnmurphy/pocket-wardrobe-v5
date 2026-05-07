import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PipelineAnalyzeResponse } from "@/lib/domain/ingestion";
import sharp from "sharp";

const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
const mockUpdateEqUser = vi.fn();
const mockUpdateEqId = vi.fn().mockReturnValue({ eq: mockUpdateEqUser });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEqId });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert, update: mockUpdate });
const mockSupabase = { from: mockFrom };

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockCreateSignedUrls = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  remove: mockStorageRemove,
  createSignedUrl: mockCreateSignedUrl,
  createSignedUrls: mockCreateSignedUrls,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    ...mockSupabase,
    storage: { from: mockStorageFrom },
  }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

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

describe("createDraftsFromPipelineResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { id: "draft-uuid-1" }, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEqId });
    mockUpdateEqId.mockReturnValue({ eq: mockUpdateEqUser });
    mockUpdateEqUser.mockResolvedValue({ error: null });
  });

  it("inserts one draft per detected garment and returns their IDs", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    const result: PipelineAnalyzeResponse = {
      garments: [validGarment, { ...validGarment, category: "pants", tag: "black denim pants" }],
    };

    const draftIds = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      result,
    });

    expect(mockFrom).toHaveBeenCalledWith("garment_drafts");
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(draftIds).toHaveLength(2);
  });

  it("crops detected garments when the source storage path is available", async () => {
    const image = await sharp({
      create: {
        width: 120,
        height: 160,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    }).jpeg().toBuffer();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => image.buffer.slice(
        image.byteOffset,
        image.byteOffset + image.byteLength
      )
    });
    vi.stubGlobal("fetch", mockFetch);
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed.example/source.jpg" },
      error: null
    });
    mockStorageUpload.mockResolvedValue({ error: null });

    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      storagePath: "user-uuid-123/pipeline-uploads/outfit.jpg",
      result: { garments: [validGarment] },
    });

    expect(mockStorageFrom).toHaveBeenCalledWith("garment-originals");
    expect(mockStorageFrom).toHaveBeenCalledWith("garment-cutouts");
    expect(mockStorageUpload).toHaveBeenCalledWith(
      "user-uuid-123/draft-crops/source-uuid-abc/draft-uuid-1.jpg",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: true })
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      draft_payload_json: expect.objectContaining({
        crop_path: "user-uuid-123/draft-crops/source-uuid-abc/draft-uuid-1.jpg",
        crop_width: 90,
        crop_height: 140
      })
    });

    vi.unstubAllGlobals();
  });

  it("returns empty array when no garments detected", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    const draftIds = await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      result: { garments: [] },
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(draftIds).toEqual([]);
  });

  it("updates garment_sources to outfit_decomposition when 2+ garments are detected", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    mockSingle
      .mockResolvedValueOnce({ data: { id: "draft-uuid-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: "draft-uuid-2" }, error: null });

    const result: PipelineAnalyzeResponse = {
      garments: [
        validGarment,
        { ...validGarment, category: "pants", tag: "black denim pants" }
      ]
    };

    await createDraftsFromPipelineResult({ sourceId: "source-uuid-abc", result });

    const garmentSourcesCalls = (mockFrom as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[0] === "garment_sources"
    );
    expect(garmentSourcesCalls).toHaveLength(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: "outfit_decomposition" })
    );

    const firstInsertPayload = (mockInsert.mock.calls[0][0] as { draft_payload_json: { source_type: string } });
    expect(firstInsertPayload.draft_payload_json.source_type).toBe("outfit_decomposition");
  });

  it("does not update garment_sources when a single garment is detected", async () => {
    const { createDraftsFromPipelineResult } = await import(
      "@/lib/domain/ingestion/service"
    );

    await createDraftsFromPipelineResult({
      sourceId: "source-uuid-abc",
      result: { garments: [validGarment] }
    });

    const garmentSourcesCalls = (mockFrom as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => args[0] === "garment_sources"
    );
    expect(garmentSourcesCalls).toHaveLength(0);
  });
});

// ---- createGarmentSource tests -------------------------------------------

describe("createGarmentSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageRemove.mockResolvedValue({});
    mockSingle.mockResolvedValue({ data: { id: "source-uuid-xyz" }, error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
  });

  it("uploads file, inserts garment_source with garment_id null, returns sourceId and storagePath", async () => {
    const { createGarmentSource } = await import(
      "@/lib/domain/ingestion/service"
    );
    const file = new File(["data"], "outfit.jpg", { type: "image/jpeg" });

    const result = await createGarmentSource({ file, width: 1200, height: 1600 });

    expect(mockStorageFrom).toHaveBeenCalledWith("garment-originals");
    expect(mockStorageUpload).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("garment_sources");

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.garment_id).toBeNull();
    expect(insertCall.source_type).toBe("direct_upload");
    expect(insertCall.source_metadata_json).toEqual(
      expect.objectContaining({ width: 1200, height: 1600 })
    );

    expect(result.sourceId).toBe("source-uuid-xyz");
    expect(typeof result.storagePath).toBe("string");
  });

  it("removes uploaded file if garment_source insert fails", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "insert failed" } });

    const { createGarmentSource } = await import(
      "@/lib/domain/ingestion/service"
    );
    const file = new File(["data"], "outfit.jpg", { type: "image/jpeg" });

    await expect(createGarmentSource({ file })).rejects.toThrow("insert failed");
    expect(mockStorageRemove).toHaveBeenCalled();
  });

  it("throws immediately if storage upload fails, without inserting DB row", async () => {
    mockStorageUpload.mockResolvedValue({ error: { message: "upload failed" } });

    const { createGarmentSource } = await import(
      "@/lib/domain/ingestion/service"
    );
    const file = new File(["data"], "outfit.jpg", { type: "image/jpeg" });

    await expect(createGarmentSource({ file })).rejects.toThrow("upload failed");
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ---- listPendingDrafts tests -----------------------------------------------

describe("listPendingDrafts", () => {
  const draftRows = [
    {
      id: "draft-1",
      source_id: "src-1",
      confidence: 0.87,
      garment_sources: null,
      draft_payload_json: {
        category: "shirt/blouse",
        colour: "navy",
        material: "cotton",
        style: "casual",
        tag: "navy cotton shirt",
        confidence: 0.87,
      },
    },
    {
      id: "draft-2",
      source_id: "src-1",
      confidence: 0.51,
      garment_sources: null,
      draft_payload_json: {
        category: "pants",
        colour: "black",
        material: null,
        style: "casual",
        tag: "black denim pants",
        confidence: 0.51,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const mockOrderResult = vi.fn().mockResolvedValue({ data: draftRows, error: null });
    const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrderResult });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqStatus });
    const mockSelectDrafts = vi.fn().mockReturnValue({ eq: mockEqUser });

    mockFrom.mockReturnValue({ select: mockSelectDrafts });
  });

  it("returns pending drafts with parsed payload", async () => {
    const { listPendingDrafts } = await import(
      "@/lib/domain/ingestion/service"
    );
    const drafts = await listPendingDrafts();

    expect(drafts).toHaveLength(2);
    expect(drafts[0].id).toBe("draft-1");
    expect(drafts[0].payload.category).toBe("shirt/blouse");
    expect(drafts[0].payload.colour).toBe("navy");
    expect(drafts[0].preview_url).toBeNull();
    expect(drafts[0].preview_kind).toBeNull();
    expect(drafts[1].payload.material).toBeNull();
  });

  it("returns empty array when no pending drafts", async () => {
    const mockOrderResult = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEqStatus = vi.fn().mockReturnValue({ order: mockOrderResult });
    const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqStatus });
    const mockSelectDrafts = vi.fn().mockReturnValue({ eq: mockEqUser });
    mockFrom.mockReturnValue({ select: mockSelectDrafts });

    const { listPendingDrafts } = await import(
      "@/lib/domain/ingestion/service"
    );
    const drafts = await listPendingDrafts();
    expect(drafts).toEqual([]);
  });
});
