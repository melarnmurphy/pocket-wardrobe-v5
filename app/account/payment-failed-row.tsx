"use client";

import { useState } from "react";
import { PaymentFailedDialog } from "@/components/garderobe/account/payment-failed-dialog";

export function PaymentFailedRow({ upgradeUrl }: { upgradeUrl: string | null }) {
  const [open, setOpen] = useState(true);
  return <PaymentFailedDialog open={open} onClose={() => setOpen(false)} upgradeUrl={upgradeUrl} />;
}
