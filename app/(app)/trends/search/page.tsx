import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadTrendsPageData } from "@/app/trends/actions";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { SearchTrendsForm } from "./search-form";

/** 2c — search by trend. */
export default async function TrendSearchPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const resolved = searchParams ? await searchParams : undefined;
    const queryParam = resolved?.q;
    const query = (Array.isArray(queryParam) ? queryParam[0] : queryParam)?.trim().toLowerCase() ?? "";

    const { trendMatches } = await loadTrendsPageData();
    const results = query
      ? trendMatches.filter(
          ({ signal }) =>
            signal.label.toLowerCase().includes(query) ||
            signal.canonical_label?.toLowerCase().includes(query)
        )
      : trendMatches;

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/trends" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          trends
        </Link>

        <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">search trends</h1>

        <div className="mt-5">
          <SearchTrendsForm defaultValue={query} />
        </div>

        {results.length ? (
          <div className="mt-6 rounded-[4px] bg-[var(--cream)] px-[14px]">
            {results.map(({ signal, match }, index) => (
              <Link key={signal.id} href={`/trends/${signal.id}`}>
                <div
                  className={[
                    "flex items-center justify-between py-[13px]",
                    index === results.length - 1 ? "" : "border-b border-[rgba(30,26,23,.11)]"
                  ].join(" ")}
                >
                  <span className="text-[14px] text-[var(--ink)]">
                    {signal.canonical_label || signal.label}
                  </span>
                  <span className="text-[11px] text-[var(--stone)]">{Math.round(match.score * 100)}%</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-8 text-[12.5px] text-[var(--stone)]">no trends match &quot;{query}&quot;</p>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/trends/search"
          title="Sign in with Supabase to search trends."
          description="This page reads your own trend matches, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
