export default function ClosetLoading() {
  return (
    <section className="space-y-5 px-4 py-6 md:px-0" aria-busy="true" aria-label="Opening wardrobe">
      <div className="pw-page-head gap-4">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
          <div className="h-20 w-80 max-w-full animate-pulse bg-[rgba(17,17,17,0.07)]" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded-full bg-[rgba(17,17,17,0.05)]" />
        </div>
        <div className="h-11 w-32 animate-pulse rounded-full bg-[rgba(17,17,17,0.08)]" />
      </div>
      <div className="border-t border-[var(--line)]">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex h-32 items-end border-b border-[var(--line)] pb-4">
            <div className="h-3 w-40 animate-pulse rounded-full bg-[rgba(17,17,17,0.05)]" />
          </div>
        ))}
      </div>
    </section>
  );
}
