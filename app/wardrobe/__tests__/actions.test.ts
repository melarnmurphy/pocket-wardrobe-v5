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
