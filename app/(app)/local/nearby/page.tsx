import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NEARBY_SORT_VALUES, type NearbySort } from "@/lib/domain/local-threads";
import { searchNearby } from "@/lib/domain/local-threads/service";
import { getOrCreateProfile } from "@/lib/domain/profile/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Chip, CutoutTile } from "@/components/garderobe";
import { SaveRadiusButton } from "./save-radius-button";

function formatMoney(cents: number) {
  return `A$${(cents / 100).toFixed(0)}`;
}

/** 16a / w2a — what's for sale nearby, 30km default, expandable, four sorts. */
export default async function NearbyPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const resolved = searchParams ? await searchParams : undefined;
    const sortParam = firstParam(resolved?.sort);
    const sort: NearbySort = NEARBY_SORT_VALUES.includes(sortParam as NearbySort)
      ? (sortParam as NearbySort)
      : "closest";

    const profile = await getOrCreateProfile();
    const radiusParam = firstParam(resolved?.radius);
    const radiusKm = radiusParam ? Number.parseInt(radiusParam, 10) : profile.radius_km;

    const { listings, centre } = await searchNearby({ radiusKm, sort });

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          wardrobe
        </Link>

        <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">nearby</h1>
        <p className="pt-2 text-[12.5px] leading-[1.5] text-[var(--slate)]">
          what&apos;s for sale within {radiusKm} km
          {profile.suburb ? ` of ${profile.suburb}` : ""}
        </p>
        {radiusKm !== profile.radius_km ? (
          <div className="pt-1">
            <SaveRadiusButton radiusKm={radiusKm} />
          </div>
        ) : null}

        {!centre ? (
          <div className="mt-6 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-8 text-center">
            <p className="text-[12.5px] text-[var(--stone)]">
              Set your suburb in{" "}
              <Link href="/account" className="underline">
                your account
              </Link>{" "}
              to see what&apos;s nearby.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap gap-[7px]">
              {NEARBY_SORT_VALUES.map((value) => (
                <Link
                  key={value}
                  href={`/local/nearby?sort=${encodeURIComponent(value)}&radius=${radiusKm}`}
                  className="inline-block"
                >
                  <Chip variant={sort === value ? "selected" : "available"}>{value}</Chip>
                </Link>
              ))}
            </div>

            {listings.length ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {listings.map((listing) => (
                  <Link key={listing.id} href={`/local/${listing.id}`} className="block">
                    <CutoutTile src={listing.photo_uris[0] ?? null} alt={listing.description} />
                    <p className="pt-2 text-[14px] leading-[1.2] text-[var(--ink)]">
                      {formatMoney(listing.ask_cents)}
                    </p>
                    <p className="text-[11px] text-[var(--stone)]">
                      {listing.suburb} · {listing.distance_km.toFixed(1)} km
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
                <p className="text-[12.5px] text-[var(--stone)]">
                  nothing in {radiusKm} km —{" "}
                  <Link
                    href={`/local/nearby?sort=${sort}&radius=${Math.min(100, radiusKm + 20)}`}
                    className="underline"
                  >
                    try {Math.min(100, radiusKm + 20)}?
                  </Link>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/local/nearby"
          title="Sign in with Supabase to see what's nearby."
          description="This page reads listings scoped by your own suburb, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
