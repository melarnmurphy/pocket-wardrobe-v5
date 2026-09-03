// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManageListing } from "@/app/local/[id]/manage-listing";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/local/actions", () => ({
  cancelListingAction: vi.fn(async () => ({ status: "success" }))
}));

describe("ManageListing", () => {
  it("opens the cancel-listing dialog naming the live offer, not a bare confirm", () => {
    render(
      <ManageListing
        listingId="11111111-1111-1111-1111-111111111111"
        hasOffer
        hasHandover={false}
        counterpartName="sam"
        counterpartThreadId="22222222-2222-2222-2222-222222222222"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel listing/i }));
    expect(screen.getByText(/sam's offer closes and the thread ends/i)).toBeInTheDocument();
  });
});
