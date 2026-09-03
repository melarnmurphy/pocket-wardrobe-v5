import { getUserEntitlements, hasPaidPlan } from "@/lib/domain/entitlements/service";
import { getBillingStatus } from "@/lib/domain/billing/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { PaywallGate } from "@/components/garderobe/account/paywall-gate";
import { ScanForm } from "./scan-form";

/** 8a, in-store scan: is this worth buying, before you do. */
export default async function ScanPage() {
  try {
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
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe/scan"
          title="Sign in with Supabase to scan an item."
          description="This page checks your plan before letting you scan, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
