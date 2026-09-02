"use client";

import { useState } from "react";
import { Dialog } from "@/components/garderobe/dialog";

type SignedInElsewhereDialogProps = {
  onSignInAgain: () => void;
};

/**
 * w5c-adjacent — "signed in on another device". No trigger exists yet:
 * Supabase Auth here uses its default multi-session behaviour (concurrent
 * sign-ins are allowed), and there is no session-tracking table or webhook
 * that could detect a sign-in elsewhere and end this session. Wiring this
 * up for real means deciding whether Garderobe wants single-session
 * enforcement at all, which is a behavioural change, not a UI gap.
 */
export function SignedInElsewhereDialog({ onSignInAgain }: SignedInElsewhereDialogProps) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="signed in on another device"
      description="This session ended because the account signed in somewhere else. Sign in again to keep going."
      cancelLabel="dismiss"
      confirmLabel="sign in again"
      onConfirm={onSignInAgain}
    />
  );
}
