import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const constructEvent = vi.fn();
const subscriptionsRetrieve = vi.fn();
const syncUserEntitlementsFromBillingEvent = vi.fn(async () => ({}));

vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(() => ({ STRIPE_WEBHOOK_SECRET: "whsec_test" }))
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(() => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve }
  }))
}));

vi.mock("@/lib/domain/billing/service", () => ({
  syncUserEntitlementsFromBillingEvent
}));

function postRequest(body: string, signature = "sig_test") {
  return new NextRequest("https://fashionapp5.vercel.app/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body
  });
}

const activeSubscription = {
  id: "sub_123",
  status: "active",
  customer: "cus_123",
  metadata: { supabase_user_id: "11111111-1111-1111-1111-111111111111" }
};

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a request with no stripe-signature header", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const request = new NextRequest("https://fashionapp5.vercel.app/api/webhooks/stripe", {
      method: "POST",
      body: "{}"
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("rejects a request whose signature fails verification", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(postRequest("{}"));

    expect(response.status).toBe(400);
    expect(syncUserEntitlementsFromBillingEvent).not.toHaveBeenCalled();
  });

  it("syncs premium plan_tier and active billing_status on checkout.session.completed", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_123" } }
    });
    subscriptionsRetrieve.mockResolvedValue(activeSubscription);

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(postRequest("{}"));

    expect(response.status).toBe(200);
    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_123");
    expect(syncUserEntitlementsFromBillingEvent).toHaveBeenCalledWith({
      user_id: "11111111-1111-1111-1111-111111111111",
      plan_tier: "premium",
      billing_provider: "stripe",
      billing_customer_id: "cus_123",
      billing_subscription_id: "sub_123",
      billing_status: "active"
    });
  });

  it("does nothing for checkout.session.completed with no subscription id", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { subscription: null } }
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(postRequest("{}"));

    expect(response.status).toBe(200);
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(syncUserEntitlementsFromBillingEvent).not.toHaveBeenCalled();
  });

  it("maps a past_due subscription to payment_failed on customer.subscription.updated", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { ...activeSubscription, status: "past_due" } }
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    await POST(postRequest("{}"));

    expect(syncUserEntitlementsFromBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({ plan_tier: "free", billing_status: "payment_failed" })
    );
  });

  it("maps a canceled subscription to free/lapsed on customer.subscription.deleted", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { ...activeSubscription, status: "canceled" } }
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    await POST(postRequest("{}"));

    expect(syncUserEntitlementsFromBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({ plan_tier: "free", billing_status: "lapsed" })
    );
  });

  it("resolves the subscription via invoice.parent.subscription_details on invoice.payment_failed", async () => {
    constructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: {
        object: {
          parent: { subscription_details: { subscription: "sub_123" } }
        }
      }
    });
    subscriptionsRetrieve.mockResolvedValue({ ...activeSubscription, status: "past_due" });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    await POST(postRequest("{}"));

    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_123");
    expect(syncUserEntitlementsFromBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({ billing_status: "payment_failed" })
    );
  });

  it("silently ignores a subscription with no supabase_user_id metadata, rather than syncing an unattributable event", async () => {
    constructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { ...activeSubscription, metadata: {} } }
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(postRequest("{}"));

    expect(response.status).toBe(200);
    expect(syncUserEntitlementsFromBillingEvent).not.toHaveBeenCalled();
  });

  it("ignores event types it doesn't handle", async () => {
    constructEvent.mockReturnValue({ type: "customer.created", data: { object: {} } });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(postRequest("{}"));

    expect(response.status).toBe(200);
    expect(syncUserEntitlementsFromBillingEvent).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking internals when sync fails", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { subscription: "sub_123" } }
    });
    subscriptionsRetrieve.mockResolvedValue(activeSubscription);
    syncUserEntitlementsFromBillingEvent.mockRejectedValueOnce(new Error("db unreachable"));

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const response = await POST(postRequest("{}"));

    expect(response.status).toBe(500);
  });
});
