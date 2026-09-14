// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";

describe("BottomSheet", () => {
  afterEach(() => cleanup());

  it("exposes the sheet as a labelled modal dialog", () => {
    render(
      <BottomSheet
        open
        onClose={vi.fn()}
        title="choose a source"
        description="Add a piece from your camera roll or a link."
      />
    );

    expect(screen.getByRole("dialog", { name: "choose a source" })).toHaveAccessibleDescription(
      "Add a piece from your camera roll or a link."
    );
  });
});
