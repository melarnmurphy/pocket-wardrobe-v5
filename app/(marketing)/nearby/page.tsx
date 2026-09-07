import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  MARKETING_SIGN_IN,
  MARKETING_START,
  MarketingBar
} from "@/components/marketing-chrome";
import styles from "@/app/marketing.module.css";

export const metadata: Metadata = {
  title: "Nearby · Garderobe",
  description:
    "List pieces to people nearby with their wear count attached. Garderobe never takes a cut."
};

const LISTINGS = [
  { file: "dress-red-floral.png", name: "red floral midi", price: "A$120", meta: "unley · 6 km · worn 4 times" },
  { file: "piece-sheer-blouse.png", name: "sheer blouse", price: "A$45", meta: "norwood · 4 km · worn twice" },
  { file: "slip-dress-black.png", name: "black slip dress", price: "A$80", meta: "prospect · 9 km · worn 11 times" },
  { file: "piece-black-heels.png", name: "black heels", price: "A$60", meta: "hyde park · 5 km · worn 8 times" },
  { file: "shirt-dress-black.png", name: "shirt dress", price: "A$95", meta: "st peters · 3 km · worn once" },
  { file: "piece-bias-skirt.png", name: "bias slip skirt", price: "A$55", meta: "goodwood · 7 km · worn 19 times" },
  { file: "blouse-sheer-black.png", name: "black blouse", price: "A$40", meta: "kent town · 2 km · worn 6 times" },
  { file: "gown-black-front.png", name: "black gown", price: "A$240", meta: "north adelaide · 8 km · worn twice" }
] as const;

export default function NearbyMarketingPage() {
  return (
    <main className={styles.page}>
      <MarketingBar active="nearby" />
      <div className={styles.nearbyHead}>
        <div>
          <h1 className={styles.heroTitle}>not reaching for it? someone else might.</h1>
          <p className={styles.meta}>61 pieces listed within 30 km, each with its wear count attached</p>
        </div>
        <div className={styles.chips} aria-hidden="true">
          <span className={styles.chipFill}>adelaide</span>
          <span className={styles.chipFill}>30 km</span>
          <span className={styles.chipLine}>size 10</span>
          <span className={styles.chipLine}>under A$150</span>
        </div>
      </div>

      <div className={styles.listingGrid}>
        {LISTINGS.map((item) => (
          <article key={item.name}>
            <div className={styles.tilePhoto}>
              <Image
                src={`/cutouts/${item.file}`}
                alt=""
                fill
                sizes="(max-width: 1100px) 50vw, 25vw"
                style={{ objectFit: "contain", padding: 14 }}
              />
            </div>
            <div className={styles.tileRow}>
              <span>{item.name}</span>
              <span>{item.price}</span>
            </div>
            <p className={styles.tileMeta}>{item.meta}</p>
          </article>
        ))}
      </div>

      <div className={styles.darkBar}>
        <p>
          List pieces to people nearby with their wear count attached. Pick a public meeting place,
          settle up directly and send a good piece into its next era.
        </p>
        <nav>
          <Link href={MARKETING_SIGN_IN} className={styles.ctaGhost}>
            sign in
          </Link>
          <Link href={MARKETING_START} className={styles.ctaBlush}>
            start for free
          </Link>
        </nav>
      </div>
    </main>
  );
}
