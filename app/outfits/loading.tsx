export default function OutfitsLoading() {
  return (
    <main className="pw-shell flex min-h-screen flex-col gap-8">
      <div className="pw-editorial-frame overflow-hidden p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[rgba(17,17,17,0.07)]" />
              <div className="h-14 w-56 animate-pulse rounded-[10px] bg-[rgba(17,17,17,0.07)]" />
              <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-[rgba(17,17,17,0.05)]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-t border-[var(--line)] pt-4 space-y-2">
                  <div className="h-2.5 w-16 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
                  <div className="h-7 w-24 animate-pulse rounded-[8px] bg-[rgba(17,17,17,0.07)]" />
                </div>
              ))}
            </div>
          </div>
          <div className="pw-panel-soft h-48 animate-pulse bg-[rgba(17,17,17,0.03)]" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="pw-panel-soft p-4 md:p-5">
          <div className="mb-4 space-y-3">
            <div className="h-3 w-20 animate-pulse rounded-full bg-[rgba(17,17,17,0.06)]" />
            <div className="h-8 w-52 animate-pulse rounded-[8px] bg-[rgba(17,17,17,0.07)]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-[8px] border border-[var(--line)] bg-[rgba(255,255,255,0.76)]"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
