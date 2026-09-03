// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AgeCheckDialog, AgeBlockedDialog } from "@/components/garderobe/local-threads/age-check-dialog";

afterEach(cleanup);

describe("AgeCheckDialog", () => {
  it("routes 18-or-over and under-18 to the two different handlers", () => {
    const onConfirmAdult = vi.fn();
    const onDeclineUnderage = vi.fn();
    render(
      <AgeCheckDialog open onConfirmAdult={onConfirmAdult} onDeclineUnderage={onDeclineUnderage} onClose={() => {}} />
    );

    expect(screen.getByText(/confirm you're 18 or over/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /i'm under 18/i }));
    expect(onDeclineUnderage).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /i'm 18 or over/i }));
    expect(onConfirmAdult).toHaveBeenCalled();
  });

  it("backdrop-dismiss records no answer either way", () => {
    const onConfirmAdult = vi.fn();
    const onDeclineUnderage = vi.fn();
    const onClose = vi.fn();
    render(
      <AgeCheckDialog
        open
        onConfirmAdult={onConfirmAdult}
        onDeclineUnderage={onDeclineUnderage}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onConfirmAdult).not.toHaveBeenCalled();
    expect(onDeclineUnderage).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("AgeBlockedDialog", () => {
  it("has a single dismiss button and names what still works", () => {
    const onDismiss = vi.fn();
    render(<AgeBlockedDialog open onDismiss={onDismiss} />);

    expect(screen.getByText(/needs an adult/i)).toBeInTheDocument();
    expect(screen.getByText(/listing a piece or messaging a seller stays off until you're 18/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ok/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
