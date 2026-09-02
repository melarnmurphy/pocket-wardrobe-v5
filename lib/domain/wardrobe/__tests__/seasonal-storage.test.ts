import { describe, it, expect, vi, beforeEach } from "vitest";

const eqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ update: updateMock, eq: eqMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("setGarmentSeasonalStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ eq: eqMock, error: null });
  });

  it("sets seasonally_stored_at to a timestamp when storing", async () => {
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");
    await setGarmentSeasonalStorage("22222222-2222-2222-2222-222222222222", true);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonally_stored_at: expect.any(String) })
    );
  });

  it("clears seasonally_stored_at back to null when un-storing", async () => {
    const { setGarmentSeasonalStorage } = await import("@/lib/domain/wardrobe/service");
    await setGarmentSeasonalStorage("22222222-2222-2222-2222-222222222222", false);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ seasonally_stored_at: null })
    );
  });
});
