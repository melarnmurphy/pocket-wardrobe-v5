export default function AppLoading() {
  return (
    <main className="pw-shell py-10">
      <div className="space-y-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
        <div className="h-16 w-72 max-w-full animate-pulse bg-[rgba(17,17,17,0.07)]" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-[rgba(17,17,17,0.05)]" />
      </div>
      <div className="mt-8 border-t border-[var(--line)]">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse border-b border-[var(--line)] bg-transparent"
          />
        ))}
      </div>
    </main>
  );
}
