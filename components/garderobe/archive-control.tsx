"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { showAppToast } from "@/lib/ui/app-toast";
import { PillButton } from "./pill-button";

type ArchiveControlProps = {
  garmentId: string;
  pieceName: string;
  archiveAction: (
    previousState: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  undoAction: (garmentId: string) => Promise<void>;
};

const initialState: WardrobeActionState = { status: "idle", message: null };

/**
 * Standing rule: "Deletion is undoable and says so in a toast." Archiving is a
 * soft delete (see archiveGarment in lib/domain/wardrobe/service.ts) — the toast's
 * undo action calls unarchiveGarment, never a hard delete.
 */
export function ArchiveControl({ garmentId, pieceName, archiveAction, undoAction }: ArchiveControlProps) {
  const [state, formAction] = useActionState(archiveAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;

    showAppToast({
      message: `Let go — ${pieceName} left the wardrobe.`,
      actionLabel: "undo",
      onAction: () => {
        void undoAction(garmentId).then(() => router.refresh());
      }
    });
    router.push("/wardrobe");
  }, [state.status, garmentId, pieceName, undoAction, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="garment_id" value={garmentId} />
      <PillButton type="submit" variant="secondary">
        let it go
      </PillButton>
    </form>
  );
}
