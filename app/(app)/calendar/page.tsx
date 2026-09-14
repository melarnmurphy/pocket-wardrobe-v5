import { AuthenticationError } from "@/lib/auth";
import { listSavedOutfits } from "@/lib/domain/outfits/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { listWearEventsByDate } from "@/lib/domain/wear-events/service";
import { AuthRequiredCard } from "@/components/auth-required-card";
import { OutfitCalendar } from "@/components/outfit-calendar";

export const metadata = {
  title: "Calendar — Pocket Wardrobe"
};

function localTodayKey(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export default async function CalendarPage() {
  try {
    const [outfits, garments, wearsByDate] = await Promise.all([
      listSavedOutfits(),
      listWardrobeGarments(),
      listWearEventsByDate()
    ]);

    const previewByGarmentId = new Map<string, string | null>();
    for (const g of garments) previewByGarmentId.set(g.id as string, g.preview_url);

    const enriched = outfits.map((o) => ({
      ...o,
      items: o.items.map((it) => ({
        ...it,
        garment: {
          ...it.garment,
          preview_url:
            previewByGarmentId.get(it.garment.id) ?? it.garment.preview_url ?? null
        }
      }))
    }));

    return (
      <main className="pw-shell max-w-6xl">
        <div className="pw-page-head border-b border-[var(--line)] pb-8 pt-6">
          <div className="space-y-3">
            <p className="pw-kicker">The Calendar</p>
            <h1 className="pw-page-title">Plan your week.</h1>
          </div>
        </div>
        <div className="mt-8">
          <OutfitCalendar outfits={enriched} todayKey={localTodayKey()} wearsByDate={wearsByDate} />
        </div>
      </main>
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return (
        <main className="pw-shell">
          <AuthRequiredCard
            next="/calendar"
            title="Sign in with Supabase to use the calendar."
            description="This page reads and writes user-owned outfits protected by RLS, so it requires an authenticated Supabase session."
          />
        </main>
      );
    }
    throw error;
  }
}
