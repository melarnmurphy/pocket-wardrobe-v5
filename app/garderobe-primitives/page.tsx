"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import {
  BottomSheet,
  Chip,
  CutoutTile,
  Dialog,
  HairlineListRow,
  PillButton,
  PillToast,
  SheetAction,
  TextLink,
  Toggle
} from "@/components/garderobe";

export default function GarderobePrimitivesPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggleOn, setToggleOn] = useState(true);

  return (
    <div className="mx-auto max-w-[720px] px-6 py-10">
      <div className="pb-1 text-[9px] font-semibold uppercase tracking-[.22em] text-[var(--ink)]">
        phase 1 — primitives
      </div>
      <h1 className="text-[34px] font-light leading-[1.05] text-[var(--ink)]">
        garderobe style sheet
      </h1>
      <p className="max-w-[44rem] pt-2 pb-10 text-[12.5px] leading-[1.5] text-[var(--slate)]">
        Open{" "}
        <span className="gw-mono">
          docs/design/design_handoff_garderobe/Garderobe Style Sheet.dc.html
        </span>{" "}
        beside this page to compare.
      </p>

      <section className="border-t border-[rgba(30,26,23,.14)] py-8">
        <div className="pb-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          buttons · 52 tall, 100 radius
        </div>
        <div className="flex flex-col gap-[10px]">
          <PillButton variant="primary">primary</PillButton>
          <PillButton variant="neutral">neutral</PillButton>
          <PillButton variant="secondary">secondary</PillButton>
          <PillButton variant="on-blush">on colour</PillButton>
          <TextLink>text link</TextLink>
        </div>
      </section>

      <section className="border-t border-[rgba(30,26,23,.14)] py-8">
        <div className="pb-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          chips · toggle 42×25, knob 19
        </div>
        <div className="flex flex-wrap items-center gap-[7px] pb-6">
          <Chip variant="selected">selected</Chip>
          <Chip variant="available">available</Chip>
          <Chip variant="applied">applied ×</Chip>
          <Chip variant="add">add</Chip>
          <Chip variant="good-news">good news</Chip>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={toggleOn} onChange={setToggleOn} label="price drop alerts" />
          <span className="text-[12.5px] text-[var(--slate)]">price drop alerts</span>
        </div>
      </section>

      <section className="border-t border-[rgba(30,26,23,.14)] py-8">
        <div className="pb-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          hairline list row + cut-out tile · aspect .78
        </div>
        <div className="rounded-[4px] bg-[var(--cream)] px-[14px]">
          <HairlineListRow>
            <div className="w-[52px] shrink-0">
              <CutoutTile src={null} alt="camel wool overcoat" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] leading-[1.2] text-[var(--ink)]">camel wool overcoat</div>
              <div className="pt-1.5 text-[8px] font-semibold uppercase tracking-[.14em] text-[var(--stone)]">
                outerwear · worn 14×
              </div>
            </div>
            <span className="text-[18px] font-light text-[var(--oxblood)]">94%</span>
          </HairlineListRow>
          <HairlineListRow last>
            <div className="w-[52px] shrink-0">
              <CutoutTile src={null} alt="ribbed merino, ecru" />
            </div>
            <div className="flex-1">
              <div className="text-[14px] leading-[1.2] text-[var(--ink)]">ribbed merino, ecru</div>
              <div className="pt-1.5 text-[8px] font-semibold uppercase tracking-[.14em] text-[var(--stone)]">
                knitwear · worn 31×
              </div>
            </div>
            <span className="text-[18px] font-light text-[var(--stone)]">71%</span>
          </HairlineListRow>
        </div>
      </section>

      <section className="border-t border-[rgba(30,26,23,.14)] py-8">
        <div className="pb-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
          modal patterns
        </div>
        <div className="flex flex-wrap gap-[10px]">
          <PillButton fullWidth={false} onClick={() => setSheetOpen(true)}>
            open bottom sheet
          </PillButton>
          <PillButton fullWidth={false} variant="secondary" onClick={() => setDialogOpen(true)}>
            open dialog
          </PillButton>
        </div>
        <div className="pt-6">
          <PillToast message="Saved, and it unlocks 3 looks." actionLabel="view" icon={<Bookmark size={12} strokeWidth={1.5} />} />
        </div>
      </section>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="sheet title"
        description="One line of consequence, never two."
      >
        <div className="border-t border-[rgba(30,26,23,.11)]">
          <SheetAction onClick={() => setSheetOpen(false)}>first action</SheetAction>
          <SheetAction onClick={() => setSheetOpen(false)}>second action</SheetAction>
          <SheetAction destructive last onClick={() => setSheetOpen(false)}>
            destructive, last, no chevron
          </SheetAction>
        </div>
      </BottomSheet>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="a question, not a label"
        description="What is lost if they say yes."
        confirmLabel="confirm"
        onConfirm={() => setDialogOpen(false)}
      />
    </div>
  );
}
