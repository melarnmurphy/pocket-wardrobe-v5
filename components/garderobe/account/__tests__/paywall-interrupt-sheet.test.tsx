// @vitest-environment jsdom
// components/garderobe/account/__tests__/paywall-interrupt-sheet.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PaywallInterruptSheet, PLUS_FEATURE_COPY } from "@/components/garderobe/account/paywall-interrupt-sheet";

afterEach(() => {
  cleanup();
});

describe("PLUS_FEATURE_COPY", () => {
  it("describes only the four real plus features, at A$69 a year", () => {
    expect(Object.keys(PLUS_FEATURE_COPY).sort()).toEqual(
      ["analytics", "availability", "in_store_scan", "trend_calls"].sort()
    );
  });
});

describe("PaywallInterruptSheet", () => {
  it("names the specific feature that triggered it and the price", () => {
    render(
      <PaywallInterruptSheet
        open
        onClose={vi.fn()}
        feature="trend_calls"
        upgradeUrl="https://example.com/plus"
      />
    );

    expect(screen.getByText(PLUS_FEATURE_COPY.trend_calls.title)).toBeInTheDocument();
    expect(screen.getByText(/A\$69 a year/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see plans/i })).toHaveAttribute(
      "href",
      "https://example.com/plus"
    );
  });
});
