"use client";

import { Dialog } from "@/components/garderobe/dialog";

type CancelListingDialogProps = {
  open: boolean;
  counterpartName: string | null;
  hasOffer: boolean;
  hasHandover: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Missing item, "cancel a listing with a live offer". */
export function CancelListingDialog({
  open,
  counterpartName,
  hasOffer,
  hasHandover,
  onConfirm,
  onClose
}: CancelListingDialogProps) {
  const name = counterpartName ?? "the other person";
  const description = hasHandover
    ? `you have a handover arranged with ${name}. cancelling the listing cancels that too, and the thread ends.`
    : hasOffer
      ? `${name}'s offer closes and the thread ends. the piece stays in your wardrobe, but this can't be undone.`
      : "takes it off the nearby feed. the piece stays in your wardrobe.";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="cancel this listing?"
      description={description}
      confirmLabel="cancel listing"
      onConfirm={onConfirm}
    />
  );
}
