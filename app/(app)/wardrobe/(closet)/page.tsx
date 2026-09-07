import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { AuthenticationError } from "@/lib/auth";
import {
  getBillingStatus,
  getPremiumFeatureSummary
} from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import {
  listCollections,
  listRecentlyDeletedGarments,
  listWardrobeGarments
} from "@/lib/domain/wardrobe/service";
import { listUnfinishedPhotoBatches } from "@/lib/domain/ingestion/batch";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { WardrobeShop } from "@/components/wardrobe-shop";
import {
  addGarment3dAssetAction,
  addGarmentImageAction,
  archiveGarmentAction,
  bulkDeleteGarmentsAction,
  createCollectionAction,
  createGarmentAction,
  createPhotoDraftAction,
  createProductUrlDraftAction,
  createReceiptDraftAction,
  deleteCollectionAction,
  deleteGarmentAction,
  logWearAction,
  renameCollectionAction,
  restoreGarmentAction,
  setGarmentFeatureImageAction,
  updateGarmentAction,
  toggleGarmentFavouriteAction
} from "@/app/wardrobe/actions";

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
      unfinishedBatches,
      recentlyDeletedGarments,
      collections
    ] = await Promise.all([
      listWardrobeGarments(),
      getUserEntitlements(),
      listUnfinishedPhotoBatches(),
      listRecentlyDeletedGarments(),
      listCollections()
    ]);
    const runningBatches = unfinishedBatches.filter((batch) => batch.status === "running");
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
      <div className="flex flex-col gap-5 px-4 py-6 md:px-0">
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
          collections={collections}
          restoreGarmentAction={restoreGarmentAction}
          bulkDeleteGarmentsAction={bulkDeleteGarmentsAction}
          createCollectionAction={createCollectionAction}
          renameCollectionAction={renameCollectionAction}
          deleteCollectionAction={deleteCollectionAction}
          archiveGarmentAction={archiveGarmentAction}
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
