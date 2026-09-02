"use client";

import { useActionState, useEffect } from "react";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import { PillButton } from "@/components/garderobe/pill-button";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  wardrobeActionState,
  type WardrobeActionState
} from "@/lib/domain/wardrobe/action-state";

type NewCollectionSheetProps = {
  open: boolean;
  garmentIds: string[];
  onClose: () => void;
  createAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

/** 18c / w6a — "new collection". */
export function NewCollectionSheet({ open, garmentIds, onClose, createAction }: NewCollectionSheetProps) {
  const [state, formAction] = useActionState(createAction, wardrobeActionState);

  useEffect(() => {
    if (open && state.status === "success") {
      showAppToast({ message: state.message || "Collection created.", tone: "success" });
      onClose();
    }
    // Only react to a fresh success while the sheet is open — closing must
    // not re-fire this once `open` flips back to true for the next use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <BottomSheet open={open} onClose={onClose} title="new collection">
      <form action={formAction} className="flex flex-col gap-3">
        {garmentIds.map((id) => (
          <input key={id} type="hidden" name="garment_id" value={id} />
        ))}
        <input
          type="text"
          name="name"
          placeholder="name this collection"
          required
          className="w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
        />
        <PillButton type="submit" className="h-11">
          create
        </PillButton>
        {state.status === "error" ? <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p> : null}
      </form>
    </BottomSheet>
  );
}
