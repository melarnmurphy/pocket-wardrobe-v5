export default function TrendsLoading() {
  return (
    <main className="pw-shell max-w-6xl py-12">
      <div className="space-y-3">
        <div className="h-3 w-36 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="h-16 w-80 max-w-full animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-48 animate-pulse rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.76)]"
          />
        ))}
      </div>
    </main>
  );
}
