// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PlanSection } from "@/app/account/plan-section";
import type { UserEntitlements } from "@/lib/domain/entitlements";

vi.mock("@/app/account/billing-actions", () => ({
  startPlusCheckoutAction: vi.fn(async () => {})
}));

afterEach(cleanup);

const freeEntitlements: UserEntitlements = {
  user_id: "11111111-1111-1111-1111-111111111111",
  plan_tier: "free",
  feature_labels_enabled: false,
  receipt_ocr_enabled: false,
  product_url_ingestion_enabled: false,
  outfit_decomposition_enabled: false,
  billing_provider: null,
  billing_customer_id: null,
  billing_subscription_id: null,
  billing_status: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z"
};

describe("PlanSection", () => {
  it("shows an upgrade button for a free user when checkout is enabled", () => {
    render(<PlanSection entitlements={freeEntitlements} checkoutEnabled />);
    expect(screen.getByRole("button", { name: /upgrade plan/i })).toBeInTheDocument();
  });

  it("shows no upgrade button when checkout isn't configured", () => {
    render(<PlanSection entitlements={freeEntitlements} checkoutEnabled={false} />);
    expect(screen.queryByRole("button", { name: /upgrade plan/i })).not.toBeInTheDocument();
  });

  it("shows no upgrade button for a user already on a paid plan", () => {
    render(
      <PlanSection entitlements={{ ...freeEntitlements, plan_tier: "premium" }} checkoutEnabled />
    );
    expect(screen.queryByRole("button", { name: /upgrade plan/i })).not.toBeInTheDocument();
  });
});
