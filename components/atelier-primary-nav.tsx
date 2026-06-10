"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const PRIMARY_NAV_ITEMS = [
  { id: "closet", label: "Closet", href: "/wardrobe" },
  { id: "planner", label: "Planner", href: "/outfits" },
  { id: "calendar", label: "Calendar", href: "/calendar" },
  { id: "trends", label: "Trends", href: "/trends" }
] as const;

export function AtelierPrimaryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameActive = activeId(pathname);
  const [optimisticActive, setOptimisticActive] = useState<string | null>(null);
  const active = optimisticActive ?? pathnameActive;

  const navHrefs = useMemo(() => PRIMARY_NAV_ITEMS.map((item) => item.href), []);

  useEffect(() => {
    setOptimisticActive(null);
  }, [pathname]);

  useEffect(() => {
    navHrefs.forEach((href) => router.prefetch(href));
  }, [navHrefs, router]);

  return (
    <nav className="atelier-primary-nav" aria-label="Primary">
      {PRIMARY_NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOptimisticActive(item.id)}
          onMouseEnter={() => router.prefetch(item.href)}
          onTouchStart={() => router.prefetch(item.href)}
          className="atelier-primary-nav__link"
          data-active={active === item.id ? "true" : "false"}
          data-pending={optimisticActive === item.id && pathnameActive !== item.id ? "true" : "false"}
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
