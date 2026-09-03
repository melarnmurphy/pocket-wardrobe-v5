// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferDecisionDialog } from "@/components/garderobe/local-threads/offer-decision-dialog";

describe("OfferDecisionDialog", () => {
  it("names the consequence for a seller declining an offer", () => {
    const onConfirm = vi.fn();
    render(
      <OfferDecisionDialog
        open
        variant="decline"
        counterpartName="sam"
        offerCents={18500}
        onConfirm={onConfirm}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/decline this offer\?/i)).toBeInTheDocument();
    expect(screen.getByText(/closes out sam's a\$185 offer/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^decline$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("names the consequence for a buyer withdrawing their own offer", () => {
    render(
      <OfferDecisionDialog
        open
        variant="withdraw"
        counterpartName="sam"
        offerCents={18500}
        onConfirm={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/withdraw your offer\?/i)).toBeInTheDocument();
    expect(screen.getByText(/removes your a\$185 offer to sam/i)).toBeInTheDocument();
  });
});
