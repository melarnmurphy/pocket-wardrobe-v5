import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getLocalListingDetail, incrementListingViews } from "@/lib/domain/local-threads/service";
import { getPublicProfile } from "@/lib/domain/profile/service";
import { AuthenticationError, getRequiredUser } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { CutoutTile } from "@/components/garderobe";

function formatMoney(cents: number) {
  return `A$${(cents / 100).toFixed(0)}`;
}

/** 16b / w2b — a listing, with the seller's lookbook photos at full size. */
export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await getRequiredUser();
    const listing = await getLocalListingDetail(id);

    if (!listing || (listing.status !== "live" && listing.seller_id !== viewer.id)) {
      notFound();
    }

    const seller = await getPublicProfile(listing.seller_id);

    if (listing.seller_id !== viewer.id) {
      await incrementListingViews(listing.id);
    }

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/local/nearby" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          nearby
        </Link>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {listing.photo_uris.length ? (
            listing.photo_uris.map((uri) => <CutoutTile key={uri} src={uri} alt={listing.description} />)
          ) : (
            <CutoutTile src={null} alt={listing.description} />
          )}
        </div>

        <div className="pt-5">
          <div className="text-[26px] font-light leading-[1.2] text-[var(--ink)]">
            {formatMoney(listing.ask_cents)}
            {listing.negotiable ? (
              <span className="pl-2 text-[12px] font-normal text-[var(--stone)]">or make an offer</span>
            ) : null}
          </div>
          <p className="pt-2 text-[12.5px] leading-[1.5] text-[var(--slate)]">{listing.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.size ? (
              <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
                size {listing.size}
              </span>
            ) : null}
            <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
              {listing.suburb}
            </span>
            {listing.show_wear_count && listing.wear_count_at_listing !== null ? (
              <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
                worn {listing.wear_count_at_listing}×
              </span>
            ) : null}
          </div>
        </div>

        <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            seller
          </p>
          {seller ? (
            <div>
              <p className="text-[17px] text-[var(--ink)]">{seller.localName || "a Garderobe user"}</p>
              {seller.suburb ? (
                <p className="pt-1 text-[12.5px] text-[var(--stone)]">{seller.suburb}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
                  {seller.handoverCount} handovers
                </span>
                <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
                  {seller.listedCount} listed
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--stone)]">seller details unavailable</p>
          )}
        </section>

        <p className="pt-6 text-[11px] text-[var(--stone)]">
          messaging and handover arrangement aren&apos;t built yet — that&apos;s next.
        </p>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/local/nearby"
          title="Sign in with Supabase to view this listing."
          description="This page reads user-owned and cross-user tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
