import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { LookbookImageUpload } from "@/components/lookbook-image-upload";
import {
  listLookbookEntries,
  listWardrobeOptionsForLookbook
} from "@/lib/domain/lookbook/service";
import {
  createLookbookItemAction,
  createLookbookEntryAction,
  deleteLookbookItemAction,
  deleteLookbookEntryAction,
  updateLookbookEntryAction,
  updateLookbookItemAction
} from "@/app/lookbook/actions";

const sourceOptions = [
  "manual",
  "uploaded_image",
  "editorial_reference",
  "wishlist",
  "ai_generated",
  "outfit_reference"
] as const;

export default async function LookbookPage() {
  try {
    const [entries, garments] = await Promise.all([
      listLookbookEntries(),
      listWardrobeOptionsForLookbook()
    ]);

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.34em] text-[var(--muted)]">
            Lookbook
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span>{entries.length} saved references</span>
            <span className="text-[rgba(23,20,17,0.22)]">/</span>
            <span>
              {entries.reduce((total, entry) => total + entry.items.length, 0)} linked items
            </span>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          <form
            action={createLookbookEntryAction}
            className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6"
          >
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">Create Lookbook Entry</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Save inspiration, editorial references, wishlist pieces, or
                styling targets without treating them as owned garments.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" name="title" placeholder="Relaxed ivory tailoring" />
              <SelectField label="Source Type" name="source_type" options={sourceOptions} />
              <Field
                label="Source URL"
                name="source_url"
                placeholder="https://example.com/look"
                type="url"
              />
            </div>

            <div className="mt-4">
              <LookbookImageUpload
                name="image"
                accept="image/*"
                hint="Upload a look, editorial reference, outfit photo, or wishlist image."
              />
            </div>

            <div className="mt-4 grid gap-4">
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

            <button
              type="submit"
              className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)]"
            >
              Save Lookbook Entry
            </button>
          </form>

          <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold">Saved References</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"} in the
                current user lookbook.
              </p>
            </div>

            <div className="space-y-4">
              {entries.length ? (
                entries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold">
                          {entry.title || "Untitled reference"}
                        </h3>
                        <p className="text-sm text-[var(--muted)]">
                          {entry.source_type.replaceAll("_", " ")}
                        </p>
                      </div>

                      <form action={deleteLookbookEntryAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </form>
                    </div>

                    {entry.description ? (
                      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                        {entry.description}
                      </p>
                    ) : null}

                    {entry.preview_url ? (
                      <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-white">
                        <img
                          src={entry.preview_url}
                          alt={entry.title || "Lookbook reference image"}
                          className="h-72 w-full object-cover"
                        />
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4 text-sm text-[var(--muted)] md:grid-cols-2">
                      <InfoLine label="Aesthetic" value={entry.aesthetic_tags.join(", ")} />
                      <InfoLine label="Occasion" value={entry.occasion_tags.join(", ")} />
                      <InfoLine label="Source URL" value={entry.source_url || "n/a"} />
                      <InfoLine label="Image Path" value={entry.image_path || "n/a"} />
                    </div>

                    <details className="mt-4 rounded-[1rem] border border-[var(--line)] bg-white/70 p-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        Edit Entry
                      </summary>
                      <form action={updateLookbookEntryAction} className="mt-4 space-y-4">
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
                        <HiddenField name="image_path" value={entry.image_path || ""} />
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
                        <button
                          type="submit"
                          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
                        >
                          Update Entry
                        </button>
                      </form>
                    </details>

                    <section className="mt-5 rounded-[1rem] border border-[var(--line)] bg-white/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                          Linked Items
                        </h4>
                        <p className="text-xs text-[var(--muted)]">
                          Owned garments or missing pieces
                        </p>
                      </div>

                      <div className="mt-4 space-y-3">
                        {entry.items.length ? (
                          entry.items.map((item) => (
                            <article
                              key={item.id}
                              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2 text-sm text-[var(--muted)]">
                                  <p className="font-medium text-[var(--foreground)]">
                                    {item.garment_id
                                      ? garmentLabel(item.garment_id, garments)
                                      : desiredItemLabel(item.desired_item_json)}
                                  </p>
                                  {item.role ? <p>Role: {item.role}</p> : null}
                                  {item.garment_id ? (
                                    <p>Type: linked wardrobe garment</p>
                                  ) : (
                                    <p>Type: missing piece target</p>
                                  )}
                                </div>
                                <form action={deleteLookbookItemAction}>
                                  <input type="hidden" name="id" value={item.id} />
                                  <button
                                    type="submit"
                                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
                                  >
                                    Remove
                                  </button>
                                </form>
                              </div>

                              <details className="mt-4 rounded-2xl border border-[var(--line)] bg-white/70 p-4">
                                <summary className="cursor-pointer text-sm font-medium">
                                  Edit Linked Item
                                </summary>
                                <form action={updateLookbookItemAction} className="mt-4 space-y-4">
                                  <input type="hidden" name="id" value={item.id} />
                                  <input
                                    type="hidden"
                                    name="lookbook_entry_id"
                                    value={entry.id}
                                  />
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <SelectField
                                      label="Owned Garment"
                                      name="garment_id"
                                      options={[
                                        {
                                          value: "",
                                          label: "None, keep as missing piece"
                                        },
                                        ...garments.map((garment) => ({
                                          value: garment.id,
                                          label: garmentLabel(garment.id, garments)
                                        }))
                                      ]}
                                      defaultValue={item.garment_id || ""}
                                    />
                                    <Field
                                      label="Role"
                                      name="role"
                                      defaultValue={item.role || ""}
                                    />
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
                                      defaultValue={stringValue(
                                        item.desired_item_json,
                                        "category"
                                      )}
                                    />
                                    <Field
                                      label="Missing Piece Notes"
                                      name="desired_notes"
                                      defaultValue={stringValue(item.desired_item_json, "notes")}
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
                                  >
                                    Update Linked Item
                                  </button>
                                </form>
                              </details>
                            </article>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--muted)]">
                            No linked items yet.
                          </p>
                        )}
                      </div>

                      <form action={createLookbookItemAction} className="mt-4 space-y-4">
                        <input type="hidden" name="lookbook_entry_id" value={entry.id} />
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
                          <Field
                            label="Role"
                            name="role"
                            placeholder="outerwear, shoes, bag"
                          />
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
                          className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium"
                        >
                          Add Linked Item
                        </button>
                      </form>
                    </section>
                  </article>
                ))
              ) : (
                <p className="rounded-[1.25rem] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--muted)]">
                  No lookbook entries yet. Save the first reference, wishlist item,
                  or styling target above.
                </p>
              )}
            </div>
          </section>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/lookbook"
          title="Sign in with Supabase to use the lookbook workspace."
          description="Lookbook entries are user-owned records protected by RLS, so this page requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
};

function Field({ label, name, type = "text", placeholder, defaultValue }: FieldProps) {
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
  placeholder,
  defaultValue
}: Omit<FieldProps, "type">) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        suppressHydrationWarning
        className="min-h-28 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
        name={name}
        placeholder={placeholder}
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
            {typeof option === "string"
              ? option.replaceAll("_", " ")
              : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-[var(--foreground)]">{label}:</span>{" "}
      {value || "n/a"}
    </p>
  );
}

function garmentLabel(
  garmentId: string,
  garments: { id: string; title: string | null; category: string; brand: string | null }[]
) {
  const garment = garments.find((candidate) => candidate.id === garmentId);

  if (!garment) {
    return garmentId;
  }

  return [garment.title || garment.category, garment.brand].filter(Boolean).join(" · ");
}

function desiredItemLabel(
  desiredItem:
    | Record<string, unknown>
    | null
    | undefined
) {
  if (!desiredItem) {
    return "Missing piece";
  }

  const title = typeof desiredItem.title === "string" ? desiredItem.title : null;
  const category =
    typeof desiredItem.category === "string" ? desiredItem.category : null;
  const notes = typeof desiredItem.notes === "string" ? desiredItem.notes : null;

  return [title, category, notes].filter(Boolean).join(" · ") || "Missing piece";
}

function HiddenField({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

function stringValue(
  value: Record<string, unknown> | null | undefined,
  key: string
) {
  const candidate = value?.[key];
  return typeof candidate === "string" ? candidate : "";
}
