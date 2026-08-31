"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo } from "react";
import { chipsFromOutfit, ReasonStrip } from "@/components/reason-strip";
import type { GeneratedOutfit } from "@/lib/domain/outfits";
import { isRoleCompleteOutfit } from "@/lib/domain/outfits/unlock";
import { saveTodayOutfitAction } from "@/app/wardrobe/today-actions";

const EMPTY_COPY = "Add a few more pieces";

export function TodayOutfitCard({
  outfit,
  extraChips,
  compact = false
}: {
  outfit: GeneratedOutfit;
  extraChips?: string[];
  compact?: boolean;
}) {
  const localNow = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return { localDate: `${y}-${m}-${d}`, localHour: now.getHours() };
  }, []);

  const complete = isRoleCompleteOutfit(outfit.garments);
  const firstGarmentId = outfit.garments[0]?.id;
  const chips = chipsFromOutfit(outfit, extraChips);
  const titles = outfit.garments
    .map((garment) => garment.title?.trim() || garment.category)
    .join(" · ");

  return (
    <section className={`pw-panel ${compact ? "p-5" : "p-6 md:p-7"}`}>
      <p className="pw-kicker">Wear this</p>
      {complete ? (
        <>
          <h2
            className={`mt-3 font-semibold tracking-[-0.04em] ${compact ? "text-xl" : "text-2xl md:text-3xl"}`}
          >
            {titles}
          </h2>
          <div className="mt-4">
            <ReasonStrip chips={chips} />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <form action={saveTodayOutfitAction}>
              <input type="hidden" name="local_date" value={localNow.localDate} />
              <input type="hidden" name="local_hour" value={String(localNow.localHour)} />
              <input
                type="hidden"
                name="garments"
                value={JSON.stringify(
                  outfit.garments.map((garment) => ({
                    garment_id: garment.id,
                    role: garment.role
                  }))
                )}
              />
              <input type="hidden" name="title" value={titles.slice(0, 200)} />
              {outfit.explanation ? (
                <input type="hidden" name="explanation" value={outfit.explanation} />
              ) : null}
              <input
                type="hidden"
                name="explanation_json"
                value={JSON.stringify({
                  firedRules: outfit.firedRules,
                  insights: outfit.insights
                })}
              />
              <button type="submit" className="pw-button-primary">
                Wear this
              </button>
            </form>
            {firstGarmentId ? (
              <Link
                href={`/outfits?item=${encodeURIComponent(firstGarmentId)}` as Route}
                className="pw-button-secondary"
              >
                See why
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <p className={`mt-3 font-semibold tracking-[-0.04em] ${compact ? "text-xl" : "text-2xl"}`}>
          {EMPTY_COPY}
        </p>
      )}
    </section>
  );
}
