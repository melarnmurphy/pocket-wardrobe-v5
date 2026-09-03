import { getUserEntitlements, hasPaidPlan } from "@/lib/domain/entitlements/service";
import { getBillingStatus } from "@/lib/domain/billing/service";
import { PaywallGate } from "@/components/garderobe/account/paywall-gate";
import { ScanForm } from "./scan-form";

/** 8a, in-store scan: is this worth buying, before you do. */
export default async function ScanPage() {
  const entitlements = await getUserEntitlements();
  const { upgradeUrl } = getBillingStatus();

  return (
    <PaywallGate
      unlocked={hasPaidPlan(entitlements)}
      feature="in_store_scan"
      teaserLabel="scan it"
      upgradeUrl={upgradeUrl}
    >
      <ScanForm />
    </PaywallGate>
  );
}
