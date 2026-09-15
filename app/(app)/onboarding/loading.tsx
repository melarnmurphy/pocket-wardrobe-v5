export default function OnboardingLoading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 py-10"
      style={{ background: "var(--cream)", color: "var(--ink)" }}
      aria-busy="true"
      aria-label="Opening onboarding"
    >
      <div className="w-full max-w-[480px]">
        <div className="flex gap-1 pb-8" aria-hidden="true">
          <div className="h-[3px] flex-1 rounded-[2px]" style={{ background: "var(--oxblood)" }} />
          <div className="h-[3px] flex-1 rounded-[2px]" style={{ background: "rgba(30,26,23,.14)" }} />
          <div className="h-[3px] flex-1 rounded-[2px]" style={{ background: "rgba(30,26,23,.14)" }} />
        </div>
        <p className="text-[11px] uppercase tracking-[.18em] text-[var(--stone)]">opening your wardrobe</p>
        <div className="mt-4 h-[1px] w-24 animate-pulse" style={{ background: "var(--oxblood)" }} />
      </div>
    </main>
  );
}
