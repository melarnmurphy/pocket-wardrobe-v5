// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReportListingSheet } from "@/components/garderobe/local-threads/report-listing-sheet";

afterEach(cleanup);

describe("ReportListingSheet", () => {
  it("says the other person is never told, and submits the chosen reason", async () => {
    const onSubmit = vi.fn(async () => {});
    render(<ReportListingSheet open onSubmit={onSubmit} onClose={() => {}} />);

    expect(screen.getByText(/never told you reported them/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText("spam"));
    fireEvent.click(screen.getByRole("button", { name: /send report/i }));

    expect(onSubmit).toHaveBeenCalledWith("spam");
  });

  it("requires text when 'something else' is chosen", () => {
    render(<ReportListingSheet open onSubmit={vi.fn()} onClose={() => {}} />);

    fireEvent.click(screen.getByText("something else"));
    expect(screen.getByRole("button", { name: /send report/i })).toBeDisabled();
  });
});
