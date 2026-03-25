import { listPendingDrafts } from "@/lib/domain/ingestion/service";
import { getOptionalUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DraftReviewList from "./draft-review-list";
import type { PendingDraft } from "@/lib/domain/ingestion/service";

export default async function ReviewPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getOptionalUser();
  if (!user) redirect("/");

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const drafts = await listPendingDrafts();
  const summary = buildReviewSummary(drafts);
  const latestOnlyParam = resolvedSearchParams?.latest;
  const initialLatestBatchOnly =
    (Array.isArray(latestOnlyParam) ? latestOnlyParam[0] : latestOnlyParam) === "1";

  return (
    <main className="pw-shell max-w-3xl py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--foreground)]">
            Review Detections
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">{summary}</p>
        </div>
        <Link href="/" className="pw-button-quiet px-3.5 py-1.5 text-xs">
          ← Back to dashboard
        </Link>
      </div>

      <DraftReviewList
        drafts={drafts}
        initialLatestBatchOnly={initialLatestBatchOnly}
      />
    </main>
  );
}

function buildReviewSummary(drafts: PendingDraft[]) {
  if (drafts.length === 0) {
    return "No pending drafts";
  }

  const counts = drafts.reduce(
    (acc, draft) => {
      const sourceType = draft.payload.source_type;

      if (sourceType === "receipt") {
        acc.receipt += 1;
      } else if (sourceType === "product_url") {
        acc.productUrl += 1;
      } else if (sourceType === "direct_upload") {
        acc.photo += 1;
      } else {
        acc.other += 1;
      }

      if ((draft.confidence ?? draft.payload.confidence) < 0.6) {
        acc.lowConfidence += 1;
      }

      return acc;
    },
    { receipt: 0, productUrl: 0, photo: 0, other: 0, lowConfidence: 0 }
  );

  const segments = [
    counts.receipt ? labelCount(counts.receipt, "receipt draft") : null,
    counts.productUrl ? labelCount(counts.productUrl, "product-link draft") : null,
    counts.photo ? labelCount(counts.photo, "photo draft") : null,
    counts.other ? labelCount(counts.other, "other draft") : null
  ].filter((value): value is string => Boolean(value));

  const confidenceLabel = counts.lowConfidence
    ? `${counts.lowConfidence} low-confidence`
    : "all ready for review";

  return `${segments.join(" · ")} · ${confidenceLabel}`;
}

function labelCount(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
