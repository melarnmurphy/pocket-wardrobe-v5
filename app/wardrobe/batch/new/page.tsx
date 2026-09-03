"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { PillButton } from "@/components/garderobe";
import { UploadFailedDialog } from "@/components/garderobe/wardrobe/upload-failed-dialog";
import { PhotoLibraryPermissionDialog } from "@/components/garderobe/wardrobe/photo-library-permission-dialog";
import { classifyUploadFile } from "@/lib/domain/ingestion/limits";

type PickedPhoto = { file: File; previewUrl: string };

/** 14a — choose photos, many at a time. Also serves w1d's drag-a-folder on desktop. */
export default function ChoosePhotosPage() {
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadErrorCode, setUploadErrorCode] = useState<
    "unsupported_format" | "too_large" | null
  >(null);
  const [showLibraryPermission, setShowLibraryPermission] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!incoming.length) return;

    const accepted: File[] = [];
    let firstBadCode: "unsupported_format" | "too_large" | null = null;

    for (const file of incoming) {
      const check = classifyUploadFile(file);
      if (check === "ok") {
        accepted.push(file);
      } else if (!firstBadCode) {
        firstBadCode = check;
      }
    }

    if (accepted.length) {
      setPhotos((current) => [
        ...current,
        ...accepted.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
      ]);
    }
    if (firstBadCode) {
      setUploadErrorCode(firstBadCode);
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const next = [...current];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  async function handleSubmit() {
    if (!photos.length || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      photos.forEach((photo) => formData.append("photos", photo.file));

      const response = await fetch("/api/pipeline/batch", { method: "POST", body: formData });
      const body = (await response.json()) as { batchId?: string; error?: string };

      if (!response.ok || !body.batchId) {
        setError(body.error ?? "Unable to start the batch.");
        setIsSubmitting(false);
        return;
      }

      router.push(`/wardrobe/batch/${body.batchId}`);
    } catch {
      setError("Unable to start the batch.");
      setIsSubmitting(false);
    }
  }

  function openPicker() {
    if (typeof window !== "undefined" && window.localStorage.getItem("gw.photoLibraryPermissionGranted") === "1") {
      inputRef.current?.click();
      return;
    }
    setShowLibraryPermission(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
      <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
        <ChevronLeft size={14} strokeWidth={1.5} />
        wardrobe
      </Link>

      <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">choose photos</h1>
      <p className="pt-2 max-w-[44rem] text-[12.5px] leading-[1.5] text-[var(--slate)]">
        Pick as many as you like, or drag a folder in on desktop. Nothing enters the wardrobe until
        you review and confirm each one.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        className={[
          "mt-6 flex cursor-pointer flex-col items-center gap-2 rounded-[4px] border border-dashed px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-[var(--oxblood)] bg-[var(--blush)]"
            : "border-[rgba(30,26,23,.3)] bg-[var(--paper)]"
        ].join(" ")}
      >
        <ImagePlus size={22} strokeWidth={1.5} className="text-[var(--stone)]" />
        <p className="text-[12.5px] text-[var(--slate)]">
          drop photos here, or tap to choose from your library
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      {photos.length ? (
        <>
          <div className="mt-6 grid grid-cols-4 gap-2">
            {photos.map((photo, index) => (
              <div key={photo.previewUrl} className="relative aspect-[.78] overflow-hidden rounded-[3px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label="remove"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--cream)]"
                >
                  <X size={11} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>

          {error ? <p className="pt-4 text-[12.5px] text-[var(--oxblood)]">{error}</p> : null}

          <div className="mt-6 sticky bottom-4">
            <PillButton onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? "starting…"
                : `process ${photos.length} photo${photos.length === 1 ? "" : "s"}`}
            </PillButton>
          </div>
        </>
      ) : null}

      {uploadErrorCode ? (
        <UploadFailedDialog
          open
          errorCode={uploadErrorCode}
          onClose={() => setUploadErrorCode(null)}
          onRetry={() => {
            setUploadErrorCode(null);
            inputRef.current?.click();
          }}
        />
      ) : null}

      <PhotoLibraryPermissionDialog
        open={showLibraryPermission}
        onNotNow={() => setShowLibraryPermission(false)}
        onAllow={() => {
          window.localStorage.setItem("gw.photoLibraryPermissionGranted", "1");
          setShowLibraryPermission(false);
          inputRef.current?.click();
        }}
      />
    </div>
  );
}
