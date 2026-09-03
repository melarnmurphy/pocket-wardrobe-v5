// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CloseAccountDialog } from "@/components/garderobe/account/close-account-dialog";
import type { AccountActionState } from "@/app/account/photos-actions";

const idleState: AccountActionState = { status: "idle", message: null };

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: () => [idleState, vi.fn(), false] };
});

describe("CloseAccountDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("states the consequence for live listings and open threads", () => {
    render(
      <CloseAccountDialog
        open
        onClose={vi.fn()}
        liveListingCount={2}
        openThreadCount={1}
        action={async () => idleState}
      />
    );

    expect(screen.getByText("close your account?")).toBeInTheDocument();
    expect(screen.getByText(/2 live listings/)).toBeInTheDocument();
    expect(screen.getByText(/1 open thread/)).toBeInTheDocument();
    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
  });

  it("keeps the confirm button disabled until the user types close", () => {
    render(
      <CloseAccountDialog
        open
        onClose={vi.fn()}
        liveListingCount={0}
        openThreadCount={0}
        action={async () => idleState}
      />
    );

    const confirmButton = screen.getByRole("button", { name: "close account" });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type close to confirm/i), { target: { value: "close" } });
    expect(confirmButton).not.toBeDisabled();
  });
});
