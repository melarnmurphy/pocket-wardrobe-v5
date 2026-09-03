"use client";

import { useActionState, useEffect, useState } from "react";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import { Dialog } from "@/components/garderobe/dialog";
import { PillButton } from "@/components/garderobe/pill-button";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  wardrobeActionState,
  type WardrobeActionState
} from "@/lib/domain/wardrobe/action-state";

type ActionFn = (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;

type ManageCollectionSheetProps = {
  open: boolean;
  collection: { id: string; name: string } | null;
  onClose: () => void;
  onDeleted: () => void;
  renameAction: ActionFn;
  deleteAction: ActionFn;
  /** Optional: the collections list is server data, so a caller that keeps
   * its own copy of it (WardrobeShop) wants a nudge to refresh after a
   * successful rename. Not every caller needs this, so it stays optional. */
  onRenamed?: () => void;
};

/**
 * Rename and delete a collection — designed here, no mockup exists
 * (MODALS.md §2 marks it "missing"; only "new collection" is drawn at 18c).
 * Rename is a single text edit, so it stays inside this sheet like
 * NewCollectionSheet's own input. Delete asks one yes/no question, so it
 * opens a nested Dialog rather than resolving from a SheetAction tap alone.
 */
export function ManageCollectionSheet({
  open,
  collection,
  onClose,
  onDeleted,
  renameAction,
  deleteAction,
  onRenamed
}: ManageCollectionSheetProps) {
  const [name, setName] = useState(collection?.name ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [renameState, renameFormAction] = useActionState(renameAction, wardrobeActionState);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, wardrobeActionState);

  useEffect(() => {
    setName(collection?.name ?? "");
  }, [collection]);

  useEffect(() => {
    if (open && renameState.status === "success") {
      showAppToast({ message: renameState.message || "Collection renamed.", tone: "success" });
      onClose();
      onRenamed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renameState.status]);

  useEffect(() => {
    if (!open) return;
    if (deleteState.status === "success") {
      showAppToast({ message: deleteState.message || "Collection deleted.", tone: "success" });
      setConfirmingDelete(false);
      onDeleted();
    } else if (deleteState.status === "error") {
      // Close the confirm dialog so the sheet underneath, with its inline
      // error message, becomes visible again — but do not call onDeleted().
      setConfirmingDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteState.status]);

  if (!collection) return null;

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="manage collection">
        <form action={renameFormAction} className="flex flex-col gap-3">
          <input type="hidden" name="collection_id" value={collection.id} />
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
          />
          <PillButton type="submit" className="h-11">
            save name
          </PillButton>
          {renameState.status === "error" ? (
            <p className="text-[11px] text-[var(--oxblood)]">{renameState.message}</p>
          ) : null}
        </form>
        <div className="pt-3">
          <SheetAction destructive last onClick={() => setConfirmingDelete(true)}>
            delete collection
          </SheetAction>
        </div>
        {deleteState.status === "error" ? (
          <p className="pt-2 text-[11px] text-[var(--oxblood)]">{deleteState.message}</p>
        ) : null}
      </BottomSheet>

      <Dialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title={`delete "${collection.name}"?`}
        description="The pieces in it stay in your wardrobe. They just won't be grouped under this collection anymore."
        cancelLabel="cancel"
        confirmLabel="delete collection"
        onConfirm={() => {
          const formData = new FormData();
          formData.set("collection_id", collection.id);
          deleteFormAction(formData);
          // Deliberately nothing else here: this is a destructive action, so
          // the sheet must stay open and the confirm dialog must not close
          // until the server action actually resolves. The success effect
          // below is the only place that closes the confirm dialog and
          // calls onDeleted() — on an error, deleteState.status stays
          // "error" and the inline message below stays visible instead.
        }}
      />
    </>
  );
}
