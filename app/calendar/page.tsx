import Link from "next/link";

export const metadata = {
  title: "Calendar — Pocket Wardrobe"
};

export default function CalendarPage() {
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
          className="mt-4 italic"
          style={{
            fontFamily: "var(--font-display), serif",
            fontSize: "clamp(3rem, 8vw, 5rem)",
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 0.95
          }}
        >
          Coming
          <br />
          shortly.
        </h1>
        <p
          className="mx-auto mt-6 max-w-md"
          style={{ color: "var(--muted)", lineHeight: 1.65 }}
        >
          A day-by-day fitting view tied to your planner, with a month grid and
          editable outfits per day. The plan you make in the Planner will land here.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/outfits"
            className="rounded-full px-5 py-2.5 text-[0.78rem] font-semibold uppercase"
            style={{
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              letterSpacing: "0.18em"
            }}
          >
            Open planner
          </Link>
          <Link
            href="/wardrobe"
            className="rounded-full border px-5 py-2.5 text-[0.78rem] font-semibold uppercase"
            style={{
              borderColor: "var(--line)",
              color: "var(--foreground)",
              letterSpacing: "0.18em"
            }}
          >
            Closet
          </Link>
        </div>
      </div>
    </main>
  );
}
