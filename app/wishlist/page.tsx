import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listWishlist } from "@/lib/domain/wishlist/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Chip, CutoutTile } from "@/components/garderobe";
import { AddWishlistForm } from "./add-wishlist-form";
import { RemoveWishlistButton } from "./remove-wishlist-button";

type SortKey = "unlocks" | "priceDrop" | "saved";

function formatMoney(cents: number | null) {
  if (cents === null) return "add later";
  return `A$${(cents / 100).toFixed(0)}`;
}

/** 15a / w3a — the things you want, ranked by how many looks each unlocks. */
export default async function WishlistPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const resolved = searchParams ? await searchParams : undefined;
    const sortParam = firstParam(resolved?.sort);
    const sort: SortKey = sortParam === "priceDrop" || sortParam === "saved" ? sortParam : "unlocks";

    const items = await listWishlist();
    const sorted = [...items].sort((a, b) => {
      if (sort === "unlocks") return b.unlockCount - a.unlockCount;
      if (sort === "priceDrop") {
        const aDrop = a.original_price_cents && a.price_cents ? a.original_price_cents - a.price_cents : 0;
        const bDrop = b.original_price_cents && b.price_cents ? b.original_price_cents - b.price_cents : 0;
        return bDrop - aDrop;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          wardrobe
        </Link>

        <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">
          {items.length} thing{items.length === 1 ? "" : "s"}
        </h1>
        <p className="pt-2 text-[12.5px] leading-[1.5] text-[var(--slate)]">
          you want, ranked by how many looks each would unlock
        </p>

        <div className="mt-5 flex flex-wrap gap-[7px]">
          {(["unlocks", "priceDrop", "saved"] as const).map((value) => (
            <Link key={value} href={`/wishlist?sort=${value}`} className="inline-block">
              <Chip variant={sort === value ? "selected" : "available"}>
                {value === "unlocks" ? "unlocks most" : value === "priceDrop" ? "price drop" : "saved"}
              </Chip>
            </Link>
          ))}
        </div>

        {sorted.length ? (
          <div className="mt-6 rounded-[4px] bg-[var(--cream)] px-[14px]">
            {sorted.map((item, index) => {
              const barWidth = Math.min(100, (item.unlockCount / Math.max(1, sorted[0]?.unlockCount ?? 1)) * 100);
              const isTop = index < 2;
              return (
                <div
                  key={item.id}
                  className={[
                    "flex items-center gap-[13px] py-[14px]",
                    index === sorted.length - 1 ? "" : "border-b border-[rgba(30,26,23,.11)]"
                  ].join(" ")}
                >
                  <div className="w-[60px] shrink-0">
                    <CutoutTile src={item.image_path} alt={item.title ?? "wishlist item"} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14.5px] text-[var(--ink)]">{item.title}</span>
                      <span className="text-[14px] text-[var(--ink)]">{formatMoney(item.price_cents)}</span>
                    </div>
                    {item.ownedSimilarCount > 0 ? (
                      <span className="mt-1 inline-block rounded-[100px] bg-[rgba(30,26,23,.07)] px-2 py-0.5 text-[10px] text-[var(--stone)]">
                        you own {item.ownedSimilarCount} like this
                      </span>
                    ) : (
                      <>
                        <div className="mt-1.5 h-[3px] w-[70px] overflow-hidden rounded-[2px] bg-[rgba(30,26,23,.12)]">
                          <div
                            className="h-full rounded-[2px]"
                            style={{
                              width: `${barWidth}%`,
                              background: isTop ? "var(--oxblood)" : "var(--stone)"
                            }}
                          />
                        </div>
                        <span
                          className="text-[10.5px] font-medium"
                          style={{ color: isTop ? "var(--oxblood)" : "var(--stone)" }}
                        >
                          unlocks {item.unlockCount} look{item.unlockCount === 1 ? "" : "s"}
                        </span>
                      </>
                    )}
                  </div>
                  <RemoveWishlistButton entryId={item.id} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
            <p className="text-[12.5px] text-[var(--stone)]">Nothing here yet. Paste a link below.</p>
          </div>
        )}

        <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            paste a link
          </p>
          <AddWishlistForm />
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wishlist"
          title="Sign in with Supabase to view your wishlist."
          description="This page reads user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
