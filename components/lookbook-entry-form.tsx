"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { FormFeedback } from "@/components/form-feedback";
import { LookbookImageUpload } from "@/components/lookbook-image-upload";
import { showAppToast } from "@/lib/ui/app-toast";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";

const sourceOptions = [
  "manual",
  "uploaded_image",
  "editorial_reference",
  "wishlist",
  "ai_generated",
  "outfit_reference"
] as const;

export function LookbookEntryForm({
  action,
  initialIsActive = false
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  initialIsActive?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [uploadKey, setUploadKey] = useState(0);
  const [stylingNotesOpen, setStylingNotesOpen] = useState(initialIsActive);
  const [state, formAction] = useActionState(action, formActionState);
  const isActive = searchParams.get("create") === "1";

  useEffect(() => {
    if (isActive) {
      setStylingNotesOpen(true);
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [isActive]);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setUploadKey((current) => current + 1);
      setStylingNotesOpen(false);
      showAppToast({
        message: state.message || "Lookbook entry saved",
        tone: "success"
      });
      setComposerFocus(null);
    }
  }, [state.message, state.status]);

  function setComposerFocus(nextActive: boolean | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextActive) {
      params.set("create", "1");
      params.delete("entry");
    } else {
      params.delete("create");
    }

    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`pw-panel-soft p-6 transition-all duration-200 md:p-7 ${
        isActive
          ? "border-[rgba(123,92,240,0.36)] shadow-[0_22px_50px_rgba(123,92,240,0.16)] ring-1 ring-[rgba(123,92,240,0.18)]"
          : ""
      }`}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Create Lookbook Entry</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Save inspiration, editorial references, wishlist pieces, or styling targets without
            treating them as owned garments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerFocus(isActive ? null : true)}
          className={`px-3 py-2 text-xs uppercase tracking-[0.16em] ${
            isActive
              ? "pw-button-secondary"
              : "pw-button-quiet"
          }`}
        >
          {isActive ? "Clear Focus" : "Focus Composer"}
        </button>
      </div>

      <div className="space-y-6">
        <section className="rounded-[8px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))] p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
                Core Entry
              </p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">
                Title the reference and define what kind of inspiration it is.
              </p>
            </div>
            <span className="pw-chip">
              Save first
            </span>
          </div>

          <div className="mt-6 grid gap-x-4 gap-y-5 md:grid-cols-2">
            <Field label="Title" name="title" placeholder="Relaxed ivory tailoring" />
            <SelectField label="Source Type" name="source_type" options={sourceOptions} />
            <Field
              label="Source URL"
              name="source_url"
              placeholder="https://example.com/look"
              type="url"
            />
          </div>
        </section>

        <div>
          <LookbookImageUpload
            key={uploadKey}
            name="image"
            accept="image/*"
            hint="Upload a look, editorial reference, outfit photo, or wishlist image."
          />
        </div>

        <details
          open={stylingNotesOpen}
          onToggle={(event) => setStylingNotesOpen(event.currentTarget.open)}
          className="pw-panel-soft p-5 md:p-6"
        >
          <summary className="cursor-pointer text-sm font-medium">Styling Notes</summary>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Capture the mood, silhouette cues, and occasions that make this reference useful.
          </p>

          <div className="mt-6 grid gap-5">
            <TextAreaField
              label="Description"
              name="description"
              placeholder="Notes on silhouette, styling cues, or missing pieces."
            />
            <Field
              label="Aesthetic Tags"
              name="aesthetic_tags"
              placeholder="minimalist, soft tailoring, quiet luxury"
            />
            <Field
              label="Occasion Tags"
              name="occasion_tags"
              placeholder="office, dinner, travel"
            />
          </div>
        </details>
      </div>

      <div className="mt-7 border-t border-[var(--line)] pt-5">
        <SubmitButton idle="Save Lookbook Entry" pending="Saving Entry..." />
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        suppressHydrationWarning
        className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        type={type}
        placeholder={placeholder}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  placeholder
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        suppressHydrationWarning
        className="min-h-28 rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options
}: {
  label: string;
  name: string;
  options: readonly string[];
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select
        suppressHydrationWarning
        className="rounded-[8px] border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        defaultValue="manual"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function SubmitButton({ idle, pending }: { idle: string; pending: string }) {
  const { pending: isPending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={isPending}
      className="pw-button-primary mt-6 disabled:transform-none disabled:opacity-60 disabled:shadow-none"
    >
      {isPending ? pending : idle}
    </button>
  );
}
