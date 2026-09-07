"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/garderobe";
import { CancelListingDialog } from "@/components/garderobe/local-threads/cancel-listing-dialog";
import { cancelListingAction } from "@/app/local/actions";

type ManageListingProps = {
  listingId: string;
  hasOffer: boolean;
  hasHandover: boolean;
  counterpartName: string | null;
  counterpartThreadId: string | null;
};

/** Missing item, "cancel a listing with a live offer" (also covers the plain cancel case,
 * which had no UI at all before this). */
export function ManageListing({
  listingId,
  hasOffer,
  hasHandover,
  counterpartName,
  counterpartThreadId
}: ManageListingProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-6">
      <p className="text-[11px] text-[var(--stone)]">this is your listing</p>
      <div className="mt-3 flex gap-2">
        <PillButton fullWidth={false} variant="secondary" onClick={() => setOpen(true)}>
          cancel listing
        </PillButton>
      </div>
      <CancelListingDialog
        open={open}
        counterpartName={counterpartName}
        hasOffer={hasOffer}
        hasHandover={hasHandover}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await cancelListingAction(listingId, counterpartThreadId ?? undefined);
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
