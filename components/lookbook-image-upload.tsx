"use client";

import { useEffect, useState } from "react";

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

  return (
    <label className="block">
      <span className="text-sm font-medium">Reference Image</span>
      <div
        className={`relative mt-2 overflow-hidden rounded-[1.5rem] border-2 border-dashed transition-colors ${
          previewUrl
            ? "border-transparent bg-white"
            : dragActive
              ? "border-[var(--accent)] bg-[rgba(166,99,60,0.07)]"
              : "border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,239,232,0.85))]"
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
              <img
                src={previewUrl}
                alt="Selected lookbook upload preview"
                className="h-[26rem] w-full object-contain bg-[rgba(0,0,0,0.03)]"
              />
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                  }
                  setFileName(null);
                  setPreviewUrl(null);

                  const input = event.currentTarget
                    .parentElement
                    ?.querySelector('input[type="file"]') as HTMLInputElement | null;

                  if (input) {
                    input.value = "";
                  }
                }}
                className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white"
              >
                Remove
              </button>
              <div className="border-t border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,239,232,0.88))] px-5 py-4">
                <p className="text-sm font-semibold">{fileName || "Image selected"}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Replace it by choosing another file or dragging a new image into this area.
                </p>
              </div>
            </div>
          ) : null}

          {!previewUrl ? (
            <span className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <img
                src="/illustrations/chatting.svg"
                alt=""
                aria-hidden="true"
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
                <span className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium">
                  JPG, PNG, WEBP
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Private storage
                </span>
              </div>
              <div className="mt-6">
                <span className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)]">
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
