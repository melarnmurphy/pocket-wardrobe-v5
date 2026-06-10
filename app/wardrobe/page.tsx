import Link from "next/link";
import { AuthenticationError } from "@/lib/auth";
import {
  getBillingStatus,
  getPremiumFeatureSummary
} from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listSavedOutfits } from "@/lib/domain/outfits/service";
import {
  getActiveAvatarMeasurementSet,
  getAvatarProfile
} from "@/lib/domain/avatar/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { WardrobeShop } from "@/components/wardrobe-shop";
import { OutfitGallery } from "@/components/outfit-gallery";
import { AvatarStyler } from "@/components/avatar-styler";
import {
  generateAvatarPhotoAction,
  saveAvatarMeasurementsAction,
  saveAvatarLayoutAction,
  uploadAvatarPhotoAction
} from "@/app/wardrobe/avatar-actions";
import {
  addGarment3dAssetAction,
  addGarmentImageAction,
  createGarmentAction,
  createPhotoDraftAction,
  createProductUrlDraftAction,
  createReceiptDraftAction,
  deleteGarmentAction,
  logWearAction,
  setGarmentFeatureImageAction,
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
    const view = firstParam(resolvedSearchParams?.view) ?? "items";
    const isOutfitsView = view === "outfits";
    const isAvatarView = view === "avatar";

    const [garments, entitlements, savedOutfits, avatarProfile, avatarMeasurementSet] = await Promise.all([
      listWardrobeGarments(),
      getUserEntitlements(),
      isOutfitsView ? listSavedOutfits() : Promise.resolve([]),
      isAvatarView ? getAvatarProfile() : Promise.resolve(null),
      isAvatarView ? getActiveAvatarMeasurementSet() : Promise.resolve(null)
    ]);
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
      <main className="pw-shell flex min-h-screen max-w-7xl flex-col md:px-10">
        <ClosetTabs active={isAvatarView ? "avatar" : isOutfitsView ? "outfits" : "items"} />

        {isAvatarView ? (
          <div className="flex flex-col gap-6 px-4 py-6 md:px-0">
            <AvatarStyler
              garments={garments}
              initialAvatarUrl={avatarProfile?.avatar_url ?? null}
              initialLayout={avatarProfile?.layout_json ?? null}
              initialMeasurementSet={avatarMeasurementSet}
              uploadAvatarPhotoAction={uploadAvatarPhotoAction}
              generateAvatarPhotoAction={generateAvatarPhotoAction}
              saveAvatarLayoutAction={saveAvatarLayoutAction}
              saveAvatarMeasurementsAction={saveAvatarMeasurementsAction}
            />
          </div>
        ) : isOutfitsView ? (
          <div className="flex flex-col gap-6 px-4 py-6 md:px-0">
            <OutfitGallery outfits={savedOutfits} />
          </div>
        ) : (
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
          />
        )}
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

function ClosetTabs({ active }: { active: "items" | "avatar" | "outfits" }) {
  return (
    <div className="closet-tabs">
      <Link
        href="/wardrobe"
        className="closet-tab"
        data-active={active === "items" ? "true" : "false"}
        aria-current={active === "items" ? "page" : undefined}
      >
        Wardrobe
      </Link>
      <Link
        href="/wardrobe?view=outfits"
        className="closet-tab"
        data-active={active === "outfits" ? "true" : "false"}
        aria-current={active === "outfits" ? "page" : undefined}
      >
        Outfits
      </Link>
      <Link
        href="/wardrobe?view=avatar"
        className="closet-tab"
        data-active={active === "avatar" ? "true" : "false"}
        aria-current={active === "avatar" ? "page" : undefined}
      >
        Avatar
      </Link>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
