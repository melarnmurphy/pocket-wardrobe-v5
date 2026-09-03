"use client";

import { Dialog } from "@/components/garderobe/dialog";

type PaymentFailedDialogProps = {
  open: boolean;
  onClose: () => void;
  upgradeUrl: string | null;
};

/** MODALS.md section 5, payment failed or subscription lapsed. */
export function PaymentFailedDialog({ open, onClose, upgradeUrl }: PaymentFailedDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="your payment didn't go through"
      description="Garderobe plus features are paused until this is sorted, but nothing in your wardrobe is affected."
      cancelLabel="remind me later"
      confirmLabel="update payment"
      onConfirm={() => {
        if (upgradeUrl) {
          window.location.href = upgradeUrl;
        } else {
          onClose();
        }
      }}
    >
      {upgradeUrl ? (
        <a href={upgradeUrl} className="sr-only">
          update payment
        </a>
      ) : null}
    </Dialog>
  );
}
