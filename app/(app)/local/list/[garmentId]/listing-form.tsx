"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PillButton } from "@/components/garderobe";
import { addLocalListingPhotoAction, createLocalListingAction } from "@/app/local/actions";

interface UploadedPhoto {
  path: string;
  previewUrl: string;
}

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
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  async function handlePhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingPhoto(true);
    setError(null);
    const previewUrl = URL.createObjectURL(file);

    const result = await addLocalListingPhotoAction(garmentId, file);
    setIsUploadingPhoto(false);

    if (result.status === "error") {
      URL.revokeObjectURL(previewUrl);
      setError(result.message);
      return;
    }

    setPhotos((current) => [...current, { path: result.path, previewUrl }]);
  }

  function removePhoto(path: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.path === path);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.path !== path);
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await createLocalListingAction({
      garment_id: garmentId,
      ask_cents: Math.round(Number.parseFloat(askDollars || "0") * 100),
      negotiable,
      description,
      photo_uris: photos.map((photo) => photo.path),
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
      <div>
        <span className="block pb-1 text-[11px] text-[var(--stone)]">
          photos of it worn (optional — falls back to the piece&apos;s own photos)
        </span>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div key={photo.path} className="relative h-20 w-20 overflow-hidden rounded-[5px] border border-[rgba(30,26,23,.22)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(photo.path)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--cream)]"
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-[5px] border border-dashed border-[rgba(30,26,23,.35)] text-[11px] text-[var(--stone)]">
            {isUploadingPhoto ? "uploading…" : "+ add"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={isUploadingPhoto}
              onChange={handlePhotoSelected}
            />
          </label>
        </div>
      </div>
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
