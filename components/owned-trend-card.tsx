import Link from "next/link";
import type { Route } from "next";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import { matchedGarmentIds } from "@/lib/domain/outfits/appeal";

export function OwnedTrendCard({ match }: { match: UserTrendMatchWithSignal }) {
  const garmentId = matchedGarmentIds(match)[0];
  const trendId = match.trend_signal_id;
  const params = new URLSearchParams({ mode: "trend", trend: trendId });
  if (garmentId) params.set("item", garmentId);
  const href = `/outfits?${params.toString()}` as Route;
  const kind = match.match_type === "exact_match" ? "On you" : "Close to you";

  return (
    <section className="pw-panel p-6">
      <p className="pw-kicker">{kind}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
        You already own {match.trend_signal.label}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Style it from pieces already in the closet. The planner will keep those garments in the look.
      </p>
      <div className="mt-6">
        <Link href={href} className="pw-button-primary">
          Style it
        </Link>
      </div>
    </section>
  );
}
