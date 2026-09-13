import { Suspense } from "react";
import { AuthenticationError } from "@/lib/auth";
import { pickOwnedTrend } from "@/lib/domain/outfits/appeal";
import {
  listSavedOutfits,
  listUserTrendMatchesWithSignals
} from "@/lib/domain/outfits/service";
import { suggestTodayOutfit } from "@/lib/domain/outfits/today";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OwnedTrendCard } from "@/components/owned-trend-card";
import { TodayOutfitCard } from "@/components/today-outfit-card";
import { ClosetUnlockSection } from "@/app/wardrobe/(closet)/closet-unlock-section";
import { WardrobeSnapshot } from "@/components/wardrobe-snapshot";
import { WardrobeInsights } from "@/components/wardrobe-insights";

export const metadata = {
  title: "Today — Garderobe"
};

export default async function TodayPage() {
  try {
    const [garments, styleRules, trendMatches, savedOutfits] = await Promise.all([
      listWardrobeGarments(),
      listStyleRules(),
      listUserTrendMatchesWithSignals(),
      listSavedOutfits()
    ]);
    // Server-rendered snapshot boundary; this is intentionally evaluated once per request.
    // eslint-disable-next-line react-hooks/purity
    const nowMs = Date.now();
    const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
    const recentOutfitGarmentIds = savedOutfits.flatMap((outfit) => {
      const created = outfit.created_at ? Date.parse(outfit.created_at) : 0;
      if (Number.isNaN(created) || created < weekAgo) return [];
      return outfit.items.map((item) => item.garment_id);
    });
    const todayOutfit = suggestTodayOutfit({
      garments,
      styleRules,
      recentOutfitGarmentIds,
      nowMs
    });
    const ownedTrend = pickOwnedTrend(trendMatches);
    const weekday = new Date().toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });

    return (
      <main className="px-6 py-8 md:px-8">
        <p className="text-[8.5px] font-semibold uppercase tracking-[.2em] text-[var(--stone)]">
          {weekday}
        </p>
        <h1 className="pt-3 text-[34px] font-light leading-none text-[var(--ink)]">
          good morning
        </h1>
        <div className="mt-[22px] flex max-w-3xl flex-col gap-4 border-t pt-[22px]" style={{ borderColor: "rgba(30,26,23,.11)" }}>
          <TodayOutfitCard outfit={todayOutfit} />
          <WardrobeSnapshot garments={garments} />
          <WardrobeInsights garments={garments} />
          {ownedTrend ? <OwnedTrendCard match={ownedTrend} /> : null}
          <Suspense fallback={null}>
            <ClosetUnlockSection />
          </Suspense>
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <main className="px-6 py-8">
          <AuthRequiredCard
            next="/today"
            title="Sign in to see what to wear today."
            description="This page reads your wardrobe and writes wear events, so it needs an authenticated session."
          />
        </main>
      );
    }
    throw error;
  }
}
