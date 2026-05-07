import { loadTrendsPageData } from "./actions";
import { TrendSparkline } from "@/components/trend-sparkline";

const MATCH_LABELS: Record<string, string> = {
  exact_match: "On trend",
  adjacent_match: "Close match",
  styling_match: "Can style it",
  missing_piece: "Missing piece"
};

const MATCH_DOT: Record<string, string> = {
  exact_match: "#1a1916",
  adjacent_match: "#807a70",
  styling_match: "#b0a898",
  missing_piece: "#c8c0b4"
};

export default async function TrendsPage() {
  const { trendMatches, storyMatches, garmentPreviews } = await loadTrendsPageData();

  const hasStories = storyMatches.length > 0;

  if (!hasStories && trendMatches.length === 0) {
    return (
      <main className="pw-shell max-w-5xl py-12">
        <div className="mx-auto max-w-2xl pt-6 text-center">
          <p
            className="text-[0.72rem] font-semibold uppercase"
            style={{ letterSpacing: "0.32em", color: "var(--muted)" }}
          >
            Trend Intelligence
          </p>
          <h1
            className="mt-4 italic"
            style={{
              fontFamily: "var(--font-display), serif",
              fontSize: "clamp(3rem, 8vw, 5rem)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 0.95
            }}
          >
            No signals
            <br />
            yet.
          </h1>
          <p
            className="mx-auto mt-6 max-w-md"
            style={{ color: "var(--muted)", lineHeight: 1.65 }}
          >
            Trigger an ingestion run to populate the global trend dashboard and
            see what your wardrobe already covers.
          </p>
        </div>
      </main>
    );
  }

  const grouped = {
    exact_match: trendMatches.filter((t) => t.match.match_type === "exact_match"),
    adjacent_match: trendMatches.filter((t) => t.match.match_type === "adjacent_match"),
    styling_match: trendMatches.filter((t) => t.match.match_type === "styling_match"),
    missing_piece: trendMatches.filter((t) => t.match.match_type === "missing_piece")
  };

  return (
    <main className="pw-shell max-w-6xl">
      {/* ── Editorial header ── */}
      <div
        className="border-b px-0 pb-8 pt-6"
        style={{ borderColor: "var(--line)" }}
      >
        <p
          className="text-[0.72rem] font-semibold uppercase"
          style={{ letterSpacing: "0.32em", color: "var(--muted)" }}
        >
          Trend Intelligence
        </p>
        <h1
          className="mt-4 italic"
          style={{
            fontFamily: "var(--font-display), serif",
            fontSize: "clamp(2.4rem, 6vw, 4rem)",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 0.95,
            maxWidth: "14ch"
          }}
        >
          What your wardrobe
          <br />
          already owns.
        </h1>
        <div
          className="mt-6 flex flex-wrap gap-6"
          style={{ color: "var(--muted)", fontSize: "0.78rem" }}
        >
          <span>
            <strong style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
              {storyMatches.length}
            </strong>{" "}
            trend stories
          </span>
          <span>
            <strong style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
              {trendMatches.length}
            </strong>{" "}
            active matches
          </span>
          <span>
            <strong style={{ color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
              {trendMatches.reduce((n, { signal }) => n + signal.sources.length, 0)}
            </strong>{" "}
            evidence links
          </span>
        </div>
      </div>

      <div className="space-y-12 py-10">
        {/* ── Story cards ── */}
        {hasStories && (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p
                  className="text-[0.72rem] font-semibold uppercase"
                  style={{ letterSpacing: "0.28em", color: "var(--muted)" }}
                >
                  Trend Stories
                </p>
                <p
                  className="mt-2 italic"
                  style={{
                    fontFamily: "var(--font-display), serif",
                    fontSize: "1.6rem",
                    fontWeight: 400,
                    letterSpacing: "-0.02em"
                  }}
                >
                  What&apos;s moving right now.
                </p>
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                {storyMatches.length} stories
              </span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {storyMatches.map(({ story, matchingGarmentIds, bestMatchType, bestScore }) => {
                const matchLabel = bestMatchType ? MATCH_LABELS[bestMatchType] : null;
                const dot = bestMatchType ? MATCH_DOT[bestMatchType] : MATCH_DOT.missing_piece;
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
                    className="pw-trends-panel pw-hover-panel pw-fade-up p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="text-[0.68rem] uppercase"
                          style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                        >
                          {story.dominant_type?.replace(/_/g, " ") ?? "trend story"}
                        </p>
                        <p
                          className="mt-2 italic"
                          style={{
                            fontFamily: "var(--font-display), serif",
                            fontSize: "1.35rem",
                            fontWeight: 400,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.15
                          }}
                        >
                          {story.headline}
                        </p>
                        {story.momentum_label && (
                          <p
                            className="mt-1.5 text-sm font-medium"
                            style={{ color: "var(--muted)" }}
                          >
                            {story.momentum_label}
                          </p>
                        )}
                        {story.framing && (
                          <p
                            className="mt-2 text-sm leading-relaxed"
                            style={{ color: "var(--muted)" }}
                          >
                            {story.framing}
                          </p>
                        )}
                      </div>
                      {matchLabel && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: dot }}
                          />
                          <span
                            className="text-xs font-semibold uppercase"
                            style={{ letterSpacing: "0.14em", color: "var(--muted)" }}
                          >
                            {matchLabel}
                          </span>
                        </div>
                      )}
                    </div>

                    {(story.attributed_houses.length > 0 || story.attributed_people.length > 0) && (
                      <div
                        className="mt-4 flex flex-wrap gap-2 border-t pt-4"
                        style={{ borderColor: "var(--line)" }}
                      >
                        {story.attributed_houses.map((house) => (
                          <span
                            key={house}
                            className="rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase"
                            style={{
                              borderColor: "var(--line-strong)",
                              letterSpacing: "0.14em",
                              color: "var(--foreground)"
                            }}
                          >
                            {house}
                          </span>
                        ))}
                        {story.attributed_people.map((person) => (
                          <span
                            key={person}
                            className="rounded-full border px-2.5 py-1 text-[11px] italic"
                            style={{
                              borderColor: "var(--line)",
                              color: "var(--muted)"
                            }}
                          >
                            {person}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className="mt-4 border-t pt-4"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <p
                        className="text-[0.65rem] uppercase"
                        style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                      >
                        Your pieces
                      </p>
                      {previewPieces.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {previewPieces.map((piece) => (
                            <div
                              key={piece.id}
                              className="relative h-14 w-14 overflow-hidden rounded-[6px] border"
                              style={{ borderColor: "var(--line)", background: "var(--paper-tile)" }}
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
                                <div
                                  className="flex h-full w-full items-center justify-center text-[9px]"
                                  style={{ color: "var(--muted)" }}
                                >
                                  {piece.title.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                          {matchingGarmentIds.length > 4 && (
                            <div
                              className="flex h-14 w-14 items-center justify-center rounded-[6px] border text-xs"
                              style={{
                                borderColor: "var(--line)",
                                color: "var(--muted)",
                                background: "var(--paper-tile)"
                              }}
                            >
                              +{matchingGarmentIds.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                          No matching pieces yet.
                        </p>
                      )}
                    </div>

                    <div
                      className="mt-4 flex items-center justify-between gap-3 border-t pt-4"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {story.signal_ids.length} signal
                        {story.signal_ids.length !== 1 ? "s" : ""}
                        {bestScore > 0 ? ` · ${Math.round(bestScore * 100)}% match` : ""}
                      </p>
                      <a
                        href={outfitHref}
                        className="rounded-full border px-4 py-1.5 text-xs font-semibold uppercase transition-opacity hover:opacity-70"
                        style={{
                          borderColor: "var(--line-strong)",
                          color: "var(--foreground)",
                          letterSpacing: "0.14em"
                        }}
                      >
                        Generate outfit →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Per-signal groups ── */}
        {(Object.entries(grouped) as [string, typeof trendMatches][]).map(
          ([matchType, items]) => {
            if (items.length === 0) return null;
            return (
              <section key={matchType} className="space-y-5">
                <div
                  className="flex items-baseline justify-between gap-4 border-b pb-4"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: MATCH_DOT[matchType] }}
                    />
                    <div>
                      <p
                        className="text-[0.72rem] font-semibold uppercase"
                        style={{ letterSpacing: "0.28em", color: "var(--muted)" }}
                      >
                        {MATCH_LABELS[matchType]}
                      </p>
                      <p
                        className="mt-1 italic"
                        style={{
                          fontFamily: "var(--font-display), serif",
                          fontSize: "1.5rem",
                          fontWeight: 400,
                          letterSpacing: "-0.02em"
                        }}
                      >
                        {sectionHeading(matchType)}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
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
                        className="pw-trends-panel pw-hover-panel pw-fade-up p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className="text-[0.68rem] uppercase"
                              style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                            >
                              {signal.family || signal.trend_type.replace("_", " ")}
                              {signal.season ? ` · ${signal.season}` : ""}
                            </p>
                            <p
                              className="mt-2 italic capitalize"
                              style={{
                                fontFamily: "var(--font-display), serif",
                                fontSize: "1.35rem",
                                fontWeight: 400,
                                letterSpacing: "-0.02em",
                                lineHeight: 1.15
                              }}
                            >
                              {signal.canonical_label || signal.label}
                            </p>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              {signal.subfamily ? (
                                <span
                                  className="rounded-full border px-2.5 py-1 text-[11px] uppercase"
                                  style={{
                                    borderColor: "var(--line)",
                                    letterSpacing: "0.14em",
                                    color: "var(--muted)"
                                  }}
                                >
                                  {signal.subfamily}
                                </span>
                              ) : null}
                              {(signal.latest_metric?.status || signal.trend_status) ? (
                                <span
                                  className="rounded-full border px-2.5 py-1 text-[11px] uppercase"
                                  style={{
                                    borderColor: "var(--line)",
                                    letterSpacing: "0.14em",
                                    color: "var(--muted)"
                                  }}
                                >
                                  {signal.latest_metric?.status || signal.trend_status}
                                </span>
                              ) : null}
                              {signal.score_30d_delta != null ? (
                                <span
                                  className="rounded-full border px-2.5 py-1 text-[11px]"
                                  style={{
                                    borderColor: "var(--line)",
                                    color: "var(--muted)"
                                  }}
                                >
                                  {signal.score_30d_delta > 0 ? "+" : ""}
                                  {(signal.score_30d_delta * 100).toFixed(1)}% / 30d
                                </span>
                              ) : null}
                            </div>
                            {reasoning.match_reason ? (
                              <p
                                className="mt-3 text-sm leading-relaxed"
                                style={{ color: "var(--muted)" }}
                              >
                                {reasoning.match_reason}
                              </p>
                            ) : null}
                            {reasoning.attributes_matched && reasoning.attributes_matched.length > 0 ? (
                              <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
                                Matched: {reasoning.attributes_matched.join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <span
                            className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold"
                            style={{
                              borderColor: "var(--line-strong)",
                              color: "var(--foreground)"
                            }}
                          >
                            {Math.round(match.score * 100)}%
                          </span>
                        </div>

                        <div
                          className="mt-4 grid gap-4 border-t pt-4 lg:grid-cols-[1.1fr_0.9fr]"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <div>
                            <p
                              className="text-[0.65rem] uppercase"
                              style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                            >
                              30-Day Movement
                            </p>
                            <div className="mt-2">
                              <TrendSparkline
                                values={signal.metrics_30d
                                  .map(
                                    (metric) =>
                                      metric.composite_score ?? metric.search_interest ?? null
                                  )
                                  .filter((v): v is number => v != null)}
                                status={signal.latest_metric?.status || signal.trend_status}
                              />
                            </div>
                          </div>

                          <div>
                            <p
                              className="text-[0.65rem] uppercase"
                              style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                            >
                              Example Entities
                            </p>
                            {signal.entities.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {signal.entities.map((entity) => (
                                  <span
                                    key={entity.id ?? `${entity.entity_type}-${entity.normalized_label}`}
                                    className="rounded-full border px-2.5 py-1 text-xs"
                                    style={{
                                      borderColor: "var(--line)",
                                      color: "var(--muted)"
                                    }}
                                  >
                                    {entity.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                                No example entities yet.
                              </p>
                            )}
                          </div>
                        </div>

                        {signal.trend_colour ? (
                          <div
                            className="mt-4 flex items-center gap-3 rounded-[8px] border px-4 py-3"
                            style={{
                              borderColor: "var(--line)",
                              background: "var(--paper-tile)"
                            }}
                          >
                            <span
                              className="h-7 w-7 rounded-full border"
                              style={{
                                backgroundColor: signal.trend_colour.canonical_hex,
                                borderColor: "var(--line-strong)"
                              }}
                            />
                            <div className="min-w-0">
                              <p
                                className="text-[0.65rem] uppercase"
                                style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                              >
                                Colour Direction
                              </p>
                              <p className="mt-0.5 text-sm font-medium">
                                {signal.trend_colour.source_label ||
                                  signal.trend_colour.family ||
                                  signal.trend_colour.source_name}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <div
                          className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-[1fr_auto] md:items-end"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <div>
                            <p
                              className="text-[0.65rem] uppercase"
                              style={{ letterSpacing: "0.22em", color: "var(--muted)" }}
                            >
                              Source Trail
                            </p>
                            {signal.sources.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {signal.sources.map((source) => (
                                  <a
                                    key={source.id ?? source.source_url}
                                    href={source.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                                    style={{
                                      borderColor: "var(--line-strong)",
                                      color: "var(--foreground)"
                                    }}
                                    title={source.title}
                                  >
                                    {source.source_name}
                                  </a>
                                ))}
                              </div>
                            ) : signal.trend_colour?.source_url ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <a
                                  href={signal.trend_colour.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                                  style={{
                                    borderColor: "var(--line-strong)",
                                    color: "var(--foreground)"
                                  }}
                                >
                                  {signal.trend_colour.source_name}
                                </a>
                              </div>
                            ) : (
                              <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                                No source links yet.
                              </p>
                            )}
                          </div>
                          <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
                            {signal.last_seen_at ? (
                              <p>Last seen {formatShortDate(signal.last_seen_at)}</p>
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
          }
        )}
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
  return parsed.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
