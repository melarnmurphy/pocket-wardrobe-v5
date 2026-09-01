import type { Metadata } from "next";
import Link from "next/link";
import { CutoutTile, PillButton } from "@/components/garderobe";

export const metadata: Metadata = {
  title: "Garderobe",
  description:
    "Garderobe turns a closet into a working system: structured garments, wear tracking, weather-aware outfit planning, and trend matching that explains itself."
};

const CLOSET_PREVIEW = [
  { name: "cowl-neck tee", wears: 41, cost: "1.10" },
  { name: "wide-leg trouser", wears: 28, cost: "4.60" },
  { name: "sheer blouse", wears: 3, cost: "62.00" },
  { name: "bias slip skirt", wears: 19, cost: "5.20" },
  { name: "black slip dress", wears: 12, cost: "9.80" },
  { name: "black heels", wears: 31, cost: "3.10" }
] as const;

const STATS = [
  { value: "4", unit: null, label: "ways in — photo, receipt, product link, or an email of orders" },
  { value: "$3.90", unit: null, label: "median cost per wear across a tracked wardrobe" },
  { value: "30", unit: "km", label: "default radius for resale handovers near you" }
] as const;

const FEATURES = [
  {
    label: "ingestion",
    title: "from messy inputs to clean garment records.",
    copy: "add a photo, product url, receipt, or inspiration image. the system turns it into a garment record, then keeps provenance and confidence visible for review."
  },
  {
    label: "planner",
    title: "weather, occasion, and repeat history in one view.",
    copy: "the outfit engine ranks valid combinations instead of guessing from freeform text, so the result is explainable and editable."
  },
  {
    label: "nearby",
    title: "what you stop wearing, sold to someone two suburbs away.",
    copy: "pieces you have not reached for in months get listed to a local thread. you agree a handover in norwood or the market; money stays between the two of you."
  }
] as const;

export default function HomePage() {
  return (
    <main>
      <section className="grid gap-8 px-6 py-10 md:px-[60px] md:py-14 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between gap-8">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[.22em]" style={{ color: "var(--stone)" }}>
              wardrobe operating system
            </p>
            <h1 className="pt-4 text-[clamp(2.4rem,6vw,3.6rem)] font-light leading-[1.05]" style={{ color: "var(--ink)" }}>
              know what you own.
              <br />
              <span style={{ color: "var(--oxblood)" }}>wear it better.</span>
            </h1>
            <p className="max-w-[38rem] pt-5 text-[14px] leading-[1.7]" style={{ color: "var(--slate)" }}>
              garderobe turns a closet into a working system: structured garments, wear tracking,
              weather-aware outfit planning, and trend matching that explains itself.
            </p>

            <div className="flex flex-wrap gap-3 pt-7">
              <Link href="/auth/sign-in?mode=signup&next=%2Fonboarding">
                <PillButton fullWidth={false}>start your wardrobe</PillButton>
              </Link>
              <Link href="/wardrobe">
                <PillButton fullWidth={false} variant="secondary">
                  see a real wardrobe
                </PillButton>
              </Link>
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-6 border-t pt-6"
            style={{ borderColor: "rgba(30,26,23,.14)" }}
          >
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-[28px] font-light leading-[1]" style={{ color: "var(--ink)" }}>
                  {stat.value}
                  {stat.unit ? (
                    <span className="pl-1 text-[15px]" style={{ color: "var(--stone)" }}>
                      {stat.unit}
                    </span>
                  ) : null}
                </p>
                <p className="pt-2 text-[11px] leading-[1.5]" style={{ color: "var(--stone)" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[4px] border" style={{ borderColor: "rgba(30,26,23,.11)", background: "var(--cream)" }}>
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: "var(--stone)" }}>
              your closet
            </p>
            <p className="text-[11px]" style={{ color: "var(--stone)" }}>
              214 pieces · 6 shown
            </p>
          </div>
          <div className="flex gap-2 px-5 pt-3">
            <span
              className="rounded-[100px] px-3 py-[6px] text-[11px]"
              style={{ background: "var(--ink)", color: "var(--cream)" }}
            >
              all
            </span>
            <span
              className="rounded-[100px] border px-3 py-[6px] text-[11px]"
              style={{ borderColor: "rgba(30,26,23,.2)", color: "var(--slate)" }}
            >
              worn this month
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 p-5">
            {CLOSET_PREVIEW.map((piece) => (
              <div key={piece.name}>
                <CutoutTile src={null} alt={piece.name} />
                <p className="pt-2 text-[12.5px]" style={{ color: "var(--ink)" }}>
                  {piece.name}
                </p>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px]" style={{ color: "var(--stone)" }}>
                    {piece.wears} wears
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--slate)" }}>
                    ${piece.cost}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="grid gap-10 border-t px-6 py-12 md:grid-cols-3 md:px-[60px]"
        style={{ borderColor: "rgba(30,26,23,.14)", background: "var(--paper)" }}
      >
        {FEATURES.map((feature) => (
          <div key={feature.label}>
            <p className="text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: "var(--oxblood)" }}>
              {feature.label}
            </p>
            <p className="max-w-[22rem] pt-3 text-[17px] leading-[1.35]" style={{ color: "var(--ink)" }}>
              {feature.title}
            </p>
            <p className="max-w-[22rem] pt-3 text-[12.5px] leading-[1.6]" style={{ color: "var(--slate)" }}>
              {feature.copy}
            </p>
          </div>
        ))}
      </section>

      <footer
        id="pricing"
        className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-6 md:px-[60px]"
        style={{ borderColor: "rgba(30,26,23,.14)" }}
      >
        <p className="text-[12px]" style={{ color: "var(--stone)" }}>
          garderobe · adelaide
        </p>
        <div className="flex gap-5 text-[12px]" style={{ color: "var(--stone)" }}>
          <span>privacy</span>
          <span>terms</span>
          <span>contact</span>
        </div>
      </footer>
    </main>
  );
}
