import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getGarmentById } from "@/lib/domain/wardrobe/service";
import { getOrCreateProfile } from "@/lib/domain/profile/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { ListingGate } from "@/components/garderobe/local-threads/listing-gate";
import { ListingForm } from "./listing-form";

/** 16c / w2c — list it locally, photos pre-picked from the piece's own images. */
export default async function ListLocallyPage({
  params
}: {
  params: Promise<{ garmentId: string }>;
}) {
  try {
    const { garmentId } = await params;
    const garment = await getGarmentById(garmentId);

    if (!garment) {
      notFound();
    }

    const profile = await getOrCreateProfile();

    return (
      <div className="mx-auto max-w-[520px] px-5 py-6 pb-16">
        <Link
          href={`/wardrobe/${garmentId}`}
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          {garment.title || garment.category}
        </Link>

        <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">
          list it locally
        </h1>
        <p className="pt-2 text-[12.5px] leading-[1.5] text-[var(--slate)]">
          Stays in your wardrobe and your counts until it sells. No payment moves through
          Garderobe — you and the buyer arrange cash, payid or a bank transfer yourselves.
        </p>

        <ListingGate
          garmentId={garmentId}
          ageConfirmed={Boolean(profile.age_confirmed_at)}
          ageDeclined={Boolean(profile.age_declined_at)}
          safetyBriefSeen={Boolean(profile.local_safety_brief_seen_at)}
        >
          <ListingForm
            garmentId={garmentId}
            suggestedTitle={garment.title || garment.category}
            suggestedSize={garment.size ?? null}
            wearCount={garment.wear_count}
          />
        </ListingGate>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe"
          title="Sign in with Supabase to list a piece locally."
          description="This page writes to user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
