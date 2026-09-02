"use client";

import { Dialog } from "@/components/garderobe/dialog";

type MergeDialogProps = {
  open: boolean;
  sourceTitle: string;
  targetTitle: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** 18a / w6c — "merge these two". */
export function MergeDialog({ open, sourceTitle, targetTitle, onClose, onConfirm }: MergeDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="merge these two?"
      description={`"${sourceTitle}" will merge into "${targetTitle}". Wear history moves across; this can't be undone.`}
      confirmLabel="merge"
      onConfirm={onConfirm}
    />
  );
}
