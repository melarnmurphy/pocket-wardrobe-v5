import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listMyThreads } from "@/lib/domain/local-threads/threads-service";
import { getLocalListingDetail } from "@/lib/domain/local-threads/service";
import { getPublicProfile } from "@/lib/domain/profile/service";
import { getRequiredUser, AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { HairlineListRow } from "@/components/garderobe";

export default async function ThreadsInboxPage() {
  try {
    const viewer = await getRequiredUser();
    const threads = await listMyThreads();

    const rows = await Promise.all(
      threads.map(async (thread) => {
        const counterpartId = thread.buyer_id === viewer.id ? thread.seller_id : thread.buyer_id;
        const [listing, counterpart] = await Promise.all([
          getLocalListingDetail(thread.listing_id),
          getPublicProfile(counterpartId)
        ]);
        return { thread, listing, counterpart };
      })
    );

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link href="/local/nearby" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]">
          <ChevronLeft size={14} strokeWidth={1.5} />
          nearby
        </Link>

        <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">threads</h1>

        {rows.length ? (
          <div className="mt-6 rounded-[4px] bg-[var(--cream)] px-[14px]">
            {rows.map((row, index) => (
              <Link key={row.thread.id} href={`/local/threads/${row.thread.id}`}>
                <HairlineListRow last={index === rows.length - 1}>
                  <div className="flex-1">
                    <p className="text-[14px] text-[var(--ink)]">
                      {row.counterpart?.localName || "a Garderobe user"}
                    </p>
                    <p className="pt-1 text-[11px] text-[var(--stone)]">
                      {row.listing?.description ?? "listing removed"} · {row.thread.state}
                    </p>
                  </div>
                </HairlineListRow>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
            <p className="text-[12.5px] text-[var(--stone)]">
              No conversations yet. Message a seller from a{" "}
              <Link href="/local/nearby" className="underline">
                nearby listing
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/local/threads"
          title="Sign in with Supabase to view your threads."
          description="This page reads threads scoped to you, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
