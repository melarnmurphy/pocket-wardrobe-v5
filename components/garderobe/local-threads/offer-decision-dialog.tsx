"use client";

import { Dialog } from "@/components/garderobe/dialog";

type OfferDecisionDialogProps = {
  open: boolean;
  variant: "decline" | "withdraw";
  counterpartName: string;
  offerCents: number;
  onConfirm: () => void;
  onClose: () => void;
};

/** Missing item, "decline an offer / withdraw an offer". One dialog, two directions. */
export function OfferDecisionDialog({
  open,
  variant,
  counterpartName,
  offerCents,
  onConfirm,
  onClose
}: OfferDecisionDialogProps) {
  const amount = `A$${Math.round(offerCents / 100)}`;

  if (variant === "decline") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="decline this offer?"
        description={`closes out ${counterpartName}'s ${amount} offer. they can still send another one.`}
        confirmLabel="decline"
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="withdraw your offer?"
      description={`removes your ${amount} offer to ${counterpartName}. you can offer again anytime.`}
      confirmLabel="withdraw"
      onConfirm={onConfirm}
    />
  );
}
