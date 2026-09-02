import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { AVAILABILITY_VALUES, LET_GO_REASON_VALUES } from "@/lib/domain/wardrobe";
import { canonicalWardrobeColours } from "@/lib/domain/wardrobe/colours";
import { RECIPE_WARDROBE_CATEGORIES } from "@/lib/domain/trends/styling-recipe";
import { getGarmentById, listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import type { WardrobeActionState } from "@/lib/domain/wardrobe/action-state";
import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { Chip, CutoutTile } from "@/components/garderobe";
import { PricePanel } from "@/components/garderobe/wardrobe/price-panel";
import {
  DisposalControl,
  FieldPickerControl,
  MergeControl,
  RecutControl,
  WearHistorySection,
  type GarmentFieldSnapshot
} from "@/components/garderobe/wardrobe/piece-detail-panels";
import {
  addGarmentImageAction,
  addToLetGoAction,
  archiveGarmentAction,
  deleteWearEventAction,
  mergeGarmentsAction,
  removeFromLetGoAction,
  setAvailabilityAction,
  setPriceManuallyAction,
  undoArchiveGarmentAction,
  updateGarmentAction,
  updateWearEventAction
} from "@/app/wardrobe/actions";

const MATERIAL_OPTIONS = [
  "cotton",
  "linen",
  "wool",
  "silk",
  "leather",
  "denim",
  "cashmere",
  "polyester",
  "synthetic blend"
];

const COLOUR_OPTIONS = canonicalWardrobeColours.map((colour) => colour.family);

const PRICE_SOURCE_LABEL: Record<string, string> = {
  store: "from the store",
  receipt: "from a receipt",
  manual: "typed by hand"
};

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

export default async function PieceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const garment = await getGarmentById(id);

    if (!garment) {
      notFound();
    }

    const costPerWearText = formatMoney(garment.cost_per_wear, garment.purchase_currency);
    const isArchived = Boolean(garment.archived_at);
    const isOnLetGoList = Boolean(garment.let_go_reason);
    const pieceName = garment.title || garment.category;

    const fieldSnapshot: GarmentFieldSnapshot = {
      garment_id: garment.id as string,
      title: garment.title ?? null,
      brand: garment.brand ?? null,
      category: garment.category,
      subcategory: garment.subcategory ?? null,
      material: garment.material ?? null,
      size: garment.size ?? null,
      fit: garment.fit ?? null,
      formality_level: garment.formality_level ?? null,
      purchase_currency: garment.purchase_currency ?? null,
      purchase_price: garment.purchase_price ?? null,
      purchase_date: garment.purchase_date ?? null,
      retailer: garment.retailer ?? null,
      primary_colour_family: garment.primary_colour_family ?? null,
      seasonality: garment.seasonality ?? []
    };

    const mergeTargets = isArchived
      ? []
      : (await listWardrobeGarments())
          .filter((candidate) => candidate.id !== garment.id && !candidate.archived_at)
          .map((candidate) => ({
            id: candidate.id as string,
            title: candidate.title || candidate.category
          }));

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
          <div>
            <CutoutTile
              src={garment.preview_url}
              alt={pieceName}
              centre={garment.category === "shoes" || garment.category === "bags"}
            />
            {!isArchived ? (
              <div className="pt-2 text-center">
                <RecutControl garmentId={garment.id as string} addImageAction={addGarmentImageAction} />
              </div>
            ) : null}
          </div>
          <div>
            <h1 className="text-[30px] font-light leading-[1.05] text-[var(--ink)]">{pieceName}</h1>
            {garment.subcategory || garment.brand ? (
              <p className="pt-1.5 text-[12.5px] text-[var(--slate)]">
                {[garment.subcategory, garment.brand].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {!isArchived ? (
              <div className="flex flex-wrap gap-4 pt-3">
                <FieldPickerControl
                  label="category"
                  field="category"
                  value={garment.category}
                  options={[...RECIPE_WARDROBE_CATEGORIES]}
                  snapshot={fieldSnapshot}
                  updateAction={updateGarmentAction}
                />
                <FieldPickerControl
                  label="colour"
                  field="primary_colour_family"
                  value={garment.primary_colour_family ?? null}
                  options={COLOUR_OPTIONS}
                  snapshot={fieldSnapshot}
                  updateAction={updateGarmentAction}
                />
                <FieldPickerControl
                  label="fabric"
                  field="material"
                  value={garment.material ?? null}
                  options={MATERIAL_OPTIONS}
                  snapshot={fieldSnapshot}
                  updateAction={updateGarmentAction}
                />
              </div>
            ) : (
              <p className="pt-1.5 text-[12.5px] text-[var(--slate)]">
                {[garment.category, garment.primary_colour_family, garment.material]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {costPerWearText ? (
              <p className="pt-4 text-[11px] uppercase tracking-[.14em] text-[var(--stone)]">
                {costPerWearText} / wear
              </p>
            ) : null}
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
          <PricePanel
            garmentId={garment.id as string}
            currentPrice={garment.purchase_price ?? null}
            currentCurrency={garment.purchase_currency ?? null}
            mode="panel"
            setPriceAction={setPriceManuallyAction}
          />
          {garment.price_source ? (
            <p className="pt-2 text-[11px] text-[var(--stone)]">
              {PRICE_SOURCE_LABEL[garment.price_source] ?? garment.price_source}
            </p>
          ) : null}
        </section>

        {garment.recent_wear_events.length ? (
          <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
            <p className="pb-3 text-[9px] font-semibold uppercase tracking-[.18em] text-[var(--stone)]">
              recent wears
            </p>
            <WearHistorySection
              wearEvents={garment.recent_wear_events}
              updateAction={updateWearEventAction}
              deleteAction={deleteWearEventAction}
            />
          </section>
        ) : null}

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
            <Link
              href={`/local/list/${garment.id}`}
              className="text-[12.5px] text-[var(--oxblood)] underline"
            >
              list it locally
            </Link>
          </section>
        ) : null}

        {!isArchived ? (
          <section className="mt-8 border-t border-[rgba(30,26,23,.14)] pt-6">
            <DisposalControl
              garmentId={garment.id as string}
              pieceName={pieceName}
              archiveAction={archiveGarmentAction}
              undoAction={undoArchiveGarmentAction}
            />
            {mergeTargets.length ? (
              <div className="pt-4 text-center">
                <MergeControl
                  sourceGarmentId={garment.id as string}
                  sourceTitle={pieceName}
                  targets={mergeTargets}
                  mergeAction={mergeGarmentsAction}
                />
              </div>
            ) : null}
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
