"use client";

import { useState } from "react";
import Link from "next/link";
import { deriveInitials } from "@/lib/ui/initials";
import { signOutAction } from "@/app/auth/actions";

type AtelierMenuProps = {
  email: string;
  displayName: string | null;
  planTier: string;
  isAdmin: boolean;
  pathname: string;
};

const NAV_ITEMS = [
  { label: "Lookbook", href: "/lookbook" },
  { label: "Style rules", href: "/style-rules" },
  { label: "Account settings", href: "/account" }
] as const;

export function AtelierMenu({ email, displayName, planTier, isAdmin, pathname }: AtelierMenuProps) {
  const [open, setOpen] = useState(false);
  const initials = deriveInitials(displayName, email);
  const tierLabel =
    planTier === "free" ? "Free plan" : planTier === "pro" ? "Pro plan" : "Premium plan";
  const label = displayName?.trim() || email;

  return (
    <>
      {/* MM circle — replaces hamburger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--foreground)] text-[0.5rem] font-bold tracking-wide text-[var(--accent-foreground)]"
      >
        {initials}
      </button>

      {/* Overlay + slide-down panel */}
      {open && (
        <>
          {/* dim overlay */}
          <div
            className="fixed inset-0 z-40 bg-[var(--foreground)]/20"
            onClick={() => setOpen(false)}
          />

          {/* menu panel */}
          <div className="fixed inset-x-0 top-0 z-50 overflow-hidden rounded-b-[18px] bg-white shadow-[0_12px_40px_rgba(26,25,22,0.18)]">
            {/* header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <span className="font-display text-lg font-bold tracking-tight">n.</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-lg leading-none text-[var(--muted)]"
              >
                ✕
              </button>
            </div>

            {/* profile card */}
            <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-[0.6rem] font-bold tracking-wide text-[var(--accent-foreground)]">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-[var(--muted)]">{email}</p>
                <span className="mt-1 inline-block rounded-full border border-[var(--line)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {tierLabel}
                </span>
              </div>
            </div>

            {/* nav items */}
            <nav className="py-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-[var(--line)]/50 px-5 py-3.5 text-sm last:border-b-0"
                  style={{
                    fontWeight: pathname.startsWith(item.href) ? 700 : 400
                  }}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin/entitlements"
                  onClick={() => setOpen(false)}
                  className="block border-t border-[var(--line)]/50 px-5 py-3.5 text-sm"
                >
                  Admin
                </Link>
              )}
            </nav>

            {/* sign out */}
            <div className="border-t border-[var(--line)] px-5 py-4">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-sm text-[var(--muted)] underline underline-offset-2"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
