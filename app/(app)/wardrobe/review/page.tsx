import { listPendingDrafts } from "@/lib/domain/ingestion/service";
import { getOptionalUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import BatchReviewFlow from "../batch/batch-review-flow";
import DraftReviewList from "./draft-review-list";
import type { PendingDraft } from "@/lib/domain/ingestion/service";

export default async function ReviewPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/");

  const drafts = await listPendingDrafts();
  const photoDrafts = drafts.filter((draft) =>
    draft.payload.source_type === "direct_upload" || draft.payload.source_type === "outfit_decomposition"
  );
  const nonPhotoDrafts = drafts.filter((draft) => !photoDrafts.includes(draft));

  return (
    <div>
      {photoDrafts.length ? <BatchReviewFlow drafts={photoDrafts} batchId="review" /> : null}
      {nonPhotoDrafts.length ? (
        <main className="pw-shell max-w-3xl py-8">
          <DraftReviewList drafts={nonPhotoDrafts} />
        </main>
      ) : null}
      {!drafts.length ? <BatchReviewFlow drafts={[]} batchId="review" /> : null}
    </div>
  );
}
