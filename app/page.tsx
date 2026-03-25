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

  return (
    <main className="pw-shell max-w-5xl">
      <section className="pw-hero pw-fade-up mb-5 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="pw-kicker text-white/72">Pocket Wardrobe</p>
            <h1 className="mt-4 max-w-[11ch] text-4xl font-semibold tracking-[-0.07em] leading-[0.95] md:text-6xl">
              Build a sharper wardrobe, then see exactly what is trending.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/78">
              Structured wardrobe data, explainable styling, and a dedicated trend dashboard now share one visual system.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/wardrobe" className="pw-button-secondary">
              Open Wardrobe
            </Link>
            <Link href="/trends" className="pw-button-quiet">
              Trend Dashboard
            </Link>
          </div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.6fr]">
        <div className="pw-stat-card pw-hover-panel pw-fade-up pw-stagger-1 p-4">
          <p className="pw-kicker">Wardrobe</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--foreground)]">{stats.garmentCount}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">items</p>
        </div>

        <div className="pw-stat-card pw-hover-panel pw-fade-up pw-stagger-2 p-4">
          <p className="pw-kicker">Favourites</p>
          <p className="mt-2 text-[28px] font-bold text-[var(--foreground)]">{stats.favouritesCount}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">items</p>
        </div>

        {hasDrafts ? (
          <Link
            href="/wardrobe/review"
            className="pw-stat-card pw-hover-panel pw-fade-up pw-stagger-3 p-4"
          >
            <p className="pw-kicker text-[var(--accent-secondary)]">Drafts</p>
            <p className="mt-2 text-[28px] font-bold text-[var(--accent-secondary)]">
              {stats.pendingDraftsCount}
            </p>
            <p className="mt-1 text-[11px] text-[var(--accent-secondary)]">ready to review →</p>
          </Link>
        ) : (
          <div className="pw-stat-card pw-hover-panel pw-fade-up pw-stagger-3 p-4">
            <p className="pw-kicker">Drafts</p>
            <p className="mt-2 text-[28px] font-bold text-[var(--foreground)]">0</p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">items</p>
          </div>
        )}

        <UploadCard
          canUseFeatureLabels={entitlements.feature_labels_enabled}
          planTier={entitlements.plan_tier}
        />
      </div>

      {!entitlements.feature_labels_enabled ? (
        <PremiumUpsellCard
          title="Unlock automatic garment labelling"
          description="Premium turns uploaded photos into review-ready garment drafts. Free users can still upload images, but they fill every field in manually."
          features={premiumFeatures}
          upgradeUrl={billingStatus.upgradeUrl}
          checkoutEnabled={billingStatus.checkoutEnabled}
        />
      ) : null}

      <div className="pw-panel-soft pw-hover-panel pw-fade-up pw-stagger-4 p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="pw-kicker">Recent Additions</p>
            <p className="mt-2 text-sm text-[var(--muted)]">The latest pieces added to your wardrobe system.</p>
          </div>
          <Link href="/wardrobe" className="text-[12px] font-semibold text-[var(--accent)]">
            View all →
          </Link>
        </div>

        {garmentThumbnails.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">
            No garments yet — upload a photo to get started.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {garmentThumbnails.map((g) =>
              g.imageUrl ? (
                <Link
                  key={g.id}
                  href="/wardrobe"
                  className="aspect-[3/4] overflow-hidden rounded-[10px] transition-transform duration-300 ease-out hover:-translate-y-1"
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
                  className="aspect-[3/4] rounded-[10px] bg-[rgba(123,92,240,0.08)]"
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
