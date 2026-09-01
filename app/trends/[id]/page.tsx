import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { loadTrendsPageData } from "@/app/trends/actions";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { unlockCountForCandidate } from "@/lib/domain/outfits/unlock";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Chip } from "@/components/garderobe";

const PHASE_LABEL: Record<string, string> = {
  candidate: "just arriving",
  emerging: "rising",
  confirmed: "peaking",
  dominant: "peaking",
  cooling: "fading",
  flat: "over"
};

/** 2b — a trend, how covered you already are, and what's missing. */
export default async function TrendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { trendMatches } = await loadTrendsPageData();
    const entry = trendMatches.find((item) => item.signal.id === id);

    if (!entry) {
      notFound();
    }

    const { signal, match } = entry;
    const [garments, styleRules] = await Promise.all([listWardrobeGarments(), listStyleRules()]);

    const attrs = (signal.normalized_attributes_json ?? {}) as Record<string, unknown>;
    const category = typeof attrs.category === "string" ? attrs.category : signal.label;
    const colour =
      typeof attrs.family === "string"
        ? attrs.family
        : typeof attrs.colour === "string"
          ? attrs.colour
          : null;

    const unlockCount =
      match.match_type === "missing_piece"
        ? unlockCountForCandidate(garments, styleRules, {
            id: `trend-${signal.id}`,
            title: signal.label,
            category,
            subcategory: null,
            primary_colour_family: colour
          })
        : 0;

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/trends" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          trends
        </Link>

        <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">
          {signal.canonical_label || signal.label}
        </h1>
        <div className="mt-3 flex flex-wrap gap-[7px]">
          {signal.trend_status ? (
            <Chip variant="selected">{PHASE_LABEL[signal.trend_status] ?? signal.trend_status}</Chip>
          ) : null}
          {signal.region ? <Chip variant="available">{signal.region}</Chip> : null}
        </div>

        <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            how covered you are
          </p>
          <p className="text-[26px] font-light leading-[1.2] text-[var(--ink)]">
            {Math.round(match.score * 100)}% match
          </p>
          <p className="pt-2 text-[12.5px] text-[var(--slate)]">
            {match.match_type === "exact_match"
              ? "you already own this"
              : match.match_type === "missing_piece"
                ? `unlocks ${unlockCount} look${unlockCount === 1 ? "" : "s"} if you add ${category}`
                : "adjacent to pieces you already own"}
          </p>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/trends"
          title="Sign in with Supabase to view this trend."
          description="This page reads your own trend matches, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
