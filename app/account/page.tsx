import { AuthenticationError } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { getAccountProfile } from "@/lib/domain/account/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { AccountProfileForm } from "@/app/account/account-profile-form";

export default async function AccountPage() {
  try {
    const [profile, entitlements] = await Promise.all([
      getAccountProfile(),
      getUserEntitlements()
    ]);

    return (
      <main className="pw-shell flex min-h-screen max-w-5xl flex-col gap-8 md:px-10">
        <section className="pw-editorial-frame p-6">
          <div className="space-y-3">
            <p className="pw-kicker">Account</p>
            <h1 className="text-4xl font-semibold tracking-[-0.06em]">
              Personal settings for your wardrobe OS.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Update the account details that shape how the planner behaves day to day.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <span className="pw-chip normal-case tracking-normal">
              {entitlements.plan_tier} plan
            </span>
            <span className="pw-chip normal-case tracking-normal">
              {profile.preferred_location ?? "No preferred location set"}
            </span>
          </div>
        </section>

        <AccountProfileForm
          email={profile.email}
          preferredLocation={profile.preferred_location}
        />
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
