"use server";

import { getRequiredUser } from "@/lib/auth";
import { getUserTrendMatches, getTrendSignals } from "@/lib/domain/trends/service";
import type { UserTrendMatch, TrendSignalWithColour } from "@/lib/domain/trends/index";

export interface TrendMatchWithSignal {
  match: UserTrendMatch;
  signal: TrendSignalWithColour;
}

export async function loadUserTrends(): Promise<TrendMatchWithSignal[]> {
  const user = await getRequiredUser();
  const [matches, signals] = await Promise.all([
    getUserTrendMatches(user.id),
    getTrendSignals()
  ]);

  const signalById = new Map(signals.map((s) => [s.id, s]));

  return matches
    .map((match) => {
      const signal = signalById.get(match.trend_signal_id);
      if (!signal) return null;
      return { match, signal };
    })
    .filter((item): item is TrendMatchWithSignal => item !== null)
    .sort((a, b) => b.match.score - a.match.score);
}
