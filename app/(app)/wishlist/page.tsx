import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listWishlist } from "@/lib/domain/wishlist/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Chip } from "@/components/garderobe";
import { AddWishlistForm } from "./add-wishlist-form";
import { WishlistList } from "./wishlist-list";

type SortKey = "unlocks" | "priceDrop" | "saved";

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

        <WishlistList items={sorted} />
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
