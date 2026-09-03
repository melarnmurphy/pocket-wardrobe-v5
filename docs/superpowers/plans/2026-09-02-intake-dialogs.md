# Intake Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four buildable "missing" dialogs from `docs/design/design_handoff_garderobe/MODALS.md` §3 ("Getting pieces in"): photo library permission, notification permission, upload failed / unsupported file, and "this receipt matches three pieces" — the fifth item in that section, "disconnect a resale account," is out of scope (see below).

**Architecture:** Every new dialog is a standalone component under `components/garderobe/wardrobe/`, built on the existing `Dialog` (`components/garderobe/dialog.tsx`) and `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) primitives, matching the visual and copy conventions of `components/garderobe/wardrobe/*` from the prior wardrobe-dialogs phase. Upload/URL failures gain a structured `errorCode` on `WardrobeActionState` so the UI can choose the right dialog copy instead of pattern-matching a raw error string. The receipt-ambiguity resolver follows the existing `duplicate_hint` precedent in `lib/domain/ingestion/service.ts` (a hint attached to `garment_drafts.draft_payload_json` after the draft is created, read back by `listPendingDrafts`, rendered by `draft-review-list.tsx`) rather than a new table.

**Tech Stack:** Next.js App Router server actions, Zod validation, Supabase/Postgres, Vitest, React Testing Library.

**Spec:** `docs/design/design_handoff_garderobe/MODALS.md` §3 and its "Standing rules for anything built from this list" section at the bottom of the same file.

## Out of scope

`docs/design/design_handoff_garderobe/MODALS.md` §3 also marks **"disconnect a resale account"** as missing. There is no resale-account-connection feature anywhere in this codebase to disconnect from: `app/wardrobe/sources/page.tsx` explicitly says "Not connected — depop and vestiaire don't offer a way to connect an account safely yet" and the whole repo has zero `listConnections`/`upsertConnection`/OAuth code (confirmed by grep). Building a disconnect dialog for a connect feature that doesn't exist would invent the feature this plan is explicitly here to avoid inventing. Skip it; a future phase that ships resale OAuth should design this dialog alongside it.

## Global Constraints

- Australian English, no em dashes, in all new UI copy (`~/.claude/CLAUDE.md`).
- Every new dialog/sheet is built on `Dialog` (`components/garderobe/dialog.tsx`) or `BottomSheet`/`SheetAction` (`components/garderobe/bottom-sheet.tsx`) — extend a primitive's props if a mockup needs something it can't currently do; don't fork a new one-off overlay pattern.
- Standing rule 3: a dialog asks one question; if it needs two answers it is a sheet.
- Standing rule 4: permission prompts explain the trade before the system prompt appears, in one sentence, with a way to continue without granting it.
- Standing rule 5: low confidence is a question, not a fact — dashed chips, never a silent guess. The receipt-match resolver never auto-attaches a price; it always asks.
- Standing rule 6: price is optional; a null price never renders as A$0.
- Server actions that already exist follow `(previousState: WardrobeActionState, formData: FormData) => Promise<WardrobeActionState>`; new ones in `app/wardrobe/actions.ts` follow the same shape. `app/wardrobe/review/actions.ts` actions take plain arguments instead (`acceptDraftAction(input)`, `rejectDraftAction(draftId)`) — match whichever file a new action lives in.

---

## Task 1: `errorCode` on `WardrobeActionState`, and shared upload-limits module

**Files:**
- Modify: `lib/domain/wardrobe/action-state.ts`
- Create: `lib/domain/ingestion/limits.ts`
- Test: `lib/domain/ingestion/__tests__/limits.test.ts`

**Interfaces:**
- Produces: `WardrobeActionState.errorCode?: "unsupported_format" | "too_large" | "dead_url"`; `SUPPORTED_IMAGE_MIME_TYPES: readonly string[]`, `MAX_UPLOAD_BYTES: number`, `classifyUploadFile(file: { type: string; size: number }): "ok" | "unsupported_format" | "too_large"` from `lib/domain/ingestion/limits.ts` — consumed by Task 2.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/domain/ingestion/__tests__/limits.test.ts
import { describe, it, expect } from "vitest";
import { classifyUploadFile, MAX_UPLOAD_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/domain/ingestion/limits";

describe("classifyUploadFile", () => {
  it("accepts a normal jpeg under the size cap", () => {
    expect(classifyUploadFile({ type: "image/jpeg", size: 1_000_000 })).toBe("ok");
  });

  it("rejects HEIC as an unsupported format", () => {
    expect(classifyUploadFile({ type: "image/heic", size: 1_000_000 })).toBe("unsupported_format");
  });

  it("rejects HEIF as an unsupported format", () => {
    expect(classifyUploadFile({ type: "image/heif", size: 1_000_000 })).toBe("unsupported_format");
  });

  it("rejects a file over the size cap even if the format is supported", () => {
    expect(classifyUploadFile({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toBe("too_large");
  });

  it("exports the supported list with jpeg, png and webp", () => {
    expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/jpeg");
    expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/png");
    expect(SUPPORTED_IMAGE_MIME_TYPES).toContain("image/webp");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/ingestion/__tests__/limits.test.ts`
Expected: FAIL — `lib/domain/ingestion/limits.ts` does not exist.

- [ ] **Step 3: Implement**

```typescript
// lib/domain/ingestion/limits.ts

/**
 * "Upload failed / unsupported file — HEIC, size caps, a dead product URL"
 * (MODALS.md §3). HEIC/HEIF decode inconsistently across browsers and the
 * pipeline service never learned to read them, so they are rejected before
 * upload rather than failing further down with an opaque storage error.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** 20MB — comfortably above a phone photo, well below what the pipeline chokes on. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function classifyUploadFile(file: {
  type: string;
  size: number;
}): "ok" | "unsupported_format" | "too_large" {
  if (!SUPPORTED_IMAGE_MIME_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number])) {
    return "unsupported_format";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "too_large";
  }
  return "ok";
}
```

```typescript
// lib/domain/wardrobe/action-state.ts — add errorCode to the existing type:
export type WardrobeActionState = {
  status: "idle" | "success" | "error" | "partial" | "blocked";
  message: string | null;
  garmentId?: string;
  draftIds?: string[];
  nextPath?: string;
  blocked?: { activeOutfitCount: number; activeListingId: string | null };
  /**
   * "Upload failed / unsupported file" (MODALS.md §3) — lets the UI pick
   * dedicated copy instead of showing whatever raw Error.message surfaced.
   */
  errorCode?: "unsupported_format" | "too_large" | "dead_url";
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/ingestion/__tests__/limits.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/domain/ingestion/limits.ts lib/domain/wardrobe/action-state.ts lib/domain/ingestion/__tests__/limits.test.ts
git commit -m "Add an errorCode to WardrobeActionState and a shared upload-limits module."
```

---

## Task 2: Validate uploads and detect a dead product URL in the server actions

**Files:**
- Modify: `app/wardrobe/actions.ts` (`createPhotoDraftAction` at line 338, `addGarmentImageAction` at line 605, `createReceiptDraftAction` at line 502, `createProductUrlDraftAction` at line 423)
- Modify: `lib/domain/ingestion/extractors.ts` (`ProductMetadata` type, `extractProductMetadataFromUrl`)
- Test: `app/wardrobe/__tests__/actions.test.ts` (extend)

**Interfaces:**
- Consumes: `classifyUploadFile` from Task 1.
- Produces: `ProductMetadata.fetch_failed?: boolean` — `true` only when the remote fetch itself failed (non-2xx response or a thrown network/timeout error), never when the page loaded but had sparse metadata. `createPhotoDraftAction`, `addGarmentImageAction`, `createReceiptDraftAction` now return `{ status: "error", errorCode: "unsupported_format" | "too_large", message }` before any upload is attempted when the file fails `classifyUploadFile`. `createProductUrlDraftAction` returns `{ status: "error", errorCode: "dead_url", message }` when `extracted.fetch_failed` is true, instead of creating a low-quality draft.

- [ ] **Step 1: Write the failing tests**

```typescript
// append to app/wardrobe/__tests__/actions.test.ts

function fileOfType(type: string, size: number, name = "photo") {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("createPhotoDraftAction validation", () => {
  it("rejects a HEIC file before attempting to upload it", async () => {
    const { createPhotoDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("image", fileOfType("image/heic", 1000));

    const result = await createPhotoDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("unsupported_format");
  });

  it("rejects a file over the size cap", async () => {
    const { createPhotoDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("image", fileOfType("image/jpeg", 21 * 1024 * 1024));

    const result = await createPhotoDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("too_large");
  });
});

describe("addGarmentImageAction validation", () => {
  it("rejects a HEIC file before attempting to upload it", async () => {
    const { addGarmentImageAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("garment_id", "00000000-0000-0000-0000-000000000001");
    formData.set("image", fileOfType("image/heic", 1000));

    const result = await addGarmentImageAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("unsupported_format");
  });
});

describe("createReceiptDraftAction validation", () => {
  it("rejects an unsupported receipt file type", async () => {
    const { createReceiptDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("receipt", fileOfType("image/heic", 1000, "receipt"));

    const result = await createReceiptDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("unsupported_format");
  });
});

describe("createProductUrlDraftAction dead link handling", () => {
  it("returns a dead_url error instead of creating a draft when the fetch failed", async () => {
    vi.doMock("@/lib/domain/ingestion/extractors", async () => {
      const actual = await vi.importActual("@/lib/domain/ingestion/extractors");
      return {
        ...actual,
        extractProductMetadataFromUrl: vi.fn(async () => ({
          title: null, brand: null, category: null, colour: null, fit: null,
          material: null, retailer: "example.com", description: null, price: null,
          currency: null, image_url: null, attributes: [], styling_suggestions: [],
          fetch_failed: true
        }))
      };
    });
    const { createProductUrlDraftAction } = await import("@/app/wardrobe/actions");
    const formData = new FormData();
    formData.set("product_url", "https://example.com/dead-product");

    const result = await createProductUrlDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("dead_url");
    vi.doUnmock("@/lib/domain/ingestion/extractors");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts`
Expected: FAIL — none of the four actions read `classifyUploadFile` or `fetch_failed` yet.

- [ ] **Step 3: Add `fetch_failed` to `ProductMetadata` and set it in the two failure branches**

```typescript
// lib/domain/ingestion/extractors.ts — ProductMetadata gains one field:
export type ProductMetadata = {
  title: string | null;
  brand: string | null;
  category: string | null;
  colour: string | null;
  fit: string | null;
  material: string | null;
  retailer: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  image_url: string | null;
  attributes: GarmentAttribute[];
  styling_suggestions: StylingSuggestion[];
  /** True only when the remote fetch itself failed (non-2xx or thrown) — never for a page that loaded with sparse metadata. */
  fetch_failed?: boolean;
};
```

In the `!response.ok` branch (around line 173) add `fetch_failed: true` to the returned object. In the outer `catch` block (around line 273) add `fetch_failed: true` to that returned object too. Leave the success path alone (it never sets the field, so it defaults to falsy/undefined for existing callers).

- [ ] **Step 4: Validate uploads in `createPhotoDraftAction`, `addGarmentImageAction`, `createReceiptDraftAction`, and check `fetch_failed` in `createProductUrlDraftAction`**

```typescript
// app/wardrobe/actions.ts — add to the imports:
import { classifyUploadFile } from "@/lib/domain/ingestion/limits";

// createPhotoDraftAction — right after the existing
//   if (!(file instanceof File) || file.size === 0) { ... }
// check, add:
    const uploadCheck = classifyUploadFile(file);
    if (uploadCheck !== "ok") {
      return {
        status: "error",
        errorCode: uploadCheck,
        message:
          uploadCheck === "unsupported_format"
            ? "That file type won't open. Garderobe reads JPEG, PNG and WEBP."
            : "That photo's too large. Photos over 20MB won't upload."
      };
    }

// addGarmentImageAction — same check, right after its own
//   if (!(file instanceof File) || file.size === 0) { ... }
    const uploadCheck = classifyUploadFile(file);
    if (uploadCheck !== "ok") {
      return {
        status: "error",
        errorCode: uploadCheck,
        message:
          uploadCheck === "unsupported_format"
            ? "That file type won't open. Garderobe reads JPEG, PNG and WEBP."
            : "That photo's too large. Photos over 20MB won't upload."
      };
    }

// createReceiptDraftAction — same check, right after its own
//   if (!(file instanceof File) || file.size === 0) { ... }
// but receipts also allow PDF, so widen the check for this one call site only:
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      const uploadCheck = classifyUploadFile(file);
      if (uploadCheck !== "ok") {
        return {
          status: "error",
          errorCode: uploadCheck,
          message:
            uploadCheck === "unsupported_format"
              ? "That file type won't open. Garderobe reads JPEG, PNG, WEBP and PDF receipts."
              : "That file's too large. Files over 20MB won't upload."
        };
      }
    }
```

```typescript
// createProductUrlDraftAction — right after
//   const extracted = await extractProductMetadataFromUrl(values.product_url);
// add:
    if (extracted.fetch_failed) {
      return {
        status: "error",
        errorCode: "dead_url",
        message: "That link didn't load, so nothing came back automatically. Add the piece's details yourself instead."
      };
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run app/wardrobe/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/wardrobe/actions.ts lib/domain/ingestion/extractors.ts app/wardrobe/__tests__/actions.test.ts
git commit -m "Reject unsupported/oversized uploads and dead product URLs before they reach storage."
```

---

## Task 3: `UploadFailedDialog` and wiring into the choose-photos and piece-detail flows

**Files:**
- Create: `components/garderobe/wardrobe/upload-failed-dialog.tsx`
- Modify: `app/wardrobe/batch/new/page.tsx`
- Modify: `components/wardrobe-shop.tsx` (the re-upload/add-image form inside `GarmentDetailDialog`)
- Test: `components/garderobe/wardrobe/__tests__/upload-failed-dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` from `components/garderobe/dialog.tsx`.
- Produces: `<UploadFailedDialog open errorCode="unsupported_format"|"too_large"|"dead_url" onClose onRetry />`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/garderobe/wardrobe/__tests__/upload-failed-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UploadFailedDialog } from "@/components/garderobe/wardrobe/upload-failed-dialog";

describe("UploadFailedDialog", () => {
  it("shows HEIC-specific copy for an unsupported format", () => {
    render(
      <UploadFailedDialog open errorCode="unsupported_format" onClose={() => {}} onRetry={() => {}} />
    );
    expect(screen.getByText(/that file type won't open/i)).toBeInTheDocument();
  });

  it("shows a size-cap message for too_large", () => {
    render(<UploadFailedDialog open errorCode="too_large" onClose={() => {}} onRetry={() => {}} />);
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
  });

  it("offers 'add manually' for a dead url, and calls onRetry when chosen", () => {
    const onRetry = vi.fn();
    render(<UploadFailedDialog open errorCode="dead_url" onClose={() => {}} onRetry={onRetry} />);
    fireEvent.click(screen.getByText(/add manually/i));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/upload-failed-dialog.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/wardrobe/upload-failed-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type UploadFailedDialogProps = {
  open: boolean;
  errorCode: "unsupported_format" | "too_large" | "dead_url";
  onClose: () => void;
  onRetry: () => void;
};

const COPY: Record<
  UploadFailedDialogProps["errorCode"],
  { title: string; description: string; confirmLabel: string }
> = {
  unsupported_format: {
    title: "that file type won't open",
    description:
      "Garderobe reads JPEG, PNG and WEBP. A HEIC photo needs converting first, most phones can do this from the share sheet when you save or send it.",
    confirmLabel: "choose another photo"
  },
  too_large: {
    title: "that photo's too large",
    description: "Photos over 20MB won't upload. Try a smaller export, or a screenshot instead.",
    confirmLabel: "choose another photo"
  },
  dead_url: {
    title: "couldn't open that link",
    description:
      "The page didn't load, so nothing came back automatically. Add the piece's details yourself instead.",
    confirmLabel: "add manually"
  }
};

/** MODALS.md §3 — "upload failed / unsupported file": HEIC, size caps, a dead product URL. */
export function UploadFailedDialog({ open, errorCode, onClose, onRetry }: UploadFailedDialogProps) {
  const copy = COPY[errorCode];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      cancelLabel="cancel"
      confirmLabel={copy.confirmLabel}
      onConfirm={onRetry}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/upload-failed-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire into the choose-photos page**

In `app/wardrobe/batch/new/page.tsx`, the `handleSubmit` function currently sets `error` to a plain string from `body.error`. Read the response body's shape from `/api/pipeline/batch` — if that endpoint does not already return a structured code, leave its plain-string path as the generic fallback, and instead add client-side pre-validation before the fetch call using the same rule the server enforces:

```tsx
// app/wardrobe/batch/new/page.tsx — add imports:
import { UploadFailedDialog } from "@/components/garderobe/wardrobe/upload-failed-dialog";
import { classifyUploadFile } from "@/lib/domain/ingestion/limits";

// add state alongside the existing useState calls:
  const [uploadErrorCode, setUploadErrorCode] = useState<
    "unsupported_format" | "too_large" | null
  >(null);

// replace the body of addFiles with a version that classifies each file first:
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

// render, alongside the other dialogs at the bottom of the component's JSX:
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
```

- [ ] **Step 6: Wire into the piece-detail re-upload form**

In `components/wardrobe-shop.tsx`, find the `addGarmentImageFormAction`/`featureImageFormAction` usage inside `GarmentDetailDialog` (the re-upload control gated by `showReupload`). Add an effect that watches the relevant action state's `errorCode` and opens `UploadFailedDialog`:

```tsx
// components/wardrobe-shop.tsx — inside GarmentDetailDialog, add:
import { UploadFailedDialog } from "@/components/garderobe/wardrobe/upload-failed-dialog";

// alongside the other useState calls in GarmentDetailDialog:
  const [imageUploadDialogCode, setImageUploadDialogCode] = useState<
    "unsupported_format" | "too_large" | null
  >(null);
  const [imageState, imageFormAction] = useActionState(addGarmentImageAction, wardrobeActionState);

  useEffect(() => {
    if (
      imageState.status === "error" &&
      (imageState.errorCode === "unsupported_format" || imageState.errorCode === "too_large")
    ) {
      setImageUploadDialogCode(imageState.errorCode);
    }
  }, [imageState.status, imageState.errorCode]);

// rendered near the re-upload form:
      {imageUploadDialogCode ? (
        <UploadFailedDialog
          open
          errorCode={imageUploadDialogCode}
          onClose={() => setImageUploadDialogCode(null)}
          onRetry={() => setImageUploadDialogCode(null)}
        />
      ) : null}
```

Note: `imageFormAction` must be attached to the re-upload `<form action={imageFormAction}>` the same way the file's other `useActionState` results are already wired to their forms — follow the exact pattern already used for `assetFormAction`/`featureImageFormAction` a few lines above in the same component.

- [ ] **Step 7: Commit**

```bash
git add components/garderobe/wardrobe/upload-failed-dialog.tsx components/garderobe/wardrobe/__tests__/upload-failed-dialog.test.tsx app/wardrobe/batch/new/page.tsx components/wardrobe-shop.tsx
git commit -m "Add the upload failed / unsupported file dialog and wire it into photo intake."
```

---

## Task 4: `PhotoLibraryPermissionDialog` on the choose-photos page

**Files:**
- Create: `components/garderobe/wardrobe/photo-library-permission-dialog.tsx`
- Modify: `app/wardrobe/batch/new/page.tsx`
- Test: `components/garderobe/wardrobe/__tests__/photo-library-permission-dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` from `components/garderobe/dialog.tsx`.
- Produces: `<PhotoLibraryPermissionDialog open onAllow onNotNow />`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/garderobe/wardrobe/__tests__/photo-library-permission-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoLibraryPermissionDialog } from "@/components/garderobe/wardrobe/photo-library-permission-dialog";

describe("PhotoLibraryPermissionDialog", () => {
  it("explains the trade in one line and offers 'not now'", () => {
    render(<PhotoLibraryPermissionDialog open onAllow={() => {}} onNotNow={() => {}} />);
    expect(screen.getByText(/garderobe needs your photos/i)).toBeInTheDocument();
    expect(screen.getByText(/not now/i)).toBeInTheDocument();
  });

  it("calls onAllow when 'allow access' is chosen", () => {
    const onAllow = vi.fn();
    render(<PhotoLibraryPermissionDialog open onAllow={onAllow} onNotNow={() => {}} />);
    fireEvent.click(screen.getByText(/allow access/i));
    expect(onAllow).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/photo-library-permission-dialog.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/wardrobe/photo-library-permission-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type PhotoLibraryPermissionDialogProps = {
  open: boolean;
  onAllow: () => void;
  onNotNow: () => void;
};

/**
 * MODALS.md §3 — "photo library permission": camera is drawn (7a), the
 * library is not, and batch add starts there. Same visual pattern as the
 * drawn camera dialog: one-sentence trade, "not now" / "allow" pair
 * (standing rule 4).
 */
export function PhotoLibraryPermissionDialog({ open, onAllow, onNotNow }: PhotoLibraryPermissionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onNotNow}
      title="garderobe needs your photos"
      description="Choosing from your library starts a batch. Nothing joins the wardrobe until you review and confirm each piece."
      cancelLabel="not now"
      confirmLabel="allow access"
      onConfirm={onAllow}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/photo-library-permission-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire into the choose-photos page, shown once per browser until allowed**

```tsx
// app/wardrobe/batch/new/page.tsx — add import:
import { PhotoLibraryPermissionDialog } from "@/components/garderobe/wardrobe/photo-library-permission-dialog";

// add state:
  const [showLibraryPermission, setShowLibraryPermission] = useState(false);

// replace the dropzone's onClick handler:
  function openPicker() {
    if (typeof window !== "undefined" && window.localStorage.getItem("gw.photoLibraryPermissionGranted") === "1") {
      inputRef.current?.click();
      return;
    }
    setShowLibraryPermission(true);
  }

// in the dropzone div, change onClick={() => inputRef.current?.click()} to onClick={openPicker}

// render alongside the other dialogs:
      <PhotoLibraryPermissionDialog
        open={showLibraryPermission}
        onNotNow={() => setShowLibraryPermission(false)}
        onAllow={() => {
          window.localStorage.setItem("gw.photoLibraryPermissionGranted", "1");
          setShowLibraryPermission(false);
          inputRef.current?.click();
        }}
      />
```

This matches how a real OS permission prompt behaves: declining ("not now") does not set the flag, so the explainer appears again next time rather than being silently remembered as a refusal; allowing sets the flag once, so returning users go straight to the picker.

- [ ] **Step 6: Commit**

```bash
git add components/garderobe/wardrobe/photo-library-permission-dialog.tsx components/garderobe/wardrobe/__tests__/photo-library-permission-dialog.test.tsx app/wardrobe/batch/new/page.tsx
git commit -m "Add the photo library permission dialog to the choose-photos flow."
```

---

## Task 5: `NotificationPermissionDialog`, asked after the first wear log

**Files:**
- Create: `components/garderobe/wardrobe/notification-permission-dialog.tsx`
- Modify: `components/wardrobe-shop.tsx` (`GarmentDetailDialog`'s wear-log success handling)
- Test: `components/garderobe/wardrobe/__tests__/notification-permission-dialog.test.tsx`

**Interfaces:**
- Consumes: `Dialog` from `components/garderobe/dialog.tsx`.
- Produces: `<NotificationPermissionDialog open onTurnOn onNotNow />`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/garderobe/wardrobe/__tests__/notification-permission-dialog.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationPermissionDialog } from "@/components/garderobe/wardrobe/notification-permission-dialog";

describe("NotificationPermissionDialog", () => {
  it("explains the trade and offers 'not now'", () => {
    render(<NotificationPermissionDialog open onTurnOn={() => {}} onNotNow={() => {}} />);
    expect(screen.getByText(/not now/i)).toBeInTheDocument();
  });

  it("calls onTurnOn when 'turn on' is chosen", () => {
    const onTurnOn = vi.fn();
    render(<NotificationPermissionDialog open onTurnOn={onTurnOn} onNotNow={() => {}} />);
    fireEvent.click(screen.getByText(/turn on/i));
    expect(onTurnOn).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/notification-permission-dialog.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Implement**

```tsx
// components/garderobe/wardrobe/notification-permission-dialog.tsx
"use client";

import { Dialog } from "@/components/garderobe/dialog";

type NotificationPermissionDialogProps = {
  open: boolean;
  onTurnOn: () => void;
  onNotNow: () => void;
};

/**
 * MODALS.md §3 — "notification permission", asked after the first wear log
 * per the settings copy (DATA_MODEL.md User.notifications.wearReminders).
 * There is no notification-settings screen built yet (phase 10 only shipped
 * the in-app notification feed), so "any time from account settings" here
 * is aspirational copy pointing at a screen a future phase still owes.
 */
export function NotificationPermissionDialog({ open, onTurnOn, onNotNow }: NotificationPermissionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onNotNow}
      title="a nudge to wear it again?"
      description="Garderobe can remind you about pieces sitting unworn. Turn it off any time from account settings."
      cancelLabel="not now"
      confirmLabel="turn on"
      onConfirm={onTurnOn}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/notification-permission-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire into the wear-log success path**

In `components/wardrobe-shop.tsx`, `GarmentDetailDialog` already has `const [wearState, wearFormAction] = useActionState(logWearAction, wardrobeActionState);` and a `useEffect` pattern watching other action states (see the existing `deleteState`/`favouriteState` effects a few lines below). Add:

```tsx
// components/wardrobe-shop.tsx — inside GarmentDetailDialog:
import { NotificationPermissionDialog } from "@/components/garderobe/wardrobe/notification-permission-dialog";

// add state:
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    if (wearState.status !== "success") return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("gw.notificationPermissionPrompted") === "1") return;
    if (typeof window.Notification === "undefined") return;
    if (window.Notification.permission !== "default") return;

    setShowNotificationPrompt(true);
  }, [wearState.status]);

  function dismissNotificationPrompt() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gw.notificationPermissionPrompted", "1");
    }
    setShowNotificationPrompt(false);
  }

// rendered alongside the dialog's other conditional dialogs:
      {showNotificationPrompt ? (
        <NotificationPermissionDialog
          open
          onNotNow={dismissNotificationPrompt}
          onTurnOn={() => {
            if (typeof window !== "undefined" && typeof window.Notification !== "undefined") {
              void window.Notification.requestPermission();
            }
            dismissNotificationPrompt();
          }}
        />
      ) : null}
```

The `gw.notificationPermissionPrompted` flag is set on either choice, matching standing rule 4's "a way to continue without granting it": the user is asked exactly once, ever, per browser, whichever way they answer, rather than being re-asked on every future wear log.

- [ ] **Step 6: Commit**

```bash
git add components/garderobe/wardrobe/notification-permission-dialog.tsx components/garderobe/wardrobe/__tests__/notification-permission-dialog.test.tsx components/wardrobe-shop.tsx
git commit -m "Ask for notification permission once, after the first wear log."
```

---

## Task 6: Receipt price-match candidates — service function and draft attachment

**Files:**
- Modify: `lib/domain/wardrobe/service.ts` (add `findGarmentPriceMatchCandidates`; extend `setGarmentPriceManually` with an optional `priceSource`)
- Modify: `lib/domain/ingestion/service.ts` (add `attachPriceMatchCandidates`; extend `PendingDraft.payload` with `price_match_candidates`; extend `listPendingDrafts`'s payload mapping)
- Modify: `app/wardrobe/actions.ts` (`createReceiptDraftAction` calls the above per candidate)
- Test: `lib/domain/wardrobe/__tests__/price-match-candidates.test.ts`, extend `app/wardrobe/__tests__/actions.test.ts`

**Interfaces:**
- Produces: `type PriceMatchCandidate = { garment_id: string; title: string | null; category: string }`; `findGarmentPriceMatchCandidates(params: { title: string; brand?: string | null; category?: string | null }): Promise<PriceMatchCandidate[]>`; `attachPriceMatchCandidates(draftId: string, candidates: PriceMatchCandidate[]): Promise<void>`; `setGarmentPriceManually(params: { garmentId: string; priceCents: number; currency?: string; priceSource?: "store" | "receipt" | "manual" })` (new optional field, defaults to `"manual"` so every existing call site is unaffected); `PendingDraft.payload.price_match_candidates?: PriceMatchCandidate[] | null` — consumed by Task 7.

- [ ] **Step 1: Write the failing test for `findGarmentPriceMatchCandidates`**

```typescript
// lib/domain/wardrobe/__tests__/price-match-candidates.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const limitMock = vi.fn();
const orMock = vi.fn(() => ({ limit: limitMock }));
const eqCategoryMock = vi.fn(() => ({ or: orMock }));
const isMock = vi.fn(() => ({ eq: eqCategoryMock, or: orMock }));
const eqUserMock = vi.fn(() => ({ is: isMock }));
const selectMock = vi.fn(() => ({ eq: eqUserMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

describe("findGarmentPriceMatchCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue({
      data: [
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Navy blazer", category: "blazer" },
        { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Wool blazer", category: "blazer" }
      ],
      error: null
    });
  });

  it("returns matching garments as candidates", async () => {
    const { findGarmentPriceMatchCandidates } = await import("@/lib/domain/wardrobe/service");
    const result = await findGarmentPriceMatchCandidates({ title: "Blazer", category: "blazer" });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ garment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Navy blazer", category: "blazer" });
  });

  it("returns an empty array when the title has no usable words", async () => {
    const { findGarmentPriceMatchCandidates } = await import("@/lib/domain/wardrobe/service");
    const result = await findGarmentPriceMatchCandidates({ title: "  " });

    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/domain/wardrobe/__tests__/price-match-candidates.test.ts`
Expected: FAIL — `findGarmentPriceMatchCandidates` is not exported yet.

- [ ] **Step 3: Implement `findGarmentPriceMatchCandidates` and extend `setGarmentPriceManually`**

```typescript
// lib/domain/wardrobe/service.ts — add:

export type PriceMatchCandidate = { garment_id: string; title: string | null; category: string };

/**
 * "This receipt matches three pieces" (MODALS.md §3) — a fuzzy title match
 * against the wardrobe's existing pieces, scoped to the same category where
 * one is known, so a "blazer" receipt line doesn't surface boots. This never
 * chooses on its own (standing rule 5): the caller only uses the result to
 * decide whether the resolver sheet needs to ask.
 */
export async function findGarmentPriceMatchCandidates(params: {
  title: string;
  brand?: string | null;
  category?: string | null;
}): Promise<PriceMatchCandidate[]> {
  const title = params.title.trim();
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[%,()]/g, ""))
    .filter((word) => word.length > 2)
    .slice(0, 3);

  if (words.length === 0) {
    return [];
  }

  const user = await getRequiredUser();
  const supabase = await createClient();

  let query = supabase
    .from("garments")
    .select("id,title,category")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .or(words.map((word) => `title.ilike.%${word}%`).join(","));

  if (params.category) {
    query = query.eq("category", params.category);
  }

  const { data, error } = await query.limit(5);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typed = row as { id: string; title: string | null; category: string };
    return { garment_id: typed.id, title: typed.title, category: typed.category };
  });
}
```

```typescript
// lib/domain/wardrobe/service.ts — extend the existing setGarmentPriceManually:
export async function setGarmentPriceManually(params: {
  garmentId: string;
  priceCents: number;
  currency?: string;
  priceSource?: "store" | "receipt" | "manual";
}) {
  const user = await getRequiredUser();
  const supabase = await createClient();
  const parsedId = z.string().uuid().parse(params.garmentId);
  const parsedPrice = z.number().nonnegative().parse(params.priceCents / 100);
  const parsedCurrency = params.currency ? z.string().length(3).parse(params.currency) : "AUD";
  const priceSource = params.priceSource ?? "manual";

  const { error } = await supabase
    .from("garments")
    .update(({
      purchase_price: parsedPrice,
      purchase_currency: parsedCurrency,
      price_source: priceSource
    } satisfies Partial<GarmentInsert>) as never)
    .eq("id", parsedId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/domain/wardrobe/__tests__/price-match-candidates.test.ts`
Expected: PASS

- [ ] **Step 5: Add `attachPriceMatchCandidates` and extend `PendingDraft`**

```typescript
// lib/domain/ingestion/service.ts — extend the PendingDraft payload type (mirrors duplicate_hint just above it):
  payload: {
    // ...existing fields unchanged...
    duplicate_hint?: {
      garment_id: string;
      title: string | null;
      category: string;
      similarity: number;
    } | null;
    price_match_candidates?: Array<{ garment_id: string; title: string | null; category: string }> | null;
  };
```

```typescript
// lib/domain/ingestion/service.ts — add, near attachDuplicateHints:

/**
 * "This receipt matches three pieces" (MODALS.md §3) — attaches candidate
 * garments onto an already-created draft, the same way attachDuplicateHints
 * attaches a duplicate hint, so the review page's resolver sheet has
 * something to read. Only called when there are 2+ candidates: a single
 * confident match is a different, not-yet-built feature (auto-attach), and
 * zero candidates means there is nothing to resolve.
 */
export async function attachPriceMatchCandidates(
  draftId: string,
  candidates: Array<{ garment_id: string; title: string | null; category: string }>
): Promise<void> {
  const user = await getRequiredUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("garment_drafts")
    .select("draft_payload_json")
    .eq("id", draftId)
    .eq("user_id", user.id)
    .single();

  const currentPayload = (existing as { draft_payload_json?: Json } | null)?.draft_payload_json;
  const basePayload =
    currentPayload && typeof currentPayload === "object" && !Array.isArray(currentPayload)
      ? (currentPayload as Record<string, unknown>)
      : {};

  await supabase
    .from("garment_drafts")
    .update({
      draft_payload_json: {
        ...basePayload,
        price_match_candidates: candidates
      } as Json
    } as never)
    .eq("id", draftId)
    .eq("user_id", user.id);
}
```

Then extend `listPendingDrafts`'s payload-mapping block (the same block that reads `p.duplicate_hint`, around line 720) with the matching read for `price_match_candidates`:

```typescript
        price_match_candidates:
          Array.isArray(p.price_match_candidates) && p.price_match_candidates.length > 0
            ? (p.price_match_candidates as PendingDraft["payload"]["price_match_candidates"])
            : null,
```

- [ ] **Step 6: Wire into `createReceiptDraftAction`, and write its failing test first**

```typescript
// append to app/wardrobe/__tests__/actions.test.ts

describe("createReceiptDraftAction price matching", () => {
  it("attaches price match candidates to the draft when two or more existing pieces match", async () => {
    vi.doMock("@/lib/domain/wardrobe/service", async () => {
      const actual = await vi.importActual("@/lib/domain/wardrobe/service");
      return {
        ...actual,
        findGarmentPriceMatchCandidates: vi.fn(async () => [
          { garment_id: "cccccccc-cccc-cccc-cccc-cccccccccccc", title: "Navy blazer", category: "blazer" },
          { garment_id: "dddddddd-dddd-dddd-dddd-dddddddddddd", title: "Wool blazer", category: "blazer" }
        ])
      };
    });
    vi.doMock("@/lib/domain/ingestion/service", async () => {
      const actual = await vi.importActual("@/lib/domain/ingestion/service");
      return { ...actual, attachPriceMatchCandidates: vi.fn(async () => {}) };
    });

    const { createReceiptDraftAction } = await import("@/app/wardrobe/actions");
    const { attachPriceMatchCandidates } = await import("@/lib/domain/ingestion/service");

    const formData = new FormData();
    formData.set(
      "receipt",
      new File([new Uint8Array(10)], "receipt.jpg", { type: "image/jpeg" })
    );
    formData.set("receipt_text", "Blazer $89.00");

    const result = await createReceiptDraftAction({ status: "idle", message: null }, formData);

    expect(result.status).toBe("success");
    expect(attachPriceMatchCandidates).toHaveBeenCalled();

    vi.doUnmock("@/lib/domain/wardrobe/service");
    vi.doUnmock("@/lib/domain/ingestion/service");
  });
});
```

Run it first to confirm it fails (`npx vitest run app/wardrobe/__tests__/actions.test.ts`, expected FAIL: `attachPriceMatchCandidates` never called), then wire it into the action:

```typescript
// app/wardrobe/actions.ts — add to the existing import from "@/lib/domain/wardrobe/service":
  findGarmentPriceMatchCandidates,
// add to the existing import from "@/lib/domain/ingestion/service":
  attachPriceMatchCandidates,

// createReceiptDraftAction — inside the `for (const candidate of candidates)` loop,
// right after `draftIds.push(draftId);`, add:
      const priceMatches = await findGarmentPriceMatchCandidates({
        title: draftPayload.title ?? fallbackTitle,
        brand: draftPayload.brand,
        category: draftPayload.category
      }).catch(() => []);

      if (priceMatches.length >= 2) {
        await attachPriceMatchCandidates(draftId, priceMatches);
      }
```

- [ ] **Step 7: Run all new/extended tests to verify they pass**

Run: `npx vitest run lib/domain/wardrobe/__tests__/price-match-candidates.test.ts app/wardrobe/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/domain/wardrobe/service.ts lib/domain/ingestion/service.ts app/wardrobe/actions.ts lib/domain/wardrobe/__tests__/price-match-candidates.test.ts app/wardrobe/__tests__/actions.test.ts
git commit -m "Attach ambiguous receipt price-match candidates onto the draft they came from."
```

---

## Task 7: `ReceiptMatchSheet` and the resolver action

**Files:**
- Create: `components/garderobe/wardrobe/receipt-match-sheet.tsx`
- Modify: `app/wardrobe/review/actions.ts` (add `resolveReceiptMatchAction`)
- Modify: `app/wardrobe/review/draft-review-list.tsx` (surface the sheet for a draft with 2+ `price_match_candidates`)
- Test: `components/garderobe/wardrobe/__tests__/receipt-match-sheet.test.tsx`, `app/wardrobe/review/__tests__/resolve-receipt-match-action.test.ts`

**Interfaces:**
- Consumes: `BottomSheet`, `SheetAction` from `components/garderobe/bottom-sheet.tsx`; `setGarmentPriceManually` (Task 6); `acceptDraftAction` (existing, unmodified).
- Produces: `<ReceiptMatchSheet open draftId candidates onClose onResolve={(garmentId: string | null) => void} pending error />`; `resolveReceiptMatchAction(draftId: string, garmentId: string | null): Promise<DraftActionResult>`.

- [ ] **Step 1: Write the failing test for `ReceiptMatchSheet`**

```typescript
// components/garderobe/wardrobe/__tests__/receipt-match-sheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReceiptMatchSheet } from "@/components/garderobe/wardrobe/receipt-match-sheet";

const candidates = [
  { garment_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", title: "Navy blazer", category: "blazer" },
  { garment_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", title: "Wool blazer", category: "blazer" }
];

describe("ReceiptMatchSheet", () => {
  it("lists every candidate and a 'none of these' option", () => {
    render(
      <ReceiptMatchSheet
        open
        draftId="draft-1"
        candidates={candidates}
        onClose={() => {}}
        onResolve={() => {}}
        pending={false}
        error={null}
      />
    );
    expect(screen.getByText("Navy blazer")).toBeInTheDocument();
    expect(screen.getByText("Wool blazer")).toBeInTheDocument();
    expect(screen.getByText(/none of these/i)).toBeInTheDocument();
  });

  it("calls onResolve with the chosen garment id", () => {
    const onResolve = vi.fn();
    render(
      <ReceiptMatchSheet
        open
        draftId="draft-1"
        candidates={candidates}
        onClose={() => {}}
        onResolve={onResolve}
        pending={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText("Navy blazer"));
    expect(onResolve).toHaveBeenCalledWith("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("calls onResolve with null for 'none of these'", () => {
    const onResolve = vi.fn();
    render(
      <ReceiptMatchSheet
        open
        draftId="draft-1"
        candidates={candidates}
        onClose={() => {}}
        onResolve={onResolve}
        pending={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByText(/none of these/i));
    expect(onResolve).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/receipt-match-sheet.test.tsx`
Expected: FAIL — the component does not exist.

- [ ] **Step 3: Implement `ReceiptMatchSheet`**

```tsx
// components/garderobe/wardrobe/receipt-match-sheet.tsx
"use client";

import { BottomSheet, SheetAction } from "@/components/garderobe/bottom-sheet";

type PriceMatchCandidate = { garment_id: string; title: string | null; category: string };

type ReceiptMatchSheetProps = {
  open: boolean;
  draftId: string;
  candidates: PriceMatchCandidate[];
  onClose: () => void;
  onResolve: (garmentId: string | null) => void;
  pending: boolean;
  error: string | null;
};

/**
 * MODALS.md §3 — "this receipt matches three pieces": the resolver for an
 * ambiguous price. Never pre-selects a candidate (standing rule 5) — every
 * option, including "none of these," is an equally weighted choice.
 */
export function ReceiptMatchSheet({
  open,
  candidates,
  onClose,
  onResolve,
  pending,
  error
}: ReceiptMatchSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`this receipt matches ${candidates.length} pieces`}
      description="It might be the price for one of these already in your wardrobe. Choose which, or add it as something new."
    >
      <div>
        {candidates.map((candidate, index) => (
          <SheetAction
            key={candidate.garment_id}
            last={false}
            onClick={() => onResolve(candidate.garment_id)}
          >
            {candidate.title || candidate.category}
          </SheetAction>
        ))}
        <SheetAction last onClick={() => onResolve(null)}>
          none of these — add as new
        </SheetAction>
      </div>
      {pending ? <p className="pt-3 text-[11px] text-[var(--stone)]">saving…</p> : null}
      {error ? <p className="pt-3 text-[11px] text-[var(--oxblood)]">{error}</p> : null}
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/garderobe/wardrobe/__tests__/receipt-match-sheet.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `resolveReceiptMatchAction`**

```typescript
// app/wardrobe/review/__tests__/resolve-receipt-match-action.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getRequiredUser: vi.fn(async () => ({ id: "11111111-1111-1111-1111-111111111111" }))
}));

const singleMock = vi.fn();
const draftUpdateEqMock = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }));
const fromMock = vi.fn((table: string) => {
  if (table === "garment_drafts") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }),
      update: () => ({ eq: draftUpdateEqMock })
    };
  }
  return { update: () => ({ eq: () => ({ eq: () => ({ error: null }) }) }) };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock }))
}));

describe("resolveReceiptMatchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    singleMock.mockResolvedValue({
      data: {
        id: "draft-1",
        status: "pending",
        draft_payload_json: { purchase_price: 89, purchase_currency: "AUD" }
      },
      error: null
    });
  });

  it("attaches the draft's price to the chosen garment and rejects the draft", async () => {
    vi.doMock("@/lib/domain/wardrobe/service", () => ({
      setGarmentPriceManually: vi.fn(async () => {})
    }));
    const { resolveReceiptMatchAction } = await import("@/app/wardrobe/review/actions");
    const { setGarmentPriceManually } = await import("@/lib/domain/wardrobe/service");

    const result = await resolveReceiptMatchAction(
      "draft-1",
      "cccccccc-cccc-cccc-cccc-cccccccccccc"
    );

    expect(result.status).toBe("success");
    expect(setGarmentPriceManually).toHaveBeenCalledWith(
      expect.objectContaining({
        garmentId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        priceCents: 8900,
        priceSource: "receipt"
      })
    );
    vi.doUnmock("@/lib/domain/wardrobe/service");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run app/wardrobe/review/__tests__/resolve-receipt-match-action.test.ts`
Expected: FAIL — `resolveReceiptMatchAction` is not exported yet.

- [ ] **Step 7: Implement `resolveReceiptMatchAction`**

```typescript
// app/wardrobe/review/actions.ts — add to the existing imports:
import { setGarmentPriceManually } from "@/lib/domain/wardrobe/service";

// add:
/**
 * MODALS.md §3 — the resolver for "this receipt matches three pieces".
 * `garmentId: null` means "none of these": fall through to the normal
 * accept-as-new path. Otherwise the draft's price moves onto the chosen
 * existing piece and the draft itself is discarded, since its other fields
 * would just duplicate a garment that already exists.
 */
export async function resolveReceiptMatchAction(
  draftId: string,
  garmentId: string | null
): Promise<DraftActionResult> {
  if (!garmentId) {
    return acceptDraftAction(draftId);
  }

  try {
    const parsedGarmentId = z.string().uuid().parse(garmentId);
    const user = await getRequiredUser();
    const supabase = await createClient();

    const { data: draft, error } = await supabase
      .from("garment_drafts")
      .select("id, status, draft_payload_json")
      .eq("id", draftId)
      .eq("user_id", user.id)
      .single();

    if (error || !draft) {
      return { status: "error", message: "Draft not found." };
    }

    if ((draft as { status: string }).status !== "pending") {
      return { status: "success" };
    }

    const payload = (draft as { draft_payload_json: Record<string, unknown> }).draft_payload_json;
    const priceRaw = payload.purchase_price;
    const price = priceRaw == null || priceRaw === "" ? null : Number(priceRaw);

    if (price === null || !Number.isFinite(price)) {
      return { status: "error", message: "This draft has no price to attach." };
    }

    const currency = typeof payload.purchase_currency === "string" ? payload.purchase_currency : "AUD";

    await setGarmentPriceManually({
      garmentId: parsedGarmentId,
      priceCents: Math.round(price * 100),
      currency,
      priceSource: "receipt"
    });

    const { error: rejectError } = await supabase
      .from("garment_drafts")
      .update({ status: "rejected" } as never)
      .eq("id", draftId)
      .eq("user_id", user.id);

    if (rejectError) {
      return { status: "error", message: rejectError.message };
    }

    revalidatePath("/wardrobe");
    revalidatePath(`/wardrobe/${parsedGarmentId}`);
    revalidatePath("/wardrobe/review");

    return { status: "success", garmentId: parsedGarmentId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to resolve this match."
    };
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run app/wardrobe/review/__tests__/resolve-receipt-match-action.test.ts`
Expected: PASS

- [ ] **Step 9: Surface the sheet in `draft-review-list.tsx`**

Find where `draft.payload.duplicate_hint` is rendered (the "you might already own this" note, around line 319). Add a sibling block for `price_match_candidates`, and local state to open the sheet:

```tsx
// app/wardrobe/review/draft-review-list.tsx — add import:
import { ReceiptMatchSheet } from "@/components/garderobe/wardrobe/receipt-match-sheet";
import { resolveReceiptMatchAction } from "@/app/wardrobe/review/actions";

// add state near the top of the component that already tracks `errors`/`pendingId`:
  const [matchSheetDraftId, setMatchSheetDraftId] = useState<string | null>(null);
  const [matchPending, setMatchPending] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

// render, alongside the existing duplicate_hint block, for each draft:
              {draft.payload.price_match_candidates && draft.payload.price_match_candidates.length >= 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setMatchError(null);
                    setMatchSheetDraftId(draft.id);
                  }}
                  className="mt-3 flex w-full items-center justify-between rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] bg-[var(--paper)] px-3 py-2.5 text-left text-[12.5px] text-[var(--slate)]"
                >
                  this receipt matches {draft.payload.price_match_candidates.length} pieces — resolve
                </button>
              ) : null}

// once, outside the per-draft map, render the sheet itself:
      {matchSheetDraftId
        ? (() => {
            const matchDraft = drafts.find((d) => d.id === matchSheetDraftId);
            const candidates = matchDraft?.payload.price_match_candidates ?? [];
            return (
              <ReceiptMatchSheet
                open
                draftId={matchSheetDraftId}
                candidates={candidates}
                pending={matchPending}
                error={matchError}
                onClose={() => setMatchSheetDraftId(null)}
                onResolve={async (garmentId) => {
                  setMatchPending(true);
                  setMatchError(null);
                  const result = await resolveReceiptMatchAction(matchSheetDraftId, garmentId);
                  setMatchPending(false);
                  if (result.status === "error") {
                    setMatchError(result.message);
                    return;
                  }
                  setMatchSheetDraftId(null);
                }}
              />
            );
          })()
        : null}
```

Match the exact local variable name the file already uses for its drafts array/state (it may not be literally `drafts` — check the component's existing `useState`/props destructuring at the top of the file and use that name) and the exact prop name each draft card receives (it may be `draft` inside a `.map`, matching the surrounding code already shown for `duplicate_hint`).

- [ ] **Step 10: Commit**

```bash
git add components/garderobe/wardrobe/receipt-match-sheet.tsx components/garderobe/wardrobe/__tests__/receipt-match-sheet.test.tsx app/wardrobe/review/actions.ts app/wardrobe/review/draft-review-list.tsx app/wardrobe/review/__tests__/resolve-receipt-match-action.test.ts
git commit -m "Add the receipt price-match resolver sheet to the draft review page."
```

---

## Task 8: Full test suite and typecheck

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS, no regressions in any previously-passing test.

- [ ] **Step 2: Run a full TypeScript typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Fix anything either command surfaces, then re-run both until clean.**
