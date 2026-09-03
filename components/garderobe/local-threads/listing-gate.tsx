"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AgeBlockedDialog, AgeCheckDialog } from "@/components/garderobe/local-threads/age-check-dialog";
import { SafetyBriefDialog } from "@/components/garderobe/local-threads/safety-brief-dialog";
import { confirmAgeAction, declineAgeAction, markSafetyBriefSeenAction } from "@/app/local/actions";

type ListingGateProps = {
  ageConfirmed: boolean;
  ageDeclined: boolean;
  safetyBriefSeen: boolean;
  onBlockedDismiss?: () => void;
  children: ReactNode;
  /**
   * The garment being listed. When given, declining or being blocked routes
   * to that garment's wardrobe page (matching
   * LOCAL_THREADS_TRUST_SAFETY_SPEC.md section 8's "routes back to
   * /wardrobe/{garmentId}"), which is a known destination rather than
   * whatever happens to be in browser history. Falls back to router.back()
   * when omitted, so the tested interface above still works without it.
   */
  garmentId?: string;
};

/**
 * Orchestrates the two one-time gates in front of any local-threads action
 * that can lead to meeting a stranger in person: listing a piece, or (via
 * MessageSellerGate) sending a buyer's first message on a listing. Both
 * gates share one profile-level "seen" flag each, so confirming age or
 * acknowledging the safety brief on one side of the marketplace covers the
 * other too. Age-declined is permanent for this build, see
 * LOCAL_THREADS_TRUST_SAFETY_SPEC.md section 8.
 */
export function ListingGate({
  ageConfirmed,
  ageDeclined,
  safetyBriefSeen,
  onBlockedDismiss,
  children,
  garmentId
}: ListingGateProps) {
  const router = useRouter();
  const [localAgeConfirmed, setLocalAgeConfirmed] = useState(ageConfirmed);
  const [localSafetyBriefSeen, setLocalSafetyBriefSeen] = useState(safetyBriefSeen);

  const leaveListingFlow = () => {
    if (garmentId) {
      router.push(`/wardrobe/${garmentId}`);
    } else {
      router.back();
    }
  };

  // Checked first, and unconditionally: a user with age_declined_at set is
  // blocked even if age_confirmed_at is also somehow set, since decline is
  // meant to be permanent for this build.
  if (ageDeclined) {
    return (
      <AgeBlockedDialog
        open
        onDismiss={() => {
          onBlockedDismiss?.();
          leaveListingFlow();
        }}
      />
    );
  }

  if (!localAgeConfirmed) {
    return (
      <AgeCheckDialog
        open
        onClose={() => {}}
        onConfirmAdult={async () => {
          await confirmAgeAction();
          setLocalAgeConfirmed(true);
        }}
        onDeclineUnderage={async () => {
          await declineAgeAction();
          leaveListingFlow();
        }}
      />
    );
  }

  if (!localSafetyBriefSeen) {
    return (
      <SafetyBriefDialog
        open
        onClose={() => {}}
        onAcknowledge={async () => {
          await markSafetyBriefSeenAction();
          setLocalSafetyBriefSeen(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
