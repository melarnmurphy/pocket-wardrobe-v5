import { describe, it, expect, vi, beforeEach } from "vitest";

const limitMock = vi.fn();
const orMock = vi.fn(() => ({ limit: limitMock }));
const eqCategoryMock = vi.fn(() => ({ or: orMock }));
const isMock = vi.fn(() => ({ eq: eqCategoryMock, or: orMock }));
const eqUserMock = vi.fn(() => ({ is: isMock }));
const selectMock = vi.fn(() => ({ eq: eqUserMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("findGarmentPriceMatchCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue({
      data: [
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Navy blazer", category: "blazer" },
        { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Wool blazer", category: "blazer" }
      ],
      error: null
    });
  });

  it("returns matching garments as candidates", async () => {
    const { findGarmentPriceMatchCandidates } = await import("@/lib/domain/wardrobe/service");
    const result = await findGarmentPriceMatchCandidates({ title: "Blazer", category: "blazer" });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ garment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Navy blazer", category: "blazer" });
  });

  it("returns an empty array when the title has no usable words", async () => {
    const { findGarmentPriceMatchCandidates } = await import("@/lib/domain/wardrobe/service");
    const result = await findGarmentPriceMatchCandidates({ title: "  " });

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
