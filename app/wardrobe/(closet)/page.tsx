import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { AuthenticationError } from "@/lib/auth";
import {
  getBillingStatus,
  getPremiumFeatureSummary
} from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { pickOwnedTrend } from "@/lib/domain/outfits/appeal";
import {
  listSavedOutfits,
  listUserTrendMatchesWithSignals
} from "@/lib/domain/outfits/service";
import { suggestTodayOutfit } from "@/lib/domain/outfits/today";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import {
  listRecentlyDeletedGarments,
  listWardrobeGarments
} from "@/lib/domain/wardrobe/service";
import { listUnfinishedPhotoBatches } from "@/lib/domain/ingestion/batch";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OwnedTrendCard } from "@/components/owned-trend-card";
import { TodayOutfitCard } from "@/components/today-outfit-card";
import { WardrobeShop } from "@/components/wardrobe-shop";
import {
  addGarment3dAssetAction,
  addGarmentImageAction,
  createGarmentAction,
  createPhotoDraftAction,
  createProductUrlDraftAction,
  createReceiptDraftAction,
  deleteGarmentAction,
  logWearAction,
  restoreGarmentAction,
  setGarmentFeatureImageAction,
  updateGarmentAction,
  toggleGarmentFavouriteAction
} from "@/app/wardrobe/actions";
import { ClosetUnlockSection } from "./closet-unlock-section";

export default async function WardrobeItemsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const view = firstParam(resolvedSearchParams?.view);
    if (view === "outfits") redirect("/wardrobe/outfits" as Route);
    if (view === "avatar") redirect("/wardrobe/avatar" as Route);

    const [
      garments,
      entitlements,
      styleRules,
      trendMatches,
      savedOutfits,
      unfinishedBatches,
      recentlyDeletedGarments
    ] = await Promise.all([
      listWardrobeGarments(),
      getUserEntitlements(),
      listStyleRules(),
      listUserTrendMatchesWithSignals(),
      listSavedOutfits(),
      listUnfinishedPhotoBatches(),
      listRecentlyDeletedGarments()
    ]);
    const runningBatches = unfinishedBatches.filter((batch) => batch.status === "running");
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
    const billingStatus = getBillingStatus();
    const premiumFeatures = getPremiumFeatureSummary();
    const initialBrowseState = {
      query: firstParam(resolvedSearchParams?.q) ?? "",
      occasionFilter: firstParam(resolvedSearchParams?.occasion) ?? "all",
      typeFilter: firstParam(resolvedSearchParams?.type) ?? "all",
      seasonFilter: firstParam(resolvedSearchParams?.season) ?? "all",
      colourFilter: firstParam(resolvedSearchParams?.colour) ?? "all",
      favouritesOnly: firstParam(resolvedSearchParams?.fav) === "1",
      sortBy: firstParam(resolvedSearchParams?.sort) ?? "newest"
    };
    const initialSelectedGarmentId = firstParam(resolvedSearchParams?.garment) ?? null;
    const requestedSource = firstParam(resolvedSearchParams?.source);
    const createRequested = firstParam(resolvedSearchParams?.create) === "1";
    const initialCreateState = {
      isOpen: createRequested && !initialSelectedGarmentId,
      sourceMode:
        requestedSource === "photo" ||
        requestedSource === "product_url" ||
        requestedSource === "receipt" ||
        requestedSource === "manual"
          ? requestedSource
          : "manual"
    } as const;

    return (
      <div className="flex flex-col gap-6 px-4 py-6 md:px-0">
        <div className="flex flex-col gap-4">
          {runningBatches.map((batch) => (
            <Link
              key={batch.id}
              href={`/wardrobe/batch/${batch.id}`}
              className="flex items-center gap-3 rounded-[4px] border border-[rgba(30,26,23,.11)] bg-[var(--paper)] px-4 py-3 text-[12.5px] text-[var(--slate)]"
            >
              <span className="gw-spin h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-[var(--oxblood)]" />
              finish your batch — {batch.done_count} of {batch.total_count} photos read
            </Link>
          ))}
          <TodayOutfitCard outfit={todayOutfit} />
          {ownedTrend ? <OwnedTrendCard match={ownedTrend} /> : null}
          <Suspense fallback={null}>
            <ClosetUnlockSection />
          </Suspense>
        </div>
        <WardrobeShop
          garments={garments}
          planTier={entitlements.plan_tier}
          canUseFeatureLabels={entitlements.feature_labels_enabled}
          premiumUpgradeUrl={billingStatus.upgradeUrl}
          billingCheckoutEnabled={billingStatus.checkoutEnabled}
          premiumFeatures={premiumFeatures}
          initialBrowseState={initialBrowseState}
          initialSelectedGarmentId={initialSelectedGarmentId}
          initialCreateState={initialCreateState}
          createGarmentAction={createGarmentAction}
          createPhotoDraftAction={createPhotoDraftAction}
          createProductUrlDraftAction={createProductUrlDraftAction}
          createReceiptDraftAction={createReceiptDraftAction}
          addGarment3dAssetAction={addGarment3dAssetAction}
          addGarmentImageAction={addGarmentImageAction}
          deleteGarmentAction={deleteGarmentAction}
          setGarmentFeatureImageAction={setGarmentFeatureImageAction}
          toggleGarmentFavouriteAction={toggleGarmentFavouriteAction}
          logWearAction={logWearAction}
          updateGarmentAction={updateGarmentAction}
          recentlyDeletedGarments={recentlyDeletedGarments}
          restoreGarmentAction={restoreGarmentAction}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe"
          title="Sign in with Supabase to use the wardrobe workspace."
          description="This page reads and writes user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
