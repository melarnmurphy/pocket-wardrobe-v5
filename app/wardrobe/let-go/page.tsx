import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { listLetGoGarments } from "@/lib/domain/wardrobe/service";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { CutoutTile, HairlineListRow } from "@/components/garderobe";

function formatMoney(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "add later";
  return `A$${amount.toFixed(2)}`;
}

export default async function LetGoListPage() {
  try {
    const garments = await listLetGoGarments();

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
          {garments.length} thing{garments.length === 1 ? "" : "s"}
        </h1>
        <p className="pt-2 max-w-[44rem] text-[12.5px] leading-[1.5] text-[var(--slate)]">
          Pieces you have flagged to let go. They stay in the wardrobe and in your counts until
          you let one go for good.
        </p>

        {garments.length ? (
          <div className="mt-6 rounded-[4px] bg-[var(--cream)] px-[14px]">
            {garments.map((garment, index) => (
              <Link key={garment.id} href={`/wardrobe/${garment.id}`}>
                <HairlineListRow last={index === garments.length - 1}>
                  <div className="w-[52px] shrink-0">
                    <CutoutTile
                      src={garment.preview_url}
                      alt={garment.title || garment.category}
                      centre={garment.category === "shoes" || garment.category === "bags"}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] leading-[1.2] text-[var(--ink)]">
                      {garment.title || garment.category}
                    </div>
                    <div className="pt-1.5 text-[8px] font-semibold uppercase tracking-[.14em] text-[var(--stone)]">
                      {garment.let_go_reason} · worn {garment.wear_count}×
                    </div>
                  </div>
                  <span className="text-[14px] text-[var(--stone)]">
                    {garment.let_go_estimate_cents !== null && garment.let_go_estimate_cents !== undefined
                      ? formatMoney(garment.let_go_estimate_cents / 100)
                      : formatMoney(garment.purchase_price)}
                  </span>
                </HairlineListRow>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] px-6 py-10 text-center">
            <p className="text-[12.5px] text-[var(--stone)]">
              Nothing here yet. Flag a piece from its detail page — never worn, does not fit, not
              you anymore, worn out, or a duplicate.
            </p>
          </div>
        )}
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe/let-go"
          title="Sign in with Supabase to view the let-go list."
          description="This page reads user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
