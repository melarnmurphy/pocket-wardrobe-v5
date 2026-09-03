// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CancelListingDialog } from "@/components/garderobe/local-threads/cancel-listing-dialog";

describe("CancelListingDialog", () => {
  it("names the live offer that will close, not just 'are you sure'", () => {
    render(
      <CancelListingDialog
        open
        counterpartName="sam"
        hasOffer
        hasHandover={false}
        onConfirm={vi.fn()}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/cancel this listing\?/i)).toBeInTheDocument();
    expect(screen.getByText(/sam's offer closes and the thread ends/i)).toBeInTheDocument();
  });

  it("falls back to the plain consequence with no live offer or handover", () => {
    render(
      <CancelListingDialog
        open
        counterpartName={null}
        hasOffer={false}
        hasHandover={false}
        onConfirm={vi.fn()}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/takes it off the nearby feed/i)).toBeInTheDocument();
  });
});
