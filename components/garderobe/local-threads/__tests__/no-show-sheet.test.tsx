// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoShowSheet } from "@/components/garderobe/local-threads/no-show-sheet";

describe("NoShowSheet", () => {
  it("names who was due and where before recording a no-show", () => {
    const onReport = vi.fn();
    render(
      <NoShowSheet
        open
        counterpartName="sam"
        placeName="the food court"
        at="2026-09-10T10:00:00.000Z"
        onReport={onReport}
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/sam was due at the food court/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText("they didn't show"));
    expect(onReport).toHaveBeenCalled();
  });
});
