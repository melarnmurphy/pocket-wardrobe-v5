"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { deriveInitials } from "@/lib/ui/initials";
import { signOutAction } from "@/app/auth/actions";

type AvatarMenuProps = {
  email: string;
  displayName: string | null;
};

export function AvatarMenu({ email, displayName }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const initials = deriveInitials(displayName, email);
  const label = displayName?.trim() || email;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--foreground)] text-[0.56rem] font-bold tracking-wide text-[var(--accent-foreground)] transition-opacity hover:opacity-80"
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[180px] overflow-hidden rounded-[10px] border border-[var(--line)] bg-white shadow-[0_8px_32px_rgba(26,25,22,0.14)]"
        >
          <div className="border-b border-[var(--line)] px-4 py-3" role="none">
            <p className="text-xs text-[var(--muted)]">{email}</p>
            <p className="mt-0.5 text-sm font-semibold">{label}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-[var(--paper)]"
          >
            Account settings
          </Link>
          <form action={signOutAction} role="none">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--paper)]"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
