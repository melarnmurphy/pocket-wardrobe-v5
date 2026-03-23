import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock -----------------------------------------------------------
const mockSingle = vi.fn();
const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
const mockSelectChain = vi.fn().mockReturnValue({ eq: mockEqId });

const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null });
const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq1 });

const mockFrom = vi.fn((table: string) => {
  if (table === "garment_drafts") {
    return {
      select: mockSelectChain,
      update: mockUpdate,
    };
  }
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ---- createGarment mock — returns a garment with an id -------------------
const mockCreateGarment = vi.fn().mockResolvedValue({ id: "new-garment-uuid" });
vi.mock("@/lib/domain/wardrobe/service", () => ({
  createGarment: mockCreateGarment,
}));

// ---- Pending draft row -------------------------------------------------------
const pendingDraft = {
  id: "draft-uuid-1",
  status: "pending",
  draft_payload_json: {
    category: "shirt/blouse",
    colour: "blue",
    material: "cotton",
    style: "casual",
    tag: "blue cotton shirt",
    confidence: 0.87,
  },
};

describe("acceptDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: pendingDraft, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
    mockCreateGarment.mockResolvedValue({ id: "new-garment-uuid" });
  });

  it("creates a garment from draft payload and marks draft confirmed", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("draft-uuid-1");

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.garmentId).toBe("new-garment-uuid");
    }

    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.objectContaining({ category: "shirt/blouse", title: "blue cotton shirt" }),
      expect.objectContaining({ primaryColourFamily: "blue" })
    );

    expect(mockUpdate).toHaveBeenCalledWith({ status: "confirmed" });
  });

  it("passes null primaryColourFamily for non-canonical colours like 'navy'", async () => {
    mockSingle.mockResolvedValue({
      data: {
        ...pendingDraft,
        draft_payload_json: { ...pendingDraft.draft_payload_json, colour: "navy" },
      },
      error: null,
    });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    await acceptDraftAction("draft-uuid-1");

    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ primaryColourFamily: null })
    );
  });

  it("silently skips draft that is already actioned (stale page guard)", async () => {
    mockSingle.mockResolvedValue({
      data: { ...pendingDraft, status: "confirmed" },
      error: null,
    });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("draft-uuid-1");

    expect(result.status).toBe("success");
    expect(mockCreateGarment).not.toHaveBeenCalled();
  });

  it("returns error when draft not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("draft-uuid-1");

    expect(result.status).toBe("error");
  });
});

describe("rejectDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
  });

  it("marks draft as rejected", async () => {
    const { rejectDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await rejectDraftAction("draft-uuid-1");

    expect(result.status).toBe("success");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "rejected" });
  });
});
