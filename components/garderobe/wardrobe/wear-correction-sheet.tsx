"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type WearCorrectionSheetProps = {
  open: boolean;
  wearEventId: string;
  wornAt: string;
  occasion: string | null;
  onClose: () => void;
  updateAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
  deleteAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18a / w6b — "remove or correct a logged wear". */
export function WearCorrectionSheet({
  open,
  wearEventId,
  wornAt,
  occasion,
  onClose,
  updateAction,
  deleteAction
}: WearCorrectionSheetProps) {
  const [updateState, updateFormAction] = useActionState(updateAction, idleState);
  const [deleteState, deleteFormAction] = useActionState(deleteAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (updateState.status !== "success" && deleteState.status !== "success") return;
    onClose();
    router.refresh();
  }, [updateState.status, deleteState.status, onClose, router]);

  return (
    <BottomSheet open={open} onClose={onClose} title="this wear">
      <form action={updateFormAction} className="flex flex-col gap-3">
        <input type="hidden" name="wear_event_id" value={wearEventId} />
        <label className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          worn on
          <input
            type="date"
            name="worn_at"
            defaultValue={wornAt.slice(0, 10)}
            className="mt-1 w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
          />
        </label>
        <label className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          occasion
          <input
            type="text"
            name="occasion"
            defaultValue={occasion ?? ""}
            className="mt-1 w-full rounded-[4px] border border-[rgba(30,26,23,.2)] bg-transparent px-3 py-2 text-[16px] text-[var(--ink)]"
          />
        </label>
        <button type="submit" className="rounded-[100px] bg-[var(--oxblood)] px-4 py-[10px] text-[12.5px] text-[var(--cream)]">
          save
        </button>
        {updateState.status === "error" ? (
          <p className="text-[11px] text-[var(--oxblood)]">{updateState.message}</p>
        ) : null}
      </form>
      <form action={deleteFormAction} className="pt-3">
        <input type="hidden" name="wear_event_id" value={wearEventId} />
        <button type="submit" className="text-[12.5px] text-[var(--oxblood)]">
          remove this wear
        </button>
      </form>
    </BottomSheet>
  );
}
