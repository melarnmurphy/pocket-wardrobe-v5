import type { Metadata } from "next";
import Image from "next/image";
import { MarketingFooter } from "@/components/marketing-chrome";
import styles from "@/app/marketing.module.css";

export const metadata: Metadata = {
  title: "Garderobe",
  description:
    "Garderobe turns the clothes you already own into outfits you’ll actually want to wear."
};

const SIGN_IN = "/sign-in?next=%2Fwardrobe";
const START = "/sign-in?mode=signup&next=%2Fonboarding";

const STRIP = [
  { file: "figure-blue-red-spheres.webp", alt: "figure in black tailoring on a blue ground" },
  { file: "look-red-dress-spheres.webp", alt: "red floral dress beside an inflatable red flower on a sage ground" },
  { file: "stack-knits-blue.webp", alt: "stack of folded knitwear on a blue ground" },
  { file: "figure-pink-brown.webp", alt: "figure in brown knitwear on a pink ground" },
  { file: "still-loafers-green.webp", alt: "black loafers on a plinth against a green ground" },
  { file: "look-zebra-blue.webp", alt: "brown zebra-print dress on a stone terrace" },
  { file: "figure-yellow-poster.webp", alt: "figure in yellow holding a printed poster" },
  { file: "cover-green-blazer.webp", alt: "figure in a cream blazer on a sage ground" },
  { file: "figure-lilac-chair.webp", alt: "figure in tailoring on a lilac ground" },
  { file: "figure-blue-flower.webp", alt: "figure in lime knitwear beside an inflatable red flower" },
  { file: "figure-apricot-coat.webp", alt: "figure in a grey coat on an apricot ground" }
] as const;

const CONTENTS = [
  { n: "01", label: "upload images of your wardrobe", href: "/how-it-works" },
  { n: "02", label: "record every wear", href: "/how-it-works" },
  { n: "03", label: "get recommendations on what to wear", href: "/how-it-works" },
  { n: "04", label: "sell it through resale", href: "/nearby" }
] as const;

export default function HomePage() {
  const strip = [...STRIP, ...STRIP];

  return (
    <main className={styles.page}>
      <section className={styles.cover} data-theme="blue" aria-label="Garderobe cover">
        <div className={styles.grain} />
        <div className={styles.vignette} />

        <div className={styles.nav}>
          <nav className={styles.navLinks} aria-label="Marketing">
            <a href="/how-it-works">how it works</a>
            <a href="/nearby">resale</a>
            <a href="/pricing">pricing</a>
          </nav>
          <div className={styles.navAuth}>
            <a href={SIGN_IN} className={styles.signIn}>
              sign in
            </a>
            <a href={START} className={styles.start}>
              start for free
            </a>
          </div>
        </div>

        <div className={styles.well}>
          <div className={styles.mastWrap}>
            <h1 className={styles.mast}>garderobe</h1>
          </div>
          <Image
            src="/marketing/figure-blue-red-spheres.webp"
            alt="figure in black tailoring on a blue ground"
            width={1122}
            height={1402}
            priority
            fetchPriority="high"
            decoding="async"
            className={styles.figure}
          />
          <div className={styles.block}>
            <p className={styles.headline}>
              your wardrobe
              <br />
              has more outfits
              <br />
              in it.
            </p>
            <p className={styles.dek}>
              Garderobe turns the clothes you already own into outfits you’ll actually want to wear.
            </p>
            <div className={styles.ctas}>
              <a href={START} className={styles.ctaFill}>
                Build my wardrobe
              </a>
              <a href="/how-it-works" className={styles.ctaOutline}>
                See how it works
              </a>
            </div>
          </div>
        </div>

        <div className={styles.stepRow}>
          <div className={styles.steps}>
            <span>01 · upload your wardrobe</span>
            <span>02 · record every wear</span>
            <span>03 · get recommendations</span>
          </div>
        </div>
      </section>

      <section className={styles.contents} aria-label="Contents">
        <div className={styles.contentsNav}>
          <nav className={styles.contentsLinks} aria-label="Contents">
            <a href="/how-it-works">how it works</a>
            <a href="/nearby">resale</a>
            <a href="/pricing">pricing</a>
          </nav>
          <div className={styles.contentsAuth}>
            <a href={SIGN_IN} className={styles.contentsSignIn}>
              sign in
            </a>
            <a href={START} className={styles.contentsStart}>
              start for free
            </a>
          </div>
        </div>

        <div className={styles.contentsMast}>
          <div className={styles.rule} />
          <p className={styles.contentsWord}>garderobe</p>
          <div className={styles.rule} />
        </div>

        <div className={styles.rows}>
          {CONTENTS.map((row) => (
            <a key={row.n} href={row.href} className={styles.row}>
              <span className={styles.numeral}>{row.n}</span>
              <span className={styles.label}>{row.label}</span>
            </a>
          ))}
          <p className={styles.pricing}>
            Free to keep every piece, every wear and every cost per wear.
          </p>
        </div>

        <div className={styles.strip} aria-hidden="true">
          <div className={styles.track}>
            {strip.map((item, index) => (
              <div key={`${item.file}-${index}`} className={styles.cell}>
                <Image
                  src={`/marketing/${item.file}`}
                  alt=""
                  width={288}
                  height={360}
                  loading="lazy"
                  sizes="288px"
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
