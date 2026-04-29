"use client";

import { useState } from "react";
import type { UserEntitlements } from "@/lib/domain/entitlements";

type PlanSectionProps = {
  entitlements: UserEntitlements;
  upgradeUrl: string | null;
};

type Feature = {
  label: string;
  enabled: boolean;
};

export function PlanSection({ entitlements, upgradeUrl }: PlanSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const features: Feature[] = [
    { label: "Unlimited wardrobe items", enabled: true },
    { label: "Outfit generation", enabled: true },
    { label: "AI feature labels & garment tagging", enabled: entitlements.feature_labels_enabled },
    { label: "Receipt photo scanning", enabled: entitlements.receipt_ocr_enabled },
    { label: "Product URL ingestion", enabled: entitlements.product_url_ingestion_enabled },
    { label: "Outfit decomposition", enabled: entitlements.outfit_decomposition_enabled }
  ];

  const tierLabel = entitlements.plan_tier === "free"
    ? "Free"
    : entitlements.plan_tier === "pro"
    ? "Pro"
    : "Premium";

  return (
    <div className="pw-panel-soft space-y-0 p-6">
      <p className="pw-kicker">Your Plan</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="pw-chip normal-case tracking-normal">{tierLabel}</span>
        <div className="flex items-center gap-3">
          {upgradeUrl && entitlements.plan_tier === "free" && (
            <a
              href={upgradeUrl}
              className="text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
            >
              Upgrade plan →
            </a>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-xs italic text-[var(--muted)] transition-colors hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            ?
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
          <p className="pw-kicker">What&apos;s included</p>
          <ul className="mt-2 space-y-2">
            {features.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5">
                <span
                  className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full"
                  style={{
                    background: f.enabled
                      ? "var(--foreground)"
                      : "rgba(26,25,22,0.18)"
                  }}
                />
                <span
                  className="text-sm leading-snug"
                  style={{ color: f.enabled ? "var(--foreground)" : "var(--muted)" }}
                >
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
          {upgradeUrl && entitlements.plan_tier === "free" && (
            <a
              href={upgradeUrl}
              className="pw-button-primary mt-4 inline-flex"
            >
              Upgrade to Premium →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
