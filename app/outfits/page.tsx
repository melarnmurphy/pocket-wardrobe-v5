import { AuthenticationError } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import {
  listSavedOutfits,
  listUserTrendMatchesWithSignals
} from "@/lib/domain/outfits/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OutfitGenerator } from "@/components/outfit-generator";
import { OutfitGallery } from "@/components/outfit-gallery";

export default async function OutfitsPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string; item?: string }>
}) {
  const params = await searchParams;
  const initialMode = params.mode as "plan" | "surprise" | "trend" | undefined;
  const initialItemId = params.item;

  try {
    const [garments, styleRules, trendSignals, savedOutfits] = await Promise.all([
      listWardrobeGarments(),
      listStyleRules(),
      listUserTrendMatchesWithSignals(),
      listSavedOutfits()
    ]);

    // isPro: hardcoded false for this iteration
    const isPro = false;

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted)]">Outfits</p>
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold">Your Outfits</h1>
            <span className="text-sm text-[var(--muted)]">{savedOutfits.length} saved</span>
          </div>
        </div>

        <OutfitGenerator
          isPro={isPro}
          garments={garments}
          styleRules={styleRules}
          trendSignals={trendSignals}
          initialMode={initialMode}
          initialItemId={initialItemId}
        />

        <section>
          <h2 className="text-lg font-semibold mb-4">Saved Outfits</h2>
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
