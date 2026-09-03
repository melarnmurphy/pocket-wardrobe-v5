// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PaymentFailedDialog } from "@/components/garderobe/account/payment-failed-dialog";

describe("PaymentFailedDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("explains the lapse and offers a way to fix it", () => {
    render(<PaymentFailedDialog open onClose={vi.fn()} upgradeUrl="https://example.com/billing" />);

    expect(screen.getByText(/payment didn't go through/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "update payment" })).toHaveAttribute(
      "href",
      "https://example.com/billing"
    );
  });

  it("still renders a way to dismiss when no upgrade URL is configured", () => {
    render(<PaymentFailedDialog open onClose={vi.fn()} upgradeUrl={null} />);
    expect(screen.getByRole("button", { name: "remind me later" })).toBeInTheDocument();
  });
});
