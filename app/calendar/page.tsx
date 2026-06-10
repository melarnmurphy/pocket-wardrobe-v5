import { AuthenticationError } from "@/lib/auth";
import { listSavedOutfits } from "@/lib/domain/outfits/service";
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
    const outfits = await listSavedOutfits();
    return (
      <main className="pw-shell">
        <div className="mx-auto max-w-2xl pt-6 text-center">
          <p
            className="text-[0.72rem] font-semibold uppercase"
            style={{ letterSpacing: "0.32em", color: "var(--muted)" }}
          >
            The Calendar
          </p>
          <h1
            className="mt-3 italic"
            style={{
              fontFamily: "var(--font-display), serif",
              fontSize: "clamp(2rem, 6vw, 3rem)",
              fontWeight: 400,
              letterSpacing: "-0.03em"
            }}
          >
            Plan your week.
          </h1>
        </div>
        <div className="mt-8">
          <OutfitCalendar outfits={outfits} todayKey={localTodayKey()} />
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
