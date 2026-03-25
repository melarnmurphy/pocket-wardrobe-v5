import { AuthenticationError } from "@/lib/auth";
import {
  getBillingStatus,
  getPremiumFeatureSummary
} from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { WardrobeShop } from "@/components/wardrobe-shop";
import {
  addGarmentImageAction,
  createGarmentAction,
  createPhotoDraftAction,
  createProductUrlDraftAction,
  createReceiptDraftAction,
  deleteGarmentAction,
  logWearAction,
  updateGarmentAction,
  toggleGarmentFavouriteAction
} from "@/app/wardrobe/actions";

export default async function WardrobePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const [garments, entitlements] = await Promise.all([
      listWardrobeGarments(),
      getUserEntitlements()
    ]);
    const billingStatus = getBillingStatus();
    const premiumFeatures = getPremiumFeatureSummary();
    const initialBrowseState = {
      query: firstParam(resolvedSearchParams?.q) ?? "",
      occasionFilter: firstParam(resolvedSearchParams?.occasion) ?? "all",
      typeFilter: firstParam(resolvedSearchParams?.type) ?? "all",
      seasonFilter: firstParam(resolvedSearchParams?.season) ?? "all",
      colourFilter: firstParam(resolvedSearchParams?.colour) ?? "all",
      statusFilter: firstParam(resolvedSearchParams?.status) ?? "all",
      favouritesOnly: firstParam(resolvedSearchParams?.fav) === "1",
      sortBy: firstParam(resolvedSearchParams?.sort) ?? "newest"
    };
    const initialActiveGarmentId = firstParam(resolvedSearchParams?.item) ?? null;
    const requestedSource = firstParam(resolvedSearchParams?.source);
    const createRequested = firstParam(resolvedSearchParams?.create) === "1";
    const initialCreateState = {
      isOpen: createRequested && !initialActiveGarmentId,
      sourceMode:
        requestedSource === "photo" ||
        requestedSource === "product_url" ||
        requestedSource === "receipt" ||
        requestedSource === "manual"
          ? requestedSource
          : "manual"
    } as const;

    return (
      <main className="pw-shell flex min-h-screen max-w-7xl flex-col gap-8 md:px-10">
        <WardrobeShop
          garments={garments}
          planTier={entitlements.plan_tier}
          canUseFeatureLabels={entitlements.feature_labels_enabled}
          premiumUpgradeUrl={billingStatus.upgradeUrl}
          billingCheckoutEnabled={billingStatus.checkoutEnabled}
          premiumFeatures={premiumFeatures}
          initialBrowseState={initialBrowseState}
          initialActiveGarmentId={initialActiveGarmentId}
          initialCreateState={initialCreateState}
          createGarmentAction={createGarmentAction}
          createPhotoDraftAction={createPhotoDraftAction}
          createProductUrlDraftAction={createProductUrlDraftAction}
          createReceiptDraftAction={createReceiptDraftAction}
          addGarmentImageAction={addGarmentImageAction}
          deleteGarmentAction={deleteGarmentAction}
          toggleGarmentFavouriteAction={toggleGarmentFavouriteAction}
          logWearAction={logWearAction}
          updateGarmentAction={updateGarmentAction}
        />
      </main>
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
