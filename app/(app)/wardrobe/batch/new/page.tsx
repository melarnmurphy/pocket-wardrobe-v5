"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { PillButton } from "@/components/garderobe";
import { UploadFailedDialog } from "@/components/garderobe/wardrobe/upload-failed-dialog";
import { PhotoLibraryPermissionDialog } from "@/components/garderobe/wardrobe/photo-library-permission-dialog";
import { classifyUploadFile } from "@/lib/domain/ingestion/limits.shared";

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
      const responseText = await response.text();
      let body: { batchId?: string; error?: string } = {};
      try {
        body = JSON.parse(responseText) as { batchId?: string; error?: string };
      } catch {
        // A platform timeout or proxy error may return HTML instead of JSON.
      }

      if (!response.ok || !body.batchId) {
        setError(
          body.error ??
            (response.status === 401
              ? "Your session has expired. Sign in again, then return here to try these photos once more."
              : response.status >= 500
                ? "Garderobe could not start the photo batch just now. Your selected photos are still here. Check your connection and try again; if it keeps happening, remove one photo and retry."
                : "These photos could not be started. Your selection is still here—check the files and try again.")
        );
        setIsSubmitting(false);
        return;
      }

      router.push(`/wardrobe/batch/${body.batchId}`);
    } catch {
      setError(
        "Garderobe could not be reached just now. Your selected photos are still here. Check your connection and try again; if it keeps happening, remove one photo and retry."
      );
      setIsSubmitting(false);
    }
  }

  function openPicker() {
    let alreadyGranted = false;
    try {
      alreadyGranted =
        typeof window !== "undefined" &&
        window.localStorage.getItem("gw.photoLibraryPermissionGranted") === "1";
    } catch {
      alreadyGranted = false;
    }

    if (alreadyGranted) {
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
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8 pb-16 lg:px-10">
      <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)] lg:ml-[136px]">
        <ChevronLeft size={14} strokeWidth={1.5} />
        wardrobe
      </Link>

      <h1 className="pt-5 text-[46px] font-light leading-[1.05] tracking-[-0.035em] text-[var(--ink)] lg:ml-[136px]">choose photos</h1>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (photos.length) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        role={photos.length ? "group" : "button"}
        tabIndex={photos.length ? -1 : 0}
        className={[
          "mt-10 ml-0 flex min-h-[clamp(480px,68vh,740px)] cursor-pointer flex-col rounded-[4px] border border-dashed px-6 text-center transition-colors lg:ml-[136px]",
          photos.length ? "justify-start gap-5 py-6" : "items-center justify-center gap-3",
          isDragging
            ? "border-[var(--oxblood)] bg-[var(--blush)]"
            : "border-[rgba(30,26,23,.24)] bg-transparent"
        ].join(" ")}
      >
        {photos.length ? (
          <>
            <div className="flex w-full items-center justify-between border-b border-[rgba(30,26,23,.11)] pb-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
                {photos.length} photo{photos.length === 1 ? "" : "s"} selected
              </p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openPicker();
                }}
                className="text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--oxblood)] underline"
              >
                add more
              </button>
            </div>
            <div className="grid w-full flex-1 grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((photo, index) => (
                <div key={photo.previewUrl} className="relative aspect-[.78] overflow-hidden rounded-[3px] bg-[var(--paper)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={`Selected photo ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removePhoto(index);
                    }}
                    aria-label={`Remove selected photo ${index + 1}`}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--cream)]"
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-[var(--slate)]">tap the photo area to add more photos</p>
          </>
        ) : (
          <>
            <ImagePlus size={30} strokeWidth={1.25} className="text-[var(--stone)]" />
            <p className="text-[14px] text-[var(--slate)]">
              drop photos here, or tap to choose from your library
            </p>
          </>
        )}
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
          {error ? (
            <div
              role="alert"
              className="mt-6 flex max-w-[680px] flex-wrap items-center gap-x-5 gap-y-3 border border-[rgba(109,42,36,.22)] bg-[var(--blush)] px-4 py-3 text-[12.5px] leading-[1.5] text-[var(--blush-ink)]"
            >
              <p className="min-w-0 flex-1 break-words">{error}</p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="shrink-0 font-semibold uppercase tracking-[.16em] text-[10px] text-[var(--oxblood)] underline disabled:opacity-50"
              >
                try again
              </button>
            </div>
          ) : null}

          <div className="sticky bottom-4 mt-6 pb-6">
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
          try {
            window.localStorage.setItem("gw.photoLibraryPermissionGranted", "1");
          } catch {
            // Best-effort persistence only; the picker still opens for this session.
          }
          setShowLibraryPermission(false);
          inputRef.current?.click();
        }}
      />
    </div>
  );
}
