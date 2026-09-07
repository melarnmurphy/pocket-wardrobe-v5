import type { Metadata } from "next";
import Link from "next/link";
import {
  MARKETING_START,
  MarketingBar,
  MarketingFooter
} from "@/components/marketing-chrome";
import styles from "@/app/marketing.module.css";

export const metadata: Metadata = {
  title: "Pricing · Garderobe",
  description:
    "Free to keep every piece, every wear and every cost per wear. Plus is A$69 a year."
};

const PLUS_ROWS = [
  { n: "61%", label: "rotation, palette and per-wear over time" },
  { n: "+3", label: "in-store scan with the unlock score" },
  { n: "18", label: "trend calls, packing and the let-go list" },
  { n: "9", label: "availability, so nothing in the wash is suggested" }
] as const;

export default function PricingPage() {
  return (
    <main className={styles.page}>
      <MarketingBar active="pricing" />
      <div className={styles.inner}>
        <div className={styles.priceGrid}>
          <div>
            <h1 className={styles.heroTitle}>Your whole wardrobe, in one place.</h1>
            <p className={styles.lede}>
              Add unlimited pieces from photos, receipts or cut-outs, and see the real cost per wear
              of everything you own. Plus is A$69 a year for rotation analytics, in-store scan, trend
              calls and packing, and availability — wear planning, looks and cost per wear stay free.
            </p>
            <div style={{ paddingTop: 40, borderTop: "1px solid rgba(30,26,23,.14)", marginTop: 40 }}>
              {PLUS_ROWS.map((row) => (
                <div key={row.label} className={styles.featureRow}>
                  <span className={styles.featureNum}>{row.n}</span>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
            <p className={styles.fine}>
              Free, always: unlimited pieces and looks however you add them, cost per wear, receipt
              and store connections, the wear calendar, search, and your photos on your own device.
              Local threads is free on both plans — no commission, and no money moves through
              Garderobe.
            </p>
          </div>

          <div className={styles.plans}>
            <div className={`${styles.plan} ${styles.planAnnual}`}>
              <div className={styles.planTop}>
                <div>annual</div>
                <div className={styles.save}>save 42%</div>
              </div>
              <div className={styles.planPrice}>
                <strong>A$69</strong>
                <span>a year · A$5.75 a month</span>
              </div>
              <Link href={MARKETING_START} className={`${styles.planCta} ${styles.planCtaFill}`}>
                start 14 days free
              </Link>
            </div>
            <div className={styles.plan}>
              <div className={styles.planTop}>monthly</div>
              <div className={styles.planPrice}>
                <strong>A$9.90</strong>
                <span>a month</span>
              </div>
              <Link href={MARKETING_START} className={`${styles.planCta} ${styles.planCtaLine}`}>
                start 14 days free
              </Link>
            </div>
            <p className={styles.fine}>
              Cancel any time. We’ll remind you two days before the trial ends.
            </p>
          </div>
        </div>
      </div>
      <MarketingFooter />
    </main>
  );
}
