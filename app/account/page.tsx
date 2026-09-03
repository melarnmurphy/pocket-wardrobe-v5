import { AuthenticationError } from "@/lib/auth";
import { getUserEntitlements, isBillingLapsed } from "@/lib/domain/entitlements/service";
import { getAccountProfile } from "@/lib/domain/account/service";
import { getBillingStatus } from "@/lib/domain/billing/service";
import { getMyPublicProfilePreview, getOrCreateProfile } from "@/lib/domain/profile/service";
import { countWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listBlockedUsers } from "@/lib/domain/local-threads/threads-service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { AccountProfileForm } from "@/app/account/account-profile-form";
import { PlanSection } from "@/app/account/plan-section";
import { YouSection } from "@/app/account/you-section";
import { SignOutRow } from "@/app/account/sign-out-row";
import { PaymentFailedRow } from "@/app/account/payment-failed-row";

export default async function AccountPage() {
  try {
    const [profile, entitlements, garderobeProfile, publicPreview, garmentCount, blockedUsers] =
      await Promise.all([
        getAccountProfile(),
        getUserEntitlements(),
        getOrCreateProfile(),
        getMyPublicProfilePreview(),
        countWardrobeGarments(),
        listBlockedUsers()
      ]);
    const { upgradeUrl, checkoutEnabled } = getBillingStatus();

    const tierLabel =
      entitlements.plan_tier === "free"
        ? "Free plan"
        : entitlements.plan_tier === "pro"
        ? "Pro plan"
        : "Premium plan";

    return (
      <main className="pw-shell flex min-h-screen max-w-5xl flex-col gap-6 md:px-10">
        {isBillingLapsed(entitlements) ? (
          <PaymentFailedRow upgradeUrl={upgradeUrl} hasStripeCustomer={Boolean(entitlements.billing_customer_id)} />
        ) : null}
        {/* Editorial header */}
        <section className="border-b border-[var(--line)] pb-8 pt-2">
          <p className="pw-kicker">Account</p>
          <h1 className="mt-3 text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[0.95] tracking-[-0.06em] md:hidden">
            Personal settings.
          </h1>
          <h1 className="mt-3 hidden text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[0.95] tracking-[-0.06em] md:block">
            Personal settings for your wardrobe OS.
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pw-chip normal-case tracking-normal">{tierLabel}</span>
            <span className="pw-chip normal-case tracking-normal">
              {profile.preferred_location ?? "No location set"}
            </span>
          </div>
        </section>

        <AccountProfileForm
          email={profile.email}
          displayName={profile.display_name}
          preferredLocation={profile.preferred_location}
          region={profile.region}
          temperatureUnit={profile.temperature_unit}
          currencyUnit={profile.currency_unit}
        />

        <YouSection
          profile={garderobeProfile}
          preview={publicPreview}
          garmentCount={garmentCount}
          blockedUsers={blockedUsers}
        />

        <PlanSection entitlements={entitlements} checkoutEnabled={checkoutEnabled} />

        <SignOutRow />
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/account"
          title="Sign in to manage your account settings."
          description="Account preferences are tied to your authenticated Supabase user."
        />
      );
    }
    throw error;
  }
}
