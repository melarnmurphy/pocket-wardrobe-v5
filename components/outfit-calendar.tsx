"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { OutfitWithItems } from "@/lib/domain/outfits";
import { buildMonthGrid, bucketOutfitsByDate } from "@/lib/domain/outfits/calendar";
import { planOutfitForDateAction, unplanOutfitAction } from "@/app/calendar/actions";
import { showAppToast } from "@/lib/ui/app-toast";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function outfitChips(outfit: OutfitWithItems): string[] {
  return outfit.items.map((it) => it.garment.category);
}

export function OutfitCalendar({
  outfits,
  todayKey
}: {
  outfits: OutfitWithItems[];
  todayKey: string;
}) {
  const [year, month] = todayKey.split("-").map(Number); // month is 1-based
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month);
  const [selected, setSelected] = useState<string | null>(todayKey);
  const [isPending, startTransition] = useTransition();

  const byDate = useMemo(() => bucketOutfitsByDate(outfits), [outfits]);
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function plan(outfitId: string, date: string) {
    startTransition(async () => {
      const res = await planOutfitForDateAction(outfitId, date);
      showAppToast(
        res.status === "success"
          ? { message: "Outfit planned.", tone: "success" }
          : { message: res.message, tone: "error" }
      );
    });
  }
  function unplan(outfitId: string) {
    startTransition(async () => {
      const res = await unplanOutfitAction(outfitId);
      showAppToast(
        res.status === "success"
          ? { message: "Plan removed.", tone: "success" }
          : { message: res.message, tone: "error" }
      );
    });
  }

  const selectedOutfit = selected ? byDate.get(selected) : undefined;
  const unplanned = outfits.filter((o) => !o.planned_for);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
          className="rounded-full p-2" style={{ border: "1px solid var(--line)" }}>
          <ChevronLeft size={18} />
        </button>
        <h2 className="italic" style={{ fontFamily: "var(--font-display), serif", fontSize: "1.6rem" }}>
          {MONTHS[viewMonth - 1]} {viewYear}
        </h2>
        <button onClick={() => shiftMonth(1)} aria-label="Next month"
          className="rounded-full p-2" style={{ border: "1px solid var(--line)" }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[0.7rem] font-semibold uppercase"
            style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>{w}</div>
        ))}
        {grid.weeks.flat().map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const has = byDate.has(cell.date);
          const isToday = cell.date === todayKey;
          const isSel = cell.date === selected;
          return (
            <button
              key={cell.date}
              onClick={() => setSelected(cell.date)}
              className="relative aspect-square rounded-lg text-sm"
              style={{
                border: isSel ? "1px solid var(--accent)" : "1px solid var(--line)",
                fontWeight: isToday ? 700 : 400
              }}
            >
              {cell.day}
              {has && (
                <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                  style={{ background: "var(--accent)" }} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-6 rounded-2xl p-5" style={{ border: "1px solid var(--line)" }}>
          <p className="text-[0.72rem] font-semibold uppercase"
            style={{ color: "var(--muted)", letterSpacing: "0.2em" }}>{selected}</p>

          {selectedOutfit ? (
            <div className="mt-3">
              <p className="text-lg" style={{ fontFamily: "var(--font-display), serif" }}>
                {selectedOutfit.title ?? "Planned outfit"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {outfitChips(selectedOutfit).map((c, idx) => (
                  <span key={idx} className="rounded-full px-2.5 py-1 text-[0.72rem]"
                    style={{ border: "1px solid var(--line)" }}>{c}</span>
                ))}
              </div>
              <button
                disabled={isPending}
                onClick={() => unplan(selectedOutfit.id)}
                className="mt-4 rounded-full px-4 py-2 text-[0.74rem] font-semibold uppercase"
                style={{ border: "1px solid var(--line)", letterSpacing: "0.14em" }}>
                Remove from this day
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <p style={{ color: "var(--muted)" }}>No outfit planned. Choose a saved outfit:</p>
              {unplanned.length === 0 ? (
                <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
                  No unplanned saved outfits — save one in the planner first.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {unplanned.map((o) => (
                    <li key={o.id}>
                      <button
                        disabled={isPending}
                        onClick={() => plan(o.id, selected)}
                        className="w-full rounded-xl px-4 py-3 text-left"
                        style={{ border: "1px solid var(--line)" }}>
                        <span className="text-sm font-medium">{o.title ?? "Saved outfit"}</span>
                        <span className="ml-2 text-[0.72rem]" style={{ color: "var(--muted)" }}>
                          {outfitChips(o).join(" · ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
