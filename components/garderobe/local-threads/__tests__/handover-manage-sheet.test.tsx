// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverManageSheet } from "@/components/garderobe/local-threads/handover-manage-sheet";

describe("HandoverManageSheet", () => {
  it("offers reschedule and cancel, and calls the right handler for each", () => {
    const onReschedule = vi.fn();
    const onCancel = vi.fn();
    render(
      <HandoverManageSheet
        open
        placeName="the food court"
        placeSuburb="Rundle Mall"
        at="2026-09-10T10:00:00.000Z"
        onReschedule={onReschedule}
        onCancel={onCancel}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText("reschedule"));
    expect(onReschedule).toHaveBeenCalled();
    fireEvent.click(screen.getByText("cancel handover"));
    expect(onCancel).toHaveBeenCalled();
  });
});
