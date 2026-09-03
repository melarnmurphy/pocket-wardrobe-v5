import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

const singleMock = vi.fn();
const draftUpdateEqMock = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }));
const fromMock = vi.fn((table: string) => {
  if (table === "garment_drafts") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }),
      update: () => ({ eq: draftUpdateEqMock })
    };
  }
  return { update: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));

describe("resolveReceiptMatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleMock.mockResolvedValue({
      data: {
        id: "draft-1",
        status: "pending",
        draft_payload_json: { purchase_price: 89, purchase_currency: "AUD" }
      },
      error: null
    });
  });

  it("attaches the draft's price to the chosen garment and rejects the draft", async () => {
    vi.doMock("@/lib/domain/wardrobe/service", () => ({
      setGarmentPriceManually: vi.fn(async () => {})
    }));
    const { resolveReceiptMatchAction } = await import("@/app/wardrobe/review/actions");
    const { setGarmentPriceManually } = await import("@/lib/domain/wardrobe/service");

    const result = await resolveReceiptMatchAction(
      "draft-1",
      "cccccccc-cccc-cccc-cccc-cccccccccccc"
    );

    expect(result.status).toBe("success");
    expect(setGarmentPriceManually).toHaveBeenCalledWith(
      expect.objectContaining({
        garmentId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        priceCents: 8900,
        priceSource: "receipt"
      })
    );
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});
