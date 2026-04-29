import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { isCurrentUserAdmin } from "@/lib/admin";
import { getAccountProfile } from "@/lib/domain/account/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { AtelierMenu } from "@/components/atelier-menu";

export async function AtelierShell({ pathname }: { pathname: string }) {
  const user = await getOptionalUser();
  const isAdmin = user ? await isCurrentUserAdmin() : false;
  const [profile, entitlements] = user
    ? await Promise.all([
        getAccountProfile().catch(() => null),
        getUserEntitlements().catch(() => null)
      ])
    : [null, null];

  return (
    <>
      <header className="atelier-top">
        <Link href="/wardrobe" className="atelier-wordmark" aria-label="Pocket Wardrobe — Closet">
          <span className="atelier-wordmark__mark">n</span>
          <span className="atelier-wordmark__dot">.</span>
        </Link>

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

      <AtelierDock pathname={pathname} />
    </>
  );
}

const DOCK_ITEMS = [
  { id: "closet", label: "Closet", href: "/wardrobe", glyph: "hanger" },
  { id: "planner", label: "Planner", href: "/outfits", glyph: "tee" },
  { id: "calendar", label: "Calendar", href: "/calendar", glyph: "calendar" },
  { id: "trends", label: "Trends", href: "/trends", glyph: "trend" }
] as const;

function activeId(pathname: string): string | null {
  if (pathname.startsWith("/wardrobe")) return "closet";
  if (pathname.startsWith("/outfits")) return "planner";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/trends")) return "trends";
  return null;
}

function AtelierDock({ pathname }: { pathname: string }) {
  const active = activeId(pathname);
  const left = DOCK_ITEMS.slice(0, 2);
  const right = DOCK_ITEMS.slice(2);

  return (
    <nav className="atelier-dock" aria-label="Primary">
      <div className="atelier-dock__rail">
        <div className="atelier-dock__col">
          {left.map((item) => (
            <DockLink key={item.id} item={item} active={active === item.id} />
          ))}
        </div>
        <Link href="/wardrobe" className="atelier-fab" aria-label="Add to wardrobe">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <line x1="11" y1="3" x2="11" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </Link>
        <div className="atelier-dock__col">
          {right.map((item) => (
            <DockLink key={item.id} item={item} active={active === item.id} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function DockLink({
  item,
  active
}: {
  item: (typeof DOCK_ITEMS)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className="atelier-dock__link"
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
    >
      <DockIcon glyph={item.glyph} />
      <span>{item.label}</span>
    </Link>
  );
}

function DockIcon({ glyph }: { glyph: "hanger" | "tee" | "calendar" | "trend" }) {
  switch (glyph) {
    case "hanger":
      return (
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <path
            d="M11 6c0-1.5 1.2-2.7 2.7-2.7S16.4 4.5 16.4 6c0 .8-.4 1.5-1 1.9L11 11l-9.5 5.4a1 1 0 00.5 1.9h18a1 1 0 00.5-1.9L11 11"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "tee":
      return (
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <path
            d="M3 4l4-2 1.5 2h5L15 2l4 2 2 4-3 1v7H4v-7L1 8l2-4z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2" y="4" width="16" height="4" rx="2" fill="currentColor" />
          <line x1="6" y1="2" x2="6" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="14" y1="2" x2="14" y2="6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "trend":
      return (
        <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
          <polyline
            points="1,14 6,10 10,12 14,5 18,7 21,3"
            stroke="currentColor"
            strokeWidth="1.3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M21 3l-3 0M21 3l0 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
  }
}
