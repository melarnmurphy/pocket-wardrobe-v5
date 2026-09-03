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

describe("createPlusCheckoutSession", () => {
  const checkoutSessionsCreate = vi.fn();

  function mockServerEnv(priceId: string | undefined) {
    vi.doMock("@/lib/env", () => ({
      getServerEnv: vi.fn(() => ({ STRIPE_PLUS_ANNUAL_PRICE_ID: priceId }))
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("@/lib/auth", () => ({
      getRequiredUser: vi.fn(async () => ({ id: "22222222-2222-2222-2222-222222222222", email: "esther@example.com" }))
    }));
    vi.doMock("@/lib/domain/entitlements/service", () => ({
      getUserEntitlements: vi.fn(async () => ({
        user_id: "22222222-2222-2222-2222-222222222222",
        plan_tier: "free",
        billing_customer_id: null
      }))
    }));
    vi.doMock("@/lib/stripe", () => ({
      getStripeClient: vi.fn(() => ({
        checkout: { sessions: { create: checkoutSessionsCreate } }
      }))
    }));
    mockServerEnv("price_annual_test");
  });

  it("creates a subscription checkout session for the configured annual price, with no payment_method_types set", async () => {
    checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session123" });

    const { createPlusCheckoutSession } = await import("@/lib/domain/billing/service");
    const result = await createPlusCheckoutSession("https://fashionapp5.vercel.app");

    expect(result).toEqual({ url: "https://checkout.stripe.com/session123" });
    const callArgs = checkoutSessionsCreate.mock.calls[0][0];
    expect(callArgs.mode).toBe("subscription");
    expect(callArgs.line_items).toEqual([{ price: "price_annual_test", quantity: 1 }]);
    expect(callArgs.client_reference_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(callArgs.subscription_data.metadata.supabase_user_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(callArgs).not.toHaveProperty("payment_method_types");
  });

  it("reuses an existing Stripe customer id rather than creating a new one", async () => {
    vi.doMock("@/lib/domain/entitlements/service", () => ({
      getUserEntitlements: vi.fn(async () => ({
        user_id: "22222222-2222-2222-2222-222222222222",
        plan_tier: "free",
        billing_customer_id: "cus_existing123"
      }))
    }));
    checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session456" });

    const { createPlusCheckoutSession } = await import("@/lib/domain/billing/service");
    await createPlusCheckoutSession("https://fashionapp5.vercel.app");

    const callArgs = checkoutSessionsCreate.mock.calls[0][0];
    expect(callArgs.customer).toBe("cus_existing123");
    expect(callArgs.customer_email).toBeUndefined();
  });

  it("throws a clear error when no annual price is configured", async () => {
    mockServerEnv(undefined);

    const { createPlusCheckoutSession } = await import("@/lib/domain/billing/service");
    await expect(createPlusCheckoutSession("https://fashionapp5.vercel.app")).rejects.toThrow(
      /not configured/i
    );
  });
});

describe("createBillingPortalSession", () => {
  const billingPortalSessionsCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doMock("@/lib/stripe", () => ({
      getStripeClient: vi.fn(() => ({
        billingPortal: { sessions: { create: billingPortalSessionsCreate } }
      }))
    }));
  });

  it("opens a portal session for an existing Stripe customer", async () => {
    vi.doMock("@/lib/domain/entitlements/service", () => ({
      getUserEntitlements: vi.fn(async () => ({
        user_id: "22222222-2222-2222-2222-222222222222",
        plan_tier: "premium",
        billing_customer_id: "cus_existing123"
      }))
    }));
    billingPortalSessionsCreate.mockResolvedValue({ url: "https://billing.stripe.com/portal123" });

    const { createBillingPortalSession } = await import("@/lib/domain/billing/service");
    const result = await createBillingPortalSession("https://fashionapp5.vercel.app");

    expect(result).toEqual({ url: "https://billing.stripe.com/portal123" });
    expect(billingPortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_existing123",
      return_url: "https://fashionapp5.vercel.app/account"
    });
  });

  it("refuses to open a portal for a user with no Stripe customer id", async () => {
    vi.doMock("@/lib/domain/entitlements/service", () => ({
      getUserEntitlements: vi.fn(async () => ({
        user_id: "22222222-2222-2222-2222-222222222222",
        plan_tier: "free",
        billing_customer_id: null
      }))
    }));

    const { createBillingPortalSession } = await import("@/lib/domain/billing/service");
    await expect(createBillingPortalSession("https://fashionapp5.vercel.app")).rejects.toThrow(
      /nothing to manage/i
    );
    expect(billingPortalSessionsCreate).not.toHaveBeenCalled();
  });
});
