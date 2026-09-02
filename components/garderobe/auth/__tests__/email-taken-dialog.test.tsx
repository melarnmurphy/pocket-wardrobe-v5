// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EmailTakenDialog } from "@/components/garderobe/auth/email-taken-dialog";

afterEach(cleanup);

describe("EmailTakenDialog", () => {
  it("names the email that already has a wardrobe", () => {
    render(<EmailTakenDialog email="mia@morrow.studio" signInHref="/auth/sign-in?next=%2F" />);
    expect(screen.getByText("that email already has a wardrobe")).toBeInTheDocument();
    expect(screen.getByText(/mia@morrow\.studio/)).toBeInTheDocument();
  });

  it("links 'sign in instead' to the sign-in href", () => {
    render(<EmailTakenDialog email="mia@morrow.studio" signInHref="/auth/sign-in?next=%2F" />);
    const confirm = screen.getByText("sign in instead") as HTMLAnchorElement;
    expect(confirm.closest("a")).toHaveAttribute("href", "/auth/sign-in?next=%2F");
  });

  it("closes on 'try another email' without navigating", () => {
    render(<EmailTakenDialog email="mia@morrow.studio" signInHref="/auth/sign-in?next=%2F" />);
    fireEvent.click(screen.getByText("try another email"));
    expect(screen.queryByText("that email already has a wardrobe")).not.toBeInTheDocument();
  });
});
