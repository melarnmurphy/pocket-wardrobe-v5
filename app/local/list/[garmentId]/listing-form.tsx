"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PillButton } from "@/components/garderobe";
import { createLocalListingAction } from "@/app/local/actions";

export function ListingForm({
  garmentId,
  suggestedTitle,
  suggestedSize,
  wearCount
}: {
  garmentId: string;
  suggestedTitle: string;
  suggestedSize: string | null;
  wearCount: number;
}) {
  const router = useRouter();
  const [askDollars, setAskDollars] = useState("");
  const [description, setDescription] = useState(suggestedTitle);
  const [size, setSize] = useState(suggestedSize ?? "");
  const [negotiable, setNegotiable] = useState(true);
  const [showWearCount, setShowWearCount] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await createLocalListingAction({
      garment_id: garmentId,
      ask_cents: Math.round(Number.parseFloat(askDollars || "0") * 100),
      negotiable,
      description,
      photo_uris: [],
      show_wear_count: showWearCount,
      size: size || null
    });

    if (result.status === "error") {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    router.push(`/local/${result.listingId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label>
        <span className="block pb-1 text-[11px] text-[var(--stone)]">description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
        />
      </label>
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="block pb-1 text-[11px] text-[var(--stone)]">ask, AUD</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={askDollars}
            onChange={(event) => setAskDollars(event.target.value)}
            placeholder="45.00"
            className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </label>
        <label className="flex-1">
          <span className="block pb-1 text-[11px] text-[var(--stone)]">size</span>
          <input
            value={size}
            onChange={(event) => setSize(event.target.value)}
            className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-[var(--slate)]">
        <input type="checkbox" checked={negotiable} onChange={(event) => setNegotiable(event.target.checked)} />
        open to offers
      </label>
      <label className="flex items-center gap-2 text-[12.5px] text-[var(--slate)]">
        <input
          type="checkbox"
          checked={showWearCount}
          onChange={(event) => setShowWearCount(event.target.checked)}
        />
        show wear count ({wearCount}×)
      </label>
      {error ? <p className="text-[12.5px] text-[var(--oxblood)]">{error}</p> : null}
      <PillButton type="submit" disabled={isSubmitting}>
        {isSubmitting ? "listing…" : "list it locally"}
      </PillButton>
    </form>
  );
}
