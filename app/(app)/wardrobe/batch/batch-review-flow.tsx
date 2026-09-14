"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PendingDraft } from "@/lib/domain/ingestion/service";
import { calculateReviewLayout } from "@/lib/domain/ingestion/review-layout";
import { acceptDraftAction, saveImportedOutfitAction } from "@/app/(app)/wardrobe/review/actions";

type DraftEdit = {
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
};

type ReviewStep = "batch" | "questions" | "done";

function editFor(draft: PendingDraft): DraftEdit {
  return {
    title: draft.payload.title || draft.payload.tag,
    category: draft.payload.category,
    colour: draft.payload.colour,
    brand: draft.payload.brand ?? "",
    material: draft.payload.material ?? "",
    style: draft.payload.style,
    notes: draft.payload.notes ?? "",
    retailer: draft.payload.retailer ?? "",
    purchase_price: draft.payload.purchase_price == null ? "" : String(draft.payload.purchase_price),
    purchase_currency: draft.payload.purchase_currency ?? "AUD"
  };
}

function needsInput(draft: PendingDraft) {
  const confidence = draft.payload.field_confidence ?? {};
  return Object.entries(confidence).some(([, value]) => value < 0.8) || draft.payload.confidence < 0.6;
}

function fieldConfidence(draft: PendingDraft, field: keyof DraftEdit) {
  return draft.payload.field_confidence?.[field] ?? draft.payload.confidence;
}

export default function BatchReviewFlow({
  drafts,
  batchId,
  errorMessage,
  processing = false,
  doneCount = drafts.length,
  totalCount = drafts.length
}: {
  drafts: PendingDraft[];
  batchId: string;
  errorMessage?: string | null;
  processing?: boolean;
  doneCount?: number;
  totalCount?: number;
}) {
  const [step, setStep] = useState<ReviewStep>(drafts.length ? "batch" : "done");
  const [edits, setEdits] = useState<Record<string, DraftEdit>>(() =>
    Object.fromEntries(drafts.map((draft) => [draft.id, editFor(draft)]))
  );
  const [currentDraft, setCurrentDraft] = useState(0);
  const [currentField, setCurrentField] = useState<keyof DraftEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flagged = useMemo(() => drafts.filter(needsInput), [drafts]);
  const current = flagged[currentDraft] ?? null;
  const currentEdit = current ? edits[current.id] : null;
  const fields = current
    ? (Object.keys(currentEdit ?? {}) as Array<keyof DraftEdit>).filter((field) => field !== "notes" && field !== "purchase_currency")
    : [];
  const openFields = current
    ? fields.filter((field) => fieldConfidence(current, field) < 0.8)
    : [];
  const questionField: keyof DraftEdit = currentField ?? openFields[0] ?? fields[0] ?? "category";

  if (processing) {
    const remaining = Math.max(totalCount - doneCount, 0);
    const layout = calculateReviewLayout([
      ...drafts.map((draft) => ({ aspectRatio: cropAspectRatio(draft) })),
      ...Array.from({ length: remaining }, () => ({ pending: true }))
    ]);

    return (
      <main className="gw-review-batch">
        <div className="gw-review-head">
          <div>
            <p className="gw-kicker">reading your photos</p>
            <h1>We found<br />{drafts.length} so far.</h1>
          </div>
          <p className="gw-review-note">
            Each piece settles into place as it is read. You can leave this screen and come back.
          </p>
        </div>
        <div className="gw-flatlay" aria-live="polite">
          {drafts.map((draft, index) => (
            <div key={draft.id} className="gw-flat-piece" style={pieceStyle(layout[index])}>
              <DraftImage draft={draft} />
            </div>
          ))}
          {Array.from({ length: remaining }, (_, index) => (
            <div
              key={`pending-${index}`}
              className="gw-flat-piece gw-flat-placeholder"
              style={pieceStyle(layout[drafts.length + index])}
              aria-label="photo still processing"
            />
          ))}
        </div>
        <div className="gw-review-footer">
          <span>{doneCount} of {totalCount} photos read</span>
          <div className="gw-review-progress" aria-label={`${doneCount} of ${totalCount} photos read`}>
            <span style={{ width: `${totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%` }} />
          </div>
          <span className="gw-review-live">still reading…</span>
        </div>
      </main>
    );
  }

  function update(field: keyof DraftEdit, value: string) {
    if (!current) return;
    setEdits((state) => ({ ...state, [current.id]: { ...state[current.id], [field]: value } }));
  }

  function advanceQuestion() {
    if (!current) return;
    const currentIndex = questionField
      ? openFields.indexOf(questionField as (typeof openFields)[number])
      : -1;
    const nextField = openFields[currentIndex + 1];
    if (nextField) {
      setCurrentField(nextField);
      return;
    }
    if (currentDraft < flagged.length - 1) {
      setCurrentDraft((value) => value + 1);
      setCurrentField(null);
      return;
    }
    finish();
  }

  async function finish() {
    setSaving(true);
    setError(null);
    const acceptedGarmentIds: string[] = [];
    for (const draft of drafts) {
      const edit = edits[draft.id] ?? editFor(draft);
      const result = await acceptDraftAction({
        draftId: draft.id,
        ...edit,
        purchase_price: edit.purchase_price.trim() ? Number(edit.purchase_price) : undefined,
        purchase_currency: edit.purchase_currency.trim() || undefined
      });
      if (result.status === "error") {
        setError(result.message);
        setSaving(false);
        return;
      }
      if (result.garmentId) acceptedGarmentIds.push(result.garmentId);
    }
    if (drafts.some((draft) => draft.payload.source_type === "outfit_decomposition")) {
      const outfitResult = await saveImportedOutfitAction({
        garmentIds: acceptedGarmentIds,
        sourceId: drafts[0]?.sourceId,
        title: "Imported outfit look"
      });
      if (outfitResult.status === "error") {
        setError(outfitResult.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setStep("done");
  }

  if (!drafts.length || step === "done") {
    return (
      <main className="gw-review-done">
        <div className="gw-review-done-copy">
          <p className="gw-kicker">batch {batchId.slice(0, 6)} · added to your wardrobe</p>
          <h1>All {drafts.length || "your"} are<br />in.</h1>
          <p>Nothing is left to check. Your pieces are ready to wear.</p>
          <Link href="/wardrobe" className="gw-primary-button">see your wardrobe →</Link>
        </div>
      </main>
    );
  }

  if (step === "questions" && current && currentEdit) {
    const questionLabel = questionField;
    const answer = currentEdit[questionLabel];
    return (
      <main className="gw-review-question">
        <div className="gw-question-image">
          <DraftImage draft={current} />
          <p>{current.payload.title || "piece from your photo"}</p>
        </div>
        <section className="gw-question-panel">
          <div className="gw-question-count"><strong>{String(currentDraft + 1).padStart(2, "0")}</strong><span><b>fields need you</b><br />of {fields.length} we read from the photo</span></div>
          <h1>{questionLabel === "colour" ? "Red or pink?" : `What is this ${questionLabel}?`}</h1>
          {questionLabel === "colour" ? (
            <div className="gw-answer-grid">
              {[["red", "#a8231f"], ["pink", "#e08aa0"], ["both", "linear-gradient(135deg,#a8231f 50%,#e08aa0 50%)"]].map(([label, swatch]) => (
                <button key={label} className={answer === label ? "selected" : ""} onClick={() => update("colour", label)}><i style={{ background: swatch }} />{label}</button>
              ))}
            </div>
          ) : (
            <input className="gw-question-input" value={answer ?? ""} onChange={(event) => update(questionLabel, event.target.value)} autoFocus />
          )}
          <div className="gw-question-actions"><button className="gw-primary-button" onClick={advanceQuestion}>{currentIndexLabel(openFields, questionField) < openFields.length - 1 || currentDraft < flagged.length - 1 ? "confirm" : "confirm all"}</button><button className="gw-skip" onClick={advanceQuestion}>skip this field</button></div>
          <div className="gw-read-fields"><p className="gw-kicker">what we read</p>{fields.map((field) => <button key={field} className="gw-read-row" onClick={() => setCurrentField(field)}><span className={field === questionField ? "dot active" : "dot"} /> <b>{field.replaceAll("_", " ")}</b><span>{currentEdit[field] || "not read"}</span>{field === openFields[1] ? <em>next</em> : null}</button>)}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="gw-review-batch">
      {errorMessage ? <div className="gw-review-warning">{errorMessage} Your readable pieces are still here to review.</div> : null}
      <div className="gw-review-head"><div><p className="gw-kicker">batch · {drafts.length} photos read</p><h1>We found<br />{drafts.length} pieces</h1></div><p className="gw-review-note">Every piece at once. The ones needing input are flagged in place.</p></div>
      <div className="gw-flatlay">
        {drafts.map((draft, index) => <div key={draft.id} className="gw-flat-piece" style={pieceStyle(calculateReviewLayout(drafts.map((item) => ({ aspectRatio: cropAspectRatio(item) })))[index])}><DraftImage draft={draft} />{needsInput(draft) ? <button className="gw-flag" onClick={() => { setCurrentDraft(flagged.findIndex((item) => item.id === draft.id)); setStep("questions"); }}>check {index === 0 ? "colour" : "category"}</button> : <span className="gw-check">✓</span>}</div>)}
      </div>
      <div className="gw-review-footer"><span>{drafts.length - flagged.length} confirmed · {flagged.length} flagged</span><Link className="gw-secondary-link" href="/wardrobe/batch/new">add the other 5</Link><button className="gw-primary-button" onClick={() => { if (flagged.length) setStep("questions"); else finish(); }}>{flagged.length ? `start with ${flagged.length} questions →` : "add them to my wardrobe →"}</button></div>
      {error ? <p className="gw-review-error">{error}</p> : null}{saving ? <p className="gw-review-saving">adding your pieces…</p> : null}
    </main>
  );
}

function currentIndexLabel(fields: string[], field: string) {
  return Math.max(0, fields.indexOf(field));
}

function cropAspectRatio(draft: PendingDraft) {
  const width = draft.payload.crop_width ?? draft.source_image_width;
  const height = draft.payload.crop_height ?? draft.source_image_height;
  return width && height ? width / height : null;
}

function pieceStyle(position: ReturnType<typeof calculateReviewLayout>[number] | undefined) {
  if (!position) return undefined;
  return {
    left: `${position.left}%`,
    top: `${position.top}%`,
    width: `${position.width}%`,
    height: `${position.height}%`
  };
}

function DraftImage({ draft }: { draft: PendingDraft }) {
  if (!draft.preview_url) return <div className="gw-image-missing">image<br />processing</div>;
  return <Image src={draft.preview_url} alt={draft.payload.title || "garment"} width={800} height={800} unoptimized />;
}
