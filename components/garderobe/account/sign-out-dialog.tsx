"use client";

import { useRef } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import { signOutAction } from "@/app/auth/actions";

type SignOutDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** MODALS.md §5 — sign out: one question, no consequence to name beyond the obvious. */
export function SignOutDialog({ open, onClose }: SignOutDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="sign out?"
        description="You'll need to sign back in to see your wardrobe on this device."
        cancelLabel="stay signed in"
        confirmLabel="sign out"
        onConfirm={() => formRef.current?.requestSubmit()}
      />
      <form ref={formRef} action={signOutAction} data-testid="sign-out-form" className="hidden" />
    </>
  );
}
