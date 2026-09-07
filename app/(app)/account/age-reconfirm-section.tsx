"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/garderobe";
import { confirmAgeAction as defaultConfirmAgeAction } from "@/app/local/actions";

type AgeReconfirmSectionProps = {
  ageDeclined: boolean;
  confirmAgeAction?: () => Promise<void>;
};

/**
 * The self-service reversal for a permanent-by-default age decline: a user
 * who previously said they were under 18 can reconfirm here once that's no
 * longer true, rather than being locked out of local threads forever.
 * confirmAge() clears age_declined_at as well as setting age_confirmed_at,
 * so this is the only step needed — the gate itself (ListingGate) re-reads
 * the profile on next render and lets them through.
 */
export function AgeReconfirmSection({
  ageDeclined,
  confirmAgeAction = defaultConfirmAgeAction
}: AgeReconfirmSectionProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  if (!ageDeclined) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
      <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
        local threads
      </p>
      <p className="text-[12.5px] text-[var(--stone)]">
        local threads is off, because you said you were under 18. if that's changed, you can
        confirm your age again.
      </p>
      <PillButton
        type="button"
        fullWidth={false}
        variant="secondary"
        className="mt-3"
        disabled={isBusy}
        onClick={async () => {
          setIsBusy(true);
          await confirmAgeAction();
          setIsBusy(false);
          router.refresh();
        }}
      >
        confirm you're 18 or over
      </PillButton>
    </div>
  );
}
