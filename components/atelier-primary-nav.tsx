"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY_NAV_ITEMS = [
  { id: "closet", label: "Closet", href: "/wardrobe" },
  { id: "planner", label: "Planner", href: "/outfits" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "trends", label: "Trends", href: "/trends" }
] as const;

export function AtelierPrimaryNav() {
  const pathname = usePathname();
  const active = activeId(pathname);

  return (
    <nav className="atelier-primary-nav" aria-label="Primary">
      {PRIMARY_NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="atelier-primary-nav__link"
          data-active={active === item.id ? "true" : "false"}
          aria-current={active === item.id ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function activeId(pathname: string): string | null {
  if (pathname.startsWith("/wardrobe")) return "closet";
  if (pathname.startsWith("/outfits")) return "planner";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/trends")) return "trends";
  return null;
}
