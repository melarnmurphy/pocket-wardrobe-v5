import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOutfitById } from "@/lib/domain/outfits/service";
import { listWearEventsForOutfit } from "@/lib/domain/wear-events/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { LookCanvas } from "@/components/garderobe";
import { saveOutfitPlacementsAction } from "@/app/outfits/actions";
import { firedRuleSchema, outfitInsightSchema } from "@/lib/domain/outfits";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
    const firedRules = z.array(firedRuleSchema).safeParse(outfit.explanation_json?.fired_rules).data ?? [];
    const insights = z.array(outfitInsightSchema).safeParse(outfit.explanation_json?.insights).data ?? [];
    const provenance = outfit.explanation_json?.provenance as Record<string, unknown> | null | undefined;
    const sourcePath =
      provenance && typeof provenance === "object" && !Array.isArray(provenance) &&
      typeof provenance.storage_path === "string"
        ? provenance.storage_path
        : null;
    let sourceImageUrl: string | null = null;
    if (sourcePath) {
      const supabase = await createClient();
      const { data } = await supabase.storage.from("garment-originals").createSignedUrl(sourcePath, 3600);
      sourceImageUrl = data?.signedUrl ?? null;
    }
    const garmentLabels = new Map(
      outfit.items.map((item) => [item.garment_id, item.garment.title || item.garment.category])
    );

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

        {sourceImageUrl ? (
          <figure className="mt-6 overflow-hidden rounded-[18px] border border-[rgba(30,26,23,.12)] bg-[var(--surface)] shadow-[0_20px_50px_rgba(30,26,23,.1)]">
            <Image
              src={sourceImageUrl}
              alt="Original uploaded outfit"
              width={1200}
              height={900}
              unoptimized
              className="max-h-[620px] w-full object-cover"
            />
            <figcaption className="flex items-center justify-between px-4 py-3 text-[10px] uppercase tracking-[.16em] text-[var(--stone)]">
              <span>original look</span>
              <span>{outfit.items.length} pieces mapped</span>
            </figcaption>
          </figure>
        ) : null}

        {firedRules.length || insights.length ? (
          <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
                why it works
              </p>
              <span className="rounded-full bg-[rgba(30,26,23,.07)] px-2.5 py-1 text-[10px] text-[var(--slate)]">
                {firedRules.length} pairings
              </span>
            </div>
            <div className="grid gap-2">
              {firedRules.slice(0, 6).map((rule, index) => (
                <div key={`${rule.description}-${index}`} className="rounded-xl border border-[rgba(30,26,23,.1)] bg-[rgba(255,255,255,.72)] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rule.garment_ids.map((garmentId) => (
                      <span key={garmentId} className="rounded-full bg-[rgba(123,92,240,.1)] px-2 py-1 text-[10px] text-[var(--accent-strong)]">
                        {garmentLabels.get(garmentId) || "piece"}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-[var(--slate)]">{rule.description}</p>
                </div>
              ))}
            </div>
            {insights.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {insights.map((insight) => (
                  <span key={insight.key} className="rounded-full border border-[rgba(30,26,23,.12)] px-2.5 py-1 text-[10px] text-[var(--slate)]">
                    {insight.title}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

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
