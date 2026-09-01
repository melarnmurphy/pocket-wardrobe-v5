import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getPhotoBatch } from "@/lib/domain/ingestion/batch";
import { listPendingDrafts } from "@/lib/domain/ingestion/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { BatchProgressBanner } from "@/components/garderobe";
import DraftReviewList from "@/app/wardrobe/review/draft-review-list";

/** 14b — check what we guessed, then add them. Polls while photos are still processing. */
export default async function BatchReviewPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const batch = await getPhotoBatch(id);

    if (!batch) {
      notFound();
    }

    const allDrafts = await listPendingDrafts();
    const batchDraftIds = new Set(batch.draft_ids);
    const drafts = allDrafts.filter((draft) => batchDraftIds.has(draft.id));

    return (
      <main className="mx-auto max-w-3xl px-5 py-6 pb-16">
        <Link
          href="/wardrobe"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          wardrobe
        </Link>

        <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">
          check what we guessed
        </h1>
        <p className="pt-2 max-w-[44rem] text-[12.5px] leading-[1.5] text-[var(--slate)]">
          Nothing joins the wardrobe until you accept it, one piece at a time.
        </p>

        <div className="mt-6">
          <BatchProgressBanner
            batchId={batch.id}
            doneCount={batch.done_count}
            totalCount={batch.total_count}
            status={batch.status}
          />

          {drafts.length === 0 && batch.status !== "running" ? (
            <div className="rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
              <p className="text-[12.5px] text-[var(--stone)]">
                {batch.total_count > 0
                  ? "No garments were detected in those photos."
                  : "Nothing to review yet."}
              </p>
            </div>
          ) : (
            <DraftReviewList drafts={drafts} />
          )}
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe"
          title="Sign in with Supabase to review this batch."
          description="This page reads user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
