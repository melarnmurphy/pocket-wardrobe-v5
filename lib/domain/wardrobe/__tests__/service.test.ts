import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- minimal Supabase mock ------------------------------------------------
// The chained Supabase query builder is mocked per-table.
// Count queries resolve directly from the chain terminus (.eq / .gt).
// The select-with-join query resolves from .limit().

const mockCountResult = (count: number) =>
  vi.fn().mockResolvedValue({ count, error: null });

// Separate builders per table so we can return different counts.
let garmentCountBuilder: ReturnType<typeof vi.fn>;
let recentGarmentsBuilder: ReturnType<typeof vi.fn>;
let draftsCountBuilder: ReturnType<typeof vi.fn>;

// currentBuilder is set by each describe block's beforeEach so that mockFrom
// routes "garments" calls to the right builder for the active test suite.
let currentBuilder: (() => unknown) | null = null;

// Captured spy for .limit so individual tests can assert on the call value.
let limitSpy: ReturnType<typeof vi.fn>;

const mockFrom = vi.fn((table: string) => {
  if (table === "garment_drafts") return (draftsCountBuilder as () => unknown)();
  if (table === "garments") return currentBuilder!();
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom, storage: { from: vi.fn() } }),
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-uuid-123" }),
}));

describe("getDashboardStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Garments table: first call = total count, second call = favourites count
    let garmentCallCount = 0;
    garmentCountBuilder = vi.fn(() => {
      garmentCallCount++;
      const selectResult =
        garmentCallCount === 1
          ? { eq: vi.fn().mockReturnValue({ is: mockCountResult(42) }) }
          : {
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  gt: mockCountResult(8),
                }),
              }),
            };
      return { select: vi.fn().mockReturnValue(selectResult) };
    });

    draftsCountBuilder = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: mockCountResult(3),
        }),
      }),
    }));

    currentBuilder = () => (garmentCountBuilder as () => unknown)();
  });

  it("returns garment count, favourites count, and pending draft count", async () => {
    const { getDashboardStats } = await import("@/lib/domain/wardrobe/service");
    const stats = await getDashboardStats();
    expect(stats.garmentCount).toBe(42);
    expect(stats.favouritesCount).toBe(8);
    expect(stats.pendingDraftsCount).toBe(3);
  });

  it("returns zero counts when queries return null", async () => {
    let garmentCallCount = 0;
    garmentCountBuilder = vi.fn(() => {
      garmentCallCount++;
      const selectResult =
        garmentCallCount === 1
          ? { eq: vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ count: null, error: null }) }) }
          : {
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({ count: null, error: null }),
                }),
              }),
            };
      return { select: vi.fn().mockReturnValue(selectResult) };
    });
    draftsCountBuilder = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: null, error: null }),
        }),
      }),
    }));

    const { getDashboardStats } = await import("@/lib/domain/wardrobe/service");
    const stats = await getDashboardStats();
    expect(stats.garmentCount).toBe(0);
    expect(stats.favouritesCount).toBe(0);
    expect(stats.pendingDraftsCount).toBe(0);
  });
});

describe("getRecentGarments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    const rows = [
      { id: "g1", title: "Navy shirt", category: "shirt/blouse", garment_images: [{ storage_path: "user/g1/img.jpg" }] },
      { id: "g2", title: null, category: "pants", garment_images: [] },
    ];

    limitSpy = vi.fn().mockResolvedValue({ data: rows, error: null });

    recentGarmentsBuilder = vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: limitSpy,
            }),
          }),
        }),
      }),
    }));

    draftsCountBuilder = vi.fn(() => ({ select: vi.fn() }));

    currentBuilder = () => (recentGarmentsBuilder as () => unknown)();
  });

  it("returns garments with storagePath from first image", async () => {
    const { getRecentGarments } = await import("@/lib/domain/wardrobe/service");
    const result = await getRecentGarments(6);
    expect(result).toHaveLength(2);
    expect(result[0].storagePath).toBe("user/g1/img.jpg");
    expect(result[1].storagePath).toBeNull();
  });

  it("limits to requested count", async () => {
    const { getRecentGarments } = await import("@/lib/domain/wardrobe/service");
    await getRecentGarments(3);
    expect(limitSpy).toHaveBeenCalledWith(3);
  });
});

describe("countWardrobeGarments", () => {
  let eqSpy: ReturnType<typeof vi.fn>;
  let firstIsSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    draftsCountBuilder = vi.fn(() => ({ select: vi.fn() }));

    const countGarmentsBuilder = vi.fn(() => {
      const secondIs = mockCountResult(7);
      firstIsSpy = vi.fn().mockReturnValue({ is: secondIs });
      eqSpy = vi.fn().mockReturnValue({ is: firstIsSpy });
      return { select: vi.fn().mockReturnValue({ eq: eqSpy }) };
    });

    currentBuilder = () => (countGarmentsBuilder as () => unknown)();
  });

  it("does a count-only query filtered to the user's active garments", async () => {
    const { countWardrobeGarments } = await import("@/lib/domain/wardrobe/service");
    const count = await countWardrobeGarments();

    expect(count).toBe(7);
    expect(eqSpy).toHaveBeenCalledWith("user_id", "user-uuid-123");
    expect(firstIsSpy).toHaveBeenCalledWith("archived_at", null);
  });

  it("returns zero when the count comes back null", async () => {
    const nullCountBuilder = vi.fn(() => {
      const secondIs = vi.fn().mockResolvedValue({ count: null, error: null });
      const firstIs = vi.fn().mockReturnValue({ is: secondIs });
      const eq = vi.fn().mockReturnValue({ is: firstIs });
      return { select: vi.fn().mockReturnValue({ eq }) };
    });
    currentBuilder = () => (nullCountBuilder as () => unknown)();

    const { countWardrobeGarments } = await import("@/lib/domain/wardrobe/service");
    const count = await countWardrobeGarments();

    expect(count).toBe(0);
  });
});
