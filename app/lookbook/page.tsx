import { AuthenticationError } from "@/lib/auth";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { LookbookEntryForm } from "@/components/lookbook-entry-form";
import { LookbookEntryCard } from "@/components/lookbook-entry-card";
import {
  listLookbookEntries,
  listWardrobeOptionsForLookbook
} from "@/lib/domain/lookbook/service";
import {
  createLookbookEntryFormAction,
  createLookbookItemFormAction,
  deleteLookbookEntryFormAction,
  deleteLookbookItemFormAction,
  updateLookbookEntryFormAction,
  updateLookbookItemFormAction
} from "@/app/lookbook/actions";

export default async function LookbookPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const [entries, garments] = await Promise.all([
      listLookbookEntries(),
      listWardrobeOptionsForLookbook()
    ]);
    const activeEntryId = firstParam(resolvedSearchParams?.entry) ?? null;
    const initialCreateFocused =
      firstParam(resolvedSearchParams?.create) === "1" && !activeEntryId;

    return (
      <main className="pw-shell flex min-h-screen max-w-7xl flex-col gap-8 md:px-10">
        <div className="pw-page-head">
          <div className="space-y-3">
            <p className="pw-kicker">Lookbook</p>
            <h1 className="pw-page-title">Build a board for references, not owned items.</h1>
            <p className="pw-page-copy">
              Save inspiration, wishlist pieces, and styling targets as a separate planning layer.
            </p>
          </div>
          <div className="pw-meta-row">
            <span>{entries.length} saved references</span>
            <span className="divider">/</span>
            <span>
              {entries.reduce((total, entry) => total + entry.items.length, 0)} linked items
            </span>
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
          <LookbookEntryForm
            action={createLookbookEntryFormAction}
            initialIsActive={initialCreateFocused}
          />

          <section className="pw-panel-soft p-6">
            <div className="mb-5">
              <p className="pw-kicker">Saved References</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Your visual planning layer</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {entries.length} entr{entries.length === 1 ? "y" : "ies"} in the
                current user lookbook.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {entries.length ? (
                entries.map((entry) => (
                  <LookbookEntryCard
                    key={entry.id}
                    entry={entry}
                    isActive={entry.id === activeEntryId}
                    garments={garments}
                    deleteEntryAction={deleteLookbookEntryFormAction}
                    updateEntryAction={updateLookbookEntryFormAction}
                    createItemAction={createLookbookItemFormAction}
                    deleteItemAction={deleteLookbookItemFormAction}
                    updateItemAction={updateLookbookItemFormAction}
                  />
                ))
              ) : (
                <p className="pw-empty-state text-sm text-[var(--muted)] lg:col-span-2">
                  No lookbook entries yet. Save the first reference, wishlist item,
                  or styling target above.
                </p>
              )}
            </div>
          </section>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/lookbook"
          title="Sign in with Supabase to use the lookbook workspace."
          description="Lookbook entries are user-owned records protected by RLS, so this page requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
