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
 *
 * Presentational only, for this phase. This gate controls what a user sees,
 * not what data reaches the client or what a server action will accept.
 * Because React Server Components serialise children before this client
 * component decides whether to show them, the gated `children` are already
 * sent to the browser regardless of the `unlocked` prop, and none of the
 * underlying actions or data fetches this gate wraps enforce plan_tier on
 * the server. A technically sophisticated user could see the gated content
 * in the network response or call the underlying action or route directly,
 * bypassing this gate entirely. Real server-side enforcement, gating the
 * data fetch itself and adding assertPaidPlanAccess checks to the
 * underlying actions and routes, is a follow-on task and has not been done
 * yet.
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
