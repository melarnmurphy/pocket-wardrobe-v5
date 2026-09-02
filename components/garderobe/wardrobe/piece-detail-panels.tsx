"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { PillButton } from "@/components/garderobe/pill-button";
import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";
import { DisposalSheet } from "./disposal-sheet";
import { RecutSheet } from "./recut-sheet";
import { WearCorrectionSheet } from "./wear-correction-sheet";
import { PickerSheet } from "./picker-sheet";
import { MergeDialog } from "./merge-dialog";

type ActionFn = (state: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>;

// This file is the piece-detail page's client island: the page itself is a
// server component (see app/wardrobe/[id]/page.tsx), so anything here that
// needs to open/close a sheet — recutting the photo, disposing of a piece
// with a reason, or correcting a logged wear — is composed the same way
// ArchiveControl already is: a small "use client" wrapper that owns its own
// open state and receives the server actions as props.

type RecutControlProps = {
  garmentId: string;
  addImageAction: ActionFn;
};

/** 18d / w6c — trigger for RecutSheet: "recut the photo". */
export function RecutControl({ garmentId, addImageAction }: RecutControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12.5px] text-[var(--oxblood)] underline"
      >
        recut the photo
      </button>
      <RecutSheet
        open={open}
        garmentId={garmentId}
        onClose={() => setOpen(false)}
        addImageAction={addImageAction}
      />
    </>
  );
}

type DisposalControlProps = {
  garmentId: string;
  pieceName: string;
  archiveAction: ActionFn;
  undoAction: (garmentId: string) => Promise<void>;
};

/**
 * 18a / w6c — trigger for DisposalSheet: "let it go", capturing a reason
 * before archiving. Replaces the plain ArchiveControl submit button on the
 * piece-detail page so the "what happened to it?" reason is recorded.
 */
export function DisposalControl({ garmentId, pieceName, archiveAction, undoAction }: DisposalControlProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PillButton type="button" variant="secondary" onClick={() => setOpen(true)}>
        let it go
      </PillButton>
      <DisposalSheet
        open={open}
        garmentId={garmentId}
        onClose={() => setOpen(false)}
        archiveAction={archiveAction}
        pieceName={pieceName}
        undoAction={undoAction}
      />
    </>
  );
}

type WearHistoryEvent = {
  id: string;
  worn_at: string;
  occasion?: string | null;
};

type WearHistorySectionProps = {
  wearEvents: WearHistoryEvent[];
  updateAction: ActionFn;
  deleteAction: ActionFn;
};

/** 18a / w6b — recent wears, each opening WearCorrectionSheet to fix or remove it. */
export function WearHistorySection({ wearEvents, updateAction, deleteAction }: WearHistorySectionProps) {
  const [selected, setSelected] = useState<WearHistoryEvent | null>(null);

  if (!wearEvents.length) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {wearEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => setSelected(event)}
            className="flex items-center justify-between rounded-[4px] border border-[rgba(30,26,23,.14)] px-3 py-2 text-left text-[12.5px] text-[var(--ink)]"
          >
            <span>{new Date(event.worn_at).toLocaleDateString("en-AU")}</span>
            <span className="text-[var(--stone)]">{event.occasion ?? "—"}</span>
          </button>
        ))}
      </div>
      {selected ? (
        <WearCorrectionSheet
          open={Boolean(selected)}
          wearEventId={selected.id}
          wornAt={selected.worn_at}
          occasion={selected.occasion ?? null}
          onClose={() => setSelected(null)}
          updateAction={updateAction}
          deleteAction={deleteAction}
        />
      ) : null}
    </>
  );
}

// `updateGarmentAction` replaces the whole garment row (see
// `updateGarmentFormSchema` in app/wardrobe/actions.ts, which extends the
// full `createGarmentFormSchema`), so any single-field edit — category,
// colour, material — has to resend every field the page already knows about.
// This snapshot carries exactly those fields through from the server page.
export type GarmentFieldSnapshot = {
  garment_id: string;
  title: string | null;
  brand: string | null;
  category: string;
  subcategory: string | null;
  material: string | null;
  size: string | null;
  fit: string | null;
  formality_level: string | null;
  purchase_currency: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  retailer: string | null;
  primary_colour_family: string | null;
  seasonality: string[];
};

type FieldPickerControlProps = {
  label: string;
  field: "category" | "material" | "primary_colour_family";
  value: string | null;
  options: string[];
  snapshot: GarmentFieldSnapshot;
  updateAction: ActionFn;
};

const idlePickerState: WardrobeActionState = { status: "idle", message: null };

/** 18d / w6c — trigger for PickerSheet: category, colour, and fabric all follow this pattern. */
export function FieldPickerControl({
  label,
  field,
  value,
  options,
  snapshot,
  updateAction
}: FieldPickerControlProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateAction, idlePickerState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-left">
        <span className="block text-[9px] uppercase tracking-[.18em] text-[var(--stone)]">{label}</span>
        <span className="text-[12.5px] text-[var(--oxblood)] underline">{value ?? "add"}</span>
      </button>
      <PickerSheet
        open={open}
        title={label}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onSelect={(next) => {
          const formData = new FormData();
          formData.set("garment_id", snapshot.garment_id);
          formData.set("title", snapshot.title ?? "");
          formData.set("brand", snapshot.brand ?? "");
          formData.set("category", field === "category" ? next : snapshot.category);
          formData.set("subcategory", snapshot.subcategory ?? "");
          formData.set("material", field === "material" ? next : snapshot.material ?? "");
          formData.set("size", snapshot.size ?? "");
          formData.set("fit", snapshot.fit ?? "");
          formData.set("formality_level", snapshot.formality_level ?? "");
          formData.set("purchase_currency", snapshot.purchase_currency ?? "");
          formData.set(
            "purchase_price",
            snapshot.purchase_price !== null ? String(snapshot.purchase_price) : ""
          );
          formData.set("purchase_date", snapshot.purchase_date ?? "");
          formData.set("retailer", snapshot.retailer ?? "");
          formData.set(
            "primary_colour_family",
            field === "primary_colour_family" ? next : snapshot.primary_colour_family ?? ""
          );
          snapshot.seasonality.forEach((season) => formData.append("seasonality", season));
          formAction(formData);
        }}
      />
      {state.status === "error" ? (
        <p className="pt-1 text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </>
  );
}

type MergeTarget = { id: string; title: string };

type MergeControlProps = {
  sourceGarmentId: string;
  sourceTitle: string;
  targets: MergeTarget[];
  mergeAction: ActionFn;
};

const idleMergeState: WardrobeActionState = { status: "idle", message: null };

/**
 * 18a / w6c — minimal "merge these two" entry point: pick another one of the
 * user's own pieces as the merge target, confirm with MergeDialog, then
 * submit mergeGarmentsAction. There's no duplicate-detection UI on this page
 * to hook into, so this is the smallest reasonable trigger rather than a
 * search/autocomplete flow.
 */
export function MergeControl({ sourceGarmentId, sourceTitle, targets, mergeAction }: MergeControlProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [target, setTarget] = useState<MergeTarget | null>(null);
  const [state, formAction] = useActionState(mergeAction, idleMergeState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    setTarget(null);
    if (state.garmentId) {
      router.push(`/wardrobe/${state.garmentId}`);
    } else {
      router.refresh();
    }
  }, [state.status, state.garmentId, router]);

  if (!targets.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="text-[12.5px] text-[var(--oxblood)] underline"
      >
        merge with another piece
      </button>

      <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="merge into which piece?">
        <div>
          {targets.map((option, index) => (
            <SheetAction
              key={option.id}
              last={index === targets.length - 1}
              onClick={() => {
                setPickerOpen(false);
                setTarget(option);
              }}
            >
              {option.title}
            </SheetAction>
          ))}
        </div>
      </BottomSheet>

      <MergeDialog
        open={Boolean(target)}
        sourceTitle={sourceTitle}
        targetTitle={target?.title ?? ""}
        onClose={() => setTarget(null)}
        onConfirm={() => {
          if (!target) return;
          const formData = new FormData();
          formData.set("source_garment_id", sourceGarmentId);
          formData.set("target_garment_id", target.id);
          formAction(formData);
        }}
      />

      {state.status === "error" ? (
        <p className="pt-1 text-[11px] text-[var(--oxblood)]">{state.message}</p>
      ) : null}
    </>
  );
}
