import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequiredUser = vi.fn();
const single = vi.fn();
const select = vi.fn(() => ({ single }));
const insert = vi.fn(() => ({ select }));
const garmentSelectSingle = vi.fn();
const garmentSelectEqUserId = vi.fn(() => ({ single: garmentSelectSingle }));
const garmentSelectEqId = vi.fn(() => ({ eq: garmentSelectEqUserId }));
const garmentSelect = vi.fn(() => ({ eq: garmentSelectEqId }));
const from = vi.fn((table: string) => {
  if (table === "wear_events") {
    return { insert };
  }

  if (table === "garments") {
    return { select: garmentSelect };
  }

  throw new Error(`Unexpected table ${table}`);
});

vi.mock("@/lib/auth", () => ({
  getRequiredUser
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from })
}));

describe("logWearEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getRequiredUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    single.mockResolvedValue({
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        user_id: "11111111-1111-4111-8111-111111111111",
        garment_id: "22222222-2222-4222-8222-222222222222",
        worn_at: "2026-03-26T10:00:00.000Z",
        occasion: null,
        notes: null,
        outfit_id: null,
        created_at: "2026-03-26T10:00:00.000Z"
      },
      error: null
    });
  });

  it("only writes a wear_events row — wear_count/last_worn_at/cost_per_wear come from the DB trigger, never a manual write", async () => {
    const { logWearEvent } = await import("@/lib/domain/wear-events/service");

    const result = await logWearEvent({
      garment_id: "22222222-2222-4222-8222-222222222222",
      worn_at: "2026-03-26T10:00:00.000Z"
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        garment_id: "22222222-2222-4222-8222-222222222222",
        worn_at: "2026-03-26T10:00:00.000Z"
      })
    );
    // garments is never touched directly by logWearEvent — the
    // sync_garment_wear_stats_from_events() trigger owns wear_count,
    // last_worn_at and cost_per_wear.
    expect(from).not.toHaveBeenCalledWith("garments");
    expect(result.id).toBe("33333333-3333-4333-8333-333333333333");
  });
});

describe("incrementWearCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getRequiredUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    insert.mockResolvedValue({ error: null });
    garmentSelectSingle.mockResolvedValue({
      data: { wear_count: 3, last_worn_at: "2026-03-26T00:00:00.000Z", cost_per_wear: 130 },
      error: null
    });
  });

  it("inserts one wear_events row per wear, backdated a day apart, never a direct wear_count write", async () => {
    const { incrementWearCount } = await import("@/lib/domain/wear-events/service");

    await incrementWearCount({
      garmentId: "22222222-2222-4222-8222-222222222222",
      wearsToAdd: 3,
      wornAt: "2026-03-26T10:00:00.000Z"
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0] as Array<{ worn_at: string }>;
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.worn_at)).size).toBe(3);
  });
});
