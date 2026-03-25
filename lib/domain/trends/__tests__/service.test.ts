import { describe, it, expect, vi, beforeEach } from "vitest";

const FRESH_TIMESTAMP = new Date().toISOString();
const STALE_TIMESTAMP = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago

const UUID_M1 = "11111111-1111-1111-1111-111111111111";
const UUID_U1 = "22222222-2222-2222-2222-222222222222";
const UUID_S1 = "33333333-3333-3333-3333-333333333333";

// Mock supabase with configurable responses
const mockSupabaseChain = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  in: vi.fn(),
  upsert: vi.fn()
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabaseChain)
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({ id: "user-1" })
}));

vi.mock("@/lib/domain/wardrobe/service", () => ({
  listWardrobeGarments: vi.fn().mockResolvedValue([])
}));

vi.mock("../matching", () => ({
  computeUserTrendMatches: vi.fn().mockReturnValue([])
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserTrendMatches staleness gate", () => {
  it("returns cached matches when last match is within 24 hours", async () => {
    const cachedMatch = {
      id: UUID_M1,
      user_id: UUID_U1,
      trend_signal_id: UUID_S1,
      match_type: "exact_match",
      score: 0.9,
      reasoning_json: {},
      created_at: FRESH_TIMESTAMP
    };

    // from("user_trend_matches") — staleness check (fresh)
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { created_at: FRESH_TIMESTAMP }, error: null }) }) }) }) })
    });

    // from("user_trend_matches") — return cached matches
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [cachedMatch], error: null }) }) })
    });

    const { getUserTrendMatches } = await import("../service");
    const { listWardrobeGarments } = await import("@/lib/domain/wardrobe/service");

    const result = await getUserTrendMatches(UUID_U1);

    // Should NOT call listWardrobeGarments — used cached path
    expect(listWardrobeGarments).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].match_type).toBe("exact_match");
  });

  it("runs fresh matching when last match is older than 24 hours", async () => {
    // from("user_trend_matches") — staleness check (stale)
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { created_at: STALE_TIMESTAMP }, error: null }) }) }) }) })
    });

    // from("colours") — getCompatibleColourFamilies fires before getTrendSignals
    // because it receives supabase directly (no createClient await)
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], error: null })
    });

    // from("trend_signals") — getTrendSignals (resumes after createClient microtask)
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
    });

    // from("colour_relationships") — getCompatibleColourFamilies after colours resolves
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ in: () => Promise.resolve({ data: [], error: null }) })
    });

    // upsert not called — matches is empty, upsertUserTrendMatches returns early

    const { getUserTrendMatches } = await import("../service");
    const { listWardrobeGarments } = await import("@/lib/domain/wardrobe/service");

    await getUserTrendMatches(UUID_U1);

    // Should call listWardrobeGarments — triggered fresh matching
    expect(listWardrobeGarments).toHaveBeenCalled();
  });

  it("runs fresh matching when user has no existing matches (first run)", async () => {
    // from("user_trend_matches") — no existing matches
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) })
    });

    // from("colours") — getCompatibleColourFamilies fires first
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => Promise.resolve({ data: [], error: null })
    });

    // from("trend_signals") — getTrendSignals
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ order: () => Promise.resolve({ data: [], error: null }) })
    });

    // from("colour_relationships")
    mockSupabaseChain.from.mockReturnValueOnce({
      select: () => ({ in: () => Promise.resolve({ data: [], error: null }) })
    });

    const { getUserTrendMatches } = await import("../service");
    const { listWardrobeGarments } = await import("@/lib/domain/wardrobe/service");

    await getUserTrendMatches(UUID_U1);

    expect(listWardrobeGarments).toHaveBeenCalled();
  });
});
