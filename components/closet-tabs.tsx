"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const CLOSET_TABS: ReadonlyArray<{ id: string; label: string; href: Route }> = [
  { id: "items", label: "Wardrobe", href: "/wardrobe" },
  { id: "outfits", label: "Outfits", href: "/wardrobe/outfits" as Route },
  { id: "avatar", label: "Avatar", href: "/wardrobe/avatar" as Route }
];

export function ClosetTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameActive = closetActiveId(pathname);
  const [optimisticActive, setOptimisticActive] = useState<string | null>(null);
  const active = optimisticActive ?? pathnameActive;
  const hrefs = useMemo(() => CLOSET_TABS.map((tab) => tab.href), []);

  useEffect(() => {
    setOptimisticActive(null);
  }, [pathname]);

  useEffect(() => {
    hrefs.forEach((href) => router.prefetch(href));
  }, [hrefs, router]);

  return (
    <div className="closet-tabs">
      {CLOSET_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          onClick={() => setOptimisticActive(tab.id)}
          onMouseEnter={() => router.prefetch(tab.href)}
          onTouchStart={() => router.prefetch(tab.href)}
          className="closet-tab"
          data-active={active === tab.id ? "true" : "false"}
          data-pending={optimisticActive === tab.id && pathnameActive !== tab.id ? "true" : "false"}
          aria-current={active === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function closetActiveId(pathname: string): string {
  if (pathname.startsWith("/wardrobe/avatar")) return "avatar";
  if (pathname.startsWith("/wardrobe/outfits")) return "outfits";
  return "items";
}
