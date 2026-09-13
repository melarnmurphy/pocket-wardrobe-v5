import Link from "next/link";
import { CutoutTile, HairlineListRow } from "@/components/garderobe";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";

type WardrobeInsightsProps = {
  garments: GarmentListItem[];
};

/** The editorial, decision-led snapshot from the Garderobe web handoff. */
export function WardrobeInsights({ garments }: WardrobeInsightsProps) {
  const unworn = garments.filter((garment) => garment.wear_count === 0);
  const priced = garments.filter(
    (garment) => garment.purchase_price != null && garment.cost_per_wear != null
  );
  const highestCostPerWear = [...priced].sort(
    (left, right) => (right.cost_per_wear ?? 0) - (left.cost_per_wear ?? 0)
  )[0] ?? null;
  const totalValue = garments.reduce((total, garment) => total + (garment.purchase_price ?? 0), 0);

  if (garments.length === 0) return null;

  return (
    <section className="pw-panel p-5 md:p-6" aria-labelledby="wardrobe-insights-title">
      <div className="pw-page-head gap-4">
        <div>
          <p className="pw-kicker">the useful part</p>
          <h2 id="wardrobe-insights-title" className="mt-2 text-[26px] font-light leading-[1.05] tracking-[-0.04em]">
            wear more. waste less.
          </h2>
          <p className="mt-2 max-w-md text-[12.5px] leading-6 text-[var(--slate)]">
            a small read on what your wardrobe is asking for next.
          </p>
        </div>
        <Link href="/wardrobe" className="pw-button-secondary text-[10px] uppercase tracking-[.16em]">
          see every piece
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <InsightStat value={String(unworn.length)} label="waiting for a first wear" tone={unworn.length ? "blush" : "plain"} />
        <InsightStat value={priced.length ? formatMoney(highestCostPerWear?.cost_per_wear ?? 0, highestCostPerWear?.purchase_currency) : "—"} label="highest cost per wear" tone="plain" />
        <InsightStat value={totalValue ? formatMoney(totalValue, garments[0]?.purchase_currency) : "—"} label="tracked wardrobe value" tone="plain" />
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-1">
        {unworn.slice(0, 2).map((garment, index) => (
          <HairlineListRow key={garment.id} last={index === Math.min(unworn.length, 2) - 1}>
            <div className="h-14 w-11 shrink-0">
              <CutoutTile src={garment.preview_url} alt={garment.title ?? garment.category} sizes="44px" className="h-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-[var(--ink)]">{garment.title?.trim() || garment.category}</p>
              <p className="mt-1 text-[11px] text-[var(--stone)]">hasn&apos;t had its first wear yet</p>
            </div>
            <Link href={`/wardrobe/${garment.id}`} className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--oxblood)]">
              open
            </Link>
          </HairlineListRow>
        ))}
        {unworn.length === 0 ? (
          <p className="py-4 text-[12.5px] text-[var(--slate)]">everything has been worn at least once. nice rotation.</p>
        ) : null}
      </div>
    </section>
  );
}

function InsightStat({ value, label, tone }: { value: string; label: string; tone: "plain" | "blush" }) {
  return (
    <div className={["rounded-[var(--radius-card)] border border-[var(--line)] px-4 py-4", tone === "blush" ? "bg-[var(--blush)]" : "bg-[var(--paper)]"].join(" ")}>
      <p className="text-[26px] font-light leading-none tracking-[-0.04em] text-[var(--ink)]">{value}</p>
      <p className="mt-2 text-[10px] uppercase leading-4 tracking-[.14em] text-[var(--stone)]">{label}</p>
    </div>
  );
}

function formatMoney(value: number, currency?: string | null) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency || "AUD",
    maximumFractionDigits: 0
  }).format(value);
}
