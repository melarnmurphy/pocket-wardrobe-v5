"use client";

import { useMemo, useRef, useState, useTransition, type PointerEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Ruler,
  RotateCcw,
  Shirt,
  Sparkles
} from "lucide-react";
import type { AvatarMeasurementSet } from "@/lib/domain/avatar/service";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import {
  defaultAvatarTilePositions,
  normalizeAvatarLayout,
  type AvatarLayout,
  type AvatarTilePosition
} from "@/lib/domain/avatar";
import type { AvatarActionResult } from "@/app/wardrobe/avatar-actions";
import type { AvatarMeasurementActionResult } from "@/app/wardrobe/avatar-actions";

type AvatarSlot = "accessory" | "top" | "pants" | "shoes";

type DragState = {
  pointerId: number;
  startX: number;
  lastX: number;
};

const slotOrder: AvatarSlot[] = ["accessory", "top", "pants", "shoes"];

const slotLabels: Record<AvatarSlot, string> = {
  accessory: "Accessories",
  top: "Tops",
  pants: "Pants",
  shoes: "Shoes"
};

const slotDescriptions: Record<AvatarSlot, string> = {
  accessory: "Bags, jewellery, belts, hats, and finishing pieces.",
  top: "Shirts, knitwear, tanks, tees, blouses, and jackets.",
  pants: "Pants, denim, skirts, shorts, and dresses.",
  shoes: "Shoes, boots, sneakers, heels, and sandals."
};

export function AvatarStyler({
  garments,
  initialAvatarUrl,
  initialLayout,
  initialMeasurementSet,
  uploadAvatarPhotoAction,
  generateAvatarPhotoAction,
  saveAvatarLayoutAction,
  saveAvatarMeasurementsAction
}: {
  garments: GarmentListItem[];
  initialAvatarUrl: string | null;
  initialLayout: AvatarLayout | null;
  initialMeasurementSet: AvatarMeasurementSet | null;
  uploadAvatarPhotoAction: (formData: FormData) => Promise<AvatarActionResult>;
  generateAvatarPhotoAction: (formData: FormData) => Promise<AvatarActionResult>;
  saveAvatarLayoutAction: (formData: FormData) => Promise<AvatarActionResult>;
  saveAvatarMeasurementsAction: (formData: FormData) => Promise<AvatarMeasurementActionResult>;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [layout, setLayout] = useState<AvatarLayout>(() => normalizeAvatarLayout(initialLayout));
  const [measurementSet, setMeasurementSet] = useState<AvatarMeasurementSet | null>(
    initialMeasurementSet
  );
  const [activeSlot, setActiveSlot] = useState<AvatarSlot>("top");
  const [selectedIndexes, setSelectedIndexes] = useState<Record<AvatarSlot, number>>({
    accessory: 0,
    top: 0,
    pants: 0,
    shoes: 0
  });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  const garmentsBySlot = useMemo(() => groupGarmentsBySlot(garments), [garments]);
  const activeItems = garmentsBySlot[activeSlot];
  const hasAvatar = Boolean(avatarUrl);
  const selectedLook = useMemo(
    () =>
      Object.fromEntries(
        slotOrder.map((slot) => {
          const items = garmentsBySlot[slot];
          return [slot, items[selectedIndexes[slot] % Math.max(items.length, 1)] ?? null];
        })
      ) as Record<AvatarSlot, GarmentListItem | null>,
    [garmentsBySlot, selectedIndexes]
  );

  function updateSelectedIndex(slot: AvatarSlot, direction: 1 | -1) {
    const itemCount = garmentsBySlot[slot].length;

    if (!itemCount) {
      return;
    }

    setSelectedIndexes((current) => ({
      ...current,
      [slot]: (current[slot] + direction + itemCount) % itemCount
    }));
  }

  function handleAvatarUpload(file: File | null) {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("avatar", file);
    setMessage("Saving avatar photo...");

    startTransition(async () => {
      const result = await uploadAvatarPhotoAction(formData);

      if (result.status === "success") {
        setAvatarUrl(result.avatarUrl);
        setLayout(normalizeAvatarLayout(result.layout));
      }

      setMessage(result.message);
    });
  }

  function handleReferenceUpload(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []).filter((file) => file.size > 0);

    if (!selectedFiles.length) {
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("references", file));
    setMessage("Generating digital twin avatar...");

    startTransition(async () => {
      const result = await generateAvatarPhotoAction(formData);

      if (result.status === "success") {
        setAvatarUrl(result.avatarUrl);
        setLayout(normalizeAvatarLayout(result.layout));
      }

      setMessage(result.message);
    });
  }

  function saveLayout() {
    const formData = new FormData();
    formData.set("layout_json", JSON.stringify(layout));
    setMessage("Saving avatar layout...");

    startTransition(async () => {
      const result = await saveAvatarLayoutAction(formData);

      if (result.status === "success") {
        setAvatarUrl(result.avatarUrl);
        setLayout(normalizeAvatarLayout(result.layout));
      }

      setMessage(result.message);
    });
  }

  function saveMeasurements(formData: FormData) {
    setMessage("Saving avatar measurements...");

    startTransition(async () => {
      const result = await saveAvatarMeasurementsAction(formData);

      if (result.status === "success") {
        setMeasurementSet(result.measurement);
      }

      setMessage(result.message);
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!hasAvatar) {
      return;
    }

    setDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setDragState({ ...dragState, lastX: event.clientX });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;

    if (Math.abs(deltaX) > 42) {
      updateSelectedIndex(activeSlot, deltaX < 0 ? 1 : -1);
    }

    setDragState(null);
  }

  const activeGarment = selectedLook[activeSlot];
  const activePosition = getGarmentPosition(layout, activeSlot, activeGarment);

  function updateActivePosition(updates: Partial<AvatarTilePosition>) {
    if (!activeGarment?.id) {
      return;
    }

    setLayout((currentLayout) =>
      setGarmentPosition(currentLayout, activeSlot, activeGarment.id as string, {
        ...getGarmentPosition(currentLayout, activeSlot, activeGarment),
        ...updates
      })
    );
  }

  return (
    <section className="space-y-5">
      <div className="pw-page-head gap-4">
        <div className="space-y-3">
          <p className="pw-kicker">Avatar Mode</p>
          <h1 className="pw-page-title max-w-[10ch]">Swipe your closet onto you.</h1>
          <div className="pw-meta-row">
            <span>{garments.length} wardrobe items</span>
            <span className="divider">/</span>
            <span>{slotOrder.reduce((total, slot) => total + garmentsBySlot[slot].length, 0)} swipable</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="pw-button-primary w-full self-start sm:w-auto"
        >
          <ImagePlus className="h-4 w-4" />
          Avatar Photo
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="overflow-hidden rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-white shadow-[0_24px_70px_rgba(17,17,17,0.08)]">
          <div
            className="relative flex min-h-[36rem] touch-pan-y select-none items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#fbfaf7,#eee8dd)]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDragState(null)}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Static avatar reference"
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="flex max-w-md flex-col items-center px-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_18px_38px_rgba(17,17,17,0.08)]">
                  <Shirt className="h-7 w-7 text-[var(--muted)]" />
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-[-0.04em]">
                  Add a static photo to start styling.
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  The photo is stored privately in your avatar profile while your wardrobe items
                  come from your saved garment records.
                </p>
                <div className="mt-5 rounded-[8px] border border-white/80 bg-white/82 px-4 py-3 text-left shadow-[0_14px_34px_rgba(17,17,17,0.08)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Best Avatar Photo
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                    Use a clear full-body, front-facing photo with a plain background, good
                    lighting, and head-to-feet framing. A simple base outfit works best.
                  </p>
                </div>
                <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => referenceInputRef.current?.click()}
                    disabled={isPending}
                    className="pw-button-primary px-4 py-2 text-sm disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Avatar
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isPending}
                    className="pw-button-quiet px-4 py-2 text-sm disabled:opacity-60"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Upload Photo
                  </button>
                </div>
              </div>
            )}

            {hasAvatar ? (
              <>
                <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-wrap gap-2">
                  {slotOrder.map((slot) => {
                    const garment = selectedLook[slot];

                    return (
                      <span
                        key={slot}
                        className="rounded-full border border-white/70 bg-white/88 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground)] shadow-sm backdrop-blur"
                      >
                        {slotLabels[slot]}: {garment ? displayGarmentName(garment) : "empty"}
                      </span>
                    );
                  })}
                </div>

                <div className="pointer-events-none absolute inset-0 hidden sm:block">
                  <SelectedGarmentTile
                    slot="accessory"
                    garment={selectedLook.accessory}
                    position={getGarmentPosition(layout, "accessory", selectedLook.accessory)}
                  />
                  <SelectedGarmentTile
                    slot="top"
                    garment={selectedLook.top}
                    position={getGarmentPosition(layout, "top", selectedLook.top)}
                  />
                  <SelectedGarmentTile
                    slot="pants"
                    garment={selectedLook.pants}
                    position={getGarmentPosition(layout, "pants", selectedLook.pants)}
                  />
                  <SelectedGarmentTile
                    slot="shoes"
                    garment={selectedLook.shoes}
                    position={getGarmentPosition(layout, "shoes", selectedLook.shoes)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => updateSelectedIndex(activeSlot, -1)}
                  className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[var(--foreground)] shadow-[0_12px_30px_rgba(17,17,17,0.12)] transition hover:-translate-x-0.5 disabled:opacity-40"
                  disabled={!activeItems.length}
                  aria-label={`Previous ${slotLabels[activeSlot].toLowerCase()}`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSelectedIndex(activeSlot, 1)}
                  className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[var(--foreground)] shadow-[0_12px_30px_rgba(17,17,17,0.12)] transition hover:translate-x-0.5 disabled:opacity-40"
                  disabled={!activeItems.length}
                  aria-label={`Next ${slotLabels[activeSlot].toLowerCase()}`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute inset-x-4 bottom-4 rounded-[8px] border border-white/70 bg-white/92 p-3 shadow-[0_18px_44px_rgba(17,17,17,0.12)] backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                        Swiping {slotLabels[activeSlot]}
                      </p>
                      <p className="mt-1 line-clamp-1 text-base font-semibold tracking-[-0.03em]">
                        {selectedLook[activeSlot]
                          ? displayGarmentName(selectedLook[activeSlot])
                          : `No ${slotLabels[activeSlot].toLowerCase()} yet`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIndexes({ accessory: 0, top: 0, pants: 0, shoes: 0 })
                      }
                      className="pw-button-quiet px-3 py-2 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={isPending}
            onChange={(event) => handleAvatarUpload(event.target.files?.[0] ?? null)}
          />
          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={isPending}
            onChange={(event) => handleReferenceUpload(event.target.files)}
          />
        </div>

        <aside className="space-y-4">
          <AvatarMeasurementsPanel
            measurementSet={measurementSet}
            action={saveMeasurements}
            disabled={isPending}
          />

          <div className="rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-white/92 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                  Digital Twin
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Upload 2-5 consented reference photos to generate a front-facing styling avatar
                  in a simple black base outfit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => referenceInputRef.current?.click()}
                disabled={isPending}
                className="pw-button-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </div>
            {!hasAvatar && message ? (
              <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-[rgba(17,17,17,0.03)] px-3 py-2 text-sm text-[var(--muted)]">
                {message}
              </p>
            ) : null}
          </div>

          {hasAvatar ? (
            <>
              <div className="rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-white/92 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      Swipe Slot
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Pick a slot, then swipe left or right on the avatar canvas to cycle saved
                      items.
                    </p>
                  </div>
                  <Sparkles className="mt-1 h-5 w-5 text-[var(--muted)]" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {slotOrder.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setActiveSlot(slot)}
                      className={`rounded-[8px] border px-3 py-3 text-left transition ${
                        activeSlot === slot
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-white"
                          : "border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{slotLabels[slot]}</span>
                      <span
                        className={`mt-1 block text-xs ${
                          activeSlot === slot ? "text-white/70" : "text-[var(--muted)]"
                        }`}
                      >
                        {garmentsBySlot[slot].length} items
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-white/92 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                      Placement
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Adjust the selected garment tile, then save the layout for this avatar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={saveLayout}
                    disabled={isPending}
                    className="pw-button-primary px-4 py-2 text-sm disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  <PlacementSlider
                    label="X"
                    value={activePosition.x}
                    min={0}
                    max={100}
                    disabled={!activeGarment}
                    onChange={(x) => updateActivePosition({ x })}
                  />
                  <PlacementSlider
                    label="Y"
                    value={activePosition.y}
                    min={0}
                    max={100}
                    disabled={!activeGarment}
                    onChange={(y) => updateActivePosition({ y })}
                  />
                  <PlacementSlider
                    label="Scale"
                    value={activePosition.scale}
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    disabled={!activeGarment}
                    onChange={(scale) => updateActivePosition({ scale })}
                  />
                </div>
                {message ? (
                  <p className="mt-4 rounded-[8px] border border-[var(--line)] bg-[rgba(17,17,17,0.03)] px-3 py-2 text-sm text-[var(--muted)]">
                    {message}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {hasAvatar ? (
          <div className="rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-white/92 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)]">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {slotLabels[activeSlot]}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {slotDescriptions[activeSlot]}
            </p>
            <div className="mt-4 grid gap-3">
              {activeItems.length ? (
                activeItems.slice(0, 8).map((garment, index) => {
                  const isSelected = selectedIndexes[activeSlot] % activeItems.length === index;

                  return (
                    <button
                      key={garment.id}
                      type="button"
                      onClick={() =>
                        setSelectedIndexes((current) => ({ ...current, [activeSlot]: index }))
                      }
                      className={`flex items-center gap-3 rounded-[8px] border p-2 text-left transition ${
                        isSelected
                          ? "border-[var(--foreground)] bg-[rgba(17,17,17,0.04)]"
                          : "border-[var(--line)] bg-white hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-[6px] bg-[rgba(17,17,17,0.04)]">
                        {garment.preview_url ? (
                          <img
                            src={garment.preview_url}
                            alt={displayGarmentName(garment)}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold">
                          {displayGarmentName(garment)}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                          {[garment.brand, garment.category].filter(Boolean).join(" / ")}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.7)] px-4 py-6 text-sm text-[var(--muted)]">
                  Add wardrobe items in this category to make this slot swipable.
                </div>
              )}
            </div>
          </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function AvatarMeasurementsPanel({
  measurementSet,
  action,
  disabled
}: {
  measurementSet: AvatarMeasurementSet | null;
  action: (formData: FormData) => void;
  disabled: boolean;
}) {
  const system = measurementSet?.measurement_system ?? "metric";
  const unit = system === "imperial" ? "in" : "cm";
  const fitPriorities = getShapeStringArray(measurementSet, "fit_priorities").join(", ");

  return (
    <form
      action={action}
      className="rounded-[10px] border border-[rgba(17,17,17,0.08)] bg-white/92 p-4 shadow-[0_18px_45px_rgba(17,17,17,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
            Measurements
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Body dimensions, shape, and skin tone for future fit-aware styling.
          </p>
        </div>
        <Ruler className="mt-1 h-5 w-5 text-[var(--muted)]" />
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Units
          </span>
          <select
            name="measurement_system"
            defaultValue={system}
            className="rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            <option value="metric">Metric</option>
            <option value="imperial">Imperial</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <MeasurementInput label="Height" name="height" unit={unit} value={getMeasurementValue(measurementSet, "height")} />
          <MeasurementInput label="Shoulder" name="shoulder_width" unit={unit} value={getMeasurementValue(measurementSet, "shoulder_width")} />
          <MeasurementInput label="Chest" name="chest" unit={unit} value={getMeasurementValue(measurementSet, "chest")} />
          <MeasurementInput label="Bust" name="bust" unit={unit} value={getMeasurementValue(measurementSet, "bust")} />
          <MeasurementInput label="Waist" name="waist" unit={unit} value={getMeasurementValue(measurementSet, "waist")} />
          <MeasurementInput label="Hip" name="hip" unit={unit} value={getMeasurementValue(measurementSet, "hip")} />
          <MeasurementInput label="Inseam" name="inseam" unit={unit} value={getMeasurementValue(measurementSet, "inseam")} />
          <MeasurementInput label="Arm" name="arm_length" unit={unit} value={getMeasurementValue(measurementSet, "arm_length")} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Skin Tone
            </span>
            <input
              name="skin_tone_hex"
              type="text"
              placeholder="#c6865c"
              defaultValue={getSkinToneHex(measurementSet)}
              className="rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Tone
            </span>
            <select
              name="skin_undertone"
              defaultValue={getSkinToneUndertone(measurementSet)}
              className="rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-sm"
            >
              <option value="">-</option>
              <option value="warm">Warm</option>
              <option value="cool">Cool</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Shape Profile
          </span>
          <input
            name="silhouette"
            type="text"
            defaultValue={getShapeString(measurementSet, "silhouette")}
            className="rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Fit Priorities
          </span>
          <input
            name="fit_priorities"
            type="text"
            defaultValue={fitPriorities}
            className="rounded-[8px] border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={disabled}
          className="pw-button-primary mt-1 w-full justify-center px-4 py-2 text-sm disabled:opacity-60"
        >
          Save Measurements
        </button>
      </div>
    </form>
  );
}

function MeasurementInput({
  label,
  name,
  unit,
  value
}: {
  label: string;
  name: string;
  unit: string;
  value: number | null;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-[8px] border border-[var(--line)] bg-white">
        <input
          name={name}
          type="number"
          min="0"
          step="0.1"
          defaultValue={value ?? ""}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
        />
        <span className="flex items-center border-l border-[var(--line)] px-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {unit}
        </span>
      </div>
    </label>
  );
}

function groupGarmentsBySlot(garments: GarmentListItem[]) {
  const grouped: Record<AvatarSlot, GarmentListItem[]> = {
    accessory: [],
    top: [],
    pants: [],
    shoes: []
  };

  for (const garment of garments) {
    const slot = inferAvatarSlot(garment);

    if (slot) {
      grouped[slot].push(garment);
    }
  }

  return grouped;
}

function inferAvatarSlot(garment: GarmentListItem): AvatarSlot | null {
  const text = [garment.category, garment.subcategory, garment.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|sandal|sandals|loafer|loafers)\b/.test(text)) {
    return "shoes";
  }

  if (/\b(pant|pants|jean|jeans|trouser|trousers|skirt|short|shorts|bottom|bottoms|denim|dress)\b/.test(text)) {
    return "pants";
  }

  if (/\b(bag|bags|belt|belts|jewellery|jewelry|necklace|bracelet|earring|earrings|hat|scarf|sunglasses|accessory|accessories)\b/.test(text)) {
    return "accessory";
  }

  if (/\b(top|tops|shirt|shirts|tee|t-shirt|tank|blouse|knit|knitwear|sweater|cardigan|jacket|blazer|coat|outerwear|hoodie|bodysuit|vest)\b/.test(text)) {
    return "top";
  }

  return null;
}

function displayGarmentName(garment: GarmentListItem | null) {
  if (!garment) {
    return "";
  }

  return garment.title || garment.subcategory || garment.category || "Wardrobe item";
}

function getMeasurementValue(measurementSet: AvatarMeasurementSet | null, key: string) {
  const entry = getRecordValue(measurementSet?.body_measurements_json, key);
  const value = getRecordValue(entry, "value");
  return typeof value === "number" ? value : null;
}

function getSkinToneHex(measurementSet: AvatarMeasurementSet | null) {
  const value = getRecordValue(measurementSet?.skin_tone_json, "hex");
  return typeof value === "string" ? value : "";
}

function getSkinToneUndertone(measurementSet: AvatarMeasurementSet | null) {
  const value = getRecordValue(measurementSet?.skin_tone_json, "undertone");
  return typeof value === "string" ? value : "";
}

function getShapeString(measurementSet: AvatarMeasurementSet | null, key: string) {
  const value = getRecordValue(measurementSet?.shape_profile_json, key);
  return typeof value === "string" ? value : "";
}

function getShapeStringArray(measurementSet: AvatarMeasurementSet | null, key: string) {
  const value = getRecordValue(measurementSet?.shape_profile_json, key);
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function getRecordValue(input: unknown, key: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  return (input as Record<string, unknown>)[key];
}

function SelectedGarmentTile({
  slot,
  garment,
  position
}: {
  slot: AvatarSlot;
  garment: GarmentListItem | null;
  position: AvatarTilePosition;
}) {
  if (!garment) {
    return null;
  }

  return (
    <div
      className="absolute w-32 overflow-hidden rounded-[8px] border border-white/80 bg-white/92 shadow-[0_18px_44px_rgba(17,17,17,0.16)] backdrop-blur"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -50%) scale(${position.scale})`,
        transformOrigin: "center"
      }}
    >
      <div className="aspect-[4/5] bg-[rgba(17,17,17,0.04)]">
        {garment.preview_url ? (
          <img
            src={garment.preview_url}
            alt={displayGarmentName(garment)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            No image
          </div>
        )}
      </div>
      <div className="border-t border-[var(--line)] px-2.5 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {slotLabels[slot]}
        </p>
        <p className="mt-1 line-clamp-1 text-xs font-semibold">{displayGarmentName(garment)}</p>
      </div>
    </div>
  );
}

function PlacementSlider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
        <span>{value.toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--foreground)] disabled:opacity-40"
      />
    </label>
  );
}

function getGarmentPosition(
  layout: AvatarLayout,
  slot: AvatarSlot,
  garment: GarmentListItem | null
) {
  if (!garment?.id) {
    return defaultAvatarTilePositions[slot];
  }

  return layout.garment_positions[slot]?.[garment.id as string] ?? defaultAvatarTilePositions[slot];
}

function setGarmentPosition(
  layout: AvatarLayout,
  slot: AvatarSlot,
  garmentId: string,
  position: AvatarTilePosition
): AvatarLayout {
  return normalizeAvatarLayout({
    ...layout,
    garment_positions: {
      ...layout.garment_positions,
      [slot]: {
        ...(layout.garment_positions[slot] ?? {}),
        [garmentId]: position
      }
    }
  });
}
