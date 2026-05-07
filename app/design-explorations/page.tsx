import {
  Cormorant_Garamond,
  Fraunces,
  JetBrains_Mono,
  Space_Grotesk
} from "next/font/google";

import { AtelierShowcase } from "./options/atelier";
import { ClothSimulationShowcase } from "./options/clo-simulation";
import { EditorialShowcase } from "./options/editorial";
import { GalleryShowcase } from "./options/gallery";
import { MuseShowcase } from "./options/muse";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"]
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant"
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains"
});
const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space"
});

export const metadata = {
  title: "Design Explorations · Pocket Wardrobe",
  description: "Mobile design directions for the Pocket Wardrobe app, including a cloth simulation concept."
};

const OPTIONS = [
  {
    id: "atelier",
    name: "Atelier",
    tag: "01 / Editorial Minimal",
    summary:
      "The closest interpretation of your reference. Ivory paper, warm ink, italic serif wordmark, tab-underline navigation, and a black floating dock with a circular FAB. Built around generous whitespace and one ink colour.",
    palette: ["#f5f2ec", "#eeeae3", "#1a1916"],
    typography: "Fraunces (italic) · Plus Jakarta",
    Showcase: AtelierShowcase
  },
  {
    id: "gallery",
    name: "Gallery",
    tag: "02 / Magazine Modernist",
    summary:
      "High-contrast editorial spread. Pure white with hairline rules, a single orange-red accent, Fraunces display set against JetBrains Mono micro-text, and numbered indices like a printed magazine. Reads as a publication, not an app.",
    palette: ["#ffffff", "#0a0a0a", "#e0431a"],
    typography: "Fraunces · JetBrains Mono",
    Showcase: GalleryShowcase
  },
  {
    id: "muse",
    name: "Muse",
    tag: "03 / Romantic Soft Minimal",
    summary:
      "Champagne paper, walnut ink, suede-tan accent. Cormorant Garamond italic for warmth, soft 16–20px shadows, dotted category strips and a floating pill dock. The most lived-in and tactile of the three.",
    palette: ["#faf6f1", "#f1ebe1", "#b8855b", "#2c1f1b"],
    typography: "Cormorant Garamond · Plus Jakarta",
    Showcase: MuseShowcase
  },
  {
    id: "cloth-simulation",
    name: "Simulation",
    tag: "04 / CLO-Style Cloth Lab",
    summary:
      "A technical fitting-room direction for cloth simulation: neutral CAD workspace, material physics controls, stress-map overlays, avatar fit review, and explainable rule notes that stay connected to wardrobe data.",
    palette: ["#f7f7f2", "#23282d", "#2ab7c6", "#d5962f", "#b85f42"],
    typography: "Space Grotesk · JetBrains Mono",
    Showcase: ClothSimulationShowcase
  },
  {
    id: "editorial",
    name: "Editorial · current",
    tag: "00 / Keep what you have",
    summary:
      "Your existing vibrant editorial system kept verbatim — Space Grotesk display, the purple → pink → gold gradient, oversized uppercase headlines, glass nav rail. Listed here for direct comparison.",
    palette: ["#fbfaf8", "#7b5cf0", "#ff6b9d", "#ffd166"],
    typography: "Space Grotesk · Plus Jakarta",
    Showcase: EditorialShowcase
  }
] as const;

export default function DesignExplorationsPage() {
  return (
    <main
      className={`${fraunces.variable} ${cormorant.variable} ${jetbrains.variable} ${space.variable}`}
      style={{
        background: "#ece8e1",
        minHeight: "100vh",
        color: "#1a1916"
      }}
    >
      <PageHeader />
      <div className="mx-auto w-full max-w-[110rem] px-6 pb-24 pt-8">
        <div className="grid gap-16">
          {OPTIONS.map((opt, idx) => (
            <OptionBlock key={opt.id} option={opt} index={idx} />
          ))}
        </div>
        <Footer />
      </div>
    </main>
  );
}

function PageHeader() {
  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "rgba(236,232,225,0.85)",
        backdropFilter: "blur(18px)",
        borderBottom: "0.5px solid rgba(26,25,22,0.1)"
      }}
    >
      <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span
            className="font-[var(--font-fraunces)] italic"
            style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.03em" }}
          >
            n.
          </span>
          <span
            className="font-[var(--font-jetbrains)]"
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(26,25,22,0.6)"
            }}
          >
            Design Explorations · Apr 26
          </span>
        </div>
        <nav className="flex items-center gap-1 rounded-full" style={{ background: "#fff", border: "0.5px solid rgba(26,25,22,0.1)", padding: 4 }}>
          {OPTIONS.map((opt, i) => (
            <a
              key={opt.id}
              href={`#${opt.id}`}
              className="font-[var(--font-fraunces)] rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                color: i === 0 ? "#faf8f3" : "#1a1916",
                background: i === 0 ? "#1a1916" : "transparent",
                letterSpacing: "-0.005em"
              }}
            >
              {opt.name}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

type Opt = (typeof OPTIONS)[number];

function OptionBlock({ option, index }: { option: Opt; index: number }) {
  const { id, name, tag, summary, palette, typography, Showcase } = option;
  return (
    <section id={id} className="scroll-mt-24">
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p
            className="font-[var(--font-jetbrains)]"
            style={{
              fontSize: 10,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(26,25,22,0.55)"
            }}
          >
            {tag}
          </p>
          <h2
            className="font-[var(--font-fraunces)] mt-4"
            style={{
              fontSize: 64,
              fontWeight: 400,
              letterSpacing: "-0.04em",
              lineHeight: 0.92
            }}
          >
            {name === "Editorial · current" ? (
              <>
                Editorial
                <br />
                <span style={{ fontStyle: "italic", color: "rgba(26,25,22,0.55)", fontSize: 26, letterSpacing: "-0.01em" }}>
                  current style
                </span>
              </>
            ) : (
              <>
                <span style={{ fontStyle: "italic" }}>{name}.</span>
              </>
            )}
          </h2>
          <p
            className="mt-5"
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: "rgba(26,25,22,0.72)",
              maxWidth: "32ch"
            }}
          >
            {summary}
          </p>
          <div className="mt-6 grid gap-3">
            <Detail label="Typography" value={typography} />
            <Detail label="Palette">
              <div className="flex gap-1.5">
                {palette.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 999,
                      background: c,
                      border: "0.5px solid rgba(26,25,22,0.12)"
                    }}
                  />
                ))}
              </div>
            </Detail>
            <Detail label="Status" value={index === 3 ? "Live in app" : "Preview only"} />
          </div>
          <div className="mt-7 flex gap-3">
            <button
              className="rounded-full"
              style={{
                background: "#1a1916",
                color: "#faf8f3",
                padding: "10px 16px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase"
              }}
            >
              Pick this direction
            </button>
            <button
              className="rounded-full"
              style={{
                background: "transparent",
                border: "0.5px solid rgba(26,25,22,0.2)",
                padding: "10px 16px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#1a1916"
              }}
            >
              Refine
            </button>
          </div>
        </div>

        <div
          className="rounded-[28px] p-6 sm:p-8"
          style={{
            background: "#fbf9f5",
            border: "0.5px solid rgba(26,25,22,0.08)",
            boxShadow: "0 30px 80px -40px rgba(26,25,22,0.18)"
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <p
              className="font-[var(--font-jetbrains)]"
              style={{
                fontSize: 10,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(26,25,22,0.55)"
              }}
            >
              Three screens · scroll →
            </p>
            <p
              className="font-[var(--font-jetbrains)]"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "rgba(26,25,22,0.4)"
              }}
            >
              iPhone · 360 × 760
            </p>
          </div>
          <div className="overflow-x-auto">
            <Showcase />
          </div>
        </div>
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  children
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
      <p
        className="font-[var(--font-jetbrains)]"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "rgba(26,25,22,0.5)"
        }}
      >
        {label}
      </p>
      {value ? (
        <p
          className="font-[var(--font-fraunces)]"
          style={{ fontSize: 14, fontWeight: 400, letterSpacing: "-0.01em" }}
        >
          {value}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-20 grid gap-3 border-t pt-6" style={{ borderColor: "rgba(26,25,22,0.12)" }}>
      <p
        className="font-[var(--font-fraunces)] italic"
        style={{ fontSize: 24, letterSpacing: "-0.025em", maxWidth: "44ch" }}
      >
        Pick a direction and we'll port the live app — wardrobe, planner, trends and lookbook —
        into that language.
      </p>
      <p
        className="font-[var(--font-jetbrains)]"
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(26,25,22,0.5)"
        }}
      >
        Pocket Wardrobe · /design-explorations
      </p>
    </div>
  );
}
