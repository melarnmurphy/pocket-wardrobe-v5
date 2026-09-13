import Link from "next/link";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

export function WardrobeSnapshot({ garments }: { garments: GarmentListItem[] }) {
  const unwornCount = garments.filter((garment) => garment.wear_count === 0).length;
  const totalWears = garments.reduce((total, garment) => total + garment.wear_count, 0);
  const mostWorn = garments.reduce<GarmentListItem | null>(
    (current, garment) => (!current || garment.wear_count > current.wear_count ? garment : current),
    null
  );

  return (
    <section className="pw-panel p-5 md:p-6" aria-labelledby="wardrobe-snapshot-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="pw-kicker">Your wardrobe, at a glance</p>
          <h2 id="wardrobe-snapshot-title" className="mt-2 text-xl font-semibold tracking-[-0.04em]">
            Make the clothes you own work harder.
          </h2>
        </div>
        <Link href="/wardrobe" className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--oxblood)] underline">
          open wardrobe
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] border-y border-[var(--line)]">
        <SnapshotStat value={garments.length} label="pieces" />
        <SnapshotStat value={totalWears} label="wears logged" />
        <SnapshotStat value={unwornCount} label="waiting for a first wear" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <p>
          {mostWorn
            ? `${mostWorn.title?.trim() || mostWorn.category} is getting the most love.`
            : "Add a few pieces to start seeing your rotation."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/wardrobe?create=1" className="pw-button-secondary text-[10px]">
            add a piece
          </Link>
          <Link href="/outfits" className="pw-button-secondary text-[10px]">
            plan a look
          </Link>
        </div>
      </div>
    </section>
  );
}

function SnapshotStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 last:pr-0">
      <p className="text-2xl font-semibold tracking-[-0.05em] text-[var(--ink)]">{value}</p>
      <p className="mt-1 text-[10px] uppercase leading-4 tracking-[.12em] text-[var(--muted)]">{label}</p>
    </div>
  );
}
