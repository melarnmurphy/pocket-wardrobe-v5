export default function AppLoading() {
  return (
    <main className="pw-shell py-10">
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="h-16 w-72 max-w-full animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-[rgba(17,17,17,0.05)]" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="h-56 animate-pulse rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.76)]"
          />
        ))}
      </div>
    </main>
  );
}
