"use client";

import { useRef } from "react";
import { Dialog } from "@/components/garderobe/dialog";
import { openBillingPortalAction } from "@/app/account/billing-actions";

type PaymentFailedDialogProps = {
  open: boolean;
  onClose: () => void;
  upgradeUrl: string | null;
  hasStripeCustomer: boolean;
};

/**
 * MODALS.md section 5, payment failed or subscription lapsed. "Update
 * payment" opens Stripe's real self-service Customer Portal when this
 * account actually has a Stripe customer behind it; falls back to the
 * legacy upgradeUrl (or just closing) for the case where it doesn't.
 */
export function PaymentFailedDialog({ open, onClose, upgradeUrl, hasStripeCustomer }: PaymentFailedDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="your payment didn't go through"
        description="Garderobe plus features are paused until this is sorted, but nothing in your wardrobe is affected."
        cancelLabel="remind me later"
        confirmLabel="update payment"
        onConfirm={() => {
          if (hasStripeCustomer) {
            formRef.current?.requestSubmit();
          } else if (upgradeUrl) {
            window.location.href = upgradeUrl;
          } else {
            onClose();
          }
        }}
      />
      {hasStripeCustomer ? <form ref={formRef} action={openBillingPortalAction} className="hidden" /> : null}
    </>
  );
}
