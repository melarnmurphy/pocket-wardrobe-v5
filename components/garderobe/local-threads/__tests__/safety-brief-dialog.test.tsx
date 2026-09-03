// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SafetyBriefDialog } from "@/components/garderobe/local-threads/safety-brief-dialog";

describe("SafetyBriefDialog", () => {
  it("has a single acknowledgement button, no cancel", () => {
    const onAcknowledge = vi.fn();
    render(<SafetyBriefDialog open onAcknowledge={onAcknowledge} onClose={() => {}} />);

    expect(screen.getByText(/before you list/i)).toBeInTheDocument();
    expect(screen.getByText(/meet in a public place/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onAcknowledge).toHaveBeenCalled();
  });
});
