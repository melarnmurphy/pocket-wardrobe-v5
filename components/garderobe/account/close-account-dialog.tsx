"use client";

import { useActionState, useRef, useState } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import type { AccountActionState } from "@/app/account/photos-actions";

type CloseAccountDialogProps = {
  open: boolean;
  onClose: () => void;
  liveListingCount: number;
  openThreadCount: number;
  action: (previousState: AccountActionState, formData: FormData) => Promise<AccountActionState>;
};

const idleState: AccountActionState = { status: "idle", message: null };

function consequenceLine(liveListingCount: number, openThreadCount: number) {
  const parts = [
    liveListingCount > 0
      ? `${liveListingCount} live listing${liveListingCount === 1 ? "" : "s"}`
      : null,
    openThreadCount > 0 ? `${openThreadCount} open thread${openThreadCount === 1 ? "" : "s"}` : null
  ].filter(Boolean);

  const consequence =
    parts.length > 0
      ? `You have ${parts.join(" and ")}. Closing withdraws every listing and ends every conversation.`
      : "You have no live listings or open threads.";

  return `This is permanent — your wardrobe, photos, and history are gone. ${consequence}`;
}

/** MODALS.md §5 — "close the account": destructive, irreversible, type-to-confirm. */
export function CloseAccountDialog({
  open,
  onClose,
  liveListingCount,
  openThreadCount,
  action
}: CloseAccountDialogProps) {
  const [state, formAction] = useActionState(action, idleState);
  const [confirmation, setConfirmation] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="close your account?"
        description={consequenceLine(liveListingCount, openThreadCount)}
        cancelLabel="cancel"
        confirmLabel="close account"
        confirmVariant="on-blush"
        confirmDisabled={confirmation.trim().toLowerCase() !== "close"}
        onConfirm={() => formRef.current?.requestSubmit()}
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[var(--stone)]">type close to confirm</span>
          <input
            aria-label="type close to confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
          />
        </label>
        {state.status === "error" ? (
          <p className="pt-2 text-[11px] text-[var(--oxblood)]">{state.message}</p>
        ) : null}
      </Dialog>
      <form ref={formRef} action={formAction} className="hidden">
        <input type="hidden" name="confirmation" value={confirmation} />
      </form>
    </>
  );
}
