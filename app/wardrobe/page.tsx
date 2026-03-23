import { AuthenticationError } from "@/lib/auth";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listRecentWearEvents } from "@/lib/domain/wear-events/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { WardrobeShop } from "@/components/wardrobe-shop";
import {
  addGarmentImageAction,
  createGarmentAction,
  deleteGarmentAction,
  logWearAction,
  updateGarmentAction,
  toggleGarmentFavouriteAction
} from "@/app/wardrobe/actions";

export default async function WardrobePage() {
  try {
    const [garments, wearEvents] = await Promise.all([
      listWardrobeGarments(),
      listRecentWearEvents()
    ]);

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        <WardrobeShop
          garments={garments}
          createGarmentAction={createGarmentAction}
          addGarmentImageAction={addGarmentImageAction}
          deleteGarmentAction={deleteGarmentAction}
          toggleGarmentFavouriteAction={toggleGarmentFavouriteAction}
          logWearAction={logWearAction}
          updateGarmentAction={updateGarmentAction}
        />

        <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <aside className="space-y-6">
            <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6">
              <h2 className="text-2xl font-semibold">Recent Wear Events</h2>
              <div className="mt-5 space-y-3">
                {wearEvents.length ? (
                  wearEvents.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 overflow-hidden rounded-[1rem] border border-[var(--line)] bg-white">
                          {event.garment_preview_url ? (
                            <img
                              src={event.garment_preview_url}
                              alt={event.garment_title || event.garment_category || "Garment"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                              Wear
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {event.garment_title || event.garment_category || "Wardrobe item"}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {[event.garment_brand, event.garment_category]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            {new Date(event.worn_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {event.occasion ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          Occasion: {event.occasion}
                        </p>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    No wear events logged yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[var(--line)] bg-white/65 p-6">
              <h2 className="text-2xl font-semibold">What This Slice Covers</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <li>`garments` manual create flow</li>
                <li>`garment_images` original image registration</li>
                <li>`garment_sources` provenance on upload</li>
                <li>`wear_events` logging</li>
                <li>`wear_count`, `last_worn_at`, and `cost_per_wear` via DB triggers</li>
              </ul>
            </section>
          </aside>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <AuthRequiredCard
          next="/wardrobe"
          title="Sign in with Supabase to use the wardrobe workspace."
          description="This page reads and writes user-owned tables protected by RLS, so it requires an authenticated Supabase session."
        />
      );
    }

    throw error;
  }
}
