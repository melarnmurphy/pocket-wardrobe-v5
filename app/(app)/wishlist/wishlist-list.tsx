"use client";

import { useEffect, useState } from "react";
import { CutoutTile } from "@/components/garderobe";
import type { WishlistCard } from "@/lib/domain/wishlist";
import { RemoveWishlistButton } from "./remove-wishlist-button";

function formatMoney(cents: number | null) {
  if (cents === null) return "add later";
  return `A$${(cents / 100).toFixed(0)}`;
}

export function WishlistList({ items }: { items: WishlistCard[] }) {
  const [visibleItems, setVisibleItems] = useState(items);

  useEffect(() => setVisibleItems(items), [items]);

  return (
    <>
      <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">
        {visibleItems.length} thing{visibleItems.length === 1 ? "" : "s"}
      </h1>

      {visibleItems.length ? (
        <div className="mt-6 rounded-[4px] bg-[var(--cream)] px-[14px]">
          {visibleItems.map((item, index) => {
            const barWidth = Math.min(100, (item.unlockCount / Math.max(1, visibleItems[0]?.unlockCount ?? 1)) * 100);
            const isTop = index < 2;
            return (
              <div
                key={item.id}
                className={["flex items-center gap-[13px] py-[14px]", index === visibleItems.length - 1 ? "" : "border-b border-[rgba(30,26,23,.11)]"].join(" ")}
              >
                <div className="w-[60px] shrink-0"><CutoutTile src={item.image_path} alt={item.title ?? "wishlist item"} /></div>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[14.5px] text-[var(--ink)]">{item.title}</span>
                    <span className="text-[14px] text-[var(--ink)]">{formatMoney(item.price_cents)}</span>
                  </div>
                  {item.ownedSimilarCount > 0 ? (
                    <span className="mt-1 inline-block rounded-[100px] bg-[rgba(30,26,23,.07)] px-2 py-0.5 text-[10px] text-[var(--stone)]">you own {item.ownedSimilarCount} like this</span>
                  ) : (
                    <>
                      <div className="mt-1.5 h-[3px] w-[70px] overflow-hidden rounded-[2px] bg-[rgba(30,26,23,.12)]">
                        <div className="h-full rounded-[2px]" style={{ width: `${barWidth}%`, background: isTop ? "var(--oxblood)" : "var(--stone)" }} />
                      </div>
                      <span className="text-[10.5px] font-medium" style={{ color: isTop ? "var(--oxblood)" : "var(--stone)" }}>
                        unlocks {item.unlockCount} look{item.unlockCount === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </div>
                <RemoveWishlistButton
                  entryId={item.id}
                  onRemoved={(entryId) => setVisibleItems((current) => current.filter((candidate) => candidate.id !== entryId))}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-8 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
          <p className="text-[12.5px] text-[var(--stone)]">Nothing here yet. Paste a link below.</p>
        </div>
      )}
    </>
  );
}
