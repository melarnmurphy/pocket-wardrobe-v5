// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SignOutDialog } from "@/components/garderobe/account/sign-out-dialog";

vi.mock("@/app/auth/actions", () => ({
  signOutAction: vi.fn()
}));

describe("SignOutDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("names the consequence before signing out", () => {
    render(<SignOutDialog open onClose={vi.fn()} />);
    expect(screen.getByText("sign out?")).toBeInTheDocument();
    expect(screen.getByText(/sign back in to see your wardrobe/i)).toBeInTheDocument();
  });

  it("submits the sign-out form when confirmed", () => {
    render(<SignOutDialog open onClose={vi.fn()} />);

    const form = screen.getByTestId("sign-out-form") as HTMLFormElement;
    form.requestSubmit = vi.fn();

    fireEvent.click(screen.getByRole("button", { name: "sign out" }));
    expect(form.requestSubmit).toHaveBeenCalled();
  });
});
