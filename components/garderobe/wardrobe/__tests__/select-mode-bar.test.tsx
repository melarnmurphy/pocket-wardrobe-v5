// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SelectModeBar } from "@/components/garderobe/wardrobe/select-mode-bar";

afterEach(cleanup);

describe("SelectModeBar", () => {
  it("shows the selected count and calls onRequestDelete when the delete action is pressed", () => {
    const onRequestDelete = vi.fn();
    render(
      <SelectModeBar
        selectedCount={3}
        onRequestDelete={onRequestDelete}
        onRequestNewCollection={() => {}}
        onExit={() => {}}
      />
    );

    expect(screen.getByText(/3 selected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete 3/i }));
    expect(onRequestDelete).toHaveBeenCalled();
  });

  it("disables the bulk actions when nothing is selected", () => {
    render(
      <SelectModeBar
        selectedCount={0}
        onRequestDelete={() => {}}
        onRequestNewCollection={() => {}}
        onExit={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /new collection/i })).toBeDisabled();
  });

  it("calls onExit when done is pressed", () => {
    const onExit = vi.fn();
    render(
      <SelectModeBar
        selectedCount={1}
        onRequestDelete={() => {}}
        onRequestNewCollection={() => {}}
        onExit={onExit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onExit).toHaveBeenCalled();
  });
});
