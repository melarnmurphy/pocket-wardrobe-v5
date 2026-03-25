import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn();
const maybeSingle = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from })
}));

vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111"
  })
}));

describe("getUserEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockReset();
    eq.mockReturnValue({ maybeSingle });
    select.mockReturnValue({ eq });
    from.mockReturnValue({ select });
  });

  it("returns free defaults when no entitlement row exists yet", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const { getUserEntitlements } = await import("@/lib/domain/entitlements/service");
    const entitlements = await getUserEntitlements();

    expect(entitlements.plan_tier).toBe("free");
    expect(entitlements.feature_labels_enabled).toBe(false);
    expect(entitlements.user_id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("returns the stored entitlement row when present", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        user_id: "11111111-1111-4111-8111-111111111111",
        plan_tier: "premium",
        feature_labels_enabled: true,
        receipt_ocr_enabled: true,
        product_url_ingestion_enabled: false,
        outfit_decomposition_enabled: false,
        billing_provider: "stripe",
        billing_customer_id: "cus_123",
        billing_subscription_id: "sub_123",
        created_at: "2026-03-25T00:00:00.000Z",
        updated_at: "2026-03-25T00:00:00.000Z"
      },
      error: null
    });

    const {
      canUseFeatureLabels,
      getUserEntitlements
    } = await import("@/lib/domain/entitlements/service");
    const entitlements = await getUserEntitlements();

    expect(entitlements.plan_tier).toBe("premium");
    expect(await canUseFeatureLabels()).toBe(true);
  });
});
