"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarCounts } from "@/lib/domain/sidebar/service";

const PRIMARY_ITEMS = [
  { label: "today", href: "/wardrobe", countKey: null },
  { label: "wardrobe", href: "/wardrobe", countKey: "wardrobe" },
  { label: "looks", href: "/outfits", countKey: "looks" },
  { label: "calendar", href: "/calendar", countKey: null },
  { label: "trends", href: "/trends", countKey: null },
  { label: "wishlist", href: "/wishlist", countKey: "wishlist" },
  { label: "let go", href: "/wardrobe/let-go", countKey: "letGo" }
] as const;

const LOCAL_ITEMS = [
  { label: "nearby", href: "/local/nearby", countKey: "nearby" },
  { label: "handovers", href: "/local/threads", countKey: "handovers" }
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/wardrobe") return pathname === "/wardrobe";
  return pathname.startsWith(href);
}

function Row({
  label,
  href,
  count,
  onNavigate
}: {
  label: string;
  href: string;
  count: number | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, href);

  return (
    <Link
      href={href as never}
      onClick={onNavigate}
      className="flex items-center justify-between rounded-[5px] px-3 py-[10px] text-[13.5px]"
      style={{
        background: active ? "var(--cream)" : "transparent",
        color: active ? "var(--ink)" : "var(--slate)",
        fontWeight: active ? 500 : 400
      }}
    >
      <span>{label}</span>
      {count !== null ? (
        <span
          className="text-[11px]"
          style={{ color: count > 0 && (label === "let go" || label === "handovers") ? "var(--oxblood)" : "var(--stone)" }}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function SidebarNav({ counts, onNavigate }: { counts: SidebarCounts; onNavigate?: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-[2px] px-3 pt-7">
        {PRIMARY_ITEMS.map((item) => (
          <Row
            key={item.label}
            label={item.label}
            href={item.href}
            count={item.countKey ? counts[item.countKey] : null}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      <div className="mx-3 mt-[22px] flex flex-col gap-[2px] border-t pt-4" style={{ borderColor: "rgba(30,26,23,.11)" }}>
        <p className="px-3 pb-[10px] text-[8px] font-semibold uppercase tracking-[.18em]" style={{ color: "var(--stone)" }}>
          local threads
        </p>
        {LOCAL_ITEMS.map((item) => (
          <Row
            key={item.label}
            label={item.label}
            href={item.href}
            count={item.countKey ? counts[item.countKey] : null}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </>
  );
}
