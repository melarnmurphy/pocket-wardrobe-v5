export function PremiumUpsellCard({
  title,
  description,
  features,
  upgradeUrl,
  checkoutEnabled,
  compact = false
}: {
  title: string;
  description: string;
  features: readonly string[];
  upgradeUrl: string | null;
  checkoutEnabled: boolean;
  compact?: boolean;
}) {
  return (
    <section className={`pw-hero ${compact ? "p-5" : "p-6"}`}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/72">Premium</p>
      <h3 className={`mt-3 font-semibold tracking-[-0.03em] ${compact ? "text-xl" : "text-2xl"}`}>
        {title}
      </h3>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">{description}</p>

      <ul className="mt-4 space-y-2 text-sm text-white">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="mt-0.5 text-[var(--accent-highlight)]">•</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {checkoutEnabled && upgradeUrl ? (
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noreferrer"
            className="pw-button-secondary"
          >
            Upgrade To Premium
          </a>
        ) : (
          <span className="pw-button-quiet px-4 py-2 text-sm">
            Billing setup pending
          </span>
        )}

        <span className="text-xs uppercase tracking-[0.18em] text-white/70">
          {checkoutEnabled
            ? "Unlock assisted ingestion"
            : "Entitlements can be synced manually until billing is configured"}
        </span>
      </div>
    </section>
  );
}
