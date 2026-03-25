import { AuthenticationError } from "@/lib/auth";
import { AuthorizationError, getRequiredAdminUser } from "@/lib/admin";
import { getBillingStatus, getPremiumFeatureSummary } from "@/lib/domain/billing/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { PremiumUpsellCard } from "@/components/premium-upsell-card";
import { EntitlementAdminForm } from "@/app/admin/entitlements/entitlement-admin-form";
import { PasswordAdminForm } from "@/app/admin/entitlements/password-admin-form";

export default async function AdminEntitlementsPage() {
  try {
    const adminUser = await getRequiredAdminUser();
    const billingStatus = getBillingStatus();
    const premiumFeatures = getPremiumFeatureSummary();

    return (
      <main className="pw-shell flex min-h-screen max-w-5xl flex-col gap-8 md:px-10">
        <section className="pw-panel-soft p-6">
          <p className="pw-kicker">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
            Entitlement Controls
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Signed in as {adminUser.email}. This page is gated by <code>ADMIN_EMAILS</code>.
          </p>
        </section>

        <EntitlementAdminForm />
        <PasswordAdminForm />

        <PremiumUpsellCard
          title="Billing Scaffold Status"
          description="The upgrade UI and sync endpoint are ready. Until a billing provider exists, use this page or the secret-gated sync API to move users between free, pro, and premium."
          features={premiumFeatures}
          upgradeUrl={billingStatus.upgradeUrl}
          checkoutEnabled={billingStatus.checkoutEnabled}
        />
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/admin/entitlements"
          title="Sign in to access the entitlement admin."
          description="This admin area requires an authenticated Supabase session."
        />
      );
    }

    if (error instanceof AuthorizationError) {
      return (
        <main className="pw-shell flex min-h-screen max-w-3xl flex-col gap-6 py-16 text-center md:px-10">
          <div className="pw-panel-soft p-8">
            <p className="pw-kicker">Restricted</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
              Admin access required
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Add your email address to <code>ADMIN_EMAILS</code> to use the in-app entitlement
              controls.
            </p>
          </div>
        </main>
      );
    }

    throw error;
  }
}
