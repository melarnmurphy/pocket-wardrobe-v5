import type { UnlockScore } from "@/lib/domain/outfits/unlock";

export function UnlockCard({ score }: { score: UnlockScore }) {
  const sourceLabel = score.source === "lookbook" ? "Lookbook" : "Trend";

  return (
    <section className="pw-panel p-6">
      <p className="pw-kicker">Unlock</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
        {score.label}
      </h2>
      <p className="mt-2 text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
        {sourceLabel} · {score.unlock_count} outfits
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{score.reasoning}</p>
    </section>
  );
}
