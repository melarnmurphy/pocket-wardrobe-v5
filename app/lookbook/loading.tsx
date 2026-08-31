export default function LookbookLoading() {
  return (
    <main className="pw-shell flex min-h-screen max-w-7xl flex-col gap-8 md:px-10">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="h-16 w-96 max-w-full animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-64 animate-pulse rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.76)]"
          />
        ))}
      </div>
    </main>
  );
}
