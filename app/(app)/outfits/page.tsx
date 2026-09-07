import { AuthenticationError } from "@/lib/auth";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { getAccountProfile } from "@/lib/domain/account/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listSavedOutfits } from "@/lib/domain/outfits/service";
import { listLookbookEntries } from "@/lib/domain/lookbook/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { suggestTodayOutfit } from "@/lib/domain/outfits/today";
import { resolveWeatherProvider } from "@/lib/domain/weather/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OutfitPlanner } from "@/components/outfit-planner";
import { OutfitGallery } from "@/components/outfit-gallery";

export default async function OutfitsPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; item?: string; trend?: string }>;
}) {
  const params = await searchParams;

  try {
    const [entitlements, garments, savedOutfits, lookbookEntries, accountProfile, styleRules] =
      await Promise.all([
        getUserEntitlements(),
        listWardrobeGarments(),
        listSavedOutfits(),
        listLookbookEntries(),
        getAccountProfile(),
        listStyleRules()
      ]);
    const defaultWeatherProvider = resolveWeatherProvider();
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

    return (
      <main className="pw-shell flex min-h-screen flex-col gap-8">
        <OutfitPlanner
          garmentCount={garments.length}
          planTier={entitlements.plan_tier}
          defaultWeatherProvider={defaultWeatherProvider}
          wardrobeItems={garments}
          lookbookEntries={lookbookEntries}
          savedOutfits={savedOutfits}
          preferredLocation={accountProfile.preferred_location}
          focusGarmentId={params.item ?? null}
          trendSignalId={params.trend ?? null}
          todayOutfit={todayOutfit}
        />

        <section className="pw-editorial-frame p-5 md:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="pw-kicker">Saved Outfits</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.07em]">
                Archived looks from your generator.
              </p>
            </div>
            <span className="text-sm text-[var(--muted)]">
              {savedOutfits.length} saved
            </span>
          </div>
          <OutfitGallery outfits={savedOutfits} />
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/outfits"
          title="Sign in with Supabase to use the outfits workspace."
          description="This page reads and writes user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
