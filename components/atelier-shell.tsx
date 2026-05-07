import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccountProfile } from "@/lib/domain/account/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { AtelierMenu } from "@/components/atelier-menu";
import { AtelierPrimaryNav } from "@/components/atelier-primary-nav";

export async function AtelierShell({ pathname }: { pathname: string }) {
  const user = await getOptionalUser();
  const [isAdmin, profile, entitlements] = user
    ? await Promise.all([
        isCurrentUserAdmin().catch(() => false),
        getAccountProfile().catch(() => null),
        getUserEntitlements().catch(() => null)
      ])
    : [false, null, null];

  return (
    <>
      <header className="atelier-top">
        <Link href="/wardrobe" className="atelier-wordmark" aria-label="Pocket Wardrobe — Closet">
          <span className="atelier-wordmark__mark">n</span>
          <span className="atelier-wordmark__dot">.</span>
        </Link>

        <AtelierPrimaryNav />

        {user ? (
          <AtelierMenu
            email={user.email ?? ""}
            displayName={profile?.display_name ?? null}
            planTier={entitlements?.plan_tier ?? "free"}
            isAdmin={isAdmin}
            pathname={pathname}
          />
        ) : (
          <Link href="/auth/sign-in?next=%2Fwardrobe" className="text-sm font-medium">
            Sign in
          </Link>
        )}
      </header>
    </>
  );
}
