"use client";

import { Dialog } from "@/components/garderobe/dialog";

type UsedElsewhereDialogProps = {
  open: boolean;
  activeOutfitCount: number;
  hasActiveListing: boolean;
  onClose: () => void;
  onArchiveInstead: () => void;
};

/** 18b / w6c — refuse to delete a piece that's used elsewhere; offer to archive it. */
export function UsedElsewhereDialog({
  open,
  activeOutfitCount,
  hasActiveListing,
  onClose,
  onArchiveInstead
}: UsedElsewhereDialogProps) {
  const parts = [
    activeOutfitCount > 0 ? `${activeOutfitCount} saved look${activeOutfitCount === 1 ? "" : "s"}` : null,
    hasActiveListing ? "a live local listing" : null
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="this piece is used elsewhere"
      description={`It's in ${parts.join(" and ")}. Archive it instead, so it leaves the wardrobe without breaking those.`}
      cancelLabel="cancel"
      confirmLabel="archive instead"
      onConfirm={onArchiveInstead}
    />
  );
}
