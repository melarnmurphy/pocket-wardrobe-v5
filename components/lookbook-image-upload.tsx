"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { DestructiveActionButton } from "@/components/destructive-action-button";

export function LookbookImageUpload({
  name,
  accept,
  hint
}: {
  name: string;
  accept?: string;
  hint?: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFileName(null);
    setPreviewUrl(null);

    const input = document.querySelector(`input[name="${name}"][type="file"]`) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  return (
    <label className="block">
      <span className="text-sm font-medium">Reference Image</span>
      <div
        className={`relative mt-3 overflow-hidden border border-dashed transition-colors ${
          previewUrl
            ? "border-[var(--line)] bg-[var(--surface)]"
            : dragActive
              ? "border-[var(--oxblood)] bg-[rgba(109,42,36,0.05)]"
              : "border-[var(--line)] bg-[rgba(255,255,255,0.28)]"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);

          const file = event.dataTransfer.files?.[0] ?? null;

          if (!file || !file.type.startsWith("image/")) {
            return;
          }

          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          setFileName(file.name);
          setPreviewUrl(URL.createObjectURL(file));

          const input = event.currentTarget.querySelector(
            'input[type="file"]'
          ) as HTMLInputElement | null;

          if (input) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
          }
        }}
      >
        <div className="flex flex-col gap-4">
          {previewUrl ? (
            <div className="relative">
              <Image
                src={previewUrl}
                alt="Selected lookbook upload preview"
                width={800}
                height={1000}
                unoptimized
                className="h-[26rem] w-full object-contain bg-[rgba(242,236,227,0.45)]"
              />
              <div className="absolute right-4 top-4">
                <DestructiveActionButton
                  idleLabel="Remove Image"
                  pendingLabel="Removing..."
                  confirmLabel="Confirm remove"
                  buttonType="button"
                  onConfirm={clearPreview}
                  className="bg-[var(--ink)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white"
                  confirmClassName="bg-[var(--oxblood)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white"
                />
              </div>
              <div className="border-t border-[var(--line)] bg-[rgba(242,236,227,0.32)] px-5 py-4">
                <p className="text-sm font-semibold">{fileName || "Image selected"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Replace it by choosing another file or dragging a new image into this area.
                </p>
              </div>
            </div>
          ) : null}

          {!previewUrl ? (
            <span className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <Image
                src="/illustrations/chatting.svg"
                alt=""
                aria-hidden="true"
                width={112}
                height={112}
                unoptimized
                className="mb-5 h-28 w-28 object-contain opacity-90"
              />
              <p className="text-base font-semibold tracking-[-0.02em]">
                Click to upload look
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">or drag and drop</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
                {hint || "Upload an image for this lookbook reference."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <span className="pw-button-quiet px-4 py-2 text-sm font-medium">
                  JPG, PNG, WEBP
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Private storage
                </span>
              </div>
              <div className="mt-6">
                <span className="pw-button-primary">
                  Choose Image
                </span>
              </div>
            </span>
          ) : null}

          <input
            suppressHydrationWarning
            className="sr-only"
            name={name}
            type="file"
            accept={accept}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;

              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
              }

              if (!file) {
                setFileName(null);
                setPreviewUrl(null);
                return;
              }

              setFileName(file.name);
              setPreviewUrl(URL.createObjectURL(file));
            }}
          />
        </div>
      </div>
    </label>
  );
}
