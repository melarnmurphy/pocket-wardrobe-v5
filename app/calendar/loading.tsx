export default function CalendarLoading() {
  return (
    <main className="pw-shell">
      <div className="mx-auto max-w-2xl space-y-3 pt-6 text-center">
        <div className="mx-auto h-3 w-28 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="mx-auto h-12 w-56 animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
      </div>
      <div className="mt-8 h-[28rem] animate-pulse rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.76)]" />
    </main>
  );
}
