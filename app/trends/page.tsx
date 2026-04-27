import { loadTrendsPageData } from "./actions";
import { TrendSparkline } from "@/components/trend-sparkline";

const MATCH_LABELS: Record<string, string> = {
  exact_match: "On trend",
  adjacent_match: "Close match",
  styling_match: "Can style it",
  missing_piece: "Missing piece"
};

const MATCH_COLOURS: Record<string, string> = {
  exact_match:
    "border-[rgba(13,255,232,0.28)] bg-[rgba(13,255,232,0.12)] text-[var(--trend-accent-ink)]",
  adjacent_match:
    "border-[rgba(123,92,240,0.22)] bg-[rgba(123,92,240,0.08)] text-[var(--accent-strong)]",
  styling_match:
    "border-[rgba(255,107,157,0.24)] bg-[rgba(255,107,157,0.12)] text-[var(--accent-strong)]",
  missing_piece:
    "border-[rgba(255,209,102,0.26)] bg-[rgba(255,209,102,0.18)] text-[var(--accent-strong)]"
};

export default async function TrendsPage() {
  const { trendMatches, storyMatches, garmentPreviews } = await loadTrendsPageData();

  const hasStories = storyMatches.length > 0;

  if (!hasStories && trendMatches.length === 0) {
    return (
      <main className="pw-trends-shell">
        <div className="pw-shell max-w-5xl py-12">
          <section className="pw-trends-banner pw-fade-up p-8 text-center">
            <p className="pw-kicker text-[var(--trend-accent)]">
              Trend Intelligence
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] leading-[0.95]">
              No trend signals yet.
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/76">
              Trigger an ingestion run to populate the global trend dashboard
              and see what your wardrobe already covers.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const grouped = {
    exact_match: trendMatches.filter(
      (t) => t.match.match_type === "exact_match"
    ),
    adjacent_match: trendMatches.filter(
      (t) => t.match.match_type === "adjacent_match"
    ),
    styling_match: trendMatches.filter(
      (t) => t.match.match_type === "styling_match"
    ),
    missing_piece: trendMatches.filter(
      (t) => t.match.match_type === "missing_piece"
    )
  };

  return (
    <main className="pw-trends-shell">
      <div className="pw-shell max-w-6xl space-y-10">
        {/* ── Header banner ── */}
        <section className="pw-trends-banner pw-fade-up overflow-hidden p-7 md:p-8">
          <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-end">
            <div className="max-w-2xl">
              <p className="pw-kicker text-[var(--trend-accent)]">
                Trend Intelligence
              </p>
              <h1 className="mt-4 max-w-[11ch] text-4xl font-semibold tracking-[-0.07em] leading-[0.95] md:text-6xl">
                See what your wardrobe already owns, almost owns, or still
                needs.
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[8px] border border-[rgba(13,255,232,0.2)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/62">
                  Trend Stories
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {storyMatches.length}
                </p>
              </div>
              <div className="rounded-[8px] border border-[rgba(13,255,232,0.2)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/62">
                  Active Matches
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {trendMatches.length}
                </p>
              </div>
              <div className="rounded-[8px] border border-[rgba(13,255,232,0.2)] bg-[rgba(255,255,255,0.08)] p-4 backdrop-blur-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/62">
                  Evidence Links
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.08em] text-white">
                  {trendMatches.reduce(
                    (count, { signal }) => count + signal.sources.length,
                    0
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Story cards ── */}
        {hasStories && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="pw-kicker text-[var(--muted)]">
                  Trend Stories
                </h2>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.07em] text-[var(--foreground)]">
                  What&apos;s moving right now.
                </p>
              </div>
              <span className="text-sm text-[var(--muted)]">
                {storyMatches.length} stories
              </span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {storyMatches.map(
                ({ story, matchingGarmentIds, bestMatchType, bestScore }) => {
                  const matchColour =
                    bestMatchType
                      ? MATCH_COLOURS[bestMatchType]
                      : MATCH_COLOURS.missing_piece;
                  const matchLabel =
                    bestMatchType ? MATCH_LABELS[bestMatchType] : null;
                  const previewPieces = matchingGarmentIds
                    .slice(0, 4)
                    .map((id) => garmentPreviews[id])
                    .filter(Boolean);
                  const outfitHref =
                    matchingGarmentIds.length > 0
                      ? `/outfits?pieces=${matchingGarmentIds.slice(0, 5).join(",")}`
                      : "/outfits";

                  return (
                    <div
                      key={story.id ?? story.headline}
                      className={`pw-trends-panel pw-hover-panel pw-fade-up border p-5 ${matchColour}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.22em] opacity-65">
                            {story.dominant_type?.replace(/_/g, " ") ??
                              "trend story"}
                          </p>
                          <p className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                            {story.headline}
                          </p>
                          {story.momentum_label && (
                            <p className="mt-2 text-sm font-semibold opacity-85">
                              {story.momentum_label}
                            </p>
                          )}
                          {story.framing && (
                            <p className="mt-2 text-sm leading-6 opacity-80">
                              {story.framing}
                            </p>
                          )}
                        </div>
                        {matchLabel && (
                          <span className="shrink-0 rounded-full border border-current/12 px-2.5 py-1 text-xs font-semibold opacity-72">
                            {matchLabel}
                          </span>
                        )}
                      </div>

                      {(story.attributed_houses.length > 0 ||
                        story.attributed_people.length > 0) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {story.attributed_houses.map((house) => (
                            <span
                              key={house}
                              className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] opacity-85"
                            >
                              {house}
                            </span>
                          ))}
                          {story.attributed_people.map((person) => (
                            <span
                              key={person}
                              className="rounded-full border border-current/16 bg-white/30 px-2.5 py-1 text-[11px] italic opacity-80"
                            >
                              {person}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-5">
                        <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                          Your pieces
                        </p>
                        {previewPieces.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {previewPieces.map((piece) => (
                              <div
                                key={piece.id}
                                className="relative h-14 w-14 overflow-hidden rounded-[6px] border border-current/10 bg-white/10"
                                title={piece.title}
                              >
                                {piece.preview_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={piece.preview_url}
                                    alt={piece.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[9px] opacity-50">
                                    {piece.title.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {matchingGarmentIds.length > 4 && (
                              <div className="flex h-14 w-14 items-center justify-center rounded-[6px] border border-current/10 bg-white/10 text-xs opacity-70">
                                +{matchingGarmentIds.length - 4}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-3 text-xs opacity-70">
                            No matching pieces yet.
                          </p>
                        )}
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3">
                        <div className="text-xs opacity-60">
                          {story.signal_ids.length} signal
                          {story.signal_ids.length !== 1 ? "s" : ""}
                          {bestScore > 0
                            ? ` · ${Math.round(bestScore * 100)}% match`
                            : ""}
                        </div>
                        <a
                          href={outfitHref}
                          className="rounded-full border border-current/20 bg-white/10 px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                        >
                          Generate outfit →
                        </a>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}

        {/* ── Per-signal view ── */}
        {(
          Object.entries(grouped) as [string, typeof trendMatches][]
        ).map(([matchType, items]) => {
          if (items.length === 0) return null;
          return (
            <section key={matchType} className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="pw-kicker text-[var(--muted)]">
                    {MATCH_LABELS[matchType]}
                  </h2>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.07em] text-[var(--foreground)]">
                    {sectionHeading(matchType)}
                  </p>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {items.length} signals
                </span>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {items.map(({ match, signal }) => {
                  const reasoning = match.reasoning_json as {
                    match_reason?: string;
                    matched_garment_ids?: string[];
                    attributes_matched?: string[];
                  };
                  return (
                    <div
                      key={`${match.trend_signal_id}-${match.match_type}`}
                      className={`pw-trends-panel pw-hover-panel pw-fade-up border p-5 ${MATCH_COLOURS[matchType]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.22em] opacity-65">
                            {signal.family ||
                              signal.trend_type.replace("_", " ")}
                            {signal.season ? ` · ${signal.season}` : ""}
                          </p>
                          <p className="mt-3 text-2xl font-semibold capitalize tracking-[-0.05em]">
                            {signal.canonical_label || signal.label}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {signal.subfamily ? (
                              <span className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] opacity-80">
                                {signal.subfamily}
                              </span>
                            ) : null}
                            {signal.latest_metric?.status ||
                            signal.trend_status ? (
                              <span className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] opacity-80">
                                {signal.latest_metric?.status ||
                                  signal.trend_status}
                              </span>
                            ) : null}
                            {signal.score_30d_delta != null ? (
                              <span className="rounded-full border border-current/12 bg-white/50 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] opacity-80">
                                {signal.score_30d_delta > 0 ? "+" : ""}
                                {(signal.score_30d_delta * 100).toFixed(1)}%
                                / 30d
                              </span>
                            ) : null}
                          </div>
                          {reasoning.match_reason ? (
                            <p className="mt-3 text-sm leading-6 opacity-90">
                              {reasoning.match_reason}
                            </p>
                          ) : null}
                          {reasoning.attributes_matched &&
                          reasoning.attributes_matched.length > 0 ? (
                            <p className="mt-2 text-xs opacity-72">
                              Matched:{" "}
                              {reasoning.attributes_matched.join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border border-current/12 px-2.5 py-1 text-xs font-semibold opacity-72">
                          {Math.round(match.score * 100)}%
                        </span>
                      </div>

                      <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                            30-Day Movement
                          </p>
                          <div className="mt-3">
                            <TrendSparkline
                              values={signal.metrics_30d
                                .map(
                                  (metric) =>
                                    metric.composite_score ??
                                    metric.search_interest ??
                                    null
                                )
                                .filter((value): value is number => value != null)}
                              status={
                                signal.latest_metric?.status ||
                                signal.trend_status
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                            Example Entities
                          </p>
                          {signal.entities.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {signal.entities.map((entity) => (
                                <span
                                  key={
                                    entity.id ??
                                    `${entity.entity_type}-${entity.normalized_label}`
                                  }
                                  className="rounded-full border border-current/12 bg-white/50 px-3 py-1.5 text-xs font-medium opacity-85"
                                >
                                  {entity.label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs opacity-70">
                              No example entities yet.
                            </p>
                          )}
                        </div>
                      </div>

                      {signal.trend_colour ? (
                        <div className="mt-5 flex items-center gap-3 rounded-[8px] border border-current/10 bg-white/40 px-4 py-3">
                          <span
                            className="h-8 w-8 rounded-full border border-black/10"
                            style={{
                              backgroundColor:
                                signal.trend_colour.canonical_hex
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                              Colour Direction
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {signal.trend_colour.source_label ||
                                signal.trend_colour.family ||
                                signal.trend_colour.source_name}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.22em] opacity-65">
                            Source Trail
                          </p>
                          {signal.sources.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {signal.sources.map((source) => (
                                <a
                                  key={source.id ?? source.source_url}
                                  href={source.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-current/12 bg-white/50 px-3 py-1.5 text-xs font-medium opacity-85 transition-opacity hover:opacity-100"
                                  title={source.title}
                                >
                                  {source.source_name}
                                </a>
                              ))}
                            </div>
                          ) : signal.trend_colour?.source_url ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href={signal.trend_colour.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-current/12 bg-white/50 px-3 py-1.5 text-xs font-medium opacity-85 transition-opacity hover:opacity-100"
                              >
                                {signal.trend_colour.source_name}
                              </a>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs opacity-70">
                              No source links yet.
                            </p>
                          )}
                        </div>
                        <div className="text-right text-xs opacity-70">
                          {signal.last_seen_at ? (
                            <p>
                              Last seen {formatShortDate(signal.last_seen_at)}
                            </p>
                          ) : null}
                          {signal.source_count ? (
                            <p>{signal.source_count} source hits</p>
                          ) : null}
                        </div>
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

function sectionHeading(matchType: string) {
  switch (matchType) {
    case "exact_match":
      return "You already own the signal.";
    case "adjacent_match":
      return "You are close enough to style into it.";
    case "styling_match":
      return "You can push existing pieces toward the trend.";
    case "missing_piece":
      return "One item would unlock the direction.";
    default:
      return "Trend signals";
  }
}

function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short"
  });
}
