"use client";

import { useActionState, useEffect, useRef } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import { showAppToast } from "@/lib/ui/app-toast";
import type { AccountActionState } from "@/app/account/photos-actions";

type DeletePhotosDialogProps = {
  open: boolean;
  onClose: () => void;
  garmentCount: number;
  action: (previousState: AccountActionState, formData: FormData) => Promise<AccountActionState>;
};

const idleState: AccountActionState = { status: "idle", message: null };

/** MODALS.md §5, "delete my photos, keep the records": a row in w3e with no dialog behind it. */
export function DeletePhotosDialog({ open, onClose, garmentCount, action }: DeletePhotosDialogProps) {
  const [state, formAction] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && state.message) {
      showAppToast({ tone: "success", message: state.message });
      onClose();
    }
  }, [state.status, state.message, onClose]);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="delete your photos?"
        description={`Removes every photo from your ${garmentCount} piece${garmentCount === 1 ? "" : "s"}. Names, wear history, prices and looks stay exactly as they are.`}
        cancelLabel="cancel"
        confirmLabel="delete photos"
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        {state.status === "error" ? (
          <p className="text-[11px] text-[var(--oxblood)]">{state.message}</p>
        ) : null}
      </Dialog>
      <form ref={formRef} action={formAction} className="hidden" />
    </>
  );
}
