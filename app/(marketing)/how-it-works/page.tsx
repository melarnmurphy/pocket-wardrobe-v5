import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  MARKETING_START,
  MarketingBar,
  MarketingFooter
} from "@/components/marketing-chrome";
import styles from "@/app/marketing.module.css";

export const metadata: Metadata = {
  title: "How it works · Garderobe",
  description: "Bring your wardrobe in, log every wear, and get recommendations from what you already own."
};

export default function HowItWorksPage() {
  return (
    <main className={styles.page}>
      <MarketingBar active="how-it-works" />
      <div className={styles.inner}>
        <h1 className={styles.heroTitle}>wear more. waste less.</h1>

        <div className={styles.step}>
          <div className={styles.stepNum}>01</div>
          <div>
            <h2 className={styles.stepTitle}>bring it all in.</h2>
            <p className={styles.stepCopy}>
              Add unlimited pieces from your camera roll, receipts or product links. Your whole
              wardrobe, together in one place.
            </p>
          </div>
          <div className={styles.stepVisual}>
            <Image
              src="/cutouts/piece-cowl-tee.png"
              alt=""
              width={90}
              height={132}
              style={{ width: "auto", height: "auto" }}
            />
            <Image
              src="/cutouts/piece-wide-trouser.png"
              alt=""
              width={80}
              height={152}
              style={{ width: "auto", height: "auto" }}
            />
          </div>
        </div>

        <div className={styles.step}>
          <div className={styles.stepNum}>02</div>
          <div>
            <h2 className={styles.stepTitle}>wear it. log it. know it.</h2>
            <p className={styles.stepCopy}>
              Each wear brings your cost per wear down and helps Garderobe understand what you
              actually reach for. It also remembers what is in the wash, so your planner never
              suggests the unavailable.
            </p>
          </div>
          <div className={styles.stepVisual}>
            <div className={styles.cpwCard}>
              <div className={styles.cpwLabel}>cowl-neck tee</div>
              <div className={styles.cpwValue}>
                <strong>A$1.10</strong>
                <span>per wear</span>
              </div>
              <div className={styles.cpwBar}>
                <span />
              </div>
              <p className={styles.tileMeta}>41 wears since may 2024</p>
            </div>
          </div>
        </div>

        <div className={styles.step}>
          <div className={styles.stepNum}>03</div>
          <div>
            <h2 className={styles.stepTitle}>make better calls.</h2>
            <p className={styles.stepCopy}>
              Get recommendations on what to wear from the clothes you already own — weather,
              occasion, and what is actually free to use. Pieces you stop reaching for can go
              through resale.
            </p>
          </div>
          <div className={styles.stepVisual}>
            <Image
              src="/cutouts/dress-red-floral.png"
              alt=""
              width={90}
              height={152}
              style={{ width: "auto", height: "auto" }}
            />
            <div>
              <div style={{ fontSize: 13, lineHeight: 1.3, color: "var(--ink)" }}>unley · 6 km</div>
              <div style={{ fontSize: 13, paddingTop: 6, color: "var(--oxblood)" }}>A$120</div>
            </div>
          </div>
        </div>

        <div className={styles.ready}>
          <p>ready when you are.</p>
          <div className={styles.ctas}>
            <Link href={MARKETING_START} className={styles.ctaFill}>
              start for free
            </Link>
            <Link href="/pricing" className={styles.ctaOutline}>
              see pricing
            </Link>
          </div>
        </div>
      </div>
      <MarketingFooter />
    </main>
  );
}
