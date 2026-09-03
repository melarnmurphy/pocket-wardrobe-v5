// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResetSentDialog } from "@/components/garderobe/auth/reset-sent-dialog";

afterEach(cleanup);

describe("ResetSentDialog", () => {
  it("shows the email the reset link went to", () => {
    render(<ResetSentDialog email="mia@morrow.studio" next="/wardrobe" resendAction={() => {}} />);
    expect(screen.getByText(/mia@morrow\.studio/)).toBeInTheDocument();
  });

  it("submits the resend form when 'resend link' is clicked", () => {
    const resendAction = vi.fn();
    render(<ResetSentDialog email="mia@morrow.studio" next="/wardrobe" resendAction={resendAction} />);
    fireEvent.click(screen.getByText("resend link"));
    expect(resendAction).toHaveBeenCalled();
  });

  it("closes when 'close' is clicked", () => {
    render(<ResetSentDialog email="mia@morrow.studio" next="/wardrobe" resendAction={() => {}} />);
    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByText("check your email")).not.toBeInTheDocument();
  });
});
