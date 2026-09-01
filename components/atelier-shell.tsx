import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccountProfile } from "@/lib/domain/account/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { getSidebarCounts } from "@/lib/domain/sidebar/service";
import { GarderobeMark } from "@/components/garderobe-mark";
import { SidebarNav } from "@/components/sidebar-nav";
import { AtelierMenu } from "@/components/atelier-menu";
import { NotificationsBell } from "@/components/notifications-bell";
import { CommandPalette } from "@/components/command-palette";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";
import { deriveInitials } from "@/lib/ui/initials";

/**
 * w3a and every other desktop screen in Garderobe Web.dc.html share a
 * 232px left sidebar (logo, primary nav with counts, a "local threads"
 * section, a profile chip) rather than a top bar — see
 * docs/design/design_handoff_garderobe/Garderobe Web.dc.html lines
 * 276-305. The signed-out marketing homepage (w5a) is the one screen
 * that keeps a conventional top bar instead.
 */
export async function AtelierShell({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  const [isAdmin, profile, entitlements, counts] = user
    ? await Promise.all([
        isCurrentUserAdmin().catch(() => false),
        getAccountProfile().catch(() => null),
        getUserEntitlements().catch(() => null),
        getSidebarCounts().catch(() => ({
          wardrobe: 0,
          looks: 0,
          wishlist: 0,
          letGo: 0,
          nearby: 0,
          handovers: 0
        }))
      ])
    : [false, null, null, { wardrobe: 0, looks: 0, wishlist: 0, letGo: 0, nearby: 0, handovers: 0 }];

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col" style={{ background: "var(--cream)" }}>
        <div
          className="flex items-center justify-between border-b px-6 py-4 md:px-[60px]"
          style={{ borderColor: "rgba(30,26,23,.11)" }}
        >
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Garderobe">
              <GarderobeMark />
              <span className="text-[16px] text-[var(--ink)]">garderobe</span>
            </Link>
            <nav className="hidden items-center gap-6 text-[13px] sm:flex">
              <a href="#how-it-works" style={{ color: "var(--slate)" }}>
                how it works
              </a>
              <Link href="/local/nearby" style={{ color: "var(--slate)" }}>
                nearby
              </Link>
              <a href="#pricing" style={{ color: "var(--slate)" }}>
                pricing
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/sign-in?next=%2Fwardrobe" className="text-[13px] font-medium text-[var(--ink)]">
              sign in
            </Link>
            <Link
              href="/auth/sign-in?mode=signup&next=%2Fonboarding"
              className="rounded-[100px] px-5 py-[10px] text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--cream)]"
              style={{ background: "var(--oxblood)" }}
            >
              start your wardrobe
            </Link>
          </div>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  const initials = deriveInitials(profile?.display_name ?? null, user.email ?? "");
  const localName = profile?.display_name?.trim().toLowerCase() || user.email || "";

  const sidebarBody = (
    <div className="flex h-full flex-col py-6" style={{ background: "var(--paper-warm)" }}>
      <div className="flex items-center justify-between px-[22px]">
        <Link href="/wardrobe" className="flex items-center gap-2.5" aria-label="Garderobe">
          <GarderobeMark />
          <span className="text-[16px] text-[var(--ink)]">garderobe</span>
        </Link>
        <div className="flex items-center gap-1">
          <CommandPalette />
          <NotificationsBell />
        </div>
      </div>

      <SidebarNav counts={counts} />

      <div className="flex-1" />

      <div className="flex items-center gap-2.5 px-[22px]">
        <div
          className="h-7 w-7 shrink-0 rounded-full"
          style={{ background: "repeating-linear-gradient(135deg,#ded6c8 0 5px,#d0c7b6 5px 10px)" }}
        />
        <span className="flex-1 truncate text-[12px]" style={{ color: "var(--slate)" }}>
          {localName}
        </span>
        <AtelierMenu
          email={user.email ?? ""}
          displayName={profile?.display_name ?? null}
          planTier={entitlements?.plan_tier ?? "free"}
          isAdmin={isAdmin}
          triggerVariant="ellipsis"
        />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ background: "var(--cream)" }}>
      <aside
        className="hidden w-[232px] flex-none border-r md:flex"
        style={{ borderColor: "rgba(30,26,23,.11)" }}
      >
        {sidebarBody}
      </aside>

      <div
        className="flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{ borderColor: "rgba(30,26,23,.11)", background: "var(--paper-warm)" }}
      >
        <MobileNavToggle>{sidebarBody}</MobileNavToggle>
        <Link href="/wardrobe" className="flex items-center gap-2" aria-label="Garderobe">
          <GarderobeMark size={16} />
          <span className="text-[14px] text-[var(--ink)]">garderobe</span>
        </Link>
        <div className="flex items-center gap-1">
          <CommandPalette />
          <NotificationsBell />
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] text-[var(--cream)]">
            {initials}
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
