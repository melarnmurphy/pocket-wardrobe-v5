import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AVAILABILITY_VALUES, LET_GO_REASON_VALUES } from "@/lib/domain/wardrobe";
import { getGarmentById } from "@/lib/domain/wardrobe/service";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { ArchiveControl, Chip, CutoutTile } from "@/components/garderobe";
import {
  addToLetGoAction,
  archiveGarmentAction,
  removeFromLetGoAction,
  setAvailabilityAction,
  undoArchiveGarmentAction,
  updateGarmentAction
} from "@/app/wardrobe/actions";

function formatMoney(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount === null || amount === undefined) return null;
  const symbol = !currency || currency === "AUD" ? "A$" : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

const idleState: WardrobeActionState = { status: "idle", message: null };

// Progressive-enhancement forms below don't read the action's result, so
// they call the reducer-style actions with a void-returning wrapper rather
// than pulling in useActionState for a page with no other client state.
async function setAvailabilityFormAction(formData: FormData): Promise<void> {
  "use server";
  await setAvailabilityAction(idleState, formData);
}

async function addToLetGoFormAction(formData: FormData): Promise<void> {
  "use server";
  await addToLetGoAction(idleState, formData);
}

async function removeFromLetGoFormAction(formData: FormData): Promise<void> {
  "use server";
  await removeFromLetGoAction(idleState, formData);
}

async function updateGarmentFormAction(formData: FormData): Promise<void> {
  "use server";
  await updateGarmentAction(idleState, formData);
}

export default async function PieceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const garment = await getGarmentById(id);

    if (!garment) {
      notFound();
    }

    const priceText = formatMoney(garment.purchase_price, garment.purchase_currency);
    const costPerWearText = formatMoney(garment.cost_per_wear, garment.purchase_currency);
    const isArchived = Boolean(garment.archived_at);
    const isOnLetGoList = Boolean(garment.let_go_reason);
    const pieceName = garment.title || garment.category;

    return (
      <div className="mx-auto max-w-[520px] px-5 py-6 pb-16">
        <Link
          href="/wardrobe"
          className="inline-flex items-center gap-1 text-[12.5px] text-[var(--stone)]"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
          wardrobe
        </Link>

        {isArchived ? (
          <div className="mt-4 rounded-[4px] border border-dashed border-[rgba(30,26,23,.3)] bg-[var(--paper)] px-4 py-3 text-[12.5px] text-[var(--stone)]">
            let go{garment.archived_at ? ` on ${new Date(garment.archived_at).toLocaleDateString("en-AU")}` : ""}
            {garment.archive_reason ? ` — ${garment.archive_reason}` : ""}. Wear history is kept.
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-[140px_1fr] gap-5">
          <CutoutTile
            src={garment.preview_url}
            alt={pieceName}
            centre={garment.category === "shoes" || garment.category === "bags"}
          />
          <div>
            <h1 className="text-[30px] font-light leading-[1.05] text-[var(--ink)]">{pieceName}</h1>
            <p className="pt-1.5 text-[12.5px] text-[var(--slate)]">
              {[garment.category, garment.subcategory, garment.brand].filter(Boolean).join(" · ")}
            </p>
            <div className="pt-4">
              <div className="text-[26px] font-light leading-[1.2] text-[var(--ink)]">
                {priceText ?? (
                  <span className="text-[var(--stone)]">add later</span>
                )}
              </div>
              {costPerWearText ? (
                <p className="pt-1 text-[11px] uppercase tracking-[.14em] text-[var(--stone)]">
                  {costPerWearText} / wear
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
            worn {garment.wear_count}×
          </span>
          {garment.last_worn_at ? (
            <span className="rounded-[100px] bg-[rgba(30,26,23,.07)] px-3 py-[7px] text-[11px] text-[var(--slate)]">
              last worn {new Date(garment.last_worn_at).toLocaleDateString("en-AU")}
            </span>
          ) : null}
        </div>

        {!isArchived ? (
          <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
            <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
              availability
            </p>
            <div className="flex flex-wrap gap-[7px]">
              {AVAILABILITY_VALUES.map((value) => (
                <form key={value} action={setAvailabilityFormAction}>
                  <input type="hidden" name="garment_id" value={garment.id} />
                  <input type="hidden" name="availability" value={value} />
                  <Chip type="submit" variant={garment.availability === value ? "selected" : "available"}>
                    {value}
                  </Chip>
                </form>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
          <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
            price
          </p>
          <form action={updateGarmentFormAction} className="flex items-end gap-2">
            <input type="hidden" name="category" value={garment.category} />
            <input type="hidden" name="garment_id" value={garment.id} />
            <label className="flex-1">
              <span className="block pb-1 text-[11px] text-[var(--stone)]">amount, AUD</span>
              <input
                name="purchase_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={garment.purchase_price ?? ""}
                placeholder="add later"
                className="w-full rounded-[5px] border border-[rgba(30,26,23,.22)] bg-transparent px-3 py-2 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
              />
            </label>
            <button
              type="submit"
              className="h-[38px] rounded-[100px] border border-[rgba(30,26,23,.22)] px-4 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--ink)]"
            >
              save
            </button>
          </form>
        </section>

        {!isArchived ? (
          <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
            <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
              let-go list
            </p>
            {isOnLetGoList ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[12.5px] text-[var(--slate)]">
                  on the let-go list — {garment.let_go_reason}
                </span>
                <form action={removeFromLetGoFormAction}>
                  <input type="hidden" name="garment_id" value={garment.id} />
                  <Chip type="submit" variant="applied">
                    keep it ×
                  </Chip>
                </form>
              </div>
            ) : (
              <div className="flex flex-wrap gap-[7px]">
                {LET_GO_REASON_VALUES.map((reason) => (
                  <form key={reason} action={addToLetGoFormAction}>
                    <input type="hidden" name="garment_id" value={garment.id} />
                    <input type="hidden" name="reason" value={reason} />
                    <Chip type="submit" variant="add">
                      {reason}
                    </Chip>
                  </form>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!isArchived ? (
          <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
            <ArchiveControl
              garmentId={garment.id as string}
              pieceName={pieceName}
              archiveAction={archiveGarmentAction}
              undoAction={undoArchiveGarmentAction}
            />
          </section>
        ) : null}
      </div>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe"
          title="Sign in with Supabase to view this piece."
          description="This page reads and writes user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
