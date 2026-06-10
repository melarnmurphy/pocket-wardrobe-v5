"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CloudRain,
  CloudSun,
  SunMedium,
  Wind,
  type LucideIcon
} from "lucide-react";
import { z } from "zod";
import {
  firedRuleSchema,
  outfitInsightSchema,
  type GeneratedOutfit,
  type OutfitWithItems
} from "@/lib/domain/outfits";
import type { PlanTier } from "@/lib/domain/entitlements";
import { formatOutfitRoleLabel } from "@/lib/domain/outfits/generator";
import {
  weatherProfiles,
  type WeatherProfile
} from "@/lib/domain/style-rules/knowledge/weather";
import { localWeatherContextSchema, type LocalWeatherContext } from "@/lib/domain/weather";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { LookbookListItem } from "@/lib/domain/lookbook/service";
import { categoryToRole } from "@/lib/domain/outfits/generator";
import { generateOutfitAction, saveOutfitAction } from "@/app/outfits/actions";
import { showAppToast } from "@/lib/ui/app-toast";
import { bucketOutfitsByDate } from "@/lib/domain/outfits/calendar";

const weatherProfileLabels: Record<WeatherProfile, string> = {
  warm_sun: "Warm sun",
  mild_clear: "Mild clear",
  cool_breeze: "Cool breeze",
  cold_rain: "Cold rain"
};

const dressCodeOptions = [
  { value: "any", label: "Any" },
  { value: "casual", label: "Casual" },
  { value: "smart_casual", label: "Smart casual" },
  { value: "business_casual", label: "Business casual" },
  { value: "formal", label: "Formal" },
  { value: "black_tie", label: "Black tie" }
] as const;

const primaryEventOptions = [
  { key: "work_day", label: "Work Day" },
  { key: "office_day", label: "Office Day" },
  { key: "casual_day", label: "Casual Day" },
  { key: "travel_day", label: "Travel Day" },
  { key: "dinner", label: "Dinner" },
  { key: "event", label: "Event" },
  { key: "weekend", label: "Weekend" },
  { key: "custom", label: "Custom" }
] as const;

type WeeklyPlanDay = {
  key: string;
  label: string;
  shortLabel: string;
  dateIso: string;
  dateLabel: string;
  occasion: string;
  dressCode: string;
  weatherMode: "manual" | "auto";
  manualWeatherProfile: WeatherProfile;
  locationQuery: string;
  weatherContext: LocalWeatherContext | null;
  generatedOutfit: GeneratedOutfit | null;
  savedOutfitId: string | null;
};

type PlannerCanvasMode = "weather" | "calendar";

const weatherVisuals: Record<
  WeatherProfile,
  {
    icon: LucideIcon;
    iconClassName: string;
    chipClassName: string;
  }
> = {
  warm_sun: {
    icon: SunMedium,
    iconClassName: "text-[#c66f19]",
    chipClassName: "border-[#efcf9d] bg-[#fff4e4] text-[#8f5317]"
  },
  mild_clear: {
    icon: CloudSun,
    iconClassName: "text-[#4d78b5]",
    chipClassName: "border-[#cfdcf5] bg-[#edf4ff] text-[#355d95]"
  },
  cool_breeze: {
    icon: Wind,
    iconClassName: "text-[#2f7b74]",
    chipClassName: "border-[#c7e5df] bg-[#ebf8f4] text-[#27655f]"
  },
  cold_rain: {
    icon: CloudRain,
    iconClassName: "text-[#6074a5]",
    chipClassName: "border-[#d4dbef] bg-[#f1f4fb] text-[#4c618d]"
  }
};

export function OutfitPlanner({
  garmentCount,
  planTier,
  defaultWeatherProvider,
  wardrobeItems,
  lookbookEntries,
  savedOutfits,
  preferredLocation
}: {
  garmentCount: number;
  planTier: PlanTier;
  defaultWeatherProvider: "weatherapi" | "open-meteo";
  wardrobeItems: GarmentListItem[];
  lookbookEntries: LookbookListItem[];
  savedOutfits: OutfitWithItems[];
  preferredLocation: string | null;
}) {
  const [days, setDays] = useState<WeeklyPlanDay[]>(() =>
    createInitialWeek(preferredLocation, wardrobeItems, savedOutfits)
  );
  const [activeDayKey, setActiveDayKey] = useState(
    () => createInitialWeek(preferredLocation, wardrobeItems, savedOutfits)[0]?.key ?? "monday"
  );
  const [canvasMode, setCanvasMode] = useState<PlannerCanvasMode>("weather");
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedPreferredLocationsRef = useRef<Set<string>>(new Set());

  const activeDay = useMemo(
    () => days.find((day) => day.key === activeDayKey) ?? days[0],
    [activeDayKey, days]
  );
  const weekRangeLabel = useMemo(
    () => formatWeekRange(days[0]?.dateIso, days[days.length - 1]?.dateIso),
    [days]
  );
  const calendarMonthLabel = useMemo(
    () => formatCalendarMonthLabel(days),
    [days]
  );
  const plannedDayCount = days.filter((day) => day.generatedOutfit || day.occasion.trim()).length;

  useEffect(() => {
    const normalizedPreferredLocation = preferredLocation?.trim();

    if (!normalizedPreferredLocation) {
      return;
    }

    if (hydratedPreferredLocationsRef.current.has(normalizedPreferredLocation)) {
      return;
    }

    const hasDaysNeedingHydration = days.some(
      (day) =>
        day.weatherMode === "auto" &&
        !day.weatherContext &&
        day.locationQuery.trim() === normalizedPreferredLocation
    );

    if (!hasDaysNeedingHydration) {
      hydratedPreferredLocationsRef.current.add(normalizedPreferredLocation);
      return;
    }

    hydratedPreferredLocationsRef.current.add(normalizedPreferredLocation);
    const daysToHydrate = days.filter(
      (day) =>
        day.weatherMode === "auto" &&
        !day.weatherContext &&
        day.locationQuery.trim() === normalizedPreferredLocation
    );

    void Promise.all(
      daysToHydrate.map(async (day) => {
        const weatherContext = await fetchLocalWeather(
          new URLSearchParams({
            location: normalizedPreferredLocation,
            weather_date: day.dateIso,
            provider: defaultWeatherProvider
          })
        );

        setDays((currentDays) =>
          currentDays.map((currentDay) =>
            currentDay.key === day.key
              ? {
                  ...currentDay,
                  weatherContext,
                  locationQuery: weatherContext.location_label || currentDay.locationQuery
                }
              : currentDay
          )
        );
      })
    ).catch(() => {
      hydratedPreferredLocationsRef.current.delete(normalizedPreferredLocation);
    });
  }, [days, preferredLocation, defaultWeatherProvider]);

  function updateDay(dayKey: string, updater: (day: WeeklyPlanDay) => WeeklyPlanDay) {
    setDays((currentDays) =>
      currentDays.map((day) => (day.key === dayKey ? updater(day) : day))
    );
  }

  function updateActiveDay(
    updates:
      | Partial<WeeklyPlanDay>
      | ((day: WeeklyPlanDay) => Partial<WeeklyPlanDay>)
  ) {
    if (!activeDay) {
      return;
    }

    updateDay(activeDay.key, (day) => ({
      ...day,
      ...(typeof updates === "function" ? updates(day) : updates)
    }));
  }

  function handleResetDay() {
    updateActiveDay({
      occasion: "",
      dressCode: "any",
      weatherMode: "auto",
      manualWeatherProfile: "mild_clear",
      locationQuery: preferredLocation ?? "",
      weatherContext: null,
      generatedOutfit: null,
      savedOutfitId: null
    });
  }

  async function fetchLocalWeather(params: URLSearchParams) {
    const response = await fetch(`/api/weather/local?${params.toString()}`, {
      method: "GET"
    });
    const payload = (await response.json()) as {
      error?: string;
      weather_context?: LocalWeatherContext;
    };

    if (!response.ok || !payload.weather_context) {
      throw new Error(payload.error ?? "Unable to load local weather.");
    }

    return payload.weather_context;
  }

  async function loadWeatherForActiveDay(params: URLSearchParams) {
    if (!activeDay) {
      return;
    }

    setIsLoadingWeather(true);
    setError(null);

    try {
      const weatherContext = await fetchLocalWeather(params);

      updateDay(activeDay.key, (day) => ({
        ...day,
        weatherMode: "auto",
        weatherContext,
        locationQuery: weatherContext.location_label ?? day.locationQuery
      }));
      showAppToast({
        tone: "success",
        message: `Loaded ${weatherContext.profile_label.toLowerCase()} for ${activeDay.label}.`
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load local weather.";
      setError(message);
      showAppToast({ tone: "error", message });
    } finally {
      setIsLoadingWeather(false);
    }
  }

  function handleLocationLookup() {
    if (!activeDay) {
      return;
    }

    if (!activeDay.locationQuery.trim()) {
      const message = "Enter a city or suburb to load local weather.";
      setError(message);
      showAppToast({ tone: "error", message });
      return;
    }

    const params = new URLSearchParams({
      location: activeDay.locationQuery.trim(),
      weather_date: activeDay.dateIso,
      provider: defaultWeatherProvider
    });
    void loadWeatherForActiveDay(params);
  }

  function requestCurrentLocationWeather(options?: { silent?: boolean }) {
    if (!activeDay) {
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      if (!options?.silent) {
        const message = "Geolocation is not available in this browser.";
        setError(message);
        showAppToast({ tone: "error", message });
      }
      return;
    }

    setIsLoadingWeather(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams({
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
          weather_date: activeDay.dateIso,
          provider: defaultWeatherProvider
        });
        void loadWeatherForActiveDay(params);
      },
      (geoError) => {
        setIsLoadingWeather(false);
        if (!options?.silent) {
          const message = geoError.message || "Unable to access your current location.";
          setError(message);
          showAppToast({ tone: "error", message });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }

  function handleCurrentLocation() {
    requestCurrentLocationWeather();
  }

  async function handleGenerate() {
    if (!activeDay) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    const result = await generateOutfitAction({
      mode: "plan",
      occasion: activeDay.occasion.trim() || null,
      dress_code: activeDay.dressCode === "any" ? null : activeDay.dressCode,
      weather:
        activeDay.weatherMode === "auto" && activeDay.weatherContext
          ? activeDay.weatherContext.profile
          : activeDay.manualWeatherProfile
    });

    if ("error" in result) {
      setError(result.error);
      showAppToast({ tone: "error", message: result.error });
    } else {
      updateActiveDay({
        generatedOutfit: result.outfit,
        savedOutfitId: null
      });
      setIsGenerateDialogOpen(false);
      showAppToast({
        tone: "success",
        message: `Generated a planned outfit for ${activeDay.label}.`
      });
    }

    setIsGenerating(false);
  }

  async function handleSave() {
    if (!activeDay?.generatedOutfit) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await saveOutfitAction({
      title: buildOutfitTitle(activeDay),
      occasion: activeDay.occasion.trim() || null,
      dress_code: activeDay.dressCode === "any" ? null : activeDay.dressCode,
      planned_for: activeDay.dateIso,
      weather_context_json: buildWeatherPayload(activeDay),
      explanation: activeDay.generatedOutfit.explanation,
      explanation_json: {
        rules: activeDay.generatedOutfit.firedRules,
        insights: activeDay.generatedOutfit.insights,
        planner_day: activeDay.key
      },
      garments: activeDay.generatedOutfit.garments.map((garment) => ({
        garment_id: garment.id,
        role: garment.role
      }))
    });

    if ("error" in result) {
      setError(result.error);
      showAppToast({ tone: "error", message: result.error });
    } else {
      updateActiveDay({ savedOutfitId: result.id });
      showAppToast({
        tone: "success",
        message: `Saved ${activeDay.label}'s planned outfit.`
      });
    }

    setIsSaving(false);
  }

  if (!activeDay) {
    return null;
  }

  const activeWeatherLabel =
    activeDay.weatherMode === "auto" && activeDay.weatherContext
      ? activeDay.weatherContext.profile_label
      : weatherProfileLabels[activeDay.manualWeatherProfile];
  const activeWeatherPresentation = getWeatherPresentation(activeDay);

  return (
    <section className="space-y-6">
      <div className="pw-editorial-frame overflow-hidden p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div>
              <p className="pw-kicker">Outfit Planning</p>
              <h1 className="mt-3 max-w-[10ch] text-4xl font-semibold tracking-[-0.08em] md:text-6xl">
                Monday to Sunday, planned like an issue.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
                Build a weekly outfit schedule with weather-aware context per day, then generate
                and save the strongest look for each slot.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <PlannerStat label="Week" value={weekRangeLabel} />
              <PlannerStat label="Wardrobe" value={`${garmentCount} items`} />
              <PlannerStat
                label="Planning"
                value={`${plannedDayCount} of ${days.length} days shaped`}
              />
            </div>
          </div>

          <div className="pw-panel-soft flex flex-col gap-4 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.92))] p-5">
            <div>
              <p className="pw-kicker">Active Day</p>
              <p className="mt-3 text-3xl font-semibold tracking-[-0.07em]">
                {activeDay.label}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {activeDay.dateLabel} · {activeWeatherLabel} · {activeWeatherPresentation.temperatureLabel}
                {activeDay.weatherMode === "auto" && activeDay.weatherContext
                  ? ` · ${activeDay.weatherContext.location_label}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-1 flex-col">
              {activeDay.generatedOutfit ? (
                <PlannedOutfitCard
                  outfit={activeDay.generatedOutfit}
                  isSaving={isSaving}
                  isSaved={Boolean(activeDay.savedOutfitId)}
                  onSave={handleSave}
                  onClear={() => updateActiveDay({ generatedOutfit: null, savedOutfitId: null })}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setIsGenerateDialogOpen(true)}
                    className="pw-button-primary px-4 py-2 text-sm"
                  >
                    Generate Outfit
                  </button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="pw-chip normal-case tracking-normal">
                  {planTier === "free" ? "Free plan" : `${planTier} plan`}
                </span>
                {activeDay.savedOutfitId ? (
                  <span className="pw-chip normal-case tracking-normal">Saved</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="pw-panel-soft p-4 md:p-5">
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="pw-kicker">{canvasMode === "weather" ? "Weekly View" : "Monthly View"}</p>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.06em]">
                  {canvasMode === "weather" ? "Monday through Sunday" : calendarMonthLabel}
                </p>
                {canvasMode === "weather" ? (
                  <p className="mt-2 text-sm font-medium text-[var(--muted)]">{weekRangeLabel}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="inline-flex rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.82)] p-1 shadow-[0_10px_24px_rgba(17,17,17,0.05)]">
                  {([
                    {
                      key: "weather",
                      label: "Weather",
                      icon: CloudSun
                    },
                    {
                      key: "calendar",
                      label: "Calendar",
                      icon: CalendarDays
                    }
                  ] as const).map((option) => {
                    const Icon = option.icon;
                    const isActive = canvasMode === option.key;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setCanvasMode(option.key)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium tracking-[-0.01em] transition ${
                          isActive
                            ? "bg-[#111111] text-white shadow-[0_14px_30px_rgba(17,17,17,0.14)]"
                            : "text-[var(--muted)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Select a day to edit the planning context
                </p>
              </div>
            </div>

            {canvasMode === "weather" ? (
              <WeatherPlannerGrid
                days={days}
                activeDayKey={activeDay.key}
                onSelectDay={setActiveDayKey}
              />
            ) : (
              <CalendarPlannerGrid
                days={days}
                activeDayKey={activeDay.key}
                onSelectDay={setActiveDayKey}
                wardrobeItems={wardrobeItems}
                lookbookEntries={lookbookEntries}
                onApplyLook={(dayKey, outfit) =>
                  updateDay(dayKey, (day) => ({
                    ...day,
                    generatedOutfit: outfit,
                    savedOutfitId: null
                  }))
                }
              />
            )}
        </div>

        <ActiveDayCard
          day={activeDay}
          weatherLabel={activeWeatherLabel}
          weatherPresentation={activeWeatherPresentation}
          isLoadingWeather={isLoadingWeather}
          error={error}
          onUpdateDay={updateActiveDay}
          onResetDay={handleResetDay}
          onLocationLookup={handleLocationLookup}
          onCurrentLocation={handleCurrentLocation}
        />
      </div>

      {isGenerateDialogOpen ? (
        <DialogShell onClose={() => setIsGenerateDialogOpen(false)} size="max-w-3xl">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="pw-kicker">Generate Outfit</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.07em]">
                  {activeDay.label}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Review the context before generating this day&apos;s outfit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateDialogOpen(false)}
                className="pw-button-quiet px-4 py-2 text-sm"
              >
                Close
              </button>
            </div>

            <PlanningContextEditor
              day={activeDay}
              weatherLabel={activeWeatherLabel}
              weatherPresentation={activeWeatherPresentation}
              isLoadingWeather={isLoadingWeather}
              onUpdateDay={updateActiveDay}
              onLocationLookup={handleLocationLookup}
              onCurrentLocation={handleCurrentLocation}
            />

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsGenerateDialogOpen(false)}
                className="pw-button-quiet px-4 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="pw-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? "Generating..." : "Generate Outfit"}
              </button>
            </div>
          </div>
        </DialogShell>
      ) : null}
    </section>
  );
}

function PlannedOutfitCard({
  outfit,
  isSaving,
  isSaved,
  onSave,
  onClear
}: {
  outfit: GeneratedOutfit;
  isSaving: boolean;
  isSaved: boolean;
  onSave: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col space-y-4 rounded-[10px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,244,238,0.76))] p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="pw-kicker">Planned Outfit</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.06em]">
            {outfit.garments.length} items selected
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="pw-button-secondary w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isSaving ? "Saving..." : "Save Planned Outfit"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="pw-button-quiet w-full px-5 py-3 text-sm sm:w-auto"
          >
            Clear Result
          </button>
        </div>
      </div>

      {isSaved ? <span className="pw-chip normal-case tracking-normal">Saved to archive</span> : null}

      <div className="grid gap-3">
        {outfit.garments.map((garment) => (
          <div
            key={garment.id}
            className="flex items-center gap-3 rounded-[8px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,244,238,0.92))] px-3 py-3"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[6px] bg-[rgba(17,17,17,0.04)]">
              {garment.preview_url ? (
                <img
                  src={garment.preview_url}
                  alt={garment.title ?? garment.category}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                {formatOutfitRoleLabel(garment)}
              </p>
              <p className="mt-1 truncate text-base font-semibold tracking-[-0.03em]">
                {garment.title ?? garment.category}
              </p>
              <p className="text-xs text-[var(--muted)]">{garment.category}</p>
            </div>
          </div>
        ))}
      </div>

      {outfit.explanation ? (
        <p className="rounded-[8px] border border-[rgba(17,17,17,0.06)] bg-[rgba(17,17,17,0.03)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
          {outfit.explanation}
        </p>
      ) : null}

      {outfit.insights.length ? <OutfitInsightGrid outfit={outfit} /> : null}

    </div>
  );
}

function OutfitInsightGrid({ outfit }: { outfit: GeneratedOutfit }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {outfit.insights.map((insight) => (
        <div
          key={insight.key}
          className="rounded-[8px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,238,0.92))] p-4"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
            {insight.title}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--foreground)]">
            {insight.body}
          </p>
          {insight.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {insight.tags.map((tag) => (
                <span
                  key={`${insight.key}-${tag}`}
                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--foreground)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function WeatherPlannerGrid({
  days,
  activeDayKey,
  onSelectDay
}: {
  days: WeeklyPlanDay[];
  activeDayKey: string;
  onSelectDay: (dayKey: string) => void;
}) {
  const todayIso = toDateIso(new Date());

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
      {days.map((day) => {
        const isActive = day.key === activeDayKey;
        const isPlanned = Boolean(day.generatedOutfit || day.occasion.trim());
        const isToday = day.dateIso === todayIso;
        const weatherPresentation = getWeatherPresentation(day);
        const WeatherIcon = weatherPresentation.icon;

        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelectDay(day.key)}
            className={`relative overflow-hidden rounded-[8px] border p-4 text-left transition-all ${
              isActive
                ? "border-[var(--foreground)] bg-white shadow-[0_18px_40px_rgba(17,17,17,0.08)]"
                : isToday
                  ? "border-[rgba(17,17,17,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,238,0.92))] shadow-[0_16px_34px_rgba(17,17,17,0.06)]"
                : "border-[var(--line)] bg-[rgba(255,255,255,0.76)] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(17,17,17,0.08)]"
            }`}
          >
            {isActive ? (
              <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary),var(--accent-highlight))]" />
            ) : isToday ? (
              <span className="absolute inset-x-0 top-0 h-1 bg-[rgba(17,17,17,0.14)]" />
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
                  {day.shortLabel}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.08em]">
                  {day.dateLabel}
                </p>
              </div>
              {day.savedOutfitId ? (
                <span className="rounded-full bg-[rgba(17,17,17,0.06)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
                  Saved
                </span>
              ) : isToday ? (
                <span className="rounded-full border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.92)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
                  Today
                </span>
              ) : isPlanned ? (
                <span className="rounded-full bg-[rgba(123,92,240,0.1)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
                  Drafted
                </span>
              ) : null}
            </div>

                    <div className="mt-5 space-y-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                          Occasion
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-medium">
                  {day.occasion.trim() || "Open slot"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Dress Code
                </p>
                <p className="mt-1 text-sm font-medium">
                  {formatDressCode(day.dressCode)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Weather
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${weatherPresentation.chipClassName}`}
                  >
                    <WeatherIcon className={`h-4 w-4 ${weatherPresentation.iconClassName}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-medium">{weatherPresentation.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-[var(--muted)]">
                        {weatherPresentation.temperatureLabel}
                      </p>
                      {weatherPresentation.sourceLabel ? (
                        <span className="rounded-full border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.92)] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
                          {weatherPresentation.sourceLabel}
                        </span>
                      ) : null}
                    </div>
                          </div>
                        </div>
                      </div>

                      {day.generatedOutfit?.garments.length ? (
                        <div className="pt-1">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                            Look
                          </p>
                          <div className="mt-2 flex gap-2">
                            {day.generatedOutfit.garments.slice(0, 4).map((garment) => (
                              <div
                                key={`${day.key}-${garment.id}`}
                                className="h-14 w-14 overflow-hidden rounded-[6px] border border-[rgba(17,17,17,0.06)] bg-[rgba(17,17,17,0.04)]"
                              >
                                {garment.preview_url ? (
                                  <img
                                    src={garment.preview_url}
                                    alt={garment.title ?? garment.category}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
                                    {garment.role}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
      })}
    </div>
  );
}

function CalendarPlannerGrid({
  days,
  activeDayKey,
  onSelectDay,
  wardrobeItems,
  lookbookEntries,
  onApplyLook
}: {
  days: WeeklyPlanDay[];
  activeDayKey: string;
  onSelectDay: (dayKey: string) => void;
  wardrobeItems: GarmentListItem[];
  lookbookEntries: LookbookListItem[];
  onApplyLook: (dayKey: string, outfit: GeneratedOutfit) => void;
}) {
  const cells = buildCalendarCells(days);
  const dayHeadings = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [addLookDayKey, setAddLookDayKey] = useState<string | null>(null);
  const addLookDay = days.find((day) => day.key === addLookDayKey) ?? null;

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,243,238,0.88))]">
        <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[rgba(247,243,236,0.72)]">
          {dayHeadings.map((heading) => (
            <div
              key={heading}
              className="px-2 py-3 text-center text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]"
            >
              {heading}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            if (!cell.day) {
              return (
                <div
                  key={cell.key}
                  className="min-h-[118px] border-r border-b border-[var(--line)] bg-[rgba(244,239,232,0.35)]"
                />
              );
            }

            const { day } = cell;
            const isActive = day.key === activeDayKey;
            const isPlanned = Boolean(day.generatedOutfit || day.occasion.trim());

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => onSelectDay(day.key)}
                className={`group relative min-h-[118px] border-r border-b border-[var(--line)] px-2 py-2 text-left transition ${
                  isActive
                    ? "bg-[rgba(255,255,255,0.98)] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.08)]"
                    : "bg-[rgba(255,255,255,0.82)] hover:bg-white"
                }`}
              >
                {isActive ? (
                  <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary),var(--accent-highlight))]" />
                ) : null}

                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                    {getDateNumber(day.dateIso)}
                  </span>
                  {day.savedOutfitId ? (
                    <span className="rounded-full bg-[rgba(17,17,17,0.07)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
                      Saved
                    </span>
                  ) : null}
                </div>

                <div className="mt-2">
                  <CalendarCellOutfitPreview
                    day={day}
                    isPlanned={isPlanned}
                    onAddLook={() => {
                      onSelectDay(day.key);
                      setAddLookDayKey(day.key);
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {addLookDay ? (
        <PlannerAddLookDialog
          day={addLookDay}
          wardrobeItems={wardrobeItems}
          lookbookEntries={lookbookEntries}
          onClose={() => setAddLookDayKey(null)}
          onApplyLook={(outfit) => {
            onApplyLook(addLookDay.key, outfit);
            setAddLookDayKey(null);
          }}
        />
      ) : null}
    </>
  );
}

function CalendarCellOutfitPreview({
  day,
  isPlanned,
  onAddLook
}: {
  day: WeeklyPlanDay;
  isPlanned: boolean;
  onAddLook: () => void;
}) {
  const previewGarments =
    day.generatedOutfit?.garments.filter((garment) => Boolean(garment.preview_url)).slice(0, 4) ?? [];

  if (!previewGarments.length) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAddLook();
        }}
        className={`flex h-[62px] w-full items-center justify-center rounded-[8px] border px-3 text-center transition ${
          isPlanned
            ? "border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.82)]"
            : "border-dashed border-[rgba(17,17,17,0.12)] bg-[linear-gradient(180deg,rgba(249,246,240,0.92),rgba(244,239,232,0.68))] hover:border-[rgba(17,17,17,0.22)] hover:bg-white"
        }`}
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          {day.savedOutfitId ? "Saved look" : "Add look"}
        </span>
      </button>
    );
  }

  if (previewGarments.length === 1) {
    const garment = previewGarments[0];

    return (
      <div className="h-[70px] overflow-hidden rounded-[8px] border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.8)]">
        <img
          src={garment.preview_url ?? ""}
          alt={garment.title ?? garment.category}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="grid h-[70px] grid-cols-2 gap-1">
      {previewGarments.map((garment) => (
        <div
          key={garment.id}
          className="overflow-hidden rounded-[7px] border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.82)]"
        >
          <img
            src={garment.preview_url ?? ""}
            alt={garment.title ?? garment.category}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

function PlannerAddLookDialog({
  day,
  wardrobeItems,
  lookbookEntries,
  onClose,
  onApplyLook
}: {
  day: WeeklyPlanDay;
  wardrobeItems: GarmentListItem[];
  lookbookEntries: LookbookListItem[];
  onClose: () => void;
  onApplyLook: (outfit: GeneratedOutfit) => void;
}) {
  const [sourceMode, setSourceMode] = useState<"wardrobe" | "lookbook">("wardrobe");
  const [selectedWardrobeIds, setSelectedWardrobeIds] = useState<string[]>([]);
  const [selectedLookbookId, setSelectedLookbookId] = useState<string | null>(null);
  const [wardrobeQuery, setWardrobeQuery] = useState("");
  const [wardrobeTypeFilter, setWardrobeTypeFilter] = useState("all");
  const [wardrobeColourFilter, setWardrobeColourFilter] = useState("all");
  const [wardrobeFavouritesOnly, setWardrobeFavouritesOnly] = useState(false);
  const deferredWardrobeQuery = useDeferredValue(wardrobeQuery);

  const wardrobeById = useMemo(
    () => new Map(wardrobeItems.map((item) => [item.id, item])),
    [wardrobeItems]
  );
  const wardrobeCategories = useMemo(
    () => Array.from(new Set(wardrobeItems.map((item) => item.category).filter(Boolean))).sort(),
    [wardrobeItems]
  );
  const wardrobeColours = useMemo<string[]>(
    () =>
      Array.from(
        new Set(
          wardrobeItems
            .map((item) => item.primary_colour_family)
            .filter((colour): colour is string => Boolean(colour))
        )
      ).sort(),
    [wardrobeItems]
  );

  const selectedLookbook = useMemo(
    () => lookbookEntries.find((entry) => entry.id === selectedLookbookId) ?? null,
    [lookbookEntries, selectedLookbookId]
  );

  const selectedLookbookGarments = useMemo(() => {
    if (!selectedLookbook) {
      return [];
    }

    return selectedLookbook.items
      .map((item) => (item.garment_id ? wardrobeById.get(item.garment_id) ?? null : null))
      .filter((item): item is GarmentListItem => Boolean(item));
  }, [selectedLookbook, wardrobeById]);

  const selectedWardrobeItems = useMemo(
    () =>
      selectedWardrobeIds
        .map((id) => wardrobeById.get(id) ?? null)
        .filter((item): item is GarmentListItem => Boolean(item)),
    [selectedWardrobeIds, wardrobeById]
  );
  const filteredWardrobeItems = useMemo(() => {
    const normalizedQuery = deferredWardrobeQuery.trim().toLowerCase();

    return wardrobeItems.filter((garment) => {
      if (normalizedQuery) {
        const haystack = [
          garment.title,
          garment.brand,
          garment.category,
          garment.subcategory,
          garment.material
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }

      if (wardrobeTypeFilter !== "all" && garment.category !== wardrobeTypeFilter) {
        return false;
      }

      if (wardrobeColourFilter !== "all" && garment.primary_colour_family !== wardrobeColourFilter) {
        return false;
      }

      if (wardrobeFavouritesOnly && !(garment.favourite_score && garment.favourite_score > 0)) {
        return false;
      }

      return true;
    });
  }, [
    deferredWardrobeQuery,
    wardrobeColourFilter,
    wardrobeFavouritesOnly,
    wardrobeItems,
    wardrobeTypeFilter
  ]);

  const canApplyWardrobe = selectedWardrobeItems.length > 0;
  const canApplyLookbook = selectedLookbookGarments.length > 0;

  function toggleWardrobeItem(garmentId: string) {
    setSelectedWardrobeIds((current) =>
      current.includes(garmentId)
        ? current.filter((id) => id !== garmentId)
        : [...current, garmentId]
    );
  }

  return (
    <DialogShell onClose={onClose} size="max-w-4xl">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="pw-kicker">Add Look</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.06em]">{day.label}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Build this day&apos;s look from your wardrobe or a saved lookbook reference.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pw-button-quiet px-4 py-2 text-sm"
          >
            Close
          </button>
        </div>

        <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
          {([
            { key: "wardrobe", label: "Wardrobe" },
            { key: "lookbook", label: "Lookbook" }
          ] as const).map((option) => {
            const isActive = sourceMode === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSourceMode(option.key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  isActive ? "bg-[#111111] text-white" : "text-[var(--muted)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {sourceMode === "wardrobe" ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Select multiple pieces to build this day&apos;s look.
              </p>
              <span className="pw-chip normal-case tracking-normal">
                {selectedWardrobeItems.length} selected
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,minmax(0,0.6fr))]">
              <input
                value={wardrobeQuery}
                onChange={(event) => setWardrobeQuery(event.target.value)}
                placeholder="Search title, brand, category"
                className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              />
              <select
                value={wardrobeTypeFilter}
                onChange={(event) => setWardrobeTypeFilter(event.target.value)}
                className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="all">All types</option>
                {wardrobeCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={wardrobeColourFilter}
                onChange={(event) => setWardrobeColourFilter(event.target.value)}
                className="rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="all">All colours</option>
                {wardrobeColours.map((colour) => (
                  <option key={colour} value={colour}>
                    {colour}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setWardrobeFavouritesOnly((current) => !current)}
                className={`rounded-[10px] border px-4 py-3 text-sm transition ${
                  wardrobeFavouritesOnly
                    ? "border-[var(--foreground)] bg-[rgba(17,17,17,0.04)] text-[var(--foreground)]"
                    : "border-[var(--line)] bg-white text-[var(--muted)]"
                }`}
              >
                Favourites
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredWardrobeItems.map((garment) => {
                const garmentId = garment.id;

                if (!garmentId) {
                  return null;
                }

                const safeGarmentId: string = garmentId;

                const isSelected = selectedWardrobeIds.includes(safeGarmentId);

                return (
                  <button
                    key={safeGarmentId}
                    type="button"
                    onClick={() => toggleWardrobeItem(safeGarmentId)}
                    className={`rounded-[12px] border p-3 text-left transition ${
                      isSelected
                        ? "border-[var(--foreground)] bg-[rgba(17,17,17,0.03)] shadow-[0_14px_30px_rgba(17,17,17,0.08)]"
                        : "border-[var(--line)] bg-white hover:border-[rgba(17,17,17,0.18)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold tracking-[-0.03em]">
                          {garment.title ?? garment.category}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{garment.category}</p>
                      </div>
                      {isSelected ? (
                        <span className="rounded-full bg-[#111111] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                          Added
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 h-32 overflow-hidden rounded-[10px] bg-[rgba(17,17,17,0.04)]">
                      {garment.preview_url ? (
                        <img
                          src={garment.preview_url}
                          alt={garment.title ?? garment.category}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                          No image
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {!filteredWardrobeItems.length ? (
              <div className="rounded-[12px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.72)] px-4 py-6 text-sm text-[var(--muted)]">
                No wardrobe pieces match these filters.
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onApplyLook(buildGeneratedOutfitFromGarments(selectedWardrobeItems))}
                disabled={!canApplyWardrobe}
                className="pw-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add Selected Pieces
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {lookbookEntries.map((entry) => {
                const isSelected = entry.id === selectedLookbookId;
                const linkedGarmentCount = entry.items.filter((item) => item.garment_id).length;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedLookbookId(entry.id)}
                    className={`rounded-[12px] border p-4 text-left transition ${
                      isSelected
                        ? "border-[var(--foreground)] bg-[rgba(17,17,17,0.03)] shadow-[0_14px_30px_rgba(17,17,17,0.08)]"
                        : "border-[var(--line)] bg-white hover:border-[rgba(17,17,17,0.18)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold tracking-[-0.03em]">
                          {entry.title ?? "Untitled lookbook entry"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                          {linkedGarmentCount
                            ? `${linkedGarmentCount} linked wardrobe piece${linkedGarmentCount === 1 ? "" : "s"}`
                            : "No linked wardrobe pieces yet"}
                        </p>
                      </div>
                      {isSelected ? (
                        <span className="rounded-full bg-[#111111] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onApplyLook(buildGeneratedOutfitFromGarments(selectedLookbookGarments))}
                disabled={!canApplyLookbook}
                className="pw-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use Lookbook Selection
              </button>
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}

function ActiveDayCard({
  day,
  weatherLabel,
  weatherPresentation,
  isLoadingWeather,
  error,
  onUpdateDay,
  onResetDay,
  onLocationLookup,
  onCurrentLocation
}: {
  day: WeeklyPlanDay;
  weatherLabel: string;
  weatherPresentation: ReturnType<typeof getWeatherPresentation>;
  isLoadingWeather: boolean;
  error: string | null;
  onUpdateDay: (
    updates: Partial<WeeklyPlanDay> | ((day: WeeklyPlanDay) => Partial<WeeklyPlanDay>)
  ) => void;
  onResetDay: () => void;
  onLocationLookup: () => void;
  onCurrentLocation: () => void;
}) {
  const WeatherIcon = weatherPresentation.icon;

  return (
    <div className="pw-panel-soft p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <div>
            <p className="text-3xl font-semibold tracking-[-0.07em]">{day.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <span>{day.dateLabel}</span>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${weatherPresentation.chipClassName}`}
              >
                <WeatherIcon className={`h-4 w-4 ${weatherPresentation.iconClassName}`} />
                <span>{weatherLabel}</span>
              </span>
              {weatherPresentation.sourceLabel ? (
                <span className="rounded-full border border-[rgba(17,17,17,0.08)] bg-[rgba(255,255,255,0.92)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                  {weatherPresentation.sourceLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onResetDay}
          className="text-sm text-[var(--muted)] underline-offset-4 transition hover:text-[var(--foreground)] hover:underline"
        >
          Reset Day
        </button>
      </div>

      <div className="mt-3">
        <PlanningContextEditor
          day={day}
          weatherLabel={weatherLabel}
          weatherPresentation={weatherPresentation}
          isLoadingWeather={isLoadingWeather}
          onUpdateDay={onUpdateDay}
          onLocationLookup={onLocationLookup}
          onCurrentLocation={onCurrentLocation}
        />
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function PlanningContextEditor({
  day,
  weatherLabel,
  weatherPresentation,
  isLoadingWeather,
  onUpdateDay,
  onLocationLookup,
  onCurrentLocation
}: {
  day: WeeklyPlanDay;
  weatherLabel: string;
  weatherPresentation: ReturnType<typeof getWeatherPresentation>;
  isLoadingWeather: boolean;
  onUpdateDay: (
    updates: Partial<WeeklyPlanDay> | ((day: WeeklyPlanDay) => Partial<WeeklyPlanDay>)
  ) => void;
  onLocationLookup: () => void;
  onCurrentLocation: () => void;
}) {
  const parsedOccasion = parseOccasion(day.occasion);
  const WeatherIcon = weatherPresentation.icon;
  const secondaryOptions = primaryEventOptions.filter(
    (option) => option.key !== "custom" && option.label !== parsedOccasion.primaryLabel
  );

  function setPrimaryEvent(key: (typeof primaryEventOptions)[number]["key"]) {
    if (key === "custom") {
      onUpdateDay({
        occasion: formatOccasionText("Custom", parsedOccasion.secondaryLabels)
      });
      return;
    }

    onUpdateDay({
      occasion: formatOccasionText(
        getPrimaryEventLabel(key),
        parsedOccasion.secondaryLabels.filter((label) => label !== getPrimaryEventLabel(key))
      )
    });
  }

  function setCustomPrimary(value: string) {
    onUpdateDay({
      occasion: formatOccasionText(value, parsedOccasion.secondaryLabels)
    });
  }

  function toggleSecondary(label: string) {
    const isSelected = parsedOccasion.secondaryLabels.includes(label);
    const nextSecondaryLabels = isSelected
      ? parsedOccasion.secondaryLabels.filter((item) => item !== label)
      : [...parsedOccasion.secondaryLabels, label];

    onUpdateDay({
      occasion: formatOccasionText(parsedOccasion.primaryText, nextSecondaryLabels)
    });
  }

  function removeSecondary(label: string) {
    onUpdateDay({
      occasion: formatOccasionText(
        parsedOccasion.primaryText,
        parsedOccasion.secondaryLabels.filter((item) => item !== label)
      )
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {primaryEventOptions.map((option) => {
                const isSelected =
                  option.key === "custom"
                    ? parsedOccasion.isCustomPrimary
                    : parsedOccasion.primaryLabel === option.label;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPrimaryEvent(option.key)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium tracking-[-0.01em] shadow-[0_10px_24px_rgba(17,17,17,0.04)] transition ${
                      isSelected
                        ? "border-[rgba(17,17,17,0.92)] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(33,33,33,0.96))] text-white shadow-[0_14px_30px_rgba(17,17,17,0.16)]"
                        : "border-[rgba(17,17,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,238,0.9))] text-[var(--foreground)] hover:border-[rgba(17,17,17,0.18)] hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {parsedOccasion.isCustomPrimary ? (
              <input
                value={parsedOccasion.primaryText === "Custom" ? "" : parsedOccasion.primaryText}
                onChange={(event) => setCustomPrimary(event.target.value)}
                placeholder="Add your own occasion"
                className="w-full rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition"
              />
            ) : null}
          </div>

          <details className="group rounded-[12px] border border-[rgba(17,17,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,245,240,0.76))] px-4 py-3 shadow-[0_12px_28px_rgba(17,17,17,0.04)]">
            <summary className="cursor-pointer list-none text-sm font-medium text-[var(--muted)] transition group-open:text-[var(--foreground)]">
              Add another occasion
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {secondaryOptions.map((option) => {
                const isSelected = parsedOccasion.secondaryLabels.includes(option.label);

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleSecondary(option.label)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium tracking-[-0.01em] transition ${
                      isSelected
                        ? "border-[rgba(17,17,17,0.16)] bg-[rgba(17,17,17,0.08)] text-[var(--foreground)] shadow-[inset_0_0_0_1px_rgba(17,17,17,0.03)]"
                        : "border-[rgba(17,17,17,0.08)] bg-white text-[var(--foreground)] hover:border-[rgba(17,17,17,0.18)] hover:bg-[rgba(255,255,255,0.98)]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </details>

          {parsedOccasion.secondaryLabels.length ? (
            <div className="flex flex-wrap gap-2">
              {parsedOccasion.secondaryLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => removeSecondary(label)}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(17,17,17,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,242,237,0.92))] px-3 py-1.5 text-xs font-medium tracking-[0.01em] text-[var(--foreground)] shadow-[0_8px_20px_rgba(17,17,17,0.04)] transition hover:border-[rgba(17,17,17,0.18)] hover:bg-white"
                >
                  <span>{label}</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[rgba(17,17,17,0.08)] text-[10px]"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="w-full lg:max-w-[180px]">
          <span className="mb-2 block text-sm font-medium">Vibe</span>
          <select
            value={day.dressCode}
            onChange={(event) => onUpdateDay({ dressCode: event.target.value })}
            className="w-full rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
          >
            {dressCodeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${weatherPresentation.chipClassName}`}
            >
              <WeatherIcon className={`h-4 w-4 ${weatherPresentation.iconClassName}`} />
            </span>
            <span>{weatherLabel}</span>
          </div>

          <div className="inline-flex rounded-full border border-[var(--line)] bg-white p-1">
            <button
              type="button"
              onClick={() => onUpdateDay({ weatherMode: "auto" })}
              className={`rounded-full px-4 py-2 text-sm transition ${
                day.weatherMode === "auto"
                  ? "bg-[#111111] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateDay((currentDay) => ({
                  weatherMode: "manual",
                  weatherContext:
                    currentDay.weatherMode === "auto" ? currentDay.weatherContext : null
                }))
              }
              className={`rounded-full px-4 py-2 text-sm transition ${
                day.weatherMode === "manual"
                  ? "bg-[#111111] text-white"
                  : "text-[var(--muted)]"
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        <div className="mt-3 transition-all duration-200 ease-out">
          {day.weatherMode === "manual" ? (
            <select
              value={day.manualWeatherProfile}
              onChange={(event) =>
                onUpdateDay({
                  manualWeatherProfile: event.target.value as WeatherProfile
                })
              }
              className="w-full rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
            >
              {weatherProfiles.map((profile) => (
                <option key={profile} value={profile}>
                  {weatherProfileLabels[profile]}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={day.locationQuery}
                onChange={(event) => onUpdateDay({ locationQuery: event.target.value })}
                placeholder="Adelaide, Sydney, Melbourne..."
                disabled={isLoadingWeather}
                className="flex-1 rounded-[10px] border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={onLocationLookup}
                disabled={isLoadingWeather}
                className="pw-button-primary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingWeather ? "Loading..." : "Lookup"}
              </button>
              <button
                type="button"
                onClick={onCurrentLocation}
                disabled={isLoadingWeather}
                className="pw-button-secondary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Current
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DialogShell({
  children,
  onClose,
  size = "max-w-3xl"
}: {
  children: ReactNode;
  onClose: () => void;
  size?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/48 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center px-3 py-3 sm:px-4 sm:py-6">
        <div
          className={`w-full ${size} rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-[rgba(252,251,249,0.96)] p-4 shadow-[0_35px_90px_rgba(0,0,0,0.18)] sm:max-h-[calc(100vh-3rem)] sm:overflow-auto sm:p-6 md:p-8`}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function PlannerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--line)] pt-4">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-[-0.06em] md:text-2xl">{value}</p>
    </div>
  );
}

function createInitialWeek(
  preferredLocation: string | null = null,
  wardrobeItems: GarmentListItem[] = [],
  savedOutfits: OutfitWithItems[] = []
) {
  const today = new Date();
  const monday = startOfWeekMonday(today);
  const baseWeek = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    const label = new Intl.DateTimeFormat("en-AU", { weekday: "long" }).format(date);
    const shortLabel = new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(date);

    return {
      key: label.toLowerCase(),
      label,
      shortLabel,
      dateIso: toDateIso(date),
      dateLabel: new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short"
      }).format(date),
      occasion: "",
      dressCode: "any",
      weatherMode: "auto" as const,
      manualWeatherProfile: defaultWeatherProfileForDay(index),
      locationQuery: preferredLocation ?? "",
      weatherContext: null,
      generatedOutfit: null,
      savedOutfitId: null
    } satisfies WeeklyPlanDay;
  });

  return hydratePlannerWeekFromSavedOutfits(baseWeek, wardrobeItems, savedOutfits);
}

function defaultWeatherProfileForDay(index: number): WeatherProfile {
  if (index === 5 || index === 6) {
    return "warm_sun";
  }

  return "mild_clear";
}

function startOfWeekMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateIso(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatWeekRange(startIso?: string, endIso?: string) {
  if (!startIso || !endIso) {
    return "Current week";
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  const formatter = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short"
  });

  return `${formatter.format(start)} — ${formatter.format(end)}`;
}

function formatCalendarMonthLabel(days: WeeklyPlanDay[]) {
  const firstDay = days[0];

  if (!firstDay) {
    return "Calendar";
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric"
  }).format(new Date(firstDay.dateIso));
}

function formatDressCode(value: string) {
  if (!value || value === "any") {
    return "Any";
  }

  return value.replaceAll("_", " ");
}

function parseOccasion(occasion: string) {
  const parts = occasion
    .split(" + ")
    .map((part) => part.trim())
    .filter(Boolean);
  const primaryText = parts[0] ?? "";
  const primaryLabel = primaryEventOptions.find((option) => option.label === primaryText)?.label ?? "";

  return {
    primaryText,
    primaryLabel,
    isCustomPrimary: primaryText === "Custom" || (Boolean(primaryText) && !primaryLabel),
    secondaryLabels: parts.slice(1)
  };
}

function formatOccasionText(primaryText: string, secondaryLabels: string[]) {
  return [primaryText.trim(), ...secondaryLabels.map((label) => label.trim()).filter(Boolean)]
    .filter(Boolean)
    .join(" + ");
}

function getPrimaryEventLabel(key: (typeof primaryEventOptions)[number]["key"]) {
  return primaryEventOptions.find((option) => option.key === key)?.label ?? "";
}

function buildGeneratedOutfitFromGarments(garments: GarmentListItem[]): GeneratedOutfit {
  const outfitGarments = garments.flatMap((garment) => {
    if (!garment.id) {
      return [];
    }

    return [{
      id: garment.id,
      title: garment.title ?? null,
      category: garment.category,
      role: categoryToRole(garment.category, garment.subcategory, garment.title),
      preview_url: garment.preview_url ?? null
    }];
  });

  return {
    garments: outfitGarments,
    firedRules: [],
    insights: [],
    explanation: null
  };
}

function hydratePlannerWeekFromSavedOutfits(
  days: WeeklyPlanDay[],
  wardrobeItems: GarmentListItem[],
  savedOutfits: OutfitWithItems[]
) {
  const wardrobeById = new Map(
    wardrobeItems.flatMap((item) => (item.id ? [[item.id, item] as const] : []))
  );
  const latestSavedOutfitByDate = bucketOutfitsByDate(savedOutfits);

  return days.map((day) => {
    const savedOutfit = latestSavedOutfitByDate.get(day.dateIso);

    if (!savedOutfit) {
      return day;
    }

    const weatherContext = parseSavedWeatherContext(savedOutfit);

    return {
      ...day,
      occasion: savedOutfit.occasion ?? day.occasion,
      dressCode: savedOutfit.dress_code ?? day.dressCode,
      weatherMode: weatherContext ? "auto" : day.weatherMode,
      weatherContext: weatherContext ?? day.weatherContext,
      generatedOutfit: buildGeneratedOutfitFromSavedOutfit(savedOutfit, wardrobeById),
      savedOutfitId: savedOutfit.id
    };
  });
}

function parseSavedWeatherContext(outfit: OutfitWithItems): LocalWeatherContext | null {
  const parsed = outfit.weather_context_json
    ? localWeatherContextSchema.safeParse(outfit.weather_context_json)
    : null;

  return parsed?.success ? parsed.data : null;
}

function buildGeneratedOutfitFromSavedOutfit(
  outfit: OutfitWithItems,
  wardrobeById: Map<string, GarmentListItem>
): GeneratedOutfit {
  return {
    garments: outfit.items.map((item) => {
      const wardrobeGarment = wardrobeById.get(item.garment_id);

      return {
        id: item.garment_id,
        title: wardrobeGarment?.title ?? item.garment.title ?? null,
        category: wardrobeGarment?.category ?? item.garment.category,
        role: item.role,
        preview_url: wardrobeGarment?.preview_url ?? null
      };
    }),
    firedRules: parseSavedFiredRules(outfit),
    insights: parseSavedInsights(outfit),
    explanation: outfit.explanation ?? null
  };
}

function parseSavedFiredRules(outfit: OutfitWithItems) {
  const payload = outfit.explanation_json?.["rules"];
  const parsed = z.array(firedRuleSchema).safeParse(payload);
  return parsed.success ? parsed.data : [];
}

function parseSavedInsights(outfit: OutfitWithItems) {
  const payload = outfit.explanation_json?.["insights"];
  const parsed = z.array(outfitInsightSchema).safeParse(payload);
  return parsed.success ? parsed.data : [];
}

function buildWeatherPayload(day: WeeklyPlanDay) {
  if (day.weatherMode === "auto" && day.weatherContext) {
    return day.weatherContext;
  }

  return {
    profile: day.manualWeatherProfile,
    profile_label: weatherProfileLabels[day.manualWeatherProfile],
    profile_source: "manual_override"
  };
}

function buildOutfitTitle(day: WeeklyPlanDay) {
  const suffix = day.occasion.trim() || formatDressCode(day.dressCode);
  return suffix && suffix !== "Any"
    ? `${day.label} — ${suffix}`
    : `${day.label} planned outfit`;
}

function getWeatherPresentation(day: WeeklyPlanDay) {
  const profile =
    day.weatherMode === "auto" && day.weatherContext
      ? day.weatherContext.profile
      : day.manualWeatherProfile;
  const visuals = weatherVisuals[profile];

  return {
    icon: visuals.icon,
    iconClassName: visuals.iconClassName,
    chipClassName: visuals.chipClassName,
    label:
      day.weatherMode === "auto" && day.weatherContext
        ? day.weatherContext.profile_label
        : weatherProfileLabels[profile],
    temperatureLabel: formatWeatherTemperature(day),
    sourceLabel: getWeatherSourceLabel(day)
  };
}

function getWeatherSourceLabel(day: WeeklyPlanDay) {
  if (day.weatherMode !== "auto" || !day.weatherContext) {
    return null;
  }

  switch (day.weatherContext.profile_source) {
    case "live":
      return null;
    case "snapshot":
      return "Cached";
    case "historical_fallback":
      return "Estimate";
    case "manual_override":
      return "Manual";
    default:
      return null;
  }
}

function formatWeatherTemperature(day: WeeklyPlanDay) {
  if (day.weatherMode === "auto" && day.weatherContext) {
    const current = day.weatherContext.current_temperature_c;
    const high = day.weatherContext.temp_max_c;
    const low = day.weatherContext.temp_min_c;

    if (current != null) {
      return `${Math.round(current)}C`;
    }

    if (high != null && low != null) {
      return `${Math.round(low)}-${Math.round(high)}C`;
    }

    if (high != null) {
      return `${Math.round(high)}C`;
    }

    if (low != null) {
      return `${Math.round(low)}C`;
    }
  }

  switch (day.manualWeatherProfile) {
    case "warm_sun":
      return "28C";
    case "mild_clear":
      return "22C";
    case "cool_breeze":
      return "16C";
    case "cold_rain":
      return "11C";
    default:
      return "";
  }
}

function buildCalendarCells(days: WeeklyPlanDay[]) {
  const dayMap = new Map(days.map((day) => [day.dateIso, day]));
  const firstDay = days[0];

  if (!firstDay) {
    return [];
  }

  const monthStart = new Date(firstDay.dateIso);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);

  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const cells: Array<{ key: string; day: WeeklyPlanDay | null }> = [];
  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const iso = toDateIso(cursor);
    const isCurrentMonth = cursor.getMonth() === monthStart.getMonth();

    cells.push({
      key: iso,
      day: isCurrentMonth ? dayMap.get(iso) ?? null : null
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

function getDateNumber(dateIso: string) {
  return Number(dateIso.split("-")[2] ?? "0");
}
