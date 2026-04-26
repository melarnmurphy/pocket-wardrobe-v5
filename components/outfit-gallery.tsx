"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { z } from "zod";
import type { OutfitInsight, OutfitWithItems } from "@/lib/domain/outfits";
import { outfitInsightSchema } from "@/lib/domain/outfits";
import { deleteOutfitAction } from "@/app/outfits/actions";
import { showAppToast } from "@/lib/ui/app-toast";

interface OutfitGalleryProps {
  outfits: OutfitWithItems[];
}

const deleteOutfitState = {
  status: "idle" as const,
  message: null as string | null
};

function thumbnailSlots(
  items: OutfitWithItems["items"]
): Array<OutfitWithItems["items"][number] | null> {
  const priority: Array<string[]> = [
    ["top", "dress"],
    ["bottom"],
    ["outerwear", "shoes"],
    ["accessory", "bag", "jewellery", "other"]
  ];
  return priority.map((roles) => items.find((item) => roles.includes(item.role)) ?? null);
}

function parseSavedOutfitInsights(outfit: OutfitWithItems): OutfitInsight[] {
  const payload = outfit.explanation_json?.["insights"];
  const parsed = z.array(outfitInsightSchema).safeParse(payload);
  return parsed.success ? parsed.data : [];
}

export function OutfitGallery({ outfits }: OutfitGalleryProps) {
  if (outfits.length === 0) {
    return (
      <p className="rounded-[8px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-6 text-sm text-[var(--muted)]">
        No saved outfits yet. Generate your first outfit above.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {outfits.map((outfit) => (
        <SavedOutfitCard key={outfit.id} outfit={outfit} />
      ))}
    </div>
  );
}

function SavedOutfitCard({ outfit }: { outfit: OutfitWithItems }) {
  const router = useRouter();
  const slots = thumbnailSlots(outfit.items);
  const insights = parseSavedOutfitInsights(outfit);
  const [deleteState, deleteFormAction] = useActionState(
    deleteOutfitAction,
    deleteOutfitState
  );
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (deleteState.status === "success") {
      setIsVisible(false);
      showAppToast({
        tone: "success",
        message: deleteState.message || "Outfit deleted."
      });
      router.refresh();
    }
  }, [deleteState.message, deleteState.status, router]);

  useEffect(() => {
    if (deleteState.status === "error" && deleteState.message) {
      showAppToast({
        tone: "error",
        message: deleteState.message
      });
    }
  }, [deleteState.message, deleteState.status]);

  if (!isVisible) {
    return null;
  }

  return (
    <article className="relative overflow-hidden rounded-[8px] border border-[rgba(17,17,17,0.08)] bg-white shadow-[0_18px_40px_rgba(17,17,17,0.06)]">
      <div className="absolute right-3 top-3 z-10">
        <form action={deleteFormAction}>
          <input type="hidden" name="outfit_id" value={outfit.id} />
          <DeleteOutfitButton />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-0.5 bg-[var(--surface)] p-3">
        {slots.map((item, index) =>
          item ? (
            <div
              key={item.id}
              className="aspect-square overflow-hidden rounded-[6px] bg-[rgba(17,17,17,0.08)]"
            >
              {item.garment.preview_url ? (
                <img
                  src={item.garment.preview_url}
                  alt={item.garment.title ?? item.garment.category}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center" />
              )}
            </div>
          ) : (
            <div
              key={index}
              className="aspect-square rounded-[6px] bg-[rgba(17,17,17,0.04)]"
            />
          )
        )}
      </div>

      <div className="px-4 py-4">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--foreground)]">
          {outfit.title ?? "Outfit"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {outfit.items.length} item{outfit.items.length !== 1 ? "s" : ""} ·{" "}
          {new Date(outfit.created_at ?? "").toLocaleDateString()}
        </p>

        {insights.length ? (
          <div className="mt-4 space-y-3">
            {insights.slice(0, 2).map((insight) => (
              <div
                key={insight.key}
                className="rounded-[8px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,243,238,0.92))] p-3"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  {insight.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">
                  {insight.body}
                </p>
                {insight.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {insight.tags.slice(0, 3).map((tag) => (
                      <span
                        key={`${insight.key}-${tag}`}
                        className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[10px] text-[var(--muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function DeleteOutfitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      title="Delete outfit"
      disabled={pending}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(17,17,17,0.08)] bg-white/94 text-[var(--muted)] shadow-[0_12px_24px_rgba(17,17,17,0.08)] transition-all hover:-translate-y-0.5 hover:text-[#b0473c] disabled:transform-none disabled:opacity-60"
    >
      <TrashIcon />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path d="M4 6h12M7.5 6V4.5h5V6M6.5 6l.5 9h6l.5-9M8.5 8.5v4.5M11.5 8.5v4.5" />
    </svg>
  );
}
