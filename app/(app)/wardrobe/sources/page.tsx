import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredUser, AuthenticationError } from "@/lib/auth";
import {
  forwardingAddressFor,
  listReceiptSources,
  sourceTypeLabel
} from "@/lib/domain/ingestion/sources";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { createReceiptDraftAction } from "@/app/wardrobe/actions";

async function createReceiptFormAction(formData: FormData): Promise<void> {
  "use server";
  await createReceiptDraftAction({ status: "idle", message: null }, formData);
}

/**
 * 10a sources + 15b "where prices come from", combined into one screen.
 * Retailers are strings parsed off a receipt, never a connection — there
 * are no retailer account logins anywhere in this product (BUILD_ORDER
 * phase 0). Resale account connections (depop, vestiaire) are left out of
 * this pass: neither offers a public OAuth API to connect to safely.
 */
export default async function SourcesPage() {
  try {
    const user = await getRequiredUser();
    const sources = await listReceiptSources();
    const totalPending = sources.reduce((sum, source) => sum + source.pendingDrafts, 0);

    const retailerGroups = new Map<string, typeof sources>();
    for (const source of sources) {
      const key = source.retailer ?? "unmatched";
      retailerGroups.set(key, [...(retailerGroups.get(key) ?? []), source]);
    }

    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 pb-16">
        <Link
          href="/wardrobe"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          wardrobe
        </Link>

        <h1 className="pt-4 text-[34px] font-light leading-[1.05] text-[var(--ink)]">
          where prices come from
        </h1>
        <p className="pt-2 max-w-[44rem] text-[12.5px] leading-[1.5] text-[var(--slate)]">
          Prices arrive by forwarded order email, a photographed docket, a pasted product link, or
          typing it yourself. Garderobe never holds a shop login.
          {totalPending
            ? ` ${totalPending} line${totalPending === 1 ? "" : "s"} waiting for your nod — `
            : " "}
          {totalPending ? (
            <Link href="/wardrobe/review" className="underline">
              review them
            </Link>
          ) : null}
        </p>

        <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            add a docket or pdf
          </p>
          <form action={createReceiptFormAction} className="flex flex-col gap-3">
            <input
              name="receipt"
              type="file"
              accept="image/*,application/pdf"
              required
              className="text-[12.5px] text-[var(--slate)]"
            />
            <textarea
              name="receipt_text"
              rows={2}
              placeholder="or paste the receipt text here"
              className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
            />
            <button
              type="submit"
              className="h-[44px] self-start rounded-[100px] bg-[var(--oxblood)] px-6 text-[9px] font-semibold uppercase tracking-[.2em] text-[var(--cream)]"
            >
              read it
            </button>
          </form>
        </section>

        <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            forwarding address
          </p>
          <p className="gw-mono rounded-[5px] bg-[var(--paper)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
            {forwardingAddressFor(user.id)}
          </p>
          <p className="pt-2 text-[11px] text-[var(--stone)]">
            not receiving mail yet — this address isn&apos;t connected to a mail provider.
          </p>
        </section>

        <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            {sources.length} receipt{sources.length === 1 ? "" : "s"} in{" "}
            {retailerGroups.size} retailer{retailerGroups.size === 1 ? "" : "s"}
          </p>
          {sources.length ? (
            <div className="rounded-[4px] bg-[var(--cream)] px-[14px]">
              {Array.from(retailerGroups.entries()).map(([retailer, group], groupIndex) => (
                <div
                  key={retailer}
                  className={
                    groupIndex === retailerGroups.size - 1
                      ? ""
                      : "border-b border-[rgba(30,26,23,.14)]"
                  }
                >
                  <p className="pt-4 text-[8px] font-semibold uppercase tracking-[.14em] text-[var(--stone)]">
                    {retailer === "unmatched" ? "retailer not read yet" : retailer}
                  </p>
                  {group.map((source, index) => (
                    <div
                      key={source.id}
                      className={[
                        "flex items-center justify-between py-[13px]",
                        index === group.length - 1 ? "" : "border-b border-[rgba(30,26,23,.11)]"
                      ].join(" ")}
                    >
                      <div>
                        <p className="text-[14px] text-[var(--ink)]">
                          {sourceTypeLabel(source.sourceType)}
                        </p>
                        <p className="pt-1 text-[11px] text-[var(--stone)]">
                          {new Date(source.createdAt).toLocaleDateString("en-AU")} ·{" "}
                          {source.parseStatus}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--oxblood)]">
                        {source.pendingDrafts > 0
                          ? `${source.pendingDrafts} waiting`
                          : source.totalDrafts > 0
                            ? "read"
                            : "no items found"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
              <p className="text-[12.5px] text-[var(--stone)]">
                No receipts yet. Add a docket or pdf above.
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            resale accounts
          </p>
          <p className="text-[12.5px] text-[var(--slate)]">
            Not connected — depop and vestiaire don&apos;t offer a way to connect an account
            safely yet, so buying-there and selling-there stay manual for now.
          </p>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe/sources"
          title="Sign in with Supabase to view your sources."
          description="This page reads user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
