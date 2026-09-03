"use client";

import { useState, type ReactNode } from "react";
import { PaywallInterruptSheet, PLUS_FEATURE_COPY } from "./paywall-interrupt-sheet";

type PaywallGateProps = {
  unlocked: boolean;
  feature: keyof typeof PLUS_FEATURE_COPY;
  teaserLabel: string;
  upgradeUrl: string | null;
  children: ReactNode;
};

/**
 * Wraps a plus-only surface: renders the real content when the user's plan
 * covers it, otherwise a locked teaser that opens PaywallInterruptSheet,
 * the interrupt that fires from a plus-only action (MODALS.md §5).
 */
export function PaywallGate({ unlocked, feature, teaserLabel, upgradeUrl, children }: PaywallGateProps) {
  const [open, setOpen] = useState(false);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full flex-col items-start gap-1 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-left"
      >
        <span className="text-[14px] text-[var(--ink)]">{teaserLabel}</span>
        <span className="text-[11.5px] text-[var(--stone)]">unlock with garderobe plus</span>
      </button>
      <PaywallInterruptSheet open={open} onClose={() => setOpen(false)} feature={feature} upgradeUrl={upgradeUrl} />
    </>
  );
}
