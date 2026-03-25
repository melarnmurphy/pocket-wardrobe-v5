import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase mock -----------------------------------------------------------
const mockSingle = vi.fn();
const mockEqUser = vi.fn().mockReturnValue({ single: mockSingle });
const mockEqId = vi.fn().mockReturnValue({ eq: mockEqUser });
const mockSelectChain = vi.fn().mockReturnValue({ eq: mockEqId });

const mockUpdateEq2 = vi.fn().mockResolvedValue({ error: null });
const mockUpdateEq1 = vi.fn().mockReturnValue({ eq: mockUpdateEq2 });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq1 });

const mockGarmentSourcesEq2 = vi.fn().mockResolvedValue({ error: null });
const mockGarmentSourcesEq1 = vi.fn().mockReturnValue({ eq: mockGarmentSourcesEq2 });
const mockGarmentSourcesUpdate = vi.fn().mockReturnValue({ eq: mockGarmentSourcesEq1 });

const mockGarmentImagesInsert = vi.fn().mockResolvedValue({ error: null });

const mockFrom = vi.fn((table: string) => {
  if (table === "garment_drafts") {
    return {
      select: mockSelectChain,
      update: mockUpdate,
    };
  }
  if (table === "garment_sources") {
    return {
      update: mockGarmentSourcesUpdate,
    };
  }
  if (table === "garment_images") {
    return {
      insert: mockGarmentImagesInsert,
    };
  }
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// ---- createGarment mock — returns a garment with an id -------------------
const mockCreateGarment = vi.fn().mockResolvedValue({ id: "new-garment-uuid" });
vi.mock("@/lib/domain/wardrobe/service", () => ({
  createGarment: mockCreateGarment,
}));

// ---- Pending draft row -------------------------------------------------------
const pendingDraft = {
  id: "22222222-2222-4222-8222-222222222222",
  source_id: "src-uuid-1",
  status: "pending",
  draft_payload_json: {
    category: "shirt/blouse",
    colour: "blue",
    brand: "Test Brand",
    material: "cotton",
    style: "casual",
    tag: "blue cotton shirt",
    confidence: 0.87,
    retailer: "Test Retailer",
    purchase_price: 149,
    purchase_currency: "AUD",
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
    const result = await acceptDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.garmentId).toBe("new-garment-uuid");
    }

    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "shirt/blouse",
        title: "blue cotton shirt",
        brand: "Test Brand",
        retailer: "Test Retailer",
        purchase_price: 149,
        purchase_currency: "AUD",
      }),
      expect.objectContaining({ primaryColourFamily: "blue" })
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed" })
    );
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
    await acceptDraftAction("22222222-2222-4222-8222-222222222222");

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
    const result = await acceptDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("success");
    expect(mockCreateGarment).not.toHaveBeenCalled();
  });

  it("returns error when draft not found", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await acceptDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("error");
  });

  it("accepts edited retailer metadata from the review form", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");

    await acceptDraftAction({
      draftId: "22222222-2222-4222-8222-222222222222",
      title: "Edited blue cotton shirt",
      category: "shirt/blouse",
      colour: "blue",
      brand: "Edited Brand",
      material: "cotton",
      style: "smart casual",
      notes: "Keep for workwear",
      retailer: "Farfetch",
      purchase_price: 219,
      purchase_currency: "AUD",
    });

    expect(mockCreateGarment).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Edited blue cotton shirt",
        brand: "Edited Brand",
        retailer: "Farfetch",
        purchase_price: 219,
        purchase_currency: "AUD",
      }),
      expect.anything()
    );
  });

  it("links garment_sources to the created garment", async () => {
    const { acceptDraftAction } = await import("@/app/wardrobe/review/actions");
    await acceptDraftAction("22222222-2222-4222-8222-222222222222");

    expect(mockGarmentSourcesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ garment_id: "new-garment-uuid" })
    );
  });
});

describe("rejectDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { status: "pending" }, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq1 });
    mockUpdateEq1.mockReturnValue({ eq: mockUpdateEq2 });
    mockUpdateEq2.mockResolvedValue({ error: null });
  });

  it("marks draft as rejected", async () => {
    const { rejectDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await rejectDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("success");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "rejected" });
  });

  it("silently succeeds if draft is already actioned", async () => {
    mockSingle.mockResolvedValue({ data: { status: "confirmed" }, error: null });

    const { rejectDraftAction } = await import("@/app/wardrobe/review/actions");
    const result = await rejectDraftAction("22222222-2222-4222-8222-222222222222");

    expect(result.status).toBe("success");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
