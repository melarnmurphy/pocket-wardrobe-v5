// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ListingGate } from "@/components/garderobe/local-threads/listing-gate";

vi.mock("@/app/local/actions", () => ({
  confirmAgeAction: vi.fn(async () => {}),
  declineAgeAction: vi.fn(async () => {}),
  markSafetyBriefSeenAction: vi.fn(async () => {})
}));

// ListingGate calls router.back()/push() on decline/block dismissal, matching
// the existing convention for mocking next/navigation in component tests
// (see components/garderobe/wardrobe/__tests__/disposal-sheet.test.tsx).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() })
}));

// This suite's test runner isn't configured with vitest's global test hooks
// (see vitest.config.ts), so @testing-library/react cannot auto-register its
// usual afterEach cleanup; without this, multiple renders across `it` blocks
// leave prior DOM around and later getByText/queryByText calls see stale
// matches from earlier tests.
afterEach(cleanup);

describe("ListingGate", () => {
  it("shows the age check first when nothing has been answered yet", () => {
    render(
      <ListingGate ageConfirmed={false} ageDeclined={false} safetyBriefSeen={false} onBlockedDismiss={() => {}}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText(/confirm you're 18 or over/i)).toBeInTheDocument();
    expect(screen.queryByText("the form")).not.toBeInTheDocument();
  });

  it("shows the permanent block once age has been declined, never the form", () => {
    render(
      <ListingGate ageConfirmed={false} ageDeclined onBlockedDismiss={() => {}} safetyBriefSeen={false}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText(/needs an adult/i)).toBeInTheDocument();
    expect(screen.queryByText("the form")).not.toBeInTheDocument();
  });

  it("shows the safety brief, then the form, once age is confirmed", async () => {
    render(
      <ListingGate ageConfirmed safetyBriefSeen={false} ageDeclined={false} onBlockedDismiss={() => {}}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText(/before you list/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    // markSafetyBriefSeenAction is awaited before the form renders, so the
    // state flip lands on a later microtask than the click itself.
    expect(await screen.findByText("the form")).toBeInTheDocument();
  });

  it("renders straight through once both flags are set", () => {
    render(
      <ListingGate ageConfirmed safetyBriefSeen ageDeclined={false} onBlockedDismiss={() => {}}>
        <p>the form</p>
      </ListingGate>
    );

    expect(screen.getByText("the form")).toBeInTheDocument();
  });
});
