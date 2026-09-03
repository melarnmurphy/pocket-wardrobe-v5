"use client";

import { useRef, useState } from "react";
import { Dialog } from "@/components/garderobe/dialog";

type ResetSentDialogProps = {
  email: string;
  next: string;
  resendAction: (formData: FormData) => void | Promise<void>;
};

/** w5b — "check your email", shown after a password reset request is sent. */
export function ResetSentDialog({ email, next, resendAction }: ResetSentDialogProps) {
  const [open, setOpen] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={resendAction} hidden>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
      </form>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="check your email"
        description={`We sent a reset link to ${email}. It is good for the next hour.`}
        cancelLabel="close"
        confirmLabel="resend link"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
    </>
  );
}
