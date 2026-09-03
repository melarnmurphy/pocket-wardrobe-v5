"use client";

import { Dialog } from "@/components/garderobe/dialog";

type AgeCheckDialogProps = {
  open: boolean;
  onConfirmAdult: () => void;
  onDeclineUnderage: () => void;
  onClose: () => void;
};

/** Missing item, "age check". Policy default on decline, LOCAL_THREADS_TRUST_SAFETY_SPEC.md section 8. */
export function AgeCheckDialog({ open, onConfirmAdult, onDeclineUnderage, onClose }: AgeCheckDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      onCancel={onDeclineUnderage}
      title="confirm you're 18 or over"
      description="local threads means arranging your own handover with a stranger, so it's for adults only."
      cancelLabel="I'm under 18"
      confirmLabel="I'm 18 or over"
      onConfirm={onConfirmAdult}
    />
  );
}

type AgeBlockedDialogProps = {
  open: boolean;
  onDismiss: () => void;
};

/** Terminal state after declining the age check. Names what still works, not just what doesn't. */
export function AgeBlockedDialog({ open, onDismiss }: AgeBlockedDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      title="local threads needs an adult"
      description="you can still browse nearby, but listing a piece or messaging a seller stays off until you're 18."
      confirmLabel="ok"
      hideCancel
      onConfirm={onDismiss}
    />
  );
}
