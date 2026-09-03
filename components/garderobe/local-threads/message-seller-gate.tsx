"use client";

import { ListingGate } from "@/components/garderobe/local-threads/listing-gate";
import { PillButton } from "@/components/garderobe";
import { startThreadAction } from "@/app/local/actions";

type MessageSellerGateProps = {
  listingId: string;
  ageConfirmed: boolean;
  ageDeclined: boolean;
  safetyBriefSeen: boolean;
};

/**
 * A buyer's first message on a listing is the buyer-side equivalent of
 * "list it locally": the first step that can lead to arranging an in-person
 * handover with a stranger. Gated the same way, via the shared ListingGate.
 * No `garmentId` is passed through, since a buyer doesn't own the piece
 * being sold — declining or dismissing the block falls back to
 * `router.back()`, landing them back on the nearby feed or wherever they
 * came from.
 */
export function MessageSellerGate({
  listingId,
  ageConfirmed,
  ageDeclined,
  safetyBriefSeen
}: MessageSellerGateProps) {
  return (
    <ListingGate ageConfirmed={ageConfirmed} ageDeclined={ageDeclined} safetyBriefSeen={safetyBriefSeen}>
      <form
        action={async (formData: FormData) => {
          const body = String(formData.get("message") ?? "").trim();
          if (!body) return;
          await startThreadAction(listingId, body);
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          name="message"
          rows={2}
          placeholder="is this still available?"
          className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
        <PillButton type="submit" fullWidth={false}>
          message the seller
        </PillButton>
      </form>
    </ListingGate>
  );
}
