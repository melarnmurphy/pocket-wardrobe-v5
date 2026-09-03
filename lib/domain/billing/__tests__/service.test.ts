import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const select = vi.fn(() => ({ single }));
const upsert = vi.fn(() => ({ select }));
const from = vi.fn(() => ({ upsert }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from }))
}));

describe("syncUserEntitlementsFromBillingEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("leaves billing_status null when the payload omits it", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", plan_tier: "premium", billing_status: null }, error: null });

    const { syncUserEntitlementsFromBillingEvent } = await import("@/lib/domain/billing/service");
    await syncUserEntitlementsFromBillingEvent({
      user_id: "11111111-1111-1111-1111-111111111111",
      plan_tier: "premium"
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ billing_status: null }),
      { onConflict: "user_id" }
    );
  });

  it("passes through an explicit payment_failed status", async () => {
    single.mockResolvedValue({ data: { user_id: "u1", plan_tier: "premium", billing_status: "payment_failed" }, error: null });

    const { syncUserEntitlementsFromBillingEvent } = await import("@/lib/domain/billing/service");
    await syncUserEntitlementsFromBillingEvent({
      user_id: "11111111-1111-1111-1111-111111111111",
      plan_tier: "premium",
      billing_status: "payment_failed"
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ billing_status: "payment_failed" }),
      { onConflict: "user_id" }
    );
  });
});
