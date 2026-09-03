"use client";

import { BottomSheet } from "@/components/garderobe/bottom-sheet";

/**
 * MODALS.md §5b: the only four plus features actually drawn in the
 * mockups. Wear planning, looks, and cost-per-wear are free in every drawn
 * tier and must never appear here, since that overclaim is exactly what
 * §5b flags in the w7c pricing hero.
 */
export const PLUS_FEATURE_COPY = {
  analytics: {
    title: "wardrobe analytics is a plus feature",
    description: "Cost-per-wear trends, cost-per-category, and your wardrobe's history over time."
  },
  in_store_scan: {
    title: "scan it is a plus feature",
    description: "A quick check on a price tag or a garment on the rail, before you buy it."
  },
  trend_calls: {
    title: "trend calls are a plus feature",
    description: "How covered you already are for a trend, what it would unlock, when to pack it away, and what's sitting on your let-go list."
  },
  availability: {
    title: "marking availability is a plus feature",
    description: "Flag a piece as available to the local marketplace straight from your wardrobe."
  }
} as const;

type PlusFeature = keyof typeof PLUS_FEATURE_COPY;

type PaywallInterruptSheetProps = {
  open: boolean;
  onClose: () => void;
  feature: PlusFeature;
  upgradeUrl: string | null;
};

/** MODALS.md §5: the paywall interrupt, drawn as a screen (9h) but missing as the interrupt itself. */
export function PaywallInterruptSheet({ open, onClose, feature, upgradeUrl }: PaywallInterruptSheetProps) {
  const copy = PLUS_FEATURE_COPY[feature];

  return (
    <BottomSheet open={open} onClose={onClose} title={copy.title} description={copy.description}>
      <div className="flex items-baseline gap-2 pb-4">
        <span className="text-[34px] font-light leading-none text-[var(--ink)]">A$69 a year</span>
        <span className="text-[12px] text-[var(--stone)]">or A$5.75 a month, and the wardrobe itself stays free</span>
      </div>
      <a
        href={upgradeUrl ?? "/account"}
        className="flex h-11 w-full items-center justify-center rounded-[100px] bg-[var(--oxblood)] text-[13px] text-[var(--cream)]"
      >
        see plans
      </a>
    </BottomSheet>
  );
}
