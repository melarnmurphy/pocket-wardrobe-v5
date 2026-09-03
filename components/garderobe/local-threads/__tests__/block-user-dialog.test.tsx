// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlockUserDialog } from "@/components/garderobe/local-threads/block-user-dialog";

describe("BlockUserDialog", () => {
  it("names the consequence: thread ends, listings hide, no notice", () => {
    const onConfirm = vi.fn();
    render(<BlockUserDialog open counterpartName="sam" onConfirm={onConfirm} onClose={() => {}} />);

    expect(screen.getByText(/block sam\?/i)).toBeInTheDocument();
    expect(screen.getByText(/ends this thread for both of you/i)).toBeInTheDocument();
    expect(screen.getByText(/they won't be told/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^block$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
