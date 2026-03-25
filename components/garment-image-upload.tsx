"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { DestructiveActionButton } from "@/components/destructive-action-button";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import {
  wardrobeActionState,
  type WardrobeActionState
} from "@/lib/domain/wardrobe/action-state";

export function GarmentImageUpload({
  garmentId,
  action,
  latestPath
}: {
  garmentId: string;
  action: (
    state: WardrobeActionState,
    formData: FormData
  ) => Promise<WardrobeActionState>;
  latestPath?: string | null;
}) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [state, formAction] = useActionState(action, wardrobeActionState);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (state.status === "success" || state.status === "partial") {
      showAppToast({
        message: state.message || "Garment image attached",
        tone: state.status === "partial" ? "info" : "success"
      });
    }
  }, [state.message, state.status]);

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFileName(null);
    setPreviewUrl(null);

    const input = document.getElementById(inputId) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  };

  return (
    <form
      action={formAction}
      className="pw-panel-soft p-4"
    >
      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Upload Original Image
      </h4>
      <input type="hidden" name="garment_id" value={garmentId} />
      <div
        className={`relative mt-3 overflow-hidden rounded-[1.25rem] border-2 border-dashed transition-colors ${
          previewUrl
            ? "border-transparent bg-white"
            : dragActive
              ? "border-[var(--accent)] bg-[rgba(123,92,240,0.08)]"
              : "border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,243,255,0.88))]"
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
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Selected garment upload preview"
              className="h-72 w-full object-contain bg-[rgba(0,0,0,0.03)]"
            />
            <div className="absolute right-4 top-4">
              <DestructiveActionButton
                idleLabel="Remove Image"
                pendingLabel="Removing..."
                confirmLabel="Confirm remove"
                buttonType="button"
                onConfirm={clearPreview}
                className="rounded-full bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white"
                confirmClassName="rounded-full bg-red-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-[0_10px_24px_rgba(185,28,28,0.24)]"
              />
            </div>
            <div className="border-t border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(245,243,255,0.88))] px-5 py-4">
              <p className="text-sm font-semibold">{fileName || "Image selected"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Replace it by choosing another file or dragging a new image into this area.
              </p>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center justify-center px-6 py-10 text-center"
          >
            <img
              src="/illustrations/chatting.svg"
              alt=""
              aria-hidden="true"
              className="mb-5 h-24 w-24 object-contain opacity-90"
            />
            <p className="text-base font-semibold tracking-[-0.02em]">
              Click to upload garment image
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">or drag and drop</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
              Add the original garment photo so it can be attached to this wardrobe item.
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
          </label>
        )}

        <input
          suppressHydrationWarning
          id={inputId}
          className="sr-only"
          type="file"
          name="image"
          accept="image/*"
          required
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

      <UploadButton />
      <FormFeedback state={state} className="mt-3" />
      <p className="mt-3 text-xs text-[var(--muted)]">
        Stored in the <code>garment-originals</code> bucket and recorded in{" "}
        <code>garment_images</code> plus <code>garment_sources</code>.
      </p>
      {latestPath ? (
        <p className="mt-2 text-xs text-[var(--muted)]">Latest: {latestPath}</p>
      ) : null}
    </form>
  );
}

function UploadButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="pw-button-quiet mt-4 px-4 py-2 text-sm disabled:opacity-60"
    >
      {pending ? "Attaching..." : "Attach Image"}
    </button>
  );
}
