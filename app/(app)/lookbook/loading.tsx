export default function LookbookLoading() {
  return (
    <main className="pw-shell flex min-h-screen max-w-7xl flex-col gap-8 md:px-10">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="h-16 w-96 max-w-full animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
      </div>
      <div className="grid gap-x-10 gap-y-0 border-t border-[var(--line)] pt-8 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-64 animate-pulse border-b border-[var(--line)] bg-transparent"
          />
        ))}
      </div>
    </main>
  );
}
