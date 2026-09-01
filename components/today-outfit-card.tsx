"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { chipsFromOutfit, ReasonStrip } from "@/components/reason-strip";
import type { GeneratedOutfit } from "@/lib/domain/outfits";
import { isRoleCompleteOutfit } from "@/lib/domain/outfits/role-complete";
import { saveTodayOutfitAction, suggestTodayOutfitWithWeatherAction } from "@/app/wardrobe/today-actions";

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
  const [liveOutfit, setLiveOutfit] = useState<GeneratedOutfit | null>(null);
  const [weatherLabel, setWeatherLabel] = useState<string | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "error">("idle");
  const activeOutfit = liveOutfit ?? outfit;

  async function useTodaysWeather() {
    if (!("geolocation" in navigator)) {
      setWeatherStatus("error");
      return;
    }

    setWeatherStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude)
          });
          const response = await fetch(`/api/weather/local?${params.toString()}`);
          const body = (await response.json()) as {
            weather_context?: { profile_label: string; location_label: string };
            error?: string;
          };

          if (!response.ok || !body.weather_context) {
            setWeatherStatus("error");
            return;
          }

          const result = await suggestTodayOutfitWithWeatherAction(
            body.weather_context.profile_label
          );

          if ("outfit" in result) {
            setLiveOutfit(result.outfit);
            setWeatherLabel(
              `${body.weather_context.profile_label} in ${body.weather_context.location_label}`
            );
            setWeatherStatus("idle");
          } else {
            setWeatherStatus("error");
          }
        } catch {
          setWeatherStatus("error");
        }
      },
      () => setWeatherStatus("error"),
      { timeout: 8000 }
    );
  }

  const localNow = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return { localDate: `${y}-${m}-${d}`, localHour: now.getHours() };
  }, []);

  const complete = isRoleCompleteOutfit(activeOutfit.garments);
  const firstGarmentId = activeOutfit.garments[0]?.id;
  const chips = chipsFromOutfit(activeOutfit, extraChips);
  const titles = activeOutfit.garments
    .map((garment) => garment.title?.trim() || garment.category)
    .join(" · ");

  return (
    <section className={`pw-panel ${compact ? "p-5" : "p-6 md:p-7"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="pw-kicker">Wear this</p>
        <button
          type="button"
          onClick={useTodaysWeather}
          disabled={weatherStatus === "loading"}
          className="text-[11px] uppercase tracking-[.14em] text-[var(--oxblood,var(--accent))] underline disabled:opacity-50"
        >
          {weatherStatus === "loading" ? "checking the sky…" : "use today's weather"}
        </button>
      </div>
      {weatherLabel ? (
        <p className="mt-2 text-[11px] text-[var(--muted)]">{weatherLabel}</p>
      ) : weatherStatus === "error" ? (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          couldn&apos;t read the weather — allow location and try again
        </p>
      ) : null}
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
                  activeOutfit.garments.map((garment) => ({
                    garment_id: garment.id,
                    role: garment.role
                  }))
                )}
              />
              <input type="hidden" name="title" value={titles.slice(0, 200)} />
              {activeOutfit.explanation ? (
                <input type="hidden" name="explanation" value={activeOutfit.explanation} />
              ) : null}
              <input
                type="hidden"
                name="explanation_json"
                value={JSON.stringify({
                  firedRules: activeOutfit.firedRules,
                  insights: activeOutfit.insights
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
