"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { showAppToast } from "@/lib/ui/app-toast";

const DISPOSAL_REASONS = ["sold", "given away", "damaged", "lost"] as const;

type DisposalSheetProps = {
  open: boolean;
  garmentId: string;
  onClose: () => void;
  archiveAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
  /** Optional — when supplied alongside `undoAction`, disposing shows the standing "undoable" toast. */
  pieceName?: string;
  undoAction?: (garmentId: string) => Promise<void>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/**
 * 18a / w6c — "what happened to it": sold, given away, damaged, or lost.
 * Standing rule: "Deletion is undoable and says so in a toast" — archiving is
 * the soft delete here, so a successful disposal offers the same undo toast
 * as ArchiveControl when the caller passes pieceName/undoAction.
 */
export function DisposalSheet({
  open,
  garmentId,
  onClose,
  archiveAction,
  pieceName,
  undoAction
}: DisposalSheetProps) {
  const [state, formAction] = useActionState(archiveAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;

    if (pieceName && undoAction) {
      showAppToast({
        message: `Let go — ${pieceName} left the wardrobe.`,
        actionLabel: "undo",
        onAction: () => {
          void undoAction(garmentId).then(() => router.refresh());
        }
      });
    }

    onClose();
    router.push("/wardrobe");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <BottomSheet open={open} onClose={onClose} title="what happened to it?">
      <form action={formAction}>
        <input type="hidden" name="garment_id" value={garmentId} />
        {DISPOSAL_REASONS.map((reason, index) => (
          <button key={reason} type="submit" name="reason" value={reason} className="w-full text-left">
            <SheetAction last={index === DISPOSAL_REASONS.length - 1}>{reason}</SheetAction>
          </button>
        ))}
      </form>
      {state.status === "error" ? (
        <p className="pt-3 text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </BottomSheet>
  );
}
