"use client";

import { useState } from "react";
import { Dialog } from "@/components/garderobe/dialog";

type EmailTakenDialogProps = {
  email: string;
  signInHref: string;
};

/** w5d — "that email already has a wardrobe", shown when sign-up hits an existing account. */
export function EmailTakenDialog({ email, signInHref }: EmailTakenDialogProps) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="that email already has a wardrobe"
      description={`An account already exists for ${email}. Sign in instead, or reset the password if you do not remember it.`}
      cancelLabel="try another email"
      confirmLabel="sign in instead"
      confirmHref={signInHref}
    />
  );
}
