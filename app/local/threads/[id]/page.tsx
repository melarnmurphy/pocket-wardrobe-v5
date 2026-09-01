import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getThreadDetail } from "@/lib/domain/local-threads/threads-service";
import { getLocalListingDetail } from "@/lib/domain/local-threads/service";
import { getPublicProfile } from "@/lib/domain/profile/service";
import { getRequiredUser, AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { ThreadView } from "./thread-view";

/** 16d / w2d — the thread: messages, offer, handover proposal, both-party confirmation. */
export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const viewer = await getRequiredUser();
    const detail = await getThreadDetail(id);

    if (!detail) {
      notFound();
    }

    const counterpartId =
      detail.thread.buyer_id === viewer.id ? detail.thread.seller_id : detail.thread.buyer_id;
    const [listing, counterpart] = await Promise.all([
      getLocalListingDetail(detail.thread.listing_id),
      getPublicProfile(counterpartId)
    ]);

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/local/threads" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          threads
        </Link>

        <h1 className="pt-4 text-[26px] font-light leading-[1.1] text-[var(--ink)]">
          {counterpart?.localName || "a Garderobe user"}
        </h1>
        <p className="pt-1 text-[12.5px] text-[var(--slate)]">
          {listing?.description ?? "listing removed"}
          {listing ? ` · A$${(listing.ask_cents / 100).toFixed(0)}` : ""}
        </p>

        <ThreadView
          viewerId={viewer.id}
          thread={detail.thread}
          initialMessages={detail.messages}
          initialHandover={detail.handover}
          counterpartName={counterpart?.localName || "this user"}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/local/threads"
          title="Sign in with Supabase to view this thread."
          description="Threads are readable only by their two participants, so this requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
