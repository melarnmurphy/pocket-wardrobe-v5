// @vitest-environment jsdom
// components/garderobe/__tests__/dialog.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Dialog } from "@/components/garderobe/dialog";

afterEach(() => {
  cleanup();
});

describe("Dialog", () => {
  it("renders children between the description and the buttons", () => {
    render(
      <Dialog
        open
        onClose={vi.fn()}
        title="close your account?"
        description="This is permanent."
        confirmLabel="close account"
        onConfirm={vi.fn()}
      >
        <input aria-label="type close to confirm" />
      </Dialog>
    );

    expect(screen.getByLabelText("type close to confirm")).toBeInTheDocument();
  });

  it("disables the confirm button when confirmDisabled is true", () => {
    const onConfirm = vi.fn();

    render(
      <Dialog
        open
        onClose={vi.fn()}
        title="close your account?"
        confirmLabel="close account"
        onConfirm={onConfirm}
        confirmDisabled
      />
    );

    const confirmButton = screen.getByRole("button", { name: "close account" });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirmDisabled defaults to false so every existing Dialog caller is unaffected", () => {
    const onConfirm = vi.fn();
    render(
      <Dialog open onClose={vi.fn()} title="sign out?" confirmLabel="sign out" onConfirm={onConfirm} />
    );

    expect(screen.getByRole("button", { name: "sign out" })).not.toBeDisabled();
  });
});
