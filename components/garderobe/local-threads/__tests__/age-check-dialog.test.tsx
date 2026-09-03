// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AgeCheckDialog, AgeBlockedDialog } from "@/components/garderobe/local-threads/age-check-dialog";

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
});

describe("AgeBlockedDialog", () => {
  it("has a single dismiss button and names what still works", () => {
    const onDismiss = vi.fn();
    render(<AgeBlockedDialog open onDismiss={onDismiss} />);

    expect(screen.getByText(/needs an adult/i)).toBeInTheDocument();
    expect(screen.getByText(/every other part of garderobe/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ok/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
