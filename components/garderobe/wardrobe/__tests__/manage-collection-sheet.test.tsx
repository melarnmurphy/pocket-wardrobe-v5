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

    fireEvent.click(screen.getByText("delete collection"));
    fireEvent.click(await screen.findByText("delete collection", { selector: "button" }));

    await waitFor(() => expect(deleteAction).toHaveBeenCalled());
    const [, formData] = deleteAction.mock.calls[0] as [unknown, FormData];
    expect(formData.get("collection_id")).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
