"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/garderobe/bottom-sheet";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";

type RecutSheetProps = {
  open: boolean;
  garmentId: string;
  onClose: () => void;
  addImageAction: (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;
};

const idleState: WardrobeActionState = { status: "idle", message: null };

/** 18d / w6c — "recut the photo": replace the hero image with a fresh upload. */
export function RecutSheet({ open, garmentId, onClose, addImageAction }: RecutSheetProps) {
  const [state, formAction] = useActionState(addImageAction, idleState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  return (
    <BottomSheet open={open} onClose={onClose} title="recut the photo" description="upload a clearer shot to cut out again">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="garment_id" value={garmentId} />
        <input type="file" name="image" accept="image/*" required />
        <button type="submit" className="rounded-[100px] bg-[var(--oxblood)] px-4 py-[10px] text-[12.5px] text-[var(--cream)]">
          recut
        </button>
        {state.status === "error" ? <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p> : null}
      </form>
    </BottomSheet>
  );
}
