// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ManageCollectionSheet } from "@/components/garderobe/wardrobe/manage-collection-sheet";

// This project's vitest config does not enable `test.globals`, so
// @testing-library/react's automatic afterEach cleanup never registers
// (it only wires up when it finds a real global `afterEach`). Without this,
// the two renders below both stay mounted in the shared jsdom document and
// "delete collection" resolves to more than one match in the second test.
afterEach(cleanup);

describe("ManageCollectionSheet", () => {
  it("submits the edited name on save", async () => {
    const renameAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const deleteAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const onDeleted = vi.fn();

    render(
      <ManageCollectionSheet
        open={true}
        collection={{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "weekend capsule" }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        renameAction={renameAction}
        deleteAction={deleteAction}
      />
    );

    const input = screen.getByDisplayValue("weekend capsule");
    fireEvent.change(input, { target: { value: "work capsule" } });
    fireEvent.click(screen.getByText("save name"));

    await waitFor(() => expect(renameAction).toHaveBeenCalled());
    const [, formData] = renameAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("collection_id")).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(formData.get("name")).toBe("work capsule");
  });

  it("asks for confirmation before deleting, then submits the collection id", async () => {
    const renameAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const deleteAction = vi.fn(
      async (_state: unknown, _formData: FormData) =>
        ({ status: "success", message: "Collection deleted. The pieces stay in your wardrobe." }) as never
    );
    const onDeleted = vi.fn();

    render(
      <ManageCollectionSheet
        open={true}
        collection={{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "weekend capsule" }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        renameAction={renameAction}
        deleteAction={deleteAction}
      />
    );

    fireEvent.click(screen.getByText("delete collection"));
    fireEvent.click(await screen.findByText("delete collection", { selector: "button" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalled());
    const [, formData] = deleteAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("collection_id")).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("keeps the sheet open and shows the error when deletion fails", async () => {
    const renameAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const deleteAction = vi.fn(
      async (_state: unknown, _formData: FormData) =>
        ({ status: "error", message: "Unable to delete the collection." }) as never
    );
    const onDeleted = vi.fn();

    render(
      <ManageCollectionSheet
        open={true}
        collection={{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "weekend capsule" }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        renameAction={renameAction}
        deleteAction={deleteAction}
      />
    );

    fireEvent.click(screen.getByText("delete collection"));
    fireEvent.click(await screen.findByText("delete collection", { selector: "button" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalled());
    expect(await screen.findByText("Unable to delete the collection.")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("closes the confirm dialog again on a second consecutive delete failure", async () => {
    // Each call resolves a freshly constructed object literal with the same
    // "error" status, exactly like the real deleteCollectionAction does on
    // two separate failed attempts. This guards against keying the
    // reaction effect on `deleteState.status` alone: a same-value string
    // comparison would miss the second failure and leave the confirm
    // dialog stuck open.
    const renameAction = vi.fn(async (state: unknown, _formData: FormData) => state as never);
    const deleteAction = vi
      .fn()
      .mockImplementationOnce(
        async () => ({ status: "error", message: "Unable to delete the collection." }) as never
      )
      .mockImplementationOnce(
        async () => ({ status: "error", message: "Unable to delete the collection. Try again." }) as never
      );
    const onDeleted = vi.fn();

    render(
      <ManageCollectionSheet
        open={true}
        collection={{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "weekend capsule" }}
        onClose={vi.fn()}
        onDeleted={onDeleted}
        renameAction={renameAction}
        deleteAction={deleteAction}
      />
    );

    // First attempt: opens the confirm dialog, confirms, fails, and the
    // dialog should close again to reveal the sheet's inline error.
    fireEvent.click(screen.getByText("delete collection"));
    fireEvent.click(await screen.findByText("delete collection", { selector: "button" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByText("delete collection", { selector: "button" })).not.toBeInTheDocument()
    );
    expect(await screen.findByText("Unable to delete the collection.")).toBeInTheDocument();

    // Second attempt: reopen the confirm dialog and confirm again. Even
    // though this also resolves to `status: "error"`, the dialog must
    // close again rather than sticking open from the reopen.
    fireEvent.click(screen.getByText("delete collection"));
    fireEvent.click(await screen.findByText("delete collection", { selector: "button" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("delete collection", { selector: "button" })).not.toBeInTheDocument()
    );
    expect(await screen.findByText("Unable to delete the collection. Try again.")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
