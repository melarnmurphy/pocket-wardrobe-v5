// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecentlyDeletedSheet } from "@/components/garderobe/wardrobe/recently-deleted-sheet";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

const noopAction = async (state: unknown) => state as never;

describe("RecentlyDeletedSheet", () => {
  it("shows each deleted item's title and a restore action", () => {
    render(
      <RecentlyDeletedSheet
        open
        onClose={() => {}}
        restoreAction={noopAction}
        items={[
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            title: "camel coat",
            category: "coat"
          } as never
        ]}
      />
    );

    expect(screen.getByText("camel coat")).toBeInTheDocument();
    expect(screen.getByText(/restore/i)).toBeInTheDocument();
  });

  it("shows an empty state with no deleted items", () => {
    render(<RecentlyDeletedSheet open onClose={() => {}} restoreAction={noopAction} items={[]} />);
    expect(screen.getByText(/nothing recently deleted/i)).toBeInTheDocument();
  });
});
