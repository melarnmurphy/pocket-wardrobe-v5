// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReceiptMatchSheet } from "@/components/garderobe/wardrobe/receipt-match-sheet";

afterEach(cleanup);

const candidates = [
  { garment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Navy blazer", category: "blazer" },
  { garment_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Wool blazer", category: "blazer" }
];

describe("ReceiptMatchSheet", () => {
  it("lists every candidate and a 'none of these' option", () => {
    render(
      <ReceiptMatchSheet
        open
        draftId="draft-1"
        candidates={candidates}
        onClose={() => {}}
        onResolve={() => {}}
        pending={false}
        error={null}
      />
    );
    expect(screen.getByText("Navy blazer")).toBeInTheDocument();
    expect(screen.getByText("Wool blazer")).toBeInTheDocument();
    expect(screen.getByText(/none of these/i)).toBeInTheDocument();
  });

  it("calls onResolve with the chosen garment id", () => {
    const onResolve = vi.fn();
    render(
      <ReceiptMatchSheet
        open
        draftId="draft-1"
        candidates={candidates}
        onClose={() => {}}
        onResolve={onResolve}
        pending={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText("Navy blazer"));
    expect(onResolve).toHaveBeenCalledWith("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("calls onResolve with null for 'none of these'", () => {
    const onResolve = vi.fn();
    render(
      <ReceiptMatchSheet
        open
        draftId="draft-1"
        candidates={candidates}
        onClose={() => {}}
        onResolve={onResolve}
        pending={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText(/none of these/i));
    expect(onResolve).toHaveBeenCalledWith(null);
  });
});
