"use client";

import { Dialog } from "@/components/garderobe/dialog";

type SafetyBriefDialogProps = {
  open: boolean;
  onAcknowledge: () => void;
  onClose: () => void;
};

/** Missing item, "first listing safety brief". One-time, informational, no "no" answer. */
export function SafetyBriefDialog({ open, onAcknowledge, onClose }: SafetyBriefDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        onAcknowledge();
        onClose();
      }}
      title="before you list"
      description="meet in a public place, and never share your address. garderobe doesn't move money for you. arrange cash, payid or a bank transfer directly with the other person."
      confirmLabel="got it"
      hideCancel
      onConfirm={onAcknowledge}
    />
  );
}
