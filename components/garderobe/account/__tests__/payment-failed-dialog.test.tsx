// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PaymentFailedDialog } from "@/components/garderobe/account/payment-failed-dialog";

const openBillingPortalActionMock = vi.fn(async () => {});
vi.mock("@/app/account/billing-actions", () => ({
  openBillingPortalAction: () => openBillingPortalActionMock()
}));

describe("PaymentFailedDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("explains the lapse", () => {
    render(
      <PaymentFailedDialog open onClose={vi.fn()} upgradeUrl={null} hasStripeCustomer />
    );

    expect(screen.getByText(/payment didn't go through/i)).toBeInTheDocument();
  });

  it("opens the real billing portal when this account has a Stripe customer", () => {
    render(
      <PaymentFailedDialog open onClose={vi.fn()} upgradeUrl={null} hasStripeCustomer />
    );

    fireEvent.click(screen.getByRole("button", { name: "update payment" }));
    expect(openBillingPortalActionMock).toHaveBeenCalled();
  });

  it("falls back to the legacy upgrade URL when there's no Stripe customer to manage", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" }
    });

    render(
      <PaymentFailedDialog open onClose={vi.fn()} upgradeUrl="https://example.com/billing" hasStripeCustomer={false} />
    );

    fireEvent.click(screen.getByRole("button", { name: "update payment" }));
    expect(window.location.href).toBe("https://example.com/billing");

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("still renders a way to dismiss when there's neither a Stripe customer nor an upgrade URL", () => {
    render(
      <PaymentFailedDialog open onClose={vi.fn()} upgradeUrl={null} hasStripeCustomer={false} />
    );
    expect(screen.getByRole("button", { name: "remind me later" })).toBeInTheDocument();
  });
});
