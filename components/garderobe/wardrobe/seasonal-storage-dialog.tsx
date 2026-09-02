"use client";

import { Dialog } from "@/components/garderobe/dialog";

type SeasonalStorageDialogProps = {
  open: boolean;
  pieceName: string;
  onClose: () => void;
  onConfirm: () => void;
};

/**
 * Retire / store for the season — designed here, no mockup exists
 * (MODALS.md §1 marks it "missing"). One question, so a Dialog per the
 * standing rules. Names what does NOT happen (it is not archived, deleted,
 * or dropped from totals) rather than framing it as a warning, since
 * storing is a fully reversible, non-destructive action.
 */
export function SeasonalStorageDialog({ open, pieceName, onClose, onConfirm }: SeasonalStorageDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`store the ${pieceName} for the season?`}
      description="It stays in your wardrobe and still counts in your totals. This just tucks it out of the everyday grid until you bring it back."
      cancelLabel="cancel"
      confirmLabel="store it"
      onConfirm={onConfirm}
    />
  );
}
