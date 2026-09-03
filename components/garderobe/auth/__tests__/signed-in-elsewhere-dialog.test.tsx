// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SignedInElsewhereDialog } from "@/components/garderobe/auth/signed-in-elsewhere-dialog";

afterEach(cleanup);

describe("SignedInElsewhereDialog", () => {
  it("names the reason the session ended", () => {
    render(<SignedInElsewhereDialog onSignInAgain={() => {}} />);
    expect(screen.getByText("signed in on another device")).toBeInTheDocument();
  });

  it("calls onSignInAgain when confirmed", () => {
    const onSignInAgain = vi.fn();
    render(<SignedInElsewhereDialog onSignInAgain={onSignInAgain} />);
    fireEvent.click(screen.getByText("sign in again"));
    expect(onSignInAgain).toHaveBeenCalled();
  });

  it("dismisses without calling onSignInAgain", () => {
    const onSignInAgain = vi.fn();
    render(<SignedInElsewhereDialog onSignInAgain={onSignInAgain} />);
    fireEvent.click(screen.getByText("dismiss"));
    expect(onSignInAgain).not.toHaveBeenCalled();
    expect(screen.queryByText("signed in on another device")).not.toBeInTheDocument();
  });
});
