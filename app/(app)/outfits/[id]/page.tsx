import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOutfitById } from "@/lib/domain/outfits/service";
import { listWearEventsForOutfit } from "@/lib/domain/wear-events/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { LookCanvas } from "@/components/garderobe";
import { saveOutfitPlacementsAction } from "@/app/outfits/actions";

/** 11b / w3g — what you wore, and when. Includes the 6d/w1b look canvas. */
export default async function LookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [outfit, wearDates, garments] = await Promise.all([
      getOutfitById(id),
      listWearEventsForOutfit(id),
      listWardrobeGarments()
    ]);

    if (!outfit) {
      notFound();
    }

    const previewByGarmentId = new Map<string, string | null>();
    for (const garment of garments) {
      previewByGarmentId.set(garment.id as string, garment.preview_url);
    }

    const pieces = outfit.items.map((item, index) => ({
      garmentId: item.garment_id,
      category: item.garment.category,
      previewUrl: previewByGarmentId.get(item.garment_id) ?? null,
      x: item.placement_x ?? 0.2 + (index % 3) * 0.3,
      y: item.placement_y ?? 0.2 + Math.floor(index / 3) * 0.3,
      z: item.placement_z ?? index,
      scale: item.placement_scale ?? 1,
      rotation: item.placement_rotation ?? 0
    }));

    async function save(
      placements: { garment_id: string; x: number; y: number; z: number; scale: number; rotation: number }[]
    ) {
      "use server";
      await saveOutfitPlacementsAction(id, placements);
    }

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link
          href="/outfits"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          looks
        </Link>

        <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">
          {outfit.title || "a look"}
        </h1>
        <p className="pt-2 text-[12.5px] text-[var(--slate)]">
          {[outfit.occasion, outfit.dress_code].filter(Boolean).join(" · ") || "no occasion noted"}
        </p>

        <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            worn {wearDates.length}×
          </p>
          {wearDates.length ? (
            <div className="flex flex-wrap gap-[7px]">
              {wearDates.slice(0, 12).map((date) => (
                <span
                  key={date}
                  className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]"
                >
                  {new Date(date).toLocaleDateString("en-AU")}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--stone)]">not logged as worn yet</p>
          )}
        </section>

        <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            arrange the pieces
          </p>
          <LookCanvas pieces={pieces} onSave={save} />
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/outfits"
          title="Sign in with Supabase to view this look."
          description="This page reads user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
