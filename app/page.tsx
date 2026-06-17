import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  CloudSun,
  LogIn,
  NotebookText,
  ScanSearch,
  Shirt,
  Sparkles,
  TrendingUp
} from "lucide-react";
import dressShot from "../bb-yellow-dress.jpg";

export const metadata: Metadata = {
  title: "Pocket Wardrobe",
  description:
    "A wardrobe operating system for garment tracking, outfit planning, and trend intelligence."
};

const features = [
  {
    icon: Shirt,
    title: "Wardrobe",
    copy:
      "Store owned items as structured garments, then edit color, fit, seasonality, and wear history."
  },
  {
    icon: NotebookText,
    title: "Lookbook",
    copy:
      "Save references, target outfits, and missing pieces without collapsing inspiration into ownership."
  },
  {
    icon: CloudSun,
    title: "Planner",
    copy:
      "Generate weather-aware outfits with occasion and repeat-history constraints."
  },
  {
    icon: TrendingUp,
    title: "Trends",
    copy:
      "Match global fashion signals to your wardrobe so trends become something you already own."
  }
] as const;

const steps = [
  "Capture garments from photos, product pages, or receipts.",
  "Normalize each item into a structured wardrobe record.",
  "Use weather, occasion, and trend signals to choose what to wear."
] as const;

const stats = [
  { label: "Structured wardrobe", value: "Owned items" },
  { label: "Explainable styling", value: "Rules + ranking" },
  { label: "Trend coverage", value: "Global signals" }
] as const;

export default function HomePage() {
  return (
    <main className="pw-shell pb-16 pt-8">
      <section className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <p className="pw-kicker">Pocket wardrobe operating system</p>
            <h1 className="pw-page-title max-w-none">
              Know what you own.
              <br />
              Wear it better.
            </h1>
            <p className="pw-page-copy max-w-2xl">
              Pocket Wardrobe turns a closet into a working system: structured
              garments, wear tracking, weather-aware outfit planning, and
              trend matching that explains itself.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/auth/sign-in?next=%2Fwardrobe" className="pw-button-primary">
                <LogIn size={16} />
                Sign in
              </Link>
              <Link href="/wardrobe" className="pw-button-secondary">
                <ArrowRight size={16} />
                Open wardrobe
              </Link>
              <Link href="/trends" className="pw-button-quiet">
                <Sparkles size={16} />
                View trends
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="pw-panel-soft p-4">
                <p className="pw-kicker">{stat.label}</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.04em]">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="pw-editorial-frame overflow-hidden p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="pw-editorial-cover min-h-[28rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,244,236,0.72))]">
              <Image
                src={dressShot}
                alt="Model wearing a pale yellow dress"
                className="h-full w-full object-cover object-[center_18%]"
                priority
                sizes="(max-width: 1024px) 100vw, 52vw"
              />

              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span className="pw-chip bg-white/90 text-[0.68rem] text-[var(--foreground)]">
                  wardrobe capture
                </span>
                <span className="pw-chip bg-white/90 text-[0.68rem] text-[var(--foreground)]">
                  cost per wear
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-black/10 bg-white/90 p-3 shadow-[0_14px_35px_rgba(17,17,17,0.08)] backdrop-blur">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
                    Weather
                  </p>
                  <p className="mt-1 text-sm font-semibold tracking-[-0.03em]">
                    Warm, light, event-ready
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/90 p-3 shadow-[0_14px_35px_rgba(17,17,17,0.08)] backdrop-blur">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
                    Outfit roles
                  </p>
                  <p className="mt-1 text-sm font-semibold tracking-[-0.03em]">
                    Dress, shoes, accessories
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/90 p-3 shadow-[0_14px_35px_rgba(17,17,17,0.08)] backdrop-blur">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
                    Trend match
                  </p>
                  <p className="mt-1 text-sm font-semibold tracking-[-0.03em]">
                    Soft neutrals, ruffles, column shapes
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="pw-panel-soft p-5">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
                  <ScanSearch size={16} />
                  Ingestion
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                  From messy inputs to clean garment records.
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  Add a photo, product URL, receipt, or inspiration image. The
                  system turns it into a garment record, then keeps provenance
                  and confidence visible for review.
                </p>
              </div>

              <div className="pw-panel-soft p-5">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
                  <CalendarRange size={16} />
                  Planner
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                  Weather, occasion, and repeat history in one view.
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  The outfit engine ranks valid combinations instead of guessing
                  from freeform text, so the result is explainable and editable.
                </p>
              </div>

              <div className="pw-panel-soft p-5">
                <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-[var(--muted)] uppercase">
                  <Sparkles size={16} />
                  Trends
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                  Global signals, matched back to your wardrobe.
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  SearXNG finds sources, extraction normalizes facts, and trend
                  matching tells you what you already own, what is adjacent, and
                  what is missing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <article key={feature.title} className="pw-panel-soft p-5">
            <feature.icon size={18} className="text-[var(--muted)]" />
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em]">
              {feature.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {feature.copy}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="pw-panel p-6">
          <p className="pw-kicker">How it works</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">
            A wardrobe system, not just storage.
          </h2>
          <ol className="mt-6 space-y-4">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[var(--accent-foreground)]">
                  {index + 1}
                </span>
                <p className="text-sm leading-7 text-[var(--muted)]">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="pw-panel-soft p-5 sm:col-span-2">
            <p className="pw-kicker">Why it feels different</p>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.05em]">
              The landing page leads with the product, not a marketing wall.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Testers land on a usable first screen, then can jump straight to
              the wardrobe, trends, or sign-in flow. The public page keeps the
              app legible before authentication.
            </p>
          </div>
          <div className="pw-panel-dark flex flex-col justify-between p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                Next step
              </p>
              <p className="mt-4 text-2xl font-semibold tracking-[-0.05em]">
                Open the wardrobe workspace.
              </p>
            </div>
            <Link href="/wardrobe" className="pw-button-secondary mt-6 w-fit">
              <ArrowRight size={16} />
              Open app
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
