"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PillButton } from "@/components/garderobe";
import { addWishlistItemAction, resolveWishlistUrlAction } from "./actions";

export function AddWishlistForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [category, setCategory] = useState("");
  const [colour, setColour] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve() {
    if (!url.trim()) return;
    setIsResolving(true);
    setError(null);
    const result = await resolveWishlistUrlAction(url.trim());
    if (result.status === "error") {
      setError(result.message);
      setIsResolving(false);
      return;
    }
    if (result.title) setTitle(result.title);
    if (result.priceCents !== null) setPriceDollars((result.priceCents / 100).toFixed(2));
    if (result.category) setCategory(result.category);
    if (result.colour) setColour(result.colour);
    setIsResolving(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await addWishlistItemAction({
      title: title || url,
      source_url: url || null,
      price_cents: priceDollars ? Math.round(Number.parseFloat(priceDollars) * 100) : null,
      currency: "AUD",
      category: category || null,
      colour_family: colour || null,
      watch_price: true
    });

    if (result.status === "error") {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setUrl("");
    setTitle("");
    setPriceDollars("");
    setCategory("");
    setColour("");
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="paste a product link"
          className="gw-mono flex-1 rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
        <button
          type="button"
          onClick={handleResolve}
          disabled={isResolving || !url.trim()}
          className="rounded-[100px] border border-[rgba(30,26,23,.22)] px-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--ink)] disabled:opacity-50"
        >
          {isResolving ? "reading…" : "paste"}
        </button>
      </div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="name"
        className="rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
      />
      <div className="flex gap-2">
        <input
          value={priceDollars}
          onChange={(event) => setPriceDollars(event.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="price, AUD"
          className="flex-1 rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="category"
          className="flex-1 rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
        />
      </div>
      {error ? <p className="text-[11px] text-[var(--oxblood)]">{error}</p> : null}
      <PillButton type="submit" fullWidth={false} disabled={isSubmitting}>
        {isSubmitting ? "saving…" : "save it"}
      </PillButton>
    </form>
  );
}
