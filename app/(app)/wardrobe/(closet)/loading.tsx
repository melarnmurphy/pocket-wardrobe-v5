export default function ClosetLoading() {
  return (
    <section className="space-y-5 px-4 py-6 md:px-0">
      <div className="pw-page-head gap-4">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
          <div className="h-20 w-80 max-w-full animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
          <div className="h-4 w-64 animate-pulse rounded-full bg-[rgba(17,17,17,0.05)]" />
        </div>
        <div className="h-11 w-32 animate-pulse rounded-full bg-[rgba(17,17,17,0.08)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
          <div
            key={item}
            className="h-72 animate-pulse rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.76)]"
          />
        ))}
      </div>
    </section>
  );
}
