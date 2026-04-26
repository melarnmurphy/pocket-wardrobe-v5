import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import {
  getBillingStatus,
  getPremiumFeatureSummary
} from "@/lib/domain/billing/service";
import { getUserEntitlements } from "@/lib/domain/entitlements/service";
import { getDashboardStats, getRecentGarments } from "@/lib/domain/wardrobe/service";
import { createClient } from "@/lib/supabase/server";
import UploadCard from "@/app/components/upload-card";
import { PremiumUpsellCard } from "@/components/premium-upsell-card";

export default async function HomePage() {
  const user = await getOptionalUser();
  if (!user) redirect("/wardrobe");

  const [stats, recentGarments] = await Promise.all([
    getDashboardStats(),
    getRecentGarments(6)
  ]);
  const entitlements = await getUserEntitlements();
  const billingStatus = getBillingStatus();
  const premiumFeatures = getPremiumFeatureSummary();

  // Generate signed URLs for thumbnails
  const supabase = await createClient();
  const garmentThumbnails = await Promise.all(
    recentGarments.map(async (g) => {
      if (!g.storagePath) return { ...g, imageUrl: null };
      const { data } = await supabase.storage
        .from("garment-originals")
        .createSignedUrl(g.storagePath, 60 * 60); // 1 hour
      return { ...g, imageUrl: data?.signedUrl ?? null };
    })
  );

  const hasDrafts = stats.pendingDraftsCount > 0;
  const coverGarment = garmentThumbnails[0] ?? null;
  const supportingGarments = garmentThumbnails.slice(1, 5);

  return (
    <main className="pw-shell space-y-6">
      <section className="pw-editorial-frame pw-fade-up overflow-hidden p-4 md:p-6">
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="flex min-h-[36rem] flex-col justify-between gap-8 rounded-[8px] bg-white px-5 py-6 md:px-8 md:py-8">
            <div className="space-y-4">
              <p className="pw-kicker">Pocket Wardrobe Editorial System</p>
              <h1 className="pw-editorial-title max-w-[7.5ch]">
                Dress with
                <br />
                <span className="pw-highlight-bar">intention</span>
              </h1>
              <p className="pw-editorial-subtitle">
                A personal wardrobe operating system that turns garment data, wear history, and
                trend signals into decisions you can actually use.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Wardrobe
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.08em]">
                  {stats.garmentCount}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">owned pieces indexed</p>
              </div>
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Favourites
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.08em]">
                  {stats.favouritesCount}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">hero items saved</p>
              </div>
              <div className="border-t border-[var(--line)] pt-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                  Draft Review
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-[-0.08em]">
                  {stats.pendingDraftsCount}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {hasDrafts ? "items ready to confirm" : "nothing waiting"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/wardrobe" className="pw-button-primary">
                Open Wardrobe
              </Link>
              <Link href="/outfits" className="pw-button-secondary">
                Weekly Planner
              </Link>
              <Link href="/trends" className="pw-button-secondary">
                Trends
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] xl:grid-cols-1">
            <div className="pw-editorial-cover p-3 md:p-4">
              {coverGarment?.imageUrl ? (
                <div className="relative h-full min-h-[24rem] overflow-hidden rounded-[6px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverGarment.imageUrl}
                    alt={coverGarment.title ?? coverGarment.category}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 z-10 p-5 text-white">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white/72">
                      Latest Piece
                    </p>
                    <p className="mt-2 max-w-[8ch] text-4xl font-semibold uppercase tracking-[-0.1em] md:text-5xl">
                      {coverGarment.title ?? coverGarment.category}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[24rem] flex-col justify-between rounded-[6px] bg-[var(--hero-gradient)] p-5 text-white">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white/72">
                    Pocket Wardrobe
                  </p>
                  <p className="max-w-[8ch] text-5xl font-semibold uppercase leading-[0.88] tracking-[-0.1em]">
                    Build the wardrobe issue.
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <UploadCard
                canUseFeatureLabels={entitlements.feature_labels_enabled}
                planTier={entitlements.plan_tier}
              />
              {supportingGarments.length ? (
                <div className="pw-cover-block overflow-hidden p-3">
                  <p className="pw-kicker px-1 pb-3">Recent Grid</p>
                  <div className="grid grid-cols-2 gap-2">
                    {supportingGarments.map((garment) =>
                      garment.imageUrl ? (
                        <Link
                          key={garment.id}
                          href="/wardrobe"
                          className="aspect-[3/4] overflow-hidden rounded-[6px]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={garment.imageUrl}
                            alt={garment.title ?? garment.category}
                            className="h-full w-full object-cover"
                          />
                        </Link>
                      ) : (
                        <div
                          key={garment.id}
                          className="aspect-[3/4] rounded-[6px] bg-[rgba(123,92,240,0.08)]"
                        />
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="pw-cover-block flex min-h-[13rem] flex-col justify-between p-5">
                  <div>
                    <p className="pw-kicker">Trend Layer</p>
                    <p className="mt-3 max-w-[14ch] text-3xl font-semibold tracking-[-0.07em]">
                      See what you already own before you buy more.
                    </p>
                  </div>
                  <Link href="/trends" className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
                    Open Dashboard
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {!entitlements.feature_labels_enabled ? (
        <PremiumUpsellCard
          title="Unlock automatic garment labelling"
          description="Premium turns uploaded photos into review-ready garment drafts. Free users can still upload images, but they fill every field in manually."
          features={premiumFeatures}
          upgradeUrl={billingStatus.upgradeUrl}
          checkoutEnabled={billingStatus.checkoutEnabled}
        />
      ) : null}

      <div className="pw-editorial-frame pw-hover-panel pw-fade-up pw-stagger-4 p-5 md:p-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="pw-kicker">Recent Additions</p>
            <p className="mt-3 max-w-[20ch] text-3xl font-semibold tracking-[-0.07em]">
              The latest pieces added to your system.
            </p>
          </div>
          <Link href="/wardrobe" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
            View all →
          </Link>
        </div>

        {garmentThumbnails.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">
            No garments yet — upload a photo to get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {garmentThumbnails.map((g) =>
              g.imageUrl ? (
                <Link
                  key={g.id}
                  href="/wardrobe"
                  className="aspect-[3/4] overflow-hidden rounded-[6px] transition-transform duration-300 ease-out hover:-translate-y-1"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.imageUrl}
                    alt={g.title ?? g.category}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.04]"
                  />
                </Link>
              ) : (
                <div
                  key={g.id}
                  className="aspect-[3/4] rounded-[6px] bg-[rgba(123,92,240,0.08)]"
                  title={g.title ?? g.category}
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
