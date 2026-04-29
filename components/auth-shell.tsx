import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccountProfile } from "@/lib/domain/account/service";
import { AvatarMenu } from "@/components/avatar-menu";

export async function AuthShell() {
  const user = await getOptionalUser();
  const isAdmin = user ? await isCurrentUserAdmin() : false;
  const profile = user ? await getAccountProfile().catch(() => null) : null;

  return (
    <header className="pw-shell-header sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-4 px-6 py-4 md:px-8">
        <div className="flex items-center gap-2 xl:gap-4">
          <Link href="/" className="pw-wordmark pw-nav-link mr-2 rounded-full px-3 py-2 flex-shrink-0">
            Pocket Wardrobe
          </Link>

          <nav className="flex flex-1 flex-wrap items-center gap-1">
            <Link href="/wardrobe" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Wardrobe
            </Link>
            <Link href="/lookbook" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Lookbook
            </Link>
            <Link href="/outfits" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Outfits
            </Link>
            <Link href="/trends" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Trends
            </Link>
            <Link href="/style-rules" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
              Style Rules
            </Link>
            {isAdmin && (
              <Link href="/admin/entitlements" className="pw-nav-link rounded-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                Admin
              </Link>
            )}
          </nav>

          <div className="flex-shrink-0">
            {user ? (
              <AvatarMenu
                email={user.email ?? ""}
                displayName={profile?.display_name ?? null}
              />
            ) : (
              <Link href="/auth/sign-in?next=%2Fwardrobe" className="pw-button-primary px-4 py-2 text-sm">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
