// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AgeReconfirmSection } from "@/app/account/age-reconfirm-section";

afterEach(cleanup);

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock })
}));

describe("AgeReconfirmSection", () => {
  it("renders nothing when age was never declined", () => {
    const { container } = render(<AgeReconfirmSection ageDeclined={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a way to reconfirm age once declined, and refreshes the page after confirming", async () => {
    const confirmAgeActionMock = vi.fn(async () => {});
    render(<AgeReconfirmSection ageDeclined confirmAgeAction={confirmAgeActionMock} />);

    expect(screen.getByText(/local threads is off/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirm you're 18 or over/i }));

    await vi.waitFor(() => expect(confirmAgeActionMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});
