// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeletePhotosDialog } from "@/components/garderobe/account/delete-photos-dialog";
import type { AccountActionState } from "@/app/account/photos-actions";

const idleState: AccountActionState = { status: "idle", message: null };

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: () => [idleState, vi.fn(), false] };
});

describe("DeletePhotosDialog", () => {
  it("names the consequence: how many pieces, and that records stay", () => {
    render(
      <DeletePhotosDialog open onClose={vi.fn()} garmentCount={12} action={async () => idleState} />
    );

    expect(screen.getByText("delete your photos?")).toBeInTheDocument();
    expect(screen.getByText(/12 pieces/)).toBeInTheDocument();
    expect(screen.getByText(/names, wear history, prices and looks stay/i)).toBeInTheDocument();
  });
});
