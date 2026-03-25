"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { acceptDraftAction, rejectDraftAction } from "./actions";
import type { PendingDraft } from "@/lib/domain/ingestion/service";

interface Props {
  drafts: PendingDraft[];
  initialLatestBatchOnly?: boolean;
}

export default function DraftReviewList({
  drafts,
  initialLatestBatchOnly = false
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [latestBatchOnly, setLatestBatchOnly] = useState(initialLatestBatchOnly);
  const [edits, setEdits] = useState<Record<string, {
    title: string;
    category: string;
    colour: string;
    brand: string;
    material: string;
    style: string;
    notes: string;
    retailer: string;
    purchase_price: string;
    purchase_currency: string;
  }>>(
    Object.fromEntries(
      drafts.map((draft) => [
        draft.id,
        {
          title: draft.payload.title || draft.payload.tag || "",
          category: draft.payload.category || "",
          colour: draft.payload.colour || "",
          brand: draft.payload.brand || "",
          material: draft.payload.material || "",
          style: draft.payload.style || "",
          notes: draft.payload.notes || "",
          retailer: draft.payload.retailer || "",
          purchase_price:
            typeof draft.payload.purchase_price === "number"
              ? String(draft.payload.purchase_price)
              : "",
          purchase_currency: draft.payload.purchase_currency || ""
        }
      ])
    )
  );

  const remaining = drafts.filter((d) => !actionedIds.has(d.id));
  const groupedDrafts = groupDraftsByBatch(remaining);
  const visibleGroups = latestBatchOnly ? groupedDrafts.slice(0, 1) : groupedDrafts;

  useEffect(() => {
    setLatestBatchOnly(initialLatestBatchOnly);
  }, [initialLatestBatchOnly]);

  function markActioned(id: string) {
    setActionedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // Redirect to wardrobe when all drafts have been actioned
  useEffect(() => {
    if (drafts.length > 0 && actionedIds.size === drafts.length) {
      router.push("/wardrobe");
    }
  }, [actionedIds, drafts.length, router]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (latestBatchOnly) {
      params.set("latest", "1");
    } else {
      params.delete("latest");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl as never, { scroll: false });
    }
  }, [latestBatchOnly, pathname, router, searchParams]);

  function handleAccept(draftId: string) {
    setPendingId(draftId);
    acceptDraftAction({
      draftId,
      ...edits[draftId],
      purchase_price:
        edits[draftId].purchase_price.trim().length > 0
          ? Number(edits[draftId].purchase_price)
          : undefined,
      purchase_currency:
        edits[draftId].purchase_currency.trim().length > 0
          ? edits[draftId].purchase_currency.trim().toUpperCase()
          : undefined
    }).then((result) => {
      setPendingId(null);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  function handleReject(draftId: string) {
    setPendingId(draftId);
    rejectDraftAction(draftId).then((result) => {
      setPendingId(null);
      if (result.status === "error") {
        setErrors((prev) => ({ ...prev, [draftId]: result.message }));
      } else {
        markActioned(draftId);
      }
    });
  }

  if (remaining.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--muted)]">No pending drafts.</p>
        <a href="/" className="mt-4 text-sm text-[var(--accent)] underline">
          Upload a photo to get started
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupedDrafts.length > 1 ? (
        <div className="pw-panel-soft flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
              Review Scope
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Focus on your newest import first, or keep earlier pending drafts visible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLatestBatchOnly((value) => !value)}
            className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] transition-colors ${
              latestBatchOnly
                ? "bg-[var(--accent-strong)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--foreground)]"
            }`}
          >
            {latestBatchOnly ? "Showing Latest Only" : "Show Latest Only"}
          </button>
        </div>
      ) : null}
      {visibleGroups.map((group) => (
        <section key={group.label} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                {group.label}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {group.description}
              </p>
            </div>
            <span className="pw-chip border-[rgba(123,92,240,0.18)] bg-[rgba(123,92,240,0.1)] text-[var(--accent-strong)]">
              {group.drafts.length} {group.drafts.length === 1 ? "draft" : "drafts"}
            </span>
          </div>
          {group.drafts.map((draft) => {
        const isLowConfidence = draft.payload.confidence < 0.6;
        const error = errors[draft.id];
        const draftEdit = edits[draft.id];
        const isWeakExtraction =
          draft.payload.extraction_source === "filename fallback" ||
          draft.payload.extraction_source === "URL fallback";
        const isWeakPhotoDraft =
          draft.payload.source_type === "direct_upload" &&
          isLowConfidence &&
          !isWeakExtraction;
        const photoJumpField =
          !draftEdit.category.trim() || draft.payload.category.trim().length === 0
            ? "category"
            : "colour";

        return (
          <div
            key={draft.id}
            className="grid gap-5 rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.88)] p-5 shadow-[0_18px_40px_rgba(45,27,105,0.08)] md:grid-cols-[96px_1fr_auto]"
            style={{ opacity: isLowConfidence ? 0.85 : 1 }}
          >
            <div className="relative flex h-[118px] w-[96px] items-center justify-center overflow-hidden rounded-xl bg-[rgba(123,92,240,0.08)] text-center text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {draft.preview_url && draft.preview_kind === "image" ? (
                <>
                  <DraftPreviewImage
                    src={draft.preview_url}
                    alt={draft.payload.title || draft.payload.tag}
                    bbox={draft.payload.bbox}
                    sourceWidth={draft.source_image_width}
                    sourceHeight={draft.source_image_height}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(15,13,26,0.82))] px-2 py-2 text-[9px] tracking-[0.16em] text-white">
                    {sourceLabel(draft.payload.source_type)}
                  </div>
                </>
              ) : draft.preview_kind === "document" ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                  <DocumentIcon />
                  <span>{sourceLabel(draft.payload.source_type)}</span>
                </div>
              ) : (
                sourceLabel(draft.payload.source_type)
              )}
            </div>

            {/* Garment details */}
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-[var(--foreground)]">
                  {draft.payload.source_label || draft.payload.tag}
                </p>
                <span className="pw-chip border-[rgba(123,92,240,0.18)] bg-[rgba(123,92,240,0.1)] text-[var(--accent-strong)]">
                  {sourceLabel(draft.payload.source_type)}
                </span>
                {draft.payload.extraction_source ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
                      isWeakExtraction
                        ? "border border-[rgba(208,80,60,0.22)] bg-[rgba(255,237,232,0.92)] text-[#b24a35]"
                        : "border border-[rgba(123,92,240,0.16)] bg-[rgba(123,92,240,0.08)] text-[var(--accent-strong)]"
                    }`}
                  >
                    {draft.payload.extraction_source}
                  </span>
                ) : null}
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["category", draft.payload.category],
                    ["colour", draft.payload.colour],
                    ["brand", draft.payload.brand],
                    ["material", draft.payload.material],
                    ["style", draft.payload.style],
                    ["retailer", draft.payload.retailer],
                  ] as [string, string | null][]
                )
                  .filter(([, value]) => Boolean(value))
                  .map(([field, value]) => (
                    <span
                      key={field}
                      className="rounded-full bg-[rgba(45,27,105,0.06)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]"
                    >
                      {value}
                    </span>
                  ))}
              </div>
              <p
                className={`text-[11px] ${isLowConfidence ? "text-[var(--accent-secondary)]" : "text-[var(--muted)]"}`}
              >
                Confidence: {Math.round(draft.payload.confidence * 100)}%
                {isLowConfidence && " · low confidence"}
              </p>
              {isWeakExtraction ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-[#b24a35]">
                    {draft.payload.extraction_source === "URL fallback"
                      ? "This draft came mostly from the URL itself. Pasting a cleaner product title or using a richer retailer page will improve brand, item, and price extraction."
                      : "This draft came from the filename only. Paste receipt text or retry with a clearer text-readable receipt for better item, brand, and price extraction."}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      focusField(
                        draft.payload.extraction_source === "URL fallback"
                          ? fieldId(draft.id, "title")
                          : fieldId(draft.id, "retailer")
                      )
                    }
                    className="rounded-full border border-[rgba(178,74,53,0.18)] bg-[rgba(255,237,232,0.92)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[#b24a35] transition-colors hover:bg-[rgba(255,228,221,0.96)]"
                  >
                    {draft.payload.extraction_source === "URL fallback"
                      ? "Jump To Title"
                      : "Jump To Retailer"}
                  </button>
                </div>
              ) : null}
              {isWeakPhotoDraft ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-[var(--accent-strong)]">
                    This photo draft is low-confidence. Start by checking the category and colour
                    before accepting it into your wardrobe.
                  </p>
                  <button
                    type="button"
                    onClick={() => focusField(fieldId(draft.id, photoJumpField))}
                    className="rounded-full border border-[rgba(123,92,240,0.18)] bg-[rgba(123,92,240,0.1)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--accent-strong)] transition-colors hover:bg-[rgba(123,92,240,0.14)]"
                  >
                    {photoJumpField === "category" ? "Jump To Category" : "Jump To Colour"}
                  </button>
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field
                  id={fieldId(draft.id, "title")}
                  label="Title"
                  value={draftEdit.title}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], title: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "category")}
                  label="Category"
                  value={draftEdit.category}
                  placeholder="top, trousers, blazer"
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], category: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "colour")}
                  label="Colour"
                  value={draftEdit.colour}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], colour: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "brand")}
                  label="Brand"
                  value={draftEdit.brand}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], brand: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "material")}
                  label="Material"
                  value={draftEdit.material}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], material: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "style")}
                  label="Style Notes"
                  value={draftEdit.style}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], style: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "retailer")}
                  label="Retailer"
                  value={draftEdit.retailer}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], retailer: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "purchase_price")}
                  label="Price"
                  type="number"
                  step="0.01"
                  value={draftEdit.purchase_price}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], purchase_price: value }
                    }))
                  }
                />
                <Field
                  id={fieldId(draft.id, "purchase_currency")}
                  label="Currency"
                  value={draftEdit.purchase_currency}
                  placeholder="AUD"
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], purchase_currency: value }
                    }))
                  }
                />
              </div>
              <div className="mt-3">
                <TextAreaField
                  label="Review Notes"
                  value={draftEdit.notes}
                  onChange={(value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [draft.id]: { ...prev[draft.id], notes: value }
                    }))
                  }
                />
              </div>
              {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleAccept(draft.id)}
                disabled={pendingId === draft.id}
                className="pw-button-primary px-5 py-2 text-xs disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => handleReject(draft.id)}
                disabled={pendingId === draft.id}
                className="pw-button-quiet px-5 py-2 text-xs text-[var(--muted)] disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
        </section>
      ))}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  placeholder,
  type = "text",
  step,
  onChange
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "number";
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-[12px] text-[var(--muted)]">
      <span className="font-medium">{label}</span>
      <input
        id={id}
        value={value}
        type={type}
        step={step}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
      />
    </label>
  );
}

function fieldId(draftId: string, field: string) {
  return `draft-${draftId}-${field}`;
}

function focusField(id: string) {
  if (typeof document === "undefined") {
    return;
  }

  const element = document.getElementById(id);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function groupDraftsByBatch(drafts: PendingDraft[]) {
  const sourceOrder = Array.from(
    new Map(
      drafts
        .slice()
        .sort(
          (left, right) =>
            new Date(right.source_created_at ?? right.created_at).getTime() -
            new Date(left.source_created_at ?? left.created_at).getTime()
        )
        .map((draft) => [draft.sourceId, draft.source_created_at ?? draft.created_at])
    ).entries()
  );

  const latestSourceId = sourceOrder[0]?.[0] ?? null;
  const latestDrafts = latestSourceId
    ? drafts.filter((draft) => draft.sourceId === latestSourceId)
    : [];
  const earlierDrafts = latestSourceId
    ? drafts.filter((draft) => draft.sourceId !== latestSourceId)
    : drafts;

  return [
    latestDrafts.length
      ? {
          label: "Latest Batch",
          description: "Your newest upload or import is ready to review first.",
          drafts: latestDrafts
        }
      : null,
    earlierDrafts.length
      ? {
          label: "Earlier Pending",
          description: "Older drafts are kept here until you accept or reject them.",
          drafts: earlierDrafts
        }
      : null
  ].filter(
    (
      value
    ): value is { label: string; description: string; drafts: PendingDraft[] } =>
      Boolean(value)
  );
}

function DocumentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 text-[#8b8177]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3.75h7l5 5V20.25A1.75 1.75 0 0 1 17.25 22H7A1.75 1.75 0 0 1 5.25 20.25V5.5A1.75 1.75 0 0 1 7 3.75Z" />
      <path d="M14 3.75v5h5" />
      <path d="M8.5 13h7" />
      <path d="M8.5 16.5h5" />
    </svg>
  );
}

function DraftPreviewImage({
  src,
  alt,
  bbox,
  sourceWidth,
  sourceHeight
}: {
  src: string;
  alt: string;
  bbox: [number, number, number, number] | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
}) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    sourceWidth && sourceHeight ? { width: sourceWidth, height: sourceHeight } : null
  );

  useEffect(() => {
    if (sourceWidth && sourceHeight) {
      setDimensions({ width: sourceWidth, height: sourceHeight });
    }
  }, [sourceHeight, sourceWidth]);

  if (!bbox || !dimensions) {
    return (
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        onLoad={(event) => {
          const target = event.currentTarget;
          setDimensions({
            width: target.naturalWidth,
            height: target.naturalHeight
          });
        }}
      />
    );
  }

  const [x1, y1, x2, y2] = bbox;
  const cropWidth = Math.max(x2 - x1, 1);
  const cropHeight = Math.max(y2 - y1, 1);
  const scale = Math.max(96 / cropWidth, 118 / cropHeight);
  const scaledWidth = dimensions.width * scale;
  const scaledHeight = dimensions.height * scale;
  const offsetX = Math.min(
    Math.max(x1 * scale - (96 - cropWidth * scale) / 2, 0),
    Math.max(scaledWidth - 96, 0)
  );
  const offsetY = Math.min(
    Math.max(y1 * scale - (118 - cropHeight * scale) / 2, 0),
    Math.max(scaledHeight - 118, 0)
  );

  return (
    <img
      src={src}
      alt={alt}
      className="max-w-none"
      style={{
        width: scaledWidth,
        height: scaledHeight,
        transform: `translate(${-offsetX}px, ${-offsetY}px)`
      }}
    />
  );
}

function TextAreaField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-[12px] text-[#6f665d]">
      <span className="font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
      />
    </label>
  );
}

function sourceLabel(sourceType: string) {
  return sourceType.replaceAll("_", " ");
}
