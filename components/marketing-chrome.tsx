import styles from "@/app/marketing.module.css";
import Link from "next/link";

export const MARKETING_SIGN_IN = "/sign-in?next=%2Fwardrobe";
export const MARKETING_START = "/sign-in?mode=signup&next=%2Fonboarding";

export type MarketingSection = "how-it-works" | "resale" | "pricing";

const LINKS: { href: "/how-it-works" | "/nearby" | "/pricing"; id: MarketingSection; label: string }[] = [
  { href: "/how-it-works", id: "how-it-works", label: "how it works" },
  { href: "/nearby", id: "resale", label: "resale" },
  { href: "/pricing", id: "pricing", label: "pricing" }
];

export function MarketingBar({ active }: { active?: MarketingSection | null }) {
  return (
    <div className={styles.contentsNav}>
      <Link href="/" className={styles.navWord} aria-label="Garderobe home">
        garderobe
      </Link>
      <nav className={styles.contentsLinks} aria-label="Marketing">
        {LINKS.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            className={active === link.id ? styles.navActive : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className={styles.contentsAuth}>
        <Link href={MARKETING_SIGN_IN} className={styles.contentsSignIn}>
          sign in
        </Link>
        <Link href={MARKETING_START} className={styles.contentsStart}>
          start for free
        </Link>
      </div>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className={styles.legal}>
      <Link href="/" className={styles.legalWord}>
        garderobe
      </Link>
      <span className={styles.legalPlace}>adelaide</span>
      <div className={styles.legalLinks}>
        <span>privacy</span>
        <span>terms</span>
        <span>contact</span>
      </div>
    </footer>
  );
}
