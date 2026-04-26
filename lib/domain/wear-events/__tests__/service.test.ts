import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequiredUser = vi.fn();
const single = vi.fn();
const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
const garmentSelectSingle = vi.fn();
const garmentUpdateEqUserId = vi.fn();
const garmentUpdateEqId = vi.fn(() => ({ eq: garmentUpdateEqUserId }));
const garmentUpdate = vi.fn(() => ({ eq: garmentUpdateEqId }));
const garmentSelectEqUserId = vi.fn(() => ({ single: garmentSelectSingle }));
const garmentSelectEqId = vi.fn(() => ({ eq: garmentSelectEqUserId }));
const garmentSelect = vi.fn(() => ({ eq: garmentSelectEqId }));
const from = vi.fn((table: string) => {
  if (table === "wear_events") {
    return { insert };
  }

  if (table === "garments") {
    return {
      select: garmentSelect,
      update: garmentUpdate
    };
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
    garmentSelectSingle.mockResolvedValue({
      data: {
        id: "22222222-2222-4222-8222-222222222222",
        wear_count: 0,
        purchase_price: 390,
        last_worn_at: null
      },
      error: null
    });
    garmentUpdateEqUserId.mockResolvedValue({ error: null });
  });

  it("recalculates wear_count, last_worn_at, and cost_per_wear after logging a wear", async () => {
    const { logWearEvent } = await import("@/lib/domain/wear-events/service");

    await logWearEvent({
      garment_id: "22222222-2222-4222-8222-222222222222",
      worn_at: "2026-03-26T10:00:00.000Z"
    });

    expect(garmentUpdate).toHaveBeenCalledWith({
      wear_count: 1,
      last_worn_at: "2026-03-26T10:00:00.000Z",
      cost_per_wear: 390
    });
  });
});
