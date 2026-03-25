import { loadUserTrends } from "./actions";

const MATCH_LABELS: Record<string, string> = {
  exact_match: "On trend",
  adjacent_match: "Close match",
  styling_match: "Can style it",
  missing_piece: "Missing piece"
};

const MATCH_COLOURS: Record<string, string> = {
  exact_match: "border-[rgba(13,255,232,0.28)] bg-[rgba(13,255,232,0.12)] text-[var(--trend-accent-ink)]",
  adjacent_match: "border-[rgba(123,92,240,0.22)] bg-[rgba(123,92,240,0.08)] text-[var(--accent-strong)]",
  styling_match: "border-[rgba(255,107,157,0.24)] bg-[rgba(255,107,157,0.12)] text-[var(--accent-strong)]",
  missing_piece: "border-[rgba(255,209,102,0.26)] bg-[rgba(255,209,102,0.18)] text-[var(--accent-strong)]"
};

export default async function TrendsPage() {
  const trendMatches = await loadUserTrends();

  const grouped = {
    exact_match: trendMatches.filter((t) => t.match.match_type === "exact_match"),
    adjacent_match: trendMatches.filter((t) => t.match.match_type === "adjacent_match"),
    styling_match: trendMatches.filter((t) => t.match.match_type === "styling_match"),
    missing_piece: trendMatches.filter((t) => t.match.match_type === "missing_piece")
  };

  if (trendMatches.length === 0) {
    return (
      <main className="pw-trends-shell">
        <div className="pw-shell max-w-5xl py-12">
          <section className="pw-trends-banner pw-fade-up p-8 text-center">
            <p className="pw-kicker text-[var(--trend-accent)]">Trend Intelligence</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] leading-[0.95]">
              No trend signals yet.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/76">
              Trigger an ingestion run to populate the global trend dashboard and see what your wardrobe already covers.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="pw-trends-shell">
      <div className="pw-shell max-w-5xl space-y-8">
        <section className="pw-trends-banner pw-fade-up p-7 md:p-8">
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="pw-kicker text-[var(--trend-accent)]">Trend Intelligence</p>
              <h1 className="mt-4 max-w-[11ch] text-4xl font-semibold tracking-[-0.07em] leading-[0.95] md:text-6xl">
                See what your wardrobe already owns, almost owns, or still needs.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-white/76">
                Cyber mint is reserved for the trend dashboard so this space reads like a distinct analytic layer instead of another wardrobe screen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="pw-chip border-[rgba(13,255,232,0.26)] bg-[rgba(13,255,232,0.12)] text-[var(--trend-accent)]">
                {trendMatches.length} active matches
              </span>
            </div>
          </div>
        </section>

        {(Object.entries(grouped) as [string, typeof trendMatches][]).map(([matchType, items]) => {
          if (items.length === 0) return null;
          return (
            <section key={matchType} className="space-y-3">
              <h2 className="pw-kicker text-[var(--muted)]">{MATCH_LABELS[matchType]}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {items.map(({ match, signal }) => {
                  const reasoning = match.reasoning_json as {
                    match_reason?: string;
                    matched_garment_ids?: string[];
                    attributes_matched?: string[];
                  };
                  return (
                    <div
                      key={`${match.trend_signal_id}-${match.match_type}`}
                      className={`pw-trends-panel pw-hover-panel pw-fade-up border p-4 ${MATCH_COLOURS[matchType]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium capitalize">{signal.label}</p>
                          <p className="mt-0.5 text-xs opacity-75">
                            {signal.trend_type.replace("_", " ")}
                            {signal.season ? ` · ${signal.season}` : ""}
                          </p>
                          {reasoning.match_reason ? (
                            <p className="mt-2 text-xs leading-5 opacity-90">{reasoning.match_reason}</p>
                          ) : null}
                          {reasoning.attributes_matched && reasoning.attributes_matched.length > 0 ? (
                            <p className="mt-1 text-xs opacity-72">
                              Matched: {reasoning.attributes_matched.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border border-current/12 px-2.5 py-1 text-xs font-semibold opacity-72">
                          {Math.round(match.score * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
