"use client";

import { useState } from "react";
import Link from "next/link";
import { PillButton } from "@/components/garderobe/pill-button";

type EmailTakenDialogProps = {
  email: string;
  signInHref: string;
};

/** w5d — "that email already has a wardrobe", shown when sign-up hits an existing account. */
export function EmailTakenDialog({ email, signInHref }: EmailTakenDialogProps) {
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="dismiss"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-[rgba(12,10,9,.55)]"
      />
      <div className="gw-pop relative w-full max-w-[340px] rounded-[14px] bg-[var(--cream)] px-[22px] py-6 text-center">
        <div className="text-[21px] font-light leading-[1.25] text-[var(--ink)]">
          that email already has a wardrobe
        </div>
        <div className="px-0 py-[10px] pb-5 text-[12.5px] leading-[1.5] text-[var(--stone)]">
          An account already exists for {email}. Sign in instead, or reset the password if you do not remember it.
        </div>
        <div className="flex gap-[9px] pt-1">
          <PillButton variant="secondary" onClick={() => setOpen(false)} className="h-11">
            try another email
          </PillButton>
          <Link
            href={signInHref}
            className="flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-medium text-[var(--cream)]"
          >
            sign in instead
          </Link>
        </div>
      </div>
    </div>
  );
}
