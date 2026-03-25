"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DestructiveActionButton } from "@/components/destructive-action-button";
import { FormFeedback } from "@/components/form-feedback";
import { showAppToast } from "@/lib/ui/app-toast";
import type {
  LookbookListItem,
  WardrobeLookupItem
} from "@/lib/domain/lookbook/service";
import { formActionState, type FormActionState } from "@/lib/ui/form-action-state";

const sourceOptions = [
  "manual",
  "uploaded_image",
  "editorial_reference",
  "wishlist",
  "ai_generated",
  "outfit_reference"
] as const;

export function LookbookEntryCard({
  entry,
  isActive,
  garments,
  deleteEntryAction,
  updateEntryAction,
  createItemAction,
  deleteItemAction,
  updateItemAction
}: {
  entry: LookbookListItem;
  isActive: boolean;
  garments: WardrobeLookupItem[];
  deleteEntryAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
  updateEntryAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
  createItemAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
  deleteItemAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
  updateItemAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cardRef = useRef<HTMLElement>(null);
  const [deleteState, deleteFormAction] = useActionState(deleteEntryAction, formActionState);
  const [updateState, updateFormAction] = useActionState(updateEntryAction, formActionState);
  const [editOpen, setEditOpen] = useState(isActive);
  const [planningOpen, setPlanningOpen] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setEditOpen(true);
      setPlanningOpen(true);
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }, [isActive]);

  useEffect(() => {
    if (updateState.status === "success") {
      showAppToast({
        message: updateState.message || "Lookbook entry updated",
        tone: "success"
      });
    }
  }, [updateState.message, updateState.status]);

  useEffect(() => {
    if (deleteState.status === "success") {
      showAppToast({
        message: deleteState.message || "Lookbook entry deleted",
        tone: "success"
      });
    }
  }, [deleteState.message, deleteState.status]);

  function setEntryFocus(nextEntryId: string | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextEntryId) {
      params.set("entry", nextEntryId);
    } else {
      params.delete("entry");
    }

    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
  }

  return (
    <article
      ref={cardRef}
      className={`overflow-hidden rounded-[8px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,243,255,0.92))] shadow-[0_18px_40px_rgba(45,27,105,0.08)] transition-all duration-200 ${
        isActive
          ? "border-[rgba(123,92,240,0.4)] shadow-[0_22px_50px_rgba(123,92,240,0.16)] ring-1 ring-[rgba(123,92,240,0.18)]"
          : "border-[var(--line)]"
      }`}
    >
      {entry.preview_url ? (
        <div className="overflow-hidden border-b border-[var(--line)] bg-white">
          <img
            src={entry.preview_url}
            alt={entry.title || "Lookbook reference image"}
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center border-b border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.92))]">
          <div className="text-center">
            <img
              src="/illustrations/chatting.svg"
              alt=""
              aria-hidden="true"
              className="mx-auto h-20 w-20 object-contain opacity-80"
            />
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Reference
            </p>
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              {entry.source_type.replaceAll("_", " ")}
            </p>
            <h3 className="text-xl font-semibold">{entry.title || "Untitled reference"}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEntryFocus(isActive ? null : entry.id)}
              className={`px-3 py-2 text-xs uppercase tracking-[0.16em] ${
                isActive
                  ? "pw-button-secondary"
                  : "pw-button-quiet"
              }`}
            >
              {isActive ? "Clear Focus" : "Focus Entry"}
            </button>
            <form action={deleteFormAction}>
              <input type="hidden" name="id" value={entry.id} />
              <DestructiveActionButton idleLabel="Delete Entry" pendingLabel="Deleting..." />
            </form>
          </div>
        </div>

        {entry.description ? (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--muted)]">
            {entry.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {entry.aesthetic_tags.slice(0, 3).map((tag) => (
            <span
              key={`${entry.id}-${tag}`}
              className="rounded-full border border-[var(--line)] bg-white/82 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[var(--muted)]"
            >
              {tag}
            </span>
          ))}
          {entry.occasion_tags.slice(0, 2).map((tag) => (
            <span
              key={`${entry.id}-${tag}-occasion`}
              className="rounded-full border border-[rgba(45,27,105,0.08)] bg-[rgba(45,27,105,0.06)] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-[var(--muted)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <LookbookMiniStat
            label="Aesthetic Tags"
            value={String(entry.aesthetic_tags.length)}
            detail={entry.aesthetic_tags.join(", ") || "No tags yet"}
          />
          <LookbookMiniStat
            label="Occasion Tags"
            value={String(entry.occasion_tags.length)}
            detail={entry.occasion_tags.join(", ") || "No occasions yet"}
          />
          <LookbookMiniStat
            label="Source"
            value={sourceDomainLabel(entry.source_url || null)}
            detail={entry.source_url || "No external source"}
          />
          <LookbookMiniStat
            label="Linked Items"
            value={String(entry.items.length)}
            detail={
              entry.items.length
                ? "Owned garments and missing pieces tracked"
                : "No linked planning items yet"
            }
          />
        </div>

        <details
          open={editOpen}
          onToggle={(event) => setEditOpen(event.currentTarget.open)}
          className="pw-panel-soft mt-4 p-4"
        >
          <summary className="cursor-pointer text-sm font-medium">Edit Entry</summary>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Update the reference details without changing how the card reads in the board.
          </p>
          <form action={updateFormAction} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={entry.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" name="title" defaultValue={entry.title || ""} />
              <SelectField
                label="Source Type"
                name="source_type"
                options={sourceOptions}
                defaultValue={entry.source_type}
              />
              <Field
                label="Source URL"
                name="source_url"
                type="url"
                defaultValue={entry.source_url || ""}
              />
            </div>
            <input type="hidden" name="image_path" value={entry.image_path || ""} />
            <TextAreaField
              label="Description"
              name="description"
              defaultValue={entry.description || ""}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Aesthetic Tags"
                name="aesthetic_tags"
                defaultValue={entry.aesthetic_tags.join(", ")}
              />
              <Field
                label="Occasion Tags"
                name="occasion_tags"
                defaultValue={entry.occasion_tags.join(", ")}
              />
            </div>
            <SubmitButton idle="Update Entry" pending="Updating..." tone="light" />
            <FormFeedback state={updateState} className="mt-3" />
          </form>
        </details>

        <details
          open={planningOpen}
          onToggle={(event) => setPlanningOpen(event.currentTarget.open)}
          className="mt-5 rounded-[1rem] border border-[var(--line)] bg-white/70 p-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Linked Items
              </h4>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Match the reference to owned garments or capture the missing pieces it suggests.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              {entry.items.length} tracked
            </span>
          </summary>

          <div className="mt-4 space-y-3">
            {entry.items.length ? (
              entry.items.map((item) => (
                <LinkedItemCard
                  key={item.id}
                  item={item}
                  entryId={entry.id}
                  garments={garments}
                  deleteItemAction={deleteItemAction}
                  updateItemAction={updateItemAction}
                />
              ))
            ) : (
              <p className="text-sm text-[var(--muted)]">No linked items yet.</p>
            )}
          </div>

          <AddLinkedItemForm
            entryId={entry.id}
            garments={garments}
            createItemAction={createItemAction}
          />
        </details>

        <FormFeedback state={deleteState} />
      </div>
    </article>
  );
}

function LinkedItemCard({
  item,
  entryId,
  garments,
  deleteItemAction,
  updateItemAction
}: {
  item: LookbookListItem["items"][number];
  entryId: string;
  garments: WardrobeLookupItem[];
  deleteItemAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
  updateItemAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
}) {
  const [deleteState, deleteFormAction] = useActionState(deleteItemAction, formActionState);
  const [updateState, updateFormAction] = useActionState(updateItemAction, formActionState);

  useEffect(() => {
    if (updateState.status === "success") {
      showAppToast({
        message: updateState.message || "Linked item updated",
        tone: "success"
      });
    }
  }, [updateState.message, updateState.status]);

  useEffect(() => {
    if (deleteState.status === "success") {
      showAppToast({
        message: deleteState.message || "Linked item removed",
        tone: "success"
      });
    }
  }, [deleteState.message, deleteState.status]);

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 text-sm text-[var(--muted)]">
          <p className="font-medium text-[var(--foreground)]">
            {item.garment_id
              ? garmentLabel(item.garment_id, garments)
              : desiredItemLabel(item.desired_item_json)}
          </p>
          {item.role ? <p>Role: {item.role}</p> : null}
          {item.garment_id ? <p>Type: linked wardrobe garment</p> : <p>Type: missing piece target</p>}
        </div>
        <form action={deleteFormAction}>
          <input type="hidden" name="id" value={item.id} />
          <DestructiveActionButton idleLabel="Remove Link" pendingLabel="Removing..." />
        </form>
      </div>

      <details className="mt-4 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
        <summary className="cursor-pointer text-sm font-medium">Edit Linked Item</summary>
        <form action={updateFormAction} className="mt-4 space-y-4">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="lookbook_entry_id" value={entryId} />
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Owned Garment"
              name="garment_id"
              options={[
                { value: "", label: "None, keep as missing piece" },
                ...garments.map((garment) => ({
                  value: garment.id,
                  label: garmentLabel(garment.id, garments)
                }))
              ]}
              defaultValue={item.garment_id || ""}
            />
            <Field label="Role" name="role" defaultValue={item.role || ""} />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Missing Piece Title"
              name="desired_title"
              defaultValue={stringValue(item.desired_item_json, "title")}
            />
            <Field
              label="Missing Piece Category"
              name="desired_category"
              defaultValue={stringValue(item.desired_item_json, "category")}
            />
            <Field
              label="Missing Piece Notes"
              name="desired_notes"
              defaultValue={stringValue(item.desired_item_json, "notes")}
            />
          </div>
          <button
            type="submit"
            className="pw-button-quiet px-4 py-2 text-sm"
          >
            Update Linked Item
          </button>
          <FormFeedback state={updateState} className="mt-3" />
        </form>
      </details>

      <FormFeedback state={deleteState} className="mt-3" />
    </article>
  );
}

function AddLinkedItemForm({
  entryId,
  garments,
  createItemAction
}: {
  entryId: string;
  garments: WardrobeLookupItem[];
  createItemAction: (
    state: FormActionState,
    formData: FormData
  ) => Promise<FormActionState>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [createState, createFormAction] = useActionState(createItemAction, formActionState);

  useEffect(() => {
    if (createState.status === "success") {
      formRef.current?.reset();
      showAppToast({
        message: createState.message || "Linked item added",
        tone: "success"
      });
    }
  }, [createState.message, createState.status]);

  return (
    <details className="mt-4 rounded-[1rem] border border-[var(--line)] bg-[rgba(255,255,255,0.78)] p-4">
      <summary className="cursor-pointer text-sm font-medium">Add Linked Item</summary>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Use this to connect a real wardrobe piece or note the missing item this look still needs.
      </p>
      <form ref={formRef} action={createFormAction} className="mt-4 space-y-4">
        <input type="hidden" name="lookbook_entry_id" value={entryId} />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="Owned Garment"
            name="garment_id"
            options={[
              { value: "", label: "None, add missing piece instead" },
              ...garments.map((garment) => ({
                value: garment.id,
                label: garmentLabel(garment.id, garments)
              }))
            ]}
          />
          <Field label="Role" name="role" placeholder="outerwear, shoes, bag" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Missing Piece Title"
            name="desired_title"
            placeholder="Soft ivory trench"
          />
          <Field
            label="Missing Piece Category"
            name="desired_category"
            placeholder="coat"
          />
          <Field
            label="Missing Piece Notes"
            name="desired_notes"
            placeholder="lightweight, relaxed silhouette"
          />
        </div>
        <button
          type="submit"
          className="pw-button-quiet px-4 py-2 text-sm"
        >
          Add Linked Item
        </button>
        <FormFeedback state={createState} className="mt-3" />
      </form>
    </details>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        suppressHydrationWarning
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        suppressHydrationWarning
        className="min-h-28 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  defaultValue
}: {
  label: string;
  name: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <select
        suppressHydrationWarning
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        defaultValue={defaultValue ?? "manual"}
      >
        {options.map((option) => (
          <option
            key={typeof option === "string" ? option : option.value}
            value={typeof option === "string" ? option : option.value}
          >
            {typeof option === "string" ? option.replaceAll("_", " ") : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function LookbookMiniStat({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-white/82 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function sourceDomainLabel(sourceUrl: string | null) {
  if (!sourceUrl) {
    return "No source";
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return "Custom link";
  }
}

function garmentLabel(garmentId: string, garments: WardrobeLookupItem[]) {
  const garment = garments.find((candidate) => candidate.id === garmentId);

  if (!garment) {
    return garmentId;
  }

  return [garment.title || garment.category, garment.brand].filter(Boolean).join(" · ");
}

function desiredItemLabel(
  desiredItem: Record<string, unknown> | null | undefined
) {
  if (!desiredItem) {
    return "Missing piece";
  }

  const title = typeof desiredItem.title === "string" ? desiredItem.title : null;
  const category = typeof desiredItem.category === "string" ? desiredItem.category : null;
  const notes = typeof desiredItem.notes === "string" ? desiredItem.notes : null;

  return [title, category, notes].filter(Boolean).join(" · ") || "Missing piece";
}

function stringValue(value: Record<string, unknown> | null | undefined, key: string) {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate : "";
}

function SubmitButton({
  idle,
  pending,
  tone
}: {
  idle: string;
  pending: string;
  tone: "light";
}) {
  const { pending: isPending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={isPending}
      className={`pw-button-quiet px-4 py-2 text-sm disabled:transform-none disabled:opacity-60 disabled:shadow-none ${
        tone === "light" ? "bg-white/80" : ""
      }`}
    >
      {isPending ? pending : idle}
    </button>
  );
}
