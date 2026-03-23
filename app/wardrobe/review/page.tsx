import { listPendingDrafts } from "@/lib/domain/ingestion/service";
import { getOptionalUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import DraftReviewList from "./draft-review-list";

export default async function ReviewPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/");

  const drafts = await listPendingDrafts();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1a1a1a]">
            Review Detections
          </h1>
          <p className="mt-1 text-[13px] text-[#999]">
            {drafts.length > 0
              ? `${drafts.length} garment${drafts.length === 1 ? "" : "s"} detected · Accept to add to your wardrobe`
              : "No pending drafts"}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-[#e8d8c8] px-3.5 py-1.5 text-xs text-[#c17a3a]"
        >
          ← Back to dashboard
        </Link>
      </div>

      <DraftReviewList drafts={drafts} />
    </main>
  );
}
