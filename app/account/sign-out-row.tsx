"use client";

import { useState } from "react";
import { SignOutDialog } from "@/components/garderobe/account/sign-out-dialog";

export function SignOutRow() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pb-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
      >
        Sign out
      </button>
      <SignOutDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
