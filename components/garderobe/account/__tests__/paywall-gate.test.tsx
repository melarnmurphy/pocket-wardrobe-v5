// @vitest-environment jsdom
// components/garderobe/account/__tests__/paywall-gate.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PaywallGate } from "@/components/garderobe/account/paywall-gate";

afterEach(() => {
  cleanup();
});

describe("PaywallGate", () => {
  it("renders children directly when unlocked", () => {
    render(
      <PaywallGate unlocked feature="in_store_scan" teaserLabel="scan it" upgradeUrl={null}>
        <p>the real content</p>
      </PaywallGate>
    );

    expect(screen.getByText("the real content")).toBeInTheDocument();
  });

  it("renders a teaser instead of children when locked, and opens the interrupt sheet on tap", () => {
    render(
      <PaywallGate unlocked={false} feature="in_store_scan" teaserLabel="scan it" upgradeUrl={null}>
        <p>the real content</p>
      </PaywallGate>
    );

    expect(screen.queryByText("the real content")).not.toBeInTheDocument();
    const teaser = screen.getByRole("button", { name: /scan it/i });
    fireEvent.click(teaser);

    expect(screen.getByText(/scan it is a plus feature/i)).toBeInTheDocument();
  });
});
