import styles from "@/app/marketing.module.css";

export const MARKETING_SIGN_IN = "/sign-in?next=%2Fwardrobe";
export const MARKETING_START = "/sign-in?mode=signup&next=%2Fonboarding";

export type MarketingSection = "how-it-works" | "nearby" | "pricing";

const LINKS: { href: "/how-it-works" | "/nearby" | "/pricing"; id: MarketingSection; label: string }[] = [
  { href: "/how-it-works", id: "how-it-works", label: "how it works" },
  { href: "/nearby", id: "nearby", label: "nearby" },
  { href: "/pricing", id: "pricing", label: "pricing" }
];

export function MarketingBar({ active }: { active?: MarketingSection | null }) {
  return (
    <div className={styles.contentsNav}>
      <a href="/" className={styles.navWord} aria-label="Garderobe home">
        garderobe
      </a>
      <nav className={styles.contentsLinks} aria-label="Marketing">
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={link.href}
            className={active === link.id ? styles.navActive : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className={styles.contentsAuth}>
        <a href={MARKETING_SIGN_IN} className={styles.contentsSignIn}>
          sign in
        </a>
        <a href={MARKETING_START} className={styles.contentsStart}>
          start for free
        </a>
      </div>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.legal}>
      <a href="/" className={styles.legalWord}>
        garderobe
      </a>
      <span className={styles.legalPlace}>adelaide</span>
      <div className={styles.legalLinks}>
        <span>privacy</span>
        <span>terms</span>
        <span>contact</span>
      </div>
    </footer>
  );
}
