import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getPhotoBatch } from "@/lib/domain/ingestion/batch";
import { listPendingDrafts } from "@/lib/domain/ingestion/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { BatchProgressBanner } from "@/components/garderobe";
import BatchReviewFlow from "../batch-review-flow";

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

    if (batch.status !== "running" && batch.draft_ids.length === 0) {
      return (
        <main className="mx-auto max-w-3xl px-5 py-10 text-center">
          <p className="gw-kicker">batch finished</p>
          <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">no garments found</h1>
          <p className="mx-auto max-w-md pt-3 text-[12.5px] leading-[1.5] text-[var(--slate)]">
            Nothing entered your wardrobe. Try a clearer photo with one or more garments visible.
          </p>
          <Link href="/wardrobe/batch/new" className="mt-6 inline-flex rounded-[100px] bg-[var(--oxblood)] px-6 py-4 text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--cream)]">
            choose photos again
          </Link>
        </main>
      );
    }

    if (batch.status !== "running") {
      return <BatchReviewFlow drafts={drafts} batchId={batch.id} errorMessage={batch.error_message} />;
    }

    return (
      <main className="mx-auto max-w-3xl px-5 py-6 pb-16">
        <Link href="/wardrobe" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} /> wardrobe
        </Link>
        <h1 className="pt-4 text-[30px] font-light leading-[1.05] text-[var(--ink)]">reading your photos</h1>
        <p className="pt-2 max-w-[44rem] text-[12.5px] leading-[1.5] text-[var(--slate)]">The flat-lay will fill in as each garment is read.</p>
        <div className="mt-6"><BatchProgressBanner batchId={batch.id} doneCount={batch.done_count} totalCount={batch.total_count} status={batch.status} /></div>
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
