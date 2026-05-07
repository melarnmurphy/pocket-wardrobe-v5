import { PhoneFrame } from "./phone-frame";

const INK = "#0a0a0a";
const PAPER = "#ffffff";
const ACCENT = "#e0431a";
const MUTED = "#8a8a8a";
const HAIR = "rgba(10,10,10,0.08)";
const HAIR_STRONG = "rgba(10,10,10,0.16)";

export function GalleryShowcase() {
  return (
    <div className="flex flex-nowrap gap-8">
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenIndex />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenWardrobe />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenSchedule />
      </PhoneFrame>
    </div>
  );
}

function Header({ section, n }: { section: string; n: string }) {
  return (
    <>
      <div className="flex items-center justify-between px-6 pt-12">
        <span
          className="font-[var(--font-jetbrains)]"
          style={{
            fontSize: 10,
            color: INK,
            letterSpacing: "0.18em",
            textTransform: "uppercase"
          }}
        >
          POCKET / WARDROBE
        </span>
        <span
          className="font-[var(--font-jetbrains)]"
          style={{
            fontSize: 10,
            color: MUTED,
            letterSpacing: "0.16em"
          }}
        >
          {n}
        </span>
      </div>
      <div className="mx-6 mt-3 h-px" style={{ background: INK }} />
      <div className="flex items-baseline justify-between px-6 pt-3">
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 9.5, color: MUTED, letterSpacing: "0.22em", textTransform: "uppercase" }}
        >
          § {section}
        </span>
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 9.5, color: MUTED, letterSpacing: "0.16em" }}
        >
          NO.{n}
        </span>
      </div>
    </>
  );
}

function ScreenIndex() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Header section="EDITION 04 — SPRING" n="001" />
      <div className="px-6 pt-7">
        <h1
          className="font-[var(--font-fraunces)]"
          style={{
            fontSize: 76,
            fontWeight: 300,
            letterSpacing: "-0.05em",
            lineHeight: 0.86
          }}
        >
          The
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 300 }}>quiet</span>
          <br />
          closet.
        </h1>
        <div className="mt-6 flex items-end gap-4">
          <span
            className="font-[var(--font-fraunces)]"
            style={{ fontSize: 46, fontWeight: 400, letterSpacing: "-0.05em", color: ACCENT, lineHeight: 0.9 }}
          >
            142
          </span>
          <span
            className="font-[var(--font-jetbrains)] mb-1"
            style={{ fontSize: 10, color: MUTED, letterSpacing: "0.18em", textTransform: "uppercase" }}
          >
            pieces
            <br />
            indexed
          </span>
        </div>
      </div>
      <div className="mx-6 mt-7 h-px" style={{ background: HAIR }} />
      <div className="grid grid-cols-3 gap-3 px-6 pt-5">
        {[
          { n: "01", l: "Outerwear", c: 18 },
          { n: "02", l: "Knits", c: 24 },
          { n: "03", l: "Shirts", c: 32 },
          { n: "04", l: "Trousers", c: 19 },
          { n: "05", l: "Skirts", c: 8 },
          { n: "06", l: "Footwear", c: 21 }
        ].map((c) => (
          <div key={c.n} className="aspect-[3/4]" style={{ borderTop: `1px solid ${INK}` }}>
            <div className="flex items-center justify-between pt-2">
              <span
                className="font-[var(--font-jetbrains)]"
                style={{ fontSize: 9, color: MUTED, letterSpacing: "0.18em" }}
              >
                /{c.n}
              </span>
              <span
                className="font-[var(--font-jetbrains)]"
                style={{ fontSize: 9, color: MUTED }}
              >
                {c.c}
              </span>
            </div>
            <p
              className="mt-2 font-[var(--font-fraunces)]"
              style={{ fontSize: 17, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.05 }}
            >
              {c.l}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-6 mt-5 h-px" style={{ background: INK }} />
      <div className="flex items-center justify-between px-6 pt-3">
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 9, color: MUTED, letterSpacing: "0.22em", textTransform: "uppercase" }}
        >
          → continue reading
        </span>
        <span style={{ width: 7, height: 7, background: ACCENT, borderRadius: 999 }} />
      </div>
      <BottomDockGallery active="closet" />
    </div>
  );
}

function ScreenWardrobe() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Header section="WARDROBE / KNITS" n="032" />
      <div className="flex items-end justify-between px-6 pt-5">
        <h2
          className="font-[var(--font-fraunces)]"
          style={{ fontSize: 48, fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 0.92 }}
        >
          <span style={{ fontStyle: "italic" }}>Knit</span>
          <br />
          archive
        </h2>
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 10, color: MUTED, letterSpacing: "0.16em" }}
        >
          24 ITEMS
        </span>
      </div>
      <div className="mt-4 flex gap-1.5 px-6">
        {["ALL", "CASHMERE", "WOOL", "COTTON", "BLEND"].map((t, i) => (
          <span
            key={t}
            className="font-[var(--font-jetbrains)]"
            style={{
              fontSize: 9,
              padding: "5px 9px",
              border: `0.5px solid ${i === 0 ? INK : HAIR_STRONG}`,
              color: i === 0 ? PAPER : INK,
              background: i === 0 ? INK : "transparent",
              letterSpacing: "0.16em"
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 px-6">
        {[
          { i: 1, name: "Crewneck — Ivory", code: "K01", price: "—", swatch: "#ece7dc" },
          { i: 2, name: "Cardigan — Charcoal", code: "K02", price: "—", swatch: "#383634" },
          { i: 3, name: "Polo Knit — Camel", code: "K03", price: "—", swatch: "#b29063" },
          { i: 4, name: "Mockneck — Black", code: "K04", price: "—", swatch: "#0e0d0c" }
        ].map((p) => (
          <div key={p.i}>
            <div
              className="relative aspect-[4/5]"
              style={{ background: "#f4f2ee", borderTop: `1px solid ${INK}` }}
            >
              <span
                className="font-[var(--font-jetbrains)] absolute left-2 top-2"
                style={{ fontSize: 8.5, color: MUTED, letterSpacing: "0.14em" }}
              >
                /{String(p.i).padStart(3, "0")}
              </span>
              <div className="flex h-full items-center justify-center">
                <KnitGarment color={p.swatch} />
              </div>
              <div
                className="absolute right-2 top-2"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  border: `0.5px solid ${HAIR_STRONG}`,
                  background: p.swatch
                }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <p
                className="font-[var(--font-fraunces)]"
                style={{ fontSize: 13, fontWeight: 400, letterSpacing: "-0.01em" }}
              >
                {p.name}
              </p>
              <span
                className="font-[var(--font-jetbrains)]"
                style={{ fontSize: 9, color: MUTED }}
              >
                {p.code}
              </span>
            </div>
          </div>
        ))}
      </div>
      <BottomDockGallery active="closet" />
    </div>
  );
}

function ScreenSchedule() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Header section="SCHEDULE / FEB" n="045" />
      <div className="flex items-baseline justify-between px-6 pt-5">
        <h2
          className="font-[var(--font-fraunces)]"
          style={{ fontSize: 38, fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 0.95 }}
        >
          February
          <br />
          <span style={{ fontStyle: "italic", color: ACCENT }}>twenty-six</span>
        </h2>
        <span className="font-[var(--font-jetbrains)]" style={{ fontSize: 9.5, color: MUTED, letterSpacing: "0.18em" }}>
          ← / →
        </span>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-px px-6" style={{ background: HAIR }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="font-[var(--font-jetbrains)]"
            style={{
              fontSize: 8.5,
              padding: "6px 0",
              textAlign: "center",
              background: PAPER,
              color: MUTED,
              letterSpacing: "0.16em"
            }}
          >
            {d}
          </div>
        ))}
        {Array.from({ length: 28 }).map((_, i) => {
          const day = i + 1;
          const accent = day === 10;
          const dot = [4, 7, 12, 17, 22, 25].includes(day);
          return (
            <div
              key={i}
              className="relative"
              style={{
                aspectRatio: "1 / 1",
                background: PAPER,
                borderBottom: accent ? `2px solid ${ACCENT}` : "none"
              }}
            >
              <span
                className="font-[var(--font-fraunces)] absolute left-1.5 top-1.5"
                style={{
                  fontSize: 12,
                  fontWeight: accent ? 500 : 400,
                  color: accent ? ACCENT : INK
                }}
              >
                {day}
              </span>
              {dot && (
                <span
                  className="absolute bottom-1.5 right-1.5"
                  style={{ width: 4, height: 4, background: INK, borderRadius: 999 }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mx-6 mt-5 h-px" style={{ background: INK }} />
      <div className="flex items-baseline justify-between px-6 pt-4">
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" }}
        >
          ☐ TUE 10 — Editorial meeting
        </span>
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 9, color: MUTED, letterSpacing: "0.16em" }}
        >
          09:30
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 px-6">
        <CapsuleCard label="Layer" code="01" tone={INK}>
          <KnitGarment color="#0e0d0c" small />
        </CapsuleCard>
        <CapsuleCard label="Base" code="02" tone={INK}>
          <Trouser color="#3b3a36" small />
        </CapsuleCard>
        <CapsuleCard label="Outer" code="03" tone={ACCENT}>
          <Bomber color="#0a0a0a" small />
        </CapsuleCard>
      </div>
      <div className="mx-6 mt-4 h-px" style={{ background: HAIR }} />
      <div className="flex items-center justify-between px-6 pt-3">
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 9.5, color: MUTED, letterSpacing: "0.22em", textTransform: "uppercase" }}
        >
          + log new fitting
        </span>
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 9.5, letterSpacing: "0.16em", color: ACCENT }}
        >
          ●
        </span>
      </div>
      <BottomDockGallery active="calendar" />
    </div>
  );
}

function CapsuleCard({
  label,
  code,
  tone,
  children
}: {
  label: string;
  code: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" style={{ borderTop: `1px solid ${tone}` }}>
      <div className="flex items-center justify-between pt-1.5">
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 8.5, color: MUTED, letterSpacing: "0.18em", textTransform: "uppercase" }}
        >
          {label}
        </span>
        <span
          className="font-[var(--font-jetbrains)]"
          style={{ fontSize: 8.5, color: tone, letterSpacing: "0.16em" }}
        >
          /{code}
        </span>
      </div>
      <div
        className="mt-1 flex aspect-[3/4] items-center justify-center"
        style={{ background: "#f4f2ee" }}
      >
        {children}
      </div>
    </div>
  );
}

function BottomDockGallery({ active }: { active: "closet" | "ai" | "calendar" | "home" }) {
  const items = [
    { id: "closet", label: "CLOSET", n: "01" },
    { id: "ai", label: "OUTFITS", n: "02" },
    { id: "calendar", label: "DIARY", n: "03" },
    { id: "home", label: "INDEX", n: "04" }
  ] as const;
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20"
      style={{ background: PAPER, borderTop: `1px solid ${INK}` }}
    >
      <div className="grid h-[68px] grid-cols-4 items-center">
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <div
              key={it.id}
              className="flex flex-col items-center gap-1"
              style={{ borderRight: `0.5px solid ${HAIR}` }}
            >
              <span
                className="font-[var(--font-jetbrains)]"
                style={{
                  fontSize: 9,
                  color: isActive ? ACCENT : MUTED,
                  letterSpacing: "0.18em"
                }}
              >
                /{it.n}
              </span>
              <span
                className="font-[var(--font-fraunces)]"
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? INK : "#444",
                  letterSpacing: "0.14em",
                  fontStyle: isActive ? "italic" : "normal"
                }}
              >
                {it.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* glyphs */

function KnitGarment({ color, small }: { color: string; small?: boolean }) {
  const w = small ? 36 : 70;
  const h = small ? 46 : 84;
  return (
    <svg width={w} height={h} viewBox="0 0 60 70">
      <path d="M16 8c0-3 5-6 14-6s14 3 14 6l8 6-3 12h-3v34H14V26h-3l-3-12 8-6z" fill={color} />
      <line x1="30" y1="14" x2="30" y2="58" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
    </svg>
  );
}
function Trouser({ color, small }: { color: string; small?: boolean }) {
  const w = small ? 36 : 70;
  const h = small ? 46 : 84;
  return (
    <svg width={w} height={h} viewBox="0 0 60 70">
      <path d="M14 6h32l-2 12-3 46h-9l-2-32-2 32h-9l-3-46-2-12z" fill={color} />
    </svg>
  );
}
function Bomber({ color, small }: { color: string; small?: boolean }) {
  const w = small ? 36 : 70;
  const h = small ? 46 : 84;
  return (
    <svg width={w} height={h} viewBox="0 0 60 70">
      <path d="M12 8L24 4l6 6 6-6 12 4-2 14-4 1v33H18V27l-4-1-4-14 2-4z" fill={color} />
      <rect x="14" y="20" width="32" height="2" fill="rgba(255,255,255,0.16)" />
      <rect x="14" y="50" width="32" height="2" fill="rgba(255,255,255,0.16)" />
    </svg>
  );
}
